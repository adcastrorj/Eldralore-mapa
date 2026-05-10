// Atlas de Eldralore (pacote consolidado)
// - Layout estável: pins e mapa no mesmo palco (coords percentuais)
// - Filtros: camada, raça (território), tipo, busca, "ocultar sem imagem"
// - Camadas: Superfície, Subterrâneo, Aéreo, Subaquática, Abismo
// - Modais: fecham no X, ESC e clique fora
// - City View: sublocais, NPCs e comerciantes com inventário dinâmico (20 itens)
// - Clima: overlay automático (modelo leve) + calendário interno

// Bump de versão para evitar conflitos com estados antigos no localStorage
const STORAGE_KEY = 'eldralore_state_v2_v20';
const LEGACY_KEYS = ['eldralore_state_v2_v19', 'eldralore_state_v2_v18', 'eldralore_state_v2_v17', 'eldralore_state_v2_v16', 'eldralore_state_v2_v15', 'eldralore_state_v2_v14', 'eldralore_state_v2_v13', 'eldralore_state_v2_v12', 'eldralore_state_v2_v6', 'eldralore_state_v2_v7', 'eldralore_state_v2_v8'];

const state = {
  layer: 'world',
  race: 'all',
  type: 'all',
  q: '',
  debug: false,
  climateOn: true,
  hideNoImage: false,
  // Visões avançadas (camadas semânticas / tags / grupos / eras / rotas / story)
  era: 'current',
  preset: 'default',
  groupFilter: { enabled: false, selected: [] },
  tagFilter: { enabled: false, mode: 'OR', selected: [] },
  geo: { territories: false, borders: true },
  routeFilter: {
    enabled: false,
    types: ['trade_internal', 'trade_official', 'trade_shadow'],
    participants: [],
    races: null,
    // Padrão limpo: ao ligar rotas, mostra só as conexões principais até o usuário expandir os filtros.
    connectionTypes: ['main-main'],
    // strict = só aparece se todas as raças da rota estiverem marcadas. universal = ponto de vista de uma raça.
    viewMode: 'strict',
    focusRace: 'humans',
    // quando ativo, mostra apenas comércio externo da raça escolhida no ponto de vista
    externalOnly: false
  },
  story: { active: false, storyId: null, chapter: 0 },
  taxonomies: null,
  presets: null,
  eras: null,
  routes: [],
  storiesIndex: null,
  pins: [],
  filtered: [],
  cities: {},
  zones: null,
  zonePolys: [],
  uiCollapsed: false,
  presentMode: false,
  worldTime: { era: 'fourth_age', day: 1, month: 1, year: 1 },
  // Estado global do mundo (pode ser sincronizado entre jogadores via servidor)
  worldState: {
    rev: 0,
    updatedAt: 0,
    climate: { regions: {} },
    vision: { pins: {} },
    groupReputation: { pins: {} },
    rumors: { pins: {} },
  },
  campaign: { timeline: [], pinSecrets: {}, hooks: {}, importantNpcs: [] },
  economy: { modifiers: [] },
  dateLock: true,
  gm: { unlocked: false, showImportantNpcs: false, showAllInfo: false, editorOpen: false, editorMinimized: false, captureMode: false, selectedPinId: null },
  customPins: [],
  customCities: {},
  pinOverrides: {},
  merchantState: {},
  view: { scale: 1, panX: 0, panY: 0 },
  measure: { on: false, a: null, b: null, customSpeedValue: '', customSpeedUnit: 'kmh' },
  items: [],
  ui: {
    calendarHudVisible: true,
    playerExpandedInfo: false,
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
  calendarHudToggle: document.getElementById('calendarHudToggle'),
  calendarHudCloseBtn: document.getElementById('calendarHudCloseBtn'),
  mapCalendarHud: document.getElementById('mapCalendarHud'),
  playerExpandInfoToggle: document.getElementById('playerExpandInfoToggle'),
  timelineOpenBtn: document.getElementById('timelineOpenBtn'),
  timelineBackdrop: document.getElementById('timelineBackdrop'),
  closeTimeline: document.getElementById('closeTimeline'),
  timelineBody: document.getElementById('timelineBody'),
  timelinePlayerNotes: document.getElementById('timelinePlayerNotes'),
  savePlayerNotesBtn: document.getElementById('savePlayerNotesBtn'),
  presetSelect: document.getElementById('presetSelect'),
  eraSelect: document.getElementById('eraSelect'),
  routesToggleBtn: document.getElementById('routesToggleBtn'),
  advancedFiltersBtn: document.getElementById('advancedFiltersBtn'),
  advancedPanel: document.getElementById('advancedPanel'),
  advancedCloseBtn: document.getElementById('advancedCloseBtn'),
  groupFilters: document.getElementById('groupFilters'),
  tagFilters: document.getElementById('tagFilters'),
  tagModeSelect: document.getElementById('tagModeSelect'),
  tagSearchInput: document.getElementById('tagSearchInput'),
  clearTagsBtn: document.getElementById('clearTagsBtn'),
  routeTypeFilters: document.querySelector('#routeFiltersBackdrop #routeTypeFilters'),
  routeTypeFiltersAdv: document.getElementById('routeTypeFiltersAdv'),
  routePartyFiltersAdv: document.getElementById('routePartyFiltersAdv'),
  routePartyFilters: document.getElementById('routePartyFiltersAdv'),
  geoToggles: document.getElementById('geoToggles'),
  storySelect: document.getElementById('storySelect'),
  storyStartBtn: document.getElementById('storyStartBtn'),
  storyStopBtn: document.getElementById('storyStopBtn'),
  storyPrevBtn: document.getElementById('storyPrevBtn'),
  storyNextBtn: document.getElementById('storyNextBtn'),
  storyChapterLabel: document.getElementById('storyChapterLabel'),
  storyText: document.getElementById('storyText'),
  zonesSvg: document.getElementById('zonesSvg'),
  routesSvg: document.getElementById('routesSvg'),

  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  zoomLabel: document.getElementById('zoomLabel'),

  uiCollapseBtn: document.getElementById('uiCollapseBtn'),
  mobileFiltersBtn: document.getElementById('mobileFiltersBtn'),
  presentBtn: document.getElementById('presentBtn'),
  presentExitBtn: document.getElementById('presentExitBtn'),

  mobileLocationsBtn: document.getElementById('mobileLocationsBtn'),
  mobileBackdrop: document.getElementById('mobileBackdrop'),
  controlsPanel: document.getElementById('controlsPanel'),
  sidebarPanel: document.getElementById('sidebarPanel'),
  topbar: document.querySelector('.topbar'),

  // Buttons Focus/Economy
  focusRoutesBtn: document.getElementById('focusRoutesBtn'),
  economyBtn: document.getElementById('economyBtn'),
  economyBackdrop: document.getElementById('economyBackdrop'),
  closeEconomy: document.getElementById('closeEconomy'),
  econApplyBtn: document.getElementById('econApplyBtn'),
  econNegatives: document.getElementById('econNegatives'),
  econPositives: document.getElementById('econPositives'),

  // Route Filters
  routeFiltersBtn: document.getElementById('routeFiltersBtn'),
  routeFiltersBackdrop: document.getElementById('routeFiltersBackdrop'),
  closeRouteFilters: document.getElementById('closeRouteFilters'),
  routesApplyBtn: document.getElementById('routesApplyBtn'),
  routeTypeFilters: document.querySelector('#routeFiltersBackdrop #routeTypeFilters'),
  routeTypeFiltersAdv: document.getElementById('routeTypeFiltersAdv'),
  routePartyFiltersAdv: document.getElementById('routePartyFiltersAdv'),
  routeRaceFilters: document.getElementById('routeRaceFilters'),
  routeFilterAllBtn: document.getElementById('routeFilterAllBtn'),
  routeFilterNoneBtn: document.getElementById('routeFilterNoneBtn'),
  routeViewStrict: document.getElementById('routeViewStrict'),
  routeViewUniversal: document.getElementById('routeViewUniversal'),
  routeExternalOnly: document.getElementById('routeExternalOnly'),
  routeFocusRaceSelect: document.getElementById('routeFocusRaceSelect'),

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
  gmWorldVisionBtn: document.getElementById('gmWorldVisionBtn'),
  gmPanelBtn: document.getElementById('gmPanelBtn'),
  gmEditorBackdrop: document.getElementById('gmEditorBackdrop'),
  minimizeGmEditor: document.getElementById('minimizeGmEditor'),
  gmSelectPinBtn: document.getElementById('gmSelectPinBtn'),
  closeGmEditor: document.getElementById('closeGmEditor'),
  gmPinType: document.getElementById('gmPinType'),
  gmPinLayer: document.getElementById('gmPinLayer'),
  gmPinTerritory: document.getElementById('gmPinTerritory'),
  gmPinName: document.getElementById('gmPinName'),
  gmPinGroup: document.getElementById('gmPinGroup'),
  gmPinTags: document.getElementById('gmPinTags'),
  gmPinEras: document.getElementById('gmPinEras'),
  gmPinDanger: document.getElementById('gmPinDanger'),
  gmPinZoomMin: document.getElementById('gmPinZoomMin'),
  gmPinZoomMax: document.getElementById('gmPinZoomMax'),
  gmPinFaction: document.getElementById('gmPinFaction'),
  gmPinReligion: document.getElementById('gmPinReligion'),
  gmPinCityId: document.getElementById('gmPinCityId'),
  gmAlwaysLabel: document.getElementById('gmAlwaysLabel'),
  gmPinX: document.getElementById('gmPinX'),
  gmPinY: document.getElementById('gmPinY'),
  gmCaptureBtn: document.getElementById('gmCaptureBtn'),
  gmCreatePinBtn: document.getElementById('gmCreatePinBtn'),
  gmZoneSelect: document.getElementById('gmZoneSelect'),
  gmClimateZoneSelect: document.getElementById('gmClimateZoneSelect'),
  gmTempDeltaC: document.getElementById('gmTempDeltaC'),
  gmWeatherType: document.getElementById('gmWeatherType'),
  gmWeatherIntensity: document.getElementById('gmWeatherIntensity'),
  gmWeatherNote: document.getElementById('gmWeatherNote'),
  gmApplyClimateBtn: document.getElementById('gmApplyClimateBtn'),
  gmClearClimateBtn: document.getElementById('gmClearClimateBtn'),
  gmClearAllClimateBtn: document.getElementById('gmClearAllClimateBtn'),
  syncStatus: document.getElementById('syncStatus'),
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

  mapContainer: document.getElementById('mapContainer'),
  mapStage: document.getElementById('mapStage'),
  mapZoomLayer: document.getElementById('mapZoomLayer'),
  mobileMapFullBtn: document.getElementById('mobileMapFullBtn'),
  pins: document.getElementById('pins'),
  list: document.getElementById('list'),
  tooltip: document.getElementById('tooltip'),
  routeLegend: document.getElementById('routeLegend'),
  routeTooltip: document.getElementById('routeTooltip'),
  routeInfo: document.getElementById('routeInfo'),
  climateCanvas: document.getElementById('climateCanvas'),
  measureSvg: document.getElementById('measureSvg'),
  travelBox: document.getElementById('travelBox'),

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

function computeContainViewport(containerRect, naturalW, naturalH) {
  const W = Math.max(1, containerRect.width);
  const H = Math.max(1, containerRect.height);
  const imgW = Math.max(1, naturalW || 1);
  const imgH = Math.max(1, naturalH || 1);

  const imgAR = imgW / imgH;
  const boxAR = W / H;

  let w, h, x, y;
  if (boxAR > imgAR) {
    // Altura limita
    h = H;
    w = H * imgAR;
    x = (W - w) / 2;
    y = 0;
  } else {
    // Largura limita
    w = W;
    h = W / imgAR;
    x = 0;
    y = (H - h) / 2;
  }
  return { x, y, w, h };
}

function applyMapViewport() {
  if (!els.mapStage || !els.worldMap) return;
  const stageRect = els.mapStage.getBoundingClientRect();
  const natW = els.worldMap.naturalWidth || 0;
  const natH = els.worldMap.naturalHeight || 0;
  const v = computeContainViewport(stageRect, natW, natH);
  mapViewport.x = v.x; mapViewport.y = v.y; mapViewport.w = v.w; mapViewport.h = v.h;

  // Ajusta elementos overlay para o viewport real do mapa
  for (const el of [els.pins, els.tooltip, els.climateCanvas, els.routesSvg, els.measureSvg]) {
    if (!el) continue;
    el.style.left = `${v.x}px`;
    el.style.top = `${v.y}px`;
    el.style.width = `${v.w}px`;
    el.style.height = `${v.h}px`;
  }

  // Re-render de clima (depende de width/height do viewport)
  drawClimateOverlay();
}



// ----------------- Modo Apresentação (Player View) -----------------
// ----------------- Modo Apresentação (Player View) -----------------
function setPresentationMode(on) {
  const enabled = !!on;
  state.presentMode = enabled;
  try { localStorage.setItem('eldralore_presentMode', enabled ? '1' : '0'); } catch (_) { }
  document.body.classList.toggle('present-mode', enabled);

  // Botões
  if (els.presentExitBtn) {
    els.presentExitBtn.hidden = !enabled;
  }
  if (els.presentBtn) {
    els.presentBtn.textContent = enabled ? 'Voltar' : 'Apresentação';
    els.presentBtn.title = enabled ? 'Voltar ao modo normal' : 'Modo apresentação (limpa UI para stream)';
  }

  // Fecha painéis que não fazem sentido em apresentação
  try {
    const adv = document.getElementById('advancedPanel');
    if (adv) adv.classList.add('hidden');
    // Se estiver em mobile, fecha drawers também
    document.body.classList.remove('mobile-controls-open', 'mobile-sidebar-open');
    if (els.mobileBackdrop) els.mobileBackdrop.hidden = true;
  } catch (_) { }

  // Recalcula layout e overlays (mapa não pode “encolher”)
  // AGORA: Força redimensionamento imediato e retardado para garantir que o CSS propagou
  const refreshMap = () => {
    try {
      // Atualiza altura da topbar (var CSS)
      if (typeof updateTopbarHeightVar === 'function') updateTopbarHeightVar();

      // Força o mapa a recalcular seu viewport (contain)
      window.dispatchEvent(new Event('resize')); // aciona ouvintes genéricos
      if (typeof applyMapViewport === 'function') applyMapViewport();

      // Re-centraliza e mantém zoom visualmente coerente
      if (typeof applyZoom === 'function') applyZoom();

      // Re-renderiza pins e rotas nas novas coordenadas de tela
      if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
      if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();

      // Ajusta clima
      if (typeof drawClimateOverlay === 'function') drawClimateOverlay();
    } catch (e) {
      console.error('Erro ao atualizar mapa no modo apresentação:', e);
    }
  };

  // 1) Imediato
  refreshMap();

  // 2) Próximo frame (garante reflow do browser)
  requestAnimationFrame(refreshMap);

  // 3) Timeout curto (para transições CSS mais lentas, se houver)
  setTimeout(refreshMap, 50);
  setTimeout(refreshMap, 200);
}

function togglePresentationMode() {
  setPresentationMode(!state.presentMode);
}

function getAllRouteRaceIds() {
  return Object.keys(TERRITORY_COLORS || {}).filter(r => r !== 'default');
}

function normalizeRouteFilter() {
  const allTypes = (typeof ALL_ROUTE_TYPES !== 'undefined') ? ALL_ROUTE_TYPES : ['trade_internal', 'trade_official', 'trade_shadow'];
  const races = getAllRouteRaceIds();
  if (!state.routeFilter || typeof state.routeFilter !== 'object') state.routeFilter = {};

  if (!Array.isArray(state.routeFilter.types)) state.routeFilter.types = [...allTypes];
  // Estados antigos podem não conhecer novos tipos de rota. Mantém compatibilidade sem apagar preferências.
  for (const t of allTypes) {
    if (!state.routeFilter.types.includes(t)) state.routeFilter.types.push(t);
  }
  if (!Array.isArray(state.routeFilter.races)) state.routeFilter.races = [...races];
  if (!Array.isArray(state.routeFilter.participants)) state.routeFilter.participants = [...state.routeFilter.races];

  // undefined = primeira abertura/estado antigo. [] = usuário escolheu “Todas” em tipo de conexão.
  if (!Array.isArray(state.routeFilter.connectionTypes)) state.routeFilter.connectionTypes = ['main-main'];

  if (!['strict', 'universal'].includes(state.routeFilter.viewMode)) state.routeFilter.viewMode = 'strict';
  if (typeof state.routeFilter.externalOnly !== 'boolean') state.routeFilter.externalOnly = false;
  if (!state.routeFilter.focusRace || !races.includes(state.routeFilter.focusRace)) {
    state.routeFilter.focusRace = races.includes(state.race) ? state.race : (races[0] || 'humans');
  }
  state.routeFilter.participants = [...state.routeFilter.races];
  return state.routeFilter;
}

function populateRouteViewControls() {
  const rf = normalizeRouteFilter();
  if (els.routeViewStrict) els.routeViewStrict.checked = rf.viewMode !== 'universal';
  if (els.routeViewUniversal) els.routeViewUniversal.checked = rf.viewMode === 'universal';
  if (els.routeExternalOnly) els.routeExternalOnly.checked = !!rf.externalOnly;

  if (els.routeFocusRaceSelect) {
    const races = getAllRouteRaceIds();
    const previous = els.routeFocusRaceSelect.value || rf.focusRace;
    els.routeFocusRaceSelect.innerHTML = '';
    for (const r of races) {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = raceLabel(r);
      els.routeFocusRaceSelect.appendChild(opt);
    }
    els.routeFocusRaceSelect.value = races.includes(previous) ? previous : rf.focusRace;
    rf.focusRace = els.routeFocusRaceSelect.value || rf.focusRace;
  }
}

function populateRouteConnectionControls() {
  const rf = normalizeRouteFilter();
  const selected = Array.isArray(rf.connectionTypes) ? rf.connectionTypes : ['main-main'];
  const radioValue = selected.length === 0 ? 'all' : selected[0];
  const box = document.querySelector('#routeFiltersBackdrop #routeTypeFilters');
  if (!box) return;
  box.querySelectorAll('input[name="routeConnType"]').forEach(r => {
    r.checked = (r.value === radioValue);
  });
}

function populateRouteRaceFilters() {
  if (!els.routeRaceFilters) return;
  const rf = normalizeRouteFilter();
  const races = getAllRouteRaceIds();

  if (!els.routeRaceFilters.children.length) {
    races.forEach(r => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${r}"> ${raceLabel(r)}`;
      label.querySelector('input').addEventListener('change', (e) => {
        const checked = e.target.checked;
        const current = new Set(state.routeFilter.races || []);
        if (checked) current.add(r); else current.delete(r);
        state.routeFilter.races = Array.from(current);
        state.routeFilter.participants = Array.from(current);
        state.routeFilter.enabled = true;
        persistState();
        if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
      });
      els.routeRaceFilters.appendChild(label);
    });
  }

  const active = new Set(rf.races || []);
  els.routeRaceFilters.querySelectorAll('input').forEach(chk => {
    chk.checked = active.has(chk.value);
  });
}

function toggleAllRouteRaces(on) {
  const races = getAllRouteRaceIds();
  normalizeRouteFilter();
  state.routeFilter.races = on ? races : [];
  state.routeFilter.participants = [...state.routeFilter.races];
  state.routeFilter.enabled = true;
  persistState();
  populateRouteRaceFilters();
  if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
}

function updateEconomyUI() {
  if (!state.economy) state.economy = { modifiers: [] };
  const current = new Set(state.economy.modifiers || []);

  const updateGroup = (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('input').forEach(chk => {
      chk.checked = current.has(chk.value);
      // Bind change event if not already bound? 
      // Better to assume bindUI handles global listeners or we bind here once.
      // Let's rely on bindUI binding generic listeners or bind here to be safe.
      chk.onchange = () => {
        const val = chk.value;
        const s = new Set(state.economy.modifiers || []);
        if (chk.checked) s.add(val); else s.delete(val);
        state.economy.modifiers = Array.from(s);
        persistState();
        try { if (typeof refreshCityView === 'function') refreshCityView(); } catch (e) {}
        try { if (typeof update === 'function') update(); } catch (e) {}
      };
    });
  };

  updateGroup('econNegatives');
  updateGroup('econPositives');
}

function closeOnBackdropClick(backdrop, closeFn) {
  if (!backdrop) return;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeFn();
  });
}

