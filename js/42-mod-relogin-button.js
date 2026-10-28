
/* ---------- top-bar "Re-login" button: refresh the Microsoft token on any page ---------- */
(function () {
  const b = document.querySelector('#msReloginBtn'); if (!b) return; let busy = false;
  const say = (t, k) => { try { sectionToast(t, k); } catch (e) {} };
  async function relogin() {
    if (busy) return; if (!ms_configured()) { say('Microsoft sign-in is not set up yet — an administrator enters the Tenant ID and Client ID in Settings.', 'warn'); return; }
    busy = true; const old = b.innerHTML; b.disabled = true; b.innerHTML = '⏳ Signing in…';
    try {
      const app = await ms_init(), acct = app.getAllAccounts()[0], graph = { scopes: ['https://graph.microsoft.com/Sites.ReadWrite.All', 'https://graph.microsoft.com/User.Read'] };
      if (!acct) await app.loginPopup(graph);
      else { try { await app.acquireTokenSilent({ ...graph, account: acct, forceRefresh: true }); } catch (e) { await app.acquireTokenPopup({ ...graph, account: acct }); } }
      const ok = await ms_signIn(true);
      if (ok) { say('✔ Signed in again — the Microsoft token is refreshed.'); try { addActivity('auth', 'Re-login to Microsoft'); } catch (e) {} }
      else say('Could not refresh the token: ' + (window.ms_lastErr || 'sign-in was not completed.'), 'error');
    } catch (e) {
      const m = String((e && (e.errorMessage || e.message)) || e); say(/popup/i.test(m) ? 'The sign-in window was blocked or closed — allow pop-ups for this site and try again.' : 'Could not sign in: ' + m.slice(0, 160), 'error');
    } finally { busy = false; b.disabled = false; b.innerHTML = old; try { syncToken(); } catch (e) {} }
  }
  b.addEventListener('click', relogin);
})();
