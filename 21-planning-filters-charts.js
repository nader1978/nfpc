/* ---------- filtering ---------- */
const plVal = (o, k) => o[k];
function plMatchCond(o, c) {
  const v = o[c.key];
  if (c.op === 'in') return c.vals.length === 0 || c.vals.some(x => String(v == null ? '(blank)' : v) === x);
  if (c.op === 'range') { const n = typeof v === 'number' ? v : null; if (n == null) return false; if (c.min != null && n < c.min) return false; if (c.max != null && n > c.max) return false; return true; }
  if (c.op === 'contains') return String(v == null ? '' : v).toLowerCase().includes(String(c.text || '').toLowerCase());
  if (c.op === 'empty') return v == null || v === '' || v === 0;
  if (c.op === 'notempty') return !(v == null || v === '' || v === 0);
  return true;
}
function plMatchQ(o, q) {
  if (!q.length) return true; const t = (o.code + ' ' + o.item + ' ' + (o.brand || '') + ' ' + (o.subBrand || '') + ' ' + (o.size || '') + ' ' + (o.type || '') + ' ' + (o._health || '') + ' ' + (o._flags || '')).toLowerCase();
  return q.some(x => t.includes(String(x).toLowerCase()));
}
function plFilter(rows, skipKey, conds, q) { conds = conds || pl.conds; q = q || pl.q; return rows.filter(o => plMatchQ(o, q) && conds.every(c => c.key === skipKey || plMatchCond(o, c))); }
function plSetDim(key, vals) { pl.conds = pl.conds.filter(c => !(c.key === key && c.op === 'in')); if (vals.length) pl.conds.push({ id: ++pl.uid, key, op: 'in', vals: vals.slice() }); }
function plPick(key, val) { const c = pl.conds.find(x => x.key === key && x.op === 'in'); if (c && c.vals.length === 1 && c.vals[0] === val) plSetDim(key, []); else plSetDim(key, [val]); plRefresh(); }
function plLabel(key) { const c = PL_COL()[key]; return c ? c.label : key; }
const plIsNum = key => { const c = PL_COL()[key]; return c && (c.type === 'num' || c.type === 'pct' || c.type === 'days'); };
function plDims() { // categorical columns usable for grouping
  const out = []; if (!pl.cur) return out;
  plAllCols(pl.cur).forEach(c => { if (c.type !== 'text' || PL_SKIPDIM.has(c.key)) return; const s = new Set(pl.rows.map(o => o[c.key])); if (s.size >= 1 && s.size <= 60) out.push({ key: c.key, label: c.label }); });
  return out;
}
function plMetrics() { return pl.cur ? plAllCols(pl.cur).filter(c => c.type === 'num' || c.type === 'pct' || c.type === 'days').map(c => ({ key: c.key, label: c.label, type: c.type, section: c.section })) : []; }
function plFmtBy(type) { return type === 'pct' ? (v => plP(v)) : type === 'days' ? (v => plF(v, 1)) : (v => plF(v, Math.abs(v) < 100 && v % 1 ? 1 : 0)); }
function plAgg(rows, key, agg) {
  const vals = rows.map(o => o[key]).filter(v => typeof v === 'number'); if (agg === 'count') return rows.filter(o => o[key] != null && o[key] !== '').length;
  if (!vals.length) return 0; if (agg === 'sum') return vals.reduce((a, b) => a + b, 0); if (agg === 'avg') return vals.reduce((a, b) => a + b, 0) / vals.length; if (agg === 'min') return Math.min.apply(null, vals); if (agg === 'max') return Math.max.apply(null, vals); return vals.reduce((a, b) => a + b, 0);
}
function plSum(rows, k) { let t = 0; for (const o of rows) { const v = o[k]; if (typeof v === 'number') t += v; } return t; }
function plCover(rows) { const f = plSum(rows, 'monthlyFcst'); return f > 0 ? plSum(rows, 'releasedSOH') / (f / 30) : null; }
function plGroup(rows, key, topN) {
  const m = new Map(); rows.forEach(o => { const k = o[key] == null || o[key] === '' ? '(blank)' : String(o[key]); if (!m.has(k)) m.set(k, []); m.get(k).push(o); });
  return Array.from(m, ([k, rs]) => ({ key: k, rows: rs }));
}
const PL_SLOTS = { light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'], dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] };
function plEntityColor(dimKey, val) { // colour follows the entity (sorted order in the FULL snapshot), never its rank under a filter
  const all = Array.from(new Set(pl.rows.map(o => o[dimKey] == null ? '(blank)' : String(o[dimKey])))).sort((a, b) => a.localeCompare(b)), i = all.indexOf(String(val));
  const pal = document.body.classList.contains('dark') ? PL_SLOTS.dark : PL_SLOTS.light; return i >= 0 && i < 8 ? pal[i] : (document.body.classList.contains('dark') ? '#64748b' : '#a19f9d');
}

/* ---------- filter UI ---------- */
function plRefresh(opts) { opts = opts || {}; pl.view = plFilter(pl.rows); plRenderFilters(opts.except); plRenderActive(); plRenderCount(); plRenderBand(); plRenderKpis(); plRenderCharts(); plRenderTable(); }
function plRenderCount() { const el = PLQ('#plCount'); if (el) el.textContent = `${pl.view.length} of ${pl.rows.length} SKUs`; }
function plRenderFilters(except) {
  const host = PLQ('#plDimHost'); if (!host || !pl.cur) return;
  const keys = PL_DIM_KEYS.filter(k => PL_COL()[k] && new Set(pl.rows.map(o => o[k])).size >= 2);
  Array.from(host.children).forEach(ch => { if (ch.dataset.k === except) return; ch.remove(); });
  keys.forEach(k => {
    if (k === except && host.querySelector(`[data-k="${k}"]`)) return;
    const wrap = document.createElement('div'); wrap.className = 'pl-dim'; wrap.dataset.k = k; wrap.innerHTML = `<label>${plEsc(plLabel(k))}</label>`;
    const base = plFilter(pl.rows, k), opts = Array.from(new Set(base.map(o => o[k] == null ? '(blank)' : String(o[k])))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (k === '_health') { const order = plHealthDefs().map(h => h.k); opts.sort((a, b) => order.indexOf(a) - order.indexOf(b)); }
    const cur = (pl.conds.find(c => c.key === k && c.op === 'in') || { vals: [] }).vals.slice();
    wrap.appendChild(buildMultiCombo(cur, Array.from(new Set(opts.concat(cur))), arr => { plSetDim(k, arr); plRefresh({ except: k }); }, { placeholder: 'All' }));
    const ref = Array.from(host.children).find(ch => PL_DIM_KEYS.indexOf(ch.dataset.k) > PL_DIM_KEYS.indexOf(k)); host.insertBefore(wrap, ref || null);
  });
}
function plRenderActive() {
  const host = PLQ('#plActive'); if (!host) return; host.innerHTML = '';
  pl.conds.filter(c => !(c.op === 'in' && PL_DIM_KEYS.includes(c.key))).forEach(c => {
    const chip = document.createElement('span'); chip.className = 'pl-chip'; const lab = plLabel(c.key);
    if (c.op === 'range') { chip.innerHTML = `<b>${plEsc(lab)}</b> between <input type="number" step="any" value="${c.min == null ? '' : c.min}" data-e="min" placeholder="min" /> and <input type="number" step="any" value="${c.max == null ? '' : c.max}" data-e="max" placeholder="max" />`; chip.querySelectorAll('input').forEach(i => i.addEventListener('change', () => { const v = i.value === '' ? null : Number(i.value); c[i.dataset.e] = v; plRefresh(); })); }
    else if (c.op === 'in') chip.innerHTML = `<b>${plEsc(lab)}</b> = ${plEsc(c.vals.join(', '))}`;
    else if (c.op === 'contains') chip.innerHTML = `<b>${plEsc(lab)}</b> contains “${plEsc(c.text)}”`;
    else chip.innerHTML = `<b>${plEsc(lab)}</b> ${c.op === 'empty' ? 'is empty / 0' : 'has a value'}`;
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.title = 'Remove'; x.addEventListener('click', () => { pl.conds = pl.conds.filter(z => z !== c); plRefresh(); }); chip.appendChild(x); host.appendChild(chip);
  });
  host.style.display = host.children.length ? '' : 'none';
}
function plSearchInit() {
  const host = PLQ('#plSearchHost'); host.innerHTML = ''; if (!pl.cur) return;
  const opts = Array.from(new Set(pl.rows.flatMap(o => [o.code, o.item]).filter(Boolean))).sort();
  host.appendChild(buildMultiCombo(pl.q.slice(), opts, arr => { pl.q = arr; plRefresh({ except: '__none' }); }, { placeholder: '🔍 Search SKU code, item, brand… pick several (Enter adds typed text)' }));
}
function plAddFilterPop() {
  const old = PLQ('#plPop'); if (old) { old.remove(); return; }
  const pop = document.createElement('div'); pop.id = 'plPop'; pop.className = 'pl-pop'; const btn = PLQ('#plAddFilterBtn'), host = PLQ('#plFilters');
  pop.style.left = Math.max(0, btn.offsetLeft - 20) + 'px'; pop.style.top = (btn.offsetTop + btn.offsetHeight + 6) + 'px';
  const cols = plAllCols(pl.cur), bySec = {}; cols.forEach(c => { (bySec[c.section] = bySec[c.section] || []).push(c); });
  pop.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-weight:700;">Filter on any column</span><span class="btn-row" style="margin:0;"><button id="plPopOk" class="small" type="button">Add filter</button><button id="plPopX" class="ghost small" type="button">Cancel</button></span></div><select id="plPopCol" style="margin:0 0 8px;">${PL_SECTIONS.filter(s => bySec[s]).map(s => `<optgroup label="${plEsc(s)}">${bySec[s].map(c => `<option value="${plEsc(c.key)}">${plEsc(c.label)}</option>`).join('')}</optgroup>`).join('')}</select><div id="plPopBody"></div>`;
  host.appendChild(pop); let picked = [];
  const draw = () => {
    const k = PLQ('#plPopCol').value, b = PLQ('#plPopBody'), c = PL_COL()[k]; picked = []; b.innerHTML = '';
    if (c.type === 'text') {
      const opts = Array.from(new Set(pl.rows.map(o => o[k] == null ? '(blank)' : String(o[k])))).sort((a, b2) => a.localeCompare(b2, undefined, { numeric: true }));
      b.innerHTML = '<label class="text-sm">Pick values (any match)</label><div id="plPopVals"></div><label class="text-sm" style="margin-top:6px;display:block;">…or text contains</label><input type="text" id="plPopTxt" placeholder="e.g. 180" />';
      PLQ('#plPopVals').appendChild(buildMultiCombo([], opts, arr => { picked = arr; }, { placeholder: 'Type to search…' }));
    } else {
      const vals = pl.rows.map(o => o[k]).filter(v => typeof v === 'number'), mn = vals.length ? Math.min.apply(null, vals) : 0, mx = vals.length ? Math.max.apply(null, vals) : 0;
      b.innerHTML = `<div class="text-sm" style="color:var(--gray-600);margin-bottom:4px;">Values range from ${plEsc(plFmtBy(c.type)(mn))} to ${plEsc(plFmtBy(c.type)(mx))}${c.type === 'pct' ? ' (enter 0.25 for 25%)' : ''}</div><div class="btn-row"><input type="number" step="any" id="plPopMin" placeholder="min" style="max-width:120px;margin:0;" /><span>to</span><input type="number" step="any" id="plPopMax" placeholder="max" style="max-width:120px;margin:0;" /></div><label class="text-sm" style="display:block;margin-top:6px;"><select id="plPopMode" style="margin:0;"><option value="range">Between min and max</option><option value="empty">Is empty or zero</option><option value="notempty">Has a value (not zero)</option></select></label>`;
    }
  };
  PLQ('#plPopCol').addEventListener('change', draw); draw();
  PLQ('#plPopX').addEventListener('click', () => pop.remove());
  PLQ('#plPopOk').addEventListener('click', () => {
    const k = PLQ('#plPopCol').value, c = PL_COL()[k];
    if (c.type === 'text') { const t = (PLQ('#plPopTxt').value || '').trim(); if (picked.length) pl.conds.push({ id: ++pl.uid, key: k, op: 'in', vals: picked.slice() }); else if (t) pl.conds.push({ id: ++pl.uid, key: k, op: 'contains', text: t }); else return; }
    else { const mode = PLQ('#plPopMode').value; if (mode !== 'range') pl.conds.push({ id: ++pl.uid, key: k, op: mode }); else { const mn = PLQ('#plPopMin').value, mx = PLQ('#plPopMax').value; if (mn === '' && mx === '') return; pl.conds.push({ id: ++pl.uid, key: k, op: 'range', min: mn === '' ? null : Number(mn), max: mx === '' ? null : Number(mx) }); } }
    pop.remove(); plRefresh();
  });
}
const PL_PRE_KEY = LS_BASE + '_pl_presets';
function plPresets() { try { return JSON.parse(localStorage.getItem(PL_PRE_KEY) || '[]'); } catch (e) { return []; } }
function plPresetFill() { const s = PLQ('#plPresetSel'); s.innerHTML = '<option value="">★ Saved filter sets…</option>' + plPresets().map((p, i) => `<option value="${i}">${plEsc(p.name)}</option>`).join(''); }
function plFiltersInit() {
  PLQ('#plAddFilterBtn').addEventListener('click', plAddFilterPop);
  PLQ('#plClearBtn').addEventListener('click', () => { pl.conds = []; pl.q = []; plSearchInit(); const h = PLQ('#plDimHost'); h.innerHTML = ''; plRefresh(); });
  PLQ('#plPresetSave').addEventListener('click', () => { if (!pl.conds.length && !pl.q.length) { sectionToast('Set some filters first.', 'warn'); return; } const name = prompt('Name for this filter set:'); if (!name) return; const l = plPresets().filter(p => p.name !== name); l.push({ name, conds: pl.conds.map(c => Object.assign({}, c)), q: pl.q.slice() }); try { localStorage.setItem(PL_PRE_KEY, JSON.stringify(l)); } catch (e) {} plPresetFill(); sectionToast('Filter set saved.', 'ok'); });
  PLQ('#plPresetDel').addEventListener('click', () => { const i = PLQ('#plPresetSel').value; if (i === '') return; const l = plPresets(); l.splice(+i, 1); try { localStorage.setItem(PL_PRE_KEY, JSON.stringify(l)); } catch (e) {} plPresetFill(); });
  PLQ('#plPresetSel').addEventListener('change', e => { const p = plPresets()[+e.target.value]; if (!p) return; pl.conds = p.conds.map(c => Object.assign({}, c, { id: ++pl.uid })); pl.q = (p.q || []).slice(); plSearchInit(); PLQ('#plDimHost').innerHTML = ''; plRefresh(); });
  document.addEventListener('mousedown', e => { const p = PLQ('#plPop'); if (p && !e.composedPath().includes(p) && e.target.id !== 'plAddFilterBtn' && !e.target.closest('.combo-list')) p.remove(); });
  plPresetFill();
}


/* ============================================================
   PLANNING DEPT. — SVG chart toolkit (no external library)
   ============================================================ */
const SVGNS = 'http://www.w3.org/2000/svg', PL_FONT = 'Segoe UI, Helvetica, Arial, sans-serif';
function plT() {
  const d = document.body.classList.contains('dark');
  return { d, surface: d ? '#1e293b' : '#ffffff', text: d ? '#f1f5f9' : '#1f2937', text2: d ? '#cbd5e1' : '#52514e', muted: d ? '#94a3b8' : '#6b6a67', grid: d ? '#334155' : '#edebe9',
    series: d ? PL_SLOTS.dark : PL_SLOTS.light, fc: d ? '#2f5f9a' : '#9ec5f4', act: d ? '#5598e7' : '#2a78d6', good: '#0ca30c', warn: '#fab219', serious: '#ec835a', crit: '#d03b3b',
    pos: d ? '#3987e5' : '#2a78d6', neg: d ? '#e66767' : '#e34948', mid: d ? '#383835' : '#f0efec' };
}
const PL_SEQ_L = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'], PL_SEQ_D = ['#104281', '#184f95', '#1c5cab', '#2a78d6', '#5598e7', '#86b6ef', '#b7d3f6'];
function plHex(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function plSeq(t) { const st = document.body.classList.contains('dark') ? PL_SEQ_D : PL_SEQ_L; t = Math.max(0, Math.min(1, t)); const x = t * (st.length - 1), i = Math.min(st.length - 2, Math.floor(x)), f = x - i, a = plHex(st[i]), b = plHex(st[i + 1]); return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, '0')).join(''); }
function plInk(bg) { const [r, g, b] = plHex(bg).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.36 ? '#0b0b0b' : '#ffffff'; }
function S(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in (attrs || {})) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function Tx(parent, x, y, str, o) { o = o || {}; const e = S('text', { x, y, 'font-size': o.size || 11, 'font-family': PL_FONT, fill: o.fill || plT().text2, 'text-anchor': o.anchor || 'start', 'dominant-baseline': o.base || 'middle' }, parent); if (o.weight) e.setAttribute('font-weight', o.weight); e.textContent = str; return e; }
const plW = s => String(s).length * 6.1;
function plTrunc(s, w) { s = String(s); const max = Math.max(3, Math.floor(w / 6.1)); return s.length > max ? s.slice(0, max - 1) + '…' : s; }
function plTicks(max, n) { if (!(max > 0)) return [0, 1]; const raw = max / (n || 4), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, s = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p, out = []; for (let v = 0; v <= max + s * 0.999; v += s) out.push(Math.round(v / s) * s); return out; }
/* an expanded (full-page) chart card: draw the chart as tall as the page allows */
const plFullH = (host, h) => { try { if (!host.closest('.pl-card.pl-full')) return h; return Math.max(h, Math.round(window.innerHeight - host.getBoundingClientRect().top - 72)); } catch (e) { return h; } };
function plSvg(host, w, h) { host.innerHTML = ''; return S('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img', 'font-family': PL_FONT }, host); }
function plBarPath(x, y, w, h, r, end) { // square at baseline, rounded data-end
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (end === 'right') return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  if (end === 'up') return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  if (end === 'left') return `M${x + w},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w}Z`;
  return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
}
/* tooltip — textContent only */
function plTipEl() { let t = PLQ('#plTip'); if (!t) { t = document.createElement('div'); t.id = 'plTip'; document.body.appendChild(t); } return t; }
function plTip(ev, title, rows) {
  const t = plTipEl(); t.innerHTML = ''; if (title) { const a = document.createElement('div'); a.className = 'tt'; a.textContent = title; t.appendChild(a); }
  (rows || []).forEach(r => { const d = document.createElement('div'); d.className = 'tr'; if (r.c) { const i = document.createElement('i'); i.style.background = r.c; d.appendChild(i); } const k = document.createElement('span'); k.textContent = r.k; d.appendChild(k); if (r.v != null) { const b = document.createElement('b'); b.textContent = r.v; d.appendChild(b); } t.appendChild(d); });
  t.style.display = 'block'; const w = t.offsetWidth, h = t.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = ev.clientY - h - 14; t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, y) + 'px';
}
const plTipHide = () => { const t = PLQ('#plTip'); if (t) t.style.display = 'none'; };
function plHover(el, fn, click) {
  el.addEventListener('pointermove', e => { fn(e); }); el.addEventListener('pointerleave', plTipHide); el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); fn({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); }); el.addEventListener('blur', plTipHide);
  if (click) { el.style.cursor = 'pointer'; el.addEventListener('click', click); el.addEventListener('keydown', e => { if (e.key === 'Enter') click(e); }); }
}
function plEmpty(host, msg) { host.innerHTML = `<div class="pl-empty">${plEsc(msg || 'No data for the current filters.')}</div>`; }
function plLegend(items) { return `<div class="pl-leg">${items.map(i => `<span><i class="${i.kind || ''}" style="background:${i.c}"></i>${plEsc(i.name)}</span>`).join('')}</div>`; }

