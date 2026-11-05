/* ---- rack labels ---- */
const RK_COL = ['#1f4e79', '#7b2d26', '#2e6b3a', '#5b3a8c', '#8a5a00', '#006d77', '#9c2f62', '#3d4852', '#a14a00', '#1d6f5f', '#6b4e16'];
const RK_SIZES = { xl: { w: 297, h: 210, c: 1, r: 1, page: 'A4 landscape', hd: 8, cd: 44, bar: 34, ft: 5.2, pad: 10 }, l: { w: 148.5, h: 105, c: 2, r: 2, page: 'A4 landscape', hd: 4.4, cd: 19, bar: 15, ft: 2.8, pad: 5 }, m: { w: 99, h: 52.5, c: 3, r: 4, page: 'A4 landscape', hd: 2.9, cd: 10.5, bar: 8.5, ft: 1.9, pad: 3 }, s: { w: 70, h: 33, c: 3, r: 9, page: 'A4 portrait', hd: 2.1, cd: 7.2, bar: 6, ft: 1.5, pad: 2 } };
function rkLabelItems() {
  const terms = rkS.lq.map(t => String(t).toLowerCase().trim()).filter(Boolean), ws = rkS.lw; return rkAllLocs().filter(x => (!ws.length || ws.includes(x.no)) && (!terms.length || terms.some(t => (x.code + ' ' + x.no).toLowerCase().includes(t))));
}
function rkLabelsDoc(items, size, bar, chip) {
  const S = RK_SIZES[size] || RK_SIZES.l, perPage = S.c * S.r, e = plEsc, today = new Date().toLocaleDateString('en-GB'), group = (rkS.reg && rkS.reg.group) || '', stores = rkS.reg.stores.map(s => s.no), pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  const label = it => { const parts = it.code.replace(/\s+/g, ' ').split('-').map(p => p.trim()), col = RK_COL[Math.max(0, stores.indexOf(it.no)) % RK_COL.length];
    return `<div class="lb" style="--c:${col}"><div class="hd"><span class="nm">NFPC · ${e(group || 'WAREHOUSE')}</span>${chip ? `<span class="chip">WHs ${e(it.no)}</span>` : ''}</div><div class="cd">${parts.map((p, k) => k === 0 ? `<span class="p0">${e(p)}</span>` : `<span class="sep">–</span><b>${e(p)}</b>`).join('')}</div>${bar ? `<div class="bc">${rkBarSvg(it.code.replace(/\s+/g, ' ').trim())}</div>` : '<div class="bc"></div>'}<div class="ft"><span>RACK LOCATION</span><span>${e(it.code)}</span><span>${today}</span></div></div>`; };
  const css = `@page{size:${S.page};margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;background:#fff;font-family:'Segoe UI',Arial,sans-serif}
  .pg{width:${S.c * S.w}mm;height:${S.r * S.h}mm;display:grid;grid-template-columns:repeat(${S.c},${S.w}mm);grid-template-rows:repeat(${S.r},${S.h}mm);page-break-after:always;break-after:page;overflow:hidden}.pg:last-child{page-break-after:auto;break-after:auto}
  .lb{width:${S.w}mm;height:${S.h}mm;padding:${S.pad}mm;border:.2mm dashed #b8c0cc;display:flex;flex-direction:column;justify-content:space-between;color:#14213d;position:relative;overflow:hidden}
  .lb:before{content:"";position:absolute;left:0;top:0;bottom:0;width:${Math.max(1.6, S.pad / 3)}mm;background:var(--c)}
  .hd{display:flex;justify-content:space-between;align-items:center;font-size:${S.hd}mm;font-weight:700;letter-spacing:.06em;color:#51607f;gap:${S.pad / 2}mm}.nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .chip{background:var(--c);color:#fff;border-radius:${S.hd / 2}mm;padding:${S.hd * .12}mm ${S.hd * .6}mm;white-space:nowrap}
  .cd{display:flex;align-items:baseline;justify-content:center;gap:${S.cd * .12}mm;font-size:${S.cd}mm;font-weight:800;line-height:1;letter-spacing:-.01em;white-space:nowrap}.cd .p0{color:#8b97ad;font-weight:600;font-size:.62em}.cd b{color:var(--c)}.cd .sep{color:#c0c8d6;font-weight:400;font-size:.7em}
  .bc{height:${S.bar}mm;padding:0 ${S.pad}mm}.ft{display:flex;justify-content:space-between;font-size:${S.ft}mm;color:#7a859b;letter-spacing:.05em;border-top:.2mm solid #e1e6ef;padding-top:${S.ft * .4}mm}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Rack location labels</title><style>${css}</style></head><body>${pages.map(p => `<div class="pg">${p.map(label).join('')}</div>`).join('')}</body></html>`;
}
function rkLRender() {
  const q = PLQ, all = rkAllLocs(), items = rkLabelItems(), size = q('#rkLSize').value; rkS.lsize = size; const stage = q('#rkLStage'), S = RK_SIZES[size];
  const nos = [...new Set(all.map(x => x.no))], optsQ = all.map(x => x.code), sig = nos.join() + '|' + rkS.lw.join() + '|' + rkS.lq.join();
  if (q('#rkLWhs').dataset.sig !== sig) { q('#rkLWhs').dataset.sig = sig; q('#rkLWhs').innerHTML = ''; q('#rkLWhs').appendChild(buildMultiCombo(rkS.lw, nos, a => { rkS.lw = a; rkLRender(); }, { placeholder: 'All WHs codes' })); q('#rkLQ').innerHTML = ''; q('#rkLQ').appendChild(buildMultiCombo(rkS.lq, optsQ, a => { rkS.lq = a; rkLRender(); }, { placeholder: 'Type a code or part of it…' })); }
  q('#rkLCount').textContent = `— ${items.length} label(s) · ${Math.ceil(items.length / (S.c * S.r)) || 0} page(s)`;
  if (!items.length) { stage.style.height = 'auto'; stage.innerHTML = '<div class="pl-empty">No locations match.</div>'; return; }
  if (!stage.offsetWidth) { setTimeout(rkLRender, 80); return; }
  stage.innerHTML = ''; const f = document.createElement('iframe'), pw = S.c * S.w * 3.7795, ph = S.r * S.h * 3.7795, np = Math.ceil(items.length / (S.c * S.r)); f.style.cssText = `border:0;width:${pw}px;height:${np * (ph + 12)}px;background:#e8ecf1;transform-origin:0 0;`; stage.appendChild(f);
  const d = f.contentWindow.document; d.open(); d.write(rkLabelsDoc(items, size, q('#rkLBar').checked, q('#rkLChip').checked).replace('</style>', '.pg{box-shadow:0 1px 6px rgba(0,0,0,.25);margin:0 0 12px;background:#fff}body{background:#e8ecf1}@media print{.pg{box-shadow:none;margin:0}}</style>')); d.close();
  const sc = Math.min(1, (stage.clientWidth - 2) / pw); f.style.transform = `scale(${sc})`; stage.style.height = Math.round(np * (ph + 12) * sc) + 4 + 'px';
}

