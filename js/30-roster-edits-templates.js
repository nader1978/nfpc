/* ---------- local edits of SharePoint data → sync queue (nothing is written to SharePoint until the user decides) ---------- */
const RO_DAYFULL = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const roQPend = () => ro.queue.filter(e => e.st === 'pending');
function roQCol(key) { const m = (utGet('roster-staff') || {}).map || {}; return m[key] && m[key] !== SKIP_VALUE ? m[key] : ''; }
const roQHasSp = p => !!(p && p.sp && Object.keys(p.sp).length);
function roQRaw(key, val, oldRaw) {   // the roster value written back in the style the SharePoint column already uses
  const o = String(oldRaw == null ? '' : oldRaw).trim();
  if (key === 'active') { const t = o.toLowerCase(); return /^(true|false)$/.test(t) ? (val ? 'true' : 'false') : /^(y|n)$/.test(t) ? (val ? 'Y' : 'N') : /^(1|0)$/.test(t) ? (val ? '1' : '0') : (val ? 'Yes' : 'No'); }
  if (key === 'defShift') return val ? (/shift/i.test(o) && !/shift/i.test(val) ? val + ' Shift' : val) : '';
  if (key === 'offDay') return val ? (o.length > 3 ? RO_DAYFULL[val] || val : val) : '';
  return String(val == null ? '' : val);
}
function roQSet(p, col, key, val) {   // put a value on the local staff record (used by edits, revert and after a re-retrieve)
  p.sp = p.sp || {}; p.sp[col] = val; if (!key) return;
  if (key === 'name') p.name = val; else if (key === 'role') p.role = val; else if (key === 'area') p.area = val; else if (key === 'defShift') p.defShift = roSpShift(val); else if (key === 'offDay') p.offDay = roSpOff(val); else if (key === 'active') p.active = roSpAct(val);
  else if (RO_DET.includes(key)) { p.det = p.det || {}; const v = key === 'joinDate' ? roSpDate(val) : val; if (v) p.det[key] = v; else delete p.det[key]; }
}
function roQRec(p, col, key, label, oldRaw, newRaw) {
  const i = ro.queue.findIndex(x => x.st === 'pending' && x.fileNr === p.id && x.col === col), e = ro.queue[i];
  if (e) { if (newRaw === e.old) { ro.queue.splice(i, 1); return; } e.new = newRaw; e.at = Date.now(); e.msg = ''; e.name = p.name; e.by = getCurrentUserValue(); return; }
  if (newRaw === oldRaw) return;
  ro.queue.push({ id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fileNr: p.id, name: p.name, col, key: key || '', label, old: oldRaw, new: newRaw, at: Date.now(), by: getCurrentUserValue(), st: 'pending', msg: '' });
}
function roQAfterRetrieve() {   // a fresh retrieve: the SharePoint value becomes the new baseline, pending local changes stay on top
  roQPend().forEach(e => { const r = roSp.rows.find(x => x.fileNr === e.fileNr), p = ro.staff.find(x => x.id === e.fileNr); if (!r || !p) return; const v = (r.sp || {})[e.col]; const cur = v == null ? '' : v;
    if (cur === e.new) { ro.queue.splice(ro.queue.indexOf(e), 1); return; } e.old = cur; roQSet(p, e.col, e.key, e.new); });
}
function roQTyped(col, cols, val) {
  const c = cols.find(x => x.name === col); if (!c) return val; if (c.readOnly) throw new Error(`“${c.displayName}” is a ${c.type} column that cannot be written from here`);
  if (c.type === 'boolean') return /^(yes|true|1|y)$/i.test(val); if (c.type === 'number') { const n = Number(String(val).replace(/,/g, '')); if (val !== '' && isNaN(n)) throw new Error(`“${c.displayName}” needs a number`); return val === '' ? null : n; }
  if (c.type === 'date') return val ? (/^\d{4}-\d\d-\d\d$/.test(val) ? val + 'T00:00:00Z' : val) : null; return val;
}
async function roQApply(ids) {
  const st = PLQ('#roQStatus'), sel = roQPend().filter(e => ids.includes(e.id)); if (!sel.length) { st.textContent = 'Select at least one waiting change.'; return; }
  const cfg = utGet('roster-staff'), token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!utReady('roster-staff') || !token || !site) { st.textContent = '⚠ Sign in and make sure the staff list is defined (Upload Destinations & Sources).'; return; }
  const btn = PLQ('#roQApply'); btn.disabled = true;
  try {
    st.textContent = 'Connecting to SharePoint…'; const a = await resolveIds(site, cfg.list, token), cols = await fetchColumnsDetailed(a.siteId, a.listId, token).catch(() => []); let ok = 0, bad = 0, skip = 0, all = null;
    const by = {}; sel.forEach(e => { (by[e.fileNr] = by[e.fileNr] || []).push(e); });
    for (const fn of Object.keys(by)) {
      const p = ro.staff.find(x => x.id === fn), list = by[fn]; let itemId = p && p.spId;
      try {
        if (!itemId) { st.textContent = 'Locating the SharePoint rows…'; if (!all) all = await fetchAllItems(a.siteId, a.listId, token); const fc = (cfg.map.fileNr || ''); const it = all.find(x => roSpVal((x.fields || {})[fc]) === fn); if (!it) throw new Error('Row not found in the SharePoint list'); itemId = it.id; if (p) p.spId = itemId; }
        st.textContent = `Checking ${p ? p.name : fn} in SharePoint…`; const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${a.siteId}/lists/${a.listId}/items/${itemId}?expand=fields`, { headers: { Authorization: `Bearer ${token}` } }, 'read item'); if (!r.ok) throw new Error('Could not read the SharePoint row (' + r.status + ')'); const live = (await r.json()).fields || {};
        const fields = {}, use = [];
        for (const e of list) { let cur = roSpVal(live[e.col]); if (/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(cur)) cur = roSpDate(cur);
          if (cur !== e.new && cur !== e.old && !confirm(`${p ? p.name : fn} · ${e.label}\n\nSharePoint now holds “${cur || '(empty)'}” — it changed since you retrieved it (“${e.old || '(empty)'}”).\n\nOverwrite it with “${e.new || '(empty)'}”?`)) { skip++; e.msg = 'Skipped — SharePoint value changed (' + (cur || 'empty') + ')'; continue; }
          fields[e.col] = roQTyped(e.col, cols, e.new); use.push(e); }
        if (use.length) { await updateItem(a.siteId, a.listId, itemId, fields, token); use.forEach(e => { e.st = 'applied'; e.done = Date.now(); e.msg = ''; ok++; if (p && p.sp) p.sp[e.col] = e.new; }); }
      } catch (err) { list.forEach(e => { if (e.st === 'pending' && !e.msg.startsWith('Skipped')) { e.msg = '✘ ' + err.message; bad++; } }); }
    }
    roSave(); st.textContent = `✓ ${ok} applied to SharePoint` + (skip ? `, ${skip} skipped` : '') + (bad ? `, ${bad} failed (see the Status column)` : '') + '.';
    if (ok) { addActivity('edit', `Staff roster: ${ok} change(s) written to SharePoint from the sync queue`); sectionToast(`${ok} change(s) written to SharePoint.`, 'success'); }
  } catch (err) { st.textContent = '✘ ' + err.message; } finally { btn.disabled = false; roRender(); }
}
function roQDecide(ids, how) {
  const sel = roQPend().filter(e => ids.includes(e.id)); if (!sel.length) { PLQ('#roQStatus').textContent = 'Select at least one waiting change.'; return; }
  sel.forEach(e => { if (how === 'revert') { const p = ro.staff.find(x => x.id === e.fileNr); if (p) roQSet(p, e.col, e.key, e.old); e.st = 'reverted'; } else e.st = 'local'; e.done = Date.now(); e.msg = ''; });
  const done = ro.queue.filter(e => e.st !== 'pending'); if (done.length > 300) done.slice(0, done.length - 300).forEach(e => ro.queue.splice(ro.queue.indexOf(e), 1));
  roSave(); roRender(); PLQ('#roQStatus').textContent = how === 'revert' ? `↩ ${sel.length} reverted to the SharePoint value.` : `📌 ${sel.length} kept local only (not sent to SharePoint).`; addActivity('edit', `Staff roster sync queue: ${sel.length} ${how === 'revert' ? 'reverted' : 'kept local'}`);
}
function roQRows() { const f = PLQ('#roQFilter').value, t = (PLQ('#roQSearch').value || '').toLowerCase().trim(); return ro.queue.filter(e => (f === 'all' || e.st === f) && (!t || [e.name, e.fileNr, e.label, e.col, e.old, e.new, e.by].join(' | ').toLowerCase().includes(t))).sort((a, b) => b.at - a.at); }
function roQRender() {
  const rows = roQRows(), n = roQPend().length, pill = { pending: 'Custom', applied: 'Day', local: 'Off', reverted: 'Off' }, lab = { pending: 'Waiting', applied: 'Applied', local: 'Local only', reverted: 'Reverted' };
  PLQ('#roQInfo').textContent = `${n} waiting for a decision · ${ro.queue.length - n} decided`; PLQ('#roQAll').checked = false;
  PLQ('#roQBody').innerHTML = rows.map(e => `<tr><td>${e.st === 'pending' ? `<input type="checkbox" data-qs="${e.id}" style="width:auto;margin:0">` : ''}</td><td><strong>${plEsc(e.name)}</strong><div class="text-sm" style="color:var(--gray-500)">${plEsc(e.fileNr)}</div></td><td>${plEsc(e.label)}<div class="text-sm" style="color:var(--gray-400)">${plEsc(e.col)}</div></td><td>${e.old === '' ? '<span style="color:var(--gray-400)">(empty)</span>' : plEsc(e.old)}</td><td class="ro-qnew">${e.new === '' ? '<span style="color:var(--gray-400)">(empty)</span>' : plEsc(e.new)}</td><td class="text-sm">${new Date(e.at).toLocaleString()}<div style="color:var(--gray-500)">${plEsc(e.by || '')}</div></td><td><span class="ro-pill ${pill[e.st]}">${lab[e.st]}</span>${e.done ? `<div class="text-sm" style="color:var(--gray-500)">${new Date(e.done).toLocaleString()}</div>` : ''}${e.msg ? `<div class="text-sm" style="color:#b42318">${plEsc(e.msg)}</div>` : ''}</td><td style="white-space:nowrap">${e.st === 'pending' ? `<button class="success small" type="button" data-qa="apply" data-id="${e.id}">⬆ Apply</button> <button class="ghost small" type="button" data-qa="revert" data-id="${e.id}">↩ Revert</button> <button class="ghost small" type="button" data-qa="local" data-id="${e.id}">📌 Local</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="8" style="padding:14px;text-align:center;color:var(--gray-400);font-style:italic">${PLQ('#roQFilter').value === 'pending' ? 'No changes are waiting. Edit a person (double-click on the Staff & slots tab) and the change appears here.' : 'Nothing to show.'}</td></tr>`;
}
function roQWire(q) {
  q('#roQFilter').addEventListener('change', roQRender); q('#roQSearch').addEventListener('input', roQRender);
  q('#roQAll').addEventListener('change', e => q('#roQBody').querySelectorAll('input[data-qs]').forEach(c => { c.checked = e.target.checked; }));
  const sel = () => [...q('#roQBody').querySelectorAll('input[data-qs]:checked')].map(c => c.dataset.qs);
  q('#roQApply').addEventListener('click', () => roQApply(sel())); q('#roQRevert').addEventListener('click', () => roQDecide(sel(), 'revert')); q('#roQLocal').addEventListener('click', () => roQDecide(sel(), 'local'));
  q('#roQClear').addEventListener('click', () => { if (!confirm('Remove the decided entries (applied / reverted / local only) from the list?')) return; ro.queue = roQPend(); roSave(); roRender(); });
  q('#roQBody').addEventListener('click', e => { const b = e.target.closest('button[data-qa]'); if (!b) return; if (b.dataset.qa === 'apply') roQApply([b.dataset.id]); else roQDecide([b.dataset.id], b.dataset.qa); });
}

/* ---------- person editor (shift · custom hours · working area · defaults) ---------- */
const roWeekDays = date => Array.from({ length: 7 }, (_, i) => roAdd(roMonday(date), i));
function roApplyRange(date, id, from, to) {
  const a = ro.slots.findIndex(s => s.from === from), b = (() => { let r = -1; ro.slots.forEach((s, i) => { if (s.to === to) r = i; }); return r; })();
  if (a < 0 || b < 0 || b < a) throw new Error('The “to” time must be after the “from” time.'); roSetSlots(date, id, ro.slots.slice(a, b + 1).map(roK)); if (ro.status[date]) delete ro.status[date][id];
}
function roDefApply(date, p) {
  const dow = roDow(date); if (p.offDay && p.offDay === dow) return roApply(date, p.id, 'Off'); if (p.defShift) return roApply(date, p.id, p.defShift);
}
function roPM(id, date) {
  const p = ro.staff.find(s => s.id === id); if (!p) return; roPMClose(); const cur = roPerson(date, id), areaNow = roAreaOf(date, id);
  const ov = document.createElement('div'); ov.className = 'ro-ov'; ov.id = 'roPM'; ov.addEventListener('dblclick', e => e.stopPropagation());
  const slotOpts = (k, sel) => ro.slots.map(s => `<option value="${s[k]}" ${s[k] === sel ? 'selected' : ''}>${s[k]} · ${roShort(s.shift)}</option>`).join('');
  ov.innerHTML = `<div class="ro-dlg" role="dialog"><div class="ro-dh"><div><strong>${plEsc(p.name)}</strong><div class="text-sm" style="color:var(--gray-600)">${plEsc(p.id)} · ${plEsc(p.role)}</div>${p.det && Object.keys(p.det).length ? `<div class="text-sm" style="color:var(--gray-500);margin-top:2px;">${plEsc(Object.values(p.det).join(' · '))}</div>` : ''}</div><button type="button" class="ghost small" data-x="1">✖</button></div>
  <div class="ro-db">
   <div class="ro-card"><div class="form-grid" style="grid-template-columns:1fr 1fr;"><div class="form-group"><label>Staff name</label><input type="text" id="roPMname" value="${plEsc(p.name)}"></div><div class="form-group"><label>Job role</label><input type="text" id="roPMrole" list="roRoleList" value="${plEsc(p.role)}"></div></div>
    <label class="text-sm" style="display:flex;gap:6px;align-items:center;margin:2px 0 6px;"><input type="checkbox" id="roPMactive" style="width:auto" ${p.active !== false ? 'checked' : ''}> Active in the roster</label>
    ${(() => { const TOP = ['name', 'role', 'area', 'defShift', 'offDay', 'active', 'fileNr'], pend = new Set(roQPend().filter(e => e.fileNr === p.id).map(e => e.col));
      if (!ro.spCols.length || !roQHasSp(p)) { const rows = Object.entries(p.det || {}); return rows.length ? `<details open class="fd-set"><summary>Details</summary><div class="ro-kv">${rows.map(([l, v]) => `<div class="ro-k">${plEsc(l)}</div><div class="ro-v">${plEsc(v)}</div>`).join('')}</div></details>` : '<div class="text-sm" style="color:var(--gray-500)">No SharePoint details yet — retrieve them in tab 5.</div>'; }
      const sh = ro.spCols.filter(c => (p.sp || {})[c.k] != null && String((p.sp || {})[c.k]).trim() !== '').length;
      return `<details open class="fd-set"><summary>All details from SharePoint (${sh} of ${ro.spCols.length} filled) — edit here; changes go to the 🔄 Sync queue, not to SharePoint</summary>${pend.size ? `<div class="text-sm ro-pend" style="margin-top:4px">● ${pend.size} change(s) of this person are waiting in the Sync queue</div>` : ''}<div class="ro-kv">${ro.spCols.map(c => { const v = (p.sp || {})[c.k], ro_ = TOP.includes(c.mapped); return `<div class="ro-k">${plEsc(c.label)}${pend.has(c.k) ? ' <span class="ro-pend" title="Waiting in the Sync queue">●</span>' : ''}</div><div class="ro-v">${ro_ ? `${v == null || String(v).trim() === '' ? '<span style="color:var(--gray-400)">—</span>' : plEsc(v)} <span class="text-sm" style="color:var(--gray-400)">${c.mapped === 'fileNr' ? '(key)' : '(edit above)'}</span>` : `<input type="text" data-spk="${plEsc(c.k)}" data-mk="${plEsc(c.mapped || '')}" value="${plEsc(v == null ? '' : v)}">`}</div>`; }).join('')}</div></details>`; })()}</div>
   <div class="form-group"><label>Date</label><div class="text-sm"><strong>${roDow(date)} ${date}</strong> — now: <span class="ro-pill ${cur.pill}">${cur.pill}</span> ${cur.n ? plEsc(cur.from + '–' + cur.to) : ''}</div></div>
   <div class="form-group"><label>Shift</label><div class="ro-sh-btns">${roShiftNames().map(n => [roShort(n), roShiftIcon(n) + ' ' + roShort(n) + ' shift']).concat([['Off', '⏸ Off'], ['Leave', '🌴 Leave'], ['Custom', '✏ Custom hours']]).map(([k, l]) => `<button type="button" data-pt="${k}" class="${cur.pill === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
   <div class="form-grid" style="grid-template-columns:1fr 1fr;" id="roPMcust"><div class="form-group"><label>From</label><select id="roPMfrom">${slotOpts('from', cur.n ? cur.from : '')}</select></div><div class="form-group"><label>To</label><select id="roPMto">${slotOpts('to', cur.n ? cur.to : '')}</select></div></div>
   <div class="form-group"><label>Apply the shift to</label><select id="roPMscope"><option value="day">This day only (${date})</option><option value="week">Every day of this week</option><option value="rest">The rest of this week (from ${date})</option></select></div>
   <div class="form-group"><label>Working area</label><input type="text" id="roPMarea" list="roAreaList" value="${plEsc(areaNow)}" placeholder="e.g. Zone A / Dock 3 / Cold room"><select id="roPMascope" style="margin-top:4px;"><option value="day">For this day only</option><option value="week">For every day of this week</option><option value="def">Default for this person (all days)</option></select></div>
   <div class="form-grid" style="grid-template-columns:1fr 1fr;"><div class="form-group"><label>Default shift</label><select id="roPMdef">${['', ...roShiftNames().map(roShort), 'Off'].map(o => `<option value="${o}" ${(p.defShift || '') === o ? 'selected' : ''}>${o || '— none —'}</option>`).join('')}</select></div><div class="form-group"><label>Weekly off day</label><select id="roPMoff">${['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(o => `<option value="${o}" ${(p.offDay || '') === o ? 'selected' : ''}>${o || '— none —'}</option>`).join('')}</select></div></div>
   <div class="form-group"><label>☕ Break slots <span class="hint">several allowed · empty = ${roBrkNorm(ro.brk).length ? 'default ' + plEsc(roBrkNorm(ro.brk).map(b => b.from + '–' + b.to).join(', ')) : 'no break'}</span></label><div id="roPMbHost"></div></div>
   <div id="roPMmsg" class="text-sm" style="color:#b42318;min-height:16px;"></div>
  </div><div class="ro-df"><button type="button" class="ghost small" data-x="1">Cancel</button><button type="button" class="success" id="roPMsave">💾 Save</button></div></div>`;
  document.body.appendChild(ov); const pmB = roBrkNorm(p.brk).map(b => ({ from: b.from, to: b.to })); roBrkEditor(ov.querySelector('#roPMbHost'), pmB, () => {}, { tools: true, self: id }); let pick = cur.pill; const cust = ov.querySelector('#roPMcust'), showC = () => { cust.style.display = pick === 'Custom' ? '' : 'none'; }; showC();
  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('[data-x]')) return roPMClose();
    const b = e.target.closest('[data-pt]'); if (b) { pick = b.dataset.pt; ov.querySelectorAll('[data-pt]').forEach(x => x.classList.toggle('on', x === b)); showC(); return; }
    if (!e.target.closest('#roPMsave')) return;
    try {
      const area = ov.querySelector('#roPMarea').value.trim(), as = ov.querySelector('#roPMascope').value, sc = ov.querySelector('#roPMscope').value, wk = roWeekDays(date);
      const days = sc === 'day' ? [date] : sc === 'week' ? wk : wk.filter(d => d >= date), changed = pick !== cur.pill || sc !== 'day' || pick === 'Custom';
      if (changed) days.forEach(d => { if (pick === 'Custom') roApplyRange(d, id, ov.querySelector('#roPMfrom').value, ov.querySelector('#roPMto').value); else roApply(d, id, pick); });
      const before = { name: p.name, role: p.role || '', active: p.active !== false, defShift: p.defShift || '', offDay: p.offDay || '', area: p.area || '' }, qOld = Object.assign({}, p.sp || {});
      p.name = ov.querySelector('#roPMname').value.trim() || p.name; p.role = ov.querySelector('#roPMrole').value.trim(); p.active = ov.querySelector('#roPMactive').checked; p.defShift = ov.querySelector('#roPMdef').value; p.offDay = ov.querySelector('#roPMoff').value;
      if (roQHasSp(p)) {   // record every change of SharePoint-sourced data in the sync queue
        const lab = k => { const c = ro.spCols.find(x => x.k === roQCol(k)); return c ? c.label : k; }, top = { name: p.name, role: p.role || '', active: p.active !== false, defShift: p.defShift || '', offDay: p.offDay || '' }; if (as === 'def') top.area = area;
        Object.keys(top).forEach(k => { if (top[k] === before[k]) return; const col = roQCol(k); if (!col) return; const oldRaw = qOld[col] == null ? '' : qOld[col], nr = roQRaw(k, top[k], oldRaw); roQRec(p, col, k, lab(k), oldRaw, nr); p.sp[col] = nr; });
        ov.querySelectorAll('input[data-spk]').forEach(inp => { const col = inp.dataset.spk, oldRaw = qOld[col] == null ? '' : qOld[col], nv = inp.value.trim(); if (nv === String(oldRaw).trim()) return; const c = ro.spCols.find(x => x.k === col); roQRec(p, col, inp.dataset.mk, c ? c.label : col, oldRaw, nv); roQSet(p, col, inp.dataset.mk, nv); });
      }
      { const c = roBrkCheck(pmB); if (c.err) throw new Error(c.err); if (c.list.length) p.brk = c.list; else delete p.brk; }
      if (as === 'def') { p.area = area; Object.values(ro.area).forEach(m => delete m[id]); } else { const ds = as === 'day' ? [date] : wk; ds.forEach(d => { ro.area[d] = ro.area[d] || {}; if (area && area !== (p.area || '')) ro.area[d][id] = area; else delete ro.area[d][id]; }); }
      roSave(); roPMClose(); roRender(); sectionToast(`${p.name} updated.`, 'success'); addActivity('edit', `Roster: ${p.name} ${date} → ${pick}${area ? ' @ ' + area : ''}`);
    } catch (err) { const m = ov.querySelector('#roPMmsg'); if (m) m.textContent = '⚠ ' + err.message; }
  });
}
function roPMClose() { document.querySelectorAll('#roPM').forEach(x => x.remove()); }

/* ---------- wiring ---------- */
let roInited = false;
function roInit() {
  if (roInited) return; roInited = true; roLoad(); const q = PLQ; if (!ro.date) ro.date = roIsoLocal(new Date()); ro.week = roMonday(ro.date);
  const dz = q('#roDrop'), inp = q('#roFile'); dz.addEventListener('click', () => inp.click()); dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
  ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); })); ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) roImport(f); }); inp.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) roImport(f); });
  roTplWire(q); roSmartWire(q); roQWire(q);
  q('#roTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; ro.tab = b.dataset.t; roRender(); });
  q('#roAdd').addEventListener('click', () => { const id = q('#roNewId').value.trim(), name = q('#roNewName').value.trim(), role = q('#roNewRole').value.trim(), area = q('#roNewArea').value.trim(); if (!id || !name) { sectionToast('File Nr and name are required.', 'warn'); return; } if (ro.staff.some(s => s.id === id)) { sectionToast('That File Nr already exists.', 'warn'); return; } ro.staff.push({ id, name, role, area, active: true }); ['#roNewId', '#roNewName', '#roNewRole', '#roNewArea'].forEach(s => q(s).value = ''); roSave(); roRender(); });
  q('#roStaffBody').addEventListener('dblclick', e => { if (e.target.closest('button')) return; const tr = e.target.closest('tr[data-i]'); if (!tr) return; e.stopPropagation(); const s = ro.staff[+tr.dataset.i]; if (s) { try { roPM(s.id, ro.date); } catch (err) { sectionToast('Could not open the staff card: ' + err.message, 'warn'); } } });
  const pop = q('#roColsPop'); q('#roColsBtn').addEventListener('click', e => { e.stopPropagation(); pop.style.display = pop.style.display === 'none' ? 'block' : 'none'; });
  document.addEventListener('mousedown', e => { if (!e.target.closest('#roColsPop') && !e.target.closest('#roColsBtn')) pop.style.display = 'none'; });
  pop.addEventListener('change', e => { const c = e.target.closest('input[data-col]'); if (!c) return; const hid = roHiddenSet(); c.checked ? hid.delete(c.dataset.col) : hid.add(c.dataset.col); ro.hidden = [...hid]; roSave(); roStaffRender(); pop.style.display = 'block'; });
  pop.addEventListener('click', e => { const b = e.target.closest('[data-cs]'); if (!b) return; const all = roColDefs().map(d => d.k); ro.hidden = b.dataset.cs === 'all' ? [] : b.dataset.cs === 'none' ? all.filter(k => k !== 'c:id' && k !== 'c:name') : ro.spCols.filter(c => c.mapped).map(c => 's:' + c.k); roSave(); roStaffRender(); pop.style.display = 'block'; });
  q('#roSExcel').addEventListener('click', () => { const t = roStaffTable(), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([t.headers, ...t.rows]), 'Staff'); XLSX.writeFile(wb, 'Staff_List.xlsx'); addActivity('export', 'Staff list Excel'); });
  q('#roSPrint').addEventListener('click', () => { const t = roStaffTable(); w_printTable(t.title, t.note, t.headers, t.rows); });
  q('#roSExpand').addEventListener('click', () => roExpand(roStaffTable())); q('#roSEmail').addEventListener('click', () => { window.extMailData = roStaffTable; wMail_open('ext'); });
  q('#roStaffBody').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; const s = ro.staff[+b.dataset.del]; if (!s || !confirm(`Remove ${s.name} from the roster (and all their planned days)?`)) return; ro.staff.splice(+b.dataset.del, 1); Object.values(ro.days).forEach(d => delete d[s.id]); roSave(); roRender(); });
  q('#roSlotBody').addEventListener('change', e => { const t = e.target, i = +t.dataset.si; if (!t.dataset.sf || !ro.slots[i]) return; const old = roK(ro.slots[i]); ro.slots[i][t.dataset.sf] = t.value; const nk = roK(ro.slots[i]); if (old !== nk) Object.values(ro.days).forEach(d => Object.keys(d).forEach(id => { d[id] = d[id].map(k => k === old ? nk : k); })); roSave(); roKpis(); });
  q('#roSlotBody').addEventListener('click', e => { const b = e.target.closest('[data-sdel]'); if (!b) return; ro.slots.splice(+b.dataset.sdel, 1); roSave(); roRender(); });
  const slotDefaults = () => { const l = ro.slots[ro.slots.length - 1]; if (l) q('#roSlotNewShift').value = l.shift; q('#roSlotNewFrom').value = l ? l.to : '07:00'; q('#roSlotNewTo').value = l ? roT((roM(l.to) || 0) + 60) : '08:00'; };
  slotDefaults(); q('#roSlotDet').addEventListener('toggle', () => { if (q('#roSlotDet').open && !q('#roSlotNewFrom').dataset.touched) slotDefaults(); }); ['#roSlotNewFrom', '#roSlotNewTo'].forEach(s => q(s).addEventListener('input', () => { q('#roSlotNewFrom').dataset.touched = '1'; }));
  q('#roSlotAdd').addEventListener('click', () => {
    const msg = q('#roSlotMsg'), say = (t, bad) => { msg.textContent = t; msg.style.color = bad ? '#b42318' : '#0b7a0b'; sectionToast(t, bad ? 'warn' : 'success'); };
    try {
      const shift = q('#roSlotNewShift').value, from = q('#roSlotNewFrom').value, to = q('#roSlotNewTo').value;
      if (!from || !to) return say('Enter both the From and the To time.', true); if (from === to) return say('From and To cannot be the same time.', true);
      if (ro.slots.some(s => s.from === from && s.to === to)) return say(`A slot ${from}–${to} already exists.`, true);
      let at = -1; ro.slots.forEach((s, i) => { if (roShort(s.shift).toLowerCase() === roShort(shift).toLowerCase()) at = i; }); at = at < 0 ? ro.slots.length : at + 1; ro.slots.splice(at, 0, { shift, from, to });
      roSave(); roRender(); const tr = q('#roSlotBody').children[at]; if (tr) { tr.classList.add('ro-flash'); tr.scrollIntoView({ block: 'nearest' }); const inp = tr.querySelector('input'); if (inp) inp.focus({ preventScroll: true }); }
      say(`✓ Slot ${from}–${to} (${shift}) added — now ${ro.slots.length} slots; it appears as a new row in the Daily grid.`); delete q('#roSlotNewFrom').dataset.touched; q('#roSlotNewFrom').value = to; q('#roSlotNewTo').value = roT((roM(to) || 0) + 60);
    } catch (err) { say('Could not add the slot: ' + err.message, true); }
  });
  q('#roShAdd').addEventListener('click', () => {
    const msg = q('#roShMsg'), say = (t, bad) => { msg.textContent = t; msg.style.color = bad ? '#b42318' : '#0b7a0b'; sectionToast(t, bad ? 'warn' : 'success'); };
    let name = q('#roShNewName').value.trim().replace(/\s+/g, ' '); if (!name) return say('Type a name for the new shift, e.g. Evening or Morning.', true);
    if (!/shift\s*$/i.test(name)) name += ' Shift'; const short = roShort(name); if (/^(off|leave|custom)$/i.test(short)) return say(`“${short}” is reserved — pick another name.`, true);
    if (roShiftNames().some(n => roShort(n).toLowerCase() === short.toLowerCase())) return say(`A shift called “${short}” already exists — add slots to it below instead.`, true);
    const from = q('#roShNewFrom').value, to = q('#roShNewTo').value, step = +q('#roShNewStep').value; const fm = roM(from), tm = roM(to);
    ro.shifts = roShiftNames().concat([name]); let made = 0, skipped = 0;
    if (from && to && fm != null && tm != null && from !== to) { let span = tm - fm; if (span <= 0) span += 1440; const n = step > 0 ? Math.ceil(span / step) : 1; let cur = fm;
      for (let i = 0; i < n; i++) { const nx = Math.min(fm + span, cur + (step > 0 ? step : span)), f = roT(cur), t2 = roT(nx); if (ro.slots.some(s => s.from === f && s.to === t2)) skipped++; else { ro.slots.push({ shift: name, from: f, to: t2 }); made++; } cur = nx; } }
    else if (from || to) { ro.shifts = ro.shifts.filter(n => n !== name); return say('Enter both the From and the To time — or leave both empty and add the slots yourself afterwards.', true); }
    roSave(); roRender(); q('#roShNewName').value = '';
    say(`✓ ${name} created` + (made ? ` with ${made} time slot(s) (${from} → ${to}${step ? ', every ' + step + ' min' : ''})` : ' — now add its time slots below') + (skipped ? `. ${skipped} slot(s) with exactly the same times already exist in another shift and were not duplicated — choose a different step or times if you need them separate.` : '.'));
    q('#roSlotNewShift').value = name; });
  q('#roShiftList').addEventListener('click', e => { const b = e.target.closest('[data-shdel]'); if (!b) return; const n = b.dataset.shdel, S = ro.slots.filter(s => roShort(s.shift).toLowerCase() === roShort(n).toLowerCase());
    if (roShiftNames().length <= 1) { sectionToast('At least one shift must remain.', 'warn'); return; }
    if (!confirm(`Remove “${n}”${S.length ? ` and its ${S.length} time slot(s)` : ''}? People marked in those slots lose those marks.`)) return;
    const keys = new Set(S.map(roK)); ro.slots = ro.slots.filter(s => !S.includes(s)); Object.values(ro.days).forEach(d => Object.keys(d).forEach(id => { d[id] = d[id].filter(k => !keys.has(k)); if (!d[id].length) delete d[id]; }));
    ro.shifts = roShiftNames().filter(x => roShort(x).toLowerCase() !== roShort(n).toLowerCase()); ro.shiftSel = ro.shiftSel.filter(x => roShort(x).toLowerCase() !== roShort(n).toLowerCase()); roSave(); roRender(); });
  q('#roSlotReset').addEventListener('click', () => { if (!confirm('Replace the time slots with the standard 07:00–08:00 cycle from the sheet?')) return; ro.slots = roDefaultSlots(); ro.shifts = null; roSave(); roRender(); });
  { // ---- break hours panel
    const who = () => { const t = q('#roBrkWho').value, v = q('#roBrkWhoV').value; if (t === 'shown') return roStaffRows().map(x => x.s); const A = roActive(); return t === 'role' ? A.filter(s => s.role === v) : t === 'shift' ? A.filter(s => (s.defShift || '') === v) : A; };
    const say = (t, bad) => { const m = q('#roBrkMsg'); m.textContent = t; m.style.color = bad ? '#b42318' : '#0b7a0b'; };
    const whoV = () => { const t = q('#roBrkWho').value, sel = q('#roBrkWhoV'); sel.style.display = t === 'role' || t === 'shift' ? '' : 'none'; if (t === 'role') sel.innerHTML = [...new Set(ro.staff.map(s => s.role).filter(Boolean))].sort().map(x => `<option>${plEsc(x)}</option>`).join(''); else if (t === 'shift') sel.innerHTML = ['', ...roShiftNames().map(roShort)].map(x => `<option value="${plEsc(x)}">${x || '— no default shift —'}</option>`).join(''); };
    q('#roBrkWho').addEventListener('change', whoV); whoV();
    const lenTxt = () => { const t = roBrkTotal(roBrkDraftD); q('#roBrkDLen').textContent = t ? `= ${t} min in total` : ''; }; roBrkEd.d = roBrkEditor(q('#roBrkDHost'), roBrkDraftD, lenTxt, { tools: true }); roBrkEd.b = roBrkEditor(q('#roBrkBHost'), roBrkDraftB, () => {}, { tools: true }); roBrkDraftB.push({ from: '', to: '' }); roBrkEd.b.render(); roBrkNorm(ro.brk).forEach(b => roBrkDraftD.push({ from: b.from, to: b.to })); roBrkEd.d.render(); lenTxt();
    q('#roBrkDSave').addEventListener('click', () => { const c = roBrkCheck(roBrkDraftD); if (c.err) return say(c.err, true); ro.brk = c.list; roSave(); roRender(); say(c.list.length ? `✓ Default break saved: ${c.list.map(b => b.from + '–' + b.to).join(', ')}.` : '✓ Default break removed.'); });
    q('#roBrkApply').addEventListener('click', () => { const c = roBrkCheck(roBrkDraftB); if (c.err) return say(c.err, true); if (!c.list.length) return say('Enter at least one break slot (start and end).', true); const L = who(); if (!L.length) return say('Nobody matches.', true); const tx = c.list.map(b => b.from + '–' + b.to).join(', '); L.forEach(s => { s.brk = c.list.map(b => ({ from: b.from, to: b.to })); }); roSave(); roRender(); say(`✓ Break ${tx} set for ${L.length} people.`); addActivity('edit', `Roster: break ${tx} set for ${L.length} staff`); });
    q('#roBrkClear').addEventListener('click', () => { const L = who(); L.forEach(s => { delete s.brk; }); roSave(); roRender(); say(`✓ ${L.length} people now use the default break.`); });
  }
  q('#roDate').addEventListener('change', e => { if (!e.target.value) return; ro.date = e.target.value; roRender(); }); q('#roPrev').addEventListener('click', () => { ro.date = roAdd(ro.date, -1); roRender(); }); q('#roNext').addEventListener('click', () => { ro.date = roAdd(ro.date, 1); roRender(); });
  q('#roWeek').addEventListener('change', e => { if (!e.target.value) return; ro.week = e.target.value; roRender(); }); q('#roWPrev').addEventListener('click', () => { ro.week = roAdd(ro.week, -7); roRender(); }); q('#roWNext').addEventListener('click', () => { ro.week = roAdd(ro.week, 7); roRender(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') roPMClose(); });
  q('#roGrid').addEventListener('click', e => {
    const c = e.target.closest('td.ro-c'), sl = e.target.closest('td.ro-l[data-slot]'), who = e.target.closest('th[data-who]');
    if (c) { const id = c.dataset.who, k = c.dataset.k, cur = roSlotsOf(ro.date, id).slice(), ix = cur.indexOf(k); if (ix >= 0) cur.splice(ix, 1); else cur.push(k); const order = ro.slots.map(roK); cur.sort((a, b) => order.indexOf(a) - order.indexOf(b)); roSetSlots(ro.date, id, cur); (ro.status[ro.date] || {})[id] === 'Leave' && delete ro.status[ro.date][id]; roSave(); roGrid(); }
    else if (sl) { const S = roDaily(), k = sl.dataset.slot, all = S.every(p => roSlotsOf(ro.date, p.id).includes(k)), order = ro.slots.map(roK); S.forEach(p => { const cur = roSlotsOf(ro.date, p.id).filter(x => x !== k); if (!all) cur.push(k); cur.sort((a, b) => order.indexOf(a) - order.indexOf(b)); roSetSlots(ro.date, p.id, cur); }); roSave(); roGrid(); }
    });
  q('#roGrid').addEventListener('dblclick', e => { const who = e.target.closest('th[data-who]'); if (!who) return; e.stopPropagation(); e.preventDefault(); try { roPM(who.dataset.who, ro.date); } catch (err) { sectionToast('Could not open the staff card: ' + err.message, 'warn'); } });
  q('#roWeekGrid').addEventListener('dblclick', e => { const n = e.target.closest('[data-pm]'); if (n) { e.stopPropagation(); try { roPM(n.dataset.pm, ro.week); } catch (err) { sectionToast('Could not open the staff card: ' + err.message, 'warn'); } } });
  q('#roWeekGrid').addEventListener('change', e => { const s = e.target.closest('select[data-wd]'); if (!s) return; roApply(s.dataset.wd, s.dataset.who, s.value); roSave(); roWeek(); roKpis(); });
  const dayMap = (from, to) => { ro.days[to] = JSON.parse(JSON.stringify(ro.days[from] || {})); ro.status[to] = JSON.parse(JSON.stringify(ro.status[from] || {})); };
  q('#roCopyDay').addEventListener('click', () => { dayMap(roAdd(ro.date, -1), ro.date); roSave(); roRender(); });
  q('#roClearDay').addEventListener('click', () => { if (!confirm('Clear all availability on ' + ro.date + '?')) return; delete ro.days[ro.date]; delete ro.status[ro.date]; roSave(); roRender(); });
  q('#roWCopy').addEventListener('click', () => { for (let i = 0; i < 7; i++) dayMap(roAdd(ro.week, i - 7), roAdd(ro.week, i)); roSave(); roRender(); });
  q('#roWDef').addEventListener('click', () => { let n = 0; roFilter(ro.rolesW, ro.qW, ro.week).forEach(p => { if (!p.defShift && !p.offDay) return; roWeekDays(ro.week).forEach(d => { roDefApply(d, p); n++; }); }); roSave(); roRender(); sectionToast(n ? 'Default shifts applied to the week.' : 'No staff have a default shift or off day yet (tab 1).', n ? 'success' : 'warn'); });
  q('#roWClear').addEventListener('click', () => { if (!confirm('Clear the whole week starting ' + ro.week + '?')) return; for (let i = 0; i < 7; i++) { delete ro.days[roAdd(ro.week, i)]; delete ro.status[roAdd(ro.week, i)]; } roSave(); roRender(); });
  q('#roDExcel').addEventListener('click', () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(roDayAoa(ro.date)), 'Sheet1'); XLSX.writeFile(wb, `Daily_Team_Site_Attendance_${ro.date}.xlsx`); addActivity('export', 'Staff roster day Excel'); });
  q('#roDPrint').addEventListener('click', roPrintGrid); q('#roDPdf').addEventListener('click', () => { sectionToast('In the print window choose “Save as PDF” as the destination.', 'info'); roPrintGrid(); });
  q('#roWExcel').addEventListener('click', () => { const t = roWeekTable(), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([t.headers, ...t.rows]), t.sheet); XLSX.writeFile(wb, `Weekly_Staff_Plan_${ro.week}.xlsx`); addActivity('export', 'Staff roster week Excel'); });
  q('#roWPrint').addEventListener('click', () => { const t = roWeekTable(); w_printTable(t.title, t.note, t.headers, t.rows); });
  q('#roDXlC').addEventListener('click', () => roSmGridXlsx(false, roDayGridModel()).catch(e => sectionToast('Excel export failed: ' + e.message, 'warn'))); q('#roDImg').addEventListener('click', () => roSmGridImage(roDayGridModel()));
  q('#roDEmail').addEventListener('click', () => { window.extMailData = roDayTable; wMail_open('ext'); });
  q('#roDExpand').addEventListener('click', () => roDayFull()); q('#roWExpand').addEventListener('click', () => roExpand(roWeekTable()));
  q('#roWEmail').addEventListener('click', () => { window.extMailData = roWeekTable; wMail_open('ext'); });
  roUpInit(); q('#roSpLoad').addEventListener('click', roSpLoad); q('#roSpApply').addEventListener('click', roSpApply); q('#roSpFilter').addEventListener('input', roSpRender); q('#roSpGo').addEventListener('click', () => { const n = document.querySelector('.nav-item[data-view="uploaddest"]'); if (n) n.click(); });
}

/* ---------- one-time import of the "Current Shift" sheet (runs once on this browser, then never again) ---------- */
const RO_CS_KEY = 'nfpc_ro_curshift_v1';
const RO_CS = [["901900", "Muhammed Shafeek Kambitte Valappu", "Store Supervisor", "Day", "07:00", "19:00", "14:00", "14:30", ""], ["904325", "Surjith Thekkayil Meethal", "Storekeeper", "Day", "07:00", "19:00", "13:30", "14:00", ""], ["905958", "Henry Kayondo", "Assistant Storekeeper", "Day", "09:00", "21:00", "12:00", "13:00", ""], ["900987", "John Batcha Abdul Kadar", "Assistant Storekeeper", "Night", "19:00", "07:00", "19:30", "20:00", ""], ["906042", "Martin Sserunkuma", "Assistant Storekeeper", "Night", "19:00", "07:00", "19:00", "19:30", ""], ["909788", "Amal Madhurapoyil", "Assistant Storekeeper", "Day", "09:00", "21:00", "13:00", "13:30", ""], ["901291", "Anil Kumar Krishnan", "Forklift Operator", "Day", "07:00", "19:00", "12:00", "13:00", ""], ["901494", "Sahab Uddin Sarder", "Forklift Operator", "", "", "", "", "", "Vacation"], ["902230", "Muhammad Shabbir Muhammad Tazeem", "Forklift Operator", "Day", "09:00", "21:00", "12:00", "13:00", ""], ["904640", "Babar Nadeem Allah Ditta Javed", "Forklift Operator", "Day", "09:00", "21:00", "12:00", "13:00", ""], ["908766", "Vijayaraj Manoharan", "Forklift Operator", "Day", "07:00", "19:00", "12:00", "13:00", ""], ["909225", "Shiva Bhattarai", "Forklift Operator", "", "", "", "", "", "Vacation"], ["909235", "Yam Bahadur Gurung", "Forklift Operator", "Day", "09:00", "21:00", "13:00", "14:00", ""], ["909615", "Danish Ali", "Forklift Operator", "Day", "09:00", "21:00", "13:00", "14:00", ""], ["910726", "Ganesh Singh Khatri", "Forklift Operator", "Day", "07:00", "19:00", "11:00", "12:00", ""], ["909384", "Shadrack Sserunjogi", "Forklift Operator", "", "", "", "", "", "Vacation"], ["910116", "Muhammad Afaq Khan", "Forklift Operator", "Day", "09:00", "21:00", "13:00", "14:00", ""], ["904218", "Irfan Arshad Arshad Mehmood", "Forklift Operator", "Day", "07:00", "19:00", "12:00", "13:00", ""], ["902056", "Anowar Hossain Md. Hossain", "Forklift Operator", "Day", "09:00", "21:00", "13:00", "14:00", ""], ["900708", "Ahmed Ali Mohamed", "Forklift Operator", "Night", "19:00", "07:00", "19:00", "19:30", ""], ["902147", "Sagir Ahmmed Nur Mohammad", "Forklift Operator", "Night", "19:00", "07:00", "19:00", "19:30", ""], ["902456", "Bhakta Bahadur Rai", "Forklift Operator", "Night", "19:00", "07:00", "19:00", "19:30", ""], ["902562", "Aamir Shabbir", "Forklift Operator", "Night", "19:00", "07:00", "19:00", "19:30", ""], ["909241", "Amir Saddique", "Forklift Operator", "Night", "19:00", "07:00", "19:00", "19:30", ""], ["909274", "Rabi lal Pun", "Forklift Operator", "Night", "19:00", "07:00", "19:00", "19:30", ""], ["911444", "Manav Paramjeet Singh", "Helper", "Day", "07:00", "19:00", "12:00", "13:00", ""], ["911077", "Ajay Yadav", "Helper", "Day", "09:00", "21:00", "13:00", "14:00", ""], ["911805", "Shahul KT", "Helper", "Day", "09:00", "21:00", "13:00", "14:00", ""], ["911986", "Alen Baby", "Helper", "Day", "09:00", "21:00", "12:00", "13:00", ""], ["912179", "Nazeef Salam", "Helper", "Day", "09:00", "21:00", "13:30", "14:30", ""], ["912141", "Dil Bahadur G T", "Helper", "Day", "09:00", "21:00", "12:30", "13:30", ""], ["910465", "Ram Bahadur Bhartiya", "Helper", "Day", "09:00", "21:00", "13:00", "14:00", ""], ["911837", "Gurpreet Singh Balwinder Singh", "Helper", "Day", "09:00", "21:00", "13:00", "14:00", ""], ["905026", "Bimal Rai", "Helper", "Day", "09:00", "21:00", "13:00", "14:00", ""], ["911015", "Zablon Ogeto Moseti", "Helper", "Night", "19:00", "07:00", "19:00", "19:30", ""], ["911934", "Godfred Annor", "Helper", "Night", "19:00", "07:00", "19:00", "19:30", ""], ["911939", "Dominic Kwesi Sie", "Helper", "Night", "19:00", "07:00", "19:00", "19:30", ""]];
function roCurShiftOnce() {
  try { if (localStorage.getItem(RO_CS_KEY)) return; } catch (e) { return; }
  if (!ro.slots.length) ro.slots = roDefaultSlots(); if (!ro.date) ro.date = roIsoLocal(new Date()); const date = ro.date;
  let added = 0, upd = 0, leave = 0; ro.days[date] = ro.days[date] || {}; ro.status[date] = ro.status[date] || {};
  RO_CS.forEach(r => {
    const [id, name, role, shift, f, t, bf, bt, rem] = r; let p = ro.staff.find(x => String(x.id).trim() === id);   // matched by File Nr only
    if (p) { upd++; if (!p.role && role) p.role = role; } else { p = { id, name, role, active: true }; ro.staff.push(p); added++; }
    p.area = 'MAQ';
    if (/vacation|leave/i.test(rem)) { p.defShift = ''; roSetSlots(date, p.id, []); ro.status[date][p.id] = 'Leave'; leave++; return; }
    p.defShift = shift; p.shiftTime = f + '–' + t; delete ro.status[date][p.id];
    const a = roM(f), b = roM(t); const pick = new Map(); ro.slots.forEach(s => { const m = roM(s.from); if (m == null || !(a < b ? (m >= a && m < b) : (m >= a || m < b))) return; const cur = pick.get(m); if (!cur || (roShort(s.shift).toLowerCase() === shift.toLowerCase() && roShort(cur.shift).toLowerCase() !== shift.toLowerCase())) pick.set(m, s); }); const keys = ro.slots.filter(s => pick.get(roM(s.from)) === s).map(roK);   // one slot per hour, preferring the person's own shift
    roSetSlots(date, p.id, keys);
    if (bf && bt) p.brk = [{ from: bf, to: bt }]; else delete p.brk;
  });
  roSave(); try { localStorage.setItem(RO_CS_KEY, String(Date.now())); } catch (e) {}
  roRender(); sectionToast(`✓ Current shift imported (one time): ${RO_CS.length} staff · ${added} new · ${upd} updated · ${leave} on vacation. Working area set to MAQ; shifts, break slots and ${date} availability were set.`, 'success'); addActivity('upload', `Current shift imported once: ${RO_CS.length} staff`);
}

/* ---------- roster templates: availability + each person's break slots, kept on this device and optionally in SharePoint ---------- */
const roTplMsg = (t, bad) => { const m = PLQ('#roTplMsg'); if (m) { m.textContent = t; m.style.color = bad ? '#b42318' : '#0b7a0b'; } };
function roTplList() { const sel = PLQ('#roTplSel'); if (!sel) return; const v = sel.value; sel.innerHTML = '<option value="">— choose a roster template —</option>' + ro.rosTpl.map((t, i) => `<option value="${i}">${plEsc(t.name)} · ${t.days.length === 7 ? 'week' : 'day'} · ${Object.keys(t.brk || {}).length} breaks · ${plEsc((t.at || '').slice(0, 10))}</option>`).join(''); if (v && ro.rosTpl[+v]) sel.value = v; }
function roTplCapture(scope, name) {
  const dates = scope === 'week' ? roWeekDays(ro.date) : [ro.date], brk = {};
  ro.staff.forEach(p => { const L = roBrkNorm(p.brk); if (L.length) brk[p.id] = L; });
  const days = dates.map(d => { const o = {}; ro.staff.forEach(p => { const k = roSlotsOf(d, p.id), st = (ro.status[d] || {})[p.id]; if ((k && k.length) || st) o[p.id] = { k: k.slice(), st: st || '' }; }); return { dow: roDow(d), people: o }; });
  return { name, at: new Date().toISOString(), by: (typeof getGlobalUserName === 'function' ? getGlobalUserName() : '') || '', days, brk, defBrk: roBrkNorm(ro.brk) };
}
function roTplApplyTo(t, withBrk) {
  const dates = t.days.length === 7 ? roWeekDays(ro.date) : [ro.date], keys = new Set(ro.slots.map(roK)); let ppl = 0, miss = new Set(), bn = 0;
  t.days.forEach((D, i) => { const d = dates[i]; ro.days[d] = ro.days[d] || {}; ro.status[d] = ro.status[d] || {};
    Object.entries(D.people).forEach(([id, v]) => { const p = ro.staff.find(x => String(x.id) === String(id)); if (!p) { miss.add(id); return; } roSetSlots(d, p.id, (v.k || []).filter(k => keys.has(k))); if (v.st) ro.status[d][p.id] = v.st; else delete ro.status[d][p.id]; ppl++; }); });
  if (withBrk) { Object.entries(t.brk || {}).forEach(([id, L]) => { const p = ro.staff.find(x => String(x.id) === String(id)); if (!p) return; p.brk = roBrkNorm(L); bn++; }); if (t.defBrk && t.defBrk.length) ro.brk = roBrkNorm(t.defBrk); }
  roSave(); roRender(); return { ppl, miss: miss.size, bn, days: dates.length };
}
const roTplSpPath = () => 'RosterData/roster_templates.json';
async function roTplSpSave() {
  const { siteId, token } = await plSp(), payload = JSON.stringify({ version: 1, saved: new Date().toISOString(), templates: ro.rosTpl });
  const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${roTplSpPath()}:/content?@microsoft.graph.conflictBehavior=replace`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: new Blob([payload], { type: 'application/json' }) }, 'save roster templates'); if (!r.ok) throw await atSpErr(r); return ro.rosTpl.length;
}
async function roTplSpLoad() {
  const { siteId, token } = await plSp(), r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${roTplSpPath()}:/content`, { headers: { Authorization: `Bearer ${token}` } }, 'load roster templates'); if (r.status === 404) return null; if (!r.ok) throw await atSpErr(r);
  const d = await r.json(); if (!d || !Array.isArray(d.templates)) throw new Error('That SharePoint file is not a roster-templates JSON.'); let add = 0, upd = 0;
  d.templates.filter(t => t && t.name && Array.isArray(t.days)).forEach(t => { const i = ro.rosTpl.findIndex(x => x.name.toLowerCase() === t.name.toLowerCase()); if (i < 0) { ro.rosTpl.push(t); add++; } else if ((t.at || '') > (ro.rosTpl[i].at || '')) { ro.rosTpl[i] = t; upd++; } }); roSave(); return { add, upd };
}
function roTplWire(q) {
  roTplList();
  const cur = () => ro.rosTpl[+q('#roTplSel').value];
  const save = scope => { const nm = (prompt(scope === 'week' ? 'Name this WEEK template (e.g. “Standard week”):' : 'Name this DAY template (e.g. “Weekday – staggered breaks”):', '') || '').trim(); if (!nm) return; const ex = ro.rosTpl.findIndex(t => t.name.toLowerCase() === nm.toLowerCase()); if (ex >= 0 && !confirm(`A template named “${ro.rosTpl[ex].name}” exists. Replace it?`)) return; const t = roTplCapture(scope, nm); if (ex >= 0) ro.rosTpl[ex] = t; else ro.rosTpl.push(t); roSave(); roTplList(); q('#roTplSel').value = String(ex >= 0 ? ex : ro.rosTpl.length - 1); roTplMsg(`✓ Template “${nm}” saved (${scope === 'week' ? '7 days' : ro.date} · ${Object.keys(t.brk).length} people with break slots).`); addActivity('edit', `Roster template saved: ${nm}`); };
  q('#roTplSaveDay').addEventListener('click', () => save('day')); q('#roTplSaveWeek').addEventListener('click', () => save('week'));
  q('#roTplApply').addEventListener('click', () => { const t = cur(); if (!t) return roTplMsg('Choose a roster template first.', true); const wk = t.days.length === 7, tgt = wk ? `the week of ${roMonday(ro.date)}` : ro.date; if (!confirm(`Apply “${t.name}” to ${tgt}? This replaces the availability of the people in the template${q('#roTplBrk').checked ? ' and sets their break slots' : ''}.`)) return; const r = roTplApplyTo(t, q('#roTplBrk').checked); roTplMsg(`✓ Applied to ${tgt}: ${r.ppl} person-days${q('#roTplBrk').checked ? ' · ' + r.bn + ' people got their break slots' : ''}${r.miss ? ' · ' + r.miss + ' people in the template are not in the roster (skipped)' : ''}.`); addActivity('edit', `Roster template applied: ${t.name} → ${tgt}`); });
  q('#roTplDel').addEventListener('click', () => { const t = cur(); if (!t) return roTplMsg('Choose a roster template first.', true); if (!confirm(`Delete the template “${t.name}”?`)) return; ro.rosTpl.splice(+q('#roTplSel').value, 1); roSave(); roTplList(); roTplMsg('Template deleted.'); });
  q('#roTplSpSave').addEventListener('click', async () => { if (!getGlobalAccessToken()) return roTplMsg('Connect to SharePoint first.', true); try { roTplMsg('Saving to SharePoint…'); const n = await roTplSpSave(); roTplMsg(`✓ ${n} template(s) saved to SharePoint (${roTplSpPath()}).`); } catch (e) { roTplMsg('✘ ' + e.message, true); } });
  q('#roTplSpLoad').addEventListener('click', async () => { if (!getGlobalAccessToken()) return roTplMsg('Connect to SharePoint first.', true); try { roTplMsg('Reading SharePoint…'); const r = await roTplSpLoad(); if (!r) return roTplMsg('No roster-templates file on SharePoint yet — use “Save to SharePoint” first.', true); roTplList(); roTplMsg(`✓ Loaded from SharePoint: ${r.add} new · ${r.upd} updated.`); } catch (e) { roTplMsg('✘ ' + e.message, true); } });
}

/* ---------- smart break planner: staggers each role's breaks so the operation always has cover ---------- */
let roSmLast = null, roSmO = null;

/* location fields for the smart break planner: Region → Warehouse → Store, each read from any staff field */
function roSmFieldOpts() {
  const o = [{ k: '', l: '— not used —' }, { k: 'c:area', l: 'Working area' }, { k: 'c:role', l: 'Job role' }, { k: 'c:defShift', l: 'Default shift' }];
  (ro.spCols || []).forEach(c => o.push({ k: 's:' + c.k, l: 'SharePoint · ' + (c.label || c.k) })); const seen = new Set(); ro.staff.forEach(p => Object.keys(p.det || {}).forEach(k => seen.add(k))); seen.forEach(k => o.push({ k: 'd:' + k, l: 'Detail · ' + k })); return o;
}
function roFieldVal(p, key) { if (!key) return ''; const [t, k] = [key.slice(0, 1), key.slice(2)]; const v = t === 'c' ? p[k] : t === 's' ? (p.sp || {})[k] : (p.det || {})[k]; return v == null ? '' : String(v).trim(); }
function roSmLocUi(force) {
  const S = ro.smart, opts = roSmFieldOpts(), sig = opts.map(x => x.k).join(',') + '|' + [S.fReg, S.fWh, S.fSt, S.regions, S.whs, S.stores].join('/') + '|' + ro.staff.length; const root = PLQ('#roSmRegion'); if (!root || (!force && root.dataset.sig === sig)) return;
  const fill = (id, key, rx) => { const sel = PLQ(id); sel.innerHTML = opts.map(x => `<option value="${plEsc(x.k)}">${plEsc(x.l)}</option>`).join(''); if (!key && !S.locInit) { const m = opts.find(x => x.k && rx.test(x.l)); if (m) { key = m.k; } } sel.value = key || ''; return sel.value; };
  S.fReg = fill('#roSmFReg', S.fReg, /region|city|emirate/i); S.fWh = fill('#roSmFWh', S.fWh, /warehouse|whs|\bwh\b/i); S.fSt = fill('#roSmFSt', S.fSt, /store|shop|outlet|branch/i); S.locInit = true; PLQ('#roSmPerLoc').checked = !!S.perLoc;
  const vals = (key, test) => [...new Set(ro.staff.filter(p => p.active !== false && test(p)).map(p => roFieldVal(p, key)).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const inR = p => !S.regions.length || !S.fReg || S.regions.includes(roFieldVal(p, S.fReg)), inW = p => !S.whs.length || !S.fWh || S.whs.includes(roFieldVal(p, S.fWh));
  const mk = (id, key, list, sel, cb) => { const h = PLQ(id); h.innerHTML = ''; if (!key) { h.innerHTML = '<div class="text-sm" style="color:var(--gray-500);padding:6px 2px">choose the field first</div>'; return; } h.appendChild(buildMultiCombo(sel, list, arr => { cb(arr); roSave(); roSmLocUi(true); }, { placeholder: 'All — type to search' })); };
  S.regions = S.regions.filter(v => vals(S.fReg, () => true).includes(v)); S.whs = S.whs.filter(v => vals(S.fWh, inR).includes(v)); S.stores = S.stores.filter(v => vals(S.fSt, p => inR(p) && inW(p)).includes(v));
  mk('#roSmRegion', S.fReg, vals(S.fReg, () => true), S.regions, a => { S.regions = a; }); mk('#roSmWh', S.fWh, vals(S.fWh, inR), S.whs, a => { S.whs = a; }); mk('#roSmStore', S.fSt, vals(S.fSt, p => inR(p) && inW(p)), S.stores, a => { S.stores = a; });
  root.dataset.sig = opts.map(x => x.k).join(',') + '|' + [S.fReg, S.fWh, S.fSt, S.regions, S.whs, S.stores].join('/') + '|' + ro.staff.length;
}

function roSmShiftOf(date, p) {   // the attendance shift a person works on that date: the default shift when they work any of its slots, otherwise the shift with most of their hours
  const keys = new Set(roSlotsOf(date, p.id)); if (!keys.size || (ro.status[date] || {})[p.id] === 'Leave') return ''; const cnt = {};
  ro.slots.forEach(sl => { if (keys.has(roK(sl))) { const n = roShort(sl.shift); cnt[n] = (cnt[n] || 0) + roDur(sl); } });
  const d = p.defShift && p.defShift !== 'Off' ? roShort(p.defShift) : ''; if (d && cnt[d]) return d; const e = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : '';
}
function roSmShiftUi() {
  const sel = PLQ('#roSmShift'); if (!sel || document.activeElement === sel) return; const names = [...new Set(roShiftNames().map(roShort))], S = ro.smart, sig = names.join(',') + '|' + S.shift; if (sel.dataset.sig === sig) return;
  if (S.shift == null || (S.shift !== '' && !names.includes(S.shift))) S.shift = names[0] || ''; sel.innerHTML = '<option value="">All shifts (each planned on its own)</option>' + names.map(n => `<option value="${plEsc(n)}">${plEsc(n)} shift</option>`).join(''); sel.value = S.shift; sel.dataset.sig = names.join(',') + '|' + S.shift;
}
function roSmartRoles() { roSmShiftUi(); roSmLocUi(); const h = PLQ('#roSmRoles'); if (!h || h.contains(document.activeElement)) return; const roles = [...new Set(ro.staff.map(s => s.role).filter(Boolean))].sort(), sig = roles.join(',') + '|' + ro.smart.roles.join(','); if (h.dataset.sig === sig) return; ro.smart.roles = ro.smart.roles.filter(r => roles.includes(r)); h.dataset.sig = roles.join(',') + '|' + ro.smart.roles.join(','); h.innerHTML = ''; h.appendChild(buildMultiCombo(ro.smart.roles, roles, arr => { ro.smart.roles = arr; h.dataset.sig = roles.join(',') + '|' + arr.join(','); roSave(); }, { placeholder: 'All roles — type to search' })); }
function roSmartLens(total, n, min, max, step) {   // split the total into n slots between min and max; adjusts n when needed
  const ok = k => { const base = total / k; return base >= min - 1e-9 && base <= max + 1e-9; };
  let k = n; if (!ok(k)) { let best = null; for (let i = 1; i <= 8; i++) if (ok(i) && (best == null || Math.abs(i - n) < Math.abs(best - n))) best = i; if (best == null) return null; k = best; }
  const unit = Math.max(1, step), each = Math.floor(total / k / unit) * unit; let rest = total - each * k; const L = Array(k).fill(each); for (let i = 0; rest > 0 && i < 50; i++) { const add = Math.min(unit, rest); if (L[i % k] + add <= max) { L[i % k] += add; rest -= add; } else if (i > 40) break; }
  if (L.some(x => x < min || x > max)) return null; return { lens: L, n: k, changed: k !== n };
}
function roSmartPlan(o) {
  const date = o.date || ro.date, step = o.step > 0 ? o.step : 5, notes = [], res = { people: [], roles: {}, skipped: [], outside: [] };
  let n, lens;
  if (o.commit) { n = Math.max(1, o.n); lens = Array(n).fill(o.min); notes.push(`Committed to the minimum: every slot is exactly ${o.min} min — ${n} slot(s) = ${n * o.min} min per person.`); }
  else {
    const lensR = roSmartLens(o.total, o.n, o.min, o.max, step); if (!lensR) return { err: `A total of ${o.total} min cannot be split into slots of ${o.min}–${o.max} min. Change the total, the minimum or the maximum.` };
    if (lensR.changed) notes.push(`Split into ${lensR.n} slot(s) instead of ${o.n} so each slot stays between ${o.min} and ${o.max} min.`);
    n = lensR.n; const base = lensR.lens.slice(), total = base.reduce((a, b) => a + b, 0);   // not committed: the minutes follow each slot's time frame
    const caps = base.map((l, j) => { const W = (o.sw || [])[j]; if (!(W && W.f && W.t)) return o.max; let F = roM(W.t) - roM(W.f); if (F <= 0) F += 1440; return Math.min(o.max, Math.floor(F / step) * step); });
    lens = base.map((l, j) => Math.min(l, caps[j])); let deficit = total - lens.reduce((a, b) => a + b, 0);
    for (let it = 0; deficit > 0 && it < 300; it++) { let moved = false; for (let j = 0; j < n && deficit > 0; j++) { const add = Math.min(step, caps[j] - lens[j], deficit); if (add > 0) { lens[j] += add; deficit -= add; moved = true; } } if (!moved) break; }
    lens.forEach((l, j) => { if (l !== base[j]) notes.push(`Break ${j + 1} adjusted from ${base[j]} to ${l} min to fit its time frame.`); }); if (deficit > 0) notes.push(`${deficit} min of the ${total} min could not be placed inside the time frames.`);
  }
  const load = {}, ld = (m) => load[m] || 0, bset = new Set(ro.slots.map(sl => roM(sl.from)));   // start times of the roster time slots
  let P = ro.staff.filter(p => p.active !== false && (!o.shift || roSmShiftOf(date, p) === o.shift) && (!o.roles.length || o.roles.includes(p.role)) && (!o.regions.length || !o.fReg || o.regions.includes(roFieldVal(p, o.fReg))) && (!o.whs.length || !o.fWh || o.whs.includes(roFieldVal(p, o.fWh))) && (!o.stores.length || !o.fSt || o.stores.includes(roFieldVal(p, o.fSt))));
  const locOf = p => ({ reg: roFieldVal(p, o.fReg), wh: roFieldVal(p, o.fWh), st: roFieldVal(p, o.fSt) }), shOf = p => roSmShiftOf(date, p), gkOf = p => (o.perLoc ? [shOf(p), roFieldVal(p, o.fReg), roFieldVal(p, o.fWh), roFieldVal(p, o.fSt), p.role || '—'] : [shOf(p), p.role || '—']).join(' | ');
  const info = P.map(p => { const keys = new Set(roSlotsOf(date, p.id)), S = ro.slots.filter(sl => keys.has(roK(sl)) && roShort(sl.shift) === shOf(p)); if (!S.length || (ro.status[date] || {})[p.id] === 'Leave') return null;   // the plan only uses the slots of the person's own attendance shift
    let abs = 0, prev = -1; const segs = []; S.forEach(sl => { let a = roM(sl.from); if (a == null) return; while (a + abs < prev) abs += 1440; const st = a + abs; prev = st; const en = st + roDur(sl) * 60; const last = segs[segs.length - 1]; if (last && st <= last[1]) last[1] = Math.max(last[1], en); else segs.push([st, en]); });
    return { p, segs }; }).filter(Boolean);
  P.forEach(p => { if (!info.some(x => x.p === p)) res.skipped.push(p.name || p.id); });
  info.sort((x, y) => gkOf(x.p).localeCompare(gkOf(y.p)) || x.segs[0][0] % 1440 - y.segs[0][0] % 1440 || String(x.p.name).localeCompare(String(y.p.name)));
  const eligN = {}, eligI = {};   // for a slot with a time frame: only the people whose shift reaches it share the frame equally
  (o.sw || []).forEach((W, j) => { if (!(W && W.f && W.t) || j >= n) return; info.forEach(it => { const a0 = it.segs[0][0]; let wf = roM(W.f), wt = roM(W.t); while (wf < a0) wf += 1440; while (wt <= wf) wt += 1440; let ok = false; for (let t = Math.ceil(wf / step) * step; t + lens[j] <= wt + 1e-9; t += step) if (it.segs.some(sg => t >= sg[0] && t + lens[j] <= sg[1])) { ok = true; break; } it.el = it.el || []; it.el[j] = ok; if (ok) { const k = j + '|' + gkOf(it.p); eligN[k] = (eligN[k] || 0) + 1; } }); });
  const idxIn = {}, PHI = 0.6180339887, gcount = {}; info.forEach(it => { const k = gkOf(it.p); gcount[k] = (gcount[k] || 0) + 1; });
  info.forEach(it => {
    const r = gkOf(it.p), i = idxIn[r] = (idxIn[r] || 0) + 1, a0 = it.segs[0][0], b1 = it.segs[it.segs.length - 1][1];
    let lo = a0 + o.margin, hi = b1 - o.margin;
    if (o.wf && o.wt) { let wf = roM(o.wf), wt = roM(o.wt); while (wf < a0) wf += 1440; while (wt <= wf) wt += 1440; lo = Math.max(lo, wf); hi = Math.min(hi, wt); }
    const need = lens.reduce((a, b) => a + b, 0); if (hi - lo < need + (n - 1) * step) { lo = a0; hi = b1; }
    if (hi - lo < need) { res.skipped.push((it.p.name || it.p.id) + ' (working time too short)'); return; }
    const cov = (t0, t1) => it.segs.some(sg => t0 >= sg[0] && t1 <= sg[1]), part = (hi - lo) / n, out = [];
    const cmp = (x, y) => { for (let q = 0; q < x.length; q++) if (x[q] !== y[q]) return x[q] - y[q]; return 0; }, K = gcount[r];
    for (let j = 0; j < n; j++) {
      const len = lens[j], W = (o.sw || [])[j] || {}, hasW = !!(W.f && W.t);
      const place = (lj, hj, ideal, exact) => { const r1 = (o.align !== false || !(o.step > 0)) ? place1(lj, hj, ideal, exact, true) : null; return r1 || place1(lj, hj, ideal, exact, false); };
      const place1 = (lj, hj, ideal, exact, aligned) => { let best = null;
        for (let t = Math.ceil(lj / step) * step; t + len <= hj + 1e-9; t += step) {
          if (aligned && !bset.has(((t % 1440) + 1440) % 1440)) continue;
          if (!cov(t, t + len) || out.some(z => t < z.t + z.len && t + len > z.t)) continue;   // inside working time, never on top of the person's other slots
          let mx = 0, sum = 0; for (let x = t; x < t + len; x += step) { const v = load[r + '|' + Math.floor((x % 1440) / step)] || 0; mx = Math.max(mx, v); sum += v; }
          const c = exact ? [Math.abs(t - ideal), mx, sum] : [mx, sum, Math.abs(t - ideal)]; if (!best || cmp(c, best.c) < 0) best = { t, c };
        } return best; };
      let best = null;
      if (hasW) {   // optional time frame for this slot: staff of the group are spread equally across it
        let wf = roM(W.f), wt = roM(W.t); while (wf < a0) wf += 1440; while (wt <= wf) wt += 1440;
        const ek = j + '|' + r; if (it.el && it.el[j]) eligI[ek] = (eligI[ek] || 0) + 1; const pos = Math.max(0, (eligI[ek] || 1) - 1), Ke = eligN[ek] || 1;
        best = place(wf, wt, wf + (Ke > 1 ? pos / (Ke - 1) : 0.5) * Math.max(0, wt - len - wf), true);
        if (!best) res.outside.push((it.p.name || it.p.id) + ' (slot ' + (j + 1) + ')');
      }
      if (!best) { const lj = lo + j * part, hj = lj + part, ideal = lj + ((i * PHI) % 1) * Math.max(0, part - len); best = place(lj, hj, ideal, false) || place(a0, b1, ideal, false); }
      if (!best) { res.skipped.push((it.p.name || it.p.id) + ' (no free time for slot ' + (j + 1) + ')'); return; }
      for (let x = best.t; x < best.t + len; x += step) { const key = r + '|' + Math.floor((x % 1440) / step); load[key] = (load[key] || 0) + 1; }
      out.push({ t: best.t, len });
    }
    out.sort((a, b) => a.t - b.t); const fmt = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    res.people.push({ p: it.p, segs: it.segs, role: it.p.role || '—', sh: shOf(it.p), gk: r, loc: locOf(it.p), shift: fmt(a0) + '–' + fmt(b1), slots: out.map(x => ({ from: fmt(x.t), to: fmt(x.t + x.len), t: x.t, len: x.len })) });
  });
  return Object.assign(res, { lens, n, notes, step });
}
function roSmartSummary(plan) {
  const by = {}; plan.people.forEach(x => { (by[x.gk] = by[x.gk] || { n: 0, load: {}, x }).n++; x.slots.forEach(sl => { for (let m = sl.t; m < sl.t + sl.len; m += plan.step) { const k = Math.floor((m % 1440) / plan.step); by[x.gk].load[k] = (by[x.gk].load[k] || 0) + 1; } }); });
  return Object.entries(by).map(([r, v]) => { let pk = 0, at = 0; Object.entries(v.load).forEach(([k, c]) => { if (c > pk) { pk = c; at = +k; } }); const f = k => { const m = k * plan.step; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }; return { role: v.x.role, sh: v.x.sh, loc: v.x.loc, n: v.n, peak: pk, at: f(at) }; });
}


function roSmSlotWinUi() {
  const h = PLQ('#roSmSlotWin'); if (!h) return; const S = ro.smart, L = S.commit ? { n: Math.max(1, S.n), lens: Array(Math.max(1, S.n)).fill(S.min) } : roSmartLens(S.total, S.n, S.min, S.max, S.step > 0 ? S.step : 5), k = L ? L.n : S.n, lens = L ? L.lens : [];
  S.sw = (S.sw || []).slice(0, k); while (S.sw.length < k) S.sw.push({ f: '', t: '' });
  h.innerHTML = S.sw.map((w, j) => `<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap"><span class="text-sm" style="min-width:160px">Break ${j + 1}${lens[j] ? ' · ' + lens[j] + ' min' : ''} — between</span><input type="time" data-swf="${j}" value="${plEsc(w.f || '')}" style="width:auto;margin:0"> and <input type="time" data-swt="${j}" value="${plEsc(w.t || '')}" style="width:auto;margin:0"><span class="text-sm" style="color:var(--gray-500)">empty = automatic</span></div>`).join('');
}
const roSmSay = (t, bad) => { const m = PLQ('#roSmMsg'); if (m) { m.textContent = t; m.style.color = bad ? '#b42318' : '#0b7a0b'; } };
function roSmCols(o, pl) {
  const LF = [['Region', o.fReg, 'reg'], ['Warehouse', o.fWh, 'wh'], ['Store', o.fSt, 'st']].filter(x => x[1]), nmax = Math.max(1, ...pl.people.map(x => x.slots.length));
  return { LF, H: ['File Nr', 'Name'].concat(LF.map(x => x[0]), ['Job role', 'Shift', 'Working', 'Breaks', 'Break minutes'], Array.from({ length: nmax }, (_, i) => 'Break ' + (i + 1))),
    row: x => [x.p.id, x.p.name || ''].concat(LF.map(f => x.loc[f[2]] || ''), [x.role, x.sh, x.shift, x.slots.length, x.slots.reduce((a, b) => a + b.len, 0)], Array.from({ length: nmax }, (_, i) => x.slots[i] ? x.slots[i].from + '–' + x.slots[i].to : '')) };
}
function roSmSwapOpts(pl, i) { const me = pl.people[i], idx = pl.people.map((x, k) => k).filter(j => j !== i).sort((a, b) => (pl.people[a].gk === me.gk ? 0 : 1) - (pl.people[b].gk === me.gk ? 0 : 1) || String(pl.people[a].p.name).localeCompare(String(pl.people[b].p.name))); return '<option value="">🔁 swap with…</option>' + idx.map(j => { const x = pl.people[j]; return `<option value="${j}">${plEsc(x.p.name || x.p.id)} · ${plEsc(x.role)}${x.gk === me.gk ? '' : ' (other group)'} · ${x.slots.map(s => s.from + '–' + s.to).join(', ')}</option>`; }).join(''); }
const roSmVis = pl => pl.people.map((x, i) => ({ x, i })).filter(v => !pl.fshift || v.x.sh === pl.fshift);
function roSmTop(pl, o, inOverlay, mode) {   // the plan summary: counts, per-role cover table and the swap toolbar — shown in the preview and in the expanded view
  const V = roSmVis(pl), sm = roSmartSummary({ people: V.map(v => v.x), step: pl.step }), shifts = [...new Set(pl.people.map(x => x.sh))], { LF } = roSmCols(o, pl), LH = LF.map(x => `<th>${x[0]}</th>`).join(''), LC = l => LF.map(x => `<td>${plEsc((l || {})[x[2]] || '—')}</td>`).join('');
  return `<div class="text-sm" style="margin:6px 0 4px"><strong>${plEsc(o.shift ? o.shift + ' shift' : 'All shifts')}</strong> · <strong>${V.length}</strong>${V.length !== pl.people.length ? ' of ' + pl.people.length : ''} people · <strong>${pl.n}</strong> slot(s) of ${pl.lens.join(' + ')} min each${pl.skipped.length ? ` · <span style="color:#b42318">${pl.skipped.length} skipped: ${plEsc(pl.skipped.slice(0, 6).join(', '))}${pl.skipped.length > 6 ? '…' : ''}</span>` : ''}${pl.outside.length ? ` · <span style="color:#b26a00">${pl.outside.length} placed outside the chosen time frame (their shift does not reach it): ${plEsc(pl.outside.slice(0, 4).join(', '))}${pl.outside.length > 4 ? '…' : ''}</span>` : ''}</div>`
    + `<div class="fd-wrap" style="max-height:${inOverlay ? 110 : 200}px"><table class="fd-tbl"><thead><tr><th>Shift</th>${LH}<th>Job role</th><th>People</th><th>Most on break together</th><th>At</th><th>Always on duty (at least)</th></tr></thead><tbody>${sm.map(x => `<tr><td>${plEsc(x.sh)}</td>${LC(x.loc)}<td>${plEsc(x.role)}</td><td>${x.n}</td><td${o.cap && x.peak > o.cap ? ' style="color:#b42318;font-weight:700"' : ''}>${x.peak}</td><td>${x.at}</td><td>${x.n - x.peak}</td></tr>`).join('')}</tbody></table></div>`
    + `<div class="btn-row" style="margin:8px 0 2px;align-items:center"><strong class="text-sm">Staff requests a swap?</strong><span class="text-sm" style="color:var(--gray-600)">${mode === 'list' || (ro.smart.view === 'list' && !inOverlay) ? 'choose “swap with…” on a row' : 'click one name in the grid, then the person to swap with'} — the two people exchange all their break slots.</span>${mode !== 'list' && shifts.length > 1 ? `<label class="text-sm" style="display:flex;gap:4px;align-items:center;margin:0 4px">Show shift <select data-rsmshf="1" style="width:auto;margin:0"><option value="">All</option>${shifts.map(sh => `<option ${pl.fshift === sh ? 'selected' : ''}>${plEsc(sh)}</option>`).join('')}</select></label>` : ''}<button class="ghost small" type="button" data-rsmundo="1" ${pl.undo.length ? '' : 'disabled'}>↩ Undo last swap${pl.undo.length ? ' (' + pl.undo.length + ')' : ''}</button>${inOverlay ? '' : `<div class="spacer" style="flex:1"></div><button class="${ro.smart.view === 'grid' ? 'secondary' : 'ghost'} small" type="button" data-rsmview="grid">▦ Grid</button><button class="${ro.smart.view === 'list' ? 'secondary' : 'ghost'} small" type="button" data-rsmview="list">☰ List</button><button class="ghost small" type="button" data-rsmgridfull="1" title="The grid full screen">⤢ Full-screen grid</button>` + (mode !== 'list' && ro.smart.view !== 'list' ? '<button class="ghost small" type="button" data-rsmg="print">🖨 Print</button><button class="ghost small" type="button" data-rsmg="mail">📧 Email</button><button class="ghost small" type="button" data-rsmg="img">🖼 Image</button><button class="ghost small" type="button" data-rsmg="xl">🎨 Excel (colour grid)</button>' : '') + '<button class="secondary small" type="button" data-rsmexpand="1" title="Full screen with a dropdown filter on every column, the swap option, Excel, Print and Email">⤢ Expand · filters · Excel · Print · Email</button>'}</div>${pl.swapMsg ? `<div class="text-sm" style="color:#0b7a0b;margin-bottom:2px">${plEsc(pl.swapMsg)}</div>` : ''}`;
}
function roSmGridModel(pl, o) {   // the plan grid as plain data: the single source for Print, Email, Image and Excel (same layout as the screen)
  const date = o.date || ro.date, V = roSmVis(pl), P = V.map(v => v.x), { LF } = roSmCols(o, pl);
  const BK = P.map(x => ({ list: x.slots.map(s => ({ f: ((s.t % 1440) + 1440) % 1440, d: s.len })), text: x.slots.map(s => s.from + '–' + s.to).join(', ') }));
  const fs = pl.fshift || o.shift || '', own = (x, sl) => roSlotsOf(date, x.p.id).includes(roK(sl)) && roShort(sl.shift) === x.sh;
  const slots = ro.slots.filter(sl => (!fs || roShort(sl.shift) === fs) && P.some(x => own(x, sl)));
  const cols = P.map((x, i) => ({ name: x.p.name || '', id: x.p.id, role: x.role, loc: LF.map(f => x.loc[f[2]] || ''), swapped: !!x.swapped, text: BK[i].text }));
  const rows = slots.map(sl => { const cells = P.map((x, i) => { const on = own(x, sl), full = on && roBrkFull(BK[i], sl), part = on && !full && roBrkOverlap(BK[i], sl) > 0, bb = part ? roBrkBand(BK[i], sl) : null;
      let a = 0, b = 0; if (bb) { const m = bb.style.match(/#f5b041 ([\d.]+)% ([\d.]+)%/); if (m) { a = +m[1]; b = +m[2]; } }
      return { on, st: full ? 'brk' : part ? 'part' : on ? 'on' : '', mins: bb ? bb.mins : 0, a, b, style: bb ? bb.style : '' }; });
    const n = P.filter((x, i) => own(x, sl) && !roBrkFull(BK[i], sl)).length;
    return { label: sl.from + ' – ' + sl.to, shift: roShort(sl.shift), night: /^night/i.test(sl.shift), cells, n }; });
  const hours = P.map((x, i) => { const S = ro.slots.filter(sl => own(x, sl)), gross = S.reduce((a, sl) => a + roDur(sl), 0), bm = S.reduce((a, sl) => a + roBrkOverlap(BK[i], sl), 0); return roNum(Math.max(0, gross - bm / 60), 1); });
  const title = 'Smart break plan', note = `${date} · ${fs || 'All shifts'} · ${P.length} people · ☕ = break, ✔ = on duty, shaded part with minutes = part of the row is break`;
  return { title, note, locHead: LF.map(f => f[1] || f[0] || ''), cols, rows, hours };
}
function roDayGridModel() {   // the Daily availability grid in the same plain model, so it gets the same colour Excel / image / print / email
  const S = roDaily(), rows = ro.slots.filter(roRowOn), BK = {}; S.forEach(p => { BK[p.id] = roBrk(p.id); });
  const cols = S.map(p => ({ name: p.name, id: p.id, role: p.role, loc: [roAreaOf(ro.date, p.id)], swapped: false, text: '' }));
  const outRows = rows.map(sl => { const k = roK(sl), cells = S.map(p => { const on = roSlotsOf(ro.date, p.id).includes(k), full = on && roBrkFull(BK[p.id], sl), part = on && !full && roBrkOverlap(BK[p.id], sl) > 0, bb = part ? roBrkBand(BK[p.id], sl) : null; let a = 0, b = 0; if (bb) { const mm = bb.style.match(/#f5b041 ([\d.]+)% ([\d.]+)%/); if (mm) { a = +mm[1]; b = +mm[2]; } }
      return { on, st: full ? 'brk' : part ? 'part' : on ? 'on' : '', mins: bb ? bb.mins : 0, a, b, style: bb ? bb.style : '' }; });
    return { label: sl.from + ' – ' + sl.to, shift: roShort(sl.shift), night: /^night/i.test(sl.shift), cells, n: S.filter((p, i) => cells[i].on && cells[i].st !== 'brk').length }; });
  return { title: 'Daily availability ' + ro.date, note: `${ro.date} · ${roDow(ro.date)} · ${S.length} staff${ro.shiftSel.length ? ' · ' + ro.shiftSel.join(' + ') : ''} · ☕ = break, ✔ = on duty, shaded part with minutes = part of the row is break`, locHead: ['Working area'], cols, rows: outRows, hours: S.map(p => roNum(roPerson(ro.date, p.id).net, 1)) };
}
function roSmGridPrintHtml(m, forMail) {   // coloured table, inline styles only (works in a print window and in an e-mail)
  const e = plEsc, bd = 'border:1px solid #bbb;', PAL = Object.assign({ on: '#2e9e5b', brk: '#f5b041', symOn: '✔', symBrk: '☕', unit: '′' }, m.pal || {}), LB = Object.assign({ slot: 'Time slot', shift: 'Shift', n: 'Staff on duty', h: 'Hours' }, m.L || {}), C = { on: PAL.on, brk: PAL.brk };
  const th = c => `<th style="${bd}padding:3px 5px;font-size:10px;background:${c.swapped ? '#fff7d6' : '#f1f5f9'};vertical-align:bottom;text-align:center"><div style="font-weight:700">${e(c.name)}</div><div style="color:#555">${e(c.id)}</div><div style="color:#555">${e(c.role)}</div>${c.loc.map(l => `<div style="color:#777">${e(l)}</div>`).join('')}</th>`;
  const cell = c => !c.on ? `<td style="${bd}background:#fff"></td>` : c.st === 'brk' ? `<td style="${bd}background:${C.brk};color:#fff;text-align:center;font-weight:700">${PAL.symBrk}</td>` : c.st === 'part' ? `<td style="${bd}${forMail ? `background:${C.on};` : ''}${c.style};color:#fff;text-align:center;font-size:10px;font-weight:700;text-shadow:0 0 2px #000">${c.mins}${PAL.unit}</td>` : `<td style="${bd}background:${C.on};color:#fff;text-align:center">${PAL.symOn}</td>`;
  return `<table style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:11px"><thead><tr><th style="${bd}padding:3px 6px;background:#f1f5f9">${LB.slot}</th><th style="${bd}padding:3px 6px;background:#f1f5f9">${LB.shift}</th>${m.cols.map(th).join('')}<th style="${bd}padding:3px 6px;background:#f1f5f9">${LB.n}</th></tr></thead><tbody>` +
    m.rows.map(r => `<tr style="${r.night ? 'background:#eef0ff' : ''}"><td style="${bd}padding:2px 6px;white-space:nowrap;font-weight:600">${e(r.label)}</td><td style="${bd}padding:2px 6px">${e(r.shift)}</td>${r.cells.map(cell).join('')}<td style="${bd}text-align:center;font-weight:700">${r.n || ''}</td></tr>`).join('') +
    `<tr style="font-weight:700;background:#f8fafc"><td style="${bd}padding:2px 6px">${LB.h}</td><td style="${bd}"></td>${m.hours.map(h => `<td style="${bd}text-align:center">${h}</td>`).join('')}<td style="${bd}"></td></tr></tbody></table>`;
}
function roSmGridPrint(m) {
  m = m || (roSmLast && roSmGridModel(roSmLast, roSmO)); if (!m) return;
  npOpenPrint(`<!doctype html><html><head><meta charset="utf-8"><title>${plEsc(m.title)}</title><style>@page{size:A3 landscape;margin:8mm}body{font-family:Segoe UI,Arial,sans-serif;margin:8mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}h2{margin:0 0 2px}p{margin:0 0 8px;color:#555;font-size:12px}</style></head><body><h1 style="display:none">${plEsc(m.title)}</h1><h2>${plEsc(m.title)}</h2><p>${plEsc(m.note)} · printed ${new Date().toLocaleString()}</p>${roSmGridPrintHtml(m)}</body></html>`, m.title);
  try { addActivity('export', 'Printed the smart break plan grid'); } catch (e) {}
}
function roSmGridImage(m) {   // draws the grid on a canvas and downloads it as a PNG
  m = m || (roSmLast && roSmGridModel(roSmLast, roSmO)); if (!m) return; const PAL = Object.assign({ on: '#2e9e5b', brk: '#f5b041', symOn: '✔', symBrk: '☕', unit: '′' }, m.pal || {}), LB = Object.assign({ slot: 'Time slot', shift: 'Shift', n: 'Staff on duty', h: 'Hours' }, m.L || {}), sc = 2, nL = m.locHead.length, headRows = 3 + nL, rh = 22, hh = 14, cw = 64, lw = 120, sw = 64, tw = 76, top = 54;
  const W = lw + sw + cw * m.cols.length + tw, H = top + hh * headRows + 8 + rh * (m.rows.length + 1), cv = document.createElement('canvas'); cv.width = W * sc; cv.height = H * sc; const g = cv.getContext('2d'); g.scale(sc, sc);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.font = 'bold 16px Segoe UI,Arial'; g.fillText(m.title, 8, 20); g.font = '11px Segoe UI,Arial'; g.fillStyle = '#555'; g.fillText(m.note, 8, 38);
  const hy = top, HH = hh * headRows + 8, line = '#bbb', fit = (t, w) => { t = String(t); while (t.length > 1 && g.measureText(t).width > w - 4) t = t.slice(0, -1); return t; };
  const box = (x, y, w, h, fill) => { g.fillStyle = fill; g.fillRect(x, y, w, h); g.strokeStyle = line; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, w, h); };
  const txt = (t, x, y, w, o = {}) => { g.font = (o.b ? 'bold ' : '') + (o.s || 10) + 'px Segoe UI,Arial'; g.fillStyle = o.c || '#111'; g.textAlign = o.al || 'center'; g.textBaseline = 'middle'; g.fillText(fit(t, w), o.al === 'left' ? x + 4 : x + w / 2, y); };
  box(0, hy, lw, HH, '#f1f5f9'); txt(LB.slot, 0, hy + HH / 2, lw, { b: 1 }); box(lw, hy, sw, HH, '#f1f5f9'); txt(LB.shift, lw, hy + HH / 2, sw, { b: 1 });
  m.cols.forEach((c, i) => { const x = lw + sw + i * cw; box(x, hy, cw, HH, c.swapped ? '#fff7d6' : '#f1f5f9'); txt(c.name, x, hy + 8, cw, { b: 1, s: 9 }); txt(c.id, x, hy + 8 + hh, cw, { c: '#555', s: 9 }); txt(c.role, x, hy + 8 + hh * 2, cw, { c: '#555', s: 9 }); c.loc.forEach((l, j) => txt(l, x, hy + 8 + hh * (3 + j), cw, { c: '#777', s: 9 })); });
  const tx = lw + sw + cw * m.cols.length; box(tx, hy, tw, HH, '#f1f5f9'); txt(LB.n, tx, hy + HH / 2, tw, { b: 1 });
  m.rows.forEach((r, ri) => { const y = hy + HH + ri * rh; box(0, y, lw, rh, r.night ? '#eef0ff' : '#fff'); txt(r.label, 0, y + rh / 2, lw, { b: 1 }); box(lw, y, sw, rh, r.night ? '#eef0ff' : '#fff'); txt(r.shift, lw, y + rh / 2, sw);
    r.cells.forEach((c, i) => { const x = lw + sw + i * cw; box(x, y, cw, rh, c.on ? PAL.on : '#fff'); if (c.st === 'brk') { g.fillStyle = PAL.brk; g.fillRect(x + 1, y + 1, cw - 1, rh - 1); txt(PAL.symBrk, x, y + rh / 2, cw, { b: 1, c: '#fff', s: 12 }); }
      else if (c.st === 'part') { g.fillStyle = PAL.brk; g.fillRect(x + 1, y + 1 + (rh - 1) * c.a / 100, cw - 1, (rh - 1) * (c.b - c.a) / 100); txt(c.mins + PAL.unit, x, y + rh / 2, cw, { b: 1, c: '#fff', s: 10 }); } else if (c.on) txt(PAL.symOn, x, y + rh / 2, cw, { c: '#fff', s: 11 }); });
    box(tx, y, tw, rh, '#fff'); txt(r.n || '', tx, y + rh / 2, tw, { b: 1 }); });
  const y = hy + HH + m.rows.length * rh; box(0, y, lw, rh, '#f8fafc'); txt(LB.h, 0, y + rh / 2, lw, { b: 1 }); box(lw, y, sw, rh, '#f8fafc'); m.hours.forEach((h, i) => { const x = lw + sw + i * cw; box(x, y, cw, rh, '#f8fafc'); txt(h, x, y + rh / 2, cw, { b: 1 }); }); box(tx, y, tw, rh, '#f8fafc');
  cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${(m.title || 'Grid').replace(/\W+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
  try { addActivity('export', 'Exported the smart break plan grid as an image'); } catch (e) {}
}
function roSmLoadExcelJs() { return window.ExcelJS ? Promise.resolve(window.ExcelJS) : new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'; sc.onload = () => window.ExcelJS ? ok(window.ExcelJS) : no(new Error('ExcelJS did not load')); sc.onerror = () => no(new Error('Could not load the Excel styling library (no internet?)')); document.head.appendChild(sc); }); }
async function roSmGridXlsx(asBase64, m) {   // same layout as the screen, with the colours; ☕ rows are orange, part-slots show the minutes
  m = m || roSmGridModel(roSmLast, roSmO); const PAL = Object.assign({ on: '#2e9e5b', brk: '#f5b041', symOn: '✔', symBrk: '☕', unit: '′' }, m.pal || {}), LB = Object.assign({ slot: 'Time slot', shift: 'Shift', n: 'Staff on duty', h: 'Hours' }, m.L || {}), AR = h => 'FF' + h.replace('#', '').toUpperCase(), EJ = await roSmLoadExcelJs(), wb = new EJ.Workbook(), ws = wb.addWorksheet('Break plan', { views: [{ state: 'frozen', xSplit: 2, ySplit: 3 + m.locHead.length }] });
  const bd = { top: { style: 'thin', color: { argb: 'FFBBBBBB' } }, left: { style: 'thin', color: { argb: 'FFBBBBBB' } }, bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } }, right: { style: 'thin', color: { argb: 'FFBBBBBB' } } }, fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
  const nc = m.cols.length + 3; ws.getCell(1, 1).value = m.title; ws.getCell(1, 1).font = { bold: true, size: 14 }; ws.getCell(2, 1).value = m.note; ws.getCell(2, 1).font = { color: { argb: 'FF555555' } };
  const h0 = 3, heads = [['Time slot', ...m.cols.map(c => c.name), ''], ['', ...m.cols.map(c => c.id), ''], ['', ...m.cols.map(c => c.role), '']];
  const hr = [[LB.slot, LB.shift, ...m.cols.map(c => c.name), LB.n], ['', '', ...m.cols.map(c => c.id), ''], ['', '', ...m.cols.map(c => c.role), '']]; m.locHead.forEach((lh, j) => hr.push(['', '', ...m.cols.map(c => c.loc[j] || ''), '']));
  hr.forEach((r, k) => { const row = ws.getRow(h0 + k); r.forEach((v, i) => { const c = row.getCell(i + 1); c.value = v; c.font = { bold: k === 0 || i < 2, size: 10, color: { argb: k > 1 && i > 1 ? 'FF666666' : 'FF000000' } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = bd; c.fill = fill(i >= 2 && i < nc - 1 && m.cols[i - 2].swapped ? 'FFFFF7D6' : 'FFF1F5F9'); }); });
  const r0 = h0 + hr.length;
  m.rows.forEach((r, ri) => { const row = ws.getRow(r0 + ri); const vals = [r.label, r.shift, ...r.cells.map(c => c.st === 'brk' ? PAL.symBrk : c.st === 'part' ? c.mins + PAL.unit : c.on ? PAL.symOn : ''), r.n || '']; vals.forEach((v, i) => { const c = row.getCell(i + 1); c.value = v; c.border = bd; c.alignment = { horizontal: i < 2 ? 'left' : 'center', vertical: 'middle' }; c.font = { size: 10, bold: i < 1 || i === nc - 1 };
      if (i < 2) c.fill = fill(r.night ? 'FFEEF0FF' : 'FFFFFFFF'); else if (i < nc - 1) { const x = r.cells[i - 2]; c.fill = fill(x.st === 'brk' ? AR(PAL.brk) : x.st === 'part' ? AR(PAL.brk) : x.on ? AR(PAL.on) : 'FFFFFFFF'); if (x.on) c.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; if (x.st === 'part') c.fill = fill(AR(PAL.brk)); } }); });
  const lr = ws.getRow(r0 + m.rows.length); [LB.h, '', ...m.hours, ''].forEach((v, i) => { const c = lr.getCell(i + 1); c.value = v; c.font = { bold: true, size: 10 }; c.border = bd; c.fill = fill('FFF8FAFC'); c.alignment = { horizontal: i < 1 ? 'left' : 'center' }; });
  ws.getColumn(1).width = 16; ws.getColumn(2).width = 9; m.cols.forEach((c, i) => { ws.getColumn(i + 3).width = Math.max(11, Math.min(20, (c.name || '').length * .7 + 4)); }); ws.getColumn(nc).width = 13;
  ws.getRow(h0).height = 30; ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 8 };
  const buf = await wb.xlsx.writeBuffer(); if (asBase64) { let bin = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = `${(m.title || 'Grid').replace(/\W+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { addActivity('export', 'Exported the smart break plan grid to Excel'); } catch (e) {}
}
function roSmGridEmail(m) {
  m = m || (roSmLast && roSmGridModel(roSmLast, roSmO)); if (!m) return;
  window.extMailData = () => ({ title: m.title, sheet: 'Break plan', headers: ['Time slot'], rows: [[m.title]], note: m.note, html: roSmGridPrintHtml(m, true), xl: () => roSmGridXlsx(true, m) }); wMail_open('ext');
}
function roSmGridHtml(pl, o, tall) {   // the plan drawn like the daily availability grid: time slots down, staff across, ☕ = the proposed break
  const date = o.date || ro.date, V = roSmVis(pl), P = V.map(v => v.x), { LF } = roSmCols(o, pl);
  const BK = P.map(x => ({ list: x.slots.map(s => ({ f: ((s.t % 1440) + 1440) % 1440, d: s.len })), text: x.slots.map(s => s.from + '–' + s.to).join(', ') }));
  const fs = pl.fshift || o.shift || '', own = (x, sl) => roSlotsOf(date, x.p.id).includes(roK(sl)) && roShort(sl.shift) === x.sh;   // only the rows of the chosen attendance shift
  const rows = ro.slots.filter(sl => (!fs || roShort(sl.shift) === fs) && P.some(x => own(x, sl)));
  const head = P.map((x, i) => `<th data-pi="${V[i].i}" title="${plEsc((x.p.name || '') + ' · ' + x.p.id + ' · ' + x.role + ' · breaks ' + BK[i].text + ' — click to swap')}" style="cursor:pointer;${pl.pick === V[i].i ? 'background:#cfe3ff;outline:2px solid #2f6fdd;outline-offset:-2px;' : x.swapped ? 'background:#fff7d6;' : ''}"><div class="ro-sn">${plEsc(x.p.name || '')}</div><div class="ro-role">${plEsc(x.p.id)}</div><div class="ro-role">${plEsc(x.role)}</div>${LF.map(f => `<div class="ro-role ro-area">${plEsc(x.loc[f[2]] || '')}</div>`).join('')}</th>`).join('');
  const body = rows.map(sl => { const k = roK(sl), n = P.filter((x, i) => own(x, sl) && !roBrkFull(BK[i], sl)).length;
    return `<tr class="${/^night/i.test(sl.shift) ? 'night' : ''}"><td class="ro-l">${sl.from} – ${sl.to}</td><td class="ro-sh">${plEsc(roShort(sl.shift))}</td>${P.map((x, i) => { const on = own(x, sl), full = on && roBrkFull(BK[i], sl), part = on && !full && roBrkOverlap(BK[i], sl) > 0, bb = part ? roBrkBand(BK[i], sl) : null; return `<td class="ro-c ${on ? 'on' : ''}${full ? ' brk' : part ? ' brkp' : ''}"${bb ? ` style="${bb.style}"` : ''}${full ? ` title="Break ${BK[i].text}"` : part ? ` title="${bb ? bb.mins + ' min of this slot are break time' : 'Part of the slot is break time'} (${BK[i].text})"` : ''}>${full ? '☕' : bb ? `<span class="ro-bm">${bb.mins}′</span>` : on ? '✔' : ''}</td>`; }).join('')}<td class="ro-t">${n || ''}</td></tr>`; }).join('');
  const hrs = P.map((x, i) => { const S = ro.slots.filter(sl => own(x, sl)), gross = S.reduce((a, sl) => a + roDur(sl), 0), bm = S.reduce((a, sl) => a + roBrkOverlap(BK[i], sl), 0); return `<td class="ro-t" title="${roNum(gross, 1)} h on site − ${bm} min break">${roNum(Math.max(0, gross - bm / 60), 1)}</td>`; }).join('');
  return `<div class="ro-grid" style="${tall ? 'flex:1;min-height:0;max-height:none' : 'max-height:70vh'}"><table class="no-rn" style="width:100%"><thead><tr><th class="ro-l">Time slot</th><th class="ro-sh">Shift</th>${head}<th class="ro-t">Staff on duty</th></tr></thead><tbody>${body}<tr><td class="ro-l ro-t">Hours</td><td class="ro-sh ro-t"></td>${hrs}<td class="ro-t"></td></tr></tbody></table></div>`;
}
function roSmDraw(pl, o) {
  const { H, row } = roSmCols(o, pl), warn = o.cap ? roSmartSummary({ people: roSmVis(pl).map(v => v.x), step: pl.step }).filter(x => x.peak > o.cap).length : 0, grid = ro.smart.view !== 'list';
  PLQ('#roSmOut').innerHTML = roSmTop(pl, o, false) + (grid ? roSmGridHtml(pl, o, false) : `<div class="fd-wrap" style="max-height:340px;margin-top:4px"><table class="fd-tbl"><thead><tr>${H.map(h => `<th>${plEsc(h)}</th>`).join('')}<th>Swap</th></tr></thead><tbody>${roSmVis(pl).map(({ x, i }) => `<tr${x.swapped ? ' style="background:#fff7d6"' : ''}>${row(x).map(v => `<td>${plEsc(v)}</td>`).join('')}<td><select data-sw="${i}" style="width:auto;max-width:230px;margin:0">${roSmSwapOpts(pl, i)}</select></td></tr>`).join('')}</tbody></table></div>`);
  roSmSay((pl.pick != null ? `Now click the person to swap ${pl.people[pl.pick].p.name || ''} with (click the same name again to cancel). ` : '') + (pl.swapMsg ? pl.swapMsg + ' ' : '') + pl.notes.join(' ') + (warn ? ` ${warn} role(s) exceed the limit of ${o.cap} on break together — raise the limit or add slots.` : ' Looks good — press Apply to write these breaks.'), !!warn); PLQ('#roSmApply').disabled = false;
  roSmOvSync(); roSmGridOvFill();
}
function roSmPick(i) { const pl = roSmLast; if (!pl) return; if (pl.pick == null) pl.pick = i; else if (pl.pick === i) pl.pick = null; else { const a = pl.pick; pl.pick = null; roSmDoSwap(a, i); return; } roSmDraw(pl, roSmO); }
function roSmGridOvFill() {
  const ov = document.querySelector('#roSmGridModal'); if (!ov || ov.style.display !== 'flex' || !roSmLast) return; const pl = roSmLast, o = roSmO;
  document.querySelector('#roSmGridOvBody').innerHTML = roSmTop(pl, o, true) + (pl.pick != null ? `<div class="text-sm" style="color:#2f6fdd;margin:2px 0">Now click the person to swap ${plEsc(pl.people[pl.pick].p.name || '')} with.</div>` : '') + roSmGridHtml(pl, o, true);
}
function roSmGridOvOpen() {
  if (!roSmLast) return; let ov = document.querySelector('#roSmGridModal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'roSmGridModal'; ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:100000;background:var(--card);color:inherit;flex-direction:column;'; ov.innerHTML = '<div style="display:flex;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border)"><strong>▦ Smart break plan</strong><span id="roSmGridTitle" class="text-sm"></span><span class="text-sm" style="color:var(--gray-600)">☕ = proposed break · click two names to swap</span><div style="flex:1"></div><button type="button" class="ghost small" id="roSmGridPrint">🖨 Print</button><button type="button" class="ghost small" id="roSmGridMail">📧 Email</button><button type="button" class="ghost small" id="roSmGridImg">🖼 Image</button><button type="button" class="ghost small" id="roSmGridXl">📊 Excel</button><button type="button" class="ghost small" id="roSmGridClose">✖ Close</button></div><div id="roSmGridOvBody" style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:8px 14px"></div>'; document.body.appendChild(ov); ov.querySelector('#roSmGridClose').addEventListener('click', () => { ov.style.display = 'none'; }); ov.querySelector('#roSmGridPrint').addEventListener('click', () => roSmGridPrint()); ov.querySelector('#roSmGridMail').addEventListener('click', () => roSmGridEmail()); ov.querySelector('#roSmGridImg').addEventListener('click', () => roSmGridImage()); ov.querySelector('#roSmGridXl').addEventListener('click', () => roSmGridXlsx(false).catch(e => { try { sectionToast('Excel export failed: ' + e.message, 'warn'); } catch (x) { alert(e.message); } })); document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.style.display === 'flex' && document.getElementById('tblExpandOverlay').style.display !== 'flex') ov.style.display = 'none'; }); }
  if (!document.querySelector('#roSmGridCss')) { const st = document.createElement('style'); st.id = 'roSmGridCss'; st.textContent = '#roSmGridOvBody>*:not(.ro-grid){flex:none}#roSmGridOvBody .ro-grid{border:1px solid var(--border)}'; document.head.appendChild(st); }
  ov.style.display = 'flex'; roSmGridOvFill();
}
const roSmFits = (pe, sl) => pe.segs.some(sg => [-1440, 0, 1440].some(k => sl.t + k >= sg[0] && sl.t + k + sl.len <= sg[1]));
function roSmDoSwap(i, j, sel) {
  const pl = roSmLast, A = pl && pl.people[i], B = pl && pl.people[j]; if (!A || !B) return;
  const bad = [[A, B.slots], [B, A.slots]].filter(([pe, sl]) => sl.some(x => !roSmFits(pe, x))).map(([pe]) => pe.p.name || pe.p.id);
  if (bad.length && !confirm(`After the swap, ${bad.join(' and ')} would be on break outside their own working hours. Swap anyway?`)) { if (sel) sel.value = ''; roSmDraw(pl, roSmO); return; }
  const t = A.slots; A.slots = B.slots; B.slots = t; A.swapped = B.swapped = true; pl.undo.push([i, j]); pl.swapMsg = `🔁 ${A.p.name || A.p.id} ⇄ ${B.p.name || B.p.id} swapped.`; roSmDraw(pl, roSmO);
}
function roSmUndo() { const pl = roSmLast; if (!pl || !pl.undo.length) return; const [i, j] = pl.undo.pop(), A = pl.people[i], B = pl.people[j], t = A.slots; A.slots = B.slots; B.slots = t; pl.people.forEach(x => { x.swapped = false; }); pl.undo.forEach(([a, b]) => { pl.people[a].swapped = pl.people[b].swapped = true; }); pl.swapMsg = '↩ Swap undone.'; roSmDraw(pl, roSmO); }
function roSmOvOpen() { const ov = document.getElementById('tblExpandOverlay'); return ov && ov.style.display === 'flex' && ov.dataset.src === 'roSmPlanTbl'; }
function roSmOvSync() {   // keep the expanded view in step after a swap / undo (cells, swap lists and the summary on top)
  if (!roSmOvOpen() || !roSmLast) return; const pl = roSmLast, o = roSmO, { row } = roSmCols(o, pl), t = document.querySelector('#teBody table'); if (!t) return;
  Array.from(t.tBodies).flatMap(b => Array.from(b.rows)).forEach(tr => { const i = +tr.dataset.i, x = pl.people[i]; if (!x) return; const v = row(x); tr.style.background = x.swapped ? '#fff7d6' : ''; v.forEach((val, k) => { if (tr.cells[k]) tr.cells[k].textContent = val; }); const sc = tr.cells[tr.cells.length - 1]; sc.innerHTML = `<select data-sw="${i}" style="width:auto;max-width:230px;margin:0">${roSmSwapOpts(pl, i)}</select>`; });
  const x = document.getElementById('teExtra'); if (x) { x.innerHTML = roSmTop(pl, o, true, 'list'); x.style.display = ''; x.dataset.rsm = '1'; }
}
function roSmExpand() {   // the plan in the full-screen view: dropdown filter on every column, swap, Excel, Print, Email
  const pl = roSmLast, o = roSmO; if (!pl || !pl.people.length) return; if (typeof window.tableExpandOpen !== 'function') return sectionToast('The full-screen view is not available.', 'warn');
  const { H, row } = roSmCols(o, pl), tb = document.createElement('table'); tb.id = 'roSmPlanTbl';
  tb.innerHTML = '<thead><tr>' + H.map(h => '<th>' + plEsc(h) + '</th>').join('') + '<th data-noexport="1">Swap</th></tr></thead><tbody>' + roSmVis(pl).map(({ x, i }) => `<tr data-i="${i}">` + row(x).map(v => '<td>' + plEsc(v == null ? '' : String(v)) + '</td>').join('') + '<td data-noexport="1"></td></tr>').join('') + '</tbody>';
  window.tableExpandOpen(tb); const t = document.getElementById('teTitle'); if (t) t.textContent = '⤢ Smart break plan · ' + (o.shift || 'All') + ' shift · ' + (o.date || ro.date) + ' · ' + pl.people.length + ' staff'; roSmOvSync();
}
function roSmartWire(q) {
  const S = ro.smart, g = id => q(id), num = (id, d) => { const v = parseFloat(g(id).value); return isFinite(v) ? v : d; };
  const fillUi = () => { g('#roSmDate').value = S.date || ro.date || ''; g('#roSmTotal').value = S.total; g('#roSmCommit').value = S.commit ? '1' : '0'; g('#roSmAlign').checked = S.align !== false; g('#roSmN').value = S.n; g('#roSmMin').value = S.min; g('#roSmMax').value = S.max; g('#roSmStep').value = String(S.step); g('#roSmMargin').value = S.margin; g('#roSmWf').value = S.wf; g('#roSmWt').value = S.wt; g('#roSmCap').value = S.cap; }; fillUi(); roSmartRoles(); roSmSlotWinUi();
  const syncCommit = () => { const c = g('#roSmCommit').value === '1'; g('#roSmTotal').disabled = g('#roSmMax').disabled = c; g('#roSmTotal').title = g('#roSmMax').title = c ? 'Not used — every slot is exactly the minimum' : ''; }; syncCommit(); g('#roSmCommit').addEventListener('change', () => { read(); syncCommit(); roSmSlotWinUi(); });
  ['#roSmTotal', '#roSmN', '#roSmMin', '#roSmMax'].forEach(id => g(id).addEventListener('input', () => { read(); roSmSlotWinUi(); })); g('#roSmStep').addEventListener('change', () => { read(); roSmSlotWinUi(); });
  g('#roSmSlotWin').addEventListener('input', e => { const t = e.target, j = t.dataset.swf != null ? +t.dataset.swf : t.dataset.swt != null ? +t.dataset.swt : -1; if (j < 0) return; S.sw[j] = S.sw[j] || { f: '', t: '' }; if (t.dataset.swf != null) S.sw[j].f = t.value; else S.sw[j].t = t.value; roSave(); });
  if (!window.__roSmDoc) { window.__roSmDoc = 1; document.addEventListener('click', e => { const th = e.target.closest('th[data-pi]'), vw = e.target.closest('[data-rsmview]'); if (th && (th.closest('#roSmOut') || th.closest('#roSmGridModal'))) roSmPick(+th.dataset.pi); else if (vw) { ro.smart.view = vw.dataset.rsmview; roSave(); if (roSmLast) roSmDraw(roSmLast, roSmO); } else if (e.target.closest('[data-rsmgridfull]')) roSmGridOvOpen(); else if (e.target.closest('[data-rsmg]')) { const k = e.target.closest('[data-rsmg]').dataset.rsmg; if (k === 'print') roSmGridPrint(); else if (k === 'mail') roSmGridEmail(); else if (k === 'img') roSmGridImage(); else roSmGridXlsx(false).catch(x => sectionToast('Excel export failed: ' + x.message, 'warn')); } else if (e.target.closest('[data-rsmundo]')) roSmUndo(); else if (e.target.closest('[data-rsmexpand]')) roSmExpand(); }); document.addEventListener('change', e => { const sf = e.target.closest && e.target.closest('select[data-rsmshf]'); if (sf && roSmLast) { roSmLast.fshift = sf.value; roSmDraw(roSmLast, roSmO); return; } const sel = e.target.closest && e.target.closest('select[data-sw]'); if (sel && sel.value && (sel.closest('#roSmOut') || sel.closest('#tblExpandOverlay'))) roSmDoSwap(+sel.dataset.sw, +sel.value, sel); }); }
  const read = () => { Object.assign(S, { shift: g('#roSmShift').value, date: g('#roSmDate').value, total: num('#roSmTotal', 60), n: Math.max(1, Math.round(num('#roSmN', 2))), commit: g('#roSmCommit').value === '1', align: g('#roSmAlign').checked, min: num('#roSmMin', 30), max: num('#roSmMax', 60), step: num('#roSmStep', 15), margin: num('#roSmMargin', 120), wf: g('#roSmWf').value, wt: g('#roSmWt').value, cap: Math.max(0, Math.round(num('#roSmCap', 0))), sw: S.sw, fReg: g('#roSmFReg').value, fWh: g('#roSmFWh').value, fSt: g('#roSmFSt').value, perLoc: g('#roSmPerLoc').checked }); roSave(); return Object.assign({}, S, { sw: (S.sw || []).map(w => Object.assign({}, w)), roles: S.roles.slice(), regions: S.regions.slice(), whs: S.whs.slice(), stores: S.stores.slice() }); };
  ['#roSmFReg', '#roSmFWh', '#roSmFSt'].forEach(id => g(id).addEventListener('change', () => { read(); S.regions = []; S.whs = []; S.stores = []; roSave(); roSmLocUi(true); })); g('#roSmPerLoc').addEventListener('change', read); g('#roSmAlign').addEventListener('change', read);
  const msg = (t, bad) => { const m = g('#roSmMsg'); m.textContent = t; m.style.color = bad ? '#b42318' : '#0b7a0b'; };
  g('#roSmPrev').addEventListener('click', () => {
    const o = read(); if (!o.commit && o.min > o.max) return msg('The minimum slot cannot be longer than the maximum.', true); const plan = roSmartPlan(o); roSmLast = null; g('#roSmApply').disabled = true; g('#roSmOut').innerHTML = '';
    if (plan.err) return msg(plan.err, true); if (!plan.people.length) return msg('Nobody is working the ' + o.shift + ' shift on ' + (o.date || ro.date) + ' for these roles — pick another date or fill the availability first.', true);
    roSmLast = plan; roSmO = o; plan.undo = []; roSmDraw(plan, o);
  });
  g('#roSmApply').addEventListener('click', () => { if (!roSmLast) return; const pl = roSmLast; if (!confirm(`Set the break slots of ${pl.people.length} people? Their current own break slots are replaced.`)) return; pl.people.forEach(x => { x.p.brk = x.slots.map(s => ({ from: s.from, to: s.to })); }); roSave(); roRender(); g('#roSmApply').disabled = true; msg(`✓ Break slots set for ${pl.people.length} people.`); addActivity('edit', `Roster: smart break plan applied to ${pl.people.length} staff`); });
}