function eraLabelFromValue(value) {
  const v = String(value || state?.worldTime?.era || 'fourth_age');
  const labels = {
    first_age: '1ª Era', second_age: '2ª Era', third_age: '3ª Era', fourth_age: '4ª Era', fifth_age: '5ª Era',
    divine_age: 'Era das Divindades', dragon_age: 'Era dos Dragões', civilizations_age: 'Era das Civilizações', guild_age: 'Era da Guilda'
  };
  if (labels[v]) return labels[v];
  const m = v.match(/^(\d+)$/);
  if (m) return `${m[1]}ª Era`;
  return v || '4ª Era';
}
window.eraLabelFromValue = eraLabelFromValue;

function normalizeWorldTime() {
  if (!state.worldTime || typeof state.worldTime !== 'object') state.worldTime = { era: 'fourth_age', day: 1, month: 1, year: 1 };
  if (!state.worldTime.era) state.worldTime.era = 'fourth_age';
  state.worldTime.day = Math.max(1, parseInt(state.worldTime.day || 1, 10));
  state.worldTime.month = Math.max(1, Math.min(12, parseInt(state.worldTime.month || 1, 10)));
  state.worldTime.year = Math.max(1, parseInt(state.worldTime.year || 1, 10));
  return state.worldTime;
}
window.normalizeWorldTime = normalizeWorldTime;