/* ---------- horizontal bars: single, grouped or stacked ---------- */
function plcBarsH(host, o) {
  const T = plT(), rows = o.rows || []; if (!rows.length) return plEmpty(host);
  const ns = o.series.length, stacked = !!o.stacked, W = Math.max(280, host.clientWidth || 560);
  const lw = o.labelW || Math.min(200, Math.max(70, Math.max.apply(null, rows.map(r => plW(r.label))) + 10)), padR = o.padR || 64, top = 4, axisH = 22;
  let thick = Math.min(o.thick || 16, 22), rowH = o.rowH || (stacked || ns === 1 ? Math.max(24, thick + 10) : ns * (thick * 0.7 + 3) + 12);
  { const fh = plFullH(host, 0); if (fh > 0) { rowH = Math.min(72, Math.max(rowH, (fh - top - axisH) / rows.length)); thick = Math.min(46, Math.max(thick, (rowH - 12) / (stacked || ns === 1 ? 1 : ns) * 0.8)); } }
  const tot = r => stacked ? r.vals.reduce((a, b) => a + (b || 0), 0) : Math.max.apply(null, r.vals.map(v => v || 0));
  let max = Math.max.apply(null, rows.map(r => Math.max(tot(r), r.mark || 0))); if (o.minMax) max = Math.max(max, o.minMax); const ticks = plTicks(max, 4); max = ticks[ticks.length - 1] || 1;
  const h = top + rows.length * rowH + axisH, svg = plSvg(host, W, h), pw = W - lw - padR, X = v => lw + (v / max) * pw;
  ticks.forEach(t => { S('line', { x1: X(t), x2: X(t), y1: top, y2: h - axisH, stroke: T.grid, 'stroke-width': 1 }, svg); Tx(svg, X(t), h - 8, (o.tickFmt || plK)(t), { size: 10.5, fill: T.muted, anchor: 'middle' }); });
  rows.forEach((r, i) => {
    const y0 = top + i * rowH, cy = y0 + rowH / 2, hot = S('g', { tabindex: 0, 'aria-label': `${r.label}: ${r.vals.map((v, k) => o.series[k].name + ' ' + (o.fmt || plF)(v)).join(', ')}` }, svg);
    S('rect', { x: 0, y: y0, width: W, height: rowH, fill: 'transparent' }, hot);
    const lab = Tx(hot, lw - 8, cy, plTrunc(r.label, lw - 12), { anchor: 'end', fill: r.dim ? T.muted : T.text2 }); const tl = S('title', {}, lab); tl.textContent = r.label;
    if (stacked) { let acc = 0; const n = r.vals.length; r.vals.forEach((v, k) => { if (!(v > 0)) return; const x1 = X(acc), x2 = X(acc + v), w = Math.max(1, x2 - x1 - 2), last = !r.vals.slice(k + 1).some(z => z > 0); S('path', { d: plBarPath(x1, cy - thick / 2, w, thick, last ? 4 : 0, last ? 'right' : 'flat'), fill: o.series[k].color }, hot); acc += v; });
      Tx(hot, X(acc) + 6, cy, (o.totalFmt || o.fmt || plK)(acc), { fill: T.text, size: 11, weight: 600 }); }
    else { const bt = ns === 1 ? thick : Math.max(7, Math.min(thick, (rowH - 12) / ns - 2)); r.vals.forEach((v, k) => { const y = cy - (ns * bt + (ns - 1) * 2) / 2 + k * (bt + 2), w = Math.max(0, X(v || 0) - lw); if (w > 0) S('path', { d: plBarPath(lw, y, w, bt, 4, 'right'), fill: r.colors && r.colors[k] || o.series[k].color }, hot); if (o.labels !== false && (k === o.labelSeries || (o.labelSeries == null && k === ns - 1))) Tx(hot, lw + w + 6, y + bt / 2, (o.labelFn ? o.labelFn(r, v, k) : (o.fmt || plK)(v)), { fill: T.text, size: 11, weight: 600 }); }); }
    if (r.mark != null) S('line', { x1: X(r.mark), x2: X(r.mark), y1: y0 + 4, y2: y0 + rowH - 4, stroke: T.text, 'stroke-width': 2, 'stroke-linecap': 'round' }, hot);
    plHover(hot, e => plTip(e, r.label, (r.tip || r.vals.map((v, k) => ({ c: o.series[k].color, k: o.series[k].name, v: (o.fmt || plF)(v) }))).concat(r.mark != null ? [{ k: o.markName || 'Marker', v: (o.fmt || plF)(r.mark) }] : [])), o.onClick ? () => o.onClick(r) : null);
  });
  if (o.ref != null) { S('line', { x1: X(o.ref), x2: X(o.ref), y1: top, y2: h - axisH, stroke: T.text, 'stroke-width': 1.5 }, svg); Tx(svg, X(o.ref) + 4, top + 8, o.refLabel || '', { size: 10.5, fill: T.text2 }); }
}
/* ---------- vertical columns (grouped / single) ---------- */
function plcCols(host, o) {
  const T = plT(), cats = o.cats || []; if (!cats.length) return plEmpty(host);
  const ns = o.series.length, W = Math.max(280, host.clientWidth || 560), H = plFullH(host, o.height || 250), padL = 44, top = 18, bot = 46, pw = W - padL - 8, ph = H - top - bot;
  let max = Math.max.apply(null, cats.map(c => o.stacked ? c.vals.reduce((a, v) => a + (v || 0), 0) : Math.max.apply(null, c.vals.map(v => v || 0).concat([c.mark || 0])))); const ticks = plTicks(max, 4); max = ticks[ticks.length - 1] || 1;
  const svg = plSvg(host, W, H), Y = v => top + ph - (v / max) * ph, band = pw / cats.length;
  ticks.forEach(t => { S('line', { x1: padL, x2: W - 8, y1: Y(t), y2: Y(t), stroke: T.grid }, svg); Tx(svg, padL - 6, Y(t), (o.tickFmt || plK)(t), { size: 10.5, fill: T.muted, anchor: 'end' }); });
  cats.forEach((c, i) => {
    const cx = padL + band * i + band / 2, bt = o.stacked ? Math.max(8, Math.min(46, band - 16)) : Math.min(22, (band - 10) / ns - 2), gw = o.stacked ? bt : ns * bt + (ns - 1) * 2, g = S('g', { tabindex: 0, 'aria-label': `${c.label}: ${c.vals.map((v, k) => o.series[k].name + ' ' + (o.fmt || plF)(v)).join(', ')}` }, svg);
    S('rect', { x: cx - band / 2, y: top, width: band, height: ph + bot, fill: 'transparent' }, g);
    if (o.stacked) { let acc = 0, lastK = -1; c.vals.forEach((v, k) => { if (v) lastK = k; }); c.vals.forEach((v, k) => { v = v || 0; const y = Y(acc + v), h = Y(acc) - y; if (h > 0) S('path', { d: plBarPath(cx - bt / 2, y, bt, h, k === lastK ? 4 : 0, 'up'), fill: o.series[k].color }, g); acc += v; }); if (o.labelFn && acc) Tx(g, cx, Y(acc) - 8, o.labelFn(c, acc), { size: 10.5, fill: T.text, anchor: 'middle', weight: 600 }); }
    else c.vals.forEach((v, k) => { const x = cx - gw / 2 + k * (bt + 2), y = Y(v || 0), h = top + ph - y; if (h > 0) S('path', { d: plBarPath(x, y, bt, h, 4, 'up'), fill: o.series[k].color }, g); if ((k === ns - 1 || o.labelAll) && o.labelFn) Tx(g, x + bt / 2, y - 8 - (o.labelAll && k % 2 === 0 ? 12 : 0), o.labelFn(c, v), { size: o.labelAll ? 9.5 : 10.5, fill: T.text, anchor: 'middle', weight: 600 }); });
    if (c.mark != null) S('line', { x1: cx - gw / 2 - 3, x2: cx + gw / 2 + 3, y1: Y(c.mark), y2: Y(c.mark), stroke: T.text, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    const lab = Tx(g, cx, top + ph + 14, plTrunc(c.label, Math.max(30, band - 2)), { size: 11, anchor: 'middle', fill: T.text2 }); const tl = S('title', {}, lab); tl.textContent = c.label;
    if (c.sub) Tx(g, cx, top + ph + 28, c.sub, { size: 10.5, anchor: 'middle', fill: T.muted });
    plHover(g, e => plTip(e, c.label, c.tip || c.vals.map((v, k) => ({ c: o.series[k].color, k: o.series[k].name, v: (o.fmt || plF)(v) }))), o.onClick ? () => o.onClick(c) : null);
  });
  S('line', { x1: padL, x2: W - 8, y1: top + ph, y2: top + ph, stroke: T.grid }, svg);
}
/* ---------- donut ---------- */
function plcDonut(host, o) {
  const T = plT(), sl = (o.slices || []).filter(s => s.value > 0), tot = sl.reduce((a, s) => a + s.value, 0); if (!tot) return plEmpty(host);
  host.innerHTML = ''; const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;gap:16px;align-items:center;flex-wrap:wrap;'; host.appendChild(wrap);
  const size = host.closest && host.closest('.pl-card.pl-full') ? Math.max(190, Math.min(Math.round(window.innerHeight - host.getBoundingClientRect().top - 90), Math.round((host.clientWidth || 360) * 0.5), 560)) : Math.min(190, Math.max(130, (host.clientWidth || 360) * 0.42)), R = size / 2, r0 = R * 0.62, svg = S('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', style: 'flex:none;width:' + size + 'px;height:' + size + 'px' }); wrap.appendChild(svg);
  let a = -Math.PI / 2; const gap = sl.length > 1 ? 0.025 : 0;
  sl.forEach(s => { const ang = s.value / tot * Math.PI * 2, a0 = a + gap / 2, a1 = a + ang - gap / 2; a += ang; if (a1 <= a0) return; const lg = a1 - a0 > Math.PI ? 1 : 0, p = (r, t) => [R + r * Math.cos(t), R + r * Math.sin(t)];
    const [x0, y0] = p(R - 1, a0), [x1, y1] = p(R - 1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
    const path = S('path', { d: `M${x0},${y0}A${R - 1},${R - 1} 0 ${lg} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${lg} 0 ${x3},${y3}Z`, fill: s.color, tabindex: 0, 'aria-label': `${s.label}: ${plF(s.value)} (${plP(s.value / tot, 0)})` }, svg);
    plHover(path, e => plTip(e, s.label, [{ c: s.color, k: o.unit || 'Value', v: plF(s.value) }, { k: 'Share', v: plP(s.value / tot, 1) }]), o.onClick ? () => o.onClick(s) : null); });
  Tx(svg, R, R - 6, o.center ? o.center.value : plF(tot), { size: 20, weight: 700, anchor: 'middle', fill: T.text }); Tx(svg, R, R + 14, o.center ? o.center.label : 'total', { size: 11, anchor: 'middle', fill: T.muted });
  const leg = document.createElement('div'); leg.style.cssText = 'display:flex;flex-direction:column;gap:5px;font-size:12px;flex:1;min-width:150px;'; wrap.appendChild(leg);
  (o.slices || []).forEach(s => { const d = document.createElement('div'); d.style.cssText = 'display:flex;align-items:center;gap:7px;cursor:' + (o.onClick ? 'pointer' : 'default') + ';opacity:' + (s.value > 0 ? 1 : .45); const i = document.createElement('i'); i.style.cssText = `width:10px;height:10px;border-radius:3px;background:${s.color};flex:none`; d.appendChild(i); const t = document.createElement('span'); t.textContent = `${s.glyph ? s.glyph + ' ' : ''}${s.label}`; t.style.flex = '1'; d.appendChild(t); const b = document.createElement('b'); b.textContent = `${plF(s.value)} · ${plP(s.value / tot, 0)}`; d.appendChild(b); if (o.onClick) d.addEventListener('click', () => o.onClick(s)); leg.appendChild(d); });
}
/* ---------- line (with crosshair tooltip) ---------- */
function plcLine(host, o) {
  const T = plT(), xs = o.x || []; if (xs.length < 1) return plEmpty(host, o.empty);
  const W = Math.max(280, host.clientWidth || 560), H = plFullH(host, o.height || 240), padL = 48, padR = 54, top = 12, bot = 28, pw = W - padL - padR, ph = H - top - bot;
  const all = o.series.flatMap(s => s.vals.filter(v => v != null)); let mn = o.zero ? 0 : Math.min.apply(null, all), mx = Math.max.apply(null, all.concat(o.ref != null ? [o.ref] : [])); if (mn === mx) { mn -= 1; mx += 1; } const pad = (mx - mn) * 0.08; if (!o.zero) mn -= pad; mx += pad;
  const ticks = plTicks(mx - mn, 4).map(t => mn + t), svg = plSvg(host, W, H), X = i => xs.length === 1 ? padL + pw / 2 : padL + i / (xs.length - 1) * pw, Y = v => top + ph - (v - mn) / (mx - mn) * ph;
  ticks.filter(t => t <= mx + 1e-9).forEach(t => { S('line', { x1: padL, x2: W - padR, y1: Y(t), y2: Y(t), stroke: T.grid }, svg); Tx(svg, padL - 6, Y(t), (o.tickFmt || plK)(t), { size: 10.5, fill: T.muted, anchor: 'end' }); });
  const every = Math.max(1, Math.ceil(xs.length / Math.floor(pw / 52))); xs.forEach((x, i) => { if (i % every === 0 || i === xs.length - 1) Tx(svg, X(i), H - 8, x, { size: 10.5, fill: T.muted, anchor: 'middle' }); });
  if (o.ref != null) { S('line', { x1: padL, x2: W - padR, y1: Y(o.ref), y2: Y(o.ref), stroke: T.text2, 'stroke-width': 1.2 }, svg); Tx(svg, W - padR + 4, Y(o.ref), o.refLabel || '', { size: 10.5, fill: T.text2 }); }
  o.series.forEach(s => { let d = '', pen = false; s.vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i) + ',' + Y(v); pen = true; }); S('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    if (o.area && o.series.length === 1) { const pts = s.vals.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean); if (pts.length > 1) S('path', { d: `M${pts[0][0]},${top + ph}` + pts.map(p => `L${p[0]},${p[1]}`).join('') + `L${pts[pts.length - 1][0]},${top + ph}Z`, fill: s.color, opacity: 0.1 }, svg); }
    const li = s.vals.map((v, i) => v != null ? i : -1).filter(i => i >= 0).pop(); if (li != null && li >= 0) { S('circle', { cx: X(li), cy: Y(s.vals[li]), r: 5, fill: s.color, stroke: T.surface, 'stroke-width': 2 }, svg); Tx(svg, X(li) + 9, Y(s.vals[li]), (o.fmt || plK)(s.vals[li]), { size: 11, fill: T.text, weight: 600 }); } });
  const cross = S('line', { y1: top, y2: top + ph, stroke: T.muted, 'stroke-width': 1, visibility: 'hidden' }, svg), ov = S('rect', { x: padL, y: top, width: pw, height: ph, fill: 'transparent' }, svg);
  ov.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width), i = Math.max(0, Math.min(xs.length - 1, Math.round((px - padL) / pw * (xs.length - 1)))); cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible'); plTip(e, xs[i], o.series.map(s => ({ c: s.color, k: s.name, v: s.vals[i] == null ? '—' : (o.fmt || plF)(s.vals[i]) }))); });
  ov.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); plTipHide(); }); if (o.onPoint) { ov.style.cursor = 'pointer'; ov.addEventListener('click', e => { const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width), i = Math.max(0, Math.min(xs.length - 1, Math.round((px - padL) / pw * (xs.length - 1)))); o.onPoint(i); }); }
}
/* ---------- scatter / bubble (nearest-point hover) ---------- */
function plcScatter(host, o) {
  const T = plT(), pts = (o.pts || []).filter(p => p.x != null && p.y != null); if (!pts.length) return plEmpty(host);
  const W = Math.max(300, host.clientWidth || 560), H = plFullH(host, o.height || 320), padL = 46, padR = 14, top = 12, bot = 38, pw = W - padL - padR, ph = H - top - bot;
  const xmax = o.xmax || Math.max.apply(null, pts.map(p => p.x)) * 1.05 || 1, ymax = o.ymax || Math.max.apply(null, pts.map(p => p.y)) * 1.08 || 1, ymin = 0, xticks = plTicks(xmax, 5), yticks = plTicks(ymax, 4), xm = xticks[xticks.length - 1], ym = yticks[yticks.length - 1];
  const X = v => padL + Math.min(v, xm) / xm * pw, Y = v => top + ph - Math.min(v, ym) / ym * ph, svg = plSvg(host, W, H), smax = Math.max.apply(null, pts.map(p => p.size || 1)) || 1, R = p => 4 + 9 * Math.sqrt((p.size || 0) / smax);
  yticks.forEach(t => { S('line', { x1: padL, x2: W - padR, y1: Y(t), y2: Y(t), stroke: T.grid }, svg); Tx(svg, padL - 6, Y(t), (o.yFmt || plK)(t), { size: 10.5, fill: T.muted, anchor: 'end' }); });
  xticks.forEach(t => { S('line', { x1: X(t), x2: X(t), y1: top, y2: top + ph, stroke: T.grid }, svg); Tx(svg, X(t), top + ph + 14, (o.xFmt || plK)(t), { size: 10.5, fill: T.muted, anchor: 'middle' }); });
  if (o.refX != null) { S('line', { x1: X(o.refX), x2: X(o.refX), y1: top, y2: top + ph, stroke: T.text2, 'stroke-width': 1.2 }, svg); }
  if (o.refY != null) { S('line', { x1: padL, x2: W - padR, y1: Y(o.refY), y2: Y(o.refY), stroke: T.text2, 'stroke-width': 1.2 }, svg); }
  (o.quads || []).forEach(q => Tx(svg, q.x === 'l' ? padL + 6 : W - padR - 6, q.y === 't' ? top + 10 : top + ph - 10, q.text, { size: 10.5, fill: T.muted, anchor: q.x === 'l' ? 'start' : 'end' }));
  Tx(svg, padL + pw / 2, H - 6, o.xLabel || '', { size: 11, anchor: 'middle', fill: T.text2 }); const yl = Tx(svg, 12, top + ph / 2, o.yLabel || '', { size: 11, anchor: 'middle', fill: T.text2 }); yl.setAttribute('transform', `rotate(-90 12 ${top + ph / 2})`);
  pts.slice().sort((a, b) => (b.size || 0) - (a.size || 0)).forEach(p => { S('circle', { cx: X(p.x), cy: Y(p.y), r: R(p), fill: p.color || T.series[0], 'fill-opacity': 0.82, stroke: T.surface, 'stroke-width': 2 }, svg); });
  const hl = S('circle', { r: 0, fill: 'none', stroke: T.text, 'stroke-width': 2 }, svg), ov = S('rect', { x: padL, y: top, width: pw, height: ph, fill: 'transparent' }, svg); let near = null;
  const find = e => { const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width), py = (e.clientY - r.top) * (H / r.height); let best = null, bd = 1e9; pts.forEach(p => { const d = Math.hypot(X(p.x) - px, Y(p.y) - py); if (d < bd) { bd = d; best = p; } }); return bd < 40 ? best : null; };
  ov.addEventListener('pointermove', e => { near = find(e); if (!near) { hl.setAttribute('r', 0); plTipHide(); return; } hl.setAttribute('cx', X(near.x)); hl.setAttribute('cy', Y(near.y)); hl.setAttribute('r', R(near) + 3); plTip(e, near.label, near.tip || []); });
  ov.addEventListener('pointerleave', () => { hl.setAttribute('r', 0); plTipHide(); }); if (o.onClick) { ov.style.cursor = 'pointer'; ov.addEventListener('click', e => { const p = find(e); if (p) o.onClick(p); }); }
}
/* ---------- heat map ---------- */
function plcHeat(host, o) {
  const T = plT(), rows = o.rows || [], cols = o.cols || []; if (!rows.length || !cols.length) return plEmpty(host);
  const W = Math.max(300, host.clientWidth || 560), lw = Math.min(190, Math.max(80, Math.max.apply(null, rows.map(r => plW(r))) + 10)), top = 34, cw = (W - lw - 4) / cols.length, ch0 = 26, fhh = plFullH(host, 0), ch = fhh > 0 ? Math.min(64, Math.max(ch0, (fhh - top - 4) / rows.length)) : ch0, H = top + rows.length * ch + 4, svg = plSvg(host, W, H);
  const vals = o.vals.flat().filter(v => v != null && v > 0), mx = Math.max.apply(null, vals.concat([1])), mn = Math.min.apply(null, vals.concat([mx]));
  cols.forEach((c, j) => { const t = Tx(svg, lw + cw * j + cw / 2, top - 12, plTrunc(c, cw), { size: 11, anchor: 'middle', fill: T.text2 }); const tl = S('title', {}, t); tl.textContent = c; });
  rows.forEach((r, i) => {
    const t = Tx(svg, lw - 8, top + i * ch + ch / 2, plTrunc(r, lw - 12), { anchor: 'end' }); const tl = S('title', {}, t); tl.textContent = r;
    cols.forEach((c, j) => { const v = o.vals[i][j], x = lw + cw * j + 1, y = top + i * ch + 1, w = cw - 2, h = ch - 2; const g = S('g', { tabindex: 0, 'aria-label': `${r} × ${c}: ${v == null ? 'no data' : (o.fmt || plF)(v)}` }, svg);
      const fill = v == null || v <= 0 ? T.d ? '#273449' : '#f3f2f1' : plSeq((v - 0) / mx), rc = S('rect', { x, y, width: w, height: h, rx: 3, fill }, g);
      if (v != null && v > 0 && w >= 40) Tx(g, x + w / 2, y + h / 2, (o.fmt || plK)(v), { size: 10.5, anchor: 'middle', fill: plInk(fill) });
      plHover(g, e => { rc.setAttribute('stroke', T.text); rc.setAttribute('stroke-width', 1.5); plTip(e, `${r} · ${c}`, [{ k: o.measure || 'Value', v: v == null ? '—' : (o.fmt || plF)(v) }]); }, o.onClick ? () => o.onClick(r, c) : null); g.addEventListener('pointerleave', () => rc.setAttribute('stroke', 'none')); });
  });
}
function plcSpark(vals, color, w, h) {
  w = w || 120; h = h || 28; const T = plT(), v = vals.filter(x => x != null); const svg = S('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h }); if (v.length < 2) return svg;
  const mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), r = mx - mn || 1, X = i => 3 + i / (vals.length - 1) * (w - 10), Y = x => h - 4 - (x - mn) / r * (h - 9); let d = '', pen = false;
  vals.forEach((x, i) => { if (x == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i) + ',' + Y(x); pen = true; }); S('path', { d, fill: 'none', stroke: T.d ? '#64748b' : '#a19f9d', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
  const li = vals.length - 1; if (vals[li] != null) S('circle', { cx: X(li), cy: Y(vals[li]), r: 3.5, fill: color || T.act, stroke: T.surface, 'stroke-width': 1.5 }, svg); return svg;
}
function plSvgToPng(svg, name) {
  try { const T = plT(), clone = svg.cloneNode(true), w = svg.viewBox.baseVal.width || svg.clientWidth, h = svg.viewBox.baseVal.height || svg.clientHeight; clone.setAttribute('xmlns', SVGNS); clone.setAttribute('width', w); clone.setAttribute('height', h);
    const bg = document.createElementNS(SVGNS, 'rect'); bg.setAttribute('width', w); bg.setAttribute('height', h); bg.setAttribute('fill', T.surface); clone.insertBefore(bg, clone.firstChild);
    const img = new Image(), url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => { const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; const cx = cv.getContext('2d'); cx.scale(2, 2); cx.drawImage(img, 0, 0); URL.revokeObjectURL(url); cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name + '.png'; document.body.appendChild(a); a.click(); a.remove(); }); };
    img.src = url; } catch (e) { sectionToast('Could not export the picture: ' + e.message, 'error'); }
}


