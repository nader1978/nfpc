/* ---------- Render mapping tables ---------- */
function wFefoMap_makeSelect(options, currentValue, onChange) {
  const wrap = document.createElement('div');
  const sel = document.createElement('select');
  sel.style.cssText = 'width:100%;padding:5px 8px;font-size:12px;border:1px solid var(--gray-300);border-radius:4px;background:var(--card);color:var(--gray-800);';
  const optNone = document.createElement('option');
  optNone.value = '';
  optNone.textContent = '— Not mapped —';
  sel.appendChild(optNone);
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === currentValue) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', (e) => onChange(e.target.value));
  wrap.appendChild(sel);
  return wrap;
}

/* Generic renderer for one role table inside a given <tbody> */
function wFefoMap_renderRoleTable(tbodyId, roles, options, currentValues, onChange, emptyMsg) {
  const body = $(tbodyId);
  if (!body) return;
  body.innerHTML = '';
  if (!options.length) {
    body.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--gray-400);font-style:italic;padding:14px;">${escapeHtml(emptyMsg || 'No columns available.')}</td></tr>`;
    return;
  }
  roles.forEach(role => {
    const tr = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.innerHTML = escapeHtml(role.label)
      + (role.required ? ' <span class="map-required">*</span>' : '')
      + (role.note ? ` <span class="text-sm" style="font-weight:400;">(${escapeHtml(role.note)})</span>` : '');
    const cell = document.createElement('td');
    const sel = wFefoMap_makeSelect(options, currentValues[role.key] || '', (val) => {
      currentValues[role.key] = val;
      onChange();
    });
    cell.appendChild(sel);
    tr.appendChild(labelCell);
    tr.appendChild(cell);
    body.appendChild(tr);
  });
}

function wFefoMap_render() {
  const fileOptions = warehouseState.parsedHeaders.map(h => ({ value: h, label: h }));
  const batchOptions = wFefoState.batchColumns.map(c => ({ value: c.name, label: `${c.displayName} (${c.name})` }));

  const fileEmpty = warehouseState.parsedHeaders.length ? '' : 'Load an order file to map columns.';
  const batchEmpty = wFefoState.batchColumns.length ? '' : 'Pick a batch list to load its columns.';

  const onFileChange = () => { wFefoMap_printDiag(); wFefoMap_updateLookupGate(); };
  const onBatchChange = () => { wFefoMap_printDiag(); wFefoMap_updateLookupGate(); };

  /* File side — Match Keys */
  wFefoMap_renderRoleTable(
    'wFefoMapFileBody',
    FEFO_MAP_FILE_MATCH_ROLES,
    fileOptions,
    wFefoState.fileMapping,
    onFileChange,
    fileEmpty
  );

  /* File side — Value (Qty) */
  wFefoMap_renderRoleTable(
    'wFefoMapFileQtyBody',
    FEFO_MAP_FILE_VALUE_ROLES,
    fileOptions,
    wFefoState.fileMapping,
    onFileChange,
    fileEmpty
  );

  /* Batch side — Match Keys */
  wFefoMap_renderRoleTable(
    'wFefoMapBatchBody',
    FEFO_MAP_BATCH_MATCH_ROLES,
    batchOptions,
    wFefoState.batchMapping,
    onBatchChange,
    batchEmpty
  );

  /* Batch side — Data Fields */
  wFefoMap_renderRoleTable(
    'wFefoMapBatchDataBody',
    FEFO_MAP_BATCH_DATA_ROLES,
    batchOptions,
    wFefoState.batchMapping,
    onBatchChange,
    batchEmpty
  );

  wFefoMap_printDiag();
}