/* ---- register ---- */
function rkRRender() {
  if (!rkS.reg) rkLoad(); const st = rkS.reg.stores, tot = st.reduce((a, s) => a + s.locs.length, 0); PLQ('#rkRCount').textContent = `— ${st.length} WHs codes · ${tot} locations`;
  PLQ('#rkRBody').innerHTML = st.map((s, i) => `<tr><td><strong>${plEsc(s.no)}</strong></td><td>${plEsc(rkS.reg.group || '')}</td><td class="n">${s.locs.length}</td><td>${plEsc(s.locs[0] || '')}</td><td>${plEsc(s.locs[s.locs.length - 1] || '')}</td><td><button class="ghost small" data-rv="${i}" type="button">👁 View</button> <button class="ghost small" data-rd="${i}" type="button">✖</button></td></tr>`).join('') || '<tr><td colspan="6" style="padding:14px;text-align:center;color:var(--gray-400);font-style:italic;">The register is empty — import an Excel sheet.</td></tr>';
}
function rkParseSheet(rows) {
  let hr = -1; for (let i = 0; i < Math.min(rows.length, 15) && hr < 0; i++) if ((rows[i] || []).some(c => /store\s*no|whs/i.test(String(c || '')) && /\(\s*[A-Za-z0-9]+\s*\)/.test(String(c || '')))) hr = i;
  const stores = []; let group = '';
  if (hr >= 0) { (rows[hr - 1] || []).forEach(c => { if (!group && c && !/rack locations?/i.test(String(c))) group = String(c).trim(); }); (rows[hr] || []).forEach((h, c) => { const m = /\(\s*([A-Za-z0-9]+)\s*\)/.exec(String(h || '')); if (!m) return; const locs = []; for (let r = hr + 1; r < rows.length; r++) { const v = rows[r] && rows[r][c]; if (v != null && String(v).trim() !== '') locs.push(String(v).trim()); } if (locs.length) stores.push({ no: m[1], locs }); }); }
  else { /* simple 2-column list: WHs code | location code */ const by = new Map(); rows.forEach(r => { if (r && r[0] != null && r[1] != null && String(r[0]).trim() && String(r[1]).trim() && !/whs|store|code/i.test(String(r[0]))) { const k = String(r[0]).trim(); if (!by.has(k)) by.set(k, []); by.get(k).push(String(r[1]).trim()); } }); by.forEach((locs, no) => stores.push({ no, locs })); }
  if (!stores.length) throw new Error('No “Store No -( code )” columns found. Expected the layout of “RACK Location Suggested Codes”, or two columns: WHs code | location code.'); return { stores, group };
}
function rkRSet(msg, bad) { const e = PLQ('#rkRMsg'); e.textContent = msg; e.style.color = bad ? '#b42318' : '#0b7a0b'; }
function rkExportReg() { const st = rkS.reg.stores, max = Math.max(0, ...st.map(s => s.locs.length)), rows = [[rkS.reg.title || 'Rack Locations', rkS.reg.group || ''], st.map(s => `MAQ Store No -( ${s.no} )`)]; for (let i = 0; i < max; i++) rows.push(st.map(s => s.locs[i] || '')); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Rack'); XLSX.writeFile(wb, 'RACK_Location_Suggested_Codes.xlsx'); addActivity('export', 'Rack code register'); }

/* ---- wiring ---- */
let rkInited = false;
function rkRenderAll() {
  PLQ('#rkTabs').innerHTML = [['sign', '🪧 Signboard'], ['labels', '🏷 Rack labels'], ['reg', '📋 Rack code register']].map(t => `<button type="button" data-t="${t[0]}" class="${rkS.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('');
  document.querySelectorAll('#view-locsign .rk-pane').forEach(p => p.style.display = p.dataset.p === rkS.tab ? '' : 'none'); if (rkS.tab === 'sign') sbRender(); else if (rkS.tab === 'labels') rkLRender(); else rkRRender();
}
function rkInit() {
  if (rkInited) return; rkInited = true; rkLoad(); const q = PLQ; setTimeout(sbMcInit, 0);
  q('#rkTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; rkS.tab = b.dataset.t; rkRenderAll(); });
  const pick = () => { const v = q('#sbFind').value, i = sbAll().findIndex(d => sbLabel(d) === v || d.Location_Code.toLowerCase() === v.trim().toLowerCase()); if (i >= 0) { rkS.sb = i; sbRender(); } };
  const sbFields = d => [d.Location_Code, d.Dept_Desc, d.Store_Desc, d.WHs_ID, d.Region_ID, d.Storage_Type, d.Racking_Type, d.Storage_Temp_Type].map(x => x == null ? '' : String(x)).join(' ').toLowerCase();
  const sbSearch = v => { const toks = v.toLowerCase().split(/[\s,;|]+/).filter(Boolean); if (!toks.length) return []; const out = []; sbAll().forEach((d, i) => { const hay = sbFields(d), nh = hay.replace(/[\s\-_.]/g, ''); if (toks.every(t => hay.includes(t) || nh.includes(t.replace(/[\-_.]/g, '')))) out.push(i); }); return out; };
  let sbHits = [], sbAct = -1; const res = q('#sbRes');
  const sbPaint = () => { const v = q('#sbFind').value.trim(); if (!v) { res.style.display = 'none'; return; } sbHits = sbSearch(v); sbAct = sbHits.length ? 0 : -1; const all = sbAll(), toks = v.toLowerCase().split(/[\s,;|]+/).filter(Boolean), hl = t => { let h = plEsc(t); toks.forEach(k => { const e = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); h = h.replace(new RegExp('(' + plEsc(e) + ')', 'ig'), '<mark style="background:#fde68a;padding:0">$1</mark>'); }); return h; };
    res.innerHTML = `<div class="text-sm" style="padding:4px 8px;color:var(--gray-500)">${sbHits.length ? plF(sbHits.length) + ' match' + (sbHits.length > 1 ? 'es' : '') + (sbHits.length > 60 ? ' — showing the first 60, keep typing to narrow' : '') : 'No location matches “' + plEsc(v) + '”'}</div>` + sbHits.slice(0, 60).map((i, k) => { const d = all[i]; return `<div class="sbHit" data-i="${i}" style="padding:5px 8px;border-radius:6px;cursor:pointer;${k === 0 ? 'background:var(--gray-100,#eef2f7)' : ''}"><b>${hl(d.Location_Code)}</b> <span class="text-sm" style="color:var(--gray-600)">· ${hl(d.Dept_Desc || '')} · ${hl(d.Store_Desc || '')}${d.Storage_Type ? ' · ' + hl(d.Storage_Type) : ''}</span></div>`; }).join(''); res.style.display = 'block'; };
  const sbMark = () => { [...res.querySelectorAll('.sbHit')].forEach((e, k) => { e.style.background = k === sbAct ? 'var(--gray-100,#eef2f7)' : ''; if (k === sbAct) e.scrollIntoView({ block: 'nearest' }); }); };
  const sbGo = i => { rkS.sb = i; res.style.display = 'none'; q('#sbFind').blur(); sbRender(); };
  q('#sbFind').addEventListener('input', sbPaint);
  q('#sbFind').addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (res.style.display === 'none') sbPaint(); const n = Math.min(sbHits.length, 60); if (!n) return; e.preventDefault(); sbAct = (sbAct + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; sbMark(); } else if (e.key === 'Enter') { e.preventDefault(); if (sbAct >= 0 && sbHits[sbAct] != null && res.style.display !== 'none') sbGo(sbHits[sbAct]); else pick(); } else if (e.key === 'Escape') res.style.display = 'none'; });
  res.addEventListener('mousedown', e => { const h = e.target.closest('.sbHit'); if (h) { e.preventDefault(); sbGo(+h.dataset.i); } });
  q('#sbFind').addEventListener('blur', () => setTimeout(() => { res.style.display = 'none'; }, 120));
  q('#sbFind').addEventListener('change', pick); q('#sbFind').addEventListener('focus', e => { e.target.select(); }); q('#sbPrev').addEventListener('click', () => { const n = sbAll().length; rkS.sb = (rkS.sb - 1 + n) % n; sbRender(); }); q('#sbNext').addEventListener('click', () => { rkS.sb = (rkS.sb + 1) % sbAll().length; sbRender(); });
  q('#sbPrint').addEventListener('click', async () => { const f = q('#sbStage iframe'); if (!f) return; try { if (f._mapP) await f._mapP; npOpenPrint('<!doctype html>' + f.contentDocument.documentElement.outerHTML, 'Signboard ' + sbAll()[rkS.sb].Location_Code); addActivity('export', 'Printed signboard ' + sbAll()[rkS.sb].Location_Code); } catch (e) { sectionToast('Could not open the print window: ' + e.message, 'warn'); } });
  const readImg = (file, max, cb) => { if (!file) return; if (file.size > max) { sectionToast(`Picture too large (max ${Math.round(max / 1024)} KB).`, 'warn'); return; } const r = new FileReader(); r.onload = () => cb(String(r.result)); r.readAsDataURL(file); };
  q('#sbLogoBtn').addEventListener('click', () => q('#sbLogoFile').click()); q('#sbLogoFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; readImg(f, 600 * 1024, u => { rkS.logo = u; if (rkLSset(SB_LOGO_KEY, u)) sbRender(); }); }); q('#sbLogoClr').addEventListener('click', () => { rkS.logo = ''; rkLSset(SB_LOGO_KEY, ''); sbRender(); });
  q('#sbMapBtn').addEventListener('click', () => q('#sbMapFile').click()); q('#sbMapFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; readImg(f, 1200 * 1024, u => { rkS.maps[sbAll()[rkS.sb].Location_Code] = u; if (rkLSset(SB_MAPS_KEY, rkS.maps)) sbRender(); }); }); q('#sbMapClr').addEventListener('click', () => { delete rkS.maps[sbAll()[rkS.sb].Location_Code]; rkLSset(SB_MAPS_KEY, rkS.maps); sbRender(); });
  q('#sbImpBtn').addEventListener('click', () => q('#sbImpFile').click()); q('#sbImpFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const m = q('#sbMsg');
    try { const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }), nz = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, ''), keys = ['Location_Code', 'Dept_Desc', 'Racking_Type', 'Storage_Type', 'Storage_Temp_Type', 'Store_Desc', 'WHs_ID', 'Region_ID', 'STR_Mini_Temp', 'Store_Capacity', 'Map_Image'];
      const out = rows.map(r => { const o = {}, rk = Object.keys(r); keys.forEach(k => { const h = rk.find(x => nz(x) === nz(k)); o[k] = h ? String(r[h]).trim() : ''; }); return o; }).filter(o => o.Location_Code); if (!out.length) throw new Error('No “Location_Code” column found.');
      const have = new Set(sbAll().map(d => d.Location_Code)); let add = 0; out.forEach(o => { if (!have.has(o.Location_Code)) { rkS.extra.push(o); have.add(o.Location_Code); add++; } }); rkLSset(SB_EXTRA_KEY, rkS.extra); m.textContent = `✓ ${add} new location(s) added (${out.length - add} already existed).`; sbRender(); } catch (err) { m.textContent = '✘ ' + err.message; } });
  q('#sbExpBtn').addEventListener('click', () => { const a = sbAll(), keys = Object.keys(a[0]), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([keys, ...a.map(d => keys.map(k => d[k] || ''))]), 'Locations'); XLSX.writeFile(wb, 'Warehouse_Locations.xlsx'); });
  ['#rkLSize', '#rkLBar', '#rkLChip'].forEach(s => q(s).addEventListener('change', rkLRender));
  q('#rkLPrint').addEventListener('click', () => { const it = rkLabelItems(); if (!it.length) { sectionToast('No labels to print.', 'warn'); return; } rkPrintDoc(rkLabelsDoc(it, q('#rkLSize').value, q('#rkLBar').checked, q('#rkLChip').checked), `${it.length} rack labels`); });
  q('#rkLExcel').addEventListener('click', () => { const it = rkLabelItems(), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['WHs code', 'Location code'], ...it.map(x => [x.no, x.code])]), 'Rack labels'); XLSX.writeFile(wb, 'Rack_Location_Labels.xlsx'); });
  q('#rkRImp').addEventListener('click', () => q('#rkRFile').click()); q('#rkRFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }), P = rkParseSheet(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null })); if (!confirm(`Replace the register with ${P.stores.length} WHs codes / ${P.stores.reduce((a, s) => a + s.locs.length, 0)} locations from “${f.name}”?`)) return; rkS.reg = { title: 'Rack Locations', group: P.group || rkS.reg.group || '', stores: P.stores }; rkSave(); rkRRender(); rkRSet(`✓ ${P.stores.length} WHs codes imported.`); addActivity('upload', 'Rack code register imported'); } catch (err) { rkRSet('✘ ' + err.message, true); } });
  q('#rkRExp').addEventListener('click', rkExportReg); q('#rkRReset').addEventListener('click', () => { if (!confirm('Restore the built-in “RACK Location Suggested Codes” (11 WHs codes, 255 locations)? Your register is replaced.')) return; rkS.reg = JSON.parse(JSON.stringify(RK_DEFAULT)); rkSave(); rkRRender(); rkRSet('✓ Built-in register restored.'); });
  q('#rkRBody').addEventListener('click', e => { const v = e.target.closest('[data-rv]'), d = e.target.closest('[data-rd]'); if (v) { const s = rkS.reg.stores[+v.dataset.rv]; alert(`WHs code ${s.no} — ${s.locs.length} locations\n\n` + s.locs.join('   ')); } else if (d) { const s = rkS.reg.stores[+d.dataset.rd]; if (s && confirm(`Remove WHs code ${s.no} (${s.locs.length} locations) from the register?`)) { rkS.reg.stores.splice(+d.dataset.rd, 1); rkSave(); rkRRender(); } } });
  q('#rkRAdd').addEventListener('click', () => { const no = q('#rkRNo').value.trim(), codes = q('#rkRCodes').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean); if (!no || !codes.length) { rkRSet('Enter the WHs code and at least one location code.', true); return; } const i = rkS.reg.stores.findIndex(s => s.no === no); if (i >= 0) rkS.reg.stores[i].locs = codes; else rkS.reg.stores.push({ no, locs: codes }); rkSave(); rkRRender(); rkRSet(`✓ WHs code ${no}: ${codes.length} locations saved.`); q('#rkRNo').value = ''; q('#rkRCodes').value = ''; });
  q('#rkRChk').addEventListener('input', e => { const v = e.target.value.trim(), o = q('#rkRChkOut'); if (!v) { o.textContent = ''; return; } const h = rkIndex().get(rkNorm(v)); o.innerHTML = h ? `✓ <strong>${plEsc(h.code)}</strong> belongs to WHs code <strong>${plEsc(h.no)}</strong>` : '✘ Not in the register'; });
  window.addEventListener('resize', () => { if (document.querySelector('#view-locsign.active')) { if (rkS.tab === 'sign') sbRender(); else if (rkS.tab === 'labels') rkLRender(); } });
}
rkLoad();
document.querySelectorAll('.nav-item[data-view="locsign"]').forEach(n => n.addEventListener('click', () => setTimeout(() => { rkInit(); rkRenderAll(); }, 0)));

/* ============================================================
   STAFF ROSTER — daily time-slot availability, weekly plan, push to SharePoint
   ============================================================ */
const RO_KEY = LS_BASE + '_ro';
const ro = { lv: { year: new Date().getFullYear(), from: '', to: '', ent: 30, blocks: 0, min: 7, max: 21, gap: 14, capMode: 'n', cap: 1, loc: '', spread: true, roles: [], spCol: '', black: [], entRole: {}, entPer: {}, extra: {}, pref: {}, defMode: 'phased', mode: {}, ph: {}, plan: {}, notes: [], view: 'grid', gran: 'weeks', month: 1 }, queue: [], brk: [], brkTpl: [], rosTpl: [], smart: { align: true, commit: true, shift: null, view: 'grid', sw: [], fReg: '', fWh: '', fSt: '', regions: [], whs: [], stores: [], perLoc: true, total: 60, n: 2, min: 30, max: 60, step: 15, margin: 120, wf: '', wt: '', cap: 0, roles: [], date: '' }, staff: [], slots: [], days: {}, status: {}, area: {}, sync: null, spCols: [], hidden: null, cf: {}, cfCols: null, qS: [], tab: 'staff', date: '', week: '', roles: [], rolesW: [], q: [], qW: [], shiftSel: [], slotSel: [] };
const RO_TABS = [['staff', '👥 1 · Staff & slots'], ['daily', '🗓 2 · Daily'], ['weekly', '📆 3 · Weekly'], ['push', '⬆ 4 · SharePoint'], ['spstaff', '🔗 5 · Staff from SharePoint'], ['sync', '🔄 6 · Sync queue']];
const RO_WSTAT = ['Day', 'Night', 'Off', 'Leave'];
const roShort = n => String(n == null ? '' : n).replace(/\s*shift\s*$/i, '').trim() || String(n || '');
const roShiftNames = () => { const o = (ro.shifts && ro.shifts.length ? ro.shifts : ['Day Shift', 'Night Shift']).slice(); ro.slots.forEach(s => { if (s.shift && !o.some(n => roShort(n).toLowerCase() === roShort(s.shift).toLowerCase())) o.push(s.shift); }); return o; };
const roSlotsOfShift = type => ro.slots.filter(s => roShort(s.shift).toLowerCase() === String(type).toLowerCase());
const roWSt = () => roShiftNames().map(roShort).concat(['Off', 'Leave']);
const roShiftIcon = n => /^day/i.test(n) ? '☀' : /^night/i.test(n) ? '🌙' : '🕒';
const roT = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const roM = s => { const m = String(s).match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const roDur = s => { const a = roM(s.from), b = roM(s.to); if (a == null || b == null) return 0; let d = b - a; if (d <= 0) d += 1440; return d / 60; };
const roK = s => s.from + '-' + s.to;
const roIsoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const roAdd = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return roIsoLocal(new Date(y, m - 1, d + n)); };
const roMonday = iso => { const [y, m, d] = iso.split('-').map(Number), dt = new Date(y, m - 1, d); return roAdd(iso, -((dt.getDay() + 6) % 7)); };
const roDow = iso => { const [y, m, d] = iso.split('-').map(Number); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(y, m - 1, d).getDay()]; };
const roNum = (n, d) => (Math.round(n * (d ? 10 : 1)) / (d ? 10 : 1)).toLocaleString('en-US', { maximumFractionDigits: d || 0 });
function roDefaultSlots() {
  const ends = [9, 10, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 17, 18, 19, 20, 21], nights = [22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32], out = []; let from = 7 * 60;
  ends.forEach(e => { const to = Math.round(e * 60); out.push({ shift: 'Day Shift', from: roT(from), to: roT(to) }); from = to; });
  nights.forEach(e => { const to = e * 60; out.push({ shift: 'Night Shift', from: roT(from), to: roT(to) }); from = to; }); return out;
}
function roLoad() {
  try { const d = JSON.parse(localStorage.getItem(RO_KEY) || 'null'); if (d) { ro.staff = d.staff || []; ro.slots = d.slots || []; ro.days = d.days || {}; ro.status = d.status || {}; ro.area = d.area || {}; ro.sync = d.sync || null; ro.shifts = d.shifts || null; ro.spCols = d.spCols || []; ro.hidden = d.hidden || null; ro.cf = d.cf || {}; ro.cfCols = d.cfCols || null; if (d.lv && typeof d.lv === 'object') Object.assign(ro.lv, d.lv); if (Array.isArray(d.queue)) ro.queue = d.queue.filter(e => e && e.id && e.col); if (d.brk) ro.brk = roBrkNorm(d.brk); if (d.smart) Object.assign(ro.smart, d.smart); if (Array.isArray(d.rosTpl)) ro.rosTpl = d.rosTpl.filter(t => t && t.name && Array.isArray(t.days)); if (Array.isArray(d.brkTpl)) ro.brkTpl = d.brkTpl.map(t => ({ name: String(t.name || ''), slots: roBrkNorm(t.slots) })).filter(t => t.name && t.slots.length); } } catch (e) {}
  if (!ro.slots.length) ro.slots = roDefaultSlots();
}
function roSave() { try { localStorage.setItem(RO_KEY, JSON.stringify({ shifts: ro.shifts, staff: ro.staff, slots: ro.slots, days: ro.days, status: ro.status, area: ro.area, sync: ro.sync, spCols: ro.spCols, hidden: ro.hidden, cf: ro.cf, cfCols: ro.cfCols, brk: ro.brk, brkTpl: ro.brkTpl, rosTpl: ro.rosTpl, queue: ro.queue, lv: ro.lv, smart: ro.smart })); } catch (e) { sectionToast('Browser storage is full.', 'warn'); } }
const roSlotsOf = (date, id) => ((ro.days[date] || {})[id]) || [];
function roSetSlots(date, id, keys) { ro.days[date] = ro.days[date] || {}; if (keys.length) ro.days[date][id] = keys; else delete ro.days[date][id]; }
function roPill(date, id) {
  if ((ro.status[date] || {})[id] === 'Leave') return 'Leave'; const k = new Set(roSlotsOf(date, id)); if (!k.size) return 'Off';
  const eq = a => a.length === k.size && a.every(x => k.has(x));
  for (const n of roShiftNames()) { const st = roShort(n), a = roSlotsOfShift(st).map(roK); if (a.length && eq(a)) return st; } return 'Custom';
}
function roApply(date, id, type) {
  const keys = (type === 'Off' || type === 'Leave' || type === 'Custom') ? [] : roSlotsOfShift(type).map(roK);
  roSetSlots(date, id, keys); ro.status[date] = ro.status[date] || {}; if (type === 'Leave') ro.status[date][id] = 'Leave'; else delete ro.status[date][id];
}
function roPerson(date, id) {
  const keys = new Set(roSlotsOf(date, id)), S = ro.slots.filter(s => keys.has(roK(s))), pill = roPill(date, id);
  const shifts = [...new Set(S.map(s => s.shift))], bk = roBrk(id), brkMin = bk ? S.reduce((a, s) => a + roBrkOverlap(bk, s), 0) : 0, gross = S.reduce((a, s) => a + roDur(s), 0); return { S, pill, hours: gross, brkMin, net: Math.max(0, gross - brkMin / 60), from: S.length ? S[0].from : '', to: S.length ? S[S.length - 1].to : '', shift: shifts.join(' + '), n: S.length };
}
/* ---------- break hours: a default for everybody + an optional own break per person ---------- */
const roBrkNorm = b => (Array.isArray(b) ? b : (b && typeof b === 'object' ? [b] : [])).filter(x => x && x.from && x.to && roM(x.from) != null && roM(x.to) != null && roM(x.from) !== roM(x.to)).map(x => ({ from: x.from, to: x.to }));
const roBrkSpan = x => { let d = roM(x.to) - roM(x.from); if (d <= 0) d += 1440; return d; };
const roBrkTotal = list => roBrkNorm(list).reduce((a, x) => a + roBrkSpan(x), 0);
function roBrk(id) {   // a person can take several break slots; the person's own list wins over the default list
  const s = ro.staff.find(x => x.id === id); let L = roBrkNorm(s && s.brk); const own = L.length > 0; if (!own) L = roBrkNorm(ro.brk); if (!L.length) return null;
  const list = L.map(b => ({ f: roM(b.from), d: roBrkSpan(b), from: b.from, to: b.to }));
  return { list, f: list[0].f, d: list.reduce((a, x) => a + x.d, 0), from: list[0].from, to: list[0].to, own, text: list.map(x => x.from + '–' + x.to).join(', ') };
}
const roBrkText = s => roBrkNorm(s && s.brk).map(x => x.from + '–' + x.to).join(', ');
function roBrkOverlap(bk, slot) { // minutes of the slot that fall inside any of the breaks
  if (!bk) return 0; const a = roM(slot.from), d = roDur(slot); if (a == null || !d) return 0; let best = 0;
  (bk.list || [bk]).forEach(g => [-1440, 0, 1440].forEach(sh => { const lo = Math.max(a, g.f + sh), hi = Math.min(a + d * 60, g.f + sh + g.d); if (hi > lo) best += hi - lo; })); return Math.min(best, d * 60);
}
function roBrkCheck(list) {
  if (list.some(b => (b.from && !b.to) || (!b.from && b.to))) return { err: 'Fill both the start and the end of every break slot (or remove the empty one).', list: [] };
  if (list.some(b => b.from && b.to && roM(b.from) === roM(b.to))) return { err: 'A break slot needs a start and an end that are different.', list: [] };
  const segs = roBrkNorm(list).map(b => { const f = roM(b.from); return [f, f + roBrkSpan(b), b]; }).sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < segs.length; i++) if (segs[i][0] < segs[i - 1][1]) return { err: `The break slots ${segs[i - 1][2].from}–${segs[i - 1][2].to} and ${segs[i][2].from}–${segs[i][2].to} overlap.`, list: [] };
  return { err: '', list: segs.map(x => ({ from: x[2].from, to: x[2].to })) };
}
const roBrkDraftD = [], roBrkDraftB = [], roBrkEd = {};
function roBrkEditor(host, list, onChange, opts) {  opts = opts || {};   // a repeatable "from → to" row editor for break slots
  const dur = b => { const f = b.from && roM(b.from), t = b.to && roM(b.to); return b.from && b.to && f !== t ? '= ' + roBrkSpan(b) + ' min' : ''; };
  const render = () => { host.innerHTML = (list.length ? list.map((b, i) => `<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap"><span class="text-sm" style="color:var(--gray-500);min-width:42px">Slot ${i + 1}</span><input type="time" data-bf="${i}" value="${plEsc(b.from || '')}" style="width:auto;margin:0"> → <input type="time" data-bt="${i}" value="${plEsc(b.to || '')}" style="width:auto;margin:0"><span class="text-sm" data-bd="${i}" style="color:var(--gray-600);min-width:60px">${dur(b)}</span><button type="button" class="ghost small" data-brm="${i}" title="Remove this break slot">✖</button></div>`).join('') : '<div class="text-sm" style="color:var(--gray-500);margin-bottom:4px">No break slot — add one.</div>') + '<button type="button" class="ghost small" data-badd="1">➕ Add break slot</button>' + (opts.tools ? tools() : ''); };
  const tools = () => { const T = ro.brkTpl.map((t, i) => `<option value="t${i}">${plEsc(t.name)} — ${plEsc(t.slots.map(x => x.from + '–' + x.to).join(', '))}</option>`).join(''), P = ro.staff.filter(x => x.id !== opts.self && roBrkNorm(x.brk).length).map(x => `<option value="p${plEsc(x.id)}">${plEsc(x.name || x.id)} — ${plEsc(roBrkText(x))}</option>`).join('');
    return `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px;padding-top:6px;border-top:1px dashed var(--gray-300,#ccc)"><select data-bsrc style="width:auto;max-width:340px;margin:0"><option value="">📋 Copy from template / staff…</option>${T ? `<optgroup label="Templates">${T}</optgroup>` : ''}${P ? `<optgroup label="Staff with their own break">${P}</optgroup>` : ''}</select><button type="button" class="ghost small" data-bload="1">Load</button><button type="button" class="ghost small" data-bsave="1" title="Save these slots as a reusable template">💾 Save as template</button><button type="button" class="ghost small" data-bdel="1" title="Delete the selected template">🗑 Delete template</button></div>`; };
  if (!host.dataset.brkBound) { host.dataset.brkBound = '1';
    host.addEventListener('input', e => { const t = e.target, i = t.dataset.bf != null ? +t.dataset.bf : t.dataset.bt != null ? +t.dataset.bt : -1; if (i < 0 || !list[i]) return; if (t.dataset.bf != null) list[i].from = t.value; else list[i].to = t.value; const d = host.querySelector(`[data-bd="${i}"]`); if (d) d.textContent = dur(list[i]); onChange && onChange(); });
    host.addEventListener('click', e => {
      const sel = host.querySelector('[data-bsrc]'), v = sel ? sel.value : '';
      if (e.target.closest('[data-bload]')) { let src = null; if (v[0] === 't') src = (ro.brkTpl[+v.slice(1)] || {}).slots; else if (v[0] === 'p') { const p = ro.staff.find(x => x.id === v.slice(1)); src = p && p.brk; } if (!src) return sectionToast('Pick a template or a staff member first.', 'warn'); list.length = 0; roBrkNorm(src).forEach(b => list.push({ from: b.from, to: b.to })); render(); onChange && onChange(); return; }
      if (e.target.closest('[data-bsave]')) { const c = roBrkCheck(list); if (c.err) return sectionToast(c.err, 'warn'); if (!c.list.length) return sectionToast('Add at least one break slot first.', 'warn'); const nm = (prompt('Template name (e.g. “Day shift breaks”):', v[0] === 't' ? ro.brkTpl[+v.slice(1)].name : '') || '').trim(); if (!nm) return; const ex = ro.brkTpl.find(t => t.name.toLowerCase() === nm.toLowerCase()); if (ex) { if (!confirm(`A template named “${ex.name}” exists. Replace it?`)) return; ex.slots = c.list; } else ro.brkTpl.push({ name: nm, slots: c.list }); roSave(); Object.values(roBrkEd).forEach(x => x && x.render()); render(); sectionToast(`✓ Template “${nm}” saved.`, 'success'); return; }
      if (e.target.closest('[data-bdel]')) { if (v[0] !== 't') return sectionToast('Select a template in the list to delete it.', 'warn'); const t = ro.brkTpl[+v.slice(1)]; if (!t || !confirm(`Delete the template “${t.name}”? People who already use it keep their breaks.`)) return; ro.brkTpl.splice(+v.slice(1), 1); roSave(); Object.values(roBrkEd).forEach(x => x && x.render()); render(); return; }
      const a = e.target.closest('[data-badd]'), r = e.target.closest('[data-brm]'); if (a) { list.push({ from: '', to: '' }); render(); const ins = host.querySelectorAll('input[type=time]'); if (ins.length) ins[ins.length - 2].focus(); } else if (r) { list.splice(+r.dataset.brm, 1); render(); } else return; onChange && onChange(); }); }
  render(); return { render };
}
function roBrkBand(bk, sl) {   // draws the break exactly where it falls inside a time-slot cell (and how many minutes of the cell it covers)
  if (!bk) return null; const a = roM(sl.from), d = roDur(sl) * 60; if (a == null || !d) return null; const iv = [];
  (bk.list || [bk]).forEach(g => [-1440, 0, 1440].forEach(sh => { const lo = Math.max(a, g.f + sh), hi = Math.min(a + d, g.f + sh + g.d); if (hi > lo) iv.push([lo - a, hi - a]); }));
  if (!iv.length) return null; iv.sort((x, y) => x[0] - y[0]); const m = []; iv.forEach(v => { const l = m[m.length - 1]; if (l && v[0] <= l[1]) l[1] = Math.max(l[1], v[1]); else m.push([v[0], v[1]]); });
  const mins = Math.round(m.reduce((q, v) => q + v[1] - v[0], 0)), st = []; let cur = 0; m.forEach(v => { const p1 = v[0] / d * 100, p2 = v[1] / d * 100; st.push(`#2e9e5b ${cur}% ${p1}%`, `#f5b041 ${p1}% ${p2}%`); cur = p2; }); st.push(`#2e9e5b ${cur}% 100%`);
  return { mins, style: `background:linear-gradient(to bottom,${st.join(',')})` };
}
const roBrkFull = (bk, slot) => bk && roBrkOverlap(bk, slot) >= roDur(slot) * 60 - 0.01;
const roActive = () => ro.staff.filter(s => s.active !== false);
const roAreaOf = (date, id) => ((ro.area[date] || {})[id]) || ((ro.staff.find(s => s.id === id) || {}).area) || '';
function roHay(s, date) { const x = roPerson(date || ro.date, s.id); return [s.id, s.name, s.role, roAreaOf(date || ro.date, s.id), s.defShift, s.offDay, x.pill, x.shift, x.from, x.to].concat(Object.values(s.sp || {}), Object.values(s.det || {})).filter(v => v != null && v !== '').join(' | ').toLowerCase(); }
function roFilter(roles, qs, date) { const terms = (Array.isArray(qs) ? qs : (qs ? [qs] : [])).map(t => String(t).toLowerCase().trim()).filter(Boolean), d = date || ro.date, cfk = Object.keys(ro.cf || {}).filter(k => (ro.cf[k] || []).length), defs = cfk.length ? roColDefs() : [];
  return roActive().filter(s => (!roles.length || roles.includes(s.role)) && roCfOk(s, cfk, defs) && (!terms.length || (h => terms.some(t => h.includes(t)))(roHay(s, d)))); }
function roCfOk(s, cfk, defs) { return cfk.every(k => { const df = defs.find(x => x.k === k); return !df || ro.cf[k].includes(roColVal(s, df)); }); }
const roShOn = sh => !ro.shiftSel.length || ro.shiftSel.includes(sh);
const roSlotLbl = s => s.from + '–' + s.to, roSlotOn = s => !ro.slotSel.length || ro.slotSel.includes(roSlotLbl(s)), roRowOn = s => roShOn(s.shift) && roSlotOn(s);
const roShiftPeople = S => !ro.shiftSel.length && !ro.slotSel.length ? S : S.filter(p => roSlotsOf(ro.date, p.id).some(k => ro.slots.some(s => roK(s) === k && roRowOn(s))));
const roDaily = () => roShiftPeople(roFilter(ro.roles, ro.q));
function roCfDefault() { return ro.spCols.filter(c => /^(region|whs?_?location|location|job_?role)$/i.test(c.label.replace(/\s+/g, '_')) || /^(region|whs_?location)$/i.test(c.k)).map(c => 's:' + c.k); }
function roCfRender(host) {
  if (!host) return; const defs = roColDefs(), cols = (ro.cfCols || roCfDefault()).filter(k => defs.some(d => d.k === k)), sigOf = () => cols.join(',') + '|' + JSON.stringify(ro.cf) + '|' + ro.staff.length + '|' + ro.spCols.length;
  if (host.dataset.sig === sigOf()) return; host.dataset.sig = sigOf(); host.innerHTML = '';
  const refresh = () => { host.dataset.sig = sigOf(); roSave(); if (ro.tab === 'daily') roGrid(); else if (ro.tab === 'weekly') roWeek(); else if (ro.tab === 'staff') roStaffRender(); roKpis(); };
  cols.forEach(k => { const d = defs.find(x => x.k === k), vals = [...new Set(roActive().map(s => roColVal(s, d)).filter(Boolean))].sort((a, b) => a.localeCompare(b)), w = document.createElement('div'); w.className = 'ro-cf'; w.innerHTML = `<label>${plEsc(d.l)} <a href="#" data-rm="${plEsc(k)}" title="Remove this filter" style="text-decoration:none;color:var(--gray-500)">✖</a></label>`; const c = document.createElement('div'); w.appendChild(c);
    c.appendChild(buildMultiCombo((ro.cf[k] || []).filter(v => vals.includes(v)), vals, arr => { if (arr.length) ro.cf[k] = arr; else delete ro.cf[k]; refresh(); }, { placeholder: 'All ' + d.l })); host.appendChild(w); });
  const rest = defs.filter(d => !cols.includes(d.k)), add = document.createElement('div'); add.className = 'ro-cf'; add.innerHTML = `<label>&nbsp;</label><select><option value="">＋ Filter by column…</option>${rest.map(d => `<option value="${plEsc(d.k)}">${plEsc(d.l)}</option>`).join('')}</select>`; host.appendChild(add);
  add.querySelector('select').addEventListener('change', e => { if (!e.target.value) return; ro.cfCols = cols.concat(e.target.value); host.dataset.sig = ''; roSave(); roRefreshCf(); });
  if (Object.keys(ro.cf).length) { const cl = document.createElement('div'); cl.className = 'ro-cf'; cl.innerHTML = '<label>&nbsp;</label><button type="button" class="ghost small">✖ Clear filters</button>'; cl.querySelector('button').addEventListener('click', () => { ro.cf = {}; host.dataset.sig = ''; roSave(); roRefreshCf(); }); host.appendChild(cl); }
  host.onclick = e => { const a = e.target.closest('a[data-rm]'); if (!a) return; e.preventDefault(); ro.cfCols = cols.filter(k => k !== a.dataset.rm); delete ro.cf[a.dataset.rm]; host.dataset.sig = ''; roSave(); roRefreshCf(); };
}
function roRefreshCf() { if (ro.tab === 'daily') roGrid(); else if (ro.tab === 'weekly') roWeek(); else if (ro.tab === 'staff') roStaffRender(); roKpis(); }

function roSearchOpts() { const o = new Set(), lim = {}; roActive().forEach(s => { [s.name, s.id, s.role, roAreaOf(ro.date, s.id), s.defShift, s.offDay].forEach(v => v && o.add(String(v))); Object.entries(s.sp || {}).forEach(([k, v]) => { v = String(v || '').trim(); if (v && v.length <= 40) (lim[k] = lim[k] || new Set()).add(v); }); }); Object.values(lim).forEach(st => { if (st.size <= 60) st.forEach(v => o.add(v)); }); roWSt().forEach(v => o.add(v)); return [...o].sort((a, b) => a.localeCompare(b)); }
function roSearchCombo(host, key) {
  const opts = roSearchOpts(), sig = opts.length + '|' + ro[key].join(','); if (host.dataset.sig === sig) return; host.dataset.sig = sig; host.innerHTML = '';
  host.appendChild(buildMultiCombo(ro[key], opts, arr => { ro[key] = arr; host.dataset.sig = opts.length + '|' + arr.join(','); key === 'q' ? roGrid() : key === 'qS' ? roStaffRender() : roWeek(); }, { placeholder: 'Search any field incl. SharePoint columns… (multi)' }));
}

/* ---------- reading the attendance sheet ---------- */
function roCellTime(v) {
  if (v == null || v === '') return null; if (typeof v === 'number') return Math.round((v % 1) * 1440) % 1440;
  if (v instanceof Date) return v.getHours() * 60 + Math.round(v.getMinutes() + v.getSeconds() / 60); const m = String(v).match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null;
}
function roCellDate(v) {
  if (typeof v === 'number') { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5); return roIsoLocal(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  if (v instanceof Date) return roIsoLocal(v); const d = new Date(String(v || '')); return isNaN(d) ? '' : roIsoLocal(d);
}
function roParse(rows) {
  const nz = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); let hi = -1, lc = -1;
  for (let i = 0; i < Math.min(rows.length, 15) && hi < 0; i++) (rows[i] || []).forEach((c, j) => { if (hi < 0 && nz(c) === 'filenr') { hi = i; lc = j; } });
  if (hi < 0) throw new Error('Layout not recognised — expected a "File Nr" row with the staff across the top.');
  const R1 = rows[hi] || [], R2 = rows[hi + 1] || [], R3 = rows[hi + 2] || [], staff = [];
  for (let j = lc + 1; j < R1.length; j++) { const id = String(R1[j] == null ? '' : R1[j]).trim(); if (!id) continue; staff.push({ col: j, id, name: String(R2[j] || '').trim(), role: String(R3[j] || '').trim() }); }
  const slots = [], marks = []; let date = '', prevTo = null;
  for (let i = hi + 3; i < rows.length; i++) {
    const r = rows[i] || [], to = roCellTime(r[lc - 1]); if (to == null) { if (!r.some(x => x != null && x !== '')) continue; else break; }
    let from = i === hi + 3 ? roCellTime(r[lc - 2]) : prevTo; if (from == null) from = prevTo == null ? 0 : prevTo; const shift = String(r[lc - 3] || '').trim() || (slots.length ? slots[slots.length - 1].shift : 'Day Shift');
    if (!date && r[0] != null && r[0] !== '') date = roCellDate(r[0]); prevTo = to; const s = { shift, from: roT(from), to: roT(to) }; slots.push(s);
    staff.forEach(p => { const v = r[p.col]; if (v != null && v !== '' && v !== 0 && String(v).trim() !== '0') marks.push([p.id, roK(s)]); });
  }
  if (!slots.length) throw new Error('No time slots found under the staff header.'); return { staff, slots, marks, date };
}
async function roImport(file) {
  const st = PLQ('#roImpStatus'), msg = (t, c) => { st.className = 'status-msg ' + (c || 'info'); st.textContent = t; };
  try {
    msg('Reading ' + file.name + '…'); const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]], P = roParse(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }));
    let added = 0; P.staff.forEach(p => { const o = ro.staff.find(x => x.id === p.id); if (o) { if (p.name) o.name = p.name; if (p.role) o.role = p.role; } else { ro.staff.push({ id: p.id, name: p.name, role: p.role, active: true }); added++; } });
    ro.slots = P.slots; const date = P.date || ro.date || roIsoLocal(new Date());
    if (P.marks.length) { ro.days[date] = {}; P.marks.forEach(([id, k]) => { ro.days[date][id] = ro.days[date][id] || []; ro.days[date][id].push(k); }); }
    ro.date = date; ro.week = roMonday(date); roSave(); roRender(); msg(`✓ ${P.staff.length} staff (${added} new) · ${P.slots.length} time slots · ${P.marks.length} availability mark(s) for ${date}.`, 'success'); addActivity('upload', `Staff roster import: ${P.staff.length} staff`);
  } catch (e) { msg('✘ ' + e.message, 'error'); }
}

