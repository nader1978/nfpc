/* ============================================================
   LIST ANALYTICS — a self-adapting dashboard for any list downloaded from Data Download
   ============================================================ */
const LA_KEY = LS_BASE + '_la_data', LA_PRE = LS_BASE + '_la_presets', LA_CTL = LS_BASE + '_la_ctl';
const la = { name: '', cols: [], rows: [], view: [], dimSel: {}, conds: [], q: '', hidden: new Set(), sort: null, shown: 200, uid: 0, inited: false };
const laC = k => la.cols.find(c => c.key === k);
const laEsc = plEsc;
const LA_META = /^(📎|content type|version|attachments|item child count|folder child count|compliance asset id|app created by|app modified by|edit|type|path|item type|id)$/i;
const LA_SYS = /^(📎|content type|version|attachments|item child count|folder child count)$/i;
const LA_CODEHINT = /(id|nr|no|number|reading|odo|latitude|longitude|lat|lng|lon|crdnts|code|record|uid|guid|file|link|version)$/i;
const LA_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ---------- value parsing ---------- */
function laParseDate(v) {
  if (v instanceof Date) return isNaN(v) ? null : v.getTime();
  if (typeof v !== 'string') return null; const s = v.trim(); if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (m) { const t = new Date(s.length === 10 ? s + 'T00:00:00' : s).getTime(); return isNaN(t) ? null : t; }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i.exec(s);
  if (m) { let h = +(m[4] || 0); if (m[7]) { h = h % 12 + (/pm/i.test(m[7]) ? 12 : 0); } const t = new Date(+m[3], +m[2] - 1, +m[1], h, +(m[5] || 0), +(m[6] || 0)).getTime(); return isNaN(t) ? null : t; }
  if (/^[A-Za-z]{3,9}\.? \d{1,2}, \d{4}/.test(s)) { const t = new Date(s).getTime(); return isNaN(t) ? null : t; }
  return null;
}
const laParseDur = v => { if (typeof v !== 'string') return null; const m = /^(\d+):(\d{2}):(\d{2})$/.exec(v.trim()); return m ? +m[1] * 60 + +m[2] + +m[3] / 60 : null; };
function laCell(v) { if (v == null) return null; if (v instanceof Date) return v; if (typeof v === 'object') return xlCell(v); if (typeof v === 'string') { const t = v.trim(); return t === '' ? null : t; } return v; }

/* ---------- column typing ---------- */
function laInfer(key, raw) {
  const nn = raw.filter(v => v != null), n = raw.length, label = key, o = { key, label, type: 'text', n: nn.length, uniq: 0, hidden: false };
  const U = new Set(nn.map(String)); o.uniq = U.size;
  if (!nn.length || (U.size <= 1 && n > 5)) { o.hidden = true; o.type = nn.length ? 'cat' : 'text'; if (!nn.length) return { o, vals: raw }; }
  if (LA_META.test(key) && U.size <= 1) o.hidden = true;
  const frac = f => nn.length && nn.filter(f).length / nn.length >= 0.9;
  const asDate = nn.map(v => (typeof v === 'number' ? null : laParseDate(v)));
  if (frac(v => typeof v === 'boolean' || /^(true|false)$/i.test(String(v)))) { o.type = 'cat'; o.bool = true; return { o, vals: raw.map(v => v == null ? null : (String(v).toLowerCase() === 'true' ? 'Yes' : 'No')) }; }
  if (nn.length && nn.filter((v, i) => asDate[i] != null).length / nn.length >= 0.9) {
    o.type = 'date'; const vals = raw.map(v => v == null ? null : laParseDate(v)); const tod = new Set(vals.filter(x => x != null).map(t => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); })); o.dateOnly = tod.size <= 1; return { o, vals };
  }
  if (frac(v => laParseDur(v) != null)) { o.type = 'num'; o.unit = 'min'; o.label = key + ' (min)'; return { o, vals: raw.map(v => v == null ? null : laParseDur(String(v))) }; }
  if (frac(v => typeof v === 'number' || (typeof v === 'string' && v !== '' && isFinite(Number(v))))) {
    const vals = raw.map(v => v == null ? null : (typeof v === 'number' ? v : (isFinite(Number(v)) ? Number(v) : null))), nums = vals.filter(x => x != null);
    const allInt = nums.every(x => Number.isInteger(x));
    if (LA_CODEHINT.test(key) || (allInt && U.size === nums.length && nums.length >= 10 && !/qty|plt|km|hour|amount|total|count/i.test(key))) { o.type = 'code'; return { o, vals: raw.map(v => v == null ? null : String(v)) }; }
    o.type = 'num'; return { o, vals };
  }
  const strs = raw.map(v => v == null ? null : String(v));
  if (U.size <= 60 && (U.size <= Math.max(12, n * 0.6))) { o.type = 'cat'; return { o, vals: strs }; }
  o.type = 'text'; return { o, vals: strs };
}
function laLoad(headers, rowsArr, name, opts) {
  opts = opts || {}; const cols = [], data = rowsArr.map(() => ({})); const seen = {};
  headers.forEach((h0, j) => {
    let h = String(h0 == null ? '' : h0).trim() || 'Column ' + (j + 1); seen[h] = (seen[h] || 0) + 1; if (seen[h] > 1) h += ' (' + seen[h] + ')';
    const raw = rowsArr.map(r => laCell(Array.isArray(r) ? r[j] : r[h0])); const { o, vals } = laInfer(h, raw); if (opts.names && opts.names[j]) o.label = opts.names[j] + (o.unit ? ' (' + o.unit + ')' : '');
    cols.push(o); vals.forEach((v, i) => { data[i][h] = v; });
  });
  la.name = name || 'List'; la.cols = cols; la.rows = data.map((r, i) => (r._i = i, r)); la.conds = []; la.dimSel = {}; la.q = ''; la.sort = null; la.shown = 200;
  la.hidden = new Set(cols.filter(c => c.hidden || LA_SYS.test(c.key)).map(c => c.key)); la.dims = null;
  laSave(); laRefresh({ full: true });
}
function laSave() {
  try { const s = JSON.stringify({ name: la.name, cols: la.cols, rows: la.rows, hidden: [...la.hidden] }); if (s.length > 4.5e6) { localStorage.removeItem(LA_KEY); sectionToast('List is large — kept for this session only.', 'info'); return; } localStorage.setItem(LA_KEY, s); } catch (e) {}
}
function laRestore() { try { const d = JSON.parse(localStorage.getItem(LA_KEY) || 'null'); if (d && d.rows && d.cols) { la.name = d.name; la.cols = d.cols; la.rows = d.rows; la.hidden = new Set(d.hidden || []); return true; } } catch (e) {} return false; }

