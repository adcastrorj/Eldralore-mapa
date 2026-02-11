// Atlas de Eldralore (pacote consolidado)
// - Layout estável: pins e mapa no mesmo palco (coords percentuais)
// - Filtros: camada, raça (território), tipo, busca, "ocultar sem imagem"
// - Camadas: Superfície, Subterrâneo, Aéreo, Subaquática, Abismo
// - Modais: fecham no X, ESC e clique fora
// - City View: sublocais, NPCs e comerciantes com inventário dinâmico (20 itens)
// - Clima: overlay automático (modelo leve) + calendário interno

// Bump de versão para evitar conflitos com estados antigos no localStorage
const STORAGE_KEY = 'eldralore_state_v2_v12';
const LEGACY_KEYS = ['eldralore_state_v2_v6', 'eldralore_state_v2_v7', 'eldralore_state_v2_v8'];

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
  routeFilter: { enabled: false, types: ['trade_internal', 'trade_official', 'trade_shadow'], participants: [] },
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
  worldTime: { day: 1, month: 1, year: 1 },
  // Estado global do mundo (pode ser sincronizado entre jogadores via servidor)
  worldState: {
    rev: 0,
    updatedAt: 0,
    climate: { regions: {} },
  },
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

  mapStage: document.getElementById('mapStage'),
  mapZoomLayer: document.getElementById('mapZoomLayer'),
  pins: document.getElementById('pins'),
  list: document.getElementById('list'),
  tooltip: document.getElementById('tooltip'),
  routeLegend: document.getElementById('routeLegend'),
  routeTooltip: document.getElementById('routeTooltip'),
  routeInfo: document.getElementById('routeInfo'),
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

function populateRouteRaceFilters() {
  if (!els.routeRaceFilters) return;
  const hasContent = els.routeRaceFilters.children.length > 0;
  if (!hasContent) {
    const races = Object.keys(TERRITORY_COLORS).filter(r => r !== 'default');
    races.forEach(r => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${r}" checked> ${raceLabel(r)}`;
      label.querySelector('input').addEventListener('change', (e) => {
        const checked = e.target.checked;
        const current = new Set(state.routeFilter.races || []);
        if (checked) current.add(r); else current.delete(r);
        state.routeFilter.races = Array.from(current);
        persistState();
        if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
      });
      els.routeRaceFilters.appendChild(label);
    });
    // Inicializa state se estiver vazio (primeira vez)
    if (!state.routeFilter.races || state.routeFilter.races.length === 0) {
      state.routeFilter.races = races; // todas ativas
    }
  }

  // Sync UI com State
  const active = new Set(state.routeFilter.races || []);
  els.routeRaceFilters.querySelectorAll('input').forEach(chk => {
    chk.checked = active.has(chk.value);
  });
}

