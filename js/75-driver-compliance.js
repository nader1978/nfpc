/* ============================================================
   DRIVER COMPLIANCE — Logistics Trip Planning → Actions → "👷 Driver compliance"
   Source: Trls_Daily_Activity_tbl (the list the plan is uploaded to). An assigned trip = Task_Source "Plan Upload".
   The drivers' app (Power Apps) moves it: Planned → Started (Start_TimeStamp) → Completed (TimeStamp_End) or Cancelled.
   Tabs: 1) Trip compliance per driver  2) Daily system use (who updated his plan, who did not use the system)  3) Trip detail
   Reads only the chosen dates (date filter; if SharePoint refuses it, rows created from 15 days before the start date).
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nz = s => String(s || '').toLowerCase().replace(/_x[0-9a-f]{4}_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymdL = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dayOf = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? String(v).slice(0, 10) : ymdL(d); };   /* local (UAE) calendar day */
  const tm = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const pct = (a, b) => b ? Math.round(a / b * 100) : null;
  const toast = (t, k) => { try { sectionToast(t, k || 'success'); } catch (e) {} };
  const S = { rows: [], tab: 'comp', f: {}, from: '', to: '', at: '', name: '', busy: false };
  const FK = [['region', 'Region'], ['driver', 'Driver'], ['status', 'Status']];
  { const t = new Date(); S.to = ymdL(t); t.setDate(t.getDate() - 6); S.from = ymdL(t); }

  /* ---------- read ---------- */
  async function read() { const name = (typeof utGet === 'function' && utGet('lpdaily') && utGet('lpdaily').list) || 'Trls_Daily_Activity_tbl', token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first (no Microsoft session)');
    const ids = await resolveIds(site, name, token), cols = await fetchColumns(ids.siteId, ids.listId, token), M = new Map(); cols.forEach(c => { M.set(nz(c.name), c.name); if (!M.has(nz(c.displayName))) M.set(nz(c.displayName), c.name); });
    const col = k => M.get(nz(k)), dc = col('Trans_Date') || 'Trans_Date', d0 = new Date(S.from + 'T00:00:00'); d0.setDate(d0.getDate() - 1); const lo = ymdL(d0), hi = S.to;
    let its; try { its = await exp_fetchFilteredItems(ids.siteId, ids.listId, token, `fields/${dc} ge '${lo}T00:00:00Z' and fields/${dc} le '${hi}T23:59:59Z'`); }
    catch (e) { const c0 = new Date(S.from + 'T00:00:00'); c0.setDate(c0.getDate() - 15); its = await exp_fetchFilteredItems(ids.siteId, ids.listId, token, `fields/Created ge '${ymdL(c0)}T00:00:00Z'`); }
    const g = (f, k) => { const c = col(k); let v = c ? f[c] : undefined; if (v && typeof v === 'object') v = v.Value || v.LookupValue || v.Title || ''; return v == null ? '' : v; };
    S.rows = its.map(it => { const f = it.fields || {}; return { id: it.id, src: String(g(f, 'Task_Source')).trim(), status: String(g(f, 'Trip_Status')).trim() || 'Planned', day: dayOf(g(f, 'Trans_Date')), driver: String(g(f, 'User_Name')).trim(), file: String(g(f, 'Driver_FileNr')).trim().replace(/\.0+$/, ''), unit: String(g(f, 'Unit_Nr')).trim(), trailer: String(g(f, 'Trailer_Nr')).trim(), from: String(g(f, 'Distn_From')).trim(), to: String(g(f, 'Distn_To')).trim(), region: String(g(f, 'Region_Desc')).trim(), start: g(f, 'Start_TimeStamp') || g(f, 'TimeStamp_Start'), end: g(f, 'TimeStamp_End') || g(f, 'End_TimeStamp'), rem: String(g(f, 'Remarks')).trim() }; })
      .filter(r => /plan\s*upload/i.test(r.src) && r.day >= S.from && r.day <= S.to && (r.driver || r.file));
    S.name = name; S.at = new Date().toLocaleTimeString(); }

  /* ---------- the figures ---------- */
  const today = () => ymdL(new Date());
  const st = r => { const s = r.status.toLowerCase(); return s.startsWith('complet') || s === 'end trip' ? 'Completed' : s.startsWith('cancel') ? 'Cancelled' : s.startsWith('start') ? 'Started' : r.day < today() ? 'Not started' : 'Planned'; };
  const who = r => r.file ? r.file + '|' + r.driver.toLowerCase() : '|' + r.driver.toLowerCase();
  const pass = (r, skip) => FK.every(([k]) => k === skip || !(S.f[k] || []).length || S.f[k].includes(k === 'status' ? st(r) : k === 'driver' ? (r.driver || r.file) : (r[k] || '—')));
  const shown = () => S.rows.filter(r => pass(r));
  function comp(R) { const m = new Map(); R.forEach(r => { const k = who(r); let o = m.get(k); if (!o) m.set(k, o = { driver: r.driver, file: r.file, region: r.region, n: 0, Started: 0, Completed: 0, Cancelled: 0, 'Not started': 0, Planned: 0, days: new Set() }); o.n++; o[st(r)]++; o.days.add(r.day); if (!o.region && r.region) o.region = r.region; });
    return [...m.values()].map(o => { const due = o.n - o.Planned, upd = o.Started + o.Completed + o.Cancelled; return Object.assign(o, { due, upd, done: pct(o.Completed, due), resp: pct(upd, due) }); }).sort((a, b) => (a.resp == null ? 999 : a.resp) - (b.resp == null ? 999 : b.resp) || a.driver.localeCompare(b.driver)); }
  function daily(R) { const m = new Map(); R.forEach(r => { const k = r.day + '#' + who(r); let o = m.get(k); if (!o) m.set(k, o = { day: r.day, driver: r.driver, file: r.file, region: r.region, n: 0, upd: 0, done: 0, canc: 0, fut: 0 }); o.n++; const s = st(r); if (s === 'Planned') o.fut++; if (s === 'Started' || s === 'Completed' || s === 'Cancelled') o.upd++; if (s === 'Completed') o.done++; if (s === 'Cancelled') o.canc++; });
    return [...m.values()].map(o => Object.assign(o, { res: o.fut === o.n ? 'Upcoming' : o.upd === 0 ? "Didn't use" : o.upd < o.n - o.fut ? 'Partly' : 'Used' })).sort((a, b) => b.day.localeCompare(a.day) || ({ "Didn't use": 0, Partly: 1, Used: 2, Upcoming: 3 }[a.res] - { "Didn't use": 0, Partly: 1, Used: 2, Upcoming: 3 }[b.res]) || a.driver.localeCompare(b.driver)); }
  const RES = { Used: ['✔ Used', '#dcfce7', '#166534'], Partly: ['◐ Partly', '#fef3c7', '#92400e'], "Didn't use": ["✖ Didn't use the system", '#fee2e2', '#991b1b'], Upcoming: ['… upcoming', '#e0e7ff', '#3730a3'] };
  const STC = { Completed: ['#dcfce7', '#166534'], Started: ['#dbeafe', '#1e40af'], Cancelled: ['#fee2e2', '#991b1b'], 'Not started': ['#fef3c7', '#92400e'], Planned: ['#f1f5f9', '#475569'] };
  const pill = (t, bg, fg) => `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;background:${bg};color:${fg};white-space:nowrap">${esc(t)}</span>`;
  const pc = v => v == null ? '' : `<b style="color:${v >= 90 ? '#15803d' : v >= 60 ? '#b45309' : '#b91c1c'}">${v}%</b>`;

  /* table data of the tab on screen (also for Excel / Print / Email / Expand) */
  function data() { const R = shown(), fl = FK.filter(([k]) => (S.f[k] || []).length).map(([k, l]) => l + ': ' + S.f[k].join(', ')), note = S.from + ' → ' + S.to + ' · ' + S.name + (fl.length ? ' · ' + fl.join(' · ') : '');
    if (S.tab === 'comp') { const C = comp(R); return { title: 'Driver trip compliance', sheet: 'Trip compliance', note, headers: ['Driver', 'File no.', 'Region', 'Assigned', 'Started (in progress)', 'Completed', 'Cancelled', 'Not started', 'Upcoming', 'Completed %', 'Response %'], rows: C.map(o => [o.driver, o.file, o.region, o.n, o.Started, o.Completed, o.Cancelled, o['Not started'], o.Planned, o.done == null ? '' : o.done + '%', o.resp == null ? '' : o.resp + '%']), C }; }
    if (S.tab === 'use') { const D = daily(R); return { title: 'Daily system use — drivers', sheet: 'Daily system use', note, headers: ['Date', 'Driver', 'File no.', 'Region', 'Assigned trips', 'Updated (started / completed / cancelled)', 'Completed', 'Cancelled', 'Result'], rows: D.map(o => [o.day, o.driver, o.file, o.region, o.n, o.upd, o.done, o.canc, RES[o.res][0]]), D }; }
    const T = R.slice().sort((a, b) => b.day.localeCompare(a.day) || a.driver.localeCompare(b.driver)); return { title: 'Assigned trips — detail', sheet: 'Trip detail', note, headers: ['Date', 'Driver', 'File no.', 'Region', 'Unit', 'Trailer', 'From', 'To', 'Status', 'Started', 'Ended', 'Remarks'], rows: T.map(r => [r.day, r.driver, r.file, r.region, r.unit, r.trailer, r.from, r.to, st(r), tm(r.start), tm(r.end), r.rem]), T }; }

  /* ---------- window ---------- */
  function frame() { let el = Q('#dcBox'); if (el) return el; el = document.createElement('div'); el.id = 'dcBox'; el.dataset.nohc = '1'; el.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:12px';
    el.innerHTML = `<div style="background:var(--card-bg,#fff);color:var(--text,#0f172a);border-radius:16px;width:min(1400px,100%);height:min(92vh,960px);display:flex;flex-direction:column;box-shadow:0 30px 60px -20px rgba(15,23,42,.5)">
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border,#e2e8f0)"><b style="font-size:16px;flex:1;min-width:200px">👷 Driver compliance</b>
        <label class="text-sm" style="display:flex;gap:6px;align-items:center;margin:0">From <input type="date" id="dcFrom" value="${S.from}" style="width:auto;margin:0"></label><label class="text-sm" style="display:flex;gap:6px;align-items:center;margin:0">To <input type="date" id="dcTo" value="${S.to}" style="width:auto;margin:0"></label>
        <button type="button" class="ghost small" data-dc="7">Last 7 days</button><button type="button" class="ghost small" data-dc="today">Today</button>
        <span style="width:8px"></span><button type="button" class="ghost small" data-dc="mail">📧 Email</button><button type="button" class="ghost small" data-dc="exp">⤢ Expand</button><button type="button" class="ghost small" data-dc="xl">⬇ Excel</button><button type="button" class="ghost small" data-dc="pr">🖨 Print</button><button type="button" class="ghost small" data-dc="re">↻ Reload</button><button type="button" class="ghost small" data-dc="x">✕</button></div>
      <div style="display:flex;gap:6px;padding:10px 16px 0;flex-wrap:wrap" id="dcTabs"></div>
      <div id="dcKpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:10px 16px"></div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:0 16px 6px">${FK.map(([k, l]) => `<div class="dc-f" data-f="${k}" style="min-width:170px;max-width:260px;flex:1"><div class="text-sm" style="font-weight:600;margin-bottom:2px">${l}</div></div>`).join('')}<span id="dcSum" class="text-sm" style="color:var(--gray-600);flex:2;min-width:220px;align-self:center"></span></div>
      <div id="dcTbl" style="overflow:auto;padding:0 16px 14px;flex:1"></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) return el.remove(); const t = e.target.closest('[data-dt]'); if (t) { S.tab = t.dataset.dt; return body(); } const b = e.target.closest('[data-dc]'); if (!b) return; const a = b.dataset.dc;
      if (a === 'x') return el.remove(); if (a === 're') return load();
      if (a === '7' || a === 'today') { const t2 = new Date(); S.to = ymdL(t2); if (a === '7') t2.setDate(t2.getDate() - 6); S.from = ymdL(t2); Q('#dcFrom').value = S.from; Q('#dcTo').value = S.to; return load(); }
      if (a === 'clr') { S.f = {}; combos(); return body(); }
      const D = data(); if (!D.rows.length) return toast('Nothing to show for this selection.', 'warn');
      if (a === 'xl') { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([D.headers, ...D.rows]), D.sheet); XLSX.writeFile(wb, D.sheet.replace(/\W+/g, '_') + '_' + S.from + '_' + S.to + '.xlsx'); }
      if (a === 'pr') w_printTable(D.title, D.note, D.headers, D.rows);
      if (a === 'mail') { window.extMailData = data; wMail_open('ext'); }
      if (a === 'exp') { const tb = document.createElement('table'); tb.dataset.title = D.title; tb.innerHTML = '<thead><tr>' + D.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + D.rows.map(r => '<tr>' + r.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody>'; if (window.tableExpandOpen) window.tableExpandOpen(tb); } });
    el.addEventListener('change', e => { if (e.target.id === 'dcFrom' || e.target.id === 'dcTo') { S.from = Q('#dcFrom').value || S.from; S.to = Q('#dcTo').value || S.to; if (S.from > S.to) { const x = S.from; S.from = S.to; S.to = x; Q('#dcFrom').value = S.from; Q('#dcTo').value = S.to; } load(); } });
    return el; }
  function combos(skip) { document.querySelectorAll('#dcBox .dc-f').forEach(h => { const k = h.dataset.f; if (k === skip) return; const old = h.querySelector('.combo'); if (old) old.remove();
      const vals = [...new Set(S.rows.filter(r => pass(r, k)).map(r => k === 'status' ? st(r) : k === 'driver' ? (r.driver || r.file) : (r[k] || '—')))].sort();
      try { h.appendChild(buildMultiCombo((S.f[k] || []).filter(v => vals.includes(v)), vals, arr => { S.f[k] = arr; body(); combos(k); }, { placeholder: 'All' })); } catch (e) { console.error(e); } }); }
  const K = (l, v, s, c) => `<div style="background:var(--card-bg,#fff);border:1px solid var(--border,#e2e8f0);border-left:4px solid ${c || '#1d4ed8'};border-radius:12px;padding:10px 12px"><div class="text-sm" style="color:var(--gray-600)">${l}</div><div style="font-size:22px;font-weight:800">${v}</div><div class="text-sm" style="color:var(--gray-500)">${s || ''}</div></div>`;
  function body() { const el = Q('#dcBox'); if (!el) return; const R = shown(), D = data();
    Q('#dcTabs').innerHTML = [['comp', '📋 Trip compliance'], ['use', '📅 Daily system use'], ['det', '🧾 Trip detail']].map(([k, l]) => `<button type="button" data-dt="${k}" class="${S.tab === k ? 'small' : 'ghost small'}">${l}</button>`).join('');
    const C = comp(R), due = C.reduce((a, o) => a + o.due, 0), cnt = s => R.filter(r => st(r) === s).length, U = daily(R), dd = U.filter(o => o.res !== 'Upcoming');
    Q('#dcKpi').innerHTML = S.tab === 'use'
      ? K('Driver-days', dd.length, 'assigned and due') + K('✔ Used the system', dd.filter(o => o.res === 'Used').length, 'updated every trip', '#16a34a') + K('◐ Partly', dd.filter(o => o.res === 'Partly').length, 'updated some trips', '#d97706') + K("✖ Didn't use", dd.filter(o => o.res === "Didn't use").length, 'no trip updated', '#dc2626') + K('Use rate', (pct(dd.filter(o => o.res === 'Used').length, dd.length) ?? '—') + (dd.length ? '%' : ''), 'driver-days fully updated', '#1d4ed8')
      : K('Assigned trips', R.length, C.length + ' driver(s)') + K('Completed', cnt('Completed'), (pct(cnt('Completed'), due) ?? '—') + (due ? '%' : '') + ' of due trips', '#16a34a') + K('Started', cnt('Started'), 'in progress', '#2563eb') + K('Cancelled', cnt('Cancelled'), '', '#dc2626') + K('Not started', cnt('Not started'), 'date passed, never started', '#d97706') + K('Upcoming', cnt('Planned'), 'today / later, not started yet', '#64748b');
    const any = FK.some(([k]) => (S.f[k] || []).length);
    Q('#dcSum').innerHTML = `${S.busy ? '⏳ reading…' : `<b>${R.length}</b> of ${S.rows.length} assigned trip(s) · “${esc(S.name)}” · read ${esc(S.at)}`}${any ? ' · <button type="button" class="ghost small" data-dc="clr">✕ Clear filters</button>' : ''}`;
    let h = '';
    if (S.tab === 'comp') h = `<table class="fd-tbl" style="width:100%"><thead><tr><th>Driver</th><th>File no.</th><th>Region</th><th class="n">Assigned</th><th class="n">Started</th><th class="n">Completed</th><th class="n">Cancelled</th><th class="n">Not started</th><th class="n">Upcoming</th><th class="n">Completed %</th><th class="n">Response %</th></tr></thead><tbody>${D.C.map(o => `<tr><td><b>${esc(o.driver || '—')}</b></td><td>${esc(o.file)}</td><td>${esc(o.region)}</td><td class="n">${o.n}</td><td class="n">${o.Started || ''}</td><td class="n">${o.Completed || ''}</td><td class="n" style="color:#b91c1c">${o.Cancelled || ''}</td><td class="n" style="color:#b45309;font-weight:${o['Not started'] ? 700 : 400}">${o['Not started'] || ''}</td><td class="n" style="color:#64748b">${o.Planned || ''}</td><td class="n">${pc(o.done)}</td><td class="n">${pc(o.resp)}</td></tr>`).join('') || '<tr><td colspan="11" class="pl-empty" style="padding:16px">No assigned trips in this period.</td></tr>'}</tbody></table>
      <div class="text-sm" style="color:var(--gray-600);margin-top:8px">Completed % = completed ÷ due trips · Response % = trips the driver started, completed or cancelled ÷ due trips. Due = the plan date has come (upcoming trips are not counted).</div>`;
    else if (S.tab === 'use') h = `<table class="fd-tbl" style="width:100%"><thead><tr><th>Date</th><th>Driver</th><th>File no.</th><th>Region</th><th class="n">Assigned</th><th class="n">Updated</th><th class="n">Completed</th><th class="n">Cancelled</th><th>Result</th></tr></thead><tbody>${D.D.map(o => `<tr><td>${esc(o.day)}</td><td><b>${esc(o.driver || '—')}</b></td><td>${esc(o.file)}</td><td>${esc(o.region)}</td><td class="n">${o.n}</td><td class="n">${o.upd}</td><td class="n">${o.done || ''}</td><td class="n">${o.canc || ''}</td><td>${pill(...RES[o.res])}</td></tr>`).join('') || '<tr><td colspan="9" class="pl-empty" style="padding:16px">No assigned trips in this period.</td></tr>'}</tbody></table>
      <div class="text-sm" style="color:var(--gray-600);margin-top:8px">✔ Used = every trip of the day was started / completed / cancelled in the app · ◐ Partly = some of them · ✖ Didn't use the system = none of the day's trips was touched.</div>`;
    else h = `<table class="fd-tbl" style="width:100%"><thead><tr><th>Date</th><th>Driver</th><th>File no.</th><th>Region</th><th>Unit</th><th>Trailer</th><th>From</th><th>To</th><th>Status</th><th>Started</th><th>Ended</th><th>Remarks</th></tr></thead><tbody>${D.T.map(r => { const s = st(r); return `<tr><td>${esc(r.day)}</td><td><b>${esc(r.driver)}</b></td><td>${esc(r.file)}</td><td>${esc(r.region)}</td><td>${esc(r.unit)}</td><td>${esc(r.trailer)}</td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${pill(s, ...STC[s])}</td><td style="white-space:nowrap">${esc(tm(r.start))}</td><td style="white-space:nowrap">${esc(tm(r.end))}</td><td>${esc(r.rem)}</td></tr>`; }).join('') || '<tr><td colspan="12" class="pl-empty" style="padding:16px">No assigned trips in this period.</td></tr>'}</tbody></table>`;
    Q('#dcTbl').innerHTML = h; }
  async function load() { frame(); S.busy = true; body(); Q('#dcTbl').innerHTML = '<div style="padding:40px;text-align:center" class="text-sm">⏳ Reading the assigned trips ' + S.from + ' → ' + S.to + '…</div>';
    try { await read(); S.busy = false; combos(); body(); } catch (e) { S.busy = false; Q('#dcTbl').innerHTML = `<div style="padding:30px;text-align:center"><b>⚠ ${esc(e.message)}</b></div>`; } }

  /* button in Logistics Trip Planning → Actions */
  setInterval(() => { const act = Q('#lpActBody'), ref = act && (act.querySelector('[data-rv3]') || act.querySelector('[data-a="imp-rdy"]')); if (!ref || act.querySelector('[data-dc0]')) return;
    ref.insertAdjacentHTML('afterend', ' <button class="secondary small" data-dc0="1" type="button" title="Drivers: assigned trips vs started / cancelled / completed, and who updated his plan each day">👷 Driver compliance</button>'); }, 1200);
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-dc0]'); if (!b) return; e.preventDefault(); e.stopPropagation(); S.f = {}; load(); }, true);
  window.driverCompliance = { open: load, S, comp, daily };
})();