/* ---------- derived structure ---------- */
const laDimCols = () => la.cols.filter(c => (c.type === 'cat' || (c.type === 'code' && c.uniq <= 60) || (c.type === 'text' && c.uniq <= 60)) && !c.hidden);
const laNumCols = () => la.cols.filter(c => c.type === 'num' && !c.hidden && c.uniq > 1);
const laDateCols = () => la.cols.filter(c => c.type === 'date' && !c.hidden);
const laAnyCols = () => la.cols.filter(c => c.type !== 'text' || c.uniq <= 60);
function laScore(c) { const u = c.uniq; let s = u >= 2 && u <= 12 ? 100 - u : u <= 25 ? 60 - u : 20 - u / 10; if (/status|type|category|brand|dept|source|location|route|region|class|state|shift|role/i.test(c.key)) s += 40; if (c.type === 'code') s -= 25; if (c.n < la.rows.length * 0.5) s -= 30; return s; }
const laTopDims = () => laDimCols().sort((a, b) => laScore(b) - laScore(a));
function laShownDims() { if (!la.dims) la.dims = laTopDims().slice(0, 6).map(c => c.key); return la.dims.map(laC).filter(Boolean); }
const laFmtV = (c, v) => v == null ? '' : c.type === 'date' ? laDateStr(v, c.dateOnly) : c.type === 'num' ? (c.unit === 'min' ? laDur(v) : plF(v, Math.abs(v) < 100 && v % 1 ? 2 : 0)) : String(v);
const laDateStr = (t, only) => { const d = new Date(t), p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` + (only ? '' : ` ${p(d.getHours())}:${p(d.getMinutes())}`); };
const laDur = m => { const h = Math.floor(m / 60), mm = Math.round(m % 60); return `${h}:${String(mm).padStart(2, '0')}`; };

/* ---------- filtering ---------- */
function laMatch(o, c) {
  const v = o[c.key], col = laC(c.key); if (!col) return true;
  if (c.op === 'in') return c.vals.includes(v == null ? '(blank)' : String(v)) || (col.type === 'date' && c.vals.includes(laDateStr(v, col.dateOnly)));
  if (c.op === 'contains') return v != null && String(laFmtV(col, v)).toLowerCase().includes(c.text.toLowerCase());
  if (c.op === 'range') { if (typeof v !== 'number') return false; return (c.min == null || v >= c.min) && (c.max == null || v <= c.max); }
  if (c.op === 'drange') { if (v == null) return false; return (c.from == null || v >= c.from) && (c.to == null || v < c.to); }
  return true;
}
const laSearchOk = (o, q) => { if (!q) return true; const t = q.toLowerCase().split(/\s+/).filter(Boolean); const s = la._txt ? (la._txt.get(o) || '') : ''; return t.every(w => s.includes(w)); };
function laBuildText() { la._txt = new Map(); la.rows.forEach(o => { la._txt.set(o, la.cols.filter(c => !la.hidden.has(c.key) || true).map(c => laFmtV(c, o[c.key])).join(' ').toLowerCase()); }); }
function laFilter(rows, skip) {
  return rows.filter(o => laSearchOk(o, la.q) && Object.entries(la.dimSel).every(([k, vals]) => k === skip || !vals.length || vals.includes(o[k] == null ? '(blank)' : String(o[k]))) && la.conds.every(c => laMatch(o, c)));
}
function laPick(key, val) { const col = laC(key); if (!col || col.type === 'num') return; if (la.dims && la.dims.includes(key)) { la.dimSel[key] = [String(val)]; } else la.conds.push({ id: ++la.uid, key, op: 'in', vals: [String(val)] }); laRefresh(); }

/* ---------- aggregation ---------- */
function laMeasures() { const out = [['#', 'Records']]; laNumCols().forEach(c => { out.push(['sum:' + c.key, 'Sum · ' + c.label]); out.push(['avg:' + c.key, 'Average · ' + c.label]); out.push(['max:' + c.key, 'Max · ' + c.label]); }); laDimCols().slice(0, 40).forEach(c => out.push(['dc:' + c.key, 'Distinct · ' + c.key])); return out; }
function laMeasure(m) {
  if (!m || m === '#') return { label: 'Records', fn: rs => rs.length };
  const [k, key] = [m.slice(0, m.indexOf(':')), m.slice(m.indexOf(':') + 1)], c = laC(key); if (!c) return { label: 'Records', fn: rs => rs.length };
  if (k === 'dc') return { label: 'Distinct ' + key, fn: rs => new Set(rs.map(o => o[key]).filter(v => v != null)).size };
  const nums = rs => rs.map(o => o[key]).filter(v => typeof v === 'number');
  if (k === 'sum') return { label: 'Sum of ' + c.label, fn: rs => nums(rs).reduce((a, b) => a + b, 0), c };
  if (k === 'avg') return { label: 'Average ' + c.label, fn: rs => { const n = nums(rs); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0; }, c, avg: true };
  return { label: 'Max ' + c.label, fn: rs => { const n = nums(rs); return n.length ? Math.max.apply(null, n) : 0; }, c };
}
const laMFmt = M => v => M.c && M.c.unit === 'min' ? laDur(v) : plF(v, M.avg || Math.abs(v) < 100 && v % 1 ? 1 : 0);
function laGroup(rows, key) { const g = new Map(); rows.forEach(o => { const k = o[key] == null ? '(blank)' : laFmtV(laC(key), o[key]); if (!g.has(k)) g.set(k, []); g.get(k).push(o); }); return [...g.entries()].map(([k, rs]) => ({ key: k, rows: rs })); }
function laBucket(t, b) { const d = new Date(t), p = x => String(x).padStart(2, '0'); if (b === 'month') return { k: `${d.getFullYear()}-${p(d.getMonth() + 1)}`, s: d.getFullYear() * 12 + d.getMonth() }; if (b === 'week') { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); return { k: `${m.getFullYear()}-${p(m.getMonth() + 1)}-${p(m.getDate())}`, s: m.getTime() }; } if (b === 'hour') return { k: p(d.getHours()) + ':00', s: d.getHours() }; if (b === 'weekday') return { k: LA_DAYS[d.getDay()], s: (d.getDay() + 6) % 7 }; return { k: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, s: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }; }

/* ---------- KPIs & band ---------- */
function laKpis() {
  const el = PLQ('#laKpis'); if (!el) return; const V = la.view, K = (l, v, s, f) => `<div class="pl-kpi${f ? ' click' : ''}" ${f ? `data-f="${laEsc(f)}"` : ''}><div class="lbl">${laEsc(l)}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`; let h = K('Records', plF(V.length), `of ${plF(la.rows.length)} in the list`);
  const ent = laDimCols().filter(c => c.uniq >= 5 && c.uniq < la.rows.length).sort((a, b) => (/user|driver|name|customer|item|sku|trailer|unit|vehicle|staff/i.test(b.key) - /user|driver|name|customer|item|sku|trailer|unit|vehicle|staff/i.test(a.key)) || laScore(b) - laScore(a))[0];
  if (ent) { const d = new Set(V.map(o => o[ent.key]).filter(v => v != null)).size; h += K('Distinct ' + ent.key.replace(/_/g, ' '), plF(d), `${V.length ? plF(V.length / Math.max(1, d), 1) : '—'} records each`); }
  laNumCols().slice(0, 3).forEach(c => { const n = V.map(o => o[c.key]).filter(x => typeof x === 'number'), s = n.reduce((a, b) => a + b, 0), f = x => c.unit === 'min' ? laDur(x) : plF(x, Math.abs(x) < 100 && x % 1 ? 1 : 0); h += K(c.label.replace(/_/g, ' '), f(s), `avg ${f(n.length ? s / n.length : 0)} · ${plF(n.length)} filled`); });
  const d1 = laShownDims()[0]; if (d1 && V.length) { const g = laGroup(V, d1.key).sort((a, b) => b.rows.length - a.rows.length)[0]; if (g) h += K(d1.key.replace(/_/g, ' ') + ' · top', laEsc(g.key), `${plF(g.rows.length)} · ${plP(g.rows.length / V.length, 0)}`); }
  el.innerHTML = h;
}
function laBand() {
  PLQ('#laSrc').textContent = la.name; PLQ('#laHero').textContent = plF(la.view.length) + ' records'; PLQ('#laHeroSub').textContent = `${plF(la.rows.length)} rows · ${la.cols.length} columns · ${laDimCols().length} categories · ${laNumCols().length} numeric · ${laDateCols().length} date`;
  const dc = laDateCols()[0]; if (dc) { const t = la.view.map(o => o[dc.key]).filter(x => x != null); if (t.length) { const a = Math.min.apply(null, t), b = Math.max.apply(null, t); PLQ('#laPeriod').textContent = laDateStr(a, dc.dateOnly) + (a === b ? '' : ' → ' + laDateStr(b, dc.dateOnly)); PLQ('#laPeriodSub').textContent = dc.key; return; } } PLQ('#laPeriod').textContent = '—'; PLQ('#laPeriodSub').textContent = 'no date column';
}

/* ---------- filter bar ---------- */
function laRenderDims() {
  const host = PLQ('#laDimHost'); const sig = laShownDims().map(c => c.key + ':' + (la.dimSel[c.key] || []).join('|')).join('~') + '#' + la.rows.length; host.innerHTML = '';
  laShownDims().forEach(c => {
    const d = document.createElement('div'); d.className = 'pl-dim'; d.innerHTML = `<label title="${laEsc(c.key)}">${laEsc(c.key.replace(/_/g, ' '))}</label>`;
    const base = laFilter(la.rows, c.key), opts = [...new Set(base.map(o => o[c.key] == null ? '(blank)' : String(o[c.key])))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    d.appendChild(buildMultiCombo(la.dimSel[c.key] || [], opts, arr => { la.dimSel[c.key] = arr; laRefresh({ except: c.key }); }, { placeholder: 'All' })); host.appendChild(d);
  });
}
function laActive() {
  const host = PLQ('#laActive'); const chips = []; Object.entries(la.dimSel).forEach(([k, v]) => { if (v.length) chips.push({ k, txt: v.length > 2 ? `${v.length} selected` : v.join(', '), dim: true }); });
  la.conds.forEach(c => { const col = laC(c.key); chips.push({ id: c.id, k: c.key, txt: c.op === 'in' ? (c.vals.length > 2 ? `${c.vals.length} selected` : c.vals.join(', ')) : c.op === 'contains' ? `contains “${c.text}”` : c.op === 'range' ? `${c.min != null ? c.min : '…'} – ${c.max != null ? c.max : '…'}` : `${c.from != null ? laDateStr(c.from, true) : '…'} → ${c.to != null ? laDateStr(c.to - 1, true) : '…'}` }); });
  if (la.q) chips.unshift({ k: 'Search', txt: la.q, search: true });
  host.innerHTML = chips.map((c, i) => `<span class="pl-chip" data-i="${i}"><b>${laEsc(c.k)}</b> = ${laEsc(c.txt)}<button type="button" title="Remove">✕</button></span>`).join('');
  host.querySelectorAll('.pl-chip button').forEach((b, i) => b.addEventListener('click', () => { const c = chips[i]; if (c.search) { la.q = ''; const inp = PLQ('#laSearchHost input'); if (inp) inp.value = ''; } else if (c.dim) la.dimSel[c.k] = []; else la.conds = la.conds.filter(x => x.id !== c.id); laRefresh(); }));
}
function laAddFilterPop() {
  const old = PLQ('#laPop'); if (old) { old.remove(); return; } const host = PLQ('#laFilters'), btn = PLQ('#laAddFilterBtn'); host.style.position = 'relative';
  const pop = document.createElement('div'); pop.id = 'laPop'; pop.className = 'pl-pop'; pop.style.left = Math.max(0, btn.offsetLeft - 20) + 'px'; pop.style.top = (btn.offsetTop + btn.offsetHeight + 6) + 'px';
  const groups = { Category: la.cols.filter(c => c.type === 'cat'), Code: la.cols.filter(c => c.type === 'code'), Text: la.cols.filter(c => c.type === 'text'), Number: la.cols.filter(c => c.type === 'num'), Date: la.cols.filter(c => c.type === 'date') };
  pop.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-weight:700;">Filter on any column</span><span class="btn-row" style="margin:0;"><button id="laPopOk" class="small" type="button">Add filter</button><button id="laPopX" class="ghost small" type="button">Cancel</button></span></div><select id="laPopCol" style="margin:0 0 8px;">${Object.entries(groups).filter(([, a]) => a.length).map(([g, a]) => `<optgroup label="${g}">${a.map(c => `<option value="${laEsc(c.key)}">${laEsc(c.key)}</option>`).join('')}</optgroup>`).join('')}</select><div id="laPopBody"></div>`;
  host.appendChild(pop); let picked = [];
  const draw = () => { const k = PLQ('#laPopCol').value, c = laC(k), b = PLQ('#laPopBody'); picked = []; if (!c) return;
    if (c.type === 'num') { const v = la.rows.map(o => o[k]).filter(x => typeof x === 'number'); b.innerHTML = `<div class="text-sm" style="color:var(--gray-600);margin-bottom:4px;">Values range from ${plF(Math.min.apply(null, v), 1)} to ${plF(Math.max.apply(null, v), 1)}</div><div class="btn-row"><input type="number" step="any" id="laPopMin" placeholder="min" style="max-width:120px;margin:0"><span>to</span><input type="number" step="any" id="laPopMax" placeholder="max" style="max-width:120px;margin:0"></div>`; }
    else if (c.type === 'date') b.innerHTML = `<div class="btn-row"><input type="date" id="laPopFrom" style="max-width:150px;margin:0"><span>to</span><input type="date" id="laPopTo" style="max-width:150px;margin:0"></div>`;
    else { const opts = [...new Set(la.rows.map(o => o[k] == null ? '(blank)' : String(o[k])))].sort((a, b2) => a.localeCompare(b2, undefined, { numeric: true })).slice(0, 3000); b.innerHTML = '<label class="text-sm">Pick values (any match)</label><div id="laPopVals"></div><label class="text-sm" style="margin-top:6px;display:block;">…or text contains</label><input type="text" id="laPopTxt" placeholder="e.g. 180" />'; PLQ('#laPopVals').appendChild(buildMultiCombo([], opts, arr => { picked = arr; }, { placeholder: 'Type to search…' })); } };
  PLQ('#laPopCol').addEventListener('change', draw); draw(); PLQ('#laPopX').addEventListener('click', () => pop.remove());
  PLQ('#laPopOk').addEventListener('click', () => { const k = PLQ('#laPopCol').value, c = laC(k); if (!c) return;
    if (c.type === 'num') { const mn = PLQ('#laPopMin').value, mx = PLQ('#laPopMax').value; if (mn === '' && mx === '') return; la.conds.push({ id: ++la.uid, key: k, op: 'range', min: mn === '' ? null : +mn, max: mx === '' ? null : +mx }); }
    else if (c.type === 'date') { const f = PLQ('#laPopFrom').value, t = PLQ('#laPopTo').value; if (!f && !t) return; la.conds.push({ id: ++la.uid, key: k, op: 'drange', from: f ? new Date(f + 'T00:00:00').getTime() : null, to: t ? new Date(t + 'T00:00:00').getTime() + 864e5 : null }); }
    else { const t = (PLQ('#laPopTxt').value || '').trim(); if (picked.length) la.conds.push({ id: ++la.uid, key: k, op: 'in', vals: picked.slice() }); else if (t) la.conds.push({ id: ++la.uid, key: k, op: 'contains', text: t }); else return; }
    pop.remove(); laRefresh(); });
}
const laPresets = () => { try { return JSON.parse(localStorage.getItem(LA_PRE) || '[]'); } catch (e) { return []; } };
function laPresetFill() { PLQ('#laPresetSel').innerHTML = '<option value="">★ Saved filter sets…</option>' + laPresets().map((p, i) => `<option value="${i}">${laEsc(p.name)}</option>`).join(''); }

