/* ---------- the same confirmation dialog as the Excel upload ("Upload … ?  Cancel / Upload"), asked before every SharePoint upload ---------- */
function spDocLine(label, no, col) { const ok = col && col !== SKIP_VALUE; if (no) return ok ? `\n✓ ${label} no. ${no} → column “${col}”` : `\n⚠ ${label} no. ${no} is NOT uploaded — the document-number field is not mapped to a SharePoint column (ask the administrator)`; return ok ? `\n⚠ Nothing has been printed yet — the “${col}” column stays empty. Print first to attach a ${label.toLowerCase()} number.` : ''; }
function spAsk(text, title) {
  text = String(text) + (spAsk.extra || ''); spAsk.extra = '';
  return new Promise(res => {
    const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), L = String(text).split('\n').map(x => x.trim()).filter(Boolean), main = (L[0] || 'Upload the data').replace(/\?\s*$/, ''), notes = L.slice(1);
    const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
    o.innerHTML = `<div role="dialog" aria-modal="true" style="background:var(--card,#fff);color:var(--text,#222);border-radius:12px;max-width:520px;width:100%;padding:18px 20px;box-shadow:0 10px 40px rgba(0,0,0,.35);max-height:90vh;overflow:auto;"><div style="font-weight:700;font-size:16px;margin-bottom:8px;">${esc(title || '📤 Upload to SharePoint?')}</div><div class="text-sm" style="margin-bottom:14px;line-height:1.5;">You are about to upload:<ul style="margin:6px 0 6px 18px;"><li><b>${esc(main)}</b></li></ul>${notes.map(n => `<div style="margin-top:6px;${/^⚠/.test(n) ? 'color:#b45309;' : ''}">${esc(n)}</div>`).join('')}<div style="margin-top:6px;">Nothing is sent to SharePoint until you confirm.</div></div><div class="btn-row" style="justify-content:flex-end;gap:8px;"><button type="button" class="ghost" data-v="cancel">Cancel</button><button type="button" class="success primary" data-v="ok">⬆ Upload</button></div></div>`;
    const done = v => { o.remove(); document.removeEventListener('keydown', kd, true); res(v === 'ok'); }, kd = e => { if (e.key === 'Escape') { e.stopPropagation(); done('cancel'); } };
    o.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) done(b.dataset.v); else if (e.target === o) done('cancel'); });
    document.addEventListener('keydown', kd, true); document.body.appendChild(o); const f = o.querySelector('button.success'); if (f) f.focus();
  });
}
/* ---------- one clear confirmation after every upload to SharePoint (all upload actions share createItem) ---------- */
const spUp = { ok: 0, fail: 0, lists: new Map(), n: 0, t: null, t0: 0, quiet: 0 };
function spUpNote(listId, ok) { if (!spUp.t0) spUp.t0 = Date.now(); if (ok) spUp.ok++; else spUp.fail++; spUp.lists.set(listId, (spUp.lists.get(listId) || 0) + 1); clearTimeout(spUp.t); spUp.t = setTimeout(spUpFlush, 2200); }
function spUpFlush() {
  if (spUp.n > 0) { spUp.t = setTimeout(spUpFlush, 1000); return; }
  const b = { ok: spUp.ok, fail: spUp.fail, lists: [...spUp.lists.entries()].map(([id, n]) => [(window.spListNames || {})[id] || 'SharePoint list', n]), secs: (Date.now() - spUp.t0) / 1000 }; spUp.ok = spUp.fail = spUp.t0 = 0; spUp.lists = new Map();
  let quiet = spUp.quiet > 0; try { if (typeof activeViewId === 'function' && activeViewId() === 'editor' && b.ok + b.fail <= 1) quiet = true; } catch (e) {} /* the end-of-upload message is shown inside each section; the pop-up (spUpShow) is kept but switched off */ if (!quiet && window.spUpPopup === true) spUpShow(b);
}
function spUpShow(b) {
  document.querySelectorAll('#spUpConf').forEach(x => x.remove()); const bad = b.fail > 0, allBad = b.ok === 0, col = allBad ? '#b42318' : bad ? '#b45309' : '#0b7a0b', f = n => Number(n).toLocaleString(), esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ov = document.createElement('div'); ov.id = 'spUpConf'; ov.setAttribute('role', 'alertdialog'); ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML = `<div style="background:var(--card,#fff);color:var(--gray-900,#111);border-radius:14px;max-width:460px;width:100%;padding:22px 24px;box-shadow:0 20px 50px rgba(0,0,0,.3);border-top:6px solid ${col};text-align:center;">
    <div style="font-size:42px;line-height:1">${allBad ? '❌' : bad ? '⚠️' : '✅'}</div>
    <div style="font-size:18px;font-weight:700;margin:8px 0 4px;color:${col}">${allBad ? 'Upload failed' : bad ? 'Upload finished with errors' : 'Uploaded to SharePoint'}</div>
    <div style="font-size:14px;margin:6px 0 2px"><strong>${f(b.ok)}</strong> row(s) added${b.lists.length ? ' to ' + b.lists.map(([n, c]) => `<strong>“${esc(n)}”</strong>${b.lists.length > 1 ? ' (' + f(c) + ')' : ''}`).join(', ') : ''}</div>
    ${bad ? `<div style="font-size:14px;color:#b42318;margin:2px 0"><strong>${f(b.fail)}</strong> row(s) failed — check the section's status message for the reason.</div>` : ''}
    <div style="font-size:12px;color:var(--gray-500,#64748b);margin-top:6px">${new Date().toLocaleString()} · ${b.secs < 1 ? '< 1' : Math.round(b.secs)} s</div>
    <button type="button" style="margin-top:14px;min-width:110px" data-ok="1">OK</button></div>`;
  document.body.appendChild(ov); const close = () => ov.remove(); ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-ok]')) close(); }); document.addEventListener('keydown', function k(e) { if (e.key === 'Escape' || e.key === 'Enter') { close(); document.removeEventListener('keydown', k); } });
  if (!bad) setTimeout(close, 12000); const bt = ov.querySelector('[data-ok]'); if (bt) bt.focus();
}
async function createItem(siteId, listId, fields, token) {
  spUp.n++; const raw = fields; fields = spCoerceFields(listId, fields);
  try {
    const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    }, 'create item');
    if (!r.ok) { let e; try { e = await r.text(); } catch { e = r.statusText; } throw new Error(`HTTP ${r.status}: ${e}${r.status === 400 ? spBadHint(listId, fields) : ''}`); }
    const j = await r.json(); spUpNote(listId, true); return j;
  } catch (e) { spUpNote(listId, false); throw e; } finally { spUp.n--; }
}
async function updateItem(siteId, listId, itemId, fields, token) {
  const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/fields`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }, 'update item');
  if (!r.ok) { let e; try { e = await r.text(); } catch { e = r.statusText; } throw new Error(`HTTP ${r.status}: ${e}`); }
  return r.json();
}
async function deleteItem(siteId, listId, itemId, token) {
  const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
  }, 'delete item');
  if (!r.ok && r.status !== 204) { let e; try { e = await r.text(); } catch { e = r.statusText; } throw new Error(`HTTP ${r.status}: ${e}`); }
}
async function fetchAllItems(siteId, listId, token, onProgress) {
  const items = []; let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=200`;
  while (url) {
    const r = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } }, 'fetch items');
    if (!r.ok) { let e; try { e = await r.text(); } catch { e = r.statusText; } throw new Error(`Item fetch failed (${r.status}): ${e}`); }
    const d = await r.json();
    if (d.value) items.push(...d.value);
    _prog(onProgress, items);
    url = d['@odata.nextLink'] || null;
  }
  setThrottleState(false);
  return items;
}

async function fetchRecentItems(siteId, listId, token, limit = SUGGESTION_ROW_LIMIT, onProgress) {
  const items = [];
  const pageSize = Math.min(2000, limit);
  let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items` +
            `?$expand=fields&$top=${pageSize}&$orderby=id desc`;
  while (url && items.length < limit) {
    const r = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } }, 'fetch recent items');
    if (!r.ok) {
      let e; try { e = await r.text(); } catch { e = r.statusText; }
      throw new Error(`Recent items fetch failed (${r.status}): ${e}`);
    }
    const d = await r.json();
    if (d.value && d.value.length) {
      const remaining = limit - items.length;
      items.push(...d.value.slice(0, remaining));
    }
    _prog(onProgress, items);
    url = d['@odata.nextLink'] || null;
    if (items.length >= limit) break;
  }
  setThrottleState(false);
  return items;
}

