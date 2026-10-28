/* ---------- Clear ---------- */
$('incUploadClearBtn').addEventListener('click', () => {
  incUploadState.parsedRows = [];
  incUploadState.parsedHeaders = [];
  incUploadState.newRows = [];
  incUploadState.mapping = {};
  incUploadState.fileName = '';
  incUploadState.parsedAt = 0;
  $('incUploadFileSummary').style.display = 'none';
  $('incUploadFileStatus').className = 'status-msg';
  $('incUploadFileStatus').textContent = '';
  $('incUploadSummaryCard').style.display = 'none';
  $('incUploadPreviewCard').style.display = 'none';
  $('incUploadMappingCard').style.display = 'none';
  $('incUploadUploadCard').style.display = 'none';
  $('incUploadLog').textContent = '';
  $('incUploadLog').style.display = 'none';
  inc_setStatus('');
  inc_renderKeyRows();
  inc_renderMapping();
  inc_updateReadySummary();
});

/* ---------- List picker + wire-up ---------- */
function inc_initListPicker() {
  const host = document.querySelector('[data-list-picker="incupload-target"]');
  if (!host || incUploadState.listPicker) return;
  incUploadState.listPicker = createListPicker(host, {
    getSiteUrl: () => getGlobalSiteUrl(),
    getToken: () => getGlobalAccessToken(),
    initialValue: incUploadState.listName || '',
    onChange: async (val) => {
      if (val === incUploadState.listName) return;
      incUploadState.listName = val;
      incUploadState.columns = [];
      incUploadState.columnsLoadedFor = '';
      inc_resetExistingCache();
      $('incUploadKeyCard').style.display = val ? 'block' : 'none';
      $('incUploadFileCard').style.display = val ? 'block' : 'none';
      if (val) {
        try { await inc_loadColumns(true); } catch (e) {}
        if (incUploadState.parsedRows.length) {
          inc_autoMap();
          inc_renderMapping();
          await inc_recomputeNewRows();
        }
      }
      inc_updateReadySummary();
    },
  });
}
/* ============================================================
   EXPORTER
   ============================================================ */
const expState = {
  allItems: [],
  allColumns: [],
  selectedColumns: [],
  filters: [],              // post-load (client-side) filters — unchanged
  preFilters: [],           // NEW: server-side filters
  filteredItems: [],
  lastConfig: null,
  listId: null,             // NEW: cached after Load Columns
  siteId: null,             // NEW
  columnsLoadedFor: '',     // NEW
  valueCache: {},           // NEW: { columnName: [distinctValue, ...] }
  valueCacheLoadedFor: '',  // NEW: which list the cache belongs to
  valueCacheLoading: false, // NEW
  valueCacheMeta: null,     // NEW: { at, rows, cols, values, listName }
};

