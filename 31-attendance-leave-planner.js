/* ---------- Smart annual leave planner ---------- */
const roLvD = iso => { const [y, m, d] = String(iso).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const roLvIso = n => new Date(n * 86400000).toISOString().slice(0, 10);
const roLvFmt = n => { const d = new Date(n * 86400000); return String(d.getUTCDate()).padStart(2, '0') + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]; };
const roLvSw = { pick: null, undo: [], hl: new Set() };
const roLvPeopleList = () => ro.staff.filter(p => p.active !== false && (!ro.lv.roles.length || ro.lv.roles.includes(p.role)));
function roLvEnt(p) { const L = ro.lv; if (L.entPer[p.id] != null && L.entPer[p.id] !== '') return +L.entPer[p.id] || 0; if (L.entRole[p.role] != null && L.entRole[p.role] !== '') return +L.entRole[p.role] || 0; return +L.ent || 0; }
function roLvTakenMap(yr) { const m = {}; Object.entries(ro.status).forEach(([d, o]) => { if (!d.startsWith(yr + '-')) return; Object.entries(o || {}).forEach(([id, v]) => { if (v === 'Leave') (m[id] = m[id] || []).push(d); }); }); return m; }
function roLvEnv() {
  const L = ro.lv, yr = Math.round(+L.year) || new Date().getFullYear(), today = roIsoLocal(new Date()), from = L.from || (today.startsWith(yr + '-') ? today : yr + '-01-01'), to = L.to || yr + '-12-31', A = roLvD(from), N = roLvD(to) - A + 1;
  const all = ro.staff.filter(p => p.active !== false), grp = p => (p.role || '—') + '|' + (L.loc ? roFieldVal(p, L.loc) : ''), size = {}, cap = {}; all.forEach(p => { const g = grp(p); size[g] = (size[g] || 0) + 1; });
  Object.keys(size).forEach(g => { cap[g] = L.capMode === 'pct' ? Math.max(1, Math.floor(size[g] * (+L.cap || 0) / 100)) : Math.max(1, Math.round(+L.cap || 1)); });
  const black = new Uint8Array(Math.max(N, 0)); (L.black || []).forEach(b => { for (let d = Math.max(A, roLvD(b.from)); d <= Math.min(A + N - 1, roLvD(b.to)); d++) black[d - A] = 1; });
  return { L, yr, from, to, A, N, all, grp, size, cap, black, taken: roLvTakenMap(yr) };
}
function roLvCompute() {
  const E = roLvEnv(), { L, A, N, all, grp, cap, black, taken } = E; if (!(N > 0)) return { err: 'The “to” date must be after the “from” date.' };
  const load = {}; Object.keys(cap).forEach(g => { load[g] = new Int16Array(N); }); const occ = {};
  all.forEach(p => { const o = new Uint8Array(N); (taken[p.id] || []).forEach(d => { const i = roLvD(d) - A; if (i >= 0 && i < N) { o[i] = 1; load[grp(p)][i]++; } }); occ[p.id] = o; });
  const gap = Math.max(0, +L.gap || 0), minB = Math.max(1, Math.round(+L.min || 1)), maxB = Math.max(minB, Math.round(+L.max || minB)), plan = {}, notes = [], unplaced = [];
  const parse = t => { const ds = String(t || '').match(/\d{4}-\d\d-\d\d/g) || [], out = []; for (let i = 0; i + 1 < ds.length; i += 2) out.push([roLvD(ds[i]) - A, roLvD(ds[i + 1]) - A]); return out.filter(r => r[1] >= r[0] && r[1] >= 0 && r[0] < N).map(r => [Math.max(0, r[0]), Math.min(N - 1, r[1])]); };
  const P = roLvPeopleList().map(p => { const tk = (taken[p.id] || []).length + (+L.extra[p.id] || 0), ent = roLvEnt(p); return { p, need: Math.max(0, ent - tk), prefs: parse(L.pref[p.id]) }; });
  P.sort((a, b) => (b.prefs.length - a.prefs.length) || (b.need - a.need) || String(a.p.name).localeCompare(String(b.p.name)));
  let noBal = 0;
  P.forEach(({ p, need, prefs }) => {
    const g = grp(p), o = occ[p.id], ld = load[g], cp = cap[g], blocks = []; plan[p.id] = { b: blocks, ab: ((L.plan[p.id] || {}).ab) || [] };
    if (!need) { noBal++; return; }
    const ok = (s, len) => { if (s < 0 || s + len > N) return false; for (let d = s; d < s + len; d++) if (black[d] || ld[d] >= cp) return false; for (let d = Math.max(0, s - gap); d < Math.min(N, s + len + gap); d++) if (o[d]) return false; return true; };
    const best = (len, lo, hi, ideal) => { let bs = -1, bsc = 1e18; for (let s = lo; s <= hi - len + 1; s++) { if (!ok(s, len)) continue; let sc; if (L.spread) { let sum = 0; for (let d = s; d < s + len; d++) sum += ld[d]; sc = sum * 100 + Math.abs(s - ideal) * 0.2; } else sc = s; if (sc < bsc) { bsc = sc; bs = s; } } return bs; };
    const put = (s, len) => { for (let d = s; d < s + len; d++) { o[d] = 1; ld[d]++; } blocks.push({ from: roLvIso(A + s), to: roLvIso(A + s + len - 1), days: len }); };
    const mode = L.mode[p.id] || L.defMode || 'phased', full = mode === 'full', phN = Math.round(+L.ph[p.id]) || 0; let n;
    if (full) n = 1; else if (phN > 0) n = Math.max(need >= 2 ? 2 : 1, Math.min(phN, need)); else { n = +L.blocks > 0 ? Math.round(+L.blocks) : Math.max(1, Math.ceil(need / maxB)); n = Math.max(1, Math.min(n, Math.floor(need / minB) || 1)); if (need >= 2) n = Math.max(2, n); }
    const lens = []; for (let i = 0; i < n; i++) lens.push(Math.floor(need / n) + (i < need % n ? 1 : 0));
    let placed = 0;
    lens.forEach((len0, j) => { const ideal = (j + 0.5) * N / lens.length; for (let len = len0; len >= (full ? len0 : Math.min(minB, len0)); len--) { let s = -1; for (const r of prefs) { s = best(len, r[0], r[1], r[0]); if (s >= 0) break; } if (s < 0) s = best(len, 0, N - 1, ideal); if (s >= 0) { put(s, len); placed += len; break; } } });
    for (let guard = 0; !full && placed < need && guard < 12; guard++) { let done = false; for (let len = Math.min(need - placed, maxB); len >= 1; len--) { const s = best(len, 0, N - 1, N / 2); if (s >= 0) { put(s, len); placed += len; done = true; break; } } if (!done) break; }
    blocks.sort((a, b) => a.from < b.from ? -1 : 1); if (placed < need) unplaced.push(`${p.name} (${p.id}): ${need - placed} day(s)${full ? ' — needs one free period of ' + need + ' days' : ''}`);
  });
  const tot = Object.values(plan).reduce((a, x) => a + x.b.reduce((s2, b) => s2 + b.days, 0), 0);
  notes.push(`${P.length - noBal} people planned, ${tot} leave day(s) placed.`); if (noBal) notes.push(`${noBal} have no balance left.`);
  if (unplaced.length) notes.push(`⚠ Not fully placed within the cover limit / blackout dates — ${unplaced.length} person(s): ${unplaced.slice(0, 6).join('; ')}${unplaced.length > 6 ? '…' : ''}. Raise “max away together”, widen the dates or shorten the blackout periods.`);
  return { plan, notes };
}
function roLvView() {
  const E = roLvEnv(), { L, A, N, all, grp, cap, size, taken } = E, load = {}; Object.keys(cap).forEach(g => { load[g] = new Int16Array(Math.max(N, 1)); });
  const mark = (p, d) => { const i = roLvD(d) - A; if (i >= 0 && i < N) load[grp(p)][i]++; };
  all.forEach(p => { (taken[p.id] || []).forEach(d => mark(p, d)); const pl = L.plan[p.id]; if (pl) pl.b.forEach(b => { for (let d = roLvD(b.from); d <= roLvD(b.to); d++) mark(p, roLvIso(d)); }); });
  const rows = roLvPeopleList().map(p => { const pl = L.plan[p.id] || { b: [], ab: [] }, tk = (taken[p.id] || []).length, ex = +L.extra[p.id] || 0, ent = roLvEnt(p), planned = pl.b.reduce((a, b) => a + b.days, 0);
    return { p, id: p.id, name: p.name, role: p.role || '', loc: L.loc ? roFieldVal(p, L.loc) : '', grp: grp(p), ent, tk, ex, planned, bal: ent - tk - ex - planned, blocks: pl.b, ab: pl.ab || [], takenDays: taken[p.id] || [], has: pl.b.length > 0 }; });
  const cov = Object.keys(cap).map(g => { const l = load[g]; let pk = 0, at = 0; for (let i = 0; i < N; i++) if (l[i] > pk) { pk = l[i]; at = i; } return { g, role: g.split('|')[0], loc: g.split('|')[1] || '', size: size[g], cap: cap[g], peak: pk, at: pk ? roLvFmt(A + at) : '' }; }).filter(x => x.peak > 0 || rows.some(r => r.grp === x.g)).sort((a, b) => (b.peak > b.cap) - (a.peak > a.cap) || a.role.localeCompare(b.role));
  return Object.assign(E, { rows, cov, load });
}
function roLvModel() {
  const V = roLvView(), L = ro.lv, show = V.rows.filter(r => r.has || r.takenDays.some(d => { const i = roLvD(d) - V.A; return i >= 0 && i < V.N; })), per = [];
  if (L.gran === 'days') { const m = Math.max(1, Math.min(12, +L.month || 1)), f = roLvD(V.yr + '-' + String(m).padStart(2, '0') + '-01'), n = new Date(Date.UTC(V.yr, m, 0)).getUTCDate(); for (let i = 0; i < n; i++) per.push([f + i, f + i, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date((f + i) * 86400000).getUTCDay()] + ' ' + roLvFmt(f + i)]); }
  else if (L.gran === 'months') { for (let m = 1; m <= 12; m++) { const f = roLvD(V.yr + '-' + String(m).padStart(2, '0') + '-01'), n = new Date(Date.UTC(V.yr, m, 0)).getUTCDate(); per.push([f, f + n - 1, ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1] + ' ' + V.yr]); } }
  else for (let d = V.A; d <= V.A + V.N - 1; d += 7) per.push([d, Math.min(d + 6, V.A + V.N - 1), roLvFmt(d) + ' – ' + roLvFmt(Math.min(d + 6, V.A + V.N - 1))]);
  const sets = show.map(r => { const st = new Set(r.takenDays.map(roLvD)); r.blocks.forEach(b => { for (let d = roLvD(b.from); d <= roLvD(b.to); d++) st.add(d); }); return st; });
  const rows = per.map(([a, b, label]) => { const len = b - a + 1, cells = show.map((r, i) => { let c = 0, first = -1, last = -1; for (let d = a; d <= b; d++) if (sets[i].has(d)) { c++; if (first < 0) first = d - a; last = d - a; } const st = !c ? '' : c === len ? 'brk' : 'part'; let sty = '';
      if (st === 'part') { const p1 = first / len * 100, p2 = (last + 1) / len * 100; sty = `background:linear-gradient(to bottom,#fff 0% ${p1}%,#3b82f6 ${p1}% ${p2}%,#fff ${p2}% 100%)`; } return { on: false, st, mins: c, a: first / len * 100, b: (last + 1) / len * 100, style: sty }; });
    let black = false; for (let d = a; d <= b; d++) { const i = d - V.A; if (i >= 0 && i < V.N && V.black[i]) black = true; }
    return { label, shift: '', night: black, cells, n: cells.filter(c => c.st).length }; });
  return { title: 'Annual leave plan ' + V.yr, note: `${V.from} → ${V.to} · ${show.length} people · 🌴 = leave (planned + already in the roster) · shaded part = some days of the period · pink period = blackout`, locHead: [L.loc ? ((roSmFieldOpts().find(x => x.k === L.loc) || {}).l || 'Location') : ''].filter(Boolean), cols: show.map(r => ({ name: r.name, id: r.id, role: r.role, loc: L.loc ? [r.loc] : [], swapped: roLvSw.hl.has(r.id) })), rows, hours: show.map(r => (r.tk + r.ex + r.planned) + '/' + r.ent),
    pal: { on: '#ffffff', brk: '#3b82f6', symOn: '', symBrk: '🌴', unit: 'd' }, L: { slot: 'Period', shift: '', n: 'People away', h: 'Leave days' } };
}
function roLvGridHtml(m, tall) {
  const head = m.cols.map(c => `<th data-lvi="${plEsc(c.id)}" title="${plEsc(c.name + ' · ' + c.id + ' · ' + c.role + ' — click to swap')}" style="cursor:pointer;${roLvSw.pick === c.id ? 'background:#cfe3ff;outline:2px solid #2f6fdd;outline-offset:-2px;' : c.swapped ? 'background:#fff7d6;' : ''}"><div class="ro-sn">${plEsc(c.name)}</div><div class="ro-role">${plEsc(c.id)}</div><div class="ro-role">${plEsc(c.role)}</div>${c.loc.map(l => `<div class="ro-role ro-area">${plEsc(l)}</div>`).join('')}</th>`).join('');
  const body = m.rows.map(r => `<tr class="${r.night ? 'night' : ''}"><td class="ro-l">${plEsc(r.label)}</td><td class="ro-sh"></td>${r.cells.map(c => `<td class="ro-c${c.st === 'brk' ? ' lv' : ''}"${c.st === 'part' ? ` style="${c.style}"` : ''}${c.st ? ` title="${c.mins} day(s) of leave"` : ''}>${c.st === 'brk' ? '🌴' : c.st === 'part' ? `<span class="ro-bm" style="color:#fff;text-shadow:0 0 3px #000">${c.mins}d</span>` : ''}</td>`).join('')}<td class="ro-t">${r.n || ''}</td></tr>`).join('');
  return `<div class="ro-grid" style="${tall ? 'flex:1;min-height:0;max-height:none' : 'max-height:70vh'}"><table class="no-rn" style="width:100%"><thead><tr><th class="ro-l">${m.L.slot}</th><th class="ro-sh"></th>${head}<th class="ro-t">${m.L.n}</th></tr></thead><tbody>${body}<tr><td class="ro-l ro-t">${m.L.h}</td><td class="ro-sh ro-t"></td>${m.hours.map(h => `<td class="ro-t">${plEsc(h)}</td>`).join('')}<td class="ro-t"></td></tr></tbody></table></div>`;
}
function roLvSay(t, bad) { const e = PLQ('#roLvSay'); if (e) { e.textContent = t; e.style.color = bad ? '#b42318' : 'var(--gray-600)'; } }
function roLvDraw() {
  if (!PLQ('#roLvOut')) return; const L = ro.lv, V = roLvView(), has = V.rows.some(r => r.has), over = V.cov.filter(x => x.peak > x.cap).length;
  PLQ('#roLvSum').innerHTML = `<strong>${V.rows.length}</strong> people · <strong>${V.rows.reduce((a, r) => a + r.planned, 0)}</strong> leave day(s) planned (not yet in the roster) · <strong>${V.rows.reduce((a, r) => a + r.tk, 0)}</strong> already in the roster${over ? ` · <span style="color:#b42318">${over} group(s) over the limit</span>` : ''}${roLvSw.pick ? ` · <span style="color:#2f6fdd">now click the person to swap ${plEsc((V.rows.find(r => r.id === roLvSw.pick) || {}).name || '')} with</span>` : ''}`;
  PLQ('#roLvNotes').textContent = (L.notes || []).join(' ');
  PLQ('#roLvCover').innerHTML = V.cov.map(x => `<tr><td>${plEsc(x.role)}</td><td>${plEsc(x.loc || '—')}</td><td>${x.size}</td><td>${x.cap}</td><td${x.peak > x.cap ? ' style="color:#b42318;font-weight:700"' : ''}>${x.peak}</td><td>${x.at}</td></tr>`).join('') || '<tr><td colspan="6" style="color:var(--gray-400);font-style:italic;padding:8px">Build the plan first.</td></tr>';
  PLQ('#roLvGran').value = L.gran; PLQ('#roLvMonth').value = String(L.month); PLQ('#roLvMonth').style.display = L.gran === 'days' ? '' : 'none'; document.querySelectorAll('#roLvOutCard [data-lv="grid"],#roLvOutCard [data-lv="list"]').forEach(b => { b.className = (b.dataset.lv === L.view ? 'secondary' : 'ghost') + ' small'; });
  if (!has && !V.rows.some(r => r.takenDays.length)) { PLQ('#roLvOut').innerHTML = '<div class="text-sm" style="padding:12px;color:var(--gray-500)">Press “Build plan” to get the suggestion.</div>'; return; }
  if (L.view === 'list') PLQ('#roLvOut').innerHTML = `<div class="fd-wrap" style="max-height:60vh"><table class="fd-tbl no-rn" id="roLvTbl"><thead><tr><th>File Nr</th><th>Name</th><th>Role</th><th>Location</th><th>Entitlement</th><th>Taken</th><th>Way of taking</th><th>Planned days</th><th>Leave periods</th><th>Balance after</th></tr></thead><tbody>${V.rows.map(r => `<tr><td>${plEsc(r.id)}</td><td>${plEsc(r.name)}</td><td>${plEsc(r.role)}</td><td>${plEsc(r.loc)}</td><td>${r.ent}</td><td>${r.tk + r.ex}</td><td>${(L.mode[r.id] || L.defMode || 'phased') === 'full' ? 'One time' : 'In phases' + (L.ph[r.id] ? ' (' + L.ph[r.id] + ')' : '')}</td><td>${r.planned}</td><td>${plEsc(r.blocks.map(b => (b.from === b.to ? roLvFmt(roLvD(b.from)) : roLvFmt(roLvD(b.from)) + ' – ' + roLvFmt(roLvD(b.to))) + ' (' + b.days + 'd)').join(', '))}</td><td${r.bal > 0 ? ' style="color:#b26a00;font-weight:700"' : ''}>${r.bal}</td></tr>`).join('')}</tbody></table></div>`;
  else PLQ('#roLvOut').innerHTML = roLvGridHtml(roLvModel(), false);
  roLvGridOvFill();
}
function roLvGridOvFill() { const ov = document.querySelector('#roLvGridModal'); if (!ov || ov.style.display !== 'flex') return; const m = roLvModel(); document.querySelector('#roLvGridOvBody').innerHTML = (roLvSw.pick ? `<div class="text-sm" style="color:#2f6fdd;margin:2px 0">Now click the person to swap with.</div>` : '') + roLvGridHtml(m, true); }
function roLvGridOvOpen() {
  let ov = document.querySelector('#roLvGridModal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'roLvGridModal'; ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:100000;background:var(--card);color:inherit;flex-direction:column;'; ov.innerHTML = '<div style="display:flex;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border)"><strong>🌴 Annual leave plan</strong><span class="text-sm" style="color:var(--gray-600)">click two names to swap their leave</span><div style="flex:1"></div><button type="button" class="ghost small" data-o="print">🖨 Print</button><button type="button" class="ghost small" data-o="mail">📧 Email</button><button type="button" class="ghost small" data-o="img">🖼 Image</button><button type="button" class="ghost small" data-o="xl">📊 Excel</button><button type="button" class="ghost small" data-o="x">✖ Close</button></div><div id="roLvGridOvBody" style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:8px 14px"></div>'; document.body.appendChild(ov);
    ov.addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (!b) return; const k = b.dataset.o; if (k === 'x') ov.style.display = 'none'; else roLvOut(k); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.style.display === 'flex' && document.getElementById('tblExpandOverlay').style.display !== 'flex' && !document.querySelector('#wMailModal[style*="flex"]')) ov.style.display = 'none'; }); }
  if (!document.querySelector('#roLvGridCss')) { const st = document.createElement('style'); st.id = 'roLvGridCss'; st.textContent = '#roLvGridOvBody>*:not(.ro-grid){flex:none}#roLvGridOvBody .ro-grid{border:1px solid var(--border)}'; document.head.appendChild(st); }
  ov.style.display = 'flex'; roLvGridOvFill();
}
function roLvOut(k) { const m = roLvModel(); if (!m.cols.length) { sectionToast('Build the plan first.', 'warn'); return; } if (k === 'print') roSmGridPrint(m); else if (k === 'mail') roSmGridEmail(m); else if (k === 'img') roSmGridImage(m); else roSmGridXlsx(false, m).catch(e => sectionToast('Excel export failed: ' + e.message, 'warn')); }
function roLvPick(id) {
  if (!roLvSw.pick) roLvSw.pick = id; else if (roLvSw.pick === id) roLvSw.pick = null; else { const a = roLvSw.pick; roLvSw.pick = null; const P = ro.lv.plan; P[a] = P[a] || { b: [], ab: [] }; P[id] = P[id] || { b: [], ab: [] }; const t = P[a].b; P[a].b = P[id].b; P[id].b = t; roLvSw.undo.push([a, id]); roLvSw.hl.add(a); roLvSw.hl.add(id); roSave(); const V = roLvView(), over = V.cov.filter(x => x.peak > x.cap).length; roLvSay(over ? `⚠ Swapped, but ${over} group(s) now exceed the cover limit.` : '✓ Leave swapped.', !!over); }
  roLvDraw();
}
function roLvUndo() { const u = roLvSw.undo.pop(); if (!u) return; const P = ro.lv.plan, t = P[u[0]].b; P[u[0]].b = P[u[1]].b; P[u[1]].b = t; roLvSw.hl.clear(); roLvSw.undo.forEach(([a, b]) => { roLvSw.hl.add(a); roLvSw.hl.add(b); }); roSave(); roLvSay('↩ Swap undone.'); roLvDraw(); }
function roLvBuild() {
  roLvRead(); const r = roLvCompute(); if (r.err) { roLvSay('⚠ ' + r.err, true); return; }
  ro.lv.plan = r.plan; ro.lv.notes = r.notes; roLvSw.undo = []; roLvSw.hl.clear(); roLvSw.pick = null; roSave(); roLvSay('✓ Plan built.'); roLvDraw(); addActivity('edit', 'Annual leave plan built: ' + r.notes[0]);
}
function roLvApplyRoster() {
  const V = roLvView(), rows = V.rows.filter(r => r.blocks.length); if (!rows.length) { roLvSay('Nothing planned to write.', true); return; } const days = rows.reduce((a, r) => a + r.planned, 0);
  if (!confirm(`Write ${days} leave day(s) of ${rows.length} people into the roster as 🌴 Leave?\n\nTheir planned time slots on those days are cleared.`)) return;
  rows.forEach(r => { r.blocks.forEach(b => { for (let d = roLvD(b.from); d <= roLvD(b.to); d++) roApply(roLvIso(d), r.id, 'Leave'); }); const pl = ro.lv.plan[r.id]; pl.ab = (pl.ab || []).concat(pl.b); pl.b = []; });
  roLvSw.undo = []; roLvSw.hl.clear(); roSave(); roRender(); roLvDraw(); roLvSay(`✓ ${days} leave day(s) written into the roster.`); sectionToast('Annual leave written into the roster.', 'success'); addActivity('edit', `Annual leave: ${days} day(s) for ${rows.length} people written into the roster`);
}
function roLvQueue() {
  const L = ro.lv, col = L.spCol; if (!col) { roLvSay('⚠ Choose the SharePoint column for the leave dates first.', true); return; }
  const V = roLvView(), rows = V.rows.filter(r => r.blocks.length || r.ab.length); if (!rows.length) { roLvSay('Nothing planned to send.', true); return; }
  const c = ro.spCols.find(x => x.k === col), tag = 'AL' + V.yr; let n = 0, skip = 0;
  rows.forEach(r => { const p = r.p; if (!roQHasSp(p)) { skip++; return; } const all = r.ab.concat(r.blocks).sort((a, b) => a.from < b.from ? -1 : 1), txt = tag + ': ' + all.map(b => b.from === b.to ? b.from : b.from + '→' + b.to).join('; '), old = p.sp[col] == null ? '' : String(p.sp[col]), re = new RegExp('(^|\\|\\s*)' + tag + ':[^|]*');
    const nw = re.test(old) ? old.replace(re, (m0, a) => a + txt).trim() : (old ? old + ' | ' : '') + txt; if (nw === old) return; roQRec(p, col, '', c ? c.label : col, old, nw); roQSet(p, col, '', nw); n++; });
  roSave(); roRender(); roLvSay(`🔄 ${n} person(s) queued in the Sync queue${skip ? ` (${skip} skipped: not imported from SharePoint)` : ''} — decide there what goes to SharePoint.`); if (n) addActivity('edit', `Annual leave: ${n} change(s) queued for SharePoint`);
}
function roLvRead() {
  const q = PLQ, L = ro.lv, n = (s, d) => { const v = parseFloat(q(s).value); return isFinite(v) ? v : d; };
  Object.assign(L, { year: Math.round(n('#roLvYear', L.year)), from: q('#roLvFrom').value, to: q('#roLvTo').value, ent: n('#roLvEnt', 30), defMode: q('#roLvMode').value, blocks: Math.round(n('#roLvBlocks', 0)), min: n('#roLvMin', 7), max: n('#roLvMax', 21), gap: n('#roLvGap', 14), capMode: q('#roLvCapMode').value, cap: n('#roLvCap', 1), loc: q('#roLvLoc').value, spread: q('#roLvSpread').checked, spCol: q('#roLvSpCol').value }); roSave();
}
function roLvPeopleRender() {
  const q = PLQ, L = ro.lv, t = (q('#roLvPS').value || '').toLowerCase().trim(), yr = Math.round(+L.year) || new Date().getFullYear(), tk = roLvTakenMap(yr), roles = [...new Set(roLvPeopleList().map(p => p.role).filter(Boolean))].sort();
  q('#roLvRoleEnt').innerHTML = roles.map(r => `<label class="text-sm" style="display:inline-flex;gap:3px;align-items:center;margin:0 8px 3px 0">${plEsc(r)} <input type="number" data-lvr="${plEsc(r)}" value="${L.entRole[r] == null ? '' : L.entRole[r]}" placeholder="${L.ent}" style="width:58px;margin:0;padding:2px 4px"></label>`).join('') || '<span style="color:var(--gray-400)">—</span>';
  q('#roLvPeople').innerHTML = roLvPeopleList().filter(p => !t || [p.id, p.name, p.role, p.area].join(' ').toLowerCase().includes(t)).map(p => { const k = (tk[p.id] || []).length, ex = +L.extra[p.id] || 0, ent = roLvEnt(p);
    return `<tr data-id="${plEsc(p.id)}"><td>${plEsc(p.id)}</td><td>${plEsc(p.name)}</td><td>${plEsc(p.role)}</td><td>${plEsc(L.loc ? roFieldVal(p, L.loc) : '')}</td><td><input type="number" data-lve value="${L.entPer[p.id] == null ? '' : L.entPer[p.id]}" placeholder="${ent}" style="width:70px;margin:0;padding:2px 4px"></td><td>${k}</td><td><input type="number" data-lvx value="${ex || ''}" placeholder="0" style="width:70px;margin:0;padding:2px 4px"></td><td><select data-lvm style="margin:0;padding:2px 4px;width:auto"><option value="">Default (${(L.defMode || 'phased') === 'full' ? 'one time' : 'phases'})</option><option value="full" ${L.mode[p.id] === 'full' ? 'selected' : ''}>One time</option><option value="phased" ${L.mode[p.id] === 'phased' ? 'selected' : ''}>In phases</option></select></td><td><input type="number" data-lvh min="2" value="${L.ph[p.id] || ''}" placeholder="auto" ${(L.mode[p.id] || L.defMode || 'phased') === 'full' ? 'disabled' : ''} style="width:60px;margin:0;padding:2px 4px"></td><td class="lvbal">${ent - k - ex}</td><td><input type="text" data-lvp value="${plEsc(L.pref[p.id] || '')}" placeholder="2026-07-01..2026-07-20" style="width:100%;min-width:220px;margin:0;padding:2px 4px"></td></tr>`; }).join('') || '<tr><td colspan="11" style="padding:12px;text-align:center;color:var(--gray-400)">No staff — import the staff list in Staff Roster.</td></tr>';
}
function roLvUi() {
  const q = PLQ, L = ro.lv, f = (id, v) => { q(id).value = v; }; f('#roLvYear', L.year); f('#roLvFrom', L.from); f('#roLvTo', L.to); f('#roLvEnt', L.ent); f('#roLvBlocks', String(L.blocks)); f('#roLvMode', L.defMode || 'phased'); f('#roLvMin', L.min); f('#roLvMax', L.max); f('#roLvGap', L.gap); f('#roLvCap', L.cap); f('#roLvCapMode', L.capMode); q('#roLvSpread').checked = !!L.spread;
  q('#roLvLoc').innerHTML = '<option value="">— role only —</option>' + roSmFieldOpts().filter(x => x.k).map(x => `<option value="${plEsc(x.k)}">${plEsc(x.l)}</option>`).join(''); q('#roLvLoc').value = L.loc;
  if (!L.spCol) { const m = ro.spCols.find(c => /leave|vacation|holiday/i.test(c.label + c.k)); if (m) L.spCol = m.k; } q('#roLvSpCol').innerHTML = '<option value="">— choose a column —</option>' + ro.spCols.map(c => `<option value="${plEsc(c.k)}">${plEsc(c.label)}</option>`).join(''); q('#roLvSpCol').value = L.spCol;
  q('#roLvMonth').innerHTML = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
  const roles = [...new Set(ro.staff.map(p => p.role).filter(Boolean))].sort(), host = q('#roLvRoles'); host.innerHTML = ''; L.roles = L.roles.filter(r => roles.includes(r)); host.appendChild(buildMultiCombo(L.roles, roles, arr => { L.roles = arr; roSave(); roLvPeopleRender(); roLvDraw(); }, { placeholder: 'All roles — type to search' }));
  q('#roLvBlList').innerHTML = (L.black || []).map((b, i) => `<span class="lv-chip">⛔ ${plEsc(b.from)} → ${plEsc(b.to)}${b.label ? ' · ' + plEsc(b.label) : ''} <b data-lvbd="${i}" title="Remove">✖</b></span>`).join('') || '<span class="text-sm" style="color:var(--gray-400)">none</span>';
  roLvPeopleRender();
}
let roLvInited = false;
function roLvOpen() {
  if (!PLQ('#roLvPlan')) return; if (!roLvInited) { roLvInited = true; roLvWire(); } roLvUi(); roLvDraw();
}
function roLvWire() {
  const q = PLQ; ['#roLvMode', '#roLvYear', '#roLvFrom', '#roLvTo', '#roLvEnt', '#roLvBlocks', '#roLvMin', '#roLvMax', '#roLvGap', '#roLvCap', '#roLvCapMode', '#roLvLoc', '#roLvSpread', '#roLvSpCol'].forEach(id => q(id).addEventListener('change', () => { roLvRead(); if (['#roLvEnt', '#roLvYear', '#roLvLoc', '#roLvMode'].includes(id)) { roLvPeopleRender(); roLvDraw(); } }));
  q('#roLvPlan').addEventListener('click', roLvBuild); q('#roLvApplyR').addEventListener('click', roLvApplyRoster); q('#roLvQueue').addEventListener('click', roLvQueue);
  q('#roLvClear').addEventListener('click', () => { if (!confirm('Clear the suggested plan? (Leave already written into the roster stays.)')) return; Object.values(ro.lv.plan).forEach(x => { x.b = []; }); ro.lv.notes = []; roLvSw.undo = []; roLvSw.hl.clear(); roSave(); roLvDraw(); roLvSay('Plan cleared.'); });
  q('#roLvGoRoster').addEventListener('click', () => { const n = document.querySelector('.nav-item[data-view="roster"]'); if (n) n.click(); });
  q('#roLvBlAdd').addEventListener('click', () => { const a = q('#roLvBlF').value, b = q('#roLvBlT').value; if (!a || !b || b < a) { roLvSay('⚠ Give a start and an end date (end not before start).', true); return; } ro.lv.black.push({ from: a, to: b, label: q('#roLvBlL').value.trim() }); q('#roLvBlF').value = q('#roLvBlT').value = q('#roLvBlL').value = ''; roSave(); roLvUi(); roLvSay('Blackout added — press Build plan again.'); });
  q('#roLvBlList').addEventListener('click', e => { const b = e.target.closest('[data-lvbd]'); if (!b) return; ro.lv.black.splice(+b.dataset.lvbd, 1); roSave(); roLvUi(); });
  q('#roLvPS').addEventListener('input', roLvPeopleRender);
  q('#roLvRoleEnt').addEventListener('change', e => { const i = e.target.closest('input[data-lvr]'); if (!i) return; if (i.value === '') delete ro.lv.entRole[i.dataset.lvr]; else ro.lv.entRole[i.dataset.lvr] = +i.value; roSave(); roLvPeopleRender(); });
  q('#roLvPeople').addEventListener('change', e => { const tr = e.target.closest('tr[data-id]'); if (!tr) return; const id = tr.dataset.id, L = ro.lv, v = e.target.value.trim();
    if (e.target.matches('[data-lve]')) { if (v === '') delete L.entPer[id]; else L.entPer[id] = +v; } else if (e.target.matches('[data-lvx]')) { if (v === '' || +v === 0) delete L.extra[id]; else L.extra[id] = +v; } else if (e.target.matches('[data-lvp]')) { if (v === '') delete L.pref[id]; else L.pref[id] = v; } else if (e.target.matches('[data-lvm]')) { if (v === '') delete L.mode[id]; else L.mode[id] = v; const h = tr.querySelector('[data-lvh]'); h.disabled = (L.mode[id] || L.defMode || 'phased') === 'full'; if (h.disabled) { h.value = ''; delete L.ph[id]; } } else if (e.target.matches('[data-lvh]')) { if (v === '' || +v < 2) { delete L.ph[id]; e.target.value = ''; } else L.ph[id] = Math.round(+v); }
    roSave(); const p = ro.staff.find(x => x.id === id), k = (roLvTakenMap(Math.round(+L.year) || new Date().getFullYear())[id] || []).length; if (p) tr.querySelector('.lvbal').textContent = roLvEnt(p) - k - (+L.extra[id] || 0); });
  q('#roLvGran').addEventListener('change', e => { ro.lv.gran = e.target.value; roSave(); roLvDraw(); }); q('#roLvMonth').addEventListener('change', e => { ro.lv.month = +e.target.value; roSave(); roLvDraw(); });
  document.addEventListener('click', e => { const th = e.target.closest('th[data-lvi]'); if (th && (th.closest('#roLvOut') || th.closest('#roLvGridModal'))) { roLvPick(th.dataset.lvi); return; }
    const b = e.target.closest('#roLvOutCard [data-lv]'); if (!b) return; const k = b.dataset.lv;
    if (k === 'grid' || k === 'list') { ro.lv.view = k; roSave(); roLvDraw(); } else if (k === 'undo') roLvUndo(); else if (k === 'full') roLvGridOvOpen(); else if (k === 'expand') { ro.lv.view = 'list'; roSave(); roLvDraw(); const t = document.querySelector('#roLvTbl'); if (t && window.tableExpandOpen) { window.tableExpandOpen(t); const ti = document.getElementById('teTitle'); if (ti) ti.textContent = '⤢ Annual leave plan ' + ro.lv.year; } } else roLvOut(k); });
}
function roOpen() { roInit(); roRender(); roCurShiftOnce(); roLvOpen(); }
document.addEventListener('click', e => { if (e.target.closest('#roGoSettings')) { e.preventDefault(); const n = document.querySelector('.nav-item[data-view="otrules"]'); if (n) n.click(); } });
document.querySelectorAll('.nav-item[data-view="roster"], .nav-item[data-view="brkplan"], .nav-item[data-view="leaveplan"]').forEach(n => n.addEventListener('click', () => setTimeout(roOpen, 0)));
document.addEventListener('click', e => { const t = e.target.closest('#roGoPlanner, #roBpGoRoster'); if (!t) return; e.preventDefault(); const n = document.querySelector('.nav-item[data-view="' + (t.id === 'roGoPlanner' ? 'brkplan' : 'roster') + '"]'); if (n) n.click(); });

