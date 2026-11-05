/* ===== generated from the Planning filter/chart framework ===== */
function dpMatchCond(o, c) {
  const v = o[c.key];
  if (c.op === 'in') return c.vals.length === 0 || c.vals.some(x => String(v == null ? '(blank)' : v) === x);
  if (c.op === 'range') { const n = typeof v === 'number' ? v : null; if (n == null) return false; if (c.min != null && n < c.min) return false; if (c.max != null && n > c.max) return false; return true; }
  if (c.op === 'contains') return String(v == null ? '' : v).toLowerCase().includes(String(c.text || '').toLowerCase());
  if (c.op === 'empty') return v == null || v === '' || v === 0;
  if (c.op === 'notempty') return !(v == null || v === '' || v === 0);
  return true;
}
function dpMatchQ(o, q) {
  if (!q.length) return true; const t = (o.code + ' ' + o.item + ' ' + (o.brand || '') + ' ' + (o.subBrand || '') + ' ' + (o.size || '') + ' ' + (o.type || '') + ' ' + (o._health || '') + ' ' + (o._flags || '')).toLowerCase();
  return q.some(x => t.includes(String(x).toLowerCase()));
}
function dpFilter(rows, skipKey, conds, q) { conds = conds || dp.conds; q = q || dp.q; return rows.filter(o => dpMatchQ(o, q) && conds.every(c => c.key === skipKey || dpMatchCond(o, c))); }
function dpSetDim(key, vals) { dp.conds = dp.conds.filter(c => !(c.key === key && c.op === 'in')); if (vals.length) dp.conds.push({ id: ++dp.uid, key, op: 'in', vals: vals.slice() }); }
function dpPick(key, val) { const c = dp.conds.find(x => x.key === key && x.op === 'in'); if (c && c.vals.length === 1 && c.vals[0] === val) dpSetDim(key, []); else dpSetDim(key, [val]); dpRefresh(); }
function dpLabel(key) { const c = DP_COL()[key]; return c ? c.label : key; }
const dpIsNum = key => { const c = DP_COL()[key]; return c && (c.type === 'num' || c.type === 'pct' || c.type === 'days'); };
function dpDims() { // categorical columns usable for grouping
  const out = []; if (!dp.cur) return out;
  dpAllCols(dp.cur).forEach(c => { if (c.type !== 'text' || DP_SKIPDIM.has(c.key)) return; const s = new Set(dp.rows.map(o => o[c.key])); if (s.size >= 1 && s.size <= 60) out.push({ key: c.key, label: c.label }); });
  return out;
}
function dpMetrics() { return dp.cur ? dpAllCols(dp.cur).filter(c => c.type === 'num' || c.type === 'pct' || c.type === 'days').map(c => ({ key: c.key, label: c.label, type: c.type, section: c.section })) : []; }
function dpFmtBy(type) { return type === 'pct' ? (v => plP(v)) : type === 'days' ? (v => plF(v, 1)) : (v => plF(v, Math.abs(v) < 100 && v % 1 ? 1 : 0)); }
function dpAgg(rows, key, agg) {
  const vals = rows.map(o => o[key]).filter(v => typeof v === 'number'); if (agg === 'count') return rows.filter(o => o[key] != null && o[key] !== '').length;
  if (!vals.length) return 0; if (agg === 'sum') return vals.reduce((a, b) => a + b, 0); if (agg === 'avg') return vals.reduce((a, b) => a + b, 0) / vals.length; if (agg === 'min') return Math.min.apply(null, vals); if (agg === 'max') return Math.max.apply(null, vals); return vals.reduce((a, b) => a + b, 0);
}
function dpSum(rows, k) { let t = 0; for (const o of rows) { const v = o[k]; if (typeof v === 'number') t += v; } return t; }
function dpCover(rows) { const f = dpSum(rows, 'monthlyFcst'); return f > 0 ? dpSum(rows, 'releasedSOH') / (f / 30) : null; }
function dpGroup(rows, key, topN) {
  const m = new Map(); rows.forEach(o => { const k = o[key] == null || o[key] === '' ? '(blank)' : String(o[key]); if (!m.has(k)) m.set(k, []); m.get(k).push(o); });
  return Array.from(m, ([k, rs]) => ({ key: k, rows: rs }));
}
const DP_SLOTS = { light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'], dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] };
function dpEntityColor(dimKey, val) { // colour follows the entity (sorted order in the FULL snapshot), never its rank under a filter
  const all = Array.from(new Set(dp.rows.map(o => o[dimKey] == null ? '(blank)' : String(o[dimKey])))).sort((a, b) => a.localeCompare(b)), i = all.indexOf(String(val));
  const pal = document.body.classList.contains('dark') ? DP_SLOTS.dark : DP_SLOTS.light; return i >= 0 && i < 8 ? pal[i] : (document.body.classList.contains('dark') ? '#64748b' : '#a19f9d');
}

/* ---------- filter UI ---------- */
function dpRefresh(opts) { opts = opts || {}; dp.view = dpFilter(dp.rows); dpRenderFilters(opts.except); dpRenderActive(); dpRenderCount(); dpRenderBand(); dpRenderKpis(); dpRenderCharts(); dpRenderTable(); }
function dpRenderCount() { const el = PLQ('#dpCount'); if (el) el.textContent = `${dp.view.length} of ${dp.rows.length} SKUs`; }
function dpRenderFilters(except) {
  const host = PLQ('#dpDimHost'); if (!host || !dp.cur) return;
  const keys = DP_DIM_KEYS.filter(k => DP_COL()[k] && new Set(dp.rows.map(o => o[k])).size >= 2);
  Array.from(host.children).forEach(ch => { if (ch.dataset.k === except) return; ch.remove(); });
  keys.forEach(k => {
    if (k === except && host.querySelector(`[data-k="${k}"]`)) return;
    const wrap = document.createElement('div'); wrap.className = 'pl-dim'; wrap.dataset.k = k; wrap.innerHTML = `<label>${plEsc(dpLabel(k))}</label>`;
    const base = dpFilter(dp.rows, k), opts = Array.from(new Set(base.map(o => o[k] == null ? '(blank)' : String(o[k])))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const cur = (dp.conds.find(c => c.key === k && c.op === 'in') || { vals: [] }).vals.slice();
    wrap.appendChild(buildMultiCombo(cur, Array.from(new Set(opts.concat(cur))), arr => { dpSetDim(k, arr); dpRefresh({ except: k }); }, { placeholder: 'All' }));
    const ref = Array.from(host.children).find(ch => DP_DIM_KEYS.indexOf(ch.dataset.k) > DP_DIM_KEYS.indexOf(k)); host.insertBefore(wrap, ref || null);
  });
}
function dpRenderActive() {
  const host = PLQ('#dpActive'); if (!host) return; host.innerHTML = '';
  dp.conds.filter(c => !(c.op === 'in' && DP_DIM_KEYS.includes(c.key))).forEach(c => {
    const chip = document.createElement('span'); chip.className = 'pl-chip'; const lab = dpLabel(c.key);
    if (c.op === 'range') { chip.innerHTML = `<b>${plEsc(lab)}</b> between <input type="number" step="any" value="${c.min == null ? '' : c.min}" data-e="min" placeholder="min" /> and <input type="number" step="any" value="${c.max == null ? '' : c.max}" data-e="max" placeholder="max" />`; chip.querySelectorAll('input').forEach(i => i.addEventListener('change', () => { const v = i.value === '' ? null : Number(i.value); c[i.dataset.e] = v; dpRefresh(); })); }
    else if (c.op === 'in') chip.innerHTML = `<b>${plEsc(lab)}</b> = ${plEsc(c.vals.join(', '))}`;
    else if (c.op === 'contains') chip.innerHTML = `<b>${plEsc(lab)}</b> contains “${plEsc(c.text)}”`;
    else chip.innerHTML = `<b>${plEsc(lab)}</b> ${c.op === 'empty' ? 'is empty / 0' : 'has a value'}`;
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.title = 'Remove'; x.addEventListener('click', () => { dp.conds = dp.conds.filter(z => z !== c); dpRefresh(); }); chip.appendChild(x); host.appendChild(chip);
  });
  host.style.display = host.children.length ? '' : 'none';
}
function dpSearchInit() {
  const host = PLQ('#dpSearchHost'); host.innerHTML = ''; if (!dp.cur) return;
  const opts = Array.from(new Set(dp.rows.flatMap(o => [o.code, o.item]).filter(Boolean))).sort();
  host.appendChild(buildMultiCombo(dp.q.slice(), opts, arr => { dp.q = arr; dpRefresh({ except: '__none' }); }, { placeholder: '🔍 Search SKU code, item, brand… pick several (Enter adds typed text)' }));
}
function dpAddFilterPop() {
  const old = PLQ('#dpPop'); if (old) { old.remove(); return; }
  const pop = document.createElement('div'); pop.id = 'dpPop'; pop.className = 'pl-pop'; const btn = PLQ('#dpAddFilterBtn'), host = PLQ('#dpFilters');
  pop.style.left = Math.max(0, btn.offsetLeft - 20) + 'px'; pop.style.top = (btn.offsetTop + btn.offsetHeight + 6) + 'px';
  const cols = dpAllCols(dp.cur), bySec = {}; cols.forEach(c => { (bySec[c.section] = bySec[c.section] || []).push(c); });
  pop.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-weight:700;">Filter on any column</span><span class="btn-row" style="margin:0;"><button id="dpPopOk" class="small" type="button">Add filter</button><button id="dpPopX" class="ghost small" type="button">Cancel</button></span></div><select id="dpPopCol" style="margin:0 0 8px;">${DP_SECTIONS.filter(s => bySec[s]).map(s => `<optgroup label="${plEsc(s)}">${bySec[s].map(c => `<option value="${plEsc(c.key)}">${plEsc(c.label)}</option>`).join('')}</optgroup>`).join('')}</select><div id="dpPopBody"></div>`;
  host.appendChild(pop); let picked = [];
  const draw = () => {
    const k = PLQ('#dpPopCol').value, b = PLQ('#dpPopBody'), c = DP_COL()[k]; picked = []; b.innerHTML = '';
    if (c.type === 'text') {
      const opts = Array.from(new Set(dp.rows.map(o => o[k] == null ? '(blank)' : String(o[k])))).sort((a, b2) => a.localeCompare(b2, undefined, { numeric: true }));
      b.innerHTML = '<label class="text-sm">Pick values (any match)</label><div id="dpPopVals"></div><label class="text-sm" style="margin-top:6px;display:block;">…or text contains</label><input type="text" id="dpPopTxt" placeholder="e.g. 180" />';
      PLQ('#dpPopVals').appendChild(buildMultiCombo([], opts, arr => { picked = arr; }, { placeholder: 'Type to search…' }));
    } else {
      const vals = dp.rows.map(o => o[k]).filter(v => typeof v === 'number'), mn = vals.length ? Math.min.apply(null, vals) : 0, mx = vals.length ? Math.max.apply(null, vals) : 0;
      b.innerHTML = `<div class="text-sm" style="color:var(--gray-600);margin-bottom:4px;">Values range from ${plEsc(dpFmtBy(c.type)(mn))} to ${plEsc(dpFmtBy(c.type)(mx))}${c.type === 'pct' ? ' (enter 0.25 for 25%)' : ''}</div><div class="btn-row"><input type="number" step="any" id="dpPopMin" placeholder="min" style="max-width:120px;margin:0;" /><span>to</span><input type="number" step="any" id="dpPopMax" placeholder="max" style="max-width:120px;margin:0;" /></div><label class="text-sm" style="display:block;margin-top:6px;"><select id="dpPopMode" style="margin:0;"><option value="range">Between min and max</option><option value="empty">Is empty or zero</option><option value="notempty">Has a value (not zero)</option></select></label>`;
    }
  };
  PLQ('#dpPopCol').addEventListener('change', draw); draw();
  PLQ('#dpPopX').addEventListener('click', () => pop.remove());
  PLQ('#dpPopOk').addEventListener('click', () => {
    const k = PLQ('#dpPopCol').value, c = DP_COL()[k];
    if (c.type === 'text') { const t = (PLQ('#dpPopTxt').value || '').trim(); if (picked.length) dp.conds.push({ id: ++dp.uid, key: k, op: 'in', vals: picked.slice() }); else if (t) dp.conds.push({ id: ++dp.uid, key: k, op: 'contains', text: t }); else return; }
    else { const mode = PLQ('#dpPopMode').value; if (mode !== 'range') dp.conds.push({ id: ++dp.uid, key: k, op: mode }); else { const mn = PLQ('#dpPopMin').value, mx = PLQ('#dpPopMax').value; if (mn === '' && mx === '') return; dp.conds.push({ id: ++dp.uid, key: k, op: 'range', min: mn === '' ? null : Number(mn), max: mx === '' ? null : Number(mx) }); } }
    pop.remove(); dpRefresh();
  });
}
const DP_PRE_KEY = LS_BASE + '_dp_presets';
function dpPresets() { try { return JSON.parse(localStorage.getItem(DP_PRE_KEY) || '[]'); } catch (e) { return []; } }
function dpPresetFill() { const s = PLQ('#dpPresetSel'); s.innerHTML = '<option value="">★ Saved filter sets…</option>' + dpPresets().map((p, i) => `<option value="${i}">${plEsc(p.name)}</option>`).join(''); }
function dpFiltersInit() {
  PLQ('#dpAddFilterBtn').addEventListener('click', dpAddFilterPop);
  PLQ('#dpClearBtn').addEventListener('click', () => { dp.conds = []; dp.q = []; dpSearchInit(); const h = PLQ('#dpDimHost'); h.innerHTML = ''; dpRefresh(); });
  PLQ('#dpPresetSave').addEventListener('click', () => { if (!dp.conds.length && !dp.q.length) { sectionToast('Set some filters first.', 'warn'); return; } const name = prompt('Name for this filter set:'); if (!name) return; const l = dpPresets().filter(p => p.name !== name); l.push({ name, conds: dp.conds.map(c => Object.assign({}, c)), q: dp.q.slice() }); try { localStorage.setItem(DP_PRE_KEY, JSON.stringify(l)); } catch (e) {} dpPresetFill(); sectionToast('Filter set saved.', 'ok'); });
  PLQ('#dpPresetDel').addEventListener('click', () => { const i = PLQ('#dpPresetSel').value; if (i === '') return; const l = dpPresets(); l.splice(+i, 1); try { localStorage.setItem(DP_PRE_KEY, JSON.stringify(l)); } catch (e) {} dpPresetFill(); });
  PLQ('#dpPresetSel').addEventListener('change', e => { const p = dpPresets()[+e.target.value]; if (!p) return; dp.conds = p.conds.map(c => Object.assign({}, c, { id: ++dp.uid })); dp.q = (p.q || []).slice(); dpSearchInit(); PLQ('#dpDimHost').innerHTML = ''; dpRefresh(); });
  document.addEventListener('mousedown', e => { const p = PLQ('#dpPop'); if (p && !e.composedPath().includes(p) && e.target.id !== 'dpAddFilterBtn' && !e.target.closest('.combo-list')) p.remove(); });
  dpPresetFill();
}

const DP_CTL_KEY = LS_BASE + '_dp_ctl';
const dpCtlAll = () => { try { return JSON.parse(localStorage.getItem(DP_CTL_KEY) || '{}'); } catch (e) { return {}; } };
const dpCtlGet = (card, id, def) => { const v = (dpCtlAll()[card] || {})[id]; return v == null ? def : v; };
const dpCtlSet = (card, id, v) => { const a = dpCtlAll(); (a[card] = a[card] || {})[id] = v; try { localStorage.setItem(DP_CTL_KEY, JSON.stringify(a)); } catch (e) {} };
const dpSameMonth = () => dp.prev && dp.cur && String(dp.prev.asOf).slice(0, 7) === String(dp.cur.asOf).slice(0, 7);

const DP_DEFS = [];
const dpDimOpts = () => dpDims().map(d => [d.key, d.label]);
const dpMetOpts = () => dpMetrics().map(m => [m.key, m.label]);
function dpFold(groups, n, valFn) { groups.sort((a, b) => valFn(b) - valFn(a)); if (groups.length <= n) return groups; const keep = groups.slice(0, n - 1), rest = groups.slice(n - 1); keep.push({ key: `Other (${rest.length})`, rows: rest.flatMap(g => g.rows), other: true }); return keep; }
function dpCardBuild(def) {
  const card = document.createElement('div'); card.className = 'pl-card ' + (def.span || 's6'); card.dataset.id = def.id;
  card.innerHTML = `<div class="pl-ch"><h3>${plEsc(def.title)}</h3><span class="ctls"></span><button class="pl-ib" data-a="tbl" title="Table view of the same data">▦ Table</button><button class="pl-ib" data-a="png" title="Download as picture">⬇ PNG</button><button class="pl-ib" data-a="full" title="Full screen">⤢</button><div class="sub">${plEsc(def.sub || '')}</div></div><div class="pl-lgh"></div><div class="pl-body"></div><div class="pl-tbl-wrap" style="display:none"></div>`;
  const ctls = card.querySelector('.ctls');
  (def.ctl || []).forEach(c => { const lab = document.createElement('label'); lab.textContent = c.label + ' '; const sel = document.createElement('select'); sel.dataset.c = c.id; lab.appendChild(sel); ctls.appendChild(lab); sel.addEventListener('change', () => { dpCtlSet(def.id, c.id, sel.value); dpCardDraw(def, card); }); });
  card.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'tbl') { const on = card.dataset.tbl !== '1'; card.dataset.tbl = on ? '1' : ''; b.classList.toggle('on', on); b.textContent = on ? '▦ Chart' : '▦ Table'; card.querySelector('.pl-body').style.display = on ? 'none' : ''; card.querySelector('.pl-lgh').style.display = on ? 'none' : ''; card.querySelector('.pl-tbl-wrap').style.display = on ? '' : 'none'; }
    else if (a === 'png') { const svg = card.querySelector('.pl-body svg'); if (svg) plSvgToPng(svg, 'planning_' + def.id + '_' + dp.date); else sectionToast('Nothing to export in this card.', 'warn'); }
    else if (a === 'full') { const on = !card.classList.contains('pl-full'); card.classList.toggle('pl-full', on); b.textContent = on ? '✕' : '⤢'; setTimeout(() => dpCardDraw(def, card), 30); } });
  return card;
}
function dpCardDraw(def, card) {
  if (!dp.cur) return; const body = card.querySelector('.pl-body'), lg = card.querySelector('.pl-lgh'), tw = card.querySelector('.pl-tbl-wrap');
  (def.ctl || []).forEach(c => { const sel = card.querySelector(`select[data-c="${c.id}"]`), opts = c.opts(); const cur = dpCtlGet(def.id, c.id, c.def); const valid = opts.some(o => o[0] === cur); sel.innerHTML = opts.map(o => `<option value="${plEsc(o[0])}" ${String(o[0]) === String(valid ? cur : (opts[0] && opts[0][0]))  ? 'selected' : ''}>${plEsc(o[1])}</option>`).join(''); });
  const ctl = {}; (def.ctl || []).forEach(c => { const sel = card.querySelector(`select[data-c="${c.id}"]`); ctl[c.id] = sel.value; });
  let res = null; body.classList.add('busy');
  try { res = def.draw(body, { rows: cfRows(card, dp.view), all: dp.rows, ctl, T: plT(), snap: dp.cur, tg: 0, card }) || {}; } catch (e) { body.innerHTML = `<div class="pl-empty">⚠ ${plEsc(e.message)}</div>`; console.error(def.id, e); res = {}; }
  body.classList.remove('busy'); lg.innerHTML = res.legend ? plLegend(res.legend) : '';
  if (res.table) { tw.innerHTML = `<table class="pl-tbl"><thead><tr>${res.table.headers.map((h, i) => `<th class="${i ? 'n' : ''}">${plEsc(h)}</th>`).join('')}</tr></thead><tbody>${res.table.rows.map(r => `<tr>${r.map((v, i) => `<td class="${typeof v === 'number' ? 'n' : ''}">${plEsc(typeof v === 'number' ? plF(v, Math.abs(v) < 10 && v % 1 ? 2 : 0) : (v == null ? '' : v))}</td>`).join('')}</tr>`).join('')}</tbody></table>`; card._table = res.table; }
  else { tw.innerHTML = '<div class="pl-empty">No table for this card.</div>'; card._table = null; }
}
function dpRenderCharts() { const grid = PLQ('#dpGrid'); if (!grid || !dp.cur) return; DP_DEFS.forEach(def => { let card = grid.querySelector(`[data-id="${def.id}"]`); if (!card) { card = dpCardBuild(def); grid.appendChild(card); } dpCardDraw(def, card); }); }
function dpRedrawAll() { const grid = PLQ('#dpGrid'); if (!grid) return; DP_DEFS.forEach(def => { const card = grid.querySelector(`[data-id="${def.id}"]`); if (card) dpCardDraw(def, card); }); }


