
/* ============================================================
   SAFETY NET — install BEFORE any other code runs.
   Prevents a missing element from killing the whole script.
   ============================================================ */
(function installNullSafeGetElementById() {
  const orig = document.getElementById.bind(document);
  window.__missingIds = new Set();
  document.getElementById = function (id) {
    const el = orig(id);
    if (el) return el;
    if (!window.__missingIds.has(id)) {
      window.__missingIds.add(id);
      console.warn('[missing-id] #' + id + ' is not in the HTML — listener skipped');
    }
    return {
      addEventListener: () => {},
      removeEventListener: () => {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      style: {},
      dataset: {},
      setAttribute: () => {},
      getAttribute: () => null,
      appendChild: () => {},
      removeChild: () => {},
      remove: () => {},
      insertBefore: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      innerHTML: '',
      textContent: '',
      value: '',
      disabled: false,
      checked: false,
      focus: () => {},
      blur: () => {},
      click: () => {},
      contains: () => false,
      scrollIntoView: () => {},
    };
  };
})();

/* ============================================================
   Constants
   ============================================================ */
const LS_BASE = "sp_dashboard_secure_v12";
const SKIP_VALUE = "__skip__";
const MAX_ACTIVITY = 200;
const MAX_HISTORY = 500;
const LISTS_CACHE_TTL = 5 * 60 * 1000;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;
const GLOBAL_KEY = LS_BASE + "_global";
const SUGGESTION_ROW_LIMIT = 10000;

const ROLES = {
  viewer:   { label: 'Viewer',   perms: new Set(['exporter','planning','dailyplan','fdplan','mdp','roster','listan','locsign','att','mgt','mgw']) },
  operator: { label: 'Operator', perms: new Set(['exporter','planning','planning-upload','dailyplan','dailyplan-upload','fdplan','fdplan-upload','logplan','mdp','roster','listan','locsign','att','mgt','mgw','foc','uploader','editor','editor-add','editor-edit','editor-json','scheduler','scheduler-upload']) },
  admin:    { label: 'Admin',    perms: new Set(['*']) },
};

const READ_ONLY_COLUMNS = new Set([
  "id","contenttype","modified","created","author","editor","_uiversionstring","attachments","edit",
  "linktitlenomenu","linktitle","docicon","itemchildcount","folderchildcount","_complianceflags",
  "_compliancetag","_compliancetagwrittentime","_compliancetaguserid","_isrecord","appauthor","appeditor",
  "complianceassetid","_colortag","_formsourceid_0","guid","workflowversion","workflowinstanceid",
  "owshiddenversion","fileleafref","filexsize","filetype","modified_x0020_by","created_x0020_by",
  "contenttypeid","scopeid","versions","instanceid","order","metainfo","doesuserhavepermissions",
  "effectivebasepermissions","permissions","progid","serverurl","htmlfiletype","checkoutuser",
  "virusstatus","parentversionstring","parentleafname","_vti_","vti_","_moderationstatus","_moderationcomments",
  "moderationstatus","moderationcomments","_level","_iscurrentversion","checkincomments",
  "approvedby","approvercomments","approvalstatus","_hascopy Destinations","copysource",
]);
const UNSUPPORTED_EDIT_TYPES = new Set(["hyperlinkOrPicture","lookup","personOrGroup","term","thumbnail","calculated","computed","geolocation","location"]);

/* ============================================================
   Helpers
   ============================================================ */
const $ = (id) => document.getElementById(id);
/* ---------- Current-User synthetic field (shared across all uploaders) ---------- */
const CURRENT_USER_FIELD_KEY   = '__current_user__';
const CURRENT_USER_FIELD_LABEL = '👤 Current User (auto)';

/* SharePoint column names we treat as "the username column" */
const CURRENT_USER_COLUMN_ALIASES = [
  'user_name','username','user name','user','userid','user_id','user id',
  'uploadedby','uploaded_by','uploaded by','createdby_text','author_text',
  'submittedby','submitted_by','submitted by','created_by','created by',
  'login','login_name','loginname','operator','operator_name','entered_by','enteredby',
];

/* Return the value to write into the target SharePoint column. */
function getCurrentUserValue() {
  if (!currentUser) return 'unknown';
  /* Swap for displayName if you prefer the human-readable name. */
  return currentUser.username || currentUser.displayName || 'unknown';
}

/* Given a target list's columns, find the best "username" column, or null. */
function findCurrentUserColumn(columns) {
  if (!Array.isArray(columns) || !columns.length) return null;
  return columns.find(c => {
    const a = normalize(c.name);
    const b = normalize(c.displayName || '');
    return CURRENT_USER_COLUMN_ALIASES.some(al => {
      const n = normalize(al);
      return a === n || b === n;
    });
  }) || null;
}

/* Convenience: an "output field" descriptor for the synthetic field. */
function currentUserOutputField() {
  return {
    key: CURRENT_USER_FIELD_KEY,
    label: CURRENT_USER_FIELD_LABEL,
    alias: 'User_Name',
    synthetic: true,
  };
}
const uid = () => Math.random().toString(36).slice(2, 10);
const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalize = (s) => String(s).toLowerCase().replace(/[\s_\-\.]+/g, '').trim();
const truncate = (s, n = 60) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; };
const formatDate = (d) => new Date(d).toLocaleString();
/* Guard: some browsers/dropdowns try to insertBefore a node
   whose reference parent has already been replaced by a re-render.
   This wrapper swallows that specific error so it doesn't break
   the flow — the affected dropdown simply won't re-anchor itself. */
