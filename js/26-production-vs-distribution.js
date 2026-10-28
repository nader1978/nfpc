/* ---------- setup tab ---------- */
function fdmSetupRender() {
  const cfg = fdmCfg(), labels = [...new Set(fdm.weeks.flatMap(w => w.regions))];
  PLQ('#fdmRegList').innerHTML = labels.map(l => `<option value="${plEsc(l)}">`).join('');
  PLQ('#fdmMapBody').innerHTML = cfg.map.map((m, i) => `<tr><td><input type="text" data-mi="${i}" data-f="loc" value="${plEsc(m.loc)}" style="text-transform:uppercase"></td><td><input type="text" list="fdmRegList" data-mi="${i}" data-f="region" value="${plEsc(m.region)}"></td><td><select data-mi="${i}" data-f="grp"><option value="" ${!m.grp ? 'selected' : ''}>—</option><option ${m.grp === 'NE' ? 'selected' : ''}>NE</option><option ${m.grp === 'SE' ? 'selected' : ''}>SE</option></select></td><td><button class="ghost small" data-mdel="${i}" type="button">✖</button></td></tr>`).join('');
  const tp = [...new Set(['Final', 'Tentative', 'Delist', '(blank)'].concat(fdm.weeks.flatMap(w => w.items.map(i => i.dtype || '(blank)'))))];
  PLQ('#fdmTypes').innerHTML = tp.map(t => `<label class="text-sm" style="display:inline-flex;gap:5px;align-items:center;margin:0"><input type="checkbox" data-ty="${plEsc(t)}" ${cfg.types[t] !== false ? 'checked' : ''} style="width:auto;margin:0"> ${plEsc(t)}</label>`).join(''); PLQ('#fdmTol').value = cfg.tol;
}

/* ---------- the comparison ---------- */
function fdmFactor(met, o, wi) {
  if (met === 'units') return 1; const pc = (o && o.pcsCrt) || (wi && wi.pcsCrt) || 0, cp = (o && o.crtPallet) || (wi && wi.crtPallet) || 0, up = (o && o.unitPallet) || 0;
  if (met === 'crates') return pc ? 1 / pc : 0; if (met === 'pallets') return up ? 1 / up : (pc && cp ? 1 / (pc * cp) : 0); return (o && o.ltrConv) || 0;
}
function fdmCells(withDaily) {
  const cfg = fdmCfg(), W = fdm.weeks.find(w => w.weekStart === fdm.wSel) || null, D = withDaily ? (fdm.dailies.find(s => s.planDate === fdm.dSel) || null) : null; if (!W && !D) return null;
  const act = D ? fdStLoad(D.planDate).act : {}, regs = D ? dpRegions(D) : {}, days = [...new Set([...(W ? W.days : []), ...(D ? D.days : [])])].sort(), locs = cfg.map.map(m => m.loc);
  const wBy = new Map(); if (W) W.items.forEach(i => { const e = wBy.get(i.code); if (!e) wBy.set(i.code, i); else { e.prod = e.prod.map((v, k) => v + i.prod[k]); Object.keys(i.reg).forEach(r => { e.reg[r] = (e.reg[r] || i.reg[r].map(() => 0)).map((v, k) => v + i.reg[r][k]); }); } });
  const dFull = new Set(D ? D.days.filter(d => D.rows.some(o => ((o.v.dem[d] || [])).some(x => x > 0))) : []), dBy = new Map(D ? D.rows.map(o => [o.code, o]) : []), codes = [...new Set([...wBy.keys(), ...dBy.keys()])], cells = [], notW = new Set(), notD = new Set(), mapBy = new Map(cfg.map.map(m => [m.loc, m]));
  codes.forEach(code => { const wi = wBy.get(code), o = dBy.get(code); if (wi && cfg.types[wi.dtype || '(blank)'] === false) return; if (W && !wi) notW.add(code); if (D && !o) notD.add(code);
    const info = { code, item: (o && o.item) || (wi && wi.item) || '', uom: (o && o.uom) || (wi && wi.uom) || '', company: wi ? wi.company : '', dtype: wi ? (wi.dtype || '(blank)') : '', brand: (o && o.brand) || (wi && wi.brand) || '', category: (o && o.category) || (wi && wi.category) || '', prodIn: (o && o.prodIn) || (wi && wi.prodIn) || '' };
    days.forEach(d => locs.forEach(loc => { const mp = mapBy.get(loc), j = D ? D.locs.indexOf(loc) : -1; let w = null, dv = null, a = null, adj = false;
      if (W && W.days.includes(d)) { const rk = wi ? Object.keys(wi.reg).find(r => dpNorm(r) === dpNorm(mp.region)) : null; w = rk ? wi.reg[rk][W.days.indexOf(d)] : 0; }
      if (D && dFull.has(d)) { dv = o && j >= 0 ? ((o.v.dem[d] || [])[j] || 0) : 0; const k = d + '|' + loc + '|' + code; adj = act[k] != null; a = adj ? act[k] : dv; }
      if (!((w || 0) > 0 || (dv || 0) > 0 || (a || 0) > 0)) return; const f = fdmFactor(fdm.met, o, wi);
      cells.push({ d, loc, grp: mp.grp || (regs[loc] || ''), code, info, w: w == null ? null : w * f, dv: dv == null ? null : dv * f, a: a == null ? null : a * f, adj }); })); });
  return { W, D, days, cells, notW, notD, dEmpty: D ? D.days.filter(d => !dFull.has(d)) : [] };
}
function fdmGroup(cells, by) {
  const key = c => by === 'item' ? c.code : by === 'loc' ? c.loc : by === 'day' ? c.d : by === 'itemloc' ? c.code + '|' + c.loc : by === 'dayloc' ? c.d + '|' + c.loc : by === 'grp' ? (c.grp || '—') : (c.info.company || '—'), m = new Map();
  cells.forEach(c => { const k = key(c); let o = m.get(k); if (!o) m.set(k, o = { k, c, w: 0, dv: 0, a: 0, hw: false, hd: false, dwN: 0, dwB: 0, adN: 0, adB: 0, awN: 0, adj: 0 }); if (c.w != null) { o.w += c.w; o.hw = true; } if (c.dv != null) { o.dv += c.dv; o.hd = true; o.adN += c.a - c.dv; o.adB += c.dv; if (c.adj) o.adj++; } if (c.a != null) o.a += c.a; if (c.w != null && c.dv != null) { o.dwN += c.dv - c.w; o.dwB += c.w; o.awN += c.a - c.w; } });
  return [...m.values()];
}
function fdmLabels(by) {
  const dn = d => dpDayLong(d), it = o => [o.c.code, o.c.info.item, o.c.info.uom], L = { item: [['ICODE', o => o.c.code], ['Item', o => o.c.info.item], ['UoM', o => o.c.info.uom], ['Weekly type', o => o.c.info.dtype]], loc: [['Location', o => o.c.loc], ['Group', o => o.c.grp]], day: [['Day', o => dn(o.c.d)]], itemloc: [['ICODE', o => o.c.code], ['Item', o => o.c.info.item], ['Location', o => o.c.loc]], dayloc: [['Day', o => dn(o.c.d)], ['Location', o => o.c.loc]], grp: [['Group', o => o.c.grp || '—']], company: [['Company', o => o.c.info.company || '—']] };
  return L[by];
}
function fdmCmpBuild() {
  const D0 = fdmCells(true); if (!D0) return null; const cfg = fdmCfg(); let cells = D0.cells;
  if (fdm.day) cells = cells.filter(c => c.d === fdm.day); if (fdm.regs.length) cells = cells.filter(c => fdm.regs.includes(c.loc)); const q = fdm.q.trim().toLowerCase(); if (q) cells = cells.filter(c => (c.code + ' ' + c.info.item).toLowerCase().includes(q));
  let G = fdmGroup(cells, fdm.by); const pc = (n, b) => b > 0 ? n / b * 100 : null, tol = cfg.tol;
  G.forEach(o => { o.dwP = pc(o.dwN, o.dwB); o.adP = pc(o.adN, o.adB); o.f1 = o.dwP != null && Math.abs(o.dwP) > tol + 1e-9 || (o.dwB === 0 && o.dwN > 0); o.f2 = o.adP != null && Math.abs(o.adP) > tol + 1e-9; });
  if (fdm.onlyDiff) G = G.filter(o => o.f1 || o.f2);
  const lab = fdmLabels(fdm.by); G.sort((a, b) => fdm.sort === 'dw' ? Math.abs(b.dwN) - Math.abs(a.dwN) : fdm.sort === 'ad' ? Math.abs(b.adN) - Math.abs(a.adN) : lab.map(l => String(l[1](a))).join(' ').localeCompare(lab.map(l => String(l[1](b))).join(' '), undefined, { numeric: true }));
  const T = cells.reduce((t, c) => { if (c.w != null) { t.w += c.w; t.hw = true; } if (c.dv != null) { t.dv += c.dv; t.hd = true; t.adN += c.a - c.dv; t.adB += c.dv; } if (c.a != null) t.a += c.a; if (c.w != null && c.dv != null) { t.dwN += c.dv - c.w; t.dwB += c.w; } return t; }, { w: 0, dv: 0, a: 0, hw: false, hd: false, dwN: 0, dwB: 0, adN: 0, adB: 0 });
  return { base: D0, cells, G, lab, T, dp: pc(T.dwN, T.dwB), ap: pc(T.adN, T.adB), tol };
}
const fdmDiffCell = (n, p, tol, has) => !has ? '<td class="n"></td><td class="n"></td>' : `<td class="n" style="color:${n < 0 ? '#d03b3b' : n > 0 ? '#0a7a0a' : ''}">${n ? (n > 0 ? '+' : '') + fdmQ(n) : ''}</td><td class="n" style="${p != null && Math.abs(p) > tol ? 'font-weight:700;color:#b45309' : ''}">${p == null ? '' : (p > 0 ? '+' : '') + plF(p, 1) + '%'}</td>`;
function fdmCmpRender() {
  const q = PLQ, cfg = fdmCfg(); fdm.met = q('#fdmMet').value || fdm.met;
  q('#fdmWSel').innerHTML = '<option value="">— none —</option>' + fdm.weeks.slice().reverse().map(w => `<option value="${plEsc(w.weekStart)}" ${w.weekStart === fdm.wSel ? 'selected' : ''}>${plEsc(w.weekStart)} → ${plEsc(w.weekEnd)}</option>`).join('');
  q('#fdmDSel').innerHTML = '<option value="">— none —</option>' + fdm.dailies.slice().reverse().map(s => `<option value="${plEsc(s.planDate)}" ${s.planDate === fdm.dSel ? 'selected' : ''}>${plEsc(s.planDate)} · ${plEsc(s.days.map(dpDayLbl).join(', '))}</option>`).join('');
  const B = fdmCmpBuild(), host = q('#fdmCmpTable'); const days = B ? B.base.days : [];
  q('#fdmDay').innerHTML = '<option value="">All days</option>' + days.map(d => `<option value="${d}" ${d === fdm.day ? 'selected' : ''}>${plEsc(dpDayLong(d))}</option>`).join('');
  const rh = q('#fdmRegHost'), locs = cfg.map.map(m => m.loc), sig = locs.join(',') + '|' + fdm.regs.join(','); if (rh.dataset.sig !== sig) { rh.dataset.sig = sig; rh.innerHTML = ''; rh.appendChild(buildMultiCombo(fdm.regs, locs, a => { fdm.regs = a; rh.dataset.sig = locs.join(',') + '|' + a.join(','); fdm.shown = 200; fdmCmpRender(); }, { placeholder: 'All locations' })); }
  ['#fdmBy', '#fdmSort'].forEach((id, i) => { q(id).value = i ? fdm.sort : fdm.by; }); q('#fdmMet').value = fdm.met; q('#fdmOnlyDiff').checked = fdm.onlyDiff;
  if (!B) { host.querySelector('thead').innerHTML = ''; host.querySelector('tbody').innerHTML = '<tr><td class="pl-empty" style="padding:18px">Upload and save a weekly and/or a daily plan first (Upload tab).</td></tr>'; q('#fdmKpis').innerHTML = ''; q('#fdmChart').innerHTML = ''; q('#fdmCmpInfo').textContent = ''; q('#fdmCmpMore').style.display = 'none'; return; }
  const { W, D } = B.base, mu = { units: 'units', crates: 'crates', pallets: 'pallets', litres: 'litres' }[fdm.met], K = typeof atKpi === 'function' ? atKpi : (l, v, s) => `<div class="pl-kpi"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`;
  q('#fdmCmpInfo').textContent = (B.base.dEmpty.length ? `(daily plan has no quantities on ${B.base.dEmpty.map(dpDayLbl).join(', ')} — ignored) ` : '') + `— ${W ? 'weekly ' + W.weekStart + ' → ' + W.weekEnd : 'no weekly plan'} · ${D ? 'daily ' + D.planDate : 'no daily plan'} · in ${mu} · tolerance ${B.tol}%`;
  const T = B.T, adj = B.cells.filter(c => c.adj).length, pcs = p => p == null ? '—' : (p > 0 ? '+' : '') + plF(p, 1) + '%';
  q('#fdmKpis').innerHTML = K('Weekly plan', T.hw ? fdmN(T.w) : '—', W ? `${plF(W.items.length)} SKUs in the file` : 'not loaded') + K('Daily plan', T.hd ? fdmN(T.dv) : '—', D ? `${plF(D.rows.length)} SKUs in the file` : 'not loaded') + K('Actual', T.hd ? fdmN(T.a) : '—', `${plF(adj)} cell(s) adjusted`) + K('Daily vs weekly', pcs(B.dp), T.dwB ? `${(T.dwN > 0 ? '+' : '') + fdmN(T.dwN)} on the days both plans cover` : 'no day in common') + K('Actual vs daily', pcs(B.ap), T.adB ? `${(T.adN > 0 ? '+' : '') + fdmN(T.adN)} ${mu}` : '') + K('Outside tolerance', plF(B.G.filter(o => o.f1 || o.f2).length), `${plF(B.base.notW.size)} SKU(s) only in the daily · ${plF(B.base.notD.size)} only in the weekly`);
  // chart by day
  try { const T0 = plT(), byDay = new Map(); B.cells.forEach(c => { let o = byDay.get(c.d); if (!o) byDay.set(c.d, o = [0, 0, 0]); o[0] += c.w || 0; o[1] += c.dv || 0; o[2] += c.a || 0; }); const cats = [...byDay.keys()].sort().map(d => ({ label: dpDayLbl(d), key: d, vals: byDay.get(d), tip: [['Weekly', 0], ['Daily', 1], ['Actual', 2]].map(([k, i]) => ({ c: T0.series[i], k, v: plF(byDay.get(d)[i], 0) })) }));
    q('#fdmChart').innerHTML = ''; q('#fdmLeg').innerHTML = ['Weekly', 'Daily', 'Actual'].map((n, i) => `<span style="margin-left:10px"><span style="display:inline-block;width:10px;height:10px;background:${T0.series[i]};border-radius:2px"></span> ${n}</span>`).join(''); if (cats.length) plcCols(q('#fdmChart'), { cats, series: ['Weekly', 'Daily', 'Actual'].map((n, i) => ({ name: n, color: T0.series[i] })), fmt: v => plF(v, 0), labelFn: (c, v) => v ? plK(v) : '', height: 240 }); } catch (e) { q('#fdmChart').innerHTML = ''; }
  const lab = B.lab, cols = [...lab.map(l => [l[0], 0]), ['Weekly', 1], ['Daily', 1], ['Actual', 1], ['Daily − weekly', 1], ['%', 1], ['Actual − daily', 1], ['%', 1], ['Flag', 0]];
  host.querySelector('thead').innerHTML = '<tr>' + cols.map(c => `<th class="${c[1] ? 'n' : ''}">${plEsc(c[0])}</th>`).join('') + '</tr>';
  const sh = B.G.slice(0, fdm.shown);
  host.querySelector('tbody').innerHTML = (sh.map(o => `<tr>${lab.map(l => `<td>${plEsc(l[1](o))}</td>`).join('')}<td class="n">${o.hw ? fdmQ(o.w) : ''}</td><td class="n">${o.hd ? fdmQ(o.dv) : ''}</td><td class="n" ${o.adj ? 'style="background:#fff7d6;font-weight:700" title="' + o.adj + ' adjusted cell(s)"' : ''}>${o.hd ? fdmQ(o.a) : ''}</td>${fdmDiffCell(o.dwN, o.dwP, B.tol, o.dwB > 0 || (o.hw && o.hd))}${fdmDiffCell(o.adN, o.adP, B.tol, o.hd)}<td>${o.f1 ? '<span class="fd-pill warn">Daily ≠ weekly</span> ' : ''}${o.f2 ? '<span class="fd-pill bad">Actual ≠ daily</span>' : ''}</td></tr>`).join('') || `<tr><td colspan="${cols.length}" class="pl-empty" style="padding:16px">Nothing to show for these filters.</td></tr>`) + (sh.length ? `<tr class="fd-tot"><td colspan="${lab.length}">Total · ${plF(B.G.length)} row(s)</td><td class="n">${T.hw ? fdmQ(T.w) : ''}</td><td class="n">${T.hd ? fdmQ(T.dv) : ''}</td><td class="n">${T.hd ? fdmQ(T.a) : ''}</td>${fdmDiffCell(T.dwN, B.dp, B.tol, T.dwB > 0)}${fdmDiffCell(T.adN, B.ap, B.tol, T.hd)}<td></td></tr>` : '');
  q('#fdmCmpMore').style.display = B.G.length > fdm.shown ? '' : 'none'; q('#fdmCmpMore').textContent = `Show 200 more rows (${B.G.length - fdm.shown} left)`;
}
function fdmCmpData() {
  const B = fdmCmpBuild(); if (!B) return { title: 'Weekly vs daily vs actual', sheet: 'Weekly vs daily', note: '', headers: [], rows: [] }; const lab = B.lab, p = v => v == null ? '' : +v.toFixed(1), n = v => +v.toFixed(2);
  return { title: 'F&D demand — weekly vs daily vs actual', sheet: 'Weekly vs daily vs actual', note: `${B.base.W ? 'weekly ' + B.base.W.weekStart + ' → ' + B.base.W.weekEnd : 'no weekly'} · ${B.base.D ? 'daily ' + B.base.D.planDate : 'no daily'} · ${fdm.met} · tolerance ${B.tol}%`, headers: [...lab.map(l => l[0]), 'Weekly', 'Daily', 'Actual', 'Daily − weekly', 'Daily vs weekly %', 'Actual − daily', 'Actual vs daily %', 'Flag'],
    rows: B.G.map(o => [...lab.map(l => l[1](o)), o.hw ? n(o.w) : '', o.hd ? n(o.dv) : '', o.hd ? n(o.a) : '', o.dwB > 0 || (o.hw && o.hd) ? n(o.dwN) : '', p(o.dwP), o.hd ? n(o.adN) : '', p(o.adP), [o.f1 ? 'Daily ≠ weekly' : '', o.f2 ? 'Actual ≠ daily' : ''].filter(Boolean).join(' · ')]),
    totals: ['TOTAL', ...lab.slice(1).map(() => ''), B.T.hw ? n(B.T.w) : '', B.T.hd ? n(B.T.dv) : '', B.T.hd ? n(B.T.a) : '', n(B.T.dwN), p(B.dp), n(B.T.adN), p(B.ap), ''] };
}

