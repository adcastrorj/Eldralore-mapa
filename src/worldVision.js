// Painel GM — Visão do Mundo
// Estados acumuláveis por pin, salvos em state.worldState.vision.pins.
// Não altera pins.json: é uma camada GM leve e reversível.

const WORLD_VISION_TYPES = [
  { value: '', label: '— escolha o tipo —' },
  { value: 'city_main', label: 'Cidades Principais' },
  { value: 'settlement', label: 'Assentamentos' },
  { value: 'fortress', label: 'Fortalezas' },
  { value: 'guild_hq', label: 'Guildas' },
  { value: 'dungeon', label: 'Masmorras' },
  { value: 'temple', label: 'Templos' },
  { value: 'all', label: 'Todos os tipos' },
];

const WORLD_VISION_LABELS = {
  political: 'Política',
  religion: 'Religião',
  danger: 'Perigo',
  commerce: 'Comércio',
  war: 'Bélica / Guerras',
  expanded: 'Info expandida',
};

const WORLD_VISION_CATEGORY_OPTIONS = {
  political: {
    civil_state: {
      label: 'Estado civil',
      items: [
        ['civil_calm', 'Calmo'],
        ['civil_satisfied', 'Povo satisfeito'],
        ['civil_unsatisfied', 'Povo insatisfeito'],
        ['civil_small_protests', 'Protestos pequenos'],
        ['civil_popular_revolt', 'Revolta popular'],
        ['civil_hunger', 'Fome civil'],
        ['civil_exodus', 'Êxodo populacional'],
        ['civil_panic', 'Pânico coletivo'],
        ['civil_divided_city', 'Cidade dividida'],
        ['civil_forced_submission', 'Submissão forçada'],
        ['civil_fanatic_population', 'População fanática'],
        ['civil_social_collapse', 'Colapso social'],
      ],
    },
    nobility: {
      label: 'Nobreza',
      items: [
        ['nobility_stable', 'Nobreza estável'],
        ['nobility_divided', 'Nobreza dividida'],
        ['nobility_corrupt', 'Nobreza corrupta'],
        ['nobility_militarized', 'Nobreza militarizada'],
        ['nobility_absent', 'Nobreza ausente'],
        ['nobility_rival_families', 'Famílias rivais'],
        ['nobility_coup_preparation', 'Golpe em preparação'],
        ['nobility_contested_heir', 'Herdeiro contestado'],
        ['nobility_political_marriage', 'Casamento político'],
        ['nobility_weak_regent', 'Regente fraco'],
        ['nobility_dominant_council', 'Conselho dominante'],
        ['nobility_usurper', 'Usurpador no poder'],
      ],
    },
    conflict: {
      label: 'Conflito interno/externo',
      items: [
        ['conflict_none', 'Sem conflito'],
        ['conflict_internal_tension', 'Tensão interna'],
        ['conflict_external_tension', 'Tensão externa'],
        ['conflict_spies', 'Espiões infiltrados'],
        ['conflict_secret_rebellion', 'Rebelião secreta'],
        ['conflict_cold_war', 'Guerra fria'],
        ['conflict_hostile_border', 'Fronteira hostil'],
        ['conflict_siege_imminent', 'Cerco iminente'],
        ['conflict_tribal_threat', 'Ameaça tribal'],
        ['conflict_demonic_threat', 'Ameaça demoníaca'],
        ['conflict_political_invasion', 'Invasão política'],
        ['conflict_foreign_control', 'Domínio estrangeiro'],
      ],
    },
    political_control: {
      label: 'Controle político',
      items: [
        ['control_house', 'Casa nobre dominante'],
        ['control_council', 'Conselho local dominante'],
        ['control_military', 'Comando militar direto'],
        ['control_religious', 'Autoridade religiosa dominante'],
        ['control_guild', 'Guilda com forte influência'],
        ['control_contested', 'Controle disputado'],
        ['control_foreign', 'Influência estrangeira'],
        ['control_shared', 'Administração compartilhada'],
        ['control_hidden', 'Controle oculto'],
        ['control_autonomous', 'Autonomia local'],
      ],
    },

    public_policy: {
      label: 'Política pública',
      items: [
        ['policy_fair_taxes', 'Impostos justos'],
        ['policy_abusive_taxes', 'Impostos abusivos'],
        ['policy_food_distribution', 'Distribuição de comida'],
        ['policy_strict_laws', 'Leis rígidas'],
        ['policy_soft_laws', 'Leis brandas'],
        ['policy_religious_persecution', 'Perseguição religiosa'],
        ['policy_trade_control', 'Controle de comércio'],
        ['policy_civil_militarization', 'Militarização civil'],
        ['policy_poor_relief', 'Auxílio aos pobres'],
        ['policy_state_propaganda', 'Propaganda estatal'],
        ['policy_curfew', 'Toque de recolher'],
        ['policy_legal_slavery', 'Escravidão legalizada'],
      ],
    },
  },

  religion: {
    dominant_faith: {
      label: 'Fé dominante',
      items: [
        ['faith_official_cult', 'Culto oficial forte'],
        ['faith_plural', 'Múltiplas fés convivendo'],
        ['faith_declining', 'Fé em declínio'],
        ['faith_fanatic', 'Fanatismo religioso'],
        ['faith_silenced', 'Fé silenciada'],
        ['faith_missionaries', 'Missionários ativos'],
        ['faith_theocracy', 'Teocracia local'],
        ['faith_hidden_chapel', 'Capelas escondidas'],
        ['faith_ancestral', 'Culto ancestral'],
        ['faith_nature_spirits', 'Espíritos da natureza'],
        ['faith_death_cult', 'Culto à morte'],
        ['faith_no_faith', 'Ateísmo ou ceticismo dominante'],
      ],
    },
    temple_state: {
      label: 'Estado dos templos',
      items: [
        ['temple_blessed', 'Templo abençoado'],
        ['temple_abandoned', 'Templo abandonado'],
        ['temple_profaned', 'Templo profanado'],
        ['temple_fortified', 'Templo fortificado'],
        ['temple_pilgrimage', 'Centro de peregrinação'],
        ['temple_relics', 'Relíquias guardadas'],
        ['temple_false_priests', 'Falsos sacerdotes'],
        ['temple_silent_oracle', 'Oráculo silenciado'],
        ['temple_miracles', 'Milagres recentes'],
        ['temple_broken_bells', 'Sinos quebrados'],
        ['temple_forbidden_crypt', 'Cripta proibida'],
        ['temple_living_saint', 'Santo vivo presente'],
      ],
    },
    occult: {
      label: 'Cultos e heresias',
      items: [
        ['occult_forbidden_cult', 'Culto proibido'],
        ['occult_blood_rites', 'Ritos de sangue'],
        ['occult_demon_pact', 'Pactos demoníacos'],
        ['occult_necromancy', 'Necromancia ativa'],
        ['occult_masked_order', 'Ordem mascarada'],
        ['occult_inquisition', 'Inquisição presente'],
        ['occult_heretic_preachers', 'Pregadores hereges'],
        ['occult_corrupt_relic', 'Relíquia corrompida'],
        ['occult_hidden_shrine', 'Santuário oculto'],
        ['occult_angelic_warning', 'Presságio angelical'],
        ['occult_dream_contagion', 'Sonhos contagiosos'],
        ['occult_false_prophecy', 'Falsa profecia'],
      ],
    },
    divine_influence: {
      label: 'Influência divina/profana',
      items: [
        ['divine_blessing', 'Bênção regional'],
        ['divine_curse', 'Maldição regional'],
        ['divine_holy_aura', 'Aura sagrada'],
        ['divine_profane_aura', 'Aura profana'],
        ['divine_spirit_activity', 'Espíritos ativos'],
        ['divine_undead_restless', 'Mortos inquietos'],
        ['divine_fey_glamour', 'Glamour feérico'],
        ['divine_draconic_omen', 'Presságio dracônico'],
        ['divine_saint_route', 'Rota de santos'],
        ['divine_punishment', 'Castigo divino'],
        ['divine_miracle_economy', 'Milagre afetando comércio'],
        ['divine_sacrificial_demand', 'Exigência sacrificial'],
      ],
    },
  },

  danger: {
    local_security: {
      label: 'Segurança local',
      items: [
        ['security_safe', 'Seguro'],
        ['security_guarded', 'Bem guardado'],
        ['security_watchful', 'Vigilância constante'],
        ['security_unsafe_alleys', 'Becos inseguros'],
        ['security_crime_high', 'Criminalidade alta'],
        ['security_assassins', 'Assassinos ativos'],
        ['security_kidnappings', 'Sequestros frequentes'],
        ['security_missing_people', 'Desaparecimentos'],
        ['security_corrupt_guard', 'Guarda corrupta'],
        ['security_no_law', 'Sem lei efetiva'],
        ['security_curfew', 'Toque de recolher'],
        ['security_paranoia', 'Paranoia generalizada'],
      ],
    },
    monsters: {
      label: 'Ameaças monstruosas',
      items: [
        ['monster_none', 'Sem ameaça monstruosa'],
        ['monster_wolves', 'Bandos de feras'],
        ['monster_undead', 'Mortos-vivos próximos'],
        ['monster_demons', 'Demônios rondando'],
        ['monster_dragons', 'Ameaça dracônica'],
        ['monster_giants', 'Gigantes hostis'],
        ['monster_aberrations', 'Aberrações'],
        ['monster_swarms', 'Enxames perigosos'],
        ['monster_sea_threat', 'Ameaça marítima'],
        ['monster_sky_threat', 'Ameaça aérea'],
        ['monster_dungeon_leak', 'Masmorra vazando perigo'],
        ['monster_boss_presence', 'Presença de criatura superior'],
      ],
    },
    environment: {
      label: 'Ambiente perigoso',
      items: [
        ['env_safe_roads', 'Estradas seguras'],
        ['env_bad_roads', 'Estradas ruins'],
        ['env_poison_fog', 'Névoa venenosa'],
        ['env_arcane_storms', 'Tempestades arcanas'],
        ['env_cursed_land', 'Terra amaldiçoada'],
        ['env_sinkholes', 'Sumidouros'],
        ['env_lava_faults', 'Fendas de lava'],
        ['env_flooded_paths', 'Caminhos alagados'],
        ['env_frostbite', 'Frio mortal'],
        ['env_desert_heat', 'Calor extremo'],
        ['env_falling_ruins', 'Ruínas instáveis'],
        ['env_planar_instability', 'Instabilidade planar'],
      ],
    },
    threat_level: {
      label: 'Nível de ameaça',
      items: [
        ['threat_low', 'Baixo risco'],
        ['threat_moderate', 'Risco moderado'],
        ['threat_dangerous', 'Perigoso'],
        ['threat_very_dangerous', 'Muito perigoso'],
        ['threat_extreme', 'Extremamente perigoso'],
        ['threat_deadly', 'Zona mortal'],
        ['threat_corrupted', 'Zona corrompida'],
        ['threat_forbidden', 'Entrada proibida'],
        ['threat_expedition_only', 'Só com expedição armada'],
        ['threat_gm_warning', 'Alerta GM'],
        ['threat_bounty_active', 'Recompensa ativa'],
        ['threat_unknown', 'Perigo desconhecido'],
      ],
    },
  },

  commerce: {
    market_health: {
      label: 'Saúde do mercado',
      items: [
        ['market_prosperous', 'Mercado próspero'],
        ['market_stable', 'Mercado estável'],
        ['market_volatile', 'Mercado volátil'],
        ['market_decline', 'Mercado em queda'],
        ['market_black_market', 'Mercado negro ativo'],
        ['market_smuggling', 'Contrabando forte'],
        ['market_shortage', 'Escassez de produtos'],
        ['market_surplus', 'Excedente comercial'],
        ['market_luxury', 'Luxo e raridades'],
        ['market_basic_goods', 'Bens básicos abundantes'],
        ['market_guild_monopoly', 'Monopólio de guilda'],
        ['market_foreign_investment', 'Investimento estrangeiro'],
      ],
    },
    trade_routes: {
      label: 'Rotas e circulação',
      items: [
        ['trade_open_roads', 'Rotas abertas'],
        ['trade_blockade', 'Bloqueio comercial'],
        ['trade_toll_heavy', 'Pedágios abusivos'],
        ['trade_caravan_boost', 'Caravanas frequentes'],
        ['trade_port_active', 'Porto ativo'],
        ['trade_air_routes', 'Rotas aéreas'],
        ['trade_underground_routes', 'Rotas subterrâneas'],
        ['trade_interracial_routes', 'Comércio inter-racial'],
        ['trade_dungeon_supply', 'Suprimento de masmorras'],
        ['trade_military_supply', 'Suprimento militar'],
        ['trade_piracy', 'Pirataria comercial'],
        ['trade_route_collapse', 'Rota em colapso'],
      ],
    },
    resources: {
      label: 'Recursos',
      items: [
        ['resource_food', 'Alimentos'],
        ['resource_ore', 'Minérios'],
        ['resource_wood', 'Madeira'],
        ['resource_mana_crystals', 'Cristais de mana'],
        ['resource_relics', 'Relíquias'],
        ['resource_textiles', 'Tecidos'],
        ['resource_alchemy', 'Ingredientes alquímicos'],
        ['resource_weapons', 'Armas'],
        ['resource_armor', 'Armaduras'],
        ['resource_slaves', 'Tráfico de escravos'],
        ['resource_bones', 'Ossos e restos'],
        ['resource_dragon_parts', 'Partes dracônicas'],
      ],
    },
    economy_policy: {
      label: 'Política econômica',
      items: [
        ['econ_low_taxes', 'Baixos impostos'],
        ['econ_high_taxes', 'Altos impostos'],
        ['econ_tariffs', 'Tarifas externas'],
        ['econ_guild_support', 'Apoio das guildas'],
        ['econ_guild_restriction', 'Restrição às guildas'],
        ['econ_trade_agreement', 'Acordo comercial'],
        ['econ_sanctions', 'Sanções comerciais'],
        ['econ_subsidies', 'Subsídios públicos'],
        ['econ_price_control', 'Controle de preços'],
        ['econ_counterfeit', 'Moeda falsa'],
        ['econ_debt_crisis', 'Crise de dívida'],
        ['econ_war_economy', 'Economia de guerra'],
      ],
    },
  },

  war: {
    war_status: {
      label: 'Estado bélico',
      items: [
        ['war_peace', 'Paz armada'],
        ['war_tension', 'Tensão militar'],
        ['war_skirmishes', 'Escaramuças'],
        ['war_open_war', 'Guerra aberta'],
        ['war_civil_war', 'Guerra civil'],
        ['war_siege', 'Cerco ativo'],
        ['war_occupation', 'Ocupação militar'],
        ['war_lost_zone', 'Zona perdida'],
        ['war_mobilization', 'Mobilização geral'],
        ['war_demobilization', 'Desmobilização'],
        ['war_ceasefire', 'Cessar-fogo frágil'],
        ['war_total_war', 'Guerra total'],
      ],
    },
    forces: {
      label: 'Forças presentes',
      items: [
        ['forces_local_militia', 'Milícia local'],
        ['forces_regular_army', 'Exército regular'],
        ['forces_elite_guard', 'Guarda de elite'],
        ['forces_mercenaries', 'Mercenários'],
        ['forces_knights', 'Cavaleiros'],
        ['forces_mages', 'Magos de guerra'],
        ['forces_siege_engines', 'Máquinas de cerco'],
        ['forces_naval', 'Força naval'],
        ['forces_air', 'Força aérea'],
        ['forces_spies', 'Espiões militares'],
        ['forces_undead_legion', 'Legião morta-viva'],
        ['forces_demonic_host', 'Hoste demoníaca'],
      ],
    },
    battle_events: {
      label: 'Batalhas/embates',
      items: [
        ['battle_recent', 'Batalha recente'],
        ['battle_imminent', 'Batalha iminente'],
        ['battle_massacre', 'Massacre'],
        ['battle_ambushes', 'Emboscadas'],
        ['battle_duel_champions', 'Duelo de campeões'],
        ['battle_border_raids', 'Ataques de fronteira'],
        ['battle_supply_attack', 'Ataque a suprimentos'],
        ['battle_broken_lines', 'Linhas rompidas'],
        ['battle_fortress_fall', 'Queda de fortaleza'],
        ['battle_rebel_victory', 'Vitória rebelde'],
        ['battle_pyrrhic_victory', 'Vitória pírrica'],
        ['battle_stalemate', 'Impasse militar'],
      ],
    },
    aftermath: {
      label: 'Consequências',
      items: [
        ['after_refugees', 'Refugiados'],
        ['after_burned_fields', 'Campos queimados'],
        ['after_mines_trapped', 'Minas armadilhadas'],
        ['after_mass_graves', 'Valas comuns'],
        ['after_looting', 'Saque generalizado'],
        ['after_martial_law', 'Lei marcial'],
        ['after_war_tax', 'Imposto de guerra'],
        ['after_veterans', 'Veteranos feridos'],
        ['after_orphans', 'Órfãos de guerra'],
        ['after_reconstruction', 'Reconstrução'],
        ['after_revenge_oaths', 'Juramentos de vingança'],
        ['after_unstable_peace', 'Paz instável'],
      ],
    },
  },
};


