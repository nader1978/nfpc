/* ============ 7 · WAREHOUSE GROUPING = Mngt Daily Report warehouses; everything else in its own tab ============ */
let _a2mn = { k: '', s: new Set() };
function a2MngtSet() { const k = a2.ver + '|' + a2Entered().length + '|' + ((mg.whs || []).length); if (_a2mn.k !== k) { _a2mn = { k, s: new Set(a2WhNames().map(a2nk)) }; } return _a2mn.s; }
const _a2wc = new WeakMap();
function a2MngtWh(r) {
  const k = a2.ver + '|' + a2Entered().length, c = _a2wc.get(r); if (c && c.k === k) return c.x;
  const L = a2RecLink(r), S = a2MngtSet(); let x = L ? L.wh : ''; if (x && S.size && !S.has(a2nk(x))) x = ''; _a2wc.set(r, { k, x }); return x;
}
const a2IsOther = r => a2.cfg.field === 'wh' && !a2MngtWh(r);
function a2Why(r) {
  if (!a2EOn()) return 'Employees list not loaded — warehouse could not be linked'; const e = a2E.rows.get(a2AKey(r));
  if (!e) return 'Not in the Employees list'; if (!e.wh) return 'No WHs_Link on the Employees list'; return `WHs_Link “${a2EWh(e.wh)}” is not a warehouse of the Mngt Daily Report`;
}
function a2OthRows() {
  const V = atView().filter(r => !a2MngtWh(r)), ar = new Map(), pp = new Map();
  V.forEach(r => {
    const raw = a2StoreRaw(r), k = raw + '|' + (r.loc || ''), why = a2Why(r), c = a2Calc(r), pk = a2AKey(r) || r.name;
    let o = ar.get(k); if (!o) ar.set(k, o = { store: raw, loc: r.loc || '', emp: new Set(), dates: new Set(), n: 0, h: 0, ot: 0, why: new Set() }); o.emp.add(pk); o.dates.add(r.date); o.n++; o.h += c.h; o.ot += c.ot; o.why.add(why);
    let p = pp.get(pk); if (!p) pp.set(pk, p = { id: r.id, name: r.name, pos: r.pos || '', loc: r.loc || '', sec: r.sec || '', store: raw, why, days: 0, h: 0, ot: 0 }); p.days++; p.h += c.h; p.ot += c.ot;
  });
  return { areas: [...ar.values()].sort((a, b) => a.store.localeCompare(b.store)), people: [...pp.values()].sort((a, b) => a.store.localeCompare(b.store) || a.name.localeCompare(b.name)), recs: V.length };
}
const A2_OTH_ACOLS = [['Attendance area (store)', o => o.store], ['Work location', o => o.loc], a2nc('People', o => o.emp.size), a2nc('Days', o => o.dates.size), a2nc('Records', o => o.n), a2nc('Worked h', o => o.h), a2nc('OT h', o => o.ot), ['Why not in the Mngt report', o => [...o.why].join(' · ')]];
const A2_OTH_PCOLS = [['File Nr', o => o.id], ['Name', o => o.name], ['Position', o => o.pos], ['Work location', o => o.loc], ['Section', o => o.sec], ['Attendance area', o => o.store], a2nc('Days', o => o.days), a2nc('Worked h', o => o.h), a2nc('OT h', o => o.ot), ['Why', o => o.why]];
const a2OthAData = () => { const d = a2OthRows(); return a2Data('Attendance areas not in the Mngt Daily Report', 'Areas not in Mngt', `${plF(d.areas.length)} area(s) · ${plF(d.people.length)} people`, A2_OTH_ACOLS, d.areas); };
const a2OthPData = () => { const d = a2OthRows(); return a2Data('People in areas not in the Mngt Daily Report', 'People not in Mngt', `${plF(d.people.length)} people`, A2_OTH_PCOLS, d.people); };
function a2OthRender() {
  const d = a2OthRows(), K = atKpi, tb = (cols, rows) => `<thead><tr>${cols.map((c, i) => `<th class="${c.length > 2 ? 'n' : ''}">${plEsc(c[0])}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c.length > 2 ? 'n' : ''}">${plEsc(c[1](r))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" style="padding:14px;color:var(--gray-600)">✅ Every person in the current filter belongs to a warehouse of the Mngt Daily Report.</td></tr>`}</tbody>`;
  const mn = a2WhNames().length;
  PLQ('#othInfo').textContent = `— ${plF(d.areas.length)} area(s) · ${plF(d.people.length)} people · ${plF(d.recs)} record(s)`;
  PLQ('#othKpis').innerHTML = K('Areas outside Mngt', plF(d.areas.length), mn ? `${plF(mn)} warehouses in the Mngt Daily Report` : 'Mngt data not loaded — only unlinked people are listed') + K('People', plF(d.people.length), 'not in any Mngt warehouse') + K('Records', plF(d.recs), 'attendance rows') + K('Worked h', plF(d.areas.reduce((a, o) => a + o.h, 0), 0) + ' h', 'in those areas') + K('OT h', plF(d.areas.reduce((a, o) => a + o.ot, 0), 1) + ' h', 'overtime in those areas');
  PLQ('#othAreas').innerHTML = tb(A2_OTH_ACOLS, d.areas); PLQ('#othPeople').innerHTML = tb(A2_OTH_PCOLS, d.people);
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#view-att [data-oth]'); if (!b) return; const [w, k] = b.dataset.oth.split(':'), fn = w === 'a' ? a2OthAData : a2OthPData, d = fn();
  if (k === 'xl') a2Export(d); else if (k === 'pr') a2Print(d); else if (k === 'ex') a2Expand(d); else a2Mail(fn);
});

