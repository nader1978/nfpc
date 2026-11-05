/* ---------- new-version check: the page compares its own build with version.json (never cached) and offers a one-click refresh ---------- */
const APP_BUILD = '163', APP_SERIAL = '05.11.26.76';
(function () { const put = () => { const e = document.getElementById('sbBuild'); if (e) e.textContent = 'ORBIT · version ' + APP_SERIAL; }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put); else put(); })();
(function () {
  if (location.protocol === 'file:') return; let shown = false; const SK = 'orbUpd';
  const ss = { get: k => { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  const page = () => location.href.split('#')[0].split('?')[0];
  /* Update now: refresh the browser's copy of the page and of every script / style it uses (cache: 'reload'), then check that the server really sends the new build before reloading */
  async function go(b, d) { const msg = d.querySelector('span'), bt = d.querySelectorAll('button'); bt.forEach(x => x.disabled = true); msg.textContent = 'Updating to build ' + b + '…';
    try { if (window.caches && caches.keys) { const k = await caches.keys(); await Promise.all(k.map(x => caches.delete(x))); } } catch (e) {}
    const urls = [page(), new URL('mobile.html', page()).href, ...[...document.scripts].map(s => s.src).filter(Boolean), ...[...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href)].filter(u => u.startsWith(location.origin));
    await Promise.all(urls.map(u => fetch(u, { cache: 'reload' }).catch(() => null)));
    let srv = ''; try { const h = await (await fetch(page() + '?t=' + Date.now(), { cache: 'no-store' })).text(); srv = (h.match(/60-update-check\.js\?v=(\d+)/) || [])[1] || ''; } catch (e) {}
    if (srv && srv !== b) { ss.set(SK, b); bt.forEach(x => x.disabled = false); msg.innerHTML = '⚠ version.json says build <b>' + b + '</b>, but the server still sends the build <b>' + srv + '</b> page. Upload <b>all</b> files of ORBIT_Version_' + b + '_split.zip (index.html, mobile.html and the js / css folders) — then press Ctrl+F5.'; bt[0].style.display = 'none'; bt[1].textContent = 'OK'; return; }
    ss.set(SK, b); const u = new URL(location.href); u.searchParams.set('r', b + '-' + Date.now()); location.replace(u.toString()); }
  async function chk() {
    try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(), b = String(j.build || ''); if (!b || b === APP_BUILD || shown) return;
      if (ss.get(SK + '_later') === b) return;   /* "Later" / "OK": not again for this build until the browser is closed */
      const tried = ss.get(SK) === b; shown = true;
      const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:100060;background:' + (tried ? '#b45309' : '#0b5cad') + ';color:#fff;border-radius:12px;padding:10px 16px;box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:14px;display:flex;gap:12px;align-items:center;max-width:min(860px,94vw)';
      d.innerHTML = '🔄 <span>' + (tried ? 'The update to build ' + b + ' did not load — this browser still runs build ' + APP_BUILD + '. Press <b>Ctrl+F5</b>; if it stays, ask the administrator to upload all files of build ' + b + '.' : 'A new version of the system is available (build ' + b + ', you are on ' + APP_BUILD + ').') + '</span><button type="button" style="border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;white-space:nowrap">' + (tried ? 'Try again' : 'Update now') + '</button><button type="button" data-l="1" style="border:0;background:transparent;color:#fff;cursor:pointer;text-decoration:underline;white-space:nowrap">Later</button>';
      d.querySelector('button').onclick = () => go(b, d); d.querySelector('[data-l]').onclick = () => { ss.set(SK + '_later', b); d.remove(); }; document.body.appendChild(d); } catch (e) {}
  }
  setTimeout(chk, 1500); setInterval(chk, 5 * 60 * 1000);
})();
