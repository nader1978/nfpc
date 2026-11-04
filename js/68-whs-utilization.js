/* ============================================================
   WHs UTILIZATION — its own page, read directly from Daily_Meeting_Report_Data_tbl
   the list is "long": one row per Record_Date · WHs_ID / WHs_Dtls · storage area (Second_Sector) · measure (Third_Sector = 1-Capacity / 2-Actual / 3-Free),
   the value in Totals, only rows of Data_Main_Sector "…WHs Capacity Status". A re-posted day (higher Header_ID) replaces the older one.
   Only the chosen period is downloaded (default the last 7 days) — filtered on Record_Date by SharePoint.
   ============================================================ */
(function () {
  const LIST = 'Daily_Meeting_Report_Data_tbl', Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nz = x => String(x || '').toLowerCase().replace(/_x0020_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dt = v => { if (!v) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v); const d = new Date(v); return isNaN(d) ? '' : ymd(d); };
  const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const nn = v => { if (v == null || v === '') return null; if (typeof v === 'object') v = v.Value; const n = Number(String(v).replace(/[,\s%]/g, '')); return isFinite(n) ? n : null; };
  const sv = v => v == null ? '' : typeof v === 'object' ? String(v.Value ?? v.LookupValue ?? v.Title ?? '').trim() : String(v).trim();
  const F = n => plF(Math.round(n)), P = v => v == null ? '—' : plF(v, 1) + '%', avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const C = { date: 'Record_Date', whid: 'WHs_ID', wh: 'WHs_Dtls', main: 'Data_Main_Sector', sec: 'Second_Sector', kind: 'Third_Sector', val: 'Totals', hdr: 'Header_ID' };
  const today = ymd(new Date());
  const S = { loaded: false, loading: false, err: '', raw: 0, rows: [], per: { from: shift(today, -6), to: today }, how: '', f: { from: '', to: '', wh: '', sec: '', by: 'wh', unit: 'pct' } };
  const say = (t, w) => { const e = Q('#whuStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };

  /* ---------- reading: only the period (Record_Date) ---------- */
  async function fetchPeriod(site, token, from, to) {
    const ids = await resolveIds(site, LIST, token), lo = shift(from, -1) + 'T00:00:00Z', hi = shift(to, 1) + 'T23:59:59Z';
    try { const it = await exp_fetchFilteredItems(ids.siteId, ids.listId, token, `fields/${C.date} ge '${lo}' and fields/${C.date} le '${hi}'`, n => say('Reading ' + LIST + ' (' + from + ' → ' + to + ')… ' + (n && n.length != null ? n.length : n)));
      S.how = 'only ' + from + ' → ' + to + ' downloaded'; return it; }
    catch (e) { say('⚠ SharePoint would not filter by ' + C.date + ' (' + e.message.slice(0, 90) + ') — reading the whole list…', 1);
      const it = await fetchAllItems(ids.siteId, ids.listId, token, n => say('Reading the whole ' + LIST + '… ' + (n && n.length != null ? n.length : n))); S.how = 'whole list read — index the Record_Date column for faster loading'; return it; }
  }
  function build(items) {
    const best = new Map();
    items.forEach(x => { const f = x.fields || {}, K = {}; Object.keys(f).forEach(k => { K[nz(k)] = f[k]; });
      const main = sv(K[nz(C.main)]); if (main && !/capacity/i.test(main)) return;
      const date = dt(K[nz(C.date)]); if (!date || date < S.per.from || date > S.per.to) return;
      const whid = sv(K[nz(C.whid)]).replace(/\.0+$/, ''), wh = sv(K[nz(C.wh)]) || (whid ? 'WHs ' + whid : ''), sec = sv(K[nz(C.sec)]) || wh, kind = sv(K[nz(C.kind)]).toLowerCase(), v = nn(K[nz(C.val)]);
      if (!wh || v == null) return; const m = /capac/.test(kind) ? 'cap' : /actual|used|occup/.test(kind) ? 'used' : /free|empty/.test(kind) ? 'free' : ''; if (!m) return;
      const key = [date, whid || wh, sec, m].join('|'), h = nn(K[nz(C.hdr)]) || 0, id = +x.id || 0, o = best.get(key);
      if (!o || h > o.h || (h === o.h && id > o.id)) best.set(key, { date, whid, wh, sec, m, v, h, id }); });
    const A = new Map(); best.forEach(o => { const k = [o.date, o.whid || o.wh, o.sec].join('|'); let r = A.get(k); if (!r) A.set(k, r = { date: o.date, whid: o.whid, wh: o.wh, sec: o.sec, cap: null, used: null, free: null }); r[o.m] = o.v; });
    S.rows = [...A.values()].map(r => { if (r.used == null && r.cap != null && r.free != null) r.used = r.cap - r.free; if (r.cap == null && r.used != null && r.free != null) r.cap = r.used + r.free; if (r.free == null && r.cap != null && r.used != null) r.free = r.cap - r.used; return r; }).filter(r => r.cap != null || r.used != null);
    S.raw = items.length; const ds = S.rows.map(r => r.date).sort(); S.f.from = ds[0] || S.per.from; S.f.to = ds[ds.length - 1] || S.per.to;
    if (S.f.wh && !S.rows.some(r => r.wh === S.f.wh)) S.f.wh = ''; if (S.f.sec && !S.rows.some(r => r.sec === S.f.sec)) S.f.sec = '';
  }
  async function load() {
    if (S.loading) return; S.loading = true; S.err = ''; render();
    try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first (no token / Site URL)');
      if (S.per.from > S.per.to) throw new Error('the period From is after To'); const t0 = Date.now(), it = await fetchPeriod(site, token, S.per.from, S.per.to); build(it); S.loaded = true;
      const n = new Set(S.rows.map(r => r.wh)).size;
      say(S.rows.length ? '✔ ' + plF(S.rows.length) + ' storage-area day(s) · ' + n + ' warehouse(s) · ' + S.how + ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s' : '⚠ No WHs capacity data between ' + S.per.from + ' and ' + S.per.to + ' — choose an earlier period and press ⬇ Load', !S.rows.length);
    } catch (e) { S.err = e.message; say('⚠ ' + e.message, 1); } finally { S.loading = false; } render();
  }

  /* ---------- model: a "unit" is a warehouse or a storage area (View by) ---------- */
  const inF = r => (!S.f.wh || r.wh === S.f.wh) && (!S.f.sec || r.sec === S.f.sec) && (!S.f.from || r.date >= S.f.from) && (!S.f.to || r.date <= S.f.to);
  const ukey = r => S.f.by === 'sec' ? r.sec : r.wh;
  function units(mode) {
    const R = S.rows.filter(r => (!S.f.wh || r.wh === S.f.wh) && (!S.f.sec || r.sec === S.f.sec)), by = new Map();
    R.forEach(r => { const k = ukey(r); let u = by.get(k); if (!u) by.set(k, u = { k, wh: r.wh, whid: r.whid, secs: new Set(), days: new Map() }); u.secs.add(r.sec); let d = u.days.get(r.date); if (!d) u.days.set(r.date, d = { cap: 0, used: 0, n: 0 }); d.cap += r.cap || 0; d.used += r.used || 0; d.n++; });
    const out = []; by.forEach(u => { let D, lab = '';
      if (mode === 'avg') { D = [...u.days.entries()].filter(([d]) => (!S.f.from || d >= S.f.from) && (!S.f.to || d <= S.f.to)); const ds = D.map(x => x[0]).sort(); lab = ds.length ? (ds.length > 1 ? ds[0] + ' → ' + ds[ds.length - 1] + ' (' + ds.length + ' d)' : ds[0]) : ''; }
      else { const ds = [...u.days.keys()].filter(d => !S.f.to || d <= S.f.to).sort(), last = ds[ds.length - 1]; D = last ? [[last, u.days.get(last)]] : []; lab = last || ''; }
      if (!D.length) return; const cap = avg(D.map(x => x[1].cap)), used = avg(D.map(x => x[1].used));
      out.push({ k: u.k, wh: u.wh, whid: u.whid, secs: [...u.secs].sort(mdpNat), cap, used, free: cap - used, u: cap > 0 ? used / cap * 100 : null, d: lab, last: mode === 'to' ? lab : '' }); });
    return out.sort((a, b) => mdpNat(a.wh + '|' + a.k, b.wh + '|' + b.k)); }
  const tot = W => { const cap = W.reduce((a, w) => a + w.cap, 0), used = W.reduce((a, w) => a + w.used, 0); return { cap, used, free: cap - used, u: cap > 0 ? used / cap * 100 : null }; };
  const uCol = u => u == null ? '#64748b' : u > 100 ? '#991b1b' : u >= 90 ? '#dc2626' : u >= 75 ? '#f59e0b' : '#16a34a';

  /* ---------- charts ---------- */
  function capChart(host, mode) {
    if (!S.loaded) return plEmpty(host, 'Loading…'); const W = units(mode).filter(w => w.cap > 0 || w.used > 0); if (!W.length) return plEmpty(host, 'No data for the filters.');
    const G = W.slice().sort((a, b) => (b.u || 0) - (a.u || 0)).slice(0, 60), T = plT(), t = tot(W), late = mode === 'to' ? W.filter(w => w.d !== S.f.to).length : 0, over = W.filter(w => w.free < 0).length, pct = S.f.unit !== 'pal';
    const sr = [{ name: mode === 'avg' ? 'Used (average)' : 'Used', color: mode === 'avg' ? T.series[0] : T.series[1] }, { name: 'Free', color: T.good || '#16a34a' }, { name: 'Over capacity', color: '#b91c1c' }];
    const rows = G.map(w => { const u = w.u || 0; return { label: w.k, w, vals: pct ? [Math.min(u, 100), Math.max(0, 100 - u), Math.max(0, u - 100)] : [Math.min(w.used, w.cap), Math.max(0, w.free), Math.max(0, w.used - w.cap)] }; });
    let ix = 0; const lab = w => plF(w.u || 0, 0) + '% · ' + (w.free < 0 ? 'over ' + F(-w.free) : F(w.free) + ' free') + ' / ' + F(w.cap);
    plcBarsH(host, { rows, series: sr, stacked: true, fmt: v => pct ? plF(v, 1) + '%' : F(v), tickFmt: v => pct ? plF(v, 0) + '%' : plF(v), minMax: pct ? 100 : 0, padR: 190, thick: 16, totalFmt: () => lab(rows[ix++].w) });
    const legend = sr.filter((s, k) => k < 2 || over).map(s => ({ name: s.name, c: s.color })).concat([{ name: 'capacity ' + F(t.cap) + ' · used ' + F(t.used) + ' · free ' + F(t.free) + ' · ' + P(t.u) + (late ? ' · ' + late + ' from an earlier date' : '') + (W.length > G.length ? ' · first ' + G.length + ' shown' : ''), c: 'transparent' }]);
    return { legend, table: { headers: [S.f.by === 'sec' ? 'Storage area' : 'WHs', 'WHs', 'Capacity', 'Used', 'Free pallets', 'Utilization %', mode === 'avg' ? 'Dates' : 'Date used'], rows: G.map(w => [w.k, w.wh, Math.round(w.cap), Math.round(w.used), Math.round(w.free), w.u == null ? '' : Math.round(w.u * 10) / 10, w.d]) } };
  }
  function trend(host) {
    if (!S.loaded) return plEmpty(host, 'Loading…'); const R = S.rows.filter(inF); if (!R.length) return plEmpty(host, 'No data for the filters.');
    const D = [...new Set(R.map(r => r.date))].sort(), Ks = [...new Set(R.map(ukey))].sort(mdpNat), T = plT(), val = L => { const c = L.reduce((a, r) => a + (r.cap || 0), 0); return c > 0 ? L.reduce((a, r) => a + (r.used || 0), 0) / c * 100 : null; };
    const series = [{ name: 'All selected', color: T.text || '#111827', vals: D.map(d => val(R.filter(r => r.date === d))) }].concat((Ks.length > 10 ? [] : Ks).map((k, i) => ({ name: k, color: T.series[i % T.series.length], vals: D.map(d => { const L = R.filter(r => r.date === d && ukey(r) === k); return L.length ? val(L) : null; }) })));
    plcLine(host, { x: D.map(d => d.slice(5)), series, fmt: P, tickFmt: v => plF(v, 0) + '%', height: 280, ref: 100, refLabel: 'capacity' });
    return { legend: series.map(s => ({ name: s.name, c: s.color })).concat(Ks.length > 10 ? [{ name: Ks.length + ' lines — pick a WHs to see each storage area', c: 'transparent' }] : []), table: { headers: ['Date', ...series.map(s => s.name + ' %')], rows: D.map((d, i) => [d, ...series.map(s => s.vals[i] == null ? '' : Math.round(s.vals[i] * 10) / 10)]) } };
  }
  const DEFS = [
    { id: 'avg', title: 'Utilization vs capacity — average', sub: 'average used and free pallets against the capacity over the date filter · fullest first', span: 's6', draw: h => capChart(h, 'avg') },
    { id: 'to', title: 'Utilization vs capacity — To date', sub: 'used and free pallets on the “To” date (latest entry on or before it) · fullest first', span: 's6', draw: h => capChart(h, 'to') },
    { id: 'trend', title: 'Utilization % by day', sub: 'used ÷ capacity for each day of the date filter', span: 's12', draw: h => trend(h) }];

  /* ---------- table: by storage area ---------- */
  function tableData() {
    const keep = S.f.by; S.f.by = 'sec'; const A = new Map(units('avg').map(w => [w.wh + '|' + w.k, w])), Tt = units('to'); S.f.by = keep;
    const keys = [...new Set([...A.keys(), ...Tt.map(w => w.wh + '|' + w.k)])].sort(mdpNat), TT = new Map(Tt.map(w => [w.wh + '|' + w.k, w])), r1 = v => v == null ? '' : Math.round(v * 10) / 10, r0 = v => v == null ? '' : Math.round(v);
    const rows = keys.map(k => { const a = A.get(k) || {}, t = TT.get(k) || {}, b = a.k ? a : t; return [b.wh, b.whid, b.k, r0(a.cap), r0(a.used), r0(a.free), r1(a.u), t.d || '', r0(t.cap), r0(t.used), r0(t.free), r1(t.u)]; });
    const ta = tot([...A.values()]), tt = tot(Tt);
    return { title: 'WHs Utilization vs capacity', sheet: 'WHs Utilization', note: (S.f.from || '…') + ' → ' + (S.f.to || '…') + (S.f.wh ? ' · ' + S.f.wh : '') + (S.f.sec ? ' · ' + S.f.sec : ''), headers: ['WHs', 'WHs_ID', 'Storage area', 'Avg capacity', 'Avg used', 'Avg free pallets', 'Avg utilization %', 'To date', 'Capacity', 'Used', 'Free pallets', 'Utilization %'], rows,
      totals: ['TOTAL', '', keys.length + ' area(s)', r0(ta.cap), r0(ta.used), r0(ta.free), r1(ta.u), S.f.to, r0(tt.cap), r0(tt.used), r0(tt.free), r1(tt.u)] }; }
  function tbl() { const h = Q('#whuTbl'); if (!h) return; if (!S.loaded) { h.innerHTML = ''; return; } const d = tableData(), f = v => typeof v === 'number' ? plF(v, v % 1 ? 1 : 0) : esc(v), num = i => i > 2 && i !== 7, pc = i => i === 6 || i === 11;
    const cell = (v, i) => pc(i) && v !== '' ? `<span class="whu-u" style="--u:${Math.min(100, Math.max(0, v))}%;--c:${uCol(v)}">${f(v)}%</span>` : (i === 5 || i === 10) && v !== '' && v < 0 ? `<b style="color:#b91c1c">${f(v)}</b>` : f(v);
    h.innerHTML = `<div class="whu-wrap"><table class="pl-tbl whu-t"><thead><tr>${d.headers.map((x, i) => `<th class="${num(i) ? 'n' : ''}">${esc(x)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r => `<tr>${r.map((v, i) => `<td class="${num(i) ? 'n' : ''}">${cell(v, i)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr>${d.totals.map((v, i) => `<td class="${num(i) ? 'n' : ''}"><b>${pc(i) && v !== '' ? f(v) + '%' : f(v)}</b></td>`).join('')}</tr></tfoot></table></div>`; }
  function kpis() { const Tt = units('to'), t = tot(Tt), a = tot(units('avg')), K = (l, v, s, c) => `<div class="pl-kpi" style="border-left:4px solid ${c}"><div class="lbl">${esc(l)}</div><div class="val">${v}</div><div class="sub">${s || ''}</div></div>`;
    const keep = S.f.by; S.f.by = 'sec'; const secs = units('to'); S.f.by = keep; const over = secs.filter(w => w.free < 0), full = secs.filter(w => w.u != null).sort((x, y) => y.u - x.u)[0];
    return K('Capacity', F(t.cap), 'pallets · ' + esc(S.f.to || '—'), '#2563eb') + K('Used pallets', F(t.used), 'on the To date', '#ea580c') + K('Free pallets', F(t.free), 'capacity − used', '#16a34a')
      + K('Utilization (To date)', P(t.u), Tt.length + (S.f.by === 'sec' ? ' storage area(s)' : ' warehouse(s)'), uCol(t.u)) + K('Average utilization', P(a.u), esc(S.f.from || '…') + ' → ' + esc(S.f.to || '…'), uCol(a.u))
      + K('Storage areas over capacity', String(over.length), over.length ? over.slice(0, 3).map(w => esc(w.k) + ' ' + plF(w.u, 0) + '%').join(' · ') : 'no storage area above 100%', over.length ? '#991b1b' : '#16a34a')
      + K('Fullest storage area', full ? esc(full.k) : '—', full ? esc(full.wh) + ' · ' + P(full.u) : '', '#7c3aed'); }
  function bar() {
    const R = S.rows, W = [...new Set(R.map(r => r.wh))].sort(mdpNat), Sc = [...new Set(R.filter(r => !S.f.wh || r.wh === S.f.wh).map(r => r.sec))].sort(mdpNat), ds = [...new Set(R.map(r => r.date))].sort();
    const sel = (k, l, L) => `<div class="form-group"><label>${l}</label><select data-wf="${k}"><option value="">All</option>${L.map(v => `<option${v === S.f[k] ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`;
    return `<div class="whu-load"><b>⬇ Download period</b><input type="date" data-wp="from" value="${S.per.from}"><span>→</span><input type="date" data-wp="to" value="${S.per.to}"><button class="small" type="button" data-wu="load">⬇ Load</button>
        <span class="whu-q"><button class="ghost small" type="button" data-wu="p-7">Last 7 days</button><button class="ghost small" type="button" data-wu="p-14">14 days</button><button class="ghost small" type="button" data-wu="p-m0">This month</button><button class="ghost small" type="button" data-wu="p-m1">Last month</button></span>
        <span class="whu-hint">only this period is downloaded from SharePoint — keep it short for fast loading</span></div>
      ${S.loaded && R.length ? `<div class="whu-f"><div class="form-group"><label>From</label><input type="date" data-wf="from" value="${S.f.from}" min="${ds[0]}" max="${ds[ds.length - 1]}"></div><div class="form-group"><label>To</label><input type="date" data-wf="to" value="${S.f.to}" min="${ds[0]}" max="${ds[ds.length - 1]}"></div>
        <div class="whu-q"><button class="secondary small" type="button" data-wu="q-last">Latest day</button><button class="secondary small" type="button" data-wu="q-all">All loaded days</button></div>
        <div class="form-group"><label>View by</label><select data-wf="by"><option value="wh"${S.f.by === 'wh' ? ' selected' : ''}>Warehouse</option><option value="sec"${S.f.by === 'sec' ? ' selected' : ''}>Storage area</option></select></div>
        <div class="form-group"><label>Bars</label><select data-wf="unit"><option value="pct"${S.f.unit !== 'pal' ? ' selected' : ''}>% of capacity</option><option value="pal"${S.f.unit === 'pal' ? ' selected' : ''}>Pallets</option></select></div>
        ${sel('wh', 'Warehouse (WHs_Dtls)', W)}${sel('sec', 'Storage area (Second_Sector)', Sc)}</div>` : ''}`; }
  function render() {
    const b = Q('#whuBody'); if (!b) return; b.innerHTML = bar() + (S.loading ? '<div class="whu-hint">Reading ' + LIST + ' (' + S.per.from + ' → ' + S.per.to + ')…</div>' : !S.loaded && S.err ? '<div class="whu-hint">⚠ ' + esc(S.err) + '</div>' : '');
    const ok = S.loaded && S.rows.length; Q('#whuKpis').innerHTML = ok ? kpis() : ''; ['#whuGrid', '#whuTblCard', '#whuKpis'].forEach(s => { const e = Q(s); if (e) e.style.display = ok ? '' : 'none'; });
    if (ok) { atDrawGrid(Q('#whuGrid'), DEFS, { rows: () => null }); tbl(); } }
  function period(p) { const d = new Date(); if (p === '7') { S.per.from = shift(today, -6); S.per.to = today; } else if (p === '14') { S.per.from = shift(today, -13); S.per.to = today; } else if (p === 'm0') { S.per.from = ymd(new Date(d.getFullYear(), d.getMonth(), 1)); S.per.to = today; } else if (p === 'm1') { S.per.from = ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)); S.per.to = ymd(new Date(d.getFullYear(), d.getMonth(), 0)); } load(); }
  function init() {
    const v = Q('#view-whu'); if (!v || v._i) return; v._i = 1; v.querySelectorAll('[data-wu="cols"]').forEach(x => x.remove());
    const css = document.createElement('style'); css.textContent = `#view-whu .whu-load{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px 10px;border:1px dashed var(--border);border-radius:10px;margin-bottom:10px;font-size:13px}#view-whu .whu-load input{width:auto;margin:0}
#view-whu .whu-f{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}#view-whu .whu-f .form-group{margin:0;min-width:160px}#view-whu .whu-f select,#view-whu .whu-f input{margin:0}#view-whu .whu-q{display:inline-flex;gap:6px;flex-wrap:wrap;padding-bottom:2px}
#view-whu .whu-hint{font-size:12px;color:var(--gray-600);padding:4px 2px}#view-whu .whu-wrap{overflow:auto;max-height:65vh}#view-whu .whu-t th{position:sticky;top:0;z-index:1;white-space:nowrap}#view-whu .whu-t tfoot td{border-top:2px solid var(--border);background:var(--gray-50,#f8fafc)}
#view-whu .whu-u{display:inline-block;min-width:70px;padding:1px 6px;border-radius:6px;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 30%,transparent) var(--u),transparent var(--u));font-weight:700}`; document.head.appendChild(css);
    v.addEventListener('click', e => { const t = e.target.closest('[data-wu]'); if (!t) return; const a = t.dataset.wu;
      if (a === 'reload' || a === 'load') return load(); if (a.startsWith('p-')) return period(a.slice(2));
      if (a === 'q-last' || a === 'q-all') { const ds = S.rows.map(r => r.date).sort(); S.f.to = ds[ds.length - 1] || ''; S.f.from = a === 'q-last' ? S.f.to : ds[0] || ''; return render(); }
      if (a === 'print' || a === 'excel' || a === 'mail') { if (!S.loaded || !S.rows.length) return sectionToast('Nothing loaded yet.', 'warn'); if (a === 'print') a2Print(tableData()); else if (a === 'excel') a2Export(tableData()); else a2Mail(tableData); return; }
      if (a === 'expand') { const tb = Q('#whuTbl table'); if (tb && window.tableExpandOpen) tableExpandOpen(tb); } });
    v.addEventListener('change', e => { const k = e.target.dataset.wf, p = e.target.dataset.wp; if (p) { S.per[p] = e.target.value; return; } if (!k) return; S.f[k] = e.target.value; if (k === 'wh') S.f.sec = ''; render(); });
    try { visInit({ pre: 'whu', view: 'whu', grid: '#whuGrid', kpis: '#whuKpis', table: '#whuTblCard', redraw: () => { if (S.loaded && S.rows.length) atDrawGrid(Q('#whuGrid'), DEFS, { rows: () => null }); } }); } catch (e) { console.error(e); }
    window.addEventListener('resize', () => { if (Q('#view-whu.active') && S.loaded && S.rows.length) atDrawGrid(Q('#whuGrid'), DEFS, { rows: () => null }); });
    render();
  }
  const nav = Q('.nav-item[data-view="whu"]'); if (nav) nav.addEventListener('click', () => { init(); if (!S.loaded && !S.loading) setTimeout(load, 50); });
  const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (typeof activeViewId === 'function' && activeViewId() === 'whu') { e.stopImmediatePropagation(); load(); } }, true);
  window.WHUX = { S, build, render, init };
})();
