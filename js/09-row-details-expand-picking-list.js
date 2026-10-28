/* ============================================================
   Click-for-details: any data table row / activity / history entry opens a detail pane
   (skips editing grids, mapping tables, field pickers and anything interactive)
   ============================================================ */
(function installRowDetails() {
  const css = document.createElement('style');
  css.textContent = `table.gd-click tbody tr:not(.gd-skip) td{cursor:pointer;} table.gd-click tbody tr:hover td{background:rgba(37,99,235,.07);}
    .activity-item,.history-item{cursor:pointer;} .activity-item:hover,.history-item:hover{outline:1px solid var(--brand);}
    #gdModal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100001;align-items:center;justify-content:center;padding:20px;}
    #gdModal.gd-max .gd-card{max-width:96vw;height:94vh;max-height:94vh;} #gdModal .gd-card{background:var(--card);color:inherit;border-radius:10px;max-width:720px;width:100%;max-height:88vh;overflow:auto;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.35);}
    #gdModal table{width:100%;border-collapse:collapse;} #gdModal td,#gdModal th{border-bottom:1px solid var(--border);padding:6px 8px;text-align:left;vertical-align:top;font-size:13px;word-break:break-word;}
    #gdModal td.gd-k{width:34%;color:var(--gray-500);font-weight:600;} #gdModal tr.gd-hit td{background:rgba(250,204,21,.18);} #gdModal pre{white-space:pre-wrap;word-break:break-word;font-size:13px;margin:0;font-family:inherit;}`;
  document.head.appendChild(css);
  const modal = document.createElement('div'); modal.id = 'gdModal';
  modal.innerHTML = '<div class="gd-card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><strong id="gdTitle" style="flex:1;font-size:15px;">Details</strong><button class="ghost small" id="gdMax" type="button">⤢ Expand</button><button class="ghost small" id="gdPrev" type="button">◀</button><button class="ghost small" id="gdNext" type="button">▶</button><button class="success small" id="gdSave" type="button" style="display:none;">💾 Save</button><button class="secondary small" id="gdCopy" type="button">📋 Copy</button><button class="ghost small" id="gdClose" type="button">✖</button></div><div id="gdBody"></div></div>';
  document.body.appendChild(modal);
  const SKIP_TABLE = new Set(['mappingTable', 'inlineEditTable', 'wFefoUploadMapTable', 'incUploadMapTable', 'dtrkTable', 'dtrkDetailTable', 'plDataTable', 'plHistTable', 'dpDataTable', 'dpHistTable', 'mdpImpTable', 'wGRBTable', 'wGRBUpMapTable']);
  const INTERACTIVE = 'input,select,textarea,button,a,label,summary,[contenteditable],[data-action]';
  let cur = { rows: [], idx: 0, col: -1, headers: [], kind: 'table' };
  const txt = el => { const f = el.querySelector('input,select,textarea'); const v = f ? (f.type === 'checkbox' ? (f.checked ? 'Yes' : 'No') : f.value) : el.textContent; return String(v ?? '').replace(/\s+/g, ' ').trim(); };
  const eligibleTable = t => t && !SKIP_TABLE.has(t.id) && !t.closest('.pl-card, #view-fdplan, #view-fdplan-upload, #view-fddemand, #view-roster, #view-brkplan, #view-locsign, #view-att, #view-otrules, #view-foc, #view-mgt, #view-mgw') && !t.classList.contains('map-table') && !t.closest('[id$="Modal"],#gdModal,.modal');
  function headersOf(t) { const hr = t.tHead && t.tHead.rows.length ? t.tHead.rows[t.tHead.rows.length - 1] : t.rows[0]; return hr ? Array.from(hr.cells).map(c => txt(c)) : []; }
  /* hide / show fields (remembered), hide-empty, search, maximise */
  const LSH = LS_BASE + '_gdhide', LSE = LS_BASE + '_gdhideempty', LSM = LS_BASE + '_gdmax';
  const hiddenOf = k => { try { return new Set(JSON.parse(localStorage.getItem(LSH + ':' + k) || '[]')); } catch (e) { return new Set(); } };
  const saveHidden = (k, set) => { try { localStorage.setItem(LSH + ':' + k, JSON.stringify(Array.from(set))); } catch (e) {} };
  const hideEmptyOn = () => { try { return localStorage.getItem(LSE) === '1'; } catch (e) { return false; } };
  const isMax = () => { try { return localStorage.getItem(LSM) === '1'; } catch (e) { return false; } };
  function harvest() { if (cur.kind !== 'item') return; document.querySelectorAll('#gdBody [data-gdf]').forEach(el => { const f = cur.fields[el.dataset.gdf]; if (f) f.draft = el.value; }); }
  function fieldList() {
    if (cur.kind === 'item') return cur.fields.map((f, i) => ({ key: f.name, label: f.label, value: f.draft !== undefined ? f.draft : f.value, f, i }));
    const tr = cur.rows[cur.idx];
    return Array.from(tr.cells).map((c, i) => { let v = txt(c); const t = c.getAttribute('title'); if (t && t.length > v.length && /…$/.test(v)) v = t; const h = cur.headers[c.cellIndex] || 'Column ' + (i + 1); return { key: h, label: h, value: v, i }; });
  }
  function show() {
    const body = $('gdBody');
    modal.classList.toggle('gd-max', isMax()); $('gdMax').textContent = isMax() ? '⤡ Restore' : '⤢ Expand';
    $('gdSave').style.display = cur.kind === 'item' ? '' : 'none';
    if (cur.kind === 'text') { $('gdTitle').textContent = cur.title; body.innerHTML = `<pre>${escapeHtml(cur.text)}</pre>`; $('gdPrev').style.visibility = $('gdNext').style.visibility = 'hidden'; modal.style.display = 'flex'; return; }
    if (cur.kind === 'table') { $('gdTitle').textContent = `Row ${cur.idx + 1} of ${cur.rows.length}`; $('gdPrev').style.visibility = cur.idx > 0 ? '' : 'hidden'; $('gdNext').style.visibility = cur.idx < cur.rows.length - 1 ? '' : 'hidden'; }
    else if (cur.items && cur.items.length > 1) { $('gdTitle').textContent = `${cur.title} — ${cur.iidx + 1} of ${cur.items.length}`; $('gdPrev').style.visibility = cur.iidx > 0 ? '' : 'hidden'; $('gdNext').style.visibility = cur.iidx < cur.items.length - 1 ? '' : 'hidden'; }
    else { $('gdTitle').textContent = cur.title; $('gdPrev').style.visibility = $('gdNext').style.visibility = 'hidden'; }
    const hkey = cur.kind === 'item' ? 'item:' + (cur.listId || '') : 'tbl:' + cur.headers.join('|').slice(0, 240);
    const hidden = hiddenOf(hkey), all = fieldList(), hideEmpty = hideEmptyOn();
    const isEmpty = v => v === null || v === undefined || String(v).trim() === '';
    const shown = all.filter(x => !hidden.has(x.key) && !(hideEmpty && isEmpty(x.value)));
    const hiddenCount = all.length - shown.length;
    const rowHtml = x => {
      const f = x.f;
      const val = cur.kind === 'item' && f.editable ? (String(x.value ?? '').length > 80 || /\n/.test(String(x.value ?? '')) ? `<textarea data-gdf="${x.i}" rows="3" style="width:100%;">${escapeHtml(String(x.value ?? ''))}</textarea>` : `<input data-gdf="${x.i}" type="${f.inputType || 'text'}" value="${escapeHtml(String(x.value ?? ''))}" style="width:100%;">`)
        : `<div style="white-space:pre-wrap;word-break:break-word;${cur.kind === 'item' ? 'color:var(--gray-500);' : ''}">${escapeHtml(String(x.value ?? ''))}</div>`;
      return `<tr class="${cur.kind === 'table' && x.i === cur.col ? 'gd-hit' : ''}" data-flabel="${escapeHtml((x.label + ' ' + x.value).toLowerCase())}"><td class="gd-k">${escapeHtml(x.label)}</td><td>${val}</td><td style="width:28px;"><button type="button" class="ghost tiny" data-gdhide="${escapeHtml(x.key)}" title="Hide this field" style="padding:0 5px;">🙈</button></td></tr>`;
    };
    body.innerHTML = `<div id="gdMsg" class="text-sm" style="margin-bottom:6px;color:var(--gray-500);">${cur.kind === 'item' ? 'All fields of this record. Edit and press Save — grey fields are read-only.' : 'All columns of this row.'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">
        <input type="text" id="gdFieldSearch" placeholder="🔎 Find a field or value…" style="margin:0;max-width:260px;" />
        <label class="text-sm" style="display:inline-flex;align-items:center;gap:5px;"><input type="checkbox" id="gdHideEmpty" ${hideEmpty ? 'checked' : ''}/> Hide empty</label>
        <button type="button" id="gdFieldsBtn" class="secondary small">👁 Fields${hiddenCount ? ` (${hiddenCount} hidden)` : ''}</button>
        <button type="button" id="gdShowAll" class="ghost small"${hidden.size || hideEmpty ? '' : ' disabled'}>Show all</button>
        <span class="text-sm" style="color:var(--gray-500);">${shown.length} of ${all.length} field(s)</span>
      </div>
      <div id="gdFieldsPanel" style="display:${cur.panelOpen ? 'grid' : 'none'};grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:4px 14px;padding:8px 10px;margin-bottom:8px;border:1px solid var(--border);border-radius:8px;max-height:200px;overflow:auto;">
        ${all.map(x => `<label class="text-sm" style="display:flex;gap:6px;align-items:center;"><input type="checkbox" data-gdshow="${escapeHtml(x.key)}" ${hidden.has(x.key) ? '' : 'checked'}/> ${escapeHtml(x.label)}</label>`).join('')}
      </div>
      <table><tbody>${shown.map(rowHtml).join('') || '<tr><td colspan="3" style="color:var(--gray-500);font-style:italic;">All fields are hidden — use “Fields” or “Show all”.</td></tr>'}</tbody></table><div id="gdAtt" style="margin-top:12px;"></div>`;
    const rerender = () => { harvest(); show(); };
    $('gdFieldSearch').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); body.querySelectorAll('tr[data-flabel]').forEach(r => { r.style.display = !q || r.dataset.flabel.includes(q) ? '' : 'none'; }); });
    $('gdHideEmpty').addEventListener('change', e => { try { localStorage.setItem(LSE, e.target.checked ? '1' : '0'); } catch (x) {} rerender(); });
    $('gdFieldsBtn').addEventListener('click', () => { cur.panelOpen = !cur.panelOpen; $('gdFieldsPanel').style.display = cur.panelOpen ? 'grid' : 'none'; });
    $('gdShowAll').addEventListener('click', () => { saveHidden(hkey, new Set()); try { localStorage.setItem(LSE, '0'); } catch (x) {} rerender(); });
    body.querySelectorAll('[data-gdshow]').forEach(cb => cb.addEventListener('change', () => { const h = hiddenOf(hkey); cb.checked ? h.delete(cb.dataset.gdshow) : h.add(cb.dataset.gdshow); saveHidden(hkey, h); rerender(); }));
    body.querySelectorAll('[data-gdhide]').forEach(bt => bt.addEventListener('click', () => { const h = hiddenOf(hkey); h.add(bt.dataset.gdhide); saveHidden(hkey, h); rerender(); }));
    if (cur.kind === 'item' && cur.listId) att_render(document.querySelector('#gdAtt'), cur.listId, [{ id: String(cur.item.id), f: cur.item.fields || {} }]).catch(() => {});
    modal.style.display = 'flex';
  }
  $('gdMax').addEventListener('click', () => { try { localStorage.setItem(LSM, isMax() ? '0' : '1'); } catch (e) {} harvest(); show(); });
  const move = d => { if (cur.kind === 'item' && cur.items && cur.items.length > 1) { const n = cur.iidx + d; if (n < 0 || n >= cur.items.length) return; harvest(); window.gdOpenItem({ ...cur.opts, items: cur.items, index: n }); return; } if (cur.kind !== 'table') return; const n = cur.idx + d; if (n < 0 || n >= cur.rows.length) return; cur.idx = n; cur.col = -1; show(); };
  $('gdPrev').addEventListener('click', () => move(-1)); $('gdNext').addEventListener('click', () => move(1));
  $('gdClose').addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  document.addEventListener('keydown', e => { if (modal.style.display !== 'flex') return; if (e.key === 'Escape') modal.style.display = 'none'; else if (e.key === 'ArrowLeft') move(-1); else if (e.key === 'ArrowRight') move(1); });
  $('gdSave').addEventListener('click', async () => {
    if (cur.kind !== 'item') return;
    const msg = t => { const m = document.querySelector('#gdMsg'); if (m) m.textContent = t; };
    if (!hasPerm('editor-edit')) { msg('⚠ You do not have permission to edit.'); return; }
    const changes = {};
    harvest();
    cur.fields.forEach((f, i) => { if (!f.editable || f.draft === undefined) return; let v = f.draft; const o = String(f.value ?? ''); if (v === o) return; if (f.inputType === 'number') { if (v === '') v = null; else if (isNaN(Number(v))) return; else v = Number(v); } changes[f.name] = v; });
    if (!Object.keys(changes).length) { msg('No changes to save.'); return; }
    $('gdSave').disabled = true; msg('Saving…');
    try {
      await updateItem(cur.siteId, cur.listId, cur.item.id, changes, getGlobalAccessToken());
      Object.assign(cur.item.fields, changes); cur.fields.forEach(f => { if (f.name in changes) f.value = changes[f.name]; delete f.draft; });
      addActivity('edit', `Updated #${cur.item.id} (${Object.keys(changes).length} field(s)) from details window`);
      if (cur.onSaved) cur.onSaved();
      msg('✅ Saved ' + Object.keys(changes).length + ' field(s).');
    } catch (e) { msg('✘ ' + e.message); }
    finally { $('gdSave').disabled = false; }
  });
  window.gdOpenItem = function (o) {   // o: {siteId,listId,item | items+index,columns:[{name,displayName,type}],names:[...],onSaved,title}
    const items = o.items || null, iidx = o.index || 0; if (items) o = { ...o, item: items[iidx] };
    const opts = { ...o }; delete opts.item;
    const cols = o.columns || [], byName = new Map(cols.map(c => [c.name, c]));
    const allKeys = Object.keys(o.item.fields || {}).filter(k => !k.startsWith('@'));
    const names = (o.names || []).filter(n => allKeys.includes(n) || true).concat(allKeys.filter(k => !(o.names || []).includes(k) && !/^(id)$/i.test(k)).sort((a, b) => a.localeCompare(b)));
    const RO = /^(id|created|modified|author|editor|attachments|contenttype|edit|linktitle|linktitlenomenu|itemchildcount|foldchildcount|appeditor|appauthor)$/i;
    const sys = []; const it = o.item || {};
    if (it.createdDateTime) sys.push({ name: '__created', label: 'Created (system)', value: new Date(it.createdDateTime).toLocaleString(), editable: false });
    if (it.lastModifiedDateTime) sys.push({ name: '__modified', label: 'Modified (system)', value: new Date(it.lastModifiedDateTime).toLocaleString(), editable: false });
    if (it.createdBy && it.createdBy.user) sys.push({ name: '__createdBy', label: 'Created by', value: it.createdBy.user.displayName || it.createdBy.user.email || '', editable: false });
    if (it.lastModifiedBy && it.lastModifiedBy.user) sys.push({ name: '__modBy', label: 'Modified by', value: it.lastModifiedBy.user.displayName || it.lastModifiedBy.user.email || '', editable: false });
    const fields = [{ name: 'ID', label: 'Item ID', value: o.item.id, editable: false }, ...sys].concat(names.map(n => {
      const c = byName.get(n) || {}, v = o.item.fields ? o.item.fields[n] : '';
      const plain = v == null || ['string', 'number'].includes(typeof v);
      const ok = plain && !RO.test(n) && !(typeof UNSUPPORTED_EDIT_TYPES !== 'undefined' && UNSUPPORTED_EDIT_TYPES.has(c.type)) && c.readOnly !== true;
      return { name: n, label: c.displayName || n, value: plain ? v : xlCell(v), editable: ok, inputType: c.type === 'number' || c.type === 'currency' ? 'number' : 'text' };
    }));
    cur = { kind: 'item', title: o.title || `Record #${o.item.id}`, item: o.item, fields, siteId: o.siteId, listId: o.listId, onSaved: o.onSaved, items, iidx, opts };
    show();
  };
  $('gdCopy').addEventListener('click', async () => {
    const t = cur.kind === 'item' ? cur.fields.map(f => `${f.label}: ${f.value ?? ''}`).join('\n') : cur.kind === 'text' ? cur.text : Array.from(cur.rows[cur.idx].cells).map(c => `${cur.headers[c.cellIndex] || ''}: ${txt(c)}`).join('\n');
    try { await navigator.clipboard.writeText(t); $('gdCopy').textContent = '✅ Copied'; } catch (e) { $('gdCopy').textContent = '✘ Copy failed'; }
    setTimeout(() => { $('gdCopy').textContent = '📋 Copy'; }, 1500);
  });
  document.addEventListener('dblclick', e => {
    const tr = e.target.closest && e.target.closest('#dtrkDetailBody tr[data-rid]'); if (!tr || modal.style.display === 'flex') return;
    const rec = dtrk.rows.find(r => r.id === tr.dataset.rid); if (!rec) return;
    window.gdOpenItem({ siteId: dtrk.siteId, listId: dtrk.listId, item: { id: rec.id, fields: rec.f }, columns: dtrk.cols || [], names: Object.keys(rec.f || {}).filter(k => !k.startsWith('@') && !k.startsWith('_')), onSaved: () => {} });
  });
  document.addEventListener('mouseover', e => { const td = e.target.closest && e.target.closest('td'); if (!td) return; const t = td.closest('table'); if (eligibleTable(t)) t.classList.add('gd-click'); });
  document.addEventListener('dblclick', e => {
    if (modal.style.display === 'flex') return;
    const t0 = e.target; if (!t0.closest) return;
    // Record Editor: record cards and the inline grid's ID cell
    const rec = t0.closest('.record-item[data-id]');
    const inl = t0.closest('#inlineEditTable tr[data-id] td.sticky-col');
    if (rec || inl) {
      const id = String((rec || inl.parentElement).dataset.id), it = editorState.items.find(x => String(x.id) === id);
      if (it) { window.gdOpenItem({ siteId: editorState.siteId, listId: editorState.listId, item: it, columns: editorState.columns, names: ed_shownColumns().map(c => c.name), onSaved: () => { try { ed_renderRecordsList(); ed_renderInlineTable(); } catch (x) {} } }); return; }
    }
    const item = t0.closest('.activity-item,.history-item');
    if (item && !t0.closest(INTERACTIVE)) { cur = { kind: 'text', title: item.classList.contains('history-item') ? 'History entry' : 'Activity', text: item.innerText.trim() }; show(); return; }
    const td = t0.closest('td'); if (!td || t0.closest(INTERACTIVE) || td.dataset.loc) return;
    const table = td.closest('table'); if (!eligibleTable(table)) return;
    const tr = td.parentElement; if (tr.closest('thead') || tr.querySelector('input,select,textarea')) return;
    if (tr.dataset.emlId) {
      const it = emlState.allItems.find(x => String(x.id) === tr.dataset.emlId);
      if (it) { window.gdOpenItem({ siteId: emlState.siteId, listId: emlState.listId, item: it, columns: emlState.allColumns, names: emlState.selectedColumns, onSaved: () => { try { eml_renderPreview(); } catch (x) {} } }); return; }
    }
    if (tr.dataset.expId && table.id === 'expDataTable' || tr.dataset.expId) {
      const it = expState.allItems.find(x => String(x.id) === tr.dataset.expId);
      if (it) { window.gdOpenItem({ siteId: expState.siteId, listId: expState.listId, item: it, columns: expState.allColumns, names: expState.selectedColumns, onSaved: () => { try { e_renderPreview(); } catch (x) {} } }); return; }
    }
    const rows = Array.from(table.tBodies).flatMap(b => Array.from(b.rows)).filter(r => (r.cells.length > 1 || r.cells[0].colSpan < 2) && r.style.display !== 'none');
    cur = { kind: 'table', rows, idx: Math.max(0, rows.indexOf(tr)), col: Array.from(tr.cells).indexOf(td), headers: headersOf(table) };
    show();
  });
})();

