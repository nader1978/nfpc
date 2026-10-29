/* ---- per-user feature options (set by an administrator in Users -> Options; absent = allowed) ---- */
const FEAT_LIST = [
  ['excel', '📊 Excel export', 'Download .xlsx files from any list'],
  ['email', '✉ Email', 'Send lists / documents by email'],
  ['print', '🖨 Print', 'Print lists, picking lists, delivery notes, signboards'],
  ['expand', '⤢ Expand', 'Open lists in the full-screen expanded view'],
  ['fdedit', '✏ F&D trip editing', 'Change actual quantities, add / remove items and batches, status, plate, driver'],
  ['xlstyle', '🎨 Excel style settings', 'Change the Excel export style and the company name'],
  ['mgsetup', '🔌 Management report — lists & mapping', 'See and change the SharePoint lists and column mapping of the Management Daily Report. OFF unless ticked — everyone else just uses the settings fixed by the administrator.', 'optin']
];
const featOk = k => !currentUser || currentUser.role === 'admin' || (k === 'mgsetup' ? !!(currentUser.features && currentUser.features.mgsetup === true) : (!currentUser.features || currentUser.features[k] !== false));
const featBlock = k => { if (featOk(k)) return false; const f = FEAT_LIST.find(x => x[0] === k); try { sectionToast('🔒 ' + (f ? f[1].replace(/^\S+\s/, '') : k) + ' is switched off for your account. Contact an administrator.', 'warn'); } catch (e) {} return true; };

function getUserAllowedLists() {
  if (!currentUser) return [];
  return Array.isArray(currentUser.allowedLists) ? currentUser.allowedLists : [];
}
function getUserEditableLists() {
  if (!currentUser) return [];
  return Array.isArray(currentUser.editableLists) ? currentUser.editableLists : [];
}
function isListVisible(listName) {
  if (isAdmin()) return true;
  const allowed = getUserAllowedLists();
  if (!allowed.length) return true;
  return allowed.map(n => n.toLowerCase()).includes(String(listName || '').toLowerCase());
}
function isListEditable(listName) {
  if (isAdmin()) return true;
  const allowed = getUserAllowedLists();
  const editable = getUserEditableLists();
  if (!isListVisible(listName)) return false;
  if (!editable.length) return true;
  return editable.map(n => n.toLowerCase()).includes(String(listName || '').toLowerCase());
}
function filterVisibleLists(lists) {
  return lists.filter(l => isListVisible(l.displayName || l.name));
}

async function showLogin() {
  try { lulHide(); } catch (e) {}
  $('loginScreen').style.display = 'flex';
  $('appShell').classList.remove('visible');
  $('loginUsername').value = '';
  $('loginPassword').value = '';
  $('loginUsername').focus();
}
function showApp() {
  $('loginScreen').style.display = 'none';
  $('appShell').classList.add('visible');
  try { lulStart(); } catch (e) { console.error(e); }
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('loginBtn'), errEl = $('loginError');
  errEl.classList.remove('visible');
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  if (!username || !password) { errEl.textContent = 'Enter both username and password.'; errEl.classList.add('visible'); return; }

  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    let user = null, viaSP = false; const lc = lulCfg(), spOn = lc.on && lc.pwOn;
    if (spOn) {   // username + password are validated against the SharePoint list
      btn.textContent = 'Checking SharePoint…'; const r = await lulLogin(username, password);
      if (r.state === 'ok') { user = r.user; viaSP = true; }
      else if (r.state === 'bad' || r.state === 'off') { errEl.textContent = r.msg; errEl.classList.add('visible'); try { addActivity('auth', 'Sign-in refused: ' + username + ' (' + r.state + ')'); } catch (e) {} return; }
    }
    if (!viaSP) {
      user = findUser(username);
      if (!user) { errEl.textContent = spOn ? 'SharePoint could not be reached — only administrators can sign in offline.' : 'Invalid username or password.'; errEl.classList.add('visible'); return; }
      const hash = await hashPassword(password, user.salt);
      if (hash !== user.hash) { errEl.textContent = 'Invalid username or password.'; errEl.classList.add('visible'); return; }
      if (spOn && !(user.builtin || (lc.adm && user.role === 'admin'))) { errEl.textContent = 'SharePoint (' + lc.list + ') could not be reached — only administrators can sign in while it is offline. Try again in a moment.'; errEl.classList.add('visible'); return; }
    }
    if (user.mustChangePassword && !viaSP) {
      const newPass = prompt('First-time sign-in. Set a new password (min 6 characters):');
      if (!newPass || newPass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.add('visible'); return; }
      const newSalt = randomSalt();
      user.salt = newSalt;
      user.hash = await hashPassword(newPass, newSalt);
      user.mustChangePassword = false;
    }
    user.lastLogin = Date.now();
    saveUsers();
    currentUser = user;
    saveSession();
    showApp();
    applyPermissions();
    onLoginComplete();
  } catch (err) {
    errEl.textContent = 'Sign-in error: ' + err.message;
    errEl.classList.add('visible');
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
});

