/* ============================================================
   DAILY PLAN — SKU card, sector summaries, e-mail / Excel / print, wiring
   ============================================================ */
function dpRowOpen(code) {
  const s = dp.cur, r = s && s.rows.find(x => x.code === code); if (!r) return; const o = dp.rows.find(x => x.code === code) || {}, L = s.locs.length, names = s.locs.concat(['NE', 'SE', 'Total']), lc = r.ltrConv || 0;
  let m = PLQ('#dpRowModal'); if (!m) { m = document.createElement('div'); m.id = 'dpRowModal'; m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99997;display:flex;align-items:center;justify-content:center;padding:20px'; document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m || e.target.dataset.x) m.style.display = 'none'; }); }
  const info = [['Produced in', r.prodIn], ['Type', r.type], ['Brand', r.brand], ['Category', r.category], ['Sub-category', r.subCateg], ['UoM', r.uom], ['Fill size', r.fillSize], ['Litres per UoM', r.ltrConv], ['Batch size (L)', r.batchLtr], ['Pcs / crate', r.pcsCrt], ['Crates / pallet', r.crtPallet], ['Pallet type', r.palletType], ['ABC class', o._abc], ['Peak location', o._peak]].filter(x => x[1] != null && x[1] !== '');
  const dayTbl = d => { const rows = names.map((n, j) => { const dem = r.v.dem[d][j], crt = r.v.crt[d][j], pal = r.v.pal[d][j]; return `<tr${n === 'Total' ? ' style="font-weight:700;background:var(--gray-100)"' : ''}><td>${plEsc(n)}</td><td class="n">${plF(dem)}</td><td class="n">${plF(crt, 1)}</td><td class="n">${plF(pal, 2)}</td><td class="n">${plF(dem * lc)}</td></tr>`; }).join('');
    return `<div style="font-weight:700;margin:12px 0 4px">${plEsc(dpDayLong(d))}</div><table class="pl-tbl"><thead><tr><th>Location</th><th class="n">Units (${plEsc(r.uom || '')})</th><th class="n">Crates</th><th class="n">Pallets</th><th class="n">Litres</th></tr></thead><tbody>${rows}</tbody></table>`; };
  m.innerHTML = `<div class="card" style="max-width:760px;width:100%;max-height:92vh;overflow:auto;margin:0"><div class="card-header"><div class="card-title">${plEsc(r.code)} · ${plEsc(r.item)}</div><button class="ghost small" data-x="1" type="button">✖ Close</button></div><div class="pl-sum" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">${info.map(x => `<div><small>${plEsc(x[0])}</small><b style="font-size:14px">${plEsc(x[1])}</b></div>`).join('')}</div>${s.days.map(dayTbl).join('')}</div>`;
  m.style.display = 'flex';
}

/* ---------- sector summaries (by location or by any SKU column) ---------- */
const dpShareDims = () => [['__loc', 'Location (delivery point)']].concat(dpDims().filter(d => !/^_/.test(d.key) || d.key === '_abc').map(d => [d.key, d.label]));
function dpSectors(dim) {
  const s = dp.cur, v = dp.view;
  if (dim === '__loc') return s.locs.map((l, j) => { const rs = v.filter(o => o['dem_' + l] > 0 || o['pal_' + l] > 0); return { key: l, loc: l, rows: rs, st: dpStats(rs, l, j) }; }).sort((a, b) => b.st.pal - a.st.pal);
  return dpGroup(v, dim).map(g => ({ key: g.key, loc: null, rows: g.rows, st: dpStats(g.rows, 'TOT', null) })).sort((a, b) => b.st.pal - a.st.pal);
}
function dpStats(rows, loc, j) {
  const s = dp.cur, tot = plSum(dp.view, 'pal_TOT'), pal = plSum(rows, 'pal_' + loc), perDay = s.days.map(d => j == null ? rows.reduce((t, o) => t + dpDayVal(o, 'pal', d, s.locs.length + 2), 0) : rows.reduce((t, o) => t + dpDayVal(o, 'pal', d, j), 0));
  return { n: rows.filter(o => o['dem_' + loc] > 0).length, pal, crt: plSum(rows, 'crt_' + loc), ltr: plSum(rows, 'ltr_' + loc), bat: plSum(rows, 'bat_' + loc), ne: loc === 'TOT' ? plSum(rows, 'pal_NE') : null, se: loc === 'TOT' ? plSum(rows, 'pal_SE') : null, share: tot ? pal / tot : 0, perDay, loc };
}
function dpFilterText() { const p = dp.conds.map(c => { const lab = dpLabel(c.key); return c.op === 'in' ? `${lab}: ${c.vals.join(', ')}` : c.op === 'range' ? `${lab}: ${c.min == null ? '' : c.min}–${c.max == null ? '' : c.max}` : c.op === 'contains' ? `${lab} contains “${c.text}”` : `${lab} ${c.op === 'empty' ? 'is empty' : 'has a value'}`; }); if (dp.q.length) p.push('Search: ' + dp.q.join(', ')); return p.join(' · ') || 'No filters (all SKUs)'; }
const dmH = { th: 'border:1px solid #cbd5e1;padding:5px 8px;background:#f1f5f9;text-align:right;font-size:12px;font-family:Segoe UI,Arial,sans-serif;', td: 'border:1px solid #e2e8f0;padding:5px 8px;font-size:12px;text-align:right;font-family:Segoe UI,Arial,sans-serif;' };
function dmBar(p, color) { const w = Math.max(0, Math.min(100, Math.round((p || 0) * 100))); return `<table style="border-collapse:collapse;width:90px;display:inline-table"><tr><td style="background:${color};height:8px;width:${w}%;padding:0"></td><td style="background:#e2e8f0;height:8px;padding:0"></td></tr></table>`; }
function dpSecHead() { return ['Sector', 'SKUs'].concat(dp.cur.days.map(d => 'Pallets ' + dpDayLbl(d)), ['Pallets', 'Share', 'Crates', 'Litres', 'Batches']); }
function dpSecRow(g) { const s = g.st; return [g.key, s.n].concat(s.perDay.map(v => +v.toFixed(2)), [+s.pal.toFixed(2), s.share, +s.crt.toFixed(0), +s.ltr.toFixed(0), +s.bat.toFixed(2)]); }
function dpSecRowHtml(g, total) { const s = g.st; return `<tr${total ? ' style="font-weight:700;background:#f8fafc"' : ''}><td style="${dmH.td}text-align:left;font-weight:600">${plEsc(g.key)}</td><td style="${dmH.td}">${plF(s.n)}</td>${s.perDay.map(v => `<td style="${dmH.td}">${plF(v, 1)}</td>`).join('')}<td style="${dmH.td}font-weight:700">${plF(s.pal, 1)}</td><td style="${dmH.td}text-align:left;white-space:nowrap">${dmBar(s.share, '#2a78d6')} ${plP(s.share, 0)}</td><td style="${dmH.td}">${plF(s.crt)}</td><td style="${dmH.td}">${plF(s.ltr)}</td><td style="${dmH.td}">${plF(s.bat, 1)}</td></tr>`; }
function dpSecTable(list, dimLabel) { const rows = dp.view, tot = { key: 'Total', st: dpStats(rows, 'TOT', null) }; tot.st.share = 1; const head = dpSecHead(); head[0] = dimLabel; return `<table style="border-collapse:collapse"><tr>${head.map((h, i) => `<th style="${dmH.th}${i === 0 ? 'text-align:left' : ''}">${plEsc(h)}</th>`).join('')}</tr>${list.map(g => dpSecRowHtml(g)).join('')}${dpSecRowHtml(tot, true)}</table>`; }
function dpSecBlock(g, dimLabel) {
  const s = g.st, k = (a, b) => `<td style="padding:6px 14px 6px 0;font-family:Segoe UI,Arial,sans-serif"><div style="font-size:11px;color:#64748b">${a}</div><div style="font-size:16px;font-weight:700">${b}</div></td>`, key = g.loc ? 'pal_' + g.loc : 'pal_TOT';
  const top = g.rows.filter(o => o[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 8), jj = g.loc ? dp.cur.locs.indexOf(g.loc) : dp.cur.locs.length + 2;
  const th = dp.cur.days.map(d => `<th style="${dmH.th}">${plEsc(dpDayLbl(d))}</th>`).join('');
  return `<div style="margin:16px 0 4px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:700;border-bottom:2px solid #2a78d6;padding-bottom:3px">${plEsc(dimLabel)}: ${plEsc(g.key)}</div><table style="border-collapse:collapse"><tr>${k('SKUs', plF(s.n))}${k('Pallets', plF(s.pal, 1))}${k('Share of plan', plP(s.share, 0))}${k('Crates', plF(s.crt))}${k('Litres', plF(s.ltr))}${k('Batches', plF(s.bat, 1))}${s.ne != null ? k('NE / SE pallets', plF(s.ne, 1) + ' / ' + plF(s.se, 1)) : ''}</tr></table>` +
    (top.length ? `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:12px;font-weight:600;margin-top:6px;color:#334155">Largest SKUs</div><table style="border-collapse:collapse;margin-top:3px"><tr><th style="${dmH.th}text-align:left">SKU</th>${th}<th style="${dmH.th}">Pallets</th><th style="${dmH.th}">Crates</th><th style="${dmH.th}">Units</th></tr>${top.map(o => `<tr><td style="${dmH.td}text-align:left">${plEsc(o.code)} · ${plEsc(plTrunc(o.item, 220))}</td>${dp.cur.days.map(d => `<td style="${dmH.td}">${plF(dpDayVal(o, 'pal', d, jj), 1)}</td>`).join('')}<td style="${dmH.td}font-weight:700">${plF(o[key], 1)}</td><td style="${dmH.td}">${plF(o[key.replace('pal_', 'crt_')], 0)}</td><td style="${dmH.td}">${plF(o[key.replace('pal_', 'dem_')], 0)} ${plEsc(o.uom || '')}</td></tr>`).join('')}</table>` : '');
}
function dpMailHtml(secs, dim, o) {
  o = o || {}; const dimLabel = dim === '__loc' ? 'Location' : dpLabel(dim), v = dp.view, t = dpStats(v, 'TOT', null), s = dp.cur, sh = dp.cur.sheet && dp.cur.sheet.totals || {}, trips = dpSheetSum(s, dp.days, 'trips');
  const kp = (a, b) => `<td style="padding:8px 16px 8px 0;font-family:Segoe UI,Arial,sans-serif"><div style="font-size:11px;color:#64748b">${a}</div><div style="font-size:20px;font-weight:700">${b}</div></td>`;
  const head = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:1000px"><h2 style="margin:0 0 2px">Daily Plan — Production &amp; Delivery Requirement</h2><div style="color:#64748b;font-size:12px;margin-bottom:8px">Plan <b>${plEsc(s.planDate)}</b> · ${plEsc(dp.days.map(dpDayLong).join(' · '))} · ${plEsc(o.scopeLabel || dpFilterText())}</div>`;
  const kpi = o.noKpi ? '' : `<table style="border-collapse:collapse"><tr>${kp('Pallets', plF(t.pal, 1))}${kp('Crates', plF(t.crt))}${kp('Litres', plF(t.ltr))}${kp('Production batches', plF(t.bat, 1))}${kp('SKUs with demand', plF(t.n))}${trips != null ? kp('Trips (per file)', plF(trips, 1)) : ''}</tr></table>`;
  const msg = o.message ? `<p style="white-space:pre-wrap;font-size:13px">${plEsc(o.message)}</p>` : '';
  const ov = o.noOverview ? '' : `<div style="font-size:14px;font-weight:700;margin:14px 0 4px">Summary by ${plEsc(dimLabel)}</div>` + dpSecTable(secs, dimLabel);
  return head + msg + kpi + ov + secs.map(g => dpSecBlock(g, dimLabel)).join('') + `<div style="color:#94a3b8;font-size:11px;margin-top:16px">Units are in each item’s UoM, so they are not added across SKUs — use pallets, crates or litres for totals. Full detail is in the attached Excel file.</div></div>`;
}
function dpSkuSheet(rows, loc) {
  const s = dp.cur, L = s.locs.length, j = loc ? s.locs.indexOf(loc) : L + 2, head = ['ICODE', 'Item', 'Category', 'Brand', 'Produced in', 'UoM'];
  s.days.forEach(d => { head.push(dpDayLbl(d) + ' units', dpDayLbl(d) + ' crates', dpDayLbl(d) + ' pallets', dpDayLbl(d) + ' litres'); }); head.push('Total units', 'Total crates', 'Total pallets', 'Total litres', 'Batches');
  const key = loc || 'TOT';
  return [head].concat(rows.map(o => { const r = [o.code, o.item, o.category, o.brand, o.prodIn, o.uom]; s.days.forEach(d => { r.push(dpDayVal(o, 'dem', d, j), +dpDayVal(o, 'crt', d, j).toFixed(3), +dpDayVal(o, 'pal', d, j).toFixed(4), +dpDayVal(o, 'ltr', d, j).toFixed(1)); }); r.push(o['dem_' + key], +o['crt_' + key].toFixed(3), +o['pal_' + key].toFixed(4), +o['ltr_' + key].toFixed(1), +o['bat_' + key].toFixed(3)); return r; }));
}
function dpWorkbook(secs, dim, only) {
  const wb = XLSX.utils.book_new(), dl = dim === '__loc' ? 'Location' : dpLabel(dim), head = dpSecHead(); head[0] = dl; head[head.indexOf('Share')] = 'Share (%)';
  const sum = [['Daily Plan — summary'], ['Plan ' + dp.cur.planDate + ' · ' + (only ? dl + ': ' + secs[0].key : dpFilterText())], [], head].concat(secs.map(g => { const r = dpSecRow(g); r[head.indexOf('Share (%)')] = +(g.st.share * 100).toFixed(1); return r; }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), ('Summary by ' + dl).slice(0, 31));
  const cols = dpAllCols(dp.cur), rows = only ? secs[0].rows : dp.view;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cols.map(c => c.label)].concat(rows.map(o => cols.map(c => { const v = o[c.key]; return v == null ? '' : v; })))), 'SKU data');
  if (!only) secs.slice(0, 40).forEach(g => { const nm = String(g.key).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 28) || 'Sector'; let n = nm, i = 2; while (wb.SheetNames.includes(n)) n = nm.slice(0, 25) + ' ' + i++; XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dpSkuSheet(g.rows.filter(o => o[(g.loc ? 'pal_' + g.loc : 'pal_TOT')] > 0 || o[(g.loc ? 'dem_' + g.loc : 'dem_TOT')] > 0), g.loc)), n); });
  return wb;
}
const dpB64 = wb => XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
function dpExcel() { if (!dp.cur) return; const dim = plCtlGetDp('dim', '__loc'), list = dpSectors(dim); XLSX.writeFile(dpWorkbook(list, dim), `DailyPlan_${dp.cur.planDate}.xlsx`); addActivity('export', `Daily plan Excel (${dp.view.length} SKUs)`); }
function plCtlGetDp(id, def) { return dpCtlGet('share', id, def); }
function dpPrint() { if (!dp.cur) return; const dim = plCtlGetDp('dim', '__loc'), dl = dim === '__loc' ? 'Location' : dpLabel(dim), list = dpSectors(dim), tot = { key: 'Total', st: dpStats(dp.view, 'TOT', null) }; tot.st.share = 1; const h = dpSecHead(); h[0] = dl; w_printTable('Daily Plan — summary by ' + dl, `Plan ${dp.cur.planDate} · ${dp.days.map(dpDayLbl).join(', ')} · ${dpFilterText()}`, h, list.map(g => { const r = dpSecRow(g); r[h.indexOf('Share')] = plP(g.st.share, 0); return r; }), (() => { const r = dpSecRow(tot); r[h.indexOf('Share')] = '100%'; return r; })()); }

