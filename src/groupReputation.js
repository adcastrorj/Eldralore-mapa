// Reputação macro do grupo + Rumores por calendário
// Camada dinâmica salva em state.worldState; não altera os pins canônicos.

const GROUP_REPUTATION_LEVELS = {
  honrado: {
    label: 'Honrado', score: 100, priceMod: -0.40, blocked: false,
    summary: 'O grupo é recebido como aliado de alto prestígio. Portões se abrem, comerciantes disputam sua presença e oficiais locais tendem a colaborar.'
  },
  aliado: {
    label: 'Aliado', score: 75, priceMod: -0.30, blocked: false,
    summary: 'O grupo é tratado como aliado confiável. Guardas facilitam a passagem e mercadores oferecem condições favoráveis.'
  },
  respeitado: {
    label: 'Respeitado', score: 50, priceMod: -0.15, blocked: false,
    summary: 'O grupo é respeitado, embora ainda observado. Comerciantes oferecem descontos moderados e autoridades locais escutam suas palavras.'
  },
  neutro: {
    label: 'Neutro', score: 0, priceMod: 0, blocked: false,
    summary: 'O grupo é visto como viajantes comuns. Preços, acesso e tratamento seguem as regras normais do local.'
  },
  desconfiado: {
    label: 'Desconfiado', score: -25, priceMod: 0.20, blocked: false,
    summary: 'O grupo desperta cautela. Guardas fazem perguntas, comerciantes cobram mais caro e moradores evitam confidências.'
  },
  hostil: {
    label: 'Hostil', score: -60, priceMod: 0.50, blocked: true,
    summary: 'O grupo é malvisto. A circulação ainda pode ocorrer sob disfarce ou tensão, mas lojas recusam negociação aberta.'
  },
  inimigo: {
    label: 'Inimigo', score: -100, priceMod: 1.00, blocked: true,
    summary: 'O grupo é tratado como ameaça. Mercadores fecham as portas, guardas vigiam cada passo e qualquer negociação exige subterfúgio.'
  }
};

const GROUP_REPUTATION_SOCIAL = {
  normal: 'O cotidiano segue sem reação especial ao grupo.',
  acolhedor: 'Moradores demonstram simpatia e compartilham pequenas cortesias.',
  curioso: 'A população observa o grupo com curiosidade e faz perguntas discretas.',
  tenso: 'Conversas cessam quando o grupo se aproxima e olhares acompanham seus passos.',
  dividido: 'Parte da população apoia o grupo, enquanto outra parte prefere mantê-lo distante.',
  medo: 'A presença do grupo gera medo aberto em moradores e serviçais.',
  celebracao: 'O grupo é lembrado em brindes, canções e relatos locais.'
};

const GROUP_REPUTATION_MOOD = {
  estavel: 'O humor geral do local está estável.',
  otimista: 'Há otimismo moderado entre comerciantes e moradores.',
  exausto: 'O local está exausto por impostos, guerra, perdas ou trabalho excessivo.',
  paranoico: 'Boatos e suspeitas tornam qualquer estrangeiro motivo de vigilância.',
  festivo: 'Festivais, vitórias ou boas colheitas deixam o ambiente mais aberto.',
  revoltado: 'A população está irritada com autoridades, preços ou ameaças recentes.',
  luto: 'O local atravessa luto coletivo, tornando interações mais delicadas.'
};

const GROUP_REPUTATION_MILITARY = {
  normal: 'A guarda opera em rotina normal.',
  relaxada: 'Patrulhas estão leves e pouco desconfiadas.',
  vigilante: 'Guardas observam visitantes e reforçam portões.',
  alerta: 'A guarnição está em alerta e negociações são monitoradas.',
  bloqueio: 'Pontos de controle e revistas dificultam compras e deslocamentos.',
  lei_marcial: 'Autoridade militar domina a vida local e qualquer comércio é fiscalizado.'
};

