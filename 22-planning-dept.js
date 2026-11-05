/* ============================================================
   PLANNING DEPT. — data table, SKU card, sector summaries, e-mail share, init
   ============================================================ */
const plTbl = { sec: 'Overview', hidden: new Set(), sort: null, limit: 300 };
const PL_OVERVIEW = ['code', 'item', 'brand', 'status', 'totalSOH', 'releasedSOH', 'incubation', 'onHold', 'docReleased', 'monthlyFcst', 'mtdSales', 'pctMtd', '_health', '_paceClass'];
const plColsFor = () => { const all = plAllCols(pl.cur); if (plTbl.sec === 'All') return all; if (plTbl.sec === 'Overview') return PL_OVERVIEW.map(k => PL_COL()[k]).filter(Boolean); return all.filter(c => c.section === plTbl.sec || c.key === 'code' || c.key === 'item'); };
const plColVisible = () => plColsFor().filter(c => !plTbl.hidden.has(c.key));
function plPill(o, key) { const defs = key === '_health' ? plHealthDefs() : PL_PACE, d = defs.find(x => x.k === o[key]); return d ? `<span class="pl-h" style="background:${d.c}22;color:${d.c};border:1px solid ${d.c}66" title="${plEsc(d.k)}">${d.g} ${plEsc(d.k)}</span>` : plEsc(o[key] || ''); }
function plCellHtml(o, c) {
  const v = o[c.key]; if (c.key === '_health' || c.key === '_paceClass') return plPill(o, c.key); if (v == null || v === '') return '';
  if (c.type === 'text' || typeof v !== 'number') return plEsc(v);
  if (c.type === 'pct') return plEsc(plP(v, 1)); if (c.key === '_paceIdx') return v.toFixed(2) + '×'; return plEsc(plFmtBy(c.type)(v));
}
function plRenderTable() {
  const tbl = PLQ('#plDataTable'); if (!tbl || !pl.cur) return;
  const secs = ['Overview'].concat(PL_SECTIONS.filter(s => plAllCols(pl.cur).some(c => c.section === s)), ['All']);
  if (!secs.includes(plTbl.sec)) plTbl.sec = 'Overview';
  PLQ('#plSecTabs').innerHTML = secs.map(s => `<button type="button" data-s="${plEsc(s)}" class="${s === plTbl.sec ? 'on' : ''}">${plEsc(s)}</button>`).join('');
  PLQ('#plSecTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { plTbl.sec = b.dataset.s; plTbl.limit = 300; plRenderTable(); }));
  const cols = plColVisible(); let rows = pl.view.slice();
  if (plTbl.sort) { const { key, dir } = plTbl.sort; rows.sort((a, b) => { const x = a[key], y = b[key]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir; }); }
  const shown = rows.slice(0, plTbl.limit);
  PLQ('#plTblInfo').textContent = `— ${rows.length} of ${pl.rows.length} SKUs · ${cols.length} columns`;
  tbl.querySelector('thead').innerHTML = '<tr>' + cols.map((c, i) => `<th data-k="${plEsc(c.key)}" class="${i === 0 ? 'sticky1' : ''} ${c.type !== 'text' ? 'num' : ''}" title="${plEsc(c.label)} — click to sort">${plEsc(plTrunc(c.label, 160))}${plTbl.sort && plTbl.sort.key === c.key ? (plTbl.sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr>';
  tbl.querySelector('thead').querySelectorAll('th').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; plTbl.sort = plTbl.sort && plTbl.sort.key === k ? { key: k, dir: -plTbl.sort.dir } : { key: k, dir: PL_COL()[k] && PL_COL()[k].type !== 'text' ? -1 : 1 }; plRenderTable(); }));
  const tot = {}; cols.forEach(c => { if (c.type === 'num' && !/doc|cover|days|ytd|trend/i.test(c.key)) tot[c.key] = plSum(rows, c.key); });
  tbl.querySelector('tbody').innerHTML = shown.map(o => `<tr data-code="${plEsc(o.code)}">` + cols.map((c, i) => `<td class="${i === 0 ? 'sticky1' : ''} ${c.type !== 'text' ? 'num' : ''}">${plCellHtml(o, c)}</td>`).join('') + '</tr>').join('') +
    (rows.length > shown.length ? `<tr><td colspan="${cols.length}" style="text-align:center"><button type="button" class="ghost small" id="plMoreRows">Show ${Math.min(500, rows.length - shown.length)} more of ${rows.length - shown.length} hidden rows</button></td></tr>` : '') +
    (Object.keys(tot).length ? `<tr style="font-weight:700;background:var(--gray-100)">` + cols.map((c, i) => `<td class="${i === 0 ? 'sticky1' : ''} ${c.type !== 'text' ? 'num' : ''}">${i === 0 ? 'Total (' + rows.length + ')' : tot[c.key] != null ? plF(tot[c.key]) : ''}</td>`).join('') + '</tr>' : '');
  tbl.querySelectorAll('tbody tr[data-code]').forEach(tr => tr.addEventListener('dblclick', () => plRowOpen(tr.dataset.code)));
  const mb = PLQ('#plMoreRows'); if (mb) mb.addEventListener('click', () => { plTbl.limit += 500; plRenderTable(); });
}
function plColPop() {
  let p = PLQ('#plColPop'); if (p) { p.remove(); return; } p = document.createElement('div'); p.id = 'plColPop'; p.className = 'pl-pop'; p.style.cssText += ';right:20px;max-height:380px;overflow:auto;min-width:260px';
  const cols = plColsFor(); p.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Columns in “${plEsc(plTbl.sec)}”</div><div class="btn-row" style="margin-bottom:6px"><button type="button" class="ghost small" data-a="all">All</button><button type="button" class="ghost small" data-a="none">None</button></div>` + cols.map(c => `<label style="display:flex;gap:6px;font-size:12px;padding:2px 0"><input type="checkbox" data-k="${plEsc(c.key)}" ${plTbl.hidden.has(c.key) ? '' : 'checked'}/> ${plEsc(c.label)}</label>`).join('');
  p.addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; e.target.checked ? plTbl.hidden.delete(k) : plTbl.hidden.add(k); plRenderTable(); });
  p.addEventListener('click', e => { const a = e.target.dataset.a; if (!a) return; cols.forEach(c => a === 'all' ? plTbl.hidden.delete(c.key) : plTbl.hidden.add(c.key)); plRenderTable(); p.querySelectorAll('input').forEach(i => { i.checked = a === 'all'; }); });
  const card = PLQ('#plTableCard'); card.style.position = 'relative'; card.appendChild(p); p.style.top = '46px';
}

