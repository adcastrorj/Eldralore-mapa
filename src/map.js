// ---- Zoom/Pan (aplicado na camada #mapZoomLayer) ----
function applyZoom() {
  if (!els.mapZoomLayer) return;
  if (typeof constrainAtlasMapPan === 'function') constrainAtlasMapPan();
  const { scale, panX, panY } = state.view;
  els.mapZoomLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  // Pins: mantém tamanho visual razoável conforme zoom (evita ficar gigante em zoom alto)
  const inv = 1 / (scale || 1);
  const isMobileViewport = window.matchMedia && window.matchMedia('(max-width: 980px)').matches;
  // Desktop preservado: os pins mantêm a lógica anterior.
  // Mobile: limite um pouco mais baixo para evitar pins grandes demais em telas pequenas,
  // mas com área de toque ampliada via CSS.
  const minPinScale = isMobileViewport ? 0.28 : 0.35;
  const maxPinScale = isMobileViewport ? 0.88 : 1;
  const pinScale = Math.max(minPinScale, Math.min(maxPinScale, inv));
  els.mapZoomLayer.style.setProperty('--pinInvScale', String(pinScale));
  if (els.pins) els.pins.style.setProperty('--pinInvScale', String(pinScale));
  if (els.zoomLabel) els.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

function clampZoom(s) {
  return clamp(s, 0.5, 10);
}

function zoomAboutPoint(newScale, px, py) {
  const old = state.view.scale;
  const ns = clampZoom(newScale);
  if (ns === old) return;
  const r = old === 0 ? 1 : (ns / old);
  // Mantém o ponto (px,py) fixo na tela
  state.view.panX = px - (px - state.view.panX) * r;
  state.view.panY = py - (py - state.view.panY) * r;
  state.view.scale = ns;
  applyZoom();
}

function resetZoom() {
  state.view.scale = 1;
  state.view.panX = 0;
  state.view.panY = 0;
  applyZoom();
}

let panDrag = { active: false, startX: 0, startY: 0, basePanX: 0, basePanY: 0, lastMoveTs: 0 };

// ---- Régua / viagem ----
function resetMeasure() {
  state.measure.a = null;
  state.measure.b = null;
  drawMeasure();
  if (typeof updateMeasureInfo === 'function') updateMeasureInfo();
}

function shortestWorldDeltaPct(a, b) {
  let dx = (b?.[0] || 0) - (a?.[0] || 0);
  let dy = (b?.[1] || 0) - (a?.[1] || 0);

  // Eldralore é tratado como globo: a régua sempre escolhe o menor caminho.
  // Se os pontos estão perto das bordas opostas, ela atravessa a borda do mapa, não o continente inteiro.
  if (dx > 50) dx -= 100;
  if (dx < -50) dx += 100;
  if (dy > 50) dy -= 100;
  if (dy < -50) dy += 100;
  return { dx, dy, x2: (a?.[0] || 0) + dx, y2: (a?.[1] || 0) + dy };
}

function drawMeasure() {
  if (!els.measureSvg) return;
  els.measureSvg.setAttribute('viewBox', '0 0 100 100');
  els.measureSvg.setAttribute('preserveAspectRatio', 'none');
  const a = state.measure.a;
  const b = state.measure.b;
  if (!state.measure.on || !a) {
    els.measureSvg.innerHTML = '';
    return;
  }

  const ax = a[0], ay = a[1];
  const baseEnd = b ? shortestWorldDeltaPct(a, b) : { x2: ax, y2: ay };
  const bx = baseEnd.x2;
  const by = baseEnd.y2;

  // Desenha cópias deslocadas para a linha “sair” por uma borda e “entrar” pela oposta.
  // O próprio SVG corta o que fica fora do viewBox. Isso deixa a régua visualmente coerente com o globo.
  const lineParts = [];
  for (const ox of [-100, 0, 100]) {
    for (const oy of [-100, 0, 100]) {
      lineParts.push(`<line x1="${ax + ox}" y1="${ay + oy}" x2="${bx + ox}" y2="${by + oy}" stroke="rgba(255,255,255,.9)" stroke-width="0.45" vector-effect="non-scaling-stroke" stroke-linecap="round" />`);
    }
  }

  const ca = `<circle cx="${ax}" cy="${ay}" r="0.9" fill="rgba(122,167,255,.98)" stroke="rgba(0,0,0,.7)" stroke-width="0.3" vector-effect="non-scaling-stroke" />`;
  const cb = b ? `<circle cx="${b[0]}" cy="${b[1]}" r="0.9" fill="rgba(255,200,90,.98)" stroke="rgba(0,0,0,.7)" stroke-width="0.3" vector-effect="non-scaling-stroke" />` : '';
  els.measureSvg.innerHTML = lineParts.join('') + ca + cb;
}

function updateMeasureInfo() {
  if (!els.travelBox) return;
  const a = state.measure && state.measure.a;
  const b = state.measure && state.measure.b;
  if (!(state.measure && state.measure.on) || !a) {
    els.travelBox.classList.add('hidden');
    els.travelBox.innerHTML = '';
    return;
  }
  els.travelBox.classList.remove('hidden');
  if (!b) {
    els.travelBox.innerHTML = `
      <div class="measure-title">Régua ativa</div>
      <div class="measure-muted">1º ponto marcado. Clique no mapa para marcar o destino.</div>
    `;
    return;
  }

  const t = computeTravel(a, b);
  if (!t) {
    els.travelBox.innerHTML = `<div class="measure-title">Régua ativa</div><div class="measure-muted">Distância indisponível.</div>`;
    return;
  }

  const custom = computeCustomTravel(t.distKm);
  const value = escapeHtml(state.measure?.customSpeedValue || '');
  const unit = state.measure?.customSpeedUnit || 'kmh';
  const unitOptions = [
    ['kmh', 'km/h'],
    ['ms', 'm/s'],
    ['kmd', 'km/dia']
  ].map(([v, label]) => `<option value="${v}" ${unit === v ? 'selected' : ''}>${label}</option>`).join('');

  els.travelBox.innerHTML = `
    <div class="measure-title">Distância estimada</div>
    <div class="measure-distance">${t.distKm.toFixed(1)} km</div>
    <div class="measure-row"><span>Padrão — 40 km/dia</span><b>${escapeHtml(formatTravel(t.days))}</b></div>
    <div class="measure-custom">
      <label>Velocidade atual</label>
      <div class="measure-speed-row">
        <input id="measureSpeedInput" type="text" inputmode="decimal" placeholder="Ex: 370" value="${value}">
        <select id="measureSpeedUnit">${unitOptions}</select>
        <button id="measureSpeedApply" type="button">Calcular</button>
      </div>
      <div class="measure-result">${custom ? `Tempo nessa velocidade: <b>${escapeHtml(formatTravelPrecise(custom.days))}</b>` : 'Digite uma velocidade e clique em Calcular.'}</div>
    </div>
    <div class="measure-muted">Escala: volta completa do mundo = 4 anos a 40 km/dia.</div>
  `;

  const speedInput = document.getElementById('measureSpeedInput');
  const speedUnit = document.getElementById('measureSpeedUnit');
  const speedApply = document.getElementById('measureSpeedApply');
  const refresh = () => {
    if (!state.measure) state.measure = { on: true, a: null, b: null };
    state.measure.customSpeedValue = speedInput ? speedInput.value : '';
    state.measure.customSpeedUnit = speedUnit ? speedUnit.value : 'kmh';
    try { persistState(); } catch (_) {}
    updateMeasureInfo();
  };
  if (speedInput) {
    speedInput.addEventListener('change', refresh);
    speedInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') refresh(); });
  }
  if (speedUnit) speedUnit.addEventListener('change', refresh);
  if (speedApply) speedApply.addEventListener('click', refresh);
}

function parseSpeedNumber(value) {
  const n = Number(String(value || '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function customSpeedToKmPerDay(value, unit) {
  const n = parseSpeedNumber(value);
  if (!n) return null;
  if (unit === 'ms') return n * 3.6 * 24;
  if (unit === 'kmd') return n;
  return n * 24;
}

function computeCustomTravel(distKm) {
  const kmPerDay = customSpeedToKmPerDay(state.measure?.customSpeedValue, state.measure?.customSpeedUnit);
  if (!kmPerDay) return null;
  return { days: distKm / kmPerDay, kmPerDay };
}

function computeTravel(a, b) {
  const natW = els.worldMap?.naturalWidth || 0;
  const natH = els.worldMap?.naturalHeight || 0;
  if (!natW || !natH) return null;

  const wrapped = shortestWorldDeltaPct(a, b);
  const dxPct = Math.abs(wrapped.dx);
  const dyPct = Math.abs(wrapped.dy);

  const kmPerPercentX = WORLD_CIRCUMFERENCE_KM / 100;
  const kmPerPercentY = WORLD_CIRCUMFERENCE_KM / 100;
  const distKm = Math.hypot(dxPct * kmPerPercentX, dyPct * kmPerPercentY);
  const days = distKm / TRAVEL_KM_PER_DAY;
  return { distKm, days, kmPerPercentX, kmPerPercentY, wrapped };
}

function formatTravel(days) {
  const total = Math.ceil(days);
  const years = Math.floor(total / 365);
  const rem = total % 365;
  const months = Math.floor(rem / 30);
  const d = rem % 30;
  const parts = [];
  if (years) parts.push(`${years} ano(s)`);
  if (months) parts.push(`${months} mês(es)`);
  parts.push(`${d} dia(s)`);
  return `${total} dias (${parts.join(', ')})`;
}

function formatTravelPrecise(days) {
  if (!Number.isFinite(days) || days < 0) return 'indisponível';
  const totalHours = days * 24;
  if (totalHours < 1) {
    const minutes = Math.max(1, Math.ceil(totalHours * 60));
    return `${minutes} minuto(s)`;
  }
  if (days < 1) {
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    return `${hours}h${String(minutes).padStart(2, '0')}`;
  }
  if (days < 30) {
    const d = Math.floor(days);
    const h = Math.round((days - d) * 24);
    return `${d} dia(s) e ${h}h`;
  }
  return formatTravel(days);
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function layerLabel(l) {
  if (l === 'underground') return 'Subterrâneo';
  if (l === 'sky') return 'Aéreo';
  if (l === 'subaquatica') return 'Subaquática';
  if (l === 'abismo') return 'Abismo';
  return 'Superfície';
}

function typeLabel(t) {
  if (t === 'temple') return 'Templo';
  if (t === 'guild_hq') return 'Guilda';
  if (t === 'city_main') return 'Cidade Principal';
  if (t === 'settlement') return 'Assentamento';
  if (t === 'fortress') return 'Fortaleza';
  if (t === 'dungeon') return 'Masmorra';
  if (t === 'underground_entry') return 'Passagem';
  return t || '';
}

function raceLabel(r) {
  const map = {
    humans: 'Humanos', elves: 'Elfos', dwarves: 'Anões', vampires: 'Vampiros', orcs: 'Orcs', nagas: 'Nagas',
    centaurs: 'Centauros', dragons: 'Dragões', demons: 'Demônios', fae: 'Feéricos', giants: 'Gigantes',
    gnomes: 'Gnomos', undead: 'Mortos-vivos', angels: 'Anjos'
  };
  return map[r] || r || '';
}

function seasonFromMonth(month) {
  // Modelo simples (padrão hemisfério sul):
  // 12-2 Verão, 3-5 Outono, 6-8 Inverno, 9-11 Primavera
  if ([12, 1, 2].includes(month)) return 'Verão';
  if ([3, 4, 5].includes(month)) return 'Outono';
  if ([6, 7, 8].includes(month)) return 'Inverno';
  return 'Primavera';
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function hashStringToUint32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadPersistentState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const k of (typeof LEGACY_KEYS !== 'undefined' ? LEGACY_KEYS : [])) {
        raw = localStorage.getItem(k);
        if (raw) break;
      }
    }
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && obj.worldTime) state.worldTime = obj.worldTime;
    if (obj && obj.worldState) state.worldState = obj.worldState;
    if (typeof obj.layer === 'string') state.layer = obj.layer;
    if (typeof obj.race === 'string') state.race = obj.race;
    if (typeof obj.type === 'string') state.type = obj.type;
    if (typeof obj.q === 'string') state.q = obj.q;
    if (typeof obj.preset === 'string') state.preset = obj.preset;
    if (typeof obj.era === 'string') state.era = obj.era;
    if (obj && obj.groupFilter && typeof obj.groupFilter === 'object') state.groupFilter = { enabled: !!obj.groupFilter.enabled, selected: Array.isArray(obj.groupFilter.selected) ? obj.groupFilter.selected : [] };
    if (obj && obj.tagFilter && typeof obj.tagFilter === 'object') state.tagFilter = { enabled: !!obj.tagFilter.enabled, mode: String(obj.tagFilter.mode || 'OR').toUpperCase(), selected: Array.isArray(obj.tagFilter.selected) ? obj.tagFilter.selected : [] };
    if (obj && obj.story && typeof obj.story === 'object') state.story = { active: !!obj.story.active, storyId: obj.story.storyId || null, chapter: Math.max(0, parseInt(obj.story.chapter || '0', 10) || 0), data: null };
    if (obj && obj.geo) state.geo = obj.geo;
    if (obj && obj.routeFilter && typeof obj.routeFilter === 'object') state.routeFilter = { ...state.routeFilter, ...obj.routeFilter };
    if (obj && obj.economy && typeof obj.economy === 'object') state.economy = { modifiers: Array.isArray(obj.economy.modifiers) ? obj.economy.modifiers : [] };
    if (obj && obj.measure && typeof obj.measure === 'object') {
      state.measure = { ...state.measure, customSpeedValue: obj.measure.customSpeedValue || '', customSpeedUnit: obj.measure.customSpeedUnit || 'kmh' };
    }
    if (obj && obj.ui && typeof obj.ui === 'object' && state.ui) {
      if (typeof obj.ui.routeLegendClosed === 'boolean') state.ui.routeLegendClosed = obj.ui.routeLegendClosed;
      if (typeof obj.ui.calendarHudVisible === 'boolean') state.ui.calendarHudVisible = obj.ui.calendarHudVisible;
      // playerExpandedInfo público foi desativado; a liberação agora é por local via Painel GM.
      if (obj.ui.routeLegendPos) state.ui.routeLegendPos = obj.ui.routeLegendPos;
      if (obj.ui.routeInfoPos) state.ui.routeInfoPos = obj.ui.routeInfoPos;
    }
    if (obj && obj.campaign && typeof obj.campaign === 'object') state.campaign = obj.campaign;
    if (typeof obj.climateOn === 'boolean') state.climateOn = obj.climateOn;
    if (typeof obj.hideNoImage === 'boolean') state.hideNoImage = obj.hideNoImage;
    if (typeof obj.dateLock === 'boolean') state.dateLock = obj.dateLock;
    if (typeof obj.uiCollapsed === 'boolean') state.uiCollapsed = obj.uiCollapsed;
    if (typeof obj.showImportantNpcs === 'boolean') state.gm.showImportantNpcs = obj.showImportantNpcs;

    if (Array.isArray(obj.customPins)) state.customPins = obj.customPins;
    if (obj.customCities && typeof obj.customCities === 'object') state.customCities = obj.customCities;
    if (obj.pinOverrides && typeof obj.pinOverrides === 'object') state.pinOverrides = obj.pinOverrides;
    if (obj.merchantState && typeof obj.merchantState === 'object') state.merchantState = obj.merchantState;
  } catch { /* ignore */ }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      worldTime: state.worldTime,
      worldState: state.worldState,
      layer: state.layer,
      race: state.race,
      type: state.type,
      q: state.q,
      preset: state.preset,
      era: state.era,
      groupFilter: state.groupFilter,
      tagFilter: state.tagFilter,
      story: state.story ? { active: !!state.story.active, storyId: state.story.storyId || null, chapter: state.story.chapter || 0 } : null,
      climateOn: state.climateOn,
      hideNoImage: state.hideNoImage,
      dateLock: state.dateLock,
      showImportantNpcs: state.gm.showImportantNpcs,
      uiCollapsed: state.uiCollapsed,
      customPins: state.customPins,
      customCities: state.customCities,
      pinOverrides: state.pinOverrides,
      merchantState: state.merchantState,
      campaign: state.campaign,
      routeFilter: state.routeFilter,
      economy: state.economy,
      measure: { customSpeedValue: state.measure && state.measure.customSpeedValue || '', customSpeedUnit: state.measure && state.measure.customSpeedUnit || 'kmh' },
      ui: {
        calendarHudVisible: !(state.ui && state.ui.calendarHudVisible === false),
        playerExpandedInfo: false,
        routeLegendClosed: !!(state.ui && state.ui.routeLegendClosed),
        routeLegendPos: state.ui && state.ui.routeLegendPos,
        routeInfoPos: state.ui && state.ui.routeInfoPos,
      },
    }));
  } catch { /* ignore */ }
}

