// -------- Item bank (~3200 itens) --------

function generateItemsBank() {
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
  for (let i = 0; i < 100; i++) {
    const base = weapons[i % weapons.length];
    const mod = weaponMods[Math.floor(i / weapons.length) % weaponMods.length];
    items.push({ id: `it_${id++}`, category: 'combat', baseName: `${base} ${mod}`, kind: 'weapon' });
  }
  for (let i = 0; i < 100; i++) {
    const base = armors[i % armors.length];
    const mod = armorMods[Math.floor(i / armors.length) % armorMods.length];
    items.push({ id: `it_${id++}`, category: 'combat', baseName: `${base} ${mod}`, kind: 'armor' });
  }

  // 100 acessórios
  for (let i = 0; i < 100; i++) {
    const base = accessories[i % accessories.length];
    const mod = accMods[Math.floor(i / accessories.length) % accMods.length];
    items.push({ id: `it_${id++}`, category: 'accessory', baseName: `${base} ${mod}`, kind: 'accessory' });
  }

  // 700 misc
  for (let i = 0; i < 300; i++) {
    const base = potions[i % potions.length];
    items.push({ id: `it_${id++}`, category: 'consumable', baseName: base, kind: 'potion' });
  }
  for (let i = 0; i < 200; i++) {
    const base = scrolls[i % scrolls.length];
    items.push({ id: `it_${id++}`, category: 'consumable', baseName: base, kind: 'scroll' });
  }
  for (let i = 0; i < 120; i++) {
    const base = tools[i % tools.length];
    items.push({ id: `it_${id++}`, category: 'utility', baseName: base, kind: 'tool' });
  }
  for (let i = 0; i < 80; i++) {
    const base = oddities[i % oddities.length];
    items.push({ id: `it_${id++}`, category: 'odd', baseName: base, kind: 'oddity' });
  }

  // Expansao: gera ate ~3200 itens (leve) combinando material e qualidade.
  const mats = ['Ferro', 'Aco', 'Aco Refinado', 'Mithril', 'Adamantina', 'Obsidiana', 'Couro Curtido'];
  const quals = ['Comum', 'Alta Qualidade', 'Obra-prima'];
  const weaponBase = ['Espada', 'Machado', 'Lanca', 'Adaga', 'Arco', 'Besta', 'Marreta', 'Cimitarra', 'Cajado', 'Chicote'];
  const armorBase = ['Elmo', 'Peitoral', 'Grevas', 'Manoplas', 'Escudo', 'Cota de Malha', 'Armadura Completa'];

  while (items.length < 3200) {
    const i = items.length;
    const mat = mats[i % mats.length];
    const q = quals[Math.floor(i / mats.length) % quals.length];
    if (i % 3 == 0) {
      const b = weaponBase[i % weaponBase.length];
      items.push({ id: `it_${id++}`, category: 'combat', baseName: `${b} de ${mat} (${q})`, kind: 'weapon' });
    } else if (i % 3 == 1) {
      const b = armorBase[i % armorBase.length];
      items.push({ id: `it_${id++}`, category: 'combat', baseName: `${b} de ${mat} (${q})`, kind: 'armor' });
    } else {
      items.push({ id: `it_${id++}`, category: 'utility', baseName: `Suprimento #${id} (${q})`, kind: 'tool' });
    }
  }

  return items.slice(0, 3200);
}

function rarityRoll(rng) {
  // chances:
  // raro: 5% (0.05)
  // muito raro: 0.5% (0.005)
  // artefato não identificado: 0.0001% (0.000001)
  const r = rng();
  if (r < 0.000001) return 'artifact';
  if (r < 0.005) return 'very_rare';
  if (r < 0.05) return 'rare';
  return 'common';
}

function plusSuffix(plus, mode) {
  if (mode === 'rare') {
    if (plus === 5) return '+05';
    return `+${plus}`;
  }
  return `+${plus}`;
}

