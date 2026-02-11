/* Eldralore World Sync Server
 * - HTTP: GET/POST /world-state
 * - WS: /ws (broadcast)
 *
 * Segurança:
 * - Por padrão, NÃO exige autenticação (ambiente privado).
 * - Se quiser exigir chave para POST:
 *   set GM_KEY="sua-chave" (Windows) ou export GM_KEY="sua-chave" (Linux/Mac)
 *   e o cliente deve enviar header: x-gm-key
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const GM_KEY = process.env.GM_KEY ? String(process.env.GM_KEY) : '';
const DATA_FILE = path.join(__dirname, 'world-state.json');

function readState(){
  try{
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  }catch(e){
    return { rev:1, updatedAt:0, worldTime:{day:1,month:1,year:1}, climate:{regions:{}} };
  }
}

function writeState(obj){
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

function sendJson(res, code, obj){
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-gm-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if(req.method === 'OPTIONS'){
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-gm-key',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  if(req.url === '/world-state' && req.method === 'GET'){
    return sendJson(res, 200, readState());
  }

  if(req.url === '/world-state' && req.method === 'POST'){
    if(GM_KEY){
      const key = req.headers['x-gm-key'] ? String(req.headers['x-gm-key']) : '';
      if(key !== GM_KEY) return sendJson(res, 401, { error:'unauthorized' });
    }
    let data = '';
    req.on('data', chunk => { data += chunk; if(data.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try{
        const obj = JSON.parse(data || '{}');
        // validação mínima
        if(!obj || typeof obj !== 'object') throw new Error('bad body');
        if(!obj.worldTime) obj.worldTime = {day:1,month:1,year:1};
        if(!obj.climate) obj.climate = { regions:{} };
        if(!obj.rev) obj.rev = Date.now();
        obj.updatedAt = Date.now();

        writeState(obj);

        // broadcast WS
        const msg = JSON.stringify({ type:'world_state', payload: obj });
        wss.clients.forEach(c => { try{ if(c.readyState===1) c.send(msg); }catch(e){} });

        return sendJson(res, 200, { ok:true, rev: obj.rev, updatedAt: obj.updatedAt });
      }catch(e){
        return sendJson(res, 400, { error:'bad_request' });
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8', 'Access-Control-Allow-Origin':'*' });
  res.end('not found');
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (socket) => {
  // manda estado atual imediatamente
  try{
    const st = readState();
    socket.send(JSON.stringify({ type:'world_state', payload: st }));
  }catch(e){}
  socket.on('message', (data) => {
    // cliente GM pode publicar via WS também
    try{
      const msg = JSON.parse(String(data||'{}'));
      if(msg.type === 'publish' && msg.payload){
        if(GM_KEY){
          // se GM_KEY estiver setado, WS publish não é aceito (use POST com header)
          return;
        }
        const obj = msg.payload;
        obj.updatedAt = Date.now();
        writeState(obj);
        const out = JSON.stringify({ type:'world_state', payload: obj });
        wss.clients.forEach(c => { try{ if(c.readyState===1) c.send(out); }catch(e){} });
      }
    }catch(e){}
  });
});

server.listen(PORT, () => {
  console.log('World Sync server on http://0.0.0.0:' + PORT);
});
