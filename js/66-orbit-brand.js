/* ORBIT — product name (Operations · Racks · Batches · Inventory · Trips). Shown on the login card and under the company brand in the side panel,
   also when the administrator has published the company name / logo as the brand. */
(function () {
  const NAME = 'ORBIT', FULL = 'Operations · Racks · Batches · Inventory · Trips';
  const css = document.createElement('style'); css.textContent = `.orbit-mark{display:flex;align-items:center;gap:7px;font-weight:800;letter-spacing:.22em;font-size:13px;line-height:1}
.orbit-mark i{font-style:normal;display:inline-flex;width:20px;height:20px;border-radius:50%;align-items:center;justify-content:center;background:conic-gradient(from 210deg,#22d3ee,#6366f1,#a855f7,#22d3ee);color:#fff;font-size:11px;letter-spacing:0;box-shadow:0 0 0 2px rgba(255,255,255,.25)}
.orbit-mark small{font-weight:500;letter-spacing:.02em;font-size:10.5px;opacity:.8}
.sidebar .orbit-mark{margin:6px 0 2px;color:inherit}.login-card .orbit-mark{justify-content:center;flex-wrap:wrap;margin:2px 0 16px;padding:10px 0 12px;border-top:1px solid var(--border,#e2e8f0);border-bottom:1px solid var(--border,#e2e8f0);font-size:24px;color:var(--brand,#1e3a8a)}.login-card .orbit-mark i{width:30px;height:30px;font-size:16px}.login-card .orbit-mark small{flex-basis:100%;text-align:center;font-size:11.5px;letter-spacing:.08em;margin-top:6px;color:var(--gray-600,#64748b);opacity:1}
body.sb-mini .sidebar .orbit-mark small{display:none}`; document.head.appendChild(css);
  const mk = (sub) => { const d = document.createElement('div'); d.className = 'orbit-mark'; d.title = NAME + ' — ' + FULL; d.innerHTML = '<i>◎</i><span>' + NAME + '</span>' + (sub ? '<small>' + FULL + '</small>' : ''); return d; };
  function put() {
    const isOrbit = n => !!n && n.offsetParent !== null && getComputedStyle(n).visibility !== 'hidden' && String(n.textContent || '').trim().toUpperCase() === NAME;
    const sb = document.querySelector('.sidebar-brand'); if (sb && !document.querySelector('.sidebar .orbit-mark')) { const n = sb.querySelector('[data-brand="name"]'); if (!isOrbit(n)) sb.insertAdjacentElement('afterend', mk(false)); }
    const lc = document.querySelector('.login-card'); if (lc && !lc.querySelector('.orbit-mark')) { const n = lc.querySelector('[data-brand="name"]'); if (!isOrbit(n)) { const br = lc.querySelector('.login-brand'); br ? br.insertAdjacentElement('afterend', mk(true)) : lc.insertBefore(mk(true), lc.firstChild); } }
    if (!/ORBIT/.test(document.title)) document.title = 'ORBIT · ' + document.title.replace(/\s*—\s*Secure$/, '');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put); else put(); setInterval(put, 2000);
})();