/* ---------- rendering ---------- */
function roKpis() {
  const el = PLQ('#roKpis'); if (!el) return; const A = roActive(), P = A.map(s => roPerson(ro.date, s.id)), K = (l, v, s) => `<div class="pl-kpi"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`;
  el.innerHTML = K('Active staff', roNum(A.length), `${new Set(A.map(s => s.role)).size} job roles`) + K('Working ' + (ro.date || ''), roNum(P.filter(p => p.n).length), `${roNum(P.filter(p => p.pill === 'Off').length)} off · ${roNum(P.filter(p => p.pill === 'Leave').length)} leave`) +
    roShiftNames().map(n => { const t = roShort(n); return K(plEsc(t) + ' shift', roNum(P.filter(p => p.pill === t).length), 'full ' + plEsc(t.toLowerCase()) + '-shift cover'); }).join('') + K('Hours planned', roNum(P.reduce((a, p) => a + p.hours, 0), 1), 'selected day') + K('Time slots', roNum(ro.slots.length), `${roNum(ro.slots.reduce((a, s) => a + roDur(s), 0), 1)} h in the cycle`);
}
const RO_CORE = [['c:id', 'File Nr'], ['c:name', 'Staff name'], ['c:role', 'Job role'], ['c:area', 'Working area'], ['c:defShift', 'Default shift'], ['c:offDay', 'Weekly off'], ['c:brk', 'Break'], ['c:active', 'Active']];
function roColDefs() { return RO_CORE.map(([k, l]) => ({ k, l, core: true })).concat(ro.spCols.map(c => ({ k: 's:' + c.k, l: c.label, sp: c.k, mapped: c.mapped }))); }
function roHiddenSet() { return new Set(ro.hidden || ro.spCols.filter(c => c.mapped).map(c => 's:' + c.k)); }
function roColVal(s, d) { if (d.core) { const f = d.k.slice(2); return f === 'id' ? s.id : f === 'active' ? (s.active !== false ? 'Yes' : 'No') : f === 'brk' ? roBrkText(s) : f === 'area' ? (s.area || '') : (s[f] || ''); } return (s.sp || {})[d.sp] == null ? '' : String((s.sp || {})[d.sp]); }
function roStaffRows() { const cfk = Object.keys(ro.cf || {}).filter(k => (ro.cf[k] || []).length), cdefs = cfk.length ? roColDefs() : [], terms = (ro.qS || []).map(t => String(t).toLowerCase().trim()).filter(Boolean); return ro.staff.map((s, i) => ({ s, i })).filter(({ s }) => roCfOk(s, cfk, cdefs) && (!terms.length || (h => terms.some(t => h.includes(t)))(roHay(s, ro.date)))); }
function roStaffTable() {
  const hid = roHiddenSet(), defs = roColDefs().filter(d => !hid.has(d.k)), rows = roStaffRows();
  return { title: 'Staff list', sheet: 'Staff', note: `${rows.length} staff`, headers: defs.map(d => d.l), rows: rows.map(({ s }) => defs.map(d => roColVal(s, d))), defs, list: rows };
}
function roShiftUi() {
  const q = PLQ, names = roShiftNames(), fill = (sel, first) => { const el = q(sel); if (!el) return; const cur = el.value; el.innerHTML = (first || '') + names.map(n => `<option value="${plEsc(n)}">${plEsc(n)}</option>`).join(''); if ([...el.options].some(o => o.value === cur)) el.value = cur; };
  fill('#roSlotNewShift'); 
  const L = q('#roShiftList'); if (L) L.innerHTML = names.map(n => { const S = ro.slots.filter(s => roShort(s.shift).toLowerCase() === roShort(n).toLowerCase()), h = S.reduce((a, s) => a + roDur(s), 0), span = S.length ? `${S[0].from} → ${S[S.length - 1].to}` : 'no slots yet';
    return `<span class="ro-shchip"><strong>${plEsc(n)}</strong> <span class="text-sm" style="color:var(--gray-600)">${S.length} slot(s) · ${roNum(h, 1)} h · ${plEsc(span)}</span> <button type="button" class="ghost small" data-shdel="${plEsc(n)}" title="Remove this shift and its slots">✖</button></span>`; }).join('');
}
function roStaffRender() {
  roCfRender(PLQ('#roCfHostS')); roSearchCombo(PLQ('#roSearchHostS'), 'qS'); const t = roStaffTable(), hid = roHiddenSet(), all = roColDefs();
  PLQ('#roStaffHead').innerHTML = '<tr><th>#</th>' + t.defs.map(d => `<th>${plEsc(d.l)}</th>`).join('') + '<th></th></tr>';
  PLQ('#roStaffBody').innerHTML = t.list.map(({ s, i }, n) => `<tr data-i="${i}" class="${s.active === false ? 'ro-inact' : ''}" title="Double-click for the full staff card"><td>${n + 1}</td>${t.defs.map(d => `<td>${plEsc(roColVal(s, d))}</td>`).join('')}<td><button class="ghost small" data-del="${i}" type="button">✖</button></td></tr>`).join('') || `<tr><td colspan="${t.defs.length + 2}" style="padding:14px;text-align:center;color:var(--gray-400);font-style:italic;">${ro.staff.length ? 'No staff match the search.' : 'No staff yet — import the attendance sheet, add people above, or retrieve them from SharePoint (tab 5).'}</td></tr>`;
  PLQ('#roSCount').textContent = `${t.list.length} of ${ro.staff.length} staff · ${t.defs.length} of ${all.length} columns shown`;
  PLQ('#roColsList').innerHTML = all.map(d => `<label class="ro-colchk"><input type="checkbox" data-col="${plEsc(d.k)}" ${hid.has(d.k) ? '' : 'checked'}> ${plEsc(d.l)}${d.mapped ? ' <span class="text-sm" style="color:var(--gray-500)">(= ' + plEsc(d.mapped) + ')</span>' : ''}</label>`).join('');
  roLists();
  roShiftUi();
  roSmartRoles(); { const h = PLQ('#roBrkDHost'); if (h && !h.contains(document.activeElement)) { roBrkDraftD.length = 0; roBrkNorm(ro.brk).forEach(b => roBrkDraftD.push({ from: b.from, to: b.to })); if (roBrkEd.d) roBrkEd.d.render(); { const hb = PLQ('#roBrkBHost'); if (hb && roBrkEd.b && !hb.contains(document.activeElement)) roBrkEd.b.render(); } const ln = PLQ('#roBrkDLen'); if (ln) ln.textContent = roBrkTotal(roBrkDraftD) ? `= ${roBrkTotal(roBrkDraftD)} min in total` : ''; } const own = ro.staff.filter(s => roBrkNorm(s.brk).length).length; const sm = PLQ('#roBrkSum'); if (sm) sm.textContent = (roBrkNorm(ro.brk).length ? `— default ${roBrkNorm(ro.brk).map(b => b.from + '–' + b.to).join(', ')}` : '— no default break') + (own ? ` · ${own} with their own` : ''); }
  PLQ('#roSlotBody').innerHTML = ro.slots.map((s, i) => `<tr><td><select data-sf="shift" data-si="${i}">${roShiftNames().map(n => `<option ${roShort(n).toLowerCase() === roShort(s.shift).toLowerCase() ? 'selected' : ''}>${plEsc(n)}</option>`).join('')}</select></td><td><input type="time" data-sf="from" data-si="${i}" value="${s.from}"></td><td><input type="time" data-sf="to" data-si="${i}" value="${s.to}"></td><td><button class="ghost small" data-sdel="${i}" type="button">✖</button></td></tr>`).join('');
}
function roLists() { PLQ('#roRoleList').innerHTML = [...new Set(ro.staff.map(s => s.role).filter(Boolean))].map(r => `<option value="${plEsc(r)}">`).join(''); PLQ('#roAreaList').innerHTML = [...new Set(ro.staff.map(s => s.area).filter(Boolean).concat(Object.values(ro.area).flatMap(d => Object.values(d))))].sort().map(r => `<option value="${plEsc(r)}">`).join(''); }
function roRoleCombo(host, key) {
  const roles = [...new Set(ro.staff.map(s => s.role).filter(Boolean))].sort(), sig = roles.join(',') + '|' + ro[key].join(','); if (host.dataset.sig === sig) return; ro[key] = ro[key].filter(r => roles.includes(r)); host.dataset.sig = roles.join(',') + '|' + ro[key].join(','); host.innerHTML = '';
  host.appendChild(buildMultiCombo(ro[key], roles, arr => { ro[key] = arr; host.dataset.sig = roles.join(',') + '|' + arr.join(','); key === 'roles' ? roGrid() : roWeek(); }, { placeholder: 'All roles — type to search' }));
}
function roShiftCombo(host) {   // multi-select of the shifts shown in the daily sheet
  const names = [...new Set(ro.slots.map(s => s.shift).filter(Boolean))], sig = names.join(',') + '|' + ro.shiftSel.join(','); if (host.dataset.sig === sig) return; ro.shiftSel = ro.shiftSel.filter(x => names.includes(x)); host.dataset.sig = names.join(',') + '|' + ro.shiftSel.join(','); host.innerHTML = '';
  host.appendChild(buildMultiCombo(ro.shiftSel, names, arr => { ro.shiftSel = arr; host.dataset.sig = names.join(',') + '|' + arr.join(','); roGrid(); }, { placeholder: 'All slots — pick one or more' }));
}
function roSlotCombo(host) {   // multi-select of the time-slot rows shown in the daily sheet
  const names = []; ro.slots.forEach(s => { const l = roSlotLbl(s); if (!names.includes(l)) names.push(l); }); const sig = names.join(',') + '|' + ro.slotSel.join(','); if (host.dataset.sig === sig) return; ro.slotSel = ro.slotSel.filter(x => names.includes(x)); host.dataset.sig = names.join(',') + '|' + ro.slotSel.join(','); host.innerHTML = '';
  host.appendChild(buildMultiCombo(ro.slotSel, names, arr => { ro.slotSel = arr; host.dataset.sig = names.join(',') + '|' + arr.join(','); roGrid(); }, { placeholder: 'All time slots — pick one or more' }));
}
function roGrid() {
  roShiftCombo(PLQ('#roShiftHost')); roSlotCombo(PLQ('#roSlotHost')); roRoleCombo(PLQ('#roRoleHost'), 'roles'); roSearchCombo(PLQ('#roSearchHost'), 'q'); roCfRender(PLQ('#roCfHost')); const S = roDaily(), rows = ro.slots.map((s, i) => ({ s, i })).filter(x => roRowOn(x.s)), host = PLQ('#roGrid');
  if (!S.length) { host.innerHTML = '<div class="text-sm" style="padding:14px;color:var(--gray-500)">No staff to show — import the attendance sheet in tab 1.</div>'; return; }
  const sh = x => roShort(x), BK = {}; S.forEach(p => { BK[p.id] = roBrk(p.id); });
  host.innerHTML = `<div class="text-sm" style="color:var(--gray-600);margin:0 0 4px;">${S.length} staff shown${ro.shiftSel.length ? ' · working the ' + plEsc(ro.shiftSel.join(' + ')) : ''}${ro.slotSel.length ? ' · slots ' + plEsc(ro.slotSel.join(', ')) : ''}${Object.keys(ro.cf).length ? ' · column filters on' : ''}</div><div class="ro-grid"><table><thead><tr><th class="ro-l">Time slot</th><th class="ro-sh">Shift</th>${S.map(p => `<th data-who="${plEsc(p.id)}" title="${plEsc(p.name + ' · ' + p.id + ' · ' + p.role)}"><div class="ro-sn">${plEsc(p.name)}</div><div class="ro-role">${plEsc(p.id)}</div><div class="ro-role">${plEsc(p.role)}</div><div class="ro-role ro-area" title="Working area">${plEsc(roAreaOf(ro.date, p.id))}</div></th>`).join('')}<th class="ro-t">Staff</th></tr></thead><tbody>${rows.map(({ s }) => {
    const k = roK(s), n = S.filter(p => roSlotsOf(ro.date, p.id).includes(k) && !roBrkFull(BK[p.id], s)).length;
    return `<tr class="${/^night/i.test(s.shift) ? 'night' : ''}"><td class="ro-l" data-slot="${k}">${s.from} – ${s.to}</td><td class="ro-sh">${sh(s.shift)}</td>${S.map(p => { const on = roSlotsOf(ro.date, p.id).includes(k), full = on && roBrkFull(BK[p.id], s), part = on && !full && roBrkOverlap(BK[p.id], s) > 0; const bb = part ? roBrkBand(BK[p.id], s) : null; return `<td class="ro-c ${on ? 'on' : ''}${full ? ' brk' : part ? ' brkp' : ''}" data-who="${plEsc(p.id)}" data-k="${k}"${bb ? ` style="${bb.style}"` : ''}${full ? ` title="Break ${BK[p.id].text}"` : part ? ` title="${bb ? bb.mins + ' min of this slot are break time' : 'Part of the slot is break time'} (${BK[p.id].text})"` : ''}>${full ? '☕' : bb ? `<span class="ro-bm">${bb.mins}′</span>` : on ? '✔' : ''}</td>`; }).join('')}<td class="ro-t">${n || ''}</td></tr>`;
  }).join('')}<tr><td class="ro-l ro-t">Hours</td><td class="ro-sh ro-t"></td>${S.map(p => `<td class="ro-t" ${roPerson(ro.date, p.id).brkMin ? `title="${roNum(roPerson(ro.date, p.id).hours, 1)} h on site − ${roPerson(ro.date, p.id).brkMin} min break"` : ''}>${roNum(roPerson(ro.date, p.id).net, 1)}</td>`).join('')}<td class="ro-t"></td></tr></tbody></table></div>`;
  roKpis();
}
function roWeek() {
  roRoleCombo(PLQ('#roRoleHostW'), 'rolesW'); roCfRender(PLQ('#roCfHostW')); roSearchCombo(PLQ('#roSearchHostW'), 'qW'); const S = roFilter(ro.rolesW, ro.qW, ro.week), days = Array.from({ length: 7 }, (_, i) => roAdd(ro.week, i)), host = PLQ('#roWeekGrid');
  if (!S.length) { host.innerHTML = '<div class="text-sm" style="padding:14px;color:var(--gray-500)">No staff to show.</div>'; return; }
  const head = `<tr><th>File Nr</th><th>Staff</th><th>Role</th><th>Working area</th>${days.map(d => `<th>${roDow(d)}<br><span style="font-weight:400">${d.slice(5)}</span></th>`).join('')}<th class="n">Days</th><th class="n">Hours</th></tr>`;
  const body = S.map(p => { let wd = 0, hr = 0; const cells = days.map(d => { const x = roPerson(d, p.id); if (x.n) wd++; hr += x.hours; const opts = roWSt().concat(x.pill === 'Custom' ? ['Custom'] : []); return `<td><select data-wd="${d}" data-who="${plEsc(p.id)}">${opts.map(o => `<option value="${o}" ${o === x.pill ? 'selected' : ''} ${o === 'Custom' ? 'disabled' : ''}>${o === 'Custom' ? 'Custom ' + x.from + '–' + x.to : o}</option>`).join('')}</select></td>`; }).join('');
    return `<tr><td>${plEsc(p.id)}</td><td class="ro-pn" data-pm="${plEsc(p.id)}" title="Edit shift / working area" style="cursor:pointer;color:var(--brand)">${plEsc(p.name)}</td><td>${plEsc(p.role)}</td><td>${plEsc([...new Set(days.map(d => roAreaOf(d, p.id)).filter(Boolean))].join(' / '))}</td>${cells}<td class="n">${wd}</td><td class="n">${roNum(hr, 1)}</td></tr>`; }).join('');
  const cnt = k => days.map(d => `<td class="n">${S.filter(p => roPerson(d, p.id).pill === k).length}</td>`).join(''), hrs = days.map(d => `<td class="n">${roNum(S.reduce((a, p) => a + roPerson(d, p.id).hours, 0), 1)}</td>`).join('');
  host.innerHTML = `<div class="fd-wrap ro-wk" style="max-height:70vh"><table class="fd-tbl" id="roWeekTable"><thead>${head}</thead><tbody>${body}${roShiftNames().map(n => `<tr class="fd-tot"><td colspan="4">${plEsc(roShort(n))} shift</td>${cnt(roShort(n))}<td></td><td></td></tr>`).join('')}<tr class="fd-tot"><td colspan="4">Off</td>${cnt('Off')}<td></td><td></td></tr><tr class="fd-tot"><td colspan="4">Leave</td>${cnt('Leave')}<td></td><td></td></tr><tr class="fd-tot"><td colspan="4">Hours</td>${hrs}<td></td><td></td></tr></tbody></table></div>`;
}
function roRender() {
  const q = PLQ; if (!ro.date) ro.date = roIsoLocal(new Date()); if (!ro.week) ro.week = roMonday(ro.date);
  q('#roTabs').innerHTML = RO_TABS.map(t => `<button type="button" data-t="${t[0]}" class="${ro.tab === t[0] ? 'on' : ''}">${t[1]}${t[0] === 'sync' && roQPend().length ? ' <span class="ro-qb">' + roQPend().length + '</span>' : ''}</button>`).join('');
  document.querySelectorAll('#view-roster .ro-pane').forEach(p => p.style.display = p.dataset.p === ro.tab ? '' : 'none');
  q('#roDate').value = ro.date; q('#roWeek').value = ro.week; roKpis(); roStaffRender();
  if (ro.tab === 'daily') roGrid(); else if (ro.tab === 'weekly') roWeek(); else if (ro.tab === 'push') roUpInfo(); else if (ro.tab === 'spstaff') roSpRender(); else if (ro.tab === 'sync') roQRender();
}

