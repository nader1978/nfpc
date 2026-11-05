/* ---------- SharePoint stock + item list ---------- */
const MDP_SF = [{ key: 'code', label: 'Item code', req: 1, al: ['itemcode', 'itemno', 'sku', 'icode', 'code', 'item'] }, { key: 'qty', label: 'Balance quantity', req: 1, al: ['balance', 'qtybalance', 'qty', 'quantity', 'onhand', 'stock'] }, { key: 'status', label: 'Status (Actual received / In transit)', al: ['stockstatus', 'status', 'state', 'receiptstatus'] },
  { key: 'q2', label: 'In-transit quantity column (only if separate)', al: ['intransitqty', 'qtyintransit', 'intransit', 'transitqty'] }, { key: 'desc', label: 'Description (optional)', al: ['itemdescription', 'itemdesc', 'description', 'itemname', 'name'] }, { key: 'uom', label: 'UoM (optional)', al: ['uom', 'unit'] }];
const MDP_IF = [{ key: 'code', label: 'Item code', req: 1, al: ['itemcode', 'itemno', 'sku', 'icode', 'code', 'item'] }, { key: 'desc', label: 'Item description', req: 1, al: ['itemdescription', 'itemdesc', 'description', 'itemname', 'name'] }, { key: 'uom', label: 'UoM (optional)', al: ['uom', 'unit'] }];
function mdpAuto(fields, cols) { const used = new Set(), map = {}; fields.forEach(f => { let hit = null; for (const pass of [0, 1]) { for (const al of f.al) { hit = cols.find(c => !used.has(c.name) && (pass === 0 ? (mdpNz(c.name) === al || mdpNz(c.displayName) === al) : (al.length >= 4 && (mdpNz(c.name).includes(al) || mdpNz(c.displayName).includes(al))))); if (hit) break; } if (hit) break; } if (hit) used.add(hit.name); map[f.key] = hit ? hit.name : SKIP_VALUE; }); return map; }
function mdpMapRender(which) {
  const fields = which === 'stock' ? MDP_SF : MDP_IF, host = PLQ(which === 'stock' ? '#mdpMapStock' : '#mdpMapItem'), cols = mdp.cols[which], map = mdp.cfg[which === 'stock' ? 'smap' : 'imap']; host.innerHTML = '';
  if (!cols.length) { host.innerHTML = '<tr><td colspan="2" style="padding:14px;text-align:center;color:var(--gray-400);font-style:italic;">Pick the list and click 🔄 Load Columns.</td></tr>'; return; }
  fields.forEach(f => { const tr = document.createElement('tr'); tr.innerHTML = `<td><strong>${plEsc(f.label)}</strong>${f.req ? ' <span style="color:#c0392b">*</span>' : ''}</td><td class="combo-cell"></td>`; tr.querySelector('.combo-cell').appendChild(buildCombo(map[f.key] || SKIP_VALUE, cols, nv => { map[f.key] = nv; mdpSave(); })); host.appendChild(tr); });
}
const mdpStClass = v => { const s = String(v || ''); return /transit|on the way|shipped|intrans/i.test(s) ? 't' : /actual|receiv|rcv|available|on ?hand|stock/i.test(s) ? 'a' : 'i'; };
function mdpAggregate() {
  if (!mdp.raw) return; const m = new Map(), sm = mdp.cfg.smap, hasSt = sm.status && sm.status !== SKIP_VALUE; let ign = 0;
  mdp.raw.forEach(r => { const o = m.get(r.code) || { a: 0, t: 0, desc: '', uom: '' }; if (r.desc && !o.desc) o.desc = r.desc; if (r.uom && !o.uom) o.uom = r.uom;
    const cls = hasSt ? (mdp.cfg.stMap[r.st] || mdpStClass(r.st)) : 'a'; if (cls === 'a') o.a += r.qty; else if (cls === 't') o.t += r.qty; else ign += r.qty; o.t += r.q2 || 0; m.set(r.code, o); }); mdp.stock = m; mdp.ign = ign;
}
function mdpStatusRender() {
  const wrap = PLQ('#mdpStatusMapWrap'), sm = mdp.cfg.smap; if (!mdp.raw || !(sm.status && sm.status !== SKIP_VALUE)) { wrap.style.display = 'none'; return; }
  const c = new Map(); mdp.raw.forEach(r => c.set(r.st, (c.get(r.st) || 0) + 1)); wrap.style.display = '';
  PLQ('#mdpStatusBody').innerHTML = [...c.entries()].map(([v, n]) => { const cl = mdp.cfg.stMap[v] || mdpStClass(v); return `<tr><td>${plEsc(v || '(blank)')}</td><td class="n">${mdpN(n)}</td><td><select data-st="${plEsc(v)}"><option value="a" ${cl === 'a' ? 'selected' : ''}>Actual received</option><option value="t" ${cl === 't' ? 'selected' : ''}>In transit</option><option value="i" ${cl === 'i' ? 'selected' : ''}>Ignore</option></select></td></tr>`; }).join('');
}
async function mdpLoadSharePoint() {
  const q = s => PLQ(s), st = q('#mdpLoadStatus'), say = (t, c) => { st.className = 'text-sm'; st.textContent = t; st.style.color = c === 'e' ? '#c0392b' : ''; }, cfg = mdp.cfg, token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl();
  const sl = mdp.pick.stock.getValue(), il = mdp.pick.item.getValue(); cfg.stockList = sl; cfg.itemList = il;
  if (!token || !siteUrl) { say('⚠ Configure the global Site URL and sign-in first.', 'e'); return; } if (!sl) { say('⚠ Pick the stock balance list.', 'e'); return; }
  if (!cfg.smap.code || cfg.smap.code === SKIP_VALUE || !cfg.smap.qty || cfg.smap.qty === SKIP_VALUE) { say('⚠ Map the item code and balance quantity columns of the stock list.', 'e'); return; }
  const prog = q('#mdpProg'); prog.style.display = 'block'; prog.removeAttribute('value'); q('#mdpLoadBtn').disabled = true;
  try {
    if (!isListVisible(sl)) throw new Error(`No permission to access "${sl}"`);
    say('Reading the stock list…'); const a = await resolveIds(siteUrl, sl, token), items = await fetchAllItems(a.siteId, a.listId, token, n => say(`${mdpN(n)} stock rows…`)), s = cfg.smap, g = k => s[k] && s[k] !== SKIP_VALUE ? s[k] : null;
    mdp.cfg.stockAt = Date.now(); mdp.raw = []; let bad = 0; items.forEach(it => { const f = it.fields || {}, code = mdpCode(f[g('code')]); if (!code) { bad++; return; } mdp.raw.push({ code, qty: mdpNum(f[g('qty')]), st: g('status') ? String(f[g('status')] == null ? '' : (typeof f[g('status')] === 'object' ? (f[g('status')].Value || '') : f[g('status')])).trim() : '', q2: g('q2') ? mdpNum(f[g('q2')]) : 0, desc: g('desc') ? String(f[g('desc')] || '').trim() : '', uom: g('uom') ? String(f[g('uom')] || '').trim() : '' }); });
    mdp.items = null; let nIt = 0;
    if (il) { if (!isListVisible(il)) throw new Error(`No permission to access "${il}"`); const i = cfg.imap; if (!i.code || i.code === SKIP_VALUE || !i.desc || i.desc === SKIP_VALUE) throw new Error('Map the item code and description columns of the item list.');
      say('Reading the item list…'); const b = await resolveIds(siteUrl, il, token), its = await fetchAllItems(b.siteId, b.listId, token, n => say(`${mdpN(n)} item rows…`)); mdp.items = new Map(); its.forEach(it => { const f = it.fields || {}, code = mdpCode(f[i.code]); if (code) mdp.items.set(code, { desc: String(f[i.desc] || '').trim(), uom: i.uom && i.uom !== SKIP_VALUE ? String(f[i.uom] || '').trim() : '' }); }); nIt = mdp.items.size; }
    mdp.loadedAt = Date.now(); mdpAggregate(); mdpSave(); mdpStatusRender(); const tot = [...mdp.stock.values()].reduce((x, o) => ({ a: x.a + o.a, t: x.t + o.t }), { a: 0, t: 0 });
    say(`✅ ${mdpN(mdp.raw.length)} stock rows → ${mdpN(mdp.stock.size)} items · actual ${mdpN(tot.a)} · in transit ${mdpN(tot.t)}${nIt ? ` · ${mdpN(nIt)} item descriptions` : ''}${bad ? ` · ${bad} rows without item code skipped` : ''}${mdp.ign ? ` · ${mdpN(mdp.ign)} ignored by status` : ''}`); addActivity('download', `Milco stock loaded from "${sl}"`); mdpRender();
  } catch (e) { say('✘ ' + e.message, 'e'); } finally { prog.style.display = 'none'; q('#mdpLoadBtn').disabled = false; }
}
/* ---------- wiring ---------- */
let mdpInited = false;
function mdpInit() {
  if (mdpInited) return; mdpInited = true; mdpLoad(); const q = s => PLQ(s);
  const hook = (dz, inp, kind) => { dz.addEventListener('click', () => inp.click()); dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } }); ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); })); ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', e => mdpImport([...e.dataTransfer.files], kind)); inp.addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) mdpImport(fs, kind); }); };
  hook(q('#mdpDropD'), q('#mdpFileD'), 'demand'); hook(q('#mdpDropG'), q('#mdpFileG'), 'gr');
  q('#mdpTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; mdp.tab = b.dataset.t; mdpRender(); });
  q('#mdpPickTabsHost').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (!b) return; mdp.ptab = b.dataset.p; mdpPick(); });
  { const g = q('#mdpRtGrid'), cur = () => { const all = mdp.res.routes.map(x => `${x.route} · ${x.src}`); return mdp.rtNone ? [] : mdp.routes.length ? mdp.routes.slice() : all; };
    g.addEventListener('change', e => { const c = e.target; if (c.dataset.rsel != null) { const a = cur(), k = a.indexOf(c.dataset.rsel); if (c.checked && k < 0) a.push(c.dataset.rsel); else if (!c.checked && k >= 0) a.splice(k, 1); mdpRtSet(a); } else if (c.dataset.rhead) mdpRtSet(c.checked ? mdp.res.routes.map(x => `${x.route} · ${x.src}`) : []); });
    g.addEventListener('click', e => { const t = e.target; if (t.closest('[data-hrt]')) { mdp.cfg.hideRt = !mdp.cfg.hideRt; mdpSave(); mdpRtGrid(); return; } if (t.closest('[data-rall]')) return mdpRtSet(mdp.res.routes.map(x => `${x.route} · ${x.src}`)); if (t.closest('[data-rnone]')) return mdpRtSet([]); const it = t.closest('[data-ritems]'), pk = t.closest('[data-rpick]'); if (it) mdpRtOpen(it.dataset.ritems); else if (pk) mdpRtPrint(pk.dataset.rpick);
      else if (t.closest('tr[data-rk]') && !t.closest('input,button,a')) mdpRtOpen(t.closest('tr[data-rk]').dataset.rk); }); }
  { const pb = q('#mdpPickBody'), redo = nx => { mdpCompute(); mdpKpis(); mdpPick(true); try { mdpOpRender(); } catch (x) {} mdpRtRender(); if (nx != null) { const l = pb.querySelectorAll('input.mdp-pq'); if (l[nx]) { l[nx].focus(); l[nx].select(); } } };
    pb.addEventListener('keydown', e => { const t = e.target; if (!t.matches || !t.matches('input.mdp-pq')) return; if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { mdp._go = true; setTimeout(() => { mdp._go = false; }, 80); if (e.key === 'Enter') { e.preventDefault(); t.blur(); } } });
    pb.addEventListener('change', e => { const i = e.target; if (i.id === 'mdpShowZ') { mdp.showZero = i.checked; mdpPick(true); return; } if (!i.classList || !i.classList.contains('mdp-pq')) return; const idx = [...pb.querySelectorAll('input.mdp-pq')].indexOf(i), v = i.value.trim(); mdp.cfg.pickOv = mdp.cfg.pickOv || {};
      if (v === '') delete mdp.cfg.pickOv[i.dataset.k]; else mdp.cfg.pickOv[i.dataset.k] = Math.max(0, Math.round(Number(v) || 0)); mdpSave(); const go = mdp._go; mdp._go = false; redo(go ? idx + 1 : null); });
    pb.addEventListener('click', e => { const rt = e.target.closest('.mdp-rt'); if (e.target.closest('[data-hlist]')) { mdp.cfg.hideLists = !mdp.cfg.hideLists; mdpSave(); mdpPick(true); return; } if (e.target.closest('[data-hnote]')) { mdp.cfg.hideNote = !mdp.cfg.hideNote; mdpSave(); mdpPick(true); return; } if (e.target.closest('[data-rcolall]')) { const on = e.target.closest('[data-rcolall]').dataset.rcolall === '0'; mdp.cfg.colRt = {}; if (on) mdp.res.routes.forEach(x => { mdp.cfg.colRt[x.route + '|' + x.src] = 1; }); mdpSave(); mdpPick(true); return; } const op = e.target.closest('[data-ropen]'); if (op) { mdpRtOpen(op.dataset.ropen); return; } if (rt) { mdp.cfg.colRt = mdp.cfg.colRt || {}; if (mdp.cfg.colRt[rt.dataset.rt]) delete mdp.cfg.colRt[rt.dataset.rt]; else mdp.cfg.colRt[rt.dataset.rt] = 1; mdpSave(); mdpPick(true); return; } const b = e.target.closest('.mdp-pr'), a = e.target.closest('[data-pall]'); if (b) { delete (mdp.cfg.pickOv || {})[b.dataset.k]; mdpSave(); redo(); } else if (a) { if (!confirm('Remove all your picking-qty adjustments?')) return; mdp.cfg.pickOv = {}; mdpSave(); redo(); } }); }
  q('#mdpImpBody').addEventListener('change', e => { const i = e.target; if (i.dataset.use) mdp.cfg.use[i.dataset.use] = i.checked; else if (i.dataset.basis) mdp.cfg.basis[i.dataset.basis] = i.value; else return; mdpSave(); mdpRender(); });
  q('#mdpImpBody').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; const id = b.dataset.del; if (!confirm('Remove this imported file from the plan?')) return; delete mdp.data.demand[id]; delete mdp.data.gr[id]; mdpSave(); mdpRender(); });
  q('#mdpDemView').addEventListener('change', mdpDemand); let tm; ['#mdpSearch', '#mdpSearchD'].forEach(id => q(id).addEventListener('input', e => { mdp.q = e.target.value; q('#mdpSearch').value = q('#mdpSearchD').value = mdp.q; clearTimeout(tm); tm = setTimeout(() => { mdpRefreshBody(); }, 200); }));
  const mailAny = () => { const t = mdpTable(); if (!t || !t.rows.length) { sectionToast('Nothing to email for this selection.', 'warn'); return; } window.extMailData = mdpTable; wMail_open('ext'); };
  const xlAny = () => { const t = mdpTable(); if (!t || !t.rows.length) { sectionToast('Nothing to export for this selection.', 'warn'); return; } const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([t.headers, ...t.rows]), t.sheet); XLSX.writeFile(wb, `${t.title.replace(/\W+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`); addActivity('export', t.title); };
  const prAny = () => { const t = mdpTable(); if (!t || !t.rows.length) { sectionToast('Nothing to print for this selection.', 'warn'); return; } w_printTable(t.title, t.note, t.headers, t.rows); };
  q('#mdpEmailD').addEventListener('click', mailAny); q('#mdpExcelD').addEventListener('click', xlAny); q('#mdpPrintD').addEventListener('click', prAny); q('#mdpEmail').addEventListener('click', mailAny); window.extMailData = mdpTable;
  q('#mdpPolicy').value = mdp.cfg.policy; q('#mdpUseGR').checked = mdp.cfg.useGR !== false; q('#mdpPolicy').addEventListener('change', e => { mdp.cfg.policy = e.target.value; mdpSave(); mdpRender(); }); q('#mdpUseGR').addEventListener('change', e => { mdp.cfg.useGR = e.target.checked; mdpSave(); mdpRender(); });
  q('#mdpPrint').addEventListener('click', () => { const h0 = mdpDoc(); if (!h0) { sectionToast('Nothing to print for this selection.', 'warn'); return; } const no = npDocNo('PL'); mdp.docNo = no; fdPrintHtml(h0.replace(/<section class="pg">/g, `<section class="pg" data-no="${no}">`), 'Milco picking list'); addActivity('export', 'Printed Milco picking list ' + no); sectionToast(`Picking list ${no} opened in a new tab — the number is uploaded with the rows (tab 5; map “Document_No” in Upload Destinations).`, 'success'); });
  q('#mdpExcel').addEventListener('click', () => { XLSX.writeFile(mdpWorkbook(), `Milco_Picking_${new Date().toISOString().slice(0, 10)}.xlsx`); addActivity('export', 'Milco picking Excel'); });
  mdp.pick.stock = createListPicker(document.querySelector('[data-list-picker="mdp-stock"]'), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: () => { mdp.cols.stock = []; mdpMapRender('stock'); } });
  mdp.pick.item = createListPicker(document.querySelector('[data-list-picker="mdp-item"]'), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: () => { mdp.cols.item = []; mdpMapRender('item'); } });
  try { if (mdp.cfg.stockList && mdp.pick.stock.setValue) mdp.pick.stock.setValue(mdp.cfg.stockList); if (mdp.cfg.itemList && mdp.pick.item.setValue) mdp.pick.item.setValue(mdp.cfg.itemList); } catch (e) {}
  q('#mdpColsBtn').addEventListener('click', async () => {
    const st = q('#mdpColsStatus'), token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) { st.textContent = '⚠ Configure the global Site URL and sign-in first.'; return; }
    try { st.textContent = 'Loading…'; for (const [w, p] of [['stock', mdp.pick.stock], ['item', mdp.pick.item]]) { const nm = p.getValue(); if (!nm) { mdp.cols[w] = []; continue; } const { siteId, listId } = await resolveIds(siteUrl, nm, token); mdp.cols[w] = (await fetchColumns(siteId, listId, token)).filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase())); }
      st.textContent = `✓ ${mdp.cols.stock.length} stock columns · ${mdp.cols.item.length} item columns`; if (!Object.keys(mdp.cfg.smap).length) mdp.cfg.smap = mdpAuto(MDP_SF, mdp.cols.stock); if (!Object.keys(mdp.cfg.imap).length) mdp.cfg.imap = mdpAuto(MDP_IF, mdp.cols.item); mdpMapRender('stock'); mdpMapRender('item'); mdpSave(); } catch (e) { st.textContent = '✘ ' + e.message; }
  });
  q('#mdpAutoBtn').addEventListener('click', () => { if (!mdp.cols.stock.length && !mdp.cols.item.length) { q('#mdpColsStatus').textContent = '⚠ Load columns first.'; return; } if (mdp.cols.stock.length) mdp.cfg.smap = mdpAuto(MDP_SF, mdp.cols.stock); if (mdp.cols.item.length) mdp.cfg.imap = mdpAuto(MDP_IF, mdp.cols.item); mdpMapRender('stock'); mdpMapRender('item'); mdpSave(); });
  q('#mdpLoadBtn').addEventListener('click', mdpLoadSharePoint); mdpUpInit();
  q('#mdpStatusBody').addEventListener('change', e => { const s = e.target.closest('select[data-st]'); if (!s) return; mdp.cfg.stMap[s.dataset.st] = s.value; mdpAggregate(); mdpSave(); mdpRender(); });
  mdpMapRender('stock'); mdpMapRender('item'); mdpOpInit(); mdpSrcApply();
}
/* ---------- 5 · Upload to SharePoint — item wise; the list and the column mapping are set by the administrator (Upload Destinations & Sources) ---------- */
const MDP_UF = [
  { key: 'code', label: 'Item code', alias: ['itemcode', 'itemno', 'sku', 'icode', 'code', 'item', 'title'] },
  { key: 'desc', label: 'Description', alias: ['itemdescription', 'itemdesc', 'description', 'itemname', 'name'] },
  { key: 'uom', label: 'UoM', alias: ['uom', 'unit'] },
  { key: 'type', label: 'Stock type (Actual / In transit)', alias: ['stocktype', 'stockstatus', 'status', 'pickingtype', 'picktype', 'type'], m: 'sep' },
  { key: 'qty', label: 'Pick quantity (of that stock type)', alias: ['pickquantity', 'pickqty', 'quantity', 'qty'], m: 'sep' },
  { key: 'actual', label: 'Pick — actual stock', alias: ['pickactual', 'actualpick', 'actualqty', 'actual'], m: 'one' },
  { key: 'transit', label: 'Pick — in transit', alias: ['pickintransit', 'intransitpick', 'intransitqty', 'intransit', 'transit'], m: 'one' },
  { key: 'total', label: 'Total pick', alias: ['totalpick', 'totalqty', 'total'], m: 'one' },
  { key: 'req', label: 'Required quantity', alias: ['requiredqty', 'required', 'demand', 'requiredquantity'] },
  { key: 'short', label: 'Short', alias: ['shortqty', 'short', 'shortage'] },
  { key: 'route', label: 'Route (per-route level)', alias: ['routecode', 'route', 'routes'] },
  { key: 'src', label: 'Source file type (per-route level)', alias: ['source', 'sourcetype'] },
  { key: 'plan', label: 'Plan date', alias: ['plandate', 'pickdate', 'date'] },
  { key: 'docno', doc: true, label: 'Document_No (printed picking list no.)', alias: ['Document_No', 'Document No', 'DocNo', 'Picking List No', 'PL No', 'Print No'] },
  { key: 'ref', label: 'Upload reference', alias: ['uploadreference', 'reference', 'ref', 'batchno', 'batch'] }];
