/* ---------- KPI strip ---------- */
const mwKpi = (l, v, s, c) => `<div class="pl-kpi"${c ? ` style="border-left:4px solid ${c}"` : ''}><div class="lbl">${plEsc(l)}</div><div class="val">${v}</div><div class="sub">${s || ''}</div></div>`;
const mwPct = (v, d) => v == null ? '—' : plF(v, d == null ? 1 : d) + '%';
function mwKpis(a) {
  const T = plT(), ok = a.otDiff == null ? null : a.otDiff <= 0, f = (v, d) => v == null ? '—' : plF(v, d);
  PLQ('#mwKpis').innerHTML = mwKpi('Productivity %', mwPct(a.prodPct, 0), a.prod != null ? `${plF(a.prod, 1)} per hour${a.tProd ? ` · target ${plF(a.tProd, 1)}` : ''}` : 'no hours', a.prodPct == null ? null : a.prodPct >= 100 ? T.good : a.prodPct >= 80 ? T.warn : T.crit)
    + mwKpi('Working volume', plF(a.vol), 'Ltrs / Kg')
    + mwKpi('Working hrs', plF(a.hrs, 1), `${plF(a.whN)} warehouse(s)`)
    + mwKpi('Working OT hrs', plF(a.ot, 1), `OT ${mwPct(a.otPct)} of working hrs${a.tOT != null ? ` · target ${mwPct(a.tOT)}` : ''}`)
    + mwKpi('Over time % vs target', a.otDiff == null ? '—' : (a.otDiff > 0 ? '▲ +' : '▼ ') + plF(a.otDiff, 1) + ' pp', a.otDiff == null ? 'no OT target' : ok ? '✔ within target' : '✖ above target', ok == null ? null : ok ? T.good : T.crit)
    + mwKpi('Over time % (relative)', a.otDiff2 == null ? '—' : (a.otDiff2 > 0 ? '+' : '') + plF(a.otDiff2, 0) + '%', 'difference ÷ OT target', ok == null ? null : ok ? T.good : T.crit)
    + mwKpi('Orders processed', plF(a.orders), `${plF(a.n)} daily record(s)`)
    + (a.bud != null ? mwKpi('Headcount', `${plF(a.act)} <span style="font-size:14px;font-weight:500;color:var(--gray-500)">/ ${plF(a.bud)}</span>`, `actual / budget · ${a.act - a.bud >= 0 ? '+' : ''}${plF(a.act - a.bud)}`, a.act > a.bud ? T.warn : null) : '')
    + mwKpi('Latest entry date', a.latest || '—', 'most recent record in the selection');
}
/* ---------- charts ---------- */
function mwGauge(host, ctx) {
  const T = plT(), a = ctx.all; if (!a || a.prod == null) return plEmpty(host, 'No working hours in the selection.');
  const W = Math.max(260, host.clientWidth || 320), H = plFullH(host, 230), cx = W / 2, cy = H - 52, r = Math.min(W / 2 - 26, H - 80), max = a.tProd || a.prod * 1.25 || 1, t = Math.max(0, Math.min(1, a.prod / max)), svg = plSvg(host, W, H);
  const P = f => { const th = Math.PI * (1 - f); return [cx + r * Math.cos(th), cy - r * Math.sin(th)]; }, [x1, y1] = P(t), col = a.prodPct == null ? T.series[0] : a.prodPct >= 100 ? T.good : a.prodPct >= 80 ? T.warn : T.crit;
  S('path', { d: `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`, fill: 'none', stroke: T.grid, 'stroke-width': 24 }, svg);
  if (t > 0) S('path', { d: `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x1} ${y1}`, fill: 'none', stroke: col, 'stroke-width': 24 }, svg);
  Tx(svg, cx - r, cy + 16, '0', { size: 10.5, fill: T.muted, anchor: 'middle' }); Tx(svg, cx + r, cy + 16, plF(max, 1), { size: 10.5, fill: T.muted, anchor: 'middle' }); if (a.tProd) Tx(svg, cx + r, cy + 30, 'target', { size: 10, fill: T.muted, anchor: 'middle' });
  Tx(svg, cx, cy - 14, plF(a.prod, 1), { size: 30, anchor: 'middle', fill: T.text, weight: 700 }); Tx(svg, cx, cy + 12, 'volume per working hour', { size: 11, anchor: 'middle', fill: T.muted });
  Tx(svg, cx, cy + 36, a.prodPct == null ? 'no target set' : `${a.prodPct >= 100 ? '✔ On target' : a.prodPct >= 80 ? '▲ Near target' : '✖ Below target'} · ${plF(a.prodPct, 0)}% of ${plF(a.tProd, 1)}`, { size: 12, anchor: 'middle', fill: T.text, weight: 600 });
  return { table: { headers: ['Measure', 'Value'], rows: [['Productivity (volume / hour)', a.prod], ['Target value', a.tProd == null ? '' : a.tProd], ['Productivity %', a.prodPct == null ? '' : a.prodPct], ['Working volume', a.vol], ['Hours used', mw.cfg.opt.hrs === 'all' ? a.hrs + a.ot : a.hrs]] } };
}
const mwCols = (host, ctx, series, pick, fmt, o) => {
  o = o || {}; const T = plT(), G = ctx.groups.filter(g => o.need ? o.need(g.a) : true); if (!G.length) return plEmpty(host, o.empty || 'No data for the current filters.');
  const cap = 30, L = G.length > cap ? G.slice().sort((x, y) => y.a.vol - x.a.vol).slice(0, cap).sort((x, y) => mdpNat(x.k, y.k)) : G;
  const sr = series.map((n, i) => ({ name: n, color: T.series[(o.col || [0, 1, 2, 3])[i]] }));
  plcCols(host, { cats: L.map(g => ({ label: g.k, vals: pick(g.a) })), series: sr, fmt, tickFmt: o.tickFmt || (v => plF(v)), height: o.h || 260, labelFn: sr.length === 1 || o.lab ? ((c, v) => v == null ? '' : fmt(v)) : null, labelAll: !!o.lab && sr.length > 1 });
  return { legend: sr.length > 1 ? sr.map(s => ({ name: s.name, c: s.color })) : null, table: { headers: ['Group', ...series], rows: L.map(g => [g.k, ...pick(g.a).map(v => v == null ? '' : v)]) } };
};
const MW_DEFS = [
  { id: 'gauge', title: 'Productivity', sub: 'working volume per hour against the target value', span: 's4', draw: (h, c) => mwGauge(h, c.rows) },
  { gf: 1, id: 'ot', title: 'Overtime', sub: 'OT % of working hours — target vs actual', span: 's4', draw: (h, c) => mwCols(h, c.rows, ['OT Target', 'OT Actual'], a => [a.tOT, a.otPct], v => v == null ? '—' : plF(v, 1) + '%', { tickFmt: v => plF(v, 0) + '%', lab: 1 }) },
  { gf: 1, id: 'hc', title: 'Headcount', sub: 'budget vs actual (Nr_TACCS_HC)', span: 's4', draw: (h, c) => (mw.cfg.by === 'day' || mw.cfg.by === 'month') ? plEmpty(h, 'Headcount is not dated — view by Area, Region or WHs.') : mwCols(h, c.rows, ['Budget', 'Actual'], a => [a.bud, a.act], v => plF(v), { need: a => a.bud != null, empty: 'Pick and map a WHs headcount list to see this chart.', lab: 1 }) },
  { gf: 1, id: 'hrs', title: 'Working Hrs / OT', sub: 'regular and overtime hours', span: 's6', draw: (h, c) => mwCols(h, c.rows, ['Working Hrs', 'Working OT Hrs'], a => [a.hrs, a.ot], v => plF(v, 1), { tickFmt: v => plF(v) }) },
  { gf: 1, id: 'orders', title: '# Orders', sub: 'orders processed', span: 's6', draw: (h, c) => mwCols(h, c.rows, ['Orders'], a => [a.orders], v => plF(v)) },
  { gf: 1, id: 'vol', title: 'Working Volume Ltrs / Kgs', sub: 'outbound + returns (inbound excluded)', span: 's4', draw: (h, c) => mwCols(h, c.rows, ['Working volume'], a => [a.vol], v => plF(v)) },
  { gf: 1, id: 'io', title: 'Volume Ltrs / Kgs In / Out', sub: 'working volume, outbound, inbound and returns', span: 's8', draw: (h, c) => mwCols(h, c.rows, ['Working volume', 'Outbound', 'Inbound', 'Returns'], a => [a.vol, a.out, a.inb, a.ret], v => plF(v)) }
];
/* ---------- table ---------- */
const MW_HEAD = ['Group', 'Records', 'Orders', 'Outbound', 'Inbound', 'Returns', 'Working volume', 'Working hrs', 'OT hrs', 'OT %', 'OT target %', 'OT diff (pp)', 'Productivity /hr', 'Target value', 'Productivity %', 'Budget HC', 'Actual HC'];
function mwTableData() {
  const r = (k, a) => [k, a.n, a.orders, a.out, a.inb, a.ret, a.vol, a.hrs, a.ot, a.otPct, a.tOT, a.otDiff, a.prod, a.tProd, a.prodPct, a.bud, a.act].map((v, i) => i && typeof v === 'number' ? Math.round(v * 100) / 100 : (v == null ? '' : v));
  const G = mw.ctx.groups, all = mw.ctx.all; return { title: 'Management Daily Report', note: mwFilterText(), sheet: 'Mngt Daily', headers: MW_HEAD, rows: G.map(g => r(g.k, g.a)), totals: all ? r('TOTAL', all) : null };
}
function mwTableRender() {
  const d = mwTableData(), t = PLQ('#mwTable'); PLQ('#mwTblSub').textContent = `— ${d.rows.length} group(s) · ${d.note}`;
  t.id = t.id || 'mwTable'; t.innerHTML = `<thead><tr>${d.headers.map((h, i) => `<th class="${i ? 'n' : ''}">${plEsc(h)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(x => `<tr>${x.map((v, i) => `<td class="${i ? 'n' : ''}">${plEsc(typeof v === 'number' ? plF(v, Math.abs(v) < 100 && v % 1 ? 1 : 0) : v)}</td>`).join('')}</tr>`).join('')}${d.totals ? `<tr class="t">${d.totals.map((v, i) => `<td class="${i ? 'n' : ''}"><b>${plEsc(typeof v === 'number' ? plF(v, Math.abs(v) < 100 && v % 1 ? 1 : 0) : v)}</b></td>`).join('')}</tr>` : ''}</tbody>`; try { tblColFilters(t); } catch (e) { console.error(e); }
}

/* ---------- missing reports: which warehouses did not report, on which days ---------- */
const MWM_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function mwMissCalc() {
  const f = mw.f, ds = mw.rows.map(r => r.date).sort(); if (!ds.length) return null;
  const from = f.from || ds[0], to = f.to || ds[ds.length - 1]; if (from > to) return null;
  const opt = { ign: PLQ('#mwMissIgn').checked, fri: PLQ('#mwMissFri').checked, all: PLQ('#mwMissAll').checked, q: (PLQ('#mwMissQ').value || '').trim().toLowerCase() };
  const cal = []; for (let d = new Date(from + 'T00:00:00'), n = 0; dpIso(d) <= to && n < 800; d.setDate(d.getDate() + 1), n++) cal.push(dpIso(d));
  const inRange = mw.rows.filter(r => r.date >= from && r.date <= to), anyDay = new Set(inRange.map(r => r.date));
  const days = cal.filter(d => (!opt.ign || anyDay.has(d)) && !(opt.fri && new Date(d + 'T00:00:00').getDay() === 5));
  const uni = new Map(); mw.rows.forEach(r => { if (!r.wh) return; const o = uni.get(r.wh) || { wh: r.wh, area: '', region: '', last: '' }; if (r.date >= o.last) { o.last = r.date; o.area = r.area || o.area; o.region = r.region || o.region; } uni.set(r.wh, o); });
  const rep = new Map(); inRange.forEach(r => { let st = rep.get(r.wh); if (!st) rep.set(r.wh, st = new Set()); st.add(r.date); });
  const yr = from.slice(0, 4) !== to.slice(0, 4), fmt = d => d.slice(8) + ' ' + MWM_MON[+d.slice(5, 7) - 1] + (yr ? ' ' + d.slice(2, 4) : '');
  const rows = []; uni.forEach(o => {
    if ((f.area.length && !f.area.includes(o.area)) || (f.region.length && !f.region.includes(o.region)) || (f.wh.length && !f.wh.includes(o.wh))) return;
    const st = rep.get(o.wh) || new Set(), miss = days.filter(d => !st.has(d)); if (!miss.length && !opt.all) return;
    if (opt.q && !(o.wh + ' ' + o.area + ' ' + o.region).toLowerCase().includes(opt.q)) return;
    const idx = new Map(days.map((d, i) => [d, i])), rg = []; let a = null, b = null; miss.forEach(d => { const i = idx.get(d); if (a === null) { a = b = d; b = d; } else if (i === idx.get(b) + 1) b = d; else { rg.push([a, b]); a = b = d; } }); if (a !== null) rg.push([a, b]);
    const txt = rg.map(([x, y]) => x === y ? fmt(x) : (idx.get(y) - idx.get(x) + 1 > 2 ? fmt(x) + ' → ' + fmt(y) + ' (' + (idx.get(y) - idx.get(x) + 1) + ' d)' : fmt(x) + ', ' + fmt(y))).join(' · ');
    rows.push({ wh: o.wh, area: o.area, region: o.region, exp: days.length, rep: days.length - miss.length, miss, last: [...st].sort().pop() || '', everLast: o.last, txt });
  });
  rows.sort((x, y) => y.miss.length - x.miss.length || x.wh.localeCompare(y.wh));
  return { from, to, days, rows, fmt, whTotal: [...uni.values()].filter(o => (!f.area.length || f.area.includes(o.area)) && (!f.region.length || f.region.includes(o.region)) && (!f.wh.length || f.wh.includes(o.wh))).length };
}
function mwMissData(noF) {
  const m = mwMissCalc(); if (!m) return { title: 'Management Daily Report — missing reports', sheet: 'Missing reports', note: '', headers: [], rows: [] };
  const pct = r => r.exp ? Math.round(r.rep / r.exp * 1000) / 10 : '';
  return { title: 'Management Daily Report — missing reports', sheet: 'Missing reports', note: `${m.from} → ${m.to} · ${m.days.length} day(s) counted · ${m.rows.filter(r => r.miss.length).length} warehouse(s) with missing days${mwFilterText ? ' · ' + mwFilterText() : ''}`,
    headers: ['WHs', 'Area', 'Regions', 'Days expected', 'Days reported', 'Days missing', 'Compliance %', 'Last report', 'Missing dates'],
    rows: m.rows.filter(r => noF || tcfRowOk('mwMissTable', [r.wh, r.area, r.region, r.exp, r.rep, r.miss.length, pct(r) === '' ? '' : pct(r) + '%', r.last || r.everLast || '—', r.txt || '—'])).map(r => [r.wh, r.area, r.region, r.exp, r.rep, r.miss.length, pct(r), r.last || r.everLast || '—', r.txt || '—']), detail: m.rows.filter(r => noF || tcfRowOk('mwMissTable', [r.wh, r.area, r.region, r.exp, r.rep, r.miss.length, pct(r) === '' ? '' : pct(r) + '%', r.last || r.everLast || '—', r.txt || '—'])).flatMap(r => r.miss.map(d => [r.wh, r.area, r.region, d, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T00:00:00').getDay()]])) };
}
function mwMissRender() {
  const t = PLQ('#mwMissTable'), kp = PLQ('#mwMissKpi'); if (!t) return; const m = mwMissCalc();
  if (!m) { t.innerHTML = ''; kp.innerHTML = ''; PLQ('#mwMissSub').textContent = ''; return; }
  const d = mwMissData(true), bad = m.rows.filter(r => r.miss.length), tot = bad.reduce((a, r) => a + r.miss.length, 0), worst = bad[0];
  PLQ('#mwMissSub').textContent = `— ${m.from} → ${m.to} · ${m.days.length} day(s) counted`;
  kp.innerHTML = `<div class="mgm-k ${bad.length ? 'bad' : 'ok'}"><b>${bad.length}</b><span>of ${m.whTotal} warehouse(s) with missing reports</span></div><div class="mgm-k"><b>${tot}</b><span>missing warehouse-days</span></div>${worst ? `<div class="mgm-k"><b>${plEsc(worst.wh)}</b><span>most missing · ${worst.miss.length} of ${worst.exp} days</span></div>` : ''}${bad.length ? '' : '<div class="mgm-k ok" style="flex:2"><b>✅ All reported</b><span>every warehouse reported on every counted day</span></div>'}`;
  t.innerHTML = d.rows.length ? `<thead><tr>${d.headers.map((h, i) => `<th class="${i >= 3 && i <= 6 ? 'n' : ''}">${plEsc(h)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r => `<tr><td><b>${plEsc(r[0])}</b></td><td>${plEsc(r[1])}</td><td>${plEsc(r[2])}</td><td class="n">${r[3]}</td><td class="n">${r[4]}</td><td class="n">${r[5] ? `<span class="mgm-chip">${r[5]}</span>` : '0'}</td><td class="n">${r[6] === '' ? '' : r[6] + '%'}</td><td>${plEsc(r[7])}</td><td class="mgm-dates">${plEsc(r[8])}</td></tr>`).join('')}</tbody>` : `<tbody><tr><td style="padding:14px;color:var(--gray-600)">No warehouse matches — nothing is missing for this selection.</td></tr></tbody>`;
  if (d.rows.length) tblColFilters(t); const sb = PLQ('#mwMissSub'); if (sb && !sb.querySelector('.tcf-count')) { const sp = document.createElement('span'); sp.className = 'tcf-count'; sb.appendChild(sp); } tcfApply(t);
}
(function () {   // wiring for the missing-reports card
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#mwMissCard [data-m]'); if (!b) return; const d = mwMissData(), k = b.dataset.m;
    if (!d.rows.length) { sectionToast('Nothing missing for this selection — nothing to ' + (k === 'email' ? 'email' : k === 'excel' ? 'export' : k === 'print' ? 'print' : 'expand') + '.', 'info'); return; }
    if (k === 'excel') { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.headers, ...d.rows]), 'Missing summary'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['WHs', 'Area', 'Regions', 'Missing date', 'Weekday'], ...d.detail]), 'Missing days'); XLSX.writeFile(wb, 'Missing_reports_' + mwMissCalc().from + '_' + mwMissCalc().to + '.xlsx'); addActivity('export', d.title); }
    else if (k === 'print') a2Print(d); else if (k === 'email') a2Mail(mwMissData); else a2Expand(d); });
  const rd = () => { if (document.querySelector('#view-mgw.active') && mw.rows.length) mwMissRender(); };
  document.addEventListener('change', e => { if (e.target.closest && e.target.closest('.mg-missbar')) rd(); });
  document.addEventListener('input', e => { if (e.target.id === 'mwMissQ') rd(); });
})();
/* ---------- measures panel ---------- */
function mwDefsRender() {
  const o = mw.cfg.opt, inc = [o.out && 'Outbound', o.inb && 'Inbound', o.ret && 'Returns'].filter(Boolean).join(' + ') || '(nothing ticked)', hb = o.hrs === 'all' ? 'Working Hrs + Working OT Hrs' : 'Working Hrs (already includes OT)';
  const D = [['Working Volume', mw.cfg.map.daily.vol && mw.cfg.map.daily.vol !== SKIP_VALUE ? 'Sum of the mapped Working Volume column' : `Sum of ${inc}`], ['WorkingHrs', 'Normal Working Hours + Normal Overtime Hours + Week-Off OT + Public_OT'], ['WorkingOTHrs', 'Normal Overtime Hours + Week-Off OT + Public_OT (the overtime part of WorkingHrs)'],
    ['Prod_Value (Productivity)', `Working Volume ÷ (${hb})  — volume per working hour`], ['Target Value', `Targets list lookup that depends on the slicers — Area only: Area_Desc, Region_Code and WHs_Code all = the Area. Area + Regions: Area_Desc = Area, Region_Code = Region, WHs_Code = Region. + WHs Desc: Area_Desc = Area, Region_Code = Region, WHs_Code = WHs Desc. ${o.tAgg === 'sum' ? 'Summed' : 'Averaged'} when several rows match. With no slicer set: the targets of every warehouse that has records.`], ['ProdOverAll (Productivity %)', 'Prod_Value ÷ Target Value × 100'],
    ['AvrgOT (OT Actual)', 'WorkingOTHrs ÷ WorkingHrs × 100  (OT share of all hours worked)'], ['TargetOT', 'TargetOT of the same matched rows, averaged'], ['OTDiff (Over Time %)', 'OT Actual − OT Target, in percentage points'], ['OTDiff_2 (Over Time %)', '(OT Actual − OT Target) ÷ OT Target × 100'],
    ['Budget_HC / Nr_TACCS_HC', 'Sum over the warehouses that have records in the selection (headcount is not dated)'], ['Latest Entry_Date', 'Latest Entry_Date in the selection']];
  PLQ('#mwDefs').innerHTML = D.map(([a, b]) => `<tr><td><strong>${plEsc(a)}</strong></td><td>${plEsc(b)}</td></tr>`).join('');
}
/* ---------- filters + refresh ---------- */
/* connected dropdowns: each list only offers the values that still exist under the other selections (and the date range) */
const MW_FK = [['area', 'Area (Region_Desc)'], ['region', 'Regions (BU_Decs)'], ['wh', 'WHs Desc']];
function mwOptions(k) { const f = mw.f; return [...new Set(mw.rows.filter(r => (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && MW_FK.every(([x]) => x === k || !f[x].length || f[x].includes(r[x]))).map(r => r[k]).filter(Boolean))].sort(mdpNat); }
function mwPrune() { for (let i = 0; i < 3; i++) MW_FK.forEach(([k]) => { if (mw.f[k].length) { const ok = new Set(mwOptions(k)); mw.f[k] = mw.f[k].filter(v => ok.has(v)); } }); }
function mwFilterUi(except) {
  const host = PLQ('#mwFHost'), sig = mw.rows.length + '|' + mw.loaded; if (host.dataset.sig !== sig) { host.dataset.sig = sig; host.innerHTML = ''; }
  MW_FK.forEach(([k, l]) => { let w = host.querySelector(`[data-k="${k}"]`); if (!w) { w = document.createElement('div'); w.className = 'ro-cf'; w.dataset.k = k; w.innerHTML = `<label>${plEsc(l)}</label>`; host.appendChild(w); } if (k === except) return;
    const old = w.querySelector('.combo'); if (old) old.remove(); const vals = mwOptions(k); w.appendChild(buildMultiCombo(mw.f[k].filter(v => vals.includes(v)), vals, arr => { mw.f[k] = arr; mwPrune(); mwFilterUi(k); mwRenderReport(); }, { placeholder: 'All' })); });
}
function mwRenderReport() {
  const pane = PLQ('#view-mgw .mg-pane[data-p="rep"]'); if (!pane) return;
  if (!mw.rows.length) { PLQ('#mwKpis').innerHTML = `<div class="pl-empty" style="grid-column:1/-1">${mwSetupOk() ? 'No report data yet — open <strong>🔌 Lists &amp; mapping</strong>, pick the lists and click <strong>Load report data</strong>.' : (mw.cfg.list.daily ? 'No report data yet — press <strong>Refresh</strong> to load it.' : 'The administrator has not set up the report lists yet.')}</div>`; PLQ('#mwGrid').innerHTML = ''; PLQ('#mwTable').innerHTML = ''; return; }
  if (document.querySelector('#mwFHost').dataset.sig !== mw.rows.length + '|' + mw.loaded) mwFilterUi(); PLQ('#mwFrom').value = mw.f.from; PLQ('#mwTo').value = mw.f.to; PLQ('#mwBy').value = mw.cfg.by;
  const rows = mwView(), T = mwTargets(), WM = mwWhsMap(); mw.ctx = { groups: mwGroups(rows, T, WM), all: mwAgg(rows, T, WM, { area: mw.f.area, region: mw.f.region, wh: mw.f.wh }) };
  mwKpis(mw.ctx.all); atDrawGrid(PLQ('#mwGrid'), MW_DEFS, { rows: () => mw.ctx }); mwTableRender(); try { mwMissRender(); } catch (e) { console.error(e); }
}
function mwTabsRender() { if (mw.tab === 'setup' && !mwSetupOk()) mw.tab = 'rep'; PLQ('#mwTabs').innerHTML = MW_TABS.filter(t => t[0] !== 'setup' || mwSetupOk()).map(t => `<button type="button" data-t="${t[0]}" class="${mw.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join(''); document.querySelectorAll('#view-mgw .mg-pane').forEach(p => { p.style.display = p.dataset.p === mw.tab ? '' : 'none'; }); }
function mwRefresh() {
  mwTabsRender(); const d = mw.cfg.list.daily; PLQ('#mwSrcLine').textContent = mw.rows.length ? `Daily list “${d}” · ${plF(mw.rows.length)} rows${mw.cfg.list.trgt ? ` · targets “${mw.cfg.list.trgt}”` : ''} · loaded ${new Date(mw.loaded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Reads “${d}”${mw.cfg.list.trgt ? ` with the targets from “${mw.cfg.list.trgt}”` : ''} — press Load report data.`;
  PLQ('#mwIncOut').checked = !!mw.cfg.opt.out; PLQ('#mwIncIn').checked = !!mw.cfg.opt.inb; PLQ('#mwIncRet').checked = !!mw.cfg.opt.ret; PLQ('#mwHrsBasis').value = mw.cfg.opt.hrs; PLQ('#mwOtFmt').value = mw.cfg.opt.otFmt; PLQ('#mwTAgg').value = mw.cfg.opt.tAgg || 'avg'; mwDefsRender();
  if (mw.tab === 'rep') mwRenderReport();
}
function mwQuick(q) {
  const ds = mw.rows.map(r => r.date).sort(), last = ds[ds.length - 1] || '', first = ds[0] || ''; const sh = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return dpIso(d); };
  if (q === 'last') mw.f.from = mw.f.to = last; else if (q === '7') { mw.f.from = sh(last, -6); mw.f.to = last; } else if (q === 'mtd') { mw.f.from = last.slice(0, 8) + '01'; mw.f.to = last; } else { mw.f.from = first; mw.f.to = last; } mwRenderReport();
}
/* ---------- wiring ---------- */
function mwInit() {
  if (mw.inited) return; mw.inited = true; mwLoadCfg(); try { visInit({ pre: 'mw', view: 'mgw', grid: '#mwGrid', kpis: '#mwKpis', redraw: () => mwRenderReport() }); } catch (e) { console.error(e); } const q = PLQ; mw.tab = !mwSetupOk() || (mw.cfg.list.daily && getGlobalAccessToken()) ? 'rep' : 'setup';
  q('#mwTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; mw.tab = b.dataset.t; mwRefresh(); });
  ['daily', 'whs', 'trgt'].forEach(w => { mw.pick[w] = createListPicker(document.querySelector(`[data-list-picker="mw-${w}"]`), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: () => { mw.cols[w] = []; mwMapRender(w); } }); try { if (mw.cfg.list[w] && mw.pick[w].setValue) mw.pick[w].setValue(mw.cfg.list[w]); } catch (e) {} mwMapRender(w); });
  q('#mwColsBtn').addEventListener('click', async () => {
    const st = q('#mwColsStatus'), token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) { st.textContent = '⚠ Configure the global Site URL and sign-in first.'; return; }
    try { st.textContent = 'Loading…'; for (const w of ['daily', 'whs', 'trgt']) { const nm = mw.pick[w].getValue(); mw.cfg.list[w] = nm; if (!nm) { mw.cols[w] = []; continue; } const { siteId, listId } = await resolveIds(siteUrl, nm, token); mw.cols[w] = (await fetchColumns(siteId, listId, token)).filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase())); if (!Object.keys(mw.cfg.map[w]).length) mw.cfg.map[w] = mdpAuto(MW_FIELDS[w], mw.cols[w]); mwMapRender(w); }
      st.textContent = `✓ ${mw.cols.daily.length} daily · ${mw.cols.whs.length} headcount · ${mw.cols.trgt.length} target columns`; mwSaveCfg(); } catch (e) { st.textContent = '✘ ' + e.message; }
  });
  q('#mwAutoBtn').addEventListener('click', () => { let any = false; ['daily', 'whs', 'trgt'].forEach(w => { if (mw.cols[w].length) { mw.cfg.map[w] = mdpAuto(MW_FIELDS[w], mw.cols[w]); mwMapRender(w); any = true; } }); if (!any) q('#mwColsStatus').textContent = '⚠ Load columns first.'; mwSaveCfg(); });
  q('#mwCopyDef').addEventListener('click', async () => { if (!mwSetupOk()) return; const t = 'const MW_DEFAULT = ' + JSON.stringify({ list: mw.cfg.list, map: mw.cfg.map, opt: mw.cfg.opt }) + ';'; try { await navigator.clipboard.writeText(t); q('#mwLoadStatus').textContent = '✔ Copied — paste it over the MW_DEFAULT line in the HTML file; everyone then uses these lists.'; } catch (e) { prompt('Copy this line:', t); } });
  q('#mwLoadBtn').addEventListener('click', () => mwLoad(false)); q('#mwRefresh').addEventListener('click', () => mwLoad(false));
  const opt = () => { const o = mw.cfg.opt; o.out = q('#mwIncOut').checked; o.inb = q('#mwIncIn').checked; o.ret = q('#mwIncRet').checked; o.hrs = q('#mwHrsBasis').value; o.otFmt = q('#mwOtFmt').value; o.tAgg = q('#mwTAgg').value; mwSaveCfg(); mwDefsRender(); }; ['#mwIncOut', '#mwIncIn', '#mwIncRet', '#mwHrsBasis', '#mwOtFmt', '#mwTAgg'].forEach(s => q(s).addEventListener('change', opt));
  q('#mwFrom').addEventListener('change', e => { mw.f.from = e.target.value; mwPrune(); mwFilterUi(); mwRenderReport(); }); q('#mwTo').addEventListener('change', e => { mw.f.to = e.target.value; mwPrune(); mwFilterUi(); mwRenderReport(); }); q('#mwBy').addEventListener('change', e => { mw.cfg.by = e.target.value; mwSaveCfg(); mwRenderReport(); });
  document.querySelectorAll('#view-mgw [data-q]').forEach(b => b.addEventListener('click', () => mwQuick(b.dataset.q)));
  q('#mwExcel').addEventListener('click', () => { const d = mwTableData(); if (!d.rows.length) { sectionToast('Nothing to export.', 'warn'); return; } const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.headers, ...d.rows, ...(d.totals ? [d.totals] : [])]), d.sheet); XLSX.writeFile(wb, `Mngt_Daily_Report_${new Date().toISOString().slice(0, 10)}.xlsx`); addActivity('export', 'Management daily report Excel'); });
  q('#mwPrint').addEventListener('click', () => { const d = mwTableData(); if (!d.rows.length) { sectionToast('Nothing to print.', 'warn'); return; } w_printTable(d.title, d.note, d.headers, d.rows, d.totals || undefined); });
  q('#mwEmail').addEventListener('click', () => { if (!mwTableData().rows.length) { sectionToast('Nothing to email.', 'warn'); return; } window.extMailData = mwTableData; wMail_open('ext'); });
  q('#mwExpand').addEventListener('click', () => { const d = mwTableData(), tb = document.createElement('table'); tb.id = 'mwExpTable'; tb.dataset.title = d.title; tb.innerHTML = '<thead><tr>' + d.headers.map(x => '<th>' + plEsc(x) + '</th>').join('') + '</tr></thead><tbody>' + d.rows.concat(d.totals ? [d.totals] : []).map(r => '<tr>' + r.map(v => '<td>' + plEsc(v == null ? '' : v) + '</td>').join('') + '</tr>').join('') + '</tbody>'; if (window.tableExpandOpen) window.tableExpandOpen(tb); });
  window.addEventListener('resize', () => { if (document.querySelector('#view-mgw.active') && mw.tab === 'rep' && mw.rows.length) atDrawGrid(PLQ('#mwGrid'), MW_DEFS, { rows: () => mw.ctx }); });
}
function mwOpen() { mwInit(); mwRefresh(); if (!mw.rows.length && !mw.autoTried && mw.cfg.list.daily && getGlobalAccessToken() && getGlobalSiteUrl()) { mw.autoTried = true; mwLoad(true); } }
document.querySelectorAll('.nav-item[data-view="mgw"]').forEach(n => n.addEventListener('click', () => setTimeout(mwOpen, 0)));

/* ============================================================
   ATTENDANCE EXTRAS — overtime rules, roster fill, today-vs-yesterday, OT vs Mngt report, attendance-based Mngt report
   (loaded after att.js, roster.js and mgt.js)
   ============================================================ */
const A2_KEY = LS_BASE + '_att2';
const A2_DEF = { normal: 9, basis: 'gross', brkDef: 1, minMin: 0, round: 'none', woMode: 'all', phMode: 'all', woSrc: 'shift', fallback: ['Sun'], elig: true, gradeOn: false, gradeField: 'pos', gradeOk: [], field: 'sec', syncRoster: true, storeNormal: {}, holidays: [], map: {}, areaMap: {}, regMap: {}, emp: { list: '', map: {} }, empWhMap: {}, empOn: true, tol: 0.5, lkView: 'day', lkShow: 'all', rest: 10, otView: 'store', attKey: 'id', meas: { nh: 'req', not: 'not', wo: 'rot', po: 'hot' }, lkBasis: 'hrs', storeFB: false, skipInc: true, varBoth: true };
const a2 = { cfg: JSON.parse(JSON.stringify(A2_DEF)), ty: { d: '', a: '', auto: true, show: 'all', res: [], st: [] }, lkRes: [], lkWh: [], inited: false, ver: 1, sm: null };
const A2_DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function a2Load() { try { const d = JSON.parse(localStorage.getItem(A2_KEY) || 'null'); if (d) Object.assign(a2.cfg, d); } catch (e) {} if (a2.cfg.fieldV !== 2) { a2.cfg.field = 'wh'; a2.cfg.fieldV = 2; } }
function a2Save() { try { localStorage.setItem(A2_KEY, JSON.stringify(a2.cfg)); } catch (e) {} }
const a2Bump = () => { a2.ver++; a2.sm = null; };
const a2f = (v, d) => v == null || v === '' ? '' : (Math.round(v * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d));
const a2nk = v => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, '');
const a2Staff = () => { if (!a2.sm) { a2.sm = new Map(); (typeof ro !== 'undefined' ? ro.staff : []).forEach(s => { a2.sm.set(atKey(s.id), s); }); } return a2.sm; };

/* ---------- overtime calculation ---------- */
function a2OffDays(r) {
  const c = a2.cfg;
  if (c.woSrc === 'shift') {
    const code = String(r.shift || ''); if (/off/i.test(code)) { const m = code.toLowerCase().match(/\b(sun|mon|tue|wed|thu|fri|sat)/g); if (m && m.length) return [...new Set(m.map(x => x[0].toUpperCase() + x.slice(1)))]; }
    const s = a2Staff().get(atKey(r.id)); if (s && s.offDay) return [s.offDay];
  }
  return c.fallback;
}
function a2DayType(r) { if (a2.cfg.holidays.some(h => h.date === r.date)) return 'Public holiday'; return a2OffDays(r).includes(roDow(r.date)) ? 'Week-off' : 'Normal'; }
const a2StoreRaw = r => r[a2.cfg.field === 'wh' ? 'sec' : a2.cfg.field] || r.loc || '(blank)';
const a2Store = r => a2.cfg.field === 'wh' ? (a2MngtWh(r) || ('Other · ' + a2StoreRaw(r))) : a2StoreRaw(r);
function a2Hours(r) {
  let h = atHours(r); if (a2.cfg.basis === 'net' && h > 0) { const s = a2Staff().get(atKey(r.id)), bd = s ? roBrk(s.id) : null, bh = bd ? bd.d / 60 : a2.cfg.brkDef; if (h > bh) h -= bh; } return Math.round(h * 100) / 100;
}
function a2Rnd(v) { const c = a2.cfg; if (v <= 0 || v * 60 < c.minMin) return 0; switch (c.round) { case 'q': return Math.round(v * 4) / 4; case 'h': return Math.round(v * 2) / 2; case 'fh': return Math.floor(v * 2 + 1e-9) / 2; case 'f1': return Math.floor(v + 1e-9); default: return Math.round(v * 100) / 100; } }
const a2Memo = new WeakMap();
function a2Calc(r) {
  const m = a2Memo.get(r); if (m && m.v === a2.ver) return m.o;
  const c = a2.cfg, store = a2Store(r), nrm = +(c.storeNormal[store] > 0 ? c.storeNormal[store] : c.normal) || 9, elig = (!c.elig || !/not\s+eligible/i.test(r.grp || '')) && (!c.gradeOn || c.gradeOk.includes(String(r[c.gradeField] || '(blank)'))), type = a2DayType(r), h = a2Hours(r);
  let not = 0, wo = 0, po = 0;
  if (h > 0 && elig) {
    if (type === 'Public holiday') po = c.phMode === 'all' ? h : Math.max(0, h - nrm);
    else if (type === 'Week-off') wo = c.woMode === 'all' ? h : Math.max(0, h - nrm);
    else not = Math.max(0, h - nrm);
  }
  not = a2Rnd(not); wo = a2Rnd(wo); po = a2Rnd(po); const ot = not + wo + po, o = { h, nh: Math.max(0, Math.round((h - ot) * 100) / 100), not, wo, po, ot, type, elig, nrm, file: r.ot || 0, fileNot: r.not || 0, store };
  a2Memo.set(r, { v: a2.ver, o }); return o;
}
function a2Sum(rows) {
  const o = { n: rows.length, emp: new Set(), days: new Set(), h: 0, nh: 0, not: 0, wo: 0, po: 0, ot: 0, file: 0, inc: 0, inel: 0, withOt: 0 };
  rows.forEach(r => { const c = a2Calc(r); o.emp.add(atKey(r.id)); o.days.add(r.date); o.h += c.h; o.nh += c.nh; o.not += c.not; o.wo += c.wo; o.po += c.po; o.ot += c.ot; o.file += c.file; if (r.st === 'One punch') o.inc++; if (!c.elig && atHours(r) > 0) o.inel++; if (c.ot > 0) o.withOt++; }); return o;
}

/* ---------- store link (attendance store ↔ Mngt WHs_Desc) ---------- */
function a2Entered() { return (mg.sp && mg.sp.rows) || (mg.cfg.src === 'sp' ? mg.rows : []); }
function a2WhNames() { const s = new Set(); a2Entered().forEach(r => r.wh && s.add(r.wh)); (mg.whs || []).forEach(h => h.wh && s.add(h.wh)); ((mg.sp && mg.sp.whs) || []).forEach(h => h.wh && s.add(h.wh)); return [...s].sort((a, b) => a.localeCompare(b)); }
const a2Core = v => a2nk(v).replace(/warehouse|store|wh$/g, '');
function a2Auto(store) {
  const names = a2WhNames(); if (!names.length) return '';
  const k = a2nk(store); let hit = names.find(n => a2nk(n) === k); if (hit) return hit;
  const c = a2Core(store); if (c) { hit = names.find(n => a2Core(n) === c); if (hit) return hit; const cand = names.filter(n => { const x = a2Core(n); return x && (x.includes(c) || c.includes(x)); }); if (cand.length === 1) return cand[0]; } return '';
}
const a2Link = store => { const u = a2.cfg.map[store]; if (u) return { wh: u, user: true }; const a = a2Auto(store); return a ? { wh: a, user: false } : null; };

/* ---------- table helpers ---------- */
const a2nc = (l, g) => [l, o => a2f(g(o)), o => g(o)];
function a2Export(d) {
  if (!d.rows.length) { sectionToast('Nothing to export.', 'warn'); return; }
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.headers, ...d.rows, ...(d.totals ? [d.totals] : [])]), d.sheet.slice(0, 31)); XLSX.writeFile(wb, d.sheet.replace(/\s+/g, '_') + '.xlsx'); addActivity('export', d.title);
}
function a2Expand(d) { const tb = document.createElement('table'); tb.id = 'atExpTable'; tb.dataset.title = d.title; tb.innerHTML = '<thead><tr>' + d.headers.map(x => '<th>' + plEsc(x) + '</th>').join('') + '</tr></thead><tbody>' + d.rows.map(r => '<tr>' + r.map(v => '<td>' + plEsc(v == null ? '' : v) + '</td>').join('') + '</tr>').join('') + (d.totals ? '<tr>' + d.totals.map(v => '<th>' + plEsc(v == null ? '' : v) + '</th>').join('') + '</tr>' : '') + '</tbody>'; if (window.tableExpandOpen) window.tableExpandOpen(tb); }
function a2Print(d) { if (!d.rows.length) { sectionToast('Nothing to print.', 'warn'); return; } w_printTable(d.title, d.note, d.headers, d.rows, d.totals || undefined); }
function a2Mail(fn) { window.extMailData = fn; wMail_open('ext'); }
function a2Data(title, sheet, note, cols, rows) { return { title, sheet, note, headers: cols.map(c => c[0]), rows: rows.map(r => cols.map(c => { const v = c[1](r); return v == null ? '' : v; })) }; }
const a2Chip = (txt, col) => `<td><span class="at-chip" style="background:${col}22;color:${col}">${plEsc(txt)}</span></td>`;
const A2_OT_COL = T => [T.act, T.series[1] || T.warn, T.series[2] || T.crit];

/* ============ 1 · OVERTIME TAB ============ */
const A2_DEFS = [];
const a2Stack = (id, title, sub, span, keyFn, top, byDate) => A2_DEFS.push({ id, title, sub, span, draw(host, c) {
  const col = A2_OT_COL(c.T), S = [['Normal OT', 'not'], ['Week-off OT', 'wo'], ['Public OT', 'po']], gm = new Map();
  c.rows.forEach(r => { const k = keyFn(r); if (k == null) return; let o = gm.get(k); if (!o) gm.set(k, o = { k, rows: [] }); o.rows.push(r); });
  let g = [...gm.values()]; const val = (x, f) => x.rows.reduce((a, r) => a + a2Calc(r)[f], 0), tot = x => S.reduce((a, s) => a + val(x, s[1]), 0);
  if (byDate) g.sort((a, b) => a.k.localeCompare(b.k)); else { g.sort((a, b) => tot(b) - tot(a)); g = g.filter(x => tot(x) > 0).slice(0, top || 12); }
  if (!g.length || !g.some(x => tot(x) > 0)) { plEmpty(host, 'No overtime under the current rules and filters.'); return {}; }
  const lab = x => byDate ? atDateLabel(x.k) : x.k;
  if (byDate) plcCols(host, { cats: g.map(x => ({ label: lab(x), key: x.k, vals: S.map(s => val(x, s[1])), tip: S.map((s, i) => ({ c: col[i], k: s[0], v: plF(val(x, s[1]), 1) + ' h' })) })), series: S.map((s, i) => ({ name: s[0], color: col[i] })), fmt: v => plF(v, 1), labelFn: (cat, v) => v ? plF(v, 0) : '', height: 260 });
  else plcBarsH(host, { rows: g.map(x => ({ label: lab(x), key: x.k, vals: S.map(s => val(x, s[1])), tip: S.map((s, i) => ({ c: col[i], k: s[0], v: plF(val(x, s[1]), 1) + ' h' })) })), series: S.map((s, i) => ({ name: s[0], color: col[i] })), stacked: true, fmt: v => plF(v, 1), tickFmt: v => plF(v), thick: 14 });
  return { legend: S.map((s, i) => ({ name: s[0], c: col[i] })), table: { headers: [title.split(' — ')[0], ...S.map(s => s[0] + ' h'), 'Total OT h'], rows: g.map(x => [lab(x), ...S.map(s => a2f(val(x, s[1]))), a2f(tot(x))]) } };
} });
a2Stack('a2store', 'Overtime by store', 'Normal, week-off and public-holiday OT hours — calculated', 's6', r => a2IsOther(r) ? null : a2Store(r), 12);
a2Stack('a2day', 'Overtime by day', 'Hours per date', 's6', r => r.date, 0, true);
a2Stack('a2sec', 'Overtime by work location', 'Where the overtime is', 's6', r => r.loc || '(blank)', 10);
a2Stack('a2emp', 'Top employees by overtime', 'Highest total OT in the selection', 's6', r => `${r.name} (${r.id})`, 12);
A2_DEFS.push({ id: 'a2cmpf', title: 'Calculated vs the report’s own OT', sub: 'Total OT per store — rules in this tab vs the “Total OT” column of the file', span: 's6', draw(host, c) {
  const gm = new Map(); c.rows.forEach(r => { if (a2IsOther(r)) return; const k = a2Store(r); let o = gm.get(k); if (!o) gm.set(k, o = { k, rows: [] }); o.rows.push(r); });
  const g = [...gm.values()].map(x => ({ k: x.k, s: a2Sum(x.rows) })).filter(x => x.s.ot > 0 || x.s.file > 0).sort((a, b) => b.s.ot - a.s.ot).slice(0, 12); if (!g.length) { plEmpty(host, 'No overtime.'); return {}; }
  plcBarsH(host, { rows: g.map(x => ({ label: x.k, key: x.k, vals: [x.s.ot, x.s.file], tip: [{ c: c.T.act, k: 'Calculated (your rules)', v: plF(x.s.ot, 1) + ' h' }, { c: c.T.muted, k: 'In the report', v: plF(x.s.file, 1) + ' h' }] })), series: [{ name: 'Calculated', color: c.T.act }, { name: 'In the report', color: c.T.muted }], fmt: v => plF(v, 1), tickFmt: v => plF(v), thick: 12 });
  return { legend: [{ name: 'Calculated', c: c.T.act }, { name: 'In the report', c: c.T.muted }], table: { headers: ['Store', 'Calculated h', 'Report h', 'Difference'], rows: g.map(x => [x.k, a2f(x.s.ot), a2f(x.s.file), a2f(x.s.ot - x.s.file)]) } }; } });
A2_DEFS.push({ id: 'a2dist', title: 'Hours worked per day', sub: 'Employee-days by hours — the dotted rule is the normal day', span: 's6', draw(host, c) {
  const nrm = a2.cfg.normal, B = [['< 4 h', 0, 4], ['4 – 8 h', 4, 8], ['8 – 9 h', 8, 9], ['9 – 10 h', 9, 10], ['10 – 12 h', 10, 12], ['12 – 14 h', 12, 14], ['14 h +', 14, 99]], W = c.rows.filter(r => atHours(r) > 0), n = (lo, hi) => W.filter(r => { const h = a2Calc(r).h; return h >= lo && h < hi; }).length;
  plcCols(host, { cats: B.map(b => ({ label: b[0], vals: [n(b[1], b[2])], tip: [{ c: c.T.act, k: 'Employee-days', v: plF(n(b[1], b[2])) }] })), series: [{ name: 'Employee-days', color: c.T.act }], fmt: v => plF(v), labelFn: (cat, v) => v ? plF(v) : '', height: 250 });
  return { table: { headers: ['Hours (normal day ' + nrm + ' h)', 'Employee-days'], rows: B.map(b => [b[0], n(b[1], b[2])]) } }; } });

function a2OtKpis() {
  const V = atView(), s = a2Sum(V), K = atKpi, d = s.ot - s.file;
  PLQ('#a2Kpis').innerHTML = K('Hours worked', plF(s.h, 0) + ' h', `${plF(s.emp.size)} employee(s) · ${plF(s.days.size)} day(s) · ${plF(s.n)} records`) + K('Normal OT', plF(s.not, 1) + ' h', `above ${a2.cfg.normal} h on a normal day`) + K('Week-off OT', plF(s.wo, 1) + ' h', 'worked on the person’s week-off day') + K('Public holiday OT', plF(s.po, 1) + ' h', a2.cfg.holidays.length ? `${a2.cfg.holidays.length} holiday(s) defined` : 'no public holiday defined yet')
    + K('Total OT (calculated)', plF(s.ot, 1) + ' h', `${plF(s.withOt)} employee-day(s) with OT`) + K('Total OT in the report', plF(s.file, 1) + ' h', 'the file’s own “Total OT” column') + K('Calculated − report', (d > 0 ? '+' : '') + plF(d, 1) + ' h', 'difference of the two methods') + K('Not eligible', plF(s.inel), 'worked, but group has no OT right') + K('Incomplete punches', plF(s.inc), 'IN or OUT missing → 0 h');
}
function a2OtRows() {
  const view = a2.cfg.otView, V = atView().filter(r => view === 'date' || view === 'emp' || !a2IsOther(r)), T = plT();
  if (view === 'emp') { const rows = V.map(r => ({ r, c: a2Calc(r) })); const cols = [['Date', o => atDateLabel(o.r.date), o => o.r.date], ['Employee no', o => o.r.id], ['Name', o => o.r.name], ['Store', o => o.c.store], ['Position', o => o.r.pos], ['Day type', o => o.c.type], ['Shift code', o => o.r.shift], ['IN', o => atHM(o.r.inT), o => o.r.inT == null ? -1 : o.r.inT], ['OUT', o => atHM(o.r.outT), o => o.r.outT == null ? -1 : o.r.outT], a2nc('Worked h', o => o.c.h), a2nc('Normal h', o => o.c.nh), a2nc('Normal OT h', o => o.c.not), a2nc('Week-off OT h', o => o.c.wo), a2nc('Public OT h', o => o.c.po), a2nc('Total OT h', o => o.c.ot), a2nc('Report OT h', o => o.c.file)]; return { rows, cols, name: 'Overtime by employee' }; }
  const gm = new Map(), key = r => view === 'store' ? a2Store(r) : view === 'date' ? r.date : a2Store(r) + '|' + r.date;
  V.forEach(r => { const k = key(r); let o = gm.get(k); if (!o) gm.set(k, o = { store: view === 'date' ? '(all stores)' : a2Store(r), date: view === 'store' ? '' : r.date, rs: [] }); o.rs.push(r); });
  const rows = [...gm.values()].map(o => Object.assign(o, { s: a2Sum(o.rs) })), cols = [['Store', o => o.store], ...(view === 'store' ? [] : [['Date', o => atDateLabel(o.date), o => o.date]]), a2nc('Employees', o => o.s.emp.size), a2nc('Records', o => o.s.n), a2nc('Worked h', o => o.s.h), a2nc('Normal h', o => o.s.nh), a2nc('Normal OT h', o => o.s.not), a2nc('Week-off OT h', o => o.s.wo), a2nc('Public OT h', o => o.s.po), a2nc('Total OT h', o => o.s.ot), a2nc('Report OT h', o => o.s.file), a2nc('Calculated − report', o => o.s.ot - o.s.file)];
  return { rows, cols, name: 'Overtime by ' + ({ store: 'store', day: 'store and day', date: 'day' }[view]) };
}
function a2OtTable() { const d = a2OtRows(); PLQ('#a2Info').textContent = `— ${plF(d.rows.length)} row(s) · normal day ${a2.cfg.normal} h · ${a2.cfg.holidays.length} public holiday(s)`; atTblDraw(PLQ('#a2Table'), d.cols, d.rows, 'ot', at.otShown || 200, PLQ('#a2More')); }
function a2OtData() { const d = a2OtRows(), R = atSortRows(d.rows, d.cols, at.sort.ot); return a2Data(d.name, 'Overtime', `${plF(R.length)} row(s) · normal day ${a2.cfg.normal} h · public holidays: ${a2.cfg.holidays.map(h => h.date).join(', ') || 'none'}`, d.cols, R); }
function a2RulesSync() {
  const c = a2.cfg, q = PLQ, set = (id, v) => { const el = q(id); if (el && document.activeElement !== el) el.value = v; };
  set('#a2Normal', c.normal); set('#a2Basis', c.basis); set('#a2BrkDef', c.brkDef); set('#a2MinMin', c.minMin); set('#a2Round', c.round); set('#a2WoMode', c.woMode); set('#a2PhMode', c.phMode); set('#a2WoSrc', c.woSrc); set('#a2Field', c.field); set('#a2View', c.otView); q('#a2Elig').checked = !!c.elig;
  q('#a2Fallback').innerHTML = A2_DOW.map(d => `<label class="mg-ck"><input type="checkbox" data-dow="${d}" ${c.fallback.includes(d) ? 'checked' : ''}> ${d}</label>`).join('');
  q('#a2HolList').innerHTML = c.holidays.slice().sort((a, b) => a.date.localeCompare(b.date)).map(h => `<span class="ro-shchip"><strong>${atDateLabel(h.date)}</strong> ${plEsc(h.name || '')} <button type="button" class="ghost small" data-hdel="${h.date}" title="Remove">✖</button></span>`).join('') || '<span class="text-sm" style="color:var(--gray-500)">None yet.</span>';
  a2GradeUi();
  const stores = [...new Set(at.rows.map(a2Store))].sort(); q('#a2StoreNormal').innerHTML = stores.map(s => `<tr><td>${plEsc(s)}</td><td><input type="number" data-sn="${plEsc(s)}" min="1" max="24" step="0.25" value="${c.storeNormal[s] || ''}" placeholder="${c.normal}" style="width:90px;margin:0"></td></tr>`).join('');
}
const a2Grades = () => { const m = new Map(); at.rows.forEach(r => { const v = String(r[a2.cfg.gradeField] || '(blank)'); m.set(v, (m.get(v) || 0) + 1); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); };
function a2GradeUi() {
  const c = a2.cfg, q = PLQ, G = a2Grades(), names = G.map(g => g[0]); q('#a2GradeField').value = c.gradeField; q('#a2GradeOn').checked = !!c.gradeOn;
  const h = q('#a2GradeHost'); h.innerHTML = ''; h.style.display = c.gradeOn ? '' : 'none';
  if (c.gradeOn) { h.appendChild(buildMultiCombo(c.gradeOk.filter(v => names.includes(v)), names, arr => { c.gradeOk = arr; a2Save(); a2Bump(); a2OtRender(); }, { placeholder: 'Pick the grades that get OT…' })); }
  const ok = c.gradeOn ? G.filter(g => c.gradeOk.includes(g[0])).length : G.length;
  q('#a2GradeInfo').textContent = c.gradeOn ? `${ok} of ${G.length} grade(s) get OT · people of the other grades are paid normal hours only` : `Off — every grade is treated the same (the “Not eligible” employee group is still respected when ticked).`;
}
function a2RulesSummary() {
  const c = a2.cfg, e = PLQ('#a2RulesSummary'); if (e) e.innerHTML = `Normal day <strong>${c.normal} h</strong> · rounding <strong>${plEsc(c.round)}</strong> · ignore OT under <strong>${c.minMin} min</strong> · ${c.holidays.length} public holiday(s) · grade filter <strong>${c.gradeOn ? 'on' : 'off'}</strong>. Change them in <strong>⏱ Overtime Rules</strong> (left menu).`;
  const n = PLQ('#a2RulesNote'); if (n) n.textContent = at.rows.length ? `${plF(at.rows.length)} attendance record(s) loaded — the Overtime, By staff and Mngt report tabs use these rules.` : 'No attendance report is loaded yet — upload it in Attendance Analytics; the rules can be set before or after.';
}
function a2OtRender() {
  a2Bump(); a2RulesSync(); a2RulesSummary(); a2OtKpis(); atDrawGrid(PLQ('#a2Grid'), A2_DEFS, { rows: () => atView() }); a2OtTable();
}
function a2RulesInit() {
  const q = PLQ, c = a2.cfg, ch = () => { a2Save(); a2Bump(); at.otShown = 200; a2OtRender(); };
  const num = (id, key, min, max) => q(id).addEventListener('change', e => { let v = parseFloat(e.target.value); if (isNaN(v)) v = A2_DEF[key]; c[key] = Math.max(min, Math.min(max, v)); ch(); });
  num('#a2Normal', 'normal', 1, 24); num('#a2BrkDef', 'brkDef', 0, 4); num('#a2MinMin', 'minMin', 0, 240);
  [['#a2Basis', 'basis'], ['#a2Round', 'round'], ['#a2WoMode', 'woMode'], ['#a2PhMode', 'phMode'], ['#a2WoSrc', 'woSrc'], ['#a2Field', 'field']].forEach(([id, k]) => q(id).addEventListener('change', e => { c[k] = e.target.value; ch(); }));
  q('#a2GradeField').addEventListener('change', e => { c.gradeField = e.target.value; c.gradeOk = c.gradeOn ? a2Grades().map(g => g[0]) : []; ch(); });
  q('#a2GradeOn').addEventListener('change', e => { c.gradeOn = e.target.checked; if (c.gradeOn && !c.gradeOk.length) c.gradeOk = a2Grades().map(g => g[0]); ch(); });
  q('#a2Elig').addEventListener('change', e => { c.elig = e.target.checked; ch(); });
  q('#a2View').addEventListener('change', e => { c.otView = e.target.value; a2Save(); at.sort.ot = null; a2OtTable(); });
  q('#a2Fallback').addEventListener('change', e => { const i = e.target.closest('input[data-dow]'); if (!i) return; const s = new Set(c.fallback); i.checked ? s.add(i.dataset.dow) : s.delete(i.dataset.dow); c.fallback = A2_DOW.filter(d => s.has(d)); ch(); });
  q('#a2HolAdd').addEventListener('click', () => { const d = q('#a2HolDate').value, n = q('#a2HolName').value.trim(); if (!d) { sectionToast('Pick the date of the public holiday.', 'warn'); return; } c.holidays = c.holidays.filter(h => h.date !== d); c.holidays.push({ date: d, name: n }); q('#a2HolDate').value = ''; q('#a2HolName').value = ''; ch(); });
  q('#a2HolList').addEventListener('click', e => { const b = e.target.closest('[data-hdel]'); if (!b) return; c.holidays = c.holidays.filter(h => h.date !== b.dataset.hdel); ch(); });
  q('#a2StoreNormal').addEventListener('change', e => { const i = e.target.closest('input[data-sn]'); if (!i) return; const v = parseFloat(i.value); if (v > 0) c.storeNormal[i.dataset.sn] = v; else delete c.storeNormal[i.dataset.sn]; ch(); });
  q('#a2RulesReset').addEventListener('click', () => { if (!confirm('Go back to the default overtime rules? Your public holidays and store links are kept.')) return; const keep = { holidays: c.holidays, map: c.map }; Object.assign(c, JSON.parse(JSON.stringify(A2_DEF)), keep); ch(); });
  q('#a2OpenRules').addEventListener('click', () => { const n = document.querySelector('.nav-item[data-view="otrules"]'); if (n) n.click(); });
  q('#a2GoOt').addEventListener('click', () => a2GoAtt('ot'));
  q('#a2More').addEventListener('click', () => { at.otShown = (at.otShown || 200) + 200; a2OtTable(); });
  q('#a2Excel').addEventListener('click', () => a2Export(a2OtData())); q('#a2Print').addEventListener('click', () => a2Print(a2OtData())); q('#a2Email').addEventListener('click', () => a2Mail(a2OtData)); q('#a2Expand').addEventListener('click', () => a2Expand(a2OtData()));
}


/* ============ 1b · WORKING HOURS BY STAFF ============ */
a2.st = { from: '', to: '', show: 'all', sig: '', f: { name: [], pos: [], grade: [], store: [], el: [] } };
function a2StRows() {
  const s = a2.st, V = atView().filter(r => (!s.from || r.date >= s.from) && (!s.to || r.date <= s.to)), m = new Map();
  V.forEach(r => { const k = atKey(r.id) || atNm(r.name); let o = m.get(k); if (!o) m.set(k, o = { id: r.id, name: r.name, pos: r.pos, grade: String(r[a2.cfg.gradeField] || '(blank)'), store: a2Store(r), rs: [], el: false }); o.rs.push(r); if (r.date >= (o.last || '')) { o.last = r.date; o.store = a2Store(r); o.pos = r.pos; } });
  let L = [...m.values()].map(o => { const sm = a2Sum(o.rs); o.s = sm; o.worked = o.rs.filter(r => a2Calc(r).h > 0).length; o.el = o.rs.some(r => a2Calc(r).elig); return o; });
  const f = s.f; if (f.name.length) L = L.filter(o => f.name.includes(o.name)); if (f.pos.length) L = L.filter(o => f.pos.includes(o.pos)); if (f.grade.length) L = L.filter(o => f.grade.includes(o.grade)); if (f.store.length) L = L.filter(o => f.store.includes(o.store)); if (f.el.length) L = L.filter(o => f.el.includes(o.el ? 'Yes' : 'No'));
  if (s.show === 'ot') L = L.filter(o => o.s.ot > 0); else if (s.show === 'inel') L = L.filter(o => !o.el && o.worked > 0);
  return L;
}
const ST_COLS = [['Employee no', o => o.id], ['Name', o => o.name], ['Position', o => o.pos], ['Job grade', o => o.grade], ['Store', o => o.store], a2nc('Days in range', o => o.s.days.size), a2nc('Days worked', o => o.worked), a2nc('Working hours', o => o.s.h), a2nc('Normal hours', o => o.s.nh), a2nc('OT hours', o => o.s.not), a2nc('WE-OT hours', o => o.s.wo), a2nc('Public OT hours', o => o.s.po), a2nc('Total OT hours', o => o.s.ot), ['OT eligible', o => o.el ? 'Yes' : 'No'], a2nc('Report OT (file)', o => o.s.file)];
const a2StTotals = L => ST_COLS.map((c, i) => i === 0 ? 'TOTAL' : i === 1 ? `${L.length} staff` : [5, 6, 7, 8, 9, 10, 11, 12, 14].includes(i) ? a2f(L.reduce((a, o) => a + (c[2] ? c[2](o) : 0), 0)) : '');
function a2StData() { const L = atSortRows(a2StRows(), ST_COLS, at.sort.st), s = a2.st; const d = a2Data('Working hours by staff', 'Hours by staff', `${s.from || '…'} → ${s.to || '…'} · normal day ${a2.cfg.normal} h · ${L.length} staff`, ST_COLS, L); d.totals = a2StTotals(L); return d; }
const ST_DEFS = [];
ST_DEFS.push({ id: 'ststack', title: 'Hours by staff — normal and overtime', sub: 'Top 15 people by total working hours in the range', span: 's12', draw(host, c) {
  const L = a2StRows().sort((a, b) => b.s.h - a.s.h).slice(0, 15); if (!L.length) { plEmpty(host, 'No hours in this range.'); return {}; }
  const col = [c.T.good, ...A2_OT_COL(c.T)], S = [['Normal', 'nh'], ['OT', 'not'], ['WE-OT', 'wo'], ['Public OT', 'po']];
  plcBarsH(host, { rows: L.map(o => ({ label: o.name, key: o.id, vals: S.map(s => o.s[s[1]]), tip: S.map((s, i) => ({ c: col[i], k: s[0], v: plF(o.s[s[1]], 1) + ' h' })).concat([{ k: 'Working hours', v: plF(o.s.h, 1) + ' h' }]) })), series: S.map((s, i) => ({ name: s[0], color: col[i] })), stacked: true, fmt: v => plF(v, 1), tickFmt: v => plF(v), thick: 12 });
  return { legend: S.map((s, i) => ({ name: s[0], c: col[i] })), table: { headers: ['Staff', ...S.map(s => s[0] + ' h'), 'Working h'], rows: L.map(o => [o.name, ...S.map(s => a2f(o.s[s[1]])), a2f(o.s.h)]) } }; } });
function a2StKpis() {
  const L = a2StRows(), t = f => L.reduce((a, o) => a + f(o), 0), K = atKpi, h = t(o => o.s.h), ot = t(o => o.s.ot);
  PLQ('#stKpis').innerHTML = K('Staff', plF(L.length), `${plF(L.filter(o => o.s.ot > 0).length)} with overtime`) + K('Working hours', plF(h, 0) + ' h', `${plF(t(o => o.worked))} days worked`) + K('Normal hours', plF(t(o => o.s.nh), 0) + ' h', h ? plP(t(o => o.s.nh) / h, 0) + ' of working hours' : '') + K('OT', plF(t(o => o.s.not), 1) + ' h', `above ${a2.cfg.normal} h a day`) + K('WE-OT', plF(t(o => o.s.wo), 1) + ' h', 'week-off days') + K('Public OT', plF(t(o => o.s.po), 1) + ' h', 'public holidays') + K('Total OT', plF(ot, 1) + ' h', h ? plP(ot / h, 1) + ' of working hours' : '') + K('Not OT-eligible', plF(L.filter(o => !o.el && o.worked > 0).length), a2.cfg.gradeOn ? 'grade not ticked / group not eligible' : 'employee group');
}
function a2StFilters() {
  const base = (() => { const s = a2.st, f = s.f; a2.st.f = { name: [], pos: [], grade: [], store: [], el: [] }; const L = a2StRows(); a2.st.f = f; return L; })(), mk = (id, key, vals) => { const h = PLQ(id), sel = a2.st.f[key].filter(v => vals.includes(v)); a2.st.f[key] = sel; h.innerHTML = ''; h.appendChild(buildMultiCombo(sel, vals, arr => { a2.st.f[key] = arr; at.stShown = 200; a2StRender(true); }, { placeholder: 'All' })); }, u = g => [...new Set(base.map(g))].sort((a, b) => String(a).localeCompare(String(b)));
  mk('#stNameHost', 'name', u(o => o.name)); mk('#stPosHost', 'pos', u(o => o.pos || '(blank)').filter(Boolean)); mk('#stGradeHost', 'grade', u(o => o.grade)); mk('#stStoreHost', 'store', u(o => o.store)); mk('#stElHost', 'el', ['Yes', 'No']);
}
function a2StRender(tableOnly) {
  a2Bump(); const s = a2.st, ds = atDates(), q = PLQ, sig = ds[0] + '|' + ds[ds.length - 1] + '|' + at.rows.length;
  if (s.sig !== sig) { s.sig = sig; s.from = ds[0] || ''; s.to = ds[ds.length - 1] || ''; }
  q('#stFrom').value = s.from; q('#stTo').value = s.to; q('#stShow').value = s.show; if (!tableOnly) a2StFilters(); const L = a2StRows();
  q('#stInfo').textContent = q('#stInfo2').textContent = `— ${plF(L.length)} staff · ${s.from || '…'} → ${s.to || '…'}`; a2StKpis(); atTblDraw(q('#stTable'), ST_COLS, L, 'st', at.stShown || 200, q('#stMore'), (c, o) => c[0] === 'OT eligible' ? a2Chip(o.el ? 'Yes' : 'No', o.el ? '#0ca30c' : '#d03b3b') : null);
  if (!tableOnly) atDrawGrid(q('#stGrid'), ST_DEFS, { rows: () => atView() });
}
function a2StInit() {
  const q = PLQ, redo = () => { at.stShown = 200; a2StRender(); };
  q('#stFrom').addEventListener('change', e => { a2.st.from = e.target.value; redo(); }); q('#stTo').addEventListener('change', e => { a2.st.to = e.target.value; redo(); }); q('#stShow').addEventListener('change', e => { a2.st.show = e.target.value; redo(); });
  document.querySelectorAll('#view-att [data-sq]').forEach(b => b.addEventListener('click', () => { const ds = atDates(), last = ds[ds.length - 1] || ''; if (b.dataset.sq === 'last') a2.st.from = a2.st.to = last; else if (b.dataset.sq === '7') { a2.st.from = roAdd(last, -6); a2.st.to = last; } else { a2.st.from = ds[0] || ''; a2.st.to = last; } redo(); }));
  q('#stClear').addEventListener('click', () => { a2.st.f = { name: [], pos: [], grade: [], store: [], el: [] }; a2.st.show = 'all'; redo(); });
  q('#stMore').addEventListener('click', () => { at.stShown = (at.stShown || 200) + 200; a2StRender(true); });
  q('#stExcel').addEventListener('click', () => a2Export(a2StData())); q('#stPrint').addEventListener('click', () => a2Print(a2StData())); q('#stEmail').addEventListener('click', () => a2Mail(a2StData)); q('#stExpand').addEventListener('click', () => a2Expand(a2StData()));
}


/* ============ PUNCH DETAIL — per staff, per day, punch IN / OUT ============ */
const pd = { from: '', to: '', names: [], show: 'all', shown: 25, sig: '' };
const PD_COLS = ['Date', 'Day', 'Shift', 'Shift start', 'Shift end', 'IN', 'OUT', 'Late (min)', 'Early out (min)', 'Work h', 'Required h', 'Diff h', 'Status', 'Remarks'];
const pdR1 = n => Math.round(n * 100) / 100;
function pdLine(r) {
  const g = at.grace, late = r.inT != null && r.sFrom != null ? atWrap(r.inT - r.sFrom) : null, early = r.outT != null && r.sTo != null ? atWrap(r.sTo - r.outT) : null, wk = atHours(r);
  const lateF = late != null && late > g, earlyF = early != null && early > g, miss = r.st === 'One punch' || r.st === 'No punch', worked = wk > 0 || r.st === 'Present' || r.st === 'One punch';
  const inTxt = r.inT != null ? atHM(r.inT) : (r.st === 'One punch' ? 'Missing' : ''), outTxt = r.outT != null ? atHM(r.outT) : (r.st === 'One punch' ? 'Missing' : '');
  const cells = [atDateLabel(r.date).split(' ').slice(1).join(' ') + ' ' + r.date.slice(0, 4), atDateLabel(r.date).split(' ')[0], r.shift || '', r.sFrom != null ? atHM(r.sFrom) : '', r.sTo != null ? atHM(r.sTo) : '', inTxt, outTxt,
    lateF ? Math.round(late) : '', earlyF ? Math.round(early) : '', wk > 0 ? pdR1(wk) : '', r.req ? pdR1(r.req) : '', wk > 0 && r.req ? pdR1(wk - r.req) : '', r.st, r.rem || ''];
  return { r, cells, lateF, earlyF, late: lateF ? late : 0, early: earlyF ? early : 0, wk, miss: r.st === 'One punch', exc: lateF || earlyF || r.st === 'One punch' || r.st === 'Absent' || r.st === 'No punch', worked };
}
function pdBuild() {
  const V = atView().filter(r => (!pd.from || r.date >= pd.from) && (!pd.to || r.date <= pd.to)), m = new Map();
  V.forEach(r => { const k = atKey(r.id) || atNm(r.name); let o = m.get(k); if (!o) m.set(k, o = { id: r.id, name: r.name, pos: r.pos, sec: r.sec, sup: r.sup, loc: r.loc, lines: [] }); o.lines.push(pdLine(r)); if (r.name) { o.name = r.name; o.pos = r.pos || o.pos; o.sec = r.sec || o.sec; o.sup = r.sup || o.sup; o.loc = r.loc || o.loc; } });
  let G = [...m.values()]; if (pd.names.length) G = G.filter(g => pd.names.includes(g.name));
  G.forEach(g => { g.lines.sort((a, b) => a.r.date.localeCompare(b.r.date)); g.all = g.lines; if (pd.show === 'exc') g.lines = g.lines.filter(l => l.exc); const A = g.all;
    g.sum = { days: A.length, present: A.filter(l => l.r.st === 'Present').length, one: A.filter(l => l.r.st === 'One punch').length, absent: A.filter(l => l.r.st === 'Absent').length, nop: A.filter(l => l.r.st === 'No punch').length, leave: A.filter(l => l.r.st === 'Leave').length, off: A.filter(l => l.r.st === 'Off').length, lateN: A.filter(l => l.lateF).length, lateM: A.reduce((a, l) => a + l.late, 0), earlyN: A.filter(l => l.earlyF).length, earlyM: A.reduce((a, l) => a + l.early, 0), wk: A.reduce((a, l) => a + l.wk, 0), req: A.reduce((a, l) => a + (l.wk > 0 ? (l.r.req || 0) : 0), 0) }; });
  if (pd.show === 'exc') G = G.filter(g => g.lines.length); return G.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
const pdSumTxt = u => [u.present && u.present + ' present', u.one && u.one + ' one-punch', u.absent && u.absent + ' absent', u.nop && u.nop + ' no punch', u.leave && u.leave + ' leave', u.off && u.off + ' off'].filter(Boolean).join(' · ');
function pdRender() {
  const q = PLQ, ds = atDates(), sig = ds[0] + '|' + ds[ds.length - 1] + '|' + at.rows.length; if (pd.sig !== sig) { pd.sig = sig; pd.from = ds[0] || ''; pd.to = ds[ds.length - 1] || ''; pd.shown = 25; }
  q('#pdFrom').value = pd.from; q('#pdTo').value = pd.to; q('#pdShow').value = pd.show;
  const hn = q('#pdNameHost'), allNames = [...new Set(atView().map(r => r.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), nsig = allNames.join('|') + '#' + pd.names.join('|'); pd.names = pd.names.filter(n => allNames.includes(n));
  if (hn.dataset.sig !== nsig) { hn.dataset.sig = nsig; hn.innerHTML = ''; hn.appendChild(buildMultiCombo(pd.names, allNames, arr => { pd.names = arr; pd.shown = 25; hn.dataset.sig = ''; pdRender(); }, { placeholder: 'Everyone' })); }
  const G = pdBuild(), T = plT(), all = G.reduce((a, g) => a.concat(g.all), []), K = atKpi, tot = f => G.reduce((a, g) => a + f(g.sum), 0);
  q('#pdInfo').textContent = `— ${plF(G.length)} staff · ${pd.from || '…'} → ${pd.to || '…'}`;
  q('#pdKpis').innerHTML = K('Staff', plF(G.length), `${plF(all.length)} employee-days`) + K('Present', plF(tot(u => u.present)), `${plF(tot(u => u.one))} with one punch only`) + K('Absent / no punch', plF(tot(u => u.absent + u.nop)), `${plF(tot(u => u.leave))} on leave · ${plF(tot(u => u.off))} off`) + K('Late arrivals', plF(tot(u => u.lateN)), `${plF(tot(u => u.lateM))} min in total (beyond ${at.grace} min grace)`) + K('Left early', plF(tot(u => u.earlyN)), `${plF(tot(u => u.earlyM))} min in total`) + K('Hours worked', plF(tot(u => u.wk), 0) + ' h', `${plF(tot(u => u.req), 0)} h required`);
  const shown = G.slice(0, pd.shown), n = PD_COLS.length, bad = '#d03b3b', warn = '#b45309', th = '<tr>' + PD_COLS.map(c => `<th>${plEsc(c)}</th>`).join('') + '</tr>';
  q('#pdTable').querySelector('thead').innerHTML = th;
  q('#pdTable').querySelector('tbody').innerHTML = shown.map(g => { const u = g.sum;
    return `<tr><td colspan="${n}" style="background:var(--gray-100,#eef2f7);font-weight:700;padding:7px 8px;border-top:2px solid var(--gray-300,#cbd5e1)">👤 ${plEsc(g.id)} · ${plEsc(g.name)} <span class="text-sm" style="font-weight:400;color:var(--gray-600)">${plEsc([g.pos, g.sec, g.sup && 'Supervisor: ' + g.sup, g.loc].filter(Boolean).join(' · '))}</span></td></tr>`
      + g.lines.map(l => '<tr>' + l.cells.map((v, i) => { let st = ''; if (i === 5 || i === 6) { if (v === 'Missing') st = `color:${bad};font-weight:700`; else if (i === 5 && l.lateF) st = `color:${bad};font-weight:600`; else if (i === 6 && l.earlyF) st = `color:${warn};font-weight:600`; } else if (i === 7 && v !== '') st = `color:${bad};font-weight:600`; else if (i === 8 && v !== '') st = `color:${warn};font-weight:600`; else if (i === 11 && v !== '') st = `color:${v < 0 ? bad : '#0ca30c'}`; return i === 12 ? atChipTd(l.r, v) : `<td style="${st}">${plEsc(v)}</td>`; }).join('') + '</tr>').join('')
      + `<tr style="font-weight:700;background:var(--gray-50,#f8fafc)"><td colspan="7">Total — ${u.days} day(s)${g.lines.length < g.all.length ? ' (all days, not only those shown)' : ''}</td><td>${u.lateN ? plF(u.lateM) + ' (' + u.lateN + '×)' : ''}</td><td>${u.earlyN ? plF(u.earlyM) + ' (' + u.earlyN + '×)' : ''}</td><td>${pdR1(u.wk)}</td><td>${pdR1(u.req)}</td><td>${u.req ? pdR1(u.wk - u.req) : ''}</td><td colspan="2" style="font-weight:400">${plEsc(pdSumTxt(u))}</td></tr>`; }).join('') || `<tr><td colspan="${n}" style="padding:16px;text-align:center;color:var(--gray-400);font-style:italic;">No punches for the current filters.</td></tr>`;
  q('#pdMore').style.display = G.length > pd.shown ? '' : 'none'; q('#pdMore').textContent = `Show more staff (${G.length - pd.shown} left)`; q('#pdNote').textContent = 'Late / early are counted only beyond the grace minutes in the filter bar. "Missing" = the other punch is not on the report.';
}
function pdData() {
  const G = pdBuild(), H = ['Employee no', 'Name', 'Position', 'Section', ...PD_COLS], rows = [];
  G.forEach(g => { g.lines.forEach(l => rows.push([g.id, g.name, g.pos || '', g.sec || '', ...l.cells])); const u = g.sum; rows.push([g.id, g.name + ' — TOTAL', '', '', `${u.days} day(s)`, '', '', '', '', '', '', u.lateN ? `${Math.round(u.lateM)} (${u.lateN}x)` : '', u.earlyN ? `${Math.round(u.earlyM)} (${u.earlyN}x)` : '', pdR1(u.wk), pdR1(u.req), u.req ? pdR1(u.wk - u.req) : '', pdSumTxt(u), '']); });
  const all = G.reduce((a, g) => a.concat(g.all), []);
  return { title: 'Staff attendance — punch detail', sheet: 'Punch detail', note: `${pd.from || '…'} → ${pd.to || '…'} · ${G.length} staff · ${all.length} employee-days${pd.show === 'exc' ? ' · exceptions only' : ''}`, headers: H, rows, totals: null };
}
function pdPrint() {
  const G = pdBuild(); if (!G.length) { sectionToast('Nothing to print.', 'warn'); return; } const e = plEsc, per = PLQ('#pdNew').checked, who = (typeof npUser === 'function' ? npUser() : ''), all = G.reduce((a, g) => a.concat(g.all), []);
  const css = '@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:10px "Segoe UI",Arial,sans-serif;color:#14213d;margin:0}h1{font-size:15px;margin:0}.sub{color:#51607f;margin:2px 0 8px;font-size:10px}.who{background:#1f4e79;color:#fff;padding:5px 8px;font-weight:700;font-size:11px;margin-top:8px}.who span{font-weight:400;opacity:.9;margin-left:8px}table{border-collapse:collapse;width:100%}th{background:#dce6f1;text-align:left;padding:3px 5px;border:1px solid #b8c4d6;font-size:9px}td{padding:2.5px 5px;border:1px solid #d5dce8}tr:nth-child(even) td{background:#f7f9fc}.t td{font-weight:700;background:#eef2f7!important}.b{color:#d03b3b;font-weight:700}.w{color:#b45309;font-weight:700}';
  const body = G.map((g, i) => { const u = g.sum; return `<section style="${per && i < G.length - 1 ? 'page-break-after:always;' : ''}${!per ? 'margin-bottom:10px;' : ''}"><div class="who">${e(g.id)} · ${e(g.name)}<span>${e([g.pos, g.sec, g.sup && 'Supervisor: ' + g.sup, g.loc].filter(Boolean).join(' · '))}</span></div><table><thead><tr>${PD_COLS.map(c => `<th>${e(c)}</th>`).join('')}</tr></thead><tbody>`
    + g.lines.map(l => '<tr>' + l.cells.map((v, k) => `<td class="${(k === 5 && (l.lateF || v === 'Missing')) || (k === 6 && v === 'Missing') || k === 7 && v !== '' ? 'b' : (k === 6 && l.earlyF) || (k === 8 && v !== '') ? 'w' : ''}">${e(v)}</td>`).join('') + '</tr>').join('')
    + `<tr class="t"><td colspan="7">Total — ${u.days} day(s)</td><td>${u.lateN ? plF(u.lateM) + ' (' + u.lateN + '×)' : ''}</td><td>${u.earlyN ? plF(u.earlyM) + ' (' + u.earlyN + '×)' : ''}</td><td>${pdR1(u.wk)}</td><td>${pdR1(u.req)}</td><td>${u.req ? pdR1(u.wk - u.req) : ''}</td><td colspan="2">${e(pdSumTxt(u))}</td></tr></tbody></table></section>`; }).join('');
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Staff attendance — punch detail</title><style>${css}</style></head><body><h1>Staff attendance — punch detail</h1><div class="sub">${e(pd.from || '…')} → ${e(pd.to || '…')} · ${G.length} staff · ${all.length} employee-days · late / early beyond ${at.grace} min grace${who ? ' · printed by ' + e(who) : ''}</div>${body}</body></html>`;
  npOpenPrint(doc, 'Punch detail'); addActivity('export', 'Printed attendance punch detail');
}
(function () { const q = PLQ;
  q('#pdFrom').addEventListener('change', e => { pd.from = e.target.value; pd.shown = 25; pdRender(); }); q('#pdTo').addEventListener('change', e => { pd.to = e.target.value; pd.shown = 25; pdRender(); }); q('#pdShow').addEventListener('change', e => { pd.show = e.target.value; pd.shown = 25; pdRender(); });
  document.querySelectorAll('#view-att [data-pdq]').forEach(b => b.addEventListener('click', () => { const ds = atDates(), last = ds[ds.length - 1] || ''; if (b.dataset.pdq === 'last') pd.from = pd.to = last; else if (b.dataset.pdq === '7') { pd.from = roAdd(last, -6); pd.to = last; } else { pd.from = ds[0] || ''; pd.to = last; } pd.shown = 25; pdRender(); }));
  q('#pdMore').addEventListener('click', () => { pd.shown += 25; pdRender(); });
  q('#pdExcel').addEventListener('click', () => a2Export(pdData())); q('#pdPrint').addEventListener('click', pdPrint); q('#pdEmail').addEventListener('click', () => a2Mail(pdData)); q('#pdExpand').addEventListener('click', () => a2Expand(pdData()));
})();

/* ============ 2 · TODAY'S ROSTER vs YESTERDAY'S ATTENDANCE ============ */
const A2_TY_COL = { 'Short rest': '#d03b3b', 'Planned · absent yesterday': '#a1264b', 'Planned · no record yesterday': '#a1264b', 'Planned · missing punch yesterday': '#8e6fd0', 'Back from leave': '#2a78d6', 'Back from day off': '#6cc3cf', 'Shift change': '#fab219', 'Same shift as yesterday': '#0ca30c', 'Off today · worked yesterday': '#9bd69b', 'Off / leave today': '#cbd5e1', 'Attended · not in roster': '#d65db1', 'Planned · new (no attendance yet)': '#94a3b8' };
const A2_TY_EXC = new Set(['Short rest', 'Planned · absent yesterday', 'Planned · no record yesterday', 'Planned · missing punch yesterday', 'Attended · not in roster', 'Shift change']);
const tyCol = r => A2_TY_COL[r] || '#94a3b8';
let a2TyCache = null;
function a2TyDates() {
  const q = PLQ; if (!a2.ty.d) { const t = roIsoLocal(new Date()), last = atLast(); a2.ty.d = (ro.days[t] && Object.keys(ro.days[t]).length) || !last ? t : (Object.keys(ro.days[roAdd(last, 1)] || {}).length ? roAdd(last, 1) : t); }
  if (a2.ty.auto || !a2.ty.a) a2.ty.a = roAdd(a2.ty.d, -1); q('#tyDate').value = a2.ty.d; q('#tyAtt').value = a2.ty.a; q('#tyRest').value = a2.cfg.rest;
}
function a2TyBuild() {
  const D = a2.ty.d, A = a2.ty.a, rest = a2.cfg.rest, V = atView().filter(r => r.date === A), byId = new Map(), byNm = new Map(), out = [], used = new Set();
  ro.staff.forEach(s => { byId.set(atKey(s.id), s); byNm.set(atNm(s.name), s); });
  const planned = id => { const x = roPerson(D, id); return x; };
  const mk = (r, s) => {
    const x = s ? planned(s.id) : null, work = x && x.n > 0 && x.pill !== 'Off' && x.pill !== 'Leave', worked = r && (r.st === 'Present' || r.st === 'One punch'), c = r ? a2Calc(r) : null;
    const o = { r, s, x, c, res: '', gap: null, store: (r && a2Store(r)) || (s && roAreaOf(D, s.id)) || '(not in attendance)' };
    if (work) {
      const f = roM(x.from);
      if (!r) o.res = 'Planned · no record yesterday';
      else if (r.st === 'Leave') o.res = 'Back from leave'; else if (r.st === 'Absent' || r.st === 'No punch') o.res = 'Planned · absent yesterday'; else if (r.st === 'Off') o.res = 'Back from day off';
      else if (r.st === 'One punch' && r.outT == null) o.res = 'Planned · missing punch yesterday';
      else if (worked) {
        const inn = r.inT != null ? r.inT : null; let end = r.outT; if (end != null && inn != null && end <= inn) end += 1440;
        if (end != null && f != null) { o.gap = (f + 1440 - end) / 60; }
        if (o.gap != null && o.gap < rest) o.res = 'Short rest';
        else { const ytype = r.sType || (inn != null ? (inn >= 300 && inn < 900 ? 'Day' : 'Night') : ''), ttype = /night/i.test(x.shift) ? 'Night' : /day/i.test(x.shift) ? 'Day' : (f != null && f >= 300 && f < 900 ? 'Day' : 'Night'); o.res = ytype && ttype && ytype !== ttype ? 'Shift change' : 'Same shift as yesterday'; }
      } else o.res = 'Planned · absent yesterday';
    } else if (s) { o.res = worked ? 'Off today · worked yesterday' : 'Off / leave today'; }
    else o.res = 'Attended · not in roster';
    return o;
  };
  V.forEach(r => { const s = byId.get(atKey(r.id)) || byNm.get(atNm(r.name)); if (s) used.add(s.id); out.push(mk(r, s)); });
  if (!atFiltersActive(['date'])) ro.staff.filter(s => s.active !== false && !used.has(s.id)).forEach(s => { const x = planned(s.id); if (x.n > 0 && x.pill !== 'Off' && x.pill !== 'Leave') out.push(Object.assign(mk(null, s), { res: V.length ? 'Planned · no record yesterday' : 'Planned · new (no attendance yet)' })); });
  return { rows: out, planned: out.filter(o => o.x && o.x.n > 0 && !['Off', 'Leave'].includes(o.x.pill)), covered: Object.keys(ro.days[D] || {}).length > 0, hasAtt: V.length > 0 };
}
const TY_COLS = [['Employee no', o => o.r ? o.r.id : (o.s ? o.s.id : '')], ['Name', o => o.r ? o.r.name : (o.s ? o.s.name : '')], ['Position', o => o.r ? o.r.pos : (o.s ? o.s.role : '')], ['Store', o => o.store], ['Yesterday', o => o.r ? o.r.st : 'No record'], ['IN', o => o.r ? atHM(o.r.inT) : '', o => o.r && o.r.inT != null ? o.r.inT : -1], ['OUT', o => o.r ? atHM(o.r.outT) : '', o => o.r && o.r.outT != null ? o.r.outT : -1], a2nc('Worked h', o => o.c ? o.c.h : 0), a2nc('OT h', o => o.c ? o.c.ot : 0), ['Today plan', o => o.x ? o.x.pill : ''], ['From', o => o.x && o.x.n ? o.x.from : ''], ['To', o => o.x && o.x.n ? o.x.to : ''], a2nc('Net h today', o => o.x && o.x.n ? o.x.net : 0), a2nc('Rest gap h', o => o.gap), ['Outcome', o => o.res]];
const tyRows = () => { let R = a2TyCache.rows; if (a2.ty.show === 'exc') R = R.filter(o => A2_TY_EXC.has(o.res)); if (a2.ty.res.length) R = R.filter(o => a2.ty.res.includes(o.res)); if (a2.ty.st.length) R = R.filter(o => a2.ty.st.includes(o.store)); return R; };
const a2Tog = (arr, v) => arr.length === 1 && arr[0] === v ? [] : [v];
const TY_DEFS = [];
TY_DEFS.push({ id: 'tymix', title: 'Outcome', sub: 'Click a slice to filter the table', span: 's5', draw(host, c) { const R = a2TyCache.rows, res = Object.keys(A2_TY_COL).filter(k => R.some(o => o.res === k)), sl = res.map(k => ({ label: k, value: R.filter(o => o.res === k).length, color: tyCol(k) })); if (!sl.length) { plEmpty(host, 'Nothing to compare.'); return {}; } plcDonut(host, { slices: sl, center: { value: plF(R.length), label: 'people' }, unit: 'people', onClick: s => { a2.ty.res = a2Tog(a2.ty.res, s.label); a2TyFilters(); a2TyTable(); } }); return { table: { headers: ['Outcome', 'People', 'Share'], rows: sl.map(s => [s.label, s.value, R.length ? plP(s.value / R.length, 1) : '']) } }; } });
TY_DEFS.push({ id: 'tystore', title: 'Yesterday’s headcount vs today’s plan', sub: 'People who worked yesterday and people planned to work today, per store', span: 's7', draw(host, c) {
  const R = a2TyCache.rows, gm = new Map(); R.forEach(o => { let g = gm.get(o.store); if (!g) gm.set(o.store, g = { k: o.store, rows: [] }); g.rows.push(o); });
  const g = [...gm.values()].map(x => ({ k: x.k, y: x.rows.filter(o => o.r && (o.r.st === 'Present' || o.r.st === 'One punch')).length, t: x.rows.filter(o => o.x && o.x.n > 0 && !['Off', 'Leave'].includes(o.x.pill)).length })).sort((a, b) => b.t + b.y - a.t - a.y).slice(0, 12); if (!g.length) { plEmpty(host, 'Nothing to compare.'); return {}; }
  plcBarsH(host, { rows: g.map(x => ({ label: x.k, key: x.k, vals: [x.y, x.t], tip: [{ c: c.T.act, k: 'Worked yesterday', v: plF(x.y) }, { c: c.T.good, k: 'Planned today', v: plF(x.t) }] })), series: [{ name: 'Worked yesterday', color: c.T.act }, { name: 'Planned today', color: c.T.good }], fmt: v => plF(v), tickFmt: v => plF(v), thick: 12 });
  return { legend: [{ name: 'Worked yesterday', c: c.T.act }, { name: 'Planned today', c: c.T.good }], table: { headers: ['Store', 'Worked yesterday', 'Planned today', 'Difference'], rows: g.map(x => [x.k, x.y, x.t, x.t - x.y]) } }; } });
TY_DEFS.push({ id: 'tyrest', title: 'Rest between yesterday’s OUT and today’s start', sub: 'People worked yesterday and planned today — hours of rest', span: 's6', draw(host, c) {
  const P = a2TyCache.rows.filter(o => o.gap != null), B = [['< 6 h', -99, 6], ['6 – 8 h', 6, 8], ['8 – 10 h', 8, 10], ['10 – 12 h', 10, 12], ['12 – 16 h', 12, 16], ['16 h +', 16, 999]], n = (lo, hi) => P.filter(o => o.gap >= lo && o.gap < hi).length;
  plcCols(host, { cats: B.map((b, i) => ({ label: b[0], vals: [n(b[1], b[2])], tip: [{ c: c.T.act, k: 'People', v: plF(n(b[1], b[2])) }] })), series: [{ name: 'People', color: c.T.act }], fmt: v => plF(v), labelFn: (cat, v) => v ? plF(v) : '', height: 240 }); return { table: { headers: ['Rest', 'People'], rows: B.map(b => [b[0], n(b[1], b[2])]) } }; } });
TY_DEFS.push({ id: 'tyot', title: 'Yesterday’s overtime of people planned today', sub: 'Calculated OT hours by store — who is tired and working again', span: 's6', draw(host, c) {
  const P = a2TyCache.rows.filter(o => o.c && o.c.ot > 0 && o.x && o.x.n > 0 && !['Off', 'Leave'].includes(o.x.pill)), gm = new Map(); P.forEach(o => { gm.set(o.store, (gm.get(o.store) || 0) + o.c.ot); }); const g = [...gm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12); if (!g.length) { plEmpty(host, 'Nobody with overtime yesterday is planned today.'); return {}; }
  plcBarsH(host, { rows: g.map(([k, v]) => ({ label: k, key: k, vals: [v], tip: [{ c: c.T.act, k: 'OT h yesterday', v: plF(v, 1) }] })), series: [{ name: 'OT h', color: c.T.act }], fmt: v => plF(v, 1), tickFmt: v => plF(v), thick: 14 }); return { table: { headers: ['Store', 'OT h'], rows: g.map(([k, v]) => [k, a2f(v)]) } }; } });
function a2TyKpis() {
  const A = a2TyCache, P = A.planned, R = A.rows, c = res => R.filter(o => o.res === res).length, worked = R.filter(o => o.r && (o.r.st === 'Present' || o.r.st === 'One punch')).length, K = atKpi;
  PLQ('#tyKpis').innerHTML = K('Planned today', plF(P.length), `${plF(P.reduce((a, o) => a + o.x.net, 0), 0)} h net of breaks`) + K('Worked yesterday', plF(worked), `${atDateLabel(a2.ty.a)} · ${plF(R.filter(o => o.r).length)} records`) + K('Same shift again', plF(c('Same shift as yesterday')), 'continuing the same pattern') + K('Shift change', plF(c('Shift change')), 'day ↔ night', 'ty:Shift change')
    + K('Short rest', plF(c('Short rest')), `less than ${a2.cfg.rest} h between OUT and start`, 'ty:Short rest') + K('Planned but absent yesterday', plF(c('Planned · absent yesterday') + c('Planned · no record yesterday')), 'check they are coming back', 'ty:Planned · absent yesterday') + K('Back from leave / off', plF(c('Back from leave') + c('Back from day off')), 'returning today') + K('Attended, not in roster', plF(c('Attended · not in roster')), 'add them to the roster', 'ty:Attended · not in roster');
}
function a2TyFilters() {
  const rs = Object.keys(A2_TY_COL).filter(k => a2TyCache.rows.some(o => o.res === k)), sts = [...new Set(a2TyCache.rows.map(o => o.store))].sort();
  const mk = (id, sel, opts, fn) => { const h = PLQ(id); h.innerHTML = ''; h.appendChild(buildMultiCombo(sel.filter(v => opts.includes(v)), opts, fn, { placeholder: 'All' })); };
  mk('#tyResHost', a2.ty.res, rs, arr => { a2.ty.res = arr; a2TyTable(); }); mk('#tyStoreHost', a2.ty.st, sts, arr => { a2.ty.st = arr; a2TyTable(); });
}
function a2TyTable() { const R = tyRows(); PLQ('#tyInfo').innerHTML = `— ${plF(R.length)} of ${plF(a2TyCache.rows.length)} people` + (a2.ty.res.length || a2.ty.st.length ? ` · filtered <a href="#" id="tyClr">✖ clear</a>` : ''); const cl = PLQ('#tyClr'); if (cl) cl.onclick = e => { e.preventDefault(); a2.ty.res = []; a2.ty.st = []; a2TyFilters(); a2TyTable(); };
  atTblDraw(PLQ('#tyTable'), TY_COLS, R, 'ty', at.tyShown || 200, PLQ('#tyMore'), (c, o) => c[0] === 'Outcome' ? a2Chip(o.res, tyCol(o.res)) : c[0] === 'Rest gap h' && o.gap != null && o.gap < a2.cfg.rest ? `<td style="color:#b42318;font-weight:600">${plEsc(a2f(o.gap))}</td>` : null); }
function a2TyRender(tableOnly) {
  a2Bump(); a2TyDates(); if (!tableOnly || !a2TyCache) a2TyCache = a2TyBuild(); const A = a2TyCache;
  PLQ('#tyCover').innerHTML = (A.covered ? `✔ roster has a plan for <strong>${atDateLabel(a2.ty.d)}</strong>` : `<span style="color:#b45309">⚠ The roster has no plan for ${atDateLabel(a2.ty.d)} — fill it in Staff Roster › Daily availability.</span>`) + '<br>' + (A.hasAtt ? `✔ attendance for <strong>${atDateLabel(a2.ty.a)}</strong>` : `<span style="color:#b45309">⚠ No attendance record for ${atDateLabel(a2.ty.a)}. Loaded: ${atDates().map(atDateLabel).join(', ')}</span>`);
  a2TyFilters(); a2TyKpis(); a2TyTable(); atDrawGrid(PLQ('#tyGrid'), TY_DEFS, { rows: () => a2TyCache.rows });
}
const a2TyData = () => { const R = atSortRows(tyRows(), TY_COLS, at.sort.ty); return a2Data('Today’s roster vs yesterday’s attendance', 'Roster vs yesterday', `Roster ${a2.ty.d} · attendance ${a2.ty.a} · minimum rest ${a2.cfg.rest} h`, TY_COLS, R); };
function a2TyInit() {
  const q = PLQ, setD = d => { a2.ty.d = d; a2.ty.auto = true; at.tyShown = 200; a2.ty.res = []; a2TyRender(); };
  q('#tyDate').addEventListener('change', e => { if (e.target.value) setD(e.target.value); }); q('#tyPrev').addEventListener('click', () => setD(roAdd(a2.ty.d || roIsoLocal(new Date()), -1))); q('#tyNext').addEventListener('click', () => setD(roAdd(a2.ty.d || roIsoLocal(new Date()), 1)));
  q('#tyAtt').addEventListener('change', e => { if (!e.target.value) return; a2.ty.a = e.target.value; a2.ty.auto = false; a2.ty.res = []; a2TyRender(); });
  q('#tyRest').addEventListener('change', e => { const v = parseFloat(e.target.value); a2.cfg.rest = isNaN(v) ? 10 : Math.max(0, Math.min(24, v)); a2Save(); a2TyRender(); });
  q('#tyShow').addEventListener('change', e => { a2.ty.show = e.target.value; a2TyTable(); }); q('#tyMore').addEventListener('click', () => { at.tyShown = (at.tyShown || 200) + 200; a2TyTable(); });
  q('#tyKpis').addEventListener('click', e => { const k = e.target.closest('.pl-kpi[data-f]'); if (!k) return; const [t, v] = k.dataset.f.split(':'); if (t === 'ty') { a2.ty.res = a2Tog(a2.ty.res, v); a2TyFilters(); a2TyTable(); } });
  q('#tyExcel').addEventListener('click', () => a2Export(a2TyData())); q('#tyPrint').addEventListener('click', () => a2Print(a2TyData())); q('#tyEmail').addEventListener('click', () => a2Mail(a2TyData)); q('#tyExpand').addEventListener('click', () => a2Expand(a2TyData()));
}

