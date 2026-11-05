

/* ---------- top-bar refresh button works on every page ---------- */
function refreshLocalView(view) {
  const old = new Set(['planning', 'dailyplan', 'uploader', 'warehouse', 'dailytracker', 'incupload', 'exporter', 'emailer', 'editor', 'scheduler', 'scheduler-upload']); if (old.has(view)) return false;
  const tok = getGlobalAccessToken() && getGlobalSiteUrl(); let what = 'this page';
  try {
    if (view === 'otrules') { atInit(); a2Bump(); a2RulesSync(); a2RulesSummary(); roOpen(); what = 'the overtime rules, time slots and breaks'; }
    else if (view === 'att') { a2EAuto(true); a2Bump(); atLoad(); atRefresh(true); what = 'attendance analytics'; }
    else if (view === 'brkplan' || view === 'leaveplan') { roOpen(); what = view === 'leaveplan' ? 'the annual leave planner' : 'the smart break planner'; }
    else if (view === 'roster') { roRender(); if (ro.tab === 'spstaff' && tok) roSpLoad(); what = 'the staff roster'; }
    else if (view === 'mgt') { mgInit(); a2EAuto(true); if (mg.cfg.src !== 'sp') mgApplySrc(true); if (tok && mg.cfg.list.daily && mgMapOk('daily')) mgLoad(false); else mgRefresh(); what = 'the Mngt Daily Report'; }
    else { listsCache.clear(); const n = document.querySelector(`.nav-item[data-view="${view}"]`); if (n) n.click(); }
  } catch (e) { sectionToast('Refresh failed: ' + e.message, 'warn'); return true; }
  sectionToast(`🔄 Refreshed ${what}.`, 'ok'); return true;
}

/* ============================================================
   FOC RELEASE VOUCHER — entry, signatures, history, print / email / expand, SharePoint upload
   ============================================================ */
const FC_DB = 'nfpc_foc_db', FC_LSK = LS_BASE + '_foc';
const fc = { list: [], cur: null, saved: '', tab: 'form', q: [], st: [], from: '', to: '', mode: 'v', upState: '', upMode: 'hdr', shown: 200, inited: false, loaded: false, sel: new Set() };
const FC_ST = ['Draft', 'Pending approval', 'Approved', 'Released', 'Cancelled'];
const FC_STCOL = { 'Draft': '#64748b', 'Pending approval': '#d97706', 'Approved': '#0b7a0b', 'Released': '#1d4ed8', 'Cancelled': '#b42318' };
const FC_ROLES = [['req', 'Requester', 'Requested by'], ['iss', 'Issuer', 'Issued by (storekeeper)'], ['apr', 'Approver', 'Approved by']];
const FC_REASONS = ['Promotion / sampling', 'Marketing activity', 'Customer replacement', 'Damaged / quality compensation', 'Donation / charity', 'Staff / internal use', 'Trade terms (free goods)', 'Other'];
const fcE = plEsc, fcPad = n => String(n).padStart(2, '0');
const fcNowIso = () => { const d = new Date(); return `${d.getFullYear()}-${fcPad(d.getMonth() + 1)}-${fcPad(d.getDate())} ${fcPad(d.getHours())}:${fcPad(d.getMinutes())}`; };
const fcToday = () => fcNowIso().slice(0, 10);
const fcUser = () => (typeof currentUser !== 'undefined' && currentUser && (currentUser.username || currentUser.email)) || 'user';
const fcNum = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };

/* ---------- storage (IndexedDB, falls back to localStorage) ---------- */
let fcDb = null;
function fcIdb() { return new Promise(res => { try { const r = indexedDB.open(FC_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('v', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null); } catch (e) { res(null); } }); }
async function fcLoadAll() { fcDb = await fcIdb(); if (fcDb) return new Promise(res => { try { const q = fcDb.transaction('v').objectStore('v').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); } catch (e) { res([]); } }); try { return JSON.parse(localStorage.getItem(FC_LSK) || '[]'); } catch (e) { return []; } }
function fcLsSave() { try { localStorage.setItem(FC_LSK, JSON.stringify(fc.list)); } catch (e) { sectionToast('Browser storage is full — download a backup from the History tab.', 'warn'); } }
function fcPut(v) { if (fcDb) { try { fcDb.transaction('v', 'readwrite').objectStore('v').put(JSON.parse(JSON.stringify(v))); } catch (e) { sectionToast('Could not save to the browser database: ' + e.message, 'warn'); } } else fcLsSave(); }
function fcRm(id) { if (fcDb) { try { fcDb.transaction('v', 'readwrite').objectStore('v').delete(id); } catch (e) {} } else fcLsSave(); }

/* ---------- model ---------- */
const fcBlankItem = () => ({ sku: '', desc: '', uom: 'PC', qty: '', batch: '', expiry: '', remarks: '' });
const fcBlankP = () => ({ name: '', title: '', sig: '', at: '' });
function fcNextNo(date) { const y = String(date || fcToday()).slice(0, 4); let mx = 0; fc.list.forEach(v => { const m = /^FOC-(\d{4})-(\d+)$/.exec(v.no || ''); if (m && m[1] === y) mx = Math.max(mx, +m[2]); }); return `FOC-${y}-${String(mx + 1).padStart(4, '0')}`; }
function fcBlank() { const n = fcNowIso(); const v = { id: 'fc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), no: '', date: n.slice(0, 10), time: n.slice(11), status: 'Draft', wh: '', dept: '', reason: '', recip: '', ref: '', notes: '', req: fcBlankP(), iss: fcBlankP(), apr: fcBlankP(), items: [fcBlankItem()], evid: [], created: n, createdBy: fcUser(), updated: '', log: [], up: null }; v.no = fcNextNo(v.date); return v; }
const fcSig = v => ['req', 'iss', 'apr'].filter(k => v[k] && v[k].sig).length;
const fcLines = v => (v.items || []).filter(i => String(i.sku || '').trim() && fcNum(i.qty) > 0);
const fcQty = v => fcLines(v).reduce((a, i) => a + fcNum(i.qty), 0);
const fcSnap = v => JSON.stringify([v.no, v.date, v.time, v.status, v.wh, v.dept, v.reason, v.recip, v.ref, v.notes, v.req, v.iss, v.apr, v.items, (v.evid || []).map(e => e.id + e.kind)]);
const fcDirty = () => fc.cur && fcSnap(fc.cur) !== fc.saved;
function fcLog(v, text) { v.log = v.log || []; v.log.push({ at: fcNowIso(), by: fcUser(), text }); }
function fcDescFor(sku) { const s = String(sku || '').trim(); if (!s) return ''; const ti = fcTab.items.get(s.toLowerCase()); if (ti && ti.desc) return ti.desc; let d = ''; try { if (typeof wUom_desc === 'function') d = wUom_desc(s); } catch (e) {} if (d) return d; const k = s.toLowerCase(); for (let i = fc.list.length - 1; i >= 0; i--) { const it = (fc.list[i].items || []).find(x => String(x.sku).trim().toLowerCase() === k && x.desc); if (it) return it.desc; } return ''; }

/* ---------- form ---------- */
const fcQ = s => PLQ(s);
function fcDatalists() {
  const uniq = (a, n) => [...new Set(a.filter(Boolean).map(String))].sort((x, y) => x.localeCompare(y)).slice(0, n || 400), L = fc.list, set = (id, a) => { const el = fcQ(id); if (el) el.innerHTML = a.map(v => `<option value="${fcE(v)}">`).join(''); };
  let wh = []; try { wh = (rkS.reg.stores || []).map(s => s.no); } catch (e) {} set('#fcWhList', uniq(wh.concat(L.map(v => v.wh))));
  set('#fcDeptList', uniq(L.map(v => v.dept).concat(['Sales', 'Marketing', 'Supply Chain', 'Warehouse', 'Finance', 'Quality']))); set('#fcReasonList', uniq(FC_REASONS.concat(L.map(v => v.reason)))); set('#fcRecipList', uniq(L.map(v => v.recip)));
  let sk = L.flatMap(v => (v.items || []).map(i => i.sku)); try { if (wUomState && wUomState.table && wUomState.table.size) sk = sk.concat([...wUomState.table.keys()].slice(0, 20000).map(k => String(k).toUpperCase())); } catch (e) {} try { fcTab.items.forEach(v => sk.push(v.sku)); } catch (e) {} set('#fcSkuList', uniq(sk, 20000));
  let nm = L.flatMap(v => [v.req, v.iss, v.apr].map(p => p && p.name)); try { nm = nm.concat(ro.staff.map(s => s.name)); } catch (e) {} set('#fcNameList', uniq(nm, 800));
  let tt = L.flatMap(v => [v.req, v.iss, v.apr].map(p => p && p.title)); try { tt = tt.concat(ro.staff.map(s => s.role)); } catch (e) {} set('#fcTitleList', uniq(tt, 200));
  if (!fcQ('#fcUomList')) { const d = document.createElement('datalist'); d.id = 'fcUomList'; d.innerHTML = ['PC', 'CTN', 'PAL', 'BOX', 'KG', 'L', 'SET', 'PACK'].map(u => `<option value="${u}">`).join(''); fcQ('#view-foc').appendChild(d); }
}
function fcItemsRender(focusLast) {
  const v = fc.cur; fcQ('#fcItems').innerHTML = v.items.map((it, i) => `<tr data-i="${i}"><td><input data-f="sku" list="fcSkuList" value="${fcE(it.sku)}" style="min-width:120px"></td><td><input data-f="desc" value="${fcE(it.desc)}" style="min-width:220px"></td><td><input data-f="uom" list="fcUomList" value="${fcE(it.uom)}" style="width:70px"></td><td><input data-f="qty" type="number" min="0" step="any" value="${fcE(it.qty)}" style="width:90px;text-align:right"></td><td><input data-f="batch" list="fcBatchList" value="${fcE(it.batch)}" style="width:110px"></td><td><input data-f="expiry" type="date" value="${fcE(it.expiry)}"></td><td><input data-f="remarks" value="${fcE(it.remarks)}" style="min-width:140px"></td><td><button type="button" class="ghost small" data-rm="${i}" title="Remove line">✖</button></td></tr>`).join('');
  fcTot(); if (focusLast) { const r = fcQ('#fcItems').lastElementChild; if (r) r.querySelector('input').focus(); }
}
function fcTot() { const v = fc.cur; fcQ('#fcTot').textContent = `— ${fcLines(v).length} line(s) · total qty ${plF(fcQty(v), 2)}`; }
function fcWrite() {
  const v = fc.cur, q = fcQ; q('#fcNo').value = v.no; q('#fcDate').value = v.date; q('#fcTime').value = v.time; q('#fcStatus').value = v.status; q('#fcWh').value = v.wh; q('#fcDept').value = v.dept; q('#fcReason').value = v.reason; q('#fcRecip').value = v.recip; q('#fcRef').value = v.ref; q('#fcNotes').value = v.notes;
  const ex = fc.list.some(x => x.id === v.id); q('#fcFormTitle').textContent = ex ? `Voucher ${v.no}` : 'New voucher'; fcPill(); fcItemsRender(); fcSigsRender(); fcLogRender(); fcEvRender();
  ['#fcDup', '#fcDel'].forEach(s => q(s).disabled = !ex); q('#fcUp').disabled = !ex;
}
function fcPill() { const v = fc.cur, p = fcQ('#fcStatusPill'); p.textContent = v.status + (fcSig(v) ? ` · ${fcSig(v)}/3 signed` : ''); p.style.background = FC_STCOL[v.status] + '22'; p.style.color = FC_STCOL[v.status]; }
function fcRead() { const v = fc.cur, q = fcQ; v.no = q('#fcNo').value.trim(); v.date = q('#fcDate').value; v.time = q('#fcTime').value; v.status = q('#fcStatus').value; v.wh = q('#fcWh').value.trim(); v.dept = q('#fcDept').value.trim(); v.reason = q('#fcReason').value.trim(); v.recip = q('#fcRecip').value.trim(); v.ref = q('#fcRef').value.trim(); v.notes = q('#fcNotes').value.trim(); }
function fcLogRender() { const v = fc.cur, c = fcQ('#fcLogCard'); c.style.display = (v.log || []).length ? '' : 'none'; fcQ('#fcLog').innerHTML = (v.log || []).slice().reverse().map(l => `<div>${fcE(l.at)} · <strong>${fcE(l.by)}</strong> — ${fcE(l.text)}</div>`).join('') + (v.up ? `<div>⬆ Uploaded to “${fcE(v.up.list)}” on ${fcE(v.up.at)} (${v.up.n} item(s))</div>` : ''); }

/* ---------- signatures ---------- */
const FC_W = 420, FC_H = 150;
function fcSigsRender() {
  const v = fc.cur, host = fcQ('#fcSigs'); host.innerHTML = FC_ROLES.map(([k, t, sub]) => `<div class="fc-sig" data-k="${k}"><div class="fc-sh">${fcE(t)} <span class="text-sm" style="color:var(--gray-500)">${fcE(sub)}</span></div><input data-pf="name" placeholder="Full name" list="fcNameList" value="${fcE(v[k].name)}"><input data-pf="title" placeholder="Job title / department" list="fcTitleList" value="${fcE(v[k].title)}" style="margin-top:4px"><div class="fc-pad"><canvas width="${FC_W}" height="${FC_H}"></canvas><span class="fc-hint">${v[k].sig ? '' : 'Sign here'}</span></div><div class="btn-row" style="margin-top:4px;"><button type="button" class="ghost small" data-a="clr">✖ Clear</button><button type="button" class="ghost small" data-a="up">🖼 Upload picture</button><span class="text-sm fc-at" style="color:var(--gray-600)">${v[k].at ? 'Signed ' + fcE(v[k].at) : 'Not signed'}</span></div></div>`).join('');
  host.querySelectorAll('.fc-sig').forEach(box => { const k = box.dataset.k, cv = box.querySelector('canvas'), ctx = cv.getContext('2d'); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f4d';
    if (v[k].sig) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, FC_W, FC_H); im.src = v[k].sig; }
    let drawing = false, last = null, moved = false; const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * FC_W / r.width, y: (e.clientY - r.top) * FC_H / r.height }; };
    cv.addEventListener('pointerdown', e => { drawing = true; moved = false; last = pt(e); cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(last.x + 0.1, last.y + 0.1); ctx.stroke(); e.preventDefault(); });
    cv.addEventListener('pointermove', e => { if (!drawing) return; const p = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; moved = true; });
    const end = () => { if (!drawing) return; drawing = false; fcSigSet(box, k, cv.toDataURL('image/png')); }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.style.touchAction = 'none'; });
}
function fcSigSet(box, k, url) { const v = fc.cur; v[k].sig = url; v[k].at = url ? fcNowIso() : ''; box.querySelector('.fc-at').textContent = url ? 'Signed ' + v[k].at : 'Not signed'; box.querySelector('.fc-hint').textContent = url ? '' : 'Sign here'; fcPill(); }
function fcSigImage(box, k, file) { if (!file) return; const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const cv = box.querySelector('canvas'), ctx = cv.getContext('2d'); ctx.clearRect(0, 0, FC_W, FC_H); const s = Math.min(FC_W / im.width, FC_H / im.height), w = im.width * s, h = im.height * s; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, FC_W, FC_H); ctx.drawImage(im, (FC_W - w) / 2, (FC_H - h) / 2, w, h); fcSigSet(box, k, cv.toDataURL('image/png')); }; im.src = String(r.result); }; r.readAsDataURL(file); }