(function patchInsertBefore() {
  const orig = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, refNode) {
    if (refNode != null && refNode.parentNode !== this) {
      // Ref node was detached (likely a stale dropdown input).
      // Fall back to appending at the end.
      return orig.call(this, newNode, null);
    }
    return orig.call(this, newNode, refNode);
  };
})();
/* ============================================================
   Progress Bar Controller
   ============================================================ */
class CancelledError extends Error {
  constructor(m) { super(m || 'Stopped by user'); this.name = 'CancelledError'; this.cancelled = true; }
}
class ProgressBar {
  constructor(prefix) {
    this.prefix = prefix;
    this.panel = $(prefix + 'Panel');
    this.label = $(prefix + 'Label');
    this.labelText = $(prefix + 'LabelText');
    this.stats = $(prefix + 'Stats');
    this.pct = this.stats ? this.stats.querySelector('.pct') : null;
    this.counter = $(prefix + 'Counter');
    this.track = $(prefix + 'Track');
    this.fill = $(prefix + 'Fill');
    this.current = $(prefix + 'Current');
    this.eta = $(prefix + 'Eta');
    this.startTime = null;
    this.total = 0;
    this.cancelled = false; this.active = false; this.completed = 0; this.stopBtn = null;
    const hdr = this.panel && this.panel.querySelector ? this.panel.querySelector('.progress-header') : null;
    if (hdr) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'danger small pb-stop'; b.textContent = '⏹ Stop'; b.style.display = 'none';
      b.title = 'Stop this operation (the current request finishes first)';
      b.addEventListener('click', () => this.requestStop());
      hdr.appendChild(b); this.stopBtn = b;
    }
  }
  requestStop() {
    if (!this.active) return;
    this.cancelled = true;
    if (this.stopBtn) { this.stopBtn.disabled = true; this.stopBtn.textContent = '⏹ Stopping…'; }
    if (this.labelText) this.labelText.textContent = 'Stopping… finishing the current request';
  }
  _endRun() { this.active = false; if (this.stopBtn) this.stopBtn.style.display = 'none'; }
  start(label, total) {
    this.cancelled = false; this.active = true; this.completed = 0;
    if (this.stopBtn) { this.stopBtn.disabled = false; this.stopBtn.textContent = '⏹ Stop'; this.stopBtn.style.display = ''; }
    this.startTime = Date.now();
    this.total = total;
    if (this.panel) this.panel.classList.add('visible');
    if (this.label) this.label.classList.remove('done', 'error');
    if (this.stats) this.stats.classList.remove('done', 'error');
    if (this.track) this.track.classList.remove('done', 'error');
    if (this.labelText) this.labelText.textContent = label || 'Working...';
    this.update(0, total, '');
  }
  update(completed, total, currentLabel = '') {
    this.completed = completed;
    if (this.cancelled) throw new CancelledError();
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (this.fill) this.fill.style.width = pct + '%';
    if (this.pct) this.pct.textContent = pct + '%';
    if (this.counter) {
      this.counter.textContent = total > 0 ? `${completed} / ${total} records` : `${completed} records`;
    }
    if (this.current) this.current.textContent = currentLabel || '';
    if (this.eta && this.startTime && completed > 0 && total > 0 && completed < total) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const perItem = elapsed / completed;
      const remaining = Math.round(perItem * (total - completed));
      if (remaining > 60) {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        this.eta.textContent = `ETA ~ ${m}m ${s}s`;
      } else {
        this.eta.textContent = `ETA ~ ${remaining}s`;
      }
    } else if (this.eta) this.eta.textContent = '';
  }
  finish(label, keep) {
    this._endRun();
    if (this.label) this.label.classList.add('done');
    if (this.stats) this.stats.classList.add('done');
    if (this.track) this.track.classList.add('done');
    if (this.fill) this.fill.style.width = '100%';
    if (this.pct) this.pct.textContent = '100%';
    if (this.labelText) this.labelText.textContent = label || 'Complete';
    if (this.eta) this.eta.textContent = '';
    if (!keep) setTimeout(() => { if (this.panel) this.panel.classList.remove('visible'); }, 3000);
  }
  error(label) {
    this._endRun();
    if (/Stopped by user/i.test(String(label || ''))) {
      if (this.labelText) this.labelText.textContent = `⏹ Stopped by user — ${this.completed} processed`;
      if (this.eta) this.eta.textContent = '';
      return;
    }
    if (this.label) this.label.classList.add('error');
    if (this.stats) this.stats.classList.add('error');
    if (this.track) this.track.classList.add('error');
    if (this.labelText) this.labelText.textContent = label || 'Failed';
    if (this.eta) this.eta.textContent = '';
  }
}

