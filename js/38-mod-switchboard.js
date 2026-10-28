/* ---------- Switchboard (home page): 3 styles, admin picks one ---------- */
const HOME_DEFAULT = { style: 'A', accent: '', font: '', scale: 100, radius: 16 };
(function () {
  const KEY = LS_BASE + '_home', Q = s => document.querySelector(s), esc = escapeHtml;
  const uid = () => (currentUser && currentUser.id) || 'anon';
  const VH = () => LS_BASE + '_vh_' + uid();
  const day = d => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const lastDays = n => { const o = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); o.push({ k: day(d), n: d.toLocaleDateString(undefined, { weekday: 'short' }) }); } return o; };
  let draft = null;
  const saved = () => { let c = {}; try { c = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {} const d = HOME_DEFAULT; return { style: 'ABC'.includes(c.style) && c.style ? c.style : ('ABC'.includes(d.style) ? d.style : 'A'), accent: c.accent != null ? c.accent : (d.accent || ''), font: c.font != null ? c.font : (d.font || ''), scale: +(c.scale || d.scale || 100), radius: c.radius != null ? +c.radius : +(d.radius != null ? d.radius : 16) }; };
  const cfg = () => draft || saved();
  const getStyle = () => cfg().style;
  const DEF_AC = { A: '#1d4ed8', B: '#4c8dff', C: '#14352a' };
  function applyCfg(host) { const c = cfg(); host.style.setProperty('--hm-ac', c.accent || DEF_AC[c.style]); host.style.setProperty('--hm-r', c.radius + 'px'); host.style.fontFamily = c.font ? `"${c.font}",system-ui,sans-serif` : ''; host.style.setProperty('--hm-z', (c.scale / 100).toString()); }
  const rd = () => { try { return JSON.parse(localStorage.getItem(VH()) || '{}') || {}; } catch (e) { return {}; } };
  /* ---- visit tracking (this browser, this user) ---- */
  let lastV = '';
  function track() {
    const v = activeViewId(); document.body.classList.toggle('on-home', v === 'home'); if (!v || v === lastV) return; lastV = v; if (v === 'home') { render(); try { Q('.content').scrollTop = 0; } catch (e) {} return; }
    const h = rd(), k = day(); (h[k] = h[k] || {})[v] = (h[k][v] || 0) + 1;
    Object.keys(h).sort().slice(0, -14).forEach(x => delete h[x]);
    try { localStorage.setItem(VH(), JSON.stringify(h)); } catch (e) {}
  }
  /* ---- model from the side panel (permission-aware, follows the user's own layout) ---- */
  function model() {
    const days = lastDays(7), h = rd(), groups = [];
    document.querySelectorAll('.sidebar-nav .nav-group').forEach(g => {
      const items = [...g.querySelectorAll('.nav-item[data-view]')].filter(el => el.dataset.view !== 'home' && !el.classList.contains('locked') && el.style.display !== 'none')
        .map(el => ({ view: el.dataset.view, name: (el.querySelector('span:nth-child(2)') || el).textContent.trim(), icon: (el.querySelector('.icon') || {}).textContent || '' }));
      if (!items.length) return; const name = ((g.querySelector('.gname') || {}).textContent || g.dataset.g || '').trim();
      const per = days.map(d => items.reduce((s, it) => s + ((h[d.k] || {})[it.view] || 0), 0));
      groups.push({ name, items, per, total: per.reduce((a, b) => a + b, 0) });
    });
    const dayTot = days.map((d, i) => groups.reduce((s, g) => s + g.per[i], 0)), total = dayTot.reduce((a, b) => a + b, 0);
    const use = {}; days.forEach(d => Object.entries(h[d.k] || {}).forEach(([v, n]) => { use[v] = (use[v] || 0) + n; }));
    const top = Object.entries(use).sort((a, b) => b[1] - a[1])[0], meta = top && (typeof VIEW_META !== 'undefined' ? VIEW_META[top[0]] : null);
    return { days, groups, dayTot, total, today: dayTot[6], top: meta ? meta.title : '—', pages: groups.reduce((s, g) => s + g.items.length, 0) };
  }
  const COL = ['#2563eb', '#0e7490', '#7c3aed', '#b45309', '#047857', '#be185d', '#4338ca', '#0f766e', '#c2410c', '#0369a1'];
  const col = i => COL[i % COL.length];
  const link = it => `<a href="#" class="hm-chip" data-go="${esc(it.view)}"><span>${esc(it.icon)}</span>${esc(it.name)}</a>`;
  const bars = (g, c, h) => { const mx = Math.max(1, ...g.per); return `<div class="hm-bars" style="height:${h}px" title="${g.total ? 'Your visits, last 7 days' : 'No visits recorded yet'}">${g.per.map(v => `<i style="height:${Math.max(3, Math.round(v / mx * h))}px;background:${c};opacity:${v ? .9 : .25}"></i>`).join('')}</div>`; };
  const hello = () => { const n = (currentUser && (currentUser.displayName || currentUser.username)) || ''; const hr = new Date().getHours(); return (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (n ? ', ' + esc(n) : ''); };

  function viewA(m) {
    return `<div class="hmA"><div class="hm-ban"><div><div class="hm-eye">Supply Chain Management</div><h1>${hello()}</h1><p>Pick a group to open its pages. The bars show your own activity over the last 7 days.</p></div>
      <label class="hm-search"><span>🔍</span><input id="hmQ" placeholder="Search any page…" aria-label="Search pages"></label></div>
      <div class="hm-wrap"><div class="hm-kpis">${[['Pages you can open', m.pages], ['Groups', m.groups.length], ['Your visits today', m.today], ['Most used (7 days)', m.top]].map(k => `<div class="hm-kpi"><span>${k[0]}</span><b>${esc(k[1])}</b></div>`).join('')}</div>
      <div class="hm-grid">${m.groups.map((g, i) => `<section class="hm-card" data-first="${esc(g.items[0].view)}" data-name="${esc(g.name.toLowerCase())}"><header><span class="hm-ico" style="background:${col(i)}1f;color:${col(i)}">${esc(g.items[0].icon || '▦')}</span><b>${esc(g.name)}</b><em>${g.items.length}</em></header>${bars(g, col(i), 44)}<div class="hm-chips">${g.items.map(link).join('')}</div></section>`).join('')}</div></div></div>`;
  }
  let selB = 0;
  function viewB(m) {
    const tot = Math.max(1, m.total); let acc = 0; const seg = m.total ? m.groups.map((g, i) => { const a = acc / tot * 100; acc += g.total; return `${col(i)} ${a}% ${acc / tot * 100}%`; }).join(',') : 'var(--hm-l) 0 100%';
    const mx = Math.max(1, ...m.dayTot); if (selB >= m.groups.length) selB = 0; const sg = m.groups[selB];
    return `<div class="hmB"><div class="hm-top"><div><div class="hm-eye">Supply Chain Management</div><h1>${hello()}</h1></div><label class="hm-search"><span>🔍</span><input id="hmQ" placeholder="Search pages…" aria-label="Search pages"></label></div>
      <div class="hm-two"><div class="hm-pan"><b>Where you work</b><div class="hm-donut-row"><div class="hm-donut" style="background:conic-gradient(${seg})"><div><small>Visits</small><b>${m.total}</b></div></div>
      <div class="hm-leg">${m.groups.slice(0, 7).map((g, i) => `<div><i style="background:${col(i)}"></i>${esc(g.name)}<em>${g.total}</em></div>`).join('')}</div></div></div>
      <div class="hm-pan hm-wide"><b>Your activity · last 7 days</b><div class="hm-col">${m.days.map((d, i) => `<div><span style="height:${Math.max(3, Math.round(m.dayTot[i] / mx * 100))}px;opacity:${m.dayTot[i] ? 1 : .25}"></span><small>${esc(d.n)}</small></div>`).join('')}</div></div></div>
      <div class="hm-tiles">${m.groups.map((g, i) => { const p = Math.round(g.total / tot * 100); return `<button type="button" class="hm-tile${i === selB ? ' on' : ''}" data-sel="${i}" data-name="${esc(g.name.toLowerCase())}"><span class="hm-ring" style="background:conic-gradient(${col(i)} 0 ${p}%,var(--hm-l) ${p}% 100%)"><span>${p}%</span></span><span><b>${esc(g.name)}</b><small>${g.items.length} page${g.items.length > 1 ? 's' : ''}</small></span></button>`; }).join('')}</div>
      ${sg ? `<div class="hm-pan"><b>${esc(sg.name)}</b><div class="hm-chips" style="margin-top:10px">${sg.items.map(link).join('')}</div></div>` : ''}</div>`;
  }
  const ZONES = [['Operations', 'Warehouse, logistics and daily execution', ['warehouse', 'logistics', 'daily plan', 'warehouse locations'], '#14785a'], ['Planning', 'Plans, demand and Milco upload', ['planning dept.', 'f&d plan', 'milco daily planning'], '#b4571b'], ['People', 'Roster, attendance and vouchers', ['staff roster', 'staff attendance', 'foc vouchers'], '#2f5fb3'], ['Insight & Admin', 'Data, reports, automation and setup', [], '#7a3e9d']];
  function viewC(m) {
    const z = ZONES.map(() => []); m.groups.forEach(g => { let k = ZONES.findIndex(zz => zz[2].includes(g.name.toLowerCase())); if (k < 0) k = 3; z[k].push(g); });
    return `<div class="hmC"><div class="hm-top"><div><div class="hm-eye">Supply Chain Management</div><h1>${hello()}</h1></div><label class="hm-search"><span>🔍</span><input id="hmQ" placeholder="Jump to a page…" aria-label="Search pages"></label></div>
      <div class="hm-zones">${ZONES.map((Z, k) => { if (!z[k].length) return ''; const per = m.days.map((d, i) => z[k].reduce((s, g) => s + g.per[i], 0)), mx = Math.max(1, ...per), pts = per.map((v, i) => `${2 + i * 24.3},${44 - Math.round(v / mx * 38)}`).join(' ');
        return `<section class="hm-zone" style="--zc:${Z[3]}"><header><div><b>${Z[0]}</b><small>${Z[1]}</small></div><svg width="150" height="48" viewBox="0 0 150 48" fill="none" role="img" aria-label="Your visits, last 7 days"><polyline points="${pts}" stroke="${Z[3]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="${per.some(v => v) ? 1 : .3}"/></svg></header>
        ${z[k].map(g => `<div class="hm-zg" data-name="${esc(g.name.toLowerCase())}"><h4>${esc(g.name)}</h4>${g.items.map(it => `<a href="#" class="hm-row" data-go="${esc(it.view)}"><span><i></i>${esc(it.name)}</span><b>›</b></a>`).join('')}</div>`).join('')}</section>`; }).join('')}</div></div>`;
  }
  function render() {
    const host = Q('#view-home'); if (!host) return; const st = getStyle(), m = model();
    applyCfg(host); host.innerHTML = '<div class="hm-zoom">' + (st === 'B' ? viewB(m) : st === 'C' ? viewC(m) : viewA(m)) + (m.total ? '' : '<p class="hm-note">Charts fill in as you open pages — they show your own activity on this browser.</p>') + '</div>';
    host.className = host.className.replace(/\bhm-s[ABC]\b/g, '') + ' hm-s' + st;
  }
  window.homeRender = render;
  const st = document.createElement('style'); st.textContent = `
#view-home{--hm-bg:#f3f5f9;--hm-c:#fff;--hm-t:#16223b;--hm-m:#51607f;--hm-l:#e3e8f2;margin:-24px -28px -60px;min-height:calc(100vh - 60px);background:var(--hm-bg);color:var(--hm-t)}
body.dark #view-home{--hm-bg:#0b1220;--hm-c:#131d33;--hm-t:#e8edf8;--hm-m:#9fb0d3;--hm-l:#243457}
#view-home.hm-sC{--hm-bg:#faf8f4;--hm-c:#fff;--hm-l:#e6dfcf;--hm-m:#6b6a55}body.dark #view-home.hm-sC{--hm-bg:#14171c;--hm-c:#1b2027;--hm-l:#2c333d;--hm-m:#a7b0bd}
#view-home.hm-sB{--hm-bg:#eef2f9;--hm-l:#dbe3f1;--hm-hi:#eef3ff}body.dark #view-home.hm-sB{--hm-bg:#0b1220;--hm-c:#131d33;--hm-l:#243457;--hm-hi:#1a2742}
body.dark .hm-adm{background:#3a2f10;color:#f1deb0;border-color:#5b4a1a}body.dark .hm-adm button{background:#2a2410;color:#f1deb0;border-color:#6b5a28}body.dark .hm-adm button.on{background:#f1deb0;color:#2a2410}
#view-home h1{margin:6px 0 4px;font-size:30px;font-weight:800;color:inherit}#view-home h4{margin:10px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--hm-m)}
.hm-eye{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;opacity:.8}
.hm-adm{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 20px;font-size:12px;background:#fff7e0;color:#5b4300;border-bottom:1px solid #ecd9a0}
.hm-adm button{border:1px solid #d9c27a;background:#fff;color:#5b4300;border-radius:6px;padding:3px 9px;font-size:12px;cursor:pointer}.hm-adm button.on{background:#5b4300;color:#fff}
.hm-search{display:flex;align-items:center;gap:8px;background:var(--hm-c);color:var(--hm-t);border-radius:12px;padding:0 14px;height:44px;width:320px;max-width:100%;box-sizing:border-box;border:1px solid var(--hm-l)}
.hm-search input{border:0!important;outline:0;flex:1;background:transparent!important;color:inherit!important;font-size:14px;box-shadow:none!important;margin:0!important;padding:0!important}
.hm-bars{display:flex;align-items:flex-end;gap:5px}.hm-bars i{flex:1;border-radius:4px 4px 0 0;display:block}
.hm-chips{display:flex;flex-wrap:wrap;gap:6px}.hm-chip{display:inline-flex;gap:6px;align-items:center;background:var(--hm-bg);border:1px solid var(--hm-l);color:var(--hm-t)!important;border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:600;text-decoration:none}.hm-chip:hover{border-color:var(--hm-ac,#2563eb)}
#navHomeHidden{display:none!important}.sidebar-brand{cursor:pointer}.on-home #backBtn,.on-home .tb-logo{display:none!important}
/* side panel = the end colour of the top bar */
html body .sidebar{--sidebar-bg:var(--acc-1);--sidebar-hover:color-mix(in srgb,#fff 12%,var(--acc-1));--sidebar-text:#fff;background:var(--acc-1)!important;color:#fff}
html body .sidebar .nav-item{color:#fff;font-weight:600}html body .sidebar .nav-item:hover{background:rgba(255,255,255,.12);color:#fff}
html body .sidebar .nav-item.active{background:rgba(255,255,255,.24)!important;color:#fff!important;box-shadow:inset 3px 0 0 #fff}
html body .sidebar .nav-section-label,html body .sidebar .nav-group-head,html body .sidebar .nav-group-head .gname{color:#fff!important}
html body .sidebar .nav-group-head .gcount{background:rgba(255,255,255,.26);color:#fff}
html body .sidebar .sidebar-header,html body .sidebar .user-card,html body .sidebar .sidebar-footer{border-color:rgba(255,255,255,.3)}
html body .sidebar .sidebar-footer,html body .sidebar .sidebar-tagline,html body .sidebar .user-info .user-name{color:#fff}
html body .sidebar .user-role,html body .sidebar .user-role.admin{color:#fff!important;opacity:.9}
html body .sidebar .nav-tools button,html body .sidebar .sb-toggle{color:#fff;border-color:rgba(255,255,255,.45)}html body .sidebar .nav-tools button:hover,html body .sidebar .sb-toggle:hover{background:rgba(255,255,255,.14)}
html body .sidebar .badge:not(.new):not(.role-admin){background:rgba(255,255,255,.2);color:#fff}
html body .sidebar .avatar{background:#fff!important;color:var(--acc-1)!important;font-weight:700}
html body .sidebar .user-card .logout-btn{color:#fff}html body .sidebar .user-card .logout-btn:hover{background:rgba(255,255,255,.14)}

.hmB>.hm-pan{flex:none}
#view-home .hm-tile{background:var(--hm-c)!important;color:var(--hm-t)!important}#view-home .hm-tile.on{background:var(--hm-hi,var(--hm-bg))!important}
#view-home .hm-tile:hover{background:var(--hm-ac,#3b5bdb)!important;border-color:var(--hm-ac,#3b5bdb)!important;color:#fff!important}#view-home .hm-tile:hover b,#view-home .hm-tile:hover small{color:#fff!important}#view-home .hm-tile:hover small{opacity:.85}
#view-home .hm-tile .hm-ring span,#view-home .hm-tile:hover .hm-ring span{color:#16223b!important}body.dark #view-home .hm-tile .hm-ring span,body.dark #view-home .hm-tile:hover .hm-ring span{color:#e8edf8!important}
.hm-note{margin:14px 24px;font-size:12px;color:var(--hm-m)}
.hm-zoom{zoom:var(--hm-z,1)}.hm-card,.hm-kpi,.hm-pan,.hm-tile,.hm-zone{border-radius:var(--hm-r,16px)!important}
.hmA .hm-ban{background:linear-gradient(120deg,color-mix(in srgb,var(--hm-ac,#1d4ed8) 40%,#000),var(--hm-ac,#1d4ed8));color:#fff;padding:30px 36px 62px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between}.hmA p{margin:0;opacity:.9;font-size:14px}
.hmA .hm-wrap{max-width:1240px;margin:-34px auto 0;padding:0 24px 40px;display:flex;flex-direction:column;gap:18px}
.hm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.hm-kpi{background:var(--hm-c);border-radius:14px;padding:14px 16px;box-shadow:0 4px 16px rgba(20,40,90,.1);display:flex;flex-direction:column;gap:3px}.hm-kpi span{font-size:12px;color:var(--hm-m);font-weight:600}.hm-kpi b{font-size:20px}
.hm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.hm-card{background:var(--hm-c);border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(20,40,90,.08);display:flex;flex-direction:column;gap:12px;transition:.15s}.hm-card:hover{box-shadow:0 10px 28px rgba(20,40,90,.16);transform:translateY(-2px)}
.hm-card header{display:flex;align-items:center;gap:10px;cursor:pointer}.hm-card header b{flex:1;font-size:15px}.hm-card header em{font-style:normal;font-size:12px;color:var(--hm-m)}.hm-ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px}
.hmB{color:var(--hm-t);padding:26px 30px 40px;display:flex;flex-direction:column;gap:18px}.hm-top{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
.hm-two{display:flex;flex-wrap:wrap;gap:14px}.hm-pan{flex:1 1 360px;background:var(--hm-c);border:1px solid var(--hm-l);border-radius:16px;padding:18px}.hm-wide{flex:1.4 1 460px}
.hm-donut-row{display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin-top:12px}.hm-donut{width:140px;height:140px;border-radius:50%;display:flex;align-items:center;justify-content:center}.hm-donut>div{width:90px;height:90px;border-radius:50%;background:var(--hm-c);display:flex;flex-direction:column;align-items:center;justify-content:center}.hm-donut small{font-size:11px;color:var(--hm-m)}
.hm-leg{display:flex;flex-direction:column;gap:6px;font-size:13px}.hm-leg div{display:flex;align-items:center;gap:8px}.hm-leg i{width:10px;height:10px;border-radius:3px}.hm-leg em{font-style:normal;color:var(--hm-m);margin-left:auto;padding-left:14px}
.hm-col{display:flex;align-items:flex-end;gap:14px;height:130px;margin-top:12px}.hm-col>div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%}.hm-col span{width:60%;background:var(--hm-ac,#4c8dff);border-radius:4px 4px 0 0;display:block}.hm-col small{font-size:11px;color:var(--hm-m)}
.hm-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.hm-tile{display:flex;align-items:center;gap:12px;background:var(--hm-c);border:1px solid var(--hm-l);border-radius:14px;padding:12px 14px;color:inherit;cursor:pointer;text-align:left;font:inherit}.hm-tile:hover,.hm-tile.on{border-color:var(--hm-ac,#3b5bdb);background:var(--hm-hi,var(--hm-bg))}
.hm-tile b{display:block;font-size:14px}.hm-tile small{font-size:12px;color:var(--hm-m)}.hm-ring{width:50px;height:50px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center}.hm-ring span{width:38px;height:38px;border-radius:50%;background:var(--hm-c);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}
.hmC{padding:30px 40px 44px;display:flex;flex-direction:column;gap:22px}.hmC h1{color:var(--hm-ac,#14352a)}body.dark .hmC h1{color:color-mix(in srgb,var(--hm-ac,#14352a) 35%,#fff)}.hm-zones{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px}
.hm-zone{background:var(--hm-c);border:1px solid var(--hm-l);border-radius:18px;padding:20px}.hm-zone header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.hm-zone header b{font-size:18px;color:var(--zc);display:block}.hm-zone header small{font-size:12.5px;color:var(--hm-m)}
.hm-row{display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border-radius:10px;font-size:14px;font-weight:600;color:var(--hm-t)!important;text-decoration:none}.hm-row:hover{background:var(--hm-bg)}.hm-row span{display:flex;align-items:center;gap:10px}.hm-row i{width:8px;height:8px;border-radius:50%;background:var(--zc)}.hm-row b{color:var(--hm-m)}
@media(max-width:700px){#view-home{margin:-12px -10px}.hmC,.hmB{padding:18px 14px}}`;
  document.head.appendChild(st); document.body.classList.add('on-home'); lastV = 'home';
  const sb = Q('.sidebar-brand'); if (sb) { sb.title = 'Switchboard — main page'; sb.addEventListener('click', () => { const n = Q('#navHomeHidden'); if (n) n.click(); }); }
  document.addEventListener('click', e => {
    const host = Q('#view-home'); if (!host || !host.contains(e.target)) return;
    const g = e.target.closest('[data-go]'), card = e.target.closest('.hm-card header'), sel = e.target.closest('[data-sel]');
    if (sel) { selB = +sel.dataset.sel; render(); return; }
    const go = v => { const n = document.querySelector(`.nav-item[data-view="${v}"]`); if (n) n.click(); };
    if (g) { e.preventDefault(); go(g.dataset.go); } else if (card) go(card.parentElement.dataset.first);
  });
  document.addEventListener('input', e => { if (e.target.id !== 'hmQ') return; const q = e.target.value.trim().toLowerCase(); Q('#view-home').querySelectorAll('.hm-chip,.hm-row').forEach(a => { const t = a.textContent.toLowerCase(), box = a.closest('.hm-card,.hm-zg,.hm-pan'); a.style.display = !q || t.includes(q) ? '' : 'none'; }); Q('#view-home').querySelectorAll('.hm-card,.hm-zg').forEach(c => { const any = [...c.querySelectorAll('.hm-chip,.hm-row')].some(a => a.style.display !== 'none'); c.style.display = !q || any || (c.dataset.name || '').includes(q) ? '' : 'none'; }); });
  const nav = Q('.nav-item[data-view="home"]'); if (nav) nav.addEventListener('click', () => setTimeout(render, 0));
  const mo = new MutationObserver(() => { track(); if (activeViewId() === 'home' && !Q('#view-home .hm-ban,#view-home .hmB,#view-home .hmC')) render(); });
  mo.observe(Q('.content'), { attributes: true, attributeFilter: ['class'], subtree: true });

  /* ---- Settings card ---- */
  (function () {
    const $q = s => Q('#hmSetCard ' + s), card = Q('#hmSetCard'); if (!card) return;
    const fill = () => { const c = cfg(); $q('#hmStyle').value = c.style; $q('#hmAcDef').checked = !c.accent; $q('#hmAc').value = c.accent || DEF_AC[c.style]; $q('#hmFont').value = c.font; $q('#hmScale').value = String(c.scale); $q('#hmRad').value = String(c.radius); };
    const read = () => ({ style: $q('#hmStyle').value, accent: $q('#hmAcDef').checked ? '' : $q('#hmAc').value, font: $q('#hmFont').value, scale: +$q('#hmScale').value, radius: +$q('#hmRad').value });
    const live = () => { if (!isAdmin()) return; draft = read(); if (!$q('#hmAcDef').checked || true) { if ($q('#hmAcDef').checked) $q('#hmAc').value = DEF_AC[draft.style]; } render(); };
    card.addEventListener('input', live); card.addEventListener('change', live);
    const msg = (t, w) => sectionToast(t, w ? 'warn' : 'ok');
    $q('#hmSave').onclick = () => { if (!isAdmin()) return msg('Only administrators can change this.', 1); const c = read(); try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} draft = null; render(); msg('✔ Switchboard appearance saved on this browser.'); try { addActivity('settings', 'Switchboard appearance changed'); } catch (x) {} };
    $q('#hmCopy').onclick = () => { const t = 'const HOME_DEFAULT = ' + JSON.stringify(read()) + ';'; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => msg('✔ Copied — paste it over the HOME_DEFAULT line in the HTML file.'), () => prompt('Copy this line:', t)); };
    $q('#hmReset').onclick = () => { draft = null; fill(); render(); };
    $q('#hmOpen').onclick = () => { const n = Q('.nav-item[data-view="home"]'); if (n) n.click(); };
    const sync = () => { card.style.display = isAdmin() ? '' : 'none'; if (isAdmin()) { draft = null; fill(); } };
    document.querySelectorAll('.nav-item[data-view="settings"]').forEach(n => n.addEventListener('click', () => setTimeout(sync, 0)));
    sync();
  })();
  const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (activeViewId() === 'home') { e.stopImmediatePropagation(); render(); } }, true);
  const _olc = onLoginComplete; onLoginComplete = function () { const r = _olc.apply(this, arguments); setTimeout(() => { const n = Q('.nav-item[data-view="home"]'); if (n && !n.classList.contains('locked')) n.click(); }, 400); return r; };
})();