/* ---------- chart cards ---------- */
const laCtlAll = () => { try { return JSON.parse(localStorage.getItem(LA_CTL) || '{}'); } catch (e) { return {}; } };
const laCtlGet = (card, id, def) => { const v = (laCtlAll()[card] || {})[id]; return v == null ? def : v; };
const laCtlSet = (card, id, v) => { const a = laCtlAll(); (a[card] = a[card] || {})[id] = v; try { localStorage.setItem(LA_CTL, JSON.stringify(a)); } catch (e) {} };
const LA_DEFS = [];
const laDimOpts = () => laDimCols().map(c => [c.key, c.key.replace(/_/g, ' ')]);
const laNumOpts = () => laNumCols().map(c => [c.key, c.label.replace(/_/g, ' ')]);
const laDateOpts = () => laDateCols().map(c => [c.key, c.key.replace(/_/g, ' ')]);
const laMeasOpts = () => laMeasures().map(m => [m[0], m[1].replace(/_/g, ' ')]);
const laPool = (lo, hi) => { const a = laTopDims().filter(c => c.uniq >= lo && c.uniq <= hi && c.type !== 'code' && c.n >= la.rows.length * 0.5); return a.length ? a : laTopDims(); };
const laDimDef = (n, lo, hi) => () => { const a = laPool(lo == null ? 4 : lo, hi == null ? 30 : hi), d = a[n] || a[0]; return d ? d.key : ''; };
function laFold(groups, n, val) { groups.sort((a, b) => val(b) - val(a)); if (groups.length <= n) return groups; const keep = groups.slice(0, n - 1), rest = groups.slice(n - 1); keep.push({ key: `Other (${rest.length})`, rows: rest.flatMap(g => g.rows), other: true }); return keep; }
function laCardBuild(def) {
  const card = document.createElement('div'); card.className = 'pl-card ' + (def.span || 's6'); card.dataset.id = def.id;
  card.innerHTML = `<div class="pl-ch"><h3>${laEsc(def.title)}</h3><span class="ctls"></span><button class="pl-ib" data-a="ren" title="Rename this chart and its table">✎ Rename</button><button class="pl-ib" data-a="tbl" title="Table view of the same data">▦ Table</button><button class="pl-ib" data-a="png" title="Download as picture">⬇ PNG</button><button class="pl-ib" data-a="full" title="Full screen">⤢</button><div class="sub">${laEsc(def.sub || '')}</div></div><div class="pl-lgh"></div><div class="pl-body"></div><div class="pl-tbl-wrap" style="display:none"></div>`;
  card.querySelector('h3').title = 'Double-click to rename'; card.querySelector('h3').addEventListener('dblclick', () => laRename(def, card));
  const ctls = card.querySelector('.ctls');
  (def.ctl || []).forEach(c => { const lab = document.createElement('label'); lab.textContent = c.label + ' '; const sel = document.createElement('select'); sel.dataset.c = c.id; lab.appendChild(sel); ctls.appendChild(lab); sel.addEventListener('change', () => { laCtlSet(def.id, c.id, sel.value); laCardDraw(def, card); }); });
  card.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'ren') laRename(def, card);
    else if (a === 'tbl') { const on = card.dataset.tbl !== '1'; card.dataset.tbl = on ? '1' : ''; b.classList.toggle('on', on); b.textContent = on ? '▦ Chart' : '▦ Table'; card.querySelector('.pl-body').style.display = on ? 'none' : ''; card.querySelector('.pl-lgh').style.display = on ? 'none' : ''; card.querySelector('.pl-tbl-wrap').style.display = on ? '' : 'none'; }
    else if (a === 'png') { const svg = card.querySelector('.pl-body svg'); if (svg) plSvgToPng(svg, 'list_' + ((card.querySelector('h3').textContent || def.id).replace(/[^A-Za-z0-9]+/g, '_').slice(0, 50))); else sectionToast('Nothing to export in this card.', 'warn'); }
    else if (a === 'full') { const on = !card.classList.contains('pl-full'); card.classList.toggle('pl-full', on); b.textContent = on ? '✕' : '⤢'; setTimeout(() => laCardDraw(def, card), 30); } });
  return card;
}
function laCardDraw(def, card) {
  const body = card.querySelector('.pl-body'), lg = card.querySelector('.pl-lgh'), tw = card.querySelector('.pl-tbl-wrap');
  (def.ctl || []).forEach(c => { const sel = card.querySelector(`select[data-c="${c.id}"]`), opts = c.opts(); const dv = typeof c.def === 'function' ? c.def() : c.def, cur = laCtlGet(def.id, c.id, dv), valid = opts.some(o => String(o[0]) === String(cur)); sel.innerHTML = opts.map(o => `<option value="${laEsc(o[0])}" ${String(o[0]) === String(valid ? cur : (opts.some(x => String(x[0]) === String(dv)) ? dv : (opts[0] && opts[0][0]))) ? 'selected' : ''}>${laEsc(o[1])}</option>`).join(''); });
  const ctl = {}; (def.ctl || []).forEach(c => { const sel = card.querySelector(`select[data-c="${c.id}"]`); ctl[c.id] = sel.value; });
  let res = null; body.classList.add('busy');
  try { res = def.draw(body, { rows: cfRows(card, la.view), all: la.rows, ctl, T: plT(), card }) || {}; } catch (e) { body.innerHTML = `<div class="pl-empty">⚠ ${laEsc(e.message)}</div>`; console.error(def.id, e); res = {}; }
  try { laCardTitle(def, card, ctl); } catch (e) { console.error(e); }
  body.classList.remove('busy'); lg.innerHTML = res.legend ? plLegend(res.legend) : '';
  if (res.table) { tw.innerHTML = `<table class="pl-tbl"><thead><tr>${res.table.headers.map((h, i) => `<th class="${i ? 'n' : ''}">${laEsc(h)}</th>`).join('')}</tr></thead><tbody>${res.table.rows.map(r => `<tr>${r.map((v, i) => `<td class="${typeof v === 'number' ? 'n' : ''}">${laEsc(typeof v === 'number' ? plF(v, Math.abs(v) < 10 && v % 1 ? 2 : 0) : (v == null ? '' : v))}</td>`).join('')}</tr>`).join('')}</tbody></table>`; card._table = res.table; } else { tw.innerHTML = '<div class="pl-empty">No table for this card.</div>'; card._table = null; }
}
function laRenderCharts() { const grid = PLQ('#laGrid'); if (!grid) return; LA_DEFS.forEach(def => { let card = grid.querySelector(`[data-id="${def.id}"]`); if (!card) { card = laCardBuild(def); grid.appendChild(card); } laCardDraw(def, card); }); }
function laRedrawAll() { const grid = PLQ('#laGrid'); if (!grid) return; LA_DEFS.forEach(def => { const card = grid.querySelector(`[data-id="${def.id}"]`); if (card) laCardDraw(def, card); }); }
const laNeed = (host, what) => { plEmpty(host, `This list has no ${what} column.`); return {}; };