/* ---------- save / open ---------- */
function fcValidate(v) {
  const bad = m => { sectionToast(m, 'warn'); return false; };
  if (!v.no) return bad('Enter the voucher number.'); if (!v.date) return bad('Enter the voucher date.'); if (fc.list.some(x => x.no === v.no && x.id !== v.id)) return bad(`Voucher number ${v.no} is already used by another voucher.`);
  if (v.status !== 'Draft' && v.status !== 'Cancelled') { if (!fcLines(v).length) return bad('Add at least one item with a SKU and a quantity.'); if (!v.req.name || !v.iss.name) return bad('Requester and issuer names are required before the voucher leaves Draft.'); if ((v.status === 'Approved' || v.status === 'Released') && !v.apr.name) return bad('The approver name is required for an approved / released voucher.'); }
  const dupe = {}; fcLines(v).forEach(i => { const k = i.sku.trim().toLowerCase() + '|' + String(i.batch).trim().toLowerCase(); dupe[k] = (dupe[k] || 0) + 1; }); const dk = Object.keys(dupe).find(k => dupe[k] > 1); if (dk && !confirm(`SKU ${dk.split('|')[0].toUpperCase()} appears on more than one line with the same batch. Save anyway?`)) return false;
  if ((v.status === 'Approved' || v.status === 'Released') && fcSig(v) < 3 && !confirm(`Only ${fcSig(v)} of 3 signatures are captured. Save as ${v.status} anyway?`)) return false;
  if ((v.status === 'Approved' || v.status === 'Released') && !(v.evid || []).length && !confirm('No request evidence (e-mail / PDF / scan) is attached to this voucher. Save as ' + v.status + ' anyway?')) return false; return true;
}
function fcSave(andNew) {
  fcRead(); const v = fc.cur; v.items = v.items.filter((i, ix) => String(i.sku).trim() || fcNum(i.qty) || i.desc || ix === 0 && false); if (!v.items.length) v.items = [fcBlankItem()]; if (!fcValidate(v)) { fcItemsRender(); return false; }
  if (fcSig(v) === 3 && (v.status === 'Draft' || v.status === 'Pending approval')) { v.status = 'Approved'; sectionToast('All three signatures captured — status set to Approved.', 'success'); }
  const ex = fc.list.findIndex(x => x.id === v.id); v.updated = fcNowIso(); fcLog(v, ex < 0 ? `Created (${v.status})` : `Saved (${v.status})`); if (ex < 0) fc.list.push(v); else fc.list[ex] = v; if (v.up) { /* keep upload marker but flag change */ v.up.changed = true; }
  fcPut(v); fc.saved = fcSnap(v); addActivity('create', `FOC voucher ${v.no} saved (${fcLines(v).length} lines)`); sectionToast(`✓ Voucher ${v.no} saved.`, 'success');
  if (andNew) fcOpen(null, true); else fcWrite(); fcKpis(); fcDatalists(); return true;
}
function fcOpen(id, force) {
  if (!force && fcDirty() && !confirm('Discard the unsaved changes on this voucher?')) return; const f = id && fc.list.find(x => x.id === id); fc.cur = f ? JSON.parse(JSON.stringify(f)) : fcBlank(); fc.saved = fcSnap(fc.cur); fcQ('#fcUpStatus').textContent = ''; fc.tab = 'form'; fcWrite(); fcTabs(); fcShowTab();
}

/* ---------- print / email ---------- */
function fcVoucherHtml(v, last) {
  const e = fcE, L = fcLines(v), rows = (L.length ? L : v.items.filter(i => i.sku)).map((i, n) => `<tr><td class="c">${n + 1}</td><td><b>${e(i.sku)}</b></td><td>${e(i.desc)}</td><td class="c">${e(i.uom)}</td><td class="r">${e(plF(fcNum(i.qty), 2))}</td><td>${e(i.batch)}</td><td class="c">${e(i.expiry)}</td><td>${e(i.remarks)}</td></tr>`).join('');
  const bc = typeof rkBarSvg === 'function' ? rkBarSvg(v.no, '34px') : '', sig = ([k, t, sub]) => { const p = v[k]; return `<div class="sg"><div class="sl">${e(sub)}</div><div class="si">${p.sig ? `<img src="${p.sig}">` : ''}</div><div class="sn">${e(p.name) || '&nbsp;'}</div><div class="st">${e(p.title) || '&nbsp;'}</div><div class="sd">${p.at ? 'Signed ' + e(p.at) : 'Date / signature'}</div></div>`; };
  const m = (l, x) => `<div class="m"><span>${l}</span><b>${e(x) || '—'}</b></div>`;
  return `<section class="v${last ? ' last' : ''}"><header><div><div class="co">NFPC · Supply Chain</div><h1>FOC RELEASE VOUCHER</h1><div class="sub">Free-of-charge stock release</div></div><div class="nb"><div class="no">${e(v.no)}</div><div class="bcw">${bc}</div><span class="stt" style="color:${FC_STCOL[v.status]};border-color:${FC_STCOL[v.status]}">${e(v.status)}</span></div></header>
  <div class="meta">${m('Date', v.date + (v.time ? ' ' + v.time : ''))}${m('Warehouse / store', v.wh)}${m('Department', v.dept)}${m('Reason / purpose', v.reason)}${m('Recipient / customer', v.recip)}${m('Reference', v.ref)}</div>
  <table class="it"><thead><tr><th>#</th><th>SKU</th><th>Description</th><th>UOM</th><th>Qty</th><th>Batch</th><th>Expiry</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="4" class="r">Total — ${L.length} line(s)</td><td class="r">${e(plF(fcQty(v), 2))}</td><td colspan="3"></td></tr></tfoot></table>
  ${v.notes ? `<div class="nt"><b>Notes:</b> ${e(v.notes)}</div>` : ''}<div class="sgs">${FC_ROLES.map(sig).join('')}</div><footer>Printed ${e(fcNowIso())} by ${e(fcUser())} · ${e(v.no)}${v.up ? ' · uploaded to SharePoint ' + e(v.up.at) : ''}</footer></section>`;
}
function fcDoc(vs) {
  const css = `@page{size:A4;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:'Segoe UI',Arial,sans-serif;color:#14213d;font-size:11.5px}
  .v{min-height:272mm;display:flex;flex-direction:column;page-break-after:always;break-after:page;padding:2mm}.v.last{page-break-after:auto;break-after:auto}
  header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #1f4e79;padding-bottom:8px}.co{font-weight:700;color:#51607f;letter-spacing:.08em;font-size:11px}h1{margin:2px 0;font-size:24px;letter-spacing:.04em;color:#1f4e79}.sub{color:#7a859b}
  .nb{text-align:right;min-width:62mm}.no{font-size:20px;font-weight:800}.bcw{height:34px;margin:3px 0}.stt{display:inline-block;border:1.5px solid;border-radius:5px;padding:1px 9px;font-weight:700;font-size:11px}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;margin:10px 0}.m{border-bottom:1px solid #d5dbe6;padding:3px 0}.m span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#7a859b}.m b{font-size:12px}
  table.it{width:100%;border-collapse:collapse;margin-top:4px}.it th{background:#1f4e79;color:#fff;padding:5px 6px;text-align:left;font-size:10.5px}.it td{padding:5px 6px;border-bottom:1px solid #d5dbe6;vertical-align:top}.it tfoot td{font-weight:700;border-top:2px solid #1f4e79;border-bottom:0}.c{text-align:center}.r{text-align:right}
  .nt{margin-top:8px;padding:6px 8px;background:#f3f6fb;border-left:3px solid #1f4e79}.sgs{margin-top:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding-top:18px}
  .sg{border:1px solid #b9c3d6;border-radius:6px;padding:6px 8px}.sl{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#7a859b}.si{height:20mm;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #14213d;margin:2px 0 4px}.si img{max-width:100%;max-height:19mm}.sn{font-weight:700}.st{color:#51607f;font-size:10.5px}.sd{font-size:9.5px;color:#7a859b;margin-top:2px}
  footer{margin-top:8px;font-size:9px;color:#8a95aa;border-top:1px solid #e1e6ef;padding-top:4px}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${fcE(vs.length === 1 ? vs[0].no : 'FOC vouchers')}</title><style>${css}</style></head><body>${vs.map((v, i) => fcVoucherHtml(v, i === vs.length - 1)).join('')}</body></html>`;
}
function fcPrintVs(vs) { if (!vs.length) { sectionToast('Nothing to print.', 'warn'); return; } rkPrintDoc(fcDoc(vs), vs.length === 1 ? 'FOC voucher ' + vs[0].no : vs.length + ' FOC vouchers'); }
const fcMailOf = v => () => ({ title: 'FOC Release Voucher ' + v.no, sheet: 'FOC ' + v.no, headers: ['#', 'SKU', 'Description', 'UOM', 'Qty', 'Batch', 'Expiry', 'Remarks'], rows: fcLines(v).map((i, n) => [n + 1, i.sku, i.desc, i.uom, fcNum(i.qty), i.batch, i.expiry, i.remarks]), totalRow: false,
  note: `Status ${v.status} · Date ${v.date} · Warehouse ${v.wh || '—'} · Department ${v.dept || '—'} · Reason ${v.reason || '—'} · Recipient ${v.recip || '—'}${v.ref ? ' · Ref ' + v.ref : ''} · Requester ${v.req.name || '—'} · Issuer ${v.iss.name || '—'} · Approver ${v.apr.name || '—'} · Signatures ${fcSig(v)}/3 · Total qty ${plF(fcQty(v), 2)}` });