const mdpUp = { busy: false, keep: false };
function mdpUpCfg() { const c = mdp.cfg; if (!c.up) c.up = { what: 'sep', level: 'item', pos: true, date: '', lab: { a: 'Actual', t: 'In transit' }, log: [] }; if (!c.up.lab) c.up.lab = { a: 'Actual', t: 'In transit' }; if (!c.up.log) c.up.log = []; return c.up; }
const mdpUpWhatTxt = { actual: 'Actual stock only', transit: 'In transit only', sep: 'Actual and In transit as separate rows', one: 'Actual and In transit side by side in one row' };
const mdpUpId = () => mdpUpCfg().what === 'one' ? 'mdp-one' : 'mdp-rows';
function mdpUpRows() {
  const u = mdpUpCfg(), r = mdp.res, D = mdpPickData(), q = D.q, today = new Date().toISOString().slice(0, 10), plan = u.date || today, ref = 'MDP-' + plan.replace(/-/g, '') + '-' + new Date().toTimeString().slice(0, 5).replace(':', '');
  let base = [];
  if (u.level === 'route') D.groups.forEach(({ x, ls }) => ls.forEach(l => base.push({ code: l.code, desc: l.desc, uom: l.uom, req: l.req, actual: l.pa, transit: u.bal !== false ? Math.max(0, l.req - l.pa) : l.pt, short: l.short, route: x.route, src: x.src })));
  else [...r.items.values()].filter(i => mdpMatch(i, q) && i.req > 0 && (!D.rs || r.lines.some(l => l.code === i.code && D.rs.has(l.route + '|' + l.src)))).sort((a, b) => a.code.localeCompare(b.code)).forEach(i => {
    const ls = r.lines.filter(l => l.code === i.code && (!D.rs || D.rs.has(l.route + '|' + l.src))), v = ls.reduce((a, l) => ({ req: a.req + l.req, pa: a.pa + l.pa, pt: a.pt + l.pt, bal: a.bal + Math.max(0, l.req - l.pa), short: a.short + l.short }), { req: 0, pa: 0, pt: 0, bal: 0, short: 0 });
    base.push({ code: i.code, desc: i.desc, uom: i.uom, req: v.req, actual: v.pa, transit: u.bal !== false ? v.bal : v.pt, short: v.short, route: '', src: '' }); });
  const out = [], mk = (b, extra) => Object.assign({ code: b.code, desc: b.desc, uom: b.uom, req: b.req, short: b.short, route: b.route, src: b.src, plan, ref, docno: mdp.docNo || '' }, extra);
  base.forEach(b => {
    if (u.what === 'actual') { if (!u.pos || b.actual > 0) out.push(mk(b, { type: u.lab.a, qty: b.actual, actual: b.actual, total: b.actual })); }
    else if (u.what === 'transit') { if (!u.pos || b.transit > 0) out.push(mk(b, { type: u.lab.t, qty: b.transit, transit: b.transit, total: b.transit })); }
    else if (u.what === 'sep') { if (!u.pos || b.actual > 0) out.push(mk(b, { type: u.lab.a, qty: b.actual, actual: b.actual, total: b.actual })); if (!u.pos || b.transit > 0) out.push(mk(b, { type: u.lab.t, qty: b.transit, transit: b.transit, total: b.transit })); }
    else if (!u.pos || b.actual > 0 || b.transit > 0) out.push(mk(b, { actual: b.actual, transit: b.transit, total: b.actual + b.transit }));
  });
  return out;
}
const mdpUpActive = f => { const w = mdpUpCfg().what; return !f.m || (w === 'one' ? f.m === 'one' : f.m === 'sep'); };
function mdpUpCheck() {
  const id = mdpUpId(), c = utGet(id), M = c.map, ok = k => M[k] && M[k] !== SKIP_VALUE;
  if (!utReady(id)) return `No destination is set for “${UT_REG[id].label}”. ${utIsAdmin() ? 'Set it in Upload Destinations & Sources.' : 'Ask an administrator to set it in Upload Destinations & Sources.'}`;
  if (!ok('code')) return 'The administrator has not mapped the Item code field.';
  if (id === 'mdp-one') { if (!ok('actual') && !ok('transit') && !ok('total')) return 'The destination maps none of Pick — actual, Pick — in transit, Total pick.'; }
  else { if (!ok('qty')) return 'The destination does not map the Pick quantity field.'; if (mdpUpCfg().what === 'sep' && !ok('type')) return 'To keep Actual and In transit apart on separate rows the destination must map the Stock type field.'; }
  return '';
}
function mdpUpTable() { const rows = mdpUpRows(), M = utGet(mdpUpId()).map, mapped = k => M[k] && M[k] !== SKIP_VALUE, all = MDP_UF.filter(mdpUpActive), fs = all.some(f => mapped(f.key)) ? all.filter(f => mapped(f.key)) : all; return { title: 'Milco picking — upload preview (item wise)', sheet: 'Upload', headers: fs.map(f => f.label), rows: rows.map(r => fs.map(f => r[f.key] == null ? '' : r[f.key])), note: `${rows.length} row(s) · ${mdpUpWhatTxt[mdpUpCfg().what]} · ${mdpUpCfg().level === 'route' ? 'item per route' : 'item totals'}${mdpPickData().rs ? ' · selected routes only' : ' · all routes'}` }; }
function mdpUpRender() {
  const u = mdpUpCfg(), q = s => PLQ(s); q('#mdpUpWhat').value = u.what; q('#mdpUpLevel').value = u.level; q('#mdpUpPos').checked = !!u.pos; if (!u.date) u.date = new Date().toISOString().slice(0, 10); q('#mdpUpDate').value = u.date; q('#mdpUpLabA').value = u.lab.a; q('#mdpUpLabT').value = u.lab.t;
  q('#mdpUpLabWrap').style.display = u.what === 'one' ? 'none' : '';
  const id = mdpUpId(), c = utGet(id), ready = utReady(id); q('#mdpUpDest').innerHTML = ready ? `📌 Destination set by the administrator: <strong>${plEsc(c.list)}</strong> (${Object.values(c.map).filter(v => v && v !== SKIP_VALUE).length} fields mapped) · <span style="color:var(--gray-600)">${plEsc(UT_REG[id].label)}</span>` : `⚠ No destination is set for “${plEsc(UT_REG[id].label)}”. ${utIsAdmin() ? 'Set it in <strong>Upload Destinations &amp; Sources</strong>.' : 'Ask an administrator to set it in Upload Destinations &amp; Sources.'}`;
  mdpUpPrev(); try { mdpLgRender(); } catch (e) { console.error(e); } const lg = u.log[0]; q('#mdpUpLast').innerHTML = lg ? `Last upload: <strong>${plEsc(lg.at)}</strong> · ${plF(lg.n)} row(s) · ${plEsc(mdpUpWhatTxt[lg.what] || lg.what)} → “${plEsc(lg.list)}”` : '';
}
function mdpUpPrev() {
  const t = mdpUpTable(), q = s => PLQ(s), c = mdpUpCheck(); q('#mdpUpInfo').textContent = `— ${plF(t.rows.length)} row(s) will be uploaded`; const m = q('#mdpUpMsg'); if (c) { m.textContent = '⚠ ' + c; m.style.color = '#b45309'; } else if (!mdpUp.keep) { m.textContent = ''; m.style.color = ''; }
  q('#mdpUpBtn').disabled = !!c || !t.rows.length || mdpUp.busy;
  const tb = q('#mdpUpPrev'); tb.dataset.title = t.title; tb.innerHTML = '<thead><tr>' + t.headers.map(h => `<th>${plEsc(h)}</th>`).join('') + '</tr></thead><tbody>' + t.rows.slice(0, 200).map(r => '<tr>' + r.map(v => `<td class="${typeof v === 'number' ? 'n' : ''}">${plEsc(typeof v === 'number' ? plF(v, 0) : v)}</td>`).join('') + '</tr>').join('') + '</tbody>';
  q('#mdpUpMore').textContent = t.rows.length > 200 ? `Showing the first 200 of ${plF(t.rows.length)} rows — Excel / Expand have all.` : '';
}
async function mdpUpload() {
  const u = mdpUpCfg(), say = t => { PLQ('#mdpUpMsg').textContent = t; PLQ('#mdpUpMsg').style.color = ''; }, prog = PLQ('#mdpUpProg'), c = mdpUpCheck(); if (c) { say('⚠ ' + c); return; }
  const id = mdpUpId(), cfg = utGet(id), rows = mdpUpRows(); cfg.map = await utEffMap(id); if (!rows.length) { say('⚠ Nothing to upload for this selection.'); return; }
  const same = u.log.find(l => l.list === cfg.list && l.what === u.what && l.date === u.date && l.level === u.level); spAsk.extra = spDocLine('Picking list', mdp.docNo, (cfg.map || {}).docno);
  if (!(await spAsk(`Upload ${plF(rows.length)} row(s) (${mdpUpWhatTxt[u.what]}) to “${cfg.list}”?` + (same ? `\n\n⚠ The same kind of upload for ${u.date} was already made on ${same.at}. Uploading again creates duplicate rows.` : '')))) return;
  mdpUp.busy = true; PLQ('#mdpUpBtn').disabled = true; prog.style.display = 'block'; prog.max = rows.length; prog.value = 0; mdpUp.keep = true;
  try {
    const r = await utPush(id, rows, x => x.code, (d, t) => { prog.value = d; say(`Uploading… ${d}/${t}`); });
    say(`${r.fail ? '⚠' : '✓'} ${plF(r.ok)} row(s) uploaded to “${r.list}”` + (r.fail ? `, ${plF(r.fail)} failed — ${r.errors.join(' · ')}` : '.')); if (r.ok) { u.log.unshift({ at: new Date().toLocaleString(), n: r.ok, what: u.what, level: u.level, date: u.date, list: r.list }); u.log = u.log.slice(0, 30); mdpSave(); if (!r.fail) { try { const tq = mdpLgRecord(u, r.list, r.ok); if (tq) say(`✓ ${plF(r.ok)} row(s) uploaded to “${r.list}” — ${plF(tq)} unit(s) deducted from the demand; the balance is shown below.`); } catch (e) { console.error(e); } } else say(`⚠ ${plF(r.ok)} uploaded, ${plF(r.fail)} failed — nothing was deducted from the demand yet. ` + r.errors.join(' · ')); }
    try { addActivity('upload', `Milco picking → "${r.list}": ${r.ok} row(s), ${mdpUpWhatTxt[u.what]}`); w_logToActivity(`Milco picking → "${r.list}": ${r.ok} ok, ${r.fail} failed`); } catch (e) {}
  } catch (e) { say('✘ ' + e.message); PLQ('#mdpUpMsg').style.color = '#c0392b'; }
  mdpUp.busy = false; prog.style.display = 'none'; const m = PLQ('#mdpUpMsg').textContent, col = PLQ('#mdpUpMsg').style.color; mdpUpRender(); PLQ('#mdpUpMsg').textContent = m; PLQ('#mdpUpMsg').style.color = col;
}
function mdpUpInit() {
  const q = s => PLQ(s), u = mdpUpCfg(); q('#mdpUpBal').checked = u.bal !== false;
  const chg = () => { mdpUp.keep = false; u.what = q('#mdpUpWhat').value; u.level = q('#mdpUpLevel').value; u.pos = q('#mdpUpPos').checked; u.bal = q('#mdpUpBal').checked; u.date = q('#mdpUpDate').value; u.lab.a = q('#mdpUpLabA').value.trim() || 'Actual'; u.lab.t = q('#mdpUpLabT').value.trim() || 'In transit'; mdpSave(); mdpUpRender(); };
  ['#mdpUpWhat', '#mdpUpLevel', '#mdpUpPos', '#mdpUpBal', '#mdpUpDate', '#mdpUpLabA', '#mdpUpLabT'].forEach(s => q(s).addEventListener('change', chg));
  q('#mdpUpBtn').addEventListener('click', mdpUpload);
  q('#mdpUpGo').addEventListener('click', () => { const n = document.querySelector('.nav-item[data-view="uploaddest"]'); if (n) n.click(); else sectionToast('Upload Destinations & Sources is available to administrators.', 'warn'); });
  q('#mdpUpExcel').addEventListener('click', () => { const t = mdpUpTable(); if (!t.rows.length) { sectionToast('Nothing to export.', 'warn'); return; } const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([t.headers, ...t.rows]), t.sheet); XLSX.writeFile(wb, 'Milco_upload_preview_' + new Date().toISOString().slice(0, 10) + '.xlsx'); });
  q('#mdpUpPrint').addEventListener('click', () => { const t = mdpUpTable(); if (!t.rows.length) { sectionToast('Nothing to print.', 'warn'); return; } w_printTable(t.title, t.note, t.headers, t.rows); });
  q('#mdpUpEmail').addEventListener('click', () => { if (!mdpUpTable().rows.length) { sectionToast('Nothing to email.', 'warn'); return; } window.extMailData = mdpUpTable; wMail_open('ext'); });
}
/* ============================================================
   Uploaded ledger — what was uploaded in “5 · Upload to SharePoint” is deducted from the demand (and from the loaded stock),
   so the plan shows the BALANCE demand and the BALANCE stock until the next round
   ============================================================ */