LA_DEFS.push({ id: 'brk', title: 'Breakdown', sub: 'Records or any numeric column grouped by any category', span: 's7',
  ctl: [{ id: 'dim', label: 'by', opts: laDimOpts, def: laDimDef(0) }, { id: 'm', label: 'measure', opts: laMeasOpts, def: '#' }, { id: 'ord', label: '', opts: () => [['v', 'Largest first'], ['a', 'A → Z']], def: 'v' }],
  draw(host, c) {
    const dim = c.ctl.dim; if (!dim) return laNeed(host, 'category'); const M = laMeasure(c.ctl.m), f = laMFmt(M), T = c.T; let g = laGroup(c.rows, dim).map(x => ({ ...x, v: M.fn(x.rows) }));
    if (c.ctl.ord === 'a') g.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })); g = c.ctl.ord === 'a' ? g.slice(0, 40) : laFold(g, 12, x => x.v);
    const rows = g.map(x => ({ label: x.key, key: x.key, other: x.other, vals: [x.v], tip: [{ c: T.act, k: M.label, v: f(x.v) }, { k: 'Records', v: plF(x.rows.length) }] }));
    plcBarsH(host, { rows, series: [{ name: M.label, color: T.act }], fmt: f, tickFmt: x => f(x), onClick: r => { if (!r.other) laPick(dim, r.key); }, thick: 14 });
    return { table: { headers: [dim, M.label, 'Records'], rows: g.map(x => [x.key, x.v, x.rows.length]) } };
  } });
LA_DEFS.push({ id: 'share', title: 'Share', sub: 'How a category splits the list', span: 's5',
  ctl: [{ id: 'dim', label: 'by', opts: laDimOpts, def: laDimDef(0, 2, 8) }, { id: 'm', label: 'measure', opts: laMeasOpts, def: '#' }],
  draw(host, c) {
    const dim = c.ctl.dim; if (!dim) return laNeed(host, 'category'); const M = laMeasure(c.ctl.m), f = laMFmt(M), T = c.T, g = laFold(laGroup(c.rows, dim).map(x => ({ ...x, v: M.fn(x.rows) })), 8, x => x.v);
    const sl = g.map((x, i) => ({ label: x.key, value: x.v, color: x.other ? T.muted : T.series[i % T.series.length], other: x.other })); const tot = sl.reduce((a, s) => a + s.value, 0);
    plcDonut(host, { slices: sl, center: { value: f(tot), label: M.label.length > 18 ? 'total' : M.label }, unit: M.label, onClick: s => { if (!s.other) laPick(dim, s.label); } });
    return { table: { headers: [dim, M.label, 'Share'], rows: g.map(x => [x.key, x.v, tot ? plP(x.v / tot, 1) : '']) } };
  } });
LA_DEFS.push({ id: 'time', title: 'Over time', sub: 'Trend by day, week, month, hour of day or weekday', span: 's7',
  ctl: [{ id: 'd', label: 'date', opts: laDateOpts, def: () => (laDateCols()[0] || {}).key }, { id: 'b', label: 'by', opts: () => [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['hour', 'Hour of day'], ['weekday', 'Weekday']], def: () => { const c = laDateCols()[0]; if (!c) return 'day'; const u = new Set(la.rows.map(o => o[c.key]).filter(x => x != null).map(t => laBucket(t, 'day').k)).size; return u > 3 ? 'day' : (c.dateOnly ? 'day' : 'hour'); } }, { id: 'm', label: 'measure', opts: laMeasOpts, def: '#' }],
  draw(host, c) {
    const dk = c.ctl.d; if (!dk) return laNeed(host, 'date'); const b = c.ctl.b, M = laMeasure(c.ctl.m), f = laMFmt(M), T = c.T, g = new Map();
    c.rows.forEach(o => { if (o[dk] == null) return; const bk = laBucket(o[dk], b); if (!g.has(bk.k)) g.set(bk.k, { k: bk.k, s: bk.s, rows: [] }); g.get(bk.k).rows.push(o); });
    let arr = [...g.values()].sort((a, b2) => a.s - b2.s); if (b === 'hour') arr = Array.from({ length: 24 }, (_, h) => g.get(String(h).padStart(2, '0') + ':00') || { k: String(h).padStart(2, '0') + ':00', s: h, rows: [] }); if (b === 'weekday') arr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => g.get(d) || { k: d, s: i, rows: [] });
    if (!arr.length) return plEmpty(host, 'No dated records for the current filters.'); const vals = arr.map(x => x.rows.length ? M.fn(x.rows) : 0);
    if (b === 'hour' || b === 'weekday' || arr.length <= 3) plcCols(host, { cats: arr.map((x, i) => ({ label: x.k, vals: [vals[i]], tip: [{ c: T.act, k: M.label, v: f(vals[i]) }, { k: 'Records', v: plF(x.rows.length) }] })), series: [{ name: M.label, color: T.act }], fmt: f, tickFmt: f, labelFn: (c2, v) => v ? f(v) : '', height: 250 });
    else plcLine(host, { x: arr.map(x => x.k), series: [{ name: M.label, color: T.act, vals }], fmt: f, tickFmt: f, area: true, zero: true });
    return { table: { headers: [b, M.label, 'Records'], rows: arr.map((x, i) => [x.k, vals[i], x.rows.length]) } };
  } });
LA_DEFS.push({ id: 'comp', title: 'Composition', sub: 'One category stacked by another', span: 's5',
  ctl: [{ id: 'a', label: 'rows', opts: laDimOpts, def: laDimDef(1) }, { id: 'b', label: 'stack', opts: laDimOpts, def: laDimDef(0, 2, 8) }],
  draw(host, c) {
    const a = c.ctl.a, bk = c.ctl.b; if (!a || !bk) return laNeed(host, 'category'); const T = c.T, ga = laFold(laGroup(c.rows, a).map(x => ({ ...x, v: x.rows.length })), 10, x => x.v), sb = laFold(laGroup(c.rows, bk).map(x => ({ ...x, v: x.rows.length })), 6, x => x.v).map(x => x.key);
    const inS = k => sb.includes(k) ? k : sb[sb.length - 1]; const rows = ga.map(x => { const m = new Map(sb.map(k => [k, 0])); x.rows.forEach(o => { const k = o[bk] == null ? '(blank)' : laFmtV(laC(bk), o[bk]); const kk = sb.includes(k) ? k : (sb.find(z => /^Other/.test(z)) || sb[sb.length - 1]); m.set(kk, (m.get(kk) || 0) + 1); }); return { label: x.key, key: x.key, other: x.other, vals: sb.map(k => m.get(k) || 0) }; });
    const sr = sb.map((k, i) => ({ name: k, color: T.series[i % T.series.length] })); plcBarsH(host, { rows, series: sr, stacked: true, fmt: plF, onClick: r => { if (!r.other) laPick(a, r.key); }, thick: 16 });
    return { legend: sr.map(s => ({ c: s.color, name: s.name })), table: { headers: [a].concat(sb), rows: rows.map(r => [r.label].concat(r.vals)) } };
  } });