/* ---------- Button handlers ---------- */
$('wFefoMapLoadBatchBtn').addEventListener('click', async () => {
  try { await wFefoMap_loadBatchColumns(true); } catch (e) { wFefoMap_setStatus('✘ ' + e.message, 'error'); }
});
$('wFefoMapAutoBtn').addEventListener('click', () => {
  wFefoMap_autoDetect();
  wFefoMap_setStatus('Auto-detected', '');
});
$('wFefoMapSaveBtn').addEventListener('click', () => {
  const { ready, missing } = wFefoMap_validate();
  if (!ready) {
    wFefoMap_setStatus('⚠ Cannot save — missing: ' + missing.join(', '), 'incomplete');
    return;
  }
  wFefoMap_saveToStorage();
  wFefoMap_setStatus('✓ Saved for "' + wFefoState.batchListName + '"', 'ready');
  w_logToActivity(`Warehouse: saved FEFO mapping for "${wFefoState.batchListName}"`);
});
$('wFefoMapResetBtn').addEventListener('click', () => {
  wFefoState.batchMapping = { sku: '', uom: '', qty: '', batchCode: '', locationCode: '', prodDate: '', expiryDate: '' };
  if (wFefoState.batchColumns.length) {
    const auto = wFefoMap_detectBatch(wFefoState.batchColumns);
    wFefoState.batchMapping = { ...auto };
  }
  try { localStorage.removeItem(wFefoMap_keyForList(wFefoState.batchListName)); } catch (e) {}
  wFefoMap_render();
  wFefoMap_updateLookupGate();
  wFefoMap_setStatus('Reset to auto-detect', '');
});
/* ============================================================
   FEFO — Batch Index Review (read-only inspector)
   ============================================================ */
const wFefoReviewState = {
  open: false,
  search: '',
  onlyMulti: false,
  keys: [],   // rebuilt on open from wFefoState.batchIndex
};

function wFefoReview_open() {
  if (!wFefoState.batchIndex) {
    alert('Load the batch index first — click "🔍 Lookup Batch (FEFO)" once, then come back.');
    return;
  }
  // Rebuild the review list from the live index every time
  const keys = [];
  for (const [key, arr] of wFefoState.batchIndex.entries()) {
    const parts = key.split('|');
    const sku = parts[0] || '';
    const uom = parts[1] || '';
    let totalQty = 0;
    arr.forEach(b => { totalQty += Number(b.qty) || 0; });
    keys.push({
      key, sku, uom,
      batches: arr.slice(),   // already FEFO-sorted by the indexer
      totalQty,
    });
  }
  keys.sort((a, b) => a.sku.localeCompare(b.sku) || a.uom.localeCompare(b.uom));
  wFefoReviewState.keys = keys;
  wFefoReviewState.search = '';
  wFefoReviewState.onlyMulti = false;

  $('wFefoReviewListName').textContent = wFefoState.batchListName || '(unknown)';
  $('wFefoReviewSearch').value = '';
  $('wFefoReviewOnlyMulti').checked = false;

  wFefoReview_render();
  $('wFefoReviewModal').style.display = 'flex';
  wFefoReviewState.open = true;
  setTimeout(() => $('wFefoReviewSearch').focus(), 50);
}

function wFefoReview_close() {
  $('wFefoReviewModal').style.display = 'none';
  wFefoReviewState.open = false;
}

function wFefoReview_render() {
  const host = $('wFefoReviewBody');
  const summaryEl = $('wFefoReviewSummary');
  const q = (wFefoReviewState.search || '').trim().toLowerCase();
  const onlyMulti = wFefoReviewState.onlyMulti;

  let keys = wFefoReviewState.keys.slice();
  if (onlyMulti) keys = keys.filter(k => k.batches.length >= 2);
  if (q) {
    keys = keys.filter(k =>
      k.sku.toLowerCase().includes(q) ||
      k.uom.toLowerCase().includes(q) ||
      k.batches.some(b => String(b.batchCode).toLowerCase().includes(q))
    );
  }

  const totalKeys = wFefoReviewState.keys.length;
  const totalBatches = wFefoReviewState.keys.reduce((a, k) => a + k.batches.length, 0);
  const multiKeys = wFefoReviewState.keys.filter(k => k.batches.length >= 2).length;
  const noExpiry = wFefoReviewState.keys.reduce(
    (a, k) => a + k.batches.filter(b => !b.expiryDate || !isFinite(b._expMs)).length, 0);
  summaryEl.textContent = `${totalKeys} SKU keys · ${totalBatches} batches · ${multiKeys} with 2+ batches · ${noExpiry} missing expiry`;

  if (!keys.length) {
    host.innerHTML = '<div class="fefo-review-empty">No keys match the current filter.</div>';
    return;
  }

  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toISOString().slice(0, 10);
  };
  const fmtNum = (n) => (n == null || isNaN(n)) ? '' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 6 });

  const parts = [];
  keys.forEach(k => {
    const multiBadge = k.batches.length >= 2
      ? `<span class="badge-count">${k.batches.length} batches</span>`
      : `<span class="badge-count" style="background:var(--gray-500);">1 batch</span>`;
    parts.push(`<div class="fefo-review-key">
      <span>${escapeHtml(k.sku)} · ${escapeHtml(k.uom)} ${multiBadge}</span>
      <span class="meta">Total available: <strong>${fmtNum(k.totalQty)}</strong></span>
    </div>`);
    parts.push(`<table class="fefo-review-table">
      <thead><tr>
        <th style="width:40px;">#</th>
        <th>Batch Code</th>
        <th>Prod Date</th>
        <th>Expiry Date</th>
        <th style="text-align:right;">Qty</th>
        <th style="width:150px;">FEFO Rank</th>
      </tr></thead>
      <tbody>`);
    k.batches.forEach((b, i) => {
      const noExp = !b.expiryDate || !isFinite(b._expMs);
      const noQty = !isFinite(Number(b.qty)) || Number(b.qty) <= 0;
      const cls = noQty ? 'no-qty' : (noExp ? 'no-expiry' : (i === 0 ? 'pick-first' : ''));
      const rank = noQty
        ? 'SKIPPED (bad qty)'
        : (noExp ? '— (no expiry → last)' : (i === 0 ? '← first pick' : `#${i + 1}`));
      parts.push(`<tr class="${cls}">
        <td>${i + 1}</td>
        <td>${escapeHtml(String(b.batchCode || '—'))}</td>
        <td>${escapeHtml(fmtDate(b.prodDate))}</td>
        <td>${escapeHtml(fmtDate(b.expiryDate))}</td>
        <td class="num">${escapeHtml(fmtNum(b.qty))}</td>
        <td>${escapeHtml(rank)}</td>
      </tr>`);
    });
    parts.push(`</tbody></table>`);
  });

  host.innerHTML = parts.join('');
}