const GROUP_REPUTATION_COMMERCE = {
  normal: 'O comércio funciona em ritmo normal.',
  prospero: 'Mercadores estão abastecidos e abertos a bons acordos.',
  escasso: 'Estoques estão escassos; preços sobem com facilidade.',
  especulativo: 'Mercadores testam preços altos por medo ou oportunidade.',
  fechado: 'Lojas abrem parcialmente e evitam visitantes suspeitos.',
  mercado_negro: 'Negociações paralelas existem, mas exigem contatos ou reputação.'
};

const RUMOR_TEMPLATES_PUBLIC = [
  'Uma caravana chegou com atraso e ninguém explica exatamente o motivo.',
  'Guardas locais reforçaram a ronda depois do pôr do sol.',
  'Mercadores discutem mudanças nos preços por causa de uma rota instável.',
  'Viajantes falam de luzes estranhas vistas além da estrada principal.',
  'Uma família influente está contratando mensageiros discretos.',
  'A taverna mais cheia do local repete versões contraditórias do mesmo acontecimento.',
  'Um sacerdote ou xamã local pediu cautela nos próximos dias.',
  'Moradores afirmam que patrulhas estrangeiras foram vistas perto da fronteira.',
  'Alguém está comprando suprimentos demais para uma simples viagem.',
  'O nome da Guilda dos Aventureiros surgiu em conversas sobre proteção de rotas.'
];

const RUMOR_TEMPLATES_GM = [
  'O rumor público foi plantado por uma facção que tenta medir a reação do local.',
  'Uma autoridade menor está escondendo perdas recentes para evitar pânico.',
  'Um comerciante importante recebeu ordens secretas de negar certos produtos ao grupo.',
  'Uma rota próxima transportou algo proibido nos últimos dias.',
  'Há um informante observando aventureiros e visitantes armados.',
  'A tensão local está ligada a uma disputa entre casas, clãs ou guildas.',
  'Uma patrulha desaparecida encontrou sinais de magia antiga antes de sumir.',
  'O próximo ciclo do calendário será usado para uma reunião secreta.',
  'Uma facção religiosa ou política quer testar a lealdade do grupo.',
  'Alguém no local reconheceu o grupo, mas ainda não revelou isso publicamente.'
];

function normalizeGroupSystems(){
  if (!state.worldState || typeof state.worldState !== 'object') state.worldState = { rev:0, updatedAt:0, climate:{regions:{}}, vision:{pins:{}} };
  if (!state.worldState.climate || typeof state.worldState.climate !== 'object') state.worldState.climate = { regions:{} };
  if (!state.worldState.climate.regions || typeof state.worldState.climate.regions !== 'object') state.worldState.climate.regions = {};
  if (!state.worldState.vision || typeof state.worldState.vision !== 'object') state.worldState.vision = { pins:{} };
  if (!state.worldState.vision.pins || typeof state.worldState.vision.pins !== 'object') state.worldState.vision.pins = {};
  if (!state.worldState.groupReputation || typeof state.worldState.groupReputation !== 'object') state.worldState.groupReputation = { pins:{} };
  if (!state.worldState.groupReputation.pins || typeof state.worldState.groupReputation.pins !== 'object') state.worldState.groupReputation.pins = {};
  if (!state.worldState.rumors || typeof state.worldState.rumors !== 'object') state.worldState.rumors = { pins:{} };
  if (!state.worldState.rumors.pins || typeof state.worldState.rumors.pins !== 'object') state.worldState.rumors.pins = {};
  return state.worldState;
}

function serialWorldDay(){
  const wt = state.worldTime || { day:1, month:1, year:1 };
  return ((Number(wt.year)||1) * 360) + (((Number(wt.month)||1) - 1) * 30) + ((Number(wt.day)||1) - 1);
}

