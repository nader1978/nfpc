/* ============================================================
   SCHEDULES
   ============================================================ */
const schedules = [];
function loadSchedulesFromStorage() { schedules.length = 0; try { const raw = localStorage.getItem(profileKey('schedules')); if (raw) JSON.parse(raw).forEach(s => schedules.push({ ...s, timer: null, running: false, nextRun: null, lastRun: null })); } catch (e) {} }
function persistSchedules() { try { localStorage.setItem(profileKey('schedules'), JSON.stringify(schedules.map(s => ({ id: s.id, name: s.name, listName: s.listName, intervalMin: s.intervalMin, filterState: s.filterState, columns: s.columns, format: s.format, enabled: s.enabled, notifyOnFailure: s.notifyOnFailure })))); } catch (e) {} }
function renderSchedules() {
  const c = $('schedulesContainer');
  if (!schedules.length) { c.innerHTML = '<p class="text-sm" style="margin:4px 0;">No schedules yet.</p>'; $('navSchedulerBadge').textContent = '0'; return; }
  c.innerHTML = '';
  schedules.forEach(s => {
    const card = document.createElement('div'); card.className = 'schedule-card';
    const st = s.running ? 'running' : (s.enabled ? 'running' : 'paused');
    const nt = s.notifyOnFailure ? ' <span class="badge new">NOTIFY</span>' : '';
    card.innerHTML = `<div class="schedule-info"><div class="schedule-title">${escapeHtml(s.name || s.listName)}${nt}</div><div class="schedule-meta"><strong>${escapeHtml(s.listName)}</strong> · every ${s.intervalMin} min · ${s.format.toUpperCase()}</div><div class="schedule-meta"><span class="schedule-status ${st}">${st}</span>${s.nextRun ? ` · next in ${Math.max(0, Math.round((s.nextRun - Date.now()) / 1000))}s` : ''}${s.lastRun ? ` · last ${formatDate(s.lastRun)}` : ''}</div></div>
    <div class="schedule-actions btn-row"><button class="secondary small" data-action="toggle" data-id="${s.id}">${s.enabled ? '⏸ Pause' : '▶ Resume'}</button><button class="secondary small" data-action="run" data-id="${s.id}">▶ Run Now</button><button class="danger small icon-only" data-action="delete" data-id="${s.id}">✖</button></div>`;
    card.querySelector('[data-action="toggle"]').addEventListener('click', () => { s.enabled = !s.enabled; if (s.enabled) startSchedule(s); else stopSchedule(s); persistSchedules(); renderSchedules(); });
    card.querySelector('[data-action="run"]').addEventListener('click', () => runScheduleOnce(s));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => { if (!confirm(`Delete "${s.name}"?`)) return; stopSchedule(s); const i = schedules.findIndex(x => x.id === s.id); if (i >= 0) schedules.splice(i, 1); persistSchedules(); renderSchedules(); });
    c.appendChild(card);
  });
  $('navSchedulerBadge').textContent = String(schedules.filter(s => s.enabled).length);
}
function startSchedule(s) { stopSchedule(s); const iv = Math.max(60 * 1000, s.intervalMin * 60 * 1000); s.nextRun = Date.now() + iv; s.timer = setInterval(async () => { await runScheduleOnce(s); s.nextRun = Date.now() + iv; }, iv); }
function stopSchedule(s) { if (s.timer) clearInterval(s.timer); s.timer = null; s.nextRun = null; }
async function runScheduleOnce(s) {
  const token = getGlobalAccessToken();
  const siteUrl = getGlobalSiteUrl();
  if (!token || !siteUrl) { addActivity('error', `Schedule "${s.name}" skipped`); return; }
  if (!isListVisible(s.listName)) { addActivity('error', `Schedule "${s.name}" skipped — no permission`); return; }
  s.running = true; renderSchedules();
  try {
    const { siteId, listId } = await resolveIds(siteUrl, s.listName, token);
    const cols = await fetchColumns(siteId, listId, token);
    const items = await fetchAllItems(siteId, listId, token);
    const fl = (s.filterState || []).map(f => ({ ...f }));
    const filtered = items.filter(it => !fl.length || fl.every(f => e_matchFilter(it.fields?.[f.field], f.op, f.value)));
    const sc = s.columns?.length ? cols.filter(c => s.columns.includes(c.name)) : cols.filter(c => items.some(it => it.fields?.[c.name] !== undefined && it.fields[c.name] !== ''));
    const headers = sc.map(c => c.displayName);
    const data = [headers, ...filtered.map(it => sc.map(c => it.fields?.[c.name] ?? ''))];
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const fn = `${s.name || s.listName}_${ts}`;
    if (s.format === 'csv') {
      const esc = v => { const x = String(v ?? ''); return /[",\n\r]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
      const lines = data.map(r => r.map(esc).join(','));
      const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fn + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } else { const ws = XLSX.utils.aoa_to_sheet(data); ws['!cols'] = headers.map(h => ({ wch: Math.max(12, Math.min(40, h.length + 6)) })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Export'); XLSX.writeFile(wb, fn + '.xlsx'); }
    s.lastRun = Date.now();
    addActivity('schedule', `Schedule "${s.name}" ran — ${filtered.length} rows`);
  } catch (err) { addActivity('error', `Schedule "${s.name}" failed: ${err.message}`); if (s.notifyOnFailure) notifyFailure(`Schedule Failed — ${s.name}`, err.message); }
  finally { s.running = false; renderSchedules(); }
}
function updateTimersUI() {
  const c = $('timersList');
  const active = schedules.filter(s => s.enabled && s.timer);
  if (!active.length) { c.textContent = 'No active timers.'; return; }
  c.innerHTML = active.map(s => { const secs = s.nextRun ? Math.max(0, Math.round((s.nextRun - Date.now()) / 1000)) : 0; return `<div style="margin-bottom:4px;">⏱ <strong>${escapeHtml(s.name || s.listName)}</strong> — next ${secs}s</div>`; }).join('');
}
$('addScheduleBtn').addEventListener('click', () => {
  const listName = prompt('List Name:', exporterPicker?.getValue() || ''); if (!listName) return;
  if (!isListVisible(listName)) { alert('You do not have permission to access that list.'); return; }
  const name = prompt('Schedule name:', listName); if (!name) return;
  const intervalMin = parseInt(prompt('Interval in minutes:', '30'), 10); if (!intervalMin) return;
  const format = (prompt('Format (xlsx / csv):', 'xlsx') || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  const notifyOnFailure = confirm('Send email on failure?');
  const s = { id: uid(), name, listName, intervalMin, filterState: expState.filters.map(f => ({ ...f })), columns: expState.selectedColumns.slice(), format, enabled: true, notifyOnFailure, timer: null, nextRun: null, lastRun: null };
  schedules.push(s); startSchedule(s); persistSchedules(); renderSchedules();
});
$('expScheduleBtn').addEventListener('click', () => {
  if (!hasPerm('scheduler')) { alert('Permission denied.'); return; }
  if (!expState.lastConfig) { e_setStatus('Load a list first.', 'warn'); return; }
  const name = prompt('Schedule name:', expState.lastConfig.listName); if (!name) return;
  const intervalMin = parseInt(prompt('Interval in minutes:', '30'), 10); if (!intervalMin) return;
  const format = (prompt('Format (xlsx / csv):', 'xlsx') || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  const notifyOnFailure = confirm('Send email on failure?');
  const s = { id: uid(), name, listName: expState.lastConfig.listName, intervalMin, filterState: expState.filters.map(f => ({ ...f })), columns: expState.selectedColumns.slice(), format, enabled: true, notifyOnFailure, timer: null, nextRun: null, lastRun: null };
  schedules.push(s); startSchedule(s); persistSchedules(); renderSchedules();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('.nav-item[data-view="scheduler"]').classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-scheduler').classList.add('active');
  $('topbarTitle').textContent = VIEW_META.scheduler.title; $('topbarSub').textContent = VIEW_META.scheduler.sub;
});
const uploadSchedules = [];
function loadUploadSchedulesFromStorage() { uploadSchedules.length = 0; try { const raw = localStorage.getItem(profileKey('upload_schedules')); if (raw) JSON.parse(raw).forEach(s => uploadSchedules.push({ ...s, timer: null, running: false, nextRun: null, lastRun: null })); } catch (e) {} }
function persistUploadSchedules() { try { localStorage.setItem(profileKey('upload_schedules'), JSON.stringify(uploadSchedules.map(s => ({ id: s.id, name: s.name, intervalMin: s.intervalMin, dataSource: s.dataSource, sourceUrl: s.sourceUrl, sourceFileName: s.sourceFileName, sourceFileContent: s.sourceFileContent, targetsSnapshot: s.targetsSnapshot, enabled: s.enabled, notifyOnFailure: s.notifyOnFailure })))); } catch (e) {} }
function renderUploadSchedules() {
  const c = $('uploadSchedulesContainer');
  if (!uploadSchedules.length) { c.innerHTML = '<p class="text-sm" style="margin:4px 0;">No upload schedules yet.</p>'; $('navSchedulerUploadBadge').textContent = '0'; return; }
  c.innerHTML = '';
  uploadSchedules.forEach(s => {
    const card = document.createElement('div'); card.className = 'schedule-card';
    const st = s.running ? 'running' : (s.enabled ? 'running' : 'paused');
    const src = s.dataSource === 'url' ? `URL: ${truncate(s.sourceUrl, 40)}` : s.dataSource === 'file' ? `File: ${s.sourceFileName || ''}` : 'Same file';
    const nt = s.notifyOnFailure ? ' <span class="badge new">NOTIFY</span>' : '';
    card.innerHTML = `<div class="schedule-info"><div class="schedule-title">${escapeHtml(s.name)}${nt}</div><div class="schedule-meta">${escapeHtml(src)} · every ${s.intervalMin} min · ${s.targetsSnapshot.length} target(s)</div><div class="schedule-meta"><span class="schedule-status ${st}">${st}</span>${s.nextRun ? ` · next ${Math.max(0, Math.round((s.nextRun - Date.now()) / 1000))}s` : ''}${s.lastRun ? ` · last ${formatDate(s.lastRun)}` : ''}</div></div>
    <div class="schedule-actions btn-row"><button class="secondary small" data-action="toggle" data-id="${s.id}">${s.enabled ? '⏸ Pause' : '▶ Resume'}</button><button class="secondary small" data-action="run" data-id="${s.id}">▶ Run Now</button><button class="danger small icon-only" data-action="delete" data-id="${s.id}">✖</button></div>`;
    card.querySelector('[data-action="toggle"]').addEventListener('click', () => { s.enabled = !s.enabled; if (s.enabled) startUploadSchedule(s); else stopUploadSchedule(s); persistUploadSchedules(); renderUploadSchedules(); });
    card.querySelector('[data-action="run"]').addEventListener('click', () => runUploadScheduleOnce(s));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => { if (!confirm(`Delete "${s.name}"?`)) return; stopUploadSchedule(s); const i = uploadSchedules.findIndex(x => x.id === s.id); if (i >= 0) uploadSchedules.splice(i, 1); persistUploadSchedules(); renderUploadSchedules(); });
    c.appendChild(card);
  });
  $('navSchedulerUploadBadge').textContent = String(uploadSchedules.filter(s => s.enabled).length);
}
function startUploadSchedule(s) { stopUploadSchedule(s); const iv = Math.max(60 * 1000, s.intervalMin * 60 * 1000); s.nextRun = Date.now() + iv; s.timer = setInterval(async () => { await runUploadScheduleOnce(s); s.nextRun = Date.now() + iv; }, iv); }
function stopUploadSchedule(s) { if (s.timer) clearInterval(s.timer); s.timer = null; s.nextRun = null; }
async function runUploadScheduleOnce(s) {
  const token = getGlobalAccessToken();
  if (!token) { addActivity('error', `Upload schedule "${s.name}" skipped`); return; }
  s.running = true; spUp.quiet++; renderUploadSchedules();
  try {
    let rows;
    if (s.dataSource === 'url') rows = await fetchDataFromUrl(s.sourceUrl);
    else if (s.dataSource === 'same' && uploadState.parsedRows.length) rows = uploadState.parsedRows;
    else if (s.dataSource === 'file' && s.sourceFileContent) { const blob = base64ToBlob(s.sourceFileContent); const f = new File([blob], s.sourceFileName); rows = await parseFileToRows(f); }
    else throw new Error('No data source');
    if (!rows.length) throw new Error('Source returned no rows');
    const siteUrl = getGlobalSiteUrl();
    for (const t of s.targetsSnapshot) { if (!t.siteId || !t.listId) { const ids = await resolveIds(siteUrl, t.listName, token); t.siteId = ids.siteId; t.listId = ids.listId; } }
    const { totalSuccess, totalFailed, errors } = await performUpload(rows, s.targetsSnapshot, token);
    s.lastRun = Date.now();
    if (totalFailed === 0) addActivity('upload', `Upload schedule "${s.name}" — ${totalSuccess} created`);
    else { addActivity('error', `Upload schedule "${s.name}": ${totalFailed} failed`); if (s.notifyOnFailure) notifyFailure(`Upload Schedule Failed — ${s.name}`, `${totalFailed} failures.\n\n${errors.slice(0, 5).join('\n')}`); }
  } catch (err) { addActivity('error', `Upload schedule "${s.name}" failed: ${err.message}`); if (s.notifyOnFailure) notifyFailure(`Upload Schedule Failed — ${s.name}`, err.message); }
  finally { s.running = false; setTimeout(() => { spUp.quiet = Math.max(0, spUp.quiet - 1); }, 4000); renderUploadSchedules(); }
}
function updateUploadTimersUI() {
  const c = $('uploadTimersList');
  const active = uploadSchedules.filter(s => s.enabled && s.timer);
  if (!active.length) { c.textContent = 'No active timers.'; return; }
  c.innerHTML = active.map(s => { const secs = s.nextRun ? Math.max(0, Math.round((s.nextRun - Date.now()) / 1000)) : 0; return `<div style="margin-bottom:4px;">⏱ <strong>${escapeHtml(s.name)}</strong> — next ${secs}s</div>`; }).join('');
}
function base64ToBlob(b64) { const p = b64.split(','); const mime = p[0].match(/:(.*?);/)[1]; const raw = atob(p[1]); const arr = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i); return new Blob([arr], { type: mime }); }
async function fileToBase64(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }
$('scheduleUploadBtn').addEventListener('click', async () => {
  if (!hasPerm('scheduler-upload')) { alert('Permission denied.'); return; }
  const name = prompt('Schedule name:', 'Scheduled Upload'); if (!name) return;
  const intervalMin = parseInt(prompt('Interval in minutes:', '60'), 10); if (!intervalMin) return;
  const notifyOnFailure = confirm('Send email on failure?');
  const src = prompt('Data source:\n1 = URL\n2 = Same file currently loaded\n3 = Fixed file', '2'); if (!src) return;
  let dataSource = 'same', sourceUrl = null, sourceFileName = null, sourceFileContent = null;
  if (src === '1') { sourceUrl = prompt('URL:'); if (!sourceUrl) return; dataSource = 'url'; }
  else if (src === '3') { const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls,.csv'; input.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; if (typeof upConfirm === 'function' && !(await upConfirm([f], 'schedule source file'))) return; sourceFileName = f.name; sourceFileContent = await fileToBase64(f); dataSource = 'file'; create(); }; input.click(); return; }
  create();
  function create() {
    const snap = uploadState.targets.map(t => ({ id: t.id, listName: t.listName, filter: t.filter, mapping: { ...t.mapping }, siteId: t.siteId, listId: t.listId, columns: t.columns.slice() }));
    const s = { id: uid(), name, intervalMin, dataSource, sourceUrl, sourceFileName, sourceFileContent, targetsSnapshot: snap, enabled: true, notifyOnFailure, timer: null, nextRun: null, lastRun: null };
    uploadSchedules.push(s); startUploadSchedule(s); persistUploadSchedules(); renderUploadSchedules();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.nav-item[data-view="scheduler-upload"]').classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('view-scheduler-upload').classList.add('active');
    $('topbarTitle').textContent = VIEW_META['scheduler-upload'].title; $('topbarSub').textContent = VIEW_META['scheduler-upload'].sub;
  }
});
$('addUploadScheduleBtn').addEventListener('click', () => { if (!uploadState.parsedRows.length) { alert('Load a file first.'); return; } $('scheduleUploadBtn').click(); });

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
let notificationSettings = { serviceId: '', templateId: '', publicKey: '', recipient: '', enabled: false };
function loadNotificationSettings() {
  try { const raw = localStorage.getItem(profileKey('notifications')); if (raw) notificationSettings = { ...notificationSettings, ...JSON.parse(raw) }; } catch (e) {}
  $('ejServiceId').value = notificationSettings.serviceId || '';
  $('ejTemplateId').value = notificationSettings.templateId || '';
  $('ejPublicKey').value = notificationSettings.publicKey || '';
  $('ejRecipient').value = notificationSettings.recipient || '';
  if (notificationSettings.publicKey && window.emailjs) { try { emailjs.init({ publicKey: notificationSettings.publicKey }); } catch (e) {} }
}
function saveNotificationSettings() {
  notificationSettings = { serviceId: $('ejServiceId').value.trim(), templateId: $('ejTemplateId').value.trim(), publicKey: $('ejPublicKey').value.trim(), recipient: $('ejRecipient').value.trim(), enabled: !!( $('ejServiceId').value.trim() && $('ejTemplateId').value.trim() && $('ejPublicKey').value.trim() && $('ejRecipient').value.trim() ) };
  try { localStorage.setItem(profileKey('notifications'), JSON.stringify(notificationSettings)); } catch (e) {}
  if (notificationSettings.publicKey && window.emailjs) { try { emailjs.init({ publicKey: notificationSettings.publicKey }); } catch (e) {} }
}
$('saveNotificationsBtn').addEventListener('click', () => { saveNotificationSettings(); const el = $('notificationsStatus'); el.className = 'status-msg success'; el.textContent = '✅ Saved.'; setTimeout(() => { el.style.display = 'none'; el.className = 'status-msg'; }, 2500); });
$('testNotificationBtn').addEventListener('click', async () => {
  saveNotificationSettings(); const el = $('notificationsStatus');
  if (!notificationSettings.enabled) { el.className = 'status-msg warn'; el.textContent = '⚠ Fill in all fields.'; return; }
  el.className = 'status-msg info'; el.textContent = 'Sending...';
  try { await sendEmail('Test', 'Test', 'Test from SP Data Manager.'); el.className = 'status-msg success'; el.textContent = '✅ Sent.'; }
  catch (err) { el.className = 'status-msg error'; el.textContent = '✘ ' + err.message; }
});
async function sendEmail(kind, subject, message) {
  if (!notificationSettings.enabled || !window.emailjs) throw new Error('EmailJS not configured');
  await emailjs.send(notificationSettings.serviceId, notificationSettings.templateId, { kind, subject, message, profile: getActiveProfile()?.name || 'Default', user: currentUser?.username || 'unknown', timestamp: formatDate(Date.now()), to_email: notificationSettings.recipient });
}
async function notifyFailure(subject, message) {
  if (/Stopped by user/i.test(String(arguments[1] ?? ''))) return;
  if (!notificationSettings.enabled) return;
  try { await sendEmail('Error', subject, message); addActivity('email', `Sent: ${subject}`); }
  catch (err) { addActivity('error', `Email failed: ${err.message}`); }
}

/* ============================================================
   Profiles view
   ============================================================ */
function renderProfilesView() {
  const c = $('profilesContainer'); c.innerHTML = '';
  profiles.list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'profile-card' + (p.id === profiles.activeId ? ' active' : '');
    const isA = p.id === profiles.activeId;
    card.innerHTML = `<div class="profile-header"><div><div class="profile-name">${escapeHtml(p.name)}${isA ? ' <span class="profile-badge active">Active</span>' : ''}</div><div class="profile-meta">${escapeHtml(p.defaultList || '(no default list)')} · created ${formatDate(p.createdAt)}</div></div>
    <div class="btn-row">${!isA ? `<button class="secondary small" data-action="switch" data-id="${p.id}">Switch</button>` : ''}<button class="secondary small" data-action="rename" data-id="${p.id}">Rename</button><button class="secondary small" data-action="duplicate" data-id="${p.id}">Duplicate</button>${profiles.list.length > 1 ? `<button class="danger small icon-only" data-action="delete" data-id="${p.id}">✖</button>` : ''}</div></div>`;
    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.action, t = profiles.list.find(x => x.id === btn.dataset.id);
        if (!t) return;
        if (a === 'switch') { profiles.activeId = t.id; saveProfiles(); renderProfileSwitcher(); renderProfilesView(); reloadProfileData(); }
        else if (a === 'rename') { const n = prompt('New name:', t.name); if (n && n.trim()) { t.name = n.trim(); saveProfiles(); renderProfileSwitcher(); renderProfilesView(); } }
        else if (a === 'duplicate') { const np = { ...t, id: uid(), name: t.name + ' (copy)', createdAt: Date.now() }; profiles.list.push(np); copyProfileStorage(t.id, np.id); saveProfiles(); renderProfileSwitcher(); renderProfilesView(); }
        else if (a === 'delete') { if (!confirm(`Delete profile "${t.name}"?`)) return; deleteProfileStorage(t.id); profiles.list = profiles.list.filter(x => x.id !== t.id); if (profiles.activeId === t.id) profiles.activeId = profiles.list[0].id; saveProfiles(); renderProfileSwitcher(); renderProfilesView(); reloadProfileData(); }
      });
    });
    c.appendChild(card);
  });
}
function copyProfileStorage(from, to) { ['targets','schedules','upload_schedules','notifications','activity'].forEach(k => { try { const v = localStorage.getItem(userKeyPrefix() + "_profile_" + from + "_" + k); if (v) localStorage.setItem(userKeyPrefix() + "_profile_" + to + "_" + k, v); } catch (e) {} }); }
function deleteProfileStorage(id) { Object.keys(localStorage).forEach(k => { if (k.startsWith(userKeyPrefix() + "_profile_" + id + "_")) localStorage.removeItem(k); }); }
$('addProfileBtn').addEventListener('click', () => { const name = prompt('New profile name:', 'New Profile'); if (!name || !name.trim()) return; profiles.list.push({ id: uid(), name: name.trim(), createdAt: Date.now(), defaultList: "" }); saveProfiles(); renderProfileSwitcher(); renderProfilesView(); });
$('exportProfilesBtn').addEventListener('click', () => {
  const dump = { profiles: profiles.list, activeId: profiles.activeId, data: {} };
  profiles.list.forEach(p => { dump.data[p.id] = {}; ['targets','schedules','upload_schedules','notifications'].forEach(k => { try { const v = localStorage.getItem(userKeyPrefix() + "_profile_" + p.id + "_" + k); if (v) dump.data[p.id][k] = JSON.parse(v); } catch (e) {} }); });
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `sp_profiles_${Date.now()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});
$('importProfilesBtn').addEventListener('click', () => $('importProfilesInput').click());
$('importProfilesInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const dump = JSON.parse(await file.text());
    if (!dump.profiles || !Array.isArray(dump.profiles)) throw new Error('Invalid file');
    if (!confirm(`Import ${dump.profiles.length} profile(s)?`)) return;
    dump.profiles.forEach(p => { if (!p.id) p.id = uid(); if (!profiles.list.find(x => x.id === p.id)) profiles.list.push(p); });
    if (dump.data) Object.entries(dump.data).forEach(([pid, data]) => Object.entries(data).forEach(([k, v]) => { try { localStorage.setItem(userKeyPrefix() + "_profile_" + pid + "_" + k, JSON.stringify(v)); } catch (e) {} }));
    saveProfiles(); renderProfileSwitcher(); renderProfilesView(); reloadProfileData(); alert('Import complete.');
  } catch (err) { alert('Import failed: ' + err.message); } finally { e.target.value = ''; }
});

/* ============================================================
   Settings
   ============================================================ */
$('saveSettingsBtn').addEventListener('click', () => {
  try {
    const p = getActiveProfile();
    p.defaultList = $('setDefaultList').value.trim();
    saveProfiles();
    exporterPicker?.setValue(p.defaultList); editorPicker?.setValue(p.defaultList);
    const ft = uploadState.targets[0];
    if (ft && !ft.listName) ft.listName = p.defaultList;
    u_persist(); u_renderTargets();
    const el = $('settingsStatus'); el.className = 'status-msg success'; el.textContent = '✅ Personal settings saved.';
    setTimeout(() => { el.style.display = 'none'; el.className = 'status-msg'; }, 2500);
  } catch (e) { const el = $('settingsStatus'); el.className = 'status-msg error'; el.textContent = 'Failed: ' + e.message; }
});
/* ---------- Shared token file ---------- */
const TF_KEY = LS_BASE + '_tokenfile';
function tf_cfg() { try { return Object.assign({ url: '', auto: true }, JSON.parse(localStorage.getItem(TF_KEY) || '{}')); } catch (e) { return { url: '', auto: true }; } }
function tf_set(m, t) { const el = document.querySelector('#tfStatus'); if (el) { el.className = 'status-msg ' + (t || 'info'); el.textContent = m; } }
function tf_exp(tok) { try { const j = JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return j.exp ? j.exp * 1000 : 0; } catch (e) { return 0; } }
function tf_apply(o, source) {
  if (!o || !o.accessToken) throw new Error('The file has no accessToken.');
  const exp = o.expiresAt || tf_exp(o.accessToken);
  if (exp && exp < Date.now()) throw new Error('The token in the file expired on ' + new Date(exp).toLocaleString() + ' — ask the admin to export a fresh file.');
  const cur = loadGlobalSettings();
  if (cur.accessToken === o.accessToken && (!o.siteUrl || cur.siteUrl === o.siteUrl)) return { changed: false, exp };
  saveGlobalSettings(o.siteUrl || cur.siteUrl, o.accessToken);
  if (o.spToken) { try { localStorage.setItem(MS_SP_KEY, o.spToken); } catch (e) {} }
  try { listsCache.clear(); applyGlobalSettingsToUI(); } catch (e) {}
  return { changed: true, exp };
}
async function tf_loadUrl(quiet) {
  const c = tf_cfg(); if (!c.url) { if (!quiet) tf_set('⚠ Enter the token file location first.', 'warn'); return false; }
  try {
    const r = await fetch(c.url, { cache: 'no-store', credentials: 'include' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const res = tf_apply(await r.json());
    tf_set(res.changed ? `✅ Token updated from the shared file${res.exp ? ' (valid until ' + new Date(res.exp).toLocaleString() + ')' : ''}.` : '✓ Shared file read — token already current.', 'success');
    return true;
  } catch (e) { tf_set('✘ Could not use the shared token file: ' + e.message + (location.protocol === 'file:' ? ' (a page opened from a local folder cannot read other files — use "Load from my computer…")' : ''), quiet ? 'warn' : 'error'); return false; }
}
(function tfUi() {
  const c = tf_cfg(); $('tfUrl').value = c.url; $('tfAuto').checked = !!c.auto;
  const save = () => { try { localStorage.setItem(TF_KEY, JSON.stringify({ url: $('tfUrl').value.trim(), auto: $('tfAuto').checked })); } catch (e) {} };
  $('tfUrl').addEventListener('change', save); $('tfAuto').addEventListener('change', save);
  $('tfExportBtn').addEventListener('click', () => {
    if (!isAdmin()) { tf_set('✘ Only administrators can export the token file.', 'error'); return; }
    const g = loadGlobalSettings(); if (!g.siteUrl || !g.accessToken) { tf_set('⚠ Save the Site URL and token above first.', 'warn'); return; }
    const o = { siteUrl: g.siteUrl, accessToken: g.accessToken, spToken: sp_token() || undefined, expiresAt: tf_exp(g.accessToken) || undefined, exportedAt: Date.now(), exportedBy: currentUser ? currentUser.username : '' };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' })); a.download = 'sp_token.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    tf_set('✅ sp_token.json downloaded. Upload it to the shared location and enter that location above.' + (o.expiresAt ? ' It expires ' + new Date(o.expiresAt).toLocaleString() + '.' : ''), 'success');
    addActivity('settings', 'Exported shared token file');
  });
  $('tfLoadBtn').addEventListener('click', () => { save(); tf_loadUrl(false); });
  $('tfPickBtn').addEventListener('click', () => $('tfPickInput').click());
  $('tfPickInput').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const res = tf_apply(JSON.parse(await f.text())); tf_set(res.changed ? '✅ Token loaded from file.' : '✓ Token already current.', 'success'); } catch (x) { tf_set('✘ ' + x.message, 'error'); } });
  const tick = () => { const cc = tf_cfg(); if (cc.url && cc.auto) tf_loadUrl(true); };
  setTimeout(tick, 400); setInterval(tick, 10 * 60 * 1000);
})();
/* Any user can import the token file shared by the admin (valid until the token expires) */
(function importTokenUi() {
  const btn = $('importTokenBtn'), inp = $('importTokenInput');
  btn.addEventListener('click', () => inp.click());
  inp.addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const o = JSON.parse(await f.text()); if (!o || !o.accessToken) throw new Error('This is not a token file (no accessToken found).');
      const res = tf_apply(o);
      const until = res.exp ? ` — valid until ${new Date(res.exp).toLocaleString()}` : '';
      sectionToast(res.changed ? `✅ Token imported${until}` : `✓ This token is already loaded${until}`, 'ok');
      addActivity('settings', `Imported token file ${f.name}`);
      try { syncToken(); } catch (x) {}
    } catch (x) { sectionToast('✘ ' + x.message, 'error'); }
  });
  const pill = document.querySelector('#tokenPill');
  if (pill && !ms_configured()) { pill.style.cursor = 'pointer'; pill.title = 'Click to import a token file'; pill.addEventListener('click', () => inp.click()); }
})();
(function msUi() {
  const c = ms_cfg(); $('msTenant').value = c.tenantId; $('msClient').value = c.clientId;
  $('msSaveBtn').addEventListener('click', () => { if (!isAdmin()) { ms_status('✘ Only administrators can change this.', 'error'); return; } try { localStorage.setItem(MS_CFG_KEY, JSON.stringify({ tenantId: $('msTenant').value.trim(), clientId: $('msClient').value.trim(), siteUrl: $('globalSiteUrl').value.trim() })); ms_app = null; ms_status('✅ Saved on this browser. To give the IDs to every user, also paste them into MS_AUTH_DEFAULT in the HTML file.', 'success'); } catch (e) { ms_status('✘ ' + e.message, 'error'); } });
  $('msSignInBtn').addEventListener('click', () => ms_signIn(true));
  $('msSignOutBtn').addEventListener('click', ms_signOut);
  const pill = document.querySelector('#tokenPill'); if (pill) { pill.style.cursor = 'pointer'; pill.title = 'Click to sign in with Microsoft (when configured)'; pill.addEventListener('click', () => { if (ms_configured()) ms_signIn(true); }); }
  if (ms_configured()) setTimeout(() => ms_signIn(false), 600);   // silent sign-in on load
})();
$('saveGlobalSettingsBtn').addEventListener('click', () => {
  if (!isAdmin()) { const el = $('globalSettingsStatus'); el.className = 'status-msg error'; el.textContent = '✘ Only administrators can change global settings.'; return; }
  const siteUrl = $('globalSiteUrl').value.trim();
  const token = $('globalAccessToken').value.trim();
  if (!siteUrl || !token) { const el = $('globalSettingsStatus'); el.className = 'status-msg warn'; el.textContent = '⚠ Both Site URL and Access Token are required.'; return; }
  try { new URL(siteUrl); } catch (e) { const el = $('globalSettingsStatus'); el.className = 'status-msg error'; el.textContent = '✘ Invalid Site URL format.'; return; }
  saveGlobalSettings(siteUrl, token);
  listsCache.clear();
  applyGlobalSettingsToUI();
  const el = $('globalSettingsStatus'); el.className = 'status-msg success'; el.textContent = '✅ Global settings saved.';
  setTimeout(() => { el.style.display = 'none'; el.className = 'status-msg'; }, 3000);
  addActivity('settings', `Updated global settings (site: ${siteUrl})`);
});
$('testGlobalTokenBtn').addEventListener('click', async () => {
  const el = $('globalSettingsStatus');
  const siteUrl = $('globalSiteUrl').value.trim();
  const token = $('globalAccessToken').value.trim();
  if (!siteUrl || !token) { el.className = 'status-msg warn'; el.textContent = '⚠ Enter Site URL and Token first.'; return; }
  el.className = 'status-msg info'; el.textContent = 'Testing token...';
  try {
    const { siteId } = await resolveIdsOnly(siteUrl, token);
    el.className = 'status-msg success'; el.textContent = `✅ Token is valid. Site ID: ${siteId.slice(0, 40)}...`;
  } catch (err) { el.className = 'status-msg error'; el.textContent = '✘ ' + err.message; }
});
$('clearGlobalSettingsBtn').addEventListener('click', () => {
  if (!isAdmin()) { alert('Permission denied.'); return; }
  if (!confirm('Clear the shared Site URL and Access Token?')) return;
  clearGlobalSettings();
  listsCache.clear();
  applyGlobalSettingsToUI();
  const el = $('globalSettingsStatus'); el.className = 'status-msg warn'; el.textContent = '⚠ Global settings cleared.';
  addActivity('settings', 'Cleared global settings');
});
$('clearStorageBtn').addEventListener('click', () => {
  if (!hasPerm('delete')) { alert('Permission denied.'); return; }
  if (!confirm('Clear YOUR personal data (profiles, schedules, activity)?')) return;
  Object.keys(localStorage).forEach(k => { if (k.startsWith(userKeyPrefix())) localStorage.removeItem(k); });
  location.reload();
});

/* ============================================================
   EXPORTER — Email Results (Outlook draft + .eml + HTML copy)
   Independent column selection: email body vs. attachment.
   ============================================================ */
const expEmailState = {
  lastHtml: '',
  bodyCols: [],
  attachCols: [],
};

const EXP_EMAIL_THEMES = {
  brand:  { headerBg: '#0078d4', headerFg: '#ffffff', altRow: '#f3f8fd', border: '#d0e3f5', accent: '#0078d4' },
  gray:   { headerBg: '#f3f2f1', headerFg: '#323130', altRow: '#faf9f8', border: '#e1dfdd', accent: '#605e5c' },
  dark:   { headerBg: '#1f2937', headerFg: '#ffffff', altRow: '#f9fafb', border: '#d1d5db', accent: '#1f2937' },
};

function expEscapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function base64Wrap(b64) { return b64.replace(/(.{76})/g, '$1\r\n'); }

/* ---------- Persistence per user + list ---------- */
function expEmail_colsKey() {
  const listName = (exporterPicker?.getValue() || '').toLowerCase();
  if (!listName) return null;
  return LS_BASE + '_expemail_cols_' + (currentUser?.id || 'anon') + '_' + listName;
}
function expEmail_saveCols() {
  const key = expEmail_colsKey();
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify({ bodyCols: expEmailState.bodyCols, attachCols: expEmailState.attachCols })); } catch (e) {}
}
function expEmail_loadCols() {
  const key = expEmail_colsKey();
  if (!key) return null;
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

/* Resolve names → column descriptors, preserving export selection order */
function expEmail_colsFrom(names) {
  const set = new Set(names);
  return expState.selectedColumns
    .filter(n => set.has(n))
    .map(n => expState.allColumns.find(c => c.name === n))
    .filter(Boolean);
}

/* ── Render the two checkbox grids ── */
function expEmail_renderColsGrids() {
  const bodyGrid = $('expEmailColsBodyGrid');
  const attachGrid = $('expEmailColsAttachGrid');
  if (!bodyGrid || !attachGrid) return;

  const usableCols = expState.selectedColumns
    .map(n => expState.allColumns.find(c => c.name === n))
    .filter(Boolean);

  const bodySet = new Set(expEmailState.bodyCols);
  const attachSet = new Set(expEmailState.attachCols);

  function renderOne(grid, colSet, section) {
    grid.innerHTML = '';
    usableCols.forEach(col => {
      const label = document.createElement('label');
      label.className = 'col-check';
      const checked = colSet.has(col.name);
      label.innerHTML =
        `<input type="checkbox" value="${escapeHtml(col.name)}" ${checked ? 'checked' : ''} />` +
        `<span>${escapeHtml(col.displayName)}</span>` +
        `<span class="internal">${escapeHtml(col.name)}</span>`;
      label.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) colSet.add(col.name); else colSet.delete(col.name);
        expEmailState.bodyCols = Array.from(bodySet);
        expEmailState.attachCols = Array.from(attachSet);
        expEmail_saveCols();
        expEmail_updateColsSummaries();
        expEmail_refreshPreview();
      });
      grid.appendChild(label);
    });
  }
  renderOne(bodyGrid, bodySet, 'body');
  renderOne(attachGrid, attachSet, 'attach');
  expEmail_updateColsSummaries();
}
function expEmail_updateColsSummaries() {
  $('expEmailColsBodySummary').textContent = `${expEmailState.bodyCols.length} selected`;
  $('expEmailColsAttachSummary').textContent = `${expEmailState.attachCols.length} selected`;
}

/* ── Build the email HTML using only bodyCols ── */
function expEmail_buildHtml() {
  const cols = expEmail_colsFrom(expEmailState.bodyCols);
  const rows = expState.filteredItems;
  const maxRows = Math.max(1, Math.min(5000, parseInt($('expEmailMaxRows').value, 10) || 100));
  const theme = EXP_EMAIL_THEMES[$('expEmailTheme').value] || EXP_EMAIL_THEMES.brand;

  const intro = ($('expEmailIntro').value || '').trim();
  const signature = ($('expEmailSignature').value || '').trim();
  const listName = exporterPicker?.getValue() || 'Export';
  const generated = formatDate(Date.now());
  const user = currentUser?.username || 'unknown';
  const totalRows = rows.length;
  const shownRows = Math.min(maxRows, totalRows);
  const truncated = totalRows > shownRows;
  const esc = expEscapeHtml;

  const introHtml = intro
    ? `<p style="margin:0 0 14px;font-size:14px;color:#323130;line-height:1.55;white-space:pre-wrap;">${esc(intro)}</p>`
    : '';

  const headerRow = cols.map(c =>
    `<th style="padding:9px 12px;text-align:left;font-size:12px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;border:1px solid ${theme.border};background:${theme.headerBg};color:${theme.headerFg};white-space:nowrap;">${esc(c.displayName)}</th>`
  ).join('');

  const bodyRows = cols.length
    ? rows.slice(0, shownRows).map((it, idx) => {
        const bg = idx % 2 === 1 ? theme.altRow : '#ffffff';
        const cells = cols.map(c => {
          const v = it.fields?.[c.name];
          const s = v == null ? '' : String(v);
          return `<td style="padding:8px 12px;font-size:13px;color:#201f1e;border:1px solid ${theme.border};background:${bg};vertical-align:top;word-break:break-word;">${esc(s)}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('')
    : `<tr><td style="padding:14px;text-align:center;color:#8a8886;font-style:italic;">No columns selected for the email body.</td></tr>`;

  const truncNote = truncated
    ? `<p style="margin:8px 0 0;font-size:12px;color:#8a8886;font-style:italic;">Showing the first ${shownRows.toLocaleString()} of ${totalRows.toLocaleString()} rows. ${expEmailState.attachCols.length ? 'See the attached file for the complete dataset.' : ''}</p>`
    : '';

  const signatureHtml = signature
    ? `<div style="margin-top:22px;padding-top:14px;border-top:1px solid #edebe9;font-size:13px;color:#605e5c;line-height:1.55;white-space:pre-wrap;">${esc(signature)}</div>`
    : '';

  const attachNote = expEmailState.attachCols.length
    ? `<div><strong>Attachment:</strong> ${expEmailState.attachCols.length} column(s)</div>`
    : `<div><strong>Attachment:</strong> none</div>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f3f2f1;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:960px;margin:24px auto;background:#ffffff;border:1px solid #e1dfdd;border-radius:8px;overflow:hidden;">
    <div style="padding:20px 24px;background:${theme.accent};color:#ffffff;">
      <div style="font-size:20px;font-weight:700;letter-spacing:0.2px;">NFPC SC Management System</div>
      <div style="font-size:13px;opacity:0.9;margin-top:2px;">Data Export — ${esc(listName)}</div>
    </div>

    <div style="padding:14px 24px;background:#faf9f8;border-bottom:1px solid #edebe9;font-size:12px;color:#605e5c;line-height:1.7;">
      <div><strong>List:</strong> ${esc(listName)}</div>
      <div><strong>Rows:</strong> ${totalRows.toLocaleString()}${truncated ? ` (showing first ${shownRows.toLocaleString()})` : ''}</div>
      <div><strong>Columns in body:</strong> ${cols.length}</div>
      ${attachNote}
      <div><strong>Generated:</strong> ${esc(generated)} &nbsp;·&nbsp; <strong>By:</strong> ${esc(user)}</div>
    </div>

    <div style="padding:20px 24px;">
      ${introHtml}
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${truncNote}
      ${signatureHtml}
    </div>

    <div style="padding:12px 24px;background:#faf9f8;border-top:1px solid #edebe9;font-size:11px;color:#8a8886;text-align:center;">
      This message was generated automatically by NFPC SC Management System. Please do not reply to this address.
    </div>
  </div>
</body></html>`;

  return { html, totalRows, shownRows, truncated };
}

/* ── Build the attachment using only attachCols ── */
function expEmail_buildAttachment(format) {
  const cols = expEmail_colsFrom(expEmailState.attachCols);
  if (!cols.length) return null;

  const rows = expState.filteredItems;
  const headers = cols.map(c => c.displayName);
  const aoa = [headers, ...rows.map(it => cols.map(c => it.fields?.[c.name] ?? ''))];

  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const listName = (exporterPicker?.getValue() || 'Export').replace(/[^\w\-]+/g, '_');
  const fileName = `${listName}_${ts}.${format}`;

  if (format === 'csv') {
    const esc = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = aoa.map(r => r.map(esc).join(','));
    const csv = '\ufeff' + lines.join('\r\n');
    return { format: 'csv', fileName, dataB64: btoa(unescape(encodeURIComponent(csv))) };
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map(c => ({ wch: Math.max(12, Math.min(40, c.displayName.length + 6)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  return { format: 'xlsx', fileName, dataB64: wbout };
}

/* ── Preview ── */
function expEmail_refreshPreview() {
  if (!expState.filteredItems.length) return;
  const { html, totalRows, shownRows } = expEmail_buildHtml();
  expEmailState.lastHtml = html;
  $('expEmailPreview').innerHTML = html;
  $('expEmailPreviewMeta').textContent = `${shownRows.toLocaleString()} of ${totalRows.toLocaleString()} rows · ${expEmailState.bodyCols.length} body col(s) · ${expEmailState.attachCols.length} attachment col(s)`;
  $('expEmailReadyMeta').textContent = `Ready · ${totalRows.toLocaleString()} rows`;
}

/* ── Defaults ── */
function expEmail_applyDefaults() {
  const listName = exporterPicker?.getValue() || 'Export';
  const ts = new Date().toISOString().slice(0, 10);
  $('expEmailSubject').value = `${listName} — Data Export (${ts})`;
  if (!$('expEmailIntro').value) {
    $('expEmailIntro').value =
      `Hi,\n\nPlease find below the exported data from "${listName}" as of ${formatDate(Date.now())}.\nTotal rows: ${expState.filteredItems.length.toLocaleString()}.`;
  }
  if (!$('expEmailSignature').value) {
    const u = currentUser || {};
    $('expEmailSignature').value = `Best regards,\n${u.displayName || u.username || ''}\nNFPC SC Management System`;
  }
  if (!$('expEmailTo').value && notificationSettings?.recipient) $('expEmailTo').value = notificationSettings.recipient;
}

/* ── Seed the two column sets ── */
function expEmail_initColumnSets() {
  const saved = expEmail_loadCols();
  const usable = new Set(expState.selectedColumns);
  if (saved && Array.isArray(saved.bodyCols) && Array.isArray(saved.attachCols)) {
    expEmailState.bodyCols   = saved.bodyCols.filter(n => usable.has(n));
    expEmailState.attachCols = saved.attachCols.filter(n => usable.has(n));
  } else {
    // First time on this list: attach everything, show first 8 in the body
    expEmailState.attachCols = expState.selectedColumns.slice();
    expEmailState.bodyCols   = expState.selectedColumns.slice(0, 8);
  }
}

/* ═══════════════════════════════════════════════════════════
   Wire up
   ═══════════════════════════════════════════════════════════ */
$('expEmailBtn').addEventListener('click', () => {
  if (!expState.filteredItems.length) { e_setStatus('No rows to email.', 'warn'); return; }
  if (!expState.selectedColumns.length) { e_setStatus('No columns selected.', 'warn'); return; }
  const modal = $('expEmailModal');
  modal.style.display = 'flex';
  $('expEmailStatus').className = 'status-msg';
  $('expEmailStatus').textContent = '';
  expEmail_applyDefaults();
  expEmail_initColumnSets();
  expEmail_renderColsGrids();
  expEmail_refreshPreview();
  setTimeout(() => $('expEmailTo').focus(), 60);
});

$('expEmailCloseBtn').addEventListener('click', () => { $('expEmailModal').style.display = 'none'; });
$('expEmailModal').addEventListener('click', (e) => {
  if (e.target === $('expEmailModal')) $('expEmailModal').style.display = 'none';
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('expEmailModal')?.style.display === 'flex') $('expEmailModal').style.display = 'none';
});

['expEmailIntro','expEmailSignature','expEmailMaxRows','expEmailTheme','expEmailSubject'].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input', expEmail_refreshPreview);
  el.addEventListener('change', expEmail_refreshPreview);
});

/* Column quick-actions */
$('expEmailColsFromExportBtn').addEventListener('click', () => {
  expEmailState.bodyCols = expState.selectedColumns.slice();
  expEmailState.attachCols = expState.selectedColumns.slice();
  expEmail_saveCols(); expEmail_renderColsGrids(); expEmail_refreshPreview();
});
$('expEmailColsBodyToAttachBtn').addEventListener('click', () => {
  expEmailState.attachCols = expEmailState.bodyCols.slice();
  expEmail_saveCols(); expEmail_renderColsGrids(); expEmail_refreshPreview();
});
$('expEmailColsAttachToBodyBtn').addEventListener('click', () => {
  expEmailState.bodyCols = expEmailState.attachCols.slice();
  expEmail_saveCols(); expEmail_renderColsGrids(); expEmail_refreshPreview();
});
$('expEmailColsBodyAllBtn').addEventListener('click', () => {
  expEmailState.bodyCols = expState.selectedColumns.slice();
  expEmail_saveCols(); expEmail_renderColsGrids(); expEmail_refreshPreview();
});
$('expEmailColsBodyNoneBtn').addEventListener('click', () => {
  expEmailState.bodyCols = [];
  expEmail_saveCols(); expEmail_renderColsGrids(); expEmail_refreshPreview();
});
$('expEmailColsAttachAllBtn').addEventListener('click', () => {
  expEmailState.attachCols = expState.selectedColumns.slice();
  expEmail_saveCols(); expEmail_renderColsGrids(); expEmail_refreshPreview();
});
$('expEmailColsAttachNoneBtn').addEventListener('click', () => {
  expEmailState.attachCols = [];
  expEmail_saveCols(); expEmail_renderColsGrids(); expEmail_refreshPreview();
});

/* .eml builder */
function expEmail_buildEml(html, subject, to, cc, attachment) {
  const boundary = '----=_NextPart_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const encSubject = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(subject))) + '?=';
  const crlf = '\r\n';
  const headers = [
    `From: NFPC SC Management System <no-reply@nfcpc.local>`,
    `To: ${to || ''}`,
  ];
  if (cc) headers.push(`Cc: ${cc}`);
  headers.push(`Subject: ${encSubject}`, `Date: ${new Date().toUTCString()}`, `MIME-Version: 1.0`);

  if (!attachment) {
    headers.push(`Content-Type: text/html; charset=UTF-8`, `Content-Transfer-Encoding: base64`, '');
    return headers.join(crlf) + crlf + base64Wrap(btoa(unescape(encodeURIComponent(html))));
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, '');
  const parts = [];
  parts.push(`--${boundary}`);
  parts.push(`Content-Type: text/html; charset=UTF-8`, `Content-Transfer-Encoding: base64`, '');
  parts.push(base64Wrap(btoa(unescape(encodeURIComponent(html)))));

  const mime = attachment.format === 'csv'
    ? `text/csv; name="${attachment.fileName}"`
    : `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${attachment.fileName}"`;
  parts.push(`--${boundary}`);
  parts.push(`Content-Type: ${mime}`, `Content-Transfer-Encoding: base64`, `Content-Disposition: attachment; filename="${attachment.fileName}"`, '');
  parts.push(base64Wrap(attachment.dataB64));
  parts.push(`--${boundary}--`);

  return headers.join(crlf) + crlf + parts.join(crlf);
}
/* Action 1 — open Outlook as draft (best-effort auto-launch) */
$('expEmailOpenOutlookBtn').addEventListener('click', () => {
  const statusEl = $('expEmailStatus');
  const to = $('expEmailTo').value.trim();
  if (!to) { statusEl.className = 'status-msg warn'; statusEl.textContent = '⚠ Enter at least one recipient in the "To" field.'; return; }
  if (!expEmailState.bodyCols.length && $('expEmailAttach').value === 'none') {
    statusEl.className = 'status-msg warn';
    statusEl.textContent = '⚠ No columns in the email body and no attachment — nothing would be sent.';
    return;
  }
  if ($('expEmailAttach').value !== 'none' && !expEmailState.attachCols.length) {
    statusEl.className = 'status-msg warn';
    statusEl.textContent = '⚠ Attachment has no columns selected. Choose columns under "In attachment" or set Attachment to None.';
    return;
  }

  const cc = $('expEmailCc').value.trim();
  const subject = $('expEmailSubject').value.trim() || 'Data Export';
  const attachFormat = $('expEmailAttach').value;

  try {
    const attachment = attachFormat === 'none' ? null : expEmail_buildAttachment(attachFormat);
    const eml = expEmail_buildEml(expEmailState.lastHtml, subject, to, cc, attachment);
    const blob = new Blob([eml], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);

    const listName = (exporterPicker?.getValue() || 'Export').replace(/[^\w\-]+/g, '_');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const emlName = `${listName}_email_${ts}.eml`;

    const a = document.createElement('a');
    a.href = url;
    a.download = emlName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    /* ---- Best-effort auto-launch of the .eml in Outlook ---- */
    const outlookProtocolUrl = 'ms-outlook://compose?to=' +
      encodeURIComponent(to) +
      (cc ? '&cc=' + encodeURIComponent(cc) : '') +
      '&subject=' + encodeURIComponent(subject);

    // Try to open Outlook via the ms-outlook:// protocol
    let protocolOpened = false;
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = outlookProtocolUrl;
      document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 2000);
      protocolOpened = true;
    } catch (e) { /* ignore */ }

    /* ---- Show detailed guidance ---- */
    statusEl.className = 'status-msg success';
    statusEl.innerHTML =
      `✅ Draft file <strong>${emlName}</strong> downloaded to your <em>Downloads</em> folder.<br><br>` +
      `<strong>To open it in Outlook:</strong><br>` +
      `&nbsp;&nbsp;1. Open <strong>File Explorer</strong> → <strong>Downloads</strong><br>` +
      `&nbsp;&nbsp;2. <strong>Double-click</strong> <em>${emlName}</em><br>` +
      `&nbsp;&nbsp;3. Outlook opens with the draft — review, then click <strong>Send</strong>.<br><br>` +
      `<em>Body: ${expEmailState.bodyCols.length} col(s) · ` +
      `Attachment: ${expEmailState.attachCols.length} col(s)` +
      `${attachment ? ` · ${attachment.fileName}` : ' · none'}</em><br><br>` +
      `💡 <strong>Tip:</strong> After the first download, set <code>.eml</code> files to open ` +
      `with Outlook by default — then double-click always works in one step.`;

    /* ---- Fallback: also prepare a mailto: in case the user wants plain-text ---- */
    const mailtoUrl = 'mailto:' + encodeURIComponent(to) +
      (cc ? '?cc=' + encodeURIComponent(cc) : '?') +
      '&subject=' + encodeURIComponent(subject);

    /* ---- Optional: auto-open the mailto if the protocol handler is unavailable ---- */
    // Uncomment the next 3 lines if you want it to auto-fire mailto as a fallback:
    // setTimeout(() => {
    //   if (!protocolOpened) window.location.href = mailtoUrl;
    // }, 800);

    addActivity('email', `Exporter email draft — ${expState.filteredItems.length} rows · body ${expEmailState.bodyCols.length} cols · attachment ${expEmailState.attachCols.length} cols`);
  } catch (err) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = '✘ Failed to prepare draft: ' + err.message;
  }
});