/* Wire modal controls */
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'wFefoReviewSearch') {
    wFefoReviewState.search = e.target.value || '';
    wFefoReview_render();
  }
});
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'wFefoReviewOnlyMulti') {
    wFefoReviewState.onlyMulti = e.target.checked;
    wFefoReview_render();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && wFefoReviewState.open) wFefoReview_close();
});
document.addEventListener('click', (e) => {
  if (!e.target) return;
  if (e.target.id === 'wFefoReviewCloseBtn') wFefoReview_close();
  if (e.target.id === 'wFefoReviewModal' && e.target === e.currentTarget) wFefoReview_close();
});
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('wFefoReviewBtn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', wFefoReview_open);
  }
});
/* This script runs after the HTML, so also wire immediately */
(function wireReviewBtn() {
  const btn = document.getElementById('wFefoReviewBtn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', wFefoReview_open);
  }
})();


/* ============================================================
   WAREHOUSE — FEFO Lookup Engine
   Uses wFefoState.fileMapping and wFefoState.batchMapping
   ============================================================ */
function wFefo_setStatus(msg, type = 'info') {
  const el = $('wFefoStatus');
  if (!msg) { el.className = 'status-msg'; el.textContent = ''; return; }
  el.className = 'status-msg ' + type;
  el.textContent = msg;
}
function wFefo_setSummary(msg) { $('wFefoSummary').textContent = msg || ''; }