async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Falha ao carregar ${path}: ${res.status}`);
  return await res.json();
}


async function loadAdvancedData() {
  // Arquivos opcionais: se não existirem, mantém defaults
  try { state.presets = await loadJson('data/presets.json'); } catch { state.presets = null; }
  try { state.eras = await loadJson('data/eras.json'); } catch { state.eras = null; }
  try { state.routes = await loadJson('data/routes.json'); } catch { state.routes = []; }
  try { state.storiesIndex = await loadJson('data/stories/index.json'); } catch { state.storiesIndex = null; }
  try { const wsData = await loadJson('data/world_state.json'); if (typeof mergeWorldStateFromData === 'function') mergeWorldStateFromData(wsData); } catch { /* optional */ }
}

function normalizePin(p) {
  const out = { ...p };
  if (!out.eras) out.eras = ['current'];
  if (!out.tags) out.tags = [];
  if (!out.group) out.group = (out.territory ? raceLabel(out.territory) : 'Geral');
  // Defaults LOD
  if (typeof out.zoomMin !== 'number') out.zoomMin = defaultZoomMin(out);
  return out;
}

async function loadStory(storyId) {
  if (!storyId) return null;
  try { return await loadJson(`data/stories/${storyId}.json`); } catch { return null; }
}

async function loadPins() {
  // Carrega arquivos avançados (opcionais)
  await loadAdvancedData();
  const basePins = await loadJson('data/pins.json');
  let extraPins = [];
  try { extraPins = await loadJson('data/main_cities_pins.json'); } catch { extraPins = []; }

  // Pins criados via Editor GM ficam em state.customPins (persistidos).
  // Proteção: customPins antigos no localStorage podem duplicar pins canônicos após um patch.
  // Aqui mantemos os pins canônicos e descartamos customPins com mesmo id, mesma cityId ou mesma assinatura visual.
  const canonicalPins = [...basePins, ...extraPins];
  const canonicalIds = new Set(canonicalPins.map(p => p && p.id).filter(Boolean));
  const canonicalCityIds = new Set(canonicalPins.map(p => p && p.cityId).filter(Boolean));
  const pinSignature = (p) => [p?.type||'', p?.layer||'', p?.territory||'', String(p?.name||'').trim().toLowerCase(), Number(p?.x||0).toFixed(2), Number(p?.y||0).toFixed(2)].join('|');
  const canonicalSignatures = new Set(canonicalPins.map(pinSignature));
  const rawCustomPins = Array.isArray(state.customPins) ? state.customPins : [];
  const customPins = rawCustomPins.filter(p => {
    if (!p) return false;
    if (p.id && canonicalIds.has(p.id)) return false;
    if (p.cityId && canonicalCityIds.has(p.cityId)) return false;
    if (canonicalSignatures.has(pinSignature(p))) return false;
    return true;
  });
  if (customPins.length !== rawCustomPins.length) {
    state.customPins = customPins;
    try { persistState(); } catch (_) {}
  }

  // Mescla e aplica overrides de tipo/race/camada, sem alterar o JSON base
  const all = [...canonicalPins, ...customPins].map(p => normalizePin(applyPinOverrides(p)));

  // Dedup de cidades principais por cityId (prioriza pins com 2 imagens + descrição curta).
  // Necessário porque pins criados no GM Editor (customPins) persistem em localStorage e podem duplicar cidades principais.
  const bestCityMainById = new Map();
  const kept = [];
  for (const p of all) {
    const isCityMain = p && p.type === 'city_main' && p.cityId;
    if (!isCityMain) {
      kept.push(p);
      continue;
    }
    const imgs = Array.isArray(p.images) ? p.images.length : 0;
    const has2 = imgs >= 2 ? 10 : 0;
    const hasDesc = (p.description && String(p.description).trim().length > 0) ? 1 : 0;
    const onWorld = (p.layer === 'world') ? 1 : 0;
    const score = has2 + hasDesc + onWorld;

    const prev = bestCityMainById.get(p.cityId);
    if (!prev || score > prev.score) {
      bestCityMainById.set(p.cityId, { pin: p, score });
    }
  }
  // Reinsere os city_main "melhores" no final para garantir clique/visibilidade consistente
  for (const { pin } of bestCityMainById.values()) {
    kept.push(pin);
  }

  state.pins = kept;

  // Geração procedural de rotas (para cobrir todas as raças)
  generateProceduralRoutes();

  // Se o usuário recarregar com Story Mode ativo, recarrega o JSON da história antes de reconstruir o painel.
  if (state.story && state.story.active && state.story.storyId && !state.story.data) {
    const storyData = await loadStory(state.story.storyId);
    if (storyData) state.story.data = storyData;
    else state.story.active = false;
  }
}

function generateProceduralRoutes() {
  // Geração controlada de rotas auxiliares.
  // A versão anterior conectava muitos hubs entre todas as raças e deixava o mapa poluído.
  // Agora a malha automática é interna e discreta; rotas inter-raciais ficam nos dados manuais/canônicos.
  const byTerritory = {};
  for (const p of state.pins) {
    if (!p.territory || !p.layer) continue;
    const key = `${p.layer}|${p.territory}`;
    if (!byTerritory[key]) byTerritory[key] = { main: [], settlement: [], fortress: [], dungeon: [] };
    if (p.type === 'city_main') byTerritory[key].main.push(p);
    else if (p.type === 'settlement') byTerritory[key].settlement.push(p);
    else if (p.type === 'fortress') byTerritory[key].fortress.push(p);
    else if (p.type === 'dungeon') byTerritory[key].dungeon.push(p);
  }

  const newRoutes = [];
  const existingIds = new Set((state.routes || []).map(r => r.id));

  const uniqueParts = (a, b) => Array.from(new Set([a?.territory, b?.territory].filter(Boolean)));
  const dist = (a, b) => {
    if (!a || !b) return Infinity;
    let dx = Math.abs((a.x || 0) - (b.x || 0));
    dx = Math.min(dx, 100 - dx); // mundo horizontalmente circular
    const dy = (a.y || 0) - (b.y || 0);
    return Math.hypot(dx, dy);
  };
  const nearest = (source, list, limit = 1) => {
    return [...(list || [])]
      .filter(p => p && source && p.id !== source.id)
      .sort((a, b) => dist(source, a) - dist(source, b) || String(a.id).localeCompare(String(b.id)))
      .slice(0, limit);
  };

  const createRoute = (pA, pB, type, connectionType) => {
    if (!pA || !pB || pA.id === pB.id) return;
    const id = `${type}__auto__${connectionType}__${pA.id}__${pB.id}`;
    const idRev = `${type}__auto__${connectionType}__${pB.id}__${pA.id}`;
    if (existingIds.has(id) || existingIds.has(idRev)) return;
    existingIds.add(id);
    newRoutes.push({
      id,
      from: pA.id,
      to: pB.id,
      type,
      connectionType,
      generated: true,
      participants: uniqueParts(pA, pB),
      eras: ['current'],
      layer: pA.layer,
      width: (type === 'trade_shadow' ? 0.55 : 0.45),
      opacity: (type === 'trade_shadow' ? 0.62 : 0.52),
      color: TERRITORY_COLORS[pA.territory] || undefined
    });
  };

  for (const key in byTerritory) {
    const group = byTerritory[key];
    const main = [...group.main].sort((a, b) => (a.x - b.x) || String(a.id).localeCompare(String(b.id)));
    const settlements = [...group.settlement];
    const fortresses = [...group.fortress];
    const dungeons = [...group.dungeon];

    // Cidades principais: corrente organizada, não todas contra todas.
    for (let i = 0; i < main.length - 1; i++) {
      createRoute(main[i], main[i + 1], 'trade_internal', 'main-main');
    }

    // Cidades principais para assentamentos próximos.
    for (const cp of main) {
      for (const s of nearest(cp, settlements, 2)) createRoute(cp, s, 'trade_internal', 'main-settlement');
      for (const f of nearest(cp, fortresses, 1)) createRoute(cp, f, 'trade_internal', 'main-fortress');
    }

    // Fortalezas abastecem assentamentos próximos.
    for (const f of fortresses) {
      for (const s of nearest(f, settlements, 1)) createRoute(f, s, 'trade_internal', 'fortress-settlement');
    }

    // Masmorras: poucos pontos de suprimento obscuro por região/camada, para não sujar o mapa.
    for (const d of dungeons.slice(0, 2)) {
      const base = nearest(d, [...fortresses, ...main, ...settlements], 1)[0];
      if (base) createRoute(base, d, 'trade_shadow', 'dungeon-supply');
    }
  }

  // Comércio externo controlado: gera bastante material inter-racial, mas só aparece
  // quando o usuário ativa “comércio externo” ou escolhe esse tipo nos filtros.
  const layerGroups = {};
  for (const p of state.pins) {
    if (!p || !p.layer || !p.territory) continue;
    if (!['city_main', 'fortress', 'settlement'].includes(p.type)) continue;
    const layer = p.layer;
    const terr = p.territory;
    if (!layerGroups[layer]) layerGroups[layer] = {};
    if (!layerGroups[layer][terr]) layerGroups[layer][terr] = [];
    layerGroups[layer][terr].push(p);
  }

  const rankHub = (p) => p.type === 'city_main' ? 0 : (p.type === 'fortress' ? 1 : 2);
  const createExternalRoute = (source, target) => {
    if (!source || !target || source.id === target.id || source.territory === target.territory) return;
    const id = `trade_external__auto__${source.id}__${target.id}`;
    const idRev = `trade_external__auto__${target.id}__${source.id}`;
    if (existingIds.has(id) || existingIds.has(idRev)) return;
    existingIds.add(id);
    const seed = hashStringToUint32(id);
    const oneway = (seed % 5 === 0);
    newRoutes.push({
      id,
      from: source.id,
      to: target.id,
      type: 'trade_external',
      connectionType: 'external-trade',
      generated: true,
      direction: oneway ? 'oneway' : 'both',
      participants: uniqueParts(source, target),
      eras: ['current'],
      layer: source.layer,
      width: 0.5,
      opacity: 0.58,
      color: TERRITORY_COLORS[source.territory] || undefined
    });
  };

  for (const layer of Object.keys(layerGroups)) {
    const territories = Object.keys(layerGroups[layer]).sort();
    const allExternalTargets = [];
    for (const terr of territories) {
      layerGroups[layer][terr].sort((a, b) => rankHub(a) - rankHub(b) || dist(a, b) || String(a.id).localeCompare(String(b.id)));
      allExternalTargets.push(...layerGroups[layer][terr]);
    }

    for (const terr of territories) {
      const anchors = layerGroups[layer][terr].slice(0, 6);
      for (const anchor of anchors) {
        const candidates = allExternalTargets.filter(p => p.territory !== terr && p.layer === anchor.layer);
        for (const target of nearest(anchor, candidates, anchor.type === 'city_main' ? 4 : 2)) {
          createExternalRoute(anchor, target);
        }
      }
    }
  }

  // Garantia canônica de comércio externo: cada par de raças recebe pelo menos 2 rotas comerciais.
  // Elas continuam escondidas no padrão limpo e aparecem pelo filtro “comércio externo”/ponto de vista.
  const territoryGroups = {};
  for (const p of state.pins) {
    if (!p || !p.territory || !p.layer) continue;
    if (!['city_main', 'fortress', 'settlement', 'guild_hq', 'temple'].includes(p.type)) continue;
    if (!territoryGroups[p.territory]) territoryGroups[p.territory] = [];
    territoryGroups[p.territory].push(p);
  }
  for (const terr of Object.keys(territoryGroups)) {
    territoryGroups[terr].sort((a, b) => rankHub(a) - rankHub(b) || String(a.id).localeCompare(String(b.id)));
  }

  const pairKey = (a, b) => [a, b].sort().join('|');
  const pairCounts = {};
  const allKnownRoutes = [...(state.routes || []), ...newRoutes];
  for (const r of allKnownRoutes) {
    const parts = Array.isArray(r.participants) ? r.participants.filter(Boolean) : [];
    if (parts.length < 2) continue;
    const key = pairKey(parts[0], parts[1]);
    pairCounts[key] = (pairCounts[key] || 0) + 1;
  }

  const candidatePairsForTerritories = (terrA, terrB) => {
    const aList = territoryGroups[terrA] || [];
    const bList = territoryGroups[terrB] || [];
    const pairs = [];
    for (const a of aList.slice(0, 10)) {
      for (const b of bList.slice(0, 10)) {
        if (!a || !b || a.id === b.id) continue;
        const sameLayer = a.layer === b.layer;
        const layerBonus = sameLayer ? 0 : 1000;
        pairs.push({ a, b, score: layerBonus + dist(a, b) + rankHub(a) * 0.4 + rankHub(b) * 0.4 });
      }
    }
    return pairs.sort((x, y) => x.score - y.score || String(x.a.id + x.b.id).localeCompare(String(y.a.id + y.b.id)));
  };

  const createGuaranteedExternalRoute = (source, target, index) => {
    if (!source || !target || source.id === target.id || source.territory === target.territory) return false;
    const sameLayer = source.layer === target.layer;
    const id = `trade_external__pair__${source.territory}__${target.territory}__${index}__${source.id}__${target.id}`;
    const idRev = `trade_external__pair__${target.territory}__${source.territory}__${index}__${target.id}__${source.id}`;
    if (existingIds.has(id) || existingIds.has(idRev)) return false;
    existingIds.add(id);
    const seed = hashStringToUint32(id);
    const oneway = (seed % 3 === 0);
    newRoutes.push({
      id,
      from: source.id,
      to: target.id,
      type: 'trade_external',
      connectionType: sameLayer ? 'external-trade' : undefined,
      crossLayer: !sameLayer,
      generated: true,
      direction: oneway ? 'oneway' : 'both',
      participants: uniqueParts(source, target),
      eras: ['current'],
      layer: source.layer,
      width: 0.5,
      opacity: 0.58,
      color: TERRITORY_COLORS[source.territory] || undefined
    });
    return true;
  };

  const territoriesAll = Object.keys(territoryGroups).sort();
  for (let i = 0; i < territoriesAll.length; i++) {
    for (let j = i + 1; j < territoriesAll.length; j++) {
      const terrA = territoriesAll[i];
      const terrB = territoriesAll[j];
      const key = pairKey(terrA, terrB);
      let count = pairCounts[key] || 0;
      if (count >= 2) continue;
      const pairs = candidatePairsForTerritories(terrA, terrB);
      let idx = 0;
      for (const pair of pairs) {
        if (count >= 2) break;
        if (createGuaranteedExternalRoute(pair.a, pair.b, idx++)) count++;
      }
      pairCounts[key] = count;
    }
  }

  state.routes = [...(state.routes || []), ...newRoutes];
}

async function loadCities() {
  try {
    state.cities = await loadJson('data/cities.json');
  } catch {
    state.cities = {};
  }
}

async function loadZones() {
  try {
    state.zones = await loadJson('data/zones.json');
  } catch {
    state.zones = null;
  }
  buildZoneIndex();
}

function polygonAreaCentroid(poly) {
  // poly: [[x,y],...], coordenadas em % (0..100)
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-6) {
    // fallback simples
    const sx = poly.reduce((s, p) => s + p[0], 0);
    const sy = poly.reduce((s, p) => s + p[1], 0);
    return { area: 0, cx: sx / poly.length, cy: sy / poly.length };
  }
  cx /= (6 * a);
  cy /= (6 * a);
  return { area: Math.abs(a), cx, cy };
}

function pointInPolygon(x, y, poly) {
  // Ray casting
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function territoryFromZones(x, y, layer) {
  // Retorna o território (raça) do primeiro polígono que contém o ponto.
  // Usado no Editor GM quando o GM deixa "Território" em auto.
  for (const z of (state.zonePolys || [])) {
    if (z.layer !== layer) continue;
    if (pointInPolygon(x, y, z.poly)) return z.territory || '';
  }
  return '';
}

function buildZoneIndex() {
  state.zonePolys = [];
  if (!state.zones) return;
  // Esperado: zones[layer][territory] = [ [ [x,y],... ], [..] ]
  for (const layer of Object.keys(state.zones)) {
    const terrObj = state.zones[layer] || {};
    for (const territory of Object.keys(terrObj)) {
      const polys = terrObj[territory] || [];
      for (let idx = 0; idx < polys.length; idx++) {
        const poly = polys[idx];
        if (!Array.isArray(poly) || poly.length < 3) continue;
        const { area, cx, cy } = polygonAreaCentroid(poly);
        state.zonePolys.push({ layer, territory, idx, poly, area, cx, cy });
      }
    }
  }
}

function clearZones() {
  if (els.zonesSvg) els.zonesSvg.innerHTML = '';
}

function renderZones() {
  clearZones();
  if (!els.zonesSvg) return;
    els.zonesSvg.setAttribute("viewBox","0 0 100 100");
  els.zonesSvg.setAttribute("preserveAspectRatio","none");
if (!state.geo || !state.geo.territories) return;
  if (!Array.isArray(state.zonePolys)) return;
  const era = state.era || 'current';
  const polys = [];
  for (const z of state.zonePolys) {
    if (z.layer !== state.layer) continue;
    const zEras = Array.isArray(z.eras) ? z.eras : ['all'];
    if (era !== 'all' && !zEras.includes('all') && !zEras.includes(era)) continue;
    const terr = z.territory || '';
    const col = TERRITORY_COLORS[terr] || 'rgba(255,255,255,.6)';
    const pts = (z.poly || []).map(([x, y]) => `${x},${y}`).join(' ');
    if (!pts) continue;
    polys.push(`<polygon points="${pts}" fill="${col}" fill-opacity="0.14" stroke="${col}" stroke-opacity="0.28" stroke-width="0.18"/>`);
  }
  els.zonesSvg.setAttribute('viewBox', '0 0 100 100');
  els.zonesSvg.innerHTML = polys.join('');
}

function applyBordersOverlay() {
  if (!els.bordersOverlay) return;
  const on = !!(state.geo && state.geo.borders);
  els.bordersOverlay.style.opacity = on ? '1' : '0';
}

function findZoneForPoint(layer, x, y, territoryHint = null) {
  const candidates = state.zonePolys.filter(z => z.layer === layer && (!territoryHint || z.territory === territoryHint));
  for (const z of candidates) {
    if (pointInPolygon(x, y, z.poly)) return z;
  }
  // fallback: tenta sem hint
  if (territoryHint) {
    const any = state.zonePolys.filter(z => z.layer === layer);
    for (const z of any) {
      if (pointInPolygon(x, y, z.poly)) return z;
    }
  }
  return null;
}


function applyPinOverrides(pin) {
  const o = state.pinOverrides && pin && state.pinOverrides[pin.id];
  if (!o) return pin;
  return { ...pin, ...o };
}

function pinHasImage(p) {
  return !!(p.images && Array.isArray(p.images) && p.images.length > 0);
}

function applyFilters() {
  const q = state.q.trim().toLowerCase();
  const scale = (state.view && state.view.scale) ? state.view.scale : 1;

  const era = state.era || 'current';
  const showTerrLabels = shouldShowTerritoryLabels();
  // Visual Simplification: se ativo, esconde tudo que não é city_main ou settlement
  const simplify = !!state.simplifyVisuals;

  const groupEnabled = !!(state.groupFilter && state.groupFilter.enabled);
  const selectedGroups = groupEnabled ? new Set(state.groupFilter.selected || []) : null;

  const tagEnabled = !!(state.tagFilter && state.tagFilter.enabled);
  const tagMode = (state.tagFilter && state.tagFilter.mode) ? String(state.tagFilter.mode).toUpperCase() : 'OR';
  const selectedTags = tagEnabled ? new Set(state.tagFilter.selected || []) : null;

  state.filtered = state.pins.filter(p => {
    if (p.layer !== state.layer) return false;
    if (state.type !== 'all' && p.type !== state.type) return false;
    if (state.race !== 'all') {
      if ((p.territory || null) !== state.race) return false;
    }
    if (state.hideNoImage && !pinHasImage(p)) return false;

    // Muito afastado: deixa só cidades principais para não poluir (labels de território entram como overlay separado).
    if (showTerrLabels && p.type !== 'city_main') return false;

    // Simplificação visual (foco em rotas)
    if (simplify && p.type !== 'city_main' && p.type !== 'settlement') return false;

    // Era: pin sem 'eras' é considerado "current"
    const eras = Array.isArray(p.eras) ? p.eras : ['current'];
    if (era && era !== 'all' && !eras.includes('all') && !eras.includes(era)) return false;

    // LOD por zoom (escala): se não existe zoomMin/zoomMax, usa defaults leves
    const zmin = (typeof p.zoomMin === 'number') ? p.zoomMin : defaultZoomMin(p);
    const zmax = (typeof p.zoomMax === 'number') ? p.zoomMax : 10;
    if (scale < zmin || scale > zmax) return false;

    // Grupos
    if (groupEnabled && selectedGroups && selectedGroups.size) {
      const g = p.group || 'Sem grupo';
      if (!selectedGroups.has(g)) return false;
    }

    // Tags
    if (tagEnabled && selectedTags && selectedTags.size) {
      const tags = Array.isArray(p.tags) ? p.tags : [];
      if (tagMode === 'AND') {
        for (const t of selectedTags) {
          if (!tags.includes(t)) return false;
        }
      } else {
        // OR
        let ok = false;
        for (const t of selectedTags) {
          if (tags.includes(t)) { ok = true; break; }
        }
        if (!ok) return false;
      }
    }

    if (q) {
      const hay = `${p.name || ''} ${p.type || ''} ${p.group || ''} ${(p.tags || []).join(' ')} ${p.territory || ''} ${p.description || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function clearPins() {

  els.pins.innerHTML = '';
}

function defaultZoomMin(p) {
  // Ajuste fino: o "scale" inicial do Atlas costuma começar < 1 (para caber o mapa na tela).
  // Portanto, zmins muito altos escondem quase tudo. Mantemos LOD suave.
  if (!p) return 0.35;
  switch (p.type) {
    case 'region_label': return 0.10; // só aparece bem afastado
    case 'city_main': return 0.30;
    case 'city': return 0.38;
    case 'guild_hq': return 0.40;
    case 'temple': return 0.42;
    case 'fortress': return 0.45;
    case 'settlement': return 0.45;
    case 'ruin': return 0.50;
    case 'dungeon': return 0.52;
    default: return 0.45;
  }
}


function getTerritoryLabelCenters() {
  // Calcula um centro "macro" por território (ex.: humans/elves/...) usando centroides ponderados por área.
  const out = new Map();
  if (!Array.isArray(state.zonePolys)) return out;
  for (const z of state.zonePolys) {
    if (z.layer !== state.layer) continue;
    const key = z.territory;
    if (!key) continue;
    const prev = out.get(key) || { w: 0, cx: 0, cy: 0 };
    const w = Math.max(0.0001, Math.abs(z.area || 0));
    prev.w += w;
    prev.cx += (z.cx || 0) * w;
    prev.cy += (z.cy || 0) * w;
    out.set(key, prev);
  }
  // normaliza
  for (const [k, v] of out.entries()) {
    v.cx = v.cx / v.w;
    v.cy = v.cy / v.w;
  }
  return out;
}

function shouldShowTerritoryLabels() {
  const scale = (state.view && state.view.scale) ? state.view.scale : 1;
  // bem afastado: mostra "regiões" (territórios) e reduz pins
  return scale < 0.45;
}

function renderTerritoryLabels(frag) {
  // Renderiza labels grandes por território usando o índice de zonas.
  const centers = getTerritoryLabelCenters();
  for (const [territory, v] of centers.entries()) {
    const el = document.createElement('div');
    el.className = 'pin region-label always-label';
    el.style.left = `${v.cx}%`;
    el.style.top = `${v.cy}%`;
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.opacity = '0.0'; // sem ponto, só label
    el.appendChild(dot);

    const lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = raceLabel(territory);
    el.appendChild(lab);

    frag.appendChild(el);
  }
}
function semanticColor(p) {
  const preset = state.preset || 'default';
  if (typeof getWorldVisionMeta === 'function') {
    const wv = getWorldVisionMeta(p, preset);
    if (wv && wv.color) return wv.color;
  }
  if (preset === 'religion') {
    const k = (p.religion || p.deity || '').toLowerCase();
    const m = {
      'elyndra': '#a6e3a1',
      'gorthak': '#f38ba8',
      'seraphis': '#89b4fa',
      'lysandra': '#f9e2af',
      'solara': '#fab387',
      'noctus': '#b4befe',
      'umbra': '#cba6f7',
      'syrene': '#74c7ec',
    };
    if (m[k]) return m[k];
    return '#cdd6f4';
  }
  if (preset === 'danger') {
    const d = typeof p.danger === 'number' ? p.danger : (typeof p.threat === 'number' ? p.threat : 0);
    // 0..5
    if (d >= 5) return '#ff4757';
    if (d >= 4) return '#ff6b6b';
    if (d >= 3) return '#ffa502';
    if (d >= 2) return '#fbc531';
    if (d >= 1) return '#7bed9f';
    return '#dfe4ea';
  }
  if (preset === 'commerce') {
    const c = (p.trade || p.commerce || '').toLowerCase();
    if (c === 'hub') return '#00a8ff';
    if (c === 'route') return '#00d2d3';
    if (c === 'market') return '#feca57';
    if (c === 'black') return '#c56cf0';
    return '#ffffff';
  }
  // default / political: cores por território
  if (TYPE_COLORS[p.type]) return TYPE_COLORS[p.type];
  if (p.type === 'guild_hq') return TYPE_COLORS.guild_hq;
  return TERRITORY_COLORS[p.territory] || TERRITORY_COLORS[p.group] || '#ffffff';
}

function pinDotColor(p) {
  return semanticColor(p);
}

function captureGmCoordinates(x, y) {
  if (!state.gm || !state.gm.unlocked || !state.gm.captureMode) return false;
  const xx = clamp(Number(x), 0, 100);
  const yy = clamp(Number(y), 0, 100);
  if (els.gmPinX) els.gmPinX.value = xx.toFixed(2);
  if (els.gmPinY) els.gmPinY.value = yy.toFixed(2);
  state.gm.captureMode = false;
  try { if (typeof updateGmCaptureUI === 'function') updateGmCaptureUI(); } catch (_) {}
  try { if (typeof setGmEditorMinimized === 'function') setGmEditorMinimized(false); } catch (_) {}
  try { persistState(); } catch (_) {}
  const hint = document.getElementById('gmCreateHint');
  if (hint) hint.textContent = `Coordenadas capturadas: X ${xx.toFixed(2)} / Y ${yy.toFixed(2)}. Preencha o nome e clique em Criar pin.`;
  return true;
}

function renderPins() {

  clearPins();
  const frag = document.createDocumentFragment();
  // Labels de "regiões" (territórios) quando muito afastado
  if (shouldShowTerritoryLabels()) {
    renderTerritoryLabels(frag);
  }
  for (const p of state.filtered) {
    const el = document.createElement('div');
    el.className = `pin ${p.type}`;
    if (p.alwaysLabel) el.classList.add('always-label');
    el.style.left = `${p.x}%`;
    el.style.top = `${p.y}%`;
    el.dataset.id = p.id;
    if (typeof getWorldVisionMeta === 'function') {
      const wvMeta = getWorldVisionMeta(p, state.preset || 'default');
      if (wvMeta) {
        el.classList.add('world-vision-pin');
        el.classList.add(`wv-${wvMeta.level || 'low'}`);
        if (wvMeta.hasState) el.classList.add('wv-applied');
        else el.classList.add('wv-auto');
      }
    }

    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.backgroundColor = pinDotColor(p);
    el.appendChild(dot);

    const lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = p.name;
    el.appendChild(lab);

    el.addEventListener('mouseenter', (e) => showTooltip(e, p));
    el.addEventListener('mousemove', (e) => showTooltip(e, p));
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.gm && state.gm.unlocked && state.gm.captureMode) {
        captureGmCoordinates(p.x, p.y);
        return;
      }
      if (state.debug) {
        openDebug(p.x, p.y);
        return;
      }
      if (state.measure && state.measure.on) {
        // Permite medir clicando no próprio pin (não abre popup)
        const x = p.x;
        const y = p.y;
        if (!state.measure.a) {
          state.measure.a = [x, y];
          state.measure.b = null;
          drawMeasure();
          if (typeof updateMeasureInfo === 'function') updateMeasureInfo();
          return;
        }
        if (!state.measure.b) {
          state.measure.b = [x, y];
          drawMeasure();
          const t = computeTravel(state.measure.a, state.measure.b);
          if (typeof updateMeasureInfo === 'function') updateMeasureInfo();
          return;
        }
        // 3º clique reinicia
        state.measure.a = [x, y];
        state.measure.b = null;
        drawMeasure();
        if (typeof updateMeasureInfo === 'function') updateMeasureInfo();
        return;
      }
      if (state.gm.unlocked && state.gm.editorOpen) {
        gmSelectPin(p);
        return;
      }
      openLoc(p);
    });

    frag.appendChild(el);
  }
  els.pins.appendChild(frag);
}