LA_DEFS.push({ id: 'mat', title: 'Matrix', sub: 'Two categories against each other', span: 's7',
  ctl: [{ id: 'r', label: 'rows', opts: laDimOpts, def: laDimDef(2) }, { id: 'k', label: 'columns', opts: laDimOpts, def: laDimDef(1, 2, 8) }, { id: 'm', label: 'measure', opts: laMeasOpts, def: '#' }],
  draw(host, c) {
    const rk = c.ctl.r, ck = c.ctl.k; if (!rk || !ck) return laNeed(host, 'category'); const M = laMeasure(c.ctl.m), f = laMFmt(M);
    const rg = laFold(laGroup(c.rows, rk).map(x => ({ ...x, v: x.rows.length })), 14, x => x.v), cg = laFold(laGroup(c.rows, ck).map(x => ({ ...x, v: x.rows.length })), 8, x => x.v), cn = cg.map(x => x.key);
    const vals = rg.map(r => cg.map(cc => { const rs = r.rows.filter(o => (cc.other ? !cn.slice(0, -1).includes(o[ck] == null ? '(blank)' : laFmtV(laC(ck), o[ck])) : (o[ck] == null ? '(blank)' : laFmtV(laC(ck), o[ck])) === cc.key)); return rs.length ? M.fn(rs) : null; }));
    plcHeat(host, { rows: rg.map(x => x.key), cols: cn, vals, fmt: f, measure: M.label, onClick: (r, k2) => { if (!/^Other/.test(r)) laPick(rk, r); } });
    return { table: { headers: [rk].concat(cn), rows: rg.map((r, i) => [r.key].concat(vals[i].map(v => v == null ? '' : v))) } };
  } });
LA_DEFS.push({ id: 'top', title: 'Top records', sub: 'Rank rows by any numeric column', span: 's5',
  ctl: [{ id: 'm', label: 'metric', opts: laNumOpts, def: () => (laNumCols()[0] || {}).key }, { id: 'ord', label: '', opts: () => [['top', 'Highest'], ['bot', 'Lowest']], def: 'top' }, { id: 'n', label: 'show', opts: () => [['10', '10'], ['15', '15'], ['25', '25']], def: '15' }, { id: 'l', label: 'label', opts: () => laAnyCols().map(c => [c.key, c.key.replace(/_/g, ' ')]), def: () => { const D = laDimCols(), c = ['user|driver|staff|customer|name', 'item|sku|product', 'trailer|vehicle|unit', 'dn|record|id'].map(r => D.find(x => new RegExp(r, 'i').test(x.key) && x.n >= la.rows.length * 0.8)).find(Boolean) || D.find(x => x.n >= la.rows.length * 0.8) || laAnyCols()[0]; return c ? c.key : ''; } }],
  draw(host, c) {
    const m = c.ctl.m; if (!m) return laNeed(host, 'numeric'); const col = laC(m), T = c.T, n = +c.ctl.n || 15, lk = c.ctl.l; let rs = c.rows.filter(o => typeof o[m] === 'number'); rs.sort((a, b) => c.ctl.ord === 'bot' ? a[m] - b[m] : b[m] - a[m]); rs = rs.slice(0, n);
    const lab = o => `${o[lk] == null ? '—' : laFmtV(laC(lk), o[lk])} · #${o._i + 1}`, f = x => laFmtV(col, x);
    const rows = rs.map(o => ({ label: lab(o), vals: [o[m]], rec: o, tip: [{ c: T.act, k: col.label, v: f(o[m]) }].concat(laDimCols().slice(0, 4).map(d => ({ k: d.key, v: laFmtV(d, o[d.key]) }))) }));
    plcBarsH(host, { rows, series: [{ name: col.label, color: T.act }], fmt: f, tickFmt: x => f(x), thick: 14, labelW: 170 });
    return { table: { headers: ['Row', lk, col.label], rows: rs.map(o => [o._i + 1, laFmtV(laC(lk), o[lk]), o[m]]) } };
  } });
LA_DEFS.push({ id: 'dist', title: 'Distribution', sub: 'How the values of a numeric column are spread', span: 's6',
  ctl: [{ id: 'm', label: 'column', opts: laNumOpts, def: () => (laNumCols()[0] || {}).key }, { id: 'bins', label: 'bins', opts: () => [['8', '8'], ['12', '12'], ['20', '20']], def: '12' }],
  draw(host, c) {
    const m = c.ctl.m; if (!m) return laNeed(host, 'numeric'); const col = laC(m), T = c.T, v = c.rows.map(o => o[m]).filter(x => typeof x === 'number').sort((a, b) => a - b); if (!v.length) return plEmpty(host);
    const q = p => v[Math.min(v.length - 1, Math.floor(p * v.length))], lo = v[0], hi = q(0.98) > lo ? q(0.98) : v[v.length - 1], nb = +c.ctl.bins || 12, w = (hi - lo) / nb || 1, bins = Array.from({ length: nb }, (_, i) => ({ a: lo + i * w, b: lo + (i + 1) * w, n: 0 }));
    let over = 0; v.forEach(x => { if (x > hi) { over++; return; } bins[Math.min(nb - 1, Math.floor((x - lo) / w))].n++; }); const f = x => laFmtV(col, +x.toFixed(1)), med = q(0.5);
    plcCols(host, { cats: bins.map(b => ({ label: f(b.a), vals: [b.n], tip: [{ k: 'Range', v: `${f(b.a)} – ${f(b.b)}` }, { c: T.act, k: 'Records', v: plF(b.n) }] })), series: [{ name: 'Records', color: T.act }], labelFn: (c2, x) => x ? plF(x) : '', height: 250 });
    return { legend: [{ c: T.act, name: `${plF(v.length)} values · median ${f(med)} · min ${f(v[0])} · max ${f(v[v.length - 1])}${over ? ` · ${over} above ${f(hi)} (outliers)` : ''}` }], table: { headers: ['From', 'To', 'Records'], rows: bins.map(b => [f(b.a), f(b.b), b.n]) } };
  } });
LA_DEFS.push({ id: 'rel', title: 'Relationship', sub: 'Every row as a point — spot patterns and outliers', span: 's6',
  ctl: [{ id: 'x', label: 'x', opts: laNumOpts, def: () => (laNumCols()[1] || laNumCols()[0] || {}).key }, { id: 'y', label: 'y', opts: laNumOpts, def: () => (laNumCols()[0] || {}).key }, { id: 'c', label: 'colour', opts: () => [['', '— none —']].concat(laDimOpts()), def: laDimDef(0, 2, 8) }],
  draw(host, c) {
    const xk = c.ctl.x, yk = c.ctl.y; if (!xk || !yk) return laNeed(host, 'numeric'); const T = c.T, cx = laC(xk), cy = laC(yk), ck = c.ctl.c;
    const cats = ck ? laFold(laGroup(c.rows, ck).map(x => ({ ...x, v: x.rows.length })), 7, x => x.v).map(x => x.key) : []; const col = k => { const i = cats.indexOf(k); return i < 0 || /^Other/.test(cats[cats.length - 1]) && i === cats.length - 1 ? T.muted : T.series[i % T.series.length]; };
    const lim = (k) => { const v = c.rows.map(o => o[k]).filter(x => typeof x === 'number').sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(0.99 * v.length))] : 1; }, xm = lim(xk), ym = lim(yk);
    const pts = c.rows.filter(o => typeof o[xk] === 'number' && typeof o[yk] === 'number' && o[xk] <= xm * 1.02 && o[yk] <= ym * 1.02 && o[xk] >= 0 && o[yk] >= 0).map(o => { const k = ck ? (o[ck] == null ? '(blank)' : laFmtV(laC(ck), o[ck])) : ''; return { x: o[xk], y: o[yk], size: 1, color: ck ? col(cats.includes(k) ? k : cats[cats.length - 1]) : T.series[0], label: `Row ${o._i + 1}`, tip: [{ k: cx.label, v: laFmtV(cx, o[xk]) }, { k: cy.label, v: laFmtV(cy, o[yk]) }].concat(ck ? [{ k: ck, v: k }] : []) }; });
    plcScatter(host, { pts, xLabel: cx.label, yLabel: cy.label, xFmt: x => laFmtV(cx, x), yFmt: x => laFmtV(cy, x), xmax: xm, ymax: ym });
    return { legend: ck ? cats.map((k, i) => ({ c: col(k), name: k })) : null, table: { headers: ['Row', cx.label, cy.label].concat(ck ? [ck] : []), rows: pts.map(p => [p.label, p.x, p.y].concat(ck ? [p.tip[2].v] : [])) } };
  } });