WORLD_VISION_CATEGORY_OPTIONS.expanded = {
  access: {
    label: 'Liberação aos jogadores',
    items: [
      ['expanded_visible', 'Liberar info expandida aos jogadores'],
    ],
  },
};

const WORLD_VISION_COLORS = {
  political: ['#7aa7ff', '#fbc531', '#ff9f43', '#ff4757'],
  religion: ['#74c7ec', '#f5d76e', '#cba6f7', '#8e44ad'],
  danger: ['#7bed9f', '#fbc531', '#ff9f43', '#ff4757', '#2f0202'],
  commerce: ['#f5d76e', '#2ecc71', '#fbc531', '#ff6b6b', '#c56cf0'],
  war: ['#fbc531', '#ff9f43', '#ff4757', '#7f1d1d', '#111827'],
  expanded: ['#7aa7ff', '#2ecc71'],
};

function ensureWorldVisionState() {
  if (!state.worldState || typeof state.worldState !== 'object') state.worldState = { rev: 0, updatedAt: 0, climate: { regions: {} } };
  if (!state.worldState.climate) state.worldState.climate = { regions: {} };
  if (!state.worldState.vision || typeof state.worldState.vision !== 'object') state.worldState.vision = { pins: {} };
  if (!state.worldState.vision.pins || typeof state.worldState.vision.pins !== 'object') state.worldState.vision.pins = {};
  if (!state.worldState.groupReputation || typeof state.worldState.groupReputation !== 'object') state.worldState.groupReputation = { pins: {} };
  if (!state.worldState.groupReputation.pins || typeof state.worldState.groupReputation.pins !== 'object') state.worldState.groupReputation.pins = {};
  if (!state.worldState.rumors || typeof state.worldState.rumors !== 'object') state.worldState.rumors = { pins: {} };
  if (!state.worldState.rumors.pins || typeof state.worldState.rumors.pins !== 'object') state.worldState.rumors.pins = {};
  return state.worldState.vision;
}