const ALL_ROUTE_TYPES = ['trade_internal', 'trade_official', 'trade_shadow', 'trade_external'];
const ROUTE_DEFAULT_CONNECTIONS = ['main-main'];

function clearRoutes() {
  if (els.routesSvg) els.routesSvg.innerHTML = '';
  if (els.routeLegend) {
    els.routeLegend.classList.add('hidden');
    els.routeLegend.innerHTML = '';
  }
  if (typeof hideRouteTooltip === 'function') hideRouteTooltip();
}

function routeParts(r, aPin, bPin) {
  const raw = Array.isArray(r?.participants) ? r.participants : [];
  const parts = [];
  for (const x of raw) if (x && !parts.includes(x)) parts.push(x);
  for (const p of [aPin, bPin]) {
    if (p?.territory && !parts.includes(p.territory)) parts.push(p.territory);
  }
  return parts;
}

function routePinType(p) {
  return p?.kind || p?.type || p?.category || '';
}

function isMainPin(p) { return routePinType(p) === 'city_main'; }
function isFortressPin(p) { return routePinType(p) === 'fortress'; }
function isSettlementPin(p) { return routePinType(p) === 'settlement'; }
function isDungeonPin(p) { return routePinType(p) === 'dungeon'; }
function isTempleOrGuildPin(p) { return ['temple', 'guild_hq'].includes(routePinType(p)); }

