/* ============================================================
   JOB-TITLE PROFILES — the side panel opens the sections that belong to the user's job title
   (Logistics · Storekeeper · Assistant Storekeeper · Fleet · Project · Planning). The admin edits the profiles on the Users page;
   they are kept in this browser and published to the SharePoint list App_Config_tbl (Title = TitleProfiles, Config_Value = JSON)
   so every user gets the same setup. A section the admin switched on / off for one user (🧭 Sections) always wins over the profile.
   Admins are never restricted. Also holds the Location ID → Warehouse name table.
   ============================================================ */
const TP_KEY = LS_BASE + '_tprof', TP_LIST = 'App_Config_tbl', TP_ITEM = 'TitleProfiles';
const TP_DEFAULT = { v: 1, names: {}, profiles: [
  { id: 'asst', name: 'Assistant Storekeeper', titles: 'assistant, asst, helper, forklift', groups: ['Data', 'Warehouse', 'RMPM Warehouse', 'Warehouse Locations', 'FOC Vouchers'] },
  { id: 'log', name: 'Logistics', titles: 'logistic', groups: ['Data', 'Logistics', 'F&D Plan', 'Daily Plan', 'Fleet'] },
  { id: 'fleet', name: 'Fleet', titles: 'fleet, tech, mechanic, driver', groups: ['Data', 'Fleet', 'Logistics'] },
  { id: 'prj', name: 'Project', titles: 'project', groups: ['Data', 'Projects'] },
  { id: 'plan', name: 'Planning', titles: 'planner, planning', groups: ['Data', 'Planning Dept.', 'Daily Plan', 'F&D Plan', 'Milco Daily Planning', 'List Analytics', 'Management Report'] },
  { id: 'store', name: 'Storekeeper', titles: 'storekeeper, store, warehouse, whs', groups: ['Data', 'Warehouse', 'RMPM Warehouse', 'Warehouse Locations', 'FOC Vouchers', 'Milco Daily Planning', 'List Analytics', 'Staff Roster', 'Staff Attendance'] }] };
const tpClone = o => JSON.parse(JSON.stringify(o));
function tpCfg() { try { const j = JSON.parse(localStorage.getItem(TP_KEY) || 'null'); if (j && Array.isArray(j.profiles) && j.profiles.length) return Object.assign({ names: {} }, j); } catch (e) {} return tpClone(TP_DEFAULT); }
function tpSaveLocal(c) { try { localStorage.setItem(TP_KEY, JSON.stringify(c)); } catch (e) {} }
function tpProfileFor(u) {
  if (!u || u.role === 'admin' || u.builtin) return null; const c = tpCfg();
  const sp = String(u.spProfile || '').trim().toLowerCase();   /* WebSys_AccessProfile in the SharePoint login list wins */
  if (sp) { if (/^(none|all|no profile)$/.test(sp)) return null; const h = c.profiles.find(p => p.name.trim().toLowerCase() === sp || p.id.toLowerCase() === sp); if (h) return h; }
  if (u.profileId === 'none') return null; if (u.profileId) return c.profiles.find(p => p.id === u.profileId) || null;
  return tpMatchTitle(u.jobTitle, c);
}
function tpMatchTitle(title, c) { const t = String(title || '').toLowerCase(); if (!t) return null; c = c || tpCfg();
  return c.profiles.find(p => String(p.titles || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).some(k => t.includes(k))) || null; }