function mergeWorldStateFromData(data) {
  if (!data || typeof data !== 'object') return;
  ensureWorldVisionState();
  const incomingPins = data.vision && data.vision.pins && typeof data.vision.pins === 'object' ? data.vision.pins : null;
  if (incomingPins) {
    for (const id of Object.keys(incomingPins)) {
      if (!state.worldState.vision.pins[id]) state.worldState.vision.pins[id] = incomingPins[id];
    }
  }
  const incomingRep = data.groupReputation && data.groupReputation.pins && typeof data.groupReputation.pins === 'object' ? data.groupReputation.pins : null;
  if (incomingRep) {
    if (!state.worldState.groupReputation) state.worldState.groupReputation = { pins:{} };
    for (const id of Object.keys(incomingRep)) if (!state.worldState.groupReputation.pins[id]) state.worldState.groupReputation.pins[id] = incomingRep[id];
  }
  const incomingRumors = data.rumors && data.rumors.pins && typeof data.rumors.pins === 'object' ? data.rumors.pins : null;
  if (incomingRumors) {
    if (!state.worldState.rumors) state.worldState.rumors = { pins:{} };
    for (const id of Object.keys(incomingRumors)) if (!state.worldState.rumors.pins[id]) state.worldState.rumors.pins[id] = incomingRumors[id];
  }
}

