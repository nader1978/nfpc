/* ============================================================
   RACK BALANCE + PALLET POSITION LIST
   1) rackBal(code, extraPallets) — capacity / used / free pallet positions of a rack lane and of its whole row (Location_Desc),
      from the rack setup (Store_Racks_Setup_tbl) and the stock balances (SKUs_Movements_Batch_tbl).
   2) Under "Store / pallet location *" (WHs Movements) and "Location code *" (Stock Movement Entry):
      a live line "free positions now → after this entry".
   3) 3D Warehouse View: 📋 Position list — SKU and quantity in every pallet position, with Excel / Print / Email.
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; };
  const fmt = n => (Math.round(n * 100) / 100).toLocaleString();
  const hist = () => { const W = window.WMVX; if (!W || !W.S) return null; if (!W.S.hist && !W.S.loading && !hist.asked) { hist.asked = 1; try { W.load(false); } catch (e) {} } return W.S.hist || null; };
  const ranges = a => { const g = []; a.forEach(p => { const l = g[g.length - 1]; if (l && l.b === p - 1) l.b = p; else g.push({ a: p, b: p }); }); return g.map(x => 'P' + x.a + (x.b > x.a ? '–P' + x.b : '')).join(', '); };

  /* pallets standing in a lane without a position number (received as "lane" stock) */
  function unposPallets(H, lc) { let n = 0; (H.sku || []).forEach(s => (s.batches || []).forEach(b => { const pm = b.pp && b.pp.get(lc); if (!pm) return; const e = pm.get(0); if (!e || !(e.qty > 1e-9)) return; n += e.vol > 0 ? e.vol / 100 : (s.upp > 0 ? e.qty / s.upp : 1); })); return n; }

  function laneBal(r, H) {
    const cap = Math.round(num(r.cap)), lc = String(r.code).toUpperCase(); if (!H) return { code: r.code, cap, known: false };
    const used = [], free = []; for (let p = 1; p <= cap; p++) ((H.pocc.get(lc + '#' + p) || 0) > 50 ? used : free).push(p);
    const lane = Math.ceil(unposPallets(H, lc) - 1e-9), fr = Math.max(0, free.length - lane);
    return { code: r.code, cap, known: true, used: used.length + Math.min(lane, free.length), free: fr, freeList: free.slice(lane), lanePal: lane, over: Math.max(0, lane - free.length) };
  }

  window.rackBal = function (code, extra) {
    if (typeof srkFind !== 'function') return null; const r = srkFind(code); if (!r) return null; const H = hist();
    const L = laneBal(r, H), rowR = (SRK.rows || []).filter(x => (x.loc || '') === (r.loc || '')), R = rowR.map(x => laneBal(x, H));
    const rowCap = R.reduce((a, x) => a + x.cap, 0), rowFree = R.reduce((a, x) => a + (x.free || 0), 0), ex = Math.max(0, Math.ceil(num(extra) - 1e-9));
    return { r, lane: L, row: { loc: r.loc || '', lanes: rowR.length, cap: rowCap, free: rowFree }, extra: ex, known: L.known, afterLane: L.known ? L.free - ex : null, afterRow: L.known ? rowFree - ex : null };
  };

  /* ---------- hint under the location field ---------- */
  const css = document.createElement('style'); css.textContent = `
.rbal{font-size:11.5px;line-height:1.35;margin-top:4px;padding:4px 7px;border-radius:7px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;max-width:340px;white-space:normal}
.rbal.w{background:#fffbeb;color:#92400e;border-color:#fde68a}.rbal.r{background:#fef2f2;color:#991b1b;border-color:#fecaca}.rbal b{font-weight:700}
#plBox{position:fixed;inset:0;z-index:2147482800;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}
#plBox .pl-c{background:var(--card,#fff);color:var(--text,#111827);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.3);width:min(1200px,100%);height:88vh;min-width:560px;min-height:300px;max-width:99vw;max-height:98vh;resize:both;display:flex;flex-direction:column;overflow:hidden}#plBox .pl-b{flex:1;min-height:0}#plBox .pl-f{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:0 14px 8px;border-bottom:1px solid var(--border,#e5e7eb)}#plBox .pl-f input,#plBox .pl-f select{width:auto;margin:0;min-width:120px}#plBox .pl-f .pl-t{font-size:11.5px;color:var(--gray-600,#4b5563)}#plBox tbody tr[data-sku]:hover td{background:rgba(30,58,138,.07)}
#plBox .pl-h{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid var(--border,#e5e7eb)}
#plBox .pl-h h3{margin:0 auto 0 0;font-size:16px}#plBox .pl-h input[type=search]{width:220px;margin:0}#plBox .pl-h select{width:auto;margin:0}
#plBox .pl-k{display:flex;gap:10px;flex-wrap:wrap;padding:8px 14px;font-size:12.5px;color:var(--gray-600,#4b5563)}#plBox .pl-k b{color:var(--text,#111827);font-size:14px}
#plBox .pl-b{overflow:auto;padding:0 14px 14px}#plBox table{width:100%;border-collapse:collapse;font-size:12.5px}
#plBox th{position:sticky;top:0;background:var(--gray-50,#f8fafc);text-align:left;padding:6px;border-bottom:1px solid var(--border,#e5e7eb);white-space:nowrap}
#plBox td{padding:5px 6px;border-top:1px solid var(--border,#eef0f3);vertical-align:top}#plBox td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
#plBox tr.e td{color:var(--gray-500,#9ca3af)}#plBox tr.x td.ex{color:#b91c1c;font-weight:700}#plBox tr.g td{background:rgba(30,58,138,.06);font-weight:700}
#plBox .pl-ft{display:none}
@media (max-width:760px){
#plBox{padding:0;align-items:stretch}
#plBox .pl-c{width:100vw;max-width:100vw;min-width:0;height:100vh;height:100dvh;max-height:100dvh;border-radius:0;resize:none}
#plBox .mdl-ctlw,#plBox .mdl-ctl{display:none !important}
#plBox .pl-h{padding:8px 10px;gap:6px}#plBox .pl-h h3{flex:1 1 100%;font-size:15px;margin:0}
#plBox .pl-h select,#plBox .pl-h input[type=search]{flex:1 1 46%;width:auto;min-width:0;font-size:14px;padding:7px 8px;height:auto}
#plBox .pl-h button{flex:1 1 auto;padding:8px 6px;font-size:13px;min-height:36px}
#plBox .pl-ft{display:inline-block}
#plBox .pl-f{display:none;padding:6px 10px 8px;gap:6px}#plBox.fo .pl-f{display:flex}
#plBox .pl-f input,#plBox .pl-f select{flex:1 1 46%;min-width:0;font-size:14px;padding:7px 8px}#plBox .pl-f .pl-t{flex:1 1 100%}
#plBox .pl-k{padding:6px 10px;gap:4px 12px;font-size:12px}#plBox .pl-k b{font-size:13px}
#plBox .pl-b{padding:0 6px 10px}#plBox table{font-size:12px}#plBox th,#plBox td{padding:6px 5px}
#plBox th{white-space:normal;line-height:1.15}#plBox table.pl-pos td:nth-child(11){white-space:nowrap}
#plBox table.pl-pos :is(th,td):is(:nth-child(1),:nth-child(2),:nth-child(3),:nth-child(4),:nth-child(5),:nth-child(10),:nth-child(14)){display:none}
#plBox table.pl-pos tfoot td{display:table-cell}
}`;
  document.head.appendChild(css);

  function hintFor(inp) {
    const tr = inp.closest('tr'); if (!tr) return; const td = inp.closest('td') || inp.parentElement; let h = td.querySelector(':scope > .rbal'); const code = String(inp.value || '').trim();
    if (!code) { if (h) h.remove(); return; }
    const tbl = tr.closest('table'), same = [...tbl.querySelectorAll('input[data-f="loc"]')].filter(x => String(x.value || '').trim().toUpperCase() === code.toUpperCase());
    const ext = same.reduce((a, x) => { const p = x.closest('tr').querySelector('[data-f="pal"]'); return a + (p ? num(p.value) : 0); }, 0);
    const B = window.rackBal(code, ext); let cls = '', html;
    if (!B) { cls = 'r'; html = '⚠ <b>' + esc(code) + '</b> is not in the rack setup'; }
    else if (!B.known) { cls = 'w'; html = '⏳ reading the stock balances… · ' + esc(B.r.code) + ' holds <b>' + B.lane.cap + '</b> pallet position(s)'; }
    else {
      const L = B.lane, aL = B.afterLane, aR = B.afterRow; cls = aL < 0 ? (aR < 0 ? 'r' : 'w') : '';
      html = `📦 <b>${esc(B.r.code)}</b>: <b>${L.free}</b> of ${L.cap} position(s) free${L.freeList.length && L.freeList.length <= 30 ? ' (' + ranges(L.freeList) + ')' : ''}${L.lanePal ? ' · ' + L.lanePal + ' pallet(s) without a position' : ''}`
        + (B.extra ? `<br>after this entry (${B.extra} pallet${B.extra > 1 ? 's' : ''}): <b>${Math.max(0, aL)}</b> free${aL < 0 ? ' — ' + (-aL) + ' spill to the next lanes' : ''}` : '')
        + (B.row.loc ? `<br>row ${esc(B.row.loc)} (${B.row.lanes} lane${B.row.lanes > 1 ? 's' : ''}): <b>${B.extra ? Math.max(0, aR) : B.row.free}</b> of ${B.row.cap} free${B.extra ? ' after this entry' : ''}${aR < 0 ? ' ⚠ not enough room' : ''}` : '');
    }
    if (!h) { h = document.createElement('div'); h.className = 'rbal'; td.appendChild(h); }
    if (h.innerHTML !== html) h.innerHTML = html; h.className = 'rbal' + (cls ? ' ' + cls : '');
  }
  const scan = () => document.querySelectorAll('#wmvLines input[data-f="loc"], #view-smv .smv-t input[data-f="loc"]').forEach(i => { if (i.offsetParent !== null || i.closest('td')) hintFor(i); });
  let t0 = 0; const soon = () => { clearTimeout(t0); t0 = setTimeout(scan, 120); };
  ['input', 'change'].forEach(ev => document.addEventListener(ev, e => { const f = e.target && e.target.dataset && e.target.dataset.f; if (f === 'loc' || f === 'pal' || f === 'pos') soon(); }, true));
  setInterval(scan, 1500);

  /* ---------- 3D: pallet position list ---------- */
  const PL = { q: '', only: 'all', scope: 'view', rep: 'pos', fz: '', fs: '', fb: '', fr: '', stack: [] };   /* rep: pos = every pallet position · batch = balance per SKU & batch · sku = balance per SKU */
  const selv = id => { const e = Q(id); return e ? String(e.value || '') : ''; };
  function plRows() {
    const A = window.w3Api; if (!A || !A.slots) return null; const S = A.slots() || [], z = A.zone(), a = selv('#w3Aisle'), b = selv('#w3Bay'), l = selv('#w3Lvl');
    const fz = PL.fz, fs = PL.fs.trim().toLowerCase(), fb = PL.fb.trim().toLowerCase(), fr = PL.fr.trim().toLowerCase(), inScope = s => (!fz || s.zone === fz) && (!fr || String(s.code).toLowerCase().includes(fr)) && (PL.scope === 'all' || (s.zone === z && (!a || String(s.aisle) === a) && (!b || String(s.bay) === b) && (!l || l === '0' || String(s.lvl) === l)));
    const q = PL.q.trim().toLowerCase(), out = [], only = PL.rep === 'pos' ? PL.only : 'all';
    S.filter(inScope).sort((x, y) => String(x.zone).localeCompare(y.zone) || x.aisle - y.aisle || x.bay - y.bay || x.lvl - y.lvl || x.pos - y.pos || String(x.code).localeCompare(String(y.code), undefined, { numeric: true })).forEach(s => {
      const pos = s.code, base = [s.zone, s.aisle, s.bay, s.lvl, s.l3p ? s.pos : (s.pos || '')];
      if (!s.occ) { if (only === 'occ' || fs || fb) return; if (q && !String(pos).toLowerCase().includes(q)) return; out.push({ e: 1, r: [...base, pos, '', '', '', '', '', 0, 0, s.cap || ''] }); return; }
      if (only === 'empty') return;
      (s.lines || []).forEach(x => { if (fs && !(String(x.sku).toLowerCase().includes(fs) || String(x.dtls || '').toLowerCase().includes(fs))) return; if (fb && !String(x.batch || '').toLowerCase().includes(fb)) return; if (q && ![pos, x.sku, x.dtls, x.batch].join(' ').toLowerCase().includes(q)) return; const d = x.days;
        out.push({ x: d != null && d < 0, r: [...base, pos, x.sku, x.dtls || '', x.batch || '', x.prod || '', x.exp || '', Math.round(x.qty * 100) / 100, Math.round(x.pal * 100) / 100, s.cap || ''] }); });
    });
    return out;
  }
  const HDR = ['Warehouse', 'Aisle', 'Bay', 'Level', 'Pos', 'Pallet position', 'SKU', 'Description', 'Batch', 'Production', 'Expiry', 'Qty (PC)', 'Pallets', 'Capacity'];
  /* the two summary reports are built from the same filtered lines as the position list (search + scope apply; empty positions are left out) */
  const dleft = e => { if (!e) return ''; const t = new Date(e + 'T00:00:00'); return isNaN(t) ? '' : Math.round((t - new Date(new Date().toDateString())) / 864e5); };
  function plSum(R, by) { const M = new Map(); R.filter(x => !x.e).forEach(x => { const r = x.r, k = by === 'sku' ? r[6] : r[6] + '\u0001' + r[8]; let g = M.get(k); if (!g) M.set(k, g = { sku: r[6], dtls: r[7], batch: r[8], prod: r[9], exp: r[10], qty: 0, pal: 0, pos: new Set(), bat: new Set(), exps: [] });
        g.qty += num(r[11]); g.pal += num(r[12]); g.pos.add(r[5]); if (r[8]) g.bat.add(r[8]); if (r[10]) g.exps.push(r[10]); if (!g.dtls && r[7]) g.dtls = r[7]; if (by !== 'sku') { if (!g.prod || (r[9] && r[9] < g.prod)) g.prod = r[9] || g.prod; if (!g.exp && r[10]) g.exp = r[10]; } });
    const L = [...M.values()]; L.forEach(g => { g.qty = Math.round(g.qty * 100) / 100; g.pal = Math.round(g.pal * 100) / 100; if (by === 'sku') g.exp = g.exps.sort()[0] || ''; });
    L.sort((a, b) => String(a.sku).localeCompare(String(b.sku), undefined, { numeric: true }) || String(a.exp || '9999').localeCompare(String(b.exp || '9999')) || String(a.batch).localeCompare(String(b.batch), undefined, { numeric: true })); return L; }
  const HDR_B = ['SKU', 'Description', 'Batch', 'Production', 'Expiry', 'Days left', 'Qty (PC)', 'Pallets', 'Positions'], HDR_S = ['SKU', 'Description', 'Batches', 'Earliest expiry', 'Days left', 'Qty (PC)', 'Pallets', 'Positions'];
  const plFlt = () => [PL.fz && 'warehouse ' + PL.fz, PL.fs && 'SKU ' + PL.fs, PL.fb && 'batch ' + PL.fb, PL.fr && 'rack ' + PL.fr].filter(Boolean).map(x => ' · ' + x).join('');
  function plData() { if (PL.rep !== 'pos') { const R = plRows() || [], by = PL.rep, L = plSum(R, by), z = window.w3Api ? w3Api.zone() : '', scope = PL.scope === 'all' ? 'all warehouses' : [z, selv('#w3Aisle') && 'aisle ' + selv('#w3Aisle'), selv('#w3Bay') && 'bay ' + selv('#w3Bay'), selv('#w3Lvl') && selv('#w3Lvl') !== '0' && 'level ' + selv('#w3Lvl')].filter(Boolean).join(' · ');
      const rows = by === 'sku' ? L.map(g => [g.sku, g.dtls, g.bat.size, g.exp, dleft(g.exp), g.qty, g.pal, g.pos.size]) : L.map(g => [g.sku, g.dtls, g.batch, g.prod, g.exp, dleft(g.exp), g.qty, g.pal, g.pos.size]), qi = by === 'sku' ? 5 : 6, tq = Math.round(L.reduce((a, g) => a + g.qty, 0) * 100) / 100, tp = Math.round(L.reduce((a, g) => a + g.pal, 0) * 100) / 100, tot = new Set(R.filter(x => !x.e).map(x => x.r[5])).size;
      const totals = (by === 'sku' ? HDR_S : HDR_B).map((h, i) => i === 0 ? 'Total' : i === qi ? tq : i === qi + 1 ? tp : i === qi + 2 ? tot : '');
      return { title: by === 'sku' ? 'Stock balance per SKU' : 'Stock balance per SKU & batch', sheet: by === 'sku' ? 'Balance per SKU' : 'Balance per SKU & batch', note: scope + ' · ' + L.length + (by === 'sku' ? ' SKU(s)' : ' SKU / batch line(s)') + (PL.q ? ' · search "' + PL.q + '"' : '') + plFlt() + ' · ' + new Date().toLocaleString(), headers: by === 'sku' ? HDR_S : HDR_B, rows, totals, _S: 1, scope, tq, tp, n: L.length, occ: tot, qi }; }
    const R = plRows() || [], occ = new Set(R.filter(x => !x.e).map(x => x.r[5])), z = window.w3Api ? w3Api.zone() : '';
    const scope = PL.scope === 'all' ? 'all warehouses' : [z, selv('#w3Aisle') && 'aisle ' + selv('#w3Aisle'), selv('#w3Bay') && 'bay ' + selv('#w3Bay'), selv('#w3Lvl') && selv('#w3Lvl') !== '0' && 'level ' + selv('#w3Lvl')].filter(Boolean).join(' · ');
    const tq = R.reduce((a, x) => a + num(x.r[11]), 0), tp = R.reduce((a, x) => a + num(x.r[12]), 0);
    return { title: 'Pallet positions — SKU & quantity', sheet: 'Pallet positions', note: scope + ' · ' + occ.size + ' occupied position(s)' + (PL.q ? ' · search "' + PL.q + '"' : '') + plFlt() + ' · ' + new Date().toLocaleString(),
      headers: HDR, rows: R.map(x => x.r), totals: ['Total', '', '', '', '', occ.size + ' occupied', '', '', '', '', '', Math.round(tq * 100) / 100, Math.round(tp * 100) / 100, ''], _R: R, scope, tq, tp, occ: occ.size }; }
  function pl3d(box) { const R = plRows() || [], items = [], seen = new Set(); R.forEach(x => { if (x.e) return; const r = x.r, k = r[5] + '|' + r[6] + '|' + r[8]; if (seen.has(k)) return; seen.add(k); items.push({ n: items.length + 1, loc: r[5], pos: 0, sku: r[6], batch: r[8], take: num(r[11]) }); });
    const say = t => { if (typeof sectionToast === 'function') sectionToast(t, 'warn'); }; if (!items.length) return say('No occupied pallet positions in this selection to show in 3D.'); if (!window.W3Pick || !window.w3Api) return say('The 3D module is not loaded.');
    const zs = [...new Set(R.map(x => x.r[0]))], z = PL.fz || (zs.length === 1 ? zs[0] : ''); W3Pick.set(items.slice(0, 3000), 'Position list' + (z ? ' · ' + z : '')); if (box) box.remove();
    const nav = document.querySelector('.nav-item[data-view="wh3d"]'); if (nav) nav.click(); setTimeout(() => { try { if (z && w3Api.zone() !== z) w3Api.setZone(z); } catch (x) {} try { w3Api.zoomPicks(); } catch (x) {} }, 700); }
  function plDraw() {
    const box = Q('#plBox'); if (!box) return; const d = plData(); const tb = box.querySelector('table'); if (tb) tb.className = 'pl-' + PL.rep;
    const th = box.querySelector('thead tr'); if (th) th.innerHTML = (d.headers || HDR).map(h => '<th>' + h + '</th>').join('');
    if (d._S) { const H = d.headers, di = H.indexOf('Days left'), ni = d.qi, nums = new Set([ni, ni + 1, ni + 2, di, H.indexOf('Batches')].filter(i => i >= 0));
      box.querySelector('.pl-k').innerHTML = `<span>Scope <b>${esc(d.scope || '—')}</b></span><span>${PL.rep === 'sku' ? 'SKUs' : 'SKU / batch lines'} <b>${fmt(d.n)}</b></span><span>Quantity <b>${fmt(d.tq)}</b></span><span>Pallets <b>${fmt(d.tp)}</b></span><span>Occupied positions <b>${fmt(d.occ)}</b></span>`;
      box.querySelector('tbody').innerHTML = d.rows.slice(0, 3000).map(r => `<tr data-sku="${esc(r[0])}"${PL.rep === 'batch' ? ' data-b="' + esc(r[2]) + '"' : ''} title="Double-click to open the ${PL.rep === 'sku' ? 'batches' : 'pallet positions'}" style="cursor:pointer"${di >= 0 && r[di] !== '' && r[di] < 0 ? ' class="x"' : ''}>${r.map((v, i) => `<td class="${nums.has(i) ? 'n' : ''}${i === di && v !== '' && v < 0 ? ' ex' : ''}">${i === 0 ? '<b>' + esc(v) + '</b>' : nums.has(i) && typeof v === 'number' ? fmt(v) : esc(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${H.length}" style="text-align:center;padding:18px;color:var(--gray-600)">Nothing to show — load the 3D view first or change the filters.</td></tr>`;
      box.querySelector('tfoot').innerHTML = d.rows.length ? `<tr class="g">${d.totals.map((v, i) => `<td class="${nums.has(i) ? 'n' : ''}">${i === ni || i === ni + 1 || i === ni + 2 ? fmt(v) : esc(v)}</td>`).join('')}</tr>` : ''; return; }
    const R = d._R, emp = new Set(R.filter(x => x.e).map(x => x.r[5])).size;
    box.querySelector('.pl-k').innerHTML = `<span>Scope <b>${esc(d.scope || '—')}</b></span><span>Occupied positions <b>${fmt(d.occ)}</b></span><span>Empty <b>${fmt(emp)}</b></span><span>SKU lines <b>${fmt(R.filter(x => !x.e).length)}</b></span><span>Quantity <b>${fmt(d.tq)}</b></span><span>Pallets <b>${fmt(d.tp)}</b></span>`;
    let last = '', h = ''; R.slice(0, 3000).forEach(x => { const r = x.r, first = r[5] !== last; last = r[5];
      h += `<tr data-sku="${esc(r[6])}" data-b="${esc(r[8])}" class="${x.e ? 'e' : ''}${x.x ? ' x' : ''}"><td>${first ? esc(r[0]) : ''}</td><td class="n">${first ? r[1] : ''}</td><td class="n">${first ? r[2] : ''}</td><td class="n">${first ? r[3] : ''}</td><td class="n">${first ? r[4] : ''}</td><td>${first ? '<b>' + esc(r[5]) + '</b>' : ''}</td><td>${x.e ? '<i>empty</i>' : esc(r[6])}</td><td>${esc(r[7])}</td><td>${esc(r[8])}</td><td>${esc(r[9])}</td><td class="ex">${esc(r[10])}</td><td class="n">${x.e ? '' : fmt(r[11])}</td><td class="n">${x.e ? '' : fmt(r[12])}</td><td class="n">${esc(r[13])}</td></tr>`; });
    box.querySelector('tbody').innerHTML = h || '<tr><td colspan="14" style="text-align:center;padding:18px;color:var(--gray-600)">Nothing to show — load the 3D view first or change the filters.</td></tr>';
    box.querySelector('tfoot').innerHTML = R.length ? `<tr class="g"><td colspan="6">Total · ${fmt(d.occ)} occupied position(s)${R.length > 3000 ? ' · first 3,000 lines shown — Excel has all' : ''}</td><td colspan="5"></td><td class="n">${fmt(d.tq)}</td><td class="n">${fmt(d.tp)}</td><td></td></tr>` : '';
  }
  /* drill down: SKU report → its batches → its pallet positions; ◀ Back climbs up again */
  function plSync() { const b = Q('#plBox'); if (!b) return; [['fz', 'fz'], ['fs', 'fs'], ['fb', 'fb'], ['fr', 'fr'], ['q', 'q'], ['rep', 'rep']].forEach(([k, n]) => { const e = b.querySelector('[data-pl="' + n + '"]'); if (e) e.value = PL[k]; });
    const t = b.querySelector('[data-pl="ttl"]'); if (t) t.textContent = { pos: 'Pallet positions — SKU & quantity', batch: 'Stock balance per SKU & batch', sku: 'Stock balance per SKU' }[PL.rep]; const o = b.querySelector('[data-pl="only"]'); if (o) o.disabled = PL.rep !== 'pos'; plUp(); }
  function plUp() { const b = Q('#plBox'); const u = b && b.querySelector('[data-pl="up"]'); if (u) u.style.display = PL.stack.length ? '' : 'none'; }
  const plPop = () => PL.stack.pop();
  function plGo(st) { if (!st) return; PL.rep = st.rep; PL.fs = st.fs; PL.fb = st.fb; plSync(); plDraw(); }
  function plDrill(tr) { const sku = tr.dataset.sku; if (sku == null) return; PL.stack.push({ rep: PL.rep, fs: PL.fs, fb: PL.fb });
    if (PL.rep === 'sku') { PL.rep = 'batch'; PL.fs = sku; PL.fb = ''; } else if (PL.rep === 'batch') { PL.rep = 'pos'; PL.fs = sku; PL.fb = tr.dataset.b || ''; } else { PL.stack.pop(); return; }
    plSync(); plDraw(); }
  function plOpen() {
    if (!window.w3Api || !(w3Api.slots() || []).length) { if (typeof sectionToast === 'function') sectionToast('Load the 3D view first (Reload).', 'warn'); return; }
    let box = Q('#plBox'); if (box) box.remove(); box = document.createElement('div'); box.id = 'plBox'; box.dataset.nohc = '1';
    box.innerHTML = `<div class="pl-c"><div class="pl-h"><h3>📋 <span data-pl="ttl">Pallet positions — SKU &amp; quantity</span></h3>
      <select data-pl="rep" data-nosearch="1" title="Choose the report"><option value="pos">Report: pallet positions</option><option value="batch">Report: balance per SKU &amp; batch</option><option value="sku">Report: balance per SKU</option></select>
      <input type="search" data-pl="q" placeholder="🔍 Position, SKU, batch…" value="${esc(PL.q)}">
      <select data-pl="only" data-nosearch="1"><option value="all">All positions</option><option value="occ">Occupied only</option><option value="empty">Empty only</option></select>
      <select data-pl="scope" data-nosearch="1"><option value="view">As filtered on the 3D</option><option value="all">All my warehouses</option></select>
      <button class="secondary small" type="button" data-pl="3d" title="Show the occupied positions of the filtered warehouse in the 3D view">🧊 3D view</button><button class="secondary small" type="button" data-pl="mv" title="Inbound / outbound movements by SKU, batch and rack">📈 Movements</button><button class="secondary small pl-ft" type="button" data-pl="ft">🔎 Filters</button><button class="secondary small" type="button" data-pl="xl">📊 Excel</button><button class="secondary small" type="button" data-pl="pr">🖨 Print</button><button class="secondary small" type="button" data-pl="ml">✉ Email</button><button class="ghost small" type="button" data-pl="x">✕ Close</button></div>
      <div class="pl-f"><span class="pl-t">Filter</span><select data-pl="fz" data-nosearch="1" title="Warehouse"><option value="">All warehouses</option>${[...new Set((w3Api.slots() || []).map(x => x.zone))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(z => `<option value="${esc(z)}">${esc(z)}</option>`).join('')}</select>
        <input data-pl="fs" list="plSkuDl" placeholder="SKU / description" value="${esc(PL.fs)}"><datalist id="plSkuDl">${[...new Set((w3Api.slots() || []).flatMap(x => (x.lines || []).map(l => l.sku)))].sort().map(k => `<option value="${esc(k)}">`).join('')}</datalist>
        <input data-pl="fb" placeholder="Batch" value="${esc(PL.fb)}" style="min-width:100px"><input data-pl="fr" placeholder="Rack / position code" value="${esc(PL.fr)}">
        <button class="ghost small" type="button" data-pl="up" style="display:none">◀ Back</button><button class="ghost small" type="button" data-pl="clr">✕ Clear filters</button><span class="pl-t" data-pl="hint">Double-click a row to drill down: SKU → batches → pallet positions</span></div>
      <div class="pl-k"></div><div class="pl-b"><table><thead><tr>${HDR.map(h => '<th>' + h + '</th>').join('')}</tr></thead><tbody></tbody><tfoot></tfoot></table></div></div>`;
    document.body.appendChild(box); box.querySelector('[data-pl="rep"]').value = PL.rep; box.querySelector('[data-pl="rep"]').dispatchEvent(new Event('change', { bubbles: true })); box.querySelector('[data-pl="only"]').value = PL.only; box.querySelector('[data-pl="scope"]').value = PL.scope; box.querySelector('[data-pl="fz"]').value = PL.fz; plUp(); plDraw();
    box.addEventListener('click', e => { if (e.target === box) return box.remove(); const b = e.target.closest('button[data-pl]'); if (!b) return; const a = b.dataset.pl, d = () => { const x = plData(); delete x._R; return x; };
      if (a === '3d') pl3d(box); else if (a === 'mv') { box.remove(); if (window.mvOpen) mvOpen(); } else if (a === 'ft') box.classList.toggle('fo'); else if (a === 'up') plGo(plPop()); else if (a === 'clr') { PL.fz = PL.fs = PL.fb = PL.fr = PL.q = ''; PL.stack = []; plSync(); plDraw(); } else if (a === 'x') box.remove(); else if (a === 'xl') a2Export(d()); else if (a === 'pr') a2Print(d()); else if (a === 'ml') a2Mail(d); });
    let tapT = 0, tapR = null; box.addEventListener('click', e => { const tr = e.target.closest('tbody tr[data-sku]'); if (!tr) return; const n = Date.now(); if (tapR === tr && n - tapT < 450) { tapR = null; try { window.getSelection().removeAllRanges(); } catch (x) {} plDrill(tr); } else { tapR = tr; tapT = n; } });   /* double click / double tap */
    box.addEventListener('input', e => { const k = e.target.dataset.pl; if (k === 'q' || k === 'fs' || k === 'fb' || k === 'fr') { PL[k] = e.target.value; plDraw(); } });
    box.addEventListener('change', e => { const k = e.target.dataset.pl; if (k === 'fz') { PL.fz = e.target.value; return plDraw(); } if (k === 'only' || k === 'scope' || k === 'rep') { PL[k] = e.target.value; if (k === 'rep') { const t = box.querySelector('[data-pl="ttl"]'); if (t) t.textContent = { pos: 'Pallet positions — SKU & quantity', batch: 'Stock balance per SKU & batch', sku: 'Stock balance per SKU' }[PL.rep]; const o = box.querySelector('[data-pl="only"]'); if (o) o.disabled = PL.rep !== 'pos'; } plDraw(); } });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q('#plBox')) Q('#plBox').remove(); });
  function plBtn() { const bar = Q('#w3Body .w3bar'); if (!bar || Q('#w3PlBtn')) return; const b = document.createElement('button'); b.id = 'w3PlBtn'; b.type = 'button'; b.className = 'secondary small'; b.textContent = '📋 Position list';
    b.title = 'SKU and quantity in every pallet position — Excel / Print / Email'; b.addEventListener('click', plOpen); bar.appendChild(b); }
  setInterval(plBtn, 1500);
  window.plOpen = plOpen;
  /* the same report from WHs Movements (FEFO) and Stock Movement Entry — reads the racks in the background if the 3D view was not opened yet */
  let plBusy = false;
  async function plOpenExt() {
    if (plBusy) return; if (!window.w3Api) { if (typeof sectionToast === 'function') sectionToast('The 3D module is not loaded.', 'warn'); return; }
    if (!(w3Api.slots() || []).length) { plBusy = true; if (typeof sectionToast === 'function') sectionToast('⏳ Reading the racks and stock balances…', 'ok');
      try { w3Api.reload(); } catch (e) {} for (let i = 0; i < 160 && !(w3Api.slots() || []).length; i++) await new Promise(r => setTimeout(r, 500)); plBusy = false; }
    PL.scope = 'all'; plOpen(); }
  function plExtBtns() {
    const mk = () => { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary small'; b.dataset.plx = '1'; b.textContent = '📋 Position list'; b.title = 'SKU and quantity in every pallet position, balance per SKU & batch, balance per SKU — Excel / Print / Email'; b.addEventListener('click', plOpenExt); return b; };
    const a = Q('#smvFullBtn'); if (a && a.parentNode && !a.parentNode.querySelector('[data-plx]')) a.parentNode.insertBefore(mk(), a);
    const mkm = () => { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary small'; b.dataset.mvx = '1'; b.textContent = '📈 Movement report'; b.title = 'Inbound and outbound movements by SKU, batch and rack — Excel / Print / Email'; b.addEventListener('click', () => window.mvOpen && mvOpen()); return b; };
    [a, Q('button[data-a="reload"][title="Re-read balances from SharePoint"]')].forEach(x => { if (x && x.parentNode && !x.parentNode.querySelector('[data-mvx]')) x.parentNode.insertBefore(mkm(), x); });
    const w = Q('button[data-a="reload"][title="Re-read balances from SharePoint"]'); if (w && w.parentNode && !w.parentNode.querySelector('[data-plx]')) w.parentNode.insertBefore(mk(), w); }
  setInterval(plExtBtns, 1500); plExtBtns();
  window.plOpenExt = plOpenExt;
})();
