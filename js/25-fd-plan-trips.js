/* ---------- quantity above the plan (added items / increases) and the Balance Plan decision ---------- */
const fdCellOfM = (m, key) => { const [d, loc, code] = key.split('|'), j = m.snap.locs.indexOf(loc), o = m.rowBy.get(code), dem = o ? (o.v.dem[d] || [])[j] || 0 : 0; return { dem, cur: m.st.act[key] != null ? m.st.act[key] : dem }; };
function fdExtraM(m, l) { const c = fdCellOfM(m, l.key); if (!(c.cur > c.dem + 1e-9) || !(l.qty > 0)) return 0; return l.qty * (c.cur - c.dem) / c.cur; }
const fdExtraLines = (m, t) => t.lines.map(l => ({ l, ex: fdExtraM(m, l) })).filter(x => x.ex > 1e-9);
function fdBalBox(t) {
  const m = fd.m, st = m.st, X = fdExtraLines(m, t); if (!X.length) return '';
  return `<div class="fd-balbox" id="fdBalBox"><b>⚠ Added items / quantities above the plan</b><div class="text-sm" style="margin:4px 0 6px;color:var(--gray-700)">These quantities are not in the demand (Balance Plan). Choose what to do: <b>Yes</b> — the upload page also adds them as a <b>negative quantity</b> row so the Balance Plan is reduced; <b>No</b> — nothing is added. The dispatched quantity itself is always uploaded as a normal positive row.</div>
  <div class="fd-wrap" style="max-height:none"><table class="fd-tbl"><thead><tr>${fdTh('ICODE')}${fdTh('Item')}${fdTh('Above plan', 1)}${fdTh('Apply to the Balance Plan?')}</tr></thead><tbody>${X.map(x => `<tr><td>${plEsc(x.l.code)}</td><td>${plEsc(x.l.item)}</td><td class="n">+${fdQnum(x.ex)}</td><td><select data-bal="${plEsc(x.l.key)}"><option value="" ${!st.bal[x.l.key] ? 'selected' : ''}>— choose —</option><option value="yes" ${st.bal[x.l.key] === 'yes' ? 'selected' : ''}>Yes — deduct from the Balance Plan (negative row)</option><option value="no" ${st.bal[x.l.key] === 'no' ? 'selected' : ''}>No — do nothing</option></select></td></tr>`).join('')}</tbody></table></div></div>`;
}
function fdAddItem(t) {
  if (featBlock('fdedit')) return;
  const m = fd.m, raw = ((document.querySelector('#fdAddCode') || {}).value || '').trim(), qv = +((document.querySelector('#fdAddQty') || {}).value); if (!raw) { sectionToast('Pick the item to add.', 'warn'); return; } if (!(qv > 0)) { sectionToast('Enter a quantity above zero.', 'warn'); return; }
  const tok = raw.split(/\s|—|-\s/)[0].toLowerCase(); let o = m.rowBy.get(raw) || [...m.rowBy.values()].find(x => x.code.toLowerCase() === raw.toLowerCase() || x.code.toLowerCase() === tok) || null;
  if (!o) { const hit = m.snap.rows.filter(x => (x.code + ' ' + x.item).toLowerCase().includes(raw.toLowerCase())); if (hit.length === 1) o = hit[0]; else { sectionToast(hit.length ? 'Several items match — pick one from the list.' : 'That item is not in the uploaded plan.', 'warn'); return; } }
  const key = t.day + '|' + t.loc + '|' + o.code, cur = fdCellOfM(m, key).cur, st = m.st; fdLogAct = 'Added'; try { fdActSet(key, cur + qv); } finally { fdLogAct = ''; } if (!st.actNote[key]) st.actNote[key] = 'Added in trip ' + t.id; fdStSave(fd.date, st);
  const nt = m.trips.find(x => x.lines.some(l => l.key === key)); sectionToast(`${o.code} +${fdQnum(qv)} added` + (nt && nt.id !== t.id ? ` — it is loaded on ${nt.id} (${nt.gl}).` : '.'), 'success'); if (nt) fdTripOpen(nt.id); else fdTripClose();
}
function fdRemoveLine(t, code) {
  if (featBlock('fdedit')) return;
  const m = fd.m, ln = t.lines.find(x => x.code === code); if (!ln) return; if (!confirm(`Remove ${code} (${fdQnum(ln.qty)} units) from this trip?`)) return; const st = m.st, cur = fdCellOfM(m, ln.key).cur;
  fdLogAct = 'Removed'; try { fdActSet(ln.key, Math.max(0, cur - ln.qty)); } finally { fdLogAct = ''; } st.actNote[ln.key] = 'Removed from trip ' + t.id; delete st.line[t.id + '|' + code]; fdStSave(fd.date, st); fdModalRefresh(t.id);
}