function worldVisionAllOptions() {
  const out = new Map();
  for (const vision of Object.keys(WORLD_VISION_CATEGORY_OPTIONS)) {
    for (const cat of Object.values(WORLD_VISION_CATEGORY_OPTIONS[vision])) {
      for (const [value, label] of cat.items) out.set(value, label);
    }
  }
  return out;
}

const WORLD_VISION_OPTION_LABELS = worldVisionAllOptions();

function worldVisionOptionLabel(value) {
  return WORLD_VISION_OPTION_LABELS.get(value) || value;
}

function getWorldVisionSelection() {
  const typeEl = document.getElementById('worldVisionTypeSelect');
  const raceEl = document.getElementById('worldVisionRaceSelect');
  const visionEl = document.getElementById('worldVisionVisionSelect');
  const locWrap = document.getElementById('worldVisionLocations');
  const type = typeEl ? typeEl.value : '';
  const race = raceEl ? raceEl.value : '';
  const vision = visionEl ? visionEl.value : '';
  const all = !!(locWrap && locWrap.querySelector('input[data-wv-all]') && locWrap.querySelector('input[data-wv-all]').checked);
  const selectedIds = [];
  if (locWrap) {
    locWrap.querySelectorAll('input[data-wv-location]:checked').forEach(chk => selectedIds.push(chk.value));
  }
  const availableIds = [];
  if (locWrap) {
    locWrap.querySelectorAll('input[data-wv-location]').forEach(chk => availableIds.push(chk.value));
  }
  return { type, race, vision, all, selectedIds, availableIds, targetIds: all ? availableIds : selectedIds };
}

