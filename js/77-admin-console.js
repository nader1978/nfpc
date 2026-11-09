/* ============================================================
   ADMIN CONSOLE
   1) Module access — the administrator decides, per user (or for everybody), which sections are shown / view-only / hidden.
      Stored centrally in SharePoint (App_Config_tbl, item "UserAccess") and enforced on every user's screen after sign-in —
      a user cannot undo it from his own Settings.
   2) Logins & activity — every sign-in, sign-out, refused sign-in, section opened and action is logged with the user and sent
      to a SharePoint list (destination "System & login log"); the administrator reads it here.
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = escapeHtml, ITEM = 'UserAccess', KEY = LS_BASE + '_useraccess', QK = LS_BASE + '_syslog_q', SKIPV = new Set(['admin', 'users', 'home', 'help']);
  const admin = () => typeof isAdmin === 'function' && !!isAdmin();
  const uname = u => String((u && u.username) || '').trim().toLowerCase();
  /* ---------- 1 · central access policy ---------- */
  const rdPol = () => { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && j.users ? j : { v: 1, users: {} }; } catch (e) { return { v: 1, users: {} }; } };
  const wrPol = p => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} };
  /* the rule that applies to the signed-in (non-admin) user: his own entry wins over "Everyone" */
  function eff() { const u = currentUser; if (!u || u.role === 'admin') return {}; const P = rdPol().users, a = (P['*'] || {}).m || {}, m = (P[uname(u)] || {}).m || {}; return Object.assign({}, a, m); }
  const _lvl = acLevel;
  acLevel = function (view) { const b = _lvl.apply(this, arguments), e = eff()[view]; if (!e || SKIPV.has(view)) return b; if (e === 'hide') return 'none'; if (e === 'view') return b === 'none' ? b : 'view'; if (e === 'show') return b === 'none' && !((currentUser.viewAccess || {})[view] === false) ? 'full' : b; return b; };
  const _hp = hasPerm;
  hasPerm = function (perm) { if (_hp.apply(this, arguments)) return true; const e = eff(); for (const v in e) { if (e[v] !== 'show' || SKIPV.has(v)) continue; const el = document.querySelector('.nav-item[data-view="' + v + '"]'); if (el && el.dataset.perm === perm) return true; } return false; };
  const _apply = acApplyNav;
  acApplyNav = function () {
    _apply.apply(this, arguments);
    try { const e = eff(); if (Object.keys(e).length) { document.querySelectorAll('.nav-item[data-view]').forEach(el => { const v = el.dataset.view, s = e[v]; if (!s || SKIPV.has(v)) return; if (s === 'hide') { el.style.display = 'none'; el.classList.add('locked'); el.style.pointerEvents = 'none'; } else if (s === 'show' && (currentUser.viewAccess || {})[v] !== false) { el.style.display = ''; el.classList.remove('locked'); el.style.pointerEvents = ''; } });
      document.querySelectorAll('.sidebar-nav .nav-sub').forEach(g => { g.style.display = [...g.querySelectorAll('.nav-item')].some(n => n.style.display !== 'none') ? '' : 'none'; }); document.querySelectorAll('.sidebar-nav .nav-group').forEach(g => { g.style.display = [...g.querySelectorAll('.nav-item')].some(n => n.style.display !== 'none') ? '' : 'none'; }); acRoApply(); } } catch (x) {}
    /* a section that is hidden while it is open: go back to the home page */
    try { const cur = activeViewId(); if (cur && !SKIPV.has(cur) && acLevel(cur) === 'none') { const h = Q('.nav-item[data-view="home"]'); if (h) h.click(); } } catch (x) {}
  };
  async function polPull(silent) {
    try { const c = await tpCtx(); if (!c) return false; const it = (await fetchAllItems(c.siteId, c.listId, c.token)).find(x => String((x.fields || {}).Title || '').trim() === ITEM);
      if (!it) { if (!silent) sectionToast('No “' + ITEM + '” row in ' + TP_LIST + ' yet — nothing is restricted centrally.', 'warn'); return false; }
      const j = JSON.parse(String((it.fields || {}).Config_Value || '')); if (!j || !j.users) return false; const old = JSON.stringify(rdPol().users); wrPol(j);
      if (JSON.stringify(j.users) !== old) { try { applyPermissions(); } catch (e) {} } if (!silent) sectionToast('✔ Access rules loaded from SharePoint.', 'success'); return true; }
    catch (e) { if (!silent) sectionToast('Could not read ' + TP_LIST + ': ' + e.message, 'warn'); return false; }
  }
  async function polPush(pol) {
    const cfg = Object.assign({}, pol, { v: 1, by: getCurrentUserValue(), at: new Date().toISOString() }); wrPol(cfg);
    const c = await tpCtx(); if (!c) throw new Error('sign in / Site URL is not ready'); const its = await fetchAllItems(c.siteId, c.listId, c.token), ex = its.find(x => String((x.fields || {}).Title || '').trim() === ITEM), val = JSON.stringify(cfg);
    if (ex) await updateItem(c.siteId, c.listId, ex.id, spCoerceFields(c.listId, { Config_Value: val }), c.token); else await createItem(c.siteId, c.listId, { Title: ITEM, Config_Value: val }, c.token);
  }
  { const prev = onLoginComplete; onLoginComplete = function () { const r = prev.apply(this, arguments); setTimeout(() => polPull(true), 500); return r; }; setInterval(() => { if (currentUser) polPull(true); }, 5 * 60 * 1000); }

  /* ---------- 2 · system & login log ---------- */
  utRegister('syslog', { section: 'Administration', label: 'System & login log → SharePoint', fields: () => [
    { key: 'when', label: 'Date & time', alias: ['when', 'timestamp', 'datetime', 'date', 'time', 'logtime'] },
    { key: 'user', label: 'User', alias: ['user', 'username', 'userid', 'loginname', 'person'] },
    { key: 'role', label: 'Role', alias: ['role', 'userrole'] },
    { key: 'kind', label: 'Event', alias: ['kind', 'event', 'eventtype', 'type', 'action', 'category'] },
    { key: 'module', label: 'Section / module', alias: ['module', 'section', 'view', 'page', 'screen'] },
    { key: 'detail', label: 'Detail', alias: ['detail', 'details', 'description', 'message', 'activity', 'title'] },
    { key: 'device', label: 'Browser / device', alias: ['device', 'browser', 'useragent', 'client', 'platform'] },
    { key: 'session', label: 'Session ID', alias: ['session', 'sessionid', 'sid'] }],
    note: 'Used by 🛡 Admin Console → Logins & activity. Every sign-in, sign-out, refused sign-in, section opened and action is added here, one row each. Create a list (Title + the columns below) and map it.' });
  let SID = ''; try { SID = sessionStorage.getItem(LS_BASE + '_sid') || ''; if (!SID) { SID = uid(); sessionStorage.setItem(LS_BASE + '_sid', SID); } } catch (e) { SID = uid(); }
  const device = (() => { const u = navigator.userAgent || '', b = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'Browser', o = /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iOS' : /Windows/.test(u) ? 'Windows' : /Mac OS/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : ''; return b + (o ? ' · ' + o : '') + (document.body.classList.contains('mobile') || /Mobi/.test(u) ? ' · mobile' : ''); })();
  const qRead = () => { try { return JSON.parse(localStorage.getItem(QK) || '[]') || []; } catch (e) { return []; } }, qWrite = a => { try { localStorage.setItem(QK, JSON.stringify(a.slice(-3000))); } catch (e) {} };
  let lastUser = '', lastRole = '';
  const ev = (kind, detail, user, module) => { const u = user || (currentUser && currentUser.username) || lastUser || ''; if (currentUser) { lastUser = currentUser.username; lastRole = currentUser.role; } qWrite(qRead().concat([{ when: new Date().toISOString(), user: u, role: (currentUser && currentUser.role) || (u === lastUser ? lastRole : ''), kind, module: module == null ? (() => { try { return activeViewId(); } catch (e) { return ''; } })() : module, detail: String(detail || '').slice(0, 480), device, session: SID }])); };
  const _add = addActivity;
  addActivity = function (k, d) {
    const r = _add.apply(this, arguments);
    try { if (k === 'throttle') return r; d = String(d || ''); let kind = k, user = '';
      if (k === 'auth') { if (/^Signed in as /i.test(d)) { kind = 'login'; user = d.replace(/^Signed in as /i, ''); } else if (/^Signed out/i.test(d)) { kind = 'logout'; user = lastUser; } else if (/Sign-in refused/i.test(d)) { kind = 'login-failed'; user = (/refused:\s*(.+?)\s*\(/i.exec(d) || [])[1] || ''; } else kind = 'admin'; }
      ev(kind, d, user, kind === 'login' || kind === 'logout' || kind === 'login-failed' ? '' : null); if (kind === 'login') setTimeout(flush, 4000); } catch (e) {}
    return r; };
  /* a section was opened */
  let lastOpen = '', lastAt = 0;
  document.addEventListener('click', e => { const n = e.target.closest && e.target.closest('.nav-item[data-view]'); if (!n || n.classList.contains('locked') || !currentUser) return; const v = n.dataset.view; if (v === lastOpen && Date.now() - lastAt < 4000) return; lastOpen = v; lastAt = Date.now(); let t = v; try { t = VIEW_META[v].title; } catch (x) { t = (n.textContent || v).trim(); } ev('open', 'Opened: ' + t, null, v); }, true);
  const lo = Q('#logoutBtn'); if (lo) lo.addEventListener('click', () => { try { flush(); } catch (e) {} }, true);
  let busy = false;
  async function flush() {
    if (busy) return; const q = qRead(); if (!q.length) return; let ok = false; try { ok = !!getGlobalAccessToken() && !!getGlobalSiteUrl() && utReady('syslog'); } catch (e) {} if (!ok) return; busy = true; window.__orbQuiet = true;
    try { const part = q.slice(0, 40), r = await utPush('syslog', part, x => x.kind); if (r.ok || !r.fail) qWrite(qRead().slice(part.length)); else if (r.fail && !r.ok) throw new Error((r.errors && r.errors[0]) || 'refused'); } catch (e) { /* keep the queue; try again later */ }
    window.__orbQuiet = false; busy = false; if (qRead().length > 40) setTimeout(flush, 500); }
  setInterval(flush, 60000); setTimeout(flush, 6000);
  window.addEventListener('pagehide', () => { try { flush(); } catch (e) {} });

  /* ---------- admin screen ---------- */
  const A = { tab: 'acc', who: '*', q: '', pol: null, log: [], src: '', loaded: false, f: { u: '', k: '', from: '', to: '', q: '' }, msg: '' };
  const KIND = { login: ['#16a34a', 'Sign-in'], logout: ['#64748b', 'Sign-out'], 'login-failed': ['#dc2626', 'Refused'], open: ['#2563eb', 'Opened'], export: ['#7c3aed', 'Export'], upload: ['#0891b2', 'Upload'], edit: ['#d97706', 'Edit'], error: ['#dc2626', 'Error'], email: ['#9333ea', 'Email'], settings: ['#475569', 'Settings'], admin: ['#be185d', 'Admin'], warehouse: ['#0d9488', 'Warehouse'] };
  const day = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const say = (t, bad) => { A.msg = t; const e = Q('#adMsg'); if (e) { e.textContent = t; e.style.color = bad ? '#b45309' : ''; } };
  function mods() {   /* the groups & pages exactly as the users see them (admin-arranged groups / sub-groups included) + any page that appeared after the first scan */
    navCapture(); document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(el => { const v = el.dataset.view; if (v && !navMeta[v]) navMeta[v] = { el, name: ((el.querySelector('span:nth-child(2)') || el).textContent || v).trim(), icon: (el.querySelector('.icon') || {}).textContent || '' }; });
    let lay; try { lay = navLayout(); } catch (e) { lay = navCapture(); }
    const out = [], seen = new Set(), add = (name, list) => { const items = list.filter(v => !SKIPV.has(v) && navMeta[v] && !seen.has(v)).map(v => { seen.add(v); return { v, n: navMeta[v].name, i: navMeta[v].icon }; }); if (items.length) out.push({ g: name, items }); };
    lay.groups.forEach(g => { add(g.name, g.items || []); (g.subs || []).forEach(x => add(g.name + ' › ' + x.name, x.items || [])); });
    add('Other', Object.keys(navMeta)); return out; }
  { const _na = navApply; navApply = function () { const r = _na.apply(this, arguments); try { if (A.tab === 'acc' && typeof activeViewId === 'function' && activeViewId() === 'admin' && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#adQ'))) draw(); } catch (e) {} return r; }; }
  const people = () => users.list.filter(u => u.role !== 'admin').sort((a, b) => String(a.displayName || a.username).localeCompare(String(b.displayName || b.username)));
  const stateOf = (who, v) => ((A.pol.users[who] || {}).m || {})[v] || '';
  function accHtml() {
    const P = people(), who = A.who, isAll = who === '*', e = (A.pol.users[who] || {}).m || {}, all = (A.pol.users['*'] || {}).m || {}, q = A.q.toLowerCase();
    const cnt = Object.values(e).filter(Boolean).length;
    const opts = [['', isAll ? 'Default (by role)' : 'Same as Everyone / role'], ['show', '✅ Show'], ['view', '👁 View only'], ['hide', '🚫 Hide']];
    return `<div class="btn-row" style="gap:10px;align-items:flex-end;flex-wrap:wrap;margin:6px 0 10px"><div class="form-group" style="margin:0;min-width:280px"><label>Set the access of</label><select id="adWho"><option value="*" ${isAll ? 'selected' : ''}>👥 Everyone (all non-admin users)</option>${P.map(u => `<option value="${esc(uname(u))}" ${who === uname(u) ? 'selected' : ''}>${esc(u.displayName || u.username)} · ${esc(u.username)} · ${esc((ROLES[u.role] || {}).label || u.role)}${(A.pol.users[uname(u)] || {}).m && Object.keys(A.pol.users[uname(u)].m).length ? ' · ' + Object.keys(A.pol.users[uname(u)].m).length + ' rule(s)' : ''}</option>`).join('')}</select></div>
      <div class="form-group" style="margin:0"><label>Find a section</label><input id="adQ" type="search" placeholder="🔍 section name…" value="${esc(A.q)}"></div>
      <button class="success" type="button" data-ad="push">☁ Publish to SharePoint</button><button class="ghost small" type="button" data-ad="pull">⬇ Load from SharePoint</button><button class="ghost small" type="button" data-ad="clear">↺ Clear this ${isAll ? 'rule set' : 'user\'s rules'}</button></div>
      <div class="text-sm" style="margin:0 0 6px">${isAll ? 'Rules for <b>everybody</b> (administrators are never restricted). A rule set for one user overrides these.' : 'Rules for <b>' + esc(who) + '</b> — they override the “Everyone” rules.'} <b>${cnt}</b> rule(s) here. <span id="adMsg"></span></div>
      <div class="text-sm" style="margin:0 0 8px;color:var(--gray-600)">Changes are saved on this screen first; press <b>Publish to SharePoint</b> and they reach every user's screen within 5 minutes (or at his next sign-in). <b>Show</b> also opens a section his role would normally not allow. The user cannot change this from his own settings.</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><button class="ghost small" type="button" data-ad="all-hide">🚫 Hide all sections</button><button class="ghost small" type="button" data-ad="all-show">✅ Show all sections</button><button class="ghost small" type="button" data-ad="all-def">Default for all</button></div>
      ${mods().map(g => { const its = g.items.filter(x => !q || (x.n + ' ' + g.g).toLowerCase().includes(q)); if (!its.length) return ''; return `<div class="card" style="margin:0 0 10px;padding:10px 12px"><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><b>${esc(g.g)}</b><span style="flex:1"></span><button class="ghost small" type="button" data-ad="g-hide" data-g="${esc(g.g)}">Hide group</button><button class="ghost small" type="button" data-ad="g-def" data-g="${esc(g.g)}">Default</button></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:6px 14px">${its.map(x => { const s = e[x.v] || '', inh = !s && all[x.v] && !isAll ? all[x.v] : ''; return `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border)"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.i)} ${esc(x.n)}${inh ? ' <span class="text-sm" style="color:#b45309">(Everyone: ' + inh + ')</span>' : ''}</span><select data-mv="${esc(x.v)}" style="width:auto;margin:0;${s === 'hide' ? 'border-color:#dc2626;color:#b91c1c' : s === 'view' ? 'border-color:#d97706' : s === 'show' ? 'border-color:#16a34a' : ''}">${opts.map(o => `<option value="${o[0]}" ${s === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>`; }).join('')}</div></div>`; }).join('')}`;
  }
  /* ----- log reader ----- */
  async function readLog(manual) {
    const cfg = utGet('syslog'), local = qRead().map(x => Object.assign({}, x, { _loc: 1 })); let rows = [], src = '';
    try { if (cfg.list && getGlobalAccessToken() && getGlobalSiteUrl()) { say('⏳ Reading ' + cfg.list + '…'); const t = getGlobalAccessToken(), s = getGlobalSiteUrl(), ids = await resolveIds(s, cfg.list, t), items = await fetchAllItems(ids.siteId, ids.listId, t), m = cfg.map || {}, g = (f, k) => { const c = m[k]; return c && c !== SKIP_VALUE ? f[c] : ''; };
      rows = items.map(it => { const f = it.fields || {}, w = g(f, 'when') || f.Created || ''; return { when: w ? new Date(w).toISOString() : '', user: String(g(f, 'user') || ''), role: String(g(f, 'role') || ''), kind: String(g(f, 'kind') || ''), module: String(g(f, 'module') || ''), detail: String(g(f, 'detail') || ''), device: String(g(f, 'device') || ''), session: String(g(f, 'session') || '') }; });
      src = cfg.list + ' (' + rows.length + ' rows)'; } else src = cfg.list ? 'sign in with Microsoft to read ' + cfg.list : 'no SharePoint list is linked yet'; } catch (e) { src = 'could not read the list — ' + e.message; }
    A.log = rows.concat(local).filter(r => r.when).sort((a, b) => b.when.localeCompare(a.when)); A.src = src + (local.length ? ' · ' + local.length + ' waiting in this browser' : ''); A.loaded = true; say(manual ? 'Log updated.' : ''); }
  const fLog = () => { const f = A.f, from = f.from ? new Date(f.from + 'T00:00:00').toISOString() : '', to = f.to ? new Date(f.to + 'T23:59:59').toISOString() : '', q = f.q.toLowerCase(); return A.log.filter(r => (!f.u || String(r.user).toLowerCase() === f.u) && (!f.k || r.kind === f.k) && (!from || r.when >= from) && (!to || r.when <= to) && (!q || (r.detail + ' ' + r.module + ' ' + r.user).toLowerCase().includes(q))); };
  const fmtT = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  function logData() { const L = fLog(); return { title: 'System & login log', sheet: 'System log', note: A.src + ' · ' + L.length + ' event(s)', headers: ['Date & time', 'User', 'Role', 'Event', 'Section', 'Detail', 'Browser / device', 'Session'], rows: L.map(r => [fmtT(r.when), r.user, r.role, r.kind, r.module, r.detail, r.device, r.session]) }; }
  function logHtml() {
    const f = A.f, L = fLog(), us = [...new Set(A.log.map(r => String(r.user).toLowerCase()).filter(Boolean))].sort(), ks = [...new Set(A.log.map(r => r.kind).filter(Boolean))].sort();
    const logins = L.filter(r => r.kind === 'login'), fails = L.filter(r => r.kind === 'login-failed'), by = new Map(); A.log.forEach(r => { const u = String(r.user || '').toLowerCase(); if (!u) return; let o = by.get(u); if (!o) by.set(u, o = { u, last: '', in: 0, act: 0, fail: 0, mod: '', lastLogin: '' }); if (!o.last || r.when > o.last) { o.last = r.when; if (r.module) o.mod = r.module; } if (r.kind === 'login') { o.in++; if (!o.lastLogin || r.when > o.lastLogin) o.lastLogin = r.when; } else if (r.kind === 'login-failed') o.fail++; else o.act++; });
    const kp = (l, v) => `<div style="flex:1 1 150px;border:1px solid var(--border);border-radius:10px;padding:8px 12px"><div class="text-sm">${l}</div><div style="font-size:22px;font-weight:700">${v}</div></div>`;
    return `<div class="text-sm" style="margin:2px 0 8px">Source: <b>${esc(A.src || '—')}</b> <span id="adMsg"></span></div>
      ${!utGet('syslog').list ? '<div class="card" style="margin:0 0 10px;padding:10px 12px;border-left:4px solid #d97706">⚠ The log is not linked to a SharePoint list yet. Create a list (e.g. <b>System_Log_tbl</b>) with columns for date &amp; time, user, role, event, section, detail, browser and session, then link it in <b>Upload Destinations &amp; Sources → Administration → System &amp; login log</b>. Until then events wait in each user\'s browser (the list below shows this browser only).</div>' : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${kp('Sign-ins', logins.length)}${kp('Users seen', new Set(L.map(r => String(r.user).toLowerCase()).filter(Boolean)).size)}${kp('Refused sign-ins', fails.length)}${kp('Events', L.length)}</div>
      <div class="btn-row" style="gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:8px"><div class="form-group" style="margin:0"><label>User</label><select data-lf="u"><option value="">All users</option>${us.map(x => `<option value="${esc(x)}" ${f.u === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div><div class="form-group" style="margin:0"><label>Event</label><select data-lf="k"><option value="">All events</option>${ks.map(x => `<option value="${esc(x)}" ${f.k === x ? 'selected' : ''}>${esc((KIND[x] || [0, x])[1])}</option>`).join('')}</select></div><div class="form-group" style="margin:0"><label>From</label><input type="date" data-lf="from" value="${esc(f.from)}"></div><div class="form-group" style="margin:0"><label>To</label><input type="date" data-lf="to" value="${esc(f.to)}"></div><div class="form-group" style="margin:0"><label>Search</label><input type="search" data-lf="q" value="${esc(f.q)}" placeholder="🔍 detail, section…"></div><button class="secondary small" type="button" data-ad="reload">🔄 Reload</button><button class="secondary small" type="button" data-ad="xl">📊 Excel</button></div>
      <details open style="margin-bottom:10px"><summary style="cursor:pointer;font-weight:600">👥 Users overview</summary><div class="table-wrap" style="max-height:240px;overflow:auto"><table><thead><tr><th>User</th><th>Last sign-in</th><th>Sign-ins</th><th>Actions</th><th>Refused</th><th>Last activity</th><th>Last section</th></tr></thead><tbody>${[...by.values()].sort((a, b) => b.last.localeCompare(a.last)).map(o => `<tr><td><b>${esc(o.u)}</b></td><td>${fmtT(o.lastLogin)}</td><td>${o.in}</td><td>${o.act}</td><td${o.fail ? ' style="color:#dc2626;font-weight:700"' : ''}>${o.fail}</td><td>${fmtT(o.last)}</td><td>${esc(o.mod)}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:12px;color:var(--gray-600)">No events yet.</td></tr>'}</tbody></table></div></details>
      <div class="table-wrap" style="max-height:58vh;overflow:auto"><table><thead><tr><th>Date &amp; time</th><th>User</th><th>Event</th><th>Section</th><th>Detail</th><th>Browser / device</th></tr></thead><tbody>${L.slice(0, 1500).map(r => { const k = KIND[r.kind] || ['#64748b', r.kind]; return `<tr><td style="white-space:nowrap">${fmtT(r.when)}${r._loc ? ' ⏳' : ''}</td><td><b>${esc(r.user)}</b></td><td><span style="background:${k[0]};color:#fff;border-radius:99px;padding:1px 8px;font-size:11px;font-weight:700;white-space:nowrap">${esc(k[1])}</span></td><td>${esc(r.module)}</td><td>${esc(r.detail)}</td><td style="white-space:nowrap">${esc(r.device)}</td></tr>`; }).join('') || '<tr><td colspan="6" style="text-align:center;padding:14px;color:var(--gray-600)">No events match.</td></tr>'}</tbody></table></div>${L.length > 1500 ? '<div class="text-sm">Showing the latest 1500 — narrow the filters or use Excel for all ' + L.length + '.</div>' : ''}`;
  }
  async function draw() {
    const host = Q('#adHost'); if (!host) return; if (!A.pol) A.pol = JSON.parse(JSON.stringify(rdPol()));
    if (A.tab === 'log' && !A.loaded) { host.innerHTML = '<div class="text-sm" style="padding:14px">⏳ Reading the log…</div>'; await readLog(false); }
    Q('#adTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === A.tab)); const keep = host.scrollTop; host.innerHTML = A.tab === 'acc' ? accHtml() : logHtml(); host.scrollTop = keep; if (A.msg) say(A.msg); }
  function init() {
    const host = Q('#adHost'); if (!host || host.dataset.init) return; host.dataset.init = '1';
    Q('#adTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; A.tab = b.dataset.t; A.msg = ''; draw(); });
    host.addEventListener('change', e => { const t = e.target;
      if (t.id === 'adWho') { A.who = t.value; draw(); return; }
      if (t.dataset.mv) { const u = A.pol.users[A.who] = A.pol.users[A.who] || { m: {} }; if (t.value) u.m[t.dataset.mv] = t.value; else delete u.m[t.dataset.mv]; draw(); say('Changed — press “Publish to SharePoint” to apply it to the users.'); return; }
      if (t.dataset.lf) { A.f[t.dataset.lf] = t.value; draw(); } });
    host.addEventListener('input', e => { const t = e.target; if (t.id === 'adQ') { A.q = t.value; clearTimeout(init.t); init.t = setTimeout(() => { draw(); const q = Q('#adQ'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 250); } else if (t.dataset.lf === 'q') { A.f.q = t.value; clearTimeout(init.t); init.t = setTimeout(() => { draw(); const q = Q('[data-lf=q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 300); } });
    host.addEventListener('click', async e => { const b = e.target.closest('button[data-ad]'); if (!b) return; const a = b.dataset.ad, u = A.pol.users[A.who] = A.pol.users[A.who] || { m: {} }, all = mods().flatMap(g => g.items.map(x => x.v));
      if (a === 'all-hide') all.forEach(v => { u.m[v] = 'hide'; }); else if (a === 'all-show') all.forEach(v => { u.m[v] = 'show'; }); else if (a === 'all-def') u.m = {};
      else if (a === 'g-hide' || a === 'g-def') { const g = mods().find(x => x.g === b.dataset.g); if (g) g.items.forEach(x => { if (a === 'g-hide') u.m[x.v] = 'hide'; else delete u.m[x.v]; }); }
      else if (a === 'clear') { if (!confirm('Clear all rules of ' + (A.who === '*' ? 'Everyone' : A.who) + '?')) return; delete A.pol.users[A.who]; }
      else if (a === 'pull') { say('⏳ Loading…'); const ok = await polPull(false); A.pol = JSON.parse(JSON.stringify(rdPol())); say(ok ? '✔ Loaded.' : 'Nothing loaded.'); }
      else if (a === 'push') { Object.keys(A.pol.users).forEach(k => { if (!Object.keys((A.pol.users[k] || {}).m || {}).length) delete A.pol.users[k]; }); say('⏳ Publishing…'); try { await polPush(A.pol); say('✅ Published — users receive it within 5 minutes or at their next sign-in.'); addActivity('auth', 'Published module access rules (' + Object.keys(A.pol.users).length + ' rule set(s))'); } catch (x) { say('⚠ Saved on this computer only — SharePoint: ' + x.message, 1); } }
      else if (a === 'reload') { A.loaded = false; await draw(); say('Log updated.'); return; } else if (a === 'xl') { const d = logData(); if (typeof a2Export === 'function') a2Export(d); return; }
      draw(); });
  }
  document.querySelectorAll('.nav-item[data-view="admin"]').forEach(n => n.addEventListener('click', () => { if (!admin()) return; A.pol = JSON.parse(JSON.stringify(rdPol())); A.loaded = false; init(); draw(); polPull(true).then(ok => { if (ok && A.tab === 'acc') { A.pol = JSON.parse(JSON.stringify(rdPol())); draw(); } }); }));
  window.ADM = { eff, flush, ev, polPull };
})();