const uploadProgress = new ProgressBar('uploadProgress');
const expLoadProgress = new ProgressBar('expLoadProgress');
const expExportProgress = new ProgressBar('expExportProgress');
const editorLoadProgress = new ProgressBar('editorLoadProgress');
const bulkProgress = new ProgressBar('bulkProgress');
const inlineProgress = new ProgressBar('inlineProgress');
const warehouseParseProgress = new ProgressBar('warehouseParseProgress');
const wFefoUploadProgress = new ProgressBar('wFefoUploadProgress');
const wFefoProgress = new ProgressBar('wFefoProgress');

/* ============================================================
   Global Settings
   ============================================================ */
function loadGlobalSettings() {
  try {
    const raw = localStorage.getItem(GLOBAL_KEY);
    if (!raw) return { siteUrl: '', accessToken: '', updatedAt: null, updatedBy: null };
    const p = JSON.parse(raw);
    return { siteUrl: p.siteUrl || '', accessToken: p.accessToken || '', updatedAt: p.updatedAt || null, updatedBy: p.updatedBy || null };
  } catch (e) { return { siteUrl: '', accessToken: '', updatedAt: null, updatedBy: null }; }
}
function saveGlobalSettings(siteUrl, accessToken) {
  try { localStorage.setItem(GLOBAL_KEY, JSON.stringify({ siteUrl, accessToken, updatedAt: Date.now(), updatedBy: currentUser?.username || 'unknown' })); } catch (e) {}
}
function clearGlobalSettings() { try { localStorage.removeItem(GLOBAL_KEY); } catch (e) {} }
/* ============================================================
   Microsoft sign-in (MSAL) — no pasted token. Fill MS_AUTH_DEFAULT once in this file
   (or in Settings) and every user just clicks "Sign in with Microsoft".
   ============================================================ */
