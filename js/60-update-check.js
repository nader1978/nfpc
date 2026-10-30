/* ---------- new-version check: the page compares its own build with version.json (never cached) and offers a one-click refresh ---------- */
const APP_BUILD = '89';
(function () {
  if (location.protocol === 'file:') return; let shown = false;
  const go = b => { try { if (window.caches && caches.keys) caches.keys().then(k => k.forEach(x => caches.delete(x))); } catch (e) {} const u = new URL(location.href); u.searchParams.set('r', b + '-' + Date.now()); location.replace(u.toString()); };
  async function chk() {
    try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(), b = String(j.build || ''); if (!b || b === APP_BUILD || shown) return; shown = true;
      const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:100060;background:#0b5cad;color:#fff;border-radius:12px;padding:10px 16px;box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:14px;display:flex;gap:12px;align-items:center';
      d.innerHTML = '🔄 <span>A new version of the system is available (build ' + b + ', you are on ' + APP_BUILD + ').</span><button type="button" style="border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer">Update now</button><button type="button" data-l="1" style="border:0;background:transparent;color:#fff;cursor:pointer;text-decoration:underline">Later</button>';
      d.querySelector('button').onclick = () => go(b); d.querySelector('[data-l]').onclick = () => d.remove(); document.body.appendChild(d); } catch (e) {}
  }
  setTimeout(chk, 1500); setInterval(chk, 5 * 60 * 1000);
})();
