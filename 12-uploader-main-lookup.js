/* ---------- Main lookup ---------- */
$('wFefoLookupBtn').addEventListener('click', async () => {
  if (!warehouseState.parsedRows.length) { wFefo_setStatus('Load an order file first.', 'warn'); return; }
  if (!getGlobalAccessToken() || !getGlobalSiteUrl()) { wFefo_setStatus('Global Site URL and Token are not configured.', 'error'); return; }
  if (!wFefoState.batchListName) { wFefo_setStatus('Pick the batch list first.', 'warn'); return; }
  const { ready, missing } = wFefoMap_validate();
  if (!ready) { wFefo_setStatus('Mapping incomplete: ' + missing.join(', '), 'error'); return; }

  $('wFefoLookupBtn').disabled = true;
  wFefo_setStatus('Loading batch table...', 'info');
  wFefo_setSummary('');
  wFefoState.results = [];
  wFefoState.filteredResults = [];
  $('wPickCard').style.display = 'none';
  wFefo_renderResults();
  ['wFefoPrintBtn','wFefoPickBtn','wFefoExportExcelBtn','wFefoExportCsvBtn','wFefoUploadBtn'].forEach(id => { const el = $(id); if (el) el.disabled = true; });

  try {
    await wUom_ensureLoaded();
    await wFefo_loadBatchIndex(false);
    const idxSize = wFefoState.batchIndex ? wFefoState.batchIndex.size : 0;
    if (!idxSize) {
      wFefoProgress.error('Batch index is empty');
      wFefo_setStatus('Batch list returned 0 usable rows. Check the batch mapping — Qty must be numeric and > 0, and SKU/UOM/Batch_Code must not be empty.', 'error');
      return;
    }

    wFefo_setStatus('Building requests from file...', 'info');
    const built = wFefo_buildRequests(); const gr = wGR_apply(built.requests); const requests = gr.requests;
    if (gr.deducted) wFefo_setStatus(`↩ Good Return deducted: ${u_formatNumber(gr.deducted)} Pcs across ${gr.skus} SKU(s)${gr.covered ? `; ${gr.covered} request(s) fully covered by returns` : ''}.`, 'info');
    if (!requests.length) { try { wGRB_afterRun(); } catch (e) {} wFefo_setStatus(gr.covered ? `✅ The whole demand is covered by Good Return stock (${u_formatNumber(gr.deducted)} Pcs) — nothing to allocate.` : 'No requests to process.', gr.covered ? 'success' : 'warn'); return; }

    wFefo_setStatus(`Allocating ${requests.length.toLocaleString()} group(s) FEFO...`, 'info');
    wFefoProgress.start(`Allocating ${requests.length.toLocaleString()} groups...`, requests.length);

    const CHUNK = 500;
    let allResults = [];
    const agg = { ok: 0, insufficient: 0, nobatch: 0, totalRows: 0 };
    for (let i = 0; i < requests.length; i += CHUNK) {
      const slice = requests.slice(i, i + CHUNK);
      const { results, stats } = wFefo_allocate(slice);
      allResults = allResults.concat(results);
      agg.ok += stats.ok; agg.insufficient += stats.insufficient;
      agg.nobatch += stats.nobatch; agg.totalRows += stats.totalRows;
      wFefoProgress.update(Math.min(i + CHUNK, requests.length), requests.length,
        `${Math.min(i + CHUNK, requests.length)} / ${requests.length} groups`);
      await new Promise(r => setTimeout(r, 0));
    }

    allResults.forEach(r => { r.whsCode = rkWhs(r.locationCode); });
    wFefoState.results = allResults;
    wFefoState.resultsUomOn = wUom_active();
    wFefoFilter_render();
    wFefo_applySearchFilter();
    wFefo_renderResults();

    wFefoProgress.finish(`✅ Allocated ${agg.totalRows} row(s)`);
    wFefo_setStatus(
      `✅ Done. ${agg.ok} OK · ${agg.insufficient} insufficient · ${agg.nobatch} no batch. ` +
      `Batch index: ${idxSize} keys.${wUom_active() ? ' Quantities converted to Pcs.' : ''}`,
      agg.insufficient || agg.nobatch ? 'warn' : 'success'
    );
    wFefo_setSummary(`${agg.totalRows} output rows · ${agg.ok} fully allocated · ${agg.insufficient} short · ${agg.nobatch} no batch` + (gr.deducted ? ` · Good Return −${u_formatNumber(gr.deducted)} Pcs` : ''));

    ['wFefoPrintBtn','wFefoPickBtn','wFefoExportExcelBtn','wFefoExportCsvBtn','wFefoUploadBtn'].forEach(id => { const el = $(id); if (el) el.disabled = false; });
    wFefo_updateExportScopeNote();
    try { wGRB_afterRun(); } catch (e) {}
    w_logToActivity(`FEFO allocation: ${agg.totalRows} rows (${agg.ok} OK / ${agg.insufficient} short / ${agg.nobatch} no-batch)`);
  } catch (err) {
    wFefoProgress.error('✘ ' + err.message);
    wFefo_setStatus('✘ ' + err.message, 'error');
    w_logToActivity(`FEFO lookup failed: ${err.message}`);
  } finally {
    $('wFefoLookupBtn').disabled = false;
  }
});

