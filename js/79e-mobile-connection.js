/* ORBIT MOBILE — Connection settings (Profile → 🔌 Connection settings).
   mob.alnajjar.in is its own site, so it keeps its own copy of the SharePoint / Microsoft sign-in settings.
   · SharePoint site URL, Tenant ID, Client ID (admin) · Sign in / out · Test connection · e-mail sending method
   · Setup link: the admin shares one link; opening it on a phone fills these settings (no typing) */
(function () {
  'use strict';
  const K = window.MOBXK; if (!K) return;
  const { A, reg, H, esc, toast, render, V } = K;
  const isAdm = () => typeof isAdmin === 'function' && isAdmin();
  const cfgKey = () => (typeof MS_CFG_KEY !== 'undefined' ? MS_CFG_KEY : (typeof LS_BASE !== 'undefined' ? LS_BASE : 'app') + '_ms_cfg');
  const getCfg = () => (typeof ms_cfg === 'function' ? ms_cfg() : { tenantId: '', clientId: '', siteUrl: '' });
  function setCfg(c) { try { localStorage.setItem(cfgKey(), JSON.stringify({ tenantId: c.tenantId || '', clientId: c.clientId || '', siteUrl: c.siteUrl || '' })); } catch (e) {}
    try { if (typeof saveGlobalSettings === 'function') saveGlobalSettings(c.siteUrl || '', (typeof getGlobalAccessToken === 'function' && getGlobalAccessToken()) || ''); } catch (e) {}
    try { ms_app = null; } catch (e) {} try { listsCache.clear(); } catch (e) {} }
  const mailCfg = () => (typeof mailSend_cfg === 'function' ? mailSend_cfg() : { method: 'graph', flowUrl: '' });
  const mailKey = () => (typeof MAIL_SEND_KEY !== 'undefined' ? MAIL_SEND_KEY : 'app_mailsend');
  const tokExp = t => { try { const j = JSON.parse(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return j.exp ? j.exp * 1000 : 0; } catch (e) { return 0; } };
  const tokUser = t => { try { const j = JSON.parse(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return j.upn || j.unique_name || j.preferred_username || ''; } catch (e) { return ''; } };
  const redirect = () => location.origin + location.pathname;

  /* setup link: …/mobile.html#orbitcfg=<base64 json> → saved on this phone, then removed from the address bar */
  (function fromLink() { const m = /[#&]orbitcfg=([^&]+)/.exec(location.hash || ''); if (!m) return;
    try { const c = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))); setCfg(c); if (c.mail) { try { localStorage.setItem(mailKey(), JSON.stringify(c.mail)); } catch (e) {} }
      history.replaceState(null, '', location.pathname + location.search); setTimeout(() => toast('✅ Connection settings saved on this phone — now tap “Sign in with Microsoft”.', 'success'), 1500); }
    catch (e) { setTimeout(() => toast('The setup link is not valid: ' + e.message, 'error'), 1500); } })();
  const setupLink = () => { const c = getCfg(), mc = mailCfg(), o = { tenantId: c.tenantId, clientId: c.clientId, siteUrl: (typeof getGlobalSiteUrl === 'function' && getGlobalSiteUrl()) || c.siteUrl, mail: { method: mc.method, flowUrl: mc.flowUrl } };
    return redirect() + '#orbitcfg=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(o))))); };

  async function account() { try { if (typeof ms_configured === 'function' && !ms_configured()) return null; const app = await ms_init(); return app.getAllAccounts()[0] || null; } catch (e) { return null; } }

  reg('x_conn', {
    load(v) { const c = getCfg(), mc = mailCfg(); Object.assign(v, { site: (typeof getGlobalSiteUrl === 'function' && getGlobalSiteUrl()) || c.siteUrl, ten: c.tenantId, cli: c.clientId, mm: mc.method, flow: mc.flowUrl }); account().then(a => { v._acct = a ? a.username : ''; render(); }); },
    view(v) { const adm = isAdm(), tok = (typeof getGlobalAccessToken === 'function' && getGlobalAccessToken()) || '', exp = tokExp(tok), left = exp ? Math.round((exp - Date.now()) / 60000) : null, c = getCfg(), conf = !!(c.tenantId && c.clientId), site = (typeof getGlobalSiteUrl === 'function' && getGlobalSiteUrl()) || c.siteUrl;
      const st = !tok ? ['r', 'Not connected'] : left != null && left <= 0 ? ['o', 'Token expired — sign in again'] : ['g', 'Connected'];
      let h = H.head('🔌', 'Connection settings', 'SharePoint & Microsoft 365 for this phone · ' + esc(location.host), '#0369a1');
      h += H.card('Status', `<div class="mb-li mb-kv"><div class="d"><small>Microsoft 365</small><b>${esc(v._acct || tokUser(tok) || '—')}</b></div><span class="mb-pill ${st[0]}">${st[1]}</span></div>`
        + `<div class="mb-li mb-kv"><div class="d"><small>SharePoint site</small><b style="white-space:normal;word-break:break-all">${esc(site || '— not set —')}</b></div></div>`
        + (left != null && left > 0 ? `<div class="mb-li mb-kv"><div class="d"><small>Token</small><b>valid ${left} min · renews automatically</b></div></div>` : '')
        + (v._test ? `<div class="mb-hint ${v._test.ok ? 'mb-ok' : 'mb-bad'}" style="margin-top:8px">${esc(v._test.msg)}</div>` : '')
        + `<div class="mx-acts">${H.sbtn('🔑 Sign in with Microsoft', 'signin', conf ? '' : 'disabled', 'p')}${H.sbtn('🧪 Test connection', 'test')}</div><div class="mx-acts">${H.sbtn('⏻ Sign out of Microsoft', 'signout', '', 'r')}</div>`);
      if (!adm) return h + H.card('', `<div class="mb-hint">${conf ? 'The Microsoft sign-in is set up on this phone. Only an administrator can change it.' : 'Microsoft sign-in is not set up on this phone yet. Ask your administrator for the ORBIT <b>setup link</b> and open it on this phone — the settings fill in by themselves.'}</div>`);
      h += H.card('SharePoint & Microsoft sign-in <span class="mb-pill" style="margin-left:auto">admin</span>', H.f('SharePoint site URL', H.inp('site', { ph: 'https://<tenant>.sharepoint.com/sites/<site>', mode: 'url' })) + H.f('Tenant ID (Directory ID)', H.inp('ten', { ph: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' })) + H.f('Client ID (Application ID)', H.inp('cli', { ph: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' }))
        + `<div class="mb-hint" style="margin:2px 0 10px">Register this address as a <b>Single-page application</b> redirect URI of the app in Microsoft Entra (Azure):</div><div class="mx-odorow"><input value="${esc(redirect())}" readonly><button type="button" class="mx-sb" data-x="copy" data-t="${esc(redirect())}">Copy</button></div>`
        + `<div class="mx-acts">${H.sbtn('💾 Save', 'save', '', 'g')}</div>`);
      h += H.card('E-mail sending', H.seg('mm', [['graph', 'Microsoft 365'], ['flow', 'Power Automate'], ['draft', 'Off']], 'graph') + (v.mm === 'flow' ? H.f('Flow HTTP URL', H.inp('flow', { ph: 'https://prod-…logic.azure.com/…' })) : '') + `<div class="mx-acts">${H.sbtn('💾 Save e-mail setting', 'saveMail')}</div>`);
      h += H.card('📲 Set up other phones', `<div class="mb-hint" style="margin-bottom:10px">Share this link with the users (WhatsApp, e-mail). Opening it on a phone saves the site, Tenant ID, Client ID and e-mail setting there — the user then only taps “Sign in with Microsoft”. No passwords or tokens are in the link.</div><div class="mx-acts">${H.sbtn('📋 Copy setup link', 'copyLink', conf ? '' : 'disabled', 'p')}${navigator.share ? H.sbtn('↗ Share', 'shareLink', conf ? '' : 'disabled') : ''}</div>`);
      h += `<details class="mb-card"><summary style="cursor:pointer;font-weight:700">Advanced · paste an access token</summary><div class="mb-hint" style="margin:8px 0">Only when Microsoft sign-in cannot be used on this phone. The token expires in about an hour.</div>${H.f('Access token (Bearer)', H.txt('tok', 'eyJ0eXAiOi…'))}<div class="mx-acts">${H.sbtn('💾 Use this token', 'saveTok')}</div></details>`;
      return h; },
    act: {
      async save(t, v) { const site = String(v.site || '').trim().replace(/\/+$/, ''), ten = String(v.ten || '').trim(), cli = String(v.cli || '').trim();
        if (site && !/^https:\/\/[^/]+\.sharepoint\.com\/sites\/[^/]+/i.test(site)) return toast('The site URL should look like https://<tenant>.sharepoint.com/sites/<site>', 'warn');
        const g = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i; if ((ten && !g.test(ten)) || (cli && !g.test(cli))) return toast('Tenant ID and Client ID are GUIDs (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).', 'warn');
        setCfg({ siteUrl: site, tenantId: ten, clientId: cli }); toast('✅ Saved on this phone. Now tap “Sign in with Microsoft”.', 'success'); render(); },
      saveMail(t, v) { try { localStorage.setItem(mailKey(), JSON.stringify({ method: v.mm || 'graph', flowUrl: v.flow || '' })); } catch (e) {} toast('✅ E-mail setting saved', 'success'); },
      async signin(t, v) { if (typeof ms_signIn !== 'function') return toast('Microsoft sign-in is not available on this page.', 'error'); const ok = await ms_signIn(true); const a = await account(); v._acct = a ? a.username : ''; v._test = ok ? { ok: true, msg: '✅ Signed in' + (a ? ' as ' + a.username : '') + '.' } : { ok: false, msg: '✘ Sign-in failed: ' + (window.ms_lastErr || 'see the message') + (/redirect|AADSTS50011/i.test(window.ms_lastErr || '') ? ' — add ' + redirect() + ' as a redirect URI in Azure.' : '') }; try { K.flush(true); } catch (e) {} render(); },
      async signout(t, v) { if (!confirm('Sign out of Microsoft 365 on this phone?')) return; if (typeof ms_signOut === 'function') await ms_signOut(); v._acct = ''; v._test = null; render(); },
      async test(t, v) { v._test = { ok: true, msg: '⏳ Testing…' }; render(); const site = (typeof getGlobalSiteUrl === 'function' && getGlobalSiteUrl()) || getCfg().siteUrl, tok = (typeof getGlobalAccessToken === 'function' && getGlobalAccessToken()) || '';
        try { if (!site) throw new Error('the SharePoint site URL is empty'); if (!tok) throw new Error('not signed in'); const t0 = Date.now(), r = await resolveIds(site, 'LoginUserList', tok); if (!r || !r.listId) throw new Error('list not found');
          v._test = { ok: true, msg: '✅ Connected — SharePoint answered in ' + (Date.now() - t0) + ' ms (LoginUserList found).' }; } catch (e) { v._test = { ok: false, msg: '✘ ' + e.message }; } render(); },
      copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t.dataset.t) : Promise.reject()).then(() => toast('Copied', 'success'), () => prompt('Copy:', t.dataset.t)); },
      copyLink() { const l = setupLink(); (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(() => toast('📋 Setup link copied — send it to the users.', 'success'), () => prompt('Copy the setup link:', l)); },
      shareLink() { navigator.share({ title: 'ORBIT mobile setup', text: 'Open this link on your phone to set up ORBIT mobile:', url: setupLink() }).catch(() => {}); },
      saveTok(t, v) { const tok = String(v.tok || '').trim(); if (!/^ey/.test(tok)) return toast('That does not look like an access token.', 'warn'); try { saveGlobalSettings((typeof getGlobalSiteUrl === 'function' && getGlobalSiteUrl()) || getCfg().siteUrl, tok); listsCache.clear(); } catch (e) {} v.tok = ''; toast('✅ Token saved' + (tokExp(tok) ? ' — valid until ' + new Date(tokExp(tok)).toLocaleTimeString() : ''), 'success'); render(); } } });
})();