const fcCurForOut = () => { fcRead(); return fc.cur; };


/* ---------- refresh the item list from SharePoint ---------- */
const fcTab = { items: new Map(), itemsAt: 0, batches: new Map(), batchAt: 0 };
const fcSrcCol = (m, k) => m[k] && m[k] !== SKIP_VALUE ? m[k] : '';
async function fcLoadItemTable() {
  if (!utReady('src-item')) return null; const c = utGet('src-item'), m = c.map, token = getGlobalAccessToken(), site = getGlobalSiteUrl(), ids = await resolveIds(site, c.list, token), its = await fetchAllItems(ids.siteId, ids.listId, token), map = new Map(), cs = fcSrcCol(m, 'sku'), cd = fcSrcCol(m, 'desc'), cu = fcSrcCol(m, 'uom'), g = (f, col) => col ? String(xlCell(f[col]) ?? '').trim() : '';
  its.forEach(it => { const f = it.fields || {}, sku = g(f, cs); if (sku) map.set(sku.toLowerCase(), { sku: sku.toUpperCase(), desc: g(f, cd), uom: g(f, cu).toUpperCase() }); }); fcTab.items = map; fcTab.itemsAt = Date.now(); return map.size;
}
async function fcLoadBatchTable() {
  if (!utReady('src-batch')) return null; const c = utGet('src-batch'), m = c.map, token = getGlobalAccessToken(), site = getGlobalSiteUrl(), ids = await resolveIds(site, c.list, token), its = await fetchAllItems(ids.siteId, ids.listId, token), map = new Map(), g = (f, k) => { const col = fcSrcCol(m, k); return col ? String(xlCell(f[col]) ?? '').trim() : ''; }; let n = 0;
  its.forEach(it => { const f = it.fields || {}, sku = g(f, 'sku'), bc = g(f, 'batchCode'); if (!sku || !bc) return; const q = parseFloat(g(f, 'qty').replace(/,/g, '')); if (fcSrcCol(m, 'qty') && !(q > 0)) return; const ex = g(f, 'expiryDate'), d = ex ? new Date(ex) : null; const k = sku.toLowerCase(); if (!map.has(k)) map.set(k, []); map.get(k).push({ batch: bc, expiry: d && !isNaN(d) ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : (/^\d{4}-\d{2}-\d{2}/.test(ex) ? ex.slice(0, 10) : ''), qty: isFinite(q) ? q : null, loc: g(f, 'locationCode') }); n++; });
  map.forEach(a => a.sort((x, y) => (x.expiry || '9999').localeCompare(y.expiry || '9999') || x.batch.localeCompare(y.batch))); fcTab.batches = map; fcTab.batchAt = Date.now(); return n;
}
function fcBatchesFor(sku) {
  const k = String(sku || '').trim().toLowerCase(); if (!k) return []; const a = fcTab.batches.get(k); if (a && a.length) return a;
  try { const ix = wFefoState.batchIndex && wFefoState.batchIndex.get(k); if (ix) return ix.map(b => ({ batch: b.batchCode, expiry: b.expiryDate ? String(b.expiryDate).slice(0, 10) : '', qty: b.qty, loc: b.locationCode })); } catch (e) {} return [];
}
async function fcRefreshItems(auto) {
  const st = fcQ('#fcRefInfo'), btn = fcQ('#fcRefresh'); if (fcRefreshItems.busy) return false;
  const defined = utReady('src-item') || utReady('src-uom') || utReady('src-batch') || !!wUomState.listName;
  if (!defined) { st.textContent = '⚠ No Item / UOM / Batch table is defined — an administrator sets them in Upload Destinations & Sources › Items, UOM & Batch tables.'; if (!auto) sectionToast('No Item, UOM or Batch table is defined yet (administrator → Upload Destinations & Sources).', 'warn'); return false; }
  if (!getGlobalAccessToken() || !getGlobalSiteUrl()) { st.textContent = '⚠ SharePoint is not connected.'; if (!auto) sectionToast('Connect the SharePoint site first.', 'warn'); return false; }
  fcRefreshItems.busy = true; btn.disabled = true; st.textContent = 'Refreshing tables…'; const parts = [], bad = []; let any = false;
  try {
    if (utReady('src-uom') && wUomState.listName !== utGet('src-uom').list) { try { await utSrcApplyAll(); } catch (e) {} }
    if (utReady('src-item')) { try { parts.push(plF(await fcLoadItemTable()) + ' item(s)'); any = true; } catch (e) { bad.push('Item table: ' + e.message); } }
    if (wUomState.listName) { try { if (await wUom_loadFromList()) { parts.push(plF(wUomState.table.size) + ' UOM row(s)'); any = true; } else bad.push('UOM table could not be loaded'); } catch (e) { bad.push('UOM table: ' + e.message); } }
    if (utReady('src-batch') && (!auto || !fcTab.batchAt)) { try { parts.push(plF(await fcLoadBatchTable()) + ' batch row(s)'); any = true; } catch (e) { bad.push('Batch table: ' + e.message); } }
    if (any) { fcDatalists(); let n = 0; (fc.cur ? fc.cur.items : []).forEach((it, i) => { if (it.sku && !it.desc) { const d = fcDescFor(it.sku); if (d) { it.desc = d; n++; const el = fcQ('#fcItems').querySelector(`tr[data-i="${i}"] [data-f=desc]`); if (el) el.value = d; } } }); }
    st.textContent = (any ? `✓ ${parts.join(' · ')} — ${new Date().toLocaleTimeString()}` : '⚠ Nothing was refreshed.') + (bad.length ? ' · ⚠ ' + bad.join(' · ') : '');
    if (!auto && any) sectionToast('Item, UOM and batch tables refreshed from SharePoint.', bad.length ? 'warn' : 'success'); return any;
  } catch (e) { st.textContent = '✘ ' + e.message; return false; } finally { fcRefreshItems.busy = false; btn.disabled = false; }
}

