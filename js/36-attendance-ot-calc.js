/* ============ 3 · CALCULATED OT vs MNGT DAILY REPORT ============ */
let a2LkCache = null;
function a2LkBuild() {
  const V = atView(), ent = a2Entered(), tot = a2.cfg.lkView === 'total', em = new Map(), g = new Map(), hb = a2.cfg.lkBasis !== 'ot';
  ent.forEach(r => { const k = a2nk(r.wh) + '|' + r.date; let o = em.get(k); if (!o) em.set(k, o = { nh: 0, not: 0, wo: 0, po: 0, staff: 0, n: 0 }); o.nh += r.nh || 0; o.not += r.not; o.wo += r.wo; o.po += r.po; o.staff += r.staff || 0; o.n++; });
  V.forEach(r => {
    if (!a2RowOk(r)) return; const store = a2StoreRaw(r), L = a2RecLink(r), grp = L ? L.wh : store, k = grp + (tot ? '' : '|' + r.date); let o = g.get(k); if (!o) g.set(k, o = { grp, linked: !!L, stores: new Set(), date: tot ? '' : r.date, dates: new Set(), sd: new Map(), a: { nh: 0, not: 0, wo: 0, po: 0 } });
    const c = a2Meas(r); o.stores.add(store); o.dates.add(r.date); o.a.nh += c.nh; o.a.not += c.not; o.a.wo += c.wo; o.a.po += c.po; if (c.pr) { let q = o.sd.get(r.date); if (!q) o.sd.set(r.date, q = new Set()); q.add(a2AKey(r)); }
  });
  const rows = [...g.values()].map(o => {
    const e = { nh: 0, not: 0, wo: 0, po: 0, staff: 0, found: 0 }; o.dates.forEach(d => { const x = em.get(a2nk(o.grp) + '|' + d); if (x) { e.nh += x.nh; e.not += x.not; e.wo += x.wo; e.po += x.po; e.staff += x.staff; e.found++; } });
    o.e = e; o.a.ot = o.a.not + o.a.wo + o.a.po; e.ot = e.not + e.wo + e.po; o.a.hrs = o.a.nh + o.a.ot; e.hrs = e.nh + e.ot; o.days = o.dates.size;
    let sa = 0; o.sd.forEach(q => { sa += q.size; }); o.a.staff = o.days ? sa / o.days : 0; e.staff = e.found ? e.staff / e.found : 0;
    o.dOT = o.a.ot - e.ot; o.dH = o.a.hrs - e.hrs; const d = hb ? o.dH : o.dOT; o.diff = d;
    o.res = !ent.length ? 'No Mngt data loaded' : !o.linked && !e.found ? 'Not linked' : !e.found ? 'Not entered' : Math.abs(d) <= a2.cfg.tol ? 'Match' : d > 0 ? 'Entered less than attendance' : 'Entered more than attendance'; return o;
  });
  rows.sort((a, b) => a.grp.localeCompare(b.grp) || a.date.localeCompare(b.date)); return { rows, ent: ent.length };
}
const LK_COL = { 'Match': '#0ca30c', 'Entered less than attendance': '#ec835a', 'Entered more than attendance': '#2a78d6', 'Not entered': '#d03b3b', 'Not linked': '#a1264b', 'No Mngt data loaded': '#94a3b8' };
const lkCol = r => LK_COL[r] || '#94a3b8';
const LK_COLS = () => { const t = a2.cfg.lkView === 'total'; return [['Mngt warehouse / store', o => o.grp], ['Attendance store(s)', o => [...o.stores].join(' + ')], ...(t ? [a2nc('Days', o => o.days), a2nc('Days entered', o => o.e.found)] : [['Date', o => atDateLabel(o.date), o => o.date]]),
  a2nc('Staff · attendance', o => o.a.staff), a2nc('Staff · entered', o => o.e.staff), a2nc('Δ Staff', o => o.a.staff - o.e.staff),
  a2nc('Normal hrs · attendance', o => o.a.nh), a2nc('Normal hrs · entered', o => o.e.nh), a2nc('Δ Normal hrs', o => o.a.nh - o.e.nh),
  a2nc('Normal OT · attendance', o => o.a.not), a2nc('Normal OT · entered', o => o.e.not), a2nc('Δ Normal OT', o => o.a.not - o.e.not),
  a2nc('Week-off OT · attendance', o => o.a.wo), a2nc('Week-off OT · entered', o => o.e.wo), a2nc('Δ Week-off', o => o.a.wo - o.e.wo),
  a2nc('Public OT · attendance', o => o.a.po), a2nc('Public OT · entered', o => o.e.po), a2nc('Δ Public', o => o.a.po - o.e.po),
  a2nc('Total OT · attendance', o => o.a.ot), a2nc('Total OT · entered', o => o.e.ot), a2nc('Δ Total OT', o => o.dOT),
  a2nc('Working hrs · attendance', o => o.a.hrs), a2nc('Working hrs · entered', o => o.e.hrs), a2nc('Δ Working hrs', o => o.dH), ['Result', o => o.res]]; };
const lkRows = () => { let R = a2LkCache.rows; if (a2.cfg.lkShow === 'exc') R = R.filter(o => o.res !== 'Match'); if (a2.lkRes.length) R = R.filter(o => a2.lkRes.includes(o.res)); if (a2.lkWh.length) R = R.filter(o => a2.lkWh.includes(o.grp)); return R; };
const LK_DEFS = [];
LK_DEFS.push({ id: 'lkstore', title: 'Total OT per store', sub: 'Calculated from attendance vs entered in the Mngt Daily Report', span: 's7', draw(host, c) {
  const gm = new Map(); a2LkCache.rows.forEach(o => { let x = gm.get(o.grp); if (!x) gm.set(o.grp, x = { k: o.grp, a: 0, e: 0 }); x.a += o.a.ot; x.e += o.e.ot; }); const g = [...gm.values()].sort((a, b) => Math.max(b.a, b.e) - Math.max(a.a, a.e)).slice(0, 14); if (!g.length) { plEmpty(host, 'Nothing to compare.'); return {}; }
  plcBarsH(host, { rows: g.map(x => ({ label: x.k, key: x.k, vals: [x.a, x.e], tip: [{ c: c.T.act, k: 'Attendance (calculated)', v: plF(x.a, 1) + ' h' }, { c: c.T.fc, k: 'Entered (Mngt report)', v: plF(x.e, 1) + ' h' }, { k: 'Difference', v: plF(x.a - x.e, 1) + ' h' }] })), series: [{ name: 'Attendance', color: c.T.act }, { name: 'Entered', color: c.T.fc }], fmt: v => plF(v, 1), tickFmt: v => plF(v), thick: 12 });
  return { legend: [{ name: 'Attendance (calculated)', c: c.T.act }, { name: 'Entered in Mngt report', c: c.T.fc }], table: { headers: ['Store', 'Attendance h', 'Entered h', 'Difference'], rows: g.map(x => [x.k, a2f(x.a), a2f(x.e), a2f(x.a - x.e)]) } }; } });
LK_DEFS.push({ id: 'lkmix', title: 'Result', sub: 'Click a slice to filter the table', span: 's5', draw(host, c) { const R = a2LkCache.rows, res = Object.keys(LK_COL).filter(k => R.some(o => o.res === k)), sl = res.map(k => ({ label: k, value: R.filter(o => o.res === k).length, color: lkCol(k) })); if (!sl.length) { plEmpty(host, 'Nothing to compare.'); return {}; } plcDonut(host, { slices: sl, center: { value: plF(R.length), label: 'rows' }, unit: 'rows', onClick: s => { a2.lkRes = a2Tog(a2.lkRes, s.label); a2LkFilters(); a2LkTable(); } }); return { table: { headers: ['Result', 'Rows', 'Share'], rows: sl.map(s => [s.label, s.value, R.length ? plP(s.value / R.length, 1) : '']) } }; } });
LK_DEFS.push({ id: 'lktype', title: 'By overtime type', sub: 'All compared stores — attendance vs entered', span: 's6', draw(host, c) {
  const R = a2LkCache.rows, S = [['Normal OT', 'not'], ['Week-off OT', 'wo'], ['Public OT', 'po']], sm = (s, who) => R.reduce((a, o) => a + o[who][s], 0); if (!R.length) { plEmpty(host, 'Nothing to compare.'); return {}; }
  plcCols(host, { cats: S.map(s => ({ label: s[0], vals: [sm(s[1], 'a'), sm(s[1], 'e')], tip: [{ c: c.T.act, k: 'Attendance', v: plF(sm(s[1], 'a'), 1) + ' h' }, { c: c.T.fc, k: 'Entered', v: plF(sm(s[1], 'e'), 1) + ' h' }] })), series: [{ name: 'Attendance', color: c.T.act }, { name: 'Entered', color: c.T.fc }], fmt: v => plF(v, 1), labelFn: (cat, v) => v ? plF(v, 0) : '', height: 250 });
  return { legend: [{ name: 'Attendance', c: c.T.act }, { name: 'Entered', c: c.T.fc }], table: { headers: ['Type', 'Attendance h', 'Entered h', 'Difference'], rows: S.map(s => [s[0], a2f(sm(s[1], 'a')), a2f(sm(s[1], 'e')), a2f(sm(s[1], 'a') - sm(s[1], 'e'))]) } }; } });
LK_DEFS.push({ id: 'lkday', title: 'By day', sub: 'Total OT per date — attendance vs entered', span: 's6', draw(host, c) {
  const dm = new Map(); a2LkCache.rows.forEach(o => o.dates.forEach(d => { if (a2.cfg.lkView === 'total' || d === o.date) { let x = dm.get(d); if (!x) dm.set(d, x = { a: 0, e: 0 }); } })); if (a2.cfg.lkView !== 'total') a2LkCache.rows.forEach(o => { const x = dm.get(o.date); x.a += o.a.ot; x.e += o.e.ot; });
  else { const V = atView(); V.forEach(r => { const x = dm.get(r.date); if (x) x.a += a2Calc(r).ot; }); const gk = new Set(a2LkCache.rows.map(o => a2nk(o.grp))); a2Entered().forEach(r => { const x = dm.get(r.date); if (x && gk.has(a2nk(r.wh))) x.e += r.not + r.wo + r.po; }); }
  const ds = [...dm.keys()].sort(); if (!ds.length) { plEmpty(host, 'Nothing to compare.'); return {}; }
  plcCols(host, { cats: ds.map(d => ({ label: atDateLabel(d), vals: [dm.get(d).a, dm.get(d).e], tip: [{ c: c.T.act, k: 'Attendance', v: plF(dm.get(d).a, 1) + ' h' }, { c: c.T.fc, k: 'Entered', v: plF(dm.get(d).e, 1) + ' h' }] })), series: [{ name: 'Attendance', color: c.T.act }, { name: 'Entered', color: c.T.fc }], fmt: v => plF(v, 1), labelFn: (cat, v) => v ? plF(v, 0) : '', height: 250 });
  return { legend: [{ name: 'Attendance', c: c.T.act }, { name: 'Entered', c: c.T.fc }], table: { headers: ['Date', 'Attendance h', 'Entered h', 'Difference'], rows: ds.map(d => [atDateLabel(d), a2f(dm.get(d).a), a2f(dm.get(d).e), a2f(dm.get(d).a - dm.get(d).e)]) } }; } });