/* ---------- exports ---------- */
function roDayAoa(date) {
  const S = roActive(), head = [['Date', 'Shift Type', 'Timing Slot', '', 'File Nr'].concat(S.map(p => /^\d+$/.test(p.id) ? +p.id : p.id)), ['', '', '', '', 'Staff Name'].concat(S.map(p => p.name)), ['', '', 'From', 'To', 'Job Role'].concat(S.map(p => p.role))];
  return head.concat(ro.slots.map(s => [date, s.shift, s.from, s.to, ''].concat(S.map(p => roSlotsOf(date, p.id).includes(roK(s)) ? '✔' : ''))));
}
function roWeekTable() {
  const S = roFilter(ro.rolesW, ro.qW, ro.week), days = Array.from({ length: 7 }, (_, i) => roAdd(ro.week, i));
  return { title: 'Weekly staff plan ' + days[0] + ' to ' + days[6], sheet: 'Weekly plan', note: `Week ${days[0]} – ${days[6]}`, headers: ['File Nr', 'Staff name', 'Job role', 'Working area'].concat(days.map(d => roDow(d) + ' ' + d.slice(5)), ['Days', 'Hours']),
    rows: S.map(p => { let wd = 0, hr = 0; const c = days.map(d => { const x = roPerson(d, p.id); if (x.n) wd++; hr += x.hours; return x.pill; }); return [p.id, p.name, p.role, [...new Set(days.map(d => roAreaOf(d, p.id)).filter(Boolean))].join(' / ')].concat(c, [wd, Math.round(hr * 10) / 10]); }) };
}

