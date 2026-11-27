/* ============================================================
   DATA UPDATES — what was added / changed in the system by the other users, only in the areas this user can open
   • at sign-in: a panel lists the new and edited records since the user last looked (per user, remembered on this device)
   • a 🔔 button in the top bar (with a badge) and one in the side panel open the same panel at any time
   • every record has a ✔ Verify tick (remembered; a record edited again comes back); "Open area" jumps to the page
   • location scope is applied by the normal list reads, so a user only sees the records of his own location(s)
   To watch another list add one line to FEEDS: [view id of the area, SharePoint list name, label].
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FEEDS = [
    ['g5', 'Btl_DC_Daily_tbl', '5 Gallon · DC daily'], ['g5', 'Btl_Plant_Daily_tbl', '5 Gallon · Plant daily'],
    ['rpa', 'RMPM_Daily_Snap_tbl', 'RM & PM daily file'], ['rmp', 'RMPM_Movements_tbl', 'RMPM movements'],
    ['smv', 'SKUs_Movements_Batch_tbl', 'Stock movements'], ['whtmp', 'WHs_Temperature_Reading_tbl', 'Temperature readings'],
    ['insp', 'Store_Inspection_Hdr_tbl', 'Store inspections'], ['otapp', 'OT_Approval_Hdr_tbl', 'OT requests / approvals'],
    ['prj', 'Project_Updates_tbl', 'Project updates'], ['prj', 'Project_Requests_tbl', 'Project requests'],
    ['eqw', 'WS_Jobs_tbl', 'Workshop jobs'], ['fla', 'FLO_Daily_Activity_tbl', 'Forklift activity'],
    ['fle', 'FLO_LGV_Usage_tbl', 'Forklift energy'], ['flt', 'Fleet_Maintenance_tbl', 'Fleet maintenance'],
    ['flt', 'Fleet_Incidents_tbl', 'Fleet incidents'], ['mgw', 'Mngmnt_Daily_Data_tbl', 'Management daily data']
  ];
  const DAYS_FIRST = 7, PAGE = 100, MAX_PER_LIST = 600, MAX_SHOW = 400;
  const uKey = () => { const u = typeof currentUser !== 'undefined' && currentUser; return (typeof LS_BASE !== 'undefined' ? LS_BASE : 'orbit') + '_du_' + ((u && (u.username || u.id)) || 'x'); };
  /* the ticks / options are kept in this browser (localStorage); if the browser storage is full or blocked they are kept in memory for this session so the boxes still work */
  const MEM = {}, DEF = () => ({ seen: '', ver: {}, own: false, hide: true, popup: true });
  const st = () => { const k = uKey(); if (MEM[k]) return MEM[k]; try { return Object.assign(DEF(), JSON.parse(localStorage.getItem(k) || '{}')); } catch (e) { return DEF(); } };
  const save = s => { const k = uKey(); try { const v = Object.entries(s.ver || {}); if (v.length > 4000) s.ver = Object.fromEntries(v.slice(-3000)); } catch (e) { }
    for (const keep of [0, 1500, 500, 100]) { try { if (keep) { const v = Object.entries(s.ver || {}); s.ver = Object.fromEntries(v.slice(-keep)); } localStorage.setItem(k, JSON.stringify(s)); delete MEM[k]; return; } catch (e) { if (!keep) continue; } }
    MEM[k] = s; if (!save._w) { save._w = 1; try { if (typeof toast === 'function') toast('Browser storage is full — your ticks are kept for this session only. Clear old site data to keep them.', 'warn'); } catch (e) { } } };
  const vis = v => { const el = Q('.nav-item[data-view="' + v + '"]'); if (!el || el.classList.contains('locked') || el.style.display === 'none' || el.hidden || el.closest('[hidden]')) return false; try { if (typeof acLevel === 'function' && acLevel(v) === 'none') return false; } catch (e) { } return getComputedStyle(el).display !== 'none'; };
  const me = () => { const u = typeof currentUser !== 'undefined' && currentUser; return u ? [u.displayName, u.username, u.email].filter(Boolean).map(x => String(x).toLowerCase().split('@')[0].trim()) : []; };
  const isMe = n => { const a = String(n || '').toLowerCase().split('@')[0].trim(); return !!a && me().includes(a); };
  const SYS = /^(@|_|id$|contenttype|attachments|edit$|docicon|linktitle|itemchildcount|folderchildcount|content_x0020_type|app|compliance|modified$|created$|author|editor|items_json|json)/i;
  const AC = { g5: '#3b82a6', rpa: '#7c6bb0', rmp: '#9b7fc0', smv: '#c08a3e', whtmp: '#c0594f', insp: '#4a9a78', otapp: '#b0608a', prj: '#5b6fb5', eqw: '#c27a4a', fla: '#3f9a98', fle: '#4a8fae', flt: '#7aa145', mgw: '#4a7f95' }, acOf = v => AC[v] || '#0e7490';
  const D = { rows: [], loading: false, err: [], at: null, show: false, area: '', since: '', busy: false, preset: 'last', from: '', to: '', user: '', key: '' };
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const PRESETS = [['last', 'Since my last visit'], ['today', 'Today'], ['yday', 'Yesterday'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['custom', 'Custom range']];
  function range() {   /* → [fromMs, toMs] */
    const day = d => new Date(d + 'T00:00:00').getTime(), t0 = new Date(); t0.setHours(0, 0, 0, 0); const T = t0.getTime(), s = st();
    if (D.preset === 'today') return [T, Infinity]; if (D.preset === 'yday') return [T - 864e5, T - 1]; if (D.preset === '7') return [T - 6 * 864e5, Infinity]; if (D.preset === '30') return [T - 29 * 864e5, Infinity];
    if (D.preset === 'custom') return [D.from ? day(D.from) : 0, D.to ? day(D.to) + 864e5 - 1 : Infinity];
    return [new Date(s.seen || Date.now() - DAYS_FIRST * 864e5).getTime(), Infinity];
  }
  const rel = iso => { const t = new Date(iso).getTime(); if (!t) return ''; const m = Math.round((Date.now() - t) / 6e4); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; if (m < 1440) return Math.round(m / 60) + ' h ago'; const d = Math.round(m / 1440); return d + ' day' + (d > 1 ? 's' : '') + ' ago'; };
  const stamp = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const nm = o => { const u = o && o.user; return u ? (u.displayName || u.email || '') : ''; };
  const summary = f => { const out = []; const keys = Object.keys(f || {}); ['Title'].concat(keys).forEach(k => { if (out.length >= 5 || out.some(x => x[0] === k)) return; if (k !== 'Title' && SYS.test(k)) return; let v = f[k]; if (v == null || v === '' || typeof v === 'object') { if (v && typeof v === 'object' && v.LookupValue) v = v.LookupValue; else return; } v = String(v); if (v.length > 48) v = v.slice(0, 46) + '…'; if (/^\d{4}-\d\d-\d\dT00:00:00Z$/.test(v)) v = v.slice(0, 10); out.push([k.replace(/_x0020_/g, ' ').replace(/_/g, ' '), v]); }); return out; };

  async function scan(force) {
    if (D.busy) return D.rows; D.busy = true; D.err = [];
    try {
      const token = getGlobalAccessToken && getGlobalAccessToken(), site = getGlobalSiteUrl && getGlobalSiteUrl(); if (!token || !site) { D.busy = false; return D.rows; }
      const [F, TO] = range(), key = D.preset + '|' + F + '|' + TO; D.since = new Date(F).toISOString(); D.key = key;
      const feeds = FEEDS.filter(x => vis(x[0])), out = [];
      await Promise.all(feeds.map(async ([view, list, label]) => {
        try {
          const ids = await resolveIds(site, list, token); if (!ids || !ids.listId) return;
          let url = `https://graph.microsoft.com/v1.0/sites/${ids.siteId}/lists/${ids.listId}/items?$expand=fields&$orderby=lastModifiedDateTime desc&$top=${PAGE}`, n = 0, tried = false;
          while (url && n < MAX_PER_LIST) {
            let r = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } }, 'data updates');
            if (!r.ok && !tried) { tried = true; url = `https://graph.microsoft.com/v1.0/sites/${ids.siteId}/lists/${ids.listId}/items?$expand=fields&$top=${PAGE}`; continue; }
            if (!r.ok) return; const d = await r.json(), v = d.value || []; let older = false;
            v.forEach(it => {
              n++; const mod = it.lastModifiedDateTime || (it.fields && it.fields.Modified) || '', t = new Date(mod).getTime(); if (!t) return; if (t < F) { older = true; return; } if (t > TO) return;
              const by = nm(it.lastModifiedBy) || nm(it.createdBy), cr = it.createdDateTime || '', isNew = cr && Math.abs(new Date(mod) - new Date(cr)) < 120000;
              out.push({ k: list + '#' + it.id, ver: mod, view, list, label, id: it.id, by, mod, isNew: !!isNew, f: summary(it.fields || {}) });
            });
            url = older ? null : d['@odata.nextLink'] || null;
          }
        } catch (e) { D.err.push(label + ': ' + (e && e.message || e)); }
      }));
      out.sort((a, b) => new Date(b.mod) - new Date(a.mod)); D.rows = out.slice(0, MAX_SHOW * 2); D.at = new Date();
    } catch (e) { D.err.push(String(e && e.message || e)); }
    D.busy = false; if (D.preset === 'last') D.lastN = visibleRows().length; badge(); return D.rows;
  }
  const visibleRows = () => { const s = st(); return D.rows.filter(r => (s.own || !isMe(r.by)) && (!s.hide || s.ver[r.k] !== r.ver)); };
  const lastRows = () => D.preset === 'last' ? visibleRows() : [];
  const pending = () => D.preset === 'last' ? visibleRows().length : (D.lastN || 0);

  const css = document.createElement('style'); css.textContent = `
#duOv{position:fixed;inset:0;z-index:2147482900;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}
#duBox{background:var(--card,#fff);color:var(--text,#0f172a);border-radius:16px;width:min(980px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.45);overflow:hidden}
#duBox .du-h{padding:16px 22px;background:linear-gradient(120deg,#0f2a47,#0e7490);color:#fff;display:flex;gap:12px;align-items:center}#duBox .du-h b{font-size:19px;display:block}#duBox .du-h span{font-size:12px;opacity:.9}#duBox .du-h .sp{flex:1}
#duBox .du-bar{padding:10px 22px;display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;border-bottom:1px solid #e2e8f0;background:#f8fafc}
#duBox .du-chip{border:1px solid #c5cfe0;background:#fff;color:#1f3b73;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:600;cursor:pointer;width:auto;margin:0}#duBox .du-chip.on{background:#0e7490;border-color:#0e7490;color:#fff}
#duBox .du-bar label{font-size:12px;color:#475569;display:flex;gap:4px;align-items:center;cursor:pointer}
#duBox .du-list{overflow:auto;padding:8px 22px 6px;flex:1}
#duBox .du-it{display:grid;grid-template-columns:26px 1fr auto;gap:10px;align-items:start;border:1px solid #e2e8f0;border-left:4px solid #0e7490;border-radius:10px;padding:9px 12px;margin:7px 0;background:var(--card,#fff)}#duBox .du-it.ver{opacity:.55;border-left-color:#16a34a}#duBox .du-it.new{border-left-color:#16a34a}
#duBox .du-t{font-weight:700;font-size:13.5px}#duBox .du-tag{font-size:10.5px;font-weight:700;border-radius:999px;padding:1px 8px;margin-left:6px;background:#dcfce7;color:#166534}#duBox .du-tag.u{background:#fef3c7;color:#92400e}
#duBox .du-m{font-size:12px;color:#64748b;margin-top:2px}#duBox .du-f{display:flex;flex-wrap:wrap;gap:3px 12px;margin-top:5px;font-size:12px}#duBox .du-f span b{color:#475569;font-weight:600}
#duBox .du-f2{padding:12px 22px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-top:1px solid #e2e8f0}#duBox .du-f2 .sp{flex:1}
#duBox button{border-radius:9px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer;border:1px solid #c5cfe0;background:#fff;color:#1f3b73;width:auto;margin:0}#duBox button.go{background:#0e7490;color:#fff;border-color:#0e7490}#duBox button.small{padding:4px 10px;font-size:12px}
#duBox .du-none{padding:34px 10px;text-align:center;color:#64748b}
#duBell{position:relative;background:transparent;border:1px solid var(--gray-300,#cbd5e1);border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;width:auto;margin:0 6px;color:inherit}
#duBell .n,#duBtn .n{background:#dc2626;color:#fff;border-radius:999px;font-size:11px;padding:1px 7px;margin-left:5px;font-weight:800}
#duBtn{margin:6px 12px 2px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);color:inherit;border-radius:9px;padding:5px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;width:calc(100% - 24px)}`;
  /* colours follow the system theme: the accent (--acc-*), light / dark surfaces (--card, --bg, --border, --gray-*) */
  css.textContent += `
#duOv{background:rgba(15,23,42,.5);backdrop-filter:blur(1.5px)}
#duBox{width:min(980px,100%);border:1px solid var(--border,#cbd5e1);border-radius:14px;box-shadow:0 20px 60px -12px rgba(0,0,0,.5);background:var(--card,#fff);color:var(--gray-800,#0f172a)}
html body #duOv #duBox .du-h{background:var(--acc-grad,linear-gradient(135deg,#1e3a5f,#26507a))!important;color:#fff;padding:15px 22px;position:relative}
#duBox .du-h b{font-size:18px;font-weight:600;letter-spacing:.2px;color:#fff}#duBox .du-h span{color:rgba(255,255,255,.82);opacity:1;font-size:12px}
#duBox .du-cnt{min-width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.32);color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 8px}
#duBox .du-h button{background:transparent;border:1px solid rgba(255,255,255,.45);color:#fff;font-weight:500}#duBox .du-h button:hover{background:rgba(255,255,255,.14)}
#duBox .du-bar{background:var(--gray-50,#f8fafc);border-bottom:1px solid var(--border,#e2e8f0)}
#duBox .du-bar select,#duBox .du-bar input[type=date]{width:auto;display:inline-block;min-width:140px;padding:5px 8px;border:1px solid var(--gray-300,#cbd5e1);border-radius:7px;background:var(--card,#fff);font:inherit;font-size:12.5px;margin:0;color:var(--gray-800,#0f172a)}
#duBox .du-bar b{color:var(--gray-600,#475569);font-weight:600}#duBox .du-bar label{color:var(--gray-600,#475569)}
#duBox .du-chip{border:1px solid var(--gray-300,#cbd5e1);color:var(--gray-700,#334155);background:var(--card,#fff);font-weight:500;padding:3px 11px 3px 9px;display:inline-flex;align-items:center;gap:6px}
#duBox .du-chip::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--ac,#64748b);display:inline-block}#duBox .du-chip:first-of-type::before{display:none}
#duBox .du-chip b{background:var(--gray-100,#eef2f7);color:var(--gray-600,#475569);border-radius:999px;padding:0 7px;margin-left:2px;font-size:11px;font-weight:600}
#duBox .du-chip.on{background:var(--acc-2,#1d4ed8);border-color:var(--acc-2,#1d4ed8);color:#fff}#duBox .du-chip.on b{background:rgba(255,255,255,.22);color:#fff}
#duBox .du-list{background:var(--bg,#f1f5f9);padding:10px 20px 6px}
#duBox .du-it{border:1px solid var(--border,#e2e8f0);border-left:3px solid var(--ac,#64748b);border-radius:8px;background:var(--card,#fff);box-shadow:0 1px 2px rgba(0,0,0,.05);padding:9px 12px;margin:6px 0}
#duBox .du-it.new,#duBox .du-it.ver{border-left-color:var(--ac,#64748b)}#duBox .du-it.ver{opacity:.55}
#duBox .du-t{color:var(--gray-800,#0f172a);font-size:13.5px;font-weight:600}
#duBox .du-tag{background:rgba(22,163,74,.14);color:#16a34a;font-weight:600;font-size:10px;letter-spacing:.4px;box-shadow:none}#duBox .du-tag.u{background:rgba(217,119,6,.16);color:#d97706}
#duBox .du-m{color:var(--gray-500,#64748b)}
#duBox .du-f{color:var(--gray-800,#0f172a)}#duBox .du-f span b{color:var(--gray-500,#64748b);font-weight:500}
#duBox .du-it button.small{background:var(--card,#fff);border:1px solid var(--gray-300,#cbd5e1);color:var(--acc-2,#1d4ed8);font-weight:600}#duBox .du-it button.small:hover{background:var(--acc-2,#1d4ed8);color:#fff;border-color:var(--acc-2,#1d4ed8)}
#duBox .du-f2{background:var(--card,#fff);border-top:1px solid var(--border,#e2e8f0)}#duBox .du-pop{font-size:12px;font-weight:500;color:var(--gray-700,#334155);display:flex;gap:6px;align-items:center;cursor:pointer;margin:0}
#duBox button{background:var(--card,#fff);color:var(--acc-2,#1d4ed8);border:1px solid var(--gray-300,#cbd5e1)}
#duBox button.go{background:var(--acc-2,#1d4ed8);border:1px solid var(--acc-2,#1d4ed8);color:#fff;box-shadow:none;font-weight:600}#duBox button.go:hover{filter:brightness(1.1)}
#duBox .du-none{color:var(--gray-500,#64748b)}
#duBell.has{background:var(--card,#fff);color:var(--acc-2,#1d4ed8)!important;border-color:var(--acc-2,#1d4ed8);box-shadow:0 0 0 3px var(--acc-soft,rgba(30,58,95,.12))}#duBell.has .n{background:#dc2626;color:#fff}
#duBtn.has{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.6);color:#fff}#duBtn.has .n{background:#dc2626;color:#fff}`;
  document.head.appendChild(css);

  function badge() { const n = pending(), t = n ? '<span class="n">' + (n > 99 ? '99+' : n) + '</span>' : ''; const b = Q('#duBell'), s = Q('#duBtn'); if (b) { b.innerHTML = '🔔 Updates' + t; b.classList.toggle('has', !!n); } if (s) { s.innerHTML = '🔔 Data updates' + t; s.classList.toggle('has', !!n); } }
  const close = () => { const o = Q('#duOv'); if (o) o.remove(); };
  function draw() {
    let o = Q('#duOv'); if (!o) { o = document.createElement('div'); o.id = 'duOv'; o.dataset.nohc = '1'; document.body.appendChild(o); o.addEventListener('click', onClick); o.addEventListener('change', onChange); }
    const s = st(), base = visibleRows(), users = [...new Set(base.map(r => r.by || 'Unknown user'))].sort(), all = D.user ? base.filter(r => (r.by || 'Unknown user') === D.user) : base, areas = [...new Set(all.map(r => r.label))], L = (D.area ? all.filter(r => r.label === D.area) : all).slice(0, MAX_SHOW);
    const cnt = a => all.filter(r => r.label === a).length;
    const title = n => (typeof VIEW_META !== 'undefined' && VIEW_META[n] && VIEW_META[n].title) || n;
    o.innerHTML = `<div id="duBox"><div class="du-h"><div class="du-cnt">${all.length}</div><div><b>Data updates</b><span>New and changed records by the other users, only in the areas you can open · from ${esc(stamp(D.since))}${D.at ? ' · checked ' + esc(rel(D.at.toISOString())) : ''} · build ${typeof APP_BUILD !== 'undefined' ? APP_BUILD : ''}</span></div><span class="sp"></span><button type="button" data-du="refresh">↻ Refresh</button><button type="button" data-du="close">✕</button></div>
<div class="du-bar"><b style="font-size:12px">📅 Period</b><select data-dup="preset">${PRESETS.map(x => `<option value="${x[0]}"${D.preset === x[0] ? ' selected' : ''}>${x[1]}</option>`).join('')}</select>${D.preset === 'custom' ? `<label>From <input type="date" data-dup="from" value="${esc(D.from)}"></label><label>To <input type="date" data-dup="to" value="${esc(D.to)}"></label>` : ''}<b style="font-size:12px;margin-left:8px">👤 User</b><select data-dup="user"><option value="">All users</option>${users.map(u => `<option${D.user === u ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select><span class="du-m">${all.length} record(s)</span></div>
<div class="du-bar"><button type="button" class="du-chip${D.area ? '' : ' on'}" data-du="area" data-a="">All (${all.length})</button>${areas.map(a => { const c = acOf((all.find(r => r.label === a) || {}).view); return `<button type="button" class="du-chip${D.area === a ? ' on' : ''}" style="--ac:${c}" data-du="area" data-a="${esc(a)}">${esc(a)} <b>${cnt(a)}</b></button>`; }).join('')}<span style="flex:1"></span><label><input type="checkbox" data-duo="hide"${s.hide ? ' checked' : ''}> Hide verified</label><label><input type="checkbox" data-duo="own"${s.own ? ' checked' : ''}> Include my own changes</label></div>
<div class="du-list">${D.busy && !D.rows.length ? '<div class="du-none">Checking the latest updates…</div>' : L.length ? L.map(r => `<div class="du-it${r.isNew ? ' new' : ''}${s.ver[r.k] === r.ver ? ' ver' : ''}" style="--ac:${acOf(r.view)}"><input type="checkbox" title="Verified" data-duv="${esc(r.k)}" data-ver="${esc(r.ver)}"${s.ver[r.k] === r.ver ? ' checked' : ''}><div><div class="du-t">${esc(r.label)}<span class="du-tag${r.isNew ? '' : ' u'}">${r.isNew ? 'NEW' : 'UPDATED'}</span></div><div class="du-m">${esc(r.by || 'Unknown user')} · ${esc(stamp(r.mod))} (${esc(rel(r.mod))}) · record #${esc(r.id)}</div><div class="du-f">${r.f.map(x => `<span><b>${esc(x[0])}:</b> ${esc(x[1])}</span>`).join('')}</div></div><button type="button" class="small" data-du="open" data-v="${esc(r.view)}" title="Open ${esc(title(r.view))}">Open ➜</button></div>`).join('') : '<div class="du-none">✔ Nothing new' + (all.length ? ' in this area' : ' — no unverified updates from other users') + '.</div>'}${D.err.length ? '<div class="du-m" style="margin:8px 0">Some lists could not be read: ' + esc(D.err.slice(0, 3).join(' · ')) + '</div>' : ''}</div>
<div class="du-f2"><label class="du-pop" title="When off, the panel no longer opens by itself — use the 🔔 Updates button"><input type="checkbox" data-duo="popup"${s.popup !== false ? ' checked' : ''}> Show this pop-up when I sign in</label><span class="du-m">Tick ✔ when you have seen and verified a record.</span><span class="sp"></span><button type="button" data-du="verall">✔ Verify all shown</button>${D.preset === 'last' ? '<button type="button" class="go" data-du="seen">Mark all as seen &amp; close</button>' : '<button type="button" class="go" data-du="close">Close</button>'}</div></div>`;
  }
  function onClick(e) {
    { const c = e.target.closest && e.target.closest('input[type=checkbox][data-duv],input[type=checkbox][data-duo]'); if (c) { e.stopPropagation(); return onChange({ target: c }); } }
    const b = e.target.closest('[data-du]'); if (!b) { if (e.target.id === 'duOv') close(); return; } const a = b.dataset.du;
    if (a === 'close') return close();
    if (a === 'area') { D.area = b.dataset.a; return draw(); }
    if (a === 'refresh') { D.busy = true; draw(); D.busy = false; return scan(true).then(draw); }
    if (a === 'open') { close(); try { const el = Q('.nav-item[data-view="' + b.dataset.v + '"]'); if (el) el.click(); } catch (x) { } return; }
    if (a === 'verall') { const s = st(); (D.area ? visibleRows().filter(r => r.label === D.area) : visibleRows()).filter(r => !D.user || (r.by || 'Unknown user') === D.user).forEach(r => { s.ver[r.k] = r.ver; }); save(s); badge(); return draw(); }
    if (a === 'seen') { const s = st(); s.seen = new Date().toISOString(); save(s); D.rows = []; D.lastN = 0; badge(); close(); }
  }
  function onChange(e) {
    const t = e.target; if (t.dataset.dup) { const k = t.dataset.dup; if (k === 'user') { D.user = t.value; D.area = D.area; return draw(); } if (k === 'preset') { D.preset = t.value; if (D.preset === 'custom' && !D.from) { const d = new Date(); d.setDate(d.getDate() - 6); D.from = ymd(d); D.to = ymd(new Date()); } } else D[k] = t.value; D.area = ''; D.user = ''; D.rows = []; D.busy = false; draw(); return scan().then(() => { badge(); draw(); }); }
    if (t.dataset.duv) { const s = st(); if (t.checked) s.ver[t.dataset.duv] = t.dataset.ver; else delete s.ver[t.dataset.duv]; save(s); badge(); return draw(); }
    if (t.dataset.duo) { const s = st(); s[t.dataset.duo] = t.checked; save(s); badge(); draw(); }
  }
  async function open() { D.area = ''; D.user = ''; if (D.preset === 'last' && D.key.split('|')[0] !== 'last') D.rows = []; draw(); if (!D.rows.length || !D.at || Date.now() - D.at.getTime() > 60000) { await scan(); draw(); } }
  function addBtns() {
    const a = Q('.topbar-actions'); if (a && !Q('#duBell')) { const b = document.createElement('button'); b.id = 'duBell'; b.type = 'button'; b.title = 'Recent data added or edited by the other users in your areas'; b.textContent = '🔔 Updates'; b.addEventListener('click', open); a.insertBefore(b, a.firstChild); }
    const f = Q('.sidebar-footer'); if (f && !Q('#duBtn')) { const b = document.createElement('button'); b.id = 'duBtn'; b.type = 'button'; b.textContent = '🔔 Data updates'; b.title = 'Recent data added or edited by the other users in your areas'; b.addEventListener('click', open); f.insertBefore(b, f.firstChild); }
    badge();
  }
  async function check() {
    try { if (typeof currentUser === 'undefined' || !currentUser) return; addBtns(); const rows = await scan(); if (visibleRows().length && st().popup !== false) { const w = Q('#wnOv'); if (w) { setTimeout(check2, 6000); return; } draw(); } } catch (e) { }
  }
  function check2() { if (Q('#wnOv') || Q('#wnTour')) return setTimeout(check2, 6000); if (visibleRows().length && !Q('#duOv') && st().popup !== false) draw(); }
  const prev = typeof onLoginComplete === 'function' ? onLoginComplete : null;
  if (prev) onLoginComplete = function () { const r = prev.apply(this, arguments); D.rows = []; D.at = null; setTimeout(check, 4500); return r; };
  /* a restored session (page reload / already signed in) does not pass through onLoginComplete → make sure the buttons exist and run the first check once */
  let first = false, t0 = 0; const boot = setInterval(() => { try { if (typeof currentUser !== 'undefined' && currentUser) { addBtns(); if (!first) { first = true; setTimeout(check, 3500); } } else first = false; if (++t0 > 4000) clearInterval(boot); } catch (e) { } }, 2000);
  setInterval(() => { try { if (typeof currentUser !== 'undefined' && currentUser && !D.busy && !Q('#duOv')) scan(); } catch (e) { } }, 10 * 6e4);
  window.DU = { addBtns, range, FEEDS, D, scan, open, pending, visibleRows, st };
})();
