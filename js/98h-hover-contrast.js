/* ============================================================
   Readable buttons on hover — when a button turns dark under the cursor (the global hover colour) and its text stays dark
   (e.g. "Choose fields…", the buttons of the Data Download pop-up) the text is switched to white while the cursor is on it.
   ============================================================ */
(function () {
  const css = document.createElement('style');
  css.textContent = '.md-b:hover:not(:disabled):not(.md-ok):not(.md-no){color:#fff}';
  document.head.appendChild(css);
  const rgb = s => { const m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/.exec(s || ''); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] } : null; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  let cur = null, tm = null;
  function fix(b) { if (!b || !b.matches(':hover') || b.disabled) return; const cs = getComputedStyle(b), bg = rgb(cs.backgroundColor), fg = rgb(cs.color); if (!bg || !fg || bg.a < .6) return;
    if (lum(bg) < .22 && lum(fg) < .35) { b.dataset.hcw = b.style.getPropertyValue('color') + '|' + b.style.getPropertyPriority('color'); b.style.setProperty('color', '#fff', 'important'); } }
  function undo(b) { if (b && b.dataset.hcw != null) { const [v, p] = b.dataset.hcw.split('|'); if (v) b.style.setProperty('color', v, p); else b.style.removeProperty('color'); delete b.dataset.hcw; } }
  document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('button,[role="button"],.btn'); if (b === cur) return; undo(cur); cur = b; clearTimeout(tm); if (b) { tm = setTimeout(() => fix(b), 30); setTimeout(() => fix(b), 260); } }, true);
  document.addEventListener('mouseleave', () => { undo(cur); cur = null; }, true);
  document.addEventListener('mouseout', e => { if (cur && !(e.relatedTarget && cur.contains(e.relatedTarget))) { undo(cur); cur = null; } }, true);
})();
