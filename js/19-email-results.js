/* ============================================================
   EMAIL RESULTS — standalone view
   Reuses the expEmail_* modal and helpers, with its own state.
   ============================================================ */
const emlState = {
  allItems: [],
  allColumns: [],
  selectedColumns: [],
  filters: [],
  preFilters: [],
  filteredItems: [],
  siteId: null,
  listId: null,
  columnsLoadedFor: '',
  valueCache: {},
  valueCacheMeta: null,
  valueCacheLoading: false,
  listPicker: null,
};

let emlLoadProgress = null;
let emlPicker = null;

function eml_ensureProgress() {
  if (!emlLoadProgress) emlLoadProgress = new ProgressBar('emlLoadProgress');
  return emlLoadProgress;
}
function eml_setLoadStatus(msg) {
  const el = $('emlLoadStatus');
  if (el) el.textContent = msg || '';
}
function eml_setStatus(msg, type) {
  const el = $('emlStatus');
  if (!el) return;
  el.className = 'status-msg ' + (type || 'info');
  el.textContent = msg || '';
}
function eml_log(msg) {
  console.log('[emailer] ' + msg);
}

/* ---------- List picker ---------- */
function eml_initListPicker() {
  const host = document.querySelector('[data-list-picker="emailer"]');
  if (!host || emlState.listPicker) return;
  emlState.listPicker = createListPicker(host, {
    getSiteUrl: () => getGlobalSiteUrl(),
    getToken: () => getGlobalAccessToken(),
    initialValue: emlState.columnsLoadedFor || '',
    onChange: (val) => {
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
      $('emlPreFilterSection').style.display = 'none';
      $('emlFilterSection').style.display = 'none';
      $('emlColumnsSection').style.display = 'none';
      $('emlPreviewSection').style.display = 'none';
      $('emlComposeSection').style.display = 'none';
      eml_setLoadStatus('');
      eml_setStatus('');
    },
  });
}