/* ---------- Table data ---------- */
function wFefo_buildTableData() {
  const groupCols = warehouseState.groupByFields.map(f => f.column);
  const headers = [
    ...groupCols,
    'SKU', 'UOM', ...(wFefoState.resultsUomOn ? ['Ordered (Original UOM)'] : []), ...(wFefoState.results.some(r => r.grPcs) ? ['Good Return Pcs'] : []), 'Qty Requested',
    'Batch_Code', 'WHs_Code', 'Location_Code', 'Prod_Date', 'Expiry_Date',
    'Qty Allocated', 'Qty Remaining', 'Status',
  ];
  const fmtDate = (d) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? String(d) : dt.toISOString().slice(0, 10); };
  /* Respect the on-screen filter — exports & print match what the user sees. */
  const src = wFefo_getVisibleResults();
  const rows = src.map(r => [
    ...groupCols.map(c => r.groupValues[c] ?? ''),
    r.sku ?? '', r.uom ?? '', ...(wFefoState.resultsUomOn ? [r.origDisplay ?? ''] : []), ...(wFefoState.results.some(r2 => r2.grPcs) ? [r.grPcs ?? 0] : []), r.qty ?? '',
    r.batchCode ?? '', rkWhs(r.locationCode), r.locationCode ?? '', fmtDate(r.prodDate), fmtDate(r.expiryDate),
    r.qtyAllocated ?? '', r.qtyRemaining ?? 0, r.status ?? '',
  ]);
  return { headers, rows };
}