const tpIdOf = name => { const n = String(name || '').trim().toLowerCase(); if (!n) return ''; if (/^(none|all|no profile)$/.test(n)) return 'none'; const h = tpCfg().profiles.find(p => p.name.trim().toLowerCase() === n || p.id.toLowerCase() === n); return h ? h.id : ''; };
function tpSetUserProfile(u) { const id = u.profileId || ''; u.spProfile = id === 'none' ? 'None' : id ? ((tpCfg().profiles.find(p => p.id === id) || {}).name || '') : ''; }
const tpLabel = u => { const p = tpProfileFor(u); return p ? p.name : ''; };
function tpViews(p) { const s = new Set(['home', 'help']); const orig = navCapture(); (p.groups || []).forEach(n => { const g = orig.groups.find(x => x.name === n); if (g) g.items.forEach(v => s.add(v)); }); return s; }
function tpAllows(u, view) { const p = tpProfileFor(u); return !p || tpViews(p).has(view); }
const _tpLevel = acLevel;
acLevel = function (view) { const b = _tpLevel(view); if (b === 'none') return b; const u = currentUser; if (!u || u.role === 'admin') return b; if (view in (u.viewAccess || {})) return b; return tpAllows(u, view) ? b : 'none'; };
const _tpApply = acApplyNav;
acApplyNav = function () {
  _tpApply();
  try { const u = currentUser, p = tpProfileFor(u); if (!p) return; const ok = tpViews(p), ov = u.viewAccess || {};
    document.querySelectorAll('.nav-item[data-view]').forEach(el => { const v = el.dataset.view; if (v in ov || ok.has(v)) return; el.style.display = 'none'; el.classList.add('locked'); el.style.pointerEvents = 'none'; });
    document.querySelectorAll('.sidebar-nav .nav-sub').forEach(g => { g.style.display = [...g.querySelectorAll('.nav-item')].some(n => n.style.display !== 'none') ? '' : 'none'; }); document.querySelectorAll('.sidebar-nav .nav-group').forEach(g => { g.style.display = [...g.querySelectorAll('.nav-item')].some(n => n.style.display !== 'none') ? '' : 'none'; }); } catch (e) {}
};
function tpFillSelect(sel, user) { if (!sel) return; const c = tpCfg(); sel.innerHTML = '<option value="">Auto (by job title' + (user && tpLabel(Object.assign({}, user, { profileId: '' })) ? ' → ' + tpLabel(Object.assign({}, user, { profileId: '' })) : '') + ')</option><option value="none">No profile — everything his role allows</option>' + c.profiles.map(p => '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</option>').join(''); sel.value = user && (user.profileId || tpIdOf(user.spProfile)) || ''; }
function tpRefresh() { try { navApply(true); } catch (e) {} try { locBadge(); } catch (e) {} try { if (activeViewId() === 'home' && window.homeRender) window.homeRender(); } catch (e) {} try { tpRender(); } catch (e) {} }
/* ---- central copy in SharePoint ---- */
async function tpCtx() { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) return null; const r = await resolveIds(site, TP_LIST, token); try { await fetchColumns(r.siteId, r.listId, token); } catch (e) {} return Object.assign({ token }, r); }
async function tpPull(silent) {
  try { const c = await tpCtx(); if (!c) return false; const it = (await fetchAllItems(c.siteId, c.listId, c.token)).find(x => String((x.fields || {}).Title || '').trim() === TP_ITEM); if (!it) { if (!silent) sectionToast('No “' + TP_ITEM + '” row in ' + TP_LIST + ' yet.', 'warn'); return false; }
    const j = JSON.parse(String((it.fields || {}).Config_Value || '')); if (!j || !Array.isArray(j.profiles)) return false; tpSaveLocal(Object.assign({ names: {} }, j)); tpRefresh(); if (!silent) sectionToast('✔ Profiles loaded from SharePoint.', 'success'); return true; }
  catch (e) { if (!silent) sectionToast('Could not read ' + TP_LIST + ': ' + e.message, 'warn'); return false; }
}
async function tpPush(cfg) {
  const c = await tpCtx(); if (!c) throw new Error('sign in / Site URL is not ready'); const its = await fetchAllItems(c.siteId, c.listId, c.token), ex = its.find(x => String((x.fields || {}).Title || '').trim() === TP_ITEM), val = JSON.stringify(cfg);
  if (ex) await updateItem(c.siteId, c.listId, ex.id, spCoerceFields(c.listId, { Config_Value: val }), c.token); else await createItem(c.siteId, c.listId, { Title: TP_ITEM, Config_Value: val }, c.token);
}
/* ---- the staff's own profile in the SharePoint login list (column WebSys_AccessProfile) ---- */
const TP_FIELD = 'WebSys_AccessProfile';
async function lulCtx() { const c = lulCfg(), token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in / Site URL is not ready'); const r = await resolveIds(site, c.list, token); window.__locSkipList = r.listId; try { await fetchColumns(r.siteId, r.listId, token); } catch (e) {} return { token, c, siteId: r.siteId, listId: r.listId, T: (window.SP_COLT || {})[r.listId] || {} }; }
const lulCol = (T, want) => Object.keys(T).find(n => lulNorm(n) === lulNorm(want)) || null;
async function tpSaveUserToSP(user, withLoc) {   /* write this user's profile (and Location ID) into his LoginUserList row(s) */
  try { const x = await lulCtx(), items = await fetchAllItems(x.siteId, x.listId, x.token), ids = [user.username, user.email].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
    const rows = items.filter(it => { const f = it.fields || {}; return lulUserKeys(f, x.c.user).some(k => lulVals(f[k]).some(v => ids.includes(String(v).trim().toLowerCase()))); });
    if (!rows.length) return sectionToast('Saved here — but no row for ' + user.username + ' was found in ' + x.c.list + '.', 'warn');
    const upd = {}, miss = [], pc = lulCol(x.T, TP_FIELD); if (pc) upd[pc] = user.spProfile || ''; else miss.push(TP_FIELD);
    if (withLoc) { const lc = lulCol(x.T, 'Location_ID'); if (lc && String(user.locationId || '').trim() !== '') upd[lc] = String(user.locationId).trim(); else if (!lc) miss.push('Location_ID'); }
    if (!Object.keys(upd).length) return sectionToast('Saved here — column ' + miss.join(', ') + ' does not exist in ' + x.c.list + '.', 'warn');
    for (const it of rows) await updateItem(x.siteId, x.listId, it.id, spCoerceFields(x.listId, upd), x.token);
    sectionToast('✔ ' + user.username + ' saved in ' + x.c.list + (miss.length ? ' (column ' + miss.join(', ') + ' is missing)' : '') + '.', miss.length ? 'warn' : 'success'); }
  catch (e) { sectionToast('Saved here only — SharePoint: ' + e.message, 'warn'); }
}
async function tpApplyStaff(overwrite, say) {   /* give every staff row without a profile the profile of his job title */
  const x = await lulCtx(), pc = lulCol(x.T, TP_FIELD); if (!pc) throw new Error('the list ' + x.c.list + ' has no column “' + TP_FIELD + '” — add it (Single line of text) first'); const items = await fetchAllItems(x.siteId, x.listId, x.token), cfg = tpClone(tpDraft || tpCfg()), todo = [], per = {}; let keep = 0, none = 0;
  items.forEach(it => { const f = it.fields || {}, tk = Object.keys(f).find(k => lulNorm(k) === 'title'), title = tk ? String(f[tk] || '') : '', cur = String(f[pc] || '').trim(), p = tpMatchTitle(title, cfg);
    if (cur && !overwrite) { keep++; return; } if (!p) { none++; return; } if (cur === p.name) { keep++; return; } todo.push({ it, name: p.name }); per[p.name] = (per[p.name] || 0) + 1; });
  if (!todo.length) { say('Nothing to write — ' + keep + ' already have a profile, ' + none + ' have a title that matches no profile.'); return; }
  if (!(await spAsk('Write the access profile into ' + todo.length + ' staff row(s) of ' + x.c.list + '?\n' + Object.entries(per).map(([k, v]) => k + ': ' + v).join(' · ') + (keep ? '\nLeft as they are: ' + keep : '') + (none ? '\nNo matching profile (left empty): ' + none : '')))) return;
  let ok = 0, fail = 0, i = 0; const w = async () => { while (i < todo.length) { const t = todo[i++]; try { await updateItem(x.siteId, x.listId, t.it.id, spCoerceFields(x.listId, { [pc]: t.name }), x.token); ok++; } catch (e) { fail++; } say('Writing… ' + (ok + fail) + ' / ' + todo.length); } };
  await Promise.all([w(), w(), w()]); say(fail ? '⚠ ' + ok + ' written, ' + fail + ' failed.' : '✅ Profile written for ' + ok + ' staff in ' + x.c.list + '.');
}
/* ---- Users page: editor ---- */
let tpDraft = null;
function tpRender() {
  const host = document.querySelector('#tpHost'); if (!host) return; if (!tpDraft) tpDraft = tpClone(tpCfg()); const d = tpDraft, groups = navCapture().groups.map(g => g.name).filter(n => n !== 'Main');
  host.innerHTML = '<div class="fd-wrap"><table class="fd-tbl no-rn"><thead><tr><th style="width:150px">Profile</th><th style="width:210px">Job-title words (comma separated)</th><th>Sections that open</th><th></th></tr></thead><tbody>' + d.profiles.map((p, i) => '<tr data-i="' + i + '"><td><input data-k="name" value="' + escapeHtml(p.name) + '"></td><td><input data-k="titles" value="' + escapeHtml(p.titles) + '"></td><td>' + groups.map(n => '<label style="display:inline-flex;gap:4px;align-items:center;margin:2px 10px 2px 0;font-size:12px"><input type="checkbox" data-g="' + escapeHtml(n) + '" style="width:auto" ' + ((p.groups || []).includes(n) ? 'checked' : '') + '>' + escapeHtml(n) + '</label>').join('') + '</td><td><button class="ghost small" type="button" data-a="delprof" title="Delete this profile">✕</button></td></tr>').join('') + '</tbody></table></div><div class="btn-row" style="margin-top:8px"><button class="secondary small" type="button" data-a="addprof">➕ Add profile</button><span class="text-sm">The profile <b>name</b> is what is stored in each staff row (SharePoint column <code>' + TP_FIELD + '</code>).</span></div>' +
    '<div style="margin-top:12px"><b>📍 Warehouse names</b> <span class="text-sm">— Location ID → name shown next to the user (a name read from his SharePoint row wins)</span><div id="tpNames" style="margin-top:6px"></div><button class="ghost small" type="button" data-a="addname">➕ Add location</button></div>' +
    '<div class="btn-row" style="margin-top:12px"><button class="success" type="button" data-a="save">💾 Save for everyone</button><button class="secondary small" type="button" data-a="pull">⬇ Load from SharePoint</button><button class="ghost small" type="button" data-a="reset">↺ Default profiles</button><button class="secondary small" type="button" data-a="staff">⬆ Write profiles to staff in SharePoint</button><label class="text-sm" style="display:inline-flex;gap:5px;align-items:center"><input type="checkbox" id="tpOver" style="width:auto"> also replace profiles already set</label><span class="text-sm" id="tpStatus"></span></div>';
  const nm = host.querySelector('#tpNames'), rows = Object.entries(d.names || {}); nm.innerHTML = rows.map(([k, v]) => '<div style="display:flex;gap:6px;margin:3px 0"><input data-nk="' + escapeHtml(k) + '" value="' + escapeHtml(k) + '" placeholder="ID" style="width:80px"><input data-nv="' + escapeHtml(k) + '" value="' + escapeHtml(v) + '" placeholder="Warehouse name" style="width:260px"><button class="ghost small" type="button" data-a="delname" data-k="' + escapeHtml(k) + '">✕</button></div>').join('') || '<div class="text-sm">No names yet.</div>';
}
(function () {
  let done = false, busy = false;
  function card() { const t = document.querySelector('#usersTableBody'); return t && t.closest('.card'); }
  function mount() { const c = card(); if (!c || done || c.querySelector('#tpCard')) return; done = true; const d = document.createElement('div'); d.id = 'tpCard'; d.style.cssText = 'border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin:10px 0';
    d.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>🧭 Default sections by job title</b> <span style="font-size:11px;color:var(--gray-500)">(build V88 – 3D rack cells and utilisation)</span><button class="ghost small" type="button" id="tpTog">▸ Open</button></div><div class="text-sm" style="margin:4px 0 0">Each user\'s side panel opens the sections of his job-title profile. You can still switch single sections on / off per user (🧭 Sections) or pick another profile in the user\'s Edit window. Saved copies live in SharePoint list <code>' + TP_LIST + '</code> (columns <code>Title</code>, <code>Config_Value</code> = multiple lines of text).</div><div id="tpHost" style="display:none;margin-top:10px"></div>';
    const t = c.querySelector('.table-wrap'); if (t) t.parentNode.insertBefore(d, t);
    d.querySelector('#tpTog').addEventListener('click', e => { const h = d.querySelector('#tpHost'), o = h.style.display === 'none'; h.style.display = o ? '' : 'none'; e.target.textContent = o ? '▾ Close' : '▸ Open'; if (o) { tpDraft = null; tpRender(); } });
    d.addEventListener('input', e => { const t = e.target, tr = t.closest('tr[data-i]'); if (tr && t.dataset.k) tpDraft.profiles[+tr.dataset.i][t.dataset.k] = t.value; if (t.dataset.nk !== undefined || t.dataset.nv !== undefined) { const o = {}; d.querySelectorAll('#tpNames > div').forEach(r => { const k = r.querySelector('[data-nk]').value.trim(), v = r.querySelector('[data-nv]').value.trim(); if (k) o[k] = v; }); tpDraft.names = o; } });
    d.addEventListener('change', e => { const t = e.target, tr = t.closest('tr[data-i]'); if (tr && t.dataset.g) { const p = tpDraft.profiles[+tr.dataset.i], s = new Set(p.groups || []); t.checked ? s.add(t.dataset.g) : s.delete(t.dataset.g); p.groups = [...s]; } });
    d.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, st = { set textContent(t) { const e = d.querySelector('#tpStatus'); if (e) e.textContent = t; } };
      if (a === 'addname') { const rows = d.querySelector('#tpNames'), div = document.createElement('div'); div.style.cssText = 'display:flex;gap:6px;margin:3px 0'; div.innerHTML = '<input data-nk="" placeholder="ID" style="width:80px"><input data-nv="" placeholder="Warehouse name" style="width:260px"><button class="ghost small" type="button" data-a="delname">✕</button>'; if (!rows.querySelector('input')) rows.innerHTML = ''; rows.appendChild(div); return; }
      if (a === 'delname') { const r = b.closest('div'); r.remove(); const o = {}; d.querySelectorAll('#tpNames > div').forEach(r2 => { const k = r2.querySelector('[data-nk]'), v = r2.querySelector('[data-nv]'); if (k && k.value.trim()) o[k.value.trim()] = v.value.trim(); }); tpDraft.names = o; return; }
      if (a === 'addprof') { tpDraft.profiles.push({ id: 'p' + Date.now().toString(36), name: 'New profile', titles: '', groups: ['Data'] }); return tpRender(); }
      if (a === 'delprof') { const tr = b.closest('tr[data-i]'), i = +tr.dataset.i; if (tpDraft.profiles.length < 2) return sectionToast('Keep at least one profile.', 'warn'); if (!confirm('Delete the profile “' + tpDraft.profiles[i].name + '”? Staff who have it in SharePoint fall back to the job-title match.')) return; tpDraft.profiles.splice(i, 1); return tpRender(); }
      if (a === 'staff') { st.textContent = 'Reading the staff list…'; try { await tpApplyStaff(d.querySelector('#tpOver').checked, t => { st.textContent = t; }); } catch (er) { st.textContent = '⚠ ' + er.message; } return; }
      if (a === 'reset') { if (!confirm('Replace the profiles by the default ones? (Warehouse names are kept.)')) return; const n = tpDraft.names; tpDraft = tpClone(TP_DEFAULT); tpDraft.names = n; return tpRender(); }
      if (a === 'pull') { st.textContent = 'Loading…'; const ok = await tpPull(false); tpDraft = null; tpRender(); return; }
      if (a === 'save' && !busy) { busy = true; const cfg = tpClone(tpDraft); cfg.v = 1; cfg.by = getCurrentUserValue(); cfg.at = new Date().toISOString(); tpSaveLocal(cfg); tpRefresh(); st.textContent = 'Saved here — publishing to SharePoint…';
        try { await tpPush(cfg); st.textContent = '✅ Saved for everyone (' + TP_LIST + ').'; sectionToast('✔ Profiles saved for everyone.', 'success'); } catch (er) { st.textContent = '⚠ Saved in this browser only — ' + er.message + ' (create the list ' + TP_LIST + ' with columns Title and Config_Value).'; } busy = false; } });
  }
  new MutationObserver(() => mount()).observe(document.body, { childList: true, subtree: true }); setTimeout(mount, 700);
})();
/* ---- on login: refresh the central profiles + show the user's location ---- */
const _tpLogin = onLoginComplete;
onLoginComplete = function () { const r = _tpLogin.apply(this, arguments); setTimeout(() => { try { locBadge(); } catch (e) {} tpPull(true); }, 400); return r; };
setInterval(() => { if (currentUser) tpPull(true); }, 10 * 60 * 1000);
