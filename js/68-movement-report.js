/* ============================================================
   MOVEMENT REPORT — inbound / outbound by SKU, batch and rack (from the SKUs_Movements_Batch_tbl ledger read by WHs Movements)
   Reports: detailed movements · per SKU · per SKU & batch · per rack · per SKU, batch & rack.
   Filters: dates, direction, warehouse, SKU, batch, rack, search. Double-click (or double-tap) a row to drill down, ◀ Back to climb up.
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; };
  const r2 = n => Math.round(n * 100) / 100, fmt = n => r2(n).toLocaleString();
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const day = v => { if (v == null || v === '') return ''; if (v instanceof Date) return isNaN(v) ? '' : iso(v); const s = String(v), m = s.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; const d = new Date(s); return isNaN(d) ? '' : iso(d); };
  const MV = { rep: 'det', from: ago(30), to: iso(new Date()), dir: 'all', rel: false, fz: '', fs: '', fb: '', fr: '', q: '', stack: [] };
  const TTL = { det: 'Movements — detailed', sku: 'Movements per SKU', batch: 'Movements per SKU & batch', rack: 'Movements per rack', sbr: 'Movements per SKU, batch & rack' };
  const DET = ['Date', 'Type', 'Direction', 'Reference', 'SKU', 'Description', 'Batch', 'Expiry', 'Warehouse', 'Rack', 'Pos', 'In (PC)', 'Out (PC)', 'Pallets', 'UoM', 'Trailer / source', 'User', 'Remarks', 'Entered as'];
  const KEYS = { sku: ['SKU', 'Description'], batch: ['SKU', 'Description', 'Batch', 'Expiry'], rack: ['Warehouse', 'Rack'], sbr: ['SKU', 'Description', 'Batch', 'Expiry', 'Warehouse', 'Rack'] };
  const SUM = ['Movements', 'In (PC)', 'Out (PC)', 'Net', 'In pallets', 'Out pallets', 'First', 'Last'];

  const css = document.createElement('style'); css.textContent = `
#mvBox{position:fixed;inset:0;z-index:2147482800;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}
#mvBox .mv-c{background:var(--card,#fff);color:var(--text,#111827);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.3);width:min(1300px,100%);height:88vh;min-width:560px;min-height:300px;max-width:99vw;max-height:98vh;resize:both;display:flex;flex-direction:column;overflow:hidden}
#mvBox .mv-h,#mvBox .mv-f{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px}#mvBox .mv-h{border-bottom:1px solid var(--border,#e5e7eb)}#mvBox .mv-f{padding-top:6px;border-bottom:1px solid var(--border,#e5e7eb)}
#mvBox h3{margin:0 auto 0 0;font-size:16px}#mvBox select,#mvBox input{width:auto;margin:0}#mvBox input[type=date]{min-width:128px}#mvBox .mv-f input[type=text]{min-width:110px}
#mvBox .mv-t{font-size:11.5px;color:var(--gray-600,#4b5563)}#mvBox label.mv-t{display:inline-flex;gap:4px;align-items:center}#mvBox label.mv-t input{width:auto}
#mvBox .mv-k{display:flex;gap:4px 14px;flex-wrap:wrap;padding:8px 14px;font-size:12.5px;color:var(--gray-600,#4b5563)}#mvBox .mv-k b{color:var(--text,#111827);font-size:14px}#mvBox .mv-k .in b{color:#047857}#mvBox .mv-k .out b{color:#b45309}
#mvBox .mv-b{flex:1;min-height:0;overflow:auto;padding:0 14px 14px}#mvBox table{width:100%;border-collapse:collapse;font-size:12.5px}
#mvBox th{position:sticky;top:0;background:var(--gray-50,#f8fafc);text-align:left;padding:6px;border-bottom:1px solid var(--border,#e5e7eb);white-space:nowrap}
#mvBox td{padding:5px 6px;border-top:1px solid var(--border,#eef0f3);vertical-align:top}#mvBox td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
#mvBox td.i{color:#047857;font-weight:600}#mvBox td.o{color:#b45309;font-weight:600}#mvBox tr.g td{background:rgba(30,58,138,.06);font-weight:700}#mvBox tbody tr[data-s]:hover td{background:rgba(30,58,138,.07)}
#mvBox .mv-ft{display:none}
@media (max-width:760px){
#mvBox{padding:0;align-items:stretch}#mvBox .mv-c{width:100vw;max-width:100vw;min-width:0;height:100vh;height:100dvh;max-height:100dvh;border-radius:0;resize:none}
#mvBox .mdl-ctlw,#mvBox .mdl-ctl{display:none !important}#mvBox .mv-h{padding:8px 10px;gap:6px}#mvBox h3{flex:1 1 100%;font-size:15px}
#mvBox .mv-h select{flex:1 1 46%;min-width:0;font-size:14px;padding:7px 8px}#mvBox .mv-h button{flex:1 1 auto;padding:8px 6px;font-size:13px;min-height:36px}
#mvBox .mv-ft{display:inline-block}#mvBox .mv-f{display:none;padding:6px 10px 8px;gap:6px}#mvBox.fo .mv-f{display:flex}
#mvBox .mv-f input,#mvBox .mv-f select{flex:1 1 46%;min-width:0;font-size:14px;padding:7px 8px}#mvBox .mv-f .mv-t{flex:1 1 100%}
#mvBox .mv-k{padding:6px 10px;font-size:12px}#mvBox .mv-b{padding:0 6px 10px}#mvBox table{font-size:12px}#mvBox th,#mvBox td{padding:6px 5px}#mvBox th{white-space:normal;line-height:1.15}
#mvBox table.mv-det :is(th,td):is(:nth-child(3),:nth-child(6),:nth-child(8),:nth-child(9),:nth-child(11),:nth-child(15),:nth-child(16),:nth-child(17),:nth-child(18),:nth-child(19)){display:none}
#mvBox table.mv-det tfoot td{display:table-cell}}`;
  document.head.appendChild(css);

  const H = () => { const W = window.WMVX; return W && W.S && W.S.hist && W.S.hist.all ? W.S.hist : null; };
  const whOf = lc => { try { const r = typeof srkFind === 'function' && lc ? srkFind(lc) : null; return r ? r.loc || '' : ''; } catch (e) { return ''; } };
  let CACHE = null;   /* movement rows prepared once per ledger load */
  function prep(h) { if (CACHE && CACHE.h === h && CACHE.n === h.all.length) return CACHE.rows;
    const rows = h.all.map(r => { const i = num(r.Qty_Rcvd), o = num(r.Qty_Rlsd), lc = r._lc || '', rel = /relocat/i.test(String(r.Trans_Type || ''));
      return { id: r._id || 0, d: day(r.Trans_Date), t: String(r.Trans_Type || ''), dir: i > 0 && o <= 0 ? 'In' : o > 0 && i <= 0 ? 'Out' : i > 0 ? 'In' : 'Out', rel, ref: String(r.Ref_Nr || ''), sku: String(r.SKU_Code || '').trim(), dt: String(r.SKU_Dtls || ''), b: String(r.Batch_Code == null ? '' : r.Batch_Code).trim(), ex: day(r.Expiry_Date), wh: whOf(lc), rk: lc, ps: r._ps || '', i, o, pal: num(r.Pallets), uom: String(r.UOM_Desc || ''), src: String(r.Recevied_Trl_Nr || ''), usr: String(r.User_Name || ''), rm: String(r.Remarks || ''), eq: r._raw ? (r._raw.rcvd > 0 ? r._raw.rcvd.toLocaleString() : r._raw.rlsd.toLocaleString()) + ' ' + r._raw.uom + ' × ' + r._raw.f : '' }; });
    CACHE = { h, n: h.all.length, rows }; return rows; }
  function rowsF() { const h = H(); if (!h) return []; const fs = MV.fs.trim().toLowerCase(), fb = MV.fb.trim().toLowerCase(), fr = MV.fr.trim().toLowerCase(), q = MV.q.trim().toLowerCase();
    return prep(h).filter(r => (!r.rel || MV.rel) && (!r.d || ((!MV.from || r.d >= MV.from) && (!MV.to || r.d <= MV.to))) && (MV.dir === 'all' || r.dir.toLowerCase() === MV.dir) && (!MV.fz || r.wh === MV.fz) && (!fs || (r.sku + ' ' + r.dt).toLowerCase().includes(fs)) && (!fb || r.b.toLowerCase().includes(fb)) && (!fr || r.rk.toLowerCase().includes(fr)) && (!q || [r.sku, r.dt, r.b, r.rk, r.ref, r.src, r.usr, r.rm, r.t].join(' ').toLowerCase().includes(q))); }
  function data() { const R = rowsF(), ti = R.reduce((a, r) => a + r.i, 0), to = R.reduce((a, r) => a + r.o, 0), pi = R.reduce((a, r) => a + (r.dir === 'In' ? r.pal : 0), 0), po = R.reduce((a, r) => a + (r.dir === 'Out' ? r.pal : 0), 0);
    const note = 'movements ' + (MV.from || '…') + ' → ' + (MV.to || '…') + (MV.dir !== 'all' ? ' · ' + (MV.dir === 'in' ? 'inbound' : 'outbound') + ' only' : '') + [MV.fz && 'warehouse ' + MV.fz, MV.fs && 'SKU ' + MV.fs, MV.fb && 'batch ' + MV.fb, MV.fr && 'rack ' + MV.fr, MV.q && 'search "' + MV.q + '"'].filter(Boolean).map(x => ' · ' + x).join('') + ' · ' + new Date().toLocaleString();
    const base = { R, ti, to, pi, po, n: R.length, note, title: TTL[MV.rep], sheet: TTL[MV.rep].replace(/[—&,]/g, '').replace(/\s+/g, ' ') };
    if (MV.rep === 'det') { const L = R.slice().sort((a, b) => (b.d || '').localeCompare(a.d || '') || b.id - a.id);
      return Object.assign(base, { headers: DET, rows: L.map(r => [r.d, r.t, r.dir === 'In' ? 'Inbound' : 'Outbound', r.ref, r.sku, r.dt, r.b, r.ex, r.wh, r.rk, r.ps, r.i || '', r.o || '', r.pal || '', r.uom, r.src, r.usr, r.rm, r.eq]), totals: DET.map((h, i) => i === 0 ? 'Total' : i === 11 ? r2(ti) : i === 12 ? r2(to) : i === 13 ? r2(pi + po) : ''), meta: L.map(r => ({ s: r.sku, b: r.b, r: r.rk })) }); }
    const kf = { sku: r => [r.sku], batch: r => [r.sku, r.b], rack: r => [r.rk], sbr: r => [r.sku, r.b, r.rk] }[MV.rep], M = new Map();
    R.forEach(r => { const k = kf(r).join('\u0001'); let g = M.get(k); if (!g) M.set(k, g = { s: r.sku, b: MV.rep === 'sku' || MV.rep === 'rack' ? '' : r.b, r: MV.rep === 'sku' || MV.rep === 'batch' ? '' : r.rk, dt: r.dt, ex: r.ex, wh: r.wh, n: 0, i: 0, o: 0, pi: 0, po: 0, f: '', l: '' });
      g.n++; g.i += r.i; g.o += r.o; if (r.dir === 'In') g.pi += r.pal; else g.po += r.pal; if (!g.dt && r.dt) g.dt = r.dt; if (!g.ex && r.ex) g.ex = r.ex; if (r.d && (!g.f || r.d < g.f)) g.f = r.d; if (r.d && r.d > g.l) g.l = r.d; });
    const L = [...M.values()].sort((a, b) => (MV.rep === 'rack' ? 0 : String(a.s).localeCompare(String(b.s), undefined, { numeric: true })) || String(a.wh).localeCompare(String(b.wh), undefined, { numeric: true }) || String(a.b).localeCompare(String(b.b), undefined, { numeric: true }) || String(a.r).localeCompare(String(b.r), undefined, { numeric: true }));
    const kc = { sku: g => [g.s, g.dt], batch: g => [g.s, g.dt, g.b, g.ex], rack: g => [g.wh, g.r], sbr: g => [g.s, g.dt, g.b, g.ex, g.wh, g.r] }[MV.rep], hd = KEYS[MV.rep].concat(SUM), nk = KEYS[MV.rep].length;
    return Object.assign(base, { headers: hd, rows: L.map(g => kc(g).concat([g.n, r2(g.i), r2(g.o), r2(g.i - g.o), r2(g.pi), r2(g.po), g.f, g.l])), totals: hd.map((h, i) => i === 0 ? 'Total' : i === nk ? R.length : i === nk + 1 ? r2(ti) : i === nk + 2 ? r2(to) : i === nk + 3 ? r2(ti - to) : i === nk + 4 ? r2(pi) : i === nk + 5 ? r2(po) : ''), meta: L.map(g => ({ s: g.s, b: g.b, r: g.r })), nk }); }

  function draw() { const box = Q('#mvBox'); if (!box) return; const d = data(), tb = box.querySelector('table'); tb.className = 'mv-' + MV.rep;
    box.querySelector('[data-mv="ttl"]').textContent = TTL[MV.rep];
    box.querySelector('.mv-k').innerHTML = `<span>Movements <b>${fmt(d.n)}</b></span><span class="in">Inbound <b>${fmt(d.ti)}</b> units${d.pi ? ' · ' + fmt(d.pi) + ' pallets' : ''}</span><span class="out">Outbound <b>${fmt(d.to)}</b> units${d.po ? ' · ' + fmt(d.po) + ' pallets' : ''}</span><span>Net <b>${fmt(d.ti - d.to)}</b></span>${window.UOMC && UOMC.last ? '<span style="flex:1 1 100%">' + UOMC.noteHtml() + '</span>' : ''}${MV.rep === 'det' && d.n > 3000 ? '<span>first 3,000 lines shown — Excel has all</span>' : ''}`;
    const nk = d.nk || 0, det = MV.rep === 'det';
    box.querySelector('thead').innerHTML = '<tr>' + d.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>';
    box.querySelector('tbody').innerHTML = d.rows.slice(0, 3000).map((r, ix) => { const m = d.meta[ix];
      return `<tr data-ix="${ix}" data-s="${esc(m.s)}" data-b="${esc(m.b)}" data-r="${esc(m.r)}"${det ? (m.r ? ' style="cursor:pointer" title="Double-click to show this rack in 3D"' : '') : ' style="cursor:pointer" title="Double-click to drill down"'}>${r.map((v, i) => { const num_ = typeof v === 'number' || (det && (i === 11 || i === 12 || i === 13)), cls = (num_ ? 'n' : '') + (det ? (i === 11 && v ? ' i' : i === 12 && v ? ' o' : '') : (i === nk + 1 && v ? ' i' : i === nk + 2 && v ? ' o' : '')); return `<td class="${cls.trim()}">${i === 0 && !det ? '<b>' + esc(v) + '</b>' : num_ && typeof v === 'number' ? fmt(v) : esc(v)}</td>`; }).join('')}</tr>`; }).join('') || `<tr><td colspan="${d.headers.length}" style="text-align:center;padding:18px;color:var(--gray-600)">No movements for these filters${H() ? '' : ' — the ledger is not loaded yet'}.</td></tr>`;
    box.querySelector('tfoot').innerHTML = d.rows.length ? '<tr class="g">' + d.totals.map((v, i) => `<td class="${typeof v === 'number' ? 'n' : ''}">${typeof v === 'number' ? fmt(v) : esc(v)}</td>`).join('') + '</tr>' : ''; box.querySelector('[data-mv="up"]').style.display = MV.stack.length ? '' : 'none'; }

  function sync() { const b = Q('#mvBox'); if (!b) return; [['rep', 'rep'], ['from', 'from'], ['to', 'to'], ['dir', 'dir'], ['fz', 'fz'], ['fs', 'fs'], ['fb', 'fb'], ['fr', 'fr'], ['q', 'q']].forEach(([k, n]) => { const e = b.querySelector('[data-mv="' + n + '"]'); if (e) e.value = MV[k]; }); const r = b.querySelector('[data-mv="rel"]'); if (r) r.checked = MV.rel; const u = b.querySelector('[data-mv="uc"]'); if (u) u.checked = window.UOMC ? UOMC.on() : false; }
  function go3d(rows, box, lbl) { const seen = new Set(), items = []; rows.forEach(r => { const loc = r.rk || r.r; if (!loc) return; const k = loc + '|' + (r.sku || r.s || '') + '|' + (r.b || ''); if (seen.has(k)) return; seen.add(k); items.push({ n: items.length + 1, loc, pos: 0, sku: r.sku || r.s || '', batch: r.b || '', take: Math.round((r.i || 0) - (r.o || 0)) || 0 }); });
    if (!items.length) return say('No rack locations in these movements to show in 3D.', 'warn'); if (!window.W3Pick) return say('The 3D view is not loaded yet.', 'warn');
    W3Pick.set(items.slice(0, 500), lbl || 'Movements'); if (box) box.remove(); const nav = document.querySelector('.nav-item[data-view="wh3d"]'); if (nav) nav.click(); setTimeout(() => { try { w3Api.zoomPicks(); } catch (x) {} }, 700); }
  function drill(tr) { const s = tr.dataset.s, b = tr.dataset.b, r = tr.dataset.r; if (MV.rep === 'det') { if (r) go3d(rowsF().filter(x => x.rk === r && (!s || x.sku === s)), Q('#mvBox'), 'Movement ' + r); return; } MV.stack.push({ rep: MV.rep, fs: MV.fs, fb: MV.fb, fr: MV.fr });
    if (MV.rep === 'sku') { MV.rep = 'batch'; MV.fs = s; } else if (MV.rep === 'batch') { MV.rep = 'det'; MV.fs = s; MV.fb = b; } else if (MV.rep === 'rack') { MV.rep = 'det'; MV.fr = r; } else { MV.rep = 'det'; MV.fs = s; MV.fb = b; MV.fr = r; }
    sync(); draw(); }
  function say(t, k) { if (typeof sectionToast === 'function') sectionToast(t, k || 'ok'); }

  function open() { let box = Q('#mvBox'); if (box) box.remove(); box = document.createElement('div'); box.id = 'mvBox'; box.dataset.nohc = '1';
    const h = H(), zs = h ? [...new Set(prep(h).map(r => r.wh).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [], sk = h ? [...new Set(prep(h).map(r => r.sku))].sort() : [];
    box.innerHTML = `<div class="mv-c"><div class="mv-h"><h3>📈 <span data-mv="ttl">${TTL[MV.rep]}</span></h3>
      <select data-mv="rep" data-nosearch="1" title="Choose the report"><option value="det">Report: detailed movements</option><option value="sku">Report: per SKU</option><option value="batch">Report: per SKU &amp; batch</option><option value="rack">Report: per rack</option><option value="sbr">Report: per SKU, batch &amp; rack</option></select>
      <select data-mv="dir" data-nosearch="1"><option value="all">Inbound + outbound</option><option value="in">Inbound only</option><option value="out">Outbound only</option></select>
      <button class="secondary small mv-ft" type="button" data-mv="ft">🔎 Filters</button><button class="secondary small" type="button" data-mv="xl">📊 Excel</button><button class="secondary small" type="button" data-mv="3d" title="Show the racks of these movements in the 3D warehouse view">🧊 3D view</button><button class="secondary small" type="button" data-mv="pr">🖨 Print</button><button class="secondary small" type="button" data-mv="ml">✉ Email</button><button class="secondary small" type="button" data-mv="rl" title="Re-read the ledger from SharePoint">🔄 Reload</button><button class="ghost small" type="button" data-mv="x">✕ Close</button></div>
      <div class="mv-f"><span class="mv-t">From</span><input type="date" data-mv="from"><span class="mv-t">to</span><input type="date" data-mv="to">
        <button class="ghost small" type="button" data-mv="d7">7 days</button><button class="ghost small" type="button" data-mv="d30">30 days</button><button class="ghost small" type="button" data-mv="dm">This month</button><button class="ghost small" type="button" data-mv="da">All dates</button>
        <select data-mv="fz" data-nosearch="1" title="Warehouse"><option value="">All warehouses</option>${zs.map(z => `<option value="${esc(z)}">${esc(z)}</option>`).join('')}</select>
        <input type="text" data-mv="fs" list="mvSkuDl" placeholder="SKU / description"><datalist id="mvSkuDl">${sk.map(k => `<option value="${esc(k)}">`).join('')}</datalist><input type="text" data-mv="fb" placeholder="Batch"><input type="text" data-mv="fr" placeholder="Rack code"><input type="text" data-mv="q" placeholder="🔍 Search ref, user, remarks…">
        <label class="mv-t"><input type="checkbox" data-mv="rel"> include relocations</label><label class="mv-t" title="Convert cartons / outers / pallets to pieces with the UOM list (UOM_Base_Nr)"><input type="checkbox" data-mv="uc"> convert to PC (UOM list)</label><button class="ghost small" type="button" data-uomed="" title="Add or change the UOM values (UOM list)">⚖ UOM values</button><button class="ghost small" type="button" data-mv="up" style="display:none">◀ Back</button><button class="ghost small" type="button" data-mv="clr">✕ Clear</button><span class="mv-t">Double-click a row to drill down: SKU → batches → movements</span></div>
      <div class="mv-k"></div><div class="mv-b"><table><thead></thead><tbody></tbody><tfoot></tfoot></table></div></div>`;
    document.body.appendChild(box); sync(); draw();
    const dd = () => { const x = data(); return { title: x.title, sheet: x.sheet, note: x.note, headers: x.headers, rows: x.rows, totals: x.totals }; };
    let tapT = 0, tapR = null;
    box.addEventListener('click', e => { if (e.target === box) return box.remove(); const tr = e.target.closest('tbody tr[data-s]'); if (tr && !e.target.closest('button,input,select')) { const n = Date.now(); if (tapR === tr && n - tapT < 450) { tapR = null; try { window.getSelection().removeAllRanges(); } catch (x) {} drill(tr); } else { tapR = tr; tapT = n; } return; }
      const b = e.target.closest('button[data-mv]'); if (!b) return; const a = b.dataset.mv;
      if (a === 'x') box.remove(); else if (a === 'ft') box.classList.toggle('fo'); else if (a === 'xl') a2Export(dd()); else if (a === 'pr') a2Print(dd()); else if (a === 'ml') a2Mail(dd); else if (a === '3d') go3d(rowsF(), box, 'Movements');
      else if (a === 'up') { const s = MV.stack.pop(); if (s) { MV.rep = s.rep; MV.fs = s.fs; MV.fb = s.fb; MV.fr = s.fr; sync(); draw(); } }
      else if (a === 'clr') { MV.fz = MV.fs = MV.fb = MV.fr = MV.q = ''; MV.dir = 'all'; MV.stack = []; sync(); draw(); }
      else if (a === 'd7') { MV.from = ago(7); MV.to = iso(new Date()); sync(); draw(); } else if (a === 'd30') { MV.from = ago(30); MV.to = iso(new Date()); sync(); draw(); }
      else if (a === 'dm') { const n = new Date(); MV.from = iso(new Date(n.getFullYear(), n.getMonth(), 1)); MV.to = iso(n); sync(); draw(); } else if (a === 'da') { MV.from = ''; MV.to = ''; sync(); draw(); }
      else if (a === 'rl') { say('⏳ Re-reading the ledger…'); try { CACHE = null; WMVX.load(true).then(() => { if (Q('#mvBox')) { open(); } }); } catch (x) {} } });
    box.addEventListener('input', e => { const k = e.target.dataset.mv; if (['from', 'to', 'fs', 'fb', 'fr', 'q'].includes(k)) { MV[k] = e.target.value; draw(); } });
    box.addEventListener('change', e => { const k = e.target.dataset.mv; if (k === 'uc') { UOMC.set(e.target.checked); say('⏳ Re-reading the ledger with the new UoM setting…'); CACHE = null; WMVX.load(true).then(() => { if (Q('#mvBox')) open(); }); return; } else if (k === 'rel') MV.rel = e.target.checked; else if (['rep', 'dir', 'fz', 'from', 'to'].includes(k)) { MV[k] = e.target.value; if (k === 'rep') MV.stack = []; } else return; draw(); }); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q('#mvBox')) Q('#mvBox').remove(); });

  let busy = false;
  async function mvOpen() { if (busy) return; if (!window.WMVX) return say('The WHs Movements module is not loaded.', 'warn');
    if (!H()) { busy = true; say('⏳ Reading the movements from SharePoint…'); try { WMVX.load(false); } catch (e) {} for (let i = 0; i < 160 && !H(); i++) await new Promise(r => setTimeout(r, 500)); busy = false; if (!H()) return say('The movements could not be read — check the sign-in and press Reload.', 'warn'); }
    open(); }
  window.mvOpen = mvOpen;
})();

