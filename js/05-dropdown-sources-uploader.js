/* ============================================================
   Dropdown sources — per field: user-defined (custom values / another SharePoint list) or, when not defined,
   the history of the same field (loaded rows + values typed before). Used by Add, Edit, Inline, sub-forms and filters.
   ============================================================ */
const DD = { cache: new Map(), busy: new Set() };
const ddAll = () => { try { return JSON.parse(localStorage.getItem(profileKey('ddsrc')) || '{}') || {}; } catch (e) { return {}; } };
const ddSpec = (list, field) => (ddAll()[list || ''] || {})[field] || null;
const ddHistAll = () => { try { return JSON.parse(localStorage.getItem(profileKey('ddhist')) || '{}') || {}; } catch (e) { return {}; } };
function ddHistAdd(list, field, v) {
  v = String(v == null ? '' : v).trim(); if (!v || v.length > 120) return;
  try { const H = ddHistAll(); [(list || '') + '|' + field, '*|' + field].forEach(k => { const a = (H[k] || []).filter(x => x.toLowerCase() !== v.toLowerCase()); a.unshift(v); H[k] = a.slice(0, 300); }); localStorage.setItem(profileKey('ddhist'), JSON.stringify(H)); } catch (e) {}
}
const ddHist = (list, field) => { const H = ddHistAll(); return [...(H[(list || '') + '|' + field] || []), ...(H['*|' + field] || [])]; };
const ddSort = a => a.sort((x, y) => x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' }));
const ddUniq = a => { const s = new Set(), o = []; a.forEach(v => { v = String(v == null ? '' : v).trim(); const k = v.toLowerCase(); if (v && !s.has(k)) { s.add(k); o.push(v); } }); return o; };
DD.lists = null;
async function ddSiteLists() {
  if (DD.lists) return DD.lists;
  const t = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!t || !site) throw new Error('Not connected — token or Site URL missing');
  const base = await resolveIds(site, editorState.listName || 'x', t).catch(() => null); const sid = (editorState.siteId) || (base && base.siteId); if (!sid) throw new Error('Could not resolve the site');
  let url = 'https://graph.microsoft.com/v1.0/sites/' + sid + '/lists?$select=id,displayName&$top=500', out = [];
  while (url && out.length < 3000) { const r = await fetchWithRetry(url, { headers: { Authorization: 'Bearer ' + t } }, 'lists'); if (!r.ok) throw new Error('Could not read the lists of the site (' + r.status + ')'); const d = await r.json(); out = out.concat((d.value || []).map(l => ({ id: l.id, name: l.displayName }))); url = d['@odata.nextLink']; }
  DD.lists = { siteId: sid, lists: out }; return DD.lists;
}
async function ddResolve(name) {
  const L = await ddSiteLists(), n = String(name || '').trim().toLowerCase(), hit = L.lists.find(l => l.name.toLowerCase() === n) || L.lists.find(l => l.name.toLowerCase().replace(/[\s_]+/g, '') === n.replace(/[\s_]+/g, ''));
  if (!hit) throw new Error('List "' + name + '" not found on this site');
  return { siteId: L.siteId, listId: hit.id, name: hit.name };
}
async function ddListLoad(spec) {
  const key = spec.list + '|' + spec.col; if (DD.cache.has(key) || DD.busy.has(key)) return DD.cache.get(key) || [];
  DD.busy.add(key);
  try {
    const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) return [];
    const ids = await ddResolve(spec.list); let items;
    try { items = await fetchRecentItems(ids.siteId, ids.listId, token, 5000); } catch (e) { items = await fetchAllItems(ids.siteId, ids.listId, token); }
    const v = ddSort(ddUniq((items || []).map(it => { const x = (it.fields || {})[spec.col]; return x && typeof x === 'object' ? (Array.isArray(x) ? x.join('; ') : '') : x; })));
    DD.cache.set(key, v); return v;
  } catch (e) { console.warn('Dropdown source failed', e); return []; } finally { DD.busy.delete(key); }
}
/* values for one field: returns null = no dropdown, else an array */
function ddValues(list, field, autoVals) {
  const sp = ddSpec(list, field), auto = () => ddSort(ddUniq([...(autoVals || []), ...ddHist(list, field)]));
  if (!sp || sp.mode === 'auto') return auto();
  if (sp.mode === 'off') return null;
  if (sp.mode === 'custom') return ddUniq(sp.values || []);
  if (sp.mode === 'list') { const k = sp.list + '|' + sp.col; if (!DD.cache.has(k)) { ddListLoad(sp); return []; } return DD.cache.get(k); }
  return auto();
}
function ddOpts(list, field, autoVals) { const sp = ddSpec(list, field); if (sp && sp.mode === 'list' && !DD.cache.has(sp.list + '|' + sp.col)) ddListLoad(sp); const v = ddValues(list, field, autoVals); return v == null ? (autoVals || []) : v; }
const ddIsExplicit = (list, field) => { const s = ddSpec(list, field); return !!s && (s.mode === 'custom' || s.mode === 'list'); };