/* ---------- request evidence (e-mail / PDF / scan) ---------- */
const FC_EV_KINDS = ['Request email', 'PDF', 'Scanned voucher', 'Other'], FC_EV_MAX = 15 * 1048576;
const fcEvFolder = () => { try { return (localStorage.getItem(LS_BASE + '_foc_evfolder') || 'FOCEvidence').replace(/^\/+|\/+$/g, '') || 'FOCEvidence'; } catch (e) { return 'FOCEvidence'; } };
const fcSz = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
function fcEvGuess(f) { const n = f.name.toLowerCase(); if (/\.(eml|msg)$/.test(n)) return 'Request email'; if (/\.pdf$/.test(n) || f.type === 'application/pdf') return 'PDF'; if (/^image\//.test(f.type) || /\.(png|jpe?g|webp|heic|tiff?)$/.test(n)) return 'Scanned voucher'; return 'Other'; }
const fcEvIcon = e => e.kind === 'Request email' ? '✉' : e.kind === 'PDF' ? '📄' : e.kind === 'Scanned voucher' ? '🖼' : '📎';
function fcEvAdd(files) {
  const v = fc.cur; v.evid = v.evid || []; let added = 0;
  const jobs = Array.from(files || []).map(f => new Promise(res => {
    if (f.size > FC_EV_MAX) { sectionToast(`“${f.name}” is ${fcSz(f.size)} — the limit is 15 MB per file.`, 'warn'); return res(); }
    const r = new FileReader(); r.onload = () => { v.evid.push({ id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: f.name, type: f.type || 'application/octet-stream', kind: fcEvGuess(f), size: f.size, at: fcNowIso(), by: fcUser(), data: String(r.result), sp: null }); added++; res(); }; r.onerror = () => { sectionToast('Could not read “' + f.name + '”.', 'warn'); res(); }; r.readAsDataURL(f);
  }));
  return Promise.all(jobs).then(() => { if (added) { fcLog(v, `Request evidence added (${added} file(s))`); fcEvRender(); fcLogRender(); sectionToast(`${added} evidence file(s) attached — click 💾 Save to keep them.`, 'success'); } });
}
function fcEvBlob(e) { const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(e.data || ''); if (!m) return new Blob([]); const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: e.type || m[1] || 'application/octet-stream' }); }
function fcEvOpen(e, dl) {
  const b = fcEvBlob(e), url = URL.createObjectURL(b), viewable = /^(application\/pdf|image\/(png|jpe?g|gif|webp|bmp))/i.test(b.type);
  if (viewable && !dl) { window.open(url, '_blank'); } else { const a = document.createElement('a'); a.href = url; a.download = e.name; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function fcEvRender() {
  const host = fcQ('#fcEvList'); if (!host || !fc.cur) return; const L = fc.cur.evid || [];
  fcQ('#fcEvInfo').textContent = L.length ? `— ${L.length} file(s)` : '— none attached yet';
  fcQ('#fcEvFolder').value = fcEvFolder();
  host.innerHTML = L.length ? `<table class="fd-tbl"><thead><tr><th></th><th>File</th><th>Type</th><th class="n">Size</th><th>Added</th><th>SharePoint</th><th></th></tr></thead><tbody>${L.map((e, i) => `<tr data-i="${i}"><td>${fcEvIcon(e)}</td><td>${fcE(e.name)}</td><td><select data-ek style="margin:0;width:auto">${FC_EV_KINDS.map(k => `<option ${k === e.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></td><td class="n">${fcSz(e.size || 0)}</td><td>${fcE((e.at || '').replace('T', ' '))}<br><span class="text-sm" style="color:var(--gray-500)">${fcE(e.by || '')}</span></td><td>${e.sp ? `<a href="${fcE(e.sp.url)}" target="_blank" rel="noopener">✓ in SharePoint</a>` : '<span class="text-sm" style="color:var(--gray-500)">not uploaded</span>'}</td><td style="white-space:nowrap"><button type="button" class="ghost small" data-ea="view" title="Open">👁</button> <button type="button" class="ghost small" data-ea="dl" title="Download">⬇</button> <button type="button" class="ghost small" data-ea="rm" title="Remove">✖</button></td></tr>`).join('')}</tbody></table>` : '<div class="text-sm" style="color:var(--gray-500)">No request evidence attached.</div>';
}
async function fcSpPutFile(segs, blob) {
  const { siteId, token } = await plSp(), base = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${segs.map(encodeURIComponent).join('/')}:`;
  if (blob.size < 3500000) { const r = await fetchWithRetry(base + '/content?@microsoft.graph.conflictBehavior=replace', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type || 'application/octet-stream' }, body: blob }, 'save evidence'); if (!r.ok) throw await atSpErr(r); return r.json(); }
  const r = await fetchWithRetry(base + '/createUploadSession', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }) }, 'start upload'); if (!r.ok) throw await atSpErr(r);
  const url = (await r.json()).uploadUrl, CH = 327680 * 10; let pos = 0, item = null;
  while (pos < blob.size) { const end = Math.min(pos + CH, blob.size), pr = await fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes ${pos}-${end - 1}/${blob.size}` }, body: blob.slice(pos, end) }); if (!pr.ok && pr.status !== 202) throw await atSpErr(pr); if (pr.status === 200 || pr.status === 201) item = await pr.json(); pos = end; }
  if (!item) throw new Error('SharePoint did not confirm the upload.'); return item;
}
async function fcEvUpload(v) {
  const todo = (v.evid || []).filter(e => !e.sp); if (!todo.length) return 0; const folder = fcEvFolder().split('/').filter(Boolean), sub = String(v.no || v.id).replace(/[\\/:*?"<>|#%]/g, '_'), used = new Set((v.evid || []).filter(e => e.sp).map(e => e.sp.name)); let n = 0;
  for (const e of todo) { let name = String(e.name).replace(/[\\/:*?"<>|#%]/g, '_'); if (used.has(name)) name = (n + 1) + '_' + name; used.add(name);
    const it = await fcSpPutFile([...folder, sub, name], fcEvBlob(e)); e.sp = { url: it.webUrl || '', at: fcNowIso(), name, path: [...folder, sub, name].join('/') }; n++; }
  fcLog(v, `Request evidence uploaded to SharePoint (${n} file(s), folder “${folder.join('/')}/${sub}”)`); const cur = fc.list.find(x => x.id === v.id); if (cur && cur !== v) { cur.evid = v.evid; cur.log = v.log; } fcPut(cur || v); if (fc.cur && fc.cur.id === v.id && fc.cur !== v) { fc.cur.evid = v.evid; fc.cur.log = v.log; fc.saved = fcSnap(fc.cur); } fcEvRender(); fcLogRender(); return n;
}
/* ---------- SharePoint ---------- */
const FC_FIELDS = [
  { key: 'no', label: 'Voucher no.', alias: ['voucherno', 'vouchernumber', 'focno', 'voucher', 'title', 'number'] }, { key: 'date', label: 'Voucher date', alias: ['date', 'voucherdate', 'releasedate'] }, { key: 'time', label: 'Time', alias: ['time'] }, { key: 'status', label: 'Status', alias: ['status'] },
  { key: 'wh', label: 'Warehouse / store', alias: ['warehouse', 'whs', 'whscode', 'store', 'storeno', 'location'] }, { key: 'dept', label: 'Department', alias: ['department', 'dept'] }, { key: 'reason', label: 'Reason / purpose', alias: ['reason', 'purpose'] }, { key: 'recip', label: 'Recipient / customer', alias: ['recipient', 'customer', 'receiver'] }, { key: 'ref', label: 'Reference', alias: ['reference', 'ref', 'po', 'so'] }, { key: 'notes', label: 'Notes', alias: ['notes', 'remarks', 'comments'] },
  { key: 'reqName', label: 'Requester name', alias: ['requester', 'requestername', 'requestedby'] }, { key: 'reqTitle', label: 'Requester title', alias: ['requestertitle', 'requesterjob'] }, { key: 'reqSigned', label: 'Requester signed (Yes/No)', alias: ['requestersigned'] }, { key: 'reqAt', label: 'Requester signed at', alias: ['requestersignedat', 'requesterdate'] }, { key: 'reqSig', label: 'Requester signature (image data)', alias: ['requestersignature'] },
  { key: 'issName', label: 'Issuer name', alias: ['issuer', 'issuername', 'issuedby'] }, { key: 'issTitle', label: 'Issuer title', alias: ['issuertitle'] }, { key: 'issSigned', label: 'Issuer signed (Yes/No)', alias: ['issuersigned'] }, { key: 'issAt', label: 'Issuer signed at', alias: ['issuersignedat'] }, { key: 'issSig', label: 'Issuer signature (image data)', alias: ['issuersignature'] },
  { key: 'aprName', label: 'Approver name', alias: ['approver', 'approvername', 'approvedby'] }, { key: 'aprTitle', label: 'Approver title', alias: ['approvertitle'] }, { key: 'aprSigned', label: 'Approver signed (Yes/No)', alias: ['approversigned'] }, { key: 'aprAt', label: 'Approver signed at', alias: ['approversignedat'] }, { key: 'aprSig', label: 'Approver signature (image data)', alias: ['approversignature'] },
  { key: 'lines', label: 'Number of lines', alias: ['lines', 'linecount', 'itemscount'] }, { key: 'qty', label: 'Total quantity', alias: ['totalqty', 'totalquantity'] }, { key: 'items', label: 'Items summary (SKU × qty; …)', alias: ['items', 'itemssummary', 'skus'] },
  { key: 'lineNo', label: 'Line no. (line mode)', alias: ['lineno', 'line'] }, { key: 'sku', label: 'SKU (line mode)', alias: ['sku', 'skucode', 'icode', 'itemcode'] }, { key: 'desc', label: 'Description (line mode)', alias: ['description', 'itemdescription', 'itemdesc'] }, { key: 'uom', label: 'UOM (line mode)', alias: ['uom', 'unit'] }, { key: 'lqty', label: 'Line quantity (line mode)', alias: ['quantity', 'qty', 'lineqty'] }, { key: 'batch', label: 'Batch (line mode)', alias: ['batch', 'batchcode', 'batchno'] }, { key: 'expiry', label: 'Expiry (line mode)', alias: ['expiry', 'expirydate'] }, { key: 'lremarks', label: 'Line remarks (line mode)', alias: ['lineremarks'] },
  { key: 'evidence', label: 'Request evidence link(s)', alias: ['evidence', 'requestevidence', 'evidencelink', 'evidencelinks', 'evidenceurl'] }, { key: 'evCount', label: 'Evidence files (count)', alias: ['evidencecount', 'evidencefiles', 'evidenceqty'] },
  { key: 'by', label: 'Created by', alias: ['createdby', 'author', 'user'] }, { key: 'at', label: 'Uploaded at', alias: ['uploadedat', 'uploaddate', 'timestamp'] }
];
utRegister('foc-hdr', { section: 'FOC Vouchers', label: 'FOC voucher header (one item per voucher)', fields: FC_FIELDS, note: 'Used by FOC Release Voucher → “Upload to SharePoint” when “One list item per voucher” is chosen.' });
utRegister('foc-line', { section: 'FOC Vouchers', label: 'FOC voucher lines (one item per SKU line)', fields: FC_FIELDS, note: 'Used by FOC Release Voucher → “Upload to SharePoint” when “One list item per SKU line” is chosen. Voucher details repeat on each line.' });
function fcUpRows(vs, mode) {
  const at = fcNowIso(), out = []; vs.forEach(v => { const L = fcLines(v), base = { no: v.no, date: v.date, time: v.time, status: v.status, wh: v.wh, dept: v.dept, reason: v.reason, recip: v.recip, ref: v.ref, notes: v.notes, reqName: v.req.name, reqTitle: v.req.title, reqSigned: v.req.sig ? 'Yes' : 'No', reqAt: v.req.at, reqSig: v.req.sig, issName: v.iss.name, issTitle: v.iss.title, issSigned: v.iss.sig ? 'Yes' : 'No', issAt: v.iss.at, issSig: v.iss.sig, aprName: v.apr.name, aprTitle: v.apr.title, aprSigned: v.apr.sig ? 'Yes' : 'No', aprAt: v.apr.at, aprSig: v.apr.sig, lines: L.length, qty: fcQty(v), evidence: (v.evid || []).filter(e => e.sp).map(e => e.sp.url).join('\n'), evCount: (v.evid || []).length, by: v.createdBy, at };
    if (mode === 'line') L.forEach((i, n) => out.push(Object.assign({ _v: v }, base, { lineNo: n + 1, sku: i.sku, desc: i.desc, uom: i.uom, lqty: fcNum(i.qty), batch: i.batch, expiry: i.expiry, lremarks: i.remarks }))); else out.push(Object.assign({ _v: v }, base, { items: L.map(i => `${i.sku} × ${fcNum(i.qty)} ${i.uom}`).join('; ') })); });
  return out;
}
function fcDestLine(el, mode) { const id = mode === 'line' ? 'foc-line' : 'foc-hdr', c = utGet(id), ok = utReady(id); el.innerHTML = ok ? `📌 Destination set by the administrator: <strong>${fcE(c.list)}</strong> (${Object.values(c.map).filter(v => v && v !== SKIP_VALUE).length} fields mapped)` : `⚠ No upload destination is configured for “${fcE(UT_REG[id].label)}”. ${utIsAdmin() ? 'Set it in <strong>Upload Destinations &amp; Sources</strong>.' : 'Ask an administrator to set it in Upload Destinations &amp; Sources.'}`; return ok; }
async function fcUpload(vs, mode, st, prog) {
  const say = t => { if (st) st.textContent = t; }, id = mode === 'line' ? 'foc-line' : 'foc-hdr';
  if (!utReady(id)) { say('⚠ No upload destination is configured (Upload Destinations & Sources).'); sectionToast('No upload destination is configured for FOC vouchers.', 'warn'); return; }
  const can = vs.filter(v => v.status !== 'Cancelled'); if (!can.length) { say('⚠ Nothing to upload (cancelled vouchers are skipped).'); return; } const rows = fcUpRows(can, mode); if (!rows.length) { say('⚠ The vouchers have no complete lines to upload.'); return; }
  const evN = can.reduce((a, v) => a + (v.evid || []).filter(e => !e.sp).length, 0), dup = can.filter(v => v.up && !v.up.changed).length, chg = can.filter(v => v.up && v.up.changed).length, cfg = utGet(id);
  if (!(await spAsk(`Upload ${plF(rows.length)} item(s) from ${can.length} voucher(s) to "${cfg.list}"?` + (dup ? `\n\n⚠ ${dup} voucher(s) were already uploaded — uploading again creates duplicate rows.` : '') + (chg ? `\n⚠ ${chg} voucher(s) changed after their last upload.` : '') + (evN ? `\n\n📎 ${evN} evidence file(s) will also be saved in the Documents library folder “${fcEvFolder()}” and linked in the list item.` : '')))) return;
  let rows2 = rows; if (evN) { say('Uploading evidence files…'); for (const v of can) { try { await fcEvUpload(v); } catch (e) { say('⚠ Evidence upload failed for ' + v.no + ': ' + e.message); sectionToast('Evidence upload failed for ' + v.no + ': ' + e.message, 'warn'); } } rows2 = fcUpRows(can, mode); }
  if (prog) { prog.style.display = 'block'; prog.max = rows.length; prog.value = 0; }
  try { const per = new Map(); const r = await utPush(id, rows2, x => x.no + (x.sku ? '/' + x.sku : ''), (d, t) => { if (prog) prog.value = d; say(`Uploading… ${d}/${t}`); });
    if (r.ok && !r.fail) { can.forEach(v => { const cur = fc.list.find(x => x.id === v.id) || v; cur.up = { at: fcNowIso(), list: r.list, mode, n: mode === 'line' ? fcLines(cur).length : 1 }; fcLog(cur, `Uploaded to “${r.list}” (${cur.up.n} item(s))`); fcPut(cur); if (fc.cur && fc.cur.id === cur.id) { fc.cur.up = cur.up; fc.cur.log = cur.log; fc.saved = fcSnap(fc.cur); } }); }
    say(`${r.fail ? '⚠' : '✓'} ${r.ok} uploaded to “${r.list}”, ${r.fail} failed.` + (r.fail ? ' Vouchers were not marked as uploaded — fix the mapping or list and retry.' : '') + (r.errors.length ? ' ' + r.errors.join(' · ') : '')); w_logToActivity(`FOC vouchers → "${r.list}": ${r.ok} ok, ${r.fail} failed`); addActivity('upload', `FOC vouchers: ${r.ok} item(s)`);
  } catch (err) { say('✘ ' + err.message); } fcKpis(); if (fc.tab === 'hist') fcHist(); else { fcLogRender(); }
}

/* ---------- history ---------- */
const fcHay = v => [v.no, v.date, v.status, v.wh, v.dept, v.reason, v.recip, v.ref, v.notes, v.req.name, v.iss.name, v.apr.name, v.createdBy].concat((v.items || []).flatMap(i => [i.sku, i.desc, i.batch])).join(' | ').toLowerCase();
function fcFiltered() { const qs = fc.q.map(t => String(t).toLowerCase().trim()).filter(Boolean); return fc.list.filter(v => (!fc.st.length || fc.st.includes(v.status)) && (!fc.from || v.date >= fc.from) && (!fc.to || v.date <= fc.to) && (!fc.upState || (fc.upState === 'yes' ? !!v.up : !v.up)) && (!qs.length || qs.some(t => fcHay(v).includes(t)))).sort((a, b) => (b.date + (b.time || '') + b.no).localeCompare(a.date + (a.time || '') + a.no)); }
const FH_V = [['Voucher no.', v => v.no], ['Date', v => v.date], ['Status', v => v.status], ['Warehouse', v => v.wh], ['Department', v => v.dept], ['Reason', v => v.reason], ['Recipient', v => v.recip], ['Requester', v => v.req.name], ['Issuer', v => v.iss.name], ['Approver', v => v.apr.name], ['Lines', v => fcLines(v).length, v => fcLines(v).length], ['Total qty', v => fcQty(v), v => fcQty(v)], ['Signed', v => fcSig(v) + '/3', v => fcSig(v)], ['Evidence', v => (v.evid || []).length || '—', v => (v.evid || []).length], ['SharePoint', v => v.up ? '✓ ' + v.up.at + (v.up.changed ? ' (changed since)' : '') : '—', v => v.up ? v.up.at : '']];
const FH_L = [['Voucher no.', r => r.v.no], ['Date', r => r.v.date], ['Status', r => r.v.status], ['Warehouse', r => r.v.wh], ['Reason', r => r.v.reason], ['Recipient', r => r.v.recip], ['SKU', r => r.i.sku], ['Description', r => r.i.desc], ['UOM', r => r.i.uom], ['Qty', r => fcNum(r.i.qty), r => fcNum(r.i.qty)], ['Batch', r => r.i.batch], ['Expiry', r => r.i.expiry], ['Remarks', r => r.i.remarks], ['Requester', r => r.v.req.name], ['Issuer', r => r.v.iss.name], ['Approver', r => r.v.apr.name]];
function fcHistRows() { const V = fcFiltered(); return fc.mode === 'l' ? { cols: FH_L, rows: V.flatMap(v => fcLines(v).map(i => ({ v, i }))), V } : { cols: FH_V, rows: V, V }; }
const fcSort = { i: null, d: 1 };
function fcHist() {
  const q = fcQ, H = fcHistRows(), tbl = q('#fhTable'); let R = H.rows; if (fcSort.i != null && H.cols[fcSort.i]) { const c = H.cols[fcSort.i], g = c[2] || c[1]; R = R.slice().sort((a, b) => { const x = g(a), y = g(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), undefined, { numeric: true })) * fcSort.d; }); }
  q('#fhInfo').textContent = `— ${plF(H.V.length)} of ${plF(fc.list.length)} voucher(s)${fc.mode === 'l' ? ` · ${plF(R.length)} line(s)` : ''}`; const sh = R.slice(0, fc.shown);
  tbl.querySelector('thead').innerHTML = '<tr>' + (fc.mode === 'v' ? '<th><input type="checkbox" id="fhAll" style="width:auto" title="Select all shown"></th>' : '') + H.cols.map((c, i) => `<th data-i="${i}" style="cursor:pointer">${fcE(c[0])}${fcSort.i === i ? (fcSort.d > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '<th></th></tr>';
  tbl.querySelector('tbody').innerHTML = sh.map(r => { const v = fc.mode === 'l' ? r.v : r; return `<tr data-id="${v.id}" style="cursor:pointer">${fc.mode === 'v' ? `<td><input type="checkbox" data-sel="${v.id}" style="width:auto" ${fc.sel.has(v.id) ? 'checked' : ''}></td>` : ''}${H.cols.map(c => { const x = c[1](r); return c[0] === 'Status' ? `<td><span class="at-chip" style="background:${FC_STCOL[x]}22;color:${FC_STCOL[x]}">${fcE(x)}</span></td>` : `<td class="${typeof x === 'number' ? 'n' : ''}">${fcE(typeof x === 'number' ? plF(x, 2) : x)}</td>`; }).join('')}<td style="white-space:nowrap"><button class="ghost small" data-a="open" type="button" title="Open">✏</button> <button class="ghost small" data-a="print" type="button" title="Print">🖨</button> <button class="ghost small" data-a="mail" type="button" title="Email">📧</button></td></tr>`; }).join('') || `<tr><td colspan="${H.cols.length + 2}" style="padding:16px;text-align:center;color:var(--gray-400);font-style:italic;">No vouchers match — create one in the Voucher tab.</td></tr>`;
  const m = q('#fhMore'); m.style.display = R.length > fc.shown ? '' : 'none'; m.textContent = `Show 200 more (${R.length - fc.shown} left)`;
  const ok = fcDestLine(q('#fhDest'), q('#fhUpMode').value); q('#fhUpload').disabled = !ok; const all = q('#fhAll'); if (all) all.checked = sh.length && sh.every(r => fc.sel.has((fc.mode === 'l' ? r.v : r).id));
  fcHistSearch();
}
function fcHistSearch() { const h = fcQ('#fhSearchHost'), sig = fc.list.length + '|' + fc.q.join(','); if (h.dataset.sig !== sig) { h.dataset.sig = sig; h.innerHTML = ''; const opts = [...new Set(fc.list.flatMap(v => [v.no, v.recip, v.req.name, v.iss.name, v.apr.name].concat((v.items || []).map(i => i.sku))).filter(Boolean))].sort(); h.appendChild(buildMultiCombo(fc.q, opts, a => { fc.q = a; h.dataset.sig = fc.list.length + '|' + a.join(','); fc.shown = 200; fcHist(); }, { placeholder: 'Search voucher, SKU, names, recipient… (multi)' })); }
  const s = fcQ('#fhStatHost'), ss = fc.st.join(','); if (s.dataset.sig !== ss) { s.dataset.sig = ss; s.innerHTML = ''; s.appendChild(buildMultiCombo(fc.st, FC_ST, a => { fc.st = a; s.dataset.sig = a.join(','); fc.shown = 200; fcHist(); }, { placeholder: 'All statuses' })); } }
function fcHistData() { const H = fcHistRows(); return { title: 'FOC release vouchers', sheet: fc.mode === 'l' ? 'FOC lines' : 'FOC vouchers', note: `${plF(H.V.length)} voucher(s)${fc.mode === 'l' ? ' · ' + plF(H.rows.length) + ' line(s)' : ''}${fc.from || fc.to ? ` · ${fc.from || '…'} → ${fc.to || '…'}` : ''}`, headers: H.cols.map(c => c[0]), rows: H.rows.map(r => H.cols.map(c => { const x = c[1](r); return x == null ? '' : x; })), totalRow: false }; }
function fcKpis() {
  const L = fc.list, mo = fcToday().slice(0, 7), act = L.filter(v => v.status !== 'Cancelled'), K = (l, v, s) => `<div class="pl-kpi"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`;
  fcQ('#fcKpis').innerHTML = K('Vouchers', plF(L.length), `${plF(L.filter(v => v.status === 'Cancelled').length)} cancelled`) + K('This month', plF(act.filter(v => v.date.slice(0, 7) === mo).length), `${plF(act.filter(v => v.date.slice(0, 7) === mo).reduce((a, v) => a + fcQty(v), 0), 0)} units released`) + K('Awaiting approval', plF(L.filter(v => v.status === 'Pending approval' || v.status === 'Draft').length), 'draft or pending') + K('Item lines', plF(act.reduce((a, v) => a + fcLines(v).length, 0)), `${plF(act.reduce((a, v) => a + fcQty(v), 0), 0)} total units`) + K('Not on SharePoint', plF(act.filter(v => !v.up).length), `${plF(act.filter(v => v.up).length)} uploaded`);
}
function fcTabs() { fcQ('#fcTabs').innerHTML = [['form', '✍ Voucher'], ['hist', '📚 History (' + fc.list.length + ')']].map(t => `<button type="button" data-t="${t[0]}" class="${fc.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join(''); }
function fcShowTab() { document.querySelectorAll('#view-foc .fc-pane').forEach(p => p.style.display = p.dataset.p === fc.tab ? '' : 'none'); if (fc.tab === 'hist') fcHist(); }

/* ---------- init ---------- */
function fcInit() {
  if (fc.inited) return; fc.inited = true; const q = fcQ;
  q('#fcTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; if (fc.tab === 'form') fcRead(); fc.tab = b.dataset.t; fcTabs(); fcShowTab(); });
  ['#fcNo', '#fcDate', '#fcTime', '#fcStatus', '#fcWh', '#fcDept', '#fcReason', '#fcRecip', '#fcRef', '#fcNotes'].forEach(s => q(s).addEventListener('input', () => { fcRead(); fcPill(); }));
  q('#fcDate').addEventListener('change', () => { const ex = fc.list.some(x => x.id === fc.cur.id); if (!ex && /^FOC-\d{4}-/.test(fc.cur.no)) { fc.cur.no = fcNextNo(q('#fcDate').value); q('#fcNo').value = fc.cur.no; } });
  q('#fcItems').addEventListener('input', e => { const t = e.target, tr = t.closest('tr'); if (!tr || !t.dataset.f) return; fc.cur.items[+tr.dataset.i][t.dataset.f] = t.value; if (t.dataset.f === 'qty') fcTot(); });
  q('#fcItems').addEventListener('change', e => { const t = e.target, tr = t.closest('tr'); if (!tr || t.dataset.f !== 'sku') return; const it = fc.cur.items[+tr.dataset.i]; it.sku = t.value.trim().toUpperCase(); t.value = it.sku; if (!it.desc) { const d = fcDescFor(it.sku); if (d) { it.desc = d; tr.querySelector('[data-f=desc]').value = d; } else if (it.sku && (wUomState.listName || utReady('src-item')) && Date.now() - Math.max(wUomState.loadedAt || 0, fcTab.itemsAt) > 15000) fcRefreshItems(true); } });
  q('#fcItems').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; fc.cur.items.splice(+b.dataset.rm, 1); if (!fc.cur.items.length) fc.cur.items.push(fcBlankItem()); fcItemsRender(); });
  q('#fcAddLine').addEventListener('click', () => { fc.cur.items.push(fcBlankItem()); fcItemsRender(true); });
  q('#fcRefresh').addEventListener('click', () => fcRefreshItems(false));
  q('#fcItems').addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.f === 'batch') { const it = fc.cur.items[+t.closest('tr').dataset.i], B = fcBatchesFor(it.sku); fcQ('#fcBatchList').innerHTML = B.map(b => `<option value="${fcE(b.batch)}">${fcE([b.expiry ? 'exp ' + b.expiry : '', b.qty != null ? 'qty ' + plF(b.qty, 0) : '', b.loc].filter(Boolean).join(' · '))}</option>`).join(''); } });
  q('#fcItems').addEventListener('change', e => { const t = e.target, tr = t.closest('tr'); if (!tr || !t.dataset.f) return; const it = fc.cur.items[+tr.dataset.i];
    if (t.dataset.f === 'batch') { const b = fcBatchesFor(it.sku).find(x => x.batch.toLowerCase() === String(t.value).trim().toLowerCase()); if (b && b.expiry && !it.expiry) { it.expiry = b.expiry; tr.querySelector('[data-f=expiry]').value = b.expiry; } }
    if (t.dataset.f === 'sku') { const ti = fcTab.items.get(it.sku.toLowerCase()); if (ti && ti.uom && (!it.uom || it.uom === 'PC')) { it.uom = ti.uom; tr.querySelector('[data-f=uom]').value = ti.uom; } } });
  document.querySelectorAll('.nav-item[data-view="foc"]').forEach(n => n.addEventListener('click', () => setTimeout(() => { if (!fcTab.itemsAt && !fcTab.batchAt && (utReady('src-item') || utReady('src-batch'))) fcRefreshItems(true); }, 700)));
  const ef = q('#fcEvFile'), ed = q('#fcEvDrop'); q('#fcEvAdd').addEventListener('click', () => ef.click()); ed.addEventListener('click', () => ef.click()); ed.addEventListener('keydown', e => { if (e.key === 'Enter') ef.click(); });
  ef.addEventListener('change', e => { const f = e.target.files; fcEvAdd(f).then(() => { ef.value = ''; }); });
  ed.addEventListener('dragover', e => { e.preventDefault(); ed.classList.add('drag'); }); ed.addEventListener('dragleave', () => ed.classList.remove('drag')); ed.addEventListener('drop', e => { e.preventDefault(); ed.classList.remove('drag'); fcEvAdd(e.dataTransfer.files); });
  q('#fcEvFolder').addEventListener('change', e => { try { localStorage.setItem(LS_BASE + '_foc_evfolder', e.target.value.trim().replace(/^\/+|\/+$/g, '') || 'FOCEvidence'); } catch (x) {} e.target.value = fcEvFolder(); });
  q('#fcEvList').addEventListener('click', e => { const b = e.target.closest('[data-ea]'); if (!b) return; const i = +b.closest('tr').dataset.i, ev = fc.cur.evid[i]; if (!ev) return; if (b.dataset.ea === 'view') fcEvOpen(ev, false); else if (b.dataset.ea === 'dl') fcEvOpen(ev, true); else if (confirm(`Remove “${ev.name}” from this voucher?` + (ev.sp ? '\n\nThe copy already in SharePoint is not deleted.' : ''))) { fc.cur.evid.splice(i, 1); fcLog(fc.cur, `Evidence removed: ${ev.name}`); fcEvRender(); fcLogRender(); } });
  q('#fcEvList').addEventListener('change', e => { const sel = e.target.closest('select[data-ek]'); if (!sel) return; fc.cur.evid[+sel.closest('tr').dataset.i].kind = sel.value; });
  q('#fcEvUp').addEventListener('click', async () => { fcRead(); if (!(fc.cur.evid || []).length) { sectionToast('Attach a file first.', 'warn'); return; } if (!getGlobalAccessToken() || !getGlobalSiteUrl()) { sectionToast('Connect the SharePoint site first.', 'warn'); return; } if (!fcSave(false)) return; const v = fc.list.find(x => x.id === fc.cur.id) || fc.cur, b = q('#fcEvUp'); b.disabled = true; q('#fcUpStatus').textContent = 'Uploading evidence…'; try { const n = await fcEvUpload(v); q('#fcUpStatus').textContent = n ? `✓ ${n} evidence file(s) saved in SharePoint — ${fcEvFolder()}/${v.no}` : 'Everything was already uploaded.'; if (n) sectionToast('Evidence uploaded to SharePoint.', 'success'); } catch (err) { q('#fcUpStatus').textContent = '✘ ' + err.message; sectionToast('Evidence upload failed: ' + err.message, 'warn'); } b.disabled = false; });
  q('#fcPasteBtn').addEventListener('click', () => { const b = q('#fcPasteBox'); b.style.display = b.style.display === 'none' ? '' : 'none'; if (b.style.display !== 'none') q('#fcPasteTxt').focus(); });
  q('#fcPasteNo').addEventListener('click', () => { q('#fcPasteBox').style.display = 'none'; });
  q('#fcPasteOk').addEventListener('click', () => { const lines = q('#fcPasteTxt').value.split(/\r?\n/).map(l => l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, ''))).filter(a => a[0]); let n = 0, bad = 0; if (fc.cur.items.length === 1 && !fc.cur.items[0].sku && !fc.cur.items[0].qty) fc.cur.items = [];
    lines.forEach(a => { if (/^sku$|^item/i.test(a[0])) return; const qn = fcNum(a[1]); if (!qn) { bad++; return; } const it = fcBlankItem(); it.sku = a[0].toUpperCase(); it.qty = qn; it.uom = (a[2] || 'PC').toUpperCase(); it.batch = a[3] || ''; it.expiry = /^\d{4}-\d{2}-\d{2}$/.test(a[4] || '') ? a[4] : ''; it.remarks = a[5] || ''; it.desc = fcDescFor(it.sku); fc.cur.items.push(it); n++; }); if (!fc.cur.items.length) fc.cur.items.push(fcBlankItem());
    fcItemsRender(); q('#fcPasteTxt').value = ''; q('#fcPasteBox').style.display = 'none'; sectionToast(`${n} line(s) added${bad ? `, ${bad} skipped (no quantity)` : ''}.`, bad ? 'warn' : 'success'); });
  let sigBox = null; q('#fcSigs').addEventListener('input', e => { const t = e.target, b = t.closest('.fc-sig'); if (!b || !t.dataset.pf) return; fc.cur[b.dataset.k][t.dataset.pf] = t.value; });
  q('#fcSigs').addEventListener('click', e => { const b = e.target.closest('button[data-a]'), box = e.target.closest('.fc-sig'); if (!b || !box) return; const k = box.dataset.k; if (b.dataset.a === 'clr') { box.querySelector('canvas').getContext('2d').clearRect(0, 0, FC_W, FC_H); fcSigSet(box, k, ''); } else { sigBox = box; q('#fcSigFile').click(); } });
  q('#fcSigFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (sigBox) fcSigImage(sigBox, sigBox.dataset.k, f); });
  q('#fcSave').addEventListener('click', () => fcSave(false)); q('#fcSaveNew').addEventListener('click', () => fcSave(true)); q('#fcNew').addEventListener('click', () => fcOpen(null));
  q('#fcDup').addEventListener('click', () => { fcRead(); const v = JSON.parse(JSON.stringify(fc.cur)); if (fcDirty() && !confirm('Duplicate the voucher including your unsaved changes?')) return; v.id = 'fc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); v.date = fcToday(); v.time = fcNowIso().slice(11); v.no = fcNextNo(v.date); v.status = 'Draft'; ['req', 'iss', 'apr'].forEach(k => { v[k].sig = ''; v[k].at = ''; }); v.up = null; v.evid = []; v.log = []; v.created = fcNowIso(); v.createdBy = fcUser(); v.updated = ''; fc.cur = v; fc.saved = ''; fcWrite(); sectionToast('Copied as a new Draft — signatures were cleared.', 'success'); });
  q('#fcDel').addEventListener('click', () => { const v = fc.cur; if (!fc.list.some(x => x.id === v.id)) return; if (!confirm(`Delete voucher ${v.no} permanently? This cannot be undone. (To keep the record, set the status to Cancelled instead.)`)) return; fc.list = fc.list.filter(x => x.id !== v.id); fcRm(v.id); addActivity('delete', 'FOC voucher ' + v.no + ' deleted'); fcKpis(); fcTabs(); fcOpen(null, true); });
  q('#fcPrint').addEventListener('click', () => fcPrintVs([fcCurForOut()])); q('#fcPdf').addEventListener('click', () => fcPrintVs([fcCurForOut()]));
  q('#fcEmail').addEventListener('click', () => { const v = fcCurForOut(); if (!fcLines(v).length) { sectionToast('Add at least one item (SKU and quantity) before emailing.', 'warn'); return; } window.extMailData = fcMailOf(v); wMail_open('ext'); });
  q('#fcUp').addEventListener('click', async () => { if (fcDirty()) { if (!fcSave(false)) return; } await fcUpload([fc.cur], q('#fhUpMode').value, q('#fcUpStatus'), null); fcLogRender(); });
  /* history */
  q('#fhFrom').addEventListener('change', e => { fc.from = e.target.value; fcHist(); }); q('#fhTo').addEventListener('change', e => { fc.to = e.target.value; fcHist(); }); q('#fhMode').addEventListener('change', e => { fc.mode = e.target.value; fcSort.i = null; fc.shown = 200; fcHist(); }); q('#fhUpState').addEventListener('change', e => { fc.upState = e.target.value; fcHist(); }); q('#fhUpMode').addEventListener('change', e => { fc.upMode = e.target.value; fcHist(); });
  q('#fhClear').addEventListener('click', () => { fc.q = []; fc.st = []; fc.from = fc.to = fc.upState = ''; q('#fhFrom').value = q('#fhTo').value = q('#fhUpState').value = ''; fcQ('#fhSearchHost').dataset.sig = fcQ('#fhStatHost').dataset.sig = '#'; fcHist(); });
  q('#fhMore').addEventListener('click', () => { fc.shown += 200; fcHist(); });
  q('#fhTable').addEventListener('click', e => { const th = e.target.closest('th[data-i]'); if (th) { const i = +th.dataset.i; fcSort.d = fcSort.i === i ? -fcSort.d : 1; fcSort.i = i; fcHist(); return; }
    if (e.target.id === 'fhAll') { const on = e.target.checked; fcFiltered().slice(0, fc.shown).forEach(v => on ? fc.sel.add(v.id) : fc.sel.delete(v.id)); fcHist(); return; } const sel = e.target.closest('[data-sel]'); if (sel) { sel.checked ? fc.sel.add(sel.dataset.sel) : fc.sel.delete(sel.dataset.sel); return; }
    const b = e.target.closest('button[data-a]'), tr = e.target.closest('tr[data-id]'); if (!b || !tr) return; const v = fc.list.find(x => x.id === tr.dataset.id); if (!v) return; if (b.dataset.a === 'open') fcOpen(v.id, true); else if (b.dataset.a === 'print') fcPrintVs([v]); else if (b.dataset.a === 'mail') { window.extMailData = fcMailOf(v); wMail_open('ext'); } });
  q('#fhTable').addEventListener('dblclick', e => { const tr = e.target.closest('tr[data-id]'); if (tr && !e.target.closest('button,input')) fcOpen(tr.dataset.id, true); });
  const xl = d => { if (!d.rows.length) { sectionToast('Nothing to export.', 'warn'); return; } const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.headers, ...d.rows]), d.sheet.slice(0, 31)); XLSX.writeFile(wb, d.sheet.replace(/\s+/g, '_') + '.xlsx'); addActivity('export', d.title); };
  q('#fhExcel').addEventListener('click', () => xl(fcHistData())); q('#fhPrint').addEventListener('click', () => { const d = fcHistData(); if (!d.rows.length) { sectionToast('Nothing to print.', 'warn'); return; } w_printTable(d.title, d.note, d.headers, d.rows); }); q('#fhEmail').addEventListener('click', () => { if (!fcHistData().rows.length) { sectionToast('Nothing to email.', 'warn'); return; } window.extMailData = fcHistData; wMail_open('ext'); });
  q('#fhExpand').addEventListener('click', () => { const d = fcHistData(), tb = document.createElement('table'); tb.id = 'fcExpTable'; tb.dataset.title = d.title; tb.innerHTML = '<thead><tr>' + d.headers.map(x => '<th>' + fcE(x) + '</th>').join('') + '</tr></thead><tbody>' + d.rows.map(r => '<tr>' + r.map(v => '<td>' + fcE(v == null ? '' : v) + '</td>').join('') + '</tr>').join('') + '</tbody>'; if (window.tableExpandOpen) window.tableExpandOpen(tb); });
  q('#fhUpload').addEventListener('click', () => { const sel = fc.list.filter(v => fc.sel.has(v.id)), vs = sel.length ? sel : fcFiltered(); fcUpload(vs, q('#fhUpMode').value, q('#fhUpStatus'), q('#fhUpProg')); });
  q('#fhBackup').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ app: 'nfpc-foc', exported: fcNowIso(), vouchers: fc.list }, null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `FOC_vouchers_backup_${fcToday()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); addActivity('export', 'FOC vouchers backup'); });
  q('#fhRestore').addEventListener('click', () => q('#fhFile').click());
  q('#fhFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const d = JSON.parse(await f.text()), arr = Array.isArray(d) ? d : d.vouchers; if (!Array.isArray(arr) || !arr.every(v => v && v.id && v.no && Array.isArray(v.items))) throw new Error('This is not a FOC voucher backup file.'); let add = 0, upd = 0;
    arr.forEach(v => { v.req = v.req || fcBlankP(); v.iss = v.iss || fcBlankP(); v.apr = v.apr || fcBlankP(); const i = fc.list.findIndex(x => x.id === v.id); if (i >= 0) { if ((v.updated || '') > (fc.list[i].updated || '')) { fc.list[i] = v; fcPut(v); upd++; } } else { fc.list.push(v); fcPut(v); add++; } });
    sectionToast(`Restored: ${add} added, ${upd} updated.`, 'success'); fcKpis(); fcTabs(); fcDatalists(); fcHist(); } catch (err) { sectionToast('Restore failed: ' + err.message, 'warn'); } });
  window.addEventListener('beforeunload', ev => { if (document.querySelector('#view-foc.active') && fcDirty()) { ev.preventDefault(); ev.returnValue = ''; } });
}
async function fcOpenView() { fcInit(); if (!fc.loaded) { fc.list = (await fcLoadAll()).map(v => { v.req = v.req || fcBlankP(); v.iss = v.iss || fcBlankP(); v.apr = v.apr || fcBlankP(); v.items = v.items || []; return v; }); fc.loaded = true; } if (!fc.cur) { fc.cur = fcBlank(); fc.saved = fcSnap(fc.cur); } fcDatalists(); fcWrite(); fcKpis(); fcTabs(); fcShowTab(); }
document.querySelectorAll('.nav-item[data-view="foc"]').forEach(n => n.addEventListener('click', () => setTimeout(fcOpenView, 0)));