function a2LkRange() {
  const el = document.querySelector('#atLkRange'); if (!el) return; if (!at.rows.length) { el.style.display = 'none'; return; }
  const L = d => d ? atDateLabel(d) : '—', rng = ds => ds.length ? `${L(ds[0])} → ${L(ds[ds.length - 1])} (${ds.length} day${ds.length > 1 ? 's' : ''})` : 'no days', vd = () => [...new Set(atView().map(r => r.date))].sort(), warn = t => `<span style="color:#b45309">⚠ ${t}</span>`, good = t => `<span style="color:#0b7a0b">✔ ${t}</span>`; let h = '';
  if (at.tab === 'up') h = `Loaded period: ${rng(atDates())}`;
  else if (at.tab === 'ty') h = `Plan day: ${L(a2.ty.d)} · Attendance day: ${L(a2.ty.a)}`;
  else if (at.tab === 'cmp') { const ds = vd(); h = `Compared: ${rng(ds)}`; if (cmCache && cmCache.covered && ds.length) { const m = ds.filter(d => !cmCache.covered.has(d)).length; h += ' · ' + (m ? warn(`${m} day(s) without a roster plan`) : good('roster plan covers all days')); } }
  else if (at.tab === 'lk') { const cd = vd(), ed = [...new Set(a2Entered().map(r => r.date).filter(Boolean))].sort(), es = new Set(ed), miss = cd.filter(d => !es.has(d)).length; h = `OT vs Mngt report: ${rng(cd)}` + (ed.length ? ` · Mngt data: ${L(ed[0])} → ${L(ed[ed.length - 1])} · ` + (miss ? warn(`${miss} day(s) without Mngt data`) : good('all days covered')) : ' · ' + warn('Mngt report data not loaded')); }
  else h = `Showing: ${rng(vd())}`;
  const out = '📅 ' + h; if (el.dataset.h !== out) { el.dataset.h = out; el.innerHTML = out; } el.style.display = '';
}
setInterval(() => { try { if (document.querySelector('#view-att.active')) a2LkRange(); } catch (e) {} }, 700);
function a2LkKpis() {
  try { a2LkRange(); } catch (e) {}
  const A = a2LkCache, R = A.rows, c = k => R.filter(o => o.res === k).length, hb = a2.cfg.lkBasis !== 'ot', gv = o => hb ? o.a.hrs : o.a.ot, ge = o => hb ? o.e.hrs : o.e.ot, sa = R.reduce((a, o) => a + gv(o), 0), se = R.reduce((a, o) => a + ge(o), 0), K = atKpi, st = new Set(R.map(o => o.grp)).size, nm = hb ? 'Working hrs' : 'OT';
  PLQ('#lkKpis').innerHTML = K('Compared', plF(R.length), `${plF(st)} store(s) · ${a2.cfg.lkView === 'total' ? 'whole period' : 'per day'}`) + K('Match', plF(c('Match')), R.length ? plP(c('Match') / R.length, 0) + ` within ±${a2.cfg.tol} h` : '', 'lk:Match') + K('Entered less than attendance', plF(c('Entered less than attendance')), 'hours worked but not entered', 'lk:Entered less than attendance') + K('Entered more than attendance', plF(c('Entered more than attendance')), 'hours entered above the attendance', 'lk:Entered more than attendance')
    + K('Not entered', plF(c('Not entered')), 'no Mngt row for that store / day', 'lk:Not entered') + K('Not linked', plF(c('Not linked')), 'staff not found in the Employees list / no warehouse', 'lk:Not linked') + K(nm + ' · attendance', plF(sa, 1) + ' h', 'from the attendance file') + K(nm + ' · entered', plF(se, 1) + ' h', 'Mngt Daily Report list') + K('Difference', (sa - se > 0 ? '+' : '') + plF(sa - se, 1) + ' h', 'attendance − entered');
}
function a2LkFilters() {
  const rs = Object.keys(LK_COL).filter(k => a2LkCache.rows.some(o => o.res === k)), whs = [...new Set(a2LkCache.rows.map(o => o.grp))].sort();
  const mk = (id, sel, opts, fn) => { const h = PLQ(id); h.innerHTML = ''; h.appendChild(buildMultiCombo(sel.filter(v => opts.includes(v)), opts, fn, { placeholder: 'All' })); };
  mk('#lkResHost', a2.lkRes, rs, arr => { a2.lkRes = arr; a2LkTable(); }); mk('#lkWhHost', a2.lkWh, whs, arr => { a2.lkWh = arr; a2LkTable(); });
}
function a2LkTable() { const R = lkRows(), cols = LK_COLS(); PLQ('#lkInfo').innerHTML = `— ${plF(R.length)} of ${plF(a2LkCache.rows.length)} rows` + (a2.lkRes.length || a2.lkWh.length ? ` · filtered <a href="#" id="lkClr">✖ clear</a>` : ''); const cl = PLQ('#lkClr'); if (cl) cl.onclick = e => { e.preventDefault(); a2.lkRes = []; a2.lkWh = []; a2LkFilters(); a2LkTable(); };
  atTblDraw(PLQ('#lkTable'), cols, R, 'lk', at.lkShown || 200, PLQ('#lkMore'), (c, o) => c[0] === 'Result' ? a2Chip(o.res, lkCol(o.res)) : c[0].startsWith('Δ') ? (v => `<td style="${Math.abs(v) > a2.cfg.tol ? 'color:#b42318;font-weight:600' : ''}">${plEsc(a2f(v))}</td>`)(c[2](o)) : null); }