function getPlayerNotes() {
  try { return localStorage.getItem('eldralore_player_timeline_notes_v1') || ''; } catch (_) { return ''; }
}
function setPlayerNotes(txt) {
  try { localStorage.setItem('eldralore_player_timeline_notes_v1', String(txt || '')); } catch (_) {}
}
function timelineEventDateText(ev) {
  const era = eraLabelFromValue(ev.era || ev.Era || state.worldTime?.era || 'fourth_age');
  const day = ev.dia || ev.day || ev.data?.day || '?';
  const month = ev.mes || ev.month || ev.data?.month || '?';
  const year = ev.ano || ev.year || ev.data?.year || '?';
  return `${era} — Dia ${day} • Mês ${month} • Ano ${year}`;
}
function openTimelinePanel() {
  if (!els.timelineBackdrop || !els.timelineBody) return;
  const camp = (typeof CampaignState !== 'undefined' && CampaignState.ensureCampaign) ? CampaignState.ensureCampaign() : (state.campaign || { timeline: [] });
  const events = Array.isArray(camp.timeline) ? camp.timeline.slice() : [];
  events.sort((a,b) => {
    const ea = String(a.era || ''); const eb = String(b.era || '');
    const ka = `${ea}|${String(a.ano || a.year || 0).padStart(6,'0')}|${String(a.mes || a.month || 0).padStart(2,'0')}|${String(a.dia || a.day || 0).padStart(2,'0')}`;
    const kb = `${eb}|${String(b.ano || b.year || 0).padStart(6,'0')}|${String(b.mes || b.month || 0).padStart(2,'0')}|${String(b.dia || b.day || 0).padStart(2,'0')}`;
    return ka.localeCompare(kb);
  });
  const esc = (typeof escapeHtml === 'function') ? escapeHtml : (x => String(x || ''));
  if (!events.length) {
    els.timelineBody.innerHTML = '<div class="hint">Nenhum evento público importado ainda.</div>';
  } else {
    els.timelineBody.innerHTML = events.map(ev => {
      const title = ev.titulo || ev.title || ev.nome || 'Evento sem título';
      const text = ev.texto || ev.text || ev.descricao || ev.description || ev.efeito || '';
      const pins = Array.isArray(ev.pins) ? ev.pins.join(', ') : (ev.pin || ev.local || '');
      const publicFlag = ev.gmOnly || ev.secreto || ev.secret ? '<span class="tl-badge gm">GM</span>' : '<span class="tl-badge">Público</span>';
      if (ev.gmOnly || ev.secreto || ev.secret) return '';
      return `<article class="timeline-card"><div class="tl-date">${esc(timelineEventDateText(ev))}</div><div class="tl-title">${esc(title)} ${publicFlag}</div>${text ? `<div class="tl-text">${esc(text).replace(/\n/g,'<br>')}</div>` : ''}${pins ? `<div class="tl-pins">Locais: ${esc(pins)}</div>` : ''}</article>`;
    }).join('') || '<div class="hint">Os eventos existentes estão marcados como GM/secretos.</div>';
  }
  if (els.timelinePlayerNotes) els.timelinePlayerNotes.value = getPlayerNotes();
  els.timelineBackdrop.classList.remove('hidden');
}
window.openTimelinePanel = openTimelinePanel;
function closeTimelinePanel() { if (els.timelineBackdrop) els.timelineBackdrop.classList.add('hidden'); }