/* ============================================================
   Combo Box (used by uploader column mapping)
   ============================================================ */
/* ---------- Multi-select suggestion dropdown (used by every filter/search value field) ---------- */
function inferDateKind(vals) {
  const iso = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$/, times = new Set(); let n = 0;
  for (const v of (vals || []).slice(0, 200)) { const m = iso.exec(String(v)); if (!m) return null; times.add(m[1]); n++; }
  return n ? (times.size === 1 ? 'date' : 'datetime') : null;   // same time-of-day on every value => date-only column
}
function dateKindOf(colDef, vals) {
  if (colDef && colDef.dateOnly === true) return 'date';
  if (colDef && colDef.dateOnly === false) return 'datetime';
  return inferDateKind(vals) || 'datetime';
}
function buildDateInput(kind, current, onValue) {
  const inp = document.createElement('input'); inp.type = kind === 'date' ? 'date' : 'datetime-local'; inp.style.margin = '0';
  let v = current || ''; if (kind === 'date' && v.length > 10) v = v.slice(0, 10); if (kind !== 'date' && v.length === 10) v += 'T00:00';
  inp.value = v; inp.title = kind === 'date' ? 'Date (day only)' : 'Date and time';
  inp.addEventListener('input', () => onValue(inp.value));
  return { inp, initial: v };
}
const odOp = o => ({ gte: 'ge', lte: 'le', equals: 'eq', notEquals: 'ne' }[o] || o);
function odataDateClause(fp, op, raw) {
  op = odOp(op);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) {   // day-only input: compare against the whole local day
    const S = new Date(+m[1], +m[2] - 1, +m[3]).toISOString(), E = new Date(+m[1], +m[2] - 1, +m[3] + 1).toISOString();
    switch (op) {
      case 'eq': return `(${fp} ge ${S} and ${fp} lt ${E})`; case 'ne': return `(${fp} lt ${S} or ${fp} ge ${E})`;
      case 'gt': return `${fp} ge ${E}`; case 'ge': return `${fp} ge ${S}`; case 'lt': return `${fp} lt ${S}`; case 'le': return `${fp} lt ${E}`;
    }
  }
  const d = new Date(raw); if (isNaN(d.getTime())) return null;
  return `${fp} ${op} ${d.toISOString()}`;
}
function dateMatch(val, f) {
  const pv = filterVals(f)[0]; if (!pv) return true;
  const d = new Date(val); if (val === null || val === undefined || val === '' || isNaN(d.getTime())) return f.op === 'notEquals';
  let a, b;
  if (f.dkind === 'date') { const k = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; a = k(d); b = pv.slice(0, 10); }
  else { a = Math.floor(d.getTime() / 60000); b = Math.floor(new Date(pv).getTime() / 60000); }
  switch (f.op) { case 'equals': return a === b; case 'notEquals': return a !== b; case 'gt': return a > b; case 'gte': return a >= b; case 'lt': return a < b; case 'lte': return a <= b; }
  return true;
}
const DATE_OPS = ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte'];
function filterVals(f) {
  if (!f) return [];
  if (Array.isArray(f.values) && f.values.length) return f.values.map(String);
  return (f.value !== undefined && f.value !== null && String(f.value) !== '') ? [String(f.value)] : [];
}
function setFilterVals(f, arr) { f.values = arr.slice(); f.value = arr.length ? arr[0] : ''; }
function distinctFieldValues(items, field) {
  const set = new Set();
  for (const it of items || []) {
    const v = it.fields?.[field]; if (v === null || v === undefined || v === '') continue;
    set.add((typeof v === 'object' ? (Array.isArray(v) ? v.join('; ') : JSON.stringify(v)) : String(v)).trim());
    if (set.size >= 2000) break;
  }
  return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}