/* ---------- Pre-filter rendering (mirrors exporter) ---------- */
function eml_getFilterableColumns() {
  const disallowed = new Set(['lookup', 'personOrGroup', 'term', 'hyperlinkOrPicture', 'calculated', 'computed', 'geolocation', 'location']);
  return emlState.allColumns.filter(c => {
    const t = c.type || c.kind || 'text';
    if (disallowed.has(t)) return false;
    return EXP_FILTERABLE_TYPES.has(t);
  });
}
function eml_makeValueField(f, colDef, enabled) {
  const wrap = document.createElement('div');
  wrap.style.width = '100%';
  if (!enabled) {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = '(not needed)'; inp.disabled = true; inp.style.margin = '0';
    wrap.appendChild(inp);
    return wrap;
  }
  const type = (colDef && (colDef.type || colDef.kind)) || 'text';
  if (type === 'number' && !['eq', 'ne'].includes(f.op)) {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = 'any'; inp.placeholder = 'Number…';
    inp.value = f.value == null ? '' : f.value; inp.style.margin = '0';
    inp.addEventListener('input', () => { f.value = inp.value; eml_updatePreFilterQuery(); });
    wrap.appendChild(inp); return wrap;
  }
  if (type === 'date') {
    const kind = dateKindOf(colDef, emlState.valueCache[f.field]);
    const { inp, initial } = buildDateInput(kind, filterVals(f)[0], v => { setFilterVals(f, v ? [v] : []); eml_updatePreFilterQuery(); });
    if (initial !== filterVals(f)[0]) setFilterVals(f, initial ? [initial] : []);
    wrap.appendChild(inp);
    return wrap;
  }
  if (type === 'boolean') {
    const sel = document.createElement('select');
    sel.style.margin = '0';
    sel.innerHTML = `<option value="">— select —</option><option value="true">Yes</option><option value="false">No</option>`;
    sel.value = f.value == null ? '' : String(f.value);
    sel.addEventListener('change', () => { f.value = sel.value; eml_updatePreFilterQuery(); });
    wrap.appendChild(sel); return wrap;
  }
  wrap.appendChild(buildMultiCombo(filterVals(f), ddOpts(emlState.columnsLoadedFor || '', f.field, emlState.valueCache[f.field] || []), arr => { setFilterVals(f, arr); eml_updatePreFilterQuery(); },
    { placeholder: emlState.valueCacheLoading ? 'Loading values…' : (emlState.valueCache[f.field] ? 'Type to search or pick values…' : 'Type a value, press Enter') }));
  return wrap;
}
function eml_renderPreFilters() {
  const c = $('emlPreFiltersContainer');
  if (!c) return;
  c.innerHTML = '';
  const filterable = eml_getFilterableColumns();
  if (!filterable.length) {
    c.innerHTML = '<p class="text-sm" style="margin:4px 0;">Load columns first, then you can add pre-filters.</p>';
    eml_updatePreFilterQuery(); return;
  }
  emlState.preFilters.forEach((f, idx) => {
    const row = document.createElement('div');
    row.className = 'exp-prefilter-row';
    const colDef = emlState.allColumns.find(x => x.name === f.field) || { type: 'text' };
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
    const valueWrap = row.querySelector('.pf-value-wrap');
    valueWrap.appendChild(eml_makeValueField(f, colDef, needsValue));
    row.querySelector('.pf-field').addEventListener('change', (e) => {
      f.field = e.target.value; setFilterVals(f, []);
      const newColDef = emlState.allColumns.find(x => x.name === f.field) || { type: 'text' };
      valueWrap.innerHTML = '';
      valueWrap.appendChild(eml_makeValueField(f, newColDef, !['isEmpty', 'isNotEmpty'].includes(f.op)));
      eml_updatePreFilterQuery();
    });
    row.querySelector('.pf-op').addEventListener('change', (e) => {
      f.op = e.target.value;
      const n = !['isEmpty', 'isNotEmpty'].includes(f.op);
      valueWrap.innerHTML = '';
      valueWrap.appendChild(eml_makeValueField(f, colDef, n));
      eml_updatePreFilterQuery();
    });
    row.querySelector('button[data-action="remove"]').addEventListener('click', () => {
      emlState.preFilters = emlState.preFilters.filter(x => x.id !== f.id);
      eml_renderPreFilters();
    });
    c.appendChild(row);
  });
  const countEl = $('emlPreFilterCount');
  if (countEl) countEl.textContent = emlState.preFilters.length ? `${emlState.preFilters.length} condition${emlState.preFilters.length > 1 ? 's' : ''}` : '';
  eml_updatePreFilterQuery();
}
function eml_colType(name) {
  const col = emlState.allColumns.find(c => c.name === name);
  if (!col) return 'text';
  return col.type || col.kind || 'text';
}
function eml_isServerFilterable(colName, op) {
  const t = eml_colType(colName);
  if (['multiline','lookup','personOrGroup','term','hyperlinkOrPicture','calculated','computed','geolocation','location'].includes(t)) return false;
  if (t === 'boolean' && !['eq','ne'].includes(op)) return false;
  if ((t === 'number' || t === 'date') && ['contains','notContains','startsWith','endsWith','isEmpty','isNotEmpty'].includes(op)) return false;
  return true;
}
function eml_buildODataClauseOne(f) {
  if (!f || !f.field || !f.op) return null;
  const t = eml_colType(f.field);
  const fieldPath = `fields/${f.field}`;
  const raw = f.value == null ? '' : String(f.value);
  const q = exp_escapeODataString(raw);
  if (!eml_isServerFilterable(f.field, f.op)) return null;
  if (f.op === 'isEmpty')    return `(${fieldPath} eq null)`;
  if (f.op === 'isNotEmpty') return `(${fieldPath} ne null)`;
  if (f.op === 'contains')    return `substringof('${q}',${fieldPath})`;
  if (f.op === 'notContains') return `not substringof('${q}',${fieldPath})`;
  if (f.op === 'startsWith')  return `startswith(${fieldPath},'${q}')`;
  if (f.op === 'endsWith')    return `endswith(${fieldPath},'${q}')`;
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
  return `${fieldPath} ${odOp(f.op)} '${q}'`;
}
function eml_buildODataClause(f) {
  if (!f || !f.field || !f.op) return null;
  const vals = filterVals(f);
  if (['isEmpty', 'isNotEmpty'].includes(f.op) || vals.length <= 1) return eml_buildODataClauseOne({ ...f, value: vals.length ? vals[0] : '' });
  const parts = vals.map(v => eml_buildODataClauseOne({ ...f, value: v })).filter(Boolean);
  if (!parts.length) return null;
  return '(' + parts.join(['ne', 'notContains'].includes(f.op) ? ' and ' : ' or ') + ')';
}
function eml_buildODataFilter() {
  if (!emlState.preFilters.length) return '';
  const parts = [];
  for (const f of emlState.preFilters) {
    if (!f || !f.field || !f.op) continue;
    const clause = eml_buildODataClause(f);
    if (clause) parts.push(clause);
  }
  return parts.length ? parts.join(' and ') : '';
}
function eml_updatePreFilterQuery() {
  const el = $('emlPreFilterQuery');
  if (!el) return;
  const q = eml_buildODataFilter();
  if (!q) { el.textContent = ''; return; }
  el.innerHTML = `Will send: <code>$filter=${escapeHtml(q)}</code>`;
}