function ddOpenCfg() {
  if (!editorState.listName || !editorState.columns.length) { sectionToast('Connect to a list first.', 'warn'); return; }
  const list = editorState.listName, all = ddAll(), cur = Object.assign({}, all[list] || {}), E = escapeHtml;
  const cols = editorState.columns.filter(c => ['text', 'number', 'multiline'].includes(c.type) && ed_isEditable(c));
  let m = document.querySelector('#ddModal'); if (m) m.remove();
  m = document.createElement('div'); m.id = 'ddModal'; m.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:18px';
  const pool = editorState.suggestionItems.length ? editorState.suggestionItems : editorState.items;
  m.innerHTML = '<div style="background:var(--card,#fff);color:var(--gray-800,#1e293b);border-radius:14px;max-width:1100px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4)">'
    + '<div style="padding:14px 18px;border-bottom:1px solid var(--gray-200,#e2e8f0);display:flex;align-items:center;gap:10px"><b style="font-size:16px">⚙ Dropdown sources — ' + E(list) + '</b><span class="text-sm" style="flex:1">For every field choose where its dropdown comes from. If you leave a field on <b>History</b>, it suggests the values already used in that field (rows loaded + values typed before). Applies to Add, Edit, Inline edit, sub-forms and filters.</span><button type="button" class="ghost small" data-dd="x">✕</button></div>'
    + '<div style="overflow:auto;padding:10px 18px;flex:1"><table class="fd-tbl" style="width:100%"><thead><tr><th>Field</th><th>Dropdown source</th><th>Details</th><th>Only these</th></tr></thead><tbody>'
    + cols.map((c, i) => '<tr data-f="' + E(c.name) + '"><td><b>' + E(c.displayName || c.name) + '</b><div class="text-sm">' + E(c.name) + '</div></td><td><select data-k="mode"><option value="auto">History of this field (default)</option><option value="custom">My own values</option><option value="list">Another SharePoint list</option><option value="off">No dropdown</option></select></td><td data-k="det"></td><td style="text-align:center"><input type="checkbox" data-k="strict" title="Reject values that are not in the dropdown"></td></tr>').join('')
    + '</tbody></table></div><div style="padding:12px 18px;border-top:1px solid var(--gray-200,#e2e8f0);display:flex;gap:8px;justify-content:flex-end"><span class="text-sm" id="ddMsg" style="margin-right:auto"></span><button type="button" class="ghost small" data-dd="x">Cancel</button><button type="button" class="success small" data-dd="save">💾 Save</button></div></div>';
  document.body.appendChild(m);
  const draw = tr => {
    const f = tr.dataset.f, s = cur[f] || { mode: 'auto' }, det = tr.querySelector('[data-k="det"]'); tr.querySelector('[data-k="mode"]').value = s.mode || 'auto'; tr.querySelector('[data-k="strict"]').checked = !!s.strict; tr.querySelector('[data-k="strict"]').disabled = s.mode === 'off';
    if (s.mode === 'custom') det.innerHTML = '<textarea rows="3" data-k="vals" style="width:100%" placeholder="One value per line">' + E((s.values || []).join('\n')) + '</textarea><button type="button" class="ghost small" data-dd="fill">Fill from history</button>';
    else if (s.mode === 'list') { det.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap"><input type="text" data-k="list" list="ddLists" placeholder="Type or pick the list name" value="' + E(s.list || '') + '" style="min-width:200px"><select data-k="col"><option value="' + E(s.col || '') + '">' + E(s.col || '— pick the column —') + '</option></select><button type="button" class="ghost small" data-dd="cols">Load columns</button></div><div class="text-sm" data-k="st"></div>'; if (s.list && !s.col) setTimeout(() => loadCols(tr), 0); }
    else if (s.mode === 'off') det.innerHTML = '<span class="text-sm">No dropdown on this field.</span>';
    else det.innerHTML = '<span class="text-sm">' + ddValues(list, f, distinctFieldValues(pool, f)).length.toLocaleString() + ' value(s) in the history</span>';
  };
  const loadCols = async tr => {
    const inp = tr.querySelector('[data-k="list"]'), sel = tr.querySelector('[data-k="col"]'), st = tr.querySelector('[data-k="st"]'); if (!inp) return; const ln = inp.value.trim();
    if (!ln) { st.style.color = '#b42318'; st.textContent = 'Type or pick the list name first.'; return; }
    st.style.color = ''; st.textContent = 'Loading columns of ' + ln + '…';
    try { const t = getGlobalAccessToken(), ids = await ddResolve(ln), cs = (await fetchColumns(ids.siteId, ids.listId, t)), keep = sel.value; inp.value = ids.name; sel.innerHTML = '<option value="">— pick the column —</option>' + cs.map(c => '<option value="' + E(c.name) + '">' + E(c.displayName || c.name) + (c.name !== c.displayName ? ' (' + E(c.name) + ')' : '') + '</option>').join(''); const guess = cs.find(c => c.name === keep) || cs.find(c => c.name === tr.dataset.f) || cs.find(c => (c.displayName || '').toLowerCase() === ids.name.toLowerCase()); if (guess) sel.value = guess.name; st.textContent = '✓ ' + cs.length + ' columns — pick the one that holds the values'; } catch (er) { st.style.color = '#b42318'; st.textContent = '✘ ' + er.message; }
  };
  m.querySelectorAll('tbody tr').forEach(draw);
  ddSiteLists().then(L => { let dl = m.querySelector('#ddLists'); if (!dl) { dl = document.createElement('datalist'); dl.id = 'ddLists'; m.appendChild(dl); } dl.innerHTML = L.lists.map(l => '<option value="' + E(l.name) + '">').join(''); }).catch(() => {});
  const grab = tr => { const f = tr.dataset.f, mode = tr.querySelector('[data-k="mode"]').value, s = { mode, strict: tr.querySelector('[data-k="strict"]').checked }; if (mode === 'custom') s.values = ddUniq(((tr.querySelector('[data-k="vals"]') || {}).value || '').split(/\r?\n/)); if (mode === 'list') { s.list = ((tr.querySelector('[data-k="list"]') || {}).value || '').trim(); s.col = (tr.querySelector('[data-k="col"]') || {}).value || ''; } cur[f] = s; return s; };
  m.addEventListener('change', e => { const tr = e.target.closest('tr[data-f]'); if (!tr) return; if (e.target.dataset.k === 'mode') { const strict = tr.querySelector('[data-k="strict"]').checked; cur[tr.dataset.f] = { mode: e.target.value, strict }; draw(tr); } else if (e.target.dataset.k === 'list') loadCols(tr); });
  m.addEventListener('click', async e => {
    const b = e.target.closest('[data-dd]'); if (!b) { if (e.target === m) m.remove(); return; }
    const k = b.dataset.dd, tr = b.closest('tr[data-f]');
    if (k === 'x') m.remove();
    else if (k === 'fill' && tr) { tr.querySelector('[data-k="vals"]').value = ddValues(list, tr.dataset.f, distinctFieldValues(pool, tr.dataset.f)).join('\n'); }
    else if (k === 'cols' && tr) {
      await loadCols(tr);
    } else if (k === 'save') {
      const out = {}; let bad = null; m.querySelectorAll('tbody tr').forEach(tr => { const s = grab(tr); if (s.mode === 'list' && (!s.list || !s.col)) { if (!bad) bad = tr; return; } if (s.mode === 'custom' && !(s.values || []).length) { if (!bad) bad = tr; return; } if (s.mode !== 'auto' || s.strict) out[tr.dataset.f] = s; });
      if (bad) { bad.scrollIntoView({ block: 'center' }); bad.style.outline = '2px solid #b42318'; m.querySelector('#ddMsg').style.color = '#b42318'; m.querySelector('#ddMsg').textContent = 'Finish “' + bad.dataset.f + '”: ' + (grab(bad).mode === 'list' ? 'pick the list and the column.' : 'type at least one value.'); return; }
      const A = ddAll(); if (Object.keys(out).length) A[list] = out; else delete A[list]; try { localStorage.setItem(profileKey('ddsrc'), JSON.stringify(A)); } catch (er) {}
      DD.cache.clear(); m.remove(); ddRefreshUi(); sectionToast('Dropdown sources saved for ' + list + '.', 'success');
    }
  });
}
function ddRefreshUi() {
  try {
    ed_attachAllSuggestions($('editorCreateForm')); const ef = $('editorEditForm'); if (ef && editorState.selectedItemId) ed_attachAllSuggestions(ef);
    ed_renderInlineTable(); ed_renderQuickSearch();
  } catch (e) { console.warn(e); }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = document.querySelector('#ddModal'); if (m) m.remove(); } });



