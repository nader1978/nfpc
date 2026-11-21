/* ============================================================
   DRIVER CHECKLIST — a tab of the Logistics dashboard / Trip Planning ("✅ Driver checklist")
   Source : TrlsDrivers_CheckList_tbl (the drivers' daily vehicle checklist entered in the mobile app)
   Shows  : KPIs, daily trend, failed checklist items, scratches by side, compliance values, per-driver and per-unit tables and the failed checklists.
   A checklist item = every Yes/No column of the list (✔ = OK, ✖ = failed); scratches = the numeric "…Scratches" columns.
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nz = s => String(s || '').toLowerCase().replace(/_x[0-9a-f]{4}_/g, '').replace(/[^a-z0-9]/g, '');
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dayOf = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? String(v).slice(0, 10) : ymd(d); };
  const tmOf = v => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''; };
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }, pct = (a, b) => b ? Math.round(a / b * 100) : null, f0 = v => Math.round(v).toLocaleString();
  const LIST = 'TrlsDrivers_CheckList_tbl';
  const S = { rows: [], items: [], scr: [], f: {}, from: '', to: '', busy: false, err: '', at: '', loaded: false, comp: false, step: '' };
  { const t = new Date(); S.to = ymd(t); t.setDate(t.getDate() - 29); S.from = ymd(t); }
  const FLAB = { driver: 'Driver', unit: 'Unit', rtype: 'Record type' };

  /* ---------- read ---------- */
  async function load() { const host = frame(); if (!host) return; S.busy = true; S.err = ''; S.t0 = Date.now(); body();
    try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('Sign in first (no Microsoft session).');
      let name = (typeof utGet === 'function' && utGet('lpchk') && utGet('lpchk').list) || LIST; S.name = name;
      S.step = 'Connecting…'; const ids = await resolveIds(site, name, token), cols = await fetchColumns(ids.siteId, ids.listId, token), T = (window.SP_COLT || {})[ids.listId] || {}, M = new Map(); cols.forEach(c => { M.set(nz(c.name), c); if (!M.has(nz(c.displayName))) M.set(nz(c.displayName), c); });
      const col = k => (M.get(nz(k)) || {}).name, dc = col('Trans_Date') || 'Trans_Date', lo = new Date(S.from + 'T00:00:00'); lo.setDate(lo.getDate() - 1);
      S.items = cols.filter(c => c.type === 'boolean').map(c => ({ k: c.name, label: String(c.displayName || c.name).replace(/_/g, ' ').replace(/\s*status$/i, '').trim() }));
      S.scr = cols.filter(c => c.type === 'number' && /scratch|dent|damage/i.test(c.name + ' ' + c.displayName)).map(c => ({ k: c.name, label: String(c.displayName || c.name).replace(/_/g, ' ').replace(/scratch(es)?/i, '').trim() || c.name }));
      S.comp = !!col('Compliance'); S.step = 'Reading ' + name + '…';
      let its; try { its = await exp_fetchFilteredItems(ids.siteId, ids.listId, token, `fields/${dc} ge '${ymd(lo)}T00:00:00Z' and fields/${dc} le '${S.to}T23:59:59Z'`); } catch (e) { its = await fetchAllItems(ids.siteId, ids.listId, token); }
      const g = (f, k) => { const c = col(k); let v = c ? f[c] : undefined; if (v && typeof v === 'object' && !Array.isArray(v)) v = v.Value || v.LookupValue || v.Title || v.Email || ''; return v == null ? '' : v; };
      S.rows = its.map(it => { const f = it.fields || {}, day = dayOf(g(f, 'Trans_Date')), fails = S.items.filter(x => f[x.k] === false).map(x => x.label), scr = {}; let sc = 0; S.scr.forEach(x => { const n = num(f[x.k]); scr[x.label] = n; sc += n; });
          const unit = String(g(f, 'Title') || g(f, 'FL_Code') || g(f, 'FLCode') || g(f, 'Unit_Nr')).trim(), comp = String(g(f, 'Compliance')).trim();
          return { id: it.id, day, time: tmOf(g(f, 'Time_Stamp')), driver: String(g(f, 'User_Name')).trim() || '—', emp: String(g(f, 'EMP_ID')).trim().replace(/\.0+$/, ''), unit: unit || '—', rtype: String(g(f, 'Record_Type')).trim() || '—', fails, nItems: S.items.filter(x => f[x.k] === true || f[x.k] === false).length, scr, sc, km: num(g(f, 'Total_KMs')), rem: String(g(f, 'Remarks')).trim(), comp, ok: !fails.length && !sc }; })
        .filter(r => r.day && r.day >= S.from && r.day <= S.to);
      S.at = new Date().toLocaleTimeString(); S.loaded = true;
    } catch (e) { S.err = e.message || String(e); } S.busy = false; body(); }

  /* ---------- data ---------- */
  const pass = (r, skip) => ['driver', 'unit', 'rtype'].every(k => k === skip || !(S.f[k] || []).length || S.f[k].includes(r[k]));
  const shown = () => S.rows.filter(r => pass(r));
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n || 1);
  function group(R, key) { const m = new Map(); R.forEach(r => { const k = r[key]; let o = m.get(k); if (!o) { o = { k, n: 0, bad: 0, fails: 0, sc: 0, km: 0, last: '', ff: new Map(), emp: r.emp }; m.set(k, o); } o.n++; if (!r.ok) o.bad++; o.fails += r.fails.length; o.sc += r.sc; o.km += r.km; if (r.day > o.last) o.last = r.day; r.fails.forEach(x => o.ff.set(x, (o.ff.get(x) || 0) + 1)); }); return [...m.values()]; }

  /* ---------- screen ---------- */
  const css = document.createElement('style'); css.textContent = '#ckBox .k-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin:10px 0}#ckBox .k{padding:12px 15px;border:1px solid var(--border,#e2e8f0);border-radius:14px;color:#fff;display:flex;flex-direction:column;gap:2px;min-height:84px}#ckBox .k span{font-size:12.5px;font-weight:600}#ckBox .k b{font-size:28px;line-height:1.1}#ckBox .k small{font-size:11.5px;opacity:.9}' +
    '#ckBox .c-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:12px;margin:10px 0}#ckBox .c{border:1px solid var(--border,#e2e8f0);border-radius:14px;padding:12px 14px;background:var(--card,#fff)}#ckBox .c h4{margin:0 0 8px;font-size:14px}#ckBox .br{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:12.5px}#ckBox .br .l{width:130px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#ckBox .br .t{flex:1;height:14px;border-radius:7px;background:#eef2f7;overflow:hidden}#ckBox .br .t i{display:block;height:100%;border-radius:7px}#ckBox .br .v{width:90px;flex:none;text-align:right;font-variant-numeric:tabular-nums}' +
    '#ckBox .tr{display:flex;align-items:flex-end;gap:3px;height:150px;padding-top:8px;overflow-x:auto}#ckBox .tr div{flex:1;min-width:14px;display:flex;flex-direction:column;justify-content:flex-end;height:100%;cursor:default}#ckBox .tr i{display:block;width:100%}#ckBox .ck-f{min-width:170px;max-width:260px;flex:1}#ckBox .ck-f .l{font-size:12px;font-weight:600;margin-bottom:2px}#ckBox h3.s{margin:16px 0 6px;font-size:15px}#ckBox .bad{color:#b91c1c;font-weight:700}#ckBox .ok{color:#166534;font-weight:700}';
  document.head.appendChild(css);
  const kd = (t, rows, cols) => { try { return rows && rows.length && window.SDBD ? SDBD.a(t + ' · ' + rows.length, rows, cols) : ''; } catch (e) { return ''; } };
  const K = (bg, l, v, s, rows, cols) => { const d = kd(l, rows, cols); return `<div class="k${d ? ' kp-dl' : ''}" style="background:${bg}"${d}><span>${l}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`; };
  const RC = [['Date', r => r.day], ['Time', r => r.time], ['Driver', r => r.driver], ['EMP ID', r => r.emp], ['Unit', r => r.unit], ['Type', r => r.rtype], ['Failed items', r => r.fails.join(', ')], ['Scratches', r => r.sc || ''], ['KM', r => r.km || ''], ['Remarks', r => r.rem]];
  function frame() { const hostOf = Q('#lpPaneCK') || (() => { const ref = Q('#lpPaneDC'); if (!ref) return null; const d = document.createElement('div'); d.id = 'lpPaneCK'; d.style.display = 'none'; ref.insertAdjacentElement('afterend', d); return d; })(); if (!hostOf) return null; let el = Q('#ckBox'); if (el) return el; el = document.createElement('div'); el.id = 'ckBox';
    el.innerHTML = `<div class="btn-row" style="align-items:center;gap:8px;flex-wrap:wrap;margin:4px 0 8px"><label class="text-sm" style="display:flex;gap:6px;align-items:center;margin:0">From <input type="date" id="ckFrom" value="${S.from}" style="width:auto"></label><label class="text-sm" style="display:flex;gap:6px;align-items:center;margin:0">To <input type="date" id="ckTo" value="${S.to}" style="width:auto"></label>
      <button type="button" class="ghost small" data-ck="7">Last 7 days</button><button type="button" class="ghost small" data-ck="30">Last 30 days</button><button type="button" class="ghost small" data-ck="90">Last 90 days</button><button type="button" class="secondary small" data-ck="re">🔄 Reload</button><span style="flex:1"></span><button type="button" class="ghost small" data-ck="mail">📧 Email</button><button type="button" class="ghost small" data-ck="pr">🖨 Print</button><button type="button" class="ghost small" data-ck="xl">📊 Excel</button><button type="button" class="ghost small" data-ck="clr">✖ Clear filters</button></div>
      <div id="ckFilt" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin:4px 0 6px"></div><div id="ckSum" class="text-sm" style="color:var(--gray-600,#64748b);margin-bottom:4px"></div><div id="ckMain"></div>`;
    hostOf.appendChild(el);
    el.addEventListener('click', e => { const b = e.target.closest('[data-ck]'); if (!b) return; const a = b.dataset.ck;
      if (a === 're') return load();
      if (a === '7' || a === '30' || a === '90') { const t = new Date(); S.to = ymd(t); t.setDate(t.getDate() - (+a - 1)); S.from = ymd(t); Q('#ckFrom').value = S.from; Q('#ckTo').value = S.to; return load(); }
      if (a === 'clr') { S.f = {}; return body(true); }
      const D = data(); if (!D.rows.length) { try { sectionToast('Nothing to show for this selection.', 'warn'); } catch (x) {} return; }
      if (a === 'xl') { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([D.headers, ...D.rows]), 'Drivers'); const R = shown(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([RC.map(c => c[0]), ...R.map(r => RC.map(c => c[1](r)))]), 'Checklists'); XLSX.writeFile(wb, 'Driver_checklist_' + S.from + '_' + S.to + '.xlsx'); }
      if (a === 'pr') w_printTable(D.title, D.note, D.headers, D.rows);
      if (a === 'mail') { window.extMailData = data; wMail_open('ext'); } });
    el.addEventListener('change', e => { if (e.target.id === 'ckFrom' || e.target.id === 'ckTo') { S.from = Q('#ckFrom').value || S.from; S.to = Q('#ckTo').value || S.to; if (S.from > S.to) { const x = S.from; S.from = S.to; S.to = x; Q('#ckFrom').value = S.from; Q('#ckTo').value = S.to; } load(); } });
    return el; }
  function combos(skip) { const box = Q('#ckFilt'); if (!box) return; if (!skip) box.innerHTML = Object.keys(FLAB).map(k => `<div class="ck-f" data-f="${k}"><div class="l">${FLAB[k]}</div></div>`).join('');
    box.querySelectorAll('.ck-f').forEach(h => { const k = h.dataset.f; if (k === skip) return; const old = h.querySelector('.combo'); if (old) old.remove(); const vals = [...new Set(S.rows.filter(r => pass(r, k)).map(r => r[k]))].sort(); try { h.appendChild(buildMultiCombo((S.f[k] || []).filter(v => vals.includes(v)), vals, arr => { S.f[k] = arr; body(); combos(k); }, { placeholder: 'All' })); } catch (e) { console.error(e); } }); }
  const bars = (list, color, max) => { const m = max || Math.max(1, ...list.map(x => x[1])); return list.map(([l, v, t]) => `<div class="br"><span class="l" title="${esc(l)}">${esc(l)}</span><span class="t"><i style="width:${Math.max(2, Math.round(v / m * 100))}%;background:${color}"></i></span><span class="v">${t != null ? t : f0(v)}</span></div>`).join('') || '<div class="text-sm" style="color:#64748b">Nothing to show.</div>'; };
  function data() { const R = shown(), G = group(R, 'driver').sort((a, b) => b.bad - a.bad || b.n - a.n); return { title: 'Driver checklist', sheet: 'Driver checklist', note: S.from + ' → ' + S.to + ' · ' + R.length + ' checklist(s)', headers: ['Driver', 'EMP ID', 'Checklists', 'With issues', 'Clean %', 'Failed items', 'Most frequent failure', 'Scratches', 'KM', 'Last checklist'], rows: G.map(o => [o.k, o.emp, o.n, o.bad, pct(o.n - o.bad, o.n) + '%', o.fails, (top(o.ff)[0] || ['', ''])[0], o.sc, Math.round(o.km), o.last]) }; }
  const tbl = (head, rows, nums) => `<div class="fd-wrap"><table class="fd-tbl" style="width:100%"><thead><tr>${head.map((h, i) => `<th${nums.includes(i) ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" style="text-align:center;padding:14px">No records.</td></tr>`}</tbody></table></div>`;
  function body(retab) { const el = Q('#ckBox'); if (!el) return; const M = Q('#ckMain'), sm = Q('#ckSum');
    if (S.busy && !S.loaded) { M.innerHTML = `<div style="padding:40px;text-align:center" class="text-sm">⏳ Reading the driver checklists…<br><span>${esc(S.step)}</span></div>`; sm.innerHTML = ''; return; }
    if (S.err) { M.innerHTML = `<div style="padding:30px;text-align:center"><b>⚠ ${esc(S.err)}</b><div class="text-sm" style="margin-top:6px">List: “${esc(S.name || LIST)}” — check the list name (Upload Destinations) and press 🔄 Reload.</div></div>`; sm.innerHTML = ''; return; }
    if (!S.loaded) { M.innerHTML = '<div style="padding:30px;text-align:center">Press 🔄 Reload.</div>'; return; }
    if (retab !== false && !Q('#ckFilt .ck-f .combo')) combos();
    const R = shown(), bad = R.filter(r => !r.ok), D = new Set(R.map(r => r.driver)), U = new Set(R.map(r => r.unit)), fails = R.reduce((a, r) => a + r.fails.length, 0), sc = R.reduce((a, r) => a + r.sc, 0), km = R.reduce((a, r) => a + r.km, 0), clean = pct(R.length - bad.length, R.length);
    const itemF = new Map(S.items.map(x => [x.label, 0])), itemN = new Map(S.items.map(x => [x.label, 0])); R.forEach(r => { r.fails.forEach(x => itemF.set(x, (itemF.get(x) || 0) + 1)); });
    S.items.forEach(x => { itemN.set(x.label, R.length); });
    const days = new Map(); R.forEach(r => { let o = days.get(r.day); if (!o) { o = { n: 0, bad: 0 }; days.set(r.day, o); } o.n++; if (!r.ok) o.bad++; }); const dk = [...days.keys()].sort(), mx = Math.max(1, ...dk.map(k => days.get(k).n));
    const side = S.scr.map(x => [x.label || 'Scratches', R.reduce((a, r) => a + (r.scr[x.label] || 0), 0)]), rt = new Map(), cmp = new Map(); R.forEach(r => { rt.set(r.rtype, (rt.get(r.rtype) || 0) + 1); if (S.comp) cmp.set(r.comp || '(empty)', (cmp.get(r.comp || '(empty)') || 0) + 1); });
    const kp = K('linear-gradient(135deg,#2563eb,#3b82f6)', 'Checklists', f0(R.length), 'submitted in the period', R, RC) + K('linear-gradient(135deg,#7c3aed,#a78bfa)', 'Drivers', D.size, 'submitted at least one', R, RC) + K('linear-gradient(135deg,#0891b2,#22d3ee)', 'Units', U.size, 'inspected', R, RC) +
      K('linear-gradient(135deg,#059669,#10b981)', 'Clean checklists', clean == null ? '—' : clean + '%', f0(R.length - bad.length) + ' with every item OK and no scratch', R.filter(r => r.ok), RC) + K('linear-gradient(135deg,#dc2626,#f87171)', 'With issues', f0(bad.length), (pct(bad.length, R.length) ?? '—') + '% of checklists', bad, RC) +
      K('linear-gradient(135deg,#ea580c,#fb923c)', 'Failed items', f0(fails), R.length ? (Math.round(fails / R.length * 10) / 10) + ' per checklist' : '', bad, RC) + K('linear-gradient(135deg,#475569,#64748b)', 'Scratches reported', f0(sc), 'front / rear / left / right', R.filter(r => r.sc), RC) + K('linear-gradient(135deg,#ca8a04,#facc15)', 'KM driven', f0(km), 'sum of Total_KMs', R.filter(r => r.km), RC);
    const trend = dk.length ? `<div class="tr">${dk.map(k => { const o = days.get(k), h = Math.round(o.n / mx * 130), hb = Math.round(o.bad / mx * 130); return `<div title="${k}: ${o.n} checklist(s), ${o.bad} with issues"><i style="height:${hb}px;background:#ef4444"></i><i style="height:${h - hb}px;background:#3b82f6"></i></div>`; }).join('')}</div><div class="text-sm" style="display:flex;justify-content:space-between;color:#64748b"><span>${dk[0]}</span><span><span style="color:#3b82f6">■</span> OK · <span style="color:#ef4444">■</span> with issues</span><span>${dk[dk.length - 1]}</span></div>` : '<div class="text-sm">No records.</div>';
    const fl = [...itemF.entries()].sort((a, b) => b[1] - a[1]).map(([l, v]) => [l, v, f0(v) + ' · ' + (pct(v, R.length) ?? 0) + '%']);
    const G = group(R, 'driver').sort((a, b) => b.bad - a.bad || b.n - a.n), GU = group(R, 'unit').sort((a, b) => b.bad - a.bad || b.n - a.n);
    const pc = (o) => { const p = pct(o.n - o.bad, o.n); return `<span class="${p >= 90 ? 'ok' : p < 70 ? 'bad' : ''}">${p}%</span>`; };
    const dr = G.map(o => `<tr><td><b>${esc(o.k)}</b></td><td>${esc(o.emp)}</td><td class="n">${o.n}</td><td class="n">${o.bad}</td><td class="n">${pc(o)}</td><td class="n">${o.fails}</td><td>${esc((top(o.ff)[0] || ['—'])[0])}</td><td class="n">${o.sc || ''}</td><td class="n">${o.km ? f0(o.km) : ''}</td><td>${o.last}</td></tr>`);
    const un = GU.map(o => `<tr><td><b>${esc(o.k)}</b></td><td class="n">${o.n}</td><td class="n">${o.bad}</td><td class="n">${pc(o)}</td><td class="n">${o.fails}</td><td>${esc((top(o.ff)[0] || ['—'])[0])}</td><td class="n">${o.sc || ''}</td><td>${o.last}</td></tr>`);
    const det = bad.slice().sort((a, b) => b.day.localeCompare(a.day) || String(b.time).localeCompare(String(a.time))).slice(0, 300).map(r => `<tr><td>${r.day}</td><td>${r.time}</td><td>${esc(r.driver)}</td><td><b>${esc(r.unit)}</b></td><td>${esc(r.rtype)}</td><td class="bad">${esc(r.fails.join(', '))}</td><td class="n">${r.sc || ''}</td><td>${esc(r.rem)}</td></tr>`);
    M.innerHTML = `<div class="k-g">${kp}</div><div class="c-g"><div class="c"><h4>📅 Checklists per day</h4>${trend}</div><div class="c"><h4>✖ Failed checklist items</h4>${bars(fl, '#ef4444', Math.max(1, R.length))}</div>` +
      `<div class="c"><h4>🧰 Scratches reported by side</h4>${bars(side, '#f59e0b')}<h4 style="margin-top:12px">🧾 Record type</h4>${bars([...rt.entries()], '#3b82f6')}</div>` + (S.comp ? `<div class="c"><h4>✅ Compliance (as recorded in the list)</h4>${bars(top(cmp, 8), '#10b981')}</div>` : '') + `</div>` +
      `<h3 class="s">👷 By driver</h3>${tbl(['Driver', 'EMP ID', 'Checklists', 'With issues', 'Clean %', 'Failed items', 'Most frequent failure', 'Scratches', 'KM', 'Last checklist'], dr, [2, 3, 4, 5, 7, 8])}` +
      `<h3 class="s">🚛 By unit</h3>${tbl(['Unit', 'Checklists', 'With issues', 'Clean %', 'Failed items', 'Most frequent failure', 'Scratches', 'Last checklist'], un, [1, 2, 3, 4, 6])}` +
      `<h3 class="s">🔧 Checklists with issues${bad.length > 300 ? ' (latest 300 of ' + bad.length + ')' : ''}</h3>${tbl(['Date', 'Time', 'Driver', 'Unit', 'Type', 'Failed items', 'Scratches', 'Remarks'], det, [6])}<div class="text-sm" style="color:var(--gray-600);margin-top:8px">A checklist is “clean” when every Yes/No item is ticked OK and no scratch is reported. Failed item = an unticked Yes/No column.</div>`;
    sm.innerHTML = `${S.busy ? '⏳ reading… · ' : ''}<b>${R.length}</b> of ${S.rows.length} checklist(s) · “${esc(S.name)}” · read ${esc(S.at)}`; }
  function show() { const el = frame(); if (!el) return; const p = Q('#lpPaneCK'); if (p) p.style.display = ''; if (!S.loaded && !S.busy) load(); else { if (!Q('#ckFilt .ck-f .combo')) combos(); body(false); } }
  window.driverChecklist = { show, load, S };
})();