function mdpLg() { const c = mdp.cfg; if (!c.upl || !Array.isArray(c.upl.e)) c.upl = { on: true, stock: true, e: [] }; return c.upl; }
function mdpLgMaps() {
  const g = mdpLg(), dem = new Map(), stk = new Map(); if (g.on === false) return { dem, stk };
  g.e.forEach(e => { if (e.off) return; Object.entries(e.d || {}).forEach(([k, q]) => dem.set(k, (dem.get(k) || 0) + q)); if (g.stock !== false && e.at > (mdp.cfg.stockAt || 0)) Object.entries(e.s || {}).forEach(([c, q]) => stk.set(c, (stk.get(c) || 0) + q)); });
  return { dem, stk };
}
function mdpLgRecord(u, listName, nRows) {
  const r = mdp.res, D = mdpPickData(), q = D.q; let ls;
  if (u.level === 'route') ls = D.groups.flatMap(g => g.ls);
  else ls = r.lines.filter(l => { const i = r.items.get(l.code); return i && mdpMatch(i, q) && i.req > 0 && (!D.rs || D.rs.has(l.route + '|' + l.src)); });
  const act = ['actual', 'sep', 'one'].includes(u.what), trn = ['transit', 'sep', 'one'].includes(u.what) && u.bal === false, d = {}, s = {}; let tq = 0;
  ls.forEach(l => { const a = act ? l.pa : 0, t = trn ? l.pt : 0, v = a + t; if (!(v > 0)) return; d[l.key] = (d[l.key] || 0) + v; tq += v; if (a > 0) s[l.code] = (s[l.code] || 0) + a; });
  if (!tq) return 0; const g = mdpLg(); g.e.unshift({ id: Date.now() + '' + Math.random().toString(36).slice(2, 5), at: Date.now(), plan: u.date, what: u.what, list: listName, n: nRows, tq, d, s }); g.e = g.e.slice(0, 60); mdpSave(); return tq;
}
function mdpLgRender() {
  const host = PLQ('#mdpUpLg'); if (!host) return; const g = mdpLg(), r = mdp.res, M = mdpLgMaps(), byCode = new Map();
  M.dem.forEach((q, k) => { const c = k.split('|').pop(); byCode.set(c, (byCode.get(c) || 0) + q); });
  const active = g.e.filter(e => !e.off), upl = [...M.dem.values()].reduce((a, b) => a + b, 0);
  const tbl = [...byCode.keys()].sort().map(c => { const it = r && r.items.get(c), up = byCode.get(c), bal = it ? it.req : 0; return { c, desc: it ? it.desc : '', uom: it ? it.uom : '', orig: bal + up, up, bal, stk: it ? it.A : Math.max(0, ((mdp.stock && mdp.stock.get(c) || {}).a || 0) - (M.stk.get(c) || 0)), short: it ? it.short : 0 }; });
  host.innerHTML = '<div class="fd-sub" style="margin-top:14px">Uploaded so far → balance demand &amp; stock <span class="text-sm" style="font-weight:400">— what you upload is deducted from the demand (and the loaded stock) so the next picking list shows only the balance</span></div>'
    + '<div class="btn-row" style="margin:4px 0;gap:14px;flex-wrap:wrap"><label class="text-sm" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-lg="on" ' + (g.on !== false ? 'checked' : '') + ' style="width:auto"> Deduct uploaded quantities from the demand</label>'
    + '<label class="text-sm" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-lg="stock" ' + (g.stock !== false ? 'checked' : '') + ' style="width:auto"> Also deduct them from the loaded stock <span class="hint">(stock reloaded after the upload is not deducted twice)</span></label>'
    + (g.e.length ? '<button type="button" class="ghost small" data-lg="clear">↺ Clear the uploaded record</button>' : '') + (tbl.length ? '<button type="button" class="ghost small" data-lg="xl">⬇ Excel</button>' : '') + '</div>'
    + (g.e.length ? '<div class="fd-wrap" style="max-height:170px"><table class="fd-tbl"><thead><tr><th>Uploaded at</th><th>Plan date</th><th>What</th><th>List</th><th class="n">Rows</th><th class="n">Qty deducted</th><th></th></tr></thead><tbody>' + g.e.map((e, i) => '<tr style="' + (e.off ? 'opacity:.45;text-decoration:line-through' : '') + '"><td>' + plEsc(new Date(e.at).toLocaleString()) + '</td><td>' + plEsc(e.plan || '') + '</td><td>' + plEsc(mdpUpWhatTxt[e.what] || e.what) + '</td><td>' + plEsc(e.list || '') + '</td><td class="n">' + plF(e.n || 0) + '</td><td class="n">' + plF(e.tq || 0) + '</td><td><button type="button" class="ghost small" data-lg="undo" data-i="' + i + '">' + (e.off ? '↩ Apply again' : '✖ Undo') + '</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="text-sm" style="color:var(--gray-500)">Nothing uploaded yet — after the first upload its quantities appear here and leave the demand.</div>')
    + (tbl.length ? '<div class="text-sm" style="margin:8px 0 4px"><b>' + plF(upl) + '</b> unit(s) uploaded in ' + active.length + ' upload(s) · balance demand now <b>' + plF(r ? r.lines.reduce((a, l) => a + l.req, 0) : 0) + '</b></div><div class="fd-wrap" style="max-height:300px"><table class="fd-tbl" id="mdpLgTbl"><thead><tr><th>Item</th><th>Description</th><th>UoM</th><th class="n">Original demand</th><th class="n">Uploaded</th><th class="n">Balance demand</th><th class="n">Stock left</th><th class="n">Still short</th></tr></thead><tbody>' + tbl.slice(0, 300).map(x => '<tr><td>' + plEsc(x.c) + '</td><td>' + plEsc(x.desc) + '</td><td>' + plEsc(x.uom) + '</td><td class="n">' + plF(x.orig) + '</td><td class="n">' + plF(x.up) + '</td><td class="n"><b>' + plF(x.bal) + '</b></td><td class="n">' + plF(x.stk) + '</td><td class="n">' + (x.short ? '<b style="color:#c0392b">' + plF(x.short) + '</b>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '');
  host._tbl = tbl;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#mdpUpLg [data-lg]'); if (!b || b.tagName === 'INPUT') return; const g = mdpLg(), k = b.dataset.lg;
  if (k === 'undo') { const x = g.e[+b.dataset.i]; if (x) x.off = !x.off; }
  else if (k === 'clear') { if (!confirm('Clear the whole uploaded record? The full demand and stock come back.')) return; g.e = []; }
  else if (k === 'xl') { const t = PLQ('#mdpUpLg')._tbl || []; const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Item', 'Description', 'UoM', 'Original demand', 'Uploaded', 'Balance demand', 'Stock left', 'Still short'], ...t.map(x => [x.c, x.desc, x.uom, x.orig, x.up, x.bal, x.stk, x.short])]), 'Balance'); XLSX.writeFile(wb, 'Milco_balance_demand_' + new Date().toISOString().slice(0, 10) + '.xlsx'); return; }
  mdpSave(); mdpRender();
});
document.addEventListener('change', e => { const b = e.target.closest && e.target.closest('#mdpUpLg input[data-lg]'); if (!b) return; mdpLg()[b.dataset.lg] = b.checked; mdpSave(); mdpRender(); });
function mdpOpen() { mdpInit(); mdpRender(); }
document.querySelectorAll('.nav-item[data-view="mdp"]').forEach(n => n.addEventListener('click', () => setTimeout(mdpOpen, 0)));

/* ============================================================
   UPLOAD DESTINATIONS (admin panel) — admin picks the SharePoint list + the field mapping for each section's upload
   ============================================================ */
const UT_REG = {};
const utKey = id => LS_BASE + '_ut_' + id;
function utRegister(id, def) { UT_REG[id] = def; }
function utGet(id) { try { const v = JSON.parse(localStorage.getItem(utKey(id)) || 'null'); return v && typeof v === 'object' ? { list: v.list || '', map: v.map || {} } : { list: '', map: {} }; } catch (e) { return { list: '', map: {} }; } }
function utSet(id, v) { try { localStorage.setItem(utKey(id), JSON.stringify(v)); } catch (e) { sectionToast('Browser storage is full.', 'warn'); } }
const utReady = id => { const c = utGet(id); return !!c.list && Object.values(c.map).some(v => v && v !== SKIP_VALUE); };
const utIsAdmin = () => typeof isAdmin === 'function' ? !!isAdmin() : !!(currentUser && currentUser.role === 'admin');
const ut = { pickers: {}, cols: {}, draft: {}, ids: {} };
function utFields(id) { const d = UT_REG[id], f = (typeof d.fields === 'function' ? d.fields() : d.fields).slice(); if (!f.some(x => x.key === CURRENT_USER_FIELD_KEY)) f.push(currentUserOutputField()); if (!f.some(x => x.key === LOC_FIELD_KEY)) f.push(locOutputField()); return f; }
const utNz = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function utAuto(id) {
  const used = new Set(), map = {}, cols = ut.cols[id] || [];
  utFields(id).forEach(f => { if (f.key === CURRENT_USER_FIELD_KEY) return; const als = (Array.isArray(f.alias) ? f.alias : [f.alias, f.label]).filter(Boolean).map(utNz); let hit = null;
    for (const pass of [0, 1]) { for (const al of als) { hit = cols.find(c => !used.has(c.name) && (pass === 0 ? (utNz(c.name) === al || utNz(c.displayName) === al) : (al.length >= 4 && (utNz(c.name).includes(al) || utNz(c.displayName).includes(al))))); if (hit) break; } if (hit) break; }
    if (hit) { used.add(hit.name); map[f.key] = hit.name; } else map[f.key] = SKIP_VALUE; });
  const uh = findCurrentUserColumn(cols); map[CURRENT_USER_FIELD_KEY] = uh ? uh.name : SKIP_VALUE; return map;
}
function utMapRender(id) {
  const body = document.querySelector(`#utMap_${id}`); if (!body) return; const adm = utIsAdmin(), d = ut.draft[id], cols = ut.cols[id] || []; body.innerHTML = '';
  const known = Object.values(d.map).filter(v => v && v !== SKIP_VALUE);
  if (!cols.length && !known.length) { body.innerHTML = '<tr><td colspan="2" style="padding:12px;text-align:center;color:var(--gray-400);font-style:italic;">Pick a list and click 🔄 Load Columns to map the fields.</td></tr>'; return; }
  const colNames = cols.length ? cols : known.map(n => ({ name: n, displayName: n }));
  utFields(id).forEach(f => { const tr = document.createElement('tr'); tr.innerHTML = `<td><strong>${plEsc(f.label)}</strong></td><td class="combo-cell"></td>`; const cell = tr.querySelector('.combo-cell');
    if (adm) cell.appendChild(buildCombo(d.map[f.key] || SKIP_VALUE, colNames, nv => { d.map[f.key] = nv; utState(id); })); else cell.textContent = d.map[f.key] && d.map[f.key] !== SKIP_VALUE ? d.map[f.key] : '— not mapped —'; body.appendChild(tr); });
}
/* A data source reads list columns (any type), so keep every column, only dropping system ones */
function utState(id) { const s = document.querySelector(`#utSum_${id}`); if (!s) return; const d = ut.draft[id], n = Object.values(d.map).filter(v => v && v !== SKIP_VALUE).length; s.textContent = d.list ? `${d.list} · ${n} field(s) mapped` : 'not configured'; s.style.color = d.list && n ? 'var(--success, #0b7a0b)' : 'var(--gray-500)'; }
function utSummary() {
  const b = document.querySelector('#utSumBody'); if (!b) return;
  b.innerHTML = Object.entries(UT_REG).map(([id, d]) => { const c = utGet(id), n = Object.values(c.map).filter(v => v && v !== SKIP_VALUE).length, ok = c.list && n; return `<tr><td>${plEsc(d.section)}</td><td>${d.kind === 'source' ? '⬇ Data source' : '⬆ Upload'}</td><td>${plEsc(d.label)}</td><td>${c.list ? plEsc(c.list) : '—'}</td><td class="n">${n}</td><td>${ok ? '<span style="color:#0b7a0b;font-weight:600;">✓ Ready</span>' : '<span style="color:#b45309;font-weight:600;">⚠ Not set</span>'}</td></tr>`; }).join('');
}
function utRender() {
  const host = document.querySelector('#utHost'); if (!host) return; const adm = utIsAdmin(); host.innerHTML = ''; utSummary();
  { const bar = document.createElement('div'); bar.className = 'btn-row'; bar.style.cssText = 'margin:4px 0 8px;gap:8px'; bar.innerHTML = '<button type="button" class="ghost small" data-g="c">▸ Collapse all groups</button><button type="button" class="ghost small" data-g="e">▾ Expand all groups</button>';
    bar.addEventListener('click', e => { const b = e.target.closest('button[data-g]'); if (!b) return; const gk = LS_BASE + '_ut_grp', gs = {}; host.querySelectorAll('[data-utg]').forEach(h => { gs[h.dataset.utg] = b.dataset.g === 'c'; }); try { localStorage.setItem(gk, JSON.stringify(gs)); } catch (x) {} utRender(); }); host.appendChild(bar); }
  const secs = {}; Object.entries(UT_REG).forEach(([id, d]) => { (secs[d.section] = secs[d.section] || []).push(id); });
  Object.entries(secs).forEach(([section, ids]) => {
    const h = document.createElement('div'); h.style.cssText = 'font-weight:700;margin:12px 0 6px;color:var(--brand);'; h.textContent = section + (ids.every(i => UT_REG[i].kind === 'source') ? ' — data source (retrieve from SharePoint)' : ids.some(i => UT_REG[i].kind === 'source') ? ' — uploads and data sources' : ' — uploads'); const wrap = document.createElement('div'), gk = LS_BASE + '_ut_grp'; let gs = {}; try { gs = JSON.parse(localStorage.getItem(gk) || '{}') || {}; } catch (e) {}
    const base = h.textContent; h.style.cssText += 'cursor:pointer;user-select:none;display:flex;align-items:center;gap:8px;'; h.dataset.utg = section; h.title = 'Click to collapse / expand';
    const paint = () => { const c = !!gs[section]; wrap.style.display = c ? 'none' : ''; h.innerHTML = '<span class="ut-car" style="display:inline-block;width:16px;transition:transform .15s;' + (c ? 'transform:rotate(-90deg)' : '') + '">▾</span><span>' + plEsc(base) + '</span><span class="text-sm" style="font-weight:400;color:var(--gray-500)">' + ids.length + ' item(s)</span>'; };
    h.addEventListener('click', () => { gs[section] = !gs[section]; try { localStorage.setItem(gk, JSON.stringify(gs)); } catch (e) {} paint(); }); h._paint = paint; host.appendChild(h); host.appendChild(wrap); paint();
    ids.forEach(id => { const def = UT_REG[id];
      ut.draft[id] = JSON.parse(JSON.stringify(utGet(id))); const sec = document.createElement('details'); sec.className = 'fd-set'; sec.dataset.id = id; sec.style.cssText = 'border:1px solid var(--border);border-radius:10px;padding:8px 12px;margin-bottom:8px;'; sec.open = false;
      sec.innerHTML = `<summary><strong>${plEsc(def.label)}</strong> <span id="utSum_${id}" class="text-sm" style="margin-left:8px;"></span></summary>
      <div class="text-sm" style="color:var(--gray-600);margin:6px 0;">${plEsc(def.note || '')}</div>
      <div class="form-group"><label>${def.kind === 'source' ? 'SharePoint list to retrieve from' : 'Target SharePoint list'}</label><div class="list-picker" data-list-picker="ut-${id}"></div></div>
      ${adm ? `<div class="btn-row" style="margin:8px 0;"><button type="button" class="secondary small" data-a="load">🔄 Load Columns</button><button type="button" class="ghost small" data-a="auto">⚡ Auto-Map</button><button type="button" class="ghost small" data-a="reset">↺ Reset</button><button type="button" class="success small" data-a="save">💾 Save destination</button><button type="button" class="ghost small" data-a="clear">🗑 Remove</button><span class="text-sm" id="utSt_${id}"></span></div>` : '<div class="text-sm" style="color:var(--gray-500);margin:6px 0;">Only an administrator can change this destination.</div>'}
      <div class="table-wrap" style="max-height:320px;"><table class="map-table"><thead><tr><th style="width:40%;">${def.kind === 'source' ? (def.fieldLabel || 'Roster field') : 'Output field'}</th><th style="width:60%;">${def.kind === 'source' ? 'Read from SharePoint column' : 'Maps to SharePoint column'}</th></tr></thead><tbody id="utMap_${id}"></tbody></table></div>`;
      wrap.appendChild(sec);
      const st = t => { const e = sec.querySelector(`#utSt_${id}`); if (e) e.textContent = t; };
      ut.pickers[id] = createListPicker(sec.querySelector(`[data-list-picker="ut-${id}"]`), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: () => { const nm = ut.pickers[id] && ut.pickers[id].getValue(); if (nm !== undefined && nm !== ut.draft[id].list) { ut.draft[id].list = nm || ''; ut.cols[id] = []; utState(id); } } });
      try { if (ut.draft[id].list && ut.pickers[id].setValue) ut.pickers[id].setValue(ut.draft[id].list); } catch (e) {}
      if (!adm) sec.querySelectorAll('input,select,button').forEach(x => { x.disabled = true; });
      sec.addEventListener('click', async e => { const b = e.target.closest('button[data-a]'); if (!b || !adm) return; const a = b.dataset.a;
        if (a === 'load') { const nm = ut.pickers[id].getValue(), token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) { st('⚠ Configure the Site URL and sign-in first (Settings → Global connection).'); return; } if (!nm) { st('⚠ Pick a list first.'); return; }
          try { st('Loading…'); ut.draft[id].list = nm; const { siteId, listId } = await resolveIds(site, nm, token); const cols = await fetchColumns(siteId, listId, token); ut.cols[id] = UT_REG[id].kind === 'source' ? cols.filter(c => !/^(_|@)|contenttype|linktitle|docicon|attachments|^edit$|itemchildcount|folderchildcount/i.test(c.name)) : cols.filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase())); st(`✓ ${ut.cols[id].length} writable columns`); if (!Object.values(ut.draft[id].map).some(v => v && v !== SKIP_VALUE)) ut.draft[id].map = utAuto(id); utMapRender(id); utState(id); } catch (err) { st('✘ ' + err.message); } }
        else if (a === 'auto') { if (!(ut.cols[id] || []).length) { st('⚠ Load columns first.'); return; } ut.draft[id].map = utAuto(id); utMapRender(id); utState(id); }
        else if (a === 'reset') { ut.draft[id].map = {}; utMapRender(id); utState(id); }
        else if (a === 'save') { const nm = ut.pickers[id].getValue() || ut.draft[id].list; if (!nm) { st('⚠ Pick a list first.'); return; } ut.draft[id].list = nm; if (!Object.values(ut.draft[id].map).some(v => v && v !== SKIP_VALUE)) { st('⚠ Map at least one field.'); return; } utSet(id, ut.draft[id]); st(def.kind === 'source' ? '✓ Saved — this section now retrieves its data from “' + nm + '”.' : '✓ Saved — uploads from this section now go to “' + nm + '”.'); utSummary(); utRefreshAll(); w_logToActivity(`Upload destination set: ${def.section} / ${def.label} → "${nm}"`); addActivity('settings', `Upload destination: ${def.section} → ${nm}`); }
        else if (a === 'clear') { if (!confirm('Remove this setting? The related action will be disabled until it is set again.')) return; try { localStorage.removeItem(utKey(id)); } catch (x) {} ut.draft[id] = { list: '', map: {} }; ut.cols[id] = []; try { ut.pickers[id].setValue(''); } catch (x) {} utMapRender(id); utState(id); utSummary(); utRefreshAll(); st('Removed.'); } });
      utMapRender(id); utState(id); });
  });
}
/* The printed document number (Picking_List_No, Document_No …) fills itself: when the administrator has not mapped that field, the list's own column of that name is found automatically (looked up fresh, so a column added later is picked up). */
async function utEffMap(id) {
  const cfg = utGet(id), map = Object.assign({}, cfg.map); if (!UT_REG[id] || !cfg.list) return map;
  const F = utFields(id), need = F.filter(f => f.doc && (!map[f.key] || map[f.key] === SKIP_VALUE)); if (!need.length) return map;
  ut.docCols = ut.docCols || {}; let c = ut.docCols[cfg.list];
  if (!c || Date.now() - c.t > 3000) { try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(), ids = await resolveIds(site, cfg.list, token); c = ut.docCols[cfg.list] = { t: Date.now(), cols: (await fetchColumns(ids.siteId, ids.listId, token)).filter(x => !READ_ONLY_COLUMNS.has(x.name.toLowerCase())) }; } catch (e) { return map; } }
  need.forEach(f => { const als = [f.key, f.label, ...(Array.isArray(f.alias) ? f.alias : [f.alias])].filter(Boolean).map(utNz), hit = c.cols.find(x => als.includes(utNz(x.name)) || als.includes(utNz(x.displayName))); if (hit) map[f.key] = hit.name; });
  return map;
}
async function utPush(id, rows, keyFn, onProg) {   // rows: array of objects keyed by field key
  const cfg = utGet(id), token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!cfg.list) throw new Error('No upload destination is set for this section — an administrator sets it in Upload Destinations.'); cfg.map = await utEffMap(id);
  const active = Object.entries(cfg.map).filter(([, v]) => v && v !== SKIP_VALUE); if (!active.length) throw new Error('The upload destination has no field mapping — an administrator must map the fields in Upload Destinations.');
  if (!token || !site) throw new Error('Configure the Site URL and sign-in first.'); const { siteId, listId } = await resolveIds(site, cfg.list, token); let ok = 0, fail = 0, done = 0, next = 0; const errors = [];
  const worker = async () => { while (next < rows.length) { const r = rows[next++], fields = {}; active.forEach(([k, col]) => { if (k === CURRENT_USER_FIELD_KEY) { fields[col] = getCurrentUserValue(); return; } if (k === LOC_FIELD_KEY) { const lv = locOne(); if (lv) fields[col] = lv; return; } const v = r[k]; if (v === '' || v == null) return; fields[col] = v; });
    if (!Object.keys(fields).length) fail++; else { try { await createItem(siteId, listId, fields, token); ok++; } catch (err) { fail++; if (errors.length < 5) errors.push(`${keyFn ? keyFn(r) : ''}: ${err.message}`); } } done++; if (onProg) onProg(done, rows.length); } };
  await Promise.all(Array.from({ length: 4 }, worker)); return { ok, fail, errors, list: cfg.list };
}

