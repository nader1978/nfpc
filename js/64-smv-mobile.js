/* Stock Movement Entry → 📱 Mobile card: the picking list (pushed → To pick / Picking / In transit → confirmed) and the movements posted from the mobile app (receipts & picks) */
(function () {
  const Q = s => document.querySelector(s), M = { tab: 'pick' };
  function render() {
    const tb = Q('#smvMobTabs'), b = Q('#smvMob'); if (!tb || !b) return; const P = window.PTR && PTR.P, open = P ? P.rows.filter(r => PTR.OPEN.includes(r.Transit_Status)).length : 0, mob = window.WMVX && WMVX.S.hist ? (WMVX.S.hist.mob || []).length : 0;
    tb.innerHTML = [['pick', '🚚 Pushed for picking / in transit' + (open ? ' (' + open + ' open)' : '')], ['mob', '📥 Received & picked on mobile' + (mob ? ' (' + mob + ')' : '')]].map(([k, t]) => `<button type="button" class="${M.tab === k ? 'active on' : ''}" data-smt="${k}">${t}</button>`).join('');
    if (M.tab === 'pick') { if (!window.PTR) { b.innerHTML = '<div class="smv-hint">The picking-list module is not loaded.</div>'; return; } b.innerHTML = (P.loading && !P.loaded ? '<div class="smv-hint">Reading the picking list…</div>' : '') + PTR.html(); }
    else { if (!window.WMVX) { b.innerHTML = ''; return; } b.innerHTML = !WMVX.S.hist ? '<div class="smv-hint">Reading the movements… (press 🔄 Reload if nothing appears)</div>' : WMVX.mobileHtml(); }
  }
  function load(force) { try { window.PTR && PTR.load(!!force); } catch (e) {} try { if (window.WMVX && (force || !WMVX.S.hist)) Promise.resolve(WMVX.load(!!force)).then(() => setTimeout(render, 300)); } catch (e) {} render(); }
  document.addEventListener('ptr:change', () => { if (Q('#smvMob') && Q('#smvMob').offsetParent) render(); });
  function css() { if (Q('#smvMobCss')) return; const src = [...document.querySelectorAll('style')].find(x => x.textContent.includes('#view-wmv .wm-seg')); if (!src) return; const st = document.createElement('style'); st.id = 'smvMobCss'; st.textContent = src.textContent.replace(/#view-wmv/g, '#smvMobCard') + '#smvMobCard .wm-hint{font-size:12px;color:var(--gray-600)}#smvMobCard .wm-k span{font-size:12px;color:var(--gray-600);display:block}'; document.head.appendChild(st); }
  function init() { css(); const c = Q('#smvMobCard'); if (!c || c._i) return; c._i = 1;
    c.addEventListener('click', e => { const t = e.target.closest('[data-smt],[data-smm]'); if (!t) return; if (t.dataset.smt) { M.tab = t.dataset.smt; return render(); } if (t.dataset.smm === 'reload') load(true); });
    if (window.PTR) PTR.wire('#smvMobCard', render); }
  const nav = Q('.nav-item[data-view="smv"]'); if (nav) nav.addEventListener('click', () => { init(); setTimeout(() => load(false), 120); });
  setInterval(() => { const b = Q('#smvMob'); if (b && b.offsetParent && !b.innerHTML) { init(); load(false); } }, 2000);
  window.SMVM = { render, load };
})();