// Global update() used across modules (climate/gm/map/worldSync).
// Re-applies filters and redraws pins/routes/zones depending on availability.
function update() {
  // Re-applies filters and redraws pins/routes/zones depending on availability.
  try { if (typeof applyFilters === 'function') applyFilters(); } catch (e) { console.warn('applyFilters failed', e); }

  try { if (typeof renderPins === 'function') renderPins(); } catch (e) { console.warn('renderPins failed', e); }

  try { if (typeof renderRoutes === 'function') renderRoutes(); } catch (e) { console.warn('renderRoutes failed', e); }

  try { if (typeof renderZones === 'function') renderZones(); } catch (e) { /* optional */ }
}
window.update = update;

function bindUI() {
  // --- Modal close wiring (Pins / Debug / City) ---
  if (els.closeLoc) els.closeLoc.addEventListener('click', () => { if (typeof closeLoc === 'function') closeLoc(); else if (els.locBackdrop) els.locBackdrop.classList.add('hidden'); });
  closeOnBackdropClick(els.locBackdrop, () => { if (typeof closeLoc === 'function') closeLoc(); else if (els.locBackdrop) els.locBackdrop.classList.add('hidden'); });

  if (els.closeCity) els.closeCity.addEventListener('click', () => { if (typeof closeCity === 'function') closeCity(); else if (els.cityBackdrop) els.cityBackdrop.classList.add('hidden'); });
  closeOnBackdropClick(els.cityBackdrop, () => { if (typeof closeCity === 'function') closeCity(); else if (els.cityBackdrop) els.cityBackdrop.classList.add('hidden'); });

  if (els.closeDebug) els.closeDebug.addEventListener('click', () => { if (typeof closeDebug === 'function') closeDebug(); else if (els.debugBackdrop) els.debugBackdrop.classList.add('hidden'); });
  closeOnBackdropClick(els.debugBackdrop, () => { if (typeof closeDebug === 'function') closeDebug(); else if (els.debugBackdrop) els.debugBackdrop.classList.add('hidden'); });

  // ESC fecha o que estiver aberto (ordem: GM editor -> rotas/econ -> modais -> painéis)
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    // GM editor
    if (els.gmEditorBackdrop && !els.gmEditorBackdrop.classList.contains('hidden')) {
      if (typeof closeGmEditor === 'function') closeGmEditor();
      else els.gmEditorBackdrop.classList.add('hidden');
      return;
    }

    // Painel Visão do Mundo / Route filters / Economy
    const wvBackdrop = document.getElementById('worldVisionBackdrop');
    if (wvBackdrop && !wvBackdrop.classList.contains('hidden')) { if (typeof closeWorldVisionPanel === 'function') closeWorldVisionPanel(); else wvBackdrop.classList.add('hidden'); return; }
    if (els.routeFiltersBackdrop && !els.routeFiltersBackdrop.classList.contains('hidden')) { els.routeFiltersBackdrop.classList.add('hidden'); return; }
    if (els.economyBackdrop && !els.economyBackdrop.classList.contains('hidden')) { els.economyBackdrop.classList.add('hidden'); return; }

    // Pin/City/Debug modals
    if (els.cityBackdrop && !els.cityBackdrop.classList.contains('hidden')) { if (typeof closeCity === 'function') closeCity(); else els.cityBackdrop.classList.add('hidden'); return; }
    if (els.locBackdrop && !els.locBackdrop.classList.contains('hidden')) { if (typeof closeLoc === 'function') closeLoc(); else els.locBackdrop.classList.add('hidden'); return; }
    if (els.debugBackdrop && !els.debugBackdrop.classList.contains('hidden')) { if (typeof closeDebug === 'function') closeDebug(); else els.debugBackdrop.classList.add('hidden'); return; }

    // Advanced panel
    if (els.advancedPanel && !els.advancedPanel.classList.contains('hidden')) { els.advancedPanel.classList.add('hidden'); return; }

    // Mobile panels
    if (document.body.classList.contains('mobile-controls-open') || document.body.classList.contains('mobile-sidebar-open')) {
      document.body.classList.remove('mobile-controls-open', 'mobile-sidebar-open');
      if (els.mobileBackdrop) els.mobileBackdrop.hidden = true;
      return;
    }
  }, { passive: true });

  // --- Core Controls ---
  if (els.layerSelect) {
    els.layerSelect.addEventListener('change', e => {
      state.layer = e.target.value;
      state.view.scale = 1; state.view.panX = 0; state.view.panY = 0; // reset zoom on layer change
      persistState();
      applyZoom();
      if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
      if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
    });
  }
  if (els.raceSelect) {
    els.raceSelect.addEventListener('change', e => {
      state.race = e.target.value;
      persistState();
      if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
    });
  }
  if (els.typeSelect) {
    els.typeSelect.addEventListener('change', e => {
      state.type = e.target.value;
      persistState();
      if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
    });
  }
  if (els.searchInput) {
    els.searchInput.addEventListener('input', e => {
      state.q = e.target.value.toLowerCase();
      // debounce? for now direct
      if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
    });
  }
  if (els.eraSelect) {
    els.eraSelect.addEventListener('change', e => {
      state.era = e.target.value;
      persistState();
      if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
      if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
    });
  }
  if (els.presetSelect) {
    els.presetSelect.addEventListener('change', e => {
      state.preset = e.target.value;
      persistState();
      // Apply preset logic if needed (usually filters)
      if (typeof applyPreset === 'function') applyPreset(state.preset);
      if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
    });
  }

  // --- Toggles ---
  if (els.routesToggleBtn) {
    els.routesToggleBtn.addEventListener('click', () => {
      normalizeRouteFilter();
      state.routeFilter.enabled = !state.routeFilter.enabled;
      if (state.routeFilter.enabled && state.ui) state.ui.routeLegendClosed = false;
      els.routesToggleBtn.classList.toggle('is-on', state.routeFilter.enabled);
      els.routesToggleBtn.classList.toggle('active', state.routeFilter.enabled);
      persistState();
      if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
    });
    // Set initial state
    els.routesToggleBtn.classList.toggle('active', !!state.routeFilter.enabled);
  }

  if (els.hideNoImageToggle) {
    els.hideNoImageToggle.addEventListener('change', e => {
      state.hideNoImage = e.target.checked;
      persistState();
      if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
    });
  }


  if (els.calendarHudToggle) {
    els.calendarHudToggle.addEventListener('change', e => {
      if (!state.ui) state.ui = {};
      state.ui.calendarHudVisible = !!e.target.checked;
      persistState();
      if (typeof updateTimeUI === 'function') updateTimeUI();
    });
  }
  if (els.calendarHudCloseBtn) {
    els.calendarHudCloseBtn.addEventListener('click', () => {
      if (!state.ui) state.ui = {};
      state.ui.calendarHudVisible = false;
      if (els.calendarHudToggle) els.calendarHudToggle.checked = false;
      persistState();
      if (typeof updateTimeUI === 'function') updateTimeUI();
    });
  }
  if (els.playerExpandInfoToggle) {
    els.playerExpandInfoToggle.addEventListener('change', e => {
      if (!state.ui) state.ui = {};
      state.ui.playerExpandedInfo = !!e.target.checked;
      persistState();
      if (state.ui.openLocId) {
        const p = (state.pins || []).find(x => x.id === state.ui.openLocId);
        if (p && typeof openLoc === 'function') openLoc(p);
      }
    });
  }
  if (els.timelineOpenBtn) {
    els.timelineOpenBtn.addEventListener('click', openTimelinePanel);
  }
  if (els.closeTimeline) {
    els.closeTimeline.addEventListener('click', closeTimelinePanel);
  }
  closeOnBackdropClick(els.timelineBackdrop, closeTimelinePanel);
  if (els.savePlayerNotesBtn) {
    els.savePlayerNotesBtn.addEventListener('click', () => {
      setPlayerNotes(els.timelinePlayerNotes ? els.timelinePlayerNotes.value : '');
      alert('Notas do jogador salvas neste navegador.');
    });
  }

  if (els.measureToggle) {
    els.measureToggle.addEventListener('click', () => {
      state.measure.on = !state.measure.on;
      els.measureToggle.classList.toggle('active', state.measure.on);
      if (!state.measure.on) {
        if (typeof resetMeasure === 'function') resetMeasure();
      }
    });
  }

  if (els.debugToggle) {
    els.debugToggle.addEventListener('change', () => {
      state.debug = !!els.debugToggle.checked;
      persistState();
    });
    els.debugToggle.checked = !!state.debug;
  }

  if (els.climateToggle) {
    els.climateToggle.addEventListener('click', () => {
      state.climateOn = !state.climateOn;
      els.climateToggle.classList.toggle('active', state.climateOn);
      persistState();
      if (typeof drawClimateOverlay === 'function') drawClimateOverlay();
    });
  }

  // --- UI/Layout ---
  if (els.uiCollapseBtn) {
    els.uiCollapseBtn.addEventListener('click', () => {
      state.uiCollapsed = !state.uiCollapsed;
      persistState();
      updateUIState();
    });
  }
  if (els.presentBtn) {
    els.presentBtn.addEventListener('click', togglePresentationMode);
  }
  if (els.presentExitBtn) {
    els.presentExitBtn.addEventListener('click', togglePresentationMode);
  }

  // --- Calendar / GM time controls ---
  if (els.advanceDayBtn) {
    els.advanceDayBtn.addEventListener('click', () => {
      if (!state.gm.unlocked) return;
      if (typeof advanceDay === 'function') advanceDay();
    });
  }
  if (els.dateLockToggle) {
    els.dateLockToggle.addEventListener('change', () => {
      state.dateLock = !!els.dateLockToggle.checked;
      persistState();
      if (typeof updateTimeUI === 'function') updateTimeUI();
    });
  }
  if (els.applyDateBtn) {
    els.applyDateBtn.addEventListener('click', () => {
      if (!state.gm.unlocked || state.dateLock) return;
      if (typeof applyDateFromInputs === 'function') applyDateFromInputs();
    });
  }

  // --- Economy Modal ---
  if (els.economyBtn) {
    els.economyBtn.addEventListener('click', () => {
      if (els.economyBackdrop) els.economyBackdrop.classList.remove('hidden');
      updateEconomyUI();
    });
  }
  if (els.closeEconomy) {
    els.closeEconomy.addEventListener('click', () => {
      if (els.economyBackdrop) els.economyBackdrop.classList.add('hidden');
    });
  }
  closeOnBackdropClick(els.economyBackdrop, () => {
    if (els.economyBackdrop) els.economyBackdrop.classList.add('hidden');
  });

  // Botão "Aplicar" (Economia) - útil para UX e para forçar refresh
  if (els.econApplyBtn) {
    els.econApplyBtn.addEventListener('click', () => {
      // Releitura defensiva dos checkboxes, para garantir que o state reflita a UI
      if (!state.economy) state.economy = { modifiers: [] };
      const mods = new Set();
      const addFrom = (id) => {
        const c = document.getElementById(id);
        if (!c) return;
        c.querySelectorAll('input[type="checkbox"]').forEach(chk => { if (chk.checked) mods.add(chk.value); });
      };
      addFrom('econNegatives');
      addFrom('econPositives');
      state.economy.modifiers = Array.from(mods);
      try { state.merchantState = {}; } catch (e) {}
      persistState();
      try { if (typeof refreshCityView === 'function') refreshCityView(); } catch (e) {}
      try { if (typeof update === 'function') update(); } catch (e) {}
    });
  }

  // --- Route Filters Modal ---
  if (els.routeFiltersBtn) {
    els.routeFiltersBtn.addEventListener('click', () => {
      normalizeRouteFilter();
      if (els.routeFiltersBackdrop) els.routeFiltersBackdrop.classList.remove('hidden');
      populateRouteConnectionControls();
      populateRouteViewControls();
      populateRouteRaceFilters();
    });
  }
  if (els.closeRouteFilters) {
    els.closeRouteFilters.addEventListener('click', () => {
      if (els.routeFiltersBackdrop) els.routeFiltersBackdrop.classList.add('hidden');
    });
  }
  closeOnBackdropClick(els.routeFiltersBackdrop, () => {
    if (els.routeFiltersBackdrop) els.routeFiltersBackdrop.classList.add('hidden');
  });

  // Tipo de conexão: radio simples para manter o painel fácil de usar.
  if (els.routeTypeFilters) {
    els.routeTypeFilters.querySelectorAll('input[name="routeConnType"]').forEach(r => {
      r.addEventListener('change', () => {
        normalizeRouteFilter();
        const v = r.value || 'all';
        state.routeFilter.connectionTypes = (v === 'all') ? [] : [v];
        state.routeFilter.enabled = true;
        persistState();
        if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
      });
    });
  }

  // Modo restrito x visão universal por raça.
  const bindRouteViewMode = (el, mode) => {
    if (!el) return;
    el.addEventListener('change', () => {
      if (!el.checked) return;
      normalizeRouteFilter();
      state.routeFilter.viewMode = mode;
      state.routeFilter.enabled = true;
      persistState();
      populateRouteViewControls();
      populateRouteRaceFilters();
      if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
    });
  };
  bindRouteViewMode(els.routeViewStrict, 'strict');
  bindRouteViewMode(els.routeViewUniversal, 'universal');

  if (els.routeExternalOnly) {
    els.routeExternalOnly.addEventListener('change', () => {
      normalizeRouteFilter();
      state.routeFilter.externalOnly = !!els.routeExternalOnly.checked;
      if (state.routeFilter.externalOnly) {
        state.routeFilter.viewMode = 'universal';
        if (state.routeFilter.focusRace && Array.isArray(state.routeFilter.races) && !state.routeFilter.races.includes(state.routeFilter.focusRace)) {
          state.routeFilter.races.push(state.routeFilter.focusRace);
          state.routeFilter.participants = [...state.routeFilter.races];
        }
      }
      state.routeFilter.enabled = true;
      if (state.ui) state.ui.routeLegendClosed = false;
      persistState();
      populateRouteViewControls();
      populateRouteRaceFilters();
      if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
    });
  }

  if (els.routeFocusRaceSelect) {
    els.routeFocusRaceSelect.addEventListener('change', () => {
      normalizeRouteFilter();
      state.routeFilter.focusRace = els.routeFocusRaceSelect.value || state.routeFilter.focusRace;
      if (state.routeFilter.focusRace && Array.isArray(state.routeFilter.races) && !state.routeFilter.races.includes(state.routeFilter.focusRace)) {
        state.routeFilter.races.push(state.routeFilter.focusRace);
        state.routeFilter.participants = [...state.routeFilter.races];
      }
      state.routeFilter.viewMode = 'universal';
      state.routeFilter.enabled = true;
      if (state.ui) state.ui.routeLegendClosed = false;
      persistState();
      populateRouteViewControls();
      populateRouteRaceFilters();
      if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
    });
  }

  // Botão "Aplicar" (Filtros de Rotas)
  if (els.routesApplyBtn) {
    els.routesApplyBtn.addEventListener('click', () => {
      normalizeRouteFilter();
      state.routeFilter.enabled = true;

      const c = document.querySelector('#routeFiltersBackdrop #routeTypeFilters');
      let connVal = 'main-main';
      if (c) {
        const sel = c.querySelector('input[name="routeConnType"]:checked');
        if (sel && sel.value) connVal = sel.value;
      }
      state.routeFilter.connectionTypes = (connVal === 'all') ? [] : [connVal];

      const races = [];
      if (els.routeRaceFilters) {
        els.routeRaceFilters.querySelectorAll('input[type="checkbox"]').forEach(chk => { if (chk.checked) races.push(chk.value); });
      }
      state.routeFilter.races = races;
      state.routeFilter.participants = [...races];

      state.routeFilter.viewMode = (els.routeViewUniversal && els.routeViewUniversal.checked) ? 'universal' : 'strict';
      if (els.routeFocusRaceSelect && els.routeFocusRaceSelect.value) state.routeFilter.focusRace = els.routeFocusRaceSelect.value;
      state.routeFilter.externalOnly = !!(els.routeExternalOnly && els.routeExternalOnly.checked);
      if (state.routeFilter.externalOnly && state.routeFilter.focusRace && !state.routeFilter.races.includes(state.routeFilter.focusRace)) {
        state.routeFilter.races.push(state.routeFilter.focusRace);
        state.routeFilter.participants = [...state.routeFilter.races];
      }
      if (state.ui) state.ui.routeLegendClosed = false;

      persistState();
      if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
      if (els.routeFiltersBackdrop) els.routeFiltersBackdrop.classList.add('hidden');
    });
  }

  // Botões All/None para raças (Rotas)
  if (els.routeFilterAllBtn) {
    els.routeFilterAllBtn.addEventListener('click', () => toggleAllRouteRaces(true));
  }
  if (els.routeFilterNoneBtn) {
    els.routeFilterNoneBtn.addEventListener('click', () => toggleAllRouteRaces(false));
  }

  // Focus Routes (toggle visual simplification)
  if (els.focusRoutesBtn) {
    els.focusRoutesBtn.addEventListener('click', () => {
      state.simplifyVisuals = !state.simplifyVisuals;
      // Atualiza visual do botão
      els.focusRoutesBtn.classList.toggle('active', state.simplifyVisuals);
      // Re-render pins
      if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
    });
  }

  // --- Zoom ---
  if (els.zoomInBtn) els.zoomInBtn.addEventListener('click', () => zoomAboutPoint(state.view.scale * 1.2, window.innerWidth / 2, window.innerHeight / 2));
  if (els.zoomOutBtn) els.zoomOutBtn.addEventListener('click', () => zoomAboutPoint(state.view.scale / 1.2, window.innerWidth / 2, window.innerHeight / 2));
  if (els.zoomResetBtn) els.zoomResetBtn.addEventListener('click', resetZoom);

  // --- Drag do mapa ---
  if (els.mapStage) {
    els.mapStage.addEventListener('mousedown', e => {
      if (e.button !== 0 && !e.shiftKey) return; // apenas left click ou shift
      if (state.measure && state.measure.on) return; // régua usa cliques, não arrasto
      if (e.shiftKey) e.preventDefault(); // evita select text
      panDrag.active = true;
      panDrag.startX = e.clientX;
      panDrag.startY = e.clientY;
      panDrag.basePanX = state.view.panX;
      panDrag.basePanY = state.view.panY;
      els.mapStage.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!panDrag.active) return;
      const dx = e.clientX - panDrag.startX;
      const dy = e.clientY - panDrag.startY;
      state.view.panX = panDrag.basePanX + dx;
      state.view.panY = panDrag.basePanY + dy;
      panDrag.lastMoveTs = Date.now();
      applyZoom();
    });
    window.addEventListener('mouseup', () => {
      if (panDrag.active) {
        panDrag.active = false;
        els.mapStage.style.cursor = '';
      }
    });
    els.mapStage.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = els.mapStage.getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      // Garante zoomAboutPoint disponivel
      if (typeof zoomAboutPoint === 'function') zoomAboutPoint(state.view.scale * factor, ox, oy);
    }, { passive: false });

    // --- Touch / pointer do mapa (mobile/tablet) ---
    // Mantém o comportamento do mouse no PC e adiciona arrasto com dedo + pinch zoom no celular.
    const touchPointers = new Map();
    let touchGesture = { mode: null, startX: 0, startY: 0, basePanX: 0, basePanY: 0, startScale: 1, startDist: 0, startMidX: 0, startMidY: 0, moved: false };
    const pointFromPointer = (ev) => ({ x: ev.clientX, y: ev.clientY });
    const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid2 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const resetTouchGesture = () => { touchGesture = { mode: null, startX: 0, startY: 0, basePanX: 0, basePanY: 0, startScale: state.view.scale, startDist: 0, startMidX: 0, startMidY: 0, moved: false }; };
    els.mapStage.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      if (state.measure && state.measure.on) return;
      if (state.gm && state.gm.unlocked && state.gm.captureMode) return;
      if (e.target && e.target.closest && e.target.closest('.pin,.route-line,.route-legend,.route-info,.measure-box,.mobile-map-full-btn,.map-calendar-hud')) return;
      e.preventDefault();
      touchPointers.set(e.pointerId, pointFromPointer(e));
      try { els.mapStage.setPointerCapture(e.pointerId); } catch (_) {}
      const pts = Array.from(touchPointers.values());
      if (pts.length === 1) {
        touchGesture = { mode: 'pan', startX: pts[0].x, startY: pts[0].y, basePanX: state.view.panX, basePanY: state.view.panY, startScale: state.view.scale, startDist: 0, startMidX: 0, startMidY: 0, moved: false };
      } else if (pts.length >= 2) {
        const rect = els.mapStage.getBoundingClientRect();
        const a = pts[0], b = pts[1], m = mid2(a, b);
        touchGesture = { mode: 'pinch', startX: 0, startY: 0, basePanX: state.view.panX, basePanY: state.view.panY, startScale: state.view.scale, startDist: Math.max(1, dist2(a, b)), startMidX: m.x - rect.left, startMidY: m.y - rect.top, moved: false };
      }
    }, { passive: false });
    els.mapStage.addEventListener('pointermove', e => {
      if (!touchPointers.has(e.pointerId)) return;
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      touchPointers.set(e.pointerId, pointFromPointer(e));
      const pts = Array.from(touchPointers.values());
      if (pts.length >= 2 && touchGesture.mode === 'pinch') {
        const rect = els.mapStage.getBoundingClientRect();
        const a = pts[0], b = pts[1], m = mid2(a, b);
        const nextScale = clampZoom(touchGesture.startScale * (dist2(a, b) / Math.max(1, touchGesture.startDist)));
        const ratio = nextScale / (touchGesture.startScale || 1);
        state.view.scale = nextScale;
        state.view.panX = (m.x - rect.left) - (touchGesture.startMidX - touchGesture.basePanX) * ratio;
        state.view.panY = (m.y - rect.top) - (touchGesture.startMidY - touchGesture.basePanY) * ratio;
        touchGesture.moved = true;
        panDrag.lastMoveTs = Date.now();
        applyZoom();
      } else if (pts.length === 1 && touchGesture.mode === 'pan') {
        const p = pts[0];
        const dx = p.x - touchGesture.startX;
        const dy = p.y - touchGesture.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) touchGesture.moved = true;
        state.view.panX = touchGesture.basePanX + dx;
        state.view.panY = touchGesture.basePanY + dy;
        panDrag.lastMoveTs = Date.now();
        applyZoom();
      }
    }, { passive: false });
    const endTouchPointer = (e) => {
      if (!touchPointers.has(e.pointerId)) return;
      touchPointers.delete(e.pointerId);
      if (touchPointers.size === 0) {
        if (touchGesture.moved) panDrag.lastMoveTs = Date.now();
        resetTouchGesture();
      } else if (touchPointers.size === 1) {
        const p = Array.from(touchPointers.values())[0];
        touchGesture = { mode: 'pan', startX: p.x, startY: p.y, basePanX: state.view.panX, basePanY: state.view.panY, startScale: state.view.scale, startDist: 0, startMidX: 0, startMidY: 0, moved: false };
      }
    };
    els.mapStage.addEventListener('pointerup', endTouchPointer, { passive: true });
    els.mapStage.addEventListener('pointercancel', endTouchPointer, { passive: true });

    els.mapStage.addEventListener('click', e => {
      if (panDrag.active || (Date.now() - (panDrag.lastMoveTs || 0)) < 180) return;
      if (e.target && e.target.closest && e.target.closest('.pin,.route-line,.route-legend,.route-info,.measure-box')) return;
      if (typeof getPercentFromEvent !== 'function') return;
      const [x, y] = getPercentFromEvent(e);

      if (state.gm && state.gm.unlocked && state.gm.captureMode) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof captureGmCoordinates === 'function') captureGmCoordinates(x, y);
        return;
      }

      if (state.measure && state.measure.on) {
        e.preventDefault();
        e.stopPropagation();
        if (!state.measure.a || (state.measure.a && state.measure.b)) {
          state.measure.a = [x, y];
          state.measure.b = null;
        } else {
          state.measure.b = [x, y];
        }
        if (typeof drawMeasure === 'function') drawMeasure();
        if (typeof updateMeasureInfo === 'function') updateMeasureInfo();
        return;
      }

      if (state.debug) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof openDebug === 'function') openDebug(x, y);
      }
    });
  }

  // --- Mobile / Advanced ---
  const closeAtlasMobileDrawers = () => {
    document.body.classList.remove('mobile-controls-open', 'mobile-sidebar-open');
    if (els.mobileBackdrop) els.mobileBackdrop.hidden = true;
  };
  const toggleAtlasMobileDrawer = (kind) => {
    const cls = kind === 'controls' ? 'mobile-controls-open' : 'mobile-sidebar-open';
    const other = kind === 'controls' ? 'mobile-sidebar-open' : 'mobile-controls-open';
    const willOpen = !document.body.classList.contains(cls);
    document.body.classList.remove(other);
    document.body.classList.toggle(cls, willOpen);
    if (els.mobileBackdrop) els.mobileBackdrop.hidden = !willOpen;
  };
  let atlasMobileViewBeforeFullscreen = null;
  const fitAtlasMapToFullscreen = () => {
    if (!els.mapStage || !mapViewport || !mapViewport.w || !mapViewport.h) return;
    const rect = els.mapStage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const coverScale = clampZoom(Math.max(rect.width / mapViewport.w, rect.height / mapViewport.h) * 1.02);
    state.view.scale = coverScale;
    state.view.panX = (rect.width - mapViewport.w * coverScale) / 2 - mapViewport.x * coverScale;
    state.view.panY = (rect.height - mapViewport.h * coverScale) / 2 - mapViewport.y * coverScale;
    if (typeof applyZoom === 'function') applyZoom();
  };
  const setAtlasMapFullscreen = (enabled) => {
    if (enabled && !atlasMobileViewBeforeFullscreen) {
      atlasMobileViewBeforeFullscreen = { ...state.view };
    }
    document.body.classList.toggle('mobile-map-fullscreen', !!enabled);
    if (els.mobileMapFullBtn) {
      els.mobileMapFullBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      els.mobileMapFullBtn.textContent = enabled ? 'Sair da tela cheia' : 'Mapa tela cheia';
    }
    closeAtlasMobileDrawers();
    setTimeout(() => {
      if (typeof applyMapViewport === 'function') applyMapViewport();
      if (enabled) {
        fitAtlasMapToFullscreen();
      } else if (atlasMobileViewBeforeFullscreen) {
        state.view = { ...atlasMobileViewBeforeFullscreen };
        atlasMobileViewBeforeFullscreen = null;
        if (typeof applyZoom === 'function') applyZoom();
      } else if (typeof applyZoom === 'function') {
        applyZoom();
      }
      if (typeof resizeClimateCanvas === 'function') resizeClimateCanvas();
      if (typeof drawClimateOverlay === 'function' && state.climateOn) drawClimateOverlay();
    }, 60);
  };
  if (els.mobileFiltersBtn) {
    els.mobileFiltersBtn.addEventListener('click', () => toggleAtlasMobileDrawer('controls'));
  }
  if (els.mobileLocationsBtn) {
    els.mobileLocationsBtn.addEventListener('click', () => toggleAtlasMobileDrawer('sidebar'));
  }
  if (els.mobileMapFullBtn) {
    els.mobileMapFullBtn.addEventListener('click', () => {
      setAtlasMapFullscreen(!document.body.classList.contains('mobile-map-fullscreen'));
    });
  }
  const mobileFiltersCloseBtn = document.getElementById('mobileFiltersCloseBtn');
  const mobileLocationsCloseBtn = document.getElementById('mobileLocationsCloseBtn');
  if (mobileFiltersCloseBtn) {
    mobileFiltersCloseBtn.addEventListener('click', closeAtlasMobileDrawers);
  }
  if (mobileLocationsCloseBtn) {
    mobileLocationsCloseBtn.addEventListener('click', closeAtlasMobileDrawers);
  }
  if (els.controlsPanel) {
    els.controlsPanel.addEventListener('click', (e) => e.stopPropagation());
    els.controlsPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  if (els.sidebarPanel) {
    els.sidebarPanel.addEventListener('click', (e) => e.stopPropagation());
    els.sidebarPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  if (els.mobileBackdrop) {
    els.mobileBackdrop.addEventListener('click', closeAtlasMobileDrawers);
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('mobile-map-fullscreen')) setAtlasMapFullscreen(false);
  });
  // Advanced Panel
  if (els.advancedFiltersBtn) {
    els.advancedFiltersBtn.addEventListener('click', () => {
      const p = document.getElementById('advancedPanel');
      if (p) {
        p.classList.remove('hidden');
        // garante visibilidade (o painel fica no topo da lista)
        if (els.list) els.list.scrollTop = 0;
      }
    });
  }
  const closeAdv = document.getElementById('advancedCloseBtn');
  if (closeAdv) {
    closeAdv.addEventListener('click', () => {
      const p = document.getElementById('advancedPanel');
      if (p) p.classList.add('hidden');
    });
  }


  // --- Advanced Tags / Story Mode ---
  if (els.tagModeSelect) {
    els.tagModeSelect.addEventListener('change', () => {
      if (!state.tagFilter) state.tagFilter = { enabled: false, mode: 'OR', selected: [] };
      state.tagFilter.mode = String(els.tagModeSelect.value || 'OR').toUpperCase();
      state.tagFilter.enabled = Array.isArray(state.tagFilter.selected) && state.tagFilter.selected.length > 0;
      persistState();
      if (typeof rebuildAdvancedPanel === 'function') rebuildAdvancedPanel();
      if (typeof update === 'function') update();
    });
  }
  if (els.tagSearchInput) {
    els.tagSearchInput.addEventListener('input', () => {
      if (typeof rebuildAdvancedPanel === 'function') rebuildAdvancedPanel();
    });
  }
  if (els.clearTagsBtn) {
    els.clearTagsBtn.addEventListener('click', () => {
      state.tagFilter = { enabled: false, mode: (els.tagModeSelect && els.tagModeSelect.value) ? String(els.tagModeSelect.value).toUpperCase() : 'OR', selected: [] };
      if (els.tagSearchInput) els.tagSearchInput.value = '';
      persistState();
      if (typeof rebuildAdvancedPanel === 'function') rebuildAdvancedPanel();
      if (typeof update === 'function') update();
    });
  }

  if (els.storyStartBtn) {
    els.storyStartBtn.addEventListener('click', () => {
      const storyId = (els.storySelect && els.storySelect.value) ? els.storySelect.value : '';
      if (!storyId) { alert('Selecione uma história primeiro.'); return; }
      if (typeof startStory === 'function') startStory(storyId);
      else alert('Story Mode indisponível.');
    });
  }
  if (els.storyStopBtn) {
    els.storyStopBtn.addEventListener('click', () => {
      if (typeof stopStory === 'function') stopStory();
    });
  }
  if (els.storyPrevBtn) {
    els.storyPrevBtn.addEventListener('click', () => {
      if (typeof storyPrev === 'function') storyPrev();
    });
  }
  if (els.storyNextBtn) {
    els.storyNextBtn.addEventListener('click', () => {
      if (typeof storyNext === 'function') storyNext();
    });
  }
  if (els.storySelect) {
    els.storySelect.addEventListener('change', () => {
      const storyId = els.storySelect.value || null;
      state.story = { active: false, storyId, chapter: 0, data: null };
      persistState();
      if (typeof rebuildAdvancedPanel === 'function') rebuildAdvancedPanel();
    });
  }