/* ============================================================
   KPI layouts for Oasis Prism Upload + Daily Update Tracker
   and multi-select row filter / selection for “New Rows Preview”
   ============================================================ */
const incX = { f: {}, fq: '', excl: new Set(), shown: 200, forRows: null, cols: [] };
const incXk = (l, v, s, c) => `<div class="pl-kpi"${c ? ` style="border-left:4px solid ${c}"` : ''}><div class="lbl">${escapeHtml(l)}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`;
const incXf = v => Number(v || 0).toLocaleString();
function incX_reset() { incX.f = {}; incX.fq = ''; incX.excl = new Set(); incX.shown = 200; }
function incX_cols() { const s = incUploadState, skip = (typeof INC_SKIP_DEFAULT !== 'undefined' ? INC_SKIP_DEFAULT : []); return (s.parsedHeaders || []).filter(h => !skip.includes(String(h).toLowerCase())); }
function incX_match(r) {
  for (const c of Object.keys(incX.f)) { const vals = incX.f[c]; if (vals && vals.length && !vals.includes(String(r[c] == null ? '' : r[c]))) return false; }
  const terms = incX.fq.toLowerCase().split(/\s+/).filter(Boolean); if (terms.length) { const t = incX_cols().map(c => String(r[c] == null ? '' : r[c])).join(' | ').toLowerCase(); if (!terms.every(x => t.includes(x))) return false; }
  return true;
}
const incX_view = () => (incUploadState.newRows || []).filter(incX_match);
const inc_uploadRows = () => incX_view().filter(r => !incX.excl.has(r));
const incX_filtersOn = () => Object.values(incX.f).some(a => a && a.length) || !!incX.fq.trim();