/* ============================================================
   STAFF ATTENDANCE — biometric report analysis + roster-vs-actual comparison
   ============================================================ */
const AT_KEY = LS_BASE + '_att';
const at = { rows: [], file: '', loaded: '', f: {}, q: [], tab: 'up', grace: 15, shown: 200, rcShown: 200, sort: { cm: null, rc: null }, cmRes: '', inited: false };
const AT_FILT = [['date', 'Date'], ['wh', 'Mngt warehouse'], ['loc', 'Work location'], ['sec', 'Section'], ['pos', 'Position'], ['sup', 'Reporting supervisor'], ['st', 'Status'], ['shift', 'Shift code'], ['dept', 'Department'], ['func', 'Function'], ['payLoc', 'Payroll location'], ['grp', 'Employee group']];
const atPad = n => String(n).padStart(2, '0');
const atHM = m => m == null ? '' : atPad(Math.floor(((m % 1440) + 1440) % 1440 / 60)) + ':' + atPad(Math.round(((m % 1440) + 1440) % 1440) % 60);
const atKey = v => String(v == null ? '' : v).trim().replace(/^0+/, '').toUpperCase();
const atNm = v => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, '');
const atWrap = d => ((d + 720) % 1440 + 1440) % 1440 - 720;
const atDateLabel = iso => { const [y, m, d] = iso.split('-').map(Number); return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(y, m - 1, d).getDay()]} ${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`; };
const atSigned = n => n == null ? '' : (n > 0 ? '+' : '') + Math.round(n);

/* ---------- parsing ---------- */
function atDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { const o = XLSX.SSF.parse_date_code(v); return o ? `${o.y}-${atPad(o.m)}-${atPad(o.d)}` : null; }
  if (v instanceof Date) return isNaN(v) ? null : roIsoLocal(v);
  const s = String(v).trim(); let m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(s);
  if (m) { let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000; if (b > 12 && a <= 12) { const t = a; a = b; b = t; } if (a < 1 || a > 31 || b < 1 || b > 12) return null; return `${y}-${atPad(b)}-${atPad(a)}`; }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[0] : null;
}
function atMin(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.round((v % 1) * 1440) % 1440;
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  const m = /(\d{1,2}):(\d{2})/.exec(String(v)); return m ? (+m[1] * 60 + +m[2]) % 1440 : null;
}
function atHrs(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Math.round((v < 1 ? v * 24 : v) * 100) / 100;   // a day-fraction (0.4208 = 10:06) or plain hours (8)
  const s = String(v).trim(), m = /^(\d+):(\d{2})/.exec(s); if (m) return +m[1] + +m[2] / 60; const n = parseFloat(s); return isNaN(n) ? 0 : n;
}
const atNum = v => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
function atShift(code) {
  if (!code) return { f: null, t: null, type: '' }; const s = String(code).replace(/warehouse/i, ' ');
  let m = /(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?/.exec(s), f, t;
  if (m) { f = +m[1] * 60 + (+m[2] || 0); t = +m[3] * 60 + (+m[4] || 0); }
  else { m = /(\d{1,2}):(\d{2})/.exec(s); if (m && +m[1] <= 24 && +m[2] <= 24 && +m[1] !== +m[2]) { f = +m[1] * 60; t = +m[2] * 60; } }
  if (f == null || f >= 1440 || t > 1440) return { f: null, t: null, type: '' }; return { f, t: t % 1440, type: f >= 300 && f < 900 ? 'Day' : 'Night' };
}
function atStatus(r) {
  const rem = String(r.rem || '').toLowerCase();
  if (/leave|vacation|sick/.test(rem)) return 'Leave'; if (/absent/.test(rem)) return 'Absent'; if (/\boff\b|holiday|rest day/.test(rem)) return 'Off';
  if (r.inT != null && r.outT != null) return 'Present'; if (r.inT != null || r.outT != null) return 'One punch'; return 'No punch';
}
function atNormRow(o) {
  const sh = atShift(o.shift), r = { date: o.date, id: String(o.id).trim(), name: o.name, inT: o.inT, outT: o.outT, req: o.req, work: o.work, pos: o.pos, payLoc: o.payLoc, loc: o.loc, func: o.func, dept: o.dept, sec: o.sec, sup: o.sup, not: o.not, fot: o.fot, rot: o.rot, hot: o.hot, ot: o.ot, empSt: o.empSt, grp: o.grp, cat: o.cat, shift: o.shift, rem: o.rem };
  r.sFrom = sh.f; r.sTo = sh.t; r.sType = sh.type; r.st = atStatus(r); return atIndex(r);
}
function atIndex(r) { try { Object.defineProperty(r, 'wh', { configurable: true, enumerable: false, get() { try { return a2MngtWh(this) || ('Other · ' + a2StoreRaw(this)); } catch (e) { return ''; } } }); } catch (e) {} r._t = [r.id, r.name, r.pos, r.loc, r.sec, r.sup, r.shift, r.rem, r.st].join(' | ').toLowerCase(); return r; }
function atParse(rows2) {
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  let hi = -1; for (let i = 0; i < Math.min(rows2.length, 30); i++) { const t = (rows2[i] || []).map(norm); if (t.includes('employeeno') && (t.includes('intime') || t.includes('outtime'))) { hi = i; break; } }
  if (hi < 0) throw new Error('Could not find the header row. Expected columns like “Date, Employee No, Employee Name, IN Time, Out Time …” (Attendance Detail Report).');
  const H = rows2[hi].map(norm), ix = (...ns) => { for (const n of ns) { const i = H.indexOf(norm(n)); if (i >= 0) return i; } return -1; };
  const C = { date: ix('Date'), id: ix('Employee No', 'Employee Number'), name: ix('Employee Name'), inT: ix('IN Time', 'In'), outT: ix('Out Time', 'Out'), req: ix('Required Hours'), work: ix('Work Hours'), pos: ix('Position'), payLoc: ix('Payroll Location'), loc: ix('Work Location'), func: ix('Function'), dept: ix('Department'), sec: ix('Section'), sup: ix('Reporting Supervisor', 'Supervisor'), not: ix('Total NOT'), fot: ix('Total FOT'), rot: ix('ROT'), hot: ix('HOT'), ot: ix('Total OT'), empSt: ix('Employee Status'), grp: ix('Employee Group'), cat: ix('Category'), shift: ix('Shift Code'), rem: ix('Remarks') };
  if (C.date < 0 || C.id < 0) throw new Error('The “Date” and “Employee No” columns are required.');
  const g = (r, k) => C[k] < 0 ? null : r[C[k]], t = (r, k) => { const v = g(r, k); return v == null ? '' : String(v).trim(); }, out = []; let skipped = 0;
  for (let i = hi + 1; i < rows2.length; i++) {
    const r = rows2[i] || [], d = atDate(g(r, 'date')); if (!d || g(r, 'id') == null || String(g(r, 'id')).trim() === '') { if (r.some(v => v != null && v !== '')) skipped++; continue; }
    out.push(atNormRow({ date: d, id: g(r, 'id'), name: t(r, 'name'), inT: atMin(g(r, 'inT')), outT: atMin(g(r, 'outT')), req: atHrs(g(r, 'req')), work: atHrs(g(r, 'work')), pos: t(r, 'pos'), payLoc: t(r, 'payLoc'), loc: t(r, 'loc'), func: t(r, 'func'), dept: t(r, 'dept'), sec: t(r, 'sec'), sup: t(r, 'sup'), not: atNum(g(r, 'not')), fot: atNum(g(r, 'fot')), rot: atNum(g(r, 'rot')), hot: atNum(g(r, 'hot')), ot: atNum(g(r, 'ot')), empSt: t(r, 'empSt'), grp: t(r, 'grp'), cat: t(r, 'cat'), shift: t(r, 'shift'), rem: t(r, 'rem') }));
  }
  if (!out.length) throw new Error('The file has the right headers but no attendance rows.'); return { rows: out, skipped };
}
async function atReadFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer()); const wb = XLSX.read(buf, { type: 'array', cellDates: false }); let best = null;
  for (const n of wb.SheetNames) { try { const rows2 = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }); const p = atParse(rows2); if (!best || p.rows.length > best.rows.length) best = p; } catch (e) { if (n === wb.SheetNames[wb.SheetNames.length - 1] && !best) throw e; } }
  if (!best) throw new Error('No sheet in this file looks like an Attendance Detail Report.'); return best;
}

/* ---------- storage ---------- */
function atSave() { try { localStorage.setItem(AT_KEY, JSON.stringify({ file: at.file, loaded: at.loaded, grace: at.grace, rows: at.rows.map(r => { const o = Object.assign({}, r); delete o._t; return o; }) })); return true; } catch (e) { sectionToast('Attendance loaded, but it is too large to keep in this browser — upload again next time.', 'warn'); return false; } }
function atLoad() { try { const d = JSON.parse(localStorage.getItem(AT_KEY) || 'null'); if (d && Array.isArray(d.rows)) { at.rows = d.rows.map(atIndex); at.file = d.file || ''; at.loaded = d.loaded || ''; at.grace = d.grace != null ? d.grace : 15; } } catch (e) {} }

/* ---------- derived ---------- */
const atDates = () => [...new Set(at.rows.map(r => r.date))].sort();
const atLast = () => { const d = atDates(); return d[d.length - 1] || ''; };
function atHours(r) { if (r.work > 0) return r.work; if (r.inT != null && r.outT != null) { let d = r.outT - r.inT; if (d <= 0) d += 1440; return d / 60; } return 0; }
function atPunct(r) { // vs the Shift Code in the report
  const o = { late: null, inD: null, outD: null, early: false }; if (r.sFrom == null) return o;
  if (r.inT != null) { o.inD = atWrap(r.inT - r.sFrom); o.late = o.inD > at.grace; } if (r.outT != null && r.sTo != null) { o.outD = atWrap(r.outT - r.sTo); o.early = o.outD < -at.grace; } return o;
}
function atView(skip) {
  return at.rows.filter(r => AT_FILT.every(d => { if (skip === d[0]) return true; const s = at.f[d[0]]; return !s || !s.length || s.includes(String(r[d[0]] == null ? '' : r[d[0]])); }) && (!at.q.length || at.q.some(t => r._t.includes(String(t).toLowerCase().trim()))));
}
const atFiltersActive = (except) => AT_FILT.some(d => !except.includes(d[0]) && (at.f[d[0]] || []).length) ;
const ST_ORDER = ['Present', 'One punch', 'Absent', 'No punch', 'Leave', 'Off'];
function stCol(s, T) { return { 'Present': T.good, 'One punch': T.warn, 'Absent': T.crit, 'No punch': T.serious, 'Leave': T.act, 'Off': T.muted }[s] || T.muted; }

/* ---------- filters ---------- */
function atFilterRender() {
  const host = PLQ('#atFHost'), card = PLQ('#atFilterCard'); if (!at.rows.length) { card.style.display = 'none'; return; } card.style.display = at.tab === 'up' ? 'none' : '';
  const sig = at.rows.length + '|' + JSON.stringify(at.f) + '|' + at.q.join(','); if (host.dataset.sig === sig) return; host.dataset.sig = sig; host.innerHTML = '';
  AT_FILT.forEach(([k, l]) => { const vals = [...new Set(at.rows.map(r => r[k]).filter(v => v != null && v !== ''))].map(String).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); if (vals.length < 2 && !(at.f[k] || []).length) return;
    const w = document.createElement('div'); w.className = 'ro-cf'; w.innerHTML = `<label>${plEsc(l)}</label>`; w.appendChild(buildMultiCombo((at.f[k] || []).filter(v => vals.includes(v)), vals, arr => { if (arr.length) at.f[k] = arr; else delete at.f[k]; at.shown = at.rcShown = 200; host.dataset.sig = ''; atRefresh(); }, { placeholder: 'All' })); host.appendChild(w); });
  const sh = PLQ('#atSearchHost'), ssig = at.rows.length + '|' + at.q.join(','); if (sh.dataset.sig !== ssig) { sh.dataset.sig = ssig; sh.innerHTML = ''; const names = [...new Set(at.rows.map(r => r.name).filter(Boolean))].sort(); sh.appendChild(buildMultiCombo(at.q, names, arr => { at.q = arr; sh.dataset.sig = at.rows.length + '|' + arr.join(','); at.shown = at.rcShown = 200; atRefresh(true); }, { placeholder: 'Search name, employee no, position, supervisor, shift… (multi)' })); }
  PLQ('#atGrace').value = at.grace;
}
function atPick(key, val) { if (!key) return; const cur = at.f[key] || []; at.f[key] = cur.length === 1 && cur[0] === String(val) ? [] : [String(val)]; if (!at.f[key].length) delete at.f[key]; PLQ('#atFHost').dataset.sig = ''; atRefresh(); }

/* ---------- KPI helpers ---------- */
function atKpi(l, v, s, f) { return `<div class="pl-kpi${f ? ' click' : ''}" ${f ? `data-f="${plEsc(f)}"` : ''}><div class="lbl">${plEsc(l)}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`; }
function atDashKpis() {
  const V = atView(), n = V.length, c = s => V.filter(r => r.st === s).length, pres = c('Present'), one = c('One punch'), abs = c('Absent') + c('No punch'), lv = c('Leave'), off = c('Off'), emp = new Set(V.map(r => r.id)).size;
  const sched = n - lv - off, attended = pres + one, W = V.filter(r => r.st === 'Present'), avgW = W.length ? W.reduce((a, r) => a + atHours(r), 0) / W.length : 0, avgR = W.length ? W.reduce((a, r) => a + (r.req || 0), 0) / W.length : 0;
  const P = V.map(r => ({ r, p: atPunct(r) })).filter(x => x.p.late != null), late = P.filter(x => x.p.late).length, ot = V.reduce((a, r) => a + (r.ot || 0), 0);
  PLQ('#atKpis').innerHTML = atKpi('Employee-days', plF(n), `${plF(emp)} employee(s) · ${atDates().length} day(s) loaded`) + atKpi('Present', plF(pres), n ? plP(pres / n, 0) + ' of records' : '', 'st:Present') + atKpi('One punch only', plF(one), (ol => ol ? `${plF(ol)} on ${atDateLabel(atLast())} — may still be on shift` : 'IN or OUT missing')(V.filter(r => r.st === 'One punch' && r.date === atLast() && r.outT == null).length), 'st:One punch') + atKpi('Absent / no punch', plF(abs), n ? plP(abs / n, 0) + ' of records' : '', 'st:Absent') + atKpi('On leave / off', plF(lv + off), `${plF(lv)} leave · ${plF(off)} off`, 'st:Leave')
    + atKpi('Attendance rate', sched ? plP(attended / sched, 1) : '—', 'attended ÷ scheduled (excl. leave/off)') + atKpi('Avg hours worked', plF(avgW, 1) + ' h', `required ${plF(avgR, 1)} h · complete days`) + atKpi('Late arrivals', P.length ? plP(late / P.length, 0) : '—', `${plF(late)} of ${plF(P.length)} vs shift code · grace ${at.grace} min`) + atKpi('Overtime', plF(ot, 0) + ' h', `${plF(V.reduce((a, r) => a + (r.not || 0), 0), 0)} normal · ${plF(V.reduce((a, r) => a + (r.fot || 0) + (r.rot || 0) + (r.hot || 0), 0), 0)} Fri/rest/holiday`);
}

/* ---------- per-chart data filter (every chart) ---------- */
const CF_GRIDS = { plGrid: () => ({ defs: PL_DEFS, rows: () => pl.view, draw: (d, c) => plCardDraw(d, c), lab: k => plLabel(k) }), dpGrid: () => ({ defs: DP_DEFS, rows: () => dp.view, draw: (d, c) => dpCardDraw(d, c), lab: k => dpLabel(k) }), laGrid: () => ({ defs: LA_DEFS, rows: () => la.view, draw: (d, c) => laCardDraw(d, c), lab: k => String(k).replace(/_/g, ' ') }) };
const cfKey = card => LS_BASE + '_cf_' + ((card.parentElement || {}).id || '') + '_' + card.dataset.id;
function cfGet(card) { try { return JSON.parse(localStorage.getItem(cfKey(card)) || 'null'); } catch (e) { return null; } }
function cfLabel(card, k) { try { const g = CF_GRIDS[(card.parentElement || {}).id]; if (g) return g().lab(k) || k; } catch (e) {} const a = (typeof AT_FILT !== 'undefined' ? AT_FILT : []).find(d => d[0] === k); return a ? a[1] : k; }
function cfRows(card, rows) {
  const sp = cfGet(card), b = card && card.querySelector && card.querySelector('[data-a="cfx"]'); let out = rows, act = false;
  if (sp && sp.f && sp.v && sp.v.length && Array.isArray(rows)) { const S = new Set(sp.v); out = rows.filter(r => S.has(r[sp.f] == null || r[sp.f] === '' ? '(blank)' : String(r[sp.f]))); act = true; }
  if (b) { b.textContent = act ? '⏷ Filter · ' + cfLabel(card, sp.f) : '⏷ Filter'; b.classList.toggle('on', act); } return out;
}
function cfOpen(card, btn) {
  document.querySelectorAll('.gf-pop').forEach(p => p.remove()); const src = card._cf; if (!src) return; const all = src.rows(); if (!Array.isArray(all) || !all.length) { sectionToast('No data in this chart to filter yet.', 'warn'); return; }
  const sample = all.slice(0, 500), keys = Object.keys(sample[0] || {}).filter(k => k[0] !== '_' && sample.some(r => r[k] != null && r[k] !== '' && typeof r[k] !== 'object')).filter(k => { const d = new Set(all.map(r => r[k] == null || r[k] === '' ? '(blank)' : String(r[k]))); return d.size >= 2 && d.size <= 250; });
  if (!keys.length) { sectionToast('Nothing to filter on in this chart.', 'warn'); return; }
  let sp = cfGet(card) || {}; let field = keys.includes(sp.f) ? sp.f : keys[0], sel = new Set(sp.f === field ? sp.v || [] : []);
  const pop = document.createElement('div'); pop.className = 'gf-pop'; const r = btn.getBoundingClientRect();
  pop.style.cssText = 'position:fixed;z-index:100010;background:var(--card);color:var(--gray-800,inherit);border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.25);padding:10px;width:300px;max-height:68vh;display:flex;flex-direction:column;gap:6px;left:' + Math.max(8, Math.min(innerWidth - 312, r.right - 300)) + 'px;top:' + Math.max(8, Math.min(innerHeight - 260, r.bottom + 6)) + 'px';
  pop.innerHTML = '<b>' + plEsc((card.querySelector('h3') || {}).textContent || 'Chart') + ' — filter this chart</b><label class="hint" style="margin:0">Filter by</label><select data-fs style="margin:0">' + keys.map(k => '<option value="' + plEsc(k) + '">' + plEsc(cfLabel(card, k)) + '</option>').join('') + '</select><input type="text" placeholder="Search…" data-q style="margin:0"><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="ghost small" data-v="all">Select all</button><button type="button" class="ghost small" data-v="none">Clear (show all)</button></div><div data-l style="overflow:auto;flex:1;min-height:90px"></div><div class="hint">Only this chart is filtered — the page filters above still apply. Nothing ticked = no extra filter.</div>';
  document.body.appendChild(pop); pop.querySelector('[data-fs]').value = field; const L = pop.querySelector('[data-l]');
  const counts = () => { const m = new Map(); all.forEach(r => { const v = r[field] == null || r[field] === '' ? '(blank)' : String(r[field]); m.set(v, (m.get(v) || 0) + 1); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })); };
  const draw = () => { const q = pop.querySelector('[data-q]').value.trim().toLowerCase(); L.innerHTML = counts().filter(([v]) => !q || v.toLowerCase().includes(q)).map(([v, n]) => '<label style="display:flex;gap:8px;padding:3px 2px;cursor:pointer"><input type="checkbox" data-k="' + plEsc(v) + '" ' + (sel.has(v) ? 'checked' : '') + '><span style="flex:1;overflow-wrap:anywhere">' + plEsc(v) + '</span><span class="hint">' + n + '</span></label>').join('') || '<div class="hint">No match.</div>'; };
  const commit = () => { try { if (sel.size) localStorage.setItem(cfKey(card), JSON.stringify({ f: field, v: [...sel] })); else localStorage.removeItem(cfKey(card)); } catch (e) {} src.redraw(); };
  pop.addEventListener('input', e => { if (e.target.matches('[data-q]')) draw(); });
  pop.addEventListener('change', e => { if (e.target.matches('[data-fs]')) { field = e.target.value; sel = new Set(); commit(); draw(); return; } const c = e.target.closest('input[data-k]'); if (!c) return; c.checked ? sel.add(c.dataset.k) : sel.delete(c.dataset.k); commit(); });
  pop.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-v]'); if (!b) return; if (b.dataset.v === 'all') counts().forEach(([v]) => sel.add(v)); else sel.clear(); commit(); draw(); });
  setTimeout(() => { const off = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', off, true); } }; document.addEventListener('mousedown', off, true); }, 0); draw();
}
(function () {   // adds the ⏷ Filter button to every chart card and wires it
  function scan() { document.querySelectorAll('.pl-card').forEach(card => {
    if (card.querySelector('[data-a="cfx"],[data-a="gf"]') || card.closest('[id$="Modal"],#tblExpandOverlay')) return; const gid = (card.parentElement || {}).id, G = CF_GRIDS[gid];
    if (G && !card._cf) { const id = card.dataset.id; card._cf = { rows: () => G().rows(), redraw: () => { const d = G().defs.find(x => x.id === id); if (d) G().draw(d, card); } }; }
    if (!card._cf) return; const h = card.querySelector('.pl-ch'); if (!h) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'pl-ib'; b.dataset.a = 'cfx'; b.textContent = '⏷ Filter'; b.title = 'Filter this chart only';
    const host = h.querySelector('.ctls') || h; host.appendChild(b); cfRows(card, []); }); }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-a="cfx"]'); if (!b) return; e.stopPropagation(); e.preventDefault(); cfOpen(b.closest('.pl-card'), b); }, true);
  let t = null; new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 200); }).observe(document.body, { childList: true, subtree: true }); setTimeout(scan, 900);
})();
/* ---------- per-chart group filter ---------- */
const gfKey = id => LS_BASE + '_gf_' + id;
function gfGet(id) { try { return JSON.parse(localStorage.getItem(gfKey(id)) || '[]') || []; } catch (e) { return []; } }
function gfPut(id, v) { try { localStorage.setItem(gfKey(id), JSON.stringify(v)); } catch (e) {} }
function gfOpen(def, card, btn, ctx) {
  document.querySelectorAll('.gf-pop').forEach(p => p.remove()); const G = ((ctx.rows() || {}).groups || []).map(g => g.k); if (!G.length) { sectionToast('No groups to filter yet.', 'warn'); return; }
  let sel = new Set(gfGet(def.id).filter(k => G.includes(k))); const pop = document.createElement('div'); pop.className = 'gf-pop'; const r = btn.getBoundingClientRect();
  pop.style.cssText = 'position:fixed;z-index:100010;background:var(--card);color:var(--gray-800,inherit);border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.25);padding:10px;width:280px;max-height:60vh;display:flex;flex-direction:column;gap:6px;left:' + Math.max(8, Math.min(innerWidth - 292, r.right - 280)) + 'px;top:' + Math.min(innerHeight - 200, r.bottom + 6) + 'px';
  pop.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + plEsc(def.title) + ' — show</b><span class="hint" data-n></span></div><input type="text" placeholder="Search…" data-q style="margin:0"><div style="display:flex;gap:6px"><button type="button" class="ghost small" data-v="all">Select all</button><button type="button" class="ghost small" data-v="none">Clear</button><button type="button" class="ghost small" data-v="show">Show all groups</button></div><div data-l style="overflow:auto;flex:1;min-height:80px"></div><div class="hint">Nothing ticked = every group is shown.</div>';
  document.body.appendChild(pop); const L = pop.querySelector('[data-l]'), N = pop.querySelector('[data-n]');
  const draw = () => { const q = pop.querySelector('[data-q]').value.trim().toLowerCase(); L.innerHTML = G.filter(k => !q || String(k).toLowerCase().includes(q)).map(k => '<label style="display:flex;gap:8px;padding:3px 2px;cursor:pointer"><input type="checkbox" data-k="' + plEsc(k) + '" ' + (sel.has(k) ? 'checked' : '') + '><span style="overflow-wrap:anywhere">' + plEsc(k) + '</span></label>').join('') || '<div class="hint">No match.</div>'; N.textContent = sel.size ? sel.size + ' of ' + G.length : 'all ' + G.length; };
  const commit = () => { gfPut(def.id, [...sel]); atCardDraw(def, card, ctx); };
  pop.addEventListener('input', e => { if (e.target.matches('[data-q]')) draw(); });
  pop.addEventListener('change', e => { const c = e.target.closest('input[data-k]'); if (!c) return; c.checked ? sel.add(c.dataset.k) : sel.delete(c.dataset.k); N.textContent = sel.size ? sel.size + ' of ' + G.length : 'all ' + G.length; commit(); });
  pop.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-v]'); if (!b) return; if (b.dataset.v === 'all') G.forEach(k => sel.add(k)); else sel.clear(); commit(); draw(); });
  setTimeout(() => { const off = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', off, true); } }; document.addEventListener('mousedown', off, true); }, 0); draw();
}
/* ---------- card framework ---------- */
function atCardBuild(def, ctx) {
  const card = document.createElement('div'); card.className = 'pl-card ' + (def.span || 's6'); card.dataset.id = def.id; card._cf = { rows: () => ctx.rows(), redraw: () => atCardDraw(def, card, ctx) };
  card.innerHTML = `<div class="pl-ch"><h3>${plEsc(def.title)}</h3><span class="ctls">${def.gf ? '<button class="pl-ib" data-a="gf" type="button" title="Choose which groups this chart shows">⏷ Filter</button>' : ''}</span><button class="pl-ib" data-a="tbl" title="Table view of the same data">▦ Table</button><button class="pl-ib" data-a="png" title="Download as picture">⬇ PNG</button><button class="pl-ib" data-a="full" title="Full screen">⤢</button><div class="sub">${plEsc(def.sub || '')}</div></div><div class="pl-lgh"></div><div class="pl-body"></div><div class="pl-tbl-wrap" style="display:none"></div>`;
  card.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'gf') { e.stopPropagation(); gfOpen(def, card, b, ctx); return; }
    if (a === 'tbl') { const on = card.dataset.tbl !== '1'; card.dataset.tbl = on ? '1' : ''; b.classList.toggle('on', on); b.textContent = on ? '▦ Chart' : '▦ Table'; card.querySelector('.pl-body').style.display = on ? 'none' : ''; card.querySelector('.pl-lgh').style.display = on ? 'none' : ''; card.querySelector('.pl-tbl-wrap').style.display = on ? '' : 'none'; }
    else if (a === 'png') { const svg = card.querySelector('.pl-body svg'); if (svg) plSvgToPng(svg, 'attendance_' + def.id); else sectionToast('Nothing to export in this card.', 'warn'); }
    else if (a === 'full') { const on = !card.classList.contains('pl-full'); card.classList.toggle('pl-full', on); b.textContent = on ? '✕' : '⤢'; setTimeout(() => atCardDraw(def, card, ctx), 30); } });
  return card;
}
function atCardDraw(def, card, ctx) {
  const body = card.querySelector('.pl-body'), lg = card.querySelector('.pl-lgh'), tw = card.querySelector('.pl-tbl-wrap'); let res = {};
  try { let r0 = ctx.rows(); if (Array.isArray(r0)) r0 = cfRows(card, r0); if (def.gf && r0 && r0.groups) { const sel = gfGet(def.id), n0 = r0.groups.length, g2 = sel.length ? r0.groups.filter(g => sel.includes(g.k)) : r0.groups; if (g2.length && g2.length !== n0) r0 = Object.assign({}, r0, { groups: g2 }); const gb = card.querySelector('[data-a="gf"]'); if (gb) { const act = sel.length && g2.length && g2.length !== n0; gb.textContent = act ? '⏷ Filter · ' + g2.length : '⏷ Filter'; gb.classList.toggle('on', !!act); } } res = def.draw(body, { rows: r0, T: plT() }) || {}; } catch (e) { body.innerHTML = `<div class="pl-empty">⚠ ${plEsc(e.message)}</div>`; console.error(def.id, e); }
  lg.innerHTML = res.legend ? plLegend(res.legend) : '';
  if (res.table) { tw.innerHTML = `<table class="pl-tbl"><thead><tr>${res.table.headers.map((h, i) => `<th class="${i ? 'n' : ''}">${plEsc(h)}</th>`).join('')}</tr></thead><tbody>${res.table.rows.map(r => `<tr>${r.map((v, i) => `<td class="${typeof v === 'number' ? 'n' : ''}">${plEsc(typeof v === 'number' ? plF(v, Math.abs(v) < 10 && v % 1 ? 2 : 0) : (v == null ? '' : v))}</td>`).join('')}</tr>`).join('')}</tbody></table>`; } else tw.innerHTML = '<div class="pl-empty">No table for this card.</div>';
}
function atDrawGrid(grid, defs, ctx) { defs.forEach(def => { let card = grid.querySelector(`[data-id="${def.id}"]`); if (!card) { card = atCardBuild(def, ctx); grid.appendChild(card); } atCardDraw(def, card, ctx); }); }

/* ---------- dashboard charts ---------- */
function atFold(list, n, tot) { list.sort((a, b) => tot(b) - tot(a)); if (list.length <= n) return list; const keep = list.slice(0, n - 1), rest = list.slice(n - 1), o = { k: `Other (${rest.length})`, other: true, rows: [] }; rest.forEach(x => o.rows.push(...x.rows)); keep.push(o); return keep; }
function atGroup(rows, key) { const g = new Map(); rows.forEach(r => { const k = (r[key] == null || r[key] === '') ? '(blank)' : String(r[key]); let o = g.get(k); if (!o) { o = { k, rows: [] }; g.set(k, o); } o.rows.push(r); }); return [...g.values()]; }
function atStatusBars(host, rows, key, T, top) {
  const g = atFold(atGroup(rows, key), top || 12, x => x.rows.length), sts = ST_ORDER.filter(s => rows.some(r => r.st === s)), f = v => plF(v), cnt = (x, s) => x.rows.filter(r => r.st === s).length, sched = x => x.rows.length - cnt(x, 'Leave') - cnt(x, 'Off');
  plcBarsH(host, { rows: g.map(x => ({ label: x.k, key: x.k, other: x.other, vals: sts.map(s => cnt(x, s)), tip: sts.map(s => ({ c: stCol(s, T), k: s, v: f(cnt(x, s)) })).concat([{ k: 'Attendance rate', v: sched(x) ? plP((cnt(x, 'Present') + cnt(x, 'One punch')) / sched(x), 0) : '—' }]) })), series: sts.map(s => ({ name: s, color: stCol(s, T) })), stacked: true, fmt: f, tickFmt: f, thick: 14, onClick: r => { if (!r.other) atPick(key, r.key); } });
  return { legend: sts.map(s => ({ name: s, c: stCol(s, T) })), table: { headers: [key, ...sts, 'Total', 'Attendance %'], rows: g.map(x => [x.k, ...sts.map(s => cnt(x, s)), x.rows.length, sched(x) ? plP((cnt(x, 'Present') + cnt(x, 'One punch')) / sched(x), 0) : '']) } };
}
const AT_DEFS = [];
const atBy = (id, title, sub, key, span, top) => AT_DEFS.push({ id, title, sub, span: span || 's6', draw: (h, c) => atStatusBars(h, c.rows, key, c.T, top) });
AT_DEFS.push({ id: 'mix', title: 'Attendance status', sub: 'Share of employee-days', span: 's4', draw(host, c) { const sts = ST_ORDER.filter(s => c.rows.some(r => r.st === s)), sl = sts.map(s => ({ label: s, value: c.rows.filter(r => r.st === s).length, color: stCol(s, c.T) })), tot = c.rows.length; plcDonut(host, { slices: sl, center: { value: plF(tot), label: 'records' }, unit: 'records', onClick: s => atPick('st', s.label) }); return { table: { headers: ['Status', 'Records', 'Share'], rows: sl.map(s => [s.label, s.value, tot ? plP(s.value / tot, 1) : '']) } }; } });
AT_DEFS.push({ id: 'day', title: 'By day', sub: 'Employee-days per date and status', span: 's8', draw(host, c) { const ds = [...new Set(c.rows.map(r => r.date))].sort(), sts = ST_ORDER.filter(s => c.rows.some(r => r.st === s)), n = (d, s) => c.rows.filter(r => r.date === d && r.st === s).length;
  plcCols(host, { cats: ds.map(d => ({ label: atDateLabel(d), key: d, vals: sts.map(s => n(d, s)), tip: sts.map(s => ({ c: stCol(s, c.T), k: s, v: plF(n(d, s)) })) })), series: sts.map(s => ({ name: s, color: stCol(s, c.T) })), fmt: v => plF(v), labelFn: (cat, v) => v ? plF(v) : '', onClick: cat => atPick('date', cat.key), height: 260 });
  return { legend: sts.map(s => ({ name: s, c: stCol(s, c.T) })), table: { headers: ['Date', ...sts], rows: ds.map(d => [atDateLabel(d), ...sts.map(s => n(d, s))]) } }; } });
atBy('wh', 'By Mngt warehouse', 'Status mix per warehouse of the Mngt Daily Report — others are marked “Other ·”', 'wh', 's6', 40);
atBy('loc', 'By work location', 'Status mix per location — click a bar to filter', 'loc', 's6');
atBy('sec', 'By section', 'Status mix per section', 'sec', 's6');
atBy('pos', 'By position', 'Status mix per job position', 'pos', 's6');
atBy('sup', 'By reporting supervisor', 'Who has the most absences / missing punches', 'sup', 's6');
atBy('shift', 'By shift code', 'Status mix per shift pattern', 'shift', 's6');
AT_DEFS.push({ id: 'prof', title: 'Clock-in & clock-out profile', sub: 'People punching IN / OUT in each hour of the day (00–23)', span: 's6', draw(host, c) {
  const inn = Array(24).fill(0), out = Array(24).fill(0); c.rows.forEach(r => { if (r.inT != null) inn[Math.floor(r.inT / 60)]++; if (r.outT != null) out[Math.floor(r.outT / 60)]++; }); let a = 0, b = 23; while (a < 23 && !inn[a] && !out[a]) a++; while (b > a && !inn[b] && !out[b]) b--;
  const hs = []; for (let h = a; h <= b; h++) hs.push(h); plcCols(host, { cats: hs.map(h => ({ label: atPad(h), vals: [inn[h], out[h]], tip: [{ c: c.T.act, k: 'IN ' + atPad(h) + ':00–' + atPad(h) + ':59', v: plF(inn[h]) }, { c: c.T.series[1] || c.T.warn, k: 'OUT', v: plF(out[h]) }] })), series: [{ name: 'IN', color: c.T.act }, { name: 'OUT', color: c.T.series[1] || c.T.warn }], fmt: v => plF(v), height: 250 });
  return { legend: [{ name: 'IN', c: c.T.act }, { name: 'OUT', c: c.T.series[1] || c.T.warn }], table: { headers: ['Hour', 'IN', 'OUT'], rows: hs.map(h => [atPad(h) + ':00', inn[h], out[h]]) } }; } });
AT_DEFS.push({ id: 'hrs', title: 'Hours worked', sub: 'Employee-days with both punches, by hours between IN and OUT', span: 's6', draw(host, c) {
  const B = [['< 4 h', 0, 4], ['4 – 8 h', 4, 8], ['8 – 10 h', 8, 10], ['10 – 12 h', 10, 12], ['12 h +', 12, 99]], W = c.rows.filter(r => r.st === 'Present'), n = (lo, hi) => W.filter(r => { const h = atHours(r); return h >= lo && h < hi; }).length;
  plcCols(host, { cats: B.map(b => ({ label: b[0], vals: [n(b[1], b[2])], tip: [{ c: c.T.act, k: 'Employee-days', v: plF(n(b[1], b[2])) }] })), series: [{ name: 'Employee-days', color: c.T.act }], fmt: v => plF(v), labelFn: (cat, v) => v ? plF(v) : '', height: 250 });
  return { table: { headers: ['Hours', 'Employee-days'], rows: B.map(b => [b[0], n(b[1], b[2])]) } }; } });
AT_DEFS.push({ id: 'punct', title: 'Punctuality vs shift code', sub: 'Arrivals on time / late and departures on time / early, by section', span: 's6', draw(host, c) {
  const g = atFold(atGroup(c.rows, 'sec'), 10, x => x.rows.length), cl = x => { let ot = 0, lt = 0, ea = 0; x.rows.forEach(r => { const p = atPunct(r); if (p.late === true) lt++; else if (p.late === false) ot++; if (p.early) ea++; }); return { ot, lt, ea }; }, S = [{ name: 'Arrived on time', color: c.T.good }, { name: 'Arrived late', color: c.T.crit }, { name: 'Left early', color: c.T.warn }];
  plcBarsH(host, { rows: g.map(x => { const v = cl(x); return { label: x.k, key: x.k, other: x.other, vals: [v.ot, v.lt, v.ea], tip: S.map((s, i) => ({ c: s.color, k: s.name, v: plF([v.ot, v.lt, v.ea][i]) })) }; }), series: S, fmt: v => plF(v), tickFmt: v => plF(v), thick: 12, onClick: r => { if (!r.other) atPick('sec', r.key); } });
  return { legend: S.map(s => ({ name: s.name, c: s.color })), table: { headers: ['Section', ...S.map(s => s.name)], rows: g.map(x => { const v = cl(x); return [x.k, v.ot, v.lt, v.ea]; }) } }; } });
AT_DEFS.push({ id: 'ot', title: 'Overtime hours', sub: 'By section — normal (NOT), Friday (FOT), rest day (ROT), holiday (HOT)', span: 's6', draw(host, c) {
  const g = atFold(atGroup(c.rows, 'sec'), 10, x => x.rows.reduce((a, r) => a + (r.ot || 0), 0)), S = [['NOT', 'not'], ['FOT', 'fot'], ['ROT', 'rot'], ['HOT', 'hot']], col = [c.T.act, c.T.series[1] || c.T.warn, c.T.series[2] || c.T.good, c.T.series[3] || c.T.crit], sm = (x, k) => x.rows.reduce((a, r) => a + (r[k] || 0), 0);
  plcBarsH(host, { rows: g.map(x => ({ label: x.k, key: x.k, other: x.other, vals: S.map(s => sm(x, s[1])), tip: S.map((s, i) => ({ c: col[i], k: s[0], v: plF(sm(x, s[1]), 1) + ' h' })) })), series: S.map((s, i) => ({ name: s[0], color: col[i] })), stacked: true, fmt: v => plF(v, 1), tickFmt: v => plF(v), thick: 14, onClick: r => { if (!r.other) atPick('sec', r.key); } });
  return { legend: S.map((s, i) => ({ name: s[0], c: col[i] })), table: { headers: ['Section', ...S.map(s => s[0] + ' h'), 'Total OT h'], rows: g.map(x => [x.k, ...S.map(s => sm(x, s[1])), sm(x, 'ot')]) } }; } });
AT_DEFS.push({ id: 'heat', title: 'When does each location clock in?', sub: 'Number of IN punches by work location and hour', span: 's12', draw(host, c) {
  const locs = atFold(atGroup(c.rows.filter(r => r.inT != null), 'loc'), 10, x => x.rows.length); if (!locs.length) { plEmpty(host, 'No IN punches.'); return {}; } const cnt = Array.from({ length: 24 }, () => 0);
  locs.forEach(x => x.rows.forEach(r => cnt[Math.floor(r.inT / 60)]++)); let a = 0, b = 23; while (a < 23 && !cnt[a]) a++; while (b > a && !cnt[b]) b--; const hs = []; for (let h = a; h <= b; h++) hs.push(h);
  const vals = locs.map(x => hs.map(h => x.rows.filter(r => Math.floor(r.inT / 60) === h).length || null)); plcHeat(host, { rows: locs.map(x => x.k), cols: hs.map(h => atPad(h)), vals, fmt: v => plF(v), measure: 'IN punches' });
  return { table: { headers: ['Location', ...hs.map(h => atPad(h) + ':00')], rows: locs.map((x, i) => [x.k, ...vals[i].map(v => v || 0)]) } }; } });
AT_DEFS.push({ id: 'attn', title: 'Needs attention', sub: 'Absent, no punch, or only one punch — most recent day first', span: 's12', draw(host, c) {
  const L = c.rows.filter(r => ['Absent', 'No punch', 'One punch'].includes(r.st)).sort((a, b) => b.date.localeCompare(a.date) || a.st.localeCompare(b.st) || a.name.localeCompare(b.name)), show = L.slice(0, 40); if (!L.length) { plEmpty(host, 'Nobody to flag.'); return {}; }
  const H = ['Date', 'Employee no', 'Name', 'Position', 'Work location', 'Section', 'Supervisor', 'Status', 'IN', 'OUT', 'Shift code'], row = r => [atDateLabel(r.date), r.id, r.name, r.pos, r.loc, r.sec, r.sup, r.st, atHM(r.inT), atHM(r.outT), r.shift];
  host.innerHTML = `<div class="table-wrap" style="max-height:340px"><table class="pl-tbl"><thead><tr>${H.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${show.map(r => `<tr>${row(r).map((v, i) => i === 7 ? `<td><span class="at-chip" style="background:${stCol(r.st, plT())}22;color:${stCol(r.st, plT())}">${plEsc(v)}</span></td>` : `<td>${plEsc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${L.length > show.length ? `<div class="text-sm" style="color:var(--gray-500);margin-top:4px;">Showing ${show.length} of ${L.length} — see the Records tab for the full list.</div>` : ''}`;
  return { table: { headers: H, rows: L.map(row) } }; } });

/* ---------- records tab ---------- */
const RC_COLS = [['Date', r => atDateLabel(r.date), r => r.date], ['Employee no', r => r.id], ['Name', r => r.name], ['Position', r => r.pos], ['Work location', r => r.loc], ['Section', r => r.sec], ['Supervisor', r => r.sup], ['Shift code', r => r.shift], ['IN', r => atHM(r.inT), r => r.inT == null ? -1 : r.inT], ['OUT', r => atHM(r.outT), r => r.outT == null ? -1 : r.outT], ['Required h', r => r.req, r => r.req], ['Work h', r => r.work, r => r.work], ['Total OT h', r => r.ot, r => r.ot], ['Status', r => r.st], ['Remarks', r => r.rem]];
function atSortRows(rows, cols, s) { if (!s) return rows; const c = cols[s.i]; if (!c) return rows; const g = c[2] || c[1]; return rows.slice().sort((a, b) => { const x = g(a), y = g(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), undefined, { numeric: true })) * s.d; }); }
function atTblDraw(tbl, cols, rows, sortKey, shown, moreBtn, chip) {
  const s = at.sort[sortKey], R = atSortRows(rows, cols, s), sh = R.slice(0, shown);
  tbl.querySelector('thead').innerHTML = '<tr>' + cols.map((c, i) => `<th data-i="${i}" style="cursor:pointer" title="Sort">${plEsc(c[0])}${s && s.i === i ? (s.d > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr>';
  tbl.querySelector('tbody').innerHTML = sh.map(r => '<tr>' + cols.map((c, i) => { const v = c[1](r); return chip && chip(c, r, v) || `<td>${plEsc(v == null ? '' : v)}</td>`; }).join('') + '</tr>').join('') || `<tr><td colspan="${cols.length}" style="padding:16px;text-align:center;color:var(--gray-400);font-style:italic;">No rows for the current filters.</td></tr>`;
  moreBtn.style.display = R.length > shown ? '' : 'none'; moreBtn.textContent = `Show 200 more rows (${R.length - shown} left)`;
  tbl.querySelector('thead').onclick = e => { const th = e.target.closest('th[data-i]'); if (!th) return; const i = +th.dataset.i; at.sort[sortKey] = s && s.i === i ? { i, d: -s.d } : { i, d: 1 }; atTblDraw(tbl, cols, rows, sortKey, shown, moreBtn, chip); };
}
const atChipTd = (r, st) => { const T = plT(); return `<td><span class="at-chip" style="background:${stCol(st, T)}22;color:${stCol(st, T)}">${plEsc(st)}</span></td>`; };
function rcRender() { const V = atView(); PLQ('#rcInfo').textContent = `— ${plF(V.length)} of ${plF(at.rows.length)} records`; atTblDraw(PLQ('#rcTable'), RC_COLS, V, 'rc', at.rcShown, PLQ('#rcMore'), (c, r, v) => c[0] === 'Status' ? atChipTd(r, r.st) : null); }
const rcData = () => { const V = atSortRows(atView(), RC_COLS, at.sort.rc); return { title: 'Staff attendance records', sheet: 'Attendance', note: `${plF(V.length)} record(s) · ${atDates().map(atDateLabel).join(', ')}`, headers: RC_COLS.map(c => c[0]), rows: V.map(r => RC_COLS.map(c => { const v = c[1](r); return v == null ? '' : v; })), totalRow: false }; };

/* ---------- roster vs actual ---------- */
const CM_RES = { 'On time': 'good', 'Off / leave as planned': 'good', 'Late arrival': 'warn', 'Early leave': 'warn', 'Late & early leave': 'warn', 'Missing punch-out': 'warn', 'Missing punch-in': 'warn', 'Still on shift': 'info', 'Shift mismatch': 'warn', 'Absent': 'crit', 'Leave (HR) — planned to work': 'crit', 'No attendance record': 'crit', 'Attended on day off': 'info', 'Leave but attended': 'info', 'No plan (attended)': 'mute', 'No plan': 'mute' };
const CM_HEX = { 'On time': '#0ca30c', 'Off / leave as planned': '#9bd69b', 'Late arrival': '#fab219', 'Early leave': '#ec835a', 'Late & early leave': '#b4531f', 'Missing punch-out': '#8e6fd0', 'Missing punch-in': '#b9a0ea', 'Still on shift': '#2a78d6', 'Shift mismatch': '#d65db1', 'Absent': '#d03b3b', 'Leave (HR) — planned to work': '#7f1d1d', 'No attendance record': '#a1264b', 'Attended on day off': '#1b9aaa', 'Leave but attended': '#6cc3cf', 'No plan (attended)': '#94a3b8', 'No plan': '#cbd5e1' };
const cmCol = res => CM_HEX[res] || '#94a3b8';
const cmTypeOf = m => m >= 300 && m < 900 ? 'Day' : 'Night';
function cmBuild() {
  const base = PLQ('#cmBase').value, V = atView(), last = atLast(), dates = [...new Set(at.rows.map(r => r.date))].sort(), covered = new Set(dates.filter(d => Object.keys(ro.days[d] || {}).length || Object.keys(ro.status[d] || {}).length));
  const byId = new Map(ro.staff.map(s => [atKey(s.id), s])), byNm = new Map(ro.staff.map(s => [atNm(s.name), s])), out = [], seen = new Set();
  const plan = (r, s) => { let p = null;
    if (base !== 'shift' && s && covered.has(r.date)) { const x = roPerson(r.date, s.id), f = roM(x.from), t = roM(x.to); p = { kind: x.pill, f, t, h: x.hours, src: 'Roster', shift: x.pill === 'Off' || x.pill === 'Leave' ? x.pill : (x.shift || x.pill) }; if (p.f == null && !['Off', 'Leave'].includes(p.kind)) p = null; }
    if (!p && base !== 'roster' && r.sFrom != null) { let h = r.sTo - r.sFrom; if (h <= 0) h += 1440; p = { kind: r.sType, f: r.sFrom, t: r.sTo, h: h / 60, src: 'Shift code', shift: r.sType + ' Shift' }; } return p; };
  const evalRow = (r, p, s) => {
    const o = { r, s, p, res: '', inD: null, outD: null, ph: p ? p.h : null, ah: r ? atHours(r) : 0 }, worked = r && (r.st === 'Present' || r.st === 'One punch');
    if (!r) { o.res = 'No attendance record'; return o; }
    if (!p) { o.res = worked ? 'No plan (attended)' : 'No plan'; return o; }
    if (p.kind === 'Off' || p.kind === 'Leave') { o.res = worked ? (p.kind === 'Leave' ? 'Leave but attended' : 'Attended on day off') : 'Off / leave as planned'; return o; }
    if (r.st === 'Leave') { o.res = 'Leave (HR) — planned to work'; return o; } if (!worked) { o.res = 'Absent'; return o; }
    if (r.inT != null) o.inD = atWrap(r.inT - p.f); if (r.outT != null && p.t != null) o.outD = atWrap(r.outT - p.t);
    if (r.outT == null) o.res = r.date === last ? 'Still on shift' : 'Missing punch-out'; else if (r.inT == null) o.res = 'Missing punch-in';
    else { const late = o.inD > at.grace, early = o.outD < -at.grace; o.res = late && early ? 'Late & early leave' : late ? 'Late arrival' : early ? 'Early leave' : 'On time'; if ((p.kind === 'Day' || p.kind === 'Night') && cmTypeOf(r.inT) !== p.kind) o.res = 'Shift mismatch'; }
    if (r.outT == null && r.inT != null && (p.kind === 'Day' || p.kind === 'Night') && cmTypeOf(r.inT) !== p.kind) o.res = 'Shift mismatch'; return o; };
  V.forEach(r => { const s = byId.get(atKey(r.id)) || byNm.get(atNm(r.name)); if (s) seen.add(r.date + '|' + s.id); out.push(evalRow(r, plan(r, s), s)); });
  if (base !== 'shift' && !atFiltersActive(['date'])) { const qs = at.q.map(t => String(t).toLowerCase().trim()).filter(Boolean), dsel = at.f.date && at.f.date.length ? at.f.date : dates;
    dsel.filter(d => covered.has(d)).forEach(d => ro.staff.filter(s => s.active !== false).forEach(s => { if (seen.has(d + '|' + s.id)) return; const x = roPerson(d, s.id); if (['Off', 'Leave'].includes(x.pill) || roM(x.from) == null) return; if (qs.length && !qs.some(t => (s.id + ' ' + s.name + ' ' + s.role).toLowerCase().includes(t))) return;
      const fake = { date: d, id: s.id, name: s.name, pos: s.role, loc: '', sec: '', sup: '', st: 'No punch', inT: null, outT: null, req: 0, work: 0, ot: 0, shift: '', rem: 'Not in the attendance report' }; out.push(Object.assign(evalRow(fake, { kind: x.pill, f: roM(x.from), t: roM(x.to), h: x.hours, src: 'Roster', shift: x.shift || x.pill }, s), { res: 'No attendance record', ph: x.hours })); })); }
  return { rows: out, covered, dates };
}
const CM_COLS = [['Date', o => atDateLabel(o.r.date), o => o.r.date], ['Employee no', o => o.r.id], ['Name', o => o.r.name], ['Position', o => o.r.pos], ['Section', o => o.r.sec], ['Supervisor', o => o.r.sup], ['Plan from', o => o.p ? o.p.src : '—'], ['Planned shift', o => o.p ? o.p.shift : '—'], ['Planned IN', o => o.p && o.p.f != null ? atHM(o.p.f) : '', o => o.p && o.p.f != null ? o.p.f : -1], ['Planned OUT', o => o.p && o.p.t != null ? atHM(o.p.t) : '', o => o.p && o.p.t != null ? o.p.t : -1], ['Actual IN', o => atHM(o.r.inT), o => o.r.inT == null ? -1 : o.r.inT], ['Actual OUT', o => atHM(o.r.outT), o => o.r.outT == null ? -1 : o.r.outT], ['IN vs plan (min)', o => atSigned(o.inD), o => o.inD == null ? -9999 : o.inD], ['OUT vs plan (min)', o => atSigned(o.outD), o => o.outD == null ? -9999 : o.outD], ['Planned h', o => o.ph == null ? '' : Math.round(o.ph * 10) / 10, o => o.ph == null ? -1 : o.ph], ['Actual h', o => o.ah ? Math.round(o.ah * 10) / 10 : '', o => o.ah], ['Result', o => o.res]];
const cmIsExc = o => CM_RES[o.res] !== 'good' && !['No plan', 'No plan (attended)'].includes(o.res);
let cmCache = null;
function cmRows() { if (!cmCache) cmCache = cmBuild(); let R = cmCache.rows; if (PLQ('#cmShow').value === 'exc') R = R.filter(cmIsExc); if (at.cmRes) R = R.filter(o => o.res === at.cmRes); return R; }
function cmKpis() {
  const A = cmCache.rows, pl0 = A.filter(o => o.p && !['Off', 'Leave'].includes(o.p.kind)), pl = pl0.filter(o => o.res !== 'Still on shift'), n = pl.length, c = (...rs) => pl.filter(o => rs.includes(o.res)).length, K = atKpi;
  const ids = pl.filter(o => o.inD != null), avg = ids.length ? ids.reduce((a, o) => a + o.inD, 0) / ids.length : null, cd = pl.filter(o => o.r.st === 'Present'), ph = cd.reduce((a, o) => a + (o.ph || 0), 0), ah = cd.reduce((a, o) => a + o.ah, 0), un = A.filter(o => ['Attended on day off', 'Leave but attended', 'No plan (attended)'].includes(o.res)).length;
  PLQ('#cmKpis').innerHTML = K('Planned to work', plF(pl0.length), `${plF(A.length)} person-days compared · ${plF(pl0.length - n)} still on shift`) + K('Followed the plan', n ? plP(c('On time') / n, 0) : '—', `${plF(c('On time'))} of ${plF(n)} on time (excl. still on shift)`, 'cm:On time') + K('Late arrivals', plF(c('Late arrival', 'Late & early leave')), n ? plP(c('Late arrival', 'Late & early leave') / n, 0) + ` of planned · grace ${at.grace} min` : '', 'cm:Late arrival') + K('Early leavers', plF(c('Early leave', 'Late & early leave')), 'left before planned end', 'cm:Early leave')
    + K('Absent vs plan', plF(c('Absent', 'No attendance record', 'Leave (HR) — planned to work')), n ? plP(c('Absent', 'No attendance record', 'Leave (HR) — planned to work') / n, 0) : '', 'cm:Absent') + K('Missing punch', plF(c('Missing punch-out', 'Missing punch-in')), `${plF(c('Still on shift'))} still on shift`, 'cm:Missing punch-out') + K('Unplanned attendance', plF(un), 'worked on an off / leave / unplanned day', 'cm:Attended on day off') + K('Shift mismatch', plF(c('Shift mismatch')), 'IN time fits the other shift', 'cm:Shift mismatch')
    + K('Avg arrival', avg == null ? '—' : atSigned(avg) + ' min', 'vs planned start (+ = late)') + K('Planned vs actual hours', `${plF(ah, 0)} / ${plF(ph, 0)} h`, ph ? plP(ah / ph, 0) + ' of planned · complete days only' : '');
}
const CM_DEFS = [];
const cmPickRes = res => { at.cmRes = at.cmRes === res ? '' : res; cmRender(true); };
CM_DEFS.push({ id: 'cmmix', title: 'Roster vs actual — outcome', sub: 'Click a slice to filter the table', span: 's5', draw(host, c) { const R = cmCache.rows, res = Object.keys(CM_RES).filter(k => R.some(o => o.res === k)), sl = res.map(k => ({ label: k, value: R.filter(o => o.res === k).length, color: cmCol(k) })); plcDonut(host, { slices: sl, center: { value: plF(R.length), label: 'person-days' }, unit: 'person-days', onClick: s => cmPickRes(s.label) }); return { table: { headers: ['Result', 'Person-days', 'Share'], rows: sl.map(s => [s.label, s.value, R.length ? plP(s.value / R.length, 1) : '']) } }; } });
const cmStack = (id, title, sub, key, span) => CM_DEFS.push({ id, title, sub, span, draw(host, c) { const R = cmCache.rows, g = atFold(atGroup(R.map(o => Object.assign({ _o: o }, { k: o.r[key] })), 'k').map(x => ({ k: x.k, rows: x.rows.map(y => y._o) })), 10, x => x.rows.length), res = Object.keys(CM_RES).filter(k => R.some(o => o.res === k)), n = (x, k) => x.rows.filter(o => o.res === k).length;
  plcBarsH(host, { rows: g.map(x => ({ label: x.k, key: x.k, other: x.other, vals: res.map(k => n(x, k)), tip: res.filter(k => n(x, k)).map(k => ({ c: cmCol(k), k, v: plF(n(x, k)) })) })), series: res.map(k => ({ name: k, color: cmCol(k) })), stacked: true, fmt: v => plF(v), tickFmt: v => plF(v), thick: 14 });
  return { legend: res.map(k => ({ name: k, c: cmCol(k) })), table: { headers: [key, ...res, 'Total'], rows: g.map(x => [x.k, ...res.map(k => n(x, k)), x.rows.length]) } }; } });
cmStack('cmsec', 'Outcome by section', 'Where the plan is not followed', 'sec', 's7');
const cmBuckets = (id, title, sub, field, edges, labels, span, sign) => CM_DEFS.push({ id, title, sub, span, draw(host, c) { const V = cmCache.rows.filter(o => o[field] != null), n = i => V.filter(o => { const v = o[field]; return (i === 0 || v >= edges[i - 1]) && (i === edges.length || v < edges[i]); }).length, cols = labels.map((l, i) => ({ label: l, vals: [n(i)], tip: [{ c: i === sign ? c.T.good : c.T.act, k: 'Person-days', v: plF(n(i)) }] }));
  plcCols(host, { cats: cols, series: [{ name: 'Person-days', color: c.T.act }], fmt: v => plF(v), labelFn: (cat, v) => v ? plF(v) : '', height: 240 }); return { table: { headers: ['Bucket', 'Person-days'], rows: labels.map((l, i) => [l, n(i)]) } }; } });
cmBuckets('cmin', 'Arrival vs planned start', 'Minutes after (+) or before (−) the planned IN time', 'inD', [-60, -30, -15, 15, 30, 60], ['> 60 early', '30–60 early', '15–30 early', 'On time (±15)', '15–30 late', '30–60 late', '> 60 late'], 's6', 3);
cmBuckets('cmout', 'Departure vs planned end', 'Minutes after (+) or before (−) the planned OUT time', 'outD', [-60, -30, -15, 15, 30, 60], ['> 60 early', '30–60 early', '15–30 early', 'On time (±15)', '15–30 later', '30–60 later', '> 60 later'], 's6', 3);
CM_DEFS.push({ id: 'cmhrs', title: 'Planned vs actual hours', sub: 'Total hours per section — people with both punches', span: 's6', draw(host, c) { const P = cmCache.rows.filter(o => o.p && !['Off', 'Leave'].includes(o.p.kind) && o.r.st === 'Present'), g = atFold(atGroup(P.map(o => ({ _o: o, k: o.r.sec })), 'k').map(x => ({ k: x.k, rows: x.rows.map(y => y._o) })), 10, x => x.rows.length), ph = x => x.rows.reduce((a, o) => a + (o.ph || 0), 0), ah = x => x.rows.reduce((a, o) => a + (o.r.st === 'Present' || o.r.st === 'One punch' ? o.ah : 0), 0);
  plcBarsH(host, { rows: g.map(x => ({ label: x.k, key: x.k, other: x.other, vals: [ph(x), ah(x)], tip: [{ c: c.T.fc, k: 'Planned', v: plF(ph(x), 0) + ' h' }, { c: c.T.act, k: 'Actual', v: plF(ah(x), 0) + ' h' }] })), series: [{ name: 'Planned h', color: c.T.fc }, { name: 'Actual h', color: c.T.act }], fmt: v => plF(v, 0), tickFmt: v => plF(v), thick: 14 });
  return { legend: [{ name: 'Planned h', c: c.T.fc }, { name: 'Actual h', c: c.T.act }], table: { headers: ['Section', 'Planned h', 'Actual h', 'Actual %'], rows: g.map(x => [x.k, ph(x), ah(x), ph(x) ? plP(ah(x) / ph(x), 0) : '']) } }; } });
cmStack('cmsup', 'Outcome by supervisor', 'Which team deviates from the roster most', 'sup', 's6');
function cmRender(tableOnly) {
  if (!tableOnly || !cmCache) cmCache = cmBuild(); const T = PLQ('#cmTable'), A = cmCache, plannedDates = A.dates.filter(d => A.covered.has(d));
  PLQ('#cmCover').innerHTML = plannedDates.length ? `✔ ${plannedDates.length} of ${A.dates.length} attendance date(s) have a roster: <strong>${plannedDates.map(atDateLabel).join(', ')}</strong>` + (plannedDates.length < A.dates.length ? `<br><span style="color:#b45309">No roster for ${A.dates.filter(d => !A.covered.has(d)).map(atDateLabel).join(', ')} — those rows use the shift code${PLQ('#cmBase').value === 'roster' ? ' is NOT used (Roster only) → no plan' : ''}.</span>` : '') : '<span style="color:#b45309">⚠ The Staff Roster has no plan for any attendance date. Fill the daily availability (or switch to the shift code).</span>';
  cmKpis(); const R = cmRows(); PLQ('#cmInfo').innerHTML = `— ${plF(R.length)} of ${plF(A.rows.length)} rows` + (at.cmRes ? ` · filtered: <strong>${plEsc(at.cmRes)}</strong> <a href="#" id="cmClr">✖ clear</a>` : '');
  const cl = PLQ('#cmClr'); if (cl) cl.onclick = e => { e.preventDefault(); at.cmRes = ''; cmRender(true); };
  atTblDraw(T, CM_COLS, R, 'cm', at.shown, PLQ('#cmMore'), (c, o) => c[0] === 'Result' ? `<td><span class="at-chip" style="background:${cmCol(o.res)}22;color:${cmCol(o.res)}">${plEsc(o.res)}</span></td>` : (c[0] === 'IN vs plan (min)' && o.inD > at.grace) || (c[0] === 'OUT vs plan (min)' && o.outD < -at.grace) ? `<td style="color:#b42318;font-weight:600">${plEsc(c[1](o))}</td>` : null);
  if (!tableOnly) atDrawGrid(PLQ('#cmGrid'), CM_DEFS, { rows: () => cmCache.rows });
}
const cmData = () => { const R = atSortRows2(cmRows()); return { title: 'Roster vs actual attendance', sheet: 'Roster vs actual', note: `${plF(R.length)} row(s) · grace ${at.grace} min · plan from ${PLQ('#cmBase').selectedOptions[0].textContent}`, headers: CM_COLS.map(c => c[0]), rows: R.map(o => CM_COLS.map(c => { const v = c[1](o); return v == null ? '' : v; })), totalRow: false }; };
const atSortRows2 = R => at.sort.cm ? atSortRows(R, CM_COLS, at.sort.cm) : R;