/* ---------- SKU record card ---------- */
function plRowOpen(code) {
  const o = pl.rows.find(r => r.code === code); if (!o) return; const prev = pl.prev ? plObjs(pl.prev).find(r => r.code === code) : null;
  let m = PLQ('#plRowModal'); if (!m) { m = document.createElement('div'); m.id = 'plRowModal'; m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99997;display:flex;align-items:center;justify-content:center;padding:20px'; document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m || e.target.dataset.x) m.style.display = 'none'; }); }
  const cols = plAllCols(pl.cur), by = {}; cols.forEach(c => { (by[c.section] = by[c.section] || []).push(c); });
  const hist = pl.dates.slice(-30).map(d => { const r = plObjs(pl.map.get(d)).find(x => x.code === code); return r ? r.totalSOH : null; });
  m.innerHTML = `<div class="card" style="max-width:860px;width:100%;max-height:92vh;overflow:auto;margin:0"><div class="card-header"><div class="card-title">${plEsc(o.code)} · ${plEsc(o.item)}</div><button class="ghost small" data-x="1" type="button">✖ Close</button></div>
  <div style="margin:2px 0 8px">${plPill(o, '_health')} ${plPill(o, '_paceClass')} <span class="text-sm" style="color:var(--gray-600)">${plEsc(o._flags || '')} · snapshot ${plEsc(pl.cur.asOf)}</span></div><div id="plRowSpark"></div>` +
    Object.keys(by).map(s => `<div style="font-weight:700;margin:10px 0 4px">${plEsc(s)}</div><table class="pl-tbl"><tbody>${by[s].filter(c => c.key !== 'code' && c.key !== 'item').map(c => { const v = o[c.key], pv = prev ? prev[c.key] : null, d = typeof v === 'number' && typeof pv === 'number' ? v - pv : null; return v == null || v === '' ? '' : `<tr><td style="width:46%">${plEsc(c.label)}</td><td class="${c.type !== 'text' ? 'n' : ''}"><b>${plCellHtml(o, c)}</b></td><td style="color:var(--gray-500);width:22%">${d ? (d > 0 ? '▲ ' : '▼ ') + plEsc(plF(Math.abs(d), Math.abs(d) < 10 ? 2 : 0)) : ''}</td></tr>`; }).join('')}</tbody></table>`).join('') + '</div>';
  m.style.display = 'flex'; if (hist.filter(v => v != null).length > 1) { const sp = plcSpark(hist, plT().act, 300, 40); const h = PLQ('#plRowSpark'); h.innerHTML = '<div class="text-sm" style="color:var(--gray-600)">Total stock on hand — last snapshots</div>'; h.appendChild(sp); }
}

/* ---------- sector summaries ---------- */
function plStats(rows) {
  const tg = pl.cur.timeGone || 0, fc = plSum(rows, 'monthlyFcst'), mtd = plSum(rows, 'mtdSales'), H = x => rows.filter(o => /^(Out of stock|Critical)/.test(o._health)).length;
  return { n: rows.length, soh: plSum(rows, 'totalSOH'), rel: plSum(rows, 'releasedSOH'), inc: plSum(rows, 'incubation'), hold: plSum(rows, 'onHold'), fc, mtd, pct: fc ? mtd / fc : null, pace: fc && tg ? mtd / fc / tg : null, cover: plCover(rows), risk: H(), low: rows.filter(o => /^Low/.test(o._health)).length, excess: rows.filter(o => /^Excess/.test(o._health)).length, near: plSum(rows, 'nearExpiry') };
}
const plSectorDims = () => plDims().filter(d => !/^_/.test(d.key) || d.key === '_health');
function plSectorList(dim) { return plGroup(pl.view, dim).sort((a, b) => plSum(b.rows, 'totalSOH') - plSum(a.rows, 'totalSOH')).map(g => Object.assign({ key: g.key, rows: g.rows }, { s: plStats(g.rows) })); }
function plFilterText() { const p = pl.conds.map(c => { const lab = plLabel(c.key); return c.op === 'in' ? `${lab}: ${c.vals.join(', ')}` : c.op === 'range' ? `${lab}: ${c.min == null ? '' : c.min}–${c.max == null ? '' : c.max}` : c.op === 'contains' ? `${lab} contains “${c.text}”` : `${lab} ${c.op === 'empty' ? 'is empty' : 'has a value'}`; }); if (pl.q.length) p.push('Search: ' + pl.q.join(', ')); return p.join(' · ') || 'No filters (all SKUs)'; }
const mH = { th: 'border:1px solid #cbd5e1;padding:5px 8px;background:#f1f5f9;text-align:right;font-size:12px;font-family:Segoe UI,Arial,sans-serif;', td: 'border:1px solid #e2e8f0;padding:5px 8px;font-size:12px;text-align:right;font-family:Segoe UI,Arial,sans-serif;' };
const mTone = (v, g, w) => v == null ? '#475569' : v >= g ? '#0b7a0b' : v >= w ? '#b45309' : '#b91c1c';
function mBar(p, color) { const w = Math.max(0, Math.min(100, Math.round((p || 0) * 100))); return `<table style="border-collapse:collapse;width:90px;display:inline-table"><tr><td style="background:${color};height:8px;width:${w}%;padding:0"></td><td style="background:#e2e8f0;height:8px;padding:0"></td></tr></table>`; }
function plSectorRowHtml(g) { const s = g.s; return `<tr><td style="${mH.td}text-align:left;font-weight:600">${plEsc(g.key)}</td><td style="${mH.td}">${plF(s.n)}</td><td style="${mH.td}">${plF(s.soh)}</td><td style="${mH.td}">${plF(s.rel)}</td><td style="${mH.td}">${plF(s.inc)}</td><td style="${mH.td}">${plF(s.hold)}</td><td style="${mH.td}">${s.cover == null ? '—' : plF(s.cover, 1)}</td><td style="${mH.td}">${plF(s.fc)}</td><td style="${mH.td}">${plF(s.mtd)}</td><td style="${mH.td}text-align:left;white-space:nowrap">${mBar(s.pct, '#2a78d6')} <b style="color:${mTone(s.pace, 0.95, 0.8)}">${s.pct == null ? '—' : plP(s.pct, 0)}</b></td><td style="${mH.td}color:${s.risk ? '#b91c1c' : '#475569'}">${s.risk}</td><td style="${mH.td}">${s.excess}</td></tr>`; }
const PL_SEC_HEAD = ['Sector', 'SKUs', 'Total stock', 'Released', 'Incubation', 'On hold', 'Cover (d)', 'Forecast', 'MTD sales', '% of forecast', 'At-risk SKUs', 'Excess SKUs'];
function plSectorTable(list, dimLabel) { const tot = plStats(list.flatMap(g => g.rows)); return `<table style="border-collapse:collapse"><tr>${PL_SEC_HEAD.map((h, i) => `<th style="${mH.th}${i === 0 ? 'text-align:left' : ''}">${i === 0 ? plEsc(dimLabel) : h}</th>`).join('')}</tr>${list.map(plSectorRowHtml).join('')}${plSectorRowHtml({ key: 'Total', s: tot }).replace(/<td/g, '<td').replace('font-weight:600', 'font-weight:700;background:#f8fafc')}</table>`; }
function plAttention(rows, n) { return rows.filter(o => /^(Out of stock|Critical|Low)/.test(o._health) && (o.monthlyFcst || 0) > 0).sort((a, b) => (a.docReleased || 0) - (b.docReleased || 0) || b.monthlyFcst - a.monthlyFcst).slice(0, n); }
function plSectorBlock(g, dimLabel) {
  const s = g.s, t = (k, v, c) => `<td style="padding:6px 14px 6px 0;font-family:Segoe UI,Arial,sans-serif"><div style="font-size:11px;color:#64748b">${k}</div><div style="font-size:16px;font-weight:700;color:${c || '#0f172a'}">${v}</div></td>`;
  const at = plAttention(g.rows, 6), top = g.rows.slice().sort((a, b) => (b.totalSOH || 0) - (a.totalSOH || 0)).slice(0, 5);
  const mini = (arr, f) => `<table style="border-collapse:collapse;margin-top:3px">${arr.map(o => `<tr><td style="${mH.td}text-align:left">${plEsc(o.code)} · ${plEsc(plTrunc(o.item, 200))}</td>${f(o)}</tr>`).join('')}</table>`;
  return `<div style="margin:16px 0 4px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:700;border-bottom:2px solid #2a78d6;padding-bottom:3px">${plEsc(dimLabel)}: ${plEsc(g.key)}</div><table style="border-collapse:collapse"><tr>${t('SKUs', plF(s.n))}${t('Total stock (CT)', plF(s.soh))}${t('Released', plF(s.rel))}${t('Incubation', plF(s.inc))}${t('On hold', plF(s.hold), s.hold ? '#b45309' : '')}${t('Days cover', s.cover == null ? '—' : plF(s.cover, 1))}</tr><tr>${t('Forecast', plF(s.fc))}${t('MTD sales', plF(s.mtd))}${t('% of forecast', s.pct == null ? '—' : plP(s.pct, 1), mTone(s.pace, .95, .8))}${t('Sales pace', s.pace == null ? '—' : s.pace.toFixed(2) + '×', mTone(s.pace, .95, .8))}${t('At-risk SKUs', s.risk, s.risk ? '#b91c1c' : '')}${t('Excess SKUs', s.excess)}</tr></table>` +
    (at.length ? `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:12px;font-weight:600;margin-top:6px;color:#b91c1c">Needs attention (lowest cover with demand)</div>` + mini(at, o => `<td style="${mH.td}">${o.docReleased == null ? '—' : plF(o.docReleased, 1) + ' d'}</td><td style="${mH.td}text-align:left">${plEsc(o._health)}</td>`) : '') +
    `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:12px;font-weight:600;margin-top:6px;color:#334155">Largest stock positions</div>` + mini(top, o => `<td style="${mH.td}">${plF(o.totalSOH)}</td><td style="${mH.td}">${o.docReleased == null ? '—' : plF(o.docReleased, 1) + ' d'}</td>`);
}
function plMailHtml(secs, dim, o) {
  o = o || {}; const dimLabel = plLabel(dim), all = pl.view, s = plStats(all), kp = (k, v, c) => `<td style="padding:8px 16px 8px 0;font-family:Segoe UI,Arial,sans-serif"><div style="font-size:11px;color:#64748b">${k}</div><div style="font-size:20px;font-weight:700;color:${c || '#0f172a'}">${v}</div></td>`;
  const head = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:1000px"><h2 style="margin:0 0 2px">Planning Dept. — Inventory &amp; Sales Dashboard</h2><div style="color:#64748b;font-size:12px;margin-bottom:8px">As of <b>${plEsc(pl.cur.asOf)}</b> · day ${pl.cur.dayNo || '?'} of ${pl.cur.daysInMonth || '?'} (time gone ${plP(pl.cur.timeGone || 0, 0)}) · ${plEsc(o.scopeLabel || plFilterText())}</div>`;
  const kpi = o.noKpi ? '' : `<table style="border-collapse:collapse"><tr>${kp('Total stock (CT)', plF(s.soh))}${kp('Released', plF(s.rel))}${kp('Incubation', plF(s.inc))}${kp('On hold', plF(s.hold))}${kp('Days cover', s.cover == null ? '—' : plF(s.cover, 1))}</tr><tr>${kp('Forecast', plF(s.fc))}${kp('MTD sales', plF(s.mtd))}${kp('% of forecast', s.pct == null ? '—' : plP(s.pct, 1), mTone(s.pace, .95, .8))}${kp('At-risk SKUs', s.risk, s.risk ? '#b91c1c' : '')}${kp('Excess SKUs', s.excess)}</tr></table>`;
  const msg = o.message ? `<p style="white-space:pre-wrap;font-size:13px">${plEsc(o.message)}</p>` : '';
  const ov = o.noOverview ? '' : `<div style="font-size:14px;font-weight:700;margin:14px 0 4px;font-family:Segoe UI,Arial,sans-serif">Summary by ${plEsc(dimLabel)}</div>` + plSectorTable(secs, dimLabel);
  return head + msg + kpi + ov + secs.map(g => plSectorBlock(g, dimLabel)).join('') + `<div style="color:#94a3b8;font-size:11px;margin-top:16px;font-family:Segoe UI,Arial,sans-serif">Cover = released stock ÷ daily forecast. At-risk = out of stock or under ${plThr().crit} days of cover. Excess = over ${plThr().high} days. Full SKU detail is in the attached Excel file.</div></div>`;
}
function plSecRows(g) { const s = g.s; return [g.key, s.n, s.soh, s.rel, s.inc, s.hold, s.cover == null ? '' : +s.cover.toFixed(1), s.fc, s.mtd, s.pct == null ? '' : +(s.pct * 100).toFixed(1), s.risk, s.excess]; }
function plWorkbook(secs, dim, only) {
  const wb = XLSX.utils.book_new(), dl = plLabel(dim), head = PL_SEC_HEAD.slice(); head[0] = dl; head[9] = '% of forecast (%)';
  const sum = [['Planning Dept. — Inventory & Sales summary'], ['As of ' + pl.cur.asOf + ' · ' + (only ? 'Sector: ' + secs[0].key : plFilterText())], [], head].concat(secs.map(plSecRows));
  if (!only) sum.push(plSecRows({ key: 'Total', s: plStats(secs.flatMap(g => g.rows)) }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), 'Summary by ' + dl.slice(0, 18));
  const cols = plAllCols(pl.cur), rows = secs.flatMap(g => g.rows);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cols.map(c => c.label)].concat(rows.map(o => cols.map(c => { const v = o[c.key]; return v == null ? '' : v; })))), 'SKU data');
  if (!only) secs.slice(0, 40).forEach(g => { const nm = String(g.key).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 28) || 'Sector'; let n = nm, i = 2; while (wb.SheetNames.includes(n)) n = nm.slice(0, 25) + ' ' + i++; XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cols.map(c => c.label)].concat(g.rows.map(o => cols.map(c => { const v = o[c.key]; return v == null ? '' : v; })))), n); });
  return wb;
}
const plB64 = wb => XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
function plExcel() { if (!pl.cur) return; const dim = plCtlGet('share', 'dim', 'brand'), list = plSectorList(dim); XLSX.writeFile(plWorkbook(list, dim), `Planning_Dashboard_${pl.cur.asOf}.xlsx`); addActivity('export', `Planning dashboard Excel (${pl.view.length} SKUs)`); }
function plPrint() {
  if (!pl.cur) return; const dim = plCtlGet('share', 'dim', 'brand'), list = plSectorList(dim), tot = plStats(pl.view);
  const rows = list.map(plSecRows), totals = plSecRows({ key: 'Total', s: tot });
  w_printTable('Planning Dept. — Summary by ' + plLabel(dim), `As of ${pl.cur.asOf} · ${plFilterText()}`, PL_SEC_HEAD.map((h, i) => i === 0 ? plLabel(dim) : h), rows, totals);
}

