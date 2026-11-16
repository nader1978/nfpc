/* Header band (hero) of the Forklift / Daily-update dashboards on the Management Daily Report and the Consolidated Inventory pages. */
(function () {
  'use strict';
  const PG = {
    mgt: { div: 'mgd', n: 'Management Daily Report', ic: '📊', s: 'Productivity · overtime · headcount · volumes — straight from the SharePoint lists', c1: '#312e81', c2: '#6366f1', t: '99,102,241', extra: () => '' },
    mgw: { div: 'mgd', n: 'Management Daily Report', ic: '📊', s: 'Productivity · overtime · headcount · volumes — straight from the SharePoint lists', c1: '#312e81', c2: '#6366f1', t: '99,102,241', extra: () => '' },
    cinv: { div: 'cinv', n: 'Consolidated Inventory — UHT', ic: '📦', s: 'UHT + Oasis water stock reports in one view · by SKU, category and age', c1: '#134e4a', c2: '#0ea5e9', t: '14,165,233', extra: () => '' }
  };
  let css = null;
  function ready() { if (!window.DSTAGE) return false; Object.values(PG).forEach(p => { if (!DSTAGE.DIV[p.div]) DSTAGE.DIV[p.div] = { n: p.n, ic: p.ic, s: p.s, c1: p.c1, c2: p.c2, t: p.t }; });
    if (!css) { css = document.createElement('style'); css.textContent = [...new Set(Object.values(PG).map(p => p.div))].map(d => { const p = Object.values(PG).find(x => x.div === d); return `#view-mgt[data-dv="${d}"],#view-mgw[data-dv="${d}"],#view-cinv[data-dv="${d}"]{--dv1:${p.c1};--dv2:${p.c2};--dvt:${p.t}}`; }).join('') + '.ph-hero .hint{display:none!important}.ph-hero .dst-hero{margin-bottom:12px}'; document.head.appendChild(css); } return true; }
  function put(id) { const v = document.getElementById('view-' + id), p = PG[id]; if (!v || !p || !ready()) return; v.dataset.dv = p.div;
    let w = v.querySelector(':scope > .ph-hero'); if (!w) { w = document.createElement('div'); w.className = 'ph-hero'; v.insertBefore(w, v.firstChild); }
    w.innerHTML = DSTAGE.hero(p.div, p.extra()).replace(' — Dashboard</b>', '</b>'); }
  function init() { Object.keys(PG).forEach(id => { const nav = document.querySelector('.nav-item[data-view="' + id + '"]'); if (nav) nav.addEventListener('click', () => setTimeout(() => put(id), 30)); put(id); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