/* ============================================================
   RMPM MOVEMENT REPORT — inbound / outbound by item, lot and bin (from RMPM_Movements_tbl read by the RMPM Warehouse module)
   Same behaviour as the WHs movement report: filters, 5 report levels, double-click drill-down, Excel / Print / Email.
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; };
  const r2 = n => Math.round(n * 100) / 100, fmt = n => r2(n).toLocaleString();
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const day = v => { if (v == null || v === '') return ''; if (v instanceof Date) return isNaN(v) ? '' : iso(v); const s = String(v), m = s.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; const d = new Date(s); return isNaN(d) ? '' : iso(d); };
  const MV = { rep: 'det', from: ago(30), to: iso(new Date()), dir: 'all', rel: false, fz: '', fs: '', fb: '', fr: '', q: '', stack: [] };
  const TTL = { det: 'RMPM movements — detailed', sku: 'RMPM movements per item', batch: 'RMPM movements per item & lot', rack: 'RMPM movements per bin', sbr: 'RMPM movements per item, lot & bin' };
  const DET = ['Date', 'Type', 'Direction', 'Reference', 'Item code', 'Item name', 'Lot', 'Expiry', 'Category', 'Bin', 'QC status', 'In', 'Out', 'UoM', 'Supplier', 'Prod. order / PO', 'User', 'Remarks'];
  const KEYS = { sku: ['Item code', 'Item name', 'UoM'], batch: ['Item code', 'Item name', 'Lot', 'Expiry', 'UoM'], rack: ['Category', 'Bin'], sbr: ['Item code', 'Item name', 'Lot', 'Expiry', 'Category', 'Bin', 'UoM'] };
  const SUM = ['Movements', 'In', 'Out', 'Net', 'First', 'Last'];

  const css = document.createElement('style'); css.textContent = `
#rmvBox{position:fixed;inset:0;z-index:2147482800;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}
#rmvBox .rmv-c{background:var(--card,#fff);color:var(--text,#111827);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.3);width:min(1300px,100%);height:88vh;min-width:560px;min-height:300px;max-width:99vw;max-height:98vh;resize:both;display:flex;flex-direction:column;overflow:hidden}
#rmvBox .rmv-h,#rmvBox .rmv-f{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px}#rmvBox .rmv-h{border-bottom:1px solid var(--border,#e5e7eb)}#rmvBox .rmv-f{padding-top:6px;border-bottom:1px solid var(--border,#e5e7eb)}
#rmvBox h3{margin:0 auto 0 0;font-size:16px}#rmvBox select,#rmvBox input{width:auto;margin:0}#rmvBox input[type=date]{min-width:128px}#rmvBox .rmv-f input[type=text]{min-width:110px}
#rmvBox .rmv-t{font-size:11.5px;color:var(--gray-600,#4b5563)}#rmvBox label.rmv-t{display:inline-flex;gap:4px;align-items:center}#rmvBox label.rmv-t input{width:auto}
#rmvBox .rmv-k{display:flex;gap:4px 14px;flex-wrap:wrap;padding:8px 14px;font-size:12.5px;color:var(--gray-600,#4b5563)}#rmvBox .rmv-k b{color:var(--text,#111827);font-size:14px}#rmvBox .rmv-k .in b{color:#047857}#rmvBox .rmv-k .out b{color:#b45309}
#rmvBox .rmv-b{flex:1;min-height:0;overflow:auto;padding:0 14px 14px}#rmvBox table{width:100%;border-collapse:collapse;font-size:12.5px}
#rmvBox th{position:sticky;top:0;background:var(--gray-50,#f8fafc);text-align:left;padding:6px;border-bottom:1px solid var(--border,#e5e7eb);white-space:nowrap}
#rmvBox td{padding:5px 6px;border-top:1px solid var(--border,#eef0f3);vertical-align:top}#rmvBox td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
#rmvBox td.i{color:#047857;font-weight:600}#rmvBox td.o{color:#b45309;font-weight:600}#rmvBox tr.g td{background:rgba(30,58,138,.06);font-weight:700}#rmvBox tbody tr[data-s]:hover td{background:rgba(30,58,138,.07)}
#rmvBox .rmv-ft{display:none}
@media (max-width:760px){
#rmvBox{padding:0;align-items:stretch}#rmvBox .rmv-c{width:100vw;max-width:100vw;min-width:0;height:100vh;height:100dvh;max-height:100dvh;border-radius:0;resize:none}
#rmvBox .mdl-ctlw,#rmvBox .mdl-ctl{display:none !important}#rmvBox .rmv-h{padding:8px 10px;gap:6px}#rmvBox h3{flex:1 1 100%;font-size:15px}
#rmvBox .rmv-h select{flex:1 1 46%;min-width:0;font-size:14px;padding:7px 8px}#rmvBox .rmv-h button{flex:1 1 auto;padding:8px 6px;font-size:13px;min-height:36px}
#rmvBox .rmv-ft{display:inline-block}#rmvBox .rmv-f{display:none;padding:6px 10px 8px;gap:6px}#rmvBox.fo .rmv-f{display:flex}
#rmvBox .rmv-f input,#rmvBox .rmv-f select{flex:1 1 46%;min-width:0;font-size:14px;padding:7px 8px}#rmvBox .rmv-f .rmv-t{flex:1 1 100%}
#rmvBox .rmv-k{padding:6px 10px;font-size:12px}#rmvBox .rmv-b{padding:0 6px 10px}#rmvBox table{font-size:12px}#rmvBox th,#rmvBox td{padding:6px 5px}#rmvBox th{white-space:normal;line-height:1.15}
#rmvBox table.rmv-det :is(th,td):is(:nth-child(3),:nth-child(6),:nth-child(8),:nth-child(9),:nth-child(11),:nth-child(15),:nth-child(16),:nth-child(17),:nth-child(18)){display:none}
#rmvBox table.rmv-det tfoot td{display:table-cell}}`;
  document.head.appendChild(css);

  const H = () => { const W = window.RMPX; return W && W.S && W.S.loaded && W.S.d && W.S.d.mov ? W.S.d : null; };
    let CACHE = null;   /* movement rows prepared once per ledger load */
  function prep(h) { if (CACHE && CACHE.h === h && CACHE.n === h.mov.length) return CACHE.rows;
    const rows = []; h.mov.forEach(r => { const i = num(r.Qty_In), o = num(r.Qty_Out); if (!(i > 0) && !(o > 0)) return; const t = String(r.Trans_Type || '');
      rows.push({ id: r._id || 0, d: day(r.Trans_Date), t, dir: i > 0 && o <= 0 ? 'In' : o > 0 && i <= 0 ? 'Out' : i > 0 ? 'In' : 'Out', rel: /transfer/i.test(t), ref: String(r.Ref_Nr || ''), sku: String(r.Item_Code || '').trim(), dt: String(r.Item_Name || ''), b: String(r.Lot_No == null ? '' : r.Lot_No).trim(), ex: day(r.Expiry_Date), wh: String(r.Category || ''), rk: String(r.Location || '').trim(), qc: String(r.QC_Status || ''), i, o, uom: String(r.UoM || ''), src: String(r.Supplier || ''), po: String(r.Prod_Order || r.PO_No || ''), usr: String(r.User_Name || ''), rm: String(r.Reason || '') }); });
    CACHE = { h, n: h.mov.length, rows }; return rows; }
  function rowsF() { const h = H(); if (!h) return []; const fs = MV.fs.trim().toLowerCase(), fb = MV.fb.trim().toLowerCase(), fr = MV.fr.trim().toLowerCase(), q = MV.q.trim().toLowerCase();
    return prep(h).filter(r => (!r.rel || MV.rel) && (!r.d || ((!MV.from || r.d >= MV.from) && (!MV.to || r.d <= MV.to))) && (MV.dir === 'all' || r.dir.toLowerCase() === MV.dir) && (!MV.fz || r.wh === MV.fz) && (!fs || (r.sku + ' ' + r.dt).toLowerCase().includes(fs)) && (!fb || r.b.toLowerCase().includes(fb)) && (!fr || r.rk.toLowerCase().includes(fr)) && (!q || [r.sku, r.dt, r.b, r.rk, r.ref, r.src, r.po, r.usr, r.rm, r.t, r.qc].join(' ').toLowerCase().includes(q))); }
  function data() { const R = rowsF(), ti = R.reduce((a, r) => a + r.i, 0), to = R.reduce((a, r) => a + r.o, 0), pi = 0, po = 0;
    const note = 'movements ' + (MV.from || '…') + ' → ' + (MV.to || '…') + (MV.dir !== 'all' ? ' · ' + (MV.dir === 'in' ? 'inbound' : 'outbound') + ' only' : '') + [MV.fz && 'warehouse ' + MV.fz, MV.fs && 'SKU ' + MV.fs, MV.fb && 'batch ' + MV.fb, MV.fr && 'rack ' + MV.fr, MV.q && 'search "' + MV.q + '"'].filter(Boolean).map(x => ' · ' + x).join('') + ' · ' + new Date().toLocaleString();
    const base = { R, ti, to, pi, po, n: R.length, note, title: TTL[MV.rep], sheet: TTL[MV.rep].replace(/[—&,]/g, '').replace(/\s+/g, ' ') };
    if (MV.rep === 'det') { const L = R.slice().sort((a, b) => (b.d || '').localeCompare(a.d || '') || b.id - a.id);
      return Object.assign(base, { headers: DET, rows: L.map(r => [r.d, r.t, r.dir === 'In' ? 'Inbound' : 'Outbound', r.ref, r.sku, r.dt, r.b, r.ex, r.wh, r.rk, r.qc, r.i || '', r.o || '', r.uom, r.src, r.po, r.usr, r.rm]), totals: DET.map((h, i) => i === 0 ? 'Total' : i === 11 ? r2(ti) : i === 12 ? r2(to) : ''), meta: L.map(r => ({ s: r.sku, b: r.b, r: r.rk })) }); }
    const kf = { sku: r => [r.sku], batch: r => [r.sku, r.b], rack: r => [r.rk], sbr: r => [r.sku, r.b, r.rk] }[MV.rep], M = new Map();
    R.forEach(r => { const k = kf(r).join('\u0001'); let g = M.get(k); if (!g) M.set(k, g = { s: r.sku, b: MV.rep === 'sku' || MV.rep === 'rack' ? '' : r.b, r: MV.rep === 'sku' || MV.rep === 'batch' ? '' : r.rk, dt: r.dt, ex: r.ex, wh: r.wh, uom: r.uom, n: 0, i: 0, o: 0, f: '', l: '' });
      g.n++; g.i += r.i; g.o += r.o; if (!g.dt && r.dt) g.dt = r.dt; if (!g.ex && r.ex) g.ex = r.ex; if (r.d && (!g.f || r.d < g.f)) g.f = r.d; if (r.d && r.d > g.l) g.l = r.d; });
    const L = [...M.values()].sort((a, b) => (MV.rep === 'rack' ? 0 : String(a.s).localeCompare(String(b.s), undefined, { numeric: true })) || String(a.wh).localeCompare(String(b.wh), undefined, { numeric: true }) || String(a.b).localeCompare(String(b.b), undefined, { numeric: true }) || String(a.r).localeCompare(String(b.r), undefined, { numeric: true }));
    const kc = { sku: g => [g.s, g.dt, g.uom], batch: g => [g.s, g.dt, g.b, g.ex, g.uom], rack: g => [g.wh, g.r], sbr: g => [g.s, g.dt, g.b, g.ex, g.wh, g.r, g.uom] }[MV.rep], hd = KEYS[MV.rep].concat(SUM), nk = KEYS[MV.rep].length;
    return Object.assign(base, { headers: hd, rows: L.map(g => kc(g).concat([g.n, r2(g.i), r2(g.o), r2(g.i - g.o), g.f, g.l])), totals: hd.map((h, i) => i === 0 ? 'Total' : i === nk ? R.length : i === nk + 1 ? r2(ti) : i === nk + 2 ? r2(to) : i === nk + 3 ? r2(ti - to) : ''), meta: L.map(g => ({ s: g.s, b: g.b, r: g.r })), nk }); }

  function draw() { const box = Q('#rmvBox'); if (!box) return; const d = data(), tb = box.querySelector('table'); tb.className = 'rmv-' + MV.rep;
    box.querySelector('[data-rmv="ttl"]').textContent = TTL[MV.rep];
    box.querySelector('.rmv-k').innerHTML = `<span>Movements <b>${fmt(d.n)}</b></span><span class="in">Inbound <b>${fmt(d.ti)}</b> </span><span class="out">Outbound <b>${fmt(d.to)}</b></span><span>Net <b>${fmt(d.ti - d.to)}</b></span>${MV.rep === 'det' && d.n > 3000 ? '<span>first 3,000 lines shown — Excel has all</span>' : ''}`;
    const nk = d.nk || 0, det = MV.rep === 'det';
    box.querySelector('thead').innerHTML = '<tr>' + d.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>';
    box.querySelector('tbody').innerHTML = d.rows.slice(0, 3000).map((r, ix) => { const m = d.meta[ix];
      return `<tr data-ix="${ix}" data-s="${esc(m.s)}" data-b="${esc(m.b)}" data-r="${esc(m.r)}"${det ? '' : ' style="cursor:pointer" title="Double-click to drill down"'}>${r.map((v, i) => { const num_ = typeof v === 'number' || (det && (i === 11 || i === 12)), cls = (num_ ? 'n' : '') + (det ? (i === 11 && v ? ' i' : i === 12 && v ? ' o' : '') : (i === nk + 1 && v ? ' i' : i === nk + 2 && v ? ' o' : '')); return `<td class="${cls.trim()}">${i === 0 && !det ? '<b>' + esc(v) + '</b>' : num_ && typeof v === 'number' ? fmt(v) : esc(v)}</td>`; }).join('')}</tr>`; }).join('') || `<tr><td colspan="${d.headers.length}" style="text-align:center;padding:18px;color:var(--gray-600)">No movements for these filters${H() ? '' : ' — the RMPM lists are not loaded yet'}.</td></tr>`;
    box.querySelector('tfoot').innerHTML = d.rows.length ? '<tr class="g">' + d.totals.map((v, i) => `<td class="${typeof v === 'number' ? 'n' : ''}">${typeof v === 'number' ? fmt(v) : esc(v)}</td>`).join('') + '</tr>' : ''; box.querySelector('[data-rmv="up"]').style.display = MV.stack.length ? '' : 'none'; }

  function sync() { const b = Q('#rmvBox'); if (!b) return; [['rep', 'rep'], ['from', 'from'], ['to', 'to'], ['dir', 'dir'], ['fz', 'fz'], ['fs', 'fs'], ['fb', 'fb'], ['fr', 'fr'], ['q', 'q']].forEach(([k, n]) => { const e = b.querySelector('[data-rmv="' + n + '"]'); if (e) e.value = MV[k]; }); const r = b.querySelector('[data-rmv="rel"]'); if (r) r.checked = MV.rel; }
  function drill(tr) { const s = tr.dataset.s, b = tr.dataset.b, r = tr.dataset.r; if (MV.rep === 'det') return; MV.stack.push({ rep: MV.rep, fs: MV.fs, fb: MV.fb, fr: MV.fr });
    if (MV.rep === 'sku') { MV.rep = 'batch'; MV.fs = s; } else if (MV.rep === 'batch') { MV.rep = 'det'; MV.fs = s; MV.fb = b; } else if (MV.rep === 'rack') { MV.rep = 'det'; MV.fr = r; } else { MV.rep = 'det'; MV.fs = s; MV.fb = b; MV.fr = r; }
    sync(); draw(); }
  function say(t, k) { if (typeof sectionToast === 'function') sectionToast(t, k || 'ok'); }

  function open() { let box = Q('#rmvBox'); if (box) box.remove(); box = document.createElement('div'); box.id = 'rmvBox'; box.dataset.nohc = '1';
    const h = H(), zs = h ? [...new Set(prep(h).map(r => r.wh).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [], sk = h ? [...new Set(prep(h).map(r => r.sku))].sort() : [];
    box.innerHTML = `<div class="rmv-c"><div class="rmv-h"><h3>🧪 <span data-rmv="ttl">${TTL[MV.rep]}</span></h3>
      <select data-rmv="rep" data-nosearch="1" title="Choose the report"><option value="det">Report: detailed movements</option><option value="sku">Report: per item</option><option value="batch">Report: per item &amp; lot</option><option value="rack">Report: per bin</option><option value="sbr">Report: per item, lot &amp; bin</option></select>
      <select data-rmv="dir" data-nosearch="1"><option value="all">Inbound + outbound</option><option value="in">Inbound only</option><option value="out">Outbound only</option></select>
      <button class="secondary small rmv-ft" type="button" data-rmv="ft">🔎 Filters</button><button class="secondary small" type="button" data-rmv="xl">📊 Excel</button><button class="secondary small" type="button" data-rmv="pr">🖨 Print</button><button class="secondary small" type="button" data-rmv="ml">✉ Email</button><button class="secondary small" type="button" data-rmv="rl" title="Re-read the RMPM lists from SharePoint">🔄 Reload</button><button class="ghost small" type="button" data-rmv="x">✕ Close</button></div>
      <div class="rmv-f"><span class="rmv-t">From</span><input type="date" data-rmv="from"><span class="rmv-t">to</span><input type="date" data-rmv="to">
        <button class="ghost small" type="button" data-rmv="d7">7 days</button><button class="ghost small" type="button" data-rmv="d30">30 days</button><button class="ghost small" type="button" data-rmv="dm">This month</button><button class="ghost small" type="button" data-rmv="da">All dates</button>
        <select data-rmv="fz" data-nosearch="1" title="Category"><option value="">All categories</option>${zs.map(z => `<option value="${esc(z)}">${esc(z)}</option>`).join('')}</select>
        <input type="text" data-rmv="fs" list="rmvItDl" placeholder="Item code / name"><datalist id="rmvItDl">${sk.map(k => `<option value="${esc(k)}">`).join('')}</datalist><input type="text" data-rmv="fb" placeholder="Lot no."><input type="text" data-rmv="fr" placeholder="Bin / location"><input type="text" data-rmv="q" placeholder="🔍 Search ref, user, remarks…">
        <label class="rmv-t"><input type="checkbox" data-rmv="rel"> include relocations</label><button class="ghost small" type="button" data-rmv="up" style="display:none">◀ Back</button><button class="ghost small" type="button" data-rmv="clr">✕ Clear</button><span class="rmv-t">Double-click a row to drill down: item → lots → movements</span></div>
      <div class="rmv-k"></div><div class="rmv-b"><table><thead></thead><tbody></tbody><tfoot></tfoot></table></div></div>`;
    document.body.appendChild(box); sync(); draw();
    const dd = () => { const x = data(); return { title: x.title, sheet: x.sheet, note: x.note, headers: x.headers, rows: x.rows, totals: x.totals }; };
    let tapT = 0, tapR = null;
    box.addEventListener('click', e => { if (e.target === box) return box.remove(); const tr = e.target.closest('tbody tr[data-s]'); if (tr && !e.target.closest('button,input,select')) { const n = Date.now(); if (tapR === tr && n - tapT < 450) { tapR = null; try { window.getSelection().removeAllRanges(); } catch (x) {} drill(tr); } else { tapR = tr; tapT = n; } return; }
      const b = e.target.closest('button[data-rmv]'); if (!b) return; const a = b.dataset.rmv;
      if (a === 'x') box.remove(); else if (a === 'ft') box.classList.toggle('fo'); else if (a === 'xl') a2Export(dd()); else if (a === 'pr') a2Print(dd()); else if (a === 'ml') a2Mail(dd);
      else if (a === 'up') { const s = MV.stack.pop(); if (s) { MV.rep = s.rep; MV.fs = s.fs; MV.fb = s.fb; MV.fr = s.fr; sync(); draw(); } }
      else if (a === 'clr') { MV.fz = MV.fs = MV.fb = MV.fr = MV.q = ''; MV.dir = 'all'; MV.stack = []; sync(); draw(); }
      else if (a === 'd7') { MV.from = ago(7); MV.to = iso(new Date()); sync(); draw(); } else if (a === 'd30') { MV.from = ago(30); MV.to = iso(new Date()); sync(); draw(); }
      else if (a === 'dm') { const n = new Date(); MV.from = iso(new Date(n.getFullYear(), n.getMonth(), 1)); MV.to = iso(n); sync(); draw(); } else if (a === 'da') { MV.from = ''; MV.to = ''; sync(); draw(); }
      else if (a === 'rl') { say('⏳ Re-reading the ledger…'); try { CACHE = null; Promise.resolve(RMPX.load(true)).then(() => { if (Q('#rmvBox')) { open(); } }); } catch (x) {} } });
    box.addEventListener('input', e => { const k = e.target.dataset.rmv; if (['from', 'to', 'fs', 'fb', 'fr', 'q'].includes(k)) { MV[k] = e.target.value; draw(); } });
    box.addEventListener('change', e => { const k = e.target.dataset.rmv; if (k === 'rel') MV.rel = e.target.checked; else if (['rep', 'dir', 'fz', 'from', 'to'].includes(k)) { MV[k] = e.target.value; if (k === 'rep') MV.stack = []; } else return; draw(); }); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q('#rmvBox')) Q('#rmvBox').remove(); });

  let busy = false;
  async function rmvOpen() { if (busy) return; if (!window.RMPX) return say('The RMPM Warehouse module is not loaded.', 'warn');
    if (!H()) { busy = true; say('⏳ Reading the RMPM movements from SharePoint…'); try { RMPX.load(false); } catch (e) {} for (let i = 0; i < 160 && !H(); i++) await new Promise(r => setTimeout(r, 500)); busy = false; if (!H()) return say('The RMPM movements could not be read — check the sign-in and press Reload.', 'warn'); }
    open(); }
  window.rmvOpen = rmvOpen;
  function btn() { const r = Q('#view-rmp button[data-a="reload"]'); if (!r || !r.parentNode || r.parentNode.querySelector('[data-rmvx]')) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary small'; b.dataset.rmvx = '1'; b.textContent = '📈 Movement report'; b.title = 'Inbound and outbound RMPM movements by item, lot and bin — Excel / Print / Email'; b.addEventListener('click', () => rmvOpen()); r.parentNode.insertBefore(b, r); }
  setInterval(btn, 1500); btn();
})();