function basePriceFromName(kind, name) {
  const n = String(name || '').toLowerCase();
  let base = 60;
  if (kind === 'weapon') {
    if (n.includes('adaga')) base = 50;
    else if (n.includes('arco')) base = 100;
    else if (n.includes('besta')) base = 180;
    else if (n.includes('cajado')) base = 80;
    else if (n.includes('chicote')) base = 70;
    else if (n.includes('lanca')) base = 120;
    else if (n.includes('espada')) base = 150;
    else if (n.includes('machado')) base = 160;
    else if (n.includes('cimitarra')) base = 160;
    else if (n.includes('marreta')) base = 220;
    else base = 120;
  }
  if (kind === 'armor') {
    if (n.includes('armadura completa')) base = 4500;
    else if (n.includes('cota de malha')) base = 900;
    else if (n.includes('peitoral')) base = 600;
    else if (n.includes('grevas')) base = 220;
    else if (n.includes('manoplas')) base = 180;
    else if (n.includes('elmo')) base = 120;
    else if (n.includes('escudo')) base = 150;
    else base = 400;
  }
  if (kind === 'accessory') base = 120;
  if (kind === 'potion') base = 25;
  if (kind === 'scroll') base = 60;
  if (kind === 'tool') base = 20;
  if (kind === 'oddity') base = 80;

  let mult = 1.0;
  if (n.includes('aco refinado')) mult *= 1.6;
  else if (n.includes('aco')) mult *= 1.25;
  if (n.includes('mithril')) mult *= 2.8;
  if (n.includes('adamantina')) mult *= 3.4;
  if (n.includes('obsidiana')) mult *= 1.8;
  if (n.includes('couro')) mult *= 0.95;

  if (n.includes('obra-prima')) mult *= 1.55;
  else if (n.includes('alta qualidade')) mult *= 1.25;

  return Math.round(base * mult);
}

function getEconomyMultipliers() {
  let pMult = 1.0;
  let qMult = 1.0;

  if (!state.economy || !Array.isArray(state.economy.modifiers)) return { pMult, qMult };

  for (const mod of state.economy.modifiers) {
    // Negativos (sobem preço, baixam qty)
    if (mod === 'war') { pMult *= 1.5; qMult *= 0.6; }
    if (mod === 'bandits') { pMult *= 1.3; qMult *= 0.8; }
    if (mod === 'guild_thieves') { pMult *= 1.2; qMult *= 0.9; }
    if (mod === 'disaster') { pMult *= 1.6; qMult *= 0.5; }
    if (mod === 'plague') { pMult *= 1.4; qMult *= 0.5; }
    if (mod === 'blockade') { pMult *= 1.8; qMult *= 0.4; }
    if (mod === 'famine') { pMult *= 2.0; qMult *= 0.4; }
    if (mod === 'monster_surge') { pMult *= 1.3; qMult *= 0.7; }
    if (mod === 'corruption') { pMult *= 1.25; qMult *= 1.0; } // só preço
    if (mod === 'high_taxes') { pMult *= 1.2; qMult *= 1.0; }

    // Positivos (baixam preço, sobem qty)
    if (mod === 'peace') { pMult *= 0.8; qMult *= 1.2; }
    if (mod === 'bumper_crop') { pMult *= 0.6; qMult *= 1.5; }
    if (mod === 'trade_agreement') { pMult *= 0.85; qMult *= 1.3; }
    if (mod === 'festival') { pMult *= 0.9; qMult *= 1.2; } // (promoção)
    if (mod === 'new_mine') { pMult *= 0.7; qMult *= 1.4; }
    if (mod === 'magic_abundance') { pMult *= 0.75; qMult *= 1.3; }
    if (mod === 'guild_support') { pMult *= 0.85; qMult *= 1.2; }
    if (mod === 'road_safety') { pMult *= 0.9; qMult *= 1.1; }
    if (mod === 'innovation') { pMult *= 0.8; qMult *= 1.3; }
    if (mod === 'low_taxes') { pMult *= 0.85; qMult *= 1.1; }
  }
  return { pMult, qMult };
}

function priceFor(rarity, plus, baseKind, baseName) {
  const base = basePriceFromName(baseKind, baseName);
  let val = 0;

  if (rarity === 'common') {
    // pequenos ajustes por +1 comum
    val = Math.max(1, Math.round(base + plus * Math.max(5, base * 0.08)));
  } else if (rarity === 'rare') {
    const minBase = 1000;
    val = Math.round(Math.max(minBase, base * 3.0) * (1 + plus * 0.25));
  } else if (rarity === 'very_rare') {
    const minBase = 5000;
    val = Math.round(Math.max(minBase, base * 6.0) * (1 + plus * 0.35));
  } else {
    // artifact
    val = 100000 + Math.round(plus * 25000);
  }

  // Aplica economia
  const { pMult } = getEconomyMultipliers();
  return Math.round(val * pMult);
}

