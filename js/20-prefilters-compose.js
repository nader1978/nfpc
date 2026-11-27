/* ---------- Pre-filter buttons ---------- */
$('emlAddPreFilterBtn').addEventListener('click', () => {
  const cols = eml_getFilterableColumns();
  if (!cols.length) { alert('Load columns first.'); return; }
  emlState.preFilters.push({ id: uid(), field: cols[0].name, op: 'eq', value: '' });
  eml_renderPreFilters();
});
$('emlClearPreFiltersBtn').addEventListener('click', () => {
  emlState.preFilters = [];
  eml_renderPreFilters();
});
$('emlReloadValuesBtn').addEventListener('click', async () => {
  if (!emlState.siteId || !emlState.listId) { alert('Load columns first.'); return; }
  const token = getGlobalAccessToken();
  if (!token) return;
  const btn = $('emlReloadValuesBtn');
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = '⏳ Reloading…';
  try {
    await eml_loadValueCache(emlState.siteId, emlState.listId, token);
    eml_renderPreFilters();
    eml_setLoadStatus(emlState.valueCacheMeta
      ? `✓ Suggestions reloaded — ${emlState.valueCacheMeta.values.toLocaleString()} values`
      : '⚠ Suggestions reload failed');
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});
$('emlTestFilterBtn').addEventListener('click', async () => {
  if (!emlState.siteId || !emlState.listId) { alert('Load columns first.'); return; }
  const token = getGlobalAccessToken();
  if (!token) { eml_setLoadStatus('⚠ Global token not configured'); return; }
  const filterQ = eml_buildODataFilter();
  if (!filterQ) { eml_setLoadStatus('⚠ No filter to test — add a pre-filter first.'); return; }
  const btn = $('emlTestFilterBtn');
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Testing…';
  eml_setLoadStatus('Testing $filter…');
  try {
    const url = `https://graph.microsoft.com/v1.0/sites/${emlState.siteId}/lists/${emlState.listId}/items?$expand=fields&$top=1&$filter=${encodeURIComponent(filterQ)}`;
    const TH = { headers: { Authorization: `Bearer ${token}`, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } }; let r = await fetchWithRetry(url, TH, 'test filter');
    if (r.status === 400 && odQuoteDates(filterQ) !== filterQ) { const r2 = await fetchWithRetry(url.replace(/\$filter=.*/, '$filter=' + encodeURIComponent(odQuoteDates(filterQ))), TH, 'test filter (quoted dates)'); if (r2.ok) r = r2; }
    if (!r.ok) {
      let e; try { e = await r.text(); } catch { e = r.statusText; }
      let parsed = null;
      try { parsed = JSON.parse(e); } catch {}
      const msg = parsed?.error?.message || e;
      eml_setLoadStatus(`✘ Filter rejected (${r.status}): ${msg}`);
    } else {
      const d = await r.json();
      eml_setLoadStatus(`✅ Filter is valid — Graph returned ${(d.value || []).length} row(s).`);
    }
  } catch (err) {
    eml_setLoadStatus('✘ Test error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

/* ---------- Post-filter buttons ---------- */
$('emlAddFilterBtn').addEventListener('click', () => {
  const f = emlState.allColumns.filter(c => emlState.allItems.some(it => it.fields?.[c.name] !== undefined && it.fields[c.name] !== null && it.fields[c.name] !== ''));
  if (!f.length) return;
  emlState.filters.push({ id: uid(), field: f[0].name, op: 'contains', value: '' });
  eml_renderFilters();
  eml_applyFiltersAndPreview();
});
$('emlClearFiltersBtn').addEventListener('click', () => {
  emlState.filters = [];
  eml_renderFilters();
  eml_applyFiltersAndPreview();
});

/* ---------- Column quick actions ---------- */
$('emlSelectAllBtn').addEventListener('click', () => {
  document.querySelectorAll('#emlColsGrid input[type="checkbox"]').forEach(cb => {
    cb.checked = true;
    if (!emlState.selectedColumns.includes(cb.value)) emlState.selectedColumns.push(cb.value);
  });
  eml_updateColsSummary();
  eml_applyFiltersAndPreview();
});
$('emlDeselectAllBtn').addEventListener('click', () => {
  document.querySelectorAll('#emlColsGrid input[type="checkbox"]').forEach(cb => cb.checked = false);
  emlState.selectedColumns = [];
  eml_updateColsSummary();
  eml_applyFiltersAndPreview();
});

/* ---------- Compose (bridge to the existing modal) ---------- */
$('emlComposeBtn').addEventListener('click', () => {
  if (!emlState.filteredItems.length) { eml_setStatus('No rows to email.', 'warn'); return; }
  if (!emlState.selectedColumns.length) { eml_setStatus('No columns selected.', 'warn'); return; }

  // Bridge: temporarily point the exporter's state at our data so the
  // existing expEmail_* functions operate on the emailer's dataset.
  expState.allItems       = emlState.allItems;
  expState.allColumns     = emlState.allColumns;
  expState.selectedColumns = emlState.selectedColumns;
  expState.filteredItems  = emlState.filteredItems;
  expState.filters        = emlState.filters;
  expState.listId         = emlState.listId;
  expState.siteId         = emlState.siteId;
  expState.columnsLoadedFor = emlState.columnsLoadedFor;

  // Point the export picker (used for filenames / list name in the modal)
  // at the emailer's current list, without permanently changing it.
  const savedExporterValue = exporterPicker?.getValue?.();
  const currentList = emlState.listPicker?.getValue() || '';
  // The modal reads list name from exporterPicker.getValue();
  // we temporarily set it, then restore when the modal closes.
  if (exporterPicker && currentList) exporterPicker.setValue(currentList);

  // Reset the email column sets so the modal seeds fresh from this dataset
  expEmailState.bodyCols = emlState.selectedColumns.slice(0, 8);
  expEmailState.attachCols = emlState.selectedColumns.slice();

  // Open the existing modal
  const modal = $('expEmailModal');
  modal.style.display = 'flex';
  $('expEmailStatus').className = 'status-msg';
  $('expEmailStatus').textContent = '';
  expEmail_applyDefaults();
  expEmail_renderColsGrids();
  expEmail_refreshPreview();
  setTimeout(() => $('expEmailTo').focus(), 60);

  // Restore exporter's picker value when the modal closes
  const restore = () => {
    if (exporterPicker && savedExporterValue !== undefined) exporterPicker.setValue(savedExporterValue);
    $('expEmailModal').removeEventListener('click', restoreOnCloseClick);
    $('expEmailCloseBtn').removeEventListener('click', restore);
    document.removeEventListener('keydown', restoreOnEscape);
  };
  const restoreOnCloseClick = (e) => { if (e.target === modal) restore(); };
  const restoreOnEscape = (e) => { if (e.key === 'Escape' && modal.style.display === 'flex') restore(); };
  $('expEmailModal').addEventListener('click', restoreOnCloseClick);
  $('expEmailCloseBtn').addEventListener('click', restore);
  document.addEventListener('keydown', restoreOnEscape);

  eml_setStatus(`Ready — ${emlState.filteredItems.length} rows, ${emlState.selectedColumns.length} columns`, 'success');
});

/* ---------- Clear ---------- */
$('emlClearBtn').addEventListener('click', () => {
  emlState.allItems = [];
  emlState.allColumns = [];
  emlState.selectedColumns = [];
  emlState.filters = [];
  emlState.preFilters = [];
  emlState.filteredItems = [];
  emlState.siteId = null;
  emlState.listId = null;
  emlState.columnsLoadedFor = '';
  emlState.valueCache = {};
  emlState.valueCacheMeta = null;
  ['emlPreFilterSection','emlFilterSection','emlColumnsSection','emlPreviewSection','emlComposeSection'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'none';
  });
  eml_setLoadStatus('');
  eml_setStatus('');
  eml_renderPreFilters();
  eml_renderValueCacheInfo('');
});

/* ---------- Boot hook ---------- */
function eml_boot() {
  eml_initListPicker();
  const siteEl = $('emlSiteUrl');
  if (siteEl) siteEl.value = getGlobalSiteUrl();
}
/* ============================================================
   Boot
   ============================================================ */
/* moved to 99-boot.js */

/* ===== PLANNING DEPT. ===== */

/* ============================================================
   PLANNING DEPT. — parser, storage, daily upload
   ============================================================ */
const PLQ = (s, r) => (r || document).querySelector(s);
const plNum = v => (typeof v === 'number' && isFinite(v)) ? v : null;
const plEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plIso = d => { const t = d instanceof Date ? d : new Date(d); return isNaN(t.getTime()) ? '' : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
function plF(v, d) { if (v == null || isNaN(v)) return '—'; return Number(v).toLocaleString(undefined, { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: 0 }); }
function plK(v) { if (v == null || isNaN(v)) return '—'; const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M'; if (a >= 1e4) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'; if (a >= 1e3) return (v / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'K'; return a >= 100 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString(); }
const plP = (v, d) => v == null || isNaN(v) ? '—' : (v * 100).toFixed(d == null ? 1 : d).replace(/\.0$/, '') + '%';

/* ---------- column schema ---------- */
const PL_ID = {
  'code': ['code', 'Code', 'Item', 'text'], 'item': ['item', 'Item', 'Item', 'text'], 'size': ['size', 'Size', 'Item', 'text'], 'base uom': ['uom', 'Base UoM', 'Item', 'text'],
  'status': ['status', 'Status', 'Item', 'text'], 'brand': ['brand', 'Brand', 'Item', 'text'], 'sub-brand': ['subBrand', 'Sub-brand', 'Item', 'text'],
  'pri. packaging': ['priPack', 'Pri. Packaging', 'Item', 'text'], 'sec. packaging': ['secPack', 'Sec. Packaging', 'Item', 'text'], 'sec. pkg. format': ['secFmt', 'Sec. Pkg. Format', 'Item', 'text'],
  'sku tax status': ['tax', 'SKU Tax Status', 'Item', 'text'], 'type': ['type', 'Type', 'Item', 'text'], 'pcs/carton': ['pcsCtn', 'Pcs / Carton', 'Item', 'num'], 'ct/pallet': ['ctPallet', 'CT / Pallet', 'Item', 'num'],
  'monthly forecast': ['monthlyFcst', 'Monthly Forecast', 'Plan & Sales', 'num'], 'opening stock': ['openingStock', 'Opening Stock', 'Plan & Sales', 'num'], 'mtd sales': ['mtdSales', 'MTD Sales', 'Plan & Sales', 'num'],
  'avg. ytd sales / month': ['avgYtd', 'Avg. YTD Sales / Month', 'Plan & Sales', 'num'], '% mtd sales vs forecast': ['pctMtd', '% MTD Sales vs Forecast', 'Plan & Sales', 'pct'],
  'total stock on hand': ['totalSOH', 'Total Stock On Hand', 'Stock', 'num'], 'only released soh': ['releasedSOH', 'Released SOH', 'Stock', 'num'], 'pallets based on total uae stock': ['pallets', 'Pallets (total UAE stock)', 'Stock', 'num'],
  'days cover released stock (bof)': ['docReleased', 'Days Cover — Released', 'Stock', 'days'], 'days cover (bof) releasesd +incubation stock+ hold': ['docAll', 'Days Cover — Released + Incub. + Hold', 'Stock', 'days'],
  'only incubation stock doc)': ['docIncub', 'Days Cover — Incubation only', 'Stock', 'days'], 'total soh bos': ['sohBOS', 'Total SOH BOS', 'Stock', 'num'],
  'incubation stock': ['incubation', 'Incubation Stock', 'Incubation & Hold', 'num'], 'date of production': ['prodDates', 'Date of Production', 'Incubation & Hold', 'text'],
  'estimated release date': ['relDates', 'Estimated Release Date', 'Incubation & Hold', 'text'], 'on hold inventory': ['onHold', 'On Hold Inventory', 'Incubation & Hold', 'num'],
};
const PL_DERIVED = [
  { key: '_health', label: 'Stock health', section: 'Derived', type: 'text' },
  { key: '_paceIdx', label: 'Sales pace index (MTD % ÷ time gone)', section: 'Derived', type: 'num' },
  { key: '_paceClass', label: 'Sales pace', section: 'Derived', type: 'text' },
  { key: '_projSales', label: 'Projected month-end sales', section: 'Derived', type: 'num' },
  { key: '_projPct', label: 'Projected % of forecast', section: 'Derived', type: 'pct' },
  { key: '_incubShare', label: 'Incubation share of stock', section: 'Derived', type: 'pct' },
  { key: '_flags', label: 'Flags', section: 'Derived', type: 'text' },
];
const PL_SECTIONS = ['Item', 'Plan & Sales', 'Stock', 'Incubation & Hold', 'Channels', 'Warehouse & Locations', 'Derived', 'Other'];

function plCellVal(c) {
  if (!c || c.t === 'e' || c.t === 'z') return null;
  if (c.t === 'n' || c.t === 'd') return c.v;
  if (c.t === 'b') return c.v ? 1 : 0;
  const s = String(c.v == null ? '' : c.v).trim(); return s === '' ? null : s;
}
const plColLetter = i => { let s = '', n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

function plParseSheet(ws, fileName) {
  if (!ws || !ws['!ref']) throw new Error('The first sheet is empty.');
  const ref = XLSX.utils.decode_range(ws['!ref']);
  const g = (r, c) => plCellVal(ws[XLSX.utils.encode_cell({ r, c })]);
  let H = -1;
  for (let r = 0; r <= Math.min(ref.e.r, 40); r++) { const v = g(r, 0); if (typeof v === 'string' && /^code$/i.test(v.trim())) { H = r; break; } }
  if (H < 0) throw new Error('Could not find the header row (a cell “Code” in column A). Is this the Planning Data sheet?');
  const nC = ref.e.c + 1, txt = v => v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
  const hdr = c => txt(g(H, c)), grp = c => H > 0 ? txt(g(H - 1, c)) : '', capv = c => H > 1 ? plNum(g(H - 2, c)) : null;

  // data rows
  const rowIdx = []; let gtRow = -1, blanks = 0;
  for (let r = H + 1; r <= ref.e.r; r++) {
    const code = g(r, 0);
    if (code == null) { if (++blanks >= 3) break; continue; } blanks = 0;
    if (/grand\s*total|^total$/i.test(String(code).trim())) { gtRow = r; break; }
    rowIdx.push(r);
  }
  if (!rowIdx.length) throw new Error('No SKU rows were found under the header.');

  const cols = [], used = new Set(), ignored = [], meta = { cap: {}, channels: [], locations: [] };
  const add = (c, key, label, section, type, extra) => { let k = key; if (used.has(k)) k = key + '_' + c; used.add(k); const o = Object.assign({ idx: c, key: k, label, section, type }, extra || {}); cols.push(o); return o; };
  let curCh = null, curLoc = null;
  for (let c = 0; c < nC; c++) {
    const h = hdr(c), hl = h.toLowerCase(), gl = grp(c);
    if (PL_ID[hl] && !used.has(PL_ID[hl][0])) { const d = PL_ID[hl]; add(c, d[0], d[1], d[2], d[3]); continue; }
    if (hl === 'forecast' && gl) { const lab = gl.replace(/\s*\(.*$/, '').trim(), key = lab.replace(/\W+/g, '') || 'CH' + c; curCh = { key, label: lab, note: gl }; meta.channels.push(curCh); add(c, `ch_${key}_fc`, `${lab} · Forecast`, 'Channels', 'num', { ch: key }); continue; }
    if (hl === 'actuals' && curCh) { add(c, `ch_${curCh.key}_act`, `${curCh.label} · Actuals`, 'Channels', 'num', { ch: curCh.key }); continue; }
    if (hl === '% sales vs forecast' && curCh) { add(c, `ch_${curCh.key}_pct`, `${curCh.label} · % vs Forecast`, 'Channels', 'pct', { ch: curCh.key }); continue; }
    if (['kizad', 'cx4', 'main wh'].includes(hl)) { const key = 'wh_' + hl.replace(/\W+/g, ''); add(c, key, `${h} warehouse stock`, 'Warehouse & Locations', 'num', { wh: h }); const cv = capv(c); if (cv != null) meta.cap[h] = cv; continue; }
    if (hl === 'stock' && gl) { const lab = gl.trim(), key = lab.replace(/\W+/g, ''); curLoc = { key, label: lab }; meta.locations.push(curLoc); add(c, `loc_${key}_stock`, `${lab} · Stock`, 'Warehouse & Locations', 'num', { loc: key }); const cv = capv(c); if (cv != null) meta.cap[lab] = cv; continue; }
    if (hl.startsWith('days cover (bo avg') && curLoc) { add(c, `loc_${curLoc.key}_docYtd`, `${curLoc.label} · Days cover (YTD avg)`, 'Warehouse & Locations', 'days', { loc: curLoc.key }); continue; }
    if (hl.startsWith('days cover (bo current') && curLoc) { add(c, `loc_${curLoc.key}_docTrend`, `${curLoc.label} · Days cover (current trend)`, 'Warehouse & Locations', 'days', { loc: curLoc.key }); continue; }
    if (hl === 'near expiry') { add(c, 'nearExpiry', 'Near Expiry', 'Warehouse & Locations', 'num'); curLoc = null; continue; }
    if (hl === '% available') { add(c, 'pctAvail', '% Available', 'Warehouse & Locations', 'pct'); continue; }
    if (hl === 'icode' || hl === 'parent code') { ignored.push(`${plColLetter(c)} ${h}${gl ? ' (' + gl + ')' : ''}`); continue; }
    // unknown / unnamed column: keep it if it holds data
    const hasData = rowIdx.some(r => g(r, c) != null);
    if (!hasData) continue;
    add(c, 'x_' + c, h ? (gl ? `${h} (${gl})` : h) : `Column ${plColLetter(c)}`, 'Other', 'num', { unknown: true, unnamed: !h });
  }
  const need = ['code', 'item', 'brand', 'monthlyFcst', 'mtdSales', 'totalSOH', 'releasedSOH'];
  const missing = need.filter(k => !cols.some(c => c.key === k));

  // rows
  const rows = rowIdx.map(r => cols.map(col => {
    const v = g(r, col.idx);
    if (col.key === 'prodDates' || col.key === 'relDates') { if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2); return v == null ? null : String(v); }
    if (col.type === 'text') return v == null ? null : (v instanceof Date ? plIso(v) : String(v).replace(/\s+/g, ' ').trim());
    if (v instanceof Date) return plIso(v);
    if (typeof v === 'string') { const n = Number(v.replace(/,/g, '')); return isFinite(n) && v !== '' ? n : (col.unknown ? v : null); }
    return v;
  }));
  // unnamed columns that repeat MTD sales = total channel sales
  const ci = k => cols.findIndex(c => c.key === k), im = ci('mtdSales');
  cols.forEach((c, i) => { if (c.unknown && c.unnamed && im >= 0) { let eq = 0, tot = 0; rows.forEach(a => { if (a[i] != null || a[im] != null) { tot++; if (Math.abs((a[i] || 0) - (a[im] || 0)) < 0.01) eq++; } }); if (tot && eq / tot > 0.95) { c.key = 'totalSales'; c.label = 'Total channel sales (MTD)'; c.section = 'Channels'; c.unknown = false; } } });

  // grand total (for validation + portfolio figures)
  const gt = {}; if (gtRow >= 0) cols.forEach(c => { const v = g(gtRow, c.idx); if (typeof v === 'number') gt[c.key] = v; });

  // report-level facts
  let asOf = '', monthStart = '', timeGone = null;
  const iT = ci('totalSOH') >= 0 ? cols[ci('totalSOH')].idx : -1, iO = ci('monthlyFcst') >= 0 ? cols[ci('monthlyFcst')].idx : -1;
  for (let r = 0; r < H; r++) {
    if (iT >= 0 && g(r, iT) instanceof Date) asOf = plIso(g(r, iT));
    if (iO >= 0 && g(r, iO) instanceof Date) monthStart = plIso(g(r, iO));
    for (let c = 0; c < nC; c++) { const v = g(r, c); if (typeof v === 'string' && /time\s*gone/i.test(v)) { for (let rr = r + 1; rr < H + 1 && rr <= r + 2; rr++) { const t = plNum(g(rr, c)); if (t != null && t > 0 && t <= 1.0001) { timeGone = t; break; } } } }
  }
  if (!asOf) { for (let r = 0; r < H && !asOf; r++) for (let c = nC - 1; c >= 0; c--) { if (g(r, c) instanceof Date) { asOf = plIso(g(r, c)); break; } } }
  const warnings = [];
  if (missing.length) warnings.push({ level: 'error', text: 'Required column(s) not found: ' + missing.join(', ') + '. The dashboard may be incomplete.' });
  if (!asOf) warnings.push({ level: 'warn', text: 'No as-of date was found in the sheet (cell above “Total Stock On Hand”). Please enter it below.' });
  if (timeGone == null) { warnings.push({ level: 'info', text: 'No “Time gone” value found — it will be estimated from the as-of date.' }); }
  const unk = cols.filter(c => c.unknown); if (unk.length) warnings.push({ level: 'info', text: `${unk.length} extra column(s) were kept as “Other”: ${unk.slice(0, 6).map(c => c.label).join(', ')}${unk.length > 6 ? '…' : ''}` });
  if (ignored.length) warnings.push({ level: 'info', text: `${ignored.length} hidden helper column(s) ignored (${ignored.slice(0, 3).join(', ')}${ignored.length > 3 ? '…' : ''}).` });
  if (gtRow >= 0) ['monthlyFcst', 'mtdSales', 'totalSOH', 'releasedSOH', 'incubation', 'onHold'].forEach(k => {
    const i = ci(k); if (i < 0 || gt[k] == null) return; const s = rows.reduce((t, a) => t + (typeof a[i] === 'number' ? a[i] : 0), 0), d = Math.abs(s - gt[k]);
    if (d > Math.max(1, Math.abs(gt[k]) * 0.005)) warnings.push({ level: 'warn', text: `${cols[i].label}: the SKU rows add up to ${plF(s)} but the Grand Total row says ${plF(gt[k])} (difference ${plF(s - gt[k])}).` });
  }); else warnings.push({ level: 'info', text: 'No “Grand Total” row found — totals are calculated from the SKU rows.' });
  const codes = {}; rows.forEach(a => { const k = a[0]; codes[k] = (codes[k] || 0) + 1; }); const dup = Object.keys(codes).filter(k => codes[k] > 1);
  if (dup.length) warnings.push({ level: 'warn', text: `Duplicate SKU code(s): ${dup.slice(0, 6).join(', ')}${dup.length > 6 ? '…' : ''}` });
  const neg = []; ['totalSOH', 'releasedSOH', 'incubation', 'onHold'].forEach(k => { const i = ci(k); if (i >= 0) rows.forEach(a => { if (typeof a[i] === 'number' && a[i] < 0) neg.push(a[0]); }); });
  if (neg.length) warnings.push({ level: 'warn', text: `Negative stock on ${neg.length} SKU(s): ${Array.from(new Set(neg)).slice(0, 5).join(', ')}` });

  const snap = { v: 1, asOf, monthStart, timeGone, fileName: fileName || '', cols: cols.map(c => { const o = Object.assign({}, c); delete o.idx; return o; }), rows, cap: meta.cap, channels: meta.channels, locations: meta.locations, gt, warnings, ignored, savedAt: null, savedBy: '' };
  plFixCalendar(snap);
  return snap;
}
function plFixCalendar(s) {
  const d = s.asOf ? new Date(s.asOf + 'T00:00:00') : null;
  if (d && !isNaN(d.getTime())) { const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); s.daysInMonth = dim; s.dayNo = d.getDate(); if (s.timeGone == null) s.timeGone = (d.getDate() - 1) / dim; if (!s.monthStart) s.monthStart = plIso(new Date(d.getFullYear(), d.getMonth(), 1)); }
}

/* ---------- storage: IndexedDB (this browser) + SharePoint library (everyone) ---------- */
const plDB = { db: null, mem: new Map() };
function plIdb() {
  return new Promise(res => {
    if (plDB.db) return res(plDB.db);
    try { const rq = indexedDB.open('nfpc_planning', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('snaps', { keyPath: 'asOf' }); rq.onsuccess = () => { plDB.db = rq.result; res(plDB.db); }; rq.onerror = () => res(null); rq.onblocked = () => res(null); } catch (e) { res(null); }
  });
}
async function plPut(s) { const db = await plIdb(); if (!db) { plDB.mem.set(s.asOf, s); return; } await new Promise((ok, no) => { const tx = db.transaction('snaps', 'readwrite'); tx.objectStore('snaps').put(s); tx.oncomplete = ok; tx.onerror = () => no(tx.error); }); }
async function plGet(k) { const db = await plIdb(); if (!db) return plDB.mem.get(k) || null; return new Promise(ok => { const rq = db.transaction('snaps').objectStore('snaps').get(k); rq.onsuccess = () => ok(rq.result || null); rq.onerror = () => ok(null); }); }
async function plAll() { const db = await plIdb(); if (!db) return Array.from(plDB.mem.values()); return new Promise(ok => { const rq = db.transaction('snaps').objectStore('snaps').getAll(); rq.onsuccess = () => ok(rq.result || []); rq.onerror = () => ok([]); }); }
async function plDel(k) { const db = await plIdb(); if (!db) { plDB.mem.delete(k); return; } await new Promise(ok => { const tx = db.transaction('snaps', 'readwrite'); tx.objectStore('snaps').delete(k); tx.oncomplete = ok; tx.onerror = ok; }); }

const PL_CFG_KEY = LS_BASE + '_pl_cfg';
const plCfg = () => { try { return Object.assign({ folder: 'PlanningData', thr: { crit: 7, low: 15, high: 45 }, sel: '' }, JSON.parse(localStorage.getItem(PL_CFG_KEY) || '{}')); } catch (e) { return { folder: 'PlanningData', thr: { crit: 7, low: 15, high: 45 }, sel: '' }; } };
const plCfgSave = o => { try { localStorage.setItem(PL_CFG_KEY, JSON.stringify(Object.assign(plCfg(), o))); } catch (e) {} };
let plSiteIdCache = '';
async function plSp() {
  const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) throw new Error('Global Site URL / token not configured.');
  if (!plSiteIdCache || plSiteIdCache.url !== siteUrl) {
    const { hostname, sitePath } = parseSiteUrl(siteUrl);
    const u = (!sitePath || sitePath === '/') ? `https://graph.microsoft.com/v1.0/sites/${hostname}` : `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`;
    const r = await fetchWithRetry(u, { headers: { Authorization: `Bearer ${token}` } }, 'resolve site'); if (!r.ok) throw new Error(`Site resolution failed (${r.status})`);
    plSiteIdCache = { id: (await r.json()).id, url: siteUrl };
  }
  return { siteId: plSiteIdCache.id, token };
}
const plFile = d => `planning_${d}.json`;
async function plSpSave(snap) {
  const { siteId, token } = await plSp(), folder = encodeURIComponent(plCfg().folder.replace(/^\/+|\/+$/g, '') || 'PlanningData');
  const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${folder}/${plFile(snap.asOf)}:/content`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(snap) }, 'save snapshot');
  if (!r.ok) { let t = ''; try { t = (await r.json()).error.message; } catch (e) {} throw new Error(`SharePoint said HTTP ${r.status}${t ? ': ' + t : ''}`); }
}
async function plSpList() {
  const { siteId, token } = await plSp(), folder = encodeURIComponent(plCfg().folder.replace(/^\/+|\/+$/g, '') || 'PlanningData');
  const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${folder}:/children?$top=200&$select=name,size,lastModifiedDateTime,@microsoft.graph.downloadUrl`, { headers: { Authorization: `Bearer ${token}` } }, 'list snapshots');
  if (r.status === 404) return []; if (!r.ok) throw new Error(`SharePoint said HTTP ${r.status}`);
  return ((await r.json()).value || []).filter(x => /^planning_\d{4}-\d{2}-\d{2}\.json$/.test(x.name)).map(x => ({ asOf: x.name.slice(9, 19), name: x.name, size: x.size, modified: x.lastModifiedDateTime, url: x['@microsoft.graph.downloadUrl'] }));
}
async function plSpLoad(it) {
  let r = it.url ? await fetch(it.url) : null;
  if (!r || !r.ok) { const { siteId, token } = await plSp(), folder = encodeURIComponent(plCfg().folder.replace(/^\/+|\/+$/g, '') || 'PlanningData'); r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${folder}/${it.name}:/content`, { headers: { Authorization: `Bearer ${token}` } }, 'download snapshot'); }
  if (!r.ok) throw new Error(`Download failed (${r.status})`); return r.json();
}
const plRemote = { list: [], at: 0 };
async function plSync(all) {
  const list = await plSpList(); plRemote.list = list; plRemote.at = Date.now();
  const have = new Set((await plAll()).map(s => s.asOf)), want = list.slice().sort((a, b) => b.asOf.localeCompare(a.asOf)).filter(x => !have.has(x.asOf)).slice(0, all ? 120 : 40);
  let n = 0; for (const it of want) { try { const s = await plSpLoad(it); if (s && s.asOf && s.cols && s.rows) { s.remote = true; await plPut(s); n++; } } catch (e) {} }
  return { remote: list.length, fetched: n };
}

/* ---------- upload page ---------- */
const plUp = { snap: null };
function plUpStatus(msg, type) { const el = PLQ('#plParseStatus'); el.className = 'status-msg ' + (type || 'info'); el.textContent = msg; }
function plUpRender() {
  const s = plUp.snap, card = PLQ('#plParseCard'); if (!s) { card.style.display = 'none'; return; }
  card.style.display = 'block'; PLQ('#plAsOf').value = s.asOf || ''; PLQ('#plFileName').value = s.fileName; PLQ('#plTG').value = s.timeGone != null ? plP(s.timeGone) + (s.dayNo ? ` (day ${s.dayNo} of ${s.daysInMonth})` : '') : '—';
  const ci = k => s.cols.findIndex(c => c.key === k), sum = k => { const i = ci(k); return i < 0 ? null : s.rows.reduce((t, a) => t + (typeof a[i] === 'number' ? a[i] : 0), 0); };
  const tiles = [['SKUs', s.rows.length], ['Columns recognised', s.cols.filter(c => !c.unknown).length + ' of ' + s.cols.length], ['Total stock on hand', plF(sum('totalSOH'))], ['Released SOH', plF(sum('releasedSOH'))], ['Incubation', plF(sum('incubation'))], ['MTD sales', plF(sum('mtdSales'))], ['Monthly forecast', plF(sum('monthlyFcst'))], ['Channels / Locations', `${(s.channels || []).length} / ${(s.locations || []).length}`]];
  PLQ('#plSummary').innerHTML = tiles.map(t => `<div><small>${plEsc(t[0])}</small><b>${plEsc(t[1])}</b></div>`).join('');
  PLQ('#plWarn').innerHTML = s.warnings.map(w => `<div class="pl-w ${w.level}"><span>${w.level === 'error' ? '✖' : w.level === 'warn' ? '⚠' : 'ℹ'}</span><span>${plEsc(w.text)}</span></div>`).join('') || '<div class="pl-w info"><span>✔</span><span>All checks passed.</span></div>';
}
async function plUpFile(f) {
  if (!f) return; plUpStatus('Reading ' + f.name + '…', 'info');
  try {
    if (typeof XLSX === 'undefined') throw new Error('The Excel library is not loaded (check the internet connection).');
    const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true });
    plUp.snap = plParseSheet(wb.Sheets[wb.SheetNames[0]], f.name);
    plUpStatus(`✓ ${plUp.snap.rows.length} SKU rows read from “${wb.SheetNames[0]}”. Check the summary, then save.`, 'success'); plUpRender();
  } catch (e) { plUp.snap = null; plUpRender(); plUpStatus('✘ ' + e.message, 'error'); }
}
async function plSaveSnapshot() {
  const s = plUp.snap; if (!s) return; if (!hasPerm('planning-upload')) { alert('Permission denied.'); return; }
  const d = PLQ('#plAsOf').value; if (!d) { PLQ('#plSaveStatus').textContent = '⚠ Enter the as-of date.'; return; }
  if (d !== s.asOf) { s.asOf = d; s.timeGone = null; plFixCalendar(s); PLQ('#plTG').value = plP(s.timeGone); }
  const old = await plGet(s.asOf); if (old && !confirm(`A snapshot for ${s.asOf} already exists (saved ${old.savedAt ? new Date(old.savedAt).toLocaleString() : ''}). Replace it?`)) return;
  const st = PLQ('#plSaveStatus'); s.savedAt = Date.now(); s.savedBy = (currentUser && (currentUser.username || currentUser.email)) || '';
  try { await plPut(s); st.textContent = '✅ Saved in this browser.'; } catch (e) { st.textContent = '✘ ' + e.message; return; }
  if (PLQ('#plSaveSP').checked) { try { st.textContent = '☁ Saving to SharePoint…'; await plSpSave(s); s.remote = true; await plPut(s); st.textContent = `✅ Saved in this browser and in SharePoint (${plCfg().folder}/${plFile(s.asOf)}).`; } catch (e) { st.textContent = '✅ Saved in this browser. ⚠ SharePoint: ' + e.message; } }
  addActivity('upload', `Planning data ${s.asOf}: ${s.rows.length} SKUs (${s.fileName})`);
  plCfgSave({ sel: s.asOf }); plUp.snap = null; setTimeout(() => { plUpRender(); plHistRender(); plUpStatus('Saved. Open the Planning Dashboard to see it.', 'success'); }, 0); PLQ('#plParseCard').style.display = 'none';
}
async function plHistRender() {
  const all = (await plAll()).sort((a, b) => b.asOf.localeCompare(a.asOf)), body = PLQ('#plHistBody'), rem = new Map((plRemote.list || []).map(x => [x.asOf, x]));
  const sum = (s, k) => { const i = s.cols.findIndex(c => c.key === k); return i < 0 ? null : s.rows.reduce((t, a) => t + (typeof a[i] === 'number' ? a[i] : 0), 0); };
  body.innerHTML = all.length ? all.map(s => `<tr data-d="${s.asOf}"><td><strong>${s.asOf}</strong></td><td class="num">${s.rows.length}</td><td class="num">${plF(sum(s, 'totalSOH'))}</td><td class="num">${plF(sum(s, 'mtdSales'))}</td><td>${plEsc(s.savedBy || '')}${s.savedAt ? '<br><span class="text-sm" style="color:var(--gray-500);">' + new Date(s.savedAt).toLocaleString() + '</span>' : ''}</td><td>${rem.has(s.asOf) || s.remote ? '☁ SharePoint + browser' : 'This browser only'}</td><td><div class="btn-row"><button class="secondary small" data-act="open">📊 Open</button><button class="ghost small" data-act="json">⬇ JSON</button>${(rem.has(s.asOf) || s.remote) ? '' : '<button class="ghost small" data-act="push">☁ Share</button>'}<button class="ghost small" data-act="del">🗑</button></div></td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--gray-400);padding:16px;">No snapshots saved yet.</td></tr>';
  PLQ('#plHistStatus').textContent = all.length ? `${all.length} snapshot(s) available${plRemote.at ? ' · SharePoint checked ' + new Date(plRemote.at).toLocaleTimeString() : ''}.` : '';
}
function plUpInit() {
  const drop = PLQ('#plDrop'), inp = PLQ('#plFile');
  drop.addEventListener('click', () => inp.click()); drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); })); ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => plUpFile(e.dataTransfer.files[0])); inp.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; plUpFile(f); });
  PLQ('#plSaveBtn').addEventListener('click', plSaveSnapshot); PLQ('#plCancelBtn').addEventListener('click', () => { plUp.snap = null; plUpRender(); plUpStatus('', 'info'); });
  PLQ('#plAsOf').addEventListener('change', e => { const s = plUp.snap; if (!s || !e.target.value) return; s.asOf = e.target.value; s.timeGone = null; plFixCalendar(s); PLQ('#plTG').value = plP(s.timeGone) + ` (day ${s.dayNo} of ${s.daysInMonth})`; });
  PLQ('#plFolder').value = plCfg().folder; PLQ('#plFolderSave').addEventListener('click', () => { plCfgSave({ folder: PLQ('#plFolder').value.trim() || 'PlanningData' }); PLQ('#plFolderStatus').textContent = '✅ Saved.'; });
  PLQ('#plSyncBtn').addEventListener('click', async () => { const b = PLQ('#plSyncBtn'); b.disabled = true; PLQ('#plHistStatus').textContent = 'Checking SharePoint…'; try { const r = await plSync(true); await plHistRender(); PLQ('#plHistStatus').textContent = `✅ ${r.remote} snapshot(s) in SharePoint, ${r.fetched} downloaded to this browser.`; } catch (e) { PLQ('#plHistStatus').textContent = '✘ ' + e.message; } finally { b.disabled = false; } });
  PLQ('#plImportBtn').addEventListener('click', () => PLQ('#plImportInput').click());
  PLQ('#plImportInput').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const s = JSON.parse(await f.text()); if (!s.asOf || !s.cols || !s.rows) throw new Error('This is not a Planning snapshot file.'); await plPut(s); await plHistRender(); PLQ('#plHistStatus').textContent = `✅ Imported ${s.asOf}.`; } catch (x) { PLQ('#plHistStatus').textContent = '✘ ' + x.message; } });
  PLQ('#plHistBody').addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return; const d = b.closest('tr').dataset.d, act = b.dataset.act;
    if (act === 'open') { plCfgSave({ sel: d }); plGo('planning'); }
    else if (act === 'json') { const s = await plGet(d); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(s)], { type: 'application/json' })); a.download = plFile(d); document.body.appendChild(a); a.click(); a.remove(); }
    else if (act === 'push') { b.disabled = true; try { const s = await plGet(d); await plSpSave(s); s.remote = true; await plPut(s); PLQ('#plHistStatus').textContent = `✅ ${d} shared in SharePoint.`; await plHistRender(); } catch (x) { PLQ('#plHistStatus').textContent = '✘ ' + x.message; b.disabled = false; } }
    else if (act === 'del') { if (!hasPerm('planning-upload')) { alert('Permission denied.'); return; } if (confirm(`Delete the ${d} snapshot from this browser? (A copy in SharePoint is not touched.)`)) { await plDel(d); await plHistRender(); } }
  });
  plHistRender();
}
function plGo(view) { const it = document.querySelector(`.nav-item[data-view="${view}"]`); if (it) it.click(); }