function inc_kpis() {
  const el = document.querySelector('#incKpis'); if (!el) return; const s = incUploadState, L = s.lastResult, has = s.parsedRows && s.parsedRows.length, up = has ? inc_uploadRows().length : 0, nw = has && s.newRows ? s.newRows.length : 0;
  const ex = L ? L.existingDup : 0, fd = L ? L.inFileDup : 0, tot = has ? s.parsedRows.length : 0, dash = '—', ok = s.sessionOk || 0, bad = s.sessionFail || 0;
  el.innerHTML = incXk('Rows in file', has ? incXf(tot) : dash, has ? escapeHtml(s.fileName || '') : 'Drop the cumulative report in step 3') + incXk('Already in the list', has ? incXf(ex) : dash, has && tot ? Math.round(ex / tot * 100) + '% of the file — skipped' : '', '#64748b') + incXk('Duplicates in file', has ? incXf(fd) : dash, 'repeated keys — skipped', '#d97706') + incXk('New rows', has ? incXf(nw) : dash, has && tot ? Math.round(nw / tot * 100) + '% of the file' : '', '#2a78d6')
    + incXk('Selected to upload', has ? incXf(up) : dash, has ? (incX_filtersOn() ? 'filters on · ' : '') + `of ${incXf(nw)} new row(s)` : '', '#0b7a0b') + incXk('Uploaded this session', incXf(ok), bad ? `<span style="color:#b42318">${incXf(bad)} failed</span>` : 'no failures', '#0b7a0b') + incXk('In the target list', s.existingCount != null && s.listId ? incXf(s.existingCount) : dash, s.listName ? escapeHtml(s.listName) : 'Pick a list in step 1');
  const bar = document.querySelector('#incBar'); if (bar) { const t = Math.max(1, tot), seg = (n, c, l) => n ? `<div title="${l}: ${incXf(n)}" style="width:${n / t * 100}%;background:${c}"></div>` : ''; bar.innerHTML = has ? seg(nw, '#2a78d6', 'New') + seg(ex, '#94a3b8', 'Already in list') + seg(fd, '#f0a020', 'Duplicate in file') : ''; bar.style.display = has ? 'flex' : 'none'; }
}