function roDayTable() {
  const S = roDaily();
  return { title: 'Daily staff availability ' + ro.date, sheet: 'Daily', note: `${ro.date} · ${roDow(ro.date)}`, headers: ['File Nr', 'Staff name', 'Job role', 'Working area', 'Status', 'From', 'To', 'Hours', 'Break', 'Net hours', 'Time slots'],
    rows: S.map(p => { const x = roPerson(ro.date, p.id), b = roBrk(p.id); return [p.id, p.name, p.role, roAreaOf(ro.date, p.id), x.pill, x.from, x.to, Math.round(x.hours * 10) / 10, x.n && b ? b.text : '', Math.round(x.net * 10) / 10, x.S.map(s => s.from + '–' + s.to).join(', ')]; }) };
}
function roDayFull(on) {
  const p = document.querySelector('#view-roster .ro-pane[data-p="daily"]'), b = PLQ('#roDExpand'); if (!p) return;
  if (on === undefined) on = !p.classList.contains('ro-full');
  p.classList.toggle('ro-full', on); document.body.classList.toggle('ro-fullon', on); b.textContent = on ? '⤡ Close' : '⤢ Expand'; roGrid();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('#view-roster .ro-pane.ro-full') && !document.querySelector('.ro-ov')) roDayFull(false); });