function simpleHash(str){
  if (typeof hashStringToUint32 === 'function') return hashStringToUint32(String(str));
  let h = 2166136261;
  for (let i=0; i<String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pinForCityId(cityId){
  if (!cityId) return null;
  return (state.pins || []).find(p => p.cityId === cityId) || null;
}

function pinKeyForLoc(obj){
  if (!obj) return '';
  if (obj.id && (obj.type || obj.layer || obj.x !== undefined)) return String(obj.id);
  if (obj.id) {
    const pin = pinForCityId(obj.id);
    if (pin) return String(pin.id);
  }
  return String(obj.id || obj.name || '');
}

function getGroupReputation(pinOrObj){
  normalizeGroupSystems();
  const key = pinKeyForLoc(pinOrObj);
  const rec = key ? state.worldState.groupReputation.pins[key] : null;
  const statusKey = String(rec?.level || rec?.status || 'neutro').toLowerCase();
  const base = GROUP_REPUTATION_LEVELS[statusKey] || GROUP_REPUTATION_LEVELS.neutro;
  const social = GROUP_REPUTATION_SOCIAL[rec?.social || 'normal'] || GROUP_REPUTATION_SOCIAL.normal;
  const mood = GROUP_REPUTATION_MOOD[rec?.mood || 'estavel'] || GROUP_REPUTATION_MOOD.estavel;
  const military = GROUP_REPUTATION_MILITARY[rec?.military || 'normal'] || GROUP_REPUTATION_MILITARY.normal;
  const commerce = GROUP_REPUTATION_COMMERCE[rec?.commerce || 'normal'] || GROUP_REPUTATION_COMMERCE.normal;
  const access = rec?.commercialAccess || 'auto';
  const autoBlocked = !!base.blocked;
  const blocked = access === 'blocked' ? true : (access === 'open' ? false : autoBlocked);
  const restricted = access === 'restricted' || statusKey === 'desconfiado';
  return {
    key, raw: rec || null, levelKey: statusKey, label: base.label, score: Number(rec?.score ?? base.score),
    priceMod: Math.max(-0.40, Math.min(1.00, Number(rec?.priceMod ?? base.priceMod))),
    tradeBlocked: blocked,
    tradeRestricted: restricted && !blocked,
    social, mood, military, commerce,
    note: rec?.note || base.summary,
    updatedAt: rec?.updatedAt || null
  };
}

function reputationPriceInfo(pinOrObj){
  const rep = getGroupReputation(pinOrObj);
  const mod = rep.priceMod;
  return {
    ...rep,
    multiplier: Math.max(0.60, 1 + mod),
    label: rep.label,
    text: mod < 0 ? `${Math.round(Math.abs(mod)*100)}% de desconto` : (mod > 0 ? `${Math.round(mod*100)}% mais caro` : 'Preço normal')
  };
}

function applyReputationToPrice(price, pinOrObj){
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  const info = reputationPriceInfo(pinOrObj);
  return Math.max(1, Math.round(n * info.multiplier));
}

function renderGroupReputationHtml(pinOrObj){
  const rep = getGroupReputation(pinOrObj);
  if (!rep.raw) return '';
  const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s ?? ''));
  const price = reputationPriceInfo(pinOrObj);
  const access = rep.tradeBlocked ? 'Lojas e negociações bloqueadas' : (rep.tradeRestricted ? 'Negociação restrita e vigiada' : 'Negociação permitida');
  return `<div class="intel-card group-rep ${rep.tradeBlocked ? 'blocked' : ''}">
    <div class="intel-k">Reputação do grupo</div>
    <div class="intel-v"><b>${esc(rep.label)}</b> <span class="badge">${esc(price.text)}</span></div>
    <div class="intel-note">${esc(access)}</div>
    <div class="intel-note small">${esc(rep.note)}</div>
    <div class="intel-note small">Social: ${esc(rep.social)}</div>
    <div class="intel-note small">Humor: ${esc(rep.mood)}</div>
    <div class="intel-note small">Militar: ${esc(rep.military)}</div>
    <div class="intel-note small">Comércio: ${esc(rep.commerce)}</div>
  </div>`;
}

function getManualRumors(pinOrObj, channel){
  normalizeGroupSystems();
  const key = pinKeyForLoc(pinOrObj);
  const rec = key ? state.worldState.rumors.pins[key] : null;
  if (!rec || !Array.isArray(rec.items)) return [];
  const today = serialWorldDay();
  return rec.items.filter(r => {
    if (!r || (r.channel || 'public') !== channel) return false;
    if (r.fixed) return true;
    const start = Number(r.startDay || today);
    const dur = Math.max(1, Number(r.durationDays || 7));
    return today >= start && today < start + dur;
  }).map(r => r.text).filter(Boolean);
}

