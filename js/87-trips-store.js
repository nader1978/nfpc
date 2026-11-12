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
    'Region_Desc', 'Start_TimeStamp', 'TimeStamp_Start', 'End_TimeStamp', 'TimeStamp_End', 'Trip_KMs', 'Trip_Time', 'DN_Nr', 'Record_Nr', 'Close_Trip_ID', 'WHs_Arrival_Status', 'Remarks'];
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
  function row(it, C) { const f = it.fields || {}, g = k => { const c = C[k]; return c ? val(f[c]) : ''; }, s = k => String(g(k)).trim(), n = k => { const x = parseFloat(String(g(k)).replace(/,/g, '')); return isFinite(x) ? x : 0; };
    const td = tsOf(g('Trans_Date')) || tsOf(it.createdDateTime), title = s('Title'), rec = s('Record_Nr'), log = /^(CLS|CXL)-/i.test(title) || /^(CLS|CXL)-/i.test(rec);
    const st = tsOf(g('Start_TimeStamp')) || tsOf(g('TimeStamp_Start')), en = tsOf(g('End_TimeStamp')) || tsOf(g('TimeStamp_End')), cl = g('Trip_Closed');
    return { k: S.list + '|' + it.id, id: +it.id || it.id, c: td ? ymdU(td) : '', date: td ? ymdL(td) : '', ts: td, log, title, rec, driver: s('User_Name'), file: s('Driver_FileNr').replace(/\.0+$/, ''), unit: s('Unit_Nr'), trailer: s('Trailer_Nr'),
      from: s('Distn_From'), floc: s('Loaction_From'), to: s('Distn_To'), tloc: s('Location_To'), plts: n('Nr_Of_Plts'), mat: s('Trls_Task_Type') || s('Loaded_Mtrl_Type'), src: s('Task_Source'), task: s('Task_Type'), status0: s('Trip_Status'),
      closed: cl === true || /^(true|yes|1)$/i.test(String(cl)), region: s('Region_Desc'), st, en, km: n('Trip_KMs'), ttime: s('Trip_Time'), dn: s('DN_Nr'), cid: s('Close_Trip_ID'), arr: s('WHs_Arrival_Status'), rem: s('Remarks'), cr: tsOf(it.createdDateTime) }; }
  /* the trip's state as the dashboard shows it */
  function stat(r) { const x = (r.status0 + ' ' + r.task).toLowerCase(); if (/cancel/.test(x)) return 'Cancelled'; if (/complet|end trip/.test(x)) return 'Completed'; if (r.closed) return 'Completed'; if (/start/.test(x) || r.st) return 'In progress'; return r.date && r.date < ymdL(Date.now()) ? 'Not started' : 'Planned'; }

  /* ---------- reading ---------- */
  let C = null, CK = '', TOP = 2000;
  async function getJ(url, token) { const r = await fetchWithRetry(url, { headers: { Authorization: 'Bearer ' + token, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } }, 'trips');
    if (!r.ok) { let t = ''; try { t = await r.text(); } catch (e) {} const e = new Error('SharePoint ' + r.status + (t ? ': ' + t.replace(/\s+/g, ' ').slice(0, 160) : '')); e.status = r.status; e.thr = r.status === 422 || r.status === 503 || /threshold|tooManyResources|not indexed|prohibited|indexed/i.test(t); throw e; }
    return r.json(); }
  async function cols(ids, token) { const key = ids.listId; if (C && CK === key) return C; const L = await fetchColumns(ids.siteId, ids.listId, token), M = new Map(); L.forEach(c => { M.set(nz(c.name), c.name); if (!M.has(nz(c.displayName))) M.set(nz(c.displayName), c.name); });
    C = {}; WANT.forEach(k => { const c = M.get(nz(k)) || (k === 'Nr_Of_Plts' ? M.get('nrofplts') : null); if (c) C[k] = c; }); CK = key; return C; }
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
      const need = chunks.filter(c => { if (force) return true; const m = META.get(S.list + '|' + c); if (!m) return true; if (c >= ymdU(now - 2 * DAY)) return true; if (openC.has(c) && now - m.at > 30 * 60e3) return true; return m.at < Date.parse(c + 'T00:00:00Z') + DAY + 36 * 36e5; });
      if (S.mode !== 'scan') { S.todo = need.length; let i = 0, fail = null;
        const worker = async () => { while (i < need.length && !fail) { const c = need[i++]; try { await readDay(ids, token, c); quiet(); S.done++; S.ver++; } catch (e) { if (e.thr || e.status === 400) { fail = e; return; } throw e; } } };
        await Promise.all([worker(), worker(), worker(), worker()]);
        if (fail) { S.mode = 'scan'; S.idx = false; S.done = 0; try { localStorage.setItem(BASE + '_trx_mode', 'scan'); } catch (e) {} } else S.mode = 'days'; }
      if (S.mode === 'scan') { const mk = S.list + '|scan', m = META.get(mk), from = Date.parse(first + 'T00:00:00Z'), stop = force || !m || m.from > from ? from - 3 * DAY : Math.min(m.at - 3 * DAY, now - 3 * DAY); S.todo = 0;
        await scan(ids, token, stop); const mm = { k: mk, at: now, from: Math.min(from, m && !force ? m.from : from) }; META.set(mk, mm); await idbPut('meta', [mm]); }
      S.at = Date.now(); S.ms = performance.now() - t0; S.cached = true;
    } catch (e) { console.error(e); S.err = e.message || String(e); }
    finally { S.busy = false; S.ver++; } }

  let TC = { v: -1, a: [] }, RC = { v: -1, a: [] };
  const rows = () => { if (RC.v !== S.ver) RC = { v: S.ver, a: [...S.map.values()].filter(r => r.k.startsWith(S.list + '|')) }; return RC.a; };
  const trips = () => { if (TC.v !== S.ver) TC = { v: S.ver, a: rows().filter(r => !r.log && r.date).map(r => (r.s = stat(r), r.h = r.st && r.en && r.en > r.st ? (r.en - r.st) / 36e5 : 0, r)) }; return TC.a; };
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
  window.TRX = { S, load, rows, trips, status, setDays, stat };
})();