function roExpand(t) {
  const tb = document.createElement('table'); tb.id = 'roExpTable'; tb.dataset.title = t.title;
  tb.innerHTML = '<thead><tr>' + t.headers.map(x => '<th>' + escapeHtml(String(x)) + '</th>').join('') + '</tr></thead><tbody>' + t.rows.map(r => '<tr>' + r.map(v => '<td>' + escapeHtml(v == null ? '' : String(v)) + '</td>').join('') + '</tr>').join('') + '</tbody>';
  if (window.tableExpandOpen) window.tableExpandOpen(tb);
}
function roPrintGrid() {
  const S = roDaily(), rows = ro.slots.filter(roRowOn), e = escapeHtml, tick = '✔';
  if (!S.length) { sectionToast('No staff to print.', 'warn'); return; }
  const rno = npDocNo('RS'), who = e((typeof currentUser !== 'undefined' && currentUser && (currentUser.displayName || currentUser.username)) || '');
  const head = S.map(p => `<th><div class="v">${e(p.name)}</div><div class="s">${e(p.id)}</div><div class="s">${e(p.role)}</div>${roAreaOf(ro.date, p.id) ? `<div class="s">${e(roAreaOf(ro.date, p.id))}</div>` : ''}</th>`).join('');
  const body = rows.map(s => { const k = roK(s), n = S.filter(p => roSlotsOf(ro.date, p.id).includes(k) && !roBrkFull(roBrk(p.id), s)).length; return `<tr class="${/^night/i.test(s.shift) ? 'nt' : 'dy'}"><td class="l">${s.from} – ${s.to}</td><td class="sh">${e(roShort(s.shift))}</td>${S.map(p => { const on = roSlotsOf(ro.date, p.id).includes(k), full = on && roBrkFull(roBrk(p.id), s); return `<td class="${full ? 'brk' : on ? 'on' : ''}">${full ? '☕' : on ? tick : ''}</td>`; }).join('')}<td class="t">${n || ''}</td></tr>`; }).join('');
  const rdoc = (`<!doctype html><html><head><meta charset="utf-8"><title>Daily team attendance ${ro.date}</title><style>
  @page{size:A3 landscape;margin:8mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:9px;color:#1f2a44;margin:0}
  .hd{display:flex;justify-content:space-between;align-items:flex-end;background:linear-gradient(90deg,#14305a,#2a5ca8);color:#fff;border-radius:8px;padding:10px 16px;margin-bottom:8px}
  h1{font-size:18px;margin:0;letter-spacing:.08em;font-weight:700}.sub{color:#cfe0ff;margin-top:3px;font-size:10px}.chips{display:flex;gap:8px}.chip{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:4px 12px;text-align:center}.chip b{display:block;font-size:15px}.chip span{font-size:8px;color:#cfe0ff;text-transform:uppercase;letter-spacing:.06em}
  table{border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;border:1px solid #b8c4dc;border-radius:6px;overflow:hidden}th,td{border-right:1px solid #dbe3f2;border-bottom:1px solid #dbe3f2;padding:0;text-align:center;height:16px}
  th{font-size:9px;background:#e8eef9;color:#14305a;vertical-align:bottom}thead th{border-bottom:2px solid #2a5ca8}
  .v{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;margin:3px auto;font-weight:700;font-size:9px;max-height:120px;overflow:hidden}.s{font-size:6.5px;font-weight:400;color:#51607f;overflow:hidden;white-space:nowrap}
  td.l{font-size:8.5px;text-align:left;padding:0 5px;white-space:nowrap;overflow:hidden;font-weight:600;color:#14305a}td.sh{font-size:7.5px;font-weight:600}
  tr.dy td.l,tr.dy td.sh{background:#fff6dc;color:#7a5600}tr.nt td.l,tr.nt td.sh{background:#e4eaff;color:#27428a}
  tbody tr:nth-child(even) td:not(.l):not(.sh):not(.on):not(.t){background:#f7f9fd}
  td.on{background:#d3f0df;color:#127a40;font-weight:700;font-size:10px}td.brk{background:#fde7c8;color:#9a5b00;font-size:9px}td.t,th.t{background:#eef2fa;font-weight:700;color:#14305a}
  tr.sum td{background:#14305a;color:#fff;font-weight:700}
  .sig{display:flex;gap:40px;margin-top:16px}.sig div{flex:1;border-top:1px solid #14305a;padding-top:3px;font-size:9px;color:#51607f}
  </style></head><body><div class="hd"><div><h1>DAILY TEAM SITE ATTENDANCE</h1><div class="sub">${e(roDow(ro.date))} ${ro.date}${ro.shiftSel.length ? ' · ' + e(ro.shiftSel.join(' + ')) : ''}${ro.slotSel.length ? ' · ' + e(ro.slotSel.join(', ')) : ''}${ro.roles.length ? ' · ' + e(ro.roles.join(', ')) : ''} · Printed by ${who}</div></div><div class="chips"><div style="background:#fff;border-radius:6px;padding:3px 8px;width:150px;color:#14305a;text-align:center"><div style="height:24px">${npBar(rno, '24px')}</div><b style="font-size:8px;display:block">${rno}</b></div><div class="chip"><b>${S.length}</b><span>Staff</span></div><div class="chip"><b>${S.filter(p => roSlotsOf(ro.date, p.id).length).length}</b><span>Working</span></div><div class="chip"><b>${roNum(S.reduce((a, p) => a + roPerson(ro.date, p.id).net, 0), 1)}</b><span>Hours (net of break)</span></div></div></div>
  <table><colgroup><col style="width:96px"><col style="width:38px">${S.map(() => '<col>').join('')}<col style="width:32px"></colgroup><thead><tr><th>Time slot</th><th>Shift</th>${head}<th class="t">Staff</th></tr></thead><tbody>${body}</tbody></table>
  <div class="sig"><div>Prepared by</div><div>Checked by</div><div>Approved by</div></div></body></html>`); npOpenPrint(rdoc, 'Daily team attendance ' + ro.date); addActivity('export', 'Printed staff roster ' + ro.date);
}
/* ---------- push to SharePoint ---------- */
const RO_FIELDS = [
  { key: 'date', label: 'Date', alias: ['date', 'plandate', 'workdate', 'day'] }, { key: 'dow', label: 'Weekday', alias: ['weekday', 'dayname', 'dow'] },
  { key: 'fileNr', label: 'File Nr', alias: ['filenr', 'fileno', 'filenumber', 'empno', 'employeeno', 'staffid', 'id'] }, { key: 'name', label: 'Staff name', alias: ['staffname', 'employeename', 'name', 'staff'] }, { key: 'role', label: 'Job role', alias: ['jobrole', 'role', 'position', 'designation'] },
  { key: 'area', label: 'Working area', alias: ['workingarea', 'area', 'zone', 'location', 'workarea'] },
  { key: 'shift', label: 'Shift type', alias: ['shifttype', 'shift'] }, { key: 'status', label: 'Status (Day / Night / Off / Leave)', alias: ['status', 'plan', 'attendance', 'availability'] },
  { key: 'from', label: 'From (time)', alias: ['from', 'fromtime', 'start', 'starttime', 'timefrom'] }, { key: 'to', label: 'To (time)', alias: ['to', 'totime', 'end', 'endtime', 'timeto'] }, { key: 'slot', label: 'Time slot (from – to)', alias: ['timingslot', 'timeslot', 'slot'] },
  { key: 'hours', label: 'Hours', alias: ['hours', 'hrs', 'duration'] }, { key: 'slots', label: 'Slots count', alias: ['slotcount', 'slots'] }, { key: 'at', label: 'Uploaded at', alias: ['uploadedat', 'uploaddate', 'timestamp'] }
];
utRegister('roster-sum', { section: 'Staff Roster', label: 'Shift summary (one item per person per day)', fields: RO_FIELDS, note: 'Used when the Staff Roster → SharePoint tab uploads “Shift summary”.' });
utRegister('roster-slot', { section: 'Staff Roster', label: 'Time slots (one item per person per slot)', fields: RO_FIELDS, note: 'Used when the Staff Roster → SharePoint tab uploads “Time slots”.' });
const roUpTarget = () => PLQ('#roUpGran').value === 'slot' ? 'roster-slot' : 'roster-sum';
function roUpRows() {
  const scope = PLQ('#roUpScope').value, gran = PLQ('#roUpGran').value, inc = PLQ('#roUpInc').value, at = new Date().toISOString(), days = scope === 'week' ? Array.from({ length: 7 }, (_, i) => roAdd(ro.week, i)) : [ro.date], out = [];
  roActive().forEach(p => days.forEach(d => { const x = roPerson(d, p.id); if (inc === 'work' && !x.n) return;
    const base = { date: d, dow: roDow(d), fileNr: p.id, name: p.name, role: p.role, area: roAreaOf(d, p.id), status: x.pill, at };
    if (gran === 'sum') out.push(Object.assign(base, { shift: x.shift || (x.pill === 'Leave' ? 'Leave' : 'Off'), from: x.from, to: x.to, hours: Math.round(x.hours * 10) / 10, slots: x.n }));
    else if (!x.n) { out.push(Object.assign(base, { shift: x.pill, from: '', to: '', slot: '', hours: 0, slots: 0 })); }
    else x.S.forEach(s => out.push(Object.assign({}, base, { shift: s.shift, from: s.from, to: s.to, slot: s.from + ' – ' + s.to, hours: roDur(s), slots: 1 })));
  })); return out;
}
function roUpInfo() {
  const r = roUpRows(), id = roUpTarget(), c = utGet(id), ready = utReady(id), btn = PLQ('#roUpConfirm');
  PLQ('#roUpInfo').textContent = `${r.length} list item(s) will be created for ${PLQ('#roUpScope').value === 'week' ? 'the week starting ' + ro.week : ro.date}.`;
  PLQ('#roUpDest').innerHTML = ready ? `📌 Destination set by the administrator: <strong>${plEsc(c.list)}</strong> (${Object.values(c.map).filter(v => v && v !== SKIP_VALUE).length} fields mapped)` : `⚠ No upload destination is configured for “${plEsc(UT_REG[id].label)}”. ${utIsAdmin() ? 'Set it in <strong>Settings → Upload destinations</strong>.' : 'Ask an administrator to set it in Settings → Upload destinations.'}`;
  btn.disabled = !ready;
}
function roUpInit() {
  const q = PLQ; ['#roUpScope', '#roUpGran', '#roUpInc'].forEach(s => q(s).addEventListener('change', roUpInfo)); const gs = q('#roUpGoSettings'); if (gs) gs.addEventListener('click', () => { const n = document.querySelector('.nav-item[data-view="settings"]'); if (n) n.click(); });
  q('#roUpConfirm').addEventListener('click', async () => {
    const st = q('#roUpStatus'), rows = roUpRows(), id = roUpTarget(); if (!utReady(id)) { st.textContent = '⚠ No upload destination is configured (Settings → Upload destinations).'; return; } if (!rows.length) { st.textContent = '⚠ Nothing to upload for this selection.'; return; }
    const cfg = utGet(id), total = rows.length, key = id + '|' + q('#roUpScope').value + '|' + (q('#roUpScope').value === 'week' ? ro.week : ro.date) + '|' + cfg.list, prog = q('#roUpProg');
    if (!(await spAsk(`Upload ${plF(total)} roster item(s) to "${cfg.list}"?` + (roUp.done && roUp.done[key] ? '\n\n⚠ This plan was already uploaded to this list in this session. Uploading again creates duplicate rows.' : '')))) return;
    q('#roUpConfirm').disabled = true; prog.style.display = 'block'; prog.max = total; prog.value = 0;
    try { const r = await utPush(id, rows, x => x.fileNr + '/' + x.date, (d, t) => { prog.value = d; st.textContent = `Uploading… ${d}/${t}`; }); if (r.ok) { roUp.done = roUp.done || {}; roUp.done[key] = 1; }
      st.textContent = `${r.fail ? '⚠' : '✓'} ${r.ok} uploaded to “${r.list}”, ${r.fail} failed.` + (r.errors.length ? ' ' + r.errors.join(' · ') : ''); w_logToActivity(`Staff roster ${key.split('|')[2]} → "${r.list}": ${r.ok} ok, ${r.fail} failed`); addActivity('upload', `Staff roster: ${r.ok} item(s)`);
    } catch (err) { st.textContent = '✘ ' + err.message; }
    roUpInfo();
  });
}
const roUp = { done: {} };