/* ---------- Post-load filters ---------- */
function eml_renderFilters() {
  const c = $('emlFiltersContainer');
  if (!c) return;
  c.innerHTML = '';
  if (!emlState.filters.length) { c.innerHTML = '<p class="text-sm" style="margin:4px 0;">No filters applied.</p>'; eml_updateFilterSummary(); return; }
  const filterable = emlState.allColumns.filter(c => emlState.allItems.some(it => it.fields?.[c.name] !== undefined && it.fields[c.name] !== null && it.fields[c.name] !== ''));
  emlState.filters.forEach((f, idx) => {
    const row = document.createElement('div');
    row.className = 'filter-row';
    const fieldOpts = filterable.map(c => `<option value="${escapeHtml(c.name)}" ${f.field === c.name ? 'selected' : ''}>${escapeHtml(c.displayName)}</option>`).join('');
    const ops = [
      { v: 'contains', l: 'contains' }, { v: 'notContains', l: 'does not contain' }, { v: 'equals', l: 'equals' }, { v: 'notEquals', l: 'does not equal' },
      { v: 'startsWith', l: 'starts with' }, { v: 'endsWith', l: 'ends with' }, { v: 'isEmpty', l: 'is empty' }, { v: 'isNotEmpty', l: 'is not empty' },
      { v: 'gt', l: '>' }, { v: 'lt', l: '<' }, { v: 'gte', l: '≥' }, { v: 'lte', l: '≤' },
    ];
    const opOpts = ops.map(o => `<option value="${o.v}" ${f.op === o.v ? 'selected' : ''}>${o.l}</option>`).join('');
    const needsValue = !['isEmpty', 'isNotEmpty'].includes(f.op);
    row.innerHTML = `
      <div>${idx > 0 ? '<span class="op-badge">AND</span>' : ''}<select class="f-field" data-id="${f.id}" style="margin:0;">${fieldOpts}</select></div>
      <select class="f-op" data-id="${f.id}" style="margin:0;">${opOpts}</select>
      <div class="f-value-wrap"></div>
      <button class="danger small icon-only" data-id="${f.id}" data-action="remove" type="button">✖</button>`;
    const vw = row.querySelector('.f-value-wrap');
    const rebuildVal = () => { vw.innerHTML = ''; vw.appendChild(buildFilterValueControl(f, distinctFieldValues(emlState.allItems, f.field), !['isEmpty', 'isNotEmpty'].includes(f.op), eml_applyFiltersAndPreview, emlState.allColumns.find(c => c.name === f.field))); };
    rebuildVal();
    row.querySelector('.f-field').addEventListener('change', (e) => { f.field = e.target.value; setFilterVals(f, []); rebuildVal(); eml_applyFiltersAndPreview(); });
    row.querySelector('.f-op').addEventListener('change', (e) => { f.op = e.target.value; if (['isEmpty', 'isNotEmpty'].includes(f.op)) setFilterVals(f, []); rebuildVal(); eml_applyFiltersAndPreview(); });

    row.querySelector('button[data-action="remove"]').addEventListener('click', () => { emlState.filters = emlState.filters.filter(x => x.id !== f.id); eml_renderFilters(); eml_applyFiltersAndPreview(); });
    c.appendChild(row);
  });
  eml_updateFilterSummary();
}
function eml_updateFilterSummary() {
  const el = $('emlFilterSummary');
  if (!el) return;
  el.textContent = emlState.filters.length ? `${emlState.filters.length} condition${emlState.filters.length > 1 ? 's' : ''}` : '';
}
function eml_itemMatchesFilters(item, fl) {
  if (!fl.length) return true;
  return fl.every(f => multiMatch(item.fields?.[f.field], f));
}
function eml_applyFiltersAndPreview() {
  emlState.filteredItems = emlState.allItems.filter(it => eml_itemMatchesFilters(it, emlState.filters));
  eml_renderPreview();
}
function eml_renderPreview() {
  const head = $('emlDataHead'), body = $('emlDataBody');
  const cols = emlState.selectedColumns.map(n => emlState.allColumns.find(c => c.name === n)).filter(Boolean);
  if (!cols.length) {
    head.innerHTML = '';
    body.innerHTML = '<tr><td style="padding:20px;text-align:center;color:var(--gray-400);">No columns selected.</td></tr>';
    $('emlPreviewCount').textContent = '0 rows';
    return;
  }
  head.innerHTML = '<tr>' + cols.map(c => `<th>${escapeHtml(c.displayName)}</th>`).join('') + '</tr>';
  const preview = emlState.filteredItems.slice(0, 100);
  if (!preview.length) body.innerHTML = `<tr><td colspan="${cols.length}" style="padding:20px;text-align:center;color:var(--gray-400);">No rows match.</td></tr>`;
  else body.innerHTML = preview.map(it => `<tr data-eml-id="${escapeHtml(String(it.id))}">` + cols.map(c => { const v = it.fields?.[c.name]; return `<td title="${escapeHtml(v)}">${escapeHtml(truncate(v, 80))}</td>`; }).join('') + '</tr>').join('');
  $('emlPreviewCount').textContent = `${emlState.filteredItems.length} row${emlState.filteredItems.length !== 1 ? 's' : ''}`;
}