function getRouteConnectionType(r, aPin, bPin) {
  if (r?.connectionType) return r.connectionType;
  if (r?.crossLayer || (aPin && bPin && aPin.layer && bPin.layer && aPin.layer !== bPin.layer)) return 'cross-layer';
  if (isDungeonPin(aPin) || isDungeonPin(bPin)) return 'dungeon-supply';
  if (isMainPin(aPin) && isMainPin(bPin)) return 'main-main';
  if ((isMainPin(aPin) && isFortressPin(bPin)) || (isFortressPin(aPin) && isMainPin(bPin))) return 'main-fortress';
  if ((isFortressPin(aPin) && isSettlementPin(bPin)) || (isSettlementPin(aPin) && isFortressPin(bPin))) return 'fortress-settlement';
  if ((isMainPin(aPin) && isSettlementPin(bPin)) || (isSettlementPin(aPin) && isMainPin(bPin))) return 'main-settlement';
  if (isTempleOrGuildPin(aPin) || isTempleOrGuildPin(bPin)) return 'temple-guild';

  const parts = routeParts(r, aPin, bPin);
  if (isSettlementPin(aPin) && isSettlementPin(bPin)) return parts.length >= 2 ? 'settlement-interracial' : 'settlement-settlement';
  if (parts.length >= 2) return 'settlement-interracial';
  return 'internal';
}

function routeConnectionLabel(conn) {
  const m = {
    'main-main': 'Cidade Principal ↔ Cidade Principal',
    'main-fortress': 'Cidade Principal ↔ Fortaleza',
    'main-settlement': 'Cidade Principal ↔ Assentamento',
    'fortress-settlement': 'Fortaleza ↔ Assentamento',
    'settlement-settlement': 'Assentamento ↔ Assentamento',
    'settlement-interracial': 'Assentamento ↔ Assentamento Inter-racial',
    'external-trade': 'Comércio Externo entre Raças',
    'dungeon-supply': 'Masmorras / Suprimento Obscuro',
    'cross-layer': 'Rota Intercamada',
    'temple-guild': 'Templos / Guildas',
    'internal': 'Internas',
    'all': 'Todas'
  };
  return m[conn] || conn || 'Rota';
}

function isRouteOneWay(r) {
  return r?.direction === 'oneway' || r?.direction === 'one-way' || r?.oneway === true || r?.bidirectional === false;
}

function routeDirectionLabel(r) {
  return isRouteOneWay(r) ? 'Unidirecional' : 'Bidirecional';
}

