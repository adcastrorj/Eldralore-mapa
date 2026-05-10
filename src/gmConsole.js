// Painel GM independente (gm.html) — v20
(function(){
  const $ = (id) => document.getElementById(id);
  let unlocked = false;

  const PIN_TYPES = [
    ['all','Todos os tipos'], ['city_main','Cidades Principais'], ['settlement','Assentamentos'], ['fortress','Fortalezas'],
    ['guild_hq','Guildas'], ['dungeon','Masmorras'], ['temple','Templos']
  ];
  const RACES = ['all','humans','elves','dwarves','vampires','orcs','nagas','centaurs','dragons','demons','fae','giants','gnomes','undead','angels'];

  function esc(s){ return (typeof escapeHtml === 'function') ? escapeHtml(String(s ?? '')) : String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function labelRace(r){ return r === 'all' ? 'Todas' : (typeof raceLabel === 'function' ? raceLabel(r) : r); }
  function labelType(t){ return t === 'all' ? 'Todos' : (typeof typeLabel === 'function' ? typeLabel(t) : t); }

  function setTab(name){
    document.querySelectorAll('.gm-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.gm-console-tab').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
  }

  function ensureAll(){
    if (typeof normalizeWorldTime === 'function') normalizeWorldTime();
    if (typeof CampaignState !== 'undefined') { CampaignState.ensureWorld(); CampaignState.ensureCampaign(); }
    if (!state.campaign) state.campaign = { timeline: [], pinSecrets: {}, hooks: {}, importantNpcs: [] };
    if (!Array.isArray(state.campaign.timeline)) state.campaign.timeline = [];
    if (!state.campaign.pinSecrets || typeof state.campaign.pinSecrets !== 'object') state.campaign.pinSecrets = {};
    if (!state.campaign.hooks || typeof state.campaign.hooks !== 'object') state.campaign.hooks = {};
    if (!Array.isArray(state.campaign.importantNpcs)) state.campaign.importantNpcs = [];
    if (typeof normalizeRouteFilter === 'function') normalizeRouteFilter();
    if (typeof normalizeGroupSystems === 'function') normalizeGroupSystems();
  }

  function saveLocal(){
    ensureAll();
    if (typeof persistState === 'function') persistState();
    refreshStatus();
  }

  function refreshStatus(){
    ensureAll();
    const wt = state.worldTime || { era:'fourth_age', day:1, month:1, year:1 };
    const season = typeof seasonFromMonth === 'function' ? seasonFromMonth(wt.month) : '';
    const era = typeof eraLabelFromValue === 'function' ? eraLabelFromValue(wt.era) : (wt.era || '4ª Era');
    if ($('gmConsoleDate')) $('gmConsoleDate').textContent = `${era} — Dia ${wt.day} • Mês ${wt.month} • Ano ${wt.year}${season ? ' • ' + season : ''}`;
    const vPins = state.worldState?.vision?.pins ? Object.keys(state.worldState.vision.pins).length : 0;
    if ($('gmConsoleVisionCount')) $('gmConsoleVisionCount').textContent = `${vPins} pin(s) com estados de visão`;
    const camp = state.campaign;
    if ($('gmConsoleCampaignCount')) $('gmConsoleCampaignCount').textContent = `${camp.timeline.length} evento(s), ${Object.keys(camp.pinSecrets).length} segredo(s), ${Object.keys(camp.hooks).length} gancho(s), ${camp.importantNpcs.length} NPC(s)`;
    if ($('gmEra')) $('gmEra').value = wt.era || 'fourth_age';
    if ($('gmDay')) $('gmDay').value = String(wt.day || 1);
    if ($('gmMonth')) $('gmMonth').value = String(wt.month || 1);
    if ($('gmYear')) $('gmYear').value = String(wt.year || 1);
    syncJsonEditors();
    syncRouteUI();
    renderPoliticalControlSummary();
    renderGroupReputationSummary();
  }

  function syncJsonEditors(){
    const camp = state.campaign || { timeline: [], pinSecrets: {}, hooks: {}, importantNpcs: [] };
    const setIfNotFocused = (id, val) => { const el = $(id); if (el && document.activeElement !== el) el.value = JSON.stringify(val, null, 2); };
    setIfNotFocused('timelineJson', camp.timeline || []);
    setIfNotFocused('pinSecretsJson', camp.pinSecrets || {});
    setIfNotFocused('hooksJson', camp.hooks || {});
    setIfNotFocused('importantNpcsJson', camp.importantNpcs || []);
    if (typeof CampaignState !== 'undefined') setIfNotFocused('campaignExportJson', CampaignState.build());
  }

  function applyDate(){
    const era = $('gmEra')?.value || 'fourth_age';
    const d = parseInt($('gmDay')?.value || '1', 10);
    const m = parseInt($('gmMonth')?.value || '1', 10);
    const y = parseInt($('gmYear')?.value || '1', 10);
    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y) || d < 1 || d > 30 || m < 1 || m > 12 || y < 1) { alert('Data inválida. Use Dia 1–30, Mês 1–12 e Ano maior que 0.'); return; }
    state.worldTime = { era, day:d, month:m, year:y };
    saveLocal();
  }

  function advanceDayLocal(){
    ensureAll();
    state.worldTime.day += 1;
    if (state.worldTime.day > 30) { state.worldTime.day = 1; state.worldTime.month += 1; }
    if (state.worldTime.month > 12) { state.worldTime.month = 1; state.worldTime.year += 1; }
    saveLocal();
  }

  function saveJsonEditor(id, key, fallback){
    const el = $(id); if (!el) return;
    let obj; try { obj = JSON.parse(el.value || JSON.stringify(fallback)); } catch(e){ alert('JSON inválido neste campo.'); return; }
    ensureAll(); state.campaign[key] = obj; saveLocal(); alert('Salvo no navegador. Use Exportar para gerar o JSON dos jogadores.');
  }

  function pinsByFilter(type, race){
    const pins = Array.isArray(state.pins) ? state.pins : [];
    return pins.filter(p => (type === 'all' || p.type === type) && (race === 'all' || p.territory === race));
  }

  function buildSelector(containerId, prefix){
    const box = $(containerId); if (!box) return;
    const typeOptions = PIN_TYPES.map(([v,l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    const raceOptions = RACES.map(r => `<option value="${r}">${esc(labelRace(r))}</option>`).join('');
    box.innerHTML = `
      <div class="wv-flow gm-apply-flow">
        <label class="ctrl">1. Tipo de local <select id="${prefix}Type">${typeOptions}</select></label>
        <label class="ctrl">2. Raça <select id="${prefix}Race">${raceOptions}</select></label>
        <label class="ctrl">3. Visão/Categoria
          <select id="${prefix}Vision">
            <option value="geral">Geral</option>
            <option value="political">Política</option>
            <option value="religion">Religião</option>
            <option value="danger">Perigo</option>
            <option value="commerce">Comércio</option>
            <option value="war">Bélica / Guerra</option>
          </select>
        </label>
      </div>
      <div class="wv-section"><div class="wv-section-title">4. Locais afetados</div><div class="wv-hint">Marque “Todos” ou escolha locais específicos.</div><div id="${prefix}Locations" class="wv-location-list"></div></div>`;
    const refresh = () => renderSelectorLocations(prefix);
    $(`${prefix}Type`)?.addEventListener('change', refresh);
    $(`${prefix}Race`)?.addEventListener('change', refresh);
    renderSelectorLocations(prefix);
  }

  function renderSelectorLocations(prefix){
    const type = $(`${prefix}Type`)?.value || 'all';
    const race = $(`${prefix}Race`)?.value || 'all';
    const list = pinsByFilter(type, race).sort((a,b) => String(a.name||'').localeCompare(String(b.name||''), 'pt-BR'));
    const box = $(`${prefix}Locations`); if (!box) return;
    if (!list.length) { box.innerHTML = '<div class="hint">Nenhum local encontrado.</div>'; return; }
    box.innerHTML = `<label class="wv-check all"><input type="checkbox" value="__all" checked> Todos os ${esc(labelType(type)).toLowerCase()} ${race !== 'all' ? 'de ' + esc(labelRace(race)) : ''}</label>` +
      list.map(p => `<label class="wv-check"><input type="checkbox" value="${esc(p.id)}"> ${esc(p.name || p.id)} <span class="muted">${esc(labelType(p.type))}</span></label>`).join('');
    const all = box.querySelector('input[value="__all"]');
    const others = Array.from(box.querySelectorAll('input:not([value="__all"])'));
    if (all) all.addEventListener('change', () => { if (all.checked) others.forEach(chk => chk.checked = false); });
    others.forEach(chk => chk.addEventListener('change', () => { if (chk.checked && all) all.checked = false; }));
  }

  function selectedPinIds(prefix){
    const type = $(`${prefix}Type`)?.value || 'all';
    const race = $(`${prefix}Race`)?.value || 'all';
    const box = $(`${prefix}Locations`); if (!box) return [];
    const all = box.querySelector('input[value="__all"]');
    if (all && all.checked) return pinsByFilter(type, race).map(p => p.id);
    return Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value).filter(v => v && v !== '__all');
  }

  function applySecrets(){
    ensureAll();
    const ids = selectedPinIds('secret');
    if (!ids.length) { alert('Selecione pelo menos um local.'); return; }
    const vision = $(`secretVision`)?.value || 'geral';
    const pub = $('secretPublicText')?.value.trim() || '';
    const gm = $('secretGmText')?.value.trim() || '';
    if (!pub && !gm) { alert('Escreva uma informação pública ou um segredo GM.'); return; }
    ids.forEach(id => {
      const rec = state.campaign.pinSecrets[id] && typeof state.campaign.pinSecrets[id] === 'object' ? state.campaign.pinSecrets[id] : {};
      if (pub) rec.publica = pub;
      if (gm) rec.gm = gm;
      rec.visao = vision;
      rec.atualizadoEm = new Date().toISOString();
      state.campaign.pinSecrets[id] = rec;
    });
    saveLocal(); alert(`Segredos aplicados a ${ids.length} local(is).`);
  }

  function applyHooks(){
    ensureAll();
    const ids = selectedPinIds('hook');
    if (!ids.length) { alert('Selecione pelo menos um local.'); return; }
    const vision = $('hookVision')?.value || 'geral';
    const title = $('hookTitle')?.value.trim() || 'Gancho sem título';
    const text = $('hookText')?.value.trim() || '';
    const status = $('hookStatus')?.value.trim() || 'ativo';
    if (!text) { alert('Escreva o texto do gancho/situação.'); return; }
    ids.forEach(id => {
      if (!Array.isArray(state.campaign.hooks[id])) state.campaign.hooks[id] = [];
      state.campaign.hooks[id].push({ title, text, status, visao: vision, createdAt: new Date().toISOString() });
    });
    saveLocal(); alert(`Gancho aplicado a ${ids.length} local(is).`);
  }

  function applyNpcs(){
    ensureAll();
    const ids = selectedPinIds('npc');
    if (!ids.length) { alert('Selecione pelo menos um local.'); return; }
    const vision = $('npcVision')?.value || 'geral';
    const name = $('npcName')?.value.trim() || '';
    const role = $('npcRole')?.value.trim() || '';
    if (!name || !role) { alert('Informe nome e função do NPC.'); return; }
    const status = $('npcStatus')?.value.trim() || 'ativo';
    const secret = $('npcSecret')?.value.trim() || '';
    ids.forEach(id => {
      const pin = (state.pins || []).find(p => p.id === id);
      state.campaign.importantNpcs.push({ name, role, status, secret, visao: vision, pinId: id, where: pin?.name || id, createdAt: new Date().toISOString() });
    });
    saveLocal(); alert(`NPC adicionado a ${ids.length} local(is).`);
  }

  function addTimelineEvent(){
    ensureAll();
    const ev = {
      era: $('tlEra')?.value || state.worldTime?.era || 'fourth_age',
      dia: Number($('tlDay')?.value || state.worldTime?.day || 1),
      mes: Number($('tlMonth')?.value || state.worldTime?.month || 1),
      ano: Number($('tlYear')?.value || state.worldTime?.year || 1),
      titulo: $('tlTitle')?.value.trim() || 'Evento sem título',
      texto: $('tlText')?.value.trim() || '',
      pins: ($('tlPins')?.value || '').split(',').map(x => x.trim()).filter(Boolean),
      secreto: !!$('tlSecret')?.checked,
      createdAt: new Date().toISOString()
    };
    state.campaign.timeline.push(ev);
    saveLocal();
    $('tlTitle').value = ''; $('tlText').value = ''; $('tlPins').value = ''; $('tlSecret').checked = false;
  }


  function buildPoliticalControlFilters(){
    const t = $('politicalControlType');
    const r = $('politicalControlRace');
    if (t && !t.children.length) t.innerHTML = PIN_TYPES.map(([v,l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    if (r && !r.children.length) r.innerHTML = RACES.map(x => `<option value="${x}">${esc(labelRace(x))}</option>`).join('');
  }

  function renderPoliticalControlSummary(){
    buildPoliticalControlFilters();
    const box = $('politicalControlSummary');
    if (!box) return;
    const type = $('politicalControlType')?.value || 'all';
    const race = $('politicalControlRace')?.value || 'all';
    const list = pinsByFilter(type, race).filter(p => p.politicalControl || p.dangerProfile || p.reputation).sort((a,b) => String(a.name||'').localeCompare(String(b.name||''), 'pt-BR'));
    if (!list.length) { box.innerHTML = '<div class="hint">Nenhum local com dados políticos encontrado.</div>'; return; }
    box.innerHTML = list.slice(0, 220).map(p => {
      const pol = p.politicalControl || {};
      const danger = p.dangerProfile || {};
      const rep = p.reputation && Array.isArray(p.reputation.factions) ? p.reputation.factions[0] : null;
      return `<div class="political-card">
        <div><b>${esc(p.name || p.id)}</b> <span class="badge">${esc(labelType(p.type))}</span> <span class="badge">${esc(labelRace(p.territory || 'all'))}</span></div>
        <div class="muted">Controle: ${esc(pol.controller || '—')} • ${esc(pol.stability || '—')} • ${esc(pol.realm || '—')}</div>
        <div class="muted">Perigo: ${esc(danger.level || '—')}${danger.score ? ' (' + esc(danger.score) + '/100)' : ''} • Reputação: ${esc(rep ? rep.status : 'Neutro')}</div>
      </div>`;
    }).join('') + (list.length > 220 ? `<div class="hint">Mostrando 220 de ${list.length} locais. Refine os filtros.</div>` : '');
  }


  function fillSelectFromMap(id, map, fallback){
    const el = $(id); if (!el || el.children.length) return;
    const src = map || fallback || {};
    el.innerHTML = Object.entries(src).map(([v,txt]) => `<option value="${esc(v)}">${esc(txt)}</option>`).join('');
  }

  function buildGroupReputationControls(){
    buildSelector('groupRepSelector', 'groupRep');
    buildSelector('groupRumorSelector', 'groupRumor');
    fillSelectFromMap('groupRepSocial', typeof GROUP_REPUTATION_SOCIAL !== 'undefined' ? GROUP_REPUTATION_SOCIAL : { normal:'Normal' });
    fillSelectFromMap('groupRepMood', typeof GROUP_REPUTATION_MOOD !== 'undefined' ? GROUP_REPUTATION_MOOD : { estavel:'Estável' });
    fillSelectFromMap('groupRepMilitary', typeof GROUP_REPUTATION_MILITARY !== 'undefined' ? GROUP_REPUTATION_MILITARY : { normal:'Normal' });
    fillSelectFromMap('groupRepCommerce', typeof GROUP_REPUTATION_COMMERCE !== 'undefined' ? GROUP_REPUTATION_COMMERCE : { normal:'Normal' });
  }

  function applyGroupReputation(){
    ensureAll();
    if (typeof setGroupReputationForPins !== 'function') { alert('Sistema de reputação não carregado.'); return; }
    const ids = selectedPinIds('groupRep');
    if (!ids.length) { alert('Selecione pelo menos um local ou use Todos.'); return; }
    const level = $('groupRepLevel')?.value || 'neutro';
    const data = {
      level,
      status: level,
      commercialAccess: $('groupRepCommercialAccess')?.value || 'auto',
      social: $('groupRepSocial')?.value || 'normal',
      mood: $('groupRepMood')?.value || 'estavel',
      military: $('groupRepMilitary')?.value || 'normal',
      commerce: $('groupRepCommerce')?.value || 'normal',
      note: $('groupRepNote')?.value.trim() || ''
    };
    setGroupReputationForPins(ids, data);
    saveLocal();
    renderGroupReputationSummary();
    alert(`Reputação aplicada a ${ids.length} local(is).`);
  }

  function clearGroupReputation(){
    ensureAll();
    if (typeof clearGroupReputationForPins !== 'function') return;
    const ids = selectedPinIds('groupRep');
    if (!ids.length) { alert('Selecione pelo menos um local ou use Todos.'); return; }
    if (!confirm(`Limpar reputação macro do grupo em ${ids.length} local(is)?`)) return;
    clearGroupReputationForPins(ids);
    saveLocal();
    renderGroupReputationSummary();
  }

  function applyManualRumor(){
    ensureAll();
    if (typeof addManualRumorForPins !== 'function') { alert('Sistema de rumores não carregado.'); return; }
    const ids = selectedPinIds('groupRumor');
    if (!ids.length) { alert('Selecione pelo menos um local ou use Todos.'); return; }
    const text = $('groupRumorText')?.value.trim() || '';
    if (!text) { alert('Escreva o texto do rumor.'); return; }
    addManualRumorForPins(ids, {
      text,
      channel: $('groupRumorChannel')?.value || 'public',
      fixed: !!$('groupRumorFixed')?.checked,
      durationDays: Number($('groupRumorDuration')?.value || 7)
    });
    saveLocal();
    $('groupRumorText').value = '';
    renderGroupReputationSummary();
    alert(`Rumor adicionado a ${ids.length} local(is).`);
  }

  function clearManualRumors(){
    ensureAll();
    if (typeof clearManualRumorsForPins !== 'function') return;
    const ids = selectedPinIds('groupRumor');
    if (!ids.length) { alert('Selecione pelo menos um local ou use Todos.'); return; }
    if (!confirm(`Limpar rumores manuais em ${ids.length} local(is)?`)) return;
    clearManualRumorsForPins(ids);
    saveLocal();
    renderGroupReputationSummary();
  }

  function renderGroupReputationSummary(){
    const box = $('groupRepSummary');
    if (!box || typeof normalizeGroupSystems !== 'function') return;
    normalizeGroupSystems();
    const repPins = state.worldState.groupReputation?.pins || {};
    const rumorPins = state.worldState.rumors?.pins || {};
    const ids = Array.from(new Set([...Object.keys(repPins), ...Object.keys(rumorPins)]));
    if (!ids.length) { box.innerHTML = '<div class="hint">Nenhuma reputação macro ou rumor manual aplicado ainda.</div>'; return; }
    const pinById = new Map((state.pins || []).map(p => [p.id, p]));
    box.innerHTML = ids.slice(0, 220).map(id => {
      const p = pinById.get(id) || { id, name:id, type:'', territory:'' };
      const rep = (typeof getGroupReputation === 'function') ? getGroupReputation(p) : null;
      const manualCount = Array.isArray(rumorPins[id]?.items) ? rumorPins[id].items.length : 0;
      const access = rep?.tradeBlocked ? 'lojas bloqueadas' : (rep?.tradeRestricted ? 'negociação restrita' : 'negociação aberta');
      return `<div class="political-card">
        <div><b>${esc(p.name || id)}</b> <span class="badge">${esc(labelType(p.type || ''))}</span> <span class="badge">${esc(labelRace(p.territory || 'all'))}</span></div>
        <div class="muted">Reputação: ${esc(rep?.raw ? rep.label : '—')} • ${esc(access)}${rep?.raw ? ' • ' + esc((typeof reputationPriceInfo === 'function' ? reputationPriceInfo(p).text : '')) : ''}</div>
        <div class="muted">Rumores manuais: ${manualCount}</div>
      </div>`;
    }).join('') + (ids.length > 220 ? `<div class="hint">Mostrando 220 de ${ids.length} locais. Refine os filtros.</div>` : '');
  }

  function syncRouteUI(){
    if (!$('gmRoutesEnabled')) return;
    if (typeof normalizeRouteFilter === 'function') normalizeRouteFilter();
    const rf = state.routeFilter || {};
    $('gmRoutesEnabled').checked = !!rf.enabled;
    $('gmRoutesExternalOnly').checked = !!rf.externalOnly;
    $('gmRouteViewMode').value = rf.viewMode || 'strict';
    if ($('gmRouteConnection')) $('gmRouteConnection').value = (Array.isArray(rf.connectionTypes) && rf.connectionTypes.length === 0) ? 'all' : ((rf.connectionTypes && rf.connectionTypes[0]) || 'main-main');
    if ($('gmRouteFocusRace')) $('gmRouteFocusRace').value = rf.focusRace || 'humans';
    const active = new Set(rf.races || RACES.filter(r => r !== 'all'));
    document.querySelectorAll('#gmRouteRaceChecks input[type="checkbox"]').forEach(chk => chk.checked = active.has(chk.value));
  }

  function buildRouteControls(){
    const sel = $('gmRouteFocusRace');
    if (sel && !sel.children.length) sel.innerHTML = RACES.filter(r => r !== 'all').map(r => `<option value="${r}">${esc(labelRace(r))}</option>`).join('');
    const box = $('gmRouteRaceChecks');
    if (box && !box.children.length) box.innerHTML = RACES.filter(r => r !== 'all').map(r => `<label class="wv-check"><input type="checkbox" value="${r}"> ${esc(labelRace(r))}</label>`).join('');
    syncRouteUI();
  }

  function readRouteUI(){
    if (typeof normalizeRouteFilter === 'function') normalizeRouteFilter();
    const rf = state.routeFilter || {};
    rf.enabled = !!$('gmRoutesEnabled')?.checked;
    rf.externalOnly = !!$('gmRoutesExternalOnly')?.checked;
    rf.viewMode = $('gmRouteViewMode')?.value || 'strict';
    rf.focusRace = $('gmRouteFocusRace')?.value || rf.focusRace || 'humans';
    const conn = $('gmRouteConnection')?.value || 'main-main';
    rf.connectionTypes = conn === 'all' ? [] : [conn];
    rf.races = Array.from(document.querySelectorAll('#gmRouteRaceChecks input[type="checkbox"]:checked')).map(x => x.value);
    rf.participants = [...rf.races];
    state.routeFilter = rf;
  }

  function applyRoutes(){ readRouteUI(); saveLocal(); alert('Configuração de rotas aplicada ao mapa.'); }

  async function boot(){
    const pass = prompt('Senha do Painel GM:');
    if (pass !== String(window.ELDRALORE_GM_PASSWORD || '')) {
      document.body.innerHTML = '<div class="gm-console-locked"><h1>Acesso GM bloqueado</h1><p>Senha incorreta ou cancelada.</p><p><a class="btn" href="index.html">Voltar ao mapa</a></p></div>';
      return;
    }
    unlocked = true;
    try { if (typeof loadPersistentState === 'function') loadPersistentState(); } catch(_) {}
    state.gm.unlocked = true;
    try { await loadPins(); } catch(e) { console.warn('Pins não carregados no Painel GM', e); }
    ensureAll();

    document.querySelectorAll('.gm-tab-btn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('gmApplyDate')?.addEventListener('click', applyDate);
    $('gmAdvanceDay')?.addEventListener('click', advanceDayLocal);
    $('gmOpenMap')?.addEventListener('click', () => window.open('index.html', 'eldralore_map'));
    $('gmExportDownload')?.addEventListener('click', () => CampaignState.download('eldralore_campaign_state.json'));
    $('gmRefreshExport')?.addEventListener('click', () => { if ($('campaignExportJson')) $('campaignExportJson').value = JSON.stringify(CampaignState.build(), null, 2); });
    $('gmImportApply')?.addEventListener('click', () => {
      let obj; try { obj = JSON.parse($('campaignImportJson')?.value || '{}'); } catch(e){ alert('JSON inválido.'); return; }
      if (!confirm('Importar este estado no navegador do GM?')) return;
      CampaignState.apply(obj, { persist:true, refresh:false }); refreshStatus(); alert('Estado importado no Painel GM. O mapa aberto no mesmo navegador será atualizado.');
    });

    $('saveTimeline')?.addEventListener('click', () => saveJsonEditor('timelineJson', 'timeline', []));
    $('savePinSecrets')?.addEventListener('click', () => saveJsonEditor('pinSecretsJson', 'pinSecrets', {}));
    $('saveHooks')?.addEventListener('click', () => saveJsonEditor('hooksJson', 'hooks', {}));
    $('saveImportantNpcs')?.addEventListener('click', () => saveJsonEditor('importantNpcsJson', 'importantNpcs', []));
    $('tlAddEvent')?.addEventListener('click', addTimelineEvent);
    $('applySecrets')?.addEventListener('click', applySecrets);
    $('applyHooks')?.addEventListener('click', applyHooks);
    $('applyNpcs')?.addEventListener('click', applyNpcs);

    buildSelector('secretSelector', 'secret');
    buildSelector('hookSelector', 'hook');
    buildSelector('npcSelector', 'npc');
    buildGroupReputationControls();
    $('groupRepApply')?.addEventListener('click', applyGroupReputation);
    $('groupRepClear')?.addEventListener('click', clearGroupReputation);
    $('groupRepRefresh')?.addEventListener('click', renderGroupReputationSummary);
    $('groupRumorApply')?.addEventListener('click', applyManualRumor);
    $('groupRumorClear')?.addEventListener('click', clearManualRumors);

    buildRouteControls();
    buildPoliticalControlFilters();
    $('politicalControlRefresh')?.addEventListener('click', renderPoliticalControlSummary);
    $('politicalControlType')?.addEventListener('change', renderPoliticalControlSummary);
    $('politicalControlRace')?.addEventListener('change', renderPoliticalControlSummary);
    $('gmRouteApply')?.addEventListener('click', applyRoutes);
    $('gmRouteAllRaces')?.addEventListener('click', () => { document.querySelectorAll('#gmRouteRaceChecks input').forEach(chk => chk.checked = true); });
    $('gmRouteNoRaces')?.addEventListener('click', () => { document.querySelectorAll('#gmRouteRaceChecks input').forEach(chk => chk.checked = false); });
    $('gmRoutePresetClean')?.addEventListener('click', () => { $('gmRoutesEnabled').checked = true; $('gmRoutesExternalOnly').checked = false; $('gmRouteViewMode').value = 'strict'; $('gmRouteConnection').value = 'main-main'; document.querySelectorAll('#gmRouteRaceChecks input').forEach(chk => chk.checked = true); applyRoutes(); });
    $('gmRoutePresetExternal')?.addEventListener('click', () => { $('gmRoutesEnabled').checked = true; $('gmRoutesExternalOnly').checked = true; $('gmRouteViewMode').value = 'universal'; $('gmRouteConnection').value = 'external-trade'; document.querySelectorAll('#gmRouteRaceChecks input').forEach(chk => chk.checked = true); applyRoutes(); });

    // Visão do Mundo reutiliza o motor existente.
    try {
      populateWorldVisionTypeSelect(); populateWorldVisionRaceSelect(); renderWorldVisionLocations(); renderWorldVisionStates(); updateWorldVisionSummary(); bindWorldVisionPanel();
      ['worldVisionApplyBtn','worldVisionRemoveBtn','worldVisionClearBtn','worldVisionImportBtn'].forEach(id => { const el = $(id); if (el) el.addEventListener('click', () => setTimeout(refreshStatus, 120)); });
    } catch(e) { console.warn('Falha ao iniciar Visão do Mundo no Painel GM', e); }

    window.addEventListener('storage', (ev) => { try { if (ev.key === STORAGE_KEY && typeof loadPersistentState === 'function') { loadPersistentState(); ensureAll(); refreshStatus(); } } catch (_) {} });
    refreshStatus(); setTab('calendar');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