/* ---------- staff master data from SharePoint (list + mapping set by the admin in Upload Destinations & Sources) ---------- */
const RO_SP_FIELDS = [
  { key: 'fileNr', label: 'File Nr (key)', alias: ['filenr', 'fileno', 'filenumber', 'empno', 'employeeno', 'employeeid', 'staffid', 'id'] }, { key: 'name', label: 'Staff name', alias: ['staffname', 'employeename', 'fullname', 'name', 'title'] },
  { key: 'role', label: 'Job role', alias: ['jobrole', 'role', 'position', 'designation', 'jobtitle'] }, { key: 'area', label: 'Working area', alias: ['workingarea', 'workarea', 'area', 'zone', 'location'] },
  { key: 'defShift', label: 'Default shift (Day / Night / Off)', alias: ['defaultshift', 'shift', 'shifttype'] }, { key: 'offDay', label: 'Weekly off day', alias: ['weeklyoff', 'offday', 'dayoff', 'weekoff'] },
  { key: 'active', label: 'Active (Yes / No)', alias: ['active', 'isactive', 'status', 'employmentstatus'] },
  { key: 'mobile', label: 'Mobile / phone', alias: ['mobile', 'phone', 'contact', 'mobileno', 'phonenumber'] }, { key: 'email', label: 'Email', alias: ['email', 'emailaddress', 'mail'] },
  { key: 'department', label: 'Department', alias: ['department', 'dept', 'section'] }, { key: 'supervisor', label: 'Supervisor', alias: ['supervisor', 'manager', 'reportsto', 'lineManager'] },
  { key: 'nationality', label: 'Nationality', alias: ['nationality', 'country'] }, { key: 'joinDate', label: 'Joining date', alias: ['joiningdate', 'joindate', 'dateofjoining', 'hiredate', 'startdate'] }, { key: 'remarks', label: 'Remarks', alias: ['remarks', 'notes', 'comments', 'comment'] }
];
const RO_SPSYS = /^(@|odata|id$|contenttype|modified$|created$|author|editor|_|attachments|edit$|linktitle|docicon|itemchildcount|folderchildcount|appauthor|appeditor|compliance)/i;
const RO_DET = ['mobile', 'email', 'department', 'supervisor', 'nationality', 'joinDate', 'remarks'];
utRegister('roster-staff', { kind: 'source', section: 'Staff Roster', label: 'Staff master data ← SharePoint', fields: RO_SP_FIELDS, note: 'Used by Staff Roster → tab 5 “Staff from SharePoint”. Pick the list that holds your staff and map its columns; File Nr and Staff name are the minimum.' });
const roSp = { rows: [], loaded: false, cols: [] };
function roSpVal(v) { if (v == null) return ''; if (Array.isArray(v)) return v.map(roSpVal).filter(Boolean).join(', '); if (typeof v === 'object') return String(v.LookupValue || v.Title || v.Email || v.DisplayName || v.Label || v.displayName || ''); return String(v).trim(); }
const roSpShift = v => { const t = String(v || '').toLowerCase(); const hit = roShiftNames().map(roShort).find(n => n.length > 1 && t.includes(n.toLowerCase())); return hit ? hit : /night/.test(t) ? 'Night' : /day/.test(t) ? 'Day' : /^off|rest/.test(t) ? 'Off' : ''; };
const roSpOff = v => { const t = String(v || '').toLowerCase(), i = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].findIndex(d => t.startsWith(d) || t.includes(d)); return i < 0 ? '' : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]; };
const roSpAct = v => { const t = String(v == null ? '' : v).trim().toLowerCase(); if (!t) return true; return !/^(no|false|0|inactive|left|resigned|terminated|terminate|vacation closed|n)$/.test(t); };
const roSpDate = v => { const t = roSpVal(v); if (!t) return ''; const d = new Date(t); return isNaN(d) ? t : roIsoLocal(d); };
function roSpDest() { const c = utGet('roster-staff'), ok = utReady('roster-staff'); return { c, ok, html: ok ? `📌 Source set by the administrator: <strong>${plEsc(c.list)}</strong> (${Object.values(c.map).filter(v => v && v !== SKIP_VALUE).length} columns mapped)` : `⚠ No SharePoint list is defined for the staff data. ${utIsAdmin() ? 'Set it in <strong>Upload Destinations &amp; Sources</strong> (sidebar).' : 'Ask an administrator to define it in Upload Destinations & Sources.'}` }; }
function roSpDiff(row) {
  const o = ro.staff.find(s => s.id === row.fileNr); if (!o) return 'New'; const od = o.det || {};
  const ch = o.name !== row.name || (o.role || '') !== row.role || (o.area || '') !== row.area || (o.defShift || '') !== row.defShift || (o.offDay || '') !== row.offDay || (o.active !== false) !== row.active || RO_DET.some(k => (od[k] || '') !== (row[k] || '')) || JSON.stringify(o.sp || {}) !== JSON.stringify(row.sp || {}); return ch ? 'Changed' : 'Same';
}
function roSpRender() {
  const q = PLQ, d = roSpDest(); q('#roSpDest').innerHTML = d.html; q('#roSpLoad').disabled = !d.ok;
  q('#roSpLast').textContent = ro.sync ? `Last retrieved ${new Date(ro.sync.at).toLocaleString()} from “${ro.sync.list}” — ${ro.sync.n} staff (${ro.sync.added} added, ${ro.sync.updated} updated).` : 'Nothing retrieved yet.';
  const f = (q('#roSpFilter').value || '').toLowerCase().trim(), rows = roSp.rows.filter(r => !f || Object.values(r).join(' | ').toLowerCase().includes(f)), cnt = k => roSp.rows.filter(r => r.st === k).length;
  q('#roSpInfo').textContent = roSp.loaded ? `${roSp.rows.length} staff retrieved · ${cnt('New')} new · ${cnt('Changed')} changed · ${cnt('Same')} unchanged` : '';
  q('#roSpApply').disabled = !roSp.rows.length;
  q('#roSpBody').innerHTML = rows.map(r => `<tr><td>${plEsc(r.fileNr)}</td><td>${plEsc(r.name)}</td><td>${plEsc(r.role)}</td><td>${plEsc(r.area)}</td><td>${plEsc(r.defShift)}</td><td>${plEsc(r.offDay)}</td><td>${r.active ? 'Yes' : 'No'}</td><td>${plEsc([r.mobile, r.email, r.department, r.supervisor, r.nationality, r.joinDate, r.remarks].filter(Boolean).join(' · '))}</td><td><span class="ro-pill ${r.st === 'New' ? 'Custom' : r.st === 'Changed' ? 'Day' : 'Off'}">${r.st}</span></td></tr>`).join('') || '<tr><td colspan="9" style="padding:14px;text-align:center;color:var(--gray-400);font-style:italic;">' + (roSp.loaded ? 'No staff match.' : 'Click “Retrieve from SharePoint”.') + '</td></tr>';
}
async function roSpLoad() {
  const st = PLQ('#roSpStatus'), id = 'roster-staff', cfg = utGet(id); if (!utReady(id)) { st.textContent = '⚠ No SharePoint list is defined (Upload Destinations & Sources).'; return; }
  const m = cfg.map, g = (f, k) => (m[k] && m[k] !== SKIP_VALUE) ? f[m[k]] : undefined; if (!m.fileNr || m.fileNr === SKIP_VALUE || !m.name || m.name === SKIP_VALUE) { st.textContent = '⚠ The administrator must map at least File Nr and Staff name.'; return; }
  const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) { st.textContent = '⚠ Sign in / configure the Site URL first.'; return; }
  try { st.textContent = 'Reading the list…'; PLQ('#roSpLoad').disabled = true; const a = await resolveIds(site, cfg.list, token), spc = await fetchColumns(a.siteId, a.listId, token).catch(() => []), items = await fetchAllItems(a.siteId, a.listId, token, n => { st.textContent = `Reading… ${plF(n && n.length != null ? n.length : n)} rows`; }), by = new Map();
    items.forEach(it => { const f = it.fields || {}, fileNr = roSpVal(g(f, 'fileNr')), name = roSpVal(g(f, 'name')); if (!fileNr || !name) return;
      const row = { itemId: it.id, fileNr, name, role: roSpVal(g(f, 'role')), area: roSpVal(g(f, 'area')), defShift: roSpShift(roSpVal(g(f, 'defShift'))), offDay: roSpOff(roSpVal(g(f, 'offDay'))), active: roSpAct(roSpVal(g(f, 'active'))) };
      RO_DET.forEach(k => { row[k] = k === 'joinDate' ? roSpDate(g(f, k)) : roSpVal(g(f, k)); }); row.sp = {}; Object.keys(f).forEach(k => { if (RO_SPSYS.test(k)) return; const v = roSpVal(f[k]); row.sp[k] = /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v) ? roSpDate(v) : v; }); by.set(fileNr, row); });
    const seenK = new Set(); items.forEach(it => Object.keys(it.fields || {}).forEach(k => { if (!RO_SPSYS.test(k)) seenK.add(k); })); const lab = new Map(spc.map(c => [c.name, c.displayName || c.name])), inv = {}; Object.entries(m).forEach(([k, v]) => { if (v && v !== SKIP_VALUE && ['fileNr', 'name', 'role', 'area', 'defShift', 'offDay', 'active'].includes(k)) inv[v] = k; });
    const order = spc.map(c => c.name).filter(n => seenK.has(n)).concat([...seenK].filter(n => !spc.some(c => c.name === n))); roSp.cols = order.map(n => ({ k: n, label: lab.get(n) || n, mapped: inv[n] || '' }));
    roSp.rows = [...by.values()].map(r => Object.assign(r, { st: roSpDiff(r) })); roSp.loaded = true; roSp.list = cfg.list; st.textContent = `✓ ${roSp.rows.length} staff read from “${cfg.list}” (${items.length - roSp.rows.length} row(s) skipped: no File Nr / name, or duplicate).`; w_logToActivity(`Staff roster: retrieved ${roSp.rows.length} staff from "${cfg.list}"`);
  } catch (err) { st.textContent = '✘ ' + err.message; } finally { PLQ('#roSpLoad').disabled = !roSpDest().ok; roSpRender(); }
}
function roSpApply() {
  const mode = PLQ('#roSpMode').value, deact = PLQ('#roSpDeact').checked, st = PLQ('#roSpStatus'); if (!roSp.rows.length) return; let add = 0, upd = 0, off = 0;
  if (mode === 'replace' && !confirm(`Replace the whole staff list with the ${roSp.rows.length} people from SharePoint?\n\nStaff who are not in the list are removed from the roster (their planned days are kept in storage but no longer shown).`)) return;
  const seen = new Set(), mk = r => { const det = {}; RO_DET.forEach(k => { if (r[k]) det[k] = r[k]; }); return { name: r.name, role: r.role, area: r.area, defShift: r.defShift, offDay: r.offDay, active: r.active, det, sp: r.sp || {}, spId: r.itemId }; };
  if (mode === 'replace') { ro.staff = roSp.rows.map(r => Object.assign({ id: r.fileNr }, mk(r))); add = ro.staff.length; }
  else roSp.rows.forEach(r => { seen.add(r.fileNr); const o = ro.staff.find(s => s.id === r.fileNr); if (!o) { ro.staff.push(Object.assign({ id: r.fileNr }, mk(r))); add++; } else if (mode === 'merge' && r.st === 'Changed') { Object.assign(o, mk(r)); upd++; } else if (mode === 'merge') { o.sp = r.sp || {}; o.spId = r.itemId; } });
  if (mode === 'merge' && deact) ro.staff.forEach(s => { if (!seen.has(s.id) && s.active !== false) { s.active = false; off++; } });
  if (roSp.cols.length) { ro.spCols = roSp.cols; ro.hidden = null; } roQAfterRetrieve(); ro.sync = { at: Date.now(), list: roSp.list || '', n: roSp.rows.length, added: add, updated: upd }; roSave(); roSp.rows.forEach(r => { r.st = roSpDiff(r); }); roRender();
  st.textContent = `✓ Applied: ${add} added, ${upd} updated` + (off ? `, ${off} marked inactive` : '') + '.'; sectionToast('Staff list updated from SharePoint.', 'success'); addActivity('edit', `Staff roster: ${add} added, ${upd} updated from SharePoint`);
}