/* ---------- chart & table names: made from the uploaded sheet's columns, and renameable ---------- */
const LA_TKEY = LS_BASE + '_la_titles';
function laTitlesAll() { try { return JSON.parse(localStorage.getItem(LA_TKEY) || '{}'); } catch (e) { return {}; } }
const laTitles = () => laTitlesAll()[la.name] || {};
function laTitleSet(id, v) { const all = laTitlesAll(), o = all[la.name] || {}; if (v == null || v === '') delete o[id]; else o[id] = v; if (Object.keys(o).length) all[la.name] = o; else delete all[la.name]; try { localStorage.setItem(LA_TKEY, JSON.stringify(all)); } catch (e) {} }
const laLbl = k => { const c = laC(k); return c ? String(c.label || c.key).replace(/_/g, ' ') : String(k || '').replace(/_/g, ' '); };
const LA_AUTO = {
  brk: c => `${laMeasure(c.m).label.replace(/_/g, ' ')} by ${laLbl(c.dim)}`,
  share: c => `${laLbl(c.dim)} — share of ${laMeasure(c.m).label.replace(/_/g, ' ')}`,
  time: c => `${laMeasure(c.m).label.replace(/_/g, ' ')} per ${({ day: 'day', week: 'week', month: 'month', hour: 'hour of day', weekday: 'weekday' })[c.b] || c.b} · ${laLbl(c.d)}`,
  comp: c => `${laLbl(c.a)} split by ${laLbl(c.b)}`,
  mat: c => `${laLbl(c.r)} × ${laLbl(c.k)} — ${laMeasure(c.m).label.replace(/_/g, ' ')}`,
  top: c => `${c.ord === 'bot' ? 'Lowest' : 'Top'} ${c.n} by ${laLbl(c.m)}`,
  dist: c => `${laLbl(c.m)} — distribution`,
  rel: c => `${laLbl(c.y)} vs ${laLbl(c.x)}`
};
function laAutoTitle(def, ctl) { try { const f = LA_AUTO[def.id]; return f ? f(ctl || {}) : def.title; } catch (e) { return def.title; } }
function laCardTitle(def, card, ctl) {
  const T = laTitles(), h = card.querySelector('h3'), sub = card.querySelector('.sub'), auto = laAutoTitle(def, ctl), t = T[def.id] || auto; h.textContent = t; h.dataset.auto = auto; h.classList.toggle('la-custom', !!T[def.id]);
  if (sub) sub.textContent = T[def.id + '_s'] || `${def.sub || ''}${def.sub ? ' · ' : ''}${la.name}`;
}
function laRename(def, card) {
  const h = card.querySelector('h3'), T = laTitles(), cur = h.textContent;
  const t = prompt('Name for this chart (also used for its table).\nLeave empty to go back to the automatic name:\n“' + h.dataset.auto + '”', T[def.id] || cur); if (t === null) return;
  const s = prompt('Sub-title (optional — empty = automatic):', T[def.id + '_s'] || ''); if (s === null) return;
  laTitleSet(def.id, t.trim()); laTitleSet(def.id + '_s', s.trim()); laRedrawAll(); laTableTitle();
}
function laTableTitle() { const T = laTitles(), el = document.querySelector('#laTableCard .card-title'); if (!el) return; let n = el.querySelector('.la-ttl'); if (!n) { el.innerHTML = '<span class="la-ttl"></span> <span class="text-sm" style="font-weight:400;" id="laTblInfo"></span> <button class="ghost small" id="laTblRen" type="button" title="Rename this table" style="padding:0 6px">✎</button>'; n = el.querySelector('.la-ttl'); el.querySelector('#laTblRen').addEventListener('click', () => { const v = prompt('Name for the data table (empty = automatic):', T2()); if (v === null) return; laTitleSet('_tbl', v.trim()); laTableTitle(); }); } const T2 = () => laTitles()._tbl || ''; n.textContent = T._tbl || `📋 ${la.name} — every column`; }
function laResetTitles() { const all = laTitlesAll(); delete all[la.name]; try { localStorage.setItem(LA_TKEY, JSON.stringify(all)); } catch (e) {} laRedrawAll(); laTableTitle(); sectionToast('Chart and table names are automatic again.', 'success'); }

