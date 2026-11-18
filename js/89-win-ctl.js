/* ORBIT 394 — the drill-down / original-entry / e-mail windows get the same ⎯ ▢ ✕ window buttons as every other pop-up.
   Runs after js/87 has split the header into title bar + toolbar strip; the new buttons sit on the title bar and
   simply click the window's own maximise / close buttons (which are hidden). */
(function () {
  'use strict';
  const WIN = '.sdb-dw,.sdb-rw,.sdb-mw';
  function fix(w) {
    const bar = w.querySelector(':scope > [data-ag-strip="1"]') || (w.querySelector(':scope > .sdb-dh') && w.querySelector(':scope > .sdb-dh:not([data-ag-strip])') ? null : null);
    if (!bar || bar.querySelector('.wc-trio')) return;
    const close = w.querySelector('.sdb-dx,[data-x],[data-rx]'), max = w.querySelector('[data-mx],[data-rmx]');
    const mk = (txt, title, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'wc-b ' + cls; b.textContent = txt; b.title = title; b.style.cssText = 'cursor:pointer;line-height:1'; b.addEventListener('click', e => { e.stopPropagation(); fn(); }); return b; };
    const trio = document.createElement('span'); trio.className = 'wc-trio'; trio.style.cssText = 'display:inline-flex;gap:4px;margin-left:auto;flex:none;align-self:center';
    trio.appendChild(mk('—', 'Minimise / restore', 'wc-n', () => w.classList.toggle('sdb-mini')));
    trio.appendChild(mk('▢', 'Maximise / restore', 'wc-m', () => { w.classList.remove('sdb-mini'); if (w._max) w._max(); else if (max) max.click(); }));
    trio.appendChild(mk('✕', 'Close', 'wc-x', () => { if (close) close.click(); }));
    [close, max].forEach(x => { if (x) { x.classList.add('wc-orig'); x.style.setProperty('display', 'none', 'important'); } });
    bar.appendChild(trio);
  }
  function scan() { document.querySelectorAll(WIN).forEach(w => { try { fix(w); } catch (e) {} }); }
  let t = 0; const sched = () => { if (t) return; t = setTimeout(() => { t = 0; scan(); }, 400); };
  function init() { const st = document.createElement('style'); st.textContent = 'html body .wc-orig.wc-orig.wc-orig{display:none!important}'; document.head.appendChild(st); try { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); } catch (e) {} sched(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