$('wFefoExportExcelBtn').addEventListener('click', () => {
    if (!wFefoState.results.length) return;
  const _visible = wFefo_getVisibleResults();
  if (!_visible.length) { wFefo_setStatus('No rows match the current filter.', 'warn'); return; }
  try {
    const { headers, rows } = wFefo_buildTableData();
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(12, Math.min(30, String(h).length + 4)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FEFO Allocation');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const suffix = wFefo_getFilterSummary() ? '_filtered' : '';
    XLSX.writeFile(wb, `FEFO_Allocation${suffix}_${ts}.xlsx`);

    wFefo_setStatus(`✅ Excel exported (${rows.length} rows).`, 'success');
    w_logToActivity(`FEFO Excel: ${rows.length} rows`);
  } catch (err) { wFefo_setStatus('Excel export failed: ' + err.message, 'error'); }
});

$('wFefoExportCsvBtn').addEventListener('click', () => {
  if (!wFefoState.results.length) return;
  try {
    const { headers, rows } = wFefo_buildTableData();
    const esc = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [headers, ...rows].map(r => r.map(esc).join(','));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;

    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const suffix = wFefo_getFilterSummary() ? '_filtered' : '';
    a.download = `FEFO_Allocation${suffix}_${ts}.csv`;

    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    wFefo_setStatus(`✅ CSV exported (${rows.length} rows).`, 'success');
    w_logToActivity(`FEFO CSV: ${rows.length} rows`);
  } catch (err) { wFefo_setStatus('CSV export failed: ' + err.message, 'error'); }
});

$('wFefoPrintBtn').addEventListener('click', () => {
  if (!wFefoState.results.length) return;
  const visibleRows = wFefo_getVisibleResults();
  if (!visibleRows.length) { wFefo_setStatus('No rows match the current filter.', 'warn'); return; }
  const { headers, rows } = wFefo_buildTableData(), fd = wFefo_getFilterSummary(), no = npDocNo('FEFO'); wFefoState.docNo = no;
  npOpenPrint(npTableDoc({ title: 'FEFO Batch Allocation Report', no, prefix: 'FEFO', sub: `Batch list ${wFefoState.batchListName || '—'} · ${rows.length} row(s)`, headers, rows, landscape: true, rowCls: visibleRows.map(r => r.statusKey === 'nobatch' ? '#fdd' : r.statusKey === 'insufficient' ? '#ffe9b8' : ''), meta: [['Batch list', wFefoState.batchListName || '—'], ['Rows', rows.length], ['Filter', fd || 'None']] }), 'FEFO allocation ' + no);
  wFefo_setStatus(`🖨 Report ${no} opened in a new tab — the number is uploaded with the rows (map “Document_No” when uploading).`, 'success'); w_logToActivity(`FEFO report ${no}`);
});

/* ---------- Upload to SharePoint ---------- */
let wFefoUploadPicker = null;

$('wFefoUploadBtn').addEventListener('click', () => {
    if (!wFefoState.results.length) return;
  const _visible = wFefo_getVisibleResults();
  if (!_visible.length) { wFefo_setStatus('No rows match the current filter.', 'warn'); return; }
  const panel = $('wFefoUploadPanel');
  panel.style.display = 'block';
  if (!wFefoUploadPicker) {
    wFefoUploadPicker = createListPicker(document.querySelector('[data-list-picker="w-fefo-upload"]'), {
      getSiteUrl: () => getGlobalSiteUrl(),
      getToken: () => getGlobalAccessToken(),
      onChange: () => { wFefoState.uploadColumns = []; wFefoState.uploadMapping = {}; wFefo_renderUploadMapping(); },
    });
  }
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

$('wFefoUploadPanelClose').addEventListener('click', () => {
  $('wFefoUploadPanel').style.display = 'none';
});

function wFefo_getOutputFields() {
  const groupCols = warehouseState.groupByFields.map(f => f.column);
  return [
    ...groupCols.map(c => ({ key: 'g:' + c, label: c, alias: c })),
    { key: 'sku', label: 'SKU', alias: 'SKU_Code' },
    { key: 'uom', label: 'UOM', alias: 'UOM_Base' },
    { key: 'qty', label: 'Qty Requested', alias: 'Qty_Requested' },
    { key: 'batchCode', label: 'Batch_Code', alias: 'Batch_Code' },
    { key: 'whsCode', label: 'WHs_Code', alias: 'WHs_Code' },
    { key: 'locationCode', label: 'Location_Code', alias: 'Location_Code' },
    { key: 'prodDate', label: 'Prod_Date', alias: 'Prod_Date' },
    { key: 'expiryDate', label: 'Expiry_Date', alias: 'Expiry_Date' },
    { key: 'qtyAllocated', label: 'Qty Allocated', alias: 'Qty_Allocated' },
    { key: 'qtyRemaining', label: 'Qty Remaining', alias: 'Qty_Remaining' },
    { key: 'status', label: 'Status', alias: 'Status' },
    { key: 'docNo', doc: true, label: 'Document_No (printed report / picking list no.)', alias: ['Document_No', 'Document No', 'DocNo', 'Picking List No', 'PL No', 'Print No', 'Reference'] },
    currentUserOutputField(),
  ];
}

function wFefo_renderUploadMapping() {
  const body = $('wFefoUploadMapBody');
  if (!body) return;
  body.innerHTML = '';
  const fields = wFefo_getOutputFields();
  if (!wFefoState.uploadColumns.length) {
    body.innerHTML = `<tr><td colspan="2" style="padding:16px;text-align:center;color:var(--gray-400);font-style:italic;">Pick a list and click 🔄 Load Columns to map fields.</td></tr>`;
    $('wFefoUploadConfirmBtn').disabled = true;
    return;
  }
  fields.forEach(field => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${escapeHtml(field.label)}</strong>${field.key.startsWith('g:') ? ' <span class="badge group">GROUP</span>' : ''}</td><td class="combo-cell"></td>`;
    const current = wFefoState.uploadMapping[field.key] || SKIP_VALUE;
    const combo = buildCombo(current, wFefoState.uploadColumns, (nv) => {
      wFefoState.uploadMapping[field.key] = nv;
      wFefo_updateUploadConfirmState();
    });
    tr.querySelector('.combo-cell').appendChild(combo);
    body.appendChild(tr);
  });
  wFefo_updateUploadConfirmState();
}

function wFefo_updateUploadConfirmState() {
  const mapped = Object.values(wFefoState.uploadMapping || {}).filter(v => v && v !== SKIP_VALUE).length;
  $('wFefoUploadConfirmBtn').disabled = mapped === 0 || !wFefoState.uploadListId;
}

$('wFefoUploadLoadColsBtn').addEventListener('click', async () => {
  const listName = wFefoUploadPicker?.getValue() || '';
  const token = getGlobalAccessToken();
  const siteUrl = getGlobalSiteUrl();
  if (!listName || !token || !siteUrl) { $('wFefoUploadColsStatus').textContent = '⚠ Pick a list and configure global settings.'; return; }
  if (!isListVisible(listName)) { $('wFefoUploadColsStatus').textContent = `✘ No permission to access "${listName}"`; return; }
  if (!isListEditable(listName)) { $('wFefoUploadColsStatus').textContent = `✘ READ-ONLY access to "${listName}" — upload blocked`; return; }
  $('wFefoUploadColsStatus').textContent = 'Loading...';
  try {
    const { siteId, listId } = await resolveIds(siteUrl, listName, token);
    wFefoState.uploadSiteId = siteId;
    wFefoState.uploadListId = listId;
    const cols = await fetchColumns(siteId, listId, token);
    wFefoState.uploadColumns = cols.filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase()));
    $('wFefoUploadColsStatus').textContent = `✓ ${wFefoState.uploadColumns.length} writable columns`;
    wFefo_renderUploadMapping();
    setTimeout(() => { try { $('wFefoUploadAutoMapBtn').click(); } catch (e) {} }, 0);
  } catch (err) {
    $('wFefoUploadColsStatus').textContent = '✘ ' + err.message;
  }
});

$('wFefoUploadAutoMapBtn').addEventListener('click', () => {
  if (!wFefoState.uploadColumns.length) { alert('Load columns first.'); return; }
  const fields = wFefo_getOutputFields();
  const cols = wFefoState.uploadColumns;
  const map = {};
  fields.forEach(f => {
    if (f.synthetic) return;   /* handled below */
    const aliases = [f.alias, f.label].filter(Boolean).map(s => String(s).toLowerCase().replace(/[\s_\-]+/g, ''));
    const hit = cols.find(c => {
      const a = normalize(c.name);
      const b = normalize(c.displayName);
      return aliases.some(al => al === a || al === b || a.includes(al) || b.includes(al));
    });
    map[f.key] = hit ? hit.name : SKIP_VALUE;
  });

  /* Synthetic Current User field */
  const userHit = findCurrentUserColumn(cols);
  map[CURRENT_USER_FIELD_KEY] = userHit ? userHit.name : SKIP_VALUE;

  wFefoState.uploadMapping = map;
  wFefo_renderUploadMapping();
});

$('wFefoUploadResetMapBtn').addEventListener('click', () => {
  wFefoState.uploadMapping = {};
  wFefo_renderUploadMapping();
});

$('wFefoUploadConfirmBtn').addEventListener('click', async () => {
  if (!wFefoState.uploadListId || !wFefoState.uploadSiteId) { alert('Load columns first.'); return; }
  if (!wFefoState.results.length) { alert('No results to upload.'); return; }

  const rowsToUpload = wFefo_getVisibleResults();
  if (!rowsToUpload.length) { alert('No rows match the current filter — nothing to upload.'); return; }

  if (!hasPerm('uploader')) { alert('Permission denied.'); return; }
  const activeMapping = Object.entries(wFefoState.uploadMapping || {}).filter(([, v]) => v && v !== SKIP_VALUE);
  if (!activeMapping.length) { alert('Map at least one field.'); return; }
  const token = getGlobalAccessToken();
  const filterDesc = wFefo_getFilterSummary();
  const total = rowsToUpload.length;

  // Friendly name for the target list (fallback to the picker value)
  const targetListName = (utReady('fefo') && utGet('fefo').list) || (document.querySelector('[data-list-picker="w-fefo-upload"] .list-picker-input')?.value || 'selected list');

  const confirmMsg = filterDesc
    ? `Upload ${total} FILTERED row(s) to "${targetListName}"?\n\nActive filter: ${filterDesc}\n(Total unfiltered: ${wFefoState.results.length})`
    : `Upload ${total} row(s) to "${targetListName}"?`;
  spAsk.extra = spDocLine('Picking list / report', wFefoState.docNo, (wFefoState.uploadMapping || {}).docNo);
  if (!(await spAsk(confirmMsg))) return;

  // ---- Lock UI & show progress bar ----
  $('wFefoUploadConfirmBtn').disabled = true;
  const statusEl = $('wFefoUploadStatus');
  statusEl.textContent = 'Uploading…';

  const labelText = `Uploading ${total.toLocaleString()} row(s) to "${targetListName}"…`;
  wFefoUploadProgress.start(labelText, total);

  let ok = 0, fail = 0;
  const errors = [];
  const startedAt = Date.now();

  const fmtDate = (d) => { if (!d) return null; const dt = new Date(d); return isNaN(dt.getTime()) ? null : dt.toISOString(); };

  for (let i = 0; i < total; i++) {
    const r = rowsToUpload[i];
    const fields = {};
    activeMapping.forEach(([outKey, targetName]) => {
      let v = null;
      if (outKey === CURRENT_USER_FIELD_KEY) v = getCurrentUserValue();
      else if (outKey === 'docNo') v = wFefoState.docNo || null;
      else if (outKey.startsWith('g:')) v = r.groupValues[outKey.slice(2)] ?? null;
      else if (outKey === 'prodDate' || outKey === 'expiryDate') v = fmtDate(r[outKey]);
      else v = r[outKey] ?? null;
      if (v !== null && v !== undefined && v !== '') fields[targetName] = v;
    });

    // Live "current row" text
    const currentLine = `Row ${i + 1}/${total} · SKU ${r.sku ?? ''} · Batch ${r.batchCode ?? ''} · ✔ ${ok} ok · ✘ ${fail} failed`;

    if (!Object.keys(fields).length) {
      fail++;
      wFefoUploadProgress.update(i + 1, total, `Row ${i + 1}: no mappable values (skipped)`);
      continue;
    }
    try {
      await createItem(wFefoState.uploadSiteId, wFefoState.uploadListId, fields, token);
      ok++;
      wFefoUploadProgress.update(i + 1, total, currentLine);
    } catch (err) {
      fail++;
      errors.push(`Row ${i + 1}: ${err.message}`);
      wFefoUploadProgress.update(i + 1, total, `✘ Row ${i + 1}: ${err.message.slice(0, 70)}`);
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (fail === 0) {
    wFefoUploadProgress.finish(`✅ Uploaded ${ok.toLocaleString()} row(s) in ${elapsedSec}s`);
    statusEl.textContent = `✅ Uploaded ${ok} row(s) in ${elapsedSec}s.`;
    wFefo_setStatus(`✅ FEFO results uploaded to "${targetListName}" (${ok} rows).`, 'success');
    w_logToActivity(`FEFO upload → "${targetListName}": ${ok} rows in ${elapsedSec}s`);
  } else {
    wFefoUploadProgress.error(`⚠ ${ok} ok · ${fail} failed — ${elapsedSec}s`);
    statusEl.textContent = `⚠ ${ok} ok, ${fail} failed. ${errors.slice(0, 2).join(' | ')}`;
    wFefo_setStatus(`⚠ Upload to "${targetListName}": ${ok} ok, ${fail} failed.`, 'warn');
    w_logToActivity(`FEFO upload → "${targetListName}": ${fail} failure(s)`);
    notifyFailure('FEFO Upload Partial Failure', `${fail} failure(s) uploading to "${targetListName}".\n\n${errors.slice(0, 5).join('\n')}`);
  }

  $('wFefoUploadConfirmBtn').disabled = false;
});
/* ============================================================
   INCREMENTAL UPLOAD  (Warehouse)
   Reads a cumulative Excel/CSV file; uploads only rows whose
   composite key is not already present in the target list.
   ============================================================ */
const incUploadState = {
  listName: '',
  siteId: null,
  listId: null,
  columns: [],
  columnsLoadedFor: '',
  parsedRows: [],          // raw rows after parse+split
  parsedHeaders: [],       // split-aware headers (includes synthetic fields)
  existingKeys: null,      // Set<string> — keys already in the target list
  existingCount: 0,
  newRows: [],             // parsedRows that are new
  keyColumns: [],          // array of Excel column names
  mapping: {},             // { excelHeader -> spField | SKIP_VALUE }
  lastResult: null,
  listPicker: null,
  fileName: '',
  parsedAt: 0,
};

const INC_SPLIT_FIELDS = ['Ticket_No', 'Batch_No', 'Driver_No', 'Remarks', 'Remark_Date'];
const INC_DEFAULT_KEYS = ['Ticket_No', 'citemno', 'cmeasure', 'ntrfqty_1'];
const INC_SKIP_DEFAULT = ['textbox19'];   // always-same noise column
const INC_TRAILING_WS_COLS = ['cwhouse2_1', 'citemno', 'cmeasure']; // trim on load

const incUploadGoProgress = new ProgressBar('incUploadGoProgress');
const incUploadParseProgress = new ProgressBar('incUploadParseProgress');

function inc_log(msg) {
  const el = $('incUploadLog');
  if (!el) return;
  el.style.display = 'block';
  el.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  el.scrollTop = el.scrollHeight;
}
function inc_setStatus(msg, type = 'info') {
  const el = $('incUploadGoStatus');
  if (!el) return;
  el.className = 'status-msg ' + type;
  el.textContent = msg || '';
}
function inc_setFileStatus(msg, type = 'info') {
  const el = $('incUploadFileStatus');
  if (!el) return;
  el.className = 'status-msg ' + type;
  el.textContent = msg || '';
}
function inc_setColsStatus(msg) {
  const el = $('incUploadColsStatus');
  if (el) el.textContent = msg || '';
}

/* ---------- Composite field parsers ---------- */
function inc_parseTextbox15(raw) {
  // "Batch# 17549991-6 Driver# 128877 Ticket#148490893"
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return { Batch_No: '', Driver_No: '', Ticket_No: '' };
  // Anchored, tolerant to extra spaces, optional missing pieces
  const m = s.match(/Batch#\s*(.*?)\s*Driver#\s*(.*?)\s*Ticket#\s*(\S+)\s*$/i);
  if (m) return { Batch_No: m[1].trim(), Driver_No: m[2].trim(), Ticket_No: m[3].trim() };
  // Fallbacks — extract what we can
  const b = s.match(/Batch#\s*(.*?)(?=\s*Driver#|\s*Ticket#|$)/i);
  const d = s.match(/Driver#\s*(.*?)(?=\s*Ticket#|$)/i);
  const t = s.match(/Ticket#\s*(\S+)/i);
  return {
    Batch_No: b ? b[1].trim() : '',
    Driver_No: d ? d[1].trim() : '',
    Ticket_No: t ? t[1].trim() : '',
  };
}
function inc_parseTextbox105(raw) {
  // "Remarks:6-2026-06-10 16:08"
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return { Remarks: '', Remark_Date: '' };
  const m = s.match(/^Remarks:\s*(.*?)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*$/i);
  if (m) return { Remarks: m[1].trim(), Remark_Date: `${m[2]} ${m[3]}` };
  // No trailing date/time — keep the whole remainder as remarks
  const r = s.match(/^Remarks:\s*(.*)$/i);
  return { Remarks: r ? r[1].trim() : s, Remark_Date: '' };
}

/* ---------- Row / header enrichment ---------- */
function inc_enrichRow(row) {
  const out = { ...row };
  const t15Key = Object.keys(row).find(k => k.toLowerCase() === 'textbox15');
  if (t15Key) Object.assign(out, inc_parseTextbox15(row[t15Key]));
  const t105Key = Object.keys(row).find(k => k.toLowerCase() === 'textbox105');
  if (t105Key) Object.assign(out, inc_parseTextbox105(row[t105Key]));
  // Trim trailing whitespace on known columns
  INC_TRAILING_WS_COLS.forEach(c => {
    const k = Object.keys(out).find(x => x.toLowerCase() === c.toLowerCase());
    if (k && typeof out[k] === 'string') out[k] = out[k].trim();
  });
  return out;
}
function inc_enrichHeaders(headers) {
  const out = headers.slice();
  // Drop the raw composite sources from the mapping list — we keep them in the row
  // but the split fields are what we map. Keep raw textbox15/Textbox105 available
  // in case the user wants them, but deprioritize.
  const hasT15 = headers.some(h => h.toLowerCase() === 'textbox15');
  const hasT105 = headers.some(h => h.toLowerCase() === 'textbox105');
  if (hasT15) INC_SPLIT_FIELDS.slice(0, 3).forEach(f => { if (!out.includes(f)) out.push(f); });
  if (hasT105) INC_SPLIT_FIELDS.slice(3).forEach(f => { if (!out.includes(f)) out.push(f); });
  return out;
}

