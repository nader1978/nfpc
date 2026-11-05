/* ---------- UOM table from a SharePoint list ---------- */
const wUomLoadProgress = new ProgressBar('wUomLoadProgress');
async function wUom_loadFromList() {
  const listName = wUomState.listName;
  if (!listName) { wUom_setStatus('Pick the UOM list first.', 'warn'); return false; }
  const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl();
  if (!token || !siteUrl) { wUom_setStatus('Global Site URL and Token are not configured.', 'error'); return false; }
  $('wUomLoadBtn').disabled = true;
  wUomLoadProgress.start(`Loading "${listName}"…`, 0);
  try {
    const { siteId, listId } = await resolveIds(siteUrl, listName, token);
    const cols = await fetchColumns(siteId, listId, token);
    const items = await fetchAllItems(siteId, listId, token, n => wUomLoadProgress.update(n, 0, `${n.toLocaleString()} UOM rows fetched`));
    if (listName !== wUomState.listName) return false;     // user switched list meanwhile
    const rows = items.map(it => it.fields || {});
    if (!rows.length) { wUomLoadProgress.error('UOM list is empty'); wUom_setStatus(`The list "${listName}" has no rows.`, 'warn'); return false; }
    const known = new Set(cols.map(c => c.name)), extra = new Set();
    rows.slice(0, 20).forEach(r => Object.keys(r).forEach(k => { if (!known.has(k) && !k.startsWith('@') && !k.startsWith('_')) extra.add(k); }));
    wUomState.labels = {}; cols.forEach(c => { wUomState.labels[c.name] = c.displayName || c.name; });
    wUomState.headers = [...cols.map(c => c.name), ...extra];
    wUomState.rows = rows; wUomState.source = 'list'; wUomState.fileName = ''; wUomState.loadedAt = Date.now();
    wUomState.map = wUom_detect(wUomState.headers);
    try {   // restore the mapping saved for this list
      const sv = JSON.parse(localStorage.getItem(wUom_mapKey()) || 'null');
      if (sv && sv.map && sv.map.sku && wUomState.headers.includes(sv.map.sku)) {
        const ok = {}; Object.keys(wUomState.map).forEach(k => { ok[k] = (sv.map[k] && wUomState.headers.includes(sv.map[k])) ? sv.map[k] : wUomState.map[k]; });
        if (sv.cartonPref) $('wUomCartonPref').value = sv.cartonPref; wUomState.map = ok; wUomState.layout = sv.layout || wUomState.layout; wUomState.palletMode = sv.palletMode || wUomState.palletMode;
      }
      else if (UOM_CONV_DEFAULT.list && UOM_CONV_DEFAULT.list === listName && UOM_CONV_DEFAULT.map && UOM_CONV_DEFAULT.map.sku && wUomState.headers.includes(UOM_CONV_DEFAULT.map.sku)) { const ok = {}; Object.keys(wUomState.map).forEach(k => { ok[k] = (UOM_CONV_DEFAULT.map[k] && wUomState.headers.includes(UOM_CONV_DEFAULT.map[k])) ? UOM_CONV_DEFAULT.map[k] : wUomState.map[k]; }); wUomState.map = ok; if (UOM_CONV_DEFAULT.layout) wUomState.layout = UOM_CONV_DEFAULT.layout; if (UOM_CONV_DEFAULT.palletMode) wUomState.palletMode = UOM_CONV_DEFAULT.palletMode; }
    } catch (e) {}
    try { utUomOverride(); } catch (e) {}
    $('wUomMapWrap').style.display = 'block';
    wUom_rebuild(); wUom_renderMap(); wUom_saveMap();
    wFefoState.batchIndex = null;
    $('wUomListInfo').textContent = `Loaded ${rows.length.toLocaleString()} row(s) from "${listName}" at ${new Date().toLocaleTimeString()}`;
    wUomLoadProgress.finish(`✅ UOM list loaded (${rows.length.toLocaleString()} rows)`);
    w_logToActivity(`UOM list "${listName}" loaded: ${wUomState.table.size} SKUs`);
    return true;
  } catch (err) {
    if (err && err.cancelled) { wUomLoadProgress.error('Stopped by user'); wUom_setStatus('⏹ UOM load stopped — the previous UOM table (if any) is unchanged.', 'warn'); return false; }
    wUomLoadProgress.error('✘ ' + err.message); wUom_setStatus('✘ Could not load the UOM list: ' + err.message, 'error'); return false;
  } finally { $('wUomLoadBtn').disabled = false; }
}
/* Called before every lookup: (re)loads the UOM list when needed; refuses to continue with stale/missing factors */
async function wUom_ensureLoaded() {
  if (!$('wUomEnable').checked || !wUomState.listName || wUomState.source === 'file') return;
  if (wUomState.table.size && Date.now() - wUomState.loadedAt < LISTS_CACHE_TTL) return;
  if (!(await wUom_loadFromList())) throw new Error('The UOM list could not be loaded — fix it or untick "Convert order & batch quantities to Pcs".');
}
/* ============================================================
   Daily Update Tracker — which places submitted data on which day
   ============================================================ */
