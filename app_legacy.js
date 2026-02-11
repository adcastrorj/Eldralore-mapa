// Atlas de Eldralore (pacote consolidado)
// - Layout estável: pins e mapa no mesmo palco (coords percentuais)
// - Filtros: camada, raça (território), tipo, busca, "ocultar sem imagem"
// - Camadas: Superfície, Subterrâneo, Aéreo, Subaquática, Abismo
// - Modais: fecham no X, ESC e clique fora
// - City View: sublocais, NPCs e comerciantes com inventário dinâmico (20 itens)
// - Clima: overlay automático (modelo leve) + calendário interno

// Bump de versão para evitar conflitos com estados antigos no localStorage
const STORAGE_KEY = 'eldralore_state_v2_v10';
const LEGACY_KEYS = ['eldralore_state_v2_v6','eldralore_state_v2_v7','eldralore_state_v2_v8'];

const state = {
  layer: 'world',
  race: 'all',
  type: 'all',
  q: '',
  debug: false,
  climateOn: true,
  hideNoImage: false,
  pins: [],
  filtered: [],
  cities: {},
  zones: null,
  zonePolys: [],
  uiCollapsed: false,
  worldTime: { day: 1, month: 1, year: 1 },
  dateLock: true,
  gm: { unlocked: false, showImportantNpcs: false, showAllInfo: false, editorOpen: false, editorMinimized: false, captureMode: false, selectedPinId: null },
  customPins: [],
  customCities: {},
  pinOverrides: {},
  merchantState: {},
  view: { scale: 1, panX: 0, panY: 0 },
  measure: { on: false, a: null, b: null },
  items: [],
  ui: {
    cityOpenId: null,
    selectedPlaceId: null,
    selectedMerchantId: null,
  },
};

// Cores únicas por território (não repetem)
const TERRITORY_COLORS = {
  humans: '#e74c3c',
  elves: '#2ecc71',
  dwarves: '#e67e22',
  vampires: '#9b59b6',
  orcs: '#8e6b3a',
  nagas: '#16a085',
  centaurs: '#a3e635',
  dragons: '#d35400',
  demons: '#e84393',
  fae: '#00d2d3',
  giants: '#95a5a6',
  gnomes: '#f1c40f',
  undead: '#14532d',
  angels: '#74b9ff',
};

// Tipos especiais com cor própria (não repetem)
const TYPE_COLORS = {
  temple: '#f5d76e',
  dungeon: '#ff4757',
  city_main: '#7aa7ff',
  guild_hq: '#00a8ff',
};

// ---- Escala do mundo / viagem ----
// Premissa do usuário: circundar o mundo inteiro (horizontal e vertical) leva 4 anos viajando 40 km/dia.
// Circunferência = 4 * 365 * 40 = 58.400 km.
const TRAVEL_KM_PER_DAY = 40;
const WORLD_CIRCUMFERENCE_KM = 4 * 365 * TRAVEL_KM_PER_DAY;

const els = {
  layerSelect: document.getElementById('layerSelect'),
  raceSelect: document.getElementById('raceSelect'),
  typeSelect: document.getElementById('typeSelect'),
  searchInput: document.getElementById('searchInput'),
  debugToggle: document.getElementById('debugToggle'),
  measureToggle: document.getElementById('measureToggle'),
  climateToggle: document.getElementById('climateToggle'),
  hideNoImageToggle: document.getElementById('hideNoImageToggle'),

  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  zoomLabel: document.getElementById('zoomLabel'),

  uiCollapseBtn: document.getElementById('uiCollapseBtn'),
  mobileFiltersBtn: document.getElementById('mobileFiltersBtn'),
  mobileLocationsBtn: document.getElementById('mobileLocationsBtn'),
  mobileBackdrop: document.getElementById('mobileBackdrop'),
  controlsPanel: document.getElementById('controlsPanel'),
  sidebarPanel: document.getElementById('sidebarPanel'),
  topbar: document.querySelector('.topbar'),

  // calendario / GM
  worldTimeLabel: document.getElementById('worldTimeLabel'),
  advanceDayBtn: document.getElementById('advanceDayBtn'),
  dayInput: document.getElementById('dayInput'),
  monthInput: document.getElementById('monthInput'),
  yearInput: document.getElementById('yearInput'),
  applyDateBtn: document.getElementById('applyDateBtn'),
  dateLockToggle: document.getElementById('dateLockToggle'),
  gmLoginBtn: document.getElementById('gmLoginBtn'),
  gmLogoutBtn: document.getElementById('gmLogoutBtn'),
  importantNpcToggle: document.getElementById('importantNpcToggle'),
  expandAllInfoToggle: document.getElementById('expandAllInfoToggle'),
  gmHint: document.getElementById('gmHint'),

  gmEditorBtn: document.getElementById('gmEditorBtn'),
  gmEditorBackdrop: document.getElementById('gmEditorBackdrop'),
  minimizeGmEditor: document.getElementById('minimizeGmEditor'),
  gmSelectPinBtn: document.getElementById('gmSelectPinBtn'),
  closeGmEditor: document.getElementById('closeGmEditor'),
  gmPinType: document.getElementById('gmPinType'),
  gmPinLayer: document.getElementById('gmPinLayer'),
  gmPinTerritory: document.getElementById('gmPinTerritory'),
  gmPinName: document.getElementById('gmPinName'),
  gmPinCityId: document.getElementById('gmPinCityId'),
  gmAlwaysLabel: document.getElementById('gmAlwaysLabel'),
  gmPinX: document.getElementById('gmPinX'),
  gmPinY: document.getElementById('gmPinY'),
  gmCaptureBtn: document.getElementById('gmCaptureBtn'),
  gmCreatePinBtn: document.getElementById('gmCreatePinBtn'),
  gmZoneSelect: document.getElementById('gmZoneSelect'),
  gmCountInput: document.getElementById('gmCountInput'),
  gmPromoteBtn: document.getElementById('gmPromoteBtn'),
  gmDemoteBtn: document.getElementById('gmDemoteBtn'),
  gmExportBtn: document.getElementById('gmExportBtn'),

  // configurar cidade do pin selecionado
  gmSelectedPin: document.getElementById('gmSelectedPin'),
  gmMakeCityMainBtn: document.getElementById('gmMakeCityMainBtn'),
  gmMakeSettlementBtn: document.getElementById('gmMakeSettlementBtn'),
  gmCountTavern: document.getElementById('gmCountTavern'),
  gmCountInn: document.getElementById('gmCountInn'),
  gmCountBlacksmith: document.getElementById('gmCountBlacksmith'),
  gmCountTailor: document.getElementById('gmCountTailor'),
  gmCountAlchemy: document.getElementById('gmCountAlchemy'),
  gmCountGeneral: document.getElementById('gmCountGeneral'),
  gmMerchantsPerPlace: document.getElementById('gmMerchantsPerPlace'),
  gmApplyCityConfigBtn: document.getElementById('gmApplyCityConfigBtn'),

  mapStage: document.getElementById('mapStage'),
  mapZoomLayer: document.getElementById('mapZoomLayer'),
  pins: document.getElementById('pins'),
  list: document.getElementById('list'),
  tooltip: document.getElementById('tooltip'),
  climateCanvas: document.getElementById('climateCanvas'),
  measureSvg: document.getElementById('measureSvg'),

  worldMap: document.getElementById('worldMap'),
  bordersOverlay: document.getElementById('bordersOverlay'),

  // modals
  locBackdrop: document.getElementById('locBackdrop'),
  closeLoc: document.getElementById('closeLoc'),
  modalTitle: document.getElementById('modalTitle'),
  modalMeta: document.getElementById('modalMeta'),
  modalBody: document.getElementById('modalBody'),

  cityBackdrop: document.getElementById('cityBackdrop'),
  closeCity: document.getElementById('closeCity'),
  cityTitle: document.getElementById('cityTitle'),
  cityMeta: document.getElementById('cityMeta'),
  cityHero: document.getElementById('cityHero'),
  cityDesc: document.getElementById('cityDesc'),
  cityPlaces: document.getElementById('cityPlaces'),
  placePanel: document.getElementById('placePanel'),
  merchantPanel: document.getElementById('merchantPanel'),

  debugBackdrop: document.getElementById('debugBackdrop'),
  closeDebug: document.getElementById('closeDebug'),
  debugBody: document.getElementById('debugBody'),
};

// Viewport real do conteúdo do mapa (respeita object-fit: contain)
// Usado para alinhar pins, tooltip e canvas de clima ao mapa (evita "drift" quando a altura muda).
const mapViewport = { x: 0, y: 0, w: 0, h: 0 };

function computeContainViewport(containerRect, naturalW, naturalH){
  const W = Math.max(1, containerRect.width);
  const H = Math.max(1, containerRect.height);
  const imgW = Math.max(1, naturalW || 1);
  const imgH = Math.max(1, naturalH || 1);

  const imgAR = imgW / imgH;
  const boxAR = W / H;

  let w, h, x, y;
  if(boxAR > imgAR){
    // Altura limita
    h = H;
    w = H * imgAR;
    x = (W - w) / 2;
    y = 0;
  }else{
    // Largura limita
    w = W;
    h = W / imgAR;
    x = 0;
    y = (H - h) / 2;
  }
  return { x, y, w, h };
}

function applyMapViewport(){
  if(!els.mapStage || !els.worldMap) return;
  const stageRect = els.mapStage.getBoundingClientRect();
  const natW = els.worldMap.naturalWidth || 0;
  const natH = els.worldMap.naturalHeight || 0;
  const v = computeContainViewport(stageRect, natW, natH);
  mapViewport.x = v.x; mapViewport.y = v.y; mapViewport.w = v.w; mapViewport.h = v.h;

  // Ajusta elementos overlay para o viewport real do mapa
  for(const el of [els.pins, els.tooltip, els.climateCanvas, els.measureSvg]){
    if(!el) continue;
    el.style.left = `${v.x}px`;
    el.style.top = `${v.y}px`;
    el.style.width = `${v.w}px`;
    el.style.height = `${v.h}px`;
  }

  // Re-render de clima (depende de width/height do viewport)
  drawClimateOverlay();
}