function getWorldVisionFilteredPins(type, race) {
  const pins = Array.isArray(state.pins) ? state.pins : [];
  return pins.filter(p => {
    if (!p || !p.id) return false;
    if (type && type !== 'all' && p.type !== type) return false;
    if (race && race !== 'all' && (p.territory || '') !== race) return false;
    if (p.type === 'region_label') return false;
    return true;
  }).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), 'pt-BR'));
}

function worldVisionTargets() {
  const sel = getWorldVisionSelection();
  return sel.targetIds.map(id => (state.pins || []).find(p => p.id === id)).filter(Boolean);
}

function selectedWorldVisionStates() {
  const wrap = document.getElementById('worldVisionStates');
  const out = {};
  if (!wrap) return out;
  wrap.querySelectorAll('input[data-wv-state]:checked').forEach(chk => {
    const cat = chk.getAttribute('data-wv-category') || 'geral';
    if (!out[cat]) out[cat] = [];
    out[cat].push(chk.value);
  });
  return out;
}

function selectedWorldVisionStatesCount(statesObj) {
  return Object.values(statesObj || {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
}

function populateWorldVisionTypeSelect() {
  const el = document.getElementById('worldVisionTypeSelect');
  if (!el) return;
  el.innerHTML = '';
  for (const t of WORLD_VISION_TYPES) {
    const opt = document.createElement('option');
    opt.value = t.value;
    opt.textContent = t.label;
    el.appendChild(opt);
  }
}

function populateWorldVisionRaceSelect() {
  const typeEl = document.getElementById('worldVisionTypeSelect');
  const raceEl = document.getElementById('worldVisionRaceSelect');
  if (!raceEl) return;
  const type = typeEl ? typeEl.value : '';
  raceEl.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = 'Todas';
  raceEl.appendChild(optAll);
  const races = Object.keys(TERRITORY_COLORS || {}).sort((a, b) => raceLabel(a).localeCompare(raceLabel(b), 'pt-BR'));
  for (const r of races) {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = raceLabel(r);
    raceEl.appendChild(opt);
  }
  raceEl.disabled = !type;
}

function renderWorldVisionLocations() {
  const type = document.getElementById('worldVisionTypeSelect')?.value || '';
  const race = document.getElementById('worldVisionRaceSelect')?.value || '';
  const visionEl = document.getElementById('worldVisionVisionSelect');
  const wrap = document.getElementById('worldVisionLocations');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.classList.toggle('disabled', !type || !race);
  if (!type) {
    wrap.innerHTML = '<div class="wv-empty">Escolha primeiro o tipo de local.</div>';
    if (visionEl) visionEl.disabled = true;
    renderWorldVisionStates();
    updateWorldVisionSummary();
    return;
  }
  if (!race) {
    wrap.innerHTML = '<div class="wv-empty">Escolha a raça.</div>';
    if (visionEl) visionEl.disabled = true;
    renderWorldVisionStates();
    updateWorldVisionSummary();
    return;
  }
  const pins = getWorldVisionFilteredPins(type, race);
  if (!pins.length) {
    wrap.innerHTML = '<div class="wv-empty">Nenhum local encontrado para essa combinação.</div>';
    if (visionEl) visionEl.disabled = true;
    renderWorldVisionStates();
    updateWorldVisionSummary();
    return;
  }
  const allLabel = document.createElement('label');
  allLabel.className = 'wv-check wv-check-all';
  allLabel.innerHTML = `<input type="checkbox" data-wv-all checked> <span>Todos os ${pins.length} locais listados</span>`;
  wrap.appendChild(allLabel);
  const allChk = allLabel.querySelector('input');
  allChk.addEventListener('change', () => updateWorldVisionSummary());

  const list = document.createElement('div');
  list.className = 'wv-location-grid';
  for (const p of pins) {
    const lbl = document.createElement('label');
    lbl.className = 'wv-check';
    lbl.innerHTML = `<input type="checkbox" data-wv-location value="${escapeHtml(p.id)}"> <span>${escapeHtml(p.name || p.id)} <em>${escapeHtml(layerLabel(p.layer))}</em></span>`;
    const chk = lbl.querySelector('input');
    chk.addEventListener('change', () => {
      if (allChk && chk.checked) allChk.checked = false;
      updateWorldVisionSummary();
    });
    list.appendChild(lbl);
  }
  wrap.appendChild(list);
  if (visionEl) visionEl.disabled = false;
  renderWorldVisionStates();
  updateWorldVisionSummary();
}

function renderWorldVisionStates() {
  const vision = document.getElementById('worldVisionVisionSelect')?.value || '';
  const wrap = document.getElementById('worldVisionStates');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.classList.toggle('disabled', !vision);
  if (!vision) {
    wrap.innerHTML = '<div class="wv-empty">Escolha a visão para liberar as opções.</div>';
    updateWorldVisionSummary();
    return;
  }
  const cfg = WORLD_VISION_CATEGORY_OPTIONS[vision] || {};
  for (const [catKey, cat] of Object.entries(cfg)) {
    const block = document.createElement('div');
    block.className = 'wv-category';
    const head = document.createElement('div');
    head.className = 'wv-category-title';
    head.textContent = cat.label;
    block.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'wv-state-grid';
    for (const [value, label] of cat.items) {
      const lbl = document.createElement('label');
      lbl.className = 'wv-check';
      lbl.innerHTML = `<input type="checkbox" data-wv-state data-wv-category="${escapeHtml(catKey)}" value="${escapeHtml(value)}"> <span>${escapeHtml(label)}</span>`;
      lbl.querySelector('input').addEventListener('change', updateWorldVisionSummary);
      grid.appendChild(lbl);
    }
    block.appendChild(grid);
    wrap.appendChild(block);
  }
  updateWorldVisionSummary();
}

function updateWorldVisionSummary() {
  const out = document.getElementById('worldVisionSummary');
  if (!out) return;
  const sel = getWorldVisionSelection();
  const states = selectedWorldVisionStates();
  const stateCount = selectedWorldVisionStatesCount(states);
  const targets = sel.targetIds.length;
  const typeText = WORLD_VISION_TYPES.find(x => x.value === sel.type)?.label || '—';
  const raceText = sel.race ? (sel.race === 'all' ? 'Todas' : raceLabel(sel.race)) : '—';
  const visionText = sel.vision ? WORLD_VISION_LABELS[sel.vision] : '—';
  out.innerHTML = `<b>Resumo:</b> ${escapeHtml(typeText)} • ${escapeHtml(raceText)} • ${escapeHtml(visionText)} • ${targets} local(is) alvo • ${stateCount} estado(s) marcado(s).`;
}

function openWorldVisionPanel() {
  if (!state.gm || !state.gm.unlocked) return;
  ensureWorldVisionState();
  const bd = document.getElementById('worldVisionBackdrop');
  if (!bd) return;
  bd.classList.remove('hidden');
  populateWorldVisionTypeSelect();
  populateWorldVisionRaceSelect();
  renderWorldVisionLocations();
  renderWorldVisionStates();
  updateWorldVisionSummary();
}

function closeWorldVisionPanel() {
  const bd = document.getElementById('worldVisionBackdrop');
  if (bd) bd.classList.add('hidden');
}

function worldVisionTouch() {
  ensureWorldVisionState();
  state.worldState.updatedAt = Date.now();
  state.worldState.rev = Number(state.worldState.rev || 0) + 1;
  persistState();
  try { if (typeof WorldSync !== 'undefined' && WorldSync && typeof WorldSync.pushWorldState === 'function') WorldSync.pushWorldState('world_vision'); } catch (_) {}
  try { update(); } catch (_) {}
}

function applyWorldVisionStates() {
  const sel = getWorldVisionSelection();
  if (!sel.vision) { alert('Escolha uma visão primeiro.'); return; }
  if (!sel.targetIds.length) { alert('Escolha pelo menos um local.'); return; }
  const chosen = selectedWorldVisionStates();
  if (!selectedWorldVisionStatesCount(chosen)) { alert('Marque ao menos um estado.'); return; }
  const vision = ensureWorldVisionState();
  for (const id of sel.targetIds) {
    if (!vision.pins[id]) vision.pins[id] = { states: {} };
    if (!vision.pins[id].states) vision.pins[id].states = {};
    if (!vision.pins[id].states[sel.vision]) vision.pins[id].states[sel.vision] = {};
    for (const [cat, values] of Object.entries(chosen)) {
      const current = new Set(Array.isArray(vision.pins[id].states[sel.vision][cat]) ? vision.pins[id].states[sel.vision][cat] : []);
      for (const v of values) current.add(v);
      vision.pins[id].states[sel.vision][cat] = Array.from(current);
    }
    vision.pins[id].updatedAt = Date.now();
  }
  worldVisionTouch();
  updateWorldVisionSummary();
  alert(`Estados aplicados em ${sel.targetIds.length} local(is).`);
}

function removeWorldVisionStates() {
  const sel = getWorldVisionSelection();
  if (!sel.vision) { alert('Escolha uma visão primeiro.'); return; }
  if (!sel.targetIds.length) { alert('Escolha pelo menos um local.'); return; }
  const chosen = selectedWorldVisionStates();
  if (!selectedWorldVisionStatesCount(chosen)) { alert('Marque os estados que deseja remover.'); return; }
  const vision = ensureWorldVisionState();
  for (const id of sel.targetIds) {
    const rec = vision.pins[id]?.states?.[sel.vision];
    if (!rec) continue;
    for (const [cat, values] of Object.entries(chosen)) {
      if (!Array.isArray(rec[cat])) continue;
      const removeSet = new Set(values);
      rec[cat] = rec[cat].filter(v => !removeSet.has(v));
      if (!rec[cat].length) delete rec[cat];
    }
    if (!Object.keys(rec).length) delete vision.pins[id].states[sel.vision];
    if (!Object.keys(vision.pins[id].states || {}).length) delete vision.pins[id];
  }
  worldVisionTouch();
  updateWorldVisionSummary();
  alert(`Estados removidos dos locais selecionados.`);
}

function clearWorldVisionSelection() {
  const sel = getWorldVisionSelection();
  if (!sel.targetIds.length) { alert('Escolha pelo menos um local.'); return; }
  const vision = ensureWorldVisionState();
  const label = sel.vision ? WORLD_VISION_LABELS[sel.vision] : 'todas as visões';
  if (!confirm(`Limpar ${label} de ${sel.targetIds.length} local(is)?`)) return;
  for (const id of sel.targetIds) {
    if (!vision.pins[id]) continue;
    if (sel.vision && vision.pins[id].states) {
      delete vision.pins[id].states[sel.vision];
      if (!Object.keys(vision.pins[id].states).length) delete vision.pins[id];
    } else {
      delete vision.pins[id];
    }
  }
  worldVisionTouch();
  updateWorldVisionSummary();
}

function exportWorldVisionState() {
  ensureWorldVisionState();
  const box = document.getElementById('worldVisionJsonBox');
  if (!box) return;
  if (typeof CampaignState !== 'undefined' && CampaignState && typeof CampaignState.build === 'function') {
    box.value = JSON.stringify(CampaignState.build(), null, 2);
  } else {
    box.value = JSON.stringify({ schema: 'eldralore_campaign_state_v1', version: 1, worldTime: state.worldTime, worldState: state.worldState, economy: state.economy, campaign: state.campaign, vision: state.worldState.vision }, null, 2);
  }
  box.focus();
  box.select();
}

function importWorldVisionState() {
  const box = document.getElementById('worldVisionJsonBox');
  if (!box) return;
  let obj;
  try { obj = JSON.parse(box.value || '{}'); } catch (e) { alert('JSON inválido.'); return; }
  if (typeof CampaignState !== 'undefined' && CampaignState && typeof CampaignState.apply === 'function' && (obj.schema || obj.worldState || obj.worldTime || obj.campaign || obj.economy)) {
    CampaignState.apply(obj, { persist: true, refresh: true });
    updateWorldVisionSummary();
    alert('Estado da campanha importado.');
    return;
  }
  const incoming = obj.vision && obj.vision.pins ? obj.vision : (obj.pins ? obj : null);
  if (!incoming || !incoming.pins || typeof incoming.pins !== 'object') { alert('JSON sem estrutura vision.pins.'); return; }
  ensureWorldVisionState();
  state.worldState.vision = { pins: incoming.pins };
  worldVisionTouch();
  alert('Estado do mundo importado.');
}

function bindWorldVisionPanel() {
  const btn = document.getElementById('gmWorldVisionBtn');
  const closeBtn = document.getElementById('closeWorldVision');
  const bd = document.getElementById('worldVisionBackdrop');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      if (!state.gm || !state.gm.unlocked) return;
      openWorldVisionPanel();
    });
  }
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', closeWorldVisionPanel);
  }
  if (bd && !bd.dataset.bound) {
    bd.dataset.bound = '1';
    bd.addEventListener('click', e => { if (e.target === bd) closeWorldVisionPanel(); });
  }
  const typeEl = document.getElementById('worldVisionTypeSelect');
  const raceEl = document.getElementById('worldVisionRaceSelect');
  const visionEl = document.getElementById('worldVisionVisionSelect');
  if (typeEl && !typeEl.dataset.bound) {
    typeEl.dataset.bound = '1';
    typeEl.addEventListener('change', () => { populateWorldVisionRaceSelect(); renderWorldVisionLocations(); });
  }
  if (raceEl && !raceEl.dataset.bound) {
    raceEl.dataset.bound = '1';
    raceEl.addEventListener('change', renderWorldVisionLocations);
  }
  if (visionEl && !visionEl.dataset.bound) {
    visionEl.dataset.bound = '1';
    visionEl.addEventListener('change', renderWorldVisionStates);
  }
  const applyBtn = document.getElementById('worldVisionApplyBtn');
  const removeBtn = document.getElementById('worldVisionRemoveBtn');
  const clearBtn = document.getElementById('worldVisionClearBtn');
  const exportBtn = document.getElementById('worldVisionExportBtn');
  const importBtn = document.getElementById('worldVisionImportBtn');
  if (applyBtn && !applyBtn.dataset.bound) { applyBtn.dataset.bound = '1'; applyBtn.addEventListener('click', applyWorldVisionStates); }
  if (removeBtn && !removeBtn.dataset.bound) { removeBtn.dataset.bound = '1'; removeBtn.addEventListener('click', removeWorldVisionStates); }
  if (clearBtn && !clearBtn.dataset.bound) { clearBtn.dataset.bound = '1'; clearBtn.addEventListener('click', clearWorldVisionSelection); }
  if (exportBtn && !exportBtn.dataset.bound) { exportBtn.dataset.bound = '1'; exportBtn.addEventListener('click', exportWorldVisionState); }
  if (importBtn && !importBtn.dataset.bound) { importBtn.dataset.bound = '1'; importBtn.addEventListener('click', importWorldVisionState); }
}