const dtrkProgress = new ProgressBar('dtrkProgress');
const dtrk = { listName: '', siteId: null, listId: null, cols: [], fetched: new Set(), cfg: { dateCol: '', locCol: '', grpCol: '', userCol: '', expected: [], filters: [], fmode: 'and' }, data: null, picker: null, rows: [], fLoc: [], fUser: [] };
const dtrkSet = (m, t = 'info') => { const el = $('dtrkStatus'); el.className = 'status-msg ' + t; el.textContent = m || ''; };
const dtrkCfgKey = () => profileKey('dtrk_' + (dtrk.listName || '').toLowerCase());
function dtrk_saveCfg() { try { localStorage.setItem(dtrkCfgKey(), JSON.stringify(dtrk.cfg)); localStorage.setItem(profileKey('dtrk_list'), dtrk.listName || ''); } catch (e) {} }
const pad2 = n => String(n).padStart(2, '0');
function dtrk_dayKey(v, dateOnly) {
  if (v == null || v === '') return null;
  if (dateOnly && /^\d{4}-\d{2}-\d{2}/.test(String(v))) return String(v).slice(0, 10);
  const d = new Date(v); if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function dtrk_fillSelects() {
  const dateCols = [{ name: 'Created', displayName: 'Created (system)', dateOnly: false }, ...dtrk.cols.filter(c => c.type === 'date')];
  const anyCols = [{ name: 'Title', displayName: 'Title' }, ...dtrk.cols.filter(c => c.name !== 'Title' && !['boolean', 'multiline'].includes(c.type))];
  const fill = (id, list, cur, blank) => { const el = $(id); el.innerHTML = (blank ? '<option value="">— none —</option>' : '') + list.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.displayName || c.name)}</option>`).join(''); el.value = list.some(c => c.name === cur) ? cur : (blank ? '' : list[0] ? list[0].name : ''); };
  const guessDate = (dtrk.cols.find(c => c.type === 'date' && /date|day/i.test(c.name + c.displayName)) || {}).name;
  const guessLoc = (dtrk.cols.find(c => /location|place|site|branch|warehouse|whs|\bwh|depot|store|plant/i.test(c.name + ' ' + c.displayName)) || {}).name;
  const guessGrp = (dtrk.cols.find(c => /region|emirate|zone|area|group/i.test(c.name + ' ' + c.displayName)) || {}).name;
  const guessUser = (dtrk.cols.find(c => /user|username|entered|submitted/i.test(c.name + ' ' + c.displayName)) || {}).name;
  fill('dtrkDateCol', dateCols, dtrk.cfg.dateCol || guessDate, false);
  fill('dtrkLocCol', anyCols, dtrk.cfg.locCol || guessLoc, false);
  fill('dtrkGrpCol', anyCols, dtrk.cfg.grpCol || guessGrp, true);
  fill('dtrkUserCol', [{ name: '__createdby', displayName: 'Created By (system)' }, ...anyCols], dtrk.cfg.userCol || guessUser, true);
  dtrk.cfg.dateCol = $('dtrkDateCol').value; dtrk.cfg.locCol = $('dtrkLocCol').value; dtrk.cfg.grpCol = $('dtrkGrpCol').value; dtrk.cfg.userCol = $('dtrkUserCol').value;
  dtrk_renderExpected(); dtrk_fbRender();
}
function dtrk_renderExpected() {
  const host = $('dtrkExpected'); host.innerHTML = '';
  host.appendChild(buildMultiCombo(dtrk.cfg.expected || [], dtrk.data ? dtrk.data.locations.map(l => l.name) : [], arr => { dtrk.cfg.expected = arr; dtrk_saveCfg(); }, { placeholder: 'Type a place, press Enter' }));
}
async function dtrk_selectList(val) {
  if (val === dtrk.listName && dtrk.cols.length) return;
  dtrk.listName = val; dtrk.cols = []; dtrk.data = null; dtrk.rows = []; dtrk.fLoc = []; dtrk.fUser = []; $('dtrkFilters').style.display = 'none'; dtrk_render();
  if (!val) return;
  try { dtrk.cfg = Object.assign({ dateCol: '', locCol: '', grpCol: '', userCol: '', expected: [], filters: [], fmode: 'and' }, JSON.parse(localStorage.getItem(dtrkCfgKey()) || '{}')); } catch (e) {} if (!Array.isArray(dtrk.cfg.filters)) dtrk.cfg.filters = [];
  const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl();
  if (!token || !siteUrl) { dtrkSet('Global Site URL and Token are not configured.', 'warn'); return; }
  try {
    dtrkSet('Reading list columns…', 'info');
    const { siteId, listId } = await resolveIds(siteUrl, val, token);
    dtrk.siteId = siteId; dtrk.listId = listId;
    dtrk.cols = await fetchColumnsDetailed(siteId, listId, token);
    dtrk_fillSelects(); dtrk_saveCfg();
    dtrkSet(`✓ "${val}" ready — check the date and place columns, then click Check updates.`, 'success');
  } catch (err) { dtrkSet('✘ ' + err.message, 'error'); }
}
async function dtrk_fetch(rangeStart, rangeEnd, dateCol, fields, onRow, variant = 0) {
  const token = getGlobalAccessToken(), hdr = { Authorization: `Bearer ${token}`, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' };
  // variant 0: narrow $expand + fields/ filter · 1: plain $expand + fields/ filter · 2: plain $expand + item createdDateTime filter (Created only)
  const sel = fields.join(',');
  // variants: 0 quoted dates + narrow expand · 1 quoted + plain expand · 2 unquoted + narrow · 3 unquoted + plain · 4/5 item createdDateTime (Created only)
  const byCreated = variant >= 4, quoted = variant < 2 || byCreated;
  const fld = byCreated ? 'createdDateTime' : `fields/${dateCol}`;
  const q = d => quoted ? `'${d.toISOString()}'` : d.toISOString();
  const flt = `${fld} ge ${q(rangeStart)} and ${fld} lt ${q(rangeEnd)}`;
  const expand = (variant === 0 || variant === 2 || variant === 4) ? `fields($select=${encodeURIComponent(sel)})` : 'fields';
  let url = `https://graph.microsoft.com/v1.0/sites/${dtrk.siteId}/lists/${dtrk.listId}/items?$expand=${expand}&$top=500&$filter=${encodeURIComponent(flt)}`;
  let n = 0;
  while (url) {
    const r = await fetchWithRetry(url, { headers: hdr }, 'fetch tracker rows');
    if (!r.ok) { let t = ''; try { t = await r.text(); } catch (e) {} let msg = t; try { const jj = JSON.parse(t); msg = (jj.error && (jj.error.message || jj.error.code)) || t; } catch (e) {} const err = new Error(`HTTP ${r.status} ${String(msg).replace(/\s+/g, ' ').slice(0, 160)}`); err.threshold = r.status === 422 || /threshold|tooManyResources/i.test(t); throw err; }
    const j = await r.json();
    for (const it of j.value || []) { onRow(it.fields || {}, it); n++; }
    dtrkProgress.update(n, 0, `${n.toLocaleString()} records read`);
    url = j['@odata.nextLink'] || null;
  }
}
async function dtrk_check() {
  const { dateCol, locCol, grpCol, userCol } = dtrk.cfg;
  if (!dtrk.listId) { dtrkSet('Pick a list first.', 'warn'); return; }
  if (!dateCol || !locCol) { dtrkSet('Pick the date and place columns.', 'warn'); return; }
  const fromV = $('dtrkFrom').value, toV = $('dtrkTo').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromV) || !/^\d{4}-\d{2}-\d{2}$/.test(toV)) { dtrkSet('Pick the From and To dates.', 'warn'); return; }
  if (fromV > toV) { dtrkSet('The From date must be on or before the To date.', 'warn'); return; }
  const pd = v => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
  if ((pd(toV) - pd(fromV)) / 86400000 > 366) { dtrkSet('Choose a range of at most one year (367 days).', 'warn'); return; }
  const start = pd(fromV), end = new Date(pd(toV).getFullYear(), pd(toV).getMonth(), pd(toV).getDate() + 1);
  const pad = 36 * 3600 * 1000, qStart = new Date(start.getTime() - pad), qEnd = new Date(end.getTime() + pad);   // padded: day buckets are cut client-side
  const dateOnly = (dtrk.cols.find(c => c.name === dateCol) || {}).dateOnly === true;
  let partial = false, note = ''; const rows = [];
  const personName = u => u ? String(u.displayName || u.email || '').trim() : '';
  const onRow = (f, it) => {
    const day = dtrk_dayKey(f[dateCol], dateOnly); if (!day || day < fromV || day > toV) return;
    const loc = String(xlCell(f[locCol]) ?? '').trim(); if (!loc) return;
    const user = !userCol ? '' : userCol === '__createdby' ? personName(it && it.createdBy && it.createdBy.user) : String(xlCell(f[userCol]) ?? '').trim();
    rows.push({ by: personName(it && it.createdBy && it.createdBy.user), id: it && it.id != null ? String(it.id) : '', day, loc, grp: grpCol ? String(xlCell(f[grpCol]) ?? '').trim() : '', user, dateRaw: f[dateCol], created: it && it.createdDateTime || '', f });
  };
  const fields = [...new Set([dateCol, locCol, grpCol, userCol && userCol !== '__createdby' ? userCol : '', ...dtrk_fbCols()].filter(Boolean))]; dtrk.fetched = new Set(fields);
  $('dtrkLoadBtn').disabled = true; dtrkProgress.start('Checking updates…', 0); dtrkSet('', 'info');
  try {
    const diag = []; let done = false;
    const variants = dateCol === 'Created' ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3];
    for (const v of variants) {
      try { rows.length = 0; await dtrk_fetch(qStart, qEnd, dateCol, fields, onRow, v); done = true; if (v > 0) note = ' (used a simpler query form)'; break; }
      catch (e) { if (e && e.cancelled) throw e; diag.push(`form ${v}: ${e.message}`); if (e.threshold) break; }
    }
    if (!done) {   // filtering refused: scan the latest rows and bucket them locally
      rows.length = 0;
      const items = await exp_fetchRecentSampleItems(dtrk.siteId, dtrk.listId, getGlobalAccessToken(), 20000, n => dtrkProgress.update(n, 20000, `${n.toLocaleString()} latest rows scanned`)).catch(e2 => { if (e2 && e2.cancelled) throw e2; throw new Error(diag.join(' | ') + ' | scan: ' + e2.message); });
      items.forEach(it => onRow(it.fields || {}, it));
      note = ' (SharePoint refused the date filter, so the latest 20,000 rows were scanned and filtered here — results are complete only if your range falls within them. Reason: ' + diag[diag.length - 1].slice(0, 200) + ')';
    }
  } catch (err) {
    if (err && err.cancelled) { partial = true; dtrkProgress.error('Stopped by user'); }
    else { dtrkProgress.error('✘ ' + err.message); dtrkSet('✘ ' + err.message, 'error'); $('dtrkLoadBtn').disabled = false; return; }
  }
  let dupRemoved = 0; { const seen = new Set(); for (let i = rows.length - 1; i >= 0; i--) { const id = rows[i].id; if (!id) continue; if (seen.has(id)) { rows.splice(i, 1); dupRemoved++; } else seen.add(id); } }
  dtrk.rows = rows; dtrk.fLoc = []; dtrk.fUser = [];
  dtrk.data = { from: fromV, to: toV, counts: new Map(), locations: [], total: 0, partial };
  dtrk_build();
  const total = rows.length, locations = dtrk.data.locations;
  if (!partial) dtrkProgress.finish(`✅ ${total.toLocaleString()} records checked`);
  dtrkSet(partial ? '⏹ Stopped — the grid shows only the records read so far, so ⚠ cells may be wrong.' : `✓ ${total.toLocaleString()} records from ${fromV} to ${toV}, ${locations.length} place(s).${note}${dupRemoved ? ` ${dupRemoved} duplicate row(s) from paging were ignored.` : ''}${userCol && !rows.some(r => r.user) ? ' ⚠ The user column is empty in these records.' : ''}`, partial || note ? 'warn' : 'success');
  dtrk_renderFilters(); dtrk_fbRender();
  dtrk_renderExpected(); dtrk_render();
  $('dtrkLoadBtn').disabled = false;
}
/* Derive counts / places from the loaded rows and the place + username filters */
function dtrk_build() {
  const d = dtrk.data; if (!d) return;
  const uset = new Set(dtrk.fUser), lset = new Set(dtrk.fLoc), counts = new Map(), groups = new Map(); let total = 0;
  for (const r of dtrk.rows) {
    if (uset.size && !uset.has(r.user)) continue; if (!dtrk_fbPass(r)) continue;
    let m = counts.get(r.loc); if (!m) { m = new Map(); counts.set(r.loc, m); }
    m.set(r.day, (m.get(r.day) || 0) + 1); total++;
    if (r.grp && !groups.has(r.loc)) groups.set(r.loc, r.grp);
  }
  (dtrk.cfg.expected || []).forEach(l => { if (!counts.has(l)) counts.set(l, new Map()); });
  d.counts = counts; d.total = total;
  d.locations = Array.from(counts.keys()).filter(n => !lset.size || lset.has(n)).map(name => ({ name, group: groups.get(name) || '' }))
    .sort((a, b) => (a.group || '￿').localeCompare(b.group || '￿') || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

/* ---------- user-defined filters on any column ---------- */
const DTRK_OPS = {
  text: [['in', 'is any of'], ['nin', 'is none of'], ['contains', 'contains'], ['ncontains', 'does not contain'], ['starts', 'starts with'], ['eq', 'equals'], ['empty', 'is empty'], ['nempty', 'is not empty']],
  number: [['neq', '='], ['ne', '≠'], ['gt', '>'], ['ge', '≥'], ['lt', '<'], ['le', '≤'], ['between', 'between'], ['empty', 'is empty'], ['nempty', 'is not empty']],
  date: [['on', 'is on'], ['after', 'is on / after'], ['before', 'is on / before'], ['between', 'between'], ['empty', 'is empty'], ['nempty', 'is not empty']]
};
const dtrk_fbCols = () => [{ name: '__createdby', displayName: 'Created By (system)', type: 'text' }, { name: '__created', displayName: 'Created (system)', type: 'date' }, ...dtrk.cols.filter(c => c.name && !['hyperlinkOrPicture'].includes(c.type))];
const dtrk_fbType = col => { const c = dtrk_fbCols().find(x => x.name === col); return !c ? 'text' : c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text'; };
const dtrk_fbName = col => { const c = dtrk_fbCols().find(x => x.name === col); return c ? (c.displayName || c.name) : col; };
function dtrk_fbVal(r, col) {
  if (col === '__createdby') return r.by || ''; if (col === '__created') return r.created || '';
  if (col === dtrk.cfg.dateCol && r.dateRaw !== undefined && !(r.f && r.f[col] !== undefined)) return r.dateRaw == null ? '' : String(r.dateRaw);
  const v = r.f ? r.f[col] : undefined; return v == null ? '' : String(xlCell(v) ?? '').trim();
}
const dtrk_fbCols0 = () => { const o = []; (dtrk.cfg.filters || []).forEach(f => { if (f.col && !f.col.startsWith('__')) o.push(f.col); }); return o; };
const dtrk_fbOk = f => { if (!f || !f.col) return false; if (/^(empty|nempty)$/.test(f.op)) return true; if (f.op === 'between') return !!(f.v1 || f.v2); if (f.op === 'in' || f.op === 'nin') return (f.vals || []).length > 0; return String(f.v1 == null ? '' : f.v1) !== ''; };
function dtrk_fbTest(f, r) {
  const raw = dtrk_fbVal(r, f.col), t = dtrk_fbType(f.col), low = raw.toLowerCase(), q = String(f.v1 == null ? '' : f.v1).toLowerCase();
  if (f.op === 'empty') return raw === ''; if (f.op === 'nempty') return raw !== '';
  if (t === 'date') { const dk = raw ? dtrk_dayKey(raw, /^\d{4}-\d{2}-\d{2}$/.test(raw)) : null; if (!dk) return false; if (f.op === 'on') return dk === f.v1; if (f.op === 'after') return dk >= f.v1; if (f.op === 'before') return dk <= f.v1; if (f.op === 'between') return (!f.v1 || dk >= f.v1) && (!f.v2 || dk <= f.v2); return true; }
  if (t === 'number') { const n = parseFloat(raw.replace(/,/g, '')), a = parseFloat(f.v1), b = parseFloat(f.v2); if (isNaN(n)) return false; if (f.op === 'neq') return n === a; if (f.op === 'ne') return n !== a; if (f.op === 'gt') return n > a; if (f.op === 'ge') return n >= a; if (f.op === 'lt') return n < a; if (f.op === 'le') return n <= a; if (f.op === 'between') return (isNaN(a) || n >= a) && (isNaN(b) || n <= b); return true; }
  if (f.op === 'in' || f.op === 'nin') { const set = new Set((f.vals || []).map(x => String(x).toLowerCase())), parts = [low, ...low.split(/\s*[;,]\s*/)], hit = parts.some(p => set.has(p)); return f.op === 'in' ? hit : !hit; }
  if (f.op === 'contains') return low.includes(q); if (f.op === 'ncontains') return !low.includes(q); if (f.op === 'starts') return low.startsWith(q); if (f.op === 'eq') return low === q; return true;
}
function dtrk_fbPass(r) { const L = (dtrk.cfg.filters || []).filter(dtrk_fbOk); if (!L.length) return true; return dtrk.cfg.fmode === 'or' ? L.some(f => dtrk_fbTest(f, r)) : L.every(f => dtrk_fbTest(f, r)); }
function dtrk_fbText() {
  return (dtrk.cfg.filters || []).filter(dtrk_fbOk).map(f => { const op = (DTRK_OPS[dtrk_fbType(f.col)].find(o => o[0] === f.op) || [0, f.op])[1]; const v = /^(empty|nempty)$/.test(f.op) ? '' : f.op === 'between' ? `${f.v1 || '…'} and ${f.v2 || '…'}` : (f.op === 'in' || f.op === 'nin') ? f.vals.join(' / ') : f.v1; return `${dtrk_fbName(f.col)} ${op}${v !== '' ? ' ' + v : ''}`; }).join('; ');
}
function dtrk_fbApply(recheck) {
  dtrk_saveCfg(); const F = dtrk.cfg.filters || [];
  if (recheck && dtrk.data && F.some(f => f.col && !f.col.startsWith('__') && !dtrk.fetched.has(f.col))) { dtrkSet('Reading the new filter column from SharePoint…', 'info'); dtrk_check(); return; }
  if (dtrk.data) { dtrk_build(); dtrk_render(); }
  const n = F.filter(dtrk_fbOk).length, info = $('dtrkFInfo'); if (info) info.textContent = !F.length ? 'No filters — every record is counted. Add a filter to narrow the tracker by any column (for example Status = Approved, or Department contains Sales).' : `${n} of ${F.length} filter(s) active${n < F.length ? ' (the others still need a value)' : ''}.` + (dtrk.data ? ` ${plF(dtrk.rows.filter(dtrk_fbPass).length)} of ${plF(dtrk.rows.length)} record(s) match.` : ' Click Check updates to read the records.');
}
function dtrk_sel(cur, opts, onChange, ph) {
  const wrap = document.createElement('div'); wrap.className = 'combo'; wrap.style.margin = '0';
  const iw = document.createElement('div'), input = document.createElement('input'); iw.className = 'combo-input-wrap';
  input.type = 'text'; input.className = 'combo-input'; input.autocomplete = 'off'; input.placeholder = ph || 'Type to search…'; input.style.margin = '0';
  const arrow = document.createElement('span'); arrow.className = 'combo-arrow'; arrow.textContent = '▾'; iw.appendChild(input); iw.appendChild(arrow);
  const list = document.createElement('div'); list.className = 'combo-list'; wrap.appendChild(iw); wrap.appendChild(list);
  const label = v => (opts.find(o => o.value === v) || {}).label || ''; let hi = 0, shown = [];
  const paint = () => Array.from(list.children).forEach((el, i) => { el.style.background = i === hi ? 'var(--brand-light, #e8f0fe)' : ''; if (i === hi && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); });
  const render = q => { list.innerHTML = ''; q = (q || '').trim().toLowerCase(); shown = opts.filter(o => !q || o.label.toLowerCase().includes(q)); hi = 0;
    if (!shown.length) { const e = document.createElement('div'); e.className = 'combo-empty'; e.textContent = 'No matches'; list.appendChild(e); return; }
    shown.forEach(o => { const el = document.createElement('div'); el.className = 'combo-item'; el.textContent = o.label; if (o.value === cur) el.style.fontWeight = '700'; el.addEventListener('mousedown', e => { e.preventDefault(); pick(o.value); }); list.appendChild(el); }); paint(); };
  const open = () => { render(''); list.classList.add('open'); input.select(); }, close = () => { list.classList.remove('open'); input.value = label(cur); };
  const pick = v => { const ch = v !== cur; cur = v; close(); if (ch) onChange(v); };
  input.value = label(cur); input.addEventListener('focus', open); input.addEventListener('click', () => { if (!list.classList.contains('open')) open(); });
  input.addEventListener('input', () => { render(input.value); list.classList.add('open'); }); input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (shown[hi]) pick(shown[hi].value); } else if (e.key === 'Escape') { e.stopPropagation(); close(); input.blur(); } else if (e.key === 'ArrowDown') { e.preventDefault(); if (!list.classList.contains('open')) open(); hi = Math.min(shown.length - 1, hi + 1); paint(); } else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); paint(); } });
  return wrap;
}
function dtrk_fbRender() {
  const host = $('dtrkFRows'); if (!host) return; $('dtrkFMode').value = dtrk.cfg.fmode || 'and'; host.innerHTML = '';
  const cols = dtrk_fbCols(), F = dtrk.cfg.filters || [];
  F.forEach((f, i) => {
    const t = dtrk_fbType(f.col), ops = DTRK_OPS[t]; if (!ops.some(o => o[0] === f.op)) { f.op = ops[0][0]; f.vals = []; f.v1 = f.v2 = ''; }
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap;';
    const mk = (html, st) => { const e = document.createElement('div'); e.style.cssText = st || ''; e.innerHTML = html; row.appendChild(e); return e; };
    const sc = document.createElement('div'); sc.style.cssText = 'min-width:200px'; row.appendChild(sc); sc.appendChild(dtrk_sel(f.col, cols.map(c => ({ value: c.name, label: c.displayName || c.name })), v => { f.col = v; f.vals = []; f.v1 = f.v2 = ''; f.op = DTRK_OPS[dtrk_fbType(v)][0][0]; dtrk_fbRender(); dtrk_fbApply(true); }, 'Column — type to search'));
    const so = document.createElement('div'); so.style.cssText = 'min-width:150px'; row.appendChild(so); so.appendChild(dtrk_sel(f.op, ops.map(o => ({ value: o[0], label: o[1] })), v => { f.op = v; f.vals = f.vals || []; dtrk_fbRender(); dtrk_fbApply(false); }, 'Condition'));
    const vh = document.createElement('div'); vh.style.cssText = 'flex:1;min-width:220px;display:flex;gap:6px;align-items:center'; row.appendChild(vh);
    const inp = (type, key, ph) => { const e = document.createElement('input'); e.type = type; e.value = f[key] || ''; e.placeholder = ph || ''; e.style.margin = '0'; let tm; e.addEventListener('input', () => { f[key] = e.value; clearTimeout(tm); tm = setTimeout(() => dtrk_fbApply(false), 250); }); vh.appendChild(e); return e; };
    if (/^(empty|nempty)$/.test(f.op)) vh.innerHTML = '<span class="text-sm" style="color:var(--gray-500)">no value needed</span>';
    else if (f.op === 'in' || f.op === 'nin') { const opts = [...new Set(dtrk.rows.map(r => dtrk_fbVal(r, f.col)).filter(Boolean).flatMap(v => dtrk_fbType(f.col) === 'text' ? [v] : []))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })); const c = (dtrk.cols.find(x => x.name === f.col) || {}).choices || []; c.forEach(x => { if (!opts.includes(x)) opts.push(x); }); vh.style.display = 'block'; vh.appendChild(buildMultiCombo(f.vals || [], opts, arr => { f.vals = arr; dtrk_fbApply(false); }, { placeholder: opts.length ? 'Pick one or more values…' : 'Type a value, press Enter (Check updates lists the values)' })); }
    else if (f.op === 'between') { inp(t === 'date' ? 'date' : 'number', 'v1', 'from'); vh.appendChild(document.createTextNode('and')); inp(t === 'date' ? 'date' : 'number', 'v2', 'to'); }
    else inp(t === 'date' ? 'date' : t === 'number' ? 'number' : 'text', 'v1', 'value');
    const del = document.createElement('button'); del.type = 'button'; del.className = 'ghost small'; del.textContent = '✖'; del.title = 'Remove this filter'; del.addEventListener('click', () => { F.splice(i, 1); dtrk_fbRender(); dtrk_fbApply(false); }); row.appendChild(del);
    host.appendChild(row);
  });
  dtrk_fbApply(false);
}
(function dtrkFbInit() {
  const go = () => { const a = $('dtrkFAdd'); if (!a) return;
    a.addEventListener('click', () => { if (!dtrk.cols.length) { dtrkSet('Pick a list first — the filters are built from its columns.', 'warn'); return; } const c = dtrk_fbCols().find(x => x.name !== '__created' && x.name !== '__createdby' && ![dtrk.cfg.dateCol, dtrk.cfg.locCol].includes(x.name)) || dtrk_fbCols()[0]; (dtrk.cfg.filters = dtrk.cfg.filters || []).push({ col: c.name, op: DTRK_OPS[dtrk_fbType(c.name)][0][0], vals: [], v1: '', v2: '' }); dtrk_fbRender(); dtrk_saveCfg(); });
    $('dtrkFClear').addEventListener('click', () => { if (!(dtrk.cfg.filters || []).length) return; dtrk.cfg.filters = []; dtrk_fbRender(); dtrk_fbApply(false); });
    $('dtrkFMode').addEventListener('change', e => { dtrk.cfg.fmode = e.target.value; dtrk_fbApply(false); }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
function dtrk_renderFilters() {
  $('dtrkFilters').style.display = dtrk.rows.length ? '' : 'none';
  const distinct = k => Array.from(new Set(dtrk.rows.map(r => r[k]).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const locs = Array.from(new Set([...dtrk.rows.map(r => r.loc), ...(dtrk.cfg.expected || [])])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const hl = $('dtrkFilterLoc'), hu = $('dtrkFilterUser'); hl.innerHTML = ''; hu.innerHTML = '';
  hl.appendChild(buildMultiCombo(dtrk.fLoc, locs, arr => { dtrk.fLoc = arr; dtrk_build(); dtrk_render(); }, { placeholder: 'All places — pick one or more…' }));
  const users = distinct('user');
  hu.appendChild(buildMultiCombo(dtrk.fUser, users, arr => { dtrk.fUser = arr; dtrk_build(); dtrk_render(); }, { placeholder: users.length ? 'All users — pick one or more…' : 'Choose a User column above, then Check updates' }));
}
function dtrk_model() {
  const d = dtrk.data; if (!d) return null;
  const today = new Date(), tk = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const days = [];
  const [fy, fm, fd] = d.from.split('-').map(Number), [ty, tm, td] = d.to.split('-').map(Number), last = new Date(ty, tm - 1, td);
  for (let dt = new Date(fy, fm - 1, fd); dt <= last; dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 1)) {
    const key = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
    days.push({ key, label: `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`, dow: dt.toLocaleDateString('en-GB', { weekday: 'short' }), future: key > tk, today: key === tk });
  }
  const elapsed = days.filter(x => !x.future);
  let locs = d.locations.map(l => { const m = d.counts.get(l.name) || new Map(); const done = elapsed.filter(x => (m.get(x.key) || 0) > 0).length; return { ...l, m, done, elapsed: elapsed.length, missing: elapsed.length - done }; });
  if ($('dtrkOnlyMissing').checked) locs = locs.filter(l => l.missing > 0);
  return { days, locs, elapsed: elapsed.length };
}
function dtrk_render() {
  const t = $('dtrkTable'), th = t.querySelector('thead'), tb = t.querySelector('tbody'), md = dtrk_model();
  if (!md) { try { dtkKpis(null); } catch (e) {} th.innerHTML = ''; tb.innerHTML = ''; $('dtrkSummary').textContent = ''; $('dtrkExcelBtn').disabled = true; $('dtrkEmailBtn').disabled = true; return; }
  $('dtrkExcelBtn').disabled = false; $('dtrkEmailBtn').disabled = false;
  const { days, locs } = md, hasGrp = locs.some(l => l.group);
  let h = '';
  if (hasGrp) { h += '<tr class="dtrk-grp"><th class="dtrk-date"></th>'; let i = 0; while (i < locs.length) { let j = i; while (j < locs.length && locs[j].group === locs[i].group) j++; h += `<th colspan="${j - i}">${escapeHtml(locs[i].group || 'Other')}</th>`; i = j; } h += '</tr>'; }
  h += `<tr><th class="dtrk-date">Date</th>${locs.map(l => `<th title="${escapeHtml(l.name)}">${escapeHtml(l.name)}<br><span style="font-weight:400;">${l.done} / ${l.elapsed}</span></th>`).join('')}</tr>`;
  th.innerHTML = h;
  tb.innerHTML = days.map(dy => `<tr class="${dy.today ? 'dtrk-today' : ''}"><td class="dtrk-date">${dy.label} <span style="color:var(--gray-500);font-weight:400;">${dy.dow}</span></td>${locs.map(l => {
    if (dy.future) return '<td class="dtrk-future">·</td>';
    const c = l.m.get(dy.key) || 0; const tk = $('dtrkTickOnly').checked, dl = `data-loc="${escapeHtml(l.name)}" data-day="${dy.key}" title="Double-click to see the ${c} record(s) with all details" style="cursor:pointer;"`; return c > 0 ? `<td class="dtrk-ok" ${dl}>${tk ? '✅' : '✅ ' + c}</td>` : `<td class="dtrk-miss" ${dl}>⚠ 0</td>`;
  }).join('')}</tr>`).join('');
  const today = days.find(x => x.today), notToday = today ? locs.filter(l => !(l.m.get(today.key) || 0)).map(l => l.name) : [];
  const full = locs.filter(l => l.missing === 0).length;
  try { dtkKpis(md); } catch (e) {}
  $('dtrkSummary').innerHTML = (dtrk_fbText() ? `<div style="margin-bottom:4px;color:var(--gray-600)">🧩 Filters (${dtrk.cfg.fmode === 'or' ? 'any' : 'all'}): ${escapeHtml(dtrk_fbText())}</div>` : '') + `<strong>${full}</strong> of ${locs.length} place(s) updated every day so far.` + (today ? ` Today: <strong>${locs.length - notToday.length}</strong> updated${notToday.length ? `, <span style="color:#b91c1c;">not yet: ${escapeHtml(notToday.join(', '))}</span>` : ' — all places done ✅'}.` : '');
  try { if (window.tableExpandRefresh) window.tableExpandRefresh('dtrkTable'); } catch (e) {}
}
function dtrk_missing(md) {
  return md.locs.map(l => ({ l, dates: md.days.filter(d => !d.future && !(l.m.get(d.key) || 0)).map(d => d.label.slice(0, 5)) })).filter(x => x.dates.length);
}
function dtrk_workbook() {
  const md = dtrk_model(); if (!md) return null;
  const aoa = [['Date', ...md.locs.map(l => l.name)], ['Group', ...md.locs.map(l => l.group)], ['Days updated', ...md.locs.map(l => `${l.done} / ${l.elapsed}`)]];
  md.days.forEach(d => aoa.push([d.label + ' ' + d.dow, ...md.locs.map(l => d.future ? '' : (l.m.get(d.key) || 0))]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Daily Updates');
  const miss = [['Place', 'Group', 'Days missing', 'Missing dates (dd/mm)'], ...dtrk_missing(md).map(x => [x.l.name, x.l.group, x.dates.length, x.dates.join(', ')])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(miss), 'Missing Days');
  return wb;
}
const dtrk_fileName = () => `Daily_Update_Tracker_${dtrk.data.from}_to_${dtrk.data.to}.xlsx`;
function dtrk_excel() { const wb = dtrk_workbook(); if (wb) XLSX.writeFile(wb, dtrk_fileName()); }
function dtrk_emailHtml(mode) {
  const md = dtrk_model(), d = dtrk.data, esc = escapeHtml;
  const th = 'border:1px solid #cbd5e1;padding:4px 8px;background:#1e3a8a;color:#fff;font-size:12px;', td = 'border:1px solid #cbd5e1;padding:3px 8px;text-align:center;font-size:12px;';
  const today = md.days.find(x => x.today), notToday = today ? md.locs.filter(l => !(l.m.get(today.key) || 0)).map(l => l.name) : [];
  const full = md.locs.filter(l => l.missing === 0).length, fu = (dtrk.fUser.length ? ` · users: ${esc(dtrk.fUser.join(', '))}` : '') + (dtrk_fbText() ? ` · filters: ${esc(dtrk_fbText())}` : '');
  let h = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;"><h2 style="margin:0 0 4px;">Daily Update Tracker</h2><div style="color:#475569;font-size:13px;margin-bottom:10px;">List: ${esc(dtrk.listName)} · ${esc(d.from)} to ${esc(d.to)}${fu}</div>`;
  h += `<p style="font-size:13px;"><strong>${full}</strong> of ${md.locs.length} place(s) updated every day so far.` + (today ? ` Today: <strong>${md.locs.length - notToday.length}</strong> updated${notToday.length ? `, <span style="color:#b91c1c;"><strong>not yet:</strong> ${esc(notToday.join(', '))}</span>` : ' — all places done ✅'}.` : '') + '</p>';
  if (mode !== 'grid') {
    const ms = dtrk_missing(md);
    h += '<h3 style="margin:12px 0 4px;font-size:14px;">Missing days</h3>' + (ms.length ? `<table style="border-collapse:collapse;"><tr><th style="${th}">Place</th><th style="${th}">Days missing</th><th style="${th}">Dates (dd/mm)</th></tr>${ms.map(x => `<tr><td style="${td}text-align:left;">${esc(x.l.name)}</td><td style="${td}color:#b91c1c;font-weight:700;">${x.dates.length}</td><td style="${td}text-align:left;">${esc(x.dates.join(', '))}</td></tr>`).join('')}</table>` : '<p style="font-size:13px;">No gaps ✅</p>');
  }
  if (mode !== 'missing') {
    h += `<h3 style="margin:14px 0 4px;font-size:14px;">Full grid</h3><table style="border-collapse:collapse;"><tr><th style="${th}">Date</th>${md.locs.map(l => `<th style="${th}">${esc(l.name)}<br><span style="font-weight:400;">${l.done} / ${l.elapsed}</span></th>`).join('')}</tr>` +
      md.days.map(dy => `<tr><td style="${td}text-align:left;font-weight:600;">${dy.label} ${dy.dow}</td>${md.locs.map(l => { if (dy.future) return `<td style="${td}color:#94a3b8;">·</td>`; const c = l.m.get(dy.key) || 0; return c > 0 ? `<td style="${td}color:#15803d;">${$('dtrkTickOnly').checked ? '✅' : '✅ ' + c}</td>` : `<td style="${td}color:#b91c1c;background:#fef2f2;font-weight:700;">⚠ 0</td>`; }).join('')}</tr>`).join('') + '</table>';
  }
  return h + '</div>';
}
/* ---------- Attachments / picture columns for list items ---------- */
const attCache = new Map();
function att_origin() { try { return new URL(getGlobalSiteUrl()).origin; } catch (e) { return ''; } }
function att_fromFields(f) {   // picture-column values: JSON with serverRelativeUrl, or {Url}
  const out = [];
  for (const [k, v] of Object.entries(f || {})) {
    let o = v;
    if (typeof v === 'string' && v.trim().startsWith('{')) { try { o = JSON.parse(v); } catch (e) { continue; } }
    if (!o || typeof o !== 'object') continue;
    const rel = o.serverRelativeUrl || o.ServerRelativeUrl; const url = o.Url || o.url;
    if (rel) out.push({ name: o.fileName || k, rel, col: k });
    else if (url && /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(url)) out.push({ name: o.Description || k, abs: url, col: k });
  }
  return out;
}
async function att_list(listId, itemId) {
  const key = listId + '|' + itemId; if (attCache.has(key)) return attCache.get(key);
  const site = getGlobalSiteUrl().replace(/\/+$/, '');
  const r = await fetch(`${site}/_api/web/lists(guid'${listId}')/items(${itemId})/AttachmentFiles`, { headers: { Authorization: `Bearer ${sp_token() || getGlobalAccessToken()}`, Accept: 'application/json;odata=nometadata' } });
  if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
  const j = await r.json(); const v = (j.value || []).map(a => ({ name: a.FileName, rel: a.ServerRelativeUrl, col: 'Attachment' }));
  attCache.set(key, v); return v;
}
async function att_blobUrl(a) {
  if (a.blobUrl) return a.blobUrl;
  const url = a.abs || (att_origin() + a.rel);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${sp_token() || getGlobalAccessToken()}` } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const b = await r.blob(); a.blobUrl = URL.createObjectURL(b); a.type = b.type; return a.blobUrl;
}
async function att_render(host, listId, recs) {
  host.innerHTML = '<div class="text-sm" style="color:var(--gray-500);">⏳ Looking for attachments…</div>';
  const groups = []; let restErr = null;
  for (const r of recs.slice(0, 20)) {
    let items = att_fromFields(r.f);
    const flag = r.f && (r.f.Attachments === true || r.f.Attachments === 'true' || r.f.Attachments === undefined);
    if (flag && r.id) { try { items = items.concat(await att_list(listId, r.id)); } catch (e) { restErr = restErr || e; } }
    if (items.length) groups.push({ id: r.id, items });
  }
  if (!groups.length) {
    host.innerHTML = restErr ? `<div class="text-sm" style="color:#b45309;">⚠ Could not read attachments (${escapeHtml(restErr.message)}). SharePoint's attachment API needs a SharePoint-scoped token (audience <code>https://&lt;tenant&gt;.sharepoint.com</code>); a Microsoft Graph token cannot list list-item attachments. Image/picture columns still show here when present.</div>` : '<div class="text-sm" style="color:var(--gray-500);">No attachments on these records.</div>';
    return;
  }
  host.innerHTML = '<strong style="font-size:13px;">📎 Attachments</strong>' + groups.map(g => `<div style="margin-top:8px;"><div class="text-sm" style="color:var(--gray-500);">Item ${escapeHtml(g.id)}</div><div class="att-grid" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;">${g.items.map((a, i) => `<div class="att-tile" data-g="${escapeHtml(g.id)}" data-i="${i}" style="width:150px;"><div class="att-box" style="width:150px;height:110px;border:1px solid var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:12px;color:var(--gray-500);">⏳</div><div class="text-sm" style="word-break:break-all;margin-top:2px;">${escapeHtml(a.name)}</div></div>`).join('')}</div></div>`).join('');
  for (const g of groups) g.items.forEach(async (a, i) => {
    const tile = host.querySelector(`.att-tile[data-g="${CSS.escape(String(g.id))}"][data-i="${i}"]`); if (!tile) return;
    const box = tile.querySelector('.att-box');
    try {
      const u = await att_blobUrl(a);
      if (/^image\//.test(a.type || '') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.name)) {
        box.innerHTML = `<img src="${u}" alt="" style="max-width:100%;max-height:100%;cursor:zoom-in;">`;
        box.firstChild.addEventListener('click', () => window.open(u, '_blank'));
      } else { box.innerHTML = `<a href="${u}" download="${escapeHtml(a.name)}">📄 Download</a>`; }
    } catch (e) { box.innerHTML = `<span title="${escapeHtml(e.message)}">⚠ cannot load (${escapeHtml(e.message)})</span>`; }
  });
}
function att_openModal(listId, item, title) {
  let m = document.querySelector('#attModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'attModal';
    m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = '<div class="card" style="max-width:760px;width:100%;max-height:88vh;overflow:auto;margin:0;"><div class="card-header"><div class="card-title" id="attModalTitle">Attachments</div><button id="attModalClose" class="ghost small" type="button">✖ Close</button></div><div id="attModalBody"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m || (e.target.id === 'attModalClose')) m.style.display = 'none'; });
  }
  document.querySelector('#attModalTitle').textContent = title || ('Attachments — item #' + item.id);
  m.style.display = 'flex';
  att_render(document.querySelector('#attModalBody'), listId, [{ id: String(item.id), f: item.fields || {} }]).catch(() => {});
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button[data-att]'); if (!b) return;
  e.stopPropagation();
  const [src, id] = b.dataset.att.split(':');
  const st = src === 'exp' ? expState : editorState; const items = src === 'exp' ? expState.allItems : editorState.items;
  const it = items.find(x => String(x.id) === id); if (it) att_openModal(st.listId, it);
}, true);
function dtrk_showCell(loc, day) {
  const uset = new Set(dtrk.fUser), recs = dtrk.rows.filter(r => r.loc === loc && r.day === day && (!uset.size || uset.has(r.user)) && dtrk_fbPass(r));
  const extra = Array.from(new Set(recs.flatMap(r => Object.keys(r.f || {})))).filter(k => !k.startsWith('@') && !k.startsWith('_') && !['id', 'ID'].includes(k) && ![dtrk.cfg.dateCol, dtrk.cfg.locCol].includes(k));
  if (recs.length && window.gdOpenItem) {
    const dayTxt = day.split('-').reverse().join('/');
    window.gdOpenItem({ siteId: dtrk.siteId, listId: dtrk.listId, items: recs.map(r => ({ id: r.id, createdDateTime: r.created, fields: r.f || {} })), index: 0, columns: dtrk.cols || [], names: [dtrk.cfg.dateCol, dtrk.cfg.locCol, dtrk.cfg.grpCol, dtrk.cfg.userCol].filter(Boolean), title: `${loc} — ${dayTxt} — ${recs.length} record(s)${recs.length > 1 ? ' (check for duplicates)' : ''}`, onSaved: () => {} });
    return;
  }
  const cols = ['Item ID', 'Created (system)', ...[dtrk.cfg.dateCol, dtrk.cfg.locCol].filter(Boolean), ...extra];
  $('dtrkDetailTitle').textContent = `${loc} — ${day.split('-').reverse().join('/')} — ${recs.length} record(s)`;
  $('dtrkDetailNote').textContent = recs.length ? (recs.length > 1 ? 'More than one record exists for this place on this day — check whether these are expected (e.g. different business units) or duplicates.' : 'Exactly one record.') : 'No record exists for this place on this day.';
  $('dtrkDetailHead').innerHTML = '<tr>' + cols.map(c => `<th>${escapeHtml(c)}</th>`).join('') + '</tr>';
  $('dtrkDetailBody').innerHTML = recs.slice(0, 200).map(r => `<tr data-rid="${escapeHtml(r.id)}" title="Double-click to view / edit">` + cols.map(c => `<td>${escapeHtml(String(c === 'Item ID' ? r.id : c === 'Created (system)' ? (r.created ? new Date(r.created).toLocaleString() : '') : xlCell(r.f ? r.f[c] : '') ?? ''))}</td>`).join('') + '</tr>').join('');
  $('dtrkDetailModal').style.display = 'flex';
  att_render($('dtrkDetailAtt'), dtrk.listId, recs).catch(() => {});
}
function dtrk_emSet(m, t) { const el = $('dtrkEmStatus'); el.className = 'status-msg ' + t; el.textContent = m; }
function dtrk_emOpen() {
  if (!dtrk.data) return;
  $('dtrkEmSubject').value = `Daily Update Tracker — ${dtrk.data.from} to ${dtrk.data.to}`;
  dtrk_emSet('', 'info'); $('dtrkEmailModal').style.display = 'flex';
}
function dtrk_emEml() {
  const to = $('dtrkEmTo').value.trim(), cc = $('dtrkEmCc').value.trim(), subject = $('dtrkEmSubject').value.trim() || 'Daily Update Tracker';
  if (!to) { dtrk_emSet('⚠ Enter at least one recipient in "To".', 'warn'); return; }
  let attachment = null;
  if ($('dtrkEmAttach').checked) { const wb = dtrk_workbook(); attachment = { format: 'xlsx', fileName: dtrk_fileName(), dataB64: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) }; }
  const eml = expEmail_buildEml(dtrk_emailHtml($('dtrkEmBody').value), subject, to, cc, attachment);
  const blob = new Blob([eml], { type: 'message/rfc822' }), url = URL.createObjectURL(blob), name = `Daily_Update_Tracker_${dtrk.data.from}_to_${dtrk.data.to}.eml`;
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 5000);
  dtrk_emSet(`✅ Draft ${name} downloaded${attachment ? ' with ' + attachment.fileName + ' attached' : ''}. Double-click it to open in Outlook, review and Send.`, 'success');
  addActivity('email', `Daily Update Tracker email draft (${dtrk.data.from} to ${dtrk.data.to})`);
}
async function dtrk_emCopy() {
  try {
    const html = dtrk_emailHtml($('dtrkEmBody').value), plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (navigator.clipboard && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
    else await navigator.clipboard.writeText(plain);
    dtrk_emSet('✅ Copied. In Outlook choose New Email and paste (Ctrl+V) — the table keeps its colours.', 'success');
  } catch (err) { dtrk_emSet('✘ Copy failed: ' + err.message, 'error'); }
}
function dtrk_init() {
  const host = document.querySelector('[data-list-picker="dtrk"]'); if (!host || dtrk.picker) return;
  const d = new Date(), ymd = x => `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
  $('dtrkFrom').value = ymd(new Date(d.getFullYear(), d.getMonth(), 1)); $('dtrkTo').value = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  dtrk.picker = createListPicker(host, { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), initialValue: '', onChange: v => dtrk_selectList(v) });
  try { const saved = localStorage.getItem(profileKey('dtrk_list')); if (saved) { dtrk.picker.setValue(saved); dtrk_selectList(saved); } } catch (e) {}
  ['dtrkDateCol', 'dtrkLocCol', 'dtrkGrpCol', 'dtrkUserCol'].forEach(id => $(id).addEventListener('change', () => { dtrk.cfg.dateCol = $('dtrkDateCol').value; dtrk.cfg.locCol = $('dtrkLocCol').value; dtrk.cfg.grpCol = $('dtrkGrpCol').value; dtrk.cfg.userCol = $('dtrkUserCol').value; dtrk_saveCfg(); }));
  $('dtrkLoadBtn').addEventListener('click', dtrk_check);
  $('dtrkExcelBtn').addEventListener('click', dtrk_excel);
  $('dtrkEmailBtn').addEventListener('click', dtrk_emOpen);
  $('dtrkEmailClose').addEventListener('click', () => { $('dtrkEmailModal').style.display = 'none'; });
  $('dtrkEmDraft').addEventListener('click', dtrk_emEml);
  $('dtrkEmCopy').addEventListener('click', dtrk_emCopy);
  $('dtrkOnlyMissing').addEventListener('change', dtrk_render);
  $('dtrkTickOnly').addEventListener('change', dtrk_render);
  $('dtrkTable').querySelector('tbody').addEventListener('dblclick', e => { const td = e.target.closest('td[data-loc]'); if (td) dtrk_showCell(td.dataset.loc, td.dataset.day); });
  $('dtrkDetailClose').addEventListener('click', () => { $('dtrkDetailModal').style.display = 'none'; });
}
