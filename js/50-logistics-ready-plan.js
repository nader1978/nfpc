/* ============================================================
   LOGISTICS — READY PLAN (Excel whose headers are the SharePoint column names, e.g. Plan_Date, Driver_File_Nr, Unit_Nr …)
   One click: read the file → show the rows in the trip plan → upload every row straight to the SharePoint list chosen in the Upload tab.
   ============================================================ */
(function () {
  const RK = LS_BASE + '_lp_rdy', N = lpNorm;
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv'; inp.hidden = true; inp.id = 'lpReadyFile'; document.body.appendChild(inp);
  const seen = () => { try { return JSON.parse(localStorage.getItem(RK) || '{}'); } catch (e) { return {}; } };
  document.addEventListener('click', e => { const b = e.target.closest('[data-a="imp-rdy"]'); if (!b) return; e.stopPropagation(); e.preventDefault();
    try { lpInit(); } catch (x) {}
    if (!lp.picker || !lp.picker.getValue()) { sectionToast('Choose the SharePoint list first: open the Upload tab of this page and pick the list.', 'warn'); return; }
    inp.click(); }, true);
  function parse(wb, region) {
    for (const sn of wb.SheetNames) { const M = lpRows(wb.Sheets[sn]); const hi = M.findIndex(r => { const n = r.map(N); return n.includes('plandate') && (n.includes('drivername') || n.includes('unitnr')); }); if (hi < 0) continue;
      const hd = M[hi].map(h => String(h == null ? '' : h).trim()), rows = [];
      M.slice(hi + 1).forEach(r => { const o = {}; hd.forEach((h, i) => { if (h && r[i] !== '' && r[i] != null) o[h] = r[i]; }); const g = k => { const h = hd.find(x => N(x) === k); return h ? o[h] : undefined; }; const d = lpDate(g('plandate')); if (!d || !(g('drivername') || g('driverfilenr') || g('unitnr'))) return; o.__d = d;
        const pl = g('nrofplts'), from = lpS(g('destinationfromvalue')), to = lpS(g('destinationtovalue')), mat = lpS(g('loadedmtrltypevalue')), loaded = lpNum(pl) > 0;
        rows.push({ raw: o, plan: { id: lpId(), date: d, region, shift: lpS(g('triptimming')), fileNo: lpS(g('driverfilenr')), driver: lpS(g('drivername')), mobile: '', regNo: lpS(g('unitnr')), trailer: lpS(g('trailernr')), trailerType: '', bu: mat, from, to, trip1: [from, to].filter(Boolean).join(' - ') + (mat ? ' (' + mat + ')' : '') + (loaded ? ' - ' + lpNum(pl) + ' plts' : ''), trip2: '', planned: loaded ? 1 : 0, done: 0, missed: 0, vehStatus: '', remarks: lpS(g('tripinstrucations')), src: 'Ready plan', manual: loaded ? 0 : 1 } }); });
      if (rows.length) return { sheet: sn, headers: hd.filter(Boolean), rows }; }
    return null; }
  inp.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) run(f); });
  window.lpReadyRun = run;
  async function run(f) {
    try {
      if (!hasPerm('logplan') && !hasPerm('uploader')) return alert('Permission denied.');
      const region = /\bSE\b|_SE|SE_/i.test(f.name) ? 'SE' : 'NE', wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), P = parse(wb, region);
      if (!P) return sectionToast('No ready plan found — the sheet needs a header row with Plan_Date, Driver_Name, Unit_Nr …', 'warn');
      const name = lp.picker.getValue(), token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) return sectionToast('Sign in / set the Site URL first.', 'warn');
      if (!isListVisible(name) || !isListEditable(name)) return sectionToast('No write permission on "' + name + '".', 'error');
      sectionToast('Reading the SharePoint list columns…', 'warn');
      const { siteId, listId } = await resolveIds(siteUrl, name, token), cols = (await fetchColumns(siteId, listId, token)).filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase()));
      const colOf = h => cols.find(c => N(c.name) === N(h)) || cols.find(c => N(c.displayName) === N(h)), map = {}, miss = []; P.headers.forEach(h => { const c = colOf(h); if (c) map[h] = c.name; else miss.push(h); });
      if (!Object.keys(map).length) return sectionToast('None of the file columns exist in "' + name + '" — check the list and the headers.', 'error');
      const ds = [...new Set(P.rows.map(r => r.plan.date))].sort(), sig = f.name + '|' + f.size + '|' + name, again = seen()[sig];
      spAsk.extra = ''; const q = 'Add ' + P.rows.length + ' ready-plan row(s) to the trip plan and upload them to "' + name + '"?\n' + ds[0] + (ds.length > 1 ? ' → ' + ds[ds.length - 1] : '') + ' · ' + new Set(P.rows.map(r => r.plan.driver)).size + ' driver(s) · ' + P.rows.filter(r => r.plan.planned).length + ' loaded trips\nColumns uploaded: ' + Object.keys(map).length + (miss.length ? ' · not in the list (skipped): ' + miss.join(', ') : '') + (again ? '\n⚠ This file was already uploaded to this list on ' + again + ' — uploading again creates duplicates.' : '');
      if (!(await spAsk(q))) return;
      const D = new Set(ds); lp.rows = lp.rows.filter(r => !(r.src === 'Ready plan' && r.region === region && D.has(r.date))).concat(P.rows.map(r => r.plan)); ds.forEach(d => lp.days.add(d)); lpSave(); lpRender();
      const prog = document.querySelector('#lpUpProg'), st = document.querySelector('#lpUpStatus'); let ok = 0, fail = 0, next = 0; const errs = [], total = P.rows.length;
      const worker = async () => { while (next < total) { const r = P.rows[next++], fl = {}; Object.entries(map).forEach(([h, c]) => { const v = r.raw[h]; if (v !== undefined && v !== '') fl[c] = h === P.headers.find(x => N(x) === 'plandate') || colOf(h).type === 'date' ? lpDate(v) : v; });
        const uc = (typeof CURRENT_USER_FIELD_KEY !== 'undefined') && cols.find(c => /^(uploaded_?by|created_?by_?name|updated_?by)$/i.test(c.name)); if (uc && !fl[uc.name]) fl[uc.name] = getCurrentUserValue();
        try { await createItem(siteId, listId, fl, token); ok++; r.plan.up = Date.now(); } catch (err) { fail++; if (errs.length < 3) errs.push((r.plan.driver || r.plan.trip1) + ': ' + err.message); } if (st) st.textContent = 'Ready plan: ' + (ok + fail) + ' / ' + total + ' · ✔ ' + ok + ' · ✘ ' + fail; } };
      await Promise.all([worker(), worker(), worker()]); lpSave(); lpRender();
      if (ok) { const s = seen(); s[sig] = new Date().toLocaleString(); try { localStorage.setItem(RK, JSON.stringify(s)); } catch (x) {} }
      sectionToast(fail ? '⚠ ' + ok + ' uploaded, ' + fail + ' failed. ' + errs.join(' | ') : '✅ Ready plan: ' + ok + ' row(s) added to the plan and uploaded to "' + name + '".', fail ? 'warn' : 'success');
      try { w_logToActivity('Ready plan "' + f.name + '" → "' + name + '": ' + ok + ' ok, ' + fail + ' failed'); } catch (x) {}
    } catch (err) { sectionToast('✘ ' + err.message, 'error'); }
  }
})();