/* ============================================================
   UPLOADER
   ============================================================ */
const uploadState = {
  parsedRows: [], parsedHeaders: [], targets: [], activeTargetId: null, lastFile: null,
  groupByFields: [],
  groupOrder: 'asc',
  withinGroupOrder: 'file',
};
function u_log(msg) { const el = $('uploadLog'); el.style.display = 'block'; el.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`; el.scrollTop = el.scrollHeight; }
function u_setStatus(msg, type = 'info') { const el = $('uploadStatus'); el.className = 'status-msg ' + type; el.textContent = msg; }
function loadTargetsForProfile() {
  try {
    const raw = localStorage.getItem(profileKey('targets'));
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) uploadState.targets = p.map(t => ({ ...t, id: t.id || uid(), columns: [], siteId: null, listId: null, _picker: null })); else uploadState.targets = []; }
    else uploadState.targets = [];
  } catch (e) { uploadState.targets = []; }
  if (!uploadState.targets.length) {
    const p = getActiveProfile();
    uploadState.targets.push({ id: uid(), listName: p.defaultList || '', filter: "", columns: [], siteId: null, listId: null, mapping: {}, _picker: null });
  }
  uploadState.activeTargetId = uploadState.targets[0].id;
}
function u_persist() {
  try {
    const ser = uploadState.targets.map(t => ({ id: t.id, listName: t.listName, filter: t.filter, mapping: t.mapping }));
    localStorage.setItem(profileKey('targets'), JSON.stringify(ser));
  } catch (e) {}
}
function u_renderTargets() {
  const container = $('targetsContainer'); container.innerHTML = '';
  uploadState.targets.forEach((t, idx) => {
    const card = document.createElement('div'); card.className = 'target-card' + (t.id === uploadState.activeTargetId ? ' active' : '');
    const dotClass = t.listId ? 'ok' : (t.lastError ? 'err' : '');
    const filterBadge = t.filter ? ' <span class="badge filter">FILTER</span>' : '';
    const listBadge = t.listId ? ' <span class="badge list">LINKED</span>' : '';
    card.innerHTML = `
      <div class="target-header">
        <div class="target-title"><span class="status-dot ${dotClass}"></span><span>Target ${idx + 1}: ${escapeHtml(t.listName || "(unnamed)")}</span>${filterBadge}${listBadge}</div>
        <div class="btn-row">
          <button class="secondary small" data-action="test" data-id="${t.id}" type="button">🔍 Load Columns</button>
          ${uploadState.targets.length > 1 ? `<button class="danger small icon-only" data-action="remove" data-id="${t.id}" type="button">✖</button>` : ''}
        </div>
      </div>
      <div class="target-body">
        <div class="form-group"><label>List Name <span class="hint">— searchable</span></label><div class="target-list-picker" data-id="${t.id}"></div></div>
        <div class="form-group"><label>Row Filter <span class="hint">(optional JS expression)</span></label><input type="text" class="target-filter" data-id="${t.id}" value="${escapeHtml(t.filter || '')}" placeholder='e.g. row.Action_Type === "Receive"' /></div>
        <div class="text-sm mt-2">${t.columns.length ? `✓ ${t.columns.length} writable columns loaded` : '⚠ Columns not loaded yet'}</div>
      </div>`;
    card.querySelector('.target-header').addEventListener('click', (e) => { if (e.target.closest('button')) return; uploadState.activeTargetId = t.id; u_renderTargets(); u_renderMappingTable(); });
    card.querySelector('.target-filter').addEventListener('input', (e) => { t.filter = e.target.value.trim(); u_persist(); });
    t._picker = createListPicker(card.querySelector('.target-list-picker'), {
      getSiteUrl: () => getGlobalSiteUrl(),
      getToken: () => getGlobalAccessToken(),
      initialValue: t.listName || '',
      onChange: (val) => {
        t.listName = val; t.siteId = null; t.listId = null; u_persist();
        const titleEl = card.querySelector('.target-title span:nth-child(2)');
        if (titleEl) titleEl.textContent = `Target ${idx + 1}: ${val || '(unnamed)'}`;
      },
    });
    card.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const a = btn.dataset.action, id = btn.dataset.id;
        const target = uploadState.targets.find(x => x.id === id);
        if (!target) return;
        if (a === 'test') { uploadState.activeTargetId = id; u_renderTargets(); await u_loadColumnsForTarget(target); u_renderTargets(); u_renderMappingTable(); u_refreshUploadBtn(); }
        else if (a === 'remove') {
          uploadState.targets = uploadState.targets.filter(x => x.id !== id);
          if (uploadState.activeTargetId === id && uploadState.targets.length) uploadState.activeTargetId = uploadState.targets[0].id;
          u_persist(); u_renderTargets(); u_renderMappingTable(); u_refreshUploadBtn();
        }
      });
    });
    container.appendChild(card);
  });
}
$('addTargetBtn').addEventListener('click', () => {
  const nt = { id: uid(), listName: "", filter: "", columns: [], siteId: null, listId: null, mapping: {}, _picker: null };
  uploadState.targets.push(nt); uploadState.activeTargetId = nt.id;
  u_persist(); u_renderTargets(); u_renderMappingTable();
});
$('loadAllColumnsBtn').addEventListener('click', async () => {
  const token = getGlobalAccessToken();
  if (!token) { $('columnsStatus').textContent = '⚠ Token not configured'; return; }
  $('columnsStatus').textContent = 'Loading...'; let ok = 0;
  for (const t of uploadState.targets) { try { await u_loadColumnsForTarget(t); ok++; } catch (err) { u_log(`Target "${t.listName}": ${err.message}`); } }
  $('columnsStatus').textContent = `✓ ${ok}/${uploadState.targets.length} targets loaded`;
  u_renderTargets(); u_renderMappingTable(); u_refreshUploadBtn();
});
async function u_loadColumnsForTarget(t) {
  const token = getGlobalAccessToken();
  const siteUrl = getGlobalSiteUrl();
  if (!token) throw new Error('Global token not configured');
  if (!siteUrl) throw new Error('Global site URL not configured');
  if (!t.listName) throw new Error('List name missing');
  if (!isListVisible(t.listName)) throw new Error(`You do not have permission to access "${t.listName}"`);
  if (!isListEditable(t.listName)) throw new Error(`You have READ-ONLY access to "${t.listName}" — uploads blocked`);
  const ids = await resolveIds(siteUrl, t.listName, token);
  t.siteId = ids.siteId; t.listId = ids.listId; t.lastError = null;
  const cols = await fetchColumns(t.siteId, t.listId, token);
  t.columns = cols.filter(c => { const n = c.name.toLowerCase(); return !READ_ONLY_COLUMNS.has(n); });
  u_log(`Target "${t.listName}": loaded ${t.columns.length} writable columns`);
  if (uploadState.parsedHeaders.length) u_autoMapTarget(t);
  u_persist();
}
function u_autoMapTarget(t) {
  if (!t.columns.length || !uploadState.parsedHeaders.length) return;
  const saved = u_loadSavedMapping(t.listName);
  const nm = {};
  uploadState.parsedHeaders.forEach(header => {
    const hKey = header.toLowerCase().trim();
    if (saved[header] !== undefined) { const target = saved[header]; if (target === SKIP_VALUE || t.columns.some(c => c.name === target)) { nm[header] = target; return; } }
    const exact = t.columns.find(c => c.displayName.toLowerCase() === hKey || c.name.toLowerCase() === hKey);
    if (exact) { nm[header] = exact.name; return; }
    const hNorm = normalize(header);
    const norm = t.columns.find(c => normalize(c.displayName) === hNorm || normalize(c.name) === hNorm);
    if (norm) { nm[header] = norm.name; return; }
    if (READ_ONLY_COLUMNS.has(hKey)) { nm[header] = SKIP_VALUE; return; }
    nm[header] = SKIP_VALUE;
  });

  /* Preserve a saved mapping for the synthetic field if the column still exists */
  const savedUser = saved[CURRENT_USER_FIELD_KEY];
  const hit = findCurrentUserColumn(t.columns);
  if (savedUser && savedUser !== SKIP_VALUE && t.columns.some(c => c.name === savedUser)) {
    nm[CURRENT_USER_FIELD_KEY] = savedUser;
  } else if (hit) {
    nm[CURRENT_USER_FIELD_KEY] = hit.name;
  } else {
    nm[CURRENT_USER_FIELD_KEY] = SKIP_VALUE;
  }

  t.mapping = nm;
}
function u_renderMappingTable() {
  const section = $('mappingSection');
  const t = uploadState.targets.find(x => x.id === uploadState.activeTargetId);
  if (!t || !uploadState.parsedHeaders.length || !t.columns.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  $('mappingTargetName').textContent = t.listName || '(unnamed)';
  const body = $('mappingBody'); body.innerHTML = '';
  const filterQ = ($('fieldFilter').value || '').trim().toLowerCase();

  /* Synthetic Current User row goes first */
  const headersForMapping = [CURRENT_USER_FIELD_KEY, ...uploadState.parsedHeaders];

  headersForMapping.forEach(header => {
    const isSynthetic = header === CURRENT_USER_FIELD_KEY;
    const displayLabel = isSynthetic ? CURRENT_USER_FIELD_LABEL : escapeHtml(header);
    const sampleValue = isSynthetic
      ? getCurrentUserValue()
      : (uploadState.parsedRows[0]?.[header] ?? '');
    const current = t.mapping[header] || SKIP_VALUE;
    const badge = current === SKIP_VALUE ? '<span class="badge skip">SKIP</span>' : '<span class="badge auto">→</span>';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${displayLabel}</strong> ${badge}</td>` +
                   `<td class="sample-value" title="${escapeHtml(String(sampleValue))}">${escapeHtml(String(sampleValue).slice(0, 50))}</td>` +
                   `<td class="combo-cell"></td>`;
    let cols = t.columns;
    if (filterQ) cols = t.columns.filter(c => c.displayName.toLowerCase().includes(filterQ) || c.name.toLowerCase().includes(filterQ));
    const combo = buildCombo(current, cols, (nv) => {
      t.mapping[header] = nv; u_persist(); u_updateMappingSummary(); u_refreshUploadBtn();
      const bc = tr.querySelector('td:first-child');
      const isSkip = nv === SKIP_VALUE;
      bc.innerHTML = `<strong>${displayLabel}</strong> ${isSkip ? '<span class="badge skip">SKIP</span>' : '<span class="badge auto">→</span>'}`;
    });
    tr.querySelector('.combo-cell').appendChild(combo);
    body.appendChild(tr);
  });

  u_updateMappingSummary();
}
function u_updateMappingSummary() {
  const t = uploadState.targets.find(x => x.id === uploadState.activeTargetId);
  if (!t) return;
  const mapped = Object.values(t.mapping || {}).filter(v => v && v !== SKIP_VALUE).length;
  const skipped = Object.values(t.mapping || {}).filter(v => v === SKIP_VALUE).length;
  $('mappingSummary').textContent = `${mapped} mapped, ${skipped} skipped`;
}
$('fieldFilter').addEventListener('input', u_renderMappingTable);
$('saveMappingBtn').addEventListener('click', () => { const t = uploadState.targets.find(x => x.id === uploadState.activeTargetId); if (!t) return; u_saveMappingForList(t.listName, t.mapping); u_setStatus('Mapping saved.', 'success'); });
$('resetMappingBtn').addEventListener('click', () => { const t = uploadState.targets.find(x => x.id === uploadState.activeTargetId); if (!t) return; t.mapping = {}; u_autoMapTarget(t); u_renderMappingTable(); u_refreshUploadBtn(); });
$('autoMapBtn').addEventListener('click', () => { const t = uploadState.targets.find(x => x.id === uploadState.activeTargetId); if (!t) return; u_autoMapTarget(t); u_renderMappingTable(); u_refreshUploadBtn(); });
function u_saveMappingForList(listName, mapping) { try { localStorage.setItem(profileKey('map_' + listName.toLowerCase()), JSON.stringify(mapping)); } catch (e) {} }
function u_loadSavedMapping(listName) { try { const raw = localStorage.getItem(profileKey('map_' + listName.toLowerCase())); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; } }
function rowMatchesFilter(row, filterExpr) { if (!filterExpr || !filterExpr.trim()) return true; try { return Boolean(new Function('row', `return (${filterExpr});`)(row)); } catch (err) { return false; } }
function u_refreshUploadBtn() {
  const hasRows = uploadState.parsedRows.length > 0;
  const hasUsableTarget = uploadState.targets.some(t => t.listId && t.columns.length > 0 && Object.values(t.mapping || {}).some(v => v && v !== SKIP_VALUE));
  const canUpload = hasPerm('uploader') && !!getGlobalAccessToken();
  const disabled = !(hasRows && hasUsableTarget && canUpload);
  $('uploadBtn').disabled = disabled;
  $('scheduleUploadBtn').disabled = disabled;
}
const dropzone = $('dropzone'), fileInput = $('fileInput');
dropzone.addEventListener('click', () => { if (hasPerm('uploader')) fileInput.click(); });
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); if (hasPerm('uploader')) dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); if (!hasPerm('uploader')) { u_setStatus('Permission denied.', 'error'); return; } if (e.dataTransfer.files.length) u_handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', (e) => { if (e.target.files.length) u_handleFile(e.target.files[0]); });