function getWorldVisionRecord(pin) {
  if (!pin || !pin.id) return null;
  ensureWorldVisionState();
  return state.worldState.vision.pins[pin.id] || null;
}

function isExpandedInfoReleasedForPin(pin) {
  const rec = getWorldVisionRecord(pin);
  const arr = rec && rec.states && rec.states.expanded && Array.isArray(rec.states.expanded.access) ? rec.states.expanded.access : [];
  return arr.includes('expanded_visible');
}

function countWorldVisionStatesForVision(pin, vision) {
  const rec = getWorldVisionRecord(pin);
  const block = rec && rec.states && rec.states[vision] ? rec.states[vision] : null;
  if (!block) return 0;
  return Object.values(block).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
}

function getWorldVisionAutoMeta(pin, vision) {
  if (!pin || !vision || vision === 'default') return null;
  const type = pin.type;
  if (vision === 'political' && ['city_main', 'fortress', 'settlement', 'guild_hq'].includes(type)) return { auto: true, label: 'Relevância política', color: TYPE_COLORS[type] || TERRITORY_COLORS[pin.territory] || '#7aa7ff', level: 'low' };
  if (vision === 'religion' && type === 'temple') return { auto: true, label: 'Relevância religiosa', color: '#f5d76e', level: 'medium' };
  if (vision === 'danger' && type === 'dungeon') return { auto: true, label: 'Perigo natural do local', color: '#ff4757', level: 'high' };
  if (vision === 'danger' && type === 'fortress') return { auto: true, label: 'Área militarizada', color: '#ff9f43', level: 'medium' };
  if (vision === 'commerce' && ['city_main', 'settlement', 'guild_hq'].includes(type)) return { auto: true, label: 'Possível nó comercial', color: '#f5d76e', level: 'low' };
  if (vision === 'war' && type === 'fortress') return { auto: true, label: 'Valor bélico', color: '#ff4757', level: 'medium' };
  if (vision === 'war' && type === 'dungeon') return { auto: true, label: 'Zona de risco bélico', color: '#7f1d1d', level: 'medium' };
  return null;
}