function routeVisualStyle(r, conn) {
  const base = {
    widthPx: (typeof r?.widthPx === 'number') ? r.widthPx : ((typeof r?.width === 'number') ? Math.max(1.2, r.width * 4) : 1.9),
    opacity: (typeof r?.opacity === 'number') ? r.opacity : 0.58,
    dash: '',
    curve: 1.6,
  };

  const byConn = {
    'main-main': { widthPx: 2.35, opacity: 0.68, dash: '', curve: 1.2 },
    'main-fortress': { widthPx: 2.05, opacity: 0.62, dash: '14 7', curve: 1.6 },
    'main-settlement': { widthPx: 1.8, opacity: 0.55, dash: '9 6', curve: 1.4 },
    'fortress-settlement': { widthPx: 1.7, opacity: 0.52, dash: '6 5', curve: 1.2 },
    'settlement-settlement': { widthPx: 1.45, opacity: 0.48, dash: '4 7', curve: 1.0 },
    'settlement-interracial': { widthPx: 1.55, opacity: 0.50, dash: '2 6', curve: 1.4 },
    'external-trade': { widthPx: 1.85, opacity: 0.58, dash: '10 4 2 4', curve: 1.8 },
    'dungeon-supply': { widthPx: 1.75, opacity: 0.64, dash: '2 5', curve: 1.8 },
    'cross-layer': { widthPx: 2.1, opacity: 0.70, dash: '12 4 2 4', curve: 2.2 },
    'temple-guild': { widthPx: 1.65, opacity: 0.55, dash: '1 4', curve: 1.4 },
    'internal': { widthPx: 1.45, opacity: 0.46, dash: '5 7', curve: 0.9 },
  };
  Object.assign(base, byConn[conn] || {});

  if (r?.type === 'trade_shadow') {
    base.widthPx = Math.max(base.widthPx, 1.9);
    base.opacity = Math.max(base.opacity, 0.66);
    base.dash = '2 5';
  } else if (r?.type === 'trade_official' && !base.dash) {
    base.widthPx = Math.max(base.widthPx, 2.05);
  }
  return base;
}

function routeStrokeColor(r, conn) {
  if (r && r.color) return r.color;
  if (conn === 'dungeon-supply') return '#b86b6b';
  if (conn === 'cross-layer') return '#9ad7ff';
  if (conn === 'external-trade') return '#f2c94c';
  const parts = routeParts(r, null, null);
  const terr = parts.length ? parts[0] : (r && r.fromTerritory) || null;
  if (terr && typeof TERRITORY_COLORS === 'object' && TERRITORY_COLORS[terr]) return TERRITORY_COLORS[terr];
  return 'rgba(255,255,255,0.65)';
}

function routeTypeLabel(t) {
  const m = {
    trade_internal: 'Comércio Interno',
    trade_official: 'Comércio Oficial',
    trade_shadow: 'Contrabando / Rotas Obscuras',
    trade_external: 'Comércio Externo',
  };
  return m[t] || t;
}

function routeCurvePath(x1, y1, x2, y2, routeId, conn, curveAmount) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const seed = (typeof hashStringToUint32 === 'function') ? hashStringToUint32(`${routeId || ''}|${conn || ''}`) : 1;
  const sign = (seed % 2 === 0) ? 1 : -1;
  const jitter = ((seed % 7) - 3) * 0.12;
  const amount = (curveAmount || 1.2) + jitter;
  const cx = mx + sign * (-dy / len) * amount;
  const cy = my + sign * (dx / len) * amount;
  return `M ${x1} ${y1} Q ${cx.toFixed(3)} ${cy.toFixed(3)} ${x2} ${y2}`;
}

function routeShouldRender(r, rf, aPin, bPin, conn) {
  const allowedTypes = Array.isArray(rf.types) && rf.types.length ? new Set(rf.types) : new Set(ALL_ROUTE_TYPES);
  if (r.type && !allowedTypes.has(r.type)) return false;

  const parts = routeParts(r, aPin, bPin);
  const allowedRaces = new Set(Array.isArray(rf.races) ? rf.races : []);
  const focus = rf.focusRace || '';

  // Comércio externo: usa a raça de ponto de vista como origem da leitura.
  // Ex.: foco Humanos + raças marcadas Humanos/Elfos/Anões mostra Humanos↔Elfos e Humanos↔Anões,
  // mas não Elfos↔Anões.
  if (rf.externalOnly) {
    if (!focus || !parts.includes(focus)) return false;
    if (parts.length < 2) return false;
    if (allowedRaces.size === 0) return false;
    return parts.every(x => allowedRaces.has(x));
  }

  const selectedConn = Array.isArray(rf.connectionTypes) ? rf.connectionTypes : ROUTE_DEFAULT_CONNECTIONS;
  if (selectedConn.length > 0 && !selectedConn.includes(conn)) return false;

  const viewMode = rf.viewMode || 'strict';
  if (viewMode === 'universal') {
    return !!(focus && parts.includes(focus));
  }

  if (parts.length === 0) return true;
  if (allowedRaces.size === 0) return false;
  return parts.every(x => allowedRaces.has(x));
}

function renderRoutes() {
  clearRoutes();
  if (!els.routesSvg) return;
  els.routesSvg.setAttribute('viewBox', '0 0 100 100');
  els.routesSvg.setAttribute('preserveAspectRatio', 'none');

  const rf = (typeof normalizeRouteFilter === 'function') ? normalizeRouteFilter() : state.routeFilter;
  if (!rf || !rf.enabled) return;

  const era = state.era || 'current';
  const layerPinsById = new Map();
  const allPinsById = new Map();
  for (const p of state.pins) {
    allPinsById.set(p.id, p);
    if (p.layer !== state.layer) continue;
    const eras = Array.isArray(p.eras) ? p.eras : ['current'];
    if (era !== 'all' && !eras.includes('all') && !eras.includes(era)) continue;
    layerPinsById.set(p.id, p);
  }

  const routes = Array.isArray(state.routes) ? state.routes : [];
  const lines = [];
  const defs = `
    <defs>
      <marker id="routeArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L7,3.5 L0,7 Z" fill="rgba(255,255,255,.78)"></path>
      </marker>
    </defs>`;
  lines.push(defs);

  for (const r of routes) {
    const rEras = Array.isArray(r.eras) ? r.eras : ['all'];
    if (era !== 'all' && !rEras.includes('all') && !rEras.includes(era)) continue;

    const aAll = allPinsById.get(r.from);
    const bAll = allPinsById.get(r.to);
    if (!aAll || !bAll) continue;

    const conn = getRouteConnectionType(r, aAll, bAll);
    const isCrossLayer = conn === 'cross-layer';

    // Rotas normais aparecem só na camada dos dois pins. Rotas intercamada aparecem na camada declarada da rota
    // ou na camada de uma das pontas.
    if (isCrossLayer) {
      const allowedLayers = new Set([r.layer, aAll.layer, bAll.layer].filter(Boolean));
      if (!allowedLayers.has(state.layer)) continue;
    } else {
      if (r.layer && r.layer !== state.layer) continue;
      if (aAll.layer !== state.layer || bAll.layer !== state.layer) continue;
    }

    if (!routeShouldRender(r, rf, aAll, bAll, conn)) continue;

    let pts = null;
    if (Array.isArray(r.path) && r.path.length >= 2) {
      pts = r.path;
    } else if (r.fromTerritory && r.toTerritory) {
      const centers = getTerritoryLabelCenters();
      const ca = centers.get(r.fromTerritory);
      const cb = centers.get(r.toTerritory);
      if (!ca || !cb) continue;
      pts = [[ca.cx, ca.cy], [cb.cx, cb.cy]];
    } else {
      pts = [[aAll.x, aAll.y], [bAll.x, bAll.y]];
    }

    const style = routeVisualStyle(r, conn);
    const stroke = routeStrokeColor(r, conn);
    const dashAttr = style.dash ? ` stroke-dasharray="${style.dash}"` : '';
    const arrowAttr = isRouteOneWay(r) ? ' marker-end="url(#routeArrow)"' : '';
    const common = `class="route-line route-conn-${escapeHtml(conn)}" data-routeid="${escapeHtml(r.id || '')}" data-from="${escapeHtml(r.from || '')}" data-to="${escapeHtml(r.to || '')}" data-type="${escapeHtml(r.type || '')}" data-connection="${escapeHtml(conn)}" data-direction="${isRouteOneWay(r) ? 'oneway' : 'both'}" stroke="${stroke}" stroke-width="${style.widthPx}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${style.opacity}"${dashAttr}${arrowAttr}`;

    if (pts.length === 2) {
      const [[x1, y1], [x2, y2]] = pts;
      const dx = x2 - x1;
      if (Math.abs(dx) > 50) {
        // Mantém o tratamento de borda do mapa-múndi. É linha simples para evitar caminho atravessando o mapa inteiro.
        let x2a = x2;
        if (dx > 0) x2a = x2 - 100; else x2a = x2 + 100;
        const boundary = x2a < 0 ? 0 : 100;
        const t = (boundary - x1) / (x2a - x1);
        const yb = y1 + (y2 - y1) * t;
        const other = (boundary === 0) ? 100 : 0;
        lines.push(`<line ${common} x1="${x1}" y1="${y1}" x2="${boundary}" y2="${yb}" />`);
        lines.push(`<line ${common} x1="${other}" y1="${yb}" x2="${x2}" y2="${y2}" />`);
      } else {
        const d = routeCurvePath(x1, y1, x2, y2, r.id, conn, style.curve);
        lines.push(`<path ${common} d="${d}" fill="none" />`);
      }
    } else {
      const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
      lines.push(`<path ${common} d="${d}" fill="none" />`);
    }
  }

  els.routesSvg.innerHTML = lines.join('');
  els.routesSvg.querySelectorAll('.route-line').forEach(routeEl => {
    routeEl.addEventListener('mousemove', (ev) => showRouteTooltip(ev, routeEl));
    routeEl.addEventListener('mouseleave', () => hideRouteTooltip());
    routeEl.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openRouteInfo(routeEl);
    });
  });
  renderRouteLegend();
  if (state.ui && state.ui.openRouteId && els.routeInfo && !els.routeInfo.classList.contains('hidden')) {
    const selected = Array.from(els.routesSvg.querySelectorAll('.route-line')).find(el => el.dataset.routeid === state.ui.openRouteId);
    if (selected) openRouteInfo(selected);
    else { els.routeInfo.classList.add('hidden'); els.routeInfo.innerHTML = ''; state.ui.openRouteId = null; }
  }
}

function renderRouteLegend() {
  if (!els.routeLegend) return;
  const rf = state.routeFilter;
  if (!rf || !rf.enabled || (state.ui && state.ui.routeLegendClosed)) {
    els.routeLegend.classList.add('hidden');
    els.routeLegend.innerHTML = '';
    return;
  }

  let selectedConn = Array.isArray(rf.connectionTypes) ? rf.connectionTypes : ROUTE_DEFAULT_CONNECTIONS;
  let conns = selectedConn.length ? selectedConn : ['main-main', 'main-fortress', 'main-settlement', 'fortress-settlement', 'external-trade', 'dungeon-supply', 'cross-layer'];
  if (rf.externalOnly) conns = ['external-trade'];
  const viewText = rf.externalOnly
    ? `Comércio externo: ${raceLabel(rf.focusRace)} como ponto de vista`
    : (rf.viewMode === 'universal'
      ? `Visão universal: ${raceLabel(rf.focusRace)}`
      : 'Modo restrito: todas as raças da rota precisam estar marcadas');

  const items = conns.slice(0, 8).map(conn => {
    const style = routeVisualStyle({}, conn);
    const stroke = routeStrokeColor({}, conn);
    const dashAttr = style.dash ? `stroke-dasharray="${style.dash}"` : '';
    return `
      <div class="item">
        <div class="swatch">
          <svg viewBox="0 0 34 10" preserveAspectRatio="none" aria-hidden="true">
            <line x1="2" y1="5" x2="32" y2="5" stroke="${stroke}" stroke-width="2.2" ${dashAttr}></line>
          </svg>
        </div>
        <div>
          <div class="label">${escapeHtml(routeConnectionLabel(conn))}</div>
        </div>
      </div>
    `;
  });

  els.routeLegend.classList.remove('hidden');
  els.routeLegend.innerHTML = `
    <div class="floating-head route-legend-head">
      <div class="title">Rotas</div>
      <button class="floating-close" type="button" id="routeLegendCloseBtn" title="Fechar legenda">×</button>
    </div>
    <div class="desc" style="margin-bottom:7px;opacity:.82;">${escapeHtml(viewText)}</div>
    <div class="items">${items.join('')}</div>
  `;
  const close = document.getElementById('routeLegendCloseBtn');
  if (close) close.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (state.ui) state.ui.routeLegendClosed = true;
    els.routeLegend.classList.add('hidden');
    els.routeLegend.innerHTML = '';
    try { persistState(); } catch (_) {}
  });
  makeFloatingPanelDraggable(els.routeLegend, '.route-legend-head', 'routeLegendPos');
}

