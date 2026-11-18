/* ORBIT 391+ — Position list / Movement report open INSIDE the main page (a card under the page content)
   instead of a window over it. The reports keep working as they are: when one is opened on a stock page, the
   report box is moved into a "dock" card of that page. On phones the full-screen report is kept. */
(function () {
  'use strict';
  const Q = (s, r) => (r || document).querySelector(s);
  const KIND = { plBox: ['dk-pl', '📋 Position list — SKU & quantity'], mvBox: ['dk-mv', '📈 Movement report — detailed'], rmvBox: ['dk-mv', '📈 Movement report — detailed'] };
  const VIEWS = ['smv', 'wmv', 'rmp', 'wh3d'];
  const css = document.createElement('style'); css.textContent = [
    '.dk-card{margin:14px 0 0;padding:0;overflow:hidden}',
    '.dk-h{display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--pop-c1,#12306b);color:#fff}',
    '.dk-h h3{margin:0;font-size:15px;color:#fff;flex:1}',
    '.dk-h button{background:var(--brand,#1e3a8a)!important;color:#fff!important;border:0!important;border-radius:6px!important;padding:6px 12px!important}',
    '.dk-b{padding:0}',
    '#plBox.inl,#mvBox.inl,#rmvBox.inl{position:relative!important;inset:auto!important;z-index:auto!important;background:none!important;padding:0!important;display:block!important;backdrop-filter:none!important}',
    '#plBox.inl .pl-c,#mvBox.inl .mv-c,#rmvBox.inl .rmv-c{width:100%!important;max-width:100%!important;min-width:0!important;height:72vh!important;max-height:none!important;box-shadow:none!important;resize:none!important;border-radius:0!important;border:0!important}',
    '.inl .mdl-ctlw,.inl .mdl-ctl{display:none!important}',
    '.inl .pl-h,.inl .mv-h,.inl .rmv-h{padding-right:16px!important}',
    'html body .dk-b .mdl-box>[data-ag-strip="1"]{display:none!important}'
  ].join('\n'); document.head.appendChild(css);
  function view() { const v = Q('.view.active'); return v && VIEWS.indexOf(v.id.replace(/^view-/, '')) >= 0 ? v : null; }
  function host(v, kind, title) {
    let c = Q('.dk-card[data-dk="' + kind + '"]', v);
    if (!c) {
      c = document.createElement('div'); c.className = 'card dk-card'; c.dataset.dk = kind;
      c.innerHTML = '<div class="dk-h"><h3>' + title + '</h3><button type="button" data-dk-x="1">✕ Hide</button></div><div class="dk-b"></div>';
      const cards = [...v.querySelectorAll('.card')].filter(x => !x.parentElement.closest('.card') && !x.classList.contains('dk-card'));
      const last = cards[cards.length - 1];
      if (last && last.parentNode) last.parentNode.insertBefore(c, last.nextSibling); else v.appendChild(c);
      c.addEventListener('click', e => { if (e.target.closest('[data-dk-x]')) { const b = Q('.dk-b > *', c); if (b) b.remove(); c.remove(); } });
      try { new MutationObserver(() => { if (!c.querySelector('.dk-b > *')) c.remove(); }).observe(Q('.dk-b', c), { childList: true }); } catch (e) {}
    }
    return c;
  }
  function dock(box) {
    const k = KIND[box.id]; const v = view(); if (!k || !v || window.innerWidth < 700) return;
    const c = host(v, k[0], k[1]); const b = Q('.dk-b', c);
    [...b.children].forEach(x => x !== box && x.remove());
    b.appendChild(box); box.classList.add('inl');
    setTimeout(() => { try { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 80);
  }
  function init() {
    new MutationObserver(ms => { ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && KIND[n.id] && n.parentNode === document.body) dock(n); })); }).observe(document.body, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