async function wFefo_loadBatchIndex(force = false) {
  const token = getGlobalAccessToken();
  const siteUrl = getGlobalSiteUrl();
  if (!token || !siteUrl) throw new Error('Global Site URL and Token are not configured.');
  if (!wFefoState.batchListName) throw new Error('Pick the batch list first.');

  const { ready, missing } = wFefoMap_validate();
  if (!ready) throw new Error('Mapping incomplete: ' + missing.join(', '));

  if (!force && wFefoState.batchIndex && wFefoState.batchIndexSig === wUom_sig() && Date.now() - wFefoState.batchLoadedAt < LISTS_CACHE_TTL) {
    return wFefoState.batchIndex;
  }

  const SKU_COL = wFefoState.batchMapping.sku;
  const UOM_COL = wFefoState.batchMapping.uom;
  const QTY_COL = wFefoState.batchMapping.qty;
  const BATCH_COL = wFefoState.batchMapping.batchCode;
  const LOC_COL = wFefoState.batchMapping.locationCode;
  const PROD_COL = wFefoState.batchMapping.prodDate;
  const EXP_COL = wFefoState.batchMapping.expiryDate;
  const UOM_ON = wUom_active(); let skippedNoFactor = 0;

  wFefoProgress.start('Resolving batch list...', 0);
  const { siteId, listId } = await resolveIds(siteUrl, wFefoState.batchListName, token);
  wFefoProgress.update(0, 0, `Fetching items from "${wFefoState.batchListName}"...`);

  const items = await fetchAllItems(siteId, listId, token, (n) => {
    wFefoProgress.update(n, 0, `${n.toLocaleString()} batch rows fetched`);
  });

  wFefoProgress.update(items.length, items.length, `Indexing ${items.length.toLocaleString()} batches...`);

  const idx = new Map();
  let skipped = 0;
  let skippedNoSku = 0, skippedNoUom = 0, skippedNoBatch = 0, skippedNoQty = 0;
  const sampleSkipped = [];
  for (const it of items) {
    const f = it.fields || {};
    const sku  = f[SKU_COL];
    const uom  = f[UOM_COL];
    const rawQty = f[QTY_COL];
    const qty = Number(rawQty);
    const bc   = f[BATCH_COL];
    const loc  = LOC_COL ? f[LOC_COL] : null;
    const prod = PROD_COL ? f[PROD_COL] : null;
    const exp  = EXP_COL ? f[EXP_COL] : null;

    let reason = '';
    if (!sku) { reason = 'no sku'; skippedNoSku++; }
    else if (UOM_ON && !uom) { reason = 'no uom'; skippedNoUom++; }
    else if (!bc) { reason = 'no batch code'; skippedNoBatch++; }
    else if (!isFinite(qty) || qty <= 0) { reason = `bad qty (${JSON.stringify(rawQty)})`; skippedNoQty++; }

    if (reason) {
      skipped++;
      if (sampleSkipped.length < 5) sampleSkipped.push(`[${reason}] SKU="${sku}" UOM="${uom}" Batch="${bc}" Qty="${rawQty}"`);
      continue;
    }

    let key = String(sku).trim().toLowerCase(), effQty = qty;
    if (UOM_ON) {
      const fac = wUom_factor(sku, uom);
      if (fac == null) { skipped++; skippedNoFactor++; if (sampleSkipped.length < 5) sampleSkipped.push(`[no UOM factor] SKU="${sku}" UOM="${uom}"`); continue; }
      effQty = qty * fac;
    }
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push({
      batchCode: String(bc),
      locationCode: loc ? String(loc).trim() : '',
      prodDate: prod || null,
      expiryDate: exp || null,
      qty: effQty,
      _expMs: exp ? new Date(exp).getTime() : Number.POSITIVE_INFINITY,
    });
  }

  for (const list of idx.values()) {
    list.sort((a, b) => {
      if (a._expMs !== b._expMs) return a._expMs - b._expMs;
      const byBatch = a.batchCode.localeCompare(b.batchCode);
      if (byBatch !== 0) return byBatch;
      return (a.locationCode || '').localeCompare(b.locationCode || '');
    });
  }

  const locTotals = new Map();
  for (const arr of idx.values()) for (const b of arr) { const l = wLoc_label(b.locationCode); locTotals.set(l, (locTotals.get(l) || 0) + b.qty); }
  wFefoState.locTotals = locTotals;
  wFefoState.locOptions = Array.from(locTotals.keys()).sort((a, b) => a.localeCompare(b));
  try { wLoc_renderPicker(); } catch (e) {}
  wFefoState.batchIndex = idx;
  wFefoState.batchLoadedAt = Date.now();
  wFefoState.batchIndexSig = wUom_sig();

  /* Build diagnostic line */
  const diagParts = [`${items.length} rows read`, `${idx.size} unique SKU`, `${skipped} skipped`];
  if (skipped) {
    const detail = [];
    if (skippedNoSku) detail.push(`${skippedNoSku} no SKU`);
    if (skippedNoUom) detail.push(`${skippedNoUom} no UOM`);
    if (skippedNoBatch) detail.push(`${skippedNoBatch} no Batch_Code`);
    if (skippedNoQty) detail.push(`${skippedNoQty} bad Qty`);
    if (skippedNoFactor) detail.push(`${skippedNoFactor} no UOM factor`);
    diagParts.push('(' + detail.join(', ') + ')');
  }
  const diagLine = diagParts.join(' · ');
  wFefoProgress.finish(`✅ Indexed: ${diagLine}`);
  wFefo_setStatus(`Indexed ${diagLine}${sampleSkipped.length ? ' — samples: ' + sampleSkipped.join(' | ') : ''}`, idx.size ? (skipped ? 'warn' : 'success') : 'error');
  w_logToActivity(`FEFO index (${wFefoState.batchListName}): ${diagLine}`);
  return idx;
}

