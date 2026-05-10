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
  try { populateGmClimateZoneSelect(); } catch (_) {}
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
  const groupIn = (els.gmPinGroup && els.gmPinGroup.value || '').trim();
  const tagsIn = (els.gmPinTags && els.gmPinTags.value || '').trim();
  const erasIn = (els.gmPinEras && els.gmPinEras.value || '').trim();
  const dangerIn = (els.gmPinDanger && els.gmPinDanger.value);
  const zoomMinIn = (els.gmPinZoomMin && els.gmPinZoomMin.value);
  const zoomMaxIn = (els.gmPinZoomMax && els.gmPinZoomMax.value);
  const factionIn = (els.gmPinFaction && els.gmPinFaction.value || '').trim();
  const religionIn = (els.gmPinReligion && els.gmPinReligion.value || '').trim();

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
    alwaysLabel: alwaysLabel,
    group: groupIn || territoryIn || 'general',
    tags: tagsIn ? tagsIn.split(',').map(s=>s.trim()).filter(Boolean) : [],
    eras: erasIn ? erasIn.split(',').map(s=>s.trim()).filter(Boolean) : ['current'],
    danger: (dangerIn!=='' && dangerIn!=null && isFinite(parseInt(dangerIn,10))) ? clamp(parseInt(dangerIn,10),0,5) : undefined,
    zoomMin: (zoomMinIn!=='' && zoomMinIn!=null && isFinite(parseFloat(zoomMinIn))) ? clamp(parseFloat(zoomMinIn),0.05,10) : undefined,
    zoomMax: (zoomMaxIn!=='' && zoomMaxIn!=null && isFinite(parseFloat(zoomMaxIn))) ? clamp(parseFloat(zoomMaxIn),0.05,10) : undefined,
    faction: factionIn || undefined,
    religion: religionIn || undefined
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
  if (typeof CampaignState !== 'undefined' && CampaignState && typeof CampaignState.download === 'function') {
    CampaignState.download('eldralore_campaign_state.json');
    return;
  }
  const payload = {
    schema: 'eldralore_campaign_state_v1',
    worldTime: state.worldTime,
    worldState: state.worldState || { climate:{ regions:{} }, vision:{ pins:{} } },
    economy: state.economy || { modifiers: [] },
    campaign: state.campaign || { timeline: [], pinSecrets: {}, hooks: {}, importantNpcs: [] },
    customPins: state.customPins || [],
    customCities: state.customCities || {},
    pinOverrides: state.pinOverrides || {},
    merchantState: state.merchantState || {},
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eldralore_campaign_state.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}



function populateGmClimateZoneSelect(){
  if(!els.gmClimateZoneSelect) return;
  els.gmClimateZoneSelect.innerHTML = '';
  const zones = (state.zonePolys || []).filter(z => z.layer === 'world');
  if(!zones.length){
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Sem zonas carregadas (zones.json)';
    els.gmClimateZoneSelect.appendChild(opt);
    return;
  }
  for(const z of zones){
    const opt = document.createElement('option');
    opt.value = JSON.stringify({ layer: z.layer, territory: z.territory, idx: z.idx });
    opt.textContent = `${territoryLabelShort(z.territory)} • Polígono #${z.idx}`;
    els.gmClimateZoneSelect.appendChild(opt);
  }
}

function gmClimateKeyFromSelect(){
  if(!els.gmClimateZoneSelect) return null;
  const raw = els.gmClimateZoneSelect.value || '';
  if(!raw) return null;
  try{
    const o = JSON.parse(raw);
    return `${o.territory}|${o.idx}`;
  }catch(_){
    return null;
  }
}

function gmApplyClimateOverride(){
  if(!state.gm.unlocked) return;
  const key = gmClimateKeyFromSelect();
  if(!key){ alert('Selecione uma região (polígono).'); return; }

  const tempDeltaC = parseInt(els.gmTempDeltaC?.value||'0',10) || 0;
  const weatherType = (els.gmWeatherType?.value || '').trim();
  const intensity = (els.gmWeatherIntensity?.value || '').trim();
  const note = (els.gmWeatherNote?.value || '').trim();

  if(!state.worldState) state.worldState = { rev:0, updatedAt:0, climate:{ regions:{} } };
  if(!state.worldState.climate) state.worldState.climate = { regions:{} };
  if(!state.worldState.climate.regions) state.worldState.climate.regions = {};

  state.worldState.climate.regions[key] = {
    tempDeltaC,
    weatherType: weatherType || '',
    intensity: intensity || '',
    note: note || '',
    updatedAt: Date.now(),
  };

  persistState();
  drawClimateOverlay();
  update();
  try{ WorldSync.pushWorldState('climate_override'); }catch(_){}
  alert('Clima regional aplicado (e sincronizado se SYNC estiver ativo).');
}

function gmClearClimateOverride(){
  if(!state.gm.unlocked) return;
  const key = gmClimateKeyFromSelect();
  if(!key){ alert('Selecione uma região (polígono).'); return; }
  if(state.worldState?.climate?.regions && state.worldState.climate.regions[key]){
    delete state.worldState.climate.regions[key];
    persistState();
    drawClimateOverlay();
    update();
    try{ WorldSync.pushWorldState('climate_clear_region'); }catch(_){}
    alert('Clima regional removido para esta região.');
  }else{
    alert('Esta região não possui override manual.');
  }
}

function gmClearAllClimateOverrides(){
  if(!state.gm.unlocked) return;
  if(!confirm('Remover TODOS os overrides climáticos manuais?')) return;
  if(!state.worldState) state.worldState = { rev:0, updatedAt:0, climate:{ regions:{} } };
  state.worldState.climate = { regions:{} };
  persistState();
  drawClimateOverlay();
  update();
  try{ WorldSync.pushWorldState('climate_clear_all'); }catch(_){}
  alert('Todos os overrides climáticos foram removidos.');
}