/* ============================================================
   PLANNING DEPT. — KPIs, band, chart cards
   ============================================================ */
const PL_CTL_KEY = LS_BASE + '_pl_ctl';
const plCtlAll = () => { try { return JSON.parse(localStorage.getItem(PL_CTL_KEY) || '{}'); } catch (e) { return {}; } };
const plCtlGet = (card, id, def) => { const v = (plCtlAll()[card] || {})[id]; return v == null ? def : v; };
const plCtlSet = (card, id, v) => { const a = plCtlAll(); (a[card] = a[card] || {})[id] = v; try { localStorage.setItem(PL_CTL_KEY, JSON.stringify(a)); } catch (e) {} };
const plSameMonth = () => pl.prev && pl.cur && String(pl.prev.asOf).slice(0, 7) === String(pl.cur.asOf).slice(0, 7);
function plTone(v, good) { return v == null || good == null ? 'nu' : Math.abs(v) < 1e-9 ? 'nu' : ((v > 0) === good ? 'up' : 'dn'); }
function plDeltaTxt(cur, prev, fmt, goodUp, pctToo) {
  if (prev == null || cur == null) return { t: 'no earlier day to compare', c: 'nu' }; const d = cur - prev; if (Math.abs(d) < 1e-9) return { t: '▬ no change vs ' + pl.prev.asOf, c: 'nu' };
  return { t: `${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}${pctToo && prev ? ' (' + plP(Math.abs(d / prev), 1) + ')' : ''} vs ${pl.prev.asOf}`, c: plTone(d, goodUp) };
}
function plSeriesFor(fn, n) { // metric across the last n snapshots under the same filters
  const ds = pl.dates.slice(-(n || 14)); return ds.map(d => { const s = pl.map.get(d); try { return fn(plFilter(plObjs(s), null), s); } catch (e) { return null; } });
}
const PL_KPIS = [
  { id: 'soh', label: 'Total stock on hand', unit: 'CT', f: (r) => plSum(r, 'totalSOH'), fmt: plF, goodUp: null, sub: r => `${plF(plSum(r, 'pallets'))} pallets`, prevOk: true },
  { id: 'rel', label: 'Released stock', f: r => plSum(r, 'releasedSOH'), fmt: plF, goodUp: true, sub: r => { const t = plSum(r, 'totalSOH'); return t ? plP(plSum(r, 'releasedSOH') / t, 0) + ' of total' : ''; } },
  { id: 'inc', label: 'In incubation', f: r => plSum(r, 'incubation'), fmt: plF, goodUp: null, sub: r => `${r.filter(o => (o.incubation || 0) > 0).length} SKUs`, click: ['_flags', 'In incubation'] },
  { id: 'hold', label: 'On hold', f: r => plSum(r, 'onHold'), fmt: plF, goodUp: false, sub: r => `${r.filter(o => (o.onHold || 0) > 0).length} SKUs`, click: ['_flags', 'On hold'] },
  { id: 'doc', label: 'Days cover (released)', f: r => plCover(r), fmt: v => plF(v, 1) + ' d', goodUp: null, sub: r => { const c = plCover(r), t = plThr(); return c == null ? '' : c < t.crit ? '✖ critical' : c < t.low ? '◆ low' : c <= t.high ? '✔ healthy' : '⬆ excess'; } },
  { id: 'mtd', label: 'MTD sales', f: r => plSum(r, 'mtdSales'), fmt: plF, goodUp: true, month: true, sub: r => { const f = plSum(r, 'monthlyFcst'); return f ? plP(plSum(r, 'mtdSales') / f, 1) + ' of ' + plK(f) + ' forecast' : ''; } },
  { id: 'pace', label: 'Sales pace vs time', f: r => { const f = plSum(r, 'monthlyFcst'), tg = pl.cur.timeGone; return f > 0 && tg > 0 ? (plSum(r, 'mtdSales') / f) / tg : null; }, fmt: v => v.toFixed(2) + '×', goodUp: true, month: true, sub: () => `time gone ${plP(pl.cur.timeGone, 0)}`, click: null },
  { id: 'proj', label: 'Projected month-end', f: r => { const tg = pl.cur.timeGone, f = plSum(r, 'monthlyFcst'); return tg > 0 && f > 0 ? plSum(r, 'mtdSales') / tg / f : null; }, fmt: v => plP(v, 0) + ' of fcst', goodUp: true, month: true, sub: r => { const tg = pl.cur.timeGone; return tg > 0 ? plK(plSum(r, 'mtdSales') / tg) + ' CT projected' : ''; } },
  { id: 'risk', label: 'SKUs at risk', f: r => r.filter(o => /Out of stock|Critical/.test(o._health) && (o.status || '').toLowerCase() !== 'in active').length, fmt: plF, goodUp: false, sub: r => `${r.filter(o => /^Low/.test(o._health)).length} more with low cover`, click: ['_health', 'risk'] },
  { id: 'exc', label: 'Excess-cover SKUs', f: r => r.filter(o => /^Excess/.test(o._health)).length, fmt: plF, goodUp: false, sub: r => plK(r.filter(o => /^Excess/.test(o._health)).reduce((t, o) => t + (o.releasedSOH || 0), 0)) + ' CT released', click: ['_health', 'excess'] },
  { id: 'exp', label: 'Near-expiry stock', f: r => plSum(r, 'nearExpiry'), fmt: plF, goodUp: false, sub: r => `${r.filter(o => (o.nearExpiry || 0) > 0).length} SKUs`, click: ['_flags', 'Near expiry'] },
  { id: 'cap', label: 'Locations over capacity', f: () => Object.values((pl.cur && pl.cur.cap) || {}).filter(v => v > 1.0001).length, fmt: plF, goodUp: false, sub: () => { const m = Object.entries(pl.cur.cap || {}).filter(([, v]) => v > 1.0001).map(([k]) => k); return m.slice(0, 3).join(', ') || 'none'; }, noFilter: true },
];
function plRenderKpis() {
  const host = PLQ('#plKpis'); if (!host || !pl.cur) return; host.innerHTML = ''; const T = plT(), view = pl.view;
  const prevRows = pl.prev ? plFilter(plObjs(pl.prev), null) : null;
  PL_KPIS.forEach(k => {
    let v = null; try { v = k.f(view); } catch (e) {} const el = document.createElement('div'); el.className = 'pl-kpi' + (k.click ? ' click' : '');
    let d = { t: '', c: 'nu' }; if (k.id !== 'cap' && prevRows && (!k.month || plSameMonth())) { let pv = null; const keep = pl.cur; try { pv = k.f(prevRows); } catch (e) {} d = plDeltaTxt(v, pv, k.id === 'pace' ? (x => x.toFixed(2) + '×') : k.id === 'proj' ? (x => plP(x, 0)) : k.id === 'doc' ? (x => plF(x, 1) + ' d') : plF, k.goodUp, k.id === 'soh' || k.id === 'mtd'); } else if (k.id !== 'cap' && !pl.prev) d = { t: 'first snapshot — no trend yet', c: 'nu' }; else if (k.month && !plSameMonth() && k.id !== 'cap') d = { t: 'new month — resets', c: 'nu' };
    let sub = ''; try { sub = k.sub(view); } catch (e) {}
    el.innerHTML = `<div class="lbl">${plEsc(k.label)}</div><div class="val">${v == null ? '—' : plEsc(k.fmt(v))}</div><div class="sub">${plEsc(sub)}</div><div class="dl ${d.c}">${plEsc(d.t)}</div>`;
    if (pl.dates.length > 1 && k.id !== 'cap') { const ser = plSeriesFor((r, s) => { const keepCur = pl.cur; const tg = s.timeGone; const save = pl.cur; try { pl.cur = s; return k.f(r); } finally { pl.cur = save; } }, 14); el.appendChild(plcSpark(ser, T.act, 120, 26)); }
    if (k.click) el.addEventListener('click', () => plKpiClick(k));
    host.appendChild(el);
  });
}
function plKpiClick(k) {
  const [key, val] = k.click;
  if (key === '_health') { const H = plHealthDefs().map(h => h.k); const pick = val === 'risk' ? [H[0], H[1]] : [H[4]]; plSetDim('_health', pick); plRefresh(); return; }
  if (key === '_flags') { pl.conds = pl.conds.filter(c => !(c.key === '_flags')); pl.conds.push({ id: ++pl.uid, key: '_flags', op: 'contains', text: val }); plRefresh(); }
}
function plRenderBand() {
  if (!pl.cur) return; const v = pl.view, s = pl.cur, filt = pl.conds.length || pl.q.length;
  PLQ('#plBandAsOf').textContent = s.asOf + (filt ? ' · filtered' : ''); PLQ('#plHero').textContent = plF(plSum(v, 'totalSOH'));
  PLQ('#plHeroSub').textContent = `cartons · Released ${plK(plSum(v, 'releasedSOH'))} · Incubation ${plK(plSum(v, 'incubation'))} · On hold ${plK(plSum(v, 'onHold'))}`;
  const tg = s.timeGone || 0, f = plSum(v, 'monthlyFcst'), pm = f ? plSum(v, 'mtdSales') / f : 0;
  PLQ('#plTGtxt').textContent = s.dayNo ? `day ${s.dayNo} of ${s.daysInMonth}` : ''; PLQ('#plTGfill').style.width = Math.min(100, tg * 100) + '%'; PLQ('#plPaceMark').style.left = `calc(${Math.min(100, pm * 100)}% - 1px)`;
  PLQ('#plTGsub').textContent = `Time gone ${plP(tg, 1)} · MTD sales ${plP(pm, 1)} of forecast ${tg > 0 && f ? ' · pace ' + (pm / tg).toFixed(2) + '×' : ''}`;
  const sel = PLQ('#plSnapSel'); if (sel.dataset.sig !== pl.dates.join(',') + '|' + pl.date) { sel.dataset.sig = pl.dates.join(',') + '|' + pl.date; sel.innerHTML = pl.dates.slice().reverse().map(d => `<option value="${d}" ${d === pl.date ? 'selected' : ''}>${d}</option>`).join(''); }
  const i = pl.dates.indexOf(pl.date); PLQ('#plPrevBtn').disabled = i <= 0; PLQ('#plNextBtn').disabled = i >= pl.dates.length - 1;
}

