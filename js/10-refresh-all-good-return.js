/* ---------- Refresh All: reload SharePoint lists and recalculate with the loaded files ---------- */
$('wFefoRefreshAllBtn').addEventListener('click', async () => {
  const btn = $('wFefoRefreshAllBtn'); if (btn.disabled) return;
  if (!getGlobalAccessToken() || !getGlobalSiteUrl()) { wFefo_setStatus('Global Site URL and Token are not configured.', 'error'); return; }
  btn.disabled = true; const done = [], failed = [];
  try {
    if (wUomState.listName && wUomState.source !== 'file') {
      wFefo_setStatus('🔄 Reloading the UOM list…', 'info');
      (await wUom_loadFromList()) ? done.push('UOM list') : failed.push('UOM list');
    } else if (wUomState.source === 'file') done.push('UOM file (kept as uploaded)');
    if (wFefoState.batchListName) {
      wFefo_setStatus('🔄 Reloading the batch list from SharePoint…', 'info');
      try { listsCache.clear(); await wFefo_loadBatchIndex(true); done.push('batch list'); } catch (e) { failed.push('batch list: ' + e.message); }
    } else failed.push('batch list not selected');
    if (wGR.lines.length) { wGR_refresh(); done.push('Good Return file'); }
    if (warehouseState.parsedRows.length) done.push(`order file (${warehouseState.parsedRows.length} rows)`);
    if (wFefoState.batchIndex) { try { wLoc_renderPicker(); if ($('wLocCard').style.display === 'block') wLoc_render(); } catch (e) {} }
    if (!failed.length && wFefoState.results.length && warehouseState.parsedRows.length) { wFefo_setStatus('🔄 Re-running the FEFO lookup with fresh stock…', 'info'); $('wFefoLookupBtn').click(); await new Promise(r => setTimeout(r, 50)); while ($('wFefoLookupBtn').disabled) await new Promise(r => setTimeout(r, 200)); }
    const msg = `${failed.length ? '⚠' : '✅'} Refreshed at ${new Date().toLocaleTimeString()}: ${done.join(', ') || 'nothing'}${failed.length ? ' · Failed: ' + failed.join('; ') : ''}${wFefoState.results.length && !failed.length ? ' · results recalculated' : ''}.`;
    if (!(wFefoState.results.length && !failed.length)) wFefo_setStatus(msg, failed.length ? 'warn' : 'success');
    else { const st = $('wFefoStatus') || document.querySelector('.status-msg'); wFefo_setStatus(msg + ' ' + ($('wFefoSummary') ? $('wFefoSummary').textContent : ''), 'success'); }
    w_logToActivity('FEFO Refresh All: ' + msg);
  } finally { btn.disabled = false; }
});

/* ---------- Near-expiry highlight ---------- */
function wExp_limit() { const v = parseInt((document.querySelector('#wExpDays') || {}).value, 10); return v > 0 ? v : 90; }
function wExp_days(d) { if (!d) return null; const t = new Date(d); if (isNaN(t.getTime())) return null; const n = new Date(); return Math.ceil((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000); }
function wExp_flag(d) { const n = wExp_days(d); if (n === null || n >= wExp_limit()) return null; return { days: n, expired: n < 0, label: n < 0 ? `EXPIRED ${-n}d ago` : `${n} d left` }; }
(function () {
  const st = document.createElement('style');
  st.textContent = `td.exp-near{background:#fff1d6 !important;color:#9a3412;font-weight:700;} td.exp-expired{background:#fecaca !important;color:#991b1b;font-weight:700;} tr.exp-row-near td:first-child{box-shadow:inset 4px 0 0 #f59e0b;} .exp-tag{display:inline-block;margin-left:6px;padding:0 6px;border-radius:8px;font-size:11px;background:#f59e0b;color:#fff;font-weight:700;} .exp-tag.exp{background:#dc2626;}
    @media print{td.exp-near{background:#ffe3b0 !important;} td.exp-expired{background:#fbb !important;}}`;
  document.head.appendChild(st);
  document.addEventListener('change', e => { if (e.target && e.target.id === 'wExpDays') { try { wFefo_renderResults(); } catch (x) {} try { if ($('wPickCard').style.display !== 'none') wPick_render(); } catch (x) {} } });
})();

/* ---------- Good Return (daily returned stock, deducted from demand) ---------- */
const wGR = { lines: [], fileName: '' };
function wGR_active() { const cb = document.querySelector('#wGROn'); return !!(wGR.lines.length && cb && cb.checked); }
function wGR_map() {   // sku(lower) → { sku, pcs, desc }
  const m = new Map(), conv = wUom_active();
  for (const l of wGR.lines) {
    let fac = 1;
    if (conv) { const canon = wUomCanon(l.uom); fac = canon === 'pc' || !canon ? 1 : wUom_factor(l.sku, l.uom); }
    else if (wUomCanon(l.uom) !== 'pc' && l.uom) { fac = wUom_factor(l.sku, l.uom) ?? 1; }
    if (fac == null) { fac = 1; l.noFactor = true; }
    const k = String(l.sku).trim().toLowerCase(); const e = m.get(k) || { sku: l.sku, pcs: 0, desc: l.desc };
    e.pcs = wUomRound(e.pcs + l.qty * fac); m.set(k, e);
  }
  return m;
}
function wGR_apply(requests) {
  if (!wGR_active()) return { requests, deducted: 0, skus: 0, covered: 0, pool: null };
  const pool = new Map(Array.from(wGR_map(), ([k, v]) => [k, v.pcs])); let deducted = 0, covered = 0; const skus = new Set(); const out = [];
  for (const r of requests) {
    const k = String(r.sku || '').trim().toLowerCase(), have = pool.get(k) || 0, take = Math.min(have, r.qty || 0);
    if (take > 0) {
      pool.set(k, wUomRound(have - take)); deducted += take; skus.add(k);
      const nr = { ...r, qty: wUomRound(r.qty - take), grPcs: take, origQty: r.qty, origDisplay: (r.origDisplay ? r.origDisplay + ' ' : '') + `− ${u_formatNumber(take)} Good Return` };
      if (nr.qty <= 0.000001) { covered++; continue; }
      out.push(nr);
    } else out.push(r);
  }
  return { requests: out, deducted: wUomRound(deducted), skus: skus.size, covered, pool };
}
function wGR_parse(rows) {
  if (!rows.length) throw new Error('The file is empty.');
  const keys = Object.keys(rows[0]), find = rx => keys.find(k => rx.test(String(k).trim()));
  const kSku = find(/^(item|sku|item[ _]?code|sku[ _]?code|material)$/i) || find(/sku|item/i), kQty = find(/^(quantity|qty)$/i) || find(/qty|quant/i), kUom = find(/^uom$|^unit/i), kDesc = find(/desc/i);
  if (!kSku || !kQty) throw new Error('Could not find the Item (SKU) and Quantity columns. Columns found: ' + keys.join(', '));
  const lines = []; for (const r of rows) { const sku = String(r[kSku] ?? '').trim(), q = u_toNumber(r[kQty]); if (!sku || q === null || q <= 0) continue; lines.push({ sku, qty: q, uom: kUom ? String(r[kUom] ?? '').trim() || 'PC' : 'PC', desc: kDesc ? String(r[kDesc] ?? '') : '' }); }
  if (!lines.length) throw new Error('No rows with an Item and a Quantity were found.');
  return lines;
}
function wGR_refresh() {
  const el = $('wGRStatus'); if (!el) return;
  if (!wGR.lines.length) { el.textContent = ''; return; }
  const m = wGR_map(), tot = Array.from(m.values()).reduce((t, e) => t + e.pcs, 0);
  el.textContent = `${wGR.fileName}: ${wGR.lines.length} line(s), ${m.size} SKU(s), ${u_formatNumber(wUomRound(tot))} Pcs${wGR.lines.some(l => l.noFactor) ? ' ⚠ some units had no UOM factor (treated as Pcs)' : ''}.`;
}
$('wGRPickBtn').addEventListener('click', () => $('wGRInput').click());
$('wGRInput').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
    wGR.lines = wGR_parse(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true })); wGR.fileName = f.name;
    try { await wUom_ensureLoaded(); } catch (x) {}
    wGR_refresh(); try { wGRB.edits.clear(); wGRB.uploadedAt = null; if ($('wGRBCard').style.display !== 'none') wGRB_render(); } catch (x2) {} addActivity('upload', `Good Return file ${f.name}: ${wGR.lines.length} lines`);
    wFefo_setStatus('Good Return loaded — it will be deducted from the demand when you run Lookup Batch (FEFO).', 'success');
    if ($('wLocCard').style.display === 'block') wLoc_render();
  } catch (x) { $('wGRStatus').textContent = '✘ ' + x.message; }
});
$('wGROn').addEventListener('change', () => { if ($('wLocCard').style.display === 'block') wLoc_render(); try { if ($('wGRBCard').style.display !== 'none') wGRB_render(); } catch (x) {} });
$('wGRClearBtn').addEventListener('click', () => { wGR.lines = []; wGR.fileName = ''; wGR_refresh(); if ($('wLocCard').style.display === 'block') wLoc_render(); try { wGRB.edits.clear(); wGRB.uploadedAt = null; $('wGRBCard').style.display = 'none'; } catch (x) {} });