/* ============ 8 · HOURS PER STAFF (Employees list) and PER WAREHOUSE (WHs_Link) vs the entered Mngt data ============ */
function a2SwBuild() {
  const V = atView().filter(a2RowOk), dates = [...new Set(V.map(r => r.date))].sort(), ds = new Set(dates), per = new Map(), S = a2MngtSet();
  const whName = v => { const n = a2EWh(v); return n || ''; };
  V.forEach(r => { const k = a2AKey(r); let o = per.get(k); if (!o) per.set(k, o = { id: r.id, name: r.name, days: 0, worked: 0, h: 0, req: 0, ot: 0, dh: {} }); o.days++; const h = atHours(r); o.dh[r.date] = (o.dh[r.date] || 0) + h; if (h > 0) { o.worked++; o.h += h; } if (a2Present(r)) o.req += +r.req || 0; o.ot += +r.ot || 0; });
  const staff = [], seen = new Set();
  a2E.rows.forEach((e, k) => { const p = per.get(k) || { id: '', name: '', days: 0, worked: 0, h: 0, req: 0, ot: 0, dh: {} }; seen.add(k); staff.push({ key: k, dh: p.dh, id: p.id || k, name: e.name || p.name, wh: whName(e.wh) || '(no WHs_Link)', days: p.days, worked: p.worked, h: p.h, req: p.req, ot: p.ot, inList: true }); });
  per.forEach((p, k) => { if (!seen.has(k)) staff.push({ key: k, dh: p.dh, id: p.id, name: p.name, wh: '(not in the Employees list)', days: p.days, worked: p.worked, h: p.h, req: p.req, ot: p.ot, inList: false }); });
  staff.sort((a, b) => a.wh.localeCompare(b.wh) || a.name.localeCompare(b.name));
  const wm = new Map(), get = n => { const k = a2nk(n); let o = wm.get(k); if (!o) wm.set(k, o = { wh: n, k, emp: 0, att: 0, pd: 0, h: 0, ot: 0, eDays: 0, eStaff: 0, eNh: 0, eOt: 0 }); return o; };
  staff.forEach(s => { const o = get(s.wh); o.emp += s.inList ? 1 : 0; if (s.days) o.att++; o.pd += s.worked; o.h += s.h; o.ot += s.ot; });
  a2Entered().forEach(r => { if (!ds.has(r.date)) return; const o = get(r.wh); if (o.wh !== r.wh && S.has(o.k)) o.wh = r.wh; o.eDays++; o.eStaff += r.staff || 0; o.eNh += r.nh || 0; o.eOt += r.ot || 0; });
  const warehouses = [...wm.values()].map(o => Object.assign(o, { inMngt: S.size ? S.has(o.k) : null, eHrs: o.eNh + o.eOt, d: o.h - (o.eNh + o.eOt), dp: (o.eNh + o.eOt) ? (o.h - (o.eNh + o.eOt)) / (o.eNh + o.eOt) * 100 : null })).sort((a, b) => (b.inMngt ? 1 : 0) - (a.inMngt ? 1 : 0) || a.wh.localeCompare(b.wh));
  const inc = a2IncDays(), skipped = a2.cfg.skipInc !== false ? [...inc] : [];
  return { dates, skipped, staff, warehouses };
}
const A2_SW_SCOLS = [['File Nr', o => o.id], ['Name', o => o.name], ['Warehouse (WHs_Link)', o => o.wh], a2nc('Days in report', o => o.days), a2nc('Days worked', o => o.worked), a2nc('Total work hrs', o => o.h), a2nc('Required hrs', o => o.req), a2nc('OT hrs (file)', o => o.ot), ['Note', o => !o.inList ? 'Not in the Employees list' : o.days ? (o.worked ? '' : 'No hours in the period') : 'No attendance record']];
const A2_SW_WCOLS = [['Warehouse', o => o.wh], ['In Mngt table', o => o.inMngt == null ? '' : o.inMngt ? 'Yes' : 'No'], a2nc('Employees', o => o.emp), a2nc('With attendance', o => o.att), a2nc('Person-days worked', o => o.pd), a2nc('Attendance work hrs', o => o.h), a2nc('Attendance OT hrs', o => o.ot), a2nc('Entered days', o => o.eDays), a2nc('Entered staff-days', o => o.eStaff), a2nc('Entered normal hrs', o => o.eNh), a2nc('Entered OT hrs', o => o.eOt), a2nc('Entered working hrs', o => o.eHrs), a2nc('Δ hrs (attendance − entered)', o => o.d), a2nc('Δ %', o => o.dp)];
function a2SwTot(rows, cols) { const t = cols.map(() => ''); t[0] = 'TOTAL'; cols.forEach((c, i) => { if (i && c.length > 2 && !/Δ %/.test(c[0])) t[i] = a2f(rows.reduce((a, o) => a + (+c[2](o) || 0), 0)); }); return t; }
const a2SwSData = () => { const d = a2SwBuild(), r = a2Data('Hours per staff member', 'Hours per staff', `${d.dates.join(', ')}`, A2_SW_SCOLS, d.staff); r.totals = a2SwTot(d.staff, A2_SW_SCOLS); return r; };
const a2SwWData = () => { const d = a2SwBuild(), r = a2Data('Hours per warehouse — attendance vs entered', 'Hours per warehouse', `${d.dates.join(', ')}`, A2_SW_WCOLS, d.warehouses); r.totals = a2SwTot(d.warehouses, A2_SW_WCOLS); const dp = r.totals.length - 1, w = d.warehouses.reduce((a, o) => a + o.eHrs, 0); r.totals[dp] = w ? a2f((d.warehouses.reduce((a, o) => a + o.h, 0) - w) / w * 100) : ''; const W2 = d.warehouses.filter(o => o.att > 0 && o.eDays > 0); r.totals2 = a2SwTot(W2, A2_SW_WCOLS); r.totals2[0] = 'TOTAL · with attendance and entered data'; const w2 = W2.reduce((a, o) => a + o.eHrs, 0); r.totals2[dp] = w2 ? a2f((W2.reduce((a, o) => a + o.h, 0) - w2) / w2 * 100) : ''; r.rows.push(r.totals2); return r; };
function a2SwRender() {
  const d = a2SwBuild(), q = PLQ, sk = q('#swSkip'); if (sk) sk.checked = a2.cfg.skipInc !== false;
  const tb = (data) => `<thead><tr>${data.headers.map((h, i) => `<th class="${i > 2 || /hrs|days|%|Employees|attendance/i.test(h) && i > 0 ? 'n' : ''}">${plEsc(h)}</th>`).join('')}</tr></thead><tbody>${data.rows.map(r => `<tr>${r.map((v, i) => `<td class="${typeof v === 'number' ? 'n' : ''}"${/^Δ/.test(data.headers[i]) && typeof v === 'number' && Math.abs(v) >= 0.05 ? ' style="color:#b42318;font-weight:600"' : ''}>${plEsc(typeof v === 'number' ? plF(v, v % 1 ? 1 : 0) : v)}</td>`).join('')}</tr>`).join('')}<tr class="t">${data.totals.map(v => `<td class="${typeof v === 'number' ? 'n' : ''}"><b>${plEsc(typeof v === 'number' ? plF(v, v % 1 ? 1 : 0) : v)}</b></td>`).join('')}</tr></tbody>`;
  const L = atDateLabel, per = d.dates.length ? `${L(d.dates[0])} → ${L(d.dates[d.dates.length - 1])} (${d.dates.length} day${d.dates.length > 1 ? 's' : ''})` : 'no days';
  q('#swPeriod').innerHTML = `📅 Period compared: <b>${per}</b>` + (d.skipped.length ? ` · <span style="color:#b45309">skipped as unfinished (most staff have only an IN punch): ${d.skipped.map(L).join(', ')}</span>` : '') + (a2E.rows.size ? '' : ' · <span style="color:#b45309">Employees list not loaded — open the Link map and load it</span>') + (a2Entered().length ? '' : ' · <span style="color:#b45309">Mngt report data not loaded</span>');
  q('#swWInfo').textContent = `— ${plF(d.warehouses.length)} warehouse(s)`; q('#swSInfo').textContent = `— ${plF(d.staff.length)} staff`;
  q('#swWh').innerHTML = tb(a2SwWData()); q('#swStaff').innerHTML = tb(a2SwSData());
  [...q('#swWh').querySelectorAll('tbody tr')].forEach((tr, i) => { const w = d.warehouses[i]; if (w) { tr.dataset.wk = w.k; tr.style.cursor = 'pointer'; tr.title = 'Double-click to see the staff of ' + w.wh; } });
  const nameIdx = [...q('#swStaff').querySelectorAll('thead th')].findIndex(h => /^name$/i.test(h.textContent.trim()));
  [...q('#swStaff').querySelectorAll('tbody tr')].forEach((tr, i) => { const o = d.staff[i]; if (!o) return; const td = tr.children[nameIdx]; if (td) td.innerHTML = `<a href="#" data-emp="${plEsc(o.key)}" style="font-weight:600;text-decoration:underline" title="Double-click to open the Edit card of this employee">${plEsc(o.name || '(no name)')}</a>`; tr.dataset.emp = o.key; });
  if (document.querySelector('#swModal') && document.querySelector('#swModal').style.display !== 'none') a2SwModalRender();
  if (!a2Entered().length && !mg._swTried && mg.cfg.list.daily && getGlobalAccessToken() && getGlobalSiteUrl()) { mg._swTried = true; try { mgInit(); if (mgMapOk('daily')) mgLoad(true).then(() => { if (at.tab === 'sw') a2SwRender(); }); } catch (e) {} }
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#view-att [data-sw]'); if (!b) return; const [w, k] = b.dataset.sw.split(':'), fn = w === 'w' ? a2SwWData : a2SwSData, d = fn();
  if (k === 'xl') a2Export(d); else if (k === 'pr') a2Print(d); else if (k === 'ex') a2Expand(d); else a2Mail(fn);
});
document.addEventListener('change', e => { if (e.target.id === 'swSkip') { a2.cfg.skipInc = e.target.checked; a2Save(); a2Bump(); a2SwRender(); } });



