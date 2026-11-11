/* ============================================================
   🏢 DIVISION DASHBOARDS — the dashboard stays fixed in the background, every other tab opens as a pop-up window over it
   Used by: 🏗 Project Progress (prj) · 🛠 Marketing Equipment Workshop (eqw) · 🚚 Fleet (flt) · 🧪 RMPM inventory (rmp) · 👥 Attendance (att)
   Each division dashboard has its own colour theme + banner.
     DSTAGE.stage(body, o)  — for modules that render HTML strings:
        o = { div, tab, dashTab:'dash', dash: () => html, html: () => html, title, onClose: fn, head: html (optional, pop-up header extras) }
     DSTAGE.move(view, o)    — for modules with fixed panes (attendance): moves the tab's DOM nodes into the pop-up and back
        o = { div, dashEl, nodes: [el…], title, open: bool, onClose: fn }
   ============================================================ */
(function () {
  'use strict';
  const DIV = {
    prj: { n: 'Projects Division', ic: '🏗', s: 'Projects · phases · schedule · cost · manpower', c1: '#312e81', c2: '#7c3aed', t: '124,58,237' },
    eqw: { n: 'Marketing Equipment Workshop', ic: '🛠', s: 'Assets · repairs · estimates · technicians · spare parts', c1: '#134e4a', c2: '#14b8a6', t: '20,184,166' },
    flt: { n: 'Fleet & Transport Division', ic: '🚚', s: 'Vehicles · drivers · fuel · maintenance · documents', c1: '#7c2d12', c2: '#f59e0b', t: '245,158,11' },
    rmp: { n: 'RMPM Stores Division', ic: '🧪', s: 'Raw & packing materials · lots · QC · FEFO', c1: '#881337', c2: '#f43f5e', t: '244,63,94' },
    att: { n: 'People & Attendance', ic: '👥', s: 'Attendance · overtime · staff hours · KPIs', c1: '#0c4a6e', c2: '#0ea5e9', t: '14,165,233' }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const css = document.createElement('style'); css.id = 'dstCss';
  css.textContent = Object.entries(DIV).map(([k, d]) => `[data-dv="${k}"]{--dv1:${d.c1};--dv2:${d.c2};--dvt:${d.t}}`).join('') + `
.dst-bg{--brand:var(--dv1);--brand-light:rgba(var(--dvt),.10);background:linear-gradient(180deg,rgba(var(--dvt),.09),rgba(var(--dvt),.015) 320px);border:1px solid rgba(var(--dvt),.22);border-radius:20px;padding:14px;margin-top:6px}
.dst-bg h4,.dst-bg h3{color:var(--dv1)}body.dark .dst-bg h4,body.dark .dst-bg h3,[data-theme="dark"] .dst-bg h4{color:var(--dv2)}
.dst-hero{position:relative;overflow:hidden;border-radius:16px;padding:16px 20px;margin-bottom:14px;color:#fff;background:radial-gradient(circle at 92% -30%,rgba(255,255,255,.28) 0 120px,transparent 121px),radial-gradient(circle at 78% 140%,rgba(255,255,255,.14) 0 90px,transparent 91px),linear-gradient(120deg,var(--dv1),var(--dv2));box-shadow:0 14px 30px -16px rgba(var(--dvt),.9);display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.dst-hero .ic{font-size:30px;width:54px;height:54px;border-radius:14px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex:none}
.dst-hero b{font-size:19px;letter-spacing:.2px;display:block}.dst-hero small{opacity:.88;font-size:12.5px}.dst-hero .tm{margin-left:auto;text-align:right;font-size:12px;opacity:.92}.dst-hero .tm b{font-size:15px}
.dst-hero .hint{font-size:11.5px;background:rgba(255,255,255,.16);border-radius:999px;padding:3px 10px;display:inline-block;margin-top:5px}
.dst-ov{position:fixed;z-index:950;background:rgba(15,23,42,.42);backdrop-filter:blur(2.5px);-webkit-backdrop-filter:blur(2.5px);display:flex;align-items:flex-start;justify-content:center;padding:18px 18px 14px;box-sizing:border-box;animation:dstIn .16s ease-out}
@keyframes dstIn{from{opacity:0}to{opacity:1}}@keyframes dstUp{from{transform:translateY(14px);opacity:.4}to{transform:none;opacity:1}}
.dst-win{background:var(--bg,#f8fafc);color:var(--text,#0f172a);width:min(1500px,100%);height:100%;border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 34px 80px -24px rgba(15,23,42,.65),0 0 0 1px rgba(var(--dvt),.35);animation:dstUp .18s ease-out}
body.dark .dst-win{background:var(--card,#0f172a)}
.dst-wh{display:flex;align-items:center;gap:12px;padding:10px 14px 10px 18px;color:#fff;background:linear-gradient(120deg,var(--dv1),var(--dv2));flex:none}
.dst-wh .t{font-weight:800;font-size:15.5px}.dst-wh .d{font-size:11.5px;opacity:.85}.dst-wh select{max-width:340px;border-radius:9px;border:0;padding:5px 8px;color:#0f172a}
.dst-x{background:#dc2626!important;color:#fff!important;border:0!important;border-radius:8px!important;width:34px;height:34px;min-width:34px;padding:0!important;cursor:pointer;font-weight:800;font-size:15px;line-height:1;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.25)}.dst-x:hover{background:#b91c1c!important}
.dst-back{background:rgba(255,255,255,.18)!important;color:#fff!important;border:1px solid rgba(255,255,255,.35)!important;border-radius:9px!important;padding:5px 12px!important;cursor:pointer;font-weight:700;font-size:12.5px}
.dst-b{flex:1;overflow:auto;padding:16px 18px;--brand:var(--dv1);--brand-light:rgba(var(--dvt),.10)}
.dst-b > .card,.dst-b > .at-pane.card{box-shadow:none}
.dst-tabs-pop button[data-t]:not(.on){position:relative}
.pl-tabs button:hover:not(.on):not(:disabled){background:rgba(var(--dvt,0,120,212),.12)!important;color:var(--dv1,var(--brand,#0078d4))!important;border-color:rgba(var(--dvt,0,120,212),.45)!important}
body.dark .pl-tabs button:hover:not(.on):not(:disabled){color:#fff!important;background:rgba(255,255,255,.12)!important}
@media (max-width:760px){.dst-ov{padding:6px}.dst-win{border-radius:12px}.dst-hero .tm{margin-left:0;text-align:left}}`;
  document.head.appendChild(css);

  const now = () => new Date().toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  function hero(div, extra) { const d = DIV[div] || DIV.prj; return `<div class="dst-hero"><span class="ic">${d.ic}</span><div><b>${esc(d.n)} — Dashboard</b><small>${esc(d.s)}</small><div class="hint">Open any tab above — it pops up over this dashboard · close it (✕) to come back here</div></div><div class="tm">Updated<br><b>${esc(now())}</b>${extra ? '<br>' + extra : ''}</div></div>`; }

  /* the pop-up covers the content area only — the side panel and the top bar stay visible */
  function place(ov) { if (!ov || !ov.isConnected) return; const mn = document.querySelector('.main'), r = mn ? mn.getBoundingClientRect() : { left: 0 }; let top = 0;
    const tb = mn && [...mn.children].find(c => !c.classList.contains('content') && c.offsetHeight > 20 && /fixed|sticky/.test(getComputedStyle(c).position)); if (tb) top = Math.max(0, tb.getBoundingClientRect().bottom);
    else { const ct = document.querySelector('.content'); if (ct) top = Math.max(0, ct.getBoundingClientRect().top); }
    const narrow = window.innerWidth < 820; ov.style.left = (narrow ? 0 : Math.max(0, r.left)) + 'px'; ov.style.top = top + 'px'; ov.style.right = '0'; ov.style.bottom = '0'; }
  const live = new Set(); const rePlace = () => live.forEach(o => o.isConnected ? place(o) : live.delete(o));
  window.addEventListener('resize', rePlace); window.addEventListener('scroll', rePlace, true);
  new MutationObserver(rePlace).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  function makeOv(div, title, onClose, head) { const ov = document.createElement('div'); ov.className = 'dst-ov'; ov.dataset.dv = div; ov.dataset.nohc = '1';
    ov.innerHTML = `<div class="dst-win" data-nohc="1"><div class="dst-wh"><button type="button" class="dst-back" data-dstx="1" title="Back to the dashboard">← Dashboard</button><div style="min-width:0"><div class="t" data-dstt></div><div class="d">${esc((DIV[div] || {}).n || '')}</div></div><span data-dsth style="display:flex;gap:8px;align-items:center"></span><span style="flex:1"></span><button type="button" class="dst-x" data-dstx="1" title="Close — back to the dashboard">✕</button></div><div class="dst-b"></div></div>`;
    ov.querySelector('[data-dstt]').textContent = title || ''; if (head) ov.querySelector('[data-dsth]').innerHTML = head;
    ov.addEventListener('click', e => { if (e.target.closest('[data-dstx]')) { e.preventDefault(); e.stopPropagation(); onClose && onClose(); } });
    live.add(ov); requestAnimationFrame(() => place(ov)); return ov; }

  /* ---- HTML-string modules ---- */
  function stage(body, o) { if (!body) return; const dashTab = o.dashTab || 'dash'; const vw = body.closest('.view'); if (vw) vw.dataset.dv = o.div;
    if (o.tab === dashTab) { body.innerHTML = `<div class="dst-bg" data-dv="${o.div}">${hero(o.div, o.heroExtra)}${o.dash()}</div>`; body._dstT = Date.now(); return; }
    let bg = body.querySelector(':scope > .dst-bg'), ov = body.querySelector(':scope > .dst-ov');
    if (!bg) { body.innerHTML = ''; bg = document.createElement('div'); bg.className = 'dst-bg'; bg.dataset.dv = o.div; body.appendChild(bg); body._dstT = 0; }
    if (!body._dstT || Date.now() - body._dstT > 5000) { try { bg.innerHTML = hero(o.div, o.heroExtra) + o.dash(); } catch (e) { bg.innerHTML = hero(o.div); } body._dstT = Date.now(); }
    if (!ov) { ov = makeOv(o.div, o.title, o.onClose, o.head); body.appendChild(ov); }
    else { ov.querySelector('[data-dstt]').textContent = o.title || ''; const h = ov.querySelector('[data-dsth]'); if (o.head != null && h.dataset.v !== o.head) { h.innerHTML = o.head; h.dataset.v = o.head; } }
    const b = ov.querySelector('.dst-b'), same = ov.dataset.tab === o.tab, st = same ? b.scrollTop : 0; ov.dataset.tab = o.tab;
    b.innerHTML = o.html(); b.scrollTop = st; place(ov); }

  /* ---- fixed-pane modules ---- */
  function move(view, o) { if (!view) return; view.dataset.dv = o.div; let ov = view.querySelector(':scope .dst-ov[data-mv]');
    const back = () => { if (!ov) return; [...ov.querySelectorAll('.dst-b > *')].forEach(n => { if (n._dstPh && n._dstPh.parentNode) { n._dstPh.parentNode.insertBefore(n, n._dstPh); n._dstPh.remove(); n._dstPh = null; } }); ov.remove(); live.delete(ov); ov = null; };
    if (o.dashEl) { o.dashEl.classList.add('dst-bg'); o.dashEl.dataset.dv = o.div; let h = o.dashEl.querySelector(':scope > .dst-hero'); const hh = hero(o.div, o.heroExtra); if (!h) o.dashEl.insertAdjacentHTML('afterbegin', hh); else h.outerHTML = hh; }
    if (!o.open) return back();
    if (!ov) { ov = makeOv(o.div, o.title, o.onClose, o.head); ov.dataset.mv = '1'; view.appendChild(ov); }
    ov.querySelector('[data-dstt]').textContent = o.title || '';
    const b = ov.querySelector('.dst-b'), want = o.nodes.filter(Boolean);
    [...b.children].forEach(n => { if (!want.includes(n) && n._dstPh) { n._dstPh.parentNode.insertBefore(n, n._dstPh); n._dstPh.remove(); n._dstPh = null; } });
    want.forEach(n => { if (n.parentNode !== b) { const ph = document.createComment('dst'); n.parentNode.insertBefore(ph, n); n._dstPh = ph; } b.appendChild(n); });
    place(ov); }

  window.DSTAGE = { DIV, stage, move, hero, place };
})();
