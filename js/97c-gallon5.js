/* ============================================================
   5 GALLON — daily bottles data (DC's + Plant): entry on the web and on the phone, and a full analysis.
   SharePoint lists: Bottle_Sites_tbl · Btl_DC_Daily_tbl · Btl_Plant_Daily_tbl
   One row per Date + Site + Brand (Oasis / Aqua / Oasis Zero), Title = Date|Site|Brand. Totals are never stored — they are calculated here.
   ============================================================ */
(function () {
  'use strict';
  const Q = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nz = s => String(s == null ? '' : s).toLowerCase().replace(/_x[0-9a-f]{4}_/g, '').replace(/[^a-z0-9]/g, '');
  const num = v => { if (v && typeof v === 'object') v = v.Value != null ? v.Value : v.value; const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; };
  const str = v => { if (v && typeof v === 'object') v = v.Value != null ? v.Value : v.value != null ? v.value : v.LookupValue || ''; return String(v == null ? '' : v).trim(); };
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date()), addD = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return ymd(x); };
  const dmy = d => { d = String(d || '').slice(0, 10); return /^\d{4}-\d\d-\d\d$/.test(d) ? d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : d; };
  const dshort = d => { d = String(d || '').slice(0, 10); return d.slice(8) + '/' + d.slice(5, 7); };
  const f0 = n => Math.round(n || 0).toLocaleString('en-GB'), f1 = n => (Math.round((n || 0) * 10) / 10).toLocaleString('en-GB');
  const pc = (a, b) => b ? a / b * 100 : null, pf = v => v == null ? '–' : f1(v) + '%';
  const BR = ['Oasis', 'Aqua', 'Oasis Zero'], COLB = { Oasis: '#0ea5e9', Aqua: '#14b8a6', 'Oasis Zero': '#8b5cf6' };
  const L_SITES = 'Bottle_Sites_tbl';

  /* ---------------- the model: sections and items of each list ---------------- */
  const I = (k, l, t) => ({ k, l, t: t || '' });
  const T_DC = { id: 'DC', list: 'Btl_DC_Daily_tbl', groups: [
    { t: 'Finished goods (FG)', ic: '🧴', items: [I('FG_Recv_BU', "Receive from BU's", 'in'), I('FG_Rel_Sales', 'Release to Sales', 'out'), I('FG_Stock_Good', 'Stock in hand — good to release', 'stock')] },
    { t: 'Empty bottles (EMP) — received from sales', ic: '♻️', items: [I('EMP_RcvSales_Usable', 'Empty usable'), I('EMP_RcvSales_OCS', 'OCS'), I('EMP_RcvSales_Leaked', 'Leaked'), I('EMP_RcvSales_Disposed', 'Dispose'), I('EMP_RcvSales_CustRet', 'Customer return')], tot: ['Total received from sales'] },
    { t: 'Empty bottles (EMP) — return to plant & stock', ic: '📦', items: [I('EMP_Return_Plant', 'Return to Plant', 'out'), I('EMP_Stock_Usable', 'Stock — empty usable', 'stock'), I('EMP_Stock_OCS', 'Stock — OCS', 'stock'), I('EMP_Stock_Leaked', 'Stock — leaked', 'stock')], tot: ['Total EMP stock in hand', ['EMP_Stock_Usable', 'EMP_Stock_OCS', 'EMP_Stock_Leaked']] },
    { t: 'Racks (RM)', ic: '🗄️', items: [I('RM_Empty_Racks', 'Empty racks'), I('RM_Racks_Basis', 'Racks basis')] }] };
  const T_PL = { id: 'Plant', list: 'Btl_Plant_Daily_tbl', groups: [
    { t: 'Finished goods (FG)', ic: '🧴', items: [I('FG_Recv_Prod', 'Received from production', 'in'), I('FG_Rel_Sales', 'Release to Sales', 'out'), I('FG_Rls_DCs', "Release to DC's", 'out'), I('FG_Stock_Good', 'Stock in hand — good to release', 'stock'), I('FG_Stock_QCHold', 'Stock in hand — QC hold', 'stock')], tot: ['Total FG stock in hand', ['FG_Stock_Good', 'FG_Stock_QCHold']] },
    { t: "Empty bottles (EMP) — received from DC's", ic: '🚚', items: [I('EMP_RcvDC_Usable', 'Empty usable'), I('EMP_RcvDC_OCS', 'OCS'), I('EMP_RcvDC_Leaked', 'Leaked')], tot: ["Total received from DC's"] },
    { t: 'Empty bottles (EMP) — received from sales', ic: '♻️', items: [I('EMP_RcvSales_Usable', 'Empty usable'), I('EMP_RcvSales_OCS', 'OCS'), I('EMP_RcvSales_Leaked', 'Leaked'), I('EMP_RcvSales_Disposed', 'Dispose'), I('EMP_RcvSales_CustRet', 'Customer return')], tot: ['Total received from sales'] },
    { t: 'Empty bottles (EMP) — new bottles & production', ic: '🏭', items: [I('EMP_Recv_NewBtls', 'Received new bottles', 'in'), I('EMP_Rel_Prod', 'Release to production', 'out')] },
    { t: 'Empty bottles (EMP) — stock in hand', ic: '📦', items: [I('EMP_Stock_Usable', 'Empty usable', 'stock'), I('EMP_Stock_OCS', 'OCS', 'stock'), I('EMP_Stock_Leaked', 'Leaked', 'stock'), I('EMP_Stock_ProdReject', 'Production reject', 'stock'), I('EMP_Stock_QCHold', 'QC hold', 'stock')], tot: ['Total EMP stock in hand'] },
    { t: 'Racks (RM)', ic: '🗄️', items: [I('RM_Empty_Racks', 'Empty racks'), I('RM_Racks_Basis', 'Racks basis')] }] };
  [T_DC, T_PL].forEach(T => { T.all = []; T.groups.forEach(g => g.items.forEach(i => T.all.push(i.k))); T.lab = {}; T.groups.forEach(g => g.items.forEach(i => { T.lab[i.k] = g.t.replace(/^Empty bottles \(EMP\) — /, 'EMP · ').replace(/^Finished goods \(FG\)/, 'FG') + ' · ' + i.l; })); });
  const TT = { DC: T_DC, Plant: T_PL };
  const gtot = (g, v) => (g.tot[1] || g.items.map(i => i.k)).reduce((s, k) => s + num(v[k]), 0);
  const S = (v, ks) => ks.reduce((s, k) => s + num(v[k]), 0);

  /* ---------------- rows ---------------- */
  const keyOf = (d, s, b) => d + '|' + s + '|' + b;
  function spDay(v) {   /* SharePoint date → yyyy-mm-dd as the list shows it: a date-only value (00:00 UTC) keeps its day, a date-time is read in the local time zone (UAE) */
    v = str(v); if (!v) return ''; if (/^\d{4}-\d\d-\d\d$/.test(v) || /^\d{4}-\d\d-\d\dT00:00:00(\.0+)?Z?$/.test(v)) return v.slice(0, 10);
    const d = new Date(v); if (isNaN(d)) return /^\d{4}-\d\d-\d\d/.test(v) ? v.slice(0, 10) : ''; return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function rowFrom(T, f, id) {   /* f: object with normalised (nz) keys */
    const title = str(f.title), d0 = (title.split('|')[0] || '').slice(0, 10), dT = /^\d{4}-\d\d-\d\d$/.test(d0) ? d0 : '', date = spDay(f.entrydate) || dT;   /* the Entry_Date column is the date of the record (the same date the list shows); the date in the Title is only the fallback */
    const v = {}; T.all.forEach(k => { const x = f[nz(k)]; v[k] = (x === '' || x == null) ? null : num(x); });
    return { id, type: T.id, title, date, site: str(f.site) || (title.split('|')[1] || ''), brand: str(f.brand) || (title.split('|')[2] || ''), status: str(f.status) || 'Draft', by: str(f.enteredby), rem: str(f.remarks), loc: str(f.locationid), v };
  }
  const normF = fields => { const o = {}; Object.keys(fields || {}).forEach(k => { o[nz(k)] = fields[k]; }); return o; };
  const sub = r => /^(submitted|locked)$/i.test(r.status);
  function buildFields(T, vals, date, site, brand, status, by, loc, rem) {   /* vals: {k: string}; blank → left out */
    const F = { Title: keyOf(date, site, brand), Entry_Date: date, Site: site, Brand: brand, Status: status };
    if (by) F.Entered_By = by; if (loc) F.Location_ID = loc; if (rem != null) F.Remarks = rem;
    T.all.forEach(k => { const x = vals[k]; if (x !== '' && x != null && isFinite(+x)) F[k] = Math.max(0, Math.round(+x)); });
    return F;
  }
  /* what the numbers mean (analysis) */
  const mDC = v => ({ recv: num(v.FG_Recv_BU), rel: num(v.FG_Rel_Sales), stock: num(v.FG_Stock_Good), eR: S(v, ['EMP_RcvSales_Usable', 'EMP_RcvSales_OCS', 'EMP_RcvSales_Leaked', 'EMP_RcvSales_Disposed', 'EMP_RcvSales_CustRet']), eU: num(v.EMP_RcvSales_Usable), eB: S(v, ['EMP_RcvSales_OCS', 'EMP_RcvSales_Leaked', 'EMP_RcvSales_Disposed']), eC: num(v.EMP_RcvSales_CustRet), ret: num(v.EMP_Return_Plant), eS: S(v, ['EMP_Stock_Usable', 'EMP_Stock_OCS', 'EMP_Stock_Leaked']), rk: num(v.RM_Empty_Racks), rkb: num(v.RM_Racks_Basis) });
  const mPL = v => ({ prod: num(v.FG_Recv_Prod), rel: num(v.FG_Rel_Sales), rlsDC: num(v.FG_Rls_DCs), stock: S(v, ['FG_Stock_Good', 'FG_Stock_QCHold']), qc: num(v.FG_Stock_QCHold), eD: S(v, ['EMP_RcvDC_Usable', 'EMP_RcvDC_OCS', 'EMP_RcvDC_Leaked']), nw: num(v.EMP_Recv_NewBtls), eR: S(v, ['EMP_RcvSales_Usable', 'EMP_RcvSales_OCS', 'EMP_RcvSales_Leaked', 'EMP_RcvSales_Disposed', 'EMP_RcvSales_CustRet']), eU: num(v.EMP_RcvSales_Usable), eB: S(v, ['EMP_RcvSales_OCS', 'EMP_RcvSales_Leaked', 'EMP_RcvSales_Disposed']), eC: num(v.EMP_RcvSales_CustRet), relP: num(v.EMP_Rel_Prod), eS: S(v, ['EMP_Stock_Usable', 'EMP_Stock_OCS', 'EMP_Stock_Leaked', 'EMP_Stock_ProdReject', 'EMP_Stock_QCHold']), rej: num(v.EMP_Stock_ProdReject), rk: num(v.RM_Empty_Racks), rkb: num(v.RM_Racks_Basis) });
  const sumM = (rows, f) => rows.reduce((a, r) => { const m = f(r.v); Object.keys(m).forEach(k => { a[k] = (a[k] || 0) + m[k]; }); return a; }, {});
  const cache0 = () => ({ dc: [], pl: [], sites: [] });

  /* ---------------- shared analysis (used by the web page and the phone) ---------------- */
  function latestStock(rows, to, mf) {   /* last row on or before `to` of every site + brand */
    const m = new Map(); rows.forEach(r => { if (r.date > to) return; const k = r.site + '|' + r.brand, o = m.get(k); if (!o || r.date > o.date) m.set(k, r); }); return [...m.values()].map(r => Object.assign({ r }, mf(r.v)));
  }

  /* ============================================================ WEB ============================================================ */
  const E = { D: cache0(), loaded: false, loading: false, err: '', from: '', tab: 'entry', f: { from: '', to: '', brand: '', site: '', src: '' },
    ent: { type: 'DC', site: '', date: today(), vals: {}, rows: {}, prev: {}, dirty: false, msg: '', busy: false }, rec: { type: 'All', q: '' }, tol: 0 };
  const canEdit = () => { try { return isAdmin() || hasPerm('uploader'); } catch (e) { return false; } };
  const meName = () => { try { return (currentUser && (currentUser.displayName || currentUser.username)) || ''; } catch (e) { return ''; } };
  const sitesOf = type => { const L = E.D.sites.filter(s => s.type === type && s.active); const have = [...new Set((type === 'DC' ? E.D.dc : E.D.pl).map(r => r.site))]; have.forEach(n => { if (!L.some(s => s.name === n)) L.push({ name: n, type, loc: '', active: true, sort: 999 }); }); return L.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name)); };
  const siteLoc = n => { const s = E.D.sites.find(x => x.name === n); return s ? s.loc : ''; };

  async function loadData(force, from) {
    if (E.loading) return; E.loading = true; E.err = ''; status('⏳ Reading the 5 Gallon lists from SharePoint…');
    try {
      const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('connect the SharePoint site first (Settings)');
      E.from = from || E.from || addD(today(), -90); const errs = [], D = cache0();
      const rd = async (name, withFilter) => { const ids = await resolveIds(site, name, token); let cols = []; try { cols = (await fetchColumns(ids.siteId, ids.listId, token)).map(c => c.name); } catch (e) { }
        let items = null; if (withFilter) { try { items = await exp_fetchFilteredItems(ids.siteId, ids.listId, token, `fields/Entry_Date ge '${E.from}T00:00:00Z'`); } catch (e) { items = null; } }
        if (!items || !items.length) items = await fetchAllItems(ids.siteId, ids.listId, token); return { ids, cols, items }; };
      for (const [key, T] of [['dc', T_DC], ['pl', T_PL]]) { try { const r = await rd(T.list, true); T.ids = r.ids; T.cols = r.cols; D[key] = r.items.map(it => rowFrom(T, normF(it.fields), it.id)).filter(x => x.date && x.date >= E.from && x.site && x.brand); } catch (e) { errs.push(T.list + ': ' + (e.message || e)); } }
      try { const ids = await resolveIds(site, L_SITES, token); E.sitesIds = ids; const it = await fetchAllItems(ids.siteId, ids.listId, token); D.sites = it.map(x => { const f = normF(x.fields), a = str(f.active); return { name: str(f.title), type: /plant/i.test(str(f.sitetype)) ? 'Plant' : 'DC', loc: str(f.locationid), active: !/^(no|false|0)$/i.test(a), sort: f.sortorder === '' || f.sortorder == null ? 999 : num(f.sortorder) }; }).filter(s => s.name); } catch (e) { errs.push(L_SITES + ': ' + (e.message || e)); }
      E.D = D; E.err = errs.join(' · '); E.loaded = true;
      if (!E.f.to) { E.f.to = today(); E.f.from = addD(today(), -29); }
      const st = sitesOf(E.ent.type); if (!E.ent.site || !st.some(s => s.name === E.ent.site)) E.ent.site = st.length ? st[0].name : '';
      loadEntry(); status('');
    } catch (e) { E.err = e.message || String(e); status('✘ ' + E.err, 1); } finally { E.loading = false; }
    render();
  }
  function status(t, bad) { const s = Q('#g5Status'); if (s) { s.textContent = t || ''; s.className = 'status-msg' + (bad ? ' error' : ''); } }

  /* ---- entry state ---- */
  function loadEntry() {
    const e = E.ent, T = TT[e.type], rows = e.type === 'DC' ? E.D.dc : E.D.pl; e.vals = {}; e.rows = {}; e.prev = {}; e.dirty = false;
    BR.forEach(b => { const r = rows.find(x => x.site === e.site && x.brand === b && x.date === e.date) || null; e.rows[b] = r; e.vals[b] = {}; T.all.forEach(k => { e.vals[b][k] = r && r.v[k] != null ? String(r.v[k]) : ''; });
      const pr = rows.filter(x => x.site === e.site && x.brand === b && x.date < e.date).sort((a, c) => c.date.localeCompare(a.date))[0]; e.prev[b] = pr || null; });
  }
  /* a day closes by itself AUTO_LOCK_H hours after the end of the entry day; an admin can still correct it, and can lock / unlock a day by hand */
  const AUTO_LOCK_H = 24, autoLocked = d => !!d && Date.now() >= new Date(d + 'T00:00:00').getTime() + (24 + AUTO_LOCK_H) * 36e5;
  const canLockDay = () => { try { return isAdmin() || hasPerm('g5lock'); } catch (e) { return false; } };
  const stShow = r => /^locked$/i.test(r.status) ? 'Locked' : autoLocked(r.date) ? 'Locked (auto)' : r.status;
  const entHardLocked = () => BR.some(b => E.ent.rows[b] && /^locked$/i.test(E.ent.rows[b].status));
  const entLocked = () => (entHardLocked() || autoLocked(E.ent.date)) && !canLockDay();
  const entStatus = () => { const r = BR.map(b => E.ent.rows[b]).filter(Boolean); if (!r.length) return 'New'; if (r.every(x => /^locked$/i.test(x.status))) return 'Locked'; if (r.length === BR.length && r.every(sub)) return 'Submitted'; return 'Draft'; };
  const pill = s => `<span class="g5-pill ${s === 'Submitted' ? 'g' : /^Locked/.test(s) ? 'b' : s === 'Draft' ? 'o' : ''}">${/^Locked/.test(s) ? '🔒 ' : ''}${esc(s)}</span>`;

  function entryHtml() {
    const e = E.ent, T = TT[e.type], st = sitesOf(e.type), ro = !canEdit() || entLocked(), S0 = entStatus(), auto = autoLocked(e.date), shown = S0 !== 'Locked' && auto && S0 !== 'New' ? 'Locked (auto)' : S0, hasRows = BR.some(b => e.rows[b]);
    let h = `<div class="g5-bar"><div class="g5-seg">${['DC', 'Plant'].map(t => `<button type="button" data-et="${t}" class="${e.type === t ? 'on' : ''}">${t === 'DC' ? "🏬 DC's" : '🏭 Plant'}</button>`).join('')}</div>
      <label>Site <select data-es>${st.map(s => `<option${s.name === e.site ? ' selected' : ''}>${esc(s.name)}</option>`).join('') || '<option value="">— no site —</option>'}</select></label>
      <label>Date <span class="g5-dt"><button type="button" data-ed="-1" title="Previous day">◀</button><input type="date" data-edate value="${esc(e.date)}" max="${today()}"><button type="button" data-ed="1" title="Next day">▶</button></span></label>
      <span>${pill(shown)}</span><span class="g5-sp"></span>
      ${!ro && (entHardLocked() || auto) ? `<span class="g5-note">🔒 ${entHardLocked() ? 'Locked' : 'Closed after ' + AUTO_LOCK_H + ' h'} — you can still correct it as admin</span>` : ''}${ro ? `<span class="g5-note">${entLocked() ? '🔒 This day is locked' + (auto && !entHardLocked() ? ' (closed automatically ' + AUTO_LOCK_H + ' h after the end of the day)' : '') + ' — ask an admin to change it' : '👁 View only — your role cannot enter data'}</span>` : `<button class="secondary small" type="button" data-eact="zero">0 Fill blanks with 0</button><button class="secondary small" type="button" data-eact="copyst">⧉ Copy yesterday’s stock</button>`}</div>`;
    if (!st.length) return h + '<div class="g5-warn">No site found. Add the sites in the SharePoint list <b>Bottle_Sites_tbl</b> (Title, Site_Type = DC / Plant, Location_ID, Active) and press Refresh.</div>';
    h += `<div class="g5-wrap"><table class="g5-t g5-ent"><thead><tr><th>Item</th>${BR.map(b => `<th colspan="2" class="c">${esc(b)}</th>`).join("")}</tr><tr class="g5-sub"><th></th>${BR.map(() => '<th class="c">Yesterday</th><th class="c">Today</th>').join("")}</tr></thead><tbody>`;
    T.groups.forEach((g, gi) => {
      h += `<tr class="g5-gh"><td colspan="${1 + 2 * BR.length}">${g.ic} ${esc(g.t)}</td></tr>`;
      g.items.forEach(i => { h += `<tr><td>${esc(i.l)}${i.t === 'stock' ? ' <span class="g5-tg">stock</span>' : ''}</td>` + BR.map(b => { const p = e.prev[b]; return `<td class="c g5-prev" title="${p ? dmy(p.date) : ''}">${p && p.v[i.k] != null ? f0(p.v[i.k]) : '–'}</td><td class="c"><input type="number" inputmode="numeric" min="0" step="1" data-gi="${b}|${i.k}" value="${esc(e.vals[b][i.k])}"${ro ? ' disabled' : ''}></td>`; }).join('') + '</tr>'; });
      if (g.tot) h += `<tr class="g5-tot"><td>${esc(g.tot[0])}</td>` + BR.map(b => `<td class="c g5-prev"></td><td class="c" data-gt="${gi}|${b}">${f0(gtot(g, bnum(b)))}</td>`).join('') + '</tr>';
    });
    h += '</tbody></table></div>';
    h += `<div class="g5-foot"><span class="g5-hint" id="g5Hint"></span><span class="g5-sp"></span>${ro ? '' : `<button class="secondary" type="button" data-eact="save">💾 Save draft</button><button type="button" data-eact="submit">✔ Submit day</button>`}${canLockDay() && hasRows ? (entHardLocked() ? '<button class="secondary" type="button" data-eact="unlock">🔓 Unlock day</button>' : '<button class="secondary" type="button" data-eact="lock">🔒 Lock day</button>') : ''}</div>
      <div id="g5Msg" class="status-msg" style="font-size:12.5px;margin-top:6px">${esc(e.msg)}</div>`;
    return h;
  }
  const bnum = b => { const o = {}; Object.keys(E.ent.vals[b] || {}).forEach(k => { const x = E.ent.vals[b][k]; o[k] = x === '' ? 0 : +x; }); return o; };
  function refreshTotals() { const T = TT[E.ent.type]; T.groups.forEach((g, gi) => { if (!g.tot) return; BR.forEach(b => { const c = Q(`#g5Body [data-gt="${gi}|${b}"]`); if (c) c.textContent = f0(gtot(g, bnum(b))); }); });
    const blanks = BR.reduce((n, b) => n + T.all.filter(k => E.ent.vals[b][k] === '').length, 0), h = Q('#g5Hint'); if (h) h.textContent = blanks ? blanks + ' field(s) still blank' : '✔ all fields entered'; }
  async function entSave(statusWanted) {
    const e = E.ent, T = TT[e.type]; if (e.busy) return; if (!e.site) return say('Choose the site.', 1); if (!canEdit() || entLocked()) return say('You cannot change this day.', 1);
    const blanks = BR.reduce((n, b) => n + T.all.filter(k => e.vals[b][k] === '').length, 0);
    if (statusWanted === 'Submitted' && blanks && !confirm(blanks + ' field(s) are blank. Submit the day anyway? (a blank means “not entered”; use “Fill blanks with 0” for zeros)')) return;
    e.busy = true; say('⏳ Saving to SharePoint…'); let made = 0, upd = 0;
    try {
      const token = getGlobalAccessToken(), loc = siteLoc(e.site) || ''; if (!T.ids) throw new Error('the list ' + T.list + ' is not loaded');
      const names = T.cols && T.cols.length ? T.cols : null, mapN = F => { const o = {}, miss = []; Object.keys(F).forEach(k => { const n = names ? names.find(x => nz(x) === nz(k)) : k; if (n) o[n] = F[k]; else miss.push(k); }); if (miss.length) throw new Error('the list ' + T.list + ' has no column: ' + miss.join(', ')); return o; };
      for (const b of BR) {
        const any = T.all.some(k => e.vals[b][k] !== ''), old = e.rows[b]; if (!any && !old) continue;
        const st = statusWanted || (old ? old.status : 'Draft'), F = buildFields(T, e.vals[b], e.date, e.site, b, st, meName(), loc, null);
        if (old) { T.all.forEach(k => { if (e.vals[b][k] === '' && old.v[k] != null) F[k] = null; }); await updateItem(T.ids.siteId, T.ids.listId, old.id, mapN(F), token); upd++; }
        else { await createItem(T.ids.siteId, T.ids.listId, mapN(F), token); made++; }
      }
      try { addActivity('create', '5 Gallon ' + e.type + ' ' + e.site + ' ' + e.date + ' ' + (statusWanted || 'saved')); } catch (x) { }
      const d0 = e.date, s0 = e.site; e.busy = false; await loadData(true); E.ent.date = d0; E.ent.site = s0; loadEntry(); E.ent.msg = '✔ ' + (statusWanted === 'Submitted' ? 'Day submitted' : statusWanted === 'Locked' ? 'Day locked' : 'Draft saved') + ' — ' + made + ' row(s) created, ' + upd + ' updated.'; render();
    } catch (er) { e.busy = false; say('✘ ' + (er.message || er), 1); }
  }
  function say(t, bad) { E.ent.msg = t; const m = Q('#g5Msg'); if (m) { m.textContent = t; m.className = 'status-msg' + (bad ? ' error' : ''); } }
  async function entSetStatus(st, msg, ask) { const e = E.ent, T = TT[e.type]; if (!canLockDay()) return say('Only an admin can lock or unlock a day.', 1); if (ask && !confirm(ask)) return; try { for (const b of BR) { const r = e.rows[b]; if (r) await updateItem(T.ids.siteId, T.ids.listId, r.id, { [(T.cols || []).find(x => nz(x) === 'status') || 'Status']: st }, getGlobalAccessToken()); } try { addActivity('update', '5 Gallon ' + e.type + ' ' + e.site + ' ' + e.date + ' ' + st); } catch (x) { } const d0 = e.date, s0 = e.site; await loadData(true); E.ent.date = d0; E.ent.site = s0; loadEntry(); E.ent.msg = msg; render(); } catch (er) { say('✘ ' + (er.message || er), 1); } }
  const entLock = () => entSetStatus('Locked', '🔒 Day locked.', 'Lock ' + E.ent.site + ' for ' + dmy(E.ent.date) + '? Only an admin can change it afterwards.');
  const entUnlock = () => entSetStatus('Submitted', '🔓 Day unlocked (status Submitted).' + (autoLocked(E.ent.date) ? ' Note: it is past the ' + AUTO_LOCK_H + '-hour limit, so it closes again for operators automatically.' : ''), 'Unlock ' + E.ent.site + ' for ' + dmy(E.ent.date) + '?');

  /* ---- analysis ---- */
  function period() { const f = E.f, from = f.from || addD(today(), -29), to = f.to || today(); return { from, to, days: Math.max(1, Math.round((new Date(to) - new Date(from)) / 864e5) + 1) }; }
  function dataSet() {   /* rows of the period, by the brand / site filters */
    const p = period(), f = E.f, ok = r => r.date >= p.from && r.date <= p.to && (!f.brand || r.brand === f.brand) && (!f.site || r.site === f.site);
    const noD = f.src === 'Plant', noP = f.src === 'DC', ok2 = r => (!f.brand || r.brand === f.brand) && (!f.site || r.site === f.site);
    return { p, dc: noD ? [] : E.D.dc.filter(ok), pl: noP ? [] : E.D.pl.filter(ok), dcAll: noD ? [] : E.D.dc.filter(ok2), plAll: noP ? [] : E.D.pl.filter(ok2) };
  }
  function compute() {
    const X = dataSet(), dm = sumM(X.dc, mDC), pm = sumM(X.pl, mPL), p = X.p;
    const ls = latestStock(X.dcAll, p.to, mDC), lp = latestStock(X.plAll, p.to, mPL), sumL = (a, k) => a.reduce((s, x) => s + x[k], 0);
    const eRtot = (dm.eR || 0) + (pm.eR || 0), eBad = (dm.eB || 0) + (pm.eB || 0);
    // submission
    const active = E.D.sites.filter(s => s.active && (!E.f.site || s.name === E.f.site)), nSites = active.length || new Set([...X.dc, ...X.pl].map(r => r.site)).size;
    const sd = new Map(); [...X.dc, ...X.pl].forEach(r => { const k = r.date + '|' + r.type + '|' + r.site, o = sd.get(k) || { n: 0, s: 0 }; o.n++; if (sub(r)) o.s++; sd.set(k, o); });
    const need = BR.length, subDays = [...sd.values()].filter(o => o.n >= need && o.s >= need).length, expected = nSites * p.days;
    return { X, p, dm, pm, eRtot, eBad, stockFG: sumL(ls, 'stock') + sumL(lp, 'stock'), stockEMP: sumL(ls, 'eS') + sumL(lp, 'eS'), qc: sumL(lp, 'qc'), rej: sumL(lp, 'rej'), ls, lp, subDays, expected, nSites, entered: sd.size };
  }
  const days = p => { const a = []; for (let d = p.from; d <= p.to && a.length < 400; d = addD(d, 1)) a.push(d); return a; };
  const kpi = (l, v, s, c) => (E.tab === 'dash' && !mfKeep(String(l).replace(/&#39;|&apos;/g, "'"))) ? '' : `<div class="g5-k${c ? ' ' + c : ''}"><div class="t">${l}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  const PAL = ['#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];
  function niceMax(m) { m = Math.max(1, m); const mag = Math.pow(10, Math.floor(Math.log10(m))), st = mag / 2; return Math.ceil(m / st) * st; }
  function svgLine(labels, series) {
    const W = 680, H = 210, l = 48, r = 10, t = 10, b = 24, top = niceMax(Math.max(1, ...series.flatMap(s => s.d))), n = labels.length, xs = i => l + (n <= 1 ? (W - l - r) / 2 : i * (W - l - r) / (n - 1)), ys = v => t + (H - t - b) * (1 - v / top);
    let g = ''; for (let i = 0; i <= 4; i++) { const v = top * i / 4, y = ys(v); g += `<line x1="${l}" x2="${W - r}" y1="${y}" y2="${y}" stroke="#e2e8f0"/><text x="${l - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748b">${f0(v)}</text>`; }
    const step = Math.max(1, Math.ceil(n / 12)); labels.forEach((d, i) => { if (i % step === 0) g += `<text x="${xs(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#64748b">${dshort(d)}</text>`; });
    series.forEach(s => { g += `<polyline fill="none" stroke="${s.c}" stroke-width="2.2" points="${s.d.map((v, i) => xs(i) + ',' + ys(v)).join(' ')}"/>`; if (n <= 40) s.d.forEach((v, i) => { g += `<circle cx="${xs(i)}" cy="${ys(v)}" r="2.6" fill="${s.c}"><title>${esc(s.n)} ${dmy(labels[i])}: ${f0(v)}</title></circle>`; }); });
    return `<svg viewBox="0 0 ${W} ${H}" class="g5-svg">${g}</svg>${legend(series)}`;
  }
  function svgStack(labels, series) {
    const W = 680, H = 210, l = 48, r = 10, t = 10, b = 24, tot = labels.map((_, i) => series.reduce((s, x) => s + x.d[i], 0)), top = niceMax(Math.max(1, ...tot)), n = labels.length, bw = Math.max(2, (W - l - r) / Math.max(1, n) * 0.7), xs = i => l + (i + 0.5) * (W - l - r) / Math.max(1, n), ys = v => t + (H - t - b) * (1 - v / top);
    let g = ''; for (let i = 0; i <= 4; i++) { const v = top * i / 4, y = ys(v); g += `<line x1="${l}" x2="${W - r}" y1="${y}" y2="${y}" stroke="#e2e8f0"/><text x="${l - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748b">${f0(v)}</text>`; }
    const step = Math.max(1, Math.ceil(n / 12)); labels.forEach((d, i) => { if (i % step === 0) g += `<text x="${xs(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#64748b">${dshort(d)}</text>`; let y0 = 0; series.forEach(s => { const v = s.d[i]; if (v > 0) { g += `<rect x="${xs(i) - bw / 2}" y="${ys(y0 + v)}" width="${bw}" height="${Math.max(0.5, ys(y0) - ys(y0 + v))}" fill="${s.c}"><title>${esc(s.n)} ${dmy(d)}: ${f0(v)}</title></rect>`; y0 += v; } }); });
    return `<svg viewBox="0 0 ${W} ${H}" class="g5-svg">${g}</svg>${legend(series)}`;
  }
  const legend = ser => `<div class="g5-leg">${ser.map(s => `<span><i style="background:${s.c}"></i>${esc(s.n)}</span>`).join('')}</div>`;
  const byDay = (rows, ds, f) => ds.map(d => rows.filter(r => r.date === d).reduce((s, r) => s + f(r), 0));


  /* ---- one measure filter for every page that has measures ---- */
  const MF_TABS = ['dash', 'totals', 'brand', 'bsite', 'trend', 'pdc'];
  const DASH_L = ['Plant production (FG)', 'Plant released to sales', 'FG stock in hand', 'Plant QC hold (FG)', 'Empties received from sales', 'Usable share', 'Leaked + OCS + disposed', 'Customer returns', 'In-transit / variance', 'EMP stock in hand', 'New bottles received', 'Released to production', 'Production reject (stock)', "DC's received from BU's", "DC's released to sales", "Plant released to DC's", "Returned to plant (DC's)", "Plant received from DC's", 'Submission'];
  const mfSel = () => E.mf[E.tab] || [];
  const mfKeep = l => { const st = mfSel(); return !st.length || st.includes(l); };
  const mfGroups = () => E.tab === 'dash' ? [['', DASH_L]] : E.tab === 'totals' ? [['', BSUM.map(m => m[0])]] : (E.tab === 'brand' || E.tab === 'trend') ? [['', BMET.map(m => m[0])]] : E.tab === 'bsite' ? [['', bsTree().allL]] : E.tab === 'pdc' ? pdcOf(compute()).map(g => [g.t, g.m.map(m => m[0])]) : [];
  const mfAll = () => mfGroups().reduce((a, g) => a.concat(g[1]), []);
  function mfSearch(q) { q = String(q || '').toLowerCase().trim(); document.querySelectorAll('#view-g5 .g5-mfr').forEach(r => { r.style.display = !q || r.dataset.mfn.includes(q) ? '' : 'none'; }); }
  function mfHtml() {
    if (!MF_TABS.includes(E.tab)) return '';
    const all = mfAll(), st = mfSel(), none = st.includes('__none__'), n = none ? 0 : st.length || all.length, txt = !st.length ? 'All measures' : none ? 'None selected' : n + ' of ' + all.length;
    let h = `<div class="g5-mf"><button type="button" class="g5-mfb${st.length ? ' on' : ''}" data-mf="toggle" title="Choose the measures to show on this page">📋 Measures <b>${txt}</b> <span>▾</span></button>`;
    if (E.mfo) h += `<div class="g5-mfp"><input type="search" class="g5-mfq" data-mfq placeholder="Search measures…"><div class="g5-mfa"><button type="button" data-mf="all">Select all</button><button type="button" data-mf="none">Deselect all</button><span>${n} / ${all.length}</span></div><div class="g5-mfl">${mfGroups().map(([gt, ls]) => (gt ? `<div class="g5-mfg">${esc(gt)}</div>` : '') + ls.map(l => `<label class="g5-mfr" data-mfn="${esc(l.toLowerCase())}"><input type="checkbox" data-mfc="${esc(l)}"${!st.length || st.includes(l) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')).join('')}</div><div class="g5-mff"><button type="button" class="on" data-mf="close">Done</button></div></div>`;
    return h + '</div>';
  }
  function filtersHtml() {
    const f = E.f, sites = [...new Set([...E.D.sites.map(s => s.name), ...E.D.dc.map(r => r.site), ...E.D.pl.map(r => r.site)])].sort();
    return `<div class="g5-bar"><label>From <input type="date" data-fd="from" value="${esc(f.from)}"></label><label>To <input type="date" data-fd="to" value="${esc(f.to)}"></label>
      <span class="g5-seg">${[['7 days', 6], ['30 days', 29], ['90 days', 89]].map(([t, n]) => `<button type="button" data-pre="${n}">${t}</button>`).join('')}<button type="button" data-pre="mtd">Month</button></span>
      <label>Brand <select data-ff="brand"><option value="">All</option>${BR.map(b => `<option${f.brand === b ? ' selected' : ''}>${b}</option>`).join('')}</select></label>
      <label>Source <select data-ff="src"><option value="">All sources</option><option value="DC"${f.src === 'DC' ? ' selected' : ''}>DC's only</option><option value="Plant"${f.src === 'Plant' ? ' selected' : ''}>Plant only</option></select></label>
      <label>Site <select data-ff="site"><option value="">All sites</option>${sites.map(s => `<option${f.site === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>${mfHtml()}</div>`;
  }
  function dashHtml(C) {
    const { dm, pm, p } = C, ds = days(p), X = C.X, ok = X.dc.length + X.pl.length > 0;
    if (!ok) return filtersHtml() + '<div class="g5-warn">No data in this period. Enter the daily data (Daily entry tab) or widen the dates.</div>';
    const badP = pc(C.eBad, C.eRtot), usP = pc((dm.eU || 0) + (pm.eU || 0), C.eRtot), varEmp = (dm.ret || 0) - (pm.eD || 0);
    let h = filtersHtml() + `<div class="g5-kpis">
      ${kpi('Plant production (FG)', f0(pm.prod), 'received from production')}${kpi("DC's received from BU's", f0(dm.recv), 'FG')}${kpi("DC's released to sales", f0(dm.rel), 'FG')}${kpi('Plant released to sales', f0(pm.rel), 'FG')}${kpi("Plant released to DC's", f0(pm.rlsDC), 'FG')}
      ${kpi('FG stock in hand', f0(C.stockFG), 'closing ' + dmy(p.to) + ' · DC + Plant')}${kpi('Plant QC hold (FG)', f0(C.qc), pf(pc(C.qc, C.ls.reduce((s, x) => s + x.stock, 0) + C.lp.reduce((s, x) => s + x.stock, 0))) + ' of FG stock', C.qc ? 'o' : '')}
      ${kpi('Empties received from sales', f0(C.eRtot), 'DC + Plant')}${kpi('Usable share', pf(usP), 'of empties received', usP != null && usP < 80 ? 'o' : 'g')}${kpi('Leaked + OCS + disposed', pf(badP), f0(C.eBad) + ' bottles', badP != null && badP > 10 ? 'r' : '')}${kpi('Customer returns', f0((dm.eC || 0) + (pm.eC || 0)), 'empties')}
      ${kpi("Returned to plant (DC's)", f0(dm.ret), 'EMP')}${kpi("Plant received from DC's", f0(pm.eD), 'EMP')}${kpi('In-transit / variance', f0(varEmp), 'returned − received', Math.abs(varEmp) > 0 && Math.abs(varEmp) > 0.05 * (dm.ret || 1) ? 'r' : '')}${kpi('EMP stock in hand', f0(C.stockEMP), 'closing ' + dmy(p.to))}
      ${kpi('New bottles received', f0(pm.nw), 'plant')}${kpi('Released to production', f0(pm.relP), 'EMP')}${kpi('Production reject (stock)', f0(C.rej), 'plant EMP stock')}${kpi('Submission', pf(pc(C.subDays, C.expected)), C.subDays + ' of ' + C.expected + ' site-days submitted', pc(C.subDays, C.expected) < 80 ? 'o' : 'g')}</div>`;
    h += `<div class="g5-grid"><div class="g5-c"><h4>FG flow per day</h4>${svgLine(ds, [{ n: 'Plant production', c: PAL[0], d: byDay(X.pl, ds, r => num(r.v.FG_Recv_Prod)) }, { n: "DC received from BU's", c: PAL[1], d: byDay(X.dc, ds, r => num(r.v.FG_Recv_BU)) }, { n: 'DC release to sales', c: PAL[2], d: byDay(X.dc, ds, r => num(r.v.FG_Rel_Sales)) }, { n: 'Plant release to sales', c: PAL[4], d: byDay(X.pl, ds, r => num(r.v.FG_Rel_Sales)) }, { n: "Plant release to DC's", c: PAL[3], d: byDay(X.pl, ds, r => num(r.v.FG_Rls_DCs)) }])}</div>
      <div class="g5-c"><h4>Empties received from sales — quality</h4>${svgStack(ds, [{ n: 'Usable', c: '#16a34a', d: byDay([...X.dc, ...X.pl], ds, r => num(r.v.EMP_RcvSales_Usable)) }, { n: 'OCS', c: '#f59e0b', d: byDay([...X.dc, ...X.pl], ds, r => num(r.v.EMP_RcvSales_OCS)) }, { n: 'Leaked', c: '#ef4444', d: byDay([...X.dc, ...X.pl], ds, r => num(r.v.EMP_RcvSales_Leaked)) }, { n: 'Disposed', c: '#8b5cf6', d: byDay([...X.dc, ...X.pl], ds, r => num(r.v.EMP_RcvSales_Disposed)) }, { n: 'Customer return', c: '#64748b', d: byDay([...X.dc, ...X.pl], ds, r => num(r.v.EMP_RcvSales_CustRet)) }])}</div>
      <div class="g5-c"><h4>Stock in hand per day (all sites)</h4>${svgLine(ds, [{ n: 'FG stock (DC + Plant)', c: PAL[0], d: stockSeries(X, ds, 'fg') }, { n: 'EMP stock (DC + Plant)', c: PAL[2], d: stockSeries(X, ds, 'emp') }])}</div>
      <div class="g5-c"><h4>Empties: returned by DC's vs received by plant</h4>${svgLine(ds, [{ n: "DC return to plant", c: PAL[1], d: byDay(X.dc, ds, r => num(r.v.EMP_Return_Plant)) }, { n: "Plant received from DC's", c: PAL[3], d: byDay(X.pl, ds, r => mPL(r.v).eD) }])}</div></div>`;
    h += byBrandTable(C) + highlights(C);
    return h;
  }
  function stockSeries(X, ds, kind) {   /* the last known stock of every site+brand, summed per day */
    const all = [...X.dcAll.map(r => ({ r, m: mDC(r.v) })), ...X.plAll.map(r => ({ r, m: mPL(r.v) }))], keys = [...new Set(all.map(x => x.r.type + '|' + x.r.site + '|' + x.r.brand))];
    const map = new Map(keys.map(k => [k, all.filter(x => x.r.type + '|' + x.r.site + '|' + x.r.brand === k).sort((a, b) => a.r.date.localeCompare(b.r.date))]));
    return ds.map(d => { let s = 0; map.forEach(arr => { let last = null; for (const x of arr) { if (x.r.date <= d) last = x; else break; } if (last) s += kind === 'fg' ? last.m.stock : last.m.eS; }); return s; });
  }
  function byBrandTable(C) {
    const X = C.X, rows = BR.map(b => { const d = sumM(X.dc.filter(r => r.brand === b), mDC), p = sumM(X.pl.filter(r => r.brand === b), mPL), eR = (d.eR || 0) + (p.eR || 0), eB = (d.eB || 0) + (p.eB || 0), ls = latestStock(X.dcAll.filter(r => r.brand === b), C.p.to, mDC), lp = latestStock(X.plAll.filter(r => r.brand === b), C.p.to, mPL);
      return [b, p.prod || 0, d.recv || 0, d.rel || 0, p.rel || 0, ls.reduce((s, x) => s + x.stock, 0) + lp.reduce((s, x) => s + x.stock, 0), eR, pc(eB, eR), d.ret || 0, p.eD || 0, ls.reduce((s, x) => s + x.eS, 0) + lp.reduce((s, x) => s + x.eS, 0)]; });
    return `<div class="g5-c" style="margin-top:12px"><h4>By brand — ${dmy(C.p.from)} → ${dmy(C.p.to)}</h4><div class="g5-wrap"><table class="g5-t"><thead><tr><th>Brand</th><th>Plant production</th><th>DC from BU's</th><th>DC release</th><th>Plant release</th><th>FG stock</th><th>EMP received</th><th>Bad %</th><th>DC return</th><th>Plant from DC's</th><th>EMP stock</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${r[0]}</b></td>${r.slice(1).map((v, i) => `<td class="n">${i === 6 ? pf(v) : f0(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }
  function highlights(C) {
    const L = [], X = C.X, p = C.p;
    const bySite = new Map(); [...X.dc, ...X.pl].forEach(r => { const o = bySite.get(r.site) || { eR: 0, eB: 0, rel: 0, t: r.type }; const m = r.type === 'DC' ? mDC(r.v) : mPL(r.v); o.eR += m.eR; o.eB += m.eB; o.rel += m.rel; bySite.set(r.site, o); });
    const worst = [...bySite].filter(([, o]) => o.eR > 0).map(([s, o]) => [s, pc(o.eB, o.eR), o.eB]).sort((a, b) => b[1] - a[1])[0];
    if (worst && worst[1] > 0) L.push(`Highest share of leaked / OCS / disposed empties: <b>${esc(worst[0])}</b> — ${pf(worst[1])} (${f0(worst[2])} bottles).`);
    const top = [...bySite].filter(([, o]) => o.t === 'DC').sort((a, b) => b[1].rel - a[1].rel)[0]; if (top && top[1].rel) L.push(`Largest FG release to sales: <b>${esc(top[0])}</b> — ${f0(top[1].rel)} bottles.`);
    const v = (C.dm.ret || 0) - (C.pm.eD || 0); if (C.dm.ret || C.pm.eD) L.push(`Empties returned by DC's: ${f0(C.dm.ret || 0)} · received by the plant: ${f0(C.pm.eD || 0)} → ${v === 0 ? 'balanced' : (v > 0 ? f0(v) + ' still in transit or not yet booked' : f0(-v) + ' more received than returned')}.`);
    if (C.qc) L.push(`Plant FG on <b>QC hold</b>: ${f0(C.qc)} bottles.`);
    if (C.rej) L.push(`Production reject in plant empty stock: ${f0(C.rej)} bottles.`);
    const miss = C.expected - C.subDays; if (miss > 0) L.push(`<b>${f0(miss)}</b> site-day(s) of ${f0(C.expected)} are not submitted — see the Submission tab.`);
    return L.length ? `<div class="g5-c" style="margin-top:12px"><h4>Highlights</h4><ul class="g5-ul">${L.map(x => '<li>' + x + '</li>').join('')}</ul></div>` : '';
  }
  /* per-site table */
  function sitesData(C) {
    const X = C.X, out = [];
    const sites = [...new Set([...E.D.sites.filter(s => s.active).map(s => s.type + '|' + s.name), ...X.dc.map(r => 'DC|' + r.site), ...X.pl.map(r => 'Plant|' + r.site)])].filter(k => !E.f.site || k.split('|')[1] === E.f.site).sort((a, b) => (a < b ? 1 : -1));
    sites.forEach(k => { const [type, site] = k.split('|'), rows = (type === 'DC' ? X.dc : X.pl).filter(r => r.site === site), mf = type === 'DC' ? mDC : mPL, m = sumM(rows, mf), ls = latestStock((type === 'DC' ? X.dcAll : X.plAll).filter(r => r.site === site), C.p.to, mf), dts = [...new Set(rows.map(r => r.date))].sort();
      out.push({ type, site, days: dts.length, last: dts[dts.length - 1] || '', m, stock: ls.reduce((s, x) => s + x.stock, 0), eS: ls.reduce((s, x) => s + x.eS, 0), rk: ls.reduce((s, x) => s + x.rk, 0), rkb: ls.reduce((s, x) => s + x.rkb, 0), bad: pc(m.eB || 0, m.eR || 0) }); });
    return out;
  }
  const sitesHead = ['Site', 'Type', 'Days entered', 'Last entry', 'FG in (BU / production)', 'FG released', 'FG stock', 'EMP received (sales)', 'Bad %', 'EMP out (return / to production)', 'EMP stock', 'Empty racks', 'Racks basis'];
  const sitesRow = r => [r.site, r.type, r.days, r.last ? dmy(r.last) : '–', r.type === 'DC' ? r.m.recv || 0 : r.m.prod || 0, r.m.rel || 0, r.stock, r.m.eR || 0, r.bad, r.type === 'DC' ? r.m.ret || 0 : r.m.relP || 0, r.eS, r.rk, r.rkb];
  function sitesHtml(C) {
    const D = sitesData(C); if (!D.length) return filtersHtml() + '<div class="g5-warn">No site data in this period.</div>';
    return filtersHtml() + `<div class="g5-wrap"><table class="g5-t"><thead><tr>${sitesHead.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${D.map(r => { const x = sitesRow(r); return `<tr class="g5-go" data-site="${esc(r.site)}" data-stype="${r.type}">${x.map((v, i) => `<td class="${i > 1 ? 'n' : ''}">${i === 8 ? pf(v) : (typeof v === 'number' && i > 3 ? f0(v) : esc(v))}${i === 0 ? '' : ''}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div><div class="g5-hint">Stock = the last entry on or before ${dmy(C.p.to)}. Click a site to open its daily entry.</div>`;
  }
  /* ---- by brand ---- */
  const asBrand = (b, fn) => { const o = E.f.brand; E.f.brand = b; try { return fn(); } finally { E.f.brand = o; } };
  const sumK = (a, k) => a.reduce((s, x) => s + x[k], 0);
  const BMET = [['Plant production (FG)', C => C.pm.prod || 0], ["DC received from BU's (FG)", C => C.dm.recv || 0], ['DC release to sales (FG)', C => C.dm.rel || 0], ['Plant release to sales (FG)', C => C.pm.rel || 0], ["Plant release to DC's (FG)", C => C.pm.rlsDC || 0],
    ['FG stock in hand (closing)', C => C.stockFG], ['Plant QC hold (FG)', C => C.qc], ['EMP received from sales', C => C.eRtot], ['Usable share of empties', C => pc((C.dm.eU || 0) + (C.pm.eU || 0), C.eRtot), 'p'], ['Leaked + OCS + disposed', C => C.eBad], ['Bad share of empties', C => pc(C.eBad, C.eRtot), 'p'], ['Customer returns (EMP)', C => (C.dm.eC || 0) + (C.pm.eC || 0)],
    ["DC return to plant (EMP)", C => C.dm.ret || 0], ["Plant received from DC's (EMP)", C => C.pm.eD || 0], ['New bottles received', C => C.pm.nw || 0], ['Released to production (EMP)', C => C.pm.relP || 0], ['EMP stock in hand (closing)', C => C.stockEMP], ['Production reject (stock)', C => C.rej], ['Empty racks (closing)', C => sumK(C.ls, 'rk') + sumK(C.lp, 'rk')]];
  const flowK = (C, k) => [...C.X.dc, ...C.X.pl].reduce((s, r) => s + num(r.v[k]), 0), stkK = (C, k) => [...C.ls, ...C.lp].reduce((s, x) => s + num(x.r.v[k]), 0);
  const BSUM = [['Total FG released to sales', C => flowK(C, 'FG_Rel_Sales')], ['Total FG in stock (closing)', C => C.stockFG], ['Total FG received from production', C => flowK(C, 'FG_Recv_Prod')], ["Total FG released to DC's", C => flowK(C, 'FG_Rls_DCs')],
    ['Total EMP received from sales', C => C.eRtot], ['Total EMP released to production', C => flowK(C, 'EMP_Rel_Prod')], ['Total EMP in stock (closing)', C => C.stockEMP],
    ['Total OCS received from sales', C => flowK(C, 'EMP_RcvSales_OCS')], ['OCS in stock (closing)', C => stkK(C, 'EMP_Stock_OCS')],
    ['Total empty usable received from sales', C => flowK(C, 'EMP_RcvSales_Usable')], ['Empty usable in stock (closing)', C => stkK(C, 'EMP_Stock_Usable')],
    ['Total EMP rejected from production (stock)', C => stkK(C, 'EMP_Stock_ProdReject')],
    ['Total leaked received from sales', C => flowK(C, 'EMP_RcvSales_Leaked')], ['Leaked in stock (closing)', C => stkK(C, 'EMP_Stock_Leaked')]];
  function brandData() {
    const brands = E.f.brand ? [E.f.brand] : BR, cols = brands.map(b => ({ b, C: asBrand(b, compute) }));
    if (brands.length > 1) cols.push({ b: 'All brands', C: asBrand('', compute) });
    return { brands, cols, sum: BSUM.map(m => [m[0]].concat(cols.map(c => Math.round(m[1](c.C))))), rows: BMET.map(m => [m[0]].concat(cols.map(c => { const v = m[1](c.C); return v == null ? '' : (m[2] === 'p' ? Math.round(v * 10) / 10 : Math.round(v)); }))), pct: BMET.map(m => m[2] === 'p') };
  }
  function totalsHtml(C) {
    const D = brandData(); if (!D.cols.some(c => c.C.X.dc.length + c.C.X.pl.length)) return filtersHtml() + '<div class="g5-warn">No data in this period.</div>';
    const th = `<tr><th>Measure</th>${D.cols.map(c => `<th class="n" style="text-align:right;color:${COLB[c.b] || 'inherit'}">${esc(c.b)}</th>`).join('')}</tr>`;
    return filtersHtml() + `<div class="g5-c" style="border-color:#7dd3fc"><h4>Summary by brand — ${dmy(C.p.from)} → ${dmy(C.p.to)}</h4><div class="g5-hint">Movements are totals of the period · “closing” = stock in hand on ${dmy(C.p.to)} (last entry of each site)</div><div class="g5-wrap"><table class="g5-t"><thead>${th}</thead><tbody>${D.sum.filter(r => mfKeep(r[0])).map(r => `<tr><td>${esc(r[0])}</td>${r.slice(1).map(v => `<td class="n g5-b">${f0(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }

  /* ---- Plant & DC summary — the headline figures of the plant and of the DC's ---- */
  const stkF = (a, k) => a.reduce((t, x) => t + num(x.r.v[k]), 0), rowsF = (a, ks) => a.reduce((t, r) => t + ks.reduce((u, k) => u + num(r.v[k]), 0), 0);
  const PDC_GL = {
    'Total FG received from production': 'Plant: Btl_Plant_Daily_tbl → FG_Recv_Prod · summed over the period',
    "Total FG released to DC's + Sales": 'Plant: FG_Rls_DCs + FG_Rel_Sales · summed over the period',
    'Total FG balance on hand': 'Plant: FG_Stock_Good + FG_Stock_QCHold · closing = last entry of each site and brand on or before the To date',
    "Total EMP received from DC's + Sales": "Plant: EMP_RcvDC_Usable + OCS + Leaked (from DC's) + EMP_RcvSales_Usable + OCS + Leaked + Disposed + CustRet (from sales) · summed over the period",
    'Total EMP transferred to production': 'Plant: EMP_Rel_Prod · summed over the period',
    'Total usable EMP in hand': 'Plant: EMP_Stock_Usable · closing',
    'Total non-usable EMP (Leak + OCS + Production rejection)': 'Plant: EMP_Stock_Leaked + EMP_Stock_OCS + EMP_Stock_ProdReject · closing',
    'Total FG received from plant': "DC: Btl_DC_Daily_tbl → FG_Recv_BU (the FG the DC receives) · summed over the period",
    'Total FG released to sales': 'DC: FG_Rel_Sales · summed over the period',
    'Total FG on hand': 'DC: FG_Stock_Good · closing',
    'Total usable EMP on hand': 'DC: EMP_Stock_Usable · closing',
    'Total usable EMP transferred to plants': 'DC: EMP_Return_Plant · summed over the period',
    'Total usable EMP received from sales + customer returns': 'DC: EMP_RcvSales_Usable + EMP_RcvSales_CustRet · summed over the period',
    'Total non-usable EMP from sales (Leak + OCS)': 'DC: EMP_RcvSales_Leaked + EMP_RcvSales_OCS · summed over the period',
    'Total empty racks on hand (Plant)': 'Plant: Btl_Plant_Daily_tbl → RM_Empty_Racks · closing',
    "Total empty racks on hand (DC's)": 'DC: Btl_DC_Daily_tbl → RM_Empty_Racks · closing',
    'Total customer deposits': 'No column for customer deposits exists yet in Btl_DC_Daily_tbl — add one and it can be shown here'
  };
  function pdcOf(C) {
    const pm = C.pm, dm = C.dm, dcR = C.X.dc, nu = ['EMP_Stock_Leaked', 'EMP_Stock_OCS', 'EMP_Stock_ProdReject'];
    return [
      { id: 'pf', t: '🏭 Plant — Finished goods (FG)', c: '#0ea5e9', m: [['Total FG received from production', pm.prod || 0], ["Total FG released to DC's + Sales", (pm.rlsDC || 0) + (pm.rel || 0)], ['Total FG balance on hand', sumK(C.lp, 'stock')]] },
      { id: 'pe', t: '🏭 Plant — Empty bottles (EMP)', c: '#14b8a6', m: [["Total EMP received from DC's + Sales", (pm.eD || 0) + (pm.eR || 0)], ['Total EMP transferred to production', pm.relP || 0], ['Total usable EMP in hand', stkF(C.lp, 'EMP_Stock_Usable')], ['Total non-usable EMP (Leak + OCS + Production rejection)', nu.reduce((t, k) => t + stkF(C.lp, k), 0)], ['Total empty racks on hand (Plant)', stkF(C.lp, 'RM_Empty_Racks')]] },
      { id: 'df', t: "🏬 DC's — Finished goods (FG)", c: '#f59e0b', m: [['Total FG received from plant', dm.recv || 0], ['Total FG released to sales', dm.rel || 0], ['Total FG on hand', sumK(C.ls, 'stock')]] },
      { id: 'de', t: "🏬 DC's — Empty bottles (EMP)", c: '#8b5cf6', m: [['Total usable EMP on hand', stkF(C.ls, 'EMP_Stock_Usable')], ['Total usable EMP transferred to plants', dm.ret || 0], ['Total usable EMP received from sales + customer returns', (dm.eU || 0) + (dm.eC || 0)], ['Total non-usable EMP from sales (Leak + OCS)', rowsF(dcR, ['EMP_RcvSales_Leaked', 'EMP_RcvSales_OCS'])], ['Total customer deposits', null], ["Total empty racks on hand (DC's)", stkF(C.ls, 'RM_Empty_Racks')]] }
    ];
  }
  const asSite = (st, fn) => { const o = E.f.site; E.f.site = st; try { return fn(); } finally { E.f.site = o; } };
  function pdcData() {
    const brands = E.f.brand ? [E.f.brand] : BR, cols = brands.map(b => ({ b, G: pdcOf(asBrand(b, compute)) }));
    const tot = pdcOf(compute()); if (brands.length > 1) cols.push({ b: 'All brands', G: tot });
    /* the sites (locations / warehouses) under every total */
    const X = dataSet(), seen = new Map(); E.D.sites.filter(x => x.active).forEach(x => seen.set(x.type + '|' + x.name, { type: x.type, site: x.name }));
    X.dc.forEach(r => seen.set('DC|' + r.site, { type: 'DC', site: r.site })); X.pl.forEach(r => seen.set('Plant|' + r.site, { type: 'Plant', site: r.site }));
    const sites = [...seen.values()].filter(x => !E.f.site || x.site === E.f.site).filter(x => !(E.f.src === 'Plant' && x.type === 'DC') && !(E.f.src === 'DC' && x.type === 'Plant')).sort((a, b) => a.site.localeCompare(b.site));
    const bySite = new Map(); sites.forEach(st => bySite.set(st.type + '|' + st.site, cols.map(c => asSite(st.site, () => asBrand(c.b === 'All brands' ? '' : c.b, () => pdcOf(compute()))))));
    return { tot, cols, sites, bySite };
  }
  const PDC_TYPE = { pf: 'Plant', pe: 'Plant', df: 'DC', de: 'DC' };
  function pdcHtml(C) {
    const D = pdcData(), has = C.X.dc.length + C.X.pl.length;
    if (!has) return filtersHtml() + '<div class="g5-warn">No data in this period.</div>';
    const val = v => v == null ? '–' : f0(v), closed = E.pd.closed;
    let h = filtersHtml() + `<div class="g5-hint">Totals for ${dmy(C.p.from)} → ${dmy(C.p.to)} · movements are summed over the period, “on hand” = the stock of the last entry of each site on or before ${dmy(C.p.to)}. Follows the Brand / Source / Site filters.</div>`;
    /* KPI cards: two lines only — the plant, then the DC's; FG and empties side by side */
    const ICN = [[/received/i, '📥'], [/released/i, '📤'], [/transferred/i, '🔁'], [/non-usable/i, '⚠️'], [/usable/i, '♻️'], [/racks/i, '🗄️'], [/deposit/i, '💰'], [/balance|on hand/i, '📦']], icn = l => (ICN.find(x => x[0].test(l)) || [0, '•'])[1];
    const blk = (g, w, c) => `<div style="flex:${w};min-width:0"><div class="g5-kl"><span style="background:${c}"></span>${g.t.replace(/^[^A-Za-z]+/, '').replace(/^(Plant|DC's) — /, '')}</div><div class="g5-kr" style="grid-template-columns:repeat(${g.m.filter(m => mfKeep(m[0])).length || 1},minmax(0,1fr))">${g.m.map((m, mi) => [m, mi]).filter(x => mfKeep(x[0][0])).map(([m, mi]) => { const bad = /non-usable/i.test(m[0]), cc = m[1] == null ? '#94a3b8' : bad ? '#ea580c' : c; return `<div class="g5-k g5-pk" data-pkc="${g.id}|${mi}" style="--c:${cc};cursor:pointer" title="Click: the source figures behind this number (entries, by location)"><button type="button" class="g5-pkx" data-pkx="${esc(m[0])}" title="Hide this KPI card (bring it back from 📋 Measures)">✕</button><div class="t"><span class="ic">${icn(m[0])}</span>${esc(m[0])}</div><div class="v">${val(m[1])}</div>${m[1] == null ? '<div class="s">no column yet</div>' : ''}</div>`; }).join('')}</div></div>`;
    h += `<div class="g5-bar" style="margin:8px 0 0"><button class="secondary small" type="button" data-pdk="all">${E.kh.p && E.kh.d ? '👁 Show KPI cards' : '🙈 Hide KPI cards'}</button><span class="g5-hint">click a card to see its source figures · ✕ on a card hides it (📋 Measures brings it back) · click the Plant / DC's label to hide or show its cards</span></div>`;
    [['🏭 Plant', 0, 1, '#2563eb', '#0d9488', 'p'], ["🏬 DC's", 2, 3, '#d97706', '#7c3aed', 'd']].forEach(([t, a, b2, c1, c2, kk]) => { const g1 = D.tot[a], g2 = D.tot[b2], hid = !!E.kh[kk]; h += `<div class="g5-c g5-kline" style="margin-top:8px;--c:${c1}"><h4 class="g5-kh" style="margin:0 0 ${hid ? 0 : 6}px"><span style="background:${c1};cursor:pointer" data-pdk="${kk}" title="Click to ${hid ? 'show' : 'hide'} the cards">${t} ${hid ? '▸' : '▾'}</span></h4>${hid ? '' : `<div style="display:flex;gap:16px;flex-wrap:wrap">${[[g1, c1], [g2, c2]].filter(x => x[0].m.some(m => mfKeep(m[0]))).map(x => blk(x[0], x[0].m.filter(m => mfKeep(m[0])).length, x[1])).join('')}</div>`}</div>`; });
    const th = `<tr><th>Measure / location</th>${D.cols.map(c => `<th class="n" style="text-align:right;color:${COLB[c.b] || 'inherit'}">${esc(c.b)}</th>`).join('')}</tr>`;
    h += `<div class="g5-c" style="margin-top:12px"><h4>By brand and location</h4><div class="g5-bar"><button class="secondary small" type="button" data-pdx="open">⊞ Expand all</button><button class="secondary small" type="button" data-pdx="close">⊟ Collapse all</button><span class="g5-hint">click a measure to show / hide its locations (warehouses) · the locations add up to the total · <b>double-click</b> a measure or a location to open its source entries</span></div><div class="g5-wrap"><table class="g5-t"><thead>${th}</thead><tbody>${D.tot.map((g, gi) => `<tr class="g5-gh"><td colspan="${D.cols.length + 1}"><b>${g.t}</b></td></tr>` + g.m.map((m, mi) => { if (!mfKeep(m[0])) return ''; const key = g.id + mi, cl = closed.has(key), ss = D.sites.filter(x => x.type === PDC_TYPE[g.id]);
      return `<tr class="g5-gh" data-pdg="${key}" data-pdm="${g.id}|${mi}" title="Click: show / hide locations · double-click: source entries" style="cursor:pointer"><td><span class="g5-car">${ss.length ? (cl ? '▸' : '▾') : '·'}</span> <b>${esc(m[0])}</b>${ss.length ? ` <span class="g5-hint">${ss.length} location${ss.length > 1 ? 's' : ''}</span>` : ''}</td>${D.cols.map(c => `<td class="n g5-b">${val(c.G[gi].m[mi][1])}</td>`).join('')}</tr>` + (cl ? '' : ss.map(st => `<tr class="g5-go" data-pds="${g.id}|${mi}|${esc(st.site)}" title="Double-click: source entries of ${esc(st.site)}"><td style="padding-left:34px">${st.type === 'DC' ? '🏬' : '🏭'} ${esc(st.site)}</td>${D.cols.map((c, ci) => `<td class="n">${val(D.bySite.get(st.type + '|' + st.site)[ci][gi].m[mi][1])}</td>`).join('')}</tr>`).join('')); }).join('')).join('')}</tbody></table></div></div>`;
    return h;
  }

  /* double-click a line of the summary → the source entries (the records and the fields behind the figure) */
  const RCV = ['EMP_RcvSales_Usable', 'EMP_RcvSales_OCS', 'EMP_RcvSales_Leaked', 'EMP_RcvSales_Disposed', 'EMP_RcvSales_CustRet'];
  const PDC_F = { pf: [['FG_Recv_Prod'], ['FG_Rls_DCs', 'FG_Rel_Sales'], ['FG_Stock_Good', 'FG_Stock_QCHold']], pe: [['EMP_RcvDC_Usable', 'EMP_RcvDC_OCS', 'EMP_RcvDC_Leaked'].concat(RCV), ['EMP_Rel_Prod'], ['EMP_Stock_Usable'], ['EMP_Stock_Leaked', 'EMP_Stock_OCS', 'EMP_Stock_ProdReject'], ['RM_Empty_Racks']], df: [['FG_Recv_BU'], ['FG_Rel_Sales'], ['FG_Stock_Good']], de: [['EMP_Stock_Usable'], ['EMP_Return_Plant'], ['EMP_RcvSales_Usable', 'EMP_RcvSales_CustRet'], ['EMP_RcvSales_Leaked', 'EMP_RcvSales_OCS'], [], ['RM_Empty_Racks']] };
  const PDC_STK = { pf: [2], pe: [2, 3, 4], df: [2], de: [0, 5] };
  function openEntryFor(type, site, date) { E.ent.type = type; E.ent.site = site; if (date) E.ent.date = date; E.tab = 'entry'; const o = Q('#g5Src'); if (o) o.remove(); return ensureDate(); }
  function pdcSource(gid, mi, site) {
    const D = pdcData(), g = D.tot.find(x => x.id === gid); if (!g) return; const type = PDC_TYPE[gid], fl = PDC_F[gid][mi] || [], stock = (PDC_STK[gid] || []).includes(mi), C = compute(), name = g.m[mi][0];
    let rows = stock ? (type === 'Plant' ? C.lp : C.ls).map(x => x.r) : (type === 'Plant' ? C.X.pl : C.X.dc); if (site) rows = rows.filter(r => r.site === site);
    rows = rows.slice().sort((a, b) => b.date.localeCompare(a.date) || a.site.localeCompare(b.site) || a.brand.localeCompare(b.brand));
    let o = Q('#g5Src'); if (o) o.remove(); o = document.createElement('div'); o.id = 'g5Src'; o.dataset.nohc = '1'; o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:18px';
    const tot = fl.map(() => 0); let grand = 0;
    const body = rows.map(r => { const vs = fl.map(k => num(r.v[k])), sm = vs.reduce((a, b) => a + b, 0); vs.forEach((v, i) => tot[i] += v); grand += sm; return `<tr class="g5-go" data-ose="${esc(r.site)}" data-ot="${type}" data-od="${r.date}" title="Double-click to open this entry"><td>${dmy(r.date)}</td><td>${esc(r.site)}</td><td>${esc(r.brand)}</td><td>${esc(r.status || '')}</td>${vs.map(v => `<td class="n">${f0(v)}</td>`).join('')}<td class="n g5-b">${f0(sm)}</td><td><button type="button" class="secondary small" data-ose="${esc(r.site)}" data-ot="${type}" data-od="${r.date}">Open entry ➜</button></td></tr>`; }).join('');
    o.innerHTML = `<div style="background:var(--card,#fff);color:var(--text,#0f172a);border-radius:14px;width:min(1100px,100%);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.45);overflow:hidden"><div style="padding:14px 18px;background:linear-gradient(120deg,#0f2a47,#0e7490);color:#fff;display:flex;gap:10px;align-items:center"><div><b style="font-size:16px">${esc(name)}</b><div style="font-size:12px;opacity:.9">${esc(site || 'all locations')} · ${stock ? 'closing stock = the last entry of each site and brand on or before ' + dmy(C.p.to) : 'entries of ' + dmy(C.p.from) + ' → ' + dmy(C.p.to)} · ${type === 'Plant' ? 'Btl_Plant_Daily_tbl' : 'Btl_DC_Daily_tbl'}</div></div><span style="flex:1"></span><button type="button" data-osx="1" style="background:#fff;color:#0f2a47;border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer">✕ Close</button></div><div style="padding:8px 16px;overflow:auto"><table class="g5-t"><thead><tr><th>Date</th><th>Site</th><th>Brand</th><th>Status</th>${fl.map(k => `<th class="n">${esc(k)}</th>`).join('')}<th class="n">${esc(fl.length > 1 ? 'Sum' : 'Value')}</th><th></th></tr></thead><tbody>${body || `<tr><td colspan="${fl.length + 6}" class="g5-none">${fl.length ? 'No entries.' : 'There is no column for this figure in the list yet.'}</td></tr>`}</tbody>${rows.length ? `<tfoot><tr class="g5-tot"><td colspan="4"><b>Total</b> (${rows.length} entr${rows.length > 1 ? 'ies' : 'y'})</td>${tot.map(v => `<td class="n">${f0(v)}</td>`).join('')}<td class="n"><b>${f0(grand)}</b></td><td></td></tr></tfoot>` : ''}</table><div class="g5-hint" style="margin-top:6px">Double-click a row (or press “Open entry”) to open that entry in Daily entry.</div></div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-osx]')) return o.remove(); const b = e.target.closest('button[data-ose]'); if (b) openEntryFor(b.dataset.ot, b.dataset.ose, b.dataset.od); });
    o.addEventListener('dblclick', e => { const r = e.target.closest('tr[data-ose]'); if (r) openEntryFor(r.dataset.ot, r.dataset.ose, r.dataset.od); });
  }
  function pdcReport() { const D = pdcData(), rows = []; D.tot.forEach((g, gi) => g.m.forEach((m, mi) => { if (!mfKeep(m[0])) return; const gn = g.t.replace(/^[^A-Za-z]+/, ''); rows.push([gn, m[0], 'TOTAL'].concat(D.cols.map(c => { const v = c.G[gi].m[mi][1]; return v == null ? '' : Math.round(v); }))); D.sites.filter(x => x.type === PDC_TYPE[g.id]).forEach(st => rows.push([gn, m[0], st.site].concat(D.cols.map((c, ci) => { const v = D.bySite.get(st.type + '|' + st.site)[ci][gi].m[mi][1]; return v == null ? '' : Math.round(v); })))); })); return { headers: ['Group', 'Measure', 'Location'].concat(D.cols.map(c => c.b)), rows }; }
  function brandHtml(C) {
    const D = brandData(), ds = days(C.p); if (!D.cols.some(c => c.C.X.dc.length + c.C.X.pl.length)) return filtersHtml() + '<div class="g5-warn">No data in this period.</div>';
    let h = filtersHtml();
    h += `<div class="g5-c" style="margin-top:12px"><h4>Brands side by side — ${dmy(C.p.from)} → ${dmy(C.p.to)}</h4><div class="g5-wrap"><table class="g5-t"><thead><tr><th>Measure</th>${D.cols.map(c => `<th class="n" style="text-align:right;color:${COLB[c.b] || 'inherit'}">${esc(c.b)}</th>`).join('')}</tr></thead><tbody>${D.rows.map((r, i) => mfKeep(r[0]) ? `<tr><td>${esc(r[0])}</td>${r.slice(1).map(v => `<td class="n${i === 5 || i === 16 ? ' g5-b' : ''}">${v === '' ? '–' : (D.pct[i] ? f1(v) + '%' : f0(v))}</td>`).join('')}</tr>` : '').join('')}</tbody></table></div></div>`;
    const bs = D.brands, sr = fn => bs.map((b, i) => ({ n: b, c: COLB[b] || PAL[i], d: fn(b) }));
    const rel = b => { const X = asBrand(b, dataSet); return byDay([...X.dc, ...X.pl], ds, r => num(r.v.FG_Rel_Sales)); };
    const stk = b => asBrand(b, () => stockSeries(dataSet(), ds, 'fg'));
    const bad = b => { const X = asBrand(b, dataSet); return byDay([...X.dc, ...X.pl], ds, r => { const m = r.type === 'DC' ? mDC(r.v) : mPL(r.v); return m.eB; }); };
    h += `<div class="g5-grid" style="margin-top:12px"><div class="g5-c"><h4>FG release to sales per day</h4>${svgLine(ds, sr(rel))}</div><div class="g5-c"><h4>FG stock in hand per day</h4>${svgLine(ds, sr(stk))}</div><div class="g5-c"><h4>Leaked + OCS + disposed empties per day</h4>${svgLine(ds, sr(bad))}</div></div>`;
    D.cols.filter(c => c.b !== 'All brands').forEach(c => {
      const S = asBrand(c.b, () => sitesData(compute()));
      h += `<div class="g5-c" style="margin-top:12px"><h4 style="color:${COLB[c.b] || 'inherit'}">${esc(c.b)} — by site</h4><div class="g5-wrap" style="max-height:34vh"><table class="g5-t"><thead><tr><th>Site</th><th>Type</th><th>FG in</th><th>FG released</th><th>FG stock</th><th>EMP received</th><th>Bad %</th><th>EMP stock</th></tr></thead><tbody>${S.map(r => `<tr><td>${esc(r.site)}</td><td>${r.type}</td><td class="n">${f0(r.type === 'DC' ? r.m.recv || 0 : r.m.prod || 0)}</td><td class="n">${f0(r.m.rel || 0)}</td><td class="n">${f0(r.stock)}</td><td class="n">${f0(r.m.eR || 0)}</td><td class="n">${pf(r.bad)}</td><td class="n">${f0(r.eS)}</td></tr>`).join('') || '<tr><td colspan="8" class="g5-none">No data.</td></tr>'}</tbody></table></div></div>`;
    });
    return h;
  }
  /* ---- brand per site ---- */
  const MF = (l, f, k) => ({ l, f, k: k || 'm' });   /* k: 'm' = movement of the period · 's' = closing stock */
  const BSM = { DC: [MF("FG received from BU's", m => m.recv), MF('FG released to sales', m => m.rel), MF('FG stock in hand (closing)', m => m.stock, 's'), MF('EMP received from sales', m => m.eR), MF('Empty usable received', m => m.eU), MF('OCS + leaked + disposed received', m => m.eB), MF('Customer returns', m => m.eC), MF('EMP returned to plant', m => m.ret), MF('EMP stock in hand (closing)', m => m.eS, 's'), MF('Empty racks (closing)', m => m.rk, 's')],
    Plant: [MF('FG received from production', m => m.prod), MF('FG released to sales', m => m.rel), MF("FG released to DC's", m => m.rlsDC), MF('FG stock in hand (closing)', m => m.stock, 's'), MF('FG on QC hold (closing)', m => m.qc, 's'), MF("EMP received from DC's", m => m.eD), MF('EMP received from sales', m => m.eR), MF('Empty usable received', m => m.eU), MF('OCS + leaked + disposed received', m => m.eB), MF('Customer returns', m => m.eC), MF('New bottles received', m => m.nw), MF('EMP released to production', m => m.relP), MF('EMP stock in hand (closing)', m => m.eS, 's'), MF('Production reject (closing)', m => m.rej, 's'), MF('Empty racks (closing)', m => m.rk, 's')] };
  function bsData() {
    const p = period(), brands = E.f.brand ? [E.f.brand] : BR, X0 = dataSet(), seen = new Set(), sites = [];
    const add = (type, site) => { const k = type + '|' + site; if (!seen.has(k) && (!E.f.site || site === E.f.site) && !(E.f.src && E.f.src !== type)) { seen.add(k); sites.push({ type, site }); } };
    E.D.sites.filter(x => x.active).forEach(x => add(x.type, x.name)); X0.dcAll.forEach(r => add('DC', r.site)); X0.plAll.forEach(r => add('Plant', r.site));
    sites.sort((a, b) => (a.type < b.type ? 1 : a.type > b.type ? -1 : a.site.localeCompare(b.site)));
    const val = (type, site, b, me) => { const X = asBrand(b, dataSet), mf = type === 'DC' ? mDC : mPL, all = (type === 'DC' ? X.dcAll : X.plAll).filter(r => r.site === site), cur = (type === 'DC' ? X.dc : X.pl).filter(r => r.site === site);
      if (!all.length) return null; if (me.k === 's') return latestStock(all, p.to, mf).reduce((a, x) => a + me.f(x), 0); if (!cur.length) return 0; return cur.reduce((a, r) => a + me.f(mf(r.v)), 0); };
    return { p, brands, sites, val, has: (s) => brands.some(b => BSM[s.type].some(me => val(s.type, s.site, b, me) != null)) };
  }
  E.bs = { closed: new Set(), m: [] }; E.pd = { closed: new Set() }; E.mf = {}; E.mfo = false;   /* measure filter: tab → chosen measures (empty = all) */ E.kh = (() => { try { return JSON.parse(localStorage.getItem('orbit_g5_kh') || '{}'); } catch (e) { return {}; } })();   /* hidden KPI cards: { p: true, d: true } */   /* m = measures chosen in the filter (empty = all) */
  function bsTree() {
    const D = bsData(), sites = D.sites.filter(D.has), cols = D.brands.concat(D.brands.length > 1 ? ['All brands'] : []), labels = [], seenL = new Set();
    BSM.Plant.concat(BSM.DC).forEach(x => { if (!seenL.has(x.l)) { seenL.add(x.l); labels.push(x.l); } });
    const rowFor = (s, me) => { const v = D.brands.map(b => D.val(s.type, s.site, b, me)), t = v.some(x => x != null) ? v.reduce((a, x) => a + (x || 0), 0) : null; return D.brands.length > 1 ? v.concat([t]) : v; };
    const groups = labels.map(l => { const kids = sites.map(s => { const me = BSM[s.type].find(x => x.l === l); return me ? { s, v: rowFor(s, me) } : null; }).filter(Boolean); if (!kids.length) return null; const tot = cols.map((c, i) => kids.reduce((a, k) => a + (k.v[i] || 0), 0)); return { l, kids, tot }; }).filter(Boolean), allL = groups.map(g => g.l);
    return { D, cols, groups: groups.filter(g => mfKeep(g.l)), allL };
  }
  function bsHtml() {
    const T = bsTree(); let h = filtersHtml(); if (!T.groups.length) return h + '<div class="g5-warn">No data in this period.</div>';
    const fm = x => x == null ? '–' : f0(x), last = T.cols.length - 1, bold = i => i === last && T.cols.length > 1 ? ' g5-b' : '';
    h += `<div class="g5-bar"><button class="secondary small" type="button" data-bsx="open">⊞ Expand all</button><button class="secondary small" type="button" data-bsx="close">⊟ Collapse all</button><span class="g5-hint">Each line = one measure for all sites · click ▸ to see its sites · movements = totals of the period · “closing” = last entry on or before ${dmy(T.D.p.to)} · Excel / Print follow this layout</span></div>`;
    h += `<div class="g5-c"><div class="g5-wrap"><table class="g5-t"><thead><tr><th>Measure / site</th><th>Type</th>${T.cols.map(c => `<th class="n" style="text-align:right;color:${COLB[c] || 'inherit'}">${esc(c)}</th>`).join('')}</tr></thead><tbody>`;
    T.groups.forEach(g => { const cl = E.bs.closed.has(g.l);
      h += `<tr class="g5-gh" data-bsg="${esc(g.l)}" style="cursor:pointer"><td><span class="g5-car">${cl ? '▸' : '▾'}</span> <b>${esc(g.l)}</b> <span class="g5-hint">${g.kids.length} site${g.kids.length > 1 ? 's' : ''}</span></td><td></td>${g.tot.map((x, i) => `<td class="n g5-b">${f0(x)}</td>`).join('')}</tr>`;
      if (!cl) g.kids.forEach(k => { h += `<tr><td style="padding-left:30px">${k.s.type === 'DC' ? '🏬' : '🏭'} ${esc(k.s.site)}</td><td>${k.s.type}</td>${k.v.map((x, i) => `<td class="n${bold(i)}">${fm(x)}</td>`).join('')}</tr>`; }); });
    return h + '</tbody></table></div></div>';
  }
  function bsReport() {
    const T = bsTree(), rows = [], r0 = x => x == null ? '' : Math.round(x);
    T.groups.forEach(g => { rows.push([g.l, ''].concat(g.tot.map(r0))); g.kids.forEach(k => rows.push(['      ' + k.s.site, k.s.type].concat(k.v.map(r0)))); });
    return { headers: ['Measure / site', 'Type'].concat(T.cols), rows };
  }
  /* ---- trends: today vs yesterday · abnormal changes ---- */
  E.tr = { z: 2 };
  const TR_N = 15;   /* the reference day + the 14 days before it */
  function trRows() { const f = E.f; return [...(f.src === 'Plant' ? [] : E.D.dc), ...(f.src === 'DC' ? [] : E.D.pl)].filter(r => (!f.brand || r.brand === f.brand) && (!f.site || r.site === f.site)); }
  function trRef(rows) {   /* the "today" of the page = the To date, or the latest day that has entries */
    const to = E.f.to || today(); let R = ''; rows.forEach(r => { if (r.date <= to && r.date > R) R = r.date; }); return { to, R: R || to, shifted: !!R && R !== to };
  }
  function trStat(vals, pctPts) {   /* vals: 15 numbers or null, last = reference day */
    const cur = vals[TR_N - 1], prev = vals[TR_N - 2], base = vals.slice(0, TR_N - 1).filter(v => v != null), n = base.length;
    const mean = n ? base.reduce((a, v) => a + v, 0) / n : null, sd = n > 1 ? Math.sqrt(base.reduce((a, v) => a + (v - mean) * (v - mean), 0) / (n - 1)) : 0;
    const floor = pctPts ? 1 : Math.max(1, Math.abs(mean || 0) * 0.05), z = cur == null || mean == null || n < 5 ? null : (cur - mean) / Math.max(sd, floor);
    const avg = a => { const x = a.filter(v => v != null); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; }, a7 = avg(vals.slice(TR_N - 7)), p7 = avg(vals.slice(TR_N - 14, TR_N - 7));
    const tr = a7 == null || p7 == null ? null : p7 === 0 ? (a7 === 0 ? 0 : 100) : (a7 - p7) / Math.abs(p7) * 100;
    return { cur, prev, mean, sd, z, n, tr, d: cur == null || prev == null ? null : cur - prev, dp: cur == null || prev == null ? null : prev === 0 ? (cur === 0 ? 0 : null) : (cur - prev) / Math.abs(prev) * 100 };
  }
  const trLevel = (z, minAbs, dev) => z == null ? 0 : (Math.abs(z) >= E.tr.z + 1 ? 2 : Math.abs(z) >= E.tr.z ? 1 : 0) * (Math.abs(dev) >= minAbs ? 1 : 0);
  const TR_LBL = ['Normal', 'Watch', 'Abnormal'], TR_COL = ['#16a34a', '#d97706', '#dc2626'];
  function trData() {
    const rows = trRows(), ref = trRef(rows), R = ref.R, ds = []; for (let i = TR_N - 1; i >= 0; i--) ds.push(addD(R, -i));
    const yd = ds[TR_N - 2], has = d => rows.some(r => r.date === d);
    /* 1 · overview — the filters' scope, one value per day */
    const o0 = { from: E.f.from, to: E.f.to }, series = BMET.map(() => []);
    try { ds.forEach(d => { E.f.from = d; E.f.to = d; const C = compute(), h = C.X.dc.length + C.X.pl.length > 0; BMET.forEach((m, i) => { const v = h ? m[1](C) : null; series[i].push(v == null ? null : m[2] === 'p' ? Math.round(v * 10) / 10 : Math.round(v)); }); }); } finally { E.f.from = o0.from; E.f.to = o0.to; }
    const ov = BMET.map((m, i) => { const st = trStat(series[i], m[2] === 'p'), dev = st.mean == null || st.cur == null ? 0 : st.cur - st.mean; return Object.assign({ name: m[0], pct: m[2] === 'p', vals: series[i], lvl: trLevel(st.z, m[2] === 'p' ? 2 : 10, dev), dev }, st); });
    /* 2 · every site + brand + measure */
    const flags = [], g = new Map(); rows.forEach(r => { if (r.date < ds[0] || r.date > R) return; const k = r.type + '|' + r.site + '|' + r.brand, o = g.get(k) || { type: r.type, site: r.site, brand: r.brand, by: new Map() }; o.by.set(r.date, r); g.set(k, o); });
    g.forEach(o => { BSM[o.type].forEach(me => { const mf = o.type === 'DC' ? mDC : mPL, vals = ds.map(d => { const r = o.by.get(d); return r ? Math.round(me.f(mf(r.v))) : null; }), st = trStat(vals, false), dev = st.mean == null || st.cur == null ? 0 : st.cur - st.mean, lvl = trLevel(st.z, 10, dev);
      if (st.cur != null && st.cur < 0) flags.push(Object.assign({ o, me, lvl: 2, why: 'Negative value', vals, dev }, st));
      else if (lvl) flags.push(Object.assign({ o, me, lvl, why: dev > 0 ? 'Much higher than usual' : 'Much lower than usual', vals, dev }, st)); }); });
    /* sites that reported yesterday but not on the reference day */
    const miss = []; const seenM = new Set(); rows.forEach(r => { if (r.date !== yd) return; const k = r.type + '|' + r.site; if (seenM.has(k)) return; seenM.add(k); if (!rows.some(x => x.date === R && x.type === r.type && x.site === r.site)) miss.push({ type: r.type, site: r.site }); });
    flags.sort((a, b) => b.lvl - a.lvl || Math.abs(b.z || 0) - Math.abs(a.z || 0));
    return { rows, ref, R, yd, ds, ov: ov.filter(x => mfKeep(x.name)), flags, miss, has: has(R) };
  }
  function trSpark(vals, lvl) {
    const v = vals.filter(x => x != null); if (v.length < 2) return '<span class="g5-hint">–</span>'; const W = 96, H = 26, mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1, n = vals.length, c = TR_COL[lvl] || '#0ea5e9';
    const pts = vals.map((x, i) => x == null ? null : [2 + i * (W - 4) / (n - 1), H - 3 - (x - mn) / rg * (H - 6)]).filter(Boolean), l = pts[pts.length - 1];
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="vertical-align:middle"><polyline fill="none" stroke="#64748b" stroke-width="1.4" points="${pts.map(q => q.join(',')).join(' ')}"/><circle cx="${l[0]}" cy="${l[1]}" r="3" fill="${c}"/></svg>`;
  }
  const trArrow = t => t == null ? '–' : t > 10 ? '<span style="color:#0284c7">↗ rising</span>' : t < -10 ? '<span style="color:#7c3aed">↘ falling</span>' : '<span style="color:#64748b">→ steady</span>';
  const trBadge = l => `<span class="g5-pill" style="background:${TR_COL[l]}22;color:${TR_COL[l]}">${l === 2 ? '⚠ ' : l === 1 ? '👁 ' : '✔ '}${TR_LBL[l]}</span>`;
  const trF = (x, pct) => x == null ? '–' : pct ? f1(x) + '%' : f0(x), trD = (x, pct) => x == null ? '–' : (x > 0 ? '+' : x < 0 ? '−' : '') + (pct ? f1(Math.abs(x)) + ' pts' : f0(Math.abs(x)));
  function trHtml() {
    let h = filtersHtml(); const T = trData(); if (!T.rows.length) return h + '<div class="g5-warn">No data to compare.</div>';
    const bad = T.ov.filter(x => x.lvl).length, nAb = T.flags.filter(x => x.lvl === 2).length;
    h += `<div class="g5-bar"><label>Sensitivity <select data-trz><option value="1.5"${E.tr.z === 1.5 ? ' selected' : ''}>High — flag small changes</option><option value="2"${E.tr.z === 2 ? ' selected' : ''}>Normal</option><option value="3"${E.tr.z === 3 ? ' selected' : ''}>Low — only big changes</option></select></label><span class="g5-hint">“Today” = ${dmy(T.R)} · “Yesterday” = ${dmy(T.yd)} · usual level = average of the previous 14 days with entries · a change is flagged when it is far outside the normal day-to-day swing of that figure</span></div>`;
    if (T.ref.shifted) h += `<div class="g5-warn" style="margin:8px 0">No entries on ${dmy(T.ref.to)} yet — the latest day with entries (${dmy(T.R)}) is used as “today”.</div>`;
    h += `<div class="g5-kpis">${kpi('Reference day', dmy(T.R), 'vs ' + dmy(T.yd))}${kpi('Abnormal changes', nAb, 'site / brand / measure', nAb ? 'bad' : '')}${kpi('Watch list', T.flags.length - nAb, 'moderate changes', '')}${kpi('Totals out of range', bad, 'of ' + T.ov.length + ' totals', bad ? 'bad' : '')}${kpi('Sites missing today', T.miss.length, 'reported yesterday, nothing today', T.miss.length ? 'bad' : '')}</div>`;
    h += `<div class="g5-c"><h4>Today vs yesterday — ${E.f.brand ? esc(E.f.brand) : 'all brands'}${E.f.site ? ' · ' + esc(E.f.site) : ''}</h4><div class="g5-wrap"><table class="g5-t"><thead><tr><th>Measure</th><th class="n">Yesterday</th><th class="n">Today</th><th class="n">Change</th><th class="n">Change %</th><th class="n">Usual (14-day avg)</th><th class="n">Today vs usual</th><th>Last 15 days</th><th>7-day trend</th><th>Status</th></tr></thead><tbody>${T.ov.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${trF(x.prev, x.pct)}</td><td class="n g5-b">${trF(x.cur, x.pct)}</td><td class="n" style="color:${x.d > 0 ? '#0284c7' : x.d < 0 ? '#7c3aed' : 'inherit'}">${trD(x.d, x.pct)}</td><td class="n">${x.pct || x.dp == null ? '–' : (x.dp > 0 ? '+' : '') + f1(x.dp) + '%'}</td><td class="n">${trF(x.mean, x.pct)}</td><td class="n">${x.mean == null || x.cur == null ? '–' : trD(x.dev, x.pct)}</td><td>${trSpark(x.vals, x.lvl)}</td><td>${trArrow(x.tr)}</td><td>${x.z == null ? '<span class="g5-hint">not enough history</span>' : trBadge(x.lvl)}</td></tr>`).join('')}</tbody></table></div></div>`;
    h += `<div class="g5-c" style="margin-top:12px"><h4>⚠ Abnormal changes by site and brand</h4><div class="g5-hint">${T.flags.length ? 'Sorted by how far the figure is from its usual level.' : 'Nothing unusual — every figure is inside its normal range.'}</div>${T.miss.length ? `<div class="g5-warn" style="margin:8px 0">No entry on ${dmy(T.R)} (but there was one on ${dmy(T.yd)}): ${T.miss.map(m => esc(m.site) + ' (' + m.type + ')').join(' · ')}</div>` : ''}${T.flags.length ? `<div class="g5-wrap" style="max-height:60vh"><table class="g5-t"><thead><tr><th>Site</th><th>Brand</th><th>Measure</th><th class="n">Yesterday</th><th class="n">Today</th><th class="n">Usual</th><th class="n">Deviation</th><th>Last 15 days</th><th>Finding</th></tr></thead><tbody>${T.flags.slice(0, 300).map(x => `<tr><td>${x.o.type === 'DC' ? '🏬' : '🏭'} ${esc(x.o.site)}</td><td style="color:${COLB[x.o.brand] || 'inherit'};font-weight:700">${esc(x.o.brand)}</td><td>${esc(x.me.l)}</td><td class="n">${trF(x.prev)}</td><td class="n g5-b">${trF(x.cur)}</td><td class="n">${trF(x.mean)}</td><td class="n" style="color:${TR_COL[x.lvl]}">${trD(x.dev)}${x.mean ? ' (' + (x.dev > 0 ? '+' : '') + f0(x.dev / Math.abs(x.mean) * 100) + '%)' : ''}</td><td>${trSpark(x.vals, x.lvl)}</td><td>${trBadge(x.lvl)} <span class="g5-hint">${x.why}</span></td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
    /* trend charts — last 30 days with a 7-day average */
    const ds = days({ from: addD(T.R, -29), to: T.R }), X = { dc: T.rows.filter(r => r.type === 'DC'), pl: T.rows.filter(r => r.type === 'Plant') }, all = T.rows;
    const ma = a => a.map((_, i) => { const w = a.slice(Math.max(0, i - 6), i + 1); return w.reduce((s, v) => s + v, 0) / w.length; });
    const two = (n, d) => [{ n, c: '#0ea5e9', d }, { n: '7-day average', c: '#f59e0b', d: ma(d) }];
    const ch = (t, d) => `<div class="g5-c"><h4>${t}</h4>${svgLine(ds, two('Per day', d))}</div>`;
    const stk = stockSeries({ dcAll: X.dc, plAll: X.pl }, ds, 'fg'), stE = stockSeries({ dcAll: X.dc, plAll: X.pl }, ds, 'emp');
    h += `<div class="g5-grid" style="margin-top:12px">${ch('FG released to sales per day', byDay(all, ds, r => num(r.v.FG_Rel_Sales)))}${ch('FG received (production + DC receipts) per day', byDay(all, ds, r => r.type === 'DC' ? num(r.v.FG_Recv_BU) : num(r.v.FG_Recv_Prod)))}${ch('FG stock in hand', stk)}${ch('EMP received from sales per day', byDay(all, ds, r => (r.type === 'DC' ? mDC : mPL)(r.v).eR))}${ch('Leaked + OCS + disposed per day', byDay(all, ds, r => (r.type === 'DC' ? mDC : mPL)(r.v).eB))}${ch('EMP stock in hand', stE)}</div>`;
    return h;
  }
  function trReport() {
    const T = trData(), r0 = x => x == null ? '' : Math.round(x * 10) / 10, rows = T.ov.map(x => [x.name, r0(x.prev), r0(x.cur), r0(x.d), x.pct || x.dp == null ? '' : r0(x.dp), r0(x.mean), x.mean == null || x.cur == null ? '' : r0(x.dev), x.tr == null ? '' : x.tr > 10 ? 'Rising' : x.tr < -10 ? 'Falling' : 'Steady', x.z == null ? 'Not enough history' : TR_LBL[x.lvl]]);
    T.flags.forEach(x => rows.push(['⚠ ' + x.o.site + ' · ' + x.o.brand + ' · ' + x.me.l, r0(x.prev), r0(x.cur), r0(x.d), x.prev ? r0(x.dp) : '', r0(x.mean), r0(x.dev), '', TR_LBL[x.lvl] + ' — ' + x.why]));
    T.miss.forEach(m => rows.push(['⚠ ' + m.site + ' (' + m.type + ') — no entry on ' + dmy(T.R), '', '', '', '', '', '', '', 'Missing']));
    return { note: 'Today ' + dmy(T.R) + ' vs yesterday ' + dmy(T.yd), headers: ['Measure', 'Yesterday', 'Today', 'Change', 'Change %', 'Usual (14-day avg)', 'Today vs usual', '7-day trend', 'Status'], rows };
  }
  /* ---- Brand per site: the elegant e-mail (collapsible lines where the mail app supports it) and the Excel with +/- groups ---- */
  const BCOL = c => COLB[c] || '#0f172a', rnd = x => x == null ? '' : Math.round(x);
  function bsEmailHtml() {
    const T = bsTree(); if (!T.groups.length) return ''; const cols = T.cols, nb = cols.length, last = nb > 1 ? nb - 1 : -1, F = "font-family:'Segoe UI',Calibri,Helvetica,Arial,sans-serif;";
    const per = dmy(T.D.p.from) + ' → ' + dmy(T.D.p.to), flt = [E.f.brand, E.f.src ? (E.f.src === 'DC' ? "DC's only" : 'Plant only') : '', E.f.site].filter(Boolean).join(' · ');
    const cg = `<colgroup><col style="width:37%"><col style="width:9%">${cols.map(() => `<col style="width:${(54 / nb).toFixed(2)}%">`).join('')}</colgroup>`, tb = 'border-collapse:collapse;table-layout:fixed;width:100%;mso-table-lspace:0;mso-table-rspace:0;';
    const num = (x, i, o) => `<td align="right" style="${F}padding:8px 10px;font-size:13px;text-align:right;${i === last ? 'background:#eff6ff;font-weight:700;color:#0f2a47;' : ''}${o && o.b ? 'font-weight:700;' : ''}${o && o.bd ? 'border-bottom:1px solid #e5eaf1;' : ''}${x == null ? 'color:#94a3b8;' : ''}">${x == null ? '–' : f0(x)}</td>`;
    const kp = ['FG released to sales', 'FG received from production', 'FG stock in hand (closing)', 'EMP received from sales'].map(l => T.groups.find(g => g.l === l)).filter(Boolean);
    let h = `<style>details>summary{list-style:none}details>summary::-webkit-details-marker{display:none}details:not([open]) .bso{display:none!important}details:not([open]) .bsc{display:inline!important}</style>`;
    h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${tb}background:#eef2f7;"><tr><td align="center" style="padding:18px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:820px;width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #dbe3ec;">`;
    h += `<tr><td bgcolor="#0f2a47" style="background:#0f2a47;background-image:linear-gradient(120deg,#0f2a47,#0e7490);padding:22px 26px;${F}"><div style="font-size:11px;letter-spacing:1.6px;color:#7dd3fc;font-weight:600;">NFPC · ORBIT · 5 GALLON</div><div style="font-size:24px;font-weight:700;color:#ffffff;margin-top:4px;">Brand per site</div><div style="font-size:12.5px;color:#cfe3f5;margin-top:6px;">${esc(per)}${flt ? ' · ' + esc(flt) : ''}</div></td></tr>`;
    if (kp.length) h += `<tr><td style="padding:16px 20px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0;margin:0 -8px;width:calc(100% + 16px);"><tr>${kp.map(g => `<td width="${(100 / kp.length).toFixed(1)}%" valign="top" style="background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid #0ea5e9;padding:10px 12px;${F}"><div style="font-size:11px;color:#64748b;">${esc(g.l)}</div><div style="font-size:22px;font-weight:700;color:#0f2a47;margin-top:2px;">${f0(g.tot[nb > 1 ? nb - 1 : 0])}</div><div style="font-size:10.5px;color:#94a3b8;">${nb > 1 ? 'all brands' : esc(cols[0])}</div></td>`).join('')}</tr></table></td></tr>`;
    h += `<tr><td style="padding:12px 20px 4px;${F}font-size:12px;color:#475569;">${cols.filter(c => c !== 'All brands').map(c => `<span style="display:inline-block;width:10px;height:10px;background:${BCOL(c)};margin-right:5px;"></span><b style="margin-right:14px;color:#0f172a;">${esc(c)}</b>`).join('')}<span style="color:#94a3b8;">· movements = totals of the period · “closing” = last entry on or before ${dmy(T.D.p.to)}</span></td></tr>`;
    h += `<tr><td style="padding:8px 20px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${tb}">${cg}<tr bgcolor="#0f2a47" style="background:#0f2a47;"><td style="${F}padding:10px 10px;font-size:11.5px;font-weight:700;color:#ffffff;letter-spacing:.4px;">MEASURE / SITE</td><td style="${F}padding:10px 6px;font-size:11.5px;font-weight:700;color:#ffffff;">TYPE</td>${cols.map(c => `<td align="right" style="${F}padding:10px 10px;font-size:11.5px;font-weight:700;color:#ffffff;text-align:right;border-bottom:3px solid ${c === 'All brands' ? '#e2e8f0' : BCOL(c)};">${esc(c.toUpperCase())}</td>`).join('')}</tr></table>`;
    T.groups.forEach(g => {
      h += `<details open style="margin:0;padding:0;"><summary style="display:block;cursor:pointer;outline:none;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${tb}">${cg}<tr bgcolor="#eaf2fb" style="background:#eaf2fb;"><td style="${F}padding:9px 10px;font-size:13.5px;border-left:4px solid #0ea5e9;border-bottom:1px solid #cfe0f1;color:#0f2a47;"><span class="bso" style="color:#0ea5e9;">▾</span><span class="bsc" style="display:none;color:#0ea5e9;">▸</span>&nbsp;<b>${esc(g.l)}</b> <span style="font-size:11px;color:#64748b;">· ${g.kids.length} site${g.kids.length > 1 ? 's' : ''}</span></td><td style="border-bottom:1px solid #cfe0f1;"></td>${g.tot.map((x, i) => num(x, i, { b: 1, bd: 1 }).replace('border-bottom:1px solid #e5eaf1;', 'border-bottom:1px solid #cfe0f1;').replace('background:#eff6ff;', 'background:#dbeafe;')).join('')}</tr></table></summary>`;
      h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${tb}">${cg}${g.kids.map((k, ki) => `<tr bgcolor="${ki % 2 ? '#f8fafc' : '#ffffff'}" style="background:${ki % 2 ? '#f8fafc' : '#ffffff'};"><td style="${F}padding:8px 10px 8px 30px;font-size:13px;color:#1e293b;border-bottom:1px solid #e5eaf1;">${esc(k.s.site)}</td><td style="${F}padding:8px 6px;border-bottom:1px solid #e5eaf1;"><span style="font-size:10.5px;font-weight:700;padding:2px 7px;background:${k.s.type === 'DC' ? '#cffafe' : '#fef3c7'};color:${k.s.type === 'DC' ? '#0e7490' : '#92400e'};">${k.s.type === 'DC' ? 'DC' : 'PLANT'}</span></td>${k.v.map((x, i) => num(x, i, { bd: 1 })).join('')}</tr>`).join('')}</table></details>`;
    });
    h += `</td></tr><tr><td style="padding:12px 22px 18px;${F}font-size:11.5px;color:#64748b;border-top:1px solid #e5eaf1;">▾ <b>Collapse / expand:</b> tap a measure line (Apple Mail, iPhone / iPad Mail, Thunderbird). In Outlook all lines stay open.<br><span style="color:#94a3b8;">Sent from ORBIT · ${new Date().toLocaleString()}</span></td></tr></table></td></tr></table>`;
    return h;
  }
  /* reconciliation & stock check */
  function flowData(C) {
    const X = C.X, ds = days(C.p), A = ds.map(d => { const ret = X.dc.filter(r => r.date === d).reduce((s, r) => s + num(r.v.EMP_Return_Plant), 0), rc = X.pl.filter(r => r.date === d).reduce((s, r) => s + mPL(r.v).eD, 0), pr = X.pl.filter(r => r.date === d).reduce((s, r) => s + num(r.v.FG_Rls_DCs), 0), bu = X.dc.filter(r => r.date === d).reduce((s, r) => s + num(r.v.FG_Recv_BU), 0); return { d, ret, rc, v: ret - rc, pr, bu }; }).filter(a => a.ret || a.rc || a.pr || a.bu);
    const chk = []; [['DC', E.D.dc, mDC, m => m.recv, m => m.rel, m => m.stock], ['Plant', E.D.pl, mPL, m => m.prod, m => m.rel + m.rlsDC, m => m.stock]].forEach(([type, rows, mf, fin, fout, fst]) => {
      const g = new Map(); rows.filter(r => (!E.f.brand || r.brand === E.f.brand) && (!E.f.site || r.site === E.f.site)).forEach(r => { const k = r.site + '|' + r.brand, a = g.get(k) || []; a.push(r); g.set(k, a); });
      g.forEach(arr => { arr.sort((a, b) => a.date.localeCompare(b.date)); for (let i = 1; i < arr.length; i++) { const a = arr[i - 1], b = arr[i]; if (b.date < C.p.from || b.date > C.p.to || b.date !== addD(a.date, 1)) continue; const ma = mf(a.v), mb = mf(b.v), exp = fst(ma) + fin(mb) - fout(mb), v = fst(mb) - exp; chk.push({ type, site: b.site, brand: b.brand, date: b.date, open: fst(ma), inn: fin(mb), out: fout(mb), exp, act: fst(mb), v }); } }); });
    return { A, chk: chk.filter(x => Math.abs(x.v) > E.tol).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)), nChk: chk.length };
  }
  const thT = (l, t) => `<th title="${esc(t)}" style="cursor:help">${l} <span style="color:#2563eb;font-weight:700;font-size:11px">ⓘ</span></th>`;
  const srcBox = (title, rows) => `<details class="g5-src" style="margin:8px 2px 2px"><summary style="cursor:pointer;font-size:12.5px;font-weight:700;color:#1e40af">ⓘ Where does each column come from? ${title}</summary><table class="g5-t" style="margin-top:6px"><thead><tr><th>Column</th><th>Source list</th><th>Fields summed</th><th>Calculation</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}</tbody></table></details>`;
  const SRC_A = [['Date', 'Both lists', 'Entry_Date', 'The day of the entries (one row per day that has data)'],
    ['DC return', 'Btl_DC_Daily_tbl', 'EMP_Return_Plant', 'Sum of all DC sites and brands of that day (follows the Brand / Site filters)'],
    ['Plant received', 'Btl_Plant_Daily_tbl', 'EMP_RcvDC_Usable + EMP_RcvDC_OCS + EMP_RcvDC_Leaked', 'Sum of the plant sites and brands of that day'],
    ['Variance (empties)', 'calculated', '—', 'DC return − Plant received · positive = still on the road / not yet booked by the plant'],
    ["FG: plant release to DC's", 'Btl_Plant_Daily_tbl', 'FG_Rls_DCs', "Sum of the plant sites and brands of that day"],
    ["FG: DC from BU's", 'Btl_DC_Daily_tbl', 'FG_Recv_BU', 'Sum of all DC sites and brands of that day'],
    ['Variance (FG)', 'calculated', '—', "Plant release to DC's − DC from BU's"]];
  const SRC_B = [['Opening', 'DC: Btl_DC_Daily_tbl · Plant: Btl_Plant_Daily_tbl', 'DC: FG_Stock_Good · Plant: FG_Stock_Good + FG_Stock_QCHold', "The stock reported on the previous day for the same site and brand (only consecutive days are checked)"],
    ['In', 'DC: Btl_DC_Daily_tbl · Plant: Btl_Plant_Daily_tbl', "DC: FG_Recv_BU · Plant: FG_Recv_Prod", 'Received that day'],
    ['Out', 'DC: Btl_DC_Daily_tbl · Plant: Btl_Plant_Daily_tbl', "DC: FG_Rel_Sales · Plant: FG_Rel_Sales + FG_Rls_DCs", "Released that day (sales; for the plant also what it released to the DC's)"],
    ['Expected', 'calculated', '—', 'Opening + In − Out'],
    ['Reported', 'same list', 'DC: FG_Stock_Good · Plant: FG_Stock_Good + FG_Stock_QCHold', "The stock the site entered for that day"],
    ['Difference', 'calculated', '—', 'Reported − Expected · only rows with a difference bigger than the tolerance are listed']];
  function flowHtml(C) {
    const F = flowData(C); let h = filtersHtml();
    h += `<div class="g5-c"><h4>A · Empties: DC returns vs plant receipts</h4><div class="g5-hint">DC “Return to Plant” against plant “Received from DC's”. A positive variance = bottles still on the road or not yet booked by the plant.</div><div class="g5-wrap" style="max-height:34vh"><table class="g5-t"><thead><tr>${thT('Date', 'Entry_Date of the records')}${thT('DC return', 'Btl_DC_Daily_tbl → EMP_Return_Plant, summed over the DC sites')}${thT('Plant received', 'Btl_Plant_Daily_tbl → EMP_RcvDC_Usable + EMP_RcvDC_OCS + EMP_RcvDC_Leaked')}${thT('Variance', 'DC return − Plant received')}${thT("FG: plant release to DC's", 'Btl_Plant_Daily_tbl → FG_Rls_DCs')}${thT("FG: DC from BU's", 'Btl_DC_Daily_tbl → FG_Recv_BU, summed over the DC sites')}${thT('Variance', "Plant release to DC's − DC from BU's")}</tr></thead><tbody>${F.A.map(a => `<tr><td>${dmy(a.d)}</td><td class="n">${f0(a.ret)}</td><td class="n">${f0(a.rc)}</td><td class="n ${a.v ? 'g5-bad' : ''}">${f0(a.v)}</td><td class="n">${f0(a.pr)}</td><td class="n">${f0(a.bu)}</td><td class="n ${a.pr - a.bu ? 'g5-bad' : ''}">${f0(a.pr - a.bu)}</td></tr>`).join('') || '<tr><td colspan="7" class="g5-none">No data.</td></tr>'}</tbody></table></div>${srcBox('(table A)', SRC_A)}</div>`;
    h += `<div class="g5-c" style="margin-top:12px"><h4>B · FG stock roll-forward check</h4><div class="g5-hint">Expected stock = yesterday’s stock + received − released. Released = sales + DC's. Only consecutive days are checked (${F.nChk} checked). <label>Tolerance ± <input type="number" min="0" style="width:70px" data-tol value="${E.tol}"></label></div><div class="g5-wrap" style="max-height:40vh"><table class="g5-t"><thead><tr>${thT('Date', 'The day being checked (the previous day is the opening)')}<th>Type</th><th>Site</th><th>Brand</th>${thT('Opening', 'Stock reported the day before · DC: FG_Stock_Good · Plant: FG_Stock_Good + FG_Stock_QCHold')}${thT('In', 'DC: FG_Recv_BU · Plant: FG_Recv_Prod')}${thT('Out', 'DC: FG_Rel_Sales · Plant: FG_Rel_Sales + FG_Rls_DCs')}${thT('Expected', 'Opening + In − Out')}${thT('Reported', 'Stock entered that day · DC: FG_Stock_Good · Plant: FG_Stock_Good + FG_Stock_QCHold')}${thT('Difference', 'Reported − Expected')}</tr></thead><tbody>${F.chk.slice(0, 300).map(x => `<tr><td>${dmy(x.date)}</td><td>${x.type}</td><td>${esc(x.site)}</td><td>${x.brand}</td><td class="n">${f0(x.open)}</td><td class="n">${f0(x.inn)}</td><td class="n">${f0(x.out)}</td><td class="n">${f0(x.exp)}</td><td class="n">${f0(x.act)}</td><td class="n g5-bad">${f0(x.v)}</td></tr>`).join('') || '<tr><td colspan="10" class="g5-none">✔ No stock differences beyond the tolerance.</td></tr>'}</tbody></table></div>${srcBox('(table B)', SRC_B)}</div>`;
    return h;
  }
  /* submission matrix */
  function subData(C) {
    const p = C.p, last = days({ from: addD(p.to, -13) > p.from ? addD(p.to, -13) : p.from, to: p.to }), sites = [...E.D.sites.filter(s => s.active).map(s => ({ type: s.type, site: s.name })), ...[...E.D.dc.map(r => ({ type: 'DC', site: r.site })), ...E.D.pl.map(r => ({ type: 'Plant', site: r.site }))]].filter((s, i, a) => a.findIndex(x => x.site === s.site && x.type === s.type) === i).filter(s => !E.f.site || s.site === E.f.site);
    const cell = (s, d) => { const rows = (s.type === 'DC' ? E.D.dc : E.D.pl).filter(r => r.site === s.site && r.date === d); const n = rows.length, sb = rows.filter(sub).length; return n >= BR.length && sb >= BR.length ? 'S' : n ? 'D' : 'M'; };
    return { last, sites: sites.sort((a, b) => a.type < b.type ? 1 : a.type > b.type ? -1 : a.site.localeCompare(b.site)), cell };
  }
  function subHtml(C) {
    const D = subData(C); if (!D.sites.length) return filtersHtml() + '<div class="g5-warn">No sites yet.</div>';
    return filtersHtml() + `<div class="g5-hint">Last ${D.last.length} days up to ${dmy(C.p.to)}: ✔ both brands submitted · ◐ draft / one brand only · ✖ nothing entered. Click a cell to open it.</div><div class="g5-wrap"><table class="g5-t g5-sm"><thead><tr><th>Site</th><th>Type</th>${D.last.map(d => `<th class="c">${dshort(d)}</th>`).join('')}<th class="c">Submitted</th></tr></thead><tbody>${D.sites.map(s => { const cs = D.last.map(d => D.cell(s, d)), n = cs.filter(x => x === 'S').length; return `<tr><td><b>${esc(s.site)}</b></td><td>${s.type}</td>${cs.map((x, i) => `<td class="c g5-go g5-${x}" data-site="${esc(s.site)}" data-stype="${s.type}" data-date="${D.last[i]}">${x === 'S' ? '✔' : x === 'D' ? '◐' : '✖'}</td>`).join('')}<td class="c"><b>${pf(pc(n, cs.length))}</b></td></tr>`; }).join('')}</tbody></table></div>`;
  }
  /* records */
  const SK = new Set(['RM_Empty_Racks', 'RM_Racks_Basis', '__fg', '__emp']);
  [T_DC, T_PL].forEach(T => T.groups.forEach(g => g.items.forEach(i => { if (i.t === 'stock') SK.add(i.k); })));
  function recData() {
    const p = period(), q = (E.rec.q || '').toLowerCase(), types = E.rec.type === 'All' ? ['DC', 'Plant'] : [E.rec.type];
    const rows = []; types.forEach(t => (t === 'DC' ? E.D.dc : E.D.pl).forEach(r => { if (r.date >= p.from && r.date <= p.to && (!E.f.brand || r.brand === E.f.brand) && (!E.f.site || r.site === E.f.site) && (!q || (r.site + ' ' + r.by + ' ' + r.status).toLowerCase().includes(q))) rows.push(r); }));
    rows.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type) || a.site.localeCompare(b.site) || a.brand.localeCompare(b.brand));
    const keys = []; types.forEach(t => TT[t].all.forEach(k => { if (!keys.includes(k)) keys.push(k); }));
    const cols = keys.concat(['__rs', '__fg', '__emp']), val = (r, k) => { if (k === '__rs') return (r.type === 'DC' ? mDC : mPL)(r.v).eR; if (k === '__fg') return (r.type === 'DC' ? mDC : mPL)(r.v).stock; if (k === '__emp') return (r.type === 'DC' ? mDC : mPL)(r.v).eS; return r.v[k] == null ? null : r.v[k]; };
    const head = { __rs: 'Total EMP received from sales', __fg: 'Total FG stock in hand', __emp: 'Total EMP stock in hand' };
    const headers = ['Date', 'Type', 'Site', 'Brand', 'Status'].concat(cols.map(k => head[k] || k), ['Entered by']);
    const body = rows.map(r => [dmy(r.date), r.type, r.site, r.brand, stShow(r)].concat(cols.map(k => { const v = val(r, k); return v == null ? '' : v; }), [r.by]));
    const tot = (label, sub) => { const last = new Map(); sub.forEach(r => { const g = r.type + '|' + r.site + '|' + r.brand, o = last.get(g); if (!o || r.date > o.date) last.set(g, r); });
      return [label, '', sub.length + ' row(s)', '', ''].concat(cols.map(k => { let n = 0, any = false; if (SK.has(k)) last.forEach(r => { const v = val(r, k); if (v != null) { n += v; any = true; } }); else sub.forEach(r => { const v = val(r, k); if (v != null) { n += v; any = true; } }); return any ? n : ''; }), ['']); };
    const totals = []; if (types.length > 1) types.forEach(t => totals.push(tot('TOTAL ' + (t === 'DC' ? "DC's" : 'Plant'), rows.filter(r => r.type === t)))); totals.push(tot(types.length > 1 ? 'GRAND TOTAL' : 'TOTAL', rows));
    return { rows, headers, body, totals };
  }
  function recHtml() {
    const R = recData(), nc = R.headers.length, cell = (v, i) => `<td class="${i > 4 && i < nc - 1 ? 'n' : ''}">${typeof v === 'number' ? f0(v) : esc(v)}</td>`;
    return filtersHtml() + `<div class="g5-bar"><span class="g5-seg">${[['All', 'All — DC\'s + Plant'], ['DC', "🏬 DC's"], ['Plant', '🏭 Plant']].map(([t, l]) => `<button type="button" data-rt="${t}" class="${E.rec.type === t ? 'on' : ''}">${l}</button>`).join('')}</span><input type="search" data-rq placeholder="Search site, user, status…" value="${esc(E.rec.q)}" style="min-width:220px"><span class="g5-hint">${R.rows.length} row(s) · totals are at the bottom (flows are summed; stock columns show the latest closing stock of each site and brand)</span></div>
      <div class="g5-wrap"><table class="g5-t"><thead><tr>${R.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${R.body.slice(0, 500).map(r => `<tr>${r.map(cell).join('')}</tr>`).join('') || `<tr><td colspan="${nc}" class="g5-none">No records.</td></tr>`}</tbody><tfoot>${R.totals.map(r => `<tr class="g5-tot">${r.map(cell).join('')}</tr>`).join('')}</tfoot></table></div>`;
  }
  function report() {
    const C = E.loaded ? compute() : null, per = C ? dmy(C.p.from) + ' → ' + dmy(C.p.to) + (E.f.brand ? ' · ' + E.f.brand : '') + (E.f.src ? ' · ' + (E.f.src === 'DC' ? "DC's only" : 'Plant only') : '') + (E.f.site ? ' · ' + E.f.site : '') : '';
    if (E.tab === 'brand') { const D = brandData(); return { title: '5 Gallon — by brand', note: per, sheet: '5G by brand', headers: ['Measure'].concat(D.cols.map(c => c.b)), rows: D.rows.filter(r => mfKeep(r[0])) }; }
    if (E.tab === 'trend') { const R = trReport(); return { title: '5 Gallon — today vs yesterday', note: R.note + (per ? ' · ' + per : ''), sheet: '5G today vs yesterday', headers: R.headers, rows: R.rows }; }
    if (E.tab === 'bsite') { const R = bsReport(); return { title: '5 Gallon — brand per site', note: per, sheet: '5G brand per site', headers: R.headers, rows: R.rows }; }
    if (E.tab === 'pdc') { const R = pdcReport(); return { title: '5 Gallon — Plant & DC summary', note: per, sheet: '5G plant & DC', headers: R.headers, rows: R.rows }; }
    if (E.tab === 'totals') { const D = brandData(); return { title: '5 Gallon — totals by brand', note: per, sheet: '5G totals', headers: ['Measure'].concat(D.cols.map(c => c.b)), rows: D.sum.filter(r => mfKeep(r[0])) }; }
    if (E.tab === 'sites') return { title: '5 Gallon — by site', note: per, sheet: '5G by site', headers: sitesHead, rows: sitesData(C).map(r => { const x = sitesRow(r); x[8] = x[8] == null ? '' : Math.round(x[8] * 10) / 10; return x; }) };
    if (E.tab === 'flow') { const F = flowData(C); return { title: '5 Gallon — stock check', note: per, sheet: '5G stock check', headers: ['Date', 'Type', 'Site', 'Brand', 'Opening', 'In', 'Out', 'Expected', 'Reported', 'Difference'], rows: F.chk.map(x => [dmy(x.date), x.type, x.site, x.brand, x.open, x.inn, x.out, x.exp, x.act, x.v]) }; }
    if (E.tab === 'rec') { const R = recData(); return { title: '5 Gallon — ' + (E.rec.type === 'All' ? 'DC\'s + Plant' : E.rec.type) + ' records', note: per, sheet: '5G ' + E.rec.type, headers: R.headers, rows: R.body.concat(R.totals) }; }
    if (E.tab === 'sub') { const D = subData(C); return { title: '5 Gallon — submission', note: per, sheet: '5G submission', headers: ['Site', 'Type'].concat(D.last.map(dmy)), rows: D.sites.map(s => [s.site, s.type].concat(D.last.map(d => ({ S: 'Submitted', D: 'Draft', M: 'Missing' }[D.cell(s, d)])))) }; }
    const rows = BR.map(b => { const d = sumM(C.X.dc.filter(r => r.brand === b), mDC), p = sumM(C.X.pl.filter(r => r.brand === b), mPL); return [b, p.prod || 0, d.recv || 0, d.rel || 0, p.rel || 0, (d.eR || 0) + (p.eR || 0), d.ret || 0, p.eD || 0]; });
    return { title: '5 Gallon — summary', note: per, sheet: '5G summary', headers: ['Brand', 'Plant production', "DC from BU's", 'DC release', 'Plant release', 'EMP received (sales)', 'DC return', "Plant from DC's"], rows };
  }

  /* ---- shell ---- */
  const TABS = [['entry', '📝 Daily entry'], ['dash', '📊 Dashboard'], ['pdc', '🏭 Plant & DC summary'], ['totals', '🧮 Totals'], ['brand', '🏷️ By brand'], ['bsite', '🏬 Brand per site'], ['trend', '📈 Today vs yesterday'], ['sites', '🏬 By site'], ['flow', '🔁 Checks'], ['sub', '✅ Submission'], ['rec', '📋 Records']];

  /* ---- ⓘ source of every column / measure: hover shows the SharePoint list, the fields and the equation ---- */
  const GK = x => String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]/g, '');
  const PERIOD = 'summed over the period of the From / To dates and the Brand / Source / Site filters';
  const CLOSE = 'closing = the last entry of every site and brand on or before the To date, then summed';
  const G5GL = [
    [['Plant production (FG)', 'FG received from production', 'Total FG received from production', 'Plant production', 'FG in (BU / production)'], `Plant: ${'Btl_Plant_Daily_tbl'} → FG_Recv_Prod · ${PERIOD}. (For a DC row of "FG in" it is Btl_DC_Daily_tbl → FG_Recv_BU)`],
    [["DC received from BU's (FG)", "FG received from BU's", "DC from BU's", "FG: DC from BU's"], `DC: Btl_DC_Daily_tbl → FG_Recv_BU · ${PERIOD}`],
    [['DC release to sales (FG)', 'DC release', 'Plant release to sales (FG)', 'Plant release', 'Plant released to sales', 'FG released to sales', 'Total FG released to sales', 'FG released', 'FG: released'], `FG_Rel_Sales of Btl_DC_Daily_tbl (DC) and Btl_Plant_Daily_tbl (Plant) · ${PERIOD}`],
    [["Plant release to DC's (FG)", "FG released to DC's", "Total FG released to DC's", "FG: plant release to DC's"], `Plant: Btl_Plant_Daily_tbl → FG_Rls_DCs · ${PERIOD}`],
    [['FG stock in hand (closing)', 'FG stock in hand', 'FG stock', 'Total FG in stock (closing)', 'Total FG stock in hand'], `DC: FG_Stock_Good · Plant: FG_Stock_Good + FG_Stock_QCHold · ${CLOSE}`],
    [['Plant QC hold (FG)', 'FG on QC hold (closing)'], `Plant: Btl_Plant_Daily_tbl → FG_Stock_QCHold · ${CLOSE}`],
    [['EMP received from sales', 'Total EMP received from sales', 'Empties received from sales', 'EMP received', 'EMP received (sales)'], `EMP_RcvSales_Usable + EMP_RcvSales_OCS + EMP_RcvSales_Leaked + EMP_RcvSales_Disposed + EMP_RcvSales_CustRet of both lists · ${PERIOD}`],
    [['Usable share of empties', 'Usable share'], 'EMP_RcvSales_Usable ÷ EMP received from sales × 100 (both lists, same period)'],
    [['Leaked + OCS + disposed', 'OCS + leaked + disposed received', 'Leaked + OCS + disposed received'], `EMP_RcvSales_OCS + EMP_RcvSales_Leaked + EMP_RcvSales_Disposed of both lists · ${PERIOD}`],
    [['Bad share of empties', 'Bad %'], '(EMP_RcvSales_OCS + Leaked + Disposed) ÷ (total EMP received from sales) × 100, same period'],
    [['Customer returns (EMP)', 'Customer returns'], `EMP_RcvSales_CustRet of both lists · ${PERIOD}`],
    [['DC return to plant (EMP)', 'EMP returned to plant', 'DC return'], `DC: Btl_DC_Daily_tbl → EMP_Return_Plant · ${PERIOD}`],
    [["Plant received from DC's (EMP)", "EMP received from DC's", "Plant from DC's", 'Plant received'], `Plant: Btl_Plant_Daily_tbl → EMP_RcvDC_Usable + EMP_RcvDC_OCS + EMP_RcvDC_Leaked · ${PERIOD}`],
    [['New bottles received', 'Total new bottles received'], `Plant: Btl_Plant_Daily_tbl → EMP_Recv_NewBtls · ${PERIOD}`],
    [['Released to production (EMP)', 'EMP released to production', 'Total EMP released to production', 'Released to production'], `Plant: Btl_Plant_Daily_tbl → EMP_Rel_Prod · ${PERIOD}`],
    [['EMP stock in hand (closing)', 'EMP stock in hand', 'EMP stock', 'Total EMP in stock (closing)', 'Total EMP stock in hand'], `DC: EMP_Stock_Usable + EMP_Stock_OCS + EMP_Stock_Leaked · Plant: the same + EMP_Stock_ProdReject + EMP_Stock_QCHold · ${CLOSE}`],
    [['Production reject (stock)', 'Production reject (closing)', 'Total EMP rejected from production (stock)'], `Plant: Btl_Plant_Daily_tbl → EMP_Stock_ProdReject · ${CLOSE}`],
    [['Empty racks (closing)', 'Empty racks'], `RM_Empty_Racks of both lists · ${CLOSE}`],
    [['Racks basis'], 'RM_Racks_Basis — the number of racks the empty-rack count refers to (latest entry)'],
    [['Total OCS received from sales'], `EMP_RcvSales_OCS of both lists · ${PERIOD}`], [['OCS in stock (closing)'], `EMP_Stock_OCS of both lists · ${CLOSE}`],
    [['Total empty usable received from sales', 'Empty usable received'], `EMP_RcvSales_Usable of both lists · ${PERIOD}`], [['Empty usable in stock (closing)'], `EMP_Stock_Usable of both lists · ${CLOSE}`],
    [['Total leaked received from sales'], `EMP_RcvSales_Leaked of both lists · ${PERIOD}`], [['Leaked in stock (closing)'], `EMP_Stock_Leaked of both lists · ${CLOSE}`],
    [['EMP out (return / to production)'], 'DC: EMP_Return_Plant · Plant: EMP_Rel_Prod — summed over the period'],
    [['In-transit / variance'], "DC return to plant − Plant received from DC's (empties). Positive = still on the road / not yet booked by the plant"],
    [['Submission'], 'Days where every brand of a site is Submitted / Locked ÷ (active sites × days of the period)'],
    [['Days entered'], 'Number of different days with an entry for the site in the period'], [['Last entry'], 'Latest Entry_Date of the site in the period'],
    [['Site'], 'Site name — Bottle_Sites_tbl (Title)'], [['Type'], 'DC or Plant — Bottle_Sites_tbl (Site_Type)'], [['Brand'], 'Brand of the record — Oasis, Aqua, Oasis Zero'],
    [['Measure', 'Measure / site'], 'One line per measure; the sites underneath show where the total comes from. Hover a measure for its source fields'],
    [['Entered by'], 'Entered_By — the user who saved the record'], [['Status'], 'Draft / Submitted / Locked (Status column). In Today vs yesterday: Normal / Watch / Abnormal from the z-score below'],
    [['Total EMP received from sales (record)'], 'EMP_RcvSales_Usable + OCS + Leaked + Disposed + CustRet of the row'],
    [['Change'], 'Today − Yesterday'], [['Change %'], '(Today − Yesterday) ÷ Yesterday × 100'],
    [['Usual (14-day avg)', 'Usual'], 'Average of the 14 days before the reference day (only days with entries)'],
    [['Today vs usual', 'Deviation'], 'Today − Usual. Abnormal when |Today − Usual| is bigger than the chosen number of standard deviations of the last 14 days'],
    [['Last 15 days', '7-day trend'], 'Daily values of the measure; the last dot is the reference day'], [['Finding'], 'What is unusual: the change against yesterday and against the usual level'],
    [["DC's received from BU's"], `DC: Btl_DC_Daily_tbl → FG_Recv_BU · ${PERIOD}`], [["DC's released to sales"], `DC: Btl_DC_Daily_tbl → FG_Rel_Sales · ${PERIOD}`],
    [["Plant released to DC's"], `Plant: Btl_Plant_Daily_tbl → FG_Rls_DCs · ${PERIOD}`], [["Returned to plant (DC's)"], `DC: Btl_DC_Daily_tbl → EMP_Return_Plant · ${PERIOD}`],
    [["Plant received from DC's"], `Plant: Btl_Plant_Daily_tbl → EMP_RcvDC_Usable + EMP_RcvDC_OCS + EMP_RcvDC_Leaked · ${PERIOD}`],
    [['FG in'], `DC: FG_Recv_BU · Plant: FG_Recv_Prod · ${PERIOD}`], [['Date'], 'Entry_Date of the record (the date the list shows)'],
    [['Item'], 'One line per data item = one column of the SharePoint list. Hover a line to see its column name'],
    [['Reference day'], 'The To date, or the latest day that has entries — the "today" of the comparison'],
    [['Abnormal changes'], 'Measures whose reference-day value is far from the usual 14-day level (z-score above the chosen limit)'], [['Watch list'], 'Site / brand / measure combinations with a moderate change against the usual 14-day level (flagged but not abnormal)'],
    [['Totals out of range'], 'Overview totals (the lines of the first table) whose reference-day value is flagged abnormal against their usual 14-day level'], [['Sites missing today'], 'Sites that reported yesterday but have no entry on the reference day'],
    [['Submitted'], 'Share of the shown days on which both brands of the site were submitted']
  ];
  const GLM = new Map(); G5GL.forEach(([ls, t]) => ls.forEach(l => GLM.set(GK(l), t))); Object.keys(PDC_GL).forEach(l => GLM.set(GK(l), PDC_GL[l]));
  const BRTIP = b => b === 'All brands' ? 'Sum of the brand columns (percentage lines are recalculated on the total)' : 'Sum of all sites for ' + b + ' — the brand is the Brand column of the lists';
  function explainAll(root) {
    if (!root) return; const add = (el, tip) => { if (!tip || el.querySelector(':scope > .g5-i')) return; const i = document.createElement('span'); i.className = 'g5-i'; i.textContent = 'ⓘ'; i.title = tip; el.title = el.title || tip; el.appendChild(document.createTextNode(' ')); el.appendChild(i); };
    const fld = new Map(); [T_DC, T_PL].forEach(T => T.all.forEach(k => { if (!fld.has(GK(k))) fld.set(GK(k), k); }));
    root.querySelectorAll('.g5-k .t').forEach(el => add(el, GLM.get(GK(el.textContent))));
    root.querySelectorAll('table th').forEach(el => { if (el.querySelector('.g5-i, span[style*="color:#2563eb"]')) return; const t = el.textContent.trim(); if (!t) return; const k = GK(t);
      if (E.tab === 'entry' && (t === 'Yesterday' || t === 'Today')) return add(el, t === 'Yesterday' ? 'The value entered for the previous day of this site (for comparison)' : 'The value you are entering for the chosen day — saved in the columns of Btl_DC_Daily_tbl / Btl_Plant_Daily_tbl');
      if (E.tab !== 'entry' && (t === 'Yesterday' || t === 'Today')) return add(el, t === 'Today' ? 'The reference day = the To date (or the latest day with entries)' : 'The day before the reference day');
      if (BR.includes(t) || t === 'All brands') return add(el, BRTIP(t)); if (fld.has(k)) return add(el, 'SharePoint column ' + fld.get(k) + ' (Btl_DC_Daily_tbl / Btl_Plant_Daily_tbl) of each record'); add(el, GLM.get(k)); });
    root.querySelectorAll('table.g5-t tbody tr').forEach(tr => { const td = tr.querySelector('td'); if (!td || td.querySelector('.g5-i') || tr.querySelector('th')) return; const inp = tr.querySelector('[data-gi]');
      if (inp) { const f = String(inp.dataset.gi).split('|')[1]; return add(td, 'SharePoint column ' + f + ' — ' + (E.ent.type === 'DC' ? 'Btl_DC_Daily_tbl' : 'Btl_Plant_Daily_tbl')); }
      const b = td.querySelector('b'), t = (b || td).textContent.replace(/\s+\d+ sites?$/i, '').replace(/ⓘ/g, '').trim(); const tip = GLM.get(GK(t)); if (tip && !(E.tab === 'bsite' && !b && td.style.paddingLeft)) add(td, tip); });
  }
  function render() {
    const b = Q('#g5Body'); if (!b) return;
    if (E._mt !== E.tab) { E._mt = E.tab; E.mfo = false; }
    const tb = Q('#g5Tabs'); if (tb) tb.innerHTML = TABS.map(([k, t]) => `<button type="button" data-g5t="${k}" class="${E.tab === k ? 'on' : ''}">${t}</button>`).join('');
    const ex = Q('#g5Exp'); if (ex) ex.style.display = E.tab === 'entry' ? 'none' : '';
    if (!E.loaded) { b.innerHTML = E.err ? `<div class="g5-warn">✘ ${esc(E.err)}</div>` : '<div class="g5-none">Loading…</div>'; return; }
    let h = E.err ? `<div class="g5-warn">⚠ ${esc(E.err)}</div>` : '';
    try { if (E.tab === 'entry') h += entryHtml(); else { const C = compute(); h += E.tab === 'dash' ? dashHtml(C) : E.tab === 'brand' ? brandHtml(C) : E.tab === 'bsite' ? bsHtml() : E.tab === 'trend' ? trHtml() : E.tab === 'pdc' ? pdcHtml(C) : E.tab === 'totals' ? totalsHtml(C) : E.tab === 'sites' ? sitesHtml(C) : E.tab === 'flow' ? flowHtml(C) : E.tab === 'sub' ? subHtml(C) : recHtml(); } } catch (e) { console.error(e); h += `<div class="g5-warn">✘ ${esc(e.message)}</div>`; }
    b.innerHTML = h; if (E.tab === 'entry') refreshTotals(); try { explainAll(b); } catch (e) { }
  }
  const nd = v => { v = String(v || '').trim(); if (!v) return ''; let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v), y, mo, d; if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; } else if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(v))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; } else return null; if (mo < 1 || mo > 12 || d < 1 || d > 31) return null; return y + '-' + pad(mo) + '-' + pad(d); };
  function css() {
    if (Q('#g5Css')) return; const s = document.createElement('style'); s.id = 'g5Css';
    s.textContent = `#view-g5 .g5-kline{border-radius:14px;padding:8px 14px 9px;background:linear-gradient(180deg,rgba(148,163,184,.07),transparent 60%)}#view-g5 .g5-kh{margin:0 0 8px}#view-g5 .g5-kh span{color:#fff;border-radius:999px;padding:2px 12px;font-size:12.5px;letter-spacing:.3px;display:inline-block;user-select:none}
#view-g5 .g5-kline .g5-kr{display:grid;gap:8px}#view-g5 .g5-kl{font-size:10.5px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:var(--gray-500,#64748b);margin:0 0 4px;display:flex;align-items:center;gap:7px}#view-g5 .g5-kl span{width:18px;height:3px;border-radius:3px;display:inline-block}
#view-g5 .g5-pk{position:relative;overflow:hidden;border:1px solid var(--border,#e2e8f0);border-radius:14px;padding:6px 9px 6px 13px;background:var(--card,#fff);box-shadow:0 1px 2px rgba(15,23,42,.05),0 6px 16px -10px rgba(15,23,42,.25);transition:transform .15s,box-shadow .15s}#view-g5 .g5-pk::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--c)}#view-g5 .g5-pk::after{content:"";position:absolute;right:-22px;top:-22px;width:70px;height:70px;border-radius:50%;background:var(--c);opacity:.08}
#view-g5 .g5-pk .g5-pkx{position:absolute;top:3px;right:3px;width:18px;height:18px;line-height:16px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--gray-500,#94a3b8);font-size:11px;cursor:pointer;opacity:0;transition:opacity .15s;z-index:3}#view-g5 .g5-pk:hover .g5-pkx{opacity:1}#view-g5 .g5-pk .g5-pkx:hover{background:rgba(220,38,38,.12);color:#dc2626}#view-g5 .g5-pk .g5-i{right:24px}#view-g5 .g5-pk:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(15,23,42,.08),0 12px 22px -10px rgba(15,23,42,.35)}#view-g5 .g5-kline>div{align-items:stretch}#view-g5 .g5-kline>div>div{display:flex;flex-direction:column}#view-g5 .g5-kline .g5-kr{flex:1}#view-g5 .g5-pk{display:flex;flex-direction:column}#view-g5 .g5-pk .t{font-size:11px;line-height:1.2;min-height:27px;color:var(--gray-600,#475569);font-weight:600;display:flex;gap:6px;align-items:flex-start}#view-g5 .g5-pk .ic{font-size:14px;line-height:1.1}
#view-g5 .g5-pk .v{font-size:21px;font-weight:800;letter-spacing:-.5px;margin-top:auto;padding-top:2px;line-height:1.1;color:var(--c);font-variant-numeric:tabular-nums}#view-g5 .g5-pk .s{font-size:10.5px;color:var(--gray-500)}
@media(max-width:1250px){#view-g5 .g5-kline .g5-kr{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))!important}}#view-g5 .g5-mf{position:relative;align-self:flex-end}#view-g5 .g5-mfb{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--gray-300,#cbd5e1);background:var(--card,#fff);color:var(--gray-800,#0f172a);border-radius:8px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;width:auto;margin:0}#view-g5 .g5-mfb b{font-weight:600;color:var(--acc-2,#1d4ed8)}#view-g5 .g5-mfb.on{border-color:var(--acc-2,#1d4ed8);background:var(--acc-soft,#eaf0fb)}#view-g5 .g5-mfb span{font-size:10px;color:var(--gray-500)}
#view-g5 .g5-mfp{position:absolute;z-index:60;top:calc(100% + 6px);left:0;width:340px;max-width:92vw;background:var(--card,#fff);border:1px solid var(--border,#cbd5e1);border-radius:12px;box-shadow:0 18px 48px -10px rgba(0,0,0,.4);padding:10px;display:flex;flex-direction:column;gap:8px}
#view-g5 .g5-mfp .g5-mfq{width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--gray-300,#cbd5e1);border-radius:8px;font-size:13px;margin:0}
#view-g5 .g5-mfa{display:flex;align-items:center;gap:6px}#view-g5 .g5-mfa span{margin-left:auto;font-size:11.5px;color:var(--gray-500)}
#view-g5 .g5-mfp button{border:1px solid var(--gray-300,#cbd5e1);background:var(--card,#fff);color:var(--acc-2,#1d4ed8);border-radius:7px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;width:auto;margin:0}#view-g5 .g5-mfp button.on{background:var(--acc-2,#1d4ed8);color:#fff;border-color:var(--acc-2,#1d4ed8)}
#view-g5 .g5-mfl{max-height:46vh;overflow:auto;border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:4px}#view-g5 .g5-mfg{font-size:10.5px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:var(--gray-500,#64748b);padding:8px 8px 3px}
#view-g5 .g5-mfp label.g5-mfr{display:flex;flex-direction:row;align-items:center;gap:9px;padding:6px 8px;border-radius:6px;font-size:13px;color:var(--gray-800,#0f172a);cursor:pointer;margin:0;text-align:left}#view-g5 .g5-mfp label.g5-mfr:hover{background:var(--acc-soft,#eaf0fb)}#view-g5 .g5-mfp label.g5-mfr input{width:auto;margin:0;flex:none;accent-color:var(--acc-2,#1d4ed8)}#view-g5 .g5-mfp label.g5-mfr span{flex:1;text-align:left}
#view-g5 .g5-mff{display:flex;justify-content:flex-end}
#view-g5 .g5-i{color:#2563eb;font-weight:700;font-size:11px;cursor:help;margin-left:2px}#view-g5 .g5-bar{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end;margin:6px 0 10px}#view-g5 .g5-bar label{display:flex;flex-direction:column;font-size:11.5px;color:var(--gray-600);gap:2px}#view-g5 .g5-sp{flex:1}
#view-g5 .g5-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}#view-g5 .g5-tabs button,#view-g5 .g5-seg button,#view-g5 .g5-dt button{border:1px solid var(--border);background:var(--card);color:inherit;border-radius:999px;padding:6px 13px;font-size:13px;cursor:pointer}#view-g5 .g5-tabs button.on,#view-g5 .g5-seg button.on{background:var(--brand,#1e3a8a);color:#fff;border-color:var(--brand,#1e3a8a)}
#view-g5 .g5-seg{display:inline-flex;gap:4px}#view-g5 .g5-dt{display:inline-flex;gap:4px;align-items:center}#view-g5 .g5-dt button{padding:5px 10px;border-radius:8px}
#view-g5 .g5-wrap{overflow:auto;border:1px solid var(--border);border-radius:12px;max-height:70vh}#view-g5 .g5-t{border-collapse:collapse;width:100%;font-size:13px}#view-g5 .g5-t th{position:sticky;top:0;background:var(--gray-100,#f1f5f9);text-align:left;padding:7px 9px;white-space:nowrap;z-index:1}#view-g5 .g5-t td{padding:5px 9px;border-top:1px solid var(--border);white-space:nowrap}#view-g5 .g5-t .c{text-align:center}#view-g5 .g5-t .n{text-align:right;font-variant-numeric:tabular-nums}
#view-g5 .g5-sub th{top:31px;font-weight:500;font-size:11px;color:var(--gray-600)}#view-g5 .g5-gh td{background:var(--gray-50,#f8fafc);font-weight:700;padding:8px 9px}#view-g5 .g5-t tfoot td{position:sticky;bottom:0;z-index:1}#view-g5 .g5-tot td{background:rgba(14,165,233,.08);font-weight:700}#view-g5 .g5-prev{color:var(--gray-500);font-size:12px}
#view-g5 .g5-ent input[type=number]{width:110px;text-align:right;font-size:14px;padding:5px 7px}#view-g5 .g5-tg{font-size:10px;background:#e0f2fe;color:#075985;border-radius:6px;padding:1px 5px}
#view-g5 .g5-pill{display:inline-block;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:700;background:#e5e7eb;color:#374151}#view-g5 .g5-pill.g{background:#dcfce7;color:#166534}#view-g5 .g5-pill.o{background:#fef3c7;color:#92400e}#view-g5 .g5-pill.b{background:#dbeafe;color:#1e40af}
#view-g5 .g5-foot{display:flex;gap:10px;align-items:center;margin-top:10px}#view-g5 .g5-hint,#view-g5 .g5-note{font-size:12px;color:var(--gray-600)}#view-g5 .g5-warn{background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:9px 12px;margin:8px 0;font-size:13px}#view-g5 .g5-none{padding:14px;opacity:.65;text-align:center}
#view-g5 .g5-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin:6px 0 12px}#view-g5 .g5-k{border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--card)}#view-g5 .g5-k .t{font-size:11.5px;color:var(--gray-600)}#view-g5 .g5-k .v{font-size:24px;font-weight:800;margin-top:2px}#view-g5 .g5-k .s{font-size:11px;color:var(--gray-500)}#view-g5 .g5-k.r{border-color:#fca5a5;background:rgba(239,68,68,.06)}#view-g5 .g5-k.o{border-color:#fcd34d;background:rgba(245,158,11,.07)}#view-g5 .g5-k.g{border-color:#86efac;background:rgba(34,197,94,.06)}
#view-g5 .g5-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:12px}#view-g5 .g5-c{border:1px solid var(--border);border-radius:14px;padding:10px 14px;background:var(--card)}#view-g5 .g5-c h4{margin:0 0 6px;font-size:14px}#view-g5 .g5-svg{width:100%;height:auto}#view-g5 .g5-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px}#view-g5 .g5-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
#view-g5 .g5-ul{margin:4px 0 0 18px;padding:0;font-size:13.5px;line-height:1.6}#view-g5 .g5-b{font-weight:800}#view-g5 .g5-bad{color:#b91c1c;font-weight:700}#view-g5 .g5-go{cursor:pointer}#view-g5 .g5-go:hover{background:var(--gray-100,#f1f5f9)}#view-g5 .g5-S{color:#16a34a;font-weight:800}#view-g5 .g5-D{color:#d97706;font-weight:800}#view-g5 .g5-M{color:#dc2626;font-weight:800}
body.dark #view-g5 .g5-t th{background:#2a2540}body.dark #view-g5 .g5-gh td{background:#241f38}`;
    document.head.appendChild(s);
  }
  function mount() {
    if (!Q('#g5Card')) { const ex = Q('#view-g5'), d = ex || document.createElement('div'); if (!ex) { d.className = 'view'; d.id = 'view-g5'; }
      d.innerHTML = `<div class="card" id="g5Card" data-nohc data-noct><div class="card-header"><div class="card-title">🫙 5 Gallon <span class="text-sm" style="font-weight:400;">— daily bottles data of the DC's and the Plant · entry and analysis</span></div><div class="btn-row"><button class="secondary small" type="button" data-go="refresh">🔄 Refresh</button><span id="g5Exp"><button class="secondary small" type="button" data-go="print">🖨 Print</button><button class="secondary small" type="button" data-go="excel">📊 Excel</button><button class="secondary small" type="button" data-go="mail">📧 Email</button></span></div></div><div id="g5Status" class="status-msg" style="font-size:12px;margin-bottom:6px"></div><div class="g5-tabs" id="g5Tabs"></div><div id="g5Body"></div></div>`;
      if (!ex) { const ref = Q('#view-aem') || Q('#view-att'); if (ref) ref.insertAdjacentElement('afterend', d); else document.body.appendChild(d); } }
    try { VIEW_META.g5 = { title: '5 Gallon', sub: 'Daily bottles data of the DC’s and the Plant — entry and analysis' }; } catch (e) { }
    try { const el = Q('.nav-item[data-view="g5"]'); if (el && typeof navOrig !== 'undefined' && navOrig && !navMeta.g5) { navMeta.g5 = { el, name: '5 Gallon' }; const g = navOrig.groups.find(x => x.items.includes('dailytracker')) || navOrig.groups.find(x => /^warehouse$/i.test(x.name)) || navOrig.groups[navOrig.groups.length - 1]; if (g && !g.items.includes('g5')) g.items.push('g5'); navApply(true); } } catch (e) { }
    const nav = Q('.nav-item[data-view="g5"]'); if (nav && !nav._fe) { nav._fe = 1; nav.addEventListener('click', () => init()); }
  }
  function init() {
    const v = Q('#view-g5'); if (!v) return; css();
    if (!v._i) { v._i = 1;
      v.addEventListener('dblclick', e => { const r = e.target.closest('tr[data-pds],tr[data-pdm]'); if (!r || !r.closest('#g5Body')) return; try { getSelection().removeAllRanges(); } catch (x) { } if (r.dataset.pds) { const [g, mi, ...st] = r.dataset.pds.split('|'); pdcSource(g, +mi, st.join('|')); } else { const [g, mi] = r.dataset.pdm.split('|'); pdcSource(g, +mi, ''); } });
      v.addEventListener('click', e => { const t = e.target.closest('[data-g5t],[data-go],[data-et],[data-ed],[data-eact],[data-pre],[data-rt],[data-site],[data-bsx],[data-bsg],[data-bsm],[data-pdg],[data-pdx],[data-pdk],[data-mf],[data-pkc],[data-pkx]'); if (!t) { if (E.mfo && !e.target.closest('.g5-mf')) { E.mfo = false; render(); } return; } const d = t.dataset;
        if (d.pkx !== undefined) { e.stopPropagation(); const all = mfAll(), cur = mfSel().length ? mfSel().filter(x => x !== '__none__') : all.slice(); E.mf[E.tab] = cur.filter(x => x !== d.pkx).length ? cur.filter(x => x !== d.pkx) : ['__none__']; return render(); }
        if (d.pkc !== undefined) { if (e.target.closest('.g5-i')) return; const [g, mi] = d.pkc.split('|'); return pdcSource(g, +mi, ''); }
        if (d.mf !== undefined) { if (d.mf === 'toggle') E.mfo = !E.mfo; else if (d.mf === 'close') E.mfo = false; else if (d.mf === 'all') E.mf[E.tab] = []; else if (d.mf === 'none') E.mf[E.tab] = ['__none__']; return render(); }
        if (d.pdk !== undefined) { if (d.pdk === 'all') { const hide = !(E.kh.p && E.kh.d); E.kh = { p: hide, d: hide }; } else E.kh[d.pdk] = !E.kh[d.pdk]; try { localStorage.setItem('orbit_g5_kh', JSON.stringify(E.kh)); } catch (x) { } return render(); }
        if (d.pdx !== undefined) { if (d.pdx === 'close') pdcData().tot.forEach(g => g.m.forEach((m, i) => E.pd.closed.add(g.id + i))); else E.pd.closed.clear(); return render(); }
        if (d.pdg !== undefined) { E.pd.closed.has(d.pdg) ? E.pd.closed.delete(d.pdg) : E.pd.closed.add(d.pdg); return render(); }
        if (d.g5t) { E.tab = d.g5t; return render(); }
        if (d.et) { E.ent.type = d.et; const st = sitesOf(d.et); E.ent.site = st.length ? st[0].name : ''; loadEntry(); return render(); }
        if (d.ed) { E.ent.date = addD(E.ent.date, +d.ed); if (E.ent.date > today()) E.ent.date = today(); return ensureDate(); }
        if (d.eact) { const e0 = E.ent, T = TT[e0.type];
          if (d.eact === 'zero') { BR.forEach(b => T.all.forEach(k => { if (e0.vals[b][k] === '') e0.vals[b][k] = '0'; })); return render(); }
          if (d.eact === 'copyst') { BR.forEach(b => { const p = e0.prev[b]; if (!p) return; T.groups.forEach(g => g.items.forEach(i => { if (i.t === 'stock' && p.v[i.k] != null) e0.vals[b][i.k] = String(p.v[i.k]); })); }); return render(); }
          if (d.eact === 'save') return entSave(null); if (d.eact === 'submit') return entSave('Submitted'); if (d.eact === 'lock') return entLock(); if (d.eact === 'unlock') return entUnlock(); }
        if (d.pre) { const to = today(); E.f.to = to; E.f.from = d.pre === 'mtd' ? to.slice(0, 8) + '01' : addD(to, -(+d.pre)); const dt = E.f.from < E.from; return dt ? loadData(true, E.f.from).then(render) : render(); }
        if (d.rt) { E.rec.type = d.rt; return render(); }
        if (d.site && t.dataset.stype) { E.ent.type = d.stype; E.ent.site = d.site; if (d.date) E.ent.date = d.date; E.tab = 'entry'; return ensureDate(); }
        { const bx = d.bsx !== undefined ? t : null, bg = d.bsg !== undefined ? t : null; if (bx) { if (bx.dataset.bsx === 'close') bsTree().groups.forEach(g => E.bs.closed.add(g.l)); else E.bs.closed.clear(); return render(); } if (bg) { const l = bg.dataset.bsg; E.bs.closed.has(l) ? E.bs.closed.delete(l) : E.bs.closed.add(l); return render(); } }
        if (d.go === 'refresh') { E.loaded = false; render(); return loadData(true); }
        if (d.go === 'print' || d.go === 'excel' || d.go === 'mail') { const r = report(); if (d.go === 'print') return a2Print(r); if (E.tab === 'bsite' && d.go === 'mail') { window.extMailData = () => Object.assign({}, r, { html: bsEmailHtml(), raw: true }); return wMail_open('ext'); } if (d.go === 'excel') return a2Export(r); window.extMailData = () => r; wMail_open('ext'); } });
      v.addEventListener('change', e => { const t = e.target, d = t.dataset;
        if (d.mfc !== undefined) { const all = mfAll(), st = mfSel(), cur = !st.length ? all.slice() : st.filter(x => x !== '__none__'), i = cur.indexOf(d.mfc); if (t.checked && i < 0) cur.push(d.mfc); if (!t.checked && i >= 0) cur.splice(i, 1); E.mf[E.tab] = cur.length === all.length ? [] : !cur.length ? ['__none__'] : all.filter(x => cur.includes(x)); const q = (document.querySelector('#view-g5 [data-mfq]') || {}).value || ''; const sc = (document.querySelector('#view-g5 .g5-mfl') || {}).scrollTop || 0; render(); const qi = document.querySelector('#view-g5 [data-mfq]'); if (qi && q) { qi.value = q; mfSearch(q); } const ll = document.querySelector('#view-g5 .g5-mfl'); if (ll) ll.scrollTop = sc; return; }
        if (d.es !== undefined) { E.ent.site = t.value; loadEntry(); return render(); }
        if (d.edate !== undefined) { const x = nd(t.value); if (x) { E.ent.date = x > today() ? today() : x; ensureDate(); } return; }
        if (d.fd) { const x = nd(t.value); if (x === null) return; E.f[d.fd] = x; const need = x && d.fd === 'from' && x < E.from; return need ? loadData(true, x).then(render) : render(); }
        if (d.ff) { E.f[d.ff] = t.value; return render(); }
        if (d.trz !== undefined) { E.tr.z = +t.value || 2; return render(); }
        if (d.tol !== undefined) { E.tol = Math.max(0, +t.value || 0); return render(); } });
      v.addEventListener('input', e => { const t = e.target, d = t.dataset; if (d.mfq !== undefined) return mfSearch(t.value);
        if (d.gi) { const [b, k] = d.gi.split('|'); E.ent.vals[b][k] = t.value; E.ent.dirty = true; return refreshTotals(); }
        if (d.rq !== undefined) { E.rec.q = t.value; const pos = t.selectionStart; render(); const n = Q('#view-g5 [data-rq]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } } });
    }
    if (!E.loaded && !E.loading) loadData(false); else render();
  }
  async function ensureDate() { const d = E.ent.date; if (d < E.from) { await loadData(true, addD(d, -5)); } loadEntry(); render(); }

  /* ============================================================ PHONE ============================================================ */
  function mobile() {
    const K = window.MOBXK; if (!K) return;
    const { A, reg, need, user, put, patch, saved, fail, H, toast, me, drop } = K;
    const LD = { dc: [T_DC.list, ['Entry_Date', 'ge', addD(today(), -45) + 'T00:00:00Z']], pl: [T_PL.list, ['Entry_Date', 'ge', addD(today(), -45) + 'T00:00:00Z']], st: [L_SITES] };
    const rows = (d, T) => (d[T.id === 'DC' ? 'dc' : 'pl'] || []).map(r => rowFrom(T, r, r.id)).filter(r => r.date && r.site && r.brand);
    const sites = (d, type) => { const L = (d.st || []).map(r => ({ name: str(r.title), type: /plant/i.test(str(r.sitetype)) ? 'Plant' : 'DC', loc: str(r.locationid), active: !/^(no|false|0)$/i.test(str(r.active)), sort: r.sortorder === '' || r.sortorder == null ? 999 : num(r.sortorder) })).filter(s => s.name && s.type === type && s.active);
      rows(d, TT[type]).forEach(r => { if (!L.some(s => s.name === r.site)) L.push({ name: r.site, type, loc: '', sort: 999 }); }); return L.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name)); };
    const gk = (b, k) => 'g5|' + b + '|' + k;
    const fill = (v, d) => { const T = TT[v.g5t || 'DC'], rs = rows(d, T); BR.forEach(b => { const r = rs.find(x => x.site === v.g5s && x.brand === b && x.date === v.g5d); T.all.forEach(k => { v[gk(b, k)] = r && r.v[k] != null ? String(r.v[k]) : ''; }); }); v._g5r = rs; };
    const init0 = (v, d) => { if (!v.g5t) v.g5t = 'DC'; if (!v.g5d) v.g5d = today(); const st = sites(d, v.g5t); if (!v.g5s || !st.some(s => s.name === v.g5s)) v.g5s = st.length ? st[0].name : ''; };
    const exist = (v, b) => (v._g5r || []).find(x => x.site === v.g5s && x.brand === b && x.date === v.g5d);
    const tot = (g, v, b) => (g.tot[1] || g.items.map(i => i.k)).reduce((s, k) => s + num(v[gk(b, k)]), 0);
    const css0 = document.createElement('style'); css0.textContent = '.g5r{display:grid;grid-template-columns:1fr 78px 78px 78px;gap:6px;align-items:center;padding:7px 0;border-top:1px solid var(--line,#e2e8f0)}.g5r .l{font-size:13.5px;line-height:1.2}.g5r .l small{display:block;color:var(--mut,#64748b);font-size:11px}.g5r input{width:100%;height:46px;text-align:right;font-size:16px;padding:0 6px;font-weight:700;border-radius:12px;padding:0 10px}.g5h{display:grid;grid-template-columns:1fr 78px 78px 78px;gap:6px;font-size:12px;font-weight:800;text-align:right}.g5h span:first-child{text-align:left}.g5t{display:grid;grid-template-columns:1fr 78px 78px 78px;gap:6px;padding:8px 0 2px;border-top:2px solid var(--line,#e2e8f0);font-weight:800;text-align:right}.g5t span:first-child{text-align:left}.g5o{color:#0ea5e9}.g5a{color:#14b8a6}.g5z{color:#8b5cf6}'; document.head.appendChild(css0);
    document.addEventListener('input', e => { const t = e.target; if (!t.dataset || !t.dataset.g5 || !Q('#mob')) return; const v = A().S.v, T = TT[v.g5t || 'DC']; T.groups.forEach((g, gi) => { if (!g.tot) return; BR.forEach(b => { const c = Q(`#mob [data-g5t="${gi}|${b}"]`); if (c) c.textContent = f0(tot(g, v, b)); }); }); });
    reg('x_g5in', { lists: LD, load(v, f) { v._g5sig = ''; need('x_g5in', LD, f); },
      onChange(k, val, v, d) { if (k === 'g5d') { if (val > today()) v.g5d = today(); if (val < addD(today(), -44)) { toast('Older than 45 days — enter it from the web page.', 'warn'); v.g5d = today(); } } },
      view(v, d) {
        const sg0 = v.g5t + '|' + v.g5s + '|' + v.g5d; if (v.g5t !== v._g5t0) { v.g5s = ''; v._g5t0 = v.g5t; } init0(v, d); const sg = v.g5t + '|' + v.g5s + '|' + v.g5d; if (v._g5sig !== sg) { fill(v, d); v._g5sig = sg; } const T = TT[v.g5t], st = sites(d, v.g5t), stt = (() => { const r = BR.map(b => exist(v, b)).filter(Boolean); return !r.length ? 'New' : r.every(x => /locked/i.test(x.status)) ? 'Locked' : r.length === BR.length && r.every(sub) ? 'Submitted' : 'Draft'; })(), hard = BR.some(b => { const x = exist(v, b); return x && /locked/i.test(x.status); }), auto = autoLocked(v.g5d), locked = (hard || auto) && !canLockDay(), hasR = BR.some(b => exist(v, b));
        let h = H.head('🫙', '5 Gallon — daily entry', "DC's and Plant bottles", '#0891b2') + H.load(d)
          + H.card('', `<div class="mb-seg">${['DC', 'Plant'].map(t => `<button type="button" data-x="set" data-k="g5t" data-val="${t}" class="${v.g5t === t ? 'on' : ''}">${t === 'DC' ? "🏬 DC's" : '🏭 Plant'}</button>`).join('')}</div>`
            + `<div class="mb-row">${H.f('Site', H.sel('g5s', st.map(s => s.name), { ph: false }))}${H.f('Date', H.date('g5d', { val: v.g5d, r: 1 }))}</div><div>${H.pill((stt !== 'Locked' && auto && stt !== 'New' ? 'Locked (auto)' : stt), stt === 'Submitted' ? 'g' : stt === 'Draft' ? 'o' : /Locked/.test(stt) || auto ? '' : '')}</div>`);
        if (!st.length) return h + H.card('', '<div class="mb-hint mb-bad">No site found — add the sites in the SharePoint list Bottle_Sites_tbl.</div>');
        const prev = b => { const rs = (v._g5r || []).filter(x => x.site === v.g5s && x.brand === b && x.date < v.g5d).sort((a, c) => c.date.localeCompare(a.date)); return rs[0] || null; };
        T.groups.forEach((g, gi) => {
          let body = `<div class="g5h"><span></span><span class="g5o">Oasis</span><span class="g5a">Aqua</span><span class="g5z">Oasis Zero</span></div>`;
          g.items.forEach(i => { const pv = BR.map(prev), hint = i.t === 'stock' && (pv[0] || pv[1]) ? `yesterday ${pv[0] && pv[0].v[i.k] != null ? f0(pv[0].v[i.k]) : '–'} · ${pv[1] && pv[1].v[i.k] != null ? f0(pv[1].v[i.k]) : '–'}` : '';
            body += `<div class="g5r"><span class="l">${esc(i.l)}${hint ? `<small>${hint}</small>` : ''}</span>${BR.map(b => `<input data-v="${gk(b, i.k)}" data-g5="1" type="number" inputmode="numeric" min="0" step="1" value="${esc(v[gk(b, i.k)] == null ? '' : v[gk(b, i.k)])}"${locked ? ' disabled' : ''} placeholder="–">`).join('')}</div>`; });
          if (g.tot) body += `<div class="g5t"><span>${esc(g.tot[0])}</span>${BR.map(b => `<span data-g5t="${gi}|${b}">${f0(tot(g, v, b))}</span>`).join('')}</div>`;
          h += H.card(g.ic + ' ' + esc(g.t), body);
        });
        return h + H.bar((locked ? `<div class="mb-hint">🔒 This day is locked${auto && !hard ? ' (closed ' + AUTO_LOCK_H + ' h after the day)' : ''}.</div>` : `<div class="mb-row">${H.btn('💾 Save draft', 'g5save', 's')}${H.btn('✔ Submit', 'g5sub', 'p')}</div>`) + (canLockDay() && hasR ? `<div class="mb-row">${hard ? H.btn('🔓 Unlock day', 'g5unlock', 's') : H.btn('🔒 Lock day', 'g5lock', 's')}</div>` : '')); },
      act: {
        async g5save(t, v, d) { return doSave(v, d, null); }, async g5sub(t, v, d) { return doSave(v, d, 'Submitted'); },
        async g5lock(t, v, d) { return setSt(v, 'Locked'); }, async g5unlock(t, v, d) { return setSt(v, 'Submitted'); } } });
    async function setSt(v, st) { if (!canLockDay()) return toast('Only an admin can lock or unlock a day.', 'warn'); if (st === 'Locked' && !confirm('Lock ' + v.g5s + ' for ' + dmy(v.g5d) + '?')) return; const T = TT[v.g5t]; try { let n = 0; for (const b of BR) { const old = exist(v, b); if (old) { await patch(T.list, old.id, { Status: st }, '5G ' + v.g5s + ' ' + b); n++; } } saved({ queued: false }, '5 Gallon ' + v.g5s + ' ' + dmy(v.g5d) + (st === 'Locked' ? ' locked' : ' unlocked')); drop(T.list); const d2 = await need('x_g5in', LD, true); init0(v, d2); fill(v, d2); v._g5sig = v.g5t + '|' + v.g5s + '|' + v.g5d; A().render && A().render(); } catch (e) { fail('5 Gallon lock', e); } }
    async function doSave(v, d, status) {
      const T = TT[v.g5t], u = await user(), loc = (sites(d, v.g5t).find(s => s.name === v.g5s) || {}).loc || u.loc || ''; if (!v.g5s) return toast('Choose the site.', 'warn'); if ((autoLocked(v.g5d) || BR.some(b => { const x = exist(v, b); return x && /locked/i.test(x.status); })) && !canLockDay()) return toast('This day is locked.', 'warn');
      const blanks = BR.reduce((n, b) => n + T.all.filter(k => v[gk(b, k)] === '' || v[gk(b, k)] == null).length, 0);
      if (status === 'Submitted' && blanks && !confirm(blanks + ' field(s) are blank (= not entered). Submit anyway?')) return;
      try { let n = 0; for (const b of BR) { const vals = {}; T.all.forEach(k => { vals[k] = v[gk(b, k)]; }); const any = T.all.some(k => vals[k] !== '' && vals[k] != null), old = exist(v, b); if (!any && !old) continue;
          const F = buildFields(T, vals, v.g5d, v.g5s, b, status || (old ? old.status : 'Draft'), me(), loc, null);
          if (old) { T.all.forEach(k => { if ((vals[k] === '' || vals[k] == null) && old.v[k] != null) F[k] = null; }); await patch(T.list, old.id, F, '5G ' + v.g5s + ' ' + b); } else await put(T.list, F, '5G ' + v.g5s + ' ' + b); n++; }
        saved({ queued: false }, '5 Gallon ' + v.g5s + ' ' + dmy(v.g5d) + (status ? ' submitted' : ' draft') + ' (' + n + ' row(s))'); drop(T.list); const d2 = await need('x_g5in', LD, true); init0(v, d2); fill(v, d2); v._g5sig = v.g5t + '|' + v.g5s + '|' + v.g5d; A().render && A().render();
      } catch (e) { fail('5 Gallon entry', e); } }
    /* day summary */
    reg('x_g5day', { lists: LD, load(v, f) { if (!v.g5dd) v.g5dd = today(); need('x_g5day', LD, f); },
      view(v, d) { const day = v.g5dd || today(); let h = H.head('📋', '5 Gallon — day status', 'Who has submitted · totals', '#0e7490') + H.load(d) + `<div style="margin-bottom:10px">${H.date('g5dd', { val: day, r: 1 })}</div>`;
        const items = [];['DC', 'Plant'].forEach(type => sites(d, type).forEach(s => { const rs = rows(d, TT[type]).filter(r => r.site === s.name && r.date === day), st = rs.length >= BR.length && rs.every(sub) ? 'Submitted' : rs.length ? 'Draft' : 'Missing', m = rs.reduce((a, r) => { const x = type === 'DC' ? mDC(r.v) : mPL(r.v); return { fg: a.fg + (type === 'DC' ? x.recv : x.prod), rel: a.rel + x.rel, st: a.st + x.stock, es: a.es + x.eS }; }, { fg: 0, rel: 0, st: 0, es: 0 }); items.push({ type, s, rs, st, m }); }));
        h += H.kpis([['Submitted', items.filter(x => x.st === 'Submitted').length, 'g'], ['Draft', items.filter(x => x.st === 'Draft').length, 'o'], ['Missing', items.filter(x => x.st === 'Missing').length, 'r']]);
        return h + H.card('', items.map(x => H.li({ x: 'g5open', i: x.type + '|' + x.s.name, ic: x.type === 'DC' ? '🏬' : '🏭', c: x.st === 'Submitted' ? '#16a34a' : x.st === 'Draft' ? '#d97706' : '#dc2626', t: x.s.name, s: x.rs.length ? 'FG in ' + f0(x.m.fg) + ' · released ' + f0(x.m.rel) + ' · FG stock ' + f0(x.m.st) + ' · EMP stock ' + f0(x.m.es) : 'Nothing entered', p: [x.st === 'Submitted' ? 'g' : x.st === 'Draft' ? 'o' : 'r', x.st] })).join('') || H.empty('No sites.')); },
      act: { g5open(t, v, d) { const [type, site] = t.dataset.i.split('|'); const day = v.g5dd || today(); A().go('x_g5in'); const V = A().S.v; V.g5t = type; V._g5t0 = type; V.g5s = site; V.g5d = day; V._g5sig = ''; A().render && A().render(); } } });
    /* stock position */
    reg('x_g5stock', { lists: LD, load(v, f) { need('x_g5stock', LD, f); },
      view(v, d) { const to = today(); let h = H.head('📦', '5 Gallon — stock position', 'Latest stock in hand of every site', '#0f766e') + H.load(d); const ls = [], lp = [];
        ['DC', 'Plant'].forEach(type => { const arr = latestStock(rows(d, TT[type]), to, type === 'DC' ? mDC : mPL); (type === 'DC' ? ls : lp).push(...arr); });
        h += H.kpis([['FG stock', f0(ls.reduce((s, x) => s + x.stock, 0) + lp.reduce((s, x) => s + x.stock, 0))], ['EMP stock', f0(ls.reduce((s, x) => s + x.eS, 0) + lp.reduce((s, x) => s + x.eS, 0))], ['Plant QC hold', f0(lp.reduce((s, x) => s + x.qc, 0)), 'o']]);
        const by = new Map(); [...ls, ...lp].forEach(x => { const k = x.r.type + '|' + x.r.site, o = by.get(k) || { type: x.r.type, site: x.r.site, fg: 0, es: 0, last: '' }; o.fg += x.stock; o.es += x.eS; if (x.r.date > o.last) o.last = x.r.date; by.set(k, o); });
        return h + H.card('', [...by.values()].sort((a, b) => a.type < b.type ? 1 : a.site.localeCompare(b.site)).map(o => H.li({ ic: o.type === 'DC' ? '🏬' : '🏭', c: '#0f766e', t: o.site, s: 'as of ' + dmy(o.last), v: 'FG ' + f0(o.fg) + ' · EMP ' + f0(o.es) })).join('') || H.empty('No data yet.')); } });
    /* menu */
    try { const M = A(); if (M.GROUPS && !M.GROUPS.some(g => g[0] === '5 Gallon')) { M.GROUPS.splice(M.GROUPS.length - 1, 0, ['5 Gallon', '🫙', '#22d3ee', '#0e7490', [['x_g5in', '📝', 'Daily entry', "DC's & Plant bottles — Oasis | Aqua", '#22d3ee', '#0e7490'], ['x_g5day', '📋', 'Day status', 'Who has submitted · totals', '#34d399', '#047857'], ['x_g5stock', '📦', 'Stock position', 'Latest FG & EMP stock', '#60a5fa', '#1d4ed8']]]);
        if (M.ALL) { M.ALL.length = 0; M.GROUPS.forEach((g, gi) => g[4].forEach(it => M.ALL.push({ k: it[0], ic: it[1], t: it[2], sub: it[3], a: it[4], b: it[5], g: gi }))); } } } catch (e) { console.error(e); }
  }

  /* ---------------- start ---------------- */
  function boot() { mount(); mobile(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.G5 = { pdcReport, rowFrom, spDay, bsReport, E, T: TT, rowFrom, buildFields, mDC, mPL, compute, flowData, latestStock, load: loadData, render, bsEmailHtml, bsTree };
})();