/* ============================================================
   UPLOADER — Group helpers (isolated)
   ============================================================ */
function u_renderGroupControls() {
  const section = $('groupSection');
  const addSel = $('groupColumnToAdd');
  if (!uploadState.parsedHeaders.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  const chosen = new Set(uploadState.groupByFields.map(f => f.column));
  const available = uploadState.parsedHeaders.filter(h => !chosen.has(h));
  addSel.innerHTML = '<option value="">— Pick a column —</option>' + available.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');
  addSel.value = '';
  addSel.disabled = !available.length;
  $('groupOrder').value = uploadState.groupOrder;
  $('withinGroupOrder').value = uploadState.withinGroupOrder;
  u_renderGroupChain();
  u_updateGroupSummary();
}
function u_renderGroupChain() {
  const chain = $('groupChain');
  const empty = $('groupChainEmpty');
  chain.innerHTML = '';
  if (!uploadState.groupByFields.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  uploadState.groupByFields.forEach((f, idx) => {
    const el = document.createElement('div');
    el.className = 'group-chain-item';
    el.dataset.idx = idx;
    el.draggable = true;
    el.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
      <span class="idx" style="opacity:0.6;font-size:11px;">${idx + 1}.</span>
      <span class="col-name">${escapeHtml(f.column)}</span>
      <button class="dir-btn" type="button" data-action="toggle-dir" title="Toggle sort direction">${f.dir === 'asc' ? 'A→Z' : 'Z→A'}</button>
      <button class="remove-btn" type="button" data-action="remove" title="Remove column">✖</button>`;
    el.querySelector('[data-action="toggle-dir"]').addEventListener('click', (e) => { e.stopPropagation(); f.dir = f.dir === 'asc' ? 'desc' : 'asc'; u_renderGroupChain(); u_updateGroupSummary(); if ($('groupPreviewWrap').classList.contains('visible')) u_renderGroupPreview(); });
    el.querySelector('[data-action="remove"]').addEventListener('click', (e) => { e.stopPropagation(); uploadState.groupByFields.splice(idx, 1); u_renderGroupControls(); u_setExpanded(false); $('groupPreviewWrap').classList.remove('visible'); $('groupChips').innerHTML = ''; u_refreshUploadBtn(); });
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); chain.querySelectorAll('.group-chain-item').forEach(x => x.classList.remove('drop-before', 'drop-after')); });
    el.addEventListener('dragover', (e) => { e.preventDefault(); const rect = el.getBoundingClientRect(); const isAfter = (e.clientX - rect.left) > rect.width / 2; chain.querySelectorAll('.group-chain-item').forEach(x => x.classList.remove('drop-before', 'drop-after')); el.classList.add(isAfter ? 'drop-after' : 'drop-before'); });
    el.addEventListener('dragleave', () => { el.classList.remove('drop-before', 'drop-after'); });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (isNaN(fromIdx) || fromIdx === idx) return;
      const rect = el.getBoundingClientRect();
      const isAfter = (e.clientX - rect.left) > rect.width / 2;
      const item = uploadState.groupByFields.splice(fromIdx, 1)[0];
      let toIdx = idx;
      if (fromIdx < idx) toIdx = isAfter ? idx : idx - 1;
      else toIdx = isAfter ? idx + 1 : idx;
      uploadState.groupByFields.splice(toIdx, 0, item);
      u_renderGroupChain(); u_updateGroupSummary();
      if ($('groupPreviewWrap').classList.contains('visible')) u_renderGroupPreview();
    });
    chain.appendChild(el);
  });
}
function u_updateGroupSummary() {
  const el = $('groupSummary');
  if (!uploadState.groupByFields.length || !uploadState.parsedRows.length) { el.textContent = ''; return; }
  const groups = u_computeGroups();
  const keys = uploadState.groupByFields.map(f => `${f.column} ${f.dir === 'asc' ? '↑' : '↓'}`).join(' + ');
  el.textContent = `${groups.length} group${groups.length !== 1 ? 's' : ''} · ${uploadState.parsedRows.length} rows · key: ${keys}`;
}
function u_rowGroupKey(row) { return uploadState.groupByFields.map(f => String(row[f.column] ?? '')).join('\u0001'); }
function u_rowGroupKeyDisplay(row) { return uploadState.groupByFields.map(f => String(row[f.column] ?? '')).map(v => v === '' ? '(empty)' : v).join('  ·  '); }
function u_computeGroups() {
  if (!uploadState.groupByFields.length || !uploadState.parsedRows.length) return [];
  const map = new Map();
  uploadState.parsedRows.forEach((r, idx) => {
    const k = u_rowGroupKey(r);
    if (!map.has(k)) map.set(k, { key: k, displayKey: u_rowGroupKeyDisplay(r), count: 0, firstIndex: idx, rows: [] });
    const g = map.get(k); g.count++; g.rows.push(r);
  });
  let groups = Array.from(map.values());
  const fields = uploadState.groupByFields;
  const order = uploadState.groupOrder;
  if (order === 'asc' || order === 'desc') {
    groups.sort((a, b) => {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const av = String(a.rows[0][f.column] ?? '');
        const bv = String(b.rows[0][f.column] ?? '');
        let cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp === 0) continue;
        let dirSign = f.dir === 'asc' ? 1 : -1;
        if (order === 'desc') dirSign = -dirSign;
        return cmp * dirSign;
      }
      return 0;
    });
  } else if (order === 'size') {
    groups.sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex);
  } else if (order === 'firstSeen') {
    groups.sort((a, b) => a.firstIndex - b.firstIndex);
  }
  if (uploadState.withinGroupOrder === 'reverse') groups.forEach(g => g.rows.reverse());
  return groups;
}
function u_getOrderedRows() {
  const groups = u_computeGroups();
  if (!groups.length) return uploadState.parsedRows.slice();
  const out = [];
  groups.forEach(g => out.push(...g.rows));
  return out;
}
function u_isNumericColumn(colName) {
  let sawNumber = false; let sampleCount = 0;
  const maxScan = Math.min(uploadState.parsedRows.length, 200);
  for (let i = 0; i < maxScan; i++) {
    const raw = uploadState.parsedRows[i][colName];
    if (raw === '' || raw === null || raw === undefined) continue;
    sampleCount++;
    const cleaned = String(raw).replace(/,/g, '').trim();
    if (cleaned !== '' && !isNaN(Number(cleaned))) { sawNumber = true; }
    else if (cleaned !== '') return false;
    if (sampleCount >= 50) break;
  }
  return sawNumber;
}
function u_toNumber(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}
function u_formatNumber(n) {
  if (n === null || n === undefined) return '';
  const rounded = Math.round(n * 1e6) / 1e6;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 6 });
}
function u_getNumericColumns() {
  const groupCols = new Set(uploadState.groupByFields.map(f => f.column));
  return uploadState.parsedHeaders.filter(h => !groupCols.has(h) && u_isNumericColumn(h));
}
function u_renderGroupPreview() {
  const wrap = $('groupPreviewWrap');
  const thead = $('groupPreviewHead');
  const tbody = $('groupPreviewBody');
  const controls = $('groupPreviewControls');
  const groups = u_computeGroups();
  if (!groups.length) { wrap.classList.remove('visible'); controls.style.display = 'none'; thead.innerHTML = ''; tbody.innerHTML = ''; return; }
  wrap.classList.add('visible');
  controls.style.display = 'flex';
  const showSums = $('groupShowSums').checked;
  const showTotals = $('groupShowTotals').checked;
  const dims = uploadState.groupByFields.map(f => ({ name: f.column, dir: f.dir }));
  const numericCols = showSums ? u_getNumericColumns() : [];
  const headerCells = [
    `<th class="grp-meta" style="width:50px;">#</th>`,
    ...dims.map(d => `<th class="grp-dim">${escapeHtml(d.name)} <span style="opacity:0.6;font-size:10px;">${d.dir === 'asc' ? '↑' : '↓'}</span></th>`),
    `<th class="grp-meta" style="width:80px;">Rows</th>`,
    `<th class="grp-meta" style="width:90px;">First #</th>`,
    ...numericCols.map(c => `<th class="grp-sum">Σ ${escapeHtml(c)}</th>`),
  ];
  thead.innerHTML = `<tr>${headerCells.join('')}</tr>`;
  const groupRows = groups.map(g => {
    const sums = {};
    if (numericCols.length) { numericCols.forEach(c => { sums[c] = 0; }); g.rows.forEach(r => { numericCols.forEach(c => { const n = u_toNumber(r[c]); if (n !== null) sums[c] += n; }); }); }
    return { g, sums };
  });
  const totals = {};
  if (numericCols.length) { numericCols.forEach(c => { totals[c] = 0; }); groupRows.forEach(({ sums }) => numericCols.forEach(c => { totals[c] += sums[c] || 0; })); }
  const totalRowCount = groups.reduce((a, g) => a + g.count, 0);
  const maxRows = 500;
  const bodyHtml = [];
  groupRows.slice(0, maxRows).forEach(({ g, sums }, i) => {
    const altCls = i % 2 === 1 ? ' class="group-alt"' : '';
    const firstRow = g.rows[0];
    const dimCells = dims.map(d => { const v = String(firstRow[d.name] ?? ''); return v === '' ? `<td class="grp-dim grp-empty">(empty)</td>` : `<td class="grp-dim">${escapeHtml(v)}</td>`; }).join('');
    const sumCells = numericCols.map(c => `<td class="grp-sum">${escapeHtml(u_formatNumber(sums[c]))}</td>`).join('');
    bodyHtml.push(`<tr${altCls}><td class="grp-meta">${i + 1}</td>${dimCells}<td class="grp-meta">${g.count}</td><td class="grp-meta">#${g.firstIndex + 1}</td>${sumCells}</tr>`);
  });
  if (groups.length > maxRows) bodyHtml.push(`<tr><td colspan="${4 + dims.length + numericCols.length}" style="text-align:center;color:var(--gray-400);font-style:italic;">…and ${groups.length - maxRows} more groups (only first ${maxRows} shown)</td></tr>`);
  if (showTotals && numericCols.length) {
    const totalDimCells = dims.map((_, idx) => idx === 0 ? `<td class="grp-dim">TOTAL</td>` : `<td class="grp-dim" style="opacity:0.5;">—</td>`).join('');
    const totalSumCells = numericCols.map(c => `<td class="grp-sum">${escapeHtml(u_formatNumber(totals[c]))}</td>`).join('');
    bodyHtml.push(`<tr class="group-total-row"><td class="grp-meta">Σ</td>${totalDimCells}<td class="grp-meta">${totalRowCount}</td><td class="grp-meta">—</td>${totalSumCells}</tr>`);
  }
  tbody.innerHTML = bodyHtml.join('');
  const chips = $('groupChips');
  chips.innerHTML = groups.slice(0, 20).map(g => {
    const label = uploadState.groupByFields.map(f => { const v = String(g.rows[0][f.column] ?? ''); return v === '' ? '(empty)' : v; }).join(' · ');
    return `<span class="group-chip">${escapeHtml(truncate(label, 28))} <span class="count">${g.count}</span></span>`;
  }).join('') + (groups.length > 20 ? `<span class="group-chip">+${groups.length - 20} more</span>` : '');
}
$('groupColumnToAdd').addEventListener('change', (e) => {
  const col = e.target.value;
  if (!col) return;
  if (!uploadState.groupByFields.some(f => f.column === col)) uploadState.groupByFields.push({ column: col, dir: 'asc' });
  e.target.value = '';
  u_renderGroupControls();
  u_setExpanded(false);
  $('groupPreviewWrap').classList.remove('visible');
  $('groupChips').innerHTML = '';
  u_updateGroupSummary();
  u_refreshUploadBtn();
});
$('groupOrder').addEventListener('change', (e) => { uploadState.groupOrder = e.target.value; u_updateGroupSummary(); if ($('groupPreviewWrap').classList.contains('visible')) u_renderGroupPreview(); });
$('withinGroupOrder').addEventListener('change', (e) => { uploadState.withinGroupOrder = e.target.value; u_updateGroupSummary(); if ($('groupPreviewWrap').classList.contains('visible')) u_renderGroupPreview(); });
$('groupPreviewBtn').addEventListener('click', () => {
  if (!uploadState.groupByFields.length) { u_setStatus('Add at least one group-by column first.', 'warn'); return; }
  u_renderGroupPreview();
  u_setStatus(`Preview: ${u_computeGroups().length} groups across ${uploadState.parsedRows.length} rows.`, 'info');
});
$('groupClearBtn').addEventListener('click', () => {
  uploadState.groupByFields = [];
  uploadState.groupOrder = 'asc';
  uploadState.withinGroupOrder = 'file';
  $('groupOrder').value = 'asc';
  $('withinGroupOrder').value = 'file';
  u_setExpanded(false);
  $('groupPreviewWrap').classList.remove('visible');
  $('groupChips').innerHTML = '';
  u_renderGroupControls();
  u_setStatus('Grouping reset.', 'success');
});
$('groupShowSums').addEventListener('change', () => { if ($('groupPreviewWrap').classList.contains('visible')) u_renderGroupPreview(); });
$('groupShowTotals').addEventListener('change', () => { if ($('groupPreviewWrap').classList.contains('visible')) u_renderGroupPreview(); });
function u_setExpanded(on) {
  const wrap = $('groupPreviewWrap');
  const backdrop = $('groupPreviewBackdrop');
  const btn = $('groupPreviewExpandBtn');
  if (on) { wrap.classList.add('expanded'); backdrop.classList.add('open'); btn.textContent = '⤡ Collapse'; }
  else { wrap.classList.remove('expanded'); backdrop.classList.remove('open'); btn.textContent = '⤢ Expand'; }
}
$('groupPreviewExpandBtn').addEventListener('click', () => { const wrap = $('groupPreviewWrap'); u_setExpanded(!wrap.classList.contains('expanded')); });
$('groupPreviewCloseBtn').addEventListener('click', () => u_setExpanded(false));
$('groupPreviewBackdrop').addEventListener('click', () => u_setExpanded(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('groupPreviewWrap').classList.contains('expanded')) u_setExpanded(false);
  if (e.key === 'Escape' && $('wGroupPreviewWrap').classList.contains('expanded')) w_setExpanded(false);
});
function u_buildGroupExportRows() {
  const dims = uploadState.groupByFields.map(f => ({ name: f.column, dir: f.dir }));
  const numericCols = u_getNumericColumns();
  const groups = u_computeGroups();
  const headers = ['#', ...dims.map(d => `${d.name} (${d.dir === 'asc' ? '↑' : '↓'})`), 'Rows', 'First #', ...numericCols.map(c => `Σ ${c}`)];
  const rows = [headers];
  const totals = {};
  numericCols.forEach(c => { totals[c] = 0; });
  groups.forEach((g, i) => {
    const firstRow = g.rows[0];
    const sums = {};
    numericCols.forEach(c => { sums[c] = 0; g.rows.forEach(r => { const n = u_toNumber(r[c]); if (n !== null) sums[c] += n; }); totals[c] += sums[c]; });
    rows.push([i + 1, ...dims.map(d => { const v = String(firstRow[d.name] ?? ''); return v === '' ? '(empty)' : v; }), g.count, `#${g.firstIndex + 1}`, ...numericCols.map(c => sums[c])]);
  });
  if ($('groupShowTotals').checked && numericCols.length) {
    rows.push(['Σ', ...dims.map((_, idx) => idx === 0 ? 'TOTAL' : '—'), groups.reduce((a, g) => a + g.count, 0), '—', ...numericCols.map(c => totals[c])]);
  }
  return { headers, rows, numericCols, dims, groups };
}
$('groupExportExcelBtn').addEventListener('click', () => {
  if (!uploadState.groupByFields.length) { u_setStatus('Add at least one group-by column first.', 'warn'); return; }
  if (!uploadState.parsedRows.length) { u_setStatus('No data to export.', 'warn'); return; }
  try {
    const { rows, numericCols, dims } = u_buildGroupExportRows();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map(h => ({ wch: Math.max(12, Math.min(40, String(h || '').length + 4)) }));
    const numStart = 1 + dims.length + 2;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= range.e.r; R++) for (let C = numStart; C <= range.e.c; C++) { const addr = XLSX.utils.encode_cell({ r: R, c: C }); if (ws[addr]) ws[addr].z = '#,##0.###'; }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Grouped');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const listHint = (uploadState.targets.find(t => t.id === uploadState.activeTargetId)?.listName) || 'grouped';
    XLSX.writeFile(wb, `${listHint}_grouped_${ts}.xlsx`);
    u_setStatus(`✅ Exported grouped data to Excel (${rows.length - 1} rows).`, 'success');
    addActivity('export', `Grouped Excel export: ${rows.length - 1} rows`);
  } catch (err) { u_setStatus('Excel export failed: ' + err.message, 'error'); }
});
$('groupExportCsvBtn').addEventListener('click', () => {
  if (!uploadState.groupByFields.length) { u_setStatus('Add at least one group-by column first.', 'warn'); return; }
  if (!uploadState.parsedRows.length) { u_setStatus('No data to export.', 'warn'); return; }
  try {
    const { rows } = u_buildGroupExportRows();
    const esc = v => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = rows.map(r => r.map(esc).join(','));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const listHint = (uploadState.targets.find(t => t.id === uploadState.activeTargetId)?.listName) || 'grouped';
    a.download = `${listHint}_grouped_${ts}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    u_setStatus(`✅ Exported grouped data to CSV (${rows.length - 1} rows).`, 'success');
  } catch (err) { u_setStatus('CSV export failed: ' + err.message, 'error'); }
});
async function u_handleFile(file) {
  if (!hasPerm('uploader')) { u_setStatus('Permission denied.', 'error'); return; }
  try {
    const rows = await parseFileToRows(file);
    if (!rows.length) { u_setStatus('No data rows.', 'warn'); return; }
    uploadState.parsedRows = rows;
    uploadState.parsedHeaders = Object.keys(rows[0]);
    uploadState.lastFile = file;
    uploadState.groupByFields = [];
    uploadState.groupOrder = 'asc';
    uploadState.withinGroupOrder = 'file';
    const s = $('fileSummary'); s.style.display = 'block'; s.textContent = `✓ Loaded "${file.name}" — ${rows.length} rows, ${uploadState.parsedHeaders.length} columns.`;
    u_log(`Parsed file: ${file.name}`);
    uploadState.targets.forEach(t => { if (t.columns.length) u_autoMapTarget(t); });
    u_renderTargets(); u_renderMappingTable(); u_renderGroupControls(); u_refreshUploadBtn();
    $('navUploaderBadge').textContent = rows.length + ' rows';
    addActivity('upload', `Parsed "${file.name}" — ${rows.length} rows`);
  } catch (err) {
    u_setStatus('Failed to parse: ' + err.message, 'error');
    u_log('ERROR: ' + err.message);
    addActivity('error', `Parse error: ${err.message}`);
    notifyFailure('Parse Error', `Failed to parse "${file.name}": ${err.message}`);
  }
}
async function performUpload(rows, targets, token, progressCb) {
  let totalSuccess = 0, totalFailed = 0;
  const errors = [];
  let processed = 0;
  const allJobs = [];
  for (const t of targets) {
    if (!isListVisible(t.listName)) { errors.push(`Target "${t.listName}" skipped — no permission`); continue; }
    if (!isListEditable(t.listName)) { errors.push(`Target "${t.listName}" skipped — read-only`); continue; }
    if (!t.listId || !t.columns.length) { errors.push(`Target "${t.listName}" skipped — columns not loaded`); continue; }
    const activeMappings = Object.entries(t.mapping || {}).filter(([, v]) => v && v !== SKIP_VALUE);
    if (!activeMappings.length) { errors.push(`Target "${t.listName}" skipped — no mapped columns`); continue; }
    const matchingRows = rows.filter(r => rowMatchesFilter(r, t.filter));
    matchingRows.forEach(r => allJobs.push({ target: t, row: r, mappings: activeMappings }));
  }
  const totalJobs = allJobs.length;
  for (let i = 0; i < allJobs.length; i++) {
    const { target: t, row, mappings } = allJobs[i];
    const fields = {};
    mappings.forEach(([eh, tf]) => {
  if (eh === CURRENT_USER_FIELD_KEY) { fields[tf] = getCurrentUserValue(); return; }
  const raw = row[eh];
  if (raw === '' || raw === null || raw === undefined) return;
  fields[tf] = String(raw);
});
    addAuditMetadata(fields, t);
    if (!Object.keys(fields).length) { totalFailed++; processed++; if (progressCb) progressCb(processed, totalJobs, `Row ${i + 1} skipped`); continue; }
    try { await createItem(t.siteId, t.listId, fields, token); totalSuccess++; if (progressCb) progressCb(processed + 1, totalJobs, `✔ ${t.listName} — ${totalSuccess} created`); }
    catch (err) { totalFailed++; errors.push(`Row ${i + 1} → "${t.listName}": ${err.message}`); if (progressCb) progressCb(processed + 1, totalJobs, `✘ ${t.listName} — ${err.message.slice(0, 60)}`); }
    processed++;
  }
  return { totalSuccess, totalFailed, errors };
}
$('uploadBtn').addEventListener('click', async () => {
  if (!hasPerm('uploader')) { u_setStatus('Permission denied.', 'error'); return; }
  const token = getGlobalAccessToken();
  const siteUrl = getGlobalSiteUrl();
  if (!token || !siteUrl) { u_setStatus('Global connection settings are not configured.', 'error'); return; }
  if (!uploadState.parsedRows.length) { u_setStatus('No rows.', 'error'); return; }
  $('uploadBtn').disabled = true; $('uploadLog').textContent = ''; u_setStatus('Starting upload...', 'info');
  const orderedRows = u_getOrderedRows();
  const groupKeysList = uploadState.groupByFields.map(f => `${f.column} ${f.dir === 'asc' ? '↑' : '↓'}`).join(' + ');
  if (uploadState.groupByFields.length) {
    const groups = u_computeGroups();
    u_log(`Grouping by [${groupKeysList}] (${uploadState.groupOrder}) → ${groups.length} groups`);
  }
  let preCount = 0;
  for (const t of uploadState.targets) {
    if (!isListVisible(t.listName) || !isListEditable(t.listName)) continue;
    if (!t.listId || !t.columns.length) continue;
    const activeMappings = Object.entries(t.mapping || {}).filter(([, v]) => v && v !== SKIP_VALUE);
    if (!activeMappings.length) continue;
    preCount += orderedRows.filter(r => rowMatchesFilter(r, t.filter)).length;
  }
  if (!(await spAsk(`Upload ${preCount} record(s) to ${uploadState.targets.filter(t => t.listName).map(t => '"' + t.listName + '"').join(', ')}?` + (uploadState.groupByFields.length ? `\n\nGrouped by ${groupKeysList}.` : '')))) { $('uploadBtn').disabled = false; u_setStatus('Upload cancelled.', 'info'); return; }
  const label = uploadState.groupByFields.length ? `Uploading ${preCount} records grouped by [${groupKeysList}]` : `Uploading ${preCount} records (audit metadata auto-added)`;
  uploadProgress.start(label, preCount);
  const t0 = Date.now();
  try {
    const { totalSuccess, totalFailed, errors } = await performUpload(orderedRows, uploadState.targets, token, (done, total, msg) => { uploadProgress.update(done, total, msg); u_setStatus(`Uploading... ${done} / ${total}`, 'info'); });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const groupNote = uploadState.groupByFields.length ? ` (grouped by [${groupKeysList}])` : '';
    if (totalFailed === 0) { uploadProgress.finish(`✅ Uploaded ${totalSuccess} records in ${elapsed}s${groupNote}`); u_setStatus(`✅ Done! ${totalSuccess} items in ${elapsed}s${groupNote}. Audit fields set to "${currentUser?.username}".`, 'success'); addActivity('upload', `Uploaded ${totalSuccess} items${groupNote}`); }
    else { uploadProgress.error(`⚠ ${totalSuccess} ok, ${totalFailed} failed`); u_setStatus(`⚠ ${totalSuccess} ok, ${totalFailed} failed (${elapsed}s).`, 'warn'); addActivity('error', `Upload: ${totalFailed} failures`); notifyFailure('Upload Partial Failure', `${totalFailed} failures.\n\n${errors.slice(0, 5).join('\n')}`); }
  } catch (err) {
    if (err && err.cancelled) {
      const n = uploadProgress.completed;
      uploadProgress.error('Stopped by user');
      u_setStatus(`⏹ Upload stopped by user after ${n} record(s). Rows already created in SharePoint are not rolled back.`, 'warn');
      u_log(`Stopped by user after ${n} record(s)`); addActivity('upload', `Upload stopped by user after ${n} items`);
      return;
    }
    uploadProgress.error('Upload failed: ' + err.message); u_setStatus('Upload failed: ' + err.message, 'error'); u_log('FATAL: ' + err.message); addActivity('error', `Upload failed: ${err.message}`); notifyFailure('Upload Failed', err.message); }
  finally { $('uploadBtn').disabled = false; u_refreshUploadBtn(); }
});
$('clearUploadBtn').addEventListener('click', () => {
  uploadState.parsedRows = []; uploadState.parsedHeaders = []; uploadState.lastFile = null;
  uploadState.groupByFields = []; uploadState.groupOrder = 'asc'; uploadState.withinGroupOrder = 'file';
  $('fileSummary').style.display = 'none'; $('mappingSection').style.display = 'none';
  $('groupSection').style.display = 'none';
  u_setExpanded(false);
  $('groupPreviewWrap').classList.remove('visible');
  $('groupChips').innerHTML = '';
  $('fileInput').value = ''; $('uploadStatus').className = 'status-msg'; $('uploadStatus').style.display = 'none';
  $('uploadLog').textContent = ''; $('uploadLog').style.display = 'none';
  u_refreshUploadBtn(); $('navUploaderBadge').textContent = '—';
});