function dpShareOpen() {
  if (!dp.cur) return; let m = PLQ('#dpShare');
  if (!m) {
    m = document.createElement('div'); m.id = 'dpShare'; m.className = 'pl-share-modal';
    m.innerHTML = `<div class="pl-sc"><div class="card-header"><div class="card-title">📧 Share the daily plan &amp; sector summaries by email</div><button class="ghost small" data-x="1" type="button">✖ Close</button></div>
    <div class="form-grid"><div class="form-group"><label>To <span class="hint">— comma separated</span></label><input type="text" id="dpShTo" /></div><div class="form-group"><label>Cc</label><input type="text" id="dpShCc" /></div>
    <div class="form-group"><label>Subject</label><input type="text" id="dpShSubj" /></div><div class="form-group"><label>Sector = split the summary by</label><select id="dpShDim"></select></div></div>
    <div class="form-group"><label>Message <span class="hint">— optional</span></label><textarea id="dpShMsg" rows="2"></textarea></div>
    <div style="display:flex;justify-content:space-between;align-items:center"><b>Sectors to include <span id="dpShCnt" class="text-sm" style="font-weight:400"></span></b><span><button type="button" class="ghost small" id="dpShAll">All</button> <button type="button" class="ghost small" id="dpShNone">None</button></span></div>
    <div class="pl-secs" id="dpShSecs"></div>
    <div class="form-group"><label>How to send</label><label style="display:flex;gap:6px;font-weight:400"><input type="radio" name="dpShMode" value="one" checked /> One email with the whole plan + a summary block for every selected sector</label><label style="display:flex;gap:6px;font-weight:400"><input type="radio" name="dpShMode" value="each" /> A separate email for every selected sector (each only contains that sector)</label></div>
    <div class="form-group" id="dpShMapBox" style="display:none"><label>Different recipients per sector <span class="hint">— optional, one per line: <code>Sector name = a@x.com; b@y.com</code> (others go to “To”)</span></label><textarea id="dpShMap" rows="3"></textarea></div>
    <label style="display:flex;gap:6px;font-size:13px"><input type="checkbox" id="dpShAtt" checked /> Attach Excel (summary + SKU data + a sheet per sector)</label>
    <div class="text-sm" style="color:var(--gray-500);margin:6px 0">Uses the plan, the day selection and the filters shown on the dashboard.</div>
    <div id="dpShStatus" class="status-msg"></div>
    <div class="btn-row" style="margin-top:8px"><button id="dpShSend" class="success" type="button">🚀 Send now</button><button id="dpShDraft" class="secondary" type="button">📨 Create Outlook draft(s) (.eml)</button><button id="dpShCopy" class="ghost small" type="button">📋 Copy</button></div></div>`;
    document.body.appendChild(m); m.addEventListener('click', e => { if (e.target === m || e.target.dataset.x) m.style.display = 'none'; });
    const st = (t, c) => { const e = PLQ('#dpShStatus'); e.className = 'status-msg ' + (c || 'info'); e.textContent = t; }; m._st = st;
    const cnt = () => { const n = m.querySelectorAll('#dpShSecs input:checked').length; PLQ('#dpShCnt').textContent = `— ${n} of ${(m._list || []).length} selected`; };
    const fill = () => { const dim = PLQ('#dpShDim').value; dpCtlSet('share', 'dim', dim); const l = dpSectors(dim); PLQ('#dpShSecs').innerHTML = l.map((g, i) => `<label><input type="checkbox" data-i="${i}" ${g.st.pal > 0 || g.st.n > 0 ? 'checked' : ''} /> <span>${plEsc(g.key)} <small style="color:var(--gray-500)">(${plF(g.st.pal, 1)} pallets · ${g.st.n} SKUs)</small></span></label>`).join(''); m._list = l; cnt(); };
    PLQ('#dpShDim').addEventListener('change', fill); PLQ('#dpShSecs').addEventListener('change', cnt);
    PLQ('#dpShAll').addEventListener('click', () => { m.querySelectorAll('#dpShSecs input').forEach(i => { i.checked = true; }); cnt(); }); PLQ('#dpShNone').addEventListener('click', () => { m.querySelectorAll('#dpShSecs input').forEach(i => { i.checked = false; }); cnt(); });
    m.querySelectorAll('input[name=dpShMode]').forEach(r => r.addEventListener('change', () => { PLQ('#dpShMapBox').style.display = m.querySelector('input[name=dpShMode]:checked').value === 'each' ? '' : 'none'; }));
    const jobs = () => {
      const sel = Array.from(m.querySelectorAll('#dpShSecs input:checked')).map(i => m._list[+i.dataset.i]); if (!sel.length) throw new Error('Select at least one sector.');
      const dim = PLQ('#dpShDim').value, dl = dim === '__loc' ? 'Location' : dpLabel(dim), mode = m.querySelector('input[name=dpShMode]:checked').value, msg = PLQ('#dpShMsg').value.trim(), subj = PLQ('#dpShSubj').value.trim() || ('Daily plan — ' + dp.cur.planDate), att = PLQ('#dpShAtt').checked, stamp = dp.cur.planDate, to = PLQ('#dpShTo').value.trim(), cc = PLQ('#dpShCc').value.trim();
      const map = {}; PLQ('#dpShMap').value.split(/\n/).forEach(l => { const i = l.indexOf('='); if (i > 0) map[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); });
      if (mode === 'one') return [{ to, cc, subject: subj, html: dpMailHtml(sel, dim, { message: msg }), att: att ? { fileName: `DailyPlan_${stamp}.xlsx`, dataB64: dpB64(dpWorkbook(sel, dim)) } : null, label: 'plan' }];
      return sel.map(g => ({ to: map[String(g.key).toLowerCase()] || to, cc, subject: `${subj} — ${g.key}`, html: dpMailHtml([g], dim, { message: msg, noOverview: true, scopeLabel: `${dl}: ${g.key}` + (dp.conds.length || dp.q.length ? ' · ' + dpFilterText() : '') }), att: att ? { fileName: `DailyPlan_${String(g.key).replace(/\W+/g, '_')}_${stamp}.xlsx`, dataB64: dpB64(dpWorkbook([g], dim, true)) } : null, label: g.key }));
    };
    PLQ('#dpShSend').addEventListener('click', async () => {
      const b = PLQ('#dpShSend'); if (b.disabled) return; try {
        const js = jobs(); if (js.some(j => !j.to)) throw new Error('Enter at least one recipient in “To” (or a recipient for every sector).'); b.disabled = true; let ok = 0, how = '';
        for (const j of js) { st(`Sending ${ok + 1} of ${js.length}: ${j.label}…`); how = await mailSend_send({ to: j.to, cc: j.cc, subject: j.subject, html: j.html, attachment: j.att }); ok++; }
        st(`✅ ${ok} email(s): ${how}.`, 'success'); addActivity('email', `Daily plan e-mail sent (${ok} message(s))`); try { localStorage.setItem(LS_BASE + '_dp_mail', JSON.stringify({ to: PLQ('#dpShTo').value, cc: PLQ('#dpShCc').value })); } catch (e) {}
      } catch (e) { st('✘ ' + e.message, 'error'); } finally { b.disabled = false; }
    });
    PLQ('#dpShDraft').addEventListener('click', async () => {
      try { const js = jobs(); if (js.some(j => !j.to)) throw new Error('Enter at least one recipient in “To” (or a recipient for every sector).');
        for (let i = 0; i < js.length; i++) { const j = js[i], eml = expEmail_buildEml(j.html, j.subject, j.to, j.cc, j.att ? { format: 'xlsx', fileName: j.att.fileName, dataB64: j.att.dataB64 } : null), url = URL.createObjectURL(new Blob([eml], { type: 'message/rfc822' })), a = document.createElement('a'); a.href = url; a.download = `DailyPlan_${String(j.label).replace(/\W+/g, '_')}_${dp.cur.planDate}.eml`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 6000); await new Promise(r => setTimeout(r, 350)); }
        st(`✅ ${js.length} draft file(s) downloaded. Open them in Outlook, review and Send (your browser may ask to allow multiple downloads).`, 'success'); addActivity('email', `Daily plan draft(s) (${js.length})`);
      } catch (e) { st('✘ ' + e.message, 'error'); } });
    PLQ('#dpShCopy').addEventListener('click', async () => { try { const js = jobs(), html = js.map(j => j.html).join('<hr>'), plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); if (navigator.clipboard && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]); else await navigator.clipboard.writeText(plain); st('✅ Copied. Paste into a new email (Ctrl+V).', 'success'); } catch (e) { st('✘ ' + e.message, 'error'); } });
  }
  const dims = dpShareDims(), want = plCtlGetDp('dim', '__loc'), ds = PLQ('#dpShDim'); ds.innerHTML = dims.map(d => `<option value="${plEsc(d[0])}" ${d[0] === (dims.some(x => x[0] === want) ? want : dims[0][0]) ? 'selected' : ''}>${plEsc(d[1])}</option>`).join('');
  try { const s = JSON.parse(localStorage.getItem(LS_BASE + '_dp_mail') || '{}'); PLQ('#dpShTo').value = s.to || ''; PLQ('#dpShCc').value = s.cc || ''; } catch (e) {}
  try { applyEmailDefaults(PLQ('#dpShTo'), PLQ('#dpShCc'), true); } catch (e) {}
  PLQ('#dpShSubj').value = 'Daily plan — ' + dp.cur.planDate + (dp.scope !== 'all' ? ' (' + dpDayLbl(dp.scope) + ')' : ''); PLQ('#dpShSend').textContent = mailSend_label(); m._st('', 'info');
  ds.dispatchEvent(new Event('change')); m.style.display = 'flex';
}