const MS_AUTH_DEFAULT = { tenantId: '', clientId: '', siteUrl: '' };
const MS_CFG_KEY = (typeof LS_BASE !== 'undefined' ? LS_BASE : 'app') + '_ms_cfg', MS_SP_KEY = (typeof LS_BASE !== 'undefined' ? LS_BASE : 'app') + '_ms_sptoken';
function ms_cfg() { let c = {}; try { c = JSON.parse(localStorage.getItem(MS_CFG_KEY) || '{}'); } catch (e) {} return { tenantId: c.tenantId || MS_AUTH_DEFAULT.tenantId, clientId: c.clientId || MS_AUTH_DEFAULT.clientId, siteUrl: c.siteUrl || MS_AUTH_DEFAULT.siteUrl }; }
function ms_configured() { const c = ms_cfg(); return !!(c.tenantId && c.clientId); }
let ms_app = null, ms_timer = null;
function ms_status(msg, type) { const el = document.querySelector('#msAuthStatus'); if (el) { el.className = 'status-msg ' + (type || 'info'); el.textContent = msg; } try { syncToken(); } catch (e) {} }
function ms_loadLib() {
  if (window.msal) return Promise.resolve();
  const urls = ['https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js', 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.3/lib/msal-browser.min.js'];
  return urls.reduce((p, u) => p.catch(() => new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = u; sc.onload = res; sc.onerror = () => rej(new Error('Could not load the Microsoft sign-in library.')); document.head.appendChild(sc); })), Promise.reject());
}
async function ms_init() {
  if (ms_app) return ms_app;
  const c = ms_cfg(); if (!ms_configured()) throw new Error('Enter the Tenant ID and Client ID first.');
  if (location.protocol === 'file:') throw new Error('Microsoft sign-in does not work from a local file. Open this page from an https:// address (e.g. a SharePoint site page / library) or http://localhost.');
  await ms_loadLib();
  ms_app = new msal.PublicClientApplication({ auth: { clientId: c.clientId, authority: 'https://login.microsoftonline.com/' + c.tenantId, redirectUri: location.origin + location.pathname }, cache: { cacheLocation: 'localStorage' } });
  if (ms_app.initialize) await ms_app.initialize();
  return ms_app;
}
function ms_spOrigin() { try { return new URL(getGlobalSiteUrl() || ms_cfg().siteUrl).origin; } catch (e) { return ''; } }
async function ms_acquire(interactive) {
  const app = await ms_init(); let acct = app.getAllAccounts()[0];
  const graph = { scopes: ['https://graph.microsoft.com/Sites.ReadWrite.All', 'https://graph.microsoft.com/User.Read'] };
  let res;
  if (!acct) { if (!interactive) return null; res = await app.loginPopup(graph); acct = res.account; }
  try { res = await app.acquireTokenSilent({ ...graph, account: acct }); }
  catch (e) { if (!interactive) throw e; res = await app.acquireTokenPopup(graph); }
  const site = getGlobalSiteUrl() || ms_cfg().siteUrl;
  saveGlobalSettings(site, res.accessToken);
  try {   // second token for SharePoint's own REST API (attachments)
    const o = ms_spOrigin(); if (o) { const r2 = await app.acquireTokenSilent({ scopes: [o + '/.default'], account: acct }); localStorage.setItem(MS_SP_KEY, r2.accessToken); }
  } catch (e) { try { localStorage.removeItem(MS_SP_KEY); } catch (x) {} }
  return { account: acct, expiresOn: res.expiresOn };
}
async function ms_signIn(interactive = true) {
  try {
    ms_status('Signing in…', 'info');
    const r = await ms_acquire(interactive);
    if (!r) { ms_status('Not signed in — click the token badge or "Sign in with Microsoft".', 'warn'); return false; }
    if (!(getGlobalSiteUrl() || ms_cfg().siteUrl)) ms_status(`✅ Signed in as ${r.account.username}, but the SharePoint Site URL is still empty. Type it in “Global SharePoint Site URL” above (https://<tenant>.sharepoint.com/sites/<YourSite>), click Save IDs, then Refresh.`, 'warn'); else ms_status(`✅ Signed in as ${r.account.username}. The token renews automatically.`, 'success');
    try { listsCache.clear(); applyGlobalSettingsToUI(); } catch (e) {}
    clearInterval(ms_timer); ms_timer = setInterval(() => ms_acquire(false).then(() => { try { applyGlobalSettingsToUI(); } catch (e) {} }).catch(e => ms_status('⚠ Token renewal failed — sign in again. ' + e.message, 'warn')), 40 * 60 * 1000);
    return true;
  } catch (e) { window.ms_lastErr = String(e && (e.errorCode ? e.errorCode + ' — ' : '') + (e.errorMessage || e.message || e)).slice(0, 400); ms_status('✘ ' + (e.message || e), 'error'); return false; }
}
async function ms_signOut() { try { const app = await ms_init(); clearInterval(ms_timer); const a = app.getAllAccounts()[0]; clearGlobalSettings(); try { localStorage.removeItem(MS_SP_KEY); } catch (e) {} if (a) await app.logoutPopup({ account: a }); } catch (e) {} ms_status('Signed out.', 'warn'); try { applyGlobalSettingsToUI(); } catch (e) {} }
function sp_token() { try { return localStorage.getItem(MS_SP_KEY) || ''; } catch (e) { return ''; } }
/* ============================================================
   Direct email sending — Microsoft Graph sendMail or a Power Automate HTTP flow.
   Fill MAIL_SEND_DEFAULT once in this file to give every user the same method.
   ============================================================ */
