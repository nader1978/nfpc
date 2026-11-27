/* ============================================================
   🚛 OPEN TRIPS (Logistics) — the trips that are started and not closed yet, with the option to close (or cancel) them
   · reads the same trip store as the Logistics dashboard (TRX) · tabs: Started · Not started (old dates) · Closed (last 7 days)
   · Close trip = what the driver's "Close trip" does (Trip_Closed, Trip_Status Completed, Task_Type End Trip, TimeStamp_End, CLS-<id> log row)
     but done by the logistics team: a reason is required, the end ODO / destination are optional, and the action is written in Remarks + Changes_Data_Hstry
   · Cancel trip = Trip_Status Cancelled, Task_Type Cancel Trip, CXL-<id> log row
   ============================================================ */
(function () {
  'use strict';
  const Q = s => document.querySelector(s), QA = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (m, k) => { try { sectionToast(m, k || 'success'); } catch (e) { } };
  const pad = n => String(n).padStart(2, '0'), dmy = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : (s || ''); };
  const hm = t => { const d = new Date(t); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dur = h => h >= 48 ? Math.floor(h / 24) + 'd ' + Math.round(h % 24) + 'h' : h >= 1 ? Math.floor(h) + 'h ' + pad(Math.round((h % 1) * 60)) + 'm' : Math.max(1, Math.round(h * 60)) + ' min';
  const me = () => { try { return (currentUser && (currentUser.name || currentUser.username || currentUser.email)) || 'ORBIT'; } catch (e) { return 'ORBIT'; } };
  const M = { tab: 'started', q: '', reg: '', min: 0, df: '', dt: '', sel: new Set(), busy: false, msg: '' };

  const css = document.createElement('style'); css.textContent = `
#view-lgtrips .ot-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:6px 0 12px}
#view-lgtrips .ot-k>div{background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-left:4px solid var(--c,#2563eb);border-radius:10px;padding:9px 12px}
#view-lgtrips .ot-k b{display:block;font-size:22px;line-height:1.1}#view-lgtrips .ot-k span{font-size:11.5px;color:var(--gray-500,#6b7280)}
#view-lgtrips .ot-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
#view-lgtrips .ot-bar input[type=search],#view-lgtrips .ot-bar input[type=date],#view-lgtrips .ot-bar select{height:34px;border:1px solid var(--border,#cbd5e1);border-radius:8px;padding:0 10px;font-size:13px;background:var(--card,#fff);color:inherit;width:auto}
#view-lgtrips .ot-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
#view-lgtrips .ot-tabs button{border:1px solid var(--border,#cbd5e1);background:var(--card,#fff);color:inherit;border-radius:999px;padding:6px 13px;font-size:13px;cursor:pointer}
#view-lgtrips .ot-tabs button.on{background:#1d4ed8;color:#fff;border-color:#1d4ed8;font-weight:600}
#view-lgtrips .ot-w{overflow:auto;border:1px solid var(--border,#e5e7eb);border-radius:10px;max-height:calc(100vh - 360px);min-height:120px}
#view-lgtrips table.ot-t{border-collapse:collapse;width:100%;font-size:12.5px}
#view-lgtrips .ot-t th{position:sticky;top:0;background:var(--gray-100,#eef2f7);text-align:left;padding:7px 8px;white-space:nowrap;z-index:1}
#view-lgtrips .ot-t td{padding:6px 8px;border-top:1px solid var(--border,#eef0f3);vertical-align:top}
#view-lgtrips .ot-t tr.o1 td{background:rgba(245,158,11,.10)}#view-lgtrips .ot-t tr.o2 td{background:rgba(239,68,68,.10)}
#view-lgtrips .ot-p{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:700;color:#fff;background:#2563eb;white-space:nowrap}
#view-lgtrips .ot-p.g{background:#16a34a}#view-lgtrips .ot-p.r{background:#dc2626}#view-lgtrips .ot-p.o{background:#d97706}#view-lgtrips .ot-p.x{background:#64748b}
#view-lgtrips .ot-b{border:1px solid var(--border,#cbd5e1);background:var(--card,#fff);color:inherit;border-radius:7px;padding:3px 9px;font-size:12px;cursor:pointer;margin-right:4px}
#view-lgtrips .ot-b.cl{background:#16a34a;color:#fff;border-color:#16a34a;font-weight:600}#view-lgtrips .ot-b.cx{color:#b91c1c;border-color:#fecaca}
#view-lgtrips .ot-msg{font-size:12.5px;color:var(--gray-600,#475569);margin:4px 0}
#otCard{position:fixed;inset:0;z-index:100055;background:rgba(10,20,40,.55);display:flex;align-items:center;justify-content:center;padding:14px}
#otCard .cd{background:var(--card,#fff);color:var(--text,#111827);border:1px solid var(--border,#e5e7eb);border-radius:18px;width:min(380px,100%);padding:18px 18px 16px;box-shadow:0 30px 80px rgba(0,0,0,.4)}
#otCard .hd{display:flex;align-items:center;gap:12px}#otCard .av{width:44px;height:44px;border-radius:50%;background:#dbe4f7;color:#1e3a8a;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}
#otCard .nm{font-weight:800;font-size:17px;line-height:1.2}#otCard .sb{font-size:12px;color:var(--gray-500,#64748b)}#otCard .pl{margin-left:auto}
#otCard .st{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 12px}#otCard .st>div{background:#f1f4fb;border-radius:12px;padding:8px 11px}#otCard .st>div.w{background:#fef6dc}#otCard .st small{display:block;font-size:10.5px;letter-spacing:.04em;color:#64748b;text-transform:uppercase}#otCard .st b{font-size:20px}
#otCard .pg{height:9px;border-radius:99px;background:#e5e9f2;overflow:hidden}#otCard .pg i{display:block;height:100%;border-radius:99px;background:#16a34a}#otCard .pg i.o{background:#d97706}#otCard .pg i.r{background:#dc2626}
#otCard .ln{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:6px 0}#otCard .ln span{color:#64748b}#otCard .ln b{text-align:right;font-weight:600}
#otCard .bt{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}#otCard .bt button{border:0;border-radius:11px;padding:12px 6px;font-weight:700;font-size:14px;cursor:pointer;color:#fff}
#otCard .bt .s{background:#2563eb}#otCard .bt .c{background:#fff;color:#b91c1c;border:1px solid #fecaca}#otCard .bt .a{background:#2f7d3a}#otCard .bt button:disabled{opacity:.35;cursor:not-allowed}
#otCard .x{display:block;margin:10px auto 0;border:0;background:transparent;color:#64748b;font-size:12.5px;cursor:pointer}
#otDlg{position:fixed;inset:0;z-index:100060;background:rgba(10,20,40,.55);display:flex;align-items:center;justify-content:center;padding:14px}
#otDlg .bx{background:var(--card,#fff);color:var(--text,#111827);border-radius:14px;width:min(520px,100%);padding:16px 18px;box-shadow:0 30px 80px rgba(0,0,0,.4)}
#otDlg h3{margin:0 0 4px;font-size:17px}#otDlg label{display:block;font-size:12px;font-weight:600;margin:10px 0 3px}
#otDlg input,#otDlg textarea{width:100%;box-sizing:border-box;border:1px solid var(--border,#cbd5e1);border-radius:8px;padding:7px 9px;font-size:13px;background:var(--card,#fff);color:inherit}
#otDlg .ft{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}#otDlg .sm{font-size:12px;color:var(--gray-500,#64748b)}`;
  document.head.appendChild(css);

  const TR = () => (window.TRX ? TRX.trips() : []);
  const hoursOpen = r => Math.max(0, (Date.now() - (r.st || r.ts || Date.now())) / 36e5);
  function subset() {
    const now = Date.now(), t = new Date(); const today = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
    const all = TR();
    const g = { started: all.filter(r => r.s === 'In progress' && !r.closed), ns: all.filter(r => r.s === 'Not started' && !r.closed && r.date < today), cl: all.filter(r => (r.s === 'Completed' || r.s === 'Cancelled') && (r.en || r.ts) > now - 7 * 864e5) };
    return { all, g };
  }
  function list() {
    const { g } = subset(); let L = (g[M.tab] || []).slice(); const q = M.q.trim().toLowerCase();
    if (M.reg) L = L.filter(r => r.region === M.reg);
    if (M.df) L = L.filter(r => r.date >= M.df);
    if (M.dt) L = L.filter(r => r.date <= M.dt);
    if (M.min) L = L.filter(r => hoursOpen(r) >= M.min);
    if (q) L = L.filter(r => [r.id, r.unit, r.trailer, r.driver, r.file, r.from, r.floc, r.to, r.tloc, r.dn, r.mat].join(' ').toLowerCase().includes(q));
    L.sort((a, b) => M.tab === 'cl' ? (b.en || b.ts) - (a.en || a.ts) : (a.st || a.ts) - (b.st || b.ts)); return L;
  }
  function render() {
    const v = Q('#lgtBody'); if (!v) return; const X = window.TRX && TRX.S, { g } = subset(), L = list();
    const regs = [...new Set((g[M.tab] || []).map(r => r.region).filter(Boolean))].sort();
    const old12 = g.started.filter(r => hoursOpen(r) >= 12).length, old24 = g.started.filter(r => hoursOpen(r) >= 24).length;
    const loading = X && X.busy ? ` <span class="ot-p x">reading SharePoint… ${X.done || 0}/${X.todo || '?'}</span>` : '';
    const selN = [...M.sel].filter(id => L.some(r => r.k === id)).length;
    v.innerHTML = `<div class="ot-k"><div style="--c:#2563eb"><b>${g.started.length}</b><span>Started · not closed</span></div><div style="--c:#d97706"><b>${old12}</b><span>Open for 12 h or more</span></div><div style="--c:#dc2626"><b>${old24}</b><span>Open for 24 h or more</span></div><div style="--c:#64748b"><b>${g.ns.length}</b><span>Not started (past dates)</span></div></div>
    <div class="ot-tabs"><button data-ot="tab" data-v="started" class="${M.tab === 'started' ? 'on' : ''}">▶ Started trips (${g.started.length})</button><button data-ot="tab" data-v="ns" class="${M.tab === 'ns' ? 'on' : ''}">⏳ Not started — past dates (${g.ns.length})</button><button data-ot="tab" data-v="cl" class="${M.tab === 'cl' ? 'on' : ''}">✔ Closed / cancelled — last 7 days (${g.cl.length})</button></div>
    <div class="ot-bar"><input type="search" data-ot="q" value="${esc(M.q)}" placeholder="Search trip, unit, driver, DN, location…" style="min-width:240px"><select data-ot="reg"><option value="">All regions</option>${regs.map(r => `<option${r === M.reg ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select>
      <label class="ot-msg" style="display:flex;align-items:center;gap:5px;margin:0">📅 Trip date <input type="date" data-ot="df" value="${esc(M.df)}" title="From date"> – <input type="date" data-ot="dt" value="${esc(M.dt)}" title="To date"></label>
      <select data-ot="dp" title="Quick date ranges"><option value="">Quick range…</option><option value="0">Today</option><option value="1">Yesterday</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All dates</option></select>
      <select data-ot="min"><option value="0">Any open time</option>${[6, 12, 24, 48].map(h => `<option value="${h}"${M.min === h ? ' selected' : ''}>Open ≥ ${h} h</option>`).join('')}</select>
      ${M.tab !== 'cl' ? `<button class="ot-b cl" data-ot="bulkc" ${selN ? '' : 'disabled style="opacity:.5"'}>✔ Close selected (${selN})</button><button class="ot-b cx" data-ot="bulkx" ${selN ? '' : 'disabled style="opacity:.5"'}>✖ Cancel selected</button>` : ''}
      <span class="ot-msg">${L.length} trip(s) · ${X && X.at ? 'read ' + hm(X.at) : ''}${loading}</span></div>
    ${M.msg ? `<div class="ot-msg">${esc(M.msg)}</div>` : ''}
    <div class="ot-w"><table class="ot-t"><thead><tr>${M.tab !== 'cl' ? '<th><input type="checkbox" data-ot="all"></th>' : ''}<th>Trip ID</th><th>Date</th><th>${M.tab === 'cl' ? 'Ended' : 'Started'}</th><th>${M.tab === 'cl' ? 'Duration' : 'Open for'}</th><th>Unit</th><th>Trailer</th><th>Driver</th><th>From</th><th>To</th><th>DN</th><th>Plts</th><th>Material</th><th>Status</th><th></th></tr></thead><tbody>${
      L.slice(0, 500).map(r => { const h = hoursOpen(r), cls = M.tab === 'started' ? (h >= 24 ? 'o2' : h >= 12 ? 'o1' : '') : '', pill = r.s === 'In progress' ? '<span class="ot-p">Started</span>' : r.s === 'Completed' ? '<span class="ot-p g">Completed</span>' : r.s === 'Cancelled' ? '<span class="ot-p r">Cancelled</span>' : '<span class="ot-p x">' + esc(r.s) + '</span>';
        return `<tr class="${cls}" data-k="${esc(r.k)}" title="Double-click to open the trip card">${M.tab !== 'cl' ? `<td><input type="checkbox" data-ot="pick" data-k="${esc(r.k)}"${M.sel.has(r.k) ? ' checked' : ''}></td>` : ''}<td><b>${esc(r.id)}</b></td><td>${esc(dmy(r.date))}</td><td>${r.st ? hm(r.st) : M.tab === 'cl' && r.en ? hm(r.en) : '—'}</td><td>${M.tab === 'cl' ? (r.h ? dur(r.h) : '—') : `<b>${dur(h)}</b>`}</td><td>${esc(r.unit)}</td><td>${esc(r.trailer)}</td><td>${esc(r.driver)}${r.file ? ' <span class="ot-msg">#' + esc(r.file) + '</span>' : ''}</td><td>${esc(r.from)}${r.floc ? ' · ' + esc(r.floc) : ''}</td><td>${esc(r.to)}${r.tloc ? ' · ' + esc(r.tloc) : ''}</td><td>${esc(r.dn)}</td><td>${r.plts || ''}</td><td>${esc(r.mat)}</td><td>${pill}</td><td style="white-space:nowrap">${M.tab !== 'cl' ? `${r.s === 'In progress' ? `<button class="ot-b cl" data-ot="close" data-k="${esc(r.k)}">✔ Close</button>` : ''}<button class="ot-b cx" data-ot="cancel" data-k="${esc(r.k)}">✖ Cancel</button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="15" style="padding:24px;text-align:center;color:#64748b">${X && X.busy ? 'Reading the trips…' : 'Nothing here — no trips match.'}</td></tr>`}</tbody></table></div>
    ${L.length > 500 ? `<div class="ot-msg">Showing the first 500 of ${L.length} — narrow with the search / filters.</div>` : ''}`;
  }

  /* ---------- the dialog (one trip or a selection) ---------- */
  function dialog(mode, rows) {
    const one = rows.length === 1 ? rows[0] : null, close = mode === 'close', start = mode === 'start', box = document.createElement('div'); box.id = 'otDlg'; box.dataset.nohc = '1';
    box.innerHTML = `<div class="bx"><h3>${start ? '▶ Start' : close ? '🏁 Arrive · close' : '✖ Cancel'} ${one ? 'trip ' + esc(one.id) : rows.length + ' trips'}</h3>
      <div class="sm">${one ? esc(one.unit) + ' · ' + esc(one.driver) + ' · ' + esc(one.from) + ' → ' + esc(one.to) + (one.st ? ' · started ' + hm(one.st) : '') : esc(rows.slice(0, 6).map(r => r.id + ' ' + r.unit).join(', ')) + (rows.length > 6 ? ' …' : '')}</div>
      <label>${close || start ? 'Remarks' : 'Reason *'} <span class="sm" style="font-weight:400">(saved in the trip's Remarks${close || start ? ' — optional' : ''})</span></label><textarea id="otWhy" rows="2" placeholder="${start ? 'e.g. started on behalf of the driver' : close ? 'e.g. driver forgot to close the trip' : 'e.g. trip not required'}"></textarea>
      ${start && one ? '<label>Start ODO <span class="sm" style="font-weight:400">(optional)</span></label><input id="otSo" inputmode="numeric" placeholder="ODO at departure">' : ''}
      ${close && one ? `<label>End ODO <span class="sm" style="font-weight:400">(optional — gives the trip KMs)</span></label><input id="otEo" inputmode="numeric" placeholder="ODO at arrival"><label>Destination region · location <span class="sm" style="font-weight:400">(optional — change only if different)</span></label><div style="display:flex;gap:8px"><input id="otRg" value="${esc(one.to)}"><input id="otLc" value="${esc(one.tloc)}"></div>` : ''}
      <div class="sm" style="margin-top:8px">${start ? 'The trip is marked Started now (start time = now).' : close ? 'Closing from here does not change the unit\'s ODO / warehouse status — use the driver\'s Close trip if the unit also has to be released.' : 'The trip will be marked Cancelled and cannot be started again.'}</div>
      <div class="ft"><button class="ot-b" data-d="x">Back</button><button class="ot-b ${close || start ? 'cl' : 'cx'}" data-d="ok">${start ? '▶ Start' : close ? '🏁 Arrive' : '✖ Cancel'} trip${rows.length > 1 ? 's' : ''}</button></div></div>`;
    document.body.appendChild(box); box.querySelector('#otWhy').focus();
    box.addEventListener('click', async e => { const b = e.target.closest('[data-d]'); if (e.target === box || (b && b.dataset.d === 'x')) return box.remove(); if (!b) return;
      let why = box.querySelector('#otWhy').value.trim(); if (!why && mode === 'cancel') return toast('Enter the reason first.', 'warn'); if (!why) why = start ? 'started' : 'arrived';
      const ex = one && start ? { so: parseFloat(String((box.querySelector('#otSo') || {}).value || '').replace(/,/g, '')) || 0 } : one && close ? { eo: parseFloat(String((box.querySelector('#otEo') || {}).value || '').replace(/,/g, '')) || 0, rg: (box.querySelector('#otRg') || {}).value.trim(), lc: (box.querySelector('#otLc') || {}).value.trim() } : {};
      b.disabled = true; b.textContent = 'Working…'; await apply(mode, rows, why, ex); box.remove(); });
  }

  /* ---------- double-click: the trip as a card with Start · Cancel · Arrive ---------- */
  function card(r) { const old = Q('#otCard'); if (old) old.remove(); const started = r.s === 'In progress', open = !r.closed && (started || r.s === 'Not started' || r.s === 'Planned'), h = hoursOpen(r), ini = String(r.driver || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?', pct = Math.min(100, Math.round(h / 24 * 100));
    const pill = started ? '<span class="ot-p">Started</span>' : r.s === 'Completed' ? '<span class="ot-p g">Completed</span>' : r.s === 'Cancelled' ? '<span class="ot-p r">Cancelled</span>' : '<span class="ot-p o">' + esc(r.s) + '</span>';
    const box = document.createElement('div'); box.id = 'otCard'; box.dataset.nohc = '1';
    box.innerHTML = `<div class="cd"><div class="hd"><div class="av">${esc(ini)}</div><div><div class="nm">${esc(r.driver || 'Driver not set')}</div><div class="sb">${esc(r.file || '—')} · Trip ${esc(r.id)}</div></div><div class="pl">${pill}</div></div>
      <div class="st"><div><small>Open for</small><b>${started ? dur(h) : '—'}</b></div><div><small>Pallets</small><b>${r.plts || 0}</b></div><div class="${h >= 24 ? 'w' : ''}"><small>Unit</small><b style="font-size:15px">${esc(r.unit || '—')}</b></div></div>
      <div class="pg"><i class="${h >= 24 ? 'r' : h >= 12 ? 'o' : ''}" style="width:${started ? pct : 0}%"></i></div>
      <div class="ln" style="margin-top:8px"><span>Trip of ${esc(dmy(r.date))}</span><b>${started ? pct + '% of 24 h' : 'not started'}</b></div>
      <div class="ln"><span>From</span><b>${esc(r.from)}${r.floc ? ' · ' + esc(r.floc) : ''}</b></div><div class="ln"><span>To</span><b>${esc(r.to)}${r.tloc ? ' · ' + esc(r.tloc) : ''}</b></div>
      <div class="ln"><span>Trailer · DN</span><b>${esc(r.trailer || '—')} · ${esc(r.dn || '—')}</b></div><div class="ln"><span>Material</span><b>${esc(r.mat || '—')}</b></div><div class="ln"><span>Started</span><b>${r.st ? hm(r.st) : '—'}</b></div>
      <div class="bt"><button class="s" data-c="start" ${open && !started ? '' : 'disabled'} title="Start the trip now">▶ Start</button><button class="c" data-c="cancel" ${open ? '' : 'disabled'} title="Cancel the trip">✖ Cancel</button><button class="a" data-c="close" ${open && started ? '' : 'disabled'} title="Arrived — close the trip">🏁 Arrive</button></div>
      <button class="x" data-c="x">Close this card</button></div>`;
    document.body.appendChild(box);
    box.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (e.target === box || (b && b.dataset.c === 'x')) return box.remove(); if (!b || b.disabled) return; box.remove(); dialog(b.dataset.c, [r]); }); }

  /* ---------- write to SharePoint ---------- */
  let IDS = null;
  async function ids() { if (IDS) return IDS; const token = getGlobalAccessToken(), site = getGlobalSiteUrl(), name = TRX.S.list || 'Trls_Daily_Activity_tbl'; IDS = Object.assign(await resolveIds(site, name, token), { token }); return IDS; }
  async function fresh(I, id) { const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${I.siteId}/lists/${I.listId}/items/${id}?$expand=fields`, { headers: { Authorization: 'Bearer ' + I.token } }, 'trip'); if (!r.ok) throw new Error('SharePoint ' + r.status); return (await r.json()).fields || {}; }
  async function apply(mode, rows, why, ex) {
    M.busy = true; const I = await ids().catch(e => { toast('Could not reach SharePoint: ' + e.message, 'error'); return null; }); if (!I) return; const now = new Date(), iso = now.toISOString(), who = me(), stamp = `[${hm(now)} ${mode === 'start' ? 'started' : mode === 'close' ? 'arrived / closed' : 'cancelled'} from ORBIT by ${who}: ${why}]`; let ok = 0, skip = 0, bad = 0, err = '';
    for (const r of rows) {
      try { const f = await fresh(I, r.id), done = f.Trip_Closed === true || /^(true|yes|1)$/i.test(String(f.Trip_Closed || ''));
        if (done) { skip++; continue; }
        if (mode === 'start') { if (/^started$/i.test(String(f.Trip_Status || '')) || f.Start_TimeStamp || f.TimeStamp_Start) { skip++; continue; } const u0 = { Trip_Status: 'Started', Task_Type: 'Start Trip', Start_TimeStamp: iso, TimeStamp_Start: iso, Record_Nr: 'SRT-' + r.id, Remarks: [f.Remarks, stamp].filter(Boolean).join(',') }; if (ex.so) u0.ODO_Reading = ex.so;
          await updateItem(I.siteId, I.listId, r.id, spCoerceFields(I.listId, u0), I.token); const row0 = TRX.S.map.get(r.k); if (row0) { row0.status0 = 'Started'; row0.task = 'Start Trip'; row0.st = now.getTime(); row0.rem = u0.Remarks; TRX.S.ver++; } M.sel.delete(r.k); ok++; continue; }
        const rem = [f.Remarks, stamp].filter(Boolean).join(','), logBase = { Trans_Date: iso, User_Name: who, Loaction_From: f.Loaction_From, Distn_From: f.Distn_From, Location_To: f.Location_To, Distn_To: f.Distn_To, Trailer_Nr: f.Trailer_Nr, Unit_Nr: f.Unit_Nr, Nr_Of_Plts: f.Nr_Of_Plts, DN_Nr: f.DN_Nr, Trls_Task_Type: f.Trls_Task_Type || undefined, Close_Trip_ID: r.id, Remarks: why };
        let upd, log;
        if (mode === 'close') { const so = parseFloat(f.ODO_Reading) || 0, eo = ex.eo || 0; if (eo && so && eo <= so) throw new Error('End ODO must be higher than the start ODO (' + so + ')');
          const rg = ex.rg || f.Distn_To || '', lc = ex.lc || f.Location_To || '', st = Date.parse(f.Start_TimeStamp || f.TimeStamp_Start || '') || r.st, hrs = st ? (now - st) / 36e5 : 0, chg = []; if (rg !== (f.Distn_To || '')) chg.push('Distn_To: ' + (f.Distn_To || '') + ' → ' + rg); if (lc !== (f.Location_To || '')) chg.push('Location_To: ' + (f.Location_To || '') + ' → ' + lc);
          upd = { Trip_Closed: true, TimeStamp_End: iso, End_TimeStamp: iso, Trip_Status: 'Completed', Task_Type: 'End Trip', Close_Trip_ID: r.id, Remarks: rem, Distn_To: rg || undefined, Location_To: lc || undefined, Changes_Data_Hstry: [f.Changes_Data_Hstry, chg.join('; '), 'Closed from ORBIT by ' + who].filter(Boolean).join(',') };
          if (eo) { upd.Trip_EndODO = eo; if (so) upd.Trip_KMs = eo - so; } if (hrs) upd.Trip_Time = Math.floor(hrs) + 'h ' + pad(Math.round((hrs % 1) * 60)) + 'm';
          log = Object.assign({ Title: 'CLS-' + r.id, Record_Nr: 'CLS-' + r.id, Task_Type: 'End Trip', Trip_Status: 'Completed', End_TimeStamp: iso, TimeStamp_End: iso, ODO_Reading: eo || 0, Task_Source: 'ORBIT admin close' }, logBase, { Distn_To: rg, Location_To: lc }); }
        else { upd = { Trip_Closed: true, TimeStamp_End: iso, End_TimeStamp: iso, Trip_Status: 'Cancelled', Task_Type: 'Cancel Trip', Close_Trip_ID: r.id, Remarks: rem };
          log = Object.assign({ Title: 'CXL-' + r.id, Record_Nr: 'CXL-' + r.id, Task_Type: 'Cancel Trip', Trip_Status: 'Cancelled', ODO_Reading: 0, Task_Source: 'ORBIT admin cancel' }, logBase); }
        Object.keys(upd).forEach(k => upd[k] === undefined && delete upd[k]); Object.keys(log).forEach(k => (log[k] === undefined || log[k] === null) && delete log[k]);
        await updateItem(I.siteId, I.listId, r.id, spCoerceFields(I.listId, upd), I.token);
        try { await createItem(I.siteId, I.listId, spCoerceFields(I.listId, log), I.token); } catch (e) { err = 'The trip was updated but its log row (' + log.Title + ') could not be added: ' + e.message; }
        const row = TRX.S.map.get(r.k); if (row) { row.closed = true; row.status0 = upd.Trip_Status; row.task = upd.Task_Type; row.en = now.getTime(); row.rem = rem; TRX.S.ver++; }
        M.sel.delete(r.k); ok++; }
      catch (e) { bad++; err = e.message; } }
    M.busy = false; M.msg = `${mode === 'start' ? 'Started' : mode === 'close' ? 'Closed (arrived)' : 'Cancelled'} ${ok} trip(s)` + (skip ? ` · ${skip} already ${mode === 'start' ? 'started / closed' : 'closed'}` : '') + (bad ? ` · ${bad} failed (${err})` : err ? ' · ' + err : ''); toast(M.msg, bad ? 'warn' : 'success'); render();
  }

  /* ---------- wiring ---------- */
  function wire(v) {
    v.addEventListener('click', e => { const t = e.target.closest('[data-ot]'); if (!t) return; const a = t.dataset.ot, rowsOf = ks => ks.map(k => TR().find(r => r.k === k)).filter(Boolean);
      if (a === 'tab') { M.tab = t.dataset.v; M.sel.clear(); render(); } else if (a === 'reload') { M.msg = ''; TRX.load(false).then(render); render(); }
      else if (a === 'close' || a === 'cancel') { const r = rowsOf([t.dataset.k]); if (r.length) dialog(a, r); }
      else if (a === 'bulkc' || a === 'bulkx') { const r = rowsOf([...M.sel]).filter(x => list().includes(x)); if (r.length) dialog(a === 'bulkc' ? 'close' : 'cancel', r); } });
    v.addEventListener('dblclick', e => { const tr = e.target.closest('tr[data-k]'); if (!tr || e.target.closest('input,button,select')) return; const r = TR().find(x => x.k === tr.dataset.k); if (r) { getSelection().removeAllRanges(); card(r); } });
    v.addEventListener('change', e => { const t = e.target.closest('[data-ot]'); if (!t) return; const a = t.dataset.ot;
      if (a === 'pick') { t.checked ? M.sel.add(t.dataset.k) : M.sel.delete(t.dataset.k); render(); } else if (a === 'all') { list().forEach(r => t.checked ? M.sel.add(r.k) : M.sel.delete(r.k)); render(); }
      else if (a === 'reg') { M.reg = t.value; render(); } else if (a === 'min') { M.min = +t.value; render(); } else if (a === 'df' || a === 'dt') { M[a] = t.value; render(); }
      else if (a === 'dp') { const n = t.value, ymd = d => { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }; if (n === 'all') { M.df = ''; M.dt = ''; } else if (n !== '') { const k = +n; M.dt = ymd(Date.now() - (k === 1 ? 1 : 0) * 864e5); M.df = ymd(Date.now() - (k === 1 ? 1 : k === 0 ? 0 : k - 1) * 864e5); } render(); } });
    v.addEventListener('input', e => { const t = e.target.closest('[data-ot="q"]'); if (!t) return; M.q = t.value; clearTimeout(M.tm); M.tm = setTimeout(() => { render(); const i = Q('#lgtBody [data-ot="q"]'); if (i) { i.focus(); i.setSelectionRange(M.q.length, M.q.length); } }, 250); });
  }
  function init() { const v = Q('#view-lgtrips'); if (!v || v._i) return; v._i = 1; wire(v); render(); }
  const nav = Q('.nav-item[data-view="lgtrips"]');
  if (nav) nav.addEventListener('click', () => { init(); setTimeout(() => { render(); if (window.TRX && !TRX.S.busy && (!TRX.S.at || Date.now() - TRX.S.at > 2 * 60e3)) TRX.load(false).then(render); }, 60); });
  const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (typeof activeViewId === 'function' && activeViewId() === 'lgtrips') { e.stopImmediatePropagation(); if (window.TRX) TRX.load(false).then(render); render(); } }, true);
  setInterval(() => { const v = Q('#view-lgtrips.active'); if (v && !M.busy && !Q('#otDlg')) render(); }, 15e3);
  window.LGT = { render, M };
})();
