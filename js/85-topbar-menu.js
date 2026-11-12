/* ============================================================
   ☰ TOP BAR TOOLS — every top-bar button (Mobile, location, Arrange, Re-login, token, Refresh, Help, 🎨, 🌙, 🕘 …)
   is gathered under ONE "Tools" button; it drops down a panel with all of them. Buttons other scripts add later go
   into the panel automatically. The Tools button shows the token status dot and the activity count.
   ============================================================ */
(function () {
  'use strict';
  const css = document.createElement('style'); css.id = 'tbmCss';
  css.textContent = `
#tbmBtn{display:inline-flex!important;align-items:center;gap:8px;width:auto!important;padding:0 14px!important;font-size:13px!important;font-weight:700!important;position:relative}
#tbmBtn .tbm-dot{width:9px;height:9px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 2px rgba(255,255,255,.35)}#tbmBtn .tbm-dot.ok{background:#22c55e}#tbmBtn .tbm-dot.throttled{background:#f59e0b}#tbmBtn .tbm-dot.bad{background:#ef4444}
#tbmBtn .tbm-n{background:#dc2626;color:#fff;font-size:10px;font-weight:800;border-radius:999px;padding:1px 6px;line-height:15px}#tbmBtn .tbm-n:empty{display:none}
#tbmBtn .tbm-car{transition:transform .18s;display:inline-block;font-size:11px}#tbmBtn[aria-expanded="true"] .tbm-car{transform:rotate(180deg)}
nav#tbmPanel{position:fixed;z-index:99990;display:none;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-start;align-content:flex-start;padding:12px 14px 14px;border-radius:14px;width:min(560px,calc(100vw - 16px));box-sizing:border-box;box-shadow:0 22px 50px -18px rgba(2,6,23,.75),0 0 0 1px rgba(255,255,255,.12);animation:tbmIn .14s ease-out}
nav#tbmPanel.on{display:flex}@keyframes tbmIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
nav#tbmPanel>*{flex:0 0 auto;white-space:nowrap}nav#tbmPanel>input[type=file],nav#tbmPanel>[hidden]{display:none!important}
nav#tbmPanel .token-pill:not(.ok):not(.throttled){background:rgba(148,163,184,.2)!important;color:inherit!important}nav#tbmPanel .token-pill:not(.ok):not(.throttled) *{color:inherit!important}
nav#tbmPanel .tbm-h{flex:1 0 100%;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;opacity:.7;margin:-2px 2px 2px}`;
  document.head.appendChild(css);

  let bar, btn, panel, lastBg = '';
  const KEEP = ['sectionRefreshBtn', 'phBtn', 'dsBtn', 'themeToggle', 'activityToggle'];   /* Help · 🎨 · 🌙 · 🕘 stay on the top bar, next to Tools */
  const skip = n => n === btn || n === panel || n.nodeType !== 1 || KEEP.includes(n.id);
  const ORDER = ['mobBtn', 'locChip', 'arrBtn', 'sectionRefreshBtn', 'phBtn', 'msReloginBtn', 'tokenPill', 'importTokenBtn', 'importTokenInput', 'dsBtn', 'themeToggle', 'activityToggle'];
  function keepOut() { if (!bar || !btn) return; let ref = btn; KEEP.forEach(id => { const n = document.querySelector('#' + id); if (!n || !(n instanceof Element)) return; if (n.parentElement !== bar || n.previousElementSibling !== ref) bar.insertBefore(n, ref.nextSibling); ref = n; }); if (panel.parentElement === bar && bar.lastElementChild !== panel) bar.appendChild(panel); }
  function sweep() { if (!bar || !panel) return; keepOut(); let moved = false; [...bar.children].forEach(n => { if (!skip(n)) { panel.appendChild(n); moved = true; } });
    if (moved) { const rank = n => { const i = ORDER.indexOf(n.id); return i < 0 ? 50 : i; }; [...panel.children].filter(n => !n.classList.contains('tbm-h')).sort((a, b) => rank(a) - rank(b)).forEach(n => panel.appendChild(n)); } mirror(); }
  function mirror() { if (!btn) return; const tp = document.querySelector('#tokenPill'), d = btn.querySelector('.tbm-dot'), at = document.querySelector('#activityToggle'), n = btn.querySelector('.tbm-n');
    if (tp && d) { d.className = 'tbm-dot ' + (tp.classList.contains('ok') ? 'ok' : tp.classList.contains('throttled') ? 'throttled' : /no token|expired/i.test(tp.textContent) ? 'bad' : ''); d.title = tp.textContent.trim(); }
    if (n) n.textContent = ''; }
  function place() { if (!panel || !panel.classList.contains('on')) return; const r = btn.getBoundingClientRect(), tb = bar.closest('.topbar') || bar;
    const cs = getComputedStyle(tb), bg = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage + ',' + cs.backgroundColor : cs.backgroundColor;
    if (bg !== lastBg) { panel.style.background = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : ''; const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/), pr = m ? m[1].split(',').map(Number) : [15, 35, 71, 1], al = pr.length > 3 ? pr[3] : 1, tc = (cs.color.match(/\d+/g) || [255]).slice(0, 3).map(Number), lightTxt = tc.reduce((a, b) => a + b, 0) > 380; panel.style.backgroundColor = al >= .95 ? cs.backgroundColor : lightTxt ? '#0f2347' : '#ffffff'; if (al < .95 && !lightTxt) panel.style.background = '#ffffff'; panel.style.color = cs.color; lastBg = bg; }
    panel.style.top = (r.bottom + 8) + 'px'; const w = panel.offsetWidth; panel.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px'; }
  function toggle(on) { if (!panel) return; on = on == null ? !panel.classList.contains('on') : on; sweep(); panel.classList.toggle('on', on); btn.setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) { lastBg = ''; place(); } }
  function init() { bar = document.querySelector('.topbar .topbar-actions') || document.querySelector('.topbar-actions'); if (!bar || bar.dataset.tbm) return; bar.dataset.tbm = '1';
    btn = document.createElement('button'); btn.type = 'button'; btn.id = 'tbmBtn'; btn.className = 'icon-btn'; btn.title = 'Tools — mobile, location, arrange, refresh, sign-in, token'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="tbm-dot"></span>☰ Tools<span class="tbm-n"></span><span class="tbm-car">▾</span>';
    panel = document.createElement('nav'); panel.id = 'tbmPanel'; panel.dataset.nohc = '1'; panel.innerHTML = '<div class="tbm-h">Tools</div>';
    bar.appendChild(btn); bar.appendChild(panel); sweep();
    btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    document.addEventListener('click', e => { if (!panel.classList.contains('on')) return; if (e.target.closest('#tbmPanel,#tbmBtn')) return; toggle(false); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('on')) toggle(false); });
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    new MutationObserver(() => sweep()).observe(bar, { childList: true });
    const tp = document.querySelector('#tokenPill'), at = document.querySelector('#activityToggle'), mo = new MutationObserver(mirror);
    if (tp) mo.observe(tp, { attributes: true, childList: true, subtree: true, characterData: true }); if (at) mo.observe(at, { attributes: true });
    setInterval(mirror, 4000); }
  const boot = () => { init(); sweep(); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); setTimeout(boot, 1200); setTimeout(sweep, 3000);
  window.TBM = { open: () => toggle(true), close: () => toggle(false), sweep };
})();