/* ---------- existing upload panels: take the destination + mapping from this file ---------- */
const UT_BINDS = {
  grb: { open: '#wGRBUploadBtn', confirm: '#wGRBUpConfirmBtn', hide: [['[data-list-picker="w-grb-upload"]', '.form-group'], ['#wGRBUpLoadBtn', '.btn-row'], ['#wGRBUpMapTable', '.table-wrap']], picker: () => wGRB.picker,
    set: (cols, map, ids) => { wGRB.upCols = cols; wGRB.upMap = map; wGRB.upListId = ids.listId; wGRB.upSiteId = ids.siteId; }, render: () => wGRB_upRender() },
  fefo: { open: '#wFefoUploadBtn', confirm: '#wFefoUploadConfirmBtn', hide: [['[data-list-picker="w-fefo-upload"]', '.form-group'], ['#wFefoUploadLoadColsBtn', '.btn-row'], ['#wFefoUploadMapTable', '.mapping-wrapper']], picker: () => wFefoUploadPicker,
    set: (cols, map, ids) => { wFefoState.uploadColumns = cols; wFefoState.uploadMapping = map; wFefoState.uploadListId = ids.listId; wFefoState.uploadSiteId = ids.siteId; }, render: () => wFefo_renderUploadMapping() },
  dp: { open: '.nav-item[data-view="dailyplan-upload"]', confirm: '#dpLstConfirm', hide: [['[data-list-picker="dp-upload"]', '.form-group'], ['#dpLstLoad', '.btn-row'], ['#dpLstMapTable', '.table-wrap']], picker: () => dpLst.picker,
    set: (cols, map, ids) => { dpLst.cols = cols; dpLst.map = map; dpLst.listId = ids.listId; dpLst.siteId = ids.siteId; }, render: () => dpLstRender() },
  fd: { open: '.nav-item[data-view="fdplan-upload"]', confirm: '#fdUpConfirm', hide: [['[data-list-picker="fd-upload"]', '.form-group'], ['#fdUpLoad', '.btn-row'], ['#fdUpMapTable', '.table-wrap']], picker: () => fdUp.picker,
    set: (cols, map, ids) => { fdUp.cols = cols; fdUp.map = map; fdUp.listId = ids.listId; fdUp.siteId = ids.siteId; }, render: () => fdUpRender() }
};
utRegister('grb', { section: 'Warehouse', label: 'Good Return balance → SharePoint', fields: () => wGRB_upFields(), note: 'Used by Warehouse → Good Return → “Upload to SharePoint”.' });
utRegister('fefo', { section: 'Warehouse', label: 'FEFO results → SharePoint', fields: () => wFefo_getOutputFields(), note: 'Used by Warehouse → FEFO → “Upload to SharePoint”. Group-by columns appear here once a FEFO run has been made in this session; mapped ones are remembered.' });
utRegister('dp', { section: 'Daily Plan', label: 'Daily Plan Upload', fields: () => DP_LST_FIELDS, note: 'Used by Daily Plan → Daily Plan Upload.' });
utRegister('fd', { section: 'F&D Plan', label: 'F&D Picking Upload', fields: () => FD_FIELDS, note: 'Used by F&D Plan → F&D Picking Upload.' });
utRegister('mdp-rows', { section: 'Milco Daily Planning', label: 'Milco picking — item rows (Actual / In transit / separate rows)', fields: () => MDP_UF.filter(f => !f.m || f.m === 'sep'), note: 'Used by Milco Daily Planning → 5 · Upload to SharePoint when “Actual stock only”, “In transit only” or “Both — separate rows” is chosen. Map Stock type and Pick quantity to keep Actual and In transit apart.' });
utRegister('mdp-one', { section: 'Milco Daily Planning', label: 'Milco picking — Actual + In transit in one row', fields: () => MDP_UF.filter(f => !f.m || f.m === 'one'), note: 'Used by Milco Daily Planning → 5 · Upload to SharePoint when “Both — side by side in one row” is chosen.' });
/* ---------- 6 · Outstanding rounds — what could not be collected is kept in SharePoint and served in the next round ---------- */
const MDP_OF = [
  { key: 'key', label: 'Order key (date|route|item)', alias: ['orderkey', 'key', 'reference', 'ref'] },
  { key: 'date', label: 'Order date', alias: ['orderdate', 'plandate', 'date'] },
  { key: 'route', label: 'Route', alias: ['routecode', 'route', 'routes'] },
  { key: 'code', label: 'Item code', alias: ['itemcode', 'itemno', 'sku', 'icode', 'code', 'item', 'title'] },
  { key: 'desc', label: 'Description', alias: ['itemdescription', 'itemdesc', 'description', 'itemname', 'name'] },
  { key: 'uom', label: 'UoM', alias: ['uom', 'unit'] },
  { key: 'ordered', label: 'Ordered quantity', alias: ['orderedqty', 'ordered', 'orderqty', 'requiredqty', 'required'] },
  { key: 'picked', label: 'Collected so far', alias: ['collectedqty', 'collected', 'pickedqty', 'picked', 'pickquantity'] },
  { key: 'out', label: 'Outstanding quantity (remaining)', alias: ['outstandingqty', 'outstanding', 'remainingqty', 'remaining', 'balanceqty', 'balance'] },
  { key: 'transit', label: 'Expected in transit', alias: ['intransitqty', 'intransit', 'transit'] },
  { key: 'round', label: 'Round (collections done)', alias: ['round', 'roundno', 'collectionround'] },
  { key: 'status', label: 'Status (Open / Fulfilled / Closed - unavailable)', alias: ['orderstatus', 'status', 'state'] },
  { key: 'updated', label: 'Last updated', alias: ['lastupdated', 'updatedon', 'updated', 'modified'] },
  { key: 'note', label: 'Note', alias: ['note', 'notes', 'remarks', 'comment'] }];
