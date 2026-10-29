/* ============================================================
   LOCATION SCOPE — every user belongs to a warehouse location (Location_ID)
   • uploads / entries to SharePoint: the user's Location_ID is written into the list's Location_ID column automatically
   • data read from any list (all sections, Data Download, Data Editor …): only rows of the user's location(s)
   Admins and users with Location ID empty / 0 see every location. Rows without a Location_ID are shown to everybody
   unless "hide rows without Location_ID" is ticked (Users page).
   ============================================================ */
const LOC_CFG = LS_BASE + '_loc_cfg';
const locCfg = () => { try { return Object.assign({ hideBlank: false }, JSON.parse(localStorage.getItem(LOC_CFG) || '{}')); } catch (e) { return { hideBlank: false }; } };
const locNorm = v => String(v == null ? '' : v).trim().replace(/\.0+$/, '').toLowerCase();
const locIds = u => String(u && u.locationId != null ? u.locationId : '').split(/[,;\/\s]+/).map(locNorm).filter(x => x && x !== '0');
const locScoped = () => !!currentUser && !(typeof isAdmin === 'function' && isAdmin()) && locIds(currentUser).length > 0;
const locColOf = (listId, fields) => {
  const T = (window.SP_COLT || {})[listId], isLoc = k => { const n = normalize(String(k).replace(/_x0020_/gi, '')); return n === 'locationid' || n === 'locid' || n === 'whlocationid' || n === 'warehouselocationid'; };
  if (T) { const k = Object.keys(T).find(x => isLoc(x) || isLoc(T[x].displayName || '')); if (k) return k; }
  return fields ? Object.keys(fields).find(isLoc) || null : null;
};
function locProfile(f) {   /* read the profile columns of a LoginUserList row */
  const get = re => { const k = Object.keys(f).find(x => re.test(normalize(x))); return k == null ? undefined : String(lulVals(f[k])[0] == null ? '' : lulVals(f[k])[0]).trim(); }, o = {};
  const P = get(/^websysaccessprofile$/), W = get(/^whsname$|^whname$|^warehousename$|^warehouse$|^locationname$|^locname$|^whsdesc$|^whdesc$/), L = get(/^locationid$/), B = get(/^budesc$|^bu$/), R = get(/^region$/), M = get(/^linemngr$|^linemanager$/), A = get(/^accesslevel$/), E = get(/^empid$/), T = get(/^title$|^jobtitle$/);
  if (P !== undefined) o.spProfile = P; if (W !== undefined && W) o.whName = W; if (L !== undefined) o.locationId = L; if (B !== undefined) o.bu = B; if (R !== undefined) o.region = R; if (M !== undefined) o.lineMngr = M; if (A !== undefined) o.accessLevel = A; if (E !== undefined) o.empId = E; if (T !== undefined && T) o.jobTitle = T;
  return o;
}
function locApplyRow(f) {   /* refresh the signed-in user's profile from SharePoint */
  if (!f || !currentUser || currentUser.builtin) return; const o = locProfile(f); if (currentUser.locUser === 1) delete o.locationId; if (!Object.keys(o).length) return;
  const u = users.list.find(x => x.id === currentUser.id) || currentUser, before = String(u.spProfile || '') + '|' + String(u.locationId || ''); Object.assign(u, o); if (u !== currentUser) Object.assign(currentUser, o); saveUsers(); locBadge();
  if (before !== String(u.spProfile || '') + '|' + String(u.locationId || '')) { try { navApply(true); } catch (e) {} try { if (activeViewId() === 'home' && window.homeRender) window.homeRender(); } catch (e) {} }
}
const locNameMap = () => { try { return (JSON.parse(localStorage.getItem(LS_BASE + '_tprof') || '{}').names) || {}; } catch (e) { return {}; } };
function locWhName(u) { u = u || currentUser; if (!u) return ''; if (u.whName) return String(u.whName); const m = locNameMap(), ids = locIds(u); return ids.map(i => m[i] || m[String(+i)] || '').filter(Boolean).join(' / '); }
function locText(u) { u = u || currentUser; const ids = locIds(u), n = locWhName(u); return ids.length ? '📍 ' + (n ? n + ' · ' : '') + 'Location ' + ids.join(', ') : '📍 All locations'; }
function locBadge() {
  const set = (el, t, ti) => { if (el.textContent !== t) el.textContent = t; if (el.title !== ti) el.title = ti; };
  const ids = currentUser ? locIds(currentUser) : [], ti = ids.length ? (locScoped() ? 'You see and upload data of this location only' : 'Your uploads are stamped with this Location ID') : 'No Location ID set — all locations are shown';
  const r = document.querySelector('#userRole'); if (r) { let b = document.querySelector('#locBadge'); if (!b) { b = document.createElement('div'); b.id = 'locBadge'; b.style.cssText = 'font-size:11px;font-weight:700;margin-top:3px;opacity:.9;white-space:normal'; r.insertAdjacentElement('afterend', b); } set(b, locText(), ti); }
  const a = document.querySelector('.topbar-actions'); if (a) { let c = document.querySelector('#locChip'); if (!c) { c = document.createElement('span'); c.id = 'locChip'; c.style.cssText = 'font-size:12px;font-weight:700;padding:5px 11px;border-radius:999px;background:var(--brand-light,#eef3ff);color:var(--brand-dark,#12306b);border:1px solid var(--border);white-space:nowrap;margin-right:8px'; a.insertBefore(c, a.firstChild); } set(c, locText(), ti); c.style.display = currentUser ? '' : 'none'; }
}
function locHomeStrip(host) {   /* switchboard: who / where */
  if (!host || !currentUser) return; const z = host.querySelector('.hm-zoom') || host, old = host.querySelector('.hm-loc'); if (old) old.remove();
  const bits = [locText(), currentUser.jobTitle && '👤 ' + currentUser.jobTitle, currentUser.bu && 'BU ' + currentUser.bu, currentUser.region && 'Region ' + currentUser.region, currentUser.lineMngr && 'Line manager ' + currentUser.lineMngr].filter(Boolean);
  const d = document.createElement('div'); d.className = 'hm-loc'; d.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:0 0 10px;padding:9px 16px;font-size:13px;font-weight:600;background:var(--hm-c,#fff);border:1px solid var(--hm-l,#e3e8f2);border-radius:12px;color:var(--hm-t,#16223b)';
  d.innerHTML = bits.map((x, i) => '<span' + (i ? ' style="font-weight:500;color:var(--hm-m,#51607f)"' : ' style="font-size:15px"') + '>' + escapeHtml(x) + '</span>').join(''); z.insertBefore(d, z.firstChild);
}
/* ---- uploads: stamp the Location_ID ---- */
function locStamp(listId, fields) {
  try { if (!currentUser || !fields) return fields; const ids = locIds(currentUser); if (ids.length !== 1) return fields; const col = locColOf(listId, fields); if (!col) return fields;
    const raw = String(currentUser.locationId).split(/[,;\/\s]+/).filter(x => x && x !== '0')[0]; return Object.assign({}, fields, { [col]: raw }); } catch (e) { return fields; }
}
const _locCreate = createItem;
createItem = function (siteId, listId, fields, token) { return _locCreate(siteId, listId, locStamp(listId, fields), token); };
/* ---- views: keep only the user's location ---- */
function locKeep(listId, items) {
  if (listId === window.__locSkipList) return items;   /* the login list is never scoped */
  if (!locScoped() || !Array.isArray(items) || !items.length) return items;
  const col = locColOf(listId, (items[0] || {}).fields); if (!col) return items; const ids = new Set(locIds(currentUser)), hb = locCfg().hideBlank;
  return items.filter(it => { const v = locNorm((it.fields || {})[col]); return v === '' ? !hb : ids.has(v); });
}
/* one hook for EVERY read of a list's items (Data Download, Data Editor, Batch Allocation, WHs / RMPM / stock movement, FOC voucher, Milco planning, Oasis, uploads' key look-ups …) */
const _locFetch = fetchWithRetry;
fetchWithRetry = async function (url, options, context) {
  const r = await _locFetch(url, options, context);
  try { if (!locScoped() || !r || !r.ok || (options && options.method && String(options.method).toUpperCase() !== 'GET')) return r;
    const m = /\/lists\/([^\/?]+)\/items(?:\?|$)/.exec(String(url)); if (!m) return r; const lid = decodeURIComponent(m[1]);
    return new Proxy(r, { get(t, k) { if (k === 'json') return async () => { const d = await t.json(); if (d && Array.isArray(d.value)) d.value = locKeep(lid, d.value); return d; }; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } }); } catch (e) { return r; }
};
/* ---- mapping screens: show the automatic Location ID field ---- */
const LOC_FIELD_KEY = '__location__';
const locOne = () => { const a = currentUser ? String(currentUser.locationId == null ? '' : currentUser.locationId).split(/[,;\/\s]+/).filter(x => x && x !== '0') : []; return a.length === 1 ? a[0] : ''; };
const locOutputField = () => ({ key: LOC_FIELD_KEY, label: '📍 Location ID (auto from user)', alias: ['Location_ID', 'LocationID', 'Loc_ID'], synthetic: true });
function locMapRow(body, t) {   /* Data Upload mapping table: a read-only row that shows where the Location ID goes */
  if (!body || !t) return; const old = body.querySelector('tr[data-loc]'); if (old) old.remove(); const col = (t.columns || []).find(c => { const n = normalize(String(c.name).replace(/_x0020_/gi, '')); return n === 'locationid' || n === 'locid'; }); const v = locOne();
  const tr = document.createElement('tr'); tr.dataset.loc = '1'; tr.innerHTML = '<td><strong>📍 Location ID (auto from user)</strong> ' + (col && v ? '<span class="badge auto">→</span>' : '<span class="badge skip">SKIP</span>') + '</td><td class="sample-value">' + escapeHtml(v || (locIds(currentUser).length > 1 ? 'several locations — not stamped' : 'no location set for your user')) + '</td><td>' + (col && v ? '<code>' + escapeHtml(col.displayName || col.name) + '</code> — filled automatically (replaces any value from the file)' : '<em>' + (col ? 'no Location ID on your user' : 'this list has no Location_ID column') + '</em>') + '</td>';
  body.insertBefore(tr, body.firstChild.nextSibling);
}
/* ---- Users page: option bar ---- */
(function () {
  const card = () => document.querySelector('#usersTableBody') && document.querySelector('#usersTableBody').closest('.card'); let done = false;
  function bar() { const c = card(); if (!c || done || c.querySelector('#locBar')) return; done = true; const d = document.createElement('div'); d.id = 'locBar'; d.className = 'card-desc'; d.style.cssText = 'border:1px dashed var(--border);border-radius:10px;padding:8px 12px;margin:8px 0';
    d.innerHTML = '📍 <b>Location ID</b> — each user sees and uploads data of his own warehouse location only (admins and users with empty / 0 see all). Uploads get the user\'s Location ID in the list column <code>Location_ID</code>. <label style="display:inline-flex;gap:6px;align-items:center;margin-left:8px"><input type="checkbox" id="locHide" style="width:auto"> hide rows that have no Location_ID</label>';
    const t = c.querySelector('.table-wrap'); if (t) t.parentNode.insertBefore(d, t); const cb = d.querySelector('#locHide'); cb.checked = locCfg().hideBlank; cb.addEventListener('change', () => { try { localStorage.setItem(LOC_CFG, JSON.stringify({ hideBlank: cb.checked })); } catch (e) {} sectionToast('Saved — reload the Warehouse page to apply.', 'success'); }); }
  const ob = new MutationObserver(() => { bar(); if (currentUser) locBadge(); }); ob.observe(document.body, { childList: true, subtree: true }); setTimeout(() => { bar(); locBadge(); }, 600);
})();