/* ============================================================
   UOM conversion (→ Pcs) + consolidated picking list
   ============================================================ */
const wUomState = { rows: [], headers: [], fileName: '', layout: 'wide', palletMode: 'pcs', map: { sku: '', carton: '', pallet: '', uom: '', text: '', factor: '', desc: '' }, table: new Map(), version: 0, source: '', listName: '', labels: {}, loadedAt: 0 };
/* UOM codes AND descriptions are normalised to one canonical code: PC (piece), CT (carton), OT (outer), BT (bottle), PLT (pallet), CRATE */
const WUOM_CANON = {
  pc: 'pc', pcs: 'pc', piece: 'pc', pieces: 'pc', ea: 'pc', each: 'pc', unit: 'pc', units: 'pc', base: 'pc',
  ct: 'ct', ctn: 'ct', carton: 'ct', cartons: 'ct', cs: 'ct', case: 'ct', cases: 'ct',
  ot: 'ot', outer: 'ot', outers: 'ot', 'outer case': 'ot',
  bt: 'bt', btl: 'bt', bottle: 'bt', bottles: 'bt',
  plt: 'plt', pallet: 'plt', pallets: 'plt', pal: 'plt', pl: 'plt',
  crate: 'crate', crates: 'crate',
};
const wUomNorm = v => String(v ?? '').trim().toLowerCase();
const wUomCanon = v => { const u = wUomNorm(v).replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim(); return WUOM_CANON[u] || u; };
const wUomRound = n => Math.round(n * 1e6) / 1e6;
function wUomCartonPref() { const el = $('wUomCartonPref'); return (el && el.value ? el.value : 'ct,ot').split(','); }
function wUom_active() { const cb = $('wUomEnable'); return !!(cb && cb.checked && wUomState.table.size); }
function wUom_sig() { return (wUom_active() ? '1:' : '0:') + wUomState.version; }
function wUom_units(sku) { const e = wUomState.table.get(wUomNorm(sku)); return { carton: e && e.carton || null, pallet: e && e.pallet || null, cartonUom: e && e.cartonUom || '' }; }
function wUom_desc(sku) { const e = wUomState.table.get(wUomNorm(sku)); return e && e.desc || ''; }
function wUom_has(sku) { const e = wUomState.table.get(wUomNorm(sku)); return e ? `[has: ${Array.from(e.factors.keys()).map(k => k.toUpperCase()).join(', ') || 'no factors'}]` : '[SKU not in UOM table]'; }
function wUom_factor(sku, uom) {
  const u = wUomCanon(uom); if (!u) return null;
  const e = wUomState.table.get(wUomNorm(sku));
  if (e && e.factors.has(u)) return e.factors.get(u);
  return u === 'pc' ? 1 : null;
}
function wUom_setStatus(msg, type = 'info') { const el = $('wUomStatus'); el.className = msg ? 'status-msg ' + type : 'status-msg'; el.textContent = msg || ''; }
function wUom_detect(headers) {
  const n = h => String(h).toLowerCase().replace(/[_\-./]+/g, ' ').replace(/\s+/g, ' ').trim();
  const names = h => [n(h), n(wUomState.labels[h] || h)];
  const exact = list => { for (const a of list) { const h = headers.find(h => names(h).includes(a)); if (h) return h; } return ''; };
  const like = test => headers.find(h => names(h).some(test)) || '';
  const m = {
    sku: exact(['oracle code', 'sku', 'sku code', 'item code', 'itemcode', 'item number', '2nd item number', 'material', 'article', 'product code', 'item', 'title']),
    carton: like(x => /(carton|ctn|case)/.test(x) && !/(pallet|plt)/.test(x)),
    pallet: like(x => /(pallet|plt)/.test(x)),
    uom: exact(['uom desc', 'uom description', 'uom code', 'uom', 'unit of measure', 'alt uom', 'alternate uom', 'alt unit', 'unit']),
    text: exact(['uom text', 'uom name', 'uom label', 'uom short', 'uom symbol', 'uom abbreviation', 'text']),
    desc: exact(['item desc', 'item description', 'description', 'product description', 'sku description', 'article description', 'desc']),
    factor: exact(['uom base nr', 'uom base number', 'uom base qty', 'base nr', 'base number', 'base qty', 'pcs per uom', 'conversion factor', 'factor', 'conversion', 'pcs', 'qty']),
  };
  wUomState.layout = ((m.uom || m.text) && m.factor && !m.carton && !m.pallet) ? 'long' : 'wide';
  wUomState.palletMode = (m.pallet && names(m.pallet).some(x => /(carton|ctn|case)/.test(x) && /per/.test(x))) ? 'cartons' : 'pcs';
  return m;
}
const wUomLabel = h => { const l = wUomState.labels[h]; return l && l !== h ? `${l} (${h})` : h; };
function wUom_mapKey() { return LS_BASE + '_wuom_map_' + wUomState.listName; }
function wUom_saveMap() { if (wUomState.source !== 'list' || !wUomState.listName) return; try { localStorage.setItem(wUom_mapKey(), JSON.stringify({ layout: wUomState.layout, palletMode: wUomState.palletMode, map: wUomState.map, cartonPref: $('wUomCartonPref').value })); } catch (e) {} }
function wUom_rebuild() {
  const m = wUomState.map, t = new Map(), long = wUomState.layout === 'long'; let dup = 0;
  const setF = (e, u, f) => { if (e.factors.has(u) && e.factors.get(u) !== f) dup++; e.factors.set(u, f); };
  for (const r of wUomState.rows) {
    const sku = wUomNorm(r[m.sku]); if (!sku) continue;
    let e = t.get(sku); if (!e) { e = { factors: new Map(), labels: new Map(), carton: null, pallet: null, cartonUom: '', desc: '' }; t.set(sku, e); }
    if (m.desc && !e.desc) { const dv = String(r[m.desc] ?? '').trim(); if (dv) e.desc = dv; }
    if (long) { const tx = m.text ? String(r[m.text] ?? '').trim() : '', u = wUomCanon(tx || r[m.uom]), f = u_toNumber(r[m.factor]); if (u && f > 0) { setF(e, u, f); if (tx) e.labels.set(u, tx); } }
    else {
      const c = m.carton ? u_toNumber(r[m.carton]) : null, p = m.pallet ? u_toNumber(r[m.pallet]) : null;
      if (c > 0) setF(e, 'ct', c);
      if (p > 0) { const v = wUomState.palletMode === 'cartons' ? (e.factors.get('ct') ? p * e.factors.get('ct') : null) : p; if (v) setF(e, 'plt', v); }
    }
  }
  const pref = wUomCartonPref(), cnt = { ct: 0, ot: 0, plt: 0 };
  for (const e of t.values()) {
    for (const u of pref) if (e.factors.has(u)) { e.carton = e.factors.get(u); e.cartonUom = u; break; }
    e.pallet = e.factors.get('plt') || null;
    ['ct', 'ot', 'plt'].forEach(k => { if (e.factors.has(k)) cnt[k]++; });
  }
  wUomState.table = t; wUomState.version++; try { uomRefreshTrips(); } catch (e) {}
  if (!m.sku) wUom_setStatus('⚠ Pick the SKU column.', 'warn');
  else wUom_setStatus(`✓ ${t.size.toLocaleString()} SKU(s) · CT: ${cnt.ct} · OT: ${cnt.ot} · PLT: ${cnt.plt}` + (dup ? ` · ⚠ ${dup} conflicting duplicate row(s) — last one used` : ''), t.size ? (dup ? 'warn' : 'success') : 'warn');
}
function wUom_renderMap() { ['#wUomMapBody', '#uomCfgMap'].forEach(s => { const b = document.querySelector(s); if (b) wUom_renderMapInto(b); }); }
function wUom_renderMapInto(body) {
  body.innerHTML = '';
  const addRow = (label, el) => { const tr = document.createElement('tr'); const td1 = document.createElement('td'); td1.textContent = label; const td2 = document.createElement('td'); td2.appendChild(el); tr.appendChild(td1); tr.appendChild(td2); body.appendChild(tr); };
  const mkSel = (opts, cur, onCh, blankLabel) => {
    const sel = document.createElement('select'); sel.style.margin = '0';
    sel.innerHTML = (blankLabel !== null ? `<option value="">${escapeHtml(blankLabel || '— none —')}</option>` : '') + opts.map(o => `<option value="${escapeHtml(o.v)}">${escapeHtml(o.l)}</option>`).join('');
    sel.value = cur; sel.addEventListener('change', () => onCh(sel.value)); return sel;
  };
  const cols = wUomState.headers.map(h => ({ v: h, l: wUomLabel(h) }));
  const again = () => { wUom_rebuild(); wUom_renderMap(); wUom_saveMap(); wFefoState.batchIndex = null; };
  addRow('Layout', mkSel([{ v: 'wide', l: 'One row per SKU (Pcs per Carton / Pallet columns)' }, { v: 'long', l: 'One row per SKU + UOM (UOM + Pcs-per-UOM factor)' }], wUomState.layout, v => { wUomState.layout = v; again(); }, null));
  addRow('SKU / Item Code *', mkSel(cols, wUomState.map.sku, v => { wUomState.map.sku = v; again(); }, '— pick —'));
  addRow('Item Description (optional)', mkSel(cols, wUomState.map.desc, v => { wUomState.map.desc = v; again(); }));
  if (wUomState.layout === 'wide') {
    addRow('Pcs per Carton', mkSel(cols, wUomState.map.carton, v => { wUomState.map.carton = v; again(); }));
    addRow('Pallet column', mkSel(cols, wUomState.map.pallet, v => { wUomState.map.pallet = v; again(); }));
    addRow('Pallet column means', mkSel([{ v: 'pcs', l: 'Pcs per Pallet' }, { v: 'cartons', l: 'Cartons per Pallet' }], wUomState.palletMode, v => { wUomState.palletMode = v; again(); }, null));
  } else {
    addRow('UoM text — shown in the dropdown *', mkSel(cols, wUomState.map.text, v => { wUomState.map.text = v; again(); }, '— pick —'));
    addRow('UoM code column (only if no text)', mkSel(cols, wUomState.map.uom, v => { wUomState.map.uom = v; again(); }, '— pick —'));
    addRow('Pcs per UOM (factor) *', mkSel(cols, wUomState.map.factor, v => { wUomState.map.factor = v; again(); }, '— pick —'));
  }
}
async function wUom_onList(val) {
  if (val === wUomState.listName) return;
  wUomState.listName = val; wUomState.table = new Map(); wUomState.version++; wUomState.source = val ? 'list' : ''; wUomState._ld = 0;
  try { localStorage.setItem(LS_BASE + '_wuom_list', val || ''); } catch (e) {}
  try { if (wUomState.picker && wUomState.picker.getValue() !== (val || '')) wUomState.picker.setValue(val || ''); } catch (e) {}
  if (val) await wUom_loadFromList();
}
/* Shared default for every user: paste the line copied from "⚖ UoM conversion list" here */
const UOM_CONV_DEFAULT = { list: '', layout: '', palletMode: '', map: {} };
async function wUom_handleFile(file) {
  if (!hasPerm('uploader')) { wUom_setStatus('Permission denied.', 'error'); return; }
  try {
    wUom_setStatus('Reading UOM file…', 'info');
    const rows = await parseFileToRows(file);
    if (!rows.length) { wUom_setStatus('No data rows found in the UOM file.', 'warn'); return; }
    wUomState.rows = rows; wUomState.headers = Object.keys(rows[0]); wUomState.fileName = file.name; wUomState.source = 'file'; wUomState.labels = {};
    wUomState.palletMode = 'pcs'; wUomState.map = wUom_detect(wUomState.headers);
    const sm = $('wUomSummary'); sm.style.display = 'block'; sm.textContent = `✓ Loaded "${file.name}" — ${rows.length.toLocaleString()} rows.`;
    $('wUomMapWrap').style.display = 'block';
    wUom_rebuild(); wUom_renderMap();
    wFefoState.batchIndex = null;   // force re-index with the new factors
    w_logToActivity(`UOM file loaded: "${file.name}" (${wUomState.table.size} SKUs)`);
  } catch (err) { wUom_setStatus('Failed to read UOM file: ' + err.message, 'error'); }
}
(function wUom_init() {
  const dz = $('wUomDropzone'), inp = $('wUomFileInput');
  dz.addEventListener('click', () => { if (hasPerm('uploader')) inp.click(); });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer.files.length) wUom_handleFile(e.dataTransfer.files[0]); });
  inp.addEventListener('change', e => { if (e.target.files.length) wUom_handleFile(e.target.files[0]); });
  $('wUomEnable').addEventListener('change', () => { wFefoState.batchIndex = null; });
  $('wUomCartonPref').addEventListener('change', () => { wUom_rebuild(); wUom_saveMap(); });
})();