/* ---------- production plan vs distribution (weekly file only) ---------- */
function fdmProdBuild() {
  const cfg = fdmCfg(), W = fdm.weeks.find(w => w.weekStart === fdm.pW) || null; if (!W) return null; const D = fdm.dailies.find(s => s.planDate === fdm.dSel) || null, dBy = new Map(D ? D.rows.map(o => [o.code, o]) : []), q = fdm.pQ.trim().toLowerCase(), by = fdm.pBy, met = fdm.pMet, m = new Map();
  W.items.forEach(i => { if (cfg.types[i.dtype || '(blank)'] === false) return; if (q && !(i.code + ' ' + i.item).toLowerCase().includes(q)) return; const f = (() => { const sv = fdm.met; fdm.met = met; const r = fdmFactor(met, dBy.get(i.code), i); fdm.met = sv; return r; })();
    W.days.forEach((d, k) => { const p = i.prod[k] * f, ds = Object.values(i.reg).reduce((a, arr) => a + (arr[k] || 0), 0) * f; if (!p && !ds) return; const key = by === 'item' ? i.code : by === 'day' ? d : (i[by] || '—'); let o = m.get(key); if (!o) m.set(key, o = { k: key, i, d, p: 0, ds: 0, noDist: 0, noProd: 0 }); o.p += p; o.ds += ds; if (p > 0 && !ds) o.noDist++; if (ds > 0 && !p) o.noProd++; }); });
  const G = [...m.values()]; G.sort((a, b) => by === 'day' ? a.k.localeCompare(b.k) : by === 'item' ? Math.abs(b.p - b.ds) - Math.abs(a.p - a.ds) : String(a.k).localeCompare(String(b.k)));
  let cum = 0; if (by === 'day') G.forEach(o => { cum += o.p - o.ds; o.cum = cum; });
  const T = G.reduce((t, o) => { t.p += o.p; t.ds += o.ds; return t; }, { p: 0, ds: 0 }); return { W, G, T, by, met };
}
function fdmProdLabels(by) { return { item: [['ICODE', o => o.i.code], ['Item', o => o.i.item], ['UoM', o => o.i.uom], ['Produced in', o => o.i.prodIn]], day: [['Day', o => dpDayLong(o.k)]], company: [['Company', o => o.k]], category: [['Category', o => o.k]], brand: [['Brand', o => o.k]], prodIn: [['Produced in', o => o.k]] }[by]; }
function fdmProdRender() {
  const q = PLQ; q('#fdmPW').innerHTML = '<option value="">— none —</option>' + fdm.weeks.slice().reverse().map(w => `<option value="${plEsc(w.weekStart)}" ${w.weekStart === fdm.pW ? 'selected' : ''}>${plEsc(w.weekStart)} → ${plEsc(w.weekEnd)}</option>`).join(''); q('#fdmPBy').value = fdm.pBy; q('#fdmPMet').value = fdm.pMet;
  const B = fdmProdBuild(), host = q('#fdmPTable'); if (!B) { host.querySelector('thead').innerHTML = ''; host.querySelector('tbody').innerHTML = '<tr><td class="pl-empty" style="padding:18px">Upload and save a weekly plan first (Upload tab).</td></tr>'; q('#fdmPKpis').innerHTML = ''; q('#fdmPInfo').textContent = ''; q('#fdmPMore').style.display = 'none'; return; }
  const K = typeof atKpi === 'function' ? atKpi : (l, v, s) => `<div class="pl-kpi"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`, lab = fdmProdLabels(B.by), bal = B.T.p - B.T.ds;
  q('#fdmPInfo').textContent = `— ${B.W.weekStart} → ${B.W.weekEnd} · ${fdm.pMet}`; q('#fdmPKpis').innerHTML = K('Production plan', fdmN(B.T.p), `${plF(B.W.items.length)} SKUs`) + K('Distribution plan', fdmN(B.T.ds), `${plF(B.W.regions.length)} region(s)`) + K('Balance', (bal > 0 ? '+' : '') + fdmN(bal), bal < 0 ? 'more distributed than produced' : 'produced above distribution') + K('Distribution / production', B.T.p ? plF(B.T.ds / B.T.p * 100, 1) + '%' : '—', '') + K('Produced, not distributed', plF(B.G.reduce((a, o) => a + o.noDist, 0)), 'SKU-days') + K('Distributed, not produced', plF(B.G.reduce((a, o) => a + o.noProd, 0)), 'SKU-days (from stock)');
  const cols = [...lab.map(l => [l[0], 0]), ['Production plan', 1], ['Distribution', 1], ['Balance', 1], ['Distribution %', 1], ...(B.by === 'day' ? [['Cumulative balance', 1]] : [])];
  host.querySelector('thead').innerHTML = '<tr>' + cols.map(c => `<th class="${c[1] ? 'n' : ''}">${plEsc(c[0])}</th>`).join('') + '</tr>'; const sh = B.G.slice(0, fdm.pShown), cl = v => `style="color:${v < 0 ? '#d03b3b' : v > 0 ? '#0a7a0a' : ''}"`;
  host.querySelector('tbody').innerHTML = (sh.map(o => `<tr>${lab.map(l => `<td>${plEsc(l[1](o))}</td>`).join('')}<td class="n">${fdmQ(o.p)}</td><td class="n">${fdmQ(o.ds)}</td><td class="n" ${cl(o.p - o.ds)}>${fdmQ(o.p - o.ds)}</td><td class="n">${o.p ? plF(o.ds / o.p * 100, 0) + '%' : ''}</td>${B.by === 'day' ? `<td class="n" ${cl(o.cum)}>${fdmQ(o.cum)}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="pl-empty" style="padding:16px">Nothing to show.</td></tr>`) + (sh.length ? `<tr class="fd-tot"><td colspan="${lab.length}">Total</td><td class="n">${fdmQ(B.T.p)}</td><td class="n">${fdmQ(B.T.ds)}</td><td class="n">${fdmQ(bal)}</td><td class="n">${B.T.p ? plF(B.T.ds / B.T.p * 100, 0) + '%' : ''}</td>${B.by === 'day' ? '<td></td>' : ''}</tr>` : '');
  q('#fdmPMore').style.display = B.G.length > fdm.pShown ? '' : 'none'; q('#fdmPMore').textContent = `Show 200 more rows (${B.G.length - fdm.pShown} left)`;
}
function fdmProdData() {
  const B = fdmProdBuild(); if (!B) return { title: 'Production vs distribution', sheet: 'Production vs distribution', note: '', headers: [], rows: [] }; const lab = fdmProdLabels(B.by), n = v => +v.toFixed(2);
  return { title: 'F&D weekly plan — production vs distribution', sheet: 'Production vs distribution', note: `${B.W.weekStart} → ${B.W.weekEnd} · ${B.met}`, headers: [...lab.map(l => l[0]), 'Production plan', 'Distribution', 'Balance', 'Distribution %', ...(B.by === 'day' ? ['Cumulative balance'] : [])],
    rows: B.G.map(o => [...lab.map(l => l[1](o)), n(o.p), n(o.ds), n(o.p - o.ds), o.p ? Math.round(o.ds / o.p * 100) : '', ...(B.by === 'day' ? [n(o.cum)] : [])]), totals: ['TOTAL', ...lab.slice(1).map(() => ''), n(B.T.p), n(B.T.ds), n(B.T.p - B.T.ds), B.T.p ? Math.round(B.T.ds / B.T.p * 100) : '', ...(B.by === 'day' ? [''] : [])] };
}


/* ---------- production vs distribution — one row per SKU, one column per region ---------- */
function fdmRegBuild() {
  const cfg = fdmCfg(), W = fdm.weeks.find(w => w.weekStart === fdm.pW) || null; if (!W) return null; const D = fdm.dailies.find(s => s.planDate === fdm.dSel) || null, dBy = new Map(D ? D.rows.map(o => [o.code, o]) : []), q = fdm.pQ.trim().toLowerCase(), met = fdm.pMet, m = new Map(), ks = fdm.rDays.length ? fdm.rDays.map(d => W.days.indexOf(d)) : W.days.map((d, k) => k);
  W.items.forEach(i => { if (cfg.types[i.dtype || '(blank)'] === false) return; if (q && !(i.code + ' ' + i.item).toLowerCase().includes(q)) return; const sv = fdm.met; fdm.met = met; const f = fdmFactor(met, dBy.get(i.code), i); fdm.met = sv;
    let o = m.get(i.code); if (!o) m.set(i.code, o = { i, p: 0, r: W.regions.map(() => 0) }); ks.forEach(k => { if (k < 0) return; o.p += i.prod[k] * f; W.regions.forEach((r, x) => { o.r[x] += ((i.reg[r] || [])[k] || 0) * f; }); }); });
  let G = [...m.values()]; G.forEach(o => { o.ds = o.r.reduce((a, b) => a + b, 0); o.bal = o.p - o.ds; if (Math.abs(o.bal) < 0.005) o.bal = 0; }); if (fdm.rNZ) G = G.filter(o => o.p || o.ds); G.sort((a, b) => a.i.item.localeCompare(b.i.item, undefined, { numeric: true }));
  const T = { p: 0, r: W.regions.map(() => 0), ds: 0 }; G.forEach(o => { T.p += o.p; o.r.forEach((v, x) => { T.r[x] += v; }); T.ds += o.ds; }); return { W, G, T, met };
}
function fdmRegRender() {
  const q = PLQ, B = fdmRegBuild(), host = q('#fdmRTable'); q('#fdmRNZ').checked = fdm.rNZ;
  { const h = q('#fdmRDayHost'), days = B ? B.W.days : [], sig = days.join(',') + '|' + fdm.rDays.join(','); if (h.dataset.sig !== sig) { const lab = d => dpDayLong(d), map = new Map(days.map(d => [lab(d), d])); h.dataset.sig = sig; h.innerHTML = ''; h.appendChild(buildMultiCombo(fdm.rDays.map(lab), days.map(lab), a => { fdm.rDays = a.map(x => map.get(x)).filter(Boolean); h.dataset.sig = days.join(',') + '|' + fdm.rDays.join(','); fdm.rShown = 200; fdmRegRender(); }, { placeholder: 'Whole week' })); } }
  if (!B) { host.querySelector('thead').innerHTML = ''; host.querySelector('tbody').innerHTML = '<tr><td class="pl-empty" style="padding:18px">Upload and save a weekly plan first (Upload tab).</td></tr>'; q('#fdmRInfo').textContent = ''; q('#fdmRMore').style.display = 'none'; return; }
  q('#fdmRInfo').textContent = `— ${fdm.rDays.length ? fdm.rDays.map(dpDayLong).join(', ') : B.W.weekStart + ' → ' + B.W.weekEnd} · ${B.met} · ${plF(B.G.length)} SKU(s)`; const cs = v => `style="color:${v < 0 ? '#d03b3b' : v > 0 ? '#0a7a0a' : ''}"`;
  host.querySelector('thead').innerHTML = '<tr><th>ICODE</th><th>Item</th><th>UoM</th><th class="n">Production</th>' + B.W.regions.map(r => `<th class="n">${plEsc(r)}</th>`).join('') + '<th class="n">Total distribution</th><th class="n">Balance</th></tr>';
  const sh = B.G.slice(0, fdm.rShown), z = v => v ? fdmQ(v) : '<span style="color:var(--gray-400)">–</span>';
  host.querySelector('tbody').innerHTML = (sh.map(o => `<tr><td><b>${plEsc(o.i.code)}</b></td><td>${plEsc(o.i.item)}</td><td>${plEsc(o.i.uom)}</td><td class="n">${z(o.p)}</td>${o.r.map(v => `<td class="n">${z(v)}</td>`).join('')}<td class="n"><b>${z(o.ds)}</b></td><td class="n" ${cs(o.bal)}>${o.bal ? fdmQ(o.bal) : '–'}</td></tr>`).join('') || `<tr><td colspan="${B.W.regions.length + 6}" class="pl-empty" style="padding:16px">Nothing to show.</td></tr>`) + (sh.length ? `<tr class="fd-tot"><td colspan="3">Total</td><td class="n">${fdmQ(B.T.p)}</td>${B.T.r.map(v => `<td class="n">${fdmQ(v)}</td>`).join('')}<td class="n">${fdmQ(B.T.ds)}</td><td class="n" ${cs(B.T.p - B.T.ds)}>${fdmQ(B.T.p - B.T.ds)}</td></tr>` : '');
  q('#fdmRMore').style.display = B.G.length > fdm.rShown ? '' : 'none'; q('#fdmRMore').textContent = `Show 200 more rows (${B.G.length - fdm.rShown} left)`;
}
function fdmRegData() {
  const B = fdmRegBuild(); if (!B) return { title: 'Production vs distribution by region', sheet: 'Production by region', note: '', headers: [], rows: [] }; const n = v => +v.toFixed(2);
  return { title: 'F&D weekly plan — production vs distribution by region', sheet: 'Production by region', note: `${fdm.rDays.length ? fdm.rDays.join(', ') : B.W.weekStart + ' → ' + B.W.weekEnd} · ${B.met}`, headers: ['ICODE', 'Item', 'UoM', 'Production', ...B.W.regions, 'Total distribution', 'Balance'],
    rows: B.G.map(o => [o.i.code, o.i.item, o.i.uom, n(o.p), ...o.r.map(n), n(o.ds), n(o.bal)]), totals: ['TOTAL', '', '', n(B.T.p), ...B.T.r.map(n), n(B.T.ds), n(B.T.p - B.T.ds)] };
}

/* ---------- screen ---------- */
function fdmRender() {
  PLQ('#fdmTabs').innerHTML = FDM_TABS.map(t => `<button type="button" data-t="${t[0]}" class="${fdm.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('');
  document.querySelectorAll('#view-fddemand .fdm-pane').forEach(p => p.style.display = p.dataset.p === fdm.tab ? '' : 'none');
  if (fdm.tab === 'up') fdmLists(); else if (fdm.tab === 'setup') fdmSetupRender(); else if (fdm.tab === 'cmp') fdmCmpRender(); else { fdmProdRender(); fdmRegRender(); }
}
async function fdmOpen() { fdmInit(); await fdmReload(); fdmRender(); }
function fdmInit() {
  if (fdm.inited) return; fdm.inited = true; const q = PLQ; fdmCfg();
  const hook = (dz, fi, kind) => { dz.addEventListener('click', () => fi.click()); dz.addEventListener('keydown', e => { if (e.key === 'Enter') fi.click(); }); fi.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) fdmFile(f, kind); }); dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); }); dz.addEventListener('dragleave', () => dz.classList.remove('dragover')); dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); const f = e.dataTransfer.files[0]; if (f) fdmFile(f, kind); }); };
  hook(q('#fdmDropD'), q('#fdmFileD'), 'd'); hook(q('#fdmDropW'), q('#fdmFileW'), 'w');
  q('#fdmTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; fdm.tab = b.dataset.t; fdmRender(); });
  const root = q('#view-fddemand');
  root.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('#fdmSaveD')) return fdmSaveDaily(); if (t.closest('#fdmSaveW')) return fdmSaveWeekly();
    let b = t.closest('[data-dc]'); if (b) { fdm.dSel = b.dataset.dc; fdm.tab = 'cmp'; return fdmRender(); } b = t.closest('[data-dopen]'); if (b) { dpCfgSave({ sel: b.dataset.dopen }); fd.date = b.dataset.dopen; return plGo('fdplan'); }
    b = t.closest('[data-ddel]'); if (b) { if (!fdmCanUp() || !confirm(`Delete the daily plan ${b.dataset.ddel}? Quantities adjusted in F&D Plan for that date stay in this browser.`)) return; await dpDel(b.dataset.ddel); await fdmReload(); return fdmRender(); }
    b = t.closest('[data-wc]'); if (b) { fdm.wSel = b.dataset.wc; fdm.tab = 'cmp'; return fdmRender(); } b = t.closest('[data-wp]'); if (b) { fdm.pW = b.dataset.wp; fdm.tab = 'prod'; return fdmRender(); }
    b = t.closest('[data-wdel]'); if (b) { if (!fdmCanUp() || !confirm(`Delete the weekly plan starting ${b.dataset.wdel}?`)) return; await fwDel(b.dataset.wdel); await fdmReload(); return fdmRender(); }
    b = t.closest('[data-mdel]'); if (b) { fdmCfg().map.splice(+b.dataset.mdel, 1); fdmSave(); return fdmSetupRender(); }
    if (t.closest('#fdmMapAdd')) { fdmCfg().map.push({ loc: '', region: '', grp: '' }); fdmSave(); return fdmSetupRender(); }
    if (t.closest('#fdmSetupReset')) { if (!confirm('Restore the default location ↔ region links, demand types and tolerance?')) return; fdm.cfg = null; try { localStorage.removeItem(FDM_KEY); } catch (x) {} fdmCfg(); return fdmSetupRender(); }
    if (t.closest('#fdmCmpMore')) { fdm.shown += 200; return fdmCmpRender(); } if (t.closest('#fdmPMore')) { fdm.pShown += 200; return fdmProdRender(); } if (t.closest('#fdmRMore')) { fdm.rShown += 200; return fdmRegRender(); }
    if (t.closest('#fdmRExcel')) return a2Export(fdmRegData()); if (t.closest('#fdmRPrint')) return a2Print(fdmRegData()); if (t.closest('#fdmREmail')) return a2Mail(fdmRegData); if (t.closest('#fdmRExpand')) return fdExpandTables(q('#fdmRTable').parentElement, 'F&D Demand · Production vs distribution by region');
    if (t.closest('#fdmCmpExcel')) return a2Export(fdmCmpData()); if (t.closest('#fdmCmpPrint')) return a2Print(fdmCmpData()); if (t.closest('#fdmCmpEmail')) return a2Mail(fdmCmpData); if (t.closest('#fdmCmpExpand')) return fdExpandTables(q('#fdmCmpTable').parentElement, 'F&D Demand · Weekly vs daily vs actual');
    if (t.closest('#fdmPExcel')) return a2Export(fdmProdData()); if (t.closest('#fdmPPrint')) return a2Print(fdmProdData()); if (t.closest('#fdmPEmail')) return a2Mail(fdmProdData); if (t.closest('#fdmPExpand')) return fdExpandTables(q('#fdmPTable').parentElement, 'F&D Demand · Production vs distribution');
  });
  root.addEventListener('change', e => {
    const i = e.target, cfg = fdmCfg();
    if (i.dataset.mi !== undefined) { const m = cfg.map[+i.dataset.mi]; if (m) { m[i.dataset.f] = i.dataset.f === 'loc' ? i.value.trim().toUpperCase() : i.value.trim(); fdmSave(); } return; }
    if (i.dataset.ty) { cfg.types[i.dataset.ty] = i.checked; fdmSave(); return; } if (i.id === 'fdmTol') { cfg.tol = Math.max(0, +i.value || 0); fdmSave(); return; }
    if (i.id === 'fdmWSel') { fdm.wSel = i.value; fdm.shown = 200; fdmCmpRender(); } else if (i.id === 'fdmDSel') { fdm.dSel = i.value; fdm.day = ''; fdm.shown = 200; fdmCmpRender(); } else if (i.id === 'fdmDay') { fdm.day = i.value; fdm.shown = 200; fdmCmpRender(); }
    else if (i.id === 'fdmBy') { fdm.by = i.value; fdm.shown = 200; fdmCmpRender(); } else if (i.id === 'fdmMet') { fdm.met = i.value; fdmCmpRender(); } else if (i.id === 'fdmSort') { fdm.sort = i.value; fdmCmpRender(); } else if (i.id === 'fdmOnlyDiff') { fdm.onlyDiff = i.checked; fdm.shown = 200; fdmCmpRender(); }
    else if (i.id === 'fdmRNZ') { fdm.rNZ = i.checked; fdm.rShown = 200; fdmRegRender(); }
    else if (i.id === 'fdmPW') { fdm.pW = i.value; fdm.rDays = []; fdmProdRender(); fdmRegRender(); } else if (i.id === 'fdmPBy') { fdm.pBy = i.value; fdm.pShown = 200; fdmProdRender(); } else if (i.id === 'fdmPMet') { fdm.pMet = i.value; fdmProdRender(); fdmRegRender(); }
  });
  let tm; q('#fdmQ').addEventListener('input', e => { fdm.q = e.target.value; fdm.shown = 200; clearTimeout(tm); tm = setTimeout(fdmCmpRender, 200); }); q('#fdmPQ').addEventListener('input', e => { fdm.pQ = e.target.value; fdm.pShown = 200; fdm.rShown = 200; clearTimeout(tm); tm = setTimeout(() => { fdmProdRender(); fdmRegRender(); }, 200); });
}
document.querySelectorAll('.nav-item[data-view="fddemand"]').forEach(n => n.addEventListener('click', () => setTimeout(fdmOpen, 0)));