function qtyFor(rarity, kind, rng) {
  let baseQty = 1;

  if (rarity === 'artifact') {
    baseQty = 1;
  } else if (kind === 'weapon' || kind === 'armor' || kind === 'accessory') {
    baseQty = rarity === 'common' ? (1 + Math.floor(rng() * 3)) : 1;
  } else if (kind === 'potion' || kind === 'scroll') {
    // consumables
    baseQty = rarity === 'common' ? (2 + Math.floor(rng() * 10)) : (1 + Math.floor(rng() * 3));
  } else {
    baseQty = 1 + Math.floor(rng() * 8);
  }

  const { qMult } = getEconomyMultipliers();
  return Math.max(1, Math.floor(baseQty * qMult));
}

function pickFrom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function merchantCategoryFilter(merchantType) {
  // mapeia o que cada comerciante pode vender
  if (merchantType === 'blacksmith') return new Set(['combat']);
  if (merchantType === 'tailor') return new Set(['combat', 'accessory']);
  if (merchantType === 'alchemy') return new Set(['consumable']);
  if (merchantType === 'general') return new Set(['utility', 'consumable', 'odd', 'accessory']);
  if (merchantType === 'tavern') return new Set(['consumable', 'utility', 'odd']);
  if (merchantType === 'inn') return new Set(['utility', 'consumable']);
  if (merchantType === 'curiosities') return new Set(['odd', 'utility', 'accessory']);
  // fallback
  return new Set(['combat', 'accessory', 'consumable', 'utility', 'odd']);
}

function inventoryKey(cityId, placeId, merchantId) {
  // Inclui placeId para evitar colisão de inventários entre locais diferentes
  // (ex.: m1 de uma alquimia vs m1 de um ferreiro no mesmo dia).
  return `${cityId}|${placeId}|${merchantId}|${state.worldTime.year}-${state.worldTime.month}-${state.worldTime.day}`;
}

function generateInventory({ cityId, placeId, merchantId, merchantType }) {
  const key = inventoryKey(cityId, placeId, merchantId);
  if (state.merchantState && Array.isArray(state.merchantState[key])) {
    return state.merchantState[key];
  }

  const seed = hashStringToUint32(`inv|${key}`);
  const rng = mulberry32(seed);

  const allowed = merchantCategoryFilter(merchantType);
  const pool = state.items.filter(it => allowed.has(it.category));

  const inv = [];
  const used = new Set();

  for (let i = 0; i < 20; i++) {
    const rarity = rarityRoll(rng);

    let item;
    if (rarity === 'artifact') {
      item = { id: `art_${seed}_${i}`, category: 'odd', baseName: 'Artefato nao identificado', kind: 'oddity' };
    } else {
      let tries = 0;
      do {
        item = pickFrom(pool, rng);
        tries++;
      } while (used.has(item.id) && tries < 30);
      used.add(item.id);
    }

    let plus = 0;
    let name = item.baseName;

    if (rarity === 'rare') {
      plus = 1 + Math.floor(rng() * 5);
      name = `${name} ${plusSuffix(plus, 'rare')}`;
    } else if (rarity === 'very_rare') {
      plus = 1 + Math.floor(rng() * 10);
      name = `${name} ${plusSuffix(plus, 'very_rare')}`;
    } else if (rarity === 'artifact') {
      plus = 1 + Math.floor(rng() * 10);
      name = `${name} (Selo ${String(plus).padStart(2, '0')}-${(seed % 999).toString().padStart(3, '0')})`;
    } else {
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

  if (!state.merchantState) state.merchantState = {};
  state.merchantState[key] = inv;
  persistState();
  return inv;
}

function rarityBadge(r) {
  if (r === 'rare') return '<span class="badge rare">Raro</span>';
  if (r === 'very_rare') return '<span class="badge vrare">Muito raro</span>';
  if (r === 'artifact') return '<span class="badge art">Artefato</span>';
  return '<span class="badge">Comum</span>';
}

