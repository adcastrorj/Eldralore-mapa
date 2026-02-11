// -------- Clima overlay (canvas) --------

function resizeClimateCanvas() {
  const canvas = els.climateCanvas;
  const rect = els.mapStage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
}

function biomeFromTempMoist(temp, moist) {
  // temp/moist em 0..1
  if (temp < 0.22) return 'Tundra/Neve';
  if (temp < 0.32 && moist < 0.35) return 'Montanhas Frias';
  if (temp < 0.62 && moist >= 0.45) return 'Floresta Temperada';
  if (temp < 0.68 && moist >= 0.28) return 'Planícies';
  if (moist < 0.22) return 'Deserto';
  if (temp > 0.72 && moist > 0.55) return 'Selva';
  if (temp > 0.72) return 'Savana';
  return 'Temperado';
}


function climateKeyForZone(zone) {
  if (!zone) return 'global';
  return `${zone.territory}|${zone.idx}`;
}

function applyClimateOverride(zone, climateObj) {
  try {
    const key = climateKeyForZone(zone);
    const ov = state.worldState?.climate?.regions?.[key] || null;
    if (!ov) return climateObj;

    // Δ temperatura em °C (inteiro)
    const dC = Number(ov.tempDeltaC || 0);
    if (Number.isFinite(dC) && dC !== 0) {
      climateObj.tempC = Math.round(climateObj.tempC + dC);
      // reaproxima temp01 a partir de tempC (-10..38)
      climateObj.temp01 = clamp((climateObj.tempC + 10) / 48, 0, 1);
    }

    // Evento climático (override da precipitação/efeitos)
    if (ov.weatherType) {
      const wt = String(ov.weatherType);
      const inten = ov.intensity ? String(ov.intensity) : '';
      const note = ov.note ? String(ov.note) : '';

      const wxLabel = (t) => {
        const m = {
          chuva_fraca: 'chuva fraca',
          chuva_moderada: 'chuva moderada',
          chuva_forte: 'chuva forte',
          chuva_torrencial: 'chuva torrencial',
          tempestade: 'tempestade',
          neve: 'neve',
          tempestade_neve: 'tempestade de neve',
          geada: 'geada',
          calor_extremo: 'calor extremo',
          seca: 'seca severa',
          nevoeiro: 'nevoeiro denso',
        };

        return m[t] || t;
      };

      climateObj.precip = wxLabel(wt);
      const extra = [];
      if (inten) extra.push(`intensidade: ${inten}`);
      if (note) extra.push(note);
      if (extra.length) {
        climateObj.notes = climateObj.notes ? (climateObj.notes + ' • ' + extra.join(' • ')) : extra.join(' • ');
      }
      climateObj.short = climateObj.short.replace(/Precipitação: [^•]+/, 'Precipitação: ' + climateObj.precip);
      if (climateObj.notes) {
        // atualiza short para incluir notes no final (mantém padrão)
      }
    }
    return climateObj;
  } catch (_) {
    return climateObj;
  }
}

