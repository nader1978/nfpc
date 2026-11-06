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
#rpsBox{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}
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