/* ---------- trip card ---------- */
function fdTripOpen(id) {
  const t = fd.m.byId.get(id); if (!t) return; fd.open = id; const st = fd.m.st; let el = document.querySelector('#fdTripModal');
  if (!el) { el = document.createElement('div'); el.id = 'fdTripModal'; el.className = 'fd-modal fd-root'; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x=close]')) fdTripClose(); }); el.addEventListener('change', fdTripChange); el.addEventListener('click', fdTripClick); ordWire(el, { move: fdOrdMove, reset: () => { const t = fd.m.byId.get(fd.open); if (t && fd.m.st.ord) { delete fd.m.st.ord[t.id]; fdStSave(fd.date, fd.m.st); } }, redraw: () => fdModalRefresh(fd.open) }); el.addEventListener('input', e => { if (e.target.id !== 'tmFilter') return; const q = e.target.value.trim().toLowerCase(); el.querySelectorAll('.fd-tbl tbody tr').forEach(tr => { tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none'; }); }); try { if (localStorage.getItem(LS_BASE + '_fd_tripmax') === '1') el.classList.add('fd-max'); } catch (x) {} el.addEventListener('click', e => { const x = e.target.closest('[data-x=xl],[data-x=mail],[data-x=prt]'); if (!x) return; if (x.dataset.x === 'xl') a2Export(fdTripData()); else if (x.dataset.x === 'mail') { if (!fdTripData().rows.length) { sectionToast('Nothing to email.', 'warn'); return; } a2Mail(fdTripData); } else a2Print(fdTripData()); }); el.addEventListener('click', e => { if (!e.target.closest('[data-x=max]')) return; const on = el.classList.toggle('fd-max'); try { localStorage.setItem(LS_BASE + '_fd_tripmax', on ? '1' : '0'); } catch (x) {} const b = el.querySelector('[data-x=max]'); if (b) b.textContent = on ? '⤡ Shrink' : '⤢ Expand'; }); el.addEventListener('click', e => { const b = e.target.closest('[data-pk],[data-dn]'); if (!b) return; if (b.dataset.pk) fdPrintHtml(fdDocHtml([t], 'pick', st), 'Picking list ' + t.id); else fdPrintHtml(fdDocHtml([t], 'dn', st), 'Delivery note ' + t.id); }); }
  const mt = st.meta[id] || {}, c = fdCheck(t, st);
  const tLit = t.lines.reduce((a, l) => a + (+l.ltr || 0), 0), tCrt = t.lines.reduce((a, l) => a + (+l.crt || 0), 0), fillP = t.cap ? Math.min(100, t.pal / t.cap * 100) : 0, mx = el.classList.contains('fd-max');
   el.innerHTML = `<div class="card">
   <div class="tm-head"><div class="tm-title"><div class="tm-ico">🚛</div><div><h2>${plEsc(t.id)}</h2><div class="tm-sub">${plEsc(dpDayLong(t.day))} · ${plEsc(t.loc)} · trailer ${t.no} of ${t.n} (${t.gl})</div></div></div>
    <div class="tm-acts"><button class="tm-b tm-menu" data-acm="1" type="button" title="All actions of this screen" aria-haspopup="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-3px"><path d="M4 6h16M4 12h16M4 18h16"/></svg> Actions</button><span class="tm-hid" style="display:none"><button class="tm-b" data-pk="1" type="button">🖨 Picking list</button><button class="tm-b" data-uomcfg="1" type="button" title="Choose the SharePoint list that holds the UoM conversion values and map its fields">⚖ UoM list</button><button class="tm-b" data-dn="1" type="button">🖨 Delivery note</button><span class="tm-sep"></span><button class="tm-b" data-x="spsave" type="button" title="Save the actual picking list of this trip to the SharePoint list">☁ Save to SharePoint</button><button class="tm-b" data-x="chlog" type="button" title="Open the change log">📝 Changes</button><span class="tm-sep"></span><button class="tm-b" data-x="xl" type="button">📊 Excel</button><button class="tm-b" data-x="mail" type="button">✉ Email</button><button class="tm-b" data-x="prt" type="button">🖨 Print list</button></span><button class="tm-b" data-x="max" type="button" title="Full screen / normal size">${mx ? '⤡ Shrink' : '⤢ Expand'}</button><button class="tm-b tm-x" data-x="close" type="button" title="Close">✕ Close</button></div></div>
   <div class="tm-body">
    <div class="tm-kpis"><div class="tm-k"><span>Items</span><b>${t.lines.length}</b></div><div class="tm-k"><span>Pallets</span><b>${fdN(t.pal, 1)} <small>/ ${t.cap}</small></b><div class="bar"><i style="width:${fillP.toFixed(0)}%"></i></div></div><div class="tm-k"><span>Fill</span><b>${fdN(fillP, 0)}%</b></div><div class="tm-k"><span>Litres</span><b>${fdN(tLit)}</b></div><div class="tm-k"><span>Crates</span><b>${fdN(tCrt, 0)}</b></div><div class="tm-k tm-chk"><span>Check</span><div id="fdTripRes">${fdPill(c.lvl, fdLvlTxt(c.lvl))} <span class="tm-iss">${plEsc(c.issues.slice(0, 3).join(' · '))}</span></div></div></div>
    <div class="tm-card"><h3>Trip details</h3><div class="form-grid four"><div class="form-group"><label>Status</label><select data-s="status">${FD_STATUS.map(s => `<option ${s === c.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div class="form-group"><label>Trailer plate</label><input data-s="plate" placeholder="e.g. DXB A 12345" value="${plEsc(mt.plate || '')}"></div><div class="form-group"><label>Driver</label><input data-s="driver" placeholder="Driver name" value="${plEsc(mt.driver || '')}"></div><div class="form-group"><label>Seal no.</label><input data-s="seal" placeholder="Seal number" value="${plEsc(mt.seal || '')}"></div></div>
     <div class="form-group" style="margin:10px 0 0"><label>Remarks <span class="hint">printed on the delivery note</span></label><input data-s="note" placeholder="Optional note for the delivery note" value="${plEsc(mt.note || '')}"></div></div>
    <div class="tm-card tm-items"><div class="tm-ih"><h3>Items &amp; batches</h3><input id="tmFilter" type="search" placeholder="🔍 Filter items…"></div>
     <details class="tm-help"><summary>How quantities and batches work</summary><div>The <b>actual quantity</b> starts equal to the demand. Change it to what the store can supply — the picking list and delivery note use it (the trailers are re-formed, so trip numbers can change). A SKU can carry <b>several batches</b>: use ➕ and give each batch its quantity (a batch without a quantity takes the rest).</div></details>
     <div class="fd-wrap"><table class="fd-tbl"><thead><tr>${fdTh('# · ICODE')}${fdTh('Item')}${fdTh('UoM')}${fdTh('Demand', 1)}${fdTh('Actual qty')}${fdTh('Qty in UoM', 1)}${fdTh('vs plan')}${fdTh('Litres', 1)}${fdTh('Crates', 1)}${fdTh('Pallets', 1)}${fdTh('Batches — batch no. · production · expiry · quantity')}${fdTh('')}</tr></thead><tbody>${fdOrd(t, st).map((l, i) => fdTripLineRow(t, l, i + 1)).join('')}</tbody></table></div></div>
    <div id="fdBalWrap">${fdBalBox(t)}</div></div>
   <div class="tm-foot fd-addbar"><b>➕ Add an item</b><input list="fdAddList" id="fdAddCode" placeholder="ICODE or item name"><datalist id="fdAddList">${fd.m.snap.rows.map(o => `<option value="${plEsc(o.code)}">${plEsc(o.item)}</option>`).join('')}</datalist><input type="number" id="fdAddQty" min="0" step="any" placeholder="Quantity (units)"><button type="button" class="tm-add" data-additem="1">Add item</button><span class="tm-note">Remove a line with ✖. Changes re-form the trailers and are saved for the upload page.</span></div></div>`;
  el.style.display = 'flex';
}
function fdTripData() {
  const t = fd.m && fd.open ? fd.m.byId.get(fd.open) : null; if (!t) return { title: 'Trip', sheet: 'Trip', note: '', headers: [], rows: [] };
  const st = fd.m.st, rows = [];
  fdOrd(t, st).forEach(l => { const c = fdCellOfM(fd.m, l.key), d = c.cur - c.dem, sg = fdSegs(st, t, l), U = fdUc(l), q = v => fdQc(v, U.f), base = [l.code, l.item, U.u, q(l.dem0), q(l.qty), Math.abs(d) < 1e-9 ? '' : q(d), l.ltr || '', l.crt ? +l.crt.toFixed(1) : '', +(+l.pal || 0).toFixed(2)];
    if (!sg.length) rows.push(base.concat(['', '', '', ''])); else sg.forEach((b, i) => rows.push((i ? ['', '', '', '', '', '', '', '', ''] : base).concat([b.b || '', b.p || '', b.e || '', b.q == null ? '' : b.q]))); });
  const mt = st.meta[t.id] || {};
  return { title: 'Trip ' + t.id + ' · ' + fd.date, sheet: 'Trip ' + t.id, note: ['Status: ' + (st.status[t.id] || 'Planned'), mt.plate ? 'Plate: ' + mt.plate : '', mt.driver ? 'Driver: ' + mt.driver : '', mt.seal ? 'Seal: ' + mt.seal : ''].filter(Boolean).join(' · '),
    headers: ['ICODE', 'Item', 'UoM', 'Demand', 'Actual qty', 'vs plan', 'Litres', 'Crates', 'Pallets', 'Batch no.', 'Production', 'Expiry', 'Batch qty'], rows };
}
function fdTripLineRow(t, l, ix) {
  const st = fd.m.st, k = t.id + '|' + l.code, ov = st.line[k], own = fdOwn(ov), adj = st.act[l.key] != null, list = own && Array.isArray(ov.bl) && ov.bl.length ? ov.bl : fdSegs(st, t, l).map(b => ({ b: b.b, p: b.p, e: b.e, q: b.q }));
  return `<tr data-oc="${plEsc(l.code)}"><td style="white-space:nowrap">${ordHandle(l.code, ix)}${plEsc(l.code)}</td><td>${plEsc(l.item)}</td><td>${uomSel(l.code, l.uom)}</td><td class="n">${fdQnum(l.dem0)}</td><td style="min-width:92px"><input type="number" min="0" step="any" data-actq="${plEsc(l.code)}" value="${plEsc(fdQnum(l.qty).replace(/,/g, ''))}" ${adj ? 'style="background:#fff7d6;font-weight:700"' : ''}></td>${uomQtyCell(l.code, l.uom0 || l.uom, l.uom, l.qty, l)}<td>${(() => { const c = fdCellOfM(fd.m, l.key), d = c.cur - c.dem; return Math.abs(d) < 1e-9 ? '' : c.dem === 0 ? '<span class="fd-tag add">Added</span>' : d > 0 ? `<span class="fd-tag add">+${fdQnum(d)}</span>` : `<span class="fd-tag less">−${fdQnum(-d)}</span>`; })()}</td><td class="n">${l.ltr ? fdN(l.ltr) : ''}</td><td class="n">${l.crt ? fdN(l.crt, 1) : ''}</td><td class="n">${fdN(l.pal, 2)}</td><td>${fdBatCell(list, `data-l="${plEsc(l.code)}"`, `<button type="button" class="ghost small" data-addb-l="${plEsc(l.code)}">➕ Add batch</button>${own ? ` <button type="button" class="ghost small" data-resb-l="${plEsc(l.code)}" title="Back to the batches set for the SKU and day">↺ default</button>` : ''}`)}</td><td style="white-space:nowrap">${ordBtns(l.code)}<button type="button" class="ghost small" data-rmline="${plEsc(l.code)}" title="Remove this item from the trip" style="color:#c0392b">✖</button></td></tr>`;
}
function fdTripClose() {
  const el = document.querySelector('#fdTripModal'), t = fd.m && fd.open ? fd.m.byId.get(fd.open) : null;
  if (t) { const st = fd.m.st, und = fdExtraLines(fd.m, t).filter(x => !st.bal[x.l.key]); if (und.length) { const yes = confirm(`${und.length} item(s) in ${t.id} were added or are above the plan (${und.slice(0, 4).map(x => x.l.code + ' +' + fdQnum(x.ex)).join(', ')}${und.length > 4 ? ' …' : ''}).\n\nApply them to the Balance Plan?\n\nOK = Yes — the upload page adds them with a NEGATIVE quantity.\nCancel = No — nothing is added (you can change this later in the trip).`); und.forEach(x => { st.bal[x.l.key] = yes ? 'yes' : 'no'; }); fdStSave(fd.date, st); } }
  if (el) el.style.display = 'none'; fd.open = null; fdRender();
  const ov = document.querySelector('#tblExpandOverlay'); if (ov && ov.style.display === 'flex' && fd.expOn && fd.tab === 'trips') fdExpandTables(document.querySelector('#fdBody'), fd.expTitle || 'F&D Plan · Trips / trailers');
}
function fdModalRefresh(id) {
  const el = document.querySelector('#fdTripModal'), c = el && el.querySelector('.tm-body'), y = c ? c.scrollTop : 0;
  if (fd.m.byId.has(id)) { fdTripOpen(id); const c2 = el.querySelector('.tm-body'); if (c2) c2.scrollTop = y; } else { sectionToast('The trailers were re-formed after the quantity change — open the trip again from the list.', 'info'); fdTripClose(); }
}
const fdCellOf = key => { const [d, loc, code] = key.split('|'), m = fd.m, j = m.snap.locs.indexOf(loc), o = m.rowBy.get(code), dem = o ? (o.v.dem[d] || [])[j] || 0 : 0; return { dem, cur: m.st.act[key] != null ? m.st.act[key] : dem }; };
function fdActRaw(key, v) { const st = fd.m.st, c = fdCellOf(key); if (v == null || !isFinite(v) || Math.abs(v - c.dem) < 1e-9) { delete st.act[key]; delete st.actNote[key]; } else st.act[key] = v; }
function fdRecalcQuiet() { const m = fd.m, st = m.st; m.trips = fdTrips(m.snap, st.cfg, st.act); m.byId = new Map(m.trips.map(t => [t.id, t])); m.alloc = fdAlloc(m); fdStSave(fd.date, st); }
let fdLogAct = '';
const fdActSet = (key, v) => { let before = null, tb = null; try { before = fdCellOf(key).cur; tb = fd.m.trips.find(t => t.lines.some(l => l.key === key)) || fd.m.byId.get(fd.open) || null; } catch (e) {} fdActRaw(key, v); const after = fdCellOf(key).cur; fdRecalcQuiet(); try { fdLogChange(key, before, after, tb); } catch (e) { console.error(e); } };
/* ---------- change log ---------- */
const FDL_KEY = LS_BASE + '_fdlog';
const fdlGet = () => { try { return JSON.parse(localStorage.getItem(FDL_KEY) || '[]') || []; } catch (e) { return []; } };
const fdlPut = a => { try { localStorage.setItem(FDL_KEY, JSON.stringify(a.slice(-5000))); } catch (e) {} };
function fdLogChange(key, before, after, t) {
  if (before == null || after == null || Math.abs(before - after) < 1e-9) return; const [day, loc, code] = key.split('|'), m = fd.m, o = m.rowBy.get(code), who = (currentUser && (currentUser.displayName || currentUser.username)) || 'unknown', now = Date.now(), tid = (t && t.id) || fd.open || '';
  const act = fdLogAct || (after === 0 ? 'Removed' : 'Changed'); let L = fdlGet(); const last = [...L].reverse().find(x => x.tripId === tid && x.code === code && x.user === who && !x.reason && now - x.ts < 600000 && x.day === day);
  if (last) { last.chg = after; last.ts = now; last.at = new Date(now).toISOString(); if (act !== 'Changed') last.act = act; if (Math.abs(last.chg - last.orig) < 1e-9) L = L.filter(x => x !== last); }
  else L.push({ id: now + '-' + Math.random().toString(36).slice(2, 6), ts: now, at: new Date(now).toISOString(), day, tripId: tid, code, item: o ? o.item : '', loc, region: (t && t.region) || '', orig: before, chg: after, user: who, reason: '', act, plan: fd.date });
  fdlPut(L); fdReasonSoon();
}
let fdRsT = null; const fdReasonSoon = () => { clearTimeout(fdRsT); fdRsT = setTimeout(fdReasonAsk, 1400); };
const FDL_REASONS = ['Customer request', 'Stock shortage', 'Production shortage', 'Damaged / quality', 'Short expiry', 'Trailer capacity', 'Planning correction', 'Wrong demand in plan'];
function fdReasonAsk() {
  const who = (currentUser && (currentUser.displayName || currentUser.username)) || 'unknown', P = fdlGet().filter(x => x.user === who && !x.reason && !x.skip && Date.now() - x.ts < 3600000); if (!P.length) return; document.querySelectorAll('#fdRsModal').forEach(x => x.remove());
  const m = document.createElement('div'); m.id = 'fdRsModal'; m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100060;display:flex;align-items:center;justify-content:center;padding:16px';
  m.innerHTML = '<div class="card" style="max-width:520px;width:100%;margin:0;max-height:88vh;overflow:auto"><div class="card-header"><div class="card-title">📝 Reason for change</div></div><div class="text-sm" style="margin-bottom:8px">' + P.length + ' change(s) recorded in the change log:</div><div style="max-height:160px;overflow:auto;font-size:12px;border:1px solid var(--border);border-radius:8px;padding:6px 8px;margin-bottom:10px">' + P.map(x => '<div><b>' + plEsc(x.tripId) + '</b> · ' + plEsc(x.code) + ' ' + plEsc(x.item) + ' — ' + plEsc(x.act) + ': ' + fdQnum(x.orig) + ' → <b>' + fdQnum(x.chg) + '</b></div>').join('') + '</div><div class="form-group"><label>Reason</label><select id="fdRsSel"><option value="">— pick a reason —</option>' + FDL_REASONS.map(r => '<option>' + r + '</option>').join('') + '<option value="__o">Other…</option></select></div><div class="form-group"><label>Details <span class="hint">optional / used when “Other”</span></label><input type="text" id="fdRsTxt" maxlength="200" placeholder="Why was it changed?"></div><div class="btn-row"><button class="success" id="fdRsOk" type="button">💾 Save reason</button><button class="ghost" id="fdRsSkip" type="button">Skip for now</button></div></div>';
  document.body.appendChild(m); const done = () => m.remove();
  m.querySelector('#fdRsSkip').onclick = () => { const L = fdlGet(); P.forEach(p => { const x = L.find(y => y.id === p.id); if (x) x.skip = 1; }); fdlPut(L); done(); };
  m.querySelector('#fdRsOk').onclick = () => { const sel = m.querySelector('#fdRsSel').value, tx = m.querySelector('#fdRsTxt').value.trim(), r = sel === '__o' || !sel ? tx : (sel + (tx ? ' — ' + tx : '')); if (!r) { sectionToast('Pick a reason or type one.', 'warn'); return; } const L = fdlGet(); P.forEach(p => { const x = L.find(y => y.id === p.id); if (x) x.reason = r; }); fdlPut(L); done(); try { fdLogRender(); } catch (e) {} };
}
const FDL_FIELDS = [
  { key: 'tripId', label: 'Trip no.', alias: ['tripno', 'tripid', 'trip', 'title'] }, { key: 'code', label: 'SKU code', alias: ['skucode', 'icode', 'sku', 'code'] }, { key: 'item', label: 'Item', alias: ['item', 'itemdesc', 'description'] },
  { key: 'day', label: 'Date', alias: ['date', 'dispatchdate', 'plandate'] }, { key: 'orig', label: 'Original QTY', alias: ['originalqty', 'originalquantity', 'original', 'oldqty'] }, { key: 'chg', label: 'Changed QTY', alias: ['changedqty', 'changedquantity', 'newqty', 'changed'] },
  { key: 'diff', label: 'Difference', alias: ['difference', 'diff', 'variance'] }, { key: 'act', label: 'Action', alias: ['action', 'changetype'] }, { key: 'user', label: 'User name', alias: ['username', 'user', 'changedby'] },
  { key: 'reason', label: 'Reason for change', alias: ['reasonforchange', 'reason'] }, { key: 'region', label: 'Planned region', alias: ['plannedregion', 'region'] }, { key: 'loc', label: 'Location', alias: ['location', 'loc', 'destination'] }, { key: 'at', label: 'Changed at', alias: ['changedat', 'timestamp', 'changedon', 'modifiedat'] }
];
const FDL_HEAD = FDL_FIELDS.map(f => f.label);
const FDLG_CFG = LS_BASE + '_fdlg_cfg';
const fdl = { src: 'local', sp: [], picker: null, cols: [], map: {} };
const fdlCfg = () => { try { return JSON.parse(localStorage.getItem(FDLG_CFG) || '{}') || {}; } catch (e) { return {}; } };
const fdlCfgOk = c => !!(c && c.list && Object.values(c.map || {}).some(v => v && v !== SKIP_VALUE));
const fdlSrc = () => fdl.src === 'sp' ? fdl.sp : fdlGet();
function fdLogView() {
  const q = (PLQ('#fdlQ').value || '').trim().toLowerCase(), f = PLQ('#fdlFrom').value, t = PLQ('#fdlTo').value, u = PLQ('#fdlUser').value, r = PLQ('#fdlReg').value, a = PLQ('#fdlAct').value;
  return fdlSrc().filter(x => (!f || x.day >= f) && (!t || x.day <= t) && (!u || x.user === u) && (!r || x.region === r) && (!a || x.act === a) && (!q || [x.tripId, x.code, x.item, x.user, x.reason, x.region, x.loc].join(' ').toLowerCase().includes(q))).sort((x, y) => y.ts - x.ts);
}
const fdlRow = x => [x.tripId, x.code, x.item, x.day, x.orig, x.chg, Math.round((x.chg - x.orig) * 1000) / 1000, x.act, x.user, x.reason || '', x.region, x.loc, x.ts ? new Date(x.ts).toLocaleString() : ''];
function fdLogRender() {
  const T = PLQ('#fdlTbl'); if (!T) return; const all = fdlSrc(), ro = fdl.src === 'sp', keep = (id, k) => { const e = PLQ(id), p = e.value; e.innerHTML = '<option value="">All</option>' + [...new Set(all.map(x => x[k]).filter(Boolean))].sort().map(v => '<option>' + plEsc(v) + '</option>').join(''); if ([...e.options].some(o => o.value === p)) e.value = p; };
  keep('#fdlUser', 'user'); keep('#fdlReg', 'region'); const rows = fdLogView(); PLQ('#fdlCount').textContent = `— ${rows.length} of ${all.length} record(s) · ${ro ? '☁ SharePoint list' : '💻 this browser'}`;
  const pend = fdlGet().filter(x => !x.up).length; PLQ('#fdlSrcInfo').textContent = pend ? `${pend} local change(s) not yet uploaded` : '';
  const em = PLQ('#fdlEmpty'); em.style.display = rows.length ? 'none' : ''; em.textContent = ro ? 'The SharePoint list has no matching records. Press ⬇ Load from SharePoint to refresh.' : 'No changes recorded yet. Change a quantity, add or remove an item inside a trip and it appears here.';
  T.innerHTML = '<thead><tr>' + FDL_HEAD.map((h, i) => '<th' + (i >= 4 && i <= 6 ? ' class="n"' : '') + '>' + h + '</th>').join('') + '</tr></thead><tbody>' + rows.map(x => { const d = x.chg - x.orig; return '<tr><td><b>' + plEsc(x.tripId) + '</b></td><td>' + plEsc(x.code) + '</td><td>' + plEsc(x.item) + '</td><td>' + plEsc(x.day) + '</td><td class="n">' + fdQnum(x.orig) + '</td><td class="n"><b>' + fdQnum(x.chg) + '</b></td><td class="n" style="color:' + (d > 0 ? '#0b7a0b' : '#c0392b') + '">' + (d > 0 ? '+' : '') + fdQnum(d) + '</td><td>' + plEsc(x.act) + '</td><td>' + plEsc(x.user) + '</td><td style="min-width:220px"><input type="text" data-rid="' + plEsc(x.id) + '" value="' + plEsc(x.reason || '') + '" placeholder="Type the reason…" maxlength="200" ' + (ro ? 'disabled' : '') + '></td><td>' + plEsc(x.region) + '</td><td>' + plEsc(x.loc) + '</td><td>' + plEsc(x.ts ? new Date(x.ts).toLocaleString() : '') + '</td></tr>'; }).join('') + '</tbody>';
}
/* upload change-log entries to the change-log list */
async function fdLogPush(entries) {
  const cfg = fdlCfg(); if (!fdlCfgOk(cfg)) return { skipped: 'The change-log list is not set up yet (F&D Change Log → SharePoint lists).' }; if (!entries.length) return { ok: 0, fail: 0, errs: [] };
  if (!hasPerm('uploader') && !hasPerm('fdplan-upload') && !hasPerm('fdplan')) return { skipped: 'No permission to upload.' }; if (!isListVisible(cfg.list) || !isListEditable(cfg.list)) return { skipped: 'No write access to "' + cfg.list + '".' };
  const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) return { skipped: 'Sign in / set the global Site URL first.' };
  const { siteId, listId } = await resolveIds(siteUrl, cfg.list, token), active = Object.entries(cfg.map).filter(([, v]) => v && v !== SKIP_VALUE); let ok = 0, fail = 0, next = 0; const errs = [], L = fdlGet();
  const worker = async () => { while (next < entries.length) { const e = entries[next++], v = { tripId: e.tripId, code: e.code, item: e.item, day: e.day, orig: e.orig, chg: e.chg, diff: Math.round((e.chg - e.orig) * 1000) / 1000, act: e.act, user: e.user, reason: e.reason || '', region: e.region, loc: e.loc, at: new Date(e.ts).toISOString() }, f = {};
    active.forEach(([k, target]) => { const x = v[k]; if (x !== null && x !== undefined && x !== '') f[target] = x; }); if (!Object.keys(f).length) { fail++; continue; }
    try { await createItem(siteId, listId, f, token); ok++; const z = L.find(y => y.id === e.id); if (z) z.up = Date.now(); } catch (err) { fail++; if (errs.length < 3) errs.push(e.code + ': ' + err.message); } } };
  await Promise.all([worker(), worker(), worker()]); fdlPut(L); return { ok, fail, errs };
}
function fdLogInit() {
  const q = PLQ; if (!q('#fdlTbl') || q('#fdlTbl').dataset.w) return; q('#fdlTbl').dataset.w = 1;
  ['#fdlQ', '#fdlFrom', '#fdlTo', '#fdlUser', '#fdlReg', '#fdlAct'].forEach(s => q(s).addEventListener(s === '#fdlQ' ? 'input' : 'change', fdLogRender));
  q('#fdlTbl').addEventListener('change', e => { const i = e.target.closest('input[data-rid]'); if (!i || fdl.src === 'sp') return; const L = fdlGet(), x = L.find(y => y.id === i.dataset.rid); if (x) { x.reason = i.value.trim(); fdlPut(L); } });
  const data = () => { const r = fdLogView(); return { title: 'F&D Change Log' + (fdl.src === 'sp' ? ' (SharePoint)' : ''), sheet: 'FD Change Log', note: r.length + ' record(s)', headers: FDL_HEAD, rows: r.map(fdlRow) }; };
  q('#fdlXl').addEventListener('click', () => { if (featBlock('excel')) return; a2Export(data()); });
  q('#fdlPrint').addEventListener('click', () => { if (featBlock('print')) return; a2Print(data()); });
  q('#fdlMail').addEventListener('click', () => { if (featBlock('email')) return; if (!data().rows.length) { sectionToast('Nothing to email.', 'warn'); return; } a2Mail(data); });
  q('#fdlClear').addEventListener('click', () => { if (!isAdmin()) { sectionToast('Only an administrator can clear the log.', 'warn'); return; } if (!fdlGet().length) return; if (!confirm('Delete the change log kept on THIS browser? (Rows already uploaded to SharePoint stay there.)')) return; fdlPut([]); fdLogRender(); });
  q('#fdlSrc').addEventListener('change', e => { fdl.src = e.target.value; if (fdl.src === 'sp' && !fdl.sp.length) q('#fdlLoad').click(); else fdLogRender(); });
  /* setup: change-log list + mapping */
  const save = () => { try { localStorage.setItem(FDLG_CFG, JSON.stringify({ list: fdl.picker ? fdl.picker.getValue() : '', map: fdl.map })); } catch (e) {} };
  const renderMap = () => { const body = q('#fdlMapBody'); body.innerHTML = ''; if (!fdl.cols.length && !Object.keys(fdl.map).length) { body.innerHTML = '<tr><td colspan="2" style="padding:14px;text-align:center;color:var(--gray-400);font-style:italic">Pick the list and click 🔄 Load Columns to map fields.</td></tr>'; return; }
    const cols = fdl.cols.length ? fdl.cols : Object.values(fdl.map).filter(v => v && v !== SKIP_VALUE).map(n => ({ name: n, displayName: n })); FDL_FIELDS.forEach(f => { const tr = document.createElement('tr'); tr.innerHTML = '<td><strong>' + plEsc(f.label) + '</strong></td><td class="combo-cell"></td>'; tr.querySelector('.combo-cell').appendChild(buildCombo(fdl.map[f.key] || SKIP_VALUE, cols, nv => { fdl.map[f.key] = nv; save(); })); body.appendChild(tr); }); };
  fdl.picker = createListPicker(document.querySelector('[data-list-picker="fd-log"]'), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: () => { fdl.cols = []; fdl.map = {}; save(); renderMap(); } });
  const c0 = fdlCfg(); try { if (c0.list && fdl.picker.setValue) fdl.picker.setValue(c0.list); } catch (e) {} fdl.map = Object.assign({}, c0.map || {}); renderMap();
  const plc = (() => { try { return JSON.parse(localStorage.getItem(FDUP_CFG) || '{}'); } catch (e) { return {}; } })(); q('#fdlPlInfo').innerHTML = '🚚 Dispatched-plan (actual picking list) list: <b>' + (plc.list ? plEsc(plc.list) : 'not set') + '</b> — set on the <a href="#" data-go="fdplan-upload">F&amp;D Picking Upload</a> page (pick the list and Load Columns).'; q('#fdlPlInfo').addEventListener('click', e => { const a = e.target.closest('a[data-go]'); if (a) { e.preventDefault(); plGo(a.dataset.go); } });
  q('#fdlCols').addEventListener('click', async () => { const st = q('#fdlColsStatus'), name = fdl.picker.getValue(), token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!name || !token || !siteUrl) { st.textContent = '⚠ Pick a list and sign in / set the Site URL.'; return; }
    st.textContent = 'Loading…'; try { const { siteId, listId } = await resolveIds(siteUrl, name, token), cols = await fetchColumns(siteId, listId, token); fdl.cols = cols.filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase())); st.textContent = '✓ ' + fdl.cols.length + ' writable columns'; save(); q('#fdlAuto').click(); } catch (err) { st.textContent = '✘ ' + err.message; } });
  q('#fdlAuto').addEventListener('click', () => { if (!fdl.cols.length) { q('#fdlColsStatus').textContent = '⚠ Load columns first.'; return; } const nz = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, ''), used = new Set(), map = {};
    FDL_FIELDS.forEach(f => { let hit = null; for (const pass of [0, 1]) { for (const al of f.alias) { hit = fdl.cols.find(c => !used.has(c.name) && (pass === 0 ? (nz(c.name) === al || nz(c.displayName) === al) : (al.length >= 4 && (nz(c.name).includes(al) || nz(c.displayName).includes(al))))); if (hit) break; } if (hit) break; } if (hit) used.add(hit.name); map[f.key] = hit ? hit.name : SKIP_VALUE; }); fdl.map = map; save(); renderMap(); });
  q('#fdlLoad').addEventListener('click', async () => { const cfg = fdlCfg(), info = q('#fdlSrcInfo'); if (!fdlCfgOk(cfg)) { q('#fdlSetup').open = true; sectionToast('Set up the change-log list first (pick the list, Load Columns).', 'warn'); return; }
    const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) { sectionToast('Sign in / set the global Site URL first.', 'warn'); return; } if (!isListVisible(cfg.list)) { sectionToast('No permission to read "' + cfg.list + '".', 'warn'); return; }
    info.textContent = 'Downloading…'; try { const { siteId, listId } = await resolveIds(siteUrl, cfg.list, token), items = await fetchAllItems(siteId, listId, token, n => { info.textContent = 'Downloading… ' + n.length; });
      fdl.sp = items.map(it => { const f = it.fields || {}, g = k => { const c = cfg.map[k]; return c && c !== SKIP_VALUE ? f[c] : undefined; }, atRaw = g('at'), day = String(g('day') || '').slice(0, 10), ts = Date.parse(atRaw) || Date.parse(day) || 0, n = k => { const v = +g(k); return isFinite(v) ? v : 0; };
        return { id: 'sp-' + it.id, ts, day, tripId: String(g('tripId') || ''), code: String(g('code') || ''), item: String(g('item') || ''), loc: String(g('loc') || ''), region: String(g('region') || ''), orig: n('orig'), chg: n('chg'), user: String(g('user') || ''), reason: String(g('reason') || ''), act: String(g('act') || '') }; });
      fdl.src = 'sp'; q('#fdlSrc').value = 'sp'; fdLogRender(); sectionToast('✅ ' + fdl.sp.length + ' change-log record(s) downloaded from "' + cfg.list + '".', 'success'); } catch (err) { info.textContent = ''; sectionToast('✘ ' + err.message, 'error'); } });
  q('#fdlPush').addEventListener('click', async () => { const P = fdlGet().filter(x => !x.up); if (!P.length) { sectionToast('Nothing pending — every recorded change is already uploaded.', 'info'); return; } if (!(await spAsk('Upload ' + P.length + ' pending change(s) to the change-log list?'))) return;
    try { const r = await fdLogPush(P); if (r.skipped) sectionToast('⚠ ' + r.skipped, 'warn'); else sectionToast(r.fail ? '⚠ ' + r.ok + ' uploaded, ' + r.fail + ' failed. ' + r.errs.join(' | ') : '✅ ' + r.ok + ' change(s) uploaded.', r.fail ? 'warn' : 'success'); } catch (err) { sectionToast('✘ ' + err.message, 'error'); } fdLogRender(); });
}
document.querySelectorAll('.nav-item[data-view="fdlog"]').forEach(n => n.addEventListener('click', () => { fdLogInit(); fdLogRender(); }));
const fdKeepScroll = fn => { const w = document.querySelector('#fdBody .fd-wrap'), y = w ? w.scrollTop : 0; fn(); const w2 = document.querySelector('#fdBody .fd-wrap'); if (w2) w2.scrollTop = y; };
function fdOvInit(st, t, ln, k) { const o = st.line[k] = st.line[k] || {}; if (!Array.isArray(o.bl) || !o.bl.length) { const sg = fdSegs(st, t, ln); o.bl = sg.map(b => ({ b: b.b, p: b.p, e: b.e, q: sg.length === 1 ? '' : b.q })); delete o.b; delete o.p; delete o.e; } return o; }
function fdPoolEdit(st, k) { if (!Array.isArray(st.bl[k])) { const i = k.indexOf('|'); st.bl[k] = fdPoolRaw(st, k.slice(0, i), k.slice(i + 1)).map(x => Object.assign({}, x)); delete st.batch[k]; } return st.bl[k]; }
function fdTripClick(e) {
  if (e.target.closest('[data-additem],[data-rmline],[data-addb-l],[data-resb-l],[data-delb]') && featBlock('fdedit')) return;
  const t = fd.m.byId.get(fd.open); if (!t) return; const st = fd.m.st; if (e.target.closest('[data-additem]')) { fdAddItem(t); return; } const rm = e.target.closest('[data-rmline]'); if (rm) { fdRemoveLine(t, rm.dataset.rmline); return; } const b = e.target.closest('[data-addb-l],[data-resb-l],[data-delb][data-l]'); if (!b) return;
  const code = b.dataset.addbL || b.dataset.resbL || b.dataset.l, ln = t.lines.find(x => x.code === code); if (!ln) return; const k = t.id + '|' + code;
  if (b.dataset.resbL !== undefined) delete st.line[k]; else if (b.dataset.addbL !== undefined) fdOvInit(st, t, ln, k).bl.push({ b: '', p: '', e: '', q: '' }); else { const o = fdOvInit(st, t, ln, k); o.bl.splice(+b.dataset.delb, 1); if (!o.bl.length) delete st.line[k]; }
  fd.m.alloc = fdAlloc(fd.m); fdStSave(fd.date, st); fdModalRefresh(t.id);
}
function fdTripChange(e) {
  if (e.target.id === 'tmFilter') return;
  if (e.target.dataset && e.target.dataset.uom) { const c = e.target.dataset.uom, u = e.target.value; uomSet(c, u); try { fd.m.trips.forEach(tt => tt.lines.forEach(ll => { if (ll.code === c) ll.uom = u; })); } catch (x) {} try { fdModalRefresh(fd.open); } catch (x) {} return; }
  if (featBlock('fdedit')) { try { fdModalRefresh(fd.open); } catch (x) {} return; }
  const t = fd.m.byId.get(fd.open); if (!t) return; const st = fd.m.st, i = e.target, s = i.dataset.s, l = i.dataset.l;
  if (i.dataset.bal) { if (i.value) st.bal[i.dataset.bal] = i.value; else delete st.bal[i.dataset.bal]; fdStSave(fd.date, st); return; }
  if (s === 'status') st.status[t.id] = i.value; else if (s) { st.meta[t.id] = Object.assign(st.meta[t.id] || {}, { [s]: i.value.trim() }); }
  else if (i.dataset.actq) { const ln = t.lines.find(x => x.code === i.dataset.actq), v = +i.value; if (!ln || !isFinite(v) || v < 0) return; fdActSet(ln.key, Math.max(0, fdCellOf(ln.key).cur + (v - ln.qty))); fdModalRefresh(t.id); return; }
  else if (l) { const k = t.id + '|' + l, f = i.dataset.f, bi = +i.dataset.bi, ln = t.lines.find(x => x.code === l); if (!ln) return; const v = i.value.trim(), o = fdOvInit(st, t, ln, k); while (o.bl.length <= bi) o.bl.push({ b: '', p: '', e: '', q: '' }); const x = o.bl[bi]; x[f] = f === 'q' ? (v === '' ? '' : Math.max(0, +v)) : v;
    if (f === 'p' && st.cfg.shelf > 0 && v && !x.e) { const d = new Date(fdDayMs(v) + st.cfg.shelf * 864e5).toISOString().slice(0, 10); x.e = d; const ex = i.closest('.fdb').querySelector('[data-f=e]'); if (ex) ex.value = d; }
    fd.m.alloc = fdAlloc(fd.m); }
  fdStSave(fd.date, st); const c = fdCheck(t, st); const r = document.querySelector('#fdTripRes'); if (r) r.innerHTML = `${fdPill(c.lvl, fdLvlTxt(c.lvl))} <span class="text-sm" style="color:var(--gray-600)">${plEsc(c.issues.slice(0, 3).join(' · '))}</span>`; fdKpis();
}
function fdQtyRowRefresh(tr) {
  if (!tr) return; const st = fd.m.st, key = tr.dataset.key, r = (fd._q || []).find(x => x.key === key); if (!r) return; r.adj = st.act[key] != null; r.act = r.adj ? st.act[key] : r.dem; const c = fdQtyCalc(r), q = sel => tr.querySelector(sel);
  q('.q-d').textContent = c.diff ? (c.diff > 0 ? '+' : '') + fdQnum(c.diff) : ''; q('.q-d').style.color = c.diff < 0 ? '#d03b3b' : c.diff > 0 ? '#0a7a0a' : ''; q('.q-f').textContent = c.fill == null ? '' : fdN(c.fill, 0) + '%'; q('.q-c').textContent = c.crt ? fdN(c.crt, 1) : ''; q('.q-p').textContent = fdN(c.pal, 2);
  const inp = q('[data-qk]'); inp.style.background = r.adj ? '#fff7d6' : ''; inp.style.fontWeight = r.adj ? '700' : ''; if (!r.adj) inp.value = fdQnum(r.dem).replace(/,/g, ''); fdQtyTotals(); fdKpis();
}
function fdQtyBulk(kind) {
  if (featBlock('fdedit')) return;
  const R = fd._q || []; if (!R.length) return; const pct = Math.max(0, +(document.querySelector('#fdQScale') || {}).value); if (kind === 'scale' && !isFinite(pct)) return;
  if (!confirm(kind === 'scale' ? `Set the actual quantity of ${R.length} filtered row(s) to ${pct}% of the demand?` : `Reset ${R.length} filtered row(s) to the demand quantity?`)) return;
  R.forEach(r => fdActRaw(r.key, kind === 'scale' ? Math.round(r.dem * pct / 100) : null)); fdRecalcQuiet(); fdKeepScroll(fdRender); sectionToast('Quantities updated.', 'success');
}
/* ---------- wiring ---------- */
let fdInited = false, fdBusy = false;
async function fdOpen() {
  if (fdBusy) return; fdBusy = true;
  try { await fdLoad(); fdPopulate(); fdRender(); } catch (e) { console.error(e); sectionToast('F&D Plan: ' + e.message, 'error'); } finally { fdBusy = false; }
}
function fdRecalc() { fdRecalcQuiet(); fdRender(); }
function fdInit() {
  if (fdInited) return; fdInited = true; const q = s => PLQ(s);
  q('#fdGoUpload').addEventListener('click', () => plGo('dailyplan-upload')); q('#fdUploadGo').addEventListener('click', () => plGo('fdplan-upload'));
  q('#fdPlanSel').addEventListener('change', async e => { await fdLoad(e.target.value); fdPopulate(); fdRender(); });
  q('#fdDaySel').addEventListener('change', e => { fd.day = e.target.value; fdRender(); }); 
  let tm; q('#fdSearch').addEventListener('input', e => { fd.q = e.target.value; clearTimeout(tm); tm = setTimeout(fdRender, 200); });
  [['#fdCapP12', 'capP12', 1], ['#fdCapP6', 'capP6', 1], ['#fdMinUtil', 'minUtil', 0], ['#fdMinShelf', 'minShelf', 0], ['#fdShelf', 'shelf', 0]].forEach(([id, k, min]) => q(id).addEventListener('change', e => { if (!fd.m) return; const v = +e.target.value; fd.m.st.cfg[k] = isFinite(v) && v >= min ? v : FD_DEF[k]; e.target.value = fd.m.st.cfg[k]; fdRecalc(); }));
  q('#fdBalance').addEventListener('change', e => { if (!fd.m) return; fd.m.st.cfg.balance = e.target.checked; fdRecalc(); });
  q('#fdTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; fd.tab = b.dataset.t; fdRender(); });
  q('#fdPrintPick').addEventListener('click', () => { const T = fdVis(); if (!T.length) return; fdPrintHtml(fdDocHtml(T, 'pick', fd.m.st), 'Picking lists'); addActivity('export', `Printed ${T.length} picking list(s)`); });
  q('#fdPrintDN').addEventListener('click', () => { const T = fdVis(); if (!T.length) return; fdPrintHtml(fdDocHtml(T, 'dn', fd.m.st), 'Delivery notes'); addActivity('export', `Printed ${T.length} delivery note(s)`); });
  q('#fdExpand').addEventListener('click', () => { if (!fd.m) return; const nm = (FD_TABS.find(t => t[0] === fd.tab) || [0, ''])[1].replace(/^\S+\s/, ''); fdExpandTables(document.querySelector('#fdBody'), 'F&D Plan · ' + nm + ' · ' + fd.date, fd.tab === 'batches'); });
  q('#fdTabFilter').addEventListener('input', e => { fd.tf = e.target.value; clearTimeout(tm); tm = setTimeout(() => { fdTabApply(); fdChips(); }, 150); });
  q('#fdChips').addEventListener('click', e => { const b = e.target.closest('[data-chip]'); if (b) fdChipClick(b.dataset.chip); });
  q('#fdTabExcel').addEventListener('click', () => { if (fd.m) a2Export(fdTabData()); }); q('#fdTabPrint').addEventListener('click', () => { if (fd.m) a2Print(fdTabData()); }); q('#fdTabEmail').addEventListener('click', () => { if (fd.m) a2Mail(fdTabData); });
  q('#fdExcel').addEventListener('click', () => { if (!fd.m) return; XLSX.writeFile(fdWorkbook(fd.m, fdVis()), `FDPlan_${fd.date}.xlsx`); addActivity('export', 'F&D plan Excel'); });
  const body = q('#fdBody');
  body.addEventListener('click', e => {
    const qa = e.target.closest('[data-qa]'); if (qa) { fdQtyBulk(qa.dataset.qa); return; }
    const qr = e.target.closest('[data-qr]'); if (qr) { fdLogAct = 'Reset'; try { fdActSet(qr.dataset.qr, null); } finally { fdLogAct = ''; } fdKeepScroll(fdRender); return; }
    if (e.target.closest('[data-qmore]')) { fd.qshown += 300; fdKeepScroll(fdRender); return; }
    const ab = e.target.closest('[data-addb]'); if (ab) { const pa = fdPoolEdit(fd.m.st, ab.dataset.addb); if (!pa.length) pa.push({ b: '', p: '', e: '', q: '' }); pa.push({ b: '', p: '', e: '', q: '' }); fdKeepScroll(fdRender); return; }
    const db = e.target.closest('[data-delb][data-bk]'); if (db) { const st = fd.m.st, k = db.dataset.bk, a = fdPoolEdit(st, k); a.splice(+db.dataset.delb, 1); if (!a.some(x => !fdBlank(x) || +x.q > 0)) { delete st.bl[k]; delete st.batch[k]; } fd.m.alloc = fdAlloc(fd.m); fdStSave(fd.date, st); fdKeepScroll(fdRender); return; }
    const op = e.target.closest('[data-open]'); if (op) { fdTripOpen(op.dataset.open); return; }
    const pk = e.target.closest('[data-pk]'), dn = e.target.closest('[data-dn]'); if (pk || dn) { const t = fd.m.byId.get((pk || dn).dataset.pk || (pk || dn).dataset.dn); if (t) fdPrintHtml(fdDocHtml([t], pk ? 'pick' : 'dn', fd.m.st), (pk ? 'Picking list ' : 'Delivery note ') + t.id); return; }
  });
  body.addEventListener('dblclick', e => {
    if (e.target.closest('select,input,button')) return;
    const tr = e.target.closest('tr.fd-click'); if (!tr) return; e.stopPropagation(); (window.getSelection || (() => ({})))().removeAllRanges && window.getSelection().removeAllRanges();
    if (tr.dataset.id) fdTripOpen(tr.dataset.id); else if (tr.dataset.loc) { fd.day = tr.dataset.day; fd.locs = [tr.dataset.loc]; fd.tab = 'trips'; fdPopulate(); fdRender(); }
  });
  body.addEventListener('change', e => {
    const i = e.target, st = fd.m.st;
    if (i.dataset.st) { st.status[i.dataset.st] = i.value; fdStSave(fd.date, st); fdKpis(); }
    else if (i.dataset.pv) { fd.pv = i.value; fdRender(); } else if (i.dataset.pm) { fd.pm = i.value; fdRender(); }
    else if (i.dataset.qk) { if (featBlock('fdedit')) { fdRender(); return; } const v = i.value.trim(); fdActSet(i.dataset.qk, v === '' ? null : Math.max(0, +v)); fdQtyRowRefresh(i.closest('tr')); }
    else if (i.dataset.qn) { const k = i.dataset.qn, v = i.value.trim(); if (v) st.actNote[k] = v; else delete st.actNote[k]; fdStSave(fd.date, st); }
    else if (i.dataset.qadj !== undefined) { fd.qadj = i.checked; fdRender(); }
    else if (i.dataset.bk && i.dataset.bi !== undefined) { const k = i.dataset.bk, f = i.dataset.f, bi = +i.dataset.bi, a = fdPoolEdit(st, k), v = i.value.trim(); while (a.length <= bi) a.push({ b: '', p: '', e: '', q: '' }); a[bi][f] = f === 'q' ? (v === '' ? '' : Math.max(0, +v)) : v;
      if (f === 'p' && v && st.cfg.shelf > 0 && !a[bi].e) { const d = new Date(fdDayMs(v) + st.cfg.shelf * 864e5).toISOString().slice(0, 10); a[bi].e = d; const ex = i.closest('.fdb').querySelector('[data-f=e]'); if (ex) ex.value = d; }
      if (!a.some(x => !fdBlank(x) || +x.q > 0)) { delete st.bl[k]; delete st.batch[k]; } fd.m.alloc = fdAlloc(fd.m); fdStSave(fd.date, st); fdKpis(); }
  });
  document.addEventListener('click', e => { if (e.target.closest('#teBody')) fdExpClick(e); }); document.addEventListener('change', e => { if (e.target.closest('#teBody')) fdExpChange(e); });
  document.addEventListener('click', e => { if (fd.expEdit && e.target.closest('#teClose')) { fd.expEdit = false; if (fd.m) fdRender(); } });
  document.addEventListener('click', e => { const b = e.target.closest('#teBody [data-open]'); if (b && fd.m) fdTripOpen(b.dataset.open); });
  document.addEventListener('dblclick', e => { const r = e.target.closest('#teBody tr[data-id]'); if (r && fd.m && !e.target.closest('button,input,select')) fdTripOpen(r.dataset.id); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && fd.open) fdTripClose(); });
  fdUpInit();
}

/* ---------- save ONE picking list (trip) to the SharePoint list set up on the F&D Picking Upload page ---------- */
function fdReasonWait() { return new Promise(res => { fdReasonAsk(); if (!document.querySelector('#fdRsModal')) return res(); const iv = setInterval(() => { if (!document.querySelector('#fdRsModal')) { clearInterval(iv); res(); } }, 200); }); }
async function fdSavePL() {
  const t = fd.m && fd.open ? fd.m.byId.get(fd.open) : null; if (!t) return; let cfg = {}; try { cfg = JSON.parse(localStorage.getItem(FDUP_CFG) || '{}'); } catch (e) {}
  const plOk = !!(cfg.list && Object.values(cfg.map || {}).some(v => v && v !== SKIP_VALUE)), lgc = fdlCfg(), lgOk = fdlCfgOk(lgc);
  if (!plOk && !lgOk) { sectionToast('Set up the two SharePoint lists once: the dispatched-plan list on F&D Picking Upload, and the change-log list on F&D Change Log → ☁ SharePoint lists.', 'warn'); return; }
  if (!hasPerm('uploader') && !hasPerm('fdplan-upload')) { sectionToast('You do not have permission to upload.', 'warn'); return; }
  const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) { sectionToast('Sign in with Microsoft / set the global Site URL first.', 'warn'); return; }
  if (plOk && (!isListVisible(cfg.list) || !isListEditable(cfg.list))) { sectionToast('No write access to "' + cfg.list + '".', 'warn'); return; }
  const rows = plOk ? fdUpRows({ m: fd.m, trip: t.id }) : []; if (plOk && !rows.length) { sectionToast('Nothing to save for this picking list.', 'warn'); return; }
  const pend0 = lgOk ? fdlGet().filter(x => x.tripId === t.id && x.plan === fd.date && !x.up) : [], sk = LS_BASE + '_fdsaved', S = (() => { try { return JSON.parse(localStorage.getItem(sk) || '{}'); } catch (e) { return {}; } })(), mk = fd.date + '|' + t.id + '|' + cfg.list;
  const ask = 'Save picking list ' + t.id + ' to SharePoint?\n\n' + (plOk ? '• "' + cfg.list + '": ' + plF(rows.length) + ' line(s) with the actual quantities\n' : '• Dispatched-plan list is not set up — skipped\n') + (lgOk ? '• "' + lgc.list + '": ' + pend0.length + ' change-log record(s)' : '• Change-log list is not set up — skipped') + (plOk && S[mk] ? '\n\n⚠ The picking list was already saved at ' + new Date(S[mk]).toLocaleString() + ' — saving again creates duplicate rows.' : '');
  if (!(await spAsk(ask))) return;
  const btn = document.querySelector('#fdTripModal [data-x="spsave"]'); if (btn) { btn.disabled = true; btn.textContent = '☁ Saving…'; } const msgs = []; let bad = false;
  try {
    if (lgOk && pend0.length) await fdReasonWait();
    if (plOk) { const { siteId, listId } = await resolveIds(siteUrl, cfg.list, token), active = Object.entries(cfg.map).filter(([, v]) => v && v !== SKIP_VALUE); let ok = 0, fail = 0, next = 0; const errs = [];
      const worker = async () => { while (next < rows.length) { const r = rows[next++], f = {}; active.forEach(([k, target]) => { const v = k === CURRENT_USER_FIELD_KEY ? getCurrentUserValue() : r[k]; if (v !== null && v !== undefined && v !== '') f[target] = v; }); if (!Object.keys(f).length) { fail++; continue; } try { await createItem(siteId, listId, f, token); ok++; } catch (e) { fail++; if (errs.length < 3) errs.push(r.code + ': ' + e.message); } if (btn) btn.textContent = '☁ Saving ' + (ok + fail) + '/' + rows.length; } };
      await Promise.all([worker(), worker(), worker()]); if (ok) { S[mk] = Date.now(); try { localStorage.setItem(sk, JSON.stringify(S)); } catch (e) {} } if (fail) bad = true; msgs.push(fail ? '⚠ picking list: ' + ok + ' saved, ' + fail + ' failed ' + errs.join(' | ') : '✅ picking list: ' + ok + ' line(s) → "' + cfg.list + '"'); try { w_logToActivity('F&D picking list ' + t.id + ' → "' + cfg.list + '": ' + ok + ' ok, ' + fail + ' failed'); } catch (e) {} }
    if (lgOk) { const P = fdlGet().filter(x => x.tripId === t.id && x.plan === fd.date && !x.up); if (btn) btn.textContent = '☁ Saving change log…'; const r = await fdLogPush(P); if (r.skipped) { bad = true; msgs.push('⚠ change log: ' + r.skipped); } else { if (r.fail) bad = true; msgs.push(r.fail ? '⚠ change log: ' + r.ok + ' saved, ' + r.fail + ' failed ' + r.errs.join(' | ') : '✅ change log: ' + r.ok + ' record(s) → "' + lgc.list + '"'); } }
    sectionToast(t.id + ' — ' + msgs.join('  ·  '), bad ? 'warn' : 'success');
  } catch (e) { sectionToast('✘ ' + e.message, 'error'); } finally { if (btn) { btn.disabled = false; btn.textContent = '☁ Save to SharePoint'; } try { fdLogRender(); } catch (e) {} }
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#fdTripModal [data-x="spsave"],#fdTripModal [data-x="chlog"]'); if (!b) return; e.stopPropagation(); e.preventDefault(); if (b.dataset.x === 'spsave') fdSavePL(); else { fdTripClose(); plGo('fdlog'); } }, true);
/* ---------- upload the picking lines to a SharePoint list ---------- */
const FDUP_CFG = LS_BASE + '_fdup_cfg';
const fdUp = { picker: null, cols: [], map: {}, siteId: null, listId: null, plans: new Map(), m: null };
const FD_FIELDS = [
  { key: 'batch', label: 'Batch no.', alias: ['batchno', 'batchnumber', 'batch', 'lot'] }, { key: 'prod', label: 'Production date', alias: ['productiondate', 'proddate', 'mfgdate', 'manufacturingdate'] }, { key: 'exp', label: 'Expiry date', alias: ['expirydate', 'expirationdate', 'expdate', 'expiry'] },
  { key: 'tripId', label: 'Trip / delivery note no.', alias: ['tripid', 'tripno', 'trip', 'deliverynote', 'dnno', 'dn'] }, { key: 'date', label: 'Dispatch date', alias: ['dispatchdate', 'plandate', 'deliverydate', 'date', 'day'] },
  { key: 'loc', label: 'Location', alias: ['location', 'loc', 'destination', 'branch'] }, { key: 'region', label: 'Region (NE / SE)', alias: ['region', 'area'] }, { key: 'trailerType', label: 'Trailer type', alias: ['trailertype', 'pallettype'] }, 
  { key: 'code', label: 'SKU code (ICODE)', alias: ['icode', 'sku', 'skucode', 'itemcode', 'code'] }, { key: 'item', label: 'Item description', alias: ['itemdesc', 'itemdescription', 'description', 'item'] }, { key: 'brand', label: 'Brand', alias: ['brand'] }, { key: 'category', label: 'Category', alias: ['category'] },
  { key: 'uom', label: 'UoM', alias: ['uom'] }, { key: 'qty', label: 'Actual quantity (units)', alias: ['quantity', 'qty', 'units', 'pickqty', 'actualqty', 'actual'] }, { key: 'rowType', label: 'Row type (Dispatch / Balance adjustment)', alias: ['rowtype', 'linetype', 'entrytype', 'transactiontype', 'movement', 'balancetype'] }, { key: 'demand', label: 'Demand quantity (units)', alias: ['demand', 'demandqty', 'plannedqty', 'orderedqty'] }, { key: 'crt', label: 'Crates', alias: ['crates', 'crt', 'cartons'] }, { key: 'pal', label: 'Pallets', alias: ['pallets', 'pallet'] }, { key: 'ltr', label: 'Litres', alias: ['litres', 'liters', 'ltr'] },
  { key: 'status', label: 'Trip status', alias: ['status', 'tripstatus'] }, { key: 'plate', label: 'Trailer plate', alias: ['trailerplate', 'plate', 'platenumber', 'vehicleno'] }, { key: 'driver', label: 'Driver', alias: ['driver', 'drivername'] }, { key: 'seal', label: 'Seal no.', alias: ['sealno', 'sealnumber', 'seal'] }, { key: 'trailerNo', label: 'Trailer sequence (n of N)', alias: ['trailersequence', 'trailerseq', 'trailerof', 'tripsequence'] },
  { key: 'file', label: 'Source file', alias: ['sourcefile', 'filename', 'file'] }, { key: 'at', label: 'Uploaded at', alias: ['uploadedat', 'uploaddate', 'timestamp'] }, currentUserOutputField()
];
function fdUpRows(o) {
  const m = (o && o.m) || fdUp.m; if (!m) return []; const day = o ? '' : PLQ('#fdUpDay').value, sc = o ? o.trip : PLQ('#fdUpTrip').value, at = new Date().toISOString(), out = [];
  m.trips.forEach(t => { if (day && t.day !== day) return; if (sc && sc !== t.id && sc !== 'loc:' + t.loc) return; const mt = m.st.meta[t.id] || {};
    t.lines.forEach(l => fdSegs(m.st, t, l).forEach(b => { const f = l.qty ? b.q / l.qty : 1; out.push({ tripId: t.id, date: t.day, loc: t.loc, region: t.region, trailerType: t.gl, trailerNo: `${t.no} of ${t.n}`, code: l.code, item: l.item, brand: l.brand, category: l.category, uom: l.uom0 || l.uom, qty: Math.round(b.q * 1000) / 1000, demand: Math.round(l.dem0 * f * 100) / 100, crt: Math.round(l.crt * f * 100) / 100, pal: Math.round(l.pal * f * 1000) / 1000, ltr: Math.round(l.ltr * f * 100) / 100, batch: b.b, prod: b.p, exp: b.e, status: m.st.status[t.id] || 'Planned', plate: mt.plate || '', driver: mt.driver || '', seal: mt.seal || '', file: m.snap.fileName, at, rowType: 'Dispatch' }); }));
    t.lines.forEach(l => { const ex = fdExtraM(m, l); if (ex > 1e-9 && m.st.bal[l.key] === 'yes') { const f = ex / l.qty; out.push({ tripId: t.id, date: t.day, loc: t.loc, region: t.region, trailerType: t.gl, trailerNo: `${t.no} of ${t.n}`, code: l.code, item: l.item, brand: l.brand, category: l.category, uom: l.uom0 || l.uom, qty: -Math.round(ex * 1000) / 1000, demand: 0, crt: -Math.round(l.crt * f * 100) / 100, pal: -Math.round(l.pal * f * 1000) / 1000, ltr: -Math.round(l.ltr * f * 100) / 100, batch: '', prod: '', exp: '', status: m.st.status[t.id] || 'Planned', plate: mt.plate || '', driver: mt.driver || '', seal: mt.seal || '', file: m.snap.fileName, at, rowType: 'Balance adjustment' }); } }); });
  return out;
}
function fdUpFill() {
  const q = s => PLQ(s), pl = q('#fdUpPlan'), prev = pl.value; fdSnapAll().then(all => {
    fdUp.plans = new Map(all.map(s => [s.planDate, s])); pl.innerHTML = all.slice().reverse().map(s => `<option value="${s.planDate}">${s.planDate} · ${s.days.map(dpDayLbl).join(', ')}</option>`).join('') || '<option value="">— no daily plan —</option>'; if (prev && fdUp.plans.has(prev)) pl.value = prev; fdUpPlan();
  });
}
function fdUpPlan() {
  const q = s => PLQ(s), s = fdUp.plans.get(q('#fdUpPlan').value); fdUp.m = s ? fdModel(s) : null; const dsel = q('#fdUpDay'), pd = dsel.value; if (!s) { dsel.innerHTML = ''; q('#fdUpTrip').innerHTML = ''; q('#fdUpInfo').textContent = ''; return; }
  dsel.innerHTML = '<option value="">All plan days</option>' + s.days.map(d => `<option value="${d}">${plEsc(dpDayLong(d))}</option>`).join(''); if (s.days.includes(pd)) dsel.value = pd; fdUpTripFill();
}
function fdUpTripFill() {
  const m = fdUp.m, day = PLQ('#fdUpDay').value, sel = PLQ('#fdUpTrip'), prev = sel.value; if (!m) return; const T = m.trips.filter(t => !day || t.day === day), locs = [...new Set(T.map(t => t.loc))];
  sel.innerHTML = `<option value="">All trips (${T.length})</option>` + locs.map(l => `<option value="loc:${l}">Location ${l} (${T.filter(t => t.loc === l).length})</option>`).join('') + T.map(t => `<option value="${t.id}">${t.id}</option>`).join(''); if ([...sel.options].some(o => o.value === prev)) sel.value = prev; fdUpInfo();
}
function fdUpInfo() { const rows = fdUpRows(), trips = new Set(rows.map(r => r.tripId)).size, nb = rows.filter(r => r.batch || r.prod || r.exp).length; const nbal = rows.filter(r => r.rowType === 'Balance adjustment').length, undec = (fdUp.m ? fdUp.m.trips : []).reduce((a, t) => a + fdExtraLines(fdUp.m, t).filter(x => !fdUp.m.st.bal[x.l.key]).length, 0); PLQ('#fdUpInfo').textContent = `${rows.length} list item(s) from ${trips} trip(s) will be created (one per trip line and batch) — ${nb} with batch / date details.` + (nbal ? ` ${nbal} of them are Balance-plan adjustments with a NEGATIVE quantity (items added above the plan).` : '') + (undec ? ` ⚠ ${undec} added / above-plan item(s) have no Balance Plan decision yet — open the trip in F&D Plan and choose Yes / No.` : ''); }
function fdUpRender() {
  const body = PLQ('#fdUpMapBody'); body.innerHTML = '';
  if (!fdUp.cols.length) { body.innerHTML = '<tr><td colspan="2" style="padding:16px;text-align:center;color:var(--gray-400);font-style:italic;">Pick a list and click 🔄 Load Columns to map fields.</td></tr>'; PLQ('#fdUpConfirm').disabled = true; return; }
  FD_FIELDS.forEach(f => { const tr = document.createElement('tr'); tr.innerHTML = `<td><strong>${plEsc(f.label)}</strong></td><td class="combo-cell"></td>`; tr.querySelector('.combo-cell').appendChild(buildCombo(fdUp.map[f.key] || SKIP_VALUE, fdUp.cols, nv => { fdUp.map[f.key] = nv; fdUpState(); })); body.appendChild(tr); });
  fdUpState();
}
function fdUpState() { try { localStorage.setItem(FDUP_CFG, JSON.stringify({ list: fdUp.picker ? fdUp.picker.getValue() : '', map: fdUp.map })); } catch (e) {} PLQ('#fdUpConfirm').disabled = !Object.values(fdUp.map).some(v => v && v !== SKIP_VALUE) || !fdUp.listId; }
function fdUpInit() {
  const q = s => PLQ(s); fdUp.picker = createListPicker(document.querySelector('[data-list-picker="fd-upload"]'), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: () => { fdUp.cols = []; fdUp.map = {}; fdUp.listId = null; fdUpRender(); } });
  q('#fdUpPlan').addEventListener('change', fdUpPlan); q('#fdUpDay').addEventListener('change', fdUpTripFill); q('#fdUpTrip').addEventListener('change', fdUpInfo); q('#fdUpOpen').addEventListener('click', () => plGo('fdplan'));
  q('#fdUpLoad').addEventListener('click', async () => {
    const listName = fdUp.picker.getValue(), token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(), st = q('#fdUpColsStatus');
    if (!listName || !token || !siteUrl) { st.textContent = '⚠ Pick a list and configure the global settings.'; return; }
    if (!isListVisible(listName)) { st.textContent = `✘ No permission to access "${listName}"`; return; } if (!isListEditable(listName)) { st.textContent = `✘ READ-ONLY access to "${listName}" — upload blocked`; return; }
    st.textContent = 'Loading...';
    try { const { siteId, listId } = await resolveIds(siteUrl, listName, token); fdUp.siteId = siteId; fdUp.listId = listId; const cols = await fetchColumns(siteId, listId, token); fdUp.cols = cols.filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase())); st.textContent = `✓ ${fdUp.cols.length} writable columns`; fdUpRender(); setTimeout(() => q('#fdUpAuto').click(), 0); } catch (err) { st.textContent = '✘ ' + err.message; }
  });
  q('#fdUpAuto').addEventListener('click', () => {
    if (!fdUp.cols.length) { q('#fdUpColsStatus').textContent = '⚠ Load columns first.'; return; }
    const nz = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, ''), used = new Set(), map = {};
    FD_FIELDS.forEach(f => { if (f.key === CURRENT_USER_FIELD_KEY) return; let hit = null;
      for (const pass of [0, 1]) { for (const al of f.alias) { hit = fdUp.cols.find(c => !used.has(c.name) && (pass === 0 ? (nz(c.name) === al || nz(c.displayName) === al) : (al.length >= 4 && (nz(c.name).includes(al) || nz(c.displayName).includes(al))))); if (hit) break; } if (hit) break; }
      if (hit) used.add(hit.name); map[f.key] = hit ? hit.name : SKIP_VALUE; });
    const uh = findCurrentUserColumn(fdUp.cols); map[CURRENT_USER_FIELD_KEY] = uh ? uh.name : SKIP_VALUE; fdUp.map = map; fdUpRender();
  });
  q('#fdUpReset').addEventListener('click', () => { fdUp.map = {}; fdUpRender(); });
  q('#fdUpConfirm').addEventListener('click', async () => {
    const st = q('#fdUpStatus'), rows = fdUpRows(); if (!fdUp.listId) { st.textContent = '⚠ Load columns first.'; return; } if (!rows.length) { st.textContent = '⚠ Nothing to upload for this selection.'; return; }
    if (!hasPerm('uploader') && !hasPerm('fdplan-upload')) { alert('Permission denied.'); return; }
    const active = Object.entries(fdUp.map).filter(([, v]) => v && v !== SKIP_VALUE); if (!active.length) { st.textContent = '⚠ Map at least one field.'; return; }
    const listName = (document.querySelector('[data-list-picker="fd-upload"] .list-picker-input') || {}).value || 'selected list', total = rows.length, key = q('#fdUpPlan').value + '|' + q('#fdUpDay').value + '|' + q('#fdUpTrip').value + '|' + fdUp.listId;
    if (!(await spAsk(`Upload ${plF(total)} picking line(s) to "${listName}"?` + (fdUp.done && fdUp.done[key] ? '\n\n⚠ This selection was already uploaded to this list in this session. Uploading again creates duplicate rows.' : '')))) return;
    const token = getGlobalAccessToken(), prog = q('#fdUpProg'); q('#fdUpConfirm').disabled = true; prog.style.display = 'block'; prog.max = total; prog.value = 0; let ok = 0, fail = 0, done = 0, next = 0; const errors = [];
    const worker = async () => { while (next < total) { const i = next++, r = rows[i], fields = {};
      active.forEach(([k, target]) => { const v = k === CURRENT_USER_FIELD_KEY ? getCurrentUserValue() : r[k]; if (v !== null && v !== undefined && v !== '') fields[target] = v; });
      if (!Object.keys(fields).length) { fail++; } else { try { await createItem(fdUp.siteId, fdUp.listId, fields, token); ok++; } catch (err) { fail++; if (errors.length < 5) errors.push(`${r.tripId}/${r.code}: ${err.message}`); } }
      done++; prog.value = done; st.textContent = `Uploading ${done} / ${total} · ✔ ${ok} · ✘ ${fail}`; } };
    await Promise.all([worker(), worker(), worker()]);
    q('#fdUpConfirm').disabled = false; if (ok) { fdUp.done = fdUp.done || {}; fdUp.done[key] = 1; }
    st.textContent = fail ? `⚠ ${ok} uploaded, ${fail} failed. ${errors.slice(0, 2).join(' | ')}` : `✅ Uploaded ${plF(ok)} picking line(s) to "${listName}".`;
    w_logToActivity(`F&D picking lines ${q('#fdUpPlan').value} → "${listName}": ${ok} ok, ${fail} failed`);
    if (fail) notifyFailure('F&D Plan Upload Failure', `${fail} failure(s) uploading to "${listName}".\n\n${errors.slice(0, 5).join('\n')}`);
  });
  fdUpRender(); fdUpFill();
}
document.querySelectorAll('.nav-item[data-view="fdplan"],.nav-item[data-view="fdplan-upload"]').forEach(n => n.addEventListener('click', () => { fdInit(); if (n.dataset.view === 'fdplan') setTimeout(fdOpen, 0); else fdUpFill(); }));

/* ============================================================
   F&D DEMAND — weekly + daily demand plans: upload, setup, comparison with each other and with the actual quantities
   ============================================================ */
const FDM_KEY = LS_BASE + '_fddm';
const FDM_DEF = { map: [{ loc: 'ALN', region: 'AL AIN', grp: 'SE' }, { loc: 'AUH', region: 'ABU DHABI', grp: 'SE' }, { loc: 'TRF', region: 'TARIFF', grp: 'SE' }, { loc: 'SHJ', region: 'SHARJAH', grp: 'NE' }, { loc: 'RAK', region: 'RAS AL KHAIMAH', grp: 'NE' }, { loc: 'FUJ', region: 'FUJAIRAH', grp: 'NE' }, { loc: 'DXB', region: 'DUBAI', grp: 'NE' }, { loc: 'UT', region: 'UT', grp: 'NE' }], types: { Final: true, Tentative: true, Delist: false, '(blank)': true }, tol: 10 };
const fdm = { cfg: null, tab: 'up', weeks: [], dailies: [], wSel: '', dSel: '', day: '', regs: [], q: '', by: 'item', met: 'units', sort: 'label', onlyDiff: false, shown: 200, pW: '', pBy: 'item', pMet: 'units', pQ: '', pShown: 200, rDays: [], rNZ: true, rShown: 200, up: { d: null, w: null }, inited: false };
const FDM_TABS = [['up', '📥 Upload'], ['setup', '⚙ Setup'], ['cmp', '🆚 Weekly vs daily vs actual'], ['prod', '🏭 Production vs distribution']];
function fdmCfg() { if (fdm.cfg) return fdm.cfg; let o = {}; try { o = JSON.parse(localStorage.getItem(FDM_KEY) || '{}'); } catch (e) {} fdm.cfg = { map: Array.isArray(o.map) && o.map.length ? o.map : JSON.parse(JSON.stringify(FDM_DEF.map)), types: Object.assign({}, FDM_DEF.types, o.types || {}), tol: isFinite(+o.tol) && o.tol !== '' && o.tol != null ? +o.tol : FDM_DEF.tol }; return fdm.cfg; }
const fdmSave = () => { try { localStorage.setItem(FDM_KEY, JSON.stringify(fdm.cfg)); } catch (e) {} };
const fdmN = (v, d) => v == null ? '' : plF(v, d == null ? 0 : d);
const fdmQ = v => { const r = Math.round(v * 100) / 100; return plF(r, Number.isInteger(r) ? 0 : 2); };

/* ---------- weekly plans: stored in this browser (IndexedDB) ---------- */
const FW_MEM = new Map();
function fwIdb() { return new Promise(res => { try { const r = indexedDB.open('nfpc_fdweekly', 1); r.onupgradeneeded = () => r.result.createObjectStore('w', { keyPath: 'weekStart' }); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }); }
async function fwPut(w) { const db = await fwIdb(); if (!db) { FW_MEM.set(w.weekStart, w); return; } await new Promise((ok, no) => { const tx = db.transaction('w', 'readwrite'); tx.objectStore('w').put(w); tx.oncomplete = ok; tx.onerror = () => no(tx.error); }); }
async function fwAll() { const db = await fwIdb(); if (!db) return [...FW_MEM.values()]; return new Promise(ok => { const rq = db.transaction('w').objectStore('w').getAll(); rq.onsuccess = () => ok(rq.result || []); rq.onerror = () => ok([]); }); }
async function fwDel(k) { const db = await fwIdb(); if (!db) { FW_MEM.delete(k); return; } await new Promise(ok => { const tx = db.transaction('w', 'readwrite'); tx.objectStore('w').delete(k); tx.oncomplete = ok; tx.onerror = ok; }); }

/* ---------- reading the weekly sheet ---------- */
function fwParseSheet(ws, fileName) {
  if (!ws || !ws['!ref']) throw new Error('The first sheet is empty.');
  const ref = XLSX.utils.decode_range(ws['!ref']), nC = ref.e.c + 1, nR = ref.e.r + 1, g = (r, c) => plCellVal(ws[XLSX.utils.encode_cell({ r, c })]), num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  let H = -1; for (let r = 0; r <= Math.min(nR - 1, 40); r++) { const v = g(r, 0); if (typeof v === 'string' && dpNorm(v) === 'icode') { H = r; break; } }
  if (H < 0) throw new Error('Could not find the header row (a cell “ICODE” in column A). Is this the weekly demand / production order sheet?');
  const WI = { 'icode': 'code', 'item_desc': 'item', 'prod_in': 'prodIn', 'type': 'type', 'demand tyoe': 'dtype', 'demand type': 'dtype', 'pc per crt': 'pcsCrt', 'crt per pallet': 'crtPallet', 'mechine': 'machine', 'machine': 'machine', 'covn': 'conv', 'brand': 'brand', 'category': 'category', 'sub_categ': 'sub', 'uom': 'uom', 'fill_size': 'fill' }, col = {};
  for (let c = 0; c < nC; c++) { const v = g(H, c); if (typeof v === 'string' && WI[dpNorm(v)] && col[WI[dpNorm(v)]] == null) col[WI[dpNorm(v)]] = c; }
  if (col.code == null || col.item == null) throw new Error('The ICODE / ITEM_DESC columns were not found.');
  const blocks = []; let cur = null;
  for (let c = Math.max.apply(null, Object.values(col)) + 1; c < nC; c++) { const v = g(H, c);
    if (v instanceof Date) { if (!cur) cur = { dates: [] }; cur.dates.push({ c, iso: dpIso(v) }); }
    else if (typeof v === 'string' && /^total$/i.test(v.trim())) { if (cur) { cur.tot = c; blocks.push(cur); cur = null; } }
    else if (cur && v != null) { blocks.push(cur); cur = null; } }
  if (cur && cur.dates.length) blocks.push(cur);
  if (!blocks.length) throw new Error('No day columns (dates followed by TOTAL) were found to the right of the item columns.');
  blocks.forEach((b, i) => { b.label = ''; const e = b.tot != null ? b.tot : b.dates[b.dates.length - 1].c; for (let c = b.dates[0].c; c <= e && !b.label; c++) { const t = H > 0 ? g(H - 1, c) : null; if (typeof t === 'string' && t.trim()) b.label = t.replace(/\s+/g, ' ').trim().toUpperCase(); } if (!b.label) b.label = 'BLOCK ' + (i + 1); });
  const pBlk = blocks.find(b => /production/i.test(b.label)) || null, dist = blocks.filter(b => b !== pBlk), ref0 = pBlk || blocks[0], days = ref0.dates.map(d => d.iso), warnings = [];
  const colOf = (b, iso) => { const f = b.dates.find(d => d.iso === iso); return f ? f.c : null; };
  if (!pBlk) warnings.push({ level: 'warn', text: 'No “PRODUCTION PLAN” block was found — only the distribution plans are read.' });
  if (!dist.length) warnings.push({ level: 'warn', text: 'No regional distribution block was found.' });
  const items = [], seen = new Set(); let pending = [], dups = 0, mism = 0;
  for (let r = H + 1; r < nR; r++) {
    const code = g(r, col.code); if (code == null || String(code).trim() === '') continue; const cs = String(code).trim();
    if (/grand\s*total/i.test(cs)) { const nm = g(r, col.item); if (typeof nm === 'string' && nm.trim()) pending.forEach(it => { it.company = nm.replace(/\s+/g, ' ').trim(); }); pending = []; continue; }
    const itx = g(r, col.item); if (itx == null) continue;
    const t = k => { const v = col[k] == null ? null : g(r, col[k]); return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); };
    const it = { code: cs, item: t('item'), prodIn: t('prodIn'), type: t('type'), dtype: t('dtype'), pcsCrt: col.pcsCrt == null ? null : num(g(r, col.pcsCrt)), crtPallet: col.crtPallet == null ? null : num(g(r, col.crtPallet)), machine: t('machine'), conv: t('conv'), brand: t('brand'), category: t('category'), sub: t('sub'), uom: t('uom'), fill: t('fill'), company: '', prod: days.map(() => 0), reg: {} };
    if (pBlk) days.forEach((d, k) => { const c = colOf(pBlk, d); it.prod[k] = c == null ? 0 : (num(g(r, c)) || 0); });
    dist.forEach(b => { it.reg[b.label] = days.map(d => { const c = colOf(b, d); return c == null ? 0 : (num(g(r, c)) || 0); }); });
    if (pBlk && pBlk.tot != null) { const tv = num(g(r, pBlk.tot)), sm = it.prod.reduce((a, b2) => a + b2, 0); if (tv != null && Math.abs(tv - sm) > Math.max(1, Math.abs(tv) * 0.005)) mism++; }
    if (seen.has(cs)) dups++; seen.add(cs); items.push(it); pending.push(it);
  }
  if (!items.length) throw new Error('No SKU rows were found under the header.');
  if (dups) warnings.push({ level: 'warn', text: `${dups} SKU code(s) appear more than once — their quantities are added together when compared.` });
  if (mism) warnings.push({ level: 'info', text: `${mism} SKU(s) have a production TOTAL that differs from the sum of their days — the days are used.` });
  const dl = items.filter(i => /delist/i.test(i.dtype)).length; if (dl) warnings.push({ level: 'info', text: `${dl} SKU(s) are marked “Delist”. They are excluded from the comparison unless ticked in Setup.` });
  return { v: 1, kind: 'fdweekly', weekStart: days[0], weekEnd: days[days.length - 1], days, regions: dist.map(b => b.label), hasProd: !!pBlk, items, fileName: fileName || '', warnings, savedAt: null, savedBy: '' };
}

/* ---------- upload tab ---------- */
const fdmStat = (id, msg, type) => { const el = PLQ(id); el.className = 'status-msg ' + (type || 'info'); el.textContent = msg; };
async function fdmReadSheet(f) {
  if (typeof XLSX === 'undefined' || !XLSX.read) throw new Error('The Excel library is not loaded (check the internet connection).');
  const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true }); let ws = wb.Sheets[wb.SheetNames[0]];
  for (const n of wb.SheetNames) { const sh = wb.Sheets[n]; if (sh && sh['!ref'] && !(wb.Workbook && wb.Workbook.Sheets && wb.Workbook.Sheets.find(x => x.name === n && x.Hidden))) { ws = sh; break; } } return ws;
}
const fdmWarn = w => (w || []).length ? `<ul style="margin:6px 0 0 18px;padding:0;font-size:12px;color:var(--gray-700)">${w.slice(0, 8).map(x => `<li style="color:${x.level === 'warn' ? '#b45309' : 'var(--gray-600)'}">${plEsc(x.text)}</li>`).join('')}</ul>` : '';
function fdmSumDaily() {
  const s = fdm.up.d, host = PLQ('#fdmSumD'); if (!s) { host.innerHTML = ''; return; } const L = s.locs.length, tot = (d, m) => s.rows.reduce((a, o) => a + (((o.v[m] || {})[d] || [])[L + 2] || 0), 0);
  host.innerHTML = `<div class="fd-sub"><b>${plF(s.rows.length)}</b> SKU rows · <b>${s.days.length}</b> day(s) · locations ${plEsc(s.locs.join(', '))}</div><div class="fd-wrap" style="max-height:180px"><table class="fd-tbl"><thead><tr><th>Day</th><th class="n">Demand (units)</th><th class="n">Crates</th><th class="n">Pallets</th></tr></thead><tbody>${s.days.map(d => `<tr><td>${plEsc(dpDayLong(d))}</td><td class="n">${fdmN(tot(d, 'dem'))}</td><td class="n">${fdmN(tot(d, 'crt'))}</td><td class="n">${fdmN(tot(d, 'pal'), 1)}</td></tr>`).join('')}</tbody></table></div>${fdmWarn(s.warnings)}
    <div class="form-grid three" style="margin-top:8px;align-items:end"><div class="form-group"><label>Plan date <span class="hint">the first day of the file</span></label><input type="date" id="fdmDPD" value="${plEsc(s.planDate || s.days[0] || '')}"></div><div class="form-group"><label>&nbsp;</label><label class="text-sm" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="fdmDSP" style="width:auto;margin:0"> also save to SharePoint (${plEsc(dpCfg().folder)})</label></div><div class="form-group"><label>&nbsp;</label><button id="fdmSaveD" class="success" type="button">💾 Save daily plan</button></div></div>`;
}
function fdmSumWeekly() {
  const w = fdm.up.w, host = PLQ('#fdmSumW'); if (!w) { host.innerHTML = ''; return; } const cfg = fdmCfg();
  const types = {}; w.items.forEach(i => { const k = i.dtype || '(blank)'; types[k] = (types[k] || 0) + 1; });
  const row = (d, k) => { const p = w.items.reduce((a, i) => a + i.prod[k], 0), ds = w.items.reduce((a, i) => a + w.regions.reduce((b, r) => b + ((i.reg[r] || [])[k] || 0), 0), 0); return [p, ds]; };
  host.innerHTML = `<div class="fd-sub"><b>${plF(w.items.length)}</b> SKUs · ${plEsc(w.weekStart)} → ${plEsc(w.weekEnd)} · regions ${plEsc(w.regions.join(', '))}<br>Demand types: ${Object.entries(types).map(([k, v]) => `${plEsc(k)} ${v}`).join(' · ')}</div><div class="fd-wrap" style="max-height:200px"><table class="fd-tbl"><thead><tr><th>Day</th><th class="n">Production plan</th><th class="n">Distribution (all regions)</th><th class="n">Balance</th></tr></thead><tbody>${w.days.map((d, k) => { const [p, ds] = row(d, k); return `<tr><td>${plEsc(dpDayLong(d))}</td><td class="n">${fdmN(p)}</td><td class="n">${fdmN(ds)}</td><td class="n" style="color:${p - ds < 0 ? '#d03b3b' : ''}">${fdmN(p - ds)}</td></tr>`; }).join('')}</tbody></table></div>${fdmWarn(w.warnings)}
    <div class="btn-row" style="margin-top:8px"><button id="fdmSaveW" class="success" type="button">💾 Save weekly plan</button><span class="text-sm" style="color:var(--gray-600)">Saved in this browser, like the other uploaded plans.</span></div>`;
}
async function fdmFile(f, kind) {
  if (!f) return; const id = kind === 'd' ? '#fdmStatD' : '#fdmStatW'; fdmStat(id, 'Reading ' + f.name + '…', 'info');
  try { const ws = await fdmReadSheet(f);
    if (kind === 'd') { fdm.up.d = dpParseSheet(ws, f.name); fdmStat(id, `✓ ${fdm.up.d.rows.length} SKU rows and ${fdm.up.d.days.length} day(s) read. Check the summary, then save.`, 'success'); fdmSumDaily(); }
    else { fdm.up.w = fwParseSheet(ws, f.name); fdmStat(id, `✓ ${fdm.up.w.items.length} SKUs and ${fdm.up.w.days.length} day(s) read. Check the summary, then save.`, 'success'); fdmSumWeekly(); }
  } catch (e) { fdm.up[kind] = null; (kind === 'd' ? fdmSumDaily : fdmSumWeekly)(); fdmStat(id, '✘ ' + e.message, 'error'); }
}
const fdmCanUp = () => hasPerm('fdplan-upload') || hasPerm('uploader') || hasPerm('dailyplan-upload');
async function fdmSaveDaily() {
  const s = fdm.up.d; if (!s) return; if (!fdmCanUp()) { alert('Permission denied.'); return; } const d = PLQ('#fdmDPD').value; if (!d) { sectionToast('Enter the plan date.', 'warn'); return; } s.planDate = d;
  const old = await dpGet(d); if (old && !confirm(`A daily plan for ${d} already exists (saved ${old.savedAt ? new Date(old.savedAt).toLocaleString() : ''}). Replace it?\n\nQuantities you adjusted in F&D Plan for that date are kept.`)) return;
  s.savedAt = Date.now(); s.savedBy = (typeof currentUser !== 'undefined' && currentUser && (currentUser.username || currentUser.email)) || '';
  try { await dpPut(s); } catch (e) { fdmStat('#fdmStatD', '✘ ' + e.message, 'error'); return; }
  let extra = ''; if (PLQ('#fdmDSP') && PLQ('#fdmDSP').checked) { try { await dpSpSave(s); s.remote = true; await dpPut(s); extra = ' and in SharePoint'; } catch (e) { extra = ' (SharePoint: ' + e.message + ')'; } }
  addActivity('upload', `F&D daily demand ${d}: ${s.rows.length} SKUs, ${s.days.length} day(s) (${s.fileName})`); dpCfgSave({ sel: d }); fdm.dSel = d; fdm.up.d = null; fdmSumDaily(); fdmStat('#fdmStatD', `✅ Daily plan ${d} saved${extra}. F&D Plan will now use it.`, 'success'); await fdmReload(); fdmRender();
}
async function fdmSaveWeekly() {
  const w = fdm.up.w; if (!w) return; if (!fdmCanUp()) { alert('Permission denied.'); return; }
  const old = (await fwAll()).find(x => x.weekStart === w.weekStart); if (old && !confirm(`A weekly plan starting ${w.weekStart} already exists (saved ${old.savedAt ? new Date(old.savedAt).toLocaleString() : ''}). Replace it?`)) return;
  w.savedAt = Date.now(); w.savedBy = (typeof currentUser !== 'undefined' && currentUser && (currentUser.username || currentUser.email)) || '';
  try { await fwPut(w); } catch (e) { fdmStat('#fdmStatW', '✘ ' + e.message, 'error'); return; }
  addActivity('upload', `F&D weekly demand ${w.weekStart} → ${w.weekEnd}: ${w.items.length} SKUs (${w.fileName})`); fdm.wSel = w.weekStart; fdm.up.w = null; fdmSumWeekly(); fdmStat('#fdmStatW', `✅ Weekly plan ${w.weekStart} → ${w.weekEnd} saved.`, 'success'); await fdmReload(); fdmRender();
}
async function fdmReload() {
  fdm.weeks = (await fwAll()).filter(w => w && w.weekStart && w.items).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  fdm.dailies = (await dpAll()).filter(s => s && s.planDate && s.rows && s.days).sort((a, b) => a.planDate.localeCompare(b.planDate));
  if (!fdm.weeks.some(w => w.weekStart === fdm.wSel)) fdm.wSel = fdm.weeks.length ? fdm.weeks[fdm.weeks.length - 1].weekStart : '';
  if (!fdm.dailies.some(s => s.planDate === fdm.dSel)) fdm.dSel = fdm.dailies.length ? fdm.dailies[fdm.dailies.length - 1].planDate : '';
  if (!fdm.weeks.some(w => w.weekStart === fdm.pW)) fdm.pW = fdm.wSel;
}
function fdmLists() {
  const sv = x => x ? new Date(x).toLocaleString() : '';
  PLQ('#fdmListD').innerHTML = fdm.dailies.slice().reverse().map(s => `<tr><td><b>${plEsc(s.planDate)}</b></td><td>${plEsc(s.days.map(dpDayLbl).join(', '))}</td><td class="n">${s.rows.length}</td><td>${plEsc(s.fileName || '')}</td><td>${plEsc(sv(s.savedAt))}</td><td style="white-space:nowrap"><button class="ghost small" data-dc="${plEsc(s.planDate)}" type="button">🆚 Compare</button> <button class="ghost small" data-dopen="${plEsc(s.planDate)}" type="button">🚛 F&amp;D Plan</button> <button class="ghost small" data-ddel="${plEsc(s.planDate)}" type="button">✖</button></td></tr>`).join('') || '<tr><td colspan="6" class="pl-empty">No daily plan saved yet.</td></tr>';
  PLQ('#fdmListW').innerHTML = fdm.weeks.slice().reverse().map(w => `<tr><td><b>${plEsc(w.weekStart)} → ${plEsc(w.weekEnd)}</b></td><td class="n">${w.items.length}</td><td>${plEsc(w.fileName || '')}</td><td>${plEsc(sv(w.savedAt))}</td><td style="white-space:nowrap"><button class="ghost small" data-wc="${plEsc(w.weekStart)}" type="button">🆚 Compare</button> <button class="ghost small" data-wp="${plEsc(w.weekStart)}" type="button">🏭 Production</button> <button class="ghost small" data-wdel="${plEsc(w.weekStart)}" type="button">✖</button></td></tr>`).join('') || '<tr><td colspan="5" class="pl-empty">No weekly plan saved yet.</td></tr>';
}

