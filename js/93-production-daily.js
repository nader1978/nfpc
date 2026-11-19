/* ============================================================
   Oasis AUH — Production daily analysis
   Source: the "Oasis AUH Daily Report" workbook (sheets "Data" = runs, "Breakdown Data" = stoppages).
   The user uploads the latest workbook each day; it is read in the browser and kept on this device.
   Pages: day summary + insights · runs · breakdowns · trend · repeat issues
   ============================================================ */
(function () {
  'use strict';
  const Q = s => document.querySelector(s), esc = typeof escapeHtml === 'function' ? escapeHtml : s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = (typeof LS_BASE !== 'undefined' ? LS_BASE : 'orbit') + '_opa_v1';
  const nz = x => String(x == null ? '' : x).split('\n')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ymdU = ms => { const d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  const dmy = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return d + ' ' + MN[+m - 1] + ' ' + y; };
  const dow = s => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(s + 'T00:00:00Z').getUTCDay()];
  const shiftDay = (s, n) => ymdU(new Date(s + 'T00:00:00Z').getTime() + n * 864e5);
  const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const f0 = n => Math.round(n).toLocaleString(), f1 = n => (Math.round(n * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }), pc = (n, d) => (n * 100).toFixed(d == null ? 1 : d) + '%';
  const hm = fr => { if (fr == null || fr === '' || !isFinite(fr)) return ''; const m = Math.round((fr % 1) * 1440); return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); };
  const LINES = ['5 gallon Line (Capsnap)', 'Krones high speed Line'], SHORT = { '5 gallon Line (Capsnap)': '5 Gallon line', 'Krones high speed Line': 'Krones line' }, COL = { '5 gallon Line (Capsnap)': '#2563eb', 'Krones high speed Line': '#16a34a' };
  const lineOf = v => { const s = String(v || '').toLowerCase(); return /^5|gallon|capsnap/.test(s) ? LINES[0] : /krones|pet|high/.test(s) ? LINES[1] : String(v || ''); };
  const S = { runs: [], brk: [], meta: null, day: '', tab: 'sum', busy: false, f: { line: '', resp: '', mc: '' }, cmp: { p: 'w', aF: '', aT: '', bF: '', bT: '' } };
  const LN = () => S.f.line ? LINES.filter(l => l === S.f.line) : LINES, BR = () => S.brk.filter(b => (!S.f.line || b.ln === S.f.line) && (!S.f.resp || b.resp === S.f.resp) && (!S.f.mc || b.mc === S.f.mc));

  /* ---------- storage ---------- */
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ runs: S.runs, brk: S.brk, meta: S.meta })); return true; } catch (e) { return false; } }
  function restore() { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && j.runs) { S.runs = j.runs; S.brk = j.brk || []; S.meta = j.meta || null; } } catch (e) { } }

  /* ---------- workbook reader ---------- */
  function sheetRows(wb, name) { const n = wb.SheetNames.find(x => nz(x) === nz(name)); if (!n) return null; return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true }); }
  function colMap(hdr) { const m = {}; hdr.forEach((h, i) => { const k = nz(h); if (k && m[k] == null) m[k] = i; }); return m; }
  const serial = v => typeof v === 'number' ? ymdU(Math.round((v - 25569) * 864e5)) : (v instanceof Date && !isNaN(v)) ? ymdU(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())) : /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : '';
  function readRuns(R) {
    const M = colMap(R[0]), g = (r, ...ks) => { for (const k of ks) { const i = M[nz(k)]; if (i != null && r[i] !== '' && r[i] != null) return r[i]; } return ''; }, out = [];
    for (let i = 1; i < R.length; i++) { const r = R[i], d = serial(g(r, 'Date')); if (!d) continue;
      const pcs = num(g(r, 'Actual Production (PCs)')); out.push({ d, ln: lineOf(g(r, 'Filler')), sku: String(g(r, 'SKU')), jde: String(g(r, 'JDE Code')), desc: String(g(r, 'JDE Desc')), brand: String(g(r, 'Brand')), seq: num(g(r, 'Sequence')), pcs, uom: num(g(r, 'Actual Production (UOM)')), ltr: num(g(r, 'Actual Production (ltrs)')),
        spd: num(g(r, 'Actual speed (PCs/ hr)')), rated: num(g(r, 'Rated Speed (Pcs/Hr)')), st: g(r, 'Startup time') === '' ? null : num(g(r, 'Startup time')), en: g(r, 'Run end time') === '' ? null : num(g(r, 'Run end time')), rej: num(g(r, 'Rejection (PCs)')), runH: num(g(r, 'Run Duration')),
        nth: num(g(r, 'Net Theoretical Production')), tth: num(g(r, 'True Theoretical Production')), ne: num(g(r, 'Run Net efficiency %')), te: num(g(r, 'Run True efficiency %')),
        dUI: num(g(r, 'Unplanned operational DT - inside run(Min)')), dMI: num(g(r, 'Unplanned Mech. DT - inside run (Min)')), dUO: num(g(r, 'Unplanned operational DT - outside run(Min)')), dMO: num(g(r, 'Unplanned Mech. DT - outside run (Min)')) }); }
    return out;
  }
  function readBrk(R) {
    const M = colMap(R[0]), g = (r, k) => { const i = M[nz(k)]; return i == null ? '' : r[i]; }, out = [];
    for (let i = 1; i < R.length; i++) { const r = R[i], d = serial(g(r, 'Date')); if (!d) continue; const mins = num(g(r, 'Duration (min)')), fr = num(g(r, 'Frequency')); if (!mins && !fr) continue;
      out.push({ d, ln: lineOf(g(r, 'Line')), sku: String(g(r, 'SKU')), mc: String(g(r, 'Machine')).trim(), cat: String(g(r, 'Category')).trim(), ty: String(g(r, 'Stoppage Type')).trim(), io: String(g(r, 'Inside/Outside')).trim(), api: String(g(r, 'API')).trim(), resp: String(g(r, 'Responsibility')).trim(), is: String(g(r, 'Issue')).trim(), fr, min: mins, st: g(r, 'Start time') === '' ? null : num(g(r, 'Start time')), en: g(r, 'End time') === '' ? null : num(g(r, 'End time')) }); }
    return out;
  }
  async function importFile(file) {
    if (!file) return; S.busy = true; say('Reading ' + file.name + '…'); render();
    try {
      if (typeof XLSX === 'undefined') throw new Error('the Excel reader is not loaded');
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' }), D = sheetRows(wb, 'Data'), B = sheetRows(wb, 'Breakdown Data');
      if (!D || !B) throw new Error('the workbook must contain the sheets "Data" and "Breakdown Data"');
      const runs = readRuns(D), brk = readBrk(B); if (!runs.length) throw new Error('no production runs found in the "Data" sheet');
      S.runs = runs; S.brk = brk; const ds = runs.map(r => r.d).sort(); S.meta = { file: file.name, at: new Date().toISOString(), from: ds[0], to: ds[ds.length - 1], n: runs.length, nb: brk.length };
      S.day = S.meta.to; const ok = save();
      say('✔ ' + file.name + ' · ' + runs.length.toLocaleString() + ' runs · ' + brk.length.toLocaleString() + ' stoppages · up to ' + dmy(S.meta.to) + (ok ? '' : ' · ⚠ too large to keep on this device — upload again next time'), !ok);
    } catch (e) { say('⚠ ' + e.message, 1); }
    S.busy = false; render();
  }
  const say = (t, w) => { const e = Q('#opaStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };

  /* ---------- analysis ---------- */
  const days = () => [...new Set(S.runs.map(r => r.d))].sort();
  function lineDay(ln, d) {
    const R = S.runs.filter(r => r.d === d && r.ln === ln), B = BR().filter(b => b.d === d && b.ln === ln);
    const o = { ln, d, runs: R, brk: B, pcs: 0, uom: 0, ltr: 0, rej: 0, runH: 0, nth: 0, tth: 0, sw: 0, rw: 0 };
    R.forEach(r => { o.pcs += r.pcs; o.uom += r.uom; o.ltr += r.ltr; o.rej += r.rej; o.runH += r.runH; o.nth += r.nth; o.tth += r.tth; o.sw += r.spd * r.runH; o.rw += r.rated * r.runH; });
    o.ne = o.nth ? o.pcs / o.nth : 0; o.te = o.tth ? o.pcs / o.tth : 0; o.rejP = o.pcs ? o.rej / o.pcs : 0; o.spdP = o.rw ? o.sw / o.rw : 0;
    o.mech = B.filter(b => /mech/i.test(b.api)).reduce((a, b) => a + b.min, 0); o.oper = B.filter(b => !/mech/i.test(b.api)).reduce((a, b) => a + b.min, 0);
    o.unpl = B.filter(b => /^unplanned/i.test(b.ty)).reduce((a, b) => a + b.min, 0); o.plan = B.filter(b => /^planned/i.test(b.ty)).reduce((a, b) => a + b.min, 0); o.dt = o.mech + o.oper; o.cnt = B.reduce((a, b) => a + b.fr, 0);
    o.has = R.length > 0; return o;
  }
  function baseline(ln, d) { /* previous production day + average of the previous 7 production days of the same line */
    const prevDays = [...new Set(S.runs.filter(r => r.ln === ln && r.d < d).map(r => r.d))].sort().slice(-7), P = prevDays.map(x => lineDay(ln, x)), n = P.length || 1;
    const av = k => P.reduce((a, p) => a + p[k], 0) / n; return { prev: P[P.length - 1] || null, n: P.length, ne: av('ne'), te: av('te'), uom: av('uom'), rejP: av('rejP'), dt: av('dt'), unpl: av('unpl'), runH: av('runH') };
  }
  const grp = (B, fn) => { const m = new Map(); B.forEach(b => { const k = fn(b) || '—'; const o = m.get(k) || { k, min: 0, fr: 0, n: 0 }; o.min += b.min; o.fr += b.fr; o.n++; m.set(k, o); }); return [...m.values()].sort((a, b) => b.min - a.min); };
  const dlt = (v, ref, pp, inv) => { if (ref == null || !isFinite(ref) || ref === 0 && v === 0) return ''; const d = pp ? (v - ref) * 100 : (ref ? (v - ref) / ref * 100 : 0), good = inv ? d < 0 : d > 0; return `<small class="opa-d ${Math.abs(d) < .05 ? '' : good ? 'g' : 'b'}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${Math.abs(d).toFixed(1)}${pp ? ' pp' : '%'}</small>`; };

  function insights(d) {
    const out = [];
    LN().forEach(ln => { const L = lineDay(ln, d), nm = SHORT[ln]; if (!L.has) { out.push(['i', `${nm}: no production run recorded on ${dmy(d)}${L.dt ? ' — ' + f0(L.dt) + ' min of stoppages logged' : ''}.`]); return; }
      const B = baseline(ln, d);
      if (B.prev) { const x = (L.ne - B.prev.ne) * 100; out.push([x <= -3 ? 'b' : x >= 3 ? 'g' : 'i', `${nm}: net efficiency ${pc(L.ne)} — ${x >= 0 ? 'up' : 'down'} ${Math.abs(x).toFixed(1)} pp on ${dmy(B.prev.d)} (${pc(B.prev.ne)}), ${(L.ne - B.ne) * 100 >= 0 ? 'above' : 'below'} the last-${B.n}-day average (${pc(B.ne)}).`]); }
      else out.push(['i', `${nm}: net efficiency ${pc(L.ne)}, true efficiency ${pc(L.te)}.`]);
      if (L.te < L.ne - .12) out.push(['b', `${nm}: true efficiency (${pc(L.te)}) is ${((L.ne - L.te) * 100).toFixed(0)} pp under net — a lot of time was lost outside the scheduled run (planned/unplanned stops outside run).`]);
      if (L.spdP && L.spdP < .9) out.push(['b', `${nm}: ran at ${pc(L.spdP, 0)} of the rated speed — speed loss.`]);
      if (B.n && L.rejP > B.rejP * 1.5 && L.rejP > .002) out.push(['b', `${nm}: rejection ${pc(L.rejP, 2)} is above its recent average (${pc(B.rejP, 2)}).`]);
      const top = grp(L.brk.filter(b => /^unplanned/i.test(b.ty)), b => b.mc + ' · ' + b.cat)[0]; if (top) out.push([top.min >= 60 ? 'b' : 'i', `${nm}: biggest unplanned loss — ${top.k}: ${f0(top.min)} min (${top.fr} stop${top.fr === 1 ? '' : 's'}).`]);
      if (B.n && L.unpl > B.unpl * 1.5 && L.unpl > 30) out.push(['b', `${nm}: unplanned downtime ${f0(L.unpl)} min vs ${f0(B.unpl)} min average.`]); });
    const rep = repeats(d, 7).slice(0, 3); rep.forEach(r => out.push(['b', `Repeating: ${SHORT[r.ln]} · ${r.k} stopped on ${r.days} of the last 7 days (${f0(r.min)} min).`]));
    return out;
  }
  function repeats(d, span) {
    const from = shiftDay(d, -(span - 1)), m = new Map(); BR().filter(b => b.d >= from && b.d <= d && /^unplanned/i.test(b.ty)).forEach(b => { const k = b.ln + '|' + b.mc + ' · ' + b.cat, o = m.get(k) || { ln: b.ln, k: b.mc + ' · ' + b.cat, dset: new Set(), min: 0, fr: 0, resp: b.resp, api: b.api }; o.dset.add(b.d); o.min += b.min; o.fr += b.fr; m.set(k, o); });
    return [...m.values()].map(o => Object.assign(o, { days: o.dset.size })).filter(o => o.days >= 3).sort((a, b) => b.days - a.days || b.min - a.min);
  }

  /* ---------- small chart helpers (inline SVG) ---------- */
  function hbars(items, color, unit) { if (!items.length) return '<div class="opa-hint">None.</div>'; const mx = Math.max(...items.map(x => x[1]), 1); return items.map(x => `<div class="opa-hb"><span title="${esc(x[0])}">${esc(x[0])}</span><i><u style="width:${Math.max(2, x[1] / mx * 100)}%;background:${color}"></u></i><b>${f0(x[1])}${unit || ''}</b></div>`).join(''); }
  function donut(parts) { const tot = parts.reduce((a, p) => a + p[1], 0); if (!tot) return '<div class="opa-hint">No stoppages.</div>'; let a0 = -Math.PI / 2; const r = 40, c = 52, seg = parts.filter(p => p[1] > 0).map(p => { const a1 = a0 + p[1] / tot * 2 * Math.PI, big = a1 - a0 > Math.PI ? 1 : 0, d = p[1] === tot ? `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - .01} ${c - r}` : `M ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 ${big} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)}`; a0 = a1; return `<path d="${d}" fill="none" stroke="${p[2]}" stroke-width="18"><title>${esc(p[0])}: ${f0(p[1])} min</title></path>`; }).join('');
    return `<div class="opa-dn"><svg viewBox="0 0 104 104" width="118" height="118">${seg}<text x="52" y="56" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor">${f0(tot)}</text><text x="52" y="68" text-anchor="middle" font-size="7" fill="currentColor">min</text></svg><div>${parts.map(p => `<div><i style="background:${p[2]}"></i>${esc(p[0])} <b>${f0(p[1])}</b> <small>(${Math.round(p[1] / tot * 100)}%)</small></div>`).join('')}</div></div>`; }
  function lineChart(series, w, h) { /* series: [{name,color,pts:[[label,value]]}] — values 0..1 */
    const labs = [...new Set(series.flatMap(s => s.pts.map(p => p[0])))].sort(); if (labs.length < 2) return '<div class="opa-hint">Not enough days yet.</div>'; const all = series.flatMap(s => s.pts.map(p => p[1])), lo = Math.max(0, Math.floor((Math.min(...all) - .05) * 20) / 20), hi = Math.min(1.1, Math.ceil((Math.max(...all) + .02) * 20) / 20), X = i => 34 + i * (w - 44) / (labs.length - 1), Y = v => 8 + (hi - v) / (hi - lo || 1) * (h - 28);
    const grid = [0, 1, 2, 3, 4].map(i => { const v = lo + (hi - lo) * i / 4; return `<line x1="34" x2="${w - 10}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" opacity=".12"/><text x="30" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="currentColor" opacity=".7">${Math.round(v * 100)}%</text>`; }).join('');
    const step = Math.ceil(labs.length / 10), xl = labs.map((l, i) => i % step === 0 ? `<text x="${X(i)}" y="${h - 4}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".7">${l.slice(8)}/${l.slice(5, 7)}</text>` : '').join('');
    const lines = series.map(s => { const pts = s.pts.map(p => [X(labs.indexOf(p[0])), Y(p[1]), p]); return `<polyline fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="4 3"' : ''} points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}"/>` + pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="${s.color}"><title>${esc(s.name)} · ${dmy(p[2][0])}: ${pc(p[2][1])}</title></circle>`).join(''); }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="opa-svg">${grid}${lines}${xl}</svg><div class="opa-leg">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
  }
  function barChart(items, color, w, h) { if (!items.length) return '<div class="opa-hint">No data.</div>'; const mx = Math.max(...items.map(x => x[1]), 1), step = (w - 20) / items.length, bw = Math.max(4, Math.min(30, step - 4));
    return `<svg viewBox="0 0 ${w} ${h + 18}" class="opa-svg">${items.map((x, i) => { const bh = Math.round(x[1] / mx * (h - 16)), X = 10 + i * step + (step - bw) / 2; return `<g><title>${dmy(x[0])}: ${f0(x[1])}</title><rect x="${X}" y="${h - bh}" width="${bw}" height="${bh}" rx="2" fill="${color}"/>${i % Math.ceil(items.length / 10) === 0 ? `<text x="${X + bw / 2}" y="${h + 11}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".7">${x[0].slice(8)}/${x[0].slice(5, 7)}</text>` : ''}</g>`; }).join('')}</svg>`; }

  /* ---------- tabs ---------- */
  const tile = (t, v, sub, c) => `<div class="opa-k" style="border-top:4px solid ${c || '#2563eb'}"><span>${t}</span><b>${v}</b><small>${sub || ''}</small></div>`;
  function summary(d) {
    const info = LN().map(ln => ({ ln, L: lineDay(ln, d), B: baseline(ln, d) })), ins = insights(d);
    const tot = { uom: 0, ltr: 0, dt: 0, unpl: 0, runH: 0 }; info.forEach(x => { tot.uom += x.L.uom; tot.ltr += x.L.ltr; tot.dt += x.L.dt; tot.unpl += x.L.unpl; tot.runH += x.L.runH; });
    const cards = info.map(({ ln, L, B }) => !L.has ? `<div class="opa-c"><h4><i style="background:${COL[ln]}"></i>${SHORT[ln]}</h4><div class="opa-hint">No run recorded on this day.</div></div>` :
      `<div class="opa-c"><h4><i style="background:${COL[ln]}"></i>${SHORT[ln]} <small>${L.runs.length} run${L.runs.length > 1 ? 's' : ''} · ${f1(L.runH)} run h</small></h4>
        <div class="opa-kpis">${tile('Net efficiency', pc(L.ne), dlt(L.ne, B.prev && B.prev.ne, 1) + ' vs prev day' , COL[ln])}${tile('True efficiency', pc(L.te), dlt(L.te, B.prev && B.prev.te, 1) + ' vs prev day', COL[ln])}${tile('Production', f0(L.uom) + ' UOM', f0(L.pcs) + ' pcs · ' + f0(L.ltr) + ' L ' + dlt(L.uom, B.n ? B.uom : null), COL[ln])}${tile('Rejection', pc(L.rejP, 2), f0(L.rej) + ' pcs ' + dlt(L.rejP, B.n ? B.rejP : null, 0, 1), COL[ln])}${tile('Downtime', f0(L.dt) + ' min', 'Mech ' + f0(L.mech) + ' · Oper ' + f0(L.oper) + ' ' + dlt(L.dt, B.n ? B.dt : null, 0, 1), COL[ln])}${tile('Speed vs rated', L.spdP ? pc(L.spdP, 0) : '—', 'planned stops ' + f0(L.plan) + ' min', COL[ln])}</div></div>`).join('');
    const all = info.flatMap(x => x.L.brk), api = [['Mechanical', all.filter(b => /mech/i.test(b.api)).reduce((a, b) => a + b.min, 0), '#ef4444'], ['Operational', all.filter(b => !/mech/i.test(b.api)).reduce((a, b) => a + b.min, 0), '#f59e0b']], ty = [['Unplanned', all.filter(b => /^unplanned/i.test(b.ty)).reduce((a, b) => a + b.min, 0), '#dc2626'], ['Planned', all.filter(b => /^planned/i.test(b.ty)).reduce((a, b) => a + b.min, 0), '#64748b']];
    const resp = grp(all, b => b.resp).slice(0, 8).map(x => [x.k, x.min]), mc = grp(all, b => b.mc).slice(0, 8).map(x => [x.k, x.min]);
    return `<div class="opa-ins"><h4>💡 What happened on ${dow(d)} ${dmy(d)}</h4>${ins.length ? ins.map(i => `<div class="opa-i ${i[0]}">${i[0] === 'b' ? '⚠' : i[0] === 'g' ? '✔' : '•'} ${esc(i[1])}</div>`).join('') : '<div class="opa-hint">No runs or stoppages recorded on this day.</div>'}</div>
      <div class="opa-kpis">${tile('Total production', f0(tot.uom) + ' UOM', f0(tot.ltr) + ' litres', '#0ea5e9')}${tile('Run hours', f1(tot.runH) + ' h', 'both lines', '#0ea5e9')}${tile('Downtime logged', f0(tot.dt) + ' min', f0(tot.unpl) + ' min unplanned', '#ef4444')}</div>
      <div class="opa-grid">${cards}</div>
      <div class="opa-grid"><div class="opa-c"><h4>Mechanical vs operational <small>minutes</small></h4>${donut(api)}</div><div class="opa-c"><h4>Planned vs unplanned <small>minutes</small></h4>${donut(ty)}</div><div class="opa-c"><h4>By responsibility <small>min</small></h4>${hbars(resp, '#6366f1')}</div><div class="opa-c"><h4>By machine <small>min</small></h4>${hbars(mc, '#ef4444')}</div></div>`;
  }
  function runsTab(d) {
    const R = S.runs.filter(r => r.d === d && (!S.f.line || r.ln === S.f.line)).sort((a, b) => a.ln.localeCompare(b.ln) || (a.st || 0) - (b.st || 0));
    return `<div class="opa-wrap"><table class="opa-t"><thead><tr><th>Line</th><th>SKU</th><th>Item</th><th>Start</th><th>End</th><th class="c">Run h</th><th class="c">Pieces</th><th class="c">UOM</th><th class="c">Litres</th><th class="c">Speed</th><th class="c">Rated</th><th class="c">Net eff</th><th class="c">True eff</th><th class="c">Rejects</th><th class="c">Reject %</th></tr></thead><tbody>${R.map(r => `<tr><td>${esc(SHORT[r.ln] || r.ln)}</td><td><b>${esc(r.sku)}</b></td><td>${esc(r.desc)}</td><td>${hm(r.st)}</td><td>${hm(r.en)}</td><td class="c">${f1(r.runH)}</td><td class="c">${f0(r.pcs)}</td><td class="c">${f0(r.uom)}</td><td class="c">${f0(r.ltr)}</td><td class="c">${f0(r.spd)}</td><td class="c">${f0(r.rated)}</td><td class="c ${r.ne < .75 ? 'bad' : r.ne >= .9 ? 'ok' : ''}">${pc(r.ne)}</td><td class="c">${pc(r.te)}</td><td class="c">${f0(r.rej)}</td><td class="c">${pc(r.pcs ? r.rej / r.pcs : 0, 2)}</td></tr>`).join('') || '<tr><td colspan="15" class="opa-hint">No runs on this day.</td></tr>'}</tbody></table></div>`;
  }
  function brkTab(d) {
    const B = BR().filter(b => b.d === d).sort((a, b) => b.min - a.min), from = shiftDay(d, -7), prev = BR().filter(b => b.d >= from && b.d < d), pd = new Set(prev.map(b => b.d)).size || 1, avg = new Map(); prev.forEach(b => { const k = b.ln + '|' + b.mc + '|' + b.cat; avg.set(k, (avg.get(k) || 0) + b.min / pd); });
    return `<div class="opa-hint">Sorted by duration · “vs 7-d avg” compares each stoppage type (machine + category) with its average per production day over the previous 7 days.</div><div class="opa-wrap"><table class="opa-t"><thead><tr><th>Line</th><th>Machine</th><th>Category</th><th>Issue</th><th>Type</th><th>In/Out run</th><th>Mech / Oper</th><th>Responsibility</th><th class="c">Stops</th><th class="c">Min</th><th class="c">7-d avg min</th></tr></thead><tbody>${B.map(b => { const a = avg.get(b.ln + '|' + b.mc + '|' + b.cat) || 0; return `<tr><td>${esc(SHORT[b.ln] || b.ln)}</td><td><b>${esc(b.mc)}</b></td><td>${esc(b.cat)}</td><td>${esc(b.is)}</td><td>${/^unpl/i.test(b.ty) ? '<span class="opa-p r">Unplanned</span>' : '<span class="opa-p">Planned</span>'}</td><td>${esc(b.io)}</td><td>${esc(b.api)}</td><td>${esc(b.resp)}</td><td class="c">${f0(b.fr)}</td><td class="c"><b>${f0(b.min)}</b></td><td class="c ${a && b.min > a * 1.5 ? 'bad' : ''}">${a ? f0(a) : '<span class="opa-hint">new</span>'}</td></tr>`; }).join('') || '<tr><td colspan="11" class="opa-hint">No stoppages on this day.</td></tr>'}</tbody></table></div>`;
  }
  function trendTab(d) {
    const ds = days().filter(x => x <= d).slice(-30), by = ln => ds.map(x => [x, lineDay(ln, x)]).filter(p => p[1].has);
    const eff = LN().flatMap(ln => [{ name: SHORT[ln] + ' net', color: COL[ln], pts: by(ln).map(p => [p[0], p[1].ne]) }, { name: SHORT[ln] + ' true', color: COL[ln], dash: 1, pts: by(ln).map(p => [p[0], p[1].te]) }]);
    const prod = LN().map(ln => `<div class="opa-c"><h4><i style="background:${COL[ln]}"></i>${SHORT[ln]} — production <small>UOM per day</small></h4>${barChart(by(ln).map(p => [p[0], p[1].uom]), COL[ln], 520, 120)}</div>`).join('');
    const rej = LN().map(ln => `<div class="opa-c"><h4><i style="background:${COL[ln]}"></i>${SHORT[ln]} — downtime <small>min per day</small></h4>${barChart(ds.map(x => [x, lineDay(ln, x).dt]), '#ef4444', 520, 120)}</div>`).join('');
    const tbl = ds.slice().reverse().slice(0, 14).map(x => { const a = lineDay(LINES[0], x), k = lineDay(LINES[1], x); return `<tr><td>${dow(x)} ${dmy(x)}</td><td class="c">${a.has ? pc(a.ne) : '—'}</td><td class="c">${a.has ? pc(a.te) : '—'}</td><td class="c">${a.has ? f0(a.uom) : '—'}</td><td class="c">${f0(a.dt)}</td><td class="c">${k.has ? pc(k.ne) : '—'}</td><td class="c">${k.has ? pc(k.te) : '—'}</td><td class="c">${k.has ? f0(k.uom) : '—'}</td><td class="c">${f0(k.dt)}</td></tr>`; }).join('');
    return `<div class="opa-c wide"><h4>Efficiency — last ${ds.length} production days <small>solid = net · dashed = true</small></h4>${lineChart(eff, 760, 200)}</div><div class="opa-grid">${prod}${rej}</div><div class="opa-wrap"><table class="opa-t"><thead><tr><th>Day</th><th class="c">5G net</th><th class="c">5G true</th><th class="c">5G UOM</th><th class="c">5G DT min</th><th class="c">Krones net</th><th class="c">Krones true</th><th class="c">Krones UOM</th><th class="c">Krones DT min</th></tr></thead><tbody>${tbl}</tbody></table></div>`;
  }
  function repTab(d) {
    const R = repeats(d, 7), R30 = repeats(d, 30).slice(0, 15), row = x => `<tr><td>${esc(SHORT[x.ln] || x.ln)}</td><td><b>${esc(x.k)}</b></td><td>${esc(x.api)}</td><td>${esc(x.resp)}</td><td class="c">${x.days}</td><td class="c">${f0(x.fr)}</td><td class="c"><b>${f0(x.min)}</b></td></tr>`, head = '<thead><tr><th>Line</th><th>Machine · category</th><th>Mech / Oper</th><th>Responsibility</th><th class="c">Days</th><th class="c">Stops</th><th class="c">Minutes</th></tr></thead>';
    return `<div class="opa-hint">Unplanned stoppages that came back on 3 or more days — the ones worth a permanent fix.</div><h4 class="opa-h">Last 7 days</h4><div class="opa-wrap"><table class="opa-t">${head}<tbody>${R.map(row).join('') || '<tr><td colspan="7" class="opa-hint">Nothing repeated on 3+ days.</td></tr>'}</tbody></table></div><h4 class="opa-h">Last 30 days — top 15</h4><div class="opa-wrap"><table class="opa-t">${head}<tbody>${R30.map(row).join('') || '<tr><td colspan="7" class="opa-hint">Nothing repeated.</td></tr>'}</tbody></table></div>`;
  }


  /* ---------- historical comparison ---------- */
  function cmpRanges() {
    const c = S.cmp, d = S.day; let aF, aT = d, bF, bT;
    if (c.p === 'w') { aF = shiftDay(d, -6); bT = shiftDay(d, -7); bF = shiftDay(d, -13); }
    else if (c.p === 'm') { aF = shiftDay(d, -29); bT = shiftDay(d, -30); bF = shiftDay(d, -59); }
    else if (c.p === 'mtd') { aF = d.slice(0, 8) + '01'; const dom = +d.slice(8), y = +d.slice(0, 4), m = +d.slice(5, 7); const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; bF = py + '-' + pad(pm) + '-01'; const last = new Date(Date.UTC(py, pm, 0)).getUTCDate(); bT = py + '-' + pad(pm) + '-' + pad(Math.min(dom, last)); }
    else if (c.p === 'pm') { const y = +d.slice(0, 4), m = +d.slice(5, 7), py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1, y2 = pm === 1 ? py - 1 : py, m2 = pm === 1 ? 12 : pm - 1; aF = py + '-' + pad(pm) + '-01'; aT = py + '-' + pad(pm) + '-' + pad(new Date(Date.UTC(py, pm, 0)).getUTCDate()); bF = y2 + '-' + pad(m2) + '-01'; bT = y2 + '-' + pad(m2) + '-' + pad(new Date(Date.UTC(y2, m2, 0)).getUTCDate()); }
    else { aF = c.aF || shiftDay(d, -6); aT = c.aT || d; bF = c.bF || shiftDay(d, -13); bT = c.bT || shiftDay(d, -7); }
    return { aF, aT, bF, bT };
  }
  function periodAgg(ln, from, to) {
    const R = S.runs.filter(r => r.ln === ln && r.d >= from && r.d <= to), B = BR().filter(b => b.ln === ln && b.d >= from && b.d <= to), o = { ln, from, to, days: new Set(R.map(r => r.d)).size, uom: 0, pcs: 0, ltr: 0, rej: 0, runH: 0, nth: 0, tth: 0, sw: 0, rw: 0, dt: 0, mech: 0, oper: 0, unpl: 0, plan: 0, stops: 0 };
    R.forEach(r => { o.uom += r.uom; o.pcs += r.pcs; o.ltr += r.ltr; o.rej += r.rej; o.runH += r.runH; o.nth += r.nth; o.tth += r.tth; o.sw += r.spd * r.runH; o.rw += r.rated * r.runH; });
    B.forEach(b => { o.dt += b.min; o.stops += b.fr; if (/mech/i.test(b.api)) o.mech += b.min; else o.oper += b.min; if (/^unplanned/i.test(b.ty)) o.unpl += b.min; else o.plan += b.min; });
    o.ne = o.nth ? o.pcs / o.nth : 0; o.te = o.tth ? o.pcs / o.tth : 0; o.rejP = o.pcs ? o.rej / o.pcs : 0; o.spdP = o.rw ? o.sw / o.rw : 0; o.upd = o.days ? o.uom / o.days : 0; o.dtd = o.days ? o.dt / o.days : 0; return o;
  }
  const dTxt = (a, b, kind, inv) => { if (!isFinite(a) || !isFinite(b) || (!a && !b)) return '<td class="c">—</td><td class="c">—</td>'; const diff = kind === 'pp' || kind === 'pc2' ? (a - b) * 100 : a - b, rel = kind === 'pp' ? null : (b ? (a - b) / b * 100 : null), good = inv ? diff < 0 : diff > 0, cl = Math.abs(diff) < .0005 ? '' : good ? 'ok' : 'bad';
    return `<td class="c ${cl}">${diff > 0 ? '+' : ''}${kind === 'pp' ? diff.toFixed(1) + ' pp' : kind === 'pc2' ? diff.toFixed(2) + ' pp' : f0(diff)}</td><td class="c ${cl}">${rel == null ? '' : (rel > 0 ? '+' : '') + rel.toFixed(1) + '%'}</td>`; };
  function dualBars(rows, la, lb) { /* rows: [[label, a, b]] */ if (!rows.length) return '<div class="opa-hint">No stoppages in either period.</div>'; const mx = Math.max(...rows.flatMap(r => [r[1], r[2]]), 1);
    return rows.map(r => `<div class="opa-db"><span title="${esc(r[0])}">${esc(r[0])}</span><div><i><u style="width:${Math.max(r[1] ? 2 : 0, r[1] / mx * 100)}%;background:#2563eb"></u></i><i><u style="width:${Math.max(r[2] ? 2 : 0, r[2] / mx * 100)}%;background:#94a3b8"></u></i></div><b>${f0(r[1])}<small> / ${f0(r[2])}</small></b></div>`).join('') + `<div class="opa-leg"><span><i style="background:#2563eb"></i>${esc(la)}</span><span><i style="background:#94a3b8"></i>${esc(lb)}</span></div>`; }
  function idxChart(series, w, h) { const n = Math.max(...series.map(s => s.pts.length), 0); if (n < 2) return '<div class="opa-hint">Not enough production days in the periods.</div>'; const all = series.flatMap(s => s.pts), lo = Math.max(0, Math.floor((Math.min(...all) - .05) * 20) / 20), hi = Math.min(1.1, Math.ceil((Math.max(...all) + .02) * 20) / 20), X = i => 34 + i * (w - 44) / (n - 1), Y = v => 8 + (hi - v) / (hi - lo || 1) * (h - 28);
    const grid = [0, 1, 2, 3, 4].map(i => { const v = lo + (hi - lo) * i / 4; return `<line x1="34" x2="${w - 10}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" opacity=".12"/><text x="30" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="currentColor" opacity=".7">${Math.round(v * 100)}%</text>`; }).join('');
    const xl = Array.from({ length: n }, (_, i) => i % Math.ceil(n / 12) === 0 ? `<text x="${X(i)}" y="${h - 4}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".7">day ${i + 1}</text>` : '').join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="opa-svg">${grid}${series.map(s => `<polyline fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="4 3"' : ''} points="${s.pts.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>${s.pts.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="2.6" fill="${s.color}"><title>${esc(s.name)} · day ${i + 1} (${s.dates[i] ? dmy(s.dates[i]) : ''}): ${pc(v)}</title></circle>`).join('')}`).join('')}${xl}</svg><div class="opa-leg">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`; }
  function cmpTab() {
    const R = cmpRanges(), c = S.cmp, la = dmy(R.aF) + ' → ' + dmy(R.aT), lb = dmy(R.bF) + ' → ' + dmy(R.bT), P = [['w', '7 days vs previous 7'], ['m', '30 days vs previous 30'], ['mtd', 'Month to date vs last month'], ['pm', 'Last month vs month before'], ['x', 'Custom ranges']];
    const ctl = `<div class="opa-cmp"><div class="rp-f">${P.map(([k, t]) => `<button type="button" class="${c.p === k ? 'primary' : 'secondary'} small" data-o="cp" data-p="${k}">${t}</button>`).join('')}</div>${c.p === 'x' ? `<div class="rp-f"><label>Period A <input type="date" data-c="aF" value="${R.aF}"> → <input type="date" data-c="aT" value="${R.aT}"></label><label>Period B <input type="date" data-c="bF" value="${R.bF}"> → <input type="date" data-c="bT" value="${R.bT}"></label></div>` : ''}<div class="opa-hint"><b style="color:#2563eb">A</b> = ${la} · <b style="color:#64748b">B</b> = ${lb} · counted on production days of each line (days with no run are not counted). Presets end on the day selected above.</div></div>`;
    const blocks = LN().map(ln => { const A = periodAgg(ln, R.aF, R.aT), B = periodAgg(ln, R.bF, R.bT); if (!A.days && !B.days) return `<div class="opa-c wide"><h4><i style="background:${COL[ln]}"></i>${SHORT[ln]}</h4><div class="opa-hint">No production in either period.</div></div>`;
      const rows = [['Production days', A.days, B.days, 'n'], ['Net efficiency', A.ne, B.ne, 'pp'], ['True efficiency', A.te, B.te, 'pp'], ['Production (UOM)', A.uom, B.uom, 'n'], ['Production per day (UOM)', A.upd, B.upd, 'n'], ['Litres', A.ltr, B.ltr, 'n'], ['Run hours', A.runH, B.runH, 'n'], ['Rejection %', A.rejP, B.rejP, 'pc2', 1], ['Speed vs rated', A.spdP, B.spdP, 'pp'], ['Downtime (min)', A.dt, B.dt, 'n', 1], ['Downtime per day (min)', A.dtd, B.dtd, 'n', 1], ['  Mechanical (min)', A.mech, B.mech, 'n', 1], ['  Operational (min)', A.oper, B.oper, 'n', 1], ['Unplanned (min)', A.unpl, B.unpl, 'n', 1], ['Stops (count)', A.stops, B.stops, 'n', 1]];
      const fmt = (v, k) => k === 'pp' ? pc(v) : k === 'pc2' ? pc(v, 2) : f0(v), seq = (f, t) => { const out = []; for (let x = f; x <= t; x = shiftDay(x, 1)) { const L = lineDay(ln, x); if (L.has) out.push([x, L]); } return out; };
      const sa = seq(R.aF, R.aT), sb = seq(R.bF, R.bT);
      const chart = idxChart([{ name: 'A net', color: '#2563eb', pts: sa.map(x => x[1].ne), dates: sa.map(x => x[0]) }, { name: 'B net', color: '#94a3b8', pts: sb.map(x => x[1].ne), dates: sb.map(x => x[0]) }, { name: 'A true', color: '#2563eb', dash: 1, pts: sa.map(x => x[1].te), dates: sa.map(x => x[0]) }, { name: 'B true', color: '#94a3b8', dash: 1, pts: sb.map(x => x[1].te), dates: sb.map(x => x[0]) }], 640, 190);
      const mxu = Math.max(...sa.map(x => x[1].uom), ...sb.map(x => x[1].uom), 1), prod = `<div class="opa-pd">${[['A', sa, '#2563eb'], ['B', sb, '#94a3b8']].map(([t, q, col]) => `<div><b>${t}</b>${q.map(x => `<i title="${dmy(x[0])}: ${f0(x[1].uom)} UOM" style="height:${Math.max(3, x[1].uom / mxu * 70)}px;background:${col}"></i>`).join('')}</div>`).join('')}</div>`;
      return `<div class="opa-c wide"><h4><i style="background:${COL[ln]}"></i>${SHORT[ln]} — A vs B</h4><div class="opa-wrap" style="max-height:none"><table class="opa-t"><thead><tr><th>Measure</th><th class="c">A</th><th class="c">B</th><th class="c">Change</th><th class="c">%</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="c"><b>${fmt(r[1], r[3])}</b></td><td class="c">${fmt(r[2], r[3])}</td>${dTxt(r[1], r[2], r[3], r[4])}</tr>`).join('')}</tbody></table></div><h5 class="opa-h">Efficiency by production day <small>(day 1 = first production day of each period)</small></h5>${chart}<h5 class="opa-h">Production per day — UOM</h5>${prod}</div>`; }).join('');
    const bA = BR().filter(b => b.d >= R.aF && b.d <= R.aT), bB = BR().filter(b => b.d >= R.bF && b.d <= R.bT), cmpGrp = fn => { const m = new Map(); bA.forEach(b => { const k = fn(b) || '—', o = m.get(k) || [k, 0, 0]; o[1] += b.min; m.set(k, o); }); bB.forEach(b => { const k = fn(b) || '—', o = m.get(k) || [k, 0, 0]; o[2] += b.min; m.set(k, o); }); return [...m.values()].sort((x, y) => (y[1] + y[2]) - (x[1] + x[2])).slice(0, 10); };
    return ctl + blocks + `<div class="opa-grid"><div class="opa-c"><h4>Downtime by responsibility <small>min · A / B</small></h4>${dualBars(cmpGrp(b => b.resp), 'A', 'B')}</div><div class="opa-c"><h4>Downtime by machine <small>min · A / B</small></h4>${dualBars(cmpGrp(b => b.mc), 'A', 'B')}</div><div class="opa-c"><h4>Mechanical vs operational <small>min · A / B</small></h4>${dualBars(cmpGrp(b => /mech/i.test(b.api) ? 'Mechanical' : 'Operational'), 'A', 'B')}</div><div class="opa-c"><h4>Top issues <small>min · A / B</small></h4>${dualBars(cmpGrp(b => b.mc + ' · ' + b.cat), 'A', 'B')}</div></div>`;
  }

  /* ---------- page ---------- */

  function filters() {
    const U = window.rpUI; if (!U) return ''; const base = S.brk.filter(b => !S.f.line || b.ln === S.f.line), resp = [...new Set(base.map(b => b.resp).filter(Boolean))].sort(), mc = [...new Set(base.filter(b => !S.f.resp || b.resp === S.f.resp).map(b => b.mc).filter(Boolean))].sort();
    if (S.f.resp && !resp.includes(S.f.resp)) S.f.resp = ''; if (S.f.mc && !mc.includes(S.f.mc)) S.f.mc = '';
    const sl = (k, all, arr, cur, lab) => `<select data-f="${k}"><option value="">${all}</option>${arr.map(x => { const v = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`;
    return U.fi('Line', sl('line', 'Both lines', LINES.map(l => [l, SHORT[l]]), S.f.line)) + U.fi('Responsibility', sl('resp', 'All responsibilities', resp, S.f.resp)) + U.fi('Machine', sl('mc', 'All machines', mc, S.f.mc)) + (S.f.line || S.f.resp || S.f.mc ? '<button type="button" class="ghost small" data-o="nof" style="align-self:flex-end">✖ Clear filters</button>' : '');
  }
  function render() {
    const v = Q('#opaBody'); if (!v) return; const U = window.rpUI;
    if (!S.runs.length) { v.innerHTML = `<div class="opa-empty"><div style="font-size:42px">🏭</div><h3>Oasis AUH — production daily analysis</h3><p>Upload the <b>Oasis AUH Daily Report</b> workbook (it must contain the sheets <b>Data</b> and <b>Breakdown Data</b>). The page analyses any day: efficiency, production, rejection, stoppages, trends and repeating issues.</p><label class="opa-up">📂 Upload the daily report<input type="file" id="opaFile" accept=".xlsx,.xlsm,.xls" hidden></label>${S.busy ? '<p>Reading…</p>' : ''}</div>`; return; }
    const ds = days(); if (!S.day || !ds.length) S.day = S.meta ? S.meta.to : ds[ds.length - 1]; const d = S.day, tl = new Date(), today = tl.getFullYear() + '-' + pad(tl.getMonth() + 1) + '-' + pad(tl.getDate()), age = Math.round((Date.parse(today) - Date.parse(S.meta.to)) / 864e5);
    const stale = age >= 2 ? `<div class="opa-warn">⚠ The report ends on <b>${dmy(S.meta.to)}</b> (${age} days ago) — upload the latest workbook to see today.</div>` : '';
    const tabs = [['sum', '📊 Day summary'], ['runs', '🏭 Runs'], ['brk', '🛑 Breakdowns'], ['tr', '📈 Trend'], ['cmp', '📅 Compare periods'], ['rep', '🔁 Repeat issues']];
    v.innerHTML = `${stale}<div class="rp-f">${U ? U.fi('Day', `<span class="opa-dn2"><button type="button" class="secondary small" data-o="prev" title="Previous production day">◀</button><input type="date" data-f="day" value="${d}" min="${ds[0]}" max="${ds[ds.length - 1]}"><button type="button" class="secondary small" data-o="next" title="Next production day">▶</button></span>`) : ''}${U ? U.grp([['latest', 'Latest day'], ['yest', 'Previous day']].map(([k, t]) => `<button class="secondary small" type="button" data-o="${k}">${t}</button>`).join('')) : ''}${filters()}<label class="opa-up small">📂 Upload new report<input type="file" id="opaFile" accept=".xlsx,.xlsm,.xls" hidden></label></div>
      ${S.f.resp || S.f.mc ? '<div class="opa-warn" style="background:#e0f2fe;border-color:#38bdf8;color:#0c4a6e">🔎 Filtered stoppages: ' + esc([S.f.resp && 'responsibility ' + S.f.resp, S.f.mc && 'machine ' + S.f.mc].filter(Boolean).join(' · ')) + ' — downtime, stops, breakdowns, repeat issues and comparisons use only these stoppages; efficiency, production and rejection are for the whole line.</div>' : ''}<div class="opa-hint">${S.meta ? 'Report: <b>' + esc(S.meta.file) + '</b> · ' + dmy(S.meta.from) + ' → ' + dmy(S.meta.to) + ' · ' + S.meta.n.toLocaleString() + ' runs · ' + S.meta.nb.toLocaleString() + ' stoppages · loaded ' + new Date(S.meta.at).toLocaleString() : ''} · showing <b>${dow(d)} ${dmy(d)}</b>${ds.includes(d) ? '' : ' (no run on this day)'}</div>
      ${U ? U.tabbar(tabs.map(([k, t]) => `<button type="button" class="${S.tab === k ? 'active on' : ''}" data-t="${k}">${t}</button>`).join(''), 'data-o', '#opaBody') : ''}
      ${S.tab === 'sum' ? summary(d) : S.tab === 'runs' ? runsTab(d) : S.tab === 'brk' ? brkTab(d) : S.tab === 'tr' ? trendTab(d) : S.tab === 'cmp' ? cmpTab() : repTab(d)}`;
  }
  function rep() { const T = { sum: 'Day summary', runs: 'Runs', brk: 'Breakdowns', tr: 'Trend', rep: 'Repeat issues' }[S.tab], note = ['Oasis AUH · ' + dow(S.day) + ' ' + dmy(S.day), 'Printed ' + new Date().toLocaleString()].join(' · ');
    const tb = Q('#opaBody table.opa-t'); if (tb && typeof tblReport === 'function') return tblReport(tb, 'Oasis AUH production — ' + T, note, 'Oasis AUH ' + T);
    const rows = LINES.map(ln => lineDay(ln, S.day)).filter(x => x.has); return { title: 'Oasis AUH production — day summary', note, sheet: 'Day summary', headers: ['Line', 'Net eff %', 'True eff %', 'UOM', 'Pieces', 'Litres', 'Reject %', 'Run h', 'Downtime min'], rows: rows.map(x => [SHORT[x.ln], +(x.ne * 100).toFixed(1), +(x.te * 100).toFixed(1), Math.round(x.uom), Math.round(x.pcs), Math.round(x.ltr), +(x.rejP * 100).toFixed(2), +x.runH.toFixed(1), Math.round(x.dt)]) }; }
  function init() {
    const v = Q('#view-opa'); if (!v || v._i) return; v._i = 1; css(); restore(); if (S.meta) S.day = S.meta.to;
    v.addEventListener('change', e => { const el = e.target; if (el.id === 'opaFile') return importFile(el.files[0]); if (el.dataset.f === 'day' && el.value) { S.day = el.value; render(); } else if (el.dataset.f && ['line', 'resp', 'mc'].includes(el.dataset.f)) { S.f[el.dataset.f] = el.value; render(); } else if (el.dataset.c) { S.cmp[el.dataset.c] = el.value; render(); } });
    v.addEventListener('click', e => { const t = e.target.closest('[data-t],[data-o]'); if (!t) return; if (t.dataset.t) { S.tab = t.dataset.t; return render(); } const a = t.dataset.o, ds = days();
      if (a === 'latest') S.day = ds[ds.length - 1]; else if (a === 'yest') S.day = shiftDay(ds[ds.length - 1], -1); else if (a === 'prev') S.day = ds.filter(x => x < S.day).pop() || S.day; else if (a === 'next') S.day = ds.find(x => x > S.day) || S.day;
      else if (a === 'expand') { const tb = Q('#opaBody table.opa-t'); if (tb && window.tableExpandOpen) tableExpandOpen(tb); return; }
      else if (a === 'print' || a === 'excel' || a === 'mail') { const d = rep(); if (a === 'print') a2Print(d); else if (a === 'excel') a2Export(d); else a2Mail(rep); return; }
      else if (a === 'nof') S.f = { line: '', resp: '', mc: '' }; else if (a === 'cp') S.cmp.p = t.dataset.p; else if (a === 'clear') { if (confirm('Remove the stored report from this device?')) { S.runs = []; S.brk = []; S.meta = null; try { localStorage.removeItem(KEY); } catch (x) { } say(''); } }
      render(); });
    render();
  }
  function css() { if (Q('#opaCss')) return; const c = document.createElement('style'); c.id = 'opaCss'; c.textContent = `#view-opa .opa-hint{font-size:12px;color:var(--gray-600);margin:8px 0}#view-opa .opa-warn{background:#fef3c7;border:1px solid #f59e0b;color:#78350f;border-radius:10px;padding:8px 14px;margin-bottom:8px;font-size:13px}
#view-opa .opa-empty{text-align:center;padding:40px 16px;max-width:560px;margin:auto}#view-opa .opa-up{display:inline-block;cursor:pointer;background:var(--accent,#2563eb);color:#fff;border-radius:10px;padding:10px 18px;font-weight:700;font-size:14px}#view-opa .opa-up.small{padding:6px 12px;font-size:12.5px;align-self:flex-end}
#view-opa .opa-dn2{display:inline-flex;gap:4px;align-items:center}#view-opa .opa-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}#view-opa .opa-k{border:1px solid var(--border);border-radius:12px;padding:8px 14px;background:var(--card,#fff)}#view-opa .opa-k span{font-size:12px;color:var(--gray-600);display:block}#view-opa .opa-k b{font-size:21px}#view-opa .opa-k small{display:block;font-size:11px;color:var(--gray-600)}
#view-opa .opa-d{display:inline;font-weight:700;margin-right:3px}#view-opa .opa-d.g{color:#15803d}#view-opa .opa-d.b{color:#b91c1c}
#view-opa .opa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px;margin-top:10px}#view-opa .opa-c{border:1px solid var(--border);border-radius:14px;padding:12px 14px;min-width:0;background:var(--card,#fff)}#view-opa .opa-c.wide{margin-top:10px}#view-opa .opa-c h4,#view-opa .opa-ins h4{margin:0 0 6px;font-size:14px}#view-opa .opa-c h4 small{font-weight:400;color:var(--gray-600)}#view-opa .opa-c h4 i,#view-opa .opa-leg i,#view-opa .opa-dn i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}#view-opa .opa-h{margin:14px 0 6px;font-size:14px}
#view-opa .opa-ins{border:1px solid var(--border);border-left:5px solid #2563eb;border-radius:12px;padding:10px 16px;background:var(--card,#fff)}#view-opa .opa-i{font-size:13.5px;margin:5px 0;line-height:1.4}#view-opa .opa-i.b{color:#b91c1c}#view-opa .opa-i.g{color:#15803d}
#view-opa .opa-svg{width:100%;height:auto;max-height:230px}#view-opa .opa-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;margin-top:4px}#view-opa .opa-dn{display:flex;gap:14px;align-items:center;font-size:12.5px}#view-opa .opa-dn>div>div{margin:3px 0}
#view-opa .opa-hb{display:grid;grid-template-columns:130px 1fr 64px;gap:8px;align-items:center;font-size:12.5px;margin:4px 0}#view-opa .opa-hb span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#view-opa .opa-hb i{background:var(--gray-100,#f1f5f9);border-radius:6px;height:12px;display:block}#view-opa .opa-hb u{display:block;height:100%;border-radius:6px}#view-opa .opa-hb b{text-align:right}
#view-opa .opa-wrap{overflow:auto;max-height:68vh;margin-top:8px}#view-opa table.opa-t{border-collapse:collapse;width:100%;font-size:12.5px}#view-opa .opa-t th{position:sticky;top:0;background:var(--gray-100,#eef2f7);text-align:left;padding:7px 9px;font-size:11.5px;white-space:nowrap}#view-opa .opa-t td{padding:6px 9px;border-top:1px solid var(--border)}#view-opa .opa-t .c{text-align:center}#view-opa .opa-t td.bad{color:#b91c1c;font-weight:700}#view-opa .opa-t td.ok{color:#15803d;font-weight:700}#view-opa .opa-db{display:grid;grid-template-columns:150px 1fr 92px;gap:8px;align-items:center;font-size:12.5px;margin:6px 0}#view-opa .opa-db span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#view-opa .opa-db>div i{display:block;background:var(--gray-100,#f1f5f9);border-radius:5px;height:8px;margin:2px 0}#view-opa .opa-db u{display:block;height:100%;border-radius:5px}#view-opa .opa-db b{text-align:right}#view-opa .opa-db small{font-weight:400;color:var(--gray-600)}#view-opa .opa-pd{display:flex;gap:18px;flex-wrap:wrap}#view-opa .opa-pd>div{display:flex;align-items:flex-end;gap:2px;min-height:76px}#view-opa .opa-pd b{align-self:center;margin-right:4px}#view-opa .opa-pd i{display:block;width:9px;border-radius:2px 2px 0 0}#view-opa .opa-cmp label{font-size:12.5px;display:inline-flex;gap:6px;align-items:center}#view-opa .opa-p{border-radius:99px;padding:1px 9px;font-size:11px;font-weight:700;background:#e2e8f0}#view-opa .opa-p.r{background:#fee2e2;color:#991b1b}`; document.head.appendChild(c); }
  function mount() {
    if (!Q('#view-opa')) { const ref = Q('#view-whtmp'); const d = document.createElement('div'); d.className = 'view'; d.id = 'view-opa';
      d.innerHTML = `<div class="card" id="opaCard"><div class="card-header"><div class="card-title">🏭 Oasis AUH Production <span class="text-sm" style="font-weight:400;">— daily analysis of the Oasis AUH Daily Report · efficiency, production, rejection, stoppages, trends</span></div><div class="btn-row"><button class="secondary small" type="button" data-o="clear" title="Remove the stored report from this device">🗑 Clear</button></div></div><div id="opaStatus" class="status-msg" style="font-size:12px;margin-bottom:6px"></div><div id="opaBody"></div></div>`;
      if (ref) ref.insertAdjacentElement('afterend', d); else document.body.appendChild(d); }
    if (!Q('.nav-item[data-view="opa"]')) { const ref = Q('.nav-item[data-view="whtmp"]'); if (ref) { const n = document.createElement('div'); n.className = 'nav-item'; n.dataset.view = 'opa'; n.dataset.perm = 'mgw'; n.innerHTML = '<span class="icon">🏭</span><span>Oasis Production Daily</span><span class="badge new">NEW</span>'; ref.insertAdjacentElement('afterend', n); } }
    try { const el = Q('.nav-item[data-view="opa"]'); if (el && typeof navOrig !== 'undefined' && navOrig && !navMeta.opa) { navMeta.opa = { el, name: 'Oasis Production Daily' }; const g = navOrig.groups.find(x => x.items.includes('whtmp')); if (g && !g.items.includes('opa')) g.items.splice(g.items.indexOf('whtmp') + 1, 0, 'opa'); navApply(true); } } catch (e) { }
    const nav = Q('.nav-item[data-view="opa"]'); if (nav && !nav._fe) { nav._fe = 1; nav.addEventListener('click', () => init()); }
  }
  mount(); window.OPA = { S, render, importFile };
})();
