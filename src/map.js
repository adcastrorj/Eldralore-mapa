// ---- Zoom/Pan (aplicado na camada #mapZoomLayer) ----
function applyZoom() {
  if (!els.mapZoomLayer) return;
  const { scale, panX, panY } = state.view;
  els.mapZoomLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  // Pins: mantém tamanho visual razoável conforme zoom (evita ficar gigante em zoom alto)
  const inv = 1 / (scale || 1);
  const pinScale = Math.max(0.35, Math.min(1, inv));
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
  const bx = b ? b[0] : ax;
  const by = b ? b[1] : ay;
  const line = `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="rgba(255,255,255,.85)" stroke-width="0.35" />`;
  const ca = `<circle cx="${ax}" cy="${ay}" r="0.8" fill="rgba(122,167,255,.95)" stroke="rgba(0,0,0,.55)" stroke-width="0.25" />`;
  const cb = b ? `<circle cx="${bx}" cy="${by}" r="0.8" fill="rgba(255,200,90,.95)" stroke="rgba(0,0,0,.55)" stroke-width="0.25" />` : '';
  els.measureSvg.innerHTML = line + ca + cb;
}

function computeTravel(a, b) {
  const natW = els.worldMap?.naturalWidth || 0;
  const natH = els.worldMap?.naturalHeight || 0;
  if (!natW || !natH) return null;

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
    if (obj && obj.geo) state.geo = obj.geo;
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

  // Pins criados via Editor GM ficam em state.customPins (persistidos)
  const customPins = Array.isArray(state.customPins) ? state.customPins : [];

  // Mescla e aplica overrides de tipo/race/camada, sem alterar o JSON base
  const all = [...basePins, ...extraPins, ...customPins].map(p => normalizePin(applyPinOverrides(p)));

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
}

