/* ============================================================
   MANAGEMENT DAILY REPORT (SharePoint) — 1) one set of settings for everybody  2) WHs utilization KPI card
   1) Lists, column mapping and measures (e.g. how the productivity target is taken) used to live in each browser, so the
      same user could see 183 % on the PC and 85 % on the phone. "☁ Publish settings for everyone" saves them in
      App_Config_tbl (row "MgmtReport:mgw"); every device reads that row before loading the report.
   2) The daily utilization file (WH_utilization_Daily-<date>.xlsx: blocks "Category" → LOC / capacity / utilization /
      in-transit / un-utilized) is uploaded from the report; each day is kept in App_Config_tbl (row "WHU:<yyyy-mm-dd>").
      Every LOC is linked once to a WHs Desc of the daily data (row "WHU:map"), so the Area / Regions / WHs Desc filters
      also filter the utilization card. The area summary block at the end of the file (no "Category") is skipped.
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[,%\s]/g, '')); return isFinite(n) ? n : 0; };
  const nz = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymdU = d => { const x = new Date(d.getTime() + 12 * 3600e3); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); };
  const dmy = s => { const m = String(s || '').match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? m[3] + '-' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + '-' + m[1] : s; };
  const fmt = (v, d) => typeof plF === 'function' ? plF(v, d) : Number(v).toLocaleString(undefined, { maximumFractionDigits: d || 0 });
  const title = x => String(((x || {}).fields || {}).Title || '').trim();
  const me = () => (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || '';
  const can = () => typeof mwSetupOk === 'function' && mwSetupOk();
  const CEN = 'MgmtReport:mgw', UMAP = 'WHU:map';
  const U = { days: new Map(), map: {}, read: false, err: '' };
  let pulled = 0;

  async function cfgRows() { const c = await tpCtx(); if (!c) throw new Error('sign in first (no Microsoft session)'); const its = await fetchAllItems(c.siteId, c.listId, c.token); return { c, its }; }
  async function upsert(t, val) { const { c, its } = await cfgRows(), ex = its.find(x => title(x) === t);
    if (ex) return updateItem(c.siteId, c.listId, ex.id, spCoerceFields(c.listId, { Config_Value: val }), c.token); return createItem(c.siteId, c.listId, { Title: t, Config_Value: val }, c.token); }
  function readUtil(its) { U.days = new Map(); U.map = {};
    its.forEach(x => { const t = title(x); if (!/^WHU:/.test(t)) return; let v = null; try { v = JSON.parse(String(x.fields.Config_Value || '')); } catch (e) {} if (!v) return;
      if (t === UMAP) { U.map = v.map || {}; if (v.list) U.list = v.list; } else if (/^WHU:\d{4}-\d\d-\d\d$/.test(t) && Array.isArray(v.rows)) U.days.set(t.slice(4), v); });   /* older uploads kept in App_Config_tbl */
    U.read = true; }

  /* ---------- the utilization list in SharePoint: one row per LOC per day ---------- */
  const ULIST0 = 'WHs_Utilization_Daily_tbl';
  const UCOLS = [['Util_Date', { dateTime: { format: 'dateOnly' } }], ['Category', { text: {} }], ['LOC', { text: {} }], ['WHs_Desc', { text: {} }], ['Capacity_Pallets', { number: {} }], ['Used_Pallets', { number: {} }], ['Utilization_Pct', { number: {} }], ['InTransit_Pallets', { number: {} }], ['Free_Pallets', { number: {} }], ['Uploaded_By', { text: {} }], ['Source_File', { text: {} }]];
  const uName = () => U.list || ULIST0;
  let UL = null;
  async function uL(create) { if (UL && UL.name === uName()) return UL; const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first (no Microsoft session)');
    let ids; try { ids = await resolveIds(site, uName(), token); }
    catch (e) { if (!/not found/i.test(e.message) || !create) throw e;
      const c = await tpCtx(), r = await fetch(`https://graph.microsoft.com/v1.0/sites/${c.siteId}/lists`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: uName(), columns: UCOLS.map(([name, t]) => Object.assign({ name }, t)), list: { template: 'genericList' } }) });
      if (!r.ok) { let t = ''; try { t = await r.text(); } catch (x) {} throw new Error('the list "' + uName() + '" does not exist and could not be created (HTTP ' + r.status + (r.status === 403 ? ' — no permission to create lists' : '') + ')' + (t && r.status !== 403 ? ': ' + t.slice(0, 160) : '')); }
      await new Promise(res => setTimeout(res, 1500)); ids = await resolveIds(site, uName(), token); toast('📋 SharePoint list ' + uName() + ' created'); }
    const cols = await fetchColumns(ids.siteId, ids.listId, token), m = new Map(); cols.forEach(c => { m.set(nz(c.name), c.name); if (!m.has(nz(c.displayName))) m.set(nz(c.displayName), c.name); });
    UL = Object.assign({ name: uName(), token, m }, ids); return UL; }
  const ucol = k => UL && UL.m.get(nz(k));
  const ufields = o => { const f = {}; Object.entries(o).forEach(([k, v]) => { const n = k === 'Title' ? 'Title' : ucol(k); if (n && v !== undefined) f[n] = v; }); return f; };
  async function readList() { let L; try { L = await uL(false); } catch (e) { U.noList = /not found/i.test(e.message); if (!U.noList) U.err = e.message; return; } U.noList = false;
    const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10), dc = ucol('Util_Date'); let its;
    try { its = await exp_fetchFilteredItems(L.siteId, L.listId, L.token, `fields/${dc} ge '${since}T00:00:00Z'`); } catch (e) { its = await fetchAllItems(L.siteId, L.listId, L.token); }
    const g = (f, k) => { const n = ucol(k); return n ? f[n] : undefined; }, days = new Map();
    its.forEach(it => { const f = it.fields || {}, dv = g(f, 'Util_Date'); if (!dv) return; const d = ymdU(new Date(dv)), loc = String(g(f, 'LOC') || f.Title || '').trim(); if (!loc) return;
      const o = days.get(d) || { date: d, rows: [], src: 'list' }; o.rows.push({ id: it.id, cat: String(g(f, 'Category') || ''), loc, wh: String(g(f, 'WHs_Desc') || ''), cap: num(g(f, 'Capacity_Pallets')), used: num(g(f, 'Used_Pallets')), tr: num(g(f, 'InTransit_Pallets')), free: num(g(f, 'Free_Pallets')) }); days.set(d, o); });
    days.forEach((v, d) => U.days.set(d, v)); U.listRows = its.length; }
  async function saveDay(date, rows, file, map) { const L = await uL(true), ex = new Map(((U.days.get(date) || {}).src === 'list' ? U.days.get(date).rows : []).map(x => [x.loc, x]));
    try { if (window.orbProg && orbProg.expect) orbProg.expect(rows.length, 'WHs utilization ' + dmy(date) + ' → ' + L.name); } catch (e) {}
    let n = 0; for (const x of rows) { const f = ufields({ Title: x.loc, Util_Date: date + 'T12:00:00Z', Category: x.cat, LOC: x.loc, WHs_Desc: map[x.loc] || '', Capacity_Pallets: x.cap, Used_Pallets: x.used, Utilization_Pct: x.cap ? Math.round(x.used / x.cap * 10000) / 100 : 0, InTransit_Pallets: x.tr, Free_Pallets: x.free, Uploaded_By: me(), Source_File: file || '' }), e = ex.get(x.loc);
      if (e && e.id) await updateItem(L.siteId, L.listId, e.id, spCoerceFields(L.listId, f), L.token); else await createItem(L.siteId, L.listId, f, L.token); n++; }
    return n; }
  async function saveLinks(date, map) { const day = U.days.get(date); if (!day || day.src !== 'list') return 0; const L = await uL(false), ch = day.rows.filter(x => x.id && (map[x.loc] || '') !== (x.wh || '')); if (!ch.length) return 0;
    try { if (window.orbProg && orbProg.expect) orbProg.expect(ch.length, 'WHs links ' + dmy(date)); } catch (e) {}
    for (const x of ch) { await updateItem(L.siteId, L.listId, x.id, spCoerceFields(L.listId, ufields({ WHs_Desc: map[x.loc] || '' })), L.token); x.wh = map[x.loc] || ''; } return ch.length; }

  /* ---------- 1) shared settings ---------- */
  function applyShared(v) {
    if (v.list) { Object.assign(mw.cfg.list, v.list); mw.cfg.list.util = ''; }
    ['daily', 'whs', 'trgt'].forEach(w => { if (v.map && v.map[w]) mw.cfg.map[w] = Object.assign({}, v.map[w]); });
    if (v.opt) Object.assign(mw.cfg.opt, v.opt);
    ['daily', 'whs', 'trgt'].forEach(w => { try { if (mw.pick[w] && mw.pick[w].setValue) mw.pick[w].setValue(mw.cfg.list[w] || ''); } catch (e) {} try { mwMapRender(w); } catch (e) {} });
    mw.shared = { by: v.by || '', at: v.at || '' }; try { mwSaveCfg(); } catch (e) {}
  }
  async function pull(force) { if (pulled && !force && Date.now() - pulled < 5 * 60 * 1000) return; pulled = Date.now();
    try { const { its } = await cfgRows(), it = its.find(x => title(x) === CEN); if (it) { try { applyShared(JSON.parse(String(it.fields.Config_Value || '{}'))); } catch (e) {} } readUtil(its); U.err = ''; await readList(); }
    catch (e) { U.err = e.message; } }
  if (typeof mwLoad === 'function') { const _load = mwLoad; mwLoad = async function () { await pull(false); return _load.apply(this, arguments); }; }
  async function publish() { const st = Q('#mwLoadStatus'), say = (t, bad) => { if (st) { st.textContent = t; st.style.color = bad ? '#c0392b' : ''; } };
    if (!can()) return say('Only the report administrator can publish the settings.', 1);
    const v = { list: { daily: mw.cfg.list.daily, whs: mw.cfg.list.whs, trgt: mw.cfg.list.trgt }, map: { daily: mw.cfg.map.daily, whs: mw.cfg.map.whs, trgt: mw.cfg.map.trgt }, opt: mw.cfg.opt, by: me(), at: new Date().toISOString() };
    try { say('Publishing…'); await upsert(CEN, JSON.stringify(v)); mw.shared = { by: v.by, at: v.at }; say('✔ Published — every user and device now uses these lists, columns and measures (App_Config_tbl · ' + CEN + ').'); toast('☁ Report settings published for everyone'); }
    catch (e) { if (!/Cancelled/.test(e.message)) say('⚠ Not published: ' + e.message, 1); } }
  function pubBtn() { const cp = Q('#mwCopyDef'); if (!cp || Q('#mwPub')) return; const b = document.createElement('button'); b.id = 'mwPub'; b.type = 'button'; b.className = 'small'; b.textContent = '☁ Publish settings for everyone'; b.title = 'Save these lists, column mapping and measures in SharePoint (App_Config_tbl) — every user and device (PC and phone) then calculates the report the same way'; b.addEventListener('click', publish); cp.after(b); }
  const toast = (t, k) => { try { sectionToast(t, k || 'success'); } catch (e) {} };

  /* ---------- 2) utilization file ---------- */
  function parseFile(ab) { const wb = XLSX.read(ab, { type: 'array', cellDates: true }), out = []; let date = '';
    wb.SheetNames.forEach(sn => { const A = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null }); let cat = '', inB = false, H = null;
      A.forEach(r => { r = r || []; const cs = r.map(v => v == null ? '' : v instanceof Date ? '' : String(v).trim());
        if (cs.some(x => /^category$/i.test(x))) { const d = r.find(v => v instanceof Date); if (d) date = ymdU(d); else { const n = r.find(v => typeof v === 'number' && v > 40000 && v < 60000); if (n) date = ymdU(new Date(Math.round((n - 25569) * 864e5))); } inB = true; H = null; cat = ''; return; }
        const li = cs.findIndex(x => /^loc(ation)?$/i.test(x)); if (li >= 0 && inB) { const f = re => cs.findIndex(x => re.test(x.toLowerCase())); H = { loc: li, cap: f(/capacity/), used: f(/utili[sz]ation.*pallet/), tr: f(/transit.*pallet|^in-?transit/), free: f(/un-?utili[sz]ed.*pallet/) }; return; }
        if (!H) return; const loc = cs[H.loc]; if (!loc) { if (cs.every(x => !x)) { inB = false; H = null; } return; } if (/^total$/i.test(loc)) { inB = false; H = null; return; }
        if (H.loc > 0 && cs[H.loc - 1]) cat = cs[H.loc - 1];
        const cap = num(r[H.cap]), used = num(r[H.used]); out.push({ cat, loc, cap, used, tr: H.tr >= 0 ? num(r[H.tr]) : 0, free: H.free >= 0 ? num(r[H.free]) : Math.max(0, cap - used) }); }); });
    return { date, rows: out }; }
  /* LOC → WHs Desc: a first guess from shared words (ALN = Al Ain, AUH = Abu Dhabi, DXB = Dubai …); the admin confirms it once */
  const SYN = { aln: ['alain', 'ain', 'aln'], auh: ['abudhabi', 'auh', 'abu'], dxb: ['dubai', 'dxb'], shj: ['sharjah', 'shj'], rak: ['rak', 'rasalkhaimah', 'khaimah'], fuj: ['fujairah', 'fuj'], trf: ['tarif', 'trf'], kizad: ['kizad', 'kzd'], '5g': ['5g', '5gallon', 'gallon'], pet: ['pet'], uht: ['uht'], milco: ['milco'], maqta: ['maqta', 'maq'], arla: ['arla'], musaffah: ['musaffah', 'mussafah'], cx3: ['cx3'], cx4: ['cx4'], mw: ['mw'] };
  const toks = s => String(s || '').toLowerCase().replace(/al\s+ain/g, 'alain').replace(/abu\s+dhabi/g, 'abudhabi').replace(/ras\s+al\s+khaimah/g, 'rasalkhaimah').split(/[^a-z0-9]+/).filter(Boolean);
  function guess(loc, cat, whs) { const lt = toks(loc + ' ' + (cat || '')).flatMap(t => SYN[t] || [t]); let best = '', bs = 0, tie = false;
    whs.forEach(w => { const wt = toks(w); let s = 0; lt.forEach(t => { if (wt.some(x => x === t || (t.length > 3 && x.startsWith(t)))) s++; }); if (s > bs) { bs = s; best = w; tie = false; } else if (s && s === bs) tie = true; });
    return bs >= 1 && !tie ? best : ''; }
  const whList = () => [...new Set((mw.rows || []).map(r => r.wh).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  /* ---------- the KPI card ---------- */
  /* the selected warehouses (Area / Regions / WHs Desc filters) applied to one uploaded day */
  function daySel(d) { const day = U.days.get(d), f = mw.f || {}, filt = (f.area && f.area.length) || (f.region && f.region.length) || (f.wh && f.wh.length), whs = filt ? new Set(mwView().map(r => r.wh)) : null;
    const rows = day.rows.filter(x => !whs || whs.has(U.map[x.loc] || x.wh)), s = rows.reduce((a, x) => (a.cap += x.cap, a.used += x.used, a.tr += x.tr, a.free += x.free, a), { cap: 0, used: 0, tr: 0, free: 0 });
    return Object.assign(s, { date: d, rows, n: rows.length, all: day.rows.length, filt, pct: s.cap ? s.used / s.cap * 100 : null }); }
  /* last date = the latest upload inside From–To · average = every upload day inside From–To (each day's % averaged) */
  function pick() { const f = mw.f || {}, from = f.from || '0000-00-00', to = f.to || '9999-12-31', ds = [...U.days.keys()].sort().filter(x => x >= from && x <= to);
    if (!ds.length) return { none: U.days.size ? 'no upload between ' + dmy(f.from || '…') + ' and ' + dmy(f.to || '…') : 'no file uploaded yet' };
    const L = ds.map(daySel).filter(x => x.cap > 0), last = daySel(ds[ds.length - 1]), avg = k => L.length ? L.reduce((a, x) => a + x[k], 0) / L.length : 0;
    return Object.assign(last, { avg: { days: L.length, pct: L.length ? avg('pct') : null, used: avg('used'), cap: avg('cap'), free: avg('free'), tr: avg('tr'), from: ds[0], to: ds[ds.length - 1] } }); }
  function card() { if (!U.read && !can()) return ''; const p = pick(), T = typeof plT === 'function' ? plT() : { good: '#16a34a', warn: '#d97706', crit: '#dc2626' }, col = v => v == null ? '#94a3b8' : v > 100 ? T.crit : v >= 90 ? T.warn : T.good;
    const K = (lbl, val, sub, c) => `<div class="pl-kpi" data-whu="1" style="cursor:pointer;border-left:4px solid ${c}" title="Click for the utilization by warehouse${can() ? ' / upload' : ''}"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
    if (p.none) return can() || U.days.size ? K('WHs utilization', '—', esc(p.none) + (can() ? ' · <b>⬆ upload</b>' : ''), '#94a3b8') : '';
    const a = p.avg, whsTxt = p.filt ? p.n + ' of ' + p.all + ' WHs (filtered)' : p.n + ' WHs';
    return K('WHs utilization · average', a.pct == null ? '—' : fmt(a.pct, 0) + '%', `avg ${fmt(a.used)} / ${fmt(a.cap)} pallets · ${fmt(a.free)} free<br>${a.days} day(s) · ${dmy(a.from)}${a.from !== a.to ? ' – ' + dmy(a.to) : ''} · ${whsTxt}`, col(a.pct))
      + K('WHs utilization · last date', p.pct == null ? '—' : fmt(p.pct, 0) + '%', `${fmt(p.used)} / ${fmt(p.cap)} pallets · ${fmt(p.free)} free${p.tr ? ' · ' + fmt(p.tr) + ' in transit' : ''}<br>${dmy(p.date)} · ${whsTxt}`, col(p.pct)); }
  if (typeof mwKpis === 'function') { const _k = mwKpis; mwKpis = function () { const r = _k.apply(this, arguments); try { const h = Q('#mwKpis'), html = card(); if (h && html) { const last = h.lastElementChild; if (last) last.insertAdjacentHTML('beforebegin', html); else h.insertAdjacentHTML('beforeend', html); } } catch (e) { console.error(e); } return r; }; }

  /* ---------- details / upload dialog ---------- */
  function box(up) { const old = Q('#whuBox'); if (old) old.remove(); const all = [...U.days.keys()].sort(), cur = pick(); let date = up ? up.date : (cur.date || all[all.length - 1] || ''), rows = up ? up.rows : ((U.days.get(date) || {}).rows || []), map = Object.assign({}, U.map), dirty = false;
    all.forEach(dd => (U.days.get(dd).rows || []).forEach(x => { if (x.wh && !map[x.loc]) map[x.loc] = x.wh; }));
    const W = whList(); if (up) rows.forEach(x => { if (!map[x.loc]) { const g = guess(x.loc, x.cat, W); if (g) { map[x.loc] = g; dirty = true; } } });
    const d = document.createElement('div'); d.id = 'whuBox'; d.dataset.nohc = '1'; d.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:12px';
    const draw = () => { const tot = rows.reduce((a, x) => (a.cap += x.cap, a.used += x.used, a.tr += x.tr, a.free += x.free, a), { cap: 0, used: 0, tr: 0, free: 0 }), ed = can();
      d.innerHTML = `<div style="background:var(--card-bg,#fff);color:var(--text,#0f172a);border-radius:16px;width:min(980px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 30px 60px -20px rgba(15,23,42,.5)">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border,#e2e8f0)"><b style="font-size:16px;flex:1;min-width:200px">🏭 WHs utilization ${up ? '— new upload' : ''}</b>
          ${up ? `<label class="text-sm">Date <input type="date" id="whuDate" value="${esc(date)}" style="width:auto;margin:0"></label>` : all.length ? `<select id="whuDay" style="width:auto;margin:0">${all.slice().reverse().map(x => `<option value="${x}" ${x === date ? 'selected' : ''}>${dmy(x)}</option>`).join('')}</select>` : ''}
          ${ed ? `<button type="button" class="secondary small" data-u="file">⬆ Upload file</button><input type="file" id="whuFile" accept=".xlsx,.xls,.xlsm" style="display:none">` : ''}<button type="button" class="ghost small" data-u="xl">⬇ Excel</button><button type="button" class="ghost small" data-u="x">✕</button></div>
        <div style="padding:8px 16px;font-size:12.5px;color:var(--gray-600,#64748b)">${rows.length ? `<b>${fmt(tot.cap ? tot.used / tot.cap * 100 : 0, 1)}%</b> utilized · ${fmt(tot.used)} of ${fmt(tot.cap)} pallets · ${fmt(tot.free)} free · ${fmt(tot.tr)} in transit · ${rows.length} locations` : 'No data for this date.'}${ed ? ' — link each LOC to its <b>WHs Desc</b> once; the report filters use these links.' : ''}<br>📋 SharePoint list <b>${esc(uName())}</b>${U.noList ? ' (not created yet — it is created with the first upload)' : U.listRows != null ? ' · ' + fmt(U.listRows) + ' rows' : ''}${(U.days.get(date) || {}).src === 'list' || !rows.length || up ? '' : ' · ⚠ this date is still in App_Config_tbl — upload the file again to move it to the list'}</div>
        <div style="overflow:auto;padding:0 16px 8px"><table class="data-table" style="width:100%;font-size:12.5px"><thead><tr><th>Category</th><th>LOC</th><th>WHs Desc (link)</th><th style="text-align:right">Capacity</th><th style="text-align:right">Used</th><th style="text-align:right">Util %</th><th style="text-align:right">In transit</th><th style="text-align:right">Free</th></tr></thead><tbody>
          ${rows.map((x, i) => { const p = x.cap ? x.used / x.cap * 100 : 0; return `<tr><td>${esc(x.cat)}</td><td><b>${esc(x.loc)}</b></td><td>${ed ? `<select data-m="${i}" style="margin:0;min-width:170px;${map[x.loc] ? '' : 'border-color:#f59e0b'}"><option value="">— not linked —</option>${W.map(w => `<option ${map[x.loc] === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}${map[x.loc] && !W.includes(map[x.loc]) ? `<option selected>${esc(map[x.loc])}</option>` : ''}</select>` : esc(map[x.loc] || '—')}</td><td style="text-align:right">${fmt(x.cap)}</td><td style="text-align:right">${fmt(x.used)}</td><td style="text-align:right;font-weight:700;color:${p > 100 ? '#dc2626' : p >= 90 ? '#d97706' : 'inherit'}">${fmt(p, 1)}%</td><td style="text-align:right">${fmt(x.tr)}</td><td style="text-align:right">${fmt(x.free)}</td></tr>`; }).join('')}
        </tbody></table></div>
        <div style="display:flex;gap:10px;align-items:center;padding:12px 16px;border-top:1px solid var(--border,#e2e8f0);flex-wrap:wrap"><span id="whuMsg" class="text-sm" style="flex:1">${up ? (U.days.has(date) ? '⚠ ' + dmy(date) + ' was already uploaded — saving replaces it. ' : '') + esc(up.file || '') + ' · ' + rows.length + ' locations read' + (rows.filter(x => !map[x.loc]).length ? ' · ' + rows.filter(x => !map[x.loc]).length + ' not linked yet (orange)' : '') : ''}</span>
          ${ed && (up || dirty) ? `<button type="button" data-u="save">💾 ${up ? 'Save upload' + (dirty ? ' + links' : '') : 'Save links'}</button>` : ''}</div></div>`; };
    draw(); document.body.appendChild(d);
    const msg = (t, bad) => { const m = Q('#whuMsg'); if (m) { m.textContent = t; m.style.color = bad ? '#c0392b' : ''; } };
    d.addEventListener('change', async e => { const t = e.target;
      if (t.id === 'whuDay') { date = t.value; rows = (U.days.get(date) || {}).rows || []; return draw(); }
      if (t.id === 'whuDate') { date = t.value; return draw(); }
      if (t.dataset.m != null) { const x = rows[+t.dataset.m]; if (t.value) map[x.loc] = t.value; else delete map[x.loc]; dirty = true; return draw(); }
      if (t.id === 'whuFile') { const f = t.files && t.files[0]; if (!f) return; try { const p = parseFile(await f.arrayBuffer()); if (!p.rows.length) return msg('⚠ No LOC rows found — is this the WH utilization file (blocks "Category" → LOC, capacity, utilization …)?', 1); d.remove(); box({ date: p.date || new Date().toISOString().slice(0, 10), rows: p.rows, file: f.name }); } catch (x) { msg('⚠ The file could not be read: ' + x.message, 1); } } });
    d.addEventListener('click', async e => { if (e.target === d) return d.remove(); const b = e.target.closest('button[data-u]'); if (!b) return; const a = b.dataset.u;
      if (a === 'x') return d.remove(); if (a === 'file') return Q('#whuFile').click();
      if (a === 'xl') { if (!rows.length) return; const ws = XLSX.utils.aoa_to_sheet([['Date', 'Category', 'LOC', 'WHs Desc', 'Capacity', 'Used', 'Util %', 'In transit', 'Free'], ...rows.map(x => [date, x.cat, x.loc, map[x.loc] || '', x.cap, x.used, x.cap ? Math.round(x.used / x.cap * 1000) / 10 : 0, x.tr, x.free])]), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'WHs utilization'); XLSX.writeFile(wb, 'WHs_Utilization_' + date + '.xlsx'); return; }
      if (a === 'save') { if (up && !/^\d{4}-\d\d-\d\d$/.test(date)) return msg('⚠ Set the date of this file.', 1);
        try { b.disabled = true; msg('Saving…');
          let where = uName();
          if (dirty || up) { await upsert(UMAP, JSON.stringify({ map, list: uName(), by: me(), at: new Date().toISOString() })); U.map = map; }
          if (up) { try { await saveDay(date, rows, up.file, map); } catch (x) { if (/Cancelled/.test(x.message)) throw x; where = 'App_Config_tbl (⚠ ' + x.message + ')'; await upsert('WHU:' + date, JSON.stringify({ date, rows, file: up.file || '', by: me(), at: new Date().toISOString() })); } U.days.delete(date); pulled = 0; await pull(true); if (!U.days.has(date)) U.days.set(date, { date, rows }); }
          else if (dirty) { try { await saveLinks(date, map); } catch (x) { if (/Cancelled/.test(x.message)) throw x; } }
          dirty = false; rows = (U.days.get(date) || {}).rows || rows;
          up = null; draw(); msg('✔ Saved in SharePoint · ' + where + ' — the utilization cards now include ' + dmy(date) + '.'); try { mwRenderReport(); } catch (x) {} toast('🏭 WHs utilization ' + dmy(date) + ' saved'); }
        catch (x) { b.disabled = false; msg(/Cancelled/.test(x.message) ? 'Not saved.' : '⚠ Not saved: ' + x.message, !/Cancelled/.test(x.message)); } } }); }
  document.addEventListener('click', e => { const k = e.target.closest && e.target.closest('#mwKpis [data-whu]'); if (!k) return; const go = () => box(null); if (!U.read) pull(true).then(go); else go(); });

  /* mount the publish button when the report opens */
  setInterval(() => { if (Q('#view-mgw')) pubBtn(); }, 1500);
  window.mwShared = { pull, publish, U, parseFile, guess, box };
})();
