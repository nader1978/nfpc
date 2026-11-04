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
#plBox{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}
#plBox .pl-c{background:var(--card,#fff);color:var(--text,#111827);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.3);width:min(1200px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden}
#plBox .pl-h{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid var(--border,#e5e7eb)}
#plBox .pl-h h3{margin:0 auto 0 0;font-size:16px}#plBox .pl-h input[type=search]{width:220px;margin:0}#plBox .pl-h select{width:auto;margin:0}
#plBox .pl-k{display:flex;gap:10px;flex-wrap:wrap;padding:8px 14px;font-size:12.5px;color:var(--gray-600,#4b5563)}#plBox .pl-k b{color:var(--text,#111827);font-size:14px}
#plBox .pl-b{overflow:auto;padding:0 14px 14px}#plBox table{width:100%;border-collapse:collapse;font-size:12.5px}
#plBox th{position:sticky;top:0;background:var(--gray-50,#f8fafc);text-align:left;padding:6px;border-bottom:1px solid var(--border,#e5e7eb);white-space:nowrap}
#plBox td{padding:5px 6px;border-top:1px solid var(--border,#eef0f3);vertical-align:top}#plBox td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
#plBox tr.e td{color:var(--gray-500,#9ca3af)}#plBox tr.x td.ex{color:#b91c1c;font-weight:700}#plBox tr.g td{background:rgba(30,58,138,.06);font-weight:700}`;
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
  const PL = { q: '', only: 'all', scope: 'view' };
  const selv = id => { const e = Q(id); return e ? String(e.value || '') : ''; };
  function plRows() {
    const A = window.w3Api; if (!A || !A.slots) return null; const S = A.slots() || [], z = A.zone(), a = selv('#w3Aisle'), b = selv('#w3Bay'), l = selv('#w3Lvl');
    const inScope = s => PL.scope === 'all' || (s.zone === z && (!a || String(s.aisle) === a) && (!b || String(s.bay) === b) && (!l || l === '0' || String(s.lvl) === l));
    const q = PL.q.trim().toLowerCase(), out = [];
    S.filter(inScope).sort((x, y) => String(x.zone).localeCompare(y.zone) || x.aisle - y.aisle || x.bay - y.bay || x.lvl - y.lvl || x.pos - y.pos || String(x.code).localeCompare(String(y.code), undefined, { numeric: true })).forEach(s => {
      const pos = s.code, base = [s.zone, s.aisle, s.bay, s.lvl, s.l3p ? s.pos : (s.pos || '')];
      if (!s.occ) { if (PL.only === 'occ') return; if (q && !String(pos).toLowerCase().includes(q)) return; out.push({ e: 1, r: [...base, pos, '', '', '', '', '', 0, 0, s.cap || ''] }); return; }
      if (PL.only === 'empty') return;
      (s.lines || []).forEach(x => { if (q && ![pos, x.sku, x.dtls, x.batch].join(' ').toLowerCase().includes(q)) return; const d = x.days;
        out.push({ x: d != null && d < 0, r: [...base, pos, x.sku, x.dtls || '', x.batch || '', x.prod || '', x.exp || '', Math.round(x.qty * 100) / 100, Math.round(x.pal * 100) / 100, s.cap || ''] }); });
    });
    return out;
  }
  const HDR = ['Warehouse', 'Aisle', 'Bay', 'Level', 'Pos', 'Pallet position', 'SKU', 'Description', 'Batch', 'Production', 'Expiry', 'Qty (units)', 'Pallets', 'Capacity'];
  function plData() { const R = plRows() || [], occ = new Set(R.filter(x => !x.e).map(x => x.r[5])), z = window.w3Api ? w3Api.zone() : '';
    const scope = PL.scope === 'all' ? 'all warehouses' : [z, selv('#w3Aisle') && 'aisle ' + selv('#w3Aisle'), selv('#w3Bay') && 'bay ' + selv('#w3Bay'), selv('#w3Lvl') && selv('#w3Lvl') !== '0' && 'level ' + selv('#w3Lvl')].filter(Boolean).join(' · ');
    const tq = R.reduce((a, x) => a + num(x.r[11]), 0), tp = R.reduce((a, x) => a + num(x.r[12]), 0);
    return { title: 'Pallet positions — SKU & quantity', sheet: 'Pallet positions', note: scope + ' · ' + occ.size + ' occupied position(s)' + (PL.q ? ' · search "' + PL.q + '"' : '') + ' · ' + new Date().toLocaleString(),
      headers: HDR, rows: R.map(x => x.r), totals: ['Total', '', '', '', '', occ.size + ' occupied', '', '', '', '', '', Math.round(tq * 100) / 100, Math.round(tp * 100) / 100, ''], _R: R, scope, tq, tp, occ: occ.size }; }
  function plDraw() {
    const box = Q('#plBox'); if (!box) return; const d = plData(), R = d._R, emp = new Set(R.filter(x => x.e).map(x => x.r[5])).size;
    box.querySelector('.pl-k').innerHTML = `<span>Scope <b>${esc(d.scope || '—')}</b></span><span>Occupied positions <b>${fmt(d.occ)}</b></span><span>Empty <b>${fmt(emp)}</b></span><span>SKU lines <b>${fmt(R.filter(x => !x.e).length)}</b></span><span>Quantity <b>${fmt(d.tq)}</b></span><span>Pallets <b>${fmt(d.tp)}</b></span>`;
    let last = '', h = ''; R.slice(0, 3000).forEach(x => { const r = x.r, first = r[5] !== last; last = r[5];
      h += `<tr class="${x.e ? 'e' : ''}${x.x ? ' x' : ''}"><td>${first ? esc(r[0]) : ''}</td><td class="n">${first ? r[1] : ''}</td><td class="n">${first ? r[2] : ''}</td><td class="n">${first ? r[3] : ''}</td><td class="n">${first ? r[4] : ''}</td><td>${first ? '<b>' + esc(r[5]) + '</b>' : ''}</td><td>${x.e ? '<i>empty</i>' : esc(r[6])}</td><td>${esc(r[7])}</td><td>${esc(r[8])}</td><td>${esc(r[9])}</td><td class="ex">${esc(r[10])}</td><td class="n">${x.e ? '' : fmt(r[11])}</td><td class="n">${x.e ? '' : fmt(r[12])}</td><td class="n">${esc(r[13])}</td></tr>`; });
    box.querySelector('tbody').innerHTML = h || '<tr><td colspan="14" style="text-align:center;padding:18px;color:var(--gray-600)">Nothing to show — load the 3D view first or change the filters.</td></tr>';
    box.querySelector('tfoot').innerHTML = R.length ? `<tr class="g"><td colspan="6">Total · ${fmt(d.occ)} occupied position(s)${R.length > 3000 ? ' · first 3,000 lines shown — Excel has all' : ''}</td><td colspan="5"></td><td class="n">${fmt(d.tq)}</td><td class="n">${fmt(d.tp)}</td><td></td></tr>` : '';
  }
  function plOpen() {
    if (!window.w3Api || !(w3Api.slots() || []).length) { if (typeof sectionToast === 'function') sectionToast('Load the 3D view first (Reload).', 'warn'); return; }
    let box = Q('#plBox'); if (box) box.remove(); box = document.createElement('div'); box.id = 'plBox'; box.dataset.nohc = '1';
    box.innerHTML = `<div class="pl-c"><div class="pl-h"><h3>📋 Pallet positions — SKU &amp; quantity</h3>
      <input type="search" data-pl="q" placeholder="🔍 Position, SKU, batch…" value="${esc(PL.q)}">
      <select data-pl="only" data-nosearch="1"><option value="all">All positions</option><option value="occ">Occupied only</option><option value="empty">Empty only</option></select>
      <select data-pl="scope" data-nosearch="1"><option value="view">As filtered on the 3D</option><option value="all">All my warehouses</option></select>
      <button class="secondary small" type="button" data-pl="xl">📊 Excel</button><button class="secondary small" type="button" data-pl="pr">🖨 Print</button><button class="secondary small" type="button" data-pl="ml">✉ Email</button><button class="ghost small" type="button" data-pl="x">✕ Close</button></div>
      <div class="pl-k"></div><div class="pl-b"><table><thead><tr>${HDR.map(h => '<th>' + h + '</th>').join('')}</tr></thead><tbody></tbody><tfoot></tfoot></table></div></div>`;
    document.body.appendChild(box); box.querySelector('[data-pl="only"]').value = PL.only; box.querySelector('[data-pl="scope"]').value = PL.scope; plDraw();
    box.addEventListener('click', e => { if (e.target === box) return box.remove(); const b = e.target.closest('button[data-pl]'); if (!b) return; const a = b.dataset.pl, d = () => { const x = plData(); delete x._R; return x; };
      if (a === 'x') box.remove(); else if (a === 'xl') a2Export(d()); else if (a === 'pr') a2Print(d()); else if (a === 'ml') a2Mail(d); });
    box.addEventListener('input', e => { if (e.target.dataset.pl === 'q') { PL.q = e.target.value; plDraw(); } });
    box.addEventListener('change', e => { const k = e.target.dataset.pl; if (k === 'only' || k === 'scope') { PL[k] = e.target.value; plDraw(); } });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q('#plBox')) Q('#plBox').remove(); });
  function plBtn() { const bar = Q('#w3Body .w3bar'); if (!bar || Q('#w3PlBtn')) return; const b = document.createElement('button'); b.id = 'w3PlBtn'; b.type = 'button'; b.className = 'secondary small'; b.textContent = '📋 Position list';
    b.title = 'SKU and quantity in every pallet position — Excel / Print / Email'; b.addEventListener('click', plOpen); bar.appendChild(b); }
  setInterval(plBtn, 1500);
  window.plOpen = plOpen;
})();