// ---- Zoom/Pan (aplicado na camada #mapZoomLayer) ----
function applyZoom(){
  if(!els.mapZoomLayer) return;
  const { scale, panX, panY } = state.view;
  els.mapZoomLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  if(els.zoomLabel) els.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

function clampZoom(s){
  return clamp(s, 0.5, 5);
}

function zoomAboutPoint(newScale, px, py){
  const old = state.view.scale;
  const ns = clampZoom(newScale);
  if(ns === old) return;
  const r = old === 0 ? 1 : (ns / old);
  // Mantém o ponto (px,py) fixo na tela
  state.view.panX = px - (px - state.view.panX) * r;
  state.view.panY = py - (py - state.view.panY) * r;
  state.view.scale = ns;
  applyZoom();
}

function resetZoom(){
  state.view.scale = 1;
  state.view.panX = 0;
  state.view.panY = 0;
  applyZoom();
}

let panDrag = { active: false, startX: 0, startY: 0, basePanX: 0, basePanY: 0, lastMoveTs: 0 };

// ---- Régua / viagem ----
function resetMeasure(){
  state.measure.a = null;
  state.measure.b = null;
  drawMeasure();
}

function drawMeasure(){
  if(!els.measureSvg) return;
  els.measureSvg.setAttribute('viewBox', '0 0 100 100');
  els.measureSvg.setAttribute('preserveAspectRatio', 'none');
  const a = state.measure.a;
  const b = state.measure.b;
  if(!state.measure.on || !a){
    els.measureSvg.innerHTML = '';
    return;
  }
  const ax = a[0], ay = a[1];
  const bx = b ? b[0] : ax;
  const by = b ? b[1] : ay;
  const line = `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="rgba(255,255,255,.85)" stroke-width="0.35" />`;
  const ca = `<circle cx="${ax}" cy="${ay}" r="0.8" fill="rgba(122,167,255,.95)" stroke="rgba(0,0,0,.55)" stroke-width="0.25" />`;
  const cb = b ? `<circle cx="${bx}" cy="${by}" r="0.8" fill="rgba(255,200,90,.95)" stroke="rgba(0,0,0,.55)" stroke-width="0.25" />` : '';
  els.measureSvg.innerHTML = line + ca + cb;
}

function computeTravel(a, b){
  const natW = els.worldMap?.naturalWidth || 0;
  const natH = els.worldMap?.naturalHeight || 0;
  if(!natW || !natH) return null;

  const ax = (a[0] / 100) * natW;
  const ay = (a[1] / 100) * natH;
  const bx = (b[0] / 100) * natW;
  const by = (b[1] / 100) * natH;

  let dx = Math.abs(bx - ax);
  let dy = Math.abs(by - ay);
  // Mundo em "globo" (wrap horizontal e vertical, conforme premissa)
  dx = Math.min(dx, natW - dx);
  dy = Math.min(dy, natH - dy);

  const kmPerPxX = WORLD_CIRCUMFERENCE_KM / natW;
  const kmPerPxY = WORLD_CIRCUMFERENCE_KM / natH;
  const distKm = Math.hypot(dx * kmPerPxX, dy * kmPerPxY);
  const days = distKm / TRAVEL_KM_PER_DAY;
  return { distKm, days, kmPerPxX, kmPerPxY };
}

function formatTravel(days){
  const total = Math.ceil(days);
  const years = Math.floor(total / 365);
  const rem = total % 365;
  const months = Math.floor(rem / 30);
  const d = rem % 30;
  const parts = [];
  if(years) parts.push(`${years} ano(s)`);
  if(months) parts.push(`${months} mês(es)`);
  parts.push(`${d} dia(s)`);
  return `${total} dias (${parts.join(', ')})`;
}

function escapeHtml(s){
  return String(s||'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function layerLabel(l){
  if(l==='underground') return 'Subterrâneo';
  if(l==='sky') return 'Aéreo';
  if(l==='subaquatica') return 'Subaquática';
  if(l==='abismo') return 'Abismo';
  return 'Superfície';
}

function typeLabel(t){
  if(t==='temple') return 'Templo';
  if(t==='guild_hq') return 'Guilda';
  if(t==='city_main') return 'Cidade Principal';
  if(t==='settlement') return 'Assentamento';
  if(t==='fortress') return 'Fortaleza';
  if(t==='dungeon') return 'Masmorra';
  if(t==='underground_entry') return 'Passagem';
  return t || '';
}

function raceLabel(r){
  const map = {
    humans:'Humanos', elves:'Elfos', dwarves:'Anões', vampires:'Vampiros', orcs:'Orcs', nagas:'Nagas',
    centaurs:'Centauros', dragons:'Dragões', demons:'Demônios', fae:'Feéricos', giants:'Gigantes',
    gnomes:'Gnomos', undead:'Mortos-vivos', angels:'Anjos'
  };
  return map[r] || r || '';
}

function seasonFromMonth(month){
  // Modelo simples (padrão hemisfério sul):
  // 12-2 Verão, 3-5 Outono, 6-8 Inverno, 9-11 Primavera
  if([12,1,2].includes(month)) return 'Verão';
  if([3,4,5].includes(month)) return 'Outono';
  if([6,7,8].includes(month)) return 'Inverno';
  return 'Primavera';
}

function clamp(n, a, b){
  return Math.max(a, Math.min(b, n));
}

function hashStringToUint32(str){
  let h = 2166136261;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadPersistentState(){
  try{
    let raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){
      for(const k of (typeof LEGACY_KEYS!=='undefined'?LEGACY_KEYS:[])){
        raw = localStorage.getItem(k);
        if(raw) break;
      }
    }
    if(!raw) return;
    const obj = JSON.parse(raw);
    if(obj && obj.worldTime) state.worldTime = obj.worldTime;
    if(typeof obj.climateOn === 'boolean') state.climateOn = obj.climateOn;
    if(typeof obj.hideNoImage === 'boolean') state.hideNoImage = obj.hideNoImage;
    if(typeof obj.dateLock === 'boolean') state.dateLock = obj.dateLock;
    if(typeof obj.uiCollapsed === 'boolean') state.uiCollapsed = obj.uiCollapsed;
    if(typeof obj.showImportantNpcs === 'boolean') state.gm.showImportantNpcs = obj.showImportantNpcs;

    if(Array.isArray(obj.customPins)) state.customPins = obj.customPins;
    if(obj.customCities && typeof obj.customCities === 'object') state.customCities = obj.customCities;
    if(obj.pinOverrides && typeof obj.pinOverrides === 'object') state.pinOverrides = obj.pinOverrides;
    if(obj.merchantState && typeof obj.merchantState === 'object') state.merchantState = obj.merchantState;
  }catch{ /* ignore */ }
}

function persistState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      worldTime: state.worldTime,
      climateOn: state.climateOn,
      hideNoImage: state.hideNoImage,
      dateLock: state.dateLock,
      showImportantNpcs: state.gm.showImportantNpcs,
      uiCollapsed: state.uiCollapsed,
      customPins: state.customPins,
      customCities: state.customCities,
      pinOverrides: state.pinOverrides,
      merchantState: state.merchantState,
    }));
  }catch{ /* ignore */ }
}

async function loadJson(path){
  const res = await fetch(path, { cache: 'no-store' });
  if(!res.ok) throw new Error(`Falha ao carregar ${path}: ${res.status}`);
  return await res.json();
}

async function loadPins(){
  const basePins = await loadJson('data/pins.json');
  let extraPins = [];
  try{ extraPins = await loadJson('data/main_cities_pins.json'); }catch{ extraPins = []; }

  // Pins criados via Editor GM ficam em state.customPins (persistidos)
  const customPins = Array.isArray(state.customPins) ? state.customPins : [];

  // Mescla e aplica overrides de tipo/race/camada, sem alterar o JSON base
  const all = [...basePins, ...extraPins, ...customPins].map(p => applyPinOverrides(p));

  // Dedup de cidades principais por cityId (prioriza pins com 2 imagens + descrição curta).
  // Necessário porque pins criados no GM Editor (customPins) persistem em localStorage e podem duplicar cidades principais.
  const bestCityMainById = new Map();
  const kept = [];
  for(const p of all){
    const isCityMain = p && p.type === 'city_main' && p.cityId;
    if(!isCityMain){
      kept.push(p);
      continue;
    }
    const imgs = Array.isArray(p.images) ? p.images.length : 0;
    const has2 = imgs >= 2 ? 10 : 0;
    const hasDesc = (p.description && String(p.description).trim().length > 0) ? 1 : 0;
    const onWorld = (p.layer === 'world') ? 1 : 0;
    const score = has2 + hasDesc + onWorld;

    const prev = bestCityMainById.get(p.cityId);
    if(!prev || score > prev.score){
      bestCityMainById.set(p.cityId, { pin: p, score });
    }
  }
  // Reinsere os city_main "melhores" no final para garantir clique/visibilidade consistente
  for(const {pin} of bestCityMainById.values()){
    kept.push(pin);
  }

  state.pins = kept;
}

async function loadCities(){
  try{
    state.cities = await loadJson('data/cities.json');
  }catch{
    state.cities = {};
  }
}

async function loadZones(){
  try{
    state.zones = await loadJson('data/zones.json');
  }catch{
    state.zones = null;
  }
  buildZoneIndex();
}