const MAIL_SEND_DEFAULT = { method: 'graph', flowUrl: '' };   // method: 'graph' | 'flow' | 'draft'
const MAIL_SEND_KEY = (typeof LS_BASE !== 'undefined' ? LS_BASE : 'app') + '_mailsend';
function mailSend_cfg() { let c = {}; try { c = JSON.parse(localStorage.getItem(MAIL_SEND_KEY) || '{}'); } catch (e) {} return { method: c.method || MAIL_SEND_DEFAULT.method, flowUrl: (c.flowUrl !== undefined ? c.flowUrl : MAIL_SEND_DEFAULT.flowUrl) || '' }; }
function mailSend_label() { const c = mailSend_cfg(); return c.method === 'flow' ? '🚀 Send now (Power Automate)' : c.method === 'graph' ? '🚀 Send now (Microsoft 365)' : '🚀 Send now (not configured)'; }
function mailSend_list(t) { return String(t || '').split(/[;,\s]+/).map(x => x.trim()).filter(Boolean); }
async function mailSend_graphToken() {
  const app = await ms_init(); let acct = app.getAllAccounts()[0];
  const req = { scopes: ['https://graph.microsoft.com/Mail.Send'] };
  if (!acct) { const r = await app.loginPopup({ scopes: ['https://graph.microsoft.com/Sites.ReadWrite.All', 'https://graph.microsoft.com/User.Read', 'https://graph.microsoft.com/Mail.Send'] }); acct = r.account; }
  try { return (await app.acquireTokenSilent({ ...req, account: acct })).accessToken; }
  catch (e) { return (await app.acquireTokenPopup({ ...req, account: acct })).accessToken; }   // asks once for the Mail.Send permission
}
async function mailSend_send(m) {   // m: { to, cc, subject, html, attachment:{fileName,dataB64}|null }
  const c = mailSend_cfg(), to = mailSend_list(m.to), cc = mailSend_list(m.cc), bad = to.concat(cc).filter(x => !EMAIL_RX.test(x));
  if (!to.length) throw new Error('Enter at least one recipient in "To".');
  if (bad.length) throw new Error('Not a valid e-mail address: ' + bad.join(', '));
  const ctype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', att = m.attachment;
  if (c.method === 'graph') {
    if (!ms_configured()) throw new Error('Microsoft sign-in is not set up (Settings → Microsoft sign-in). Use "Create Outlook draft" instead, or ask the admin.');
    if (att && att.dataB64.length > 3300000) throw new Error('The Excel attachment is too large for Microsoft Graph (about 3 MB). Untick "Attach the full list" or use a filter.');
    const token = await mailSend_graphToken();
    const rcpt = a => a.map(x => ({ emailAddress: { address: x } }));
    const body = { message: { subject: m.subject, body: { contentType: 'HTML', content: m.html }, toRecipients: rcpt(to), ccRecipients: rcpt(cc), attachments: att ? [{ '@odata.type': '#microsoft.graph.fileAttachment', name: att.fileName, contentType: ctype, contentBytes: att.dataB64 }] : [] }, saveToSentItems: true };
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { let t = ''; try { t = (await r.json()).error.message; } catch (e) {} throw new Error(`Microsoft Graph said HTTP ${r.status}${t ? ': ' + t : ''}${r.status === 403 ? ' — Mail.Send permission is missing or not consented.' : ''}`); }
    return 'sent through your Microsoft 365 mailbox (a copy is in Sent Items)';
  }
  if (c.method === 'flow') {
    if (!/^https:\/\//i.test(c.flowUrl)) throw new Error('The Power Automate URL is not configured (Settings → Send email directly).');
    const payload = JSON.stringify({ to: to.join(';'), cc: cc.join(';'), subject: m.subject, bodyHtml: m.html, sender: (currentUser && (currentUser.email || currentUser.username)) || '', attachments: att ? [{ name: att.fileName, contentType: ctype, contentBase64: att.dataB64 }] : [] });
    try {
      const r = await fetch(c.flowUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      if (!r.ok) throw new Error(`The flow answered HTTP ${r.status}. Check the flow's run history.`);
      return 'handed to the Power Automate flow (it sends the mail)';
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;   // network / CORS: retry once as a "simple" request we cannot read back
      await fetch(c.flowUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: payload });
      return 'posted to the Power Automate flow (the browser cannot read its answer — check the flow run history to confirm)';
    }
  }
  throw new Error('Direct sending is not configured — choose a method in Settings → Send email directly, or use "Create Outlook draft".');
}
(function mailSend_ui() {
  const q = id => document.getElementById(id); if (!q('mailSendMethod')) return;
  const c = mailSend_cfg(); q('mailSendMethod').value = c.method; q('mailFlowUrl').value = c.flowUrl;
  const vis = () => { q('mailFlowRow').style.display = q('mailSendMethod').value === 'flow' ? '' : 'none'; }; vis(); q('mailSendMethod').addEventListener('change', vis);
  const st = (m, t) => { const el = q('mailSendStatus'); el.className = 'status-msg ' + (t || 'info'); el.textContent = m; };
  q('mailSendSaveBtn').addEventListener('click', () => {
    if (!isAdmin()) { st('✘ Only administrators can change this.', 'error'); return; }
    const m = q('mailSendMethod').value, u = q('mailFlowUrl').value.trim();
    if (m === 'flow' && !/^https:\/\//i.test(u)) { st('⚠ Paste the flow\'s HTTP POST URL (https://…).', 'warn'); return; }
    try { localStorage.setItem(MAIL_SEND_KEY, JSON.stringify({ method: m, flowUrl: u })); st('✅ Saved on this browser. To give it to every user, also set MAIL_SEND_DEFAULT in the HTML file.', 'success'); } catch (e) { st('✘ ' + e.message, 'error'); }
  });
  q('mailSendTestBtn').addEventListener('click', async () => {
    const me = (currentUser && currentUser.email) || ''; const to = prompt('Send the test e-mail to:', me); if (!to) return;
    try { localStorage.setItem(MAIL_SEND_KEY, JSON.stringify({ method: q('mailSendMethod').value, flowUrl: q('mailFlowUrl').value.trim() })); } catch (e) {}
    st('Sending…', 'info');
    try { st('✅ Test e-mail ' + await mailSend_send({ to, cc: '', subject: 'NFPC SC test e-mail', html: '<p>This is a test e-mail from the NFPC SC Management System.</p>', attachment: null }) + '.', 'success'); } catch (e) { st('✘ ' + e.message, 'error'); }
  });
})();

function getGlobalSiteUrl() { return loadGlobalSettings().siteUrl || ms_cfg().siteUrl || ''; }
function getGlobalAccessToken() { return loadGlobalSettings().accessToken || ''; }

function applyGlobalSettingsToUI() {
  const g = loadGlobalSettings();
  const siteUrlEl = $('siteUrl'); const tokenEl = $('accessToken');
  if (siteUrlEl) siteUrlEl.value = g.siteUrl;
  if (tokenEl) tokenEl.value = g.accessToken ? '••••••••••••••••' : '';
  const expSiteEl = $('expSiteUrl'); const edSiteEl = $('editorSiteUrl');
  if (expSiteEl) expSiteEl.value = g.siteUrl;
  if (edSiteEl) edSiteEl.value = g.siteUrl;
  const emlSiteEl = $('emlSiteUrl');                 // ← NEW
  if (emlSiteEl) emlSiteEl.value = g.siteUrl;        // ← NEW
  const gSite = $('globalSiteUrl'); const gTok = $('globalAccessToken');
  if (gSite) gSite.value = g.siteUrl;
  if (gTok) gTok.value = g.accessToken;
  const meta = $('globalSettingsMeta');
  if (meta) {
    if (g.updatedAt) meta.innerHTML = `Last updated: <strong>${formatDate(g.updatedAt)}</strong> by <strong>${escapeHtml(g.updatedBy || '—')}</strong>`;
    else meta.textContent = 'No global settings saved yet.';
  }
  syncToken();
}

/* ============================================================
   Auth
   ============================================================ */
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password, salt) {
  let h = salt + ":" + password;
  for (let i = 0; i < 10000; i++) h = await sha256(h);
  return h;
}
function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Built-in administrator — stored inside this file as a salted hash (the password itself is not in the file). Only this user can change or reset it. */
const BUILTIN_USER = { username: 'nader', displayName: 'Nader Al Najjar', role: 'admin', salt: '38235b55aa4aa5abc05404b8afcdf9c4', hash: '78e0211c590b958a30c0d5d1bc1063a064a37e9ae76b64961e92b47c3c869c1a' };
const isBuiltinLocked = u => !!(u && u.builtin && !(currentUser && String(currentUser.username).toLowerCase() === BUILTIN_USER.username));
const users = { list: [] };
async function loadUsers() {
  try {
    const raw = localStorage.getItem(LS_BASE + "_users");
    if (raw) users.list = JSON.parse(raw);
  } catch (e) { users.list = []; }
  { const b = users.list.find(x => String(x.username).toLowerCase() === BUILTIN_USER.username);
    if (b) { b.builtin = true; b.role = 'admin'; b.mustChangePassword = false; if (!b.salt || !b.hash) { b.salt = BUILTIN_USER.salt; b.hash = BUILTIN_USER.hash; } }
    else { users.list.unshift({ id: uid(), username: BUILTIN_USER.username, displayName: BUILTIN_USER.displayName, role: 'admin', salt: BUILTIN_USER.salt, hash: BUILTIN_USER.hash, builtin: true, mustChangePassword: false, allowedLists: [], editableLists: [], createdAt: Date.now(), lastLogin: null }); }
    saveUsers(); }
  try {   /* central user list from js/00-users-data.js (GitHub): add missing users; refresh file-managed ones whose password was not changed locally */
    (window.NFPC_USERS || []).forEach(f => {
      const key = String(f.username).toLowerCase(); if (key === BUILTIN_USER.username) return;
      const ex = users.list.find(x => String(x.username).toLowerCase() === key);
      if (!ex) users.list.push({ id: uid(), username: f.username, displayName: f.displayName || f.username, role: f.role, jobTitle: f.jobTitle || '', email: f.email || '', empId: f.empId || '', managerEmail: '', salt: f.salt, hash: f.hash, src: 'file', fileHash: f.hash, mustChangePassword: false, allowedLists: [], editableLists: [], createdAt: Date.now(), lastLogin: null });
      else if (ex.src === 'file' && ex.hash === ex.fileHash && !ex.builtin) Object.assign(ex, { salt: f.salt, hash: f.hash, fileHash: f.hash, jobTitle: f.jobTitle || '', email: f.email || ex.email || '', empId: f.empId || '' });
    });
    saveUsers();
  } catch (e) {}
  if (!users.list.length) {
    const salt = randomSalt();
    const hash = await hashPassword("admin", salt);
    users.list.push({
      id: uid(), username: "admin", displayName: "Administrator",
      role: "admin", salt, hash,
      mustChangePassword: true,
      allowedLists: [], editableLists: [],
      createdAt: Date.now(), lastLogin: null,
    });
    saveUsers();
    $('firstRunHint').style.display = 'block';
  }
}
function saveUsers() { try { localStorage.setItem(LS_BASE + "_users", JSON.stringify(users.list)); } catch (e) {} }
function findUser(username) {
  const u = String(username || '').trim().toLowerCase();
  return users.list.find(x => x.username.toLowerCase() === u);
}

let currentUser = null;
function saveSession() {
  if (!currentUser) { try { sessionStorage.removeItem(LS_BASE + "_session"); } catch (e) {} return; }
  try { sessionStorage.setItem(LS_BASE + "_session", JSON.stringify({ userId: currentUser.id, ts: Date.now() })); } catch (e) {}
}
function loadSession() {
  try {
    const raw = sessionStorage.getItem(LS_BASE + "_session");
    if (!raw) return null;
    const s = JSON.parse(raw);
    return users.list.find(x => x.id === s.userId) || null;
  } catch (e) { return null; }
}
function hasPerm(perm) {
  if (!currentUser) return false;
  const role = ROLES[currentUser.role];
  if (!role) return false;
  return role.perms.has('*') || role.perms.has(perm);
}
function isAdmin() { return currentUser && currentUser.role === 'admin'; }
