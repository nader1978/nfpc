/* ============================================================
   WHs DAILY DATA UPDATE dashboard  (view-whdu)  — who posted the daily data, which day, which sector
        reads Daily_Meeting_Report_Data_tbl for the chosen period only (Record_Date filter in SharePoint)
   TEMPERATURE DAILY RECORDS dashboard (view-whtmp) — readings, alarms, trend per warehouse
        reads WHs_Temperature_Reading_tbl (Trans_Date) + the limits of Stores_Locations_tbl
   Both: filters, KPIs, charts, heat-map, tables (Excel / print / e-mail through the page tools).
   ============================================================ */
(function () {
  'use strict';
  const Q = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nz = x => String(x || '').toLowerCase().replace(/_x[0-9a-f]{4}_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date());
  const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const dOnly = v => { if (!v) return ''; if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) { const s = String(v); if (s.length === 10) return s; } const d = new Date(v); return isNaN(d) ? '' : ymd(d); };
  const sv = v => v == null ? '' : typeof v === 'object' ? String(v.Value ?? v.LookupValue ?? v.Title ?? '').trim() : String(v).trim();
  const nn = v => { if (v == null || v === '') return null; if (typeof v === 'object') v = v.Value; const n = Number(String(v).replace(/[,\s%]/g, '')); return isFinite(n) ? n : null; };
  const fx = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const dmy = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
  const dow = iso => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(iso + 'T00:00:00').getDay()];
  const tm = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const person = it => { try { const u = it && it.createdBy && it.createdBy.user; return (u && (u.displayName || u.email)) || ''; } catch (e) { return ''; } };
  const toast = (m, k) => { try { sectionToast(m, k); } catch (e) {} };

  /* ---------- shared reading ---------- */
  const colCache = {};
  async function ids(list) { const site = getGlobalSiteUrl(), token = getGlobalAccessToken(); if (!site || !token) throw new Error('sign in first (no token / Site URL)'); const i = await resolveIds(site, list, token); return { token, siteId: i.siteId, listId: i.listId }; }
  async function colMap(list, I) {
    if (colCache[list]) return colCache[list];
    const m = { name: new Map(), lookup: new Map() };
    try { const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${I.siteId}/lists/${I.listId}/columns`, { headers: { Authorization: `Bearer ${I.token}` } }, 'columns'), d = await r.json();
      (d.value || []).forEach(c => { m.name.set(nz(c.displayName), c.name); m.name.set(nz(c.name), c.name); if (c.lookup && c.lookup.listId) m.lookup.set(nz(c.displayName), c); }); } catch (e) { console.warn('columns', e); }
    return (colCache[list] = m);
  }
  const keys = (f, alias) => { const K = {}; Object.keys(f || {}).forEach(k => { K[nz(k)] = f[k]; }); alias && alias.name.forEach((internal, disp) => { const v = f[internal]; if (v != null && (K[disp] == null || K[disp] === '')) K[disp] = v; if (f[internal + 'LookupId'] != null && K[disp + 'lookupid'] == null) K[disp + 'lookupid'] = f[internal + 'LookupId']; }); return K; };
  async function readPeriod(list, dateDisp, from, to, say) {
    const I = await ids(list), M = await colMap(list, I), col = M.name.get(nz(dateDisp)) || dateDisp, lo = shift(from, -1) + 'T00:00:00Z', hi = shift(to, 1) + 'T23:59:59Z';
    let how, items;
    try { items = await exp_fetchFilteredItems(I.siteId, I.listId, I.token, `fields/${col} ge '${lo}' and fields/${col} le '${hi}'`, n => say('Reading ' + list + '… ' + (n && n.length != null ? n.length : n))); how = 'only ' + from + ' → ' + to + ' downloaded'; }
    catch (e) { say('⚠ SharePoint would not filter by ' + dateDisp + ' — reading the whole list…', 1); items = await fetchAllItems(I.siteId, I.listId, I.token, n => say('Reading the whole ' + list + '… ' + (n && n.length != null ? n.length : n))); how = 'whole list read — index the ' + dateDisp + ' column for faster loading'; }
    return { items, how, M, I };
  }
  async function readAll(list) { const I = await ids(list); const M = await colMap(list, I); return { items: await fetchAllItems(I.siteId, I.listId, I.token), M, I }; }

  /* ---------- 📍 location scope: a user sees only the warehouses of his Location ID; admins see all ---------- */
  const scoped = () => { try { return typeof locScoped === 'function' && locScoped(); } catch (e) { return false; } };
  let SC = null;   /* { ids:Set, names:Set(nz) } once read */
  async function scope() {
    if (!scoped()) return null; if (SC && SC.u === currentUser.id) return SC;
    const ids = new Set((typeof locIds === 'function' ? locIds(currentUser) : []).map(x => String(+x || x))), names = new Set();
    String((typeof locWhName === 'function' && locWhName(currentUser)) || '').split(' / ').map(x => x.trim()).filter(Boolean).forEach(x => names.add(nz(x)));
    try { const W = await readAll('WHs_tbl'); W.items.forEach(it => { const K = keys(it.fields, W.M), lid = [it.id, K[nz('Location_ID')], K[nz('LocationID')], K[nz('WHs_ID')]].filter(x => x != null && x !== '').map(x => String(+x || x)); if (lid.some(x => ids.has(x))) { [K[nz('WHs_Desc')], K.title].forEach(n => { if (sv(n)) names.add(nz(sv(n))); }); } }); } catch (e) { console.warn('WHs_tbl scope', e); }
    return (SC = { ids, names, u: currentUser.id });
  }
  const scopeOk = (sc, name, whid) => !sc || sc.names.has(nz(name)) || (whid && sc.ids.has(String(+whid || whid)));
  const scopeNote = () => scoped() ? `<div class="text-sm" style="margin:-4px 0 8px">📍 You see your own location's warehouses only${typeof locWhName === 'function' && locWhName(currentUser) ? ' — ' + esc(locWhName(currentUser)) : ''}.</div>` : '';
  /* ---------- small chart helpers ---------- */
  const bars = (rows, o) => { o = o || {}; const mx = Math.max(1e-9, o.max != null ? o.max : Math.max(...rows.map(r => r.v)));
    return `<div class="wd-bars">${rows.map(r => `<div class="wd-br" title="${esc(r.tip || r.l + ': ' + r.t)}"><span class="l">${esc(r.l)}</span><span class="t"><i style="width:${Math.max(1, Math.min(100, r.v / mx * 100)).toFixed(1)}%;background:${r.c || o.c || 'var(--primary,#4f46e5)'}"></i>${r.m != null ? `<u style="left:${Math.min(100, r.m / mx * 100).toFixed(1)}%" title="limit ${r.m}"></u>` : ''}</span><b>${esc(r.t)}</b></div>`).join('')}</div>`; };
  const colBars = (rows, o) => { o = o || {}; const mx = Math.max(1e-9, o.max != null ? o.max : Math.max(...rows.map(r => r.v)));
    return `<div class="wd-cols" style="--n:${rows.length}">${rows.map(r => `<div class="wd-cl" title="${esc(r.tip || r.l + ': ' + r.t)}"><b>${esc(r.t)}</b><span><i style="height:${Math.max(2, Math.min(100, r.v / mx * 100)).toFixed(1)}%;background:${r.c || o.c || 'var(--primary,#4f46e5)'}"></i></span><em>${esc(r.l)}</em></div>`).join('')}</div>`; };
  function line(series, o) { o = o || {}; const W = 640, H = 230, L = 44, R = 12, T = 12, B = 30, all = series.flatMap(s => s.p.map(p => p.y).filter(y => y != null)); if (!all.length) return '<div class="wd-none">No data</div>';
    let lo = o.min != null ? o.min : Math.min(...all), hi = o.max != null ? o.max : Math.max(...all, o.limit != null ? o.limit : -1e9); if (o.limit != null) lo = Math.min(lo, o.limit); if (hi === lo) { hi += 1; lo -= 1; } const pd = (hi - lo) * .12; lo -= pd; hi += pd;
    const n = Math.max(1, series[0].p.length - 1), X = i => L + (W - L - R) * (series[0].p.length === 1 ? .5 : i / n), Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    let g = ''; for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".12"/><text x="${L - 4}" y="${y + 3}" text-anchor="end" font-size="13" fill="currentColor" opacity=".7">${v.toFixed(1)}</text>`; }
    const lab = series[0].p, step = Math.ceil(lab.length / 9); g += lab.map((p, i) => i % step === 0 ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="13" fill="currentColor" opacity=".7">${esc(p.x)}</text>` : '').join('');
    if (o.limit != null) g += `<line x1="${L}" x2="${W - R}" y1="${Y(o.limit)}" y2="${Y(o.limit)}" stroke="#dc2626" stroke-dasharray="5 4" stroke-width="1.4"/><text x="${W - R}" y="${Y(o.limit) - 3}" text-anchor="end" font-size="13" fill="#dc2626">limit ${o.limit}</text>`;
    series.forEach(s => { let d = '', pen = false; s.p.forEach((p, i) => { if (p.y == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1); pen = true; });
      g += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="2.2" stroke-linejoin="round"/>` + s.p.map((p, i) => p.y == null ? '' : `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" fill="${p.bad ? '#dc2626' : s.c}"><title>${esc(s.n)} ${esc(p.x)}: ${p.y.toFixed(1)}</title></circle>`).join(''); });
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;color:var(--text,#0f172a)">${g}</svg><div class="wd-lg">${series.map(s => `<span><i style="background:${s.c}"></i>${esc(s.n)}</span>`).join('')}</div>`; }
  const kpi = (l, v, s, c) => `<div class="pl-kpi" style="border-left:4px solid ${c || '#4f46e5'}"><div class="lbl">${esc(l)}</div><div class="val">${v}</div><div class="sub">${s || ''}</div></div>`;
  const card = (t, sub, body, cls) => `<div class="card wd-card ${cls || ''}"><div class="card-header"><div class="card-title">${t} ${sub ? `<span class="text-sm" style="font-weight:400">— ${sub}</span>` : ''}</div></div>${body}</div>`;
  const css = document.createElement('style'); css.textContent = `
.wd-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:10px}.wd-bar label{display:flex;flex-direction:column;font-size:11px;gap:2px;color:var(--muted,#64748b)}.wd-bar input,.wd-bar select{min-width:120px}
.wd-q{display:flex;gap:5px;flex-wrap:wrap}.wd-q button{padding:5px 9px;font-size:12px}
.wd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;margin-top:12px}
.wd-bars{display:flex;flex-direction:column;gap:5px;max-height:330px;overflow:auto}.wd-br{display:grid;grid-template-columns:minmax(80px,32%) 1fr 52px;gap:8px;align-items:center;font-size:12px}.wd-br .l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wd-br .t{position:relative;height:14px;background:rgba(100,116,139,.14);border-radius:7px;overflow:hidden}.wd-br .t i{display:block;height:100%;border-radius:7px}.wd-br .t u{position:absolute;top:0;bottom:0;width:2px;background:#dc2626}.wd-br b{text-align:right;font-weight:700}
.wd-cols{display:grid;grid-template-columns:repeat(var(--n),minmax(18px,1fr));gap:4px;align-items:end;height:190px;overflow-x:auto}.wd-cl{display:flex;flex-direction:column;align-items:center;height:100%;font-size:10px}.wd-cl b{font-size:9px;font-weight:700}.wd-cl span{flex:1;width:70%;display:flex;align-items:flex-end;background:rgba(100,116,139,.10);border-radius:5px 5px 0 0}.wd-cl span i{display:block;width:100%;border-radius:5px 5px 0 0}.wd-cl em{font-style:normal;opacity:.7;white-space:nowrap}
.wd-lg{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;margin-top:4px}.wd-lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px}.wd-none{padding:18px;text-align:center;color:var(--muted,#64748b)}
.wd-tw{overflow:auto;max-height:560px;border:1px solid rgba(100,116,139,.22);border-radius:10px}.wd-t{border-collapse:separate;border-spacing:0;font-size:12px;width:100%}.wd-t th{position:sticky;top:0;background:var(--card-bg,#f1f5f9);z-index:2;padding:6px 8px;text-align:left;white-space:nowrap;border-bottom:1px solid rgba(100,116,139,.3)}.wd-t td{padding:5px 8px;border-bottom:1px solid rgba(100,116,139,.14);white-space:nowrap}.wd-t td:first-child,.wd-t th:first-child{position:sticky;left:0;background:var(--card-bg,#fff);z-index:1;font-weight:600}.wd-t th:first-child{z-index:3}
.wd-h{text-align:center!important;min-width:38px;font-weight:700}.wd-ok{background:rgba(22,163,74,.22);color:#15803d}.wd-pt{background:rgba(245,158,11,.28);color:#b45309}.wd-no{background:rgba(220,38,38,.18);color:#b91c1c}.wd-off{background:rgba(100,116,139,.10);color:#94a3b8}
.wd-pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700}.wd-pill.g{background:rgba(22,163,74,.18);color:#15803d}.wd-pill.a{background:rgba(245,158,11,.25);color:#b45309}.wd-pill.r{background:rgba(220,38,38,.18);color:#b91c1c}
.wd-chips{display:flex;flex-wrap:wrap;gap:6px}.wd-chips span{padding:3px 10px;border-radius:999px;background:rgba(220,38,38,.12);color:#b91c1c;font-size:12px;font-weight:600}
`; document.head.appendChild(css);
  const hostBar = (p, S, extra) => `<div class="wd-bar"><label>From<input type="date" data-${p}="from" value="${S.per.from}"></label><label>To<input type="date" data-${p}="to" value="${S.per.to}"></label>
    <div class="wd-q">${[['Today', 0], ['Yesterday', 1], ['Last 7 days', 7], ['Last 14', 14], ['Last 30', 30]].map(q => `<button type="button" class="secondary small" data-${p}-q="${q[1]}">${q[0]}</button>`).join('')}</div>${extra}
    <button type="button" class="primary" data-${p}-go="1">${S.loading ? '⏳ Loading…' : '🔄 Load'}</button></div>`;
  const sel = (p, k, label, opts, cur) => `<label>${label}<select data-${p}f="${k}"><option value="">All</option>${opts.map(o => `<option value="${esc(o)}"${o === cur ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  const tools = (p, title) => `<span style="flex:1"></span><div class="btn-row"><button type="button" class="secondary small" data-${p}-tl="xl">📊 Excel</button><button type="button" class="secondary small" data-${p}-tl="ml">✉ E-mail</button><button type="button" class="secondary small" data-${p}-tl="pr">🖨 Print</button></div>`;
  function period(S, n) { const t = today(); S.per.to = n === 1 ? shift(t, -1) : t; S.per.from = n === 0 ? t : n === 1 ? shift(t, -1) : shift(t, -(n - 1)); }
  const loadingBar = S => S.loading ? `<div style="height:5px;border-radius:3px;background:rgba(100,116,139,.2);overflow:hidden;margin:6px 0"><div style="height:100%;width:40%;background:var(--primary,#4f46e5);animation:wdl 1.1s ease-in-out infinite alternate"></div></div><style>@keyframes wdl{from{margin-left:0}to{margin-left:60%}}</style>` : '';

  /* =====================================================================
     1) WHs DAILY DATA UPDATE
     ===================================================================== */
  const LIST1 = 'Daily_Meeting_Report_Data_tbl';
  const D = { loaded: false, loading: false, err: '', how: '', per: { from: shift(today(), -13), to: today() }, rows: [], tab: 'dash', f: { wh: '', sec: '', days: 'all', blk: '', bd: '', bw: '' }, lk: new Map(), raw: 0 };
  const say1 = (t, w) => { const e = Q('#whduStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };
  async function whLookup(M, I, items) {
    D.lk = new Map(); const c = M.lookup.get(nz('WHs_Dtls')); if (!c) return;
    const sample = items.slice(0, 300).map(x => keys(x.fields, M)); if (sample.some(K => sv(K[nz('WHs_Dtls')]))) return; if (!sample.some(K => K[nz('WHs_Dtls') + 'lookupid'] != null)) return;
    try { const its = await fetchAllItems(I.siteId, c.lookup.listId, I.token), cn = nz(c.lookup.columnName || 'Title'); its.forEach(x => { const K = keys(x.fields); D.lk.set(String(x.id), sv(K[cn] != null ? K[cn] : K.title)); }); } catch (e) { console.warn('WHs lookup', e); } }
  function build1(items, M, sc) {
    const rows = [];
    items.forEach(x => { const K = keys(x.fields, M), date = dOnly(K[nz('Record_Date')]); if (!date || date < D.per.from || date > D.per.to) return;
      const whid = sv(K[nz('WHs_ID')]).replace(/\.0+$/, ''), lkid = K[nz('WHs_Dtls') + 'lookupid'], wh = sv(K[nz('WHs_Dtls')]) || (lkid != null ? D.lk.get(String(lkid)) || '' : '') || (whid ? 'WHs ' + whid : ''); if (!wh || !scopeOk(sc, wh, whid)) return;
      const dtl = Object.keys(K).filter(k => /sector|desc|name|type|item|categ|status|class|group|label|product|asset|route|trailer|truck|equip|staff|detail|dept|shift/.test(k) && !/^whs|^datamain|^second|^third|lookupid$|^title$|^recorddate|^author|^editor|^created|^modified|^odata/.test(k)).map(k => sv(K[k])).filter(v => v && isNaN(+v));
      rows.push({ dt: [...new Set(dtl)].join(' · '), date, wh, whid, sec: sv(K[nz('Data_Main_Sector')]) || '(no sector)', s2: sv(K[nz('Second_Sector')]), s3: sv(K[nz('Third_Sector')]), val: nn(K[nz('Totals')]), id: +x.id || 0, hdr: nn(K[nz('Header_ID')]) || 0, by: person(x), at: x.createdDateTime || '' }); });
    D.rows = rows; D.raw = items.length;
  }
  async function load1() {
    if (D.loading) return; D.loading = true; D.err = ''; render1();
    try { if (D.per.from > D.per.to) throw new Error('the period From is after To'); const t0 = Date.now(), R = await readPeriod(LIST1, 'Record_Date', D.per.from, D.per.to, say1); await whLookup(R.M, R.I, R.items); build1(R.items, R.M, await scope()); D.how = R.how; D.loaded = true;
      say1(D.rows.length ? '✔ ' + fx(D.rows.length) + ' row(s) · ' + new Set(D.rows.map(r => r.wh)).size + ' warehouse(s) · ' + D.how + ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s' : '⚠ No rows for this period.', !D.rows.length);
    } catch (e) { D.err = e.message; say1('⚠ ' + e.message, 1); } finally { D.loading = false; } render1();
  }
  function model1() {
    const R = D.rows.filter(r => (!D.f.sec || r.sec === D.f.sec)), whs = [...new Set(D.rows.map(r => r.wh))].filter(w => !D.f.wh || w === D.f.wh).sort(), secs = [...new Set(D.rows.map(r => r.sec))].sort();
    const t = today(), days = []; for (let d = D.per.from; d <= D.per.to && d <= t; d = shift(d, 1)) { const w = new Date(d + 'T00:00:00').getDay(); if (D.f.days === 'wk5' && (w === 0 || w === 6)) continue; if (D.f.days === 'wk6' && w === 0) continue; days.push(d); }
    const cell = new Map(); R.forEach(r => { const k = r.wh + '|' + r.date; let c = cell.get(k); if (!c) cell.set(k, c = { n: 0, secs: new Set(), hdrs: new Set(), by: new Set(), first: '', last: '' }); c.n++; c.secs.add(r.sec); c.hdrs.add(r.hdr); if (r.by) c.by.add(r.by); if (r.at) { if (!c.first || r.at < c.first) c.first = r.at; if (!c.last || r.at > c.last) c.last = r.at; } });
    const expSec = new Map(); whs.forEach(w => expSec.set(w, new Set(R.filter(r => r.wh === w).map(r => r.sec))));
    const st = (w, d) => { const c = cell.get(w + '|' + d); if (!c) return { s: 'no' }; const e = expSec.get(w).size; return { s: c.secs.size >= e ? 'ok' : 'pt', c, e }; };
    return { whs, secs, days, st, cell, R };
  }
  /* ---------- page shell: the same layout as the Forklift dashboard (hero · tab bar · dashboard · pop-up pages) ---------- */
  const DVX = { whdu: { n: 'WHs Daily Data Update', ic: '📅', s: 'Daily report posted by every warehouse · blocks · figures · missing days', c1: '#134e4a', c2: '#0d9488', t: '13,148,136' }, whtmp: { n: 'Temperature Daily Records', ic: '🌡', s: 'Readings · limit warnings · abnormal variances · trends per warehouse', c1: '#7f1d1d', c2: '#ef4444', t: '239,68,68' } };
  let dvCss = null; const dvInit = () => { if (!window.DSTAGE) return false; Object.keys(DVX).forEach(k => { if (!DSTAGE.DIV[k]) DSTAGE.DIV[k] = DVX[k]; }); if (!dvCss) { dvCss = document.createElement('style'); dvCss.textContent = Object.keys(DVX).map(k => `[data-dv="${k}"]{--dv1:${DVX[k].c1};--dv2:${DVX[k].c2};--dvt:${DVX[k].t}}`).join('') + '.wd-flt{background:var(--card,#fff);border:1px solid var(--border,#e2e8f0);border-radius:14px;padding:12px 14px;margin-bottom:12px}.wd-flt .wd-bar{margin-bottom:4px}.wd-an{margin:0;padding-left:18px;font-size:13px;line-height:1.7}.wd-an b{font-weight:700}'; document.head.appendChild(dvCss); } return true; };
  function split(h) { const P = {}; let cur = 'dash'; String(h).split('\u0001').forEach((seg, i) => { if (i % 2) cur = seg; else P[cur] = (P[cur] || '') + seg; }); return P; }
  function shell(id, p, S, TABS, pages, extra) {
    const v = Q('#view-' + id); if (!v) return; const keepY = window.scrollY;
    if (!TABS.some(t => t[0] === S.tab)) S.tab = 'dash';
    if (!dvInit()) { v.innerHTML = Object.values(pages).join(''); return; }
    let tb = v.querySelector(':scope > .wd-tabs'), body = v.querySelector(':scope > .wd-body');
    if (!tb) { v.innerHTML = '<div class="pl-tabs wd-tabs" style="margin-bottom:8px"></div><div class="wd-body"></div>'; tb = v.querySelector('.wd-tabs'); body = v.querySelector('.wd-body'); }
    tb.innerHTML = TABS.map(t => `<button type="button" data-${p}-tab="${t[0]}" class="${S.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('');
    DSTAGE.stage(body, { div: id, tab: S.tab, dash: () => pages.dash || '', html: () => pages[S.tab] || '<div class="wd-none">Nothing to show.</div>', title: (TABS.find(t => t[0] === S.tab) || [, ''])[1], heroExtra: extra || '', onClose: () => { S.tab = 'dash'; (id === 'whdu' ? render1 : render2)(); } });
    window.scrollTo(0, keepY);
  }
  const analysis = L => `<div class="card wd-card"><div class="card-header"><div class="card-title">🧠 Analysis <span class="text-sm" style="font-weight:400">— auto</span></div></div><ul class="wd-an">${L.filter(Boolean).map(x => `<li>${x}</li>`).join('')}</ul></div>`;
  /* ---------- BLOCK VALUES — the figures each warehouse posted in every block of the daily report ---------- */
  const KNOWN = ['1-Trls Today Plan', '2-Trls Ystdy Plan', '3-Trips Today Sales Truck', '4-Trips Ysdy Sales Truck', '5-Staff', '6-Equipment', '7-Empty Crates|Plts', '8-WHs Capacity Status', '9-Promo Assets'];
  const bnum = b => { const m = /^\s*(\d+)/.exec(b); return m ? +m[1] : 99; };
  const mkey = r => r.s3 || '(total)';
  const spark = a => { a = a.filter(x => x != null); if (a.length < 2) return ''; const mx = Math.max(...a), mn = Math.min(...a), W = 90, H = 24, pts = a.map((v, i) => (i / (a.length - 1) * W).toFixed(1) + ',' + (H - 2 - (mx === mn ? .5 : (v - mn) / (mx - mn)) * (H - 4)).toFixed(1)).join(' '); return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><polyline points="${pts}" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>`; };
  const chg = (a, b) => a != null && b ? (a - b) / Math.abs(b) * 100 : null;
  const chgCell = c => `<td class="${c == null ? '' : c > 0 ? 'wd-ok' : c < 0 ? 'wd-no' : ''}">${c == null ? '—' : (c > 0 ? '+' : '') + fx(c, 1) + '%'}</td>`;
  function blocksHtml(M, whs, days) {
    const all = D.rows.filter(r => whs.includes(r.wh)), seen = new Set(all.map(r => r.sec)), blocks = [...new Set([...KNOWN, ...seen])].sort((a, b) => bnum(a) - bnum(b) || a.localeCompare(b));
    const best = new Map(); all.forEach(r => { const k = [r.date, r.wh, r.sec, r.s2, r.s3, r.dt].join('|'), o = best.get(k); if (!o || r.hdr > o.hdr || (r.hdr === o.hdr && r.id > o.id)) best.set(k, r); });
    const vals = [...best.values()].filter(r => r.val != null);
    const B = blocks.includes(D.f.blk) ? D.f.blk : (blocks.find(b => seen.has(b)) || blocks[0]);
    let h = `<div class="card wd-card"><div class="card-header"><div class="card-title">🔎 Block values <span class="text-sm" style="font-weight:400">— the figures posted by the warehouses · choose a block, then click a warehouse for its breakdown</span></div></div><div class="wd-q">${blocks.map(b => `<button type="button" class="${b === B ? 'primary' : 'secondary'} small" data-whdu-blk="${esc(b)}"${seen.has(b) ? '' : ' style="opacity:.5"'}>${esc(b)}</button>`).join('')}</div></div>`;
    const V = vals.filter(r => r.sec === B), cap = /capacity/i.test(B);
    if (!V.length) return h + `<div class="card"><div class="wd-none">No figures were posted for <b>${esc(B)}</b> in this period.</div></div>`;
    const dayList = [...new Set(V.map(r => r.date))].sort(), L = dayList.includes(D.f.bd) ? D.f.bd : dayList[dayList.length - 1], P = dayList[dayList.indexOf(L) - 1];
    const W = whs.filter(w => V.some(r => r.wh === w)).sort(), S2 = [...new Set(V.map(r => r.s2 || '(all)'))].sort();
    const sum = (f) => V.filter(f).reduce((a, r) => a + r.val, 0), has = f => V.some(f);
    const s2 = r => r.s2 || '(all)';
    h += `<div class="wd-bar" style="margin-top:10px"><label>Data day<select data-whduf="bd">${dayList.slice().reverse().map(d => `<option value="${d}"${d === L ? ' selected' : ''}>${d} (${dow(d)})</option>`).join('')}</select></label><span class="text-sm">compared with ${P || '—'} · if a day was posted twice the latest post is used</span></div>`;
    /* what is "the total"? capacity block: the Actual; others: sum of all measures */
    const kindOf = r => /capac/i.test(r.s3) ? 'cap' : /actual|used|occup/i.test(r.s3) ? 'used' : /free|empty/i.test(r.s3) ? 'free' : '';
    const totW = (w, d) => V.filter(r => r.wh === w && r.date === d && (!cap || kindOf(r) === 'used')).reduce((a, r) => a + r.val, 0);
    const totAll = d => W.reduce((a, w) => a + totW(w, d), 0);
    /* KPIs */
    const tL = totAll(L), tP = P ? totAll(P) : null;
    let kp = kpi(cap ? 'Pallets in use (actual)' : 'Total — all warehouses', fx(tL), tP != null ? 'previous day ' + fx(tP) + (chg(tL, tP) != null ? ' (' + (chg(tL, tP) > 0 ? '+' : '') + fx(chg(tL, tP), 1) + '%)' : '') : 'data day ' + L, '#4f46e5');
    if (cap) { const c = sum(r => r.date === L && kindOf(r) === 'cap'), f = sum(r => r.date === L && kindOf(r) === 'free'); kp += kpi('Capacity', fx(c), '', '#0ea5e9') + kpi('Free', fx(f || c - tL), '', '#16a34a') + kpi('Utilization', c ? fx(tL / c * 100, 1) + '%' : '—', '', tL / c > .95 ? '#dc2626' : tL / c > .85 ? '#f59e0b' : '#16a34a'); }
    else S2.slice(0, 4).forEach((g, i) => { const a = sum(r => r.date === L && s2(r) === g), b = P ? sum(r => r.date === P && s2(r) === g) : null; kp += kpi(g, fx(a), b != null ? 'previous ' + fx(b) : '', ['#0ea5e9', '#16a34a', '#f59e0b', '#7c3aed'][i]); });
    kp += kpi('Warehouses', W.length + ' / ' + whs.length, 'with figures in this block', '#64748b');
    h += `<div class="pl-kpis">${kp}</div>`;
    /* pivot: measure rows × warehouse columns */
    const meas = []; S2.forEach(g => { [...new Set(V.filter(r => s2(r) === g).map(mkey))].sort().forEach(m => meas.push({ g, m })); });
    const cellV = (w, g, m, d) => { const a = V.filter(r => r.wh === w && r.date === d && s2(r) === g && mkey(r) === m); return a.length ? a.reduce((x, r) => x + r.val, 0) : null; };
    const sel = D.f.bw && W.includes(D.f.bw) ? D.f.bw : '';
    const th = w => `<th class="wd-h" style="cursor:pointer;${w === sel ? 'background:rgba(79,70,229,.25);' : ''}" data-whdu-wh="${esc(w)}" title="Click for the breakdown of ${esc(w)}">${esc(w)} ▾</th>`;
    const rowH = (g, m, strong, lab) => { const vs = W.map(w => cellV(w, g, m, L)), t = vs.reduce((a, x) => a + (x || 0), 0), tp = P ? W.reduce((a, w) => a + (cellV(w, g, m, P) || 0), 0) : null;
      return `<tr${strong ? ' style="font-weight:700"' : ''}><td>${esc(lab || (g === '(all)' ? m : m))}</td>${vs.map((x, i) => `<td class="wd-h" style="cursor:pointer" data-whdu-wh="${esc(W[i])}">${x == null ? '·' : fx(x)}</td>`).join('')}<td class="wd-h"><b>${fx(t)}</b></td><td>${tp == null ? '—' : fx(tp)}</td>${chgCell(chg(t, tp))}</tr>`; };
    let body = ''; S2.forEach(g => { const ms = meas.filter(x => x.g === g); if (g !== '(all)' && ms.length > 1) { const vs = W.map(w => V.filter(r => r.wh === w && r.date === L && s2(r) === g).reduce((a, r) => a + r.val, 0)), t = vs.reduce((a, x) => a + x, 0), tp = P ? V.filter(r => r.date === P && s2(r) === g).reduce((a, r) => a + r.val, 0) : null;
        body += `<tr style="font-weight:700;background:rgba(79,70,229,.07)"><td>Σ ${esc(g)}</td>${vs.map((x, i) => `<td class="wd-h" style="cursor:pointer" data-whdu-wh="${esc(W[i])}">${fx(x)}</td>`).join('')}<td class="wd-h">${fx(t)}</td><td>${tp == null ? '—' : fx(tp)}</td>${chgCell(chg(t, tp))}</tr>`; ms.forEach(x => { body += rowH(g, x.m, false).replace('<td>', '<td style="padding-left:22px">'); }); }
      else ms.forEach(x => { body += rowH(g, x.m, false, g !== '(all)' && ms.length === 1 ? g + (x.m !== '(total)' ? ' · ' + x.m : '') : x.m); }); });
    const gt = W.map(w => totW(w, L)), gtp = P ? totAll(P) : null;
    body += `<tr style="font-weight:800;border-top:2px solid rgba(100,116,139,.5)"><td>${cap ? 'Actual (pallets in use)' : 'TOTAL'}</td>${gt.map((x, i) => `<td class="wd-h" style="cursor:pointer" data-whdu-wh="${esc(W[i])}">${fx(x)}</td>`).join('')}<td class="wd-h">${fx(gt.reduce((a, x) => a + x, 0))}</td><td>${gtp == null ? '—' : fx(gtp)}</td>${chgCell(chg(gt.reduce((a, x) => a + x, 0), gtp))}</tr>`;
    if (cap) body += `<tr style="font-weight:700"><td>Utilization %</td>${W.map(w => { const c = V.filter(r => r.wh === w && r.date === L && kindOf(r) === 'cap').reduce((a, r) => a + r.val, 0), u = totW(w, L); return `<td class="wd-h ${c ? (u / c > .95 ? 'wd-no' : u / c > .85 ? 'wd-pt' : 'wd-ok') : ''}">${c ? fx(u / c * 100, 0) + '%' : '—'}</td>`; }).join('')}<td class="wd-h">${(() => { const c = sum(r => r.date === L && kindOf(r) === 'cap'); return c ? fx(tL / c * 100, 1) + '%' : '—'; })()}</td><td></td><td></td></tr>`;
    h += card('📊 ' + esc(B) + ' — figures by warehouse', 'data day ' + L + ' · click a warehouse name or any of its figures for the breakdown', `<div class="wd-tw"><table class="wd-t"><thead><tr><th>Measure</th>${W.map(th).join('')}<th class="wd-h">Total</th><th>${P || 'Previous'}</th><th>Change</th></tr></thead><tbody>${body}</tbody></table></div>`);
    h += `<div class="wd-grid">${card('🏭 ' + (cap ? 'Pallets in use' : 'Total') + ' by warehouse', 'data day ' + L, bars(W.map((w, i) => ({ l: w, v: Math.abs(gt[i]), t: fx(gt[i]), tip: w + ': ' + fx(gt[i]) })).sort((a, b) => b.v - a.v), {}))}${card('📈 Daily total — all warehouses', cap ? 'pallets in use' : 'sum of all figures of the block', line([{ n: 'Total', c: '#4f46e5', p: days.map(d => ({ x: dmy(d), y: dayList.includes(d) ? totAll(d) : null })) }]))}</div>`;
    /* breakdown of ONE warehouse */
    if (sel) {
      const R = V.filter(r => r.wh === sel), keyOf = r => [s2(r), r.s3 || '', r.dt || ''].join('\u0001'), ks = [...new Set(R.filter(r => r.date === L).map(keyOf))].sort(), tw = totW(sel, L), twp = P ? totW(sel, P) : null;
      const byDay = d => R.filter(r => r.date === d && (!cap || kindOf(r) === 'used')).reduce((a, r) => a + r.val, 0);
      const rowsB = ks.map(k => { const [g, m, dt] = k.split('\u0001'), ser = dayList.map(d => { const a = R.filter(r => r.date === d && keyOf(r) === k); return a.length ? a.reduce((x, r) => x + r.val, 0) : null; }), v = R.filter(r => r.date === L && keyOf(r) === k).reduce((x, r) => x + r.val, 0), pv = P ? R.filter(r => r.date === P && keyOf(r) === k).reduce((x, r) => x + r.val, 0) : null, xs = ser.filter(x => x != null);
        return { g, m, dt, v, pv: P && R.some(r => r.date === P && keyOf(r) === k) ? pv : null, avg: avg(xs), mn: xs.length ? Math.min(...xs) : null, mx: xs.length ? Math.max(...xs) : null, ser }; });
      h += `<div class="card wd-card" style="border:2px solid rgba(79,70,229,.45)"><div class="card-header"><div class="card-title">🏭 ${esc(sel)} — breakdown of ${esc(B)} <span class="text-sm" style="font-weight:400">— data day ${L}</span></div><div class="btn-row"><button type="button" class="secondary small" data-whdu-wh="">✕ Close</button></div></div>
        <div class="pl-kpis">${kpi(cap ? 'Pallets in use' : 'Total', fx(tw), twp != null ? 'previous day ' + fx(twp) + (chg(tw, twp) != null ? ' (' + (chg(tw, twp) > 0 ? '+' : '') + fx(chg(tw, twp), 1) + '%)' : '') : '', '#4f46e5')}${kpi('Share of all warehouses', tL ? fx(tw / tL * 100, 1) + '%' : '—', 'of ' + fx(tL), '#0ea5e9')}${kpi('Lines posted', fx(ks.length), 'on this day', '#7c3aed')}${kpi('Period average', fx(avg(dayList.map(byDay))), 'per posted day', '#16a34a')}</div>
        <div class="wd-grid">${card('🧮 Split', 'share of the warehouse total', bars(S2.map(g => ({ g, v: R.filter(r => r.date === L && s2(r) === g && (!cap || kindOf(r) === 'used')).reduce((a, r) => a + r.val, 0) })).filter(x => x.v).sort((a, b) => b.v - a.v).map(x => ({ l: x.g === '(all)' ? 'Total' : x.g, v: Math.abs(x.v), t: tw ? fx(x.v / tw * 100, 0) + '%' : fx(x.v), tip: x.g + ': ' + fx(x.v) })), {}))}${card('📈 Daily total', esc(sel), line([{ n: sel, c: '#4f46e5', p: days.map(d => ({ x: dmy(d), y: dayList.includes(d) && R.some(r => r.date === d) ? byDay(d) : null })) }]))}</div>
        <div class="wd-tw"><table class="wd-t"><thead><tr><th>Group</th><th>Measure</th><th>Detail</th><th>${L}</th><th>Share %</th><th>${P || 'Previous'}</th><th>Change</th><th>Average</th><th>Min</th><th>Max</th><th>Trend</th></tr></thead><tbody>${rowsB.map(x => `<tr><td>${esc(x.g === '(all)' ? '' : x.g)}</td><td>${esc(x.m)}</td><td>${esc(x.dt)}</td><td class="wd-h"><b>${fx(x.v)}</b></td><td>${tw && (!cap || /actual|used|occup/i.test(x.m)) ? fx(x.v / tw * 100, 1) : '—'}</td><td>${x.pv == null ? '—' : fx(x.pv)}</td>${chgCell(chg(x.v, x.pv))}<td>${fx(x.avg, 1)}</td><td>${fx(x.mn)}</td><td>${fx(x.mx)}</td><td>${spark(x.ser)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    return h;
  }
  const TABS1 = [['dash', '📅 Dashboard'], ['grid', '🗓 Warehouse × day'], ['blk', '🔎 Block values'], ['sum', '📋 Warehouse summary'], ['post', '🧾 What each posted']];
  function render1() {
    const v = Q('#view-whdu'); if (!v) return;
    const M = model1(), { whs, secs, days, st } = M, bd = D.loaded && D.rows.length;
    const extra = sel('whdu', 'wh', 'Warehouse', [...new Set(D.rows.map(r => r.wh))].sort(), D.f.wh) + sel('whdu', 'sec', 'Data sector', M.secs, D.f.sec)
      + `<label>Days counted<select data-whduf="days"><option value="all"${D.f.days === 'all' ? ' selected' : ''}>Every day</option><option value="wk6"${D.f.days === 'wk6' ? ' selected' : ''}>Mon–Sat</option><option value="wk5"${D.f.days === 'wk5' ? ' selected' : ''}>Mon–Fri</option></select></label>`;
    const FLT = `<div class="wd-flt">` + hostBar('whdu', D, extra) + `<div style="display:flex;align-items:center;gap:8px">${tools('whdu')}</div>` + scopeNote() + `<div id="whduStatus" class="status-msg" style="font-size:12px"></div>${loadingBar(D)}</div>`; let h = FLT;
    if (!bd) { shell('whdu', 'whdu', D, TABS1, { dash: h + (D.loading ? '' : `<div class="card"><div class="wd-none">${D.err ? '⚠ ' + esc(D.err) : D.loaded ? 'No data in this period.' : 'Choose the period and press Load.'}</div></div>`) }); say1(D.err ? '⚠ ' + D.err : ''); return; }
    /* per warehouse */
    const sumW = whs.map(w => { let ok = 0, pt = 0, no = 0, last = '', by = '', streak = 0; days.forEach(d => { const s = st(w, d); if (s.s === 'ok') ok++; else if (s.s === 'pt') pt++; else no++; if (s.c && d >= last) { last = d; by = [...s.c.by].join(', '); } });
      for (let i = days.length - 1; i >= 0 && st(w, days[i]).s === 'no'; i--) streak++; const exp = days.length; return { w, ok, pt, no, exp, rate: exp ? (ok + pt) / exp * 100 : 0, full: exp ? ok / exp * 100 : 0, last, by, streak }; });
    const tot = sumW.reduce((a, s) => ({ ok: a.ok + s.ok, pt: a.pt + s.pt, no: a.no + s.no, exp: a.exp + s.exp }), { ok: 0, pt: 0, no: 0, exp: 0 });
    const lastDay = days[days.length - 1], todayOk = lastDay ? whs.filter(w => st(w, lastDay).s !== 'no') : [], todayNo = lastDay ? whs.filter(w => st(w, lastDay).s === 'no') : [];
    const reposts = [...M.cell.values()].filter(c => c.hdrs.size > 1).length, lastAt = D.rows.map(r => r.at).filter(Boolean).sort().pop();
    const rate = tot.exp ? (tot.ok + tot.pt) / tot.exp * 100 : 0;
    const analysis1 = () => { const worst = sumW.slice().sort((a, b) => a.rate - b.rate)[0], strk = sumW.slice().sort((a, b) => b.streak - a.streak)[0], lowSec = (() => { const g = new Map(); M.R.forEach(r => g.set(r.sec, (g.get(r.sec) || new Set()).add(r.wh + '|' + r.date))); return [...g.entries()].map(([k, v]) => [k, v.size]).sort((a, b) => a[1] - b[1])[0]; })();
      return analysis([lastDay ? (todayNo.length ? '⚠ ' + todayNo.length + ' of ' + whs.length + ' warehouse(s) have <b>not posted</b> on ' + (lastDay === today() ? 'today' : dmy(lastDay)) + '.' : '✔ All ' + whs.length + ' warehouse(s) posted on ' + (lastDay === today() ? 'today' : dmy(lastDay)) + '.') : '', 'Update rate <b>' + fx(rate, 1) + '%</b> over ' + days.length + ' day(s): ' + fx(tot.ok) + ' full · ' + fx(tot.pt) + ' partial · ' + fx(tot.no) + ' missing warehouse-days.', worst ? 'Lowest update rate: <b>' + esc(worst.w) + '</b> (' + fx(worst.rate, 0) + '%).' : '', strk && strk.streak > 1 ? 'Longest silence: <b>' + esc(strk.w) + '</b> — nothing posted for ' + strk.streak + ' day(s) in a row.' : '', lowSec ? 'Least posted block: <b>' + esc(lowSec[0]) + '</b> (' + lowSec[1] + ' warehouse-days).' : '', reposts ? fx(reposts) + ' day(s) were re-posted with a newer Header_ID.' : '']); };
    h += `<div class="pl-kpis" style="margin-top:12px">${kpi('Warehouses', fx(whs.length), fx(secs.length) + ' data sector(s)', '#4f46e5')}${kpi('Update rate', fx(rate, 1) + '%', fx(tot.ok + tot.pt) + ' of ' + fx(tot.exp) + ' WH-days', rate >= 95 ? '#16a34a' : rate >= 80 ? '#f59e0b' : '#dc2626')}${kpi('Fully updated', fx(tot.ok), 'all sectors posted', '#16a34a')}${kpi('Partly updated', fx(tot.pt), 'some sectors missing', '#f59e0b')}${kpi('Missing WH-days', fx(tot.no), 'nothing posted', '#dc2626')}${kpi(lastDay === today() ? 'Updated today' : 'Updated ' + (lastDay ? dmy(lastDay) : ''), fx(todayOk.length) + ' / ' + fx(whs.length), todayNo.length ? fx(todayNo.length) + ' still missing' : 'all in', todayNo.length ? '#dc2626' : '#16a34a')}${kpi('Re-posted days', fx(reposts), 'a newer Header_ID replaced the day', '#7c3aed')}${kpi('Last post', lastAt ? esc(tm(lastAt)) : '—', '', '#0ea5e9')}</div>`;
    if (todayNo.length) h += card('⚠ Not updated ' + (lastDay === today() ? 'today' : 'on ' + lastDay), '', `<div class="wd-chips">${todayNo.map(w => `<span>${esc(w)}</span>`).join('')}</div>`);
    /* charts */
    const perDay = days.map(d => { const ok = whs.filter(w => st(w, d).s !== 'no').length; return { l: dmy(d), v: whs.length ? ok / whs.length * 100 : 0, t: fx(whs.length ? ok / whs.length * 100 : 0), tip: d + ' (' + dow(d) + '): ' + ok + ' of ' + whs.length + ' warehouses posted', c: ok === whs.length ? '#16a34a' : ok / whs.length >= .8 ? '#f59e0b' : '#dc2626' }; });
    const perSec = secs.map(s => { let n = 0, e = 0; whs.forEach(w => { if (!M.R.some(r => r.wh === w && r.sec === s)) return; days.forEach(d => { e++; if (M.cell.get(w + '|' + d) && M.R.some(r => r.wh === w && r.date === d && r.sec === s)) n++; }); }); return { l: s, v: e ? n / e * 100 : 0, t: fx(e ? n / e * 100 : 0) + '%', tip: s + ': ' + n + ' of ' + e + ' WH-days', c: '#4f46e5' }; }).sort((a, b) => b.v - a.v);
    const perWh = sumW.slice().sort((a, b) => a.rate - b.rate).map(s => ({ l: s.w, v: s.rate, t: fx(s.rate) + '%', tip: s.w + ': ' + s.ok + ' full · ' + s.pt + ' partial · ' + s.no + ' missing', c: s.rate >= 95 ? '#16a34a' : s.rate >= 80 ? '#f59e0b' : '#dc2626' }));
    h += `<div class="wd-grid">${card('📈 Warehouses that posted, per day', '% of warehouses', colBars(perDay, { max: 100 }))}${card('🏭 Update rate by warehouse', 'lowest first', bars(perWh, { max: 100 }))}${card('🧩 Data sector coverage', '% of WH-days with that sector', bars(perSec, { max: 100 }))}</div>`;
    /* heat map */
    const hm = `<div class="wd-tw"><table class="wd-t"><thead><tr><th>Warehouse</th>${days.map(d => `<th class="wd-h" title="${d}">${dmy(d)}<br><small>${dow(d)}</small></th>`).join('')}<th>Rate</th></tr></thead><tbody>${sumW.map(s => `<tr><td>${esc(s.w)}</td>${days.map(d => { const x = st(s.w, d); const c = x.c; return `<td class="wd-h wd-${x.s}" title="${esc(s.w + ' · ' + d + (c ? ' · ' + c.secs.size + '/' + x.e + ' sector(s) · ' + [...c.secs].join(', ') + (c.by.size ? ' · by ' + [...c.by].join(', ') : '') + (c.last ? ' · last ' + tm(c.last) : '') : ' · nothing posted'))}">${x.s === 'no' ? '✘' : x.s === 'ok' ? '✔' : c.secs.size + '/' + x.e}</td>`; }).join('')}<td><span class="wd-pill ${s.rate >= 95 ? 'g' : s.rate >= 80 ? 'a' : 'r'}">${fx(s.rate)}%</span></td></tr>`).join('')}</tbody></table></div><div class="wd-lg" style="margin-top:6px"><span><i style="background:rgba(22,163,74,.5)"></i>all sectors posted</span><span><i style="background:rgba(245,158,11,.6)"></i>partly (x/y sectors)</span><span><i style="background:rgba(220,38,38,.4)"></i>nothing posted</span></div>`;
    h += analysis1() + '\u0001grid\u0001' + card('🗓 Warehouse × day', 'hover a cell for sectors, user and time', hm);
    /* summary table */
    h += '\u0001sum\u0001' + card('📋 Warehouse summary', 'days counted: ' + days.length, `<div class="wd-tw"><table class="wd-t"><thead><tr><th>Warehouse</th><th>Days counted</th><th>Fully updated</th><th>Partly</th><th>Missing</th><th>Update rate %</th><th>Last update</th><th>Last posted by</th><th>Missing in a row (to date)</th></tr></thead><tbody>${sumW.slice().sort((a, b) => a.rate - b.rate).map(s => `<tr><td>${esc(s.w)}</td><td>${s.exp}</td><td>${s.ok}</td><td>${s.pt}</td><td>${s.no}</td><td>${fx(s.rate, 1)}</td><td>${esc(s.last)}</td><td>${esc(s.by)}</td><td>${s.streak}</td></tr>`).join('')}</tbody></table></div>`);
    /* sector × warehouse detail */
    h += '\u0001post\u0001' + card('🧩 What each warehouse posted', 'rows of ' + LIST1 + ' per warehouse and sector', `<div class="wd-tw"><table class="wd-t"><thead><tr><th>Warehouse</th><th>Data sector</th><th>Days posted</th><th>Rows</th><th>Last date</th><th>Last posted by</th></tr></thead><tbody>${(() => { const g = new Map(); M.R.filter(r => !D.f.wh || r.wh === D.f.wh).forEach(r => { const k = r.wh + '|' + r.sec; let o = g.get(k); if (!o) g.set(k, o = { wh: r.wh, sec: r.sec, d: new Set(), n: 0, last: '', by: '', at: '' }); o.d.add(r.date); o.n++; if (r.date >= o.last) { o.last = r.date; if (r.by) o.by = r.by; } }); return [...g.values()].sort((a, b) => a.wh.localeCompare(b.wh) || a.sec.localeCompare(b.sec)).map(o => `<tr><td>${esc(o.wh)}</td><td>${esc(o.sec)}</td><td>${o.d.size}</td><td>${o.n}</td><td>${o.last}</td><td>${esc(o.by)}</td></tr>`).join(''); })()}</tbody></table></div>`);
    h += '\u0001blk\u0001' + blocksHtml(M, whs, days);
    shell('whdu', 'whdu', D, TABS1, split(h), fx(whs.length) + ' warehouse(s)'); say1('✔ ' + fx(D.rows.length) + ' row(s) · ' + D.how);
  }

  /* =====================================================================
     2) TEMPERATURE DAILY RECORDS
     ===================================================================== */
  const LIST2 = 'WHs_Temperature_Reading_tbl', LIM = 'Stores_Locations_tbl';
  const T = { loaded: false, loading: false, err: '', how: '', per: { from: shift(today(), -6), to: today() }, rows: [], lim: new Map(), tab: 'dash', f: { wh: '', by: '', alarm: '' } };
  const say2 = (t, w) => { const e = Q('#whtmpStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };
  function build2(items, M, limItems, sc) {
    T.lim = new Map(); (limItems || []).forEach(x => { const K = keys(x.fields), n = sv(K[nz('StoreDesc')] || K.title); if (!n) return; const t = nn(K[nz('StrMiniTemp')]), h0 = nn(K[nz('MiniHumdtyLevel')]), h = h0 == null ? null : (h0 > 1.5 ? h0 / 100 : h0); T.lim.set(nz(n), { n, t, h }); });
    const rows = []; items.forEach(x => { const K = keys(x.fields, M), date = dOnly(K[nz('Trans_Date')]); if (!date || date < T.per.from || date > T.per.to) return;
      const wh = sv(K[nz('WHs_Desc')]); if (!wh || !scopeOk(sc, wh)) return; const tk = Object.keys(K).find(k => /time/.test(k) && K[k] != null && K[k] !== '' && !/date/.test(k)), temp = nn(K[nz('Temperature_Degree')]), hum = nn(K[nz('Humidity_Reading')]), L = T.lim.get(nz(wh)) || {};
      const aT = temp != null && L.t != null && temp > L.t, aH = hum != null && L.h && hum / 100 > L.h;
      rows.push({ id: +x.id || 0, date, time: tk ? sv(K[tk]) : '', wh, temp, hum, by: sv(K[nz('Reading_By')]) || person(x), lt: L.t, lh: L.h, aT, aH, at: x.createdDateTime || '' }); });
    T.rows = rows.sort((a, b) => (b.date + b.time + b.id).localeCompare(a.date + a.time + a.id));
  }
  async function load2() {
    if (T.loading) return; T.loading = true; T.err = ''; render2();
    try { if (T.per.from > T.per.to) throw new Error('the period From is after To'); const t0 = Date.now(), R = await readPeriod(LIST2, 'Trans_Date', T.per.from, T.per.to, say2); let li = []; try { li = (await readAll(LIM)).items; } catch (e) { console.warn('limits', e); }
      build2(R.items, R.M, li, await scope()); T.how = R.how; T.loaded = true; say2(T.rows.length ? '✔ ' + fx(T.rows.length) + ' reading(s) · ' + new Set(T.rows.map(r => r.wh)).size + ' warehouse(s) · ' + R.how + ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s' : '⚠ No readings for this period.', !T.rows.length);
    } catch (e) { T.err = e.message; say2('⚠ ' + e.message, 1); } finally { T.loading = false; } render2();
  }
  const tcol = (r, v) => v == null ? '' : r.lt != null && v > r.lt ? 'wd-no' : r.lt != null && v > r.lt - 1 ? 'wd-pt' : 'wd-ok';
  const TABS2 = [['dash', '🌡 Dashboard'], ['var', '🔥 Variances & warnings'], ['trend', '📈 Trend by warehouse'], ['grid', '🗓 Warehouse × day'], ['sum', '📋 Warehouse summary'], ['alarms', '🚨 Alarms'], ['log', '🧾 Readings log']];
  function render2() {
    const v = Q('#view-whtmp'); if (!v) return;
    const all = T.rows, whsAll = [...new Set(all.map(r => r.wh))].sort(), byAll = [...new Set(all.map(r => r.by).filter(Boolean))].sort();
    const R = all.filter(r => (!T.f.wh || r.wh === T.f.wh) && (!T.f.by || r.by === T.f.by) && (T.f.alarm !== '1' || r.aT || r.aH));
    const extra = sel('whtmp', 'wh', 'Warehouse', whsAll, T.f.wh) + sel('whtmp', 'by', 'Read by', byAll, T.f.by) + `<label>Show<select data-whtmpf="alarm"><option value="">All readings</option><option value="1"${T.f.alarm === '1' ? ' selected' : ''}>Alarms only</option></select></label>`;
    let h = `<div class="wd-flt">` + hostBar('whtmp', T, extra) + `<div style="display:flex;align-items:center;gap:8px">${tools('whtmp')}</div>` + scopeNote() + `<div id="whtmpStatus" class="status-msg" style="font-size:12px"></div>${loadingBar(T)}</div>`;
    if (!T.loaded || !all.length) { shell('whtmp', 'whtmp', T, TABS2, { dash: h + (T.loading ? '' : `<div class="card"><div class="wd-none">${T.err ? '⚠ ' + esc(T.err) : T.loaded ? 'No readings in this period.' : 'Choose the period and press Load.'}</div></div>`) }); say2(T.err ? '⚠ ' + T.err : ''); return; }
    const temps = R.map(r => r.temp).filter(x => x != null), hums = R.map(r => r.hum).filter(x => x != null), aT = R.filter(r => r.aT), aH = R.filter(r => r.aH), t = today();
    const whsAct = [...new Set(R.map(r => r.wh))], noToday = (T.f.wh ? [T.f.wh] : whsAll).filter(w => !all.some(r => r.wh === w && r.date === t)), last = R[0];
    h += `<div class="pl-kpis" style="margin-top:12px">${kpi('Readings', fx(R.length), fx(whsAct.length) + ' warehouse(s)', '#4f46e5')}${kpi('Average °C', fx(avg(temps), 1), 'max ' + fx(temps.length ? Math.max(...temps) : null, 1) + ' · min ' + fx(temps.length ? Math.min(...temps) : null, 1), '#0ea5e9')}${kpi('Temperature alarms', fx(aT.length), 'above the store limit', aT.length ? '#dc2626' : '#16a34a')}${kpi('Humidity alarms', fx(aH.length), 'above the store limit', aH.length ? '#dc2626' : '#16a34a')}${kpi('Average humidity', hums.length ? fx(avg(hums), 0) + '%' : '—', '', '#7c3aed')}${kpi('No reading today', fx(noToday.length), noToday.length ? 'warehouses still missing' : 'all warehouses read', noToday.length ? '#f59e0b' : '#16a34a')}${kpi('Latest reading', last ? esc(dmy(last.date) + ' ' + last.time) : '—', last ? esc(last.wh + ' · ' + fx(last.temp, 1) + '°') : '', '#0d9488')}</div>`;
    if (noToday.length) h += card('⚠ No temperature reading today', '', `<div class="wd-chips">${noToday.map(w => `<span>${esc(w)}</span>`).join('')}</div>`);
    /* ⚠ warnings: latest reading of every warehouse against its limit, rising trend, repeated breaches */
    const seqOf = w => R.filter(r => r.wh === w && r.temp != null).sort((x, y) => (x.date + x.time + x.id).localeCompare(y.date + y.time + y.id));
    const WS = whsAct.map(w => { const q = seqOf(w), l = q[q.length - 1], L = T.lim.get(nz(w)) || {}, br = q.filter(r => r.aT), ex = br.map(r => r.temp - r.lt), last3 = q.slice(-3), rising = last3.length === 3 && last3[0].temp < last3[1].temp && last3[1].temp < last3[2].temp, near = l && L.t != null && l.temp <= L.t && l.temp > L.t - 1.5;
      return { w, q, l, lim: L.t, br, maxEx: ex.length ? Math.max(...ex) : 0, avgEx: avg(ex), cur: l && L.t != null ? l.temp - L.t : null, above: l && l.aT, rising, near, hAbove: l && l.aH }; }).filter(x => x.l);
    const crit = WS.filter(x => x.above), warnW = WS.filter(x => !x.above && ((x.rising && x.near) || x.near || x.br.length >= 3 || x.hAbove));
    if (crit.length || warnW.length) h += `<div class="card wd-card" style="border:2px solid ${crit.length ? '#dc2626' : '#f59e0b'};background:${crit.length ? 'rgba(220,38,38,.07)' : 'rgba(245,158,11,.08)'}"><div class="card-header"><div class="card-title">${crit.length ? '🚨 WARNING — temperature above the limit' : '⚠ Watch list'}</div></div><div style="display:flex;flex-direction:column;gap:6px">`
      + crit.map(x => `<div><span class="wd-pill r">ABOVE LIMIT</span> <b>${esc(x.w)}</b> — last reading <b>${fx(x.l.temp, 1)}°C</b> on ${esc(dmy(x.l.date) + ' ' + x.l.time)} vs limit ${x.lim}°C (<b>+${fx(x.cur, 1)}°</b>)${x.br.length > 1 ? ' · ' + x.br.length + ' reading(s) above the limit in this period' : ''}${x.rising ? ' · ↗ rising' : ''}</div>`).join('')
      + warnW.map(x => `<div><span class="wd-pill a">WATCH</span> <b>${esc(x.w)}</b> — ${x.near ? 'last reading ' + fx(x.l.temp, 1) + '°C is within 1.5° of the ' + x.lim + '°C limit' : ''}${x.rising ? (x.near ? ' · ' : '') + '↗ the last 3 readings are rising' : ''}${x.br.length >= 3 ? ' · ' + x.br.length + ' readings above the limit in the period' : ''}${x.hAbove ? ' · humidity above limit (' + fx(x.l.hum, 0) + '%)' : ''}</div>`).join('') + '</div></div>';
    const analysis2 = () => { const top = WS.slice().sort((a, b) => b.maxEx - a.maxEx)[0]; return analysis([crit.length ? '🚨 <b>' + crit.length + ' warehouse(s) are above their limit right now</b>: ' + crit.map(x => esc(x.w) + ' (+' + fx(x.cur, 1) + '°)').join(', ') + '.' : '✔ No warehouse is above its limit on the latest reading.', warnW.length ? '⚠ ' + warnW.length + ' warehouse(s) on the watch list: ' + warnW.map(x => esc(x.w)).join(', ') + '.' : '', top && top.maxEx > 0 ? 'Highest abnormal variance: <b>' + esc(top.w) + '</b> reached <b>+' + fx(top.maxEx, 1) + '°</b> above its ' + top.lim + '° limit.' : '', aT.length ? fx(aT.length) + ' temperature reading(s) and ' + fx(aH.length) + ' humidity reading(s) above the store limits.' : 'No temperature reading above a limit in this period.', noToday.length ? noToday.length + ' warehouse(s) have no reading today: ' + noToday.map(esc).join(', ') + '.' : '', 'Average temperature <b>' + fx(avg(temps), 1) + '°C</b> over ' + fx(R.length) + ' reading(s).']); };
    h += '\u0001var\u0001';
    /* highest abnormal variances */
    const ab = R.filter(r => r.aT).map(r => ({ r, ex: r.temp - r.lt })).sort((x, y) => y.ex - x.ex);
    h += `<div class="wd-grid">${card('🔥 Highest abnormal variances by warehouse', 'worst reading above the limit in the period', WS.filter(x => x.br.length).length ? bars(WS.filter(x => x.br.length).sort((a, b) => b.maxEx - a.maxEx).map(x => ({ l: x.w, v: x.maxEx, t: '+' + fx(x.maxEx, 1) + '°', tip: x.w + ': worst +' + fx(x.maxEx, 1) + '° · average +' + fx(x.avgEx, 1) + '° · ' + x.br.length + ' reading(s) above ' + x.lim + '°', c: x.maxEx >= 5 ? '#b91c1c' : x.maxEx >= 2 ? '#dc2626' : '#f59e0b' })), {}) : '<div class="wd-none">✔ No warehouse went above its limit.</div>')}`
      + card('📋 Variance summary', 'readings above the limit', `<div class="wd-tw" style="max-height:330px"><table class="wd-t"><thead><tr><th>Warehouse</th><th>Limit °C</th><th>Last reading</th><th>Now vs limit</th><th>Readings above</th><th>Worst +°</th><th>Average +°</th></tr></thead><tbody>${WS.slice().sort((a, b) => b.maxEx - a.maxEx).map(x => `<tr><td>${esc(x.w)}</td><td>${x.lim != null ? x.lim : '—'}</td><td>${fx(x.l.temp, 1)}</td><td class="${x.cur == null ? '' : x.cur > 0 ? 'wd-no' : x.cur > -1.5 ? 'wd-pt' : 'wd-ok'}">${x.cur == null ? '—' : (x.cur > 0 ? '+' : '') + fx(x.cur, 1)}</td><td>${x.br.length || 0}</td><td>${x.br.length ? '+' + fx(x.maxEx, 1) : '—'}</td><td>${x.br.length ? '+' + fx(x.avgEx, 1) : '—'}</td></tr>`).join('')}</tbody></table></div>`) + '</div>';
    h += card('🚩 Worst individual readings', 'ranked by how far above the limit', ab.length ? `<div class="wd-tw" style="max-height:380px"><table class="wd-t"><thead><tr><th>#</th><th>Warehouse</th><th>Date</th><th>Time</th><th>Temp °C</th><th>Limit °C</th><th>Variance</th><th>Humidity %</th><th>Read by</th></tr></thead><tbody>${ab.slice(0, 20).map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.r.wh)}</td><td>${x.r.date}</td><td>${esc(x.r.time)}</td><td class="wd-no">${fx(x.r.temp, 1)}</td><td>${x.r.lt}</td><td class="wd-no"><b>+${fx(x.ex, 1)}°</b></td><td>${x.r.hum != null ? fx(x.r.hum, 0) : '—'}</td><td>${esc(x.r.by)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="wd-none">✔ No reading above its limit.</div>');
    /* trend of every warehouse */
    h += '\u0001trend\u0001'; h += card('📈 Temperature trend by warehouse', 'every reading in order · red dots = above the limit, dashed line = limit', `<div class="wd-grid" style="margin-top:0">${WS.slice(0, 16).map(x => `<div class="card" style="margin:0;border-left:5px solid ${x.above ? '#dc2626' : x.near ? '#f59e0b' : '#16a34a'}"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(x.w)}</b><span class="wd-pill ${x.above ? 'r' : x.near ? 'a' : 'g'}">${x.above ? 'ABOVE LIMIT' : x.near ? 'NEAR LIMIT' : 'WITHIN LIMIT'}</span></div><div class="text-sm">last ${fx(x.l.temp, 1)}°C · min ${fx(Math.min(...x.q.map(r => r.temp)), 1)} · max ${fx(Math.max(...x.q.map(r => r.temp)), 1)}${x.lim != null ? ' · limit ' + x.lim + '°' : ''}</div>${line([{ n: x.w, c: '#0ea5e9', p: x.q.map(r => ({ x: dmy(r.date) + (r.time ? ' ' + r.time : ''), y: r.temp, bad: r.aT })) }], { limit: x.lim != null ? x.lim : undefined })}</div>`).join('')}</div>`);
    /* charts */
    const days = []; for (let d = T.per.from; d <= T.per.to; d = shift(d, 1)) days.push(d);
    const byDay = d => R.filter(r => r.date === d && r.temp != null), lineS = [{ n: 'Average °C', c: '#0ea5e9', p: days.map(d => { const a = byDay(d); return { x: dmy(d), y: a.length ? avg(a.map(r => r.temp)) : null }; }) }, { n: 'Max °C', c: '#ef4444', p: days.map(d => { const a = byDay(d); const m = a.length ? Math.max(...a.map(r => r.temp)) : null; return { x: dmy(d), y: m, bad: a.some(r => r.aT) }; }) }];
    const oneLim = T.f.wh && T.lim.get(nz(T.f.wh)) ? T.lim.get(nz(T.f.wh)).t : null;
    const perWh = whsAct.map(w => { const a = R.filter(r => r.wh === w && r.temp != null).map(r => r.temp), L = T.lim.get(nz(w)) || {}, mx = a.length ? Math.max(...a) : 0; return { l: w, v: mx, t: fx(mx, 1) + '°', m: L.t != null ? L.t : undefined, tip: w + ': max ' + fx(mx, 1) + '° · avg ' + fx(avg(a), 1) + '°' + (L.t != null ? ' · limit ' + L.t + '°' : ''), c: L.t != null && mx > L.t ? '#dc2626' : '#0ea5e9' }; }).sort((a, b) => b.v - a.v);
    const perDayN = days.map(d => ({ l: dmy(d), v: R.filter(r => r.date === d).length, t: String(R.filter(r => r.date === d).length), tip: d + ' (' + dow(d) + '): ' + R.filter(r => r.date === d).length + ' reading(s)', c: '#6366f1' }));
    const humW = whsAct.map(w => { const a = R.filter(r => r.wh === w && r.hum != null).map(r => r.hum); const L = T.lim.get(nz(w)) || {}; return { l: w, v: a.length ? avg(a) : 0, t: a.length ? fx(avg(a), 0) + '%' : '—', m: L.h ? L.h * 100 : undefined, tip: w + ': avg humidity ' + fx(avg(a), 0) + '%' + (L.h ? ' · limit ' + fx(L.h * 100, 0) + '%' : ''), c: L.h && a.length && avg(a) / 100 > L.h ? '#dc2626' : '#7c3aed' }; }).sort((a, b) => b.v - a.v);
    h += '\u0001dash\u0001' + analysis2() + `<div class="wd-grid">${card('📈 Temperature trend', 'daily average and maximum' + (oneLim != null ? '' : ''), line(lineS, { limit: oneLim }))}${card('🏭 Highest reading by warehouse', 'red line = store limit', bars(perWh, { max: Math.max(1, ...perWh.map(x => Math.max(x.v, x.m || 0))) * 1.05 }))}${card('🧮 Readings per day', '', colBars(perDayN))}${card('💧 Average humidity by warehouse', 'red line = store limit', bars(humW, { max: 100 }))}</div>`;
    /* heat map warehouse × day (max temp) */
    const hmRows = whsAct.slice().sort();
    h += '\u0001grid\u0001' + card('🗓 Warehouse × day', 'highest temperature of the day · red = above limit, amber = within 1° of limit', `<div class="wd-tw"><table class="wd-t"><thead><tr><th>Warehouse</th><th>Limit °C</th>${days.map(d => `<th class="wd-h" title="${d}">${dmy(d)}<br><small>${dow(d)}</small></th>`).join('')}</tr></thead><tbody>${hmRows.map(w => { const L = T.lim.get(nz(w)) || {}; return `<tr><td>${esc(w)}</td><td>${L.t != null ? L.t : '—'}</td>${days.map(d => { const a = R.filter(r => r.wh === w && r.date === d && r.temp != null); if (!a.length) return `<td class="wd-h wd-off" title="no reading">·</td>`; const mx = Math.max(...a.map(r => r.temp)); return `<td class="wd-h ${tcol({ lt: L.t }, mx)}" title="${esc(w + ' ' + d + ': ' + a.length + ' reading(s), max ' + mx.toFixed(1) + '°, avg ' + avg(a.map(r => r.temp)).toFixed(1) + '°')}">${mx.toFixed(1)}</td>`; }).join('')}</tr>`; }).join('')}</tbody></table></div>`);
    /* summary table */
    h += '\u0001sum\u0001' + card('📋 Warehouse summary', '', `<div class="wd-tw"><table class="wd-t"><thead><tr><th>Warehouse</th><th>Readings</th><th>Avg °C</th><th>Min °C</th><th>Max °C</th><th>Limit °C</th><th>Temp alarms</th><th>Avg humidity %</th><th>Humidity alarms</th><th>Last reading</th><th>Read by</th></tr></thead><tbody>${hmRows.map(w => { const a = R.filter(r => r.wh === w), tt = a.map(r => r.temp).filter(x => x != null), hh = a.map(r => r.hum).filter(x => x != null), L = T.lim.get(nz(w)) || {}, l = a[0]; return `<tr><td>${esc(w)}</td><td>${a.length}</td><td>${fx(avg(tt), 1)}</td><td>${fx(tt.length ? Math.min(...tt) : null, 1)}</td><td>${fx(tt.length ? Math.max(...tt) : null, 1)}</td><td>${L.t != null ? L.t : '—'}</td><td>${a.filter(r => r.aT).length ? `<span class="wd-pill r">${a.filter(r => r.aT).length}</span>` : 0}</td><td>${hh.length ? fx(avg(hh), 0) : '—'}</td><td>${a.filter(r => r.aH).length ? `<span class="wd-pill r">${a.filter(r => r.aH).length}</span>` : 0}</td><td>${esc(l ? l.date + ' ' + l.time : '')}</td><td>${esc(l ? l.by : '')}</td></tr>`; }).join('')}</tbody></table></div>`);
    /* alarms */
    const al = R.filter(r => r.aT || r.aH);
    h += '\u0001alarms\u0001' + card('🚨 Alarms', fx(al.length) + ' reading(s) above a store limit', al.length ? `<div class="wd-tw"><table class="wd-t"><thead><tr><th>Warehouse</th><th>Date</th><th>Time</th><th>Temp °C</th><th>Temp limit</th><th>Humidity %</th><th>Humidity limit %</th><th>Read by</th></tr></thead><tbody>${al.slice(0, 500).map(r => `<tr><td>${esc(r.wh)}</td><td>${r.date}</td><td>${esc(r.time)}</td><td class="${r.aT ? 'wd-no' : ''}">${fx(r.temp, 1)}</td><td>${r.lt != null ? r.lt : '—'}</td><td class="${r.aH ? 'wd-no' : ''}">${r.hum != null ? fx(r.hum, 0) : '—'}</td><td>${r.lh ? fx(r.lh * 100, 0) : '—'}</td><td>${esc(r.by)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="wd-none">✔ No alarms in this period.</div>');
    /* log */
    h += '\u0001log\u0001' + card('🧾 Readings log', 'latest ' + Math.min(R.length, 400) + ' of ' + fx(R.length), `<div class="wd-tw"><table class="wd-t"><thead><tr><th>Warehouse</th><th>Date</th><th>Time</th><th>Temp °C</th><th>Humidity %</th><th>Read by</th><th>Entered</th></tr></thead><tbody>${R.slice(0, 400).map(r => `<tr><td>${esc(r.wh)}</td><td>${r.date}</td><td>${esc(r.time)}</td><td class="${r.aT ? 'wd-no' : ''}">${fx(r.temp, 1)}</td><td class="${r.aH ? 'wd-no' : ''}">${r.hum != null ? fx(r.hum, 0) : '—'}</td><td>${esc(r.by)}</td><td>${esc(tm(r.at))}</td></tr>`).join('')}</tbody></table></div>`);
    shell('whtmp', 'whtmp', T, TABS2, split(h), fx(all.length) + ' reading(s)'); say2('✔ ' + fx(all.length) + ' reading(s) · ' + T.how);
  }

  /* ---------- wiring ---------- */
  function wire(id, p, S, load, render) {
    const v = Q('#view-' + id); if (!v || v._wd) return; v._wd = 1;
    v.addEventListener('change', e => { const t = e.target, pk = t.dataset[p], fk = t.dataset[p + 'f']; if (pk) { S.per[pk] = t.value; return; } if (fk) { S.f[fk] = t.value; render(); } });
    v.addEventListener('click', e => { const tbn = e.target.closest('[data-' + p + '-tab]'); if (tbn) { S.tab = tbn.dataset[p + 'Tab']; render(); return; } const wc = e.target.closest('[data-whdu-wh]'); if (wc && p === 'whdu') { S.f.bw = wc.dataset.whduWh === S.f.bw ? '' : wc.dataset.whduWh; render(); const bd = Q('#view-whdu .wd-card[style*="2px"]'); if (S.f.bw && bd) bd.scrollIntoView({ block: 'nearest' }); return; } const b = e.target.closest('button'); if (!b) return; const q = b.dataset[p + 'Q'], tl = b.dataset[p + 'Tl'];
      if (b.dataset[p + 'Blk'] != null) { S.f.blk = b.dataset[p + 'Blk']; S.f.bd = ''; S.f.bw = ''; render(); return; } if (q != null) { period(S, +q); render(); load(); return; } if (b.dataset[p + 'Go']) { load(); return; }
      if (tl) { if (!window.SDBPAGE) return toast('Page tools not ready', 'warn'); const title = id === 'whdu' ? 'WHs Daily Data Update' : 'Temperature Daily Records', root = v; if (!S.loaded || !S.rows.length) return toast('Nothing loaded yet.', 'warn'); SDBPAGE[tl](root, title, S.per.from + ' → ' + S.per.to); } });
    const nav = Q('.nav-item[data-view="' + id + '"]'); if (nav) nav.addEventListener('click', () => { render(); if (!S.loaded && !S.loading) setTimeout(load, 60); });
    const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (typeof activeViewId === 'function' && activeViewId() === id) { e.stopImmediatePropagation(); load(); } }, true);
  }
  function init() { wire('whdu', 'whdu', D, load1, render1); wire('whtmp', 'whtmp', T, load2, render2); render1(); render2(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.WHDU = { D, T, load1, load2 };
})();