const MDP_XF = [
  { key: 'date', label: 'Order date', alias: ['orderdate', 'plandate', 'date'] },
  { key: 'route', label: 'Route', alias: ['routecode', 'route', 'routes'] },
  { key: 'code', label: 'Item code', alias: ['itemcode', 'itemno', 'sku', 'icode', 'code', 'item', 'title'] },
  { key: 'desc', label: 'Description', alias: ['itemdescription', 'itemdesc', 'description', 'itemname', 'name'] },
  { key: 'uom', label: 'UoM', alias: ['uom', 'unit'] },
  { key: 'ordered', label: 'Ordered quantity', alias: ['orderedqty', 'ordered', 'orderqty', 'requiredqty', 'required'] },
  { key: 'picked', label: 'Collected before closing', alias: ['collectedqty', 'collected', 'pickedqty', 'picked'] },
  { key: 'unavail', label: 'Unavailable quantity', alias: ['unavailableqty', 'unavailable', 'unavailqty', 'qty', 'quantity', 'balance'] },
  { key: 'round', label: 'Rounds done', alias: ['round', 'roundno', 'rounds'] },
  { key: 'closed', label: 'Closed on', alias: ['closedon', 'closeddate', 'closed', 'date'] },
  { key: 'note', label: 'Note', alias: ['note', 'notes', 'remarks', 'comment'] }];
