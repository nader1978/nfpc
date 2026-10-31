/* ---------- tabs / refresh ---------- */
const AT_TABS = [['up', '📥 Upload'], ['dash', '📊 Dashboard'], ['ot', '⏱ Overtime'], ['st', '👤 By staff'], ['sw', '🏭 Staff & warehouse hours'], ['kpi', '🎯 KPIs vs targets'], ['cmp', '🆚 Roster vs actual'], ['ty', '📅 Today vs yesterday'], ['lk', '⚖ OT vs Mngt report'], ['oth', '🧭 Not in Mngt report'], ['pd', '🧾 Punch detail'], ['rec', '📋 Records']];
function atRefresh(keepFilters) {
  try { if (typeof a2EAuto === 'function') a2EAuto(); } catch (e) {}
  cmCache = null; atTabsRender(); const has = at.rows.length; try { a2LkRange(); } catch (e) {}
  PLQ('#atSrcLine').textContent = has ? `${plF(at.rows.length)} record(s) · ${atDates().map(atDateLabel).join(' · ')} · ${at.file || ''}${at.loaded ? ' · loaded ' + at.loaded : ''}` : 'No attendance loaded yet — upload the biometric Attendance Detail Report.';
  if (!keepFilters) atFilterRender(); else { const c = PLQ('#atFilterCard'); c.style.display = has && at.tab !== 'up' ? '' : 'none'; PLQ('#atFHost').dataset.sig = ''; atFilterRender(); }
  PLQ('#atCount').textContent = has ? `${plF(atView().length)} of ${plF(at.rows.length)} records` : '';
  if (!has) { if (at.tab !== 'up') { at.tab = 'up'; atTabsRender(); } }
  document.querySelectorAll('#view-att .at-pane').forEach(p => p.style.display = p.dataset.p === at.tab ? '' : 'none'); if (at.tab !== 'up') PLQ('#atFilterCard').style.display = has ? '' : 'none';
  if (!has) { PLQ('#atUpInfo').textContent = ''; return; }
  PLQ('#atUpInfo').innerHTML = `Loaded: <strong>${plF(at.rows.length)}</strong> records · <strong>${new Set(at.rows.map(r => r.id)).size}</strong> employees · dates ${atDates().map(atDateLabel).join(', ')}.`;
  if (at.tab === 'dash') { atDashKpis(); atDrawGrid(PLQ('#atGrid'), AT_DEFS, { rows: () => atView() }); } else if (at.tab === 'cmp') cmRender(); else if (at.tab === 'ot') a2OtRender(); else if (at.tab === 'st') a2StRender(); else if (at.tab === 'ty') a2TyRender(); else if (at.tab === 'lk') a2LkRender(); else if (at.tab === 'pd') pdRender(); else if (at.tab === 'rec') rcRender(); else if (at.tab === 'oth') a2OthRender(); else if (at.tab === 'sw') a2SwRender(); else if (at.tab === 'kpi') kpRender();
}
function atTabsRender() { PLQ('#atTabs').innerHTML = AT_TABS.map(t => `<button type="button" data-t="${t[0]}" class="${at.tab === t[0] ? 'on' : ''}" ${t[0] !== 'up' && !at.rows.length ? 'disabled style="opacity:.45"' : ''}>${t[1]}</button>`).join(''); }

/* ---------- attendance data kept in SharePoint (JSON file) ---------- */
const AT_SP_KEY = LS_BASE + '_atsp', AT_SP_DEF = { on: true, folder: 'AttendanceData', file: 'attendance.json', mod: '' };
const atSpCfg = () => { try { return Object.assign({}, AT_SP_DEF, JSON.parse(localStorage.getItem(AT_SP_KEY) || '{}')); } catch (e) { return Object.assign({}, AT_SP_DEF); } };
const atSpCfgSave = o => { try { localStorage.setItem(AT_SP_KEY, JSON.stringify(Object.assign(atSpCfg(), o))); } catch (e) {} };
const atSpOk = () => !!(getGlobalAccessToken() && getGlobalSiteUrl());
function atSpPath() { const c = atSpCfg(), f = String(c.folder || '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).map(encodeURIComponent).join('/'), n = encodeURIComponent((c.file || 'attendance.json').replace(/[\\/:*?"<>|#%]/g, '_')); return (f ? f + '/' : '') + n; }
async function atSpErr(r) { let t = ''; try { t = (await r.json()).error.message; } catch (e) {} return new Error(`SharePoint said HTTP ${r.status}${t ? ': ' + t : ''}`); }
async function atSpSave() {
  const { siteId, token } = await plSp(), base = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${atSpPath()}:`;
  const payload = JSON.stringify({ version: 1, saved: new Date().toISOString(), file: at.file, loaded: at.loaded, grace: at.grace, count: at.rows.length, rows: at.rows.map(r => { const o = Object.assign({}, r); delete o._t; return o; }) }), blob = new Blob([payload], { type: 'application/json' });
  let item;
  if (blob.size < 3500000) {
    const r = await fetchWithRetry(base + '/content?@microsoft.graph.conflictBehavior=replace', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: blob }, 'save attendance'); if (!r.ok) throw await atSpErr(r); item = await r.json();
  } else {
    const r = await fetchWithRetry(base + '/createUploadSession', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }) }, 'start upload'); if (!r.ok) throw await atSpErr(r);
    const url = (await r.json()).uploadUrl, CH = 327680 * 10; let pos = 0;
    while (pos < blob.size) { const end = Math.min(pos + CH, blob.size), pr = await fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes ${pos}-${end - 1}/${blob.size}` }, body: blob.slice(pos, end) }); if (!pr.ok && pr.status !== 202) throw await atSpErr(pr); if (pr.status === 200 || pr.status === 201) item = await pr.json(); pos = end; }
    if (!item) throw new Error('SharePoint did not confirm the upload.');
  }
  atSpCfgSave({ mod: item.lastModifiedDateTime || '' }); return { size: blob.size, mod: item.lastModifiedDateTime };
}
async function atSpRemote() {
  const { siteId, token } = await plSp(), r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${atSpPath()}`, { headers: { Authorization: `Bearer ${token}` } }, 'check attendance file');
  if (r.status === 404) return null; if (!r.ok) throw await atSpErr(r); const it = await r.json(); return { mod: it.lastModifiedDateTime || '', size: it.size, url: it['@microsoft.graph.downloadUrl'], token, siteId };
}
async function atSpLoad(meta) {
  let r = meta.url ? await fetch(meta.url).catch(() => null) : null;
  if (!r || !r.ok) r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${meta.siteId}/drive/root:/${atSpPath()}:/content`, { headers: { Authorization: `Bearer ${meta.token}` } }, 'download attendance');
  if (!r.ok) throw await atSpErr(r); const d = await r.json(); if (!d || !Array.isArray(d.rows)) throw new Error('That SharePoint file is not an attendance JSON.');
  at.rows = d.rows.map(atIndex); at.file = d.file || ''; at.loaded = d.loaded || ''; at.grace = d.grace != null ? d.grace : 15; at.f = {}; at.q = []; atSave(); atSpCfgSave({ mod: meta.mod }); a2Bump(); return d.rows.length;
}
function atSpMsg(t, k) { const m = PLQ('#atSpMsg'); if (m) { m.className = 'status-msg' + (k ? ' ' + k : ''); m.textContent = t; } }
async function atSpAuto() {
  const c = atSpCfg(); if (!c.on) return; if (!atSpOk()) { atSpMsg('Not saved to SharePoint — connect the site first (Settings).', 'err'); return; }
  atSpMsg('Saving to SharePoint…');
  try { const x = await atSpSave(); atSpMsg(`✓ Saved ${plF(at.rows.length)} record(s) to SharePoint — ${decodeURIComponent(atSpPath())} (${(x.size / 1048576).toFixed(2)} MB).`, 'ok'); sectionToast('Attendance data saved to SharePoint.', 'success'); addActivity('upload', 'Attendance saved to SharePoint JSON'); }
  catch (e) { atSpMsg('✘ Could not save to SharePoint: ' + e.message, 'err'); }
}
async function atSpSync(quiet) {
  const c = atSpCfg(); if (!c.on || !atSpOk() || atSpSync.busy) return; atSpSync.busy = true;
  try {
    const m = await atSpRemote();
    if (!m) { if (at.rows.length) await atSpAuto(); return; }
    if (m.mod === c.mod && at.rows.length) return;
    if (!at.rows.length || (c.mod && m.mod !== c.mod)) { atSpMsg('Loading the attendance data from SharePoint…'); const n = await atSpLoad(m); if (at.tab === 'up') at.tab = 'dash'; atSpMsg(`✓ Loaded ${plF(n)} record(s) from SharePoint (saved ${new Date(m.mod).toLocaleString('en-GB')}).`, 'ok'); if (!quiet) sectionToast('Attendance data loaded from SharePoint.', 'success'); atRefresh(); }
    else atSpMsg('A SharePoint copy exists (' + new Date(m.mod).toLocaleString('en-GB') + ') but this browser already has data — use “Load from SharePoint” to replace it, or “Save to SharePoint now” to overwrite the copy.', '');
  } catch (e) { atSpMsg('✘ SharePoint: ' + e.message, 'err'); } finally { atSpSync.busy = false; }
}
function atSpInit() {
  const q = PLQ, c = atSpCfg(); q('#atSpOn').checked = !!c.on; q('#atSpFolder').value = c.folder; q('#atSpFile').value = c.file;
  q('#atSpOn').addEventListener('change', e => { atSpCfgSave({ on: e.target.checked }); if (e.target.checked) atSpSync(); });
  q('#atSpFolder').addEventListener('change', e => atSpCfgSave({ folder: e.target.value.trim() || AT_SP_DEF.folder, mod: '' })); q('#atSpFile').addEventListener('change', e => { let v = e.target.value.trim() || AT_SP_DEF.file; if (!/\.json$/i.test(v)) v += '.json'; e.target.value = v; atSpCfgSave({ file: v, mod: '' }); });
  q('#atSpSave').addEventListener('click', async () => { if (!at.rows.length) { sectionToast('No attendance data to save yet.', 'warn'); return; } if (!atSpOk()) { sectionToast('Connect the SharePoint site first.', 'warn'); return; } const on = atSpCfg().on; atSpCfgSave({ on: true }); await atSpAuto(); atSpCfgSave({ on }); });
  q('#atSpLoad').addEventListener('click', async () => { if (!atSpOk()) { sectionToast('Connect the SharePoint site first.', 'warn'); return; } atSpMsg('Looking for the file…'); try { const m = await atSpRemote(); if (!m) { atSpMsg('No attendance JSON found in that folder yet.', 'err'); return; } if (at.rows.length && !confirm('Replace the ' + plF(at.rows.length) + ' attendance record(s) in this browser with the SharePoint copy?')) { atSpMsg(''); return; } const n = await atSpLoad(m); atSpMsg(`✓ Loaded ${plF(n)} record(s) from SharePoint.`, 'ok'); atRefresh(); } catch (e) { atSpMsg('✘ ' + e.message, 'err'); } });
}
async function atUpload(file) {
  const msg = PLQ('#atUpMsg'); msg.className = 'status-msg'; msg.textContent = 'Reading “' + file.name + '”…';
  try {
    const P = await atReadFile(file), mode = PLQ('#atMode').value; let added = 0, upd = 0;
    if (mode === 'replace') { at.rows = P.rows; added = P.rows.length; } else { const idx = new Map(at.rows.map((r, i) => [r.date + '|' + atKey(r.id), i])); P.rows.forEach(r => { const k = r.date + '|' + atKey(r.id); if (idx.has(k)) { at.rows[idx.get(k)] = r; upd++; } else { at.rows.push(r); idx.set(k, at.rows.length - 1); added++; } }); }
    at.file = file.name; at.loaded = new Date().toLocaleString('en-GB'); at.f = {}; at.q = []; at.sort = { cm: null, rc: null }; at.cmRes = ''; atSave(); atSpAuto();
    msg.className = 'status-msg ok'; msg.textContent = `✓ ${plF(added)} record(s) added${upd ? `, ${plF(upd)} updated` : ''}${P.skipped ? ` · ${P.skipped} non-data row(s) skipped (totals / blanks)` : ''}.`;
    addActivity('upload', 'Attendance report loaded: ' + file.name); if (typeof a2AfterUpload === 'function') { try { a2AfterUpload(msg); } catch (e2) { console.error(e2); } } at.tab = 'dash'; atRefresh();
  } catch (e) { msg.className = 'status-msg err'; msg.textContent = '✘ ' + e.message; }
}
function atInit() {
  if (at.inited) return; at.inited = true; atLoad(); a2Init(); atSpInit(); const q = PLQ;
  q('#atTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b || b.disabled) return; at.tab = b.dataset.t; at.shown = at.rcShown = 200; atRefresh(true); });
  const dz = q('#atDrop'), fi = q('#atFile'); dz.addEventListener('click', () => fi.click()); dz.addEventListener('keydown', e => { if (e.key === 'Enter') fi.click(); }); fi.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) atUpload(f); });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); }); dz.addEventListener('dragleave', () => dz.classList.remove('drag')); dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) atUpload(f); });
  q('#atClear').addEventListener('click', () => { if (!at.rows.length || !confirm('Remove all loaded attendance records?')) return; at.rows = []; at.f = {}; at.q = []; at.file = ''; try { localStorage.removeItem(AT_KEY); } catch (e) {} q('#atUpMsg').textContent = ''; atRefresh(); });
  q('#atClearF').addEventListener('click', () => { at.f = {}; at.q = []; at.cmRes = ''; q('#atSearchHost').dataset.sig = ''; atRefresh(); });
  q('#atGrace').addEventListener('change', e => { const v = Math.max(0, Math.min(120, parseInt(e.target.value, 10) || 0)); at.grace = v; atSave(); atRefresh(true); });
  q('#atKpis').addEventListener('click', e => { const k = e.target.closest('.pl-kpi[data-f]'); if (!k) return; const [t, v] = k.dataset.f.split(':'); if (t === 'st') atPick('st', v); });
  q('#cmKpis').addEventListener('click', e => { const k = e.target.closest('.pl-kpi[data-f]'); if (!k) return; const [t, v] = k.dataset.f.split(':'); if (t === 'cm') cmPickRes(v); });
  q('#cmBase').addEventListener('change', () => { at.cmRes = ''; atRefresh(true); }); q('#cmShow').addEventListener('change', () => cmRender(true));
  q('#cmMore').addEventListener('click', () => { at.shown += 200; cmRender(true); }); q('#rcMore').addEventListener('click', () => { at.rcShown += 200; rcRender(); });
  q('#cmGoRoster').addEventListener('click', () => { const n = document.querySelector('.nav-item[data-view="roster"]'); if (n) n.click(); });
  const xl = d => { if (!d.rows.length) { sectionToast('Nothing to export.', 'warn'); return; } const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.headers, ...d.rows]), d.sheet.slice(0, 31)); XLSX.writeFile(wb, d.sheet.replace(/\s+/g, '_') + '.xlsx'); addActivity('export', d.title); };
  const pr = d => { if (!d.rows.length) { sectionToast('Nothing to print.', 'warn'); return; } w_printTable(d.title, d.note, d.headers, d.rows); }, ml = f => { window.extMailData = f; wMail_open('ext'); }, ex = d => { const tb = document.createElement('table'); tb.id = 'atExpTable'; tb.dataset.title = d.title; tb.innerHTML = '<thead><tr>' + d.headers.map(x => '<th>' + plEsc(x) + '</th>').join('') + '</tr></thead><tbody>' + d.rows.map(r => '<tr>' + r.map(v => '<td>' + plEsc(v == null ? '' : v) + '</td>').join('') + '</tr>').join('') + '</tbody>'; if (window.tableExpandOpen) window.tableExpandOpen(tb); };
  q('#rcExcel').addEventListener('click', () => xl(rcData())); q('#rcPrint').addEventListener('click', () => pr(rcData())); q('#rcEmail').addEventListener('click', () => ml(rcData)); q('#rcExpand').addEventListener('click', () => ex(rcData()));
  q('#cmExcel').addEventListener('click', () => xl(cmData())); q('#cmPrint').addEventListener('click', () => pr(cmData())); q('#cmEmail').addEventListener('click', () => ml(cmData)); q('#cmExpand').addEventListener('click', () => ex(cmData()));
  window.addEventListener('resize', () => { if (document.querySelector('#view-att.active')) { if (at.tab === 'dash') atDrawGrid(q('#atGrid'), AT_DEFS, { rows: () => atView() }); else if (at.tab === 'cmp' && cmCache) atDrawGrid(q('#cmGrid'), CM_DEFS, { rows: () => cmCache.rows }); } });
}
document.querySelectorAll('.nav-item[data-view="att"]').forEach(n => n.addEventListener('click', () => setTimeout(() => { atInit(); if (!at.rows.length) atLoad(); if (at.rows.length && at.tab === 'up' && !at.visited) { at.tab = 'dash'; } at.visited = true; atRefresh(); atSpSync(); }, 0)));