/* ============================================================
   PLANNING DEPT. — model, derived metrics, dynamic filters
   ============================================================ */
const pl = { dates: [], map: new Map(), cur: null, date: '', prev: null, rows: [], view: [], conds: [], q: [], ready: false, uid: 0 };
const PL_DIM_KEYS = ['status', 'brand', 'subBrand', 'size', 'type', 'tax', 'secFmt', 'priPack', 'secPack', 'uom', '_health', '_paceClass'];
const PL_SKIPDIM = new Set(['code', 'item', 'prodDates', 'relDates', '_flags']);
const PL_COL = () => pl.colMap || {};
function plThr() { const t = plCfg().thr || {}; return { crit: +t.crit || 7, low: +t.low || 15, high: +t.high || 45 }; }
function plHealthDefs() {
  const t = plThr(), b = (document.body.classList.contains('dark') ? '#3987e5' : '#2a78d6');
  return [
    { k: 'Out of stock', c: '#d03b3b', g: '✖' }, { k: `Critical (<${t.crit}d)`, c: '#ec835a', g: '▲' }, { k: `Low (${t.crit}–${t.low}d)`, c: '#fab219', g: '◆' },
    { k: `Healthy (${t.low}–${t.high}d)`, c: '#0ca30c', g: '✔' }, { k: `Excess (>${t.high}d)`, c: b, g: '⬆' }, { k: 'No demand', c: '#8a8886', g: '–' }];
}
const PL_PACE = [{ k: 'Behind (<80%)', c: '#ec835a', g: '▼' }, { k: 'On track (80–120%)', c: '#0ca30c', g: '●' }, { k: 'Ahead (>120%)', c: '#2a78d6', g: '▲' }, { k: 'n/a', c: '#8a8886', g: '–' }];