function getWorldVisionMeta(pin, vision) {
  if (!vision || vision === 'default') return null;
  if (!WORLD_VISION_LABELS[vision]) return null;
  const count = countWorldVisionStatesForVision(pin, vision);
  if (count > 0) {
    const colors = WORLD_VISION_COLORS[vision] || ['#ffffff'];
    let level = 'low';
    if (count >= 9) level = 'extreme';
    else if (count >= 5) level = 'high';
    else if (count >= 3) level = 'medium';
    const idx = level === 'extreme' ? colors.length - 1 : level === 'high' ? Math.min(colors.length - 2, 3) : level === 'medium' ? Math.min(2, colors.length - 1) : 0;
    return { hasState: true, count, vision, label: `${WORLD_VISION_LABELS[vision]}: ${count} estado(s)`, color: colors[idx] || colors[0], level };
  }
  return getWorldVisionAutoMeta(pin, vision);
}

function getWorldVisionTooltipLine(pin) {
  const vision = state.preset || 'default';
  const meta = getWorldVisionMeta(pin, vision);
  if (!meta) return '';
  return meta.hasState ? meta.label : `${meta.label} (automático)`;
}

function renderWorldVisionForPin(pin) {
  const rec = getWorldVisionRecord(pin);
  if (!rec || !rec.states) return '';
  const chunks = [];
  for (const [vision, cats] of Object.entries(rec.states)) {
    if (vision === 'expanded') continue; // liberação técnica; não precisa aparecer como estado público
    const categoryParts = [];
    for (const [catKey, values] of Object.entries(cats || {})) {
      if (!Array.isArray(values) || !values.length) continue;
      const catLabel = WORLD_VISION_CATEGORY_OPTIONS[vision]?.[catKey]?.label || catKey;
      const labels = values.map(worldVisionOptionLabel).join(', ');
      categoryParts.push(`<div class="wv-popup-cat"><b>${escapeHtml(catLabel)}:</b> ${escapeHtml(labels)}</div>`);
    }
    if (categoryParts.length) {
      chunks.push(`<div class="wv-popup-vision"><div class="wv-popup-title">${escapeHtml(WORLD_VISION_LABELS[vision] || vision)}</div>${categoryParts.join('')}</div>`);
    }
  }
  if (!chunks.length) return '';
  return `<div class="world-vision-popup"><b>Visão do Mundo (GM)</b>${chunks.join('')}</div>`;
}