// --- GM Mode ---
if (els.gmLoginBtn) {
  els.gmLoginBtn.addEventListener('click', () => {
    const pw = prompt('Senha do Modo GM:');
    if (!pw) return;
    const ok = (pw === (window.ELDRALORE_GM_PASSWORD || 'eldralore2026'));
    if (!ok) { alert('Senha incorreta.'); return; }
    state.gm.unlocked = true;
    persistState();
    applyGmUiState();
    if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
  });
}
if (els.gmLogoutBtn) {
  els.gmLogoutBtn.addEventListener('click', () => {
    state.gm.unlocked = false;
    state.gm.showImportantNpcs = false;
    state.gm.showAllInfo = false;
    state.gm.captureMode = false;
    persistState();
    applyGmUiState();
    try { if (typeof closeGmEditor === 'function') closeGmEditor(); } catch (_) {}
    try { if (typeof closeWorldVisionPanel === 'function') closeWorldVisionPanel(); } catch (_) {}
    if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
  });
}
if (els.gmEditorBtn) {
  els.gmEditorBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof openGmEditor === 'function') openGmEditor();
    else alert('Editor GM indisponível (gm.js não carregou).');
  });
}

if (els.gmPanelBtn) {
  els.gmPanelBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) { alert('Ative o Modo GM antes de abrir o Painel GM.'); return; }
    try { window.open('gm.html', 'eldralore_gm_panel'); } catch (_) { window.location.href = 'gm.html'; }
  });
}
if (els.importantNpcToggle) {
  els.importantNpcToggle.addEventListener('change', (e) => {
    state.gm.showImportantNpcs = !!e.target.checked;
    persistState();
    if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
  });
}
if (els.expandAllInfoToggle) {
  els.expandAllInfoToggle.addEventListener('change', (e) => {
    state.gm.showAllInfo = !!e.target.checked;
    persistState();
    if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
  });
}