function toggleAllRouteRaces(on) {
  const races = Object.keys(TERRITORY_COLORS).filter(r => r !== 'default');
  state.routeFilter.races = on ? races : [];
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

    // Route filters / Economy
    if (els.routeFiltersBackdrop && !els.routeFiltersBackdrop.classList.contains('hidden')) { els.routeFiltersBackdrop.classList.add('hidden'); return; }
    if (els.economyBackdrop && !els.economyBackdrop.classList.contains('hidden')) { els.economyBackdrop.classList.add('hidden'); return; }

    // Pin/City/Debug modals
    if (els.cityBackdrop && !els.cityBackdrop.classList.contains('hidden')) { if (typeof closeCity === 'function') closeCity(); else els.cityBackdrop.classList.add('hidden'); return; }
    if (els.locBackdrop && !els.locBackdrop.classList.contains('hidden')) { if (typeof closeLoc === 'function') closeLoc(); else els.locBackdrop.classList.add('hidden'); return; }
    if (els.debugBackdrop && !els.debugBackdrop.classList.contains('hidden')) { if (typeof closeDebug === 'function') closeDebug(); else els.debugBackdrop.classList.add('hidden'); return; }

    // Advanced panel
    if (els.advancedPanel && !els.advancedPanel.classList.contains('hidden')) { els.advancedPanel.classList.add('hidden'); return; }

    // Mobile panels
    if (els.mobileBackdrop && !els.mobileBackdrop.classList.contains('hidden')) { els.mobileBackdrop.classList.add('hidden'); return; }
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
      state.routeFilter.enabled = !state.routeFilter.enabled;
      els.routesToggleBtn.classList.toggle('is-on', state.routeFilter.enabled);
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

  if (els.measureToggle) {
    els.measureToggle.addEventListener('click', () => {
      state.measure.on = !state.measure.on;
      els.measureToggle.classList.toggle('active', state.measure.on);
      if (!state.measure.on) {
        if (typeof resetMeasure === 'function') resetMeasure();
      }
    });
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
      if (els.routeFiltersBackdrop) {
        els.routeFiltersBackdrop.classList.remove('hidden');
        populateRouteRaceFilters();
  // Bind route-type checkboxes (Tipo de Conexão)
  const routeTypeBox = document.querySelector('#routeFiltersBackdrop #routeTypeFilters');
  if (routeTypeBox && !routeTypeBox.dataset.bound) {
    routeTypeBox.dataset.bound = '1';
    routeTypeBox.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', () => {
        if (!state.routeFilter) state.routeFilter = {};
        const val = chk.value;
        const current = new Set(state.routeFilter.connectionTypes || []);
        if (chk.checked) current.add(val); else current.delete(val);
        state.routeFilter.connectionTypes = Array.from(current);
        state.routeFilter.enabled = true;
        persistState();
        if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
      });
    });
    // Init state from initial checked boxes (se ainda não houver)
    if (!Array.isArray(state.routeFilter.connectionTypes) || state.routeFilter.connectionTypes.length === 0) {
      const init = Array.from(routeTypeBox.querySelectorAll('input[type="checkbox"]'))
        .filter(x => x.checked).map(x => x.value);
      state.routeFilter.connectionTypes = init;
    }
  }
      }
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

  // Botão "Aplicar" (Filtros de Rotas)
  if (els.routesApplyBtn) {
    els.routesApplyBtn.addEventListener('click', () => {
      if (!state.routeFilter) state.routeFilter = {};
      state.routeFilter.enabled = true;

      // Tipos de rota (trade_*). Se vazio, assume todos.
      if (!Array.isArray(state.routeFilter.types) || state.routeFilter.types.length === 0) {
        state.routeFilter.types = ['trade_internal', 'trade_official', 'trade_shadow'];
      }

      // Tipo de Conexão (seleção isolada via radio)
      const c = document.querySelector('#routeFiltersBackdrop #routeTypeFilters');
      let connVal = 'all';
      if (c) {
        const sel = c.querySelector('input[name="routeConnType"]:checked');
        if (sel && sel.value) connVal = sel.value;
      }
      // connVal === 'all' => sem restrição
      state.routeFilter.connectionTypes = (connVal === 'all') ? [] : [connVal];

      // Raças participantes (compatibilidade: participants + races)
      const races = [];
      if (els.routeRaceFilters) {
        els.routeRaceFilters.querySelectorAll('input[type="checkbox"]').forEach(chk => { if (chk.checked) races.push(chk.value); });
      }
      state.routeFilter.participants = races;
      state.routeFilter.races = races;

      persistState();
      if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
    });
  }

  // Helper para seleção de tipo de conexão (modal) - radios
  if (els.routeTypeFilters) {
    els.routeTypeFilters.querySelectorAll('input[name="routeConnType"]').forEach(r => {
      r.addEventListener('change', () => {
        if (!state.routeFilter) state.routeFilter = {};
        const v = r.value || 'all';
        state.routeFilter.connectionTypes = (v === 'all') ? [] : [v];
        state.routeFilter.enabled = true;
        persistState();
        if (typeof update === 'function') update(); else if (typeof renderRoutes === 'function') renderRoutes();
      });
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
  }

  // --- Mobile / Advanced ---
  if (els.mobileFiltersBtn) {
    els.mobileFiltersBtn.addEventListener('click', () => {
      document.body.classList.toggle('mobile-controls-open');
      if (els.mobileBackdrop) els.mobileBackdrop.hidden = !document.body.classList.contains('mobile-controls-open');
    });
  }
  if (els.mobileLocationsBtn) {
    els.mobileLocationsBtn.addEventListener('click', () => {
      document.body.classList.toggle('mobile-sidebar-open');
      if (els.mobileBackdrop) els.mobileBackdrop.hidden = !document.body.classList.contains('mobile-sidebar-open');
    });
  }
  if (els.mobileBackdrop) {
    els.mobileBackdrop.addEventListener('click', () => {
      document.body.classList.remove('mobile-controls-open', 'mobile-sidebar-open');
      els.mobileBackdrop.hidden = true;
    });
  }
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
    persistState();
    if (typeof updateGmCaptureUI === 'function') updateGmCaptureUI();
  });
}
}


function applyGmUiState() {
  const on = !!state.gm?.unlocked;
  if (els.gmLogoutBtn) els.gmLogoutBtn.disabled = !on;
  if (els.gmEditorBtn) els.gmEditorBtn.disabled = !on;
  if (els.importantNpcToggle) els.importantNpcToggle.disabled = !on;
  if (els.expandAllInfoToggle) els.expandAllInfoToggle.disabled = !on;
  if (els.gmHint) els.gmHint.textContent = on ? 'GM ativo' : 'GM bloqueado';
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