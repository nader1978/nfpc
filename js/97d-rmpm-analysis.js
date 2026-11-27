/* ============================================================
   RM & PM ANALYSIS — upload the daily raw-material / packing-material stock file (JDE report + count sheet), keep every day,
   compare today with the previous upload, follow the trend, the consumption and the abnormal changes, and read the KPIs.
   Web page + ORBIT mobile. SharePoint list: RMPM_Daily_Snap_tbl — one row per upload date (and part), the items are stored as compact JSON.
   Columns: Title (text) · Snap_Date (date) · Part (number) · Items_JSON (multiple lines of text — plain text) · Item_Count (number) · Source_File (text) · Uploaded_By (text)
   If the list is missing the file is kept on this device only (and the page says so).
   ============================================================ */
(function () {
  'use strict';
  const Q = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nz = s => String(s == null ? '' : s).toLowerCase().replace(/_x[0-9a-f]{4}_/g, '').replace(/[^a-z0-9]/g, '');
  const str = v => { if (v && typeof v === 'object') v = v.Value != null ? v.Value : v.value != null ? v.value : v.LookupValue || ''; return String(v == null ? '' : v).trim(); };
  const nn = v => { if (v == null || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null; const n = Number(String(v).replace(/[,\s]/g, '')); return isFinite(n) ? n : null; };
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date()), addD = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return ymd(x); };
  const dmy = d => { d = String(d || '').slice(0, 10); return /^\d{4}-\d\d-\d\d$/.test(d) ? d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : d; };
  const dshort = d => String(d || '').slice(8, 10) + '/' + String(d || '').slice(5, 7);
  const dd = (a, b) => Math.max(1, Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 864e5));
  const fq = n => n == null || !isFinite(n) ? '–' : Math.abs(n) >= 100 ? Math.round(n).toLocaleString('en-GB') : (Math.round(n * 100) / 100).toLocaleString('en-GB');
  const f1 = n => n == null || !isFinite(n) ? '–' : (Math.round(n * 10) / 10).toLocaleString('en-GB');
  const sgn = (n, f) => { if (n == null || !isFinite(n)) return '–'; const t = (f || fq)(Math.abs(n)); return /^[0.,]*$/.test(t) ? '0' : (n > 0 ? '+' : '−') + t; };
  const LIST = 'RMPM_Daily_Snap_tbl', LSK = 'orbit_rpa_local_v1', CHUNK = 28000;
  const FLD = ['c', 'd', 'u', 'qoh', 'rc', 'is', 'ph', 'vr', 'rp'];   /* item arrays: code · description · UoM · system on hand · new receipts · issues · physical count · variance · JDE-report quantity */
  const toObj = a => { const o = {}; FLD.forEach((k, i) => { o[k] = a[i] == null ? null : a[i]; }); return o; };
  const toArr = o => FLD.map(k => o[k] == null ? null : o[k]);
  const meName = () => { try { return (currentUser && (currentUser.displayName || currentUser.username)) || ''; } catch (e) { return ''; } };
  const canUp = () => { try { return isAdmin() || hasPerm('uploader'); } catch (e) { return false; } };

  /* ---------------- item groups ---------------- */
  const CATS = [['Consumables', 'PM', /\bmop\b|coat plastic|\bmask\b|tissue|cover.?shoe/i], ['Resin & masterbatch', 'RM', /pet resin|hdpe|master ?batch|^mb[ -]|\bmb\b/i], ['Chemicals & cleaning', 'RM', /detergent|genesol|citric|peroxide|chlorin|antiscalant|metabisulph|acid|midchem|d08|membrane|cleaner/i],
    ['Preforms', 'RM', /preform/i], ['Caps & closures', 'PM', /\bcap\b|closure/i], ['Labels', 'PM', /label/i], ['Shrink & stretch film', 'PM', /film/i], ['Sleeves', 'PM', /sleeve/i], ['Layer pads & packing', 'PM', /layer ?pad|crate|tape|\bbags?\b|ldpe|glue/i], ['Filters', 'PM', /filter/i]];
  const catOf = o => { const t = (o.d || '') + ' ' + (o.c || ''); for (const [n, g, re] of CATS) if (re.test(t)) return [n, g]; return ['Other', 'PM']; };

  /* ---------------- state ---------------- */
  const S = { snaps: [], loaded: false, loading: false, err: '', note: '', ids: null, cols: [], tab: 'dash', basis: '', a: '', b: '', z: 2, cover: 14, tol: 2, f: { cat: '', st: '', q: '', lv: '' }, af: { lvl: '', item: '', desc: '', cat: '' }, item: '', cat: '', lim: 300, pend: [], busy: false };
  const say = (t, bad) => { S.note = t || ''; const e = Q('#rpaStatus'); if (e) { e.textContent = t || ''; e.className = 'status-msg' + (bad ? ' error' : ''); } };

  /* ---------------- reading the Excel file ---------------- */
  const normH = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const HMAP = [['c', /^(2nditemnumber|itemnumber|itemcode|2nditem|item|code|itemno)$/], ['d', /^(description|itemdescription|desc|itemname|name)$/], ['u', /^(um|uom|unit|unitofmeasure)$/], ['qoh', /^(quantityonhand|onhand|qoh|systemqty|systemquantity|systemstock)$/], ['rc', /^(newrcpt|newreceipt|newreceipts|receipt|receipts|rcpt)$/], ['is', /^(issue|issues)$/], ['ph', /^(physical|physicalcount|physicalqty|counted|countedqty)$/], ['vr', /^(variance|var)$/], ['rp', /^(qty|quantity)$/]];
  function parseWB(wb) {
    const out = new Map(), info = []; let hasCount = false, hasRep = false;
    wb.SheetNames.forEach(sn => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null, blankrows: false }); let hi = -1, col = null;
      for (let i = 0; i < Math.min(rows.length, 40) && hi < 0; i++) { const hs = (rows[i] || []).map(normH), c = {}; hs.forEach((h, j) => { HMAP.forEach(([k, re]) => { if (c[k] == null && re.test(h)) c[k] = j; }); }); if (c.c != null && (c.rp != null || c.qoh != null || c.ph != null)) { hi = i; col = c; } }
      if (hi < 0) { info.push({ sheet: sn, type: 'skipped', n: 0 }); return; }
      const isCount = col.ph != null || col.qoh != null; let n = 0;
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [], code = str(r[col.c]); if (!code || /^(total|grand)/i.test(code)) continue;
        const v = k => col[k] == null ? null : nn(r[col[k]]); let o = out.get(code); if (!o) { o = { c: code, d: '', u: '', qoh: null, rc: null, is: null, ph: null, vr: null, rp: null }; out.set(code, o); }
        if (col.d != null && !o.d) o.d = str(r[col.d]); if (col.u != null && !o.u) o.u = str(r[col.u]);
        const add = (k, x) => { if (x != null) o[k] = (o[k] || 0) + x; };
        if (isCount) { add('qoh', v('qoh')); add('rc', v('rc')); add('is', v('is')); add('ph', v('ph')); add('vr', v('vr')); } else add('rp', v('rp')); n++;
      }
      if (isCount) hasCount = true; else hasRep = true; info.push({ sheet: sn, type: isCount ? 'count' : 'report', n });
    });
    out.forEach(o => { if (o.vr == null && o.ph != null) o.vr = o.ph - ((o.qoh || 0) + (o.rc || 0) - (o.is || 0)); });
    return { items: [...out.values()], info, hasCount, hasRep };
  }
  function dateFromName(n) {
    n = String(n || ''); let m = n.match(/(20\d\d)[-_.]?(\d\d)[-_.]?(\d\d)/); if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return m[1] + '-' + m[2] + '-' + m[3];
    m = n.match(/(\d\d)(\d\d)(\d\d)(?!\d)/); if (!m) return ''; const ok = (y, mo, d) => mo >= 1 && mo <= 12 && d >= 1 && d <= 31; const A = [2000 + +m[3], +m[2], +m[1]], B = [2000 + +m[1], +m[2], +m[3]];
    const mk = x => x[0] + '-' + pad(x[1]) + '-' + pad(x[2]); const t1 = addD(today(), 1);
    if (ok(...A) && mk(A) <= t1) return mk(A); if (ok(...B) && mk(B) <= t1) return mk(B); return '';
  }
  function readFile(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onerror = () => rej(new Error('cannot read ' + file.name)); r.onload = () => { try { if (typeof XLSX === 'undefined') throw new Error('the Excel reader is not loaded — check the internet connection'); const wb = XLSX.read(r.result, { type: 'array' }), p = parseWB(wb); if (!p.items.length) throw new Error('no item rows found — the file needs the columns “2nd Item Number”, “Description”, “UM” and Qty / Quantity On Hand / Physical'); res({ name: file.name, date: dateFromName(file.name) || today(), items: p.items, info: p.info, hasCount: p.hasCount, hasRep: p.hasRep }); } catch (e) { rej(e); } }; r.readAsArrayBuffer(file); });
  }

  /* ---------------- snapshots: read / write ---------------- */
  const mkSnap = (date, arrs, file, by, src, ids) => { const items = arrs.map(toObj); return { date, file: file || '', by: by || '', src, ids: ids || [], items, map: new Map(items.map(o => [o.c, o])) }; };
  const jparse = t => { try { return JSON.parse(t); } catch (e) { try { return JSON.parse(String(t).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '')); } catch (x) { return null; } } };
  function snapsFromRows(rows) {   /* rows: SharePoint items with fields normalised (lower-case names) */
    const g = new Map();
    rows.forEach(r => { const m = String(r.title || '').match(/^(\d{4}-\d\d-\d\d)/), d = m ? m[1] : String(r.snapdate || '').slice(0, 10); if (!/^\d{4}-\d\d-\d\d$/.test(d)) return; const o = g.get(d) || { date: d, parts: [], file: '', by: '' }; o.parts.push({ p: +r.part || 1, id: r.id, j: str(r.itemsjson) }); o.file = o.file || str(r.sourcefile); o.by = o.by || str(r.uploadedby); g.set(d, o); });
    const out = []; g.forEach(o => { o.parts.sort((a, b) => a.p - b.p); let arrs = []; for (const p of o.parts) { const a = jparse(p.j); if (Array.isArray(a)) arrs = arrs.concat(a); } if (arrs.length) out.push(mkSnap(o.date, arrs, o.file, o.by, 'sp', o.parts.map(p => ({ id: p.id, part: p.p })))); });
    return out;
  }
  const locGet = () => { try { return JSON.parse(localStorage.getItem(LSK) || '{}') || {}; } catch (e) { return {}; } };
  const locSet = o => { try { localStorage.setItem(LSK, JSON.stringify(o)); return true; } catch (e) { return false; } };
  function mergeLocal(sp) {
    const L = locGet(), have = new Set(sp.map(s => s.date)), out = sp.slice(); Object.keys(L).forEach(d => { if (!have.has(d)) out.push(mkSnap(d, L[d].items || [], L[d].file, L[d].by, 'local')); });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  const normF = f => { const o = {}; Object.keys(f || {}).forEach(k => { o[nz(k)] = f[k]; }); return o; };
  async function ensureIds() { if (S.ids) return S.ids; const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('connect the SharePoint site first (Settings)'); S.ids = await resolveIds(site, LIST, token); try { S.cols = (await fetchColumns(S.ids.siteId, S.ids.listId, token)).map(c => c.name); } catch (e) { S.cols = []; } return S.ids; }
  async function loadSnaps(force) {
    if (S.loading) return; S.loading = true; S.err = ''; say('⏳ Reading the stock files from SharePoint…'); let sp = [];
    try { const ids = await ensureIds(), token = getGlobalAccessToken(), from = addD(today(), -150); let items = null;
      try { items = await exp_fetchFilteredItems(ids.siteId, ids.listId, token, `fields/Snap_Date ge '${from}T00:00:00Z'`); } catch (e) { items = null; } if (!items || !items.length) items = await fetchAllItems(ids.siteId, ids.listId, token);
      sp = snapsFromRows(items.map(it => Object.assign(normF(it.fields), { id: it.id })));
    } catch (e) { S.ids = null; S.err = 'The SharePoint list ' + LIST + ' could not be read (' + (e.message || e) + '). Showing the files saved on this device.'; }
    S.snaps = mergeLocal(sp); S.loaded = true; S.loading = false; say(''); S.basis = S.basis || defBasis(); render();
  }
  function defBasis() { const l = S.snaps[S.snaps.length - 1]; if (!l) return 'ph'; return l.items.some(o => o.ph != null) ? 'ph' : l.items.some(o => o.qoh != null) ? 'qoh' : 'rp'; }
  /* ops: { create(fields), update(id, fields), del(id) } — web and phone write differently */
  async function saveSnap(sn, ops) {
    const arrs = sn.items.map(toArr), parts = []; let cur = [], len = 2;
    arrs.forEach(a => { const s = JSON.stringify(a); if (len + s.length + 1 > CHUNK && cur.length) { parts.push(cur); cur = []; len = 2; } cur.push(a); len += s.length + 1; }); if (cur.length) parts.push(cur);
    const old = (S.snaps.find(s => s.date === sn.date && s.src === 'sp') || { ids: [] }).ids; let made = 0, upd = 0;
    for (let i = 0; i < parts.length; i++) { const F = { Title: sn.date + '|' + (i + 1), Snap_Date: sn.date, Part: i + 1, Items_JSON: JSON.stringify(parts[i]), Item_Count: sn.items.length, Source_File: sn.file || '', Uploaded_By: meName() }, o = old.find(x => x.part === i + 1); if (o) { await ops.update(o.id, F); upd++; } else { await ops.create(F); made++; } }
    for (const o of old.filter(x => x.part > parts.length)) { if (ops.del) await ops.del(o.id); else await ops.update(o.id, { Items_JSON: '[]', Item_Count: 0 }); }
    return { made, upd, parts: parts.length };
  }
  const webOps = () => ({
    async create(F) { const ids = await ensureIds(), token = getGlobalAccessToken(); return createItem(ids.siteId, ids.listId, mapN(F), token); },
    async update(id, F) { const ids = await ensureIds(), token = getGlobalAccessToken(); return updateItem(ids.siteId, ids.listId, id, mapN(F), token); },
    async del(id) { const ids = await ensureIds(), token = getGlobalAccessToken(); return deleteItem(ids.siteId, ids.listId, id, token); } });
  function mapN(F) { const names = S.cols && S.cols.length ? S.cols : null, o = {}, miss = [], opt = ['Item_Count', 'Source_File', 'Uploaded_By']; Object.keys(F).forEach(k => { const n = names ? names.find(x => nz(x) === nz(k)) : k; if (n) o[n] = F[k]; else if (!opt.includes(k)) miss.push(k); }); if (miss.length) throw new Error('the list ' + LIST + ' has no column: ' + miss.join(', ')); return o; }
  function saveLocal(sn) { const L = locGet(); L[sn.date] = { items: sn.items.map(toArr), file: sn.file, by: meName(), at: Date.now() }; const keys = Object.keys(L).sort(); while (keys.length > 120) delete L[keys.shift()]; return locSet(L); }
  async function saveAll() {
    if (S.busy || !S.pend.length) return; if (!canUp()) return say('You need upload permission to save files.', 1); S.busy = true; let ok = 0, loc = 0; const errs = [];
    for (const p of S.pend.slice()) {
      const sn = { date: p.date, file: p.name, items: p.items }; say('⏳ Saving ' + dmy(p.date) + '…');
      try { await saveSnap(sn, webOps()); ok++; try { addActivity('upload', 'RM & PM stock file ' + p.date); } catch (x) { } }
      catch (e) { const done = saveLocal(sn); if (done) { loc++; errs.push(dmy(p.date) + ': ' + (e.message || e) + ' — kept on this device'); } else errs.push(dmy(p.date) + ': ' + (e.message || e) + ' (and this device is full)'); }
      S.pend = S.pend.filter(x => x !== p);
    }
    S.busy = false; S.ids = null; await loadSnaps(true); const last = S.snaps[S.snaps.length - 1]; if (last) { S.a = last.date; S.b = ''; } S.tab = 'dash';
    say((ok ? '✔ ' + ok + ' file(s) saved to SharePoint. ' : '') + (loc ? '⚠ ' + loc + ' kept on this device only — ' + errs.join(' · ') : ''), loc > 0); render();
  }
  async function delSnap(date) {
    const s = S.snaps.find(x => x.date === date); if (!s || !isAdmin() || !confirm('Delete the file of ' + dmy(date) + ' from the history?')) return;
    try { if (s.src === 'sp') { const ops = webOps(); for (const o of s.ids) await ops.del(o.id); } const L = locGet(); delete L[date]; locSet(L); S.ids = null; await loadSnaps(true); } catch (e) { say('✘ ' + (e.message || e), 1); }
  }

  /* ---------------- analysis ---------------- */
  const stockOf = o => { if (!o) return null; for (const k of [S.basis || 'ph', 'ph', 'qoh', 'rp']) if (o[k] != null) return o[k]; return null; };
  const BASIS = [['ph', 'Physical count'], ['qoh', 'System on hand'], ['rp', 'JDE report quantity']];
  function analyse() {
    const sn = S.snaps; if (!sn.length) return null;
    if (!S.a || !sn.some(s => s.date === S.a)) S.a = sn[sn.length - 1].date; const ia = sn.findIndex(s => s.date === S.a);
    if (!S.b || !sn.some(s => s.date === S.b) || S.b >= S.a) S.b = ia > 0 ? sn[ia - 1].date : '';
    const A = sn[ia], B = S.b ? sn.find(s => s.date === S.b) : null, ib = B ? sn.indexOf(B) : -1, H = sn.slice(Math.max(0, ia - 29), ia + 1), gap = B ? dd(A.date, B.date) : 1;
    const codes = new Set([...A.map.keys(), ...(B ? B.map.keys() : [])]), rows = [], zt = S.z, tolf = S.tol / 100;
    codes.forEach(c => {
      const oa = A.map.get(c) || null, ob = B ? B.map.get(c) || null : null, meta = oa || ob, [cat, grp] = catOf(meta), cur = stockOf(oa), prev = stockOf(ob);
      const series = H.map(s => stockOf(s.map.get(c))), pairs = [];
      for (let j = 1; j < H.length; j++) { const pa = H[j - 1].map.get(c), pb = H[j].map.get(c); if (pa && pb) { const g = dd(H[j].date, H[j - 1].date), s0 = stockOf(pa), s1 = stockOf(pb), rc = pb.rc || 0; pairs.push({ date: H[j].date, g, cons: Math.max(0, s0 + rc - s1), inc: Math.max(0, s1 - s0 - rc) }); } }
      const rc = oa ? oa.rc || 0 : 0, hasCmp = cur != null && prev != null, delta = hasCmp ? cur - prev : null, cons = hasCmp ? Math.max(0, prev + rc - cur) : null, inc = hasCmp ? Math.max(0, cur - prev - rc) : null, per = cons == null ? null : cons / gap;
      const base = pairs.filter(p => B && p.date <= B.date).slice(-14).map(p => p.cons / p.g), bm = base.length ? base.reduce((a, v) => a + v, 0) / base.length : null, bs = base.length > 1 ? Math.sqrt(base.reduce((a, v) => a + (v - bm) * (v - bm), 0) / (base.length - 1)) : 0;
      const z = per == null || bm == null || base.length < 5 ? null : (per - bm) / Math.max(bs, 0.1 * bm, 1e-9);
      const rec = pairs.filter(p => p.date > addD(A.date, -14)), sg = rec.reduce((a, p) => a + p.g, 0), avg = sg ? rec.reduce((a, p) => a + p.cons, 0) / sg : null, cover = avg > 0 && cur > 0 ? cur / avg : null;
      const al = [], push = (lvl, t) => al.push({ lvl, t });
      const minAbs = Math.max(1, 0.02 * Math.abs(cur || 0));
      if (oa && !ob && B) push(0, 'New in the file'); if (!oa && ob) push(1, 'Not in the file any more');
      if (oa && oa.qoh != null && oa.qoh < 0) push(2, 'System on-hand is negative (' + fq(oa.qoh) + ') — issues posted without receipts');
      if (cur != null && cur <= 0 && ((prev || 0) > 0 || (avg || 0) > 0)) push(2, 'Out of stock' + (prev > 0 ? ' (was ' + fq(prev) + ')' : ''));
      if (z != null && z >= zt && per - bm >= minAbs) push(z >= zt + 1 ? 2 : 1, 'Consumption ' + fq(cons) + ' in ' + gap + ' day(s) — usual ' + fq(bm * gap) + ' (' + (z > 20 ? 'far above' : f1(z) + '× the normal swing of') + (z > 20 ? ' the normal swing)' : ')'));
      if (inc != null && inc >= Math.max(1, 0.05 * (prev || 0)) && prev > 0) push(inc >= prev ? 2 : 1, 'Stock rose by ' + fq(inc) + ' without a receipt in the file — unrecorded receipt or count correction?');
      if (oa && oa.vr != null && cur != null) { const av = Math.abs(oa.vr), lim = Math.max(1, tolf * Math.abs(cur)); if (av > lim && av >= 1) push(av > 0.1 * Math.max(Math.abs(cur), 1) || cur === 0 ? 2 : 1, 'Count differs from the system by ' + sgn(oa.vr) + ' (' + (cur ? f1(Math.abs(oa.vr) / Math.abs(cur) * 100) + '% of the stock' : 'system ' + fq(oa.qoh)) + ')'); }
      if (cover != null && cover < S.cover) push(cover < 3 ? 2 : 1, 'Only ' + f1(cover) + ' day(s) of cover left at the recent usage (' + fq(avg) + '/day)');
      const idle = cur > 0 && rec.length >= 3 && rec.every(p => p.cons === 0 && p.inc === 0);
      rows.push({ c, d: meta.d, u: meta.u, cat, grp, cur, prev, delta, dp: hasCmp && prev ? delta / Math.abs(prev) * 100 : null, rc: oa ? oa.rc : null, is: oa ? oa.is : null, vr: oa ? oa.vr : null, qoh: oa ? oa.qoh : null, ph: oa ? oa.ph : null, cons, per, avg, cover, z, bm, series, pairs, idle, al, lvl: al.reduce((m, x) => Math.max(m, x.lvl), 0), isNew: !!(oa && !ob && B), gone: !!(!oa && ob) });
    });
    rows.sort((a, b) => b.lvl - a.lvl || Math.abs(b.delta || 0) - Math.abs(a.delta || 0) || a.c.localeCompare(b.c));
    /* totals by category + unit */
    const cm = new Map(); rows.forEach(r => { if (r.gone) return; const k = r.cat + '|' + r.u, o = cm.get(k) || { cat: r.cat, grp: r.grp, u: r.u, n: 0, prev: 0, cur: 0, cons: 0, al: 0, hasPrev: false }; o.n++; o.cur += r.cur || 0; if (r.prev != null) { o.prev += r.prev; o.hasPrev = true; } o.cons += r.cons || 0; if (r.lvl) o.al++; cm.set(k, o); });
    const cats = [...cm.values()].sort((a, b) => a.grp.localeCompare(b.grp) || a.cat.localeCompare(b.cat) || a.u.localeCompare(b.u));
    const live = rows.filter(r => !r.gone), cnt = live.filter(r => r.vr != null && r.cur != null), ok = cnt.filter(r => Math.abs(r.vr) <= Math.max(1, tolf * Math.abs(r.cur)));
    const KP = { items: live.length, inStock: live.filter(r => r.cur > 0).length, out: live.filter(r => r.cur != null && r.cur <= 0).length, neg: live.filter(r => r.qoh != null && r.qoh < 0).length, up: live.filter(r => r.delta > 0).length, down: live.filter(r => r.delta < 0).length, same: live.filter(r => r.delta === 0).length, used: live.filter(r => r.cons > 0).length, low: live.filter(r => r.cover != null && r.cover < S.cover).length, var: cnt.length - ok.length, acc: cnt.length ? ok.length / cnt.length * 100 : null, counted: cnt.length, abn: rows.filter(r => r.lvl === 2).length, watch: rows.filter(r => r.lvl === 1).length, idle: live.filter(r => r.idle).length, unexp: live.filter(r => r.al.some(x => /without a receipt/.test(x.t))).length };
    return { A, B, H, gap, rows, cats, kpi: KP, hasCmp: !!B, n: sn.length };
  }
  function itemHist(c) {   /* every snapshot of one item, newest last */
    return S.snaps.map((s, i) => { const o = s.map.get(c); if (!o) return null; const prev = i ? S.snaps[i - 1].map.get(c) : null, v = stockOf(o), p = prev ? stockOf(prev) : null; return { date: s.date, o, v, p, cons: p != null && v != null ? Math.max(0, p + (o.rc || 0) - v) : null, g: i ? dd(s.date, S.snaps[i - 1].date) : 1 }; }).filter(Boolean);
  }

  /* ---------------- little charts ---------------- */
  const niceMax = m => { m = Math.max(1, m); const mag = Math.pow(10, Math.floor(Math.log10(m))), st = mag / 2; return Math.ceil(m / st) * st; };
  function lineSvg(labels, series, o) {
    o = o || {}; const W = 680, H = 210, l = 54, r = 10, t = 10, b = 24, vals = series.flatMap(s => s.d.filter(v => v != null)), mxv = vals.length ? Math.max(...vals) : 1, mnv = vals.length ? Math.min(...vals) : 0; let top = niceMax(Math.max(1, mxv)), lo = 0; if (o.zero === false && vals.length) { const rg = Math.max(mxv - mnv, Math.abs(mxv) * 0.02, 1), st = Math.pow(10, Math.floor(Math.log10(rg))) / 2; lo = Math.floor(mnv / st) * st; top = Math.ceil(mxv / st) * st; if (top <= lo) top = lo + st; } const span = Math.max(1, top - lo), n = labels.length, xs = i => l + (n <= 1 ? (W - l - r) / 2 : i * (W - l - r) / (n - 1)), ys = v => t + (H - t - b) * (1 - (v - lo) / span);
    let g = ''; for (let i = 0; i <= 4; i++) { const v = lo + span * i / 4, y = ys(v); g += `<line x1="${l}" x2="${W - r}" y1="${y}" y2="${y}" stroke="#e2e8f0"/><text x="${l - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748b">${fq(v)}</text>`; }
    const step = Math.max(1, Math.ceil(n / 10)); labels.forEach((d, i) => { if (i % step === 0) g += `<text x="${xs(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#64748b">${dshort(d)}</text>`; });
    series.forEach(s => { const pts = s.d.map((v, i) => v == null ? null : [xs(i), ys(v)]).filter(Boolean); if (s.bar) { const bw = Math.max(3, (W - l - r) / Math.max(1, n) * 0.6); s.d.forEach((v, i) => { if (v) g += `<rect x="${xs(i) - bw / 2}" y="${ys(v)}" width="${bw}" height="${Math.max(0.5, ys(lo) - ys(v))}" fill="${s.c}" opacity=".75"><title>${esc(s.n)} ${dmy(labels[i])}: ${fq(v)}</title></rect>`; }); return; }
      if (pts.length > 1) g += `<polyline fill="none" stroke="${s.c}" stroke-width="2.2" ${s.dash ? 'stroke-dasharray="5 4"' : ''} points="${pts.map(p => p.join(',')).join(' ')}"/>`; if (n <= 40) s.d.forEach((v, i) => { if (v != null) g += `<circle cx="${xs(i)}" cy="${ys(v)}" r="2.6" fill="${s.c}"><title>${esc(s.n)} ${dmy(labels[i])}: ${fq(v)}</title></circle>`; }); });
    return `<svg viewBox="0 0 ${W} ${H}" class="rpa-svg">${g}</svg><div class="rpa-leg">${series.map(s => `<span><i style="background:${s.c}"></i>${esc(s.n)}</span>`).join('')}</div>`;
  }
  const LVC = ['#16a34a', '#d97706', '#dc2626'], LVN = ['Normal', 'Watch', 'Abnormal'];
  const badge = l => `<span class="rpa-pill" style="background:${LVC[l]}22;color:${LVC[l]}">${l === 2 ? '⚠ ' : l === 1 ? '👁 ' : '✔ '}${LVN[l]}</span>`;
  function spark(vals, lvl) {
    const v = vals.filter(x => x != null); if (v.length < 2) return '<span class="rpa-hint">–</span>'; const W = 96, H = 26, mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1, n = vals.length;
    const pts = vals.map((x, i) => x == null ? null : [2 + i * (W - 4) / (n - 1), H - 3 - (x - mn) / rg * (H - 6)]).filter(Boolean), l = pts[pts.length - 1];
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="vertical-align:middle"><polyline fill="none" stroke="#64748b" stroke-width="1.4" points="${pts.map(q => q.join(',')).join(' ')}"/><circle cx="${l[0]}" cy="${l[1]}" r="3" fill="${LVC[lvl] || '#0ea5e9'}"/></svg>`;
  }
  const kpi = (l, v, s, c) => `<div class="rpa-k${c ? ' ' + c : ''}"><div class="t">${l}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;

  /* ---------------- web page ---------------- */
  const TABS = [['dash', '📊 Dashboard'], ['cmp', '⚖ Today vs previous'], ['alr', '⚠ Abnormal changes'], ['trend', '📈 Trends'], ['up', '📥 Upload file']];
  function ctrlHtml(R) {
    const sn = S.snaps, opt = (arr, v) => arr.map(([k, t]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('');
    return `<div class="rpa-bar"><label>Today (file date)<select data-ra>${sn.slice().reverse().map(s => `<option value="${s.date}"${s.date === R.A.date ? ' selected' : ''}>${dmy(s.date)}</option>`).join('')}</select></label>
      <label>Compare with<select data-rb>${sn.filter(s => s.date < R.A.date).reverse().map(s => `<option value="${s.date}"${R.B && s.date === R.B.date ? ' selected' : ''}>${dmy(s.date)}</option>`).join('') || '<option value="">— none —</option>'}</select></label>
      <label>Stock = <select data-rbasis>${opt(BASIS, S.basis)}</select></label>
      <label>Sensitivity<select data-rz>${opt([['1.5', 'High — small changes'], ['2', 'Normal'], ['3', 'Low — big changes only']], String(S.z))}</select></label>
      <label>Low cover below<select data-rcov>${opt([['7', '7 days'], ['14', '14 days'], ['30', '30 days']], String(S.cover))}</select></label>
      <label>Count tolerance<select data-rtol>${opt([['0', '0 %'], ['2', '2 %'], ['5', '5 %']], String(S.tol))}</select></label></div>`;
  }
  const hdrNote = R => `<div class="rpa-hint" style="margin:0 0 8px">Today = <b>${dmy(R.A.date)}</b>${R.B ? ` · compared with <b>${dmy(R.B.date)}</b> (${R.gap} day${R.gap > 1 ? 's' : ''} earlier)` : ''} · ${R.n} file(s) in the history · stock = ${esc((BASIS.find(b => b[0] === S.basis) || [])[1] || '')} · consumption = previous stock + receipts − current stock</div>`;
  function dashHtml(R) {
    const K = R.kpi; let h = ctrlHtml(R) + hdrNote(R);
    if (!R.hasCmp) h += `<div class="rpa-warn">Only one file is in the history, so there is nothing to compare yet. Upload the next day’s file (or older files — they are dated from the file name) and the comparison, consumption, cover and trends start. The count checks below already work.</div>`;
    h += `<div class="rpa-kpis">${kpi('Items in the file', K.items, K.inStock + ' with stock')}${kpi('Abnormal', K.abn, 'need attention', K.abn ? 'r' : 'g')}${kpi('Watch list', K.watch, 'moderate', K.watch ? 'o' : 'g')}${kpi('Out of stock', K.out, 'zero or below', K.out ? 'r' : '')}${kpi('Low cover', R.hasCmp ? K.low : '–', 'below ' + S.cover + ' days', K.low ? 'o' : '')}${kpi('Count accuracy', K.acc == null ? '–' : f1(K.acc) + '%', K.counted + ' counted · ' + K.var + ' differ', K.acc != null && K.acc < 90 ? 'o' : 'g')}${kpi('Negative on-hand', K.neg, 'system issue', K.neg ? 'r' : '')}${R.hasCmp ? kpi('Stock went down', K.down, K.used + ' items consumed') + kpi('Stock went up', K.up, K.unexp + ' without a receipt', K.unexp ? 'o' : '') + kpi('Unchanged', K.same, K.idle + ' idle 14+ days') : ''}</div>`;
    h += `<div class="rpa-c"><h4>By material group — ${dmy(R.A.date)}${R.B ? ' vs ' + dmy(R.B.date) : ''}</h4><div class="rpa-wrap"><table class="rpa-t"><thead><tr><th>Group</th><th>Category</th><th>Unit</th><th class="n">Items</th><th class="n">Previous</th><th class="n">Current</th><th class="n">Change</th><th class="n">Change %</th><th class="n">Consumed</th><th class="n">Alerts</th></tr></thead><tbody>${R.cats.map(c => `<tr><td>${c.grp}</td><td>${esc(c.cat)}</td><td>${esc(c.u)}</td><td class="n">${c.n}</td><td class="n">${c.hasPrev ? fq(c.prev) : '–'}</td><td class="n rpa-b">${fq(c.cur)}</td><td class="n">${c.hasPrev ? sgn(c.cur - c.prev) : '–'}</td><td class="n">${c.hasPrev && c.prev ? sgn((c.cur - c.prev) / Math.abs(c.prev) * 100, f1) + '%' : '–'}</td><td class="n">${c.hasPrev ? fq(c.cons) : '–'}</td><td class="n">${c.al ? `<span class="rpa-bad">${c.al}</span>` : 0}</td></tr>`).join('')}</tbody></table></div></div>`;
    const top = R.rows.filter(r => r.cons > 0).sort((a, b) => (b.z || 0) - (a.z || 0) || b.cons - a.cons).slice(0, 10), low = R.rows.filter(r => r.cover != null).sort((a, b) => a.cover - b.cover).slice(0, 10), mx = Math.max(1, ...top.map(r => r.cons));
    h += `<div class="rpa-grid" style="margin-top:12px"><div class="rpa-c"><h4>Top consumption since ${R.B ? dmy(R.B.date) : 'the previous file'}</h4>${top.length ? `<table class="rpa-t"><tbody>${top.map(r => `<tr class="rpa-go" data-ritem="${esc(r.c)}"><td>${esc(r.d)}<div class="rpa-hint">${esc(r.c)} · ${esc(r.cat)}</div></td><td style="width:34%"><div class="rpa-bar1"><i style="width:${Math.max(3, r.cons / mx * 100)}%"></i></div></td><td class="n">${fq(r.cons)} ${esc(r.u)}</td></tr>`).join('')}</tbody></table>` : '<div class="rpa-none">No consumption between the two files.</div>'}</div>
      <div class="rpa-c"><h4>Lowest cover (days of stock at the recent usage)</h4>${low.length ? `<table class="rpa-t"><tbody>${low.map(r => `<tr class="rpa-go" data-ritem="${esc(r.c)}"><td>${esc(r.d)}<div class="rpa-hint">${esc(r.c)} · ${fq(r.cur)} ${esc(r.u)} · ${fq(r.avg)}/day</div></td><td class="n rpa-b" style="color:${r.cover < 3 ? '#dc2626' : r.cover < S.cover ? '#d97706' : 'inherit'}">${f1(r.cover)} d</td></tr>`).join('')}</tbody></table>` : '<div class="rpa-none">Cover needs at least two files with consumption.</div>'}</div></div>`;
    const al = R.rows.filter(r => r.lvl > 0).slice(0, 8);
    h += `<div class="rpa-c" style="margin-top:12px"><h4>⚠ Most important findings <span class="rpa-hint">— see “Abnormal changes” for all ${K.abn + K.watch}</span> <button class="secondary small" type="button" data-rgo="mailfind" style="float:right">📧 Email findings</button></h4>${al.length ? `<table class="rpa-t"><tbody>${al.map(r => `<tr class="rpa-go" data-ritem="${esc(r.c)}"><td>${esc(r.d)}<div class="rpa-hint">${esc(r.c)} · ${esc(r.cat)}</div></td><td>${r.al.filter(x => x.lvl > 0).map(x => `<div style="color:${LVC[x.lvl]}">${esc(x.t)}</div>`).join('')}</td></tr>`).join('')}</tbody></table>` : '<div class="rpa-none">Nothing unusual.</div>'}</div>`;
    return h;
  }
  const STF = [['', 'All items'], ['alerts', 'With findings'], ['changed', 'Changed'], ['down', 'Stock down'], ['up', 'Stock up'], ['out', 'Out of stock'], ['low', 'Low cover'], ['var', 'Count differs'], ['new', 'New / missing']];
  function cmpRows(R) {
    const f = S.f, q = f.q.toLowerCase(); return R.rows.filter(r => (!f.cat || r.cat === f.cat) && (!f.lv || (f.lv === 'new' ? r.isNew : f.lv === 'gone' ? r.gone : !r.isNew && !r.gone && r.lvl === +f.lv)) && (!q || (r.c + ' ' + r.d).toLowerCase().includes(q)) && (!f.st || (f.st === 'alerts' ? r.lvl > 0 : f.st === 'changed' ? r.delta : f.st === 'down' ? r.delta < 0 : f.st === 'up' ? r.delta > 0 : f.st === 'out' ? r.cur != null && r.cur <= 0 : f.st === 'low' ? r.cover != null && r.cover < S.cover : f.st === 'var' ? r.al.some(x => /Count differs/.test(x.t)) : r.isNew || r.gone)));
  }
  function cmpHtml(R) {
    const rows = cmpRows(R), cats = [...new Set(R.rows.map(r => r.cat))].sort(); let h = ctrlHtml(R) + hdrNote(R);
    h += `<div class="rpa-bar"><label>Category<select data-rf="cat"><option value="">All</option>${cats.map(c => `<option${S.f.cat === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label>Status<select data-rf="lv"><option value="">All</option><option value="2"${S.f.lv === '2' ? ' selected' : ''}>⚠ Abnormal</option><option value="1"${S.f.lv === '1' ? ' selected' : ''}>👁 Watch</option><option value="0"${S.f.lv === '0' ? ' selected' : ''}>✔ Normal</option><option value="new"${S.f.lv === 'new' ? ' selected' : ''}>New</option><option value="gone"${S.f.lv === 'gone' ? ' selected' : ''}>Missing</option></select></label><label>Show<select data-rf="st">${STF.map(([k, t]) => `<option value="${k}"${S.f.st === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label><label>Search<input type="search" data-rq value="${esc(S.f.q)}" placeholder="Code or description" style="min-width:200px"></label><span class="rpa-hint">${rows.length} item(s)</span></div>`;
    h += `<div class="rpa-wrap" style="max-height:68vh"><table class="rpa-t"><thead><tr><th>Item</th><th>Description</th><th>Unit</th><th class="n">Previous</th><th class="n">Today</th><th class="n">Change</th><th class="n">%</th><th class="n">Receipts</th><th class="n">Consumed</th><th class="n">Avg / day</th><th class="n">Cover (d)</th><th class="n">Count var.</th><th>Last ${R.H.length} files</th><th>Status</th></tr></thead><tbody>${rows.slice(0, S.lim).map(r => `<tr class="rpa-go${r.gone ? ' rpa-dim' : ''}" data-ritem="${esc(r.c)}" title="${esc(r.al.map(x => x.t).join(' | '))}"><td>${esc(r.c)}</td><td>${esc(r.d)}<div class="rpa-hint">${esc(r.cat)}</div></td><td>${esc(r.u)}</td><td class="n">${fq(r.prev)}</td><td class="n rpa-b">${fq(r.cur)}</td><td class="n" style="color:${r.delta > 0 ? '#0284c7' : r.delta < 0 ? '#7c3aed' : 'inherit'}">${r.delta == null ? '–' : sgn(r.delta)}</td><td class="n">${r.dp == null ? '–' : sgn(r.dp, f1) + '%'}</td><td class="n">${r.rc ? fq(r.rc) : ''}</td><td class="n">${r.cons == null ? '–' : fq(r.cons)}</td><td class="n">${r.avg == null ? '–' : fq(r.avg)}</td><td class="n">${r.cover == null ? '–' : f1(r.cover)}</td><td class="n" style="color:${r.vr ? '#b45309' : 'inherit'}">${r.vr == null ? '–' : r.vr ? sgn(r.vr) : '0'}</td><td>${spark(r.series, r.lvl)}</td><td>${r.isNew ? '<span class="rpa-pill">New</span>' : r.gone ? '<span class="rpa-pill">Missing</span>' : badge(r.lvl)}</td></tr>`).join('') || '<tr><td colspan="14" class="rpa-none">No items.</td></tr>'}</tbody></table></div>${rows.length > S.lim ? `<div class="rpa-hint" style="margin-top:6px">Showing ${S.lim} of ${rows.length} — <a href="#" data-rmore>show more</a> or filter · Excel exports all of them.</div>` : ''}`;
    return h;
  }
  const alertAll = R => { const o = []; R.rows.forEach(r => r.al.filter(x => x.lvl > 0).forEach(x => o.push({ r, x }))); return o; };
  const alertList = R => { const a = S.af, it = a.item.toLowerCase(), de = a.desc.toLowerCase(); return alertAll(R).filter(({ r, x }) => (!a.lvl || x.lvl === +a.lvl) && (!a.cat || r.cat === a.cat) && (!it || r.c.toLowerCase().includes(it)) && (!de || r.d.toLowerCase().includes(de))).sort((a, b) => b.x.lvl - a.x.lvl || Math.abs(b.r.delta || 0) - Math.abs(a.r.delta || 0)); };
  function alrHtml(R) {
    const L = alertList(R); let h = ctrlHtml(R) + hdrNote(R);
    h += `<div class="rpa-kpis">${kpi('Abnormal', R.kpi.abn, 'items', R.kpi.abn ? 'r' : 'g')}${kpi('Watch list', R.kpi.watch, 'items', R.kpi.watch ? 'o' : 'g')}${kpi('Findings', L.length, 'in total')}</div>`;
    const A0 = alertAll(R), cats = [...new Set(A0.map(x => x.r.cat))].sort(), af = S.af;
    h += `<div class="rpa-bar"><label>Level<select data-raf="lvl"><option value="">All</option><option value="2"${af.lvl === '2' ? ' selected' : ''}>⚠ Abnormal</option><option value="1"${af.lvl === '1' ? ' selected' : ''}>👁 Watch</option></select></label><label>Item<input type="search" data-raf="item" value="${esc(af.item)}" placeholder="Item code" style="width:130px"></label><label>Description<input type="search" data-raf="desc" value="${esc(af.desc)}" placeholder="Description" style="min-width:190px"></label><label>Category<select data-raf="cat"><option value="">All</option>${cats.map(c => `<option${af.cat === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>${af.lvl || af.item || af.desc || af.cat ? '<button class="secondary small" type="button" data-rgo="clrf">✕ Clear filters</button>' : ''}<button class="secondary small" type="button" data-rgo="mailfind">📧 Email these findings</button><span class="rpa-hint">${L.length} of ${A0.length} finding(s)</span></div>`;
    h += L.length ? `<div class="rpa-wrap" style="max-height:70vh"><table class="rpa-t"><thead><tr><th>Level</th><th>Item</th><th>Description</th><th>Category</th><th class="n">Previous</th><th class="n">Today</th><th class="n">Change</th><th>Finding</th><th>Last ${R.H.length} files</th></tr></thead><tbody>${L.slice(0, 600).map(({ r, x }) => `<tr class="rpa-go" data-ritem="${esc(r.c)}"><td>${badge(x.lvl)}</td><td>${esc(r.c)}</td><td>${esc(r.d)}</td><td>${esc(r.cat)}</td><td class="n">${fq(r.prev)}</td><td class="n rpa-b">${fq(r.cur)}</td><td class="n">${r.delta == null ? '–' : sgn(r.delta)}</td><td style="white-space:normal;min-width:280px;color:${LVC[x.lvl]}">${esc(x.t)}</td><td>${spark(r.series, x.lvl)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="rpa-none">' + (A0.length ? 'No finding matches the filters.' : '✔ Nothing abnormal — every item is inside its normal range.') + '</div>';
    return h + `<div class="rpa-hint" style="margin-top:8px">How it is judged: consumption against the item’s own normal daily swing over the previous files (needs 5+ files) · stock that rose without a receipt · out of stock · negative system stock · count differing from the system by more than the tolerance · cover days below the limit.</div>`;
  }

  /* ---------------- e-mail of the findings ---------------- */
  function findingsEmail(R, all) {
    const L = all ? alertAll(R) : alertList(R), A0 = alertAll(R), cap = 120, F = "font-family:Segoe UI,Calibri,Arial,sans-serif;", K = R.kpi, byItem = new Map();
    L.sort((a, b) => b.x.lvl - a.x.lvl || Math.abs(b.r.delta || 0) - Math.abs(a.r.delta || 0)).forEach(({ r, x }) => { const o = byItem.get(r.c) || { r, xs: [] }; o.xs.push(x); byItem.set(r.c, o); });
    const items = [...byItem.values()].sort((a, b) => Math.max(...b.xs.map(x => x.lvl)) - Math.max(...a.xs.map(x => x.lvl))), shown = items.slice(0, cap), tile = (l, v, c) => `<td width="20%" valign="top" style="background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid ${c};padding:9px 11px;${F}"><div style="font-size:11px;color:#64748b;">${l}</div><div style="font-size:21px;font-weight:700;color:#0f2a47;">${v}</div></td>`;
    const td = 'padding:8px 10px;border-bottom:1px solid #e5eaf1;font-size:12.5px;';
    let h = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eef2f7;"><tr><td align="center" style="padding:18px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:860px;width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #dbe3ec;">`;
    h += `<tr><td bgcolor="#0f2a47" style="background:#0f2a47;background-image:linear-gradient(120deg,#0f2a47,#0e7490);padding:22px 26px;${F}"><div style="font-size:11px;letter-spacing:1.6px;color:#7dd3fc;font-weight:600;">NFPC · ORBIT · RM &amp; PM</div><div style="font-size:23px;font-weight:700;color:#ffffff;margin-top:4px;">Most important findings</div><div style="font-size:12.5px;color:#cfe3f5;margin-top:6px;">Today ${dmy(R.A.date)}${R.B ? ' vs ' + dmy(R.B.date) : ''} · stock = ${esc((BASIS.find(b => b[0] === S.basis) || [])[1] || '')}</div></td></tr>`;
    h += `<tr><td style="padding:16px 20px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;margin:0 -6px;width:calc(100% + 12px);"><tr>${tile('Abnormal', K.abn, '#dc2626')}${tile('Watch list', K.watch, '#d97706')}${tile('Out of stock', K.out, '#7c3aed')}${tile('Negative on-hand', K.neg, '#0ea5e9')}${tile('Count accuracy', K.acc == null ? '–' : f1(K.acc) + '%', '#16a34a')}</tr></table></td></tr>`;
    h += `<tr><td style="padding:10px 20px 4px;${F}font-size:12px;color:#475569;">${items.length} item(s) with findings${L.length !== A0.length ? ' (filtered from ' + new Set(A0.map(x => x.r.c)).size + ')' : ''}${items.length > cap ? ' — the first ' + cap + ' are listed, the full list is in the attached Excel file' : ''}.</td></tr>`;
    h += `<tr><td style="padding:6px 20px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;width:100%;"><colgroup><col style="width:30%"><col style="width:12%"><col style="width:12%"><col style="width:46%"></colgroup><tr bgcolor="#0f2a47" style="background:#0f2a47;">${['ITEM', 'PREVIOUS', 'TODAY', 'FINDING'].map((t, i) => `<td align="${i && i < 3 ? 'right' : 'left'}" style="${F}padding:9px 10px;font-size:11.5px;font-weight:700;color:#ffffff;">${t}</td>`).join('')}</tr>`;
    shown.forEach(({ r, xs }, i) => { const lv = Math.max(...xs.map(x => x.lvl)), bg = i % 2 ? '#f8fafc' : '#ffffff'; h += `<tr bgcolor="${bg}" style="background:${bg};"><td valign="top" style="${F}${td}border-left:4px solid ${LVC[lv]};"><b style="color:#0f2a47;">${esc(r.d)}</b><div style="font-size:11px;color:#64748b;">${esc(r.c)} · ${esc(r.cat)}</div></td><td valign="top" align="right" style="${F}${td}">${fq(r.prev)}</td><td valign="top" align="right" style="${F}${td}font-weight:700;">${fq(r.cur)} <span style="font-weight:400;color:#64748b;">${esc(r.u)}</span></td><td valign="top" style="${F}${td}">${xs.map(x => `<div style="color:${LVC[x.lvl]};margin-bottom:2px;">${x.lvl === 2 ? '⚠' : '👁'} ${esc(x.t)}</div>`).join('')}</td></tr>`; });
    if (!shown.length) h += `<tr><td colspan="4" style="${F}padding:16px;color:#16a34a;">✔ Nothing abnormal — every item is inside its normal range.</td></tr>`;
    h += `</table></td></tr><tr><td style="padding:12px 22px 18px;${F}font-size:11.5px;color:#94a3b8;border-top:1px solid #e5eaf1;">Sent from ORBIT · ${new Date().toLocaleString()}</td></tr></table></td></tr></table>`;
    const r0 = x => x == null ? '' : Math.round(x * 100) / 100;
    return { title: 'RM & PM — most important findings', sheet: 'RMPM findings', note: 'Today ' + dmy(R.A.date) + (R.B ? ' vs ' + dmy(R.B.date) : ''), headers: ['Level', 'Item', 'Description', 'Category', 'Unit', 'Previous', 'Today', 'Change', 'Finding'], rows: L.map(({ r, x }) => [LVN[x.lvl], r.c, r.d, r.cat, r.u, r0(r.prev), r0(r.cur), r0(r.delta), x.t]), html: h, raw: true };
  }
  function trendHtml(R) {
    const items = R.rows.filter(r => !r.gone).sort((a, b) => a.cat.localeCompare(b.cat) || a.d.localeCompare(b.d)), cats = [...new Set(R.rows.map(r => r.cat))].sort();
    if (!S.item || !items.some(r => r.c === S.item)) S.item = items.length ? items[0].c : ''; if (!S.cat || !cats.includes(S.cat)) S.cat = cats[0] || '';
    let h = ctrlHtml(R) + `<div class="rpa-bar"><label>Item<select data-ritemsel style="min-width:320px">${items.map(r => `<option value="${esc(r.c)}"${r.c === S.item ? ' selected' : ''}>${esc(r.c + ' — ' + r.d)}</option>`).join('')}</select></label></div>`;
    const it = R.rows.find(r => r.c === S.item), hist = it ? itemHist(it.c) : [];
    if (it) {
      h += `<div class="rpa-kpis">${kpi('Stock today', fq(it.cur) + ' ' + esc(it.u), it.prev != null ? 'was ' + fq(it.prev) : '')}${kpi('Change', it.delta == null ? '–' : sgn(it.delta), it.dp == null ? '' : sgn(it.dp, f1) + '%')}${kpi('Consumed', it.cons == null ? '–' : fq(it.cons), 'since previous file')}${kpi('Average per day', it.avg == null ? '–' : fq(it.avg), 'last 14 days')}${kpi('Days of cover', it.cover == null ? '–' : f1(it.cover), '', it.cover != null && it.cover < S.cover ? 'o' : '')}${kpi('Status', badge(it.lvl), it.al.filter(x => x.lvl > 0).length + ' finding(s)')}</div>`;
      const labs = hist.map(x => x.date); h += `<div class="rpa-grid"><div class="rpa-c"><h4>${esc(it.d)} — stock per file</h4>${lineSvg(labs, [{ n: 'Stock', c: '#0ea5e9', d: hist.map(x => x.v) }, { n: 'System on hand', c: '#94a3b8', dash: 1, d: hist.map(x => x.o.qoh) }], { zero: false })}</div><div class="rpa-c"><h4>Consumption per day</h4>${lineSvg(labs, [{ n: 'Per day', c: '#f59e0b', bar: 1, d: hist.map(x => x.cons == null ? null : x.cons / x.g) }, { n: 'Average', c: '#7c3aed', dash: 1, d: hist.map(() => it.avg) }])}</div></div>`;
      h += `<div class="rpa-c" style="margin-top:12px"><h4>History</h4><div class="rpa-wrap" style="max-height:34vh"><table class="rpa-t"><thead><tr><th>File date</th><th class="n">Stock</th><th class="n">System on hand</th><th class="n">Receipts</th><th class="n">Issues</th><th class="n">Count var.</th><th class="n">Consumed</th></tr></thead><tbody>${hist.slice().reverse().map(x => `<tr><td>${dmy(x.date)}</td><td class="n rpa-b">${fq(x.v)}</td><td class="n">${fq(x.o.qoh)}</td><td class="n">${fq(x.o.rc)}</td><td class="n">${fq(x.o.is)}</td><td class="n">${fq(x.o.vr)}</td><td class="n">${x.cons == null ? '–' : fq(x.cons)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    const cs = S.snaps.map(s => { let tot = 0, cons = 0; const p = S.snaps[S.snaps.indexOf(s) - 1]; s.items.forEach(o => { const [c] = catOf(o); if (c !== S.cat) return; const v = stockOf(o); if (v != null) tot += v; if (p) { const q = p.map.get(o.c); if (q) cons += Math.max(0, stockOf(q) + (o.rc || 0) - (v == null ? 0 : v)); } }); return { d: s.date, tot, cons: p ? cons / dd(s.date, p.date) : null }; });
    h += `<div class="rpa-bar" style="margin-top:14px"><label>Category trend<select data-rcatsel>${cats.map(c => `<option${c === S.cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div><div class="rpa-grid"><div class="rpa-c"><h4>${esc(S.cat)} — total stock per file</h4>${lineSvg(cs.map(x => x.d), [{ n: 'Total stock', c: '#14b8a6', d: cs.map(x => x.tot) }], { zero: false })}</div><div class="rpa-c"><h4>${esc(S.cat)} — consumption per day</h4>${lineSvg(cs.map(x => x.d), [{ n: 'Per day', c: '#f59e0b', bar: 1, d: cs.map(x => x.cons) }])}</div></div>`;
    return h;
  }
  function upHtml() {
    let h = `<div class="rpa-c"><h4>📥 Upload the daily file</h4><div class="rpa-hint">Choose the Excel file (the JDE report and the count sheet “AC”). The date is taken from the file name (e.g. RM__PM<b>251126</b> = 25/11/2026) — check it before saving. You can pick several files at once to fill in earlier days.</div>
      <div class="rpa-drop" data-rdrop><input type="file" id="rpaFile" accept=".xlsx,.xls,.xlsm,.csv" multiple><span>📂 Choose file(s) or drop them here</span></div>`;
    if (S.pend.length) {
      h += `<div class="rpa-wrap" style="margin-top:8px"><table class="rpa-t"><thead><tr><th>File</th><th>Date</th><th class="n">Items</th><th>Sheets read</th><th>Note</th><th></th></tr></thead><tbody>${S.pend.map((p, i) => { const ex = S.snaps.find(s => s.date === p.date); return `<tr><td>${esc(p.name)}</td><td><input type="date" data-rpd="${i}" value="${p.date}" max="${addD(today(), 1)}"></td><td class="n">${p.items.length}</td><td>${p.info.map(x => esc(x.sheet) + ' (' + x.type + (x.n ? ', ' + x.n : '') + ')').join('<br>')}</td><td>${ex ? '<span class="rpa-bad">replaces the file of this date</span>' : ''}${p.hasCount ? '' : ' <span class="rpa-hint">no count sheet — JDE report quantities only</span>'}</td><td><button class="secondary small" type="button" data-rrm="${i}">✕</button></td></tr>`; }).join('')}</tbody></table></div>
        <div class="rpa-foot"><button type="button" data-rsave ${canUp() && !S.busy ? '' : 'disabled'}>💾 Save ${S.pend.length} file(s)</button>${canUp() ? '' : '<span class="rpa-bad">You need upload permission to save.</span>'}<span class="rpa-hint">Saved to SharePoint (${LIST}); if that list is not ready the file is kept on this device.</span></div>`;
    }
    h += `</div><div class="rpa-c" style="margin-top:12px"><h4>History of the files</h4>${S.snaps.length ? `<div class="rpa-wrap" style="max-height:40vh"><table class="rpa-t"><thead><tr><th>Date</th><th>File</th><th class="n">Items</th><th>Uploaded by</th><th>Stored</th><th></th></tr></thead><tbody>${S.snaps.slice().reverse().map(s => `<tr><td>${dmy(s.date)}</td><td>${esc(s.file)}</td><td class="n">${s.items.length}</td><td>${esc(s.by)}</td><td>${s.src === 'sp' ? '☁ SharePoint' : '<span class="rpa-bad">💻 this device only</span>'}</td><td>${isAdmin() ? `<button class="secondary small" type="button" data-rdel="${s.date}">🗑</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="rpa-none">No file yet.</div>'}</div>
      <details class="rpa-c" style="margin-top:12px"><summary><b>Set-up (once)</b> — the SharePoint list</summary><div class="rpa-hint" style="margin-top:6px">Create a list named <b>${LIST}</b> with these columns (internal names exactly): <b>Title</b> (text, already there) · <b>Snap_Date</b> (date only) · <b>Part</b> (number) · <b>Items_JSON</b> (multiple lines of text — <u>plain text</u>) · <b>Item_Count</b> (number) · <b>Source_File</b> (single line of text) · <b>Uploaded_By</b> (single line of text). One row is saved per day (a second row only if the file is very large).</div></details>`;
    return h;
  }
  function viewHtml() {
    if (S.tab === 'up') return upHtml(); const R = analyse(); if (!R) return `<div class="rpa-warn">No file has been uploaded yet — open “Upload file” and choose the daily RM &amp; PM Excel file.</div>`;
    return S.tab === 'cmp' ? cmpHtml(R) : S.tab === 'alr' ? alrHtml(R) : S.tab === 'trend' ? trendHtml(R) : dashHtml(R);
  }
  function render() {
    const b = Q('#rpaBody'); if (!b) return; const tb = Q('#rpaTabs'); if (tb) tb.innerHTML = TABS.map(([k, t]) => `<button type="button" data-rt="${k}" class="${S.tab === k ? 'on' : ''}">${t}</button>`).join('');
    const ex = Q('#rpaExp'); if (ex) ex.style.display = S.tab === 'up' ? 'none' : '';
    if (!S.loaded) { b.innerHTML = '<div class="rpa-none">Loading…</div>'; return; }
    try { b.innerHTML = (S.err ? `<div class="rpa-warn">⚠ ${esc(S.err)}</div>` : '') + viewHtml(); } catch (e) { console.error(e); b.innerHTML = `<div class="rpa-warn">✘ ${esc(e.message)}</div>`; }
  }
  function report() {
    const R = analyse(); if (!R) return { title: 'RM & PM', sheet: 'RMPM', note: '', headers: ['Item'], rows: [] };
    const note = 'Today ' + dmy(R.A.date) + (R.B ? ' vs ' + dmy(R.B.date) : '') + ' · stock = ' + (BASIS.find(b => b[0] === S.basis) || [])[1], r0 = x => x == null ? '' : Math.round(x * 100) / 100;
    if (S.tab === 'dash') return { title: 'RM & PM — by material group', sheet: 'RMPM groups', note, headers: ['Group', 'Category', 'Unit', 'Items', 'Previous', 'Current', 'Change', 'Change %', 'Consumed', 'Alerts'], rows: R.cats.map(c => [c.grp, c.cat, c.u, c.n, c.hasPrev ? r0(c.prev) : '', r0(c.cur), c.hasPrev ? r0(c.cur - c.prev) : '', c.hasPrev && c.prev ? r0((c.cur - c.prev) / Math.abs(c.prev) * 100) : '', c.hasPrev ? r0(c.cons) : '', c.al]) };
    if (S.tab === 'alr') return { title: 'RM & PM — abnormal changes', sheet: 'RMPM alerts', note, headers: ['Level', 'Item', 'Description', 'Category', 'Unit', 'Previous', 'Today', 'Change', 'Finding'], rows: alertList(R).map(({ r, x }) => [LVN[x.lvl], r.c, r.d, r.cat, r.u, r0(r.prev), r0(r.cur), r0(r.delta), x.t]) };
    if (S.tab === 'trend') { const h = itemHist(S.item), it = R.rows.find(r => r.c === S.item) || {}; return { title: 'RM & PM — trend of ' + (it.d || S.item), sheet: 'RMPM trend', note: S.item, headers: ['File date', 'Stock', 'System on hand', 'Receipts', 'Issues', 'Count variance', 'Consumed'], rows: h.map(x => [dmy(x.date), r0(x.v), r0(x.o.qoh), r0(x.o.rc), r0(x.o.is), r0(x.o.vr), r0(x.cons)]) }; }
    return { title: 'RM & PM — today vs previous', sheet: 'RMPM compare', note, headers: ['Item', 'Description', 'Category', 'Group', 'Unit', 'Previous', 'Today', 'Change', 'Change %', 'Receipts', 'Issues', 'Consumed', 'Avg/day (14d)', 'Cover days', 'Count variance', 'Status', 'Findings'], rows: cmpRows(R).map(r => [r.c, r.d, r.cat, r.grp, r.u, r0(r.prev), r0(r.cur), r0(r.delta), r0(r.dp), r0(r.rc), r0(r.is), r0(r.cons), r0(r.avg), r0(r.cover), r0(r.vr), r.isNew ? 'New' : r.gone ? 'Missing' : LVN[r.lvl], r.al.filter(x => x.lvl > 0).map(x => x.t).join(' | ')]) };
  }
  function css() {
    if (Q('#rpaCss')) return; const s = document.createElement('style'); s.id = 'rpaCss';
    s.textContent = `#view-rpa .rpa-bar{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end;margin:6px 0 10px}#view-rpa .rpa-bar label{display:flex;flex-direction:column;font-size:11.5px;color:var(--gray-600);gap:2px}#view-rpa .rpa-sp{flex:1}
#view-rpa .rpa-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}#view-rpa .rpa-tabs button,#view-rpa .rpa-seg button,#view-rpa .rpa-dt button{border:1px solid var(--border);background:var(--card);color:inherit;border-radius:999px;padding:6px 13px;font-size:13px;cursor:pointer}#view-rpa .rpa-tabs button.on,#view-rpa .rpa-seg button.on{background:var(--brand,#1e3a8a);color:#fff;border-color:var(--brand,#1e3a8a)}
#view-rpa .rpa-seg{display:inline-flex;gap:4px}#view-rpa .rpa-dt{display:inline-flex;gap:4px;align-items:center}#view-rpa .rpa-dt button{padding:5px 10px;border-radius:8px}
#view-rpa .rpa-wrap{overflow:auto;border:1px solid var(--border);border-radius:12px;max-height:70vh}#view-rpa .rpa-t{border-collapse:collapse;width:100%;font-size:13px}#view-rpa .rpa-t th{position:sticky;top:0;background:var(--gray-100,#f1f5f9);text-align:left;padding:7px 9px;white-space:nowrap;z-index:1}#view-rpa .rpa-t td{padding:5px 9px;border-top:1px solid var(--border);white-space:nowrap}#view-rpa .rpa-t .c{text-align:center}#view-rpa .rpa-t .n{text-align:right;font-variant-numeric:tabular-nums}
#view-rpa .rpa-sub th{top:31px;font-weight:500;font-size:11px;color:var(--gray-600)}#view-rpa .rpa-gh td{background:var(--gray-50,#f8fafc);font-weight:700;padding:8px 9px}#view-rpa .rpa-t tfoot td{position:sticky;bottom:0;z-index:1}#view-rpa .rpa-tot td{background:rgba(14,165,233,.08);font-weight:700}#view-rpa .rpa-prev{color:var(--gray-500);font-size:12px}
#view-rpa .rpa-ent input[type=number]{width:110px;text-align:right;font-size:14px;padding:5px 7px}#view-rpa .rpa-tg{font-size:10px;background:#e0f2fe;color:#075985;border-radius:6px;padding:1px 5px}
#view-rpa .rpa-pill{display:inline-block;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:700;background:#e5e7eb;color:#374151}#view-rpa .rpa-pill.g{background:#dcfce7;color:#166534}#view-rpa .rpa-pill.o{background:#fef3c7;color:#92400e}#view-rpa .rpa-pill.b{background:#dbeafe;color:#1e40af}
#view-rpa .rpa-foot{display:flex;gap:10px;align-items:center;margin-top:10px}#view-rpa .rpa-hint,#view-rpa .rpa-note{font-size:12px;color:var(--gray-600)}#view-rpa .rpa-warn{background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:9px 12px;margin:8px 0;font-size:13px}#view-rpa .rpa-none{padding:14px;opacity:.65;text-align:center}
#view-rpa .rpa-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin:6px 0 12px}#view-rpa .rpa-k{border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--card)}#view-rpa .rpa-k .t{font-size:11.5px;color:var(--gray-600)}#view-rpa .rpa-k .v{font-size:24px;font-weight:800;margin-top:2px}#view-rpa .rpa-k .s{font-size:11px;color:var(--gray-500)}#view-rpa .rpa-k.r{border-color:#fca5a5;background:rgba(239,68,68,.06)}#view-rpa .rpa-k.o{border-color:#fcd34d;background:rgba(245,158,11,.07)}#view-rpa .rpa-k.g{border-color:#86efac;background:rgba(34,197,94,.06)}
#view-rpa .rpa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:12px}#view-rpa .rpa-c{border:1px solid var(--border);border-radius:14px;padding:10px 14px;background:var(--card)}#view-rpa .rpa-c h4{margin:0 0 6px;font-size:14px}#view-rpa .rpa-svg{width:100%;height:auto}#view-rpa .rpa-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px}#view-rpa .rpa-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
#view-rpa .rpa-ul{margin:4px 0 0 18px;padding:0;font-size:13.5px;line-height:1.6}#view-rpa .rpa-b{font-weight:800}#view-rpa .rpa-bad{color:#b91c1c;font-weight:700}#view-rpa .rpa-go{cursor:pointer}#view-rpa .rpa-go:hover{background:var(--gray-100,#f1f5f9)}#view-rpa .rpa-S{color:#16a34a;font-weight:800}#view-rpa .rpa-D{color:#d97706;font-weight:800}#view-rpa .rpa-M{color:#dc2626;font-weight:800}
body.dark #view-rpa .rpa-t th{background:#2a2540}body.dark #view-rpa .rpa-gh td{background:#241f38}
#view-rpa .rpa-drop{border:2px dashed var(--border);border-radius:14px;padding:22px;text-align:center;margin-top:8px;cursor:pointer;position:relative}#view-rpa .rpa-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
#view-rpa .rpa-bar1{height:9px;border-radius:6px;background:var(--gray-100,#f1f5f9)}#view-rpa .rpa-bar1 i{display:block;height:100%;border-radius:6px;background:#f59e0b}#view-rpa .rpa-dim td{opacity:.55}#view-rpa .rpa-go{cursor:pointer}#view-rpa .rpa-go:hover{background:var(--gray-100,#f1f5f9)}
#view-rpa .rpa-bar input[type=search]{padding:6px 8px}#view-rpa .rpa-t td{white-space:normal}#view-rpa .rpa-t td.n{white-space:nowrap}`;
    document.head.appendChild(s);
  }
  async function addFiles(files) {
    const bad = []; for (const f of [...files]) { try { S.pend.push(await readFile(f)); } catch (e) { bad.push(f.name + ': ' + (e.message || e)); } }
    S.pend.sort((a, b) => a.date.localeCompare(b.date)); if (bad.length) say('✘ ' + bad.join(' · '), 1); else say(''); S.tab = 'up'; render();
  }
  function mount() {
    if (!Q('#rpaCard')) { const ex = Q('#view-rpa'), d = ex || document.createElement('div'); if (!ex) { d.className = 'view'; d.id = 'view-rpa'; }
      d.innerHTML = `<div class="card" id="rpaCard" data-nohc data-noct><div class="card-header"><div class="card-title">🧱 RM &amp; PM Analysis <span class="text-sm" style="font-weight:400;">— daily raw &amp; packing material stock · today vs previous · trend · abnormal changes</span></div><div class="btn-row"><button class="secondary small" type="button" data-rgo="refresh">🔄 Refresh</button><span id="rpaExp"><button class="secondary small" type="button" data-rgo="print">🖨 Print</button><button class="secondary small" type="button" data-rgo="excel">📊 Excel</button><button class="secondary small" type="button" data-rgo="mail">📧 Email</button></span></div></div><div id="rpaStatus" class="status-msg" style="font-size:12px;margin-bottom:6px"></div><div class="rpa-tabs" id="rpaTabs"></div><div id="rpaBody"></div></div>`;
      if (!ex) { const ref = Q('#view-g5') || Q('#view-att'); if (ref) ref.insertAdjacentElement('afterend', d); else document.body.appendChild(d); } }
    try { VIEW_META.rpa = { title: 'RM & PM Analysis', sub: 'Daily raw & packing material stock — comparison, trend and abnormal changes' }; } catch (e) { }
    try { const el = Q('.nav-item[data-view="rpa"]'); if (el && typeof navOrig !== 'undefined' && navOrig && !navMeta.rpa) { navMeta.rpa = { el, name: 'RM & PM Analysis' }; const g = navOrig.groups.find(x => x.items.includes('g5')) || navOrig.groups.find(x => x.items.includes('dailytracker')) || navOrig.groups.find(x => /^warehouse$/i.test(x.name)) || navOrig.groups[navOrig.groups.length - 1]; if (g && !g.items.includes('rpa')) g.items.push('rpa'); navApply(true); } } catch (e) { }
    const nav = Q('.nav-item[data-view="rpa"]'); if (nav && !nav._fe) { nav._fe = 1; nav.addEventListener('click', () => init()); }
  }
  function init() {
    const v = Q('#view-rpa'); if (!v) return; css();
    if (!v._i) { v._i = 1;
      v.addEventListener('click', e => { const t = e.target.closest('[data-rt],[data-rgo],[data-ritem],[data-rsave],[data-rrm],[data-rdel],[data-rmore]'); if (!t) return; const d = t.dataset;
        if (d.rt) { S.tab = d.rt; return render(); }
        if (d.ritem) { S.item = d.ritem; S.tab = 'trend'; return render(); }
        if (d.rmore !== undefined) { e.preventDefault(); S.lim += 300; return render(); }
        if (d.rsave !== undefined) return saveAll();
        if (d.rrm !== undefined) { S.pend.splice(+d.rrm, 1); return render(); }
        if (d.rdel) return delSnap(d.rdel);
        if (d.rgo === 'refresh') { S.loaded = false; S.ids = null; render(); return loadSnaps(true); }
        if (d.rgo === 'clrf') { S.af = { lvl: '', item: '', desc: '', cat: '' }; return render(); }
        if (d.rgo === 'mailfind') { const R = analyse(); if (!R) return; const m = findingsEmail(R, S.tab !== 'alr'); window.extMailData = () => m; return wMail_open('ext'); }
        if (d.rgo === 'mail' && S.tab === 'alr') { const R = analyse(); if (!R) return; const m = findingsEmail(R, false); window.extMailData = () => m; return wMail_open('ext'); }
        if (d.rgo === 'print' || d.rgo === 'excel' || d.rgo === 'mail') { const r = report(); if (d.rgo === 'print') return a2Print(r); if (d.rgo === 'excel') return a2Export(r); window.extMailData = () => r; wMail_open('ext'); } });
      v.addEventListener('change', e => { const t = e.target, d = t.dataset;
        if (t.id === 'rpaFile') { const fs = [...t.files]; t.value = ''; return addFiles(fs); }
        if (d.rpd !== undefined) { S.pend[+d.rpd].date = t.value || S.pend[+d.rpd].date; return render(); }
        if (d.ra !== undefined) { S.a = t.value; S.b = ''; return render(); } if (d.rb !== undefined) { S.b = t.value; return render(); }
        if (d.rbasis !== undefined) { S.basis = t.value; return render(); } if (d.rz !== undefined) { S.z = +t.value || 2; return render(); } if (d.rcov !== undefined) { S.cover = +t.value || 14; return render(); } if (d.rtol !== undefined) { S.tol = +t.value || 0; return render(); }
        if (d.raf) { S.af[d.raf] = t.value; return render(); } if (d.rf) { S.f[d.rf] = t.value; S.lim = 300; return render(); } if (d.ritemsel !== undefined) { S.item = t.value; return render(); } if (d.rcatsel !== undefined) { S.cat = t.value; return render(); } });
      v.addEventListener('input', e => { const t = e.target; if (t.dataset.raf !== undefined && t.tagName === 'INPUT') { const k = t.dataset.raf, pos = t.selectionStart; S.af[k] = t.value; render(); const n = Q('#view-rpa [data-raf="' + k + '"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } return; } if (t.dataset.rq !== undefined) { S.f.q = t.value; S.lim = 300; const pos = t.selectionStart; render(); const n = Q('#view-rpa [data-rq]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } } });
      v.addEventListener('dragover', e => { if (e.target.closest('[data-rdrop]')) e.preventDefault(); });
      v.addEventListener('drop', e => { if (e.target.closest('[data-rdrop]')) { e.preventDefault(); addFiles(e.dataTransfer.files); } });
    }
    if (!S.loaded && !S.loading) loadSnaps(false); else render();
  }

  /* ============================================================ PHONE ============================================================ */
  function mobile() {
    const K = window.MOBXK; if (!K) return; const { A, reg, need, put, patch, saved, fail, H, toast, drop } = K;
    const LD = { s: [LIST, ['Snap_Date', 'ge', addD(today(), -150) + 'T00:00:00Z']] };
    const feed = d => { const rows = (d.s || []).map(r => Object.assign({}, r)); S.snaps = mergeLocal(snapsFromRows(rows)); S.loaded = true; S.basis = S.basis || defBasis(); };
    const css0 = document.createElement('style'); css0.textContent = '.rpaup{border:2px dashed var(--line,#cbd5e1);border-radius:14px;padding:16px;text-align:center;display:block;font-weight:700}.rpaup input{display:none}.rpam{font-size:12px;color:var(--mut,#64748b)}.rpal{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0}'; document.head.appendChild(css0);
    document.addEventListener('change', async e => { const t = e.target; if (!t.dataset || t.dataset.rpafile === undefined || !Q('#mob')) return; const fs = [...t.files]; t.value = ''; const V = A().S.v; V._rpap = V._rpap || []; for (const f of [...fs]) { try { V._rpap.push(await readFile(f)); } catch (x) { toast('✘ ' + f.name + ': ' + (x.message || x), 'error'); } } A().render && A().render(); });
    const mobOps = () => ({ create: F => put(LIST, F, 'RM&PM ' + F.Snap_Date), update: (id, F) => patch(LIST, id, F, 'RM&PM ' + (F.Snap_Date || '')) });
    const lv = l => l === 2 ? 'r' : l === 1 ? 'o' : 'g';
    const pickCtl = (v, R) => `<div class="mb-row">${H.f('Today', H.sel('rpa_a', R.n ? S.snaps.slice().reverse().map(s => [s.date, dmy(s.date)]) : [], { ph: false }))}${H.f('Compare with', H.sel('rpa_b', S.snaps.filter(s => s.date < R.A.date).reverse().map(s => [s.date, dmy(s.date)]), { ph: false }))}</div>`;
    const sync = (v, R) => { if (v.rpa_a && v.rpa_a !== S.a) { S.a = v.rpa_a; S.b = ''; v.rpa_b = ''; } if (v.rpa_b && v.rpa_b !== S.b) S.b = v.rpa_b; };
    const detail = (r) => { const hh = itemHist(r.c); K.sheet(r.d, [['Item', r.c], ['Category', r.cat + ' (' + r.grp + ')'], ['Stock today', fq(r.cur) + ' ' + r.u], ['Previous', fq(r.prev)], ['Change', r.delta == null ? '' : sgn(r.delta)], ['Consumed', r.cons == null ? '' : fq(r.cons)], ['Average per day', r.avg == null ? '' : fq(r.avg)], ['Days of cover', r.cover == null ? '' : f1(r.cover)], ['Count variance', r.vr == null ? '' : sgn(r.vr)], ['Findings', r.al.filter(x => x.lvl > 0).map(x => x.t).join(' • ')], ['Last files', hh.slice(-8).map(x => dshort(x.date) + ': ' + fq(x.v)).join('  ·  ')]]); };
    reg('x_rpacmp', { lists: LD, load(v, f) { need('x_rpacmp', LD, f); },
      view(v, d) { feed(d); sync(v); let h = H.head('🧱', 'RM & PM — today vs previous', 'Stock change, consumption, cover', '#0d9488') + H.load(d); const R = analyse();
        if (!R) return h + H.card('', H.empty('No file uploaded yet — open “Upload file”.')); const K2 = R.kpi;
        h += H.card('', pickCtl(v, R)) + H.kpis([['Abnormal', K2.abn, K2.abn ? 'r' : 'g'], ['Watch', K2.watch, K2.watch ? 'o' : 'g'], ['Out of stock', K2.out, K2.out ? 'r' : ''], ['Low cover', R.hasCmp ? K2.low : '–', K2.low ? 'o' : ''], ['Stock down', R.hasCmp ? K2.down : '–'], ['Stock up', R.hasCmp ? K2.up : '–']]);
        if (!R.hasCmp) h += H.card('', '<div class="mb-hint">Only one file so far — comparison starts with the next upload.</div>');
        h += H.tabs('rpa_st', [['', 'All'], ['alerts', 'Findings'], ['down', 'Down'], ['up', 'Up'], ['out', 'Out'], ['low', 'Low cover']], '') + H.search('rpa_q', 'Code or description');
        S.f.st = v.rpa_st || ''; S.f.q = v.rpa_q || ''; S.f.cat = ''; const rows = cmpRows(R), lim = v.rpa_lim || 60;
        h += H.card('', rows.slice(0, lim).map(r => H.li({ x: 'rpaopen', i: r.c, ic: r.grp, c: r.lvl === 2 ? '#dc2626' : r.lvl === 1 ? '#d97706' : '#0d9488', t: r.d, s: r.c + ' · ' + r.cat, s2: (r.delta == null ? '' : 'Change ' + sgn(r.delta)) + (r.cons ? ' · used ' + fq(r.cons) : '') + (r.cover != null ? ' · cover ' + f1(r.cover) + ' d' : ''), v: fq(r.cur) + ' ' + esc(r.u), p: [lv(r.lvl), r.isNew ? 'New' : r.gone ? 'Missing' : LVN[r.lvl]] })).join('') || H.empty('No items.'))
          + (rows.length > lim ? H.bar(H.btn('Show more (' + (rows.length - lim) + ')', 'rpamore', 's')) : ''); return h; },
      act: { rpaopen(t, v, d) { const R = analyse(), r = R && R.rows.find(x => x.c === t.dataset.i); if (r) detail(r); }, rpamore(t, v) { v.rpa_lim = (v.rpa_lim || 60) + 60; A().render && A().render(); } } });
    reg('x_rpaalr', { lists: LD, load(v, f) { need('x_rpaalr', LD, f); },
      view(v, d) { feed(d); sync(v); let h = H.head('⚠', 'RM & PM — abnormal changes', 'Unusual consumption, stock, counts', '#dc2626') + H.load(d); const R = analyse();
        if (!R) return h + H.card('', H.empty('No file uploaded yet.')); const L = alertList(R);
        h += H.card('', pickCtl(v, R)) + H.kpis([['Abnormal', R.kpi.abn, R.kpi.abn ? 'r' : 'g'], ['Watch', R.kpi.watch, R.kpi.watch ? 'o' : 'g'], ['Count accuracy', R.kpi.acc == null ? '–' : f1(R.kpi.acc) + '%', R.kpi.acc != null && R.kpi.acc < 90 ? 'o' : 'g']]);
        return h + H.card('', L.slice(0, 120).map(({ r, x }) => H.li({ x: 'rpaopen', i: r.c, ic: x.lvl === 2 ? '⚠' : '👁', c: LVC[x.lvl], t: r.d, s: x.t, s2: r.c + ' · ' + r.cat, v: fq(r.cur) + ' ' + esc(r.u), p: [lv(x.lvl), LVN[x.lvl]] })).join('') || H.empty('✔ Nothing abnormal.')); },
      act: { rpaopen(t, v, d) { const R = analyse(), r = R && R.rows.find(x => x.c === t.dataset.i); if (r) detail(r); } } });
    reg('x_rpaup', { lists: LD, load(v, f) { need('x_rpaup', LD, f); },
      view(v, d) { feed(d); const P = v._rpap || []; let h = H.head('📥', 'RM & PM — upload file', 'The daily Excel file', '#2563eb') + H.load(d);
        h += H.card('Choose the file', `<label class="rpaup"><input type="file" data-rpafile accept=".xlsx,.xls,.xlsm,.csv" multiple>📂 Tap to choose the Excel file<div class="rpam">JDE report + count sheet · the date comes from the file name</div></label>`);
        if (P.length) h += H.card('Ready to save', P.map((p, i) => `<div class="mb-li"><div class="d"><b>${esc(p.name)}</b><small>${p.items.length} items · ${p.info.map(x => esc(x.sheet) + ' ' + x.type).join(', ')}</small></div></div><div class="mb-row">${H.f('File date', `<input type="date" data-rpad="${i}" value="${p.date}">`)}</div>`).join('') + `<div class="mb-row">${H.btn('💾 Save', 'rpasave', 'p')}${H.btn('✕ Clear', 'rpaclr', 's')}</div>`);
        return h + H.card('History', S.snaps.slice().reverse().slice(0, 40).map(s => H.li({ ic: '📄', c: '#2563eb', t: dmy(s.date), s: s.file + ' · ' + s.items.length + ' items', p: [s.src === 'sp' ? 'g' : 'o', s.src === 'sp' ? 'Saved' : 'This phone'] })).join('') || H.empty('No file yet.')); },
      act: {
        rpaclr(t, v) { v._rpap = []; A().render && A().render(); },
        async rpasave(t, v, d) { const P = v._rpap || []; if (!P.length) return; let n = 0; const errs = [];
          for (const p of P) { try { await saveSnap({ date: p.date, file: p.name, items: p.items }, mobOps()); n++; } catch (e) { saveLocal({ date: p.date, file: p.name, items: p.items }) ; errs.push(dmy(p.date)); } }
          v._rpap = []; drop(LIST); saved({ queued: false }, 'RM & PM file(s): ' + n + ' saved' + (errs.length ? ', ' + errs.length + ' kept on this phone' : '')); try { const d2 = await need('x_rpaup', LD, true); feed(d2); } catch (e) { } A().render && A().render(); } } });
    document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.rpad !== undefined && Q('#mob')) { const V = A().S.v, p = (V._rpap || [])[+t.dataset.rpad]; if (p && t.value) p.date = t.value; } });
    try { const M = A(); if (M.GROUPS && !M.GROUPS.some(g => g[0] === 'RM & PM')) { M.GROUPS.splice(M.GROUPS.length - 1, 0, ['RM & PM', '🧱', '#2dd4bf', '#0f766e', [['x_rpacmp', '⚖', 'Today vs previous', 'Stock change · consumption · cover', '#2dd4bf', '#0f766e'], ['x_rpaalr', '⚠', 'Abnormal changes', 'Unusual consumption, stock and counts', '#f87171', '#b91c1c'], ['x_rpaup', '📥', 'Upload file', 'The daily RM & PM Excel file', '#60a5fa', '#1d4ed8']]]);
        if (M.ALL) { M.ALL.length = 0; M.GROUPS.forEach((g, gi) => g[4].forEach(it => M.ALL.push({ k: it[0], ic: it[1], t: it[2], sub: it[3], a: it[4], b: it[5], g: gi }))); } } } catch (e) { console.error(e); }
  }

  function boot() { mount(); mobile(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.RPA = { S, findingsEmail, readFile, addFiles, parseWB, dateFromName, analyse, itemHist, snapsFromRows, mkSnap, saveSnap, catOf, report, render, load: loadSnaps };
})();