/* ---------- chart card framework ---------- */
const PL_DEFS = [];
const plDimOpts = () => plDims().map(d => [d.key, d.label]);
const plMetOpts = () => plMetrics().map(m => [m.key, m.label]);
function plFold(groups, n, valFn) { groups.sort((a, b) => valFn(b) - valFn(a)); if (groups.length <= n) return groups; const keep = groups.slice(0, n - 1), rest = groups.slice(n - 1); keep.push({ key: `Other (${rest.length})`, rows: rest.flatMap(g => g.rows), other: true }); return keep; }
function plCardBuild(def) {
  const card = document.createElement('div'); card.className = 'pl-card ' + (def.span || 's6'); card.dataset.id = def.id;
  card.innerHTML = `<div class="pl-ch"><h3>${plEsc(def.title)}</h3><span class="ctls"></span><button class="pl-ib" data-a="tbl" title="Table view of the same data">▦ Table</button><button class="pl-ib" data-a="png" title="Download as picture">⬇ PNG</button><button class="pl-ib" data-a="full" title="Full screen">⤢</button><div class="sub">${plEsc(def.sub || '')}</div></div><div class="pl-lgh"></div><div class="pl-body"></div><div class="pl-tbl-wrap" style="display:none"></div>`;
  const ctls = card.querySelector('.ctls');
  (def.ctl || []).forEach(c => { const lab = document.createElement('label'); lab.textContent = c.label + ' '; const sel = document.createElement('select'); sel.dataset.c = c.id; lab.appendChild(sel); ctls.appendChild(lab); sel.addEventListener('change', () => { plCtlSet(def.id, c.id, sel.value); plCardDraw(def, card); }); });
  card.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'tbl') { const on = card.dataset.tbl !== '1'; card.dataset.tbl = on ? '1' : ''; b.classList.toggle('on', on); b.textContent = on ? '▦ Chart' : '▦ Table'; card.querySelector('.pl-body').style.display = on ? 'none' : ''; card.querySelector('.pl-lgh').style.display = on ? 'none' : ''; card.querySelector('.pl-tbl-wrap').style.display = on ? '' : 'none'; }
    else if (a === 'png') { const svg = card.querySelector('.pl-body svg'); if (svg) plSvgToPng(svg, 'planning_' + def.id + '_' + pl.date); else sectionToast('Nothing to export in this card.', 'warn'); }
    else if (a === 'full') { const on = !card.classList.contains('pl-full'); card.classList.toggle('pl-full', on); b.textContent = on ? '✕' : '⤢'; setTimeout(() => plCardDraw(def, card), 30); } });
  return card;
}
function plCardDraw(def, card) {
  if (!pl.cur) return; const body = card.querySelector('.pl-body'), lg = card.querySelector('.pl-lgh'), tw = card.querySelector('.pl-tbl-wrap');
  (def.ctl || []).forEach(c => { const sel = card.querySelector(`select[data-c="${c.id}"]`), opts = c.opts(); const cur = plCtlGet(def.id, c.id, c.def); const valid = opts.some(o => o[0] === cur); sel.innerHTML = opts.map(o => `<option value="${plEsc(o[0])}" ${String(o[0]) === String(valid ? cur : (opts[0] && opts[0][0]))  ? 'selected' : ''}>${plEsc(o[1])}</option>`).join(''); });
  const ctl = {}; (def.ctl || []).forEach(c => { const sel = card.querySelector(`select[data-c="${c.id}"]`); ctl[c.id] = sel.value; });
  let res = null; body.classList.add('busy');
  try { res = def.draw(body, { rows: cfRows(card, pl.view), all: pl.rows, ctl, T: plT(), snap: pl.cur, tg: pl.cur.timeGone || 0, card }) || {}; } catch (e) { body.innerHTML = `<div class="pl-empty">⚠ ${plEsc(e.message)}</div>`; console.error(def.id, e); res = {}; }
  body.classList.remove('busy'); lg.innerHTML = res.legend ? plLegend(res.legend) : '';
  if (res.table) { tw.innerHTML = `<table class="pl-tbl"><thead><tr>${res.table.headers.map((h, i) => `<th class="${i ? 'n' : ''}">${plEsc(h)}</th>`).join('')}</tr></thead><tbody>${res.table.rows.map(r => `<tr>${r.map((v, i) => `<td class="${typeof v === 'number' ? 'n' : ''}">${plEsc(typeof v === 'number' ? plF(v, Math.abs(v) < 10 && v % 1 ? 2 : 0) : (v == null ? '' : v))}</td>`).join('')}</tr>`).join('')}</tbody></table>`; card._table = res.table; }
  else { tw.innerHTML = '<div class="pl-empty">No table for this card.</div>'; card._table = null; }
}
function plRenderCharts() { const grid = PLQ('#plGrid'); if (!grid || !pl.cur) return; PL_DEFS.forEach(def => { let card = grid.querySelector(`[data-id="${def.id}"]`); if (!card) { card = plCardBuild(def); grid.appendChild(card); } plCardDraw(def, card); }); }
function plRedrawAll() { const grid = PLQ('#plGrid'); if (!grid) return; PL_DEFS.forEach(def => { const card = grid.querySelector(`[data-id="${def.id}"]`); if (card) plCardDraw(def, card); }); }