// --- GM Editor controls (mínimo necessário) ---
if (els.closeGmEditor) {
  els.closeGmEditor.addEventListener('click', () => {
    if (typeof closeGmEditor === 'function') closeGmEditor();
  });
}
if (els.minimizeGmEditor) {
  els.minimizeGmEditor.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    const next = !state.gm.editorMinimized;
    if (typeof setGmEditorMinimized === 'function') setGmEditorMinimized(next);
    else {
      state.gm.editorMinimized = next;
      if (els.gmEditorBackdrop) els.gmEditorBackdrop.classList.toggle('passthrough', next);
      els.minimizeGmEditor.textContent = next ? 'Expandir' : 'Minimizar';
    }
    persistState();
  });
}
if (els.gmCaptureBtn) {
  els.gmCaptureBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    state.gm.captureMode = !state.gm.captureMode;
    if (state.gm.captureMode) {
      if (typeof setGmEditorMinimized === 'function') setGmEditorMinimized(true);
      const hint = document.getElementById('gmCreateHint');
      if (hint) hint.textContent = 'Captura ativa: clique no mapa para preencher X/Y automaticamente.';
    }
    persistState();
    if (typeof updateGmCaptureUI === 'function') updateGmCaptureUI();
  });
}

// --- GM Editor action buttons ---
if (els.gmSelectPinBtn) {
  els.gmSelectPinBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof setGmEditorMinimized === 'function') setGmEditorMinimized(true);
    if (els.gmSelectedPin) els.gmSelectedPin.textContent = 'Editor minimizado: clique em um pin no mapa para selecionar.';
  });
}
if (els.gmCreatePinBtn) {
  els.gmCreatePinBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof gmCreatePin === 'function') gmCreatePin();
  });
}
if (els.gmPromoteBtn) {
  els.gmPromoteBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof gmApplyZoneConversion === 'function') gmApplyZoneConversion('promote');
  });
}
if (els.gmDemoteBtn) {
  els.gmDemoteBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof gmApplyZoneConversion === 'function') gmApplyZoneConversion('demote');
  });
}
if (els.gmExportBtn) {
  els.gmExportBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof gmExportData === 'function') gmExportData();
  });
}
if (els.gmMakeCityMainBtn) {
  els.gmMakeCityMainBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof gmSetSelectedPinType === 'function') gmSetSelectedPinType('city_main');
  });
}
if (els.gmMakeSettlementBtn) {
  els.gmMakeSettlementBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof gmSetSelectedPinType === 'function') gmSetSelectedPinType('settlement');
  });
}
if (els.gmApplyCityConfigBtn) {
  els.gmApplyCityConfigBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof gmApplyCityConfig === 'function') gmApplyCityConfig();
  });
}
if (els.gmApplyClimateBtn) {
  els.gmApplyClimateBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof gmApplyClimateOverride === 'function') gmApplyClimateOverride();
  });
}
if (els.gmClearClimateBtn) {
  els.gmClearClimateBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof gmClearClimateOverride === 'function') gmClearClimateOverride();
  });
}
if (els.gmClearAllClimateBtn) {
  els.gmClearAllClimateBtn.addEventListener('click', () => {
    if (!state.gm.unlocked) return;
    if (typeof gmClearAllClimateOverrides === 'function') gmClearAllClimateOverrides();
  });
}
}