function polygonAreaCentroid(poly){
  // poly: [[x,y],...], coordenadas em % (0..100)
  let a = 0;
  let cx = 0;
  let cy = 0;
  for(let i=0; i<poly.length; i++){
    const [x1,y1] = poly[i];
    const [x2,y2] = poly[(i+1)%poly.length];
    const f = x1*y2 - x2*y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  a *= 0.5;
  if(Math.abs(a) < 1e-6){
    // fallback simples
    const sx = poly.reduce((s,p)=>s+p[0],0);
    const sy = poly.reduce((s,p)=>s+p[1],0);
    return { area: 0, cx: sx/poly.length, cy: sy/poly.length };
  }
  cx /= (6*a);
  cy /= (6*a);
  return { area: Math.abs(a), cx, cy };
}

function pointInPolygon(x, y, poly){
  // Ray casting
  let inside = false;
  for(let i=0, j=poly.length-1; i<poly.length; j=i++){
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if(intersect) inside = !inside;
  }
  return inside;
}

function territoryFromZones(x, y, layer){
  // Retorna o território (raça) do primeiro polígono que contém o ponto.
  // Usado no Editor GM quando o GM deixa "Território" em auto.
  for(const z of (state.zonePolys || [])){
    if(z.layer !== layer) continue;
    if(pointInPolygon(x, y, z.poly)) return z.territory || '';
  }
  return '';
}

function buildZoneIndex(){
  state.zonePolys = [];
  if(!state.zones) return;
  // Esperado: zones[layer][territory] = [ [ [x,y],... ], [..] ]
  for(const layer of Object.keys(state.zones)){
    const terrObj = state.zones[layer] || {};
    for(const territory of Object.keys(terrObj)){
      const polys = terrObj[territory] || [];
      for(let idx=0; idx<polys.length; idx++){
        const poly = polys[idx];
        if(!Array.isArray(poly) || poly.length < 3) continue;
        const { area, cx, cy } = polygonAreaCentroid(poly);
        state.zonePolys.push({ layer, territory, idx, poly, area, cx, cy });
      }
    }
  }
}

function findZoneForPoint(layer, x, y, territoryHint=null){
  const candidates = state.zonePolys.filter(z => z.layer === layer && (!territoryHint || z.territory===territoryHint));
  for(const z of candidates){
    if(pointInPolygon(x, y, z.poly)) return z;
  }
  // fallback: tenta sem hint
  if(territoryHint){
    const any = state.zonePolys.filter(z => z.layer === layer);
    for(const z of any){
      if(pointInPolygon(x, y, z.poly)) return z;
    }
  }
  return null;
}


function applyPinOverrides(pin){
  const o = state.pinOverrides && pin && state.pinOverrides[pin.id];
  if(!o) return pin;
  return { ...pin, ...o };
}

function pinHasImage(p){
  return !!(p.images && Array.isArray(p.images) && p.images.length > 0);
}

function applyFilters(){
  const q = state.q.trim().toLowerCase();
  state.filtered = state.pins.filter(p => {
    if(p.layer !== state.layer) return false;
    if(state.type !== 'all' && p.type !== state.type) return false;
    if(state.race !== 'all'){
      if((p.territory || null) !== state.race) return false;
    }
    if(state.hideNoImage && !pinHasImage(p)) return false;
    if(q){
      const hay = `${p.name||''} ${p.type||''} ${p.group||''} ${p.territory||''} ${p.description||''}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

function clearPins(){
  els.pins.innerHTML = '';
}

function pinDotColor(p){
  if(TYPE_COLORS[p.type]) return TYPE_COLORS[p.type];
  if(p.type === 'guild_hq') return TYPE_COLORS.guild_hq;
  return TERRITORY_COLORS[p.territory] || TERRITORY_COLORS[p.group] || '#ffffff';
}

function renderPins(){
  clearPins();
  const frag = document.createDocumentFragment();
  for(const p of state.filtered){
    const el = document.createElement('div');
    el.className = `pin ${p.type}`;
    if(p.alwaysLabel) el.classList.add('always-label');
    el.style.left = `${p.x}%`;
    el.style.top = `${p.y}%`;
    el.dataset.id = p.id;

    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.backgroundColor = pinDotColor(p);
    el.appendChild(dot);

    const lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = p.name;
    el.appendChild(lab);

    el.addEventListener('mousemove', (e) => showTooltip(e, p));
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if(state.gm.unlocked && state.gm.editorOpen){
        gmSelectPin(p);
        return;
      }
      openLoc(p);
    });

    frag.appendChild(el);
  }
  els.pins.appendChild(frag);
}

function renderList(){
  els.list.innerHTML = '';
  const frag = document.createDocumentFragment();
  for(const p of state.filtered.slice(0, 500)){
    const card = document.createElement('div');
    card.className = 'card';
    const terr = p.territory ? ` • ${escapeHtml(raceLabel(p.territory))}` : '';
    card.innerHTML = `
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="meta">${escapeHtml(typeLabel(p.type))} • ${escapeHtml(layerLabel(p.layer))}${terr}</div>
    `;
    card.addEventListener('click', () => openLoc(p));
    frag.appendChild(card);
  }
  els.list.appendChild(frag);
}

function getUnzoomedStagePoint(e){
  const rect = els.mapStage.getBoundingClientRect();
  const mx = (e.clientX - rect.left);
  const my = (e.clientY - rect.top);
  const s = Math.max(0.0001, state.view.scale || 1);
  const ux = (mx - state.view.panX) / s;
  const uy = (my - state.view.panY) / s;
  return { ux, uy };
}

function showTooltip(ev, p){
  // Tooltip relativo ao viewport real do mapa (contain), desfazendo zoom/pan
  const { ux, uy } = getUnzoomedStagePoint(ev);
  const x = ux - mapViewport.x;
  const y = uy - mapViewport.y;
  const terr = p.territory ? ` • ${raceLabel(p.territory)}` : '';

  els.tooltip.classList.remove('hidden');
  els.tooltip.innerHTML = `
    <div class="box" style="left:${Math.min(Math.max(8,x+14), Math.max(8,mapViewport.w-260))}px; top:${Math.min(Math.max(8,y+14), Math.max(8,mapViewport.h-110))}px;">
      <div class="tname">${escapeHtml(p.name)}</div>
      <div class="tmeta">${escapeHtml(typeLabel(p.type))} • ${escapeHtml(layerLabel(p.layer))}${escapeHtml(terr)}</div>
    </div>
  `;
}

function hideTooltip(){
  els.tooltip.classList.add('hidden');
  els.tooltip.innerHTML = '';
}


function renderNpcSectionForLoc(p){
  const fixed = Array.isArray(p.npcsFixed) ? p.npcsFixed : [];
  const important = Array.isArray(p.npcsImportant) ? p.npcsImportant : [];
  const showImportant = !!(state && state.gm && state.gm.showImportantNpcs);

  // rolagem determinística por data do mundo + id do pin
  function dateKey(){
    const wt = (state && state.worldTime) ? state.worldTime : {day:1,month:1,year:1};
    const mm = String(wt.month).padStart(2,'0');
    const dd = String(wt.day).padStart(2,'0');
    return `${wt.year}-${mm}-${dd}`;
  }
  function pickImportant(list){
    if(!showImportant || !list.length) return [];
    const seed = hashStringToUint32(dateKey() + '|' + (p.id||'') + '|imp');
    const rnd = mulberry32(seed);
    const x = rnd();
    const n = (x < 0.08) ? 2 : (x < 0.22) ? 1 : 0; // ocasionalmente 1 ou 2
    return list.slice(0, n);
  }

  const impPick = pickImportant(important);

  const esc = (s)=>escapeHtml(String(s||''));
  const li = (n)=>`<li><b>${esc(n.name)}</b> — ${esc(n.role||'')}</li>`;
  const fixedHtml = fixed.length ? `<div class="npc-section"><div class="npc-title"><b>NPCs do Templo</b></div><ul class="npc-list">${fixed.map(li).join('')}</ul></div>` : '';
  const impHtml = impPick.length ? `<div class="npc-section"><div class="npc-title"><b>NPCs Importantes (ocasionais)</b></div><ul class="npc-list">${impPick.map(li).join('')}</ul></div>` : '';
  return fixedHtml + impHtml;
}



function renderSecretSectionForLoc(p){
  const show = !!(state && state.gm && state.gm.unlocked);
  if(!show) return '';
  const txt = p && p.secretDetails ? String(p.secretDetails) : '';
  const imp = Array.isArray(p && p.secretImportantNpcs) ? p.secretImportantNpcs : [];
  function dateKey(){
    const wt = (state && state.worldTime) ? state.worldTime : {day:1,month:1,year:1};
    const mm = String(wt.month).padStart(2,'0');
    const dd = String(wt.day).padStart(2,'0');
    return `${wt.year}-${mm}-${dd}`;
  }
  function pickImportant(list){
    if(!list.length) return [];
    const seed = hashStringToUint32(dateKey() + '|' + (p.id||'') + '|secimp');
    const rnd = mulberry32(seed);
    const x = rnd();
    const n = (x < 0.10) ? 2 : (x < 0.28) ? 1 : 0;
    return list.slice(0, n);
  }
  const impPick = pickImportant(imp);
  const esc = (s)=>escapeHtml(String(s||''));
  const li = (n)=>`<li><b>${esc(n.name)}</b> — ${esc(n.role||'')}</li>`;
  const impHtml = impPick.length ? `<div class="npc-section"><div class="npc-title"><b>NPCs Importantes (segredos)</b></div><ul class="npc-list">${impPick.map(li).join('')}</ul></div>` : '';
  const body = txt ? renderStructuredDetails(txt) : '';
  if(!impHtml && !body) return '';
  return `<div class="secret-box"><div class="secret-title">Segredos (GM)</div>${impHtml}${body}</div>`;
}


function renderStructuredDetails(txt){
  if(!txt) return '';
  const lines = String(txt).replace(/\r/g,'').split('\n');
  const sections = [];
  let current = {title:null, lines:[]};
  const push = () => {
    if(current.title !== null || current.lines.length){
      sections.push(current);
    }
    current = {title:null, lines:[]};
  };

  for(const raw of lines){
    const line = raw.trimEnd();
    const m = line.match(/^\[([A-ZÇÃÕÁÉÍÓÚÜ0-9 _-]+)\]\s*$/i);
    if(m){
      push();
      current.title = m[1].trim().toUpperCase();
      continue;
    }
    current.lines.push(line);
  }
  push();

  // Extract [DADOS] as compact key/value grid (no big block of text)
  let data = null;
  const rest = [];
  for(const s of sections){
    if(s.title === 'DADOS' && !data){
      const entries = [];
      for(const ln of s.lines){
        const t = ln.trim();
        if(!t) continue;
        const kv = t.split(':');
        if(kv.length >= 2){
          const k = kv.shift().trim();
          const v = kv.join(':').trim();
          if(k && v) entries.push([k, v]);
        }
      }
      if(entries.length) data = entries;
      continue;
    }
    rest.push(s);
  }

  const esc = escapeHtml;

  let html = '';
  if(data && data.length){
    html += `<div class="meta-grid">` + data.map(([k,v]) =>
      `<div class="meta-item"><div class="meta-k">${esc(k)}</div><div class="meta-v">${esc(v)}</div></div>`
    ).join('') + `</div>`;
  }

  for(const s of rest){
    const contentLines = s.lines.map(l => l).join('\n').trim();
    if(!contentLines) continue;

    // For RUMORES: bullets into list when possible
    if(s.title === 'RUMORES'){
      const items = contentLines.split('\n').map(x => x.trim()).filter(Boolean).map(x => x.replace(/^[•\-]\s*/,''));
      html += `<div class="subsection"><div class="subhead">${esc(s.title)}</div><ul class="bullets">` +
        items.map(it => `<li>${esc(it)}</li>`).join('') + `</ul></div>`;
      continue;
    }

    // Default: paragraphs with line breaks
    const paras = contentLines.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    html += `<div class="subsection">` + (s.title ? `<div class="subhead">${esc(s.title)}</div>` : '') +
      paras.map(p => `<div class="subtext">${esc(p).replace(/\n/g,'<br>')}</div>`).join('') +
      `</div>`;
  }

  return html;
}

function openLoc(p){
  hideTooltip();
  if(state && state.ui) state.ui.openLocId = (p && p.id) ? p.id : null;
  els.modalTitle.textContent = p.name || 'Local';
  const meta = [
    typeLabel(p.type),
    layerLabel(p.layer),
    p.territory ? raceLabel(p.territory) : null,
  ].filter(Boolean).join(' • ');
  els.modalMeta.textContent = meta;

  const desc = p.description || '';
  const more = p.details || '';

  const climateText = climateTextForPoint(p.layer, p.x, p.y, p.territory || null);
  const npcHtml = renderNpcSectionForLoc(p);
  const secretHtml = renderSecretSectionForLoc(p);

  const hasSecret = !!secretHtml;
  const secretToggleHtml = (state.gm && state.gm.unlocked && hasSecret)
    ? `<div class="gm-inline"><button type="button" class="btn btn-gm" data-gm-secret>Segredos (GM)</button></div>`
    : '';
  const secretWrapHtml = (state.gm && state.gm.unlocked && hasSecret)
    ? `<div class="gm-secret ${state.gm.showAllInfo ? '' : 'hidden'}">${secretHtml}</div>`
    : '';


  const imgHtml = (p.images && p.images.length)
    ? `<div class="media-grid">${p.images.map(u => `<img src="${escapeHtml(u)}" alt="imagem" />`).join('')}</div>`
    : '';

  const vidHtml = (p.videos && p.videos.length)
    ? `<div class="media-grid">${p.videos.map(u => `<video controls src="${escapeHtml(u)}"></video>`).join('')}</div>`
    : '';

  // City View: habilita quando houver cityId
  const hasCityView = !!p.cityId;
  const cityBtn = hasCityView
    ? `<button type="button" class="btn" data-city="${escapeHtml(p.cityId)}">Abrir cidade</button>`
    : '';

  els.modalBody.innerHTML = `
    <div class="section">
      <div class="desc">${escapeHtml(desc)}</div>
      <div class="climate"><b>Clima</b>: ${escapeHtml(climateText)}</div>
      ${npcHtml}
      ${imgHtml}
      ${vidHtml}
      ${more ? `<div class=\"details\">${renderStructuredDetails(more)}</div>` : ''}
      ${secretToggleHtml}
      ${secretWrapHtml}
    </div>
    <div class="modal-actions">
      ${cityBtn}
    </div>
  `;

  const btn = els.modalBody.querySelector('[data-city]');
  if(btn){
    btn.addEventListener('click', () => {
      openCity(btn.getAttribute('data-city'));
    });
  }

  els.locBackdrop.classList.remove('hidden');
}

function closeLoc(){
  if(state && state.ui) state.ui.openLocId = null;

  els.locBackdrop.classList.add('hidden');
}

function openDebug(x, y){
  els.debugBody.innerHTML = `
    <div class="debug-row"><b>x</b>: ${x.toFixed(2)}</div>
    <div class="debug-row"><b>y</b>: ${y.toFixed(2)}</div>
    <div class="hint" style="margin-top:10px;">Use esses valores no formato <code>x,y</code>.</div>
  `;
  els.debugBackdrop.classList.remove('hidden');
}

function closeDebug(){
  els.debugBackdrop.classList.add('hidden');
}

function closeCity(){
  state.ui.cityOpenId = null;
  state.ui.selectedPlaceId = null;
  state.ui.selectedMerchantId = null;
  els.cityBackdrop.classList.add('hidden');
}

function getPercentFromEvent(e){
  const rect = els.mapStage.getBoundingClientRect();
  // Converte clique na tela -> coordenada no palco sem zoom (desfaz pan/scale)
  const sx = ((e.clientX - rect.left) - state.view.panX) / Math.max(0.0001, state.view.scale);
  const sy = ((e.clientY - rect.top) - state.view.panY) / Math.max(0.0001, state.view.scale);

  // Coordenadas relativas ao viewport real do mapa (object-fit: contain)
  const relX = sx - mapViewport.x;
  const relY = sy - mapViewport.y;
  const x = (relX / Math.max(1, mapViewport.w)) * 100;
  const y = (relY / Math.max(1, mapViewport.h)) * 100;
  return [
    clamp(+x.toFixed(2), 0, 100),
    clamp(+y.toFixed(2), 0, 100)
  ];
}

function closeOnBackdropClick(backdropEl, closeFn){
  backdropEl.addEventListener('click', (e) => {
    if(e.target === backdropEl) closeFn();
  });
}

// -------- Editor GM --------

function setGmEditorMinimized(min){
  state.gm.editorMinimized = !!min;
  if(!els.gmEditorBackdrop) return;
  els.gmEditorBackdrop.classList.toggle('passthrough', !!min);
  if(els.minimizeGmEditor){
    els.minimizeGmEditor.textContent = min ? 'Expandir' : 'Minimizar';
  }
}

function updateGmCaptureUI(){
  if(!els.gmCaptureBtn) return;
  els.gmCaptureBtn.textContent = state.gm.captureMode ? 'Clique no mapa...' : 'Capturar no mapa';
  els.gmCaptureBtn.classList.toggle('is-capture', !!state.gm.captureMode);
}

function openGmEditor(){
  if(!state.gm.unlocked) return;
  state.gm.editorOpen = true;
  setGmEditorMinimized(false);
  state.gm.selectedPinId = null;
  if(els.gmSelectedPin) els.gmSelectedPin.textContent = 'Selecione um pin no mapa (com o Editor aberto) para configurar a cidade.';
  populateGmZoneSelect();
  updateGmCaptureUI();
  els.gmEditorBackdrop.classList.remove('hidden');
}

function closeGmEditor(){
  state.gm.captureMode = false;
  state.gm.editorOpen = false;
  state.gm.selectedPinId = null;
  setGmEditorMinimized(false);
  updateGmCaptureUI();
  els.gmEditorBackdrop.classList.add('hidden');
}

function territoryLabelShort(t){
  const m = {
    humans: 'Humanos', elves: 'Elfos', dwarves: 'Anoes', vampires: 'Vampiros', orcs: 'Orcs',
    nagas: 'Nagas', centaurs: 'Centauros', dragons: 'Dragoes', demons: 'Demonios', fae: 'Feericos',
    giants: 'Gigantes', gnomes: 'Gnomos', undead: 'Mortos-vivos', angels: 'Anjos'
  };
  return m[t] || t || '';
}

function populateGmZoneSelect(){
  if(!els.gmZoneSelect) return;
  els.gmZoneSelect.innerHTML = '';
  const zones = (state.zonePolys || []).filter(z => z.layer === 'world');
  if(!zones.length){
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Sem zonas carregadas (zones.json)';
    els.gmZoneSelect.appendChild(opt);
    return;
  }
  for(const z of zones){
    const opt = document.createElement('option');
    opt.value = JSON.stringify({ layer: z.layer, territory: z.territory, idx: z.idx });
    opt.textContent = `${territoryLabelShort(z.territory)} • Poligono #${z.idx}`;
    els.gmZoneSelect.appendChild(opt);
  }
}

function gmCreatePin(){
  const type = (els.gmPinType && els.gmPinType.value) || 'settlement';
  const layer = (els.gmPinLayer && els.gmPinLayer.value) || 'world';
  const territoryIn = (els.gmPinTerritory && els.gmPinTerritory.value) || '';
  const name = (els.gmPinName && els.gmPinName.value || '').trim();
  const x = parseFloat(els.gmPinX && els.gmPinX.value);
  const y = parseFloat(els.gmPinY && els.gmPinY.value);
  const cityIdIn = (els.gmPinCityId && els.gmPinCityId.value || '').trim();
  const alwaysLabel = !!(els.gmAlwaysLabel && els.gmAlwaysLabel.checked);

  if(!name || !Number.isFinite(x) || !Number.isFinite(y)){
    alert('Preencha Nome e coordenadas X/Y. Use "Capturar no mapa" para obter X/Y.');
    return;
  }

  const id = `gm_${Date.now()}_${Math.floor(Math.random()*10000)}`;
  const pin = {
    id,
    name,
    type,
    layer,
    territory: territoryIn || (layer==='world' ? territoryFromZones(x, y, layer) : ''),
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
    images: [],
    description: '',
    alwaysLabel: alwaysLabel
  };

  if(type === 'city_main'){
    const cityId = cityIdIn || (`city_${name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')}`);
    pin.cityId = cityId;
    // cria cidade minimalista caso ainda nao exista
    if(!state.cities[cityId] && !(state.customCities && state.customCities[cityId])){
      if(!state.customCities) state.customCities = {};
      state.customCities[cityId] = {
        id: cityId,
        name: name,
        culture: pin.territory,
        description: 'Descricao pendente (GM).',
        images: [],
        places: [
          { id: 'inn', type: 'inn', name: 'Pousada', description: '', npc: { role: 'estalajadeiro' }, merchants: [] },
          { id: 'tavern', type: 'tavern', name: 'Taberna', description: '', npc: { role: 'taberneiro' }, merchants: [] },
          { id: 'blacksmith', type: 'blacksmith', name: 'Ferreiro', description: '', npc: { role: 'ferreiro' }, merchants: [{ id:'m_blacksmith', type:'blacksmith', fixedName: 'Mestre Ferreiro' }] },
          { id: 'general', type: 'general', name: 'Materiais Diversos', description: '', npc: { role: 'comerciante' }, merchants: [{ id:'m_general', type:'general', fixedName: 'Mercador Fixo' }] },
          { id: 'alchemy', type: 'alchemy', name: 'Loja de Alquimia', description: '', npc: { role: 'alquimista' }, merchants: [{ id:'m_alchemy', type:'alchemy' }] },
        ]
      };
    }
  }

  state.customPins = Array.isArray(state.customPins) ? state.customPins : [];
  state.customPins.push(pin);

  // Atualiza em memoria e persiste
  state.pins.push(applyPinOverrides(pin));
  persistState();
  update();
  alert('Pin criado e salvo neste navegador (GM).');
}

function gmSelectPin(p){
  state.gm.selectedPinId = p.id;
  if(!els.gmSelectedPin) return;
  const terr = p.territory ? raceLabel(p.territory) : '(sem território)';
  els.gmSelectedPin.textContent = `Selecionado: ${p.name} • ${typeLabel(p.type)} • ${layerLabel(p.layer)} • ${terr}`;

  // Preenche contagens baseado no City View (se existir)
  const cityId = p.cityId || null;
  const city = cityId ? (state.cities[cityId] || state.customCities?.[cityId] || null) : null;
  const countType = (t) => city ? (city.places||[]).filter(pl=>pl.type===t).length : 0;

  if(els.gmCountTavern) els.gmCountTavern.value = String(Math.max(0, countType('tavern') || 1));
  if(els.gmCountInn) els.gmCountInn.value = String(Math.max(0, countType('inn') || 1));
  if(els.gmCountBlacksmith) els.gmCountBlacksmith.value = String(Math.max(0, countType('blacksmith') || 1));
  if(els.gmCountTailor) els.gmCountTailor.value = String(Math.max(0, countType('tailor') || 0));
  if(els.gmCountAlchemy) els.gmCountAlchemy.value = String(Math.max(0, countType('alchemy') || 1));
  if(els.gmCountGeneral) els.gmCountGeneral.value = String(Math.max(0, countType('general') || 1));

  // Mercadores por local (extra) — heurística simples
  if(els.gmMerchantsPerPlace){
    let extra = 0;
    if(city){
      const places = (city.places||[]);
      const withMerchants = places.filter(pl=>Array.isArray(pl.merchants) && pl.merchants.length);
      if(withMerchants.length){
        extra = Math.max(0, (withMerchants[0].merchants.length || 1) - 1);
      }
    }
    els.gmMerchantsPerPlace.value = String(extra);
  }
}

function gmSetSelectedPinType(toType){
  const id = state.gm.selectedPinId;
  if(!id){ alert('Selecione um pin no mapa.'); return; }
  if(!state.pinOverrides) state.pinOverrides = {};
  state.pinOverrides[id] = { ...(state.pinOverrides[id]||{}), type: toType };

  // Se virar city_main e não tiver cityId, cria automaticamente
  const p = state.pins.find(pp=>pp.id===id);
  if(p && toType==='city_main' && !p.cityId){
    const slug = `city_${(p.name||'cidade').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')}`;
    state.pinOverrides[id] = { ...(state.pinOverrides[id]||{}), cityId: slug };
  }

  state.pins = state.pins.map(pp => applyPinOverrides(pp));
  persistState();
  update();
}

function gmApplyCityConfig(){
  const id = state.gm.selectedPinId;
  if(!id){ alert('Selecione um pin no mapa.'); return; }

  const p = state.pins.find(pp=>pp.id===id);
  if(!p){ alert('Pin selecionado não encontrado.'); return; }

  // Garante que seja cidade principal
  if(p.type !== 'city_main'){
    gmSetSelectedPinType('city_main');
  }

  const effective = state.pins.find(pp=>pp.id===id);
  const cityId = effective.cityId || (`city_${(effective.name||'cidade').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')}`);
  if(!state.pinOverrides) state.pinOverrides = {};
  state.pinOverrides[id] = { ...(state.pinOverrides[id]||{}), cityId };
  effective.cityId = cityId;

  const nTav = Math.max(0, parseInt(els.gmCountTavern?.value||'0',10)||0);
  const nInn = Math.max(0, parseInt(els.gmCountInn?.value||'0',10)||0);
  const nBla = Math.max(0, parseInt(els.gmCountBlacksmith?.value||'0',10)||0);
  const nTai = Math.max(0, parseInt(els.gmCountTailor?.value||'0',10)||0);
  const nAlc = Math.max(0, parseInt(els.gmCountAlchemy?.value||'0',10)||0);
  const nGen = Math.max(0, parseInt(els.gmCountGeneral?.value||'0',10)||0);
  const extraMerchants = Math.max(0, parseInt(els.gmMerchantsPerPlace?.value||'0',10)||0);

  const culture = effective.territory || 'default';

  const mkMerchants = (baseId, kind, fixedName=null) => {
    const arr = [];
    // 1 mercador fixo por cidade: prioriza o primeiro "general"
    if(fixedName) arr.push({ id:`${baseId}_fixed`, type: kind, fixedName });
    for(let i=0;i<extraMerchants;i++) arr.push({ id:`${baseId}_m${i+1}`, type: kind });
    return arr;
  };

  const places = [];
  for(let i=0;i<nInn;i++) places.push({ id:`inn_${i+1}`, type:'inn', name:`Pousada ${i+1}`, description:'', npc:{ role:'estalajadeiro' }, merchants: [] });
  for(let i=0;i<nTav;i++) places.push({ id:`tavern_${i+1}`, type:'tavern', name:`Taberna ${i+1}`, description:'', npc:{ role:'taberneiro' }, merchants: [] });
  for(let i=0;i<nBla;i++) places.push({ id:`blacksmith_${i+1}`, type:'blacksmith', name:`Ferreiro ${i+1}`, description:'', npc:{ role:'ferreiro' }, merchants: mkMerchants(`blacksmith_${i+1}`,'blacksmith', i===0 ? 'Mestre Ferreiro' : null) });
  for(let i=0;i<nTai;i++) places.push({ id:`tailor_${i+1}`, type:'tailor', name:`Alfaiataria ${i+1}`, description:'', npc:{ role:'alfaiate' }, merchants: mkMerchants(`tailor_${i+1}`,'tailor', i===0 ? 'Alfaiate Fixo' : null) });
  for(let i=0;i<nAlc;i++) places.push({ id:`alchemy_${i+1}`, type:'alchemy', name:`Loja de Alquimia ${i+1}`, description:'', npc:{ role:'alquimista' }, merchants: mkMerchants(`alchemy_${i+1}`,'alchemy', i===0 ? 'Alquimista Fixo' : null) });
  for(let i=0;i<nGen;i++) places.push({ id:`general_${i+1}`, type:'general', name:`Materiais Diversos ${i+1}`, description:'', npc:{ role:'comerciante' }, merchants: mkMerchants(`general_${i+1}`,'general', i===0 ? 'Mercador Fixo' : null) });

  if(!state.customCities) state.customCities = {};
  const existing = state.cities[cityId] || state.customCities[cityId] || null;

  state.customCities[cityId] = {
    id: cityId,
    name: existing?.name || effective.name,
    culture: existing?.culture || culture,
    description: existing?.description || 'Descrição pendente (GM).',
    images: existing?.images || [],
    places,
  };

  // Reaplica overrides e persiste
  state.pins = state.pins.map(pp => applyPinOverrides(pp));
  persistState();
  update();
  alert('Configuração aplicada e salva no navegador (GM). Use Exportar JSON para me enviar.');
}

function gmApplyZoneConversion(direction){
  // direction: 'promote' (settlement->city_main) ou 'demote' (city_main->settlement)
  const raw = els.gmZoneSelect ? els.gmZoneSelect.value : '';
  if(!raw){
    alert('Selecione uma zona.');
    return;
  }
  let zsel;
  try{ zsel = JSON.parse(raw); }catch{ zsel = null; }
  if(!zsel) return;
  const zone = (state.zonePolys || []).find(z => z.layer===zsel.layer && z.territory===zsel.territory && z.idx===zsel.idx);
  if(!zone){
    alert('Zona nao encontrada.');
    return;
  }

  const fromType = direction==='promote' ? 'settlement' : 'city_main';
  const toType = direction==='promote' ? 'city_main' : 'settlement';

  const maxCount = Math.max(0, parseInt((els.gmCountInput && els.gmCountInput.value) || '0', 10) || 0);
  let changed = 0;

  if(!state.pinOverrides) state.pinOverrides = {};

  for(const p of state.pins){
    if(p.layer !== zone.layer) continue;
    const effectiveType = (state.pinOverrides[p.id] && state.pinOverrides[p.id].type) ? state.pinOverrides[p.id].type : p.type;
    if(effectiveType !== fromType) continue;
    if(!pointInPolygon(p.x, p.y, zone.poly)) continue;

    state.pinOverrides[p.id] = { ...(state.pinOverrides[p.id]||{}), type: toType };
    changed += 1;
    if(maxCount > 0 && changed >= maxCount) break;
  }

  // Reaplica overrides em memoria
  state.pins = state.pins.map(pp => applyPinOverrides(pp));
  persistState();
  update();
  alert(`Conversao aplicada: ${changed} pins.`);
}

function gmExportData(){
  const payload = {
    worldTime: state.worldTime,
    customPins: state.customPins || [],
    customCities: state.customCities || {},
    pinOverrides: state.pinOverrides || {},
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eldralore_gm_export.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// -------- Item bank (~3200 itens) --------

function generateItemsBank(){
  const weapons = ['Espada', 'Machado', 'Lança', 'Adaga', 'Arco', 'Besta', 'Marreta', 'Cimitarra', 'Cajado', 'Chicote'];
  const weaponMods = ['do Crepúsculo', 'da Aurora', 'das Cinzas', 'da Serpente', 'do Trovão', 'do Caçador', 'da Lua', 'do Abismo', 'do Carvalho', 'das Sombras'];
  const armors = ['Cota de Malha', 'Peitoral', 'Elmo', 'Grevas', 'Manoplas', 'Escudo', 'Armadura de Couro', 'Manto Reforçado'];
  const armorMods = ['Rúnico', 'da Legião', 'do Guardião', 'do Exílio', 'do Dragão', 'de Umbra', 'de Kharak', 'de Elarion'];

  const accessories = ['Anel', 'Amuleto', 'Bracelete', 'Colar', 'Cinto', 'Broche', 'Pingente', 'Coroa', 'Tiara', 'Talisman'];
  const accMods = ['de Proteção', 'da Vigor', 'da Agilidade', 'da Mente', 'do Foco', 'da Sorte', 'da Maré', 'do Fogo', 'do Gelo', 'do Vento'];

  const potions = ['Poção de Cura', 'Poção de Mana', 'Poção de Resistência', 'Poção de Invisibilidade', 'Poção de Antídoto', 'Poção de Força', 'Poção de Reflexos'];
  const scrolls = ['Pergaminho de Chama', 'Pergaminho de Gelo', 'Pergaminho de Barreira', 'Pergaminho de Luz', 'Pergaminho de Sombra', 'Pergaminho de Teleporte'];
  const tools = ['Kit de Ferramentas', 'Corda', 'Giz Rúnico', 'Lanterna', 'Pederneira', 'Arpéu', 'Bolsa de Componentes', 'Mapa Rasgado'];
  const oddities = ['Frasco com Névoa', 'Moeda Antiga', 'Dente de Besta', 'Pedaço de Meteorito', 'Selo Desconhecido', 'Chave Sem Fechadura', 'Pena Negra', 'Fragmento de Obsidiana'];

  const items = [];
  let id = 1;

  // 200 combate: 100 armas + 100 armaduras
  for(let i=0;i<100;i++){
    const base = weapons[i % weapons.length];
    const mod = weaponMods[Math.floor(i / weapons.length) % weaponMods.length];
    items.push({ id: `it_${id++}`, category: 'combat', baseName: `${base} ${mod}`, kind: 'weapon' });
  }
  for(let i=0;i<100;i++){
    const base = armors[i % armors.length];
    const mod = armorMods[Math.floor(i / armors.length) % armorMods.length];
    items.push({ id: `it_${id++}`, category: 'combat', baseName: `${base} ${mod}`, kind: 'armor' });
  }

  // 100 acessórios
  for(let i=0;i<100;i++){
    const base = accessories[i % accessories.length];
    const mod = accMods[Math.floor(i / accessories.length) % accMods.length];
    items.push({ id: `it_${id++}`, category: 'accessory', baseName: `${base} ${mod}`, kind: 'accessory' });
  }

  // 700 misc
  for(let i=0;i<300;i++){
    const base = potions[i % potions.length];
    items.push({ id: `it_${id++}`, category: 'consumable', baseName: base, kind: 'potion' });
  }
  for(let i=0;i<200;i++){
    const base = scrolls[i % scrolls.length];
    items.push({ id: `it_${id++}`, category: 'consumable', baseName: base, kind: 'scroll' });
  }
  for(let i=0;i<120;i++){
    const base = tools[i % tools.length];
    items.push({ id: `it_${id++}`, category: 'utility', baseName: base, kind: 'tool' });
  }
  for(let i=0;i<80;i++){
    const base = oddities[i % oddities.length];
    items.push({ id: `it_${id++}`, category: 'odd', baseName: base, kind: 'oddity' });
  }

  // Expansao: gera ate ~3200 itens (leve) combinando material e qualidade.
  const mats = ['Ferro','Aco','Aco Refinado','Mithril','Adamantina','Obsidiana','Couro Curtido'];
  const quals = ['Comum','Alta Qualidade','Obra-prima'];
  const weaponBase = ['Espada','Machado','Lanca','Adaga','Arco','Besta','Marreta','Cimitarra','Cajado','Chicote'];
  const armorBase = ['Elmo','Peitoral','Grevas','Manoplas','Escudo','Cota de Malha','Armadura Completa'];

  while(items.length < 3200){
    const i = items.length;
    const mat = mats[i % mats.length];
    const q = quals[Math.floor(i / mats.length) % quals.length];
    if(i % 3 == 0){
      const b = weaponBase[i % weaponBase.length];
      items.push({ id: `it_${id++}`, category: 'combat', baseName: `${b} de ${mat} (${q})`, kind: 'weapon' });
    }else if(i % 3 == 1){
      const b = armorBase[i % armorBase.length];
      items.push({ id: `it_${id++}`, category: 'combat', baseName: `${b} de ${mat} (${q})`, kind: 'armor' });
    }else{
      items.push({ id: `it_${id++}`, category: 'utility', baseName: `Suprimento #${id} (${q})`, kind: 'tool' });
    }
  }

  return items.slice(0, 3200);
}

function rarityRoll(rng){
  // chances:
  // raro: 5% (0.05)
  // muito raro: 0.5% (0.005)
  // artefato não identificado: 0.0001% (0.000001)
  const r = rng();
  if(r < 0.000001) return 'artifact';
  if(r < 0.005) return 'very_rare';
  if(r < 0.05) return 'rare';
  return 'common';
}

function plusSuffix(plus, mode){
  if(mode === 'rare'){
    if(plus === 5) return '+05';
    return `+${plus}`;
  }
  return `+${plus}`;
}

function basePriceFromName(kind, name){
  const n = String(name||'').toLowerCase();
  let base = 60;
  if(kind === 'weapon'){
    if(n.includes('adaga')) base = 50;
    else if(n.includes('arco')) base = 100;
    else if(n.includes('besta')) base = 180;
    else if(n.includes('cajado')) base = 80;
    else if(n.includes('chicote')) base = 70;
    else if(n.includes('lanca')) base = 120;
    else if(n.includes('espada')) base = 150;
    else if(n.includes('machado')) base = 160;
    else if(n.includes('cimitarra')) base = 160;
    else if(n.includes('marreta')) base = 220;
    else base = 120;
  }
  if(kind === 'armor'){
    if(n.includes('armadura completa')) base = 4500;
    else if(n.includes('cota de malha')) base = 900;
    else if(n.includes('peitoral')) base = 600;
    else if(n.includes('grevas')) base = 220;
    else if(n.includes('manoplas')) base = 180;
    else if(n.includes('elmo')) base = 120;
    else if(n.includes('escudo')) base = 150;
    else base = 400;
  }
  if(kind === 'accessory') base = 120;
  if(kind === 'potion') base = 25;
  if(kind === 'scroll') base = 60;
  if(kind === 'tool') base = 20;
  if(kind === 'oddity') base = 80;

  let mult = 1.0;
  if(n.includes('aco refinado')) mult *= 1.6;
  else if(n.includes('aco')) mult *= 1.25;
  if(n.includes('mithril')) mult *= 2.8;
  if(n.includes('adamantina')) mult *= 3.4;
  if(n.includes('obsidiana')) mult *= 1.8;
  if(n.includes('couro')) mult *= 0.95;

  if(n.includes('obra-prima')) mult *= 1.55;
  else if(n.includes('alta qualidade')) mult *= 1.25;

  return Math.round(base * mult);
}

function priceFor(rarity, plus, baseKind, baseName){
  const base = basePriceFromName(baseKind, baseName);
  if(rarity === 'common'){
    // pequenos ajustes por +1 comum
    return Math.max(1, Math.round(base + plus * Math.max(5, base*0.08)));
  }
  if(rarity === 'rare'){
    const minBase = 1000;
    const scaled = Math.round(Math.max(minBase, base * 3.0) * (1 + plus * 0.25));
    return scaled;
  }
  if(rarity === 'very_rare'){
    const minBase = 5000;
    const scaled = Math.round(Math.max(minBase, base * 6.0) * (1 + plus * 0.35));
    return scaled;
  }
  // artifact
  return 100000 + Math.round(plus * 25000);
}

function qtyFor(rarity, kind, rng){
  if(rarity === 'artifact') return 1;
  if(kind === 'weapon' || kind === 'armor' || kind === 'accessory'){
    return rarity === 'common' ? (1 + Math.floor(rng()*3)) : 1;
  }
  // consumables
  if(kind === 'potion' || kind === 'scroll'){
    return rarity === 'common' ? (2 + Math.floor(rng()*10)) : (1 + Math.floor(rng()*3));
  }
  return 1 + Math.floor(rng()*8);
}

function pickFrom(arr, rng){
  return arr[Math.floor(rng()*arr.length)];
}

function merchantCategoryFilter(merchantType){
  // mapeia o que cada comerciante pode vender
  if(merchantType === 'blacksmith') return new Set(['combat']);
  if(merchantType === 'tailor') return new Set(['combat','accessory']);
  if(merchantType === 'alchemy') return new Set(['consumable']);
  if(merchantType === 'general') return new Set(['utility','consumable','odd','accessory']);
  if(merchantType === 'curiosities') return new Set(['odd','utility','accessory']);
  // fallback
  return new Set(['combat','accessory','consumable','utility','odd']);
}

function inventoryKey(cityId, placeId, merchantId){
  // Inclui placeId para evitar colisão de inventários entre locais diferentes
  // (ex.: m1 de uma alquimia vs m1 de um ferreiro no mesmo dia).
  return `${cityId}|${placeId}|${merchantId}|${state.worldTime.year}-${state.worldTime.month}-${state.worldTime.day}`;
}

function generateInventory({ cityId, placeId, merchantId, merchantType }){
  const key = inventoryKey(cityId, placeId, merchantId);
  if(state.merchantState && Array.isArray(state.merchantState[key])){
    return state.merchantState[key];
  }

  const seed = hashStringToUint32(`inv|${key}`);
  const rng = mulberry32(seed);

  const allowed = merchantCategoryFilter(merchantType);
  const pool = state.items.filter(it => allowed.has(it.category));

  const inv = [];
  const used = new Set();

  for(let i=0;i<20;i++){
    const rarity = rarityRoll(rng);

    let item;
    if(rarity === 'artifact'){
      item = { id: `art_${seed}_${i}`, category: 'odd', baseName: 'Artefato nao identificado', kind: 'oddity' };
    }else{
      let tries = 0;
      do{
        item = pickFrom(pool, rng);
        tries++;
      }while(used.has(item.id) && tries < 30);
      used.add(item.id);
    }

    let plus = 0;
    let name = item.baseName;

    if(rarity === 'rare'){
      plus = 1 + Math.floor(rng()*5);
      name = `${name} ${plusSuffix(plus,'rare')}`;
    }else if(rarity === 'very_rare'){
      plus = 1 + Math.floor(rng()*10);
      name = `${name} ${plusSuffix(plus,'very_rare')}`;
    }else if(rarity === 'artifact'){
      plus = 1 + Math.floor(rng()*10);
      name = `${name} (Selo ${String(plus).padStart(2,'0')}-${(seed%999).toString().padStart(3,'0')})`;
    }else{
      plus = rng() < 0.15 ? 1 : 0;
    }

    const price = priceFor(rarity, plus, item.kind, item.baseName);
    const qty = qtyFor(rarity, item.kind, rng);

    inv.push({
      rowId: `${seed}_${i}`,
      name,
      rarity,
      price,
      qty,
      baseCategory: item.category,
      kind: item.kind,
    });
  }

  if(!state.merchantState) state.merchantState = {};
  state.merchantState[key] = inv;
  persistState();
  return inv;
}

function rarityBadge(r){
  if(r === 'rare') return '<span class="badge rare">Raro</span>';
  if(r === 'very_rare') return '<span class="badge vrare">Muito raro</span>';
  if(r === 'artifact') return '<span class="badge art">Artefato</span>';
  return '<span class="badge">Comum</span>';
}

// -------- City View --------

function placeTypeLabel(t){
  const map = {
    inn: 'Pousada',
    tavern: 'Taberna',
    blacksmith: 'Ferreiro',
    tailor: 'Alfaiataria',
    alchemy: 'Alquimia',
    general: 'Materiais Diversos',
    curiosities: 'Curiosidades',
    temple: 'Templo',
    docks: 'Docas',
    gate: 'Portões',
    archive: 'Arquivo',
    district: 'Distrito',
    street: 'Avenida/Rua',
  };
  return map[t] || t;
}

function generateNpcName(seedStr, culture){
  const seed = hashStringToUint32(seedStr + '|' + culture);
  const rng = mulberry32(seed);
  const first = {
    humans: ['Edric','Arabelle','Roland','Mira','Cassian','Helena','Darius','Sable'],
    elves: ['Aelindra','Thalendil','Sylvar','Lythienne','Eira','Nimriel','Faelar','Aestrin'],
    dwarves: ['Thrain','Borin','Garin','Hilda','Ragna','Durik','Korga','Bruni'],
    vampires: ['Noctis','Selene','Vesper','Lilith','Vladin','Morana','Sorin','Nyx'],
    orcs: ['Kragnar','Urzok','Gorim','Sharka','Morg','Rakka','Thok','Varg'],
    undead: ['Mordacai','Nythra','Tenebris','Mortella','Sablebone','Grimwell','Ebon','Carrion'],
    default: ['Aren','Vale','Kira','Orin','Seth','Lina','Bran','Yara']
  };
  const last = {
    humans: ['Valenwood','Wyvernclaw','Ainsworth','Storme','Blackwell','Ravenhart'],
    elves: ['Lunavestra','Verdefolha','Silkwhisper','Dawnbringer','Moonsong','Leafglade'],
    dwarves: ['Ironfist','Aço-Fumegante','Machado-Trovão','Pedra-Forte','Barba-de-Ferro'],
    vampires: ['Nocturna','Sanguefrio','Véu-Negro','Sombraluz','Dente-de-Ébano'],
    orcs: ['Punho-Bruto','Dente-Cortante','Garra-Seca','Sangue-Quente','Lâmina-Quebrada'],
    undead: ['o Eterno','da Cripta','da Névoa','das Ruínas','do Túmulo'],
    default: ['do Vale','da Torre','do Rio','da Forja','da Estrada']
  };
  const c = first[culture] ? culture : 'default';
  return `${pickFrom(first[c], rng)} ${pickFrom(last[c], rng)}`;
}

function renderCityHero(city){
  // Importante (UX): não despejar toda a galeria logo no topo.
  // A galeria completa (distritos/locais) deve aparecer ao clicar no sublocal.
  const imgsAll = Array.isArray(city.images) ? city.images.filter(Boolean) : [];
  const imgs = imgsAll.slice(0, 2);

  if(!imgs.length){
    els.cityHero.innerHTML = `<div class="city-hero-body"><div class="muted">Sem imagens de destaque.</div></div>`;
    return;
  }

  const grid = imgs.map(u => `<img src="${escapeHtml(u)}" alt="imagem da cidade" loading="lazy" />`).join('');
  els.cityHero.innerHTML = `
    <div class="city-gallery">${grid}</div>
    <div class="city-hero-body"><div class="muted">Destaques — clique em um sublocal para ver imagens específicas.</div></div>
  `;
}
function rollImportantNpc(seedKey){
  // chance 1% de presença
  const seed = hashStringToUint32('important|' + seedKey);
  const rng = mulberry32(seed);
  const present = rng() < 0.01;
  if(!present) return null;

  const malicious = rng() < 0.5;
  const benignPool = [
    { title:'Emissário', name:'Emissário do Conselho' },
    { title:'Cavaleiro', name:'Cavaleiro do Juramento' },
    { title:'Sábio', name:'Sábio Errante' },
    { title:'Arquimaga', name:'Arquimaga Visitante' },
    { title:'Mercador de Raridades', name:'Mercador de Raridades' },
  ];
  const malignPool = [
    { title:'Assassino', name:'Agente das Sombras' },
    { title:'Cultista', name:'Cultista Velado' },
    { title:'Inquisidor', name:'Inquisidor Corrompido' },
    { title:'Necromante', name:'Necromante Disfarçado' },
    { title:'Contrabandista', name:'Contrabandista de Relíquias' },
  ];

  const pool = malicious ? malignPool : benignPool;
  const pick = pool[Math.floor(rng() * pool.length)];
  return {
    alignment: malicious ? 'Maligno' : 'Benigno',
    title: pick.title,
    name: pick.name,
  };
}

function cityImportantNpcs(city){
  if(!state.gm.showImportantNpcs) return [];
  const dayKey = `${state.worldTime.year}-${state.worldTime.month}-${state.worldTime.day}`;
  const out = [];
  for(const place of (city.places || [])){
    // Por padrão, NPCs especiais devem aparecer apenas em locais marcados
    // (ex.: tavernas/pousadas/mercados), para evitar ruído em oficinas/lojas.
    if(place && place.allowImportantNpcs !== true) continue;
    const r = rollImportantNpc(`${city.id||''}|${city.name}|${place.id}|${dayKey}`);
    if(r) out.push({ placeName: place.name, ...r });
  }
  return out;
}

function openCity(cityId){
  closeLoc();

  const city = state.cities[cityId];
  if(!city){
    els.cityTitle.textContent = 'Cidade';
    els.cityMeta.textContent = 'Dados da cidade não encontrados (data/cities.json).';
    els.cityDesc.textContent = 'Crie a entrada desta cidade em data/cities.json para ativar City View.';
    els.cityPlaces.innerHTML = '';
    els.placePanel.textContent = '—';
    els.merchantPanel.textContent = '—';
    els.cityBackdrop.classList.remove('hidden');
    return;
  }

  state.ui.cityOpenId = cityId;
  state.ui.selectedPlaceId = null;
  state.ui.selectedMerchantId = null;

  els.cityTitle.textContent = city.name;
  const cityPin = state.pins.find(p => p.cityId === cityId) || null;
  const cityClimate = cityPin ? climateTextForPoint(cityPin.layer, cityPin.x, cityPin.y, cityPin.territory || null) : '';
  const season = seasonFromMonth(state.worldTime.month);
  els.cityMeta.textContent = `${city.tagline || ''} • Dia ${state.worldTime.day}, Mês ${state.worldTime.month}, Ano ${state.worldTime.year} • ${season}`.replace(/^\s*•\s*/,'');
  renderCityHero(city);

  const imp = cityImportantNpcs(city);
  const impHtml = imp.length ? `
    <div class="imp-section">
      <div class="imp-title">NPCs importantes (hoje) — visível somente em Modo GM</div>
      <div class="imp-list">${imp.map(i => `
        <div class="imp-item ${i.alignment==='Maligno'?'imp-evil':'imp-good'}">
          <div><b>${escapeHtml(i.name)}</b> <span class="badge">${escapeHtml(i.title)}</span> <span class="badge">${escapeHtml(i.alignment)}</span></div>
          <div class="muted">Local: ${escapeHtml(i.placeName)}</div>
        </div>`).join('')}
      </div>
    </div>` : '';

  els.cityDesc.innerHTML = `
    <div class="city-desc-text">${escapeHtml(city.description || '')}</div>
    ${cityClimate ? `<div class="climate"><b>Clima</b>: ${escapeHtml(cityClimate)}</div>` : ''}
    ${impHtml}
    ${city.mapImage ? `<div class="city-map-actions"><button type="button" class="btn" id="btnCityMap">Ver planta da cidade</button></div>` : ""}
  `;

  const mapBtn = document.getElementById("btnCityMap");
  if(mapBtn && city.mapImage){
    mapBtn.addEventListener("click", () => {
      els.modalTitle.textContent = `Planta de ${city.name}`;
      els.modalMeta.textContent = "Planta baixa (visão planificada)";
      els.modalBody.innerHTML = `<div class=\"section\"><div class=\"media-grid\"><img src=\"${escapeHtml(city.mapImage)}\" alt=\"planta baixa\" loading=\"lazy\" /></div></div>`;
      els.locBackdrop.classList.remove("hidden");
    });
  }


  renderCityPlaces(city);
  els.placePanel.textContent = 'Selecione um sublocal para ver detalhes e comerciantes.';
  els.merchantPanel.textContent = 'Selecione um comerciante.';

  els.cityBackdrop.classList.remove('hidden');
}

function renderCityPlaces(city){
  els.cityPlaces.innerHTML = '';
  const frag = document.createDocumentFragment();

  for(const place of (city.places || [])){
    const card = document.createElement('div');
    card.className = 'place-card';
    card.innerHTML = `
      <div class="place-name">${escapeHtml(place.name)}</div>
      <div class="place-meta">${escapeHtml(placeTypeLabel(place.type))}</div>
    `;
    card.addEventListener('click', () => {
      state.ui.selectedPlaceId = place.id;
      state.ui.selectedMerchantId = null;
      renderPlacePanel(city, place);
      els.merchantPanel.textContent = 'Selecione um comerciante.';
    });
    frag.appendChild(card);
  }

  els.cityPlaces.appendChild(frag);
}

function renderPlacePanel(city, place){
  const culture = city.culture || 'default';

  let npcName = '';
  if(place.npc && place.npc.name){
    npcName = place.npc.name;
  }else{
    npcName = generateNpcName(`${city.id || city.name}|${place.id}`, culture);
  }

  const npcLine = place.npc
    ? `<div><b>NPC</b>: ${escapeHtml(npcName)} <span class="badge">${escapeHtml(place.npc.role || 'responsável')}</span></div>`
    : '';

  // Comerciantes:
  // - Se place.merchants existir, usa a lista.
  // - Caso contrário, se existir rng_merchants, gera uma lista determinística (1..10) por dia/calendário.
  let baseMerchants = Array.isArray(place.merchants) ? place.merchants : [];
  if(!baseMerchants.length && place.rng_merchants && typeof place.rng_merchants.min === 'number' && typeof place.rng_merchants.max === 'number'){
    const dayKey = `${state.worldTime.year}-${state.worldTime.month}-${state.worldTime.day}`;
    const seed = hashStringToUint32(`rng_merchants|${city.id||city.name}|${place.id}|${dayKey}`);
    const rng = mulberry32(seed);
    const min = Math.max(0, Math.floor(place.rng_merchants.min));
    const max = Math.max(min, Math.floor(place.rng_merchants.max));
    const count = min + Math.floor(rng() * (max - min + 1));
    baseMerchants = Array.from({length: count}, (_, i) => ({
      id: `m${i+1}`,
      type: place.type || 'general'
    }));
  }

  const merchants = baseMerchants.map(m => {
    const name = m.fixedName || generateNpcName(`${city.name}|${place.id}|${m.id}`, culture);
    return { ...m, displayName: name };
  });

  const merchantHtml = merchants.length ? `
    <div class="merchant-list">
      ${merchants.map(m => `
        <div class="merchant" data-merchant="${escapeHtml(m.id)}">
          <div>
            <div class="m-name">${escapeHtml(m.displayName)}</div>
            <div class="m-type">${escapeHtml(placeTypeLabel(m.type || place.type))}</div>
          </div>
          <div class="badge">Abrir</div>
        </div>
      `).join('')}
    </div>
  ` : `<div class="hint">Não há comerciantes neste local.</div>`;

  const placeImgs = Array.isArray(place.images) ? place.images.filter(Boolean) : [];
  const placeGallery = placeImgs.length ? `
    <div class="section" style="margin-top:10px;">
      <div class="muted">Imagens do local</div>
      <div class="media-grid">${placeImgs.map(u => `<img src="${escapeHtml(u)}" alt="imagem do local" loading="lazy" />`).join('')}</div>
    </div>
  ` : '';

  els.placePanel.innerHTML = `
    <div><b>Local</b>: ${escapeHtml(place.name)} <span class="badge">${escapeHtml(placeTypeLabel(place.type))}</span></div>
    ${npcLine}
    ${place.description ? `<div style="margin-top:8px;">${escapeHtml(place.description)}</div>` : ''}
    ${placeGallery}
    <div style="margin-top:10px;"><b>Comerciantes</b></div>
    ${merchantHtml}
  `;

  // bind merchants
  const nodes = els.placePanel.querySelectorAll('[data-merchant]');
  for(const node of nodes){
    node.addEventListener('click', () => {
      const merchantId = node.getAttribute('data-merchant');
      const merchant = merchants.find(x => x.id === merchantId);
      if(!merchant) return;
      state.ui.selectedMerchantId = merchantId;
      renderMerchantPanel(city, place, merchant);
    });
  }
}

function renderMerchantPanel(city, place, merchant){
  const inv = generateInventory({
    cityId: state.ui.cityOpenId,
    placeId: place.id,
    merchantId: merchant.id,
    merchantType: merchant.type || place.type || 'general',
  });

  els.merchantPanel.innerHTML = `
    <div><b>Mercador</b>: ${escapeHtml(merchant.displayName)} <span class="badge">${escapeHtml(placeTypeLabel(merchant.type || place.type || 'general'))}</span></div>
    <div style="margin-top:6px;color:rgba(255,255,255,.75)">O estoque muda automaticamente com o calendário (Dia ${state.worldTime.day}, Mês ${state.worldTime.month}).</div>
    <table class="inv">
      <thead>
        <tr>
          <th>Item</th>
          <th>Raridade</th>
          <th>Qtd</th>
          <th>Preço (PO)</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${inv.map(row => `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${rarityBadge(row.rarity)}</td>
            <td>${escapeHtml(String(row.qty))}</td>
            <td>${escapeHtml(String(row.price))}</td>
            <td>${row.qty > 0 ? `<button type="button" class="btn btn-xs buy" data-buy="${escapeHtml(row.rowId)}">Comprar</button>` : `<span class="muted">—</span>`}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // bind buy buttons
  const btns = els.merchantPanel.querySelectorAll('[data-buy]');
  for(const b of btns){
    b.addEventListener('click', () => {
      const rowId = b.getAttribute('data-buy');
      const key = inventoryKey(state.ui.cityOpenId, place.id, merchant.id);
      const list = state.merchantState[key];
      if(!Array.isArray(list)) return;
      const row = list.find(x => String(x.rowId) === String(rowId));
      if(!row || row.qty <= 0) return;
      row.qty -= 1;
      persistState();
      renderMerchantPanel(city, place, merchant);
    });
  }
}

// -------- Clima overlay (canvas) --------

function resizeClimateCanvas(){
  const canvas = els.climateCanvas;
  const rect = els.mapStage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
}

function biomeFromTempMoist(temp, moist){
  // temp/moist em 0..1
  if(temp < 0.22) return 'Tundra/Neve';
  if(temp < 0.32 && moist < 0.35) return 'Montanhas Frias';
  if(temp < 0.62 && moist >= 0.45) return 'Floresta Temperada';
  if(temp < 0.68 && moist >= 0.28) return 'Planícies';
  if(moist < 0.22) return 'Deserto';
  if(temp > 0.72 && moist > 0.55) return 'Selva';
  if(temp > 0.72) return 'Savana';
  return 'Temperado';
}

function biomeColor(biome){
  const m = {
    'Tundra/Neve': 'rgba(120,170,220,0.45)',
    'Montanhas Frias': 'rgba(140,160,180,0.40)',
    'Floresta Temperada': 'rgba(80,190,140,0.42)',
    'Planícies': 'rgba(170,210,120,0.38)',
    'Deserto': 'rgba(230,200,120,0.42)',
    'Selva': 'rgba(60,200,110,0.45)',
    'Savana': 'rgba(220,170,90,0.40)',
    'Temperado': 'rgba(120,200,150,0.35)',
  };
  return m[biome] || 'rgba(255,255,255,0.18)';
}

function climateForZone(zone){
  // Zone pode ser null (fallback por latitude do ponto)
  const season = seasonFromMonth(state.worldTime.month);
  const seasonTemp = (season === 'Verão') ? 0.12 : (season === 'Inverno') ? -0.12 : 0.0;

  const cy = (zone && Number.isFinite(zone.cy)) ? zone.cy : 58; // equador "mágico" ~58%
  const lat = clamp(cy / 100, 0, 1);

  // Temperatura base por latitude (pico em ~0.58)
  let temp01 = 1 - Math.abs(lat - 0.58) * 1.9;
  temp01 = clamp(temp01 + seasonTemp, 0, 1);

  // Umidade determinística por zona + dia
  const tag = zone ? `${zone.territory}|${zone.idx}` : 'global';
  const seed = hashStringToUint32(`climate|${tag}|${state.worldTime.year}|${state.worldTime.month}|${state.worldTime.day}`);
  const rng = mulberry32(seed);
  // base 0..1 com leve variância diária
  let moist01 = clamp(0.35 + rng()*0.65, 0, 1);

  // Ajuste por bioma (evita tudo virar selva no verão)
  if(temp01 > 0.70) moist01 = clamp(moist01 - 0.08, 0, 1);
  if(temp01 < 0.28) moist01 = clamp(moist01 - 0.10, 0, 1);

  const biome = biomeFromTempMoist(temp01, moist01);

  // Converter para ficha textual (valores aproximados, RPG-friendly)
  // tempC: -10..38
  const tempC = Math.round(-10 + temp01 * 48);

  let precip;
  if(moist01 < 0.22) precip = 'sem chuva';
  else if(moist01 < 0.40) precip = 'chuva fraca';
  else if(moist01 < 0.62) precip = 'chuva moderada';
  else precip = 'chuva forte';

  // vento por ruído leve
  const w = rng();
  const wind = (w < 0.33) ? 'fracos' : (w < 0.72) ? 'moderados' : 'fortes';

  const humidity = (moist01 < 0.25) ? 'baixa' : (moist01 < 0.55) ? 'média' : 'alta';

  // descrição curta
  const short = `Bioma: ${biome} • Temperatura: ${tempC}°C • Umidade: ${humidity} • Precipitação: ${precip} • Ventos: ${wind}`;

  // detalhes (um pouco mais narrativo, mas ainda objetivo)
  const notes = [];
  if(biome === 'Deserto') notes.push('calor seco e visibilidade alta');
  if(biome === 'Selva') notes.push('calor úmido, insetos e trilhas fechadas');
  if(biome === 'Tundra/Neve') notes.push('frio extremo e risco de congelamento');
  if(biome === 'Montanhas Frias') notes.push('ar rarefeito e rajadas nas cristas');
  if(biome === 'Floresta Temperada') notes.push('neblina leve ao amanhecer');
  if(biome === 'Planícies') notes.push('ventos constantes e variação brusca à noite');

  return {
    biome,
    temp01,
    moist01,
    tempC,
    humidity,
    precip,
    wind,
    short,
    notes: notes.join(' • '),
    color: biomeColor(biome),
  };
}

function climateTextForPoint(layer, x, y, territoryHint=null){
  if(layer !== 'world'){
    return 'Ambiente subterrâneo: temperatura estável, ar úmido e pouca circulação de vento.';
  }
  const z = findZoneForPoint('world', x, y, territoryHint);
  const c = climateForZone(z);
  return c.notes ? `${c.short} • ${c.notes}` : c.short;
}

function drawClimateOverlay(){
  const canvas = els.climateCanvas;
  if(!canvas) return;

  // Overlay só faz sentido na superfície (polígonos raciais)
  if(!state.climateOn || state.layer !== 'world' || !state.zonePolys || state.zonePolys.length===0){
    canvas.style.display = 'none';
    return;
  }

  canvas.style.display = 'block';
  // Render no viewport real do mapa (evita distorção/offset quando há letterbox)
  const targetW = Math.max(1, Math.floor(mapViewport.w || els.mapStage.getBoundingClientRect().width));
  const targetH = Math.max(1, Math.floor(mapViewport.h || els.mapStage.getBoundingClientRect().height));

  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, targetW, targetH);

  // Render por polígono territorial (melhor leitura e alinhamento com suas zonas)
  ctx.imageSmoothingEnabled = true;

  for(const z of state.zonePolys){
    if(z.layer !== 'world') continue;
    const c = climateForZone(z);

    ctx.beginPath();
    const pts = z.poly;
    for(let i=0; i<pts.length; i++){
      const px = (pts[i][0] / 100) * targetW;
      const py = (pts[i][1] / 100) * targetH;
      if(i===0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = c.color;
    ctx.fill();

    // contorno sutil
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function updateTimeUI(){
  const season = seasonFromMonth(state.worldTime.month);
  els.worldTimeLabel.textContent = `Dia ${state.worldTime.day} • Mês ${state.worldTime.month} • Ano ${state.worldTime.year} • ${season}`;

  // sincroniza campos de edição (mesmo se travados)
  if(els.dayInput) els.dayInput.value = String(state.worldTime.day);
  if(els.monthInput) els.monthInput.value = String(state.worldTime.month);
  if(els.yearInput) els.yearInput.value = String(state.worldTime.year);

  const locked = !!state.dateLock;
  if(els.dateLockToggle) els.dateLockToggle.checked = locked;
  const canEdit = state.gm.unlocked && !locked;
  for(const el of [els.dayInput, els.monthInput, els.yearInput, els.applyDateBtn]){
    if(el) el.disabled = !canEdit;
  }
  if(els.advanceDayBtn) els.advanceDayBtn.disabled = !state.gm.unlocked;

  if(els.gmLogoutBtn) els.gmLogoutBtn.disabled = !state.gm.unlocked;
  if(els.gmEditorBtn) els.gmEditorBtn.disabled = !state.gm.unlocked;
  if(els.importantNpcToggle) els.importantNpcToggle.disabled = !state.gm.unlocked;
  if(els.importantNpcToggle) els.importantNpcToggle.checked = !!state.gm.showImportantNpcs;
  if(els.expandAllInfoToggle) els.expandAllInfoToggle.disabled = !state.gm.unlocked;
  if(els.expandAllInfoToggle) els.expandAllInfoToggle.checked = !!state.gm.showAllInfo;
  if(els.gmHint) els.gmHint.style.display = state.gm.unlocked ? 'none' : 'block';
}

function advanceDay(){
  state.worldTime.day += 1;
  if(state.worldTime.day > 30){
    state.worldTime.day = 1;
    state.worldTime.month += 1;
    if(state.worldTime.month > 12){
      state.worldTime.month = 1;
      state.worldTime.year += 1;
    }
  }
  persistState();
  updateTimeUI();
  drawClimateOverlay();

  // se cidade aberta, re-render meta/inventários
  if(state.ui.cityOpenId){
    const cityId = state.ui.cityOpenId;
    openCity(cityId);
  }
}



const GM_PIN_STORAGE_KEY = 'eldralore_gm_pin_hash_v1';

function applyDateFromInputs(){
  const day = parseInt(els.dayInput.value, 10);
  const month = parseInt(els.monthInput.value, 10);
  const year = parseInt(els.yearInput.value, 10);

  if(!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)){
    alert('Data inválida.');
    return;
  }
  if(day < 1 || day > 30 || month < 1 || month > 12 || year < 1){
    alert('Data fora do intervalo: Dia 1..30, Mês 1..12, Ano >=1.');
    return;
  }

  state.worldTime = { day, month, year };
  persistState();
  updateTimeUI();
  drawClimateOverlay();
  if(state.ui.cityOpenId) openCity(state.ui.cityOpenId);
}

function gmLogin(){
  // Barreira de UI (não segurança real). Sem backend, qualquer pessoa com DevTools pode burlar.
  // Neste projeto: senha fixa embutida no build, para evitar que cada usuário "crie" seu próprio PIN.
  const configured = (typeof window !== 'undefined' && window.ELDRALORE_GM_PASSWORD) ? String(window.ELDRALORE_GM_PASSWORD) : "";
  if(!configured){
    alert('Senha GM não configurada no projeto. Defina window.ELDRALORE_GM_PASSWORD no index.html.');
    return;
  }
  const pass = prompt('Senha do Modo GM:');
  if(pass === null) return;
  if(String(pass) !== configured){
    alert('Senha incorreta.');
    return;
  }
  state.gm.unlocked = true;
  updateTimeUI();
  if(state.ui.cityOpenId) openCity(state.ui.cityOpenId);
}

function gmLogout(){
  state.gm.unlocked = false;
  updateTimeUI();
  if(state.ui.cityOpenId) openCity(state.ui.cityOpenId);
}

function updateTopbarHeightVar(){
  try{
    const h = els.topbar ? els.topbar.getBoundingClientRect().height : 90;
    document.documentElement.style.setProperty('--topbar-h', `${Math.ceil(h)}px`);
  }catch{
    // ignore
  }
}

function scheduleViewportRecalc(){
  // Recalcula várias vezes para capturar reflow/line-wrap após expandir a barra.
  const run = () => {
    updateTopbarHeightVar();
    applyMapViewport();
  };
  requestAnimationFrame(run);
  setTimeout(run, 60);
  setTimeout(run, 220);
}


function closeMobilePanels(){
  document.body.classList.remove('mobile-controls-open','mobile-sidebar-open');
  if(els.mobileBackdrop) els.mobileBackdrop.hidden = true;
}
function toggleMobilePanel(kind){
  const cls = kind === 'controls' ? 'mobile-controls-open' : 'mobile-sidebar-open';
  const other = kind === 'controls' ? 'mobile-sidebar-open' : 'mobile-controls-open';
  const willOpen = !document.body.classList.contains(cls);
  document.body.classList.remove(other);
  document.body.classList.toggle(cls, willOpen);
  if(els.mobileBackdrop) els.mobileBackdrop.hidden = !willOpen;
}

function applyUiCollapsed(){
  if(!els.topbar) return;
  els.topbar.classList.toggle("collapsed", !!state.uiCollapsed);
  if(els.uiCollapseBtn) els.uiCollapseBtn.textContent = state.uiCollapsed ? "Expandir" : "Minimizar";
  scheduleViewportRecalc();
}

function bindUI(){
  if(els.uiCollapseBtn){
    els.uiCollapseBtn.addEventListener('click', () => {
      state.uiCollapsed = !state.uiCollapsed;
      persistState();
      applyUiCollapsed();
      // Clima depende do viewport real do mapa
      drawClimateOverlay();
    });

  if(els.mobileFiltersBtn){
    els.mobileFiltersBtn.addEventListener('click', () => toggleMobilePanel('controls'));
  }
  if(els.mobileLocationsBtn){
    els.mobileLocationsBtn.addEventListener('click', () => toggleMobilePanel('sidebar'));
  }
  if(els.mobileBackdrop){
    els.mobileBackdrop.addEventListener('click', closeMobilePanels);
  }
  window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeMobilePanels();
  });

  }

  els.layerSelect.addEventListener('change', () => {
    state.layer = els.layerSelect.value;
    update();
  });
  els.raceSelect.addEventListener('change', () => {
    state.race = els.raceSelect.value;
    update();
  });
  els.typeSelect.addEventListener('change', () => {
    state.type = els.typeSelect.value;
    update();
  });
  els.searchInput.addEventListener('input', () => {
    state.q = els.searchInput.value;
    update();
  });

  els.debugToggle.addEventListener('change', () => {
    state.debug = !!els.debugToggle.checked;
  });

  if(els.measureToggle){
    els.measureToggle.addEventListener('change', () => {
      state.measure.on = !!els.measureToggle.checked;
      resetMeasure();
    });
  }

  // Zoom controls
  if(els.zoomInBtn) els.zoomInBtn.addEventListener('click', () => {
    const rect = els.mapStage.getBoundingClientRect();
    zoomAboutPoint(state.view.scale * 1.2, rect.width/2, rect.height/2);
  });
  if(els.zoomOutBtn) els.zoomOutBtn.addEventListener('click', () => {
    const rect = els.mapStage.getBoundingClientRect();
    zoomAboutPoint(state.view.scale / 1.2, rect.width/2, rect.height/2);
  });
  if(els.zoomResetBtn) els.zoomResetBtn.addEventListener('click', () => {
    resetZoom();
  });

  els.climateToggle.addEventListener('change', () => {
    state.climateOn = !!els.climateToggle.checked;
    persistState();
    drawClimateOverlay();
  });

  els.hideNoImageToggle.addEventListener('change', () => {
    state.hideNoImage = !!els.hideNoImageToggle.checked;
    persistState();
    update();
  });

  els.advanceDayBtn.addEventListener('click', () => {
    if(!state.gm.unlocked) return;
    advanceDay();
  });

  els.dateLockToggle.addEventListener('change', () => {
    state.dateLock = !!els.dateLockToggle.checked;
    persistState();
    updateTimeUI();
  });

  els.applyDateBtn.addEventListener('click', () => {
    if(!state.gm.unlocked || state.dateLock) return;
    applyDateFromInputs();
  });

  els.gmLoginBtn.addEventListener('click', gmLogin);
  els.gmLogoutBtn.addEventListener('click', gmLogout);

  if(els.gmEditorBtn){
    els.gmEditorBtn.addEventListener('click', openGmEditor);
  }
  if(els.closeGmEditor){
    els.closeGmEditor.addEventListener('click', closeGmEditor);
  }
  if(els.gmEditorBackdrop){
    closeOnBackdropClick(els.gmEditorBackdrop, closeGmEditor);
  }
  if(els.minimizeGmEditor){
    els.minimizeGmEditor.addEventListener('click', () => {
      if(!state.gm.unlocked) return;
      setGmEditorMinimized(!state.gm.editorMinimized);
    });
  }
  if(els.gmSelectPinBtn){
    els.gmSelectPinBtn.addEventListener('click', () => {
      if(!state.gm.unlocked) return;
      setGmEditorMinimized(true);
      // Ajuda visual
      if(els.gmSelectedPin) els.gmSelectedPin.textContent = 'Editor minimizado: clique em um pin no mapa para selecionar.';
    });
  }
  if(els.gmCaptureBtn){
    els.gmCaptureBtn.addEventListener('click', () => {
      if(!state.gm.unlocked) return;
      state.gm.captureMode = !state.gm.captureMode;
      // Para capturar o clique no mapa, o editor precisa não bloquear o mapa
      if(state.gm.captureMode){
        setGmEditorMinimized(true);
        if(els.gmCreateHint) els.gmCreateHint.textContent = 'Captura ativa: clique no mapa para preencher X/Y. Depois volte aqui e clique em Criar pin.';
      } else {
        if(els.gmCreateHint) els.gmCreateHint.textContent = 'Dica: use Capturar no mapa, defina Nome e Tipo, e clique em Criar pin.';
      }
      updateGmCaptureUI();
    });
  }
  if(els.gmCreatePinBtn){
    els.gmCreatePinBtn.addEventListener('click', () => {
      if(!state.gm.unlocked) return;
      gmCreatePin();
    });
  }
  if(els.gmPromoteBtn){
    els.gmPromoteBtn.addEventListener('click', () => {
      if(!state.gm.unlocked) return;
      gmApplyZoneConversion('promote');
    });
  }
  if(els.gmDemoteBtn){
    els.gmDemoteBtn.addEventListener('click', () => {
      if(!state.gm.unlocked) return;
      gmApplyZoneConversion('demote');
    });
  }
  if(els.gmExportBtn){
    els.gmExportBtn.addEventListener('click', () => {
      if(!state.gm.unlocked) return;
      gmExportData();
    });
  }

  if(els.gmMakeCityMainBtn){
    els.gmMakeCityMainBtn.addEventListener('click', () => {
      if(!state.gm.unlocked) return;
      gmSetSelectedPinType('city_main');
    });
  }
  if(els.gmMakeSettlementBtn){
    els.gmMakeSettlementBtn.addEventListener('click', () => {
      if(!state.gm.unlocked) return;
      gmSetSelectedPinType('settlement');
    });
  }
  if(els.gmApplyCityConfigBtn){
    els.gmApplyCityConfigBtn.addEventListener('click', () => {
      if(!state.gm.unlocked) return;
      gmApplyCityConfig();
    });
  }

  // (removido) bloco duplicado de binds do Editor GM

  els.importantNpcToggle.addEventListener('change', () => {
    if(!state.gm.unlocked) return;
    state.gm.showImportantNpcs = !!els.importantNpcToggle.checked;
    persistState();
    // re-render conteudos abertos
    if(state.ui.cityOpenId) openCity(state.ui.cityOpenId);
  });

  els.expandAllInfoToggle.addEventListener('change', () => {
    if(!state.gm.unlocked) return;
    state.gm.showAllInfo = !!els.expandAllInfoToggle.checked;
    persistState();
    // re-render SOMENTE se um local estiver aberto
    if(state.ui && state.ui.openLocId){
      const pin = state.pins.find(x=>x.id===state.ui.openLocId);
      if(pin) openLoc(pin);
    }
  });

  // Zoom com roda do mouse (sobre o mapa)
  els.mapStage.addEventListener('wheel', (e) => {
    if(e.ctrlKey) return; // deixa o zoom do navegador funcionar se Ctrl estiver pressionado
    e.preventDefault();
    const rect = els.mapStage.getBoundingClientRect();
    const px = (e.clientX - rect.left);
    const py = (e.clientY - rect.top);
    const dir = e.deltaY > 0 ? 0.90 : 1.10;
    zoomAboutPoint(state.view.scale * dir, px, py);
  }, { passive: false });

  // Pan: segure Shift e arraste
  els.mapStage.addEventListener('mousedown', (e) => {
    if(!e.shiftKey || e.button !== 0) return;
    panDrag.active = true;
    panDrag.startX = e.clientX;
    panDrag.startY = e.clientY;
    panDrag.basePanX = state.view.panX;
    panDrag.basePanY = state.view.panY;
  });
  window.addEventListener('mousemove', (e) => {
    if(!panDrag.active) return;
    const dx = e.clientX - panDrag.startX;
    const dy = e.clientY - panDrag.startY;
    panDrag.lastMoveTs = Date.now();
    state.view.panX = panDrag.basePanX + dx;
    state.view.panY = panDrag.basePanY + dy;
    applyZoom();
  });
  window.addEventListener('mouseup', () => {
    panDrag.active = false;
  });

  els.mapStage.addEventListener('click', (e) => {
    // Evita clique acidental após arrasto
    if(panDrag.active || (Date.now() - panDrag.lastMoveTs) < 220) return;

    // Captura de coordenadas para o Editor GM
    if(state.gm.unlocked && state.gm.captureMode){
      const [x, y] = getPercentFromEvent(e);
      if(els.gmPinX) els.gmPinX.value = x;
      if(els.gmPinY) els.gmPinY.value = y;
      state.gm.captureMode = false;
      updateGmCaptureUI();
      return;
    }

    // Régua / viagem
    if(state.measure.on){
      const [x, y] = getPercentFromEvent(e);
      if(!state.measure.a){
        state.measure.a = [x, y];
        state.measure.b = null;
        drawMeasure();
        return;
      }
      if(!state.measure.b){
        state.measure.b = [x, y];
        drawMeasure();
        const t = computeTravel(state.measure.a, state.measure.b);
        if(t){
          const msg = `Distância estimada: <b>${t.distKm.toFixed(1)} km</b><br/>Tempo (a ${TRAVEL_KM_PER_DAY} km/dia): <b>${escapeHtml(formatTravel(t.days))}</b><br/><span style="color:rgba(255,255,255,.7)">Escala: ${t.kmPerPxX.toFixed(3)} km/px (X) • ${t.kmPerPxY.toFixed(3)} km/px (Y)</span>`;
          els.debugBody.innerHTML = msg;
          els.debugBackdrop.classList.remove('hidden');
        }
        return;
      }
      // Terceiro clique reinicia
      resetMeasure();
      return;
    }

    if(!state.debug) return;
    const [x, y] = getPercentFromEvent(e);
    openDebug(x, y);
  });

  els.closeLoc.addEventListener('click', closeLoc);
  els.closeDebug.addEventListener('click', closeDebug);
  els.closeCity.addEventListener('click', closeCity);

  closeOnBackdropClick(els.locBackdrop, closeLoc);
  closeOnBackdropClick(els.debugBackdrop, closeDebug);
  closeOnBackdropClick(els.cityBackdrop, closeCity);

  // --- Hardening: evitar recarregamentos acidentais / submits fantasma ---
  // Em alguns navegadores/extensões, elementos gerados dinamicamente podem disparar submit.
  document.addEventListener('submit', (ev) => {
    ev.preventDefault();
  }, true);

  // Evita que cliques em qualquer <a href="#"> (se existirem) causem navegação/hash inesperada.
  document.addEventListener('click', (ev) => {
    const a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
    if(a && a.getAttribute && a.getAttribute('href') === '#'){
      ev.preventDefault();
    }
  }, true);

  window.addEventListener('keydown', (e) => {
    if(e.key !== 'Escape') return;
    closeLoc();
    closeDebug();
    closeCity();
    if(els.gmEditorBackdrop && !els.gmEditorBackdrop.classList.contains('hidden')) closeGmEditor();
  });

  window.addEventListener('resize', () => {
    updateTopbarHeightVar();
    applyMapViewport();
  });

  // Reage a mudanças de altura da barra superior (wrap de controles, etc.)
  if(window.ResizeObserver && els.topbar){
    try{
      const ro = new ResizeObserver(() => {
        scheduleViewportRecalc();
      });
      ro.observe(els.topbar);
    }catch{
      // ignore
    }
  }
}

function update(){
  applyFilters();
  renderPins();
  renderList();
}

async function main(){
  loadPersistentState();
  bindUI();
  applyUiCollapsed();


  // refletir UI inicial
  els.climateToggle.checked = state.climateOn;
  els.hideNoImageToggle.checked = state.hideNoImage;

  state.items = generateItemsBank();
  try{
    await Promise.all([loadPins(), loadCities(), loadZones()]);
  }catch(err){
    console.error(err);
    // Erro comum: abrir index.html via file:// bloqueia fetch()
    els.list.innerHTML = `<div class="card"><div class="name">Erro ao carregar dados (pins/zones)</div><div class="meta">Abra com um servidor local (ex.: VS Code Live Server). Abrir direto pelo arquivo (file://) bloqueia o carregamento.</div></div>`;
    return;
  }

  // Mescla cidades criadas pelo GM (salvas no navegador)
  if(state.customCities && typeof state.customCities === 'object'){
    state.cities = { ...state.cities, ...state.customCities };
  }

  // Garantir alinhamento perfeito: pins/canvas/tooltip seguem o viewport real da imagem
  if(els.worldMap){
    if(els.worldMap.complete){
      applyMapViewport();
    }else{
      els.worldMap.addEventListener('load', () => applyMapViewport(), { once: true });
    }
  }

  // Zoom inicial
  applyZoom();

  updateTimeUI();
  update();
}

main();