function multiMatch(val, f) {
  const vals = filterVals(f);
  if (f.dkind && DATE_OPS.includes(f.op)) return dateMatch(val, f);
  if (['isEmpty', 'isNotEmpty'].includes(f.op) || vals.length <= 1) return e_matchFilter(val, f.op, vals.length ? vals[0] : (f.value ?? ''));
  const neg = f.op === 'notEquals' || f.op === 'notContains';
  return neg ? vals.every(x => e_matchFilter(val, f.op, x)) : vals.some(x => e_matchFilter(val, f.op, x));
}
function buildFilterValueControl(f, options, enabled, onChange, colInfo) {
  const wrap = document.createElement('div'); wrap.style.width = '100%';
  f.dkind = enabled ? (colInfo && colInfo.type === 'date' ? dateKindOf(colInfo, options) : inferDateKind(options)) : null;
  if (f.dkind && DATE_OPS.includes(f.op)) {
    const { inp, initial } = buildDateInput(f.dkind, filterVals(f)[0], v => { setFilterVals(f, v ? [v] : []); onChange(); });
    if (initial !== filterVals(f)[0]) setFilterVals(f, initial ? [initial] : []);
    wrap.appendChild(inp); return wrap;
  }
  if (!enabled || ['gt', 'lt', 'gte', 'lte'].includes(f.op)) {
    const inp = document.createElement('input'); inp.type = 'text'; inp.style.margin = '0';
    if (!enabled) { inp.value = '(not needed)'; inp.disabled = true; }
    else { inp.placeholder = 'Value…'; inp.value = f.value || ''; inp.addEventListener('input', () => { f.value = inp.value; f.values = []; onChange(); }); }
    wrap.appendChild(inp); return wrap;
  }
  wrap.appendChild(buildMultiCombo(filterVals(f), options, arr => { setFilterVals(f, arr); onChange(); }));
  return wrap;
}
function buildMultiCombo(selected, options, onChange, opts = {}) {
  const sel = new Set((selected || []).map(String));
  const idle = opts.placeholder || 'Type to search or pick values…';
  const wrap = document.createElement('div'); wrap.className = 'combo mcombo';
  const box = document.createElement('div'); box.className = 'mc-box';
  const input = document.createElement('input'); input.type = 'text'; input.className = 'mc-input'; input.autocomplete = 'off';
  const list = document.createElement('div'); list.className = 'combo-list mc-list';
  box.appendChild(input); wrap.appendChild(box); wrap.appendChild(list);
  let isOpen = false, hi = 0, shown = [];
  const emit = () => onChange(Array.from(sel));
  function renderChips() {
    box.querySelectorAll('.mc-chip').forEach(n => n.remove());
    const all = Array.from(sel), MAXC = all.length > 1 ? 0 : 1;   // a fixed one-line box: first chips + “+N more”, so the page layout never grows
    all.slice(0, MAXC).forEach(v => {
      const c = document.createElement('span'); c.className = 'mc-chip'; c.title = v;
      const t = document.createElement('span'); t.textContent = v.length > 28 ? v.slice(0, 27) + '…' : v;
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '✖';
      x.addEventListener('mousedown', e => { e.preventDefault(); sel.delete(v); renderChips(); renderList(); emit(); });
      c.appendChild(t); c.appendChild(x); box.insertBefore(c, input);
    });
    if (all.length > MAXC) { const m = document.createElement('span'); m.className = 'mc-chip mc-more'; m.textContent = all.length + ' selected'; m.title = all.join('\n'); box.insertBefore(m, input); }
    input.placeholder = sel.size ? '' : idle;
  }
  function toggle(v) { if (sel.has(v)) sel.delete(v); else sel.add(v); input.value = ''; hi = 0; renderChips(); renderList(); emit(); }
  function paintHi() { list.querySelectorAll('.mc-item').forEach((el, i) => el.classList.toggle('highlighted', i === hi)); const el = list.querySelectorAll('.mc-item')[hi]; if (el) el.scrollIntoView({ block: 'nearest' }); }
  function renderList() {
    const q = input.value.trim().toLowerCase(), typed = input.value.trim(), all = options || [];
    shown = []; list.innerHTML = '';
    const pool = all.filter(o => !q || String(o).toLowerCase().includes(q)); pool.slice(0, 2000).forEach(o => shown.push({ v: String(o) })); list.dataset.more = pool.length > 2000 ? pool.length : '';
    if (typed && !sel.has(typed) && !all.some(o => String(o).toLowerCase() === q)) shown.push({ v: typed, add: true });
    if (!shown.length) { list.innerHTML = '<div class="combo-empty">No suggestions — type a value and press Enter</div>'; return; }
    const head = document.createElement('div'); head.className = 'mc-head';
    head.innerHTML = `<span>${sel.size} selected · ${shown.length}${list.dataset.more ? ' of ' + list.dataset.more : ''} shown</span>`;
    const bBig = document.createElement('button'); bBig.type = 'button'; bBig.textContent = list.classList.contains('mc-big') ? '⤡ Smaller' : '⤢ Larger'; bBig.title = 'Make this list larger / smaller (you can also drag the bottom-right corner)'; bBig.addEventListener('mousedown', e => { e.preventDefault(); list.classList.toggle('mc-big'); list.style.width = ''; list.style.height = ''; renderList(); cbFit(list); }); head.appendChild(bBig);
    const bAll = document.createElement('button'); bAll.type = 'button'; bAll.textContent = 'Select shown';
    const bNone = document.createElement('button'); bNone.type = 'button'; bNone.textContent = 'Clear';
    bAll.addEventListener('mousedown', e => { e.preventDefault(); shown.forEach(x => sel.add(x.v)); renderChips(); renderList(); emit(); });
    bNone.addEventListener('mousedown', e => { e.preventDefault(); sel.clear(); renderChips(); renderList(); emit(); });
    head.appendChild(bAll); head.appendChild(bNone); list.appendChild(head);
    shown.forEach((x, i) => {
      const el = document.createElement('div'); el.className = 'combo-item mc-item' + (i === hi ? ' highlighted' : '');
      el.innerHTML = `<span><input type="checkbox" tabindex="-1" ${sel.has(x.v) ? 'checked' : ''} />${x.add ? '➕ Use “' + escapeHtml(x.v) + '”' : escapeHtml(x.v)}</span>`;
      el.addEventListener('mousedown', e => { e.preventDefault(); toggle(x.v); });
      list.appendChild(el);
    });
  }
  const openList = () => { if (!isOpen) { isOpen = true; list.classList.add('open'); } renderList(); };
  const closeList = () => { isOpen = false; list.classList.remove('open'); input.value = ''; };
  box.addEventListener('mousedown', e => { if (e.target === box) { e.preventDefault(); input.focus(); } });
  list.addEventListener('mousedown', e => { if (e.target === list || e.target.classList.contains('mc-head') || e.target.parentNode === list && e.target.tagName === 'SPAN') e.preventDefault(); });   // dragging the scrollbar / resize corner must not close the list
  input.addEventListener('focus', openList);
  input.addEventListener('blur', closeList);
  input.addEventListener('input', () => { hi = 0; openList(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) openList(); hi = Math.min(hi + 1, shown.length - 1); paintHi(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); paintHi(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[hi]) toggle(shown[hi].v); }
    else if (e.key === 'Backspace' && !input.value && sel.size) { const last = Array.from(sel).pop(); sel.delete(last); renderChips(); renderList(); emit(); }
    else if (e.key === 'Escape') { closeList(); input.blur(); }
  });
  renderChips();
  return wrap;
}
function buildCombo(currentValue, columns, onChange) {
  const wrap = document.createElement('div'); wrap.className = 'combo';
  const inputWrap = document.createElement('div'); inputWrap.className = 'combo-input-wrap';
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'combo-input'; input.autocomplete = 'off'; input.placeholder = 'Type to search fields...';
  input.name = 'combo-' + Math.random().toString(36).slice(2, 8);
  input.id = input.name;
  const clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.className = 'combo-clear'; clearBtn.innerHTML = '✖';
  const arrow = document.createElement('span'); arrow.className = 'combo-arrow'; arrow.innerHTML = '▾';
  inputWrap.appendChild(input); inputWrap.appendChild(clearBtn); inputWrap.appendChild(arrow);
  const list = document.createElement('div'); list.className = 'combo-list';
  wrap.appendChild(inputWrap); wrap.appendChild(list);
  let highlightedIndex = -1, filtered = [], isOpen = false, localValue = currentValue;
  function displayTextFor(val) {
    if (!val || val === SKIP_VALUE) return '';
    const col = columns.find(c => c.name === val);
    return col ? `${col.displayName} (${col.name})` : val;
  }
  function setDisplayFromValue(val) {
    localValue = val; wrap.dataset.col = (!val || val === SKIP_VALUE) ? '' : val;
    if (!val || val === SKIP_VALUE) { input.value = ''; input.placeholder = '— Skip —'; clearBtn.style.display = 'none'; return; }
    input.value = displayTextFor(val);
    input.placeholder = 'Type to search...';
    clearBtn.style.display = 'block';
  }
  function renderList(query) {
    list.innerHTML = ''; filtered = [];
    const q = (query || '').trim().toLowerCase();
    filtered.push({ name: SKIP_VALUE, displayName: '— Skip —', internal: '', isSkip: true });
    columns.forEach(col => { if (!q) { filtered.push({ ...col, internal: col.name }); return; } if ((col.displayName + ' ' + col.name).toLowerCase().includes(q)) filtered.push({ ...col, internal: col.name }); });
    if (filtered.length === 1 && q) { const e = document.createElement('div'); e.className = 'combo-empty'; e.textContent = 'No matches'; list.appendChild(e); return; }
    filtered.forEach((item, idx) => {
      const el = document.createElement('div'); el.className = 'combo-item' + (item.isSkip ? ' skip' : ''); el.dataset.idx = idx;
      if (item.isSkip) el.textContent = item.displayName;
      else el.innerHTML = `<span>${highlightMatch(item.displayName, q)}</span><span class="internal">${highlightMatch(item.internal, q)}</span>`;
      el.addEventListener('mousedown', (e) => { e.preventDefault(); selectItem(item); });
      list.appendChild(el);
    });
    highlightedIndex = 0; updateHighlight();
  }
  function highlightMatch(text, q) {
    const safe = escapeHtml(text);
    if (!q) return safe;
    try { return safe.replace(new RegExp('(' + escapeRegex(q) + ')', 'ig'), '<span class="mark">$1</span>'); } catch (e) { return safe; }
  }
  function updateHighlight() {
    const items = list.querySelectorAll('.combo-item');
    items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIndex));
    const hl = items[highlightedIndex]; if (hl && isOpen) hl.scrollIntoView({ block: 'nearest' });
  }
  function openList() { if (isOpen) return; isOpen = true; list.classList.add('open'); renderList(''); }
  function closeList() { isOpen = false; list.classList.remove('open'); }
  function selectItem(item) {
    localValue = item.isSkip ? SKIP_VALUE : item.name;
    if (item.isSkip) { input.value = ''; input.placeholder = '— Skip —'; clearBtn.style.display = 'none'; }
    else { input.value = `${item.displayName} (${item.name})`; input.placeholder = 'Type to search...'; clearBtn.style.display = 'block'; }
    onChange.getCurrent = () => localValue;
    wrap.dataset.col = localValue === SKIP_VALUE ? '' : localValue; onChange(localValue); try { wrap.dispatchEvent(new CustomEvent('combochange', { bubbles: true })); } catch (e) {}
    closeList();
  }
  input.addEventListener('focus', () => { openList(); input.select(); });
  input.addEventListener('input', () => { if (!isOpen) openList(); renderList(input.value); });
  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('.combo-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) { openList(); return; } highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1); updateHighlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlightedIndex = Math.max(highlightedIndex - 1, 0); updateHighlight(); }
    else if (e.key === 'Enter') { e.preventDefault(); const item = filtered[highlightedIndex]; if (item) selectItem(item); }
    else if (e.key === 'Escape') { closeList(); setDisplayFromValue(localValue); input.blur(); }
  });
  clearBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    localValue = SKIP_VALUE;
    input.value = ''; input.placeholder = '— Skip —'; clearBtn.style.display = 'none';
    onChange.getCurrent = () => localValue;
    wrap.dataset.col = ''; onChange(SKIP_VALUE); try { wrap.dispatchEvent(new CustomEvent('combochange', { bubbles: true })); } catch (e) {}
    closeList();
  });
  document.addEventListener('mousedown', (e) => {
    if (!wrap.contains(e.target) && isOpen) { closeList(); setDisplayFromValue(localValue); }
  });
  onChange.getCurrent = () => localValue;
  setDisplayFromValue(currentValue);
  return wrap;
}