$('logoutBtn').addEventListener('click', () => {
  if (!confirm('Sign out?')) return;
  currentUser = null;
  saveSession();
  addActivity('auth', 'Signed out');
  showLogin();
});

function onLoginComplete() {
  $('userName').textContent = currentUser.displayName;
  $('userRole').textContent = ROLES[currentUser.role].label;
  $('userRole').className = 'user-role ' + currentUser.role;
  $('userAvatar').textContent = (currentUser.displayName || '?').charAt(0).toUpperCase();
  addActivity('auth', `Signed in as ${currentUser.username}`);
  activityLog = []; loadActivity(); renderActivity();
  loadProfiles(); renderProfileSwitcher();
  if (!exporterPicker) {
    exporterPicker = createListPicker(document.querySelector('[data-list-picker="exporter"]'), {
      getSiteUrl: () => getGlobalSiteUrl(),
      getToken: () => getGlobalAccessToken(),
      onChange: () => {},
    });
  }
  if (!editorPicker) {
    editorPicker = createListPicker(document.querySelector('[data-list-picker="editor"]'), {
      getSiteUrl: () => getGlobalSiteUrl(),
      getToken: () => getGlobalAccessToken(),
      onChange: () => {},
    });
  }
  reloadProfileData();
  renderProfilesView();
  renderUsersView();
  loadNotificationSettings();
  applyGlobalSettingsToUI();
  w_initBatchListPicker();
  w_restoreBatchListName();
  w_initUomListPicker();
  dtrk_init();
  inc_initListPicker();
  /* Draw empty mapping tables so the user sees the structure right away */
 try { wFefoMap_render(); } catch (e) {}
 eml_boot();
}

function applyPermissions() {
  document.querySelectorAll('.nav-item[data-perm]').forEach(el => {
    const perm = el.dataset.perm;
    if (!hasPerm(perm)) { el.classList.add('locked'); el.style.pointerEvents = 'none'; }
    else { el.classList.remove('locked'); el.style.pointerEvents = ''; }
  });
  try { navApply(); acApplyNav(); } catch (e) {}
  document.querySelectorAll('.editor-tab[data-perm]').forEach(el => {
    const perm = el.dataset.perm;
    if (!hasPerm(perm)) { el.classList.add('locked'); el.style.pointerEvents = 'none'; }
    else { el.classList.remove('locked'); el.style.pointerEvents = ''; }
  });
  document.querySelectorAll('button[data-perm]').forEach(el => {
    el.style.display = hasPerm(el.dataset.perm) ? '' : 'none';
  });
  const editorNotice = $('editorPermNotice');
  if (!hasPerm('editor-add') && !hasPerm('editor-edit')) {
    editorNotice.style.display = 'block';
    editorNotice.textContent = '⚠ Your role only allows viewing records. Contact an administrator for edit rights.';
  } else if (!hasPerm('editor-bulk')) {
    editorNotice.style.display = 'block';
    editorNotice.textContent = '⚠ Bulk and Inline editing require Admin role.';
  } else editorNotice.style.display = 'none';
  const uploaderNotice = $('uploaderPermNotice');
  if (!hasPerm('uploader')) {
    uploaderNotice.style.display = 'block';
    uploaderNotice.textContent = '⚠ Your role does not allow uploads. Contact an administrator.';
  } else uploaderNotice.style.display = 'none';
  const warehouseNotice = $('warehousePermNotice');
  if (warehouseNotice) {
    if (!hasPerm('uploader')) {
      warehouseNotice.style.display = 'block';
      warehouseNotice.textContent = '⚠ Your role does not allow warehouse operations. Contact an administrator.';
    } else warehouseNotice.style.display = 'none';
  }
  const incNotice = $('incuploadPermNotice');
  if (incNotice) {
    if (!hasPerm('uploader')) {
      incNotice.style.display = 'block';
      incNotice.textContent = '⚠ Your role does not allow uploads. Contact an administrator.';
    } else incNotice.style.display = 'none';
  }
  ['setXlStyle', 'setXlCompany', 'setXlPrev'].forEach(id => { const g = $(id) && $(id).closest('.form-group'); if (g) g.style.display = featOk('xlstyle') ? '' : 'none'; });
  const lc = $('lulCard'); if (lc) lc.style.display = isAdmin() ? '' : 'none'; const bc = document.querySelector('#brandCard'); if (bc) bc.style.display = isAdmin() ? '' : 'none';
  const gsc = $('globalSettingsCard');
  if (gsc) gsc.style.display = isAdmin() ? '' : 'none';
  const activeView = document.querySelector('.view.active')?.id?.replace('view-', '');
  if (activeView) {
    const navEl = document.querySelector(`.nav-item[data-view="${activeView}"]`);
    if (navEl && navEl.classList.contains('locked')) {
      const firstAvailable = document.querySelector('.nav-item:not(.locked)[data-view]');
      if (firstAvailable) firstAvailable.click();
    }
  }
}