utRegister('mdp-open', { section: 'Milco Daily Planning', label: 'Milco outstanding orders — remaining balance per route + item', fields: () => MDP_OF, note: 'Used by Milco Daily Planning → 6 · Outstanding rounds. One row per order date + route + item: what was ordered, what was collected so far, what is still outstanding and its status. It is read when a new round starts and updated (not duplicated) after each round. Map at least Item code, Outstanding quantity and Status.' });
utRegister('mdp-unav', { section: 'Milco Daily Planning', label: 'Milco unavailable stock — closed outstanding balance', fields: () => MDP_XF, note: 'Used by Milco Daily Planning → 6 · Outstanding rounds → “Move selected to Unavailable stock”. Receives the quantities the user decided will not be fulfilled.' });
/* ---------- stock balance + item details: the administrator defines the SharePoint lists and the column mapping ---------- */
utRegister('src-mdp-stock', { kind: 'source', fieldLabel: 'Stock field', section: 'Milco Daily Planning', label: 'Milco stock balance ← SharePoint', fields: () => MDP_SF.map(f => ({ key: f.key, label: f.label, alias: f.al })), note: 'Used by Milco Daily Planning → 2 · Stock. Pick the list that holds the stock balance and map Item code, Balance quantity and (if you have them) Status, In-transit quantity, Description and UoM. Users then only press “Load stock & item details”.' });
utRegister('src-mdp-item', { kind: 'source', fieldLabel: 'Item field', section: 'Milco Daily Planning', label: 'Milco item details ← SharePoint (optional)', fields: () => MDP_IF.map(f => ({ key: f.key, label: f.label, alias: f.al })), note: 'Used by Milco Daily Planning → 2 · Stock. Optional list that supplies each item’s description and UoM (the DSO only carries item codes). Leave unset if the stock list already has them.' });
function mdpSrcApply() {
  if (!mdp.pick || !mdp.pick.stock) return;
  const one = (id, listKey, mapKey, pk) => { if (!utReady(id)) return false; const c = utGet(id); if (mdp.cfg[listKey] !== c.list || JSON.stringify(mdp.cfg[mapKey]) !== JSON.stringify(c.map)) { mdp.cfg[listKey] = c.list; mdp.cfg[mapKey] = Object.assign({}, c.map); try { mdp.pick[pk].setValue(c.list); } catch (e) {} } return true; };
  const s = one('src-mdp-stock', 'stockList', 'smap', 'stock'), i = one('src-mdp-item', 'itemList', 'imap', 'item');
  const hide = (el, on) => { if (el) el.style.display = on ? 'none' : ''; };
  const pane = document.querySelector('#view-mdp .mdp-pane[data-p="stock"]'); if (!pane) return;
  hide(pane.querySelector('[data-list-picker="mdp-stock"]') && pane.querySelector('[data-list-picker="mdp-stock"]').closest('.form-group'), s);
  hide(pane.querySelector('[data-list-picker="mdp-item"]') && pane.querySelector('[data-list-picker="mdp-item"]').closest('.form-group'), i);
  hide(pane.querySelector('#mdpMapStock') && pane.querySelector('#mdpMapStock').closest('.table-wrap'), s);
  hide(pane.querySelector('#mdpMapItem') && pane.querySelector('#mdpMapItem').closest('.table-wrap'), i);
  hide(pane.querySelector('#mdpColsBtn') && pane.querySelector('#mdpColsBtn').closest('.btn-row'), s && i);
  let n = pane.querySelector('#mdpSrcNote'); if (!n) { n = document.createElement('div'); n.id = 'mdpSrcNote'; n.className = 'text-sm'; n.style.cssText = 'margin:6px 0'; const b = pane.querySelector('#mdpLoadBtn'); b.closest('.btn-row').parentNode.insertBefore(n, b.closest('.btn-row')); }
  const t = id => { const c = utGet(id); return utReady(id) ? `<strong>${plEsc(c.list)}</strong>` : '<span style="color:#b45309">not set</span>'; };
  n.innerHTML = (s || i) ? `📌 Defined by the administrator — stock list: ${t('src-mdp-stock')} · item list: ${t('src-mdp-item')}` : `⚠ The stock list is not defined yet. ${utIsAdmin() ? 'Set it in <strong>Upload Destinations &amp; Sources</strong> (or pick it below).' : 'Ask an administrator to set it in Upload Destinations &amp; Sources.'}`;
}
const mdpOpMap = id => { const M = utGet(id).map; return { M, ok: k => !!(M[k] && M[k] !== SKIP_VALUE) }; };
const mdpOpKey = (d, r, c) => [d, r, c].join('|');
const mdpOpSel = v => v == null ? '' : Array.isArray(v) ? v.map(x => (x && (x.Value || x.LookupValue)) || x).join(', ') : typeof v === 'object' ? (v.Value || v.LookupValue || '') : v;
function mdpOpState() { if (!mdp.open) mdp.open = { rows: mdp.cfg.openRows || [], at: mdp.cfg.openAt || 0 }; return mdp.open; }
function mdpOpIndex() { const m = new Map(); mdpOpState().rows.forEach(r => { const p = m.get(r.key); if (!p || (r.open && !p.open)) m.set(r.key, r); }); return m; }
async function mdpOpLoad(say) {
  const id = 'mdp-open', cfg = utGet(id), { M, ok } = mdpOpMap(id);
  if (!utReady(id)) throw new Error('No destination is set for “Milco outstanding orders”. ' + (utIsAdmin() ? 'Set it in Upload Destinations & Sources.' : 'Ask an administrator to set it in Upload Destinations & Sources.'));
  if (!ok('code') || !ok('out')) throw new Error('The destination must map at least Item code and Outstanding quantity.');
  const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('Configure the global Site URL and sign-in first.');
  const ids = await resolveIds(site, cfg.list, token), items = await fetchAllItems(ids.siteId, ids.listId, token, n => say && say(`${mdpN(n)} rows…`)), v = (f, k) => ok(k) ? mdpOpSel(f[M[k]]) : '';
  const rows = []; items.forEach(it => { const f = it.fields || {}, code = mdpCode(v(f, 'code')); if (!code) return; const date = mdpDate(v(f, 'date')) || String(v(f, 'date') || '').slice(0, 10), route = String(v(f, 'route') || '').trim(), out = mdpNum(v(f, 'out')), st = String(v(f, 'status') || '').trim();
    const open = out > 0 && (!ok('status') || st === '' || /^(open|outstanding|partial|pending|new)/i.test(st)); const key = ok('key') && String(v(f, 'key') || '').trim() ? String(v(f, 'key')).trim() : mdpOpKey(date, route, code);
    rows.push({ id: it.id, key, date, route, code, desc: String(v(f, 'desc') || '').trim(), uom: String(v(f, 'uom') || '').trim(), ordered: mdpNum(v(f, 'ordered')), picked: mdpNum(v(f, 'picked')), out, transit: mdpNum(v(f, 'transit')), round: Math.round(mdpNum(v(f, 'round'))), status: st, open }); });
  const o = mdpOpState(); o.rows = rows; o.at = Date.now(); mdp.cfg.openRows = rows; mdp.cfg.openAt = o.at; mdpSave(); return rows;
}
/* what this round leaves behind — one row per order date + route + item */
function mdpOpPlan() {
  const r = mdp.res || mdpCompute(), by = new Map(); r.lines.forEach(l => { const key = mdpOpKey(l.date, l.route, l.code); let o = by.get(key); if (!o) { o = { key, date: l.date, route: l.route, code: l.code, desc: l.desc, uom: l.uom, req: 0, pa: 0, pt: 0, open: null }; by.set(key, o); } o.req += l.req; o.pa += l.pa; o.pt += l.pt; if (l.open) o.open = l.open; });
  const idx = mdpOpIndex(), out = [];
  by.forEach(o => { const ex = o.open || idx.get(o.key) || null, fromOpen = !!o.open, ordered = fromOpen ? ex.ordered : o.req, picked = (fromOpen ? ex.picked : 0) + o.pa, rem = Math.max(0, o.req - o.pa);
    if (!ex && rem <= 0) return; out.push({ key: o.key, date: o.date, route: o.route, code: o.code, desc: o.desc, uom: o.uom, ordered, picked, thisRound: o.pa, rem, transit: Math.min(rem, o.pt), round: ex ? (ex.round || 0) + 1 : 1, status: rem > 0 ? 'Open' : 'Fulfilled', ex, act: ex ? (rem > 0 ? 'Update' : 'Fulfilled') : 'New' }); });
  return out.sort((a, b) => mdpNat(a.route, b.route) || a.code.localeCompare(b.code));
}
function mdpOpFields(map, rec) { const f = {}; Object.entries(map).forEach(([k, col]) => { if (!col || col === SKIP_VALUE) return; if (k === CURRENT_USER_FIELD_KEY) { f[col] = getCurrentUserValue(); return; } if (k === LOC_FIELD_KEY) { const lv = locOne(); if (lv) f[col] = lv; return; } const v = rec[k]; if (v === '' || v == null) return; f[col] = v; }); return f; }
async function mdpOpWrite(list, rows, fn) {   // fn(row) -> {id|null, rec}; creates or updates (2 at a time, a failed row is retried)
  const token = getGlobalAccessToken(), site = getGlobalSiteUrl(), { siteId, listId } = await resolveIds(site, list.list, token); let ok = 0, fail = 0, next = 0; const errors = [];
  /* read the column types first: numbers/dates/choices are converted to what each column expects and columns that cannot be written (lookup, person, calculated, read-only) are left out */
  let T = {}; try { await fetchColumns(siteId, listId, token); T = (window.SP_COLT || {})[listId] || {}; } catch (e) {}
  const skip = new Set(Object.values(T).filter(c => ['lookup', 'person', 'term', 'calculated'].includes(c.type) || READ_ONLY_COLUMNS.has(String(c.name).toLowerCase())).map(c => c.name)), sk = [];
  const sl = ms => new Promise(r => setTimeout(r, ms));
  const worker = async () => { while (next < rows.length) { const r = rows[next++], x = fn(r), fields = mdpOpFields(list.map, x.rec); Object.keys(fields).forEach(k => { if (skip.has(k) || (Object.keys(T).length && !T[k])) { if (!sk.includes(k)) sk.push(k); delete fields[k]; } });
    let last = null; for (let a = 0; a < 3; a++) { try { if (!Object.keys(fields).length) throw new Error('nothing mapped'); if (x.id) await updateItem(siteId, listId, x.id, spCoerceFields(listId, fields), token); else await createItem(siteId, listId, fields, token); last = null; break; } catch (e) { last = e; if (!/HTTP (500|502|503|504|429)/.test(e.message)) break; await sl(700 * (a + 1)); } }
    if (last) { fail++; if (errors.length < 3) errors.push(`${r.code}: ${String(last.message).replace(/\{"error".*$/s, '').trim() || last.message}`); } else ok++; } };
  await Promise.all(Array.from({ length: 2 }, worker));
  if (fail) { const cols = Object.entries(list.map).filter(([, c]) => c && c !== SKIP_VALUE).map(([k, c]) => `${c} (${(T[c] || {}).type || '?'})`); errors.push('Mapped columns: ' + cols.join(', ')); }
  if (sk.length) errors.push('Left out (not writable / not in the list): ' + sk.join(', '));
  return { ok, fail, errors };
}
const mdpOpSay = t => { const m = PLQ('#mdpOpMsg'); if (m) { m.textContent = t; m.style.color = /^(⚠|✘)/.test(t) ? '#b45309' : ''; } };
async function mdpOpSave() {
  const id = 'mdp-open'; if (!utReady(id)) { mdpOpSay('⚠ No destination is set for “Milco outstanding orders”.'); return; }
  const btn = PLQ('#mdpOpSave'); btn.disabled = true;
  try {
    mdpOpSay('Reading the current outstanding list…'); await mdpOpLoad(mdpOpSay); mdpCompute(); const plan = mdpOpPlan(); if (!plan.length) { mdpOpSay('Nothing to save — everything was collected and nothing was outstanding.'); return; }
    const cfg = utGet(id), map = await utEffMap(id), n = k => plan.filter(p => p.act === k).length, sig = plan.map(p => p.key + ':' + p.ordered + ':' + p.thisRound).join(';'), again = mdp.cfg.openSig === sig;
    if (!(await spAsk(`Save this round to “${cfg.list}”?\n\n• ${n('New')} new outstanding row(s)\n• ${n('Update')} row(s) updated with the new balance\n• ${n('Fulfilled')} row(s) marked Fulfilled` + (again ? '\n\n⚠ This exact round was already saved. Saving it again counts the collected quantities twice.' : '')))) { mdpOpSay(''); return; }
    const today = new Date().toISOString().slice(0, 10), r = await mdpOpWrite({ list: cfg.list, map }, plan, p => ({ id: p.ex ? p.ex.id : null, rec: { key: p.key, date: p.date, route: p.route, code: p.code, desc: p.desc, uom: p.uom, ordered: p.ordered, picked: p.picked, out: p.rem, transit: p.transit, round: p.round, status: p.status, updated: today } }));
    mdp.cfg.openSig = sig; mdp.cfg.useOpen = false; mdpSave(); try { await mdpOpLoad(); } catch (e) {}
    mdpOpSay(`${r.fail ? '⚠' : '✓'} Round saved: ${mdpN(r.ok)} row(s) written to “${cfg.list}”` + (r.fail ? `, ${mdpN(r.fail)} failed — ${r.errors.join(' · ')}` : '.' + (r.errors.length ? ' ⚠ ' + r.errors.join(' · ') + '.' : '')) + ' The outstanding balance is no longer added to this plan — when stock arrives, load it again and start the next round.');
    try { addActivity('upload', `Milco outstanding round saved → "${cfg.list}": ${r.ok} row(s)`); w_logToActivity(`Milco outstanding → "${cfg.list}": ${r.ok} ok, ${r.fail} failed`); } catch (e) {}
  } catch (e) { mdpOpSay('✘ ' + e.message); } finally { btn.disabled = false; mdpRender(); }
}
async function mdpOpCloseSel() {
  const o = mdpOpState(), sel = o.rows.filter(r => r.open && (mdp.cfg.openClose || {})[r.id]); if (!sel.length) { mdpOpSay('⚠ Tick “Close” on the outstanding rows that will not be fulfilled.'); return; }
  const uid = 'mdp-unav', oid = 'mdp-open'; if (!utReady(uid)) { mdpOpSay('⚠ No destination is set for “Milco unavailable stock”. ' + (utIsAdmin() ? 'Set it in Upload Destinations & Sources.' : 'Ask an administrator.')); return; }
  const om = mdpOpMap(oid); if (!om.ok('status')) { mdpOpSay('⚠ Map the Status field of “Milco outstanding orders” so closed rows can be marked.'); return; }
  const ucfg = utGet(uid), ocfg = utGet(oid), tot = sel.reduce((a, r) => a + r.out, 0);
  if (!(await spAsk(`Move ${sel.length} outstanding row(s) (${mdpN(tot)} units) to “${ucfg.list}” and mark them “Closed - unavailable” in “${ocfg.list}”?`))) return;
  const btn = PLQ('#mdpOpClose'); btn.disabled = true;
  try {
    const today = new Date().toISOString().slice(0, 10), umap = await utEffMap(uid), omap = await utEffMap(oid);
    mdpOpSay('Writing to the unavailable-stock list…'); const a = await mdpOpWrite({ list: ucfg.list, map: umap }, sel, r => ({ id: null, rec: { date: r.date, route: r.route, code: r.code, desc: r.desc, uom: r.uom, ordered: r.ordered, picked: r.picked, unavail: r.out, round: r.round, closed: today, note: 'Closed as unavailable' } }));
    if (a.fail) { mdpOpSay(`⚠ ${a.fail} row(s) could not be written to “${ucfg.list}” — ${a.errors.join(' · ')}. The outstanding rows were NOT changed.`); return; }
    mdpOpSay('Marking the outstanding rows as closed…'); const b = await mdpOpWrite({ list: ocfg.list, map: omap }, sel, r => ({ id: r.id, rec: { status: 'Closed - unavailable', updated: today, note: 'Moved to unavailable stock' } }));
    mdp.cfg.openClose = {}; mdpSave(); try { await mdpOpLoad(); } catch (e) {}
    mdpOpSay(`${b.fail ? '⚠' : '✓'} ${mdpN(a.ok)} row(s) moved to “${ucfg.list}”` + (b.fail ? `; ${b.fail} could not be marked closed — ${b.errors.join(' · ')}` : ' and closed.')); try { addActivity('upload', `Milco unavailable stock → "${ucfg.list}": ${a.ok} row(s)`); } catch (e) {}
  } catch (e) { mdpOpSay('✘ ' + e.message); } finally { btn.disabled = false; mdpRender(); }
}
function mdpOpRender() {
  const o = mdpOpState(), q = s => PLQ(s), open = o.rows.filter(r => r.open), plan = mdpOpPlan(), K = (l, v, s) => `<div class="pl-kpi"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`;
  const maxR = open.reduce((a, r) => Math.max(a, r.round || 0), 0), tot = open.reduce((a, r) => a + r.out, 0), rem = plan.reduce((a, p) => a + p.rem, 0);
  q('#mdpOpKpis').innerHTML = K('Open outstanding rows', mdpN(open.length), o.at ? 'loaded ' + new Date(o.at).toLocaleString() : 'not loaded yet') + K('Outstanding units', mdpN(tot), `${mdpN(new Set(open.map(r => r.code)).size)} item(s)`) + K('Rounds so far', mdpN(maxR), 'highest round among open rows') + K('This round leaves', mdpN(rem), `${mdpN(plan.filter(p => p.rem > 0).length)} line(s) outstanding`);
  q('#mdpOpUse').checked = mdp.cfg.useOpen !== false;
  const d = id => { const c = utGet(id); return utReady(id) ? `<strong>${plEsc(c.list)}</strong>` : '<span style="color:#b45309">not set</span>'; };
  q('#mdpOpDest').innerHTML = `📌 Outstanding orders list: ${d('mdp-open')} · Unavailable stock list: ${d('mdp-unav')}` + (utReady('mdp-open') && utReady('mdp-unav') ? '' : ` — ${utIsAdmin() ? 'set them in <strong>Upload Destinations &amp; Sources</strong>.' : 'ask an administrator to set them in Upload Destinations &amp; Sources.'}`);
  const off = mdp.cfg.openOff || {}, cl = mdp.cfg.openClose || {};
  q('#mdpOpBal').innerHTML = '<thead><tr><th>In plan</th><th>Close</th><th>Order date</th><th>Route</th><th>Item</th><th>Description</th><th>UoM</th><th class="n">Ordered</th><th class="n">Collected</th><th class="n">Outstanding</th><th class="n">Rounds</th><th>Status</th></tr></thead><tbody>' + (open.sort((a, b) => a.date.localeCompare(b.date) || mdpNat(a.route, b.route) || a.code.localeCompare(b.code)).map(r => `<tr><td><input type="checkbox" data-inplan="${plEsc(r.id)}" ${off[r.id] ? '' : 'checked'}></td><td><input type="checkbox" data-close="${plEsc(r.id)}" ${cl[r.id] ? 'checked' : ''}></td><td>${plEsc(r.date)}</td><td>${plEsc(r.route)}</td><td>${plEsc(r.code)}</td><td>${plEsc(r.desc)}</td><td>${plEsc(r.uom)}</td><td class="n">${mdpN(r.ordered)}</td><td class="n">${mdpN(r.picked)}</td><td class="n"><b>${mdpN(r.out)}</b></td><td class="n">${mdpN(r.round)}</td><td>${plEsc(r.status || 'Open')}</td></tr>`).join('') || '<tr><td colspan="12" class="pl-empty">No open outstanding rows. Load them from SharePoint, or finish a first round and save it.</td></tr>') + '</tbody>';
  const act = { New: '🆕 New', Update: '✏ Update', Fulfilled: '✅ Fulfilled' };
  q('#mdpOpPrev').innerHTML = '<thead><tr><th>Action</th><th>Order date</th><th>Route</th><th>Item</th><th>Description</th><th>UoM</th><th class="n">Ordered</th><th class="n">Collected before</th><th class="n">This round</th><th class="n">Outstanding after</th><th class="n">Round</th></tr></thead><tbody>' + (plan.slice(0, 400).map(p => `<tr><td>${act[p.act]}</td><td>${plEsc(p.date)}</td><td>${plEsc(p.route)}</td><td>${plEsc(p.code)}</td><td>${plEsc(p.desc)}</td><td>${plEsc(p.uom)}</td><td class="n">${mdpN(p.ordered)}</td><td class="n">${mdpN(p.picked - p.thisRound)}</td><td class="n">${mdpN(p.thisRound)}</td><td class="n"${p.rem > 0 ? ' style="color:#c0392b;font-weight:700"' : ''}>${mdpN(p.rem)}</td><td class="n">${mdpN(p.round)}</td></tr>`).join('') || '<tr><td colspan="11" class="pl-empty">Nothing to save for this plan.</td></tr>') + '</tbody>';
  q('#mdpOpMore').textContent = plan.length > 400 ? `Showing the first 400 of ${plF(plan.length)} rows — Excel has all.` : '';
  q('#mdpOpSave').disabled = !plan.length;
}
function mdpOpInit() {
  const q = s => PLQ(s); mdpOpState();
  q('#mdpOpUse').addEventListener('change', e => { mdp.cfg.useOpen = e.target.checked; mdpSave(); mdpRender(); });
  q('#mdpOpGo').addEventListener('click', () => { const n = document.querySelector('.nav-item[data-view="uploaddest"]'); if (n) n.click(); else sectionToast('Upload Destinations & Sources is available to administrators.', 'warn'); });
  q('#mdpOpLoad').addEventListener('click', async () => { const b = q('#mdpOpLoad'); b.disabled = true; try { mdpOpSay('Reading the outstanding list…'); const rows = await mdpOpLoad(mdpOpSay); mdpOpSay(`✓ ${mdpN(rows.length)} row(s) read · ${mdpN(rows.filter(r => r.open).length)} open.`); } catch (e) { mdpOpSay('✘ ' + e.message); } finally { b.disabled = false; mdpRender(); } });
  q('#mdpOpSave').addEventListener('click', mdpOpSave); q('#mdpOpClose').addEventListener('click', mdpOpCloseSel);
  q('#mdpOpBal').addEventListener('change', e => { const i = e.target; if (i.dataset.inplan) { mdp.cfg.openOff = mdp.cfg.openOff || {}; if (i.checked) delete mdp.cfg.openOff[i.dataset.inplan]; else mdp.cfg.openOff[i.dataset.inplan] = 1; mdpSave(); mdpRender(); } else if (i.dataset.close) { mdp.cfg.openClose = mdp.cfg.openClose || {}; if (i.checked) mdp.cfg.openClose[i.dataset.close] = 1; else delete mdp.cfg.openClose[i.dataset.close]; mdpSave(); } });
  q('#mdpOpXl').addEventListener('click', () => { const o = mdpOpState(), plan = mdpOpPlan(), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Action', 'Order date', 'Route', 'Item', 'Description', 'UoM', 'Ordered', 'Collected before', 'This round', 'Outstanding after', 'Round'], ...plan.map(p => [p.act, p.date, p.route, p.code, p.desc, p.uom, p.ordered, p.picked - p.thisRound, p.thisRound, p.rem, p.round])]), 'This round');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Order date', 'Route', 'Item', 'Description', 'UoM', 'Ordered', 'Collected', 'Outstanding', 'Rounds', 'Status'], ...o.rows.map(r => [r.date, r.route, r.code, r.desc, r.uom, r.ordered, r.picked, r.out, r.round, r.status])]), 'Outstanding list');
    XLSX.writeFile(wb, 'Milco_outstanding_' + new Date().toISOString().slice(0, 10) + '.xlsx'); });
}

