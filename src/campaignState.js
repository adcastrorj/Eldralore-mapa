// Estado unificado da campanha (export/import para mapa e painel GM)
// Mantém o site estático: nada depende de banco. O JSON exportado carrega tudo que muda durante a campanha.
const CampaignState = (() => {
  const SCHEMA = 'eldralore_campaign_state_v1';

  function safeClone(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (_) { return v; }
  }

  function defaultWorldState() {
    return { rev: 0, updatedAt: 0, climate: { regions: {} }, vision: { pins: {} }, groupReputation: { pins: {} }, rumors: { pins: {} } };
  }

  function ensureCampaign() {
    if (!state.campaign || typeof state.campaign !== 'object') {
      state.campaign = { timeline: [], pinSecrets: {}, hooks: {}, importantNpcs: [] };
    }
    if (!Array.isArray(state.campaign.timeline)) state.campaign.timeline = [];
    if (!state.campaign.pinSecrets || typeof state.campaign.pinSecrets !== 'object') state.campaign.pinSecrets = {};
    if (!state.campaign.hooks || typeof state.campaign.hooks !== 'object') state.campaign.hooks = {};
    if (!Array.isArray(state.campaign.importantNpcs)) state.campaign.importantNpcs = [];
    return state.campaign;
  }

  function ensureWorld() {
    if (!state.worldState || typeof state.worldState !== 'object') state.worldState = defaultWorldState();
    if (!state.worldState.climate || typeof state.worldState.climate !== 'object') state.worldState.climate = { regions: {} };
    if (!state.worldState.climate.regions || typeof state.worldState.climate.regions !== 'object') state.worldState.climate.regions = {};
    if (!state.worldState.vision || typeof state.worldState.vision !== 'object') state.worldState.vision = { pins: {} };
    if (!state.worldState.vision.pins || typeof state.worldState.vision.pins !== 'object') state.worldState.vision.pins = {};
    if (!state.worldState.groupReputation || typeof state.worldState.groupReputation !== 'object') state.worldState.groupReputation = { pins: {} };
    if (!state.worldState.groupReputation.pins || typeof state.worldState.groupReputation.pins !== 'object') state.worldState.groupReputation.pins = {};
    if (!state.worldState.rumors || typeof state.worldState.rumors !== 'object') state.worldState.rumors = { pins: {} };
    if (!state.worldState.rumors.pins || typeof state.worldState.rumors.pins !== 'object') state.worldState.rumors.pins = {};
    return state.worldState;
  }

  function build(extra = {}) {
    ensureWorld();
    ensureCampaign();
    return {
      schema: SCHEMA,
      version: 1,
      exportedAt: new Date().toISOString(),
      worldTime: safeClone(state.worldTime || { era: 'fourth_age', day: 1, month: 1, year: 1 }),
      worldState: safeClone(state.worldState || defaultWorldState()),
      economy: safeClone(state.economy || { modifiers: [] }),
      campaign: safeClone(state.campaign || { timeline: [], pinSecrets: {}, hooks: {}, importantNpcs: [] }),
      customPins: safeClone(state.customPins || []),
      customCities: safeClone(state.customCities || {}),
      pinOverrides: safeClone(state.pinOverrides || {}),
      merchantState: safeClone(state.merchantState || {}),
      routeFilter: safeClone(state.routeFilter || {}),
      uiPublic: safeClone({ calendarHudVisible: state.ui?.calendarHudVisible !== false, playerExpandedInfo: state.ui?.playerExpandedInfo !== false }),
      dateLock: !!state.dateLock,
      notes: extra.notes || 'Exportação unificada do estado de campanha de Eldralore.'
    };
  }

  function normalizeIncoming(payload) {
    const obj = payload && typeof payload === 'object' ? payload : {};
    const worldState = obj.worldState || {
      rev: Number(obj.rev || 0),
      updatedAt: Number(obj.updatedAt || 0),
      climate: obj.climate || { regions: {} },
      vision: obj.vision || { pins: {} },
      groupReputation: obj.groupReputation || { pins: {} },
      rumors: obj.rumors || { pins: {} },
    };
    return {
      worldTime: obj.worldTime || null,
      worldState,
      economy: obj.economy || null,
      campaign: obj.campaign || null,
      customPins: Array.isArray(obj.customPins) ? obj.customPins : null,
      customCities: obj.customCities && typeof obj.customCities === 'object' ? obj.customCities : null,
      pinOverrides: obj.pinOverrides && typeof obj.pinOverrides === 'object' ? obj.pinOverrides : null,
      merchantState: obj.merchantState && typeof obj.merchantState === 'object' ? obj.merchantState : null,
      dateLock: typeof obj.dateLock === 'boolean' ? obj.dateLock : null,
      routeFilter: obj.routeFilter && typeof obj.routeFilter === 'object' ? obj.routeFilter : null,
      uiPublic: obj.uiPublic && typeof obj.uiPublic === 'object' ? obj.uiPublic : null,
    };
  }

  function apply(payload, opts = {}) {
    const incoming = normalizeIncoming(payload);
    if (incoming.worldTime && typeof incoming.worldTime === 'object') {
      state.worldTime = {
        era: incoming.worldTime.era || 'fourth_age',
        day: Number(incoming.worldTime.day || 1),
        month: Number(incoming.worldTime.month || 1),
        year: Number(incoming.worldTime.year || 1),
      };
    }
    if (incoming.worldState && typeof incoming.worldState === 'object') {
      state.worldState = {
        rev: Number(incoming.worldState.rev || 0),
        updatedAt: Number(incoming.worldState.updatedAt || Date.now()),
        climate: incoming.worldState.climate && typeof incoming.worldState.climate === 'object' ? incoming.worldState.climate : { regions: {} },
        vision: incoming.worldState.vision && typeof incoming.worldState.vision === 'object' ? incoming.worldState.vision : { pins: {} },
        groupReputation: incoming.worldState.groupReputation && typeof incoming.worldState.groupReputation === 'object' ? incoming.worldState.groupReputation : { pins: {} },
        rumors: incoming.worldState.rumors && typeof incoming.worldState.rumors === 'object' ? incoming.worldState.rumors : { pins: {} },
      };
      ensureWorld();
    }
    if (incoming.economy && typeof incoming.economy === 'object') {
      state.economy = { modifiers: Array.isArray(incoming.economy.modifiers) ? incoming.economy.modifiers : [] };
    }
    if (incoming.campaign && typeof incoming.campaign === 'object') {
      state.campaign = {
        timeline: Array.isArray(incoming.campaign.timeline) ? incoming.campaign.timeline : [],
        pinSecrets: incoming.campaign.pinSecrets && typeof incoming.campaign.pinSecrets === 'object' ? incoming.campaign.pinSecrets : {},
        hooks: incoming.campaign.hooks && typeof incoming.campaign.hooks === 'object' ? incoming.campaign.hooks : {},
        importantNpcs: Array.isArray(incoming.campaign.importantNpcs) ? incoming.campaign.importantNpcs : [],
      };
    }
    if (incoming.customPins) state.customPins = incoming.customPins;
    if (incoming.customCities) state.customCities = incoming.customCities;
    if (incoming.pinOverrides) state.pinOverrides = incoming.pinOverrides;
    if (incoming.merchantState) state.merchantState = incoming.merchantState;
    if (incoming.dateLock !== null) state.dateLock = incoming.dateLock;
    if (incoming.routeFilter) state.routeFilter = { ...(state.routeFilter || {}), ...incoming.routeFilter };
    if (incoming.uiPublic) {
      if (!state.ui) state.ui = {};
      if (typeof incoming.uiPublic.calendarHudVisible === 'boolean') state.ui.calendarHudVisible = incoming.uiPublic.calendarHudVisible;
      if (typeof incoming.uiPublic.playerExpandedInfo === 'boolean') state.ui.playerExpandedInfo = incoming.uiPublic.playerExpandedInfo;
    }

    if (opts.persist !== false && typeof persistState === 'function') persistState();
    if (opts.refresh !== false) {
      try { if (typeof reflectDateInputs === 'function') reflectDateInputs(); } catch (_) {}
      try { if (typeof updateTimeUI === 'function') updateTimeUI(); } catch (_) {}
      try { if (typeof updateEconomyUI === 'function') updateEconomyUI(); } catch (_) {}
      try { if (typeof drawClimateOverlay === 'function') drawClimateOverlay(); } catch (_) {}
      try { if (typeof update === 'function') update(); } catch (_) {}
    }
    return true;
  }

  function download(filename = 'eldralore_campaign_state.json') {
    const blob = new Blob([JSON.stringify(build(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }



  function bindStorageSync() {
    if (typeof window === 'undefined' || window.__eldraloreCampaignStorageSync) return;
    window.__eldraloreCampaignStorageSync = true;
    window.addEventListener('storage', async (ev) => {
      try {
        if (!ev.key || ev.key !== STORAGE_KEY) return;
        if (typeof loadPersistentState === 'function') loadPersistentState();
        if (document.body && document.body.classList.contains('gm-console-body')) return;
        // No mapa principal, atualiza imediatamente quando o Painel GM salva em outra janela.
        if (typeof loadPins === 'function') {
          try { await loadPins(); } catch (_) {}
        }
        try { if (typeof updateTimeUI === 'function') updateTimeUI(); } catch (_) {}
        try { if (typeof updateEconomyUI === 'function') updateEconomyUI(); } catch (_) {}
        try { if (typeof drawClimateOverlay === 'function') drawClimateOverlay(); } catch (_) {}
        try { if (typeof update === 'function') update(); } catch (_) {}
        try {
          if (state.ui && state.ui.openLocId) {
            const p = (state.pins || []).find(x => x.id === state.ui.openLocId);
            if (p && typeof openLoc === 'function') openLoc(p);
          }
        } catch (_) {}
      } catch (_) {}
    });
  }

  function bindIndexImport() {
    const btn = document.getElementById('campaignImportBtn');
    const file = document.getElementById('campaignImportFile');
    if (!btn || !file || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const obj = JSON.parse(text);
        if (!confirm('Importar este estado da campanha? Isso substituirá data, visão do mundo, economia e dados GM salvos neste navegador.')) {
          file.value = '';
          return;
        }
        apply(obj, { persist: true, refresh: true });
        alert('Estado da campanha importado com sucesso.');
      } catch (e) {
        alert('Não consegui importar: JSON inválido ou incompatível.');
      } finally {
        file.value = '';
      }
    });
  }

  bindStorageSync();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindIndexImport, { once: true });
  else bindIndexImport();

  return { SCHEMA, ensureWorld, ensureCampaign, build, apply, download, bindIndexImport };
})();