DP_DEFS.push({ id: 'analysis', title: 'Custom analysis — any column', sub: 'Choose what to group by and what to measure', span: 's12',
  ctl: [{ id: 'x', label: 'group by', opts: dpDimOpts, def: 'brand' }, { id: 'y', label: 'measure', opts: dpMetOpts, def: 'pal_TOT' }, { id: 'agg', label: 'as', opts: () => [['sum', 'Sum'], ['avg', 'Average'], ['min', 'Min'], ['max', 'Max'], ['count', 'Count of SKUs']], def: 'sum' }, { id: 'ch', label: 'chart', opts: () => [['bars', 'Bars'], ['cols', 'Columns'], ['donut', 'Donut'], ['line', 'Line']], def: 'bars' }, { id: 'n', label: 'top', opts: () => [['8', '8'], ['12', '12'], ['20', '20'], ['40', '40']], def: '12' }],
  draw(host, c) {
    const T = c.T, x = c.ctl.x, y = c.ctl.y, agg = c.ctl.agg, n = +c.ctl.n || 12, col = DP_COL()[y], f = agg === 'count' ? plF : dpFmtBy(col && col.type), val = rs => dpAgg(rs, y, agg);
    const g = dpFold(dpGroup(c.rows, x), n, z => Math.abs(val(z.rows))), items = g.map(z => ({ label: z.key, v: val(z.rows), n: z.rows.length, other: z.other, key: z.key, rows: z.rows }));
    const name = `${agg === 'count' ? 'Count' : { sum: 'Sum', avg: 'Average', min: 'Min', max: 'Max' }[agg]} of ${agg === 'count' ? dpLabel(y) : dpLabel(y)}`;
    c.card.querySelector('.sub').textContent = `${name} by ${dpLabel(x)} · ${c.rows.length} SKUs`;
    const ch = c.ctl.ch;
    if (ch === 'bars') plcBarsH(host, { rows: items.map(i => ({ label: i.label, vals: [i.v], other: i.other, key: i.key, tip: [{ c: T.act, k: name, v: f(i.v) }, { k: 'SKUs', v: String(i.n) }] })), series: [{ name, color: T.act }], fmt: f, tickFmt: col && col.type === 'pct' ? (v => plP(v, 0)) : plK, onClick: r => { if (!r.other) dpPick(x, r.key); } });
    else if (ch === 'cols') plcCols(host, { cats: items.map(i => ({ label: i.label, vals: [i.v], other: i.other, key: i.key, tip: [{ c: T.act, k: name, v: f(i.v) }, { k: 'SKUs', v: String(i.n) }] })), series: [{ name, color: T.act }], fmt: f, tickFmt: col && col.type === 'pct' ? (v => plP(v, 0)) : plK, labelFn: (c2, v) => plK(v), onClick: r => { if (!r.other) dpPick(x, r.key); } });
    else if (ch === 'donut') { const top = items.slice(0, 6), rest = items.slice(6); const sl = top.map((i, k) => ({ label: i.label, value: Math.max(0, i.v), color: T.series[k], key: i.key, other: i.other })); if (rest.length) sl.push({ label: `Other (${rest.length})`, value: rest.reduce((t, i) => t + Math.max(0, i.v), 0), color: T.d ? '#64748b' : '#a19f9d', other: true }); plcDonut(host, { slices: sl, center: { value: f(sl.reduce((t, s) => t + s.value, 0)), label: name.length > 24 ? 'total' : name }, unit: name, onClick: s => { if (!s.other) dpPick(x, s.key); } }); }
    else plcLine(host, { x: items.map(i => i.label), series: [{ name, color: T.act, vals: items.map(i => i.v) }], fmt: f, height: 240, zero: true });
    return { table: { headers: [dpLabel(x), name, 'SKUs'], rows: items.map(i => [i.label, +Number(i.v).toFixed(3), i.n]) } };
  } });
