/* ---------- Value cache (last N records) ---------- */
/* ---------- Value cache (last N records) ---------- */
async function exp_loadValueCache(siteId, listId, token) {
  expState.valueCache = {};
  expState.valueCacheMeta = null;
  expState.valueCacheLoading = true;
  exp_renderValueCacheInfo('loading');
  const listName = expState.columnsLoadedFor || exporterPicker?.getValue() || '';
  try {
    expLoadProgress.start('Sampling recent rows for suggestions…', EXP_VALUE_SAMPLE_SIZE);
    let items, sampleStopped = false;
    try {
      items = await exp_fetchRecentSampleItems(siteId, listId, token, EXP_VALUE_SAMPLE_SIZE, n => {
        $('expLoadStatus').textContent = `Sampling last ${EXP_VALUE_SAMPLE_SIZE} rows… (${n})`;
        expLoadProgress.update(n, EXP_VALUE_SAMPLE_SIZE, `${n} rows sampled`);
      });
    } catch (e) {
      if (e && e.cancelled && e.partial && e.partial.length) { items = e.partial; sampleStopped = true; expLoadProgress.cancelled = false; }
      else throw e;
    }
    // Build distinct-value sets per column
    const sets = new Map(); // colName -> Set
    for (const it of items) {
      const f = it.fields || {};
      for (const col of expState.allColumns) {
        const v = f[col.name];
        if (v === null || v === undefined) continue;
        const s = String(v).trim();
        if (!s) continue;
        if (!sets.has(col.name)) sets.set(col.name, new Set());
        const set = sets.get(col.name);
        if (set.size < EXP_VALUE_CACHE_LIMIT) set.add(s);
      }
    }
    // Freeze into sorted arrays
    let totalValues = 0;
    for (const [name, set] of sets) {
      const arr = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      expState.valueCache[name] = arr;
      totalValues += arr.length;
    }
    expState.valueCacheLoadedFor = listId;
    expState.valueCacheMeta = {
      at: Date.now(),
      rows: items.length,
      cols: Object.keys(expState.valueCache).length,
      values: totalValues,
      listName,
    };
    e_log(`Value cache built from ${items.length} sample rows across ${expState.valueCacheMeta.cols} columns (${totalValues} distinct values)`);
    exp_renderValueCacheInfo('ready');
    if (sampleStopped) { e_log('Suggestion sampling stopped by user — using the rows sampled so far'); expLoadProgress.finish(`⏹ Stopped — suggestions built from ${items.length} sampled rows`); }
    else if (items._oldest) { e_log('⚠ The latest rows could not be read on this list — suggestions use the FIRST ' + items.length + ' rows. ' + (items._diag || []).join(' | ')); expLoadProgress.finish(`⚠ Suggestions built from the first ${items.length} rows (latest rows unavailable)`); }
    else { if (items._diag && items._diag.length) e_log('Latest-rows fallback used. ' + items._diag.join(' | ')); expLoadProgress.finish(`✅ Suggestions ready (${items.length} rows sampled)`); }
  } catch (err) {
    expLoadProgress.error(err && err.cancelled ? 'Stopped by user' : 'Suggestions failed: ' + err.message);
    console.warn('Value cache load failed:', err.message);
    e_log('Value cache load failed: ' + err.message);
    expState.valueCache = {};
    expState.valueCacheLoadedFor = '';
    expState.valueCacheMeta = null;
    exp_renderValueCacheInfo('error');
  } finally {
    expState.valueCacheLoading = false;
  }
}