/* ---- link panel: attendance Store → WHs Desc, Work location → Area (Region_Desc), Store → Regions (BU_Decs) ---- */
const a2Uniq = a => [...new Set(a.filter(Boolean))].sort((x, y) => String(x).localeCompare(String(y)));
const a2AreaNames = () => a2Uniq([...a2Entered().map(r => r.area), ...((mg.trg || []).map(t => t.area))]);
const a2RegNames = () => a2Uniq([...a2Entered().map(r => r.region), ...((mg.trg || []).map(t => t.region))]);
function a2NameAuto(v, names) { if (!names.length) return ''; const k = a2nk(v); let h = names.find(n => a2nk(n) === k); if (h) return h; const c = a2Core(v); if (c) { const cand = names.filter(n => { const x = a2Core(n); return x && (x.includes(c) || c.includes(x)); }); if (cand.length === 1) return cand[0]; } return ''; }
const a2AreaOf = loc => a2.cfg.areaMap[loc] || a2NameAuto(loc, a2AreaNames());
function a2WhInfo(wh) { const k = a2nk(wh), r = a2Entered().find(x => a2nk(x.wh) === k); return r ? { area: r.area, region: r.region } : null; }
const a2RegionOf = (store, wh) => a2.cfg.regMap[store] || (wh && (a2WhInfo(wh) || {}).region) || '';
const a2AreaFor = (loc, wh) => a2.cfg.areaMap[loc] || (wh && (a2WhInfo(wh) || {}).area) || a2NameAuto(loc, a2AreaNames()) || '';
/* ---------- build your own staff → warehouse link (by File Nr), edit one by one, in bulk, or through Excel ---------- */
const a2s = { q: '', f: 'loc', v: '', only: false, shown: 100 };
const A2S_FIELDS = [['loc', 'Work location'], ['sec', 'Section'], ['dept', 'Department'], ['pos', 'Position'], ['sup', 'Reporting supervisor'], ['payLoc', 'Payroll location'], ['grp', 'Employee group']];
function a2StfPeople() {
  const m = new Map(); at.rows.forEach(r => { const k = atKey(r.id); if (!k) return; let o = m.get(k); if (!o) { m.set(k, o = { k, id: String(r.id), name: r.name || '', pos: r.pos || '', sec: r.sec || '', loc: r.loc || '', sup: r.sup || '', dept: r.dept || '', payLoc: r.payLoc || '', grp: r.grp || '', eff: '' }); const L = a2RecLink(r); o.eff = L ? L.wh : ''; } }); return [...m.values()];
}
function a2StfPanel(host) {
  const emp = host.previousElementSibling; let p = emp && emp.previousElementSibling; if (!p || !p.classList.contains('a2stf')) { p = document.createElement('div'); p.className = 'a2stf'; emp.parentNode.insertBefore(p, emp); wire(p, host); } a2StfRender(p, host);
  function wire(p, host) {
    const L = () => (a2.cfg.empLink = a2.cfg.empLink || {}), changed = () => { a2Save(); a2LinkChanged(host); };
    p.addEventListener('input', e => { const i = e.target; if (i.dataset.q !== undefined) { a2s.q = i.value; a2s.shown = 100; clearTimeout(p._t); p._t = setTimeout(() => a2StfRender(p, host), 250); } });
    p.addEventListener('change', e => { const i = e.target; if (i.dataset.f !== undefined) { a2s.f = i.value; a2s.v = ''; a2s.shown = 100; a2StfRender(p, host); return; } if (i.dataset.v !== undefined) { a2s.v = i.value; a2s.shown = 100; a2StfRender(p, host); return; } if (i.dataset.only !== undefined) { a2s.only = i.checked; a2s.shown = 100; a2StfRender(p, host); return; }
      if (i.dataset.id !== undefined) { const v = i.value.trim(), inf = v && a2WhInfo(a2EWh(v)); if (v) L()[i.dataset.id] = { wh: v, area: (inf && inf.area) || '', region: (inf && inf.region) || '' }; else delete L()[i.dataset.id]; changed(); } });
    p.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const act = b.dataset.a, shown = a2StfShown();
      if (act === 'more') { a2s.shown += 200; a2StfRender(p, host); return; }
      if (act === 'apply' || act === 'clear') { const v = p.querySelector('[data-bulk]').value.trim(); if (act === 'apply' && !v) { sectionToast('Type or pick the warehouse first.', 'warn'); return; } if (!shown.length) { sectionToast('No staff in the list.', 'warn'); return; } if (!confirm((act === 'apply' ? 'Link ' : 'Remove the link of ') + shown.length + ' staff' + (act === 'apply' ? ' to “' + v + '”' : '') + '?')) return; const inf = v && a2WhInfo(a2EWh(v)); shown.forEach(o => { if (act === 'apply') L()[o.k] = { wh: v, area: (inf && inf.area) || '', region: (inf && inf.region) || '' }; else delete L()[o.k]; }); sectionToast(act === 'apply' ? shown.length + ' staff linked to ' + v + '.' : 'Links removed.', 'success'); changed(); return; }
      if (act === 'forget') { if (!Object.keys(L()).length) return; if (!confirm('Forget all ' + Object.keys(L()).length + ' staff links you built?')) return; a2.cfg.empLink = {}; changed(); return; }
      if (act === 'tpl') { const P = a2StfPeople().sort((x, y) => x.loc.localeCompare(y.loc) || x.name.localeCompare(y.name)), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['File Nr', 'Name', 'Position', 'Section', 'Work location', 'Reporting supervisor', 'WHs link', 'Area', 'Regions'], ...P.map(o => { const m = L()[o.k] || {}; return [o.id, o.name, o.pos, o.sec, o.loc, o.sup, m.wh || o.eff || '', m.area || '', m.region || '']; })]), 'Staff WH link'); XLSX.writeFile(wb, 'Staff_WH_link_' + new Date().toISOString().slice(0, 10) + '.xlsx'); return; }
      if (act === 'imp') { p.querySelector('[data-file]').click(); } });
    p.addEventListener('change', async e => { const f = e.target.closest('[data-file]'); if (!f || !f.files[0]) return; const file = f.files[0]; f.value = ''; try { const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }), M = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); if (M.length < 2) throw new Error('The file is empty.');
      const H = M[0].map(h => atNm(h)), ix = al => H.findIndex(h => al.includes(h)), ci = ix(['filenr', 'filenumber', 'fileno', 'employeeno', 'employeenumber', 'empno', 'empid', 'staffno', 'staffid', 'employeeid', 'id']), cw = ix(['whslink', 'whsdesc', 'whdesc', 'whs', 'warehouse', 'whname', 'wh']), ca = ix(['area', 'areadesc', 'regiondesc']), cr = ix(['regions', 'region', 'budecs']);
      if (ci < 0 || cw < 0) throw new Error('Could not find the “File Nr” and “WHs link” columns in the first row.'); const Lm = L(); let n = 0, skip = 0; M.slice(1).forEach(r => { const k = atKey(r[ci]), wh = String(r[cw] || '').trim(); if (!k) return; if (!wh) { skip++; return; } const inf = a2WhInfo(a2EWh(wh)); Lm[k] = { wh, area: String(ca >= 0 ? r[ca] : '').trim() || (inf && inf.area) || '', region: String(cr >= 0 ? r[cr] : '').trim() || (inf && inf.region) || '' }; n++; });
      sectionToast('✅ ' + n + ' staff linked from the file' + (skip ? ' (' + skip + ' rows without a warehouse skipped)' : '') + '.', 'success'); changed(); } catch (err) { sectionToast('✘ ' + err.message, 'error'); } });
  }
}
function a2StfShown() {
  const q = a2s.q.trim().toLowerCase(), M = a2.cfg.empLink || {}; return a2StfPeople().filter(o => (!a2s.v || String(o[a2s.f]) === a2s.v) && (!a2s.only || !(M[o.k] && M[o.k].wh) && !o.eff) && (!q || [o.id, o.name, o.pos, o.sec, o.loc, o.sup, o.dept, o.eff, (M[o.k] || {}).wh].join(' ').toLowerCase().includes(q))).sort((x, y) => x.loc.localeCompare(y.loc) || x.name.localeCompare(y.name));
}
function a2StfRender(p, host) {
  const M = a2.cfg.empLink || {}, all = a2StfPeople(), shown = a2StfShown(), names = a2WhNames(), vals = [...new Set(all.map(o => String(o[a2s.f] || '')))].sort(), manual = all.filter(o => M[o.k] && M[o.k].wh).length, eff = all.filter(o => o.eff).length;
  if (!p.innerHTML) p.innerHTML = '<details class="fd-set" open style="margin-bottom:10px"><summary><strong>🧩 Link staff → warehouse (build your own link)</strong> <span class="text-sm a2s-sum" style="font-weight:400;color:var(--gray-600)"></span></summary><div class="a2s-body"></div></details>';
  p.querySelector('.a2s-sum').textContent = `— ${plF(eff)} of ${plF(all.length)} staff have a warehouse (${plF(manual)} set here)`;
  const act = document.activeElement, keepQ = act && act.dataset && act.dataset.q !== undefined; if (keepQ) return;
  p.querySelector('.a2s-body').innerHTML = `<div class="card-desc" style="margin-top:6px">The attendance file has no warehouse for each person, so link them here: <b>edit one by one</b>, <b>filter a group and link all of it at once</b> (e.g. everybody of a work location), or <b>download the Excel template, fill the “WHs link” column and import it</b>. These links are used first (before the Employees list and the name tables below). ${names.length ? '' : '<b>Tip:</b> load the Mngt data first to get the warehouse pick-list.'}</div>
  <datalist id="a2sWh">${names.map(n => `<option value="${plEsc(n)}">`).join('')}</datalist>
  <div class="pl-frow" style="align-items:flex-end;margin:6px 0"><div class="ro-cf"><label>Search</label><input type="text" data-q placeholder="File Nr, name, position, supervisor…" value="${plEsc(a2s.q)}"></div><div class="ro-cf"><label>Filter staff by</label><select data-f>${A2S_FIELDS.map(f => `<option value="${f[0]}" ${a2s.f === f[0] ? 'selected' : ''}>${f[1]}</option>`).join('')}</select></div><div class="ro-cf"><label>Value</label><select data-v><option value="">All</option>${vals.map(v => `<option ${a2s.v === v ? 'selected' : ''} value="${plEsc(v)}">${plEsc(v || '(blank)')}</option>`).join('')}</select></div><label class="text-sm" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-only style="width:auto" ${a2s.only ? 'checked' : ''}> only staff without a warehouse</label></div>
  <div class="pl-frow" style="align-items:flex-end;margin-bottom:8px"><div class="ro-cf"><label>Warehouse (WHs Desc) for the ${plF(shown.length)} staff shown</label><input type="text" data-bulk list="a2sWh" placeholder="Type or pick the Mngt warehouse name"></div><button class="success small" type="button" data-a="apply">🔗 Link the ${plF(shown.length)} shown</button><button class="ghost small" type="button" data-a="clear">✖ Remove links of the shown</button><button class="secondary small" type="button" data-a="tpl">⬇ Excel template</button><button class="secondary small" type="button" data-a="imp">⬆ Import Excel</button><input type="file" data-file accept=".xlsx,.xls,.csv" hidden><button class="ghost small" type="button" data-a="forget">↺ Forget all my staff links</button></div>
  <div class="fd-wrap" style="max-height:340px"><table class="fd-tbl"><thead><tr><th>File Nr</th><th>Name</th><th>Position</th><th>Work location</th><th>Section</th><th>Warehouse (WHs Desc)</th><th>Area</th><th>Regions</th></tr></thead><tbody>${shown.slice(0, a2s.shown).map(o => { const m = M[o.k] || {}, inf = o.eff ? a2WhInfo(o.eff) : null; return `<tr><td>${plEsc(o.id)}</td><td>${plEsc(o.name)}</td><td>${plEsc(o.pos)}</td><td>${plEsc(o.loc)}</td><td>${plEsc(o.sec)}</td><td><input type="text" data-id="${plEsc(o.k)}" list="a2sWh" value="${plEsc(m.wh || '')}" placeholder="${plEsc(o.eff || 'not linked')}" style="min-width:210px"></td><td>${plEsc(m.area || (inf && inf.area) || '')}</td><td>${plEsc(m.region || (inf && inf.region) || '')}</td></tr>`; }).join('') || '<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--gray-500)">No staff match.</td></tr>'}</tbody></table></div>${shown.length > a2s.shown ? `<div class="btn-row" style="margin-top:6px"><button class="ghost small" type="button" data-a="more">Show 200 more (${plF(shown.length - a2s.shown)} left)</button></div>` : ''}`;
}
function a2LinkRender(host) {
  a2EmpPanel(host); try { a2MapPanel(host); } catch (e) { console.error(e); } host.innerHTML = ''; const sm = PLQ('#lkMapSum'); if (sm && host.id === 'a2LinkHost') { const t = a2E.rows.size && at.rows.length ? a2EStats() : null; sm.textContent = t ? `— ${plF(t.hit)} of ${plF(t.total)} people linked by File Nr` : ''; }
}
function a2LinkChanged(host) { a2Save(); a2Bump(); if (host.id === 'mgLinkHost') { if (mg.cfg.src !== 'sp') mgApplySrc(true); mgRefresh(); } else { at.lkShown = 200; a2.lkRes = []; a2LkRender(); } }
function a2LkRender(tableOnly) {
  a2Bump(); const q = PLQ; q('#lkView').value = a2.cfg.lkView; q('#lkBasis').value = a2.cfg.lkBasis || 'hrs'; q('#lkShow').value = a2.cfg.lkShow; if (document.activeElement !== q('#lkTol')) q('#lkTol').value = a2.cfg.tol;
  const ent = a2Entered(); q('#lkSrc').innerHTML = ent.length ? `✔ ${plF(ent.length)} rows from the Mngt Daily Report list (${[...new Set(ent.map(r => r.date))].length} dates)` : '<span style="color:#b45309">⚠ No Mngt Daily Report data loaded yet — click “Load Mngt report data”.</span>';
  if (!tableOnly || !a2LkCache) a2LkCache = a2LkBuild(); a2LinkRender(PLQ('#a2LinkHost')); a2LkFilters(); a2LkKpis(); a2LkTable(); atDrawGrid(q('#lkGrid'), LK_DEFS, { rows: () => a2LkCache.rows });
}
const a2LkData = () => { const cols = LK_COLS(), R = atSortRows(lkRows(), cols, at.sort.lk); return a2Data('Calculated OT vs OT entered in the Mngt Daily Report', 'OT vs Mngt report', `${plF(R.length)} row(s) · tolerance ${a2.cfg.tol} h · normal day ${a2.cfg.normal} h`, cols, R); };
function a2LkInit() {
  const q = PLQ, redo = () => { a2Save(); at.lkShown = 200; a2.lkRes = []; a2LkRender(); };
  q('#lkView').addEventListener('change', e => { a2.cfg.lkView = e.target.value; at.sort.lk = null; redo(); }); q('#lkShow').addEventListener('change', e => { a2.cfg.lkShow = e.target.value; a2Save(); a2LkTable(); });
  q('#lkBasis').addEventListener('change', e => { a2.cfg.lkBasis = e.target.value; at.sort.lk = null; redo(); });
  q('#lkTol').addEventListener('change', e => { const v = parseFloat(e.target.value); a2.cfg.tol = isNaN(v) ? 0.5 : Math.max(0, v); redo(); }); q('#lkMore').addEventListener('click', () => { at.lkShown = (at.lkShown || 200) + 200; a2LkTable(); });
  q('#lkKpis').addEventListener('click', e => { const k = e.target.closest('.pl-kpi[data-f]'); if (!k) return; const [t, v] = k.dataset.f.split(':'); if (t === 'lk') { a2.lkRes = a2Tog(a2.lkRes, v); a2LkFilters(); a2LkTable(); } });
  q('#lkLoad').addEventListener('click', async () => {
    const b = q('#lkLoad'); b.disabled = true; const t = b.textContent; b.textContent = '⏳ Loading…';
    try { mgInit(); if (!mg.cfg.list.daily) { sectionToast('Set the Mngt Daily Report lists first (Mngt Daily Report › Lists & mapping).', 'warn'); } else { await mgLoad(false); sectionToast('Mngt Daily Report data loaded.', 'success'); } } catch (err) { sectionToast('Could not load: ' + err.message, 'warn'); } b.disabled = false; b.textContent = t; a2LkRender();
  });
  q('#lkExcel').addEventListener('click', () => a2Export(a2LkData())); q('#lkPrint').addEventListener('click', () => a2Print(a2LkData())); q('#lkEmail').addEventListener('click', () => a2Mail(a2LkData)); q('#lkExpand').addEventListener('click', () => a2Expand(a2LkData()));
}

