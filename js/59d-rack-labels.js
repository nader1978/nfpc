/* ---------- Rack label designer: barcode labels for the rack columns / pallet positions (opened from 3D → Rack setup → 🏷 Print labels) ---------- */
window.RKL = (function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = () => (typeof LS_BASE !== 'undefined' ? LS_BASE : 'orbit') + '_rklabels';
  const SIZES = [['100x50', '100 × 50 mm · shelf / column label'], ['148x105', '148 × 105 mm · A6 (4 per A4)'], ['99x52.5', '99 × 52.5 mm · 12 per A4'], ['70x37', '70 × 37 mm · 24 per A4'], ['100x150', '100 × 150 mm · 4×6 in label printer'], ['150x100', '150 × 100 mm · 6×4 in label printer'], ['60x40', '60 × 40 mm · small'], ['50x25', '50 × 25 mm · mini'], ['210x148', '210 × 148 mm · A5 landscape'], ['297x210', '297 × 210 mm · full A4 sign'], ['custom', 'Custom size…']];
  const PAPER = { 'A4p': ['A4 portrait', 210, 297], 'A4l': ['A4 landscape', 297, 210], 'A3p': ['A3 portrait', 297, 420], 'A3l': ['A3 landscape', 420, 297], 'Lp': ['Letter portrait', 215.9, 279.4], 'Ll': ['Letter landscape', 279.4, 215.9] };
  const DESIGNS = [['pro', 'Pro — Aisle · Bay · Level boxes + barcode'], ['big', 'Big code — code first, barcode below'], ['dist', 'Distance — huge bay number & level colour (read from the forklift)'], ['mini', 'Compact — code + barcode strip (small labels)']];
  const LVC = ['#1f6feb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#475569'];
  const D = { design: 'pro', size: '100x50', w: 100, h: 50, layout: 'sheet', paper: 'A4p', margin: 8, gap: 0, per: 'rack', copies: 1, hdr: 'NFPC', accent: 'level', color: '#1f4e79', bar: true, chip: true, abl: true, cap: true, date: true, cut: true, bayFrom: '', bayTo: '', levels: '', q: '' };
  let S = null, ROWS = [], ORD = ['aisle', 'bay', 'level', 'pos'];
  const load = () => { try { return Object.assign({}, D, JSON.parse(localStorage.getItem(KEY()) || '{}')); } catch (e) { return Object.assign({}, D); } };
  const save = () => { try { localStorage.setItem(KEY(), JSON.stringify(S)); } catch (e) {} };
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  /* aisle / bay / level / depth of a rack row, from Rack_3D_No (in the order set under Data check) or from the code */
  function parse(r) {
    const o = { aisle: '', bay: '', level: '', depth: '' }, p = String(r.Rack_3D_No || '').split('-').map(x => parseInt(x, 10));
    if (p.length >= 3) ORD.forEach((k, i) => { if (!isNaN(p[i])) o[k === 'pos' ? 'depth' : k] = p[i]; });
    const c = String(r.Rack_Code || ''), m = (re) => { const x = re.exec(c); return x ? +x[1] : ''; };
    if (o.aisle === '') o.aisle = m(/(?:^|[-_ ])(?:A|R)(\d+)/i); if (o.bay === '') o.bay = m(/B(\d+)/i); if (o.level === '') o.level = m(/(?:^|[-_ ])L(\d+)/i);
    if (o.depth === '') o.depth = Math.round(num(r.Default_Capacity)) || ''; return o;
  }
  function items() {
    const lv = String(S.levels || '').split(/[,\s]+/).filter(Boolean).map(Number), q = String(S.q || '').toLowerCase().trim(), bf = num(S.bayFrom), bt = num(S.bayTo), out = [];
    ROWS.forEach(r => { const a = parse(r); if (lv.length && !lv.includes(+a.level)) return; if (bf && !(+a.bay >= bf)) return; if (bt && !(+a.bay <= bt)) return; if (q && !Object.values(r).join(' ').toLowerCase().includes(q)) return;
      const base = { code: String(r.Rack_Code || '').trim(), store: r.Location_Desc || '', whs: r.WHs_Desc || '', area: r.Area_Desc || '', cap: Math.round(num(r.Default_Capacity)) || 0, a };
      if (!base.code) return; if (S.per === 'pos') { const n = base.cap || 1; for (let p = 1; p <= n; p++) out.push(Object.assign({}, base, { pos: p, text: base.code + '-P' + p })); } else out.push(Object.assign({}, base, { pos: 0, text: base.code })); });
    const k = Math.max(1, Math.round(num(S.copies)) || 1); if (k > 1) { const o2 = []; out.forEach(x => { for (let i = 0; i < k; i++) o2.push(x); }); return o2; } return out;
  }
  const pad2 = n => n === '' || n == null ? '–' : String(n).padStart(2, '0');
  /* ---------- one label ---------- */
  function label(it) {
    const w = S.w, h = S.h, p = Math.max(1.5, Math.min(w, h) * 0.06), iw = w - 2 * p, lvl = +it.a.level || 0, col = S.accent === 'fixed' ? S.color : S.accent === 'store' ? LVC[Math.abs([...String(it.store)].reduce((x, c) => x + c.charCodeAt(0), 0)) % LVC.length] : (lvl ? LVC[(lvl - 1) % LVC.length] : S.color);
    const fit = (txt, maxH, maxW, k) => Math.max(1.6, Math.min(maxH, maxW / (Math.max(1, String(txt).length) * (k || .6)))), t = it.text, date = new Date().toLocaleDateString('en-GB');
    const bar = S.bar ? `<div class="bc">${rkBarSvg(t)}</div>` : '', hdr = `<div class="hd"><span class="nm">${esc(S.hdr || '')}${S.hdr && (it.store || it.area) ? ' · ' : ''}${esc(it.store || it.area)}</span>${S.chip && it.whs ? `<span class="chip">${esc(it.whs)}</span>` : ''}</div>`;
    const ft = `<div class="ft"><span>${it.pos ? 'PALLET POSITION' : 'RACK LOCATION'}${S.cap && it.cap && !it.pos ? ' · ' + it.cap + ' PLT' : ''}</span><span>${esc(t)}</span>${S.date ? `<span>${date}</span>` : ''}</div>`;
    const abl = S.abl ? `<div class="abl">${[['AISLE', pad2(it.a.aisle)], ['BAY', pad2(it.a.bay)], ['LEVEL', it.a.level === '' ? '–' : it.a.level]].concat(it.pos ? [['POS', 'P' + it.pos]] : []).map(x => `<div><i>${x[0]}</i><b>${esc(x[1])}</b></div>`).join('')}</div>` : '';
    let inner, ab = abl ? 1 : 0;
    const f = { hd: Math.max(1.5, Math.min(h * .07, w * .04)), ft: Math.max(1.3, Math.min(h * .055, w * .032)), ab: Math.max(2, Math.min(h * .17, w * .1)), ai: Math.max(1.2, Math.min(h * .045, w * .028)) };
    if (S.design === 'big') { f.cd = fit(t, h * (S.bar ? .3 : .42), iw, .6); inner = `${hdr}<div class="cd" style="font-size:${f.cd}mm">${esc(t)}</div>${S.bar ? bar : ''}${ft}`; }
    else if (S.design === 'dist') { const big = it.pos ? 'P' + it.pos : 'B' + pad2(it.a.bay); f.cd = Math.min(h * (S.bar ? .34 : .5), iw * .6 / (big.length * .66)); inner = `${hdr}<div class="dist"><div class="bg" style="font-size:${f.cd}mm">${esc(big)}</div><div class="lv" style="background:${col}"><i>LEVEL</i><b style="font-size:${Math.min(h * .26, iw * .2)}mm">${esc(it.a.level === '' ? '–' : it.a.level)}</b></div></div><div class="cs" style="font-size:${fit(t, h * .09, iw, .6)}mm">${esc(t)}</div>${S.bar ? bar : ''}`; }
    else if (S.design === 'mini') { f.cd = fit(t, h * .3, iw, .6); inner = `<div class="cd" style="font-size:${f.cd}mm">${esc(t)}</div>${S.bar ? bar : ''}<div class="ft"><span>${esc(it.store || S.hdr || '')}</span>${S.abl ? `<span>A${pad2(it.a.aisle)} · B${pad2(it.a.bay)} · L${it.a.level === '' ? '–' : it.a.level}</span>` : ''}</div>`; }
    else { f.cd = fit(t, h * (S.bar ? .12 : .18), iw, .6); inner = `${hdr}${abl}<div class="cd" style="font-size:${f.cd}mm">${esc(t)}</div>${S.bar ? bar : ''}${ft}`; }
    return `<div class="lb d-${S.design}" style="--c:${col};--p:${p}mm;--hd:${f.hd}mm;--ft:${f.ft}mm;--ab:${f.ab}mm;--ai:${f.ai}mm;width:${w}mm;height:${h}mm">${inner}</div>`;
  }
  function doc(list, forPreview) {
    const w = S.w, h = S.h, e = list, sheet = S.layout === 'sheet', P = PAPER[S.paper] || PAPER.A4p, m = Math.max(0, num(S.margin)), g = Math.max(0, num(S.gap));
    let cols = 1, rows = 1; if (sheet) { cols = Math.max(1, Math.floor((P[1] - 2 * m + g) / (w + g))), rows = Math.max(1, Math.floor((P[2] - 2 * m + g) / (h + g))); }
    const per = sheet ? cols * rows : 1, pages = []; for (let i = 0; i < e.length; i += per) pages.push(e.slice(i, i + per));
    const css = `@page{size:${sheet ? P[1] + 'mm ' + P[2] + 'mm' : w + 'mm ' + h + 'mm'};margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;background:${forPreview ? '#e5e9f0' : '#fff'};font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#0f172a}
    .pg{${sheet ? `width:${P[1]}mm;height:${P[2]}mm;padding:${m}mm;display:grid;grid-template-columns:repeat(${cols},${w}mm);grid-auto-rows:${h}mm;gap:${g}mm;justify-content:center;align-content:start;` : `width:${w}mm;height:${h}mm;`}page-break-after:always;break-after:page;overflow:hidden;background:#fff;${forPreview ? 'margin:0 0 6mm;box-shadow:0 1px 6px rgba(0,0,0,.3);' : ''}}.pg:last-child{page-break-after:auto;break-after:auto}
    .lb{position:relative;overflow:hidden;padding:var(--p);display:flex;flex-direction:column;justify-content:space-between;gap:calc(var(--p)*.4);background:#fff;${S.cut ? 'outline:.2mm dashed #9aa5b8;outline-offset:-.1mm;' : ''}}
    .lb:before{content:"";position:absolute;left:0;top:0;bottom:0;width:calc(var(--p)*.8);background:var(--c)}.lb{padding-left:calc(var(--p)*1.5)}
    .hd{display:flex;justify-content:space-between;align-items:center;gap:calc(var(--p)*.5);font-size:var(--hd);font-weight:700;letter-spacing:.05em;color:#475569;text-transform:uppercase}.nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .chip{background:var(--c);color:#fff;border-radius:99mm;padding:calc(var(--hd)*.12) calc(var(--hd)*.65);white-space:nowrap;font-weight:800}
    .abl{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:calc(var(--p)*.4)}.abl>div{border:.25mm solid #d5dbe6;border-radius:calc(var(--p)*.5);text-align:center;padding:calc(var(--p)*.12) 0;background:#f8fafc}.abl i{display:block;font-style:normal;font-size:var(--ai);letter-spacing:.12em;color:#64748b;font-weight:700}.abl b{display:block;font-size:var(--ab);line-height:1.05;color:#0f172a;font-weight:800}
    .cd{text-align:center;font-weight:800;line-height:1.05;white-space:nowrap;letter-spacing:-.01em;color:#0b1220}.d-big .cd{color:var(--c)}
    .bc{flex:1 1 0;min-height:4mm;max-height:34%;padding:0 calc(var(--p)*.5)}.bc svg{height:100%!important}.d-big .bc,.d-mini .bc{max-height:38%}
    .ft{display:flex;justify-content:space-between;gap:2mm;font-size:var(--ft);color:#64748b;letter-spacing:.06em;border-top:.2mm solid #e2e8f0;padding-top:calc(var(--ft)*.35);white-space:nowrap}.ft span:nth-child(2){font-weight:700;color:#334155;overflow:hidden;text-overflow:ellipsis}
    .dist{flex:1;display:flex;gap:calc(var(--p)*.6);align-items:stretch;min-height:0}.dist .bg{flex:1;display:flex;align-items:center;justify-content:center;font-weight:900;color:#0b1220;line-height:1;letter-spacing:-.03em;border:.4mm solid #0b1220;border-radius:calc(var(--p)*.6)}.dist .lv{width:34%;border-radius:calc(var(--p)*.6);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}.dist .lv i{font-style:normal;font-size:var(--ft);letter-spacing:.14em;font-weight:700}.dist .lv b{font-weight:900;line-height:1}
    .cs{text-align:center;font-weight:800;color:#334155;white-space:nowrap;line-height:1}.d-mini{justify-content:center}.d-mini .cd{color:#0b1220}`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Rack labels</title><style>${css}</style></head><body>${pages.map(p => `<div class="pg">${p.map(label).join('')}</div>`).join('')}</body></html>`;
  }
  /* ---------- dialog ---------- */
  function draw() {
    const L = items(), box = Q('#rklBox'); if (!box) return; const stage = Q('#rklStage'), P = PAPER[S.paper] || PAPER.A4p, sheet = S.layout === 'sheet';
    let per = 1; if (sheet) per = Math.max(1, Math.floor((P[1] - 2 * S.margin + S.gap) / (S.w + S.gap))) * Math.max(1, Math.floor((P[2] - 2 * S.margin + S.gap) / (S.h + S.gap)));
    const np = Math.ceil(L.length / per) || 0; Q('#rklInfo').textContent = L.length + ' label(s) · ' + np + ' page(s)' + (sheet ? ' · ' + per + ' per ' + P[0] : ' · one label per page (' + S.w + ' × ' + S.h + ' mm)');
    Q('#rklWarn').textContent = sheet && (S.w > P[1] - 2 * S.margin || S.h > P[2] - 2 * S.margin) ? '⚠ This label is bigger than the paper minus the margins — choose a larger paper, another orientation, or “one label per page”.' : '';
    if (!L.length) { stage.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b">No racks match — change the filters (bay range, levels, search) or pick a store in Rack setup.</div>'; return; }
    const pw = (sheet ? P[1] : S.w) * 3.7795, ph = (sheet ? P[2] : S.h) * 3.7795, shown = L.slice(0, Math.min(L.length, per * 3)), n = Math.ceil(shown.length / per); stage.innerHTML = '';
    const f = document.createElement('iframe'); f.style.cssText = `border:0;width:${pw}px;height:${n * (ph + 23)}px;background:#e5e9f0;transform-origin:0 0`; stage.appendChild(f); const d = f.contentWindow.document; d.open(); d.write(doc(shown, true)); d.close();
    const sc = Math.min(1, (stage.clientWidth - 4) / pw); f.style.transform = `scale(${sc})`; stage.style.height = Math.round(n * (ph + 23) * sc) + 6 + 'px'; Q('#rklMore').textContent = L.length > shown.length ? 'Preview shows the first ' + shown.length + ' label(s) — all ' + L.length + ' are printed.' : '';
  }
  function sync() {   /* read the controls into S */
    const g = id => Q('#rkl' + id), v = id => g(id).value, c = id => g(id).checked;
    S.design = v('Design'); S.size = v('Size'); if (S.size !== 'custom') { const [w, h] = S.size.split('x').map(Number); S.w = w; S.h = h; g('W').value = w; g('H').value = h; } else { S.w = Math.max(15, num(v('W')) || 100); S.h = Math.max(10, num(v('H')) || 50); }
    g('W').disabled = g('H').disabled = S.size !== 'custom'; S.layout = v('Layout'); S.paper = v('Paper'); S.margin = num(v('Margin')); S.gap = num(v('Gap')); S.per = v('Per'); S.copies = num(v('Copies')) || 1; S.hdr = v('Hdr'); S.accent = v('Accent'); S.color = v('Color');
    ['Bar', 'Chip', 'Abl', 'Cap', 'Date', 'Cut'].forEach(k => { S[k.toLowerCase()] = c(k); }); S.bayFrom = v('BF'); S.bayTo = v('BT'); S.levels = v('Lv'); S.q = v('Q'); g('Paper').closest('label').style.display = g('Margin').closest('label').style.display = g('Gap').closest('label').style.display = S.layout === 'sheet' ? '' : 'none'; save(); draw();
  }
  function printNow() { const L = items(); if (!L.length) return; const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f); const d = f.contentWindow.document; d.open(); d.write(doc(L, false)); d.close(); setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); }, 350); try { addActivity('export', 'Printed ' + L.length + ' rack label(s)'); } catch (e) {} }
  function open(rows, ord) {
    ROWS = rows || []; ORD = ord || ORD; S = load(); const old = Q('#rklBack'); if (old) old.remove(); const m = document.createElement('div'); m.id = 'rklBack';
    m.innerHTML = `<style>#rklBack{position:fixed;inset:0;z-index:100080;background:rgba(10,20,40,.6);display:flex;align-items:center;justify-content:center;padding:14px}#rklBox{background:var(--card,#fff);color:var(--gray-800,#222);border-radius:14px;width:min(1240px,100%);height:min(94vh,900px);display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.45)}#rklBox .h{display:flex;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border,#e2e8f0)}#rklBox .b{display:flex;gap:14px;flex:1;min-height:0;padding:12px 16px}#rklBox .c{width:330px;flex:none;overflow:auto;padding-right:6px}#rklBox .c label{display:block;font-size:12px;margin:0 0 8px;color:var(--gray-600,#475569)}#rklBox .c input:not([type=checkbox]),#rklBox .c select{width:100%;margin:2px 0 0}#rklBox .c .r{display:flex;gap:8px}#rklBox .c .r>*{flex:1}#rklBox .c h4{margin:10px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--gray-600,#475569)}#rklBox .c .k{display:flex;gap:6px;align-items:center;margin:3px 0;color:inherit;font-size:13px}#rklBox .p{flex:1;min-width:0;overflow:auto;background:#e5e9f0;border-radius:10px;padding:8px}#rklBox .f{display:flex;gap:10px;align-items:center;padding:10px 16px;border-top:1px solid var(--border,#e2e8f0);flex-wrap:wrap}@media(max-width:820px){#rklBox .b{flex-direction:column}#rklBox .c{width:auto;max-height:45%}}</style>
    <div id="rklBox"><div class="h"><b>🏷 Rack labels — barcode &amp; design</b><span id="rklInfo" class="text-sm" style="margin-left:6px"></span><span style="flex:1"></span><button class="ghost small" type="button" data-rkl="x">✖ Close</button></div>
    <div class="b"><div class="c">
      <h4>Design</h4><label>Label design<select id="rklDesign">${DESIGNS.map(d => `<option value="${d[0]}">${d[1]}</option>`).join('')}</select></label>
      <label>Label size<select id="rklSize">${SIZES.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('')}</select></label>
      <div class="r"><label>Width (mm)<input id="rklW" type="number" min="15" step="0.5"></label><label>Height (mm)<input id="rklH" type="number" min="10" step="0.5"></label></div>
      <label>One label for<select id="rklPer"><option value="rack">each rack (lane / column)</option><option value="pos">each pallet position (P1…Pn)</option></select></label>
      <label>Copies of each<input id="rklCopies" type="number" min="1" max="20"></label>
      <h4>Page</h4><label>Printing on<select id="rklLayout"><option value="sheet">Paper sheet (many labels per page)</option><option value="single">Label printer / roll (one label per page)</option></select></label>
      <label>Paper<select id="rklPaper">${Object.entries(PAPER).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></label>
      <div class="r"><label>Margin (mm)<input id="rklMargin" type="number" min="0" step="0.5"></label><label>Gap (mm)<input id="rklGap" type="number" min="0" step="0.5"></label></div>
      <h4>Content</h4><label>Header text<input id="rklHdr" placeholder="e.g. company / warehouse name"></label>
      <label>Colour<select id="rklAccent"><option value="level">by level (L1 blue · L2 green · L3 amber …)</option><option value="store">by store</option><option value="fixed">one colour</option></select></label><label>Fixed colour<input id="rklColor" type="color" style="height:30px;padding:2px"></label>
      <label class="k"><input type="checkbox" id="rklBar"> Barcode (Code 128 — scan the rack code)</label><label class="k"><input type="checkbox" id="rklChip"> WHs code chip</label><label class="k"><input type="checkbox" id="rklAbl"> Aisle · Bay · Level boxes</label><label class="k"><input type="checkbox" id="rklCap"> Pallet capacity</label><label class="k"><input type="checkbox" id="rklDate"> Print date</label><label class="k"><input type="checkbox" id="rklCut"> Cut lines (dashed)</label>
      <h4>Which racks</h4><label>Search<input id="rklQ" type="search" placeholder="code, store…"></label><div class="r"><label>Bay from<input id="rklBF" type="number" min="1"></label><label>Bay to<input id="rklBT" type="number" min="1"></label></div><label>Levels (e.g. 1,2)<input id="rklLv" placeholder="all levels"></label>
    </div><div class="p" id="rklP"><div id="rklStage"></div></div></div>
    <div class="f"><button class="success" type="button" data-rkl="print">🖨 Print / Save as PDF</button><span id="rklWarn" style="color:#b45309;font-size:12px"></span><span id="rklMore" class="text-sm"></span><span style="flex:1"></span><span class="text-sm">Tip: in the print dialog choose “Actual size / 100 %” and no headers or footers.</span></div></div>`;
    document.body.appendChild(m);
    const set = (id, v) => { const e = Q('#rkl' + id); if (!e) return; if (e.type === 'checkbox') e.checked = !!v; else e.value = v == null ? '' : v; };
    set('Design', S.design); set('Size', SIZES.some(s => s[0] === S.size) ? S.size : 'custom'); set('W', S.w); set('H', S.h); set('Per', S.per); set('Copies', S.copies); set('Layout', S.layout); set('Paper', S.paper); set('Margin', S.margin); set('Gap', S.gap); set('Hdr', S.hdr); set('Accent', S.accent); set('Color', S.color);
    set('Bar', S.bar); set('Chip', S.chip); set('Abl', S.abl); set('Cap', S.cap); set('Date', S.date); set('Cut', S.cut); set('BF', S.bayFrom); set('BT', S.bayTo); set('Lv', S.levels); set('Q', S.q);
    m.addEventListener('input', e => { if (e.target.closest('.c')) { clearTimeout(open.t); open.t = setTimeout(sync, 160); } }); m.addEventListener('change', e => { if (e.target.closest('.c')) sync(); });
    m.addEventListener('click', e => { if (e.target === m) return; const b = e.target.closest('[data-rkl]'); if (!b) return; if (b.dataset.rkl === 'x') m.remove(); else if (b.dataset.rkl === 'print') printNow(); });
    sync();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q('#rklBack')) Q('#rklBack').remove(); });
  return { open, parse };
})();
