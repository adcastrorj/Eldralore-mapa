// Bootstrap do Atlas (arquivo leve)
// Carrega os módulos em ordem via index.html e inicia o app quando o DOM estiver pronto.
// (Evita null em elementos que aparecem depois das tags <script>, como o botão de sair do modo apresentação.)
(function () {
  function boot() {
    if (typeof main === 'function') {
      try { main(); } catch (e) { console.error(e); }
    } else {
      console.error('main() não encontrado. Verifique a ordem dos scripts em index.html.');
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();