/* ============================================================
   MANAGEMENT DAILY REPORT — the Power BI "Mngt Daily Report" rebuilt on SharePoint lists
   tables: Mngmnt_Daily_Data_tbl (daily), WHs_tbl (headcount), Trgt_Dtls_tbl (targets, looked up by WHs_Code)
   ============================================================ */
const MG_KEY = LS_BASE + '_mgt_cfg5';
const MG_DEFAULT = null;   // fixed by the administrator: use "Copy fixed settings" in Lists & mapping and paste it over this line
const mgSetupOk = () => featOk('mgsetup');
const mg = { cfg: { list: { daily: '', whs: '', trgt: '' }, map: { daily: {}, whs: {}, trgt: {} }, opt: { out: true, inb: false, ret: true, hrs: 'reg', otFmt: 'auto', tAgg: 'avg' }, by: 'areareg', src: 'sp' }, cols: { daily: [], whs: [], trgt: [] }, pick: {}, rows: [], whs: [], trg: [], f: { from: '', to: '', area: [], region: [], wh: [] }, tab: 'setup', loaded: 0, inited: false, ctx: { groups: [], all: null } };
const MG_FIELDS = {
  daily: [
    { key: 'date', label: 'Entry_Date', req: 1, al: ['entrydate', 'recorddate', 'reportdate', 'date', 'day'] },
    { key: 'wh', label: 'WHs_Desc (warehouse)', req: 1, al: ['whsdesc', 'whdesc', 'whs', 'warehouse', 'whname', 'site', 'wh'] },
    { key: 'area', label: 'Region_Desc  (shown as “Area”)', al: ['regiondesc', 'area', 'region'] },
    { key: 'region', label: 'BU_Decs  (shown as “Regions”)', al: ['budecs', 'budesc', 'bu', 'regions', 'businessunit'] },
    { key: 'out', label: 'Outbound Volume Ltrs-Kg', al: ['outboundvolumeltrskg', 'outboundvolume', 'outboundltrs', 'outbound'] },
    { key: 'inb', label: 'Inbound Volume Ltrs-Kg', al: ['inboundvolumeltrskg', 'inboundvolume', 'inboundltrs', 'inbound'] },
    { key: 'ret', label: 'WHs_Returns_Ltrs', al: ['whsreturnsltrs', 'returnsltrs', 'returnvolume', 'returns'] },
    { key: 'orders', label: 'Number of Orders Processed', al: ['numberofordersprocessed', 'ordersprocessed', 'numberoforders', 'noorders', 'orders'] },
    { key: 'nh', label: 'Normal Working Hours', al: ['normalworkinghours', 'normalworkinghrs', 'normalhours', 'normalhrs', 'workinghours', 'workinghrs'] },
    { key: 'not', label: 'Normal Overtime Hours', al: ['normalovertimehours', 'normalovertimehrs', 'normalothours', 'normalothrs', 'normalot', 'overtimehours'] },
    { key: 'wo', label: 'Week-Off OT', al: ['weekoffot', 'weekoffovertime', 'weekoffothours', 'weekoff'] },
    { key: 'po', label: 'Public_OT', al: ['publicot', 'publicotthours', 'publicholidayot', 'publicovertime', 'public'] },
    { key: 'staff', label: 'Nr_Actual_Staff (staff on duty) — optional', al: ['nractualstaff', 'actualstaff', 'staffonduty', 'nrstaff'] },
    { key: 'vol', label: 'Working Volume (only if a ready column exists)', al: ['workingvolume', 'totalvolume'] }],
  whs: [
    { key: 'wh', label: 'WHs_Desc (warehouse)', req: 1, al: ['whsdesc', 'whdesc', 'whs', 'warehouse', 'whname', 'wh'] },
    { key: 'bud', label: 'Budget_HC', req: 1, al: ['budgethc', 'budgetheadcount', 'budget', 'bdgt'] },
    { key: 'act', label: 'Nr_TACCS_HC (actual headcount)', req: 1, al: ['nrtaccshc', 'taccshc', 'actualhc', 'actualheadcount', 'headcount', 'actual', 'hc'] }],
  trgt: [
    { key: 'area', label: 'Area_Desc (matches Area / Region_Desc)', req: 1, al: ['areadesc', 'area', 'regiondesc'] },
    { key: 'region', label: 'Region_Code (matches Regions / BU_Decs)', req: 1, al: ['regioncode', 'budecs', 'bucode', 'region'] },
    { key: 'code', label: 'WHs_Code (matches WHs Desc, or the Region at region level)', req: 1, al: ['whscode', 'whcode', 'warehousecode', 'code'] },
    { key: 'prod', label: 'Target Value (productivity target)', req: 1, al: ['targetvalue', 'targetprod', 'productivitytarget', 'prodtarget', 'target'] },
    { key: 'tot', label: 'TargetOT (overtime target)', al: ['targetot', 'ottarget', 'overtimetarget', 'otpercent'] }]
};
const MG_TABS = [['rep', '📊 Report'], ['links', '🔗 Attendance links'], ['setup', '🔌 Lists & mapping'], ['measures', 'ƒ Measures']];
const mgS = v => v == null ? '' : typeof v === 'object' ? String(v.Value ?? v.LookupValue ?? v.Title ?? v.DisplayName ?? '').trim() : String(v).trim();
const mgNull = v => { if (v == null || v === '') return null; if (typeof v === 'object') v = v.Value; const n = Number(String(v).replace(/,/g, '').replace(/%$/, '')); return isFinite(n) ? n : null; };
const mgN = v => mgNull(v) || 0;
const mgAvg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const mgMapOk = (w) => MG_FIELDS[w].filter(f => f.req).every(f => mg.cfg.map[w][f.key] && mg.cfg.map[w][f.key] !== SKIP_VALUE);
function mgLoadCfg() { try { const c = JSON.parse(localStorage.getItem(MG_KEY) || 'null'); if (c) { Object.assign(mg.cfg.list, c.list || {}); ['daily', 'whs', 'trgt'].forEach(w => Object.assign(mg.cfg.map[w], (c.map || {})[w] || {})); Object.assign(mg.cfg.opt, c.opt || {}); if (c.by) mg.cfg.by = c.by; if (c.src) mg.cfg.src = c.src; } } catch (e) {}
  if (!mgSetupOk() && MG_DEFAULT) { try { Object.assign(mg.cfg.list, MG_DEFAULT.list || {}); ['daily', 'whs', 'trgt'].forEach(w => { mg.cfg.map[w] = Object.assign({}, (MG_DEFAULT.map || {})[w] || {}); }); Object.assign(mg.cfg.opt, MG_DEFAULT.opt || {}); } catch (e) {} } }