/* ============================================================
   CSV parse
   ============================================================ */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = []; let cur = [], field = '', inQuotes = false, i = 0;
  const firstLine = text.split(/\r?\n/)[0] || '';
  const candidates = [',', ';', '\t', '|']; let delim = ',', bestCount = 0;
  candidates.forEach(c => { const count = (firstLine.match(new RegExp('\\' + c, 'g')) || []).length; if (count > bestCount) { bestCount = count; delim = c; } });
  while (i < text.length) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) { if (ch === '"' && next === '"') { field += '"'; i += 2; continue; } if (ch === '"') { inQuotes = false; i++; continue; } field += ch; i++; continue; }
    if (ch === '"' && field === '') { inQuotes = true; i++; continue; }
    if (ch === delim) { cur.push(field); field = ''; i++; continue; }
    if (ch === '\r' && next === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; i += 2; continue; }
    if (ch === '\n' || ch === '\r') { cur.push(field); rows.push(cur); cur = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  const data = [];
  for (let r = 1; r < rows.length; r++) { if (rows[r].length === 1 && rows[r][0] === '') continue; const o = {}; headers.forEach((h, idx) => { o[h] = rows[r][idx] == null ? '' : rows[r][idx]; }); data.push(o); }
  return data;
}
async function parseFileToRows(file) {
  const isCsv = /\.csv$/i.test(file.name);
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => {
      try {
        let rows;
        if (isCsv) rows = parseCsv(e.target.result);
        else { const d = new Uint8Array(e.target.result); const wb = XLSX.read(d, { type: 'array' }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false }); }
        rows = rows.map(r => { const o = {}; Object.keys(r).forEach(k => { o[k] = r[k] == null ? '' : String(r[k]); }); return o; });
        res(rows);
      } catch (err) { rej(err); }
    };
    r.onerror = rej;
    if (isCsv) r.readAsText(file); else r.readAsArrayBuffer(file);
  });
}
async function fetchDataFromUrl(url) {
  const r = await fetchWithRetry(url, {}, 'fetch data URL');
  if (!r.ok) throw new Error(`Fetch failed (${r.status})`);
  const ct = r.headers.get('content-type') || '';
  const isCsv = /csv/i.test(ct) || /\.csv$/i.test(url);
  if (isCsv) return parseCsv(await r.text());
  const buf = await r.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false }).map(r => { const o = {}; Object.keys(r).forEach(k => { o[k] = r[k] == null ? '' : String(r[k]); }); return o; });
}