/* ---------- Column selector ---------- */
function eml_renderColumnSelector() {
  const grid = $('emlColsGrid');
  grid.innerHTML = '';
  const usable = emlState.allColumns.filter(c => emlState.allItems.some(it => it.fields?.[c.name] !== undefined && it.fields[c.name] !== null && it.fields[c.name] !== ''));
  usable.forEach(col => {
    const label = document.createElement('label');
    label.className = 'col-check';
    const checked = emlState.selectedColumns.includes(col.name);
    label.innerHTML = `<input type="checkbox" value="${escapeHtml(col.name)}" ${checked ? 'checked' : ''} /><span>${escapeHtml(col.displayName)}</span><span class="internal">${escapeHtml(col.name)}</span>`;
    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) { if (!emlState.selectedColumns.includes(col.name)) emlState.selectedColumns.push(col.name); }
      else emlState.selectedColumns = emlState.selectedColumns.filter(n => n !== col.name);
      eml_updateColsSummary();
      eml_applyFiltersAndPreview();
    });
    grid.appendChild(label);
  });
  eml_updateColsSummary();
}
function eml_updateColsSummary() {
  const el = $('emlColsSummary');
  if (el) el.textContent = `${emlState.selectedColumns.length} selected`;
}

/* ---------- Value cache ---------- */
async function eml_loadValueCache(siteId, listId, token) {
  emlState.valueCache = {};
  emlState.valueCacheMeta = null;
  emlState.valueCacheLoading = true;
  eml_renderValueCacheInfo('loading');
  const listName = emlState.columnsLoadedFor || '';
  try {
    const items = await exp_fetchRecentSampleItems(siteId, listId, token, EXP_VALUE_SAMPLE_SIZE, n => {
      eml_setLoadStatus(`Sampling last ${EXP_VALUE_SAMPLE_SIZE} rows… (${n})`);
    });
    const sets = new Map();
    for (const it of items) {
      const f = it.fields || {};
      for (const col of emlState.allColumns) {
        const v = f[col.name];
        if (v === null || v === undefined) continue;
        const s = String(v).trim();
        if (!s) continue;
        if (!sets.has(col.name)) sets.set(col.name, new Set());
        const set = sets.get(col.name);
        if (set.size < EXP_VALUE_CACHE_LIMIT) set.add(s);
      }
    }
    let totalValues = 0;
    for (const [name, set] of sets) {
      const arr = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      emlState.valueCache[name] = arr;
      totalValues += arr.length;
    }
    emlState.valueCacheMeta = {
      at: Date.now(), rows: items.length,
      cols: Object.keys(emlState.valueCache).length,
      values: totalValues, listName,
    };
    eml_renderValueCacheInfo('ready');
  } catch (err) {
    console.warn('Emailer value cache load failed:', err.message);
    emlState.valueCache = {};
    emlState.valueCacheMeta = null;
    eml_renderValueCacheInfo('error');
  } finally {
    emlState.valueCacheLoading = false;
  }
}
function eml_renderValueCacheInfo(state) {
  const pill = $('emlValueCacheInfo');
  const meta = $('emlValueCacheMeta');
  if (!pill || !meta) return;
  if (state === 'loading' || emlState.valueCacheLoading) {
    pill.style.display = 'inline-flex';
    pill.textContent = '⏳ Loading suggestions…';
    pill.style.background = 'var(--warn-light)';
    pill.style.color = 'var(--warn)';
    meta.textContent = '';
    return;
  }
  if (!emlState.valueCacheMeta) {
    if (state === 'error') {
      pill.style.display = 'inline-flex';
      pill.textContent = '⚠ Suggestions failed to load';
      pill.style.background = 'var(--error-light)';
      pill.style.color = 'var(--error)';
      meta.textContent = 'Dropdowns fall back to plain text inputs.';
    } else { pill.style.display = 'none'; meta.textContent = ''; }
    return;
  }
  const m = emlState.valueCacheMeta;
  pill.style.display = 'inline-flex';
  pill.textContent = `✓ Suggestions: ${m.rows.toLocaleString()} rows · ${m.cols} cols · ${m.values.toLocaleString()} values`;
  pill.style.background = 'var(--success-light)';
  pill.style.color = 'var(--success)';
  meta.textContent = `Loaded for "${m.listName}" · sampled last ${m.rows.toLocaleString()} rows`;
}