/* ---------- open / wiring ---------- */
let dpInited = false, dpOpenBusy = false;
async function dpOpen() {
  if (dpOpenBusy) return; dpOpenBusy = true;
  try {
    await dpLoadAll(); const has = !!dp.cur; PLQ('#dpEmpty').style.display = has ? 'none' : ''; PLQ('#dpMain').style.display = has ? '' : 'none';
    if (has) { dpSearchInit(); dp.conds = dp.conds.filter(c => !c.key || dp.colMap[c.key]); dpRefresh(); }
    if (!dpOpen.synced) { dpOpen.synced = true; try { if (getGlobalAccessToken() && getGlobalSiteUrl()) { const r = await dpSync(false); if (r.fetched) { await dpLoadAll(dp.date); PLQ('#dpEmpty').style.display = 'none'; PLQ('#dpMain').style.display = ''; dpSearchInit(); dpRefresh(); sectionToast(`☁ ${r.fetched} daily plan(s) loaded from SharePoint.`, 'ok'); } } } catch (e) { /* offline or not configured */ } }
  } catch (e) { console.error(e); sectionToast('Daily plan: ' + e.message, 'error'); } finally { dpOpenBusy = false; }
}
function dpInit() {
  if (dpInited) return; dpInited = true; dpUpInit(); dpFiltersInit();
  PLQ('#dpGoUpload').addEventListener('click', () => plGo('dailyplan-upload')); PLQ('#dpUploadGo').addEventListener('click', () => plGo('dailyplan-upload')); PLQ('#dpListGo').addEventListener('click', () => { plGo('dailyplan-upload'); setTimeout(() => { const c = PLQ('#dpLstCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200); });
  PLQ('#dpSnapSel').addEventListener('change', e => { dp.date = e.target.value; dpCfgSave({ sel: dp.date }); dpSetCur(); dpRefresh(); });
  const step = d => { const i = dp.dates.indexOf(dp.date) + d; if (i >= 0 && i < dp.dates.length) { dp.date = dp.dates[i]; dpCfgSave({ sel: dp.date }); dpSetCur(); dpRefresh(); } };
  PLQ('#dpPrevBtn').addEventListener('click', () => step(-1)); PLQ('#dpNextBtn').addEventListener('click', () => step(1));
  PLQ('#dpDayTabs').addEventListener('click', e => { const b = e.target.closest('button[data-s]'); if (!b) return; dp.scope = b.dataset.s; PLQ('#dpDayTabs').dataset.sig = ''; dpSetCur(); dpRefresh(); });
  PLQ('#dpEmailBtn').addEventListener('click', dpShareOpen); PLQ('#dpPrintBtn').addEventListener('click', dpPrint); PLQ('#dpExcelBtn').addEventListener('click', dpExcel); PLQ('#dpColBtn').addEventListener('click', dpColPop);
  document.addEventListener('mousedown', e => { const p = PLQ('#dpColPop'); if (p && !e.composedPath().includes(p) && e.target.id !== 'dpColBtn') p.remove(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const f = document.querySelector('#dpGrid .pl-card.pl-full'); if (f) { f.classList.remove('pl-full'); const b = f.querySelector('[data-a=full]'); if (b) b.textContent = '⤢'; dpRedrawAll(); } } });
  const act = () => { const v = document.querySelector('.view.active'); return v && v.id === 'view-dailyplan'; };
  new MutationObserver(() => { if (act() && dp.cur) dpRedrawAll(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  let rt; const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (act() && dp.cur) dpRedrawAll(); }, 150); }); ro.observe(PLQ('#dpGrid'));
}
document.querySelectorAll('.nav-item[data-view="dailyplan"],.nav-item[data-view="dailyplan-upload"]').forEach(n => n.addEventListener('click', () => { dpInit(); if (n.dataset.view === 'dailyplan') setTimeout(dpOpen, 0); else { dpHistRender(); } }));


/* ============================================================
   F&D PLAN — trips / trailers, picking lines, batch data, compliance, print
   Source: the saved Daily Plan snapshots (IndexedDB nfpc_dailyplan)
   ============================================================ */
const FD_STATUS = ['Planned', 'Picking', 'Picked', 'Loaded', 'Dispatched'];
const FD_DEF = { capP12: 41, capP6: 24, minUtil: 70, minShelf: 7, shelf: 0, balance: false };
const fdKey = d => LS_BASE + '_fd_' + d;
function fdStLoad(d) { let o = {}; try { o = JSON.parse(localStorage.getItem(fdKey(d)) || '{}'); } catch (e) {} return { cfg: Object.assign({}, FD_DEF, o.cfg || {}), batch: o.batch || {}, bl: o.bl || {}, line: o.line || {}, status: o.status || {}, meta: o.meta || {}, act: o.act || {}, actNote: o.actNote || {}, bal: o.bal || {} }; }
function fdStSave(d, st) { try { localStorage.setItem(fdKey(d), JSON.stringify(st)); } catch (e) {} }
const fdDayMs = d => Date.parse(d + 'T00:00:00Z');

/* a demand cell with the user's actual quantity applied: crates and pallets follow the ratio actual ÷ demand */
function fdCellAct(o, dem, crt, pal, a) {
  if (a == null) return { dem, crt, pal }; if (dem > 0) { const f = a / dem; return { dem: a, crt: crt * f, pal: pal * f }; }
  const c = o.pcsCrt ? a / o.pcsCrt : 0; return { dem: a, crt: c, pal: o.crtPallet && c ? c / o.crtPallet : (o.unitPallet ? a / o.unitPallet : 0) };
}
/* one trip = one trailer to one location on one day; P12 pallets and P6 + cage pallets travel on separate trailers */
function fdTrips(s, cfg, act) {
  const out = [], reg = dpRegions(s); act = act || {};
  s.days.forEach(d => s.locs.forEach((loc, j) => {
    const G = { P12: [], P6: [] };
    s.rows.forEach(o => { const dem0 = (o.v.dem[d] || [])[j] || 0, key = d + '|' + loc + '|' + o.code, ac = fdCellAct(o, dem0, (o.v.crt[d] || [])[j] || 0, (o.v.pal[d] || [])[j] || 0, act[key]), dem = ac.dem, crt = ac.crt, pal = ac.pal; if (dem > 0 || pal > 0) G[o.palletType === 'P12' ? 'P12' : 'P6'].push({ o, dem, crt, pal, dem0, key }); });
    ['P12', 'P6'].forEach(g => {
      const ls = G[g]; if (!ls.length) return;
      const cap = Math.max(1, +(g === 'P12' ? cfg.capP12 : cfg.capP6) || 1), tot = ls.reduce((t, x) => t + x.pal, 0), n = Math.max(1, Math.ceil(tot / cap - 1e-9)), tgt = cfg.balance ? tot / n : cap;
      const trips = []; for (let i = 0; i < n; i++) trips.push({ day: d, loc, region: reg[loc] || '', g, gl: g === 'P12' ? 'P12' : 'P6 + cage', cap, pal: 0, lines: [] });
      const mk = (x, q, c, p) => ({ code: x.o.code, item: x.o.item, brand: x.o.brand, category: x.o.category, uom: uomOv(x.o.code, uomAreaGet('fd') || x.o.uom), uom0: uomAreaGet('fd') || x.o.uom, prodIn: x.o.prodIn, ptype: x.o.palletType, qty: q, crt: c, pal: p, ltr: q * (x.o.ltrConv || 0), key: x.key, dem0: x.dem > 0 ? x.dem0 * q / x.dem : 0 });
      let t = 0;
      ls.forEach(x => {
        let rem = x.pal, uRem = x.dem, cRem = x.crt;
        if (rem <= 1e-9) { trips[t].lines.push(mk(x, x.dem, x.crt, 0)); return; }
        while (rem > 1e-9) {
          const cur = trips[t], room = t === n - 1 ? Infinity : Math.max(0, tgt - cur.pal); if (room < 1e-9) { t++; continue; }
          const take = Math.min(rem, room), whole = take >= rem - 1e-9, u = whole ? uRem : Math.min(uRem, Math.round(x.dem * take / x.pal)), c = whole ? cRem : cRem * (take / rem);
          cur.lines.push(mk(x, u, c, take)); cur.pal += take; rem -= take; uRem -= u; cRem -= c; if (!whole) t++;
        }
      });
      const used = trips.filter(z => z.lines.length);
      used.forEach((z, i) => { z.no = i + 1; z.n = used.length; z.id = `T${d.slice(5, 7)}${d.slice(8, 10)}-${loc}-${g}-${String(i + 1).padStart(2, '0')}`; z.util = z.pal / z.cap; z.units = z.lines.reduce((a, l) => a + l.qty, 0); z.crates = z.lines.reduce((a, l) => a + l.crt, 0); out.push(z); });
    });
  }));
  return out;
}
function fdModel(s) {
  const st = fdStLoad(s.planDate), trips = fdTrips(s, st.cfg, st.act), m = { snap: s, st, trips, byId: new Map(trips.map(t => [t.id, t])), rowBy: new Map(s.rows.map(o => [o.code, o])) };
  Object.defineProperty(st, '_m', { value: m, enumerable: false, writable: true }); m.alloc = fdAlloc(m); return m;
}
/* ---- batches: a SKU can have SEVERAL batches on a day. The pool (day + SKU) is spread over the trip lines in trip order; a trip line can also carry its own list ---- */
const fdBlank = x => !(x && (x.b || x.p || x.e));
function fdPoolRaw(st, day, code) { const k = day + '|' + code, a = st.bl[k]; if (Array.isArray(a)) return a; const o = st.batch[k]; return o && (o.b || o.p || o.e) ? [{ b: o.b || '', p: o.p || '', e: o.e || '', q: '' }] : []; }
const fdPool = (st, day, code) => fdPoolRaw(st, day, code).filter(x => !fdBlank(x));
function fdSplit(list, total) {   // spread `total` units over the batches in order; a blank quantity takes whatever is left
  const out = []; let rem = total; list.forEach(x => { if (rem <= 1e-9) return; const cap = +x.q > 0 ? +x.q : Infinity, take = Math.min(rem, cap); out.push({ b: x.b || '', p: x.p || '', e: x.e || '', q: take }); rem -= take; });
  if (rem > 1e-9 || !out.length) out.push({ b: '', p: '', e: '', q: rem > 1e-9 ? rem : total, none: true }); return out;
}
const fdOwn = ov => !!(ov && ((Array.isArray(ov.bl) && ov.bl.length) || ov.b || ov.p || ov.e));
function fdAlloc(m) {
  const st = m.st, left = new Map(), res = new Map();
  m.trips.forEach(t => t.lines.forEach(l => {
    if (fdOwn(st.line[t.id + '|' + l.code])) return; const pk = t.day + '|' + l.code; let pool = left.get(pk);
    if (!pool) { pool = fdPool(st, t.day, l.code).map(x => ({ b: x.b || '', p: x.p || '', e: x.e || '', q: +x.q > 0 ? +x.q : Infinity })); left.set(pk, pool); }
    let rem = l.qty; const segs = []; for (const x of pool) { if (rem <= 1e-9) break; if (x.q <= 1e-9) continue; const take = Math.min(rem, x.q); segs.push({ b: x.b, p: x.p, e: x.e, q: take }); x.q -= take; rem -= take; }
    if (rem > 1e-9 || !segs.length) segs.push({ b: '', p: '', e: '', q: rem > 1e-9 ? rem : l.qty, none: true }); res.set(t.id + '|' + l.code, segs);
  })); return res;
}
/* the batches (with their quantities) that go on one trip line */
function fdSegs(st, t, l) {
  const ov = st.line[t.id + '|' + l.code] || {};
  if (Array.isArray(ov.bl) && ov.bl.length) return fdSplit(ov.bl.filter(x => !fdBlank(x) || +x.q > 0), l.qty);
  if (ov.b || ov.p || ov.e) { const d = fdPool(st, t.day, l.code)[0] || {}; return [{ b: ov.b || d.b || '', p: ov.p || d.p || '', e: ov.e || d.e || '', q: l.qty }]; }
  const m = st._m; return (m && m.alloc && m.alloc.get(t.id + '|' + l.code)) || [{ b: '', p: '', e: '', q: l.qty, none: true }];
}
const fdBat = (st, t, l) => { const x = fdSegs(st, t, l)[0] || {}; return { b: x.b || '', p: x.p || '', e: x.e || '' }; };
function fdCheck(t, st) {
  const c = st.cfg, bad = [], warn = []; let done = 0, minLeft = null;
  if (t.util * 100 < c.minUtil - 1e-9) warn.push(`Fill ${plF(t.util * 100, 0)}% is below the ${c.minUtil}% minimum`);
  t.lines.forEach(l => { const S = fdSegs(st, t, l); if (S.every(b => b.b && b.p && b.e)) done++;
    S.forEach(b => { const w = l.code + (S.length > 1 ? ` (batch ${b.b || '?'})` : '');
      if (b.p && b.e && b.e <= b.p) bad.push(`${w}: expiry is not after production`);
      if (b.p && fdDayMs(b.p) > fdDayMs(t.day)) bad.push(`${w}: produced after the dispatch day`);
      if (b.e) { const left = Math.round((fdDayMs(b.e) - fdDayMs(t.day)) / 864e5); if (minLeft === null || left < minLeft) minLeft = left; if (left < c.minShelf) bad.push(`${w}: only ${left} day(s) of shelf life at dispatch (min ${c.minShelf})`); } }); });
  if (done < t.lines.length) warn.push(`${t.lines.length - done} of ${t.lines.length} lines without batch / production / expiry`);
  const stt = st.status[t.id] || 'Planned', m = st.meta[t.id] || {};
  if (['Loaded', 'Dispatched'].includes(stt) && !(m.plate && m.driver)) warn.push('Trailer plate / driver not entered');
  return { lvl: bad.length ? 'bad' : warn.length ? 'warn' : 'ok', issues: bad.concat(warn), done, lines: t.lines.length, minLeft, status: stt };
}
const fdLvlTxt = l => l === 'ok' ? '✔ Compliant' : l === 'warn' ? '⚠ Review' : '✘ Non-compliant';

/* ---------- printing (delivery note / picking list) through a hidden frame ---------- */
function fdPrintHtml(html, title) {
  if (featBlock('print')) return;
  const pick = /picking/i.test(title), key = /milco/i.test(title) ? 'mdp' : 'fdpick';   // picking lists: portrait or landscape + chosen fields; delivery notes stay as they are
  if (pick) html = plPfApply(html, key);
  let doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:8mm}${NP_CSS}</style></head><body>${npDecoratePg(html, /deliver/i.test(title) ? 'DN' : 'PL')}</body></html>`;
  if (pick) doc = plPfOrient(doc, key);
  npOpenPrint(doc, title);
}
/* UoM chosen in the trip window (default PLT) + the quantity converted with the same factors as "Qty in UoM" — for the trip print / Excel / email */
function fdUc(l) { const o = l.uom0 || l.uom, c = l.uom || o; if (!c || wUomCanon(c) === wUomCanon(o)) return { u: o, f: 1 }; const fo = uomFac(l.code, o, l), fc = uomFac(l.code, c, l); return fo && fc ? { u: c, f: fo / fc } : { u: o, f: 1 }; }
const fdQc = (v, f) => f === 1 ? v : Math.round(v * f * 1000) / 1000;
function fdOrd(t, st) { st = st || (fd.m && fd.m.st); const o = st && st.ord && st.ord[t.id]; if (!o || !o.length) return t.lines; const ix = new Map(o.map((c, i) => [c, i])); return t.lines.map((l, i) => [l, i]).sort((a, b) => (ix.has(a[0].code) ? ix.get(a[0].code) : 1e6 + a[1]) - (ix.has(b[0].code) ? ix.get(b[0].code) : 1e6 + b[1])).map(x => x[0]); }
function fdOrdMove(code, to, before) { const t = fd.m.byId.get(fd.open); if (!t) return; const st = fd.m.st, cs = fdOrd(t, st).map(l => l.code), i = cs.indexOf(code); if (i < 0) return; cs.splice(i, 1); let j = typeof to === 'number' ? Math.max(0, Math.min(cs.length, i + to)) : cs.indexOf(to); if (typeof to !== 'number') { if (j < 0) { cs.splice(i, 0, code); return; } if (!before) j++; } cs.splice(j, 0, code); (st.ord = st.ord || {})[t.id] = cs; fdStSave(fd.date, st); }
function fdDocHtml(trips, kind, st) {
  const dn = kind === 'dn', n = (v, d) => plF(v, d == null ? 0 : d);
  return trips.map(t => {
    const m = st.meta[t.id] || {}, prod = [...new Set(t.lines.map(l => l.prodIn).filter(Boolean))].join(', ') || '—';
    let rn = 0; const nq = v => n(v, Number.isInteger(Math.round(v * 1e6) / 1e6) ? 0 : 2);   // quantities are the ACTUAL quantities; a SKU with several batches prints one row per batch
    const rows = fdOrd(t, st).map(l => { const U = fdUc(l), f2 = v => U.f === 1 ? nq(v) : n(v * U.f, 2); return fdSegs(st, t, l).map(b => { const f = l.qty ? b.q / l.qty : 1; rn++; return `<tr><td>${rn}</td><td>${escapeHtml(l.code)}</td><td>${escapeHtml(l.item)}</td><td>${escapeHtml(U.u)}</td><td class="n">${f2(b.q)}</td><td class="n">${l.ltr ? n(l.ltr * f, 0) : ''}</td><td class="n">${l.crt ? n(l.crt * f, 1) : ''}</td><td class="n">${n(l.pal * f, 2)}</td><td>${escapeHtml(b.b)}</td><td>${escapeHtml(b.p)}</td><td>${escapeHtml(b.e)}</td>${dn ? '' : '<td style="text-align:center"><span class="box"></span></td>'}</tr>`; }).join(''); }).join('');
    return `<section class="pg" data-no="${escapeHtml(t.id)}"><h1>${dn ? 'DELIVERY NOTE' : 'PICKING LIST'}</h1><div class="sub">${escapeHtml(t.id)} · ${escapeHtml(dpDayLong(t.day))} · trailer ${t.no} of ${t.n} (${escapeHtml(t.gl)})</div>
    <div class="meta"><div><b>${dn ? 'Delivery note no.' : 'Picking list no.'}</b>${escapeHtml(t.id)}</div><div><b>Date</b>${escapeHtml(t.day)}</div><div><b>Delivery location</b>${escapeHtml(t.loc)}${t.region ? ' (' + escapeHtml(t.region) + ')' : ''}</div>
    <div><b>Dispatch point</b>${escapeHtml(prod)}</div><div><b>Trailer type</b>${escapeHtml(t.gl)} · ${n(t.pal, 1)} / ${n(t.cap)} pallets (${n(t.util * 100)}%)</div><div><b>Status</b>${escapeHtml(st.status[t.id] || 'Planned')}</div>
    <div><b>Trailer plate</b>${escapeHtml(m.plate || '')}&nbsp;</div><div><b>Driver</b>${escapeHtml(m.driver || '')}&nbsp;</div><div><b>Seal no.</b>${escapeHtml(m.seal || '')}&nbsp;</div></div>
    <table><thead><tr><th>#</th><th>ICODE</th><th>Description</th><th>UoM</th><th class="n">Qty (units)</th><th class="n">Litres</th><th class="n">Crates</th><th class="n">Pallets</th><th>Batch</th><th>Prod. date</th><th>Expiry date</th>${dn ? '' : '<th>Picked</th>'}</tr></thead><tbody>${rows}
    <tr class="t"><td></td><td colspan="3">Total · ${t.lines.length} SKU line(s)</td><td class="n">${nq(t.units)}</td><td class="n">${n(t.lines.reduce((a, l) => a + (l.ltr || 0), 0), 0)}</td><td class="n">${n(t.crates, 1)}</td><td class="n">${n(t.pal, 2)}</td><td colspan="${dn ? 3 : 4}"></td></tr></tbody></table>
    ${m.note ? `<div class="sub" style="margin-top:6px">Remarks: ${escapeHtml(m.note)}</div>` : ''}
    <div class="sig"><div>${dn ? 'Prepared by' : 'Picked by'}${dn ? ': ' + escapeHtml((typeof currentUser !== 'undefined' && currentUser && (currentUser.displayName || currentUser.username)) || '') : ''}</div><div>${dn ? 'Driver signature' : 'Checked by'}</div><div>${dn ? 'Received by (name / stamp / date)' : 'Loaded by'}</div></div></section>`;
  }).join('');
}
function fdWorkbook(m, trips) {
  const wb = XLSX.utils.book_new(), add = (n, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), n), st = m.st;
  add('Trips', [['Trip', 'Day', 'Location', 'Region', 'Trailer type', 'Trailer', 'Pallets', 'Capacity', 'Fill %', 'Lines', 'Units', 'Litres', 'Crates', 'Status', 'Plate', 'Driver', 'Seal', 'Result', 'Issues']].concat(trips.map(t => { const c = fdCheck(t, st), mt = st.meta[t.id] || {}; return [t.id, t.day, t.loc, t.region, t.gl, `${t.no}/${t.n}`, +t.pal.toFixed(2), t.cap, +(t.util * 100).toFixed(0), t.lines.length, t.units, Math.round(t.lines.reduce((a, l) => a + (l.ltr || 0), 0)), +t.crates.toFixed(1), c.status, mt.plate || '', mt.driver || '', mt.seal || '', fdLvlTxt(c.lvl), c.issues.join('; ')]; })));
  add('Picking lines', [['Trip', 'Day', 'Location', 'Trailer type', 'ICODE', 'Item', 'UoM', 'Actual units', 'Litres', 'Crates', 'Pallets', 'Batch', 'Production date', 'Expiry date', 'Demand units (line)']].concat(trips.flatMap(t => t.lines.flatMap(l => fdSegs(st, t, l).map(b => { const f = l.qty ? b.q / l.qty : 1; return [t.id, t.day, t.loc, t.gl, l.code, l.item, l.uom0 || l.uom, +b.q.toFixed(3), Math.round((l.ltr || 0) * f), +(l.crt * f).toFixed(2), +(l.pal * f).toFixed(3), b.b, b.p, b.e, +(l.dem0 * f).toFixed(2)]; })))));
  add('Actual vs demand', [['Day', 'Location', 'ICODE', 'Item', 'UoM', 'Demand', 'Actual', 'Difference', 'Reason']].concat(fdQtyRowsOf(m).filter(r => r.adj).map(r => [r.d, r.loc, r.o.code, r.o.item, r.o.uom, r.dem, r.act, +(r.act - r.dem).toFixed(3), st.actNote[r.key] || ''])));
  return wb;
}


/* ============================================================
   F&D PLAN — screen
   ============================================================ */
const fd = { plans: [], date: '', m: null, day: '', locs: [], q: '', tab: 'dispatch', pv: 'loc', pm: 'qty', open: null, qshown: 300, qadj: false };
const FD_TABS = [['dispatch', '🗺 Dispatch plan'], ['qty', '✏ Actual quantities'], ['trips', '🚛 Trips / trailers'], ['picking', '📋 Picking lists'], ['batches', '🏷 Batch & dates'], ['compliance', '✅ Compliance']];
const fdSnapAll = async () => (await dpAll()).filter(s => s && s.planDate && s.rows && s.days).sort((a, b) => a.planDate.localeCompare(b.planDate));
async function fdLoad(sel) {
  fd.plans = await fdSnapAll(); const want = sel || fd.date || dpCfg().sel, s = fd.plans.find(x => x.planDate === want) || fd.plans[fd.plans.length - 1];
  fd.m = s ? fdModel(s) : null; fd.date = s ? s.planDate : ''; if (fd.m && fd.day && !s.days.includes(fd.day)) fd.day = ''; if (fd.m) fd.locs = fd.locs.filter(l => s.locs.includes(l));
}
const fdVis = () => { if (!fd.m) return []; const q = fd.q.trim().toLowerCase(); return fd.m.trips.filter(t => (!fd.day || t.day === fd.day) && (!fd.locs.length || fd.locs.includes(t.loc)) && (!q || t.id.toLowerCase().includes(q) || t.lines.some(l => (l.code + ' ' + l.item).toLowerCase().includes(q)))); };
const fdN = (v, d) => plF(v, d == null ? 0 : d);
const fdPill = (lvl, txt) => `<span class="fd-pill ${lvl}">${escapeHtml(txt)}</span>`;
const fdFill = u => `<span class="fd-barbg"><span class="fd-bar" style="width:${Math.min(100, u * 100)}%;display:block;height:8px;${u * 100 < (fd.m ? fd.m.st.cfg.minUtil : 0) ? 'background:#e0a100' : ''}"></span></span>${fdN(u * 100)}%`;
function fdPopulate() {
  const m = fd.m; PLQ('#fdPlanSel').innerHTML = fd.plans.slice().reverse().map(s => `<option value="${s.planDate}" ${s.planDate === fd.date ? 'selected' : ''}>${s.planDate} · ${s.days.map(dpDayLbl).join(', ')}</option>`).join('');
  if (!m) return; const s = m.snap;
  PLQ('#fdDaySel').innerHTML = '<option value="">All days</option>' + s.days.map(d => `<option value="${d}" ${d === fd.day ? 'selected' : ''}>${plEsc(dpDayLong(d))}</option>`).join('');
  const lh = PLQ('#fdLocHost'), sig = s.locs.join(',') + '|' + fd.locs.join(','); if (lh.dataset.sig !== sig) { lh.dataset.sig = sig; lh.innerHTML = ''; lh.appendChild(buildMultiCombo(fd.locs, s.locs, arr => { fd.locs = arr; lh.dataset.sig = s.locs.join(',') + '|' + arr.join(','); fdRender(); }, { placeholder: 'All locations — type to search, pick one or more' })); }
  const c = m.st.cfg; PLQ('#fdCapP12').value = c.capP12; PLQ('#fdCapP6').value = c.capP6; PLQ('#fdMinUtil').value = c.minUtil; PLQ('#fdMinShelf').value = c.minShelf; PLQ('#fdShelf').value = c.shelf; PLQ('#fdBalance').checked = !!c.balance;
}
function fdKpis() {
  const m = fd.m, T = fdVis(), st = m.st, el = PLQ('#fdKpis'); const chk = T.map(t => fdCheck(t, st)), ok = chk.filter(c => c.lvl === 'ok').length;
  const p12 = T.filter(t => t.g === 'P12').length, p6 = T.length - p12, pal = T.reduce((a, t) => a + t.pal, 0), lines = T.reduce((a, t) => a + t.lines.length, 0), skus = new Set(T.flatMap(t => t.lines.map(l => l.code))).size;
  const util = T.length ? T.reduce((a, t) => a + t.pal, 0) / T.reduce((a, t) => a + t.cap, 0) : 0, bd = chk.reduce((a, c) => a + c.done, 0), bl = chk.reduce((a, c) => a + c.lines, 0);
  let file = 0; m.snap.days.forEach(d => { if (fd.day && d !== fd.day) return; const lg = (m.snap.sheet.logi || {})[d]; if (lg) m.snap.locs.forEach((l, j) => { if (!fd.locs.length || fd.locs.includes(l)) file += lg.totalTrips[j] || 0; }); });
  const K = (l, v, s) => `<div class="pl-kpi"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`;
  el.innerHTML = K('Trailers (trips)', fdN(T.length), `${p12} × P12 · ${p6} × P6 + cage`) + K('Pallets', fdN(pal, 1), `${fdN(T.reduce((a, t) => a + t.crates, 0))} crates`) + K('Picking lines', fdN(lines), `${fdN(skus)} SKUs · ${new Set(T.map(t => t.loc)).size} locations`) +
    K('Average trailer fill', fdN(util * 100) + '%', `minimum ${st.cfg.minUtil}%`) + K('Batch details entered', bl ? fdN(bd / bl * 100) + '%' : '—', `${fdN(bd)} of ${fdN(bl)} lines`) + K('Compliant trips', `${ok} / ${T.length}`, `${chk.filter(c => c.lvl === 'bad').length} non-compliant · ${chk.filter(c => c.lvl === 'warn').length} to review`) + K('Actual vs demand', (() => { const a = T.reduce((x, t) => x + t.units, 0), dm = T.reduce((x, t) => x + t.lines.reduce((y, l) => y + l.dem0, 0), 0); return dm ? fdN(a / dm * 100, 1) + '%' : '—'; })(), `${fdN(Object.keys(st.act).length)} quantity cell(s) adjusted`) + K('Trips in the file', fdN(file, 1), `we plan ${fdN(T.length)} whole trailers`);
}
const fdTh = (h, n) => `<th class="${n ? 'n' : ''}">${h}</th>`;
function fdDispatch(T) {
  const m = fd.m, g = new Map(); T.forEach(t => { const k = t.day + '|' + t.loc; if (!g.has(k)) g.set(k, { day: t.day, loc: t.loc, region: t.region, p12: 0, p6: 0, n12: 0, n6: 0, pal: 0, cap: 0, skus: new Set() }); const x = g.get(k); if (t.g === 'P12') { x.p12 += t.pal; x.n12++; } else { x.p6 += t.pal; x.n6++; } x.pal += t.pal; x.cap += t.cap; t.lines.forEach(l => x.skus.add(l.code)); });
  const rows = [...g.values()].sort((a, b) => a.day.localeCompare(b.day) || m.snap.locs.indexOf(a.loc) - m.snap.locs.indexOf(b.loc)), tot = { p12: 0, p6: 0, n12: 0, n6: 0, pal: 0, cap: 0, f: 0 };
  const body = rows.map(x => { const j = m.snap.locs.indexOf(x.loc), lg = (m.snap.sheet.logi || {})[x.day], f = lg ? (lg.totalTrips[j] || 0) : null; ['p12', 'p6', 'n12', 'n6', 'pal', 'cap'].forEach(k => tot[k] += x[k]); tot.f += f || 0;
    return `<tr class="fd-click" title="Double-click to open" data-day="${x.day}" data-loc="${x.loc}"><td>${plEsc(dpDayLong(x.day))}</td><td><b>${x.loc}</b></td><td>${x.region}</td><td class="n">${x.skus.size}</td><td class="n">${fdN(x.p12, 1)}</td><td class="n">${fdN(x.p6, 1)}</td><td class="n">${x.n12}</td><td class="n">${x.n6}</td><td class="n"><b>${x.n12 + x.n6}</b></td><td>${fdFill(x.pal / x.cap)}</td><td class="n">${f == null ? '—' : fdN(f, 2)}</td></tr>`; }).join('');
  return `<div class="fd-sub">Double-click a row to open that location’s trips. Trailers are whole trips; the last trailer of a group carries the remainder.</div><div class="fd-wrap"><table class="fd-tbl"><thead><tr>${fdTh('Day')}${fdTh('Location')}${fdTh('Region')}${fdTh('SKUs', 1)}${fdTh('P12 pallets', 1)}${fdTh('P6 + cage pallets', 1)}${fdTh('P12 trailers', 1)}${fdTh('P6 trailers', 1)}${fdTh('Total trailers', 1)}${fdTh('Fill')}${fdTh('Trips in file', 1)}</tr></thead><tbody>${body || '<tr><td colspan="11" class="pl-empty">No demand for this selection.</td></tr>'}
  <tr class="fd-tot"><td colspan="4">Total</td><td class="n">${fdN(tot.p12, 1)}</td><td class="n">${fdN(tot.p6, 1)}</td><td class="n">${tot.n12}</td><td class="n">${tot.n6}</td><td class="n">${tot.n12 + tot.n6}</td><td>${tot.cap ? fdFill(tot.pal / tot.cap) : ''}</td><td class="n">${fdN(tot.f, 2)}</td></tr></tbody></table></div>`;
}
function fdTripsTab(T) {
  const st = fd.m.st, body = T.map(t => { const c = fdCheck(t, st);
    return `<tr class="fd-click" title="Double-click to open" data-id="${t.id}"><td><b>${t.id}</b></td><td>${plEsc(dpDayLbl(t.day))}</td><td>${t.loc}</td><td>${t.gl}</td><td class="n">${t.no}/${t.n}</td><td class="n">${fdN(t.pal, 1)} / ${t.cap}</td><td>${fdFill(t.util)}</td><td class="n">${t.lines.length}</td><td class="n">${fdN(t.units)}</td><td class="n">${fdN(t.lines.reduce((a, l) => a + (l.ltr || 0), 0))}</td><td class="n">${c.done}/${c.lines}</td>
    <td><select data-st="${t.id}">${FD_STATUS.map(s => `<option ${s === c.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td>${fdPill(c.lvl, fdLvlTxt(c.lvl))}</td><td style="white-space:nowrap"><button class="secondary small" data-open="${t.id}" type="button" title="Trip items — add / remove items, change quantities, batches">📋 Items</button> <button class="ghost small" data-pk="${t.id}" type="button">🖨 Pick</button> <button class="ghost small" data-dn="${t.id}" type="button">🖨 DN</button></td></tr>`; }).join('');
  return `<div class="fd-sub">${fdN(T.length)} trip(s). Open a trip to enter batch / production / expiry dates, trailer details and print its delivery note.</div><div class="fd-wrap"><table class="fd-tbl"><thead><tr>${fdTh('Trip')}${fdTh('Day')}${fdTh('Location')}${fdTh('Type')}${fdTh('Trailer', 1)}${fdTh('Pallets / cap.', 1)}${fdTh('Fill')}${fdTh('Lines', 1)}${fdTh('Units', 1)}${fdTh('Litres', 1)}${fdTh('Batch info', 1)}${fdTh('Status')}${fdTh('Result')}${fdTh('Actions')}</tr></thead><tbody>${body || '<tr><td colspan="14" class="pl-empty">No trips for this selection.</td></tr>'}</tbody></table></div>`;
}
function fdPicking(T) {
  const m = fd.m, met = fd.pm, mn = { qty: 'Units', ltr: 'Litres', crt: 'Crates', pal: 'Pallets' }[met], dp_ = met === 'pal' ? 2 : met === 'crt' ? 1 : 0;
  const ctl = `<div class="fd-ctl"><label>View <select data-pv><option value="loc" ${fd.pv === 'loc' ? 'selected' : ''}>By location (pick list per location)</option><option value="date" ${fd.pv === 'date' ? 'selected' : ''}>By date (SKU × location)</option></select></label><label>Measure <select data-pm><option value="qty" ${met === 'qty' ? 'selected' : ''}>Units</option><option value="ltr" ${met === 'ltr' ? 'selected' : ''}>Litres</option><option value="crt" ${met === 'crt' ? 'selected' : ''}>Crates</option><option value="pal" ${met === 'pal' ? 'selected' : ''}>Pallets</option></select></label></div>`;
  const days = [...new Set(T.map(t => t.day))].sort(); let out = ctl;
  if (!T.length) return out + '<div class="pl-empty">No picking lines for this selection.</div>';
  if (fd.pv === 'loc') {
    days.forEach(d => m.snap.locs.forEach(loc => { const ts = T.filter(t => t.day === d && t.loc === loc); if (!ts.length) return; const g = new Map();
      ts.forEach(t => t.lines.forEach(l => { if (!g.has(l.code)) g.set(l.code, { l, qty: 0, ltr: 0, crt: 0, pal: 0, tr: [] }); const x = g.get(l.code); x.qty += l.qty; x.ltr += l.ltr || 0; x.crt += l.crt; x.pal += l.pal; x.tr.push(`${t.g === 'P12' ? 'P12' : 'P6'}-${String(t.no).padStart(2, '0')}`); }));
      const rows = [...g.values()], tp = ts.reduce((a, t) => a + t.pal, 0);
      out += `<div class="fd-sub"><b>${loc}</b> · ${plEsc(dpDayLong(d))} — ${rows.length} SKUs · ${fdN(tp, 1)} pallets · ${ts.length} trailer(s)</div><div class="fd-wrap" style="max-height:none"><table class="fd-tbl"><thead><tr>${fdTh('ICODE')}${fdTh('Item')}${fdTh('UoM')}${fdTh('Units', 1)}${fdTh('Litres', 1)}${fdTh('Crates', 1)}${fdTh('Pallets', 1)}${fdTh('Trailer(s)')}</tr></thead><tbody>${rows.map(x => `<tr><td>${plEsc(x.l.code)}</td><td>${plEsc(x.l.item)}</td><td>${plEsc(x.l.uom)}</td><td class="n">${fdN(x.qty)}</td><td class="n">${x.ltr ? fdN(x.ltr) : ''}</td><td class="n">${x.crt ? fdN(x.crt, 1) : ''}</td><td class="n">${fdN(x.pal, 2)}</td><td>${[...new Set(x.tr)].join(', ')}</td></tr>`).join('')}</tbody></table></div>`; }));
  } else {
    days.forEach(d => { const ts = T.filter(t => t.day === d), locs = m.snap.locs.filter(l => ts.some(t => t.loc === l)), g = new Map(); const tot = {};
      ts.forEach(t => t.lines.forEach(l => { if (!g.has(l.code)) g.set(l.code, { l, v: {} }); const x = g.get(l.code); x.v[t.loc] = (x.v[t.loc] || 0) + l[met]; tot[t.loc] = (tot[t.loc] || 0) + l[met]; }));
      out += `<div class="fd-sub"><b>${plEsc(dpDayLong(d))}</b> — ${mn} per SKU and location</div><div class="fd-wrap" style="max-height:none"><table class="fd-tbl"><thead><tr>${fdTh('ICODE')}${fdTh('Item')}${fdTh('UoM')}${locs.map(l => fdTh(l, 1)).join('')}${fdTh('Total', 1)}</tr></thead><tbody>${[...g.values()].map(x => `<tr><td>${plEsc(x.l.code)}</td><td>${plEsc(x.l.item)}</td><td>${plEsc(x.l.uom)}</td>${locs.map(l => `<td class="n">${x.v[l] ? fdN(x.v[l], dp_) : ''}</td>`).join('')}<td class="n"><b>${fdN(Object.values(x.v).reduce((a, b) => a + b, 0), dp_)}</b></td></tr>`).join('')}
      <tr class="fd-tot"><td colspan="3">Total</td>${locs.map(l => `<td class="n">${fdN(tot[l] || 0, dp_)}</td>`).join('')}<td class="n">${fdN(Object.values(tot).reduce((a, b) => a + b, 0), dp_)}</td></tr></tbody></table></div>`; });
  }
  return out;
}
/* ---------- actual quantities: demand from the file, actual = demand until the user changes it ---------- */
function fdQtyRowsOf(m, filt) {
  const s = m.snap, st = m.st, q = filt ? fd.q.trim().toLowerCase() : '', out = [];
  s.days.forEach(d => { if (filt && fd.day && d !== fd.day) return; s.locs.forEach((loc, j) => { if (filt && fd.locs.length && !fd.locs.includes(loc)) return;
    s.rows.forEach(o => { const dem = (o.v.dem[d] || [])[j] || 0, key = d + '|' + loc + '|' + o.code, act = st.act[key]; if (!(dem > 0 || act != null)) return; if (q && !(o.code + ' ' + o.item + ' ' + loc).toLowerCase().includes(q)) return;
      out.push({ key, d, loc, o, dem, act: act != null ? act : dem, adj: act != null, crt0: (o.v.crt[d] || [])[j] || 0, pal0: (o.v.pal[d] || [])[j] || 0 }); }); }); });
  return out;
}
const fdQtyCalc = r => { const c = fdCellAct(r.o, r.dem, r.crt0, r.pal0, r.adj ? r.act : null); return { crt: c.crt, pal: c.pal, diff: r.act - r.dem, fill: r.dem > 0 ? r.act / r.dem * 100 : null }; };
const fdQnum = v => { const r = Math.round(v * 1e6) / 1e6; return Number.isInteger(r) ? plF(r, 0) : plF(r, 2); };
function fdQtyTotals() {
  const R = fd._q || [], dm = R.reduce((a, r) => a + r.dem, 0), ac = R.reduce((a, r) => a + r.act, 0), ad = R.filter(r => r.adj).length, el = document.querySelector('#fdQtyTot');
  if (el) el.innerHTML = `<b>${fdN(R.length)}</b> row(s) · demand <b>${fdQnum(dm)}</b> · actual <b>${fdQnum(ac)}</b> · <b>${dm ? fdN(ac / dm * 100, 1) : '—'}%</b> of demand · <b>${fdN(ad)}</b> adjusted`;
}
function fdQtyTab(T) {
  const m = fd.m, st = m.st, all = fdQtyRowsOf(m, true), R = fd.qadj ? all.filter(r => r.adj) : all, lim = fd.qshown || 300, show = R.slice(0, lim); fd._q = R;
  const inp = (r, c) => `<input type="number" min="0" step="any" data-qk="${plEsc(r.key)}" value="${plEsc(fdQnum(r.act).replace(/,/g, ''))}" ${r.adj ? 'style="background:#fff7d6;font-weight:700"' : ''}>`;
  const row = r => { const c = fdQtyCalc(r); return `<tr data-key="${plEsc(r.key)}"><td>${plEsc(dpDayLbl(r.d))}</td><td><b>${plEsc(r.loc)}</b></td><td>${plEsc(r.o.code)}</td><td>${plEsc(r.o.item)}</td><td>${plEsc(r.o.uom)}</td><td class="n">${fdQnum(r.dem)}</td><td style="min-width:96px">${inp(r)}</td><td class="n q-d" style="color:${c.diff < 0 ? '#d03b3b' : c.diff > 0 ? '#0a7a0a' : ''}">${c.diff ? (c.diff > 0 ? '+' : '') + fdQnum(c.diff) : ''}</td><td class="n q-f">${c.fill == null ? '' : fdN(c.fill, 0) + '%'}</td><td class="n q-c">${c.crt ? fdN(c.crt, 1) : ''}</td><td class="n q-p">${fdN(c.pal, 2)}</td><td style="min-width:150px"><input type="text" data-qn="${plEsc(r.key)}" value="${plEsc(st.actNote[r.key] || '')}" placeholder="Reason (optional)"></td><td><button class="ghost small" data-qr="${plEsc(r.key)}" type="button" title="Actual = demand">↺</button></td></tr>`; };
  setTimeout(fdQtyTotals, 0);
  return `<div class="fd-sub">The <b>demand</b> comes from the uploaded plan. The <b>actual quantity</b> starts equal to the demand — change it to what the store can really supply. The trailers, <b>picking lists and delivery notes are produced from the actual quantity</b>. Changing a quantity re-forms the trailers (trip numbers can change), so finish the quantities before entering trailer plates / seals. The filters above (day, location, search) apply here.</div>
  <div class="fd-ctl"><label>Scale the filtered rows to <input type="number" id="fdQScale" value="100" min="0" max="1000" step="5" style="width:78px"> % of demand</label><button class="ghost small" data-qa="scale" type="button">Apply</button><button class="ghost small" data-qa="reset" type="button">↺ Actual = demand (filtered rows)</button><label style="display:inline-flex;gap:5px;align-items:center"><input type="checkbox" data-qadj ${fd.qadj ? 'checked' : ''} style="width:auto;margin:0"> Only adjusted rows</label><span id="fdQtyTot" class="text-sm"></span></div>
  <div class="fd-wrap"><table class="fd-tbl"><thead><tr>${fdTh('Day')}${fdTh('Location')}${fdTh('ICODE')}${fdTh('Item')}${fdTh('UoM')}${fdTh('Demand', 1)}${fdTh('Actual qty')}${fdTh('Difference', 1)}${fdTh('Fill', 1)}${fdTh('Crates', 1)}${fdTh('Pallets', 1)}${fdTh('Reason')}${fdTh('')}</tr></thead><tbody>${show.map(row).join('') || '<tr><td colspan="13" class="pl-empty">No demand rows for this selection.</td></tr>'}</tbody></table></div>
  ${R.length > lim ? `<div class="btn-row" style="margin-top:6px"><button class="ghost small" data-qmore type="button">Show 300 more rows (${fdN(R.length - lim)} left)</button></div>` : ''}`;
}
function fdBatCell(list, attr, extra) {   // editable batch rows: batch no · production · expiry · quantity
  return list.map((x, i) => `<div class="fdb" style="display:grid;grid-template-columns:minmax(80px,1.2fr) 128px 128px minmax(64px,.7fr) 26px;gap:4px;margin:2px 0"><input type="text" ${attr} data-bi="${i}" data-f="b" value="${plEsc(x.b || '')}" placeholder="Batch no."><input type="date" ${attr} data-bi="${i}" data-f="p" value="${plEsc(x.p || '')}"><input type="date" ${attr} data-bi="${i}" data-f="e" value="${plEsc(x.e || '')}"><input type="number" min="0" step="any" ${attr} data-bi="${i}" data-f="q" value="${x.q === '' || x.q == null || x.q === Infinity ? '' : plEsc(String(Math.round(x.q * 1e6) / 1e6))}" placeholder="Qty"><button type="button" class="ghost small" ${attr} data-delb="${i}" style="padding:0" title="Remove this batch">✖</button></div>`).join('') + extra;
}
function fdBatches(T) {
  const st = fd.m.st, g = new Map(); T.forEach(t => t.lines.forEach(l => { const k = t.day + '|' + l.code; if (!g.has(k)) g.set(k, { day: t.day, l, qty: 0, tr: 0 }); const x = g.get(k); x.qty += l.qty; x.tr++; }));
  const rows = [...g.values()].sort((a, b) => a.day.localeCompare(b.day));
  return `<div class="fd-sub">Enter the batch, production and expiry date <b>if available</b> — one block per SKU and day. A SKU can have <b>several batches</b>: add a batch with <b>➕</b> and give each its <b>quantity</b> (units); the batches are spread over the trips in order, and a batch left without a quantity takes whatever is left. A trip line can still be overridden inside the trip. ${st.cfg.shelf ? `Expiry is filled automatically (production + ${st.cfg.shelf} days) when left empty.` : ''}</div><div class="fd-wrap"><table class="fd-tbl"><thead><tr>${fdTh('Day')}${fdTh('ICODE')}${fdTh('Item')}${fdTh('UoM')}${fdTh('Actual units', 1)}${fdTh('Trips', 1)}${fdTh('Batches — batch no. · production · expiry · quantity')}</tr></thead><tbody>${rows.map(x => { const k = x.day + '|' + x.l.code, raw = fdPoolRaw(st, x.day, x.l.code), list = raw.length ? raw : [{}], sum = raw.reduce((a, b) => a + (+b.q > 0 ? +b.q : 0), 0), open = raw.some(b => !(+b.q > 0) && !fdBlank(b));
    const note = raw.length > 1 || sum ? `<span class="text-sm" style="color:${open || Math.abs(sum - x.qty) < 1e-6 ? 'var(--gray-600)' : '#b45309'}">${open ? 'the last batch without a quantity takes the rest' : 'batches cover ' + fdQnum(sum) + ' of ' + fdQnum(x.qty) + ' units'}</span>` : '';
    return `<tr><td>${plEsc(dpDayLbl(x.day))}</td><td>${plEsc(x.l.code)}</td><td>${plEsc(x.l.item)}</td><td>${plEsc((x.l.uom0 || x.l.uom))}</td><td class="n">${fdQnum(x.qty)}</td><td class="n">${x.tr}</td><td>${fdBatCell(list, `data-bk="${plEsc(k)}"`, `<button type="button" class="ghost small" data-addb="${plEsc(k)}">➕ Add batch</button> ${note}`)}</td></tr>`; }).join('') || '<tr><td colspan="7" class="pl-empty">No SKUs for this selection.</td></tr>'}</tbody></table></div>`;
}
function fdCompliance(T) {
  const m = fd.m, st = m.st, chk = T.map(t => [t, fdCheck(t, st)]), cnt = l => chk.filter(c => c[1].lvl === l).length;
  let out = `<div class="fd-ctl">${fdPill('ok', '✔ ' + cnt('ok') + ' compliant')} ${fdPill('warn', '⚠ ' + cnt('warn') + ' to review')} ${fdPill('bad', '✘ ' + cnt('bad') + ' non-compliant')}<span class="text-sm" style="color:var(--gray-600)">Checks: trailer fill ≥ ${st.cfg.minUtil}% · batch / production / expiry entered · expiry after production · production not after dispatch · ≥ ${st.cfg.minShelf} days shelf life at dispatch · plate &amp; driver before loading.</span></div>`;
  out += `<div class="fd-wrap" style="max-height:46vh"><table class="fd-tbl"><thead><tr>${fdTh('Trip')}${fdTh('Day')}${fdTh('Location')}${fdTh('Type')}${fdTh('Fill')}${fdTh('Batch info', 1)}${fdTh('Min. days left', 1)}${fdTh('Status')}${fdTh('Result')}${fdTh('Findings')}</tr></thead><tbody>${chk.map(([t, c]) => `<tr class="fd-click" title="Double-click to open" data-id="${t.id}"><td><b>${t.id}</b></td><td>${plEsc(dpDayLbl(t.day))}</td><td>${t.loc}</td><td>${t.gl}</td><td>${fdFill(t.util)}</td><td class="n">${c.done}/${c.lines}</td><td class="n">${c.minLeft == null ? '—' : c.minLeft}</td><td>${c.status}</td><td>${fdPill(c.lvl, fdLvlTxt(c.lvl))}</td><td><ul class="fd-issues">${c.issues.slice(0, 4).map(i => `<li>${plEsc(i)}</li>`).join('')}${c.issues.length > 4 ? `<li>… +${c.issues.length - 4} more</li>` : ''}</ul></td></tr>`).join('') || '<tr><td colspan="10" class="pl-empty">No trips.</td></tr>'}</tbody></table></div>`;
  const g = new Map(); T.forEach(t => { const k = t.day + '|' + t.loc; if (!g.has(k)) g.set(k, { day: t.day, loc: t.loc, a: 0, b: 0 }); g.get(k)[t.g === 'P12' ? 'a' : 'b']++; });
  out += `<div class="fd-sub"><b>Plan vs the trips in the file</b> — whole trailers planned here against the file’s fractional trips (rounded up). A difference usually means the capacities above differ from the ones used in the file.</div><div class="fd-wrap" style="max-height:34vh"><table class="fd-tbl"><thead><tr>${fdTh('Day')}${fdTh('Location')}${fdTh('P12 file', 1)}${fdTh('P12 planned', 1)}${fdTh('P6 + cage file', 1)}${fdTh('P6 planned', 1)}${fdTh('Total file', 1)}${fdTh('Total planned', 1)}${fdTh('Result')}</tr></thead><tbody>${[...g.values()].sort((a, b) => a.day.localeCompare(b.day) || m.snap.locs.indexOf(a.loc) - m.snap.locs.indexOf(b.loc)).map(x => { const j = m.snap.locs.indexOf(x.loc), lg = (m.snap.sheet.logi || {})[x.day]; if (!lg) return `<tr><td>${plEsc(dpDayLbl(x.day))}</td><td>${x.loc}</td><td colspan="2"></td><td colspan="2"></td><td></td><td class="n">${x.a + x.b}</td><td>${fdPill('warn', 'No file trips')}</td></tr>`;
    const f12 = lg.tripsP12[j] || 0, f6 = lg.tripsP6[j] || 0, c12 = Math.ceil(f12 - 1e-9), c6 = Math.ceil(f6 - 1e-9), ok = c12 === x.a && c6 === x.b; return `<tr><td>${plEsc(dpDayLbl(x.day))}</td><td>${x.loc}</td><td class="n">${fdN(f12, 2)}</td><td class="n">${x.a}</td><td class="n">${fdN(f6, 2)}</td><td class="n">${x.b}</td><td class="n">${fdN(lg.totalTrips[j] || 0, 2)}</td><td class="n">${x.a + x.b}</td><td>${ok ? fdPill('ok', '✔ Matches') : fdPill('warn', `⚠ ${x.a + x.b - c12 - c6 > 0 ? '+' : ''}${x.a + x.b - c12 - c6} vs file`)}</td></tr>`; }).join('')}</tbody></table></div>`;
  return out;
}

/* ---------- full-screen view of a tab (same layout) with column filters, search, Excel, Email and Print — uses the app's table-expand window ---------- */

/* batches edited inside the expanded window: keep a plain-text copy of the batches in the cell so filter / Excel / Email / Print see them */
function fdBatSync(td) {
  const inp = td.querySelector('[data-bk]'); if (!inp) return; td.querySelectorAll('button').forEach(b => { if (b.textContent) { b.dataset.lbl = b.textContent; b.textContent = ''; } }); let sp = td.querySelector('.te-txt'); if (!sp) { sp = document.createElement('span'); sp.className = 'te-txt'; sp.style.display = 'none'; td.appendChild(sp); }
  const k = inp.dataset.bk, i = k.indexOf('|'), raw = fd.m ? fdPoolRaw(fd.m.st, k.slice(0, i), k.slice(i + 1)) : []; sp.textContent = raw.map(x => [x.b, x.p, x.e, x.q === '' || x.q == null ? '' : x.q].filter(v => v !== '' && v != null).join(' · ')).filter(Boolean).join(' ; ');
}

function fdBatCellRefresh(td, k) {
  const i = k.indexOf('|'), raw = fdPoolRaw(fd.m.st, k.slice(0, i), k.slice(i + 1)), list = raw.length ? raw : [{}], add = td.querySelector('[data-addb]'), sp = td.querySelector('span.text-sm');
  td.innerHTML = fdBatCell(list, `data-bk="${plEsc(k)}"`, (add ? add.outerHTML : `<button type="button" class="ghost small" data-addb="${plEsc(k)}">➕ Add batch</button>`) + (sp ? ' ' + sp.outerHTML : '')); fdBatSync(td);
}
function fdBatChange(i) {
  const st = fd.m.st, k = i.dataset.bk, f = i.dataset.f, bi = +i.dataset.bi, a = fdPoolEdit(st, k), v = i.value.trim(); while (a.length <= bi) a.push({ b: '', p: '', e: '', q: '' }); a[bi][f] = f === 'q' ? (v === '' ? '' : Math.max(0, +v)) : v;
  if (f === 'p' && v && st.cfg.shelf > 0 && !a[bi].e) { const d = new Date(fdDayMs(v) + st.cfg.shelf * 864e5).toISOString().slice(0, 10); a[bi].e = d; const ex = i.closest('.fdb').querySelector('[data-f=e]'); if (ex) ex.value = d; }
  if (!a.some(x => !fdBlank(x) || +x.q > 0)) { delete st.bl[k]; delete st.batch[k]; } fd.m.alloc = fdAlloc(fd.m); fdStSave(fd.date, st); fdKpis();
}
function fdExpClick(e) {
  if (!fd.expEdit || !fd.m) return; const ab = e.target.closest('[data-addb]'); if (ab) { const k = ab.dataset.addb, pa = fdPoolEdit(fd.m.st, k); if (!pa.length) pa.push({ b: '', p: '', e: '', q: '' }); pa.push({ b: '', p: '', e: '', q: '' }); fdBatCellRefresh(ab.closest('td'), k); return; }
  const db = e.target.closest('[data-delb][data-bk]'); if (db) { const st = fd.m.st, k = db.dataset.bk, td = db.closest('td'), a = fdPoolEdit(st, k); a.splice(+db.dataset.delb, 1); if (!a.some(x => !fdBlank(x) || +x.q > 0)) { delete st.bl[k]; delete st.batch[k]; } fd.m.alloc = fdAlloc(fd.m); fdStSave(fd.date, st); fdBatCellRefresh(td, k); }
}
function fdExpChange(e) { if (!fd.expEdit || !fd.m) return; const i = e.target; if (i.dataset.bk && i.dataset.bi !== undefined) { fdBatChange(i); fdBatSync(i.closest('td')); } }
function fdExpandTables(root, title, edit) {
  if (!window.tableExpandOpen) { sectionToast('The expand window is not available.', 'warn'); return; }
  if (root.id === 'fdBody' && !edit) { const o = fdTabClone(true); if (!o) { sectionToast('Nothing to expand on this tab.', 'warn'); return; } o.removeAttribute('id'); fd.expTitle = title; fd.expOn = true; window.tableExpandOpen(o); const tt0 = document.getElementById('teTitle'); if (tt0) tt0.textContent = '⤢ ' + title; return; }
  const tabs = [...root.querySelectorAll('table')].filter(t => t.rows.length > 1 && !t.closest('#tblExpandOverlay'));
  if (!tabs.length) { sectionToast('Nothing to expand on this tab.', 'warn'); return; }
  const sig = t => [...(t.tHead || t).rows[0].cells].map(c => c.textContent.trim()).join('|'), groups = new Map();
  tabs.forEach(t => { const k = sig(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
  const best = [...groups.values()].sort((a, b) => b.reduce((n, t) => n + t.rows.length, 0) - a.reduce((n, t) => n + t.rows.length, 0))[0], flat = el => { const c = el.cloneNode(true); if (!edit) c.querySelectorAll('input,textarea').forEach(i => { const sp = document.createElement('span'); sp.textContent = i.type === 'checkbox' ? (i.checked ? '✔' : '') : i.value; sp.setAttribute('style', i.getAttribute('style') || ''); i.replaceWith(sp); }); c.querySelectorAll('select').forEach(x => x.replaceWith(document.createTextNode(x.options[x.selectedIndex] ? x.options[x.selectedIndex].text : ''))); if (!edit) c.querySelectorAll('button').forEach(b => b.remove()); return c; };
  const out = flat(best[0]); out.removeAttribute('id'); if (root.id === 'fdBody' && fdTerms().length) { const terms = fdTerms(); [...out.tBodies[0].rows].forEach(r => { if (!r.classList.contains('fd-tot') && r.cells.length > 1 && !terms.every(t => fdRowText(r).includes(t))) r.remove(); }); } if (edit) out.classList.add('fd-ed');
  if (best.length > 1) {
    const hdr = out.tHead.rows[0]; const th = document.createElement('th'); th.textContent = 'Group'; hdr.insertBefore(th, hdr.cells[0]); const body = out.tBodies[0]; body.innerHTML = '';
    best.forEach(t => { const w = t.closest('.fd-wrap') || t, h = w.previousElementSibling, g = (h && !h.querySelector('table') ? h.textContent : '').replace(/\s+/g, ' ').trim(), c = flat(t); [...c.tBodies].forEach(b => [...b.rows].forEach(r => { const td = document.createElement('td'); td.textContent = g; r.insertBefore(td, r.cells[0]); body.appendChild(r); })); });
  }
  if (!edit) out.querySelectorAll('[title]').forEach(e => e.removeAttribute('title')); out.querySelectorAll('tr.fd-click').forEach(r => r.classList.remove('fd-click'));
  const host = document.createElement('div'); host.className = 'card'; host.innerHTML = '<div class="card-title"></div>'; host.firstChild.textContent = title; host.appendChild(out); if (edit) out.dataset.keepInputs = '1'; window.tableExpandOpen(out); fd.expEdit = !!edit; if (edit) document.querySelectorAll('#teBody td').forEach(fdBatSync);
  const tt = document.getElementById('teTitle'); if (tt) tt.textContent = '⤢ ' + title;
}
function fdRender() {
  const has = !!fd.m; PLQ('#fdEmpty').style.display = has ? 'none' : ''; PLQ('#fdMain').style.display = has ? '' : 'none'; if (!has) return;
  PLQ('#fdTabs').innerHTML = FD_TABS.map(t => `<button type="button" data-t="${t[0]}" class="${fd.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join(''); fdKpis();
  const T = fdVis(), f = { dispatch: fdDispatch, qty: fdQtyTab, trips: fdTripsTab, picking: fdPicking, batches: fdBatches, compliance: fdCompliance }[fd.tab]; PLQ('#fdBody').innerHTML = f(T); fdChips(); fdTabApply();
}

/* ---------- filter / Excel / Print / Email for the tab that is on screen, and the clear-filter chips ---------- */
fd.tf = '';
const fdTerms = () => fd.tf.toLowerCase().split(/\s+/).filter(Boolean);
const fdRowText = tr => [...tr.cells].map(c => { let t = c.textContent; c.querySelectorAll('input,select').forEach(i => { t += ' ' + (i.tagName === 'SELECT' ? (i.options[i.selectedIndex] || {}).text : i.value); }); return t; }).join(' ').toLowerCase();
function fdTabApply() {
  const terms = fdTerms(); let shown = 0, total = 0;
  document.querySelectorAll('#fdBody table tbody tr').forEach(tr => { if (tr.classList.contains('fd-tot') || tr.cells.length === 1) return; total++; const w = tr.closest('.fd-wrap'), h = w && w.previousElementSibling && !w.previousElementSibling.querySelector('table') ? w.previousElementSibling.textContent.toLowerCase() : '', ok = !terms.length || terms.every(t => (h + ' ' + fdRowText(tr)).includes(t)); tr.style.display = ok ? '' : 'none'; if (ok) shown++; });
  const c = document.querySelector('#fdTabCount'); if (c) c.textContent = terms.length ? `${fdN(shown)} of ${fdN(total)} row(s)` : total ? `${fdN(total)} row(s)` : '';
}
function fdTabClone(keepOpen) {
  const root = document.querySelector('#fdBody'), tabs = [...root.querySelectorAll('table')].filter(t => t.rows.length > 1), groups = new Map(), sig = t => [...(t.tHead || t).rows[0].cells].map(c => c.textContent.trim()).join('|');
  tabs.forEach(t => { const k = sig(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }); if (!groups.size) return null;
  const best = [...groups.values()].sort((a, b) => b.reduce((n, t) => n + t.rows.length, 0) - a.reduce((n, t) => n + t.rows.length, 0))[0];
  const flat = el => { const c = el.cloneNode(true); c.querySelectorAll('input,textarea').forEach(i => { const sp = document.createElement('span'); sp.textContent = i.type === 'checkbox' ? (i.checked ? '✔' : '') : i.value; i.replaceWith(sp); }); c.querySelectorAll('select').forEach(x => x.replaceWith(document.createTextNode(x.options[x.selectedIndex] ? x.options[x.selectedIndex].text : ''))); c.querySelectorAll('button').forEach(b => { if (keepOpen && b.dataset.open) { b.textContent = ''; } else b.remove(); }); c.querySelectorAll('tbody tr').forEach(r => { r.style.display = ''; }); return c; };
  const out = flat(best[0]); if (best.length > 1) { const hdr = out.tHead.rows[0], th = document.createElement('th'); th.textContent = 'Group'; hdr.insertBefore(th, hdr.cells[0]); const body = out.tBodies[0]; body.innerHTML = '';
    best.forEach(t => { const w = t.closest('.fd-wrap') || t, h = w.previousElementSibling, g = (h && !h.querySelector('table') ? h.textContent : '').replace(/\s+/g, ' ').trim(), c = flat(t); [...c.tBodies].forEach(b => [...b.rows].forEach(r => { if (r.classList.contains('fd-tot')) return; const td = document.createElement('td'); td.textContent = g; r.insertBefore(td, r.cells[0]); body.appendChild(r); })); }); }
  const terms = fdTerms(); if (terms.length) [...out.tBodies[0].rows].forEach(r => { if (!r.classList.contains('fd-tot') && r.cells.length > 1 && !terms.every(t => fdRowText(r).includes(t))) r.remove(); });
  return out;
}
function fdTabData() {
  const out = fdTabClone(false), nm = (FD_TABS.find(t => t[0] === fd.tab) || [0, ''])[1].replace(/^\S+\s/, ''); if (!out) return { title: 'F&D Plan · ' + nm, sheet: 'F&D ' + nm, note: '', headers: [], rows: [] };
  const val = c => { const t = c.textContent.replace(/\s+/g, ' ').trim(); return t !== '' && /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d{1,9}(\.\d+)?$/.test(t) && !/^-?0\d/.test(t) ? Number(t.replace(/,/g, '')) : t; };
  const headers = [...out.tHead.rows[0].cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()), rows = [], tot = [...out.tBodies[0].rows].find(r => r.classList.contains('fd-tot'));
  [...out.tBodies[0].rows].forEach(r => { if (r.classList.contains('fd-tot') || r.cells.length < 2) return; rows.push([...r.cells].map(val)); });
  const ai = headers.indexOf('Actions'); if (ai >= 0) { headers.splice(ai, 1); rows.forEach(r => r.splice(ai, 1)); }
  const parts = []; if (fd.day) parts.push('Day ' + fd.day); if (fd.locs.length) parts.push('Locations ' + fd.locs.join(', ')); if (fd.q) parts.push('Search “' + fd.q + '”'); if (fd.tf) parts.push('Filter “' + fd.tf + '”');
  return { title: `F&D Plan · ${nm} · ${fd.date}`, sheet: ('F&D ' + nm).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31), note: `${rows.length} row(s)` + (parts.length ? ' · ' + parts.join(' · ') : ''), headers, rows, totals: tot ? [...tot.cells].map(val).concat(Array(Math.max(0, headers.length - [...tot.cells].reduce((a, c) => a + (c.colSpan || 1), 0))).fill('')) : undefined };
}
function fdChips() {
  const el = document.querySelector('#fdChips'); if (!el) return; const ch = []; if (fd.day) ch.push(['day', 'Day: ' + dpDayLong(fd.day)]); fd.locs.forEach(l => ch.push(['loc:' + l, 'Location: ' + l])); if (fd.q) ch.push(['q', 'Search: ' + fd.q]); if (fd.tf) ch.push(['tf', 'Filter: ' + fd.tf]);
  el.innerHTML = ch.length ? '<span class="text-sm" style="color:var(--gray-600)">Showing only:</span>' + ch.map(c => `<span class="fd-chip">${plEsc(c[1])}<button type="button" data-chip="${plEsc(c[0])}" title="Remove this filter">✕</button></span>`).join('') + '<button type="button" class="secondary small" data-chip="all">✖ Clear all filters — show everything</button>' : '';
}
function fdChipClick(k) {
  if (k === 'all') { fd.day = ''; fd.locs = []; fd.q = ''; fd.tf = ''; } else if (k === 'day') fd.day = ''; else if (k === 'q') fd.q = ''; else if (k === 'tf') fd.tf = ''; else if (k.startsWith('loc:')) fd.locs = fd.locs.filter(l => l !== k.slice(4));
  const sv = document.querySelector('#fdSearch'), tf = document.querySelector('#fdTabFilter'); if (sv) sv.value = fd.q; if (tf) tf.value = fd.tf; fdPopulate(); fdRender();
}