function mgSaveCfg() { try { localStorage.setItem(MG_KEY, JSON.stringify(mg.cfg)); } catch (e) {} }

/* ---------- mapping UI ---------- */
function mgMapRender(w) {
  const host = PLQ({ daily: '#mgMapDaily', whs: '#mgMapWhs', trgt: '#mgMapTrgt' }[w]), cols = mg.cols[w]; host.innerHTML = '';
  if (!cols.length) { host.innerHTML = '<tr><td colspan="2" style="padding:14px;text-align:center;color:var(--gray-400);font-style:italic;">Pick the list and click 🔄 Load Columns.</td></tr>'; return; }
  MG_FIELDS[w].forEach(f => { const tr = document.createElement('tr'); tr.innerHTML = `<td><strong>${plEsc(f.label)}</strong>${f.req ? ' <span style="color:#c0392b">*</span>' : ''}</td><td class="combo-cell"></td>`; tr.querySelector('.combo-cell').appendChild(buildCombo(mg.cfg.map[w][f.key] || SKIP_VALUE, cols, nv => { mg.cfg.map[w][f.key] = nv; mgSaveCfg(); })); host.appendChild(tr); });
}
/* ---------- loading ---------- */
async function mgReadList(w, say) {
  const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(), name = mg.cfg.list[w]; if (!name) return null;
  if (!isListVisible(name)) throw new Error(`No permission to access "${name}"`);
  say(`Reading "${name}"…`); const a = await resolveIds(siteUrl, name, token);
  return await fetchAllItems(a.siteId, a.listId, token, n => say(`"${name}": ${plF(n)} rows…`));
}
async function mgLoad(silent) {
  const st = PLQ('#mgLoadStatus'), say = (t, c) => { st.className = 'text-sm'; st.textContent = t; st.style.color = c === 'e' ? '#c0392b' : ''; }, prog = PLQ('#mgProg'), token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl();
  if (mgSetupOk()) { mg.cfg.list.daily = mg.pick.daily.getValue(); mg.cfg.list.whs = mg.pick.whs.getValue(); mg.cfg.list.trgt = mg.pick.trgt.getValue(); mgSaveCfg(); }
  if (!token || !siteUrl) { if (!silent) say('⚠ Configure the global Site URL and sign-in first.', 'e'); return; }
  if (!mg.cfg.list.daily) { say('⚠ Pick the daily data list.', 'e'); return; }
  if (!mgMapOk('daily')) { say('⚠ Map at least Entry_Date and WHs_Desc of the daily data list.', 'e'); return; }
  if (mg.cfg.list.trgt && !mgMapOk('trgt')) { say('⚠ Map Area_Desc, Region_Code, WHs_Code and Target Value of the targets list.', 'e'); return; }
  if (mg.cfg.list.whs && !mgMapOk('whs')) { say('⚠ Map WHs_Desc, Budget_HC and Nr_TACCS_HC of the headcount list (or clear that list).', 'e'); return; }
  prog.style.display = 'inline-block'; prog.removeAttribute('value'); PLQ('#mgLoadBtn').disabled = true;
  try {
    const g = (w, k) => { const c = mg.cfg.map[w][k]; return c && c !== SKIP_VALUE ? c : null; };
    const dItems = await mgReadList('daily', say), M = mg.cfg.map.daily, gd = k => g('daily', k); let bad = 0; const rows = [];
    try { if (M.staff === undefined && dItems.length) { const kk = Object.keys(dItems[0].fields || {}).find(x => x.replace(/[^a-z0-9]/gi, '').toLowerCase() === 'nractualstaff'); if (kk) { M.staff = kk; mgSaveCfg(); } } } catch (e) {}
    dItems.forEach(it => { const f = it.fields || {}, date = mdpDate(f[gd('date')] instanceof Object ? '' : f[gd('date')]); if (!date) { bad++; return; }
      rows.push({ date, wh: mgS(f[gd('wh')]), area: gd('area') ? mgS(f[gd('area')]) : '', region: gd('region') ? mgS(f[gd('region')]) : '', out: gd('out') ? mgN(f[gd('out')]) : 0, inb: gd('inb') ? mgN(f[gd('inb')]) : 0, ret: gd('ret') ? mgN(f[gd('ret')]) : 0, orders: gd('orders') ? mgN(f[gd('orders')]) : 0, nh: gd('nh') ? mgN(f[gd('nh')]) : 0, not: gd('not') ? mgN(f[gd('not')]) : 0, wo: gd('wo') ? mgN(f[gd('wo')]) : 0, po: gd('po') ? mgN(f[gd('po')]) : 0, staff: gd('staff') ? mgN(f[gd('staff')]) : 0, vol: gd('vol') ? mgN(f[gd('vol')]) : 0 }); });
    rows.forEach(r => { r.ot = r.not + r.wo + r.po; r.hrs = r.nh + r.ot; }); mg.rows = rows; mg.whs = []; mg.trg = [];
    if (mg.cfg.list.whs) { const items = await mgReadList('whs', say); items.forEach(it => { const f = it.fields || {}, wh = mgS(f[g('whs', 'wh')]); if (wh) mg.whs.push({ wh, bud: mgN(f[g('whs', 'bud')]), act: mgN(f[g('whs', 'act')]) }); }); }
    if (mg.cfg.list.trgt) { const items = await mgReadList('trgt', say); items.forEach(it => { const f = it.fields || {}, o = { area: mgS(f[g('trgt', 'area')]), region: mgS(f[g('trgt', 'region')]), code: mgS(f[g('trgt', 'code')]), prod: g('trgt', 'prod') ? mgNull(f[g('trgt', 'prod')]) : null, tot: g('trgt', 'tot') ? mgNull(f[g('trgt', 'tot')]) : null }; if (o.prod != null || o.tot != null) mg.trg.push(o); }); }
    mg.sp = { rows, whs: mg.whs, trg: mg.trg }; if (mg.cfg.src !== 'sp' && typeof mgApplySrc === 'function') mgApplySrc();
    mg.loaded = Date.now(); mg.f.area = []; mg.f.region = []; mg.f.wh = []; document.querySelector('#mgFHost').dataset.sig = '';
    const ds = mg.rows.map(r => r.date).sort(); mg.f.from = ds[0] || ''; mg.f.to = ds[ds.length - 1] || '';
    say(`✅ ${plF(rows.length)} daily rows (${ds[0] || '—'} → ${ds[ds.length - 1] || '—'})${mg.cfg.list.whs ? ` · ${plF(mg.whs.length)} headcount rows` : ''}${mg.cfg.list.trgt ? ` · ${plF(mg.trg.length)} target rows` : ''}${bad ? ` · ${bad} rows without a valid date skipped` : ''}`);
    addActivity('download', `Management daily report loaded from "${mg.cfg.list.daily}"`);
    if (rows.length) { mg.tab = 'rep'; } mgRefresh();
  } catch (e) { say('✘ ' + e.message, 'e'); } finally { prog.style.display = 'none'; PLQ('#mgLoadBtn').disabled = false; }
}
/* ---------- calculations ---------- */
function mgView() { const f = mg.f; return mg.rows.filter(r => (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && (!f.area.length || f.area.includes(r.area)) && (!f.region.length || f.region.includes(r.region)) && (!f.wh.length || f.wh.includes(r.wh))); }
function mgTargets() {
  /* Target lookup in the targets list — driven by the deepest slicer that is set:
     Area only         → Area_Desc = Area  AND Region_Code = Area    AND WHs_Code = Area   (the same input is searched in all 3 columns)
     Area + Regions    → Area_Desc = Area  AND Region_Code = Region  AND WHs_Code = Region
     + WHs Desc        → Area_Desc = Area  AND Region_Code = Region  AND WHs_Code = WHs Desc */
  const o = mg.cfg.opt, ots = mg.trg.filter(t => t.tot != null), frac = o.otFmt === 'frac' || (o.otFmt === 'auto' && ots.length && ots.every(t => Math.abs(t.tot) <= 1)), nk = v => String(v == null ? '' : v).trim().toLowerCase();
  const has = (a, v) => !a || !a.length || a.some(x => nk(x) === nk(v));
  return (lvl, whSet) => {
    lvl = lvl || {}; let rows;
    if (lvl.wh && lvl.wh.length) rows = mg.trg.filter(t => has(lvl.area, t.area) && has(lvl.region, t.region) && has(lvl.wh, t.code));
    else if (lvl.region && lvl.region.length) rows = mg.trg.filter(t => has(lvl.area, t.area) && has(lvl.region, t.region) && has(lvl.region, t.code));
    else if (lvl.area && lvl.area.length) rows = mg.trg.filter(t => has(lvl.area, t.area) && has(lvl.area, t.region) && has(lvl.area, t.code));
    else { const d = new Set([...(whSet ? whSet.keys() : [])].map(nk)); rows = mg.trg.filter(t => d.has(nk(t.code))); }   // nothing selected: every warehouse that has a record
    if (!rows.length) return null;
    const p = rows.map(t => t.prod).filter(v => v != null), q = rows.map(t => t.tot).filter(v => v != null).map(v => frac ? v * 100 : v);
    return { prod: !p.length ? null : o.tAgg === 'sum' ? p.reduce((x, y) => x + y, 0) : mgAvg(p), ot: mgAvg(q), n: rows.length };
  };
}
function mgWhsMap() { const m = new Map(); mg.whs.forEach(h => { const o = m.get(h.wh) || { bud: 0, act: 0 }; o.bud += h.bud; o.act += h.act; m.set(h.wh, o); }); return m; }
function mgAgg(rows, T, WM, lvl) {
  const o = mg.cfg.opt, s = { n: rows.length, out: 0, inb: 0, ret: 0, orders: 0, hrs: 0, ot: 0, volc: 0, latest: '' }, whSet = new Map();
  rows.forEach(r => { s.out += r.out; s.inb += r.inb; s.ret += r.ret; s.orders += r.orders; s.hrs += r.hrs; s.ot += r.ot; s.volc += r.vol; if (r.date > s.latest) s.latest = r.date; if (!whSet.has(r.wh)) whSet.set(r.wh, r); });
  const hasVol = mg.cfg.map.daily.vol && mg.cfg.map.daily.vol !== SKIP_VALUE;
  s.vol = hasVol ? s.volc : (o.out ? s.out : 0) + (o.inb ? s.inb : 0) + (o.ret ? s.ret : 0);
  const hb = o.hrs === 'all' ? s.hrs + s.ot : s.hrs; s.prod = hb > 0 && !(mg.cfg.src === 'att' && !s.vol) ? s.vol / hb : null; s.otPct = s.hrs > 0 ? s.ot / s.hrs * 100 : null;
  const tg = T(lvl, whSet); s.tProd = tg ? tg.prod : null; s.tOT = tg ? tg.ot : null; s.noT = tg ? 0 : 1; s.prodPct = s.prod != null && s.tProd ? s.prod / s.tProd * 100 : null;
  s.otDiff = s.otPct != null && s.tOT != null ? s.otPct - s.tOT : null; s.otDiff2 = s.otDiff != null && s.tOT ? s.otDiff / s.tOT * 100 : null;
  s.bud = s.act = null; s.whN = whSet.size; if (mg.whs.length) { let b = 0, a = 0; whSet.forEach((_, wh) => { const h = WM.get(wh); if (h) { b += h.bud; a += h.act; } }); s.bud = b; s.act = a; }
  return s;
}
const MG_BY = { areareg: r => (r.area || '—') + ' › ' + (r.region || '—'), area: r => r.area || '—', region: r => r.region || '—', wh: r => r.wh || '—', day: r => r.date, month: r => r.date.slice(0, 7) };
function mgGroups(rows, T, WM) { const g = new Map(), kf = MG_BY[mg.cfg.by] || MG_BY.areareg; rows.forEach(r => { const k = kf(r); let o = g.get(k); if (!o) g.set(k, o = { k, rows: [] }); o.rows.push(r); }); const L = [...g.values()].sort((a, b) => mdpNat(a.k, b.k)); const d = (x, k) => [...new Set(x.rows.map(r => r[k]).filter(Boolean))], by = mg.cfg.by;
  L.forEach(x => { const lv = by === 'area' ? { area: d(x, 'area') } : by === 'wh' ? { area: d(x, 'area'), region: d(x, 'region'), wh: d(x, 'wh') } : (by === 'areareg' || by === 'region') ? { area: d(x, 'area'), region: d(x, 'region') } : { area: mg.f.area, region: mg.f.region, wh: mg.f.wh }; x.a = mgAgg(x.rows, T, WM, lv); }); return L; }
const mgFilterText = () => { const f = mg.f, p = []; if (f.from || f.to) p.push(`${f.from || '…'} → ${f.to || '…'}`); if (f.area.length) p.push('Area: ' + f.area.join(', ')); if (f.region.length) p.push('Region: ' + f.region.join(', ')); if (f.wh.length) p.push('WHs: ' + f.wh.join(', ')); return p.join(' · ') || 'All data'; };

/* ---------- KPI strip ---------- */
const mgKpi = (l, v, s, c) => `<div class="pl-kpi"${c ? ` style="border-left:4px solid ${c}"` : ''}><div class="lbl">${plEsc(l)}</div><div class="val">${v}</div><div class="sub">${s || ''}</div></div>`;
const mgPct = (v, d) => v == null ? '—' : plF(v, d == null ? 1 : d) + '%';
function mgKpis(a) {
  const T = plT(), ok = a.otDiff == null ? null : a.otDiff <= 0, f = (v, d) => v == null ? '—' : plF(v, d);
  PLQ('#mgKpis').innerHTML = mgKpi('Productivity %', mgPct(a.prodPct, 0), a.prod != null ? `${plF(a.prod, 1)} per hour${a.tProd ? ` · target ${plF(a.tProd, 1)}` : ''}` : 'no hours', a.prodPct == null ? null : a.prodPct >= 100 ? T.good : a.prodPct >= 80 ? T.warn : T.crit)
    + mgKpi('Working volume', plF(a.vol), 'Ltrs / Kg')
    + mgKpi('Working hrs', plF(a.hrs, 1), `${plF(a.whN)} warehouse(s)`)
    + mgKpi('Working OT hrs', plF(a.ot, 1), `OT ${mgPct(a.otPct)} of working hrs${a.tOT != null ? ` · target ${mgPct(a.tOT)}` : ''}`)
    + mgKpi('Over time % vs target', a.otDiff == null ? '—' : (a.otDiff > 0 ? '▲ +' : '▼ ') + plF(a.otDiff, 1) + ' pp', a.otDiff == null ? 'no OT target' : ok ? '✔ within target' : '✖ above target', ok == null ? null : ok ? T.good : T.crit)
    + mgKpi('Over time % (relative)', a.otDiff2 == null ? '—' : (a.otDiff2 > 0 ? '+' : '') + plF(a.otDiff2, 0) + '%', 'difference ÷ OT target', ok == null ? null : ok ? T.good : T.crit)
    + mgKpi('Orders processed', plF(a.orders), `${plF(a.n)} daily record(s)`)
    + (a.bud != null ? mgKpi('Headcount', `${plF(a.act)} <span style="font-size:14px;font-weight:500;color:var(--gray-500)">/ ${plF(a.bud)}</span>`, `actual / budget · ${a.act - a.bud >= 0 ? '+' : ''}${plF(a.act - a.bud)}`, a.act > a.bud ? T.warn : null) : '')
    + mgKpi('Latest entry date', a.latest || '—', 'most recent record in the selection');
}
/* ---------- charts ---------- */
function mgGauge(host, ctx) {
  const T = plT(), a = ctx.all; if (!a || a.prod == null) return plEmpty(host, 'No working hours in the selection.');
  const W = Math.max(260, host.clientWidth || 320), H = plFullH(host, 230), cx = W / 2, cy = H - 52, r = Math.min(W / 2 - 26, H - 80), max = a.tProd || a.prod * 1.25 || 1, t = Math.max(0, Math.min(1, a.prod / max)), svg = plSvg(host, W, H);
  const P = f => { const th = Math.PI * (1 - f); return [cx + r * Math.cos(th), cy - r * Math.sin(th)]; }, [x1, y1] = P(t), col = a.prodPct == null ? T.series[0] : a.prodPct >= 100 ? T.good : a.prodPct >= 80 ? T.warn : T.crit;
  S('path', { d: `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`, fill: 'none', stroke: T.grid, 'stroke-width': 24 }, svg);
  if (t > 0) S('path', { d: `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x1} ${y1}`, fill: 'none', stroke: col, 'stroke-width': 24 }, svg);
  Tx(svg, cx - r, cy + 16, '0', { size: 10.5, fill: T.muted, anchor: 'middle' }); Tx(svg, cx + r, cy + 16, plF(max, 1), { size: 10.5, fill: T.muted, anchor: 'middle' }); if (a.tProd) Tx(svg, cx + r, cy + 30, 'target', { size: 10, fill: T.muted, anchor: 'middle' });
  Tx(svg, cx, cy - 14, plF(a.prod, 1), { size: 30, anchor: 'middle', fill: T.text, weight: 700 }); Tx(svg, cx, cy + 12, 'volume per working hour', { size: 11, anchor: 'middle', fill: T.muted });
  Tx(svg, cx, cy + 36, a.prodPct == null ? 'no target set' : `${a.prodPct >= 100 ? '✔ On target' : a.prodPct >= 80 ? '▲ Near target' : '✖ Below target'} · ${plF(a.prodPct, 0)}% of ${plF(a.tProd, 1)}`, { size: 12, anchor: 'middle', fill: T.text, weight: 600 });
  return { table: { headers: ['Measure', 'Value'], rows: [['Productivity (volume / hour)', a.prod], ['Target value', a.tProd == null ? '' : a.tProd], ['Productivity %', a.prodPct == null ? '' : a.prodPct], ['Working volume', a.vol], ['Hours used', mg.cfg.opt.hrs === 'all' ? a.hrs + a.ot : a.hrs]] } };
}
const mgCols = (host, ctx, series, pick, fmt, o) => {
  o = o || {}; const T = plT(), G = ctx.groups.filter(g => o.need ? o.need(g.a) : true); if (!G.length) return plEmpty(host, o.empty || 'No data for the current filters.');
  const cap = 30, L = G.length > cap ? G.slice().sort((x, y) => y.a.vol - x.a.vol).slice(0, cap).sort((x, y) => mdpNat(x.k, y.k)) : G;
  const sr = series.map((n, i) => ({ name: n, color: T.series[(o.col || [0, 1, 2, 3])[i]] }));
  plcCols(host, { cats: L.map(g => ({ label: g.k, vals: pick(g.a) })), series: sr, fmt, tickFmt: o.tickFmt || (v => plF(v)), height: o.h || 260, labelFn: sr.length === 1 || o.lab ? ((c, v) => v == null ? '' : fmt(v)) : null, labelAll: !!o.lab && sr.length > 1 });
  return { legend: sr.length > 1 ? sr.map(s => ({ name: s.name, c: s.color })) : null, table: { headers: ['Group', ...series], rows: L.map(g => [g.k, ...pick(g.a).map(v => v == null ? '' : v)]) } };
};
const MG_DEFS = [
  { id: 'gauge', title: 'Productivity', sub: 'working volume per hour against the target value', span: 's4', draw: (h, c) => mgGauge(h, c.rows) },
  { gf: 1, id: 'ot', title: 'Overtime', sub: 'OT % of working hours — target vs actual', span: 's4', draw: (h, c) => mgCols(h, c.rows, ['OT Target', 'OT Actual'], a => [a.tOT, a.otPct], v => v == null ? '—' : plF(v, 1) + '%', { tickFmt: v => plF(v, 0) + '%', lab: 1 }) },
  { gf: 1, id: 'hc', title: 'Headcount', sub: 'budget vs actual (Nr_TACCS_HC)', span: 's4', draw: (h, c) => (mg.cfg.by === 'day' || mg.cfg.by === 'month') ? plEmpty(h, 'Headcount is not dated — view by Area, Region or WHs.') : mgCols(h, c.rows, ['Budget', 'Actual'], a => [a.bud, a.act], v => plF(v), { need: a => a.bud != null, empty: 'Pick and map a WHs headcount list to see this chart.', lab: 1 }) },
  { gf: 1, id: 'hrs', title: 'Working Hrs / OT', sub: 'regular and overtime hours', span: 's6', draw: (h, c) => mgCols(h, c.rows, ['Working Hrs', 'Working OT Hrs'], a => [a.hrs, a.ot], v => plF(v, 1), { tickFmt: v => plF(v) }) },
  { gf: 1, id: 'orders', title: '# Orders', sub: 'orders processed', span: 's6', draw: (h, c) => mgCols(h, c.rows, ['Orders'], a => [a.orders], v => plF(v)) },
  { gf: 1, id: 'vol', title: 'Working Volume Ltrs / Kgs', sub: 'outbound + returns (inbound excluded)', span: 's4', draw: (h, c) => mgCols(h, c.rows, ['Working volume'], a => [a.vol], v => plF(v)) },
  { gf: 1, id: 'io', title: 'Volume Ltrs / Kgs In / Out', sub: 'working volume, outbound, inbound and returns', span: 's8', draw: (h, c) => mgCols(h, c.rows, ['Working volume', 'Outbound', 'Inbound', 'Returns'], a => [a.vol, a.out, a.inb, a.ret], v => plF(v)) }
];
/* ---------- table ---------- */
const MG_HEAD = ['Group', 'Records', 'Orders', 'Outbound', 'Inbound', 'Returns', 'Working volume', 'Working hrs', 'OT hrs', 'OT %', 'OT target %', 'OT diff (pp)', 'Productivity /hr', 'Target value', 'Productivity %', 'Budget HC', 'Actual HC'];
function mgTableData() {
  const r = (k, a) => [k, a.n, a.orders, a.out, a.inb, a.ret, a.vol, a.hrs, a.ot, a.otPct, a.tOT, a.otDiff, a.prod, a.tProd, a.prodPct, a.bud, a.act].map((v, i) => i && typeof v === 'number' ? Math.round(v * 100) / 100 : (v == null ? '' : v));
  const G = mg.ctx.groups, all = mg.ctx.all; return { title: 'Management Daily Report', note: mgFilterText(), sheet: 'Mngt Daily', headers: MG_HEAD, rows: G.map(g => r(g.k, g.a)), totals: all ? r('TOTAL', all) : null };
}
function mgTableRender() {
  const d = mgTableData(), t = PLQ('#mgTable'); PLQ('#mgTblSub').textContent = `— ${d.rows.length} group(s) · ${d.note}`;
  t.id = t.id || 'mgTable'; t.innerHTML = `<thead><tr>${d.headers.map((h, i) => `<th class="${i ? 'n' : ''}">${plEsc(h)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(x => `<tr>${x.map((v, i) => `<td class="${i ? 'n' : ''}">${plEsc(typeof v === 'number' ? plF(v, Math.abs(v) < 100 && v % 1 ? 1 : 0) : v)}</td>`).join('')}</tr>`).join('')}${d.totals ? `<tr class="t">${d.totals.map((v, i) => `<td class="${i ? 'n' : ''}"><b>${plEsc(typeof v === 'number' ? plF(v, Math.abs(v) < 100 && v % 1 ? 1 : 0) : v)}</b></td>`).join('')}</tr>` : ''}</tbody>`; try { tblColFilters(t); } catch (e) { console.error(e); }
}

/* ---- drop-down lists: keep inside the window, keep open while resizing ---- */
function cbFit(list) { try { if (!list) return;
    if (list.closest('.fd-wrap,.table-wrap')) { const w = list.parentNode, a = w.querySelector('.mc-box,.combo-input-wrap,.list-picker-input-wrap') || w, r = a.getBoundingClientRect(); list.style.position = 'fixed'; list.style.right = 'auto'; list.style.marginTop = '0'; const lw = Math.max(260, r.width), left = Math.max(8, Math.min(r.left, innerWidth - Math.min(lw, innerWidth - 16) - 8)); list.style.left = left + 'px'; list.style.top = (r.bottom + 2) + 'px'; list.style.maxHeight = Math.max(160, Math.min(520, innerHeight - r.bottom - 14)) + 'px'; if (!list.style.width && !list.classList.contains('mc-big')) list.style.minWidth = lw + 'px'; return; } list.style.left = '0'; list.style.right = 'auto'; const r = list.getBoundingClientRect(), W = window.innerWidth; if (r.right > W - 8) { list.style.left = 'auto'; list.style.right = '0'; const r2 = list.getBoundingClientRect(); if (r2.left < 8) { list.style.right = 'auto'; list.style.left = (8 - r2.left) + 'px'; } } } catch (e) {} }
document.addEventListener('focusin', e => { const w = e.target.closest && e.target.closest('.combo,.mcombo,.list-picker'); if (!w) return; requestAnimationFrame(() => requestAnimationFrame(() => { const l = w.querySelector('.combo-list.open,.mc-list.open,.list-picker-list.open'); if (l) cbFit(l); })); });
document.addEventListener('mousedown', e => { const l = e.target.closest && e.target.closest('.combo-list,.mc-list,.list-picker-list'); if (l && e.target === l) { const w = l.parentNode, i = w && w.querySelector('input'); if (i && document.activeElement === i) e.preventDefault(); } }, true);



/* ============================================================
   LOGIN CONTROL — users are validated against a SharePoint list (default "LoginUserList",
   Yes/No column "Allow_More_VMs"). Not Yes/true or not listed → locked out.
   ============================================================ */
const LUL_DEFAULT = { on: true, list: 'LoginUserList', allow: 'Allow_More_VMs', user: '', adm: true, pwOn: true, pw: 'Password', role: 'Role' };
const LUL_KEY = LS_BASE + '_lulcfg', lul = { ok: 0, busy: false, timer: null, denied: false, warned: false };
function lulCfg() { let c = {}; try { c = JSON.parse(localStorage.getItem(LUL_KEY) || '{}') || {}; } catch (e) {} return { on: c.on === undefined ? LUL_DEFAULT.on : !!c.on, list: (c.list || LUL_DEFAULT.list).trim(), allow: (c.allow || LUL_DEFAULT.allow).trim(), user: (c.user || '').trim(), adm: c.adm === undefined ? LUL_DEFAULT.adm : !!c.adm, pwOn: c.pwOn === undefined ? LUL_DEFAULT.pwOn : !!c.pwOn, pw: (c.pw || LUL_DEFAULT.pw).trim(), role: (c.role || LUL_DEFAULT.role).trim() }; }
const lulNorm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const lulExempt = () => !currentUser || currentUser.builtin || (lulCfg().adm && currentUser.role === 'admin');
function lulIdentities() { const ids = new Set(); const add = v => { v = String(v || '').trim().toLowerCase(); if (v) ids.add(v); };
  if (currentUser) { add(currentUser.email); add(currentUser.username); add(currentUser.name); add(currentUser.displayName); }
  try { const a = ms_app && ms_app.getAllAccounts()[0]; if (a) { add(a.username); add(a.name); } } catch (e) {}
  return [...ids]; }
function lulVals(v) { if (v == null) return []; if (Array.isArray(v)) return v.flatMap(lulVals); if (typeof v === 'object') return [v.Email, v.LookupValue, v.Value, v.Title, v.DisplayName, v.EMail].filter(Boolean).map(String); return [String(v)]; }
const lulTrue = v => v === true || /^(true|yes|y|1|-1)$/i.test(String(v == null ? '' : (typeof v === 'object' ? v.Value : v)).trim());
function lulAllowKey(f, want) { if (want in f) return want; const n = lulNorm(want); return Object.keys(f).find(k => lulNorm(k) === n) || null; }
function lulUserKeys(f, col) { if (col) { const k = lulAllowKey(f, col); return k ? [k] : []; } return Object.keys(f).filter(k => !/^(@|_|id$|attachments|content|edit|modified|created|author|editor|linktitle|appauthor|appeditor|itemchild|folderchild|compliance)/i.test(k)); }
async function lulFetch() {
  const c = lulCfg(); let token = getGlobalAccessToken(); const site = getGlobalSiteUrl(); if (!token || !site) return { state: 'notoken' };
  const run = async () => { const a = await resolveIds(site, c.list, getGlobalAccessToken()); window.__locSkipList = a.listId; return fetchAllItems(a.siteId, a.listId, getGlobalAccessToken()); };
  try { return { state: 'ok', items: await run() }; }
  catch (e) { const m = String(e.message || e);
    if (/\b(401|403)\b/.test(m)) { try { if (await ms_signIn(false)) return { state: 'ok', items: await run() }; } catch (x) {} return { state: 'notoken', msg: m }; }
    if (/not found|\(404\)/i.test(m)) return { state: 'nolist', msg: m };
    return { state: 'error', msg: m }; }
}
function lulJudge(items) {
  /* a row counts only through the strongest identity that finds any row (e-mail, then user name, then display names); weaker look-alike matches — e.g. the Microsoft account of someone else, or a shared first name — can no longer switch a user off */
  const c = lulCfg(), ids = lulIdentities(), M = [];
  items.forEach(it => { const f = it.fields || {}, keys = lulUserKeys(f, c.user); let tier = -1; for (let i = 0; i < ids.length && tier < 0; i++) if (keys.some(k => lulVals(f[k]).some(v => String(v).trim().toLowerCase() === ids[i]))) tier = i;
    if (tier >= 0) { const ak = lulAllowKey(f, c.allow); M.push({ f, tier, ak, allow: ak ? lulTrue(f[ak]) : false, hasCol: !!ak, raw: ak ? lulVals(f[ak]).join('/') || '(empty)' : '(no column)' }); } });
  if (!M.length) return { found: false, allowed: false, ids };
  const t = Math.min(...M.map(h => h.tier)), hits = M.filter(h => h.tier === t), detail = 'Matched on “' + ids[t] + '” — ' + hits.length + ' row(s), ' + c.allow + ' = ' + hits.map(h => h.raw).join(' , ');
  if (!hits.some(h => h.hasCol)) return { found: true, allowed: false, noCol: true, ids, detail };
  return { found: true, allowed: hits.some(h => h.allow), ids, detail, f: (hits.find(h => h.allow) || hits[0]).f };
}
async function lulSha(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function lulLogin(username, password) {
  const c = lulCfg(), un = String(username || '').trim().toLowerCase(), bad = { state: 'bad', msg: 'Invalid username or password.' };
  const r = await lulFetch(); if (r.state !== 'ok') return { state: 'unreach', msg: r.msg || r.state };
  const rows = r.items.filter(it => { const f = it.fields || {}; return lulUserKeys(f, c.user).some(k => lulVals(f[k]).some(v => String(v).trim().toLowerCase() === un)); });
  if (!rows.length) return bad;
  let ok = false, off = false, role = '', email = '', name = '', prof = null;
  for (const it of rows) { const f = it.fields || {}, pk = lulAllowKey(f, c.pw); if (!pk) continue; const stored = String(lulVals(f[pk])[0] || '').trim(); if (!stored) continue;
    const pass = /^[a-f0-9]{64}$/i.test(stored) ? (await lulSha(password)).toLowerCase() === stored.toLowerCase() : stored === password; if (!pass) continue;
    const ak = lulAllowKey(f, c.allow); if (ak && !lulTrue(f[ak])) { off = true; continue; } if (!ak) { off = true; continue; }
    ok = true; const rk = lulAllowKey(f, c.role); role = rk ? String(lulVals(f[rk])[0] || '').trim().toLowerCase() : ''; const ek = Object.keys(f).find(k => /^e-?mail$|^email|mail$/i.test(k)); email = ek ? String(lulVals(f[ek])[0] || '') : ''; const nk = Object.keys(f).find(k => /display ?name|fullname|^name$/i.test(k)); name = nk ? String(lulVals(f[nk])[0] || '') : ''; try { prof = locProfile(f); } catch (e) {} break; }
  if (!ok) return off ? { state: 'off', msg: 'Your account is deactivated. Please contact the administrator.' } : bad;
  if (!['viewer', 'operator', 'admin'].includes(role)) role = 'operator';
  let u = findUser(username);
  if (u && u.builtin) { return { state: 'ok', user: u }; }
  if (!u) { u = { id: uid(), username: String(username).trim(), displayName: name || String(username).trim(), role, salt: '', hash: '', email, managerEmail: '', mustChangePassword: false, allowedLists: [], editableLists: [], createdAt: Date.now(), lastLogin: null, fromSP: true }; users.list.push(u); }
  else { u.role = role; if (email && !u.email) u.email = email; if (name && !u.displayName) u.displayName = name; u.fromSP = true; }
  if (prof) Object.assign(u, prof);
  u.lastLogin = Date.now(); saveUsers(); return { state: 'ok', user: u };
}
function lulLockEl() {
  let el = document.querySelector('#lulLock'); if (el) return el; el = document.createElement('div'); el.id = 'lulLock';
  el.style.cssText = 'display:none;position:fixed;inset:0;z-index:100050;background:var(--acc-grad,#12306b);align-items:center;justify-content:center;padding:20px;color:#fff;font-family:inherit';
  el.innerHTML = '<div style="background:var(--card,#fff);color:var(--gray-800,#222);border-radius:18px;max-width:520px;width:100%;padding:28px 30px;box-shadow:0 30px 80px rgba(0,0,0,.45);text-align:center"><div id="lulIco" style="font-size:44px">🔐</div><h2 id="lulTitle" style="margin:8px 0 6px;font-size:20px"></h2><div id="lulText" style="font-size:13.5px;color:var(--gray-600,#555);line-height:1.55"></div><div id="lulBtns" class="btn-row" style="justify-content:center;margin-top:18px"></div></div>';
  document.body.appendChild(el); return el; }
function lulShow(ico, title, text, btns) { const el = lulLockEl(); el.style.display = 'flex'; el.querySelector('#lulIco').textContent = ico; el.querySelector('#lulTitle').textContent = title; el.querySelector('#lulText').innerHTML = text; const b = el.querySelector('#lulBtns'); b.innerHTML = '';
  (btns || []).forEach(([t, fn, cls]) => { const x = document.createElement('button'); x.type = 'button'; x.className = cls || ''; x.textContent = t; x.addEventListener('click', fn); b.appendChild(x); }); }
function lulHide() { const el = document.querySelector('#lulLock'); if (el) el.style.display = 'none'; }
function lulSignOut() { lulHide(); currentUser = null; saveSession(); try { addActivity('auth', 'Signed out (access control)'); } catch (e) {} showLogin(); }
async function lulRun() {
  if (lul.busy || !currentUser) return; const c = lulCfg(); if (!c.on || lulExempt()) { lulHide(); return; } lul.busy = true;
  try {
    if (!lul.ok) lulShow('🔐', 'Checking your access…', 'Verifying your account with SharePoint (' + plEsc(c.list) + ')…', []);
    let r = await lulFetch(); if (r.state === 'notoken' && !lul.ok) { try { await ms_signIn(false); } catch (e) {} r = await lulFetch(); }
    if (r.state === 'ok') { const j = lulJudge(r.items);
      if (j.allowed) { lul.ok = Date.now(); lul.denied = false; lulHide(); try { locApplyRow(j.f); } catch (e) {} }
      else { lul.denied = true; try { addActivity('auth', `Access denied by ${c.list}: ${currentUser.username}`); } catch (e) {}
        lulShow('⛔', j.found ? 'Your access is deactivated' : 'You are not on the access list', j.found ? (j.noCol ? `Your row in <b>${plEsc(c.list)}</b> has no “${plEsc(c.allow)}” column.` : `Your account is switched off (<b>${plEsc(c.allow)}</b> is not Yes). Please contact the administrator.${j.detail ? '<div style="margin-top:10px;font-size:12px;color:#888">' + plEsc(j.detail) + '</div>' : ''}`) : `No row for <b>${plEsc(j.ids.join(' / ') || currentUser.username)}</b> was found in <b>${plEsc(c.list)}</b>. Please contact the administrator.`, [['Sign out', lulSignOut], ['Check again', () => { lul.ok = 0; lulRun(); }, 'secondary']]); } }
    else if (r.state === 'nolist') { lulHide(); if (!lul.warned) { lul.warned = true; sectionToast('Login control is on but the list “' + c.list + '” was not found — access is not being checked. ' + (r.msg || ''), 'warn'); } }
    else if (r.state === 'notoken') { if (!lul.ok) lulShow('🔑', 'Sign in with Microsoft', 'To confirm your access the system needs your Microsoft sign-in.' + ((window.ms_lastErr || r.msg) ? '<div style="margin-top:10px;font-size:12px;color:#c0392b;word-break:break-word">Last Microsoft message: ' + plEsc(window.ms_lastErr || r.msg) + '</div>' : ''), [['Sign in with Microsoft', async () => { lul.busy = false; const ok = await ms_signIn(true); if (ok) lulRun(); else { const t = document.querySelector('#lulText'); if (t) t.innerHTML += '<div style="margin-top:10px;font-size:12px;color:#c0392b;word-break:break-word">✘ ' + plEsc(window.ms_lastErr || 'Sign-in did not complete (is the pop-up blocked?)') + '</div>'; } }], ['Retry', () => { lul.busy = false; lulRun(); }, 'secondary'], ['Sign out', lulSignOut, 'ghost']]); }
    else if (!lul.ok) lulShow('⚠', 'Could not check your access', plEsc(r.msg || 'SharePoint did not answer.'), [['Retry', () => { lul.busy = false; lulRun(); }], ['Sign out', lulSignOut, 'ghost']]);
  } finally { lul.busy = false; }
}
async function lulProfileOnly() {   /* admins / built-in users are never locked out, but their profile (Location ID …) is still refreshed from the login list at every login */
  try { if (!currentUser || currentUser.builtin) return; const c = lulCfg(); if (!c.on) return; const r = await lulFetch(); if (r.state !== 'ok') { if (!lulProfileOnly.again) { lulProfileOnly.again = 1; setTimeout(() => { lulProfileOnly.again = 0; lulProfileOnly(); }, 10000); } return; } const j = lulJudge(r.items); if (j.found && j.f) locApplyRow(j.f); } catch (e) {} }
function lulStart() { lul.ok = 0; lul.warned = false; clearInterval(lul.timer); if (!lulCfg().on || lulExempt()) { lulHide(); lulProfileOnly(); return; } lulRun(); lul.timer = setInterval(() => { if (!currentUser) { clearInterval(lul.timer); return; } lulRun(); }, 5 * 60 * 1000); }
document.addEventListener('visibilitychange', () => { if (!document.hidden && currentUser && lulCfg().on && !lulExempt() && Date.now() - lul.ok > 60000) lulRun(); });
(function () {   // settings card
  const q = id => document.getElementById(id); if (!q('lulCard')) return; const c = lulCfg();
  q('lulList').value = c.list; q('lulAllow').value = c.allow; q('lulUser').value = c.user; q('lulOn').checked = c.on; q('lulAdm').checked = c.adm; q('lulPw').value = c.pw; q('lulRole').value = c.role; q('lulPwOn').checked = c.pwOn;
  const save = () => { try { localStorage.setItem(LUL_KEY, JSON.stringify({ on: q('lulOn').checked, list: q('lulList').value.trim(), allow: q('lulAllow').value.trim(), user: q('lulUser').value.trim(), adm: q('lulAdm').checked, pwOn: q('lulPwOn').checked, pw: q('lulPw').value.trim(), role: q('lulRole').value.trim() })); } catch (e) {} };
  q('lulSave').addEventListener('click', () => { save(); q('lulMsg').textContent = '✅ Saved on this browser. To make these the defaults for everyone, set LUL_DEFAULT in the HTML file.'; if (currentUser) lulStart(); });
  q('lulTest').addEventListener('click', async () => { save(); const m = q('lulMsg'), p = q('lulPrev'); m.textContent = 'Reading the list…'; p.style.display = 'none';
    const r = await lulFetch(); if (r.state !== 'ok') { m.textContent = '✘ ' + (r.state === 'notoken' ? 'Sign in with Microsoft and set the Site URL first.' : (r.msg || r.state)); return; }
    const c2 = lulCfg(), rows = r.items.map(it => { const f = it.fields || {}, ak = lulAllowKey(f, c2.allow), keys = lulUserKeys(f, c2.user); return { who: keys.flatMap(k => lulVals(f[k])).filter(v => v.length < 80).slice(0, 3).join(' · '), allow: ak ? lulTrue(f[ak]) : null }; });
    const j = lulJudge(r.items), on = rows.filter(x => x.allow === true).length, noCol = rows.filter(x => x.allow === null).length, noPw = r.items.filter(it => !lulAllowKey(it.fields || {}, c2.pw)).length;
    m.innerHTML = `✅ ${rows.length} row(s) · <b>${on}</b> allowed · <b>${rows.length - on - noCol}</b> switched off${noCol ? ` · <span style="color:#c0392b">${noCol} row(s) without the “${plEsc(c2.allow)}” column</span>` : ''}${c2.pwOn && noPw ? ` · <span style="color:#c0392b">${noPw} row(s) without a “${plEsc(c2.pw)}” value (those users cannot sign in)</span>` : ''} — you (${plEsc(j.ids.join(' / ') || '—')}): <b>${j.found ? (j.allowed ? 'allowed ✔' : 'switched off ✘') : 'not found ✘'}</b>`;
    p.style.display = ''; p.innerHTML = `<table class="fd-tbl"><thead><tr><th>User (first columns)</th><th>${plEsc(c2.allow)}</th></tr></thead><tbody>${rows.map(x => `<tr><td>${plEsc(x.who || '—')}</td><td>${x.allow === null ? '—' : x.allow ? '<span class="fd-tag add">Yes</span>' : '<span class="fd-tag less">No</span>'}</td></tr>`).join('')}</tbody></table>`; });
})();

/* ---- column filters (drop-down lists) for on-page tables ---- */
const TCF = {};
function tcfTxt(c) { return String(c.textContent || '').replace(/\s+/g, ' ').trim(); }
function tblColFilters(t) {
  if (!t || !t.tHead || !t.tHead.rows.length || !t.tBodies.length) return; const hr = t.tHead.rows[0], n = hr.cells.length, id = t.id || 'tcf', sig = [...hr.cells].map(c => c.textContent.trim()).join('|');
  let st = TCF[id]; if (!st || st.sig !== sig) st = TCF[id] = { sig, sel: {}, opts: {} };
  const body = () => [...t.tBodies[0].rows].filter(r => r.cells.length === n && !r.classList.contains('t'));
  const fr = document.createElement('tr'); fr.className = 'tcf-row'; const hh = Math.max(28, Math.round(hr.getBoundingClientRect().height) || 32);
  for (let i = 0; i < n; i++) {
    const th = document.createElement('th'); th.style.cssText = `top:${hh}px;padding:3px 4px;font-weight:400;`; if (hr.cells[i].classList.contains('n')) th.className = 'n';
    const seen = new Set(); body().forEach(r => { const x = tcfTxt(r.cells[i]); if (x && x.length <= 80 && seen.size < 5000) seen.add(x); });
    const opts = [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })); st.opts[i] = new Set(opts.map(x => x.toLowerCase()));
    th.appendChild(buildMultiCombo(st.sel[i] || [], opts, arr => { st.sel[i] = arr; tcfApply(t); }, { placeholder: 'Filter…' })); fr.appendChild(th);
  }
  t.tHead.appendChild(fr); tcfApply(t);
}
function tcfApply(t) {
  const st = TCF[t.id || 'tcf']; if (!st || !t.tHead) return; const n = t.tHead.rows[0].cells.length, F = Object.entries(st.sel).filter(([, v]) => v.length).map(([i, v]) => [+i, v.map(x => x.toLowerCase())]); let shown = 0, tot = 0;
  [...t.tBodies[0].rows].forEach(r => { if (r.cells.length !== n || r.classList.contains('t')) return; tot++; const hit = F.every(([i, vals]) => { const x = tcfTxt(r.cells[i]).toLowerCase(); return vals.some(v => st.opts[i] && st.opts[i].has(v) ? x === v : x.includes(v)); }); r.style.display = hit ? '' : 'none'; if (hit) shown++; });
  const card = t.closest('.card'), sub = card && card.querySelector('.tcf-count'); if (sub) sub.textContent = F.length ? ` · filtered ${shown} of ${tot}` : '';
}
function tcfRowOk(id, vals) { const st = TCF[id]; if (!st) return true; return Object.entries(st.sel).every(([i, v]) => !v.length || v.some(x => { const y = String(vals[i] == null ? '' : vals[i]).toLowerCase(), z = x.toLowerCase(); return st.opts[i] && st.opts[i].has(z) ? y === z : y.includes(z); })); }
document.addEventListener('scroll', e => { const a = document.activeElement; if (a && a.classList && a.classList.contains('mc-input') && e.target.closest && e.target.closest('.fd-wrap,.table-wrap') && e.target.contains(a)) a.blur(); }, true);
/* ---- system name & logo (admin) ---- */
const BRAND_DEFAULT = { name: '', tag: '', logo: '', img: '', co: {}, sb: {} };
const BRAND_ORIG = { name: 'NFPC SC Mngt Support System', tag: 'Enterprises Secure Edition', logoLogin: '🔐', logoSide: '📊' };
(function () {
  const KEY = LS_BASE + '_brand', Q = s => document.querySelector(s);
  const get = () => { let c = {}; try { c = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {} return { name: c.name || BRAND_DEFAULT.name || '', tag: c.tag || BRAND_DEFAULT.tag || '', logo: c.logo || BRAND_DEFAULT.logo || '', img: c.img || BRAND_DEFAULT.img || '', co: Object.assign({}, BRAND_DEFAULT.co || {}, c.co || {}), sb: Object.assign({}, BRAND_DEFAULT.sb || {}, c.sb || {}), rad: c.rad != null && c.rad !== '' ? c.rad : (BRAND_DEFAULT.rad != null ? BRAND_DEFAULT.rad : '') }; };
  const esc = t => String(t).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  function apply(c) {
    c = c || get(); const name = c.name || BRAND_ORIG.name;
    document.querySelectorAll('[data-brand="name"]').forEach(e => e.textContent = name);
    document.querySelectorAll('[data-brand="tag"]').forEach(e => e.textContent = c.tag || BRAND_ORIG.tag);
    document.querySelectorAll('[data-brand="logo"]').forEach((e, i) => { const orig = e.closest('.login-brand') ? BRAND_ORIG.logoLogin : BRAND_ORIG.logoSide; if (c.img) { e.innerHTML = '<img alt="" src="' + esc(c.img) + '" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">'; e.style.background = 'transparent'; e.style.padding = '0'; e.style.boxShadow = 'none'; } else { e.textContent = c.logo || orig; e.style.background = ''; e.style.padding = ''; } });
    document.title = name + ' — Secure'; coShow(c); sbApply(c.sb); favApply(c); radApply(c.rad);
  }
  function radApply(v) {
    let st = document.querySelector('#radCss'); if (!st) { st = document.createElement('style'); st.id = 'radCss'; document.head.appendChild(st); }
    const n = v === '' || v == null ? NaN : parseInt(v, 10); if (!isFinite(n) || n < 0) { st.textContent = ''; return; } const r = Math.min(40, n), i = Math.round(r * .75), P = 'html body ';
    st.textContent = P + '.card,' + P + '.pl-card,' + P + '.mdl-box,' + P + '.fd-modal>.card,' + P + '#fdTripModal>.card,' + P + '#mdpRtModal>.card,' + P + '[data-mdl].mdl-win,' + P + '#tblExpandOverlay.te-win,' + P + '.login-box,' + P + '.login-card{border-radius:' + r + 'px!important}'
      + P + '.tm-card,' + P + '.tm-k,' + P + '.pl-kpi,' + P + '.target-card,' + P + '.schedule-card,' + P + '.profile-card{border-radius:' + i + 'px!important}'
      + P + '.fd-modal.fd-max>.card,' + P + '#fdTripModal.fd-max>.card,' + P + '#mdpRtModal.fd-max>.card,' + P + '.mdl-box.mdl-full,' + P + '[data-mdl].mdl-full,' + P + '.pl-card.pl-full{border-radius:0!important}';
  }
  function favApply(c) {
    try { let l = document.querySelector('link[rel~="icon"]#brFav') || document.querySelector('link[rel~="icon"]'); if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); } l.id = 'brFav';
      if (!l.dataset.orig) l.dataset.orig = l.getAttribute('href') || ''; if (c.img) { l.type = ''; l.href = c.img; return; }
      if (c.logo) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#1F4E79'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff'; g.font = 'bold 34px Segoe UI,Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(c.logo).slice(0, 2), 32, 35); l.type = 'image/png'; l.href = cv.toDataURL('image/png'); return; }
      if (l.dataset.orig) l.href = l.dataset.orig; } catch (e) {}
  }
  function sbApply(o) {
    o = o || {}; let st = document.querySelector('#sbFontCss'); if (!st) { st = document.createElement('style'); st.id = 'sbFontCss'; document.head.appendChild(st); }
    const fam = v => v ? "font-family:'" + String(v).replace(/['\\<>]/g, '') + "',Segoe UI,Arial,sans-serif!important;" : '', n = parseInt(o.size, 10), set = n >= 9 && n <= 24, z = set ? n : 13, hn = parseInt(o.hsize, 10), h = hn >= 10 && hn <= 28 ? hn : Math.max(16, z + 3), f = fam(o.font), hf = fam(o.hfont);
    st.textContent = (f ? '.sidebar,.sidebar *{' + f + '}' : '') + (hf ? '.sidebar .nav-section-label,.sidebar .nav-section-label *{' + hf + '}' : '')
      + '.sidebar .nav-item,.sidebar .nav-item>span:not(.icon):not(.badge){font-size:' + z + 'px!important}.sidebar .nav-item .badge{font-size:' + Math.max(9, z - 3) + 'px!important}.sidebar .nav-item .icon{font-size:' + (z + 3) + 'px!important}'
      + '.sidebar .nav-section-label,.sidebar .nav-group-head,.sidebar .nav-group-head .gname{font-size:' + h + 'px!important;font-weight:700}.sidebar .nav-group-head .gcount,.sidebar .nav-group-head .caret{font-size:' + Math.max(11, h - 3) + 'px!important}'
      + (set ? '.sidebar .user-name{font-size:' + z + 'px!important}.sidebar .user-role,.sidebar-tagline{font-size:' + Math.max(9, z - 3) + 'px!important}.sidebar-brand{font-size:' + (z + 2) + 'px!important}' : '');
    const L = 'rgba(125,165,255,.5)', AC = 'var(--acc-3,#4d7cf0)', G = String(o.gstyle || '').toUpperCase(), P = 'body:not(.sb-mini) .sidebar .nav-group-body', I = P + ' .nav-item', css = {
      A: P + '{margin-left:22px;border-left:2px solid ' + L + '}' + I + '{position:relative;margin-left:16px!important}' + I + '::before{content:"";position:absolute;left:-16px;top:50%;width:14px;border-top:2px solid ' + L + '}',
      B: P + '{margin-left:22px;border-left:4px solid ' + AC + ';border-radius:3px}' + I + '{margin-left:10px!important}',
      C: P + '{margin:2px 6px 8px 22px;padding:4px;background:rgba(255,255,255,.05);border:1px solid rgba(125,165,255,.28);border-radius:10px}' + I + '{margin-left:0!important}',
      D: P + '{margin-left:22px;border-left:2px dotted ' + L + '}' + I + '{position:relative;margin-left:18px!important}' + I + '::before{content:"";position:absolute;left:-23px;top:50%;margin-top:-5px;width:10px;height:10px;border-radius:50%;box-sizing:border-box;background:var(--sidebar-bg,#0f1a36);border:2px solid ' + AC + '}' + I + '.active::before{background:' + AC + '}',
      E: P + '{position:relative;margin-left:22px}' + P + '::before{content:"";position:absolute;left:0;top:0;bottom:20px;border-left:2px solid ' + L + '}' + I + '{position:relative;margin-left:16px!important}' + I + '::before{content:"";position:absolute;left:-16px;top:50%;width:14px;height:0;border-top:2px solid ' + L + '}'
    };
    st.textContent += css[G] || '';
    const p = document.querySelector('#sbPrev'); if (p) { p.style.fontFamily = o.font ? "'" + o.font + "',sans-serif" : ''; p.style.fontSize = z + 'px'; }
    const ph = document.querySelector('#sbPrevH'); if (ph) { ph.style.fontFamily = o.hfont ? "'" + o.hfont + "',sans-serif" : ''; ph.style.fontSize = h + 'px'; }
  }
  const CO = [['name', 'Trade name', '🏢'], ['addr', 'Address', '📍'], ['phone', 'Tel', '📞'], ['fax', 'Fax', '📠'], ['mail', 'Email', '✉'], ['web', 'Website', '🌐'], ['reg', 'Registration / Tax no.', '🧾']];
  function coShow(c) {
    const k = (c.co || {}), card = Q('#coCard'); if (!card) return; const has = CO.some(x => k[x[0]]) || k.about; if (!has) { card.style.display = 'none'; return; }
    const link = (key, v) => key === 'mail' ? '<a href="mailto:' + esc(v) + '">' + esc(v) + '</a>' : key === 'web' ? '<a target="_blank" rel="noopener" href="' + esc(/^https?:/i.test(v) ? v : 'https://' + v) + '">' + esc(v) + '</a>' : esc(v);
    Q('#coBody').innerHTML = '<div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">' + (c.img ? '<img alt="" src="' + esc(c.img) + '" style="width:72px;height:72px;object-fit:contain">' : '') + '<div style="flex:1;min-width:240px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px 24px">' + CO.filter(x => k[x[0]]).map(x => '<div><div class="hint">' + x[2] + ' ' + x[1] + '</div><div style="font-weight:600">' + link(x[0], k[x[0]]) + '</div></div>').join('') + '</div>' + (k.about ? '<p style="margin:12px 0 0;white-space:pre-wrap;color:var(--gray-700)">' + esc(k.about) + '</p>' : '') + '</div></div>';
    card.style.display = '';
  }
  window.brandApply = apply; window.brandGet = get;
  window.brandPrintHdr = function () { const c = get(), k = c.co || {}, name = k.name || c.name || BRAND_ORIG.name, line = [k.addr, k.phone && 'Tel ' + k.phone, k.fax && 'Fax ' + k.fax, k.mail && 'Email ' + k.mail, k.web && 'Web ' + k.web, k.reg && 'Reg/Tax ' + k.reg].filter(Boolean).map(esc).join('  ·  ');
    return '<div class="co-hdr" style="display:flex;align-items:center;gap:12px;padding:6px 0 8px;margin:0 0 8px;border-bottom:2px solid #1F4E79;font-family:Segoe UI,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact">' + (c.img ? '<img alt="" src="' + esc(c.img) + '" style="height:44px;width:auto;max-width:120px;object-fit:contain">' : '<div style="width:44px;height:44px;border-radius:8px;background:#1F4E79;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700">' + esc(c.logo || BRAND_ORIG.logoSide) + '</div>') + '<div><div style="font-size:16px;font-weight:700;color:#1F4E79">' + esc(name) + '</div>' + (line ? '<div style="font-size:10.5px;color:#555;margin-top:2px">' + line + '</div>' : '') + '</div></div>'; };
  function shrink(file) { return new Promise((ok, no) => { const fr = new FileReader(); fr.onerror = () => no(new Error('Could not read the file')); fr.onload = () => { if (/svg/.test(file.type)) { ok(fr.result); return; } const im = new Image(); im.onerror = () => no(new Error('Not a valid picture')); im.onload = () => { const m = 160, k = Math.min(1, m / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k)); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); ok(cv.toDataURL('image/png')); }; im.src = fr.result; }; fr.readAsDataURL(file); }); }
  let draft = null;
  function fill() { const c = get(); draft = Object.assign({}, c); Q('#brName').value = c.name; Q('#brTag').value = c.tag; Q('#brLogo').value = c.logo; const k = c.co || {}; draft.co = Object.assign({}, k); Q('#coName').value = k.name || ''; Q('#coAddr').value = k.addr || ''; Q('#coPhone').value = k.phone || ''; Q('#coFax').value = k.fax || ''; Q('#coMail').value = k.mail || ''; Q('#coWeb').value = k.web || ''; Q('#coReg').value = k.reg || ''; Q('#coAbout').value = k.about || ''; const sb = c.sb || {}; draft.sb = Object.assign({}, sb); Q('#sbFont').value = sb.font || ''; Q('#sbSize').value = sb.size || ''; Q('#sbHFont').value = sb.hfont || ''; Q('#sbHSize').value = sb.hsize || ''; Q('#sbGStyle').value = sb.gstyle || ''; sbApply(sb); draft.rad = c.rad; Q('#radN').value = c.rad === '' || c.rad == null ? '' : c.rad; Q('#radR').value = c.rad === '' || c.rad == null ? 12 : c.rad; radApply(c.rad); prev(); }
  function prev() { const d = draft || {}; Q('#brPrev').innerHTML = '<span style="width:34px;height:34px;border-radius:8px;background:' + (d.img ? 'transparent' : 'var(--brand)') + ';display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:18px;overflow:hidden">' + (d.img ? '<img alt="" src="' + esc(d.img) + '" style="width:100%;height:100%;object-fit:contain">' : esc(d.logo || BRAND_ORIG.logoSide)) + '</span>' + esc(d.name || BRAND_ORIG.name); }
  function msg(t, bad) { const m = Q('#brMsg'); if (m) { m.textContent = t; m.style.color = bad ? '#c0392b' : '#1e8449'; } }
  function wire() {
    if (!Q('#brandCard') || Q('#brandCard').dataset.w) return; Q('#brandCard').dataset.w = 1; fill();
    ['#brName', '#brTag', '#brLogo'].forEach(id => Q(id).addEventListener('input', () => { draft.name = Q('#brName').value.trim(); draft.tag = Q('#brTag').value.trim(); draft.logo = Q('#brLogo').value.trim(); prev(); }));
    [['#coName', 'name'], ['#coAddr', 'addr'], ['#coPhone', 'phone'], ['#coFax', 'fax'], ['#coMail', 'mail'], ['#coWeb', 'web'], ['#coReg', 'reg'], ['#coAbout', 'about']].forEach(([id, key]) => Q(id).addEventListener('input', () => { draft.co = draft.co || {}; draft.co[key] = Q(id).value.trim(); }));
    ['#sbFont', '#sbSize', '#sbHFont', '#sbHSize', '#sbGStyle'].forEach(id => Q(id).addEventListener('change', () => { draft.sb = { font: Q('#sbFont').value, size: Q('#sbSize').value, hfont: Q('#sbHFont').value, hsize: Q('#sbHSize').value, gstyle: Q('#sbGStyle').value }; sbApply(draft.sb); }));
    const setRad = v => { draft.rad = v; Q('#radN').value = v; if (v !== '') Q('#radR').value = v; radApply(v); };
    Q('#radR').addEventListener('input', () => setRad(Q('#radR').value)); Q('#radN').addEventListener('input', () => { const v = Q('#radN').value.trim(); setRad(v === '' ? '' : String(Math.max(0, Math.min(40, parseInt(v, 10) || 0)))); });
    Q('#radSq').onclick = () => setRad('0'); Q('#radDef').onclick = () => setRad('');
    Q('#brFile').onclick = () => Q('#brPick').click();
    Q('#brPick').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { draft.img = await shrink(f); prev(); msg('Picture ready — press Save.'); } catch (x) { msg(x.message, 1); } };
    Q('#brNoImg').onclick = () => { draft.img = ''; prev(); msg('Picture removed — press Save.'); };
    Q('#brSave').onclick = () => { if (!isAdmin()) { msg('Only administrators can change this.', 1); return; } try { localStorage.setItem(KEY, JSON.stringify(draft)); apply(); msg('✔ Saved.'); try { addActivity('settings', 'System name / logo changed'); } catch (e) {} } catch (x) { msg('Could not save (' + x.message + ') — the picture may be too large.', 1); } };
    Q('#brReset').onclick = () => { if (!isAdmin()) return; try { localStorage.removeItem(KEY); } catch (e) {} fill(); apply({ name: '', tag: '', logo: '', img: '', co: {}, sb: {}, rad: '' }); msg('Reset to the original name and logo.'); };
    Q('#brCopy').onclick = async () => { const t = 'const BRAND_DEFAULT = ' + JSON.stringify(draft) + ';'; try { await navigator.clipboard.writeText(t); msg('✔ Copied — paste it over the BRAND_DEFAULT line in the HTML file.'); } catch (e) { prompt('Copy this line:', t); } };
  }
  apply(); wire(); document.addEventListener('click', () => setTimeout(wire, 200)); setTimeout(wire, 1000);
})();
