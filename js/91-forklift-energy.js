/* ============================================================
   Forklift Energy dashboard — fuel · LPG · electric consumption of the forklifts
   Source: FLO_LGV_Usage_tbl (written by the mobile "Electric / LPG change" screen and the fuel screens)
   Tabs: dashboard · by unit · by period · records · exceptions
   ============================================================ */
(function () {
  'use strict';
  const Q = s => document.querySelector(s), esc = typeof escapeHtml === 'function' ? escapeHtml : s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), LIST = 'FLO_LGV_Usage_tbl';
  const nz = x => String(x || '').toLowerCase().replace(/_x[0-9a-f]{4}_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dmy = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return d + ' ' + MN[+m - 1] + ' ' + y; };
  const dShift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const f1 = n => { const r = Math.round(n * 10) / 10; return r.toLocaleString(undefined, { maximumFractionDigits: 1 }); };
  const ch = v => v && typeof v === 'object' ? String(v.Value || v.LookupValue || '') : String(v == null ? '' : v);
  const COL = { LPG: '#f59e0b', Fuel: '#ef4444', Electric: '#16a34a', Other: '#6366f1' }, ICON = { LPG: '🔥', Fuel: '⛽', Electric: '🔋', Other: '⚙' };
  const S = { rows: [], loaded: false, loading: false, err: '', tab: 'dash', winFrom: '', f: { from: ymd(dShift(new Date(), -90)), to: ymd(new Date()), whs: '', type: '', unit: '', q: '' } };
  const say = (t, w) => { const e = Q('#fleStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };
  const typeOf = raw => { const t = String(raw || '').toUpperCase(); return /ELEC|BATT|KWH/.test(t) ? 'Electric' : /LPG|GAS/.test(t) ? 'LPG' : /DIESEL|FUEL|PETROL|GASOLINE/.test(t) ? 'Fuel' : t ? 'Other' : ''; };

  function parse(it) {
    const f = it.fields || {}, K = {}; Object.keys(f).forEach(k => { K[nz(k)] = f[k]; });
    const g = (...ks) => { for (const k of ks) if (K[k] != null && K[k] !== '') return K[k]; return ''; };
    const unit = String(g('flcode', 'title')).trim(); if (!unit) return null;
    let date = ''; const dv = g('transdate'); if (dv) { const d = new Date(dv); if (!isNaN(d)) date = ymd(d); }
    const ts = g('timestamp') ? new Date(g('timestamp')).getTime() : 0; if (!date) date = ts ? ymd(new Date(ts)) : it.createdDateTime ? ymd(new Date(it.createdDateTime)) : '';
    const st = g('startexchanging') ? new Date(g('startexchanging')).getTime() : 0, en = g('endexchanging') ? new Date(g('endexchanging')).getTime() : 0;
    const raw = ch(g('energytype')).trim(), sb = num(g('startnroflbarline', 'startnrofbarline')), eb = num(g('endnrofbarline')), type = typeOf(raw) || '';
    const electric = type === 'Electric', kind = electric && !(eb > 0) ? 'start' : 'fill';
    return { id: +it.id || 0, uk: unit.toUpperCase(), unit, date, ts: isFinite(ts) ? ts : 0, user: String(g('username')).trim(), odo: num(g('flodo')), prv: num(g('prvsodo')), kms: num(g('totalkms')), qty: num(g('qty')), type, raw, uom: ch(g('energyuom')).trim(), cap: num(g('energyfulltankcapacity')), loc: ch(g('locationid')).trim(), h: st && en && en > st ? (en - st) / 36e5 : 0, sb, eb, rem: String(g('remarks')).trim(), kind };
  }
  const master = () => (window.FLR && FLR.S && FLR.S.mst) || [];
  const whOf = u => { const m = master().find(x => x.uk === u); return m ? m.whs : ''; }, whsList = () => [...new Set(master().map(m => m.whs).filter(Boolean))].sort();

  async function load(force) {
    if (S.loading || (S.loaded && !force)) return; S.loading = true; S.err = ''; say('Reading ' + LIST + '…');
    try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first (no token / Site URL)');
      const ids = await resolveIds(site, LIST, token), W = await fetchWindowItems(ids.siteId, ids.listId, token, 'TransDate', S.f.from, n => say('Reading ' + LIST + ' (from ' + S.f.from + ')… ' + n)); S.winFrom = W.win;
      S.rows = W.items.map(parse).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts || a.id - b.id);
      try { if (window.FLR) await FLR.load(false); } catch (e) {}
      if (window.FLR && FLR.scoped && FLR.scoped() && FLR.S.mstOk) { const own = new Set(FLR.S.mst.map(m => m.uk)); S.rows = S.rows.filter(r => own.has(r.uk)); }
      /* ODO step of each unit against its previous record (for the exceptions) */
      const last = new Map(); S.rows.forEach(r => { r.pr = last.get(r.uk) || null; last.set(r.uk, r); });
      S.loaded = true; say('✔ ' + S.rows.length + ' energy record(s) read · ' + new Date().toLocaleTimeString());
    } catch (e) { S.err = e.message; say('⚠ ' + e.message, 1); } finally { S.loading = false; } render();
  }
  const sel = () => S.rows.filter(r => r.date >= S.f.from && r.date <= S.f.to && (!S.f.whs || whOf(r.uk) === S.f.whs) && (!S.f.type || r.type === S.f.type) && (!S.f.unit || r.uk === S.f.unit) && (!S.f.q || (r.uk + ' ' + r.user + ' ' + r.rem + ' ' + r.raw).toUpperCase().includes(S.f.q.toUpperCase())));
  const fills = R => R.filter(r => r.kind === 'fill' && r.qty > 0);
  const types = R => [...new Set(R.map(r => r.type || 'Other'))].sort((a, b) => ['Fuel', 'LPG', 'Electric', 'Other'].indexOf(a) - ['Fuel', 'LPG', 'Electric', 'Other'].indexOf(b));
  const uomOf = (R, t) => { const m = new Map(); R.filter(r => (r.type || 'Other') === t && r.uom).forEach(r => m.set(r.uom, (m.get(r.uom) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || (t === 'Electric' ? 'kWh' : t === 'LPG' ? 'cyl.' : t === 'Fuel' ? 'L' : ''); };

  /* ---------- charts (inline SVG) ---------- */
  function bars(items, color, w, h) { /* items: [[label, value]] */
    w = w || 520; h = h || 150; if (!items.length) return '<div class="fle-hint">No data.</div>'; const mx = Math.max(...items.map(x => x[1]), 1), bw = Math.max(4, Math.min(38, (w - 30) / items.length - 4)), step = (w - 30) / items.length;
    return `<svg viewBox="0 0 ${w} ${h + 26}" class="fle-svg">${items.map((x, i) => { const bh = Math.round(x[1] / mx * (h - 18)), X = 24 + i * step + (step - bw) / 2; return `<g><title>${esc(x[0])}: ${f1(x[1])}</title><rect x="${X}" y="${h - bh}" width="${bw}" height="${bh}" rx="3" fill="${color}"/>${items.length <= 16 || i % Math.ceil(items.length / 16) === 0 ? `<text x="${X + bw / 2}" y="${h + 12}" text-anchor="middle" font-size="9" fill="currentColor">${esc(x[0])}</text>` : ''}${items.length <= 18 ? `<text x="${X + bw / 2}" y="${h - bh - 3}" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor">${x[1] ? f1(x[1]) : ''}</text>` : ''}</g>`; }).join('')}</svg>`;
  }
  function hbars(items, color) { if (!items.length) return '<div class="fle-hint">No data.</div>'; const mx = Math.max(...items.map(x => x[1]), 1); return items.map(x => `<div class="fle-hb"><span title="${esc(x[0])}">${esc(x[0])}</span><i><u style="width:${Math.max(2, x[1] / mx * 100)}%;background:${color}"></u></i><b>${f1(x[1])}</b></div>`).join(''); }
  function donut(parts) { const tot = parts.reduce((a, p) => a + p[1], 0); if (!tot) return '<div class="fle-hint">No data.</div>'; let a0 = -Math.PI / 2; const r = 46, c = 60, seg = parts.map(p => { const a1 = a0 + p[1] / tot * 2 * Math.PI, big = a1 - a0 > Math.PI ? 1 : 0, d = p[1] === tot ? `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - .01} ${c - r}` : `M ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 ${big} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)}`; a0 = a1; return `<path d="${d}" fill="none" stroke="${p[2]}" stroke-width="22"><title>${esc(p[0])}: ${p[1]}</title></path>`; }).join('');
    return `<div class="fle-dn"><svg viewBox="0 0 120 120" width="130" height="130">${seg}<text x="60" y="64" text-anchor="middle" font-size="16" font-weight="800" fill="currentColor">${tot}</text></svg><div>${parts.map(p => `<div><i style="background:${p[2]}"></i>${esc(p[0])} <b>${p[1]}</b> <small>(${Math.round(p[1] / tot * 100)}%)</small></div>`).join('')}</div></div>`; }
  const daily = () => (new Date(S.f.to) - new Date(S.f.from)) / 864e5 <= 62;
  const bucket = d => daily() ? d.slice(5) : d.slice(0, 7);
  function series(R) { const m = new Map(); R.forEach(r => { const k = bucket(r.date); m.set(k, (m.get(k) || 0) + r.qty); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [daily() ? k.slice(3) + '/' + k.slice(0, 2) : MN[+k.slice(5) - 1] + ' ' + k.slice(2, 4), v]); }

  /* ---------- sections ---------- */
  function kpis(R) {
    const F = fills(R), T = types(F), K = (t, v, s, c) => `<div class="fle-k"${c ? ` style="border-top:3px solid ${c}"` : ''}><span>${t}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
    return `<div class="fle-kpis">${K('Energy records', R.length, F.length + ' consumption · ' + (R.length - F.length) + ' charge-start')}${T.map(t => { const x = F.filter(r => (r.type || 'Other') === t); return K(ICON[t] + ' ' + (t === 'Fuel' ? 'Fuel / diesel' : t), f1(x.reduce((a, r) => a + r.qty, 0)) + ' <small style="display:inline">' + esc(uomOf(F, t)) + '</small>', x.length + ' fills · ' + new Set(x.map(r => r.uk)).size + ' units', COL[t]); }).join('')}${K('Forklifts', new Set(R.map(r => r.uk)).size, master().length ? 'of ' + master().length + ' in the unit list' : '')}${K('Distance', f1(R.reduce((a, r) => a + Math.max(0, r.kms), 0)) + ' <small style="display:inline">km</small>', 'from ODO readings')}</div>`;
  }
  function dash(R) {
    const F = fills(R), T = types(F); if (!F.length) return '<div class="fle-hint">No consumption records for this selection.</div>';
    const mix = donut(T.map(t => [(t === 'Fuel' ? 'Fuel / diesel' : t), F.filter(r => (r.type || 'Other') === t).length, COL[t]]));
    return `<div class="fle-grid"><div class="fle-c"><h4>Fills by energy type</h4>${mix}</div>${T.map(t => { const x = F.filter(r => (r.type || 'Other') === t), u = uomOf(F, t), byU = new Map(); x.forEach(r => byU.set(r.uk, (byU.get(r.uk) || 0) + r.qty)); const top = [...byU.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      return `<div class="fle-c wide"><h4>${ICON[t]} ${t === 'Fuel' ? 'Fuel / diesel' : t} — ${daily() ? 'daily' : 'monthly'} consumption <small>(${esc(u)})</small></h4>${bars(series(x), COL[t])}<h5>Top forklifts (${esc(u)})</h5>${hbars(top, COL[t])}</div>`; }).join('')}</div>`;
  }
  function unitRows(R) {
    const m = new Map(); R.forEach(r => { let x = m.get(r.uk); if (!x) m.set(r.uk, x = { uk: r.uk, unit: r.unit, type: r.type, uom: '', n: 0, q: 0, kms: 0, o0: 0, o1: 0, last: '', days: [], cap: 0, ch: 0 }); x.type = x.type || r.type; if (r.uom) x.uom = r.uom; if (r.kind === 'start') { x.ch++; return; } if (!(r.qty > 0)) return; x.n++; x.q += r.qty; x.kms += Math.max(0, r.kms); x.cap = Math.max(x.cap, r.cap); if (r.odo) { if (!x.o0 || r.odo < x.o0) x.o0 = r.odo; if (r.odo > x.o1) x.o1 = r.odo; } x.days.push(r.date); if (r.date > x.last) x.last = r.date; });
    return [...m.values()].map(x => { const d = [...new Set(x.days)].sort(); let gap = 0; for (let i = 1; i < d.length; i++) gap += (new Date(d[i]) - new Date(d[i - 1])) / 864e5; x.gap = d.length > 1 ? gap / (d.length - 1) : 0; x.span = x.o1 - x.o0; const k = x.kms || x.span; x.per100 = k > 0 ? x.q / k * 100 : 0; x.avg = x.n ? x.q / x.n : 0; return x; }).sort((a, b) => b.q - a.q);
  }
  function byUnit(R) { const L = unitRows(R);
    return `<div class="fle-wrap"><table class="fle-t"><thead><tr><th>Forklift</th><th>Warehouse</th><th>Energy</th><th class="c">Fills</th><th class="c">Total</th><th>UOM</th><th class="c">Avg / fill</th><th class="c">Distance km</th><th class="c">Per 100 km</th><th class="c">Avg days between fills</th><th class="c">Last fill</th></tr></thead><tbody>${L.map(x => `<tr><td><b>${esc(x.unit)}</b></td><td>${esc(whOf(x.uk))}</td><td>${esc(ICON[x.type || 'Other'] + ' ' + (x.type || '—'))}</td><td class="c">${x.n}</td><td class="c"><b>${f1(x.q)}</b></td><td>${esc(x.uom)}</td><td class="c">${f1(x.avg)}</td><td class="c">${f1(x.kms || x.span)}</td><td class="c">${x.per100 ? f1(x.per100) : ''}</td><td class="c">${x.gap ? f1(x.gap) : ''}</td><td class="c">${esc(dmy(x.last))}</td></tr>`).join('') || '<tr><td colspan="11" style="text-align:center;padding:16px">No data.</td></tr>'}</tbody></table></div>`; }
  function periodRows(R) { const m = new Map(); fills(R).forEach(r => { const k = r.date.slice(0, 7), t = r.type || 'Other'; let x = m.get(k); if (!x) m.set(k, x = {}); const y = x[t] || (x[t] = { n: 0, q: 0 }); y.n++; y.q += r.qty; }); return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])); }
  function byPeriod(R) { const P = periodRows(R), T = types(fills(R));
    return `<div class="fle-wrap"><table class="fle-t"><thead><tr><th>Month</th>${T.map(t => `<th class="c" colspan="2">${ICON[t]} ${t === 'Fuel' ? 'Fuel / diesel' : t} (${esc(uomOf(R, t))})</th>`).join('')}</tr><tr><th></th>${T.map(() => '<th class="c">Fills</th><th class="c">Total</th>').join('')}</tr></thead><tbody>${P.map(([k, x]) => `<tr><td><b>${MN[+k.slice(5) - 1]} ${k.slice(0, 4)}</b></td>${T.map(t => x[t] ? `<td class="c">${x[t].n}</td><td class="c"><b>${f1(x[t].q)}</b></td>` : '<td class="c"></td><td class="c"></td>').join('')}</tr>`).join('') || '<tr><td colspan="9" style="text-align:center;padding:16px">No data.</td></tr>'}</tbody></table></div>`; }
  function log(R) { const L = R.slice().sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts || b.id - a.id);
    return `<div class="fle-wrap"><table class="fle-t"><thead><tr><th>Date</th><th>Forklift</th><th>Warehouse</th><th>Energy</th><th>Record</th><th class="c">Qty</th><th>UOM</th><th class="c">Battery bars</th><th class="c">ODO</th><th class="c">Prev ODO</th><th class="c">KMs</th><th>User</th><th>Location</th><th>Remarks</th></tr></thead><tbody>${L.map(r => `<tr><td>${esc(dmy(r.date))}</td><td><b>${esc(r.unit)}</b></td><td>${esc(whOf(r.uk))}</td><td>${esc(ICON[r.type || 'Other'] + ' ' + (r.raw || '—'))}</td><td>${r.kind === 'start' ? 'Charge start' : r.type === 'Electric' ? 'Charge end' : r.type === 'LPG' ? 'Cylinder change' : 'Refill'}</td><td class="c">${r.kind === 'start' ? '' : f1(r.qty)}</td><td>${esc(r.uom)}</td><td class="c">${r.sb || r.eb ? (r.sb ? 'start ' + r.sb : 'end ' + r.eb) : ''}</td><td class="c">${r.odo || ''}</td><td class="c">${r.prv || ''}</td><td class="c">${r.kms || ''}</td><td>${esc(r.user)}</td><td>${esc(r.loc)}</td><td>${esc(r.rem)}</td></tr>`).join('') || '<tr><td colspan="14" style="text-align:center;padding:16px">No records.</td></tr>'}</tbody></table></div>`; }
  function exceptions(R) { const E = [], seen = new Map();
    R.forEach(r => { const w = []; if (r.odo && r.prv && r.odo < r.prv) w.push('ODO ' + r.odo + ' is lower than the previous ODO ' + r.prv); if (r.kms < 0) w.push('Negative distance (' + r.kms + ' km)'); if (r.kind === 'fill' && !(r.qty > 0)) w.push('Quantity is zero'); if (r.type !== 'Electric' && r.cap > 0 && r.qty > r.cap * 1.05) w.push('Quantity ' + f1(r.qty) + ' is above the tank capacity ' + f1(r.cap)); if (!r.type) w.push('Energy type is missing');
      if (r.pr && r.pr.kind === 'fill' && r.kind === 'fill' && r.type === 'Fuel' && r.date === r.pr.date) w.push('Second fuel fill of the same unit on the same day');
      if (r.type === 'Electric' && r.kind === 'start' && r.pr && r.pr.kind === 'start' && r.pr.type === 'Electric') w.push('Charge started again without an end record');
      const key = [r.uk, r.date, r.odo, r.qty, r.kind].join('|'); if (r.odo && seen.has(key)) w.push('Duplicate of record #' + seen.get(key)); else seen.set(key, r.id);
      if (w.length) E.push([r, w.join(' · ')]); });
    return `<div class="fle-hint">${E.length ? '⚠ ' + E.length + ' record(s) need a check.' : '✔ No exceptions found for this selection.'}</div>${E.length ? `<div class="fle-wrap"><table class="fle-t"><thead><tr><th>Date</th><th>Forklift</th><th>Energy</th><th class="c">Qty</th><th class="c">ODO</th><th>User</th><th>What to check</th></tr></thead><tbody>${E.sort((a, b) => b[0].date.localeCompare(a[0].date)).map(([r, w]) => `<tr class="hr"><td>${esc(dmy(r.date))}</td><td><b>${esc(r.unit)}</b></td><td>${esc(r.raw || '—')}</td><td class="c">${f1(r.qty)}</td><td class="c">${r.odo || ''}</td><td>${esc(r.user)}</td><td>${esc(w)}</td></tr>`).join('')}</tbody></table></div>` : ''}`; }

  function render() {
    const v = Q('#fleBody'); if (!v) return; if (S.loaded && !S.loading && S.winFrom && S.f.from < S.winFrom) { say('⏳ Reading earlier records…'); load(true); }
    const U = window.rpUI, R = S.loaded ? sel() : [], units = [...new Set(S.rows.map(r => r.uk))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), ty = [...new Set(S.rows.map(r => r.type).filter(Boolean))];
    const sl = (k, all, arr, cur) => `<select data-f="${k}"><option value="">${all}</option>${arr.map(x => `<option${x === cur ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
    v.innerHTML = `<div class="rp-f">${U.fi('From', `<input type="date" data-f="from" value="${S.f.from}">`)}${U.fi('To', `<input type="date" data-f="to" value="${S.f.to}">`)}${U.fi('Warehouse', sl('whs', 'All warehouses', whsList(), S.f.whs))}${U.fi('Energy', sl('type', 'All energy types', ty, S.f.type))}${U.fi('Forklift', sl('unit', 'All forklifts', units, S.f.unit))}${U.fi('Search', `<input type="search" data-f="q" placeholder="unit, user, remarks…" value="${esc(S.f.q)}">`)}${U.grp([['30', '30 d'], ['90', '90 d'], ['180', '6 mo'], ['365', '1 yr']].map(([d, t]) => `<button class="secondary small" type="button" data-fe="per" data-d="${d}">${t}</button>`).join(''))}</div>
      ${S.loaded ? kpis(R) : ''}
      ${U.tabbar([['dash', '📊 Dashboard'], ['unit', '🏗 By forklift'], ['per', '📅 By month'], ['log', '🧾 Records'], ['exc', '⚠ Exceptions']].map(([k, t]) => `<button type="button" class="${S.tab === k ? 'active on' : ''}" data-t="${k}">${t}</button>`).join(''), 'data-fe', '#fleBody')}
      ${S.loading && !S.loaded ? '<div class="fle-hint">Reading…</div>' : !S.loaded ? `<div class="fle-hint">${S.err ? '⚠ ' + esc(S.err) : 'Press 🔄 Reload to read the energy records.'}</div>` : S.tab === 'dash' ? dash(R) : S.tab === 'unit' ? byUnit(R) : S.tab === 'per' ? byPeriod(R) : S.tab === 'log' ? log(R) : exceptions(R)}`;
  }
  function rep() { const R = sel(), T = { dash: 'By forklift', unit: 'By forklift', per: 'By month', log: 'Records', exc: 'Records' }[S.tab], note = [dmy(S.f.from) + ' – ' + dmy(S.f.to), S.f.whs && 'Warehouse ' + S.f.whs, S.f.type && S.f.type, S.f.unit && 'Forklift ' + S.f.unit, 'Printed ' + new Date().toLocaleString()].filter(Boolean).join(' · ');
    const tb = Q('#fleBody table.fle-t'); if (tb && typeof tblReport === 'function') return tblReport(tb, 'Forklift energy — ' + T, note, 'Forklift energy ' + T); const L = unitRows(R); return { title: 'Forklift energy — by forklift', note, sheet: 'Forklift energy', headers: ['Forklift', 'Energy', 'Fills', 'Total', 'UOM', 'Distance km', 'Per 100 km'], rows: L.map(x => [x.unit, x.type, x.n, +x.q.toFixed(1), x.uom, +(x.kms || x.span).toFixed(1), +x.per100.toFixed(1)]) }; }
  function init() {
    const v = Q('#view-fle'); if (!v || v._i) return; v._i = 1; css();
    v.addEventListener('click', e => { const t = e.target.closest('[data-t],[data-fe]'); if (!t) return; if (t.dataset.t) { S.tab = t.dataset.t; return render(); } const a = t.dataset.fe;
      if (a === 'expand') { const tb = Q('#fleBody table.fle-t'); if (tb && window.tableExpandOpen) tableExpandOpen(tb); return; }
      if (a === 'print' || a === 'excel' || a === 'mail') { if (S.tab === 'dash') S.tab = 'unit', render(); const d = rep(); if (a === 'print') a2Print(d); else if (a === 'excel') a2Export(d); else a2Mail(rep); return; }
      if (a === 'reload') load(true); else if (a === 'per') { S.f.to = ymd(new Date()); S.f.from = ymd(dShift(new Date(), -+t.dataset.d)); render(); } });
    v.addEventListener('change', e => { const el = e.target, k = el.dataset.f; if (!k) return; S.f[k] = el.value; render(); });
    v.addEventListener('input', e => { const el = e.target; if (el.dataset.f === 'q') { S.f.q = el.value.trim(); clearTimeout(S.tm); S.tm = setTimeout(() => { render(); const i = Q('#fleBody [data-f=q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 350); } });
    render();
  }
  function css() { if (Q('#fleCss')) return; const c = document.createElement('style'); c.id = 'fleCss'; c.textContent = `#view-fle .fle-hint{font-size:12px;color:var(--gray-600);margin:8px 0}#view-fle .fle-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px;margin:10px 0}#view-fle .fle-k{border:1px solid var(--border);border-radius:12px;padding:8px 14px}#view-fle .fle-k span{font-size:12px;color:var(--gray-600);display:block}#view-fle .fle-k b{font-size:21px}#view-fle .fle-k small{display:block;font-size:11px;color:var(--gray-600)}#view-fle .fle-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:8px}#view-fle .fle-c{border:1px solid var(--border);border-radius:14px;padding:12px 14px;min-width:0}#view-fle .fle-c.wide{grid-column:span 2}@media(max-width:900px){#view-fle .fle-c.wide{grid-column:auto}}#view-fle .fle-c h4{margin:0 0 6px;font-size:14px}#view-fle .fle-c h4 small{font-weight:400;color:var(--gray-600)}#view-fle .fle-c h5{margin:10px 0 4px;font-size:12px;color:var(--gray-600)}#view-fle .fle-svg{width:100%;height:auto;max-height:210px}#view-fle .fle-hb{display:grid;grid-template-columns:110px 1fr 60px;gap:8px;align-items:center;font-size:12px;margin:3px 0}#view-fle .fle-hb span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#view-fle .fle-hb i{background:rgba(148,163,184,.25);border-radius:6px;height:12px;display:block;overflow:hidden}#view-fle .fle-hb u{display:block;height:100%;border-radius:6px}#view-fle .fle-hb b{text-align:right}#view-fle .fle-dn{display:flex;gap:14px;align-items:center;flex-wrap:wrap}#view-fle .fle-dn i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}#view-fle .fle-dn div div{font-size:12.5px;margin:3px 0}#view-fle .fle-wrap{overflow:auto;max-height:70vh;border:1px solid var(--border);border-radius:12px;margin-top:8px}#view-fle table.fle-t{border-collapse:collapse;font-size:12px;width:100%}#view-fle .fle-t th{background:var(--brand-light,#eef2fb);padding:7px 6px;text-align:left;white-space:nowrap;position:sticky;top:0;z-index:2}#view-fle .fle-t td{padding:6px;border-top:1px solid var(--border);vertical-align:top}#view-fle .fle-t .c{text-align:center}#view-fle tr.hr td{background:rgba(254,226,226,.45)}`; document.head.appendChild(c); }
  /* page + menu entry (the page is built here so it also appears in the Forklifts group of the menu) */
  function mount() {
    if (!Q('#view-fle')) { const ref = Q('#view-fla'); const d = document.createElement('div'); d.className = 'view'; d.id = 'view-fle';
      d.innerHTML = `<div class="card" id="fleCard"><div class="card-header"><div class="card-title">⛽ Forklift Energy <span class="text-sm" style="font-weight:400;">— fuel · LPG · battery consumption of the forklifts (${LIST}) · by forklift, by month, records and exceptions</span></div><div class="btn-row"><button class="secondary small" type="button" data-fe="reload" title="Re-read the energy records">🔄 Reload</button></div></div><div id="fleStatus" class="status-msg" style="font-size:12px;margin-bottom:6px"></div><div id="fleBody"></div></div>`;
      if (ref) ref.insertAdjacentElement('afterend', d); else (Q('#view-flr') || document.body).insertAdjacentElement('afterend', d); }
    if (!Q('.nav-item[data-view="fle"]')) { const ref = Q('.nav-item[data-view="fla"]'); if (ref) { const n = document.createElement('div'); n.className = 'nav-item'; n.dataset.view = 'fle'; n.dataset.perm = 'locsign'; n.innerHTML = '<span class="icon">⛽</span><span>Forklift Energy</span><span class="badge new">NEW</span>'; ref.insertAdjacentElement('afterend', n); } }
    const nav = Q('.nav-item[data-view="fle"]'); if (nav && !nav._fe) { nav._fe = 1; nav.addEventListener('click', () => { init(); setTimeout(() => load(false), 50); }); }
    const rb = Q('#sectionRefreshBtn'); if (rb && !rb._fe) { rb._fe = 1; rb.addEventListener('click', e => { if (typeof activeViewId === 'function' && activeViewId() === 'fle') { e.stopImmediatePropagation(); load(true); } }, true); }
  }
  mount(); window.FLE = { S, load, render };
})();