/* ---------- data table ---------- */
function laTable() {
  const cols = la.cols.filter(c => !la.hidden.has(c.key)), th = PLQ('#laDataTable thead'), tb = PLQ('#laDataTable tbody'); let rows = la.view.slice();
  if (la.sort) { const c = laC(la.sort.key); rows.sort((a, b) => { const x = a[la.sort.key], y = b[la.sort.key]; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * la.sort.dir; }); }
  th.innerHTML = '<tr>' + cols.map(c => `<th data-k="${laEsc(c.key)}" class="${c.type === 'num' ? 'n' : ''}" style="cursor:pointer;white-space:nowrap">${laEsc(c.label)}${la.sort && la.sort.key === c.key ? (la.sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr>';
  tb.innerHTML = rows.slice(0, la.shown).map(o => `<tr>${cols.map(c => `<td class="${c.type === 'num' ? 'n' : ''}" title="${laEsc(laFmtV(c, o[c.key]))}">${laEsc(laFmtV(c, o[c.key]))}</td>`).join('')}</tr>`).join('');
  laTableTitle(); PLQ('#laTblInfo').textContent = `· ${plF(Math.min(la.shown, rows.length))} of ${plF(rows.length)} rows · ${cols.length} columns`; const more = PLQ('#laMore'); more.style.display = rows.length > la.shown ? '' : 'none'; more.textContent = `Show ${Math.min(200, rows.length - la.shown)} more rows`;
}
function laExportData() { const cols = la.cols.filter(c => !la.hidden.has(c.key)); return { title: la.name + ' — list analysis', sheet: 'List', note: `${plF(la.view.length)} of ${plF(la.rows.length)} rows`, headers: cols.map(c => c.label), rows: la.view.map(o => cols.map(c => { const v = o[c.key]; return v == null ? '' : c.type === 'date' ? laDateStr(v, c.dateOnly) : v; })) }; }

/* ---------- orchestration ---------- */
function laRefresh(opts) {
  opts = opts || {}; if (!la.rows.length) { PLQ('#laEmpty').style.display = ''; PLQ('#laMain').style.display = 'none'; return; } PLQ('#laEmpty').style.display = 'none'; PLQ('#laMain').style.display = '';
  if (opts.full || !la._txt) laBuildText(); la.view = laFilter(la.rows); if (opts.full) la.shown = 200;
  PLQ('#laCount').textContent = `${plF(la.view.length)} of ${plF(la.rows.length)} rows`; laBand(); if (opts.full || !opts.except) laRenderDims(); else if (!opts.keepDims) laRenderDimsExcept(opts.except); laActive(); laKpis(); laRenderCharts(); laTable();
}
function laRenderDimsExcept(except) { // keep the combo the user is typing in; refresh the others' option lists
  const host = PLQ('#laDimHost'), dims = laShownDims(); if (host.children.length !== dims.length) { laRenderDims(); return; }
  dims.forEach((c, i) => { if (c.key === except) return; const d = host.children[i], old = d.querySelector('.mcombo'); const base = laFilter(la.rows, c.key), opts = [...new Set(base.map(o => o[c.key] == null ? '(blank)' : String(o[c.key])))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); if (old) old.remove(); d.appendChild(buildMultiCombo(la.dimSel[c.key] || [], opts, arr => { la.dimSel[c.key] = arr; laRefresh({ except: c.key }); }, { placeholder: 'All' })); });
}
function laFromDownload() {
  if (!expState.allItems.length || !expState.selectedColumns.length) { sectionToast('Nothing is loaded in Data Download yet — load a list there first, or open the exported file.', 'warn'); return false; }
  const cols = expState.selectedColumns.map(n => expState.allColumns.find(c => c.name === n)).filter(Boolean), items = (expState.filteredItems && expState.filteredItems.length) ? expState.filteredItems : expState.allItems;
  laLoad(cols.map(c => c.name), items.map(it => cols.map(c => (it.fields || {})[c.name])), (expState.columnsLoadedFor || 'SharePoint list') + ' (Data Download)', { names: cols.map(c => c.displayName && c.displayName !== c.name ? c.displayName : null) }); addActivity('export', 'List analysis from Data Download: ' + items.length + ' rows'); return true;
}
async function laFromFile(file) {
  try {
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true }), ws = wb.Sheets[wb.SheetNames[0]], A = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }); if (A.length < 2) throw new Error('The file has no data rows.');
    let hi = 0; while (hi < A.length - 1 && (A[hi] || []).filter(x => x != null && x !== '').length < 2) hi++; const H = A[hi], rows = A.slice(hi + 1).filter(r => r && r.some(x => x != null && x !== ''));
    laLoad(H, rows.map(r => r.map(v => v instanceof Date ? v : v)), file.name.replace(/\.[^.]+$/, '')); addActivity('upload', 'List analysis file: ' + file.name);
  } catch (e) { sectionToast('Could not read the file: ' + e.message, 'error'); }
}
function laInit() {
  if (la.inited) return; la.inited = true; const q = PLQ;
  q('#laSearchHost').innerHTML = '<input type="text" id="laSearch" placeholder="🔍 Search every column…" style="margin:0;width:100%">'; let tm; q('#laSearch').addEventListener('input', e => { clearTimeout(tm); tm = setTimeout(() => { la.q = e.target.value.trim(); laRefresh({ except: '__none__', keepDims: false }); }, 200); });
  q('#laAddFilterBtn').addEventListener('click', laAddFilterPop);
  document.addEventListener('mousedown', e => { const p = PLQ('#laPop'); if (p && !e.composedPath().includes(p) && e.target.id !== 'laAddFilterBtn' && !e.target.closest('.combo-list')) p.remove(); });
  q('#laClearBtn').addEventListener('click', () => { la.dimSel = {}; la.conds = []; la.q = ''; q('#laSearch').value = ''; laRefresh({ full: true }); });
  laPresetFill(); q('#laPresetSel').addEventListener('change', e => { const p = laPresets()[+e.target.value]; if (!p) return; la.dimSel = JSON.parse(JSON.stringify(p.dimSel || {})); la.conds = JSON.parse(JSON.stringify(p.conds || [])); la.q = p.q || ''; q('#laSearch').value = la.q; laRefresh({ full: true }); });
  q('#laPresetSave').addEventListener('click', () => { const n = prompt('Name for this filter set:'); if (!n) return; const a = laPresets(); a.push({ name: n, dimSel: la.dimSel, conds: la.conds, q: la.q }); try { localStorage.setItem(LA_PRE, JSON.stringify(a)); } catch (e) {} laPresetFill(); });
  q('#laPresetDel').addEventListener('click', () => { const i = q('#laPresetSel').value; if (i === '') return; const a = laPresets(); a.splice(+i, 1); try { localStorage.setItem(LA_PRE, JSON.stringify(a)); } catch (e) {} laPresetFill(); });
  document.querySelectorAll('#view-listan .laUseDl').forEach(b => b.addEventListener('click', laFromDownload));
  document.querySelectorAll('#view-listan .laOpen').forEach(b => b.addEventListener('click', () => q('#laFile').click())); q('#laFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) laFromFile(f); });
  q('#laClearData').addEventListener('click', () => { if (!confirm('Forget the loaded list?')) return; la.rows = []; la.cols = []; try { localStorage.removeItem(LA_KEY); } catch (e) {} laRefresh(); });
  q('#laMore').addEventListener('click', () => { la.shown += 200; laTable(); });
  q('#laDataTable').addEventListener('click', e => { const h = e.target.closest('th[data-k]'); if (!h) return; const k = h.dataset.k; la.sort = la.sort && la.sort.key === k ? { key: k, dir: -la.sort.dir } : { key: k, dir: 1 }; laTable(); });
  q('#laColBtn').addEventListener('click', e => { e.stopPropagation(); const old = PLQ('#laColPop'); if (old) { old.remove(); return; } const p = document.createElement('div'); p.id = 'laColPop'; p.className = 'pl-pop'; p.style.cssText += ';right:16px;top:50px;max-height:60vh;overflow:auto'; q('#laTableCard').style.position = 'relative';
    p.innerHTML = `<div class="btn-row" style="margin-bottom:6px"><button type="button" class="ghost small" data-v="all">Show all</button><button type="button" class="ghost small" data-v="auto">Reset</button></div>` + la.cols.map(c => `<label style="display:flex;gap:6px;font-size:12.5px;padding:2px 0"><input type="checkbox" data-k="${laEsc(c.key)}" ${la.hidden.has(c.key) ? '' : 'checked'} style="width:auto;margin:0"> ${laEsc(c.key)} <span style="color:var(--gray-500)">· ${c.type}</span></label>`).join(''); q('#laTableCard').appendChild(p);
    p.addEventListener('change', ev => { const cb = ev.target.closest('input[data-k]'); if (!cb) return; cb.checked ? la.hidden.delete(cb.dataset.k) : la.hidden.add(cb.dataset.k); laSave(); laTable(); }); p.addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (!b) return; la.hidden = b.dataset.v === 'all' ? new Set() : new Set(la.cols.filter(c => c.hidden || LA_SYS.test(c.key)).map(c => c.key)); laSave(); laTable(); p.querySelectorAll('input[data-k]').forEach(i => i.checked = !la.hidden.has(i.dataset.k)); }); });
  document.addEventListener('mousedown', e => { const p = PLQ('#laColPop'); if (p && !p.contains(e.target) && e.target.id !== 'laColBtn') p.remove(); });
  q('#laKpis').addEventListener('click', () => {});
  q('#laExcelBtn').addEventListener('click', () => { const t = laExportData(); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([t.headers, ...t.rows]), 'List'); XLSX.writeFile(wb, `${la.name.replace(/\W+/g, '_')}_analysis_${plIso(new Date())}.xlsx`); addActivity('export', 'List analysis Excel'); });
  q('#laTitleReset').addEventListener('click', laResetTitles);
  q('#laPrintBtn').addEventListener('click', () => { const t = laExportData(); w_printTable(t.title, t.note, t.headers, t.rows); });
  q('#laEmailBtn').addEventListener('click', () => { window.extMailData = laExportData; wMail_open('ext'); });
  window.addEventListener('resize', () => { if (PLQ('#view-listan.active')) { clearTimeout(la._rt); la._rt = setTimeout(laRedrawAll, 150); } });
}
function laOpen() {
  laInit(); if (!la.rows.length) { if (!laRestore() && expState.allItems.length && expState.selectedColumns.length) laFromDownload(); else if (la.rows.length) la.hidden = la.hidden || new Set(); }
  laRefresh({ full: true });
}
document.querySelectorAll('.nav-item[data-view="listan"]').forEach(n => n.addEventListener('click', () => setTimeout(laOpen, 0)));
(function () { const b = document.getElementById('expAnalyseBtn'); if (!b) return;
  b.addEventListener('click', () => {   // Data Download → List Analytics: load the rows being shown and open the dashboard
    if (!expState.allItems.length) { sectionToast('Load some data first, then analyse it.', 'warn'); return; }
    if (!expState.selectedColumns.length) { sectionToast('Select at least one column to analyse.', 'warn'); return; }
    laInit(); la.dimSel = {}; la.conds = []; la.q = ''; la.hidden = new Set(); la.shown = 200; la.sort = null;
    if (!laFromDownload()) return; const n = document.querySelector('.nav-item[data-view="listan"]'); if (n) n.click(); else { laOpen(); }
    sectionToast(plF(la.rows.length) + ' rows sent to List Analytics.', 'success');
  }); })();


/* ============================================================
   HIDE / UNHIDE VISUALS  (Planning + Daily Plan dashboards)
   ============================================================ */
function visInit(cfg) {   // cfg: {pre:'pl'|'dp', grid:'#plGrid', kpis:'#plKpis', table:'#plTableCard', redraw:fn}
  const root = document.querySelector(cfg.grid); if (!root || root.dataset.visInit) return; root.dataset.visInit = '1';
  const key = () => LS_BASE + '_vis_' + cfg.pre + '_' + ((typeof currentUser !== 'undefined' && currentUser && currentUser.id) || 'u');
  let hidden = new Set(); const load = () => { try { hidden = new Set(JSON.parse(localStorage.getItem(key()) || '[]')); } catch (e) { hidden = new Set(); } };
  const save = () => { try { localStorage.setItem(key(), JSON.stringify([...hidden])); } catch (e) {} };
  const extras = [['__kpis', 'KPI tiles', cfg.kpis], ['__table', 'Data table', cfg.table]].filter(x => x[2] && document.querySelector(x[2]));
  const bar = document.createElement('div'); bar.className = 'vis-bar';
  bar.innerHTML = '<button type="button" class="ghost small vis-btn">👁 Visuals <span class="vis-n"></span></button><div class="vis-pop" style="display:none"></div>';
  root.parentNode.insertBefore(bar, root);
  const btn = bar.querySelector('.vis-btn'), pop = bar.querySelector('.vis-pop'), cnt = bar.querySelector('.vis-n');
  const cards = () => [...root.querySelectorAll(':scope > .pl-card')];
  const items = () => [...cards().map(c => ({ id: c.dataset.id, title: (c.querySelector('h3') || {}).textContent || c.dataset.id })), ...extras.map(x => ({ id: x[0], title: x[1] }))];
  function apply(redraw) {
    cards().forEach(c => { c.classList.toggle('vis-hid', hidden.has(c.dataset.id)); if (!c.querySelector('[data-a="hide"]')) { const b = document.createElement('button'); b.className = 'pl-ib'; b.dataset.a = 'hide'; b.title = 'Hide this visual (bring it back from 👁 Visuals)'; b.textContent = '🙈 Hide'; b.type = 'button'; b.addEventListener('click', ev => { ev.stopPropagation(); hidden.add(c.dataset.id); save(); apply(); }); const full = c.querySelector('[data-a="full"]'); full ? full.before(b) : c.querySelector('.pl-ch').appendChild(b); } });
    extras.forEach(x => { const el = document.querySelector(x[2]); if (el) el.classList.toggle('vis-hid', hidden.has(x[0])); });
    const n = items().filter(i => hidden.has(i.id)).length; cnt.textContent = n ? `· ${n} hidden` : ''; btn.classList.toggle('on', n > 0);
    if (pop.style.display !== 'none') list();
    if (redraw && cfg.redraw) setTimeout(cfg.redraw, 30);
  }
  function list() {
    const its = items(); pop.innerHTML = `<div class="vis-h"><b>Show / hide visuals</b><span><button type="button" class="ghost small" data-v="all">Show all</button><button type="button" class="ghost small" data-v="none">Hide all</button></span></div>` +
      (its.length ? its.map(i => `<label><input type="checkbox" data-id="${plEsc(i.id)}" ${hidden.has(i.id) ? '' : 'checked'}> ${plEsc(i.title)}</label>`).join('') : '<div class="pl-empty">Load a snapshot first.</div>');
  }
  pop.addEventListener('change', e => { const cb = e.target.closest('input[data-id]'); if (!cb) return; cb.checked ? hidden.delete(cb.dataset.id) : hidden.add(cb.dataset.id); save(); apply(cb.checked); });
  pop.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-v]'); if (!b) return; if (b.dataset.v === 'all') hidden.clear(); else items().forEach(i => hidden.add(i.id)); save(); apply(b.dataset.v === 'all'); list(); });
  btn.addEventListener('click', e => { e.stopPropagation(); const open = pop.style.display === 'none'; pop.style.display = open ? '' : 'none'; if (open) list(); });
  document.addEventListener('click', e => { if (!bar.contains(e.target)) pop.style.display = 'none'; });
  new MutationObserver(() => apply()).observe(root, { childList: true });
  load(); apply();
  const nav = document.querySelector(`.nav-item[data-view="${cfg.view}"]`); if (nav) nav.addEventListener('click', () => { load(); setTimeout(() => apply(true), 60); });
}


/* ============================================================
   SECTION RIGHTS (per user, on top of the role)
   user.viewAccess = { '<view>': false | 'view' | true }   absent = role default
     false  → no access (hidden)      'view' → view-only      true → full access
   ============================================================ */
function acRoleAllows(role, perm) { const r = ROLES[role]; return !!r && (r.perms.has('*') || r.perms.has(perm)); }
function acLevel(view) {
  const u = currentUser; if (!u) return 'none'; if (u.role === 'admin') return 'full'; const ov = u.viewAccess || {};
  if (view in ov) return ov[view] === false ? 'none' : ov[view] === 'view' ? 'view' : 'full';
  const el = document.querySelector(`.nav-item[data-view="${view}"]`); return !el || !el.dataset.perm || acRoleAllows(u.role, el.dataset.perm) ? 'full' : 'none';
}
function acApplyNav() {
  const admin = currentUser && currentUser.role === 'admin', ov = (!admin && currentUser && currentUser.viewAccess) || {};
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    const v = el.dataset.view; if (!(v in ov)) { el.style.display = ''; return; }
    if (ov[v] === false) { el.style.display = 'none'; el.classList.add('locked'); el.style.pointerEvents = 'none'; }
    else { el.style.display = ''; el.classList.remove('locked'); el.style.pointerEvents = ''; }
  });
  document.querySelectorAll('.sidebar-nav .nav-group').forEach(g => { g.style.display = [...g.querySelectorAll('.nav-item')].some(n => n.style.display !== 'none') ? '' : 'none'; });
  acRoApply();
}
function acRoApply() {
  document.querySelectorAll('.view').forEach(v => {
    const id = v.id.replace('view-', ''), ro = acLevel(id) === 'view'; v.classList.toggle('ro-mode', ro); let b = v.querySelector(':scope > .ro-banner');
    if (ro && !b) { b = document.createElement('div'); b.className = 'ro-banner'; b.textContent = '👁 View-only access — you can look at, filter and print this section; upload, save and delete actions are switched off for you.'; v.prepend(b); } if (!ro && b) b.remove();
  });
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.view.ro-mode button.success, .view.ro-mode button.danger'); if (b) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); try { sectionToast('View-only access — this action is switched off for you.', 'warn'); } catch (x) {} } }, true);
function featOpen(user) {
  let m = document.querySelector('#featModal');
  if (!m) { m = document.createElement('div'); m.id = 'featModal'; m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998;align-items:center;justify-content:center;padding:20px;'; document.body.appendChild(m); }
  const f = Object.assign({}, user.features || {});
  const draw = () => { m.innerHTML = `<div class="card" style="max-width:600px;width:100%;max-height:90vh;overflow:auto;margin:0;"><div class="card-header"><div class="card-title">🎛 Options — ${escapeHtml(user.username)}</div><button class="ghost small" data-x="close" type="button">✖ Close</button></div>
    <p style="font-size:12px;color:var(--gray-600);margin:0 0 8px">Switch features on or off for this user. Ticked = allowed. These work together with the role, the <b>🧭 Sections</b> rights and the <b>📋 Lists</b> access. Administrators always have everything.</p>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap"><button class="ghost small" data-p="all" type="button">Allow all</button><button class="ghost small" data-p="read" type="button">Read-only reporting (no edit, no Excel / email)</button><button class="ghost small" data-p="none" type="button">Switch all off</button></div>
    ${FEAT_LIST.map(x => `<label style="display:flex;gap:10px;align-items:flex-start;padding:8px 6px;border-bottom:1px solid var(--border);cursor:pointer"><input type="checkbox" data-f="${x[0]}" ${(x[3] ? f[x[0]] === true : f[x[0]] !== false) ? 'checked' : ''} style="margin-top:3px"><span><b>${x[1]}</b><br><span style="font-size:12px;color:var(--gray-600)">${x[2]}</span></span></label>`).join('')}
    <div class="btn-row" style="margin-top:12px"><button class="success" data-x="save" type="button">💾 Save</button><button class="ghost" data-x="close" type="button">Cancel</button></div></div>`; };
  draw(); m.style.display = 'flex';
  m.onchange = e => { const c = e.target.closest('input[data-f]'); if (!c) return; const op = (FEAT_LIST.find(x => x[0] === c.dataset.f) || [])[3]; if (op) { if (c.checked) f[c.dataset.f] = true; else delete f[c.dataset.f]; } else if (c.checked) delete f[c.dataset.f]; else f[c.dataset.f] = false; };
  m.onclick = e => { const b = e.target.closest('[data-x],[data-p]'); if (e.target === m || (b && b.dataset.x === 'close')) { m.style.display = 'none'; return; } if (!b) return;
    if (b.dataset.p) { FEAT_LIST.forEach(x => { delete f[x[0]]; if (x[3]) { if (b.dataset.p === 'all') f[x[0]] = true; return; } if (b.dataset.p === 'none' || (b.dataset.p === 'read' && ['excel', 'email', 'fdedit', 'xlstyle'].includes(x[0]))) f[x[0]] = false; }); draw(); }
    if (b.dataset.x === 'save') { if (Object.keys(f).length) user.features = f; else delete user.features; saveUsers(); if (currentUser && user.id === currentUser.id) { currentUser = user; applyPermissions(); } renderUsersView(); addActivity('auth', `Updated feature options for "${user.username}"`); m.style.display = 'none'; sectionToast('Options saved for ' + user.username + '.', 'success'); } };
}
function acOpen(user) {
  let m = document.querySelector('#acModal');
  if (!m) { m = document.createElement('div'); m.id = 'acModal'; m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998;align-items:center;justify-content:center;padding:20px;'; document.body.appendChild(m); }
  const groups = []; document.querySelectorAll('.sidebar-nav .nav-group').forEach(g => { const items = [...g.querySelectorAll('.nav-item[data-view]')].map(el => ({ view: el.dataset.view, perm: el.dataset.perm, name: (el.querySelector('span:nth-child(2)') || el).textContent.trim(), icon: (el.querySelector('.icon') || {}).textContent || '' })); if (items.length) groups.push({ label: (g.querySelector('.gname') || {}).textContent || '', items }); });
  const ov = Object.assign({}, user.viewAccess || {}), roleLvl = v => acRoleAllows(user.role, v.perm) || !v.perm ? 'full' : 'none';
  const cur = v => (v.view in ov) ? (ov[v.view] === false ? 'none' : ov[v.view] === 'view' ? 'view' : 'full') : 'def';
  const draw = () => { m.innerHTML = `<div class="card" style="max-width:640px;width:100%;max-height:90vh;overflow:auto;margin:0;"><div class="card-header"><div class="card-title">🧭 Section rights — ${escapeHtml(user.username)}</div><button class="ghost small" data-x="close" type="button">✖ Close</button></div>
    <p style="font-size:12px;color:var(--gray-600);margin:0 0 8px">Choose, for every section, what this user can do. <b>Role default</b> follows the <b>${ROLES[user.role].label}</b> role. <b>View only</b> shows the section but switches off its upload / save / delete buttons. Admins always have full access.</p>
    <div style="display:flex;gap:6px;margin-bottom:6px"><button class="ghost small" data-all="def" type="button">All: role default</button><button class="ghost small" data-all="view" type="button">All: view only</button><button class="ghost small" data-all="none" type="button">All: no access</button></div>
    ${groups.map(g => `<div style="margin:10px 0 2px;font-weight:600;font-size:12px;text-transform:uppercase;color:var(--gray-600)">${escapeHtml(g.label)}</div>` + g.items.map(v => `<div style="display:flex;gap:8px;align-items:center;padding:3px 0"><span style="flex:1">${escapeHtml(v.icon)} ${escapeHtml(v.name)}</span><select data-v="${v.view}" style="width:auto;margin:0;padding:3px 6px;font-size:12px"><option value="def" ${cur(v) === 'def' ? 'selected' : ''}>Role default (${roleLvl(v) === 'full' ? 'full' : 'none'})</option><option value="full" ${cur(v) === 'full' ? 'selected' : ''}>Full access</option><option value="view" ${cur(v) === 'view' ? 'selected' : ''}>View only</option><option value="none" ${cur(v) === 'none' ? 'selected' : ''}>No access</option></select></div>`).join('')).join('')}
    <div class="btn-row" style="margin-top:12px"><button class="success" data-x="save" type="button">💾 Save</button><button class="ghost" data-x="close" type="button">Cancel</button></div></div>`; };
  draw(); m.style.display = 'flex';
  const set = (view, val) => { if (val === 'def') delete ov[view]; else ov[view] = val === 'none' ? false : val === 'view' ? 'view' : true; };
  m.onchange = e => { const s = e.target.closest('select[data-v]'); if (s) set(s.dataset.v, s.value); };
  m.onclick = e => { const b = e.target.closest('[data-x],[data-all]'); if (e.target === m || (b && b.dataset.x === 'close')) { m.style.display = 'none'; return; } if (!b) return;
    if (b.dataset.all) { groups.forEach(g => g.items.forEach(v => set(v.view, b.dataset.all))); draw(); }
    if (b.dataset.x === 'save') { if (Object.keys(ov).length) user.viewAccess = ov; else delete user.viewAccess; saveUsers(); if (currentUser && user.id === currentUser.id) { currentUser = user; applyPermissions(); } renderUsersView(); addActivity('auth', `Updated section rights for "${user.username}"`); m.style.display = 'none'; } };
}