/* ---------- Items, UOM & Batch tables: the administrator defines them ---------- */
utRegister('src-item', { kind: 'source', fieldLabel: 'Item field', section: 'Items, UOM & Batch tables', label: 'Item code table ← SharePoint', fields: [
  { key: 'sku', label: 'SKU / Item code', alias: ['sku', 'skucode', 'itemcode', 'item', 'itemnumber', 'itemno', '2nditemnumber', 'title'] }, { key: 'desc', label: 'Description', alias: ['description', 'itemdescription', 'itemdesc', 'desc', 'itemname', 'name'] }, { key: 'uom', label: 'Default UOM', alias: ['uom', 'uomdesc', 'unit', 'baseuom', 'unitofmeasure'] }],
  note: 'Used by FOC Release Voucher: SKU suggestions, descriptions and the default UOM. The 🔄 Refresh button on the voucher reloads it.' });
utRegister('src-uom', { kind: 'source', fieldLabel: 'UOM field', section: 'Items, UOM & Batch tables', label: 'UOM conversion table ← SharePoint', fields: [
  { key: 'sku', label: 'SKU / Item code', alias: ['sku', 'skucode', 'itemcode', 'item', '2nditemnumber', 'title'] }, { key: 'desc', label: 'Description', alias: ['description', 'itemdescription', 'desc'] }, { key: 'uom', label: 'UOM code (one row per SKU + UOM)', alias: ['uom', 'uomdesc', 'unit'] }, { key: 'factor', label: 'Pcs per UOM (one row per SKU + UOM)', alias: ['factor', 'pcsperuom', 'conversion', 'qtyperuom', 'pcs'] }, { key: 'carton', label: 'Pcs per carton (one row per SKU)', alias: ['pcspercarton', 'carton', 'pcsperct', 'ctn'] }, { key: 'pallet', label: 'Pcs per pallet (one row per SKU)', alias: ['pcsperpallet', 'pallet', 'pcsperplt', 'plt'] }],
  note: 'Used by Warehouse → FEFO (UOM conversion) and as a fallback for descriptions in the FOC voucher. Once saved it replaces the “UOM List” picker in Warehouse.' });