function generatedRumorsForLoc(pinOrObj, channel='public', count=2){
  const obj = pinOrObj || {};
  const base = obj.localRumors && Array.isArray(obj.localRumors[channel]) ? obj.localRumors[channel].filter(Boolean) : [];
  const templates = channel === 'gm' ? RUMOR_TEMPLATES_GM : RUMOR_TEMPLATES_PUBLIC;
  const pool = [...base, ...templates];
  if (!pool.length) return [];
  const day = serialWorldDay();
  const cycle = Math.floor(day / 3);
  const seed = simpleHash(`rumor|${channel}|${pinKeyForLoc(obj)}|${obj.territory || ''}|${obj.type || ''}|${cycle}`);
  const out = [];
  for(let i=0; i<pool.length && out.length<count; i++){
    const idx = (seed + i * 7) % pool.length;
    const txt = pool[idx];
    if (txt && !out.includes(txt)) out.push(txt);
  }
  return out;
}

function currentRumorsForLoc(pinOrObj, channel='public', count=2){
  const manual = getManualRumors(pinOrObj, channel);
  const generated = generatedRumorsForLoc(pinOrObj, channel, count);
  return [...manual, ...generated].filter(Boolean).slice(0, Math.max(count, manual.length));
}

function renderDynamicRumorsHtml(pinOrObj, gmUnlocked=false){
  const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s ?? ''));
  const pub = currentRumorsForLoc(pinOrObj, 'public', 2);
  const gm = gmUnlocked ? currentRumorsForLoc(pinOrObj, 'gm', 2) : [];
  const pubHtml = pub.length ? `<div class="intel-rumor-title">Rumores públicos do ciclo atual</div><ul class="bullets">${pub.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
  const gmHtml = gm.length ? `<div class="intel-rumor-title gm-only">Rumores GM do ciclo atual</div><ul class="bullets gm-only">${gm.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
  return (pubHtml || gmHtml) ? `<div class="intel-card wide dynamic-rumors">${pubHtml}${gmHtml}</div>` : '';
}

function setGroupReputationForPins(ids, data){
  normalizeGroupSystems();
  const pins = state.worldState.groupReputation.pins;
  for (const id of ids || []) {
    if (!id) continue;
    const existing = pins[id] && typeof pins[id] === 'object' ? pins[id] : {};
    pins[id] = { ...existing, ...data, updatedAt: new Date().toISOString() };
  }
  state.worldState.updatedAt = Date.now();
  state.worldState.rev = Number(state.worldState.rev || 0) + 1;
}

function clearGroupReputationForPins(ids){
  normalizeGroupSystems();
  for (const id of ids || []) delete state.worldState.groupReputation.pins[id];
  state.worldState.updatedAt = Date.now();
  state.worldState.rev = Number(state.worldState.rev || 0) + 1;
}

function addManualRumorForPins(ids, rumor){
  normalizeGroupSystems();
  const store = state.worldState.rumors.pins;
  const startDay = serialWorldDay();
  for (const id of ids || []) {
    if (!id) continue;
    if (!store[id] || typeof store[id] !== 'object') store[id] = { items: [] };
    if (!Array.isArray(store[id].items)) store[id].items = [];
    store[id].items.push({
      id: `rumor_${Date.now()}_${Math.floor(Math.random()*99999)}`,
      text: rumor.text || '',
      channel: rumor.channel || 'public',
      fixed: !!rumor.fixed,
      durationDays: Math.max(1, Number(rumor.durationDays || 7)),
      startDay,
      createdAt: new Date().toISOString()
    });
  }
  state.worldState.updatedAt = Date.now();
  state.worldState.rev = Number(state.worldState.rev || 0) + 1;
}

function clearManualRumorsForPins(ids){
  normalizeGroupSystems();
  for (const id of ids || []) delete state.worldState.rumors.pins[id];
  state.worldState.updatedAt = Date.now();
  state.worldState.rev = Number(state.worldState.rev || 0) + 1;
}