/* ---------- the cards ---------- */
PL_DEFS.push({ id: 'sales', title: 'Sales vs forecast', sub: 'Monthly forecast against MTD sales; the black tick is where sales should be by today', span: 's7',
  ctl: [{ id: 'dim', label: 'by', opts: plDimOpts, def: 'brand' }],
  draw(host, c) {
    const T = c.T, dim = c.ctl.dim || 'brand', g = plFold(plGroup(c.rows, dim), 12, x => plSum(x.rows, 'monthlyFcst'));
    const rows = g.map(x => { const f = plSum(x.rows, 'monthlyFcst'), m = plSum(x.rows, 'mtdSales'); return { label: x.key, key: x.key, other: x.other, vals: [f, m], mark: f * c.tg, pct: f ? m / f : null, tip: [{ c: T.fc, k: 'Forecast (month)', v: plF(f) }, { c: T.act, k: 'MTD sales', v: plF(m) }, { k: '% of forecast', v: f ? plP(m / f, 1) : '—' }, { k: 'Expected by today', v: plF(f * c.tg) }, { k: 'Pace', v: f && c.tg ? (m / f / c.tg).toFixed(2) + '×' : '—' }] }; });
    plcBarsH(host, { rows, series: [{ name: 'Forecast', color: T.fc }, { name: 'MTD sales', color: T.act }], labelFn: (r, v) => `${plK(v)}${r.pct != null ? ' · ' + plP(r.pct, 0) : ''}`, padR: 96, onClick: r => { if (!r.other) plPick(dim, r.key); }, thick: 14 });
    return { legend: [{ c: T.fc, name: 'Monthly forecast' }, { c: T.act, name: 'MTD sales' }, { c: T.text, name: 'Expected by today', kind: 'tk' }], table: { headers: [plLabel(dim), 'Forecast', 'MTD sales', '% of forecast', 'Expected by today', 'Pace ×'], rows: rows.map(r => [r.label, r.vals[0], r.vals[1], r.pct == null ? '' : plP(r.pct, 1), r.mark, r.pct != null && c.tg ? +(r.pct / c.tg).toFixed(2) : '']) } };
  } });