/* ---------- share modal ---------- */
function plShareOpen() {
  if (!pl.cur) return; let m = PLQ('#plShare');
  if (!m) {
    m = document.createElement('div'); m.id = 'plShare';
    m.innerHTML = `<div class="pl-sc"><div class="card-header"><div class="card-title">📧 Share the dashboard &amp; sector summaries by email</div><button class="ghost small" data-x="1" type="button">✖ Close</button></div>
    <div class="form-grid"><div class="form-group"><label>To <span class="hint">— comma separated</span></label><input type="text" id="plShTo" /></div><div class="form-group"><label>Cc</label><input type="text" id="plShCc" /></div>
    <div class="form-group"><label>Subject</label><input type="text" id="plShSubj" /></div>
    <div class="form-group"><label>Sector = split the summary by</label><select id="plShDim"></select></div></div>
    <div class="form-group"><label>Message <span class="hint">— optional</span></label><textarea id="plShMsg" rows="2"></textarea></div>
    <div style="display:flex;justify-content:space-between;align-items:center"><b>Sectors to include <span id="plShCnt" class="text-sm" style="font-weight:400"></span></b><span><button type="button" class="ghost small" id="plShAll">All</button> <button type="button" class="ghost small" id="plShNone">None</button></span></div>
    <div class="pl-secs" id="plShSecs"></div>
    <div class="form-group"><label>How to send</label><label style="display:flex;gap:6px;font-weight:400"><input type="radio" name="plShMode" value="one" checked /> One email with the whole dashboard + a summary block for every selected sector</label><label style="display:flex;gap:6px;font-weight:400"><input type="radio" name="plShMode" value="each" /> A separate email for every selected sector (each only contains that sector)</label></div>
    <div class="form-group" id="plShMapBox" style="display:none"><label>Different recipients per sector <span class="hint">— optional, one per line: <code>Sector name = a@x.com; b@y.com</code> (others go to “To”)</span></label><textarea id="plShMap" rows="3"></textarea></div>
    <label style="display:flex;gap:6px;font-size:13px"><input type="checkbox" id="plShAtt" checked /> Attach Excel (summary + SKU data${'' } + a sheet per sector)</label>
    <div class="text-sm" style="color:var(--gray-500);margin:6px 0">Uses the current snapshot and filters. Sectors are the groups of the chosen column inside the filtered data.</div>
    <div id="plShStatus" class="status-msg"></div>
    <div class="btn-row" style="margin-top:8px"><button id="plShSend" class="success" type="button">🚀 Send now</button><button id="plShDraft" class="secondary" type="button">📨 Create Outlook draft(s) (.eml)</button><button id="plShCopy" class="ghost small" type="button">📋 Copy</button></div></div>`;
    document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m || e.target.dataset.x) m.style.display = 'none'; });
    const st = (t, c) => { const e = PLQ('#plShStatus'); e.className = 'status-msg ' + (c || 'info'); e.textContent = t; };
    m._st = st;
    const fillSecs = () => { const dim = PLQ('#plShDim').value; plCtlSet('share', 'dim', dim); const l = plSectorList(dim); PLQ('#plShSecs').innerHTML = l.map((g, i) => `<label><input type="checkbox" data-i="${i}" checked /> <span>${plEsc(g.key)} <small style="color:var(--gray-500)">(${g.s.n} SKUs · ${plK(g.s.soh)})</small></span></label>`).join(''); m._list = l; cnt(); };
    const cnt = () => { const n = m.querySelectorAll('#plShSecs input:checked').length; PLQ('#plShCnt').textContent = `— ${n} of ${(m._list || []).length} selected`; };
    m.querySelector('#plShDim').addEventListener('change', fillSecs); PLQ('#plShSecs').addEventListener('change', cnt);
    PLQ('#plShAll').addEventListener('click', () => { m.querySelectorAll('#plShSecs input').forEach(i => { i.checked = true; }); cnt(); }); PLQ('#plShNone').addEventListener('click', () => { m.querySelectorAll('#plShSecs input').forEach(i => { i.checked = false; }); cnt(); });
    m.querySelectorAll('input[name=plShMode]').forEach(r => r.addEventListener('change', () => { PLQ('#plShMapBox').style.display = m.querySelector('input[name=plShMode]:checked').value === 'each' ? '' : 'none'; }));
    const jobs = () => {
      const sel = Array.from(m.querySelectorAll('#plShSecs input:checked')).map(i => m._list[+i.dataset.i]); if (!sel.length) throw new Error('Select at least one sector.');
      const dim = PLQ('#plShDim').value, mode = m.querySelector('input[name=plShMode]:checked').value, msg = PLQ('#plShMsg').value.trim(), subj = PLQ('#plShSubj').value.trim() || ('Planning dashboard — ' + pl.cur.asOf), att = PLQ('#plShAtt').checked, stamp = pl.cur.asOf, to = PLQ('#plShTo').value.trim(), cc = PLQ('#plShCc').value.trim();
      const map = {}; PLQ('#plShMap').value.split(/\n/).forEach(l => { const i = l.indexOf('='); if (i > 0) map[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); });
      if (mode === 'one') return [{ to, cc, subject: subj, html: plMailHtml(sel, dim, { message: msg }), att: att ? { fileName: `Planning_Dashboard_${stamp}.xlsx`, dataB64: plB64(plWorkbook(sel, dim)) } : null, label: 'dashboard' }];
      return sel.map(g => ({ to: map[String(g.key).toLowerCase()] || to, cc, subject: `${subj} — ${g.key}`, html: plMailHtml([g], dim, { message: msg, noOverview: true, scopeLabel: `${plLabel(dim)}: ${g.key}` + (pl.conds.length || pl.q.length ? ' · ' + plFilterText() : '') }), att: att ? { fileName: `Planning_${String(g.key).replace(/\W+/g, '_')}_${stamp}.xlsx`, dataB64: plB64(plWorkbook([g], dim, true)) } : null, label: g.key }));
    };
    PLQ('#plShSend').addEventListener('click', async () => {
      const b = PLQ('#plShSend'); if (b.disabled) return; try {
        const js = jobs(); if (js.some(j => !j.to)) throw new Error('Enter at least one recipient in “To” (or a recipient for every sector).'); b.disabled = true; let ok = 0, how = '';
        for (const j of js) { st(`Sending ${ok + 1} of ${js.length}: ${j.label}…`); how = await mailSend_send({ to: j.to, cc: j.cc, subject: j.subject, html: j.html, attachment: j.att }); ok++; }
        st(`✅ ${ok} email(s): ${how}.`, 'success'); addActivity('email', `Planning dashboard e-mail sent (${ok} message(s))`); try { localStorage.setItem(LS_BASE + '_pl_mail', JSON.stringify({ to: PLQ('#plShTo').value, cc: PLQ('#plShCc').value })); } catch (e) {}
      } catch (e) { st('✘ ' + e.message, 'error'); } finally { b.disabled = false; }
    });
    PLQ('#plShDraft').addEventListener('click', async () => {
      try { const js = jobs(); if (js.some(j => !j.to)) throw new Error('Enter at least one recipient in “To” (or a recipient for every sector).');
        for (let i = 0; i < js.length; i++) { const j = js[i], eml = expEmail_buildEml(j.html, j.subject, j.to, j.cc, j.att ? { format: 'xlsx', fileName: j.att.fileName, dataB64: j.att.dataB64 } : null), url = URL.createObjectURL(new Blob([eml], { type: 'message/rfc822' })), a = document.createElement('a'); a.href = url; a.download = `Planning_${String(j.label).replace(/\W+/g, '_')}_${pl.cur.asOf}.eml`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 6000); await new Promise(r => setTimeout(r, 350)); }
        st(`✅ ${js.length} draft file(s) downloaded. Open them in Outlook, review and Send (your browser may ask to allow multiple downloads).`, 'success'); addActivity('email', `Planning dashboard draft(s) (${js.length})`);
      } catch (e) { st('✘ ' + e.message, 'error'); } });
    PLQ('#plShCopy').addEventListener('click', async () => { try { const js = jobs(), html = js.map(j => j.html).join('<hr>'), plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); if (navigator.clipboard && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]); else await navigator.clipboard.writeText(plain); st('✅ Copied. Paste into a new email (Ctrl+V).', 'success'); } catch (e) { st('✘ ' + e.message, 'error'); } });
  }
  const dims = plSectorDims(), want = plCtlGet('share', 'dim', 'brand'), ds = PLQ('#plShDim'); ds.innerHTML = dims.map(d => `<option value="${plEsc(d.key)}" ${d.key === (dims.some(x => x.key === want) ? want : (dims[0] || {}).key) ? 'selected' : ''}>${plEsc(d.label)}</option>`).join('');
  try { const s = JSON.parse(localStorage.getItem(LS_BASE + '_pl_mail') || '{}'); PLQ('#plShTo').value = s.to || ''; PLQ('#plShCc').value = s.cc || ''; } catch (e) {}
  try { applyEmailDefaults(PLQ('#plShTo'), PLQ('#plShCc'), true); } catch (e) {}
  PLQ('#plShSubj').value = 'Planning dashboard — ' + pl.cur.asOf; PLQ('#plShSend').textContent = mailSend_label(); m._st('', 'info');
  ds.dispatchEvent(new Event('change')); m.style.display = 'flex';
}

