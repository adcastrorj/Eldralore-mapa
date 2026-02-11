
(function(){
  if (window.__combatUiInstalled) return;
  window.__combatUiInstalled = true;

  const DEFAULTS = { terrain:'floresta', size:'medio', gridPx:70, metersPerCell:5, showGrid:true };

  async function loadManifest(){
    try{
      const res = await fetch('data/combat_maps_manifest.json', {cache:'no-store'});
      if(!res.ok) throw new Error('manifest http '+res.status);
      return await res.json();
    }catch(e){
      console.warn('[combate] Falha ao carregar manifest:', e);
      return null;
    }
  }

  function ensureModal(){
    let el = document.getElementById('combatModal');
    if(el) return el;

    el = document.createElement('div');
    el.id = 'combatModal';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:none;background:rgba(0,0,0,0.6);align-items:center;justify-content:center;padding:16px;';

    const card = document.createElement('div');
    card.style.cssText = 'width:min(720px,100%);background:#111;border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:16px;box-shadow:0 16px 40px rgba(0,0,0,0.6);color:#eee;font-family:system-ui,Segoe UI,Roboto,Arial;';

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:18px;font-weight:700;">Combate</div>
          <div style="opacity:.8;font-size:13px;">Mapa tático local (zoom/pan, grid, régua, tokens/props)</div>
        </div>
        <button id="combatCloseBtn" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Fechar</button>
      </div>

      <div style="height:12px;"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <div style="font-size:12px;opacity:.85;margin-bottom:6px;">Tipo de região</div>
          <select id="combatTerrain" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;"></select>
        </div>
        <div>
          <div style="font-size:12px;opacity:.85;margin-bottom:6px;">Tamanho do campo</div>
          <select id="combatSize" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;">
            <option value="pequeno">Pequeno</option>
            <option value="medio" selected>Médio</option>
            <option value="grande">Grande</option>
            <option value="guerra">Guerra</option>
          </select>
        </div>

        <div>
          <div style="font-size:12px;opacity:.85;margin-bottom:6px;">Grid (px por quadrado)</div>
          <input id="combatGridPx" type="number" min="20" max="200" value="70"
            style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;" />
        </div>

        <div>
          <div style="font-size:12px;opacity:.85;margin-bottom:6px;">Escala</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="opacity:.85;font-size:13px;">1 quadrado =</span>
            <input id="combatMetersPerCell" type="number" min="1" max="100" value="5"
              style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;" />
            <span style="opacity:.85;font-size:13px;">m</span>
          </div>
        </div>

        <div style="grid-column:1 / -1;display:flex;gap:12px;align-items:center;">
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer;user-select:none;">
            <input id="combatShowGrid" type="checkbox" checked />
            <span style="font-size:13px;opacity:.9;">Mostrar grid</span>
          </label>
          <div id="combatHint" style="font-size:12px;opacity:.75;"></div>
        </div>
      </div>

      <div style="height:14px;"></div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="combatOpenBtn" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#2b2b2b;color:#fff;cursor:pointer;font-weight:600;">
          Abrir mapa
        </button>
      </div>
    `;

    el.appendChild(card);
    document.body.appendChild(el);

    el.addEventListener('click', (ev)=>{ if(ev.target === el) hideModal(); });
    card.querySelector('#combatCloseBtn').addEventListener('click', hideModal);

    return el;
  }

  function showModal(){ ensureModal().style.display='flex'; }
  function hideModal(){ const el=document.getElementById('combatModal'); if(el) el.style.display='none'; }

  async function populateTerrains(manifest){
    const select = document.getElementById('combatTerrain');
    select.innerHTML = '';
    const terrains = manifest ? Object.keys(manifest) : [DEFAULTS.terrain];
    for(const t of terrains){
      const opt=document.createElement('option');
      opt.value=t; opt.textContent=t;
      if(t===DEFAULTS.terrain) opt.selected=true;
      select.appendChild(opt);
    }
  }

  function pickRandomMap(manifest, terrain, size){
    if(!manifest || !manifest[terrain] || !manifest[terrain][size]) return null;
    const arr = manifest[terrain][size];
    if(!Array.isArray(arr) || arr.length===0) return null;
    const idx = Math.floor(Math.random()*arr.length);
    return arr[idx];
  }

  async function openCombat(){
    const modal = ensureModal();
    const manifest = await loadManifest();

    const terrain = modal.querySelector('#combatTerrain').value;
    const size = modal.querySelector('#combatSize').value;
    const gridPx = parseInt(modal.querySelector('#combatGridPx').value||DEFAULTS.gridPx,10);
    const metersPerCell = parseFloat(modal.querySelector('#combatMetersPerCell').value||DEFAULTS.metersPerCell);
    const showGrid = !!modal.querySelector('#combatShowGrid').checked;

    const file = pickRandomMap(manifest, terrain, size);
    if(!file){
      modal.querySelector('#combatHint').textContent = `Nenhum mapa cadastrado para "${terrain}/${size}". Edite data/combat_maps_manifest.json.`;
      return;
    }

    const url = `assets/combat/maps/${terrain}/${size}/${file}`;
    hideModal();
    // Abre em página separada (não sobrepõe o mapa mundi). Se o navegador bloquear popup, cai no fallback.
    const qs = new URLSearchParams({
      bg: url,
      terrain,
      size,
      gridPx: String(gridPx),
      metersPerCell: String(metersPerCell),
      showGrid: showGrid ? '1' : '0'
    });
    const w = window.open(`combat.html?${qs.toString()}`, '_blank');
    if(!w){
      // fallback: abre sobrepondo (caso popup bloqueado)
      window.CombatViewer.open({ backgroundUrl:url, terrain, size, gridPx, metersPerCell, showGrid });
    }
  }

  async function installButton(){
    let host = document.getElementById('gmPanel') || document.getElementById('gmControls') || document.getElementById('topBar');
    let btn = document.getElementById('combatBtn');
    if(btn) return;

    btn = document.createElement('button');
    btn.id='combatBtn';
    btn.textContent='Combate';
    btn.title='Abrir mapa tático de combate';
    btn.style.cssText='padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;font-weight:650;';

    btn.addEventListener('click', async ()=>{
      const modal = ensureModal();
      const manifest = await loadManifest();
      await populateTerrains(manifest);
      modal.querySelector('#combatHint').textContent='';
      showModal();
    });

    if(host){ host.appendChild(btn); }
    else{
      btn.style.position='fixed';
      btn.style.right='14px';
      btn.style.bottom='14px';
      btn.style.zIndex='99998';
      document.body.appendChild(btn);
    }

    ensureModal().querySelector('#combatOpenBtn').addEventListener('click', openCombat);
  }

  window.CombatUI = { installButton };
  window.addEventListener('load', ()=>{ installButton().catch(console.error); });
})();