function biomeColor(biome) {
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

function climateForZone(zone) {
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
  let moist01 = clamp(0.35 + rng() * 0.65, 0, 1);

  // Ajuste por bioma (evita tudo virar selva no verão)
  if (temp01 > 0.70) moist01 = clamp(moist01 - 0.08, 0, 1);
  if (temp01 < 0.28) moist01 = clamp(moist01 - 0.10, 0, 1);

  const biome = biomeFromTempMoist(temp01, moist01);

  // Converter para ficha textual (valores aproximados, RPG-friendly)
  // tempC: -10..38
  const tempC = Math.round(-10 + temp01 * 48);

  let precip;
  if (moist01 < 0.22) precip = 'sem chuva';
  else if (moist01 < 0.40) precip = 'chuva fraca';
  else if (moist01 < 0.62) precip = 'chuva moderada';
  else precip = 'chuva forte';

  // vento por ruído leve
  const w = rng();
  const wind = (w < 0.33) ? 'fracos' : (w < 0.72) ? 'moderados' : 'fortes';

  const humidity = (moist01 < 0.25) ? 'baixa' : (moist01 < 0.55) ? 'média' : 'alta';

  // descrição curta
  const short = `Bioma: ${biome} • Temperatura: ${tempC}°C • Umidade: ${humidity} • Precipitação: ${precip} • Ventos: ${wind}`;

  // detalhes (um pouco mais narrativo, mas ainda objetivo)
  const notes = [];
  if (biome === 'Deserto') notes.push('calor seco e visibilidade alta');
  if (biome === 'Selva') notes.push('calor úmido, insetos e trilhas fechadas');
  if (biome === 'Tundra/Neve') notes.push('frio extremo e risco de congelamento');
  if (biome === 'Montanhas Frias') notes.push('ar rarefeito e rajadas nas cristas');
  if (biome === 'Floresta Temperada') notes.push('neblina leve ao amanhecer');
  if (biome === 'Planícies') notes.push('ventos constantes e variação brusca à noite');

  const out = {
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

function climateTextForPoint(layer, x, y, territoryHint = null) {
  if (layer !== 'world') {
    return 'Ambiente subterrâneo: temperatura estável, ar úmido e pouca circulação de vento.';
  }
  const z = findZoneForPoint('world', x, y, territoryHint);
  const c0 = climateForZone(z);
  const c = (c0 && typeof c0 === 'object') ? c0 : { color: 'rgba(255,255,255,0.18)', short: 'clima indefinido', notes: '' };
  return c.notes ? `${c.short} • ${c.notes}` : c.short;
}

function drawClimateOverlay() {
  const canvas = els.climateCanvas;
  if (!canvas) return;

  // Overlay só faz sentido na superfície (polígonos raciais)
  if (!state.climateOn || state.layer !== 'world' || !state.zonePolys || state.zonePolys.length === 0) {
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

  if (!state.zonePolys || !state.zonePolys.length) return;

  for (const z of state.zonePolys) {
    if (z.layer !== 'world') continue;
    const c = climateForZone(z);

    ctx.beginPath();
    const pts = z.poly;
    for (let i = 0; i < pts.length; i++) {
      const px = (pts[i][0] / 100) * targetW;
      const py = (pts[i][1] / 100) * targetH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = (c && c.color) ? c.color : 'rgba(255,255,255,0.18)';
    ctx.fill();

    // contorno sutil
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function updateTimeUI() {
  const season = seasonFromMonth(state.worldTime.month);
  els.worldTimeLabel.textContent = `Dia ${state.worldTime.day} • Mês ${state.worldTime.month} • Ano ${state.worldTime.year} • ${season}`;

  // sincroniza campos de edição (mesmo se travados)
  if (els.dayInput) els.dayInput.value = String(state.worldTime.day);
  if (els.monthInput) els.monthInput.value = String(state.worldTime.month);
  if (els.yearInput) els.yearInput.value = String(state.worldTime.year);

  const locked = !!state.dateLock;
  if (els.dateLockToggle) els.dateLockToggle.checked = locked;
  const canEdit = state.gm.unlocked && !locked;
  for (const el of [els.dayInput, els.monthInput, els.yearInput, els.applyDateBtn]) {
    if (el) el.disabled = !canEdit;
  }
  if (els.advanceDayBtn) els.advanceDayBtn.disabled = !state.gm.unlocked;

  if (els.gmLogoutBtn) els.gmLogoutBtn.disabled = !state.gm.unlocked;
  if (els.gmEditorBtn) els.gmEditorBtn.disabled = !state.gm.unlocked;
  if (els.importantNpcToggle) els.importantNpcToggle.disabled = !state.gm.unlocked;
  if (els.importantNpcToggle) els.importantNpcToggle.checked = !!state.gm.showImportantNpcs;
  if (els.expandAllInfoToggle) els.expandAllInfoToggle.disabled = !state.gm.unlocked;
  if (els.expandAllInfoToggle) els.expandAllInfoToggle.checked = !!state.gm.showAllInfo;
  if (els.gmHint) els.gmHint.style.display = state.gm.unlocked ? 'none' : 'block';
}

function advanceDay() {
  state.worldTime.day += 1;
  if (state.worldTime.day > 30) {
    state.worldTime.day = 1;
    state.worldTime.month += 1;
    if (state.worldTime.month > 12) {
      state.worldTime.month = 1;
      state.worldTime.year += 1;
    }
  }
  persistState();
  updateTimeUI();
  drawClimateOverlay();
  // SYNC (opcional): publica tempo global para todos
  try { if (state.gm.unlocked) WorldSync.pushWorldState('advance_day'); } catch (_) { }

  // se cidade aberta, re-render meta/inventários
  if (state.ui.cityOpenId) {
    const cityId = state.ui.cityOpenId;
    openCity(cityId);
  }
}
// Climate Overrides (Manual)
function gmApplyClimateOverride() {
  if (!state.gm.unlocked) return;
  const zoneIndexVal = els.gmClimateZoneSelect ? els.gmClimateZoneSelect.value : '';
  const dC = els.gmTempDeltaC ? parseFloat(els.gmTempDeltaC.value) : 0;
  const wType = els.gmWeatherType ? els.gmWeatherType.value : '';
  const wInten = els.gmWeatherIntensity ? els.gmWeatherIntensity.value : '';
  const wNote = els.gmWeatherNote ? els.gmWeatherNote.value : '';

  // zoneIndexVal pode ser "global" ou "territory|idx"
  // Salva no state.worldState.climate.regions
  if (!state.worldState.climate.regions) state.worldState.climate.regions = {};

  const key = zoneIndexVal || 'global';
  state.worldState.climate.regions[key] = {
    tempDeltaC: dC,
    weatherType: wType,
    intensity: wInten,
    note: wNote
  };

  persistState();
  drawClimateOverlay();
  try { WorldSync.pushWorldState('climate_override'); } catch (_) { }
  alert('Clima aplicado manualmetne!');
}

function gmClearClimateOverride() {
  if (!state.gm.unlocked) return;
  const zoneIndexVal = els.gmClimateZoneSelect ? els.gmClimateZoneSelect.value : '';
  const key = zoneIndexVal || 'global';

  if (state.worldState.climate.regions && state.worldState.climate.regions[key]) {
    delete state.worldState.climate.regions[key];
    persistState();
    drawClimateOverlay();
    try { WorldSync.pushWorldState('climate_override'); } catch (_) { }
    alert('Override removido para esta zona.');
  }
}

function gmClearAllClimateOverrides() {
  if (!state.gm.unlocked) return;
  if (!confirm('Deseja remover TODOS os overrides manuais de clima?')) return;

  state.worldState.climate.regions = {};
  persistState();
  drawClimateOverlay();
  try { WorldSync.pushWorldState('climate_override'); } catch (_) { }
  alert('Todos os overrides removidos.');
}



const GM_PIN_STORAGE_KEY = 'eldralore_gm_pin_hash_v1';

function applyDateFromInputs() {
  const day = parseInt(els.dayInput.value, 10);
  const month = parseInt(els.monthInput.value, 10);
  const year = parseInt(els.yearInput.value, 10);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    alert('Data inválida.');
    return;
  }
  if (day < 1 || day > 30 || month < 1 || month > 12 || year < 1) {
    alert('Data fora do intervalo: Dia 1..30, Mês 1..12, Ano >=1.');
    return;
  }

  state.worldTime = { day, month, year };
  persistState();
  updateTimeUI();
  drawClimateOverlay();
  // SYNC (opcional): publica tempo global para todos
  try { if (state.gm.unlocked) WorldSync.pushWorldState('advance_day'); } catch (_) { }
  if (state.ui.cityOpenId) openCity(state.ui.cityOpenId);
}

function gmLogin() {
  // Barreira de UI (não segurança real). Sem backend, qualquer pessoa com DevTools pode burlar.
  // Neste projeto: senha fixa embutida no build, para evitar que cada usuário "crie" seu próprio PIN.
  const configured = (typeof window !== 'undefined' && window.ELDRALORE_GM_PASSWORD) ? String(window.ELDRALORE_GM_PASSWORD) : "";
  if (!configured) {
    alert('Senha GM não configurada no projeto. Defina window.ELDRALORE_GM_PASSWORD no index.html.');
    return;
  }
  const pass = prompt('Senha do Modo GM:');
  if (pass === null) return;
  if (String(pass) !== configured) {
    alert('Senha incorreta.');
    return;
  }
  state.gm.unlocked = true;
  try { WorldSync.setGmMode(true); } catch (_) { }
  updateTimeUI();
  if (state.ui.cityOpenId) openCity(state.ui.cityOpenId);
}

function gmLogout() {
  state.gm.unlocked = false;
  try { WorldSync.setGmMode(false); } catch (_) { }
  updateTimeUI();
  if (state.ui.cityOpenId) openCity(state.ui.cityOpenId);
}

function updateTopbarHeightVar() {
  try {
    const h = els.topbar ? els.topbar.getBoundingClientRect().height : 90;
    document.documentElement.style.setProperty('--topbar-h', `${Math.ceil(h)}px`);
  } catch {
    // ignore
  }
}

function scheduleViewportRecalc() {
  // Recalcula várias vezes para capturar reflow/line-wrap após expandir a barra.
  const run = () => {
    updateTopbarHeightVar();
    applyMapViewport();
  };

  requestAnimationFrame(run);
  setTimeout(run, 60);
  setTimeout(run, 220);
}


function closeMobilePanels() {
  document.body.classList.remove('mobile-controls-open', 'mobile-sidebar-open');
  if (els.mobileBackdrop) els.mobileBackdrop.hidden = true;
}
function toggleMobilePanel(kind) {
  const cls = kind === 'controls' ? 'mobile-controls-open' : 'mobile-sidebar-open';
  const other = kind === 'controls' ? 'mobile-sidebar-open' : 'mobile-controls-open';
  const willOpen = !document.body.classList.contains(cls);
  document.body.classList.remove(other);
  document.body.classList.toggle(cls, willOpen);
  if (els.mobileBackdrop) els.mobileBackdrop.hidden = !willOpen;
}

function applyUiCollapsed() {
  if (!els.topbar) return;
  els.topbar.classList.toggle("collapsed", !!state.uiCollapsed);
  if (els.uiCollapseBtn) els.uiCollapseBtn.textContent = state.uiCollapsed ? "Expandir" : "Minimizar";
  scheduleViewportRecalc();
}


function bindUIClimateExtras() {
  // Extras específicos do overlay de clima / layout.
  // Mantemos o bindUI() principal no core.js para evitar sobrescrever handlers (Econ, Rotas, Filtros, etc).
  if (window.ResizeObserver && els.topbar) {
    try {
      const ro = new ResizeObserver(() => {
        if (typeof scheduleViewportRecalc === 'function') scheduleViewportRecalc();
        if (typeof resizeClimateCanvas === 'function') resizeClimateCanvas();
        if (typeof drawClimateOverlay === 'function' && state.climateOn) drawClimateOverlay();
      });
      ro.observe(els.topbar);
    } catch {
      // ignore
    }
  }
}


function update() {
  applyFilters();
  renderZones();
  renderRoutes();
  renderPins();
  renderList();
}

async function main() {
  loadPersistentState();
  try { await WorldSync.init(); } catch (_) { }
  bindUI();
  try { applyGmUiState(); } catch (_) {}

  if (typeof bindUIClimateExtras === "function") bindUIClimateExtras();
  applyUiCollapsed();
  applyBordersOverlay();


  // refletir UI inicial
  els.climateToggle.checked = state.climateOn;
  els.hideNoImageToggle.checked = state.hideNoImage;

  state.items = generateItemsBank();
  try {
    await Promise.all([loadPins(), loadCities(), loadZones()]);
    rebuildAdvancedPanel();
    // Feedback inicial
    if (els.routesToggleBtn) { els.routesToggleBtn.classList.toggle('is-on', !!state.routeFilter?.enabled); }

  } catch (err) {
    console.error(err);
    // Erro comum: abrir index.html via file:// bloqueia fetch()
    els.list.innerHTML = `<div class="card"><div class="name">Erro ao carregar dados (pins/zones)</div><div class="meta">Abra com um servidor local (ex.: VS Code Live Server). Abrir direto pelo arquivo (file://) bloqueia o carregamento.</div></div>`;
    return;
  }

  // Mescla cidades criadas pelo GM (salvas no navegador)
  if (state.customCities && typeof state.customCities === 'object') {
    state.cities = { ...state.cities, ...state.customCities };
  }

  // Garantir alinhamento perfeito: pins/canvas/tooltip seguem o viewport real da imagem
  if (els.worldMap) {
    if (els.worldMap.complete) {
      applyMapViewport();
    } else {
      els.worldMap.addEventListener('load', () => applyMapViewport(), { once: true });
    }
  }

  // Zoom inicial
  applyZoom();

  updateTimeUI();
  update();
}

