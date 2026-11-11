/* ============================================================
   🎨 Dashboard style — a per-user choice applied to every KPI / summary card in ORBIT
   · Classic  — as designed in each module (default)
   · Elegant  — gradient cards with white text, soft shadow and a light circle (as the Workshop dashboard)
   · Soft     — white cards with a coloured top accent, coloured value and shadow
   Works on any group of cards whose container class ends with "-kpis" / "-tiles" (Projects, OT, Fleet, Planning …)
   and rounds + shadows the section panels ("-sec"). Chosen from the 🎨 button in the top bar; kept on this browser per user.
   ============================================================ */
(function () {
  'use strict';
  const KEY = () => LS_BASE + '_dashstyle_' + (((typeof currentUser !== 'undefined' && currentUser && currentUser.username) || 'all').toLowerCase());
  const STY = [['classic', 'Classic', 'as designed in each section'], ['elegant', 'Elegant', 'gradient cards, white text'], ['soft', 'Soft', 'white cards, coloured accent']];
  const get = () => { try { return localStorage.getItem(KEY()) || localStorage.getItem(LS_BASE + '_dashstyle_all') || 'classic'; } catch (e) { return 'classic'; } };
  const G = ['linear-gradient(135deg,#1e3a8a,#3b82f6)', 'linear-gradient(135deg,#047857,#10b981)', 'linear-gradient(135deg,#0e7490,#22d3ee)', 'linear-gradient(135deg,#7c2d12,#f97316)', 'linear-gradient(135deg,#6d28d9,#a78bfa)', 'linear-gradient(135deg,#9f1239,#fb7185)', 'linear-gradient(135deg,#a16207,#facc15)', 'linear-gradient(135deg,#334155,#64748b)'];
  const C = ['#2563eb', '#10b981', '#0891b2', '#f97316', '#8b5cf6', '#f43f5e', '#ca8a04', '#64748b'];
  const css = document.createElement('style'); css.id = 'dashStyleCss'; css.textContent = `
body.ds-elegant .ds-k{background:var(--ds-g)!important;border:0!important;border-radius:16px!important;color:#fff!important;position:relative;overflow:hidden;box-shadow:0 10px 24px -12px rgba(15,23,42,.55)!important;transition:transform .15s,box-shadow .15s}
body.ds-elegant .ds-k *:not(.ds-keep):not(.ds-keep *){color:#fff!important;border-color:rgba(255,255,255,.35)!important}body.ds-elegant .ds-k:hover{transform:translateY(-2px);box-shadow:0 16px 28px -12px rgba(15,23,42,.6)!important}
body.ds-elegant .ds-k::after{content:'';position:absolute;right:-26px;top:-26px;width:92px;height:92px;border-radius:50%;background:rgba(255,255,255,.14);pointer-events:none}
body.ds-elegant .ds-k b,body.ds-elegant .ds-k strong{letter-spacing:-.3px}body.ds-elegant .ds-k small,body.ds-elegant .ds-k span{opacity:.92}
body.ds-elegant .ds-k [class*="bar"]:not(b){background:rgba(255,255,255,.25)!important}body.ds-elegant .ds-k [class*="bar"] i{background:#fff!important}
body.ds-soft .ds-k{background:var(--card,#fff)!important;border:1px solid var(--border)!important;border-top:4px solid var(--ds-c)!important;border-left-width:1px!important;border-radius:14px!important;box-shadow:0 6px 18px -10px rgba(15,23,42,.35)!important;transition:transform .15s}
body.ds-soft .ds-k:hover{transform:translateY(-2px)}body.ds-soft .ds-k b,body.ds-soft .ds-k strong{color:var(--ds-c)!important}
body.ds-elegant #view-home .hm-tile.ds-k,body.ds-elegant #view-home .hm-tile.ds-k:hover{background:var(--ds-g)!important;border:0!important;color:#fff!important}body.ds-elegant #view-home .hm-tile.ds-k b,body.ds-elegant #view-home .hm-tile.ds-k small{color:#fff!important}
body.ds-elegant #view-home .hm-tile.ds-k.on{box-shadow:0 0 0 3px var(--hm-c,#fff),0 0 0 6px rgba(37,99,235,.55),0 12px 26px -12px rgba(15,23,42,.6)!important;transform:translateY(-2px)}body.ds-elegant #view-home .hm-tile.ds-k .hm-ring{box-shadow:0 0 0 3px rgba(255,255,255,.35)}
body.ds-soft #view-home .hm-tile.ds-k{background:var(--hm-c,var(--card,#fff))!important;border:1px solid var(--hm-l,var(--border))!important;border-top:4px solid var(--ds-c)!important}body.ds-soft #view-home .hm-tile.ds-k b{color:var(--ds-c)!important}
body.ds-soft #view-home .hm-tile.ds-k:hover{background:var(--hm-c,var(--card,#fff))!important;color:inherit!important;border-color:var(--ds-c)!important;border-top-width:4px!important}body.ds-soft #view-home .hm-tile.ds-k:hover small{color:var(--hm-m,#64748b)!important;opacity:1}
body.ds-soft #view-home .hm-tile.ds-k.on{background:color-mix(in srgb,var(--ds-c) 10%,var(--hm-c,#fff))!important;box-shadow:0 0 0 2px var(--ds-c),0 8px 20px -10px rgba(15,23,42,.4)!important}
body.ds-elegant .ds-p,body.ds-soft .ds-p{border-radius:16px!important;box-shadow:0 4px 16px -8px rgba(15,23,42,.25)!important}
body.ds-elegant .ds-gap,body.ds-soft .ds-gap{gap:12px!important}
#dsBtn{position:relative}#dsMenu{position:fixed;z-index:2147483100;background:var(--card,#fff);color:var(--text,#0f172a);border:1px solid var(--border);border-radius:14px;box-shadow:0 20px 50px -15px rgba(15,23,42,.5);padding:8px;min-width:250px}
#dsMenu button{display:flex;gap:10px;align-items:center;width:100%;text-align:left;background:none;border:0;border-radius:10px;padding:8px 10px;cursor:pointer;color:inherit;font-size:13px}#dsMenu button:hover{background:var(--brand-light,#eef2fb)}#dsMenu button.on{background:var(--brand-light,#eef2fb);font-weight:700}
#dsMenu .sw{width:46px;height:28px;border-radius:8px;flex:none;display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;box-sizing:border-box;background:var(--gray-100,#f1f5f9)}#dsMenu .sw i{border-radius:4px}#dsMenu small{display:block;color:var(--gray-600,#64748b);font-weight:400}`;
  document.head.appendChild(css);
  /* which elements are KPI cards / panels */
  const isGroup = el => { for (const c of el.classList) if (/-(kpis|tiles|hero)$/.test(c) || c === 'kpi-grid') return true; return false; };
  const skip = el => el.closest('#dsMenu,#orbAlert,.modal,[id$="Modal"],.wd-hero,#view-eqw .wd-hero') || el.classList.contains('wd-hero');
  let busy = false;
  function scan(root) {
    if (busy) return; busy = true;
    try { const st = get(); if (st === 'classic') return;
      (root || document).querySelectorAll('[class*="kpis"],[class*="tiles"],.kpi-grid').forEach(g => { if (!isGroup(g) || skip(g) || !g.offsetParent) return; g.classList.add('ds-gap');
        [...g.children].filter(k => k.nodeType === 1 && !/^(SCRIPT|STYLE|BR)$/.test(k.tagName)).forEach((k, i) => { if (!k.classList.contains('ds-k')) k.classList.add('ds-k'); const gi = G[i % G.length], ci = C[i % C.length]; if (k.style.getPropertyValue('--ds-g') !== gi) { k.style.setProperty('--ds-g', gi); k.style.setProperty('--ds-c', ci); } }); });
      /* cards found by their own class too (…-k / …-kpi / …-tile), whatever their container is called (e.g. Consolidated Inventory .ci-kp > .ci-k) */
      const isCard = el => { for (const c of el.classList) if (/-(k|kpi|tile)$/.test(c)) return true; return false; };
      (root || document).querySelectorAll('[class$="-k"],[class*="-k "],[class$="-kpi"],[class*="-kpi "],[class$="-tile"],[class*="-tile "]').forEach(k => { if (k.classList.contains('ds-k') || !isCard(k) || skip(k) || !k.querySelector('b,strong') || !k.offsetParent) return;
        const sib = [...k.parentElement.children].filter(isCard), i = Math.max(0, sib.indexOf(k)); k.classList.add('ds-k'); k.parentElement.classList.add('ds-gap'); k.style.setProperty('--ds-g', G[i % G.length]); k.style.setProperty('--ds-c', C[i % C.length]); });
      (root || document).querySelectorAll('[class*="-sec"],[class*="-box"],[class*="-pan"]').forEach(p => { if (skip(p)) return; for (const c of p.classList) if (/-(sec|box|pan)$/.test(c)) { if (!p.classList.contains('ds-p')) p.classList.add('ds-p'); break; } });
    } finally { busy = false; } }
  function apply(st) { st = st || get(); document.body.classList.remove('ds-elegant', 'ds-soft'); if (st !== 'classic') { document.body.classList.add('ds-' + st); scan(); } const b = document.querySelector('#dsBtn'); if (b) b.title = 'Dashboard style: ' + (STY.find(x => x[0] === st) || STY[0])[1] + ' — click to change'; }
  function set(st) { try { localStorage.setItem(KEY(), st); } catch (e) {} apply(st); try { sectionToast('🎨 Dashboard style: ' + (STY.find(x => x[0] === st) || STY[0])[1], 'success'); } catch (e) {} }
  /* top-bar button + menu */
  function menu(btn) { let m = document.querySelector('#dsMenu'); if (m) { m.remove(); return; } const cur = get(); m = document.createElement('div'); m.id = 'dsMenu'; m.dataset.nohc = '1';
    const sw = k => k === 'elegant' ? `<span class="sw"><i style="background:${G[0]}"></i><i style="background:${G[1]}"></i><i style="background:${G[3]}"></i><i style="background:${G[4]}"></i></span>` : k === 'soft' ? `<span class="sw" style="background:#fff;border:1px solid var(--border)">${C.slice(0, 4).map(c => `<i style="background:#fff;border-top:3px solid ${c};box-shadow:0 1px 3px rgba(0,0,0,.15)"></i>`).join('')}</span>` : `<span class="sw">${[0, 1, 2, 3].map(() => '<i style="background:#fff;border:1px solid #cbd5e1"></i>').join('')}</span>`;
    m.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--gray-600,#64748b);padding:4px 10px 6px">🎨 Dashboard style — every section</div>' + STY.map(([k, t, d]) => `<button type="button" data-ds="${k}" class="${k === cur ? 'on' : ''}">${sw(k)}<span>${t}${k === cur ? ' ✓' : ''}<small>${d}</small></span></button>`).join('');
    document.body.appendChild(m); const r = btn.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
    m.addEventListener('click', e => { const b = e.target.closest('[data-ds]'); if (b) { set(b.dataset.ds); m.remove(); } });
    setTimeout(() => document.addEventListener('click', function off(e) { if (!e.target.closest('#dsMenu,#dsBtn')) { const x = document.querySelector('#dsMenu'); if (x) x.remove(); document.removeEventListener('click', off, true); } }, true), 0); }
  function addBtn() { const t = document.querySelector('#themeToggle'); if (!t || document.querySelector('#dsBtn')) return; const b = document.createElement('button'); b.id = 'dsBtn'; b.className = t.className; b.type = 'button'; b.textContent = '🎨'; t.insertAdjacentElement('beforebegin', b); b.addEventListener('click', e => { e.stopPropagation(); menu(b); }); }
  let tm = 0; const mo = new MutationObserver(() => { if (get() === 'classic') return; clearTimeout(tm); tm = setTimeout(() => scan(document.querySelector('.view.active') || document.body), 120); });
  function start() { addBtn(); apply(); mo.observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  /* the choice is per user: re-apply after sign-in / user switch */
  let lastU = ''; setInterval(() => { const u = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || ''; if (u !== lastU) { lastU = u; apply(); } }, 1500);
  window.DSTYLE = { get, set, apply, scan };
})();