/* ---------- Good Return balance: what is left of the returns after the demand was covered — review, adjust, upload ---------- */
const wGRB = { q: { global: [], cols: {} }, edits: new Map(), showAll: false, rows: [], uploadedAt: null, upCols: [], upMap: {}, upSiteId: null, upListId: null, picker: null };
(function () { const st = document.createElement('style'); st.textContent = '#wGRBCard.grb-full{position:fixed;inset:0;z-index:99990;margin:0 !important;border-radius:0;overflow:auto;background:var(--card) !important;} #wGRBCard.grb-full .table-wrap{max-height:none !important;} #wGRBTable input.grb-adj{width:110px;margin:0;padding:3px 6px;text-align:right;} #wGRBTable input.grb-note{width:100%;min-width:160px;margin:0;padding:3px 6px;} #wGRBTable tr.grb-edited td{background:rgba(250,204,21,.16);} #wGRBTable .te-filters .mcombo{min-width:110px;} #wGRBTable .te-filters .mc-input{font-size:12px;}'; document.head.appendChild(st); })();
function wGRB_compute() {
  if (!wGR.lines.length) return null;
  const m = wGR_map(); let pool = null;
  try { const built = wFefo_buildRequests(); pool = wGR_apply(built.requests).pool; } catch (e) { pool = null; }
  return Array.from(m, ([k, e]) => {
    const gr = wUomRound(e.pcs), bal = pool && pool.has(k) ? wUomRound(pool.get(k)) : gr, ed = wGRB.edits.get(k) || {};
    return { k, sku: e.sku, desc: e.desc || wUom_desc(e.sku) || '', gr, used: wUomRound(gr - bal), bal, adj: ed.adj !== undefined ? ed.adj : bal, note: ed.note || '', inc: ed.inc !== undefined ? ed.inc : true };
  }).sort((a, b) => String(a.sku).localeCompare(String(b.sku), undefined, { numeric: true }));
}
const GRB_COLS = [['inc', 'Upload'], ['sku', 'SKU'], ['desc', 'Description'], ['gr', 'Good Return (Pcs)'], ['used', 'Used in demand (Pcs)'], ['bal', 'Balance (Pcs)'], ['adj', 'Adjusted Qty (Pcs)'], ['diff', 'Difference'], ['note', 'Reason / Remarks']];
const GRB_EXACT = new Set(['inc', 'gr', 'used', 'bal', 'adj', 'diff']);
function grbVal(r, c) { return c === 'inc' ? (r.inc ? 'Yes' : 'No') : c === 'diff' ? u_formatNumber(wUomRound(r.adj - r.bal)) : (c === 'sku' || c === 'desc' || c === 'note') ? String(r[c] ?? '') : u_formatNumber(r[c]); }
function wGRB_match(r) {
  const g = wGRB.q.global.map(v => v.toLowerCase());
  if (g.length) { const txt = GRB_COLS.map(([c]) => grbVal(r, c).toLowerCase()); if (!g.some(v => txt.some(t => t.includes(v)))) return false; }
  for (const [c, vals] of Object.entries(wGRB.q.cols)) {
    if (!vals || !vals.length) continue; const t = grbVal(r, c).toLowerCase();
    if (!vals.some(v => { v = String(v).toLowerCase(); return GRB_EXACT.has(c) ? t === v : t.includes(v); })) return false;
  }
  return true;
}
const wGRB_base = () => (wGRB.rows || []).filter(r => wGRB.showAll || r.bal > 0 || r.adj > 0);
const wGRB_visible = () => wGRB_base().filter(wGRB_match);
function wGRB_table() {
  wGRB.rows = wGRB_compute() || [];
  const vis = wGRB_visible(), data = vis.map(r => [r.sku, r.desc, r.gr, r.used, r.bal, r.adj, wUomRound(r.adj - r.bal), r.note]);
  const sum = i => wUomRound(data.reduce((t, r) => t + (Number(r[i]) || 0), 0));
  return { headers: ['SKU', 'Description', 'Good Return (Pcs)', 'Used in demand (Pcs)', 'Balance (Pcs)', 'Adjusted Qty (Pcs)', 'Difference', 'Reason / Remarks'], data, totals: ['TOTAL', '', sum(2), sum(3), sum(4), sum(5), sum(6), ''], rows: vis,
    note: `${data.length} SKU(s) · Good Return file: ${wGR.fileName || '—'} · balance ${u_formatNumber(sum(4))} Pcs · adjusted ${u_formatNumber(sum(5))} Pcs` };
}
function wGRB_totals() {
  const vis = wGRB_visible(), sum = f => wUomRound(vis.reduce((t, r) => t + f(r), 0)), tr = document.querySelector('#wGRBTotRow'); if (!tr) return;
  const set = (c, v) => { const el = tr.querySelector('.' + c); if (el) el.textContent = u_formatNumber(v); };
  set('t-gr', sum(r => r.gr)); set('t-used', sum(r => r.used)); set('t-bal', sum(r => r.bal)); set('t-adj', sum(r => r.adj)); set('t-diff', sum(r => r.adj - r.bal));
  const inc = vis.filter(r => r.inc && r.adj > 0); const info = document.querySelector('#wGRBInfo'); if (info) info.dataset.up = `${inc.length} SKU(s) / ${u_formatNumber(wUomRound(inc.reduce((t, r) => t + r.adj, 0)))} Pcs ticked for upload.`;
  wGRB_info();
}
function wGRB_info() {
  const info = document.querySelector('#wGRBInfo'); if (!info) return;
  const all = wGRB.rows, vis = wGRB_visible(), edited = all.filter(r => Math.abs(r.adj - r.bal) > 1e-9).length;
  let t = `${vis.length} SKU(s) shown of ${all.length} returned. Used = deducted from the demand; Balance = what is left. Change "Adjusted Qty" (and add a reason) where the physical stock differs, untick SKUs you do not want to upload.`;
  if (!$('wGROn').checked) t += ' ⚠ "Deduct from demand" is off — nothing was used.';
  else if (!warehouseState.parsedRows.length) t += ' ⚠ No order file loaded — the whole return is balance.';
  if (edited) t += ` ✏ ${edited} SKU(s) adjusted.`;
  if (wGRB.uploadedAt) t += ` ✅ Uploaded at ${wGRB.uploadedAt}.`;
  info.textContent = t + (info.dataset.up ? ' ' + info.dataset.up : '');
}
function wGRB_body() {
  const body = $('wGRBBody'), vis = wGRB_visible(), f = u_formatNumber, tot = wGRB_base().length;
  body.innerHTML = vis.map(r => `<tr data-k="${escapeHtml(r.k)}" class="${Math.abs(r.adj - r.bal) > 1e-9 ? 'grb-edited' : ''}" title="Double-click to open this SKU in its own card"><td style="text-align:center;"><input type="checkbox" class="grb-inc" ${r.inc ? 'checked' : ''} /></td><td>${escapeHtml(r.sku)}</td><td>${escapeHtml(r.desc)}</td><td class="fefo-num">${f(r.gr)}</td><td class="fefo-num">${f(r.used)}</td><td class="fefo-num"><strong>${f(r.bal)}</strong></td><td><input type="number" class="grb-adj" min="0" step="any" value="${r.adj}" /></td><td class="fefo-num grb-diff">${f(wUomRound(r.adj - r.bal))}</td><td><input type="text" class="grb-note" value="${escapeHtml(r.note)}" placeholder="optional" /></td></tr>`).join('') +
    (vis.length ? '<tr id="wGRBTotRow" class="rn-skip" style="font-weight:700;background:var(--gray-100);"><td></td><td>TOTAL</td><td></td><td class="fefo-num t-gr"></td><td class="fefo-num t-used"></td><td class="fefo-num t-bal"></td><td class="fefo-num t-adj" style="text-align:right;"></td><td class="fefo-num t-diff"></td><td></td></tr>' : `<tr class="rn-skip"><td colspan="9" style="text-align:center;color:var(--gray-400);padding:14px;">${tot ? 'No SKU matches the filters.' : 'Nothing left over — the demand used the whole Good Return stock. Tick "Show fully-used SKUs" to list them anyway.'}</td></tr>`);
  $('wGRBCount').textContent = `${vis.length} of ${tot} SKU(s) shown`;
  wGRB_totals();
}
function wGRB_render() {
  const all = wGRB_compute(); const head = $('wGRBHead'), body = $('wGRBBody');
  if (!all) { $('wGRBInfo').textContent = 'Upload the Good Return file first.'; head.innerHTML = ''; body.innerHTML = ''; return; }
  wGRB.rows = all; const base = wGRB_base();
  head.innerHTML = '<tr>' + GRB_COLS.map(([, h]) => `<th>${h}</th>`).join('') + '</tr>';
  const fr = document.createElement('tr'); fr.className = 'te-filters'; const hh = Math.max(34, Math.round(head.rows[0].getBoundingClientRect().height) || 34);
  GRB_COLS.forEach(([c]) => {
    const th = document.createElement('th'); th.style.cssText = `top:${hh}px;padding:3px 4px;font-weight:400;background:var(--gray-50);`;
    const seen = new Set(); base.forEach(r => { const v = grbVal(r, c); if (v !== '' && seen.size < 800) seen.add(v); });
    const opts = Array.from(seen).sort((x, y) => x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' }));
    th.appendChild(buildMultiCombo((wGRB.q.cols[c] || []).slice(), opts, arr => { wGRB.q.cols[c] = arr; wGRB_body(); }, { placeholder: 'Filter…' })); fr.appendChild(th);
  });
  head.appendChild(fr);
  const gs = new Set(); base.forEach(r => GRB_COLS.forEach(([c]) => { if (c === 'inc') return; const v = grbVal(r, c); if (v !== '' && v.length <= 60 && gs.size < 3000) gs.add(v); }));
  const host = $('wGRBSearch'); host.innerHTML = '';
  host.appendChild(buildMultiCombo(wGRB.q.global.slice(), Array.from(gs).sort((x, y) => x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' })), arr => { wGRB.q.global = arr; wGRB_body(); }, { placeholder: 'Search all fields… pick one or more values (Enter to add typed text)' }));
  wGRB_body();
}
$('wGRBClearFilters').addEventListener('click', () => { wGRB.q = { global: [], cols: {} }; wGRB_render(); });

/* double-click a SKU → its own card to review / adjust */
(function () {
  const st = document.createElement('style');
  st.textContent = '#wGRBItem{display:none;position:fixed;inset:0;z-index:100004;background:rgba(0,0,0,.5);align-items:center;justify-content:center;padding:20px;} #wGRBItem .gi-card{background:var(--card);color:inherit;border-radius:12px;max-width:620px;width:100%;max-height:92vh;overflow:auto;padding:18px 20px;box-shadow:0 20px 50px rgba(0,0,0,.35);} #wGRBItem .gi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0;} #wGRBItem .gi-box{background:var(--gray-50);border:1px solid var(--border);border-radius:8px;padding:8px 10px;} #wGRBItem .gi-box small{display:block;color:var(--gray-500);font-weight:600;} #wGRBItem .gi-box b{font-size:18px;}';
  document.head.appendChild(st);
  const m = document.createElement('div'); m.id = 'wGRBItem';
  m.innerHTML = '<div class="gi-card"><div style="display:flex;align-items:center;gap:8px;"><strong id="giTitle" style="flex:1;font-size:15px;"></strong><button class="ghost small" id="giPrev" type="button">◀</button><button class="ghost small" id="giNext" type="button">▶</button><button class="ghost small" id="giClose" type="button">✖</button></div><div id="giSub" class="text-sm" style="color:var(--gray-500);margin-top:2px;"></div><div class="gi-grid"><div class="gi-box"><small>Good Return (Pcs)</small><b id="giGr"></b></div><div class="gi-box"><small>Used in demand (Pcs)</small><b id="giUsed"></b></div><div class="gi-box"><small>Balance (Pcs)</small><b id="giBal"></b></div><div class="gi-box"><small>Difference (Adjusted − Balance)</small><b id="giDiff"></b></div></div><div class="form-group"><label>Adjusted Qty (Pcs) <span class="hint">— the quantity that will be uploaded</span></label><div class="btn-row"><input type="number" id="giAdj" min="0" step="any" style="max-width:180px;margin:0;" /><button class="ghost small" id="giToBal" type="button">= Balance</button><button class="ghost small" id="giToZero" type="button">0</button></div></div><div class="form-group"><label>Reason / Remarks</label><textarea id="giNote" rows="2"></textarea></div><label style="display:inline-flex;align-items:center;gap:6px;"><input type="checkbox" id="giInc" /> Include this SKU in the upload</label><div id="giMsg" class="text-sm" style="min-height:18px;margin-top:6px;"></div><div class="btn-row" style="margin-top:8px;"><button class="success" id="giApply" type="button">✔ Apply</button><button class="secondary" id="giApplyNext" type="button">Apply & next ▶</button><button class="ghost" id="giCancel" type="button">Cancel</button></div></div>';
  document.body.appendChild(m);
  let list = [], idx = 0;
  const cur = () => list[idx], f = u_formatNumber;
  function fill() {
    const r = cur(); if (!r) return;
    $('giTitle').textContent = `${r.sku} — ${idx + 1} of ${list.length}`; $('giSub').textContent = r.desc || '';
    $('giGr').textContent = f(r.gr); $('giUsed').textContent = f(r.used); $('giBal').textContent = f(r.bal);
    $('giAdj').value = r.adj; $('giNote').value = r.note; $('giInc').checked = r.inc; $('giMsg').textContent = ''; diff();
    $('giPrev').style.visibility = idx > 0 ? '' : 'hidden'; $('giNext').style.visibility = idx < list.length - 1 ? '' : 'hidden'; $('giApplyNext').style.display = idx < list.length - 1 ? '' : 'none';
  }
  function diff() { const r = cur(), v = u_toNumber($('giAdj').value); $('giDiff').textContent = v === null ? '—' : f(wUomRound(v - r.bal)); $('giDiff').style.color = v !== null && Math.abs(v - r.bal) > 1e-9 ? '#b45309' : ''; }
  function commit() {
    const r = cur(), v = u_toNumber($('giAdj').value);
    if (v === null || v < 0) { $('giMsg').style.color = '#dc2626'; $('giMsg').textContent = '⚠ Enter a quantity of 0 or more.'; return false; }
    r.adj = v; r.note = $('giNote').value; r.inc = $('giInc').checked; wGRB.edits.set(r.k, { adj: v, note: r.note, inc: r.inc }); return true;
  }
  const close = () => { m.style.display = 'none'; wGRB_body(); };
  function go(d) { if (!commit()) return; idx = Math.max(0, Math.min(list.length - 1, idx + d)); fill(); }
  window.wGRB_itemOpen = k => { list = wGRB_visible(); idx = Math.max(0, list.findIndex(r => r.k === k)); if (!list.length) return; m.style.display = 'flex'; fill(); setTimeout(() => { try { $('giAdj').focus(); $('giAdj').select(); } catch (e) {} }, 30); };
  $('giAdj').addEventListener('input', diff);
  $('giToBal').addEventListener('click', () => { $('giAdj').value = cur().bal; diff(); });
  $('giToZero').addEventListener('click', () => { $('giAdj').value = 0; diff(); });
  $('giPrev').addEventListener('click', () => go(-1)); $('giNext').addEventListener('click', () => go(1));
  $('giApply').addEventListener('click', () => { if (commit()) close(); });
  $('giApplyNext').addEventListener('click', () => go(1));
  $('giCancel').addEventListener('click', () => { m.style.display = 'none'; }); $('giClose').addEventListener('click', () => { m.style.display = 'none'; });
  m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
  document.addEventListener('keydown', e => { if (m.style.display === 'flex') { if (e.key === 'Escape') { e.stopPropagation(); m.style.display = 'none'; } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); $('giApply').click(); } } }, true);
  $('wGRBBody').addEventListener('dblclick', e => { if (e.target.closest('input,button,select,textarea,label')) return; const tr = e.target.closest('tr[data-k]'); if (tr) window.wGRB_itemOpen(tr.dataset.k); });
})();
function wGRB_afterRun() {
  if (!wGR.lines.length) { $('wGRBCard').style.display = 'none'; return; }
  wGRB.uploadedAt = null; $('wGRBCard').style.display = 'block'; wGRB_render();
  $('wGRBCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
$('wFefoGRBalBtn').addEventListener('click', () => {
  if (!wGR.lines.length) { wFefo_setStatus('Upload the Good Return file first (↩ Good Return stock).', 'warn'); return; }
  $('wGRBCard').style.display = 'block'; wGRB_render(); $('wGRBCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('wGRBCloseBtn').addEventListener('click', () => { $('wGRBCard').style.display = 'none'; $('wGRBCard').classList.remove('grb-full'); });
$('wGRBFullBtn').addEventListener('click', () => { const c = $('wGRBCard'); c.classList.toggle('grb-full'); $('wGRBFullBtn').textContent = c.classList.contains('grb-full') ? '⤡ Restore' : '⤢ Full screen'; });
$('wGRBAll').addEventListener('change', e => { wGRB.showAll = e.target.checked; wGRB_render(); });
$('wGRBResetBtn').addEventListener('click', () => { wGRB.edits.clear(); wGRB_render(); });
$('wGRBBody').addEventListener('input', e => {
  const tr = e.target.closest('tr[data-k]'); if (!tr) return; const r = wGRB.rows.find(x => x.k === tr.dataset.k); if (!r) return; const ed = wGRB.edits.get(r.k) || {};
  if (e.target.classList.contains('grb-adj')) { const v = u_toNumber(e.target.value); if (v === null || v < 0) return; r.adj = v; ed.adj = v; tr.querySelector('.grb-diff').textContent = u_formatNumber(wUomRound(v - r.bal)); tr.classList.toggle('grb-edited', Math.abs(v - r.bal) > 1e-9); }
  else if (e.target.classList.contains('grb-note')) { r.note = e.target.value; ed.note = e.target.value; }
  else return;
  wGRB.edits.set(r.k, ed); wGRB_totals();
});
$('wGRBBody').addEventListener('change', e => {
  if (!e.target.classList.contains('grb-inc')) return; const tr = e.target.closest('tr[data-k]'); const r = tr && wGRB.rows.find(x => x.k === tr.dataset.k); if (!r) return;
  r.inc = e.target.checked; const ed = wGRB.edits.get(r.k) || {}; ed.inc = r.inc; wGRB.edits.set(r.k, ed); wGRB_totals();
});
$('wGRBExcelBtn').addEventListener('click', () => {
  const t = wGRB_table(); if (!t.data.length) return;
  const stamp = new Date().toISOString().slice(0, 10), ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.data, t.totals]);
  ws['!cols'] = t.headers.map(h => ({ wch: h === 'Description' ? 38 : Math.max(14, String(h).length + 2) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Good Return Balance'); XLSX.writeFile(wb, `Good_Return_Balance_${stamp}.xlsx`);
});
$('wGRBPrintBtn').addEventListener('click', () => { const t = wGRB_table(); if (!t.data.length) return; wGRB.docNo = w_printTable('Good Return Balance', t.note, t.headers, t.data, t.totals, 'GR'); sectionToast(`Good Return ${wGRB.docNo} opened in a new tab — the number is uploaded with the rows (map “Document_No” in Upload Destinations).`, 'success'); });
$('wGRBEmailBtn').addEventListener('click', () => { const t = wGRB_table(); if (!t.data.length) { wGRB_info(); return; } wMail_open('grb'); });

/* upload to a SharePoint list */
function wGRB_upFields() {
  return [
    { key: 'sku', label: 'SKU', alias: ['sku', 'skucode', 'itemcode', 'item', 'material'] },
    { key: 'desc', label: 'Description', alias: ['itemdescription', 'description', 'desc'] },
    { key: 'gr', label: 'Good Return Qty (Pcs)', alias: ['goodreturnqty', 'goodreturnpcs', 'goodreturn', 'returnqty'] },
    { key: 'used', label: 'Used in demand (Pcs)', alias: ['usedqty', 'usedpcs', 'used', 'deducted'] },
    { key: 'bal', label: 'Balance Qty (Pcs)', alias: ['balanceqty', 'balancepcs', 'balance'] },
    { key: 'adj', label: 'Adjusted Qty (Pcs) — final', alias: ['adjustedqty', 'adjustedpcs', 'adjusted', 'finalqty', 'qty', 'quantity', 'pcs'] },
    { key: 'diff', label: 'Adjustment (Adjusted − Balance)', alias: ['adjustment', 'difference', 'variance'] },
    { key: 'note', label: 'Reason / Remarks', alias: ['reason', 'remarks', 'remark', 'note', 'comment'] },
    { key: 'date', label: 'Date', alias: ['returndate', 'date', 'uploaddate'] },
    { key: 'file', label: 'Source file', alias: ['sourcefile', 'filename', 'file'] },
    { key: 'docNo', doc: true, label: 'Document_No (printed Good Return no.)', alias: ['Document_No', 'Document No', 'DocNo', 'Print No', 'GR No', 'Good Return No', 'Reference'] },
    currentUserOutputField()
  ];
}
function wGRB_upRender() {
  const body = $('wGRBUpMapBody'); body.innerHTML = '';
  if (!wGRB.upCols.length) { body.innerHTML = '<tr><td colspan="2" style="padding:16px;text-align:center;color:var(--gray-400);font-style:italic;">Pick a list and click 🔄 Load Columns to map fields.</td></tr>'; $('wGRBUpConfirmBtn').disabled = true; return; }
  wGRB_upFields().forEach(field => {
    const tr = document.createElement('tr'); tr.innerHTML = `<td><strong>${escapeHtml(field.label)}</strong></td><td class="combo-cell"></td>`;
    tr.querySelector('.combo-cell').appendChild(buildCombo(wGRB.upMap[field.key] || SKIP_VALUE, wGRB.upCols, nv => { wGRB.upMap[field.key] = nv; wGRB_upState(); }));
    body.appendChild(tr);
  });
  wGRB_upState();
}
function wGRB_upState() { $('wGRBUpConfirmBtn').disabled = !Object.values(wGRB.upMap).some(v => v && v !== SKIP_VALUE) || !wGRB.upListId; }
$('wGRBUploadBtn').addEventListener('click', () => {
  if (!wGR.lines.length) return;
  $('wGRBUpPanel').style.display = 'block';
  if (!wGRB.picker) wGRB.picker = createListPicker(document.querySelector('[data-list-picker="w-grb-upload"]'), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: () => { wGRB.upCols = []; wGRB.upMap = {}; wGRB.upListId = null; wGRB_upRender(); } });
  $('wGRBUpPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('wGRBUpClose').addEventListener('click', () => { $('wGRBUpPanel').style.display = 'none'; });
$('wGRBUpLoadBtn').addEventListener('click', async () => {
  const listName = wGRB.picker ? wGRB.picker.getValue() : '', token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(), st = $('wGRBUpColsStatus');
  if (!listName || !token || !siteUrl) { st.textContent = '⚠ Pick a list and configure the global settings.'; return; }
  if (!isListVisible(listName)) { st.textContent = `✘ No permission to access "${listName}"`; return; }
  if (!isListEditable(listName)) { st.textContent = `✘ READ-ONLY access to "${listName}" — upload blocked`; return; }
  st.textContent = 'Loading...';
  try {
    const { siteId, listId } = await resolveIds(siteUrl, listName, token); wGRB.upSiteId = siteId; wGRB.upListId = listId;
    const cols = await fetchColumns(siteId, listId, token); wGRB.upCols = cols.filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase()));
    st.textContent = `✓ ${wGRB.upCols.length} writable columns`; wGRB_upRender(); setTimeout(() => { try { $('wGRBUpAutoBtn').click(); } catch (e) {} }, 0);
  } catch (err) { st.textContent = '✘ ' + err.message; }
});
$('wGRBUpAutoBtn').addEventListener('click', () => {
  if (!wGRB.upCols.length) { $('wGRBUpColsStatus').textContent = '⚠ Load columns first.'; return; }
  const nz = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, ''), used = new Set(), map = {};
  wGRB_upFields().forEach(f => {
    if (f.key === CURRENT_USER_FIELD_KEY) return;
    let hit = null;
    for (const pass of [0, 1]) { for (const al of f.alias) { hit = wGRB.upCols.find(c => !used.has(c.name) && (pass === 0 ? (nz(c.name) === al || nz(c.displayName) === al) : (al.length >= 4 && (nz(c.name).includes(al) || nz(c.displayName).includes(al))))); if (hit) break; } if (hit) break; }
    if (hit) used.add(hit.name); map[f.key] = hit ? hit.name : SKIP_VALUE;
  });
  const uh = findCurrentUserColumn(wGRB.upCols); map[CURRENT_USER_FIELD_KEY] = uh ? uh.name : SKIP_VALUE;
  wGRB.upMap = map; wGRB_upRender();
});
$('wGRBUpResetBtn').addEventListener('click', () => { wGRB.upMap = {}; wGRB_upRender(); });
$('wGRBUpConfirmBtn').addEventListener('click', async () => {
  const st = $('wGRBUpStatus'); wGRB.rows = wGRB_compute() || [];
  const rows = wGRB_visible().filter(r => r.inc && r.adj > 0);
  if (!wGRB.upListId || !wGRB.upSiteId) { st.textContent = '⚠ Load columns first.'; return; }
  if (!rows.length) { st.textContent = '⚠ Nothing to upload — no ticked SKU has an Adjusted Qty above 0.'; return; }
  if (!hasPerm('uploader')) { alert('Permission denied.'); return; }
  const active = Object.entries(wGRB.upMap).filter(([, v]) => v && v !== SKIP_VALUE); if (!active.length) { st.textContent = '⚠ Map at least one field.'; return; }
  const listName = (utReady('grb') && utGet('grb').list) || (document.querySelector('[data-list-picker="w-grb-upload"] .list-picker-input') || {}).value || 'selected list', total = rows.length, sumQ = u_formatNumber(wUomRound(rows.reduce((t, r) => t + r.adj, 0)));
  spAsk.extra = spDocLine('Good Return', wGRB.docNo, (wGRB.upMap || {}).docNo);
  if (!(await spAsk(`Upload ${total} SKU(s) — ${sumQ} Pcs of Good Return balance — to "${listName}"?` + ((wGRB.q.global.length || Object.values(wGRB.q.cols).some(v => v && v.length)) ? '\n\nOnly the rows matching the current filters are uploaded.' : '') + (wGRB.uploadedAt ? `\n\n⚠ This balance was already uploaded at ${wGRB.uploadedAt}. Uploading again creates duplicate rows.` : '')))) return;
  const token = getGlobalAccessToken(), now = new Date().toISOString(), prog = $('wGRBUpProg');
  $('wGRBUpConfirmBtn').disabled = true; prog.style.display = 'block'; prog.max = total; prog.value = 0; let ok = 0, fail = 0; const errors = [];
  for (let i = 0; i < total; i++) {
    const r = rows[i], src = { sku: r.sku, desc: r.desc, gr: r.gr, used: r.used, bal: r.bal, adj: r.adj, diff: wUomRound(r.adj - r.bal), note: r.note, date: now, file: wGR.fileName, docNo: wGRB.docNo || '' }, fields = {};
    active.forEach(([k, target]) => { const v = k === CURRENT_USER_FIELD_KEY ? getCurrentUserValue() : src[k]; if (v !== null && v !== undefined && v !== '') fields[target] = v; });
    st.textContent = `Uploading ${i + 1} / ${total} · ✔ ${ok} · ✘ ${fail}`;
    if (!Object.keys(fields).length) { fail++; prog.value = i + 1; continue; }
    try { await createItem(wGRB.upSiteId, wGRB.upListId, fields, token); ok++; } catch (err) { fail++; errors.push(`${r.sku}: ${err.message}`); }
    prog.value = i + 1;
  }
  $('wGRBUpConfirmBtn').disabled = false;
  if (ok) wGRB.uploadedAt = new Date().toLocaleString();
  st.textContent = fail ? `⚠ ${ok} uploaded, ${fail} failed. ${errors.slice(0, 2).join(' | ')}` : `✅ Uploaded ${ok} SKU(s) to "${listName}".`;
  w_logToActivity(`Good Return balance → "${listName}": ${ok} ok, ${fail} failed`); wGRB_info();
  if (fail) notifyFailure('Good Return Upload Failure', `${fail} failure(s) uploading to "${listName}".\n\n${errors.slice(0, 5).join('\n')}`);
});


/* ---------- Location filter + stock-by-location ---------- */
function wLoc_label(l) { const t = String(l == null ? '' : l).trim(); return t || '(no location)'; }
function wLoc_save() { try { localStorage.setItem(LS_BASE + '_wfefo_locSel', JSON.stringify(wFefoState.locSel)); } catch (e) {} }
function wLoc_restore() { try { const v = JSON.parse(localStorage.getItem(LS_BASE + '_wfefo_locSel') || '[]'); if (Array.isArray(v)) wFefoState.locSel = v.map(String); } catch (e) {} }
function wLoc_renderPicker() {
  const host = document.querySelector('#wFefoLocHost'); if (!host) return;
  host.innerHTML = '';
  host.appendChild(buildMultiCombo(wFefoState.locSel, wLoc_opts(), arr => {
    wFefoState.locSel = arr; wLoc_save(); wLoc_status();
    const c = document.querySelector('#wLocCard');
    if (c && c.style.display === 'block') { try { wLoc_render(); } catch (e) {} }
  }, { placeholder: wFefoState.locOptions.length ? 'All locations — type or pick to restrict' : 'Click "Load Locations" to list the locations' }));
  wLoc_status();
}
function wLoc_status() {
  const el = document.querySelector('#wFefoLocStatus'); if (!el) return;
  const n = wFefoState.locOptions.length;
  el.textContent = wFefoState.locSel.length ? `Restricted to ${wFefoState.locSel.length} location(s) — re-run Lookup to apply.` : (n ? `${n} location(s) available — all used.` : '');
}
function wLoc_model() {
  const idx = wFefoState.batchIndex; if (!idx) return null;
  const cols = wFefoState.locSel.length ? wLoc_expand(wFefoState.locSel) : wFefoState.locOptions.slice();
  const colSet = new Set(cols);
  let demand = null;
  if (warehouseState.parsedRows.length && wFefoState.fileMapping.sku && wFefoState.fileMapping.qty) {
    try {
      demand = new Map();
      for (const r of wFefo_buildRequests().requests) {
        const k = String(r.sku || '').trim().toLowerCase();
        const prev = demand.get(k);
        demand.set(k, { sku: r.sku, qty: (prev ? prev.qty : 0) + (r.qty || 0) });
      }
    } catch (e) { demand = null; }
  }
  const grMap = wGR_active() ? wGR_map() : null;
  const keys = demand ? Array.from(demand.keys()) : Array.from(idx.keys()).sort();
  const rows = keys.map(k => {
    const per = new Map(); let tot = 0;
    for (const b of (idx.get(k) || [])) { const l = wLoc_label(b.locationCode); if (!colSet.has(l)) continue; per.set(l, (per.get(l) || 0) + b.qty); tot += b.qty; }
    const sku = demand ? String(demand.get(k).sku || k) : k;
    const gross = demand ? demand.get(k).qty : null, grAvail = grMap ? (grMap.get(k) || { pcs: 0 }).pcs : 0;
    const gr = gross != null ? Math.min(gross, grAvail) : 0, dem = gross != null ? wUomRound(gross - gr) : null;
    let status = '';
    if (dem != null) status = dem <= 0.000001 ? 'COVERED BY RETURN' : tot <= 0 ? 'NO STOCK' : (tot + 1e-6 >= dem ? 'OK' : 'SHORT');
    return { sku, desc: wUom_desc(sku) || (grMap && grMap.get(k) ? grMap.get(k).desc : ''), gross, gr, dem, per, tot, status };
  });
  return { cols, rows, hasDemand: !!demand, hasGR: !!(demand && grMap) };
}
function wLoc_head(m) { return ['SKU', 'Description'].concat(m.hasDemand ? (m.hasGR ? ['Order Demand (Pcs)', 'Good Return Pcs', 'Net Demand (Pcs)'] : ['Demand (Pcs)']) : [], m.cols, ['Total'], m.hasDemand ? ['Status'] : []); }
function wLoc_arr(m, r) { return [r.sku, r.desc || '', ...(m.hasDemand ? (m.hasGR ? [r.gross, r.gr, r.dem] : [r.dem]) : []), ...m.cols.map(c => r.per.get(c) || 0), r.tot, ...(m.hasDemand ? [r.status] : [])]; }
function wLoc_render() {
  const m = wLoc_model(); const host = $('wLocTableHost'); const info = $('wLocInfo');
  if (!m) { info.textContent = 'Load the batch index first (Load Locations or Lookup).'; host.innerHTML = ''; return; }
  const f = v => (v == null ? '' : u_formatNumber(v));
  const shown = m.rows.slice(0, 1500);
  info.textContent = (m.hasDemand ? 'Demand from the loaded order file vs. stock in ' : 'No order file loaded — showing stock for every SKU in ') + (wFefoState.locSel.length ? 'the selected location(s).' : 'all locations.') + (m.rows.length > shown.length ? ` Showing first ${shown.length} of ${m.rows.length} (export for all).` : '');
  let h = '<table class="data-table"><thead><tr>' + wLoc_head(m).map(c => `<th>${escapeHtml(c)}</th>`).join('') + '</tr></thead><tbody>';
  for (const r of shown) {
    const color = r.status === 'OK' ? '#16a34a' : '#dc2626';
    h += `<tr><td>${escapeHtml(r.sku)}</td><td>${escapeHtml(r.desc || '')}</td>` + (m.hasDemand ? (m.hasGR ? `<td>${f(r.gross)}</td><td style="color:#7c3aed;">${r.gr ? '−' + f(r.gr) : '0'}</td><td><strong>${f(r.dem)}</strong></td>` : `<td>${f(r.dem)}</td>`) : '') + m.cols.map(c => { const v = r.per.get(c); return `<td style="${v ? '' : 'color:#9ca3af;'}">${v ? f(v) : '0'}</td>`; }).join('') + `<td><strong>${f(r.tot)}</strong></td>` + (m.hasDemand ? `<td style="font-weight:600;color:${color};">${r.status}</td>` : '') + '</tr>';
  }
  host.innerHTML = h + '</tbody></table>';
}
async function wLoc_load(force) {
  const b = $('wFefoLocLoadBtn'); b.disabled = true; $('wFefoLocStatus').textContent = 'Loading batch list…';
  try { await wUom_ensureLoaded(); await wFefo_loadBatchIndex(!!force); wLoc_renderPicker(); }
  catch (e) { $('wFefoLocStatus').textContent = '✘ ' + e.message; }
  finally { b.disabled = false; }
}
$('wFefoLocLoadBtn').addEventListener('click', () => wLoc_load(true));
$('wFefoLocStockBtn').addEventListener('click', async () => {
  if (!wFefoState.batchIndex) await wLoc_load(false);
  if (!wFefoState.batchIndex) return;
  $('wLocCard').style.display = 'block'; wLoc_render(); $('wLocCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('wLocCloseBtn').addEventListener('click', () => { $('wLocCard').style.display = 'none'; });
$('wLocExcelBtn').addEventListener('click', () => {
  const m = wLoc_model(); if (!m) return;
  const aoa = [wLoc_head(m)].concat(m.rows.map(r => wLoc_arr(m, r)));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Stock by Location');
  XLSX.writeFile(wb, `Stock_by_Location_${new Date().toISOString().slice(0, 10)}.xlsx`);
});
/* moved to 99-boot.js */ /* moved to 99-boot.js */

function wFefo_allocateCore(requests) {
  const idx = wFefoState.batchIndex;
  const results = [];
  const stats = { ok: 0, insufficient: 0, nobatch: 0, totalRows: 0 };

  for (const req of requests) {
    const skuRaw = req.sku;
    const uomRaw = req.uom;

    if (skuRaw == null || skuRaw === '') {
      results.push({
        ...req,
        batchCode: '', locationCode: '',prodDate: null, expiryDate: null,
        qtyAllocated: 0, qtyRemaining: req.qty,
        status: 'INSUFFICIENT', statusKey: 'insufficient',
        statusNote: 'Missing SKU in file',
        isFirstOfSplit: true, isSplit: false, splitIndex: 1, splitTotal: 1,
      });
      stats.insufficient++; stats.totalRows++;
      continue;
    }

    const key = String(skuRaw).trim().toLowerCase();
    const allBuckets = idx.get(key);
    const locSet = wFefoState.locSel && wFefoState.locSel.length ? new Set(wLoc_expand(wFefoState.locSel)) : null;
    const buckets = (allBuckets && locSet) ? allBuckets.filter(b => locSet.has(wLoc_label(b.locationCode))) : allBuckets;

    if (!buckets || !buckets.length) {
      results.push({
        ...req,
        batchCode: '', locationCode: '',prodDate: null, expiryDate: null,
        qtyAllocated: 0, qtyRemaining: req.qty,
        status: 'NO BATCH', statusKey: 'nobatch',
        statusNote: allBuckets && allBuckets.length ? 'No stock in selected location(s): ' + wFefoState.locSel.join(', ') : 'No matching SKU in batch list',
        isFirstOfSplit: true, isSplit: false, splitIndex: 1, splitTotal: 1,
      });
      stats.nobatch++; stats.totalRows++;
      continue;
    }

     let needed = req.qty;
    const allocations = [];
    for (const b of buckets) {
      if (needed <= 0) break;
      const take = Math.min(needed, b.qty);
      if (take <= 0) continue;
      allocations.push({
        batchCode: b.batchCode,
        locationCode: b.locationCode || '',
        prodDate: b.prodDate,
        expiryDate: b.expiryDate,
        qtyAllocated: take,
        batchAvailable: b.qty,
      });
      needed -= take;
    }

    if (!allocations.length) {
      results.push({
        ...req,
        batchCode: '', locationCode: '',prodDate: null, expiryDate: null,
        qtyAllocated: 0, qtyRemaining: req.qty,
        status: 'INSUFFICIENT', statusKey: 'insufficient',
        statusNote: 'Batches exist but have zero available balance',
        isFirstOfSplit: true, isSplit: false, splitIndex: 1, splitTotal: 1,
      });
      stats.insufficient++; stats.totalRows++;
      continue;
    }

    const fullyCovered = needed <= 0.000001;
    const status = fullyCovered ? 'OK' : 'INSUFFICIENT';
    const statusKey = fullyCovered ? 'ok' : 'insufficient';

    allocations.forEach((a, i) => {
      results.push({
        ...req,
        isFirstOfSplit: i === 0,
        isSplit: allocations.length > 1,
        splitIndex: i + 1,
        splitTotal: allocations.length,
        batchCode: a.batchCode,
        prodDate: a.prodDate,
        expiryDate: a.expiryDate,
        qtyAllocated: a.qtyAllocated,
        batchAvailable: a.batchAvailable,
        qtyRemaining: fullyCovered ? 0 : needed,
        status, statusKey,
        statusNote: fullyCovered ? '' : `Short by ${u_formatNumber(needed)}`,
      });
      stats.totalRows++;
    });

    if (fullyCovered) stats.ok++; else stats.insufficient++;
  }

  return { results, stats };
}