function renderList() {
  els.list.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const p of state.filtered.slice(0, 500)) {
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

function getUnzoomedStagePoint(e) {
  const rect = els.mapStage.getBoundingClientRect();
  const mx = (e.clientX - rect.left);
  const my = (e.clientY - rect.top);
  const s = Math.max(0.0001, state.view.scale || 1);
  const ux = (mx - state.view.panX) / s;
  const uy = (my - state.view.panY) / s;
  return { ux, uy };
}

function showTooltip(ev, p) {
  // Tooltip posicionado no viewport do mapa (coordenadas de tela), robusto em qualquer zoom
  const cont = els.mapContainer || document.getElementById('mapContainer');
  if (!cont || !els.tooltip) return;
  const rect = cont.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const terr = p.territory ? ` • ${raceLabel(p.territory)}` : '';
  const wvLine = (typeof getWorldVisionTooltipLine === 'function') ? getWorldVisionTooltipLine(p) : '';
  els.tooltip.classList.remove('hidden');
  const left = Math.min(Math.max(8, x + 14), Math.max(8, rect.width - 260));
  const top = Math.min(Math.max(8, y + 14), Math.max(8, rect.height - 110));
  els.tooltip.innerHTML = `
    <div class="box" style="left:${left}px; top:${top}px;">
      <div class="tname">${escapeHtml(p.name)}</div>
      <div class="tmeta">${escapeHtml(typeLabel(p.type))} • ${escapeHtml(layerLabel(p.layer))}${escapeHtml(terr)}</div>
      ${wvLine ? `<div class="tmeta wv-tooltip-line">${escapeHtml(wvLine)}</div>` : ''}
    </div>
  `;
}

function hideTooltip() {
  els.tooltip.classList.add('hidden');
  els.tooltip.innerHTML = '';
}


// ---- Rotas: tooltip e painel de info (clique) ----
function routeDateKey() {
  const wt = (state && state.worldTime) ? state.worldTime : { day: 1, month: 1, year: 1 };
  const mm = String(wt.month || 1).padStart(2, '0');
  const dd = String(wt.day || 1).padStart(2, '0');
  return `${wt.year || 1}-${mm}-${dd}`;
}

function getRouteById(id) {
  return (state.routes || []).find(r => r && r.id === id) || null;
}

function routeDisplayName(r, fromName, toName, conn) {
  if (r && r.name) return r.name;
  const prefix = {
    'main-main': 'Grande Via Comercial',
    'main-fortress': 'Rota de Abastecimento Militar',
    'main-settlement': 'Caminho Mercantil',
    'fortress-settlement': 'Linha de Suprimentos',
    'settlement-settlement': 'Estrada Local',
    'settlement-interracial': 'Travessia de Fronteira',
    'external-trade': 'Rota Externa',
    'dungeon-supply': 'Trilha Obscura de Suprimento',
    'cross-layer': 'Passagem Intercamada',
    'temple-guild': 'Via de Patronos'
  }[conn] || 'Rota Comercial';
  return `${prefix}: ${fromName} → ${toName}`;
}

function activeEconomyLabels() {
  const names = {
    war: 'guerra', bandits: 'bandidos', guild_thieves: 'guilda de ladrões', disaster: 'desastre',
    plague: 'praga', blockade: 'bloqueio comercial', famine: 'escassez', monster_surge: 'monstros',
    corruption: 'corrupção', high_taxes: 'impostos altos', peace: 'paz', bumper_crop: 'colheita farta',
    trade_agreement: 'acordo comercial', festival: 'festival', new_mine: 'nova mina', magic_abundance: 'abundância mágica',
    guild_support: 'apoio da guilda', road_safety: 'estradas seguras', innovation: 'inovação', low_taxes: 'impostos baixos'
  };
  const mods = (state.economy && Array.isArray(state.economy.modifiers)) ? state.economy.modifiers : [];
  return mods.map(m => names[m] || m);
}

function routeRiskProfile(r, conn) {
  let score = 30;
  if (conn === 'dungeon-supply') score += 34;
  if (conn === 'cross-layer') score += 18;
  if (conn === 'external-trade') score += 12;
  if (r && r.type === 'trade_shadow') score += 22;
  if (isRouteOneWay(r)) score += 6;

  const mods = (state.economy && Array.isArray(state.economy.modifiers)) ? state.economy.modifiers : [];
  const negative = ['war', 'bandits', 'guild_thieves', 'disaster', 'plague', 'blockade', 'famine', 'monster_surge', 'corruption', 'high_taxes'];
  const positive = ['peace', 'bumper_crop', 'trade_agreement', 'festival', 'new_mine', 'magic_abundance', 'guild_support', 'road_safety', 'innovation', 'low_taxes'];
  for (const m of mods) {
    if (negative.includes(m)) score += (m === 'war' || m === 'blockade' || m === 'famine') ? 14 : 8;
    if (positive.includes(m)) score -= (m === 'peace' || m === 'road_safety' || m === 'trade_agreement') ? 10 : 5;
  }

  const seed = hashStringToUint32(`${r?.id || ''}|${routeDateKey()}|risk`);
  score += (seed % 25) - 12;
  score = clamp(score, 5, 100);

  let label = 'Segura';
  let tone = 'safe';
  let note = 'Patrulhas e fluxo mercantil estável.';
  if (score >= 78) { label = 'Extremamente perigosa'; tone = 'deadly'; note = 'Ataques, bloqueios e perdas são prováveis.'; }
  else if (score >= 58) { label = 'Perigosa'; tone = 'danger'; note = 'Exige escolta, cautela e bom planejamento.'; }
  else if (score >= 38) { label = 'Instável'; tone = 'warn'; note = 'Funciona, mas pode sofrer atrasos e emboscadas.'; }
  return { score, label, tone, note };
}

function routeFlavorText(r, conn, risk) {
  if (conn === 'dungeon-supply') return 'Comércio obscuro, usado por exploradores, atravessadores e grupos que lucram com ruínas perigosas.';
  if (conn === 'cross-layer') return 'Rota especial entre camadas do mundo; depende de passagens, portais, túneis ou travessias raras.';
  if (conn === 'external-trade') return 'Comércio externo entre raças, sujeito a política, fronteiras e relações diplomáticas.';
  if (risk.score >= 58) return 'A rota continua ativa, mas mercadores evitam viajar sem proteção.';
  return 'Rota em operação regular, com fluxo previsível de caravanas e mensageiros.';
}

function routeTravelEstimateText(aPin, bPin, route) {
  if (!aPin || !bPin || typeof aPin.x !== 'number' || typeof bPin.x !== 'number') return null;
  let dx = Math.abs((aPin.x || 0) - (bPin.x || 0));
  dx = Math.min(dx, 100 - dx);
  const dy = Math.abs((aPin.y || 0) - (bPin.y || 0));
  const kmPerPercent = WORLD_CIRCUMFERENCE_KM / 100;
  const distKm = Math.hypot(dx * kmPerPercent, dy * kmPerPercent);
  const days = distKm / TRAVEL_KM_PER_DAY;
  let note = 'Estimativa por comitiva comum a 40 km/dia.';
  if (days > 120) note = 'Rota longa: caravanas costumam usar postos intermediários, escoltas reforçadas, navegação mágica ou atalhos arcanos controlados.';
  else if (days > 45) note = 'Rota extensa: o deslocamento costuma exigir comboio, suprimentos e paradas seguras.';
  else if (route && route.type === 'trade_shadow') note = 'Rotas clandestinas raramente seguem linha reta; o tempo real pode ser maior por desvios e ocultação.';
  return { distKm, days, label: `${distKm.toFixed(0)} km • ${formatTravel(days)}`, note };
}

function makeFloatingPanelDraggable(panel, handleSelector, stateKey) {
  if (!panel) return;
  const pos = state.ui && state.ui[stateKey];
  if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
    panel.style.left = `${pos.left}px`;
    panel.style.top = `${pos.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }
  const handle = panel.querySelector(handleSelector);
  if (!handle) return;
  handle.onpointerdown = (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest('button')) return;
    ev.preventDefault();
    const rect = panel.getBoundingClientRect();
    const startX = ev.clientX;
    const startY = ev.clientY;
    const baseLeft = rect.left;
    const baseTop = rect.top;
    panel.style.left = `${baseLeft}px`;
    panel.style.top = `${baseTop}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.classList.add('is-dragging');
    try { handle.setPointerCapture(ev.pointerId); } catch (_) {}

    const move = (e) => {
      const nextLeft = clamp(baseLeft + (e.clientX - startX), 8, Math.max(8, window.innerWidth - rect.width - 8));
      const nextTop = clamp(baseTop + (e.clientY - startY), 8, Math.max(8, window.innerHeight - rect.height - 8));
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
    };
    const up = () => {
      panel.classList.remove('is-dragging');
      const finalRect = panel.getBoundingClientRect();
      if (state.ui) state.ui[stateKey] = { left: finalRect.left, top: finalRect.top };
      try { persistState(); } catch (_) {}
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
}

function getPinNameById(id) {
  const p = (state.pins || []).find(x => x && x.id === id);
  return p ? p.name : id || '';
}

function showRouteTooltip(ev, routeEl) {
  if (!els.routeTooltip) return;
  const cont = els.mapContainer || document.getElementById('mapContainer') || document.body;
  const rect = cont.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;

  const rid = routeEl?.dataset?.routeid || '';
  const from = routeEl?.dataset?.from || '';
  const to = routeEl?.dataset?.to || '';
  const type = routeEl?.dataset?.type || '';
  const conn = routeEl?.dataset?.connection || '';
  const direction = routeEl?.dataset?.direction === 'oneway' ? 'Unidirecional' : 'Bidirecional';

  const left = Math.min(Math.max(8, x + 14), Math.max(8, rect.width - 330));
  const top = Math.min(Math.max(8, y + 14), Math.max(8, rect.height - 120));

  els.routeTooltip.classList.remove('hidden');
  els.routeTooltip.style.left = `${rect.left + left}px`;
  els.routeTooltip.style.top = `${rect.top + top}px`;

  els.routeTooltip.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(getPinNameById(from))} → ${escapeHtml(getPinNameById(to))}</div>
    <div style="opacity:.92;">${escapeHtml(routeTypeLabel(type))}</div>
    <div style="opacity:.82;">${escapeHtml(routeConnectionLabel(conn))} • ${escapeHtml(direction)}</div>
  `;
}

function hideRouteTooltip() {
  if (!els.routeTooltip) return;
  els.routeTooltip.classList.add('hidden');
  els.routeTooltip.innerHTML = '';
}

function openRouteInfo(routeEl) {
  if (!els.routeInfo) return;
  const from = routeEl?.dataset?.from || '';
  const to = routeEl?.dataset?.to || '';
  const type = routeEl?.dataset?.type || '';
  const conn = routeEl?.dataset?.connection || '';
  const rid = routeEl?.dataset?.routeid || '';
  const route = getRouteById(rid) || { id: rid, from, to, type };
  const direction = isRouteOneWay(route) ? 'Unidirecional' : 'Bidirecional';
  const fromName = getPinNameById(from);
  const toName = getPinNameById(to);
  const aPin = (state.pins || []).find(x => x && x.id === from) || null;
  const bPin = (state.pins || []).find(x => x && x.id === to) || null;
  const travel = routeTravelEstimateText(aPin, bPin, route);
  const risk = routeRiskProfile(route, conn);
  const routeState = route && route.routeState ? route.routeState : null;
  const econ = activeEconomyLabels();
  const routeName = routeDisplayName(route, fromName, toName, conn);
  const flavor = routeFlavorText(route, conn, risk);

  if (state.ui) state.ui.openRouteId = rid;
  els.routeInfo.classList.remove('hidden');
  els.routeInfo.innerHTML = `
    <div class="floating-head ri-head">
      <div>
        <div class="ri-kicker">Rota Comercial</div>
        <div class="ri-title">${escapeHtml(routeName)}</div>
      </div>
      <button class="floating-close" type="button" id="routeInfoCloseBtn" title="Fechar">×</button>
    </div>
    <div class="ri-route-points">${escapeHtml(fromName)} <span>→</span> ${escapeHtml(toName)}</div>
    <div class="ri-row"><span>Tipo</span><span class="ri-badge">${escapeHtml(routeTypeLabel(type))}</span></div>
    <div class="ri-row"><span>Conexão</span><span class="ri-badge">${escapeHtml(routeConnectionLabel(conn))}</span></div>
    <div class="ri-row"><span>Direção</span><span class="ri-badge">${escapeHtml(direction)}</span></div>
    ${routeState ? `<div class="ri-row"><span>Estado base</span><span class="ri-badge">${escapeHtml(routeState.status || 'regular')}</span></div><div class="ri-note">Fluxo: ${escapeHtml(routeState.tradeFlow || 'regular')}. ${escapeHtml(routeState.note || '')}</div>` : ''}
    ${travel ? `<div class="ri-row"><span>Deslocamento médio</span><span class="ri-badge">${escapeHtml(travel.label)}</span></div><div class="ri-note">${escapeHtml(travel.note)}</div>` : ''}
    <div class="ri-risk ${escapeHtml(risk.tone)}">
      <span>Risco atual</span><b>${escapeHtml(risk.label)}</b>
    </div>
    <div class="ri-note">${escapeHtml(risk.note)}</div>
    <div class="ri-flavor">${escapeHtml(flavor)}</div>
    ${econ.length ? `<div class="ri-econ"><b>Influências econômicas:</b> ${escapeHtml(econ.join(', '))}</div>` : `<div class="ri-econ muted">Sem situações econômicas marcadas.</div>`}
  `;
  const btn = document.getElementById('routeInfoCloseBtn');
  if (btn) btn.addEventListener('click', () => {
    if (state.ui) state.ui.openRouteId = null;
    els.routeInfo.classList.add('hidden');
    els.routeInfo.innerHTML = '';
  });
  makeFloatingPanelDraggable(els.routeInfo, '.ri-head', 'routeInfoPos');
}



function renderNpcSectionForLoc(p) {
  const fixed = Array.isArray(p.npcsFixed) ? p.npcsFixed : [];
  const important = Array.isArray(p.npcsImportant) ? p.npcsImportant : [];
  const showImportant = !!(state && state.gm && state.gm.showImportantNpcs);

  // rolagem determinística por data do mundo + id do pin
  function dateKey() {
    const wt = (state && state.worldTime) ? state.worldTime : { day: 1, month: 1, year: 1 };
    const mm = String(wt.month).padStart(2, '0');
    const dd = String(wt.day).padStart(2, '0');
    return `${wt.era || 'fourth_age'}-${wt.year}-${mm}-${dd}`;
  }
  function pickImportant(list) {
    if (!showImportant || !list.length) return [];
    const seed = hashStringToUint32(dateKey() + '|' + (p.id || '') + '|imp');
    const rnd = mulberry32(seed);
    const x = rnd();
    const n = (x < 0.08) ? 2 : (x < 0.22) ? 1 : 0; // ocasionalmente 1 ou 2
    return list.slice(0, n);
  }

  const impPick = pickImportant(important);
  const campaignImportant = showImportant && state.campaign && Array.isArray(state.campaign.importantNpcs)
    ? state.campaign.importantNpcs.filter(n => {
        const raw = String(n.pinId || n.pin || n.localId || n.locationId || n.where || n.local || '').toLowerCase();
        return raw && (raw === String(p.id || '').toLowerCase() || raw === String(p.name || '').toLowerCase());
      })
    : [];

  const esc = (s) => escapeHtml(String(s || ''));
  const li = (n) => `<li><b>${esc(n.name || n.nome)}</b> — ${esc(n.role || n.papel || n.function || '')}</li>`;
  const fixedHtml = fixed.length ? `<div class="npc-section"><div class="npc-title"><b>NPCs do Local</b></div><ul class="npc-list">${fixed.map(li).join('')}</ul></div>` : '';
  const impHtml = impPick.length ? `<div class="npc-section"><div class="npc-title"><b>NPCs Importantes (ocasionais)</b></div><ul class="npc-list">${impPick.map(li).join('')}</ul></div>` : '';
  const campaignImpHtml = campaignImportant.length ? `<div class="npc-section"><div class="npc-title"><b>NPCs Importantes da Campanha</b></div><ul class="npc-list">${campaignImportant.map(li).join('')}</ul></div>` : '';
  return fixedHtml + impHtml + campaignImpHtml;
}



function renderSecretSectionForLoc(p) {
  const show = !!(state && state.gm && state.gm.unlocked);
  if (!show) return '';
  const txt = p && p.secretDetails ? String(p.secretDetails) : '';
  const imp = Array.isArray(p && p.secretImportantNpcs) ? p.secretImportantNpcs : [];
  function dateKey() {
    const wt = (state && state.worldTime) ? state.worldTime : { day: 1, month: 1, year: 1 };
    const mm = String(wt.month).padStart(2, '0');
    const dd = String(wt.day).padStart(2, '0');
    return `${wt.era || 'fourth_age'}-${wt.year}-${mm}-${dd}`;
  }
  function pickImportant(list) {
    if (!list.length) return [];
    const seed = hashStringToUint32(dateKey() + '|' + (p.id || '') + '|secimp');
    const rnd = mulberry32(seed);
    const x = rnd();
    const n = (x < 0.10) ? 2 : (x < 0.28) ? 1 : 0;
    return list.slice(0, n);
  }
  const impPick = pickImportant(imp);
  const esc = (s) => escapeHtml(String(s || ''));
  const li = (n) => `<li><b>${esc(n.name || n.nome)}</b> — ${esc(n.role || n.papel || '')}</li>`;
  const impHtml = impPick.length ? `<div class="npc-section"><div class="npc-title"><b>NPCs Importantes (segredos)</b></div><ul class="npc-list">${impPick.map(li).join('')}</ul></div>` : '';
  const body = txt ? renderStructuredDetails(txt) : '';

  const camp = state.campaign || {};
  const secretRec = (camp.pinSecrets && (camp.pinSecrets[p.id] || camp.pinSecrets[p.name])) || null;
  const hookRec = (camp.hooks && (camp.hooks[p.id] || camp.hooks[p.name])) || null;
  function renderAny(title, rec) {
    if (!rec) return '';
    if (typeof rec === 'string') return `<div class="subsection"><div class="subhead">${esc(title)}</div><div class="subtext">${esc(rec).replace(/\n/g, '<br>')}</div></div>`;
    if (Array.isArray(rec)) return `<div class="subsection"><div class="subhead">${esc(title)}</div><ul class="bullets">${rec.map(x => `<li>${esc(typeof x === 'string' ? x : (x.title || x.titulo || JSON.stringify(x)))}</li>`).join('')}</ul></div>`;
    if (typeof rec === 'object') {
      const rows = Object.entries(rec).map(([k,v]) => {
        const val = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
        return `<div class="meta-item"><div class="meta-k">${esc(k)}</div><div class="meta-v">${esc(val).replace(/\n/g, '<br>')}</div></div>`;
      }).join('');
      return `<div class="subsection"><div class="subhead">${esc(title)}</div><div class="meta-grid">${rows}</div></div>`;
    }
    return '';
  }
  const campaignSecretHtml = renderAny('Segredos da campanha', secretRec);
  const campaignHooksHtml = renderAny('Ganchos ativos', hookRec);

  if (!impHtml && !body && !campaignSecretHtml && !campaignHooksHtml) return '';
  return `<div class="secret-box"><div class="secret-title">Segredos (GM)</div>${impHtml}${body}${campaignSecretHtml}${campaignHooksHtml}</div>`;
}


function renderStructuredDetails(txt) {
  if (!txt) return '';
  const lines = String(txt).replace(/\r/g, '').split('\n');
  const sections = [];
  let current = { title: null, lines: [] };
  const push = () => {
    if (current.title !== null || current.lines.length) {
      sections.push(current);
    }
    current = { title: null, lines: [] };
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = line.match(/^\[([A-ZÇÃÕÁÉÍÓÚÜ0-9 _-]+)\]\s*$/i);
    if (m) {
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
  for (const s of sections) {
    if (s.title === 'DADOS' && !data) {
      const entries = [];
      for (const ln of s.lines) {
        const t = ln.trim();
        if (!t) continue;
        const kv = t.split(':');
        if (kv.length >= 2) {
          const k = kv.shift().trim();
          const v = kv.join(':').trim();
          if (k && v) entries.push([k, v]);
        }
      }
      if (entries.length) data = entries;
      continue;
    }
    rest.push(s);
  }

  const esc = escapeHtml;

  let html = '';
  if (data && data.length) {
    html += `<div class="meta-grid">` + data.map(([k, v]) =>
      `<div class="meta-item"><div class="meta-k">${esc(k)}</div><div class="meta-v">${esc(v)}</div></div>`
    ).join('') + `</div>`;
  }

  for (const s of rest) {
    const contentLines = s.lines.map(l => l).join('\n').trim();
    if (!contentLines) continue;

    // For RUMORES: bullets into list when possible
    if (s.title === 'RUMORES') {
      const items = contentLines.split('\n').map(x => x.trim()).filter(Boolean).map(x => x.replace(/^[•\-]\s*/, ''));
      html += `<div class="subsection"><div class="subhead">${esc(s.title)}</div><ul class="bullets">` +
        items.map(it => `<li>${esc(it)}</li>`).join('') + `</ul></div>`;
      continue;
    }

    // Default: paragraphs with line breaks
    const paras = contentLines.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    html += `<div class="subsection">` + (s.title ? `<div class="subhead">${esc(s.title)}</div>` : '') +
      paras.map(p => `<div class="subtext">${esc(p).replace(/\n/g, '<br>')}</div>`).join('') +
      `</div>`;
  }

  return html;
}


// ---- Inteligência Local: rumores, reputação, controle político e perigo ----
function renderAtlasIntelligenceForLoc(obj, opts = {}) {
  if (!obj) return '';
  const esc = escapeHtml;
  const danger = obj.dangerProfile || null;
  const pol = obj.politicalControl || null;
  const rep = obj.reputation || null;
  const rumors = obj.localRumors || null;
  const gmUnlocked = !!(state && state.gm && state.gm.unlocked);

  const dangerHtml = danger ? `
    <div class="intel-card danger-${esc(String(danger.level || '').toLowerCase())}">
      <div class="intel-k">Nível de perigo</div>
      <div class="intel-v"><b>${esc(danger.level || 'Moderado')}</b>${danger.score ? ` <span class="badge">${esc(String(danger.score))}/100</span>` : ''}</div>
      ${danger.reason ? `<div class="intel-note">${esc(danger.reason)}</div>` : ''}
    </div>` : '';

  const politicalHtml = pol ? `
    <div class="intel-card">
      <div class="intel-k">Controle político</div>
      <div class="intel-v"><b>${esc(pol.controller || 'Autoridade local')}</b></div>
      <div class="intel-note">${esc(pol.realm || 'Eldralore')} • ${esc(pol.mode || 'influência local')} • ${esc(pol.stability || 'estável')}</div>
      ${pol.notes ? `<div class="intel-note">${esc(pol.notes)}</div>` : ''}
    </div>` : '';

  let repHtml = '';
  if (rep && Array.isArray(rep.factions) && rep.factions.length) {
    repHtml = `<div class="intel-card"><div class="intel-k">Reputação local</div>` +
      rep.factions.slice(0, 4).map(f => `<div class="rep-row"><span>${esc(f.name || f.id || 'Facção')}</span><b>${esc(f.status || rep.default || 'Neutro')}</b></div>${f.note ? `<div class="intel-note small">${esc(f.note)}</div>` : ''}`).join('') +
      `</div>`;
  }

  let rumorsHtml = '';
  if (typeof renderDynamicRumorsHtml === 'function') {
    rumorsHtml = renderDynamicRumorsHtml(obj, gmUnlocked);
  } else if (rumors && (Array.isArray(rumors.public) || Array.isArray(rumors.gm))) {
    const pub = Array.isArray(rumors.public) ? rumors.public.filter(Boolean) : [];
    const gm = gmUnlocked && Array.isArray(rumors.gm) ? rumors.gm.filter(Boolean) : [];
    const pubHtml = pub.length ? `<div class="intel-rumor-title">Rumores públicos</div><ul class="bullets">${pub.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
    const gmHtml = gm.length ? `<div class="intel-rumor-title gm-only">Rumores GM</div><ul class="bullets gm-only">${gm.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
    if (pubHtml || gmHtml) rumorsHtml = `<div class="intel-card wide">${pubHtml}${gmHtml}</div>`;
  }

  const groupRepHtml = (typeof renderGroupReputationHtml === 'function') ? renderGroupReputationHtml(obj) : '';
  const html = [dangerHtml, politicalHtml, repHtml, groupRepHtml, rumorsHtml].filter(Boolean).join('');
  return html ? `<div class="intel-section"><div class="intel-title">Informações regionais</div><div class="intel-grid">${html}</div></div>` : '';
}

function closeAtlasMobileShells(){
  try{
    document.body.classList.remove('mobile-controls-open','mobile-sidebar-open');
    const mb = document.getElementById('mobileBackdrop');
    if(mb) mb.hidden = true;
  }catch(_){}
}

function openLoc(p) {
  closeAtlasMobileShells();
  hideTooltip();
  if (state && state.ui) state.ui.openLocId = (p && p.id) ? p.id : null;
  els.modalTitle.textContent = p.name || 'Local';
  const meta = [
    typeLabel(p.type),
    layerLabel(p.layer),
    p.territory ? raceLabel(p.territory) : null,
  ].filter(Boolean).join(' • ');
  els.modalMeta.textContent = meta;

  const desc = p.description || '';
  const more = p.details || '';
  const expandedReleased = (typeof isExpandedInfoReleasedForPin === 'function') ? isExpandedInfoReleasedForPin(p) : false;
  const showPlayerExpanded = !!(state.gm && state.gm.unlocked) || expandedReleased;

  const climateText = climateTextForPoint(p.layer, p.x, p.y, p.territory || null);
  const npcHtml = renderNpcSectionForLoc(p);
  const worldVisionHtml = (typeof renderWorldVisionForPin === 'function') ? renderWorldVisionForPin(p) : '';
  const intelHtml = (typeof renderAtlasIntelligenceForLoc === 'function') ? renderAtlasIntelligenceForLoc(p) : '';
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

  // View estruturada: cidades, assentamentos e fortalezas usam o mesmo motor interno.
  const hasCityView = !!p.cityId;
  const openLabel = p.type === 'fortress' ? 'Abrir fortaleza' : (p.type === 'settlement' ? 'Abrir assentamento' : (p.type === 'temple' ? 'Abrir templo' : (p.type === 'guild_hq' ? 'Abrir guilda' : 'Abrir cidade')));
  const cityBtn = hasCityView
    ? `<button type="button" class="btn" data-city="${escapeHtml(p.cityId)}">${escapeHtml(openLabel)}</button>`
    : '';

  els.modalBody.innerHTML = `
    <div class="section">
      <div class="desc">${escapeHtml(desc)}</div>
      <div class="climate"><b>Clima</b>: ${escapeHtml(climateText)}</div>
      ${worldVisionHtml}
      ${intelHtml}
      ${npcHtml}
      ${imgHtml}
      ${vidHtml}
      ${(more && showPlayerExpanded) ? `<div class=\"details\">${renderStructuredDetails(more)}</div>` : (more ? `<div class=\"hint\">Info expandida oculta pelo GM.</div>` : '')}
      ${secretToggleHtml}
      ${secretWrapHtml}
    </div>
    <div class="modal-actions">
      ${cityBtn}
    </div>
  `;

  const btn = els.modalBody.querySelector('[data-city]');
  if (btn) {
    btn.addEventListener('click', () => {
      openCity(btn.getAttribute('data-city'));
    });
  }
  const secretBtn = els.modalBody.querySelector('[data-gm-secret]');
  if (secretBtn) {
    secretBtn.addEventListener('click', () => {
      const box = els.modalBody.querySelector('.gm-secret');
      if (!box) return;
      box.classList.toggle('hidden');
    });
  }

  els.locBackdrop.classList.remove('hidden');
}

function closeLoc() {
  if (state && state.ui) state.ui.openLocId = null;

  els.locBackdrop.classList.add('hidden');
}

function openDebug(x, y) {
  els.debugBody.innerHTML = `
    <div class="debug-row"><b>x</b>: ${x.toFixed(2)}</div>
    <div class="debug-row"><b>y</b>: ${y.toFixed(2)}</div>
    <div class="hint" style="margin-top:10px;">Use esses valores no formato <code>x,y</code>.</div>
  `;
  els.debugBackdrop.classList.remove('hidden');
}

function closeDebug() {
  els.debugBackdrop.classList.add('hidden');
}

function closeCity() {
  state.ui.cityOpenId = null;
  state.ui.selectedPlaceId = null;
  state.ui.selectedMerchantId = null;
  els.cityBackdrop.classList.add('hidden');
}

function getPercentFromEvent(e) {
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

function closeOnBackdropClick(backdropEl, closeFn) {
  backdropEl.addEventListener('click', (e) => {
    if (e.target === backdropEl) closeFn();
  });
}



function rebuildAdvancedPanel() {
  // Presets/eras UI
  if (els.presetSelect) els.presetSelect.value = state.preset || 'default';
  if (els.eraSelect) els.eraSelect.value = state.era || 'current';

  // Groups: coleta de groups existentes
  const groupSet = new Set();
  for (const p of state.pins) {
    const g = p.group || 'Sem grupo';
    groupSet.add(g);
  }
  const groups = Array.from(groupSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  if (els.groupFilters) {
    els.groupFilters.innerHTML = '';
    for (const g of groups) {
      const chip = document.createElement('div');
      chip.className = 'adv-chip';
      chip.textContent = g;
      const selected = (state.groupFilter && Array.isArray(state.groupFilter.selected) && state.groupFilter.selected.includes(g));
      if (selected) chip.classList.add('is-on');
      chip.addEventListener('click', () => {
        if (!state.groupFilter) state.groupFilter = { enabled: true, selected: [] };
        state.groupFilter.enabled = true;
        const arr = new Set(state.groupFilter.selected || []);
        if (arr.has(g)) arr.delete(g); else arr.add(g);
        state.groupFilter.selected = Array.from(arr);
        persistState();
        rebuildAdvancedPanel();
        update();
      });
      els.groupFilters.appendChild(chip);
    }
  }

  // Tags: coleta e ordena
  const tagSet = new Set();
  for (const p of state.pins) {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    for (const t of tags) tagSet.add(t);
  }
  const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const tagQuery = (els.tagSearchInput && els.tagSearchInput.value) ? els.tagSearchInput.value.trim().toLowerCase() : '';
  if (els.tagFilters) {
    els.tagFilters.innerHTML = '';
    for (const t of tags) {
      if (tagQuery && !t.toLowerCase().includes(tagQuery)) continue;
      const chip = document.createElement('div');
      chip.className = 'adv-chip';
      chip.textContent = routeTypeLabel(t);
      const selected = (state.tagFilter && Array.isArray(state.tagFilter.selected) && state.tagFilter.selected.includes(t));
      if (selected) chip.classList.add('is-on');
      chip.addEventListener('click', () => {
        if (!state.tagFilter) state.tagFilter = { enabled: true, mode: 'OR', selected: [] };
        state.tagFilter.enabled = true;
        const arr = new Set(state.tagFilter.selected || []);
        if (arr.has(t)) arr.delete(t); else arr.add(t);
        state.tagFilter.selected = Array.from(arr);
        persistState();
        rebuildAdvancedPanel();
        update();
      });
      els.tagFilters.appendChild(chip);
    }
  }

  if (els.tagModeSelect) {
    els.tagModeSelect.value = (state.tagFilter && state.tagFilter.mode) ? state.tagFilter.mode : 'OR';
  }


  // Geopolítica (overlay leve, sem depender de dados extras)
  if (els.geoToggles) {
    els.geoToggles.innerHTML = '';
    const items = [
      { key: 'territories', label: 'Territórios' },
      { key: 'borders', label: 'Fronteiras' },
    ];
    for (const it of items) {
      const chip = document.createElement('div');
      chip.className = 'adv-chip';
      chip.textContent = it.label;
      const on = !!(state.geo && state.geo[it.key]);
      if (on) chip.classList.add('is-on');
      chip.addEventListener('click', () => {
        if (!state.geo) state.geo = { territories: false, borders: true };
        state.geo[it.key] = !state.geo[it.key];
        applyBordersOverlay();
        persistState();
        rebuildAdvancedPanel();
        update();
      });
      els.geoToggles.appendChild(chip);
    }
  }

  if (els.routeTypeFiltersAdv) {
    const types = ALL_ROUTE_TYPES;
    els.routeTypeFiltersAdv.innerHTML = '';
    for (const t of types) {
      const chip = document.createElement('div');
      chip.className = 'adv-chip';
      chip.textContent = routeTypeLabel(t);
      const on = (state.routeFilter && Array.isArray(state.routeFilter.types) && state.routeFilter.types.includes(t));
      if (on) chip.classList.add('is-on');
      chip.addEventListener('click', () => {
        if (typeof normalizeRouteFilter === 'function') normalizeRouteFilter();
        else if (!state.routeFilter) state.routeFilter = { enabled: false, types: [...types], participants: [] };
        const set = new Set(state.routeFilter.types || []);
        if (set.has(t)) set.delete(t); else set.add(t);
        state.routeFilter.types = Array.from(set);
        persistState();
        rebuildAdvancedPanel();
        update();
      });
      els.routeTypeFiltersAdv.appendChild(chip);
    }
  }


  // Participantes das rotas (por raça/parte envolvida)
  if (els.routePartyFiltersAdv) {
    const types = ALL_ROUTE_TYPES;
    const parts = ['humans', 'dwarves', 'elves', 'vampires', 'fae', 'gnomes', 'dragons', 'nagas', 'centaurs', 'undead', 'orcs', 'angels', 'demons', 'giants'];
    els.routePartyFiltersAdv.innerHTML = '';
    for (const r of parts) {
      const chip = document.createElement('div');
      chip.className = 'adv-chip';
      chip.textContent = raceLabel(r) || r;
      const on = (state.routeFilter && Array.isArray(state.routeFilter.races || state.routeFilter.participants) && (state.routeFilter.races || state.routeFilter.participants).includes(r));
      if (on) chip.classList.add('is-on');
      chip.addEventListener('click', () => {
        if (typeof normalizeRouteFilter === 'function') normalizeRouteFilter();
        else if (!state.routeFilter) state.routeFilter = { enabled: false, types: [...types], participants: [] };
        const set = new Set(state.routeFilter.races || state.routeFilter.participants || []);
        if (set.has(r)) set.delete(r); else set.add(r);
        state.routeFilter.races = Array.from(set);
        state.routeFilter.participants = Array.from(set);
        persistState();
        rebuildAdvancedPanel();
        update();
      });
      els.routePartyFiltersAdv.appendChild(chip);
    }
  }

  // Stories
  if (els.storySelect) {
    els.storySelect.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— selecione —';
    els.storySelect.appendChild(opt0);
    const idx = state.storiesIndex;
    const stories = idx && Array.isArray(idx.stories) ? idx.stories : [];
    for (const s of stories) {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.title || s.id;
      els.storySelect.appendChild(o);
    }
    els.storySelect.value = state.story?.storyId || '';
  }

  if (els.storyChapterLabel) {
    const ch = state.story?.chapter || 0;
    const total = Array.isArray(state.story?.data?.chapters) ? state.story.data.chapters.length : 0;
    els.storyChapterLabel.textContent = state.story?.active ? `Capítulo: ${ch + 1}${total ? `/${total}` : ''}` : '';
  }
  if (els.storyText) {
    const story = state.story;
    const chapters = Array.isArray(story?.data?.chapters) ? story.data.chapters : [];
    const ch = story?.active ? chapters[story.chapter || 0] : null;
    if (ch) {
      els.storyText.innerHTML = `<div><b>${escapeHtml(ch.title || '')}</b></div><div style="margin-top:6px">${escapeHtml(ch.text || '')}</div>`;
    } else {
      els.storyText.innerHTML = '';
    }
  }
}

async function startStory(storyId) {
  const s = await loadStory(storyId);
  if (!s) { alert('Story não encontrado.'); return; }
  state.story = { active: true, storyId, chapter: 0, data: s };
  applyStoryChapter();
  persistState();
}

function stopStory() {
  if (state.story) state.story.active = false;
  persistState();
  rebuildAdvancedPanel();
  update();
}

function applyStoryChapter() {
  const story = state.story;
  if (!story || !story.active || !story.data) return;
  const chapters = Array.isArray(story.data.chapters) ? story.data.chapters : [];
  const ch = chapters[story.chapter] || null;
  if (!ch) return;

  // Aplica filtros sugeridos pelo capítulo
  if (ch.preset) state.preset = ch.preset;
  if (ch.era) state.era = ch.era;
  if (ch.routes !== undefined) {
    if (!state.routeFilter) state.routeFilter = { enabled: false, types: [...ALL_ROUTE_TYPES], participants: [] };
    state.routeFilter.enabled = !!ch.routes;
  }

  if (ch.groups) {
    state.groupFilter = { enabled: true, selected: ch.groups.slice(0) };
  }
  if (ch.tags) {
    state.tagFilter = { enabled: true, mode: (ch.tagMode || 'OR').toUpperCase(), selected: ch.tags.slice(0) };
  }

  // Sincroniza controles visíveis quando o capítulo altera visão/era.
  if (els.presetSelect && state.preset) els.presetSelect.value = state.preset;
  if (els.eraSelect && state.era) els.eraSelect.value = state.era;

  // Texto
  if (els.storyText) {
    els.storyText.innerHTML = `<div><b>${escapeHtml(ch.title || '')}</b></div><div style="margin-top:6px">${escapeHtml(ch.text || '')}</div>`;
  }

  rebuildAdvancedPanel();
  update();
}

function storyPrev() {
  if (!state.story || !state.story.active) return;
  state.story.chapter = Math.max(0, (state.story.chapter || 0) - 1);
  applyStoryChapter();
  persistState();
}

function storyNext() {
  if (!state.story || !state.story.active) return;
  const total = Array.isArray(state.story.data?.chapters) ? state.story.data.chapters.length : 0;
  state.story.chapter = Math.min(Math.max(0, total - 1), (state.story.chapter || 0) + 1);
  applyStoryChapter();
  persistState();
}
