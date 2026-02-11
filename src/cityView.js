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

