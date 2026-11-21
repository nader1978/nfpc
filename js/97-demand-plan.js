/* ============================================================
   DEMAND PLAN vs EXECUTION — a tab of the Logistics dashboard / Trip Planning ("📥 Demand plan")
   1. Upload the daily demand files (3 layouts are recognised automatically):
        · GSD / Milco daily demand  (SKU rows × location columns × 2 days, with the pallet blocks)
        · Water trailer plan        (one sheet per origin: SKU rows × trailer columns, pallets, destination + day headers)
        · UHT trailer plan          (SKU rows × one column per trailer, cases, destination row)
   2. The plan is normalised: date · destination · SKU · quantity · pallets · trailers.
   3. It is compared with what was executed:
        · TRIPS     → Trls_Daily_Activity_tbl (via TRX): trips and pallets that left for the destination that day
        · PICKING   → WH_Pick_Transit_tbl (via PTR): the SKU quantities the pickers confirmed
   Result: trip compliance %, pallet accuracy %, picking-line accuracy %, quantity fill %, over / short / not-picked / unplanned lines.
   The uploaded plans are kept in this browser (localStorage); the report can be exported to Excel / printed / e-mailed.
   window.demandPlan = { show, S }
   ============================================================ */
(function () {
  'use strict';
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
  const f0 = v => Math.round(v).toLocaleString(), f1 = v => (Math.round(v * 10) / 10).toLocaleString(), pc = v => v == null ? '—' : Math.round(v) + '%';
  const KEY = 'orbit_dpl_v1', CFG = 'orbit_dpl_cfg_v1';
  const S = { files: [], cap: 26, tol: 2, ignoreDate: false, alias: '', from: '', to: '', busy: false, msg: '', loaded: false, view: 'dest', q: '', st: '' };
  try { const j = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(j)) S.files = j; } catch (e) {}
  try { const c = JSON.parse(localStorage.getItem(CFG) || '{}'); ['cap', 'tol', 'ignoreDate', 'alias'].forEach(k => { if (c[k] != null) S[k] = c[k]; }); } catch (e) {}
  const saveF = () => { try { localStorage.setItem(KEY, JSON.stringify(S.files)); } catch (e) { S.msg = '⚠ The plan is too big to keep on this device — it works for now, but will be gone after a reload.'; } };
  const saveC = () => { try { localStorage.setItem(CFG, JSON.stringify({ cap: S.cap, tol: S.tol, ignoreDate: S.ignoreDate, alias: S.alias })); } catch (e) {} };

  /* ---------- destinations: one name for the same place in every file / list ---------- */
  const DEF = [[/\b(AL ?AIN|ALN|ALAIN)\b/, 'AL AIN'], [/\b(AUH|ABU ?DHABI|MILCO AUH)\b/, 'ABU DHABI'], [/\b(DXB|DUBAI)\b/, 'DUBAI'], [/\b(SHJ|SHARJAH)\b/, 'SHARJAH'], [/\b(RAK|RAS AL ?KHAIMAH)\b/, 'RAK'], [/\b(FUJ|FUJAIRAH)\b/, 'FUJAIRAH']];
  function nDest(s) { const t = String(s || '').toUpperCase().replace(/[()_,]/g, ' ').replace(/\s+/g, ' ').trim(); if (!t) return '';
    for (const ln of String(S.alias || '').split('\n')) { const p = ln.split('='); if (p.length === 2 && p[0].trim() && t.includes(p[0].trim().toUpperCase())) return p[1].trim().toUpperCase(); }
    for (const [re, n] of DEF) if (re.test(t)) return n; return t; }
  const sku = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  /* ---------- dates: weekday labels → dates ---------- */
  const WD = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  function addD(s, n) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  function dayFor(base, lab) { if (!lab) return base; if (/^\d{4}-\d\d-\d\d$/.test(lab)) return lab; const w = WD[String(lab).slice(0, 3).toUpperCase()]; if (w == null) return base; const b = new Date(base + 'T12:00:00'); return addD(base, (w - b.getDay() + 7) % 7); }
  const dOf = (f, lab) => (f.map && f.map[lab]) || dayFor(f.base, lab);
  const shiftOf = lab => /NYT|NIGHT/i.test(lab || '') ? 'Night' : 'Day';
  function baseFrom(name) { let m = String(name).match(/(\d{1,2})[._-](\d{1,2})[._-](\d{4}|\d{2})/); if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return y + '-' + pad(+m[2]) + '-' + pad(+m[1]); } return ymd(new Date()); }
  const iso = v => { if (v instanceof Date) return ymd(new Date(v.getTime() + 12 * 36e5)); const s = String(v || ''); return /^\d{4}-\d\d-\d\d/.test(s) ? s.slice(0, 10) : ''; };

  /* ---------- the three file layouts ---------- */
  const cell = (a, r, c) => (a[r] || [])[c];
  const txt = v => v == null ? '' : String(v).trim();
  function parseMilco(a, name) {
    const hr = a.findIndex(r => r && txt(r[0]).toUpperCase() === 'ICODE'); if (hr < 0) return null;
    const d1 = a[hr - 1] || [], H = a[hr] || [], top = a[hr - 2] || [], all = []; let cur2 = null;
    for (let c = 0; c < H.length; c++) { const dv = iso(d1[c]); if (dv) { let t = ''; for (let k = c; k >= 0 && !t; k--) if (typeof top[k] === 'string' && txt(top[k])) t = txt(top[k]); cur2 = { d: dv, cols: [], type: /pallet/i.test(t) ? 'plt' : /crt|crate/i.test(t) ? 'crt' : 'dem' }; all.push(cur2); } else if (/LOCATION TOTAL/i.test(txt(d1[c]))) cur2 = null; if (cur2 && txt(H[c])) cur2.cols.push([c, txt(H[c]).toUpperCase()]); }
    const fix = b => ({ d: b.d, cols: b.cols.filter(x => !/TOTAL|^NE$|^SE$|^P$/.test(x[1])) }), dem = all.filter(b => b.type === 'dem').map(fix), plt = all.filter(b => b.type === 'plt').map(fix), crt = all.filter(b => b.type === 'crt').map(fix);
    if (!dem.length) return null;
    const rows = [];
    for (let r = hr + 1; r < a.length; r++) { const A = a[r] || []; const code = txt(A[0]); if (!code || /^(total|summary)/i.test(code)) break; if (!/[A-Za-z]/.test(code) || /\s/.test(code) && code.length > 14) break;
      dem.forEach(b => b.cols.forEach(([c, loc]) => { const q = num(A[c]); if (!(q > 0)) return; const pb = plt.find(x => x.d === b.d), pcol = pb && pb.cols.find(x => x[1] === loc), cb = crt.find(x => x.d === b.d), ccol = cb && cb.cols.find(x => x[1] === loc);
        rows.push({ lab: b.d, dest: nDest(loc), sub: loc, sku: code, desc: txt(A[1]), q, u: 'pc', plt: pcol ? num(A[pcol[0]]) : null, crt: ccol ? num(A[ccol[0]]) : null }); })); }
    return rows.length ? { kind: 'milco', org: 'KIZAD', title: 'GSD / Milco daily demand', rows, trips: null, labs: [...new Set(rows.map(x => x.lab))].sort() } : null; }
  function parseWater(a, sheet) {
    if (!/NO\.? OF TRAILERS/i.test(txt(cell(a, 0, 1)))) return null; const org = txt(cell(a, 0, 0)) || sheet, W = a[0] || [], D = a[1] || [], L = a[2] || [], rows = [], trips = [], cols = []; let dest = '';
    for (let c = 2; c < W.length; c++) { if (txt(D[c])) dest = txt(D[c]); if (/TOTAL/i.test(dest)) break; if (!txt(L[c]) && !num(W[c])) continue; cols.push({ c, dest: nDest(dest), sub: dest, lab: txt(L[c]).toUpperCase(), tr: num(W[c]) || 1 }); }
    const last = a.findIndex((r, i) => i > 2 && /^TOTAL/i.test(txt(r && r[0]))); const end = last < 0 ? a.length : last;
    for (let r = 3; r < end; r++) { const A = a[r] || []; const code = txt(A[0]); if (!code) continue; cols.forEach(k => { const q = num(A[k.c]); if (q > 0) rows.push({ lab: k.lab, dest: k.dest, sub: k.sub, sku: code, desc: txt(A[1]), q, u: 'plt', plt: q, org }); }); }
    cols.forEach(k => { let p = 0; for (let r = 3; r < end; r++) p += num((a[r] || [])[k.c]); trips.push({ lab: k.lab, dest: k.dest, sub: k.sub, tr: k.tr, plt: p, org }); });
    return rows.length ? { kind: 'water', org, title: 'Water trailer plan — ' + org, rows, trips, labs: [...new Set(rows.map(x => x.lab))] } : null; }
  function parseUht(a, sheet) {
    if (!/TRAILER NO/i.test(txt(cell(a, 1, 0))) || !/SKU/i.test(txt(cell(a, 2, 0)))) return null; const cap = a[0] || [], T = a[1] || [], D = a[2] || [], cols = []; let lab = '';
    for (let c = 1; c < T.length; c++) { const t = txt(T[c]); if (!t && !txt(D[c])) continue; if (/^[A-Za-z]/.test(t)) lab = t.toUpperCase(); cols.push({ c, tn: /^\d+$/.test(t) ? t : '', lab, dest: nDest(D[c]), sub: txt(D[c]), plt: num(cap[c]) }); }
    let end = a.length; for (let r = 3; r < a.length; r++) { const code = txt((a[r] || [])[0]); if (/^(SM|OM|TOTAL)/i.test(code)) { end = r; break; } }
    const rows = [], trips = cols.map(k => ({ lab: k.lab, dest: k.dest, sub: k.sub, tr: 1, plt: k.plt, org: 'KIZAD', tn: k.tn }));
    for (let r = 3; r < end; r++) { const A = a[r] || [], code = txt(A[0]); if (!code) continue; cols.forEach(k => { const q = num(A[k.c]); if (q > 0) rows.push({ lab: k.lab, dest: k.dest, sub: k.sub, sku: code, desc: '', q, u: 'cs', plt: null, org: 'KIZAD', tn: k.tn }); }); }
    return rows.length ? { kind: 'uht', org: 'KIZAD', title: 'UHT trailer plan', rows, trips, labs: [...new Set(rows.map(x => x.lab))] } : null; }

  async function readFile(file) {
    const buf = await file.arrayBuffer(), wb = XLSX.read(buf, { type: 'array', cellDates: true }), out = [];
    wb.SheetNames.forEach(n => { const a = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: true }); const p = parseMilco(a, n) || parseWater(a, n) || parseUht(a, n); if (!p) return;
      const hasD = /(\d{1,2})[._-](\d{1,2})[._-](\d{2,4})/, base = p.kind === 'milco' ? p.labs[0] : baseFrom(hasD.test(n) ? n : file.name);
      out.push(Object.assign(p, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: file.name, sheet: n, base, map: {}, added: new Date().toISOString().slice(0, 16).replace('T', ' ') })); });
    return out; }

  /* ---------- the normalised plan (lines + trips) for the chosen period ---------- */
  function inRange(d) { return (!S.from || d >= S.from) && (!S.to || d <= S.to); }
  function plan() { const lines = [], trips = [];
    S.files.forEach(f => { f.rows.forEach(r => { const d = dOf(f, r.lab); if (inRange(d)) lines.push(Object.assign({}, r, { d, shift: shiftOf(r.lab), file: f.title, fid: f.id })); });
      if (f.trips) f.trips.forEach(t => { const d = dOf(f, t.lab); if (inRange(d)) trips.push(Object.assign({}, t, { d, shift: shiftOf(t.lab), file: f.title, fid: f.id })); });
      else { const m = new Map(); f.rows.forEach(r => { const d = dOf(f, r.lab); if (!inRange(d)) return; const k = d + '|' + r.dest; const o = m.get(k) || { d, dest: r.dest, sub: r.sub, tr: 0, plt: 0, org: f.org, shift: 'Day', file: f.title, fid: f.id, lab: r.lab }; o.plt += r.plt || 0; m.set(k, o); }); m.forEach(o => { o.tr = Math.max(1, Math.ceil(o.plt / (S.cap || 26) - 1e-9)); if (o.plt > 0) trips.push(o); }); } });
    return { lines, trips }; }

  /* ---------- the executed side ---------- */
  function execTrips(dests) { const out = []; if (!window.TRX) return out;
    TRX.rows().forEach(r => { if (r.log || !r.date || !inRange(r.date)) return; const st = TRX.stat(r); if (/cancel|not started|planned/i.test(st)) return;
      const c = [r.to, r.tloc, r.region].map(nDest).filter(Boolean); const dest = c.find(x => dests.has(x)) || c[0] || '—'; out.push({ d: r.date, dest, plts: r.plts || 0, st, trailer: r.trailer, driver: r.driver, mat: r.mat }); }); return out; }
  function pickLines() { if (!window.PTR || !PTR.P || !PTR.P.rows) return []; return PTR.P.rows.filter(r => r.Pick_Type !== 'Free pick' && r.Transit_Status !== 'Cancelled' && r.Trans_Date && inRange(String(r.Trans_Date).slice(0, 10))); }
  function pickQty(r, u) { const q = num(r.Qty_Picked); if (u === 'pc') return num(r.Qty_Base) && !/released/i.test(r.Transit_Status) ? 0 : (q * (num(r.UOM_Base_Nr) || 1)); return q; }

  /* ---------- the comparison ---------- */
  function compute() { const P = plan(), dests = new Set(P.lines.map(x => x.dest).concat(P.trips.map(x => x.dest))), K = x => (S.ignoreDate ? '*' : x.d) + '|' + x.dest;
    const E = execTrips(dests), PK = pickLines(), G = new Map(), g = k => { let o = G.get(k); if (!o) { const [d, dest] = k.split('|'); o = { k, d, dest, pT: 0, eT: 0, pP: 0, eP: 0, ip: 0, lines: 0, ex: 0, sh: 0, ov: 0, np: 0, un: 0, pq: 0, fill: 0, over: 0, hasPick: false }; G.set(k, o); } return o; };
    P.trips.forEach(t => { const o = g(K(t)); o.pT += t.tr; o.pP += t.plt || 0; });
    E.forEach(t => { const o = g(K(t)); if (/complet/i.test(t.st)) o.eT++; else o.ip++; o.eP += t.plts; });
    const L = new Map(); P.lines.forEach(l => { const k = K(l) + '|' + sku(l.sku); let o = L.get(k); if (!o) { o = { k, d: l.d, dest: l.dest, sku: l.sku, desc: l.desc, u: l.u, q: 0, p: 0, file: l.file, got: false }; L.set(k, o); } o.q += l.q; if (!o.desc) o.desc = l.desc; });
    const pickedAny = PK.length > 0; PK.forEach(r => { const dest = nDest(r.Destination), dk = (S.ignoreDate ? '*' : String(r.Trans_Date).slice(0, 10)) + '|' + dest, k = dk + '|' + sku(r.SKU_Code); let o = L.get(k);
      if (!o) { o = { k, d: S.ignoreDate ? '*' : String(r.Trans_Date).slice(0, 10), dest, sku: r.SKU_Code, desc: r.SKU_Desc || r.SKU_Dtls, u: 'pc', q: 0, p: 0, file: '(not in plan)', got: true, unplanned: true }; L.set(k, o); } o.got = true; o.p += pickQty(r, o.u); o.pickId = r.Pick_ID; o.trailer = r.Trailer_No; });
    const lines = [...L.values()].map(o => { const d = o.p - o.q, tol = Math.max(0, S.tol) / 100 * o.q; o.diff = d; o.status = o.unplanned ? 'Unplanned' : !o.got ? 'Not picked' : Math.abs(d) <= tol + 1e-9 ? 'Exact' : d < 0 ? 'Short' : 'Over'; return o; });
    lines.forEach(o => { const gg = g(o.k.split('|').slice(0, 2).join('|')); if (o.unplanned) { gg.un++; return; } gg.lines++; gg.pq += o.q; gg.fill += Math.min(o.q, o.p); gg.over += Math.max(0, o.p - o.q); if (o.status === 'Exact') gg.ex++; else if (o.status === 'Short') gg.sh++; else if (o.status === 'Over') gg.ov++; else gg.np++; if (o.got) gg.hasPick = true; });
    const rows = [...G.values()].filter(o => o.pT || o.lines || o.eT || o.ip).map(o => { o.tripC = o.pT ? Math.min(o.eT + o.ip, o.pT) / o.pT * 100 : null; o.pltA = o.pP ? Math.max(0, 100 - Math.abs(o.eP - o.pP) / o.pP * 100) : null; o.lineA = o.lines && pickedAny ? o.ex / o.lines * 100 : null; o.fillA = o.pq && pickedAny ? o.fill / o.pq * 100 : null; return o; }).sort((a, b) => a.d.localeCompare(b.d) || a.dest.localeCompare(b.dest));
    const T = rows.reduce((t, o) => { ['pT', 'eT', 'ip', 'pP', 'eP', 'lines', 'ex', 'sh', 'ov', 'np', 'un', 'pq', 'fill', 'over'].forEach(k => t[k] += o[k]); return t; }, { pT: 0, eT: 0, ip: 0, pP: 0, eP: 0, lines: 0, ex: 0, sh: 0, ov: 0, np: 0, un: 0, pq: 0, fill: 0, over: 0 });
    T.tripC = T.pT ? Math.min(T.eT + T.ip, T.pT) / T.pT * 100 : null; T.pltA = T.pP ? rows.reduce((t, o) => t + (o.pP ? Math.min(o.eP, o.pP) : 0), 0) / T.pP * 100 : null; T.lineA = T.lines && pickedAny ? T.ex / T.lines * 100 : null; T.fillA = T.pq && pickedAny ? T.fill / T.pq * 100 : null;
    return { rows, lines, T, P, E, PK, pickedAny }; }

  /* ---------- screen ---------- */
  const css = document.createElement('style'); css.textContent = '#dpBox .k-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:10px 0}#dpBox .k{padding:12px 15px;border:1px solid var(--border,#e2e8f0);border-radius:12px;background:var(--card,#fff)}#dpBox .k b{display:block;font-size:24px;line-height:1.2}#dpBox .k span{font-size:11.5px;color:var(--gray-600,#64748b)}#dpBox .dp-up{border:2px dashed #94a3b8;border-radius:14px;padding:16px;text-align:center;margin:8px 0;background:rgba(148,163,184,.08)}#dpBox .dp-up.on{border-color:#10b981;background:rgba(16,185,129,.1)}#dpBox .dp-f{display:grid;grid-template-columns:1fr auto;gap:6px 12px;border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:8px 12px;margin:6px 0;align-items:center}#dpBox table{width:100%;border-collapse:collapse;font-size:12.5px}#dpBox th,#dpBox td{padding:5px 8px;border-bottom:1px solid var(--border,#e2e8f0);text-align:left}#dpBox th{position:sticky;top:0;background:var(--card,#fff);z-index:1}#dpBox .n{text-align:right;font-variant-numeric:tabular-nums}#dpBox .g{color:#047857;font-weight:600}#dpBox .a{color:#b45309;font-weight:600}#dpBox .r{color:#b91c1c;font-weight:600}#dpBox .tw{max-height:460px;overflow:auto;border:1px solid var(--border,#e2e8f0);border-radius:10px}#dpBox .dp-t button.on{background:#0f766e;color:#fff}#dpBox .chip{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600}';
  document.head.appendChild(css);
  const cl = v => v == null ? '' : v >= 95 ? 'g' : v >= 80 ? 'a' : 'r', cell2 = v => `<td class="n ${cl(v)}">${pc(v)}</td>`;
  const stCl = { Exact: '#d1fae5;color:#065f46', Short: '#fee2e2;color:#991b1b', Over: '#fef3c7;color:#92400e', 'Not picked': '#fecaca;color:#7f1d1d', Unplanned: '#e0e7ff;color:#3730a3' };
  const chip = s => `<span class="chip" style="background:${stCl[s] || '#e2e8f0'}">${esc(s)}</span>`;

  function frame() { const ref = Q('#lpPaneCK') || Q('#lpPaneDC'); if (!ref) return null; let host = Q('#lpPaneDP'); if (!host) { host = document.createElement('div'); host.id = 'lpPaneDP'; host.style.display = 'none'; ref.insertAdjacentElement('afterend', host); }
    let el = Q('#dpBox'); if (el) return el; el = document.createElement('div'); el.id = 'dpBox'; host.appendChild(el);
    el.addEventListener('click', onClick); el.addEventListener('change', onChange); el.addEventListener('input', onInput);
    el.addEventListener('dragover', e => { const z = e.target.closest('.dp-up'); if (z) { e.preventDefault(); z.classList.add('on'); } }); el.addEventListener('dragleave', e => { const z = e.target.closest('.dp-up'); if (z) z.classList.remove('on'); });
    el.addEventListener('drop', e => { const z = e.target.closest('.dp-up'); if (!z) return; e.preventDefault(); z.classList.remove('on'); addFiles([...e.dataTransfer.files]); }); return el; }
  function show() { const el = frame(); if (!el) return; const p = Q('#lpPaneDP'); if (p) p.style.display = ''; if (!S.from) { const ds = S.files.flatMap(f => f.rows.map(r => dOf(f, r.lab))).sort(); S.from = ds[0] || ymd(new Date(Date.now() - 6 * 864e5)); S.to = ds[ds.length - 1] || ymd(new Date()); }
    if (!S.loaded && !S.busy) { refresh(false); } else render(); }
  async function refresh(force) { S.busy = true; S.msg = '⏳ Reading the trips and the picking lists…'; render();
    try { const jobs = []; if (window.TRX) jobs.push(TRX.load(!!force)); if (window.PTR) jobs.push(PTR.load(true)); await Promise.all(jobs.map(p => p.catch(e => console.warn(e)))); S.msg = ''; S.loaded = true; } catch (e) { S.msg = '⚠ ' + e.message; } S.busy = false; render(); }
  async function addFiles(fs) { fs = fs.filter(f => /\.xls[xm]?$/i.test(f.name)); if (!fs.length) { S.msg = '⚠ Choose .xlsx files.'; return render(); }
    if (typeof XLSX === 'undefined') { S.msg = '⚠ The Excel reader is not loaded.'; return render(); }
    S.msg = '⏳ Reading ' + fs.length + ' file(s)…'; render(); let n = 0, bad = [];
    for (const f of fs) { try { const got = await readFile(f); if (!got.length) bad.push(f.name); got.forEach(x => { S.files = S.files.filter(y => !(y.name === x.name && y.sheet === x.sheet)); S.files.push(x); n++; }); } catch (e) { bad.push(f.name + ' (' + e.message + ')'); } }
    saveF(); const ds = S.files.flatMap(f => f.rows.map(r => dOf(f, r.lab))).sort(); if (ds.length) { S.from = ds[0]; S.to = ds[ds.length - 1]; }
    S.msg = '✔ ' + n + ' plan sheet(s) imported' + (bad.length ? ' · ⚠ layout not recognised: ' + bad.join(', ') : '') + '.'; render(); if (!S.loaded) refresh(false); }

  function fileCard(f) { const labs = [...new Set((f.trips || []).map(t => t.lab).concat(f.rows.map(r => r.lab)))].sort(), nTr = f.trips ? f.trips.reduce((t, x) => t + x.tr, 0) : null, plt = f.rows.reduce((t, r) => t + (r.plt || 0), 0);
    const dates = f.kind === 'milco' ? '' : `<div class="text-sm" style="grid-column:1/-1">Day labels → date: ${labs.map(l => `<label style="margin-right:10px">${esc(l || 'no label')} <input type="date" data-map="${esc(f.id)}|${esc(l)}" value="${esc(dOf(f, l))}" style="width:auto"></label>`).join('')}</div>`;
    return `<div class="dp-f"><div><b>${esc(f.title)}</b> <span class="text-sm">· ${esc(f.name)}${f.sheet ? ' / ' + esc(f.sheet) : ''}</span><div class="text-sm">${f.rows.length} SKU lines · ${nTr != null ? nTr + ' trailers · ' : ''}${plt ? f1(plt) + ' pallets · ' : ''}${[...new Set(f.rows.map(r => r.dest))].length} destinations</div></div><div><button type="button" class="ghost small" data-dp="del" data-id="${esc(f.id)}">🗑 Remove</button></div>${f.kind === 'milco' ? '' : `<div class="text-sm" style="grid-column:1/-1">File date <input type="date" data-base="${esc(f.id)}" value="${esc(f.base)}" style="width:auto"> (the day labels are placed on or after this date)</div>`}${dates}</div>`; }

  function render() { const el = frame(); if (!el) return; const hasP = S.files.length, C = hasP ? compute() : null;
    let h = `<div class="dp-up"><b>📥 Import the demand plan</b><div class="text-sm" style="margin:4px 0 8px">Drop the Excel files here or choose them — GSD / Milco daily demand, Water trailer plan and UHT trailer plan are recognised automatically.</div><input type="file" id="dpFile" accept=".xlsx,.xlsm,.xls" multiple style="display:none"><button type="button" class="secondary" data-dp="pick">📂 Choose files</button></div>`;
    if (S.msg) h += `<div class="text-sm" style="margin:6px 0">${esc(S.msg)}</div>`;
    h += S.files.map(fileCard).join('');
    if (!hasP) { el.innerHTML = h + '<div class="text-sm" style="margin:10px 0">No plan imported yet.</div>'; return; }
    h += `<div class="btn-row" style="align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0"><label class="text-sm">From <input type="date" id="dpFrom" value="${S.from}" style="width:auto"></label><label class="text-sm">To <input type="date" id="dpTo" value="${S.to}" style="width:auto"></label><label class="text-sm">Pallets per trailer <input type="number" id="dpCap" min="1" value="${S.cap}" style="width:70px"></label><label class="text-sm">Picking tolerance ± <input type="number" id="dpTol" min="0" value="${S.tol}" style="width:60px">%</label><label class="text-sm"><input type="checkbox" id="dpIgn" ${S.ignoreDate ? 'checked' : ''}> ignore the date (whole period per destination)</label><button type="button" class="secondary small" data-dp="re">🔄 Reload trips &amp; picking</button><span style="flex:1"></span><button type="button" class="ghost small" data-dp="mail">📧 Email</button><button type="button" class="ghost small" data-dp="pr">🖨 Print</button><button type="button" class="ghost small" data-dp="xl">📊 Excel</button></div>
      <details style="margin:4px 0"><summary class="text-sm">Destination names (one per line: <code>text in the list = group</code>) — e.g. <code>MILCO AUH=ABU DHABI</code></summary><textarea id="dpAlias" rows="3" style="width:100%">${esc(S.alias)}</textarea></details>`;
    const T = C.T; h += `<div class="k-g"><div class="k"><b class="${cl(T.tripC)}">${pc(T.tripC)}</b><span>Trip compliance — ${f0(T.eT + T.ip)} of ${f0(T.pT)} planned trips executed${T.ip ? ' (' + T.ip + ' still on the road)' : ''}</span></div><div class="k"><b class="${cl(T.pltA)}">${pc(T.pltA)}</b><span>Pallet accuracy — ${f0(T.eP)} delivered vs ${f0(T.pP)} planned</span></div><div class="k"><b class="${cl(T.lineA)}">${pc(T.lineA)}</b><span>Picking accuracy (lines) — ${T.ex} of ${T.lines} lines within ±${S.tol}%</span></div><div class="k"><b class="${cl(T.fillA)}">${pc(T.fillA)}</b><span>Quantity fill — picked vs planned quantity</span></div><div class="k"><b class="${T.sh + T.np ? 'r' : 'g'}">${T.sh + T.np}</b><span>Short / not-picked lines (${T.sh} short · ${T.np} not picked)</span></div><div class="k"><b class="${T.ov + T.un ? 'a' : 'g'}">${T.ov + T.un}</b><span>Over-picked / unplanned lines (${T.ov} over · ${T.un} unplanned)</span></div></div>`;
    if (!C.pickedAny) h += `<div class="text-sm" style="background:#fff8e1;border:1px solid #fcd34d;color:#92400e;border-radius:8px;padding:6px 10px;margin:6px 0">No picking lines were found in WH_Pick_Transit_tbl for this period — the picking accuracy needs the F&amp;D plan to be pushed to the pickers (Dispatch picking). Trips and pallets are compared from the trips list.</div>`;
    h += `<div class="btn-row dp-t" style="gap:6px;margin:8px 0"><button type="button" class="ghost small ${S.view === 'dest' ? 'on' : ''}" data-dp="v" data-v="dest">By destination</button><button type="button" class="ghost small ${S.view === 'day' ? 'on' : ''}" data-dp="v" data-v="day">By day</button><button type="button" class="ghost small ${S.view === 'sku' ? 'on' : ''}" data-dp="v" data-v="sku">SKU lines</button><button type="button" class="ghost small ${S.view === 'trips' ? 'on' : ''}" data-dp="v" data-v="trips">Planned vs executed trips</button></div>`;
    h += tableHtml(C); el.innerHTML = h; }

  function groupBy(C, key) { const m = new Map(); C.rows.forEach(o => { const k = key(o); let a = m.get(k); if (!a) { a = { k, pT: 0, eT: 0, ip: 0, pP: 0, eP: 0, lines: 0, ex: 0, sh: 0, ov: 0, np: 0, un: 0, pq: 0, fill: 0 }; m.set(k, a); } Object.keys(a).forEach(x => { if (x !== 'k') a[x] += o[x]; }); });
    return [...m.values()].map(a => (a.tripC = a.pT ? Math.min(a.eT + a.ip, a.pT) / a.pT * 100 : null, a.pltA = a.pP ? Math.max(0, 100 - Math.abs(a.eP - a.pP) / a.pP * 100) : null, a.lineA = a.lines && C.pickedAny ? a.ex / a.lines * 100 : null, a.fillA = a.pq && C.pickedAny ? a.fill / a.pq * 100 : null, a)).sort((x, y) => String(x.k).localeCompare(String(y.k))); }
  function view(C) { const v = S.view;
    if (v === 'sku') { const q = S.q.toLowerCase(); const L = C.lines.filter(o => (!S.st || o.status === S.st) && (!q || (o.sku + ' ' + o.desc + ' ' + o.dest).toLowerCase().includes(q))).sort((a, b) => a.d.localeCompare(b.d) || a.dest.localeCompare(b.dest) || String(a.sku).localeCompare(String(b.sku)));
      return { headers: ['Date', 'Destination', 'SKU', 'Description', 'Unit', 'Planned', 'Picked', 'Difference', 'Status', 'Pick no.', 'Trailer', 'Plan file'], rows: L.map(o => [o.d, o.dest, o.sku, o.desc, o.u === 'plt' ? 'pallet' : o.u === 'cs' ? 'case' : 'pcs', o.q, o.p, o.diff, o.status, o.pickId || '', o.trailer || '', o.file]), n: [5, 6, 7], st: 8, title: 'SKU lines' }; }
    if (v === 'trips') { const ex = C.E.slice().sort((a, b) => a.d.localeCompare(b.d) || a.dest.localeCompare(b.dest)); return { headers: ['Date', 'Destination', 'Executed trip status', 'Trailer', 'Driver', 'Material', 'Pallets'], rows: ex.map(t => [t.d, t.dest, t.st, t.trailer, t.driver, t.mat, t.plts]), n: [6], title: 'Executed trips (Trls_Daily_Activity_tbl) in the period' }; }
    const rows = v === 'day' ? groupBy(C, o => o.d) : v === 'dest' ? groupBy(C, o => o.dest) : C.rows.map(o => Object.assign({ k: o.d + ' · ' + o.dest }, o));
    return { headers: [v === 'day' ? 'Date' : 'Destination', 'Planned trips', 'Executed trips', 'Trip compliance', 'Planned pallets', 'Delivered pallets', 'Pallet accuracy', 'Planned lines', 'Exact', 'Short', 'Over', 'Not picked', 'Unplanned', 'Line accuracy', 'Qty fill'], rows: rows.map(o => [o.k, o.pT, o.eT + o.ip, o.tripC, o.pP, o.eP, o.pltA, o.lines, o.ex, o.sh, o.ov, o.np, o.un, o.lineA, o.fillA]), pct: [3, 6, 13, 14], n: [1, 2, 4, 5, 7, 8, 9, 10, 11, 12], title: v === 'day' ? 'By day' : 'By destination' }; }
  function tableHtml(C) { const V = view(C); let filt = ''; if (S.view === 'sku') filt = `<div class="btn-row" style="gap:8px;margin:4px 0"><input id="dpQ" placeholder="Search SKU / destination" value="${esc(S.q)}" style="width:220px"><select id="dpSt"><option value="">All statuses</option>${['Exact', 'Short', 'Over', 'Not picked', 'Unplanned'].map(s => `<option ${S.st === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>`;
    const body = V.rows.slice(0, 1500).map(r => '<tr>' + r.map((v, i) => V.pct && V.pct.includes(i) ? cell2(v) : V.st === i ? `<td>${chip(v)}</td>` : V.n && V.n.includes(i) ? `<td class="n">${typeof v === 'number' ? f1(v) : esc(v)}</td>` : `<td>${esc(v)}</td>`).join('') + '</tr>').join('');
    return filt + `<div class="tw"><table><thead><tr>${V.headers.map((x, i) => `<th class="${(V.n && V.n.includes(i)) || (V.pct && V.pct.includes(i)) ? 'n' : ''}">${esc(x)}</th>`).join('')}</tr></thead><tbody>${body || '<tr><td colspan="' + V.headers.length + '">Nothing for this selection.</td></tr>'}</tbody></table></div>${V.rows.length > 1500 ? '<div class="text-sm">Showing the first 1500 rows — the Excel export has all of them.</div>' : ''}`; }

  function exportData() { const C = compute(), V = view(C); return { title: 'Demand plan vs execution — ' + V.title, note: `${S.from} → ${S.to} · trip compliance ${pc(C.T.tripC)} · pallet accuracy ${pc(C.T.pltA)} · picking accuracy ${pc(C.T.lineA)} · quantity fill ${pc(C.T.fillA)}`, headers: V.headers, rows: V.rows.map(r => r.map((v, i) => V.pct && V.pct.includes(i) && v != null ? Math.round(v) + '%' : typeof v === 'number' ? Math.round(v * 10) / 10 : v == null ? '' : v)) }; }
  function excel() { const C = compute(), wb = XLSX.utils.book_new(), sh = (n, V) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([V.headers, ...V.rows.map(r => r.map((v, i) => V.pct && V.pct.includes(i) && v != null ? Math.round(v * 10) / 10 / 100 : v))]), n), T = C.T;
    const sum = [['Period', S.from + ' → ' + S.to], ['Trip compliance %', T.tripC == null ? '' : Math.round(T.tripC * 10) / 10], ['Planned trips', T.pT], ['Executed trips', T.eT + T.ip], ['Pallet accuracy %', T.pltA == null ? '' : Math.round(T.pltA * 10) / 10], ['Planned pallets', T.pP], ['Delivered pallets', T.eP], ['Picking accuracy % (lines)', T.lineA == null ? '' : Math.round(T.lineA * 10) / 10], ['Quantity fill %', T.fillA == null ? '' : Math.round(T.fillA * 10) / 10], ['Planned lines', T.lines], ['Exact', T.ex], ['Short', T.sh], ['Over', T.ov], ['Not picked', T.np], ['Unplanned', T.un], ['Tolerance ±%', S.tol], ['Pallets per trailer', S.cap]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), 'Summary'); const keep = S.view, q = S.q, st = S.st; S.q = ''; S.st = '';
    ['dest', 'day', 'sku', 'trips'].forEach(v => { S.view = v; const V = view(C); sh({ dest: 'By destination', day: 'By day', sku: 'SKU lines', trips: 'Executed trips' }[v], V); });
    const PL = C.P.lines; XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Date', 'Destination', 'Sub-destination', 'SKU', 'Description', 'Quantity', 'Unit', 'Pallets', 'Shift', 'Origin', 'File'], ...PL.map(l => [l.d, l.dest, l.sub, l.sku, l.desc, l.q, l.u, l.plt, l.shift, l.org || '', l.file])]), 'Demand plan');
    S.view = keep; S.q = q; S.st = st; XLSX.writeFile(wb, 'Demand_plan_vs_execution_' + S.from + '_' + S.to + '.xlsx'); }

  function onClick(e) { const b = e.target.closest('[data-dp]'); if (!b) return; const a = b.dataset.dp;
    if (a === 'pick') return Q('#dpFile').click();
    if (a === 'del') { S.files = S.files.filter(f => f.id !== b.dataset.id); saveF(); return render(); }
    if (a === 're') return refresh(true);
    if (a === 'v') { S.view = b.dataset.v; return render(); }
    const D = exportData(); if (!D.rows.length) { try { sectionToast('Nothing to show for this selection.', 'warn'); } catch (x) {} return; }
    if (a === 'xl') return excel(); if (a === 'pr') return w_printTable(D.title, D.note, D.headers, D.rows); if (a === 'mail') { window.extMailData = exportData; wMail_open('ext'); } }
  function onChange(e) { const t = e.target;
    if (t.id === 'dpFile') { const fs = [...t.files]; t.value = ''; return addFiles(fs); }
    if (t.dataset.base) { const f = S.files.find(x => x.id === t.dataset.base); if (f && t.value) { f.base = t.value; f.map = {}; saveF(); render(); } return; }
    if (t.dataset.map) { const [id, lab] = t.dataset.map.split('|'), f = S.files.find(x => x.id === id); if (f && t.value) { f.map = f.map || {}; f.map[lab] = t.value; saveF(); render(); } return; }
    if (t.id === 'dpFrom' || t.id === 'dpTo') { S.from = Q('#dpFrom').value || S.from; S.to = Q('#dpTo').value || S.to; if (S.from > S.to) { const x = S.from; S.from = S.to; S.to = x; } return render(); }
    if (t.id === 'dpCap') { S.cap = Math.max(1, num(t.value) || 26); saveC(); return render(); }
    if (t.id === 'dpTol') { S.tol = Math.max(0, num(t.value)); saveC(); return render(); }
    if (t.id === 'dpIgn') { S.ignoreDate = t.checked; saveC(); return render(); }
    if (t.id === 'dpAlias') { S.alias = t.value; saveC(); return render(); }
    if (t.id === 'dpSt') { S.st = t.value; return render(); } }
  function onInput(e) { if (e.target.id === 'dpQ') { S.q = e.target.value; const pos = e.target.selectionStart; render(); const i = Q('#dpQ'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (x) {} } } }

  window.demandPlan = { show, S, compute, parse: { milco: parseMilco, water: parseWater, uht: parseUht }, readFile };
})();
