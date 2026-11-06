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
#mvBox{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}
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
    box.querySelector('.mv-k').innerHTML = `<span>Movements <b>${fmt(d.n)}</b></span><span class="in">Inbound <b>${fmt(d.ti)}</b> units${d.pi ? ' · ' + fmt(d.pi) + ' pallets' : ''}</span><span class="out">Outbound <b>${fmt(d.to)}</b> units${d.po ? ' · ' + fmt(d.po) + ' pallets' : ''}</span><span>Net <b>${fmt(d.ti - d.to)}</b></span>${window.UOMC && UOMC.last ? '<span style="flex:1 1 100%">' + esc(UOMC.note()) + '</span>' : ''}${MV.rep === 'det' && d.n > 3000 ? '<span>first 3,000 lines shown — Excel has all</span>' : ''}`;
    const nk = d.nk || 0, det = MV.rep === 'det';
    box.querySelector('thead').innerHTML = '<tr>' + d.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>';
    box.querySelector('tbody').innerHTML = d.rows.slice(0, 3000).map((r, ix) => { const m = d.meta[ix];
      return `<tr data-ix="${ix}" data-s="${esc(m.s)}" data-b="${esc(m.b)}" data-r="${esc(m.r)}"${det ? '' : ' style="cursor:pointer" title="Double-click to drill down"'}>${r.map((v, i) => { const num_ = typeof v === 'number' || (det && (i === 11 || i === 12 || i === 13)), cls = (num_ ? 'n' : '') + (det ? (i === 11 && v ? ' i' : i === 12 && v ? ' o' : '') : (i === nk + 1 && v ? ' i' : i === nk + 2 && v ? ' o' : '')); return `<td class="${cls.trim()}">${i === 0 && !det ? '<b>' + esc(v) + '</b>' : num_ && typeof v === 'number' ? fmt(v) : esc(v)}</td>`; }).join('')}</tr>`; }).join('') || `<tr><td colspan="${d.headers.length}" style="text-align:center;padding:18px;color:var(--gray-600)">No movements for these filters${H() ? '' : ' — the ledger is not loaded yet'}.</td></tr>`;
    box.querySelector('tfoot').innerHTML = d.rows.length ? '<tr class="g">' + d.totals.map((v, i) => `<td class="${typeof v === 'number' ? 'n' : ''}">${typeof v === 'number' ? fmt(v) : esc(v)}</td>`).join('') + '</tr>' : ''; box.querySelector('[data-mv="up"]').style.display = MV.stack.length ? '' : 'none'; }

  function sync() { const b = Q('#mvBox'); if (!b) return; [['rep', 'rep'], ['from', 'from'], ['to', 'to'], ['dir', 'dir'], ['fz', 'fz'], ['fs', 'fs'], ['fb', 'fb'], ['fr', 'fr'], ['q', 'q']].forEach(([k, n]) => { const e = b.querySelector('[data-mv="' + n + '"]'); if (e) e.value = MV[k]; }); const r = b.querySelector('[data-mv="rel"]'); if (r) r.checked = MV.rel; const u = b.querySelector('[data-mv="uc"]'); if (u) u.checked = window.UOMC ? UOMC.on() : false; }
  function drill(tr) { const s = tr.dataset.s, b = tr.dataset.b, r = tr.dataset.r; if (MV.rep === 'det') return; MV.stack.push({ rep: MV.rep, fs: MV.fs, fb: MV.fb, fr: MV.fr });
    if (MV.rep === 'sku') { MV.rep = 'batch'; MV.fs = s; } else if (MV.rep === 'batch') { MV.rep = 'det'; MV.fs = s; MV.fb = b; } else if (MV.rep === 'rack') { MV.rep = 'det'; MV.fr = r; } else { MV.rep = 'det'; MV.fs = s; MV.fb = b; MV.fr = r; }
    sync(); draw(); }
  function say(t, k) { if (typeof sectionToast === 'function') sectionToast(t, k || 'ok'); }

  function open() { let box = Q('#mvBox'); if (box) box.remove(); box = document.createElement('div'); box.id = 'mvBox'; box.dataset.nohc = '1';
    const h = H(), zs = h ? [...new Set(prep(h).map(r => r.wh).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [], sk = h ? [...new Set(prep(h).map(r => r.sku))].sort() : [];
    box.innerHTML = `<div class="mv-c"><div class="mv-h"><h3>📈 <span data-mv="ttl">${TTL[MV.rep]}</span></h3>
      <select data-mv="rep" data-nosearch="1" title="Choose the report"><option value="det">Report: detailed movements</option><option value="sku">Report: per SKU</option><option value="batch">Report: per SKU &amp; batch</option><option value="rack">Report: per rack</option><option value="sbr">Report: per SKU, batch &amp; rack</option></select>
      <select data-mv="dir" data-nosearch="1"><option value="all">Inbound + outbound</option><option value="in">Inbound only</option><option value="out">Outbound only</option></select>
      <button class="secondary small mv-ft" type="button" data-mv="ft">🔎 Filters</button><button class="secondary small" type="button" data-mv="xl">📊 Excel</button><button class="secondary small" type="button" data-mv="pr">🖨 Print</button><button class="secondary small" type="button" data-mv="ml">✉ Email</button><button class="secondary small" type="button" data-mv="rl" title="Re-read the ledger from SharePoint">🔄 Reload</button><button class="ghost small" type="button" data-mv="x">✕ Close</button></div>
      <div class="mv-f"><span class="mv-t">From</span><input type="date" data-mv="from"><span class="mv-t">to</span><input type="date" data-mv="to">
        <button class="ghost small" type="button" data-mv="d7">7 days</button><button class="ghost small" type="button" data-mv="d30">30 days</button><button class="ghost small" type="button" data-mv="dm">This month</button><button class="ghost small" type="button" data-mv="da">All dates</button>
        <select data-mv="fz" data-nosearch="1" title="Warehouse"><option value="">All warehouses</option>${zs.map(z => `<option value="${esc(z)}">${esc(z)}</option>`).join('')}</select>
        <input type="text" data-mv="fs" list="mvSkuDl" placeholder="SKU / description"><datalist id="mvSkuDl">${sk.map(k => `<option value="${esc(k)}">`).join('')}</datalist><input type="text" data-mv="fb" placeholder="Batch"><input type="text" data-mv="fr" placeholder="Rack code"><input type="text" data-mv="q" placeholder="🔍 Search ref, user, remarks…">
        <label class="mv-t"><input type="checkbox" data-mv="rel"> include relocations</label><label class="mv-t" title="Convert cartons / outers / pallets to pieces with the UOM list (UOM_Base_Nr)"><input type="checkbox" data-mv="uc"> convert to PC (UOM list)</label><button class="ghost small" type="button" data-mv="up" style="display:none">◀ Back</button><button class="ghost small" type="button" data-mv="clr">✕ Clear</button><span class="mv-t">Double-click a row to drill down: SKU → batches → movements</span></div>
      <div class="mv-k"></div><div class="mv-b"><table><thead></thead><tbody></tbody><tfoot></tfoot></table></div></div>`;
    document.body.appendChild(box); sync(); draw();
    const dd = () => { const x = data(); return { title: x.title, sheet: x.sheet, note: x.note, headers: x.headers, rows: x.rows, totals: x.totals }; };
    let tapT = 0, tapR = null;
    box.addEventListener('click', e => { if (e.target === box) return box.remove(); const tr = e.target.closest('tbody tr[data-s]'); if (tr && !e.target.closest('button,input,select')) { const n = Date.now(); if (tapR === tr && n - tapT < 450) { tapR = null; try { window.getSelection().removeAllRanges(); } catch (x) {} drill(tr); } else { tapR = tr; tapT = n; } return; }
      const b = e.target.closest('button[data-mv]'); if (!b) return; const a = b.dataset.mv;
      if (a === 'x') box.remove(); else if (a === 'ft') box.classList.toggle('fo'); else if (a === 'xl') a2Export(dd()); else if (a === 'pr') a2Print(dd()); else if (a === 'ml') a2Mail(dd);
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
