/* ============================================================
   Data Editor: resumable download · latest rows · search-before-download · field visibility
   ============================================================ */
const ED_HDR = token => ({ Authorization: `Bearer ${token}`, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' });
const ed_baseUrl = () => `https://graph.microsoft.com/v1.0/sites/${editorState.siteId}/lists/${editorState.listId}/items?$expand=fields&$top=200`;
editorState.dl = { nextUrl: null, running: false, kind: '', complete: false };
editorState.fieldCfg = {}; editorState.qValues = [];

function ed_updateToolbar() {
  const d = editorState.dl, n = editorState.items.length;
  const kindTxt = d.kind === 'search' ? 'matching records only' : d.kind === 'recent' ? 'latest rows only' : d.kind === 'all' ? (d.complete ? 'complete list' : 'partial list') : 'nothing downloaded yet';
  $('editorDlInfo').textContent = `${n.toLocaleString()} record(s) loaded · ${d.running ? 'downloading…' : kindTxt}`;
  const resumable = !d.running && !!d.nextUrl;
  $('editorResumeBtn').style.display = resumable ? '' : 'none';
  $('editorResumeBtn').textContent = `▶ Resume download (${n.toLocaleString()} loaded)`;
  $('editorDownloadAllBtn').style.display = (resumable && d.kind === 'all') ? 'none' : '';
  ['editorDownloadAllBtn', 'editorRecentBtn', 'editorQLoadBtn', 'editorResumeBtn'].forEach(id => { $(id).disabled = d.running; });
}
function ed_refreshAfterLoad() {
  const n = editorState.items.length;
  $('editorRecordCount').textContent = n; $('bulkRecordCount').textContent = n;
  ed_renderRecordsList(); ed_renderBulkRecordsList(); ed_renderInlineTable(); ed_updateToolbar();
}
function ed_afterLoad() {
  ed_refreshAfterLoad();
  const key = editorState.listName + '|' + editorState.listId, d = editorState.dl;
  if (editorState.suggestionLoadedForList === key) return;
  if (d.complete && d.kind === 'all' && editorState.items.length <= SUGGESTION_ROW_LIMIT) {
    editorState.suggestionItems = editorState.items.slice(); editorState.suggestionLoadedForList = key;
    ed_attachAllSuggestions($('editorCreateForm')); ed_renderQuickSearch();
  } else loadSuggestionPool(false);
}
function ed_finishRun(outcome, failure) {
  const n = editorState.items.length, d = editorState.dl;
  d.running = false; d.complete = outcome === 'done';
  if (outcome === 'done') { editorLoadProgress.finish(`✅ Loaded ${n.toLocaleString()} records`); ed_setConnectStatus(`✓ ${n.toLocaleString()} records loaded · ${editorState.columns.length} editable fields.`, 'success'); }
  else if (outcome === 'stopped') { editorLoadProgress.error('Stopped by user'); ed_setConnectStatus(`⏹ Stopped — ${n.toLocaleString()} records are loaded and ready to use.${d.nextUrl ? ' Click ▶ Resume download to continue.' : ''}`, 'warn'); }
  else { editorLoadProgress.error('✘ ' + failure.message); ed_setConnectStatus(`✘ ${failure.message} — ${n.toLocaleString()} records kept.${d.nextUrl ? ' Click ▶ Resume download to retry.' : ''}`, 'error'); addActivity('error', `Editor download: ${failure.message}`); }
  ed_afterLoad();
  return outcome;
}
/* Pages through the list, keeping every row (and the next-page link) so a Stop or failure can be resumed */
async function ed_runDownload({ startUrl, kind, label, fresh }) {
  const d = editorState.dl; if (d.running) return;
  const token = getGlobalAccessToken(); if (!token) { ed_setStatus('Global token not configured.', 'error'); return; }
  if (fresh) { editorState.items = []; d.kind = kind; }
  d.running = true; d.nextUrl = null; d.complete = false; ed_updateToolbar();
  editorLoadProgress.start(label, 0);
  let url = startUrl, outcome = 'done', failure = null, lastPaint = 0;
  try {
    while (url) {
      const r = await fetchWithRetry(url, { headers: ED_HDR(token) }, 'fetch items');
      if (!r.ok) {
        let e; try { e = await r.text(); } catch { e = r.statusText; }
        if (r.status === 422 || /threshold|tooManyResources/i.test(e)) throw new Error('SharePoint blocked this query (list view threshold). Try Download all records, or search on an indexed column.');
        throw new Error(`Item fetch failed (${r.status}): ${e}`);
      }
      const j = await r.json();
      if (j.value) editorState.items.push(...j.value);
      const next = j['@odata.nextLink'] || null; url = next; d.nextUrl = next;
      const now = Date.now();
      if (now - lastPaint > 1500) { lastPaint = now; const ae = document.activeElement; if (!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.closest && ae.closest('#editorMainArea'))) ed_refreshAfterLoad(); }
      editorLoadProgress.update(editorState.items.length, 0, `${editorState.items.length.toLocaleString()} records downloaded`);
    }
  } catch (err) { d.nextUrl = url; if (err && err.cancelled) outcome = 'stopped'; else { outcome = 'failed'; failure = err; } }
  if (outcome === 'stopped' && !d.nextUrl) outcome = 'done';
  return ed_finishRun(outcome, failure);
}
const ed_startDownload = () => ed_runDownload({ startUrl: ed_baseUrl(), kind: 'all', label: 'Downloading all records…', fresh: true });
async function ed_loadRecent() {
  const d = editorState.dl; if (d.running) return;
  const token = getGlobalAccessToken(); if (!token) return;
  const N = Math.max(50, Math.min(20000, parseInt($('editorRecentN').value, 10) || 2000));
  d.running = true; d.kind = 'recent'; d.nextUrl = null; d.complete = false; ed_updateToolbar();
  editorLoadProgress.start(`Loading the latest ${N.toLocaleString()} rows…`, N);
  let outcome = 'done', failure = null;
  try { editorState.items = await exp_fetchRecentSampleItems(editorState.siteId, editorState.listId, token, N, n => editorLoadProgress.update(n, N, `${n.toLocaleString()} latest rows`)); }
  catch (err) { if (err && err.cancelled) { outcome = 'stopped'; if (err.partial) editorState.items = err.partial; } else { outcome = 'failed'; failure = err; } }
  return ed_finishRun(outcome, failure);
}

/* ---------- Search before downloading ---------- */
function ed_searchableColumns() { return editorState.columns.filter(c => ['text', 'choice', 'number'].includes(c.type)); }
function ed_renderQuickSearch() {
  const sel = $('editorQField'); if (!sel || !sel.options) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="__id">Item ID</option>' + ed_searchableColumns().map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.displayName)}</option>`).join('');
  sel.value = Array.from(sel.options).some(o => o.value === cur) ? cur : (ed_searchableColumns().some(c => c.name === 'Title') ? 'Title' : sel.options[Math.min(1, sel.options.length - 1)].value);
  const host = $('editorQValues'); host.innerHTML = '';
  const pool = editorState.suggestionItems.length ? editorState.suggestionItems : editorState.items;
  const opts = sel.value === '__id' ? [] : ddOpts(editorState.listName, sel.value, distinctFieldValues(pool, sel.value));
  host.appendChild(buildMultiCombo(editorState.qValues, opts, arr => { editorState.qValues = arr; }, { placeholder: sel.value === '__id' ? 'Type item IDs, press Enter' : 'Type to search or pick values…' }));
}
async function ed_quickSearch() {
  const d = editorState.dl; if (d.running) return;
  const fieldName = $('editorQField').value, op = $('editorQOp').value, vals = editorState.qValues.slice();
  const token = getGlobalAccessToken();
  if (!token || !fieldName || !vals.length) { ed_setStatus('Pick a field and at least one value to search.', 'warn'); return; }
  if (fieldName === '__id') {   // direct lookups by ID — instant, never hits the list view threshold
    const ids = vals.map(v => parseInt(v, 10)).filter(n => n > 0).slice(0, 200);
    if (!ids.length) { ed_setStatus('Enter numeric item IDs.', 'warn'); return; }
    editorState.items = []; d.running = true; d.kind = 'search'; d.nextUrl = null; d.complete = false; ed_updateToolbar();
    editorLoadProgress.start(`Looking up ${ids.length} item(s)…`, ids.length);
    let outcome = 'done', failure = null;
    try {
      for (let i = 0; i < ids.length; i++) {
        const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${editorState.siteId}/lists/${editorState.listId}/items/${ids[i]}?$expand=fields`, { headers: ED_HDR(token) }, 'fetch item');
        if (r.ok) editorState.items.push(await r.json());
        editorLoadProgress.update(i + 1, ids.length, `${i + 1} / ${ids.length} looked up`);
      }
    } catch (err) { if (err && err.cancelled) outcome = 'stopped'; else { outcome = 'failed'; failure = err; } }
    d.nextUrl = null;
    return ed_finishRun(outcome === 'stopped' ? 'stopped' : outcome, failure);
  }
  const col = editorState.columns.find(c => c.name === fieldName); if (!col) return;
  const f = `fields/${fieldName}`;
  const one = v => {
    if (col.type === 'number') { const n = parseFloat(v); return isNaN(n) ? null : `${f} eq ${n}`; }
    const q = exp_escapeODataString(v);
    return op === 'eq' ? `${f} eq '${q}'` : op === 'startswith' ? `startswith(${f},'${q}')` : `substringof('${q}',${f})`;
  };
  const parts = vals.map(one).filter(Boolean); if (!parts.length) { ed_setStatus('No valid values to search.', 'warn'); return; }
  const filter = parts.length > 1 ? '(' + parts.join(' or ') + ')' : parts[0];
  return ed_runDownload({ startUrl: `${ed_baseUrl()}&$filter=${encodeURIComponent(filter)}`, kind: 'search', label: `Searching "${col.displayName}"…`, fresh: true });
}

/* ---------- Field visibility / editability ---------- */
function ed_cfgKey() { return profileKey('edfields_' + (editorState.listName || '').toLowerCase()); }
function ed_loadFieldCfg() { try { editorState.fieldCfg = JSON.parse(localStorage.getItem(ed_cfgKey()) || '{}') || {}; } catch (e) { editorState.fieldCfg = {}; } }
function ed_saveFieldCfg() { try { localStorage.setItem(ed_cfgKey(), JSON.stringify(editorState.fieldCfg || {})); } catch (e) {} }
function ed_isShown(col) { return !!col.required || (editorState.fieldCfg?.[col.name]?.show !== false); }
function ed_isEditable(col) { return editorState.fieldCfg?.[col.name]?.edit !== false; }
function ed_shownColumns() { return editorState.columns.filter(ed_isShown); }
function ed_saveColumns() { return editorState.columns.filter(c => ed_isShown(c) && ed_isEditable(c)); }
function ed_renderFieldsPanel() {
  const body = $('editorFieldsBody'); if (!body) return;
  body.innerHTML = editorState.columns.map(c => {
    const sh = ed_isShown(c), ed = ed_isEditable(c), nm = escapeHtml(c.name);
    return `<tr><td>${escapeHtml(c.displayName)}${c.required ? ' <span class="required">*</span>' : ''}</td><td><span class="badge type">${escapeHtml(c.type)}</span></td>
      <td style="text-align:center;"><input type="checkbox" data-fcfg="show" data-name="${nm}" ${sh ? 'checked' : ''} ${c.required ? 'disabled title="Required fields are always visible"' : ''} /></td>
      <td style="text-align:center;"><input type="checkbox" data-fcfg="edit" data-name="${nm}" ${ed ? 'checked' : ''} ${sh ? '' : 'disabled'} /></td></tr>`;
  }).join('');
  $('editorFieldsInfo').textContent = `${ed_shownColumns().length} of ${editorState.columns.length} fields visible · ${ed_saveColumns().length} editable`;
}
function ed_applyFieldConfig() {
  ed_saveFieldCfg(); ed_renderFieldsPanel(); ed_renderCreateForm();
  const it = editorState.items.find(x => String(x.id) === String(editorState.selectedItemId)); if (it) ed_renderEditForm(it);
  ed_renderBulkFieldSelect(); ed_renderInlineTable();
}
const ed_setAll = (key, val) => { editorState.columns.forEach(c => { (editorState.fieldCfg[c.name] = editorState.fieldCfg[c.name] || {})[key] = (key === 'show' && c.required) ? true : val; }); ed_applyFieldConfig(); };
$('editorFieldsBody').addEventListener('change', e => {
  const cb = e.target.closest('input[data-fcfg]'); if (!cb) return;
  const c = (editorState.fieldCfg[cb.dataset.name] = editorState.fieldCfg[cb.dataset.name] || {});
  c[cb.dataset.fcfg] = cb.checked; ed_applyFieldConfig();
});
$('edFldShowAll').addEventListener('click', () => ed_setAll('show', true));
$('edFldHideAll').addEventListener('click', () => ed_setAll('show', false));
$('edFldEditAll').addEventListener('click', () => ed_setAll('edit', true));
$('edFldReadAll').addEventListener('click', () => ed_setAll('edit', false));
$('edFldReset').addEventListener('click', () => { editorState.fieldCfg = {}; ed_applyFieldConfig(); });
$('editorFieldsBtn').addEventListener('click', () => { const p = $('editorFieldsPanel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; });
$('editorResumeBtn').addEventListener('click', () => { const d = editorState.dl; if (d.nextUrl && !d.running) ed_runDownload({ startUrl: d.nextUrl, kind: d.kind, label: 'Resuming download…', fresh: false }); });
$('editorDownloadAllBtn').addEventListener('click', () => ed_startDownload());
$('editorRecentBtn').addEventListener('click', () => ed_loadRecent());
$('editorQLoadBtn').addEventListener('click', () => ed_quickSearch());
$('editorQField').addEventListener('change', () => { editorState.qValues = []; ed_renderQuickSearch(); });

async function loadSuggestionPool(force = false) {
  if (!editorState.siteId || !editorState.listId) return;
  const listKey = editorState.listName + '|' + editorState.listId;
  if (!force && editorState.suggestionLoadedForList === listKey && editorState.suggestionItems.length) return;
  if (editorState.suggestionLoading) return;
  const token = getGlobalAccessToken();
  if (!token) return;
  editorState.suggestionLoading = true;
  try {
    const prog = n => { if (n % 1000 === 0 || n === SUGGESTION_ROW_LIMIT) ed_setConnectStatus(`✓ Suggestions: ${n.toLocaleString()} recent rows loaded`, 'success'); };
    let items;
    try { items = await fetchRecentItems(editorState.siteId, editorState.listId, token, SUGGESTION_ROW_LIMIT, prog); }
    catch (e1) { items = await exp_fetchRecentSampleItems(editorState.siteId, editorState.listId, token, SUGGESTION_ROW_LIMIT, prog); }
    editorState.suggestionItems = items;
    editorState.suggestionLoadedForList = listKey;
    addActivity('edit', `Suggestion pool: last ${items.length.toLocaleString()} rows loaded`);
    ed_setConnectStatus(`✓ Connected. Suggestions from last ${items.length.toLocaleString()} rows.`, 'success');
  } catch (err) {
    console.warn('Suggestion pool load failed, falling back to loaded items:', err.message);
    editorState.suggestionItems = editorState.items.slice(-SUGGESTION_ROW_LIMIT);
    editorState.suggestionLoadedForList = listKey;
    ed_setConnectStatus(`✓ Connected. Suggestions from ${editorState.suggestionItems.length.toLocaleString()} loaded rows (fallback).`, 'warn');
  } finally {
    editorState.suggestionLoading = false;
    ed_attachAllSuggestions($('editorCreateForm'));
    const editForm = $('editorEditForm');
    if (editForm && editorState.selectedItemId) {
      const item = editorState.items.find(x => String(x.id) === String(editorState.selectedItemId));
      if (item) ed_attachAllSuggestions(editForm);
    }
    ed_renderInlineTable(); ed_renderQuickSearch();
  }
}

/* Data Editor: every tab can be used in the page, as a pop-up window, or expanded over the whole page */
(function(){ const TT = { add: '📝 Add New', edit: '✏️ Edit / Delete', bulk: '☑️ Bulk Edit', inline: '📊 Inline Edit', json: '📋 JSON View', 'history': '📜 History' };
  const set = (p, m) => { p.classList.toggle('ed-pop', m === 'pop'); p.classList.toggle('ed-full', m === 'full'); const bar = p.querySelector(':scope>.ed-pbar'); if (!bar) return; bar.querySelector('[data-m="pop"]').textContent = m === 'pop' ? '⧉ Dock in page' : '⧉ Pop up'; bar.querySelector('[data-m="full"]').textContent = m === 'full' ? '⤡ Restore' : '⤢ Expand'; document.body.style.overflow = m ? 'hidden' : ''; };
  document.querySelectorAll('.editor-tab-panel').forEach(p => { const id = p.id.replace('editorTab-', ''), bar = document.createElement('div'); bar.className = 'ed-pbar'; bar.innerHTML = '<span class="ed-ttl">' + (TT[id] || id) + '</span><button type="button" class="ghost small" data-m="pop" title="Open this screen as a pop-up window">⧉ Pop up</button><button type="button" class="ghost small" data-m="full" title="Fill the whole page">⤢ Expand</button><button type="button" class="ghost small ed-x" data-m="x" title="Back to the page" style="display:none">✕</button>'; p.insertBefore(bar, p.firstChild);
    bar.addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (!b) return; const m = b.dataset.m, cur = p.classList.contains('ed-pop') ? 'pop' : p.classList.contains('ed-full') ? 'full' : ''; set(p, m === 'x' ? '' : m === cur ? '' : m); bar.querySelector('.ed-x').style.display = p.classList.contains('ed-pop') || p.classList.contains('ed-full') ? '' : 'none'; }); });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; const fs = document.querySelector('.eds-sec.eds-full,.eds-sec.eds-pop'); if (fs) { fs.classList.remove('eds-full', 'eds-pop'); const fb = fs.querySelector('[data-a=full]'); if (fb) fb.textContent = '⤢ Expand'; const pb = fs.querySelector('[data-a=pop]'); if (pb) pb.textContent = '⧉ Pop up'; document.body.style.overflow = ''; return; } const p = document.querySelector('.editor-tab-panel.ed-pop,.editor-tab-panel.ed-full'); if (p) { set(p, ''); p.querySelector('.ed-x').style.display = 'none'; } });
  document.querySelectorAll('.editor-tab').forEach(t => t.addEventListener('click', () => document.querySelectorAll('.editor-tab-panel').forEach(p => { if (p.classList.contains('ed-pop') || p.classList.contains('ed-full')) { set(p, ''); p.querySelector('.ed-x').style.display = 'none'; } })), true);
})();
document.querySelectorAll('.editor-tab').forEach(tab => tab.addEventListener('click', () => {
  if (tab.classList.contains('locked')) return;
  ed_switchTab(tab.dataset.tab);
}));
function ed_switchTab(name) {
  document.querySelectorAll('.editor-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.editor-tab-panel').forEach(p => p.classList.add('hidden'));
  $('editorTab-' + name).classList.remove('hidden');
  if (name === 'bulk') ed_renderBulkRecordsList();
  if (name === 'inline') ed_renderInlineTable();
  if (name === 'history') ed_renderHistory();
}
function ed_historyKey() { return profileKey('history_' + (editorState.listName || '').toLowerCase()); }
function ed_loadHistory() { try { const raw = localStorage.getItem(ed_historyKey()); editorState.history = raw ? JSON.parse(raw) : []; } catch (e) { editorState.history = []; } }
function ed_saveHistory() { try { localStorage.setItem(ed_historyKey(), JSON.stringify(editorState.history.slice(-MAX_HISTORY))); } catch (e) {} }
function ed_addHistory(action, itemId, changes, extra = {}) {
  editorState.history.push({ id: uid(), action, itemId, changes: changes || [], ts: Date.now(), user: currentUser?.username || 'unknown', ...extra });
  if (editorState.history.length > MAX_HISTORY) editorState.history = editorState.history.slice(-MAX_HISTORY);
  ed_saveHistory();
}
function ed_renderHistory() {
  const container = $('historyList');
  const q = ($('historySearch').value || '').trim().toLowerCase();
  const actionFilter = $('historyFilterAction').value;
  let list = editorState.history.slice().reverse();
  if (actionFilter) list = list.filter(h => h.action === actionFilter);
  if (q) list = list.filter(h => String(h.itemId).toLowerCase().includes(q) || h.action.toLowerCase().includes(q) || h.changes.some(c => (c.field + ' ' + c.oldValue + ' ' + c.newValue).toLowerCase().includes(q)));
  if (!list.length) { container.innerHTML = '<p class="text-sm">No history entries match.</p>'; return; }
  container.innerHTML = list.slice(0, 200).map(h => `
    <div class="history-item">
      <div class="history-meta"><span><span class="history-action ${h.action}">${h.action}</span> · Item #${h.itemId} · ${escapeHtml(h.user || '')}</span><span>${formatDate(h.ts)}</span></div>
      ${h.changes.length ? `<div class="history-changes">${h.changes.slice(0, 8).map(c => `<div class="change-line"><span class="field-name">${escapeHtml(c.field)}</span>: <span class="old-val">${escapeHtml(truncate(c.oldValue, 40))}</span> → <span class="new-val">${escapeHtml(truncate(c.newValue, 40))}</span></div>`).join('')}
      ${h.changes.length > 8 ? `<div class="change-line" style="color:var(--gray-400);">…and ${h.changes.length - 8} more</div>` : ''}</div>` : ''}
    </div>`).join('');
}
$('historySearch').addEventListener('input', ed_renderHistory);
$('historyFilterAction').addEventListener('change', ed_renderHistory);
$('historyClearBtn').addEventListener('click', () => { if (!hasPerm('delete')) { alert('Permission denied.'); return; } if (!confirm('Clear all history for this list?')) return; editorState.history = []; ed_saveHistory(); ed_renderHistory(); });
$('historyExportBtn').addEventListener('click', () => {
  if (!editorState.history.length) return;
  const rows = [['Timestamp', 'Action', 'Item ID', 'User', 'Field', 'Old Value', 'New Value'].join(',')];
  editorState.history.forEach(h => {
    if (!h.changes.length) rows.push([new Date(h.ts).toISOString(), h.action, h.itemId, h.user, '', '', ''].map(x => `"${String(x).replace(/"/g, '""')}"`).join(','));
    else h.changes.forEach(c => rows.push([new Date(h.ts).toISOString(), h.action, h.itemId, h.user, c.field, c.oldValue, c.newValue].map(x => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`).join(',')));
  });
  const blob = new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `history_${editorState.listName}_${Date.now()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});

function ed_renderField(col, value, options = {}) {
  const id = 'ed_field_' + (options.idPrefix || '') + col.name;
  const vs = value == null ? '' : String(value);
  const reqMark = col.required ? ' <span class="required">*</span>' : '';
  const typeBadge = `<span class="badge type">${col.type}</span>`;
  const ro = options.readOnly ? ' <span class="badge readonly">readonly</span>' : '';
  const desc = col.description ? `<div class="field-help">${escapeHtml(col.description)}</div>` : '';
  const roAttr = options.readOnly ? 'disabled' : '';
  let input = '';
  if (col.type === 'choice') {
    const cs = col.choices || [];
    input = `<select id="${id}" name="${id}" data-field="${escapeHtml(col.name)}" data-type="choice" ${roAttr}><option value="">— Select —</option>${cs.map(c => `<option value="${escapeHtml(c)}" ${c === vs ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>`;
  } else if (col.type === 'boolean') {
    const checked = value === true || vs === 'true' || vs === 'Yes' ? 'checked' : '';
    input = `<div style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="${id}" name="${id}" data-field="${escapeHtml(col.name)}" data-type="boolean" ${checked} ${roAttr} /><label for="${id}" style="font-weight:400;cursor:pointer;">Yes / No</label></div>`;
  } else if (col.type === 'multiline') {
    input = `<textarea id="${id}" name="${id}" data-field="${escapeHtml(col.name)}" data-type="multiline" rows="3" ${roAttr}>${escapeHtml(vs)}</textarea>`;
  } else if (col.type === 'number') {
    input = `<input type="number" id="${id}" name="${id}" data-field="${escapeHtml(col.name)}" data-type="number" value="${escapeHtml(vs)}" step="any" ${roAttr} />`;
  } else if (col.type === 'date') {
    let dt = '';
    if (vs) { const d = new Date(vs); if (!isNaN(d.getTime())) { const p = n => String(n).padStart(2, '0'); dt = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; } }
    input = `<input type="datetime-local" id="${id}" name="${id}" data-field="${escapeHtml(col.name)}" data-type="date" value="${dt}" ${roAttr} />`;
  } else {
    input = `<input type="text" id="${id}" name="${id}" data-field="${escapeHtml(col.name)}" data-type="text" value="${escapeHtml(vs)}" ${roAttr} />`;
  }
  return `<div class="field-row" data-field-row="${escapeHtml((options.idPrefix || '') + col.name)}"><div class="field-label">${escapeHtml(col.displayName)}${reqMark}${typeBadge}${ro}</div>${input}${desc}</div>`;
}
function ed_attachAllSuggestions(container) {
  if (!container) return;
  editorState.columns.forEach(col => {
    if (!['text', 'number', 'multiline'].includes(col.type)) return;
    const el = container.querySelector(`[data-field="${CSS.escape(col.name)}"]`);
    if (el && !el.disabled) attachFieldSuggestions(el, col.name);
  });
}
function ed_readField(col, prefix = '') {
  const el = document.getElementById('ed_field_' + prefix + col.name);
  if (!el) return undefined;
  if (col.type === 'boolean') return el.checked;
  const v = el.value.trim();
  if (v === '') return null;
  if (col.type === 'number') { const n = parseFloat(v); return isNaN(n) ? null : n; }
  if (col.type === 'date') { const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); }
  return v;
}
function ed_renderCreateForm() {
  const c = $('editorCreateForm');
  if (!ed_shownColumns().length) { c.innerHTML = '<p class="text-sm">No visible fields — use 🧩 Fields… to show some.</p>'; $('editorCreateBtn').disabled = true; return; }
  c.innerHTML = `<div class="form-grid full">${ed_shownColumns().map(col => ed_renderField(col, col.default, { idPrefix: 'create_', readOnly: !ed_isEditable(col) })).join('')}</div>`;
  ed_attachAllSuggestions(c);
  $('editorCreateBtn').disabled = !hasPerm('editor-add') || !editorState.canEditThisList;
}
$('editorClearFormBtn').addEventListener('click', () => { ed_renderCreateForm(); ed_setStatus('Form cleared.', 'info'); });
$('editorCreateBtn').addEventListener('click', async () => {
  if (!hasPerm('editor-add') || !editorState.canEditThisList) { ed_setStatus('Permission denied.', 'error'); return; }
  const token = getGlobalAccessToken();
  if (!token) { ed_setStatus('Global token not configured.', 'error'); return; }
  const missing = []; const fields = {};
  ed_saveColumns().forEach(col => {
    const v = ed_readField(col, 'create_');
    if (col.required && (v === null || v === '')) missing.push(col.displayName);
    if (v !== null && v !== undefined && v !== '') fields[col.name] = v;
  });
  if (missing.length) { ed_setStatus('Missing required: ' + missing.join(', '), 'error'); return; }
  if (!Object.keys(fields).length) { ed_setStatus('No values to save.', 'warn'); return; }
  $('editorCreateBtn').disabled = true; ed_setStatus('Creating...', 'info');
  try {
    const created = await createItem(editorState.siteId, editorState.listId, fields, token);
    const changes = Object.entries(fields).map(([field, val]) => ({ field, oldValue: '', newValue: val }));
    ed_addHistory('create', created.id, changes);
    ed_setStatus(`✅ Created item #${created.id}`, 'success');
    addActivity('edit', `Created item #${created.id}`);
    ed_renderCreateForm();
    await ed_reloadItems();
    ed_renderHistory();
  } catch (err) { ed_setStatus('✘ ' + err.message, 'error'); addActivity('error', `Create failed: ${err.message}`); }
  finally { $('editorCreateBtn').disabled = false; }
});
/* ---- Data Editor pop-up: same look & layout as the F&D trip window (gradient header with actions, grey body of cards, footer bar) ---- */
(function () {
  const INFO = { add: ['📝', 'Add New', 'Create a new record in this list'], edit: ['✏️', 'Edit / Delete', ''], bulk: ['☑️', 'Bulk Edit', 'Change many records at once'], inline: ['📊', 'Inline Edit', 'Edit the records directly in the table'], json: ['📋', 'JSON View', 'The raw data of the loaded records'], history: ['📜', 'History', 'Everything created, changed or deleted here'] };
  const FOOT = { add: 'Enter = next field · Ctrl+Enter = Create · Esc = close', edit: 'Pick a record on the left, change it, then Ctrl+S = Save · Esc = close' };
  const PROXY = { add: ['editorClearFormBtn', 'editorCreateBtn'], edit: ['editorDuplicateBtn', 'editorDeleteBtn', 'editorSaveBtn'] };
  const css = document.createElement('style'); css.textContent = [
    '.ed-tt,.ed-acts,.ed-foot{display:none}',
    '.editor-tab-panel.ed-pop,.editor-tab-panel.ed-full{padding:0 !important;display:flex !important;flex-direction:column;overflow:hidden !important;border:0 !important;background:var(--card,#fff) !important}',
    '.editor-tab-panel.ed-pop{inset:5vh 6vw !important;border-radius:18px !important;box-shadow:0 0 0 100vmax rgba(15,23,42,.5),0 28px 80px rgba(15,23,42,.45) !important}',
    '.editor-tab-panel.ed-full{border-radius:0 !important}',
    '.ed-pop>.ed-pbar,.ed-full>.ed-pbar{position:static !important;margin:0 !important;padding:16px 24px !important;flex-wrap:wrap;gap:8px !important;background:var(--acc-grad,linear-gradient(135deg,#1e3a8a,#2563eb)) !important;color:#fff;justify-content:flex-end}',
    '.ed-pop .ed-tt,.ed-full .ed-tt{display:flex;align-items:center;gap:14px;margin-right:auto}',
    '.ed-pop .ed-acts,.ed-full .ed-acts{display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
    '.ed-ico{width:46px;height:46px;border-radius:13px;background:rgba(255,255,255,.18);display:grid;place-items:center;font-size:24px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}',
    '.ed-tt h2{margin:0;font-size:19px;font-weight:700;letter-spacing:.3px;color:#fff;border:0;padding:0}.ed-sub{font-size:12.5px;opacity:.88;margin-top:3px}',
    '.ed-pbar .ed-b,.ed-pop .ed-pbar>button,.ed-full .ed-pbar>button{background:rgba(255,255,255,.14) !important;color:#fff !important;border:1px solid rgba(255,255,255,.3) !important;border-radius:10px !important;padding:7px 13px !important;font-size:12.5px !important;font-weight:600 !important;box-shadow:none !important;cursor:pointer}',
    '.ed-pbar .ed-b:hover:not(:disabled),.ed-pop .ed-pbar>button:hover,.ed-full .ed-pbar>button:hover{background:rgba(255,255,255,.27) !important}.ed-pbar .ed-b:disabled{opacity:.45;cursor:not-allowed}',
    '.ed-pbar .ed-b.ed-main,.ed-pop .ed-pbar>button.ed-x,.ed-full .ed-pbar>button.ed-x{background:#fff !important;color:var(--acc-1,#1e3a8a) !important;border-color:#fff !important}',
    '.ed-body{display:block}',
    '.ed-pop>.ed-body,.ed-full>.ed-body{flex:1;min-height:0;overflow:auto;padding:18px 24px 10px;background:var(--gray-50,#f6f8fb)}',
    '.ed-pop .ed-body .card,.ed-full .ed-body .card,.ed-pop .ed-body .editor-panel,.ed-full .ed-body .editor-panel{background:var(--card,#fff);border:1px solid var(--border,#e2e8f0);border-radius:16px;box-shadow:0 1px 3px rgba(15,23,42,.05)}',
    '#editorTab-add.ed-pop .ed-body .card>.card-header,#editorTab-add.ed-full .ed-body .card>.card-header,#editorTab-edit.ed-pop .editor-panel-header .btn-row,#editorTab-edit.ed-full .editor-panel-header .btn-row{display:none !important}',
    '#editorTab-add.ed-pop #editorCreateForm::before,#editorTab-add.ed-full #editorCreateForm::before{content:"RECORD DETAILS";display:block;margin:0 0 12px;font-size:12px;letter-spacing:.09em;font-weight:700;color:var(--gray-600,#475569)}',
    '.ed-pop .ed-body .field-label,.ed-full .ed-body .field-label{font-size:11.5px;font-weight:600;color:var(--gray-600,#475569);margin-bottom:4px}',
    '.ed-pop .ed-body .field-row input:not([type=checkbox]),.ed-pop .ed-body .field-row select,.ed-full .ed-body .field-row input:not([type=checkbox]),.ed-full .ed-body .field-row select{height:38px;border-radius:10px;padding:0 12px;font-size:13.5px}',
    '.ed-pop .ed-fast,.ed-full .ed-fast{background:var(--card,#fff);border-radius:14px}',
    '.ed-pop>.ed-foot,.ed-full>.ed-foot{display:flex;align-items:center;gap:12px;padding:12px 24px;border-top:1px solid var(--border,#e2e8f0);background:var(--card,#fff);font-size:12.5px;color:var(--gray-600,#475569)}',
    '.ed-pop .ed-body .editor-panel-body,.ed-full .ed-body .editor-panel-body{max-height:calc(100vh - 330px)}.ed-full .ed-body .editor-panel-body{max-height:calc(100vh - 250px)}'
  ].join('\n'); document.head.appendChild(css);
  document.querySelectorAll('.editor-tab-panel').forEach(p => {
    const id = p.id.replace('editorTab-', ''), inf = INFO[id] || ['📄', id, ''], bar = p.querySelector(':scope>.ed-pbar'); if (!bar) return;
    const body = document.createElement('div'); body.className = 'ed-body'; [...p.childNodes].forEach(n => { if (n !== bar) body.appendChild(n); }); p.appendChild(body);
    const old = bar.querySelector('.ed-ttl'); if (old) old.remove();
    const tt = document.createElement('div'); tt.className = 'ed-tt'; tt.innerHTML = '<div class="ed-ico">' + inf[0] + '</div><div><h2>' + inf[1] + '</h2><div class="ed-sub">' + inf[2] + '</div></div>'; bar.insertBefore(tt, bar.firstChild);
    const acts = document.createElement('div'); acts.className = 'ed-acts'; (PROXY[id] || []).forEach((bid, i, arr) => { const o = document.getElementById(bid); if (!o) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'ed-b' + (bid === 'editorCreateBtn' || bid === 'editorSaveBtn' ? ' ed-main' : ''); b.textContent = o.textContent.trim(); const sync = () => { b.disabled = o.disabled; }; sync(); new MutationObserver(sync).observe(o, { attributes: true, attributeFilter: ['disabled'] }); b.addEventListener('click', () => o.click()); acts.appendChild(b); });
    bar.insertBefore(acts, tt.nextSibling);
    const ft = document.createElement('div'); ft.className = 'ed-foot'; ft.textContent = FOOT[id] || 'Esc = close · ⧉ Dock in page puts this screen back'; p.appendChild(ft);
    const upd = () => { if (!(p.classList.contains('ed-pop') || p.classList.contains('ed-full'))) return; const sub = tt.querySelector('.ed-sub'); if (id === 'edit') { const t = document.getElementById('editorEditTitle'); sub.textContent = t ? t.textContent : ''; } else if (id === 'add') { const n = document.querySelectorAll('#editorCreateForm [data-field]').length; sub.textContent = 'Create a new record · ' + n + ' field(s)'; } }; new MutationObserver(upd).observe(p, { attributes: true, attributeFilter: ['class'] }); { const et = document.getElementById('editorEditTitle'); if (et && id === 'edit') new MutationObserver(upd).observe(et, { childList: true, characterData: true, subtree: true }); }
  });
})();
/* ---- Data Editor: linked lists as sub-forms (filtered by the selected record, editable in the same style) ---- */
(function () {
  const host = $('editorEditForm'); if (!host) return;
  const KEY = () => LS_BASE + '_ed_sub_' + (editorState.listId || ''), HK = i => KEY() + '_h' + i;
  const getL = () => { try { return JSON.parse(localStorage.getItem(KEY()) || '[]') || []; } catch (e) { return []; } }, setL = v => { try { localStorage.setItem(KEY(), JSON.stringify(v)); } catch (e) {} };
  const meta = new Map(), E = escapeHtml; let cur = null, picker = null, pickCols = null, seq = 0;
  const css = document.createElement('style'); css.textContent = '.eds-top{display:flex;align-items:center;gap:10px;margin-top:18px;padding-top:12px;border-top:1px dashed var(--border,#e2e8f0)}.eds-top b{font-size:13px}.eds-top .hint{font-size:12px;color:var(--gray-500,#64748b)}.eds-cfg{display:none;border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:12px;margin-top:10px;background:var(--gray-50,#f8fafc)}.eds-cfg.open{display:block}.eds-cfg .g{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin:8px 0}.eds-sec{--h:var(--acc-2,var(--primary,#2563eb));border:1px solid color-mix(in srgb,var(--h) 45%,transparent);border-left:6px solid var(--h);border-radius:16px;background:color-mix(in srgb,var(--h) 9%,var(--card,#fff));padding:12px 14px;margin-top:14px;box-shadow:0 1px 3px rgba(15,23,42,.05)}.eds-sec .eds-sh h4{color:var(--h)}.eds-sec .eds-card{background:var(--card,#fff)}.eds-sec .eds-ch{background:color-mix(in srgb,var(--h) 12%,var(--card,#fff))}.eds-sec.eds-full{position:fixed;inset:0;z-index:9500;margin:0;border-radius:0;overflow:auto;padding:16px 24px;background:color-mix(in srgb,var(--h) 9%,var(--card,#fff))}.eds-sec.eds-full .eds-sh{position:sticky;top:-16px;z-index:3;background:inherit;padding:10px 0;margin-top:-16px}.eds-sec .suggest-wrap{position:relative}.eds-sec.eds-pop{position:fixed;inset:5vh 6vw;z-index:9500;margin:0;overflow:auto;border-radius:18px;padding:16px 24px;box-shadow:0 0 0 100vmax rgba(15,23,42,.5),0 28px 80px rgba(15,23,42,.45);background:color-mix(in srgb,var(--h) 9%,var(--card,#fff))}.eds-sec.eds-pop .eds-sh{position:sticky;top:-16px;z-index:3;background:inherit;padding:10px 0;margin-top:-16px}.eds-sh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.eds-sh h4{margin:0;font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--gray-600,#475569)}.eds-sh .sp{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.eds-sh input{height:32px;margin:0;width:170px;border-radius:999px}.eds-card{border:1px solid var(--border,#e2e8f0);border-radius:12px;margin-bottom:10px;overflow:hidden}.eds-card.dirty{border-color:#e0b100;box-shadow:0 0 0 2px rgba(224,177,0,.18)}.eds-card.isnew{border-color:var(--acc-2,#2563eb)}.eds-ch{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--gray-50,#f8fafc);cursor:pointer;font-weight:600;font-size:13px}.eds-ch .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.eds-ch small{font-weight:500;color:var(--gray-500,#64748b)}.eds-cb{padding:12px}.eds-card.col .eds-cb{display:none}.eds-cb .form-grid.full{grid-template-columns:repeat(auto-fit,minmax(250px,1fr));column-gap:16px}.eds-fp{border:1px solid color-mix(in srgb,var(--h) 40%,transparent);border-radius:12px;background:var(--card,#fff);padding:10px 12px;margin:0 0 10px}.eds-fph{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.eds-fph .sp{margin-left:auto;display:flex;gap:6px}.eds-fpg{display:grid;grid-template-columns:minmax(180px,1fr) minmax(200px,1.2fr);gap:6px 14px;max-height:260px;overflow:auto;align-items:center}.eds-fpg .h{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--gray-500,#64748b);font-weight:700}.eds-fpg select{height:32px;margin:0}.eds-empty{padding:10px;font-size:13px;color:var(--gray-500,#64748b)}';
  const css2 = document.createElement('style'); css2.textContent = [
    '.eds-ico{font-style:normal;margin-right:6px}.eds-t{display:inline}.eds-t b{font-weight:700}.eds-t .text-sm{margin-left:6px;text-transform:none;letter-spacing:0;font-weight:500}.eds-foot{display:none}',
    '.eds-sec.eds-pop,.eds-sec.eds-full{padding:0 !important;display:flex;flex-direction:column;overflow:hidden !important;background:var(--card,#fff) !important;border:0 !important}',
    '.eds-sec.eds-pop{border-radius:18px !important}.eds-sec.eds-full{border-radius:0 !important}',
    '.eds-pop>.eds-sh,.eds-full>.eds-sh{position:static !important;margin:0 !important;padding:16px 24px !important;gap:12px;background:var(--acc-grad,linear-gradient(135deg,#1e3a8a,#2563eb)) !important;color:#fff}',
    '.eds-pop .eds-sh h4,.eds-full .eds-sh h4{display:flex;align-items:center;gap:14px;margin:0;color:#fff !important;text-transform:none;letter-spacing:.3px;font-size:19px;font-weight:700}',
    '.eds-pop .eds-ico,.eds-full .eds-ico{width:46px;height:46px;border-radius:13px;background:rgba(255,255,255,.18);display:grid;place-items:center;font-size:24px;margin:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}',
    '.eds-pop .eds-t,.eds-full .eds-t{display:block}.eds-pop .eds-t .text-sm,.eds-full .eds-t .text-sm{display:block;margin:3px 0 0;font-size:12.5px;font-weight:400;opacity:.88;color:#fff}',
    '.eds-pop .eds-sh .sp button,.eds-full .eds-sh .sp button{background:rgba(255,255,255,.14) !important;color:#fff !important;border:1px solid rgba(255,255,255,.3) !important;border-radius:10px !important;padding:7px 13px !important;font-size:12.5px !important;font-weight:600 !important;box-shadow:none !important}',
    '.eds-pop .eds-sh .sp button:hover:not(:disabled),.eds-full .eds-sh .sp button:hover:not(:disabled){background:rgba(255,255,255,.27) !important}',
    '.eds-pop .eds-sh .sp button.success,.eds-full .eds-sh .sp button.success{background:#fff !important;color:var(--acc-1,#1e3a8a) !important;border-color:#fff !important}.eds-pop .eds-sh .sp button:disabled,.eds-full .eds-sh .sp button:disabled{opacity:.5}',
    '.eds-pop .eds-sh .sp input,.eds-full .eds-sh .sp input{border:0;background:rgba(255,255,255,.95);color:#111}',
    '.eds-pop>.eds-fp,.eds-full>.eds-fp{margin:14px 24px 0 !important;flex:none;max-height:42vh;overflow:auto}',
    '.eds-pop>.eds-list,.eds-full>.eds-list{flex:1;min-height:0;overflow:auto;padding:18px 24px 10px;background:var(--gray-50,#f6f8fb)}',
    '.eds-pop .eds-card,.eds-full .eds-card{background:var(--card,#fff);border-radius:16px;box-shadow:0 1px 3px rgba(15,23,42,.05)}',
    '.eds-pop .eds-ch,.eds-full .eds-ch{background:var(--acc-soft,#eaf0fb)}',
    '.eds-pop .eds-cb input:not([type=checkbox]),.eds-pop .eds-cb select,.eds-full .eds-cb input:not([type=checkbox]),.eds-full .eds-cb select{height:38px;border-radius:10px;padding:0 12px;font-size:13.5px}',
    '.eds-pop>.eds-foot,.eds-full>.eds-foot{display:block;padding:12px 24px;border-top:1px solid var(--border,#e2e8f0);background:var(--card,#fff);font-size:12.5px;color:var(--gray-600,#475569)}'
  ].join('\n'); document.head.appendChild(css2);
  document.head.appendChild(css);
  const wrap = document.createElement('div'); wrap.id = 'editorSubWrap'; host.parentNode.insertBefore(wrap, host.nextSibling);
  wrap.innerHTML = '<div class="eds-top"><b>🔗 Linked lists</b><span class="hint">show another list as a sub-form, filtered by the record you are editing</span><button type="button" class="ghost small" data-a="cfg" style="margin-left:auto">⚙ Link a list</button></div><div class="eds-cfg" id="edsCfg"></div><div id="edsSecs"></div>';
  const cfg = wrap.querySelector('#edsCfg'), secs = wrap.querySelector('#edsSecs'), toast = (m, t) => { try { sectionToast(m, t || 'info'); } catch (e) { ed_setStatus(m, t || 'info'); } };
  const tokenOk = () => { const t = getGlobalAccessToken(); if (!t) toast('Global token not configured.', 'warn'); return t; };
  async function ensure(name, items, force) { const token = tokenOk(); if (!token) throw new Error('No token'); let m = meta.get(name); if (!m) { const ids = await resolveIds(getGlobalSiteUrl(), name, token), cols = await fetchColumnsDetailed(ids.siteId, ids.listId, token); m = { name, siteId: ids.siteId, listId: ids.listId, cols, canEdit: isListEditable(name) }; meta.set(name, m); } if (items && (!m.items || force)) m.items = await fetchAllItems(m.siteId, m.listId, token); return m; }
  const pval = (l, it) => l.pf === '@id' ? it.id : (it.fields || {})[l.pf];
  const cval = (col, it) => { const f = it.fields || {}; return col && col.type === 'lookup' ? f[col.name + 'LookupId'] : f[l_name(col)]; }, l_name = c => c ? c.name : '';
  const same = (a, b) => a != null && b != null && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  const kids = (l, m) => { if (!cur) return []; const lc = m.cols.find(c => c.name === l.cf), pv = pval(l, cur); if (pv == null || pv === '') return []; return (m.items || []).filter(it => same(cval(lc, it), pv)); };
  const editCols = (l, m) => m.cols.filter(c => !c.readOnly && c.name !== l.cf), visCols = (l, m) => editCols(l, m).filter(c => c.required || !(l.hid || []).includes(c.name));
  const mval = (l, pf) => pf === '@id' ? cur.id : (cur.fields || {})[pf];
  function fillNew(card, l, m, li, only) { const fl = l.fill || {}; let n = 0; Object.keys(fl).forEach(cn => { if (!fl[cn]) return; const el = document.getElementById('ed_field_' + pfx(li, card.dataset.id) + cn), v = cur ? mval(l, fl[cn]) : null; if (!el || v == null || v === '' || el.disabled) return; if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v); (card._t = card._t || new Set()).add(cn); n++; }); return n; }
  function applyHide(sec, l, m, li) { const hid = l.hid || []; sec.querySelectorAll('.eds-card').forEach(c => editCols(l, m).forEach(col => { const r = c.querySelector('[data-field-row="' + pfx(li, c.dataset.id) + col.name + '"]'); if (r) r.style.display = !col.required && hid.includes(col.name) ? 'none' : ''; let nf = c.querySelector('.eds-nofld'); const vis = editCols(l, m).some(col => col.required || !hid.includes(col.name)); if (!vis && !nf) { nf = document.createElement('div'); nf.className = 'eds-nofld eds-empty'; nf.textContent = 'All optional fields are hidden — click 🧩 Fields to show them. (Autofill still fills hidden fields.)'; c.querySelector('.eds-cb').appendChild(nf); } else if (vis && nf) nf.remove(); })); }
  const pfx = (li, id) => 'sub' + li + '_' + id + '_';
  function cardHtml(l, m, li, it, isNew, open) {
    const id = isNew ? 'n' + (++seq) : it.id, f = it.fields || {}, ttl = f.Title || (isNew ? 'New row' : '#' + it.id), ro = !m.canEdit || !hasPerm('editor-edit');
    return `<div class="eds-card${isNew ? ' isnew' : ''}${open ? '' : ' col'}" data-id="${id}" ${isNew ? 'data-new="1"' : ''}><div class="eds-ch" data-a="tog"><span>${open ? '▾' : '▸'}</span><span class="t">${E(String(ttl))} <small>${isNew ? 'new — not saved yet' : 'ID ' + it.id}</small></span>${isNew && !ro ? '<button type="button" class="ghost small" data-a="af" title="Fill this row from the main record (uses the Fields / Autofill settings)">↧ Autofill</button>' : ''}${ro ? '' : '<button type="button" class="ghost small" data-a="del" title="Delete this record">🗑</button>'}</div><div class="eds-cb"><div class="form-grid full">${editCols(l, m).map(c => ed_renderField(c, f[c.name], { idPrefix: pfx(li, id), readOnly: ro })).join('')}</div></div></div>`;
  }
  async function renderSec(li) {
    const l = getL()[li]; if (!l) return; let sec = secs.querySelector(`[data-li="${li}"]`); if (!sec) { sec = document.createElement('div'); sec.className = 'eds-sec'; sec.dataset.li = li; sec.dataset.hue = li % 4; secs.appendChild(sec); }
    const hid = (() => { try { return localStorage.getItem(HK(li)) === '1'; } catch (e) { return false; } })();
    if (!cur) { sec.innerHTML = `<div class="eds-sh"><h4>🔗 ${E(l.label || l.list)}</h4></div><div class="eds-empty">Select a record to see its linked records.</div>`; return; }
    sec.innerHTML = `<div class="eds-sh"><h4>🔗 ${E(l.label || l.list)}</h4><span class="text-sm">loading…</span></div>`;
    let m; try { m = await ensure(l.list, true); } catch (e) { sec.innerHTML = `<div class="eds-sh"><h4>🔗 ${E(l.label || l.list)}</h4></div><div class="eds-empty" style="color:#b42318">✘ ${E(e.message)}</div>`; return; }
    const K = kids(l, m), ro = !m.canEdit || !hasPerm('editor-edit'), pv = pval(l, cur);
    sec.dataset.n = K.length; sec._K = K;
    sec.innerHTML = `<div class="eds-sh"><h4><i class="eds-ico">🔗</i><span class="eds-t"><b>${E(l.label || l.list)}</b><span class="text-sm">(<span data-c>${K.length}</span>) · ${E(l.cf)} = ${E(String(pv ?? ''))}</span></span></h4><div class="sp"><input type="text" data-a="q" placeholder="🔍 Filter…" ${hid ? 'style="display:none"' : ''}><button type="button" class="ghost small" data-a="ex" title="Expand / collapse all">⇅</button>${ro ? '' : '<button type="button" class="ghost small" data-a="add">＋ Add row</button><button type="button" class="success small" data-a="save" disabled>💾 Save</button>'}<button type="button" class="ghost small" data-a="rel" title="Reload from SharePoint">🔄</button><button type="button" class="ghost small" data-a="fld" title="Show / hide fields and set what is filled automatically from the main record">🧩 Fields</button><button type="button" class="ghost small" data-a="pop" title="Open this sub-form as a pop-up window">${sec.classList.contains('eds-pop') ? '⧉ Dock' : '⧉ Pop up'}</button><button type="button" class="ghost small" data-a="full" title="Fill the whole page">${sec.classList.contains('eds-full') ? '⤡ Restore' : '⤢ Expand'}</button><button type="button" class="ghost small" data-a="hide">${hid ? '👁 Show' : '🙈 Hide'}</button><button type="button" class="ghost small" data-a="rm" title="Remove this link">✕</button></div></div><div class="eds-fp" style="display:none"></div><div class="eds-list" ${hid ? 'style="display:none"' : ''}>${K.length ? K.map((it, i) => cardHtml(l, m, li, it, false, K.length <= 3 || i < 1)).join('') : '<div class="eds-empty" data-e>No linked records' + (ro ? '.' : ' — use ＋ Add row.') + '</div>'}</div><div class="eds-foot">Change any field, then 💾 Save · ＋ Add row creates a record linked to the main record · Esc = close</div>`;
    sug(sec, m); applyHide(sec, l, m, li);
  }
  function drawFp(sec, l, m, li) { const fp = sec.querySelector('.eds-fp'), hid = l.hid || [], fl = l.fill || {}, mo = '<option value="">— no autofill —</option><option value="@id">Main record ID</option>' + editorState.columns.map(c => `<option value="${E(c.name)}">${E(c.displayName || c.name)}</option>`).join('');
    fp.innerHTML = '<div class="eds-fph"><b>Fields of this sub-form</b><span class="text-sm">☑ show · when you add a row, “Autofill” copies the chosen value from the main record you are editing</span><span class="sp"><button type="button" class="ghost small" data-q="all">Show all</button><button type="button" class="ghost small" data-q="none">Hide all optional</button><button type="button" class="ghost small" data-q="x">Clear autofill</button></span></div><div class="eds-fpg"><span class="h">Field</span><span class="h">Autofill from main record</span>' + editCols(l, m).map(c => `<label class="ed-ci"><input type="checkbox" data-hf="${E(c.name)}" ${hid.includes(c.name) && !c.required ? '' : 'checked'} ${c.required ? 'disabled' : ''}> ${E(c.displayName || c.name)}${c.required ? ' <span class="required">*</span>' : ''}</label><select data-af="${E(c.name)}">${mo.replace('value="' + E(fl[c.name] || '') + '"', 'value="' + E(fl[c.name] || '') + '" selected')}</select>`).join('') + '</div>'; }
  function sug(root, m) { try { m.cols.forEach(c => { if (!['text', 'number', 'multiline'].includes(c.type) || c.readOnly) return; root.querySelectorAll(`[data-field="${CSS.escape(c.name)}"]`).forEach(el => { if (!el.disabled && !el.closest('.suggest-wrap')) attachFieldSuggestions(el, c.name, m.items || [], (getL()[+root.dataset.li] || {}).list || ''); }); }); } catch (e) { console.error(e); } }
  async function renderAll() { const L = getL(); secs.innerHTML = ''; for (let i = 0; i < L.length; i++) await renderSec(i); }
  window.edSubRefresh = item => { cur = item; if (!editorState.listId) return; renderAll(); };
  const upd = sec => { const n = sec.querySelectorAll('.eds-card.dirty,.eds-card.isnew').length, b = sec.querySelector('[data-a=save]'); if (b) { b.disabled = !n; b.textContent = n ? '💾 Save (' + n + ')' : '💾 Save'; } };
  secs.addEventListener('input', e => { const c = e.target.closest('.eds-card'); if (!c) { if (e.target.dataset.a === 'q') { const v = e.target.value.trim().toLowerCase(), sec = e.target.closest('.eds-sec'); sec.querySelectorAll('.eds-card').forEach(cd => { cd.style.display = !v || cd.textContent.toLowerCase().includes(v) || [...cd.querySelectorAll('input,select,textarea')].some(x => String(x.value).toLowerCase().includes(v)) ? '' : 'none'; }); } return; } const fn = e.target.dataset && e.target.dataset.field; if (fn) { (c._t = c._t || new Set()).add(fn); c.classList.add('dirty'); upd(c.closest('.eds-sec')); } });
  secs.addEventListener('change', e => { const hf = e.target.dataset && e.target.dataset.hf, af = e.target.dataset && e.target.dataset.af; if (hf || af) { const sec = e.target.closest('.eds-sec'), li = +sec.dataset.li, L = getL(), l = L[li], m = meta.get(l.list); if (hf) { const h = new Set(l.hid || []); e.target.checked ? h.delete(hf) : h.add(hf); l.hid = [...h]; } else { l.fill = l.fill || {}; if (e.target.value) l.fill[af] = e.target.value; else delete l.fill[af]; } setL(L); applyHide(sec, l, m, li); return; } const c = e.target.closest('.eds-card'); const fn = e.target.dataset && e.target.dataset.field; if (c && fn) { (c._t = c._t || new Set()).add(fn); c.classList.add('dirty'); upd(c.closest('.eds-sec')); } });
  secs.addEventListener('click', async e => {
    const q = e.target.closest('.eds-fp [data-q]'); if (q) { const sec = q.closest('.eds-sec'), li = +sec.dataset.li, L = getL(), l = L[li], m = meta.get(l.list); if (q.dataset.q === 'all') l.hid = []; else if (q.dataset.q === 'none') l.hid = editCols(l, m).filter(c => !c.required).map(c => c.name); else l.fill = {}; setL(L); drawFp(sec, l, m, li); applyHide(sec, l, m, li); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const sec = b.closest('.eds-sec'), li = +sec.dataset.li, l = getL()[li], a = b.dataset.a; if (!l) return;
    if (a === 'tog') { if (e.target.closest('[data-a=del]')) return; const c = b.closest('.eds-card'); c.classList.toggle('col'); b.firstElementChild.textContent = c.classList.contains('col') ? '▸' : '▾'; return; }
    if (a === 'ex') { const cs = [...sec.querySelectorAll('.eds-card')], anyOpen = cs.some(c => !c.classList.contains('col')); cs.forEach(c => { c.classList.toggle('col', anyOpen); c.querySelector('.eds-ch>span').textContent = anyOpen ? '▸' : '▾'; }); return; }
    if (a === 'fld') { const fp = sec.querySelector('.eds-fp'), m0 = meta.get(l.list); if (!m0) return; const on = fp.style.display === 'none'; if (on) drawFp(sec, l, m0, li); fp.style.display = on ? '' : 'none'; return; }
    if (a === 'af') { const c = b.closest('.eds-card'), m1 = meta.get(l.list), n = fillNew(c, l, m1, li); c.classList.add('dirty'); upd(sec); toast(n ? '↧ ' + n + ' field(s) filled from the main record' : 'Nothing to fill — choose “Autofill from main record” in 🧩 Fields first.', n ? 'success' : 'warn'); return; }
    if (a === 'full' || a === 'pop') { const cls = a === 'full' ? 'eds-full' : 'eds-pop', on = !sec.classList.contains(cls); sec.classList.remove('eds-full', 'eds-pop'); if (on) sec.classList.add(cls); const bf = sec.querySelector('[data-a=full]'), bp = sec.querySelector('[data-a=pop]'); if (bf) bf.textContent = sec.classList.contains('eds-full') ? '⤡ Restore' : '⤢ Expand'; if (bp) bp.textContent = sec.classList.contains('eds-pop') ? '⧉ Dock' : '⧉ Pop up'; document.body.style.overflow = on ? 'hidden' : ''; return; }
    if (a === 'hide') { const h = !(localStorage.getItem(HK(li)) === '1'); try { localStorage.setItem(HK(li), h ? '1' : '0'); } catch (_) {} sec.querySelector('.eds-list').style.display = h ? 'none' : ''; sec.querySelector('[data-a=q]').style.display = h ? 'none' : ''; b.textContent = h ? '👁 Show' : '🙈 Hide'; return; }
    if (a === 'rm') { if (!confirm('Remove the link to "' + (l.label || l.list) + '"? The list itself and its data are not touched.')) return; const L = getL(); L.splice(li, 1); setL(L); renderAll(); return; }
    if (a === 'rel') { const m = meta.get(l.list); if (m) m.items = null; renderSec(li); return; }
    const m = meta.get(l.list); if (!m) return;
    if (a === 'add') { const list = sec.querySelector('.eds-list'); const em = list.querySelector('[data-e]'); if (em) em.remove(); list.insertAdjacentHTML('afterbegin', cardHtml(l, m, li, { fields: {} }, true, true)); const c = list.firstElementChild; sug(c, m); applyHide(sec, l, m, li); fillNew(c, l, m, li); c.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled])')?.focus(); upd(sec); return; }
    if (a === 'del') { const c = b.closest('.eds-card'); if (c.dataset.new) { c.remove(); upd(sec); return; } if (!confirm('Delete this linked record (ID ' + c.dataset.id + ') from "' + m.name + '"?')) return; try { await deleteItem(m.siteId, m.listId, c.dataset.id, getGlobalAccessToken()); m.items = (m.items || []).filter(x => String(x.id) !== String(c.dataset.id)); c.remove(); sec.querySelector('[data-c]').textContent = sec.querySelectorAll('.eds-card:not([data-new])').length; upd(sec); toast('🗑 Deleted from ' + m.name, 'success'); try { addActivity('edit', 'Deleted item #' + c.dataset.id + ' from linked list ' + m.name); } catch (_) {} } catch (er) { toast('✘ ' + er.message, 'error'); } return; }
    if (a === 'save') {
      const token = tokenOk(); if (!token) return; const cards = [...sec.querySelectorAll('.eds-card.dirty,.eds-card.isnew')], lc = m.cols.find(c => c.name === l.cf), pv = pval(l, cur), cols = editCols(l, m); let ok = 0, bad = 0, miss = false;
      cards.forEach(c => { if (c.dataset.new) cols.forEach(col => { const el = document.getElementById('ed_field_' + pfx(li, c.dataset.id) + col.name); const v = el ? ed_readField(col, pfx(li, c.dataset.id)) : null; const e2 = col.required && (v === null || v === ''); if (el) el.classList.toggle('ed-bad', e2); if (e2) miss = true; }); });
      if (miss) { toast('Fill in the required fields (marked red) of the new row(s).', 'warn'); return; }
      b.disabled = true;
      for (const c of cards) { try {
        if (c.dataset.new) { const fields = {}; cols.forEach(col => { const v = ed_readField(col, pfx(li, c.dataset.id)); if (v !== null && v !== undefined && v !== '') fields[col.name] = v; }); if (lc && lc.type === 'lookup') fields[lc.name + 'LookupId'] = Number(pv); else fields[l.cf] = lc && lc.type === 'number' ? Number(pv) : String(pv); const created = await createItem(m.siteId, m.listId, fields, token); (m.items = m.items || []).push(created); try { addActivity('edit', 'Created item #' + created.id + ' in linked list ' + m.name); } catch (_) {} }
        else { const fields = {}; [...(c._t || [])].forEach(n => { const col = cols.find(x => x.name === n); if (col) fields[n] = ed_readField(col, pfx(li, c.dataset.id)); }); if (!Object.keys(fields).length) { c.classList.remove('dirty'); continue; } await updateItem(m.siteId, m.listId, c.dataset.id, fields, token); const it = (m.items || []).find(x => String(x.id) === String(c.dataset.id)); if (it) Object.assign(it.fields = it.fields || {}, fields); try { addActivity('edit', 'Updated item #' + c.dataset.id + ' in linked list ' + m.name); } catch (_) {} }
        ok++; } catch (er) { bad++; c.classList.add('ed-bad'); toast('✘ ' + er.message, 'error'); } }
      toast(bad ? `⚠ ${ok} saved, ${bad} failed in ${m.name}` : `✅ ${ok} record(s) saved to ${m.name}`, bad ? 'warn' : 'success'); if (ok) renderSec(li); else b.disabled = false; return;
    }
  });
  /* configuration: pick a list, the field of that list that holds the link, and the field of this list it must match */
  wrap.addEventListener('click', e => { const b = e.target.closest('.eds-top [data-a=cfg]'); if (b) { cfg.classList.toggle('open'); if (cfg.classList.contains('open')) drawCfg(); } });
  function drawCfg() {
    cfg.innerHTML = '<b style="font-size:13px">Link another list</b><div class="g"><div class="form-group"><label>List to show as sub-form</label><div id="edsPick"></div></div><div class="form-group"><label>Field in that list that holds the link</label><select id="edsCf"><option value="">— pick the list first —</option></select></div><div class="form-group"><label>Matches this field of the record you edit</label><select id="edsPf"><option value="@id">ID (record number)</option>' + editorState.columns.map(c => `<option value="${E(c.name)}">${E(c.displayName || c.name)}</option>`).join('') + '</select></div><div class="form-group"><label>Section title <span class="hint">(optional)</span></label><input type="text" id="edsLab" placeholder="e.g. Batches"></div></div><div class="btn-row"><button type="button" class="small" id="edsAdd">＋ Add this link</button><button type="button" class="ghost small" id="edsClose">Close</button></div><div class="text-sm" id="edsMsg"></div>';
    const loadCols = async name => { const sel = cfg.querySelector('#edsCf'), msg = cfg.querySelector('#edsMsg'); if (!name) return; msg.textContent = 'Loading fields of ' + name + '…'; try { const m = await ensure(name, false); pickCols = m.cols; sel.innerHTML = '<option value="">— choose —</option>' + m.cols.filter(c => !['calculated'].includes(c.type)).map(c => `<option value="${E(c.name)}">${E(c.displayName || c.name)} (${c.type})</option>`).join(''); msg.textContent = '✓ ' + m.cols.length + ' fields found.'; } catch (er) { msg.textContent = '✘ ' + er.message; } };
    picker = createListPicker(cfg.querySelector('#edsPick'), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: v => loadCols(v || (picker && picker.getValue())) });
    cfg.querySelector('#edsClose').onclick = () => cfg.classList.remove('open');
    cfg.querySelector('#edsAdd').onclick = () => { const list = picker && picker.getValue(), cf = cfg.querySelector('#edsCf').value, pf = cfg.querySelector('#edsPf').value, msg = cfg.querySelector('#edsMsg'); if (!list || !cf) { msg.textContent = 'Pick the list and the field that holds the link.'; return; } if (!isListVisible(list)) { msg.textContent = '✘ You do not have permission to access "' + list + '".'; return; } const L = getL(); L.push({ list, cf, pf, label: cfg.querySelector('#edsLab').value.trim() }); setL(L); cfg.classList.remove('open'); renderAll(); };
  }
})();
