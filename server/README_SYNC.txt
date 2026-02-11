WORLD SYNC SERVER (opcional)

Objetivo:
- Manter um "estado global do mundo" (dia/mês/ano + overrides de clima por região)
- Quando o GM altera algo, todos os jogadores recebem atualização (WebSocket) ou em até ~3s (polling).

Como rodar (Node 18+):
1) Abra um terminal nesta pasta /server
2) npm install
3) node server.js

Porta padrão: 8787
Endpoints:
- GET  /world-state        -> retorna JSON do estado
- POST /world-state        -> grava e notifica clientes
- WS   /ws                 -> push realtime (broadcast)

Como os clientes conectam:
- Abra o mapa com o parâmetro:
  ?sync=http://SEU_IP_OU_DOMINIO:8787

Dica prática:
- Hospede esse server no mesmo host do site do mapa (ou com CORS liberado).