function applyGmUiState() {
  const on = !!state.gm?.unlocked;
  if (els.gmLogoutBtn) els.gmLogoutBtn.disabled = !on;
  if (els.gmEditorBtn) els.gmEditorBtn.disabled = !on;
  if (els.gmWorldVisionBtn) els.gmWorldVisionBtn.disabled = !on;
  if (els.gmPanelBtn) els.gmPanelBtn.disabled = !on;
  if (els.importantNpcToggle) els.importantNpcToggle.disabled = !on;
  if (els.expandAllInfoToggle) els.expandAllInfoToggle.disabled = !on;
  if (els.gmHint) els.gmHint.textContent = on ? 'GM ativo — abra o Painel GM' : 'Modo GM bloqueado.';
  // refletir toggles
  if (els.importantNpcToggle) els.importantNpcToggle.checked = !!state.gm?.showImportantNpcs;
  if (els.expandAllInfoToggle) els.expandAllInfoToggle.checked = !!state.gm?.showAllInfo;
}

function updateUIState() {
  if (state.uiCollapsed) document.body.classList.add('ui-collapsed');
  else document.body.classList.remove('ui-collapsed');

  // Também aplica classe na topbar para o CSS de modo compacto
  if (els.topbar) els.topbar.classList.toggle('collapsed', !!state.uiCollapsed);

  if (els.uiCollapseBtn) els.uiCollapseBtn.textContent = state.uiCollapsed ? 'Expandir' : 'Minimizar';

  // Persist focus button state
  if (els.focusRoutesBtn) {
    els.focusRoutesBtn.classList.toggle('active', !!state.simplifyVisuals);
  }
}

