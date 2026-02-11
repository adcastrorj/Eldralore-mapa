// CombatViewer V3 - start tools on token without selecting, cone angles (45/60/90) as sector, AOE shows distance
(function(){
  if (window.CombatViewer) return;

  const Viewer = {
    isOpen:false,
    state:{
      backgroundUrl:'',
      terrain:'',
      size:'',

      gridPx:120,
      metersPerCell:5,

      showGrid:true,
      showSubgrid:true,
      gridContrast:'high',
      gridColor:'white',
      snapToGrid:true,

      zoomMul:1,
      baseScaleX:1,
      baseScaleY:1,
      panX:0,
      panY:0,

      mode:'none', // none|measure|draw|aoe
      measuring:false,
      measureStart:null,
      measureEnd:null,
      measureEndRaw:null,

      stamps:[], // {url,img,x,y,w,h,rot,sizeCells}
      activeStampUrl:null,
      activeStampSizeCells:1,
      selectedStampIndex:-1,

      drawTool:'pen', // pen|line|circle|cone|square|rect
      aoeTool:'circle', // circle|cone|line|square|rect
      coneAngleDeg:90,   // 45|60|90
      drawColorKey:'red',
      drawAlpha:0.95,
      drawWidth:3,

      drawings:[],
      aoes:[],
      drawingDraft:null,
      aoeDraft:null,

      climate:'none',
      rain:[],
      snow:[],
      fog:[]
    },
    els:{}
  };

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const clampInt = (v,min,max,def)=>{ const n=parseInt(v,10); return isFinite(n)?clamp(n,min,max):def; };
  const clampNum = (v,min,max,def)=>{ const n=parseFloat(v); return isFinite(n)?clamp(n,min,max):def; };

  function isMobile(){
    return (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) || (navigator.maxTouchPoints>0);
  }

  const COLOR_PRESETS = {
    red:{stroke:[255,80,80],fill:[255,80,80]},
    orange:{stroke:[255,160,80],fill:[255,160,80]},
    yellow:{stroke:[255,230,120],fill:[255,230,120]},
    green:{stroke:[120,255,160],fill:[120,255,160]},
    cyan:{stroke:[120,220,255],fill:[120,220,255]},
    blue:{stroke:[120,150,255],fill:[120,150,255]},
    purple:{stroke:[190,140,255],fill:[190,140,255]},
    magenta:{stroke:[255,120,240],fill:[255,120,240]},
    white:{stroke:[255,255,255],fill:[255,255,255]},
    black:{stroke:[0,0,0],fill:[0,0,0]},
  };
  const GRID_COLORS = {
    white:'rgba(255,255,255,1)',
    black:'rgba(0,0,0,1)',
    cyan:'rgba(120,220,255,1)',
    blue:'rgba(140,160,255,1)',
    green:'rgba(140,255,180,1)',
    yellow:'rgba(255,240,160,1)',
    red:'rgba(255,140,140,1)',
    magenta:'rgba(255,140,240,1)',
  };
  const rgba=(rgb,a)=>`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

  function scaleX(){ const s=Viewer.state; return s.baseScaleX*s.zoomMul; }
  function scaleY(){ const s=Viewer.state; return s.baseScaleY*s.zoomMul; }

  function worldToScreen(x,y){
    const s=Viewer.state;
    return { x: x*scaleX()+s.panX, y: y*scaleY()+s.panY };
  }
  function screenToWorld(x,y){
    const s=Viewer.state;
    return { x: (x-s.panX)/scaleX(), y: (y-s.panY)/scaleY() };
  }

  function worldToScreen(x,y){
    const s=Viewer.state;
    return { x: x*scaleX()+s.panX, y: y*scaleY()+s.panY };
  }

  // ---------------------------
  // Dice roller (simple parser)
  // Supports: NdM, NdM+K, NdM-K, K+NdM, multiple terms (+/-), whitespace.
  function rollDiceExpr(expr){
    const raw = String(expr||'').trim().toLowerCase();
    if(!raw) return { ok:false, error:'expressão vazia' };

    // Tokenize by +/-
    const tokens = [];
    let buf='', sign=+1;
    for(let i=0;i<raw.length;i++){
      const ch=raw[i];
      if(ch==='+' || ch==='-'){
        if(buf.trim()) tokens.push({sign, term:buf.trim()});
        buf='';
        sign = (ch==='+')? +1 : -1;
      }else{
        buf+=ch;
      }
    }
    if(buf.trim()) tokens.push({sign, term:buf.trim()});

    let total=0;
    const parts=[];
    for(const t of tokens){
      const term=t.term;
      const m = term.match(/^(\d*)d(\d+)$/);
      const m2= term.match(/^(\d*)d(\d+)(?:x(\d+))?$/); // allow d6x2? ignore for now
      if(m){
        const n = m[1]? parseInt(m[1],10): 1;
        const d = parseInt(m[2],10);
        if(!(n>0 && d>0 && d<=100000)) return {ok:false,error:'dado inválido'};
        const rolls=[];
        let subt=0;
        for(let k=0;k<n;k++){
          const r = 1 + Math.floor(Math.random()*d);
          rolls.push(r); subt+=r;
        }
        total += t.sign*subt;
        parts.push({sign:t.sign, kind:'dice', n, d, rolls, sum:subt});
      }else if(/^\d+$/.test(term)){
        const v=parseInt(term,10);
        total += t.sign*v;
        parts.push({sign:t.sign, kind:'flat', v});
      }else{
        return {ok:false, error:'termo inválido: '+term};
      }
    }
    return { ok:true, expr:raw, total, parts };
  }

  function fmtRoll(res){
    if(!res.ok) return '';
    const chunks = res.parts.map(p=>{
      const sign = p.sign<0? ' - ' : ' + ';
      if(p.kind==='flat') return {sign, txt:String(p.v)};
      return {sign, txt:`${p.n}d${p.d} (${p.rolls.join(',')})=${p.sum}`};
    });
    let txt='';
    chunks.forEach((c,idx)=>{
      txt += (idx===0? (c.sign.trim()==='-'?'- ':'') : c.sign) + c.txt;
    });
    return txt.replace(/^\+\s*/,'').trim();
  }

  // ---------------------------
  // Initiative system (base + bonus + 1d10)
  function ensureInitState(){
    const s=Viewer.state;
    if(!s.initiative){
      s.initiative = { entries:[], activeIndex:-1, round:1, tieMode:'base' };
    }
    return s.initiative;
  }
  let __cvInitSortTimer = 0;
  function scheduleInitSort(){
    clearTimeout(__cvInitSortTimer);
    __cvInitSortTimer = setTimeout(()=>{ sortInitiative(); }, 180);
  }

  function uid(){
    return 'id_'+Math.random().toString(36).slice(2,10)+'_'+Date.now().toString(36).slice(2);
  }
  function getStampLabel(i){
    const st = Viewer.state.stamps[i];
    if(!st) return '';
    return st.name || ('Token '+(i+1));
  }
  function computeEntryTotal(e){
    const base = Number(e.base||0);
    const bonus = Number(e.bonus||0);
    const d10 = Number(e.d10||0);
    e.total = base + bonus + d10;
    e.baseBonus = base + bonus;
    return e.total;
  }
  function sortInitiative(){
    const init = ensureInitState();
    const mode = init.tieMode || 'base';
    const prevOrder = new Map();
    init.entries.forEach((e,i)=>prevOrder.set(e.id,i));

    for(const e of init.entries) computeEntryTotal(e);

    init.entries.sort((a,b)=>{
      if(b.total!==a.total) return b.total-a.total;

      if(mode==='base'){
        if((b.baseBonus||0)!==(a.baseBonus||0)) return (b.baseBonus||0)-(a.baseBonus||0);
      }

      if(mode==='manual'){
        return (prevOrder.get(a.id)||0) - (prevOrder.get(b.id)||0);
      }

      // stable fallback by name then id
      const an=(a.name||'').toLowerCase(), bn=(b.name||'').toLowerCase();
      if(an<bn) return -1; if(an>bn) return 1;
      return (a.id||'').localeCompare(b.id||'');
    });

    // keep activeIndex pointing to same id if possible
    if(init.activeId){
      const idx = init.entries.findIndex(e=>e.id===init.activeId);
      init.activeIndex = idx;
    }else if(init.activeIndex>=init.entries.length){
      init.activeIndex = init.entries.length?0:-1;
    }
    renderInitUI();
  }

  function rollD10(){
    return 1 + Math.floor(Math.random()*10);
  }
  function rollInitiativeAll(){
    const init=ensureInitState();
    for(const e of init.entries){
      e.d10 = rollD10();
      computeEntryTotal(e);
    }
    sortInitiative();
  }
  function rollInitiativeOne(id){
    const init=ensureInitState();
    const e = init.entries.find(x=>x.id===id);
    if(!e) return;
    e.d10 = rollD10();
    computeEntryTotal(e);
    sortInitiative();
  }
  function clearInitiative(){
    const init=ensureInitState();
    init.entries=[];
    init.activeIndex=-1;
    init.activeId=null;
    init.round=1;
    renderInitUI();
  }
  function nextTurn(){
    const init=ensureInitState();
    if(!init.entries.length) return;

    if(init.activeIndex<0) init.activeIndex=0;
    else init.activeIndex++;

    if(init.activeIndex>=init.entries.length){
      // Completed a full cycle -> next round and auto reroll d10 for everyone
      init.round = (init.round||1)+1;
      for(const e of init.entries){
        e.d10 = rollD10();
        computeEntryTotal(e);
      }
      // Resort after reroll; active becomes the new first entry
      init.activeIndex = 0;
      init.activeId = init.entries[0]?.id || null;
      sortInitiative();
      return;
    }

    init.activeId = init.entries[init.activeIndex].id;
    renderInitUI();
  }
  function prevTurn(){
    const init=ensureInitState();
    if(!init.entries.length) return;
    if(init.activeIndex<0) init.activeIndex=0;
    else init.activeIndex--;
    if(init.activeIndex<0){
      init.activeIndex=init.entries.length-1;
      init.round = Math.max(1,(init.round||1)-1);
    }
    init.activeId = init.entries[init.activeIndex].id;
    renderInitUI();
  }

  function autoNumberDuplicates(){
    const init=ensureInitState();
    const groups=new Map();
    for(const e of init.entries){
      const baseName = (e.name||'').replace(/\s*#\d+$/,'').trim();
      if(!baseName) continue;
      if(!groups.has(baseName)) groups.set(baseName,[]);
      groups.get(baseName).push(e);
    }
    for(const [bn, arr] of groups.entries()){
      if(arr.length<=1) continue;
      arr.sort((a,b)=>(b.total||0)-(a.total||0));
      for(let i=0;i<arr.length;i++){
        arr[i].name = `${bn} #${i+1}`;
      }
    }
    sortInitiative();
  }

  function linkEntryToSelectedToken(entry){
    const idx = Viewer.state.selectedStampIndex;
    if(idx>=0){
      entry.tokenIndex = idx;
      // adopt token name if empty
      const nm = getStampLabel(idx);
      if(!entry.name && nm) entry.name = nm;
    }
  }

  function renderInitUI(){
    if(!Viewer.isOpen || !Viewer.els.root) return;
    const init=ensureInitState();
    const chips = Viewer.els.root.querySelector('#cvInitChips');
    const roundEl = Viewer.els.root.querySelector('#cvInitRound');
    const drawer = Viewer.els.root.querySelector('#cvInitDrawer');

    // Preserve focus inside initiative drawer when we re-render
    const ae = document.activeElement;
    const focusInfo = (drawer && drawer.contains(ae) && ae && ae.dataset && ae.dataset.eid && ae.dataset.k) ? {
      eid: ae.dataset.eid,
      k: ae.dataset.k,
      selStart: (typeof ae.selectionStart==='number') ? ae.selectionStart : null,
      selEnd: (typeof ae.selectionEnd==='number') ? ae.selectionEnd : null
    } : null;
    if(roundEl) roundEl.textContent = 'Round: '+(init.round||1);

    if(chips){
      chips.innerHTML='';
      const activeId = init.entries[init.activeIndex]?.id;
      for(let i=0;i<init.entries.length;i++){
        const e=init.entries[i];
        const chip=document.createElement('div');
        const isActive = (e.id===activeId);
        chip.style.cssText = `display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,${isActive?0.34:0.16});background:${isActive?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.28)'};cursor:pointer;white-space:nowrap;`;
        const label = (e.name||'—').slice(0,20);
        chip.innerHTML = `<span style="font-size:12px;opacity:.95;">${escapeHtml(label)}</span><span style="font-size:12px;opacity:.80;">${Number(e.total||0)}</span>`;
        chip.addEventListener('click', ()=>{
          init.activeIndex=i;
          init.activeId=e.id;
          renderInitUI();
          if(typeof e.tokenIndex==='number' && Viewer.state.stamps[e.tokenIndex]){
            Viewer.state.selectedStampIndex = e.tokenIndex;
          }
        });
        chips.appendChild(chip);
      }
    }

    // Drawer list
    const listEl = Viewer.els.root.querySelector('#cvInitList');
    if(listEl){
      listEl.innerHTML='';
      const table=document.createElement('div');
      table.style.cssText='display:flex;flex-direction:column;gap:6px;padding:10px 12px;';
      const activeId = init.entries[init.activeIndex]?.id;

      for(let i=0;i<init.entries.length;i++){
        const e=init.entries[i];
        const row=document.createElement('div');
        row.draggable = (init.tieMode==='manual');
        row.dataset.id=e.id;
        const isActive = (e.id===activeId);
        row.style.cssText = `display:grid;grid-template-columns:26px 1fr 64px 64px 54px 70px 40px;gap:8px;align-items:center;padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,${isActive?0.28:0.12});background:${isActive?'rgba(255,255,255,0.10)':'rgba(0,0,0,0.25)'};`;
        row.innerHTML = `
          <div style="opacity:.70;font-size:12px;">${i+1}</div>
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <span title="Arrastar (manual)" style="opacity:${init.tieMode==='manual'?'.75':'.0'};cursor:${init.tieMode==='manual'?'grab':'default'};user-select:none;">⠿</span>
            <input data-eid="${escapeAttr(e.id)}" data-k="name" value="${escapeAttr(e.name||'')}" placeholder="Nome" style="flex:1;min-width:0;padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;"/>
          </div>
          <input data-eid="${escapeAttr(e.id)}" data-k="base" type="number" value="${Number(e.base||0)}" style="padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;"/>
          <input data-eid="${escapeAttr(e.id)}" data-k="bonus" type="number" value="${Number(e.bonus||0)}" style="padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;"/>
          <div style="display:flex;gap:6px;align-items:center;">
            <input data-eid="${escapeAttr(e.id)}" data-k="d10" type="number" min="0" max="10" value="${Number(e.d10||0)}" style="width:52px;padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;"/>
          </div>
          <div class="cv-init-total" style="font-weight:700;opacity:.92;font-size:12px;">${Number(e.total||0)}</div>
          <button data-act="roll" style="padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">d10</button>
          <button data-act="del" style="padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">✕</button>
        `;

        // Hook input changes
        row.querySelectorAll('input').forEach(inp=>{
          // Prevent global hotkeys / backspace-delete while editing
          inp.addEventListener('keydown', (ev)=>{
            ev.stopPropagation();
          });
          inp.addEventListener('input', ()=>{
            const k=inp.dataset.k;
            if(k==='name') e.name = inp.value;
            else e[k] = Number(inp.value||0);
            computeEntryTotal(e);
            // Update total cell without rerendering immediately
            const totEl = row.querySelector('.cv-init-total');
            if(totEl) totEl.textContent = String(Number(e.total||0));
            // Debounced re-sort to keep typing smooth
            scheduleInitSort();
          });
          inp.addEventListener('focus', ()=>{
            inp.dataset.eid = e.id;
          });
        });

        row.querySelector('[data-act="roll"]').addEventListener('click', ()=>rollInitiativeOne(e.id));
        row.querySelector('[data-act="del"]').addEventListener('click', ()=>{
          init.entries = init.entries.filter(x=>x.id!==e.id);
          if(init.activeId===e.id){ init.activeId=null; init.activeIndex=-1; }
          sortInitiative();
        });

        // Drag reorder when manual mode
        row.addEventListener('dragstart', (ev)=>{
          if(init.tieMode!=='manual') return;
          ev.dataTransfer.setData('text/plain', e.id);
          ev.dataTransfer.effectAllowed='move';
        });
        row.addEventListener('dragover', (ev)=>{
          if(init.tieMode!=='manual') return;
          ev.preventDefault();
          ev.dataTransfer.dropEffect='move';
          row.style.outline='1px dashed rgba(255,255,255,0.35)';
        });
        row.addEventListener('dragleave', ()=>{ row.style.outline='none'; });
        row.addEventListener('drop', (ev)=>{
          if(init.tieMode!=='manual') return;
          ev.preventDefault();
          row.style.outline='none';
          const fromId = ev.dataTransfer.getData('text/plain');
          if(!fromId || fromId===e.id) return;
          const arr = init.entries;
          const aidx = arr.findIndex(x=>x.id===fromId);
          const bidx = arr.findIndex(x=>x.id===e.id);
          if(aidx<0||bidx<0) return;
          const [it]=arr.splice(aidx,1);
          arr.splice(bidx,0,it);
          init.activeIndex = arr.findIndex(x=>x.id===init.activeId);
          renderInitUI();
        });

        table.appendChild(row);
      }
      listEl.appendChild(table);
    }
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/`/g,'&#96;'); }
  function roundRect(ctx,x,y,w,h,r){
    r=Math.max(0, r||0);
    const rr=Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }



  // ---------------------------
  // Token conditions (lightweight)
  const KNOWN_CONDITIONS = [
    'Atordoado','Envenenado','Sangrando','Marcado','Invisível','Cego','Surdo','Paralisado','Caído','Impedido','Silenciado'
  ];
  function ensureStampMeta(st){
    if(!st) return;
    if(!st.name) st.name='';
    if(!st.side) st.side='NPC'; // PC|NPC|MON
    if(!Array.isArray(st.conditions)) st.conditions=[];
  }

  // ---------------------------
  // Context menu for tokens
  function hideCtx(){
    const root=Viewer.els.root;
    if(!root) return;
    const ctx=root.querySelector('#cvCtx');
    if(ctx) ctx.style.display='none';
  }
  function showCtx(x,y, html){
    const root=Viewer.els.root;
    if(!root) return;
    const ctx=root.querySelector('#cvCtx');
    if(!ctx) return;
    ctx.innerHTML = html;
    ctx.style.display='block';
    const wrap=root.querySelector('#cvWrap');
    const r=wrap.getBoundingClientRect();
    const maxX=r.width-10, maxY=r.height-10;
    // position relative to wrap
    let px = x - r.left;
    let py = y - r.top;
    // clamp after measuring
    ctx.style.left = '0px'; ctx.style.top='0px';
    ctx.style.right='auto'; ctx.style.bottom='auto';
    ctx.style.position='absolute';
    ctx.style.left = Math.min(px, maxX-ctx.offsetWidth)+'px';
    ctx.style.top  = Math.min(py, maxY-ctx.offsetHeight)+'px';
  }
  function ctxItem(label, act){
    return `<div data-act="${act}" style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.08);cursor:pointer;user-select:none;">${label}</div>`;
  }
  function ctxHeader(title){
    return `<div style="padding:10px 12px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.10);">${title}</div>`;
  }
  function ctxSection(title){
    return `<div style="padding:8px 12px;font-size:12px;opacity:.75;border-bottom:1px solid rgba(255,255,255,0.08);">${title}</div>`;
  }



  // ---------------------------
  // Ping (Alt+Click)
  function ensurePingState(){
    const s=Viewer.state;
    if(!Array.isArray(s.pings)) s.pings=[];
    return s.pings;
  }
  function addPing(worldX, worldY){
    const pings=ensurePingState();
    pings.push({x:worldX,y:worldY,t:performance.now()});
  }

  // ---------------------------
  // Camera bookmarks (1-6)
  function ensureBookmarks(){
    const s=Viewer.state;
    if(!Array.isArray(s.bookmarks)) s.bookmarks=[null,null,null,null,null,null];
    return s.bookmarks;
  }
  function saveBookmark(i){
    const s=Viewer.state; ensureBookmarks();
    s.bookmarks[i]={ panX:s.panX, panY:s.panY, zoomMul:s.zoomMul, baseScaleX:s.baseScaleX, baseScaleY:s.baseScaleY };
    toast(`Bookmark ${i+1} salvo`);
  }
  function loadBookmark(i){
    const s=Viewer.state; ensureBookmarks();
    const b=s.bookmarks[i];
    if(!b) return toast(`Bookmark ${i+1} vazio`);
    s.panX=b.panX; s.panY=b.panY; s.zoomMul=b.zoomMul; s.baseScaleX=b.baseScaleX; s.baseScaleY=b.baseScaleY;
    toast(`Bookmark ${i+1} aplicado`);
  }

  // Small toast (non-intrusive)
  let toastT=0;
  function toast(msg){
    if(!Viewer.els.root) return;
    let el=Viewer.els.root.querySelector('#cvToast');
    if(!el){
      el=document.createElement('div');
      el.id='cvToast';
      el.style.cssText='position:absolute;left:50%;top:calc(var(--cvTopH) + 12px);transform:translateX(-50%);padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,0.14);background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);color:#eee;font-size:12px;opacity:0;transition:opacity .18s ease;';
      Viewer.els.root.appendChild(el);
    }
    el.textContent=msg;
    el.style.opacity='1';
    toastT=performance.now();
  }



  function snapToCellCenter(p){
    const s=Viewer.state;
    if(!s.snapToGrid) return p;
    const g=s.gridPx;
    return { x: (Math.floor(p.x/g)*g)+g/2, y:(Math.floor(p.y/g)*g)+g/2 };
  }
  function snapToSubgrid(p,div=4){
    const g=Viewer.state.gridPx, step=g/div;
    return { x: Math.round(p.x/step)*step, y: Math.round(p.y/step)*step };
  }

  function snapToMeters(p){
    const s=Viewer.state;
    if(!s.snapToGrid) return p;
    const div = Math.max(1, Math.min(50, Math.round(s.metersPerCell||5))); // 1m increments
    return snapToSubgrid(p, div);
  }

  function createUI(){
    if(Viewer.els.root) return;
    const root=document.createElement('div');
    root.id='combatViewer';
    root.style.cssText='position:fixed;inset:0;z-index:99997;display:none;background:#050505;color:#eee;font-family:system-ui,Segoe UI,Roboto,Arial;';

    root.innerHTML=`
      <div id="cvWrap" class="cv-wrap" style="position:fixed;inset:0;z-index:99999;--cvSideW:340px;--cvTopH:96px;background:#000;">
        <style>
          .cv-wrap.side-collapsed{ --cvSideW:0px; }
          .cv-wrap.side-collapsed #cvSide{ display:none; }
          .cv-wrap.top-collapsed{ --cvTopH:0px; }
          .cv-wrap.top-collapsed #cvTop{ display:none; }
          @media (max-width: 980px){ .cv-wrap{ --cvSideW:0px; } }
        
          #cvTop{ right: var(--cvSideW); }
          .cv-wrap.side-collapsed #cvTop{ right:0; }
          #cvTopControls{ flex-wrap:wrap; overflow-x:hidden; white-space:normal; }
          #cvSideReopen{ display:none; }
          .cv-wrap.side-collapsed #cvSideReopen{ display:flex; }
</style>

      <div id="cvTop" style="position:absolute;left:0;right:var(--cvSideW);top:0;height:auto;min-height:96px;z-index:10;display:flex;flex-direction:column;gap:6px;padding:10px 12px;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);border-bottom:1px solid rgba(255,255,255,0.10);">
        <div id="cvTopControls" style="display:flex;align-items:center;gap:10px;overflow-x:auto;overflow-y:hidden;white-space:nowrap;padding-bottom:2px;">
        <button id="cvClose" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Voltar</button>
                <button id="cvToggleTop" title="Recolher/Expandir barra" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">⇧⇩</button>

        <label style="display:flex;gap:8px;align-items:center;cursor:pointer;user-select:none;">
          <input id="cvShowGrid" type="checkbox" checked />
          <span style="font-size:13px;opacity:.9;">Grid</span>
        </label>

        <label style="display:flex;gap:8px;align-items:center;cursor:pointer;user-select:none;">
          <input id="cvShowSubgrid" type="checkbox" checked />
          <span style="font-size:13px;opacity:.9;">Subgrid</span>
        </label>

        <select id="cvGridContrast" style="padding:7px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;">
          <option value="high">Grid: realçar</option>
          <option value="medium">Grid: médio</option>
          <option value="low">Grid: suave</option>
        </select>

        <select id="cvGridColor" style="padding:7px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;">
          <option value="white">Cor: branco</option>
          <option value="black">Cor: preto</option>
          <option value="cyan">Cor: ciano</option>
          <option value="blue">Cor: azul</option>
          <option value="green">Cor: verde</option>
          <option value="yellow">Cor: amarelo</option>
          <option value="red">Cor: vermelho</option>
          <option value="magenta">Cor: magenta</option>
        </select>

        <label style="display:flex;gap:8px;align-items:center;cursor:pointer;user-select:none;">
          <input id="cvSnap" type="checkbox" checked />
          <span style="font-size:13px;opacity:.9;">Snap</span>
        </label>

        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:13px;opacity:.85;">Grid px</span>
          <input id="cvGridPx" type="number" min="40" max="220" value="120" style="width:92px;padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;" />
        </div>

        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:13px;opacity:.85;">1q =</span>
          <input id="cvMeters" type="number" min="1" max="100" value="5" style="width:70px;padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;" />
          <span style="font-size:13px;opacity:.85;">m</span>
        </div>

        <button id="cvMeasureBtn" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Medir</button>
        <button id="cvDrawBtn" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Desenhar</button>
        <button id="cvAoeBtn" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Área</button>

        <select id="cvClimate" style="padding:7px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;">
          <option value="none">Clima: nenhum</option>
          <option value="rain">Clima: chuva</option>
          <option value="snow">Clima: neve</option>
          <option value="fog">Clima: névoa</option>
        </select>

        <button id="cvFit" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Ajustar</button>

        <div style="flex:1;"></div>
        <div id="cvInfo" style="font-size:12px;opacity:.8;white-space:nowrap;"></div>
            <button id="cvSideHandle" title="Mostrar painel" style="position:absolute;top:calc(var(--cvTopH) + 12px);right:10px;z-index:11;padding:10px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(20,20,20,.85);color:#eee;cursor:pointer;display:none;">⇦</button>

</div>
        <div id="cvInitBar" style="display:flex;align-items:center;gap:10px;min-height:30px;">
          <button id="cvInitToggle" title="Iniciativa" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;white-space:nowrap;">Iniciativa ▾</button>
          <button id="cvInitPrev" title="Anterior" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">◀</button>
          <button id="cvInitNext" title="Próximo" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">▶</button>
          <button id="cvInitRollNow" title="Rolar iniciativa de todos (1d10)" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">🎲</button>
          <div id="cvInitRound" style="font-size:12px;opacity:.92;white-space:nowrap;">Round: 1</div>
          <div id="cvInitChips" style="flex:1;display:flex;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;padding:2px 0;"></div>
          <button id="cvDiceToggle" title="Rolador" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;white-space:nowrap;">🎲</button>
        </div>
      <button id="cvSideReopen" title="Abrir painel" style="position:absolute;top:calc(var(--cvTopH) + 14px);right:10px;z-index:12;align-items:center;justify-content:center;gap:6px;padding:10px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);color:#eee;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.35);">⇦ Painel</button>

      </div>

      <div id="cvSide" style="position:absolute;top:var(--cvTopH);bottom:0;right:0;width:var(--cvSideW);z-index:9;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);border-left:1px solid rgba(255,255,255,0.10);padding:10px;overflow:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
  <div style="font-weight:800;">Tokens / Props</div>
  <button id="cvToggleSide" title="Recolher painel" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">⇨</button>
</div>
        <div style="height:8px;"></div>

        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:12px;opacity:.85;">Tamanho:</span>
          <select id="cvTokenSize" style="width:100%;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;">
            <option value="1">Pequeno (1x1)</option>
            <option value="2">Grande (2x2)</option>
            <option value="3">Enorme (3x3)</option>
          </select>
        </div>

        <div style="height:8px;"></div>
        <div style="display:flex;gap:8px;">
          <button id="cvDeleteToken" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Remover selec.</button>
          <button id="cvClearTokens" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Limpar</button>
        </div>

        <div style="height:10px;"></div>
        <div id="cvAssets" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;"></div>

        <div style="height:14px;"></div>
        <div style="font-weight:800;">Ferramenta</div>
        <div style="height:8px;"></div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <select id="cvToolKind" style="padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;">
            <option value="draw">Desenho</option>
            <option value="aoe">Área</option>
          </select>

          <select id="cvToolShape" style="padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;">
            <option value="pen">Livre</option>
            <option value="line">Linha</option>
            <option value="circle">Círculo</option>
            <option value="cone">Cone</option>
            <option value="square">Quadrado</option>
            <option value="rect">Retângulo</option>
          </select>

          <select id="cvConeAngle" style="padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;">
            <option value="45">Cone 45°</option>
            <option value="60">Cone 60°</option>
            <option value="90" selected>Cone 90°</option>
          </select>

          <select id="cvColor" style="padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;">
            <option value="red">Vermelho</option>
            <option value="orange">Laranja</option>
            <option value="yellow">Amarelo</option>
            <option value="green">Verde</option>
            <option value="cyan">Ciano</option>
            <option value="blue">Azul</option>
            <option value="purple">Roxo</option>
            <option value="magenta">Magenta</option>
            <option value="white">Branco</option>
            <option value="black">Preto</option>
          </select>

          <input id="cvWidth" type="number" min="1" max="18" value="3" style="padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;" />

          <button id="cvUndo" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Undo</button>
          <button id="cvClear" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Limpar</button>
        </div>

        <div style="height:12px;"></div>
        <div style="font-size:12px;opacity:.78;line-height:1.35;">
          <b>Importante:</b><br/>
          • Quando Medir/Desenhar/Área estiver ativo, clicar no token NÃO seleciona nem move: usa o centro do token como ponto inicial.<br/>
          • DEL/Backspace remove token selecionado.<br/>
          • Área mostra alcance em quadrados/metragem durante o arraste.<br/>• Alt+Clique cria um <b>Ping</b> no mapa.<br/>• Ctrl+1..6 salva e Alt+1..6 aplica <b>Bookmarks</b> de câmera.
        </div>
      </div>

      <canvas id="cvCanvas" style="position:absolute;left:0;top:var(--cvTopH);right:var(--cvSideW);bottom:0;width:calc(100% - var(--cvSideW));height:calc(100% - var(--cvTopH));touch-action:none;z-index:1;"></canvas>
      <div id="cvInitDrawer" style="position:absolute;left:12px;top:calc(var(--cvTopH) + 10px);z-index:12;width:min(860px, calc(100% - 24px));max-height:55vh;display:none;background:rgba(10,10,10,0.90);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.14);border-radius:14px;box-shadow:0 18px 44px rgba(0,0,0,0.70);overflow:hidden;font-family:system-ui,Segoe UI,Roboto,Arial;color:#eee;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.10);">
          <div style="font-weight:700;letter-spacing:.2px;">Iniciativa</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button id="cvInitAdd" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">+ Participante</button>
            <button id="cvInitRollAll" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Rolar todos (1d10)</button>
            <button id="cvInitAutoNum" title="Auto numerar nomes repetidos" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Auto #</button>
            <button id="cvInitClear" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Limpar</button>
            <button id="cvInitClose" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Fechar</button>
          </div>
        </div>
        <div style="padding:10px 12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:12px;opacity:.85;">Ties:</span>
            <select id="cvInitTie" style="padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;font-size:12px;">
              <option value="base">Desempate: Base+Bônus</option>
              <option value="manual">Desempate: manual</option>
              <option value="extra">Desempate: +1d10 (empatados)</option>
            </select>
          </div>
          <div style="font-size:12px;opacity:.80;">Dica: arraste a “alça” ⠿ para reordenar manualmente (modo manual).</div>
        </div>
        <div id="cvInitList" style="overflow:auto;max-height:calc(55vh - 92px);"></div>
      </div>

      <div id="cvDicePanel" style="position:fixed;left:12px;bottom:12px;width:320px;z-index:60;display:none;background:rgba(10,10,10,0.88);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.14);border-radius:14px;box-shadow:0 18px 44px rgba(0,0,0,0.70);overflow:hidden;font-family:system-ui,Segoe UI,Roboto,Arial;color:#eee;">
        <div id="cvDiceHead" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.10);cursor:move;user-select:none;">
          <div style="font-weight:700;">🎲 Rolador</div>
          <button id="cvDiceClose" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">×</button>
        </div>
        <div style="padding:10px 12px;display:flex;gap:8px;align-items:center;">
          <input id="cvDiceExpr" placeholder="Ex: 1d20+5, 3d6, 1d10" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d0d;color:#eee;"/>
          <button id="cvDiceRoll" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Rolar</button>
        </div>
        <div style="padding:0 12px 10px;display:flex;gap:6px;flex-wrap:wrap;">
          <button class="cv-die" data-d="4" style="padding:6px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">d4</button>
          <button class="cv-die" data-d="6" style="padding:6px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">d6</button>
          <button class="cv-die" data-d="8" style="padding:6px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">d8</button>
          <button class="cv-die" data-d="10" style="padding:6px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">d10</button>
          <button class="cv-die" data-d="12" style="padding:6px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">d12</button>
          <button class="cv-die" data-d="20" style="padding:6px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">d20</button>
          <button class="cv-die" data-d="100" style="padding:6px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">d100</button>
          <button id="cvDiceClear" style="margin-left:auto;padding:6px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a1a1a;color:#eee;cursor:pointer;">Limpar</button>
        </div>
        <div id="cvDiceLog" style="border-top:1px solid rgba(255,255,255,0.10);max-height:180px;overflow:auto;padding:10px 12px;font-size:12px;line-height:1.35;"></div>
      </div>

      <div id="cvCtx" style="position:absolute;display:none;z-index:100000;background:rgba(10,10,10,0.95);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.16);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,0.70);overflow:hidden;font-family:system-ui,Segoe UI,Roboto,Arial;color:#eee;min-width:220px;"></div>

      </div>

    `;

    document.body.appendChild(root);
    Viewer.els.root=root;
    Viewer.els.canvas=root.querySelector('#cvCanvas');
    Viewer.els.info=root.querySelector('#cvInfo');
    Viewer.els.assets=root.querySelector('#cvAssets');

    // Initiative + Dice + ContextMenu bindings
    ensureInitState();
    ensureBookmarks();
    ensurePingState();

    const initDrawer = root.querySelector('#cvInitDrawer');
    const initToggle = root.querySelector('#cvInitToggle');
    const initClose  = root.querySelector('#cvInitClose');
    const initAdd    = root.querySelector('#cvInitAdd');
    const initRollAll= root.querySelector('#cvInitRollAll');
    const initClear  = root.querySelector('#cvInitClear');
    const initPrev   = root.querySelector('#cvInitPrev');
    const initNext   = root.querySelector('#cvInitNext');
    const initRollNow = root.querySelector('#cvInitRollNow');
    const initTie    = root.querySelector('#cvInitTie');
    const initAutoNum= root.querySelector('#cvInitAutoNum');

    function showInitDrawer(on){
      if(!initDrawer) return;
      initDrawer.style.display = on ? 'block' : 'none';
      if(on) renderInitUI();
    }

    if(initToggle) initToggle.addEventListener('click', ()=> showInitDrawer(initDrawer.style.display!=='block'));
    if(initClose)  initClose.addEventListener('click', ()=> showInitDrawer(false));
    if(initPrev)   initPrev.addEventListener('click', ()=> prevTurn());
    if(initNext)   initNext.addEventListener('click', ()=> nextTurn());

    if(initRollNow) initRollNow.addEventListener('click', ()=>{ rollInitiativeAll(); showInitDrawer(true); });

    if(initAdd) initAdd.addEventListener('click', ()=>{
      const init = ensureInitState();
      const e = { id:uid(), name:'', base:0, bonus:0, d10:0, total:0, tokenIndex:null };
      linkEntryToSelectedToken(e);
      computeEntryTotal(e);
      init.entries.push(e);
      sortInitiative();
      showInitDrawer(true);
    });

    if(initRollAll) initRollAll.addEventListener('click', ()=>{ rollInitiativeAll(); showInitDrawer(true); });
    if(initClear)   initClear.addEventListener('click', ()=>{ if(confirm('Limpar lista de iniciativa?')) clearInitiative(); });
    if(initAutoNum) initAutoNum.addEventListener('click', ()=> autoNumberDuplicates());
    if(initTie) initTie.addEventListener('change', ()=>{
      const init=ensureInitState();
      init.tieMode = initTie.value;
      if(init.tieMode==='extra'){
        // roll extra only among tied totals
        const byTotal=new Map();
        for(const e of init.entries){
          const key=String(e.total||0);
          if(!byTotal.has(key)) byTotal.set(key,[]);
          byTotal.get(key).push(e);
        }
        for(const [k,arr] of byTotal.entries()){
          if(arr.length>1){
            for(const e of arr){ e.d10 = (Number(e.d10||0) + rollD10()); computeEntryTotal(e); }
          }
        }
      }
      sortInitiative();
      renderInitUI();
    });

    // Dice panel
    const dicePanel = root.querySelector('#cvDicePanel');
    const diceToggle= root.querySelector('#cvDiceToggle');
    const diceClose = root.querySelector('#cvDiceClose');
    const diceExpr  = root.querySelector('#cvDiceExpr');
    const diceRoll  = root.querySelector('#cvDiceRoll');
    const diceLog   = root.querySelector('#cvDiceLog');
    const diceClear = root.querySelector('#cvDiceClear');
    const diceHead  = root.querySelector('#cvDiceHead');

    function addDiceLogLine(html){
      if(!diceLog) return;
      const line=document.createElement('div');
      line.style.cssText='padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);';
      line.innerHTML=html;
      diceLog.prepend(line);
    }

    function doRoll(expr){
      const res = rollDiceExpr(expr);
      if(!res.ok){
        addDiceLogLine(`<span style="opacity:.75;">Erro:</span> <span style="color:#ffb3b3;">${escapeHtml(res.error)}</span>`);
        return;
      }
      addDiceLogLine(`<div style="display:flex;justify-content:space-between;gap:10px;"><span style="opacity:.85;">${escapeHtml(expr)}</span><b>${res.total}</b></div><div style="opacity:.75;">${escapeHtml(fmtRoll(res))}</div>`);
    }

    function showDice(on){
      if(!dicePanel) return;
      dicePanel.style.display = on ? 'block' : 'none';
      if(on){
        clampFloatingPanels();
        if(diceExpr) diceExpr.focus();
      }
    }
    if(diceToggle) diceToggle.addEventListener('click', ()=> showDice(dicePanel.style.display!=='block'));
    if(diceClose)  diceClose.addEventListener('click', ()=> showDice(false));
    if(diceRoll)   diceRoll.addEventListener('click', ()=> doRoll(diceExpr.value));
    if(diceExpr)   diceExpr.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter') doRoll(diceExpr.value); });
    if(diceClear)  diceClear.addEventListener('click', ()=>{ if(diceLog) diceLog.innerHTML=''; });

    root.querySelectorAll('.cv-die').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const d=btn.getAttribute('data-d');
        doRoll('1d'+d);
      });
    });

    // Draggable dice panel (simple)
    let dragDice=null;
    if(diceHead){
      diceHead.addEventListener('pointerdown', (ev)=>{
        if(ev.target && ev.target.id==='cvDiceClose') return;
        dragDice={x:ev.clientX,y:ev.clientY, left:parseFloat(getComputedStyle(dicePanel).left)||12, bottom:parseFloat(getComputedStyle(dicePanel).bottom)||12};
        diceHead.setPointerCapture(ev.pointerId);
      });
      diceHead.addEventListener('pointermove', (ev)=>{
        if(!dragDice) return;
        const dx=ev.clientX-dragDice.x;
        const dy=ev.clientY-dragDice.y;
        // Keep inside visible area (accounts for top bar + side panel)
        const rectWrap = root.querySelector('#cvWrap').getBoundingClientRect();
        const sideW = Viewer.state.sideCollapsed ? 0 : 340;
        const topH = Viewer.state.topCollapsed ? 0 : Math.max(0, Math.round((root.querySelector('#cvTop')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height));
        const panelRect = dicePanel.getBoundingClientRect();
        const w = panelRect.width || 320;
        const h = panelRect.height || 260;
        const maxLeft = Math.max(8, (rectWrap.width - sideW - w - 8));
        const maxBottom = Math.max(8, (rectWrap.height - topH - h - 8));
        const newLeft = Math.max(8, Math.min(maxLeft, dragDice.left + dx));
        // bottom decreases as y increases
        const newBottom = Math.max(8, Math.min(maxBottom, dragDice.bottom - dy));
        dicePanel.style.left = newLeft+'px';
        dicePanel.style.bottom = newBottom+'px';
      });
      diceHead.addEventListener('pointerup', ()=>{ dragDice=null; });
      diceHead.addEventListener('pointercancel', ()=>{ dragDice=null; });
    }

    // Initial render
    renderInitUI();

    // Hide context menu on outside click
    root.addEventListener('pointerdown', (ev)=>{
      const ctx = root.querySelector('#cvCtx');
      if(!ctx || ctx.style.display==='none') return;
      if(ctx.contains(ev.target)) return;
      hideCtx();
    });


    root.querySelector('#cvClose').addEventListener('click', ()=>Viewer.close());
    const wrap = root.querySelector('#cvWrap');
    const btnSide = root.querySelector('#cvToggleSide');
    const btnTop = root.querySelector('#cvToggleTop');
    const btnSideReopen = root.querySelector('#cvSideReopen');
    const sideHandle = root.querySelector('#cvSideHandle');

    // Keep floating panels (dice, etc.) within visible bounds when UI chrome changes
    function clampFloatingPanels(){
      // Dice panel
      try{
        const dp = root.querySelector('#cvDicePanel');
        if(dp && dp.style.display !== 'none'){
          const sideW = Viewer.state.sideCollapsed ? 0 : 340;
          const topH = Viewer.state.topCollapsed ? 0 : Math.max(0, Math.round((root.querySelector('#cvTop')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height));
          const vw = window.innerWidth || document.documentElement.clientWidth || 0;
          const vh = window.innerHeight || document.documentElement.clientHeight || 0;
          const rect = dp.getBoundingClientRect();
          const w = rect.width || 320;
          const h = rect.height || 260;

          let left = parseFloat(getComputedStyle(dp).left);
          let bottom = parseFloat(getComputedStyle(dp).bottom);
          if(!isFinite(left)) left = 12;
          if(!isFinite(bottom)) bottom = 12;

          const maxLeft = Math.max(8, (vw - sideW - w - 8));
          const maxBottom = Math.max(8, (vh - topH - h - 8));

          left = Math.max(8, Math.min(maxLeft, left));
          bottom = Math.max(8, Math.min(maxBottom, bottom));

          dp.style.left = left + 'px';
          dp.style.bottom = bottom + 'px';
        }
      }catch(_){}
    }


    function applyChrome(){
      if(!wrap) return;
      const topEl = root.querySelector('#cvTop');
      wrap.classList.toggle('side-collapsed', !!Viewer.state.sideCollapsed);
      wrap.classList.toggle('top-collapsed', !!Viewer.state.topCollapsed);

      // Side width (right panel)
      const sideW = Viewer.state.sideCollapsed ? 0 : 340;
      wrap.style.setProperty('--cvSideW', sideW + 'px');

      // Top height should follow actual rendered height (prevents overlap / cut text)
      let topH = 0;
      if(!Viewer.state.topCollapsed && topEl){
        topH = Math.max(0, Math.round(topEl.getBoundingClientRect().height));
      }
      wrap.style.setProperty('--cvTopH', topH + 'px');

      if(sideHandle) sideHandle.style.display = Viewer.state.sideCollapsed ? 'block' : 'none';

      clampFloatingPanels();
    }
    function setSide(v){ Viewer.state.sideCollapsed=!!v; applyChrome(); resizeCanvas(); draw(); }
    function setTop(v){ Viewer.state.topCollapsed=!!v; applyChrome(); resizeCanvas(); draw(); }

    if(btnSide) btnSide.addEventListener('click', ()=>setSide(true));
    if(btnSideReopen) btnSideReopen.addEventListener('click', ()=>setSide(false));
    if(btnTop) btnTop.addEventListener('click', ()=>setTop(!Viewer.state.topCollapsed));
    if(sideHandle) sideHandle.addEventListener('click', ()=>setSide(false));

    try{ if(window.innerWidth < 980) Viewer.state.sideCollapsed=true; }catch(_){}
    applyChrome();

    root.querySelector('#cvFit').addEventListener('click', ()=>fitToScreenStretchXY());

    root.querySelector('#cvShowGrid').addEventListener('change', e=>{Viewer.state.showGrid=e.target.checked; draw();});
    root.querySelector('#cvShowSubgrid').addEventListener('change', e=>{Viewer.state.showSubgrid=e.target.checked; draw();});
    root.querySelector('#cvGridContrast').addEventListener('change', e=>{Viewer.state.gridContrast=e.target.value; draw();});
    root.querySelector('#cvGridColor').addEventListener('change', e=>{Viewer.state.gridColor=e.target.value; draw();});

    root.querySelector('#cvSnap').addEventListener('change', e=>{Viewer.state.snapToGrid=e.target.checked; draw();});
    root.querySelector('#cvGridPx').addEventListener('change', e=>{
      Viewer.state.gridPx=clampInt(e.target.value,40,220,120);
      for(const st of Viewer.state.stamps){
        const cells=st.sizeCells||1;
        st.w=Viewer.state.gridPx*cells;
        st.h=Viewer.state.gridPx*cells;
        const p=snapToCellCenter({x:st.x,y:st.y});
        st.x=p.x; st.y=p.y;
      }
      draw();
    });
    root.querySelector('#cvMeters').addEventListener('change', e=>{Viewer.state.metersPerCell=clampNum(e.target.value,1,100,5); draw();});

    root.querySelector('#cvTokenSize').addEventListener('change', e=>{Viewer.state.activeStampSizeCells=clampInt(e.target.value,1,3,1);});
    root.querySelector('#cvDeleteToken').addEventListener('click', ()=>deleteSelectedStamp());
    root.querySelector('#cvClearTokens').addEventListener('click', ()=>{Viewer.state.stamps=[]; Viewer.state.selectedStampIndex=-1; draw();});

    root.querySelector('#cvMeasureBtn').addEventListener('click', ()=>setMode('measure'));
    root.querySelector('#cvDrawBtn').addEventListener('click', ()=>setMode('draw'));
    root.querySelector('#cvAoeBtn').addEventListener('click', ()=>setMode('aoe'));

    root.querySelector('#cvClimate').addEventListener('change', e=>{Viewer.state.climate=e.target.value||'none'; initFx(); draw();});

    root.querySelector('#cvToolKind').addEventListener('change', e=>{
      const v=e.target.value;
      if(v==='draw') setMode('draw'); else setMode('aoe');
    });
    root.querySelector('#cvToolShape').addEventListener('change', e=>{
      const v=e.target.value;
      if(Viewer.state.mode==='draw') Viewer.state.drawTool=v;
      else Viewer.state.aoeTool=(v==='pen')?'circle':v;
      updateButtons(); draw();
    });
    root.querySelector('#cvConeAngle').addEventListener('change', e=>{
      Viewer.state.coneAngleDeg = clampInt(e.target.value, 45, 90, 90);
      updateButtons(); draw();
    });

    root.querySelector('#cvColor').addEventListener('change', e=>{Viewer.state.drawColorKey=e.target.value; draw();});
    root.querySelector('#cvWidth').addEventListener('change', e=>{Viewer.state.drawWidth=clampInt(e.target.value,1,18,3);});

    root.querySelector('#cvUndo').addEventListener('click', ()=>undoAction());
    root.querySelector('#cvClear').addEventListener('click', ()=>clearActions());

    setupEvents();
    updateButtons();
  }

  function setMode(m){
    const s=Viewer.state;
    s.mode = (s.mode===m) ? 'none' : m;
    s.measuring=false;
    s.measureStart=s.measureEnd=s.measureEndRaw=null;
    s.drawingDraft=null;
    s.aoeDraft=null;
    updateButtons();
    draw();
  }

  function updateButtons(){
    const root=Viewer.els.root; if(!root) return;
    const s=Viewer.state;
    const set=(id,on)=>{ const el=root.querySelector(id); el.style.background=on?'#2e2e2e':'#1a1a1a'; };
    set('#cvMeasureBtn', s.mode==='measure');
    set('#cvDrawBtn', s.mode==='draw');
    set('#cvAoeBtn', s.mode==='aoe');
    root.querySelector('#cvToolKind').value = (s.mode==='aoe')?'aoe':'draw';
    root.querySelector('#cvToolShape').value = (s.mode==='aoe')?s.aoeTool:s.drawTool;
    root.querySelector('#cvColor').value = s.drawColorKey;
    root.querySelector('#cvWidth').value = s.drawWidth;
    root.querySelector('#cvConeAngle').value = String(s.coneAngleDeg);
  }

  function resizeCanvas(){
    const c=Viewer.els.canvas;
    const rect=c.getBoundingClientRect();
    c.width=Math.max(1,Math.floor(rect.width*devicePixelRatio));
    c.height=Math.max(1,Math.floor(rect.height*devicePixelRatio));
    draw();
  }

  function fitToScreenStretchXY(){
    const s=Viewer.state;
    if(!s.bgImg) return;
    const rect=Viewer.els.canvas.getBoundingClientRect();
    const vw=rect.width, vh=rect.height;
    // Manter proporção original (aspect ratio) - usar o menor escalonamento
    const scaleXFit=vw/s.bgW;
    const scaleYFit=vh/s.bgH;
    const scale=Math.min(scaleXFit, scaleYFit);
    s.baseScaleX=scale;
    s.baseScaleY=scale;
    s.zoomMul=1;
    s.panX=(vw - s.bgW*scaleX())/2;
    s.panY=(vh - s.bgH*scaleY())/2;
    draw();
  }

  async function loadAssetsList(){
    const fallback={tokens:[],props:[]};
    try{
      const res=await fetch('data/combat_assets_manifest.json',{cache:'no-store'});
      if(!res.ok) return fallback;
      const j=await res.json();
      return Object.assign(fallback,j||{});
    }catch(e){ console.warn('[combate] manifest falhou',e); return fallback; }
  }
  function renderAssets(assets){
    const host=Viewer.els.assets;
    host.innerHTML='';
    const all=[...(assets.tokens||[]),...(assets.props||[])];
    if(!all.length){
      const msg=document.createElement('div');
      msg.style.cssText='grid-column:1/-1;font-size:12px;opacity:.75;line-height:1.3;';
      msg.textContent='Sem assets cadastrados (data/combat_assets_manifest.json).';
      host.appendChild(msg); return;
    }
    for(const url of all){
      const btn=document.createElement('button');
      btn.style.cssText='border:1px solid rgba(255,255,255,.14);background:#0d0d0d;border-radius:10px;overflow:hidden;cursor:pointer;padding:0;';
      const img=document.createElement('img');
      img.src=url;
      img.style.cssText='display:block;width:100%;height:64px;object-fit:cover;';
      btn.appendChild(img);
      btn.title=url.split('/').pop();
      btn.addEventListener('click', ()=>{ Viewer.state.activeStampUrl=url; });
      host.appendChild(btn);
    }
  }

  async function placeStampAt(pWorld){
    const s=Viewer.state;
    const url=s.activeStampUrl; if(!url) return;
    const img=new Image(); img.src=url; await img.decode().catch(()=>{});
    const cells=clampInt(s.activeStampSizeCells,1,3,1);
    const w=s.gridPx*cells, h=s.gridPx*cells;
    const p=snapToCellCenter(pWorld);
    s.stamps.push({url,img,x:p.x,y:p.y,w,h,rot:0,sizeCells:cells});
    s.selectedStampIndex=s.stamps.length-1;
  }

  function deleteSelectedStamp(){
    const s=Viewer.state;
    const i=s.selectedStampIndex;
    if(i<0||i>=s.stamps.length) return;
    s.stamps.splice(i,1);
    s.selectedStampIndex=Math.min(i,s.stamps.length-1);
    draw();
  }
  function undoAction(){
    const s=Viewer.state;
    if(s.mode==='aoe'){ if(s.aoes.length) s.aoes.pop(); }
    else { if(s.drawings.length) s.drawings.pop(); }
    draw();
  }
  function clearActions(){
    const s=Viewer.state;
    s.drawings=[]; s.aoes=[]; s.drawingDraft=null; s.aoeDraft=null;
    draw();
  }

  function gridAlphas(){
    const s=Viewer.state;
    if(s.gridContrast==='high') return {minor:0.22,major:0.38,sub:0.10};
    if(s.gridContrast==='medium') return {minor:0.16,major:0.28,sub:0.07};
    return {minor:0.10,major:0.18,sub:0.05};
  }

  function drawGrid(ctx,w,h){
    const s=Viewer.state;
    const g=s.gridPx;
    const stepX=g*scaleX(), stepY=g*scaleY();
    if(stepX<8||stepY<8) return;
    const ox=((s.panX%stepX)+stepX)%stepX;
    const oy=((s.panY%stepY)+stepY)%stepY;

    const majorEvery=5;
    const fade=clamp((s.zoomMul-0.35)/0.65,0,1);
    const a=gridAlphas();
    const base=GRID_COLORS[s.gridColor]||GRID_COLORS.white;

    ctx.save(); ctx.lineCap='butt';

    if(s.showSubgrid){
      const subX=stepX/4, subY=stepY/4;
      const osx=((s.panX%subX)+subX)%subX;
      const osy=((s.panY%subY)+subY)%subY;
      ctx.globalAlpha=a.sub*fade; ctx.lineWidth=1;
      ctx.strokeStyle='rgba(0,0,0,1)';
      for(let x=osx;x<=w;x+=subX){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
      for(let y=osy;y<=h;y+=subY){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      ctx.strokeStyle=base;
      for(let x=osx;x<=w;x+=subX){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
      for(let y=osy;y<=h;y+=subY){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    }

    let i=0;
    for(let x=ox;x<=w;x+=stepX,i++){
      const major=(i%majorEvery===0);
      ctx.globalAlpha=(major?a.major:a.minor)*fade;
      ctx.lineWidth=major?2:1;
      ctx.strokeStyle='rgba(0,0,0,1)'; ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
      ctx.strokeStyle=base; ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
    }
    i=0;
    for(let y=oy;y<=h;y+=stepY,i++){
      const major=(i%majorEvery===0);
      ctx.globalAlpha=(major?a.major:a.minor)*fade;
      ctx.lineWidth=major?2:1;
      ctx.strokeStyle='rgba(0,0,0,1)'; ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
      ctx.strokeStyle=base; ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
    }
    ctx.restore();
  }

  // Cone as SECTOR (curved edge). Half-angle in radians.
  function buildConeSectorPath(ctx, origin, angleRad, radius, dirAngle){
    const half=angleRad/2;
    const a1=dirAngle-half;
    const a2=dirAngle+half;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.arc(origin.x, origin.y, radius, a1, a2);
    ctx.closePath();
  }

  function drawLabelScreen(ctx, x, y, text){
    ctx.save();
    ctx.font='12px system-ui,Segoe UI,Roboto,Arial';
    const tw=ctx.measureText(text).width;
    ctx.fillStyle='rgba(0,0,0,0.70)';
    ctx.fillRect(x-6, y-12, tw+12, 18);
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.fillText(text, x, y+2);
    ctx.restore();
  }

  function aoeMetrics(aoe){
    const s=Viewer.state;
    const pts=aoe.pts||[];
    if(pts.length<2) return null;
    const o=pts[0], p=pts[1];
    const dx=p.x-o.x, dy=p.y-o.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    const cells=Math.max(1, Math.round(dist/s.gridPx));
    const meters=cells*s.metersPerCell;
    return {cells, meters, dx, dy, dist};
  }

  function drawDrawings(ctx){
    const s=Viewer.state;
    const list=s.drawings.slice();
    if(s.drawingDraft) list.push(s.drawingDraft);
    if(!list.length) return;

    ctx.save();
    ctx.translate(s.panX,s.panY);
    ctx.scale(scaleX(),scaleY());

    const avg=(scaleX()+scaleY())/2;

    for(const dr of list){
      if(dr.kind!=='draw') continue;
      const rgb=COLOR_PRESETS[dr.color||'red']?.stroke||COLOR_PRESETS.red.stroke;
      ctx.strokeStyle=rgba(rgb, dr.alpha??0.95);
      ctx.lineWidth=(dr.width||3)/avg;
      ctx.lineCap='round'; ctx.lineJoin='round';
      const pts=dr.pts||[];

      if(dr.type==='pen'){
        if(pts.length<2) continue;
        ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
        for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
        ctx.stroke();
      }else if(dr.type==='line'){
        if(pts.length<2) continue;
        ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); ctx.lineTo(pts[1].x,pts[1].y); ctx.stroke();
      }else if(dr.type==='circle'){
        if(pts.length<2) continue;
        const o=pts[0], p=pts[1];
        const r=Math.sqrt((p.x-o.x)**2+(p.y-o.y)**2);
        ctx.beginPath(); ctx.arc(o.x,o.y,r,0,Math.PI*2); ctx.stroke();
      }else if(dr.type==='square'){
        if(pts.length<2) continue;
        const o=pts[0], p=pts[1];
        const g=s.gridPx;
        const cells=Math.max(1, Math.round(Math.max(Math.abs(p.x-o.x),Math.abs(p.y-o.y))/g));
        const size=cells*g;
        ctx.strokeRect(o.x-size/2,o.y-size/2,size,size);
      }else if(dr.type==='rect'){
        if(pts.length<2) continue;
        const o=pts[0], p=pts[1];
        const g=s.gridPx;
        const wC=Math.max(1, Math.round(Math.abs(p.x-o.x)/g));
        const hC=Math.max(1, Math.round(Math.abs(p.y-o.y)/g));
        const ww=wC*g, hh=hC*g;
        ctx.strokeRect(o.x-ww/2,o.y-hh/2,ww,hh);
      }else if(dr.type==='cone'){
        if(pts.length<2) continue;
        const o=pts[0], p=pts[1];
        const m=aoeMetrics({pts:[o,p]});
        const dir=Math.atan2(m.dy,m.dx);
        const radius=m.cells*s.gridPx;
        buildConeSectorPath(ctx, o, (Viewer.state.coneAngleDeg*Math.PI/180), radius, dir);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawAOEs(ctx){
    const s=Viewer.state;
    const list=s.aoes.slice();
    if(s.aoeDraft) list.push(s.aoeDraft);
    if(!list.length) return;

    // world-space fill
    ctx.save();
    ctx.translate(s.panX,s.panY);
    ctx.scale(scaleX(),scaleY());

    const avg=(scaleX()+scaleY())/2;

    for(const aoe of list){
      if(aoe.kind!=='aoe') continue;
      const rgb=COLOR_PRESETS[aoe.color||'red']?.fill||COLOR_PRESETS.red.fill;
      ctx.fillStyle=rgba(rgb, aoe.alphaFill??0.22);
      ctx.strokeStyle=rgba(rgb, aoe.alphaStroke??0.75);
      ctx.lineWidth=2/avg;
      ctx.lineJoin='round';

      const pts=aoe.pts||[];
      if(pts.length<2) continue;
      const o=pts[0], p=pts[1];
      const m=aoeMetrics(aoe);
      const g=s.gridPx;

      if(aoe.type==='circle'){
        const r=m.cells*g;
        ctx.beginPath(); ctx.arc(o.x,o.y,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
      }else if(aoe.type==='square'){
        const size=m.cells*g;
        ctx.beginPath(); ctx.rect(o.x-size/2,o.y-size/2,size,size); ctx.fill(); ctx.stroke();
      }else if(aoe.type==='rect'){
        const wC=Math.max(1, Math.round(Math.abs(p.x-o.x)/g));
        const hC=Math.max(1, Math.round(Math.abs(p.y-o.y)/g));
        const ww=wC*g, hh=hC*g;
        ctx.beginPath(); ctx.rect(o.x-ww/2,o.y-hh/2,ww,hh); ctx.fill(); ctx.stroke();
      }else if(aoe.type==='line'){
        const len=m.cells*g;
        const ang=Math.atan2(m.dy,m.dx);
        const halfW=g/2;
        ctx.save();
        ctx.translate(o.x,o.y); ctx.rotate(ang);
        ctx.beginPath(); ctx.rect(0,-halfW,len,halfW*2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }else if(aoe.type==='cone'){
        const dir=Math.atan2(m.dy,m.dx);
        const radius=m.cells*g;
        buildConeSectorPath(ctx, o, (s.coneAngleDeg*Math.PI/180), radius, dir);
        ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();

    // labels in screen-space for DRAFT only (so it doesn't clutter)
    if(s.aoeDraft && s.aoeDraft.pts && s.aoeDraft.pts.length>=2){
      const o=s.aoeDraft.pts[0], p=s.aoeDraft.pts[1];
      const m=aoeMetrics(s.aoeDraft);
      const so=worldToScreen(o.x,o.y);
      const sp=worldToScreen(p.x,p.y);
      const lx=(so.x+sp.x)/2+10;
      const ly=(so.y+sp.y)/2-12;

      let label='';
      if(s.aoeDraft.type==='circle') label=`Raio ${m.cells}q / ${m.meters}m`;
      else if(s.aoeDraft.type==='cone') label=`Cone ${s.coneAngleDeg}° • ${m.cells}q / ${m.meters}m`;
      else if(s.aoeDraft.type==='line') label=`Linha ${m.cells}q / ${m.meters}m`;
      else if(s.aoeDraft.type==='square') label=`Quadrado ${m.cells}q`;
      else if(s.aoeDraft.type==='rect'){
        const g=Viewer.state.gridPx;
        const wC=Math.max(1, Math.round(Math.abs(p.x-o.x)/g));
        const hC=Math.max(1, Math.round(Math.abs(p.y-o.y)/g));
        label=`Ret ${wC}x${hC}q`;
      }
      const c=Viewer.els.canvas;
      const ctx=c.getContext('2d');
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
      drawLabelScreen(ctx, lx, ly, label);
    }
  }

  function drawMeasure(ctx){
    const s=Viewer.state;
    const end=s.measureEndRaw||s.measureEnd;
    if(!s.measureStart||!end) return;

    const a=worldToScreen(s.measureStart.x,s.measureStart.y);
    const b=worldToScreen(end.x,end.y);

    const dx=end.x-s.measureStart.x;
    const dy=end.y-s.measureStart.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    const cells=dist/s.gridPx;
    const meters=cells*s.metersPerCell;

    ctx.save();
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.strokeStyle='rgba(0,0,0,0.85)'; ctx.lineWidth=6;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.95)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();

    drawLabelScreen(ctx, (a.x+b.x)/2+8, (a.y+b.y)/2-12, `${cells.toFixed(1)}q / ${meters.toFixed(1)}m`);
    ctx.restore();
  }

  // Climate left as in V2 (already acceptable); keeping code compact here
  function initFx(){
    const s=Viewer.state;
    s.rain=[]; s.snow=[]; s.fog=[];
    if(!Viewer.els.canvas) return;
    const rect=Viewer.els.canvas.getBoundingClientRect();
    const w=rect.width, h=rect.height;

    if(s.climate==='rain'){
      for(let i=0;i<260;i++){
        s.rain.push({x:Math.random()*w,y:Math.random()*h,v:420+Math.random()*520,len:14+Math.random()*28,a:0.10+Math.random()*0.18,w:1+Math.random()*0.8});
      }
    }else if(s.climate==='snow'){
      for(let i=0;i<170;i++){
        s.snow.push({x:Math.random()*w,y:Math.random()*h,vx:-10+Math.random()*20,vy:22+Math.random()*55,r:0.8+Math.random()*1.8,a:0.10+Math.random()*0.25});
      }
    }else if(s.climate==='fog'){
      for(let i=0;i<16;i++){
        s.fog.push({x:Math.random()*w,y:Math.random()*h,r:140+Math.random()*220,vx:-8+Math.random()*16,vy:-6+Math.random()*12,a:0.04+Math.random()*0.08});
      }
    }
  }
  function tickFx(dt){
    const s=Viewer.state;
    if(s.climate==='none' || !Viewer.els.canvas) return;
    const rect=Viewer.els.canvas.getBoundingClientRect();
    const w=rect.width, h=rect.height;
    if(s.climate==='rain'){
      for(const p of s.rain){
        p.y+=p.v*dt; p.x-=(p.v*0.35)*dt;
        if(p.y>h+60){p.y=-60; p.x=Math.random()*w;}
        if(p.x<-120) p.x=w+120;
      }
    }else if(s.climate==='snow'){
      for(const p of s.snow){
        p.y+=p.vy*dt; p.x+=p.vx*dt;
        if(p.y>h+40){p.y=-40; p.x=Math.random()*w;}
        if(p.x<-40) p.x=w+40;
        if(p.x>w+40) p.x=-40;
      }
    }else if(s.climate==='fog'){
      for(const f of s.fog){
        f.x+=f.vx*dt; f.y+=f.vy*dt;
        if(f.x<-f.r) f.x=w+f.r;
        if(f.x>w+f.r) f.x=-f.r;
        if(f.y<-f.r) f.y=h+f.r;
        if(f.y>h+f.r) f.y=-f.r;
      }
    }
  }
  function drawFx(ctx,w,h){
    const s=Viewer.state;
    if(s.climate==='none') return;
    if(s.climate==='rain'){
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.06)'; ctx.fillRect(0,0,w,h);
      ctx.lineCap='round';
      for(const p of s.rain){
        ctx.globalAlpha=p.a;
        ctx.strokeStyle='rgba(170,210,255,1)';
        ctx.lineWidth=p.w;
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-p.len*0.9,p.y+p.len); ctx.stroke();
      }
      ctx.restore();
    }else if(s.climate==='snow'){
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.03)'; ctx.fillRect(0,0,w,h);
      for(const p of s.snow){
        ctx.globalAlpha=p.a;
        ctx.fillStyle='rgba(255,255,255,1)';
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }else if(s.climate==='fog'){
      ctx.save();
      ctx.fillStyle='rgba(210,220,240,0.05)'; ctx.fillRect(0,0,w,h);
      ctx.globalCompositeOperation='screen';
      for(const f of s.fog){
        const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);
        g.addColorStop(0,`rgba(220,230,255,${f.a})`);
        g.addColorStop(1,'rgba(220,230,255,0)');
        ctx.fillStyle=g;
        ctx.fillRect(f.x-f.r,f.y-f.r,f.r*2,f.r*2);
      }
      ctx.globalCompositeOperation='source-over';
      ctx.restore();
    }
  }

  function draw(){
    if(!Viewer.isOpen) return;
    const c=Viewer.els.canvas;
    const ctx=c.getContext('2d');
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    const rect=c.getBoundingClientRect();
    const w=rect.width, h=rect.height;

    ctx.clearRect(0,0,c.width/devicePixelRatio,c.height/devicePixelRatio);

    const s=Viewer.state;

    if(s.bgImg && s.bgImg.complete){
      ctx.save();
      ctx.translate(s.panX,s.panY);
      ctx.scale(scaleX(),scaleY());
      ctx.drawImage(s.bgImg,0,0,s.bgW,s.bgH);
      ctx.restore();
    }

    drawAOEs(ctx);

    if(s.stamps.length){
      ctx.save();
      ctx.translate(s.panX,s.panY);
      ctx.scale(scaleX(),scaleY());
      const avg=(scaleX()+scaleY())/2;
      for(let i=0;i<s.stamps.length;i++){
        const st=s.stamps[i];
        ctx.save();
        ctx.translate(st.x,st.y);
        if(st.rot) ctx.rotate(st.rot);
        ctx.drawImage(st.img,-st.w/2,-st.h/2,st.w,st.h);
        // Conditions badges (max 3)
        ensureStampMeta(st);
        if(st.conditions && st.conditions.length){
          const avg2=avg;
          const tags = st.conditions.slice(0,3);
          ctx.save();
          ctx.font = `${Math.max(10, 14/avg2)}px system-ui,Segoe UI,Roboto,Arial`;
          ctx.textBaseline='top';
          let offY = -st.h/2 + (6/avg2);
          for(const t of tags){
            const lab = String(t).slice(0,12);
            const padX = 6/avg2, padY = 3/avg2;
            const wText = ctx.measureText(lab).width;
            const boxW = wText + padX*2;
            const boxH = (14/avg2) + padY*2;
            ctx.fillStyle='rgba(0,0,0,0.55)';
            ctx.strokeStyle='rgba(255,255,255,0.22)';
            ctx.lineWidth=1/avg2;
            ctx.beginPath();
            const x0 = -st.w/2 + (6/avg2);
            const y0 = offY;
            roundRect(ctx, x0, y0, boxW, boxH, 6/avg2);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle='rgba(255,255,255,0.92)';
            ctx.fillText(lab, x0+padX, y0+padY);
            offY += boxH + (4/avg2);
          }
          ctx.restore();
        }

        if(i===s.selectedStampIndex){
          ctx.lineWidth=3/avg; ctx.strokeStyle='rgba(255,255,255,0.85)';
          ctx.strokeRect(-st.w/2,-st.h/2,st.w,st.h);
          ctx.lineWidth=1.5/avg; ctx.strokeStyle='rgba(0,0,0,0.65)';
          ctx.strokeRect(-st.w/2,-st.h/2,st.w,st.h);
        }
        ctx.restore();
      }
      ctx.restore();
    }

    drawDrawings(ctx);
    if(s.showGrid) drawGrid(ctx,w,h);
    if(s.mode==='measure' && s.measureStart && (s.measureEndRaw||s.measureEnd)) drawMeasure(ctx);
    drawFx(ctx,w,h);
    // Pings (Alt+Click) - fades in ~1.2s
    if(s.pings && s.pings.length){
      const now=performance.now();
      const keep=[];
      for(const p of s.pings){
        const age = (now - p.t);
        if(age>1200) continue;
        keep.push(p);
        const t = age/1200;
        const sc = worldToScreen(p.x,p.y);
        const rad = 10 + t*46;
        ctx.save();
        ctx.globalAlpha = 0.55*(1-t);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, rad, 0, Math.PI*2);
        ctx.stroke();
        ctx.globalAlpha = 0.30*(1-t);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, rad*1.22, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }
      s.pings = keep;
    }


    Viewer.els.info.textContent=`Zoom ${Math.round(s.zoomMul*100)}% | Grid ${s.gridPx}px | 1q=${s.metersPerCell}m`;
  }

  function setupEvents(){
    const canvas=()=>Viewer.els.canvas;
    let dragging=false;
    let dragMode='pan'; // pan|measure|draw|aoe|moveStamp|stamp
    let last=null;
    let moveIdx=-1;

    function getClient(ev){
      if(ev.touches && ev.touches[0]) return {x:ev.touches[0].clientX,y:ev.touches[0].clientY};
      return {x:ev.clientX,y:ev.clientY};
    }
    function getPos(ev){
      const rect=canvas().getBoundingClientRect();
      const c=getClient(ev);
      return {sx:c.x-rect.left, sy:c.y-rect.top};
    }

    function hitStamp(world){
      const s=Viewer.state;
      for(let i=s.stamps.length-1;i>=0;i--){
        const st=s.stamps[i];
        if(world.x>=st.x-st.w/2 && world.x<=st.x+st.w/2 &&
           world.y>=st.y-st.h/2 && world.y<=st.y+st.h/2) return i;
      }
      return -1;
    }

    // Wheel zoom
    canvas().addEventListener('wheel',(ev)=>{
      ev.preventDefault();
      const s=Viewer.state;
      const {sx,sy}=getPos(ev);
      const before=screenToWorld(sx,sy);
      const factor=ev.deltaY>0?0.92:1.08;
      s.zoomMul=clamp(s.zoomMul*factor,0.2,10);
      const after=screenToWorld(sx,sy);
      s.panX += (after.x-before.x)*scaleX();
      s.panY += (after.y-before.y)*scaleY();
      draw();
    },{passive:false});

    function onDown(ev){
      const s=Viewer.state;

      // Ping / atenção: Ctrl+Click (ou Alt+Click) cria um marcador visual rápido
      if(!(ev.touches || (ev.type && ev.type.indexOf('touch')===0)) && (ev.ctrlKey || ev.altKey) && (ev.button===0 || ev.button===2)){
        ev.preventDefault();
        const {sx,sy}=getPos(ev);
        const w0=screenToWorld(sx,sy);
        addPing(w0.x,w0.y);
        draw();
        return;
      }

      // Pan do mapa: SOMENTE botão direito (mouse). Touch continua pan normal.
      const isRightMouse = (!(ev.touches || (ev.type && ev.type.indexOf('touch')===0)) && ev.button===2);
      const {sx,sy}=getPos(ev);
      let world=screenToWorld(sx,sy);

      ev.preventDefault();

      // se for mouse esquerdo sem ferramenta ativa e sem alvo, não iniciar pan
      dragging=true;
      last=getClient(ev);

      // Botão direito: sempre pan (não interfere com ferramentas)
      if(isRightMouse){
        dragMode='pan';
        return;
      }


      // If tool mode active and click hits a token: use token center as point, do NOT select/move
      const hit = hitStamp(world);
      if(hit>=0 && (s.mode==='measure' || s.mode==='draw' || s.mode==='aoe')){
        const st=s.stamps[hit];
        world = {x:st.x, y:st.y};
      }

      // Place stamp
      if(s.activeStampUrl){
        dragMode='stamp';
        placeStampAt(world).then(()=>{ s.activeStampUrl=null; draw(); });
        return;
      }

      // If no tool active: token select/move
      if(s.mode==='none'){
        if(hit>=0){
          s.selectedStampIndex=hit;
          moveIdx=hit;
          dragMode='moveStamp';
          draw();
          return;
        }else{
          s.selectedStampIndex=-1;
        }
      }

      // AOE
      if(s.mode==='aoe'){
        dragMode='aoe';
        const o=snapToMeters(world);
        s.aoeDraft={kind:'aoe', type:s.aoeTool, color:s.drawColorKey, alphaFill:0.22, alphaStroke:0.75, pts:[o,o]};
        draw();
        return;
      }

      // Draw
      if(s.mode==='draw'){
        dragMode='draw';
        const p=snapToSubgrid(world,4);
        const dr={kind:'draw', type:s.drawTool, color:s.drawColorKey, alpha:s.drawAlpha, width:s.drawWidth, pts:[p,p]};
        if(s.drawTool==='pen') dr.pts=[p];
        s.drawingDraft=dr;
        draw();
        return;
      }

      // Measure
      const desktopShift=(!isMobile() && ev.shiftKey);
      if(s.mode==='measure' || desktopShift){
        dragMode='measure';
        const pStart=snapToCellCenter(world);
        if(!s.measureStart || (s.measureStart && s.measureEnd)){
          s.measureStart=pStart;
          s.measureEnd=null;
          s.measureEndRaw=pStart;
        }
        s.measuring=true;
        s.measureEndRaw=world;
        draw();
        return;
      }

      // Pan: somente botão direito (mouse) ou toque
      if(isRightMouse || (ev.touches || (ev.type && ev.type.indexOf('touch')===0))){
        ev.preventDefault();
        dragMode='pan';
      }else{
        // clique esquerdo no vazio não arrasta o mapa
        dragging=false;
        dragMode='pan';
        draw();
        return;
      }
    }

    function onMove(ev){
      if(!Viewer.isOpen || !dragging) return;
      const s=Viewer.state;
      const {sx,sy}=getPos(ev);
      const world=screenToWorld(sx,sy);

      if(dragMode==='moveStamp' && moveIdx>=0){
        const st=s.stamps[moveIdx];
        st.x=world.x; st.y=world.y;
        draw(); return;
      }
      if(dragMode==='measure'){
        s.measureEndRaw=world; draw(); return;
      }
      if(dragMode==='aoe' && s.aoeDraft){
        s.aoeDraft.pts[1]=snapToMeters(world);
        draw(); return;
      }
      if(dragMode==='draw' && s.drawingDraft){
        const p=snapToSubgrid(world,4);
        if(s.drawTool==='pen') s.drawingDraft.pts.push(p);
        else s.drawingDraft.pts[1]=p;
        draw(); return;
      }
      if(dragMode==='pan' && last){
        const c=getClient(ev);
        s.panX += (c.x-last.x);
        s.panY += (c.y-last.y);
        last=c;
        draw();
      }
    }

    function onUp(){
      if(!Viewer.isOpen) return;
      const s=Viewer.state;

      if(dragMode==='moveStamp' && moveIdx>=0){
        const st=s.stamps[moveIdx];
        const p=snapToCellCenter({x:st.x,y:st.y});
        st.x=p.x; st.y=p.y;
        draw();
      }
      if(dragMode==='measure'){
        if(s.measureEndRaw){
          s.measureEnd=snapToCellCenter(s.measureEndRaw);
          s.measureEndRaw=null;
        }
        s.measuring=false; draw();
      }
      if(dragMode==='aoe' && s.aoeDraft){
        s.aoes.push(s.aoeDraft);
        s.aoeDraft=null;
        draw();
      }
      if(dragMode==='draw' && s.drawingDraft){
        s.drawings.push(s.drawingDraft);
        s.drawingDraft=null;
        draw();
      }

      dragging=false;
      // Pan: somente botão direito (mouse) ou toque
      if(isRightMouse || (ev.touches || (ev.type && ev.type.indexOf('touch')===0))){
        ev.preventDefault();
        dragMode='pan';
      }else{
        // clique esquerdo no vazio não arrasta o mapa
        dragging=false;
        dragMode='pan';
        draw();
        return;
      }
      moveIdx=-1;
    }

    canvas().addEventListener('mousedown',onDown);
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    canvas().addEventListener('touchstart',onDown,{passive:false});
    window.addEventListener('touchmove',onMove,{passive:false});
    window.addEventListener('touchend',onUp,{passive:false});

    canvas().addEventListener('contextmenu',(ev)=>{
      ev.preventDefault();
      const s=Viewer.state;
      if(s.mode!=='none') return; // don't interfere with tools
      const {sx,sy}=getPos(ev);
      const world=screenToWorld(sx,sy);
      const hit=hitStamp(world);
      if(hit<0){ hideCtx(); return; }
      s.selectedStampIndex=hit;
      const st=s.stamps[hit];
      ensureStampMeta(st);

      const title = (st.name||('Token '+(hit+1)));
      const html =
        ctxHeader(escapeHtml(title))+
        ctxItem('📝 Renomear','rename')+
        ctxItem('➕ Adicionar na iniciativa (vinculado)','addInit')+
        ctxSection('Condições')+
        ctxItem('⚑ Editar condições','conds')+
        ctxItem('🧹 Limpar condições','condsClear')+
        ctxSection('Lado')+
        ctxItem('PC','sidePC')+
        ctxItem('NPC','sideNPC')+
        ctxItem('Monstro','sideMON')+
        ctxSection('Ações')+
        ctxItem('🗑️ Remover token','del');

      showCtx(ev.clientX, ev.clientY, html);

      const ctxEl = Viewer.els.root.querySelector('#cvCtx');
      const onClick = (e)=>{
        const act = e.target && e.target.dataset ? e.target.dataset.act : null;
        if(!act) return;
        e.stopPropagation();
        if(act==='rename'){
          const nv = prompt('Nome do token:', st.name||'');
          if(nv!==null){ st.name = nv.trim(); renderInitUI(); draw(); }
          hideCtx();
        }else if(act==='addInit'){
          const init=ensureInitState();
          const already = init.entries.find(x=>x.tokenIndex===hit);
          if(!already){
            const e0 = { id:uid(), name:st.name||title, base:0, bonus:0, d10:0, total:0, tokenIndex:hit };
            computeEntryTotal(e0);
            init.entries.push(e0);
            sortInitiative();
            toast('Adicionado na iniciativa');
          }else{
            toast('Já existe na iniciativa');
          }
          hideCtx();
        }else if(act==='conds'){
          const cur = (st.conditions||[]).join(', ');
          const nv = prompt('Condições (separe por vírgula):\nSugestões: '+KNOWN_CONDITIONS.join(', '), cur);
          if(nv!==null){
            st.conditions = nv.split(',').map(x=>x.trim()).filter(Boolean).slice(0,8);
            draw();
          }
          hideCtx();
        }else if(act==='condsClear'){
          st.conditions=[];
          draw();
          hideCtx();
        }else if(act==='sidePC' || act==='sideNPC' || act==='sideMON'){
          st.side = act.replace('side','');
          toast('Lado: '+st.side);
          hideCtx();
        }else if(act==='del'){
          deleteSelectedStamp();
          hideCtx();
        }
      };
      ctxEl.onclick = onClick;
    });

    window.addEventListener('keydown',(ev)=>{
      if(!Viewer.isOpen) return;

      // Ignore global shortcuts while typing in inputs/selects/contenteditable
      const t = ev.target;
      const tag = (t && t.tagName) ? t.tagName.toLowerCase() : '';
      if(tag==='input' || tag==='textarea' || tag==='select' || (t && t.isContentEditable)) return;

      // Bookmarks: Ctrl/Meta + 1..6 save, Alt + 1..6 load
      if((ev.ctrlKey || ev.metaKey) && /^[1-6]$/.test(ev.key)){
        ev.preventDefault();
        saveBookmark(parseInt(ev.key,10)-1);
        return;
      }
      if(ev.altKey && /^[1-6]$/.test(ev.key)){
        ev.preventDefault();
        loadBookmark(parseInt(ev.key,10)-1);
        return;
      }

      const s=Viewer.state;
      if(ev.key==='Escape'){
        s.activeStampUrl=null;
        s.mode='none';
        s.measuring=false;
        s.measureStart=s.measureEnd=s.measureEndRaw=null;
        s.drawingDraft=null; s.aoeDraft=null;
        updateButtons(); draw();
      }
      if(ev.key==='Delete' || ev.key==='Backspace'){
        deleteSelectedStamp();
      }
    });
  }

  async function loadBackground(url){
    const img=new Image(); img.src=url; await img.decode();
    Viewer.state.bgImg=img;
    Viewer.state.bgW=img.naturalWidth;
    Viewer.state.bgH=img.naturalHeight;
  }

  let rafId=0, lastT=0;
  function loop(t){
    if(!Viewer.isOpen) return;
    if(!lastT) lastT=t;
    const dt=(t-lastT)/1000; lastT=t;
    tickFx(dt);
    if(Viewer.state.climate!=='none') draw();
    rafId=requestAnimationFrame(loop);

    // Restore focus (best-effort)
    if(focusInfo && drawer){
      const q = `input[data-eid="${focusInfo.eid}"][data-k="${focusInfo.k}"]`;
      const el = drawer.querySelector(q);
      if(el){
        try{
          el.focus({preventScroll:true});
          if(focusInfo.selStart!=null && focusInfo.selEnd!=null) el.setSelectionRange(focusInfo.selStart, focusInfo.selEnd);
        }catch(_){}
      }
    }

  }

  Viewer.open = async function(cfg){
    createUI();
    Viewer.isOpen=true;
    Viewer.els.root.style.display='block';
    const s=Viewer.state;

    s.backgroundUrl=cfg.backgroundUrl;
    s.terrain=cfg.terrain||'';
    s.size=cfg.size||'';
    s.gridPx=cfg.gridPx||120;
    s.metersPerCell=cfg.metersPerCell||5;

    s.mode='none';
    s.measuring=false;
    s.measureStart=s.measureEnd=s.measureEndRaw=null;
    s.drawings=[]; s.aoes=[]; s.drawingDraft=null; s.aoeDraft=null;
    s.activeStampUrl=null; s.activeStampSizeCells=1; s.selectedStampIndex=-1;
    s.climate='none';

    const root=Viewer.els.root;
    root.querySelector('#cvShowGrid').checked=s.showGrid;
    root.querySelector('#cvShowSubgrid').checked=s.showSubgrid;
    root.querySelector('#cvGridContrast').value=s.gridContrast;
    root.querySelector('#cvGridColor').value=s.gridColor;
    root.querySelector('#cvSnap').checked=s.snapToGrid;
    root.querySelector('#cvGridPx').value=s.gridPx;
    root.querySelector('#cvMeters').value=s.metersPerCell;
    root.querySelector('#cvTokenSize').value='1';
    root.querySelector('#cvClimate').value='none';
    root.querySelector('#cvConeAngle').value=String(s.coneAngleDeg);
    updateButtons();

    try{ await loadBackground(cfg.backgroundUrl); }
    catch(e){ console.error('[combate] falha mapa',cfg.backgroundUrl,e); alert('Falha ao carregar o mapa: '+cfg.backgroundUrl); }

    const assets=await loadAssetsList();
    renderAssets(assets);

    resizeCanvas();
    window.addEventListener('resize', ()=>{ resizeCanvas(); initFx(); });
    fitToScreenStretchXY();
    initFx();

    cancelAnimationFrame(rafId); rafId=0; lastT=0;
    rafId=requestAnimationFrame(loop);
    draw();
  };

  Viewer.close=function(){
    Viewer.isOpen=false;
    if(Viewer.els.root) Viewer.els.root.style.display='none';
    cancelAnimationFrame(rafId);
    rafId=0;
  };

  window.CombatViewer=Viewer;
})();