/* ============================================================
   MILCO DAILY PLANNING — DSO (MBYTO / WINIT) + good return + SharePoint stock → picking lists
   ============================================================ */
const MDP_KEY = LS_BASE + '_mdp_data', MDP_CFG = LS_BASE + '_mdp_cfg';
const mdp = { data: { demand: {}, gr: {} }, cfg: { stockList: '', itemList: '', smap: {}, imap: {}, stMap: {}, policy: 'seq', useGR: true, use: {}, basis: {} }, stock: null, raw: null, items: null, tab: 'import', ptab: 'actual', routes: [], rlab: new Map(), q: '', res: null, cols: { stock: [], item: [] }, pick: {} };
const MDP_TABS = [['import', '📥 1 · Import'], ['stock', '🏬 2 · Stock (SharePoint)'], ['demand', '🧾 3 · Demand'], ['pick', '📋 4 · Picking lists'], ['up', '☁ 5 · Upload to SharePoint'], ['open', '🔁 6 · Outstanding rounds']];
const MDP_PTABS = [['actual', 'A · Per route — actual stock'], ['transit', 'B · Remaining — in transit'], ['total', 'C · Total (actual + in transit)'], ['check', 'Stock check']];
const mdpNz = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const mdpCode = v => String(v == null ? '' : v).trim();
const mdpNum = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const mdpNat = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
function mdpLoad() {
  try { const d = JSON.parse(localStorage.getItem(MDP_KEY) || 'null'); if (d) mdp.data = { demand: d.demand || {}, gr: d.gr || {} }; } catch (e) {}
  try { const c = JSON.parse(localStorage.getItem(MDP_CFG) || 'null'); if (c) Object.assign(mdp.cfg, c); } catch (e) {}
}
function mdpSave() { try { localStorage.setItem(MDP_KEY, JSON.stringify(mdp.data)); } catch (e) { sectionToast('Browser storage is full — remove old imports.', 'warn'); } try { localStorage.setItem(MDP_CFG, JSON.stringify(mdp.cfg)); } catch (e) {} }
const mdpDate = v => { if (v instanceof Date && !isNaN(v)) return dpIso(v); const s = String(v || '').trim(); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0]; const d = new Date(s); return s && !isNaN(d) ? dpIso(d) : ''; };