/* ---------- Load ---------- */
$('emlLoadColumnsBtn').addEventListener('click', async () => {
  const siteUrl = getGlobalSiteUrl();
  const listName = emlState.listPicker?.getValue() || '';
  const token = getGlobalAccessToken();
  if (!siteUrl || !listName || !token) { eml_setLoadStatus('⚠ Global settings not configured'); return; }
  if (!isListVisible(listName)) { eml_setLoadStatus(`✘ No permission to access "${listName}"`); return; }
  $('emlLoadColumnsBtn').disabled = true;
  eml_setLoadStatus('Loading columns…');
  try {
    const { siteId, listId } = await resolveIds(siteUrl, listName, token);
    emlState.siteId = siteId;
    emlState.listId = listId;
    const cols = await fetchColumnsDetailed(siteId, listId, token);
    emlState.allColumns = cols.map(c => ({ name: c.name, displayName: c.displayName, type: c.type, dateOnly: c.dateOnly }));
    emlState.columnsLoadedFor = listName;
    eml_setLoadStatus(`✓ ${emlState.allColumns.length} columns loaded — building value cache…`);
    $('emlPreFilterSection').style.display = 'block';
    eml_renderPreFilters();
    await eml_loadValueCache(siteId, listId, token);
    eml_renderPreFilters();
    eml_renderValueCacheInfo('ready');
    eml_setLoadStatus(`✓ ${emlState.allColumns.length} columns ready — add pre-filters, then click Load Matching Rows`);
  } catch (err) {
    eml_setLoadStatus('✘ ' + err.message);
  } finally {
    $('emlLoadColumnsBtn').disabled = false;
  }
});