/* Action 2 — download the .eml only */
$('expEmailDownloadEmlBtn').addEventListener('click', () => {
  const statusEl = $('expEmailStatus');
  const to = $('expEmailTo').value.trim() || 'recipient@example.com';
  const cc = $('expEmailCc').value.trim();
  const subject = $('expEmailSubject').value.trim() || 'Data Export';
  const attachFormat = $('expEmailAttach').value;
  try {
    const attachment = attachFormat === 'none' ? null : expEmail_buildAttachment(attachFormat);
    const eml = expEmail_buildEml(expEmailState.lastHtml, subject, to, cc, attachment);
    const blob = new Blob([eml], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const listName = (exporterPicker?.getValue() || 'Export').replace(/[^\w\-]+/g, '_');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const emlName = `${listName}_email_${ts}.eml`;
    const a = document.createElement('a');
    a.href = url; a.download = emlName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    statusEl.className = 'status-msg success';
    statusEl.textContent = `✅ Downloaded ${emlName}. Open it in Outlook to review and send.`;
  } catch (err) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = '✘ ' + err.message;
  }
});

/* Action 3 — copy HTML to clipboard */
$('expEmailCopyHtmlBtn').addEventListener('click', async () => {
  const statusEl = $('expEmailStatus');
  try {
    const html = expEmailState.lastHtml;
    const plain = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
    } else {
      await navigator.clipboard.writeText(plain);
    }
    statusEl.className = 'status-msg success';
    statusEl.innerHTML = '✅ HTML copied. Open Outlook → <strong>New Email</strong> → paste (<kbd>Ctrl+V</kbd>). The table keeps its styling.';
  } catch (err) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = '✘ Copy failed: ' + err.message + ' — try the .eml download instead.';
  }
});