/* ---------- reading the three file layouts ---------- */
function mdpParseRows(rows, fileName) {
  let hi = -1, H = null;
  for (let i = 0; i < Math.min(rows.length, 15); i++) { const n = (rows[i] || []).map(mdpNz); if ((n.includes('rtecode') && n.includes('itmcode')) || (n.includes('routecode') && n.includes('itemcode')) || (n.includes('itemdescription') && n.includes('quantity')) || (n.includes('prodcode') && n.length > 3 && rows[i].slice(2).some(v => v != null && String(v).trim()))) { hi = i; H = n; break; } }
  if (hi < 0) throw new Error('Layout not recognised — expected the MBYTO DSO, the WINIT DSO, the route matrix (Prod. Code + route columns) or the Good Return file.');
  const ix = (...names) => { for (const nm of names) { const i = H.findIndex(h => h === nm || (nm.length > 7 && h.startsWith(nm))); if (i >= 0) return i; } return -1; };
  const body = rows.slice(hi + 1);
  if (H.includes('prodcode')) {      // route matrix: Prod. Code | Product Name | V01 | V02 | ... (one column per route) — date + source taken from the file name, e.g. 25.10.2026_MT.xlsx
    const hdr = rows[hi], pc = H.indexOf('prodcode'), nc = H.findIndex(h => h === 'productname' || h === 'itemname' || h === 'description'), rc = [];
    hdr.forEach((h, j) => { if (j !== pc && j !== nc && h != null && String(h).trim()) rc.push([j, String(h).trim()]); });
    const fm = String(fileName || '').match(/(\d{1,2})[.\-_/](\d{1,2})[.\-_/](\d{4})/), d = fm ? `${fm[3]}-${fm[2].padStart(2, '0')}-${fm[1].padStart(2, '0')}` : dpIso(new Date());
    const sm = String(fileName || '').replace(/\.[^.]+$/, '').match(/\d{4}[_\- ]+([A-Za-z0-9]+)$/), src = sm ? sm[1].toUpperCase() : 'MATRIX';
    const s = { id: src + '|' + d, kind: 'demand', source: src, date: d, file: fileName, rows: new Map(), at: Date.now() };
    body.forEach(r => { const code = mdpCode(r[pc]); if (!code) return; rc.forEach(([j, route]) => { const q = mdpNum(r[j]); if (!(q > 0)) return; const k = route + '|' + code, o = s.rows.get(k) || { route, man: '', code, name: nc >= 0 ? String(r[nc] || '').trim() : '', p: 0, s: 0 }; o.p += q; s.rows.set(k, o); }); });
    if (!s.rows.size) throw new Error('No quantities found in the matrix file.');
    s.rows = [...s.rows.values()]; return [s];
  }
  if (H.includes('itemdescription') && !H.includes('routecode') && !H.includes('rtecode')) {      // good return
    const c = { code: ix('item'), desc: ix('itemdescription'), qty: ix('quantity'), uom: ix('uom'), date: ix('loaddate'), loc: ix('tolocation') }, g = new Map();
    body.forEach(r => { const code = mdpCode(r[c.code]), q = mdpNum(r[c.qty]); if (!code || !(q > 0)) return; const d = mdpDate(r[c.date]) || 'unknown', k = d; if (!g.has(k)) g.set(k, { id: 'GR|' + d, kind: 'gr', source: 'Good return', date: d, file: fileName, rows: new Map(), at: Date.now() }); const s = g.get(k), o = s.rows.get(code) || { code, desc: String(r[c.desc] || '').trim(), uom: String(r[c.uom] || '').trim(), qty: 0 }; o.qty += q; s.rows.set(code, o); });
    return [...g.values()].map(s => { s.rows = [...s.rows.values()]; return s; });
  }
  const mb = H.includes('rtecode'), c = mb ? { route: ix('rtecode'), man: ix('smncode'), code: ix('itmcode'), name: ix('itemname'), p: ix('planqtypuom'), s: ix('planqtysuom'), date: ix('loaddate') } : { route: ix('routecode'), man: ix('salesmancode'), code: ix('itemcode'), name: -1, p: ix('primaryqty'), s: ix('secondaryqty'), date: ix('movementdate') };
  const src = mb ? 'MBYTO' : 'WINIT', g = new Map();
  body.forEach(r => { const route = mdpCode(r[c.route]), code = mdpCode(r[c.code]); if (!route || !code) return; const d = mdpDate(r[c.date]) || 'unknown'; if (!g.has(d)) g.set(d, { id: src + '|' + d, kind: 'demand', source: src, date: d, file: fileName, rows: new Map(), at: Date.now() });
    const s = g.get(d), k = route + '|' + code, o = s.rows.get(k) || { route, man: mdpCode(r[c.man]), code, name: c.name >= 0 ? String(r[c.name] || '').trim() : '', p: 0, s: 0 }; o.p += mdpNum(r[c.p]); o.s += mdpNum(r[c.s]); s.rows.set(k, o); });
  return [...g.values()].map(s => { s.rows = [...s.rows.values()]; return s; });
}
async function mdpImport(files, expect) {
  const st = PLQ('#mdpImpStatus'); const msg = (t, c) => { st.className = 'status-msg ' + (c || 'info'); st.textContent = t; }; const out = [];
  for (const f of files) { try { msg('Reading ' + f.name + '…');
      if (typeof XLSX === 'undefined') throw new Error('The Excel library is not loaded (check the internet connection).');
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true }); const ws = wb.Sheets[wb.SheetNames[0]];
      const sets = mdpParseRows(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }), f.name);
      if (expect === 'gr' && sets.some(s => s.kind !== 'gr')) throw new Error('This is a demand file — drop it in the Daily Sales Order box.'); if (expect === 'demand' && sets.some(s => s.kind === 'gr')) throw new Error('This is a Good Return file — drop it in the Good Return box.');
      sets.forEach(s => { mdp.data[s.kind === 'gr' ? 'gr' : 'demand'][s.id] = s; if (mdp.cfg.use[s.id] == null) mdp.cfg.use[s.id] = true; if (s.kind === 'demand') { const sp = s.rows.reduce((a, r) => a + r.p, 0), ss = s.rows.reduce((a, r) => a + r.s, 0); mdp.cfg.basis[s.id] = sp > 0 && ss > 0 ? 'sum' : sp > 0 ? 'p' : 's'; } out.push(s); });
    } catch (e) { msg('✘ ' + f.name + ': ' + e.message, 'error'); mdpSave(); mdpRender(); return; } }
  mdpSave(); mdpRender(); msg(`✓ Imported ${out.map(s => `${s.source} ${s.date} (${s.rows.length} ${s.kind === 'gr' ? 'items' : 'lines'})`).join(', ')}.`, 'success');
  addActivity('upload', `Milco daily planning import: ${out.length} set(s)`);
}

