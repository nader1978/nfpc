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

/* ============================================================
   FORKLIFT RECEIVING — FLOprt_CheckList_tbl (every "Receive Unit" / "Park Unit" entered in the mobile app)
   · unit summary with the condition reported by the users · what changed against the previous inspection of the same unit
   · units × dates matrix · full receiving log (19-point checklist, status toggles, scratches, ODO)
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = escapeHtml, LIST = 'FLOprt_CheckList_tbl';
  const nz = x => String(x || '').toLowerCase().replace(/_x[0-9a-f]{4}_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dmy = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return d + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y; };
  const dShift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const S = { rows: [], mst: [], day: ymd(new Date()), miss: 'any', loaded: false, loading: false, err: '', tab: 'sum', f: { from: ymd(dShift(new Date(), -30)), to: ymd(new Date()), type: '', unit: '', whs: '', q: '', onlyIssue: false } };
  /* the eight Yes/No switches of the "Receive Unit" screen — Yes = in good condition */
  const TG = [['oil', 'Engine oil', 'engoillevel'], ['wat', 'Engine water', 'engwaterlevel'], ['brk', 'Brakes', 'breakstatus'], ['tir', 'Tires', 'tiresstatus'], ['cln', 'Cleaning', 'cleaningstatus'], ['wrk', 'Working', 'workingstatus'], ['hyd', 'Hydraulic', 'hydraulicstatus'], ['hse', 'HSE records', 'hserecordsupdate']];
  const SC = [['f', 'Front', /front/], ['r', 'Rear', /(rare|rear)/], ['l', 'Left', /left/], ['t', 'Right', /right/]];
  const bo = v => { if (v && typeof v === 'object') v = v.Value; if (v === true || v === false) return v; const s = String(v == null ? '' : v).trim().toLowerCase(); if (!s) return null; if (/^(true|yes|ok|good|1|y|✓)/.test(s)) return true; if (/^(false|no|not|bad|0|n|✗)/.test(s)) return false; return null; };
  const say = (t, w) => { const e = Q('#flrStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };

  function parse(it) {
    const f = it.fields || {}, K = {}; Object.keys(f).forEach(k => { K[nz(k)] = f[k]; });
    const g = (...ks) => { for (const k of ks) if (K[k] != null && K[k] !== '') return K[k]; return ''; };
    const unit = String(g('flcode', 'title')).trim(); if (!unit) return null;
    let rt = g('recordtype'); if (rt && typeof rt === 'object') rt = rt.Value; rt = String(rt || '').trim();
    const dv = g('transdate'); let date = ''; if (dv) { const d = new Date(dv); if (!isNaN(d)) date = ymd(d); } if (!date && it.createdDateTime) date = ymd(new Date(it.createdDateTime));
    const tsv = g('timestamp'), ts = tsv ? new Date(tsv).getTime() || 0 : new Date(it.createdDateTime || 0).getTime() || 0;
    const rem = String(g('remarks')).trim(), cm = rem.match(/\[Checklist\s+(\d+)\s*\/\s*(\d+)\s*OK([^\]]*)\]?/i);
    const nokM = cm && cm[3].match(/NOT OK:\s*([^|\]]*)/i), naM = cm && cm[3].match(/N\/A:\s*#?([\d,\s]+)/i);
    const nok = nokM ? nokM[1].split(';').map(x => x.trim()).filter(Boolean) : [];
    const r = { id: +it.id || 0, unit, uk: unit.toUpperCase(), type: rt, rcv: /receive/i.test(rt), date, ts, odo: num(g('odoreading')), prv: num(g('prvsodo')), km: num(g('totalkms')), by: String(g('username')).trim(), appr: String(g('approvallnmngr')).trim(),
      ok: cm ? +cm[1] : null, tot: cm ? +cm[2] : null, nok, na: naM ? naM[1].split(',').map(x => x.trim()).filter(Boolean).length : 0, note: String(cm ? rem.slice(0, cm.index) : rem).trim(), rem, tg: {}, sc: { f: 0, r: 0, l: 0, t: 0 } };
    TG.forEach(([k, , fk]) => { r.tg[k] = bo(g(fk)); });
    Object.keys(K).forEach(k => { if (!/scratch/.test(k)) return; SC.forEach(([c, , re]) => { if (re.test(k)) r.sc[c] = Math.max(r.sc[c], num(K[k])); }); });
    r.scN = r.sc.f + r.sc.r + r.sc.l + r.sc.t;
    /* issues reported by the user on this entry (key → text) */
    r.iss = new Map(); TG.forEach(([k, t]) => { if (r.tg[k] === false) r.iss.set('t_' + k, t + ' not OK'); }); r.nok.forEach(t => r.iss.set('c_' + t.toLowerCase().replace(/[^a-z0-9]/g, ''), t));
    r.n = r.iss.size + (r.scN ? 1 : 0); r.crit = r.tg.brk === false || r.tg.hyd === false || r.n >= 4; r.cond = r.n === 0 ? 'Good' : r.crit ? 'Critical' : 'Watch';
    return r;
  }
  async function load(force) {
    if (S.loading || (S.loaded && !force)) return; S.loading = true; S.err = ''; say('Reading ' + LIST + '…');
    try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first (no token / Site URL)');
      const ids = await resolveIds(site, LIST, token), items = await fetchAllItems(ids.siteId, ids.listId, token, n => say('Reading ' + LIST + '… ' + n));
      try { const u = await resolveIds(site, 'Forklift_Units_tbl', token), ui = await fetchAllItems(u.siteId, u.listId, token); S.mst = ui.map(it => { const f = it.fields || {}, K = {}; Object.keys(f).forEach(k => { K[nz(k)] = f[k]; }); const code = String(K.devicecode || K.title || '').trim(); return code ? { code, uk: code.toUpperCase(), desc: [K.devicebrand, K.devicemodel, K.energytype].filter(Boolean).join(' '), whs: String(K.devicewhs || '').trim() } : null; }).filter(Boolean); } catch (e) { S.mst = []; }
      S.rows = items.map(parse).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts || a.id - b.id);
      const by = new Map(); S.rows.forEach(r => { r.prev = by.get(r.uk) || null; by.set(r.uk, r); r.d = diff(r); });
      S.loaded = true; say('✔ ' + S.rows.length + ' receiving record(s) read · ' + new Date().toLocaleTimeString());
    } catch (e) { S.err = e.message; say('⚠ ' + e.message, 1); } finally { S.loading = false; } render();
  }
  /* what changed against the previous record of the same unit */
  function diff(r) {
    const p = r.prev; if (!p) return { first: true, st: 'First record', news: [], gone: [], scUp: [], scDn: [], odo: [] };
    const news = [], gone = [], scUp = [], scDn = [], odo = [];
    r.iss.forEach((t, k) => { if (!p.iss.has(k)) news.push(t); }); p.iss.forEach((t, k) => { if (!r.iss.has(k)) gone.push(t); });
    SC.forEach(([c, n]) => { if (r.sc[c] > p.sc[c]) scUp.push(n + ' +' + (r.sc[c] - p.sc[c])); else if (r.sc[c] < p.sc[c]) scDn.push(n + ' −' + (p.sc[c] - r.sc[c])); });
    if (r.odo && p.odo && r.odo < p.odo) odo.push('ODO ' + r.odo + ' is lower than the last record (' + p.odo + ')'); else if (r.prv && p.odo && Math.abs(r.prv - p.odo) > 0.5) odo.push('Previous ODO reported ' + r.prv + ' but the last record was ' + p.odo);
    const st = news.length || scUp.length ? 'Worse' : gone.length || scDn.length ? 'Improved' : 'Same';
    return { first: false, st, news, gone, scUp, scDn, odo };
  }
  const whOf = u => { const m = S.mst.find(x => x.uk === u); return m ? m.whs : ''; }, whsList = () => [...new Set(S.mst.map(m => m.whs).filter(Boolean))].sort();
  const sel = () => S.rows.filter(r => r.date >= S.f.from && r.date <= S.f.to && (!S.f.whs || whOf(r.uk) === S.f.whs) && (!S.f.type || (S.f.type === 'R' ? r.rcv : !r.rcv)) && (!S.f.unit || r.uk === S.f.unit) && (!S.f.q || r.uk.includes(S.f.q.toUpperCase()) || r.by.toUpperCase().includes(S.f.q.toUpperCase())) && (!S.f.onlyIssue || r.n > 0 || r.d.st === 'Worse'));
  const units = () => [...new Set(S.rows.map(r => r.uk).concat(S.mst.map(m => m.uk)))].filter(u => !S.f.whs || whOf(u) === S.f.whs).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const pill = c => `<span class="flr-p ${c === 'Good' ? 'g' : c === 'Watch' ? 'o' : 'r'}">${c}</span>`;
  const chg = d => d.first ? '<span class="flr-p n">First record</span>' : d.st === 'Worse' ? '<span class="flr-p r">▲ Worse</span>' : d.st === 'Improved' ? '<span class="flr-p g">▼ Improved</span>' : '<span class="flr-p n">= Same</span>';
  const chgTxt = d => [d.news.length && 'NEW: ' + d.news.join(', '), d.scUp.length && 'Scratches: ' + d.scUp.join(', '), d.gone.length && 'Fixed: ' + d.gone.join(', '), d.scDn.length && 'Scratches fewer: ' + d.scDn.join(', '), ...d.odo.map(x => '⚠ ' + x)].filter(Boolean).join(' · ');
  const issTxt = r => [...r.iss.values()].concat(r.scN ? ['Scratches F' + r.sc.f + ' R' + r.sc.r + ' L' + r.sc.l + ' Rt' + r.sc.t] : []).join(', ');
  const tt = r => `${dmy(r.date)} · ${r.type} · ${r.by}\n${r.n ? issTxt(r) : 'No issues reported'}${r.note ? '\nNote: ' + r.note : ''}`;

  function kpis(R) {
    const K = (t, v, s) => `<div class="flr-k"><span>${t}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`, us = new Set(R.map(r => r.uk));
    const lastOf = new Map(); R.forEach(r => lastOf.set(r.uk, r)); const L = [...lastOf.values()];
    return `<div class="flr-kpis">${K('Records', R.length, R.filter(r => r.rcv).length + ' received · ' + R.filter(r => !r.rcv).length + ' parked')}${K('Units', us.size)}${K('Units worse than before', L.filter(r => r.d.st === 'Worse').length, 'latest record vs the previous one')}${K('Units improved', L.filter(r => r.d.st === 'Improved').length)}${K('Records with issues', R.filter(r => r.n).length, R.filter(r => r.crit).length + ' critical')}${K('Checklist NOT OK', R.filter(r => r.nok.length).length, 'records')}</div>`;
  }
  function summary() {
    const R = sel(), by = new Map(); R.forEach(r => { let x = by.get(r.uk); if (!x) by.set(r.uk, x = { u: r.unit, uk: r.uk, n: 0, iss: 0, last: null }); x.n++; if (r.n) x.iss++; x.last = r; });
    const L = [...by.values()].sort((a, b) => ({ Critical: 0, Watch: 1, Good: 2 }[a.last.cond] - { Critical: 0, Watch: 1, Good: 2 }[b.last.cond]) || (b.last.d.st === 'Worse') - (a.last.d.st === 'Worse') || a.u.localeCompare(b.u, undefined, { numeric: true }));
    if (!L.length) return '<div class="flr-hint">No receiving records for this selection.</div>';
    return `<div class="flr-hint">One line per unit — the <b>latest</b> record in the period, with what changed against the unit's previous inspection (any date). Hover a row for the user's note.</div><div class="flr-wrap"><table class="flr-t"><thead><tr><th>Unit</th><th>Warehouse</th><th>Last record</th><th>Type</th><th>By</th><th class="c">ODO</th><th class="c">KM since previous</th><th>Condition now</th><th>Issues reported now</th><th>Change vs previous</th><th>What changed</th><th class="c">Records</th><th class="c">With issues</th><th>User note</th></tr></thead><tbody>
      ${L.map(x => { const r = x.last; return `<tr title="${esc(tt(r))}" data-rid="${r.id}" style="cursor:pointer"><td><b>${esc(x.u)}</b></td><td>${esc(whOf(x.uk))}</td><td>${esc(dmy(r.date))}</td><td>${esc(r.type)}</td><td>${esc(r.by)}</td><td class="c">${r.odo || ''}</td><td class="c">${r.km || ''}</td><td>${pill(r.cond)}</td><td>${esc(issTxt(r)) || '—'}</td><td>${chg(r.d)}${r.prev ? `<br><small>vs ${esc(dmy(r.prev.date))} · ${esc(r.prev.type)}</small>` : ''}</td><td>${esc(chgTxt(r.d)) || '—'}</td><td class="c">${x.n}</td><td class="c">${x.iss || ''}</td><td>${esc(r.note)}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function changes() {
    const R = sel().filter(r => !r.d.first && (r.d.st !== 'Same' || r.d.odo.length)).sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
    if (!R.length) return '<div class="flr-hint">No changes against the previous inspection in this selection.</div>';
    return `<div class="flr-hint">Every record whose reported condition differs from the previous record of the same unit (a receive is compared with the last park, and the other way round).</div><div class="flr-wrap"><table class="flr-t"><thead><tr><th>Date</th><th>Unit</th><th>Warehouse</th><th>Type</th><th>By</th><th>Compared with</th><th>Change</th><th>New issues</th><th>Scratches</th><th>Fixed</th><th>ODO</th><th>User note</th></tr></thead><tbody>
      ${R.map(r => { const d = r.d; return `<tr class="${d.st === 'Worse' ? 'hr' : ''}" data-rid="${r.id}" style="cursor:pointer"><td>${esc(dmy(r.date))}</td><td><b>${esc(r.unit)}</b></td><td>${esc(whOf(r.uk))}</td><td>${esc(r.type)}</td><td>${esc(r.by)}</td><td>${esc(dmy(r.prev.date))} · ${esc(r.prev.type)}</td><td>${chg(d)}</td><td>${esc(d.news.join(', '))}</td><td>${esc(d.scUp.join(', '))}${d.scDn.length ? ' (' + esc(d.scDn.join(', ')) + ')' : ''}</td><td>${esc(d.gone.join(', '))}</td><td>${esc(d.odo.join(' · '))}</td><td>${esc(r.note)}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function matrix() {
    const R = sel(); if (!R.length) return '<div class="flr-hint">No receiving records for this selection.</div>';
    const us = [...new Set(R.map(r => r.uk))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), ds = [...new Set(R.map(r => r.date))].sort().reverse(), by = new Map(); R.forEach(r => { const k = r.date + '|' + r.uk; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    const cell = L => { if (!L.length) return '<td></td>'; const n = Math.max(...L.map(r => r.n)), w = L.some(r => r.d.st === 'Worse'), t = L.map(tt).join('\n\n'); const rid = ` data-rid="${L.map(r => r.id).join(',')}" style="cursor:pointer"`; return n ? `<td class="${L.some(r => r.crit) ? 'h2' : 'h1'}" title="${esc(t)}"${rid}>🔴 ${n}${w ? '▲' : ''}</td>` : `<td class="${w ? 'h1' : 'ok'}" title="${esc(t)}"${rid}>${w ? '▲' : '✓'}</td>`; };
    return `<div class="flr-hint">✓ = received/parked, no issue reported · 🔴 n = issues reported that day (▲ = worse than the previous inspection) · empty = no record. Hover a cell for the details.</div><div class="flr-wrap"><table class="flr-t flr-mx"><thead><tr><th class="st">Date \\ Unit</th>${us.map(u => `<th>${esc(u)}</th>`).join('')}</tr></thead><tbody>
      ${ds.map(d => `<tr><td class="st"><b>${esc(dmy(d))}</b></td>${us.map(u => cell(by.get(d + '|' + u) || [])).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  const cellF = L => { if (!L.length) return '<td></td>'; const n = Math.max(...L.map(r => r.n)), w = L.some(r => r.d.st === 'Worse'), t = L.map(tt).join('\n\n'); const rid = ` data-rid="${L.map(r => r.id).join(',')}" style="cursor:pointer"`; return n ? `<td class="${L.some(r => r.crit) ? 'h2' : 'h1'}" title="${esc(t)}"${rid}>🔴 ${n}${w ? '▲' : ''}</td>` : `<td class="${w ? 'h1' : 'ok'}" title="${esc(t)}"${rid}>${w ? '▲' : '✓'}</td>`; };
  function matrixT() {
    const R = sel(); if (!R.length && !S.mst.length) return '<div class="flr-hint">No receiving records for this selection.</div>';
    const us = (S.f.onlyIssue ? [...new Set(R.map(r => r.uk))] : units().filter(u => !S.f.unit || u === S.f.unit)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), ds = [...new Set(R.map(r => r.date))].sort().reverse(), by = new Map(); R.forEach(r => { const k = r.date + '|' + r.uk; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    const sd = d => { const [y, m, dd] = d.split('-'); return dd + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]; };
    return `<div class="flr-hint">Units in the rows, dates in the columns. ✓ = received/parked, no issue reported · 🔴 n = issues reported (▲ = worse than the previous inspection) · empty = no record that day. Hover a cell for the details.</div><div class="flr-wrap"><table class="flr-t flr-mx"><thead><tr><th class="st">Unit \\ Date</th><th>Warehouse</th><th>Records</th><th>Issues</th>${ds.map(d => `<th title="${esc(dmy(d))}">${esc(sd(d))}</th>`).join('')}</tr></thead><tbody>
      ${us.map(u => { const mine = R.filter(r => r.uk === u), m = S.mst.find(x => x.uk === u); return `<tr><td class="st" title="${esc(m ? m.desc : '')}"><b>${esc(m ? m.code : u)}</b></td><td>${esc(m ? m.whs : '')}</td><td class="c">${mine.length || ''}</td><td class="c">${mine.filter(r => r.n).length || ''}</td>${ds.map(d => cellF(by.get(d + '|' + u) || [])).join('')}</tr>`; }).join('')}</tbody></table></div>`;
  }
  function missing() {
    const day = S.day || ymd(new Date()), R = S.rows.filter(r => r.date === day), by = new Map(); R.forEach(r => { let x = by.get(r.uk); if (!x) by.set(r.uk, x = { rc: [], pk: [] }); (r.rcv ? x.rc : x.pk).push(r); });
    const all = units().map(u => { const m = S.mst.find(x => x.uk === u), x = by.get(u) || { rc: [], pk: [] }, last = S.rows.filter(r => r.uk === u && r.date < day).pop(); return { u: m ? m.code : u, desc: m ? m.desc : '', whs: m ? m.whs : '', rc: x.rc, pk: x.pk, last, st: !x.rc.length && !x.pk.length ? 'No action' : !x.rc.length ? 'Not received' : !x.pk.length ? 'Not parked' : 'Complete' }; });
    const L = all.filter(x => S.miss === 'all' || (S.miss === 'any' ? x.st !== 'Complete' : S.miss === 'none' ? x.st === 'No action' : S.miss === 'rcv' ? !x.rc.length : !x.pk.length)).sort((a, b) => a.u.localeCompare(b.u, undefined, { numeric: true }));
    const tm = r => r.length ? '✓ ' + r.map(x => x.ts ? new Date(x.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '').filter(Boolean).join(', ') + (r.some(x => x.n) ? ' <span class="flr-p r">issue</span>' : '') : '<b style="color:#b91c1c">✗ none</b>';
    const K = (t, v) => `<div class="flr-k"><span>${t}</span><b>${v}</b></div>`;
    return `<div class="rp-f"><label class="rp-fi"><span>Date</span><input type="date" data-s="day" value="${day}"></label><label class="rp-fi"><span>Show</span><select data-s="miss"><option value="any"${S.miss === 'any' ? ' selected' : ''}>Missing receive or park</option><option value="none"${S.miss === 'none' ? ' selected' : ''}>No action at all</option><option value="rcv"${S.miss === 'rcv' ? ' selected' : ''}>Not received</option><option value="park"${S.miss === 'park' ? ' selected' : ''}>Not parked</option><option value="all"${S.miss === 'all' ? ' selected' : ''}>All units</option></select></label></div>
      <div class="flr-kpis">${K('Units', all.length)}${K('Complete (received + parked)', all.filter(x => x.st === 'Complete').length)}${K('Not received', all.filter(x => !x.rc.length).length)}${K('Not parked', all.filter(x => !x.pk.length).length)}${K('No action at all', all.filter(x => x.st === 'No action').length)}</div>
      ${S.mst.length ? '' : '<div class="flr-hint">⚠ Forklift_Units_tbl could not be read — only units that have records are listed.</div>'}
      <div class="flr-wrap"><table class="flr-t"><thead><tr><th>Unit</th><th>Description</th><th>Warehouse</th><th>Received</th><th>Parked</th><th>Status</th><th>Last record before this date</th></tr></thead><tbody>
      ${L.map(x => `<tr class="${x.st === 'Complete' ? '' : 'hr'}"><td><b>${esc(x.u)}</b></td><td>${esc(x.desc)}</td><td>${esc(x.whs)}</td><td>${tm(x.rc)}</td><td>${tm(x.pk)}</td><td><span class="flr-p ${x.st === 'Complete' ? 'g' : x.st === 'No action' ? 'r' : 'o'}">${x.st}</span></td><td>${x.last ? esc(dmy(x.last.date) + ' · ' + x.last.type + ' · ' + x.last.by) : '—'}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:16px">Nothing missing for this date 🎉</td></tr>'}</tbody></table></div>`;
  }

  /* click a cell / row → the records behind it: the recent record next to the previous inspection of the same unit */
  function card(r, o, ttl) {
    if (!r) return `<div class="flr-cd"><h4>${ttl}</h4><div class="flr-hint">No previous record for this unit.</div></div>`;
    const dif = (a, b) => o && a !== b ? ' class="dd"' : '', ok = v => v === true ? '✓ OK' : v === false ? '<b style="color:#b91c1c">✗ Not OK</b>' : '—';
    return `<div class="flr-cd"><h4>${ttl}</h4><div class="flr-sub"><b>${esc(r.unit)}</b> · ${esc(r.type)} · ${esc(dmy(r.date))} ${esc(tm0(r.ts))} · ${esc(r.by)} ${pill(r.cond)}</div>
      <table class="flr-dt"><tr><td>ODO</td><td>${r.odo || '—'} <small>(previous ${r.prv || '—'} · ${r.km || 0} km)</small></td></tr>
      ${TG.map(([k, n]) => `<tr${dif(r.tg[k], o && o.tg[k])}><td>${esc(n)}</td><td>${ok(r.tg[k])}</td></tr>`).join('')}
      <tr><td>Checklist</td><td>${r.tot ? r.ok + '/' + r.tot + ' OK' : '—'}${r.na ? ' · ' + r.na + ' N/A' : ''}</td></tr>
      <tr${o && [...r.iss.keys()].some(k => k.startsWith('c_') && !o.iss.has(k)) ? ' class="dd"' : ''}><td>NOT OK points</td><td>${r.nok.length ? r.nok.map(x => `<span class="flr-p ${o && !o.iss.has('c_' + x.toLowerCase().replace(/[^a-z0-9]/g, '')) ? 'r' : 'o'}">${esc(x)}</span>`).join(' ') : '—'}</td></tr>
      <tr${dif(r.scN, o && o.scN)}><td>Scratches</td><td>Front ${r.sc.f} · Rear ${r.sc.r} · Left ${r.sc.l} · Right ${r.sc.t}</td></tr>
      <tr><td>User note</td><td>${esc(r.note) || '—'}</td></tr><tr><td>Approval</td><td>${esc(r.appr) || '—'}</td></tr></table></div>`;
  }
  const tm0 = t => t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  function showRec(ids) {
    const R = String(ids).split(',').map(id => S.rows.find(r => r.id === +id)).filter(Boolean); if (!R.length) return;
    let m = Q('#flrPop'); if (m) m.remove(); m = document.createElement('div'); m.id = 'flrPop';
    m.innerHTML = `<div class="flr-pc"><div class="flr-ph"><b>${esc(R[0].unit)} · ${esc(dmy(R[0].date))}</b><span style="flex:1"></span><button type="button" class="ghost small" data-x="1">✕ Close</button></div><div class="flr-pb">${R.map(r => `<div class="flr-pair"><div class="flr-chg">${chg(r.d)} ${esc(chgTxt(r.d)) || ''}</div><div class="flr-cols">${card(r.prev, null, '◀ Previous inspection')}${card(r, r.prev, 'Recent ▶')}</div></div>`).join('')}</div></div>`;
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-x]')) m.remove(); }); document.body.appendChild(m);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q('#flrPop')) Q('#flrPop').remove(); });
  function log() {
    const R = sel().slice().sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts || b.id - a.id), ok = v => v === true ? '✓' : v === false ? '<b style="color:#b91c1c">✗</b>' : '';
    return `<div class="flr-wrap"><table class="flr-t"><thead><tr><th>Date</th><th>Unit</th><th>Warehouse</th><th>Type</th><th>By</th><th class="c">ODO</th><th class="c">Prev ODO</th><th class="c">KM</th>${TG.map(x => `<th class="c">${esc(x[1])}</th>`).join('')}<th class="c">Checklist</th><th>NOT OK points</th><th class="c">Scratches F/R/L/Rt</th><th>Condition</th><th>Change</th><th>Approval</th><th>Note</th></tr></thead><tbody>
      ${R.map(r => `<tr${r.n ? ' class="hr"' : ''} data-rid="${r.id}" style="cursor:pointer"><td>${esc(dmy(r.date))}</td><td><b>${esc(r.unit)}</b></td><td>${esc(whOf(r.uk))}</td><td>${esc(r.type)}</td><td>${esc(r.by)}</td><td class="c">${r.odo || ''}</td><td class="c">${r.prv || ''}</td><td class="c">${r.km || ''}</td>${TG.map(x => `<td class="c">${ok(r.tg[x[0]])}</td>`).join('')}<td class="c">${r.tot ? r.ok + '/' + r.tot : ''}</td><td>${esc(r.nok.join('; '))}</td><td class="c">${r.scN ? [r.sc.f, r.sc.r, r.sc.l, r.sc.t].join('/') : ''}</td><td>${pill(r.cond)}</td><td>${chg(r.d)}</td><td>${esc(r.appr)}</td><td>${esc(r.note)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function render() {
    const v = Q('#flrBody'); if (!v) return; const U = rpUI, us = units();
    v.innerHTML = `<div class="rp-f">${U.fi('From', `<input type="date" data-f="from" value="${S.f.from}">`)}${U.fi('To', `<input type="date" data-f="to" value="${S.f.to}">`)}${U.fi('Type', `<select data-f="type"><option value="">Received + parked</option><option value="R"${S.f.type === 'R' ? ' selected' : ''}>Received only</option><option value="P"${S.f.type === 'P' ? ' selected' : ''}>Parked only</option></select>`)}${U.fi('Warehouse', `<select data-f="whs"><option value="">All warehouses</option>${whsList().map(w => `<option${w === S.f.whs ? ' selected' : ''}>${esc(w)}</option>`).join('')}</select>`)}${U.fi('Unit', `<select data-f="unit"><option value="">All units</option>${us.map(u => `<option${u === S.f.unit ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select>`)}${U.fi('Search', `<input type="search" data-f="q" placeholder="Unit / user…" value="${esc(S.f.q)}">`)}
      <label class="rp-ck"><input type="checkbox" data-f="onlyIssue"${S.f.onlyIssue ? ' checked' : ''}> records with issues / worse only</label><span class="rp-sp"></span>${U.grp('<button class="secondary small" type="button" data-fl="per" data-d="7">7 days</button><button class="secondary small" type="button" data-fl="per" data-d="30">30 days</button><button class="secondary small" type="button" data-fl="per" data-d="90">90 days</button>')}</div>
      ${S.loaded ? kpis(sel()) : ''}
      ${U.tabbar([['sum', '📋 Unit summary'], ['chg', '🔄 Changes vs previous'], ['mx', '📊 Dates × units'], ['mxT', '📊 Units × dates'], ['miss', '🚫 Not received / parked'], ['log', '🧾 Receiving log']].map(([k, t]) => `<button type="button" class="${S.tab === k ? 'active on' : ''}" data-t="${k}">${t}</button>`).join(''), 'data-fl', '#flrBody')}
      ${S.loading && !S.loaded ? '<div class="flr-hint">Reading…</div>' : !S.loaded ? `<div class="flr-hint">${S.err ? '⚠ ' + esc(S.err) : 'Press 🔄 Reload to read the receiving records.'}</div>` : S.tab === 'sum' ? summary() : S.tab === 'chg' ? changes() : S.tab === 'mx' ? matrix() : S.tab === 'mxT' ? matrixT() : S.tab === 'miss' ? missing() : log()}`;
  }
  function rep() { const T = { sum: 'Forklift receiving — unit summary', chg: 'Forklift receiving — changes vs previous inspection', mx: 'Forklift receiving — dates × units', mxT: 'Forklift receiving — units × dates', miss: 'Forklift receiving — units without receive / park on ' + dmy(S.day), log: 'Forklift receiving log' }[S.tab];
    const note = [dmy(S.f.from) + ' – ' + dmy(S.f.to), S.f.type === 'R' ? 'received only' : S.f.type === 'P' ? 'parked only' : '', S.f.whs && 'Warehouse ' + S.f.whs, S.f.unit && 'Unit ' + S.f.unit, S.f.onlyIssue && 'issues only', 'Printed ' + new Date().toLocaleString()].filter(Boolean).join(' · ');
    return tblReport(Q('#flrBody table.flr-t'), T, note, T.replace(/^Forklift /, '')); }
  window.flrCss = () => { if (window._flrCss) return; window._flrCss = 1;
    const c2 = document.createElement('style'); c2.textContent = `#flrPop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px}#flrPop .flr-pc{background:var(--card,#fff);color:inherit;border-radius:14px;max-width:980px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.4)}#flrPop .flr-ph{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border);font-size:15px}#flrPop .flr-pb{overflow:auto;padding:12px 16px}#flrPop .flr-pair{margin-bottom:18px}#flrPop .flr-chg{margin-bottom:8px;font-size:13px}#flrPop .flr-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}#flrPop .flr-cd{border:1px solid var(--border);border-radius:12px;padding:10px 12px;min-width:0}#flrPop .flr-cd h4{margin:0 0 4px;font-size:13px}#flrPop .flr-sub{font-size:12px;margin-bottom:6px}#flrPop table.flr-dt{width:100%;border-collapse:collapse;font-size:12px}#flrPop .flr-dt td{padding:4px 6px;border-top:1px solid var(--border);vertical-align:top}#flrPop .flr-dt td:first-child{color:var(--gray-600);white-space:nowrap;width:1%}#flrPop .flr-dt tr.dd td{background:#fee2e2;color:#7f1d1d}#flrPop .flr-hint{font-size:12px;color:var(--gray-600)}#flrPop .flr-p{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;font-weight:700}#flrPop .flr-p.g{background:#dcfce7;color:#166534}#flrPop .flr-p.o{background:#fef3c7;color:#92400e}#flrPop .flr-p.r{background:#fee2e2;color:#991b1b}#flrPop .flr-p.n{background:#e5e7eb;color:#374151}@media(max-width:720px){#flrPop .flr-cols{grid-template-columns:1fr}}`; document.head.appendChild(c2);
    const css = document.createElement('style'); css.textContent = `:is(#view-flr,#view-fla) .flr-hint{font-size:12px;color:var(--gray-600);margin:6px 0}:is(#view-flr,#view-fla) .flr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}:is(#view-flr,#view-fla) .flr-k{border:1px solid var(--border);border-radius:12px;padding:8px 14px}:is(#view-flr,#view-fla) .flr-k span{font-size:12px;color:var(--gray-600);display:block}:is(#view-flr,#view-fla) .flr-k b{font-size:20px}:is(#view-flr,#view-fla) .flr-k small{display:block;font-size:11px;color:var(--gray-600)}
:is(#view-flr,#view-fla) .flr-wrap{overflow:auto;max-height:70vh;border:1px solid var(--border);border-radius:12px}:is(#view-flr,#view-fla) table.flr-t{border-collapse:collapse;font-size:12px;width:100%}:is(#view-flr,#view-fla) .flr-t th{background:var(--brand-light,#eef2fb);padding:7px 6px;text-align:left;white-space:nowrap;position:sticky;top:0;z-index:2}:is(#view-flr,#view-fla) .flr-t td{padding:6px;border-top:1px solid var(--border);vertical-align:top}:is(#view-flr,#view-fla) .flr-t .c{text-align:center}:is(#view-flr,#view-fla) tr.hr td{background:rgba(254,226,226,.45)}
:is(#view-flr,#view-fla) .flr-p{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;font-weight:700;white-space:nowrap}:is(#view-flr,#view-fla) .flr-p.g{background:#dcfce7;color:#166534}:is(#view-flr,#view-fla) .flr-p.o{background:#fef3c7;color:#92400e}:is(#view-flr,#view-fla) .flr-p.r{background:#fee2e2;color:#991b1b}:is(#view-flr,#view-fla) .flr-p.n{background:#e5e7eb;color:#374151}
:is(#view-flr,#view-fla) .flr-mx td{text-align:center;min-width:54px}:is(#view-flr,#view-fla) .flr-mx th{text-align:center}:is(#view-flr,#view-fla) .flr-mx .st{position:sticky;left:0;background:var(--card,#fff);text-align:left;z-index:1;min-width:110px}:is(#view-flr,#view-fla) .flr-mx thead .st{z-index:3;background:var(--brand-light,#eef2fb)}:is(#view-flr,#view-fla) .flr-mx td.ok{color:#15803d}:is(#view-flr,#view-fla) .flr-mx td.h1{background:#fed7aa;color:#9a3412;font-weight:700}:is(#view-flr,#view-fla) .flr-mx td.h2{background:#fecaca;color:#991b1b;font-weight:700}
body.dark :is(#view-flr,#view-fla) .flr-mx .st{background:var(--card)}body.dark :is(#view-flr,#view-fla) .flr-mx td.h1,body.dark :is(#view-flr,#view-fla) .flr-mx td.h2{color:#111}`; document.head.appendChild(css);
  };
  function init() {
    const v = Q('#view-flr'); if (!v || v._i) return; v._i = 1;
    v.addEventListener('click', e => { const rc = e.target.closest('[data-rid]'); if (rc && !e.target.closest('button,input,select')) return showRec(rc.dataset.rid); const t = e.target.closest('[data-t],[data-fl]'); if (!t) return; if (t.dataset.t) { S.tab = t.dataset.t; return render(); } const a = t.dataset.fl;
      if (a === 'expand') { const tb = Q('#flrBody table.flr-t'); if (tb && window.tableExpandOpen) tableExpandOpen(tb); return; } if (a === 'print' || a === 'excel' || a === 'mail') { const d = rep(); if (a === 'print') a2Print(d); else if (a === 'excel') a2Export(d); else a2Mail(rep); return; }
      if (a === 'reload') load(true); else if (a === 'per') { S.f.to = ymd(new Date()); S.f.from = ymd(dShift(new Date(), -+t.dataset.d)); render(); } });
    v.addEventListener('change', e => { const el = e.target, sk = el.dataset.s; if (sk) { S[sk] = el.value; return render(); } const k = el.dataset.f; if (!k) return; S.f[k] = el.type === 'checkbox' ? el.checked : el.value; render(); });
    v.addEventListener('input', e => { const el = e.target; if (el.dataset.f === 'q') { S.f.q = el.value.trim(); clearTimeout(S.tm); S.tm = setTimeout(() => { render(); const i = Q('#flrBody [data-f=q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 350); } });
    window.flrCss();
    render();
  }
  const nav = Q('.nav-item[data-view="flr"]'); if (nav) nav.addEventListener('click', () => { init(); setTimeout(() => load(false), 50); });
  const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (activeViewId() === 'flr') { e.stopImmediatePropagation(); load(true); } }, true);
  window.FLR = { S, load, render, showRec };
})();

/* ============================================================
   FORKLIFT ACTIVITY — FLO_Daily_Activity_tbl (the Start / End activity entries of the forklift operators)
   · log · by unit · by operator · units × dates · units with no activity on a chosen date
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = escapeHtml, LIST = 'FLO_Daily_Activity_tbl';
  const nz = x => String(x || '').toLowerCase().replace(/_x[0-9a-f]{4}_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dmy = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return d + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y; };
  const dShift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const hm = h => { if (!h) return ''; const m = Math.round(h * 60); return Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm'; };
  const tm = t => t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const S = { rows: [], loaded: false, loading: false, err: '', tab: 'log', day: ymd(new Date()), f: { from: ymd(dShift(new Date(), -7)), to: ymd(new Date()), unit: '', whs: '', op: '', task: '', q: '' } };
  const say = (t, w) => { const e = Q('#flaStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };
  const ch = v => v && typeof v === 'object' ? String(v.Value || v.LookupValue || '') : String(v == null ? '' : v);
  function parse(it) {
    const f = it.fields || {}, K = {}; Object.keys(f).forEach(k => { K[nz(k)] = f[k]; });
    const g = (...ks) => { for (const k of ks) if (K[k] != null && K[k] !== '') return K[k]; return ''; };
    const unit = String(g('flcode')).trim(); if (!unit) return null;
    const dv = g('transdate'); let date = ''; if (dv) { const d = new Date(dv); if (!isNaN(d)) date = ymd(d); }
    const st = g('starttimestamp') ? new Date(g('starttimestamp')).getTime() : 0, en = g('endtimestamp') ? new Date(g('endtimestamp')).getTime() : 0;
    if (!date) date = st ? ymd(new Date(st)) : it.createdDateTime ? ymd(new Date(it.createdDateTime)) : '';
    let h = st && en && en > st ? (en - st) / 36e5 : 0; if (!h) { const s = String(g('nrofhoursminuts', 'tasktimeduration')); const m = s.match(/(\d+)\s*[:h]\s*(\d+)/); h = m ? +m[1] + +m[2] / 60 : num(s) > 0 && num(s) < 24 ? num(s) : 0; }
    return { id: +it.id || 0, uk: unit.toUpperCase(), unit, date, st: isFinite(st) ? st : 0, en: isFinite(en) ? en : 0, h, op: String(g('floname')).trim() || String(it.createdBy && it.createdBy.user && it.createdBy.user.displayName || '').trim(), task: ch(g('tasktype')), tt: ch(g('trlstasktype')), truck: ch(g('truckplatenr', 'trucknr')), plts: num(g('nrofplts')), odo: num(g('taskodo')), eodo: num(g('endodo')), rem: String(g('remarks')).trim(), closed: !!en, cid: g('closeactvtyid') };
  }
  async function load(force) {
    if (S.loading || (S.loaded && !force)) return; S.loading = true; S.err = ''; say('Reading ' + LIST + '…');
    try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first (no token / Site URL)');
      const ids = await resolveIds(site, LIST, token), items = await fetchAllItems(ids.siteId, ids.listId, token, n => say('Reading ' + LIST + '… ' + n));
      S.rows = items.map(parse).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date) || a.st - b.st || a.id - b.id);
      try { if (window.FLR) await FLR.load(false); } catch (e) {}
      S.loaded = true; say('✔ ' + S.rows.length + ' activity record(s) read · ' + new Date().toLocaleTimeString());
    } catch (e) { S.err = e.message; say('⚠ ' + e.message, 1); } finally { S.loading = false; } render();
  }
  const master = () => (window.FLR && FLR.S.mst) || [];
  const whOf = u => { const m = master().find(x => x.uk === u); return m ? m.whs : ''; }, whsList = () => [...new Set(master().map(m => m.whs).filter(Boolean))].sort();
  const sel = () => S.rows.filter(r => r.date >= S.f.from && r.date <= S.f.to && (!S.f.whs || whOf(r.uk) === S.f.whs) && (!S.f.unit || r.uk === S.f.unit) && (!S.f.op || r.op === S.f.op) && (!S.f.task || r.task === S.f.task) && (!S.f.q || (r.uk + ' ' + r.op + ' ' + r.truck + ' ' + r.rem).toUpperCase().includes(S.f.q.toUpperCase())));
  const units = () => [...new Set(S.rows.map(r => r.uk)  .concat(master().map(m => m.uk)))].filter(u => !S.f.whs || whOf(u) === S.f.whs).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const uName = u => { const m = master().find(x => x.uk === u); return m ? m.code : u; };
  const f1 = n => Math.round(n * 10) / 10;
  function kpis(R) {
    const K = (t, v, s) => `<div class="flr-k"><span>${t}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`, us = new Set(R.map(r => r.uk)), ops = new Set(R.map(r => r.op).filter(Boolean)), h = R.reduce((a, r) => a + r.h, 0);
    return `<div class="flr-kpis">${K('Activities', R.length, R.filter(r => !r.closed).length + ' still open (no end time)')}${K('Units used', us.size, master().length ? 'of ' + master().length + ' in the unit list' : '')}${K('Operators', ops.size)}${K('Pallets', f1(R.reduce((a, r) => a + r.plts, 0)))}${K('Hours worked', hm(h) || '—', R.length ? 'avg ' + (hm(h / R.length) || '—') + ' per activity' : '')}</div>`;
  }
  function log() {
    const R = sel().slice().sort((a, b) => b.date.localeCompare(a.date) || b.st - a.st || b.id - a.id);
    return `<div class="flr-wrap"><table class="flr-t"><thead><tr><th>Date</th><th>Unit</th><th>Warehouse</th><th>Operator</th><th>Task</th><th>Activity type</th><th>Truck</th><th class="c">Start</th><th class="c">End</th><th class="c">Duration</th><th class="c">Pallets</th><th class="c">Task ODO</th><th class="c">End ODO</th><th>Remarks</th></tr></thead><tbody>
      ${R.map(r => `<tr${r.closed ? '' : ' class="hr"'}><td>${esc(dmy(r.date))}</td><td><b>${esc(r.unit)}</b></td><td>${esc(whOf(r.uk))}</td><td>${esc(r.op)}</td><td>${esc(r.task)}</td><td>${esc(r.tt)}</td><td>${esc(r.truck)}</td><td class="c">${tm(r.st)}</td><td class="c">${r.closed ? tm(r.en) : '<span class="flr-p o">open</span>'}</td><td class="c">${hm(r.h)}</td><td class="c">${r.plts || ''}</td><td class="c">${r.odo || ''}</td><td class="c">${r.eodo || ''}</td><td>${esc(r.rem)}</td></tr>`).join('') || '<tr><td colspan="14" style="text-align:center;padding:16px">No activity for this selection.</td></tr>'}</tbody></table></div>`;
  }
  function group(keyf, label) {
    const R = sel(), m = new Map(); R.forEach(r => { const k = keyf(r) || '—'; let x = m.get(k); if (!x) m.set(k, x = { k, n: 0, h: 0, p: 0, open: 0, days: new Set(), first: '', last: '', ops: new Set(), us: new Set(), o0: 0, o1: 0 }); x.n++; x.h += r.h; x.p += r.plts; if (!r.closed) x.open++; x.days.add(r.date); if (!x.first || r.date < x.first) x.first = r.date; if (r.date > x.last) x.last = r.date; if (r.op) x.ops.add(r.op); x.us.add(r.unit); const o = r.eodo || r.odo; if (o) { x.o0 = x.o0 ? Math.min(x.o0, o) : o; x.o1 = Math.max(x.o1, o); } });
    const L = [...m.values()].sort((a, b) => b.h - a.h || b.n - a.n), byU = label === 'Unit';
    return `<div class="flr-wrap"><table class="flr-t"><thead><tr><th>${label}</th>${byU ? '<th>Warehouse</th>' : ''}<th class="c">Activities</th><th class="c">Days active</th><th class="c">Pallets</th><th class="c">Hours</th><th class="c">Avg / activity</th><th class="c">Open</th><th>${byU ? 'Operators' : 'Units used'}</th>${byU ? '<th class="c">ODO range</th>' : ''}<th>First</th><th>Last</th></tr></thead><tbody>
      ${L.map(x => `<tr><td><b>${esc(byU ? uName(x.k.toUpperCase()) : x.k)}</b></td>${byU ? '<td>' + esc(whOf(x.k.toUpperCase())) + '</td>' : ''}<td class="c">${x.n}</td><td class="c">${x.days.size}</td><td class="c">${f1(x.p) || ''}</td><td class="c">${hm(x.h)}</td><td class="c">${hm(x.h / x.n)}</td><td class="c">${x.open || ''}</td><td>${esc([...(byU ? x.ops : x.us)].join(', '))}</td>${byU ? `<td class="c">${x.o1 ? x.o0 + ' → ' + x.o1 : ''}</td>` : ''}<td>${esc(dmy(x.first))}</td><td>${esc(dmy(x.last))}</td></tr>`).join('') || '<tr><td colspan="11" style="text-align:center;padding:16px">No activity for this selection.</td></tr>'}</tbody></table></div>`;
  }
  function matrix() {
    const R = sel(), us = (S.f.unit ? [S.f.unit] : units()), ds = [...new Set(R.map(r => r.date))].sort().reverse(), by = new Map(); R.forEach(r => { const k = r.uk + '|' + r.date; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    const sd = d => { const [y, m, dd] = d.split('-'); return dd + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]; };
    if (!ds.length) return '<div class="flr-hint">No activity for this selection.</div>';
    return `<div class="flr-hint">Units in the rows, dates in the columns — each cell shows the number of activities · hours worked. Empty = the unit did no activity that day. Hover for the operators.</div><div class="flr-wrap"><table class="flr-t flr-mx"><thead><tr><th class="st">Unit \\ Date</th><th>Warehouse</th><th>Activities</th><th>Hours</th><th>Days idle</th>${ds.map(d => `<th title="${esc(dmy(d))}">${esc(sd(d))}</th>`).join('')}</tr></thead><tbody>
      ${us.map(u => { const mine = R.filter(r => r.uk === u), idle = ds.filter(d => !by.has(u + '|' + d)).length; return `<tr><td class="st"><b>${esc(uName(u))}</b></td><td>${esc(whOf(u))}</td><td class="c">${mine.length || ''}</td><td class="c">${hm(mine.reduce((a, r) => a + r.h, 0))}</td><td class="c ${idle ? 'h1' : ''}">${idle || ''}</td>${ds.map(d => { const L = by.get(u + '|' + d); if (!L) return '<td></td>'; const h = L.reduce((a, r) => a + r.h, 0); return `<td class="${L.some(r => !r.closed) ? 'h1' : 'ok'}" title="${esc(L.map(r => r.op + ' · ' + r.task + ' ' + tm(r.st) + '–' + tm(r.en)).join('\n'))}"><b>${L.length}</b>${h ? '<br><small>' + hm(h) + '</small>' : ''}</td>`; }).join('')}</tr>`; }).join('')}</tbody></table></div>`;
  }
  function idle() {
    const day = S.day || ymd(new Date()), R = S.rows.filter(r => r.date === day), by = new Map(); R.forEach(r => { if (!by.has(r.uk)) by.set(r.uk, []); by.get(r.uk).push(r); });
    const all = units().map(u => ({ u, L: by.get(u) || [], last: S.rows.filter(r => r.uk === u && r.date < day).pop() })), L = all.filter(x => !x.L.length);
    return `<div class="rp-f"><label class="rp-fi"><span>Date</span><input type="date" data-s="day" value="${day}"></label></div>
      <div class="flr-kpis"><div class="flr-k"><span>Units</span><b>${all.length}</b></div><div class="flr-k"><span>With activity</span><b>${all.length - L.length}</b></div><div class="flr-k"><span>No activity</span><b>${L.length}</b></div></div>
      <div class="flr-wrap"><table class="flr-t"><thead><tr><th>Unit</th><th>Description</th><th>Warehouse</th><th>Last activity before this date</th><th>Operator</th></tr></thead><tbody>
      ${L.map(x => { const m = master().find(y => y.uk === x.u); return `<tr class="hr"><td><b>${esc(uName(x.u))}</b></td><td>${esc(m ? m.desc : '')}</td><td>${esc(m ? m.whs : '')}</td><td>${x.last ? esc(dmy(x.last.date)) + ' · ' + esc(x.last.task) : '—'}</td><td>${x.last ? esc(x.last.op) : ''}</td></tr>`; }).join('') || '<tr><td colspan="5" style="text-align:center;padding:16px">Every unit had activity on this date.</td></tr>'}</tbody></table></div>`;
  }
  function render() {
    const v = Q('#flaBody'); if (!v) return; const U = rpUI, ops = [...new Set(S.rows.map(r => r.op).filter(Boolean))].sort(), tasks = [...new Set(S.rows.map(r => r.task).filter(Boolean))].sort(), op = (a, cur) => a.map(x => `<option${x === cur ? ' selected' : ''}>${esc(x)}</option>`).join('');
    v.innerHTML = `<div class="rp-f">${U.fi('From', `<input type="date" data-f="from" value="${S.f.from}">`)}${U.fi('To', `<input type="date" data-f="to" value="${S.f.to}">`)}${U.fi('Warehouse', `<select data-f="whs"><option value="">All warehouses</option>${whsList().map(w => `<option${w === S.f.whs ? ' selected' : ''}>${esc(w)}</option>`).join('')}</select>`)}${U.fi('Unit', `<select data-f="unit"><option value="">All units</option>${op(units(), S.f.unit)}</select>`)}${U.fi('Operator', `<select data-f="op"><option value="">All operators</option>${op(ops, S.f.op)}</select>`)}${U.fi('Task', `<select data-f="task"><option value="">All tasks</option>${op(tasks, S.f.task)}</select>`)}${U.fi('Search', `<input type="search" data-f="q" placeholder="Unit / operator / truck…" value="${esc(S.f.q)}">`)}<span class="rp-sp"></span>${U.grp('<button class="secondary small" type="button" data-fa="per" data-d="7">7 days</button><button class="secondary small" type="button" data-fa="per" data-d="30">30 days</button><button class="secondary small" type="button" data-fa="per" data-d="90">90 days</button>')}</div>
      ${S.loaded ? kpis(sel()) : ''}
      ${U.tabbar([['log', '🧾 Activity log'], ['unit', '🏗 By unit'], ['op', '👷 By operator'], ['mx', '📊 Units × dates'], ['idle', '🚫 Units with no activity']].map(([k, t]) => `<button type="button" class="${S.tab === k ? 'active on' : ''}" data-t="${k}">${t}</button>`).join(''), 'data-fa', '#flaBody')}
      ${S.loading && !S.loaded ? '<div class="flr-hint">Reading…</div>' : !S.loaded ? `<div class="flr-hint">${S.err ? '⚠ ' + esc(S.err) : 'Press 🔄 Reload to read the activities.'}</div>` : S.tab === 'log' ? log() : S.tab === 'unit' ? group(r => r.unit, 'Unit') : S.tab === 'op' ? group(r => r.op, 'Operator') : S.tab === 'mx' ? matrix() : idle()}`;
  }
  function rep() { const T = { log: 'Forklift activity log', unit: 'Forklift activity — by unit', op: 'Forklift activity — by operator', mx: 'Forklift activity — units × dates', idle: 'Forklift units with no activity on ' + dmy(S.day) }[S.tab];
    const note = [dmy(S.f.from) + ' – ' + dmy(S.f.to), S.f.whs && 'Warehouse ' + S.f.whs, S.f.unit && 'Unit ' + S.f.unit, S.f.op && 'Operator ' + S.f.op, S.f.task && 'Task ' + S.f.task, 'Printed ' + new Date().toLocaleString()].filter(Boolean).join(' · ');
    return tblReport(Q('#flaBody table.flr-t'), T, note, T.replace(/^Forklift /, '')); }
  function init() {
    const v = Q('#view-fla'); if (!v || v._i) return; v._i = 1; window.flrCss();
    v.addEventListener('click', e => { const t = e.target.closest('[data-t],[data-fa]'); if (!t) return; if (t.dataset.t) { S.tab = t.dataset.t; return render(); } const a = t.dataset.fa;
      if (a === 'expand') { const tb = Q('#flaBody table.flr-t'); if (tb && window.tableExpandOpen) tableExpandOpen(tb); return; } if (a === 'print' || a === 'excel' || a === 'mail') { const d = rep(); if (a === 'print') a2Print(d); else if (a === 'excel') a2Export(d); else a2Mail(rep); return; }
      if (a === 'reload') { if (window.FLR) FLR.S.loaded = false; load(true); } else if (a === 'per') { S.f.to = ymd(new Date()); S.f.from = ymd(dShift(new Date(), -+t.dataset.d)); render(); } });
    v.addEventListener('change', e => { const el = e.target; if (el.dataset.s) { S[el.dataset.s] = el.value; return render(); } const k = el.dataset.f; if (!k) return; S.f[k] = el.value; render(); });
    v.addEventListener('input', e => { const el = e.target; if (el.dataset.f === 'q') { S.f.q = el.value.trim(); clearTimeout(S.tm); S.tm = setTimeout(() => { render(); const i = Q('#flaBody [data-f=q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 350); } });
    render();
  }
  const nav = Q('.nav-item[data-view="fla"]'); if (nav) nav.addEventListener('click', () => { init(); setTimeout(() => load(false), 50); });
  const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (activeViewId() === 'fla') { e.stopImmediatePropagation(); load(true); } }, true);
  window.FLA = { S, load, render };
})();
