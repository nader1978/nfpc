/* ============================================================
   WHs UTILIZATION — its own page, read directly from Daily_Meeting_Report_Data_tbl
   capacity · used · free pallets · utilization %  — average over the date filter, on the "To" date, trend by day
   filters come from the list itself (date, Area, Region, WHs), so nothing depends on another list
   ============================================================ */
(function () {
  const LIST = 'Daily_Meeting_Report_Data_tbl', Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nz = x => String(x || '').toLowerCase().replace(/_x0020_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dt = v => { if (!v) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v); const d = new Date(v); return isNaN(d) ? '' : ymd(d); };
  const nn = v => { if (v == null || v === '') return null; if (typeof v === 'object') v = v.Value; const n = Number(String(v).replace(/[,\s%]/g, '')); return isFinite(n) ? n : null; };
  const sv = v => v == null ? '' : typeof v === 'object' ? String(v.Value ?? v.LookupValue ?? v.Title ?? '').trim() : String(v).trim();
  const F = n => plF(n), P = v => v == null ? '—' : plF(v, 1) + '%', avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const FIELDS = [
    ['date', 'Date *', ['entrydate', 'reportdate', 'meetingdate', 'recorddate', 'transdate', 'utilizationdate', 'date', 'day']],
    ['whid', 'WHs_ID', ['whsid', 'whid', 'warehouseid', 'whsno', 'whno']],
    ['wh', 'WHs name / description', ['whsdesc', 'whdesc', 'whsname', 'whname', 'warehousename', 'warehouse', 'whs', 'locationdesc']],
    ['area', 'Area (Region_Desc)', ['regiondesc', 'areadesc', 'area', 'region']],
    ['region', 'Region (BU_Decs)', ['budecs', 'budesc', 'bu', 'regions', 'businessunit', 'regioncode']],
    ['cap', 'WHs capacity (pallets)', ['whscapacity', 'whcapacity', 'palletcapacity', 'totalcapacity', 'totalpositions', 'capacitypallets', 'capacity']],
    ['used', 'Used / occupied pallets', ['usedpallets', 'occupiedpallets', 'occupiedpositions', 'usedpositions', 'usedcapacity', 'palletsstored', 'stockpallets', 'occupied', 'used']],
    ['free', 'Free pallets', ['freepallets', 'freepositions', 'emptypositions', 'emptypallets', 'freecapacity', 'free', 'empty']],
    ['util', 'Utilization %', ['whsutilization', 'whutilization', 'whsutilisation', 'utilizationpct', 'utilisationpct', 'utilization', 'utilisation', 'util', 'occupancy']],
    ['loc', 'Location_ID (scope)', ['locationid', 'locid']]];
  const MK = () => LS_BASE + '_whu_map', mapGet = () => { try { return JSON.parse(localStorage.getItem(MK()) || '{}') || {}; } catch (e) { return {}; } };
  const S = { loaded: false, loading: false, err: '', raw: [], keys: [], map: {}, rows: [], f: { from: '', to: '', area: '', region: '', wh: '', by: 'wh' }, frac: false };
  const say = (t, w) => { const e = Q('#whuStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };

  function autoMap(keys) { const m = Object.assign({}, mapGet()), used = new Set(Object.values(m));
    FIELDS.forEach(([k, , al]) => { if (m[k] && keys.includes(m[k])) return; let hit = null; for (const pass of [0, 1]) { hit = al.map(a => keys.find(x => !used.has(x) && (pass ? (a.length >= 4 && x.includes(a)) : x === a))).find(Boolean); if (hit) break; } if (hit) { m[k] = hit; used.add(hit); } else delete m[k]; });
    return m; }
  function build() {
    const M = S.map, g = (K, k) => M[k] ? K[M[k]] : undefined, out = [];
    S.raw.forEach(K => { const date = dt(g(K, 'date')); if (!date) return; const whid = sv(g(K, 'whid')).replace(/\.0+$/, ''), wh = sv(g(K, 'wh')) || (whid ? 'WHs ' + whid : ''); if (!wh) return;
      out.push({ date, whid, wh, area: sv(g(K, 'area')), region: sv(g(K, 'region')), cap: nn(g(K, 'cap')), used: nn(g(K, 'used')), free: nn(g(K, 'free')), util: nn(g(K, 'util')), loc: sv(g(K, 'loc')) }); });
    const U = out.filter(r => r.util != null); S.frac = U.length > 0 && U.every(r => Math.abs(r.util) <= 1.5); if (S.frac) U.forEach(r => { r.util *= 100; });
    out.forEach(r => { if (r.used == null && r.cap > 0 && r.free != null) r.used = r.cap - r.free; if (r.used == null && r.cap > 0 && r.util != null) r.used = r.util / 100 * r.cap;
      if (r.cap == null && r.used != null && r.free != null) r.cap = r.used + r.free; if (r.cap == null && r.used != null && r.util > 0) r.cap = r.used / (r.util / 100);
      if (r.free == null && r.cap != null && r.used != null) r.free = r.cap - r.used; r.u = r.cap > 0 && r.used != null ? r.used / r.cap * 100 : r.util; });
    const scoped = typeof locScoped === 'function' && locScoped() && M.loc ? new Set(locIds(currentUser).map(x => String(+x))) : null;
    S.rows = scoped ? out.filter(r => scoped.has(String(+r.loc))) : out;
    const ds = S.rows.map(r => r.date).sort(); if (!S.f.to || !ds.includes(S.f.to) && S.f.to > ds[ds.length - 1]) { const last = ds[ds.length - 1] || ''; S.f.to = last; S.f.from = last ? last.slice(0, 8) + '01' : ''; }
  }
  async function load(force) {
    if (S.loading || (S.loaded && !force)) return; S.loading = true; S.err = ''; render();
    try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first (no token / Site URL)');
      say('Reading ' + LIST + '…'); const ids = await resolveIds(site, LIST, token), it = await fetchAllItems(ids.siteId, ids.listId, token, n => say('Reading ' + LIST + '… ' + n));
      S.raw = it.map(x => { const f = x.fields || {}, K = {}; Object.keys(f).forEach(k => { if (!/^@|^_|odata/i.test(k)) K[nz(k)] = f[k]; }); return K; });
      const ks = new Set(); S.raw.slice(0, 400).forEach(K => Object.keys(K).forEach(k => ks.add(k))); S.keys = [...ks].sort(); S.map = autoMap(S.keys); build(); S.loaded = true;
      const miss = !S.map.date ? 'the date column' : !(S.map.wh || S.map.whid) ? 'the WHs column' : !(S.map.util || (S.map.cap && (S.map.used || S.map.free))) ? 'utilization % or capacity + used / free' : '';
      say(miss ? '⚠ Could not find ' + miss + ' — open ⚙ Columns to choose it' : '✔ ' + plF(S.rows.length) + ' row(s) · ' + new Set(S.rows.map(r => r.wh)).size + ' warehouse(s) · ' + new Date().toLocaleTimeString(), !!miss);
    } catch (e) { S.err = e.message; say('⚠ ' + e.message, 1); } finally { S.loading = false; } render();
  }

  /* ---------- model ---------- */
  const inF = r => (!S.f.area || r.area === S.f.area) && (!S.f.region || r.region === S.f.region) && (!S.f.wh || r.wh === S.f.wh);
  const kf = () => S.f.by === 'area' ? r => r.area || '—' : S.f.by === 'region' ? r => r.region || '—' : r => r.wh;
  function perWh(mode) {
    const R = S.rows.filter(inF), by = new Map(); R.forEach(r => { if (!by.has(r.wh)) by.set(r.wh, []); by.get(r.wh).push(r); }); const out = [];
    by.forEach((L, wh) => { let X, d = '';
      if (mode === 'avg') { X = L.filter(r => (!S.f.from || r.date >= S.f.from) && (!S.f.to || r.date <= S.f.to)); const ds = X.map(r => r.date).sort(); d = ds.length ? (ds[0] === ds[ds.length - 1] ? ds[0] : ds[0] + ' → ' + ds[ds.length - 1]) : ''; }
      else { const B = L.filter(r => !S.f.to || r.date <= S.f.to); d = B.reduce((m, r) => r.date > m ? r.date : m, ''); X = B.filter(r => r.date === d); }
      if (!X.length) return; const cs = X.map(r => r.cap).filter(v => v > 0), us = X.map(r => r.used).filter(v => v != null), cap = cs.length ? avg(cs) : null, used = us.length ? avg(us) : null;
      out.push({ wh, whid: L[0].whid, area: L[0].area, region: L[0].region, cap, used, free: cap != null && used != null ? cap - used : null, u: cap > 0 && used != null ? used / cap * 100 : avg(X.map(r => r.u).filter(v => v != null)), d, n: X.length }); });
    return out; }
  function groups(W) { const k = kf(), G = new Map(); W.forEach(w => { const g = k(w); if (!G.has(g)) G.set(g, []); G.get(g).push(w); });
    return [...G.entries()].sort((a, b) => mdpNat(a[0], b[0])).map(([g, L]) => { const C = L.filter(w => w.cap > 0 && w.used != null), cap = C.reduce((a, w) => a + w.cap, 0), used = C.reduce((a, w) => a + w.used, 0);
      return { k: g, L, cap: C.length ? cap : null, used: C.length ? used : null, free: C.length ? cap - used : null, u: C.length && cap ? used / cap * 100 : avg(L.map(w => w.u).filter(v => v != null)) }; }); }
  const tot = W => { const C = W.filter(w => w.cap > 0 && w.used != null), cap = C.reduce((a, w) => a + w.cap, 0), used = C.reduce((a, w) => a + w.used, 0); return { cap, used, free: cap - used, u: cap ? used / cap * 100 : avg(W.map(w => w.u).filter(v => v != null)), has: C.length > 0 }; };

  /* ---------- charts ---------- */
  function capChart(host, mode) {
    if (!S.loaded) return plEmpty(host, 'Loading…'); const W = perWh(mode); if (!W.length) return plEmpty(host, mode === 'avg' ? 'No data in the date filter.' : 'No data on or before ' + (S.f.to || 'the To date') + '.');
    const G = groups(W).slice(0, 40), T = plT(), t = tot(W), late = mode === 'to' ? W.filter(w => w.d !== S.f.to).length : 0, hasCap = G.some(g => g.cap != null);
    let legend;
    if (hasCap) { const sr = [{ name: mode === 'avg' ? 'Used pallets (average)' : 'Used pallets', color: mode === 'avg' ? T.series[0] : T.series[1] }, { name: 'Free pallets', color: T.good || '#16a34a' }];
      plcCols(host, { stacked: true, cats: G.map(g => ({ label: g.k, vals: [g.used, g.free != null ? Math.max(0, g.free) : null], g })), series: sr, fmt: v => v == null ? '—' : F(v), tickFmt: v => F(v), height: 300,
        labelFn: c => c.g.cap == null ? P(c.g.u) : F(Math.round(c.g.free)) + ' free · ' + plF(c.g.u, 0) + '%' });
      legend = sr.map(s => ({ name: s.name, c: s.color })).concat([{ name: 'capacity ' + F(Math.round(t.cap)) + ' · used ' + F(Math.round(t.used)) + ' · free ' + F(Math.round(t.free)) + ' · ' + P(t.u) + (late ? ' · ' + late + ' WHs from an earlier date' : ''), c: 'transparent' }]); }
    else { plcCols(host, { cats: G.map(g => ({ label: g.k, vals: [g.u] })), series: [{ name: 'Utilization', color: T.series[0] }], fmt: P, tickFmt: v => plF(v, 0) + '%', height: 280, labelFn: (c, v) => P(v) }); legend = [{ name: 'Utilization % · overall ' + P(t.u) + ' (no capacity column — map it in ⚙ Columns to see free pallets)', c: T.series[0] }]; }
    return { legend, table: { headers: ['Group', 'WHs', 'WHs capacity', 'Used', 'Free pallets', 'Utilization %', mode === 'avg' ? 'Dates' : 'Date used'], rows: W.sort((a, b) => mdpNat(kf()(a), kf()(b)) || mdpNat(a.wh, b.wh)).map(w => [kf()(w), w.wh, w.cap == null ? '' : Math.round(w.cap), w.used == null ? '' : Math.round(w.used), w.free == null ? '' : Math.round(w.free), w.u == null ? '' : Math.round(w.u * 10) / 10, w.d]) } };
  }
  function trend(host) {
    if (!S.loaded) return plEmpty(host, 'Loading…'); const R = S.rows.filter(r => inF(r) && (!S.f.from || r.date >= S.f.from) && (!S.f.to || r.date <= S.f.to)); if (!R.length) return plEmpty(host, 'No data in the date filter.');
    const D = [...new Set(R.map(r => r.date))].sort(), k = kf(), Gs = [...new Set(R.map(k))].sort(mdpNat), top = Gs.length > 8 ? [] : Gs, T = plT();
    const val = L => { const C = L.filter(r => r.cap > 0 && r.used != null); return C.length ? C.reduce((a, r) => a + r.used, 0) / C.reduce((a, r) => a + r.cap, 0) * 100 : avg(L.map(r => r.u).filter(v => v != null)); };
    const series = [{ name: 'All selected', color: T.text || '#111827', vals: D.map(d => val(R.filter(r => r.date === d))) }].concat(top.map((g, i) => ({ name: g, color: T.series[i % T.series.length], vals: D.map(d => { const L = R.filter(r => r.date === d && k(r) === g); return L.length ? val(L) : null; }) })));
    plcLine(host, { x: D.map(d => d.slice(5)), series, fmt: P, tickFmt: v => plF(v, 0) + '%', height: 280, zero: false });
    return { legend: series.map(s => ({ name: s.name, c: s.color })).concat(Gs.length > 8 ? [{ name: Gs.length + ' groups — pick a WHs / Area to see their own lines', c: 'transparent' }] : []), table: { headers: ['Date', ...series.map(s => s.name + ' %')], rows: D.map((d, i) => [d, ...series.map(s => s.vals[i] == null ? '' : Math.round(s.vals[i] * 10) / 10)]) } };
  }
  const DEFS = [
    { id: 'avg', title: 'Utilization vs capacity — average', sub: 'average used and free pallets against the WHs capacity over the date filter', span: 's6', draw: h => capChart(h, 'avg') },
    { id: 'to', title: 'Utilization vs capacity — To date', sub: 'used and free pallets on the “To” date (latest entry on or before it)', span: 's6', draw: h => capChart(h, 'to') },
    { id: 'trend', title: 'Utilization % by day', sub: 'used ÷ capacity for each day of the date filter', span: 's12', draw: h => trend(h) }];

  /* ---------- page ---------- */
  function tableData() { const A = new Map(perWh('avg').map(w => [w.wh, w])), Tt = perWh('to'), r2 = v => v == null ? '' : Math.round(v * 10) / 10, rows = Tt.concat([...A.values()].filter(w => !Tt.some(t => t.wh === w.wh)).map(w => ({ wh: w.wh, whid: w.whid, area: w.area, region: w.region })))
      .sort((a, b) => mdpNat(a.area + a.region + a.wh, b.area + b.region + b.wh)).map(w => { const a = A.get(w.wh) || {}; return [w.wh, w.whid, w.area, w.region, r2(a.cap), r2(a.used), r2(a.free), r2(a.u), w.d || '', r2(w.cap), r2(w.used), r2(w.free), r2(w.u)]; });
    const ta = tot(perWh('avg')), tt = tot(Tt);
    return { title: 'WHs Utilization vs capacity', sheet: 'WHs Utilization', note: (S.f.from || '…') + ' → ' + (S.f.to || '…') + [S.f.area, S.f.region, S.f.wh].filter(Boolean).map(x => ' · ' + x).join(''), headers: ['WHs', 'WHs_ID', 'Area', 'Region', 'Avg capacity', 'Avg used', 'Avg free pallets', 'Avg utilization %', 'To date', 'Capacity', 'Used', 'Free pallets', 'Utilization %'], rows,
      totals: ['TOTAL', '', '', '', r2(ta.cap), r2(ta.used), r2(ta.free), r2(ta.u), S.f.to, r2(tt.cap), r2(tt.used), r2(tt.free), r2(tt.u)] }; }
  function kpis() { const Tt = perWh('to'), t = tot(Tt), a = tot(perWh('avg')), K = (l, v, s, c) => `<div class="pl-kpi"${c ? ` style="border-left:4px solid ${c}"` : ''}><div class="lbl">${esc(l)}</div><div class="val">${v}</div><div class="sub">${s || ''}</div></div>`, col = u => u == null ? '' : u >= 90 ? '#dc2626' : u >= 75 ? '#f59e0b' : '#16a34a';
    return K('WHs capacity', t.has ? F(Math.round(t.cap)) : '—', 'pallets · on ' + esc(S.f.to || '—'), '#2563eb') + K('Used pallets', t.has ? F(Math.round(t.used)) : '—', 'on the To date', '#ea580c') + K('Free pallets', t.has ? F(Math.round(t.free)) : '—', 'capacity − used', '#16a34a')
      + K('Utilization (To date)', P(t.u), Tt.length + ' warehouse(s)', col(t.u)) + K('Average utilization', P(a.u), 'over ' + esc(S.f.from || '…') + ' → ' + esc(S.f.to || '…'), col(a.u))
      + K('Fullest warehouse', (() => { const m = Tt.filter(w => w.u != null).sort((x, y) => y.u - x.u)[0]; return m ? esc(m.wh) : '—'; })(), (() => { const m = Tt.filter(w => w.u != null).sort((x, y) => y.u - x.u)[0]; return m ? P(m.u) + (m.free != null ? ' · ' + F(Math.round(m.free)) + ' free' : '') : ''; })(), '#7c3aed'); }
  function filters() { const R = S.rows, opt = (k, base) => [...new Set(R.filter(base).map(r => r[k]).filter(Boolean))].sort(mdpNat), sel = (k, l, L) => `<div class="form-group"><label>${l}</label><select data-wf="${k}"><option value="">All</option>${L.map(v => `<option${v === S.f[k] ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`;
    const A = opt('area', () => true), Rg = opt('region', r => !S.f.area || r.area === S.f.area), Wh = opt('wh', r => (!S.f.area || r.area === S.f.area) && (!S.f.region || r.region === S.f.region));
    return `<div class="whu-f"><div class="form-group"><label>From</label><input type="date" data-wf="from" value="${S.f.from}"></div><div class="form-group"><label>To</label><input type="date" data-wf="to" value="${S.f.to}"></div>
      <div class="whu-q"><button class="secondary small" type="button" data-wu="q-last">Latest day</button><button class="secondary small" type="button" data-wu="q-7">Last 7 days</button><button class="secondary small" type="button" data-wu="q-mtd">Month to date</button><button class="secondary small" type="button" data-wu="q-all">All dates</button></div>
      <div class="form-group"><label>View by</label><select data-wf="by"><option value="wh"${S.f.by === 'wh' ? ' selected' : ''}>WHs</option>${A.length ? `<option value="area"${S.f.by === 'area' ? ' selected' : ''}>Area</option>` : ''}${Rg.length ? `<option value="region"${S.f.by === 'region' ? ' selected' : ''}>Region</option>` : ''}</select></div>
      ${A.length ? sel('area', 'Area', A) : ''}${Rg.length ? sel('region', 'Region', Rg) : ''}${sel('wh', 'WHs', Wh)}</div>`; }
  function render() {
    const b = Q('#whuBody'); if (!b) return;
    if (!S.loaded) { b.innerHTML = `<div class="whu-hint">${S.loading ? 'Reading ' + LIST + '…' : S.err ? '⚠ ' + esc(S.err) : 'Press 🔄 Reload to read ' + LIST + '.'}</div>`; Q('#whuKpis').innerHTML = ''; return; }
    const fs = b.querySelector('.whu-f'), html = filters(); if (!fs || fs.outerHTML !== html) b.innerHTML = html;
    Q('#whuKpis').innerHTML = kpis(); atDrawGrid(Q('#whuGrid'), DEFS, { rows: () => null }); tbl();
  }
  function tbl() { const d = tableData(), h = Q('#whuTbl'); if (!h) return; const f = v => typeof v === 'number' ? plF(v, v % 1 ? 1 : 0) : esc(v);
    h.innerHTML = `<div class="whu-wrap"><table class="pl-tbl whu-t"><thead><tr>${d.headers.map((x, i) => `<th class="${i > 3 && i !== 8 ? 'n' : ''}">${esc(x)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r => `<tr>${r.map((v, i) => `<td class="${i > 3 && i !== 8 ? 'n' : ''}">${i === 7 || i === 12 ? (v === '' ? '' : `<span class="whu-u" style="--u:${Math.min(100, v)}%;--c:${v >= 90 ? '#dc2626' : v >= 75 ? '#f59e0b' : '#16a34a'}">${f(v)}%</span>`) : f(v)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr>${d.totals.map((v, i) => `<td class="${i > 3 && i !== 8 ? 'n' : ''}"><b>${i === 7 || i === 12 ? (v === '' ? '' : f(v) + '%') : f(v)}</b></td>`).join('')}</tr></tfoot></table></div>`; }
  function colsDlg() {
    if (!S.keys.length) return sectionToast('Load the list first (🔄 Reload).', 'warn'); let m = Q('#whuMap'); if (m) m.remove(); m = document.createElement('div'); m.id = 'whuMap'; m.dataset.nohc = '1';
    const ex = k => { const r = S.raw.find(K => K[k] != null && K[k] !== ''); return r ? String(typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]).slice(0, 28) : ''; };
    m.innerHTML = `<div class="whu-mb"><h3>⚙ Columns of ${LIST}</h3><div class="whu-hint">Pick the column for each field (found automatically where the names match). Saved on this computer.</div><table class="pl-tbl">${FIELDS.map(([k, l]) => `<tr><td><b>${esc(l)}</b></td><td><select data-mk="${k}" data-nosearch="1"><option value="">— none —</option>${S.keys.map(x => `<option value="${esc(x)}"${S.map[k] === x ? ' selected' : ''}>${esc(x)}${ex(x) ? ' · e.g. ' + esc(ex(x)) : ''}</option>`).join('')}</select></td></tr>`).join('')}</table>
      <div class="whu-hint">Used pallets are taken from <b>Used</b>, or capacity − <b>Free</b>, or <b>Utilization %</b> × capacity. Utilization stored as 0.82 is read as 82%.</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="ghost small" type="button" data-mx="auto">⚡ Auto-detect</button><button class="secondary small" type="button" data-mx="x">Cancel</button><button class="small" type="button" data-mx="ok">✔ Apply</button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) return m.remove(); const b = e.target.closest('[data-mx]'); if (!b) return; const a = b.dataset.mx;
      if (a === 'x') return m.remove(); if (a === 'auto') { try { localStorage.removeItem(MK()); } catch (x) {} S.map = autoMap(S.keys); m.remove(); return colsDlg(); }
      const o = {}; m.querySelectorAll('[data-mk]').forEach(s => { if (s.value) o[s.dataset.mk] = s.value; }); try { localStorage.setItem(MK(), JSON.stringify(o)); } catch (x) {} S.map = o; build(); m.remove(); render(); });
  }
  function quick(q) { const ds = S.rows.map(r => r.date).sort(), last = ds[ds.length - 1] || '', first = ds[0] || '', sh = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
    if (!last) return; if (q === 'last') S.f.from = S.f.to = last; else if (q === '7') { S.f.from = sh(last, -6); S.f.to = last; } else if (q === 'mtd') { S.f.from = last.slice(0, 8) + '01'; S.f.to = last; } else { S.f.from = first; S.f.to = last; } render(); }
  function init() {
    const v = Q('#view-whu'); if (!v || v._i) return; v._i = 1;
    const css = document.createElement('style'); css.textContent = `#view-whu .whu-f{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}#view-whu .whu-f .form-group{margin:0;min-width:150px}#view-whu .whu-f select,#view-whu .whu-f input{margin:0}#view-whu .whu-q{display:flex;gap:6px;flex-wrap:wrap;padding-bottom:2px}
#view-whu .whu-hint,#whuMap .whu-hint{font-size:12px;color:var(--gray-600);padding:6px 2px}#view-whu .whu-wrap{overflow:auto;max-height:65vh}#view-whu .whu-t th{position:sticky;top:0;z-index:1;white-space:nowrap}#view-whu .whu-t tfoot td{border-top:2px solid var(--border);background:var(--gray-50,#f8fafc)}
#view-whu .whu-u{display:inline-block;min-width:70px;padding:1px 6px;border-radius:6px;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 28%,transparent) var(--u),transparent var(--u));font-weight:700}
#whuMap{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}#whuMap .whu-mb{background:var(--card,#fff);color:var(--text,#111);border-radius:14px;padding:16px 18px;width:min(640px,100%);max-height:90vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.3)}#whuMap h3{margin:0 0 4px}#whuMap select{margin:0;width:100%}#whuMap td{padding:4px 6px}`; document.head.appendChild(css);
    v.addEventListener('click', e => { const t = e.target.closest('[data-wu]'); if (!t) return; const a = t.dataset.wu;
      if (a === 'reload') return load(true); if (a === 'cols') return colsDlg(); if (a.startsWith('q-')) return quick(a.slice(2));
      if (a === 'print' || a === 'excel' || a === 'mail') { if (!S.loaded) return sectionToast('Nothing loaded yet.', 'warn'); if (a === 'print') a2Print(tableData()); else if (a === 'excel') a2Export(tableData()); else a2Mail(tableData); return; }
      if (a === 'expand') { const tb = Q('#whuTbl table'); if (tb && window.tableExpandOpen) tableExpandOpen(tb); } });
    v.addEventListener('change', e => { const k = e.target.dataset.wf; if (!k) return; S.f[k] = e.target.value; if (k === 'area') { S.f.region = ''; S.f.wh = ''; } if (k === 'region') S.f.wh = ''; render(); });
    try { visInit({ pre: 'whu', view: 'whu', grid: '#whuGrid', kpis: '#whuKpis', table: '#whuTblCard', redraw: () => { if (S.loaded) atDrawGrid(Q('#whuGrid'), DEFS, { rows: () => null }); } }); } catch (e) { console.error(e); }
    window.addEventListener('resize', () => { if (Q('#view-whu.active') && S.loaded) atDrawGrid(Q('#whuGrid'), DEFS, { rows: () => null }); });
    render();
  }
  const nav = Q('.nav-item[data-view="whu"]'); if (nav) nav.addEventListener('click', () => { init(); setTimeout(() => load(false), 50); });
  const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (typeof activeViewId === 'function' && activeViewId() === 'whu') { e.stopImmediatePropagation(); load(true); } }, true);
  window.WHUX = { S, build, render, init, autoMap };
})();
