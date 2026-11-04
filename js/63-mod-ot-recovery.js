/* ============================================================
   OT APPROVED vs RECOVERED — OT_Approval_Hdr_tbl · OT_Approval_tbl · OT_Staff_List_Data_tbl · OT_Staff_List_Data_Update_tbl
   approved OT hours per location and in-charge, the hours given back as days off (claimed by the in-charge / verified),
   the balance still open, and the same by staff name + the day-off log
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = escapeHtml, LS = { hdr: 'OT_Approval_Hdr_tbl', ln: 'OT_Approval_tbl', st: 'OT_Staff_List_Data_tbl', up: 'OT_Staff_List_Data_Update_tbl' };
  const nz = x => String(x || '').toLowerCase().replace(/_x0020_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dmy = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return d + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y; };
  const h1 = v => { const n = Math.round((+v || 0) * 100) / 100; return n ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ''; };
  const now = new Date(), S = { loaded: false, loading: false, err: '', tab: 'loc', D: { hdr: [], ln: [], st: [], up: [] },
    f: { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(now), loc: '', mgr: '', q: '', status: 'appr', open: false } };
  const say = (t, w) => { const e = Q('#otrStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };
  const rec = it => { const f = it.fields || {}, K = {}; Object.keys(f).forEach(k => { K[nz(k)] = f[k]; }); K.id = +it.id; return K; };
  const num = v => { const n = +String(v == null ? '' : v).replace(/[,\s]/g, ''); return isFinite(n) ? n : 0; };
  const dt = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : ymd(d); };

  async function load(force) {
    if (S.loading || (S.loaded && !force)) return; S.loading = true; S.err = ''; render();
    try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first (no token / Site URL)');
      for (const k of Object.keys(LS)) { say('Reading ' + LS[k] + '…'); const ids = await resolveIds(site, LS[k], token), it = await fetchAllItems(ids.siteId, ids.listId, token, n => say('Reading ' + LS[k] + '… ' + n)); S.D[k] = it.map(rec); }
      const mine = (typeof locScoped === 'function' && locScoped()) ? new Set(locIds(currentUser).map(x => String(+x))) : null;
      if (mine) { const ok = v => mine.has(String(+v)); S.D.st = S.D.st.filter(r => ok(r.locationid)); S.D.up = S.D.up.filter(r => ok(r.locationid)); S.D.hdr = S.D.hdr.filter(r => ok(r.locationlink)); }
      S.loaded = true; say('✔ ' + S.D.st.length + ' staff OT line(s) · ' + S.D.hdr.length + ' request(s) · ' + S.D.up.length + ' day-off update(s) · ' + new Date().toLocaleTimeString());
    } catch (e) { S.err = e.message; say('⚠ ' + e.message, 1); } finally { S.loading = false; } render();
  }

  /* ---------- model ---------- */
  const hdrBy = () => { const m = new Map(); S.D.hdr.forEach(h => m.set(h.id, h)); return m; };
  const apprOk = st => /approv|actual/i.test(st || '');
  function staffRows() {
    const H = hdrBy(), q = S.f.q.toLowerCase();
    return S.D.st.map(r => { const h = H.get(num(r.headerlink)) || {}, status = h.approvalstatus || '';
      return { id: r.id, date: dt(r.otworkdate), file: String(r.stafffilenr || '').trim(), name: String(r.staffname || '').trim(), title: String(r.staftitle || '').trim(), loc: String(r.whsdesc || h.whsdesc || '').trim(), locId: r.locationid,
        mgr: String(r.stafflinemngr || '').trim() || String(h.username || '').trim(), status, hdr: num(r.headerlink), ot: num(r.othours), taken: num(r.takenrplcmnthours), ver: num(r.approvedtknhrs), off: dt(r.rplcddaydate), offSt: String(r.rplcddaystatus || ''), otType: h.ottype || '' }; })
      .filter(r => (!r.date || (r.date >= S.f.from && r.date <= S.f.to)) && (S.f.status === 'all' || apprOk(r.status) || !r.status) && (!S.f.loc || r.loc === S.f.loc) && (!S.f.mgr || r.mgr === S.f.mgr) && (!q || (r.name + ' ' + r.file).toLowerCase().includes(q)))
      .map(r => Object.assign(r, { pend: Math.max(0, r.taken - r.ver), bal: Math.max(0, r.ot - r.ver) }))
      .filter(r => !S.f.open || r.bal > 0);
  }
  const agg = (R, key) => { const m = new Map(); R.forEach(r => { const k = key(r); let a = m.get(k); if (!a) m.set(k, a = { k, staff: new Set(), days: 0, ot: 0, taken: 0, ver: 0, pend: 0, bal: 0, rows: [] }); a.staff.add(r.file || r.name); a.days++; a.ot += r.ot; a.taken += r.taken; a.ver += r.ver; a.pend += r.pend; a.bal += r.bal; a.rows.push(r); }); return [...m.values()]; };
  const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
  const bar = (p, c) => `<div class="otr-bar"><i style="width:${Math.min(100, p)}%;background:${c || (p >= 80 ? '#16a34a' : p >= 40 ? '#f59e0b' : '#dc2626')}"></i><span>${p}%</span></div>`;

  /* ---------- views ---------- */
  function kpis(R) { const ot = R.reduce((a, r) => a + r.ot, 0), tk = R.reduce((a, r) => a + r.taken, 0), vr = R.reduce((a, r) => a + r.ver, 0), K = (t, v, s) => `<div class="otr-k"><span>${t}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
    return `<div class="otr-kpis">${K('Approved OT hours', h1(ot) || 0, new Set(R.map(r => r.file || r.name)).size + ' staff · ' + R.length + ' OT day(s)')}${K('Given back as day off', h1(tk) || 0, 'claimed by the in-charge')}${K('Verified day-off hours', h1(vr) || 0, h1(Math.max(0, tk - vr)) ? h1(Math.max(0, tk - vr)) + ' h waiting for verification' : 'all verified')}${K('Open balance (to be paid / recovered)', h1(Math.max(0, ot - vr)) || 0)}${K('Recovery rate', pct(vr, ot) + '%', 'verified ÷ approved')}</div>`; }
  const TH = '<th class="n">Staff</th><th class="n">OT days</th><th class="n">Approved OT h</th><th class="n">Day off given h</th><th class="n">Verified h</th><th class="n">Waiting verify h</th><th class="n">Open balance h</th><th style="min-width:150px">Recovered</th>';
  const TD = a => `<td class="n">${a.staff.size}</td><td class="n">${a.days}</td><td class="n"><b>${h1(a.ot)}</b></td><td class="n">${h1(a.taken)}</td><td class="n">${h1(a.ver)}</td><td class="n">${h1(a.pend)}</td><td class="n"><b>${h1(a.bal)}</b></td><td>${bar(pct(a.ver, a.ot))}</td>`;
  function byLoc(R) {
    const L = agg(R, r => r.loc || '(no location)').sort((a, b) => b.ot - a.ot);
    return `<div class="otr-wrap"><table class="otr-t"><thead><tr><th>Location</th><th>In-charge (line manager)</th>${TH}</tr></thead><tbody>${L.map(l => { const M = agg(l.rows, r => r.mgr || '(not set)').sort((a, b) => b.ot - a.ot);
      return `<tr class="otr-g"><td colspan="2"><b>📍 ${esc(l.k)}</b></td>${TD(l)}</tr>` + M.map(m => `<tr><td></td><td><a href="#" data-mgr="${esc(m.k)}" title="Show this in-charge's staff">${esc(m.k)}</a></td>${TD(m)}</tr>`).join(''); }).join('') || '<tr><td colspan="10" class="otr-hint">Nothing for this selection.</td></tr>'}</tbody>
      ${L.length ? `<tfoot><tr><td colspan="2"><b>Total</b></td>${TD(agg(R, () => 'all')[0])}</tr></tfoot>` : ''}</table></div>`; }
  function byStaff(R) {
    const L = agg(R, r => (r.file || '') + '|' + r.name).sort((a, b) => b.bal - a.bal || b.ot - a.ot);
    return `<div class="otr-wrap"><table class="otr-t"><thead><tr><th>Staff name</th><th>File no.</th><th>Title</th><th>Location</th><th>In-charge</th><th class="n">OT days</th><th class="n">Approved OT h</th><th class="n">Day off given h</th><th class="n">Verified h</th><th class="n">Waiting verify h</th><th class="n">Open balance h</th><th style="min-width:130px">Recovered</th><th>Last day off</th></tr></thead><tbody>
      ${L.map(a => { const r0 = a.rows[0], last = a.rows.map(r => r.off).filter(Boolean).sort().pop() || ''; return `<tr><td><a href="#" data-staff="${esc(r0.file || r0.name)}"><b>${esc(r0.name)}</b></a></td><td>${esc(r0.file)}</td><td>${esc(r0.title)}</td><td>${esc(r0.loc)}</td><td>${esc(r0.mgr)}</td><td class="n">${a.days}</td><td class="n"><b>${h1(a.ot)}</b></td><td class="n">${h1(a.taken)}</td><td class="n">${h1(a.ver)}</td><td class="n">${h1(a.pend)}</td><td class="n"><b>${h1(a.bal)}</b></td><td>${bar(pct(a.ver, a.ot))}</td><td>${esc(dmy(last))}</td></tr>`; }).join('') || '<tr><td colspan="13" class="otr-hint">Nothing for this selection.</td></tr>'}</tbody></table></div>`; }
  function days(R) {
    const L = R.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name));
    return `<div class="otr-wrap"><table class="otr-t"><thead><tr><th>OT date</th><th>Staff name</th><th>File no.</th><th>Location</th><th>In-charge</th><th>OT type</th><th>Request status</th><th class="n">Approved OT h</th><th class="n">Day off given h</th><th class="n">Verified h</th><th class="n">Open balance h</th><th>Day off on</th><th>Day-off status</th></tr></thead><tbody>
      ${L.map(r => `<tr><td>${esc(dmy(r.date))}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.file)}</td><td>${esc(r.loc)}</td><td>${esc(r.mgr)}</td><td>${esc(r.otType)}</td><td>${esc(r.status)}</td><td class="n"><b>${h1(r.ot)}</b></td><td class="n">${h1(r.taken)}</td><td class="n">${h1(r.ver)}</td><td class="n"><b>${h1(r.bal)}</b></td><td>${esc(dmy(r.off))}</td><td>${esc(r.offSt)}</td></tr>`).join('') || '<tr><td colspan="13" class="otr-hint">Nothing for this selection.</td></tr>'}</tbody></table></div>`; }
  function offLog() {
    const q = S.f.q.toLowerCase(), L = S.D.up.map(u => ({ off: dt(u.rplcddaydate), ot: dt(u.otworkdate), name: String(u.staffname || ''), file: String(u.stafffilenr || ''), loc: String(u.whsdesc || ''), mgr: String(u.stafflinemngr || ''), h: num(u.takenrplcmnthours), vs: String(u.verifyingstatus || ''), vh: num(u.verifiedtknhrs), vby: String(u.varifiedby || u.verifiedby || ''), vat: String(u.verifyingtimestamp || ''), by: String(u.updatedby || ''), st: String(u.rplcddaystatus || ''), rem: String(u.linemngrremarks || ''), vrem: String(u.verifierremarks || '') }))
      .filter(u => { const d = u.off || u.ot; return (!d || (d >= S.f.from && d <= S.f.to)) && (!S.f.loc || u.loc === S.f.loc) && (!S.f.mgr || u.mgr === S.f.mgr) && (!q || (u.name + ' ' + u.file).toLowerCase().includes(q)); }).sort((a, b) => (b.off || b.ot).localeCompare(a.off || a.ot));
    return `<div class="otr-hint">Every day off given against OT (OT_Staff_List_Data_Update_tbl) — filtered by the day-off date.</div><div class="otr-wrap"><table class="otr-t"><thead><tr><th>Day off on</th><th>For OT of</th><th>Staff name</th><th>File no.</th><th>Location</th><th>In-charge</th><th class="n">Hours given</th><th>Verification</th><th class="n">Verified h</th><th>Verified by</th><th>Entered by</th><th>Remarks</th></tr></thead><tbody>
      ${L.map(u => `<tr><td>${esc(dmy(u.off))}</td><td>${esc(dmy(u.ot))}</td><td><b>${esc(u.name)}</b></td><td>${esc(u.file)}</td><td>${esc(u.loc)}</td><td>${esc(u.mgr)}</td><td class="n"><b>${h1(u.h)}</b></td><td>${/verif|approv/i.test(u.vs) ? '<span class="otr-p g">' + esc(u.vs) + '</span>' : /not/i.test(u.vs) || !u.vs ? '<span class="otr-p o">' + esc(u.vs || 'Not yet') + '</span>' : '<span class="otr-p r">' + esc(u.vs) + '</span>'}</td><td class="n">${h1(u.vh)}</td><td>${esc(u.vby)}${u.vat ? '<br><small>' + esc(u.vat) + '</small>' : ''}</td><td>${esc(u.by)}</td><td>${esc([u.rem, u.vrem].filter(Boolean).join(' · '))}</td></tr>`).join('') || '<tr><td colspan="12" class="otr-hint">No days off in this period.</td></tr>'}</tbody></table></div>`; }
  function requests() {
    const LN = new Map(); S.D.ln.forEach(l => { const k = num(l.headerlink); const a = LN.get(k) || { req: 0, act: 0, n: 0 }; a.req += num(l.totaltothours || l.totoalothours) || num(l.totalrqrdhrs); a.act += Math.max(num(l.actualtotalwrkdhrs), num(l.actualtotalwrkdhrs0), num(l.actualtotalwrkdhrs1), num(l.actualtotalwrkdhrs2)); a.n++; LN.set(k, a); });
    const SH = new Map(); S.D.st.forEach(r => { const k = num(r.headerlink); SH.set(k, (SH.get(k) || 0) + num(r.othours)); });
    const L = S.D.hdr.map(h => ({ id: h.id, date: dt(h.requestdate), loc: String(h.whsdesc || ''), by: String(h.username || ''), type: String(h.ottype || ''), st: String(h.approvalstatus || ''), req: num(h.totalrqrdhrs), staff: num(h.totalreqrdstaff), act: (LN.get(h.id) || {}).act || 0, sh: SH.get(h.id) || 0, why: String(h.activityreasons || ''), ab: String(h.approvalactionby || '') }))
      .filter(h => (!h.date || (h.date >= S.f.from && h.date <= S.f.to)) && (!S.f.loc || h.loc === S.f.loc) && (S.f.status === 'all' || apprOk(h.st))).sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="otr-wrap"><table class="otr-t"><thead><tr><th>Request date</th><th>Location</th><th>Requested by</th><th>OT type</th><th>Status</th><th>Approved by</th><th class="n">Staff req.</th><th class="n">Requested h</th><th class="n">Actual worked h</th><th class="n">Staff OT h</th><th>Reason</th></tr></thead><tbody>
      ${L.map(h => `<tr><td>${esc(dmy(h.date))}</td><td>${esc(h.loc)}</td><td>${esc(h.by)}</td><td>${esc(h.type)}</td><td>${apprOk(h.st) ? '<span class="otr-p g">' + esc(h.st) + '</span>' : /reject/i.test(h.st) ? '<span class="otr-p r">' + esc(h.st) + '</span>' : '<span class="otr-p o">' + esc(h.st) + '</span>'}</td><td>${esc(h.ab)}</td><td class="n">${h1(h.staff)}</td><td class="n">${h1(h.req)}</td><td class="n">${h1(h.act)}</td><td class="n"><b>${h1(h.sh)}</b></td><td>${esc(h.why)}</td></tr>`).join('') || '<tr><td colspan="11" class="otr-hint">No requests in this period.</td></tr>'}</tbody>
      ${L.length ? `<tfoot><tr><td colspan="7"><b>Total (${L.length})</b></td><td class="n"><b>${h1(L.reduce((a, h) => a + h.req, 0))}</b></td><td class="n"><b>${h1(L.reduce((a, h) => a + h.act, 0))}</b></td><td class="n"><b>${h1(L.reduce((a, h) => a + h.sh, 0))}</b></td><td></td></tr></tfoot>` : ''}</table></div>`; }

  function rep() { const T = { loc: 'OT approved vs recovered — by location & in-charge', staff: 'OT approved vs recovered — by staff', day: 'OT days by staff', off: 'OT day-off log', req: 'OT requests' }[S.tab] || 'OT report', R = S.loaded ? staffRows() : [], ot = R.reduce((a, r) => a + r.ot, 0), vr = R.reduce((a, r) => a + r.ver, 0);
    const note = [dmy(S.f.from) + ' – ' + dmy(S.f.to), S.f.loc ? 'Location ' + S.f.loc : 'All locations', S.f.mgr && 'In-charge ' + S.f.mgr, S.f.q && 'Staff ' + S.f.q, S.f.status === 'all' ? 'all requests' : 'approved OT only', 'Approved ' + h1(ot) + ' h · verified day off ' + h1(vr) + ' h · open ' + h1(Math.max(0, ot - vr)) + ' h · recovered ' + pct(vr, ot) + '%', 'Printed ' + new Date().toLocaleString()].filter(Boolean).join(' · ');
    return tblReport(Q('#otrBody table.otr-t'), T, note, { loc: 'OT by location', staff: 'OT by staff', day: 'OT days', off: 'Day-off log', req: 'OT requests' }[S.tab]); }
  function render() {
    const v = Q('#otrBody'); if (!v) return; const all = S.D.st, locs = [...new Set(all.map(r => String(r.whsdesc || '').trim()).filter(Boolean))].sort(), mgrs = [...new Set(all.filter(r => !S.f.loc || String(r.whsdesc || '').trim() === S.f.loc).map(r => String(r.stafflinemngr || '').trim()).filter(Boolean))].sort();
    const R = S.loaded ? staffRows() : [];
    const U = rpUI;
    v.innerHTML = `<div class="rp-f">${U.fi('From', `<input type="date" data-f="from" value="${S.f.from}">`)}${U.fi('To', `<input type="date" data-f="to" value="${S.f.to}">`)}
      ${U.fi('Location', `<select data-f="loc"><option value="">All locations</option>${locs.map(l => `<option${l === S.f.loc ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}${U.fi('In-charge', `<select data-f="mgr"><option value="">All in-charges</option>${mgrs.map(l => `<option${l === S.f.mgr ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}
      ${U.fi('Requests', `<select data-f="status"><option value="appr"${S.f.status === 'appr' ? ' selected' : ''}>Approved OT only</option><option value="all"${S.f.status === 'all' ? ' selected' : ''}>All requests (incl. pending / rejected)</option></select>`)}${U.fi('Staff', `<input type="search" data-f="q" value="${esc(S.f.q)}" placeholder="Name / file no." style="min-width:170px">`)}
      <label class="rp-ck"><input type="checkbox" data-f="open"${S.f.open ? ' checked' : ''}> open balance only</label>
      <span class="rp-sp"></span>${U.grp('<button class="secondary small" type="button" data-or="m0">This month</button><button class="secondary small" type="button" data-or="m1">Last month</button><button class="secondary small" type="button" data-or="y">This year</button>')}</div>
      ${S.f.mgr || S.f.q ? `<div class="otr-hint">Filtered: ${S.f.mgr ? 'in-charge <b>' + esc(S.f.mgr) + '</b> ' : ''}${S.f.q ? 'staff “' + esc(S.f.q) + '” ' : ''}<a href="#" data-or="clr">✖ clear</a></div>` : ''}
      ${S.loaded ? kpis(R) : ''}
      ${U.tabbar([['loc', '📍 By location & in-charge'], ['staff', '👤 By staff'], ['day', '📅 OT days'], ['off', '🛌 Day-off log'], ['req', '📝 OT requests']].map(([k, t]) => `<button type="button" class="${S.tab === k ? 'active on' : ''}" data-t="${k}">${t}</button>`).join(''), 'data-or', '#otrBody')}
      ${S.loading && !S.loaded ? '<div class="otr-hint">Reading the OT lists…</div>' : !S.loaded ? `<div class="otr-hint">${S.err ? '⚠ ' + esc(S.err) : 'Press 🔄 Reload to read the OT lists.'}</div>` : S.tab === 'loc' ? byLoc(R) : S.tab === 'staff' ? byStaff(R) : S.tab === 'day' ? days(R) : S.tab === 'off' ? offLog() : requests()}
      <div class="otr-hint" style="margin-top:8px"><b>Approved OT h</b> = OT_Hours of the staff on approved requests · <b>Day off given</b> = Taken_Rplcmnt_Hours entered by the in-charge · <b>Verified</b> = Approved_Tkn_Hrs (checked by the verifier) · <b>Open balance</b> = approved − verified · <b>Recovered</b> = verified ÷ approved.</div>`;
  }
  function init() {
    const v = Q('#view-otr'); if (!v || v._i) return; v._i = 1;
    v.addEventListener('click', e => { const t = e.target.closest('[data-t],[data-or],[data-mgr],[data-staff]'); if (!t) return; e.preventDefault();
      if (t.dataset.t) { S.tab = t.dataset.t; return render(); } if (t.dataset.mgr != null) { S.f.mgr = t.dataset.mgr; S.tab = 'staff'; return render(); } if (t.dataset.staff != null) { S.f.q = t.dataset.staff; S.tab = 'day'; return render(); }
      const a = t.dataset.or, d = new Date(); if (a === 'expand') { const tb = Q('#otrBody table.otr-t'); if (tb && window.tableExpandOpen) tableExpandOpen(tb); return; } if (a === 'print' || a === 'excel' || a === 'mail') { const d = rep(); if (a === 'print') a2Print(d); else if (a === 'excel') a2Export(d); else a2Mail(rep); return; } if (a === 'reload') return load(true); if (a === 'clr') { S.f.mgr = ''; S.f.q = ''; return render(); }
      if (a === 'm0') { S.f.from = ymd(new Date(d.getFullYear(), d.getMonth(), 1)); S.f.to = ymd(d); } else if (a === 'm1') { S.f.from = ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)); S.f.to = ymd(new Date(d.getFullYear(), d.getMonth(), 0)); } else if (a === 'y') { S.f.from = ymd(new Date(d.getFullYear(), 0, 1)); S.f.to = ymd(d); } render(); });
    v.addEventListener('change', e => { const el = e.target, k = el.dataset.f; if (!k || k === 'q') return; S.f[k] = el.type === 'checkbox' ? el.checked : el.value; if (k === 'loc') S.f.mgr = ''; render(); });
    v.addEventListener('input', e => { const el = e.target; if (el.dataset.f === 'q') { S.f.q = el.value.trim(); clearTimeout(S.tm); S.tm = setTimeout(() => { render(); const i = Q('#otrBody [data-f=q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 400); } });
    const css = document.createElement('style'); css.textContent = `#view-otr .tbl-expand-bar,#view-otr .hc-bar,#view-otr .ct-bar,#view-otr .tbl-expand-inline{display:none!important}#view-otr .otr-bar0{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}#view-otr .otr-bar0 select,#view-otr .otr-bar0 input{width:auto;margin:0}#view-otr .otr-ck{display:flex;gap:5px;align-items:center;font-size:13px}#view-otr .otr-ck input{width:auto}
#view-otr .otr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:10px 0}#view-otr .otr-k{border:1px solid var(--border);border-radius:12px;padding:8px 14px}#view-otr .otr-k span{font-size:12px;color:var(--gray-600);display:block}#view-otr .otr-k b{font-size:21px}#view-otr .otr-k small{display:block;font-size:11px;color:var(--gray-600)}
#view-otr .otr-wrap{overflow:auto;max-height:70vh;border:1px solid var(--border);border-radius:12px}#view-otr table.otr-t{border-collapse:collapse;font-size:12.5px;width:100%}#view-otr .otr-t th{background:var(--brand-light,#eef2fb);padding:7px 6px;text-align:left;white-space:nowrap;position:sticky;top:0;z-index:2}#view-otr .otr-t td{padding:5px 6px;border-top:1px solid var(--border)}#view-otr .otr-t .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
#view-otr tr.otr-g td{background:var(--gray-50,#f8fafc);border-top:2px solid var(--border)}#view-otr tfoot td{border-top:2px solid var(--border);background:var(--gray-50,#f8fafc)}#view-otr .otr-hint{font-size:12px;color:var(--gray-600);padding:6px 2px}
#view-otr .otr-bar{position:relative;height:16px;border-radius:8px;background:var(--gray-100,#eef1f6);overflow:hidden;min-width:110px}#view-otr .otr-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:8px}#view-otr .otr-bar span{position:relative;font-size:11px;font-weight:700;padding-left:6px;line-height:16px}
#view-otr .otr-p{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;font-weight:700}#view-otr .otr-p.g{background:#dcfce7;color:#166534}#view-otr .otr-p.o{background:#fef3c7;color:#92400e}#view-otr .otr-p.r{background:#fee2e2;color:#991b1b}`; document.head.appendChild(css);
    render();
  }
  const nav = Q('.nav-item[data-view="otr"]'); if (nav) nav.addEventListener('click', () => { init(); setTimeout(() => load(false), 50); });
  const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (activeViewId() === 'otr') { e.stopImmediatePropagation(); load(true); } }, true);
  window.OTR = { S, load, render };
})();
