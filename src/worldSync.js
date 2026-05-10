// -------- World Sync (estado global via servidor opcional) --------
//
// Objetivo:
// - Jogadores: receber updates do "estado global do mundo" (dia/mês/ano + clima por região)
// - GM: publicar updates para todos
//
// Funciona em 3 camadas, nesta ordem:
// 1) WebSocket (push realtime) se disponível
// 2) Polling HTTP (fallback) a cada N segundos
// 3) Sem sync: comportamento atual (localStorage por navegador)
//
// Para ativar: abrir o mapa com ?sync=https://SEU_HOST:8787
// (o servidor deste projeto fica em /server)

const WorldSync = (() => {
  let enabled = false;
  let syncUrl = null;        // ex: https://host:8787
  let ws = null;
  let pollTimer = null;
  let lastRev = 0;
  let status = 'off';        // off|connecting|live|polling|error
  let isGm = false;

  function getParam(name){
    try{
      const u = new URL(window.location.href);
      return u.searchParams.get(name);
    }catch(_){ return null; }
  }

  function normalizeUrl(u){
    if(!u) return null;
    u = String(u).trim();
    if(!u) return null;
    // aceita http(s)://
    if(!/^https?:\/\//i.test(u)) u = 'http://' + u;
    return u.replace(/\/+$/,'');
  }

  function getSyncUrl(){
    const fromQuery = getParam('sync');
    const fromLs = localStorage.getItem('eldralore_sync_url');
    return normalizeUrl(fromQuery || fromLs || '');
  }

  function setSyncUrl(u){
    const nu = normalizeUrl(u);
    if(nu) localStorage.setItem('eldralore_sync_url', nu);
    else localStorage.removeItem('eldralore_sync_url');
  }

  function setGmMode(v){
    isGm = !!v;
  }

  function emitStatus(){
    // Atualiza UI se existir
    if(els && els.syncStatus){
      els.syncStatus.textContent = enabled ? `SYNC: ${status}` : 'SYNC: off';
      els.syncStatus.classList.toggle('is-live', status==='live');
      els.syncStatus.classList.toggle('is-err', status==='error');
    }
  }

  async function fetchWorldState(){
    if(!enabled || !syncUrl) return null;
    try{
      const r = await fetch(syncUrl + '/world-state', { cache: 'no-store' });
      if(!r.ok) throw new Error('HTTP '+r.status);
      return await r.json();
    }catch(e){
      status = 'error';
      emitStatus();
      return null;
    }
  }

  function applyIncomingWorldState(wsObj){
    if(!wsObj || typeof wsObj !== 'object') return;
    const rev = Number(wsObj.rev||0);
    if(rev && rev <= lastRev) return;

    // aplica tempo global
    if(wsObj.worldTime && typeof wsObj.worldTime === 'object'){
      state.worldTime = {
        day: Number(wsObj.worldTime.day||1),
        month: Number(wsObj.worldTime.month||1),
        year: Number(wsObj.worldTime.year||1),
      };
    }

    // aplica clima regional
    if(wsObj.climate && wsObj.climate.regions && typeof wsObj.climate.regions === 'object'){
      state.worldState.climate = state.worldState.climate || { regions:{} };
      state.worldState.climate.regions = wsObj.climate.regions;
    }

    // aplica estados GM da Visão do Mundo
    if(wsObj.economy && typeof wsObj.economy === 'object'){
      state.economy = { modifiers: Array.isArray(wsObj.economy.modifiers) ? wsObj.economy.modifiers : [] };
    }

    if(wsObj.campaign && typeof wsObj.campaign === 'object'){
      state.campaign = {
        timeline: Array.isArray(wsObj.campaign.timeline) ? wsObj.campaign.timeline : [],
        pinSecrets: wsObj.campaign.pinSecrets && typeof wsObj.campaign.pinSecrets === 'object' ? wsObj.campaign.pinSecrets : {},
        hooks: wsObj.campaign.hooks && typeof wsObj.campaign.hooks === 'object' ? wsObj.campaign.hooks : {},
        importantNpcs: Array.isArray(wsObj.campaign.importantNpcs) ? wsObj.campaign.importantNpcs : [],
      };
    }

    if(wsObj.vision && wsObj.vision.pins && typeof wsObj.vision.pins === 'object'){
      state.worldState.vision = { pins: wsObj.vision.pins };
    }
    if(wsObj.groupReputation && wsObj.groupReputation.pins && typeof wsObj.groupReputation.pins === 'object'){
      state.worldState.groupReputation = { pins: wsObj.groupReputation.pins };
    }
    if(wsObj.rumors && wsObj.rumors.pins && typeof wsObj.rumors.pins === 'object'){
      state.worldState.rumors = { pins: wsObj.rumors.pins };
    }

    state.worldState.rev = rev || (state.worldState.rev + 1);
    state.worldState.updatedAt = Number(wsObj.updatedAt||Date.now());

    lastRev = state.worldState.rev;

    // Reflete UI e re-render
    try{
      reflectDateInputs && reflectDateInputs();
    }catch(_){}
    update && update();
    try{ drawClimateOverlay && drawClimateOverlay(); }catch(_){}
  }

  function openWs(){
    if(!enabled || !syncUrl) return;
    try{
      const wsUrl = syncUrl.replace(/^http/i,'ws') + '/ws';
      ws = new WebSocket(wsUrl);
      status = 'connecting';
      emitStatus();

      ws.onopen = () => {
        status = 'live';
        emitStatus();
        // Ao conectar, pede o estado atual
        try{ ws.send(JSON.stringify({ type:'hello' })); }catch(_){}
      };

      ws.onmessage = (ev) => {
        try{
          const msg = JSON.parse(ev.data);
          if(msg && msg.type === 'world_state'){
            applyIncomingWorldState(msg.payload);
          }
        }catch(_){}
      };

      ws.onclose = () => {
        ws = null;
        // fallback para polling
        if(enabled){
          status = 'polling';
          emitStatus();
        }
      };

      ws.onerror = () => {
        status = 'error';
        emitStatus();
        try{ ws.close(); }catch(_){}
        ws = null;
      };
    }catch(e){
      status = 'error';
      emitStatus();
      ws = null;
    }
  }

  function startPolling(){
    if(pollTimer) clearInterval(pollTimer);
    if(!enabled) return;
    status = (status==='live') ? status : 'polling';
    emitStatus();
    pollTimer = setInterval(async () => {
      const s = await fetchWorldState();
      if(s) applyIncomingWorldState(s);
    }, 3000);
  }

  async function init(){
    syncUrl = getSyncUrl();
    enabled = !!syncUrl;
    status = enabled ? 'connecting' : 'off';
    emitStatus();

    if(!enabled) return;

    // primeiro fetch (garante estado inicial)
    const first = await fetchWorldState();
    if(first) applyIncomingWorldState(first);

    // tenta websocket e inicia polling como fallback
    openWs();
    startPolling();
  }

  async function pushWorldState(reason='update'){
    if(!enabled || !syncUrl || !isGm) return false;

    const payload = {
      rev: Number(state.worldState.rev||0) + 1,
      updatedAt: Date.now(),
      worldTime: state.worldTime,
      climate: state.worldState.climate || { regions:{} },
      vision: state.worldState.vision || { pins:{} },
      groupReputation: state.worldState.groupReputation || { pins:{} },
      rumors: state.worldState.rumors || { pins:{} },
      economy: state.economy || { modifiers: [] },
      campaign: state.campaign || { timeline: [], pinSecrets: {}, hooks: {}, importantNpcs: [] },
      reason,
    };

    // otimista: incrementa local já
    state.worldState.rev = payload.rev;
    state.worldState.updatedAt = payload.updatedAt;
    lastRev = payload.rev;

    // tenta ws (se aberto) para broadcast imediato
    try{
      if(ws && ws.readyState === 1){
        ws.send(JSON.stringify({ type:'publish', payload }));
      }
    }catch(_){}

    // e garante persistência via HTTP
    try{
      const r = await fetch(syncUrl + '/world-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if(!r.ok) throw new Error('HTTP '+r.status);
      status = (ws && ws.readyState===1) ? 'live' : 'polling';
      emitStatus();
      return true;
    }catch(e){
      status = 'error';
      emitStatus();
      return false;
    }
  }

  return {
    init,
    enabled: () => enabled,
    getUrl: () => syncUrl,
    setSyncUrl,
    setGmMode,
    pushWorldState,
  };
})();