/* ============================================================
   Audit Metadata
   ============================================================ */
function addAuditMetadata(fields, target) {
  if (!currentUser) return fields;
  const now = new Date().toISOString();
  const username = currentUser.username || 'unknown';
  const displayName = currentUser.displayName || currentUser.username || 'unknown';
  const colSet = new Set((target.columns || []).map(c => c.name.toLowerCase()));
  const trySet = (candidates, value) => {
    for (const name of candidates) { if (colSet.has(name.toLowerCase())) { fields[name] = value; return true; } }
    return false;
  };
  trySet(['UploadedBy', 'Uploaded_x0020_By', 'CreatedBy_Text', 'Author_Text'], username);
  trySet(['UploadedByName', 'UploadedByDisplay', 'UploaderName'], displayName);
  trySet(['UploadedAt', 'Uploaded_x0020_At', 'UploadDate', 'UploadTimestamp'], now);
  return fields;
}

/* ============================================================
   Field Suggestion Helper (for editor)
   ============================================================ */
function attachFieldSuggestions(inputEl, fieldName, poolOverride, listNameArg) {
  if (!inputEl) return;
  const listName = listNameArg || editorState.listName || '';
  const pool = poolOverride || (editorState.suggestionItems.length ? editorState.suggestionItems : editorState.items);
  const getVals = () => ddValues(listName, fieldName, distinctFieldValues(pool, fieldName)) || [];
  if ((ddSpec(listName, fieldName) || {}).mode === 'off') return;
  let values = getVals();
  const explicit = ddIsExplicit(listName, fieldName);
  if (!explicit && (!values.length || values.length > 500)) return;
  const parent = inputEl.parentNode;
  if (parent.classList.contains('suggest-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'suggest-wrap';
  parent.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);
  const drop = document.createElement('div');
  drop.className = 'suggest-list';
  wrap.appendChild(drop);
  let filtered = [];
  let highlighted = 0;
  let open = false;
  const floating = () => !!inputEl.closest('.eds-sec,.ed-body'), place = () => { if (!open) return; const r = inputEl.getBoundingClientRect(), below = window.innerHeight - r.bottom - 8, above = r.top - 8, up = below < 170 && above > below; Object.assign(drop.style, { position: 'fixed', left: r.left + 'px', width: Math.max(r.width, 180) + 'px', right: 'auto', zIndex: 100050, maxHeight: Math.max(120, Math.min(260, up ? above : below)) + 'px', top: up ? 'auto' : r.bottom + 2 + 'px', bottom: up ? window.innerHeight - r.top + 2 + 'px' : 'auto' }); };
  function close() { if (!open) return; open = false; drop.classList.remove('open'); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); }
  function render(query) {
    const q = (query || '').trim().toLowerCase();
    filtered = !q ? values : values.filter(v => v.toLowerCase().includes(q));
    if (!filtered.length) { drop.innerHTML = '<div class="suggest-empty">No matches</div>'; highlighted = -1; return; }
    drop.innerHTML = filtered.slice(0, 200).map((v, i) => {
      const cls = i === highlighted ? 'suggest-item highlighted' : 'suggest-item';
      return `<div class="${cls}" data-idx="${i}" title="${escapeHtml(v)}">${escapeHtml(truncate(v, 80))}</div>`;
    }).join('');
    drop.querySelectorAll('.suggest-item').forEach(el => {
      el.addEventListener('mousedown', (e) => { e.preventDefault(); pick(filtered[parseInt(el.dataset.idx, 10)]); });
    });
  }
  function pick(val) { inputEl.value = val; inputEl.dispatchEvent(new Event('input', { bubbles: true })); inputEl.dispatchEvent(new Event('change', { bubbles: true })); close(); inputEl.focus(); }
  function openList() { if (open) return; values = getVals(); const sp = ddSpec(listName, fieldName); if (sp && sp.mode === 'list') ddListLoad(sp).then(() => { if (open) { values = getVals(); render(inputEl.value); } }); open = true; highlighted = 0; render(inputEl.value); drop.classList.add('open'); if (floating()) { place(); window.addEventListener('scroll', place, true); window.addEventListener('resize', place); } }
  function highlight(idx) {
    const items = drop.querySelectorAll('.suggest-item');
    if (!items.length) return;
    highlighted = Math.max(0, Math.min(idx, items.length - 1));
    items.forEach((el, i) => el.classList.toggle('highlighted', i === highlighted));
    const hl = items[highlighted]; if (hl) hl.scrollIntoView({ block: 'nearest' });
  }
  inputEl.addEventListener('focus', openList);
  inputEl.addEventListener('click', openList);
  inputEl.addEventListener('input', () => { if (!open) openList(); highlighted = 0; render(inputEl.value); });
  inputEl.addEventListener('keydown', (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openList(); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(highlighted + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(highlighted - 1); }
    else if (e.key === 'Enter') { if (filtered[highlighted] !== undefined) { e.preventDefault(); pick(filtered[highlighted]); } }
    else if (e.key === 'Escape') { close(); inputEl.blur(); }
  });
  inputEl.addEventListener('blur', () => { setTimeout(close, 150); });
  inputEl.addEventListener('change', () => {
    const v = String(inputEl.value || '').trim(); if (!v) return;
    const sp = ddSpec(listName, fieldName), vals = getVals();
    if (sp && sp.strict && vals.length && !vals.some(x => x.toLowerCase() === v.toLowerCase())) { sectionToast('“' + v + '” is not in the dropdown of this field — pick one of the listed values.', 'warn'); inputEl.value = ''; inputEl.dispatchEvent(new Event('input', { bubbles: true })); return; }
    ddHistAdd(listName, fieldName, v);
  });
}

