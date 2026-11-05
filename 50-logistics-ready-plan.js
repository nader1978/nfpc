/* ============================================================
   LOGISTICS — READY PLAN (Excel whose headers are the SharePoint column names, e.g. Plan_Date, Driver_File_Nr, Unit_Nr …)
   Read the file → the trips wait “in transit” here (edit / untick / delete) → ☁ Upload pushes them to Trls_Daily_Activity_tbl (or the list the admin chose), ✖ Clear drops them.
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
  /* ---------- in transit: the file is staged here first — edit, untick or delete rows, then ☁ Upload (or ✖ Clear) ---------- */
  const SK = LS_BASE + '_lp_stage', ST = (() => { try { return JSON.parse(localStorage.getItem(SK) || 'null') || { rows: [] }; } catch (e) { return { rows: [] }; } })();
  const stSave = () => { try { localStorage.setItem(SK, JSON.stringify(ST)); } catch (e) {} };
  const gv = (o, k) => { const h = Object.keys(o).find(x => N(x) === k); return h ? o[h] : undefined; }, yes = v => /^(true|yes|y|1|-1|✔)$/i.test(String(v == null ? '' : v).trim());
  const COLS = [['Plan_Date', 'Plan date', 'date', 120], ['User_Name', 'Driver', 'text', 130], ['Driver_FileNr', 'File no.', 'text', 80], ['Unit_Nr', 'Unit no.', 'text', 90], ['Trailer_Nr', 'Trailer no.', 'text', 90], ['Distn_From', 'From', 'text', 130], ['Loaction_From', 'Loc. from', 'text', 80],
    ['Distn_To', 'To', 'text', 130], ['Location_To', 'Loc. to', 'text', 80], ['Nr_of_Plts', 'Pallets', 'num', 64], ['Loaded_Mtrl_Type', 'Material', 'text', 100], ['Remarks', 'Remarks / instructions', 'text', 180]];
  const sigOf = x => [x.Plan_Date, x.Unit_Nr, x.User_Name, x.Distn_From, x.Distn_To].map(v => String(v == null ? '' : v).trim().toLowerCase()).join('|');
  async function dupCheck() {   /* trips already in the list: same Plan_Link (RcdID), else same date + unit + driver + from + to */
    const name = dst(), token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) { ST.chk = 'not checked (sign in first)'; return; }
    try { const map = await utEffMap(DID), col = k => map[k] && map[k] !== SKIP_VALUE ? map[k] : null, ids = await resolveIds(site, name, token), its = await fetchAllItems(ids.siteId, ids.listId, token), have = new Set(), hs = new Set();
      its.forEach(it => { const f = it.fields || {}, g = k => col(k) ? f[col(k)] : ''; const pl = String(g('Plan_Link') == null ? '' : g('Plan_Link')).trim(); if (pl) have.add(pl); hs.add(sigOf({ Plan_Date: lpDate(g('Trans_Date') || g('Plan_Date')), Unit_Nr: g('Unit_Nr'), User_Name: g('User_Name'), Distn_From: g('Distn_From'), Distn_To: g('Distn_To') })); });
      ST.rows.forEach(r => { const d = r.rec.Plan_Link ? have.has(String(r.rec.Plan_Link)) : hs.has(sigOf(r.rec)); if (d && !r.dup) r.sel = false; r.dup = d; }); ST.chk = 'checked against "' + name + '" · ' + new Date().toLocaleTimeString(); ST.unm = TF.map(x => x[0]).filter(k => !col(k) && k !== 'Title'); }
    catch (e) { ST.chk = 'could not check "' + name + '": ' + e.message; } }
  /* delete / replace question (not the upload dialog) */
  function askDel(title, text, okLbl) { return new Promise(res => { const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px'; o.dataset.nohc = '1';
    o.innerHTML = `<div role="dialog" aria-modal="true" style="background:var(--card,#fff);color:var(--text,#222);border-radius:12px;max-width:500px;width:100%;padding:18px 20px;box-shadow:0 10px 40px rgba(0,0,0,.35)"><div style="font-weight:700;font-size:16px;margin-bottom:8px">${lpEsc(title)}</div><div style="font-size:13px;line-height:1.55;margin-bottom:14px">${text}</div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="ghost" data-v="0">Cancel</button><button type="button" data-v="1" style="background:#b91c1c;border-color:#b91c1c;color:#fff">${lpEsc(okLbl || 'Delete')}</button></div></div>`;
    const done = v => { o.remove(); document.removeEventListener('keydown', kd, true); res(v); }, kd = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    o.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) done(b.dataset.v === '1'); else if (e.target === o) done(false); }); document.addEventListener('keydown', kd, true); document.body.appendChild(o); }); }
  async function run(f) {
    try {
      if (!hasPerm('logplan') && !hasPerm('uploader')) return alert('Permission denied.');
      const region = /\bSE\b|_SE|SE_/i.test(f.name) ? 'SE' : 'NE', wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), P = parse(wb, region);
      if (!P) return sectionToast('No ready plan found — the sheet needs a header row with Plan_Date, Driver_Name, Unit_Nr …', 'warn');
      if (ST.rows.length && !(await askDel('🔁 Replace the trips in transit?', 'There are <b>' + ST.rows.length + '</b> ready-plan trip(s) still in transit (not uploaded).<br>They will be <b>deleted</b> and replaced by the trips of <b>' + lpEsc(f.name) + '</b>. Nothing is uploaded to SharePoint.', 'Replace'))) return;
      const todo = P.rows.filter(r => !yes(gv(r.raw, 'uploaded')));   /* WHERE Uploaded = No */
      ST.file = f.name; ST.region = region; ST.at = new Date().toLocaleString(); ST.skipU = P.rows.length - todo.length; ST.chk = ''; ST.unm = [];
      ST.rows = todo.map(r => { const o = r.raw, pd = lpDate(gv(o, 'plandate')), np = gv(o, 'nrofplts'); return { id: lpId(), sel: true, dup: false, shift: lpS(gv(o, 'triptimming')), rec: { Plan_Date: pd, User_Name: lpS(gv(o, 'drivername')), Driver_FileNr: lpS(gv(o, 'driverfilenr')), Unit_Nr: lpS(gv(o, 'unitnr')), Trailer_Nr: lpS(gv(o, 'trailernr')),
        Distn_From: lpS(gv(o, 'destinationfromvalue')), Loaction_From: lpS(gv(o, 'locationfromvalue')), Distn_To: lpS(gv(o, 'destinationtovalue')), Location_To: lpS(gv(o, 'locationtovalue')), Nr_of_Plts: np == null || np === '' ? '' : lpNum(np), Loaded_Mtrl_Type: lpS(gv(o, 'loadedmtrltypevalue')), Remarks: lpS(gv(o, 'tripinstrucations')), Plan_Link: lpS(gv(o, 'rcdid')) } }; });
      stSave(); stRender(true); sectionToast('📥 ' + ST.rows.length + ' trip(s) of "' + f.name + '" are in transit — check / edit them, then press ☁ Upload.', 'success');
      await dupCheck(); stSave(); stRender(true);
    } catch (err) { sectionToast('✘ ' + err.message, 'error'); }
  }
  async function upload() {
    const R = ST.rows.filter(r => r.sel); if (!R.length) return sectionToast('Tick the trips to upload first.', 'warn'); const name = dst();
    const bad = R.filter(r => !r.rec.Plan_Date || !(r.rec.User_Name || r.rec.Unit_Nr)); if (bad.length) return sectionToast(bad.length + ' ticked row(s) have no plan date or no driver / unit — fix or untick them.', 'warn');
    const dd = R.filter(r => r.dup).length, pad = n => String(n).padStart(2, '0'), d0 = new Date(), now = d0.getFullYear() + '-' + pad(d0.getMonth() + 1) + '-' + pad(d0.getDate()) + ' ' + pad(d0.getHours()) + ':' + pad(d0.getMinutes()) + ':' + pad(d0.getSeconds()), by = getCurrentUserValue();
    spAsk.extra = ''; if (!(await spAsk('Upload ' + R.length + ' trip(s) to "' + name + '"?\nTask source “Plan Upload” · task type “Plan Trip” · status “Planned”' + (dd ? '\n⚠ ' + dd + ' of them are already in the list — they will be added again.' : '') + (ST.unm && ST.unm.length ? '\n⚠ Not in the list (left out): ' + ST.unm.join(', ') : '')))) return;
    const out = R.map(r => Object.assign({ Trans_Date: r.rec.Plan_Date }, r.rec, { Nr_of_Plts: r.rec.Nr_of_Plts === '' ? '' : lpNum(r.rec.Nr_of_Plts), Task_Source: 'Plan Upload', Task_Type: 'Plan Trip', Uploaded_By: by, Trip_Status: 'Planned', Title: '', Upload_TimeStamp: now }));
    const st = document.querySelector('#lpStgMsg'); ST.busy = true; stRender();
    try { const res = await utPush(DID, out, x => (x.User_Name || '') + ' ' + (x.Unit_Nr || '') + ' ' + (x.Plan_Date || ''), (n, t) => { const e = document.querySelector('#lpStgMsg'); if (e) e.textContent = 'Uploading… ' + n + ' / ' + t; });
      if (res.fail) { sectionToast('⚠ ' + res.ok + ' uploaded, ' + res.fail + ' failed — nothing was removed from transit. ' + res.errors.slice(0, 3).join(' | '), 'warn'); }
      else { const ds = [...new Set(R.map(r => r.rec.Plan_Date))], D = new Set(ds), reg = ST.region || 'NE';
        lp.rows = lp.rows.concat(R.map(r => { const x = r.rec, loaded = lpNum(x.Nr_of_Plts) > 0; return { id: lpId(), date: x.Plan_Date, region: reg, shift: r.shift || '', fileNo: x.Driver_FileNr, driver: x.User_Name, mobile: '', regNo: x.Unit_Nr, trailer: x.Trailer_Nr, trailerType: '', bu: x.Loaded_Mtrl_Type, from: x.Distn_From, to: x.Distn_To, trip1: [x.Distn_From, x.Distn_To].filter(Boolean).join(' - ') + (x.Loaded_Mtrl_Type ? ' (' + x.Loaded_Mtrl_Type + ')' : '') + (loaded ? ' - ' + lpNum(x.Nr_of_Plts) + ' plts' : ''), trip2: '', planned: loaded ? 1 : 0, done: 0, missed: 0, vehStatus: '', remarks: x.Remarks, src: 'Ready plan', manual: loaded ? 0 : 1, up: Date.now() }; }));
        ds.forEach(d => lp.days.add(d)); lpSave(); const ids = new Set(R.map(r => r.id)); ST.rows = ST.rows.filter(r => !ids.has(r.id)); stSave(); lpRender();
        sectionToast('✅ ' + res.ok + ' trip(s) uploaded to "' + name + '" as Planned' + (ST.rows.length ? ' · ' + ST.rows.length + ' row(s) still in transit' : '') + '.', 'success'); }
      try { w_logToActivity('Ready plan "' + (ST.file || '') + '" → "' + name + '": ' + res.ok + ' ok, ' + res.fail + ' failed'); } catch (x) {}
    } catch (e) { sectionToast('✘ ' + e.message, 'error'); } finally { ST.busy = false; stRender(); }
  }
  function stRender(scroll) {
    const P = document.querySelector('#lpPanePlan'), act = P && P.querySelector('#lpActBody'); if (!act) return; const grp = act.closest('.lp-grp') || act; let box = P.querySelector('#lpStage');
    if (!ST.rows.length) { if (box) box.remove(); return; } if (!box) { box = document.createElement('div'); box.id = 'lpStage'; box.dataset.noct = '1'; box.dataset.nohc = '1'; box.style.cssText = 'border:2px solid #f59e0b;border-radius:12px;padding:10px 12px;margin:0 0 10px;background:rgba(254,243,199,.35)'; grp.after(box); }
    const n = ST.rows.length, ns = ST.rows.filter(r => r.sel).length, nd = ST.rows.filter(r => r.dup).length, E = lpEsc;
    box.innerHTML = `<div class="pl-frow" style="justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b>📥 Ready plan — in transit (not uploaded yet)</b><span class="text-sm">${E(ST.file || '')} · read ${E(ST.at || '')} · ${n} trip(s)${nd ? ' · <b style="color:#b45309">' + nd + ' already in the list (unticked)</b>' : ''}${ST.skipU ? ' · ' + ST.skipU + ' row(s) with Uploaded = Yes left out' : ''}</span></div>
      <div class="btn-row" style="margin:8px 0;gap:8px;flex-wrap:wrap;align-items:center"><button class="success small" type="button" data-stg="up" ${ns && !ST.busy ? '' : 'disabled'}>☁ Upload ${ns} selected to ${E(dst())}</button><button class="secondary small" type="button" data-stg="all">☑ Select all new</button><button class="secondary small" type="button" data-stg="none">☐ Select none</button><button class="secondary small" type="button" data-stg="chk">🔄 Re-check duplicates</button><span class="tm-sep"></span><button class="danger small" type="button" data-stg="clr" style="background:#b91c1c;color:#fff;border-color:#b91c1c">✖ Clear — do not upload</button><span class="text-sm" id="lpStgMsg">${E(ST.chk || '')}</span></div>
      <div class="text-sm" style="margin-bottom:6px">Edit any cell before uploading. Each trip is written to <b>${E(dst())}</b> with Task source “Plan Upload”, Task type “Plan Trip”, Trip status “Planned”, Uploaded by you and the upload time; Plan_Link = RcdID. The administrator chooses the list in Upload Destinations → Logistics.</div>
      <div class="fd-wrap" style="max-height:420px;overflow:auto"><table class="fd-tbl" style="font-size:12px"><thead><tr><th><input type="checkbox" data-stg="tog" ${ns === n ? 'checked' : ''} style="width:auto;margin:0"></th>${COLS.map(c => `<th>${c[1]}</th>`).join('')}<th>RcdID</th><th>Status</th><th></th></tr></thead><tbody>
      ${ST.rows.map(r => `<tr data-sid="${r.id}" style="${r.dup ? 'background:rgba(245,158,11,.15)' : ''}${r.sel ? '' : ';opacity:.6'}"><td><input type="checkbox" data-sel ${r.sel ? 'checked' : ''} style="width:auto;margin:0"></td>${COLS.map(c => `<td><input data-k="${c[0]}" type="${c[2] === 'date' ? 'date' : 'text'}" ${c[2] === 'num' ? 'inputmode="decimal"' : ''} value="${E(r.rec[c[0]])}" style="width:${c[3]}px;margin:0;padding:3px 5px;font-size:12px"></td>`).join('')}<td>${E(r.rec.Plan_Link)}</td><td>${r.dup ? '<b style="color:#b45309">⚠ in list</b>' : '<span style="color:#15803d">New</span>'}</td><td><button class="ghost small" type="button" data-stg="del" title="Remove this row from transit">✕</button></td></tr>`).join('')}</tbody></table></div>`;
    if (scroll) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  document.addEventListener('click', async e => { const b = e.target.closest && e.target.closest('#lpStage [data-stg]'); if (!b) return; const a = b.dataset.stg, tr = b.closest('tr[data-sid]'), row = tr && ST.rows.find(r => r.id === tr.dataset.sid);
    if (a === 'up') return upload(); if (a === 'all') ST.rows.forEach(r => { r.sel = !r.dup; }); else if (a === 'none') ST.rows.forEach(r => { r.sel = false; }); else if (a === 'tog') { const on = b.checked; ST.rows.forEach(r => { r.sel = on; }); }
    else if (a === 'chk') { const m = document.querySelector('#lpStgMsg'); if (m) m.textContent = 'Checking…'; await dupCheck(); }
    else if (a === 'del' && row) { ST.rows = ST.rows.filter(r => r !== row); }
    else if (a === 'clr') { if (!(await askDel('🗑 Clear the ready plan?', 'All <b>' + ST.rows.length + '</b> trip(s) in transit will be <b>deleted</b> from this screen.<br><b>Nothing is uploaded to SharePoint</b> — read the Excel file again if you need them later.', '🗑 Delete all'))) return; ST.rows = []; sectionToast('Ready plan cleared — nothing was uploaded.', 'success'); }
    stSave(); stRender(); });
  document.addEventListener('change', e => { const t = e.target; if (!t.closest || !t.closest('#lpStage')) return; const tr = t.closest('tr[data-sid]'), row = tr && ST.rows.find(r => r.id === tr.dataset.sid); if (!row) return;
    if (t.hasAttribute('data-sel')) { row.sel = t.checked; stSave(); stRender(); return; } const k = t.dataset.k; if (!k) return; row.rec[k] = k === 'Nr_of_Plts' ? (t.value.trim() === '' ? '' : lpNum(t.value)) : t.value.trim(); stSave(); });
  try { const _r = lpRender; lpRender = function () { const x = _r.apply(this, arguments); try { stRender(); } catch (e) {} return x; }; } catch (e) {}
  setInterval(() => { if (ST.rows.length && document.querySelector('#lpActBody') && !document.querySelector('#lpStage')) stRender(); }, 1500);
})();