function incX_filterUi() {
  const host = document.querySelector('#incFilters'); if (!host) return; const s = incUploadState, cols = incX_cols(), rows = s.newRows || [], sig = cols.join('|') + '#' + rows.length + '#' + JSON.stringify(incX.f); if (host.dataset.sig === sig) return; host.dataset.sig = sig; host.innerHTML = '';
  const active = Object.keys(incX.f); const chip = c => { const vals = [...new Set(rows.map(r => String(r[c] == null ? '' : r[c])))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 3000), w = document.createElement('div'); w.className = 'ro-cf'; w.innerHTML = `<label>${escapeHtml(c)} <a href="#" data-rm="${escapeHtml(c)}" title="Remove this filter">✖</a></label>`; w.appendChild(buildMultiCombo(incX.f[c] || [], vals, arr => { incX.f[c] = arr; incX.shown = 200; host.dataset.sig = ''; inc_renderPreview(); }, { placeholder: 'All — pick one or more…' })); return w; };
  active.forEach(c => host.appendChild(chip(c)));
  const add = document.createElement('div'); add.className = 'ro-cf'; add.innerHTML = `<label>&nbsp;</label><select><option value="">＋ Filter by column…</option>${cols.filter(c => !active.includes(c)).map(c => `<option>${escapeHtml(c)}</option>`).join('')}</select>`; add.querySelector('select').addEventListener('change', e => { if (!e.target.value) return; incX.f[e.target.value] = []; host.dataset.sig = ''; inc_renderPreview(); }); host.appendChild(add);
  host.onclick = e => { const a = e.target.closest('a[data-rm]'); if (!a) return; e.preventDefault(); delete incX.f[a.dataset.rm]; incX.shown = 200; host.dataset.sig = ''; inc_renderPreview(); };
}