// Inicialização
// Inicialização segura
// Inicialização segura
async function safeMain() {
  console.log("safeMain started");

  // 1. Bind UI immediately (prioridade máxima)
  try {
    bindUI();
    console.log("bindUI successful");

    // Marca quais controles devem continuar visíveis no modo compacto (minimizado)
    try {
      const keepIds = ['measureToggle']; // Régua
      keepIds.forEach(id => {
        const el = document.getElementById(id);
        const label = el && el.closest ? el.closest('label') : null;
        if (label) label.classList.add('compact-keep');
      });
    } catch (_) { }
  } catch (e) {
    console.error("bindUI failed:", e);
  }

  // 2. Load State (depende de map.js)
  try {
    if (typeof loadPersistentState === 'function') {
      loadPersistentState();
    } else {
      console.warn("loadPersistentState not found");
    }

    updateUIState();

    if (state.presentMode) setPresentationMode(true);
  } catch (e) {
    console.warn("State load failed:", e);
  }

  // 3. Load Data & Render
  try {
    await loadPins();
    if (typeof update === 'function') update(); else if (typeof renderPins === 'function') renderPins();
    if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
  } catch (err) {
    console.warn("Data load/render failed:", err);
  }

  // 4. Init Helpers (delayed check)
  try {
    if (typeof populateRouteRaceFilters === 'function') {
      if (typeof TERRITORY_COLORS !== 'undefined') {
        populateRouteRaceFilters();
      } else {
        setTimeout(populateRouteRaceFilters, 500);
      }
    }
  } catch (e) {
    console.warn("Helper init failed:", e);
  }
}