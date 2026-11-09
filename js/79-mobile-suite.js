/* ============================================================
   ORBIT MOBILE SUITE — every screen of the Power Apps field app (NFPC W/L App X-14 inspection scanner) rebuilt for the phone.
   Plugs into js/71-mobile-app.js (shell, layouts, themes, sign-in): 71 shows the module menu, this file draws and runs the screens.
   · same SharePoint lists and columns as the Power App (internal names are matched by display name)
   · offline queue: a record saved without a connection waits on the phone and uploads by itself (☁ Sync & offline queue)
   · live ODO scanner: camera + on-device digit reading inside a guide frame, the photo is kept with the record
   · barcode scanner: camera (BarcodeDetector, or ZXing when the phone has none)
   ============================================================ */
(function () {
  'use strict';
  const A = () => window.MOBA || {};
  const Q = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nz = x => String(x || '').toLowerCase().replace(/_x[0-9a-f]{4}_/g, '').replace(/[^a-z0-9]/g, '');
  const num = v => { if (v && typeof v === 'object') v = v.Value != null ? v.Value : v.value; const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; };
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date()), addD = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return ymd(x); };
  const dOnly = v => { if (!v) return ''; if (/^\d{4}-\d\d-\d\d$/.test(String(v))) return String(v); const d = new Date(v); return isNaN(d) ? String(v).slice(0, 10) : ymd(d); };
  const dt = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dmy = v => { const s = dOnly(v); if (!s) return ''; const [y, m, d] = s.split('-'); return d + '/' + m + '/' + y; };
  const ch = v => v && typeof v === 'object' ? (v.Value != null ? v.Value : v.value != null ? v.value : v.LookupValue || '') : v == null ? '' : v;   /* choice / lookup → text */
  const str = v => String(ch(v) == null ? '' : ch(v)).trim();
  const fmtN = (n, d) => (Math.round(num(n) * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString();
  const usTs = d => pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + d.getFullYear() + ' ' + (() => { let h = d.getHours(); const a = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return pad(h) + ':' + pad(d.getMinutes()) + ' ' + a; })();
  const iso = () => new Date().toISOString();
  const me = () => (A().me && A().me()) || '';
  const isMe = u => nz(u) === nz(me());
  const toast = (t, k) => A().toast ? A().toast(t, k) : alert(t);
  const V = () => A().S.v;
  const render = () => A().render && A().render();
  const cur = () => A().S && A().S.page;
  const LSK = (typeof LS_BASE !== 'undefined' ? LS_BASE : 'orbit') + '_mobx';

  /* ---------- data: cached reads ---------- */
  const C = {};
  async function get(list, f, force) { const k = list + '|' + (f ? f.join('~') : ''), c = C[k];
    if (c && c.rows && !force && Date.now() - c.at < 180000) return c.rows; if (c && c.p && !force) return c.p;
    const p = A().read(list, f).then(r => { C[k] = { at: Date.now(), rows: r }; return r; }, e => { delete C[k]; throw e; }); C[k] = { at: 0, rows: c && c.rows, p }; return p; }
  const drop = (...lists) => Object.keys(C).forEach(k => { if (lists.some(l => k.startsWith(l + '|'))) delete C[k]; });
  const D = {};   /* per screen: loaded data */
  async function need(page, spec, force) { const d = D[page] = D[page] || {}; d.busy = 1; d.err = ''; if (cur() === page) render();
    await Promise.all(Object.entries(spec).map(async ([k, s]) => { try { d[k] = await get(s[0], s[1], force); } catch (e) { d[k] = d[k] || []; d.err = (d.err ? d.err + ' · ' : '') + s[0] + ': ' + e.message; } }));
    d.busy = 0; d.at = Date.now(); if (cur() === page) render(); return d; }

  /* ---------- the signed-in user (LoginUserList) ---------- */
  let U = null;
  async function user() { if (U) return U; let rows = []; try { rows = await get('LoginUserList'); } catch (e) {}
    const row = rows.find(r => isMe(r.username) || isMe(r.title)) || {}, lmName = str(row.linemngr || row.linemanager || row.lnmngr), lm = rows.find(r => lmName && nz(r.username) === nz(lmName)) || {};
    U = { row, rows, lm: lmName, lmEmail: str(lm.emailid || lm.email || lm.mail), myEmail: str(row.emailid || row.email), emp: str(row.empid || row.fileno || row.filenr), access: num(row.accesslevel), loc: str(row.locationid || (A().myLoc && A().myLoc()) || ''), locDesc: str(row.locationdesc || row.whsdesc || (A().myWh && A().myWh()) || ''), region: str(row.region || row.regiondesc) };
    return U; }

  /* ---------- writes, with the offline queue ---------- */
  const QK = LSK + '_queue';
  const qGet = () => { try { return JSON.parse(localStorage.getItem(QK) || '[]'); } catch (e) { return []; } };
  const qSet = a => { try { localStorage.setItem(QK, JSON.stringify(a)); } catch (e) {} updBadge(); };
  const offline = e => !navigator.onLine || (e && (e.name === 'TypeError' || /Failed to fetch|NetworkError|Load failed|network/i.test(e.message || '')));
  async function put(list, fields, label) { try { const r = await A().add(list, fields); drop(list); return r; }
    catch (e) { if (offline(e)) { const q = qGet(); q.push({ id: Date.now() + '' + Math.random(), op: 'add', list, fields, label: label || list, at: Date.now() }); qSet(q); return { queued: true }; } throw e; } }
  async function patch(list, id, fields, label) { if (!id) throw new Error('No record id'); try { const r = await A().upd(list, id, fields); drop(list); return r; }
    catch (e) { if (offline(e)) { const q = qGet(); q.push({ id: Date.now() + '' + Math.random(), op: 'upd', list, item: id, fields, label: label || list, at: Date.now() }); qSet(q); return { queued: true }; } throw e; } }
  let flushing = 0;
  async function flush(quiet) { if (flushing || !navigator.onLine) return; const q = qGet(); if (!q.length) return; flushing = 1; let ok = 0;
    for (const x of q) { try { if (x.op === 'add') await A().add(x.list, x.fields); else await A().upd(x.list, x.item, x.fields); x.done = 1; ok++; drop(x.list); } catch (e) { x.err = e.message; if (offline(e)) break; } }
    qSet(q.filter(x => !x.done)); flushing = 0; if (ok && !quiet) toast('☁ ' + ok + ' record(s) uploaded from the phone', 'success'); if (cur() === 'x_sync') render(); }
  window.addEventListener('online', () => setTimeout(() => flush(), 1500)); setInterval(() => flush(true), 60000);
  function updBadge() { const n = qGet().length, h = Q('#mob .mb-bar'); if (!h) return; let b = Q('#mxQ'); if (!n) { if (b) b.remove(); return; } if (!b) { b = document.createElement('button'); b.id = 'mxQ'; b.className = 'mb-ib'; b.dataset.x = 'goSync'; b.title = 'Records waiting to upload'; h.insertBefore(b, h.querySelector('[data-m="theme"]')); } b.innerHTML = '☁<i>' + n + '</i>'; }
  const saved = (r, what) => { const q = r && r.queued; toast('✅ ' + what + (q ? ' – saved on this phone. It uploads automatically when you are online.' : ' – saved and sent to SharePoint.'), q ? 'info' : 'success'); A().log && A().log(what + (q ? ' (queued)' : '')); };
  const fail = (what, e) => { if (/Cancelled/i.test(e && e.message)) return; A().log && A().log(what + ' — ' + e.message, 'bad'); toast('Not saved: ' + e.message, 'error'); };
  const prog = (n, l) => { try { window.orbProg && orbProg.expect && orbProg.expect(n, l); } catch (e) {} };
  async function attachAll(list, id, photos, base) { if (!id || !photos || !photos.length) return 0; let n = 0; for (let i = 0; i < photos.length; i++) { if (await A().attach(list, id, photos[i].blob, (base || 'Photo') + '_' + (i + 1) + '_' + Date.now() + '.jpg')) n++; } return n; }
  async function mail(to, subj, html, cc) { if (!to) { toast('❌ Recipient email is blank', 'error'); return false; } try { if (typeof mailSend_send !== 'function') throw new Error('mail is not set up'); await mailSend_send({ to, cc: cc || '', subject: subj, html }); toast('✅ Email sent to ' + to, 'success'); return true; } catch (e) { toast('Email not sent: ' + e.message, 'warn'); return false; } }
  const mailTbl = (title, rows, color) => `<div style="font-family:Segoe UI,Arial,sans-serif;background:#eef2f7;padding:18px"><div style="max-width:640px;margin:auto;background:#fff;border-radius:14px;overflow:hidden"><div style="background:${color || '#1d4ed8'};color:#fff;padding:18px 22px"><div style="font-size:11px;letter-spacing:1px;opacity:.85">NFPC · ORBIT MOBILE</div><div style="font-size:19px;font-weight:700;margin-top:3px">${esc(title)}</div></div><table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:9px 14px;background:#f1f5f9;color:#475569;font-weight:600;width:40%">${esc(k)}</td><td style="padding:9px 14px;border-bottom:1px solid #e2e8f0">${esc(v)}</td></tr>`).join('')}</table><div style="padding:12px 22px;color:#64748b;font-size:12px">Sent from ORBIT mobile by ${esc(me())} · ${new Date().toLocaleString()}</div></div></div>`;
  const mailGrid = (title, head, rows, color) => `<div style="font-family:Segoe UI,Arial,sans-serif;background:#eef2f7;padding:18px"><div style="max-width:900px;margin:auto;background:#fff;border-radius:14px;overflow:hidden"><div style="background:${color || '#1d4ed8'};color:#fff;padding:16px 22px;font-size:18px;font-weight:700">${esc(title)}</div><table style="width:100%;border-collapse:collapse;font-size:12.5px"><tr>${head.map(h => `<th style="text-align:left;padding:7px 9px;background:#f1f5f9;color:#334155">${esc(h)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td style="padding:6px 9px;border-bottom:1px solid #e2e8f0">${esc(c)}</td>`).join('')}</tr>`).join('')}</table><div style="padding:10px 22px;color:#64748b;font-size:12px">${rows.length} row(s) · sent by ${esc(me())} · ${new Date().toLocaleString()}</div></div></div>`;
  async function geoNeed(msgLm) { const g = A().geo ? await A().geo() : null; if (!g) toast('⚠️ Location detection is disabled on this device. Please enable it so the action can be recorded.' + (msgLm ? ' If you need support contact ' + msgLm : ''), 'warn'); return g; }

  /* ---------- small UI kit (fields keep their value in the screen state: data-v) ---------- */
  const ival = k => { const v = V()[k]; return v == null ? '' : v; };
  const H = {
    card: (t, b, cls) => `<div class="mb-card ${cls || ''}">${t ? `<h3>${t}</h3>` : ''}${b}</div>`,
    f: (label, inner, hint) => `<div class="mb-f">${label ? `<label>${label}</label>` : ''}${inner}${hint ? `<span class="mb-hint">${hint}</span>` : ''}</div>`,
    inp: (k, o) => { o = o || {}; return `<input data-v="${k}" value="${esc(o.val != null ? o.val : ival(k))}" placeholder="${esc(o.ph || '')}"${o.type ? ` type="${o.type}"` : ''}${o.mode ? ` inputmode="${o.mode}"` : ''}${o.big ? ' class="mb-big"' : ''}${o.r ? ' data-r="1"' : ''}${o.list ? ` list="${o.list}"` : ''} autocomplete="off">`; },
    num: (k, o) => H.inp(k, Object.assign({ mode: 'decimal' }, o)),
    date: (k, o) => H.inp(k, Object.assign({ type: 'date', val: ival(k) || today() }, o)),
    txt: (k, ph) => `<textarea data-v="${k}" rows="3" placeholder="${esc(ph || '')}">${esc(ival(k))}</textarea>`,
    sel: (k, opts, o) => { o = o || {}; const v = String(ival(k)); return `<select data-v="${k}"${o.r !== false ? ' data-r="1"' : ''}>${o.ph !== false ? `<option value="">${esc(o.ph || '— choose —')}</option>` : ''}${opts.map(x => { const [val, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(val)}"${String(val) === v ? ' selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`; },
    seg: (k, opts, dflt) => `<div class="mb-seg">${opts.map(x => { const [val, t] = Array.isArray(x) ? x : [x, x]; return `<button type="button" data-x="set" data-k="${k}" data-val="${esc(val)}" class="${String(ival(k) || dflt || '') === String(val) ? 'on' : ''}">${t}</button>`; }).join('')}</div>`,
    btn: (t, x, cls, at) => `<button type="button" class="mb-btn ${cls || 'p'}" data-x="${x}" ${at || ''}>${t}</button>`,
    sbtn: (t, x, at, cls) => `<button type="button" class="mx-sb ${cls || ''}" data-x="${x}" ${at || ''}>${t}</button>`,
    pill: (t, c) => `<span class="mb-pill ${c || ''}">${esc(t)}</span>`,
    kpis: a => `<div class="mx-kpis">${a.map(([l, v, c]) => `<div class="mb-k${c ? ' ' + c : ''}"><span>${esc(l)}</span><b>${v}</b></div>`).join('')}</div>`,
    empty: t => `<div class="mb-empty">${t}</div>`,
    load: d => d && d.busy ? `<div class="mx-ld"><i></i><i></i><i></i> Loading from SharePoint…</div>` : d && d.err ? `<div class="mb-hint mb-bad" style="margin:0 4px 10px">⚠ ${esc(d.err)}</div>` : '',
    search: (k, ph) => `<div class="mb-search mx-search"><span>🔍</span><input data-q="${k}" value="${esc(ival(k))}" placeholder="${esc(ph || 'Search…')}" autocomplete="off"></div>`,
    tabs: (k, opts, dflt) => `<div class="mx-tabs">${opts.map(([val, t, n]) => `<button type="button" data-x="set" data-k="${k}" data-val="${esc(val)}" class="${String(ival(k) || dflt) === String(val) ? 'on' : ''}">${t}${n != null ? ` <i>${n}</i>` : ''}</button>`).join('')}</div>`,
    li: (o) => `<div class="mb-li mx-li${o.x ? ' tap' : ''}" ${o.x ? `data-x="${o.x}" data-i="${esc(o.i)}"` : ''}>${o.ic ? `<span class="mx-av" style="--a:${o.c || 'var(--acc)'}">${o.ic}</span>` : ''}<div class="d"><b>${esc(o.t)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}${o.s2 ? `<small>${esc(o.s2)}</small>` : ''}</div>${o.v != null ? `<div class="v">${o.v}</div>` : ''}${o.p ? H.pill(o.p[1], o.p[0]) : ''}${o.x ? '<span class="mb-chev">›</span>' : ''}</div>`,
    photos: (k, max) => { const a = V()[k] || []; return `<div class="mx-ph">${a.map((p, i) => `<span><img src="${p.url}" alt=""><button type="button" data-x="phDel" data-k="${k}" data-i="${i}">✕</button></span>`).join('')}${a.length < (max || 6) ? `<label class="mx-phadd"><input type="file" accept="image/*" capture="environment" data-ph="${k}" hidden>📷<small>Add photo</small></label>` : ''}</div>`; },
    odo: (k, label, prev, o) => { o = o || {}; const v = ival(k), d = v !== '' && prev != null && prev !== '' ? num(v) - num(prev) : null;
      return `<div class="mb-f mx-odo"><label>${label || 'Current ODO reading'}${prev != null && prev !== '' ? ` <span class="mx-prev">previous ${fmtN(prev)}</span>` : ''}</label><div class="mx-odorow"><input data-v="${k}" class="mb-big" inputmode="numeric" pattern="[0-9]*" value="${esc(v)}" placeholder="000000"><button type="button" class="mx-scan" data-x="odoScan" data-t="${k}" data-prev="${esc(prev == null ? '' : prev)}" title="Scan the ODO with the camera">📷<small>Scan</small></button></div>${d != null ? `<span class="mb-hint ${d <= 0 ? 'mb-bad' : d > (o.max || 400) ? 'mb-warn' : 'mb-ok'}">${d <= 0 ? '⚠ Equal to or less than the previous ODO' : '+' + fmtN(d) + ' km since the previous reading' + (d > (o.max || 400) ? ' — above ' + (o.max || 400) + ' km, please check' : '')}</span>` : ''}${V()[k + '_ph'] ? `<span class="mb-hint mb-ok">📷 ODO photo kept with the record</span>` : ''}</div>`; },
    head: (ic, t, s, c) => `<div class="mx-head" style="--a:${c || '#2563eb'}"><span>${ic}</span><div><b>${esc(t)}</b>${s ? `<small>${s}</small>` : ''}</div></div>`,
    bar: (inner) => `<div class="mx-bar">${inner}</div>`
  };
  const pick = (k, ...ks) => r => { for (const x of [k, ...ks]) { const v = r[nz(x)]; if (v != null && v !== '') return v; } return ''; };
  const searchHit = (r, q, keys) => !q || keys.map(k => str(r[nz(k)])).join(' ').toLowerCase().includes(q.toLowerCase());
  const byIdDesc = (a, b) => b.id - a.id;
  const opt = (rows, k, t) => [...new Map(rows.map(r => [str(r[nz(k)]), str(r[nz(t || k)])])).entries()].filter(x => x[0]).sort((a, b) => a[1].localeCompare(b[1]));

  /* ---------- detail sheet ---------- */
  function sheet(title, kv, acts) { V().sheet = { title, kv, acts }; render(); }
  const sheetHtml = () => { const s = V().sheet; if (!s) return ''; return `<div class="mx-sheet" data-x="sheet0"><div class="mx-sh" data-stop="1"><div class="mx-grab"></div><h3>${esc(s.title)}</h3><div class="mx-shb">${(s.kv || []).filter(x => x[1] !== '' && x[1] != null).map(([k, v]) => `<div class="mb-li mb-kv"><div class="d"><small>${esc(k)}</small><b style="white-space:normal">${esc(v)}</b></div></div>`).join('')}</div>${s.acts || ''}<button type="button" class="mb-btn s" data-x="sheet0" style="margin-top:10px">Close</button></div></div>`; };
  const allKv = r => Object.entries(r).filter(([k, v]) => !/^(id|odataetag|contenttype|attachments|edit|linktitle|linktitlenomenu|docicon|itemchildcount|folderchildcount|complianceassetid|appauthor|appeditor|version|authorlookupid|editorlookupid|_.*)$/.test(k) && v !== '' && v != null && typeof v !== 'object').map(([k, v]) => [k, /\d{4}-\d\d-\d\dT/.test(String(v)) ? dt(v) : String(v)]);

  /* ---------- live ODO scanner (camera + digit reading in a guide frame) ---------- */
  let TW = null;
  async function worker() { if (TW) return TW; const T = await A().loadTess(); if (T.createWorker) { const w = await T.createWorker('eng'); await w.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '7' }); TW = { rec: c => w.recognize(c).then(r => r.data) }; } else TW = { rec: c => T.recognize(c, 'eng', { tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '7' }).then(r => r.data) }; return TW; }
  function prepCanvas(src, sx, sy, sw, sh, inv) { const sc = Math.min(3, 1100 / Math.max(sw, 1)), c = document.createElement('canvas'); c.width = Math.round(sw * sc); c.height = Math.round(sh * sc); const g = c.getContext('2d'); g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data; let sum = 0; for (let i = 0; i < a.length; i += 4) { const y = a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11; a[i] = y; sum += y; } const avg = sum / (a.length / 4), dark = inv == null ? avg < 115 : inv;
    for (let i = 0; i < a.length; i += 4) { let y = a[i]; if (dark) y = 255 - y; y = y > (dark ? 255 - avg : avg) * 0.92 ? 255 : 0; a[i] = a[i + 1] = a[i + 2] = y; } g.putImageData(d, 0, 0); return c; }
  function odoScan(prev) { return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'mx-cam'; ov.innerHTML = `<video playsinline muted autoplay></video><div class="mx-camtop"><button type="button" data-c="x">✕</button><b>Scan the ODO</b><button type="button" data-c="torch" title="Light">🔦</button></div>
      <div class="mx-frame"><i></i><i></i><i></i><i></i><span class="mx-scanline"></span></div><div class="mx-camhint">Fit the odometer digits inside the frame and hold steady</div>
      <div class="mx-camres"><div class="mx-read">– – – – – –</div><div class="mx-camsub">${prev ? 'Previous ODO ' + fmtN(prev) : 'Reading…'}</div><div class="mx-cands"></div><div class="mx-camb"><button type="button" data-c="snap">📸 Capture</button><button type="button" data-c="use" disabled>✔ Use this reading</button></div></div>`;
    (Q('#mob') || document.body).appendChild(ov); const vid = ov.querySelector('video'), out = ov.querySelector('.mx-read'), sub = ov.querySelector('.mx-camsub'), cands = ov.querySelector('.mx-cands'), useB = ov.querySelector('[data-c="use"]');
    let stream = null, alive = true, best = null, votes = new Map(), lastShot = null, busy = false, torch = false;
    const close = res => { alive = false; try { stream && stream.getTracks().forEach(t => t.stop()); } catch (e) {} ov.remove(); resolve(res || null); };
    const frameBox = () => { const f = ov.querySelector('.mx-frame').getBoundingClientRect(), vr = vid.getBoundingClientRect(), vw = vid.videoWidth, vh = vid.videoHeight, s = Math.max(vr.width / vw, vr.height / vh), ox = (vw * s - vr.width) / 2, oy = (vh * s - vr.height) / 2;
      return { x: Math.max(0, (f.left - vr.left + ox) / s), y: Math.max(0, (f.top - vr.top + oy) / s), w: Math.min(vw, f.width / s), h: Math.min(vh, f.height / s) }; };
    const grab = () => { const c = document.createElement('canvas'); c.width = vid.videoWidth; c.height = vid.videoHeight; c.getContext('2d').drawImage(vid, 0, 0); return c; };
    const score = v => { const lv = num(prev); return (lv ? (v > lv && v <= lv + 3000 ? 1000 : v > lv ? 150 : -400) - Math.min(600, Math.abs(v - lv) / 20) : String(v).length * 20) + (votes.get(v) || 0) * 60; };
    const show = () => { const L2 = [...votes.keys()].sort((a, b) => score(b) - score(a)).slice(0, 4); best = L2[0] != null ? L2[0] : null; out.textContent = best != null ? best.toLocaleString() : '– – – – – –'; useB.disabled = best == null; useB.textContent = best != null ? '✔ Use ' + best.toLocaleString() : '✔ Use this reading';
      if (best != null && prev) { const d = best - num(prev); sub.textContent = d > 0 ? '+' + d.toLocaleString() + ' km since the previous ' + fmtN(prev) : '⚠ not above the previous ' + fmtN(prev); sub.className = 'mx-camsub ' + (d > 0 && d <= 3000 ? 'ok' : 'bad'); }
      cands.innerHTML = L2.slice(1).map(c => `<button type="button" data-v="${c}">${c.toLocaleString()}</button>`).join(''); };
    async function tick() { if (!alive) return; if (busy || !vid.videoWidth) return setTimeout(tick, 400); busy = true;
      try { const w = await worker(), b = frameBox(), full = grab(); lastShot = full;
        for (const inv of [null, true]) { const r = await w.rec(prepCanvas(full, b.x, b.y, b.w, b.h, inv)); String(r.text || '').replace(/[^\d\s]/g, ' ').split(/\s+/).filter(x => x.length >= 3 && x.length <= 7).forEach(x => votes.set(+x, (votes.get(+x) || 0) + 1 + (r.confidence > 70 ? 1 : 0))); if (votes.size) break; }
        show(); } catch (e) { sub.textContent = '⚠ ' + e.message; } busy = false; if (alive) setTimeout(tick, 300); }
    ov.addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.v) { votes.set(+b.dataset.v, (votes.get(+b.dataset.v) || 0) + 50); return show(); }
      const c = b.dataset.c; if (c === 'x') return close(null);
      if (c === 'torch') { torch = !torch; try { await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch }] }); } catch (x) { toast('This phone has no camera light control', 'info'); } return; }
      if (c === 'snap') { lastShot = grab(); votes.clear(); out.textContent = '…'; return tick(); }
      if (c === 'use' && best != null) { const shot = lastShot || grab(); const blob = await new Promise(r => shot.toBlob(r, 'image/jpeg', .82)); const ph = await A().shrink(blob, 1400, .8); close({ value: best, photo: ph }); } });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { close(null); toast('The camera cannot stream on this page (https needed) — take a still photo instead.', 'warn'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(s => { stream = s; vid.srcObject = s; vid.onloadedmetadata = () => { vid.play(); setTimeout(tick, 500); }; }).catch(e => { close(null); toast('Camera not available: ' + e.message, 'warn'); });
    worker().catch(e => { sub.textContent = '⚠ The ODO reader could not load (' + e.message + ') — type the reading.'; });
  }); }

  /* ---------- barcode scanner ---------- */
  let ZX = null;
  const loadZx = () => ZX || (ZX = new Promise((res, rej) => { if (window.ZXing) return res(window.ZXing); const s = document.createElement('script'); s.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js'; s.onload = () => res(window.ZXing); s.onerror = () => { ZX = null; rej(new Error('the barcode reader could not be downloaded')); }; document.head.appendChild(s); }));
  function bcScan(title) { return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'mx-cam'; ov.innerHTML = `<video playsinline muted autoplay></video><div class="mx-camtop"><button type="button" data-c="x">✕</button><b>${esc(title || 'Scan the barcode')}</b><span></span></div><div class="mx-frame bc"><i></i><i></i><i></i><i></i><span class="mx-scanline"></span></div><div class="mx-camhint">Hold the barcode inside the frame</div><div class="mx-camres"><div class="mx-camb"><input class="mx-bcin" placeholder="or type the code" inputmode="numeric"><button type="button" data-c="ok">OK</button></div></div>`;
    (Q('#mob') || document.body).appendChild(ov); const vid = ov.querySelector('video'); let stream = null, alive = true, zr = null;
    const close = v => { alive = false; try { zr && zr.reset(); } catch (e) {} try { stream && stream.getTracks().forEach(t => t.stop()); } catch (e) {} ov.remove(); if (v && navigator.vibrate) navigator.vibrate(80); resolve(v || null); };
    ov.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.c === 'x') close(null); if (b.dataset.c === 'ok') close(ov.querySelector('.mx-bcin').value.trim() || null); });
    const start = async () => { try {
      if ('BarcodeDetector' in window) { const det = new window.BarcodeDetector(); stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }); vid.srcObject = stream; await vid.play();
        const loop = async () => { if (!alive) return; try { const r = await det.detect(vid); if (r && r[0]) return close(r[0].rawValue); } catch (e) {} setTimeout(loop, 220); }; loop(); return; }
      const Z = await loadZx(); zr = new Z.BrowserMultiFormatReader(); await zr.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, vid, (res) => { if (res && alive) close(res.getText()); });
    } catch (e) { toast('Camera / reader not available: ' + e.message + ' — type the code.', 'warn'); } };
    start(); }); }

  /* ---------- styles: cleaner, denser screens ---------- */
  const css = document.createElement('style'); css.textContent = `
#mob .mx-head{display:flex;align-items:center;gap:13px;margin:0 0 14px;padding:16px;border-radius:22px;background:linear-gradient(135deg,var(--a),color-mix(in srgb,var(--a) 55%,#0b1226));color:#fff;box-shadow:0 14px 30px -18px var(--a)}
#mob .mx-head>span{width:50px;height:50px;border-radius:16px;background:rgba(255,255,255,.18);display:grid;place-items:center;font-size:26px;flex:none}
#mob .mx-head b{display:block;font-size:17px;letter-spacing:-.01em}#mob .mx-head small{display:block;font-size:12.5px;opacity:.88;margin-top:2px;line-height:1.35}
#mob .mx-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px;margin-bottom:12px}
#mob .mx-kpis .mb-k.r b{color:#dc2626}#mob .mx-kpis .mb-k.g b{color:#16a34a}#mob .mx-kpis .mb-k.o b{color:#d97706}
#mob .mx-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 0 12px;padding:2px}#mob .mx-tabs::-webkit-scrollbar{display:none}
#mob .mx-tabs button{flex:none;border:1.5px solid var(--inpb)!important;background:var(--card)!important;color:var(--mut)!important;border-radius:999px;padding:8px 14px!important;font-weight:650;font-size:13px;white-space:nowrap}
#mob .mx-tabs button.on{background:var(--acc)!important;border-color:var(--acc)!important;color:#fff!important}#mob .mx-tabs button i{font-style:normal;opacity:.8;font-size:11.5px}
#mob .mx-search{margin-bottom:10px}
#mob .mx-li.tap{cursor:pointer}#mob .mx-li.tap:active{background:var(--soft);border-radius:12px}
#mob .mx-li .d small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mob .mx-av{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:18px;flex:none;background:color-mix(in srgb,var(--a) 16%,transparent);color:var(--a)}
#mob .mx-ld{display:flex;align-items:center;gap:5px;justify-content:center;padding:14px;color:var(--mut);font-size:13px}#mob .mx-ld i{width:7px;height:7px;border-radius:50%;background:var(--acc);animation:mxb 1s infinite ease-in-out}#mob .mx-ld i:nth-child(2){animation-delay:.15s}#mob .mx-ld i:nth-child(3){animation-delay:.3s}
@keyframes mxb{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}
#mob .mx-odorow{display:flex;gap:8px;align-items:stretch}#mob .mx-odorow input{flex:1;min-width:0}
#mob .mx-scan{flex:none;width:72px;border:0!important;border-radius:14px!important;background:linear-gradient(135deg,#0ea5e9,#2563eb)!important;color:#fff!important;font-size:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 8px 18px -8px rgba(37,99,235,.8)}#mob .mx-scan small{font-size:11px;font-weight:700}
#mob .mx-prev{float:right;font-weight:600;color:var(--mut)}#mob .mx-scanbtn{background:linear-gradient(135deg,#0ea5e9,#2563eb)!important}
#mob .mx-ph{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}#mob .mx-ph span{position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;border:1px solid var(--cardb)}#mob .mx-ph img{width:100%;height:100%;object-fit:cover}
#mob .mx-ph span button{position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:13px;padding:0}
#mob .mx-phadd{aspect-ratio:1;border:2px dashed var(--inpb);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:26px;color:var(--acc);cursor:pointer}#mob .mx-phadd small{font-size:11px;font-weight:700}
#mob .mx-chk{display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px solid var(--line)}#mob .mx-chk:last-child{border-bottom:0}#mob .mx-chk>span{flex:1;font-size:13.5px;color:var(--hd)}#mob .mx-chk>span i{font-style:normal;color:var(--mut);font-size:11.5px;margin-right:4px}
#mob .mx-tri{display:flex;gap:4px;flex:none}#mob .mx-tri button{min-width:44px;padding:7px 6px!important;border-radius:10px!important;border:1.5px solid var(--inpb)!important;background:var(--card)!important;color:var(--mut)!important;font-weight:700;font-size:12px}
#mob .mx-tri button.on.ok{background:#16a34a!important;border-color:#16a34a!important;color:#fff!important}#mob .mx-tri button.on.nok{background:#dc2626!important;border-color:#dc2626!important;color:#fff!important}#mob .mx-tri button.on.na{background:#64748b!important;border-color:#64748b!important;color:#fff!important}
#mob .mx-tg{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 2px;border-bottom:1px solid var(--line);font-size:14px;color:var(--hd)}#mob .mx-tg:last-child{border-bottom:0}
#mob .mx-sw{width:50px;height:30px;border-radius:999px;background:var(--inpb);position:relative;border:0!important;padding:0!important;flex:none;transition:.2s}#mob .mx-sw:after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:.2s}#mob .mx-sw.on{background:#16a34a!important}#mob .mx-sw.on:after{left:23px}
#mob .mx-step{display:flex;align-items:center;gap:6px}#mob .mx-step button{width:40px;height:40px;border-radius:12px!important;border:1.5px solid var(--inpb)!important;background:var(--card)!important;color:var(--acc)!important;font-size:20px;font-weight:700;padding:0!important}#mob .mx-step input,#mob .mx-line input,#mob .mx-line select,#mob .mx-odorow input,#mob .mb-row>input,#mob .mb-row>select{border:1.5px solid var(--inpb)!important;border-radius:12px!important;background:var(--inp)!important;color:var(--tx)!important;outline:0}#mob .mx-step input{width:64px!important;text-align:center;font-weight:700;padding:9px 4px!important}#mob .mx-line select{padding:9px 10px!important;font-size:14px}#mob .mb-row>input,#mob .mb-row>select{padding:11px 12px!important}
#mob .mx-bat{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-bottom:12px}#mob .mx-bat button{height:44px;border-radius:8px!important;border:1.5px solid var(--inpb)!important;background:var(--card)!important;color:var(--mut)!important;font-weight:700;padding:0!important;font-size:12px}#mob .mx-bat button.on{background:#16a34a!important;border-color:#16a34a!important;color:#fff!important}
#mob .mx-bar{position:sticky;bottom:-1px;z-index:3;margin:8px -16px 0;padding:10px 16px 12px;background:var(--bgb,rgba(11,18,38,.97));-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-top:1px solid var(--line);border-radius:18px 18px 0 0}#mob.light .mx-bar{--bgb:rgba(246,248,252,.97)}
#mob .mx-sb{border:1.5px solid var(--inpb)!important;background:var(--card)!important;color:var(--acc)!important;border-radius:11px!important;padding:8px 12px!important;font-weight:700;font-size:12.5px;white-space:nowrap}#mob .mx-sb.g{background:#16a34a!important;color:#fff!important;border-color:#16a34a!important}#mob .mx-sb.r{background:rgba(239,68,68,.12)!important;color:#dc2626!important;border-color:rgba(239,68,68,.4)!important}#mob .mx-sb.p{background:var(--acc)!important;color:#fff!important;border-color:var(--acc)!important}
#mob .mx-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}#mob .mx-acts>*{flex:1}
#mob .mx-sheet{position:fixed;inset:0;z-index:30;background:rgba(2,6,23,.55);display:flex;align-items:flex-end;animation:mxf .18s}#mob .mx-sh{background:var(--card);color:var(--tx);width:100%;max-height:86vh;overflow:auto;border-radius:24px 24px 0 0;padding:8px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -20px 40px rgba(0,0,0,.35);animation:mxu .22s}#mob.light .mx-sh{background:#fff}
#mob .mx-grab{width:44px;height:5px;border-radius:9px;background:var(--inpb);margin:4px auto 12px}#mob .mx-sh h3{margin:0 0 8px;font-size:17px;color:var(--hd)}
@keyframes mxu{from{transform:translateY(40px);opacity:.4}}@keyframes mxf{from{opacity:0}}
#mob .mx-line{display:grid;grid-template-columns:1fr auto;gap:4px 10px;padding:11px 2px;border-bottom:1px solid var(--line);align-items:center}#mob .mx-line:last-child{border-bottom:0}#mob .mx-line b{font-size:14px;color:var(--hd)}#mob .mx-line small{grid-column:1;font-size:12px;color:var(--mut)}#mob .mx-line .mx-step{grid-row:1/span 2;grid-column:2}
#mob .mx-line.diff{background:rgba(245,158,11,.08);border-radius:12px;padding-left:8px}
#mob .mb-ib i{position:absolute;top:-3px;right:-3px;min-width:17px;height:17px;border-radius:9px;background:#ef4444;color:#fff;font-size:10.5px;font-style:normal;font-weight:800;display:grid;place-items:center;padding:0 4px}#mob #mxQ{position:relative}
#mob .mx-bars{display:flex;flex-direction:column;gap:7px}#mob .mx-bars div{display:grid;grid-template-columns:110px 1fr 56px;gap:8px;align-items:center;font-size:12.5px}#mob .mx-bars em{height:10px;border-radius:9px;background:var(--seg);overflow:hidden;display:block}#mob .mx-bars em i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#60a5fa,#2563eb)}#mob .mx-bars span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mut)}#mob .mx-bars b{text-align:right;color:var(--hd)}
.mx-cam{position:fixed;inset:0;z-index:2147483646;background:#000;color:#fff;font-family:"Segoe UI",system-ui,sans-serif}
.mx-cam video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.mx-camtop{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:linear-gradient(rgba(0,0,0,.65),transparent)}
.mx-camtop button{width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.18);color:#fff;font-size:18px}.mx-camtop b{font-size:16px}.mx-camtop span{width:42px}
.mx-frame{position:absolute;left:8%;right:8%;top:30%;height:17%;border-radius:14px;box-shadow:0 0 0 100vmax rgba(0,0,0,.5)}.mx-frame.bc{top:32%;height:22%}
.mx-frame i{position:absolute;width:26px;height:26px;border:4px solid #38bdf8}.mx-frame i:nth-child(1){top:-3px;left:-3px;border-right:0;border-bottom:0;border-radius:12px 0 0 0}.mx-frame i:nth-child(2){top:-3px;right:-3px;border-left:0;border-bottom:0;border-radius:0 12px 0 0}.mx-frame i:nth-child(3){bottom:-3px;left:-3px;border-right:0;border-top:0;border-radius:0 0 0 12px}.mx-frame i:nth-child(4){bottom:-3px;right:-3px;border-left:0;border-top:0;border-radius:0 0 12px 0}
.mx-scanline{position:absolute;left:6%;right:6%;height:2px;background:#38bdf8;box-shadow:0 0 12px #38bdf8;animation:mxs 1.8s infinite ease-in-out}@keyframes mxs{0%,100%{top:12%}50%{top:86%}}
.mx-camhint{position:absolute;top:calc(30% - 34px);left:0;right:0;text-align:center;font-size:13px;opacity:.9}
.mx-camres{position:absolute;left:0;right:0;bottom:0;padding:16px 16px calc(18px + env(safe-area-inset-bottom));background:linear-gradient(transparent,rgba(0,0,0,.85) 30%)}
.mx-read{white-space:nowrap;font-size:clamp(30px,11vw,46px);font-weight:800;text-align:center;letter-spacing:.08em;font-variant-numeric:tabular-nums}.mx-camsub{text-align:center;font-size:13px;opacity:.85;margin:2px 0 8px}.mx-camsub.ok{color:#4ade80;opacity:1}.mx-camsub.bad{color:#fca5a5;opacity:1}
.mx-cands{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:10px}.mx-cands button{border:1.5px solid rgba(255,255,255,.5);background:rgba(255,255,255,.1);color:#fff;border-radius:999px;padding:7px 14px;font-weight:700;font-size:15px}
.mx-camb{display:flex;gap:10px}.mx-camb button{flex:1;height:54px;border-radius:16px;border:0;font-weight:800;font-size:15.5px;background:rgba(255,255,255,.18);color:#fff}.mx-camb button[data-c="use"],.mx-camb button[data-c="ok"]{background:linear-gradient(135deg,#22c55e,#15803d)}.mx-camb button:disabled{opacity:.45}
.mx-bcin{flex:2;height:54px;border-radius:16px;border:0;padding:0 14px;font-size:17px}
`; document.head.appendChild(css);

  /* ---------- screens registry + events ---------- */
  const X = {};
  const reg = (k, d) => { X[k] = d; };
  const ctx = () => ({ v: V(), d: D[cur()] || {} });
  window.MOBX = {
    view(p) { const d = X[p]; if (!d) return null; return () => { let h = ''; const v0 = V(); if (v0.__l !== p) { v0.__l = p; if (d.load) try { d.load(v0, false); } catch (e) { console.error(e); } } try { h = d.view(V(), D[p] || {}); } catch (e) { console.error(e); h = H.card('', `<div class="mb-hint mb-bad">⚠ ${esc(e.message)}</div>`); } return h + sheetHtml(); }; },
    after(p) { updBadge(); const d = X[p]; if (d && d.after) try { d.after(V(), D[p] || {}); } catch (e) {} },
    load(p) { user(); },
    refresh(p) { const d = X[p]; if (!d) return false; drop(...Object.values(d.lists || {}).map(x => x[0])); if (d.load) d.load(V(), true); else render(); return true; },
    click(e) { const t = e.target.closest('[data-x],[data-stop]'); if (!t || !Q('#mob').contains(t)) return false; if (t.dataset.stop && !t.dataset.x) { if (e.target === t) return true; const inner = e.target.closest('[data-x]'); if (!inner || !t.contains(inner)) return true; return MOBX.click({ target: inner, preventDefault: () => {} }); }
      const x = t.dataset.x, v = V(), p = cur();
      if (x === 'sheet0') { if (e.target.closest('.mx-sh') && !e.target.closest('[data-x="sheet0"]') ) return true; v.sheet = null; render(); return true; }
      if (x === 'set') { v[t.dataset.k] = t.dataset.val; render(); return true; }
      if (x === 'tog') { v[t.dataset.k] = !v[t.dataset.k]; render(); return true; }
      if (x === 'goSync') { A().go('x_sync'); return true; }
      if (x === 'phDel') { (v[t.dataset.k] || []).splice(+t.dataset.i, 1); render(); return true; }
      if (x === 'odoScan') { const k = t.dataset.t, prevV = t.dataset.prev; odoScan(prevV != null ? prevV : (A().lastOdo && v.veh && (A().lastOdo(v.veh) || {}).odo)).then(r => { if (!r) return; if (k === 'veh') { v.odo = String(r.value); v.photo = r.photo; v.ocr = '✔ Scanned ' + r.value.toLocaleString() + ' — check it against the photo.'; } else { v[k] = String(r.value); v[k + '_ph'] = r.photo; } render(); }); return true; }
      if (x === 'bc') { bcScan().then(c => { if (!c) return; v[t.dataset.k] = c; const d = X[p]; if (d && d.onScan) d.onScan(c, v, D[p] || {}); render(); }); return true; }
      const d = X[p]; if (d && d.act && d.act[x]) { Promise.resolve(d.act[x](t, v, D[p] || {}, e)).catch(er => toast(er.message, 'error')); return true; }
      return false; },
    input(e) { const t = e.target; if (t.dataset.v) { V()[t.dataset.v] = t.value; if (t.dataset.live) render(); return true; }
      if (t.dataset.q) { V()[t.dataset.q] = t.value; const pos = t.selectionStart, key = t.dataset.q; render(); const n = Q(`#mob [data-q="${key}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } return true; }
      if (t.dataset.ln) { const [a, i, f] = t.dataset.ln.split(':'); const arr = V()[a]; if (arr && arr[+i]) arr[+i][f] = t.value; return true; } return false; },
    change(e) { const t = e.target; if (t.dataset.ph) { const f = t.files && t.files[0]; if (!f) return true; A().shrink(f, 1600, .8).then(p => { const v = V(); v[t.dataset.ph] = (v[t.dataset.ph] || []).concat([p]); render(); }); return true; }
      if (t.dataset.v) { V()[t.dataset.v] = t.value; const d = X[cur()]; if (d && d.onChange) d.onChange(t.dataset.v, t.value, V(), D[cur()] || {}); if (t.dataset.r) render(); return true; }
      if (t.dataset.ln) { const [a, i, f] = t.dataset.ln.split(':'); const arr = V()[a]; if (arr && arr[+i]) arr[+i][f] = t.value; if (t.dataset.r) render(); return true; }
      return !!X[cur()] && t.closest('#mbBody') && !t.id; },
    odoScan, bcScan, flush, qGet
  };
  setTimeout(() => { flush(true); updBadge(); }, 4000);

  /* shared helpers for the screen files below */
  window.MOBXK = { A, X, reg, D, need, get, drop, user, put, patch, saved, fail, prog, attachAll, mail, mailTbl, mailGrid, geoNeed, H, esc, nz, num, pad, ymd, today, addD, dOnly, dt, dmy, ch, str, fmtN, usTs, iso, me, isMe, toast, V, render, cur, pick, searchHit, byIdDesc, opt, sheet, allKv, odoScan, bcScan, qGet, qSet, flush, LSK };
})();
