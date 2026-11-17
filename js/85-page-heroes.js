/* Header band (hero) of the Forklift / Daily-update dashboards on the Management Daily Report and the Consolidated Inventory pages. */
(function () {
  'use strict';
  const PG = {
    mgt: { div: 'mgd', n: 'Management Daily Report', ic: '📊', s: 'Productivity · overtime · headcount · volumes — straight from the SharePoint lists', c1: '#312e81', c2: '#6366f1', t: '99,102,241', extra: () => '' },
    mgw: { div: 'mgd', n: 'Management Daily Report', ic: '📊', s: 'Productivity · overtime · headcount · volumes — straight from the SharePoint lists', c1: '#312e81', c2: '#6366f1', t: '99,102,241', extra: () => '' },
    wh3d: { div: 'w3d', n: '3D Warehouse View', ic: '🧊', s: 'Racks of your Location ID · pallets from the stock balances', c1: '#0f3d5e', c2: '#0891b2', t: '8,145,178', extra: () => '' },
    whov: { div: 'wov', n: 'Warehouses Overview (3D)', ic: '🏢', s: 'All warehouses · occupied capacity · shelf life of the stock', c1: '#1e3a8a', c2: '#2563eb', t: '37,99,235', extra: () => '' },
    cinv: { div: 'cinv', n: 'Consolidated Inventory — UHT', ic: '📦', s: 'UHT + Oasis water stock reports in one view · by SKU, category and age', c1: '#134e4a', c2: '#0ea5e9', t: '14,165,233', extra: () => '' }
  };
  let css = null;
  function ready() { if (!window.DSTAGE) return false; Object.values(PG).forEach(p => { if (!DSTAGE.DIV[p.div]) DSTAGE.DIV[p.div] = { n: p.n, ic: p.ic, s: p.s, c1: p.c1, c2: p.c2, t: p.t }; });
    if (!css) { css = document.createElement('style'); css.textContent = [...new Set(Object.values(PG).map(p => p.div))].map(d => { const p = Object.values(PG).find(x => x.div === d); return ['mgt', 'mgw', 'cinv', 'wh3d', 'whov'].map(v => `#view-${v}[data-dv="${d}"]`).join(',') + `{--dv1:${p.c1};--dv2:${p.c2};--dvt:${p.t}}`; }).join('') + '.ph-hero .hint{display:none!important}.ph-hero .dst-hero{margin-bottom:12px}#wh3dCard>.card-header>.card-title,#whovCard>.card-header>.card-title{display:none!important}#wh3dCard>.card-header,#whovCard>.card-header{justify-content:flex-end}'; document.head.appendChild(css); } return true; }
  function put(id) { const v = document.getElementById('view-' + id), p = PG[id]; if (!v || !p || !ready()) return; v.dataset.dv = p.div;
    let w = v.querySelector(':scope > .ph-hero'); if (!w) { w = document.createElement('div'); w.className = 'ph-hero'; v.insertBefore(w, v.firstChild); }
    w.innerHTML = DSTAGE.hero(p.div, p.extra()).replace(' — Dashboard</b>', '</b>'); }
  function init() { Object.keys(PG).forEach(id => { const nav = document.querySelector('.nav-item[data-view="' + id + '"]'); if (nav) nav.addEventListener('click', () => setTimeout(() => put(id), 30)); put(id); }); }
  /* ---- every other main page gets the same header band automatically (title + icon from the menu, the menu group as the subtitle) ---- */
  const PAL = [['#312e81', '#6366f1', '99,102,241'], ['#134e4a', '#0ea5e9', '14,165,233'], ['#0f3d5e', '#0891b2', '8,145,178'], ['#14532d', '#16a34a', '22,163,74'], ['#7c2d12', '#ea580c', '234,88,12'], ['#581c87', '#a855f7', '168,85,247'], ['#831843', '#ec4899', '236,72,153'], ['#1e3a8a', '#2563eb', '37,99,235'], ['#78350f', '#d97706', '217,119,6'], ['#164e63', '#06b6d4', '6,182,212'], ['#3f3f46', '#71717a', '113,113,122']];
  const SKIPV = new Set(['home']), AUTO = {}; let autoOn = false;
  function auto() { if (autoOn) return AUTO; autoOn = true; let sec = '', si = -1; const nav = document.querySelector('.sidebar-nav'); if (!nav) return AUTO;
    nav.querySelectorAll('.nav-section-label,.nav-item[data-view]').forEach(el => { if (el.classList.contains('nav-section-label')) { sec = el.textContent.trim(); si++; return; }
      const id = el.dataset.view; if (!id || SKIPV.has(id) || PG[id] || AUTO[id]) return; const sp = el.querySelectorAll(':scope > span'), ic = sp[0] ? sp[0].textContent.trim() : '📄', n = sp[1] ? sp[1].textContent.trim() : id, c = PAL[Math.max(si, 0) % PAL.length];
      AUTO[id] = { div: 'pv_' + id, n, ic, s: (sec ? sec + ' · ' : '') + n, c1: c[0], c2: c[1], t: c[2] }; }); return AUTO; }
  function putAuto(id) { const v = document.getElementById('view-' + id), p = auto()[id]; if (!v || !p || !window.DSTAGE) return;
    const own = v.querySelector('.dst-hero,.wd-hero,.mb-hero'), mine = v.querySelector(':scope > .ph-hero');
    if (own && !(mine && mine.contains(own))) { if (mine) mine.remove(); return; }   /* the page already has its own header */
    if (mine) return; if (!DSTAGE.DIV[p.div]) DSTAGE.DIV[p.div] = { n: p.n, ic: p.ic, s: p.s, c1: p.c1, c2: p.c2, t: p.t };
    v.dataset.dv = p.div; v.style.setProperty('--dv1', p.c1); v.style.setProperty('--dv2', p.c2); v.style.setProperty('--dvt', p.t);
    const w = document.createElement('div'); w.className = 'ph-hero'; w.innerHTML = DSTAGE.hero(p.div, '').replace(' — Dashboard</b>', '</b>'); v.insertBefore(w, v.firstChild); }
  /* pop-up windows take the colour of the section / model they were opened from (the same colours as the page header band) */
  function popCol() { const v = document.querySelector('.view.active'); if (!v) return; const id = v.id.replace(/^view-/, ''), p = PG[id] || auto()[id]; const r = document.documentElement.style; if (!p) { r.removeProperty('--pop-c1'); r.removeProperty('--pop-c2'); return; } r.setProperty('--pop-c1', p.c1); r.setProperty('--pop-c2', p.c2); r.setProperty('--pop-t', p.t); }
  (function () { const st = document.createElement('style'); st.textContent = [
    /* one pop-up look everywhere = the Import window: solid section-colour border + title bar, square navy window buttons */
    'html body .mdl-box,html body #tblExpandOverlay.te-win{background:var(--card,#fff)!important;border:3px solid var(--pop-c1,#12306b)!important;border-radius:14px!important}',
    'html body .mdl-ctlw>.mdl-ctl{background:none!important;border-radius:0!important;overflow:visible!important;gap:6px;right:10px!important;top:9px!important}',
    'html body .mdl-ctl button{width:50px!important;height:34px!important;border-radius:6px!important;background:var(--brand,#1e3a8a)!important;color:#fff!important}',
    'html body .mdl-ctl button:hover{background:rgba(15,23,42,.85)!important}html body .mdl-ctl button.mdl-x:hover{background:#e81123!important}',
    'html body .mdl-box>:is(.tm-head,.card-header,.modal-header,.mdl-bar){background:var(--pop-c1,#12306b)!important;color:#fff!important;border-radius:11px 11px 0 0!important;padding:9px 190px 9px 16px!important;margin:0 0 12px!important;min-height:52px!important;box-sizing:border-box!important;border-bottom:0!important}',
    'html body .mdl-box>:is(.tm-head,.card-header,.modal-header,.mdl-bar) :is(h1,h2,h3,h4,.card-title,.card-desc,b,strong,label,.text-sm,small){color:#fff!important}',
    'html body .mdl-box>:is(.tm-head,.card-header,.modal-header,.mdl-bar) :is(button,.btn,a.btn):not(.mdl-ctl button){background:rgba(255,255,255,.16)!important;color:#fff!important;border:1px solid rgba(255,255,255,.35)!important}',
    'html body .mdl-box>:is(.tm-head,.card-header,.modal-header,.mdl-bar) :is(button,.btn):not(.mdl-ctl button):hover{background:rgba(255,255,255,.3)!important}'
  ].join('\n'); document.head.appendChild(st); })();
  function autoAll() { try { popCol(); } catch (e) {} Object.keys(auto()).forEach(id => { const v = document.getElementById('view-' + id); if (v && v.classList.contains('active')) putAuto(id); }); }
  function initAuto() { let t = 0; const run = () => { clearTimeout(t); t = setTimeout(autoAll, 60); setTimeout(autoAll, 900); };
    document.querySelectorAll('.view').forEach(v => { try { new MutationObserver(run).observe(v, { attributes: true, attributeFilter: ['class'] }); } catch (e) {} });
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.nav-item,[data-view]')) run(); }, true); run(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAuto); else initAuto();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