/* ---------- Render the value cache info pill ---------- */
function exp_renderValueCacheInfo(state) {
  const pill = $('expValueCacheInfo');
  const meta = $('expValueCacheMeta');
  if (!pill || !meta) return;

  if (state === 'loading' || expState.valueCacheLoading) {
    pill.style.display = 'inline-flex';
    pill.textContent = '⏳ Loading suggestions…';
    pill.style.background = 'var(--warn-light)';
    pill.style.color = 'var(--warn)';
    meta.textContent = '';
    return;
  }

  if (!expState.valueCacheMeta) {
    if (state === 'error') {
      pill.style.display = 'inline-flex';
      pill.textContent = '⚠ Suggestions failed to load';
      pill.style.background = 'var(--error-light)';
      pill.style.color = 'var(--error)';
      meta.textContent = 'Dropdowns will fall back to plain text inputs — click Reload Suggestions to try again.';
    } else {
      pill.style.display = 'none';
      meta.textContent = '';
    }
    return;
  }

  const m = expState.valueCacheMeta;
  const ageSec = Math.round((Date.now() - m.at) / 1000);
  const ageLabel = ageSec < 60 ? `${ageSec}s ago`
                  : ageSec < 3600 ? `${Math.round(ageSec / 60)}m ago`
                  : `${Math.round(ageSec / 3600)}h ago`;
  pill.style.display = 'inline-flex';
  pill.textContent = `✓ Suggestions: ${m.rows.toLocaleString()} rows · ${m.cols} cols · ${m.values.toLocaleString()} values`;
  pill.style.background = 'var(--success-light)';
  pill.style.color = 'var(--success)';
  meta.innerHTML = `Loaded for <strong>${escapeHtml(m.listName)}</strong> · sampled last ${m.rows.toLocaleString()} rows · built ${ageLabel} · per-column cap ${EXP_VALUE_CACHE_LIMIT}`;

  // Live-update the age every 30s while the section is visible
  clearTimeout(exp_renderValueCacheInfo._t);
  if (document.getElementById('expPreFilterSection')?.style.display !== 'none') {
    exp_renderValueCacheInfo._t = setTimeout(() => exp_renderValueCacheInfo('ready'), 30000);
  }
}

/* Fetch only the last N items (fast, doesn't need full list) */
/* Latest rows when $orderby is blocked by the list view threshold. Tries in order:
   A) server paging by ID (skiptoken)  B) $filter on ID  C) scan IDs, resume from a server-issued nextLink  D) first rows (flagged) */