function applyEditorListPermission(canEdit) {
  const gatedTabs = ['add', 'edit', 'bulk', 'inline', 'json'];
  gatedTabs.forEach(name => {
    const tab = document.querySelector(`.editor-tab[data-tab="${name}"]`);
    if (!tab) return;
    if (!canEdit) { tab.classList.add('locked'); tab.style.pointerEvents = 'none'; }
    else {
      const perm = tab.dataset.perm;
      if (perm && !hasPerm(perm)) { tab.classList.add('locked'); tab.style.pointerEvents = 'none'; }
      else { tab.classList.remove('locked'); tab.style.pointerEvents = ''; }
    }
  });
  if (!canEdit) {
    const activeTab = document.querySelector('.editor-tab.active');
    if (activeTab && gatedTabs.includes(activeTab.dataset.tab)) ed_switchTab('history');
  }
  const existing = document.querySelector('#editorListPermNotice');   // real lookup (getElementById returns a stub when missing)
  if (existing) existing.remove();
  if (!canEdit) {
    const banner = document.createElement('div');
    banner.id = 'editorListPermNotice';
    banner.className = 'perm-notice';
    banner.style.marginBottom = '12px';
    banner.textContent = `⚠ You have READ-ONLY access to "${editorState.listName}". Editing is disabled for this list.`;
    const mainArea = $('editorMainArea');
    if (mainArea) mainArea.insertBefore(banner, mainArea.firstChild);
  }
}

/* ============================================================
   List assignment dialog with SEARCH
   ============================================================ */
