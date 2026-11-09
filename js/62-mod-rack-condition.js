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
  function cellOf(L) { if (!L.length) return { h: '', c: '', a: '' }; const A = ` data-rid="${L.map(r => r.id).join(',')}" style="cursor:pointer"`; const hits = L.filter(r => r.hit), same = Math.max(0, ...L.map(r => r.same)), tt = L.map(r => `${r.shift} · ${r.hit ? 'HIT: ' + r.types.join(', ') + (r.act ? ' → ' + r.act : '') + (r.note ? ' (' + r.note + ')' : '') : r.rem} · ${r.by}`).join('\n');
    if (hits.length) return { h: `<span title="${esc(tt)}">🔴 ${hits.length}</span>`, c: hits.length >= 2 ? 'h2' : 'h1', a: A }; if (same) return { h: `<span title="${esc(tt)}">= ${same}</span>`, c: 'sm', a: A }; return { h: `<span title="${esc(tt)}">✓</span>`, c: 'ok', a: A }; }
  function matrix() {
    const R = sel(S.f.loc); if (!S.f.loc) return '<div class="rkc-hint">Choose a Location above to see its racks × dates.</div>';
    let racks = S.f.allRacks ? SRK.rows.filter(r => r.loc === S.f.loc).map(r => r.code) : []; R.forEach(r => { if (!racks.some(x => x.toUpperCase() === r.rk)) racks.push(r.rack); });
    if (S.f.q) racks = racks.filter(c => c.toUpperCase().includes(S.f.q.toUpperCase())); if (S.f.onlyHit) { const hs = new Set(R.filter(r => r.hit).map(r => r.rk)); racks = racks.filter(c => hs.has(c.toUpperCase()) || dmgOf(c) > 0); }
    racks.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); if (!racks.length) return '<div class="rkc-hint">No racks for this selection.</div>';
    const dates = [...new Set(R.map(r => r.date))].sort().reverse(), by = new Map(); R.forEach(r => { const k = r.date + '|' + r.rk; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    const tot = c => R.filter(r => r.rk === c.toUpperCase() && r.hit).length;
    return `<div class="rkc-hint">🔴 n = new hits reported that day · = n = inspected, same n existing hits confirmed · ✓ = inspected OK · empty = not inspected. Hover a cell for the details.</div>
      <div class="rkc-wrap"><table class="rkc-t rkc-mx"><thead><tr><th class="st">Date \\ Rack</th>${racks.map(c => `<th title="${esc(srkDesc(c))}">${esc(c)}</th>`).join('')}<th>Hits</th></tr></thead><tbody>
      ${dates.map(d => { let n = 0; const tds = racks.map(c => { const L = by.get(d + '|' + c.toUpperCase()) || []; n += L.filter(r => r.hit).length; const x = cellOf(L); return `<td class="${x.c}"${x.a}>${x.h}</td>`; }).join(''); return `<tr><td class="st"><b>${esc(dmy(d))}</b></td>${tds}<td class="c"><b>${n || ''}</b></td></tr>`; }).join('') || `<tr><td colspan="${racks.length + 2}" class="rkc-hint">No inspections in this period.</td></tr>`}
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
        return `<tr><td class="st" title="${esc(srkDesc(c))}"><b>${esc(c)}</b></td><td class="${n ? (n >= 2 ? 'h2' : 'h1') : ''}"><b>${n || ''}</b></td><td class="${rec >= 3 ? 'h2' : rec ? 'h1' : ''}">${rec || ''}</td><td>${w >= 3 ? '<span class="rkc-p r">Critical</span>' : w ? '<span class="rkc-p o">Watch</span>' : '<span class="rkc-p g">Good</span>'}</td>${dates.map(d => { const x = cellOf(by.get(d + '|' + K) || []); return `<td class="${x.c}"${x.a}>${x.h}</td>`; }).join('')}</tr>`; }).join('')}
      </tbody><tfoot><tr><td class="st">New hits that day</td><td class="c"><b>${R.filter(r => r.hit).length}</b></td><td></td><td></td>${dates.map(d => { const n = dayHits(d); return `<td class="${n ? (n >= 2 ? 'h2' : 'h1') : ''}"><b>${n || ''}</b></td>`; }).join('')}</tr></tfoot></table></div>`;
  }
  function log() {
    const R = sel(S.f.loc).filter(r => !S.f.onlyHit || r.hit).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    return `<div class="rkc-wrap"><table class="rkc-t"><thead><tr><th>Date</th><th>Shift</th><th>Warehouse</th><th>Location</th><th>Area</th><th>Rack</th><th>Result</th><th>Damage</th><th>Action</th><th>Remarks</th><th>By</th></tr></thead><tbody>${R.map(r => `<tr${r.hit ? ' class="hr"' : ''} data-rid="${r.id}" style="cursor:pointer"><td>${esc(dmy(r.date))}</td><td>${esc(r.shift)}</td><td>${esc(r.whs)}</td><td>${esc(r.loc)}</td><td>${esc(r.area)}</td><td><b>${esc(r.rack)}</b></td><td>${r.hit ? '<span class="rkc-p r">HIT</span>' : r.same ? '<span class="rkc-p o">Same ' + r.same + '</span>' : '<span class="rkc-p g">OK</span>'}</td><td>${esc(r.types.join(', '))}</td><td>${esc(r.act)}</td><td>${esc(r.hit ? r.note : r.rem)}</td><td>${esc(r.by)}</td></tr>`).join('') || '<tr><td colspan="11" class="rkc-hint">Nothing for this selection.</td></tr>'}</tbody></table></div>`;
  }
  function summary() {
    const R = sel(S.f.loc), m = new Map(); R.forEach(r => { let x = m.get(r.rk); if (!x) m.set(r.rk, x = { rack: r.rack, loc: r.loc, whs: r.whs || (srkFind(r.rack) || {}).whs || '', area: r.area || (srkFind(r.rack) || {}).area || '', ins: 0, hits: 0, last: '', lastIns: '', types: new Map() }); x.ins++; if (r.date > x.lastIns) x.lastIns = r.date; if (r.hit) { x.hits++; if (r.date > x.last) x.last = r.date; r.types.forEach(t => x.types.set(t, (x.types.get(t) || 0) + 1)); } });
    SRK.rows.filter(r => (!S.f.loc || r.loc === S.f.loc) && +r.dmg > 0 && !m.has(r.code.toUpperCase())).forEach(r => m.set(r.code.toUpperCase(), { rack: r.code, loc: r.loc, whs: r.whs || '', area: r.area || '', ins: 0, hits: 0, last: '', lastIns: '', types: new Map() }));
    const L = [...m.values()].filter(x => !S.f.onlyHit || x.hits || dmgOf(x.rack)).sort((a, b) => (Math.max(dmgOf(b.rack), b.hits) - Math.max(dmgOf(a.rack), a.hits)) || b.hits - a.hits || a.rack.localeCompare(b.rack, undefined, { numeric: true }));
    return `<div class="rkc-wrap"><table class="rkc-t"><thead><tr><th>Rack</th><th>Warehouse</th><th>Location</th><th>Area</th><th class="c">Inspections</th><th>Last inspected</th><th class="c">New hits</th><th>Last hit</th><th>Damage types</th><th class="c">Hits on record</th><th>Condition</th></tr></thead><tbody>${L.map(x => { const n = Math.max(dmgOf(x.rack), x.hits); const lr = R.filter(q => q.rk === x.rack.toUpperCase()).sort((a, b) => (b.hit - a.hit) || b.date.localeCompare(a.date)).shift(); return `<tr${x.hits ? ' class="hr"' : ''}${lr ? ' data-rid="' + lr.id + '" style="cursor:pointer"' : ''}><td><b>${esc(x.rack)}</b></td><td>${esc(x.whs)}</td><td>${esc(x.loc)}</td><td>${esc(x.area)}</td><td class="c">${x.ins}</td><td>${esc(dmy(x.lastIns))}</td><td class="c"><b>${x.hits || ''}</b></td><td>${esc(dmy(x.last))}</td><td>${esc([...x.types].map(([t, k]) => t + (k > 1 ? ' ×' + k : '')).join(', '))}</td><td class="c">${dmgOf(x.rack) || ''}</td><td>${n >= 3 ? '<span class="rkc-p r">Critical</span>' : n ? '<span class="rkc-p o">Watch</span>' : '<span class="rkc-p g">Good</span>'}</td></tr>`; }).join('') || '<tr><td colspan="11" class="rkc-hint">Nothing for this selection.</td></tr>'}</tbody></table></div>`;
  }
  function render() {
    const v = Q('#rkcBody'); if (!v) return; const L = locs(), shifts = [...new Set(S.rows.map(r => r.shift).filter(Boolean))].sort();
    const U = rpUI;
    v.innerHTML = `<div class="rp-f">${U.fi('Warehouse', `<select data-f="whs"><option value="">All warehouses</option>${whsList().map(w => `<option${w === S.f.whs ? ' selected' : ''}>${esc(w)}</option>`).join('')}</select>`)}${U.fi('Location', `<select data-f="loc" style="max-width:340px"><option value="">All locations</option>${L.map(l => `<option value="${esc(l)}"${l === S.f.loc ? ' selected' : ''}>${esc(locName(l))}</option>`).join('')}</select>`)}
      ${U.fi('From', `<input type="date" data-f="from" value="${S.f.from}">`)}${U.fi('To', `<input type="date" data-f="to" value="${S.f.to}">`)}${U.fi('Shift', `<select data-f="shift"><option value="">All shifts</option>${shifts.map(x => `<option${x === S.f.shift ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>`)}${U.fi('Rack', `<input type="search" data-f="q" value="${esc(S.f.q)}" placeholder="Rack code…" style="min-width:140px">`)}
      <label class="rp-ck"><input type="checkbox" data-f="onlyHit"${S.f.onlyHit ? ' checked' : ''}> damaged racks only</label>${S.tab === 'mx' || S.tab === 'mxT' ? `<label class="rp-ck"><input type="checkbox" data-f="allRacks"${S.f.allRacks ? ' checked' : ''}> all racks of the location</label>` : ''}
      <span class="rp-sp"></span>${U.grp('<button class="secondary small" type="button" data-rk="per" data-d="7">7 days</button><button class="secondary small" type="button" data-rk="per" data-d="30">30 days</button><button class="secondary small" type="button" data-rk="per" data-d="90">90 days</button>')}<button class="success small" type="button" data-rk="3d" title="Show the hits on the 3D Warehouse View" style="margin-bottom:2px">🧊 Show in 3D</button><button class="success small" type="button" data-rk="digest" title="E-mail the new damages or all damaged racks (all, selected or one) to Civil &amp; HSE" style="margin-bottom:2px">📧 Email to Civil &amp; HSE</button></div>
      ${S.f.loc ? (i => `<div class="rkc-loc">📍 <b>${esc(S.f.loc)}</b>${i.area.length ? ` <span>Location: <b>${esc(i.area.join(' / '))}</b></span>` : ''}${i.whs.length ? ` <span>🏭 Warehouse: <b>${esc(i.whs.join(' / '))}</b></span>` : ''}</div>`)(locInfo(S.f.loc)) : S.f.whs ? `<div class="rkc-loc">🏭 Warehouse: <b>${esc(S.f.whs)}</b> · ${L.length} location(s)</div>` : ''}
      ${S.loaded ? kpis(sel(S.f.loc)) : ''}
      ${U.tabbar([['mx', '📊 Dates × racks'], ['mxT', '📊 Racks × dates'], ['sum', '📋 Summary by rack'], ['act', '📌 LM actions'], ['log', '🧾 Inspection log']].map(([k, t]) => `<button type="button" class="${S.tab === k ? 'active on' : ''}" data-t="${k}">${t}</button>`).join(''), 'data-rk', '#rkcBody')}
      ${S.loading && !S.loaded ? '<div class="rkc-hint">Reading…</div>' : !S.loaded ? `<div class="rkc-hint">${S.err ? '⚠ ' + esc(S.err) : 'Press 🔄 Reload to read the inspections.'}</div>` : S.tab === 'mx' ? matrix() : S.tab === 'mxT' ? matrixT() : S.tab === 'sum' ? summary() : S.tab === 'act' ? actions() : log()}`;
  }
  function rep() { const T = { mx: 'Rack hits — dates × racks', mxT: 'Rack hits — racks × dates', sum: 'Rack condition — summary by rack', act: 'Rack hits — LM actions', log: 'Rack inspection log' }[S.tab] || 'Rack hits', i = S.f.loc ? locInfo(S.f.loc) : null;
    const note = [S.f.loc ? 'Location ' + S.f.loc + (i && i.area.length ? ' (' + i.area.join(' / ') + ')' : '') : 'All locations', (i && i.whs.length ? 'Warehouse ' + i.whs.join(' / ') : S.f.whs ? 'Warehouse ' + S.f.whs : ''), dmy(S.f.from) + ' – ' + dmy(S.f.to), S.f.shift && 'Shift ' + S.f.shift, S.f.onlyHit && 'damaged racks only', 'Printed ' + new Date().toLocaleString()].filter(Boolean).join(' · ');
    return tblReport(Q('#rkcBody table.rkc-t'), T, note, T.replace(/^Rack /, '')); }
  function hitBtn() {
    const bar = Q('#w3Body .w3bar'); if (!bar) return; let b = Q('#w3HitBtn'); if (!b) { b = document.createElement('button'); b.id = 'w3HitBtn'; b.type = 'button'; b.className = 'secondary small'; b.title = 'Show the rack hits & damages (Store_Inspections_RowDtls_tbl) on the 3D — same selection as the Rack Hits & Damages screen'; bar.appendChild(b); }
    const t = W3H.on ? `🛡 Hits: ON (${[...W3H.map.values()].filter(h => h.n).length} rack(s) hit · ${esc(dmy(S.f.from))}–${esc(dmy(S.f.to))})` : '🛡 Rack hits'; if (b.innerHTML !== t) b.innerHTML = t; b.classList.toggle('on', W3H.on);
    let lg = Q('#w3HitLeg'); if (W3H.on && !lg) { lg = document.createElement('span'); lg.id = 'w3HitLeg'; lg.style.cssText = 'font-size:12px;display:flex;gap:8px;align-items:center'; lg.innerHTML = [['#f59e0b', '1 new hit'], ['#ea580c', '2'], ['#b91c1c', '3+'], ['#fad650', 'hit on record only']].map(([c, t]) => `<span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${c};vertical-align:-2px;margin-right:3px"></i>${t}</span>`).join(''); bar.appendChild(lg); } else if (!W3H.on && lg) lg.remove();
  }
  document.addEventListener('click', async e => { const b = e.target.closest && e.target.closest('#w3HitBtn'); if (!b) return; W3H.on = !W3H.on; if (W3H.on && !S.loaded) { b.textContent = '🛡 reading inspections…'; await load(false); } upd3d(); try { w3Api.redraw(); } catch (x) {} hitBtn(); });
  setInterval(hitBtn, 1500);


  /* ---------- click a cell / row → the inspection next to the previous one · 📧 Take action (Fleet & HSE) → saved as LM action ---------- */
  const RACT_K = LS_BASE + '_rkc_lm', LMX = () => window.LMX;
  try { utRegister('rcklm', { section: 'Warehouse Locations', label: 'Rack LM actions → SharePoint', fields: () => [
    { key: 'when', label: 'Action date & time', alias: ['when', 'actiondate', 'timestamp', 'datetime', 'date'] }, { key: 'rack', label: 'Rack code', alias: ['rack', 'rackcode', 'title'] }, { key: 'loc', label: 'Location', alias: ['location', 'locationdesc'] },
    { key: 'whs', label: 'Warehouse', alias: ['whs', 'warehouse', 'whsdesc'] }, { key: 'area', label: 'Area', alias: ['area', 'areadesc'] }, { key: 'recdate', label: 'Inspection date', alias: ['inspectiondate', 'recdate', 'recorddate', 'transdate'] }, { key: 'shift', label: 'Shift', alias: ['shift'] },
    { key: 'dmg', label: 'Damage types', alias: ['damage', 'damagetypes', 'dmg'] }, { key: 'by', label: 'Inspected by', alias: ['inspectedby', 'by', 'username', 'user'] }, { key: 'obs', label: 'Observation', alias: ['observation', 'obs', 'details', 'description', 'remarks'] },
    { key: 'act', label: 'Action required', alias: ['actionrequired', 'action', 'lmaction', 'requiredaction'] }, { key: 'prio', label: 'Priority', alias: ['priority', 'prio'] }, { key: 'due', label: 'Due date', alias: ['duedate', 'due', 'targetdate'] },
    { key: 'to', label: 'Sent to', alias: ['sentto', 'to', 'recipients'] }, { key: 'cc', label: 'Cc', alias: ['cc'] }, { key: 'subj', label: 'E-mail subject', alias: ['subject', 'emailsubject'] }, { key: 'lm', label: 'Taken by (line manager)', alias: ['takenby', 'lm', 'linemanager', 'actionby'] },
    { key: 'status', label: 'Status', alias: ['status', 'actionstatus'] }, { key: 'recid', label: 'Record ID', alias: ['recordid', 'recid', 'refid'] }] }); } catch (e) {}
  const prevOf = r => S.rows.filter(x => x.rk === r.rk && (x.date < r.date || (x.date === r.date && (+x.id) < (+r.id)))).sort((a, b) => a.date.localeCompare(b.date) || (+a.id) - (+b.id)).pop();
  const nOf = r => Math.max(dmgOf(r.rack), S.rows.filter(x => x.rk === r.rk && x.hit).length), condOf = r => { const n = nOf(r); return n >= 3 ? 'Critical' : n ? 'Watch' : 'Good'; };
  const actFor = id => (LMX() ? LMX().jget(RACT_K, []) : []).filter(a => String(a.recid) === String(id));
  function rcard(r, o, ttl) {
    if (!r) return `<div class="flr-cd"><h4>${ttl}</h4><div class="flr-hint">No earlier inspection of this rack in the loaded period.</div></div>`;
    const dd = (a, b) => o && a !== b ? ' class="dd"' : '', res = r.hit ? '<b style="color:#b91c1c">HIT</b>' : 'OK — no new damage';
    return `<div class="flr-cd"><h4>${ttl}</h4><div class="flr-sub"><b>${esc(r.rack)}</b> · ${esc(dmy(r.date))} · ${esc(r.shift)} · ${esc(r.by)}</div><table class="flr-dt">
      <tr${dd(r.hit, o && o.hit)}><td>Result</td><td>${res}</td></tr><tr${dd(r.types.join(','), o && o.types.join(','))}><td>Damage</td><td>${esc(r.types.join(', ')) || '—'}</td></tr><tr${dd(r.act, o && o.act)}><td>Action taken</td><td>${esc(r.act) || '—'}</td></tr>
      <tr><td>Inspector note</td><td>${esc(r.note) || '—'}</td></tr><tr><td>Location</td><td>${esc([r.whs, r.loc, r.area].filter(Boolean).join(' · ')) || '—'}</td></tr><tr><td>Hits on record</td><td>${nOf(r)}</td></tr></table></div>`;
  }
  function showRack(ids) {
    const L = String(ids).split(',').map(id => S.rows.find(r => String(r.id) === id)).filter(Boolean); if (!L.length || !LMX()) return; if (window.flrCss) window.flrCss();
    let m = Q('#flrPop'); if (m) m.remove(); m = document.createElement('div'); m.id = 'flrPop';
    m.innerHTML = `<div class="flr-pc"><div class="flr-ph"><b>${esc(L[0].rack)} · ${esc(dmy(L[0].date))}</b><span style="flex:1"></span><button type="button" class="ghost small" data-x="1">✕ Close</button></div><div class="flr-pb">${L.map(r => { const p = prevOf(r), a = actFor(r.id); return `<div class="flr-pair"><div class="flr-chg"><span class="flr-p ${r.hit ? 'r' : 'g'}">${r.hit ? '▲ New hit' : '✓ No new hit'}</span><span class="flr-p ${{ Critical: 'r', Watch: 'o', Good: 'g' }[condOf(r)]}">${condOf(r)}</span><span style="flex:1"></span><button type="button" class="success small" data-actnew="${r.id}">📧 Take action — email Civil &amp; HSE</button>${a.length ? ` <span class="flr-p g">📌 ${a.length} action(s) taken</span>` : ''}</div><div class="flr-cols">${rcard(p, null, '◀ Previous inspection')}${rcard(r, p, 'Recent ▶')}</div></div>`; }).join('')}</div></div>`;
    m.addEventListener('click', ev => { if (ev.target === m || ev.target.closest('[data-x]')) return m.remove(); const b = ev.target.closest('[data-actnew]'); if (b) openRAct(b.dataset.actnew); }); document.body.appendChild(m);
  }
  function openRAct(id) {
    const r = S.rows.find(x => String(x.id) === String(id)); if (!r || !LMX()) return; const X = LMX(), p = prevOf(r), cond = condOf(r), where = [r.whs, r.loc, r.area].filter(Boolean).join(' · ');
    const obs = r.hit ? 'HIT — ' + (r.types.join(', ') || 'damage') + (r.act ? ' | Action taken: ' + r.act : '') + (r.note ? ' | ' + r.note : '') : 'No new damage reported at this inspection (' + nOf(r) + ' hit(s) on record)';
    X.form({ team: 'Civil & HSE', cfg: LS_BASE + '_rkc_mailcfg', title: r.rack + ' · ' + dmy(r.date), subj: `⚠ Rack ${r.hit ? 'hit' : 'observation'} | ${r.rack} | ${dmy(r.date)}${r.loc ? ' | ' + r.loc : ''}`, obs, act: r.hit ? 'Please inspect the rack, confirm the damage level and the corrective action (unload / repair / replace).' : 'Please review the rack condition and confirm the corrective action.', crit: cond === 'Critical' || (r.hit && nOf(r) >= 2), store: RACT_K, dest: 'rcklm', done: () => { if (S.tab === 'act') render(); },
      row: f => ({ rack: r.rack, loc: r.loc, whs: r.whs, area: r.area, recdate: r.date, shift: r.shift, dmg: r.types.join(', '), by: r.by, recid: r.id }),
      build: f => { const iss = r.hit ? (r.types.length ? r.types : ['Damage reported']) : [], cc = { Critical: ['#b91c1c', '#fee2e2'], Watch: ['#92400e', '#fef3c7'], Good: ['#166534', '#dcfce7'] }[cond];
        const o = { kicker: 'RACK OBSERVATION · ACTION REQUIRED', title: r.rack, sub: [where, dmy(r.date) + ' · ' + r.shift].filter(Boolean).join(' · '), source: 'Rack Hits & Damages',
          chips: [[r.hit ? '▲ New hit' : '✓ No new hit', r.hit ? ['#b91c1c', '#fee2e2'] : ['#166534', '#dcfce7']], ['Condition: ' + cond, cc], ['Hits on record: ' + nOf(r), ['#334155', '#e2e8f0']]],
          sections: [['Observation', (iss.length ? X.ul(iss, '#dc2626') : '<div style="font-size:14px;color:#334155">No new damage reported.</div>') + (r.act ? X.sub('Action taken at the inspection', ['#1d4ed8', '#2563eb'], [r.act]) : '') + (f.obs && f.obs !== obs ? `<div style="font-size:14px;color:#0f172a;margin-top:8px">${esc(f.obs)}</div>` : '')],
            ['Previous inspection of this rack', p ? X.kv([['Date', dmy(p.date) + ' · ' + p.shift], ['Result', p.hit ? 'HIT — ' + (p.types.join(', ') || 'damage') : 'OK — no new damage'], ['Inspected by', p.by]]) : '<div style="font-size:14px;color:#334155">No earlier inspection in the loaded period.</div>'],
            r.note ? ['Inspector note', `<div style="border-left:3px solid #94a3b8;padding:6px 12px;font-size:14px;color:#334155;font-style:italic;background:#f8fafc">${esc(r.note)}</div>`] : null,
            ['Rack details', X.kv([['Warehouse', r.whs], ['Location', r.loc], ['Area', r.area], ['Inspection', r.shift + ' · ' + dmy(r.date)], ['Inspected by', r.by], ['Hits on record', String(nOf(r))]])]] };
        const txt = ['RACK OBSERVATION — ACTION REQUIRED', '='.repeat(40), '', 'Rack        : ' + r.rack, 'Location    : ' + (where || '—'), 'Inspection  : ' + dmy(r.date) + ' · ' + r.shift + ' · ' + r.by, 'Result      : ' + (r.hit ? 'NEW HIT' : 'No new hit') + '  ·  Condition ' + cond + '  ·  ' + nOf(r) + ' hit(s) on record', '', 'OBSERVATION'].concat((iss.length ? iss : ['No new damage reported']).map(x => '  • ' + x), r.act ? ['  Action taken: ' + r.act] : [], r.note ? ['', 'INSPECTOR NOTE', '  ' + r.note] : [], ['', 'PREVIOUS INSPECTION', p ? '  ' + dmy(p.date) + ' · ' + p.shift + ' · ' + (p.hit ? 'HIT — ' + p.types.join(', ') : 'OK') : '  none in the loaded period', '', 'ACTION REQUIRED', '  ' + f.act.replace(/\n/g, '\n  '), '  Priority: ' + f.prio + (f.due ? '   ·   Respond by: ' + dmy(f.due) : ''), '', '—', 'Raised by ' + ((currentUser && (currentUser.displayName || currentUser.username)) || '') + ' (Line Manager) · ORBIT']).join('\n');
        return { o, txt }; } });
  }
  function actions() {
    const L = LMX() ? LMX().jget(RACT_K, []).filter(a => !S.f.loc || a.loc === S.f.loc) : [];
    return `<div class="rkc-hint">Line-manager actions raised from this page (click an inspection → <b>📧 Take action</b>). They are e-mailed to the Civil &amp; HSE team and kept here${typeof utReady === 'function' && utReady('rcklm') ? ' and in the linked SharePoint list' : ' — link a SharePoint list in <b>Upload Destinations → Rack LM actions</b> to store them centrally'}.</div><div class="rkc-wrap"><table class="rkc-t"><thead><tr><th>Raised</th><th>Rack</th><th>Warehouse</th><th>Location</th><th>Inspection</th><th>Observation</th><th>Action required</th><th>Priority</th><th>Due</th><th>Sent to</th><th>Taken by</th><th>Status</th><th>SharePoint</th><th></th></tr></thead><tbody>
      ${L.map(a => `<tr data-rid="${esc(a.recid)}" style="cursor:pointer"><td>${esc(dmy(String(a.when).slice(0, 10)))}</td><td><b>${esc(a.rack)}</b></td><td>${esc(a.whs)}</td><td>${esc(a.loc)}</td><td>${esc(dmy(a.recdate))} · ${esc(a.shift)}</td><td>${esc(a.obs)}</td><td>${esc(a.act)}</td><td>${esc(a.prio)}</td><td>${esc(dmy(a.due))}</td><td>${esc(a.to)}</td><td>${esc(a.lm)}</td><td><span class="rkc-p ${a.status === 'Closed' ? 'g' : 'o'}">${esc(a.status)}</span></td><td>${a.pushed ? '✔' : '<span class="rkc-p o">pending</span>'}</td><td style="white-space:nowrap"><button type="button" class="ghost small" data-ac="done" data-id="${a.id}">${a.status === 'Closed' ? '↺ Reopen' : '✓ Close'}</button>${a.pushed ? '' : ' <button type="button" class="ghost small" data-ac="push" data-id="${a.id}">⬆ Save to SharePoint</button>'}</td></tr>`).join('') || '<tr><td colspan="14" style="text-align:center;padding:16px">No LM actions yet.</td></tr>'}</tbody></table></div>`;
  }
  async function actClick(b) {
    const X = LMX(); if (!X) return; const L = X.jget(RACT_K, []), a = L.find(x => x.id === b.dataset.id); if (!a) return;
    if (b.dataset.ac === 'done') { a.status = a.status === 'Closed' ? 'Open' : 'Closed'; X.jset(RACT_K, L); render(); return; }
    try { await utPush('rcklm', [a], x => x.rack); a.pushed = true; X.jset(RACT_K, L); say('✔ saved to SharePoint'); } catch (e) { say('⚠ ' + e.message, 1); } render();
  }
  function openDigest() {
    if (!LMX() || !S.loaded) return say('Press 🔄 Reload first.', 1); const X = LMX(), cur = () => sel(S.f.loc), where = S.f.loc ? locName(S.f.loc) : S.f.whs || 'all locations', U = x => String(x || '').toUpperCase();
    /* every rack with damage on record (rack setup "Nr of damages") or with a hit seen in the loaded inspections — one entry per rack */
    const damaged = () => { const m = new Map(), Q2 = U(S.f.q);
      (typeof SRK !== 'undefined' ? SRK.rows : []).forEach(r => { if (!(+r.dmg > 0) || !r.code) return; if (S.f.loc ? r.loc !== S.f.loc : (S.f.whs && r.whs !== S.f.whs)) return; if (Q2 && !U(r.code).includes(Q2)) return; m.set(U(r.code), { rack: r.code, loc: r.loc, whs: r.whs, area: r.area, dmg: Math.round(+r.dmg) || 0 }); });
      S.rows.forEach(r => { if (!r.hit || m.has(r.rk)) return; if (S.f.loc ? r.loc !== S.f.loc : (S.f.whs && r.whs !== S.f.whs && !locInfo(r.loc).whs.includes(S.f.whs))) return; if (Q2 && !r.rk.includes(Q2)) return; m.set(r.rk, { rack: r.rack, loc: r.loc, whs: r.whs, area: r.area }); });
      return [...m.values()]; };
    const dd = (iss, r) => (iss.length ? X.ul(iss, '#dc2626') : '<div style="font-size:14px;color:#334155">No new damage reported.</div>') + (r.act ? X.sub('Action taken at the inspection', ['#1d4ed8', '#2563eb'], [r.act]) : '') + (r.note ? `<div style="border-left:3px solid #94a3b8;padding:6px 12px;font-size:14px;color:#334155;font-style:italic;background:#f8fafc;margin:8px 0">${esc(r.note)}</div>` : '');
    X.digest({ team: 'Civil & HSE', cfg: LS_BASE + '_rkc_mailcfg', kicker: 'RACK DAMAGE · ACTION REQUIRED', head: 'Rack damage', kind: 'Rack', source: 'Rack Hits & Damages', where, act: 'Please inspect the racks listed, confirm the damage level and the corrective action for each (unload / repair / replace).', store: RACT_K, dest: 'rcklm', done: () => { if (S.tab === 'act') render(); },
      scopes: [{ k: 'new', label: '🆕 New observed damages (hits reported at inspections)' }, { k: 'all', label: '🛡 All damaged racks (damage on record)', title: 'All racks with damage on record', nodate: true }],
      range: () => dmy(S.f.from) + ' – ' + dmy(S.f.to),
      days: sc => [...new Set(cur().filter(r => r.hit).map(r => r.date))].sort().reverse(),
      items: (day, ok, sc) => {
        if (sc === 'all') return damaged().map(d => { const K = U(d.rack), hs = S.rows.filter(x => x.rk === K && x.hit).sort((a, b) => a.date.localeCompare(b.date) || (+a.id) - (+b.id)), h = hs[hs.length - 1], n = Math.max(d.dmg || 0, dmgOf(d.rack), hs.length), types = [...new Set(hs.flatMap(x => x.types))];
          return { id: d.rack, n, key: d.rack, sub: [d.whs, d.loc, d.area].filter(Boolean).join(' · '), sev: n >= 3 ? 'Critical' : 'Watch', issue: true, line: n + ' hit(s) on record' + (h ? ' · last observed ' + dmy(h.date) : '') + (types.length ? ' — ' + types.join(', ') : ''),
            card: (types.length ? X.ul(types, '#dc2626') : '') + (h && h.act ? X.sub('Action taken at the last hit', ['#1d4ed8', '#2563eb'], [h.act]) : '') + X.kv([['Hits on record', String(n)], ['Last observed hit', h ? dmy(h.date) + ' · ' + h.shift + ' · ' + h.by : 'none in the loaded period'], ['Location', [d.whs, d.loc, d.area].filter(Boolean).join(' · ')]]),
            row: f => ({ rack: d.rack, loc: d.loc, whs: d.whs, area: d.area, recdate: h ? h.date : '', shift: h ? h.shift : '', dmg: types.join(', '), by: h ? h.by : '', recid: d.rack }) }; }).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key, undefined, { numeric: true }));
        return cur().filter(r => (day === '__all__' || r.date === day) && (ok || r.hit)).sort((a, b) => (b.hit - a.hit) || b.date.localeCompare(a.date) || a.rack.localeCompare(b.rack, undefined, { numeric: true })).map(r => {
          const p = prevOf(r), cond = r.hit ? condOf(r) : 'Good', iss = r.hit ? (r.types.length ? r.types : ['Damage reported']) : [], wh = [r.whs, r.loc, r.area].filter(Boolean).join(' · ');
          return { id: r.id, key: r.rack, sub: [dmy(r.date), r.shift, r.by].filter(Boolean).join(' · '), sev: cond, issue: r.hit, line: r.hit ? iss.join(', ') + (r.act ? ' — action taken: ' + r.act : '') : 'No new damage (' + nOf(r) + ' hit(s) on record)',
            card: dd(iss, r) + X.kv([['Location', wh], ['Hits on record', String(nOf(r))], ['Previous inspection', p ? dmy(p.date) + ' · ' + p.shift + ' — ' + (p.hit ? 'HIT ' + p.types.join(', ') : 'OK') : 'none in the loaded period']]),
            row: f => ({ rack: r.rack, loc: r.loc, whs: r.whs, area: r.area, recdate: r.date, shift: r.shift, dmg: r.types.join(', '), by: r.by, recid: r.id }) }; }); } });
  }
  function init() {
    const v = Q('#view-rkc'); if (!v || v._i) return; v._i = 1;
    v.addEventListener('click', e => { const ac = e.target.closest('[data-ac]'); if (ac) return actClick(ac); const rc = e.target.closest('[data-rid]'); if (rc && !e.target.closest('button,input,select')) return showRack(rc.dataset.rid); const t = e.target.closest('[data-t],[data-rk]'); if (!t) return; if (t.dataset.t) { S.tab = t.dataset.t; return render(); } const a = t.dataset.rk;
      if (a === 'digest') return openDigest(); if (a === 'expand') { const tb = Q('#rkcBody table.rkc-t'); if (tb && window.tableExpandOpen) tableExpandOpen(tb); return; } if (a === 'print' || a === 'excel' || a === 'mail') { const d = rep(); if (a === 'print') a2Print(d); else if (a === 'excel') a2Export(d); else a2Mail(rep); return; }
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
  window.RKC = { S, load, render, upd3d, openDigest };
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
  const scoped = () => { try { return typeof locScoped === 'function' && locScoped(); } catch (e) { return false; } };
  const locHint = () => { try { return scoped() ? `<div class="flr-hint">${esc(locText())} — only the forklift units of your Location ID are shown.</div>` : ''; } catch (e) { return ''; } };
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
      try { const u = await resolveIds(site, 'Forklift_Units_tbl', token), ui = await fetchAllItems(u.siteId, u.listId, token); S.mstOk = true; S.mst = ui.map(it => { const f = it.fields || {}, K = {}; Object.keys(f).forEach(k => { K[nz(k)] = f[k]; }); const code = String(K.devicecode || K.title || '').trim(); return code ? { code, uk: code.toUpperCase(), desc: [K.devicebrand, K.devicemodel, K.energytype].filter(Boolean).join(' '), whs: String(K.devicewhs || '').trim() } : null; }).filter(Boolean); } catch (e) { S.mst = []; }
      S.rows = items.map(parse).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts || a.id - b.id);
      if (scoped() && S.mstOk) { const own = new Set(S.mst.map(m => m.uk)); S.rows = S.rows.filter(r => own.has(r.uk)); }
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
    m.innerHTML = `<div class="flr-pc"><div class="flr-ph"><b>${esc(R[0].unit)} · ${esc(dmy(R[0].date))}</b><span style="flex:1"></span><button type="button" class="ghost small" data-x="1">✕ Close</button></div><div class="flr-pb">${R.map(r => `<div class="flr-pair"><div class="flr-chg">${chg(r.d)} ${esc(chgTxt(r.d)) || ''} <span style="flex:1"></span><button type="button" class="success small" data-actnew="${r.id}">📧 Take action — email Fleet &amp; HSE</button>${actFor(r.id).length ? ' <span class="flr-p g" title="' + esc(actFor(r.id).map(a => dmy(a.recdate) + ' · ' + a.status).join('\n')) + '">📌 ' + actFor(r.id).length + ' action(s) taken</span>' : ''}</div><div class="flr-cols">${card(r.prev, null, '◀ Previous inspection')}${card(r, r.prev, 'Recent ▶')}</div></div>`).join('')}</div></div>`;
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-x]')) return m.remove(); const ab = e.target.closest('[data-actnew]'); if (ab) openAct(ab.dataset.actnew); }); document.body.appendChild(m);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q('#flrPop')) Q('#flrPop').remove(); });

  /* ---------- LM action: e-mail the observation to the Fleet & HSE team and keep it as a line-manager action ---------- */
  const ACT_K = LS_BASE + '_flr_lm', CFG_K = LS_BASE + '_flr_mailcfg';
  const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }, jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  try { utRegister('flolm', { section: 'Fleet', label: 'Forklift LM actions → SharePoint', fields: () => [
    { key: 'when', label: 'Action date & time', alias: ['when', 'actiondate', 'timestamp', 'datetime', 'date'] }, { key: 'unit', label: 'Forklift unit', alias: ['unit', 'flcode', 'flo', 'forklift', 'unitcode', 'title'] },
    { key: 'whs', label: 'Warehouse', alias: ['whs', 'warehouse', 'whsdesc', 'location', 'locationdesc'] }, { key: 'rectype', label: 'Record type (Receive / Park)', alias: ['recordtype', 'rectype', 'type'] },
    { key: 'recdate', label: 'Record date', alias: ['recorddate', 'recdate', 'transdate', 'inspectiondate'] }, { key: 'by', label: 'Reported by (user)', alias: ['reportedby', 'by', 'username', 'user'] },
    { key: 'obs', label: 'Observation', alias: ['observation', 'obs', 'issues', 'details', 'description', 'remarks'] }, { key: 'chg', label: 'Change vs previous', alias: ['change', 'changevsprevious', 'trend'] },
    { key: 'act', label: 'Action required', alias: ['actionrequired', 'action', 'lmaction', 'requiredaction'] }, { key: 'prio', label: 'Priority', alias: ['priority', 'prio', 'urgency'] },
    { key: 'due', label: 'Due date', alias: ['duedate', 'due', 'targetdate'] }, { key: 'to', label: 'Sent to', alias: ['sentto', 'to', 'recipients', 'team'] }, { key: 'cc', label: 'Cc', alias: ['cc'] }, { key: 'subj', label: 'E-mail subject', alias: ['subject', 'emailsubject'] },
    { key: 'lm', label: 'Taken by (line manager)', alias: ['takenby', 'lm', 'linemanager', 'createdby', 'actionby'] }, { key: 'status', label: 'Status', alias: ['status', 'actionstatus', 'state'] }, { key: 'recid', label: 'Record ID', alias: ['recordid', 'recid', 'refid', 'sourceid'] }] }); } catch (e) {}
  const actFor = id => jget(ACT_K, []).filter(a => a.recid === id);
  const issList = r => [...r.iss.values()].concat(r.scN ? ['Scratches — Front ' + r.sc.f + ' · Rear ' + r.sc.r + ' · Left ' + r.sc.l + ' · Right ' + r.sc.t] : []);
  function mailHtml(r, f) {
    const d = r.d, e = esc, NAVY = '#16346b', pr = { High: ['#b91c1c', '#fee2e2'], Normal: ['#92400e', '#fef3c7'], Low: ['#166534', '#dcfce7'] }[f.prio] || ['#334155', '#e2e8f0'], tr = d.first ? ['#334155', '#e2e8f0', 'First record'] : d.st === 'Worse' ? ['#b91c1c', '#fee2e2', '▲ Worse than previous'] : d.st === 'Improved' ? ['#166534', '#dcfce7', '▼ Improved'] : ['#334155', '#e2e8f0', '= Same as previous'];
    const cd = { Good: ['#166534', '#dcfce7'], Watch: ['#92400e', '#fef3c7'], Critical: ['#b91c1c', '#fee2e2'] }[r.cond];
    const chip = (t, c) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;color:${c[0]};background:${c[1]}">${e(t)}</span>`;
    const sec = (t, h) => `<tr><td style="padding:18px 28px 0"><div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px">${e(t)}</div>${h}</td></tr>`;
    const ul = (L, col) => L.length ? `<table cellpadding="0" cellspacing="0" style="width:100%">${L.map(x => `<tr><td style="width:20px;vertical-align:top;padding:3px 8px 3px 0;color:${col};font-size:12px">●</td><td style="padding:3px 0;font-size:14px;color:#0f172a">${e(x)}</td></tr>`).join('')}</table>` : '';
    const kv = L => `<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px">${L.filter(x => x[1]).map(x => `<tr><td style="padding:5px 0;color:#64748b;width:140px;vertical-align:top">${e(x[0])}</td><td style="padding:5px 0;color:#0f172a;font-weight:600">${e(x[1])}</td></tr>`).join('')}</table>`;
    const iss = issList(r), chgBlk = d.first ? '<div style="font-size:14px;color:#334155">First inspection recorded for this unit — nothing to compare with.</div>' :
      (d.news.length ? `<div style="font-size:13px;font-weight:700;color:#b91c1c;margin:2px 0 4px">New since the previous inspection</div>${ul(d.news, '#b91c1c')}` : '') + (d.scUp.length ? `<div style="font-size:13px;font-weight:700;color:#b91c1c;margin:10px 0 4px">More scratches</div>${ul(d.scUp, '#b91c1c')}` : '') + (d.gone.length ? `<div style="font-size:13px;font-weight:700;color:#166534;margin:10px 0 4px">Fixed since the previous inspection</div>${ul(d.gone, '#16a34a')}` : '') + (d.odo.length ? `<div style="font-size:13px;font-weight:700;color:#92400e;margin:10px 0 4px">Odometer</div>${ul(d.odo, '#d97706')}` : '') + (!d.news.length && !d.scUp.length && !d.gone.length && !d.odo.length ? '<div style="font-size:14px;color:#334155">No change compared with the previous inspection.</div>' : '') + (r.prev ? `<div style="font-size:12px;color:#64748b;margin-top:10px">Compared with: ${e([r.prev.type, dmy(r.prev.date) + ' ' + tm0(r.prev.ts), r.prev.by].filter(Boolean).join(' · '))}</div>` : '');
    return `<div style="background:#f1f5f9;padding:24px 8px;font-family:Segoe UI,Calibri,Arial,sans-serif"><table cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <tr><td style="background:${NAVY};padding:22px 28px"><div style="font-size:11px;letter-spacing:1.6px;color:#93b4ff;font-weight:700">FORKLIFT OBSERVATION · ACTION REQUIRED</div><div style="font-size:24px;color:#ffffff;font-weight:700;margin-top:6px">${e(r.unit)}</div><div style="font-size:13px;color:#cbd5e1;margin-top:4px">${e(whOf(r.uk) || '')}${whOf(r.uk) ? ' · ' : ''}${e(r.type)} · ${e(dmy(r.date))} ${e(tm0(r.ts))}</div></td></tr>
      <tr><td style="padding:18px 28px 0">${chip('Condition: ' + r.cond, cd)}${chip(tr[2], tr)}${chip('Priority: ' + f.prio, pr)}${f.due ? chip('Due ' + dmy(f.due), ['#1e3a8a', '#dbeafe']) : ''}</td></tr>
      ${sec('Observation', iss.length ? ul(iss, '#dc2626') : '<div style="font-size:14px;color:#334155">No defect ticked by the user.</div>' + (f.obs && !iss.length ? `<div style="font-size:14px;margin-top:6px">${e(f.obs)}</div>` : ''))}
      ${sec('Change vs the previous inspection', chgBlk)}
      ${r.note ? sec('User note', `<div style="border-left:3px solid #94a3b8;padding:6px 12px;font-size:14px;color:#334155;font-style:italic;background:#f8fafc">${e(r.note)}</div>`) : ''}
      ${sec('Unit details', kv([['Reported by', r.by], ['Record', r.type + ' · ' + dmy(r.date) + ' ' + tm0(r.ts)], ['Odometer', r.odo ? r.odo + (r.km ? ' (' + r.km + ' km since previous)' : '') : ''], ['Daily checklist', r.tot ? r.ok + ' of ' + r.tot + ' OK' + (r.na ? ' · ' + r.na + ' N/A' : '') : ''], ['Line manager approval', r.appr]]))}
      <tr><td style="padding:20px 28px 0"><table cellpadding="0" cellspacing="0" style="width:100%;background:#eff6ff;border-left:4px solid #2563eb;border-radius:6px"><tr><td style="padding:14px 18px"><div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;font-weight:700">Action required from Fleet &amp; HSE</div><div style="font-size:15px;color:#0f172a;font-weight:600;margin-top:6px">${e(f.act).replace(/\n/g, '<br>')}</div><div style="font-size:12px;color:#475569;margin-top:8px">Priority <b>${e(f.prio)}</b>${f.due ? ' · please respond by <b>' + e(dmy(f.due)) + '</b>' : ''}</div></td></tr></table></td></tr>
      <tr><td style="padding:22px 28px 24px"><div style="font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:12px">Raised by <b>${e((currentUser && (currentUser.displayName || currentUser.username)) || '')}</b> (Line Manager) · ORBIT — Forklift Receiving · ${e(new Date().toLocaleString())}<br>Please reply to this e-mail with the corrective action taken.</div></td></tr></table></div>`;
  }
  function mailTxt(r, f) {
    const d = r.d, L = ['FORKLIFT OBSERVATION — ACTION REQUIRED', '='.repeat(40), '', 'Unit        : ' + r.unit + (whOf(r.uk) ? '  (' + whOf(r.uk) + ')' : ''), 'Record      : ' + r.type + ' · ' + dmy(r.date) + ' ' + tm0(r.ts), 'Reported by : ' + r.by, 'Condition   : ' + r.cond + (d.first ? '' : '  ·  ' + d.st + ' vs previous'), 'Odometer    : ' + (r.odo || '—') + (r.km ? ' (' + r.km + ' km)' : ''), '', 'OBSERVATION'];
    const iss = issList(r); (iss.length ? iss : ['No defect ticked']).forEach(x => L.push('  • ' + x));
    L.push('', 'CHANGE VS PREVIOUS INSPECTION' + (r.prev ? ' (' + r.prev.type + ' · ' + dmy(r.prev.date) + ')' : ''));
    if (d.first) L.push('  First record for this unit'); else { d.news.forEach(x => L.push('  ▲ New: ' + x)); d.scUp.forEach(x => L.push('  ▲ Scratches: ' + x)); d.gone.forEach(x => L.push('  ▼ Fixed: ' + x)); d.odo.forEach(x => L.push('  ⚠ ' + x)); if (!d.news.length && !d.scUp.length && !d.gone.length && !d.odo.length) L.push('  No change'); }
    if (r.note) L.push('', 'USER NOTE', '  ' + r.note);
    L.push('', 'ACTION REQUIRED', '  ' + f.act.replace(/\n/g, '\n  '), '  Priority: ' + f.prio + (f.due ? '   ·   Respond by: ' + dmy(f.due) : ''), '', '—', 'Raised by ' + ((currentUser && (currentUser.displayName || currentUser.username)) || '') + ' (Line Manager) · ORBIT');
    return L.join('\n');
  }
  function openAct(id) {
    const r = S.rows.find(x => x.id === +id); if (!r) return; const cfg = jget(CFG_K, {}), me = (currentUser && currentUser.email) || '', lm = (currentUser && currentUser.managerEmail) || '';
    let m = Q('#flrAct'); if (m) m.remove(); m = document.createElement('div'); m.id = 'flrAct'; const obs = (r.n ? issTxt(r) : 'No issue ticked') + (r.d.first ? '' : ' | Change: ' + (chgTxt(r.d) || r.d.st));
    const due = ymd(dShift(new Date(), 2)), subj = `⚠ Forklift observation | ${r.unit} | ${dmy(r.date)} | ${r.d.first ? r.cond : r.d.st}`;
    m.innerHTML = `<div class="flr-pc" style="max-width:640px"><div class="flr-ph"><b>📧 Take action — ${esc(r.unit)} · ${esc(dmy(r.date))}</b><span style="flex:1"></span><button type="button" class="ghost small" data-x="1">✕</button></div><div class="flr-pb">
      <div class="flr-af"><label>To — Fleet &amp; HSE team</label><input data-a="to" type="text" placeholder="fleet@…; hse@…" value="${esc(cfg.to || '')}"></div><div class="flr-af"><label>Cc</label><input data-a="cc" type="text" value="${esc(cfg.cc != null ? cfg.cc : [me, lm].filter(Boolean).join('; '))}"></div>
      <div class="flr-af"><label>Subject</label><input data-a="subj" type="text" value="${esc(subj)}"></div><div class="flr-af"><label>Observation</label><textarea data-a="obs" rows="3">${esc(obs)}</textarea></div>
      <div class="flr-af"><label>Action required</label><textarea data-a="act" rows="2">Please inspect the unit and confirm the corrective action.</textarea></div>
      <div style="display:flex;gap:10px"><div class="flr-af" style="flex:1"><label>Priority</label><select data-a="prio"><option>Normal</option><option${r.crit ? ' selected' : ''}>High</option><option>Low</option></select></div><div class="flr-af" style="flex:1"><label>Due date</label><input data-a="due" type="date" value="${due}"></div></div>
      <label class="flr-ck"><input type="checkbox" data-a="rem" checked> remember the recipients on this device</label><div class="flr-hint" id="flrActMsg"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="success" data-aa="send">📧 Send &amp; save as LM action</button><button type="button" class="secondary" data-aa="save">💾 Save action only</button><button type="button" class="secondary" data-aa="copy">📋 Copy formatted e-mail + open mail app</button><button type="button" class="ghost" data-aa="mailto">✉ Plain-text in mail app</button></div></div></div>`;
    document.body.appendChild(m);
    const val = k => (m.querySelector('[data-a="' + k + '"]') || {}).value || '', msg = (t, bad) => { const e = m.querySelector('#flrActMsg'); e.textContent = t; e.style.color = bad ? '#b91c1c' : ''; };
    const form = () => ({ to: val('to').trim(), cc: val('cc').trim(), subj: val('subj').trim(), obs: val('obs').trim(), act: val('act').trim(), prio: val('prio'), due: val('due') });
    async function keep(f, sent, how) {
      if (m.querySelector('[data-a="rem"]').checked) jset(CFG_K, { to: f.to, cc: f.cc });
      const row = { id: 'A' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), when: new Date().toISOString(), unit: r.unit, whs: whOf(r.uk), rectype: r.type, recdate: r.date, by: r.by, obs: f.obs, chg: r.d.first ? 'First record' : r.d.st, act: f.act, prio: f.prio, due: f.due, to: f.to, cc: f.cc, subj: f.subj, lm: (currentUser && (currentUser.displayName || currentUser.username)) || '', status: sent ? 'Sent to Fleet & HSE' : 'Open', recid: r.id, sent: !!sent, pushed: false };
      const L = jget(ACT_K, []); L.unshift(row); jset(ACT_K, L); let sp = '';
      try { if (typeof utReady === 'function' && utReady('flolm')) { await utPush('flolm', [row], x => x.unit); row.pushed = true; jset(ACT_K, L); sp = ' · saved to SharePoint'; } else sp = ' · saved on this device (link a SharePoint list in Upload Destinations → Forklift LM actions)'; } catch (e) { sp = ' · SharePoint save failed (' + e.message + ') — retry from the "LM actions" tab'; }
      msg('✔ ' + how + sp); try { say('✔ LM action recorded for ' + r.unit); } catch (e) {} setTimeout(() => { m.remove(); if (S.tab === 'act') render(); }, 1600);
    }
    m.addEventListener('click', async e => {
      if (e.target === m || e.target.closest('[data-x]')) return m.remove(); const b = e.target.closest('[data-aa]'); if (!b) return; const a = b.dataset.aa, f = form();
      if (!f.act) return msg('Write the action required.', 1); if ((a !== 'save') && !f.to) return msg('Enter the Fleet & HSE e-mail address(es) in "To".', 1);
      if (a === 'mailto') { const txt = mailTxt(r, f); location.href = 'mailto:' + encodeURIComponent(f.to.replace(/\s*;\s*/g, ',')) + '?cc=' + encodeURIComponent(f.cc.replace(/\s*;\s*/g, ',')) + '&subject=' + encodeURIComponent(f.subj) + '&body=' + encodeURIComponent(txt.slice(0, 1800)); return keep(f, true, 'Mail app opened (plain-text version — use "Copy formatted e-mail" for the full layout)'); }
      if (a === 'copy') { const html = mailHtml(r, f); try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([mailTxt(r, f)], { type: 'text/plain' }) })]); } catch (err) { return msg('⚠ The browser blocked copying: ' + err.message, 1); } location.href = 'mailto:' + encodeURIComponent(f.to.replace(/\s*;\s*/g, ',')) + '?cc=' + encodeURIComponent(f.cc.replace(/\s*;\s*/g, ',')) + '&subject=' + encodeURIComponent(f.subj); return keep(f, true, 'Formatted e-mail copied — paste it (Ctrl+V) into the new mail'); }
      b.disabled = true; try { let how = 'Action saved'; if (a === 'send') { msg('Sending…'); const res = await mailSend_send({ to: f.to, cc: f.cc, subject: f.subj, html: mailHtml(r, f) }); how = 'E-mail ' + res + ' · action saved'; } await keep(f, a === 'send', how); } catch (err) { msg('⚠ ' + err.message + ' — you can still use "Save action only" or the mail-app buttons.', 1); b.disabled = false; }
    });
  }
  function actions() {
    const L = jget(ACT_K, []).filter(a => !S.f.unit || String(a.unit).toUpperCase() === S.f.unit).filter(a => !S.f.whs || a.whs === S.f.whs);
    return `<div class="flr-hint">Line-manager actions raised from this page (click a record → <b>📧 Take action</b>). They are e-mailed to the Fleet &amp; HSE team and kept here${typeof utReady === 'function' && utReady('flolm') ? ' and in the linked SharePoint list' : ' — link a SharePoint list in <b>Upload Destinations → Forklift LM actions</b> to store them centrally'}.</div><div class="flr-wrap"><table class="flr-t"><thead><tr><th>Raised</th><th>Unit</th><th>Warehouse</th><th>Record</th><th>Observation</th><th>Action required</th><th>Priority</th><th>Due</th><th>Sent to</th><th>Taken by</th><th>Status</th><th>SharePoint</th><th></th></tr></thead><tbody>
      ${L.map(a => `<tr data-rid="${a.recid}" style="cursor:pointer"><td>${esc(dmy(String(a.when).slice(0, 10)))} ${esc(tm0(new Date(a.when).getTime()))}</td><td><b>${esc(a.unit)}</b></td><td>${esc(a.whs)}</td><td>${esc(a.rectype)} · ${esc(dmy(a.recdate))}</td><td>${esc(a.obs)}</td><td>${esc(a.act)}</td><td>${esc(a.prio)}</td><td>${esc(dmy(a.due))}</td><td>${esc(a.to)}</td><td>${esc(a.lm)}</td><td><span class="flr-p ${a.status === 'Closed' ? 'g' : 'o'}">${esc(a.status)}</span></td><td>${a.pushed ? '✔' : '<span class="flr-p n">pending</span>'}</td><td style="white-space:nowrap"><button type="button" class="ghost small" data-ac="done" data-id="${a.id}">${a.status === 'Closed' ? '↺ Reopen' : '✓ Close'}</button>${a.pushed ? '' : ' <button type="button" class="ghost small" data-ac="push" data-id="${a.id}">⬆ Save to SharePoint</button>'}</td></tr>`).join('') || '<tr><td colspan="13" style="text-align:center;padding:16px">No LM actions yet.</td></tr>'}</tbody></table></div>`;
  }
  async function actClick(b) {
    const L = jget(ACT_K, []), a = L.find(x => x.id === b.dataset.id); if (!a) return;
    if (b.dataset.ac === 'done') { a.status = a.status === 'Closed' ? 'Open' : 'Closed'; jset(ACT_K, L); render(); return; }
    try { await utPush('flolm', [a], x => x.unit); a.pushed = true; jset(ACT_K, L); say('✔ saved to SharePoint'); } catch (e) { say('⚠ ' + e.message, 1); } render();
  }
  function log() {
    const R = sel().slice().sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts || b.id - a.id), ok = v => v === true ? '✓' : v === false ? '<b style="color:#b91c1c">✗</b>' : '';
    return `<div class="flr-wrap"><table class="flr-t"><thead><tr><th>Date</th><th>Unit</th><th>Warehouse</th><th>Type</th><th>By</th><th class="c">ODO</th><th class="c">Prev ODO</th><th class="c">KM</th>${TG.map(x => `<th class="c">${esc(x[1])}</th>`).join('')}<th class="c">Checklist</th><th>NOT OK points</th><th class="c">Scratches F/R/L/Rt</th><th>Condition</th><th>Change</th><th>Approval</th><th>Note</th></tr></thead><tbody>
      ${R.map(r => `<tr${r.n ? ' class="hr"' : ''} data-rid="${r.id}" style="cursor:pointer"><td>${esc(dmy(r.date))}</td><td><b>${esc(r.unit)}</b></td><td>${esc(whOf(r.uk))}</td><td>${esc(r.type)}</td><td>${esc(r.by)}</td><td class="c">${r.odo || ''}</td><td class="c">${r.prv || ''}</td><td class="c">${r.km || ''}</td>${TG.map(x => `<td class="c">${ok(r.tg[x[0]])}</td>`).join('')}<td class="c">${r.tot ? r.ok + '/' + r.tot : ''}</td><td>${esc(r.nok.join('; '))}</td><td class="c">${r.scN ? [r.sc.f, r.sc.r, r.sc.l, r.sc.t].join('/') : ''}</td><td>${pill(r.cond)}</td><td>${chg(r.d)}</td><td>${esc(r.appr)}</td><td>${esc(r.note)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function render() {
    const v = Q('#flrBody'); if (!v) return; const U = rpUI, us = units();
    v.innerHTML = `<div class="rp-f">${U.fi('From', `<input type="date" data-f="from" value="${S.f.from}">`)}${U.fi('To', `<input type="date" data-f="to" value="${S.f.to}">`)}${U.fi('Type', `<select data-f="type"><option value="">Received + parked</option><option value="R"${S.f.type === 'R' ? ' selected' : ''}>Received only</option><option value="P"${S.f.type === 'P' ? ' selected' : ''}>Parked only</option></select>`)}${U.fi('Warehouse', `<select data-f="whs"><option value="">All warehouses</option>${whsList().map(w => `<option${w === S.f.whs ? ' selected' : ''}>${esc(w)}</option>`).join('')}</select>`)}${U.fi('Unit', `<select data-f="unit"><option value="">All units</option>${us.map(u => `<option${u === S.f.unit ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select>`)}${U.fi('Search', `<input type="search" data-f="q" placeholder="Unit / user…" value="${esc(S.f.q)}">`)}
      <label class="rp-ck"><input type="checkbox" data-f="onlyIssue"${S.f.onlyIssue ? ' checked' : ''}> records with issues / worse only</label><span class="rp-sp"></span>${U.grp('<button class="secondary small" type="button" data-fl="per" data-d="7">7 days</button><button class="secondary small" type="button" data-fl="per" data-d="30">30 days</button><button class="secondary small" type="button" data-fl="per" data-d="90">90 days</button>')}<button class="success small" type="button" data-fl="digest" title="E-mail the observations of a day (all, selected or one) to Fleet &amp; HSE" style="margin-bottom:2px">📧 Email observations</button></div>
      ${locHint()}${S.loaded ? kpis(sel()) : ''}
      ${U.tabbar([['sum', '📋 Unit summary'], ['chg', '🔄 Changes vs previous'], ['mx', '📊 Dates × units'], ['mxT', '📊 Units × dates'], ['act', '📌 LM actions'], ['miss', '🚫 Not received / parked'], ['log', '🧾 Receiving log']].map(([k, t]) => `<button type="button" class="${S.tab === k ? 'active on' : ''}" data-t="${k}">${t}</button>`).join(''), 'data-fl', '#flrBody')}
      ${S.loading && !S.loaded ? '<div class="flr-hint">Reading…</div>' : !S.loaded ? `<div class="flr-hint">${S.err ? '⚠ ' + esc(S.err) : 'Press 🔄 Reload to read the receiving records.'}</div>` : S.tab === 'sum' ? summary() : S.tab === 'chg' ? changes() : S.tab === 'mx' ? matrix() : S.tab === 'mxT' ? matrixT() : S.tab === 'miss' ? missing() : S.tab === 'act' ? actions() : log()}`;
  }
  function rep() { const T = { sum: 'Forklift receiving — unit summary', chg: 'Forklift receiving — changes vs previous inspection', mx: 'Forklift receiving — dates × units', mxT: 'Forklift receiving — units × dates', act: 'Forklift receiving — LM actions', miss: 'Forklift receiving — units without receive / park on ' + dmy(S.day), log: 'Forklift receiving log' }[S.tab];
    const note = [dmy(S.f.from) + ' – ' + dmy(S.f.to), S.f.type === 'R' ? 'received only' : S.f.type === 'P' ? 'parked only' : '', S.f.whs && 'Warehouse ' + S.f.whs, S.f.unit && 'Unit ' + S.f.unit, S.f.onlyIssue && 'issues only', 'Printed ' + new Date().toLocaleString()].filter(Boolean).join(' · ');
    return tblReport(Q('#flrBody table.flr-t'), T, note, T.replace(/^Forklift /, '')); }
  window.flrCss = () => { if (window._flrCss) return; window._flrCss = 1;
    const c2 = document.createElement('style'); c2.textContent = `#flrPop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px}#flrPop .flr-pc{background:var(--card,#fff);color:inherit;border-radius:14px;max-width:980px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.4)}#flrPop .flr-ph{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border);font-size:15px}#flrPop .flr-pb{overflow:auto;padding:12px 16px}#flrPop .flr-pair{margin-bottom:18px}#flrPop .flr-chg{margin-bottom:8px;font-size:13px}#flrPop .flr-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}#flrPop .flr-cd{border:1px solid var(--border);border-radius:12px;padding:10px 12px;min-width:0}#flrPop .flr-cd h4{margin:0 0 4px;font-size:13px}#flrPop .flr-sub{font-size:12px;margin-bottom:6px}#flrPop table.flr-dt{width:100%;border-collapse:collapse;font-size:12px}#flrPop .flr-dt td{padding:4px 6px;border-top:1px solid var(--border);vertical-align:top}#flrPop .flr-dt td:first-child{color:var(--gray-600);white-space:nowrap;width:1%}#flrPop .flr-dt tr.dd td{background:#fee2e2;color:#7f1d1d}#flrPop .flr-hint{font-size:12px;color:var(--gray-600)}#flrPop .flr-p{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;font-weight:700}#flrPop .flr-p.g{background:#dcfce7;color:#166534}#flrPop .flr-p.o{background:#fef3c7;color:#92400e}#flrPop .flr-p.r{background:#fee2e2;color:#991b1b}#flrPop .flr-p.n{background:#e5e7eb;color:#374151}@media(max-width:720px){#flrPop .flr-cols{grid-template-columns:1fr}}#flrPop .flr-chg,#flrAct .flr-af{display:flex}#flrPop .flr-chg{align-items:center;gap:6px;flex-wrap:wrap}#flrAct{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px}#flrAct .flr-pc{background:var(--card,#fff);color:inherit;border-radius:14px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.4)}#flrAct .flr-ph{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border)}#flrAct .flr-pb{overflow:auto;padding:12px 16px}#flrAct .flr-af{flex-direction:column;gap:3px;margin-bottom:8px}#flrAct .flr-af label,#flrAct .flr-ck{font-size:12px;color:var(--gray-600)}#flrAct input[type=text],#flrAct input[type=date],#flrAct textarea,#flrAct select{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--border);border-radius:8px;background:var(--card,#fff);color:inherit;font:inherit}#flrAct .flr-hint{font-size:12px;margin-top:6px}`; document.head.appendChild(c2);
    const css = document.createElement('style'); css.textContent = `:is(#view-flr,#view-fla) .flr-hint{font-size:12px;color:var(--gray-600);margin:6px 0}:is(#view-flr,#view-fla) .flr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}:is(#view-flr,#view-fla) .flr-k{border:1px solid var(--border);border-radius:12px;padding:8px 14px}:is(#view-flr,#view-fla) .flr-k span{font-size:12px;color:var(--gray-600);display:block}:is(#view-flr,#view-fla) .flr-k b{font-size:20px}:is(#view-flr,#view-fla) .flr-k small{display:block;font-size:11px;color:var(--gray-600)}
:is(#view-flr,#view-fla) .flr-wrap{overflow:auto;max-height:70vh;border:1px solid var(--border);border-radius:12px}:is(#view-flr,#view-fla) table.flr-t{border-collapse:collapse;font-size:12px;width:100%}:is(#view-flr,#view-fla) .flr-t th{background:var(--brand-light,#eef2fb);padding:7px 6px;text-align:left;white-space:nowrap;position:sticky;top:0;z-index:2}:is(#view-flr,#view-fla) .flr-t td{padding:6px;border-top:1px solid var(--border);vertical-align:top}:is(#view-flr,#view-fla) .flr-t .c{text-align:center}:is(#view-flr,#view-fla) tr.hr td{background:rgba(254,226,226,.45)}
:is(#view-flr,#view-fla) .flr-p{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;font-weight:700;white-space:nowrap}:is(#view-flr,#view-fla) .flr-p.g{background:#dcfce7;color:#166534}:is(#view-flr,#view-fla) .flr-p.o{background:#fef3c7;color:#92400e}:is(#view-flr,#view-fla) .flr-p.r{background:#fee2e2;color:#991b1b}:is(#view-flr,#view-fla) .flr-p.n{background:#e5e7eb;color:#374151}
:is(#view-flr,#view-fla) .flr-mx td{text-align:center;min-width:54px}:is(#view-flr,#view-fla) .flr-mx th{text-align:center}:is(#view-flr,#view-fla) .flr-mx .st{position:sticky;left:0;background:var(--card,#fff);text-align:left;z-index:1;min-width:110px}:is(#view-flr,#view-fla) .flr-mx thead .st{z-index:3;background:var(--brand-light,#eef2fb)}:is(#view-flr,#view-fla) .flr-mx td.ok{color:#15803d}:is(#view-flr,#view-fla) .flr-mx td.h1{background:#fed7aa;color:#9a3412;font-weight:700}:is(#view-flr,#view-fla) .flr-mx td.h2{background:#fecaca;color:#991b1b;font-weight:700}
body.dark :is(#view-flr,#view-fla) .flr-mx .st{background:var(--card)}body.dark :is(#view-flr,#view-fla) .flr-mx td.h1,body.dark :is(#view-flr,#view-fla) .flr-mx td.h2{color:#111}`; document.head.appendChild(css);
  };
  function openDigest() {
    if (!window.LMX || !S.loaded) return say('Press 🔄 Reload first.', 1); const X = LMX_(), bs = r => whOf(r.uk);
    X.digest({ kicker: 'FORKLIFT OBSERVATIONS · ACTION REQUIRED', head: 'Forklift observations', kind: 'Forklift', source: 'Forklift Receiving', where: S.f.whs || 'all warehouses', act: 'Please inspect the units listed, confirm the corrective action for each one and the date it will be completed.', store: ACT_K, dest: 'flolm', done: () => { if (S.tab === 'act') render(); },
      range: () => dmy(S.f.from) + ' – ' + dmy(S.f.to), days: () => [...new Set(sel().map(r => r.date))].sort().reverse(),
      items: (day, ok) => sel().filter(r => (day === '__all__' || r.date === day) && (ok || r.n > 0 || r.d.st === 'Worse')).sort((a, b) => ({ Critical: 0, Watch: 1, Good: 2 }[a.cond] - { Critical: 0, Watch: 1, Good: 2 }[b.cond]) || b.date.localeCompare(a.date) || a.unit.localeCompare(b.unit, undefined, { numeric: true })).map(r => {
        const d = r.d, iss = issList(r), ch = d.first ? ['First record for this unit'] : [].concat(d.news.map(x => 'New: ' + x), d.scUp.map(x => 'Scratches: ' + x), d.gone.map(x => 'Fixed: ' + x), d.odo);
        return { id: r.id, key: r.unit, sub: [bs(r), r.type, dmy(r.date) + ' ' + tm0(r.ts), r.by].filter(Boolean).join(' · '), sev: r.cond, issue: r.n > 0 || d.st === 'Worse', line: (r.n ? issTxt(r) : 'No issue ticked') + (d.first ? '' : ' | ' + (chgTxt(d) || d.st)),
          card: (iss.length ? X.ul(iss, '#dc2626') : '<div style="font-size:14px;color:#334155">No defect ticked by the user.</div>') + X.sub('Change vs the previous inspection' + (r.prev ? ' (' + dmy(r.prev.date) + ')' : ''), d.st === 'Worse' ? ['#b91c1c', '#dc2626'] : ['#334155', '#64748b'], ch.length ? ch : ['No change']) + (r.note ? `<div style="border-left:3px solid #94a3b8;padding:6px 12px;font-size:14px;color:#334155;font-style:italic;background:#f8fafc;margin:8px 0">${esc(r.note)}</div>` : '') + X.kv([['Reported by', r.by], ['Odometer', r.odo ? r.odo + (r.km ? ' (' + r.km + ' km since previous)' : '') : ''], ['Daily checklist', r.tot ? r.ok + ' of ' + r.tot + ' OK' + (r.na ? ' · ' + r.na + ' N/A' : '') : '']]),
          txt: [], row: f => ({ unit: r.unit, whs: whOf(r.uk), rectype: r.type, recdate: r.date, by: r.by, chg: d.first ? 'First record' : d.st, recid: r.id }) }; }) });
  }
  const LMX_ = () => window.LMX;
  function init() {
    const v = Q('#view-flr'); if (!v || v._i) return; v._i = 1;
    v.addEventListener('click', e => { const ac = e.target.closest('[data-ac]'); if (ac) return actClick(ac); const rc = e.target.closest('[data-rid]'); if (rc && !e.target.closest('button,input,select')) return showRec(rc.dataset.rid); const t = e.target.closest('[data-t],[data-fl]'); if (!t) return; if (t.dataset.t) { S.tab = t.dataset.t; return render(); } const a = t.dataset.fl;
      if (a === 'digest') return openDigest(); if (a === 'expand') { const tb = Q('#flrBody table.flr-t'); if (tb && window.tableExpandOpen) tableExpandOpen(tb); return; } if (a === 'print' || a === 'excel' || a === 'mail') { const d = rep(); if (a === 'print') a2Print(d); else if (a === 'excel') a2Export(d); else a2Mail(rep); return; }
      if (a === 'reload') load(true); else if (a === 'per') { S.f.to = ymd(new Date()); S.f.from = ymd(dShift(new Date(), -+t.dataset.d)); render(); } });
    v.addEventListener('change', e => { const el = e.target, sk = el.dataset.s; if (sk) { S[sk] = el.value; return render(); } const k = el.dataset.f; if (!k) return; S.f[k] = el.type === 'checkbox' ? el.checked : el.value; render(); });
    v.addEventListener('input', e => { const el = e.target; if (el.dataset.f === 'q') { S.f.q = el.value.trim(); clearTimeout(S.tm); S.tm = setTimeout(() => { render(); const i = Q('#flrBody [data-f=q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 350); } });
    window.flrCss();
    render();
  }
  const nav = Q('.nav-item[data-view="flr"]'); if (nav) nav.addEventListener('click', () => { init(); setTimeout(() => load(false), 50); });
  const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (activeViewId() === 'flr') { e.stopImmediatePropagation(); load(true); } }, true);
  window.FLR = { S, load, render, showRec, locHint, scoped, mailHtml, mailTxt, openDigest };
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
      if (window.FLR && FLR.scoped() && FLR.S.mstOk) { const own = new Set(FLR.S.mst.map(m => m.uk)); S.rows = S.rows.filter(r => own.has(r.uk)); }
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
      ${window.FLR ? FLR.locHint() : ''}${S.loaded ? kpis(sel()) : ''}
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

/* ============================================================
   LMX — shared "Take action" flow: formatted e-mail to Fleet & HSE + the action saved as an LM action (used by Rack Hits & Damages)
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), e = escapeHtml, CFG_K = LS_BASE + '_flr_mailcfg';
  const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (x) { return d; } }, jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) {} };
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dmy = s => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return d + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y; };
  const ul = (L, col) => L.length ? `<table cellpadding="0" cellspacing="0" style="width:100%">${L.map(x => `<tr><td style="width:20px;vertical-align:top;padding:3px 8px 3px 0;color:${col};font-size:12px">●</td><td style="padding:3px 0;font-size:14px;color:#0f172a">${e(x)}</td></tr>`).join('')}</table>` : '';
  const kv = L => `<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px">${L.filter(x => x[1]).map(x => `<tr><td style="padding:5px 0;color:#64748b;width:140px;vertical-align:top">${e(x[0])}</td><td style="padding:5px 0;color:#0f172a;font-weight:600">${e(x[1])}</td></tr>`).join('')}</table>`;
  const sub = (t, col, L) => L && L.length ? `<div style="font-size:13px;font-weight:700;color:${col[0]};margin:8px 0 4px">${e(t)}</div>${ul(L, col[1])}` : '';
  /* o: { kicker, title, sub, chips:[[text,[fg,bg]]], sections:[[title, html]], action, prio, due, who } */
  function html(o, f) {
    const TM = e(o.team || 'Fleet & HSE');
    const pr = { High: ['#b91c1c', '#fee2e2'], Normal: ['#92400e', '#fef3c7'], Low: ['#166534', '#dcfce7'] }[f.prio] || ['#334155', '#e2e8f0'], chip = (t, c) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;color:${c[0]};background:${c[1]}">${e(t)}</span>`;
    const sec = (t, h) => `<tr><td style="padding:18px 28px 0"><div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px">${e(t)}</div>${h}</td></tr>`;
    return `<div style="background:#f1f5f9;padding:24px 8px;font-family:Segoe UI,Calibri,Arial,sans-serif"><table cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <tr><td style="background:#16346b;padding:22px 28px"><div style="font-size:11px;letter-spacing:1.6px;color:#93b4ff;font-weight:700">${e(o.kicker)}</div><div style="font-size:24px;color:#ffffff;font-weight:700;margin-top:6px">${e(o.title)}</div><div style="font-size:13px;color:#cbd5e1;margin-top:4px">${e(o.sub)}</div></td></tr>
      <tr><td style="padding:18px 28px 0">${(o.chips || []).map(c => chip(c[0], c[1])).join('')}${chip('Priority: ' + f.prio, pr)}${f.due ? chip('Due ' + dmy(f.due), ['#1e3a8a', '#dbeafe']) : ''}</td></tr>
      ${(o.sections || []).filter(x => x && x[1]).map(x => sec(x[0], x[1])).join('')}
      <tr><td style="padding:20px 28px 0"><table cellpadding="0" cellspacing="0" style="width:100%;background:#eff6ff;border-left:4px solid #2563eb;border-radius:6px"><tr><td style="padding:14px 18px"><div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;font-weight:700">Action required from ${TM}</div><div style="font-size:15px;color:#0f172a;font-weight:600;margin-top:6px">${e(f.act).replace(/\n/g, '<br>')}</div><div style="font-size:12px;color:#475569;margin-top:8px">Priority <b>${e(f.prio)}</b>${f.due ? ' · please respond by <b>' + e(dmy(f.due)) + '</b>' : ''}</div></td></tr></table></td></tr>
      <tr><td style="padding:22px 28px 24px"><div style="font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:12px">Raised by <b>${e((currentUser && (currentUser.displayName || currentUser.username)) || '')}</b> (Line Manager) · ORBIT — ${e(o.source)} · ${e(new Date().toLocaleString())}<br>Please reply to this e-mail with the corrective action taken.</div></td></tr></table></div>`;
  }
  /* spec: { title, subj, obs, crit, store, dest, build: f => ({ o, txt }), row: f => object, done } */
  function form(spec) {
    if (window.flrCss) window.flrCss(); const TEAM = spec.team || 'Fleet & HSE', CK = spec.cfg || CFG_K, cfg = jget(CK, {}), me = (currentUser && currentUser.email) || '', lm = (currentUser && currentUser.managerEmail) || '';
    let m = Q('#flrAct'); if (m) m.remove(); m = document.createElement('div'); m.id = 'flrAct';
    m.innerHTML = `<div class="flr-pc" style="max-width:640px"><div class="flr-ph"><b>📧 Take action — ${e(spec.title)}</b><span style="flex:1"></span><button type="button" class="ghost small" data-x="1">✕</button></div><div class="flr-pb">
      <div class="flr-af"><label>To — ${e(TEAM)} team</label><input data-a="to" type="text" placeholder="fleet@…; hse@…" value="${e(cfg.to || '')}"></div><div class="flr-af"><label>Cc</label><input data-a="cc" type="text" value="${e(cfg.cc != null ? cfg.cc : [me, lm].filter(Boolean).join('; '))}"></div>
      <div class="flr-af"><label>Subject</label><input data-a="subj" type="text" value="${e(spec.subj)}"></div><div class="flr-af"><label>Observation</label><textarea data-a="obs" rows="3">${e(spec.obs)}</textarea></div>
      <div class="flr-af"><label>Action required</label><textarea data-a="act" rows="2">${e(spec.act || 'Please inspect and confirm the corrective action.')}</textarea></div>
      <div style="display:flex;gap:10px"><div class="flr-af" style="flex:1"><label>Priority</label><select data-a="prio"><option>Normal</option><option${spec.crit ? ' selected' : ''}>High</option><option>Low</option></select></div><div class="flr-af" style="flex:1"><label>Due date</label><input data-a="due" type="date" value="${ymd(new Date(Date.now() + 2 * 864e5))}"></div></div>
      <label class="flr-ck"><input type="checkbox" data-a="rem" checked> remember the recipients on this device</label><div class="flr-hint" id="flrActMsg"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="success" data-aa="send">📧 Send &amp; save as LM action</button><button type="button" class="secondary" data-aa="save">💾 Save action only</button><button type="button" class="secondary" data-aa="copy">📋 Copy formatted e-mail + open mail app</button><button type="button" class="ghost" data-aa="mailto">✉ Plain-text in mail app</button></div></div></div>`;
    document.body.appendChild(m);
    const val = k => (m.querySelector('[data-a="' + k + '"]') || {}).value || '', msg = (t, bad) => { const x = m.querySelector('#flrActMsg'); x.textContent = t; x.style.color = bad ? '#b91c1c' : ''; };
    const getF = () => ({ to: val('to').trim(), cc: val('cc').trim(), subj: val('subj').trim(), obs: val('obs').trim(), act: val('act').trim(), prio: val('prio'), due: val('due') });
    async function keep(f, sent, how) {
      if (m.querySelector('[data-a="rem"]').checked) jset(CK, { to: f.to, cc: f.cc });
      const row = Object.assign({ id: 'A' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), when: new Date().toISOString(), obs: f.obs, act: f.act, prio: f.prio, due: f.due, to: f.to, cc: f.cc, subj: f.subj, lm: (currentUser && (currentUser.displayName || currentUser.username)) || '', status: sent ? 'Sent to ' + TEAM : 'Open', sent: !!sent, pushed: false }, spec.row(f));
      const L = jget(spec.store, []); L.unshift(row); jset(spec.store, L); let sp = '';
      try { if (typeof utReady === 'function' && utReady(spec.dest)) { await utPush(spec.dest, [row], x => x.rack || x.unit); row.pushed = true; jset(spec.store, L); sp = ' · saved to SharePoint'; } else sp = ' · saved on this device (link a SharePoint list in Upload Destinations)'; } catch (x) { sp = ' · SharePoint save failed (' + x.message + ') — retry from the "LM actions" tab'; }
      msg('✔ ' + how + sp); setTimeout(() => { m.remove(); if (spec.done) spec.done(); }, 1600);
    }
    const mt = f => 'mailto:' + encodeURIComponent(f.to.replace(/\s*;\s*/g, ',')) + '?cc=' + encodeURIComponent(f.cc.replace(/\s*;\s*/g, ',')) + '&subject=' + encodeURIComponent(f.subj);
    m.addEventListener('click', async ev => {
      if (ev.target === m || ev.target.closest('[data-x]')) return m.remove(); const b = ev.target.closest('[data-aa]'); if (!b) return; const a = b.dataset.aa, f = getF(), B = spec.build(f);
      if (!f.act) return msg('Write the action required.', 1); if (a !== 'save' && !f.to) return msg('Enter the ' + TEAM + ' e-mail address(es) in "To".', 1);
      if (a === 'mailto') { location.href = mt(f) + '&body=' + encodeURIComponent(B.txt.slice(0, 1800)); return keep(f, true, 'Mail app opened (plain-text version)'); }
      if (a === 'copy') { const h = html(Object.assign({ team: spec.team }, B.o), f); try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([h], { type: 'text/html' }), 'text/plain': new Blob([B.txt], { type: 'text/plain' }) })]); } catch (x) { return msg('⚠ The browser blocked copying: ' + x.message, 1); } location.href = mt(f); return keep(f, true, 'Formatted e-mail copied — paste it (Ctrl+V) into the new mail'); }
      b.disabled = true; try { let how = 'Action saved'; if (a === 'send') { msg('Sending…'); const r = await mailSend_send({ to: f.to, cc: f.cc, subject: f.subj, html: html(Object.assign({ team: spec.team }, B.o), f) }); how = 'E-mail ' + r + ' · action saved'; } await keep(f, a === 'send', how); } catch (x) { msg('⚠ ' + x.message + ' — you can still use "Save action only" or the mail-app buttons.', 1); b.disabled = false; }
    });
  }
  /* spec: { kicker, head, kind, act, store, dest, range: () => 'dd mmm – dd mmm', days: () => [dates desc], items: (day|'__all__', withOk) => [{id,key,sub,sev,issue,line,card,txt,row:f=>obj}], done } */
  function digest(spec) {
    if (window.flrCss) window.flrCss(); const TEAM = spec.team || 'Fleet & HSE', CK = spec.cfg || CFG_K, cfg = jget(CK, {}), me = (currentUser && currentUser.email) || '', lm = (currentUser && currentUser.managerEmail) || '', days0 = () => spec.days(st.scope);
    const SCP = spec.scopes || null, st = { scope: SCP ? SCP[0].k : '', day: '', ok: false, sel: new Set(), edited: false }, SV = { Critical: ['#b91c1c', '#fee2e2', 'r'], Watch: ['#92400e', '#fef3c7', 'o'], Good: ['#166534', '#dcfce7', 'g'] };
    const sc = () => SCP ? SCP.find(x => x.k === st.scope) : {}, IT = () => spec.items(st.day, st.ok, st.scope), reset = () => { st.sel = new Set(IT().filter(i => i.issue).map(i => String(i.id))); };
    let m = Q('#flrAct'); if (m) m.remove(); m = document.createElement('div'); m.id = 'flrAct';
    m.innerHTML = `<div class="flr-pc" style="max-width:720px"><div class="flr-ph"><b>📧 Email observations — ${e(spec.kind)}</b><span style="flex:1"></span><button type="button" class="ghost small" data-x="1">✕</button></div><div class="flr-pb">
      ${SCP ? `<div class="flr-af"><label>Which observations</label><select data-d="scope">${SCP.map(x => `<option value="${x.k}">${e(x.label)}</option>`).join('')}</select></div>` : ''}<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><div class="flr-af" style="flex:1;min-width:170px" id="dgDay"><label>Day</label><select data-d="day"></select></div>
        <label class="flr-ck" style="margin-bottom:10px" id="dgOkL"><input type="checkbox" data-d="ok"> also list records with no issue</label></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:2px 0 6px"><button type="button" class="secondary small" data-dg="all">☑ Select all</button><button type="button" class="secondary small" data-dg="none">☐ None</button><button type="button" class="secondary small" data-dg="iss">⚠ Issues only</button><span class="flr-hint" id="dgCount" style="margin-left:auto"></span></div>
      <div id="dgList" style="border:1px solid var(--border);border-radius:10px;max-height:240px;overflow:auto;margin-bottom:10px"></div>
      <div class="flr-af"><label>To — ${e(TEAM)} team</label><input data-a="to" type="text" placeholder="fleet@…; hse@…" value="${e(cfg.to || '')}"></div><div class="flr-af"><label>Cc</label><input data-a="cc" type="text" value="${e(cfg.cc != null ? cfg.cc : [me, lm].filter(Boolean).join('; '))}"></div>
      <div class="flr-af"><label>Subject</label><input data-a="subj" type="text"></div><div class="flr-af"><label>Action required (applies to every selected observation)</label><textarea data-a="act" rows="2">${e(spec.act)}</textarea></div>
      <div style="display:flex;gap:10px"><div class="flr-af" style="flex:1"><label>Priority</label><select data-a="prio"><option>Normal</option><option>High</option><option>Low</option></select></div><div class="flr-af" style="flex:1"><label>Due date</label><input data-a="due" type="date" value="${ymd(new Date(Date.now() + 2 * 864e5))}"></div></div>
      <label class="flr-ck"><input type="checkbox" data-a="rem" checked> remember the recipients on this device</label><div class="flr-hint" id="flrActMsg"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="success" data-aa="send">📧 Send &amp; save as LM actions</button><button type="button" class="secondary" data-aa="save">💾 Save actions only</button><button type="button" class="secondary" data-aa="copy">📋 Copy formatted e-mail + open mail app</button><button type="button" class="ghost" data-aa="mailto">✉ Plain-text in mail app</button></div></div></div>`;
    document.body.appendChild(m);
    const $ = k => m.querySelector('[data-a="' + k + '"]'), val = k => ($(k) || {}).value || '', msg = (t, bad) => { const x = m.querySelector('#flrActMsg'); x.textContent = t; x.style.color = bad ? '#b91c1c' : ''; };
    const label = () => sc().nodate ? sc().title : st.day === '__all__' ? spec.range() : dmy(st.day), chosen = () => IT().filter(i => st.sel.has(String(i.id)));
    const cnt = (L, s) => L.filter(i => i.sev === s).length;
    function days() { const D = days0(), sel = m.querySelector('[data-d="day"]'); sel.innerHTML = '<option value="__all__">All days in the filtered period</option>' + D.map(d => `<option value="${d}">${e(dmy(d))}</option>`).join(''); if (st.day !== '__all__' && !D.includes(st.day)) st.day = D[0] || '__all__'; sel.value = st.day; m.querySelector('#dgDay').style.display = m.querySelector('#dgOkL').style.display = sc().nodate ? 'none' : ''; }
    function list() {
      const L = IT(), c = chosen(); m.querySelector('#dgList').innerHTML = L.length ? L.map(it => `<label style="display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border-top:1px solid var(--border);font-size:13px;cursor:pointer"><input type="checkbox" data-id="${e(it.id)}" style="width:auto;margin-top:3px"${st.sel.has(String(it.id)) ? ' checked' : ''}><span class="flr-p ${SV[it.sev][2]}" style="flex:none">${it.sev}</span><span style="min-width:0"><b>${e(it.key)}</b> <span style="color:var(--gray-600)">${e(it.sub)}</span><br>${e(it.line)}</span></label>`).join('').replace('border-top:1px solid var(--border);', '') : '<div class="flr-hint" style="padding:10px">No observations for this selection.</div>';
      m.querySelector('#dgCount').textContent = c.length + ' of ' + L.length + ' selected';
      if (!st.edited) { $('subj').value = c.length === 1 ? `⚠ ${spec.kind} observation | ${c[0].key} | ${label()}` : `⚠ ${spec.kind} ${sc().nodate ? 'damage' : 'observations'} | ${label()} | ${c.length} item(s)${cnt(c, 'Critical') ? ' | ' + cnt(c, 'Critical') + ' critical' : ''}`; }
      if (!st.prioSet) $('prio').value = cnt(c, 'Critical') ? 'High' : 'Normal';
    }
    function build(f) {
      const c = chosen(), o = { kicker: spec.kicker, title: spec.head + ' — ' + label(), sub: c.length + ' observation(s) · ' + (spec.where || ''), source: spec.source,
        chips: [[c.length + ' observation(s)', ['#334155', '#e2e8f0']]].concat(['Critical', 'Watch', 'Good'].filter(s => cnt(c, s)).map(s => [cnt(c, s) + ' ' + (s === 'Good' ? 'OK' : s), SV[s]])),
        sections: [['Summary', `<table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;border-collapse:collapse"><tr style="color:#64748b;text-align:left"><td style="padding:4px 6px 6px 0;width:28px">#</td><td style="padding:4px 6px 6px 0">${e(spec.kind)}</td><td style="padding:4px 6px 6px 0;width:84px">Condition</td><td style="padding:4px 0 6px 6px">Observation</td></tr>${c.map((it, i) => `<tr><td style="padding:6px 6px 6px 0;border-top:1px solid #e2e8f0;color:#64748b;vertical-align:top">${i + 1}</td><td style="padding:6px 6px 6px 0;border-top:1px solid #e2e8f0;font-weight:700;color:#0f172a;vertical-align:top">${e(it.key)}<div style="font-weight:400;font-size:11px;color:#64748b">${e(it.sub)}</div></td><td style="padding:6px 6px 6px 0;border-top:1px solid #e2e8f0;vertical-align:top"><span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;color:${SV[it.sev][0]};background:${SV[it.sev][1]}">${it.sev === 'Good' ? 'OK' : it.sev}</span></td><td style="padding:6px 0 6px 6px;border-top:1px solid #e2e8f0;color:#0f172a;vertical-align:top">${e(it.line)}</td></tr>`).join('')}</table>`]]
          .concat(c.map((it, i) => [(i + 1) + ' · ' + it.key + ' — details', `<div style="margin-bottom:6px"><span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;color:${SV[it.sev][0]};background:${SV[it.sev][1]}">${it.sev === 'Good' ? 'OK' : it.sev}</span> <span style="font-size:12px;color:#64748b">${e(it.sub)}</span></div>${it.card}`])) };
      const txt = [spec.kicker, '='.repeat(40), '', spec.head + ' — ' + label(), c.length + ' observation(s): ' + ['Critical', 'Watch', 'Good'].filter(s => cnt(c, s)).map(s => cnt(c, s) + ' ' + (s === 'Good' ? 'OK' : s)).join(' · '), ''].concat(...c.map((it, i) => [(i + 1) + '. ' + it.key + '  [' + (it.sev === 'Good' ? 'OK' : it.sev) + ']', '   ' + it.sub, '   ' + it.line, ''])).concat(['ACTION REQUIRED', '  ' + f.act.replace(/\n/g, '\n  '), '  Priority: ' + f.prio + (f.due ? '   ·   Respond by: ' + dmy(f.due) : ''), '', '—', 'Raised by ' + ((currentUser && (currentUser.displayName || currentUser.username)) || '') + ' (Line Manager) · ORBIT']).join('\n');
      return { o, txt };
    }
    async function keep(f, sent, how) {
      if ($('rem').checked) jset(CK, { to: f.to, cc: f.cc }); const c = chosen(), bid = 'B' + Date.now().toString(36), who = (currentUser && (currentUser.displayName || currentUser.username)) || '';
      const rows = c.map((it, i) => Object.assign({ id: 'A' + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 4), when: new Date().toISOString(), obs: it.line, act: f.act, prio: f.prio, due: f.due, to: f.to, cc: f.cc, subj: f.subj, lm: who, status: sent ? 'Sent to ' + TEAM : 'Open', sent: !!sent, pushed: false, batch: bid }, it.row(f)));
      const L = jget(spec.store, []); rows.slice().reverse().forEach(r => L.unshift(r)); jset(spec.store, L); let sp = '';
      try { if (typeof utReady === 'function' && utReady(spec.dest)) { await utPush(spec.dest, rows, x => x.rack || x.unit); rows.forEach(r => { r.pushed = true; }); jset(spec.store, L); sp = ' · saved to SharePoint'; } else sp = ' · saved on this device (link a SharePoint list in Upload Destinations)'; } catch (x) { sp = ' · SharePoint save failed (' + x.message + ') — retry from the "LM actions" tab'; }
      msg('✔ ' + how + ' · ' + rows.length + ' LM action(s)' + sp); setTimeout(() => { m.remove(); if (spec.done) spec.done(); }, 1800);
    }
    const mt = f => 'mailto:' + encodeURIComponent(f.to.replace(/\s*;\s*/g, ',')) + '?cc=' + encodeURIComponent(f.cc.replace(/\s*;\s*/g, ',')) + '&subject=' + encodeURIComponent(f.subj);
    m.addEventListener('change', ev => { const t = ev.target; if (t.dataset.d === 'scope') { st.scope = t.value; st.day = ''; st.edited = false; days(); reset(); list(); } else if (t.dataset.d === 'day') { st.day = t.value; reset(); list(); } else if (t.dataset.d === 'ok') { st.ok = t.checked; list(); } else if (t.dataset.id != null) { t.checked ? st.sel.add(String(t.dataset.id)) : st.sel.delete(String(t.dataset.id)); list(); } else if (t.dataset.a === 'prio') st.prioSet = 1; });
    m.addEventListener('input', ev => { if (ev.target.dataset.a === 'subj') st.edited = true; });
    m.addEventListener('click', async ev => {
      if (ev.target === m || ev.target.closest('[data-x]')) return m.remove(); const g = ev.target.closest('[data-dg]');
      if (g) { const L = IT(); st.sel = new Set(g.dataset.dg === 'all' ? L.map(i => String(i.id)) : g.dataset.dg === 'iss' ? L.filter(i => i.issue).map(i => String(i.id)) : []); return list(); }
      const b = ev.target.closest('[data-aa]'); if (!b) return; const a = b.dataset.aa, f = { to: val('to').trim(), cc: val('cc').trim(), subj: val('subj').trim(), act: val('act').trim(), prio: val('prio'), due: val('due') };
      if (!chosen().length) return msg('Tick at least one observation.', 1); if (!f.act) return msg('Write the action required.', 1); if (a !== 'save' && !f.to) return msg('Enter the ' + TEAM + ' e-mail address(es) in "To".', 1);
      const B = build(f);
      if (a === 'mailto') { location.href = mt(f) + '&body=' + encodeURIComponent(B.txt.slice(0, 1800)); return keep(f, true, 'Mail app opened (plain-text version' + (B.txt.length > 1800 ? ', shortened — use the formatted copy for the full list' : '') + ')'); }
      if (a === 'copy') { const h = html(Object.assign({ team: spec.team }, B.o), f); try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([h], { type: 'text/html' }), 'text/plain': new Blob([B.txt], { type: 'text/plain' }) })]); } catch (x) { return msg('⚠ The browser blocked copying: ' + x.message, 1); } location.href = mt(f); return keep(f, true, 'Formatted e-mail copied — paste it (Ctrl+V) into the new mail'); }
      b.disabled = true; try { let how = 'Actions saved'; if (a === 'send') { msg('Sending…'); const r = await mailSend_send({ to: f.to, cc: f.cc, subject: f.subj, html: html(Object.assign({ team: spec.team }, B.o), f) }); how = 'E-mail ' + r; } await keep(f, a === 'send', how); } catch (x) { msg('⚠ ' + x.message + ' — you can still use "Save actions only" or the mail-app buttons.', 1); b.disabled = false; }
    });
    days(); reset(); list();
  }
  window.LMX = { form, digest, html, ul, kv, sub, dmy, jget, jset };
})();