const EXP_VALUE_SAMPLE_SIZE = 5000;   // how many recent rows to sample
const EXP_VALUE_CACHE_LIMIT = 200;    // max distinct values per column (else fallback to text)
let exporterPicker = null;
function e_log(msg) { const el = $('expLog'); el.style.display = 'block'; el.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`; el.scrollTop = el.scrollHeight; }
function e_setStatus(msg, type = 'info') { const el = $('expStatus'); el.className = 'status-msg ' + type; el.textContent = msg; }

/* ---------- PRE-LOAD FILTERS ---------- */
const EXP_PRE_OPS = [
  { v: 'eq',         l: '=' },
  { v: 'ne',         l: '≠' },
  { v: 'contains',   l: 'contains' },
  { v: 'notContains',l: 'does not contain' },
  { v: 'startsWith', l: 'starts with' },
  { v: 'endsWith',   l: 'ends with' },
  { v: 'isEmpty',    l: 'is empty' },
  { v: 'isNotEmpty', l: 'is not empty' },
  { v: 'gt',         l: '>' },
  { v: 'lt',         l: '<' },
  { v: 'gte',        l: '≥' },
  { v: 'lte',        l: '≤' },
];
// Only these column types can be used in a server-side $filter
const EXP_FILTERABLE_TYPES = new Set(['text', 'number', 'date', 'boolean', 'choice']);

function exp_getFilterableColumns() {
  const disallowed = new Set(['lookup', 'personOrGroup', 'term', 'hyperlinkOrPicture', 'calculated', 'computed', 'geolocation', 'location']);
  return expState.allColumns.filter(c => {
    const t = c.type || c.kind || 'text';
    if (disallowed.has(t)) return false;
    return EXP_FILTERABLE_TYPES.has(t);
  });
}

function exp_renderPreFilters() {
  const c = $('expPreFiltersContainer');
  if (!c) return;
  c.innerHTML = '';
  const filterable = exp_getFilterableColumns();
  if (!filterable.length) {
    c.innerHTML = '<p class="text-sm" style="margin:4px 0;">Load columns first, then you can add pre-filters.</p>';
    exp_updatePreFilterQuery();
    return;
  }
  expState.preFilters.forEach((f, idx) => {
    const row = document.createElement('div');
    row.className = 'exp-prefilter-row';

    const colDef = expState.allColumns.find(x => x.name === f.field) || { type: 'text' };
    const fieldOpts = filterable.map(col =>
      `<option value="${escapeHtml(col.name)}" ${f.field === col.name ? 'selected' : ''}>${escapeHtml(col.displayName || col.name)}</option>`
    ).join('');
    const opOpts = EXP_PRE_OPS.map(o =>
      `<option value="${o.v}" ${f.op === o.v ? 'selected' : ''}>${o.l}</option>`
    ).join('');
    const needsValue = !['isEmpty', 'isNotEmpty'].includes(f.op);

    row.innerHTML = `
      <div>${idx > 0 ? '<span class="op-badge">AND</span>' : ''}<select class="pf-field" data-id="${f.id}" style="margin:0;">${fieldOpts}</select></div>
      <select class="pf-op" data-id="${f.id}" style="margin:0;">${opOpts}</select>
      <div class="pf-value-wrap" data-id="${f.id}"></div>
      <button class="danger small icon-only" data-id="${f.id}" data-action="remove" type="button">✖</button>`;

    // Build the value field based on column type + cache
    const valueWrap = row.querySelector('.pf-value-wrap');
    valueWrap.appendChild(exp_makeValueField(f, colDef, needsValue));

    row.querySelector('.pf-field').addEventListener('change', (e) => {
      f.field = e.target.value; setFilterVals(f, []);
      const newColDef = expState.allColumns.find(x => x.name === f.field) || { type: 'text' };
      // Re-render only the value field for this row
      valueWrap.innerHTML = '';
      valueWrap.appendChild(exp_makeValueField(f, newColDef, !['isEmpty', 'isNotEmpty'].includes(f.op)));
      exp_updatePreFilterQuery();
    });
    row.querySelector('.pf-op').addEventListener('change', (e) => {
      f.op = e.target.value;
      const n = !['isEmpty', 'isNotEmpty'].includes(f.op);
      valueWrap.innerHTML = '';
      valueWrap.appendChild(exp_makeValueField(f, colDef, n));
      exp_updatePreFilterQuery();
    });
    row.querySelector('button[data-action="remove"]').addEventListener('click', () => {
      expState.preFilters = expState.preFilters.filter(x => x.id !== f.id);
      exp_renderPreFilters();
    });
    c.appendChild(row);
  });
  const countEl = $('expPreFilterCount');
  if (countEl) countEl.textContent = expState.preFilters.length ? `${expState.preFilters.length} condition${expState.preFilters.length > 1 ? 's' : ''}` : '';
  exp_updatePreFilterQuery();
}

/* Build the right input control for a filter's value */
function exp_makeValueField(f, colDef, enabled) {
  const wrap = document.createElement('div');
  wrap.style.width = '100%';
  if (!enabled) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = '(not needed)';
    inp.disabled = true;
    inp.style.margin = '0';
    wrap.appendChild(inp);
    return wrap;
  }
  const type = (colDef && (colDef.type || colDef.kind)) || 'text';

  // Numbers — plain number input
  if (type === 'number' && !['eq', 'ne'].includes(f.op)) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = 'any';
    inp.placeholder = 'Number…';
    inp.value = f.value == null ? '' : f.value;
    inp.style.margin = '0';
    inp.addEventListener('input', () => { f.value = inp.value; exp_updatePreFilterQuery(); });
    wrap.appendChild(inp);
    return wrap;
  }

  if (type === 'date') {
    const kind = dateKindOf(colDef, expState.valueCache[f.field]);
    const { inp, initial } = buildDateInput(kind, filterVals(f)[0], v => { setFilterVals(f, v ? [v] : []); exp_updatePreFilterQuery(); });
    if (initial !== filterVals(f)[0]) setFilterVals(f, initial ? [initial] : []);
    wrap.appendChild(inp);
    return wrap;
  }

  // Booleans — dropdown Yes/No
  if (type === 'boolean') {
    const sel = document.createElement('select');
    sel.style.margin = '0';
    sel.innerHTML = `<option value="">— select —</option><option value="true">Yes</option><option value="false">No</option>`;
    sel.value = f.value == null ? '' : String(f.value);
    sel.addEventListener('change', () => { f.value = sel.value; exp_updatePreFilterQuery(); });
    wrap.appendChild(sel);
    return wrap;
  }

  // Text / multiline / choice — searchable dropdown from cache, or text fallback
  wrap.appendChild(buildMultiCombo(filterVals(f), ddOpts(expState.columnsLoadedFor || '', f.field, expState.valueCache[f.field] || []), arr => { setFilterVals(f, arr); exp_updatePreFilterQuery(); },
    { placeholder: expState.valueCacheLoading ? 'Loading values…' : (expState.valueCache[f.field] ? 'Type to search or pick values…' : 'Type a value, press Enter') }));
  return wrap;
}
function exp_escapeODataString(s) {
  return String(s == null ? '' : s).replace(/'/g, "''");
}
function exp_colType(name) {
  const col = expState.allColumns.find(c => c.name === name);
  if (!col) return 'text';
  return col.type || col.kind || 'text';
}
/* Columns whose values can't be used in a Graph $filter on list items */
function exp_isServerFilterable(colName, op) {
  const t = exp_colType(colName);
  // Never filterable server-side
  if (['multiline', 'lookup', 'personOrGroup', 'term', 'hyperlinkOrPicture', 'calculated', 'computed', 'geolocation', 'location'].includes(t)) return false;
  // Boolean only supports eq/ne
  if (t === 'boolean' && !['eq', 'ne'].includes(op)) return false;
  // Number/date only support comparison ops (plus eq/ne)
  if ((t === 'number' || t === 'date') && ['contains', 'notContains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'].includes(op)) return false;
  return true;
}

function exp_buildODataClauseOne(f) {
  if (!f || !f.field || !f.op) return null;
  const t = exp_colType(f.field);
  const fieldPath = `fields/${f.field}`;
  const raw = f.value == null ? '' : String(f.value);
  const q = exp_escapeODataString(raw);

  // Guard: skip un-filterable combinations so we don't send a 400 to Graph
  if (!exp_isServerFilterable(f.field, f.op)) return null;

  // isEmpty / isNotEmpty
  if (f.op === 'isEmpty')    return `(${fieldPath} eq null)`;
  if (f.op === 'isNotEmpty') return `(${fieldPath} ne null)`;

  // String functions
  if (f.op === 'contains')    return `substringof('${q}',${fieldPath})`;
  if (f.op === 'notContains') return `not substringof('${q}',${fieldPath})`;
  if (f.op === 'startsWith')  return `startswith(${fieldPath},'${q}')`;
  if (f.op === 'endsWith')    return `endswith(${fieldPath},'${q}')`;

  // Typed comparisons
  if (t === 'number') {
    const n = parseFloat(raw);
    if (isNaN(n)) return null;
    return `${fieldPath} ${odOp(f.op)} ${n}`;
  }
  if (t === 'date') return odataDateClause(fieldPath, f.op, raw);
  if (t === 'boolean') {
    const b = raw.toLowerCase() === 'true' || raw === '1' || raw.toLowerCase() === 'yes';
    return `${fieldPath} ${odOp(f.op)} ${b}`;
  }

  // text / choice
  return `${fieldPath} ${odOp(f.op)} '${q}'`;
}

function exp_buildODataClause(f) {
  if (!f || !f.field || !f.op) return null;
  const vals = filterVals(f);
  if (['isEmpty', 'isNotEmpty'].includes(f.op) || vals.length <= 1) return exp_buildODataClauseOne({ ...f, value: vals.length ? vals[0] : '' });
  const parts = vals.map(v => exp_buildODataClauseOne({ ...f, value: v })).filter(Boolean);
  if (!parts.length) return null;
  return '(' + parts.join(['ne', 'notContains'].includes(f.op) ? ' and ' : ' or ') + ')';
}
function exp_buildODataFilter() {
  if (!expState.preFilters.length) return '';
  const parts = [];
  for (const f of expState.preFilters) {
    if (!f || !f.field || !f.op) continue;
    const clause = exp_buildODataClause(f);
    if (clause) parts.push(clause);
  }
  return parts.length ? parts.join(' and ') : '';
}


/* Warn the user when some filters had to be skipped for the server call */
function exp_getSkippedFiltersWarning() {
  const skipped = [];
  for (const f of expState.preFilters) {
    if (!f || !f.field || !f.op) continue;
    if (!filterVals(f).length && !['isEmpty', 'isNotEmpty'].includes(f.op)) continue;
    if (!exp_isServerFilterable(f.field, f.op)) {
      const t = exp_colType(f.field);
      skipped.push(`${f.field} (${t})`);
    }
  }
  return skipped;
}
function exp_updatePreFilterQuery() {
  const el = $('expPreFilterQuery');
  if (!el) return;
  const q = exp_buildODataFilter();
  const skipped = exp_getSkippedFiltersWarning();

  const skippedHtml = skipped.length
    ? `<div style="margin-top:4px;color:var(--warn);font-weight:600;">⚠ ${skipped.length} filter(s) can't be applied server-side: ${escapeHtml(skipped.join(', '))}. They will be ignored during the fetch — apply them as Post-Load Filters instead.</div>`
    : '';

  if (!q) {
    if (skipped.length) {
      el.innerHTML = `<span style="color:var(--warn);font-weight:600;">⚠ No valid server-side filter — fetching ALL rows.</span>${skippedHtml}`;
    } else {
      el.textContent = '';
    }
    return;
  }
  el.innerHTML = `Will send: <code>$filter=${escapeHtml(q)}</code>${skippedHtml}`;
}

