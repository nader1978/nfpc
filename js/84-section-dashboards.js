/* ============================================================
   📊 SECTION DASHBOARDS — 🏭 WHs Movements (FEFO) · 🧾 Stock Movement Entry · 🚚 Logistics Trip Planning · 🥛 Milco Daily Planning
   Each section opens on its own division dashboard (fixed in the background, own colour theme). The working page
   (entry, tabs, lists …) opens as a pop-up window over it — from the dashboard buttons, or automatically when any
   part of the page is used. ✕ / ← Dashboard closes the pop-up and refreshes the dashboard.
   Data: WHs Movements + Stock Movement Entry → SKUs_Movements_Batch_tbl (WMVX history) · Logistics → the trip plan
   rows · Milco → the computed daily plan (demand × stock).
   ============================================================ */
(function () {
  'use strict';
  if (!window.DSTAGE) return;
  const D = DSTAGE.DIV;
  Object.assign(D, {
    wmv: { n: 'Warehouse Operations', ic: '🏭', s: 'Inbound · outbound · pallets · FEFO batches · rack positions', c1: '#1e3a8a', c2: '#3b82f6', t: '59,130,246' },
    smv: { n: 'Stock Control', ic: '🧾', s: 'Receipts · releases · documents · users', c1: '#064e3b', c2: '#10b981', t: '16,185,129' },
    logplan: { n: 'Logistics Division', ic: '🚚', s: 'Trips · trucks · drivers · regions · completion', c1: '#164e63', c2: '#06b6d4', t: '6,182,212' },
    mdp: { n: 'Milco Planning', ic: '🥛', s: 'Demand (DSO) · stock · routes · picking · shortages', c1: '#4a044e', c2: '#c026d3', t: '192,38,211' }
  });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const fm = (v, d) => (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d && v % 1 ? 1 : 0 });
  const ymd = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const TODAY = () => ymd(Date.now()), dAdd = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
  const dOf = v => { const s = String(v || ''); if (/^\d{4}-\d{2}-\d{2}/.test(s)) { if (s.length > 10 && /T/.test(s)) { const t = new Date(s); if (!isNaN(t)) return ymd(t); } return s.slice(0, 10); } const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : ''; };
  const short = s => { const [, m, d] = s.split('-'); return +d + '/' + +m; };

  const css = document.createElement('style'); css.id = 'sdbCss';
  css.textContent = ['wmv', 'smv', 'logplan', 'mdp'].map(k => `[data-dv="${k}"]{--dv1:${D[k].c1};--dv2:${D[k].c2};--dvt:${D[k].t}}`).join('') + `
.sdb-hide{display:none!important}
.sdb-host{margin-bottom:14px}
.sdb-go{display:flex;gap:8px;flex-wrap:wrap;margin:-4px 0 14px}.sdb-go button{flex:0 0 auto!important;width:auto!important;border:1px solid rgba(var(--dvt),.35)!important;background:var(--card,#fff)!important;color:var(--dv1)!important;border-radius:999px!important;padding:6px 14px!important;font-weight:700!important;font-size:12.5px!important;cursor:pointer;box-shadow:0 2px 6px -3px rgba(var(--dvt),.6)}
.sdb-go button:hover{background:linear-gradient(120deg,var(--dv1),var(--dv2))!important;color:#fff!important;border-color:transparent!important}.sdb-go button.main{background:linear-gradient(120deg,var(--dv1),var(--dv2))!important;color:#fff!important;border-color:transparent!important}
body.dark .sdb-go button:not(.main):not(:hover){color:#fff!important}
.sdb-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:14px}
.sdb-k{position:relative;overflow:hidden;background:var(--card,#fff);border:1px solid rgba(var(--dvt),.22);border-radius:14px;padding:12px 14px 12px 16px;box-shadow:0 6px 18px -12px rgba(var(--dvt),.8)}
.sdb-k:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,var(--dv1),var(--dv2))}
.sdb-k span{font-size:12px;color:var(--gray-600,#64748b);display:block}.sdb-k b{font-size:24px;display:block;margin:2px 0;color:var(--text,#0f172a);letter-spacing:-.3px}.sdb-k small{font-size:11.5px;color:var(--gray-600,#64748b)}
.sdb-k i{position:absolute;right:10px;top:8px;font-style:normal;font-size:22px;opacity:.35}.sdb-k.r b{color:#dc2626}.sdb-k.g b{color:#16a34a}.sdb-k.o b{color:#d97706}
body.dark .sdb-k b{color:#f1f5f9}
.sdb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px}
.sdb-p{background:var(--card,#fff);border:1px solid rgba(var(--dvt),.2);border-radius:16px;padding:14px 16px;min-width:0;box-shadow:0 4px 14px -10px rgba(15,23,42,.4)}.sdb-p.w2{grid-column:span 2}@media (max-width:900px){.sdb-p.w2{grid-column:auto}}
.sdb-p h4{margin:0 0 10px;font-size:14px;display:flex;gap:8px;align-items:baseline;color:var(--dv1)}.sdb-p h4 small{font-weight:500;color:var(--gray-600,#64748b);font-size:11.5px;margin-left:auto}body.dark .sdb-p h4{color:var(--dv2)}
.sdb-bar{display:grid;grid-template-columns:minmax(90px,38%) 1fr auto;gap:8px;align-items:center;font-size:12.5px;margin:6px 0}.sdb-bar .l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sdb-bar .t{height:10px;border-radius:6px;background:rgba(var(--dvt),.12);overflow:hidden}.sdb-bar .t i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,var(--dv1),var(--dv2))}.sdb-bar .v{font-weight:700;font-variant-numeric:tabular-nums}
.sdb-leg{display:flex;gap:14px;font-size:11.5px;color:var(--gray-600,#64748b);margin-bottom:4px}.sdb-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.sdb-tb{display:grid;font-size:12.5px;border:1px solid var(--border,#e2e8f0);border-radius:10px;overflow:hidden}.sdb-tb>div{display:contents}.sdb-tb>div>span{padding:6px 8px;border-bottom:1px solid var(--border,#e2e8f0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sdb-tb>div.h>span{background:rgba(var(--dvt),.1);font-weight:700;font-size:11.5px;color:var(--dv1)}body.dark .sdb-tb>div.h>span{color:#fff}.sdb-tb .n{text-align:right;font-variant-numeric:tabular-nums}
.sdb-pill{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:700}.sdb-pill.r{background:#fee2e2;color:#b91c1c}.sdb-pill.o{background:#fef3c7;color:#b45309}.sdb-pill.g{background:#dcfce7;color:#15803d}.sdb-pill.b{background:rgba(var(--dvt),.14);color:var(--dv1)}
.sdb-empty{padding:18px;text-align:center;color:var(--gray-600,#64748b);font-size:13px}
.sdb-donut{display:flex;gap:16px;align-items:center}.sdb-donut svg{flex:none}.sdb-donut .lg div{font-size:12.5px;margin:4px 0}.sdb-donut .lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}`;
  document.head.appendChild(css);

  /* ---------- small chart helpers ---------- */
  const bars = (L, f) => { L = L.filter(x => x.v > 0); if (!L.length) return '<div class="sdb-empty">No data yet.</div>'; const mx = Math.max(...L.map(x => x.v)) || 1; return L.map(x => `<div class="sdb-bar" title="${esc(x.l)}"><span class="l">${esc(x.l)}</span><span class="t"><i style="width:${Math.max(2, x.v / mx * 100).toFixed(1)}%"></i></span><span class="v">${f ? f(x.v) : fm(x.v)}</span></div>`).join(''); };
  let GID = 0;
  function cols(days, A, B, la, lb) { const gid = 'sdbG' + (++GID), W = 640, H = 170, pad = 22, n = days.length, mx = Math.max(1, ...A, ...(B || [])), bw = (W - pad * 2) / n, y = v => H - 22 - (v / mx) * (H - 40);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" style="display:block"><defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--dv2)"/><stop offset="1" style="stop-color:var(--dv1)"/></linearGradient></defs>`;
    [0.25, 0.5, 0.75, 1].forEach(f => { const yy = y(mx * f); s += `<line x1="${pad}" x2="${W - pad}" y1="${yy}" y2="${yy}" stroke="rgba(148,163,184,.25)" stroke-dasharray="3 4"/>`; });
    days.forEach((d, i) => { const x0 = pad + i * bw, w = B ? bw * .36 : bw * .6; s += `<rect x="${x0 + bw * (B ? .12 : .2)}" y="${y(A[i])}" width="${w}" height="${Math.max(0, H - 22 - y(A[i]))}" rx="3" fill="url(#${gid})"><title>${short(d)} · ${la}: ${fm(A[i], 1)}</title></rect>`;
      if (B) s += `<rect x="${x0 + bw * .52}" y="${y(B[i])}" width="${w}" height="${Math.max(0, H - 22 - y(B[i]))}" rx="3" fill="#f59e0b"><title>${short(d)} · ${lb}: ${fm(B[i], 1)}</title></rect>`;
      if (n <= 16 || i % 2 === 0) s += `<text x="${x0 + bw / 2}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#94a3b8">${short(d)}</text>`; });
    return `<div class="sdb-leg"><span><i style="background:linear-gradient(var(--dv2),var(--dv1))"></i>${la}</span>${B ? `<span><i style="background:#f59e0b"></i>${lb}</span>` : ''}<span style="margin-left:auto">peak ${fm(mx, 1)}</span></div>` + s + '</svg>'; }
  function donut(parts) { parts = parts.filter(p => p.v > 0); const tot = parts.reduce((a, p) => a + p.v, 0); if (!tot) return '<div class="sdb-empty">No data yet.</div>'; let a0 = -Math.PI / 2, s = '<svg width="128" height="128" viewBox="0 0 128 128">';
    parts.forEach(p => { const a1 = a0 + p.v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, P = a => [64 + 52 * Math.cos(a), 64 + 52 * Math.sin(a)], [x0, y0] = P(a0), [x1, y1] = P(Math.min(a1, a0 + Math.PI * 2 - 1e-4)); s += `<path d="M${x0} ${y0} A52 52 0 ${big} 1 ${x1} ${y1}" stroke="${p.c}" stroke-width="18" fill="none"><title>${esc(p.l)}: ${fm(p.v)}</title></path>`; a0 = a1; });
    s += `<text x="64" y="62" text-anchor="middle" font-size="18" font-weight="800" fill="currentColor">${fm(tot)}</text><text x="64" y="80" text-anchor="middle" font-size="10" fill="#94a3b8">total</text></svg>`;
    return `<div class="sdb-donut">${s}<div class="lg">${parts.map(p => `<div><i style="background:${p.c}"></i>${esc(p.l)} <b>${fm(p.v)}</b> <span style="color:#94a3b8">${(p.v / tot * 100).toFixed(0)}%</span></div>`).join('')}</div></div>`; }
  const table = (head, rows, tpl) => rows.length ? `<div class="sdb-tb" style="grid-template-columns:${tpl}"><div class="h">${head.map(h => `<span class="${h[1] || ''}">${esc(h[0])}</span>`).join('')}</div>${rows.map(r => `<div>${r.map((c, i) => `<span class="${head[i][1] || ''}">${c}</span>`).join('')}</div>`).join('')}</div>` : '<div class="sdb-empty">Nothing to show.</div>';
  const kpi = (l, v, sub, ic, cls) => `<div class="sdb-k ${cls || ''}"><i>${ic || ''}</i><span>${esc(l)}</span><b>${v}</b><small>${sub || ''}</small></div>`;
  const panel = (t, body, sub, w) => `<div class="sdb-p ${w ? 'w2' : ''}"><h4>${t}${sub ? '<small>' + sub + '</small>' : ''}</h4>${body}</div>`;
  const group = (rows, key, val) => { const m = new Map(); rows.forEach(r => { const k = key(r); if (!k) return; m.set(k, (m.get(k) || 0) + val(r)); }); return [...m.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v); };
  const lastDays = n => { const t = TODAY(); return Array.from({ length: n }, (_, i) => dAdd(t, i - n + 1)); };

  /* ---------- movements (shared by WHs Movements + Stock Movement Entry) ---------- */
  const H = () => (window.WMVX && WMVX.S && WMVX.S.hist) || null;
  const rIn = r => num(r.Qty_Rcvd) > 0, rOut = r => num(r.Qty_Rlsd) > 0, qty = r => num(r.Qty_Rcvd) || num(r.Qty_Rlsd);
  const uppOf = sku => { let u = 0; try { u = window.UOMC && UOMC.pltOf ? num(UOMC.pltOf(sku)) : 0; } catch (e) {} if (!u) try { const x = WMVX.uomUpp(sku); u = num(x && x.plt); } catch (e) {} if (!u) try { const m = WMVX.master(sku); u = num(m && m.upp); } catch (e) {} return u; };
  const pal = r => { const p = num(r.PLT_Qty); if (p > 0) return p; const q = qty(r), b = num(r.PLT_Base_Nr) || num(r.Units_Per_Pallet) || uppOf(r.SKU_Code); return b > 0 ? q / b : (/bulk/i.test(r.Move_Mode || '') ? 0 : q > 0 ? 1 : 0); };
  const tDate = r => dOf(r.Trans_Date || r.Created || r.Modified);
  const locOf = r => String(r.Storage_Location || r.Warehouse || '').trim() || '—';
  const loading = name => `<div class="sdb-empty">⏳ Loading ${name} from SharePoint… the dashboard fills in automatically.</div>`;
  function wmvDash() { const h = H(); if (!h || !h.all) return loading('the movement history'); const R = h.all, t = TODAY(), w7 = dAdd(t, -6), days = lastDays(14);
    const td = R.filter(r => tDate(r) === t), wk = R.filter(r => tDate(r) >= w7);
    let onQ = 0, onP = 0, exp30 = [], expd = 0; const bySku = [];
    h.sku.forEach(s => { let q = 0; s.batches.forEach(b => { if (b.bal > 1e-9) { q += b.bal; const left = b.exp ? Math.round((new Date(b.exp) - new Date(t)) / 864e5) : null; if (left != null && left < 0) expd++; else if (left != null && left <= 30) exp30.push({ s, b, left }); const u = s.upp || uppOf(s.code); if (u > 0) onP += b.bal / u; else onP += [...b.pp.values()].reduce((a, pm) => a + [...pm.entries()].filter(([ps, e]) => ps > 0 && e.qty > 1e-9).length, 0); } }); onQ += q; if (q > 0) bySku.push({ l: s.code + (s.dtls ? ' · ' + s.dtls : ''), v: q }); });
    exp30.sort((a, b) => a.left - b.left); bySku.sort((a, b) => b.v - a.v);
    const miss = R.filter(r => qty(r) > 0 && !r._lc && !String(r.Storage_Location || '').trim()).length;
    const pin = days.map(d => R.filter(r => rIn(r) && tDate(r) === d).reduce((a, r) => a + pal(r), 0)), pout = days.map(d => R.filter(r => rOut(r) && tDate(r) === d).reduce((a, r) => a + pal(r), 0));
    const stockLoc = new Map(); R.forEach(r => { const k = locOf(r); stockLoc.set(k, (stockLoc.get(k) || 0) + (num(r.Qty_Rcvd) - num(r.Qty_Rlsd))); });
    return `<div class="sdb-kpis">${kpi('Pallets in · today', fm(td.filter(rIn).reduce((a, r) => a + pal(r), 0), 1), td.filter(rIn).length + ' line(s)', '📥')}${kpi('Pallets out · today', fm(td.filter(rOut).reduce((a, r) => a + pal(r), 0), 1), td.filter(rOut).length + ' line(s)', '📤')}${kpi('Movements · 7 days', fm(wk.length), fm(wk.filter(rIn).length) + ' in · ' + fm(wk.filter(rOut).length) + ' out', '🔁')}
      ${kpi('Stock on hand', fm(onP, 0) + ' <small style="font-size:12px">PLT</small>', fm(onQ) + ' units · ' + fm(bySku.length) + ' SKU(s)', '📦')}${kpi('Positions filled', fm(h.pfill ? h.pfill.size : 0), fm(h.locs ? h.locs.size : 0) + ' rack code(s) used', '🗄')}${kpi('Expiring ≤ 30 days', fm(exp30.length), 'batch(es) with stock', '⏳', exp30.length ? 'o' : 'g')}${kpi('Expired with stock', fm(expd), 'batch(es) to clear', '⛔', expd ? 'r' : 'g')}${kpi('Lines without location', fm(miss), miss ? 'fix in Recent movements' : 'all located', '📍', miss ? 'r' : 'g')}</div>
      <div class="sdb-grid">${panel('📈 Pallets in vs out', cols(days, pin, pout, 'In', 'Out'), 'last 14 days', 1)}${panel('🏷 Top SKUs on hand', bars(bySku.slice(0, 8)), 'units')}${panel('📍 Stock by location', bars([...stockLoc.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, 8)), 'units')}
      ${panel('⏳ FEFO — nearest expiry with stock', table([['SKU'], ['Batch'], ['Expiry'], ['Left'], ['Qty', 'n'], ['Location']], exp30.slice(0, 8).map(x => [esc(x.s.code), esc(x.b.batch), esc(x.b.exp), `<span class="sdb-pill ${x.left <= 7 ? 'r' : 'o'}">${x.left} d</span>`, fm(x.b.bal), esc([...x.b.locs.entries()].filter(e => e[1] > 0).map(e => e[0]).filter(Boolean).slice(0, 2).join(', ') || '—')]), '1.1fr 1fr 1fr .6fr .7fr 1fr'), 'release these first', 1)}</div>`; }
  function smvDash() { const h = H(); if (!h || !h.all) return loading('the stock movements'); const R = h.all, t = TODAY(), w7 = dAdd(t, -6), m30 = dAdd(t, -29), days = lastDays(14);
    const td = R.filter(r => tDate(r) === t), wk = R.filter(r => tDate(r) >= w7), mo = R.filter(r => tDate(r) >= m30);
    const docs = new Set(wk.map(r => String(r.Ref_Nr || '').trim()).filter(Boolean)), users = new Set(wk.map(r => String(r.User_Name || '').trim()).filter(Boolean)), mob = wk.filter(r => /^mobile app/i.test(String(r.Remarks || ''))).length;
    const cin = days.map(d => R.filter(r => rIn(r) && tDate(r) === d).length), cout = days.map(d => R.filter(r => rOut(r) && tDate(r) === d).length);
    const types = group(mo, r => String(r.Trans_Type || (rIn(r) ? 'Receive' : 'Release')).trim(), () => 1), PAL = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#64748b'];
    const recent = R.slice().sort((a, b) => (b._id || 0) - (a._id || 0)).slice(0, 10);
    return `<div class="sdb-kpis">${kpi('Entries · today', fm(td.length), fm(td.filter(rIn).length) + ' receipts · ' + fm(td.filter(rOut).length) + ' releases', '🧾')}${kpi('Received · 7 days', fm(wk.filter(rIn).reduce((a, r) => a + num(r.Qty_Rcvd), 0)), fm(wk.filter(rIn).reduce((a, r) => a + pal(r), 0), 1) + ' PLT', '📥', 'g')}${kpi('Released · 7 days', fm(wk.filter(rOut).reduce((a, r) => a + num(r.Qty_Rlsd), 0)), fm(wk.filter(rOut).reduce((a, r) => a + pal(r), 0), 1) + ' PLT', '📤', 'o')}
      ${kpi('Documents · 7 days', fm(docs.size), 'distinct reference no.', '📄')}${kpi('Active users · 7 days', fm(users.size), [...users].slice(0, 3).join(', '), '👤')}${kpi('From mobile · 7 days', fm(mob), wk.length ? (mob / wk.length * 100).toFixed(0) + '% of entries' : '', '📱')}</div>
      <div class="sdb-grid">${panel('📈 Entries per day', cols(days, cin, cout, 'Receipts', 'Releases'), 'last 14 days', 1)}${panel('🧩 Transaction types', donut(types.slice(0, 7).map((x, i) => ({ l: x.l, v: x.v, c: PAL[i] }))), 'last 30 days')}${panel('👤 Entries by user', bars(group(mo, r => String(r.User_Name || '').trim(), () => 1).slice(0, 8)), 'last 30 days')}
      ${panel('🕘 Latest entries', table([['Date'], ['Type'], ['SKU'], ['Batch'], ['Qty', 'n'], ['Ref.'], ['By']], recent.map(r => [esc(tDate(r)), `<span class="sdb-pill ${rIn(r) ? 'g' : 'o'}">${esc(r.Trans_Type || (rIn(r) ? 'Receive' : 'Release'))}</span>`, esc(r.SKU_Code), esc(r.Batch_Code), fm(qty(r)), esc(r.Ref_Nr || ''), esc(r.User_Name || '')]), '.9fr 1.1fr 1fr 1fr .7fr .9fr 1fr'), '', 1)}</div>`; }
  /* ---------- logistics ---------- */
  function lpDash() { let L; try { L = lp; } catch (e) { return '<div class="sdb-empty">Logistics data not available.</div>'; } const R = (L.rows || []).filter(r => r && r.date), real = R.filter(r => !r.auto && !r.manual);
    if (!R.length) return '<div class="sdb-empty">No trip plan yet — open <b>Plan</b> and import the NE / SE plan or start from the daily template.</div>';
    const ds = [...new Set(real.map(r => dOf(r.date) || r.date))].sort(), t = TODAY(), day = (L.f && L.f.date && dOf(L.f.date)) || ds.filter(d => d <= t).pop() || ds[ds.length - 1], D0 = real.filter(r => (dOf(r.date) || r.date) === day);
    const P = x => x.reduce((a, r) => a + (+r.planned || 0), 0), Dn = x => x.reduce((a, r) => a + (+r.done || 0), 0), M = x => x.reduce((a, r) => a + (+r.missed || 0), 0);
    const pl = P(D0), dn = Dn(D0), ms = M(D0), trucks = new Set(D0.map(r => String(r.regNo || '').trim()).filter(Boolean)), drv = new Set(D0.map(r => String(r.driver || '').trim()).filter(Boolean)), pct = pl ? dn / pl * 100 : 0;
    const days = ds.slice(-14), PAL = ['#06b6d4', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#64748b'];
    const vs = group(D0, r => String(r.vehStatus || 'Not set').trim() || 'Not set', () => 1);
    return `<div class="sdb-kpis">${kpi('Plan date', esc(day ? short(day) + '/' + day.slice(0, 4) : '—'), ds.length + ' day(s) in the plan', '📅')}${kpi('Planned trips', fm(pl), D0.length + ' row(s)', '🗺')}${kpi('Done', fm(dn), pct.toFixed(0) + '% completed', '✅', pct >= 90 ? 'g' : pct >= 60 ? 'o' : 'r')}${kpi('Missed', fm(ms), ms ? 'follow up' : 'none', '⚠', ms ? 'r' : 'g')}
      ${kpi('Trucks used', fm(trucks.size), 'distinct reg. no.', '🚛')}${kpi('Drivers', fm(drv.size), '', '🧑‍✈️')}${kpi('Regions', fm(new Set(D0.map(r => r.region).filter(Boolean)).size), [...new Set(D0.map(r => r.region).filter(Boolean))].join(' · '), '🧭')}${kpi('Return / auto legs', fm(R.filter(r => (r.auto || r.manual) && (dOf(r.date) || r.date) === day).length), 'not counted as trips', '↩')}</div>
      <div class="sdb-grid">${panel('📈 Planned vs done', cols(days, days.map(d => P(real.filter(r => (dOf(r.date) || r.date) === d))), days.map(d => Dn(real.filter(r => (dOf(r.date) || r.date) === d))), 'Planned', 'Done'), 'by plan date', 1)}
      ${panel('🧭 Trips by region', bars(group(D0, r => r.region, r => +r.planned || 0)), short(day || t))}${panel('🏢 Trips by business unit', bars(group(D0, r => r.bu, r => +r.planned || 0)), short(day || t))}
      ${panel('🚦 Vehicle status', donut(vs.slice(0, 7).map((x, i) => ({ l: x.l, v: x.v, c: PAL[i] }))), short(day || t))}${panel('📍 Top destinations', bars(group(D0, r => String(r.to || '').trim(), r => +r.planned || 1).slice(0, 8)), short(day || t))}</div>`; }
  /* ---------- Milco ---------- */
  function mdpDash() { let M; try { M = mdp; } catch (e) { return '<div class="sdb-empty">Milco data not available.</div>'; } const res = M.res;
    if (!res || !res.items || !res.items.size) return '<div class="sdb-empty">No plan computed yet — import the sales demand (DSO) in <b>1 · Import</b> and load the stock in <b>2 · Stock</b>; the dashboard fills in from the computed plan.</div>';
    const I = [...res.items.values()], L = res.lines || [], req = I.reduce((a, x) => a + x.req, 0), pa = I.reduce((a, x) => a + x.pa, 0), pt = I.reduce((a, x) => a + x.pt, 0), sh = I.reduce((a, x) => a + Math.max(0, x.short), 0), gr = I.reduce((a, x) => a + (x.gr || 0), 0), fill = req ? (pa + pt) / req * 100 : 0;
    const routes = new Set(L.map(l => l.route).filter(Boolean)), shortI = I.filter(x => x.short > 1e-9).sort((a, b) => b.short - a.short), unknown = I.filter(x => !x.known).length;
    return `<div class="sdb-kpis">${kpi('Routes', fm(routes.size), fm(L.length) + ' route line(s)', '🛣')}${kpi('SKUs demanded', fm(I.length), unknown ? unknown + ' not in stock list' : 'all known', '🥛', unknown ? 'o' : '')}${kpi('Demand', fm(req), 'units requested', '🧾')}${kpi('From actual stock', fm(pa), req ? (pa / req * 100).toFixed(0) + '% of demand' : '', '📦', 'g')}
      ${kpi('From in transit', fm(pt), req ? (pt / req * 100).toFixed(0) + '% of demand' : '', '🚚')}${kpi('Short', fm(sh), fm(shortI.length) + ' SKU(s)', '⚠', sh ? 'r' : 'g')}${kpi('Fill rate', fill.toFixed(1) + '%', 'actual + transit ÷ demand', '🎯', fill >= 98 ? 'g' : fill >= 90 ? 'o' : 'r')}${kpi('Good returns used', fm(gr), M.cfg && M.cfg.useGR ? 'GR on' : 'GR off', '↩')}</div>
      <div class="sdb-grid">${panel('🧩 How demand is covered', donut([{ l: 'Actual stock', v: pa, c: '#c026d3' }, { l: 'In transit', v: pt, c: '#f59e0b' }, { l: 'Short', v: sh, c: '#ef4444' }]), fm(req) + ' units')}${panel('🛣 Demand by route', bars(group(L, l => l.route, l => l.req).slice(0, 10)), 'units')}${panel('🏷 Top SKUs by demand', bars(I.map(x => ({ l: x.code + (x.desc ? ' · ' + x.desc : ''), v: x.req })).sort((a, b) => b.v - a.v).slice(0, 8)), 'units')}
      ${panel('⚠ Shortages', table([['SKU'], ['Description'], ['Demand', 'n'], ['Actual', 'n'], ['Transit', 'n'], ['Short', 'n']], shortI.slice(0, 10).map(x => [esc(x.code), esc(x.desc || ''), fm(x.req), fm(x.pa), fm(x.pt), `<span class="sdb-pill r">${fm(x.short)}</span>`]), '.9fr 1.8fr .7fr .7fr .7fr .7fr'), shortI.length ? shortI.length + ' SKU(s)' : 'none', 1)}</div>`; }

  /* ---------- the stage: dashboard in the view, page in the pop-up ---------- */
  const CFG = {
    wmv: { dash: wmvDash, title: 'WHs Movements (FEFO)', tabs: '#wmvTabs', load: () => { try { WMVX.load(false); } catch (e) {} }, sig: () => { const h = H(); return h ? h.rows + ':' + (h.recent[0] || {})._id : ''; } },
    smv: { dash: smvDash, title: 'Stock Movement Entry', tabs: '#smvMobTabs', load: () => { try { WMVX.load(false); } catch (e) {} }, sig: () => { const h = H(); return h ? h.rows + ':' + (h.recent[0] || {})._id : ''; } },
    logplan: { dash: lpDash, title: 'Logistics Trip Planning', tabs: '#lpTabs', sig: () => { try { return lp.rows.length + ':' + lp.rows.reduce((a, r) => a + (+r.done || 0), 0) + ':' + (lp.f && lp.f.date); } catch (e) { return ''; } } },
    mdp: { dash: mdpDash, title: 'Milco Daily Planning', tabs: '#mdpTabs', sig: () => { try { return mdp.res ? mdp.res.lines.length + ':' + mdp.res.items.size : '0'; } catch (e) { return ''; } } }
  };
  const ST = {};
  function host(v) { let h = v.querySelector(':scope > .sdb-host'); if (!h) { h = document.createElement('div'); h.className = 'sdb-host'; v.insertBefore(h, v.firstChild); } return h; }
  const pageNodes = v => [...v.children].filter(n => !n.classList.contains('sdb-host') && !n.classList.contains('dst-ov') && n.nodeType === 1);
  function tabList(id) { const c = CFG[id], v = document.getElementById('view-' + id), bar = v && v.querySelector(c.tabs); const L = bar ? [...bar.querySelectorAll('button[data-t]')].filter(b => !b.disabled && b.offsetParent !== null || b.closest('.sdb-hide')).map(b => [b.dataset.t, b.textContent.trim()]) : []; return L.slice(0, 8); }
  function draw(id) { const c = CFG[id], v = document.getElementById('view-' + id); if (!v) return; const s = ST[id] || (ST[id] = {}); const h = host(v);
    let body; try { body = c.dash(); } catch (e) { console.error(e); body = '<div class="sdb-empty">⚠ ' + esc(e.message) + '</div>'; }
    const tabs = tabList(id); s.sig = c.sig();
    h.innerHTML = `<div class="dst-bg" data-dv="${id}">${DSTAGE.hero(id)}<div class="sdb-go"><button type="button" class="main" data-sdbo="">✍ Open ${esc(c.title)}</button>${tabs.map(t => `<button type="button" data-sdbo="${esc(t[0])}">${esc(t[1])}</button>`).join('')}</div>${body}</div>`;
    h.querySelector('.dst-hero .hint') && (h.querySelector('.dst-hero .hint').textContent = 'The working page opens as a pop-up over this dashboard · close it (✕) to come back here'); }
  function mode(id, open, tab) { const v = document.getElementById('view-' + id); if (!v) return; const s = ST[id] || (ST[id] = {}); s.open = open; v.dataset.dv = id;
    const nodes = s.nodes && s.open ? s.nodes : pageNodes(v); if (!open) s.nodes = null;
    if (open) { s.nodes = nodes; nodes.forEach(n => n.classList.remove('sdb-hide')); DSTAGE.move(v, { div: id, open: true, nodes, title: CFG[id].title, onClose: () => { mode(id, false); } });
      if (tab) { const b = v.querySelector(CFG[id].tabs + ' button[data-t="' + tab + '"]'); if (b) { s.self = true; try { b.click(); } finally { s.self = false; } } } }
    else { DSTAGE.move(v, { div: id, open: false, nodes: [] }); pageNodes(v).forEach(n => n.classList.add('sdb-hide')); draw(id); } }
  function wire(id) { const v = document.getElementById('view-' + id); if (!v || v.dataset.sdb) return; v.dataset.sdb = '1'; host(v);
    v.addEventListener('click', e => { const b = e.target.closest('[data-sdbo]'); if (b && b.closest('.sdb-host')) { e.preventDefault(); mode(id, true, b.dataset.sdbo); } }, false);
    /* anything that reaches the hidden page (another screen jumping here, a programmatic click / focus) opens the pop-up first */
    const wake = e => { const s = ST[id] || {}; if (s.open || s.self) return; const n = e.target && e.target.closest && e.target.closest('.sdb-hide'); if (n && n.parentElement === v) mode(id, true); };
    v.addEventListener('click', wake, true); v.addEventListener('focusin', wake, true);
    new MutationObserver(() => { const on = v.classList.contains('active'); const s = ST[id] || (ST[id] = {}); if (on && !s.on) { s.on = true; try { CFG[id].load && CFG[id].load(); } catch (e) {} mode(id, false); } else if (!on && s.on) { s.on = false; if (s.open) mode(id, false); } }).observe(v, { attributes: true, attributeFilter: ['class'] });
    if (v.classList.contains('active')) { (ST[id] = ST[id] || {}).on = true; mode(id, false); } }
  /* live refresh while the dashboard is on screen */
  setInterval(() => Object.keys(CFG).forEach(id => { const s = ST[id]; if (!s || !s.on || s.open) return; let g = ''; try { g = CFG[id].sig(); } catch (e) {} if (g !== s.sig) draw(id); }), 2500);
  const boot = () => Object.keys(CFG).forEach(wire); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); setTimeout(boot, 1500);
  window.SDB = { open: (id, tab) => mode(id, true, tab), dash: id => mode(id, false), draw };
})();