/* ---------- allocation ---------- */
function mdpAlloc(ds, pool, pol) {
  const out = ds.map(() => 0), tot = ds.reduce((a, b) => a + b, 0); pool = Math.floor(pool + 1e-9); if (pool <= 0 || tot <= 0) return out; if (pool >= tot) return ds.slice();
  if (pol === 'prop') { let used = 0; const fr = []; ds.forEach((d, i) => { const e = d * pool / tot; out[i] = Math.floor(e); used += out[i]; fr.push([e - out[i], i]); }); fr.sort((a, b) => b[0] - a[0]); let left = pool - used; for (const [, i] of fr) { if (left <= 0) break; if (out[i] < ds[i]) { out[i]++; left--; } } return out; }
  let r = pool; ds.forEach((d, i) => { const t = Math.min(d, r); out[i] = t; r -= t; }); return out;
}
function mdpDescOf(code, fb) { const it = mdp.items && mdp.items.get(code), sk = mdp.stock && mdp.stock.get(code); return (it && it.desc) || (sk && sk.desc) || fb || ''; }
/* ---------- UoM dropdown on trip screens: options come from the "Loading_UoM" dropdown source (Dropdown sources), else its history ---------- */
/* Default UoM of the quantities IMPORTED in each area (admin, Settings). The system converts from it when a user picks another UoM: qty x factor(imported UoM) / factor(chosen UoM). */
const UOM_AREAS = [{ k: 'fd', label: 'F&D Plan (trips / trailers)', def: 'PLT' }, { k: 'mdp', label: 'Milco Daily Planning', def: '' }];
const UOM_AREA_KEY = LS_BASE + '_uom_area';
function uomAreaGet(k) { try { const o = JSON.parse(localStorage.getItem(UOM_AREA_KEY) || '{}'); if (o && o[k] != null) return o[k]; } catch (e) {} const a = UOM_AREAS.find(x => x.k === k); return a ? a.def : ''; }
function uomAreaSet(k, v) { try { const o = JSON.parse(localStorage.getItem(UOM_AREA_KEY) || '{}') || {}; o[k] = v; localStorage.setItem(UOM_AREA_KEY, JSON.stringify(o)); } catch (e) {} }
function uomAreaRender(host) {
  if (!host) return; const adm = typeof isAdmin === 'function' && isAdmin(), uoms = ['PC', 'CT', 'OT', 'PLT', 'BT', 'CRATE'];
  host.innerHTML = '<div class="card-title" style="font-size:13px;margin:12px 0 4px">📥 Default UoM of imported quantities <span class="hint">— per area (admin)</span></div><div class="text-sm" style="margin-bottom:6px">The UoM the quantities arrive in for each area. It is the starting UoM of the trip / route windows; when a user picks another UoM the system converts with the factors of the UoM list (e.g. F&amp;D in PLT, qty 2, user picks CTN and 1 PLT = 24 CTN → 48 CTN).' + (adm ? '' : ' <b style="color:#b45309">Only an administrator can change this.</b>') + '</div>'
    + UOM_AREAS.map(a => { const v = String(uomAreaGet(a.k) || '').toUpperCase(); return `<div style="display:flex;gap:10px;align-items:center;margin:4px 0"><span style="min-width:230px">${a.label}</span><select data-uarea="${a.k}" ${adm ? '' : 'disabled'} style="width:auto;margin:0">${a.def === '' ? `<option value="" ${v ? '' : 'selected'}>Auto — each item\'s own UoM from the file</option>` : ''}${uoms.map(u => `<option ${u === v ? 'selected' : ''}>${u}</option>`).join('')}</select></div>`; }).join('');
  host.querySelectorAll('select[data-uarea]').forEach(sel => sel.addEventListener('change', () => { if (!adm) return; uomAreaSet(sel.dataset.uarea, sel.value);
    try { if (sel.dataset.uarea === 'fd' && fd && fd.m) { fdRecalcQuiet(); if (fd.open) fdModalRefresh(fd.open); else fdRender(); } } catch (e) {} try { if (sel.dataset.uarea === 'mdp' && mdp && mdp.res) { mdpCompute(); mdpKpis(); mdpPick(true); if (mdp._rt) mdpRtRender(); } } catch (e) {}
    sectionToast('Default UoM saved — ' + sel.closest('div').firstChild.textContent + ': ' + (sel.value || 'Auto'), 'success'); }));
}
const uomOv = (code, fb) => { try { const o = JSON.parse(localStorage.getItem(profileKey('uomov')) || '{}'); return o[code] || fb; } catch (e) { return fb; } };
function uomSet(code, u) { try { const o = JSON.parse(localStorage.getItem(profileKey('uomov')) || '{}'); if (u) o[code] = u; else delete o[code]; localStorage.setItem(profileKey('uomov'), JSON.stringify(o)); } catch (e) {} }
function uomValues(cur) {
  let v = null; const A = ddAll();
  for (const ln of Object.keys(A)) { const sp = (A[ln] || {})['Loading_UoM']; if (sp && sp.mode !== 'auto') { if (sp.mode === 'list') ddListLoad(sp); v = ddValues(ln, 'Loading_UoM', []); break; } }
  if (!v || !v.length) v = ddValues('', 'Loading_UoM', []) || [];
  return ddUniq([cur, ...(v || [])].filter(Boolean));
}
/* Qty in the chosen UoM: pieces = qty x factor(original UoM); shown = pieces / factor(chosen UoM). Factors: the UOM conversion list (Warehouse page), else crates/pallets of the F&D line */
function uomFac(code, uom, l) {
  const u = wUomCanon(uom); if (!u || u === 'pc') return 1;
  let f = null; try { f = wUom_factor(code, uom); } catch (e) {}
  if (!(f > 0) && l && l.qty > 0) { if ((u === 'ct' || u === 'crate') && l.crt > 0) f = l.qty / l.crt; else if (u === 'plt' && l.pal > 0) f = l.qty / l.pal; }
  return f > 0 ? f : null;
}
function uomQtyCell(code, orig, cur, qty, l) {
  try { if (!wUomState.table.size && wUomState.listName && !wUomState._ld) { wUomState._ld = 1; wUom_loadFromList().then(() => { try { if (fd && fd.open) fdModalRefresh(fd.open); else if (mdp && mdp._rt) mdpRtRender(); } catch (e) {} }).catch(() => {}); } } catch (e) {}
  const c = cur || orig || '', o = orig || c;
  if (!c || wUomCanon(c) === wUomCanon(o)) return '<td class="n uomq">' + fdQnum(qty) + '</td>';
  const fo = uomFac(code, o, l), fc = uomFac(code, c, l);
  if (!fo || !fc) return '<td class="n uomq" title="No conversion factor for ' + escapeHtml(!fo ? o : c) + ' — load the UOM conversion list (Warehouse page)">—</td>';
  const v = qty * fo / fc;
  return '<td class="n uomq" title="' + escapeHtml(fdQnum(qty) + ' ' + o + ' = ' + (Math.round(v * 1000) / 1000) + ' ' + c) + '"><b>' + (Math.round(v * 100) / 100).toLocaleString() + '</b></td>';
}
/* Options for one item = the UoMs that item has a conversion factor for in the linked SharePoint UoM list (PC always). Items missing from the list fall back to the Loading_UoM dropdown source. */
function uomListOpts(code, c) {
  try {
    if (!wUomState.table.size) { if (wUomState.listName && !wUomState._ld) { wUomState._ld = 1; wUom_loadFromList().then(() => { try { uomRefreshTrips(); } catch (e) {} }).catch(() => {}); } return null; }
    const e = wUomState.table.get(wUomNorm(code)); if (!e) return null;
    const ks = ['pc', ...Array.from(e.factors.keys()).filter(k => k !== 'pc')]; if (c && !ks.includes(wUomCanon(c))) ks.push(wUomCanon(c));
    return ks.map(k => ({ k, t: (e.labels && e.labels.get(k)) || (k === wUomCanon(c) && c) || k.toUpperCase() }));
  } catch (x) { return null; }
}
function uomSel(code, cur) {
  const c = uomOv(code, cur || ''), lo = uomListOpts(code, c), cc = wUomCanon(c);
  const opts = lo ? lo.map(o => '<option value="' + escapeHtml(o.t) + '"' + (o.k === cc ? ' selected' : '') + '>' + escapeHtml(o.t) + '</option>').join('') : uomValues(c).map(x => '<option' + (x === c ? ' selected' : '') + '>' + escapeHtml(x) + '</option>').join('');
  return '<select class="uom-sel" data-uom="' + escapeHtml(code) + '" title="' + (lo ? 'Change the UoM (options from the SharePoint UoM conversion list)' : 'Change the UoM (options from the Loading_UoM dropdown source)') + '" style="min-width:64px">' + (c || lo ? '' : '<option value=""></option>') + opts + '</select>';
}
const mdpUomOrig = (code, fb) => (mdp._u0 || {})[code] || fb || '';
function mdpUomOf(code, fb) { const it = mdp.items && mdp.items.get(code), sk = mdp.stock && mdp.stock.get(code), b = uomAreaGet('mdp') || (it && it.uom) || (sk && sk.uom) || fb || ''; (mdp._u0 = mdp._u0 || {})[code] = b; return uomOv(code, b); }
function mdpCompute() {
  const kk0 = l => [l.route, l.src, l.date, l.code].join('|');
  const sets = Object.values(mdp.data.demand).filter(s => mdp.cfg.use[s.id] !== false), L = [];
  sets.forEach(s => { const b = mdp.cfg.basis[s.id] || 'sum'; s.rows.forEach(r => { const q = b === 'p' ? r.p : b === 's' ? r.s : r.p + r.s; if (q > 0) L.push({ route: r.route, src: s.source, date: s.date, code: r.code, name: r.name, req: q }); }); });
  const gr = new Map(); if (mdp.cfg.useGR) Object.values(mdp.data.gr).filter(s => mdp.cfg.use[s.id] !== false).forEach(s => s.rows.forEach(r => { const o = gr.get(r.code) || { qty: 0, desc: r.desc, uom: r.uom }; o.qty += r.qty; gr.set(r.code, o); }));
  if (mdp.cfg.useOpen !== false && mdp.open && mdp.open.rows) mdp.open.rows.forEach(o => { if (o.open && !(mdp.cfg.openOff || {})[o.id]) L.push({ route: o.route, src: 'Outstanding R' + ((o.round || 0) + 1), date: o.date, code: o.code, name: o.desc, req: o.out, open: o }); });
  { const kk = l => [l.route, l.src, l.date, l.code].join('|'), rm = mdp.cfg.rmL || {};
    (mdp.cfg.addL || []).forEach(a => { const ex = L.find(l => !l.open && kk(l) === kk(a)); if (ex) { ex.req += a.qty; ex.added = (ex.added || 0) + a.qty; } else L.push({ route: a.route, src: a.src, date: a.date, code: a.code, name: a.desc, req: a.qty, added: a.qty, uom: a.uom }); });
    for (let q = L.length - 1; q >= 0; q--) if (rm[kk(L[q])]) L.splice(q, 1); }
  { const M = mdpLgMaps(); mdp._lgStk = M.stk; if (M.dem.size) { L.forEach(l => { const k = kk0(l), d = M.dem.get(k); if (d > 0) { const t = Math.min(d, l.req); l.upl = t; l.req -= t; M.dem.set(k, d - t); } }); for (let q = L.length - 1; q >= 0; q--) if (L[q].upl && L[q].req <= 1e-9) L.splice(q, 1); } }
  const by = new Map(); L.forEach(l => { if (!by.has(l.code)) by.set(l.code, []); by.get(l.code).push(l); });
  const items = new Map(), lines = [], pol = mdp.cfg.policy;
  by.forEach((ls, code) => { ls.sort((a, b) => (a.open ? 0 : 1) - (b.open ? 0 : 1) || mdpNat(a.route, b.route) || a.src.localeCompare(b.src));
    const sk = mdp.stock && mdp.stock.get(code), g = gr.get(code), A = Math.max(0, (sk ? sk.a : 0) + (g ? g.qty : 0) - ((mdp._lgStk && mdp._lgStk.get(code)) || 0)), T = sk ? sk.t : 0, d = ls.map(l => l.req);
    const ovm = mdp.cfg.pickOv || {}, ks = ls.map(l => [l.route, l.src, l.date, code].join('|')), ovi = ks.map(k => ovm[k] != null ? Math.max(0, Number(ovm[k]) || 0) : null), ovSum = ovi.reduce((a, v) => a + (v || 0), 0);
    const pf = mdpAlloc(d.map((x, i) => ovi[i] == null ? x : 0), Math.max(0, A - ovSum), pol), pa = d.map((x, i) => ovi[i] != null ? ovi[i] : pf[i]), sh = d.map((x, i) => Math.max(0, x - pa[i])), pt = mdpAlloc(sh, T, pol);
    const fb = ls.find(l => l.name); const it = { code, desc: mdpDescOf(code, (fb && fb.name) || (g && g.desc)), uom: mdpUomOf(code, g && g.uom), req: d.reduce((a, b) => a + b, 0), spA: sk ? sk.a : 0, gr: g ? g.qty : 0, A, T, pa: 0, pt: 0, short: 0, known: !!sk, ovOver: ovSum > A + 1e-9 };
    ls.forEach((l, i) => { const x = { route: l.route, src: l.src, date: l.date, code, desc: it.desc, uom: it.uom, req: l.req, pa: pa[i], pt: pt[i], short: sh[i] - pt[i], open: l.open || null, key: ks[i], ov: ovi[i] != null, dem0: l.req + (l.upl || 0) - (l.added || 0), upl: l.upl || 0, added: l.added || 0 }; it.pa += x.pa; it.pt += x.pt; it.short += x.short; lines.push(x); }); items.set(code, it); });
  gr.forEach((g, code) => { if (!items.has(code)) items.set(code, { code, desc: mdpDescOf(code, g.desc), uom: mdpUomOf(code, g.uom), req: 0, spA: mdp.stock && mdp.stock.get(code) ? mdp.stock.get(code).a : 0, gr: g.qty, A: g.qty + (mdp.stock && mdp.stock.get(code) ? mdp.stock.get(code).a : 0), T: mdp.stock && mdp.stock.get(code) ? mdp.stock.get(code).t : 0, pa: 0, pt: 0, short: 0, known: true }); });
  const routes = [...new Map(lines.map(l => [l.route + '|' + l.src, { route: l.route, src: l.src, date: l.date }])).values()].sort((a, b) => mdpNat(a.route, b.route) || a.src.localeCompare(b.src));
  mdp.res = { lines, items, routes, noStock: !mdp.stock };
  return mdp.res;
}

/* ---------- rendering ---------- */
const mdpLgUp = () => { let s = 0; mdpLgMaps().dem.forEach(v => { s += v; }); return s; };
const mdpN = (v, d) => plF(v, d == null ? 0 : d);
function mdpKpis() {
  const r = mdp.res, T = r.lines.reduce((a, l) => ({ q: a.q + l.req, a: a.a + l.pa, t: a.t + l.pt, s: a.s + l.short }), { q: 0, a: 0, t: 0, s: 0 }), K = (l, v, s) => `<div class="pl-kpi"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`, pc = x => T.q ? mdpN(x / T.q * 100) + '%' : '—';
  PLQ('#mdpKpis').innerHTML = K('Routes', mdpN(r.routes.length), `${mdpN(r.lines.length)} route-item lines`) + K('Items', mdpN(new Set(r.lines.map(l => l.code)).size), 'distinct item codes') + K(mdpLgUp() ? 'Balance demand' : 'Required', mdpN(T.q), mdpLgUp() ? `${mdpN(T.q + mdpLgUp())} original − ${mdpN(mdpLgUp())} uploaded` : 'units in the selected DSO files') +
    K('From actual stock', mdpN(T.a), r.noStock ? 'stock not loaded yet' : pc(T.a) + ' of required') + K('From in transit', mdpN(T.t), pc(T.t) + ' of required') + K('Still short', mdpN(T.s), `${[...r.items.values()].filter(i => i.short > 0).length} item(s)`);
}
function mdpRender() {
  mdpCompute(); PLQ('#mdpTabs').innerHTML = MDP_TABS.map(t => `<button type="button" data-t="${t[0]}" class="${mdp.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('');
  document.querySelectorAll('#view-mdp .mdp-pane').forEach(p => p.style.display = p.dataset.p === mdp.tab ? '' : 'none'); mdpKpis(); mdpImpRender();
  if (mdp.tab === 'demand') mdpDemand(); if (mdp.tab === 'pick') mdpPick(); if (mdp.tab === 'up') mdpUpRender(); if (mdp.tab === 'open') mdpOpRender(); try { mdpSrcApply(); } catch (e) {}
}
function mdpImpRender() {
  const sets = [...Object.values(mdp.data.demand), ...Object.values(mdp.data.gr)].sort((a, b) => a.kind.localeCompare(b.kind) || a.date.localeCompare(b.date) || a.source.localeCompare(b.source));
  PLQ('#mdpImpBody').innerHTML = sets.map(s => { const d = s.kind === 'demand', sp = d ? s.rows.reduce((a, r) => a + r.p, 0) : s.rows.reduce((a, r) => a + r.qty, 0), ss = d ? s.rows.reduce((a, r) => a + r.s, 0) : 0, b = mdp.cfg.basis[s.id] || 'sum';
    return `<tr><td><input type="checkbox" data-use="${plEsc(s.id)}" ${mdp.cfg.use[s.id] !== false ? 'checked' : ''}></td><td>${d ? 'Demand (DSO)' : 'Good return'}</td><td><b>${plEsc(s.source)}</b></td><td>${plEsc(s.date)}</td><td>${plEsc(s.file)}</td><td class="n">${d ? new Set(s.rows.map(r => r.route)).size : '—'}</td><td class="n">${new Set(s.rows.map(r => r.code)).size}</td><td class="n">${mdpN(sp)}</td><td class="n">${d ? mdpN(ss) : '—'}</td>
    <td>${d ? `<select data-basis="${plEsc(s.id)}"><option value="sum" ${b === 'sum' ? 'selected' : ''}>Primary + secondary</option><option value="p" ${b === 'p' ? 'selected' : ''}>Primary only</option><option value="s" ${b === 's' ? 'selected' : ''}>Secondary only</option></select>` : 'Quantity'}</td><td><button class="ghost small" data-del="${plEsc(s.id)}" type="button">✖</button></td></tr>`; }).join('') || '<tr><td colspan="11" class="pl-empty">Nothing imported yet.</td></tr>';
}
function mdpDemData() {
  const r = mdp.res, rs = mdpRS(), q = mdp.q.trim().toLowerCase(), lines = r.lines.filter(l => (!rs || rs.has(l.route + '|' + l.src)) && mdpMatch(l, q)), routes = r.routes.filter(x => (!rs || rs.has(x.route + '|' + x.src)) && lines.some(l => l.route === x.route && l.src === x.src)); return { r: { lines, routes, items: r.items }, lines, routes };
}
function mdpDemand() {
  mdpRouteBuild('#mdpRouteHostD'); const D = mdpDemData(), r = D.r, host = PLQ('#mdpDemBody'), v = PLQ('#mdpDemView').value;
  if (!r.lines.length) { host.innerHTML = '<div class="pl-empty">No demand imported or selected.</div>'; return; }
  if (v === 'route') { const g = new Map(); r.lines.forEach(l => { const k = l.route + '|' + l.src; if (!g.has(k)) g.set(k, { route: l.route, src: l.src, date: l.date, n: 0, q: 0, a: 0, t: 0, s: 0 }); const x = g.get(k); x.n++; x.q += l.req; x.a += l.pa; x.t += l.pt; x.s += l.short; });
    host.innerHTML = `<div class="fd-wrap"><table class="fd-tbl"><thead><tr><th>Route</th><th>Source</th><th>Load date</th><th class="n">Items</th><th class="n">Required</th><th class="n">From actual</th><th class="n">From in transit</th><th class="n">Short</th></tr></thead><tbody>${r.routes.map(rt => { const x = g.get(rt.route + '|' + rt.src); return `<tr><td><b>${plEsc(x.route)}</b></td><td>${x.src}</td><td>${x.date}</td><td class="n">${x.n}</td><td class="n">${mdpN(x.q)}</td><td class="n">${mdpN(x.a)}</td><td class="n">${mdpN(x.t)}</td><td class="n">${x.s ? `<b style="color:#c0392b">${mdpN(x.s)}</b>` : 0}</td></tr>`; }).join('')}</tbody></table></div>`; return; }
  const rk = r.routes.map(x => x.route + '|' + x.src), m = new Map(); r.lines.forEach(l => { if (!m.has(l.code)) m.set(l.code, {}); m.get(l.code)[l.route + '|' + l.src] = l.req; });
  host.innerHTML = `<div class="fd-wrap" style="max-height:66vh"><table class="fd-tbl"><thead><tr><th>Item</th><th>Description</th>${r.routes.map(x => `<th class="n">${plEsc(x.route)}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>${[...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([c, o]) => `<tr><td>${plEsc(c)}</td><td>${plEsc(mdpDescOf(c, ''))}</td>${rk.map(k => `<td class="n">${o[k] ? mdpN(o[k]) : ''}</td>`).join('')}<td class="n"><b>${mdpN(Object.values(o).reduce((a, b) => a + b, 0))}</b></td></tr>`).join('')}</tbody></table></div>`;
}
const mdpMatch = (l, q) => !q || (l.code + ' ' + l.desc).toLowerCase().includes(q);
const mdpRS = () => { if (mdp.rtNone) return new Set(['\u0000none']); const s = new Set(mdp.routes.map(l => mdp.rlab.get(l)).filter(Boolean)); return s.size ? s : null; };
function mdpRouteBuild(sel) {
  const host = PLQ(sel); if (!host) return; const r = mdp.res; mdp.rlab = new Map(r.routes.map(x => [`${x.route} · ${x.src}`, x.route + '|' + x.src])); const opts = [...mdp.rlab.keys()]; mdp.routes = mdp.routes.filter(l => mdp.rlab.has(l));
  const sig = opts.join(',') + '|' + mdp.routes.join(','); if (host.dataset.sig === sig) return; host.dataset.sig = sig; host.innerHTML = '';
  host.appendChild(buildMultiCombo(mdp.routes, opts, arr => { mdp.rtNone = false; mdp.routes = arr; host.dataset.sig = opts.join(',') + '|' + arr.join(','); mdpRefreshBody(); mdpKpis(); }, { placeholder: 'All routes — type to search, pick one or more' }));
}
function mdpRefreshBody() { if (mdp.tab === 'demand') mdpDemand(); else if (mdp.tab === 'pick') mdpPick(true); else if (mdp.tab === 'up') mdpUpRender(); }
function mdpPickData() {
  const r = mdp.res, q = mdp.q.trim().toLowerCase(), rs = mdpRS(); return { q, rs, groups: r.routes.filter(x => (!rs || rs.has(x.route + '|' + x.src)) && (!mdp._onlyRt || mdp._onlyRt === x.route + '|' + x.src)).map(x => ({ x, ls: r.lines.filter(l => l.route === x.route && l.src === x.src && mdpMatch(l, q)) })) };
}
const mdpPq = l => { const it = mdp.res.items.get(l.code), over = it && it.ovOver && l.ov; return `<input type="number" class="mdp-pq${l.ov ? ' ed' : ''}${over ? ' over' : ''}" min="0" step="1" data-k="${plEsc(l.key)}" value="${l.pa}" title="${over ? 'The quantities you set are above the available stock of this item. ' : ''}${l.ov ? 'Set by you — ' : ''}change the picking qty; the other routes share what is left of the stock">${l.ov ? `<button type="button" class="mdp-pr" data-k="${plEsc(l.key)}" title="Back to the automatic quantity">↺</button>` : ''}`; };
/* routes overview: tick one, several or all routes — the lists, Excel and print below follow the selection */
function mdpRtGrid() {
  const host = PLQ('#mdpRtGrid'); if (!host) return; const r = mdp.res; if (!r || !r.lines.length) { host.innerHTML = ''; return; }
  const all = r.routes.map(x => `${x.route} · ${x.src}`), sel = mdp.rtNone ? new Set() : mdp.routes.length ? new Set(mdp.routes) : new Set(all), nSel = all.filter(l => sel.has(l)).length;
  const rows = r.routes.map((x, i) => { const ls = r.lines.filter(l => l.route === x.route && l.src === x.src), T = ls.reduce((a, l) => ({ q: a.q + l.req, a: a.a + l.pa, t: a.t + l.pt, s: a.s + l.short }), { q: 0, a: 0, t: 0, s: 0 }), lab = `${x.route} · ${x.src}`, key = x.route + '|' + x.src, pc = T.q ? Math.min(100, Math.round(T.a / T.q * 100)) : 0, lv = T.s > 0 ? ['bad', 'Short'] : T.t > 0 ? ['warn', 'Needs in transit'] : ['ok', 'Covered'];
    return `<tr data-rk="${plEsc(key)}" style="${sel.has(lab) ? '' : 'opacity:.55'}"><td><input type="checkbox" data-rsel="${plEsc(lab)}" ${sel.has(lab) ? 'checked' : ''} style="width:auto;margin:0"></td><td>${i + 1}</td><td><b>${plEsc(x.route)}</b></td><td>${plEsc(x.src)}</td><td>${plEsc(x.date)}</td><td class="n">${mdpN(ls.length)}</td><td class="n">${mdpN(T.q)}</td><td class="n">${mdpN(T.a)}</td><td><div style="display:flex;align-items:center;gap:6px;min-width:110px"><div style="flex:1;height:7px;background:#e6e9ef;border-radius:4px;overflow:hidden"><div style="width:${pc}%;height:100%;background:${T.s ? '#e0a100' : '#2f9e5f'}"></div></div><span class="text-sm">${pc}%</span></div></td><td class="n">${mdpN(T.t)}</td><td class="n">${T.s ? `<b style="color:#c0392b">${mdpN(T.s)}</b>` : ''}</td><td>${fdPill(lv[0], lv[1])}</td><td style="white-space:nowrap"><button type="button" class="ghost small" data-ritems="${plEsc(key)}">📋 Items</button> <button type="button" class="ghost small" data-rpick="${plEsc(key)}">🖨 Pick</button></td></tr>`; }).join('');
  host.innerHTML = `<div class="text-sm" style="margin:0 0 6px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><b>🚚 View by routes</b><span style="color:var(--gray-500)">tick one route, several routes or all — the picking lists, Excel and Print below follow your selection · ${nSel} of ${all.length} selected</span><button type="button" class="ghost small" data-hrt="1">${mdp.cfg.hideRt ? '▸ Show routes' : '▾ Hide routes'}</button><button type="button" class="ghost small" data-rall="1">☑ All</button><button type="button" class="ghost small" data-rnone="1">☐ None</button></div>
    ${mdp.cfg.hideRt ? '' : `<div class="fd-wrap" style="max-height:260px"><table class="fd-tbl"><thead><tr><th style="width:30px"><input type="checkbox" data-rhead="1" ${nSel === all.length ? 'checked' : ''} style="width:auto;margin:0" title="Select / clear all routes"></th><th>#</th><th>Route</th><th>Source</th><th>Date</th><th class="n">Lines</th><th class="n">Required</th><th class="n">Pick (actual)</th><th>Fill</th><th class="n">In transit</th><th class="n">Short</th><th>Result</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`}`;
}
function mdpRtSet(labs) { const all = mdp.res.routes.map(x => `${x.route} · ${x.src}`); const set = all.filter(l => labs.includes(l)); mdp.rtNone = set.length === 0; mdp.routes = set.length === all.length ? [] : set; mdpRouteBuild('#mdpRouteHost'); mdpRefreshBody(); mdpKpis(); }
function mdpRtPrint(key) { mdp._onlyRt = key; let h = ''; try { h = mdpDoc(); } catch (x) {} mdp._onlyRt = null; if (!h) { sectionToast('Nothing to print for this route.', 'warn'); return; } const no = npDocNo('PL'); fdPrintHtml(h.replace(/<section class="pg">/g, `<section class="pg" data-no="${no}">`), 'Milco picking list'); addActivity('export', 'Printed Milco picking list ' + no + ' · ' + key); }
function mdpPick(keep) {
  const r = mdp.res, host = PLQ('#mdpPickBody'); if (!keep) mdpRouteBuild('#mdpRouteHost');
  mdpRtGrid();
  PLQ('#mdpPickTabsHost').innerHTML = MDP_PTABS.map(t => `<button type="button" data-p="${t[0]}" class="${mdp.ptab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('');
  const warn0 = r.noStock ? '<div class="status-msg warn" style="display:block">⚠ The SharePoint stock has not been loaded — every item shows zero stock. Open “2 · Stock” and load it.</div>' : '', warn = mdp.cfg.hideNote && mdp.ptab === 'actual' ? '' : warn0;
  if (!r.lines.length) { host.innerHTML = warn + '<div class="pl-empty">No demand imported or selected.</div>'; return; }
  const D = mdpPickData(), hd = '<th>Item</th><th>Description</th><th>UoM</th>', hideN = !!mdp.cfg.hideNote;
  if (mdp.ptab === 'actual' || mdp.ptab === 'transit') {
    const tr = mdp.ptab === 'transit', nov = Object.keys(mdp.cfg.pickOv || {}).length, nover = [...r.items.values()].filter(i => i.ovOver).length;
    const bar = tr ? '' : `<div class="text-sm" style="margin:0 0 8px;display:flex;gap:14px;flex-wrap:wrap;align-items:center"><button type="button" class="ghost small" data-hnote="1" title="Hide / show the notes above the list">${hideN ? '▸ Show notes' + (r.noStock ? ' ⚠' : '') : '▾ Hide notes'}</button>${hideN ? '' : '<span>✏ <b>Pick (actual stock)</b> is editable — type the quantity to pick; the other routes share what is left of the stock.</span>'}<label style="display:inline-flex;gap:5px;align-items:center;margin:0"><input type="checkbox" id="mdpShowZ" ${mdp.showZero ? 'checked' : ''} style="width:auto;margin:0"> Show lines without stock</label>${nov ? `<button type="button" class="ghost small" data-pall="1">↺ Reset ${nov} adjustment(s)</button>` : ''}${nover ? `<span style="color:#c0392b">⚠ ${nover} item(s) picked above the available stock</span>` : ''}</div>`;
        const gh = D.groups.map(({ x, ls }) => { const rows = mdpOrdSort(x.route + '|' + x.src, ls).filter(l => tr ? l.req - l.pa > 0 : (l.pa > 0 || l.ov || (mdp.showZero && l.req > 0))); if (!rows.length) return ''; const tot = rows.reduce((a, l) => a + (tr ? l.pt : l.pa), 0), sh = rows.filter(l => l.short > 0).length;
      const rk = x.route + '|' + x.src, col = !!(mdp.cfg.colRt || {})[rk];
      return `<div class="fd-sub mdp-rt" data-rt="${plEsc(rk)}" style="cursor:pointer" title="Click to hide / show this route's table"><button type="button" class="ghost small" data-rcol="${plEsc(rk)}" style="padding:0 8px;margin:0 6px 0 0" title="Hide / show this table">${col ? '▸' : '▾'}</button><b>${plEsc(x.route)}</b> <button type="button" class="ghost small" data-ropen="${plEsc(rk)}" style="padding:0 8px;margin:0 2px;color:#1f4e79" title="Open the whole picking list of this route in its own window">🔎 open</button> · ${x.src} · ${plEsc(x.date)} — ${rows.length} line(s) · ${tr ? 'in-transit pick' : 'pick'} ${mdpN(tot)}${sh ? ` · <span style="color:#c0392b">${sh} short</span>` : ''}</div>${col ? '' : `<div class="fd-wrap" style="max-height:none"><table class="fd-tbl"><thead><tr>${hd}<th class="n">Required</th>${tr ? '<th class="n">Picked from actual</th><th class="n">Remaining</th><th class="n">Pick from in transit</th>' : '<th class="n">Pick (actual stock)</th>'}<th class="n">Short</th></tr></thead><tbody>${rows.map(l => `<tr><td>${plEsc(l.code)}</td><td>${plEsc(l.desc)}</td><td>${plEsc(l.uom)}</td><td class="n">${mdpN(l.req)}</td>${tr ? `<td class="n">${mdpN(l.pa)}</td><td class="n">${mdpN(l.req - l.pa)}</td><td class="n"><b>${mdpN(l.pt)}</b></td>` : `<td class="n">${mdpPq(l)}</td>`}<td class="n">${l.short ? `<b style="color:#c0392b">${mdpN(l.short)}</b>` : ''}</td></tr>`).join('')}</tbody></table></div>`}`; }).join(''), hl = !!mdp.cfg.hideLists, nr = (gh.match(/class="fd-sub mdp-rt"/g) || []).length;
    host.innerHTML = warn + bar + (gh ? `<div class="card" id="mdpListsBlock" style="margin:0 0 12px;padding:12px 14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;${hl ? '' : 'margin-bottom:10px;'}"><b>📋 ${tr ? 'In-transit picking lists' : 'Picking lists'} by route</b><span class="text-sm" style="color:var(--gray-500)">${nr} route(s)${hl ? '' : ' · click ▾ / ▸ beside a route to hide or show its table'}</span><span style="flex:1"></span>${hl ? '' : '<button type="button" class="ghost small" data-rcolall="1">▾ Expand all lists</button><button type="button" class="ghost small" data-rcolall="0">▸ Hide all lists</button>'}<button type="button" class="ghost small" data-hlist="1" title="Hide / show this whole section">${hl ? '▸ Show section' : '▾ Hide section'}</button></div>${hl ? '' : gh}</div>` : warn + '<div class="pl-empty">Nothing to pick for this selection.</div>'); return; }
  const q = D.q, its = [...r.items.values()].filter(i => mdpMatch(i, q) && (mdp.ptab === 'check' || (i.req > 0 && (!D.rs || r.lines.some(l => l.code === i.code && D.rs.has(l.route + '|' + l.src)))))).sort((a, b) => a.code.localeCompare(b.code));
  if (mdp.ptab === 'total') { const sum = f => its.reduce((a, i) => a + i[f], 0); host.innerHTML = warn + `<div class="fd-sub">Item totals for ${D.rs ? D.rs.size + ' selected route(s)' : 'all routes'} — actual and in-transit side by side.</div><div class="fd-wrap" style="max-height:66vh"><table class="fd-tbl"><thead><tr>${hd}<th class="n">Required</th><th class="n">Actual stock</th><th class="n">Pick — actual</th><th class="n">In-transit stock</th><th class="n">Pick — in transit</th><th class="n">Total pick</th><th class="n">Short</th></tr></thead><tbody>${its.map(i => { const ls = D.rs ? r.lines.filter(l => l.code === i.code && D.rs.has(l.route + '|' + l.src)) : null, v = ls ? ls.reduce((a, l) => ({ req: a.req + l.req, pa: a.pa + l.pa, pt: a.pt + l.pt, short: a.short + l.short }), { req: 0, pa: 0, pt: 0, short: 0 }) : i; return `<tr><td>${plEsc(i.code)}</td><td>${plEsc(i.desc)}</td><td>${plEsc(i.uom)}</td><td class="n">${mdpN(v.req)}</td><td class="n">${mdpN(i.A)}</td><td class="n"><b>${mdpN(v.pa)}</b></td><td class="n">${mdpN(i.T)}</td><td class="n"><b>${mdpN(v.pt)}</b></td><td class="n"><b>${mdpN(v.pa + v.pt)}</b></td><td class="n">${v.short ? `<b style="color:#c0392b">${mdpN(v.short)}</b>` : ''}</td></tr>`; }).join('')}
    <tr class="fd-tot"><td colspan="3">Total (${its.length} items)</td><td class="n">${mdpN(sum('req'))}</td><td class="n"></td><td class="n">${mdpN(sum('pa'))}</td><td class="n"></td><td class="n">${mdpN(sum('pt'))}</td><td class="n">${mdpN(sum('pa') + sum('pt'))}</td><td class="n">${mdpN(sum('short'))}</td></tr></tbody></table></div>`; return; }
  host.innerHTML = warn + `<div class="fd-wrap" style="max-height:66vh"><table class="fd-tbl"><thead><tr>${hd}<th class="n">Required</th><th class="n">SharePoint actual</th><th class="n">Good return</th><th class="n">Actual total</th><th class="n">In transit</th><th class="n">Balance after</th><th>Check</th></tr></thead><tbody>${its.map(i => { const bal = i.A + i.T - i.req, lv = !i.known && i.req > 0 ? ['bad', 'Not in stock list'] : bal < 0 ? ['bad', 'Short'] : i.A < i.req ? ['warn', 'Needs in transit'] : ['ok', 'Covered']; return `<tr><td>${plEsc(i.code)}</td><td>${plEsc(i.desc)}</td><td>${plEsc(i.uom)}</td><td class="n">${mdpN(i.req)}</td><td class="n">${mdpN(i.spA)}</td><td class="n">${mdpN(i.gr)}</td><td class="n">${mdpN(i.A)}</td><td class="n">${mdpN(i.T)}</td><td class="n">${mdpN(bal)}</td><td>${fdPill(lv[0], lv[1])}</td></tr>`; }).join('')}</tbody></table></div>`;
}
/* what is shown right now as one flat table (used by Email / Excel / Print of the filtered view) */
function mdpTable() {
  const dem = mdp.tab === 'demand', host = PLQ(dem ? '#mdpDemBody' : '#mdpPickBody'), grouped = !dem && (mdp.ptab === 'actual' || mdp.ptab === 'transit'), tabs = [...host.querySelectorAll('table')]; if (!tabs.length) return null;
  const val = t => { t = String(t).replace(/\s+/g, ' ').trim(); return /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(t) && !/^-?0\d/.test(t) ? Number(t.replace(/,/g, '')) : t; };
  let headers = null; const rows = [];
  tabs.forEach(t => { let hs = [...t.tHead.rows[0].cells].map(c => c.textContent.trim()); const drop = hs[0] === '#'; if (drop) hs = hs.slice(1); const sub = t.closest('.fd-wrap') && t.closest('.fd-wrap').previousElementSibling, g = grouped && sub ? sub.textContent.split(' — ')[0].trim() : '';
    if (!headers) headers = (grouped ? ['Route'] : []).concat(hs); [...t.tBodies[0].rows].forEach(tr => { if (tr.cells.length < 2) return; let cs = [...tr.cells].map(c => { const ip = c.querySelector('input.mdp-pq'); return val(ip ? ip.value : c.textContent); }); if (drop) cs = cs.slice(1); rows.push((grouped ? [g] : []).concat(cs)); }); });
  const rs = mdpRS(), nm = dem ? 'Milco demand by route' : 'Milco picking list — ' + ({ actual: 'A per route (actual stock)', transit: 'B remaining (in transit)', total: 'C total', check: 'stock check' }[mdp.ptab]);
  return { title: nm, sheet: 'List', headers, rows, note: `${rows.length} row(s) · ${rs ? 'Routes: ' + [...rs].map(x => x.replace('|', ' · ')).join(', ') : 'All routes'}${mdp.q ? ' · Search: ' + mdp.q : ''}` };
}
/* ---------- print + excel ---------- */
/* UoM chosen in the dropdown + quantities converted with the SharePoint UoM list factors (same maths as the "Qty in UoM" column) — used by print / Excel / email */
function mdpUc(code, fb) {
  const o = mdpUomOrig(code, fb) || fb || '', c = uomOv(code, fb || o) || o;
  if (!c || wUomCanon(c) === wUomCanon(o)) return { u: c || o, f: 1 };
  const fo = uomFac(code, o, null), fc = uomFac(code, c, null);
  return fo && fc ? { u: c, f: fo / fc } : { u: o, f: 1 };
}
const mdpQc = (v, f) => f === 1 ? mdpN(v) : (Math.round(v * f * 100) / 100).toLocaleString();
function mdpDoc() {
  const r = mdp.res, D = mdpPickData(), tr = mdp.ptab === 'transit', n = mdpN, ttl = { actual: 'PICKING LIST — ACTUAL STOCK', transit: 'PICKING LIST — REMAINING (IN TRANSIT)', total: 'TOTAL PICKING LIST', check: 'STOCK CHECK' }[mdp.ptab], th = h => `<th>${h}</th>`, thn = h => `<th class="n">${h}</th>`, who = escapeHtml((typeof currentUser !== 'undefined' && currentUser && (currentUser.displayName || currentUser.username)) || '');
  if (mdp.ptab === 'actual' || mdp.ptab === 'transit') return D.groups.map(({ x, ls }) => { const rows = mdpOrdSort(x.route + '|' + x.src, ls).filter(l => tr ? l.req - l.pa > 0 : (l.pa > 0 || l.ov)); if (!rows.length) return ''; const hasB = rows.some(l => mdpBatTxt(l.key));
    return `<section class="pg"><h1>${ttl}</h1><div class="sub">Route ${escapeHtml(x.route)} · ${x.src} · load date ${escapeHtml(x.date)}</div><div class="meta"><div><b>Route</b>${escapeHtml(x.route)}</div><div><b>Source</b>${x.src}</div><div><b>Prepared by</b>${who}</div></div><table><thead><tr>${th('#')}${th('Item')}${th('Description')}${th('UoM')}${hasB ? th('Batch · production · expiry') : ''}${thn('Required')}${tr ? thn('From actual') + thn('Remaining') + thn('Pick (in transit)') : thn('Pick')}${thn('Short')}${th('Picked')}</tr></thead><tbody>${rows.map((l, i) => { const U = mdpUc(l.code, l.uom), q = v => mdpQc(v, U.f); return `<tr><td>${i + 1}</td><td>${escapeHtml(l.code)}</td><td>${escapeHtml(l.desc)}</td><td>${escapeHtml(U.u)}</td>${hasB ? `<td>${escapeHtml(mdpBatTxt(l.key))}</td>` : ''}<td class="n">${q(l.req)}</td>${tr ? `<td class="n">${q(l.pa)}</td><td class="n">${q(l.req - l.pa)}</td><td class="n"><b>${q(l.pt)}</b></td>` : `<td class="n"><b>${q(l.pa)}</b></td>`}<td class="n">${l.short ? q(l.short) : ''}</td><td style="text-align:center"><span class="box"></span></td></tr>`; }).join('')}</tbody></table><div class="sig"><div>Picked by</div><div>Checked by</div><div>Loaded by (driver / salesman)</div></div></section>`; }).join('');
  const its = [...r.items.values()].filter(i => i.req > 0 && mdpMatch(i, D.q) && (!D.rs || r.lines.some(l => l.code === i.code && D.rs.has(l.route + '|' + l.src)))).sort((a, b) => a.code.localeCompare(b.code));
  return `<section class="pg"><h1>${ttl}</h1><div class="sub">${D.rs ? 'Routes ' + escapeHtml([...D.rs].map(x => x.replace('|', ' · ')).join(', ')) : 'All routes'}</div><table><thead><tr>${th('#')}${th('Item')}${th('Description')}${th('UoM')}${thn('Required')}${thn('Actual stock')}${thn('Pick — actual')}${thn('In-transit stock')}${thn('Pick — in transit')}${thn('Total pick')}${thn('Short')}</tr></thead><tbody>${its.map((i, k) => { const U = mdpUc(i.code, i.uom), q = v => mdpQc(v, U.f); return `<tr><td>${k + 1}</td><td>${escapeHtml(i.code)}</td><td>${escapeHtml(i.desc)}</td><td>${escapeHtml(U.u)}</td><td class="n">${q(i.req)}</td><td class="n">${q(i.A)}</td><td class="n">${q(i.pa)}</td><td class="n">${q(i.T)}</td><td class="n">${q(i.pt)}</td><td class="n"><b>${q(i.pa + i.pt)}</b></td><td class="n">${i.short ? q(i.short) : ''}</td></tr>`; }).join('')}</tbody></table></section>`;
}
function mdpWorkbook() {
  const r = mdp.res, wb = XLSX.utils.book_new(), add = (nm, a) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), nm), L = r.lines;
  add('A Route - actual', [['Route', 'Source', 'Load date', 'Item', 'Description', 'UoM', 'Required', 'Pick (actual stock)', 'Short after actual', 'Batches']].concat(L.filter(l => l.pa > 0 || l.ov).map(l => [l.route, l.src, l.date, l.code, l.desc, l.uom, l.req, l.pa, Math.max(0, l.req - l.pa), mdpBatTxt(l.key)])));
  add('B Remaining - in transit', [['Route', 'Source', 'Load date', 'Item', 'Description', 'UoM', 'Required', 'Picked from actual', 'Remaining', 'Pick (in transit)', 'Still short']].concat(L.filter(l => l.req - l.pa > 0).map(l => [l.route, l.src, l.date, l.code, l.desc, l.uom, l.req, l.pa, l.req - l.pa, l.pt, l.short])));
  add('C Total', [['Item', 'Description', 'UoM', 'Required', 'Actual stock', 'Pick actual', 'In-transit stock', 'Pick in transit', 'Total pick', 'Short']].concat([...r.items.values()].filter(i => i.req > 0).sort((a, b) => a.code.localeCompare(b.code)).map(i => [i.code, i.desc, i.uom, i.req, i.A, i.pa, i.T, i.pt, i.pa + i.pt, i.short])));
  add('Stock check', [['Item', 'Description', 'UoM', 'Required', 'SharePoint actual', 'Good return', 'Actual total', 'In transit']].concat([...r.items.values()].sort((a, b) => a.code.localeCompare(b.code)).map(i => [i.code, i.desc, i.uom, i.req, i.spA, i.gr, i.A, i.T]))); return wb;
}

/* ---------- one route's whole picking list in its own window (same editable quantities) ---------- */
const mdpBatTxt = k => ((mdp.cfg.bat || {})[k] || []).map(x => [x.b, x.p && 'P ' + x.p, x.e && 'E ' + x.e, x.q !== '' && x.q != null && '× ' + x.q].filter(Boolean).join(' · ')).filter(Boolean).join(' ; ');
function mdpItemPool() { const pool = new Map(); (mdp.items || new Map()).forEach((v, c) => pool.set(c, { code: c, desc: v.desc || '', uom: v.uom || '' })); (mdp.stock || new Map()).forEach((v, c) => { if (!pool.has(c)) pool.set(c, { code: c, desc: v.desc || '', uom: v.uom || '' }); }); ((mdp.res && mdp.res.lines) || []).forEach(l => { if (!pool.has(l.code)) pool.set(l.code, { code: l.code, desc: l.desc, uom: l.uom }); }); return [...pool.values()].sort((a, b) => a.code.localeCompare(b.code)); }
function mdpFindItem(txt) {
  txt = String(txt || '').trim(); if (!txt) return null; const low = txt.toLowerCase(), pool = mdpItemPool(); let hit = pool.filter(p => p.code.toLowerCase() === low); if (!hit.length) hit = pool.filter(p => (p.desc || '').toLowerCase() === low);
  if (!hit.length) { hit = pool.filter(p => (p.code + ' ' + p.desc).toLowerCase().includes(low)); if (hit.length !== 1) return hit.length ? 'many' : null; } return hit[0];
}
/* shared: drag-and-drop + ▲▼ re-ordering of item lines in a route / trip window (the printed lists follow the same order) */
function ordWire(m, o) {
  m.addEventListener('dragstart', e => { const h = e.target.closest && e.target.closest('[data-odrag]'); if (!h) return; o.drag = h.dataset.odrag; try { e.dataTransfer.setData('text/plain', o.drag); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} const tr = h.closest('tr'); if (tr) tr.style.opacity = '.45'; });
  m.addEventListener('dragend', () => { o.drag = null; m.querySelectorAll('tr[data-oc]').forEach(x => { x.style.opacity = ''; x.classList.remove('ord-up', 'ord-dn'); }); });
  m.addEventListener('dragover', e => { if (!o.drag) return; const tr = e.target.closest && e.target.closest('tr[data-oc]'); if (!tr) return; e.preventDefault(); const bb = tr.getBoundingClientRect(), up = e.clientY < bb.top + bb.height / 2; m.querySelectorAll('tr[data-oc]').forEach(x => x.classList.remove('ord-up', 'ord-dn')); tr.classList.add(up ? 'ord-up' : 'ord-dn'); });
  m.addEventListener('drop', e => { if (!o.drag) return; const tr = e.target.closest && e.target.closest('tr[data-oc]'); if (!tr) return; e.preventDefault(); const bb = tr.getBoundingClientRect(), up = e.clientY < bb.top + bb.height / 2, c = o.drag; o.drag = null; if (tr.dataset.oc !== c) o.move(c, tr.dataset.oc, up); o.redraw(); });
  m.addEventListener('click', e => { const mv = e.target.closest && e.target.closest('[data-omv]'); if (mv) { o.move(mv.dataset.oc, +mv.dataset.omv); o.redraw(); return; } if (e.target.closest && e.target.closest('[data-ordreset]')) { o.reset(); o.redraw(); } });
}
const ORD_CSS = '.ord-drag{cursor:grab;color:#94a3b8;font-size:16px;padding:0 4px;user-select:none}.ord-drag:hover{color:#1d4ed8}.ord-mv{padding:2px 6px;margin-right:2px;font-size:10px}tr.ord-up td{box-shadow:inset 0 3px 0 #2563eb}tr.ord-dn td{box-shadow:inset 0 -3px 0 #2563eb}';
(() => { const st = document.createElement('style'); st.textContent = ORD_CSS; document.head.appendChild(st); })();
const ordHandle = (c, n) => `${n ? `<span class="ord-n" style="display:inline-block;min-width:22px;text-align:right;color:#64748b;font-size:12px;font-weight:600;margin-right:4px">${n}</span>` : ''}<span class="ord-drag" draggable="true" data-odrag="${plEsc(c)}" title="Drag to re-order — the printed picking list follows this order">⠿</span> `;
const ordBtns = c => `<button type="button" class="ghost small ord-mv" data-omv="-1" data-oc="${plEsc(c)}" title="Move up">▲</button><button type="button" class="ghost small ord-mv" data-omv="1" data-oc="${plEsc(c)}" title="Move down">▼</button>`;
/* line order of a route: the user's own order (drag / ▲▼ in the route window), default = by item code. Edit window, print, Excel and email all follow it. */
function mdpOrdSort(key, ls) { const o = (mdp.cfg.ord || {})[key]; if (!o || !o.length) return ls.slice().sort((a, b) => a.code.localeCompare(b.code)); const ix = new Map(o.map((c, i) => [c, i])); return ls.slice().sort((a, b) => (ix.has(a.code) ? ix.get(a.code) : 1e9) - (ix.has(b.code) ? ix.get(b.code) : 1e9) || a.code.localeCompare(b.code)); }
function mdpOrdMove(key, code, to, before) { const d = mdpRtLines(key); if (!d) return; const cs = d.ls.map(l => l.code), i = cs.indexOf(code); if (i < 0) return; cs.splice(i, 1);
  let j = typeof to === 'number' ? Math.max(0, Math.min(cs.length, i + to)) : cs.indexOf(to); if (typeof to !== 'number') { if (j < 0) { cs.splice(i, 0, code); return; } if (!before) j++; } cs.splice(j, 0, code); (mdp.cfg.ord = mdp.cfg.ord || {})[key] = cs; mdpSave(); }
function mdpRtLines(key) { const r = mdp.res, x = r && r.routes.find(v => v.route + '|' + v.src === key); return x ? { x, ls: mdpOrdSort(key, r.lines.filter(l => l.route === x.route && l.src === x.src && l.req > 0)) } : null; }
function mdpRtData() {
  const d = mdpRtLines(mdp._rt); if (!d) return { title: 'Route', sheet: 'Route', note: '', headers: [], rows: [] };
  return { title: 'Picking list ' + d.x.route + ' · ' + d.x.date, sheet: d.x.route.slice(0, 28), note: `${d.x.src} · ${d.ls.length} line(s)`, headers: ['Item', 'Description', 'UoM', 'Demand', 'Pick (actual stock)', 'Balance (to transit)', 'Pick from in transit', 'Short', 'Batches'],
    rows: d.ls.map(l => { const U = mdpUc(l.code, l.uom), q = v => Math.round(v * U.f * 100) / 100; return [l.code, l.desc, U.u, q(l.dem0), q(l.pa), q(Math.max(0, l.req - l.pa)), q(l.pt), l.short ? q(l.short) : '', mdpBatTxt(l.key)]; }) };
}
function mdpRtOpen(key) {
  mdp._rt = key; let m = document.querySelector('#mdpRtModal');
  if (!m) { m = document.createElement('div'); m.id = 'mdpRtModal'; m.className = 'fd-modal fd-root'; document.body.appendChild(m); try { if (localStorage.getItem(LS_BASE + '_mdp_rtmax') === '1') m.classList.add('fd-max'); } catch (x) {}
    const redo = nx => { mdpCompute(); mdpKpis(); mdpPick(true); mdpRtRender(nx); }, bat = k => { mdp.cfg.bat = mdp.cfg.bat || {}; return mdp.cfg.bat[k] || (mdp.cfg.bat[k] = []); };
    m.addEventListener('keydown', e => { const t = e.target; if (t.id === 'mdpAddCode' || t.id === 'mdpAddQty') { if (e.key === 'Enter') { e.preventDefault(); m.querySelector('[data-addrt]').click(); } return; } if (!t.matches || !t.matches('input.mdp-pq')) return; if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { mdp._go = true; setTimeout(() => { mdp._go = false; }, 80); if (e.key === 'Enter') { e.preventDefault(); t.blur(); } } });
    m.addEventListener('input', e => { if (e.target.id !== 'tmFilter') return; const q = e.target.value.trim().toLowerCase(); m.querySelectorAll('.fd-tbl tbody tr').forEach(tr => { tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none'; }); });
    m.addEventListener('change', e => { const i = e.target;
      if (i.dataset && i.dataset.rk && i.dataset.bi !== undefined) { const k = i.dataset.rk, a = bat(k), bi = +i.dataset.bi, f = i.dataset.f, v = i.value.trim(); while (a.length <= bi) a.push({ b: '', p: '', e: '', q: '' }); a[bi][f] = f === 'q' ? (v === '' ? '' : Math.max(0, +v)) : v; if (!a.some(x => x.b || x.p || x.e || +x.q > 0)) delete mdp.cfg.bat[k]; mdpSave(); return; }
      if (i.dataset && i.dataset.uom) { uomSet(i.dataset.uom, i.value); redo(); return; }
      if (!i.classList || !i.classList.contains('mdp-pq')) return; const idx = [...m.querySelectorAll('input.mdp-pq')].indexOf(i), v = i.value.trim(); mdp.cfg.pickOv = mdp.cfg.pickOv || {};
      if (v === '') delete mdp.cfg.pickOv[i.dataset.k]; else mdp.cfg.pickOv[i.dataset.k] = Math.max(0, Math.round(Number(v) || 0)); mdpSave(); const go = mdp._go; mdp._go = false; redo(go ? idx + 1 : null); });
    ordWire(m, { move: (c, to, b) => mdpOrdMove(mdp._rt, c, to, b), reset: () => { delete (mdp.cfg.ord || {})[mdp._rt]; mdpSave(); }, redraw: () => mdpRtRender() });
    m.addEventListener('click', e => { const t = e.target; if (t === m || t.closest('[data-rtx]')) { m.style.display = 'none'; mdp._rt = null; return; } const b = t.closest('.mdp-pr'); if (b) { delete (mdp.cfg.pickOv || {})[b.dataset.k]; mdpSave(); redo(); return; }
      if (t.closest('[data-rtp]')) { mdpRtPrint(mdp._rt); return; }
      if (t.closest('[data-rtxl]')) { a2Export(mdpRtData()); return; } if (t.closest('[data-rtl]')) { a2Print(mdpRtData()); return; } if (t.closest('[data-rtm]')) { if (!mdpRtData().rows.length) { sectionToast('Nothing to email.', 'warn'); return; } a2Mail(mdpRtData); return; }
      if (t.closest('[data-rtmax]')) { const on = m.classList.toggle('fd-max'); try { localStorage.setItem(LS_BASE + '_mdp_rtmax', on ? '1' : '0'); } catch (x) {} t.closest('[data-rtmax]').textContent = on ? '⤡ Shrink' : '⤢ Expand'; return; }
      const ab = t.closest('[data-addb-r]'); if (ab) { const a = bat(ab.dataset.addbR); if (!a.length) a.push({ b: '', p: '', e: '', q: '' }); a.push({ b: '', p: '', e: '', q: '' }); mdpSave(); mdpRtRender(); return; }
      const db = t.closest('[data-delb][data-rk]'); if (db) { const k = db.dataset.rk, a = bat(k); a.splice(+db.dataset.delb, 1); if (!a.some(x => x.b || x.p || x.e || +x.q > 0)) delete mdp.cfg.bat[k]; mdpSave(); mdpRtRender(); return; }
      const df = t.closest('[data-resb-r]'); if (df) { delete (mdp.cfg.bat || {})[df.dataset.resbR]; mdpSave(); mdpRtRender(); return; }
      const rm = t.closest('[data-rmline]'); if (rm) { const k = rm.dataset.rmline, ln = (mdp.res.lines.find(l => l.key === k)) || {}; mdp.cfg.addL = (mdp.cfg.addL || []).filter(a => [a.route, a.src, a.date, a.code].join('|') !== k); if (ln.dem0 > 0) { mdp.cfg.rmL = mdp.cfg.rmL || {}; mdp.cfg.rmL[k] = 1; } delete (mdp.cfg.bat || {})[k]; delete (mdp.cfg.pickOv || {})[k]; mdpSave(); redo(); return; }
      if (t.closest('[data-restore]')) { const d = mdpRtLines(mdp._rt), pre = d ? [d.x.route, d.x.src, d.x.date].join('|') + '|' : ''; Object.keys(mdp.cfg.rmL || {}).forEach(k => { if (k.startsWith(pre)) delete mdp.cfg.rmL[k]; }); mdpSave(); redo(); return; }
      if (t.closest('[data-addrt]')) { const d = mdpRtLines(mdp._rt); if (!d) return; const ci = m.querySelector('#mdpAddCode'), qi = m.querySelector('#mdpAddQty'), it = mdpFindItem(ci.value), qty = Math.round(Number(qi.value) * 1e6) / 1e6;
        if (!it || it === 'many') { sectionToast(it === 'many' ? 'Several items match — type the full item code.' : 'Item not found — pick it from the list (code or description).', 'warn'); ci.focus(); return; } if (!(qty > 0)) { sectionToast('Enter a quantity above zero.', 'warn'); qi.focus(); return; }
        mdp.cfg.addL = mdp.cfg.addL || []; mdp.cfg.addL.push({ id: Date.now() + '' + Math.random().toString(36).slice(2, 5), route: d.x.route, src: d.x.src, date: d.x.date, code: it.code, desc: it.desc, uom: it.uom, qty }); const kk = [d.x.route, d.x.src, d.x.date, it.code].join('|'); if (mdp.cfg.rmL) delete mdp.cfg.rmL[kk]; mdpSave(); redo(); sectionToast(`Added ${it.code} × ${qty} to ${d.x.route}.`, 'success'); } }); }
  m.style.display = 'flex'; mdpRtRender();
}
function mdpRtRender(nx) {
  const m = document.querySelector('#mdpRtModal'); if (!m || !m.isConnected || m.style.display === 'none' || !mdp._rt || !mdp.res) return;
  const d = mdpRtLines(mdp._rt); if (!d) { m.style.display = 'none'; return; } const { x, ls } = d, flt = (m.querySelector('#tmFilter') || {}).value || '', body = m.querySelector('.tm-body'), top = body ? body.scrollTop : 0, mx = m.classList.contains('fd-max');
  const T = ls.reduce((a, l) => ({ q: a.q + l.req, a: a.a + l.pa, t: a.t + l.pt, b: a.b + Math.max(0, l.req - l.pa), s: a.s + l.short }), { q: 0, a: 0, t: 0, b: 0, s: 0 }), pc = T.q ? Math.min(100, T.a / T.q * 100) : 0, lv = T.s > 0 ? ['bad', 'Short'] : T.b > 0 ? ['warn', 'Needs in transit'] : ['ok', 'Covered'];
  const dt = x.date ? (() => { try { return dpDayLong(x.date); } catch (e) { return x.date; } })() : '', pre = [x.route, x.src, x.date].join('|') + '|', nrm = Object.keys(mdp.cfg.rmL || {}).filter(k => k.startsWith(pre)).length;
  const vs = l => { const df = l.pa - l.dem0; return Math.abs(df) < 1e-9 ? '' : l.dem0 === 0 ? '<span class="fd-tag add">Added</span>' : df > 0 ? `<span class="fd-tag add">+${mdpN(df)}</span>` : `<span class="fd-tag less">−${mdpN(-df)}</span>`; };
  const opts = mdpItemPool().slice(0, 6000).map(p => `<option value="${plEsc(p.code)}">${plEsc(p.desc)}</option>`).join('');
  m.innerHTML = `<div class="card"><div class="tm-head"><div class="tm-title"><div class="tm-ico">📋</div><div><h2>${plEsc(x.route)}</h2><div class="tm-sub">${plEsc(dt)} · ${plEsc(x.src)} · ${ls.length} line(s)</div></div></div>
    <div class="tm-acts"><button class="tm-b tm-menu" data-acm="1" type="button" title="All actions of this screen" aria-haspopup="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-3px"><path d="M4 6h16M4 12h16M4 18h16"/></svg> Actions</button><span class="tm-hid" style="display:none"><button class="tm-b" data-rtp="1" type="button">🖨 Picking list</button><button class="tm-b" data-uomcfg="1" type="button" title="Choose the SharePoint list that holds the UoM conversion values and map its fields">⚖ UoM list</button><span class="tm-sep"></span><button class="tm-b" data-rtxl="1" type="button">📊 Excel</button><button class="tm-b" data-rtm="1" type="button">✉ Email</button><button class="tm-b" data-rtl="1" type="button">🖨 Print list</button></span><button class="tm-b" data-rtmax="1" type="button" title="Full screen / normal size">${mx ? '⤡ Shrink' : '⤢ Expand'}</button><button class="tm-b tm-x" data-rtx="1" type="button" title="Close">✕ Close</button></div></div>
   <div class="tm-body"><div class="tm-kpis"><div class="tm-k"><span>Lines</span><b>${mdpN(ls.length)}</b></div><div class="tm-k"><span>Required</span><b>${mdpN(T.q)}</b></div><div class="tm-k"><span>Pick (actual)</span><b>${mdpN(T.a)} <small>/ ${mdpN(T.q)}</small></b><div class="bar"><i style="width:${pc.toFixed(0)}%"></i></div></div><div class="tm-k tr"><span>Balance → transit</span><b>${mdpN(T.b)}</b></div><div class="tm-k"><span>Pick (in transit)</span><b>${mdpN(T.t)}</b></div><div class="tm-k sh"><span>Short</span><b>${mdpN(T.s)}</b></div><div class="tm-k tm-chk"><span>Check</span><div>${fdPill(lv[0], lv[1])}</div></div></div>
    <div class="tm-card tm-items"><div class="tm-ih"><h3>Items &amp; batches</h3>${(mdp.cfg.ord || {})[mdp._rt] ? '<button type="button" class="ghost small" data-ordreset="1" title="Back to the order by item code">↺ Reset order</button>' : ''}<input id="tmFilter" type="search" placeholder="🔍 Filter items…" value="${plEsc(flt)}"></div>
     <details class="tm-help"><summary>How quantities and batches work</summary><div>The <b>actual quantity</b> starts from the stock available. Change it to what the store can supply — the other routes re-share what is left of the stock, and the <b>balance</b> (demand − pick) goes to the <b>In transit</b> area when you upload. A SKU can carry <b>several batches</b>: use ➕ and give each batch its quantity. Use <b>➕ Add an item</b> below for an item that is not in the demand, and ✖ to remove a line.</div></details>
     <div class="fd-wrap"><table class="fd-tbl"><thead><tr>${fdTh('# · ICODE')}${fdTh('Item')}${fdTh('UoM')}${fdTh('Demand', 1)}${fdTh('Actual qty')}${fdTh('Qty in UoM', 1)}${fdTh('vs plan')}${fdTh('Balance → transit', 1)}${fdTh('In transit', 1)}${fdTh('Short', 1)}${fdTh('Batches — batch no. · production · expiry · quantity')}${fdTh('')}</tr></thead><tbody>${ls.map((l, ix) => { const own = (mdp.cfg.bat || {})[l.key], blist = own && own.length ? own : [{}], k = plEsc(l.key);
       return `<tr data-oc="${plEsc(l.code)}"><td style="white-space:nowrap">${ordHandle(l.code, ix + 1)}${plEsc(l.code)}</td><td>${plEsc(l.desc)}</td><td>${uomSel(l.code, l.uom)}</td><td class="n">${mdpN(l.dem0)}</td><td style="min-width:92px">${mdpPq(l)}</td>${uomQtyCell(l.code, mdpUomOrig(l.code, l.uom), l.uom, l.pa, null)}<td>${vs(l)}</td><td class="n">${l.req - l.pa > 0 ? `<b style="color:#b45309">${mdpN(l.req - l.pa)}</b>` : ''}</td><td class="n">${l.pt ? mdpN(l.pt) : ''}</td><td class="n">${l.short ? `<b style="color:#c0392b">${mdpN(l.short)}</b>` : ''}</td><td>${fdBatCell(blist, `data-rk="${k}"`, `<button type="button" class="ghost small" data-addb-r="${k}">➕ Add batch</button>${own && own.length ? ` <button type="button" class="ghost small" data-resb-r="${k}" title="Clear the batches of this line">↺ clear</button>` : ''}`)}</td><td style="white-space:nowrap">${ordBtns(l.code)}<button type="button" class="ghost small" data-rmline="${k}" title="Remove this item from the route" style="color:#c0392b">✖</button></td></tr>`; }).join('')}</tbody></table></div></div></div>
   <div class="tm-foot fd-addbar"><b>➕ Add an item</b><input list="mdpAddList" id="mdpAddCode" placeholder="ICODE or item name" autocomplete="off"><datalist id="mdpAddList">${opts}</datalist><input type="number" id="mdpAddQty" min="0" step="any" placeholder="Quantity (units)"><button type="button" class="tm-add" data-addrt="1">Add item</button>${nrm ? `<button type="button" class="ghost small" data-restore="1">↺ Restore ${nrm} removed line(s)</button>` : ''}<span class="tm-note">Remove a line with ✖. Pick quantities and batches are saved on this computer.</span></div></div>`;
  const nb = m.querySelector('.tm-body'); if (nb) nb.scrollTop = top; if (flt) m.querySelector('#tmFilter').dispatchEvent(new Event('input', { bubbles: true })); if (nx != null) { const l = m.querySelectorAll('input.mdp-pq'); if (l[nx]) { l[nx].focus(); l[nx].select(); } }
}