async function promptListAssignment(user) {
  const siteUrl = getGlobalSiteUrl();
  const token = getGlobalAccessToken();
  if (!siteUrl || !token) { alert('Global Site URL and Token must be configured first.'); return null; }
  let allLists;
  try {
    const key = siteUrl.trim().replace(/\/$/, '').toLowerCase();
    const cached = listsCache.get(key);
    if (cached && cached.lists && cached.lists.length) allLists = cached.lists;
    else {
      const { siteId } = await resolveIdsOnly(siteUrl, token);
      const lists = [];
      let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,name,displayName,webUrl,list&$top=200`;
      while (url) {
        const r = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } }, 'fetch lists for admin picker');
        if (!r.ok) throw new Error(`Failed to load lists (${r.status})`);
        const d = await r.json();
        if (d.value) lists.push(...d.value);
        url = d['@odata.nextLink'] || null;
      }
      listsCache.set(key, { lists, ts: Date.now(), fetching: null });
      allLists = lists;
    }
  } catch (err) { alert('Could not load SharePoint lists: ' + err.message); return null; }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--card);border-radius:8px;padding:24px;max-width:700px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
    const title = document.createElement('h3');
    title.textContent = `List Access for "${user.username}"`;
    title.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:8px;';
    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:12px;color:var(--gray-500);margin-bottom:12px;line-height:1.5;';
    hint.innerHTML = 'Choose which lists this user can <strong>see</strong> and <strong>edit</strong>. Leave ALL unchecked to grant access to every list.';
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'position:relative;margin-bottom:12px;';
    const searchIcon = document.createElement('span');
    searchIcon.textContent = '🔍';
    searchIcon.style.cssText = 'position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;opacity:0.6;pointer-events:none;';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search lists by name...';
    searchInput.style.cssText = 'width:100%;padding:10px 40px 10px 38px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px;font-family:inherit;background:var(--card);color:var(--gray-800);';
    const clearSearchBtn = document.createElement('button');
    clearSearchBtn.type = 'button';
    clearSearchBtn.textContent = '✖';
    clearSearchBtn.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--gray-500);cursor:pointer;padding:4px 8px;border-radius:4px;font-size:12px;display:none;';
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(clearSearchBtn);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;align-items:center;';
    const btnAll = document.createElement('button');
    btnAll.className = 'ghost small'; btnAll.type = 'button'; btnAll.textContent = '☑ Select Visible';
    const btnNone = document.createElement('button');
    btnNone.className = 'ghost small'; btnNone.type = 'button'; btnNone.textContent = '☐ Clear Visible';
    const counter = document.createElement('span');
    counter.style.cssText = 'font-size:12px;color:var(--gray-500);margin-left:auto;font-weight:500;';
    counter.textContent = `${allLists.length} lists`;
    actions.appendChild(btnAll);
    actions.appendChild(btnNone);
    actions.appendChild(counter);

    const tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'flex:1;overflow:auto;border:1px solid var(--border);border-radius:6px;background:var(--gray-50);';
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th style="text-align:left;padding:8px 12px;background:var(--gray-100);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;position:sticky;top:0;z-index:2;">List</th>
      <th style="text-align:center;padding:8px 12px;background:var(--gray-100);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;width:110px;position:sticky;top:0;z-index:2;">Visible</th>
      <th style="text-align:center;padding:8px 12px;background:var(--gray-100);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;width:110px;position:sticky;top:0;z-index:2;">Editable</th>
    </tr>`;
    const tbody = document.createElement('tbody');
    const visibleSet = new Set((user.allowedLists || []).map(n => n.toLowerCase()));
    const editableSet = new Set((user.editableLists || []).map(n => n.toLowerCase()));
    const rowData = [];
    allLists.forEach(l => {
      const listName = l.displayName || l.name;
      const internalName = l.name || '';
      const lc = listName.toLowerCase();
      const tr = document.createElement('tr');
      tr.dataset.searchKey = (listName + ' ' + internalName).toLowerCase();
      tr.innerHTML = `
        <td style="padding:6px 12px;border-bottom:1px solid var(--border);">
          <strong>${escapeHtml(listName)}</strong>
          <div style="font-size:11px;color:var(--gray-400);font-family:Consolas,monospace;">${escapeHtml(internalName)}</div>
        </td>
        <td style="text-align:center;padding:6px 12px;border-bottom:1px solid var(--border);">
          <input type="checkbox" data-list="${escapeHtml(listName)}" data-role="visible" ${visibleSet.has(lc) ? 'checked' : ''} />
        </td>
        <td style="text-align:center;padding:6px 12px;border-bottom:1px solid var(--border);">
          <input type="checkbox" data-list="${escapeHtml(listName)}" data-role="editable" ${editableSet.has(lc) ? 'checked' : ''} />
        </td>
      `;
      tbody.appendChild(tr);
      rowData.push(tr);
    });
    table.appendChild(thead); table.appendChild(tbody); tableWrap.appendChild(table);
    tbody.querySelectorAll('input[data-role="editable"]').forEach(cb => cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        const visCb = e.target.closest('tr').querySelector('input[data-role="visible"]');
        if (visCb) visCb.checked = true;
      }
    }));
    tbody.querySelectorAll('input[data-role="visible"]').forEach(cb => cb.addEventListener('change', (e) => {
      if (!e.target.checked) {
        const edCb = e.target.closest('tr').querySelector('input[data-role="editable"]');
        if (edCb) edCb.checked = false;
      }
    }));
    function applySearchFilter() {
      const q = searchInput.value.trim().toLowerCase();
      let shown = 0;
      rowData.forEach(tr => {
        const match = !q || tr.dataset.searchKey.includes(q);
        tr.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      counter.textContent = q ? `${shown} of ${allLists.length} lists` : `${allLists.length} lists`;
      clearSearchBtn.style.display = q ? 'block' : 'none';
    }
    searchInput.addEventListener('input', applySearchFilter);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchInput.value = ''; applySearchFilter(); } });
    clearSearchBtn.addEventListener('click', () => { searchInput.value = ''; applySearchFilter(); searchInput.focus(); });
    btnAll.addEventListener('click', () => { rowData.forEach(tr => { if (tr.style.display !== 'none') tr.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true); }); });
    btnNone.addEventListener('click', () => { rowData.forEach(tr => { if (tr.style.display !== 'none') tr.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); }); });

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;';
    const summary = document.createElement('span');
    summary.style.cssText = 'font-size:12px;color:var(--gray-600);font-weight:500;';
    function updateSummary() {
      const vis = tbody.querySelectorAll('input[data-role="visible"]:checked').length;
      const ed = tbody.querySelectorAll('input[data-role="editable"]:checked').length;
      if (vis === 0) summary.innerHTML = '<em>No restriction — user will see ALL lists</em>';
      else summary.innerHTML = `<strong>${vis}</strong> visible · <strong>${ed || vis}</strong> editable`;
    }
    tbody.addEventListener('change', updateSummary);
    updateSummary();
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;';
    const btnCancel = document.createElement('button'); btnCancel.className = 'ghost'; btnCancel.type = 'button'; btnCancel.textContent = 'Cancel';
    const btnSave = document.createElement('button'); btnSave.className = 'success'; btnSave.type = 'button'; btnSave.textContent = '💾 Save Permissions';
    btnCancel.addEventListener('click', () => { document.body.removeChild(overlay); resolve(null); });
    btnSave.addEventListener('click', () => {
      const visible = [], editable = [];
      tbody.querySelectorAll('input[data-role="visible"]:checked').forEach(cb => visible.push(cb.dataset.list));
      tbody.querySelectorAll('input[data-role="editable"]:checked').forEach(cb => editable.push(cb.dataset.list));
      document.body.removeChild(overlay);
      resolve({ allowedLists: visible, editableLists: editable });
    });
    btnRow.appendChild(btnCancel); btnRow.appendChild(btnSave);
    footer.appendChild(summary); footer.appendChild(btnRow);
    modal.appendChild(title); modal.appendChild(hint); modal.appendChild(searchWrap);
    modal.appendChild(actions); modal.appendChild(tableWrap); modal.appendChild(footer);
    overlay.appendChild(modal); document.body.appendChild(overlay);
    setTimeout(() => searchInput.focus(), 50);
  });
}