function generateProceduralRoutes() {
  // Gera rotas comerciais se não existirem manualmente, replicando o padrão:
  // 1. Cidades Principais (CP) conectadas entre si (rede interna).
  // 2. CP conectam com 4 Assentamentos da mesma raça.
  // 3. 2 CPs e 1 Assentamento conectam com todas as outras raças (Comércio Oficial/Ilegal).

  // Agrupa por layer e territorio
  const byTerritory = {};
  for (const p of state.pins) {
    if (!p.territory || !p.layer) continue;
    const key = `${p.layer}|${p.territory}`;
    if (!byTerritory[key]) byTerritory[key] = { main: [], set: [] };
    if (p.type === 'city_main') byTerritory[key].main.push(p);
    if (p.type === 'settlement') byTerritory[key].set.push(p);
  }

  const newRoutes = [];
  const existingIds = new Set(state.routes.map(r => r.id));

  // Helper para criar rota
  const createRoute = (pA, pB, type, customColor = null) => {
    if (!pA || !pB || pA.id === pB.id) return;
    const id = `${type}__${pA.id}__${pB.id}`;
    const idRev = `${type}__${pB.id}__${pA.id}`;
    if (existingIds.has(id) || existingIds.has(idRev)) return;

    // Evita duplicatas na mesma passada
    existingIds.add(id);

    newRoutes.push({
      id,
      from: pA.id,
      to: pB.id,
      type,
      participants: [pA.territory, pB.territory],
      eras: ['current'],
      layer: pA.layer,
      width: (type === 'trade_shadow' ? 0.55 : 0.45),
      opacity: (type === 'trade_shadow' ? 0.7 : 0.6),
      color: customColor || undefined
    });
  };

  // 1. Intra-raça
  for (const key in byTerritory) {
    const { main, set } = byTerritory[key];
    const terr = key.split('|')[1];

    // Conecta todas as CPs entre si
    for (let i = 0; i < main.length; i++) {
      for (let j = i + 1; j < main.length; j++) {
        createRoute(main[i], main[j], 'trade_internal');
      }
    }

    // Conecta CPs a 4 Assentamentos (random)
    // Se seed fixo for desejado, usar mulberry32. Aqui usaremos Math.random por simplicidade, 
    // mas idealmente seria determinístico baseada no ID.
    // Para estabilidade visual, vamos usar um pseudo-random baseado no ID.
    const pseudoRandom = (str) => {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
      return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h >>> 0) / 4294967296;
      }
    };

    for (const cp of main) {
      if (set.length === 0) continue;
      const rng = pseudoRandom(cp.id);
      // embaralha indices
      const indices = set.map((_, i) => i).sort(() => rng() - 0.5);
      const limit = Math.min(4, indices.length);
      for (let k = 0; k < limit; k++) {
        createRoute(cp, set[indices[k]], 'trade_internal');
      }
    }
  }

  // 2. Inter-raça
  const keys = Object.keys(byTerritory);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const kA = keys[i];
      const kB = keys[j];
      const tA = kA.split('|')[1];
      const tB = kB.split('|')[1];
      const lA = kA.split('|')[0];
      const lB = kB.split('|')[0];

      // Apenas mesma layer (simplificação inicial)
      if (lA !== lB) continue;

      const groupA = byTerritory[kA];
      const groupB = byTerritory[kB];

      if (groupA.main.length === 0 && groupA.set.length === 0) continue;
      if (groupB.main.length === 0 && groupB.set.length === 0) continue;

      // Seleciona 2 CPs e 1 Set como "hubs" de cada lado
      const getHubs = (g) => {
        const rng = (g.main[0] || g.set[0]) ? (g.main[0] || g.set[0]).id.length : 123; // seed simples
        const allMain = [...g.main].sort((a, b) => a.id.localeCompare(b.id)); // sort estável
        const allSet = [...g.set].sort((a, b) => a.id.localeCompare(b.id));

        // Pega 2 primeiros main (ou o que tiver)
        const hubs = [];
        if (allMain.length > 0) hubs.push(allMain[0]);
        if (allMain.length > 1) hubs.push(allMain[allMain.length - 1]); // pega pontas
        // Pega 1 set
        if (allSet.length > 0) hubs.push(allSet[Math.floor(allSet.length / 2)]);
        return hubs;
      };

      const hubsA = getHubs(groupA);
      const hubsB = getHubs(groupB);

      // Conecta hubs entre si
      for (const ha of hubsA) {
        for (const hb of hubsB) {
          // 80% oficial, 20% shadow
          const isShadow = ((ha.id.length + hb.id.length) % 10) > 7;
          createRoute(ha, hb, isShadow ? 'trade_shadow' : 'trade_official');
        }
      }
    }
  }

  // Adiciona ao state
  state.routes = [...state.routes, ...newRoutes];
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
      if (state.measure && state.measure.on) {
        // Permite medir clicando no próprio pin (não abre popup)
        const x = p.x;
        const y = p.y;
        if (!state.measure.a) {
          state.measure.a = [x, y];
          state.measure.b = null;
          drawMeasure();
          return;
        }
        if (!state.measure.b) {
          state.measure.b = [x, y];
          drawMeasure();
          const t = computeTravel(state.measure.a, state.measure.b);
          if (t && els.travelBox) {
            els.travelBox.innerHTML = `Distância estimada: <b>${t.distKm.toFixed(1)} km</b><br/>Tempo (a ${TRAVEL_KM_PER_DAY} km/dia): <b>${escapeHtml(formatTravel(t.days))}</b>`;
          }
          return;
        }
        // 3º clique reinicia
        state.measure.a = [x, y];
        state.measure.b = null;
        drawMeasure();
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


const ALL_ROUTE_TYPES = ['trade_internal', 'trade_official', 'trade_shadow'];

function clearRoutes() {
  if (els.routesSvg) els.routesSvg.innerHTML = '';
}

function renderRoutes() {
  clearRoutes();
  if (!els.routesSvg) return;
    els.routesSvg.setAttribute("viewBox","0 0 100 100");
  els.routesSvg.setAttribute("preserveAspectRatio","none");
const rf = state.routeFilter;
  if (!rf || !rf.enabled) return;
  const allowed = new Set(rf.types || []);
  const era = state.era || 'current';

  // Filtros Avançados de Rotas
  const allowedConn = new Set(rf.connectionTypes || ['main-main', 'main-settlement', 'inter-race']);
  // Se rf.races vazio, assume todas? Na logica do core definimos que populamos tudo.
  // Mas se for null/undefined, safe fallback.
  const allowedRaces = new Set(rf.races || []); // Se vazio aqui, significa NENHUMA (pois populamos no core)

  // Fallback safe: se races array estiver vazio E connectionTypes tbm vazio, talvez seja init.
  // Mas vamos confiar no state.

  const pinsById = new Map();
  for (const p of state.pins) {
    if (p.layer !== state.layer) continue;
    const eras = Array.isArray(p.eras) ? p.eras : ['current'];
    if (era !== 'all' && !eras.includes('all') && !eras.includes(era)) continue;
    pinsById.set(p.id, p);
  }

  const routes = Array.isArray(state.routes) ? state.routes : [];
  const lines = [];

  // desenha linha com wrap horizontal (mundo em globo) para evitar rotas “sumindo” ao cruzar bordas
  function pushLineWrapped(x1, y1, x2, y2, attrs) {
    const dx = x2 - x1;
    if (Math.abs(dx) <= 50) {
      lines.push(`<line ${attrs} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`);
      return;
    }
    // Ajusta x2 para o lado mais próximo
    let x2a = x2;
    if (dx > 0) x2a = x2 - 100; else x2a = x2 + 100;
    const boundary = x2a < 0 ? 0 : 100;
    const t = (boundary - x1) / (x2a - x1);
    const yb = y1 + (y2 - y1) * t;
    // Segmento 1 até a borda
    lines.push(`<line ${attrs} x1="${x1}" y1="${y1}" x2="${boundary}" y2="${yb}" />`);
    // Segmento 2 do outro lado
    const other = (boundary === 0) ? 100 : 0;
    lines.push(`<line ${attrs} x1="${other}" y1="${yb}" x2="${x2}" y2="${y2}" />`);
  }

  for (const r of routes) {
    if (r.layer && r.layer !== state.layer) continue;
    const rEras = Array.isArray(r.eras) ? r.eras : ['all'];
    if (era !== 'all' && !rEras.includes('all') && !rEras.includes(era)) continue;
    if (r.type && !allowed.has(r.type)) continue;
    let pts = null;
    // Participantes: permite filtrar rotas por raça/parte envolvida
    if (rf && Array.isArray(rf.participants) && rf.participants.length) {
      const pset = new Set(rf.participants);
      const rparts = Array.isArray(r.participants) ? r.participants : [];
      let okPart = false;
      for (const rp of rparts) { if (pset.has(rp)) { okPart = true; break; } }
      if (!okPart) continue;
    }

    // Tipo de Conexão (categorias específicas)
    // connectionTypes vazio => sem restrição (mostra todas)
    if (rf && Array.isArray(rf.connectionTypes) && rf.connectionTypes.length) {
      const allowedConn = new Set(rf.connectionTypes);

      const aPin = pinsById.get(r.from);
      const bPin = pinsById.get(r.to);
      const aIsMain = !!(aPin && (aPin.kind === 'city_main' || aPin.type === 'city_main' || aPin.category === 'city_main'));
      const bIsMain = !!(bPin && (bPin.kind === 'city_main' || bPin.type === 'city_main' || bPin.category === 'city_main'));

      const rparts = Array.isArray(r.participants) ? r.participants : [];
      const multiRace = rparts.length >= 2;

      // Classificação
      let connType = 'main-settlement';
      if (aIsMain && bIsMain) {
        connType = 'main-main';
      } else if (aIsMain || bIsMain) {
        connType = 'main-settlement';
      } else {
        // Nenhum endpoint é cidade principal
        connType = multiRace ? 'settlement-interracial' : 'internal';
      }

      // Compatibilidade com valor antigo 'inter-race'
      if (allowedConn.has('inter-race')) {
        // 'inter-race' historicamente significava: qualquer rota com múltiplas raças
        if (!multiRace) continue;
      } else {
        if (!allowedConn.has(connType)) continue;
      }
    }


    if (Array.isArray(r.path) && r.path.length >= 2) {
      pts = r.path; // [[x,y],...]
    } else if (r.fromTerritory && r.toTerritory) {
      const centers = getTerritoryLabelCenters();
      const ca = centers.get(r.fromTerritory);
      const cb = centers.get(r.toTerritory);
      if (!ca || !cb) continue;
      pts = [[ca.cx, ca.cy], [cb.cx, cb.cy]];
    } else {
      const a = pinsById.get(r.from);
      const b = pinsById.get(r.to);
      if (!a || !b) continue;
      pts = [[a.x, a.y], [b.x, b.y]];
    }

    const stroke = routeStrokeColor(r);
    const opacity = (typeof r.opacity === 'number') ? r.opacity : 0.72;

    // Stroke em px (não escala com zoom): evita sumir em zoom out e ficar grosso em zoom in
    const widthPx = (typeof r.widthPx === 'number') ? r.widthPx :
      (r.type === 'trade_shadow' ? 2.4 : (r.type === 'trade_internal' ? 1.6 : 2.0));

    // Dash bem visível (especialmente no zoom out)
    const dash = (r.type === 'trade_shadow') ? '10 7' :
      (r.type === 'trade_internal' ? '6 8' : '');


    // coords percentuais no viewport (0..100)
    // constrói SVG (linha ou polilinha)
    if (pts.length === 2) {
      const [[x1, y1], [x2, y2]] = pts;
      const dashAttr = dash ? ` stroke-dasharray="${dash}"` : ``;
      const attrs = `data-routeid="${escapeHtml(r.id || '')}" data-from="${escapeHtml(r.from || '')}" data-to="${escapeHtml(r.to || '')}" data-type="${escapeHtml(r.type || '')}" stroke="${stroke}" stroke-width="${widthPx}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${opacity}"${dashAttr}`;
      pushLineWrapped(x1, y1, x2, y2, attrs);
    } else {
      const d = pts.map(([x, y]) => `${x},${y}`).join(' ');
      const dashAttr = dash ? ` stroke-dasharray="${dash}"` : ``;
      lines.push(`<polyline data-routeid="${escapeHtml(r.id || '')}" data-from="${escapeHtml(r.from || '')}" data-to="${escapeHtml(r.to || '')}" data-type="${escapeHtml(r.type || '')}" points="${d}" fill="none" stroke="${stroke}" stroke-width="${widthPx}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${opacity}"${dashAttr} />`);
    }
  }
  // viewBox 0..100 para coordenadas percentuais
  els.routesSvg.setAttribute('viewBox', '0 0 100 100');
  els.routesSvg.setAttribute('preserveAspectRatio', 'none');
  els.routesSvg.innerHTML = lines.join('');
  renderRouteLegend();
}

function routeStrokeColor(r) {
  // Prefer explicit color (routes generated to match raça/território)
  if (r && r.color) return r.color;
  const parts = (r && Array.isArray(r.participants)) ? r.participants : [];
  const terr = parts.length ? parts[0] : (r && r.fromTerritory) || null;
  if (terr && typeof TERRITORY_COLORS === 'object' && TERRITORY_COLORS[terr]) return TERRITORY_COLORS[terr];
  return 'rgba(255,255,255,0.65)';
}

function routeTypeLabel(t) {
  const m = {
    trade_internal: 'Comércio Interno',
    trade_official: 'Comércio Oficial',
    trade_shadow: 'Contrabando / Rotas Obscuras',
  };
  return m[t] || t;
}

function renderRouteLegend() {
  if (!els.routeLegend) return;
  const rf = state.routeFilter;
  if (!rf || !rf.enabled) {
    els.routeLegend.classList.add('hidden');
    els.routeLegend.innerHTML = '';
    return;
  }
  const enabledTypes = Array.isArray(rf.types) ? rf.types : ALL_ROUTE_TYPES;
  const items = [];
  const meta = {
    trade_internal: { desc: 'Conexões dentro do território (cidades principais + assentamentos).', dash: '1.2 2.2' },
    trade_official: { desc: 'Rotas oficiais entre raças e capitais comerciais.', dash: '' },
    trade_shadow: { desc: 'Contrabando, rotas obscuras e acordos não declarados.', dash: '3 2' },
  };
  for (const t of ALL_ROUTE_TYPES) {
    if (!enabledTypes.includes(t)) continue;
    const col = routeStrokeColor(t);
    const dash = meta[t]?.dash || '';
    const dashAttr = dash ? `stroke-dasharray="${dash}"` : '';
    items.push(`
      <div class="item">
        <div class="swatch">
          <svg viewBox="0 0 34 10" preserveAspectRatio="none" aria-hidden="true">
            <line x1="2" y1="5" x2="32" y2="5" stroke="${col}" stroke-width="2.2" ${dashAttr}></line>
          </svg>
        </div>
        <div>
          <div class="label">${escapeHtml(routeTypeLabel(t))}</div>
          <div class="desc">${escapeHtml(meta[t]?.desc || '')}</div>
        </div>
      </div>
    `);
  }
  els.routeLegend.classList.remove('hidden');
  els.routeLegend.innerHTML = `
    <div class="title">Rotas</div>
    <div class="items">${items.join('')}</div>
  `;
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
  els.tooltip.classList.remove('hidden');
  const left = Math.min(Math.max(8, x + 14), Math.max(8, rect.width - 260));
  const top = Math.min(Math.max(8, y + 14), Math.max(8, rect.height - 110));
  els.tooltip.innerHTML = `
    <div class="box" style="left:${left}px; top:${top}px;">
      <div class="tname">${escapeHtml(p.name)}</div>
      <div class="tmeta">${escapeHtml(typeLabel(p.type))} • ${escapeHtml(layerLabel(p.layer))}${escapeHtml(terr)}</div>
    </div>
  `;
}

function hideTooltip() {
  els.tooltip.classList.add('hidden');
  els.tooltip.innerHTML = '';
}


// ---- Rotas: tooltip e painel de info (clique) ----
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

  const left = Math.min(Math.max(8, x + 14), Math.max(8, rect.width - 330));
  const top = Math.min(Math.max(8, y + 14), Math.max(8, rect.height - 120));

  els.routeTooltip.classList.remove('hidden');
  els.routeTooltip.style.left = `${rect.left + left}px`;
  els.routeTooltip.style.top = `${rect.top + top}px`;

  els.routeTooltip.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(getPinNameById(from))} → ${escapeHtml(getPinNameById(to))}</div>
    <div style="opacity:.92;">${escapeHtml(routeTypeLabel(type))}</div>
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
  const rid = routeEl?.dataset?.routeid || '';

  els.routeInfo.classList.remove('hidden');
  els.routeInfo.innerHTML = `
    <button class="btn btn-sm ri-close" type="button" id="routeInfoCloseBtn">Fechar</button>
    <div class="ri-title">${escapeHtml(getPinNameById(from))} → ${escapeHtml(getPinNameById(to))}</div>
    <div class="ri-row"><span>Tipo</span><span class="ri-badge">${escapeHtml(routeTypeLabel(type))}</span></div>
    <div class="ri-row"><span>ID</span><span style="opacity:.85;">${escapeHtml(rid)}</span></div>
    <div style="margin-top:8px;opacity:.85;">Dica: use os filtros de Rotas no Avançado para limpar a visualização.</div>
  `;
  const btn = document.getElementById('routeInfoCloseBtn');
  if (btn) btn.addEventListener('click', () => { els.routeInfo.classList.add('hidden'); els.routeInfo.innerHTML = ''; });
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
    return `${wt.year}-${mm}-${dd}`;
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

  const esc = (s) => escapeHtml(String(s || ''));
  const li = (n) => `<li><b>${esc(n.name)}</b> — ${esc(n.role || '')}</li>`;
  const fixedHtml = fixed.length ? `<div class="npc-section"><div class="npc-title"><b>NPCs do Templo</b></div><ul class="npc-list">${fixed.map(li).join('')}</ul></div>` : '';
  const impHtml = impPick.length ? `<div class="npc-section"><div class="npc-title"><b>NPCs Importantes (ocasionais)</b></div><ul class="npc-list">${impPick.map(li).join('')}</ul></div>` : '';
  return fixedHtml + impHtml;
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
    return `${wt.year}-${mm}-${dd}`;
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
  const li = (n) => `<li><b>${esc(n.name)}</b> — ${esc(n.role || '')}</li>`;
  const impHtml = impPick.length ? `<div class="npc-section"><div class="npc-title"><b>NPCs Importantes (segredos)</b></div><ul class="npc-list">${impPick.map(li).join('')}</ul></div>` : '';
  const body = txt ? renderStructuredDetails(txt) : '';
  if (!impHtml && !body) return '';
  return `<div class="secret-box"><div class="secret-title">Segredos (GM)</div>${impHtml}${body}</div>`;
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

function openLoc(p) {
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
  if (btn) {
    btn.addEventListener('click', () => {
      openCity(btn.getAttribute('data-city'));
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
        if (!state.routeFilter) state.routeFilter = { enabled: false, types: [...types], participants: [] };
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
      const on = (state.routeFilter && Array.isArray(state.routeFilter.participants) && state.routeFilter.participants.includes(r));
      if (on) chip.classList.add('is-on');
      chip.addEventListener('click', () => {
        if (!state.routeFilter) state.routeFilter = { enabled: false, types: [...types], participants: [] };
        const set = new Set(state.routeFilter.participants || []);
        if (set.has(r)) set.delete(r); else set.add(r);
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
    els.storyChapterLabel.textContent = state.story?.active ? `Capítulo: ${ch + 1}` : '';
  }
  if (els.storyText) {
    els.storyText.innerHTML = '';
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