utRegister('src-batch', { kind: 'source', fieldLabel: 'Batch field', section: 'Items, UOM & Batch tables', label: 'Batch table ← SharePoint', fields: () => FEFO_MAP_BATCH_ROLES.map(r => ({ key: r.key, label: r.label.replace(/ \(conversion only.*$/, ''), alias: r.aliases })),
  note: 'Used by Warehouse → FEFO (batch balances) and by the FOC voucher to suggest the batch and fill its expiry. Once saved it replaces the “Batch List” picker in Warehouse.' });
const utSrcSig = {};
function utUomOverride() { if (!utReady('src-uom')) return; const c = utGet('src-uom'); if (c.list !== wUomState.listName) return; Object.entries(c.map).forEach(([k, v]) => { if (k in wUomState.map && v && v !== SKIP_VALUE && wUomState.headers.includes(v)) wUomState.map[k] = v; }); }
function utBatchOverride(cols) { if (!utReady('src-batch')) return; const c = utGet('src-batch'); if (c.list !== wFefoState.batchListName) return; Object.entries(c.map).forEach(([k, v]) => { if (k in wFefoState.batchMapping && v && v !== SKIP_VALUE && cols.some(x => x.name === v)) wFefoState.batchMapping[k] = v; }); }
function utSrcLines() {
  [['src-uom', '[data-list-picker="w-uom"]'], ['src-batch', '[data-list-picker="w-fefo-batch"]']].forEach(([id, sel]) => {
    const pk = document.querySelector(sel), fg = pk && pk.closest('.form-group'); if (!fg) return; let d = document.querySelector(`.ut-src[data-ut="${id}"]`);
    if (!d) { d = document.createElement('div'); d.className = 'ut-src text-sm'; d.dataset.ut = id; d.style.cssText = 'padding:8px 10px;border:1px dashed var(--border);border-radius:8px;margin:6px 0;'; fg.parentNode.insertBefore(d, fg); }
    const ok = utReady(id), c = utGet(id); fg.style.display = ok ? 'none' : ''; d.style.display = ok ? '' : 'none';
    if (ok) d.innerHTML = `📌 Table defined by the administrator: <strong>${plEsc(c.list)}</strong> (${Object.values(c.map).filter(v => v && v !== SKIP_VALUE).length} fields mapped)`;
  });
}
async function utSrcApplyAll(force) {
  utSrcLines(); if (!getGlobalAccessToken() || !getGlobalSiteUrl()) return;
  try { if (utReady('src-uom')) { const c = utGet('src-uom'), sig = JSON.stringify(c); if (force || utSrcSig.uom !== sig || wUomState.listName !== c.list) { utSrcSig.uom = sig; wUomState.listName = c.list; wUomState.source = 'list'; wUomState.table = new Map(); try { localStorage.setItem(LS_BASE + '_wuom_list', c.list); } catch (e) {} try { wUomState.picker && wUomState.picker.setValue(c.list); } catch (e) {} await wUom_loadFromList(); } } } catch (e) {}
  try { if (utReady('src-batch')) { const c = utGet('src-batch'), sig = JSON.stringify(c); if (force || utSrcSig.batch !== sig || wFefoState.batchListName !== c.list) { utSrcSig.batch = sig; if (wFefoState.batchListName !== c.list) { wFefoState.batchListName = c.list; try { localStorage.setItem(LS_BASE + '_wfefo_batchList', c.list); } catch (e) {} try { wFefoState.listPicker && wFefoState.listPicker.setValue(c.list); } catch (e) {} } wFefoState.batchIndex = null; wFefoState.batchLoadedAt = 0; await wFefoMap_loadBatchColumns(true); } } } catch (e) {}
}
document.querySelectorAll('.nav-item[data-view="warehouse"], .nav-item[data-view="foc"]').forEach(n => n.addEventListener('click', () => setTimeout(() => utSrcApplyAll(), 400)));
setTimeout(utSrcLines, 1500);