/* ============ KPIs vs targets — attendance of the Employees-list staff against the targets list (OT_Target, Target_Value) ============ */
const kp = { sw: { i: 7, d: -1 }, ss: { i: 13, d: -1 }, q: '', wh: [], st: '', shown: 200, incl: false, tried: false, busy: false };
function kpTgt(rowsW, wh) {
  const T = mgTargets(), d = k => [...new Set(rowsW.map(r => r[k]).filter(Boolean))];
  let r = T({ area: d('area'), region: d('region'), wh: [wh] }) || T({ wh: [wh] }) || (rowsW.length ? T({ area: d('area'), region: d('region') }) : null); if (r) return r;
  /* employee warehouse names (Maqta, Musaffah, Al Ain, Tarif …) vs the WHs_Code of the targets list (MAQ, MUS, ALN, TRF …) */
  const n = a2nk(wh), al = KP_ALIAS[n], codes = [...new Set(mg.trg.map(t => t.code))]; if (al && (r = T({ wh: [al] }))) return r;
  const pre = codes.filter(c => a2nk(c).length >= 3 && n.startsWith(a2nk(c))).sort((x, y) => y.length - x.length)[0]; return pre ? T({ wh: [pre] }) : null;
}
const KP_ALIAS = { maqta: 'MAQ', maqtawh: 'MAQ', musaffah: 'MUS', alain: 'ALN', alainirb: 'IRB', irb: 'IRB', tarif: 'TRF', kizad: 'KZD', khalifaindustrialzone: 'KZD', dubai: 'DXB', rak: 'RAK', rasalkhaimah: 'RAK', fujairah: 'FUJ', sharjah: 'SHJ' };
function kpBuild() {
  const V = atView().filter(a2RowOk), dates = [...new Set(V.map(r => r.date))].sort(), ds = new Set(dates), per = new Map(); let outside = 0; const outK = new Set();
  V.forEach(r => { const k = a2AKey(r), e = a2E.rows.get(k); if (!e && !kp.incl) { outK.add(k); return; }
    let o = per.get(k); if (!o) per.set(k, o = { key: k, id: r.id, name: (e && e.name) || r.name, wh: e ? (e.wh ? a2EWh(e.wh) : '(no WHs_Link)') : (r.wh || '(not in the Employees list)'), pos: r.pos, sec: r.sec, inList: !!e, days: 0, worked: 0, abs: 0, leave: 0, h: 0, ot: 0 });
    o.days++; const h = atHours(r); if (h > 0) { o.worked++; o.h += h; } if (r.st === 'Absent') o.abs++; if (r.st === 'Leave') o.leave++; o.ot += +r.ot || 0; });
  const ent = a2Entered().filter(r => ds.has(r.date)), WM = mgWhsMap(), memo = new Map(), rowsOf = wh => ent.filter(r => a2nk(r.wh) === a2nk(wh));
  const tg = wh => { const k = a2nk(wh); if (!memo.has(k)) memo.set(k, /^\(/.test(wh) ? null : kpTgt(rowsOf(wh), wh)); return memo.get(k); };
  const staff = [...per.values()].map(o => { const t = tg(o.wh), tOT = t ? t.ot : null, tProd = t ? t.prod : null; o.otPct = o.h > 0 ? o.ot / o.h * 100 : null; o.tOT = tOT; o.diff = o.otPct != null && tOT != null ? o.otPct - tOT : null; o.allow = tOT != null ? o.h * tOT / 100 : null; o.excess = o.allow != null ? o.ot - o.allow : null; o.tProd = tProd; o.tVol = tProd != null ? tProd * o.h : null; o.stt = o.diff == null ? 'none' : o.diff <= 0 ? 'within' : 'above'; return o; });
  const gm = new Map(); staff.forEach(o => { const k = a2nk(o.wh); let g = gm.get(k); if (!g) gm.set(k, g = { k, wh: o.wh, n: 0, pd: 0, h: 0, ot: 0, within: 0, above: 0, none: 0 }); g.n++; g.pd += o.worked; g.h += o.h; g.ot += o.ot; g[o.stt]++; });
  const whs = [...gm.values()].map(g => { const rw = rowsOf(g.wh), t = tg(g.wh), a = mgAgg(rw, () => null, WM, {}); g.tOT = t ? t.ot : null; g.tProd = t ? t.prod : null; g.otPct = g.h > 0 ? g.ot / g.h * 100 : null; g.diff = g.otPct != null && g.tOT != null ? g.otPct - g.tOT : null; g.stt = g.diff == null ? 'none' : g.diff <= 0 ? 'within' : 'above';
    g.vol = rw.length ? a.vol : null; g.prod = g.vol != null && g.vol > 0 && g.h > 0 ? g.vol / g.h : null; g.prodPct = g.prod != null && g.tProd ? g.prod / g.tProd * 100 : null; g.tVol = g.tProd != null ? g.tProd * g.h : null; g.gap = g.vol != null && g.tVol != null ? g.vol - g.tVol : null; return g; }).sort((a, b) => a.wh.localeCompare(b.wh));
  return { dates, staff, whs, outside: outK.size, entN: ent.length };
}
const kpF = (v, d) => v == null ? '' : plF(v, d == null ? 1 : d);
const kpSt = { above: ['Above target', '#d03b3b'], within: ['Within target', '#0ca30c'], none: ['No target / hours', '#6b7280'] };
const KP_WCOLS = [['Warehouse', o => o.wh], ['Staff', o => o.n, 0], ['Person-days worked', o => o.pd, 0], ['Work hrs', o => o.h, 0], ['OT hrs', o => o.ot, 0], ['OT %', o => o.otPct], ['OT target %', o => o.tOT], ['OT diff (pp)', o => o.diff, 1, 1], ['Staff within target', o => o.within + ' / ' + o.n], ['OT status', o => kpSt[o.stt][0]], ['Volume (Mngt)', o => o.vol, 0], ['Productivity /hr', o => o.prod], ['Target /hr', o => o.tProd], ['Productivity %', o => o.prodPct, 0], ['Target volume', o => o.tVol, 0], ['Volume gap', o => o.gap, 0, 1]];
const KP_SCOLS = [['File Nr', o => o.id], ['Name', o => o.name], ['Warehouse', o => o.wh], ['Position', o => o.pos], ['Section', o => o.sec], ['Days', o => o.days, 0], ['Worked', o => o.worked, 0], ['Absent', o => o.abs, 0], ['Leave', o => o.leave, 0], ['Work hrs', o => o.h, 1], ['OT hrs', o => o.ot, 1], ['OT %', o => o.otPct], ['OT target %', o => o.tOT], ['OT diff (pp)', o => o.diff, 1, 1], ['Allowed OT hrs', o => o.allow], ['Excess OT hrs', o => o.excess, 1, 1], ['Target /hr', o => o.tProd], ['Target volume', o => o.tVol, 0], ['OT status', o => kpSt[o.stt][0]]];
const kpCell = (c, o, i) => { const v = c[1](o), dec = c[2] == null ? 1 : c[2]; return typeof v === 'number' || v == null ? kpF(v, dec) : v; };
function kpStaffRows(D) { const q = kp.q.trim().toLowerCase(); return D.staff.filter(o => (!q || (o.name + ' ' + o.id).toLowerCase().includes(q)) && (!kp.wh.length || kp.wh.includes(o.wh)) && (!kp.st || o.stt === kp.st)); }
const kpSort = (rows, cols, s) => { const c = cols[s.i]; if (!c) return rows; return rows.slice().sort((a, b) => { const x = c[1](a), y = c[1](b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * s.d; }); };
function kpWData() { const D = kpBuild(), R = kpSort(D.whs, KP_WCOLS, kp.sw); return a2Data('KPIs vs targets — warehouses', 'KPI_Warehouses', D.dates.length ? D.dates[0] + ' → ' + D.dates[D.dates.length - 1] : '', KP_WCOLS.map(c => [c[0], o => { const v = c[1](o); return v == null ? '' : typeof v === 'number' ? Math.round(v * 100) / 100 : v; }]), R); }
function kpSData() { const D = kpBuild(), R = kpSort(kpStaffRows(D), KP_SCOLS, kp.ss); return a2Data('KPIs vs targets — staff', 'KPI_Staff', D.dates.length ? D.dates[0] + ' → ' + D.dates[D.dates.length - 1] : '', KP_SCOLS.map(c => [c[0], o => { const v = c[1](o); return v == null ? '' : typeof v === 'number' ? Math.round(v * 100) / 100 : v; }]), R); }
function kpBar(o) { if (o.otPct == null) return ''; const mx = Math.max(o.otPct, o.tOT || 0, 1) * 1.15, col = o.stt === 'above' ? '#d03b3b' : o.stt === 'within' ? '#0ca30c' : '#6b7280'; return `<div class="kp-bar" title="OT ${kpF(o.otPct)}%${o.tOT != null ? ' · target ' + kpF(o.tOT) + '%' : ''}"><i style="width:${o.otPct / mx * 100}%;background:${col}"></i>${o.tOT != null ? `<b style="left:${o.tOT / mx * 100}%"></b>` : ''}</div>`; }
function kpTblHtml(cols, rows, srt, kind) {
  const head = '<thead><tr>' + (kind === 'w' ? '<th></th>' : '') + cols.map((c, i) => `<th data-kps="${kind}:${i}" style="cursor:pointer" title="Sort">${plEsc(c[0])}${srt.i === i ? (srt.d > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr></thead>';
  const body = rows.map(o => '<tr' + (kind === 'w' ? ` data-wk="${plEsc(o.k)}" style="cursor:pointer"` : ` data-emp="${plEsc(o.key)}"`) + '>' + (kind === 'w' ? `<td style="min-width:90px">${kpBar(o)}</td>` : '') + cols.map((c, i) => { const v = kpCell(c, o, i), lab = c[0];
    if (lab === 'OT status') return `<td><span class="at-chip" style="background:${kpSt[o.stt][1]}22;color:${kpSt[o.stt][1]}">${plEsc(v)}</span></td>`;
    const num = typeof c[1](o) === 'number', col = c[3] && typeof c[1](o) === 'number' ? (/Volume gap/.test(lab) ? (c[1](o) >= 0 ? '#0b7a0b' : '#b42318') : (c[1](o) > 0 ? '#b42318' : '#0b7a0b')) : '', bold = /^Name$|Warehouse/.test(lab) ? 'font-weight:600;' : '';
    return `<td class="${num ? 'n' : ''}" style="${bold}${col ? 'color:' + col + ';font-weight:600' : ''}">${plEsc(v)}</td>`; }).join('') + '</tr>').join('');
  return head + '<tbody>' + (body || `<tr><td colspan="${cols.length + 1}" style="text-align:center;padding:16px;color:var(--gray-400);font-style:italic">Nothing to show for the current filters.</td></tr>`) + '</tbody>';
}
function kpRender() {
  const q = PLQ; if (!q('#kpWh')) return; const D = kpBuild(), T = plT(), K = atKpi, S = D.staff, W = D.whs;
  const hrs = S.reduce((a, o) => a + o.h, 0), ot = S.reduce((a, o) => a + o.ot, 0), withT = S.filter(o => o.tOT != null && o.h > 0), wh = withT.reduce((a, o) => a + o.h, 0), tOT = wh ? withT.reduce((a, o) => a + o.h * o.tOT, 0) / wh : null, otP = hrs ? ot / hrs * 100 : null, dif = otP != null && tOT != null ? otP - tOT : null;
  const nIn = S.filter(o => o.stt === 'within').length, nOut = S.filter(o => o.stt === 'above').length, wIn = W.filter(g => g.stt === 'within').length, wOut = W.filter(g => g.stt === 'above').length;
  const pw = W.filter(g => g.prod != null && g.tProd), pH = pw.reduce((a, g) => a + g.h, 0), pV = pw.reduce((a, g) => a + g.vol, 0), pT = pH ? pw.reduce((a, g) => a + g.h * g.tProd, 0) / pH : null, pPct = pH && pT ? (pV / pH) / pT * 100 : null;
  q('#kpIncl').checked = kp.incl;
  const okc = v => v == null ? '' : v ? '#0ca30c' : '#d03b3b';
  q('#kpStatus').innerHTML = `👥 Employees list: <b>${a2E.rows.size ? plF(a2E.rows.size) + ' staff' : 'not loaded'}</b> · 🎯 Targets: <b>${mg.trg.length ? plF(mg.trg.length) + ' rows' : 'not loaded'}</b> · 📦 Volumes (Mngt Daily Report): <b>${D.entN ? plF(D.entN) + ' rows in the period' : 'not loaded'}</b>` + (D.dates.length ? ` · 📅 ${atDateLabel(D.dates[0])} → ${atDateLabel(D.dates[D.dates.length - 1])} (${D.dates.length} day${D.dates.length > 1 ? 's' : ''})` : '') + (!kp.incl && D.outside ? ` · <span style="color:#b45309">${plF(D.outside)} attendance staff not in the Employees list are left out</span>` : '') + ((!a2E.rows.size || !mg.trg.length) ? ' · <span style="color:#b45309">press “Load staff, targets & volumes” (lists are set in the Management report → Lists &amp; mapping and the Attendance link map)</span>' : '');
  q('#kpInfo').textContent = `— ${plF(S.length)} staff · ${plF(W.length)} warehouse(s)`; q('#kpWInfo').textContent = `— ${plF(W.length)}`;
  q('#kpKpis').innerHTML = K('Staff measured', plF(S.length), `${plF(withT.length)} with a warehouse target`) + K('Work hours', plF(hrs, 0) + ' h', `${plF(ot, 0)} h overtime`)
    + `<div class="pl-kpi"${dif != null ? ` style="border-left:4px solid ${okc(dif <= 0)}"` : ''}><div class="lbl">OT % vs target</div><div class="val">${otP == null ? '—' : plF(otP, 1) + '%'}</div><div class="sub">${tOT == null ? 'no target' : `target ${plF(tOT, 1)}% · ${dif > 0 ? '▲ +' : '▼ '}${plF(dif, 1)} pp`}</div></div>`
    + K('Staff within OT target', plF(nIn), `${S.length ? plF(nIn / S.length * 100, 0) : 0}% · ${plF(nOut)} above`) + K('Warehouses within OT target', `${plF(wIn)} / ${plF(W.length)}`, `${plF(wOut)} above target`)
    + `<div class="pl-kpi"${pPct != null ? ` style="border-left:4px solid ${okc(pPct >= 100)}"` : ''}><div class="lbl">Productivity % (warehouses)</div><div class="val">${pPct == null ? '—' : plF(pPct, 0) + '%'}</div><div class="sub">${pPct == null ? 'needs volumes + Target_Value' : `${plF(pV / pH, 1)} per hour · target ${plF(pT, 1)}`}</div></div>`;
  const hn = q('#kpWhHost'), names = [...new Set(S.map(o => o.wh))].sort(), sig = names.join('|') + '#' + kp.wh.join('|'); kp.wh = kp.wh.filter(n => names.includes(n));
  if (hn.dataset.sig !== sig) { hn.dataset.sig = sig; hn.innerHTML = ''; hn.appendChild(buildMultiCombo(kp.wh, names, arr => { kp.wh = arr; kp.shown = 200; hn.dataset.sig = ''; kpRender(); }, { placeholder: 'All warehouses' })); }
  q('#kpSt').value = kp.st; if (document.activeElement !== q('#kpQ')) q('#kpQ').value = kp.q;
  q('#kpWh').innerHTML = kpTblHtml(KP_WCOLS, kpSort(W, KP_WCOLS, kp.sw), kp.sw, 'w');
  const R = kpSort(kpStaffRows(D), KP_SCOLS, kp.ss); q('#kpSInfo').textContent = `— ${plF(R.length)} of ${plF(S.length)} staff`;
  q('#kpStaff').innerHTML = kpTblHtml(KP_SCOLS, R.slice(0, kp.shown), kp.ss, 's'); const mb = q('#kpMore'); mb.style.display = R.length > kp.shown ? '' : 'none'; mb.textContent = `Show more (${R.length - kp.shown} left)`;
  if (!kp.tried) { kp.tried = true; if (!a2E.rows.size || !mg.trg.length || !D.entN) kpLoad(true); }
}
async function kpLoad(silent) {
  if (kp.busy) return; kp.busy = true; const say = t => { const e = PLQ('#kpStatus'); if (e && !silent) e.insertAdjacentHTML('beforeend', ' · ' + plEsc(t)); };
  try {
    try { if (a2.cfg.emp.list && !a2E.rows.size) await a2ELoad(() => {}); } catch (e) { say('Employees: ' + e.message); }
    try { mgInit(); } catch (e) {}
    if (mg.cfg.list.daily && mgMapOk('daily') && (!a2Entered().length || !mg.trg.length)) { try { await mgLoad(true); } catch (e) { say('Volumes: ' + e.message); } }
    else if (mg.cfg.list.trgt && mgMapOk('trgt') && !mg.trg.length) {
      try { const g = k => { const c = mg.cfg.map.trgt[k]; return c && c !== SKIP_VALUE ? c : null; }, items = await mgReadList('trgt', () => {}); mg.trg = []; items.forEach(it => { const f = it.fields || {}, o = { area: mgS(f[g('area')]), region: mgS(f[g('region')]), code: mgS(f[g('code')]), prod: g('prod') ? mgNull(f[g('prod')]) : null, tot: g('tot') ? mgNull(f[g('tot')]) : null }; if (o.prod != null || o.tot != null) mg.trg.push(o); }); } catch (e) { say('Targets: ' + e.message); }
    }
  } finally { kp.busy = false; try { if (document.querySelector('#view-att.active') && at.tab === 'kpi') kpRender(); } catch (e) {} }
}
document.addEventListener('click', e => {
  const t = e.target; if (!t.closest) return;
  const b = t.closest('#view-att [data-kp]'); if (b) { const k = b.dataset.kp; if (k === 'load') { kp.tried = true; kpLoad(false).then(() => sectionToast('Staff, targets and volumes refreshed.')); return; } const [w, a] = k.split(':'), fn = w === 'w' ? kpWData : kpSData, d = fn(); if (a === 'xl') a2Export(d); else if (a === 'pr') a2Print(d); else if (a === 'ex') a2Expand(d); else a2Mail(fn); return; }
  const h = t.closest('#view-att [data-kps]'); if (h) { const [w, i] = h.dataset.kps.split(':'), s = w === 'w' ? kp.sw : kp.ss; if (s.i === +i) s.d = -s.d; else { s.i = +i; s.d = 1; } kpRender(); return; }
  if (t.id === 'kpMore') { kp.shown += 200; kpRender(); }
});
document.addEventListener('change', e => { const t = e.target; if (t.id === 'kpIncl') { kp.incl = t.checked; kpRender(); } else if (t.id === 'kpSt') { kp.st = t.value; kp.shown = 200; kpRender(); } });
document.addEventListener('input', e => { if (e.target.id === 'kpQ') { kp.q = e.target.value; kp.shown = 200; clearTimeout(kp._t); kp._t = setTimeout(kpRender, 250); } });

/* ============ 9 · DRILL-DOWN: warehouse row → staff list → Edit card of the Employees list ============ */
const a2swm = { k: null, daily: false };
function a2SwModalData() {
  const d = a2SwBuild(), W = d.warehouses.find(o => o.k === a2swm.k) || null, S = d.staff.filter(s => a2nk(s.wh) === a2swm.k);
  const cols = A2_SW_SCOLS.filter((c, i) => i !== 2); const note = cols.pop(); if (a2swm.daily) d.dates.forEach(dt => cols.push(a2nc(atDateLabel(dt), o => o.dh[dt] || 0))); cols.push(note);
  const r = a2Data('Staff of ' + (W ? W.wh : ''), 'Staff', d.dates.length ? `${d.dates[0]} → ${d.dates[d.dates.length - 1]}` : '', cols, S); r.totals = a2SwTot(S, cols); return { d, W, S, cols, data: r };
}
function a2SwModalRender() {
  const m = document.querySelector('#swModal'); if (!m) return; const { d, W, S, cols, data } = a2SwModalData(), f = (v, n) => plF(v, n == null ? 1 : n);
  m.querySelector('.swm-ttl').textContent = '🏭 ' + (W ? W.wh : '') + ' — staff and hours';
  m.querySelector('.swm-sum').innerHTML = W ? `<span class="swm-k"><b>${f(W.emp, 0)}</b> employees</span><span class="swm-k"><b>${f(W.att, 0)}</b> with attendance</span><span class="swm-k"><b>${f(W.pd, 0)}</b> person-days worked</span><span class="swm-k"><b>${f(W.h)}</b> attendance work hrs</span><span class="swm-k"><b>${f(W.eHrs)}</b> entered working hrs</span><span class="swm-k" style="color:${Math.abs(W.d) > 0.05 ? '#b42318' : '#0b7a0b'}"><b>${W.d > 0 ? '+' : ''}${f(W.d)}</b> Δ hrs${W.dp == null ? '' : ' (' + f(W.dp) + '%)'}</span>` : '';
  m.querySelector('.swm-per').textContent = d.dates.length ? `Period: ${atDateLabel(d.dates[0])} → ${atDateLabel(d.dates[d.dates.length - 1])} (${d.dates.length} day${d.dates.length > 1 ? 's' : ''})` : '';
  const nameI = cols.findIndex(c => c[0] === 'Name'), cell = (o, c, i) => { const v = data.rows[S.indexOf(o)][i]; if (i === nameI) return `<td><a href="#" data-emp="${plEsc(o.key)}" title="Double-click to open the Edit card of this employee">${plEsc(v || '(no name)')}</a></td>`; return `<td class="${typeof v === 'number' ? 'n' : ''}">${plEsc(typeof v === 'number' ? plF(v, v % 1 ? 1 : 0) : v)}</td>`; };
  m.querySelector('.swm-tbl').innerHTML = `<thead><tr><th>#</th>${cols.map(c => `<th class="${c.length > 2 ? 'n' : ''}">${plEsc(c[0])}</th>`).join('')}</tr></thead><tbody>${S.map((o, n) => `<tr><td>${n + 1}</td>${cols.map((c, i) => cell(o, c, i)).join('')}</tr>`).join('')}<tr class="t"><td></td>${data.totals.map(v => `<td class="${typeof v === 'number' ? 'n' : ''}"><b>${plEsc(typeof v === 'number' ? plF(v, v % 1 ? 1 : 0) : v)}</b></td>`).join('')}</tr></tbody>`;
  m.querySelector('[data-swm="daily"]').checked = a2swm.daily;
}
function a2SwModalOpen(k) {
  let m = document.querySelector('#swModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'swModal';
    m.style.cssText = 'position:fixed;inset:4vh 4vw;z-index:9000;background:var(--card,#fff);border-radius:14px;border:3px solid var(--primary,#2563eb);box-shadow:0 0 0 100vmax rgba(15,23,42,.5),0 24px 70px rgba(0,0,0,.4);display:none;flex-direction:column;overflow:hidden';
    m.innerHTML = '<style>#swModal .swm-k{display:inline-block;margin:2px 14px 2px 0;font-size:13px}#swModal .swm-k b{font-size:15px}#swModal a[data-emp]{font-weight:600;color:var(--acc-2,#1d4ed8);text-decoration:underline;cursor:pointer}#swModal tr.t td{background:var(--gray-100,#f1f5f9)}</style>'
      + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px;background:var(--acc-grad,linear-gradient(90deg,#1e40af,#2563eb));color:#fff"><div class="swm-ttl" style="font-size:17px;font-weight:700;flex:1;min-width:200px"></div><label style="font-size:12.5px;display:inline-flex;gap:6px;align-items:center;color:#fff"><input type="checkbox" data-swm="daily" style="width:auto"> daily hours</label><button class="ghost small tm-menu" data-acm="1" type="button" title="All actions of this screen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-3px"><path d="M4 6h16M4 12h16M4 18h16"/></svg> Actions</button><span class="tm-hid" style="display:none"><button class="ghost small" type="button" data-swm="mail">📧 Email</button><button class="ghost small" type="button" data-swm="xl">⬇ Excel</button><button class="ghost small" type="button" data-swm="pr">🖨 Print</button></span><button class="ghost small" type="button" data-swm="ex">⤢ Expand</button><button class="ghost small" type="button" data-swm="x" title="Close (Esc)">✕</button></div>'
      + '<div style="padding:10px 18px 0"><div class="swm-sum"></div><div class="text-sm swm-per" style="color:var(--gray-600);margin:4px 0"></div><div class="text-sm" style="color:var(--gray-500)">Click a staff name to open his Edit card from the Employees list.</div></div>'
      + '<div class="table-wrap" style="flex:1;min-height:0;overflow:auto;margin:8px 18px 14px"><table class="fd-tbl swm-tbl"></table></div>';
    document.body.appendChild(m);
  }
  a2swm.k = k; m.style.display = 'flex'; a2SwModalRender();
}
const a2SwModalClose = () => { const m = document.querySelector('#swModal'); if (m) m.style.display = 'none'; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') a2SwModalClose(); });
document.addEventListener('click', e => {
  const t = e.target; if (!t.closest) return;
  const b = t.closest('#swModal [data-swm]'); if (b) { const k = b.dataset.swm; if (k === 'x') a2SwModalClose(); else if (k === 'daily') { a2swm.daily = b.checked; a2SwModalRender(); } else { const fn = () => a2SwModalData().data, d = fn(); if (k === 'xl') a2Export(d); else if (k === 'pr') a2Print(d); else if (k === 'ex') a2Expand(d); else a2Mail(fn); } return; }
  if (t.closest('a[data-emp]')) e.preventDefault();
});
/* double-click any table row: employee row -> Edit card of that employee; warehouse row -> staff of that warehouse */
document.addEventListener('dblclick', e => {
  const t = e.target; if (!t.closest || t.closest('input,select,textarea,button,#view-editor')) return;
  const tr = t.closest('tbody tr'); if (!tr || !tr.closest('table')) return;
  try {
    let key = tr.dataset.emp || (tr.querySelector('a[data-emp]') || {}).dataset?.emp, wk = tr.dataset.wk;
    const cells = [...tr.children].map(c => (c.textContent || '').trim()).filter(Boolean);
    if (!key && !wk && a2E && a2E.rows && a2E.rows.size) { for (const c of cells) { if (!/\d{3,}/.test(c)) continue; const k = atKey(c); if (a2E.rows.has(k)) { key = k; break; } } }
    if (!key && !wk && cells.length && typeof a2Entered === 'function' && (a2Entered().length || (at.rows || []).length)) { const d = a2SwBuild(), W = d.warehouses.find(w => cells.some(c => c === w.wh || c === w.k)); if (W) wk = W.k; }
    if (key) { window.getSelection && getSelection().removeAllRanges(); a2OpenEmp(key); }
    else if (wk) { window.getSelection && getSelection().removeAllRanges(); a2SwModalOpen(wk); }
  } catch (err) {}
});
document.addEventListener('mousedown', e => { if (e.detail > 1 && e.target.closest && e.target.closest('tbody tr') && !e.target.closest('input,textarea,#view-editor')) e.preventDefault(); });

/* open the Edit card of one employee in the Data Editor (list = the Employees list) */
async function a2OpenEmp(key) {
  const list = a2.cfg.emp.list, M = a2.cfg.emp.map, idCol = M.id && M.id !== SKIP_VALUE ? M.id : 'File_Nr', sl = ms => new Promise(r => setTimeout(r, ms));
  if (!list) { sectionToast('Pick the Employees list in the Link map first.', 'warn'); return; }
  const nav = document.querySelector('.nav-item[data-view="editor"]'); if (!nav) { sectionToast('You do not have access to the Data Editor.', 'warn'); return; }
  if (!a2E.rows.has(key)) { sectionToast('This person is not in the Employees list — add him there first.', 'warn'); return; }
  a2SwModalClose(); sectionToast('Opening the Edit card…', 'info'); nav.click(); await sl(200);
  try {
    if (editorState.listName !== list || !editorState.columns.length) {
      if (!editorPicker) throw new Error('The Data Editor is not ready.'); editorPicker.setValue(list); const btn = document.getElementById('editorLoadBtn'); btn.click(); await sl(300);
      for (let i = 0; i < 240 && (btn.disabled || editorState.listName !== list); i++) await sl(250);
      if (editorState.listName !== list) throw new Error('Could not connect to "' + list + '".');
    }
    const find = () => editorState.items.find(it => atKey(mgS((it.fields || {})[idCol])) === key);
    let it = find();
    if (!it) { const token = getGlobalAccessToken(), items = await fetchAllItems(editorState.siteId, editorState.listId, token, () => {}); const have = new Set(editorState.items.map(x => String(x.id))); items.forEach(x => { if (!have.has(String(x.id))) editorState.items.push(x); }); ed_refreshAfterLoad(); it = find(); }
    if (!it) throw new Error('File Nr ' + key + ' was not found in "' + list + '".');
    ed_switchTab('edit'); const sb = document.getElementById('editorSearch'); if (sb) sb.value = mgS(it.fields[idCol]); ed_selectRecord(it);
    await sl(100); const pb = document.querySelector('#editorTab-edit .ed-pbar button[data-m="pop"]'); if (pb && !document.querySelector('#editorTab-edit.ed-pop')) pb.click();
  } catch (err) { sectionToast('✘ ' + err.message, 'error'); }
}

/* ---------- Back button: returns to the previous page / tab (top bar, every pop-up header, browser Back, Alt+←) ---------- */
(function () {
  const btn = document.querySelector('#backBtn'); if (!btn) return;
  const nav = { stack: [], cur: '', going: false };
  const curView = () => { const v = document.querySelector('.view.active'); if (!v) return ''; const id = v.id.replace(/^view-/, ''); if (id === 'editor') { const t = document.querySelector('.editor-tab.active'); return id + (t ? '#' + t.dataset.tab : ''); } return id; };
  const label = k => { const n = document.querySelector('.nav-item[data-view="' + k.split('#')[0] + '"]'); return (n ? n.textContent.trim().replace(/\s+/g, ' ') : k) + (k.includes('#') ? ' › ' + k.split('#')[1] : ''); };
  const upd = () => { const p = nav.stack[nav.stack.length - 1]; document.querySelectorAll('#backBtn,[data-back]').forEach(b => { b.disabled = !p; b.title = p ? 'Back to ' + label(p) + ' (Alt+←)' : 'No previous page'; }); };
  const seen = () => {
    const v = curView(); if (!v || v === nav.cur) return;
    if (nav.cur) { nav.stack.push(nav.cur); if (nav.stack.length > 60) nav.stack.shift(); try { history.pushState({ nfpcBack: 1 }, ''); } catch (e) {} }
    nav.cur = v; upd();
  };
  const overlay = () => {
    const m = document.querySelector('#swModal'); if (m && m.style.display !== 'none' && m.style.display !== '') { m.style.display = 'none'; return true; }
    const p = document.querySelector('.editor-tab-panel.ed-pop,.editor-tab-panel.ed-full');
    if (p) { const b = p.querySelector(p.classList.contains('ed-full') ? '[data-m="full"]' : '[data-m="pop"]'); if (b) { b.click(); return true; } }
    return false;
  };
  const back = () => {
    if (overlay()) return true;
    const p = nav.stack.pop(); if (!p) { upd(); return false; }
    const [view, tab] = p.split('#'), item = document.querySelector('.nav-item[data-view="' + view + '"]'); nav.cur = p;
    if (item) item.click(); else document.querySelectorAll('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + view));
    if (tab && typeof ed_switchTab === 'function') { try { ed_switchTab(tab); } catch (e) {} }
    upd(); return true;
  };
  const mo = new MutationObserver(seen); document.querySelectorAll('.view').forEach(v => mo.observe(v, { attributes: true, attributeFilter: ['class'] }));
  const mt = new MutationObserver(seen); document.querySelectorAll('.editor-tab').forEach(t => mt.observe(t, { attributes: true, attributeFilter: ['class'] }));
  document.querySelectorAll('.editor-tab-panel>.ed-pbar').forEach(bar => { if (bar.querySelector('[data-back]')) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost small'; b.dataset.back = '1'; b.textContent = '← Back'; b.addEventListener('click', back); bar.insertBefore(b, bar.querySelector('[data-m]')); });
  ['add', 'edit', 'bulk'].forEach(t => { const bar = document.querySelector('#editorTab-' + t + '>.ed-pbar'); if (!bar || bar.querySelector('[data-ddopen]')) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost small'; b.dataset.ddopen = '1'; b.textContent = '⚙ Dropdown sources'; b.title = 'Choose the dropdown source of every field'; bar.insertBefore(b, bar.querySelector('[data-back]') || bar.querySelector('[data-m]')); });
  nav.cur = curView(); upd();
  btn.addEventListener('click', back);
  window.addEventListener('popstate', () => { back(); });
  document.addEventListener('keydown', e => { if (e.altKey && e.key === 'ArrowLeft' && !(e.target.closest && e.target.closest('input,textarea,select'))) { e.preventDefault(); back(); } });
  nav.back = back; window.nfpcNav = nav;
})();


/* ---------- UoM conversion list: admin defines the SharePoint list + maps its fields (shared with the Warehouse page) ---------- */
function uomRefreshTrips() {
  const f = document.querySelector('#fdTripModal'); if (f && f.style.display !== 'none' && typeof fd !== 'undefined' && fd.open) fdModalRefresh(fd.open);
  const r = document.querySelector('#mdpRtModal'); if (r && r.style.display !== 'none' && typeof mdp !== 'undefined' && mdp._rt) mdpRtRender();
}
function uomCfgOpen() {
  let m = document.querySelector('#uomCfgModal'); if (m) m.remove();
  const adm = isAdmin(), E = escapeHtml;
  m = document.createElement('div'); m.id = 'uomCfgModal'; m.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:18px';
  m.innerHTML = '<div style="background:var(--card,#fff);color:var(--gray-800,#1e293b);border-radius:14px;max-width:760px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4)">'
    + '<div style="padding:14px 18px;border-bottom:1px solid var(--gray-200,#e2e8f0);display:flex;align-items:center;gap:10px"><b style="font-size:16px;flex:1">⚖ UoM conversion list</b><button type="button" class="ghost small" data-uc="x">✕</button></div>'
    + '<div style="overflow:auto;padding:14px 18px;flex:1">'
    + '<div class="text-sm" style="margin-bottom:10px">Choose the SharePoint list that holds the conversion values (how many pieces are in a Carton / Outer / Pallet for each item) and tell the system which of its columns is which. The <b>Qty in UoM</b> column of the trip screens (and the Warehouse page) use it. ' + (adm ? '' : '<b style="color:#b45309">Only an administrator can change this.</b>') + '</div>'
    + '<div class="form-group"><label>UoM list <span class="hint">— SharePoint list with the conversion values</span></label><div class="list-picker" id="uomCfgPick"></div></div>'
    + '<div class="btn-row" style="margin:8px 0"><button type="button" class="secondary small" data-uc="load">🔄 Load / Reload from SharePoint</button><span class="text-sm" id="uomCfgInfo"></span></div>'
    + '<div class="mapping-wrapper" style="max-height:none"><table class="map-table"><thead><tr><th style="width:42%">Setting</th><th>List column / option</th></tr></thead><tbody id="uomCfgMap"><tr><td colspan="2" class="text-sm">Pick and load the list to map its columns.</td></tr></tbody></table></div>'
    + '<div id="uomAreaBox2"></div>'
    + '<div style="margin-top:12px"><b class="text-sm">Test</b> <input type="text" id="uomCfgT" placeholder="Item code" style="width:160px;margin:0 6px"> <span class="text-sm" id="uomCfgTR"></span></div>'
    + '</div><div style="padding:12px 18px;border-top:1px solid var(--gray-200,#e2e8f0);display:flex;gap:8px;align-items:center"><span class="text-sm" style="flex:1" id="uomCfgMsg"></span><button type="button" class="ghost small" data-uc="copy" title="Copy a line to paste into the HTML file so every user gets this list and mapping">📋 Copy shared setting</button><button type="button" class="success small" data-uc="x">Done</button></div></div>';
  document.body.appendChild(m); uomAreaRender(m.querySelector('#uomAreaBox2'));
  const host = m.querySelector('#uomCfgPick');
  const pk = createListPicker(host, { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), initialValue: wUomState.listName || '', onChange: v => { if (adm) wUom_onList(v); } });
  try { pk.setValue(wUomState.listName || ''); } catch (e) {}
  if (!adm) { host.style.pointerEvents = 'none'; host.style.opacity = '.6'; }
  const info = () => { const a = document.querySelector('#wUomListInfo'), s = document.querySelector('#wUomStatus'); const el = m.querySelector('#uomCfgInfo'); if (el) el.textContent = [a && a.textContent, s && s.textContent].filter(Boolean).join(' · '); };
  const test = () => { const c = m.querySelector('#uomCfgT').value.trim(), r = m.querySelector('#uomCfgTR'); if (!c) { r.textContent = ''; return; } const e = wUomState.table.get(wUomNorm(c)); r.textContent = e ? [...e.factors.entries()].map(([k, v]) => '1 ' + k.toUpperCase() + ' = ' + v + ' pcs').join(' · ') || 'item found, no factors' : 'item not in the UoM list'; };
  m.querySelector('#uomCfgT').addEventListener('input', test);
  if (wUomState.headers.length) wUom_renderMap();
  info(); const iv = setInterval(() => { if (!m.isConnected) { clearInterval(iv); return; } info(); test(); if (!m.querySelector('#uomCfgMap select') && wUomState.headers.length) wUom_renderMap(); if (!adm) m.querySelectorAll('#uomCfgMap select').forEach(s => s.disabled = true); }, 600);
  m.addEventListener('click', async e => {
    const b = e.target.closest('[data-uc]'); if (!b) { if (e.target === m) m.remove(); return; }
    const k = b.dataset.uc;
    if (k === 'x') m.remove();
    else if (k === 'load') { if (!wUomState.listName) { m.querySelector('#uomCfgMsg').textContent = 'Pick the list first.'; return; } await wUom_loadFromList(); wUom_renderMap(); info(); }
    else if (k === 'copy') { const o = { list: wUomState.listName || '', layout: wUomState.layout, palletMode: wUomState.palletMode, map: wUomState.map }, t = 'const UOM_CONV_DEFAULT = ' + JSON.stringify(o) + ';'; try { await navigator.clipboard.writeText(t); m.querySelector('#uomCfgMsg').textContent = '✓ Copied — replace the line "const UOM_CONV_DEFAULT = …" in the HTML file with it to share this with every user.'; } catch (er) { prompt('Copy this line:', t); } }
  });
}
try { uomAreaRender(document.getElementById('uomAreaBox')); } catch (e) {}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-uomcfg]')) { e.preventDefault(); uomCfgOpen(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = document.querySelector('#uomCfgModal'); if (m) m.remove(); } });


/* ---------- Actions menu (Option E): the header buttons of the pop-up screens are grouped in one ☰ menu; pointing at an action explains what it does ---------- */
(function () {
  const sh = b => (b.textContent || '').replace(/[🖨⚖☁📝📊✉⤡⤢⚙📧⬇]/gu, '').replace(/\s+/g, ' ').trim();
  const D = (b, N) => { const d = b.dataset || {}, x = d.x, n = N + ' line(s)';
    if (d.rp) { const M = { print: { g: 0, o: 0, l: 'Print', t: 'Prints the issue / pick list after FEFO allocation, or the table of the tab you are on (alerts, stock, ledger).', st: ['The rows are listed with totals.', 'The print window opens.'], inc: 'current view · totals', chg: 0 },
      excel: { g: 1, o: 0, l: 'Export to Excel', t: 'Downloads one workbook with the stock by lot, item master, ledger, counts and alerts.', st: ['All sheets are built from the loaded data.', 'The file is downloaded.'], inc: 'stock · items · ledger · counts · alerts', chg: 0 },
      mail: { g: 1, o: 1, l: 'Email', t: 'Sends the current table to the people you choose.', st: ['You pick recipients and format.', 'It is sent from your account and logged.'], inc: 'current view', chg: 0 },
      reload: { g: 2, o: 0, l: 'Reload data', t: 'Re-reads the item master, movements and counts from SharePoint and recalculates the stock.', st: ['The three lists are read again.', 'Balances, QC status and alerts are refreshed.'], inc: '3 lists', chg: 0 },
      dest: { g: 2, o: 1, l: 'Lists & mapping', t: 'Choose the SharePoint lists and map their columns.', st: ['Upload Destinations & Sources opens.'], inc: 'lists · columns', chg: 0 },
      guide: { g: 2, o: 2, l: 'List setup guide', t: 'Shows the columns to create in the three RMPM lists.', st: ['A window lists every list and its columns.'], inc: 'column names & types', chg: 0 } }; return M[d.rp]; }
    if (d.wm) { const M = { print: { g: 0, o: 0, l: 'Print', t: 'Prints the pick list (after FEFO allocation), the inbound lines, or the stock table, depending on the tab.', st: ['The current rows are listed with totals.', 'The print window opens.'], inc: 'current view · totals', chg: 0 },
      excel: { g: 1, o: 0, l: 'Export to Excel', t: 'Downloads the same table as an .xlsx file.', st: ['The table is converted to a worksheet.', 'The file is downloaded.'], inc: 'current view', chg: 0 },
      mail: { g: 1, o: 1, l: 'Email', t: 'Sends the current table to the people you choose.', st: ['You pick recipients and format.', 'It is sent from your account and logged.'], inc: 'current view', chg: 0 },
      reload: { g: 2, o: 0, l: 'Reload balances', t: 'Re-reads all movements and recomputes the stock per SKU and batch.', st: ['The movements list is read again.', 'Balances and FEFO order are refreshed.'], inc: 'movements · balances', chg: 0 },
      dest: { g: 2, o: 1, l: 'List & mapping', t: 'Choose the SharePoint list and map its columns for this page.', st: ['Upload Destinations & Sources opens.'], inc: 'list · columns', chg: 0 } }; return M[d.wm]; }
    if (d.fl) { const M = { print: { g: 0, o: 0, l: 'Print current tab', t: 'Prints the table you are looking at (with the vehicle filter applied) with totals.', st: ['The rows are listed with totals.', 'The print window opens.'], inc: 'current tab · totals', chg: 0 },
      excel: { g: 1, o: 0, l: 'Export to Excel', t: 'Downloads one workbook with a sheet for every fleet list.', st: ['Vehicles, drivers, maintenance, fuel, documents, incidents, tyres and parts are written to sheets.', 'The file is downloaded.'], inc: 'all fleet sheets', chg: 0 },
      mail: { g: 1, o: 1, l: 'Email', t: 'Sends the current tab to the people you choose.', st: ['You pick recipients and format.', 'It is sent from your account and logged.'], inc: 'current tab', chg: 0 },
      reload: { g: 2, o: 0, l: 'Reload data', t: 'Re-reads all fleet lists from SharePoint.', st: ['Every list is read again.'], inc: '8 lists', chg: 0 },
      dest: { g: 2, o: 1, l: 'Lists & mapping', t: 'Choose the SharePoint lists and map their columns.', st: ['Upload Destinations & Sources opens.', 'Pick each list and check the column mapping.'], inc: 'lists · columns', chg: 0 },
      guide: { g: 2, o: 2, l: 'List setup guide', t: 'Shows the columns to create in the fleet SharePoint lists.', st: ['A window lists every list and its columns.'], inc: 'column names & types', chg: 0 } }; return M[d.fl]; }
    if (d.pj) { const M = { print: { g: 0, o: 0, l: 'Print project summary', t: 'Prints the phase table of the chosen project with progress, costs, manpower and totals.', st: ['The phases are listed with progress and cost.', 'Totals are added.', 'The print window opens.'], inc: 'phases · progress · costs · man-hours', chg: 0 },
      excel: { g: 1, o: 0, l: 'Export to Excel', t: 'Downloads a workbook with the summary, updates, costs and manpower sheets.', st: ['Four worksheets are built.', 'The file is downloaded.'], inc: 'summary · updates · costs · manpower', chg: 0 },
      mail: { g: 1, o: 1, l: 'Email', t: 'Sends the project summary to the people you choose.', st: ['You pick recipients and format.', 'It is sent from your account and logged.'], inc: 'phase summary · totals', chg: 0 },
      reload: { g: 2, o: 0, l: 'Reload data', t: 'Re-reads the five project lists from SharePoint.', st: ['Projects, phases, updates, costs and manpower are read again.'], inc: '5 lists', chg: 0 },
      dest: { g: 2, o: 1, l: 'Lists & mapping', t: 'Choose the SharePoint lists and map their columns.', st: ['Upload Destinations & Sources opens.', 'Pick each list and check the column mapping.'], inc: 'lists · columns', chg: 0 },
      guide: { g: 2, o: 2, l: 'List setup guide', t: 'Shows the columns to create in the five SharePoint lists.', st: ['A window lists every list and its columns.'], inc: 'column names & types', chg: 0 } }; return M[d.pj]; }
    if (d.sm) { const M = { print: { g: 0, o: 0, l: 'Print entry sheet', t: 'Prints the document header and every line with quantities, batch and dates, with totals and signature boxes.', st: ['The header (type, date, reference, trailer) is added.', 'All lines are listed with totals.', 'The print window opens.'], inc: n + ' · totals · signatures', chg: 0 },
      excel: { g: 1, o: 0, l: 'Export to Excel', t: 'Downloads the lines as an .xlsx file.', st: ['The lines are converted to a worksheet.', 'The file is downloaded to this computer.'], inc: n + ' · quantities · dates', chg: 0 },
      mail: { g: 1, o: 1, l: 'Email', t: 'Sends the entry sheet to the people you choose.', st: ['You pick the recipients and the format.', 'The sheet is created with the current lines.', 'It is sent from your account and logged.'], inc: n + ' · totals', chg: 0 },
      expand: { g: 2, o: 0, l: 'Expand', t: 'Opens the lines in the expanded window (small, medium, large or full screen) with search and column choice.', st: ['The current lines are copied into the window.', 'Nothing is changed in the form.'], inc: n, chg: 0 },
      reload: { g: 2, o: 1, l: 'Reload suggestions', t: 'Re-reads the SKUs, batches and balances from the SharePoint list.', st: ['The latest movements are read.', 'SKU, batch and balance suggestions are refreshed.'], inc: 'SKU master · batches · balances', chg: 0 },
      dest: { g: 2, o: 2, l: 'List & mapping', t: 'Choose the SharePoint list and map its columns for this form.', st: ['Upload Destinations & Sources opens.', 'Pick the list and check the column mapping.'], inc: 'list · column mapping', chg: 0 } }; return M[d.sm]; }
    if (d.pk !== undefined || d.rtp !== undefined) return { g: 0, o: 0, l: 'Picking list', t: 'Prints the warehouse picking list of this trip, grouped by item with batch numbers and expiry dates.', st: ['The list is built from the current actual quantities.', 'Lines are grouped by item with batch no. and expiry.', 'The print window opens.'], inc: n + ' · batches · balance', chg: 0 };
    if (d.dn !== undefined) return { g: 0, o: 1, l: 'Delivery note', t: 'Prints the delivery note for the driver: items, actual quantities, batches and trip details.', st: ['The note is built from the actual quantities.', 'Trip details, plate and remarks are added.', 'The print window opens.'], inc: n + ' · trip details', chg: 0 };
    if (d.swm === 'pr' || x === 'prt' || d.rtl !== undefined) return { g: 0, o: 2, l: 'Print list', t: 'Prints every line with demand, actual and balance quantities.', st: ['All lines are listed with their quantities.', 'Totals are added at the end.', 'The print window opens.'], inc: n + ' · totals', chg: 0 };
    if (d.swm === 'xl' || x === 'xl' || d.rtxl !== undefined) return { g: 1, o: 0, l: 'Export to Excel', t: 'Downloads the lines, quantities and batches as an .xlsx file.', st: ['The table is converted to a worksheet.', 'The file is downloaded to this computer.'], inc: n + ' · quantities · batches', chg: 0 };
    if (d.swm === 'mail' || x === 'mail' || d.rtm !== undefined) return { g: 1, o: 1, l: 'Email', t: 'Sends the list to the people you choose as an attachment.', st: ['You pick the recipients and the format.', 'The list is created with the current quantities.', 'It is sent from your account and logged in Activity.'], inc: n + ' · attachment', chg: 0 };
    if (x === 'spsave') return { g: 1, o: 2, l: 'Save to SharePoint', t: 'Writes the actual picking list of this trip to the SharePoint list.', st: ['You are asked to confirm.', 'One row per item is written to the list set by the administrator.', 'The result is shown here.'], inc: n + ' · actual quantities', chg: 1 };
    if (d.uomcfg !== undefined) return { g: 2, o: 0, l: 'UoM list', t: 'Choose the SharePoint list with the conversion values and map its fields.', st: ['Pick the list and load its columns.', 'Map item code, UoM and pieces per UoM.', 'The “Qty in UoM” column uses it at once.'], inc: 'conversion list + mapping', chg: 0, tag: 'Admin' };
    if (x === 'chlog') return { g: 2, o: 1, l: 'Changes', t: 'Shows who changed which quantity or batch, and when.', st: ['The change log of this trip opens.', 'Nothing is changed.'], inc: 'change history', chg: 0 };
    return { g: 2, o: 9, l: sh(b) || 'Action', t: b.title || 'Runs this action.', st: [], inc: '', chg: 0 }; };
  const IC = { 0: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z', 1: 'M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h8', 2: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1' }, GN = ['PRINT', 'SHARE & EXPORT', 'SETTINGS & VIEW'];
  const close = () => { const m = document.querySelector('#tmActMenu'); if (m) m.remove(); document.removeEventListener('mousedown', out, true); };
  const out = e => { const m = document.querySelector('#tmActMenu'); if (m && !m.contains(e.target) && !e.target.closest('[data-acm]')) close(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('click', e => {
    const bt = e.target.closest && e.target.closest('[data-acm]'); if (!bt) return; e.preventDefault(); e.stopPropagation();
    if (document.querySelector('#tmActMenu')) { close(); return; }
    const hid = bt.parentNode.querySelector('.tm-hid'); if (!hid) return; const E = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), root = bt.closest('#fdTripModal,#mdpRtModal,#swModal') || document, N = Math.max(0, root.querySelectorAll('tbody tr').length - (root.id === 'swModal' ? 1 : 0));
    const items = [...hid.querySelectorAll('button')].map(b => { if (b.dataset.ps && b._pb) { const p = D(b._pb, N); return { b, g: p.g, o: p.o + .5, l: 'Print setup — ' + p.l, t: 'Paper size, orientation, the fields to print and the heading of each column for the ' + p.l.toLowerCase() + '.', st: ['The setup window opens for this document.', 'Your choice is saved for next time.'], inc: 'layout only', chg: 0 }; } return Object.assign({ b }, D(b, N)); });
    let left = ''; [0, 1, 2].forEach(g => { const L = items.filter(x => x.g === g).sort((a, c) => a.o - c.o); if (!L.length) return; left += '<div style="padding:' + (g ? '10px' : '6px') + ' 10px 4px;font-size:11px;font-weight:600;letter-spacing:.08em;color:#64748b">' + GN[g] + '</div>' + L.map(x => '<div class="tm-ai" data-i="' + items.indexOf(x) + '" role="button" tabindex="0" style="display:flex;gap:10px;align-items:center;padding:9px 12px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="' + IC[g] + '"/></svg><span style="flex:1">' + E(x.l) + '</span>' + (x.tag ? '<span style="font-size:10px;background:#e0e7ff;color:#3730a3;border-radius:999px;padding:2px 8px">' + x.tag + '</span>' : '') + '</div>').join(''); });
    const m = document.createElement('div'); m.id = 'tmActMenu'; const r = bt.getBoundingClientRect(), W = Math.min(760, innerWidth - 16);
    m.style.cssText = 'position:fixed;z-index:2147483200;top:' + Math.min(r.bottom + 6, innerHeight - 200) + 'px;left:' + Math.max(8, Math.min(r.right - W, innerWidth - W - 8)) + 'px;width:' + W + 'px;max-height:calc(100vh - ' + (r.bottom + 20) + 'px);background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:14px;box-shadow:0 18px 40px rgba(15,23,42,.28);display:flex;overflow:hidden;font-family:inherit';
    m.innerHTML = '<div style="width:270px;flex:none;padding:8px;border-right:1px solid #e2e8f0;background:#f8fafc;overflow:auto">' + left + '</div><div class="tm-det" style="flex:1;padding:20px 24px;display:flex;flex-direction:column;gap:14px;overflow:auto;min-width:0"></div>';
    document.body.appendChild(m); let cur = -1;
    const show = i => { const it = items[i]; if (!it) return; cur = i; m.querySelectorAll('.tm-ai').forEach(el => { const on = +el.dataset.i === i; el.style.background = on ? '#dbeafe' : ''; el.style.color = on ? '#1e3a8a' : ''; el.style.fontWeight = on ? '600' : '500'; });
      m.querySelector('.tm-det').innerHTML = '<div><div style="font-size:18px;font-weight:700">' + E(it.l) + '</div><div style="font-size:13px;color:#475569;margin-top:4px">' + E(it.t) + '</div></div>' + (it.st.length ? '<div><div style="font-size:11px;font-weight:600;letter-spacing:.08em;color:#64748b;margin-bottom:6px">WHAT HAPPENS</div><div style="font-size:13px;line-height:1.6;color:#334155">' + it.st.map((s, k) => (k + 1) + '. ' + E(s)).join('<br>') + '</div></div>' : '') + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="background:#f1f5f9;border-radius:10px;padding:10px 12px"><div style="font-size:11px;color:#64748b">INCLUDES</div><div style="font-size:13px;margin-top:3px">' + E(it.inc || '—') + '</div></div><div style="background:#f1f5f9;border-radius:10px;padding:10px 12px"><div style="font-size:11px;color:#64748b">CHANGES DATA?</div><div style="font-size:13px;margin-top:3px;font-weight:600;color:' + (it.chg ? '#92400e' : '#166534') + '">' + (it.chg ? 'Yes — writes to SharePoint' : 'No — read only') + '</div></div></div><div style="margin-top:auto;display:flex;gap:10px;justify-content:flex-end"><button type="button" data-a="cancel" style="border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:8px;padding:9px 18px;font:600 14px inherit;cursor:pointer">Cancel</button><button type="button" data-a="run" style="background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:9px 18px;font:600 14px inherit;cursor:pointer">' + (it.chg ? 'Continue →' : 'Run →') + '</button></div>'; };
    const run = () => { const it = items[cur]; close(); if (it) setTimeout(() => it.b.click(), 0); };
    m.addEventListener('mouseover', ev => { const el = ev.target.closest('.tm-ai'); if (el && +el.dataset.i !== cur) show(+el.dataset.i); });
    m.addEventListener('focusin', ev => { const el = ev.target.closest('.tm-ai'); if (el && +el.dataset.i !== cur) show(+el.dataset.i); });
    m.addEventListener('click', ev => { const el = ev.target.closest('.tm-ai'); if (el) { show(+el.dataset.i); return; } const a = ev.target.closest('[data-a]'); if (!a) return; if (a.dataset.a === 'run') run(); else close(); });
    m.addEventListener('dblclick', ev => { if (ev.target.closest('.tm-ai')) run(); });
    m.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.closest('.tm-ai')) { show(+ev.target.closest('.tm-ai').dataset.i); run(); } });
    const first = m.querySelector('.tm-ai'); if (first) show(+first.dataset.i);
    document.addEventListener('mousedown', out, true);
  }, true);
})();


/* ---------- windows that already have the minimise / maximise / close controls do not also show an “Expand” button in their header ---------- */
(function () {
  const RX = /^[\s⤢⤡⛶↗↙]*(expand|shrink|maximi[sz]e|restore|full\s*screen)\s*$/i;
  function scan() {
    document.querySelectorAll('.mdl-ctl').forEach(c => {
      const box = c.closest('[data-mdl]') || c.parentElement && c.parentElement.parentElement; if (!box) return; const top = box.getBoundingClientRect().top;
      box.querySelectorAll('button,a,span[role=button]').forEach(b => {
        if (b.closest('.mdl-ctl') || b.dataset.mdlx) return; const t = (b.textContent || '').replace(/\s+/g, ' ').trim(); if (!RX.test(t)) return;
        const hd = b.closest('.tm-head,.card-header,.modal-header,[data-drag],.mdl-bar') || (box.firstElementChild && box.firstElementChild.contains(b) ? box.firstElementChild : null); if (!hd || !box.contains(hd)) return;     /* header bar only */
        b.dataset.mdlx = '1'; b.style.display = 'none'; });
    });
  }
  let t = 0; const kick = () => { if (t) return; t = setTimeout(() => { t = 0; try { scan(); } catch (e) {} }, 200); };
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: true }); kick();
})();


/* ---------- Esc closes the top-most open form / pop-up / window; with none open it goes back to the previous page ---------- */
(function () {
  const SEL = '#tmActMenu,#tabHidePop,#rmpSetup,#fltSetup,#pjSetup,#smvPaste,#smvCard.smv-full,#ddModal,#uomCfgModal,#swModal,#fdTripModal,#mdpRtModal,#plPfModal,#tblExpandOverlay,[data-mdl],.ed-pop,.ed-full,[role=dialog],.modal.open,.fd-modal';
  const REMOVE = new Set(['tmActMenu', 'tabHidePop', 'smvPaste', 'ddModal', 'uomCfgModal']), CLOSE = /^[\s✕×✖✗xX]*\s*(close|cancel|done|back)?\s*$/i;
  const vis = el => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 20 && r.height > 20; };
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (document.querySelector('.combo-list.open,.suggest-list.open,.mcombo-list.open')) return;           /* a dropdown is open: Esc closes just that */
    const all = [...document.querySelectorAll(SEL)].filter(el => vis(el) && !el.closest('#loginScreen'));
    const top = all.map((el, i) => ({ el, z: parseInt(getComputedStyle(el).zIndex, 10) || 0, i })).sort((a, b) => b.z - a.z || b.i - a.i)[0];
    if (top) {
      const el = top.el; e.preventDefault(); e.stopImmediatePropagation();
      if (REMOVE.has(el.id)) { el.remove(); return; }
      const x = el.querySelector('.mdl-ctl .mdl-x') || el.querySelector('[data-x="close"],[data-rtx],[data-swm="x"],[data-m="x"],[data-dd="x"],[data-uc="x"]') || [...el.querySelectorAll('button,a')].find(b => !b.closest('.mdl-ctl') && CLOSE.test((b.textContent || '').trim()) && (b.textContent || '').trim() && b.getBoundingClientRect().top - el.getBoundingClientRect().top < 120);
      if (x) { x.click(); return; }
      el.style.display = 'none'; return;
    }
    const t = e.target; if (t && t.closest && t.closest('input,select,textarea,[contenteditable="true"]')) return;
    if (window.nfpcNav && nfpcNav.stack && nfpcNav.stack.length) { e.preventDefault(); nfpcNav.back(); }
  }, true);
})();