PL_DEFS.push({ id: 'health', title: 'Stock health — days of cover', sub: '', span: 's5',
  ctl: [{ id: 'by', label: 'count', opts: () => [['sku', 'SKUs'], ['vol', 'Released cartons']], def: 'sku' }],
  draw(host, c) {
    const H = plHealthDefs(), t = plThr(); c.card.querySelector('.sub').textContent = `Released stock ÷ daily forecast: critical <${t.crit} d · low <${t.low} d · healthy ≤${t.high} d (change in ⚙ Thresholds)`;
    const sl = H.map(h => { const rs = c.rows.filter(o => o._health === h.k); return { label: h.k, glyph: h.g, color: h.c, value: c.ctl.by === 'vol' ? plSum(rs, 'releasedSOH') : rs.length, n: rs.length }; });
    plcDonut(host, { slices: sl, center: { value: plF(sl.reduce((a, s) => a + s.value, 0)), label: c.ctl.by === 'vol' ? 'cartons' : 'SKUs' }, unit: c.ctl.by === 'vol' ? 'Released cartons' : 'SKUs', onClick: s => plPick('_health', s.label) });
    return { table: { headers: ['Health', 'SKUs', 'Released cartons', 'Total stock'], rows: H.map(h => { const rs = c.rows.filter(o => o._health === h.k); return [h.g + ' ' + h.k, rs.length, plSum(rs, 'releasedSOH'), plSum(rs, 'totalSOH')]; }) } };
  } });
PL_DEFS.push({ id: 'stock', title: 'Stock position', sub: 'Released, incubation and on-hold stock', span: 's7',
  ctl: [{ id: 'dim', label: 'by', opts: plDimOpts, def: 'subBrand' }, { id: 'unit', label: 'in', opts: () => [['ct', 'Cartons'], ['pal', 'Pallets']], def: 'ct' }],
  draw(host, c) {
    const T = c.T, dim = c.ctl.dim || 'subBrand', pal = c.ctl.unit === 'pal', v = (o, k) => (o[k] || 0) / (pal ? (o.ctPallet || 1) : 1), sm = (rs, k) => rs.reduce((t, o) => t + v(o, k), 0);
    const g = plFold(plGroup(c.rows, dim), 12, x => sm(x.rows, 'releasedSOH') + sm(x.rows, 'incubation') + sm(x.rows, 'onHold'));
    const rows = g.map(x => ({ label: x.key, key: x.key, other: x.other, vals: [sm(x.rows, 'releasedSOH'), sm(x.rows, 'incubation'), sm(x.rows, 'onHold')] }));
    const sr = [{ name: 'Released', color: T.series[0] }, { name: 'Incubation', color: T.series[1] }, { name: 'On hold', color: T.series[2] }];
    plcBarsH(host, { rows, series: sr, stacked: true, fmt: x => plF(x, pal ? 1 : 0), onClick: r => { if (!r.other) plPick(dim, r.key); }, thick: 16 });
    return { legend: sr.map(s => ({ c: s.color, name: s.name })), table: { headers: [plLabel(dim), 'Released', 'Incubation', 'On hold', 'Total'], rows: rows.map(r => [r.label].concat(r.vals, [r.vals.reduce((a, b) => a + b, 0)]).map(x => typeof x === 'number' ? +x.toFixed(1) : x)) } };
  } });
PL_DEFS.push({ id: 'top', title: 'Top SKUs', sub: 'Rank SKUs by any numeric column', span: 's5',
  ctl: [{ id: 'm', label: 'metric', opts: plMetOpts, def: 'totalSOH' }, { id: 'ord', label: '', opts: () => [['top', 'Highest'], ['bot', 'Lowest']], def: 'top' }, { id: 'n', label: 'show', opts: () => [['10', '10'], ['15', '15'], ['25', '25']], def: '15' }],
  draw(host, c) {
    const T = c.T, m = c.ctl.m || 'totalSOH', col = PL_COL()[m], f = plFmtBy(col && col.type), n = +c.ctl.n || 15;
    let rs = c.rows.filter(o => typeof o[m] === 'number'); rs.sort((a, b) => c.ctl.ord === 'bot' ? a[m] - b[m] : b[m] - a[m]); rs = rs.slice(0, n);
    const rows = rs.map(o => ({ label: `${o.code} · ${o.item}`, vals: [o[m]], code: o.code, tip: [{ k: 'Item', v: o.item }, { c: T.act, k: col ? col.label : m, v: f(o[m]) }, { k: 'Health', v: o._health }, { k: 'Brand', v: o.brand }] }));
    plcBarsH(host, { rows, series: [{ name: col ? col.label : m, color: T.act }], fmt: f, tickFmt: col && col.type === 'pct' ? (x => plP(x, 0)) : plK, thick: 14, labelW: 190, onClick: r => plRowOpen(r.code) });
    return { table: { headers: ['Code', 'Item', col ? col.label : m], rows: rs.map(o => [o.code, o.item, o[m]]) } };
  } });
PL_DEFS.push({ id: 'channels', title: 'Channel performance', sub: 'Forecast vs actual sales by channel (all channels shown)', span: 's6',
  draw(host, c) {
    const T = c.T, chs = (c.snap.channels || []), cats = chs.map(ch => { const f = plSum(c.rows, `ch_${ch.key}_fc`), a = plSum(c.rows, `ch_${ch.key}_act`); return { label: ch.label, vals: [f, a], mark: f * c.tg, pct: f ? a / f : null, tip: [{ c: T.fc, k: 'Forecast', v: plF(f) }, { c: T.act, k: 'Actual', v: plF(a) }, { k: '% of forecast', v: f ? plP(a / f, 1) : '—' }, { k: 'Expected by today', v: plF(f * c.tg) }] }; });
    if (!cats.length) return plEmpty(host, 'No channel columns in this snapshot.');
    plcCols(host, { cats, series: [{ name: 'Forecast', color: T.fc }, { name: 'Actual', color: T.act }], labelFn: (c2, v) => c2.pct != null ? plP(c2.pct, 0) : '', height: 270 });
    return { legend: [{ c: T.fc, name: 'Forecast' }, { c: T.act, name: 'Actual' }, { c: T.text, name: 'Expected by today', kind: 'tk' }], table: { headers: ['Channel', 'Forecast', 'Actual', '% of forecast', 'Expected by today'], rows: cats.map(x => [x.label, x.vals[0], x.vals[1], x.pct == null ? '' : plP(x.pct, 1), x.mark]) } };
  } });
function plLocs() { return (pl.cur.locations || []); }
PL_DEFS.push({ id: 'loc', title: 'Stock by location', sub: 'Cartons held at each location', span: 's6',
  draw(host, c) {
    const T = c.T, rows = plLocs().map(l => { const s = plSum(c.rows, `loc_${l.key}_stock`); return { label: l.label, vals: [s], tip: [{ c: T.act, k: 'Stock', v: plF(s) }, { k: 'SKUs stocked', v: String(c.rows.filter(o => (o[`loc_${l.key}_stock`] || 0) > 0).length) }] }; }).sort((a, b) => b.vals[0] - a.vals[0]);
    const kz = ['wh_kizad', 'wh_cx4', 'wh_main'].map(k => ({ k, c: PL_COL()[k] })).filter(x => x.c);
    plcBarsH(host, { rows, series: [{ name: 'Stock', color: T.act }], thick: 16 });
    return { table: { headers: ['Location', 'Stock (CT)'].concat(), rows: rows.map(r => [r.label, r.vals[0]]).concat(kz.map(x => [x.c.label, plSum(c.rows, x.k)])) } };
  } });
