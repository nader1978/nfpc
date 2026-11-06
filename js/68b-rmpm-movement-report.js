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
#rmvBox{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}
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