async function exp_sampleLatestByIdRange(base, hdr, limit, onProgress, diag) {
  const root = base.split('?')[0];
  const tok = n => encodeURIComponent(btoa(`Paged=TRUE&p_ID=${n}`));
  const get = async (url, what) => {
    const r = await fetchWithRetry(url, { headers: hdr }, what);
    if (!r.ok) { let t = ''; try { t = await r.text(); } catch (e) {} throw new Error(`HTTP ${r.status} ${t.replace(/\s+/g, ' ').slice(0, 110)}`); }
    return r.json();
  };
  const byIdDesc = (x, y) => Number(y.id) - Number(x.id);
  const methods = [
    ['skiptoken', n => `${root}?$expand=fields&$top=1&$skiptoken=${tok(n)}`, lo => `${base}&$top=500&$skiptoken=${tok(lo)}`],
    ['filter', n => `${root}?$expand=fields&$top=1&$filter=${encodeURIComponent('fields/ID gt ' + n)}`, (lo, hi) => `${base}&$top=500&$filter=${encodeURIComponent(`fields/ID gt ${lo} and fields/ID le ${hi}`)}`],
  ];
  for (const [name, probeUrl, segUrl] of methods) {
    try {
      const exists = async n => { const d = await get(probeUrl(n), 'probe latest id'); const v = d.value && d.value[0]; if (!v) return false; if (Number(v.id) <= n) throw new Error('ID paging not honoured'); return true; };
      let lo = 0, hi = 1024;
      while (await exists(hi)) { lo = hi; hi *= 4; if (hi > 1e9) break; }
      while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (await exists(mid)) lo = mid; else hi = mid; }
      const items = []; let upper = hi, chunks = 0; const W = Math.max(limit, 1000);
      while (upper > 0 && items.length < limit && chunks < 30) {
        const lower = Math.max(0, upper - W), chunk = []; let url = segUrl(lower, upper), done = false;
        while (url && !done) {
          const d = await get(url, 'fetch latest sample');
          for (const v of d.value || []) { const id = Number(v.id); if (id > upper) { done = true; break; } if (id > lower) chunk.push(v); }
          _prog(onProgress, items.concat(chunk));
          url = d['@odata.nextLink'] || null;
        }
        items.push(...chunk); upper = lower; chunks++;
      }
      items.sort(byIdDesc); const out = items.slice(0, limit); out._diag = diag; return out;
    } catch (e) { if (e && e.cancelled) throw e; diag.push(`${name}: ${e.message}`); }
  }
  try {   // C) scan IDs only (plain paging never hits the threshold), then resume from a nextLink the server issued
    let url = `${root}?$select=id&$top=999`, total = 0; const marks = [];
    while (url) { const d = await get(url, 'scan ids'); total += (d.value || []).length; const nx = d['@odata.nextLink'] || null; if (nx) marks.push({ total, nx }); url = nx; _prog(onProgress, []); }
    const target = total - Math.ceil(limit * 1.05); let mark = null; marks.forEach(m => { if (m.total <= target) mark = m; });
    url = mark ? mark.nx.replace(/(\$|%24)select=id/i, '$1expand=fields').replace(/(\$|%24)top=\d+/i, '$1top=500') : `${base}&$top=500`;
    const items = [];
    while (url) { const d = await get(url, 'fetch tail sample'); items.push(...(d.value || [])); _prog(onProgress, items); url = d['@odata.nextLink'] || null; }
    items.sort(byIdDesc); const out = items.slice(0, limit); out._diag = diag; return out;
  } catch (e) { if (e && e.cancelled) throw e; diag.push(`scan: ${e.message}`); }
  try {   // D) last resort: first rows (flagged so the UI can say so)
    let url = `${base}&$top=500`; const items = [];
    while (url && items.length < limit) { const d = await get(url, 'fetch first sample'); items.push(...(d.value || []).slice(0, limit - items.length)); _prog(onProgress, items); url = d['@odata.nextLink'] || null; }
    items._oldest = true; items._diag = diag; return items;
  } catch (e) { if (e && e.cancelled) throw e; diag.push(`first rows: ${e.message}`); }
  throw new Error('SharePoint blocked every sampling query (list view threshold), so suggestions are unavailable for this list. You can still type filter values and press Enter. [' + diag.join(' | ') + ']');
}
async function exp_fetchRecentSampleItems(siteId, listId, token, limit, onProgress) {
  const items = [], diag = [];
  const hdr = { Authorization: `Bearer ${token}`, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' };
  const base = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields`;
  const ladder = [2000, 500]; let step = 0;
  const mk = () => `${base}&$top=${Math.min(ladder[step], limit)}&$orderby=id desc`;
  let url = mk();
  while (url && items.length < limit) {
    const r = await fetchWithRetry(url, { headers: hdr }, 'fetch recent sample');
    if (!r.ok) {
      let e; try { e = await r.text(); } catch { e = r.statusText; }
      if (items.length) break;   // keep the rows sampled so far
      const threshold = r.status === 422 || /threshold|tooManyResources/i.test(e);
      diag.push(`orderby top=${ladder[step]}: HTTP ${r.status}`);
      if (threshold && step < ladder.length - 1) { step++; url = mk(); continue; }
      if (threshold) { const out = await exp_sampleLatestByIdRange(base, hdr, limit, onProgress, diag); setThrottleState(false); return out; }
      throw new Error(`Sample fetch failed (${r.status}): ${e}`);
    }
    const d = await r.json();
    if (d.value && d.value.length) items.push(...d.value.slice(0, limit - items.length));
    _prog(onProgress, items);
    url = d['@odata.nextLink'] || null;
  }
  setThrottleState(false);
  return items;
}

function e_log(msg) { const el = $('expLog'); el.style.display = 'block'; el.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`; el.scrollTop = el.scrollHeight; }
function e_setStatus(msg, type = 'info') { const el = $('expStatus'); el.className = 'status-msg ' + type; el.textContent = msg; }

$('expLoadBtn').addEventListener('click', async () => {
  const siteUrl = getGlobalSiteUrl();
  const listName = exporterPicker?.getValue() || '';
  const token = getGlobalAccessToken();
  if (!siteUrl || !listName || !token) { $('expLoadStatus').textContent = '⚠ Global settings not configured'; return; }
  if (!isListVisible(listName)) { $('expLoadStatus').textContent = `✘ You do not have permission to access "${listName}"`; return; }
  $('expLoadBtn').disabled = true; $('expLoadStatus').textContent = 'Loading...'; $('expLog').textContent = '';
  expLoadProgress.start('Fetching data from SharePoint...', 0);
  try {
    const { siteId, listId } = await resolveIds(siteUrl, listName, token);
    expState.siteId = siteId;
    expState.listId = listId;
    expState.columnsLoadedFor = listName;
    const cols = await fetchColumns(siteId, listId, token); expState.allColumns = cols;
    e_log(`Found ${cols.length} columns`);
    let items, partial = false;
    try { items = await fetchAllItems(siteId, listId, token, n => { $('expLoadStatus').textContent = `Fetching... ${n} items`; expLoadProgress.update(n, 0, `${n} records downloaded`); }); } catch (e) { if (e && e.cancelled && e.partial && e.partial.length) { items = e.partial; partial = true; expLoadProgress.cancelled = false; } else throw e; }
    expState.allItems = items; e_log(`Loaded ${items.length} items`);
    expLoadProgress.update(items.length, items.length, `${items.length} records ready`);
    expLoadProgress.finish(partial ? `⏹ Stopped — kept ${items.length} records already downloaded` : `✅ Loaded ${items.length} records`);
    $('expLoadStatus').textContent = `${partial ? '⏹ Stopped — ' : '✓ '}${items.length} items loaded${partial ? ' (partial — download was stopped)' : ''}`;
    $('navExporterBadge').textContent = items.length + ' rows';
    expState.selectedColumns = cols.filter(c => items.some(it => it.fields?.[c.name] !== undefined && it.fields[c.name] !== null && it.fields[c.name] !== '')).map(c => c.name);
    e_renderFilters(); e_renderColumnSelector(); e_applyFiltersAndPreview();
    $('expFilterSection').style.display = 'block'; $('expColumnsSection').style.display = 'block';
    $('expPreviewSection').style.display = 'block'; $('expExportSection').style.display = 'block';
    $('expPreFilterSection').style.display = 'block';
    exp_renderPreFilters();
    expState.lastConfig = { siteUrl, listName };
    if (partial) e_setStatus(`⏹ Download stopped — ${items.length} rows kept. You can preview, filter and export them now.`, 'warn');
  } catch (err) { $('expLoadStatus').textContent = '✘ ' + err.message; e_log('ERROR: ' + err.message); expLoadProgress.error('✘ ' + err.message); addActivity('error', `Load failed: ${err.message}`); }
  finally { $('expLoadBtn').disabled = false; }
});
function e_getFilterableColumns() { return expState.allColumns.filter(c => expState.allItems.some(it => it.fields?.[c.name] !== undefined && it.fields[c.name] !== null && it.fields[c.name] !== '')); }
function e_renderFilters() {
  const c = $('expFiltersContainer'); c.innerHTML = '';
  if (!expState.filters.length) { c.innerHTML = '<p class="text-sm" style="margin:4px 0;">No filters applied.</p>'; e_updateFilterSummary(); return; }
  const filterable = e_getFilterableColumns();
  expState.filters.forEach((f, idx) => {
    const row = document.createElement('div'); row.className = 'filter-row';
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
    const rebuildVal = () => { vw.innerHTML = ''; vw.appendChild(buildFilterValueControl(f, distinctFieldValues(expState.allItems, f.field), !['isEmpty', 'isNotEmpty'].includes(f.op), e_applyFiltersAndPreview, expState.allColumns.find(c => c.name === f.field))); };
    rebuildVal();
    row.querySelector('.f-field').addEventListener('change', (e) => { f.field = e.target.value; setFilterVals(f, []); rebuildVal(); e_applyFiltersAndPreview(); });
    row.querySelector('.f-op').addEventListener('change', (e) => { f.op = e.target.value; if (['isEmpty', 'isNotEmpty'].includes(f.op)) setFilterVals(f, []); rebuildVal(); e_applyFiltersAndPreview(); });

    row.querySelector('button[data-action="remove"]').addEventListener('click', () => { expState.filters = expState.filters.filter(x => x.id !== f.id); e_renderFilters(); e_applyFiltersAndPreview(); });
    c.appendChild(row);
  });
  e_updateFilterSummary();
}
function e_updateFilterSummary() { if (!expState.filters.length) { $('expFilterSummary').textContent = ''; return; } $('expFilterSummary').textContent = `${expState.filters.length} condition${expState.filters.length > 1 ? 's' : ''}`; }
$('expAddFilterBtn').addEventListener('click', () => { const f = e_getFilterableColumns(); if (!f.length) return; expState.filters.push({ id: uid(), field: f[0].name, op: 'contains', value: '' }); e_renderFilters(); e_applyFiltersAndPreview(); });
$('expClearFiltersBtn').addEventListener('click', () => { expState.filters = []; e_renderFilters(); e_applyFiltersAndPreview(); });
function e_matchFilter(fv0, op, fv1) {
  const fv = String(fv0 == null ? '' : fv0).toLowerCase(); const fvs = String(fv1 == null ? '' : fv1).toLowerCase();
  switch (op) {
    case 'contains': return fv.includes(fvs); case 'notContains': return !fv.includes(fvs);
    case 'equals': return fv === fvs; case 'notEquals': return fv !== fvs;
    case 'startsWith': return fv.startsWith(fvs); case 'endsWith': return fv.endsWith(fvs);
    case 'isEmpty': return fv === ''; case 'isNotEmpty': return fv !== '';
    case 'gt': return parseFloat(fv) > parseFloat(fvs); case 'lt': return parseFloat(fv) < parseFloat(fvs);
    case 'gte': return parseFloat(fv) >= parseFloat(fvs); case 'lte': return parseFloat(fv) <= parseFloat(fvs);
    default: return true;
  }
}
function e_itemMatchesFilters(item, fl) { if (!fl.length) return true; return fl.every(f => multiMatch(item.fields?.[f.field], f)); }
function e_renderColumnSelector() {
  const grid = $('expColsGrid'); grid.innerHTML = '';
  const usable = expState.allColumns.filter(c => expState.allItems.some(it => it.fields?.[c.name] !== undefined && it.fields[c.name] !== null && it.fields[c.name] !== ''));
  usable.forEach(col => {
    const label = document.createElement('label'); label.className = 'col-check';
    const checked = expState.selectedColumns.includes(col.name);
    label.innerHTML = `<input type="checkbox" value="${escapeHtml(col.name)}" ${checked ? 'checked' : ''} /><span>${escapeHtml(col.displayName)}</span><span class="internal">${escapeHtml(col.name)}</span>`;
    label.querySelector('input').addEventListener('change', (e) => { if (e.target.checked) { if (!expState.selectedColumns.includes(col.name)) expState.selectedColumns.push(col.name); } else expState.selectedColumns = expState.selectedColumns.filter(n => n !== col.name); e_updateColsSummary(); e_applyFiltersAndPreview(); });
    grid.appendChild(label);
  });
  e_updateColsSummary();
}
function e_updateColsSummary() { $('expColsSummary').textContent = `${expState.selectedColumns.length} selected`; }
$('expSelectAllBtn').addEventListener('click', () => { document.querySelectorAll('#expColsGrid input[type="checkbox"]').forEach(cb => { cb.checked = true; if (!expState.selectedColumns.includes(cb.value)) expState.selectedColumns.push(cb.value); }); e_updateColsSummary(); e_applyFiltersAndPreview(); });
$('expDeselectAllBtn').addEventListener('click', () => { document.querySelectorAll('#expColsGrid input[type="checkbox"]').forEach(cb => cb.checked = false); expState.selectedColumns = []; e_updateColsSummary(); e_applyFiltersAndPreview(); });
function e_applyFiltersAndPreview() { expState.filteredItems = expState.allItems.filter(it => e_itemMatchesFilters(it, expState.filters)); e_renderPreview(); }
function e_renderPreview() {
  const head = $('expDataHead'), body = $('expDataBody');
  const cols = expState.selectedColumns.map(n => expState.allColumns.find(c => c.name === n)).filter(Boolean);
  if (!cols.length) { head.innerHTML = ''; body.innerHTML = '<tr><td style="padding:20px;text-align:center;color:var(--gray-400);">No columns selected.</td></tr>'; $('expPreviewCount').textContent = '0 rows'; return; }
  head.innerHTML = '<tr><th title="Attachments / pictures">📎</th>' + cols.map(c => `<th>${escapeHtml(c.displayName)}</th>`).join('') + '</tr>';
  const preview = expState.filteredItems.slice(0, 100);
  if (!preview.length) body.innerHTML = `<tr><td colspan="${cols.length + 1}" style="padding:20px;text-align:center;color:var(--gray-400);">No rows match.</td></tr>`;
  else body.innerHTML = preview.map(it => `<tr data-exp-id="${escapeHtml(String(it.id))}"><td><button class="ghost tiny" type="button" data-att="exp:${escapeHtml(String(it.id))}" title="Show attachments / pictures"${it.fields && it.fields.Attachments === false ? ' style="opacity:.35"' : ''}>📎</button></td>` + cols.map(c => { const v = it.fields?.[c.name]; return `<td title="${escapeHtml(v)}">${escapeHtml(truncate(v, 80))}</td>`; }).join('') + '</tr>').join('');
  $('expPreviewCount').textContent = `${expState.filteredItems.length} row${expState.filteredItems.length !== 1 ? 's' : ''}`;
}
function e_buildExportRows() {
  const seen = {};
  const cols = expState.selectedColumns.map(n => expState.allColumns.find(c => c.name === n)).filter(Boolean)
    .map(c => { const base = c.displayName || c.name; seen[base] = (seen[base] || 0) + 1; return { ...c, displayName: seen[base] > 1 ? `${base} (${c.name})` : base }; });
  const rows = expState.filteredItems.map(it => { const r = {}; cols.forEach(c => { r[c.displayName] = it.fields?.[c.name] ?? ''; }); return r; });
  return { cols, rows };
}
/* Progress callback wrapper: on Stop, attach the rows downloaded so far so callers can keep them */
function _prog(onProgress, items) {
  if (!onProgress) return;
  try { onProgress(items.length); } catch (e) { if (e && e.cancelled) e.partial = items; throw e; }
}
/* Make any SharePoint value safe for a spreadsheet cell (arrays/objects → text, Excel's 32,767-char cell limit) */
function xlCell(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return xlCell(v.map(x => xlCell(x)).filter(x => x !== '').join('; '));
  if (v instanceof Date) return v;
  if (typeof v === 'object') return xlCell(v.LookupValue ?? v.Title ?? v.DisplayName ?? v.Email ?? v.Label ?? JSON.stringify(v));
  if (typeof v === 'string' && v.length > 32000) return v.slice(0, 32000) + '… [truncated]';
  return v;
}
async function buildWorkbookWithProgress(cols, rows, format) {
  const headers = cols.map(c => c.displayName);
  const total = rows.length;
  const batchSize = Math.max(1, Math.floor(total / 50));
  const data = [headers];
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    slice.forEach(r => data.push(headers.map(h => xlCell(r[h]))));
    const done = Math.min(i + batchSize, total);
    expExportProgress.update(done, total, `Preparing ${format.toUpperCase()}... ${done}/${total}`);
    await new Promise(r => setTimeout(r, 0));
  }
  return data;
}
$('expExcelBtn').addEventListener('click', async () => {
  if (!expState.filteredItems.length) { e_setStatus('No rows.', 'warn'); return; }
  if (!expState.selectedColumns.length) { e_setStatus('No columns selected.', 'warn'); return; }
  try {
    const { cols, rows } = e_buildExportRows();
    const listName = exporterPicker?.getValue() || 'Export';
    expExportProgress.start(`Building Excel file "${listName}.xlsx"...`, rows.length);
    const data = await buildWorkbookWithProgress(cols, rows, 'xlsx');
    expExportProgress.update(rows.length, rows.length, 'Writing file...');
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = cols.map(c => ({ wch: Math.max(12, Math.min(40, c.displayName.length + 6)) }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Export');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `${String(listName).replace(/[\\/:*?"<>|]+/g, '_')}_${ts}.xlsx`;
    XLSX.writeFile(wb, filename);
    expExportProgress.finish(`✅ Exported ${rows.length} rows to ${filename}`);
    e_setStatus(`✅ Exported ${rows.length} rows.`, 'success');
    addActivity('export', `Excel: ${rows.length} rows`);
  } catch (err) {
    if (err && err.cancelled) { expExportProgress.error('Stopped by user'); e_setStatus('⏹ Export stopped by user.', 'warn'); addActivity('export', 'Export stopped by user'); return; }
    expExportProgress.error('Export failed: ' + err.message);
    e_setStatus('Export failed: ' + err.message, 'error');
    addActivity('error', `Excel export: ${err.message}`);
    notifyFailure('Excel Export Failed', err.message);
  }
});
$('expCsvBtn').addEventListener('click', async () => {
  if (!expState.filteredItems.length) { e_setStatus('No rows.', 'warn'); return; }
  if (!expState.selectedColumns.length) { e_setStatus('No columns selected.', 'warn'); return; }
  try {
    const { cols, rows } = e_buildExportRows();
    const listName = exporterPicker?.getValue() || 'Export';
    expExportProgress.start(`Building CSV file "${listName}.csv"...`, rows.length);
    const data = await buildWorkbookWithProgress(cols, rows, 'csv');
    const esc = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = data.map(r => r.map(esc).join(','));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `${listName}_${ts}.csv`;
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    expExportProgress.finish(`✅ Exported ${rows.length} rows to ${filename}`);
    e_setStatus(`✅ Exported ${rows.length} rows to CSV.`, 'success');
    addActivity('export', `CSV: ${rows.length} rows`);
  } catch (err) {
    if (err && err.cancelled) { expExportProgress.error('Stopped by user'); e_setStatus('⏹ Export stopped by user.', 'warn'); addActivity('export', 'Export stopped by user'); return; }
    expExportProgress.error('Export failed: ' + err.message);
    e_setStatus('Export failed: ' + err.message, 'error');
    addActivity('error', `CSV export: ${err.message}`);
    notifyFailure('CSV Export Failed', err.message);
  }
});
$('expClearBtn').addEventListener('click', () => {
  expState.allItems = []; expState.allColumns = []; expState.selectedColumns = [];
  expState.filters = []; expState.filteredItems = []; expState.preFilters = [];
  expState.listId = null; expState.siteId = null; expState.columnsLoadedFor = '';
  expState.valueCache = {};
  expState.valueCacheMeta = null;
  $('expFilterSection').style.display = 'none'; $('expColumnsSection').style.display = 'none';
  $('expPreviewSection').style.display = 'none'; $('expExportSection').style.display = 'none';
  $('expPreFilterSection').style.display = 'none';
  exp_renderPreFilters();
  exp_renderValueCacheInfo('');
  $('expLoadStatus').textContent = ''; $('expStatus').className = 'status-msg'; $('expStatus').style.display = 'none';
  $('expLog').textContent = ''; $('expLog').style.display = 'none'; $('navExporterBadge').textContent = '—';
});

/* ============================================================
   RECORD EDITOR
   ============================================================ */
const editorState = {
  siteId: null, listId: null, siteUrl: '', listName: '',
  columns: [], items: [], selectedItemId: null,
  bulkSelected: new Set(), inlineDirty: new Map(), inlineNewRows: [],
  history: [], canEditThisList: true,
  suggestionItems: [],
  suggestionLoading: false,
  suggestionLoadedForList: '',
};
let editorPicker = null;

function ed_setStatus(msg, type = 'info') { const el = $('editorStatusBar'); el.className = 'status-msg ' + type; el.textContent = msg; }
function ed_setConnectStatus(msg, type = 'info') { const el = $('editorConnectStatus'); el.className = 'status-msg ' + type; el.textContent = msg; }

$('editorLoadBtn').addEventListener('click', async () => {
  const siteUrl = getGlobalSiteUrl();
  const listName = editorPicker?.getValue() || '';
  const token = getGlobalAccessToken();
  if (!siteUrl || !listName || !token) { ed_setConnectStatus('Global settings not configured.', 'warn'); return; }
  if (!isListVisible(listName)) { ed_setConnectStatus(`✘ You do not have permission to access "${listName}".`, 'error'); return; }
  const canEdit = isListEditable(listName);
  editorState.canEditThisList = canEdit;
  $('editorLoadBtn').disabled = true; ed_setConnectStatus('Connecting...', 'info');
  editorLoadProgress.start('Connecting and loading records...', 0);
  try {
    const { siteId, listId } = await resolveIds(siteUrl, listName, token);
    editorState.siteId = siteId; editorState.listId = listId;
    editorState.siteUrl = siteUrl; editorState.listName = listName;
    const cols = await fetchColumnsDetailed(siteId, listId, token);
    editorState.columns = cols.filter(c => !c.readOnly);
    ed_setConnectStatus(`✓ Connected. ${editorState.columns.length} editable fields.${canEdit ? '' : ' (Read-only)'}`, canEdit ? 'success' : 'warn');
    $('editorMainArea').style.display = 'block';
    editorState.items = []; editorState.selectedItemId = null; editorState.suggestionItems = []; editorState.suggestionLoadedForList = '';
    editorState.dl = { nextUrl: null, running: false, kind: '', complete: false }; editorState.qValues = [];
    ed_loadFieldCfg();
    ed_switchTab('add');
    ed_renderCreateForm(); ed_renderFieldsPanel(); ed_renderQuickSearch();
    try { window.edSubRefresh && window.edSubRefresh(null); } catch (e) {}
    ed_loadHistory(); ed_renderBulkFieldSelect();
    addActivity('edit', `Connected to "${listName}" (${editorState.columns.length} editable fields)`);
    applyEditorListPermission(canEdit);
    const mode = $('editorDlMode').value;
    if (mode === 'all') await ed_startDownload();
    else if (mode === 'recent') await ed_loadRecent();
    else { ed_refreshAfterLoad(); ed_setConnectStatus('✓ Connected. Nothing downloaded yet — use Search, Latest rows or Download all in the toolbar below.', 'success'); loadSuggestionPool(false); }
  } catch (err) {
    ed_setConnectStatus('✘ ' + err.message, 'error');
    editorLoadProgress.error('✘ ' + err.message);
    addActivity('error', `Editor connect failed: ${err.message}`);
  } finally { $('editorLoadBtn').disabled = false; }
});