PL_DEFS.push({ id: 'locdoc', title: 'Days of cover by location', sub: 'Stock ÷ daily demand at that location — YTD average vs current sales trend', span: 's6',
  draw(host, c) {
    const T = c.T, cats = plLocs().map(l => { const f = suf => { let st = 0, dm = 0; c.rows.forEach(o => { const s = o[`loc_${l.key}_stock`], d = o[`loc_${l.key}_${suf}`]; if (s > 0 && d > 0) { st += s; dm += s / d; } }); return dm ? st / dm : null; }; const y = f('docYtd'), t = f('docTrend'); return { label: l.label, vals: [y || 0, t || 0], tip: [{ c: T.fc, k: 'Cover — YTD average', v: y == null ? '—' : plF(y, 1) + ' d' }, { c: T.act, k: 'Cover — current trend', v: t == null ? '—' : plF(t, 1) + ' d' }] }; });
    plcCols(host, { cats, series: [{ name: 'YTD average sales', color: T.fc }, { name: 'Current trend', color: T.act }], fmt: x => plF(x, 1) + ' d', labelFn: (c2, v) => v ? plF(v, 0) : '', height: 270 });
    return { legend: [{ c: T.fc, name: 'Days cover — YTD average' }, { c: T.act, name: 'Days cover — current trend' }], table: { headers: ['Location', 'Cover YTD (d)', 'Cover trend (d)'], rows: cats.map(x => [x.label, +x.vals[0].toFixed(1), +x.vals[1].toFixed(1)]) } };
  } });
PL_DEFS.push({ id: 'cap', title: 'Warehouse capacity used', sub: 'Utilisation reported in the sheet (not affected by filters)', span: 's6',
  draw(host, c) {
    const T = c.T, cap = c.snap.cap || {}, ent = Object.entries(cap).filter(([, v]) => v != null && v > 0); if (!ent.length) return plEmpty(host, 'No capacity figures in this snapshot.');
    const st = v => v > 1.0001 ? { c: T.crit, g: '✖ over capacity' } : v >= 0.85 ? { c: T.warn, g: '▲ near full' } : { c: T.good, g: '✔ ok' };
    const rows = ent.sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, vals: [v], colors: [st(v).c], status: st(v).g, tip: [{ c: st(v).c, k: 'Utilisation', v: plP(v, 1) }, { k: 'Status', v: st(v).g }] }));
    plcBarsH(host, { rows, series: [{ name: 'Utilisation', color: T.act }], fmt: v => plP(v, 0), tickFmt: v => plP(v, 0), labelFn: (r, v) => `${plP(v, 0)} ${st(v).g.split(' ')[0]}`, ref: 1, refLabel: '100%', minMax: 1.2, thick: 16, padR: 84 });
    return { legend: [{ c: T.good, name: '✔ below 85%' }, { c: T.warn, name: '▲ 85–100%' }, { c: T.crit, name: '✖ over 100%' }], table: { headers: ['Warehouse / location', 'Utilisation', 'Status'], rows: rows.map(r => [r.label, plP(r.vals[0], 1), r.status]) } };
  } });
PL_DEFS.push({ id: 'scatter', title: 'Cover vs sales pace', sub: 'Each bubble is a SKU · size = stock on hand · above the line = selling faster than the calendar', span: 's8',
  draw(host, c) {
    const T = c.T, rs = c.rows.filter(o => (o.monthlyFcst || 0) > 0 && o._paceIdx != null), brands = plGroup(rs, 'brand').sort((a, b) => plSum(b.rows, 'totalSOH') - plSum(a.rows, 'totalSOH')), keep = new Set(brands.slice(0, 3).map(g => g.key)), other = T.d ? '#64748b' : '#a19f9d';
    const pts = rs.map(o => ({ x: Math.min(o.docReleased || 0, 90), y: Math.min(o._paceIdx, 2.5), size: o.totalSOH || 0, color: keep.has(String(o.brand)) ? plEntityColor('brand', o.brand) : other, label: `${o.code} · ${o.item}`, code: o.code, tip: [{ k: 'Brand', v: o.brand }, { k: 'Days cover', v: plF(o.docReleased, 1) + ' d' }, { k: 'Sales pace', v: o._paceIdx.toFixed(2) + '×' }, { k: 'Stock', v: plF(o.totalSOH) }, { k: 'Health', v: o._health }] }));
    const ys = pts.map(p => p.y).sort((a, b) => a - b), ymax = Math.min(2.5, Math.max(1.5, (ys[Math.floor(ys.length * 0.95)] || 1) * 1.25));
    plcScatter(host, { pts, xLabel: 'Days of cover (released stock)', yLabel: 'Sales pace (1× = on calendar)', xmax: 90, ymax, xFmt: v => plF(v, 0), yFmt: v => v.toFixed(1) + '×', refX: plThr().low, refY: 1, onClick: p => plRowOpen(p.code), quads: [{ x: 'l', y: 't', text: 'low cover · fast sales → replenish' }, { x: 'r', y: 'b', text: 'high cover · slow sales → excess' }] });
    return { legend: brands.slice(0, 3).map(g => ({ c: plEntityColor('brand', g.key), name: g.key })).concat(brands.length > 3 ? [{ c: other, name: 'Other brands' }] : []), table: { headers: ['Code', 'Item', 'Days cover', 'Pace ×', 'Stock'], rows: rs.map(o => [o.code, o.item, +(o.docReleased || 0).toFixed(1), +o._paceIdx.toFixed(2), o.totalSOH || 0]) } };
  } });
PL_DEFS.push({ id: 'abc', title: 'Stock concentration (ABC)', sub: '', span: 's4',
  ctl: [{ id: 'm', label: 'of', opts: plMetOpts, def: 'totalSOH' }],
  draw(host, c) {
    const T = c.T, m = c.ctl.m || 'totalSOH', rs = c.rows.filter(o => typeof o[m] === 'number' && o[m] > 0).sort((a, b) => b[m] - a[m]), tot = rs.reduce((t, o) => t + o[m], 0); if (!tot) return plEmpty(host);
    let acc = 0; const cum = rs.map(o => { acc += o[m]; return acc / tot; }), a = cum.findIndex(v => v >= 0.8) + 1, b = cum.findIndex(v => v >= 0.95) + 1;
    c.card.querySelector('.sub').textContent = `${a} of ${rs.length} SKUs make 80% of ${plLabel(m).toLowerCase()} (A); ${b - a} more reach 95% (B); ${rs.length - b} are the tail (C).`;
    plcLine(host, { x: rs.map((o, i) => String(i + 1)), series: [{ name: 'Cumulative share', color: T.act, vals: cum }], fmt: v => plP(v, 0), tickFmt: v => plP(v, 0), ref: 0.8, refLabel: '80%', zero: true, height: 230, area: true });
    return { table: { headers: ['Rank', 'Code', 'Item', plLabel(m), 'Cumulative %'], rows: rs.map((o, i) => [i + 1, o.code, o.item, o[m], plP(cum[i], 1)]) } };
  } });
PL_DEFS.push({ id: 'heat', title: 'Location heat map', sub: 'Darker = more', span: 's6',
  ctl: [{ id: 'dim', label: 'rows', opts: plDimOpts, def: 'subBrand' }, { id: 'ms', label: 'show', opts: () => [['stock', 'Stock (cartons)'], ['docYtd', 'Days cover (YTD avg)'], ['docTrend', 'Days cover (current trend)']], def: 'stock' }],
  draw(host, c) {
    const dim = c.ctl.dim || 'subBrand', ms = c.ctl.ms || 'stock', locs = plLocs(), g = plFold(plGroup(c.rows, dim), 14, x => plSum(x.rows, 'totalSOH'));
    const cell = (rs, l) => { if (ms === 'stock') return rs.reduce((t, o) => t + (o[`loc_${l.key}_stock`] || 0), 0); let st = 0, dm = 0; rs.forEach(o => { const s = o[`loc_${l.key}_stock`], d = o[`loc_${l.key}_${ms}`]; if (s > 0 && d > 0) { st += s; dm += s / d; } }); return dm ? st / dm : null; };
    const vals = g.map(x => locs.map(l => cell(x.rows, l))), fmt = ms === 'stock' ? plK : (v => plF(v, 0));
    plcHeat(host, { rows: g.map(x => x.key), cols: locs.map(l => l.label), vals, fmt, measure: ms === 'stock' ? 'Stock (CT)' : 'Days cover', onClick: (r, col) => { const gg = g.find(x => x.key === r); if (gg && !gg.other) plPick(dim, r); } });
    return { table: { headers: [plLabel(dim)].concat(locs.map(l => l.label)), rows: g.map((x, i) => [x.key].concat(vals[i].map(v => v == null ? '' : +v.toFixed(1)))) } };
  } });
PL_DEFS.push({ id: 'trend', title: 'Trend across snapshots', sub: '', span: 's6',
  ctl: [{ id: 'm', label: 'metric', opts: () => [['soh', 'Total stock on hand'], ['rel', 'Released stock'], ['inc', 'Incubation stock'], ['hold', 'On hold'], ['doc', 'Days cover (released)'], ['mtd', 'MTD sales'], ['pace', 'Sales pace ×']], def: 'soh' }],
  draw(host, c) {
    const k = PL_KPIS.find(x => x.id === c.ctl.m) || PL_KPIS[0], ds = pl.dates.slice(-30); c.card.querySelector('.sub').textContent = `${k.label} on each uploaded day (same filters)`;
    if (ds.length < 2) return plEmpty(host, 'Upload the file on more than one day to see the trend — each upload is kept as its own snapshot.');
    const vals = plSeriesFor((r, s) => { const save = pl.cur; pl.cur = s; try { return k.f(r); } finally { pl.cur = save; } }, 30);
    plcLine(host, { x: ds.map(d => d.slice(5)), series: [{ name: k.label, color: c.T.act, vals }], fmt: v => k.id === 'pace' ? v.toFixed(2) + '×' : plF(v, k.id === 'doc' ? 1 : 0), height: 230, area: true, zero: k.id === 'soh' || k.id === 'rel' || k.id === 'mtd' });
    return { table: { headers: ['As-of date', k.label], rows: ds.map((d, i) => [d, vals[i] == null ? '' : +vals[i].toFixed(2)]) } };
  } });