/* ============================================================
   RMPM STOCK POSITIONS — raw & packaging stock in every bin: item, lot, quantity, expiry, QC status (from the RMPM ledger balances)
   Reports: stock by bin and lot · per item & lot · per item · per bin. Filters: category, show (usable / quarantine / expired …), item, lot, bin, search.
   Double-click (or double-tap) a row to drill down: item → lots → bins · bin → stock lines. Excel / Print / Email.
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r3 = n => Math.round(n * 1000) / 1000, fmt = n => r3(n).toLocaleString();
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const day = v => { if (v == null || v === '') return ''; if (v instanceof Date) return isNaN(v) ? '' : iso(v); const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; const d = new Date(String(v)); return isNaN(d) ? '' : iso(d); };
  const dleft = e => { if (!e) return ''; const t = new Date(e + 'T00:00:00'); return isNaN(t) ? '' : Math.round((t - new Date(new Date().toDateString())) / 864e5); };
  const SP = { rep: 'pos', cat: '', show: 'all', fs: '', fb: '', fr: '', q: '', stack: [] };
  const TTL = { pos: 'RMPM stock — by bin & lot', batch: 'RMPM stock — per item & lot', sku: 'RMPM stock — per item', bin: 'RMPM stock — per bin' };
  const HP = ['Category', 'Bin', 'Item code', 'Item name', 'Lot', 'Production', 'Expiry', 'Days left', 'QC status', 'Qty', 'UoM', 'Supplier'];
  const HB = ['Item code', 'Item name', 'Lot', 'Production', 'Expiry', 'Days left', 'QC status', 'Qty', 'UoM', 'Bins'];
  const HS = ['Item code', 'Item name', 'Category', 'Lots', 'Earliest expiry', 'Days left', 'Usable qty', 'Total qty', 'UoM', 'Bins'];
  const HN = ['Category', 'Bin', 'Items', 'Lots', 'Earliest expiry', 'Qty (mixed UoM)'];
  const css = document.createElement('style'); css.textContent = `
#rpsBox{position:fixed;inset:0;z-index:2147482800;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}
#rpsBox .rps-c{background:var(--card,#fff);color:var(--text,#111827);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.3);width:min(1300px,100%);height:88vh;min-width:560px;min-height:300px;max-width:99vw;max-height:98vh;resize:both;display:flex;flex-direction:column;overflow:hidden}
#rpsBox .rps-h,#rpsBox .rps-f{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px}#rpsBox .rps-h{border-bottom:1px solid var(--border,#e5e7eb)}#rpsBox .rps-f{padding-top:6px;border-bottom:1px solid var(--border,#e5e7eb)}
#rpsBox h3{margin:0 auto 0 0;font-size:16px}#rpsBox select,#rpsBox input{width:auto;margin:0}#rpsBox input[type=date]{min-width:128px}#rpsBox .rps-f input[type=text]{min-width:110px}
#rpsBox .rps-t{font-size:11.5px;color:var(--gray-600,#4b5563)}#rpsBox label.rps-t{display:inline-flex;gap:4px;align-items:center}#rpsBox label.rps-t input{width:auto}
#rpsBox .rps-k{display:flex;gap:4px 14px;flex-wrap:wrap;padding:8px 14px;font-size:12.5px;color:var(--gray-600,#4b5563)}#rpsBox .rps-k b{color:var(--text,#111827);font-size:14px}#rpsBox .rps-k .in b{color:#047857}#rpsBox .rps-k .out b{color:#b45309}
#rpsBox .rps-b{flex:1;min-height:0;overflow:auto;padding:0 14px 14px}#rpsBox table{width:100%;border-collapse:collapse;font-size:12.5px}
#rpsBox th{position:sticky;top:0;background:var(--gray-50,#f8fafc);text-align:left;padding:6px;border-bottom:1px solid var(--border,#e5e7eb);white-space:nowrap}
#rpsBox td{padding:5px 6px;border-top:1px solid var(--border,#eef0f3);vertical-align:top}#rpsBox td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
#rpsBox td.x{color:#b91c1c;font-weight:700}#rpsBox td.w{color:#b45309;font-weight:600}#rpsBox tr.g td{background:rgba(30,58,138,.06);font-weight:700}#rpsBox tbody tr[data-s]:hover td{background:rgba(30,58,138,.07)}
#rpsBox .rps-ft{display:none}
@media (max-width:760px){
#rpsBox{padding:0;align-items:stretch}#rpsBox .rps-c{width:100vw;max-width:100vw;min-width:0;height:100vh;height:100dvh;max-height:100dvh;border-radius:0;resize:none}
#rpsBox .mdl-ctlw,#rpsBox .mdl-ctl{display:none !important}#rpsBox .rps-h{padding:8px 10px;gap:6px}#rpsBox h3{flex:1 1 100%;font-size:15px}
#rpsBox .rps-h select{flex:1 1 46%;min-width:0;font-size:14px;padding:7px 8px}#rpsBox .rps-h button{flex:1 1 auto;padding:8px 6px;font-size:13px;min-height:36px}
#rpsBox .rps-ft{display:inline-block}#rpsBox .rps-f{display:none;padding:6px 10px 8px;gap:6px}#rpsBox.fo .rps-f{display:flex}
#rpsBox .rps-f input,#rpsBox .rps-f select{flex:1 1 46%;min-width:0;font-size:14px;padding:7px 8px}#rpsBox .rps-f .rps-t{flex:1 1 100%}
#rpsBox .rps-k{padding:6px 10px;font-size:12px}#rpsBox .rps-b{padding:0 6px 10px}#rpsBox table{font-size:12px}#rpsBox th,#rpsBox td{padding:6px 5px}#rpsBox th{white-space:normal;line-height:1.15}
#rpsBox table.rps-pos :is(th,td):is(:nth-child(1),:nth-child(4),:nth-child(6),:nth-child(12)){display:none}
#rpsBox table.rps-pos tfoot td{display:table-cell}}`;
  document.head.appendChild(css);

  const R_ = () => { const X = window.RMPX; return X && X.S && X.S.loaded && X.S.st ? X : null; };
  let CACHE = null;
  function lines(X) { const st = X.S.st; if (CACHE && CACHE.st === st) return CACHE.rows;
    const rows = st.rows.filter(r => r.bal > 1e-9 || r.bal < -1e-9).map(r => { let it = {}; try { it = X.S.d.items.find(i => String(i.Item_Code).trim() === r.item) || {}; } catch (e) {} const ex = day(r.exp), d = ex ? dleft(ex) : '', use = r.qc === 'Released' && !(d !== '' && d < 0) && !(r.ret && day(r.ret) < iso(new Date()));
      return { item: r.item, nm: it.Item_Name || '', cat: it.Category || '', lot: r.lot, loc: r.loc || '', prod: day(r.prod), ex, d, qc: r.qc, q: r.bal, uom: it.UoM || '', sup: r.sup || '', use }; });
    CACHE = { st, rows }; return rows; }
  function filt(X) { const fs = SP.fs.trim().toLowerCase(), fb = SP.fb.trim().toLowerCase(), fr = SP.fr.trim().toLowerCase(), q = SP.q.trim().toLowerCase();
    return lines(X).filter(r => (!SP.cat || r.cat === SP.cat) && (!fs || (r.item + ' ' + r.nm).toLowerCase().includes(fs)) && (!fb || r.lot.toLowerCase().includes(fb)) && (!fr || r.loc.toLowerCase().includes(fr)) && (!q || [r.item, r.nm, r.lot, r.loc, r.sup, r.qc].join(' ').toLowerCase().includes(q)) &&
      ({ all: true, use: r.use, Quarantine: r.qc === 'Quarantine', 'On hold': r.qc === 'On hold', Rejected: r.qc === 'Rejected', exp: r.d !== '' && r.d < 0, s30: r.d !== '' && r.d >= 0 && r.d <= 30, s90: r.d !== '' && r.d >= 0 && r.d <= 90 }[SP.show])); }
  function data(X) { const R = filt(X), tq = r3(R.reduce((a, r) => a + r.q, 0)), uq = r3(R.reduce((a, r) => a + (r.use ? r.q : 0), 0)), bins = new Set(R.map(r => r.loc)).size, items = new Set(R.map(r => r.item)).size;
    const note = [SP.cat && 'category ' + SP.cat, SP.show !== 'all' && 'show ' + SP.show, SP.fs && 'item ' + SP.fs, SP.fb && 'lot ' + SP.fb, SP.fr && 'bin ' + SP.fr, SP.q && 'search "' + SP.q + '"'].filter(Boolean).join(' · ') + (R.length ? ' · ' : '') + R.length + ' stock line(s) · ' + new Date().toLocaleString();
    const base = { R, tq, uq, bins, items, title: TTL[SP.rep], sheet: TTL[SP.rep].replace(/[—&]/g, '').replace(/\s+/g, ' '), note };
    const srt = (a, b, ...k) => { for (const f of k) { const c = String(f(a)).localeCompare(String(f(b)), undefined, { numeric: true }); if (c) return c; } return 0; };
    if (SP.rep === 'pos') { const L = R.slice().sort((a, b) => srt(a, b, x => x.cat, x => x.loc, x => x.item, x => x.ex || '9999', x => x.lot));
      return Object.assign(base, { headers: HP, rows: L.map(r => [r.cat, r.loc, r.item, r.nm, r.lot, r.prod, r.ex, r.d, r.qc, r.q, r.uom, r.sup]), totals: HP.map((h, i) => i === 0 ? 'Total' : i === 9 ? tq : ''), meta: L.map(r => ({ s: r.item, b: r.lot, r: r.loc })), qi: 9, di: 7, qci: 8 }); }
    const M = new Map(), key = { batch: r => r.item + '' + r.lot, sku: r => r.item, bin: r => r.cat + '' + r.loc }[SP.rep];
    R.forEach(r => { const k = key(r); let g = M.get(k); if (!g) M.set(k, g = { r, q: 0, uq: 0, lots: new Set(), bins: new Set(), items: new Set(), ex: '', qcs: new Set() }); g.q += r.q; if (r.use) g.uq += r.q; g.lots.add(r.item + '|' + r.lot); g.bins.add(r.loc); g.items.add(r.item); g.qcs.add(r.qc); if (r.ex && (!g.ex || r.ex < g.ex)) g.ex = r.ex; });
    const G = [...M.values()].sort((a, b) => SP.rep === 'bin' ? srt(a, b, x => x.r.cat, x => x.r.loc) : srt(a, b, x => x.r.item, x => x.ex || '9999', x => x.r.lot)), dl = e => e ? dleft(e) : '';
    if (SP.rep === 'batch') return Object.assign(base, { headers: HB, rows: G.map(g => [g.r.item, g.r.nm, g.r.lot, g.r.prod, g.r.ex, g.r.d, g.qcs.size > 1 ? 'Mixed' : g.r.qc, r3(g.q), g.r.uom, g.bins.size]), totals: HB.map((h, i) => i === 0 ? 'Total' : i === 7 ? tq : i === 9 ? bins : ''), meta: G.map(g => ({ s: g.r.item, b: g.r.lot, r: '' })), qi: 7, di: 5, qci: 6 });
    if (SP.rep === 'sku') return Object.assign(base, { headers: HS, rows: G.map(g => [g.r.item, g.r.nm, g.r.cat, g.lots.size, g.ex, dl(g.ex), r3(g.uq), r3(g.q), g.r.uom, g.bins.size]), totals: HS.map((h, i) => i === 0 ? 'Total' : i === 6 ? uq : i === 7 ? tq : i === 9 ? bins : ''), meta: G.map(g => ({ s: g.r.item, b: '', r: '' })), qi: 7, di: 5, qci: -1 });
    return Object.assign(base, { headers: HN, rows: G.map(g => [g.r.cat, g.r.loc, g.items.size, g.lots.size, g.ex, r3(g.q)]), totals: HN.map((h, i) => i === 0 ? 'Total' : i === 2 ? items : i === 5 ? tq : ''), meta: G.map(g => ({ s: '', b: '', r: g.r.loc })), qi: 5, di: -1, qci: -1 }); }

  function draw() { const box = Q('#rpsBox'), X = R_(); if (!box) return; const d = X ? data(X) : { R: [], rows: [], headers: HP, totals: [], meta: [], tq: 0, uq: 0, bins: 0, items: 0 };
    box.querySelector('table').className = 'rps-' + SP.rep; box.querySelector('[data-rps="ttl"]').textContent = TTL[SP.rep];
    box.querySelector('.rps-k').innerHTML = `<span>Stock lines <b>${fmt(d.R.length)}</b></span><span>Items <b>${fmt(d.items)}</b></span><span>Bins <b>${fmt(d.bins)}</b></span><span>Total qty <b>${fmt(d.tq)}</b></span><span>Usable (released, in date) <b>${fmt(d.uq)}</b></span>${d.rows.length > 3000 ? '<span>first 3,000 shown — Excel has all</span>' : ''}`;
    box.querySelector('thead').innerHTML = '<tr>' + d.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>';
    box.querySelector('tbody').innerHTML = d.rows.slice(0, 3000).map((r, ix) => { const m = d.meta[ix];
      return `<tr data-ix="${ix}" data-s="${esc(m.s)}" data-b="${esc(m.b)}" data-r="${esc(m.r)}"${SP.rep === 'pos' ? '' : ' style="cursor:pointer" title="Double-click to drill down"'}>${r.map((v, i) => { const isN = typeof v === 'number', cls = (isN ? 'n' : '') + (i === d.di && v !== '' && v < 0 ? ' x' : i === d.di && v !== '' && v <= 30 ? ' w' : '') + (i === d.qci && /^(Rejected)$/.test(v) ? ' x' : i === d.qci && /^(Quarantine|On hold)$/.test(v) ? ' w' : ''); return `<td class="${cls.trim()}">${i === 0 && SP.rep !== 'pos' ? '<b>' + esc(v) + '</b>' : isN && i !== d.di ? fmt(v) : esc(v)}</td>`; }).join('')}</tr>`; }).join('') || `<tr><td colspan="${d.headers.length}" style="text-align:center;padding:18px;color:var(--gray-600)">${X ? 'No stock for these filters.' : 'The RMPM lists are not loaded yet.'}</td></tr>`;
    box.querySelector('tfoot').innerHTML = d.rows.length ? '<tr class="g">' + d.totals.map((v, i) => `<td class="${typeof v === 'number' ? 'n' : ''}">${typeof v === 'number' ? fmt(v) : esc(v)}</td>`).join('') + '</tr>' : ''; box.querySelector('[data-rps="up"]').style.display = SP.stack.length ? '' : 'none'; }
  function sync() { const b = Q('#rpsBox'); if (!b) return; ['rep', 'cat', 'show', 'fs', 'fb', 'fr', 'q'].forEach(k => { const e = b.querySelector('[data-rps="' + k + '"]'); if (e) e.value = SP[k]; }); }
  function drill(tr) { const s = tr.dataset.s, b = tr.dataset.b, r = tr.dataset.r; if (SP.rep === 'pos') return; SP.stack.push({ rep: SP.rep, fs: SP.fs, fb: SP.fb, fr: SP.fr });
    if (SP.rep === 'sku') { SP.rep = 'batch'; SP.fs = s; } else if (SP.rep === 'batch') { SP.rep = 'pos'; SP.fs = s; SP.fb = b; } else { SP.rep = 'pos'; SP.fr = r; }
    sync(); draw(); }
  const say = (t, k) => { if (typeof sectionToast === 'function') sectionToast(t, k || 'ok'); };
  function open() { let box = Q('#rpsBox'); if (box) box.remove(); box = document.createElement('div'); box.id = 'rpsBox'; box.dataset.nohc = '1'; const X = R_(), L = X ? lines(X) : [], cats = [...new Set(L.map(r => r.cat).filter(Boolean))].sort(), its = [...new Set(L.map(r => r.item))].sort();
    box.innerHTML = `<div class="rps-c"><div class="rps-h"><h3>🧪 <span data-rps="ttl">${TTL[SP.rep]}</span></h3>
      <select data-rps="rep" data-nosearch="1" title="Choose the report"><option value="pos">Report: stock by bin &amp; lot</option><option value="batch">Report: per item &amp; lot</option><option value="sku">Report: per item</option><option value="bin">Report: per bin</option></select>
      <select data-rps="show" data-nosearch="1" title="Show"><option value="all">All stock</option><option value="use">Usable (released, in date)</option><option value="Quarantine">Quarantine</option><option value="On hold">On hold</option><option value="Rejected">Rejected</option><option value="exp">Expired</option><option value="s30">Expiring ≤ 30 days</option><option value="s90">Expiring ≤ 90 days</option></select>
      <button class="secondary small rps-ft" type="button" data-rps="ft">🔎 Filters</button><button class="secondary small" type="button" data-rps="xl">📊 Excel</button><button class="secondary small" type="button" data-rps="pr">🖨 Print</button><button class="secondary small" type="button" data-rps="ml">✉ Email</button><button class="secondary small" type="button" data-rps="mv" title="Inbound / outbound movements">📈 Movements</button><button class="secondary small" type="button" data-rps="rl" title="Re-read the RMPM lists from SharePoint">🔄 Reload</button><button class="ghost small" type="button" data-rps="x">✕ Close</button></div>
      <div class="rps-f"><span class="rps-t">Filter</span><select data-rps="cat" data-nosearch="1" title="Category"><option value="">All categories</option>${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
        <input type="text" data-rps="fs" list="rpsItDl" placeholder="Item code / name"><datalist id="rpsItDl">${its.map(k => `<option value="${esc(k)}">`).join('')}</datalist><input type="text" data-rps="fb" placeholder="Lot no."><input type="text" data-rps="fr" placeholder="Bin / location"><input type="text" data-rps="q" placeholder="🔍 Search supplier, QC…">
        <button class="ghost small" type="button" data-rps="up" style="display:none">◀ Back</button><button class="ghost small" type="button" data-rps="clr">✕ Clear filters</button><span class="rps-t">Double-click a row to drill down: item → lots → bins</span></div>
      <div class="rps-k"></div><div class="rps-b"><table><thead></thead><tbody></tbody><tfoot></tfoot></table></div></div>`;
    document.body.appendChild(box); sync(); draw();
    const dd = () => { const x = data(R_()); return { title: x.title, sheet: x.sheet, note: x.note, headers: x.headers, rows: x.rows, totals: x.totals }; }; let tapT = 0, tapR = null;
    box.addEventListener('click', e => { if (e.target === box) return box.remove(); const tr = e.target.closest('tbody tr[data-s]'); if (tr && !e.target.closest('button,input,select')) { const n = Date.now(); if (tapR === tr && n - tapT < 450) { tapR = null; try { window.getSelection().removeAllRanges(); } catch (x) {} drill(tr); } else { tapR = tr; tapT = n; } return; }
      const b = e.target.closest('button[data-rps]'); if (!b) return; const a = b.dataset.rps;
      if (a === 'x') box.remove(); else if (a === 'ft') box.classList.toggle('fo'); else if (a === 'xl') { if (R_()) a2Export(dd()); } else if (a === 'pr') { if (R_()) a2Print(dd()); } else if (a === 'ml') a2Mail(dd); else if (a === 'mv') { box.remove(); if (window.rmvOpen) rmvOpen(); }
      else if (a === 'up') { const s = SP.stack.pop(); if (s) { SP.rep = s.rep; SP.fs = s.fs; SP.fb = s.fb; SP.fr = s.fr; sync(); draw(); } }
      else if (a === 'clr') { SP.cat = SP.fs = SP.fb = SP.fr = SP.q = ''; SP.show = 'all'; SP.stack = []; sync(); draw(); }
      else if (a === 'rl') { say('⏳ Re-reading the RMPM lists…'); CACHE = null; try { Promise.resolve(RMPX.load(true)).then(() => { if (Q('#rpsBox')) open(); }); } catch (x) {} } });
    box.addEventListener('input', e => { const k = e.target.dataset.rps; if (['fs', 'fb', 'fr', 'q'].includes(k)) { SP[k] = e.target.value; draw(); } });
    box.addEventListener('change', e => { const k = e.target.dataset.rps; if (['rep', 'cat', 'show'].includes(k)) { SP[k] = e.target.value; if (k === 'rep') SP.stack = []; draw(); } }); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q('#rpsBox')) Q('#rpsBox').remove(); });
  let busy = false;
  async function rpsOpen() { if (busy) return; if (!window.RMPX) return say('The RMPM Warehouse module is not loaded.', 'warn');
    if (!R_()) { busy = true; say('⏳ Reading the RMPM stock from SharePoint…'); try { RMPX.load(false); } catch (e) {} for (let i = 0; i < 160 && !R_(); i++) await new Promise(r => setTimeout(r, 500)); busy = false; if (!R_()) return say('The RMPM stock could not be read — check the sign-in and press Reload.', 'warn'); }
    open(); }
  window.rpsOpen = rpsOpen;
  function btn() { const r = Q('#view-rmp button[data-a="reload"]'); if (!r || !r.parentNode || r.parentNode.querySelector('[data-rpsx]')) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary small'; b.dataset.rpsx = '1'; b.textContent = '📋 Stock positions'; b.title = 'RMPM stock in every bin — item, lot, quantity, expiry, QC status — Excel / Print / Email'; b.addEventListener('click', () => rpsOpen()); r.parentNode.insertBefore(b, r); }
  setInterval(btn, 1500); btn();
})();
