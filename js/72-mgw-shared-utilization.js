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

  /* ---------- upload dialog: preview the file, then save it (links are kept in Upload Destinations & Sources) ---------- */
  function box(up) { const old = Q('#mwuBox'); if (old) old.remove(); let date = up.date, rows = up.rows;
    const d = document.createElement('div'); d.id = 'mwuBox'; d.dataset.nohc = '1'; d.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:12px';
    const draw = () => { const tot = rows.reduce((a, x) => (a.cap += x.cap, a.used += x.used, a.tr += x.tr, a.free += x.free, a), { cap: 0, used: 0, tr: 0, free: 0 }), unl = rows.filter(x => !U.map[x.loc]).length;
      d.innerHTML = `<div style="background:var(--card-bg,#fff);color:var(--text,#0f172a);border-radius:16px;width:min(820px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 30px 60px -20px rgba(15,23,42,.5)">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border,#e2e8f0)"><b style="font-size:16px;flex:1;min-width:200px">⬆ Upload WHs utilization</b><label class="text-sm">Date <input type="date" id="mwuDate" value="${esc(date)}" style="width:auto;margin:0"></label><button type="button" class="ghost small" data-u="x">✕</button></div>
        <div style="padding:8px 16px;font-size:12.5px;color:var(--gray-600,#64748b)">${esc(up.file || '')} · ${rows.length} locations · <b>${fmt(tot.cap ? tot.used / tot.cap * 100 : 0, 1)}%</b> utilized · ${fmt(tot.used)} of ${fmt(tot.cap)} pallets · ${fmt(tot.free)} free · ${fmt(tot.tr)} in transit<br>📋 Saved to the SharePoint list <b>${esc(uName())}</b>${U.days.has(date) ? ' · ⚠ ' + dmy(date) + ' was already uploaded — saving replaces it' : ''}${unl ? `<br>🔗 <b style="color:#b45309">${unl} location(s) not linked to a WHs Desc yet</b> — link them in <b>Upload Destinations &amp; Sources → WHs utilization links</b> (until then they count only when no Area / Region / WHs filter is set).` : ''}</div>
        <div style="overflow:auto;padding:0 16px 8px"><table class="fd-tbl" style="width:100%"><thead><tr><th>Category</th><th>LOC</th><th>WHs Desc</th><th class="n">Capacity</th><th class="n">Used</th><th class="n">Util %</th><th class="n">In transit</th><th class="n">Free</th></tr></thead><tbody>
          ${rows.map(x => { const p = x.cap ? x.used / x.cap * 100 : 0; return `<tr><td>${esc(x.cat)}</td><td><b>${esc(x.loc)}</b></td><td>${U.map[x.loc] ? esc(U.map[x.loc]) : '<span style="color:#b45309">not linked</span>'}</td><td class="n">${fmt(x.cap)}</td><td class="n">${fmt(x.used)}</td><td class="n" style="font-weight:700;color:${p > 100 ? '#dc2626' : p >= 90 ? '#d97706' : 'inherit'}">${fmt(p, 1)}%</td><td class="n">${fmt(x.tr)}</td><td class="n">${fmt(x.free)}</td></tr>`; }).join('')}
        </tbody></table></div>
        <div style="display:flex;gap:10px;align-items:center;padding:12px 16px;border-top:1px solid var(--border,#e2e8f0);flex-wrap:wrap"><span id="mwuMsg" class="text-sm" style="flex:1"></span><button type="button" class="ghost" data-u="x">Cancel</button><button type="button" data-u="save">💾 Save to SharePoint</button></div></div>`; };
    draw(); document.body.appendChild(d);
    const msg = (t, bad) => { const m = Q('#mwuMsg'); if (m) { m.textContent = t; m.style.color = bad ? '#c0392b' : ''; } };
    d.addEventListener('change', e => { if (e.target.id === 'mwuDate') { date = e.target.value; draw(); } });
    d.addEventListener('click', async e => { if (e.target === d) return d.remove(); const b = e.target.closest('button[data-u]'); if (!b) return; const a = b.dataset.u; if (a === 'x') return d.remove();
      if (a === 'save') { if (!/^\d{4}-\d\d-\d\d$/.test(date)) return msg('⚠ Set the date of this file.', 1);
        try { b.disabled = true; msg('Saving…'); let where = uName();
          try { await saveDay(date, rows, up.file, U.map); } catch (x) { if (/Cancelled/.test(x.message)) throw x; where = 'App_Config_tbl (⚠ ' + x.message + ')'; await upsert('WHU:' + date, JSON.stringify({ date, rows, file: up.file || '', by: me(), at: new Date().toISOString() })); }
          U.days.delete(date); pulled = 0; await pull(true); if (!U.days.has(date)) U.days.set(date, { date, rows });
          d.remove(); toast('🏭 WHs utilization ' + dmy(date) + ' saved · ' + where); try { mwRenderReport(); } catch (x) {} }
        catch (x) { b.disabled = false; msg(/Cancelled/.test(x.message) ? 'Not saved.' : '⚠ Not saved: ' + x.message, !/Cancelled/.test(x.message)); } } }); }
  function pickFile() { let f = Q('#mwuFile'); if (!f) { f = document.createElement('input'); f.type = 'file'; f.id = 'mwuFile'; f.accept = '.xlsx,.xls,.xlsm'; f.style.display = 'none'; document.body.appendChild(f);
      f.addEventListener('change', async () => { const fl = f.files && f.files[0]; f.value = ''; if (!fl) return; try { if (!U.read) await pull(true); const p = parseFile(await fl.arrayBuffer()); if (!p.rows.length) return toast('⚠ No LOC rows found — is this the WH utilization file (blocks "Category" → LOC, capacity, utilization …)?', 'warn'); box({ date: p.date || new Date().toISOString().slice(0, 10), rows: p.rows, file: fl.name }); } catch (x) { toast('⚠ The file could not be read: ' + x.message, 'error'); } }); }
    f.click(); }

  /* ---------- report section "WHs utilization" (below Detail): one row per group of the report's "View by" ---------- */
  function whInfo() { const m = new Map(); (mw.rows || []).forEach(r => { if (r.wh && !m.has(r.wh)) m.set(r.wh, r); }); return m; }
  function secData() { const f = mw.f || {}, from = f.from || '0000-00-00', to = f.to || '9999-12-31', ds = [...U.days.keys()].sort().filter(x => x >= from && x <= to), by = mw.cfg.by || 'areareg', WI = whInfo(), key = typeof MW_BY !== 'undefined' && MW_BY[by] ? MW_BY[by] : (r => r.wh || '—');
    const H = ['Group', 'LOCs', 'Capacity', 'Used', 'Util % (last date)', 'Avg util % (period)', 'In transit', 'Free', 'Days'];
    if (!ds.length) return { headers: H, rows: [], totals: null, ds, note: U.days.size ? 'no upload between ' + dmy(f.from || '…') + ' and ' + dmy(f.to || '…') : 'no file uploaded yet' };
    const G = new Map(), all = { locs: new Set(), day: new Map() };
    ds.forEach(d => { daySel(d).rows.forEach(x => { const wh = U.map[x.loc] || x.wh || '', w = WI.get(wh) || {}, k = !wh && !/^(day|month)$/.test(by) ? '🔗 not linked yet' : key({ area: w.area || '', region: w.region || '', wh: wh || '(not linked) ' + x.loc, date: d });
      const g = G.get(k) || { locs: new Set(), day: new Map() }; [g, all].forEach(o => { o.locs.add(x.loc); const t = o.day.get(d) || { cap: 0, used: 0, tr: 0, free: 0 }; t.cap += x.cap; t.used += x.used; t.tr += x.tr; t.free += x.free; o.day.set(d, t); }); G.set(k, g); }); });
    const row = (k, g) => { const dd = [...g.day.keys()].sort(), last = g.day.get(dd[dd.length - 1]), pc = dd.map(x => g.day.get(x)).filter(t => t.cap > 0).map(t => t.used / t.cap * 100);
      return [k, g.locs.size, last.cap, last.used, last.cap ? Math.round(last.used / last.cap * 1000) / 10 : null, pc.length ? Math.round(pc.reduce((a, b) => a + b, 0) / pc.length * 10) / 10 : null, last.tr, last.free, dd.length]; };
    const rows = [...G.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })).map(([k, g]) => row(k, g)), t = row('TOTAL', all);
    return { headers: H, rows, totals: t, ds, note: dmy(ds[0]) + (ds.length > 1 ? ' → ' + dmy(ds[ds.length - 1]) : '') + ' · last date ' + dmy(ds[ds.length - 1]) }; }
  function secMount() { if (Q('#mwuCard')) return Q('#mwuCard'); const det = Q('#mwTable'), c0 = det && det.closest('.card'); if (!c0) return null; const c = document.createElement('div'); c.className = 'card'; c.id = 'mwuCard'; c.style.marginTop = '12px';
    c.innerHTML = `<div class="card-header"><div class="card-title">🏭 WHs utilization <span class="text-sm" style="font-weight:400;" id="mwuSub"></span></div><div class="btn-row"><button data-w="up" class="ghost small" type="button" style="display:none">⬆ Upload file</button><button data-w="xl" class="ghost small" type="button">⬇ Excel</button><button data-w="pr" class="ghost small" type="button">🖨 Print</button></div></div><div class="fd-wrap" style="max-height:480px"><table class="fd-tbl" id="mwuTable"></table></div>`;
    c0.after(c); c.addEventListener('click', e => { const b = e.target.closest('button[data-w]'); if (!b) return; const a = b.dataset.w, D = secData();
      if (a === 'up') return pickFile(); if (!D.rows.length) return toast('Nothing to export.', 'warn');
      if (a === 'xl') { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([D.headers, ...D.rows, D.totals]), 'WHs utilization'); XLSX.writeFile(wb, 'WHs_Utilization_' + D.ds[D.ds.length - 1] + '.xlsx'); }
      if (a === 'pr' && typeof w_printTable === 'function') w_printTable('WHs utilization', D.note, D.headers, D.rows, D.totals); }); return c; }
  function secRender() { const c = secMount(); if (!c) return; const up = c.querySelector('[data-w="up"]'); if (up) up.style.display = can() ? '' : 'none'; const D = secData(), t = Q('#mwuTable'), cell = (v, i) => v == null ? '' : typeof v === 'number' ? fmt(v, i === 4 || i === 5 ? 1 : 0) + (i === 4 || i === 5 ? '%' : '') : esc(v);
    const col = (v, i) => (i === 4 || i === 5) && v != null ? ` style="font-weight:700;color:${v > 100 ? '#dc2626' : v >= 90 ? '#d97706' : 'inherit'}"` : '';
    Q('#mwuSub').textContent = '— ' + (D.rows.length ? D.rows.length + ' group(s) · ' : '') + D.note + (U.days.size ? ' · from ' + uName() : '');
    t.innerHTML = `<thead><tr>${D.headers.map((h, i) => `<th class="${i ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${D.rows.length ? D.rows.map(r => `<tr>${r.map((v, i) => `<td class="${i ? 'n' : ''}"${col(v, i)}>${cell(v, i)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="9" style="color:var(--gray-500)">${esc(D.note)}${can() ? ' — use ⬆ Upload file.' : ''}</td></tr>`}${D.totals ? `<tr class="t">${D.totals.map((v, i) => `<td class="${i ? 'n' : ''}"${col(v, i)}><b>${cell(v, i)}</b></td>`).join('')}</tr>` : ''}</tbody>`; }
  if (typeof mwRenderReport === 'function') { const _r = mwRenderReport; mwRenderReport = function () { const r = _r.apply(this, arguments); try { if (mw.rows && mw.rows.length) secRender(); } catch (e) { console.error(e); } return r; }; }
  /* the KPI cards jump to the section */
  document.addEventListener('click', e => { const k = e.target.closest && e.target.closest('#mwKpis [data-whu]'); if (!k) return; if (!U.days.size && can()) return pickFile(); const c = Q('#mwuCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  /* ---------- Upload Destinations & Sources: "WHs utilization links" (LOC of the file → WHs Desc of the daily data) ---------- */
  async function readWhs() { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first'); if (!mw.cfg.list.daily) { try { mwLoadCfg(); } catch (e) {} }
    const name = mw.cfg.list.daily || 'Mngmnt_Daily_Data_tbl', ids = await resolveIds(site, name, token), cols = await fetchColumns(ids.siteId, ids.listId, token);
    let c = mw.cfg.map.daily && mw.cfg.map.daily.wh; if (!c || !cols.some(x => x.name === c)) c = (cols.find(x => /^whs?desc$/.test(nz(x.displayName)) || /^whs?desc$/.test(nz(x.name))) || {}).name; if (!c) throw new Error('no WHs_Desc column in ' + name);
    const its = await fetchAllItems(ids.siteId, ids.listId, token), set = new Set(); its.forEach(it => { const v = (it.fields || {})[c]; const s = v == null ? '' : typeof v === 'object' ? String(v.Value || v.LookupValue || '') : String(v); if (s.trim()) set.add(s.trim()); });
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
  const LK = { whs: null, edit: null, busy: false };
  function lkMount() { const v = Q('#view-uploaddest'); if (!v) return null; let c = Q('#mwuLinkCard'); if (c) return c; c = document.createElement('div'); c.className = 'card'; c.id = 'mwuLinkCard'; const def = Q('#utDefCard'); if (def) def.before(c); else v.appendChild(c);
    c.addEventListener('click', lkClick); c.addEventListener('input', e => { const i = e.target.closest('input[data-l]'); if (!i) return; LK.edit[i.dataset.l] = i.value.trim(); LK.dirty = true; lkMsg(''); const s = Q('#mwuLkSave'); if (s) s.disabled = false; }); return c; }
  const lkMsg = (t, bad) => { const m = Q('#mwuLkMsg'); if (m) { m.textContent = t; m.style.color = bad ? '#c0392b' : ''; } };
  function lkLocs() { const m = new Map(); [...U.days.keys()].sort().forEach(d => U.days.get(d).rows.forEach(x => { m.set(x.loc, x.cat || (m.get(x.loc) || '')); if (x.wh && !(x.loc in LK.edit)) LK.edit[x.loc] = x.wh; })); Object.keys(U.map).forEach(k => { if (!m.has(k)) m.set(k, ''); }); return [...m.entries()]; }
  function lkRender() { const c = lkMount(); if (!c) return; if (!LK.edit) LK.edit = Object.assign({}, U.map); const L = lkLocs(), W = LK.whs || [], linked = L.filter(([l]) => LK.edit[l]).length;
    c.innerHTML = `<div class="card-header"><div class="card-title">🏭 WHs utilization links <span class="text-sm" style="font-weight:400;">— LOC of the daily utilization file → WHs Desc of the Management Daily Report</span></div><div class="btn-row"><button data-k="whs" class="ghost small" type="button">⬇ Read WHs Desc list</button><button data-k="sug" class="ghost small" type="button">✨ Suggest links</button><button data-k="save" id="mwuLkSave" class="small" type="button" ${LK.dirty ? '' : 'disabled'}>💾 Save links</button></div></div>
      <div class="card-desc">The utilization file is uploaded from the report (<b>Management Daily Report → 🏭 WHs utilization → ⬆ Upload file</b>) into the SharePoint list <b>${esc(uName())}</b>. Link every LOC once to its warehouse here, so the report's Area / Regions / WHs Desc filters and groups also apply to the utilization. ${L.length ? `<b>${linked}</b> of ${L.length} linked.` : ''}</div>
      <div id="mwuLkMsg" class="text-sm" style="min-height:18px"></div>
      ${L.length ? `<div class="fd-wrap" style="max-height:460px"><table class="fd-tbl"><thead><tr><th>Category</th><th>LOC (file)</th><th>WHs Desc (daily data)</th></tr></thead><tbody>${L.map(([l, cat]) => `<tr><td>${esc(cat)}</td><td><b>${esc(l)}</b></td><td><input data-l="${esc(l)}" list="mwuLkWhs" value="${esc(LK.edit[l] || '')}" placeholder="— not linked —" style="margin:0;min-width:220px;${LK.edit[l] ? '' : 'border-color:#f59e0b'}"></td></tr>`).join('')}</tbody></table></div><datalist id="mwuLkWhs">${W.map(w => `<option value="${esc(w)}">`).join('')}</datalist>`
        : `<div class="text-sm" style="color:var(--gray-500);padding:8px 0">${U.read ? 'No utilization file uploaded yet — upload one from the report first; its locations then appear here.' : '⏳ Reading the uploads…'}</div>`}`; }
  async function lkClick(e) { const b = e.target.closest('button[data-k]'); if (!b) return; const a = b.dataset.k;
    if (a === 'whs') { try { lkMsg('Reading the warehouses of the daily list…'); LK.whs = await readWhs(); lkRender(); lkMsg('✔ ' + LK.whs.length + ' WHs Desc values — pick them in the WHs Desc boxes.'); } catch (x) { lkMsg('⚠ ' + x.message, 1); } return; }
    if (a === 'sug') { if (!LK.whs) { try { lkMsg('Reading the warehouses…'); LK.whs = await readWhs(); } catch (x) { return lkMsg('⚠ ' + x.message, 1); } } let n = 0; lkLocs().forEach(([l, cat]) => { if (!LK.edit[l]) { const g = guess(l, cat, LK.whs); if (g) { LK.edit[l] = g; n++; } } }); if (n) LK.dirty = true; lkRender(); lkMsg(n ? '✨ ' + n + ' link(s) suggested — check them, then 💾 Save links.' : 'No new suggestions.'); return; }
    if (a === 'save') { if (!can()) return lkMsg('Only the report administrator can save the links.', 1); const map = {}; Object.entries(LK.edit).forEach(([k, v]) => { if (v) map[k] = v; });
      try { b.disabled = true; lkMsg('Saving…'); await upsert(UMAP, JSON.stringify({ map, list: uName(), by: me(), at: new Date().toISOString() })); U.map = map; let n = 0; for (const d of [...U.days.keys()]) { try { n += await saveLinks(d, map); } catch (x) { if (/Cancelled/.test(x.message)) throw x; } }
        LK.dirty = false; lkRender(); lkMsg('✔ Links saved' + (n ? ' · WHs_Desc updated on ' + n + ' row(s) of ' + uName() : '') + '.'); try { if (mw.rows && mw.rows.length) mwRenderReport(); } catch (x) {} }
      catch (x) { b.disabled = false; lkMsg(/Cancelled/.test(x.message) ? 'Not saved.' : '⚠ Not saved: ' + x.message, !/Cancelled/.test(x.message)); } } }
  async function lkOpen() { if (!Q('#view-uploaddest')) return; lkMount(); lkRender(); if (!LK.busy) { LK.busy = true; try { await pull(true); } finally { LK.busy = false; } if (!LK.dirty) LK.edit = Object.assign({}, U.map); lkRender(); } }
  document.querySelectorAll('.nav-item[data-view="uploaddest"]').forEach(n => n.addEventListener('click', () => setTimeout(lkOpen, 120)));
  /* mount the publish button when the report opens */
  setInterval(() => { if (Q('#view-mgw')) pubBtn(); const v = Q('#view-uploaddest'); if (v && v.classList.contains('active') && !Q('#mwuLinkCard') && typeof isAdmin === 'function' && isAdmin()) lkOpen(); }, 1500);
  window.mwShared = { pull, publish, U, parseFile, guess, box, secData, secRender, lkOpen, readWhs };
})();