function plcDiv(host, o) { // diverging bars around zero
  const T = plT(), rows = o.rows; if (!rows.length) return plEmpty(host, o.empty); const W = Math.max(300, host.clientWidth || 560), lw = Math.min(190, Math.max(80, Math.max.apply(null, rows.map(r => plW(r.label))) + 10)), rowH0 = 24, top = 4, ax = 22, fhd = plFullH(host, 0), rowH = fhd > 0 ? Math.min(64, Math.max(rowH0, (fhd - top - ax) / rows.length)) : rowH0, h = top + rows.length * rowH + ax, svg = plSvg(host, W, h);
  const mx = Math.max.apply(null, rows.map(r => Math.abs(r.v))) || 1, pad = 60, cx = lw + (W - lw - 8) / 2, half = (W - lw - 8) / 2 - pad, X = v => cx + v / mx * half;
  S('line', { x1: cx, x2: cx, y1: top, y2: h - ax, stroke: T.muted }, svg);
  [-mx, -mx / 2, mx / 2, mx].forEach(t => Tx(svg, X(t), h - 8, plK(t), { size: 10.5, fill: T.muted, anchor: 'middle' }));
  rows.forEach((r, i) => { const y = top + i * rowH, cy = y + rowH / 2, g = S('g', { tabindex: 0 }, svg); S('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent' }, g); const t = Tx(g, lw - 8, cy, plTrunc(r.label, lw - 12), { anchor: 'end' }); const tl = S('title', {}, t); tl.textContent = r.label;
    const w = Math.abs(X(r.v) - cx); if (w > 0) S('path', { d: r.v >= 0 ? plBarPath(cx, cy - 7, w, 14, 4, 'right') : plBarPath(X(r.v), cy - 7, w, 14, 4, 'left'), fill: r.v >= 0 ? T.pos : T.neg }, g);
    Tx(g, r.v >= 0 ? X(r.v) + 6 : X(r.v) - 6, cy, (r.v > 0 ? '+' : '') + plF(r.v, Math.abs(r.v) < 10 && r.v % 1 ? 1 : 0), { size: 11, weight: 600, fill: T.text, anchor: r.v >= 0 ? 'start' : 'end' });
    plHover(g, e => plTip(e, r.label, r.tip), r.click); });
}
PL_DEFS.push({ id: 'movers', title: 'Biggest changes since the previous day', sub: '', span: 's6',
  ctl: [{ id: 'm', label: 'metric', opts: () => [['totalSOH', 'Total stock'], ['releasedSOH', 'Released stock'], ['incubation', 'Incubation'], ['onHold', 'On hold'], ['docReleased', 'Days cover'], ['mtdSales', 'MTD sales']], def: 'totalSOH' }],
  draw(host, c) {
    const m = c.ctl.m || 'totalSOH'; if (!pl.prev) { c.card.querySelector('.sub').textContent = ''; return plEmpty(host, 'Needs an earlier snapshot to compare with.'); }
    if (m === 'mtdSales' && !plSameMonth()) return plEmpty(host, 'MTD sales restart each month — pick another metric.');
    c.card.querySelector('.sub').textContent = `${pl.cur.asOf} vs ${pl.prev.asOf} (matched by SKU code)`;
    const pm = new Map(plObjs(pl.prev).map(o => [o.code, o])), d = c.rows.map(o => { const p = pm.get(o.code); return p ? { o, v: (o[m] || 0) - (p[m] || 0), prev: p[m] || 0 } : null; }).filter(x => x && Math.abs(x.v) > 1e-9);
    const up = d.filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 7), dn = d.filter(x => x.v < 0).sort((a, b) => a.v - b.v).slice(0, 7), rows = up.concat(dn.reverse().reverse());
    const all = up.concat(dn).sort((a, b) => b.v - a.v);
    plcDiv(host, { rows: all.map(x => ({ label: `${x.o.code} · ${x.o.item}`, v: x.v, tip: [{ k: 'Now', v: plF(x.o[m], 1) }, { k: 'Previous', v: plF(x.prev, 1) }, { k: 'Change', v: plF(x.v, 1) }], click: () => plRowOpen(x.o.code) })), empty: 'No change between the two days.' });
    return { legend: [{ c: c.T.pos, name: 'Increase' }, { c: c.T.neg, name: 'Decrease' }], table: { headers: ['Code', 'Item', 'Previous', 'Now', 'Change'], rows: d.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).map(x => [x.o.code, x.o.item, +x.prev.toFixed(1), +(x.o[m] || 0).toFixed(1), +x.v.toFixed(1)]) } };
  } });
PL_DEFS.push({ id: 'incub', title: 'Incubation pipeline', sub: 'SKUs held in incubation, with production and expected release dates', span: 's6',
  draw(host, c) {
    const rs = c.rows.filter(o => (o.incubation || 0) > 0).sort((a, b) => b.incubation - a.incubation); if (!rs.length) return plEmpty(host, 'Nothing in incubation for the current filters.');
    const tot = plSum(rs, 'incubation'); c.card.querySelector('.sub').textContent = `${rs.length} SKUs · ${plF(tot)} cartons in incubation`;
    host.innerHTML = `<div class="pl-tbl-wrap" style="max-height:300px;"><table class="pl-tbl"><thead><tr><th>SKU</th><th class="n">Incubation</th><th>Produced</th><th>Release</th><th class="n">Cover d</th></tr></thead><tbody>${rs.slice(0, 40).map(o => `<tr data-code="${plEsc(o.code)}" style="cursor:pointer"><td title="${plEsc(o.item)}">${plEsc(o.code)} <span style="color:var(--gray-500)">${plEsc(plTrunc(o.item, 150))}</span></td><td class="n"><b>${plF(o.incubation)}</b></td><td>${plEsc(o.prodDates || '')}</td><td>${plEsc(o.relDates || '')}</td><td class="n">${o.docIncub != null ? plF(o.docIncub, 1) : ''}</td></tr>`).join('')}</tbody></table></div>`;
    host.querySelectorAll('tr[data-code]').forEach(tr => tr.addEventListener('click', () => plRowOpen(tr.dataset.code)));
    return { table: { headers: ['Code', 'Item', 'Incubation', 'Produced', 'Release', 'Cover (d)'], rows: rs.map(o => [o.code, o.item, o.incubation, o.prodDates || '', o.relDates || '', o.docIncub == null ? '' : +o.docIncub.toFixed(1)]) } };
  } });
PL_DEFS.push({ id: 'analysis', title: 'Custom analysis — any column', sub: 'Choose what to group by and what to measure', span: 's12',
  ctl: [{ id: 'x', label: 'group by', opts: plDimOpts, def: 'brand' }, { id: 'y', label: 'measure', opts: plMetOpts, def: 'totalSOH' }, { id: 'agg', label: 'as', opts: () => [['sum', 'Sum'], ['avg', 'Average'], ['min', 'Min'], ['max', 'Max'], ['count', 'Count of SKUs']], def: 'sum' }, { id: 'ch', label: 'chart', opts: () => [['bars', 'Bars'], ['cols', 'Columns'], ['donut', 'Donut'], ['line', 'Line']], def: 'bars' }, { id: 'n', label: 'top', opts: () => [['8', '8'], ['12', '12'], ['20', '20'], ['40', '40']], def: '12' }],
  draw(host, c) {
    const T = c.T, x = c.ctl.x, y = c.ctl.y, agg = c.ctl.agg, n = +c.ctl.n || 12, col = PL_COL()[y], f = agg === 'count' ? plF : plFmtBy(col && col.type), val = rs => plAgg(rs, y, agg);
    const g = plFold(plGroup(c.rows, x), n, z => Math.abs(val(z.rows))), items = g.map(z => ({ label: z.key, v: val(z.rows), n: z.rows.length, other: z.other, key: z.key, rows: z.rows }));
    const name = `${agg === 'count' ? 'Count' : { sum: 'Sum', avg: 'Average', min: 'Min', max: 'Max' }[agg]} of ${agg === 'count' ? plLabel(y) : plLabel(y)}`;
    c.card.querySelector('.sub').textContent = `${name} by ${plLabel(x)} · ${c.rows.length} SKUs`;
    const ch = c.ctl.ch;
    if (ch === 'bars') plcBarsH(host, { rows: items.map(i => ({ label: i.label, vals: [i.v], other: i.other, key: i.key, tip: [{ c: T.act, k: name, v: f(i.v) }, { k: 'SKUs', v: String(i.n) }] })), series: [{ name, color: T.act }], fmt: f, tickFmt: col && col.type === 'pct' ? (v => plP(v, 0)) : plK, onClick: r => { if (!r.other) plPick(x, r.key); } });
    else if (ch === 'cols') plcCols(host, { cats: items.map(i => ({ label: i.label, vals: [i.v], other: i.other, key: i.key, tip: [{ c: T.act, k: name, v: f(i.v) }, { k: 'SKUs', v: String(i.n) }] })), series: [{ name, color: T.act }], fmt: f, tickFmt: col && col.type === 'pct' ? (v => plP(v, 0)) : plK, labelFn: (c2, v) => plK(v), onClick: r => { if (!r.other) plPick(x, r.key); } });
    else if (ch === 'donut') { const top = items.slice(0, 6), rest = items.slice(6); const sl = top.map((i, k) => ({ label: i.label, value: Math.max(0, i.v), color: T.series[k], key: i.key, other: i.other })); if (rest.length) sl.push({ label: `Other (${rest.length})`, value: rest.reduce((t, i) => t + Math.max(0, i.v), 0), color: T.d ? '#64748b' : '#a19f9d', other: true }); plcDonut(host, { slices: sl, center: { value: f(sl.reduce((t, s) => t + s.value, 0)), label: name.length > 24 ? 'total' : name }, unit: name, onClick: s => { if (!s.other) plPick(x, s.key); } }); }
    else plcLine(host, { x: items.map(i => i.label), series: [{ name, color: T.act, vals: items.map(i => i.v) }], fmt: f, height: 240, zero: true });
    return { table: { headers: [plLabel(x), name, 'SKUs'], rows: items.map(i => [i.label, +Number(i.v).toFixed(3), i.n]) } };
  } });
PL_DEFS.push({ id: 'profile', title: 'Column profile', sub: 'Every column at a glance — click a row to analyse it above', span: 's12',
  draw(host, c) {
    const cols = plAllCols(c.snap), rows = c.rows, n = rows.length;
    const data = cols.map(col => { const vs = rows.map(o => o[col.key]).filter(v => v != null && v !== ''), num = vs.filter(v => typeof v === 'number'), isNum = col.type !== 'text'; const dist = new Set(vs).size;
      return { col, filled: vs.length, dist, min: isNum && num.length ? Math.min.apply(null, num) : null, max: isNum && num.length ? Math.max.apply(null, num) : null, mean: isNum && num.length ? num.reduce((a, b) => a + b, 0) / num.length : null, sum: isNum && col.type === 'num' && num.length ? num.reduce((a, b) => a + b, 0) : null, top: !isNum && vs.length ? (() => { const m = {}; vs.forEach(v => { m[v] = (m[v] || 0) + 1; }); const e = Object.entries(m).sort((a, b) => b[1] - a[1])[0]; return e ? `${e[0]} (${e[1]})` : ''; })() : '' }; });
    const f = (d, v) => v == null ? '' : plFmtBy(d.col.type)(v);
    host.innerHTML = `<div class="pl-tbl-wrap" style="max-height:380px;"><table class="pl-tbl"><thead><tr><th>Column</th><th>Section</th><th>Type</th><th class="n">Filled</th><th class="n">Distinct</th><th class="n">Min</th><th class="n">Max</th><th class="n">Average</th><th class="n">Sum</th><th>Most common</th></tr></thead><tbody>${data.map(d => `<tr data-k="${plEsc(d.col.key)}" style="cursor:pointer"><td><b>${plEsc(d.col.label)}</b></td><td>${plEsc(d.col.section)}</td><td>${d.col.type === 'text' ? 'text' : d.col.type}</td><td class="n">${d.filled}/${n}</td><td class="n">${d.dist}</td><td class="n">${f(d, d.min)}</td><td class="n">${f(d, d.max)}</td><td class="n">${f(d, d.mean)}</td><td class="n">${f(d, d.sum)}</td><td>${plEsc(d.top)}</td></tr>`).join('')}</tbody></table></div>`;
    host.querySelectorAll('tr[data-k]').forEach(tr => tr.addEventListener('click', () => { const k = tr.dataset.k, col = PL_COL()[k]; if (!col) return; if (col.type === 'text') { if (!plDims().some(d => d.key === k)) { sectionToast('Too many different values to group by — use a filter instead.', 'warn'); return; } plCtlSet('analysis', 'x', k); } else plCtlSet('analysis', 'y', k); const grid = PLQ('#plGrid'), ac = grid.querySelector('[data-id="analysis"]'), def = PL_DEFS.find(z => z.id === 'analysis'); plCardDraw(def, ac); ac.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
    return { table: { headers: ['Column', 'Section', 'Type', 'Filled', 'Distinct', 'Min', 'Max', 'Average', 'Sum'], rows: data.map(d => [d.col.label, d.col.section, d.col.type, d.filled, d.dist, d.min == null ? '' : +d.min.toFixed(2), d.max == null ? '' : +d.max.toFixed(2), d.mean == null ? '' : +d.mean.toFixed(2), d.sum == null ? '' : +d.sum.toFixed(2)]) } };
  } });