DP_DEFS.push({ id: 'profile', title: 'Column profile', sub: 'Every column at a glance — click a row to analyse it above', span: 's12',
  draw(host, c) {
    const cols = dpAllCols(c.snap), rows = c.rows, n = rows.length;
    const data = cols.map(col => { const vs = rows.map(o => o[col.key]).filter(v => v != null && v !== ''), num = vs.filter(v => typeof v === 'number'), isNum = col.type !== 'text'; const dist = new Set(vs).size;
      return { col, filled: vs.length, dist, min: isNum && num.length ? Math.min.apply(null, num) : null, max: isNum && num.length ? Math.max.apply(null, num) : null, mean: isNum && num.length ? num.reduce((a, b) => a + b, 0) / num.length : null, sum: isNum && col.type === 'num' && num.length ? num.reduce((a, b) => a + b, 0) : null, top: !isNum && vs.length ? (() => { const m = {}; vs.forEach(v => { m[v] = (m[v] || 0) + 1; }); const e = Object.entries(m).sort((a, b) => b[1] - a[1])[0]; return e ? `${e[0]} (${e[1]})` : ''; })() : '' }; });
    const f = (d, v) => v == null ? '' : dpFmtBy(d.col.type)(v);
    host.innerHTML = `<div class="pl-tbl-wrap" style="max-height:380px;"><table class="pl-tbl"><thead><tr><th>Column</th><th>Section</th><th>Type</th><th class="n">Filled</th><th class="n">Distinct</th><th class="n">Min</th><th class="n">Max</th><th class="n">Average</th><th class="n">Sum</th><th>Most common</th></tr></thead><tbody>${data.map(d => `<tr data-k="${plEsc(d.col.key)}" style="cursor:pointer"><td><b>${plEsc(d.col.label)}</b></td><td>${plEsc(d.col.section)}</td><td>${d.col.type === 'text' ? 'text' : d.col.type}</td><td class="n">${d.filled}/${n}</td><td class="n">${d.dist}</td><td class="n">${f(d, d.min)}</td><td class="n">${f(d, d.max)}</td><td class="n">${f(d, d.mean)}</td><td class="n">${f(d, d.sum)}</td><td>${plEsc(d.top)}</td></tr>`).join('')}</tbody></table></div>`;
    host.querySelectorAll('tr[data-k]').forEach(tr => tr.addEventListener('click', () => { const k = tr.dataset.k, col = DP_COL()[k]; if (!col) return; if (col.type === 'text') { if (!dpDims().some(d => d.key === k)) { sectionToast('Too many different values to group by — use a filter instead.', 'warn'); return; } dpCtlSet('analysis', 'x', k); } else dpCtlSet('analysis', 'y', k); const grid = PLQ('#dpGrid'), ac = grid.querySelector('[data-id="analysis"]'), def = DP_DEFS.find(z => z.id === 'analysis'); dpCardDraw(def, ac); ac.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
    return { table: { headers: ['Column', 'Section', 'Type', 'Filled', 'Distinct', 'Min', 'Max', 'Average', 'Sum'], rows: data.map(d => [d.col.label, d.col.section, d.col.type, d.filled, d.dist, d.min == null ? '' : +d.min.toFixed(2), d.max == null ? '' : +d.max.toFixed(2), d.mean == null ? '' : +d.mean.toFixed(2), d.sum == null ? '' : +d.sum.toFixed(2)]) } };
  } });

const dpTbl = { sec: 'Overview', hidden: new Set(), sort: null, limit: 300 };
const DP_OVERVIEW = ['code', 'item', 'brand', 'status', 'totalSOH', 'releasedSOH', 'incubation', 'onHold', 'docReleased', 'monthlyFcst', 'mtdSales', 'pctMtd', '_health', '_paceClass'];
const dpColsFor = () => { const all = dpAllCols(dp.cur); if (dpTbl.sec === 'All') return all; if (dpTbl.sec === 'Overview') return DP_OVERVIEW.map(k => DP_COL()[k]).filter(Boolean); return all.filter(c => c.section === dpTbl.sec || c.key === 'code' || c.key === 'item'); };
const dpColVisible = () => dpColsFor().filter(c => !dpTbl.hidden.has(c.key));
function dpPill(o, key) { const defs = key === '_health' ? plHealthDefs() : PL_PACE, d = defs.find(x => x.k === o[key]); return d ? `<span class="pl-h" style="background:${d.c}22;color:${d.c};border:1px solid ${d.c}66" title="${plEsc(d.k)}">${d.g} ${plEsc(d.k)}</span>` : plEsc(o[key] || ''); }
function dpCellHtml(o, c) {
  const v = o[c.key]; if (c.key === '_health' || c.key === '_paceClass') return dpPill(o, c.key); if (v == null || v === '') return '';
  if (c.type === 'text' || typeof v !== 'number') return plEsc(v);
  if (c.type === 'pct') return plEsc(plP(v, 1)); if (c.key === '_paceIdx') return v.toFixed(2) + '×'; return plEsc(dpFmtBy(c.type)(v));
}
function dpRenderTable() {
  const tbl = PLQ('#dpDataTable'); if (!tbl || !dp.cur) return;
  const secs = ['Overview'].concat(DP_SECTIONS.filter(s => dpAllCols(dp.cur).some(c => c.section === s)), ['All']);
  if (!secs.includes(dpTbl.sec)) dpTbl.sec = 'Overview';
  PLQ('#dpSecTabs').innerHTML = secs.map(s => `<button type="button" data-s="${plEsc(s)}" class="${s === dpTbl.sec ? 'on' : ''}">${plEsc(s)}</button>`).join('');
  PLQ('#dpSecTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { dpTbl.sec = b.dataset.s; dpTbl.limit = 300; dpRenderTable(); }));
  const cols = dpColVisible(); let rows = dp.view.slice();
  if (dpTbl.sort) { const { key, dir } = dpTbl.sort; rows.sort((a, b) => { const x = a[key], y = b[key]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir; }); }
  const shown = rows.slice(0, dpTbl.limit);
  PLQ('#dpTblInfo').textContent = `— ${rows.length} of ${dp.rows.length} SKUs · ${cols.length} columns`;
  tbl.querySelector('thead').innerHTML = '<tr>' + cols.map((c, i) => `<th data-k="${plEsc(c.key)}" class="${i === 0 ? 'sticky1' : ''} ${c.type !== 'text' ? 'num' : ''}" title="${plEsc(c.label)} — click to sort">${plEsc(plTrunc(c.label, 160))}${dpTbl.sort && dpTbl.sort.key === c.key ? (dpTbl.sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr>';
  tbl.querySelector('thead').querySelectorAll('th').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; dpTbl.sort = dpTbl.sort && dpTbl.sort.key === k ? { key: k, dir: -dpTbl.sort.dir } : { key: k, dir: DP_COL()[k] && DP_COL()[k].type !== 'text' ? -1 : 1 }; dpRenderTable(); }));
  const tot = {}; cols.forEach(c => { if (c.type === 'num' && c.section !== 'Parameters') tot[c.key] = dpSum(rows, c.key); });
  tbl.querySelector('tbody').innerHTML = shown.map(o => `<tr data-code="${plEsc(o.code)}">` + cols.map((c, i) => `<td class="${i === 0 ? 'sticky1' : ''} ${c.type !== 'text' ? 'num' : ''}">${dpCellHtml(o, c)}</td>`).join('') + '</tr>').join('') +
    (rows.length > shown.length ? `<tr><td colspan="${cols.length}" style="text-align:center"><button type="button" class="ghost small" id="dpMoreRows">Show ${Math.min(500, rows.length - shown.length)} more of ${rows.length - shown.length} hidden rows</button></td></tr>` : '') +
    (Object.keys(tot).length ? `<tr style="font-weight:700;background:var(--gray-100)">` + cols.map((c, i) => `<td class="${i === 0 ? 'sticky1' : ''} ${c.type !== 'text' ? 'num' : ''}">${i === 0 ? 'Total (' + rows.length + ')' : tot[c.key] != null ? plF(tot[c.key]) : ''}</td>`).join('') + '</tr>' : '');
  tbl.querySelectorAll('tbody tr[data-code]').forEach(tr => tr.addEventListener('dblclick', () => dpRowOpen(tr.dataset.code)));
  const mb = PLQ('#dpMoreRows'); if (mb) mb.addEventListener('click', () => { dpTbl.limit += 500; dpRenderTable(); });
}
function dpColPop() {
  let p = PLQ('#dpColPop'); if (p) { p.remove(); return; } p = document.createElement('div'); p.id = 'dpColPop'; p.className = 'pl-pop'; p.style.cssText += ';right:20px;max-height:380px;overflow:auto;min-width:260px';
  const cols = dpColsFor(); p.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Columns in “${plEsc(dpTbl.sec)}”</div><div class="btn-row" style="margin-bottom:6px"><button type="button" class="ghost small" data-a="all">All</button><button type="button" class="ghost small" data-a="none">None</button></div>` + cols.map(c => `<label style="display:flex;gap:6px;font-size:12px;padding:2px 0"><input type="checkbox" data-k="${plEsc(c.key)}" ${dpTbl.hidden.has(c.key) ? '' : 'checked'}/> ${plEsc(c.label)}</label>`).join('');
  p.addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; e.target.checked ? dpTbl.hidden.delete(k) : dpTbl.hidden.add(k); dpRenderTable(); });
  p.addEventListener('click', e => { const a = e.target.dataset.a; if (!a) return; cols.forEach(c => a === 'all' ? dpTbl.hidden.delete(c.key) : dpTbl.hidden.add(c.key)); dpRenderTable(); p.querySelectorAll('input').forEach(i => { i.checked = a === 'all'; }); });
  const card = PLQ('#dpTableCard'); card.style.position = 'relative'; card.appendChild(p); p.style.top = '46px';
}



/* ============================================================
   DAILY PLAN — model, band, KPIs
   ============================================================ */
const dp = { dates: [], map: new Map(), cur: null, date: '', prev: null, rows: [], view: [], conds: [], q: [], uid: 0, scope: 'all', colMap: {} };
const DP_DIM_KEYS = ['prodIn', 'type', 'brand', 'category', 'subCateg', 'uom', 'fillSize', 'palletType', '_abc', '_peak', '_active'];
const DP_SKIPDIM = new Set(['code', 'item']);
const DP_COL = () => dp.colMap || {};
const DP_SECTIONS = ['Item', 'Parameters', 'Pallets', 'Crates', 'Litres', 'Demand (units)', 'Batches', 'By day', 'Derived'];
DP_OVERVIEW.splice(0, DP_OVERVIEW.length, ...['code', 'item', 'category', 'brand', 'prodIn', 'uom', 'pal_TOT', 'crt_TOT', 'ltr_TOT', 'bat_TOT', 'pal_NE', 'pal_SE', '_abc', '_peak']);
const DP_METS = [['pal', 'Pallets'], ['crt', 'Crates'], ['ltr', 'Litres'], ['bat', 'Production batches']];
const dpMetFmt = m => m === 'pal' || m === 'bat' ? (v => plF(v, 1)) : (v => plF(v, 0));
const dpMetName = m => (DP_METS.find(x => x[0] === m) || [m, m])[1];
const dpScopeDays = (s, sc) => (sc === 'all' || !s.days.includes(sc)) ? s.days : [sc];
function dpRegions(s) {
  if (s._reg) return s._reg; const L = s.locs.length, cand = ['ALN', 'AUH', 'TRF'].filter(l => s.locs.includes(l)); let ok = 0, tot = 0;
  s.rows.forEach(o => s.days.forEach(d => { const a = o.v.dem[d]; if (a[L] > 0 || a[L + 1] > 0) { tot++; const se = cand.reduce((t, l) => t + a[s.locs.indexOf(l)], 0); if (Math.abs(se - a[L + 1]) < 1e-6) ok++; } }));
  const r = {}; if (tot && ok / tot >= 0.9) s.locs.forEach(l => { r[l] = cand.includes(l) ? 'SE' : 'NE'; }); s._reg = r; return r;
}
function dpAllCols(s) {
  if (s._cols) return s._cols; const out = [], T = (key, label, section, type) => out.push({ key, label, section, type: type || 'text' });
  [['code', 'ICODE'], ['item', 'Item'], ['prodIn', 'Produced in'], ['type', 'Type'], ['brand', 'Brand'], ['category', 'Category'], ['subCateg', 'Sub-category'], ['uom', 'UoM'], ['fillSize', 'Fill size']].forEach(a => T(a[0], a[1], 'Item'));
  [['ltrConv', 'Litres per UoM'], ['batchLtr', 'Batch size (litres)'], ['pcsCrt', 'Pcs / crate'], ['crtPallet', 'Crates / pallet'], ['unitPallet', 'Units / pallet']].forEach(a => T(a[0], a[1], 'Parameters', 'num')); T('palletType', 'Pallet type', 'Parameters');
  const names = s.locs.concat(['NE', 'SE', 'TOT']);
  [['pal', 'Pallets', 'Pallets'], ['crt', 'Crates', 'Crates'], ['ltr', 'Litres', 'Litres'], ['dem', 'Demand (units)', 'Demand (units)'], ['bat', 'Batches', 'Batches']].forEach(([m, lb, sec]) => names.forEach(nm => T(m + '_' + nm, lb + ' — ' + (nm === 'TOT' ? 'Total' : nm), sec, 'num')));
  s.days.forEach((d, i) => [['pal', 'Pallets'], ['crt', 'Crates'], ['ltr', 'Litres'], ['dem', 'Demand (units)']].forEach(([m, lb]) => T('D' + i + '_' + m, dpDayLbl(d) + ' — ' + lb + ' (total)', 'By day', 'num')));
  T('_active', 'Demand status', 'Derived'); T('_abc', 'ABC class (by pallets)', 'Derived'); T('_peak', 'Peak location', 'Derived'); T('_nLoc', 'Locations with demand', 'Derived', 'num'); T('_share', 'Share of total pallets', 'Derived', 'pct');
  s._cols = out; return out;
}
function dpObjs(snap, days) {
  const key = days.join(','); snap._o = snap._o || {}; if (snap._o[key]) return snap._o[key];
  const L = snap.locs.length, n = L + 3, names = snap.locs.concat(['NE', 'SE', 'TOT']);
  const objs = snap.rows.map(r => {
    const o = { code: r.code, item: r.item, prodIn: r.prodIn, type: r.type, brand: r.brand, category: r.category, subCateg: r.subCateg, uom: r.uom, fillSize: r.fillSize, ltrConv: r.ltrConv, batchLtr: r.batchLtr, pcsCrt: r.pcsCrt, crtPallet: r.crtPallet, unitPallet: r.unitPallet, palletType: r.palletType };
    const acc = m => { const a = new Array(n).fill(0); days.forEach(d => { const v = r.v[m][d]; if (v) for (let j = 0; j < n; j++) a[j] += v[j] || 0; }); return a; }, dem = acc('dem'), crt = acc('crt'), pal = acc('pal'), lc = r.ltrConv || 0;
    names.forEach((nm, j) => { o['dem_' + nm] = dem[j]; o['crt_' + nm] = crt[j]; o['pal_' + nm] = pal[j]; o['ltr_' + nm] = dem[j] * lc; o['bat_' + nm] = r.batchLtr ? dem[j] * lc / r.batchLtr : 0; });
    snap.days.forEach((d, i) => { const v = r.v; o['D' + i + '_pal'] = v.pal[d][L + 2]; o['D' + i + '_crt'] = v.crt[d][L + 2]; o['D' + i + '_ltr'] = v.dem[d][L + 2] * lc; o['D' + i + '_dem'] = v.dem[d][L + 2]; });
    o._active = (o.dem_TOT > 0 || o.pal_TOT > 0) ? 'With demand' : 'No demand';
    let best = 0, bn = '—'; snap.locs.forEach(l => { const v = o['pal_' + l]; if (v > best) { best = v; bn = l; } }); o._peak = bn; o._nLoc = snap.locs.filter(l => o['dem_' + l] > 0).length; return o;
  });
  const tot = objs.reduce((t, o) => t + o.pal_TOT, 0); let acc = 0;
  objs.slice().sort((a, b) => b.pal_TOT - a.pal_TOT).forEach(o => { if (!(o.pal_TOT > 0)) { o._abc = '—'; o._share = 0; return; } const prev = acc / tot; acc += o.pal_TOT; o._share = o.pal_TOT / tot; o._abc = prev < 0.8 ? 'A' : prev < 0.95 ? 'B' : 'C'; });
  snap._o[key] = objs; return objs;
}
async function dpLoadAll(sel) {
  const all = (await dpAll()).filter(s => s && s.planDate && s.rows && s.days).sort((a, b) => a.planDate.localeCompare(b.planDate));
  dp.map = new Map(all.map(s => [s.planDate, s])); dp.dates = all.map(s => s.planDate); const want = sel || dpCfg().sel; dp.date = dp.map.has(want) ? want : (dp.dates[dp.dates.length - 1] || ''); dpSetCur();
}
function dpSetCur() {
  dp.cur = dp.map.get(dp.date) || null; const i = dp.dates.indexOf(dp.date); dp.prev = i > 0 ? dp.map.get(dp.dates[i - 1]) : null;
  if (!dp.cur) { dp.rows = []; return; } if (dp.scope !== 'all' && !dp.cur.days.includes(dp.scope)) dp.scope = 'all';
  dp.days = dpScopeDays(dp.cur, dp.scope); dp.rows = dpObjs(dp.cur, dp.days); dp.colMap = {}; dpAllCols(dp.cur).forEach(c => { dp.colMap[c.key] = c; });
  dp.rmap = new Map(dp.cur.rows.map(r => [r.code, r]));
}

/* ---- overrides of the generic framework for this data set ---- */
function dpMatchQ(o, q) { if (!q.length) return true; const t = [o.code, o.item, o.brand, o.category, o.subCateg, o.type, o.prodIn, o.fillSize].join(' ').toLowerCase(); return q.some(x => t.includes(String(x).toLowerCase())); }
function dpDims() { const out = []; if (!dp.cur) return out; dpAllCols(dp.cur).forEach(c => { if (c.type !== 'text' || DP_SKIPDIM.has(c.key)) return; const s = new Set(dp.rows.map(o => o[c.key])); if (s.size >= 1 && s.size <= 60) out.push({ key: c.key, label: c.label }); }); return out; }
function dpMetrics() { return dp.cur ? dpAllCols(dp.cur).filter(c => c.type === 'num' || c.type === 'pct').map(c => ({ key: c.key, label: c.label, type: c.type, section: c.section })) : []; }
function dpCellHtml(o, c) { const v = o[c.key]; if (v == null || v === '') return ''; if (c.type === 'text' || typeof v !== 'number') return plEsc(v); if (c.type === 'pct') return plEsc(plP(v, 1)); const m = /^(pal|bat)_/.test(c.key) || /_pal$/.test(c.key); return plEsc(plF(v, m || Math.abs(v) < 10 && v % 1 ? (m ? 1 : 2) : 0)); }
function dpPill(o, key) { return plEsc(o[key] || ''); }

/* ---- data helpers ---- */
const dpDayVal = (o, m, d, j) => { const r = dp.rmap.get(o.code); if (!r) return 0; const lc = r.ltrConv || 0; if (m === 'ltr') return (r.v.dem[d][j] || 0) * lc; if (m === 'bat') return r.batchLtr ? (r.v.dem[d][j] || 0) * lc / r.batchLtr : 0; return r.v[m][d][j] || 0; };
const dpSumK = (rows, k) => plSum(rows, k);
function dpFilteredFor(snap, days) { return dpFilter(dpObjs(snap, days)); }
function dpPrevCmp(f) { if (!dp.prev) return null; const inter = dp.days.filter(d => dp.prev.days.includes(d)); if (!inter.length) return null; try { return { c: f(dpFilteredFor(dp.cur, inter), dp.cur, inter), p: f(dpFilteredFor(dp.prev, inter), dp.prev, inter), days: inter }; } catch (e) { return null; } }
const dpSheetSum = (s, days, key) => { let t = 0, any = false; days.forEach(d => { const x = s.sheet && s.sheet.totals && s.sheet.totals[d] && s.sheet.totals[d][key]; if (x && x.TOT != null) { t += x.TOT; any = true; } }); return any ? t : null; };
function dpDelta(c, p, fmt, goodUp, pct) {
  if (c == null || p == null) return { t: '', c: 'nu' }; const d = c - p; if (Math.abs(d) < 1e-9) return { t: '▬ same as previous upload', c: 'nu' };
  return { t: `${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}${pct && p ? ' (' + plP(Math.abs(d / p), 1) + ')' : ''} vs plan ${dp.prev.planDate}`, c: goodUp == null ? 'nu' : ((d > 0) === goodUp ? 'up' : 'dn') };
}
const DP_KPIS = [
  { id: 'pal', label: 'Pallets required', f: r => plSum(r, 'pal_TOT'), fmt: v => plF(v, 1), goodUp: null, sub: r => `${plF(plSum(r, 'pal_NE'), 1)} NE · ${plF(plSum(r, 'pal_SE'), 1)} SE`, pct: true, spark: true },
  { id: 'crt', label: 'Crates', f: r => plSum(r, 'crt_TOT'), fmt: v => plF(v, 0), goodUp: null, sub: r => `${plF(plSum(r, 'dem_TOT'))} units (item UoM)`, pct: true, spark: true },
  { id: 'ltr', label: 'Litres', f: r => plSum(r, 'ltr_TOT'), fmt: v => plF(v, 0), goodUp: null, sub: r => `${plK(plSum(r, 'ltr_TOT') / 1000)} k-litres`, pct: true, spark: true },
  { id: 'bat', label: 'Production batches', f: r => plSum(r, 'bat_TOT'), fmt: v => plF(v, 1), goodUp: null, sub: r => `${r.filter(o => o.bat_TOT > 0).length} SKUs to produce`, spark: true },
  { id: 'sku', label: 'SKUs with demand', f: r => r.filter(o => o.dem_TOT > 0).length, fmt: plF, goodUp: null, sub: r => `of ${r.length} in the plan` },
  { id: 'top', label: 'Busiest location', text: true, f: r => { let b = null, bv = -1; dp.cur.locs.forEach(l => { const v = plSum(r, 'pal_' + l); if (v > bv) { bv = v; b = l; } }); return bv > 0 ? b : null; }, fmt: v => v, sub: r => { const t = plSum(r, 'pal_TOT'), l = DP_KPIS[5].f(r); return l && t ? `${plP(plSum(r, 'pal_' + l) / t, 0)} of all pallets` : ''; } },
  { id: 'ne', label: 'Northern share (NE)', f: r => { const t = plSum(r, 'pal_TOT'); return t ? plSum(r, 'pal_NE') / t : null; }, fmt: v => plP(v, 0), goodUp: null, sub: r => { const t = plSum(r, 'pal_TOT'); return t ? `SE ${plP(plSum(r, 'pal_SE') / t, 0)}` : ''; } },
  { id: 'trip', label: 'Trips (sheet calc.)', f: (r, s, days) => dpSheetSum(s || dp.cur, days || dp.days, 'trips'), fmt: v => plF(v, 1), goodUp: null, sub: () => 'as calculated in the file', noFilter: true },
  { id: 'big', label: 'Largest SKU', text: true, f: r => { const t = r.slice().sort((a, b) => b.pal_TOT - a.pal_TOT)[0]; return t && t.pal_TOT > 0 ? t.code : null; }, fmt: v => v, sub: r => { const t = r.slice().sort((a, b) => b.pal_TOT - a.pal_TOT)[0]; return t && t.pal_TOT > 0 ? `${plTrunc(t.item, 170)} · ${plF(t.pal_TOT, 1)} pallets` : ''; } },
  { id: 'abc', label: 'A-class SKUs (80% of volume)', f: r => r.filter(o => o._abc === 'A').length, fmt: plF, goodUp: null, sub: r => `${plP(plSum(r.filter(o => o._abc === 'A'), 'pal_TOT') / (plSum(r, 'pal_TOT') || 1), 0)} of pallets` },
  { id: 'avg', label: 'Avg pallets / location', f: r => dp.cur.locs.length ? plSum(r, 'pal_TOT') / dp.cur.locs.length : null, fmt: v => plF(v, 1), goodUp: null, sub: () => `${dp.cur.locs.length} locations` },
  { id: 'day', label: 'Peak day', text: true, f: r => { if (dp.cur.days.length < 2) return dpDayLbl(dp.cur.days[0]); let b = null, bv = -1; dp.cur.days.forEach((d, i) => { const v = plSum(r, 'D' + i + '_pal'); if (v > bv) { bv = v; b = d; } }); return dpDayLbl(b); }, fmt: v => v, sub: r => dp.cur.days.map((d, i) => `${dpDayLbl(d)}: ${plF(plSum(r, 'D' + i + '_pal'), 1)}`).join(' · '), noFilter: true },
];
function dpRenderKpis() {
  const host = PLQ('#dpKpis'); if (!host || !dp.cur) return; host.innerHTML = ''; const T = plT(), view = dp.view;
  DP_KPIS.forEach(k => {
    let v = null; try { v = k.f(view, dp.cur, dp.days); } catch (e) {} const el = document.createElement('div'); el.className = 'pl-kpi'; let d = { t: '', c: 'nu' };
    if (!k.text && k.goodUp !== undefined && !k.noFilter) { const cmp = dpPrevCmp((r, s, days) => k.f(r, s, days)); if (cmp) d = dpDelta(cmp.c, cmp.p, k.id === 'ne' ? (x => plP(x, 1)) : k.fmt, k.goodUp, k.pct); else if (!dp.prev) d = { t: 'first upload — no trend yet', c: 'nu' }; else d = { t: 'no common day with the previous plan', c: 'nu' }; }
    let sub = ''; try { sub = k.sub(view); } catch (e) {}
    el.innerHTML = `<div class="lbl">${plEsc(k.label)}</div><div class="val" ${k.text ? 'style="font-size:20px"' : ''}>${v == null ? '—' : plEsc(k.fmt(v))}</div><div class="sub">${plEsc(sub)}</div><div class="dl ${d.c}">${plEsc(d.t)}</div>`;
    if (k.spark && dp.dates.length > 1) { const ser = dp.dates.slice(-14).map(pd => { const s = dp.map.get(pd); try { return k.f(dpFilteredFor(s, s.days)); } catch (e) { return null; } }); el.appendChild(plcSpark(ser, T.act, 120, 26)); }
    host.appendChild(el);
  });
}
function dpRenderBand() {
  if (!dp.cur) return; const v = dp.view, s = dp.cur, filt = dp.conds.length || dp.q.length;
  PLQ('#dpBandDate').textContent = s.days.map(dpDayLbl).join(' · ') + (dp.scope !== 'all' ? ' — showing ' + dpDayLbl(dp.scope) : '') + (filt ? ' · filtered' : '');
  PLQ('#dpHero').textContent = plF(plSum(v, 'pal_TOT'), 1); PLQ('#dpHeroSub').textContent = `pallets · ${plF(plSum(v, 'crt_TOT'))} crates · ${plF(plSum(v, 'ltr_TOT'))} litres · ${plF(plSum(v, 'bat_TOT'), 1)} batches`;
  const t = plSum(v, 'pal_TOT'), ne = t ? plSum(v, 'pal_NE') / t : 0, T = plT(); PLQ('#dpSplitFill').style.width = (ne * 100) + '%'; PLQ('#dpSplitFill').style.background = T.series[2]; PLQ('#dpSplitBar').style.background = T.series[3];
  PLQ('#dpSplitTxt').textContent = t ? `NE ${plP(ne, 0)} (${plF(plSum(v, 'pal_NE'), 1)}) · SE ${plP(1 - ne, 0)} (${plF(plSum(v, 'pal_SE'), 1)}) pallets` : '';
  const tabs = PLQ('#dpDayTabs'), sig = s.planDate + '|' + dp.scope; if (tabs.dataset.sig !== sig) { tabs.dataset.sig = sig; tabs.innerHTML = [['all', 'All days']].concat(s.days.map(d => [d, dpDayLong(d)])).map(x => `<button type="button" data-s="${plEsc(x[0])}" class="${x[0] === dp.scope ? 'on' : ''}">${plEsc(x[1])}</button>`).join(''); }
  const sel = PLQ('#dpSnapSel'); if (sel.dataset.sig !== dp.dates.join(',') + '|' + dp.date) { sel.dataset.sig = dp.dates.join(',') + '|' + dp.date; sel.innerHTML = dp.dates.slice().reverse().map(d => `<option value="${d}" ${d === dp.date ? 'selected' : ''}>Plan ${d}</option>`).join(''); }
  const i = dp.dates.indexOf(dp.date); PLQ('#dpPrevBtn').disabled = i <= 0; PLQ('#dpNextBtn').disabled = i >= dp.dates.length - 1;
}


/* ============================================================
   DAILY PLAN — chart cards
   ============================================================ */
const dpMetOptsMain = () => DP_METS.slice();
const dpDayColor = (T, i) => T.series[i % 8], dpRegCol = (T, r) => r === 'NE' ? T.series[2] : T.series[3];
const dpSelDays = () => dp.days;
const dpLocs = () => dp.cur.locs;
const dpTipL = (T, rows) => rows;

DP_DEFS.push({ id: 'loc', title: 'Requirement by location', sub: 'Each delivery location, split by plan day when all days are shown', span: 's7',
  ctl: [{ id: 'm', label: 'measure', opts: dpMetOptsMain, def: 'pal' }],
  draw(host, c) {
    const T = c.T, m = c.ctl.m || 'pal', f = dpMetFmt(m), days = dp.days, locs = dpLocs(), multi = days.length > 1;
    const cats = locs.map((l, j) => { const vals = multi ? days.map(d => c.rows.reduce((t, o) => t + dpDayVal(o, m, d, j), 0)) : [plSum(c.rows, m + '_' + l)], tot = vals.reduce((a, b) => a + b, 0);
      return { label: l, vals, tot, tip: (multi ? days.map((d, i) => ({ c: dpDayColor(T, i), k: dpDayLong(d), v: f(vals[i]) })) : [{ c: T.act, k: dpMetName(m), v: f(vals[0]) }]).concat(multi ? [{ k: 'Total', v: f(tot) }] : []).concat([{ k: 'Region', v: dpRegions(dp.cur)[l] || '' }]) }; });
    const series = multi ? days.map((d, i) => ({ name: dpDayLong(d), color: dpDayColor(T, i) })) : [{ name: dpMetName(m), color: T.act }];
    plcCols(host, { cats, series, fmt: f, labelFn: (c2, v) => v ? f(v) : '', height: 270 });
    return { legend: multi ? series.map(s => ({ c: s.color, name: s.name })) : null, table: { headers: ['Location'].concat(multi ? days.map(dpDayLong) : [dpMetName(m)], multi ? ['Total'] : []), rows: cats.map(x => [x.label].concat(x.vals.map(v => +v.toFixed(2)), multi ? [+x.tot.toFixed(2)] : [])) } };
  } });
DP_DEFS.push({ id: 'region', title: 'Northern vs Southern split', sub: 'NE = SHJ · RAK · FUJ · DXB · UT   ·   SE = ALN · AUH · TRF', span: 's5',
  ctl: [{ id: 'm', label: 'measure', opts: dpMetOptsMain, def: 'pal' }],
  draw(host, c) {
    const T = c.T, m = c.ctl.m || 'pal', f = dpMetFmt(m), days = dp.days, regs = dpRegions(dp.cur), ne = Object.keys(regs).filter(l => regs[l] === 'NE'), se = Object.keys(regs).filter(l => regs[l] === 'SE');
    c.card.querySelector('.sub').textContent = `NE = ${ne.join(' · ') || '—'}   ·   SE = ${se.join(' · ') || '—'}`;
    const rows = days.map(d => { const j = dp.cur.locs.length, a = c.rows.reduce((t, o) => t + dpDayVal(o, m, d, j), 0), b = c.rows.reduce((t, o) => t + dpDayVal(o, m, d, j + 1), 0); return { label: dpDayLbl(d), vals: [a, b], tip: [{ c: dpRegCol(T, 'NE'), k: 'NE', v: f(a) }, { c: dpRegCol(T, 'SE'), k: 'SE', v: f(b) }, { k: 'Total', v: f(a + b) }, { k: 'NE share', v: (a + b) ? plP(a / (a + b), 0) : '—' }] }; });
    if (days.length > 1) rows.push({ label: 'All days', vals: [plSum(c.rows, m + '_NE'), plSum(c.rows, m + '_SE')], tip: [{ k: 'NE', v: f(plSum(c.rows, m + '_NE')) }, { k: 'SE', v: f(plSum(c.rows, m + '_SE')) }] });
    const sr = [{ name: 'NE', color: dpRegCol(T, 'NE') }, { name: 'SE', color: dpRegCol(T, 'SE') }];
    plcBarsH(host, { rows, series: sr, stacked: true, fmt: f, thick: 22, padR: 70 });
    return { legend: sr.map(s => ({ c: s.color, name: s.name })), table: { headers: ['Day', 'NE', 'SE', 'Total'], rows: rows.map(r => [r.label, +r.vals[0].toFixed(2), +r.vals[1].toFixed(2), +(r.vals[0] + r.vals[1]).toFixed(2)]) } };
  } });
DP_DEFS.push({ id: 'top', title: 'Top SKUs', sub: 'Ranked by the chosen measure', span: 's6',
  ctl: [{ id: 'm', label: 'measure', opts: dpMetOptsMain, def: 'pal' }, { id: 'n', label: 'show', opts: () => [['10', '10'], ['15', '15'], ['25', '25']], def: '15' }],
  draw(host, c) {
    const T = c.T, m = c.ctl.m || 'pal', f = dpMetFmt(m), n = +c.ctl.n || 15, rs = c.rows.filter(o => o[m + '_TOT'] > 0).sort((a, b) => b[m + '_TOT'] - a[m + '_TOT']).slice(0, n);
    if (!rs.length) return plEmpty(host, 'No demand for the current filters.');
    const rows = rs.map(o => ({ label: `${o.code} · ${o.item}`, vals: [o[m + '_TOT']], code: o.code, tip: [{ k: 'Item', v: o.item }, { c: T.act, k: dpMetName(m), v: f(o[m + '_TOT']) }, { k: 'Category', v: o.category }, { k: 'Peak location', v: o._peak }, { k: 'Class', v: o._abc }] }));
    plcBarsH(host, { rows, series: [{ name: dpMetName(m), color: T.act }], fmt: f, tickFmt: plK, thick: 14, labelW: 200, onClick: r => dpRowOpen(r.code) });
    return { table: { headers: ['ICODE', 'Item', dpMetName(m)], rows: rs.map(o => [o.code, o.item, +o[m + '_TOT'].toFixed(2)]) } };
  } });
DP_DEFS.push({ id: 'cat', title: 'Requirement by group', sub: 'Split into NE and SE', span: 's6',
  ctl: [{ id: 'dim', label: 'by', opts: dpDimOpts, def: 'category' }, { id: 'm', label: 'measure', opts: dpMetOptsMain, def: 'pal' }],
  draw(host, c) {
    const T = c.T, m = c.ctl.m || 'pal', dim = c.ctl.dim || 'category', f = dpMetFmt(m), g = dpFold(dpGroup(c.rows, dim), 12, x => plSum(x.rows, m + '_TOT'));
    const rows = g.map(x => ({ label: x.key, key: x.key, other: x.other, vals: [plSum(x.rows, m + '_NE'), plSum(x.rows, m + '_SE')], tip: [{ k: 'SKUs', v: String(x.rows.filter(o => o[m + '_TOT'] > 0).length) }] }));
    rows.forEach(r => { r.tip = [{ c: dpRegCol(T, 'NE'), k: 'NE', v: f(r.vals[0]) }, { c: dpRegCol(T, 'SE'), k: 'SE', v: f(r.vals[1]) }, { k: 'Total', v: f(r.vals[0] + r.vals[1]) }].concat(r.tip); });
    const sr = [{ name: 'NE', color: dpRegCol(T, 'NE') }, { name: 'SE', color: dpRegCol(T, 'SE') }];
    plcBarsH(host, { rows, series: sr, stacked: true, fmt: f, onClick: r => { if (!r.other) dpPick(dim, r.key); }, thick: 16 });
    return { legend: sr.map(s => ({ c: s.color, name: s.name })), table: { headers: [dpLabel(dim), 'NE', 'SE', 'Total'], rows: rows.map(r => [r.label, +r.vals[0].toFixed(2), +r.vals[1].toFixed(2), +(r.vals[0] + r.vals[1]).toFixed(2)]) } };
  } });
DP_DEFS.push({ id: 'heat', title: 'Location heat map', sub: 'Darker = more', span: 's6',
  ctl: [{ id: 'dim', label: 'rows', opts: dpDimOpts, def: 'category' }, { id: 'm', label: 'measure', opts: dpMetOptsMain, def: 'pal' }],
  draw(host, c) {
    const dim = c.ctl.dim || 'category', m = c.ctl.m || 'pal', locs = dpLocs(), g = dpFold(dpGroup(c.rows, dim), 14, x => plSum(x.rows, m + '_TOT')), f = dpMetFmt(m);
    const vals = g.map(x => locs.map(l => plSum(x.rows, m + '_' + l)));
    plcHeat(host, { rows: g.map(x => x.key), cols: locs, vals, fmt: v => m === 'pal' || m === 'bat' ? plF(v, 1) : plK(v), measure: dpMetName(m), onClick: (r) => { const gg = g.find(x => x.key === r); if (gg && !gg.other) dpPick(dim, r); } });
    return { table: { headers: [dpLabel(dim)].concat(locs), rows: g.map((x, i) => [x.key].concat(vals[i].map(v => +v.toFixed(2)))) } };
  } });
DP_DEFS.push({ id: 'batches', title: 'Production batches by SKU', sub: 'Litres ÷ batch size — 1.0 means one full batch', span: 's6',
  ctl: [{ id: 'n', label: 'show', opts: () => [['10', '10'], ['15', '15'], ['25', '25']], def: '15' }],
  draw(host, c) {
    const T = c.T, n = +c.ctl.n || 15, rs = c.rows.filter(o => o.bat_TOT > 0).sort((a, b) => b.bat_TOT - a.bat_TOT).slice(0, n); if (!rs.length) return plEmpty(host, 'No production demand for the current filters.');
    const tot = plSum(c.rows, 'bat_TOT'); c.card.querySelector('.sub').textContent = `${plF(tot, 1)} batches in total · 1.0 = one full batch (litres ÷ batch size)`;
    const rows = rs.map(o => ({ label: `${o.code} · ${o.item}`, vals: [o.bat_TOT], code: o.code, tip: [{ k: 'Item', v: o.item }, { c: T.act, k: 'Batches', v: plF(o.bat_TOT, 2) }, { k: 'Litres', v: plF(o.ltr_TOT) }, { k: 'Batch size', v: plF(o.batchLtr) + ' L' }] }));
    plcBarsH(host, { rows, series: [{ name: 'Batches', color: T.act }], fmt: v => plF(v, 2), tickFmt: v => plF(v, 1), thick: 14, labelW: 200, ref: 1, refLabel: '1 batch', onClick: r => dpRowOpen(r.code) });
    return { table: { headers: ['ICODE', 'Item', 'Litres', 'Batch size (L)', 'Batches'], rows: rs.map(o => [o.code, o.item, +o.ltr_TOT.toFixed(0), o.batchLtr, +o.bat_TOT.toFixed(2)]) } };
  } });
DP_DEFS.push({ id: 'mix', title: 'Mix', sub: '', span: 's4',
  ctl: [{ id: 'dim', label: 'by', opts: dpDimOpts, def: 'palletType' }, { id: 'm', label: 'of', opts: dpMetOptsMain, def: 'pal' }],
  draw(host, c) {
    const T = c.T, dim = c.ctl.dim || 'palletType', m = c.ctl.m || 'pal', f = dpMetFmt(m), g = dpGroup(c.rows, dim).map(x => ({ key: x.key, v: plSum(x.rows, m + '_TOT') })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    if (!g.length) return plEmpty(host); const top = g.slice(0, 6), rest = g.slice(6), sl = top.map((x, i) => ({ label: x.key, value: x.v, color: plEntityColorDp(dim, x.key, i), key: x.key }));
    if (rest.length) sl.push({ label: `Other (${rest.length})`, value: rest.reduce((t, x) => t + x.v, 0), color: T.d ? '#64748b' : '#a19f9d', other: true });
    c.card.querySelector('.sub').textContent = `Share of ${dpMetName(m).toLowerCase()} by ${dpLabel(dim).toLowerCase()}`;
    plcDonut(host, { slices: sl, center: { value: f(sl.reduce((t, s) => t + s.value, 0)), label: dpMetName(m).toLowerCase() }, unit: dpMetName(m), onClick: s => { if (!s.other) dpPick(dim, s.key); } });
    return { table: { headers: [dpLabel(dim), dpMetName(m), 'Share'], rows: g.map(x => [x.key, +x.v.toFixed(2), plP(x.v / g.reduce((t, y) => t + y.v, 0), 1)]) } };
  } });
function plEntityColorDp(dim, key, i) { const all = Array.from(new Set(dp.rows.map(o => o[dim] == null ? '(blank)' : String(o[dim])))).sort((a, b) => a.localeCompare(b)), k = all.indexOf(String(key)), pal = document.body.classList.contains('dark') ? DP_SLOTS.dark : DP_SLOTS.light; return k >= 0 && k < 8 ? pal[k] : pal[i % 8]; }
DP_DEFS.push({ id: 'logi', title: 'Pallet & cage requirement by location', sub: 'As calculated in the file (not affected by the SKU filters)', span: 's8',
  ctl: [{ id: 'm', label: 'show', opts: () => [['pal', 'Pallets / cages'], ['trips', 'Trips']], def: 'pal' }],
  draw(host, c) {
    const T = c.T, lg = dp.cur.sheet && dp.cur.sheet.logi || {}, days = dp.days.filter(d => lg[d]); if (!days.length) return plEmpty(host, 'The file has no “Pallet & Cages / Trips” block for these days.');
    const locs = lg[days[0]].locs, add = k => locs.map((l, i) => days.reduce((t, d) => { const j = lg[d].locs.indexOf(l); return t + (j >= 0 && lg[d][k] ? lg[d][k][j] : 0); }, 0)), trips = c.ctl.m === 'trips';
    const ser = trips ? [{ name: 'P12 trips', k: 'tripsP12', color: T.series[0] }, { name: 'P6 + cages trips', k: 'tripsP6', color: T.series[1] }] : [{ name: 'P12', k: 'P12', color: T.series[0] }, { name: 'P6', k: 'P6', color: T.series[1] }, { name: 'Cages / C1', k: 'C', color: T.series[4] }];
    const data = ser.map(s => add(s.k)), f = v => plF(v, 1), rows = locs.map((l, i) => ({ label: l, vals: data.map(a => a[i]), tip: ser.map((s, k) => ({ c: s.color, k: s.name, v: f(data[k][i]) })).concat([{ k: 'Total', v: f(data.reduce((t, a) => t + a[i], 0)) }]) })).filter(r => r.vals.some(v => v > 0));
    if (!rows.length) return plEmpty(host, 'Nothing to show.');
    plcBarsH(host, { rows, series: ser, stacked: true, fmt: f, thick: 18, padR: 64 });
    return { legend: ser.map(s => ({ c: s.color, name: s.name })), table: { headers: ['Location'].concat(ser.map(s => s.name), ['Total']), rows: rows.map(r => [r.label].concat(r.vals.map(v => +v.toFixed(2)), [+r.vals.reduce((a, b) => a + b, 0).toFixed(2)])) } };
  } });
DP_DEFS.push({ id: 'trips', title: 'Trips per day', sub: 'Trip summary calculated in the file', span: 's6',
  draw(host, c) {
    const T = c.T, sm = dp.cur.sheet && dp.cur.sheet.summary || {}, days = dp.days.filter(d => sm[d]); if (!days.length) return plEmpty(host, 'The file has no trip summary block.');
    const kDD = Object.keys(sm[days[0]]).find(k => /dd/i.test(k)), kNo = Object.keys(sm[days[0]]).find(k => /normal|trailer/i.test(k)), kTot = Object.keys(sm[days[0]]).find(k => /grand|total/i.test(k));
    const rows = days.map(d => ({ label: dpDayLbl(d), vals: [kDD ? sm[d][kDD] || 0 : 0, kNo ? sm[d][kNo] || 0 : 0], tip: Object.keys(sm[d]).map(k => ({ k, v: plF(sm[d][k], 2) })) })), sr = [{ name: (kDD || 'DD trips').trim(), color: T.series[0] }, { name: (kNo || 'Normal trailer').trim(), color: T.series[1] }];
    c.card.querySelector('.sub').textContent = kTot ? 'Grand total: ' + days.map(d => `${dpDayLbl(d)} ${plF(sm[d][kTot], 1)}`).join(' · ') : '';
    plcBarsH(host, { rows, series: sr, stacked: true, fmt: v => plF(v, 1), thick: 22, padR: 60 });
    return { legend: sr.map(s => ({ c: s.color, name: s.name })), table: { headers: ['Day'].concat(Object.keys(sm[days[0]])), rows: days.map(d => [dpDayLong(d)].concat(Object.keys(sm[days[0]]).map(k => sm[d][k] == null ? '' : +sm[d][k].toFixed(2)))) } };
  } });
DP_DEFS.push({ id: 'abc', title: 'Volume concentration (ABC)', sub: '', span: 's6',
  ctl: [{ id: 'm', label: 'of', opts: dpMetOptsMain, def: 'pal' }],
  draw(host, c) {
    const T = c.T, m = c.ctl.m || 'pal', rs = c.rows.filter(o => o[m + '_TOT'] > 0).sort((a, b) => b[m + '_TOT'] - a[m + '_TOT']), tot = rs.reduce((t, o) => t + o[m + '_TOT'], 0); if (!tot) return plEmpty(host);
    let acc = 0; const cum = rs.map(o => { acc += o[m + '_TOT']; return acc / tot; }), a = cum.findIndex(v => v >= 0.8) + 1;
    c.card.querySelector('.sub').textContent = `${a} of ${rs.length} SKUs make 80% of the ${dpMetName(m).toLowerCase()} (class A).`;
    plcLine(host, { x: rs.map((o, i) => String(i + 1)), series: [{ name: 'Cumulative share', color: T.act, vals: cum }], fmt: v => plP(v, 0), tickFmt: v => plP(v, 0), ref: 0.8, refLabel: '80%', zero: true, height: 230, area: true });
    return { table: { headers: ['Rank', 'ICODE', 'Item', dpMetName(m), 'Cumulative %'], rows: rs.map((o, i) => [i + 1, o.code, o.item, +o[m + '_TOT'].toFixed(2), plP(cum[i], 1)]) } };
  } });
DP_DEFS.push({ id: 'trend', title: 'Trend across uploaded plans', sub: '', span: 's6',
  ctl: [{ id: 'm', label: 'measure', opts: () => [['pal', 'Pallets'], ['crt', 'Crates'], ['ltr', 'Litres'], ['bat', 'Production batches'], ['sku', 'SKUs with demand']], def: 'pal' }],
  draw(host, c) {
    const m = c.ctl.m || 'pal', ds = dp.dates.slice(-30); c.card.querySelector('.sub').textContent = `Whole plan (all days) on each upload — same filters`;
    if (ds.length < 2) return plEmpty(host, 'Upload a plan on more than one day to see the trend — every upload is kept.');
    const vals = ds.map(d => { const s = dp.map.get(d), r = dpFilteredFor(s, s.days); return m === 'sku' ? r.filter(o => o.dem_TOT > 0).length : plSum(r, m + '_TOT'); });
    plcLine(host, { x: ds.map(d => d.slice(5)), series: [{ name: m, color: c.T.act, vals }], fmt: v => plF(v, m === 'pal' || m === 'bat' ? 1 : 0), height: 230, area: true, zero: true });
    return { table: { headers: ['Plan date', 'Value'], rows: ds.map((d, i) => [d, +vals[i].toFixed(2)]) } };
  } });
DP_DEFS.push({ id: 'changes', title: 'Biggest changes vs the previous upload', sub: '', span: 's6',
  ctl: [{ id: 'm', label: 'measure', opts: dpMetOptsMain, def: 'pal' }],
  draw(host, c) {
    const m = c.ctl.m || 'pal', f = dpMetFmt(m); if (!dp.prev) return plEmpty(host, 'Needs an earlier upload to compare with.');
    const inter = dp.days.filter(d => dp.prev.days.includes(d)); if (!inter.length) return plEmpty(host, 'The previous plan has no day in common with this view.');
    const pm = new Map(dpObjs(dp.prev, inter).map(o => [o.code, o])), cur = dpObjs(dp.cur, inter), keep = new Set(c.rows.map(o => o.code));
    c.card.querySelector('.sub').textContent = `${dpDayLbl(inter[0])}${inter.length > 1 ? '–' + dpDayLbl(inter[inter.length - 1]) : ''}: plan ${dp.cur.planDate} vs plan ${dp.prev.planDate} (matched by ICODE)`;
    const d = cur.filter(o => keep.has(o.code)).map(o => { const p = pm.get(o.code), pv = p ? p[m + '_TOT'] : 0; return { o, v: o[m + '_TOT'] - pv, prev: pv }; }).filter(x => Math.abs(x.v) > 1e-9);
    const up = d.filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 7), dn = d.filter(x => x.v < 0).sort((a, b) => a.v - b.v).slice(0, 7), all = up.concat(dn).sort((a, b) => b.v - a.v);
    plcDiv(host, { rows: all.map(x => ({ label: `${x.o.code} · ${x.o.item}`, v: x.v, tip: [{ k: 'Now', v: f(x.o[m + '_TOT']) }, { k: 'Previous plan', v: f(x.prev) }, { k: 'Change', v: f(x.v) }], click: () => dpRowOpen(x.o.code) })), empty: 'No change between the two plans.' });
    return { legend: [{ c: c.T.pos, name: 'Increase' }, { c: c.T.neg, name: 'Decrease' }], table: { headers: ['ICODE', 'Item', 'Previous', 'Now', 'Change'], rows: d.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).map(x => [x.o.code, x.o.item, +x.prev.toFixed(2), +x.o[m + '_TOT'].toFixed(2), +x.v.toFixed(2)]) } };
  } });
['analysis', 'profile'].forEach(id => { const i = DP_DEFS.findIndex(d => d.id === id); if (i >= 0) DP_DEFS.push(DP_DEFS.splice(i, 1)[0]); });