/* ============ 4 · ROSTER: fill the Daily availability from the uploaded attendance ============ */
function a2Window(r, basis) {
  const wrap = (f, t) => { if (t <= f) t += 1440; return { f, t }; };
  if (basis === 'shift') return r.sFrom != null && r.sTo != null ? wrap(r.sFrom, r.sTo) : null;
  if (r.inT != null && r.outT != null) return wrap(r.inT, r.outT);
  if (r.inT != null) { if (r.sTo != null) return wrap(r.inT, r.sTo); return { f: r.inT, t: r.inT + Math.max(r.req || 8, 8) * 60 }; }
  if (r.outT != null) { const f = r.sFrom != null ? r.sFrom : r.outT - 540; return wrap(f, r.outT); }
  return null;
}
function a2SlotAbs(slot) { // minutes from 00:00 of the roster day — the small hours of a night shift belong to the next day
  const sh = roShort(slot.shift).toLowerCase(), first = ro.slots.find(x => roShort(x.shift).toLowerCase() === sh), f0 = first ? roM(first.from) : 0, a = roM(slot.from); return a == null ? null : (a >= f0 ? a : a + 1440);
}
function a2Covers(slot, w) { const a = a2SlotAbs(slot), d = roDur(slot) * 60; if (a == null || !d) return false; const lo = Math.max(a, w.f), hi = Math.min(a + d, w.t); return hi - lo >= d / 2; }
function a2FillRoster(opt) {
  const rows = at.rows.filter(r => opt.scope === 'all' || r.date === ro.date), byId = new Map(ro.staff.map(s => [atKey(s.id), s])), byNm = new Map(ro.staff.map(s => [atNm(s.name), s])), res = { filled: 0, cleared: 0, leave: 0, added: 0, skipped: 0 };
  rows.forEach(r => {
    let s = byId.get(atKey(r.id)) || byNm.get(atNm(r.name));
    if (!s) { if (!opt.add) { res.skipped++; return; } s = { id: String(r.id).trim(), name: r.name, role: r.pos || '', area: r.sec || r.loc || '', active: true }; ro.staff.push(s); byId.set(atKey(s.id), s); res.added++; }
    const w = (r.st === 'Present' || r.st === 'One punch') ? a2Window(r, opt.basis) : null;
    if (w) { roSetSlots(r.date, s.id, ro.slots.filter(sl => a2Covers(sl, w)).map(roK)); if (ro.status[r.date]) delete ro.status[r.date][s.id]; res.filled++; }
    else if (opt.clear) { roSetSlots(r.date, s.id, []); ro.status[r.date] = ro.status[r.date] || {}; if (r.st === 'Leave') { ro.status[r.date][s.id] = 'Leave'; res.leave++; } else delete ro.status[r.date][s.id]; res.cleared++; }
  });
  a2Bump(); roSave(); roRender(); return res;
}
function a2FillOpen() {
  if (!at.rows.length) atLoad();
  if (!at.rows.length) { sectionToast('No attendance report is loaded yet — upload it in Attendance Analytics first.', 'warn'); return; }
  document.querySelectorAll('#a2Fill').forEach(x => x.remove()); const dates = atDates(), has = dates.includes(ro.date);
  const ov = document.createElement('div'); ov.className = 'ro-ov'; ov.id = 'a2Fill';
  ov.innerHTML = `<div class="ro-dlg" role="dialog"><div class="ro-dh"><div><strong>🕒 Fill Daily availability from attendance</strong><div class="text-sm" style="color:var(--gray-600)">${plF(at.rows.length)} records · ${dates.map(atDateLabel).join(', ')} · ${plEsc(at.file || '')}</div></div><button type="button" class="ghost small" data-x="1">✖</button></div>
  <div class="ro-db"><div class="form-group"><label>Which days</label><select id="a2FlScope"><option value="day" ${has ? '' : 'disabled'}>Only the day shown in the roster (${atDateLabel(ro.date)})${has ? '' : ' — not in the attendance file'}</option><option value="all" ${has ? '' : 'selected'}>Every date in the attendance file (${dates.length})</option></select></div>
   <div class="form-group"><label>Availability is taken from</label><select id="a2FlBasis"><option value="punch">The actual IN → OUT punches</option><option value="shift">The Shift Code in the report</option></select></div>
   <label class="text-sm" style="display:flex;gap:6px;align-items:center;margin:6px 0"><input type="checkbox" id="a2FlClear" style="width:auto" checked> Clear the slots of people who were absent / on leave / off in the report (leave is kept as Leave)</label>
   <label class="text-sm" style="display:flex;gap:6px;align-items:center;margin:6px 0"><input type="checkbox" id="a2FlAdd" style="width:auto" checked> Add people who are in the attendance file but not yet in the roster</label>
   <div class="text-sm" style="color:var(--gray-600)">A time slot counts as worked when at least half of it falls between the person’s IN and OUT. Breaks set in <em>Staff &amp; time slots › Break hours</em> then show as ☕ inside those slots. Existing marks for the people and days found in the file are replaced.</div>
   <div id="a2FlMsg" class="text-sm" style="min-height:18px;margin-top:6px;"></div></div>
  <div class="ro-df"><button type="button" class="ghost small" data-x="1">Cancel</button><button type="button" class="success" id="a2FlGo">✔ Fill the roster</button></div></div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('[data-x]')) return ov.remove(); if (!e.target.closest('#a2FlGo')) return;
    const r = a2FillRoster({ scope: ov.querySelector('#a2FlScope').value, basis: ov.querySelector('#a2FlBasis').value, clear: ov.querySelector('#a2FlClear').checked, add: ov.querySelector('#a2FlAdd').checked });
    ov.remove(); sectionToast(`Roster filled: ${r.filled} person-day(s) from punches` + (r.cleared ? `, ${r.cleared} cleared${r.leave ? ` (${r.leave} on leave)` : ''}` : '') + (r.added ? `, ${r.added} person(s) added to the roster` : '') + (r.skipped ? `, ${r.skipped} not in the roster skipped` : '') + '.', 'success'); addActivity('edit', `Roster filled from attendance (${r.filled} person-days)`);
  });
}


/* ---------- the Staff Roster follows the attendance file ---------- */
const A2_SPK = [['att_loc', 'Work location', 'loc'], ['att_sec', 'Section (store)', 'sec'], ['att_dept', 'Department', 'dept'], ['att_sup', 'Reporting supervisor', 'sup'], ['att_shift', 'Shift code', 'shift'], ['att_grp', 'Employee group', 'grp'], ['att_cat', 'Category', 'cat'], ['att_pay', 'Payroll location', 'payLoc']];
function a2SyncRoster(opt) {
  if (!at.rows.length) { sectionToast('No attendance report is loaded.', 'warn'); return null; }
  if (typeof roInited !== 'undefined' && !roInited) roLoad(); if (!ro.slots.length) ro.slots = roDefaultSlots();
  const byId = new Map(ro.staff.map(s => [atKey(s.id), s])), byNm = new Map(ro.staff.map(s => [atNm(s.name), s])), shiftNames = roShiftNames().map(roShort), res = { added: 0, updated: 0, people: 0 };
  const last = new Map(); at.rows.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(r => { const o = last.get(atKey(r.id)) || {}; const m = Object.assign({}, o); Object.keys(r).forEach(k => { if (r[k] != null && r[k] !== '' && k !== '_t') m[k] = r[k]; }); m.date = r.date; last.set(atKey(r.id), m); });
  ro.spCols = (ro.spCols || []).filter(c => !c.k.startsWith('att_')); A2_SPK.forEach(([k, l]) => ro.spCols.push({ k, label: l + ' · attendance', mapped: '' }));
  last.forEach(r => {
    let s = byId.get(atKey(r.id)) || byNm.get(atNm(r.name)), isNew = false;
    if (!s) { s = { id: String(r.id).trim(), name: r.name, role: r.pos || '', area: r.sec || r.loc || '', active: true }; ro.staff.push(s); byId.set(atKey(s.id), s); isNew = true; res.added++; }
    let ch = false; const set = (k, v) => { if (v && !s[k]) { s[k] = v; ch = true; } };
    set('role', r.pos); set('area', r.sec || r.loc); if (r.sType && shiftNames.includes(r.sType)) set('defShift', r.sType);
    if (/off/i.test(r.shift || '')) { const od = a2OffDays(r)[0]; set('offDay', od); }
    s.sp = s.sp || {}; A2_SPK.forEach(([k, l, f]) => { if (r[f] && s.sp[k] !== r[f]) { s.sp[k] = r[f]; ch = true; } });
    if (r.st === 'Active' || true) { /* attendance never deactivates anybody */ }
    if (ch && !isNew) res.updated++;
  });
  res.people = last.size; Object.assign(res, a2FillRoster({ scope: 'all', basis: 'punch', clear: true, add: false, quiet: true }));
  const ds = atDates(); ro.date = ds[ds.length - 1]; ro.week = roMonday(ro.date); roSave(); try { roRender(); } catch (e) {}
  addActivity('edit', `Staff roster updated from attendance: ${res.added} added, ${res.filled} person-days filled`); return res;
}
const a2SyncText = r => `Staff Roster updated — ${plF(r.people)} people in the file: ${plF(r.added)} added, ${plF(r.updated)} completed, ${plF(r.filled)} person-days filled from the punches` + (r.cleared ? `, ${plF(r.cleared)} off / absent / leave days cleared` : '') + '. Roster is on ' + atDateLabel(ro.date) + '.';
function a2AfterUpload(msgEl) { if (a2.cfg.syncRoster === false) return; const r = a2SyncRoster(); if (r) { const t = a2SyncText(r); msgEl.textContent += ' · ' + t; sectionToast(t, 'success'); } }

/* ============ EMPLOYEE FILE-NUMBER LINK — attendance File Nr → Employees list → WHs (Area / Regions) ============ */
const A2E_KEY = LS_BASE + '_att2_emp';
const A2E_FIELDS = [
  { key: 'id', label: 'File Nr (employee number)', req: 1, al: ['filenr', 'filenumber', 'fileno', 'employeeno', 'employeenumber', 'empno', 'empid', 'staffno', 'staffid', 'employeeid', 'id'] },
  { key: 'wh', label: 'WHs_Link (employee warehouse) — optional', al: ['whslink', 'whsdesc', 'whdesc', 'whs', 'warehouse', 'whname', 'wh', 'site', 'location'] },
  { key: 'area', label: 'Area (Region_Desc) — optional', al: ['regiondesc', 'areadesc', 'area'] },
  { key: 'region', label: 'Regions (BU_Decs) — optional', al: ['budecs', 'budesc', 'bu', 'regions', 'region'] },
  { key: 'name', label: 'Employee name — optional', al: ['employeename', 'fullname', 'staffname', 'name', 'title'] }];
const a2E = { rows: new Map(), cols: [], loaded: 0, busy: false };
function a2ELoadCache() { try { const d = JSON.parse(localStorage.getItem(A2E_KEY) || 'null'); if (d && d.rows && d.v === 2) { a2E.rows = new Map(d.rows); a2E.loaded = d.t || 0; } } catch (e) {} }
function a2ESaveCache() { try { localStorage.setItem(A2E_KEY, JSON.stringify({ v: 2, t: a2E.loaded, rows: [...a2E.rows.entries()] })); } catch (e) {} }
const a2EOn = () => a2E.rows.size > 0;
const a2EWh = v => a2.cfg.empWhMap[v] || a2Auto(v) || v;
const a2AKey = r => atKey(a2.cfg.attKey === 'name' ? r.name : r.id);
function a2RecLink(r) { let e = null; if (a2EOn()) { e = a2E.rows.get(a2AKey(r)); if (e && e.wh) return { wh: a2EWh(e.wh), user: false, emp: true, area: e.area, region: e.region }; } const a = (a2EOn() && a2.cfg.storeFB !== true) ? '' : a2Auto(a2StoreRaw(r)); return a ? (e ? { wh: a, user: false, emp: true, area: e.area, region: e.region } : { wh: a, user: false }) : null; }
async function a2ELoad(say) {
  const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(), name = a2.cfg.emp.list, M = a2.cfg.emp.map, g = k => M[k] && M[k] !== SKIP_VALUE ? M[k] : null;
  if (!token || !siteUrl) throw new Error('Configure the global Site URL and sign-in first.');
  if (!name) throw new Error('Pick the Employees list.');
  if (!isListVisible(name)) throw new Error(`No permission to access "${name}"`);
  say(`Reading "${name}"…`); const a = await resolveIds(siteUrl, name, token), items = await fetchAllItems(a.siteId, a.listId, token, n => say(`"${name}": ${plF(n)} employees…`));
  try { const cs = (await fetchColumns(a.siteId, a.listId, token)).filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase())), nz = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, ''), find = al => cs.find(c => al.includes(nz(c.name)) || al.includes(nz(c.displayName))); const wl = find(['whslink']), fn = find(['filenr', 'filenumber', 'fileno']); if (wl && M.wh === undefined) M.wh = wl.name; if (fn && !g('id')) M.id = fn.name; if (!g('id')) Object.assign(M, Object.fromEntries(Object.entries(mdpAuto(A2E_FIELDS, cs)).filter(([k, v]) => !(M[k] && M[k] !== SKIP_VALUE) && !(k === 'wh' && M.wh === SKIP_VALUE) && v !== SKIP_VALUE))); a2Save(); } catch (e) {}
  if (!g('id')) throw new Error('Map the File Nr column of the Employees list.');
  const rows = new Map(), pend = []; let noWh = 0;
  const _nz = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, ''), _keys = Object.keys((items.find(it => it.fields) || {}).fields || {}), _auto = _keys.find(k => _nz(k) === 'whslink') || _keys.find(k => _nz(k) === 'whsdesc');
  const _score = k => k ? items.filter(it => mgS((it.fields || {})[k])).length : 0; const _nameK = _keys.find(k => _nz(k) === 'employeename'); let whK = g('wh'); if (_auto && (!whK || _score(whK) === 0 || _score(_auto) > _score(whK))) { whK = _auto; M.wh = _auto; a2Save(); }
  items.forEach(it => { const f = it.fields || {}, id = mgS(f[g('id')]); if (!id) return; let wh = mgS(f[whK]); const lid = f[whK + 'LookupId'];
    const o = { wh, area: g('area') ? mgS(f[g('area')]) : '', region: g('region') ? mgS(f[g('region')]) : '', name: g('name') ? mgS(f[g('name')]) : (_nameK ? mgS(f[_nameK]) : '') }; rows.set(atKey(id), o); if (!wh && lid != null) pend.push([o, String(lid)]); });
  if (pend.length && mg.cfg.list.whs && mgMapOk('whs')) { say('Resolving the WHs lookup…'); const src = await mgReadList('whs', say), nm = mg.cfg.map.whs.wh, byId = new Map(src.map(s => [String(s.id), mgS((s.fields || {})[nm])])); pend.forEach(([o, l]) => { o.wh = byId.get(l) || ''; }); }
  rows.forEach(o => { if (!o.wh) noWh++; });
  a2E.rows = rows; a2E.loaded = Date.now(); a2ESaveCache(); a2Bump(); return { n: rows.size, noWh };
}
const a2EStale = () => { let n = 0; a2E.rows.forEach(o => { if (!o.wh) n++; }); return a2E.rows.size > 0 && n > a2E.rows.size * 0.5; };
function a2EAuto(force) {
  if (a2E.busy || !a2.cfg.emp.list || !getGlobalAccessToken() || !getGlobalSiteUrl() || (!force && a2E.rows.size && !a2EStale())) return;
  a2E.busy = true; a2ELoad(() => {}).then(() => { a2E.busy = false; if (typeof mgApplySrc === 'function' && mg.cfg.src !== 'sp') mgApplySrc(true); try { if (document.querySelector('#view-mgt.active')) mgRefresh(); if (document.querySelector('#view-att.active')) { a2Bump(); atRefresh(true); } } catch (e) {} }).catch(() => { a2E.busy = false; });
}
function a2EStats() {
  const seen = new Map(); at.rows.forEach(r => { const k = a2AKey(r); let o = seen.get(k); if (!o) seen.set(k, o = { id: String(r.id), name: r.name, store: a2StoreRaw(r), loc: r.loc || '', days: 0 }); o.days++; });
  const miss = [], whc = new Map(); let hit = 0; seen.forEach((o, k) => { const e = a2E.rows.get(k); if (e) { hit++; if (e.wh) whc.set(e.wh, (whc.get(e.wh) || 0) + 1); } else miss.push(o); });
  return { total: seen.size, hit, miss: miss.sort((a, b) => a.store.localeCompare(b.store) || a.name.localeCompare(b.name)), whc: [...whc.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
}
const a2EUnData = () => { const s = a2EStats(); return a2Data('Attendance employees not found in the Employees list', 'Not in Employees list', `${plF(s.miss.length)} of ${plF(s.total)} people — linked through the store mapping instead`, [['File Nr', o => o.id], ['Name', o => o.name], ['Attendance store', o => o.store], ['Work location', o => o.loc], ['Days in file', o => o.days]], s.miss); };
function a2EmpBuild(p) {
  p.innerHTML = `<details class="fd-set" open style="margin-bottom:10px"><summary><strong>🔗 Attendance File Nr → Employees list → WHs_Link → Mngt Daily Report warehouse</strong> <span class="text-sm a2e-sum" style="font-weight:400;color:var(--gray-600)"></span></summary>
  <div class="card-desc" style="margin-top:6px">Each attendance record is matched to the <strong>Employees</strong> list by <strong>File Nr</strong>; the employee's <strong>WHs_Link</strong> is the warehouse used in the <strong>Mngt Daily Report</strong> (and so its Area, Regions and targets). Pick the list and press <em>Load employees</em> — the columns are found automatically.</div>
  <div class="form-grid three"><div class="form-group"><label>Employees list</label><div class="list-picker"></div></div></div>
  <div class="btn-row" style="margin:6px 0"><button class="secondary small" type="button" data-a="cols">🔄 Load Columns</button><button class="ghost small" type="button" data-a="auto">⚡ Auto-Map</button><button class="success small" type="button" data-a="load">⬇ Load employees</button><span class="text-sm a2e-st"></span></div>
  <div class="fd-wrap" style="max-height:260px"><table class="fd-tbl"><thead><tr><th>Field</th><th>Employees list column</th></tr></thead><tbody class="a2e-map"></tbody></table></div>
  <div class="a2e-cov" style="margin-top:8px"></div></details>`;
  const pk = createListPicker(p.querySelector('.list-picker'), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: v => { a2.cfg.emp.list = v; a2E.cols = []; a2Save(); a2EmpMap(p); } });
  p._pk = pk; try { if (a2.cfg.emp.list && pk.setValue) pk.setValue(a2.cfg.emp.list); } catch (e) {}
  const st = p.querySelector('.a2e-st'), say = (t, bad) => { st.textContent = t; st.style.color = bad ? '#c0392b' : ''; };
  p.addEventListener('click', async e => {
    const b = e.target.closest('button[data-a]'); if (b) { const act = b.dataset.a;
      if (act === 'cols') { try { const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) { say('⚠ Configure the global Site URL and sign-in first.', 1); return; } const nm = pk.getValue(); a2.cfg.emp.list = nm; if (!nm) { say('⚠ Pick the Employees list.', 1); return; } say('Loading…'); const { siteId, listId } = await resolveIds(siteUrl, nm, token); a2E.cols = (await fetchColumns(siteId, listId, token)).filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase())); if (!Object.keys(a2.cfg.emp.map).length) a2.cfg.emp.map = mdpAuto(A2E_FIELDS, a2E.cols); a2Save(); a2EmpMap(p); say(`✓ ${a2E.cols.length} columns`); } catch (err) { say('✘ ' + err.message, 1); } }
      else if (act === 'auto') { if (!a2E.cols.length) { say('⚠ Load columns first.', 1); return; } a2.cfg.emp.map = mdpAuto(A2E_FIELDS, a2E.cols); a2Save(); a2EmpMap(p); }
      else if (act === 'load') { b.disabled = true; try { a2.cfg.emp.list = pk.getValue() || a2.cfg.emp.list; a2Save(); const r = await a2ELoad(say); say(`✅ ${plF(r.n)} employees loaded` + (r.noWh ? ` · ${plF(r.noWh)} without a WHs value` : '')); addActivity('download', `Employees list "${a2.cfg.emp.list}" loaded (${r.n})`); const host = p.nextElementSibling; a2LinkChanged(host); } catch (err) { say('✘ ' + err.message, 1); } b.disabled = false; }
      else if (act === 'x') { const d = a2EUnData(); const k = b.dataset.f; if (k === 'xl') a2Export(d); else if (k === 'pr') a2Print(d); else if (k === 'ex') a2Expand(d); else a2Mail(a2EUnData); }
      return; }
    const c = e.target.closest('input[data-a="on"]'); if (c) { a2.cfg.empOn = c.checked; a2Save(); a2LinkChanged(p.nextElementSibling); }
  });
  p.addEventListener('click', e => { const b = e.target.closest('button[data-x]'); if (!b) return; const d = a2EUnData(); if (b.dataset.x === 'xl') a2Export(d); else if (b.dataset.x === 'pr') a2Print(d); else if (b.dataset.x === 'ex') a2Expand(d); else a2Mail(a2EUnData); });
  p.addEventListener('change', e => { const i = e.target.closest('input[data-ew]'); if (!i) return; const v = i.value.trim(); if (v) a2.cfg.empWhMap[i.dataset.ew] = v; else delete a2.cfg.empWhMap[i.dataset.ew]; a2LinkChanged(p.nextElementSibling); });
}
function a2EmpMap(p) {
  const host = p.querySelector('.a2e-map'); host.innerHTML = '';
  if (!a2E.cols.length) { host.innerHTML = '<tr><td colspan="2" style="padding:12px;text-align:center;color:var(--gray-400);font-style:italic;">Pick the list and click 🔄 Load Columns.</td></tr>'; return; }
  A2E_FIELDS.forEach(f => { const tr = document.createElement('tr'); tr.innerHTML = `<td><strong>${plEsc(f.label)}</strong>${f.req ? ' <span style="color:#c0392b">*</span>' : ''}</td><td class="combo-cell"></td>`; tr.querySelector('.combo-cell').appendChild(buildCombo(a2.cfg.emp.map[f.key] || SKIP_VALUE, a2E.cols, nv => { a2.cfg.emp.map[f.key] = nv; a2Save(); })); host.appendChild(tr); });
}
function a2EmpCov(p) {
  const sum = p.querySelector('.a2e-sum'), cov = p.querySelector('.a2e-cov');
  if (!a2E.rows.size) { sum.textContent = '— not loaded yet'; cov.innerHTML = ''; return; }
  const s = at.rows.length ? a2EStats() : { total: 0, hit: 0, miss: [], whc: [] }, names = a2WhNames();
  sum.textContent = `— ${plF(a2E.rows.size)} employees loaded${a2E.loaded ? ' · ' + new Date(a2E.loaded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}` + (s.total ? ` · ${plF(s.hit)} of ${plF(s.total)} attendance people found by File Nr` : '');
  if (!s.total) { cov.innerHTML = '<div class="text-sm" style="color:#b45309">Upload the attendance report to see how many people are found.</div>'; return; }
  const bad = names.length ? s.whc.filter(([v]) => { const u = a2EWh(v); return !names.some(x => a2nk(x) === a2nk(u)); }) : [], okN = s.whc.length - bad.length;
  cov.innerHTML = `<datalist id="a2EwList">${names.map(n => `<option value="${plEsc(n)}">`).join('')}</datalist>`
    + `<div class="text-sm" style="margin-bottom:6px">✔ <strong>${plF(s.hit)}</strong> of ${plF(s.total)} people found by File Nr (${plP(s.total ? s.hit / s.total : 0, 0)}) · ` + (names.length ? `<strong style="color:${bad.length ? '#a1264b' : '#0b7a0b'}">${plF(okN)}</strong> of ${plF(s.whc.length)} WHs_Link values match a Mngt Daily Report warehouse` : '<span style="color:#b45309">load the Mngt report data to check the warehouse names</span>') + '</div>'
    + (bad.length ? `<details class="fd-set" open style="margin-bottom:6px"><summary><strong>WHs_Link values that do not match a Mngt warehouse</strong> <span class="text-sm" style="font-weight:400;color:var(--gray-600)">— ${plF(bad.length)}; pick the right Mngt name</span></summary><div class="fd-wrap" style="max-height:240px;margin-top:6px"><table class="fd-tbl"><thead><tr><th>WHs_Link on the Employees list</th><th>People</th><th>Mngt warehouse</th></tr></thead><tbody>${bad.map(([v, n]) => `<tr><td>${plEsc(v)}</td><td class="n">${plF(n)}</td><td><input type="text" list="a2EwList" data-ew="${plEsc(v)}" value="${plEsc(a2.cfg.empWhMap[v] || '')}" placeholder="type or pick" style="margin:0;min-width:240px"></td></tr>`).join('')}</tbody></table></div></details>` : '')
    + (s.miss.length ? `<details class="fd-set"><summary><strong>People not found in the Employees list</strong> <span class="text-sm" style="font-weight:400;color:var(--gray-600)">— ${plF(s.miss.length)}</span></summary><div class="btn-row" style="margin:6px 0"><button class="ghost small" type="button" data-x="mail">📧 Email</button><button class="ghost small" type="button" data-x="ex">⤢ Expand</button><button class="ghost small" type="button" data-x="xl">⬇ Excel</button><button class="ghost small" type="button" data-x="pr">🖨 Print</button></div><div class="fd-wrap" style="max-height:260px"><table class="fd-tbl"><thead><tr><th>File Nr</th><th>Name</th><th>Attendance store</th><th>Work location</th><th>Days</th></tr></thead><tbody>${s.miss.slice(0, 300).map(o => `<tr><td>${plEsc(o.id)}</td><td>${plEsc(o.name)}</td><td>${plEsc(o.store)}</td><td>${plEsc(o.loc)}</td><td class="n">${o.days}</td></tr>`).join('')}</tbody></table></div>${s.miss.length > 300 ? '<div class="text-sm">First 300 shown — Excel has all.</div>' : ''}</details>` : '');
}
function a2EmpPanel(host) {
  let p = host.previousElementSibling; if (!p || !p.classList.contains('a2emp')) { p = document.createElement('div'); p.className = 'a2emp'; host.parentNode.insertBefore(p, host); a2EmpBuild(p); a2EmpMap(p); }
  a2EmpCov(p);
}

/* ============ 5 · MNGT DAILY REPORT — version built from the attendance file ============ */
function mgAttRows() {
  if (!at.rows.length) atLoad(); a2Bump(); const sp = mg.sp || { rows: [], whs: [], trg: [] }, nk = a2nk, info = new Map(), vol = new Map(), g = new Map(), emp = new Map();
  sp.rows.forEach(r => { const k = nk(r.wh); if (!info.has(k)) info.set(k, { area: r.area, region: r.region }); const vk = k + '|' + r.date; let o = vol.get(vk); if (!o) vol.set(vk, o = { out: 0, inb: 0, ret: 0, orders: 0, vol: 0 }); o.out += r.out; o.inb += r.inb; o.ret += r.ret; o.orders += r.orders; o.vol += r.vol; });
  at.rows.forEach(r => {
    if (!a2RowOk(r)) return; const store = a2StoreRaw(r), L = a2RecLink(r), wh = L ? L.wh : store, k = wh + '|' + r.date; let o = g.get(k); if (!o) g.set(k, o = { date: r.date, wh, store, loc: r.loc || '(blank)', dept: r.dept, earea: '', ereg: '', nh: 0, not: 0, wo: 0, po: 0, st: new Set() });
    const c = a2Meas(r); o.nh += c.nh; o.not += c.not; o.wo += c.wo; o.po += c.po; if (c.pr) o.st.add(a2AKey(r)); if (L && L.emp) { if (!o.earea && L.area) o.earea = L.area; if (!o.ereg && L.region) o.ereg = L.region; } let e = emp.get(wh); if (!e) emp.set(wh, e = new Set()); if (atHours(r) > 0 || r.st === 'Present') e.add(atKey(r.id));
  });
  const rows = [...g.values()].map(o => { const i = info.get(nk(o.wh)) || {}, v = vol.get(nk(o.wh) + '|' + o.date) || {}, ot = o.not + o.wo + o.po; return { date: o.date, wh: o.wh, area: a2.cfg.areaMap[o.loc] || i.area || o.earea || a2AreaFor(o.loc, o.wh) || o.loc || '', region: a2.cfg.regMap[o.store] || i.region || o.ereg || a2RegionOf(o.store, o.wh) || o.dept || '', out: v.out || 0, inb: v.inb || 0, ret: v.ret || 0, orders: v.orders || 0, vol: v.vol || 0, nh: Math.round(o.nh * 100) / 100, not: Math.round(o.not * 100) / 100, wo: Math.round(o.wo * 100) / 100, po: Math.round(o.po * 100) / 100, ot: Math.round(ot * 100) / 100, hrs: Math.round((o.nh + ot) * 100) / 100, staff: o.st.size }; });
  return { rows, emp, sp };
}
function mgApplySrc(keep) { return mg.cfg.src === 'var' ? mgApplyVar(keep) : mgApplyAtt(keep); }
function mgApplyAtt(keep) {
  if (!at.rows.length) atLoad(); if (!at.rows.length) return false;
  const R = mgAttRows(), rows = R.rows, emp = R.emp, sp = R.sp, nk = a2nk;
  mg.rows = rows; const bud = new Map(); (sp.whs || []).forEach(h => bud.set(nk(h.wh), (bud.get(nk(h.wh)) || 0) + h.bud)); mg.whs = (sp.whs && sp.whs.length) ? [...emp.entries()].map(([wh, s]) => ({ wh, bud: bud.get(nk(wh)) || 0, act: s.size })) : []; mg.trg = sp.trg || [];
  const ds = rows.map(r => r.date).sort(); if (!keep || !mg.f.from) { mg.f.from = ds[0] || ''; mg.f.to = ds[ds.length - 1] || ''; mg.f.area = []; mg.f.region = []; mg.f.wh = []; }
  mg.loaded = Date.now(); const h = document.querySelector('#mgFHost'); if (h) h.dataset.sig = ''; return rows.length > 0;
}
function a2MgSrcUi() {
  const sel = document.querySelector('#mgSrc'); if (!sel) return; sel.value = mg.cfg.src || 'sp'; const n = document.querySelector('#mgAttNote'); if (!n) return;
  if (mg.cfg.src === 'sp') { n.style.display = 'none'; return; } n.style.display = '';
  const vols = mg.sp && mg.sp.rows.length, mc = a2MeasCfg(), lab = k => (A2_MEAS.find(m => m.k === k).opts.find(o => o[0] === mc[k]) || [0, mc[k]])[1];
  const how = `Hours, overtime and staff come from the attendance file <em>${plEsc(at.file || '—')}</em>: normal hrs = ${plEsc(lab('nh'))}; Normal OT = ${plEsc(lab('not'))}; Week-off OT = ${plEsc(lab('wo'))}; Public OT = ${plEsc(lab('po'))}. Each person is joined through File Nr → Employees list → WHs_Link → Mngt WHs_Desc — change any of it in the <a href="#" data-go="mglinks"><strong>🔗 Attendance links</strong></a> tab (Link map).`;
  const inc = a2IncDays(), skip = a2.cfg.skipInc !== false && inc.size ? ` <span style="color:#b45309">Days skipped as unfinished (most staff have only an IN punch): ${[...inc].map(atDateLabel).join(', ')}.</span>` : '';
  n.innerHTML = (mg.cfg.src === 'var' ? `⚖ <strong>View 3 · Variance</strong> — attendance minus entered, for the days of the attendance file (${plEsc(at.file || '—')}). <label style="white-space:nowrap"><input type="checkbox" data-vb style="width:auto" ${a2.cfg.varBoth !== false ? 'checked' : ''}> only warehouse-days present on both sides</label> ` : `🕒 <strong>View 2 · Attendance</strong> — `) + how + skip + ' ' + (vols ? 'Volumes, targets and budget headcount are read from the SharePoint lists.' : '<span style="color:#b45309">Volumes, targets and budget headcount need the SharePoint lists — open “Lists & mapping” and load them; until then productivity is not shown.</span>') + ' <a href="#" data-go="otrules">⏱ Overtime rules</a>';
}
document.querySelectorAll('.nav-item[data-view="otrules"]').forEach(n => n.addEventListener('click', () => setTimeout(() => { atInit(); if (!at.rows.length) atLoad(); a2Bump(); a2RulesSync(); a2RulesSummary(); roOpen(); }, 0)));
function a2GoAtt(tab) { const n = document.querySelector('.nav-item[data-view="att"]'); if (n) n.click(); setTimeout(() => { at.tab = tab; atRefresh(true); }, 30); }

/* ---------- wiring ---------- */
function a2Init() {
  if (a2.inited) return; a2.inited = true; a2Load(); a2RulesInit(); a2StInit(); a2TyInit(); a2LkInit(); PLQ('#atSyncRo').checked = a2.cfg.syncRoster !== false; PLQ('#atSyncRo').addEventListener('change', e => { a2.cfg.syncRoster = e.target.checked; a2Save(); }); PLQ('#atSyncNow').addEventListener('click', () => { const r = a2SyncRoster(); if (r) { sectionToast(a2SyncText(r), 'success'); PLQ('#atUpMsg').className = 'status-msg ok'; PLQ('#atUpMsg').textContent = '✓ ' + a2SyncText(r); } });
  window.addEventListener('resize', () => { if (!document.querySelector('#view-att.active')) return; if (at.tab === 'ot') atDrawGrid(PLQ('#a2Grid'), A2_DEFS, { rows: () => atView() }); else if (at.tab === 'st') atDrawGrid(PLQ('#stGrid'), ST_DEFS, { rows: () => atView() }); else if (at.tab === 'ty' && a2TyCache) atDrawGrid(PLQ('#tyGrid'), TY_DEFS, { rows: () => a2TyCache.rows }); else if (at.tab === 'lk' && a2LkCache) atDrawGrid(PLQ('#lkGrid'), LK_DEFS, { rows: () => a2LkCache.rows }); });
}
a2Load(); a2ELoadCache();
(function a2Boot() {
  const go = () => {
    const b = document.querySelector('#roAtFill'); if (b) b.addEventListener('click', a2FillOpen);
    const s = document.querySelector('#mgSrc');
    if (s) { s.addEventListener('change', () => { mgInit(); mg.cfg.src = s.value; mgSaveCfg();
      if (mg.cfg.src !== 'sp') { mg.tab = 'rep'; if (!mgApplySrc()) { sectionToast(!at.rows.length ? 'Upload the attendance report first (Attendance Analytics).' : 'Load the Mngt Daily Report data first (Lists & mapping) — the variance needs both sides.', 'warn'); mg.cfg.src = 'sp'; mgSaveCfg(); mg.rows = (mg.sp && mg.sp.rows) || []; } }
      else if (mg.sp) { mg.rows = mg.sp.rows; mg.whs = mg.sp.whs; mg.trg = mg.sp.trg; const ds = mg.rows.map(r => r.date).sort(); mg.f.from = ds[0] || ''; mg.f.to = ds[ds.length - 1] || ''; mg.f.area = []; mg.f.region = []; mg.f.wh = []; mg.loaded = Date.now(); document.querySelector('#mgFHost').dataset.sig = ''; } else { mg.rows = []; mg.whs = []; mg.trg = []; }
      a2MgSrcUi(); mgRefresh(); }); }
    const n = document.querySelector('#mgAttNote'); if (n) n.addEventListener('click', e => { const a = e.target.closest('a[data-go]'); if (!a) return; e.preventDefault(); if (a.dataset.go === 'mglinks') { mg.tab = 'links'; mgRefresh(); } else if (a.dataset.go === 'otrules') { const nv = document.querySelector('.nav-item[data-view="otrules"]'); if (nv) nv.click(); } else a2GoAtt(a.dataset.go); });
  };
  go();
})();

/* ============ 6 · HOW THE ATTENDANCE FILE FEEDS THE COMPARISON + LINK MAP + VARIANCE VIEW ============ */
const A2_MEAS = [
  { k: 'nh', label: 'Normal working hrs', mg: 'nh', opts: [['req', 'Required hours of the people present (file)'], ['work', 'Work hours − OT (file)'], ['calc', 'Calculated with the Overtime Rules']] },
  { k: 'not', label: 'Normal OT', mg: 'not', opts: [['not', 'Total NOT (file)'], ['notfot', 'Total NOT + Total FOT (file)'], ['ot', 'Total OT (file)'], ['calc', 'Calculated · Normal OT']] },
  { k: 'wo', label: 'Week-off OT', mg: 'wo', opts: [['rot', 'ROT (file)'], ['rotfot', 'ROT + FOT (file)'], ['calc', 'Calculated · Week-off OT']] },
  { k: 'po', label: 'Public OT', mg: 'po', opts: [['hot', 'HOT (file)'], ['calc', 'Calculated · Public OT']] }];
const a2MeasCfg = () => Object.assign({ nh: 'req', not: 'not', wo: 'rot', po: 'hot' }, a2.cfg.meas || {});
let _a2inc = { v: -1, r: null, s: new Set() };
function a2IncDays() {
  if (_a2inc.v === a2.ver && _a2inc.r === at.rows) return _a2inc.s;
  const by = new Map(); at.rows.forEach(r => { if (r.st !== 'Present' && r.st !== 'One punch') return; let o = by.get(r.date); if (!o) by.set(r.date, o = { n: 0, one: 0 }); o.n++; if (r.st === 'One punch') o.one++; });
  const s = new Set(); by.forEach((o, d) => { if (o.n >= 5 && o.one / o.n >= 0.5) s.add(d); }); _a2inc = { v: a2.ver, r: at.rows, s }; return s;
}
const a2RowOk = r => a2.cfg.skipInc === false || !a2IncDays().has(r.date);
const a2Present = r => r.st === 'Present' || r.st === 'One punch' || atHours(r) > 0;
function a2Meas(r) {
  const m = a2MeasCfg(), pr = a2Present(r), n = v => +v || 0; let c = null; const cc = () => c || (c = a2Calc(r));
  const nh = !pr ? 0 : m.nh === 'req' ? n(r.req) : m.nh === 'work' ? Math.max(0, atHours(r) - n(r.ot)) : cc().nh;
  const not = m.not === 'not' ? n(r.not) : m.not === 'notfot' ? n(r.not) + n(r.fot) : m.not === 'ot' ? n(r.ot) : cc().not;
  const wo = m.wo === 'rot' ? n(r.rot) : m.wo === 'rotfot' ? n(r.rot) + n(r.fot) : cc().wo;
  const po = m.po === 'hot' ? n(r.hot) : cc().po;
  return { pr, nh, not, wo, po, ot: not + wo + po };
}

/* ---------- link map: Attendance file ⟷ Employees list ⟷ Mngt Daily Report list ---------- */
function a2MapTot() {
  const A = { nh: 0, not: 0, wo: 0, po: 0, staff: 0 }, E = { nh: 0, not: 0, wo: 0, po: 0, staff: 0 }, whs = new Set(), ds = new Set(at.rows.filter(a2RowOk).map(r => r.date));
  at.rows.forEach(r => { if (!a2RowOk(r)) return; const L = a2RecLink(r); if (!L) return; whs.add(a2nk(L.wh)); const c = a2Meas(r); A.nh += c.nh; A.not += c.not; A.wo += c.wo; A.po += c.po; if (c.pr) A.staff++; });
  a2Entered().forEach(r => { if (!ds.has(r.date) || !whs.has(a2nk(r.wh))) return; E.nh += r.nh || 0; E.not += r.not; E.wo += r.wo; E.po += r.po; E.staff += r.staff || 0; });
  return { A, E };
}
function a2MapCheck() {
  const o = { staff: '', wh: '', day: '', tot: null };
  if (!at.rows.length) { o.staff = o.wh = o.day = '<span style="color:#b45309">Upload the attendance report first.</span>'; return o; }
  const S = a2E.rows.size ? a2EStats() : null, names = a2WhNames(), eds = new Set(a2Entered().map(r => r.date)), inc = a2IncDays(), ads = atDates().filter(d => a2.cfg.skipInc === false || !inc.has(d));
  if (!S) o.staff = o.wh = '<span style="color:#b45309">Load the Employees list (button above).</span>';
  else {
    const ok = at.rows.find(r => a2E.rows.get(a2AKey(r))), e = ok && a2E.rows.get(a2AKey(ok));
    let _nw = 0; a2E.rows.forEach(x => { if (x.wh) _nw++; }); o.staff = `<b>${plF(S.hit)} of ${plF(S.total)}</b> people found` + `<br><span class="text-sm" style="color:${_nw < a2E.rows.size * 0.5 ? '#b42318' : 'var(--gray-600)'}">${plF(_nw)} of ${plF(a2E.rows.size)} employees in the list have a WHs_Link</span>` + (ok ? `<br><span class="text-sm">e.g. ${plEsc(ok.id)} ${plEsc(ok.name)} → ${plEsc(e.name || '')} · ${plEsc(e.wh || 'no WHs_Link')}</span>` : '') + (S.miss.length ? `<br><span class="text-sm" style="color:#b45309">not found: ${S.miss.slice(0, 3).map(m => plEsc(m.id)).join(', ')}${S.miss.length > 3 ? ' …' : ''}</span>` : '');
    if (!names.length) o.wh = '<span style="color:#b45309">Load the Mngt report data to check the warehouse names.</span>';
    else { const bad = S.whc.filter(([v]) => !names.some(x => a2nk(x) === a2nk(a2EWh(v)))); o.wh = `<b>${plF(S.whc.length - bad.length)} of ${plF(S.whc.length)}</b> WHs_Link values match a Mngt warehouse` + (bad.length ? `<br><span class="text-sm" style="color:#b45309">no match: ${bad.slice(0, 4).map(b => plEsc(b[0])).join(', ')}${bad.length > 4 ? ' …' : ''}</span>` : '<br><span class="text-sm">e.g. ' + plEsc(S.whc[0] ? S.whc[0][0] : '') + ' → ' + plEsc(S.whc[0] ? a2EWh(S.whc[0][0]) : '') + '</span>'); }
  }
  if (!eds.size) o.day = '<span style="color:#b45309">Load the Mngt report data.</span>'; else { const hit = ads.filter(d => eds.has(d)); o.day = `<b>${plF(hit.length)} of ${plF(ads.length)}</b> attendance day(s) have Mngt rows` + (hit.length < ads.length ? `<br><span class="text-sm" style="color:#b45309">none for: ${ads.filter(d => !eds.has(d)).slice(0, 3).map(atDateLabel).join(', ')}</span>` : '') + (a2.cfg.skipInc !== false && inc.size ? `<br><span class="text-sm" style="color:#b45309">skipped (incomplete day, most staff have only an IN punch): ${[...inc].map(atDateLabel).join(', ')}</span>` : ''); }
  if (S && eds.size) o.tot = a2MapTot();
  return o;
}
function a2MapRender(p, host) {
  const ck = a2MapCheck(), m = a2MeasCfg(), T = ck.tot, SK = SKIP_VALUE;
  const tc = k => !T ? '<span class="text-sm" style="color:var(--gray-500)">needs both lists</span>' : `Σ attendance <b>${plF(T.A[k], 1)}</b> · Σ entered <b>${plF(T.E[k], 1)}</b> · Δ <b style="color:${Math.abs(T.A[k] - T.E[k]) > a2.cfg.tol ? '#b42318' : '#0b7a0b'}">${plF(T.A[k] - T.E[k], 1)}</b>`;
  p.innerHTML = `<details class="fd-set" open style="margin-bottom:10px"><summary><strong>🔗 Link map — Attendance file ⟷ Employees list ⟷ Mngt Daily Report</strong> <span class="text-sm" style="font-weight:400;color:var(--gray-600)">— define which fields join the three sources and which figures are compared</span></summary>
  <div class="card-desc" style="margin-top:6px">Each attendance record is joined to the <strong>Employees</strong> list by the staff key, the employee's <strong>WHs_Link</strong> is looked up in the Mngt Daily Report <strong>WHs_Desc</strong>, and the day to <strong>Entry_Date</strong>. Pick the fields below; the <em>Check</em> column shows a live sample so you can see the link is right.</div>
  <div class="btn-row" style="margin:6px 0"><button class="secondary small" type="button" data-a="cols">🔄 Load columns of both lists</button><button class="success small" type="button" data-a="reload">⬇ Reload Employees + Mngt data</button><button class="ghost small" type="button" data-a="check">🔎 Re-check</button><label class="text-sm" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-fb style="width:auto" ${a2.cfg.storeFB === true ? 'checked' : ''}> people not in the Employees list: guess the warehouse from their attendance section</label><label class="text-sm" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-si style="width:auto" ${a2.cfg.skipInc !== false ? 'checked' : ''}> skip days where most staff have only an IN punch (day not finished)</label><span class="text-sm a2map-st"></span></div>
  <div class="text-sm a2map-dirty" style="display:none;color:#b45309;margin-bottom:6px">A list column was changed — press <b>⬇ Reload Employees + Mngt data</b> so the new column is read.</div>
  <div class="fd-wrap"><table class="fd-tbl"><thead><tr><th>Join</th><th>🕒 Attendance file</th><th>👤 Employees list</th><th>📊 Mngt Daily Report list</th><th>Check (live sample)</th></tr></thead><tbody>
  <tr><td><b>1 · Staff</b></td><td><select data-ak style="margin:0;min-width:170px"><option value="id" ${a2.cfg.attKey !== 'name' ? 'selected' : ''}>Employee No</option><option value="name" ${a2.cfg.attKey === 'name' ? 'selected' : ''}>Employee Name</option></select></td><td class="combo-cell" data-c="emp.id" style="min-width:260px"></td><td style="color:var(--gray-400)">—</td><td>${ck.staff}</td></tr>
  <tr><td><b>2 · Warehouse</b></td><td style="color:var(--gray-400)">— (through the employee)</td><td class="combo-cell" data-c="emp.wh"></td><td class="combo-cell" data-c="mg.wh"></td><td>${ck.wh}</td></tr>
  <tr><td><b>3 · Day</b></td><td>Date</td><td style="color:var(--gray-400)">—</td><td class="combo-cell" data-c="mg.date"></td><td>${ck.day}</td></tr></tbody></table></div>
  <div class="fd-wrap" style="margin-top:8px"><table class="fd-tbl"><thead><tr><th>Figure compared</th><th>🕒 Taken from the attendance file</th><th>📊 Mngt Daily Report column</th><th>Check (all linked warehouses)</th></tr></thead><tbody>
  ${A2_MEAS.map(x => `<tr><td><b>${x.label}</b></td><td><select data-m="${x.k}" style="margin:0;min-width:280px">${x.opts.map(o => `<option value="${o[0]}" ${m[x.k] === o[0] ? 'selected' : ''}>${plEsc(o[1])}</option>`).join('')}</select></td><td class="combo-cell" data-c="mg.${x.mg}" style="min-width:300px"></td><td>${tc(x.k)}</td></tr>`).join('')}
  <tr><td><b>Staff on duty</b></td><td>People present that day (any punch, or hours)</td><td class="combo-cell" data-c="mg.staff"></td><td>${!T ? '<span class="text-sm" style="color:var(--gray-500)">needs both lists</span>' : `Σ person-days <b>${plF(T.A.staff, 0)}</b> · Σ entered <b>${plF(T.E.staff, 0)}</b> · Δ <b>${plF(T.A.staff - T.E.staff, 0)}</b>`}</td></tr></tbody></table></div></details>`;
  const set = {
    'emp.id': [a2E.cols, () => a2.cfg.emp.map.id, v => { a2.cfg.emp.map.id = v; a2Save(); }], 'emp.wh': [a2E.cols, () => a2.cfg.emp.map.wh, v => { a2.cfg.emp.map.wh = v; a2Save(); }]
  };
  ['wh', 'date', 'nh', 'not', 'wo', 'po', 'staff'].forEach(k => { set['mg.' + k] = [mg.cols.daily, () => mg.cfg.map.daily[k], v => { mg.cfg.map.daily[k] = v; mgSaveCfg(); }]; });
  p.querySelectorAll('td[data-c]').forEach(td => {
    const [cols0, get, put] = set[td.dataset.c], cur = get() || SK, cols = cols0.length ? cols0 : (cur && cur !== SK ? [{ name: cur, displayName: cur }] : []);
    td.appendChild(buildCombo(cur, cols, nv => { put(nv); p.querySelector('.a2map-dirty').style.display = ''; }));
  });
}
function a2MapPanel(host) {
  const par = host.parentNode; let p = par.querySelector(':scope > .a2map');
  if (!p) {
    p = document.createElement('div'); p.className = 'a2map'; const emp = par.querySelector(':scope > .a2emp'); par.insertBefore(p, emp || host);
    const changed = () => { a2Save(); a2LinkChanged(host); }, say = (t, bad) => { const s = p.querySelector('.a2map-st'); if (s) { s.textContent = t; s.style.color = bad ? '#c0392b' : ''; } };
    p.addEventListener('change', e => {
      const sm = e.target.closest('select[data-m]'); if (sm) { a2.cfg.meas = Object.assign(a2MeasCfg(), { [sm.dataset.m]: sm.value }); changed(); return; }
      const ak = e.target.closest('select[data-ak]'); if (ak) { a2.cfg.attKey = ak.value; changed(); return; }
      const si = e.target.closest('input[data-si]'); if (si) { a2.cfg.skipInc = si.checked; changed(); return; }
      const fb = e.target.closest('input[data-fb]'); if (fb) { a2.cfg.storeFB = fb.checked; changed(); }
    });
    p.addEventListener('click', async e => {
      const b = e.target.closest('button[data-a]'); if (!b) return; const act = b.dataset.a;
      if (act === 'check') { a2MapRender(p, host); return; }
      if (act === 'cols') { try { mgInit(); } catch (er) {} const eb = par.querySelector(':scope > .a2emp [data-a="cols"]'); if (eb) eb.click(); const mb = PLQ('#mgColsBtn'); if (mb) mb.click(); say('Loading the columns…'); setTimeout(() => { a2MapRender(p, host); say('Columns loaded — pick the fields.'); }, 3000); return; }
      if (act === 'reload') { b.disabled = true; try { say('Loading the Employees list…'); await a2ELoad(() => {}); say('Loading the Mngt report data…'); mgInit(); await mgLoad(false); say('✅ Both lists reloaded'); } catch (er) { say('✘ ' + er.message, 1); } b.disabled = false; a2LinkChanged(host); }
    });
  }
  a2MapRender(p, host);
}

/* ---------- Mngt Daily Report · View 3 — variance (attendance − entered) ---------- */
function mgApplyVar(keep) {
  if (!at.rows.length) atLoad(); if (!at.rows.length || !(mg.sp && mg.sp.rows.length)) return false;
  const A = mgAttRows().rows, E = mg.sp.rows, nk = a2nk, dates = new Set(A.map(r => r.date)), m = new Map(), z = () => ({ nh: 0, not: 0, wo: 0, po: 0, staff: 0, n: 0 });
  const get = r => { const k = nk(r.wh) + '|' + r.date; let o = m.get(k); if (!o) m.set(k, o = { date: r.date, wh: r.wh, area: r.area || '', region: r.region || '', out: 0, inb: 0, ret: 0, orders: 0, vol: 0, E: z(), A: z() }); return o; };
  E.forEach(r => { if (!dates.has(r.date)) return; const o = get(r); o.out += r.out; o.inb += r.inb; o.ret += r.ret; o.orders += r.orders; o.vol += r.vol; if (r.area) o.area = r.area; if (r.region) o.region = r.region; const e = o.E; e.nh += r.nh || 0; e.not += r.not; e.wo += r.wo; e.po += r.po; e.staff += r.staff || 0; e.n++; });
  A.forEach(r => { const o = get(r); if (!o.area) o.area = r.area || ''; if (!o.region) o.region = r.region || ''; const a = o.A; a.nh += r.nh; a.not += r.not; a.wo += r.wo; a.po += r.po; a.staff += r.staff || 0; a.n++; });
  const rows = [...m.values()].map(o => { [o.E, o.A].forEach(x => { x.ot = x.not + x.wo + x.po; x.hrs = x.nh + x.ot; }); o.side = o.E.n && o.A.n ? 'both' : o.E.n ? 'ent' : 'att'; o.nh = o.E.nh; o.not = o.E.not; o.wo = o.E.wo; o.po = o.E.po; o.ot = o.E.ot; o.hrs = o.E.hrs; return o; });
  const sp = mg.sp; mg.rows = rows; mg.whs = sp.whs || []; mg.trg = sp.trg || [];
  const ds = rows.map(r => r.date).sort(); if (!keep || !mg.f.from) { mg.f.from = ds[0] || ''; mg.f.to = ds[ds.length - 1] || ''; mg.f.area = []; mg.f.region = []; mg.f.wh = []; }
  mg.loaded = Date.now(); const h = document.querySelector('#mgFHost'); if (h) h.dataset.sig = ''; return rows.length > 0;
}
function mgVarCalc() {
  const rows = mgView().filter(r => a2.cfg.varBoth === false || r.side === 'both'), T = mgTargets(), WM = mgWhsMap(), mk = (r, s) => Object.assign({}, r, r[s], { ot: r[s].ot, hrs: r[s].hrs }), rE = rows.map(r => mk(r, 'E')), rA = rows.map(r => mk(r, 'A'));
  const stf = (rs, s) => { const d = new Set(rs.map(r => r.date)); return d.size ? rs.reduce((a, r) => a + (r[s].staff || 0), 0) / d.size : 0; };
  const GE = mgGroups(rE, T, WM), GA = mgGroups(rA, T, WM), lv = { area: mg.f.area, region: mg.f.region, wh: mg.f.wh };
  const V = GE.map((g, i) => ({ k: g.k, e: g.a, a: GA[i].a, sE: stf(g.rows, 'E'), sA: stf(g.rows, 'A'), n: g.rows.length }));
  const aE = mgAgg(rE, T, WM, lv), aA = mgAgg(rA, T, WM, lv), all = { e: aE, a: aA, sE: stf(rE, 'E'), sA: stf(rE, 'A'), n: rows.length, both: rows.filter(r => r.side === 'both').length, ent: rows.filter(r => r.side === 'ent').length, att: rows.filter(r => r.side === 'att').length };
  mg.ctx = { groups: V.map(v => ({ k: v.k, a: { vol: v.e.vol, hE: v.e.hrs, hA: v.a.hrs, oE: v.e.ot, oA: v.a.ot, pE: v.e.prodPct, pA: v.a.prodPct, rE: v.e.prod, rA: v.a.prod, sE: v.sE, sA: v.sA } })), all: aE, V, VA: all };
}
function mgVarKpis() {
  const T = plT(), a = mg.ctx.VA, e = a.e, x = a.a, f = (v, d) => v == null ? '—' : plF(v, d == null ? 1 : d), sg = (v, d) => v == null ? '—' : (v > 0 ? '+' : '') + plF(v, d == null ? 1 : d);
  const col = (d, ref) => { const p = ref ? Math.abs(d) / ref * 100 : (d ? 100 : 0); return p > 10 ? T.crit : p > 3 ? T.warn : T.good; };
  const dH = x.hrs - e.hrs, dO = x.ot - e.ot, dN = (x.hrs - x.ot) - (e.hrs - e.ot), dP = x.prod != null && e.prod != null ? x.prod - e.prod : null, dPP = x.prodPct != null && e.prodPct != null ? x.prodPct - e.prodPct : null, dOP = x.otPct != null && e.otPct != null ? x.otPct - e.otPct : null;
  PLQ('#mgKpis').innerHTML = mgKpi('Working hrs · Δ', sg(dH), `entered ${f(e.hrs)} · attendance ${f(x.hrs)}${e.hrs ? ' · ' + sg(dH / e.hrs * 100, 1) + '%' : ''}`, col(dH, e.hrs))
    + mgKpi('Normal hrs · Δ', sg(dN), `entered ${f(e.hrs - e.ot)} · attendance ${f(x.hrs - x.ot)}`, col(dN, e.hrs - e.ot))
    + mgKpi('OT hrs · Δ', sg(dO), `entered ${f(e.ot)} · attendance ${f(x.ot)}`, col(dO, e.ot))
    + mgKpi('OT % · Δ', dOP == null ? '—' : sg(dOP) + ' pp', `entered ${mgPct(e.otPct)} · attendance ${mgPct(x.otPct)}${e.tOT != null ? ' · target ' + mgPct(e.tOT) : ''}`, dOP == null ? null : col(dOP, e.tOT || 10))
    + mgKpi('Productivity /hr · Δ', dP == null ? '—' : sg(dP), `entered ${f(e.prod)} · attendance ${f(x.prod)}`, dP == null ? null : col(dP, e.prod))
    + mgKpi('Productivity % · Δ', dPP == null ? '—' : sg(dPP, 0) + ' pp', `entered ${mgPct(e.prodPct, 0)} · attendance ${mgPct(x.prodPct, 0)}`, dPP == null ? null : col(dPP, 100))
    + mgKpi('Staff per day · Δ', sg(a.sA - a.sE), `entered ${f(a.sE)} · attendance ${f(a.sA)}`, col(a.sA - a.sE, a.sE))
    + mgKpi('Warehouse-days', plF(a.n), `${plF(a.both)} on both sides · ${plF(a.ent)} only entered · ${plF(a.att)} only attendance`, a.ent || a.att ? T.warn : T.good);
}
const MG_VAR_DEFS = [
  { id: 'vhrs', title: 'Working hrs · entered vs attendance', sub: 'normal + overtime hours', span: 's6', draw: (h, c) => mgCols(h, c.rows, ['Entered', 'Attendance'], a => [a.hE, a.hA], v => plF(v, 1), { col: [0, 1], lab: 1 }) },
  { id: 'vot', title: 'OT hrs · entered vs attendance', sub: 'Normal + Week-off + Public OT', span: 's6', draw: (h, c) => mgCols(h, c.rows, ['Entered', 'Attendance'], a => [a.oE, a.oA], v => plF(v, 1), { col: [0, 1], lab: 1 }) },
  { id: 'vprod', title: 'Productivity · entered vs attendance', sub: 'the same volume divided by each set of hours — % of target when a target exists, otherwise volume per hour', span: 's6', draw: (h, c) => { const T = c.rows.groups.some(g => g.a.pE != null || g.a.pA != null); return T ? mgCols(h, c.rows, ['Entered', 'Attendance'], a => [a.pE, a.pA], v => v == null ? '—' : plF(v, 0) + '%', { col: [0, 1], lab: 1, tickFmt: v => plF(v, 0) + '%' }) : mgCols(h, c.rows, ['Entered', 'Attendance'], a => [a.rE, a.rA], v => plF(v, 1), { col: [0, 1], lab: 1, tickFmt: v => plF(v, 0) }); } },
  { id: 'vstaff', title: 'Staff per day · entered vs attendance', sub: 'Nr_Actual_Staff against people present', span: 's6', draw: (h, c) => mgCols(h, c.rows, ['Entered', 'Attendance'], a => [a.sE, a.sA], v => plF(v, 1), { col: [0, 1], lab: 1 }) }
];
function mgVarRender() {
  mgVarCalc(); mgVarKpis(); { const g = PLQ('#mgGrid'); if (g.dataset.defs !== 'var') { g.innerHTML = ''; g.dataset.defs = 'var'; } } atDrawGrid(PLQ('#mgGrid'), MG_VAR_DEFS, { rows: () => mg.ctx }); mgTableRender(); try { mgMissRender(); } catch (e) { console.error(e); }
}
const MG_VAR_HEAD = ['Group', 'Wh-days', 'Staff/day · entered', 'Staff/day · attendance', 'Δ Staff', 'Normal hrs · entered', 'Normal hrs · attendance', 'Δ Normal hrs', 'OT hrs · entered', 'OT hrs · attendance', 'Δ OT hrs', 'Working hrs · entered', 'Working hrs · attendance', 'Δ Working hrs', 'Δ Working hrs %', 'OT % · entered', 'OT % · attendance', 'Δ OT % (pp)', 'Productivity /hr · entered', 'Productivity /hr · attendance', 'Δ Productivity /hr', 'Productivity % · entered', 'Productivity % · attendance', 'Δ Productivity % (pp)'];
function mgVarTableData() {
  const dd = (a, b) => a == null || b == null ? null : a - b, r = (k, e, a, sE, sA, n) => [k, n, sE, sA, sA - sE, e.hrs - e.ot, a.hrs - a.ot, (a.hrs - a.ot) - (e.hrs - e.ot), e.ot, a.ot, a.ot - e.ot, e.hrs, a.hrs, a.hrs - e.hrs, e.hrs ? (a.hrs - e.hrs) / e.hrs * 100 : null, e.otPct, a.otPct, dd(a.otPct, e.otPct), e.prod, a.prod, dd(a.prod, e.prod), e.prodPct, a.prodPct, dd(a.prodPct, e.prodPct)].map((v, i) => i && typeof v === 'number' ? Math.round(v * 100) / 100 : (v == null ? '' : v));
  const c = mg.ctx, A = c.VA; return { title: 'Management Daily Report · variance (attendance − entered)', note: mgFilterText(), sheet: 'Mngt variance', headers: MG_VAR_HEAD, rows: c.V.map(v => r(v.k, v.e, v.a, v.sE, v.sA, v.n)), totals: r('TOTAL', A.e, A.a, A.sE, A.sA, A.n) };
}
document.addEventListener('change', e => { const c = e.target.closest && e.target.closest('#mgAttNote input[data-vb]'); if (c) { a2.cfg.varBoth = c.checked; a2Save(); mgRenderReport(); } });
const _mgTD = mgTableData; mgTableData = function () { return mg.cfg.src === 'var' && mg.ctx && mg.ctx.V ? mgVarTableData() : _mgTD(); };
const _mgTR = mgTableRender; mgTableRender = function () {
  _mgTR(); if (mg.cfg.src !== 'var' || !mg.ctx || !mg.ctx.V) return;
  const t = PLQ('#mgTable'); if (!t) return; const hd = [...t.querySelectorAll('thead th')].map(h => h.textContent.trim());
  t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (hd[i] && hd[i].startsWith('Δ')) { const v = parseFloat(String(td.textContent).replace(/,/g, '')); if (isFinite(v) && Math.abs(v) >= 0.05) { td.style.color = '#b42318'; td.style.fontWeight = '600'; if (v > 0 && !/^[+]/.test(td.textContent)) td.textContent = '+' + td.textContent; } } }));
};
const _mgRR = mgRenderReport; mgRenderReport = function () {
  if (mg.cfg.src === 'var' && mg.rows.length && PLQ('#view-mgt .mg-pane[data-p="rep"]')) {
    if (document.querySelector('#mgFHost').dataset.sig !== mg.rows.length + '|' + mg.loaded) mgFilterUi(); PLQ('#mgFrom').value = mg.f.from; PLQ('#mgTo').value = mg.f.to; PLQ('#mgBy').value = mg.cfg.by; mgVarRender(); return;
  }
  { const g = PLQ('#mgGrid'); if (g && g.dataset.defs === 'var') { g.innerHTML = ''; g.dataset.defs = 'std'; } }
  _mgRR();
};
const _mgRf = mgRefresh; mgRefresh = function () { _mgRf(); if (mg.cfg.src === 'var') PLQ('#mgSrcLine').textContent = mg.rows.length ? `Variance · attendance file “${at.file || ''}” against the Mngt list “${mg.cfg.list.daily || ''}” · ${plF(mg.rows.length)} warehouse-day rows` : 'Variance view — upload the attendance report and load the Mngt Daily Report data.'; };

