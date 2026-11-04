/* ============================================================
   LOGISTICS — READY PLAN (Excel whose headers are the SharePoint column names, e.g. Plan_Date, Driver_File_Nr, Unit_Nr …)
   One click: read the file → show the rows in the trip plan → upload every row straight to the SharePoint list chosen in the Upload tab.
   ============================================================ */
(function () {
  const RK = LS_BASE + '_lp_rdy', N = lpNorm, DID = 'lpdaily', DDEF = 'Trls_Daily_Activity_tbl';
  /* target = Trls_Daily_Activity_tbl (same as the Access query “INSERT INTO Trls_Daily_Activity_tbl … SELECT … FROM Trips_Planning_tbl WHERE Uploaded = No”) */
  const TF = [['Trans_Date', 'Trans date ← Plan_Date'], ['User_Name', 'User name ← Driver_Name'], ['Unit_Nr', 'Unit no. ← Unit_Nr'], ['Trailer_Nr', 'Trailer no. ← Trailer_Nr'], ['Distn_From', 'Destination from ← Destination_From_Value'], ['Loaction_From', 'Location from ← Location_From_Value'],
    ['Distn_To', 'Destination to ← Destination_To_Value'], ['Location_To', 'Location to ← Location_To_Value'], ['Nr_of_Plts', 'No. of pallets ← Nr_of_Plts'], ['Task_Source', 'Task source = “Plan Upload”'], ['Task_Type', 'Task type = “Plan Trip”'], ['Remarks', 'Remarks ← Trip_Instrucations'],
    ['Uploaded_By', 'Uploaded by = signed-in user'], ['Trip_Status', 'Trip status = “Planned”'], ['Title', 'Title (empty)'], ['Plan_Date', 'Plan date ← Plan_Date'], ['Upload_TimeStamp', 'Upload time stamp = now'], ['Loaded_Mtrl_Type', 'Loaded material ← Loaded_Mtrl_Type_Value'], ['Plan_Link', 'Plan link ← RcdID (duplicates are skipped)'], ['Driver_FileNr', 'Driver file no. ← Driver_File_Nr']];
  utRegister(DID, { section: 'Logistics', label: 'Ready plan (Excel) → ' + DDEF, fields: () => TF.map(([k, l]) => ({ key: k, label: l, alias: [k], doc: true })), note: 'Used by Logistics trip plan → “Ready plan → SharePoint”. Each Excel row (Trips_Planning_tbl layout, rows with Uploaded = Yes are skipped) becomes one trip in this list. Default list ' + DDEF + '; the administrator can choose another list and map the columns here.' });
  const dst = () => { const c = utGet(DID); if (!c.list) utSet(DID, { list: DDEF, map: c.map || {} }); return utGet(DID).list; };
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv'; inp.hidden = true; inp.id = 'lpReadyFile'; document.body.appendChild(inp);
  const seen = () => { try { return JSON.parse(localStorage.getItem(RK) || '{}'); } catch (e) { return {}; } };
  document.addEventListener('click', e => { const b = e.target.closest('[data-a="imp-rdy"]'); if (!b) return; e.stopPropagation(); e.preventDefault();
    try { lpInit(); } catch (x) {}
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
      const name = dst(), token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) return sectionToast('Sign in / set the Site URL first.', 'warn');
      if (typeof isListVisible === 'function' && (!isListVisible(name) || !isListEditable(name))) return sectionToast('No write permission on "' + name + '".', 'error');
      const gv = (o, k) => { const h = Object.keys(o).find(x => N(x) === k); return h ? o[h] : undefined; }, yes = v => /^(true|yes|y|1|-1|✔)$/i.test(String(v == null ? '' : v).trim());
      const pad = n => String(n).padStart(2, '0'), d0 = new Date(), now = d0.getFullYear() + '-' + pad(d0.getMonth() + 1) + '-' + pad(d0.getDate()) + ' ' + pad(d0.getHours()) + ':' + pad(d0.getMinutes()) + ':' + pad(d0.getSeconds()), by = getCurrentUserValue();
      const todo = P.rows.filter(r => !yes(gv(r.raw, 'uploaded')));   /* WHERE Uploaded = No */
      const T = todo.map(r => { const o = r.raw, pd = lpDate(gv(o, 'plandate')); return { r, rec: { Trans_Date: pd, User_Name: lpS(gv(o, 'drivername')), Unit_Nr: lpS(gv(o, 'unitnr')), Trailer_Nr: lpS(gv(o, 'trailernr')), Distn_From: lpS(gv(o, 'destinationfromvalue')), Loaction_From: lpS(gv(o, 'locationfromvalue')),
        Distn_To: lpS(gv(o, 'destinationtovalue')), Location_To: lpS(gv(o, 'locationtovalue')), Nr_of_Plts: gv(o, 'nrofplts') == null || gv(o, 'nrofplts') === '' ? '' : lpNum(gv(o, 'nrofplts')), Task_Source: 'Plan Upload', Task_Type: 'Plan Trip', Remarks: lpS(gv(o, 'tripinstrucations')), Uploaded_By: by, Trip_Status: 'Planned', Title: '',
        Plan_Date: pd, Upload_TimeStamp: now, Loaded_Mtrl_Type: lpS(gv(o, 'loadedmtrltypevalue')), Plan_Link: lpS(gv(o, 'rcdid')), Driver_FileNr: lpS(gv(o, 'driverfilenr')) } }; });
      sectionToast('Checking "' + name + '" for trips already uploaded…', 'warn');
      const map = await utEffMap(DID), col = k => map[k] && map[k] !== SKIP_VALUE ? map[k] : null, sigOf = x => [x.Trans_Date, x.Unit_Nr, x.User_Name, x.Distn_From, x.Distn_To].map(v => String(v == null ? '' : v).trim().toLowerCase()).join('|');
      if (!Object.values(map).some(v => v && v !== SKIP_VALUE)) return sectionToast('"' + name + '" has none of the columns (Trans_Date, Unit_Nr, …) — the administrator maps them in Upload Destinations → ' + 'Ready plan (Excel) → ' + DDEF + '.', 'error');
      const have = new Set(), haveSig = new Set(); try { const ids = await resolveIds(siteUrl, name, token), its = await fetchAllItems(ids.siteId, ids.listId, token); its.forEach(it => { const f = it.fields || {}, g = k => col(k) ? f[col(k)] : ''; const pl = String(g('Plan_Link') == null ? '' : g('Plan_Link')).trim(); if (pl) have.add(pl); haveSig.add(sigOf({ Trans_Date: lpDate(g('Trans_Date')), Unit_Nr: g('Unit_Nr'), User_Name: g('User_Name'), Distn_From: g('Distn_From'), Distn_To: g('Distn_To') })); }); } catch (e) {}
      const dupe = x => x.rec.Plan_Link ? have.has(String(x.rec.Plan_Link)) : haveSig.has(sigOf(x.rec)), NEW = T.filter(x => !dupe(x)), skipU = P.rows.length - todo.length, skipD = T.length - NEW.length;
      const ds = [...new Set(P.rows.map(r => r.plan.date))].sort(), unmapped = TF.map(f => f[0]).filter(k => !col(k) && k !== 'Title');
      spAsk.extra = ''; const q = 'Push ' + NEW.length + ' trip(s) of the ready plan to "' + name + '"?\n' + ds[0] + (ds.length > 1 ? ' → ' + ds[ds.length - 1] : '') + ' · ' + new Set(NEW.map(x => x.rec.User_Name)).size + ' driver(s) · ' + NEW.filter(x => lpNum(x.rec.Nr_of_Plts) > 0).length + ' loaded trips\nTask source “Plan Upload” · task type “Plan Trip” · status “Planned”' + (skipD ? '\n' + skipD + ' trip(s) already in the list (same Plan_Link / RcdID) are skipped.' : '') + (skipU ? '\n' + skipU + ' row(s) marked Uploaded = Yes in the file are skipped.' : '') + (unmapped.length ? '\n⚠ Not found in the list (left out): ' + unmapped.join(', ') : '');
      if (!NEW.length) { const D = new Set(ds); lp.rows = lp.rows.filter(r => !(r.src === 'Ready plan' && r.region === region && D.has(r.date))).concat(P.rows.map(r => r.plan)); ds.forEach(d => lp.days.add(d)); lpSave(); lpRender(); return sectionToast('Nothing new to push — all ' + T.length + ' trip(s) are already in "' + name + '". The plan is shown here.', 'warn'); }
      if (!(await spAsk(q))) return;
      const D = new Set(ds); lp.rows = lp.rows.filter(r => !(r.src === 'Ready plan' && r.region === region && D.has(r.date))).concat(P.rows.map(r => r.plan)); ds.forEach(d => lp.days.add(d)); lpSave(); lpRender();
      const st = document.querySelector('#lpUpStatus'); const res = await utPush(DID, NEW.map(x => x.rec), x => (x.User_Name || '') + ' ' + (x.Unit_Nr || '') + ' ' + (x.Plan_Date || ''), (n, t) => { if (st) st.textContent = 'Ready plan → ' + name + ': ' + n + ' / ' + t; });
      if (res.ok) { NEW.forEach(x => { x.r.plan.up = Date.now(); }); const s = seen(); s[f.name + '|' + f.size + '|' + name] = new Date().toLocaleString(); try { localStorage.setItem(RK, JSON.stringify(s)); } catch (x) {} } lpSave(); lpRender();
      sectionToast(res.fail ? '⚠ ' + res.ok + ' pushed, ' + res.fail + ' failed. ' + res.errors.slice(0, 3).join(' | ') : '✅ Ready plan: ' + res.ok + ' trip(s) pushed to "' + name + '" as Planned' + (skipD ? ' · ' + skipD + ' duplicate(s) skipped' : '') + '.', res.fail ? 'warn' : 'success');
      try { w_logToActivity('Ready plan "' + f.name + '" → "' + name + '": ' + res.ok + ' ok, ' + res.fail + ' failed, ' + skipD + ' duplicate(s) skipped'); } catch (x) {}
    } catch (err) { sectionToast('✘ ' + err.message, 'error'); }
  }
})();
