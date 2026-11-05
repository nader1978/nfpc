/* ============================================================
   RACK HITS & DAMAGES — Store_Inspections_RowDtls_tbl (rack inspections from the mobile app)
   · matrix per Location: racks in the columns, inspection dates in the rows · hit log · summary by rack
   · the same selection is shown on the 3D Warehouse View (🛡 Hits overlay)
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = escapeHtml, LIST = 'Store_Inspections_RowDtls_tbl';
  const nz = x => String(x || '').toLowerCase().replace(/_x0020_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dmy = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return d + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y; };
  const dShift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const S = { rows: [], loaded: false, loading: false, err: '', tab: 'mx', f: { loc: '', from: ymd(dShift(new Date(), -30)), to: ymd(new Date()), shift: '', q: '', onlyHit: false, allRacks: true } };

  /* ---------- shared with the 3D view ---------- */
  const W3H = window.W3Hits = { on: false, map: new Map(),
    col: h => h.n >= 3 ? [185, 28, 28] : h.n === 2 ? [234, 88, 12] : h.n === 1 ? [245, 158, 11] : [250, 214, 80],
    tip: m => { let h = null; [m.code, m.rack, String(m.code || '').replace(/-P\d+$/i, ''), ...(m.lanes || []).map(l => l.code)].forEach(c => { const v = W3H.map.get(String(c || '').toUpperCase()); if (v && (!h || v.n > h.n)) h = v; }); if (!h) return '';
      return `<div style="background:#fee2e2;color:#991b1b;border-radius:6px;padding:4px 6px;margin-bottom:4px"><b>🛡 ${esc(h.code)}</b> · ${h.n} new hit(s) ${esc(dmy(S.f.from))} – ${esc(dmy(S.f.to))}${h.total ? ' · ' + h.total + ' recorded on the rack' : ''}${h.last ? '<br>last hit ' + esc(dmy(h.last)) : ''}${h.types.size ? '<br>' + esc([...h.types].join(', ')) : ''}</div>`; } };

  /* ---------- read ---------- */
  function parse(it) {
    const f = it.fields || {}, K = {}; Object.keys(f).forEach(k => { K[nz(k)] = f[k]; });
    const g = (...ks) => { for (const k of ks) if (K[k] != null && K[k] !== '') return K[k]; return ''; };
    const rack = String(g('rackcode', 'title')).trim(); if (!rack) return null;
    const purp = String(g('inspectionpurpose')).trim(), rem = String(g('remarks')).trim(); if (!/rack\s*insp/i.test(purp) && !/^(hit|ok)/i.test(rem)) return null;
    const dv = g('transdate'); let date = ''; if (dv) { const d = new Date(dv); if (!isNaN(d)) date = ymd(d); } if (!date && it.createdDateTime) date = ymd(new Date(it.createdDateTime));
    const hit = /^hit/i.test(rem), parts = rem.replace(/^hit\s*[·:-]?\s*/i, '').split('|').map(x => x.trim()), act = (parts.find(x => /^action\s*:/i.test(x)) || '').replace(/^action\s*:\s*/i, ''), same = (rem.match(/same\s+(\d+)/i) || [])[1];
    return { id: it.id, rack, rk: rack.toUpperCase(), loc: String(g('locationdesc')).trim(), whs: String(g('whsdesc')).trim(), area: String(g('areadesc')).trim(), date, purp, shift: purp.replace(/^rack\s*inspection\s*[-–]\s*/i, '').trim() || purp, rem, hit,
      types: hit ? (parts[0] || '').split(',').map(x => x.trim()).filter(Boolean) : [], act, note: hit ? parts.filter((x, i) => i > 0 && !/^action\s*:/i.test(x)).join(' | ') : '', same: same ? +same : 0, ok: /^ok/i.test(rem), by: String(g('username')).trim(), ts: String(g('trnstimestamp')).trim() };
  }
  async function load(force) {
    if (S.loading || (S.loaded && !force)) return; S.loading = true; S.err = ''; say('Reading ' + LIST + '…');
    try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first (no token / Site URL)');
      try { await srkLoad(force); } catch (e) {}
      const ids = await resolveIds(site, LIST, token), items = await fetchAllItems(ids.siteId, ids.listId, token, n => say('Reading ' + LIST + '… ' + n));
      const scoped = typeof locScoped === 'function' && locScoped(), mine = scoped || (SRK.ok && SRK.map.size) ? SRK.map : null; S.rows = items.map(parse).filter(r => r && (!mine || mine.has(r.rk) || (!!SRK.mineStores && SRK.mineStores.has(r.loc.toUpperCase()))));
      S.rows.forEach(r => { const k = srkFind(r.rack); if (k) { if (!r.loc) r.loc = k.loc; if (!r.whs) r.whs = k.whs; if (!r.area) r.area = k.area; } });
      S.loaded = true; if (!S.f.loc) { const L = locs(); S.f.loc = L[0] || ''; } say('✔ ' + S.rows.length + ' rack inspection line(s) read · ' + new Date().toLocaleTimeString());
    } catch (e) { S.err = e.message; say('⚠ ' + e.message, 1); } finally { S.loading = false; } upd3d(); render();
  }
  const say = (t, w) => { const e = Q('#rkcStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };
  const locInfo = loc => { const a = new Map(), w = new Map(), add = (m, v) => { v = String(v || '').trim(); if (v) m.set(v, (m.get(v) || 0) + 1); }; SRK.rows.forEach(r => { if (r.loc === loc) { add(a, r.area); add(w, r.whs); } }); S.rows.forEach(r => { if (r.loc === loc) { add(a, r.area); add(w, r.whs); } }); const top = m => [...m.entries()].sort((x, y) => y[1] - x[1]).map(x => x[0]); return { area: top(a), whs: top(w) }; };
  const locName = loc => { const i = locInfo(loc); return [loc, i.area[0], i.whs[0]].filter(Boolean).join(' · '); };
  const whsList = () => [...new Set(S.rows.map(r => r.whs).concat(SRK.rows.map(r => r.whs)).map(x => String(x || '').trim()).filter(Boolean))].sort();
  const locs = () => [...new Set(S.rows.map(r => r.loc).concat(SRK.rows.map(r => r.loc)).filter(Boolean))].filter(l => !S.f.whs || locInfo(l).whs.includes(S.f.whs)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sel = (loc) => S.rows.filter(r => r.date >= S.f.from && r.date <= S.f.to && (!S.f.shift || r.shift === S.f.shift) && (loc === undefined || !loc ? (!S.f.whs || r.whs === S.f.whs || locInfo(r.loc).whs.includes(S.f.whs)) : r.loc === loc) && (!S.f.q || r.rk.includes(S.f.q.toUpperCase())));
  const dmgOf = code => { const r = srkFind(code); const n = r ? Math.round(+r.dmg || 0) : 0; return isFinite(n) ? n : 0; };

  /* ---------- 3D overlay data ---------- */
  function upd3d() {
    const m = new Map(); sel('').forEach(r => {   /* all stores: the 3D draws only the store it shows */ let h = m.get(r.rk); if (!h) m.set(r.rk, h = { code: r.rack, n: 0, total: dmgOf(r.rack), last: '', types: new Set() }); if (r.hit) { h.n++; if (r.date > h.last) h.last = r.date; r.types.forEach(t => h.types.add(t)); } });
    SRK.rows.forEach(r => { const n = Math.round(+r.dmg || 0); if (n > 0 && !m.has(r.code.toUpperCase())) m.set(r.code.toUpperCase(), { code: r.code, n: 0, total: n, last: '', types: new Set() }); });
    [...m.keys()].forEach(k => { const h = m.get(k); if (!h.n && !h.total) m.delete(k); }); W3H.map = m; try { if (W3H.on && window.w3Api) w3Api.redraw(); } catch (e) {} hitBtn();
  }

  /* ---------- views ---------- */
  function kpis(R) {
    const hits = R.filter(r => r.hit), racks = new Set(R.map(r => r.rk)), hr = new Set(hits.map(r => r.rk)), days = new Set(R.map(r => r.date)), by = new Map(); hits.forEach(r => by.set(r.rack, (by.get(r.rack) || 0) + 1));
    const worst = [...by.entries()].sort((a, b) => b[1] - a[1])[0], K = (t, v, s) => `<div class="rkc-k"><span>${t}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
    return `<div class="rkc-kpis">${K('Inspection days', days.size)}${K('Racks inspected', racks.size)}${K('New hits', hits.length, hits.length ? 'in ' + hr.size + ' rack(s)' : 'no damage reported')}${K('Racks with damage on record', SRK.rows.filter(r => (!S.f.loc || r.loc === S.f.loc) && +r.dmg > 0).length, 'Store_Racks_Setup_tbl')}${K('Most hit rack', worst ? esc(worst[0]) : '—', worst ? worst[1] + ' hit(s)' : '')}</div>`;
  }
  function cellOf(L) { if (!L.length) return { h: '', c: '' }; const hits = L.filter(r => r.hit), same = Math.max(0, ...L.map(r => r.same)), tt = L.map(r => `${r.shift} · ${r.hit ? 'HIT: ' + r.types.join(', ') + (r.act ? ' → ' + r.act : '') + (r.note ? ' (' + r.note + ')' : '') : r.rem} · ${r.by}`).join('\n');
    if (hits.length) return { h: `<span title="${esc(tt)}">🔴 ${hits.length}</span>`, c: hits.length >= 2 ? 'h2' : 'h1' }; if (same) return { h: `<span title="${esc(tt)}">= ${same}</span>`, c: 'sm' }; return { h: `<span title="${esc(tt)}">✓</span>`, c: 'ok' }; }
  function matrix() {
    const R = sel(S.f.loc); if (!S.f.loc) return '<div class="rkc-hint">Choose a Location above to see its racks × dates.</div>';
    let racks = S.f.allRacks ? SRK.rows.filter(r => r.loc === S.f.loc).map(r => r.code) : []; R.forEach(r => { if (!racks.some(x => x.toUpperCase() === r.rk)) racks.push(r.rack); });
    if (S.f.q) racks = racks.filter(c => c.toUpperCase().includes(S.f.q.toUpperCase())); if (S.f.onlyHit) { const hs = new Set(R.filter(r => r.hit).map(r => r.rk)); racks = racks.filter(c => hs.has(c.toUpperCase()) || dmgOf(c) > 0); }
    racks.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); if (!racks.length) return '<div class="rkc-hint">No racks for this selection.</div>';
    const dates = [...new Set(R.map(r => r.date))].sort().reverse(), by = new Map(); R.forEach(r => { const k = r.date + '|' + r.rk; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    const tot = c => R.filter(r => r.rk === c.toUpperCase() && r.hit).length;
    return `<div class="rkc-hint">🔴 n = new hits reported that day · = n = inspected, same n existing hits confirmed · ✓ = inspected OK · empty = not inspected. Hover a cell for the details.</div>
      <div class="rkc-wrap"><table class="rkc-t rkc-mx"><thead><tr><th class="st">Date \\ Rack</th>${racks.map(c => `<th title="${esc(srkDesc(c))}">${esc(c)}</th>`).join('')}<th>Hits</th></tr></thead><tbody>
      ${dates.map(d => { let n = 0; const tds = racks.map(c => { const L = by.get(d + '|' + c.toUpperCase()) || []; n += L.filter(r => r.hit).length; const x = cellOf(L); return `<td class="${x.c}">${x.h}</td>`; }).join(''); return `<tr><td class="st"><b>${esc(dmy(d))}</b></td>${tds}<td class="c"><b>${n || ''}</b></td></tr>`; }).join('') || `<tr><td colspan="${racks.length + 2}" class="rkc-hint">No inspections in this period.</td></tr>`}
      </tbody><tfoot><tr><td class="st">New hits in period</td>${racks.map(c => { const n = tot(c); return `<td class="${n ? (n >= 2 ? 'h2' : 'h1') : ''}"><b>${n || ''}</b></td>`; }).join('')}<td class="c"><b>${R.filter(r => r.hit).length}</b></td></tr>
      <tr><td class="st">Hits on record (rack setup)</td>${racks.map(c => { const n = dmgOf(c); return `<td class="${n >= 3 ? 'h2' : n ? 'h1' : ''}">${n || ''}</td>`; }).join('')}<td></td></tr>
      <tr><td class="st">Condition</td>${racks.map(c => { const n = Math.max(dmgOf(c), tot(c)); return `<td>${n >= 3 ? '<span class="rkc-p r">Critical</span>' : n ? '<span class="rkc-p o">Watch</span>' : '<span class="rkc-p g">Good</span>'}</td>`; }).join('')}<td></td></tr></tfoot></table></div>`;
  }
  function matrixT() {   // racks in the rows, dates in the columns
    const R = sel(S.f.loc); if (!S.f.loc) return '<div class="rkc-hint">Choose a Location above to see its racks × dates.</div>';
    let racks = S.f.allRacks ? SRK.rows.filter(r => r.loc === S.f.loc).map(r => r.code) : []; R.forEach(r => { if (!racks.some(x => x.toUpperCase() === r.rk)) racks.push(r.rack); });
    if (S.f.q) racks = racks.filter(c => c.toUpperCase().includes(S.f.q.toUpperCase())); if (S.f.onlyHit) { const hs = new Set(R.filter(r => r.hit).map(r => r.rk)); racks = racks.filter(c => hs.has(c.toUpperCase()) || dmgOf(c) > 0); }
    racks.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); if (!racks.length) return '<div class="rkc-hint">No racks for this selection.</div>';
    const dates = [...new Set(R.map(r => r.date))].sort().reverse(), by = new Map(); R.forEach(r => { const k = r.date + '|' + r.rk; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    const sd = d => { const [y, m, dd] = d.split('-'); return dd + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]; };
    const dayHits = d => R.filter(r => r.date === d && r.hit).length;
    return `<div class="rkc-hint">🔴 n = new hits reported that day · = n = inspected, same n existing hits confirmed · ✓ = inspected OK · empty = not inspected. Hover a cell for the details.</div>
      <div class="rkc-wrap"><table class="rkc-t rkc-mx"><thead><tr><th class="st">Rack \\ Date</th><th>New hits</th><th>On record</th><th>Condition</th>${dates.map(d => `<th title="${esc(dmy(d))}">${esc(sd(d))}</th>`).join('')}</tr></thead><tbody>
      ${racks.map(c => { const K = c.toUpperCase(), n = R.filter(r => r.rk === K && r.hit).length, rec = dmgOf(c), w = Math.max(n, rec);
        return `<tr><td class="st" title="${esc(srkDesc(c))}"><b>${esc(c)}</b></td><td class="${n ? (n >= 2 ? 'h2' : 'h1') : ''}"><b>${n || ''}</b></td><td class="${rec >= 3 ? 'h2' : rec ? 'h1' : ''}">${rec || ''}</td><td>${w >= 3 ? '<span class="rkc-p r">Critical</span>' : w ? '<span class="rkc-p o">Watch</span>' : '<span class="rkc-p g">Good</span>'}</td>${dates.map(d => { const x = cellOf(by.get(d + '|' + K) || []); return `<td class="${x.c}">${x.h}</td>`; }).join('')}</tr>`; }).join('')}
      </tbody><tfoot><tr><td class="st">New hits that day</td><td class="c"><b>${R.filter(r => r.hit).length}</b></td><td></td><td></td>${dates.map(d => { const n = dayHits(d); return `<td class="${n ? (n >= 2 ? 'h2' : 'h1') : ''}"><b>${n || ''}</b></td>`; }).join('')}</tr></tfoot></table></div>`;
  }
  function log() {
    const R = sel(S.f.loc).filter(r => !S.f.onlyHit || r.hit).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    return `<div class="rkc-wrap"><table class="rkc-t"><thead><tr><th>Date</th><th>Shift</th><th>Warehouse</th><th>Location</th><th>Area</th><th>Rack</th><th>Result</th><th>Damage</th><th>Action</th><th>Remarks</th><th>By</th></tr></thead><tbody>${R.map(r => `<tr${r.hit ? ' class="hr"' : ''}><td>${esc(dmy(r.date))}</td><td>${esc(r.shift)}</td><td>${esc(r.whs)}</td><td>${esc(r.loc)}</td><td>${esc(r.area)}</td><td><b>${esc(r.rack)}</b></td><td>${r.hit ? '<span class="rkc-p r">HIT</span>' : r.same ? '<span class="rkc-p o">Same ' + r.same + '</span>' : '<span class="rkc-p g">OK</span>'}</td><td>${esc(r.types.join(', '))}</td><td>${esc(r.act)}</td><td>${esc(r.hit ? r.note : r.rem)}</td><td>${esc(r.by)}</td></tr>`).join('') || '<tr><td colspan="11" class="rkc-hint">Nothing for this selection.</td></tr>'}</tbody></table></div>`;
  }
  function summary() {
    const R = sel(S.f.loc), m = new Map(); R.forEach(r => { let x = m.get(r.rk); if (!x) m.set(r.rk, x = { rack: r.rack, loc: r.loc, whs: r.whs || (srkFind(r.rack) || {}).whs || '', area: r.area || (srkFind(r.rack) || {}).area || '', ins: 0, hits: 0, last: '', lastIns: '', types: new Map() }); x.ins++; if (r.date > x.lastIns) x.lastIns = r.date; if (r.hit) { x.hits++; if (r.date > x.last) x.last = r.date; r.types.forEach(t => x.types.set(t, (x.types.get(t) || 0) + 1)); } });
    SRK.rows.filter(r => (!S.f.loc || r.loc === S.f.loc) && +r.dmg > 0 && !m.has(r.code.toUpperCase())).forEach(r => m.set(r.code.toUpperCase(), { rack: r.code, loc: r.loc, whs: r.whs || '', area: r.area || '', ins: 0, hits: 0, last: '', lastIns: '', types: new Map() }));
    const L = [...m.values()].filter(x => !S.f.onlyHit || x.hits || dmgOf(x.rack)).sort((a, b) => (Math.max(dmgOf(b.rack), b.hits) - Math.max(dmgOf(a.rack), a.hits)) || b.hits - a.hits || a.rack.localeCompare(b.rack, undefined, { numeric: true }));
    return `<div class="rkc-wrap"><table class="rkc-t"><thead><tr><th>Rack</th><th>Warehouse</th><th>Location</th><th>Area</th><th class="c">Inspections</th><th>Last inspected</th><th class="c">New hits</th><th>Last hit</th><th>Damage types</th><th class="c">Hits on record</th><th>Condition</th></tr></thead><tbody>${L.map(x => { const n = Math.max(dmgOf(x.rack), x.hits); return `<tr${x.hits ? ' class="hr"' : ''}><td><b>${esc(x.rack)}</b></td><td>${esc(x.whs)}</td><td>${esc(x.loc)}</td><td>${esc(x.area)}</td><td class="c">${x.ins}</td><td>${esc(dmy(x.lastIns))}</td><td class="c"><b>${x.hits || ''}</b></td><td>${esc(dmy(x.last))}</td><td>${esc([...x.types].map(([t, k]) => t + (k > 1 ? ' ×' + k : '')).join(', '))}</td><td class="c">${dmgOf(x.rack) || ''}</td><td>${n >= 3 ? '<span class="rkc-p r">Critical</span>' : n ? '<span class="rkc-p o">Watch</span>' : '<span class="rkc-p g">Good</span>'}</td></tr>`; }).join('') || '<tr><td colspan="11" class="rkc-hint">Nothing for this selection.</td></tr>'}</tbody></table></div>`;
  }
  function render() {
    const v = Q('#rkcBody'); if (!v) return; const L = locs(), shifts = [...new Set(S.rows.map(r => r.shift).filter(Boolean))].sort();
    const U = rpUI;
    v.innerHTML = `<div class="rp-f">${U.fi('Warehouse', `<select data-f="whs"><option value="">All warehouses</option>${whsList().map(w => `<option${w === S.f.whs ? ' selected' : ''}>${esc(w)}</option>`).join('')}</select>`)}${U.fi('Location', `<select data-f="loc" style="max-width:340px"><option value="">All locations</option>${L.map(l => `<option value="${esc(l)}"${l === S.f.loc ? ' selected' : ''}>${esc(locName(l))}</option>`).join('')}</select>`)}
      ${U.fi('From', `<input type="date" data-f="from" value="${S.f.from}">`)}${U.fi('To', `<input type="date" data-f="to" value="${S.f.to}">`)}${U.fi('Shift', `<select data-f="shift"><option value="">All shifts</option>${shifts.map(x => `<option${x === S.f.shift ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>`)}${U.fi('Rack', `<input type="search" data-f="q" value="${esc(S.f.q)}" placeholder="Rack code…" style="min-width:140px">`)}
      <label class="rp-ck"><input type="checkbox" data-f="onlyHit"${S.f.onlyHit ? ' checked' : ''}> damaged racks only</label>${S.tab === 'mx' || S.tab === 'mxT' ? `<label class="rp-ck"><input type="checkbox" data-f="allRacks"${S.f.allRacks ? ' checked' : ''}> all racks of the location</label>` : ''}
      <span class="rp-sp"></span>${U.grp('<button class="secondary small" type="button" data-rk="per" data-d="7">7 days</button><button class="secondary small" type="button" data-rk="per" data-d="30">30 days</button><button class="secondary small" type="button" data-rk="per" data-d="90">90 days</button>')}<button class="success small" type="button" data-rk="3d" title="Show the hits on the 3D Warehouse View" style="margin-bottom:2px">🧊 Show in 3D</button></div>
      ${S.f.loc ? (i => `<div class="rkc-loc">📍 <b>${esc(S.f.loc)}</b>${i.area.length ? ` <span>Location: <b>${esc(i.area.join(' / '))}</b></span>` : ''}${i.whs.length ? ` <span>🏭 Warehouse: <b>${esc(i.whs.join(' / '))}</b></span>` : ''}</div>`)(locInfo(S.f.loc)) : S.f.whs ? `<div class="rkc-loc">🏭 Warehouse: <b>${esc(S.f.whs)}</b> · ${L.length} location(s)</div>` : ''}
      ${S.loaded ? kpis(sel(S.f.loc)) : ''}
      ${U.tabbar([['mx', '📊 Dates × racks'], ['mxT', '📊 Racks × dates'], ['sum', '📋 Summary by rack'], ['log', '🧾 Inspection log']].map(([k, t]) => `<button type="button" class="${S.tab === k ? 'active on' : ''}" data-t="${k}">${t}</button>`).join(''), 'data-rk', '#rkcBody')}
      ${S.loading && !S.loaded ? '<div class="rkc-hint">Reading…</div>' : !S.loaded ? `<div class="rkc-hint">${S.err ? '⚠ ' + esc(S.err) : 'Press 🔄 Reload to read the inspections.'}</div>` : S.tab === 'mx' ? matrix() : S.tab === 'mxT' ? matrixT() : S.tab === 'sum' ? summary() : log()}`;
  }
  function rep() { const T = { mx: 'Rack hits — dates × racks', mxT: 'Rack hits — racks × dates', sum: 'Rack condition — summary by rack', log: 'Rack inspection log' }[S.tab] || 'Rack hits', i = S.f.loc ? locInfo(S.f.loc) : null;
    const note = [S.f.loc ? 'Location ' + S.f.loc + (i && i.area.length ? ' (' + i.area.join(' / ') + ')' : '') : 'All locations', (i && i.whs.length ? 'Warehouse ' + i.whs.join(' / ') : S.f.whs ? 'Warehouse ' + S.f.whs : ''), dmy(S.f.from) + ' – ' + dmy(S.f.to), S.f.shift && 'Shift ' + S.f.shift, S.f.onlyHit && 'damaged racks only', 'Printed ' + new Date().toLocaleString()].filter(Boolean).join(' · ');
    return tblReport(Q('#rkcBody table.rkc-t'), T, note, T.replace(/^Rack /, '')); }
  function hitBtn() {
    const bar = Q('#w3Body .w3bar'); if (!bar) return; let b = Q('#w3HitBtn'); if (!b) { b = document.createElement('button'); b.id = 'w3HitBtn'; b.type = 'button'; b.className = 'secondary small'; b.title = 'Show the rack hits & damages (Store_Inspections_RowDtls_tbl) on the 3D — same selection as the Rack Hits & Damages screen'; bar.appendChild(b); }
    const t = W3H.on ? `🛡 Hits: ON (${[...W3H.map.values()].filter(h => h.n).length} rack(s) hit · ${esc(dmy(S.f.from))}–${esc(dmy(S.f.to))})` : '🛡 Rack hits'; if (b.innerHTML !== t) b.innerHTML = t; b.classList.toggle('on', W3H.on);
    let lg = Q('#w3HitLeg'); if (W3H.on && !lg) { lg = document.createElement('span'); lg.id = 'w3HitLeg'; lg.style.cssText = 'font-size:12px;display:flex;gap:8px;align-items:center'; lg.innerHTML = [['#f59e0b', '1 new hit'], ['#ea580c', '2'], ['#b91c1c', '3+'], ['#fad650', 'hit on record only']].map(([c, t]) => `<span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${c};vertical-align:-2px;margin-right:3px"></i>${t}</span>`).join(''); bar.appendChild(lg); } else if (!W3H.on && lg) lg.remove();
  }
  document.addEventListener('click', async e => { const b = e.target.closest && e.target.closest('#w3HitBtn'); if (!b) return; W3H.on = !W3H.on; if (W3H.on && !S.loaded) { b.textContent = '🛡 reading inspections…'; await load(false); } upd3d(); try { w3Api.redraw(); } catch (x) {} hitBtn(); });
  setInterval(hitBtn, 1500);

  function init() {
    const v = Q('#view-rkc'); if (!v || v._i) return; v._i = 1;
    v.addEventListener('click', e => { const t = e.target.closest('[data-t],[data-rk]'); if (!t) return; if (t.dataset.t) { S.tab = t.dataset.t; return render(); } const a = t.dataset.rk;
      if (a === 'expand') { const tb = Q('#rkcBody table.rkc-t'); if (tb && window.tableExpandOpen) tableExpandOpen(tb); return; } if (a === 'print' || a === 'excel' || a === 'mail') { const d = rep(); if (a === 'print') a2Print(d); else if (a === 'excel') a2Export(d); else a2Mail(rep); return; }
      if (a === 'reload') load(true); else if (a === 'per') { S.f.to = ymd(new Date()); S.f.from = ymd(dShift(new Date(), -+t.dataset.d)); upd3d(); render(); }
      else if (a === '3d') { W3H.on = true; upd3d(); const n = Q('.nav-item[data-view="wh3d"]'); if (n) n.click(); setTimeout(() => { try { w3Api.redraw(); } catch (x) {} hitBtn(); }, 900); } });
    v.addEventListener('change', e => { const el = e.target, k = el.dataset.f; if (!k) return; S.f[k] = el.type === 'checkbox' ? el.checked : el.value; if (k === 'whs') S.f.loc = locs()[0] || ''; upd3d(); render(); });
    v.addEventListener('input', e => { const el = e.target; if (el.dataset.f === 'q') { S.f.q = el.value.trim(); clearTimeout(S.tm); S.tm = setTimeout(() => { render(); const i = Q('#rkcBody [data-f=q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 350); } });
    const css = document.createElement('style'); css.textContent = `#view-rkc .rkc-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}#view-rkc .rkc-bar select,#view-rkc .rkc-bar input{width:auto;margin:0}#view-rkc .rkc-ck{display:flex;gap:5px;align-items:center;font-size:13px}#view-rkc .rkc-ck input{width:auto}
#view-rkc .rkc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}#view-rkc .rkc-k{border:1px solid var(--border);border-radius:12px;padding:8px 14px}#view-rkc .rkc-k span{font-size:12px;color:var(--gray-600);display:block}#view-rkc .rkc-k b{font-size:20px}#view-rkc .rkc-k small{display:block;font-size:11px;color:var(--gray-600)}
#view-rkc .rkc-wrap{overflow:auto;max-height:70vh;border:1px solid var(--border);border-radius:12px}#view-rkc table.rkc-t{border-collapse:collapse;font-size:12px;width:100%}#view-rkc .rkc-t th{background:var(--brand-light,#eef2fb);padding:7px 6px;text-align:left;white-space:nowrap;position:sticky;top:0;z-index:2}#view-rkc .rkc-t td{padding:4px 6px;border-top:1px solid var(--border);white-space:nowrap}#view-rkc .rkc-t .c{text-align:center}
#view-rkc .rkc-mx td{text-align:center;min-width:54px}#view-rkc .rkc-mx th{text-align:center}#view-rkc .rkc-mx .st{position:sticky;left:0;background:var(--card,#fff);text-align:left;z-index:1;min-width:150px}#view-rkc .rkc-mx thead .st{z-index:3;background:var(--brand-light,#eef2fb)}#view-rkc .rkc-mx tfoot td{border-top:2px solid var(--border);background:var(--gray-50,#f8fafc)}
#view-rkc .rkc-mx td.ok{color:#15803d}#view-rkc .rkc-mx td.sm{background:#fef9c3;color:#854d0e;font-weight:600}#view-rkc .rkc-mx td.h1{background:#fed7aa;color:#9a3412;font-weight:700}#view-rkc .rkc-mx td.h2{background:#fecaca;color:#991b1b;font-weight:700}#view-rkc tr.hr td{background:rgba(254,226,226,.45)}
#view-rkc .rkc-p{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;font-weight:700}#view-rkc .rkc-p.g{background:#dcfce7;color:#166534}#view-rkc .rkc-p.o{background:#fef3c7;color:#92400e}#view-rkc .rkc-p.r{background:#fee2e2;color:#991b1b}#view-rkc .tbl-expand-bar,#view-rkc .hc-bar,#view-rkc .ct-bar,#view-rkc .tbl-expand-inline{display:none!important}#view-rkc .rkc-loc{display:flex;gap:18px;flex-wrap:wrap;align-items:center;background:var(--brand-light,#eef2fb);border-radius:10px;padding:8px 12px;margin:8px 0;font-size:14px}#view-rkc .rkc-loc span{font-size:13px}#view-rkc .rkc-hint{font-size:12px;color:var(--gray-600);padding:6px 2px}
body.dark #view-rkc .rkc-mx .st{background:var(--card)}body.dark #view-rkc .rkc-mx td.h1,body.dark #view-rkc .rkc-mx td.h2{color:#111}`; document.head.appendChild(css);
    render();
  }
  const nav = Q('.nav-item[data-view="rkc"]'); if (nav) nav.addEventListener('click', () => { init(); setTimeout(() => load(false), 50); });
  const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (activeViewId() === 'rkc') { e.stopImmediatePropagation(); load(true); } }, true);
  window.RKC = { S, load, render, upd3d };
})();