$('emlLoadAllBtn').addEventListener('click', async () => {
  const siteUrl = getGlobalSiteUrl();
  const listName = emlState.listPicker?.getValue() || '';
  const token = getGlobalAccessToken();
  if (!siteUrl || !listName || !token) { eml_setLoadStatus('⚠ Global settings not configured'); return; }
  if (!isListVisible(listName)) { eml_setLoadStatus(`✘ No permission to access "${listName}"`); return; }
  $('emlLoadAllBtn').disabled = true;
  eml_setLoadStatus('Fetching…');
  const prog = eml_ensureProgress();
  prog.start('Fetching all rows…', 0);
  try {
    const { siteId, listId } = await resolveIds(siteUrl, listName, token);
    emlState.siteId = siteId;
    emlState.listId = listId;
    const cols = await fetchColumnsDetailed(siteId, listId, token);
    emlState.allColumns = cols.map(c => ({ name: c.name, displayName: c.displayName, type: c.type, dateOnly: c.dateOnly }));
    emlState.columnsLoadedFor = listName;
    let items, partial = false;
    try {
      items = await exp_fetchFilteredItems(siteId, listId, token, '', n => {
        eml_setLoadStatus(`Fetching… ${n} items`);
        prog.update(n, 0, `${n} records downloaded`);
      });
    } catch (e) { if (e && e.cancelled && e.partial && e.partial.length) { items = e.partial; partial = true; prog.cancelled = false; } else throw e; }
    emlState.allItems = items;
    emlState.selectedColumns = emlState.allColumns
      .filter(c => items.some(it => it.fields?.[c.name] !== undefined && it.fields[c.name] !== null && it.fields[c.name] !== ''))
      .map(c => c.name);
    prog.finish(partial ? `⏹ Stopped — kept ${items.length} records` : `✅ Loaded ${items.length} records`);
    eml_setLoadStatus(`${partial ? '⏹ Stopped — ' : '✓ '}${items.length} items loaded${partial ? ' (partial — download was stopped)' : ''}`);
    emlState.preFilters = [];
    eml_renderPreFilters();
    $('emlPreFilterSection').style.display = 'block';
    $('emlFilterSection').style.display = 'block';
    $('emlColumnsSection').style.display = 'block';
    $('emlPreviewSection').style.display = 'block';
    $('emlComposeSection').style.display = 'block';
    eml_renderFilters();
    eml_renderColumnSelector();
    eml_applyFiltersAndPreview();
  } catch (err) {
    prog.error('✘ ' + err.message);
    eml_setLoadStatus('✘ ' + err.message);
  } finally {
    $('emlLoadAllBtn').disabled = false;
  }
});

$('emlApplyAndLoadBtn').addEventListener('click', async () => {
  if (!emlState.listId) { eml_setLoadStatus('⚠ Click "Load Columns" first.'); return; }
  const siteUrl = getGlobalSiteUrl();
  const token = getGlobalAccessToken();
  const listName = emlState.listPicker?.getValue() || '';
  if (!siteUrl || !token || !listName) { eml_setLoadStatus('⚠ Global settings not configured'); return; }
  const filterQ = eml_buildODataFilter();
  $('emlApplyAndLoadBtn').disabled = true;
  eml_setLoadStatus(filterQ ? 'Fetching matching rows…' : 'Fetching all rows…');
  const prog = eml_ensureProgress();
  prog.start(filterQ ? 'Fetching filtered data…' : 'Fetching data…', 0);
  try {
    let items, partial = false;
    try {
      items = await exp_fetchFilteredItems(emlState.siteId, emlState.listId, token, filterQ, n => {
        eml_setLoadStatus(`Fetching… ${n} items`);
        prog.update(n, 0, `${n} records downloaded`);
      });
    } catch (e) { if (e && e.cancelled && e.partial && e.partial.length) { items = e.partial; partial = true; prog.cancelled = false; } else throw e; }
    emlState.allItems = items;
    emlState.selectedColumns = emlState.allColumns
      .filter(c => items.some(it => it.fields?.[c.name] !== undefined && it.fields[c.name] !== null && it.fields[c.name] !== ''))
      .map(c => c.name);
    prog.finish(`✅ Loaded ${items.length} records`);
    eml_setLoadStatus(`${partial ? '⏹ Stopped — ' : '✓ '}${items.length} items loaded${partial ? ' (partial — download was stopped)' : ''}${filterQ ? ' (server-filtered)' : ''}`);
    $('emlFilterSection').style.display = 'block';
    $('emlColumnsSection').style.display = 'block';
    $('emlPreviewSection').style.display = 'block';
    $('emlComposeSection').style.display = 'block';
    eml_renderFilters();
    eml_renderColumnSelector();
    eml_applyFiltersAndPreview();
  } catch (err) {
    prog.error('✘ ' + err.message);
    eml_setLoadStatus('✘ ' + err.message);
  } finally {
    $('emlApplyAndLoadBtn').disabled = false;
  }
});

