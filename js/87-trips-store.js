/* ============================================================
   🛣 TRIPS STORE — Trls_Daily_Activity_tbl for the Logistics dashboard, without the long wait
   · reads ONLY the days of the chosen period (server-side date filter, one request per day, 4 days at a time, newest first)
   · asks SharePoint for ONLY the columns the dashboard uses (much smaller pages)
   · keeps every day it has read in this browser (IndexedDB) → the next opening is instant;
     afterwards only the last 3 days (and days that still have open trips) are read again
   · if SharePoint refuses the date filter (big list, Trans_Date not indexed) it reads the newest items first and stops
     at the start of the period — still no full download
   window.TRX = { S, load(force), trips(), rows(), status() }
   ============================================================ */
(function () {
  'use strict';
  const nz = x => String(x || '').toLowerCase().replace(/_x0020_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymdL = d => { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }, ymdU = d => new Date(d).toISOString().slice(0, 10);
  const DAY = 864e5, BASE = (typeof LS_BASE !== 'undefined' ? LS_BASE : 'orbit');
  const WANT = ['Title', 'Trans_Date', 'User_Name', 'Driver_FileNr', 'Unit_Nr', 'Trailer_Nr', 'Distn_From', 'Loaction_From', 'Distn_To', 'Location_To', 'Nr_Of_Plts', 'Trls_Task_Type', 'Loaded_Mtrl_Type', 'Task_Source', 'Task_Type', 'Trip_Status', 'Trip_Closed',
    'Region_Desc', 'Latitude_Crdnts', 'Longtitude_Crdnts', 'Start_TimeStamp', 'TimeStamp_Start', 'End_TimeStamp', 'TimeStamp_End', 'Trip_KMs', 'Trip_Time', 'DN_Nr', 'Record_Nr', 'Close_Trip_ID', 'WHs_Arrival_Status', 'Remarks'];
  const S = { map: new Map(), ver: 0, days: (() => { try { return Math.min(90, Math.max(7, +localStorage.getItem(BASE + '_trx_days') || 60)); } catch (e) { return 60; } })(),
    busy: false, err: '', at: 0, ms: 0, got: 0, todo: 0, done: 0, mode: (() => { try { return localStorage.getItem(BASE + '_trx_mode') || ''; } catch (e) { return ''; } })(), list: '', cached: false, idx: true };
  const listName = () => { try { const u = typeof utGet === 'function' && utGet('lpdaily'); return (u && u.list) || 'Trls_Daily_Activity_tbl'; } catch (e) { return 'Trls_Daily_Activity_tbl'; } };

  /* ---------- this browser's cache (IndexedDB) ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('no IndexedDB')); const q = indexedDB.open('orbit_trx', 1);
    q.onupgradeneeded = () => { const d = q.result; if (!d.objectStoreNames.contains('it')) d.createObjectStore('it', { keyPath: 'k' }); if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' }); };
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
  const idbAll = st => db().then(d => new Promise((res, rej) => { const q = d.transaction(st, 'readonly').objectStore(st).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); })).catch(() => []);
  const idbPut = (st, puts, dels) => db().then(d => new Promise(res => { const t = d.transaction(st, 'readwrite'), o = t.objectStore(st); (puts || []).forEach(x => o.put(x)); (dels || []).forEach(k => o.delete(k)); t.oncomplete = () => res(); t.onerror = () => res(); t.onabort = () => res(); })).catch(() => {});
  const META = new Map();

  /* ---------- one SharePoint item → one compact row ---------- */
  const tsOf = v => { if (!v) return 0; const t = Date.parse(v); return isNaN(t) ? 0 : t; };
  const val = v => v == null ? '' : typeof v === 'object' ? (v.Value || v.LookupValue || v.Title || v.Email || '') : v;
  function row(it, C) { const f = it.fields || {}, g = k => { const c = C[k]; return c ? val(f[c]) : ''; }, s = k => String(g(k)).trim(), n = k => { const x = parseFloat(String(g(k)).replace(/,/g, '')); return isFinite(x) ? x : 0; }, ll = k => { const x = parseFloat(String(g(k)).replace(/,/g, '')); return isFinite(x) ? x : null; };
    const td = tsOf(g('Trans_Date')) || tsOf(it.createdDateTime), title = s('Title'), rec = s('Record_Nr'), log = /^(CLS|CXL)-/i.test(title) || /^(CLS|CXL)-/i.test(rec);
    const st = tsOf(g('Start_TimeStamp')) || tsOf(g('TimeStamp_Start')), en = tsOf(g('End_TimeStamp')) || tsOf(g('TimeStamp_End')), cl = g('Trip_Closed');
    return { k: S.list + '|' + it.id, id: +it.id || it.id, c: td ? ymdU(td) : '', date: td ? ymdL(td) : '', ts: td, log, title, rec, driver: s('User_Name'), file: s('Driver_FileNr').replace(/\.0+$/, ''), unit: s('Unit_Nr'), trailer: s('Trailer_Nr'),
      from: s('Distn_From'), floc: s('Loaction_From'), to: s('Distn_To'), tloc: s('Location_To'), plts: n('Nr_Of_Plts'), mat: s('Trls_Task_Type') || s('Loaded_Mtrl_Type'), src: s('Task_Source'), task: s('Task_Type'), status0: s('Trip_Status'),
      closed: cl === true || /^(true|yes|1)$/i.test(String(cl)), region: s('Region_Desc'), lat: ll('Latitude_Crdnts'), lng: ll('Longtitude_Crdnts'), st, en, km: n('Trip_KMs'), ttime: s('Trip_Time'), dn: s('DN_Nr'), cid: s('Close_Trip_ID'), arr: s('WHs_Arrival_Status'), rem: s('Remarks'), cr: tsOf(it.createdDateTime) }; }
  /* the trip's state as the dashboard shows it */
  function stat(r) { const x = (r.status0 + ' ' + r.task).toLowerCase(); if (/cancel/.test(x)) return 'Cancelled'; if (/complet|end trip/.test(x)) return 'Completed'; if (r.closed) return 'Completed'; if (/start/.test(x) || r.st) return 'In progress'; return r.date && r.date < ymdL(Date.now()) ? 'Not started' : 'Planned'; }

  /* ---------- reading ---------- */
  let C = null, CK = '', TOP = 2000;
  async function getJ(url, token) { const r = await fetchWithRetry(url, { headers: { Authorization: 'Bearer ' + token, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } }, 'trips');
    if (!r.ok) { let t = ''; try { t = await r.text(); } catch (e) {} const e = new Error('SharePoint ' + r.status + (t ? ': ' + t.replace(/\s+/g, ' ').slice(0, 160) : '')); e.status = r.status; e.thr = r.status === 422 || r.status === 503 || /threshold|tooManyResources|not indexed|prohibited|indexed/i.test(t); throw e; }
    return r.json(); }
  async function cols(ids, token) { const key = ids.listId; if (C && CK === key) return C; const L = await fetchColumns(ids.siteId, ids.listId, token), M = new Map(); L.forEach(c => { M.set(nz(c.name), c.name); if (!M.has(nz(c.displayName))) M.set(nz(c.displayName), c.name); });
    C = {}; WANT.forEach(k => { const c = M.get(nz(k)) || (k === 'Nr_Of_Plts' ? M.get('nrofplts') : null) || (ALT[k] || []).map(a => M.get(a)).find(Boolean) || null; if (c) C[k] = c; }); CK = key; return C; }
  const ALT = { Latitude_Crdnts: ['latitudescrdnts', 'latitude', 'lat'], Longtitude_Crdnts: ['longitudecrdnts', 'longitudescrdnts', 'longtitudescrdnts', 'longitude', 'lng', 'long'] };
  const base = ids => `https://graph.microsoft.com/v1.0/sites/${ids.siteId}/lists/${ids.listId}/items`;
  const qs = () => `$select=id,createdDateTime&$expand=fields($select=${[...new Set(Object.values(C))].join(',')})&$top=${TOP}`;
  function ingest(items, chunk) { const seen = new Set(), puts = []; items.forEach(it => { const r = row(it, C); seen.add(r.k); S.map.set(r.k, r); puts.push(r); });
    const dels = []; if (chunk) S.map.forEach((r, k) => { if (r.c === chunk && !seen.has(k) && k.startsWith(S.list + '|')) { S.map.delete(k); dels.push(k); } });
    S.got += items.length; S.ver++; return idbPut('it', puts, dels); }
  async function readDay(ids, token, c) { const a = c + 'T00:00:00Z', b = ymdU(Date.parse(a) + DAY) + 'T00:00:00Z', dc = C.Trans_Date || 'Trans_Date';
    let url = base(ids) + '?' + qs() + '&$filter=' + encodeURIComponent(`fields/${dc} ge '${a}' and fields/${dc} lt '${b}'`), out = [];
    while (url) { let d; try { d = await getJ(url, token); } catch (e) { if (e.status === 400 && TOP > 200 && /top/i.test(e.message)) { TOP = 200; url = url.replace(/%24top=\d+|\$top=\d+/, '$top=200'); continue; } throw e; } out = out.concat(d.value || []); url = d['@odata.nextLink'] || null; }
    await ingest(out, c); const m = { k: S.list + '|' + c, at: Date.now() }; META.set(m.k, m); await idbPut('meta', [m]); }
  /* newest items first, stop once they were created before the period (no index needed) */
  async function scan(ids, token, stopTs) { let url = base(ids) + '?' + qs() + '&$orderby=id desc';
    while (url) { const d = await getJ(url, token), v = d.value || []; await ingest(v); S.done++; if (!v.length || Math.min(...v.map(it => tsOf(it.createdDateTime) || Infinity)) < stopTs) break; url = d['@odata.nextLink'] || null; } }

  let firstLoad = null;
  async function fromCache() { if (firstLoad) return firstLoad; return firstLoad = (async () => { S.list = listName(); const [it, me] = await Promise.all([idbAll('it'), idbAll('meta')]);
    it.forEach(r => { if (r.k && r.k.startsWith(S.list + '|')) S.map.set(r.k, r); }); me.forEach(m => META.set(m.k, m)); S.cached = S.map.size > 0; if (S.cached) S.ver++;
    /* drop what is older than 150 days */
    const old = ymdL(Date.now() - 150 * DAY), dels = []; S.map.forEach((r, k) => { if (r.date && r.date < old) { S.map.delete(k); dels.push(k); } }); if (dels.length) idbPut('it', [], dels); })(); }

  let RUN = null;
  function load(force) { if (RUN) return RUN; RUN = load0(force).finally(() => { RUN = null; }); return RUN; }
  async function load0(force) {
    S.busy = true; S.ver++; await fromCache(); const token = typeof getGlobalAccessToken === 'function' && getGlobalAccessToken(), site = typeof getGlobalSiteUrl === 'function' && getGlobalSiteUrl();
    if (!token || !site) { S.busy = false; S.err = 'Sign in to read the trips from SharePoint' + (S.cached ? ' — showing what this device already has.' : '.'); S.ver++; return; }
    if (force && S.mode === 'scan') { S.mode = ''; try { localStorage.removeItem(BASE + '_trx_mode'); } catch (e) {} }
    S.busy = true; S.err = ''; S.got = 0; S.done = 0; S.todo = 0; const t0 = performance.now(), quiet = () => { window.__opQuiet = Date.now() + 120000; }; quiet();
    try { S.list = listName(); const ids = await resolveIds(site, S.list, token); await cols(ids, token); quiet();
      const now = Date.now(), todayU = ymdU(now), first = ymdU(Date.parse(ymdL(now - (S.days - 1) * DAY) + 'T00:00:00Z') - DAY);
      const chunks = []; for (let t = Date.parse(todayU + 'T00:00:00Z') + DAY; ; t -= DAY) { const c = ymdU(t); chunks.push(c); if (c <= first) break; }
      /* days that still have trips on the road are read again (their close updates the same item) */
      const openC = new Set(); S.map.forEach(r => { if (!r.log && r.c >= ymdU(now - 14 * DAY) && /In progress|Planned|Not started/.test(stat(r))) openC.add(r.c); });
      const regeo = (() => { try { return !localStorage.getItem(BASE + '_trx_geo1'); } catch (e) { return false; } })(), full = force || regeo;
      const need = chunks.filter(c => { if (full) return true; const m = META.get(S.list + '|' + c); if (!m) return true; if (c >= ymdU(now - 2 * DAY)) return true; if (openC.has(c) && now - m.at > 30 * 60e3) return true; return m.at < Date.parse(c + 'T00:00:00Z') + DAY + 36 * 36e5; });
      if (S.mode !== 'scan') { S.todo = need.length; let i = 0, fail = null;
        const worker = async () => { while (i < need.length && !fail) { const c = need[i++]; try { await readDay(ids, token, c); quiet(); S.done++; S.ver++; } catch (e) { if (e.thr || e.status === 400) { fail = e; return; } throw e; } } };
        await Promise.all([worker(), worker(), worker(), worker()]);
        if (fail) { S.mode = 'scan'; S.idx = false; S.done = 0; try { localStorage.setItem(BASE + '_trx_mode', 'scan'); } catch (e) {} } else S.mode = 'days'; }
      if (S.mode === 'scan') { const mk = S.list + '|scan', m = META.get(mk), from = Date.parse(first + 'T00:00:00Z'), stop = full || !m || m.from > from ? from - 3 * DAY : Math.min(m.at - 3 * DAY, now - 3 * DAY); S.todo = 0;
        await scan(ids, token, stop); const mm = { k: mk, at: now, from: Math.min(from, m && !force ? m.from : from) }; META.set(mk, mm); await idbPut('meta', [mm]); }
      S.at = Date.now(); S.ms = performance.now() - t0; S.cached = true; try { localStorage.setItem(BASE + '_trx_geo1', '1'); } catch (e) {}
    } catch (e) { console.error(e); S.err = e.message || String(e); }
    finally { S.busy = false; S.ver++; } }

  let TC = { v: -1, a: [] }, RC = { v: -1, a: [] };
  const rows = () => { if (RC.v !== S.ver) RC = { v: S.ver, a: [...S.map.values()].filter(r => r.k.startsWith(S.list + '|')) }; return RC.a; };
  /* The driver of a trip is identified by the FILE NO. — the stored User_Name is sometimes the person who uploaded / closed the record (one name on hundreds of trips with different file numbers).
     For every file no. we take the name that really belongs to it: the most frequent name of that file among names that are not "accounts" (a name seen on more than 3 different file numbers),
     else the name in the Logistics plan for that file no.; if neither is known the row shows "File <no.>" instead of a wrong name. */
  function fixDrivers(A) {
    const nf = new Map(), fn = new Map(), plan = new Map();
    A.forEach(r => { if (r.drv0 === undefined) r.drv0 = r.driver; const f = r.file, d = r.drv0; if (!f || !d) return; (nf.get(d) || nf.set(d, new Set()).get(d)).add(f); const m = fn.get(f) || fn.set(f, new Map()).get(f); m.set(d, (m.get(d) || 0) + 1); });
    const acct = new Set(); nf.forEach((set, n) => { if (set.size > 3) acct.add(n); });
    try { ((typeof lp !== 'undefined' && lp && lp.rows) || []).forEach(p => { const f = String(p.fileNo || '').replace(/\.0+$/, '').trim(), d = String(p.driver || '').trim(); if (f && d && !plan.has(f)) plan.set(f, d); }); } catch (e) {}
    const res = new Map(); fn.forEach((m, f) => { let best = '', bn = 0; m.forEach((n, d) => { if (!acct.has(d) && n > bn) { best = d; bn = n; } }); res.set(f, best || plan.get(f) || ''); });
    A.forEach(r => { const d0 = r.drv0 || ''; if (r.file) { const d = res.get(r.file) || plan.get(r.file) || ''; r.driver = d || (acct.has(d0) || !d0 ? 'File ' + r.file : d0); r.dfix = r.driver !== d0; } else r.driver = d0; });
    return A; }
  const trips = () => { if (TC.v !== S.ver) TC = { v: S.ver, a: fixDrivers(rows().filter(r => !r.log && r.date).map(r => (r.s = stat(r), r.h = r.st && r.en && r.en > r.st ? (r.en - r.st) / 36e5 : 0, r))) }; return TC.a; };
  const tm = t => t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  function status() { const n = rows().length;
    if (S.busy) return `⏳ Reading SharePoint… ${S.todo ? S.done + ' / ' + S.todo + ' day(s)' : S.done + ' page(s)'} · ${S.got.toLocaleString()} record(s) so far${n ? ' · the figures below are already usable' : ''}`;
    if (S.err) return '⚠ ' + S.err;
    if (!S.at && S.cached) return `⚡ ${n.toLocaleString()} record(s) from this device · checking SharePoint for the latest…`;
    if (!S.at) return '';
    return `⚡ ${n.toLocaleString()} record(s) on this device · synced ${tm(S.at)} · ${S.got.toLocaleString()} read from SharePoint in ${(S.ms / 1000).toFixed(1)} s${S.mode === 'scan' ? ' · <b title="Ask the SharePoint admin: List settings → Indexed columns → add Trans_Date">tip: index Trans_Date for faster reading</b>' : ''}`; }
  function setDays(n) { S.days = Math.min(90, Math.max(7, +n || 60)); try { localStorage.setItem(BASE + '_trx_days', S.days); } catch (e) {} S.ver++; load(false); }
  /* quiet refresh of the last days every 5 minutes while the logistics dashboard is on screen */
  setInterval(() => { const v = document.querySelector('#view-logplan.active'); if (v && !S.busy && S.at && Date.now() - S.at > 5 * 60e3) load(false); }, 60e3);
  /* ============================================================
     🛰 LIVE TRUCKS MAP — the trucks on the road, drawn from the coordinates the drivers' app writes into the trips table
     (Latitude_Crdnts / Longtitude_Crdnts are captured when a trip is STARTED and when it is CLOSED).
     · a truck that has started and not closed is drawn on the map, moving along the route from its start point toward the destination;
       the destination point is learned from the closing coordinates of earlier trips to the same place; how far it has got = time on the road ÷ the usual time of that route
     · if the destination is not known yet the truck stays at its last captured point
     · map = OpenStreetMap tiles drawn here (no library); if the tiles can't load the trucks are still shown on a plain grid
     ============================================================ */
  const LM = { v: null, user: false, sel: '', rf: 0, tick: 0 };
  const xe = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const okc = (a, b) => typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && (a !== 0 || b !== 0);
  const rad = x => x * Math.PI / 180, hav = (a, b) => { const dl = rad(b[0] - a[0]), dn = rad(b[1] - a[1]), h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.min(1, Math.sqrt(h))); };
  const med = a => { a = a.slice().sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0; };
  const pk = (d, l) => (String(d || '') + '|' + String(l || '')).toLowerCase().replace(/\s+/g, ' ').trim();
  let PC = { v: -1 };
  function places() { if (PC.v === S.ver) return PC; const g = new Map(), reg = new Map(), du = new Map(), add = (m, k, la, ln) => { if (!m.has(k)) m.set(k, []); m.get(k).push([la, ln]); };
    rows().forEach(r => { if (!okc(r.lat, r.lng)) return; if (r.log) { add(g, pk(r.to, r.tloc), r.lat, r.lng); if (r.to) add(reg, pk(r.to, ''), r.lat, r.lng); } else if (r.floc || r.from) add(g, pk(r.from, r.floc), r.lat, r.lng); });
    trips().forEach(r => { if (r.s === 'Completed' && r.h > 0 && r.h < 48) { const k = pk(r.from, r.floc) + '>' + pk(r.to, r.tloc); if (!du.has(k)) du.set(k, []); du.get(k).push(r.h); } });
    const cen = m => { const o = new Map(); m.forEach((L, k) => o.set(k, [med(L.map(x => x[0])), med(L.map(x => x[1])), L.length])); return o; };
    return PC = { v: S.ver, g: cen(g), reg: cen(reg), du }; }
  const place = (d, l) => { const P = places(); return P.g.get(pk(d, l)) || null; };
  /* where a truck is now */
  function est(r, now) { const P = places(), p0 = okc(r.lat, r.lng) ? [r.lat, r.lng] : place(r.from, r.floc); if (!p0) return null;
    let d = place(r.to, r.tloc), approx = false; if (!d && r.to) { d = P.reg.get(pk(r.to, '')) || null; approx = !!d; }
    const t0 = r.st || r.ts || now, el = Math.max(0, (now - t0) / 36e5), o = { r, p0, el, dest: d, approx, pos: p0, prog: null, exp: 0 };
    if (d) { const km = hav(p0, d), L = P.du.get(pk(r.from, r.floc) + '>' + pk(r.to, r.tloc)), ex = L && L.length >= 2 ? med(L) : Math.max(.25, km * 1.35 / 55); o.km = km; o.exp = ex; o.prog = Math.min(.97, el / ex); o.pos = [p0[0] + (d[0] - p0[0]) * o.prog, p0[1] + (d[1] - p0[1]) * o.prog]; o.hist = !!(L && L.length >= 2); }
    return o; }
  const pass = (r, f) => (!f.reg || (r.region || '—') === f.reg) && (!f.drv || r.driver === f.drv) && (!f.unit || r.unit === f.unit);
  function data(f) { const now = Date.now(), t = ymdL(now), lo = ymdL(now - 13 * DAY), all = trips().filter(r => pass(r, f)), out = { on: [], nogps: [], arr: [] };
    all.forEach(r => { if (r.s !== 'In progress' || r.date < lo) return; const e = est(r, now); if (e) out.on.push(e); else out.nogps.push(r); });
    const units = new Set(all.filter(r => r.date === t).map(r => r.unit)); rows().forEach(r => { if (r.log && r.date === t && okc(r.lat, r.lng) && (!f.unit || r.unit === f.unit) && (units.has(r.unit))) out.arr.push(r); });
    return out; }
  /* ---- web-mercator ---- */
  const WX = (lng, z) => (lng + 180) / 360 * 256 * 2 ** z, WY = (lat, z) => { const s = Math.sin(rad(Math.max(-85, Math.min(85, lat)))); return (.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z; };
  const IX = (x, z) => x / (256 * 2 ** z) * 360 - 180, IY = (y, z) => { const n = Math.PI - 2 * Math.PI * y / (256 * 2 ** z); return 180 / Math.PI * Math.atan(.5 * (Math.exp(n) - Math.exp(-n))); };
  function fit(el, pts) { const vp = el.querySelector('.lm-vp'), W = vp.clientWidth || 600, H = vp.clientHeight || 400;
    if (!pts.length) { LM.v = { lat: 24.45, lng: 54.4, z: 7 }; return; } let a = 90, b = -90, c = 180, d = -180; pts.forEach(p => { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); });
    let z = 13; for (; z > 3; z--) { const w = Math.abs(WX(d, z) - WX(c, z)), h = Math.abs(WY(a, z) - WY(b, z)); if (w < W - 120 && h < H - 120) break; }
    LM.v = { lat: (a + b) / 2, lng: (c + d) / 2, z }; }
  const rt = (r, n) => { const e = r.el; return e < 1 ? Math.round(e * 60) + ' min' : Math.floor(e) + ' h ' + Math.round((e % 1) * 60) + ' min'; };
  function mapHtml(f) { LM.f = f || {}; const D = data(LM.f);
    return `<div class="lm" data-lm="1"><div class="lm-bar"><span class="lm-live"><i></i>LIVE</span><span class="lm-cnt"></span><span class="sp"></span><label><input type="checkbox" data-lmo="arr" ${LM.noarr ? '' : 'checked'}> arrived today</label><label><input type="checkbox" data-lmo="trail" ${LM.notrail ? '' : 'checked'}> route lines</label><button type="button" data-lmo="fit">⌖ Fit all</button><button type="button" data-lmo="sync">⟳ Refresh</button></div>
      <div class="lm-body"><div class="lm-vp"><div class="lm-tiles"></div><svg class="lm-svg"></svg><div class="lm-mk"></div><div class="lm-pop" hidden></div><div class="lm-ctl"><button type="button" data-lmo="in">+</button><button type="button" data-lmo="out">−</button></div><div class="lm-att">© OpenStreetMap contributors</div><div class="lm-off" hidden>Map background not available (offline or blocked) — the trucks are still drawn on the grid.</div></div><div class="lm-side"></div></div>
      <div class="lm-note">Coordinates are captured by the driver's app when a trip is <b>started</b> and when it is <b>closed</b>. Between those two points the truck is shown at an <b>estimated</b> place on the route (time on the road ÷ the usual time of that route); the destination point is learned from earlier trips to the same place.</div></div>`; }
  function popHtml(o) { const r = o.r, g = okc(o.p0[0], o.p0[1]) ? `https://www.google.com/maps?q=${o.p0[0]},${o.p0[1]}` : '';
    return `<b>🚛 ${xe(r.unit || '—')}</b>${r.trailer ? ' · ' + xe(r.trailer) : ''}<br>🧑‍✈️ ${xe(r.driver || '—')}<br>📍 ${xe([r.from, r.floc].filter(Boolean).join(' · ') || '—')} → <b>${xe([r.to, r.tloc].filter(Boolean).join(' · ') || '—')}</b>
      <br>📦 ${xe(r.plts || 0)} pallets${r.mat ? ' · ' + xe(r.mat) : ''}${r.dn ? ' · DN ' + xe(r.dn) : ''}<br>⏱ started ${xe(tm(r.st || r.ts))} · on the road ${xe(rt(o))}
      <br>${o.prog == null ? '<span class="lm-w">at the point where the trip was started — the destination has no captured coordinates yet</span>' : `≈ <b>${Math.round(o.prog * 100)}%</b> of ~${Math.round(o.km)} km (${o.hist ? 'usual time of this route' : 'estimated at 55 km/h'})${o.approx ? ' · destination = region centre' : ''}`}${g ? `<br><a href="${g}" target="_blank" rel="noopener">open the start point in Google Maps ↗</a>` : ''}`; }
  function draw(el) { const vp = el.querySelector('.lm-vp'), W = vp.clientWidth, H = vp.clientHeight; if (!W || !H) return; const D = data(LM.f || {}), now = Date.now();
    if (!el._i) { el._i = 1; init(el); }
    if (!LM.v || (!LM.user && !el._fit) ) { const pts = []; D.on.forEach(o => { pts.push(o.pos); if (o.dest) pts.push(o.dest); }); D.arr.forEach(r => pts.push([r.lat, r.lng])); if (pts.length || !LM.v) { fit(el, pts); el._fit = pts.length ? 1 : 0; } }
    const V = LM.v, z = V.z, cx = WX(V.lng, z), cy = WY(V.lat, z), ox = cx - W / 2, oy = cy - H / 2, px = (la, ln) => [WX(ln, z) - ox, WY(la, z) - oy];
    /* tiles */
    const T = el.querySelector('.lm-tiles'), n = 2 ** z, need = new Map(); el._tl = el._tl || new Map();
    for (let ty = Math.max(0, Math.floor(oy / 256)); ty <= Math.min(n - 1, Math.floor((oy + H) / 256)); ty++) for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + W) / 256); tx++) need.set(z + '/' + (((tx % n) + n) % n) + '/' + ty + '/' + tx, [tx, ty]);
    el._tl.forEach((im, k) => { if (!need.has(k)) { im.remove(); el._tl.delete(k); } });
    need.forEach((v, k) => { let im = el._tl.get(k); if (!im) { im = document.createElement('img'); im.draggable = false; im.alt = ''; const q = k.split('/'); im.onerror = () => { im.style.display = 'none'; el._terr = (el._terr || 0) + 1; if (el._terr > 4) el.querySelector('.lm-off').hidden = false; }; im.onload = () => { el._terr = 0; el.querySelector('.lm-off').hidden = true; }; im.src = `https://tile.openstreetmap.org/${q[0]}/${q[1]}/${q[2]}.png`; T.appendChild(im); el._tl.set(k, im); }
      im.style.transform = `translate(${v[0] * 256 - ox}px,${v[1] * 256 - oy}px)`; });
    /* trucks */
    const M = el.querySelector('.lm-mk'); el._mk = el._mk || new Map(); const seen = new Set(), put = (id, html, cls, pos, ttl) => { seen.add(id); let m = el._mk.get(id); if (!m) { m = document.createElement('div'); m.dataset.id = id; M.appendChild(m); el._mk.set(id, m); } if (m._h !== html) { m.innerHTML = html; m._h = html; } m.className = 'lm-m ' + cls + (LM.sel === id ? ' sel' : ''); m.title = ttl || ''; const q = px(pos[0], pos[1]); m.style.transform = `translate(${q[0].toFixed(1)}px,${q[1].toFixed(1)}px)`; };
    D.on.forEach(o => { const late = o.el > 24; put('t' + o.r.id, `<span class="lm-i">🚛</span><b>${xe(o.r.unit || '?')}</b>`, 'lm-t' + (late ? ' late' : '') + (o.prog == null ? ' still' : ''), o.pos, (o.r.driver || '') + ' · ' + (o.r.unit || '')); });
    if (!LM.noarr) D.arr.forEach(r => put('a' + r.id, `<span class="lm-i">✔</span><b>${xe(r.unit || '')}</b>`, 'lm-a', [r.lat, r.lng], 'Arrived · ' + (r.unit || '') + ' · ' + (r.to || '')));
    el._mk.forEach((m, id) => { if (!seen.has(id)) { m.remove(); el._mk.delete(id); } });
    /* route lines */
    const S2 = el.querySelector('.lm-svg'); let sv = ''; if (!LM.notrail) D.on.forEach(o => { if (!o.dest) return; const a = px(o.p0[0], o.p0[1]), b = px(o.dest[0], o.dest[1]), c = px(o.pos[0], o.pos[1]); sv += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 6"/><line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round"/><circle cx="${a[0]}" cy="${a[1]}" r="4" fill="#fff" stroke="#64748b" stroke-width="2"/><circle cx="${b[0]}" cy="${b[1]}" r="5" fill="#10b981" stroke="#fff" stroke-width="2"/>`; });
    S2.setAttribute('width', W); S2.setAttribute('height', H); S2.innerHTML = sv;
    /* popup */
    const pp = el.querySelector('.lm-pop'), so = LM.sel && D.on.find(o => 't' + o.r.id === LM.sel); if (so) { const q = px(so.pos[0], so.pos[1]); pp.hidden = false; pp.innerHTML = '<button type="button" class="lm-x" data-lmo="close">×</button>' + popHtml(so); pp.style.left = Math.max(6, Math.min(W - 270, q[0] + 18)) + 'px'; pp.style.top = Math.max(6, Math.min(H - pp.offsetHeight - 6, q[1] - 30)) + 'px'; } else pp.hidden = true;
    /* header + side list */
    el.querySelector('.lm-cnt').innerHTML = `<b>${D.on.length}</b> truck(s) on the road${D.nogps.length ? ` · <span title="Started trips whose coordinates were not captured">${D.nogps.length} without coordinates</span>` : ''} · ${D.arr.length} arrived today · synced ${S.at ? tm(S.at) : '…'}`;
    const sg = D.on.map(o => o.r.id + ':' + (o.prog == null ? 'x' : Math.round(o.prog * 50))).join(',') + '|' + D.nogps.length + '|' + LM.sel; const sd = el.querySelector('.lm-side');
    if (sd._sg !== sg) { sd._sg = sg; sd.innerHTML = D.on.length || D.nogps.length ? D.on.slice().sort((a, b) => b.el - a.el).map(o => `<div class="lm-row${LM.sel === 't' + o.r.id ? ' on' : ''}" data-lmt="${xe(o.r.id)}"><b>🚛 ${xe(o.r.unit || '—')}</b><span>${xe(o.r.driver || '')}</span><small>${xe(o.r.to || o.r.tloc || '—')} · ${xe(rt(o))}${o.prog != null ? ' · ' + Math.round(o.prog * 100) + '%' : ''}</small>${o.prog != null ? `<i style="width:${Math.round(o.prog * 100)}%"></i>` : ''}</div>`).join('') + D.nogps.slice(0, 20).map(r => `<div class="lm-row nogps"><b>🚛 ${xe(r.unit || '—')}</b><span>${xe(r.driver || '')}</span><small>no coordinates captured · ${xe(r.to || '—')}</small></div>`).join('') : '<div class="lm-empty">No truck is on the road right now.</div>'; } }
  function init(el) { const vp = el.querySelector('.lm-vp'); let dr = null;
    const move = (dx, dy) => { const V = LM.v, z = V.z; V.lng = IX(WX(V.lng, z) - dx, z); V.lat = IY(WY(V.lat, z) - dy, z); LM.user = true; };
    vp.addEventListener('pointerdown', e => { if (e.target.closest('.lm-m,.lm-ctl,.lm-pop')) return; dr = { x: e.clientX, y: e.clientY, id: e.pointerId }; vp.setPointerCapture(e.pointerId); vp.classList.add('drag'); });
    vp.addEventListener('pointermove', e => { if (!dr) return; move(e.clientX - dr.x, e.clientY - dr.y); dr.x = e.clientX; dr.y = e.clientY; draw(el); });
    const up = () => { dr = null; vp.classList.remove('drag'); }; vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
    const zoom = d => { LM.v.z = Math.max(3, Math.min(17, LM.v.z + d)); LM.user = true; draw(el); };
    let wt = 0; vp.addEventListener('wheel', e => { e.preventDefault(); if (Date.now() - wt < 220) return; wt = Date.now(); zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    vp.addEventListener('dblclick', e => { if (!e.target.closest('.lm-m,.lm-ctl,.lm-pop')) zoom(1); });
    el.addEventListener('click', e => { const b = e.target.closest('[data-lmo]'), m = e.target.closest('.lm-m.lm-t'), r = e.target.closest('[data-lmt]');
      if (b) { const o = b.dataset.lmo; if (o === 'in') zoom(1); else if (o === 'out') zoom(-1); else if (o === 'fit') { LM.user = false; el._fit = 0; draw(el); } else if (o === 'sync') { load(false); } else if (o === 'close') { LM.sel = ''; draw(el); } return; }
      if (m) { LM.sel = m.dataset.id; draw(el); return; }
      if (r) { const id = 't' + r.dataset.lmt, D = data(LM.f || {}), o = D.on.find(x => 't' + x.r.id === id); LM.sel = id; if (o) { LM.v.lat = o.pos[0]; LM.v.lng = o.pos[1]; LM.v.z = Math.max(LM.v.z, 9); LM.user = true; } draw(el); } });
    el.addEventListener('change', e => { const o = e.target.dataset && e.target.dataset.lmo; if (o === 'arr') LM.noarr = !e.target.checked; else if (o === 'trail') LM.notrail = !e.target.checked; draw(el); }); }
  /* one timer: draws the map when it is on screen (1 s → the trucks glide), and reads the newest trips every 2 minutes */
  setInterval(() => { const el = document.querySelector('[data-lm]'); if (!el || !el.offsetParent) return; try { draw(el); } catch (e) { console.error(e); } if (!S.busy && S.at && Date.now() - S.at > 120e3 && Date.now() - LM.rf > 120e3) { LM.rf = Date.now(); load(false); } }, 1000);
  (() => { const c = document.createElement('style'); c.textContent = `.lm{display:flex;flex-direction:column;gap:8px}.lm-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:12.5px}.lm-bar .sp{flex:1}.lm-bar label{display:flex;gap:5px;align-items:center;cursor:pointer}.lm-bar button{padding:4px 10px;font-size:12px;border-radius:8px}
.lm-live{display:inline-flex;gap:6px;align-items:center;font-weight:800;color:#b42318;letter-spacing:.06em}.lm-live i{width:9px;height:9px;border-radius:50%;background:#ef4444;animation:lmp 1.4s infinite}@keyframes lmp{0%{box-shadow:0 0 0 0 rgba(239,68,68,.6)}100%{box-shadow:0 0 0 9px rgba(239,68,68,0)}}
.lm-body{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:10px;height:520px}.lm-vp{position:relative;overflow:hidden;border-radius:12px;border:1px solid var(--border,#e2e8f0);background:#e8edf3 repeating-linear-gradient(0deg,transparent 0 63px,rgba(100,116,139,.14) 63px 64px),repeating-linear-gradient(90deg,transparent 0 63px,rgba(100,116,139,.14) 63px 64px);cursor:grab;touch-action:none;user-select:none}.lm-vp.drag{cursor:grabbing}
.lm-tiles,.lm-svg,.lm-mk{position:absolute;left:0;top:0}.lm-tiles img{position:absolute;left:0;top:0;width:256px;height:256px;max-width:none;pointer-events:none}.lm-svg{pointer-events:none}.lm-mk{width:0;height:0}
.lm-m{position:absolute;left:0;top:0;transition:transform 1s linear;will-change:transform}.lm-t{margin:-34px 0 0 -22px;display:flex;flex-direction:column;align-items:center;cursor:pointer}.lm-t .lm-i{font-size:24px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45));line-height:1}.lm-t b{font-size:10.5px;background:#f59e0b;color:#fff;border-radius:6px;padding:1px 6px;margin-top:1px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)}.lm-t.late b{background:#dc2626}.lm-t.still b{background:#64748b}.lm-t.sel b{outline:2px solid #164e63}.lm-t.sel{z-index:5}
.lm-a{margin:-9px 0 0 -9px;display:flex;align-items:center;gap:3px;background:#10b981;color:#fff;border-radius:12px;padding:1px 6px;font-size:10px;box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap}.lm-a b{font-weight:600}
.lm-ctl{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:4px}.lm-ctl button{width:32px;height:32px;padding:0;font-size:18px;line-height:1;border-radius:8px;background:#fff;color:#0f172a;border:1px solid #cbd5e1}.lm-att{position:absolute;right:6px;bottom:3px;font-size:10px;background:rgba(255,255,255,.75);padding:0 5px;border-radius:4px;color:#334155}
.lm-off{position:absolute;left:10px;bottom:22px;max-width:70%;background:#fff8e1;border:1px solid #fcd34d;color:#92400e;padding:5px 9px;border-radius:8px;font-size:11.5px}
.lm-pop{position:absolute;z-index:9;width:260px;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font-size:12px;line-height:1.5;box-shadow:0 12px 28px -10px rgba(0,0,0,.4);cursor:default}.lm-pop .lm-x{position:absolute;right:6px;top:4px;background:none;border:0;font-size:18px;padding:0 6px;color:#64748b}.lm-w{color:#92400e}
.lm-side{overflow:auto;display:flex;flex-direction:column;gap:6px}.lm-row{position:relative;border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:7px 10px;cursor:pointer;display:grid;gap:1px;overflow:hidden;background:var(--card,#fff)}.lm-row:hover,.lm-row.on{border-color:#f59e0b;background:rgba(245,158,11,.08)}.lm-row span{font-size:12px;color:var(--gray-600,#64748b)}.lm-row small{font-size:11px;color:var(--gray-600,#64748b)}.lm-row i{position:absolute;left:0;bottom:0;height:3px;background:#f59e0b}.lm-row.nogps{cursor:default;opacity:.75;border-style:dashed}.lm-empty{padding:18px;text-align:center;color:var(--gray-600,#64748b);font-size:13px}
.lm-note{font-size:11.5px;color:var(--gray-600,#64748b)}@media (max-width:900px){.lm-body{grid-template-columns:1fr;height:auto}.lm-vp{height:420px}.lm-side{max-height:240px}}`; document.head.appendChild(c); })();
  window.TRX = { S, load, rows, trips, status, setDays, stat, fixDrivers, mapHtml, mapData: data };
})();