/* replaces the original preview renderer */
const INCP_COLS = ['Picking_List_No', 'DN_No'];
function incX_showCols() {
  const s = incUploadState, keyC = s.keyColumns || [], split = (typeof INC_SPLIT_FIELDS !== 'undefined' ? INC_SPLIT_FIELDS : []), cols0 = incX_cols().filter(h => !INCP_COLS.includes(h));
  return [...new Set([...keyC, ...split.filter(f => s.parsedHeaders.includes(f)), ...Object.keys(incX.f).filter(h => !INCP_COLS.includes(h)), ...cols0.filter(h => !keyC.includes(h) && !split.includes(h)).slice(0, 8)])].slice(0, 16).concat(INCP_COLS.filter(h => (s.parsedHeaders || []).includes(h)));
}
function inc_renderPreview() {
  const head = $('incUploadPreviewHead'), body = $('incUploadPreviewBody'), countEl = $('incUploadPreviewCount'); if (!head || !body) return; const s = incUploadState, all = s.newRows || [];
  if (incX.forRows !== s.parsedRows) { incX.forRows = s.parsedRows; incX_reset(); document.querySelector('#incFilters').dataset.sig = ''; const q = document.querySelector('#incQ'); if (q) q.value = ''; }
  const view = incX_view(), up = view.filter(r => !incX.excl.has(r)).length; countEl.textContent = `${incXf(up)} of ${incXf(all.length)} selected`;
  const info = document.querySelector('#incSelInfo'); if (info) info.innerHTML = all.length ? `<strong>${incXf(up)}</strong> row(s) will be uploaded` + (incX_filtersOn() ? ` — the <strong>${incXf(view.length)}</strong> that match your filters` : ' — all new rows') + (view.length - up ? ` (${incXf(view.length - up)} unticked)` : '') + (all.length - view.length ? `. <span style="color:var(--gray-500)">${incXf(all.length - view.length)} hidden by the filters are <u>not</u> uploaded.</span>` : '.') : '';
  incX_filterUi();
  if (!all.length) { head.innerHTML = ''; body.innerHTML = `<tr><td style="padding:20px;text-align:center;color:var(--gray-400);font-style:italic;">No new rows to show.</td></tr>`; inc_kpis(); return; }
  const showCols = incX_showCols();
  head.innerHTML = `<tr><th style="width:34px"><input type="checkbox" id="incSelAll" style="width:auto" title="Tick / untick every row that matches the filters"></th>${showCols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
  const sh = view.slice(0, incX.shown), idx = new Map(all.map((r, i) => [r, i]));
  body.innerHTML = sh.map(r => `<tr class="${incX.excl.has(r) ? 'inc-off' : ''}" data-i="${idx.get(r)}"><td><input type="checkbox" data-pick style="width:auto" ${incX.excl.has(r) ? '' : 'checked'}></td>${showCols.map(c => `<td title="${escapeHtml(String(r[c] ?? ''))}">${escapeHtml(String(r[c] ?? '').slice(0, 60))}</td>`).join('')}</tr>`).join('') +
    (!sh.length ? `<tr><td colspan="${showCols.length + 1}" style="text-align:center;color:var(--gray-400);font-style:italic;padding:16px;">No new rows match the filters.</td></tr>` : '') + (view.length > sh.length ? `<tr><td colspan="${showCols.length + 1}" style="text-align:center;"><button type="button" class="ghost small" id="incMore">Show 200 more (${incXf(view.length - sh.length)} left)</button></td></tr>` : '');
  const sa = document.querySelector('#incSelAll'); if (sa) sa.checked = view.length > 0 && view.every(r => !incX.excl.has(r));
  inc_kpis();
}
function incX_refresh() { inc_renderPreview(); if (typeof inc_updateReadySummary === 'function') inc_updateReadySummary(); }
(function incXInit() {
  const q = s => document.querySelector(s), body = q('#incUploadPreviewBody'); if (!body) return;
  body.addEventListener('change', e => { const cb = e.target.closest('input[data-pick]'); if (!cb) return; const tr = cb.closest('tr'), r = incUploadState.newRows[+tr.dataset.i]; if (!r) return; cb.checked ? incX.excl.delete(r) : incX.excl.add(r); tr.classList.toggle('inc-off', !cb.checked); incX_refresh(); });
  body.addEventListener('click', e => { if (e.target.id === 'incMore') { incX.shown += 200; inc_renderPreview(); } });
  q('#incUploadPreviewHead').addEventListener('change', e => { if (e.target.id !== 'incSelAll') return; const v = incX_view(); e.target.checked ? v.forEach(r => incX.excl.delete(r)) : v.forEach(r => incX.excl.add(r)); incX_refresh(); });
  q('#incQ').addEventListener('input', e => { incX.fq = e.target.value; incX.shown = 200; incX_refresh(); });
  q('#incSelShown').addEventListener('click', () => { const v = new Set(incX_view()); (incUploadState.newRows || []).forEach(r => v.has(r) ? incX.excl.delete(r) : incX.excl.add(r)); incX_refresh(); });
  q('#incSelAllBtn').addEventListener('click', () => { incX.excl = new Set(); incX_refresh(); });
  q('#incSelNone').addEventListener('click', () => { incX_view().forEach(r => incX.excl.add(r)); incX_refresh(); });
  q('#incFClear').addEventListener('click', () => { incX.f = {}; incX.fq = ''; q('#incQ').value = ''; q('#incFilters').dataset.sig = ''; incX_refresh(); });
  q('#incUploadClearBtn').addEventListener('click', () => setTimeout(() => { incX.forRows = null; incX_reset(); inc_kpis(); }, 0));
  inc_kpis();
})();

/* ---------- Daily Update Tracker KPIs ---------- */
function dtkKpis(md) {
  const wrap = document.querySelector('#dtkKpiWrap'); if (!wrap) return; if (!md || !md.locs.length) { wrap.style.display = 'none'; return; } wrap.style.display = '';
  const d = dtrk.data, locs = md.locs, e = md.elapsed, places = locs.length, exp = places * e, filled = locs.reduce((a, l) => a + l.done, 0), full = locs.filter(l => l.missing === 0).length, today = md.days.find(x => x.today), elapsedDays = md.days.filter(x => !x.future);
  const cnt = (l, k) => l.m.get(k) || 0, recs = locs.reduce((a, l) => a + elapsedDays.reduce((b, x) => b + cnt(l, x.key), 0), 0), tdone = today ? locs.filter(l => cnt(l, today.key) > 0).length : null;
  const sorted = locs.slice().sort((a, b) => a.done / (a.elapsed || 1) - b.done / (b.elapsed || 1)), worst = sorted[0], k = (l, v, s, c) => incXk(l, v, s, c), pct = x => exp ? Math.round(x / exp * 100) + '%' : '—';
  document.querySelector('#dtkKpis').innerHTML = k('Places tracked', incXf(places), `${incXf(e)} day(s) elapsed · ${escapeHtml(d.from)} → ${escapeHtml(d.to)}`) + k('Update rate', pct(filled), `${incXf(filled)} of ${incXf(exp)} place-days updated`, '#0b7a0b') + k('Updated every day', incXf(full), `${places ? Math.round(full / places * 100) : 0}% of places`, '#0b7a0b') + k('Places with gaps', incXf(places - full), `${incXf(exp - filled)} missing place-day(s)`, places - full ? '#b42318' : '#64748b')
    + k('Today', tdone == null ? '—' : `${incXf(tdone)} / ${incXf(places)}`, tdone == null ? 'today is outside the range' : (places - tdone ? `${incXf(places - tdone)} not updated yet` : 'all updated ✅'), '#2a78d6') + k('Records in range', incXf(recs), `${filled ? (recs / filled).toFixed(1) : '0'} per updated place-day`) + k('Most gaps', worst ? escapeHtml(worst.name) : '—', worst ? `${incXf(worst.missing)} missing of ${incXf(worst.elapsed)} day(s)` : '', '#d97706');
  const T = plT(), g = document.querySelector('#dtkGrid');
  g.innerHTML = `<div class="pl-card s6"><div class="pl-ch"><h3>Update rate by place</h3><div class="sub">Share of elapsed days with data — lowest first</div></div><div class="pl-body" id="dtkB1"></div></div><div class="pl-card s6"><div class="pl-ch"><h3>Daily coverage</h3><div class="sub">Share of places that updated on each day</div></div><div class="pl-body" id="dtkB2"></div></div>`;
  const rows = sorted.slice(0, 12).map(l => ({ label: l.name, vals: [l.elapsed ? l.done / l.elapsed * 100 : 0], tip: [{ c: T.act, k: 'Updated', v: `${l.done} of ${l.elapsed} days` }, { k: 'Missing', v: String(l.missing) }] }));
  plcBarsH(document.querySelector('#dtkB1'), { rows, series: [{ name: 'Update rate', color: T.act }], fmt: v => Math.round(v) + '%', tickFmt: v => v + '%', thick: 14, minMax: 100 });
  const dd = elapsedDays.map(x => ({ x, v: places ? locs.filter(l => cnt(l, x.key) > 0).length / places * 100 : 0 }));
  plcLine(document.querySelector('#dtkB2'), { x: dd.map(o => o.x.label.slice(0, 5)), series: [{ name: 'Places updated', vals: dd.map(o => o.v), color: T.act }], fmt: v => Math.round(v) + '%', tickFmt: v => Math.round(v) + '%', zero: true, ref: 100, height: 230, area: true });
}

/* ===== Oasis Prism Upload — printable Picking list / Delivery note for the rows chosen in "New Rows Preview" ===== */
const INCP = {
  pl: { col: 'Picking_List_No', prefix: 'PL', title: 'Picking List', tick: 'Picked', sigs: ['Picked by', 'Checked by', 'Loaded by'], alias: ['pickinglistno', 'pickinglist', 'pickno', 'plno', 'documentno', 'docno', 'printno', 'barcode'] },
  dn: { col: 'DN_No', prefix: 'DN', title: 'Delivery Note', tick: 'Received', sigs: ['Issued by', 'Driver', 'Received by (name / stamp)'], alias: ['dnno', 'deliverynoteno', 'deliverynote', 'deliveryno', 'dnnumber', 'documentno', 'docno', 'printno', 'barcode'] }
};
const incP = { log: [], last: null };
try { incP.log = JSON.parse(localStorage.getItem(LS_BASE + '_incprints') || '[]'); } catch (e) { incP.log = []; }
const incP_filterText = () => { const f = Object.entries(incX.f || {}).filter(([, v]) => v && v.length).map(([c, v]) => `${c}: ${[...v].join(', ')}`); if (incX.fq) f.push(`search “${incX.fq}”`); return f.join(' · '); };

function incP_stamp(kind, rows, no) {
  const s = incUploadState, D = INCP[kind];
  rows.forEach(r => { r[D.col] = no; });
  if (!s.parsedHeaders.includes(D.col)) s.parsedHeaders.push(D.col);
  let mapped = '';
  if (s.columns && s.columns.length) {
    if (s.mapping[D.col] === undefined || s.mapping[D.col] === SKIP_VALUE) {
      const nz = typeof normalize === 'function' ? normalize : (x => String(x).toLowerCase().replace(/[^a-z0-9]/g, ''));
      let hit = s.columns.find(c => nz(c.name) === nz(D.col) || nz(c.displayName || '') === nz(D.col));
      if (!hit) for (const al of D.alias) { hit = s.columns.find(c => nz(c.name) === al || nz(c.displayName || '') === al); if (hit) break; }
      if (hit) s.mapping[D.col] = hit.name; else if (s.mapping[D.col] === undefined) s.mapping[D.col] = SKIP_VALUE;
    }
    if (s.mapping[D.col] && s.mapping[D.col] !== SKIP_VALUE) mapped = s.mapping[D.col];
  }
  try { inc_renderMapping(); inc_updateReadySummary(); } catch (e) {}
  incX_refresh();
  return mapped;
}

function incP_print(kind, pv) {   // pv = preview only (used by the print setup window)
  const s = incUploadState, D = INCP[kind], rows = inc_uploadRows();
  if (!rows.length) { if (!pv) sectionToast('Nothing to print — tick at least one new row (or clear the filters).', 'warn'); return ''; }
  const cols = incX_showCols().filter(c => !INCP_COLS.includes(c)), no = pv ? 'PREVIEW' : npDocNo(D.prefix);
  const isQty = (c, i) => /qty|quantity|pcs|pieces|carton|pallet|weight|amount|units/i.test(c) && rows.every(r => r[c] == null || r[c] === '' || !isNaN(parseFloat(String(r[c]).replace(/,/g, ''))));
  const qIdx = cols.map((c, i) => isQty(c, i) ? i : -1).filter(i => i >= 0);
  const data = rows.map(r => cols.map((c, i) => { const v = r[c]; if (qIdx.includes(i)) return v == null || v === '' ? '' : parseFloat(String(v).replace(/,/g, '')); return v == null ? '' : String(v); }));
  const totals = qIdx.length ? cols.map((c, i) => i === 0 ? 'TOTAL' : qIdx.includes(i) ? data.reduce((t, r) => t + (Number(r[i]) || 0), 0) : '') : null;
  const keyIdx = cols.indexOf((s.keyColumns || [])[0]), ft = incP_filterText();
  const mapped = pv ? '' : incP_stamp(kind, rows, no);
  const doc = plPfApplyU(pv, npTableDoc({ landscape: plPfLoad('inc' + kind).orient === 'landscape',
    title: D.title, no, prefix: D.prefix, sub: `${s.fileName || 'Oasis Prism upload'} · ${rows.length} line(s)`, headers: cols, rows: data, totals, tick: D.tick, scanCol: keyIdx >= 0 ? keyIdx : null, sigs: D.sigs, num: qIdx,
    meta: [['Source file', s.fileName || '—'], ['Target SharePoint list', s.listName || '—'], ['Lines', rows.length], ['Selected of new rows', `${rows.length} of ${(s.newRows || []).length}`], ['Filters', ft || 'None (all ticked rows)'], ...(totals ? [['Total quantity', qIdx.map(i => `${cols[i]}: ${Number(totals[i]).toLocaleString()}`).join(' · ')]] : [])]
  }), 'inc' + kind);
  if (pv) return doc;
  npOpenPrint(doc, `${D.title} ${no}`);
  const entry = { no, kind, rows: rows.length, at: npNowStr(), by: npUser(), file: s.fileName || '', list: s.listName || '' };
  incP.last = entry; incP.log.unshift(entry); incP.log = incP.log.slice(0, 100); try { localStorage.setItem(LS_BASE + '_incprints', JSON.stringify(incP.log)); } catch (e) {}
  try { addActivity('export', `Printed ${D.title.toLowerCase()} ${no} (${rows.length} rows)`); } catch (e) {}
  incP_info(mapped);
  sectionToast(mapped ? `${D.title} ${no} opened in a new tab — the number will be uploaded to column “${mapped}”.` : `${D.title} ${no} opened in a new tab. The number will NOT be uploaded yet — the administrator must map “${D.col}” to a column of the SharePoint list (Upload Destinations › Oasis Prism Upload).`, mapped ? 'success' : 'info');
}
function incP_info(mapped) {
  const el = document.querySelector('#incPInfo'); if (!el) return; const l = incP.last;
  el.innerHTML = l ? `Last printed: <strong>${escapeHtml(l.no)}</strong> · ${l.rows} row(s) · ${mapped ? 'uploads to “' + escapeHtml(mapped) + '”' : '<span style="color:var(--warning)">number not mapped — ask the administrator to map it in Upload Destinations</span>'}` : '';
}
(function incPInit() {
  const go = () => {
    const b = document.querySelector('#incSelShown'); if (!b || document.querySelector('#incPrintPL')) return false;
    const wrap = document.createElement('span'); wrap.style.cssText = 'display:inline-flex;gap:6px;flex-wrap:wrap;align-items:center;margin-left:auto';
    wrap.innerHTML = '<button id="incPrintPL" class="secondary small" type="button" title="Print a picking list of the rows that will be uploaded — with barcode and document number">🖨 Picking list</button><button id="incSetupPL" class="ghost small" type="button" title="Picking list: portrait or landscape, which fields to print and what to call them">⚙ Setup</button><button id="incPrintDN" class="secondary small" type="button" title="Print a delivery note of the rows that will be uploaded — with barcode and document number">🧾 Delivery note</button><button id="incSetupDN" class="ghost small" type="button" title="Delivery note: portrait or landscape, which fields to print and what to call them">⚙ Setup</button>';
    b.parentNode.appendChild(wrap);
    const info = document.createElement('div'); info.id = 'incPInfo'; info.className = 'text-sm'; info.style.cssText = 'margin:0 0 6px'; const f = document.querySelector('#incFilters'); f.parentNode.insertBefore(info, f);
    wrap.querySelector('#incPrintPL').addEventListener('click', () => incP_print('pl')); wrap.querySelector('#incPrintDN').addEventListener('click', () => incP_print('dn'));
    return true;
  };
  if (!go()) document.addEventListener('DOMContentLoaded', go);
})();