/* ---------- Expand any table/list: full-screen view with multi-select search ---------- */
(function installTableExpand() {
  const css = document.createElement('style');
  css.textContent = `.tbl-expand-btn{position:absolute;top:4px;right:6px;z-index:20;opacity:.0;transition:opacity .15s;padding:2px 8px;font-size:12px;border-radius:6px;border:1px solid var(--border);background:var(--card);cursor:pointer;} .table-wrap:hover>.tbl-expand-btn,.tbl-expand-wrap:hover>.tbl-expand-btn{opacity:1;} .tbl-expand-btn:focus{opacity:1;}
    #tblExpandOverlay{display:none;position:fixed;inset:0;z-index:100000;background:var(--card);color:inherit;flex-direction:column;} #tblExpandOverlay .te-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);} #tblExpandOverlay .te-body{flex:1;overflow:auto;padding:0 14px 14px;} :where(#tblExpandOverlay) :where(table){width:100%;border-collapse:collapse;font-size:13px;} :where(#tblExpandOverlay) :where(th){position:sticky;top:0;background:var(--gray-100);color:var(--gray-700);z-index:3;text-align:left;padding:8px 10px;border-bottom:1px solid var(--gray-300);} :where(#tblExpandOverlay) :where(td){padding:6px 10px;border-bottom:1px solid var(--border);} #tblExpandOverlay .te-combo{min-width:300px;flex:1;max-width:560px;}`;
  css.textContent += '#tblExpandOverlay .te-bar{position:relative;z-index:41;} #tblExpandOverlay .te-body{position:relative;z-index:1;} #tblExpandOverlay .combo-list{z-index:100001;} #dtrkFB .combo-list{z-index:1200;}';
  document.head.appendChild(css);
  const ov = document.createElement('div'); ov.id = 'tblExpandOverlay';
  ov.innerHTML = '<div class="te-bar"><strong id="teTitle" style="font-size:15px;">Table</strong><select id="teCol" style="margin:0;width:auto;max-width:220px;"></select><div class="te-combo" id="teCombo"></div><span id="teCount" class="text-sm" style="color:var(--gray-500);"></span><div class="spacer" style="flex:1"></div><button id="teExcel" class="success small" type="button">⬇ Excel</button><button id="teEmail" class="secondary small" type="button">📧 Email</button><button id="tePrint" class="ghost small" type="button">🖨 Print</button><button id="teClose" class="ghost small" type="button">✖ Close</button></div><div id="teExtra" style="display:none;padding:8px 14px;border-bottom:1px solid var(--border);position:relative;z-index:40;background:var(--card);"></div><div class="te-body" id="teBody"></div>';
  document.body.appendChild(ov);
  const SKIP = new Set(['mappingTable', 'inlineEditTable', 'wFefoUploadMapTable', 'incUploadMapTable', 'plDataTable', 'dpDataTable', 'mdpImpTable', 'wGRBTable', 'wGRBUpMapTable']);
  const ok = t => t && !SKIP.has(t.id) && !t.closest('.pl-card, #view-fdplan, #view-fdplan-upload, #view-fddemand, #view-roster, #view-brkplan, #view-locsign, #view-att, #view-otrules, #view-foc, #view-mgt, #view-mgw') && !t.classList.contains('map-table') && !t.closest('#tblExpandOverlay,[id$="Modal"],#gdModal,.modal');
  let tbl = null, sel = [], colSel = {}, colOpts = {}, gOpts = new Set();
  const rowsOf = () => Array.from(tbl.tBodies).flatMap(b => Array.from(b.rows));
  const cellText = c => String(c.textContent || '').replace(/\s+/g, ' ').trim();
  const nxOf = hr => new Set(hr ? Array.from(hr.cells).map((c, i) => c.dataset && c.dataset.noexport ? i : -1).filter(i => i >= 0) : []);
  function apply() {
    const colIdx = $('teCol').value === '' ? -1 : parseInt($('teCol').value, 10), set = sel.map(v => v.toLowerCase());
    let shown = 0, total = 0;
    const colF = Object.entries(colSel).filter(([, v]) => v.length).map(([i, v]) => [parseInt(i, 10), v.map(x => x.toLowerCase())]), mt = (t, v, os) => os && os.has(v) ? t === v : t.includes(v);   // a value picked from the list matches the cell exactly; typed text still matches 'contains'
    rowsOf().forEach(r => {
      if (r.cells.length === 1 && r.cells[0].colSpan > 1) return;
      total++;
      let hit = colF.every(([i, vals]) => { const c = r.cells[i]; if (!c) return false; const t = cellText(c).toLowerCase(); return vals.some(v => mt(t, v, colOpts[i])); });
      if (hit && set.length) { const txts = Array.from(r.cells).filter((c, i) => (colIdx < 0 || i === colIdx) && !(c.dataset && c.dataset.noexport)).map(c => cellText(c).toLowerCase()); hit = set.some(v => txts.some(t => mt(t, v, gOpts))); }
      r.style.display = hit ? '' : 'none'; if (hit) shown++;
    });
    $('teCount').textContent = `${shown.toLocaleString()} of ${total.toLocaleString()} row(s)`;
  }
  function buildCombo() {
    const colIdx = $('teCol').value === '' ? -1 : parseInt($('teCol').value, 10), seen = new Set();
    rowsOf().forEach(r => Array.from(r.cells).forEach((c, i) => { if (colIdx >= 0 && i !== colIdx) return; if (c.dataset && c.dataset.noexport) return; const t = cellText(c); if (t && t.length <= 60 && seen.size < 3000) seen.add(t); }));
    const opts = Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })); gOpts = new Set(opts.map(x => x.toLowerCase()));
    const host = $('teCombo'); host.innerHTML = '';
    host.appendChild(buildMultiCombo(sel, opts, arr => { sel = arr; apply(); }, { placeholder: 'Search… pick one or more values (Enter to add typed text)' }));
  }
  function buildColFilters() {   // second header row: one multi-select per column
    const thead = tbl.tHead; if (!thead || !thead.rows.length) return;
    const hr = thead.rows[thead.rows.length - 1], n = hr.cells.length; if (!n) return;
    const fr = document.createElement('tr'); fr.className = 'te-filters';
    const hh = Math.max(30, Math.round(hr.getBoundingClientRect().height) || 34);
    for (let i = 0; i < n; i++) {
      const th = document.createElement('th'); th.style.cssText = `top:${hh}px;padding:3px 4px;font-weight:400;background:var(--gray-50);`;
      if (hr.cells[i].style.display === 'none') th.style.display = 'none'; /*te-filters-hide*/ if (hr.cells[i].dataset && hr.cells[i].dataset.noexport) { fr.appendChild(th); continue; }
      const seen = new Set(); rowsOf().forEach(r => { const c = r.cells[i]; if (!c || (r.cells.length === 1)) return; const t = cellText(c); if (t && t.length <= 80 && seen.size < 5000) seen.add(t); });
      const opts = Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })); colOpts[i] = new Set(opts.map(x => x.toLowerCase()));
      th.appendChild(buildMultiCombo([], opts, arr => { colSel[i] = arr; apply(); }, { placeholder: 'Filter…' }));
      fr.appendChild(th);
    }
    thead.appendChild(fr);
  }
  function restoreExtra() { const x = $('teExtra'), fb = document.querySelector('#dtrkFB'), ph = document.querySelector('#dtrkFBHome'); if (fb && ph && x.contains(fb)) ph.parentNode.insertBefore(fb, ph.nextSibling); if (x.dataset.rsm) { x.innerHTML = ''; x.dataset.rsm = ''; } x.style.display = 'none'; ov.dataset.src = ''; }
  function open(table, refresh) {
    if (featBlock('expand')) return;
    if (!refresh) { restoreExtra(); const fb = document.querySelector('#dtrkFB'); if (table.id === 'dtrkTable' && fb) { if (!document.querySelector('#dtrkFBHome')) { const ph = document.createElement('span'); ph.id = 'dtrkFBHome'; fb.parentNode.insertBefore(ph, fb); } $('teExtra').appendChild(fb); $('teExtra').style.display = ''; } ov.dataset.src = table.id || ''; }
    tbl = table.cloneNode(true); tbl.classList.remove('gd-click'); sel = []; colSel = {}; colOpts = {}; tbl.querySelectorAll('select').forEach(x => x.replaceWith(document.createTextNode(x.options[x.selectedIndex] ? x.options[x.selectedIndex].text : ''))); if (!table.dataset.keepInputs) tbl.querySelectorAll('input').forEach(x => x.replaceWith(document.createTextNode(x.type === 'checkbox' ? (x.checked ? '✔' : '') : x.value)));
    const title = (table.closest('.card') && table.closest('.card').querySelector('.card-title') || {}).textContent || document.querySelector('#topbarTitle').textContent;
    $('teTitle').textContent = '⤢ ' + title.trim().replace(/\s+/g, ' ').slice(0, 80);
    const hr = tbl.tHead && tbl.tHead.rows.length ? tbl.tHead.rows[tbl.tHead.rows.length - 1] : tbl.rows[0];
    $('teCol').innerHTML = '<option value="">All columns</option>' + (hr ? Array.from(hr.cells).map((c, i) => `<option value="${i}">${escapeHtml(cellText(c) || 'Column ' + (i + 1))}</option>`).join('') : '');
    $('teBody').innerHTML = ''; $('teBody').appendChild(tbl);
    buildColFilters(); buildCombo(); apply(); ov.style.display = 'flex';
  }
  $('teCol').addEventListener('change', () => { sel = []; buildCombo(); apply(); });
  ov.addEventListener('dblclick', e => { const td = e.target.closest && e.target.closest('td[data-loc]'); if (td && typeof dtrk_showCell === 'function') dtrk_showCell(td.dataset.loc, td.dataset.day); });
  window.tableExpandRefresh = id => { if (ov.style.display === 'flex' && ov.dataset.src === id) { const t = document.getElementById(id); if (t) open(t, true); } };
  $('teClose').addEventListener('click', () => { restoreExtra(); ov.style.display = 'none'; $('teBody').innerHTML = ''; tbl = null; });
  document.addEventListener('keydown', e => { const mm = document.querySelector('#wMailModal'); if (e.key === 'Escape' && ov.style.display === 'flex' && document.querySelector('#gdModal').style.display !== 'flex' && !(mm && mm.style.display === 'flex') && !(document.querySelector('#fdTripModal') && document.querySelector('#fdTripModal').style.display === 'flex')) $('teClose').click(); });
  $('teExcel').addEventListener('click', () => {
    if (!tbl || typeof XLSX === 'undefined') return;
    const hrs = tbl.tHead ? Array.from(tbl.tHead.rows).filter(r => !r.classList.contains('te-filters')) : [];
    const hr = hrs.length ? hrs[hrs.length - 1] : tbl.rows[0];
    const nxI = nxOf(hr), aoa = [hr ? Array.from(hr.cells).filter((c, i) => !nxI.has(i)).map(cellText) : []].concat(rowsOf().filter(r => r.style.display !== 'none' && !(r.cells.length === 1 && r.cells[0].colSpan > 1)).map(r => Array.from(r.cells).filter((c, i) => !nxI.has(i)).map(c => { const t = cellText(c); return t !== '' && !isNaN(Number(t.replace(/,/g, ''))) && !/^0\d/.test(t) ? Number(t.replace(/,/g, '')) : t; })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'List'); XLSX.writeFile(wb, `List_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
  /* what is currently displayed (visible rows only) — used by Email and Print */
  function tdata() {
    if (!tbl) return null;
    const hrs = tbl.tHead ? Array.from(tbl.tHead.rows).filter(r => !r.classList.contains('te-filters')) : [];
    const hr = hrs.length ? hrs[hrs.length - 1] : tbl.rows[0];
    const nxI = nxOf(hr), headers = hr ? Array.from(hr.cells).filter((c, i) => !nxI.has(i)).map(cellText) : [];
    const val = c => { const t = cellText(c); return t !== '' && /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d{1,9}(\.\d+)?$/.test(t) && !/^-?0\d/.test(t) ? Number(t.replace(/,/g, '')) : t; };
    const rows = rowsOf().filter(r => r.style.display !== 'none' && !(r.cells.length === 1 && r.cells[0].colSpan > 1)).map(r => Array.from(r.cells).filter((c, i) => !nxI.has(i)).map(val));
    const parts = [];
    if (sel.length) parts.push('Search: ' + sel.join(', ') + ($('teCol').value !== '' ? ' in ' + headers[parseInt($('teCol').value, 10)] : ''));
    Object.entries(colSel).forEach(([i, v]) => { if (v && v.length) parts.push((headers[i] || 'Column ' + (+i + 1)) + ': ' + v.join(', ')); });
    return { title: $('teTitle').textContent.replace(/^\s*⤢\s*/, '').trim() || 'List', headers, rows, note: `${rows.length} row(s)` + (parts.length ? ' · Filter — ' + parts.join(' · ') : '') };
  }
  window.tableExpandData = tdata;
  $('teEmail').addEventListener('click', () => { const d = tdata(); if (!d || !d.rows.length) { $('teCount').textContent = '⚠ No rows are displayed — nothing to email.'; return; } wMail_open('te'); });
  $('tePrint').addEventListener('click', () => { const d = tdata(); if (!d || !d.rows.length) { $('teCount').textContent = '⚠ No rows are displayed — nothing to print.'; return; } w_printTable(d.title, d.note, d.headers, d.rows); });
  // add a visible "Expand" bar above every table (scanned now and whenever the page changes)
  const barCss = document.createElement('style');
  barCss.textContent = '.tbl-expand-bar{display:flex;justify-content:flex-end;margin:2px 0 4px;} .tbl-expand-bar button{padding:2px 10px;font-size:12px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:inherit;cursor:pointer;} .tbl-expand-bar button:hover{border-color:var(--brand);color:var(--brand);}';
  document.head.appendChild(barCss);
  function findRow(host) {   // nearest button row above the table inside the same card
    let node = host;
    for (let i = 0; i < 5 && node && node.parentElement; i++) {
      for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
        const rows = (sib.classList.contains('btn-row') ? [sib] : Array.from(sib.querySelectorAll('.btn-row'))).filter(r => !r.closest('[id$="Modal"],.modal,#tblExpandOverlay,#wFefoFilterPanel') && r.querySelector('button'));
        if (rows.length) return rows[rows.length - 1];
      }
      node = node.parentElement; if (node.classList.contains('card') || node.classList.contains('view')) break;
    }
    return null;
  }
  function scan() {
    document.querySelectorAll('.tbl-expand-inline').forEach(b => { if (b._host && !b._host.isConnected) { const bar = b.parentElement; b.remove(); if (bar && bar.classList.contains('tbl-expand-bar') && !bar.children.length) bar.remove(); } });   // the table was re-drawn — drop its old button
    document.querySelectorAll('table').forEach(t => {
      if (!ok(t)) return;
      const mdpB = t.closest('#mdpPickBody'); if (mdpB && t !== mdpB.querySelector('table')) return;
      const host = t.closest('.table-wrap') || t.parentElement; if (!host || !host.parentElement) return;
      if (host._teBtn && host._teBtn.isConnected) return;
      const special = host.id === 'wFefoResultsWrap' || (t.id === 'fefoResultsTable') ? (document.querySelector('#wFefoExportExcelBtn') || {}).parentElement : null;
      const row = special || findRow(host), bt = document.createElement('button');
      bt.type = 'button'; bt.className = 'secondary small tbl-expand-inline'; bt.textContent = '⤢ Expand'; bt.title = 'Open this list full screen with search';
      bt.addEventListener('click', () => { if (t.closest('#mdpPickBody') && window.mdpTable) { const d = window.mdpTable(); if (d && d.rows.length) { const tb = document.createElement('table'); tb.innerHTML = '<thead><tr>' + d.headers.map(h => '<th>' + escapeHtml(String(h)) + '</th>').join('') + '</tr></thead><tbody>' + d.rows.map(r => '<tr>' + r.map(v => '<td>' + escapeHtml(v == null ? '' : String(v)) + '</td>').join('') + '</tr>').join('') + '</tbody>'; tb.id = 'mdpPickAll'; tb.dataset.title = d.title; open(tb); } return; } const tt = host.querySelector('table'); if (tt) open(tt); });
      if (row) { const close = Array.from(row.querySelectorAll(':scope > button')).find(x => /close/i.test(x.id) || /^\s*[✖✕×x]\s*(close)?\s*$/i.test(x.textContent)); const sp = row.querySelector(':scope > .spacer'); if (close) row.insertBefore(bt, close); else if (sp) row.insertBefore(bt, sp); else row.appendChild(bt); }
      else { const bar = document.createElement('div'); bar.className = 'btn-row tbl-expand-bar'; bar.style.margin = '2px 0 6px'; bar.appendChild(bt); host.parentElement.insertBefore(bar, host); }
      host._teBtn = bt; bt._host = host;
    });
  }
  let st = null; const sched = () => { clearTimeout(st); st = setTimeout(scan, 150); };
  new MutationObserver(sched).observe(document.body, { childList: true, subtree: true });
  scan();
  window.tableExpandOpen = open;
})();

/* ---------- Row numbers (#) on every list — pure CSS counters, so exports/details are untouched and filtering renumbers ---------- */
(function installRowNumbers() {
  const css = document.createElement('style');
  css.textContent = `table.rn-on{counter-reset:rn;} table.rn-on tbody tr{counter-increment:rn;}
    table.rn-on tbody tr::before{content:counter(rn);display:table-cell;box-sizing:border-box;min-width:38px;padding:4px 8px;text-align:center;font-size:12px;color:var(--gray-500);border-bottom:1px solid var(--border);vertical-align:middle;font-variant-numeric:tabular-nums;}
    table.rn-on thead tr::before{content:"#";display:table-cell;box-sizing:border-box;min-width:38px;padding:8px 8px;text-align:center;font-weight:700;font-size:11px;position:sticky;top:0;z-index:6;background:var(--rn-bg,var(--gray-100));color:var(--rn-fg,var(--gray-700));border-bottom:1px solid var(--gray-300);}
    table.rn-on tbody tr.rn-skip::before{content:"";} table.rn-on thead tr.te-filters::before{content:"";background:var(--gray-50);top:34px;} #tblExpandOverlay .te-filters .mcombo{min-width:110px;} #tblExpandOverlay .te-filters .mc-input{font-size:12px;} #dtrkDetailModal,#attModal,#wMailModal,#expEmailModal,#dtrkEmailModal,#userFormModal{z-index:100003 !important;} #gdModal{z-index:100005 !important;}
    @media print{table.rn-on tbody tr::before{color:#555;}}`;
  document.head.appendChild(css);
  const SKIP = new Set(['inlineEditTable']);
  const eligible = t => !SKIP.has(t.id) && !t.classList.contains('map-table') && !t.classList.contains('no-rn') && !t.closest('#gdModal') && t.tHead && t.tHead.rows.length;
  function scanRn() {
    document.querySelectorAll('table').forEach(t => {
      if (!eligible(t)) return;
      const th = t.tHead.rows[0].cells[0];
      if (th) { const cs = getComputedStyle(th); if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') { t.style.setProperty('--rn-bg', cs.backgroundColor); t.style.setProperty('--rn-fg', cs.color); } }
      if (!t.classList.contains('rn-on')) t.classList.add('rn-on');
    });
  }
  let h = null; const sched = () => { clearTimeout(h); h = setTimeout(scanRn, 200); };
  new MutationObserver(sched).observe(document.body, { childList: true, subtree: true });
  scanRn();
})();

function w_initUomListPicker() {
  const host = document.querySelector('[data-list-picker="w-uom"]');
  if (!host || wUomState.picker) return;
  wUomState.picker = createListPicker(host, {
    getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), initialValue: wUomState.listName || '',
    onChange: wUom_onList,
  });
  try { const saved = localStorage.getItem(LS_BASE + '_wuom_list') || UOM_CONV_DEFAULT.list; if (saved) { wUomState.listName = saved; wUomState.source = 'list'; wUomState.picker.setValue(saved); wUom_loadFromList().catch(() => {}); } } catch (e) {}
}
$('wUomLoadBtn').addEventListener('click', () => wUom_loadFromList());

/* Request builder — converts every order row to Pcs when UOM conversion is active */
function wFefo_buildRequests() {
  const SKU_COL = wFefoState.fileMapping.sku, UOM_COL = wFefoState.fileMapping.uom, QTY_COL = wFefoState.fileMapping.qty;
  const conv = wUom_active();
  const newAcc = () => ({ qty: 0, origMap: new Map(), missing: [] });
  const addRow = (acc, r) => {
    const n = u_toNumber(r[QTY_COL]); if (n === null) return;
    if (!conv) { acc.qty += n; return; }
    const uom = String(r[UOM_COL] ?? '').trim() || '(blank)';
    acc.origMap.set(uom, (acc.origMap.get(uom) || 0) + n);
    const fac = wUom_factor(r[SKU_COL], r[UOM_COL]);
    if (fac == null) { const m = `${r[SKU_COL] ?? '(blank)'}/${uom} ${wUom_has(r[SKU_COL])}`; if (!acc.missing.includes(m) && acc.missing.length < 5) acc.missing.push(m); return; }
    acc.qty += n * fac;
  };
  const fin = acc => ({ qty: wUomRound(acc.qty), origDisplay: conv ? Array.from(acc.origMap).map(([u, q]) => `${u_formatNumber(q)} ${u}`).join(' + ') : '', convMissing: acc.missing });
  const requests = [];
  if (warehouseState.groupByFields.length) {
    for (const g of w_computeGroups()) {
      const first = g.rows[0], acc = newAcc();
      for (const r of g.rows) addRow(acc, r);
      const groupValues = {}; warehouseState.groupByFields.forEach(f => { groupValues[f.column] = first[f.column]; });
      requests.push({ groupKey: g.key, groupDisplay: g.displayKey, groupValues, sku: first[SKU_COL], uom: conv ? 'Pcs' : first[UOM_COL], sourceRowCount: g.count, ...fin(acc) });
    }
  } else {
    const map = new Map();
    for (const r of warehouseState.parsedRows) {
      const sku = r[SKU_COL], uom = r[UOM_COL];
      const key = String(sku || '').trim().toLowerCase();
      if (!map.has(key)) map.set(key, { sku, uom, acc: newAcc(), count: 0 });
      const b = map.get(key); addRow(b.acc, r); b.count++;
    }
    for (const [key, b] of map) {
      requests.push({ groupKey: key, groupDisplay: `${b.sku || '(empty)'}`, groupValues: {}, sku: b.sku, uom: conv ? 'Pcs' : b.uom, sourceRowCount: b.count, ...fin(b.acc) });
    }
  }
  return { requests };
}
/* Allocation wrapper: requests whose rows have no UOM factor are reported as NO UOM */
function wFefo_allocate(requests) {
  const noUom = [], ok = [];
  requests.forEach(r => (r.convMissing && r.convMissing.length && !r.qty) ? noUom.push(r) : ok.push(r));
  const core = wFefo_allocateCore(ok);
  core.results.forEach(r => { if (r.convMissing && r.convMissing.length) r.statusNote = (r.statusNote ? r.statusNote + ' · ' : '') + 'Skipped (no UOM factor): ' + r.convMissing.join(', '); });
  noUom.forEach(r => {
    core.results.push({ ...r, batchCode: '', locationCode: '', prodDate: null, expiryDate: null, qtyAllocated: 0, qtyRemaining: 0, status: 'NO UOM', statusKey: 'nobatch',
      statusNote: 'No UOM conversion factor for: ' + r.convMissing.join(', '), isFirstOfSplit: true, isSplit: false, splitIndex: 1, splitTotal: 1 });
    core.stats.nobatch++; core.stats.totalRows++;
  });
  return core;
}

/* ---------- Consolidated picking list ---------- */
function wPick_build(unit) {
  const src = wFefo_getVisibleResults().filter(r => r.batchCode && Number(r.qtyAllocated) > 0);
  const map = new Map(); let noFactor = 0;
  for (const r of src) {
    let pcs = Number(r.qtyAllocated);
    if (!wFefoState.resultsUomOn) { const fac = wUom_factor(r.sku, r.uom); if (fac == null) { noFactor++; continue; } pcs *= fac; }
    const key = [r.locationCode, r.sku, r.batchCode, r.expiryDate].map(v => String(v ?? '')).join('\u0001');
    let e = map.get(key);
    if (!e) { e = { loc: r.locationCode || '', sku: r.sku, desc: wUom_desc(r.sku), batch: r.batchCode, exp: r.expiryDate, pcs: 0, groups: new Set() }; map.set(key, e); }
    e.pcs += pcs; e.groups.add(r.groupKey);
  }
  const rows = Array.from(map.values()).sort((a, b) => String(a.loc).localeCompare(String(b.loc)) || String(a.sku).localeCompare(String(b.sku), undefined, { numeric: true }) || (new Date(a.exp) - new Date(b.exp)) || String(a.batch).localeCompare(String(b.batch)));
  rows.forEach(e => {
    const { carton, pallet, cartonUom } = wUom_units(e.sku); let rem = wUomRound(e.pcs); e.pcs = rem; e.pallets = 0; e.cartons = 0; e.note = [];
    e.cartonPcs = carton; e.palletPcs = pallet;
    if (unit === 'pallet') { if (pallet > 0) { e.pallets = Math.floor(rem / pallet + 1e-9); rem = wUomRound(rem - e.pallets * pallet); } else e.note.push('no pallet factor'); }
    if (carton > 0) { e.cartons = Math.floor(rem / carton + 1e-9); rem = wUomRound(rem - e.cartons * carton); if (cartonUom === 'ot') e.note.push('carton = OT'); } else e.note.push('no carton factor');
    e.loose = rem; e.groupCount = e.groups.size;
  });
  return { rows, noFactor };
}
function wPick_table(unit) {
  const { rows, noFactor } = wPick_build(unit), pal = unit === 'pallet';
  const fmtDate = d => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? String(d) : dt.toISOString().slice(0, 10); };
  const headers = ['Location_Code', 'SKU', 'Item_Description', 'Batch_Code', 'Expiry_Date', 'Total Pcs', ...(pal ? ['Pallets'] : []), 'Cartons', 'Loose Pcs', 'Pcs / Carton', ...(pal ? ['Pcs / Pallet'] : []), 'Order Groups', 'Note'];
  const data = rows.map(e => [e.loc, e.sku, e.desc || '', e.batch, fmtDate(e.exp), e.pcs, ...(pal ? [e.pallets] : []), e.cartons, e.loose, e.cartonPcs ?? '', ...(pal ? [e.palletPcs ?? ''] : []), e.groupCount, e.note.join(', ')]);
  const sum = i => data.reduce((t, r) => t + (Number(r[i]) || 0), 0);
  const totals = ['TOTAL', '', '', '', '', sum(5), ...(pal ? [sum(6)] : []), sum(pal ? 7 : 6), sum(pal ? 8 : 7), '', ...(pal ? [''] : []), '', ''];
  return { headers, data, totals, noFactor, rows };
}
function wPick_render() {
  if (!wUomState.table.size) { $('wPickInfo').textContent = '⚠ Load the UOM file first — Cartons / Pallets need the conversion factors.'; $('wPickHead').innerHTML = ''; $('wPickBody').innerHTML = ''; return; }
  const unit = $('wPickUnit').value, t = wPick_table(unit);
  const fmt = v => (typeof v === 'number') ? v.toLocaleString(undefined, { maximumFractionDigits: 6 }) : escapeHtml(String(v ?? ''));
  $('wPickHead').innerHTML = '<tr>' + t.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('') + '</tr>';
  let nearN = 0;
  $('wPickBody').innerHTML = t.data.map((r, ri) => { const xf = wExp_flag(t.rows[ri] && t.rows[ri].exp); if (xf) nearN++; return `<tr class="${xf ? 'exp-row-near' : ''}">${r.map((v, i) => { const xc = xf && (i === 1 || i === 4) ? (xf.expired ? 'exp-expired' : 'exp-near') : ''; const tag = xf && i === 4 ? `<span class="exp-tag ${xf.expired ? 'exp' : ''}">${xf.label}</span>` : ''; return `<td class="${typeof v === 'number' ? 'fefo-num' : ''} ${xc}">${fmt(v)}${tag}</td>`; }).join('')}</tr>`; }).join('') +
    (t.data.length ? `<tr style="font-weight:700;background:var(--gray-100);">${t.totals.map(v => `<td class="${typeof v === 'number' ? 'fefo-num' : ''}">${fmt(v)}</td>`).join('')}</tr>` : '');
  const scope = wFefo_getFilterSummary() ? ' (visible/filtered rows only)' : '';
  $('wPickInfo').textContent = `${t.data.length} picking line(s) consolidated by Location + SKU + Batch across all order groups${scope}.` + (nearN ? ` ⏳ ${nearN} line(s) expire within ${wExp_limit()} days (highlighted).` : '') + (t.noFactor ? ` ⚠ ${t.noFactor} allocation row(s) skipped: no UOM factor.` : '');
}
$('wFefoPickBtn').addEventListener('click', () => { if (!wFefoState.results.length) return; $('wPickCard').style.display = 'block'; wPick_render(); $('wPickCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$('wPickUnit').addEventListener('change', wPick_render);
$('wPickCloseBtn').addEventListener('click', () => { $('wPickCard').style.display = 'none'; });
/* ---------- Share FEFO list / Picking list by email ---------- */
const wMail = { src: 'fefo' };
function wMail_data() {
  if (wMail.src === 'loc') {
    const m = wLoc_model(); if (!m || !m.rows.length) throw new Error('Open Stock by Location first.');
    return { title: 'Stock Availability by Location (Pcs)', sheet: 'Stock by Location', headers: wLoc_head(m),
      rows: m.rows.map(r => wLoc_arr(m, r)), totalRow: false,
      note: (m.hasDemand ? 'Order demand vs stock' : 'All SKUs') + ' · ' + (wFefoState.locSel.length ? 'Locations: ' + wFefoState.locSel.join(', ') : 'All locations') };
  }
  if (wMail.src === 'ext') {
    const t = window.extMailData && window.extMailData(); if (!t || !t.rows.length) throw new Error('Nothing to email.');
    return { title: t.title, sheet: t.sheet || 'List', headers: t.headers, rows: t.rows, totalRow: false, note: t.note, html: t.html, xl: t.xl };
  }
  if (wMail.src === 'te') {
    const t = window.tableExpandData && window.tableExpandData(); if (!t || !t.rows.length) throw new Error('No rows are displayed in the expanded list.');
    return { title: t.title, sheet: 'List', headers: t.headers, rows: t.rows, totalRow: false, note: t.note };
  }
  if (wMail.src === 'grb') {
    const t = wGRB_table(); if (!t.data.length) throw new Error('The Good Return balance list is empty.');
    return { title: 'Good Return Balance', sheet: 'Good Return Balance', headers: t.headers, rows: t.data.concat([t.totals]), totalRow: true, note: t.note };
  }
  if (wMail.src === 'pick') {
    if (!wUomState.table.size) throw new Error('Load the UOM file first.');
    const t = wPick_table($('wPickUnit').value);
    if (!t.data.length) throw new Error('The picking list is empty.');
    return { title: 'Consolidated Picking List', sheet: 'Picking List', headers: t.headers, rows: t.data.concat([t.totals]), totalRow: true, note: $('wPickInfo').textContent };
  }
  if (!wFefoState.results.length) throw new Error('Run Lookup Batch (FEFO) first.');
  const d = wFefo_buildTableData(); if (!d.rows.length) throw new Error('No rows match the current filter.');
  const loc = wFefoState.locSel && wFefoState.locSel.length ? ' · Locations: ' + wFefoState.locSel.join(', ') : '';
  const f = wFefo_getFilterSummary();
  return { title: 'FEFO Batch Allocation', sheet: 'FEFO Allocation', headers: d.headers, rows: d.rows, totalRow: false, note: `${d.rows.length} row(s)` + (f ? ' · Filter: ' + f : '') + loc };
}
function wMail_html(d, maxRows) {
  if (d.html) return `<div style="font-family:Segoe UI,Arial,sans-serif;"><h3 style="margin:0 0 4px;">${escapeHtml(d.title)}</h3><div style="color:#64748b;font-size:12px;margin-bottom:8px;">${escapeHtml(d.note)} · ${new Date().toLocaleString()}</div>${d.html}</div>`;
  const th = 'border:1px solid #cbd5e1;padding:4px 8px;background:#f1f5f9;text-align:left;font-size:12px;', td = 'border:1px solid #e2e8f0;padding:4px 8px;font-size:12px;';
  const fmt = v => typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 6 }) : escapeHtml(String(v ?? ''));
  const body = d.rows.slice(0, maxRows), cut = d.rows.length - body.length;
  return `<div style="font-family:Segoe UI,Arial,sans-serif;"><h3 style="margin:0 0 4px;">${escapeHtml(d.title)}</h3><div style="color:#64748b;font-size:12px;margin-bottom:8px;">${escapeHtml(d.note)} · ${new Date().toLocaleString()}</div>` +
    `<table style="border-collapse:collapse;"><tr>${d.headers.map(h => `<th style="${th}">${escapeHtml(h)}</th>`).join('')}</tr>` +
    body.map((r, i) => `<tr${d.totalRow && i === d.rows.length - 1 ? ' style="font-weight:700;background:#f8fafc;"' : ''}>${r.map(v => `<td style="${td}${typeof v === 'number' ? 'text-align:right;' : ''}">${fmt(v)}</td>`).join('')}</tr>`).join('') + '</table>' +
    (cut > 0 ? `<div style="color:#b45309;font-size:12px;margin-top:6px;">… ${cut} more row(s) not shown in the email body${$('wMailAttach').checked ? ' — see the attached Excel file.' : '.'}</div>` : '') + '</div>';
}
function wMail_set(m, t) { const el = $('wMailStatus'); el.className = 'status-msg ' + t; el.textContent = m; }
function wMail_open(src) {
  if (featBlock('email')) return;
  wMail.src = src;
  let m = document.querySelector('#wMailModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'wMailModal';
    m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100030;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = `<div class="card" style="max-width:640px;width:100%;max-height:92vh;overflow:auto;margin:0;">
      <div class="card-header"><div class="card-title" id="wMailTitle">📧 Share by email</div><button id="wMailClose" class="ghost small" type="button">✖ Close</button></div>
      <div class="form-grid">
        <div class="form-group"><label>To <span class="hint">— comma separated</span></label><input type="text" id="wMailTo" placeholder="name@company.com, name2@company.com" /></div>
        <div class="form-group"><label>Cc</label><input type="text" id="wMailCc" /></div>
        <div class="form-group"><label>Subject</label><input type="text" id="wMailSubject" /></div>
        <div class="form-group"><label>Message <span class="hint">— optional, shown above the table</span></label><textarea id="wMailMsg" rows="2"></textarea></div>
        <div class="form-group"><label>Rows shown in the email body</label><select id="wMailRows"><option value="100">First 100</option><option value="300" selected>First 300</option><option value="1000">First 1,000</option></select></div>
        <div class="form-group"><label style="display:inline-flex;align-items:center;gap:6px;"><input type="checkbox" id="wMailAttach" checked /> Attach the full list as Excel</label></div>
      </div>
      <div class="text-sm" style="color:var(--gray-500);margin:6px 0;">Uses exactly what is displayed (current filters and location selection). The browser cannot send mail by itself: you get an Outlook draft (.eml) with the table and Excel file ready to review and Send. Or copy the table and paste it into a new email.</div>
      <div id="wMailStatus" class="status-msg"></div>
      <div class="btn-row" style="margin-top:10px;"><button id="wMailSend" class="success" type="button">🚀 Send now</button><button id="wMailDraft" class="secondary" type="button">📨 Create Outlook draft (.eml)</button><button id="wMailCopy" class="ghost small" type="button">📋 Copy table</button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m || e.target.id === 'wMailClose') m.style.display = 'none'; });
    const bundle = () => { const d = wMail_data(), html = wMail_html(d, Number($('wMailRows').value) || 300), msg = $('wMailMsg').value.trim(); return { d, html: msg ? `<p style="font-family:Segoe UI,Arial,sans-serif;white-space:pre-wrap;">${escapeHtml(msg)}</p>` + html : html }; };
    $('wMailDraft').addEventListener('click', async () => {
      try {
        const to = $('wMailTo').value.trim(); if (!to) { wMail_set('⚠ Enter at least one recipient in "To".', 'warn'); return; }
        const { d, html } = bundle(); const subject = $('wMailSubject').value.trim() || d.title; let attachment = null;
        const stamp = new Date().toISOString().slice(0, 10), base = d.title.replace(/\W+/g, '_');
        if ($('wMailAttach').checked) { if (d.xl) { wMail_set('Building the Excel file…', 'info'); attachment = { format: 'xlsx', fileName: `${base}_${stamp}.xlsx`, dataB64: await d.xl() }; } else { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.headers, ...d.rows]), d.sheet); attachment = { format: 'xlsx', fileName: `${base}_${stamp}.xlsx`, dataB64: await roXlB64(wb, `${base}_${stamp}.xlsx`) }; } }
        const eml = expEmail_buildEml(html, subject, to, $('wMailCc').value.trim(), attachment);
        const url = URL.createObjectURL(new Blob([eml], { type: 'message/rfc822' })), name = `${base}_${stamp}.eml`;
        const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 5000);
        wMail_set(`✅ Draft ${name} downloaded${attachment ? ' with ' + attachment.fileName + ' attached' : ''}. Double-click it to open in Outlook, review and Send.`, 'success');
        addActivity('email', `${d.title} email draft (${d.rows.length} rows)`);
      } catch (e) { wMail_set('✘ ' + e.message, 'error'); }
    });
    $('wMailSend').addEventListener('click', async () => {
      const btn = $('wMailSend'); if (btn.disabled) return;
      try {
        const to = $('wMailTo').value.trim(); if (!to) { wMail_set('⚠ Enter at least one recipient in "To".', 'warn'); return; }
        const { d, html } = bundle(); const subject = $('wMailSubject').value.trim() || d.title; let attachment = null;
        const stamp = new Date().toISOString().slice(0, 10), base = d.title.replace(/\W+/g, '_');
        if ($('wMailAttach').checked) { if (d.xl) { wMail_set('Building the Excel file…', 'info'); attachment = { fileName: `${base}_${stamp}.xlsx`, dataB64: await d.xl() }; } else { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.headers, ...d.rows]), d.sheet); attachment = { fileName: `${base}_${stamp}.xlsx`, dataB64: await roXlB64(wb, `${base}_${stamp}.xlsx`) }; } }
        btn.disabled = true; wMail_set('Sending…', 'info');
        const how = await mailSend_send({ to, cc: $('wMailCc').value.trim(), subject, html, attachment });
        wMail_set(`✅ ${d.title}: ${how}.`, 'success'); addActivity('email', `${d.title} e-mail sent to ${to} (${d.rows.length} rows)`);
        try { localStorage.setItem(LS_BASE + '_wmail_to', to); localStorage.setItem(LS_BASE + '_wmail_cc', $('wMailCc').value.trim()); } catch (e) {}
      } catch (e) { wMail_set('✘ ' + e.message, 'error'); } finally { btn.disabled = false; }
    });
    $('wMailCopy').addEventListener('click', async () => {
      try {
        const { html } = bundle(), plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (navigator.clipboard && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]); else await navigator.clipboard.writeText(plain);
        wMail_set('✅ Copied. In Outlook choose New Email and paste (Ctrl+V).', 'success');
      } catch (e) { wMail_set('✘ ' + e.message, 'error'); }
    });
  }
  $('wMailSend').textContent = mailSend_label(); $('wMailTo').value = ''; $('wMailCc').value = '';
  try { $('wMailTo').value = localStorage.getItem(LS_BASE + '_wmail_to') || ''; $('wMailCc').value = localStorage.getItem(LS_BASE + '_wmail_cc') || ''; } catch (e) {}
  applyEmailDefaults($('wMailTo'), $('wMailCc'), true);
  let title = src === 'pick' ? 'Consolidated Picking List' : src === 'loc' ? 'Stock Availability by Location' : src === 'grb' ? 'Good Return Balance' : 'FEFO Batch Allocation';
  if (src === 'te' || src === 'ext') { try { title = wMail_data().title; } catch (e) { title = 'List'; } }
  $('wMailTitle').textContent = '📧 Share ' + title + ' by email';
  $('wMailSubject').value = `${title} — ${new Date().toISOString().slice(0, 10)}`;
  wMail_set('', 'info'); m.style.display = 'flex';
}
$('wFefoEmailBtn').addEventListener('click', () => { if (!wFefoState.results.length) { wFefo_setStatus('Run Lookup Batch (FEFO) first, then share the list.', 'warn'); return; } wMail_open('fefo'); });
$('wPickEmailBtn').addEventListener('click', () => wMail_open('pick'));
$('wLocEmailBtn').addEventListener('click', () => wMail_open('loc'));
function wPick_stamp() { return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); }
function w_printTable(title, meta, headers, rows, totals, prefix) {
  if (featBlock('print')) return;
  const pf = prefix || (/picking/i.test(title) ? 'PL' : /deliver/i.test(title) ? 'DN' : 'RPT'), no = npDocNo(pf);
  npOpenPrint(npTableDoc({ title, sub: meta, no, prefix: pf, headers, rows, totals: totals || null }), title + ' ' + no);
  try { addActivity('export', `Printed ${title} (${no})`); } catch (e) {}
  return no;
}
$('wPickExcelBtn').addEventListener('click', () => {
  if (!wUomState.table.size) return;
  const t = wPick_table($('wPickUnit').value); if (!t.data.length) return;
  const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.data.map(r => r.map(xlCell)), t.totals]);
  ws['!cols'] = t.headers.map(h => ({ wch: h === 'Item_Description' ? 38 : Math.max(12, Math.min(28, String(h).length + 4)) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Picking List');
  XLSX.writeFile(wb, `Picking_List_${$('wPickUnit').value}s_${wPick_stamp()}.xlsx`);
  wFefo_setStatus(`✅ Picking list exported (${t.data.length} lines).`, 'success'); w_logToActivity(`Picking list Excel: ${t.data.length} lines`);
});
$('wPickCsvBtn').addEventListener('click', () => {
  if (!wUomState.table.size) return;
  const t = wPick_table($('wPickUnit').value); if (!t.data.length) return;
  const esc = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(['\ufeff' + [t.headers, ...t.data, t.totals].map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Picking_List_${$('wPickUnit').value}s_${wPick_stamp()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
});
function wPick_doc(unit, t, no) { return npTableDoc({ title: 'Consolidated Picking List', no, prefix: 'PL', sub: `${unit === 'pallet' ? 'Pallets' : 'Cartons'} · batch list ${wFefoState.batchListName || '—'}`, headers: t.headers, rows: t.data, totals: t.totals, tick: 'Picked', landscape: plPfLoad('wpick').orient === 'landscape', sigs: ['Picked by', 'Checked by', 'Loaded by'], meta: [['Batch list', wFefoState.batchListName || '—'], ['Unit', unit === 'pallet' ? 'Pallets' : 'Cartons'], ['Lines', t.data.length]] }); }
$('wPickPrintBtn').addEventListener('click', () => {
  if (!wUomState.table.size) return;
  const unit = $('wPickUnit').value, t = wPick_table(unit); if (!t.data.length) return;
  const no = npDocNo('PL'); wFefoState.docNo = no;
  npOpenPrint(plPfApply(wPick_doc(unit, t, no), 'wpick'), 'Picking list ' + no);
  wFefo_setStatus(`🖨 Picking list ${no} opened in a new tab — the number is uploaded with the FEFO rows (map “Document_No” when uploading).`, 'success'); w_logToActivity(`Picking list ${no}`);
});

