/* Stadsvandring.io — marknadsföringssida.
   Tillgänglig flikkomponent ("Så funkar appen"). CSP-säkert:
   extern fil, inga inline-handlers. Progressiv förbättring —
   utan JS visas första panelen och övriga är dolda men finns
   i HTML:en (sökbart innehåll). */
(function () {
  'use strict';

  var tablists = document.querySelectorAll('[role="tablist"]');

  Array.prototype.forEach.call(tablists, function (tablist) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    function panelFor(tab) {
      var id = tab.getAttribute('aria-controls');
      return id ? document.getElementById(id) : null;
    }

    function select(tab, setFocus) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute('aria-selected', selected ? 'true' : 'false');
        t.tabIndex = selected ? 0 : -1;
        var panel = panelFor(t);
        if (panel) panel.hidden = !selected;
      });
      if (setFocus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });

      tab.addEventListener('keydown', function (e) {
        var idx = i;
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            idx = (i + 1) % tabs.length; break;
          case 'ArrowLeft':
          case 'ArrowUp':
            idx = (i - 1 + tabs.length) % tabs.length; break;
          case 'Home':
            idx = 0; break;
          case 'End':
            idx = tabs.length - 1; break;
          default:
            return;
        }
        e.preventDefault();
        select(tabs[idx], true);
      });
    });
  });
})();
