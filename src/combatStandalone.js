// Standalone launcher for combat.html
(function(){
  function getParam(k){ return new URLSearchParams(location.search).get(k); }
  window.addEventListener('load', async ()=>{
    const bg = getParam('bg');
    if(!bg){
      alert('Mapa de combate não informado.');
      return;
    }
    const gridPx = parseInt(getParam('gridPx')||'70',10);
    const metersPerCell = parseFloat(getParam('metersPerCell')||'5');
    const showGrid = (getParam('showGrid')||'1') === '1';
    const terrain = getParam('terrain') || '';
    const size = getParam('size') || '';

    try{
      await window.CombatViewer.open({ backgroundUrl:bg, terrain, size, gridPx, metersPerCell, showGrid });
    }catch(e){
      console.error(e);
      alert('Falha ao abrir o combate.');
    }
  });
})();
