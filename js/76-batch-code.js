/* ============================================================
   BATCH CODE FROM THE EXPIRY DATE — in every "Create new batch" pop-up (WHs Movements · Stock Movement Entry):
   batch code = first letter of the item code + expiry date as ddmmyyyy  →  Q6922, expiry 01/02/2027  →  Q01022027
   Filled as soon as the expiry date is set (or suggested from the production date). A code typed by hand is kept;
   clearing the box brings the automatic code back.
   ============================================================ */
(function () {
  const DLG = '#wmbBack,#wbBack';
  const codeOf = (sku, exp) => { const m = String(exp || '').match(/^(\d{4})-(\d\d)-(\d\d)$/), c = String(sku || '').trim().replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase(); return m && c ? c + m[3] + m[2] + m[1] : ''; };
  const parts = d => ({ code: d.querySelector('#wmbCode,[data-wk="code"]'), exp: d.querySelector('#wmbExp,[data-wk="exp"]'), sku: ((d.querySelector('h3 + div b, .wm-hint b') || {}).textContent || '').trim() });
  function fill(d) { if (!d || !d.isConnected) return; const p = parts(d); if (!p.code || !p.exp || p.code.dataset.manual === '1') return; const c = codeOf(p.sku, p.exp.value); if (c) p.code.value = c; }
  function prep(d) { if (d._bc) return; const p = parts(d); if (!p.code || !p.exp || !/batch/i.test(d.textContent)) return; d._bc = 1;
    p.code.placeholder = 'made from the expiry date — e.g. ' + (codeOf(p.sku, '2027-02-01') || 'Q01022027');
    p.code.title = 'First letter of the item code + expiry date (ddmmyyyy). Type your own code to replace it.';
    fill(d); }
  document.addEventListener('input', e => { const d = e.target.closest && e.target.closest(DLG); if (!d) return; const p = parts(d);
    if (e.target === p.code) { p.code.dataset.manual = p.code.value.trim() ? '1' : ''; if (!p.code.value.trim()) fill(d); } else if (e.target === p.exp) fill(d); }, true);
  document.addEventListener('change', e => { const d = e.target.closest && e.target.closest(DLG); if (!d) return; setTimeout(() => fill(d), 0); /* the expiry may be suggested from the production date */ }, true);
  new MutationObserver(() => document.querySelectorAll(DLG).forEach(prep)).observe(document.body, { childList: true });
  window.batchCodeOf = codeOf;
})();