function plDerive(o, tg) {
  const t = plThr(), rel = o.releasedSOH || 0, fc = o.monthlyFcst || 0, doc = o.docReleased || 0, H = plHealthDefs();
  o._health = (rel <= 0 && fc > 0) ? H[0].k : (fc <= 0 ? H[5].k : doc < t.crit ? H[1].k : doc < t.low ? H[2].k : doc <= t.high ? H[3].k : H[4].k);
  const pm = o.pctMtd != null ? o.pctMtd : (fc > 0 ? (o.mtdSales || 0) / fc : null);
  o._paceIdx = (tg > 0 && fc > 0 && pm != null) ? pm / tg : null;
  o._paceClass = o._paceIdx == null ? PL_PACE[3].k : o._paceIdx < 0.8 ? PL_PACE[0].k : o._paceIdx <= 1.2 ? PL_PACE[1].k : PL_PACE[2].k;
  o._projSales = tg > 0 ? (o.mtdSales || 0) / tg : null;
  o._projPct = (o._projSales != null && fc > 0) ? o._projSales / fc : null;
  o._incubShare = (o.totalSOH || 0) > 0 ? (o.incubation || 0) / o.totalSOH : null;
  const f = []; if ((o.incubation || 0) > 0) f.push('In incubation'); if ((o.onHold || 0) > 0) f.push('On hold'); if ((o.nearExpiry || 0) > 0) f.push('Near expiry'); if (/in\s*active/i.test(o.status || '')) f.push('Inactive');
  o._flags = f.join('; ') || null; return o;
}
function plObjs(snap) {
  const key = JSON.stringify(plThr()); if (snap._objs && snap._thr === key) return snap._objs;
  snap._objs = snap.rows.map(a => { const o = {}; snap.cols.forEach((c, i) => { o[c.key] = a[i]; }); return plDerive(o, snap.timeGone); }); snap._thr = key; return snap._objs;
}
function plAllCols(snap) { return snap.cols.concat(PL_DERIVED.filter(d => snap.cols.length)); }
async function plLoadAll(sel) {
  const all = (await plAll()).filter(s => s && s.asOf && s.cols && s.rows).sort((a, b) => a.asOf.localeCompare(b.asOf));
  pl.map = new Map(all.map(s => [s.asOf, s])); pl.dates = all.map(s => s.asOf);
  const want = sel || plCfg().sel; pl.date = pl.map.has(want) ? want : (pl.dates[pl.dates.length - 1] || '');
  plSetCur();
}
function plSetCur() {
  pl.cur = pl.map.get(pl.date) || null; const i = pl.dates.indexOf(pl.date); pl.prev = i > 0 ? pl.map.get(pl.dates[i - 1]) : null;
  if (!pl.cur) { pl.rows = []; return; }
  pl.rows = plObjs(pl.cur); pl.colMap = {}; plAllCols(pl.cur).forEach(c => { pl.colMap[c.key] = c; });
}

