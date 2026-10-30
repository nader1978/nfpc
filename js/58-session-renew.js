/* ---------- Microsoft session renewal by the users themselves (login window + pop-up) · bridge for the offline file · login lock-out ---------- */
(function () {
  const Q = s => document.querySelector(s), BR_KEY = LS_BASE + '_sr_bridge', fmtT = t => new Date(t).toLocaleString();
  const toast = (t, k) => { try { sectionToast(t, k); } catch (e) {} };
  const stOf = () => { const t = getGlobalAccessToken(); if (!t) return { s: 'none' }; const e = tf_exp(t); if (!e) return { s: 'ok' }; const left = e - Date.now(); return { s: left <= 0 ? 'expired' : left < 5 * 60e3 ? 'soon' : 'ok', e, left }; };
  const isFile = () => location.protocol === 'file:', brUrl = () => { try { return localStorage.getItem(BR_KEY) || ''; } catch (e) { return ''; } };
  const rnd = () => { const a = new Uint8Array(16); (crypto || window.msCrypto).getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };
  /* ===== bridge page: the ONLINE version, opened by the offline file, signs the user in and hands HIS OWN token back ===== */
  const P = new URLSearchParams(location.search);
  if (P.get('bridge') === '1') {
    document.documentElement.classList.add('sr-bridge'); const st = document.createElement('style'); st.textContent = 'html.sr-bridge body>:not(#srBridge){display:none!important}#srBridge{position:fixed;inset:0;background:var(--acc-grad,#12306b);display:flex;align-items:center;justify-content:center;padding:18px;font-family:inherit}#srBridge .c{background:#fff;color:#222;border-radius:16px;max-width:460px;width:100%;padding:26px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}#srBridge button{border:0;border-radius:8px;padding:11px 18px;font-size:15px;font-weight:600;cursor:pointer;background:#0b5cad;color:#fff;margin:6px}#srBridge button.g{background:#1d7a3a}#srBridge small{color:#555;display:block;margin-top:10px;line-height:1.5}'; document.head.appendChild(st);
    const n = P.get('n') || '', box = document.createElement('div'); box.id = 'srBridge'; document.body.appendChild(box);
    if (P.get('t') && P.get('c') && !ms_configured()) { try { localStorage.setItem(MS_CFG_KEY, JSON.stringify({ tenantId: P.get('t'), clientId: P.get('c'), siteUrl: P.get('s') || '' })); } catch (e) {} }
    const draw = (html) => { box.innerHTML = '<div class="c">' + html + '</div>'; };
    const start = () => { draw('<div style="font-size:40px">🔑</div><h2 style="margin:6px 0">Renew your Microsoft session</h2><div>Sign in with <b>your own</b> Microsoft account. Nothing is typed into the offline file.</div><button id="srGo" type="button">Sign in with Microsoft</button><small>This window only passes your sign-in to the application that opened it, then closes.</small>');
      Q('#srGo').onclick = async () => { Q('#srGo').disabled = true; Q('#srGo').textContent = 'Signing in…'; const ok = await ms_signIn(true); if (!ok || stOf().s === 'none') { draw('<div style="font-size:36px">⚠</div><h3>Sign-in was not completed</h3><div style="font-size:13px">' + (window.ms_lastErr || 'Please try again.') + '</div><button id="srRe" type="button">Try again</button>'); Q('#srRe').onclick = start; return; }
        const s = stOf(); draw('<div style="font-size:40px">✅</div><h3 style="margin:6px 0">Signed in</h3><div style="font-size:13px">Valid until <b>' + (s.e ? fmtT(s.e) : 'later today') + '</b></div><button class="g" id="srSend" type="button">Send to the application and close</button><small>Press the button only if you started this from the NFPC application on your own computer.</small>');
        Q('#srSend').onclick = () => { if (!window.opener) { draw('<h3>Open this page from the application</h3>'); return; } window.opener.postMessage({ type: 'nfpc-token', n, accessToken: getGlobalAccessToken(), spToken: sp_token(), siteUrl: getGlobalSiteUrl(), exp: s.e || 0 }, '*'); draw('<div style="font-size:40px">✔</div><h3>Done</h3><div>You can close this window.</div>'); setTimeout(() => { try { window.close(); } catch (e) {} }, 700); }; }; };
    if (!window.opener) draw('<div style="font-size:36px">ℹ</div><h3>This is the sign-in bridge</h3><div style="font-size:13px">Start it from the “Renew Microsoft session” button inside the NFPC application.</div>'); else start();
    return;
  }
  /* ===== renewal from the normal application ===== */
  function bridgeAsk() { let u = brUrl(); if (!u) { u = prompt('Web address of the ONLINE version of this system (the https:// address where the same application is published):', 'https://'); if (!u) return ''; } try { const x = new URL(u.trim()); if (x.protocol !== 'https:') throw new Error('https only'); u = x.origin + x.pathname; localStorage.setItem(BR_KEY, u); return u; } catch (e) { toast('The online address must start with https://', 'error'); try { localStorage.removeItem(BR_KEY); } catch (x) {} return ''; } }
  function bridge() { return new Promise(resolve => { const url = bridgeAsk(); if (!url) return resolve(false); const n = rnd(), u = new URL(url), c = ms_cfg(); u.searchParams.set('bridge', '1'); u.searchParams.set('n', n); if (c.tenantId) u.searchParams.set('t', c.tenantId); if (c.clientId) u.searchParams.set('c', c.clientId); if (c.siteUrl || getGlobalSiteUrl()) u.searchParams.set('s', c.siteUrl || getGlobalSiteUrl());
      const w = window.open(u.toString(), 'nfpc_bridge', 'width=520,height=680'); if (!w) { toast('The sign-in window was blocked — allow pop-ups for this page and try again.', 'warn'); return resolve(false); }
      let done = false; const fin = r => { if (done) return; done = true; removeEventListener('message', on); clearInterval(t); resolve(r); };
      const on = e => { const d = e.data; if (e.origin !== u.origin || !d || d.type !== 'nfpc-token' || d.n !== n) return; try { tf_apply({ accessToken: d.accessToken, spToken: d.spToken, siteUrl: d.siteUrl }); fin(true); } catch (x) { toast('✘ ' + x.message, 'error'); fin(false); } };
      addEventListener('message', on); const t = setInterval(() => { if (w.closed) setTimeout(() => fin(false), 800); }, 700); setTimeout(() => fin(false), 10 * 60e3); }); }
  let busy = false;
  async function renew() {
    if (busy) return false; busy = true; let ok = false;
    try {
      if (!isFile() && ms_configured()) { try { ok = !!(await ms_acquire(false)); } catch (e) { ok = false; } if (!ok) ok = await ms_signIn(true); }
      else if (!isFile()) { toast('Microsoft sign-in is not set up yet — ask an administrator to enter the Tenant ID and Client ID in Settings.', 'warn'); }
      else ok = await bridge();
      if (ok) { try { listsCache.clear(); applyGlobalSettingsToUI(); syncToken(); } catch (e) {} toast('✔ Microsoft session renewed' + (stOf().e ? ' — valid until ' + fmtT(stOf().e) : '') + '.'); try { addActivity('auth', 'Microsoft session renewed by the user'); } catch (e) {} }
    } finally { busy = false; upd(); }
    return ok;
  }
  window.srRenew = renew;
  /* ----- pop-up prompt ----- */
  let snooze = 0; const pop = document.createElement('div'); pop.id = 'srPop'; pop.style.cssText = 'display:none;position:fixed;right:18px;bottom:18px;z-index:100040;max-width:360px;background:var(--card,#fff);color:var(--gray-800,#222);border:1px solid var(--border,#cbd5e1);border-left:5px solid #d97706;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.3);padding:14px 16px;font-size:13.5px'; document.body.appendChild(pop);
  pop.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'later') { snooze = Date.now() + 10 * 60e3; pop.style.display = 'none'; } else if (b.dataset.a === 'renew') { b.disabled = true; b.textContent = 'Working…'; renew().then(() => upd()); } else if (b.dataset.a === 'addr') { try { localStorage.removeItem(BR_KEY); } catch (x) {} toast('Press “Renew now” and enter the new address.'); } });
  const btnCss = 'border:0;border-radius:8px;padding:7px 13px;font-weight:600;cursor:pointer;margin-right:6px;';
  function msgFor(s) { return s.s === 'expired' ? 'Your Microsoft session <b>expired</b> at ' + fmtT(s.e) + '.' : s.s === 'soon' ? 'Your Microsoft session ends in <b>' + Math.max(1, Math.round(s.left / 60e3)) + ' min</b>.' : 'You are not connected to Microsoft 365 yet — SharePoint data cannot be read or saved.'; }
  function how() { return isFile() ? 'A small window of the online version opens — sign in there with <b>your own</b> Microsoft account. No administrator is needed.' : 'A Microsoft sign-in window opens — use <b>your own</b> account. No administrator is needed.'; }
  function upd() {
    const s = stOf(), inApp = !!(typeof currentUser !== 'undefined' && currentUser), L = Q('#srLogin'), ls = Q('#loginScreen'), onLogin = ls && getComputedStyle(ls).display !== 'none';
    if (L) { if (onLogin && s.s !== 'ok') { L.style.display = 'block'; L.innerHTML = '<div style="margin-bottom:6px">🔑 ' + msgFor(s) + '</div><button type="button" data-a="renew" style="' + btnCss + 'background:#0b5cad;color:#fff">Renew Microsoft session</button><div style="font-size:12px;margin-top:6px;opacity:.85">' + how() + '</div>'; } else L.style.display = 'none'; }
    if (inApp && !onLogin && s.s !== 'ok' && Date.now() > snooze) { if (s.s === 'soon' && !isFile() && ms_configured() && !upd.try) { upd.try = 1; ms_acquire(false).then(r => { upd.try = 0; if (r) { try { applyGlobalSettingsToUI(); syncToken(); } catch (e) {} } upd(); }).catch(() => { upd.try = 0; snooze = 0; pop.dataset.force = 1; upd(); }); if (!pop.dataset.force) return; }
      pop.style.display = 'block'; pop.innerHTML = '<div style="font-weight:700;margin-bottom:4px">🔑 Microsoft session</div><div>' + msgFor(s) + '</div><div style="font-size:12px;margin:6px 0 10px;opacity:.85">' + how() + '</div><button type="button" data-a="renew" style="' + btnCss + 'background:#0b5cad;color:#fff">Renew now</button><button type="button" data-a="later" style="' + btnCss + 'background:transparent;border:1px solid var(--border,#cbd5e1);color:inherit">Later</button>' + (isFile() && brUrl() ? '<a href="#" data-a="addr" style="font-size:11px">change address</a>' : ''); }
    else pop.style.display = 'none'; }
  if (Q('#srLogin')) Q('#srLogin').addEventListener('click', e => { const b = e.target.closest('[data-a=renew]'); if (b) { b.disabled = true; b.textContent = 'Working…'; renew(); } });
  setInterval(upd, 20000); setTimeout(upd, 800);
  { const prev = onLoginComplete; onLoginComplete = function () { const r = prev.apply(this, arguments); snooze = 0; setTimeout(upd, 1200); return r; }; }
  { const sl = showLogin; showLogin = async function () { const r = await sl.apply(this, arguments); setTimeout(upd, 100); return r; }; }
  /* ----- login lock-out: 5 wrong passwords for a user name → 5 minutes wait (deterrent; the real protection is in the SharePoint list permissions) ----- */
  const LK = LS_BASE + '_loginlock', lk = () => { try { return JSON.parse(localStorage.getItem(LK) || '{}'); } catch (e) { return {}; } }, lkSet = o => { try { localStorage.setItem(LK, JSON.stringify(o)); } catch (e) {} };
  const form = Q('#loginForm'), err = Q('#loginError');
  if (form && err) {
    form.addEventListener('submit', e => { const u = (Q('#loginUsername').value || '').trim().toLowerCase(), o = lk()[u]; if (o && o.until > Date.now()) { e.preventDefault(); e.stopImmediatePropagation(); err.textContent = 'Too many wrong attempts. Try again in ' + Math.ceil((o.until - Date.now()) / 60e3) + ' min.'; err.classList.add('visible'); } else form._u = u; }, true);
    new MutationObserver(() => { const u = form._u; if (!u || !err.classList.contains('visible') || !/^Invalid username/i.test(err.textContent)) return; const all = lk(), o = all[u] && all[u].until > Date.now() ? all[u] : { n: (all[u] && all[u].n) || 0 }; o.n = (o.n || 0) + 1; if (o.n >= 5) { o.until = Date.now() + 5 * 60e3; o.n = 0; err.textContent = 'Too many wrong attempts. Try again in 5 min.'; } all[u] = o; lkSet(all); form._u = ''; }).observe(err, { attributes: true, childList: true, characterData: true, subtree: true });
    new MutationObserver(() => { if (Q('#loginScreen') && getComputedStyle(Q('#loginScreen')).display === 'none' && form._u === undefined) return; if (Q('#loginScreen') && getComputedStyle(Q('#loginScreen')).display === 'none') { const all = lk(), u = (Q('#loginUsername').value || '').trim().toLowerCase(); if (all[u]) { delete all[u]; lkSet(all); } } }).observe(Q('#loginScreen'), { attributes: true, attributeFilter: ['style', 'class'] });
  }
})();