/* ---------- thresholds popover ---------- */
function plThrPop() {
  let p = PLQ('#plThrPop'); if (p) { p.remove(); return; } const t = plThr(); p = document.createElement('div'); p.id = 'plThrPop'; p.className = 'pl-pop'; p.style.cssText += ';right:20px;top:72px;position:fixed;min-width:280px';
  p.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Days-of-cover thresholds</div><div class="text-sm" style="color:var(--gray-600);margin-bottom:6px">Cover = released stock ÷ daily forecast. Used for the health colours, KPIs and e-mails.</div><div class="form-grid"><div class="form-group"><label>Critical below (days)</label><input type="number" id="plT1" value="${t.crit}" min="0"/></div><div class="form-group"><label>Low below (days)</label><input type="number" id="plT2" value="${t.low}" min="0"/></div><div class="form-group"><label>Excess above (days)</label><input type="number" id="plT3" value="${t.high}" min="0"/></div></div><div class="btn-row" style="margin-top:8px"><button type="button" id="plTOk" class="success small">Apply</button><button type="button" id="plTReset" class="ghost small">Reset</button></div>`;
  document.body.appendChild(p);
  const ap = th => { plCfgSave({ thr: th }); p.remove(); pl.conds = pl.conds.filter(c => c.key !== '_health'); plSetCur(); plRefresh(); };
  p.querySelector('#plTOk').addEventListener('click', () => { const a = +PLQ('#plT1').value, b = +PLQ('#plT2').value, c = +PLQ('#plT3').value; if (!(a >= 0 && b > a && c >= b)) { sectionToast('Use: critical < low ≤ excess.', 'warn'); return; } ap({ crit: a, low: b, high: c }); });
  p.querySelector('#plTReset').addEventListener('click', () => ap({ crit: 7, low: 15, high: 45 }));
}

/* ---------- open / wiring ---------- */
let plInited = false, plOpenBusy = false;
async function plOpen() {
  if (plOpenBusy) return; plOpenBusy = true;
  try {
    await plLoadAll(); const has = !!pl.cur; PLQ('#plEmpty').style.display = has ? 'none' : ''; PLQ('#plMain').style.display = has ? '' : 'none';
    if (has) { PLQ('#plSecTabs'); plSearchInit(); pl.conds = pl.conds.filter(c => !c.key || pl.colMap[c.key]); plRefresh(); }
    if (!plOpen.synced) { plOpen.synced = true; try { if (getGlobalAccessToken() && getGlobalSiteUrl()) { const r = await plSync(false); if (r.fetched) { await plLoadAll(pl.date); PLQ('#plEmpty').style.display = 'none'; PLQ('#plMain').style.display = ''; plSearchInit(); plRefresh(); sectionToast(`☁ ${r.fetched} planning snapshot(s) loaded from SharePoint.`, 'ok'); } } } catch (e) { /* offline or not configured: local snapshots only */ } }
  } catch (e) { console.error(e); sectionToast('Planning: ' + e.message, 'error'); } finally { plOpenBusy = false; }
}
function plInit() {
  if (plInited) return; plInited = true; plUpInit(); plFiltersInit();
  PLQ('#plGoUpload').addEventListener('click', () => plGo('planning-upload')); PLQ('#plUploadGo').addEventListener('click', () => plGo('planning-upload'));
  PLQ('#plSnapSel').addEventListener('change', e => { pl.date = e.target.value; plCfgSave({ sel: pl.date }); plSetCur(); plRefresh(); });
  const step = d => { const i = pl.dates.indexOf(pl.date) + d; if (i >= 0 && i < pl.dates.length) { pl.date = pl.dates[i]; plCfgSave({ sel: pl.date }); plSetCur(); plRefresh(); } };
  PLQ('#plPrevBtn').addEventListener('click', () => step(-1)); PLQ('#plNextBtn').addEventListener('click', () => step(1));
  PLQ('#plEmailBtn').addEventListener('click', plShareOpen); PLQ('#plPrintBtn').addEventListener('click', plPrint); PLQ('#plExcelBtn').addEventListener('click', plExcel); PLQ('#plSetBtn').addEventListener('click', plThrPop); PLQ('#plColBtn').addEventListener('click', plColPop);
  document.addEventListener('mousedown', e => { const p = PLQ('#plColPop'); if (p && !e.composedPath().includes(p) && e.target.id !== 'plColBtn') p.remove(); const q = PLQ('#plThrPop'); if (q && !e.composedPath().includes(q) && e.target.id !== 'plSetBtn') q.remove(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const f = document.querySelector('.pl-card.pl-full'); if (f) { f.classList.remove('pl-full'); const b = f.querySelector('[data-a=full]'); if (b) b.textContent = '⤢'; plRedrawAll(); } } });
  const act = () => { const v = document.querySelector('.view.active'); return v && v.id === 'view-planning'; };
  new MutationObserver(() => { if (act() && pl.cur) plRedrawAll(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  let rt; const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (act() && pl.cur) plRedrawAll(); }, 150); }); ro.observe(PLQ('#plGrid'));
}
document.querySelectorAll('.nav-item[data-view="planning"],.nav-item[data-view="planning-upload"]').forEach(n => n.addEventListener('click', () => {
  plInit(); if (n.dataset.view === 'planning') setTimeout(plOpen, 0); else { plHistRender(); plUpStatus && 0; }
}));


/* ============================================================
   DAILY PLAN (Kizad production / demand plan) — parser, storage, upload
   ============================================================ */
const dpIso = d => plIso(new Date((d instanceof Date ? d : new Date(d)).getTime() + 6 * 3600e3));   // robust against SheetJS time-zone drift
const dpNorm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
const DP_ITEM = { 'icode': ['code', 'ICODE'], 'item_desc': ['item', 'Item'], 'prod_in': ['prodIn', 'Produced in'], 'type': ['type', 'Type'], 'brand': ['brand', 'Brand'], 'category': ['category', 'Category'], 'sub_categ': ['subCateg', 'Sub-category'], 'uom': ['uom', 'UoM'], 'fill_size': ['fillSize', 'Fill size'] };
const DP_PARAM = { 'ltr conv': ['ltrConv', 'Litres per UoM'], 'batch size in ltrs': ['batchLtr', 'Batch size (litres)'], 'pcs per crt': ['pcsCrt', 'Pcs / crate'], 'crt per pallet': ['crtPallet', 'Crates / pallet'], 'unit per pallet': ['unitPallet', 'Units / pallet'], 'p': ['palletType', 'Pallet type'] };
const DP_MET = { pal: 'Pallets', crt: 'Crates', ltr: 'Litres', dem: 'Demand (units)', bat: 'Batches' };
const dpDayLbl = d => { const t = new Date(d + 'T12:00:00'); return isNaN(t) ? d : t.getDate() + ' ' + t.toLocaleString('en', { month: 'short' }); };
const dpDayLong = d => { const t = new Date(d + 'T12:00:00'); return isNaN(t) ? d : t.toLocaleString('en', { weekday: 'short' }) + ' ' + dpDayLbl(d); };

function dpParseSheet(ws, fileName) {
  if (!ws || !ws['!ref']) throw new Error('The first sheet is empty.');
  const ref = XLSX.utils.decode_range(ws['!ref']), nC = ref.e.c + 1, nR = ref.e.r + 1;
  const g = (r, c) => plCellVal(ws[XLSX.utils.encode_cell({ r, c })]), num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  let H = -1; for (let r = 0; r <= Math.min(nR - 1, 40); r++) { const v = g(r, 0); if (typeof v === 'string' && dpNorm(v) === 'icode') { H = r; break; } }
  if (H < 0) throw new Error('Could not find the header row (a cell “ICODE” in column A). Is this the daily plan / demand sheet?');
  const warnings = [], itemCols = {}, paramCols = {};
  for (let c = 0; c < nC; c++) { const v = g(H, c); if (typeof v !== 'string') continue; const h = dpNorm(v); if (DP_ITEM[h] && itemCols[DP_ITEM[h][0]] == null) itemCols[DP_ITEM[h][0]] = c; else if (DP_PARAM[h] && paramCols[DP_PARAM[h][0]] == null) paramCols[DP_PARAM[h][0]] = c; }
  if (itemCols.code == null || itemCols.item == null) throw new Error('The ICODE / ITEM_DESC columns were not found.');
  // ---- blocks: runs of location columns closed by "GRAND TOTAL"
  const first = Math.max.apply(null, Object.values(itemCols)) + 1, blocksRaw = []; let cur = [];
  for (let c = first; c < nC; c++) {
    const hv = g(H, c), h = typeof hv === 'string' ? dpNorm(hv) : '';
    if (!h || DP_PARAM[h]) { cur = []; continue; }
    cur.push({ c, label: String(hv).replace(/\s+/g, ' ').trim().toUpperCase() }); if (h === 'grand total') { blocksRaw.push(cur); cur = []; }
  }
  if (!blocksRaw.length) throw new Error('No location blocks (… GRAND TOTAL) were found to the right of the item columns.');
  const blocks = blocksRaw.map((b, i) => {
    const s = b[0].c, e = b[b.length - 1].c; let metric = 'dem', date = '';
    for (let c = s; c <= e; c++) { const t = g(H - 2, c); if (typeof t === 'string') { if (/crt|crate|carton/i.test(t)) metric = 'crt'; else if (/pallet/i.test(t)) metric = 'pal'; else if (/trip/i.test(t)) metric = 'trip'; } }
    for (let c = s; c <= e && !date; c++) { const t = g(H - 1, c); if (t instanceof Date) date = dpIso(t); else if (typeof t === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t)) date = t.slice(0, 10); }
    return { i, s, e, metric, date, cols: b, ix: {} };
  }).filter(b => b.metric !== 'trip');
  const demB = blocks.filter(b => b.metric === 'dem'); if (!demB.length) throw new Error('No demand block found.');
  const canon = demB[0].cols.map(x => x.label).filter(l => l !== 'NE' && l !== 'SE' && l !== 'GRAND TOTAL'), locs = canon.slice(), L = locs.length;
  demB.forEach((b, k) => { if (!b.date) { b.date = 'Day ' + (k + 1); warnings.push({ level: 'warn', text: `Demand block ${k + 1} has no date above it — named “${b.date}”.` }); } });
  const days = []; demB.forEach(b => { if (!days.includes(b.date)) days.push(b.date); });
  blocks.forEach((b, k) => {
    if (!b.date) b.date = days[Math.min(k, days.length - 1)];
    b.ix = { locs: locs.map(l => { const f = b.cols.find(x => x.label === l); return f ? f.c : null; }), NE: (b.cols.find(x => x.label === 'NE') || {}).c, SE: (b.cols.find(x => x.label === 'SE') || {}).c, TOT: b.e };
    const miss = locs.filter((l, j) => b.ix.locs[j] == null); if (miss.length) warnings.push({ level: 'warn', text: `${DP_MET[b.metric]} block for ${b.date} has no column for ${miss.join(', ')}.` });
  });
  // ---- SKU rows
  const rows = []; let lastItem = H, seen = new Set(), dups = 0, neg = 0;
  for (let r = H + 1; r < nR; r++) {
    const code = g(r, itemCols.code), item = g(r, itemCols.item); if (code == null || item == null || /total/i.test(String(code))) continue;
    const o = { code: String(code).trim() }; Object.keys(itemCols).forEach(k => { const v = g(r, itemCols[k]); o[k] = v == null ? null : String(v).replace(/\s+/g, ' ').trim(); });
    Object.keys(paramCols).forEach(k => { const v = g(r, paramCols[k]); o[k] = k === 'palletType' ? (v == null ? null : String(v).trim()) : num(v); });
    o.v = { dem: {}, crt: {}, pal: {} };
    blocks.forEach(b => {
      const a = b.ix.locs.map(c => c == null ? 0 : (num(g(r, c)) || 0)), ne = b.ix.NE != null ? num(g(r, b.ix.NE)) : null, se = b.ix.SE != null ? num(g(r, b.ix.SE)) : null, tot = num(g(r, b.ix.TOT));
      if (a.some(x => x < 0) || (tot != null && tot < 0)) neg++;
      o.v[b.metric][b.date] = a.concat([ne == null ? 0 : ne, se == null ? 0 : se, tot == null ? a.reduce((x, y) => x + y, 0) + 0 : tot]);
    });
    // fall-backs when a metric block is missing: crates = units ÷ pcs per crate; pallets = crates ÷ crates per pallet
    days.forEach(d => {
      if (!o.v.dem[d]) o.v.dem[d] = new Array(L + 3).fill(0);
      if (!o.v.crt[d]) o.v.crt[d] = o.v.dem[d].map(x => o.pcsCrt ? x / o.pcsCrt : 0);
      if (!o.v.pal[d]) o.v.pal[d] = o.v.crt[d].map(x => o.crtPallet ? x / o.crtPallet : 0);
    });
    if (seen.has(o.code)) dups++; seen.add(o.code); rows.push(o); lastItem = r;
  }
  if (!rows.length) throw new Error('No SKU rows were found under the header.');
  const missingBlock = ['crt', 'pal'].filter(m => !blocks.some(b => b.metric === m)); if (missingBlock.length) warnings.push({ level: 'info', text: `No ${missingBlock.map(m => DP_MET[m].toLowerCase()).join(' / ')} block in the file — calculated from the units and the packing columns.` });
  if (dups) warnings.push({ level: 'warn', text: `${dups} SKU code(s) appear more than once.` });
  if (neg) warnings.push({ level: 'warn', text: `${neg} negative quantity value(s) found.` });
  const noCrt = rows.filter(o => days.some(d => o.v.pal[d][L + 2] > 0) && days.every(d => !(o.v.crt[d][L + 2] > 0))).length; if (noCrt) warnings.push({ level: 'info', text: `${noCrt} SKU(s) have pallets but no crate figure in the sheet (e.g. items counted in dozens) — the crate totals only count the other SKUs; pallets include all.` });
  const noLtr = rows.filter(o => !o.ltrConv).length; if (noLtr) warnings.push({ level: 'info', text: `${noLtr} SKU(s) have no “Ltr Conv” — their litres and batches show as 0.` });
  // ---- compare with the sheet's own grand-total row
  let gtRow = -1; for (let r = lastItem + 1; r <= Math.min(nR - 1, lastItem + 6); r++) { const txt = Object.values(itemCols).some(c => g(r, c) != null); if (!txt && blocks.some(b => num(g(r, b.ix.TOT)) != null)) { gtRow = r; break; } }
  if (gtRow >= 0) blocks.forEach(b => { const sheetV = num(g(gtRow, b.ix.TOT)); if (sheetV == null) return; const mine = rows.reduce((t, o) => t + o.v[b.metric][b.date][L + 2], 0); if (Math.abs(mine - sheetV) > Math.max(1, Math.abs(sheetV) * 0.005)) warnings.push({ level: b.metric === 'dem' ? 'info' : 'warn', text: `${DP_MET[b.metric]} ${dpDayLbl(b.date)}: the sheet’s total row shows ${plF(sheetV, 1)} but the SKU rows add up to ${plF(mine, 1)} — the dashboard uses the SKU rows (the total row in the file may be a typed-in value).` }); });
  // ---- figures the sheet calculated itself (trips etc.) — best effort
  const sheet = { totals: {}, tripsByLoc: {}, logi: {}, summary: {} };
  try {
    const blockAt = c => blocks.find(b => c >= b.s && c <= b.e);
    for (let r = lastItem + 1; r < nR; r++) for (let c = 0; c < nC; c++) {
      const t = g(r, c); if (typeof t !== 'string') continue; const n = dpNorm(t), b = blockAt(c + 1); if (!b) continue;
      const key = /^total crts?$/.test(n) ? 'crt' : /^total pallets?$/.test(n) ? 'pal' : n === 'trips' ? 'trips' : null; if (!key) continue;
      const tr = { NE: num(g(r, c + 1)), SE: num(g(r, c + 2)), TOT: num(g(r, c + 3)) }; if (tr.TOT != null) ((sheet.totals[b.date] = sheet.totals[b.date] || {})[key] = tr);
    }
    if (gtRow >= 0) blocks.filter(b => b.metric === 'pal').forEach(b => { const a = b.ix.locs.map(c => c == null ? null : num(g(gtRow + 1, c))); if (a.some(x => x != null)) sheet.tripsByLoc[b.date] = a.map(x => x || 0); });
    const logB = [];
    for (let r = lastItem + 1; r < nR; r++) for (let c = 0; c < nC; c++) {
      const t = g(r, c); if (typeof t !== 'string' || !/^pallet\s*&\s*cage/i.test(t.trim())) continue;
      let date = ''; for (let k = c; k < c + 9 && !date; k++) { const dv = g(r - 1, k); if (dv instanceof Date) date = dpIso(dv); }
      const hl = []; for (let k = c + 1; k < nC && typeof g(r, k) === 'string'; k++) hl.push({ k, l: String(g(r, k)).trim().toUpperCase() });
      const lg = { locs: hl.map(x => x.l) }; const map = { 'p12': 'P12', 'p6': 'P6', 'c1': 'C', 'cage': 'C', 'cages': 'C', 'total': 'Total', 'trips p12': 'tripsP12', 'trips p6+cages': 'tripsP6', 'total trips': 'totalTrips' };
      for (let q = r + 1; q <= r + 12 && q < nR; q++) { const lab = g(q, c); if (typeof lab !== 'string') continue; const k2 = map[dpNorm(lab)]; if (k2) lg[k2] = hl.map(x => num(g(q, x.k)) || 0); }
      if (date && lg.Total) { sheet.logi[date] = lg; logB.push({ date, c }); }
    }
    for (let r = lastItem + 1; r < nR; r++) for (let c = 0; c < nC; c++) {
      const t = g(r, c); if (typeof t !== 'string' || dpNorm(t) !== 'summary') continue; const lb = logB.find(x => x.c === c - 1); if (!lb) continue; const sm = {};
      for (let q = r + 1; q <= r + 8 && q < nR; q++) { const lab = g(q, c), v = num(g(q, c + 1)); if (typeof lab === 'string' && v != null) sm[lab.replace(/\s+/g, ' ').trim()] = v; }
      if (Object.keys(sm).length) sheet.summary[lb.date] = sm;
    }
  } catch (e) { warnings.push({ level: 'info', text: 'The sheet’s own trip / pallet summary could not be read completely (' + e.message + ').' }); }
  const snap = { v: 1, kind: 'dailyplan', planDate: days[0], days, locs, fileName: fileName || '', rows, sheet, warnings, savedAt: null, savedBy: '', blocks: blocks.map(b => ({ metric: b.metric, date: b.date })) };
  return snap;
}

/* ---------- storage: IndexedDB (this browser) + SharePoint library (everyone) ---------- */
const dpDB = { db: null, mem: new Map() };
function dpIdb() {
  return new Promise(res => {
    if (dpDB.db) return res(dpDB.db);
    try { const rq = indexedDB.open('nfpc_dailyplan', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('snaps', { keyPath: 'planDate' }); rq.onsuccess = () => { dpDB.db = rq.result; res(dpDB.db); }; rq.onerror = () => res(null); rq.onblocked = () => res(null); } catch (e) { res(null); }
  });
}
async function dpPut(s) { const db = await dpIdb(); if (!db) { dpDB.mem.set(s.planDate, s); return; } await new Promise((ok, no) => { const tx = db.transaction('snaps', 'readwrite'); tx.objectStore('snaps').put(JSON.parse(JSON.stringify(s, (k, v) => k.charAt(0) === '_' && k !== '_' ? undefined : v))); tx.oncomplete = ok; tx.onerror = () => no(tx.error); }); }
async function dpGet(k) { const db = await dpIdb(); if (!db) return dpDB.mem.get(k) || null; return new Promise(ok => { const rq = db.transaction('snaps').objectStore('snaps').get(k); rq.onsuccess = () => ok(rq.result || null); rq.onerror = () => ok(null); }); }
async function dpAll() { const db = await dpIdb(); if (!db) return Array.from(dpDB.mem.values()); return new Promise(ok => { const rq = db.transaction('snaps').objectStore('snaps').getAll(); rq.onsuccess = () => ok(rq.result || []); rq.onerror = () => ok([]); }); }
async function dpDel(k) { const db = await dpIdb(); if (!db) { dpDB.mem.delete(k); return; } await new Promise(ok => { const tx = db.transaction('snaps', 'readwrite'); tx.objectStore('snaps').delete(k); tx.oncomplete = ok; tx.onerror = ok; }); }
const DP_CFG_KEY = LS_BASE + '_dp_cfg';
const dpCfg = () => { try { return Object.assign({ folder: 'DailyPlan', sel: '' }, JSON.parse(localStorage.getItem(DP_CFG_KEY) || '{}')); } catch (e) { return { folder: 'DailyPlan', sel: '' }; } };
const dpCfgSave = o => { try { localStorage.setItem(DP_CFG_KEY, JSON.stringify(Object.assign(dpCfg(), o))); } catch (e) {} };
const dpFolder = () => encodeURIComponent((dpCfg().folder || 'DailyPlan').replace(/^\/+|\/+$/g, '') || 'DailyPlan');
const dpFile = d => `dailyplan_${d}.json`;
let dpSiteCache = '';
async function dpSp() {
  const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) throw new Error('Global Site URL / token not configured.');
  if (!dpSiteCache || dpSiteCache.url !== siteUrl) {
    const { hostname, sitePath } = parseSiteUrl(siteUrl), u = (!sitePath || sitePath === '/') ? `https://graph.microsoft.com/v1.0/sites/${hostname}` : `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`;
    const r = await fetchWithRetry(u, { headers: { Authorization: `Bearer ${token}` } }, 'resolve site'); if (!r.ok) throw new Error(`Site resolution failed (${r.status})`);
    dpSiteCache = { id: (await r.json()).id, url: siteUrl };
  }
  return { siteId: dpSiteCache.id, token };
}
async function dpSpSave(snap) {
  const { siteId, token } = await dpSp();
  const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${dpFolder()}/${dpFile(snap.planDate)}:/content`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(snap, (k, v) => k.charAt(0) === '_' ? undefined : v) }, 'save daily plan');
  if (!r.ok) { let t = ''; try { t = (await r.json()).error.message; } catch (e) {} throw new Error(`SharePoint said HTTP ${r.status}${t ? ': ' + t : ''}`); }
}
async function dpSpList() {
  const { siteId, token } = await dpSp();
  const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${dpFolder()}:/children?$top=200&$select=name,size,lastModifiedDateTime,@microsoft.graph.downloadUrl`, { headers: { Authorization: `Bearer ${token}` } }, 'list daily plans');
  if (r.status === 404) return []; if (!r.ok) throw new Error(`SharePoint said HTTP ${r.status}`);
  return ((await r.json()).value || []).filter(x => /^dailyplan_\d{4}-\d{2}-\d{2}\.json$/.test(x.name)).map(x => ({ planDate: x.name.slice(10, 20), name: x.name, size: x.size, modified: x.lastModifiedDateTime, url: x['@microsoft.graph.downloadUrl'] }));
}
async function dpSpLoad(it) {
  let r = it.url ? await fetch(it.url) : null;
  if (!r || !r.ok) { const { siteId, token } = await dpSp(); r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${dpFolder()}/${it.name}:/content`, { headers: { Authorization: `Bearer ${token}` } }, 'download daily plan'); }
  if (!r.ok) throw new Error(`Download failed (${r.status})`); return r.json();
}
const dpRemote = { list: [], at: 0 };
async function dpSync(all) {
  const list = await dpSpList(); dpRemote.list = list; dpRemote.at = Date.now();
  const have = new Set((await dpAll()).map(s => s.planDate)), want = list.slice().sort((a, b) => b.planDate.localeCompare(a.planDate)).filter(x => !have.has(x.planDate)).slice(0, all ? 120 : 40);
  let n = 0; for (const it of want) { try { const s = await dpSpLoad(it); if (s && s.planDate && s.rows && s.days) { s.remote = true; await dpPut(s); n++; } } catch (e) {} }
  return { remote: list.length, fetched: n };
}

/* ---------- upload page ---------- */
const dpUp = { snap: null };
function dpUpStatus(msg, type) { const el = PLQ('#dpParseStatus'); el.className = 'status-msg ' + (type || 'info'); el.textContent = msg; }
const dpSumOf = (s, m) => s.rows.reduce((t, o) => t + s.days.reduce((a, d) => a + o.v[m][d][s.locs.length + 2], 0), 0);
function dpLitres(s) { return s.rows.reduce((t, o) => t + s.days.reduce((a, d) => a + o.v.dem[d][s.locs.length + 2] * (o.ltrConv || 0), 0), 0); }
function dpUpRender() {
  const s = dpUp.snap, card = PLQ('#dpParseCard'); if (!s) { card.style.display = 'none'; return; }
  card.style.display = 'block'; PLQ('#dpPlanDate').value = s.planDate || ''; PLQ('#dpFileName').value = s.fileName; PLQ('#dpDays').value = s.days.map(dpDayLong).join(' · ');
  const tiles = [['SKUs', s.rows.length], ['Plan days', s.days.length], ['Locations', s.locs.join(' · ')], ['Pallets (all days)', plF(dpSumOf(s, 'pal'), 1)], ['Crates (all days)', plF(dpSumOf(s, 'crt'))], ['Litres (all days)', plF(dpLitres(s))], ['SKUs with demand', s.rows.filter(o => s.days.some(d => o.v.dem[d][s.locs.length + 2] > 0)).length]];
  PLQ('#dpSummary').innerHTML = tiles.map(t => `<div><small>${plEsc(t[0])}</small><b style="font-size:${String(t[1]).length > 14 ? 12 : 18}px">${plEsc(t[1])}</b></div>`).join('');
  PLQ('#dpWarn').innerHTML = s.warnings.map(w => `<div class="pl-w ${w.level}"><span>${w.level === 'error' ? '✖' : w.level === 'warn' ? '⚠' : 'ℹ'}</span><span>${plEsc(w.text)}</span></div>`).join('') || '<div class="pl-w info"><span>✔</span><span>All checks passed — the SKU rows match the sheet’s totals.</span></div>';
  dpLstSrcFill();
}
async function dpUpFile(f) {
  if (!f) return; dpUpStatus('Reading ' + f.name + '…', 'info');
  try {
    if (typeof XLSX === 'undefined') throw new Error('The Excel library is not loaded (check the internet connection).');
    const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true });
    let ws = wb.Sheets[wb.SheetNames[0]], used = wb.SheetNames[0];
    for (const n of wb.SheetNames) { const sh = wb.Sheets[n]; if (sh && sh['!ref'] && sh['!ref'].length && (wb.Workbook && wb.Workbook.Sheets && wb.Workbook.Sheets.find(x => x.name === n && x.Hidden))) continue; ws = sh; used = n; break; }   // first visible sheet
    dpUp.snap = dpParseSheet(ws, f.name);
    dpUpStatus(`✓ ${dpUp.snap.rows.length} SKU rows and ${dpUp.snap.days.length} plan day(s) read from “${used}”. Check the summary, then save.`, 'success'); dpUpRender();
  } catch (e) { dpUp.snap = null; dpUpRender(); dpUpStatus('✘ ' + e.message, 'error'); }
}
async function dpSaveSnapshot() {
  const s = dpUp.snap; if (!s) return; if (!hasPerm('dailyplan-upload')) { alert('Permission denied.'); return; }
  const d = PLQ('#dpPlanDate').value; if (!d) { PLQ('#dpSaveStatus').textContent = '⚠ Enter the plan date.'; return; }
  s.planDate = d;
  const old = await dpGet(s.planDate); if (old && !confirm(`A daily plan for ${s.planDate} already exists (saved ${old.savedAt ? new Date(old.savedAt).toLocaleString() : ''}). Replace it?`)) return;
  const st = PLQ('#dpSaveStatus'); s.savedAt = Date.now(); s.savedBy = (currentUser && (currentUser.username || currentUser.email)) || '';
  try { await dpPut(s); st.textContent = '✅ Saved in this browser.'; } catch (e) { st.textContent = '✘ ' + e.message; return; }
  if (PLQ('#dpSaveSP').checked) { try { st.textContent = '☁ Saving to SharePoint…'; await dpSpSave(s); s.remote = true; await dpPut(s); st.textContent = `✅ Saved in this browser and in SharePoint (${dpCfg().folder}/${dpFile(s.planDate)}).`; } catch (e) { st.textContent = '✅ Saved in this browser. ⚠ SharePoint: ' + e.message; } }
  addActivity('upload', `Daily plan ${s.planDate}: ${s.rows.length} SKUs, ${s.days.length} day(s) (${s.fileName})`);
  dpCfgSave({ sel: s.planDate }); dpLast.saved = s; dpUp.snap = null; PLQ('#dpParseCard').style.display = 'none';
  setTimeout(() => { dpHistRender(); dpLstSrcFill(); dpUpStatus('Saved. Open the Daily Plan Dashboard to analyse it, or upload the rows to a SharePoint list below.', 'success'); }, 0);
}
const dpLast = { saved: null };
async function dpHistRender() {
  const all = (await dpAll()).sort((a, b) => b.planDate.localeCompare(a.planDate)), body = PLQ('#dpHistBody'), rem = new Map((dpRemote.list || []).map(x => [x.planDate, x]));
  body.innerHTML = all.length ? all.map(s => `<tr data-d="${s.planDate}"><td><strong>${s.planDate}</strong></td><td>${plEsc(s.days.map(dpDayLbl).join(', '))}</td><td class="num">${s.rows.length}</td><td class="num">${plF(dpSumOf(s, 'pal'), 1)}</td><td class="num">${plF(dpLitres(s))}</td><td>${plEsc(s.savedBy || '')}${s.savedAt ? '<br><span class="text-sm" style="color:var(--gray-500);">' + new Date(s.savedAt).toLocaleString() + '</span>' : ''}</td><td>${rem.has(s.planDate) || s.remote ? '☁ SharePoint' : 'This browser only'}</td><td style="white-space:nowrap"><button class="ghost small" data-act="open" type="button">📊 Open</button> <button class="ghost small" data-act="json" type="button">⬇ JSON</button> <button class="ghost small" data-act="push" type="button">☁ Share</button> <button class="ghost small" data-act="del" type="button">🗑</button></td></tr>`).join('') : '<tr><td colspan="8" style="padding:16px;text-align:center;color:var(--gray-400);font-style:italic;">No daily plans saved yet.</td></tr>';
  PLQ('#dpHistStatus').textContent = all.length ? `${all.length} plan(s) available${dpRemote.at ? ' · SharePoint checked ' + new Date(dpRemote.at).toLocaleTimeString() : ''}.` : '';
  dpLstSrcFill();
}

/* ---------- upload plan rows to a SharePoint list (one item per day × SKU × location) ---------- */
const dpLst = { picker: null, cols: [], map: {}, siteId: null, listId: null, snaps: new Map() };
const DP_LST_FIELDS = [
  { key: 'date', label: 'Plan day (date)', alias: ['plandate', 'date', 'day', 'deliverydate'] }, { key: 'code', label: 'SKU code (ICODE)', alias: ['icode', 'sku', 'skucode', 'itemcode', 'code'] },
  { key: 'item', label: 'Item description', alias: ['itemdesc', 'itemdescription', 'description', 'item'] }, { key: 'brand', label: 'Brand', alias: ['brand'] }, { key: 'category', label: 'Category', alias: ['category'] },
  { key: 'subCateg', label: 'Sub-category', alias: ['subcategory', 'subcateg'] }, { key: 'palletType', label: 'Pallet type', alias: ['pallettype', 'palletcode'] }, { key: 'type', label: 'Type', alias: ['type', 'itemtype'] }, { key: 'prodIn', label: 'Produced in', alias: ['prodin', 'producedin', 'plant'] },
  { key: 'uom', label: 'UoM', alias: ['uom'] }, { key: 'fillSize', label: 'Fill size', alias: ['fillsize', 'size'] }, { key: 'loc', label: 'Location', alias: ['location', 'loc', 'destination', 'branch'] }, { key: 'region', label: 'Region (NE / SE)', alias: ['region', 'area'] },
  { key: 'dem', label: 'Demand (units)', alias: ['demand', 'demandunits', 'qty', 'quantity', 'units'] }, { key: 'ltr', label: 'Litres', alias: ['litres', 'liters', 'ltr', 'demandinltr'] },
  { key: 'crt', label: 'Crates', alias: ['crates', 'crtsrequirement', 'crt', 'cartons'] }, { key: 'pal', label: 'Pallets', alias: ['pallets', 'palletsrequirement', 'pallet'] },
  { key: 'file', label: 'Source file', alias: ['sourcefile', 'filename', 'file'] }, { key: 'at', label: 'Uploaded at', alias: ['uploadedat', 'uploaddate', 'timestamp'] },
  currentUserOutputField()
];
function dpLstSrcFill() {
  const sel = PLQ('#dpLstSrc'); if (!sel) return; const prev = sel.value; dpAll().then(all => {
    all = all.sort((a, b) => b.planDate.localeCompare(a.planDate)); dpLst.snaps = new Map(all.map(s => [s.planDate, s]));
    const opts = []; if (dpUp.snap) opts.push(['__cur', `Just read: ${dpUp.snap.fileName} (not saved yet)`]); all.forEach(s => opts.push([s.planDate, `Saved plan ${s.planDate} · ${s.days.map(dpDayLbl).join(', ')} · ${s.rows.length} SKUs`]));
    sel.innerHTML = opts.map(o => `<option value="${plEsc(o[0])}">${plEsc(o[1])}</option>`).join('') || '<option value="">— no plan available —</option>'; if (prev && opts.some(o => o[0] === prev)) sel.value = prev; dpLstInfo();
  });
}
function dpLstSnap() { const v = PLQ('#dpLstSrc').value; return v === '__cur' ? dpUp.snap : dpLst.snaps.get(v); }
function dpLstRows(s, dayOnly) {
  const out = [], L = s.locs.length, at = new Date().toISOString();
  s.days.forEach(d => { if (dayOnly && dayOnly !== d) return; s.rows.forEach(o => { for (let j = 0; j < L; j++) {
    const dem = o.v.dem[d][j], crt = o.v.crt[d][j], pal = o.v.pal[d][j]; if (!(dem > 0 || crt > 0 || pal > 0)) continue;
    const rg = dpRegions(s)[s.locs[j]] || '';
    out.push({ date: d, code: o.code, item: o.item, brand: o.brand, category: o.category, subCateg: o.subCateg, type: o.type, prodIn: o.prodIn, uom: o.uom, fillSize: o.fillSize, loc: s.locs[j], region: rg, dem, ltr: Math.round(dem * (o.ltrConv || 0) * 100) / 100, crt: Math.round(crt * 1000) / 1000, pal: Math.round(pal * 10000) / 10000, palletType: o.palletType, file: s.fileName, at });
  } }); });
  return out;
}
function dpLstInfo() { const el = PLQ('#dpLstInfo'); if (!el) return; const s = dpLstSnap(); if (!s) { el.textContent = ''; return; } const dsel = PLQ('#dpLstDay'); const cur = dsel.value; dsel.innerHTML = '<option value="">All plan days</option>' + s.days.map(d => `<option value="${d}">${plEsc(dpDayLong(d))}</option>`).join(''); if (s.days.includes(cur)) dsel.value = cur; el.textContent = `${dpLstRows(s, dsel.value).length} list item(s) will be created — one per plan day × SKU × location that has demand.`; }
function dpLstRender() {
  const body = PLQ('#dpLstMapBody'); body.innerHTML = '';
  if (!dpLst.cols.length) { body.innerHTML = '<tr><td colspan="2" style="padding:16px;text-align:center;color:var(--gray-400);font-style:italic;">Pick a list and click 🔄 Load Columns to map fields.</td></tr>'; PLQ('#dpLstConfirm').disabled = true; return; }
  DP_LST_FIELDS.forEach(f => { const tr = document.createElement('tr'); tr.innerHTML = `<td><strong>${plEsc(f.label)}</strong></td><td class="combo-cell"></td>`; tr.querySelector('.combo-cell').appendChild(buildCombo(dpLst.map[f.key] || SKIP_VALUE, dpLst.cols, nv => { dpLst.map[f.key] = nv; dpLstState(); })); body.appendChild(tr); });
  dpLstState();
}
function dpLstState() { PLQ('#dpLstConfirm').disabled = !Object.values(dpLst.map).some(v => v && v !== SKIP_VALUE) || !dpLst.listId; }
function dpLstInit() {
  const q = s => PLQ(s);
  dpLst.picker = createListPicker(document.querySelector('[data-list-picker="dp-upload"]'), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: () => { dpLst.cols = []; dpLst.map = {}; dpLst.listId = null; dpLstRender(); } });
  q('#dpLstSrc').addEventListener('change', dpLstInfo); q('#dpLstDay').addEventListener('change', dpLstInfo);
  q('#dpLstLoad').addEventListener('click', async () => {
    const listName = dpLst.picker.getValue(), token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(), st = q('#dpLstColsStatus');
    if (!listName || !token || !siteUrl) { st.textContent = '⚠ Pick a list and configure the global settings.'; return; }
    if (!isListVisible(listName)) { st.textContent = `✘ No permission to access "${listName}"`; return; } if (!isListEditable(listName)) { st.textContent = `✘ READ-ONLY access to "${listName}" — upload blocked`; return; }
    st.textContent = 'Loading...';
    try { const { siteId, listId } = await resolveIds(siteUrl, listName, token); dpLst.siteId = siteId; dpLst.listId = listId; const cols = await fetchColumns(siteId, listId, token); dpLst.cols = cols.filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase())); st.textContent = `✓ ${dpLst.cols.length} writable columns`; dpLstRender(); setTimeout(() => q('#dpLstAuto').click(), 0); } catch (err) { st.textContent = '✘ ' + err.message; }
  });
  q('#dpLstAuto').addEventListener('click', () => {
    if (!dpLst.cols.length) { q('#dpLstColsStatus').textContent = '⚠ Load columns first.'; return; }
    const nz = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, ''), used = new Set(), map = {};
    DP_LST_FIELDS.forEach(f => { if (f.key === CURRENT_USER_FIELD_KEY) return; let hit = null;
      for (const pass of [0, 1]) { for (const al of f.alias) { hit = dpLst.cols.find(c => !used.has(c.name) && (pass === 0 ? (nz(c.name) === al || nz(c.displayName) === al) : (al.length >= 4 && (nz(c.name).includes(al) || nz(c.displayName).includes(al))))); if (hit) break; } if (hit) break; }
      if (hit) used.add(hit.name); map[f.key] = hit ? hit.name : SKIP_VALUE; });
    const uh = findCurrentUserColumn(dpLst.cols); map[CURRENT_USER_FIELD_KEY] = uh ? uh.name : SKIP_VALUE; dpLst.map = map; dpLstRender();
  });
  q('#dpLstReset').addEventListener('click', () => { dpLst.map = {}; dpLstRender(); });
  q('#dpLstConfirm').addEventListener('click', async () => {
    const st = q('#dpLstStatus'), s = dpLstSnap(); if (!s) { st.textContent = '⚠ Choose a plan first.'; return; }
    const rows = dpLstRows(s, q('#dpLstDay').value); if (!dpLst.listId) { st.textContent = '⚠ Load columns first.'; return; } if (!rows.length) { st.textContent = '⚠ Nothing to upload — no demand in the chosen days.'; return; }
    if (!hasPerm('uploader')) { alert('Permission denied.'); return; }
    const active = Object.entries(dpLst.map).filter(([, v]) => v && v !== SKIP_VALUE); if (!active.length) { st.textContent = '⚠ Map at least one field.'; return; }
    const listName = (document.querySelector('[data-list-picker="dp-upload"] .list-picker-input') || {}).value || 'selected list', total = rows.length;
    if (!(await spAsk(`Upload ${plF(total)} item(s) of the daily plan ${s.planDate} to "${listName}"?` + (dpLst.done && dpLst.done[s.planDate + '|' + q('#dpLstDay').value + '|' + dpLst.listId] ? '\n\n⚠ This plan was already uploaded to this list in this session. Uploading again creates duplicate rows.' : '')))) return;
    const token = getGlobalAccessToken(), prog = q('#dpLstProg'); q('#dpLstConfirm').disabled = true; prog.style.display = 'block'; prog.max = total; prog.value = 0; let ok = 0, fail = 0, done = 0; const errors = [];
    let next = 0; const worker = async () => { while (next < total) { const i = next++, r = rows[i], fields = {};
      active.forEach(([k, target]) => { const v = k === CURRENT_USER_FIELD_KEY ? getCurrentUserValue() : r[k]; if (v !== null && v !== undefined && v !== '') fields[target] = v; });
      if (!Object.keys(fields).length) { fail++; } else { try { await createItem(dpLst.siteId, dpLst.listId, fields, token); ok++; } catch (err) { fail++; if (errors.length < 5) errors.push(`${r.code}/${r.loc}: ${err.message}`); } }
      done++; prog.value = done; st.textContent = `Uploading ${done} / ${total} · ✔ ${ok} · ✘ ${fail}`; } };
    await Promise.all([worker(), worker(), worker()]);
    q('#dpLstConfirm').disabled = false; if (ok) { dpLst.done = dpLst.done || {}; dpLst.done[s.planDate + '|' + q('#dpLstDay').value + '|' + dpLst.listId] = 1; }
    st.textContent = fail ? `⚠ ${ok} uploaded, ${fail} failed. ${errors.slice(0, 2).join(' | ')}` : `✅ Uploaded ${plF(ok)} item(s) to "${listName}".`;
    w_logToActivity(`Daily plan ${s.planDate} → "${listName}": ${ok} ok, ${fail} failed`);
    if (fail) notifyFailure('Daily Plan Upload Failure', `${fail} failure(s) uploading to "${listName}".\n\n${errors.slice(0, 5).join('\n')}`);
  });
  dpLstRender(); dpLstSrcFill();
}
function dpUpInit() {
  const drop = PLQ('#dpDrop'), inp = PLQ('#dpFile');
  drop.addEventListener('click', () => inp.click()); drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); })); ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => dpUpFile(e.dataTransfer.files[0])); inp.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; dpUpFile(f); });
  PLQ('#dpSaveBtn').addEventListener('click', dpSaveSnapshot); PLQ('#dpCancelBtn').addEventListener('click', () => { dpUp.snap = null; dpUpRender(); dpUpStatus('', 'info'); dpLstSrcFill(); });
  PLQ('#dpFolder').value = dpCfg().folder; PLQ('#dpFolderSave').addEventListener('click', () => { dpCfgSave({ folder: PLQ('#dpFolder').value.trim() || 'DailyPlan' }); PLQ('#dpFolderStatus').textContent = '✅ Saved.'; });
  PLQ('#dpSyncBtn').addEventListener('click', async () => { const b = PLQ('#dpSyncBtn'); b.disabled = true; PLQ('#dpHistStatus').textContent = 'Checking SharePoint…'; try { const r = await dpSync(true); await dpHistRender(); PLQ('#dpHistStatus').textContent = `✅ ${r.remote} plan(s) in SharePoint, ${r.fetched} downloaded to this browser.`; } catch (e) { PLQ('#dpHistStatus').textContent = '✘ ' + e.message; } finally { b.disabled = false; } });
  PLQ('#dpImportBtn').addEventListener('click', () => PLQ('#dpImportInput').click());
  PLQ('#dpImportInput').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const s = JSON.parse(await f.text()); if (!s.planDate || !s.rows || !s.days) throw new Error('This is not a Daily Plan snapshot file.'); await dpPut(s); await dpHistRender(); PLQ('#dpHistStatus').textContent = `✅ Imported ${s.planDate}.`; } catch (x) { PLQ('#dpHistStatus').textContent = '✘ ' + x.message; } });
  PLQ('#dpHistBody').addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return; const d = b.closest('tr').dataset.d, act = b.dataset.act;
    if (act === 'open') { dpCfgSave({ sel: d }); plGo('dailyplan'); }
    else if (act === 'json') { const s = await dpGet(d); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(s)], { type: 'application/json' })); a.download = dpFile(d); document.body.appendChild(a); a.click(); a.remove(); }
    else if (act === 'push') { b.disabled = true; try { const s = await dpGet(d); await dpSpSave(s); s.remote = true; await dpPut(s); PLQ('#dpHistStatus').textContent = `✅ ${d} shared in SharePoint.`; await dpHistRender(); } catch (x) { PLQ('#dpHistStatus').textContent = '✘ ' + x.message; b.disabled = false; } }
    else if (act === 'del') { if (!hasPerm('dailyplan-upload')) { alert('Permission denied.'); return; } if (confirm(`Delete the ${d} plan from this browser? (A copy in SharePoint is not touched.)`)) { await dpDel(d); await dpHistRender(); } }
  });
  dpLstInit(); dpHistRender();
}

