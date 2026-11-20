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

/* ORBIT 448 — every Rack / Forklift record, e-mail and action window (#flrAct / #flrPop) can be resized: drag any edge or corner.
   Moving stays with the title bar (js/34). The size is remembered for the session. */
(function () {
  'use strict';
  const css = document.createElement('style'); css.textContent = '#flrAct .flr-pc,#flrPop .flr-pc{position:relative}#flrAct .flr-pc>.flr-pb,#flrPop .flr-pc>.flr-pb{flex:1 1 auto;min-height:0}#flrAct .flr-pc.flr-sized,#flrPop .flr-pc.flr-sized{max-width:none!important;max-height:none!important}.flr-rz{position:absolute;z-index:6}.flr-rz-n,.flr-rz-s{left:12px;right:12px;height:11px;cursor:ns-resize}.flr-rz-n{top:-4px}.flr-rz-s{bottom:-4px}.flr-rz-e,.flr-rz-w{top:12px;bottom:12px;width:11px;cursor:ew-resize}.flr-rz-e{right:-4px}.flr-rz-w{left:-4px}.flr-rz-ne,.flr-rz-nw,.flr-rz-se,.flr-rz-sw{width:18px;height:18px}.flr-rz-ne{top:-4px;right:-4px;cursor:nesw-resize}.flr-rz-sw{bottom:-4px;left:-4px;cursor:nesw-resize}.flr-rz-nw{top:-4px;left:-4px;cursor:nwse-resize}.flr-rz-se{bottom:-4px;right:-4px;cursor:nwse-resize}.mdl-full .flr-rz{display:none}';
  document.head.appendChild(css);
  let saved = null; try { saved = JSON.parse(sessionStorage.getItem('flrSize') || 'null'); } catch (e) { }
  function fx(W) {
    if (!W || W._rz) return; W._rz = 1;
    const holder = () => W.parentElement, off = () => holder()._mdl || (holder()._mdl = { x: 0, y: 0 }), put = () => { const o = off(); W.style.transform = 'translate(' + o.x + 'px,' + o.y + 'px)'; };
    const size = (w, h) => { W.classList.add('flr-sized'); W.style.width = w + 'px'; W.style.height = h + 'px'; };
    if (saved && saved.w > 400 && saved.h > 260) size(Math.min(innerWidth - 20, saved.w), Math.min(innerHeight - 20, saved.h));
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(d => { const g = document.createElement('i'); g.className = 'flr-rz flr-rz-' + d; g.title = 'Drag to resize'; W.appendChild(g);
      g.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); e.stopPropagation(); const r = W.getBoundingClientRect(), o = off(), x0 = e.clientX, y0 = e.clientY, ox = o.x, oy = o.y; g.setPointerCapture(e.pointerId);
        const mv = ev => { let w = r.width, h = r.height, dx = ev.clientX - x0, dy = ev.clientY - y0; if (d.includes('e')) w = r.width + dx; if (d.includes('w')) w = r.width - dx; if (d.includes('s')) h = r.height + dy; if (d.includes('n')) h = r.height - dy;
          w = Math.max(420, Math.min(innerWidth - 8, w)); h = Math.max(260, Math.min(innerHeight - 8, h)); size(w, h);
          /* the window is centred by its overlay: shift it by half of the growth so the opposite edge stays where it is */
          o.x = ox + (d.includes('e') ? (w - r.width) / 2 : d.includes('w') ? -(w - r.width) / 2 : 0); o.y = oy + (d.includes('s') ? (h - r.height) / 2 : d.includes('n') ? -(h - r.height) / 2 : 0); put(); };
        const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); const b = W.getBoundingClientRect(); saved = { w: Math.round(b.width), h: Math.round(b.height) }; try { sessionStorage.setItem('flrSize', JSON.stringify(saved)); } catch (x) { } };
        g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); }); });
  }
  const scan = () => document.querySelectorAll('#flrAct .flr-pc,#flrPop .flr-pc').forEach(fx);
  new MutationObserver(scan).observe(document.body, { childList: true }); scan();
})();