/* ============================================================
   Users view
   ============================================================ */
const EMAIL_RX = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
function emailDefaults() { return { to: (currentUser && currentUser.managerEmail) || '', cc: (currentUser && currentUser.email) || '' }; }
function applyEmailDefaults(toEl, ccEl, force) {
  const d = emailDefaults();
  if (toEl && d.to && (force || !toEl.value.trim())) toEl.value = d.to;
  if (ccEl && d.cc && (force || !ccEl.value.trim())) ccEl.value = d.cc;
}
(function watchEmailModals() {
  [['expEmailModal', 'expEmailTo', 'expEmailCc'], ['dtrkEmailModal', 'dtrkEmTo', 'dtrkEmCc']].forEach(([m, t, c]) => {
    const el = document.querySelector('#' + m); if (!el) return;
    new MutationObserver(() => { if (el.style.display && el.style.display !== 'none') applyEmailDefaults(document.querySelector('#' + t), document.querySelector('#' + c), false); }).observe(el, { attributes: true, attributeFilter: ['style'] });
  });
})();
document.querySelector('#myEmailBtn').addEventListener('click', () => { if (currentUser) userForm_open({ mode: 'me', user: currentUser }); });

/* ---------- User form (add / edit / my email) ---------- */
function userForm_open({ mode, user }) {
  let m = document.querySelector('#userFormModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'userFormModal';
    m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = `<div class="card" style="max-width:560px;width:100%;max-height:92vh;overflow:auto;margin:0;">
      <div class="card-header"><div class="card-title" id="ufTitle">User</div><button id="ufClose" class="ghost small" type="button">✖ Close</button></div>
      <div class="form-grid">
        <div class="form-group" data-uf="username"><label>Username <span class="hint">— no spaces</span></label><input type="text" id="ufUsername" autocomplete="off" /></div>
        <div class="form-group" data-uf="display"><label>Display name</label><input type="text" id="ufDisplay" /></div>
        <div class="form-group" data-uf="role"><label>Role</label><select id="ufRole"><option value="viewer">Viewer</option><option value="operator">Operator</option><option value="admin">Admin</option></select></div>
        <div class="form-group"><label>User email <span class="hint">— added in CC by default when sharing by email</span></label><input type="email" id="ufEmail" placeholder="name@company.com" /></div>
        <div class="form-group"><label>Line manager email <span class="hint">— used in TO by default when sharing by email</span></label><input type="email" id="ufMgr" placeholder="manager@company.com" /></div>
        <div class="form-group" data-uf="loc"><label>Location ID <span class="hint">— the warehouse this user works in. It limits what he sees and is saved with his uploads. Empty or 0 = all locations; several: 4,5</span></label><input type="text" id="ufLoc" placeholder="e.g. 4" /></div>
        <div class="form-group" data-uf="prof"><label>Side-panel profile <span class="hint">— which sections open for this user by default. “Auto” follows his job title (Users page → Default sections by job title)</span></label><select id="ufProf"><option value="">Auto (by job title)</option></select></div>
        <div class="form-group" data-uf="password"><label>Initial password <span class="hint">— min 6 characters</span></label><input type="password" id="ufPassword" autocomplete="new-password" /></div>
      </div>
      <div id="ufStatus" class="status-msg"></div>
      <div class="btn-row" style="margin-top:10px;"><button id="ufSave" class="success" type="button">💾 Save</button><button id="ufCancel" class="ghost" type="button">Cancel</button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m || e.target.id === 'ufClose' || e.target.id === 'ufCancel') m.style.display = 'none'; });
  }
  const q = id => document.querySelector('#' + id), show = (k, on) => { const el = m.querySelector(`[data-uf="${k}"]`); if (el) el.style.display = on ? '' : 'none'; };
  show('username', mode === 'add'); show('display', mode !== 'me'); show('role', mode !== 'me'); show('loc', mode !== 'me'); show('prof', mode !== 'me'); try { tpFillSelect(q('ufProf'), user); } catch (e) {} show('password', mode === 'add');
  q('ufTitle').textContent = mode === 'add' ? '➕ Add User' : mode === 'edit' ? `✏ Edit ${user.username}` : '✉ My email & line manager';
  q('ufUsername').value = ''; q('ufDisplay').value = user ? user.displayName || '' : ''; q('ufRole').value = user ? user.role : 'viewer';
  q('ufEmail').value = user ? user.email || '' : ''; q('ufMgr').value = user ? user.managerEmail || '' : ''; q('ufLoc').value = user ? user.locationId || '' : ''; q('ufPassword').value = '';
  const st = (t, c) => { const el = q('ufStatus'); el.className = 'status-msg ' + (c || 'info'); el.textContent = t; };
  st('');
  const save = q('ufSave'), fresh = save.cloneNode(true); save.parentNode.replaceChild(fresh, save);
  fresh.addEventListener('click', async () => {
    const email = q('ufEmail').value.trim(), mgr = q('ufMgr').value.trim();
    if ((email && !EMAIL_RX.test(email)) || (mgr && !EMAIL_RX.test(mgr))) { st('⚠ One of the email addresses is not valid.', 'warn'); return; }
    fresh.disabled = true;
    try {
      if (mode === 'me') {
        user.email = email; user.managerEmail = mgr;
        const u = users.list.find(x => x.id === user.id); if (u) { u.email = email; u.managerEmail = mgr; }
        saveUsers(); try { renderUsersView(); } catch (x) {}
        addActivity('auth', 'Updated own email settings');
      } else if (mode === 'edit') {
        const role = q('ufRole').value;
        if (user.id === currentUser.id && role !== 'admin' && !confirm('You are demoting yourself. You will lose admin access. Continue?')) { fresh.disabled = false; return; }
        user.displayName = q('ufDisplay').value.trim() || user.username; user.role = role; user.email = email; user.managerEmail = mgr; user.locationId = q('ufLoc').value.trim(); user.locUser = 1; user.profileId = q('ufProf').value; try { navApply(true); } catch (x) {}
        saveUsers();
        if (user.id === currentUser.id) { currentUser = user; applyPermissions(); $('userRole').textContent = ROLES[currentUser.role].label; $('userRole').className = 'user-role ' + currentUser.role; }
        renderUsersView();
        addActivity('auth', `Updated user "${user.username}" (role: ${role})`);
      } else {
        const username = q('ufUsername').value.trim(), password = q('ufPassword').value;
        if (!username) { st('⚠ Enter a username.', 'warn'); fresh.disabled = false; return; }
        if (/\s/.test(username)) { st('⚠ Username cannot contain spaces.', 'warn'); fresh.disabled = false; return; }
        if (findUser(username)) { st('⚠ Username already exists.', 'warn'); fresh.disabled = false; return; }
        if (!password || password.length < 6) { st('⚠ Password must be at least 6 characters.', 'warn'); fresh.disabled = false; return; }
        m.style.display = 'none';
        const assign = await promptListAssignment({ username, allowedLists: [], editableLists: [] });
        if (assign === null) { m.style.display = 'flex'; fresh.disabled = false; return; }
        const salt = randomSalt(), hash = await hashPassword(password, salt);
        users.list.push({ id: uid(), username, displayName: q('ufDisplay').value.trim() || username, role: q('ufRole').value, salt, hash, email, managerEmail: mgr, locationId: q('ufLoc').value.trim(), profileId: q('ufProf').value, mustChangePassword: false, allowedLists: assign.allowedLists, editableLists: assign.editableLists, createdAt: Date.now(), lastLogin: null });
        saveUsers(); renderUsersView(); addActivity('auth', `Created user "${username}"`);
      }
      m.style.display = 'none';
    } catch (e) { st('✘ ' + e.message, 'error'); }
    fresh.disabled = false;
  });
  m.style.display = 'flex';
}
function renderUsersView() {
  const tbody = $('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = users.list.map(u => {
    const visCount = (u.allowedLists || []).length;
    const edCount = (u.editableLists || []).length;
    let listsLabel;
    if (u.role === 'admin') listsLabel = '<em>All (admin)</em>';
    else if (visCount === 0) listsLabel = '<em>All lists (no restriction)</em>';
    else listsLabel = `${visCount} visible · ${edCount || visCount} editable`;
    return `<tr>
      <td><code>${escapeHtml(u.username)}</code>${u.mustChangePassword ? ' <span class="badge required">CHANGE PW</span>' : ''}</td>
      <td>${escapeHtml(u.displayName)}</td>
      <td><span class="badge role-${u.role}">${ROLES[u.role].label}</span></td>
      <td style="font-size:12px;">${u.locationId ? '📍 ' + escapeHtml(u.locationId) : '<em>all</em>'}${u.bu ? '<br><span style="color:var(--gray-500);">' + escapeHtml(u.bu) + '</span>' : ''}${typeof tpLabel === 'function' && tpLabel(u) ? '<br><span style="color:var(--gray-500);">🧭 ' + escapeHtml(tpLabel(u)) + '</span>' : ''}</td>
      <td style="font-size:12px;">${u.email ? escapeHtml(u.email) : '<em>— no email —</em>'}<br><span style="color:var(--gray-500);">Mgr: ${u.managerEmail ? escapeHtml(u.managerEmail) : '—'}</span></td>
      <td style="font-size:12px;">${listsLabel}</td>
      <td>${formatDate(u.createdAt)}</td>
      <td>${u.lastLogin ? formatDate(u.lastLogin) : '—'}</td>
      <td>
        <div class="btn-row">
          <button class="secondary small" data-action="edit" data-id="${u.id}">✏ Edit</button>
          <button class="secondary small" data-action="lists" data-id="${u.id}">📋 Lists</button>
          ${u.role !== 'admin' ? `<button class="secondary small" data-action="sections" data-id="${u.id}">🧭 Sections</button><button class="secondary small" data-action="features" data-id="${u.id}">🎛 Options${u.features && Object.values(u.features).some(v => v === false) ? ' •' : ''}</button>` : ''}
          <button class="secondary small" data-action="reset-pw" data-id="${u.id}">🔑 Reset PW</button>
          ${u.id !== currentUser.id && !u.builtin ? `<button class="danger small icon-only" data-action="delete" data-id="${u.id}">✖</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const user = users.list.find(x => x.id === id);
      if (!user) return;
      const action = btn.dataset.action;
      if (user.builtin && (isBuiltinLocked(user) || action === 'delete')) { alert(action === 'delete' ? 'This built-in administrator account cannot be deleted.' : 'This account can only be changed by the user “' + BUILTIN_USER.username + '”.'); return; }
      if (action === 'edit') {
        userForm_open({ mode: 'edit', user });
      } else if (action === 'sections') {
        acOpen(user);
      } else if (action === 'features') {
        featOpen(user);
      } else if (action === 'lists') {
        const assign = await promptListAssignment(user);
        if (assign === null) return;
        user.allowedLists = assign.allowedLists;
        user.editableLists = assign.editableLists;
        saveUsers();
        renderUsersView();
        addActivity('auth', `Updated list access for "${user.username}"`);
      } else if (action === 'reset-pw') {
        const newPass = prompt(`Set new password for "${user.username}" (min 6 chars):`);
        if (!newPass) return;
        if (newPass.length < 6) { alert('Password must be at least 6 characters.'); return; }
        const newSalt = randomSalt();
        user.salt = newSalt;
        user.hash = await hashPassword(newPass, newSalt);
        user.mustChangePassword = false;
        saveUsers();
        alert(`Password reset for ${user.username}.`);
        addActivity('auth', `Reset password for "${user.username}"`);
      } else if (action === 'delete') {
        if (!confirm(`Delete user "${user.username}"?`)) return;
        users.list = users.list.filter(x => x.id !== id);
        saveUsers();
        renderUsersView();
        addActivity('auth', `Deleted user "${user.username}"`);
      }
    });
  });
}

$('addUserBtn').addEventListener('click', () => userForm_open({ mode: 'add' }));

$('exportUsersBtn').addEventListener('click', () => {
  const includePasswords = confirm(
    'Include password hashes in the export?\n\n' +
    '✅ OK  → Include passwords (users can sign in with their ORIGINAL passwords after import)\n' +
    '❌ Cancel → Strip passwords (users must reset password after import)'
  );
  const dump = {
    exportedAt: Date.now(),
    exportedBy: currentUser?.username || 'unknown',
    version: 1,
    includePasswords,
    users: users.list.map(u => {
      const base = {
        username: u.username, displayName: u.displayName, role: u.role,
        allowedLists: u.allowedLists || [], editableLists: u.editableLists || [],
        mustChangePassword: u.mustChangePassword || false,
        createdAt: u.createdAt, lastLogin: u.lastLogin,
        email: u.email || '', managerEmail: u.managerEmail || '', locationId: u.locationId || '', bu: u.bu || '', region: u.region || '', lineMngr: u.lineMngr || '', accessLevel: u.accessLevel || '', empId: u.empId || '', jobTitle: u.jobTitle || '',
      };
      if (includePasswords) { base.salt = u.salt; base.hash = u.hash; }
      return base;
    }),
  };
  const filename = includePasswords ? `sp_users_WITH_PASSWORDS_${Date.now()}.json` : `sp_users_${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  addActivity('auth', `Exported ${users.list.length} users ${includePasswords ? '(with passwords)' : '(no passwords)'}`);
});

async function importUsersFromFile(file) {
  let dump;
  try { dump = JSON.parse(await file.text()); } catch (err) { alert('Invalid JSON file: ' + err.message); return; }
  if (!dump.users || !Array.isArray(dump.users)) { alert('Invalid file format: missing "users" array.'); return; }
  const total = dump.users.length;
  const hasPasswords = dump.includePasswords === true && dump.users.every(u => u.salt && u.hash);
  const modeChoice = prompt(
    `Import ${total} user(s) from file.\n\n` +
    `Passwords in file: ${hasPasswords ? 'YES' : 'NO (users must reset)'}\n\n` +
    `Choose import mode:\n` +
    `  1 = MERGE  — Add new users, keep existing ones untouched\n` +
    `  2 = REPLACE — Delete ALL existing users and import fresh\n` +
    `  3 = UPDATE — For users that exist, update their info\n\n` +
    `Enter 1, 2, or 3:`, '3'
  );
  if (!modeChoice) return;
  const mode = modeChoice.trim();
  if (!['1', '2', '3'].includes(mode)) { alert('Invalid choice. Import cancelled.'); return; }
  if (mode === '2') {
    if (!confirm(`⚠ DANGER: This will DELETE all ${users.list.length} existing users and replace them with ${total} imported users.`)) return;
  }
  let added = 0, updated = 0, skipped = 0;
  const errors = [];
  if (mode === '2') users.list = [];
  for (const incoming of dump.users) {
    try {
      if (!incoming.username || !incoming.role) { skipped++; errors.push(`Missing username or role`); continue; }
      if (!ROLES[incoming.role]) { skipped++; errors.push(`Invalid role "${incoming.role}"`); continue; }
      const existing = users.list.find(u => u.username.toLowerCase() === incoming.username.toLowerCase());
      const record = {
        id: existing?.id || incoming.id || uid(),
        username: incoming.username,
        displayName: incoming.displayName || incoming.username,
        role: incoming.role,
        allowedLists: Array.isArray(incoming.allowedLists) ? incoming.allowedLists : [],
        editableLists: Array.isArray(incoming.editableLists) ? incoming.editableLists : [],
        createdAt: incoming.createdAt || Date.now(),
        lastLogin: incoming.lastLogin || null,
        email: incoming.email || existing?.email || '', managerEmail: incoming.managerEmail || existing?.managerEmail || '', locationId: incoming.locationId != null ? String(incoming.locationId) : (existing?.locationId || ''), bu: incoming.bu || '', region: incoming.region || '', lineMngr: incoming.lineMngr || '', accessLevel: incoming.accessLevel || '', empId: incoming.empId || '', jobTitle: incoming.jobTitle || '',
      };
      if (hasPasswords && incoming.salt && incoming.hash) {
        record.salt = incoming.salt;
        record.hash = incoming.hash;
        record.mustChangePassword = incoming.mustChangePassword === true;
      } else {
        record.salt = randomSalt();
        record.hash = await hashPassword('changeme123', record.salt);
        record.mustChangePassword = true;
      }
      if (existing) {
        if (mode === '1') { skipped++; continue; }
        Object.assign(existing, record);
        updated++;
      } else {
        users.list.push(record);
        added++;
      }
    } catch (err) { skipped++; errors.push(`"${incoming.username}": ${err.message}`); }
  }
  const adminCount = users.list.filter(u => u.role === 'admin').length;
  if (adminCount === 0) {
    alert('⚠ Import would leave the system with NO admin users. Aborting.');
    return;
  }
  saveUsers();
  renderUsersView();
  const stillExists = users.list.find(u => u.id === currentUser?.id);
  if (!stillExists) {
    alert(`Import complete!\n\nAdded: ${added}\nUpdated: ${updated}\nSkipped: ${skipped}\n\nYou will now be signed out.`);
    currentUser = null;
    saveSession();
    showLogin();
  } else {
    currentUser = users.list.find(u => u.id === currentUser.id);
    applyPermissions();
    $('userRole').textContent = ROLES[currentUser.role].label;
    $('userRole').className = 'user-role ' + currentUser.role;
    let msg = `Import complete!\n\nAdded: ${added}\nUpdated: ${updated}\nSkipped: ${skipped}`;
    if (!hasPasswords) msg += `\n\n⚠ Imported users must set a new password on first sign-in (default: changeme123).`;
    if (errors.length) msg += `\n\nErrors:\n${errors.slice(0, 5).join('\n')}`;
    alert(msg);
  }
  addActivity('auth', `Imported users (mode: ${mode}, added: ${added}, updated: ${updated}, skipped: ${skipped})`);
}

$('importUsersBtn').addEventListener('click', () => $('importUsersInput').click());
$('importUsersInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try { await importUsersFromFile(file); } finally { e.target.value = ''; }
});

$('changePasswordBtn').addEventListener('click', async () => {
  if (!currentUser) return;
  const oldPass = prompt('Current password:');
  if (oldPass === null) return;
  const oldHash = await hashPassword(oldPass, currentUser.salt);
  if (oldHash !== currentUser.hash) { alert('Current password is incorrect.'); return; }
  const newPass = prompt('New password (min 6 chars):');
  if (!newPass || newPass.length < 6) { alert('Password must be at least 6 characters.'); return; }
  const confirmPass = prompt('Confirm new password:');
  if (newPass !== confirmPass) { alert('Passwords do not match.'); return; }
  const newSalt = randomSalt();
  currentUser.salt = newSalt;
  currentUser.hash = await hashPassword(newPass, newSalt);
  currentUser.mustChangePassword = false;
  saveUsers();
  alert('Password changed successfully.');
  addActivity('auth', 'Changed own password');
});

