/* ORBIT 393 — Position list / Movement report windows open INSIDE the main page area (the content to the right of the
   side menu, under the top bar) instead of covering the whole screen. They stay normal windows (move / resize / min / max). */
(function () {
  'use strict';
  const Q = (s, r) => (r || document).querySelector(s);
  const IDS = { plBox: 1, mvBox: 1, rmvBox: 1, rpsBox: 1 };
  const st = document.createElement('style'); st.textContent = 'body .dk-in{position:fixed!important;z-index:2147482000!important;padding:12px!important;align-items:center!important;justify-content:center!important}body .dk-in>[class$="-c"]{height:100%!important;max-height:100%!important;width:100%!important;max-width:100%!important}'; document.head.appendChild(st);
  function area() {
    const v = Q('.view.active'); if (!v || window.innerWidth < 700) return null;
    const W = window.innerWidth, H = window.innerHeight, sb = Q('.sidebar'), sr = sb ? sb.getBoundingClientRect() : null, vr = v.getBoundingClientRect();
    const left = sr && sr.width > 0 && sr.height > 100 && sr.left <= 4 ? Math.round(sr.right) : 0;
    const top = vr.top > 0 && vr.top < 220 ? Math.round(vr.top) : 0;
    if (W - left < 300) return null;
    return { l: left, t: top, r: 0, b: 0 };
  }
  function place(box) { const a = area(); if (!a) { box.classList.remove('dk-in'); return; } box.classList.add('dk-in'); box.style.setProperty('inset', a.t + 'px ' + a.r + 'px ' + a.b + 'px ' + a.l + 'px', 'important'); }
  function init() {
    const open = new Set();
    new MutationObserver(ms => { ms.forEach(m => { m.addedNodes.forEach(n => { if (n.nodeType === 1 && IDS[n.id] && n.parentNode === document.body) { open.add(n); place(n); } }); }); }).observe(document.body, { childList: true });
    window.addEventListener('resize', () => open.forEach(b => b.isConnected ? place(b) : open.delete(b)));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