const expTestFilterBtnEl = $('expTestFilterBtn');
if (expTestFilterBtnEl) expTestFilterBtnEl.addEventListener('click', async () => {
  if (!expState.siteId || !expState.listId) { alert('Click "Load Columns Only" first.'); return; }
  const token = getGlobalAccessToken();
  if (!token) { $('expLoadStatus').textContent = '⚠ Global token not configured'; return; }
  const filterQ = exp_buildODataFilter();
  if (!filterQ) { $('expLoadStatus').textContent = '⚠ No filter to test — add a pre-filter first.'; return; }
  const btn = $('expTestFilterBtn');
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Testing…';
  $('expLoadStatus').textContent = 'Testing $filter…';
  try {
    const url = `https://graph.microsoft.com/v1.0/sites/${expState.siteId}/lists/${expState.listId}/items?$expand=fields&$top=1&$filter=${encodeURIComponent(filterQ)}`;
    const TH = { headers: { Authorization: `Bearer ${token}`, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } }; let r = await fetchWithRetry(url, TH, 'test filter');
    if (r.status === 400 && odQuoteDates(filterQ) !== filterQ) { const r2 = await fetchWithRetry(url.replace(/\$filter=.*/, '$filter=' + encodeURIComponent(odQuoteDates(filterQ))), TH, 'test filter (quoted dates)'); if (r2.ok) r = r2; }
    if (!r.ok) {
      let e; try { e = await r.text(); } catch { e = r.statusText; }
      let parsed = null;
      try { parsed = JSON.parse(e); } catch {}
      const msg = parsed?.error?.message || e;
      $('expLoadStatus').textContent = `✘ Filter rejected by Graph (${r.status}): ${msg}`;
      e_log(`Test failed: HTTP ${r.status} — ${msg}`);
      e_log(`Filter was: ${filterQ}`);
    } else {
      const d = await r.json();
      const n = (d.value || []).length;
      $('expLoadStatus').textContent = `✅ Filter is valid — Graph returned ${n} row${n === 1 ? '' : 's'} (limit 1).`;
      e_log(`Test OK: ${filterQ}`);
    }
  } catch (err) {
    $('expLoadStatus').textContent = '✘ Test error: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});

$('expAddPreFilterBtn').addEventListener('click', () => {
  const cols = exp_getFilterableColumns();
  if (!cols.length) { alert('Load columns first.'); return; }
  expState.preFilters.push({ id: uid(), field: cols[0].name, op: 'eq', value: '' });
  exp_renderPreFilters();
});
$('expClearPreFiltersBtn').addEventListener('click', () => {
  expState.preFilters = [];
  exp_renderPreFilters();
});
$('expReloadValuesBtn').addEventListener('click', async () => {
  if (!expState.siteId || !expState.listId) { alert('Click "Load Columns Only" first.'); return; }
  const token = getGlobalAccessToken();
  if (!token) { $('expLoadStatus').textContent = '⚠ Global token not configured'; return; }
  const btn = $('expReloadValuesBtn');
  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = '⏳ Reloading…';
  try {
    await exp_loadValueCache(expState.siteId, expState.listId, token);
    exp_renderPreFilters(); // Re-render any open rows so they pick up the new dropdowns
    if (expState.valueCacheMeta) {
      $('expLoadStatus').textContent = `✓ Suggestions reloaded — ${expState.valueCacheMeta.values.toLocaleString()} values across ${expState.valueCacheMeta.cols} columns`;
    } else {
      $('expLoadStatus').textContent = '⚠ Suggestions reload failed — check the log';
    }
  } catch (err) {
    $('expLoadStatus').textContent = '✘ ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});

/* ---------- Load columns only ---------- */
$('expLoadColumnsBtn').addEventListener('click', async () => {
  const siteUrl = getGlobalSiteUrl();
  const listName = exporterPicker?.getValue() || '';
  const token = getGlobalAccessToken();
  if (!siteUrl || !listName || !token) { $('expLoadStatus').textContent = '⚠ Global settings not configured'; return; }
  if (!isListVisible(listName)) { $('expLoadStatus').textContent = `✘ You do not have permission to access "${listName}"`; return; }
  $('expLoadColumnsBtn').disabled = true;
  $('expLoadStatus').textContent = 'Loading columns…';
  try {
    const { siteId, listId } = await resolveIds(siteUrl, listName, token);
    expState.siteId = siteId;
    expState.listId = listId;
    const cols = await fetchColumnsDetailed(siteId, listId, token);
    expState.allColumns = cols.map(c => ({ name: c.name, displayName: c.displayName, type: c.type, dateOnly: c.dateOnly }));
    expState.columnsLoadedFor = listName;
    $('expLoadStatus').textContent = `✓ ${expState.allColumns.length} columns loaded — building value cache…`;
    $('expPreFilterSection').style.display = 'block';
    exp_renderPreFilters();
    e_log(`Loaded column names only (${expState.allColumns.length} columns) — no items fetched`);

    // Sample the last 5,000 items to populate the dropdowns
    await exp_loadValueCache(siteId, listId, token);

    // Re-render pre-filters so any filter added while loading now shows the dropdown
     exp_renderPreFilters();
    exp_renderValueCacheInfo('ready');
    $('expLoadStatus').textContent = `✓ ${expState.allColumns.length} columns loaded — add pre-filters, then click Load Matching Rows${expState.valueCacheMeta ? '' : ' (suggestions unavailable — type a value and press Enter)'}`;
  } catch (err) {
    $('expLoadStatus').textContent = '✘ ' + err.message;
  } finally {
    $('expLoadColumnsBtn').disabled = false;
  }
});

/* ---------- Apply pre-filters & fetch ---------- */
$('expApplyAndLoadBtn').addEventListener('click', async () => {
  if (!expState.listId) { alert('Click "Load Columns Only" first.'); return; }
  const siteUrl = getGlobalSiteUrl();
  const token = getGlobalAccessToken();
  const listName = exporterPicker?.getValue() || '';
  if (!siteUrl || !token || !listName) { $('expLoadStatus').textContent = '⚠ Global settings not configured'; return; }
  const filterQ = exp_buildODataFilter();
  $('expApplyAndLoadBtn').disabled = true;
  $('expLoadStatus').textContent = filterQ ? 'Fetching matching rows…' : 'Fetching all rows…';
  expLoadProgress.start(filterQ ? 'Fetching filtered data…' : 'Fetching data from SharePoint…', 0);
  try {
    let items, partial = false;
    try { items = await exp_fetchFilteredItems(expState.siteId, expState.listId, token, filterQ,
      n => { $('expLoadStatus').textContent = `Fetching… ${n} items`; expLoadProgress.update(n, 0, `${n} records downloaded`); }
    ); } catch (e) { if (e && e.cancelled && e.partial && e.partial.length) { items = e.partial; partial = true; expLoadProgress.cancelled = false; } else throw e; }
    expState.allItems = items;
    expLoadProgress.update(items.length, items.length, `${items.length} records ready`);
    expLoadProgress.finish(partial ? `⏹ Stopped — kept ${items.length} records already downloaded` : `✅ Loaded ${items.length} records`);
    $('expLoadStatus').textContent = `${partial ? '⏹ Stopped — ' : '✓ '}${items.length} items loaded${partial ? ' (partial — download was stopped)' : ''}${filterQ ? ' (server-filtered)' : ''}`;
    $('navExporterBadge').textContent = items.length + ' rows';
    // Default selected columns = columns that have any non-empty value in the loaded set
    expState.selectedColumns = expState.allColumns
      .filter(c => items.some(it => it.fields?.[c.name] !== undefined && it.fields[c.name] !== null && it.fields[c.name] !== ''))
      .map(c => c.name);
    e_log(`Fetched ${items.length} items${filterQ ? ' with $filter=' + filterQ : ''}`);
    e_renderFilters();
    e_renderColumnSelector();
    e_applyFiltersAndPreview();
    $('expFilterSection').style.display = 'block';
    $('expColumnsSection').style.display = 'block';
    $('expPreviewSection').style.display = 'block';
    $('expExportSection').style.display = 'block';
    expState.lastConfig = { siteUrl, listName };
    if (partial) e_setStatus(`⏹ Download stopped — ${items.length} rows kept. You can preview, filter and export them now.`, 'warn');
  } catch (err) {
    if (err && err.cancelled) { $('expLoadStatus').textContent = '⏹ Download stopped by user — nothing was loaded.'; e_log('Download stopped by user'); expLoadProgress.error('Stopped by user'); addActivity('export', 'Download stopped by user'); return; }
    $('expLoadStatus').textContent = '✘ ' + err.message;
    e_log('ERROR: ' + err.message);
    expLoadProgress.error('✘ ' + err.message);
    addActivity('error', `Filtered load failed: ${err.message}`);
  } finally {
    $('expApplyAndLoadBtn').disabled = false;
  }
});

/* Fetch items with an optional OData $filter, paging through results */
const odQuoteDates = s => String(s).replace(/\b(ge|gt|le|lt|eq|ne) (\d{4}-\d\d-\d\dT[\d:.]+Z)/g, "$1 '$2'");
async function exp_fetchFilteredItems(siteId, listId, token, filterExpr, onProgress) {
  let quoted = false;
  const items = [];
  let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=200`;
  if (filterExpr) url += `&$filter=${encodeURIComponent(filterExpr)}`;
  while (url) {
    let r = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } }, 'fetch filtered items');
    if (r.status === 400 && filterExpr && !quoted && odQuoteDates(filterExpr) !== filterExpr) { quoted = true; filterExpr = odQuoteDates(filterExpr); url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=200&$filter=${encodeURIComponent(filterExpr)}`; r = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } }, 'fetch filtered items (quoted dates)'); }
    if (!r.ok) {
      let e; try { e = await r.text(); } catch { e = r.statusText; }
      if (r.status === 422 || /threshold|tooManyResources/i.test(e)) throw new Error('SharePoint blocked this filter: the list is over the list view threshold and the filtered column is not indexed. Index that column (List settings → Indexed columns) or filter on an indexed column such as Created or ID.');
      throw new Error(`Item fetch failed (${r.status}): ${e}`);
    }
    const d = await r.json();
    if (d.value) items.push(...d.value);
    _prog(onProgress, items);
    url = d['@odata.nextLink'] || null;
  }
  setThrottleState(false);
  return items;
}

