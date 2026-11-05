/* ORBIT — product name (Operations · Racks · Batches · Inventory · Trips). Shown on the login card and under the company brand in the side panel,
   also when the administrator has published the company name / logo as the brand. */
(function () {
  const NAME = 'ORBIT', FULL = 'Operations · Racks · Batches · Inventory · Trips';
  const css = document.createElement('style'); css.textContent = `.orbit-mark{display:flex;align-items:center;gap:7px;font-weight:800;letter-spacing:.22em;font-size:13px;line-height:1}
.orbit-mark i{font-style:normal;display:inline-flex;width:20px;height:20px;border-radius:50%;align-items:center;justify-content:center;background:conic-gradient(from 210deg,#22d3ee,#6366f1,#a855f7,#22d3ee);color:#fff;font-size:11px;letter-spacing:0;box-shadow:0 0 0 2px rgba(255,255,255,.25)}
.orbit-mark small{font-weight:500;letter-spacing:.02em;font-size:10.5px;opacity:.8}
.sidebar .orbit-mark{margin:6px 0 2px;color:inherit}.login-card .orbit-mark{justify-content:center;flex-wrap:wrap;margin:2px 0 16px;padding:10px 0 12px;border-top:1px solid var(--border,#e2e8f0);border-bottom:1px solid var(--border,#e2e8f0);font-size:24px;color:var(--brand,#1e3a8a)}.login-card .orbit-mark i{width:30px;height:30px;font-size:16px}.login-card .orbit-mark small{flex-basis:100%;text-align:center;font-size:11.5px;letter-spacing:.08em;margin-top:6px;color:var(--gray-600,#64748b);opacity:1}
body.sb-mini .sidebar .orbit-mark small{display:none}
.sidebar-brand:has(.logo img)>span[data-brand=name]{display:none!important}
body:not(.sb-mini) .sidebar-brand:has(.logo img) .logo{width:auto!important;max-width:210px;height:66px!important;background:transparent!important;box-shadow:none!important;padding:0!important;justify-content:flex-start}
body:not(.sb-mini) .sidebar-brand:has(.logo img) .logo img{width:auto!important;height:100%!important;max-width:210px;object-fit:contain}
.login-brand:has(.logo img) h1{display:none!important}.login-brand:has(.logo img) .logo{width:auto!important;max-width:190px;height:70px!important;background:transparent!important}.login-brand:has(.logo img) .logo img{width:auto!important;height:100%!important}
/* login card (option C): the company leads — big NFPC logo + name on top, ORBIT as a small mark at the bottom of the card */
.login-card{display:flex;flex-direction:column}
.login-card .login-brand{flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;gap:10px!important;margin-bottom:18px!important}
.login-card .login-brand>div{display:flex;flex-direction:column;align-items:center}
.login-card .login-brand:has(.logo img) .logo{height:110px!important;max-width:300px!important;width:auto!important;margin:0 auto!important;padding:0!important;background:transparent!important;box-shadow:none!important}
.login-card .login-brand .logo img{height:100%!important;width:auto!important;max-width:300px!important;object-fit:contain}
.login-card .login-brand .tagline{font-size:16px!important;font-weight:700!important;letter-spacing:.09em!important;color:var(--gray-800,#1f2937)!important;margin-top:0!important;text-transform:uppercase}
.login-card .orbit-mark{order:99;border:0!important;font-size:12px!important;letter-spacing:.2em!important;margin:14px 0 0!important;padding:0!important;color:var(--gray-500,#64748b)!important;gap:6px!important}
.login-card .orbit-mark i{width:16px!important;height:16px!important;font-size:9px!important}.login-card .orbit-mark small{display:none!important}`; document.head.appendChild(css);
  const mk = (sub) => { const d = document.createElement('div'); d.className = 'orbit-mark'; d.title = NAME + ' — ' + FULL; d.innerHTML = '<i>◎</i><span>' + NAME + '</span>' + (sub ? '<small>' + FULL + '</small>' : ''); return d; };
  function put() {
    const isOrbit = n => !!n && n.offsetParent !== null && getComputedStyle(n).visibility !== 'hidden' && String(n.textContent || '').trim().toUpperCase() === NAME;
    /* one ORBIT only: the badge is shown when the brand name is not already “ORBIT” on screen (a logo picture hides the name) */
    const sb = document.querySelector('.sidebar-brand'); if (sb) { const n = sb.querySelector('[data-brand="name"]'), m = document.querySelector('.sidebar .orbit-mark'); if (isOrbit(n)) { if (m) m.remove(); } else if (!m) sb.insertAdjacentElement('afterend', mk(false)); }
    const lc = document.querySelector('.login-card'); if (lc) { const n = lc.querySelector('[data-brand="name"]'), m = lc.querySelector('.orbit-mark'); if (isOrbit(n)) { if (m) m.remove(); } else if (!m) { const br = lc.querySelector('.login-brand'); br ? br.insertAdjacentElement('afterend', mk(true)) : lc.insertBefore(mk(true), lc.firstChild); } }
    if (!/ORBIT/.test(document.title)) document.title = 'ORBIT · ' + document.title.replace(/\s*—\s*Secure$/, '');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put); else put(); setInterval(put, 2000);
})();
