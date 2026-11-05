/* ============================================================
   ORBIT MOBILE — the Power Apps field app rebuilt for the phone, inside ORBIT (same sign-in, Microsoft session, lists, location scope)
   Phase 1: Vehicle ODO (camera reading) · Temperature reading · Rack stock count · Put away pallets · Move stock (racks)
   Opens by itself on phones after sign-in; "📱 Mobile" in the top bar opens it on a PC; "Desktop view" goes back.
   Every save goes through ORBIT's confirmation + progress popups.
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nz = x => String(x || '').toLowerCase().replace(/_x[0-9a-f]{4}_/g, '').replace(/[^a-z0-9]/g, '');
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; };
  const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ampm = d => { let h = d.getHours(); const a = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return pad(h) + ':' + pad(d.getMinutes()) + ' ' + a; };
  const TS = { us: d => pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + d.getFullYear() + ' ' + ampm(d), dmy: d => pad(d.getDate()) + '-' + MON[d.getMonth()].slice(0, 3) + '-' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()), long: d => MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + ampm(d).replace(/^0/, '') };
  const PKEY = LS_BASE + '_mobile';
  const me = () => (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || '';
  const myLoc = () => (typeof locIds === 'function' && currentUser ? locIds(currentUser)[0] : '') || '';
  const myWh = () => (typeof locWhName === 'function' ? locWhName(currentUser) : '') || '';
  const toast = (t, k) => { try { sectionToast(t, k || 'success'); } catch (e) {} };

  /* ---------- SharePoint: internal column names come from the list's columns (display name → internal) ---------- */
  const SP = { ids: {}, cols: {} };
  async function L(list) { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('Microsoft session is not ready — tap “Renew session”.');
    if (!SP.ids[list]) SP.ids[list] = await resolveIds(site, list, token);
    if (!SP.cols[list]) { const c = await fetchColumns(SP.ids[list].siteId, SP.ids[list].listId, token), m = new Map(); c.forEach(x => { m.set(nz(x.name), x.name); if (!m.has(nz(x.displayName))) m.set(nz(x.displayName), x.name); }); SP.cols[list] = { m, raw: c }; }
    return Object.assign({ token }, SP.ids[list], SP.cols[list]); }
  function mapF(l, obj) { const f = {}, miss = []; Object.entries(obj).forEach(([k, v]) => { if (v === undefined) return; const n = l.m.get(nz(k)); if (n) f[n] = v; else miss.push(k); }); if (miss.length) console.warn('ORBIT mobile: not in list', miss.join(', ')); return f; }
  async function add(list, obj) { const l = await L(list); return createItem(l.siteId, l.listId, mapF(l, obj), l.token); }
  async function upd(list, id, obj) { const l = await L(list); return updateItem(l.siteId, l.listId, id, spCoerceFields(l.listId, mapF(l, obj)), l.token); }
  const K = it => { const f = it.fields || {}, o = { id: +it.id || 0 }; Object.keys(f).forEach(k => { o[nz(k)] = f[k]; }); return o; };
  async function read(list, filter) { const l = await L(list); let it;
    if (filter) { try { const col = l.m.get(nz(filter[0])) || filter[0]; it = await exp_fetchFilteredItems(l.siteId, l.listId, l.token, `fields/${col} ${filter[1]} '${filter[2]}'`); } catch (e) { it = null; } }
    if (!it) it = await fetchAllItems(l.siteId, l.listId, l.token); return it.map(K); }
  const colType = (list, key) => { const c = SP.cols[list]; if (!c) return ''; const n = c.m.get(nz(key)), r = c.raw.find(x => x.name === n); return r ? r.type : ''; };
  async function attach(list, itemId, blob, name) { try { const l = await L(list), site = getGlobalSiteUrl().replace(/\/+$/, ''), tok = (typeof sp_token === 'function' && sp_token()) || l.token;
      const r = await fetch(`${site}/_api/web/lists(guid'${l.listId}')/items(${itemId})/AttachmentFiles/add(FileName='${encodeURIComponent(name)}')`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json;odata=nometadata' }, body: blob }); return r.ok; } catch (e) { return false; } }

  /* ---------- photo: camera → compressed JPEG ---------- */
  function shrink(file, max, q) { return new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); c.toBlob(b => res({ blob: b, url: c.toDataURL('image/jpeg', q), canvas: c, img }), 'image/jpeg', q); }; img.onerror = rej; img.src = u; }); }
  const geo = () => new Promise(res => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }); });

  /* ---------- ODO reading from the photo (on the phone, Tesseract.js) ---------- */
  let TS_P = null;
  const loadTess = () => TS_P || (TS_P = new Promise((res, rej) => { if (window.Tesseract) return res(window.Tesseract); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = () => res(window.Tesseract); s.onerror = () => { TS_P = null; rej(new Error('the reader could not be downloaded — check the internet connection')); }; document.head.appendChild(s); }));
  function prep(img, box) { const sx = box ? box.x * img.width : 0, sy = box ? box.y * img.height : 0, sw = box ? box.w * img.width : img.width, sh = box ? box.h * img.height : img.height, sc = Math.min(3, 1400 / Math.max(sw, 1)), c = document.createElement('canvas');
    c.width = Math.round(sw * sc); c.height = Math.round(sh * sc); const g = c.getContext('2d'); g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height), a = d.data; let sum = 0;
    for (let i = 0; i < a.length; i += 4) { const y = a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11; a[i] = a[i + 1] = a[i + 2] = y; sum += y; } const avg = sum / (a.length / 4), dark = avg < 110;
    for (let i = 0; i < a.length; i += 4) { let y = a[i]; if (dark) y = 255 - y; y = (y - 128) * 1.8 + 128; y = y < 0 ? 0 : y > 255 ? 255 : y; a[i] = a[i + 1] = a[i + 2] = y; } g.putImageData(d, 0, 0); return c; }
  async function readOdo(img, box, last, onP) {
    const T = await loadTess(); onP && onP('Reading the numbers…'); const c = prep(img, box), cands = new Map();
    for (const psm of ['7', '11']) { const r = await T.recognize(c, 'eng', { logger: m => { if (m.status === 'recognizing text' && onP) onP('Reading the numbers… ' + Math.round(m.progress * 100) + '%'); }, tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: psm });
      String(r.data.text || '').replace(/[^\d\s]/g, ' ').split(/\s+/).filter(x => x.length >= 3 && x.length <= 7).forEach(x => { const v = +x; cands.set(v, (cands.get(v) || 0) + 1); }); }
    let L2 = [...cands.keys()]; const lv = num(last); const score = v => (lv ? (v >= lv && v <= lv + 3000 ? 1000 : v >= lv ? 200 : 0) - Math.min(900, Math.abs(v - lv) / 10) : String(v).length * 10) + cands.get(v) * 5;
    L2.sort((a, b) => score(b) - score(a)); return L2.slice(0, 4); }

  /* ---------- shell ---------- */
  const css = document.createElement('style'); css.textContent = `
#mob{--tx:#e2e8f0;--hd:#fff;--mut:#94a3b8;--card:rgba(255,255,255,.06);--cardb:rgba(255,255,255,.1);--line:rgba(255,255,255,.08);--inp:rgba(255,255,255,.07);--inpb:rgba(255,255,255,.18);--acc:#60a5fa;--accb:#2563eb;--soft:rgba(96,165,250,.16);--seg:rgba(255,255,255,.07);--segon:rgba(255,255,255,.16);--nav:rgba(13,20,40,.9);--ib:rgba(255,255,255,.1);--glow:.85;--sh:0 10px 24px -14px rgba(0,0,0,.8);
 position:fixed;inset:0;z-index:9000;background:radial-gradient(circle at 15% -5%,#1e3a8a 0%,#0f1a3a 38%,#0a1022 70%);color:var(--tx);display:none;flex-direction:column;font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
#mob.light{--tx:#1d2939;--hd:#101828;--mut:#667085;--card:#fff;--cardb:#e7eaf3;--line:#eef1f6;--inp:#f9fafb;--inpb:#d0d5dd;--acc:#3b5bdb;--accb:#3b5bdb;--soft:#eef2ff;--seg:#f2f4f7;--segon:#fff;--nav:rgba(255,255,255,.92);--ib:#fff;--glow:.4;--sh:0 1px 2px rgba(16,24,40,.05),0 10px 26px -16px rgba(16,24,40,.22);
 background:linear-gradient(180deg,#f5f7fc 0%,#eef1f8 100%)}
body.mob-on #mob{display:flex}body.mob-on{overflow:hidden}
#mob *{box-sizing:border-box}#mob button{font:inherit;cursor:pointer;margin:0;width:auto;color:inherit}#mob input,#mob select,#mob textarea{font:inherit;font-size:16px;margin:0;width:100%}
#mob select option{color:#0f172a}
.mb-top{padding:calc(env(safe-area-inset-top,0px) + 10px) 16px 6px;flex:none}
.mb-bar{display:flex;align-items:center;gap:10px;min-height:42px}.mb-bar h1{font-size:18px;margin:0;flex:1;font-weight:800;color:var(--hd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mb-ib{width:42px!important;height:42px;border-radius:14px;border:1px solid var(--cardb)!important;background:var(--ib)!important;color:var(--hd)!important;font-size:19px;display:flex;align-items:center;justify-content:center;flex:none;padding:0!important}
.mb-hi{font-size:12.5px;color:var(--mut);margin-top:2px}
.mb-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px 16px calc(env(safe-area-inset-bottom,0px) + 100px)}
.mb-nav{position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);background:var(--nav);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--cardb);border-radius:22px;display:flex;padding:6px;box-shadow:0 14px 34px -12px rgba(0,0,0,.55)}
.mb-nav button{flex:1;border:0!important;background:none!important;color:var(--mut)!important;font-size:10.5px;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0!important;border-radius:16px}.mb-nav button span{font-size:20px;line-height:1}.mb-nav button.on{color:var(--acc)!important;background:var(--soft)!important}
/* glowing 3D round icon */
.mb-in{width:var(--s,56px);height:var(--s,56px);border-radius:50%;display:grid;place-items:center;font-size:calc(var(--s,56px)*.47);flex:none;position:relative;
 background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.5),rgba(255,255,255,0) 46%),linear-gradient(150deg,var(--a),var(--b));
 box-shadow:0 0 0 3px rgba(255,255,255,.07),0 0 calc(var(--s,56px)*.42) -2px color-mix(in srgb,var(--a) calc(var(--glow)*100%),transparent),0 10px 16px -8px rgba(0,0,0,.6),inset 0 -5px 9px rgba(0,0,0,.22),inset 0 2px 2px rgba(255,255,255,.35)}
.mb-in span{filter:drop-shadow(0 3px 3px rgba(0,0,0,.4));line-height:1}
.mb-in.dim{filter:saturate(.55) brightness(.85)}
.mb-hero{padding:2px 2px 12px}.mb-eyb{font-size:12px;color:var(--acc);font-weight:600}.mb-h1{font-size:24px;font-weight:800;color:var(--hd);line-height:1.2;margin-top:2px}
.mb-today{width:100%!important;display:flex!important;align-items:center;justify-content:space-between;gap:12px;text-align:left!important;border-radius:22px!important;padding:16px!important;margin-bottom:14px;border:1px solid var(--cardb)!important;background:linear-gradient(135deg,rgba(255,255,255,.13),rgba(255,255,255,.03))!important;box-shadow:var(--sh);height:auto!important}
#mob.light .mb-today{background:linear-gradient(135deg,#fff,#f1f5ff)!important}
.mb-today small{display:block;font-size:11.5px;color:var(--mut)}.mb-today b{display:block;font-size:19px;color:var(--hd);margin:2px 0;font-weight:800}
.mb-search{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--cardb);border-radius:16px;padding:10px 14px;margin-bottom:6px}.mb-search input{border:0!important;outline:0;background:none!important;padding:0!important;color:var(--tx)!important;box-shadow:none!important}
.mb-g{margin:16px 2px 10px;font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--mut)}
.mb-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 6px}
.mb-gi{border:0!important;background:none!important;display:flex!important;flex-direction:column;align-items:center;gap:8px;text-align:center!important;padding:4px 0!important;height:auto!important;white-space:normal!important;width:100%!important;box-shadow:none!important}
.mb-gi b{font-size:12px;line-height:1.2;color:var(--hd);font-weight:700}.mb-gi small{font-size:10.5px;color:var(--mut);margin-top:-5px}.mb-gi:active .mb-in{transform:scale(.94)}
.mb-sh{display:flex;align-items:center;gap:14px;padding:4px 2px 14px}.mb-sh b{font-size:21px;color:var(--hd);display:block;font-weight:800}.mb-sh small{color:var(--mut);font-size:12px}
.mb-sr{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--cardb);border-radius:18px;padding:10px 10px 10px 12px;margin-bottom:10px;box-shadow:var(--sh);cursor:pointer}
.mb-sr .d{flex:1;min-width:0}.mb-sr .d b{display:block;font-size:14px;color:var(--hd)}.mb-sr .d small{font-size:11.5px;color:var(--mut);display:block;line-height:1.3}
.mb-sr.soon{opacity:.62}.mb-chev{color:var(--mut);font-size:20px;padding:0 2px}
.mb-star{border:0!important;background:none!important;font-size:19px;color:var(--mut)!important;padding:4px!important;width:32px!important;height:32px}.mb-star.on{color:#f59e0b!important}
.mb-card{background:var(--card);border:1px solid var(--cardb);border-radius:20px;padding:16px;box-shadow:var(--sh);margin-bottom:12px}
.mb-card h3{margin:0 0 12px;font-size:15px;display:flex;align-items:center;gap:8px;color:var(--hd)}
.mb-f{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}.mb-f label{font-size:12.5px;font-weight:600;color:var(--mut)}
.mb-f input,.mb-f select,.mb-f textarea,.mb-step input,#mob .mb-row input{border:1.5px solid var(--inpb)!important;border-radius:13px!important;padding:12px 14px;background:var(--inp)!important;color:var(--tx)!important;outline:0;box-shadow:none}
.mb-f input:focus,.mb-f select:focus,.mb-step input:focus{border-color:var(--acc)!important;box-shadow:0 0 0 3px var(--soft)!important}
.mb-f input[type=date]{color-scheme:dark}#mob.light .mb-f input[type=date]{color-scheme:light}
.mb-big{font-size:30px!important;font-weight:700;text-align:center;letter-spacing:.06em;font-variant-numeric:tabular-nums}
.mb-row{display:flex;gap:10px}.mb-row>*{flex:1;min-width:0}
.mb-seg{display:flex;background:var(--seg);border-radius:15px;padding:4px;gap:4px;margin-bottom:12px}.mb-seg button{flex:1;border:0!important;background:none!important;border-radius:12px;padding:10px 4px!important;font-weight:600;color:var(--mut)!important;font-size:13.5px}.mb-seg button.on{background:var(--segon)!important;color:var(--acc)!important;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.mb-btn{display:flex!important;align-items:center;justify-content:center;gap:8px;width:100%!important;height:54px!important;border:0;border-radius:16px!important;font-weight:700;font-size:15.5px}
.mb-btn.p{background:linear-gradient(135deg,#3b82f6,#1d4ed8)!important;color:#fff!important;box-shadow:0 10px 22px -8px rgba(37,99,235,.7)}.mb-btn.s{background:var(--card)!important;color:var(--acc)!important;border:1.5px solid var(--inpb)!important}.mb-btn:disabled{opacity:.5}
.mb-photo{border:2px dashed var(--inpb);border-radius:18px;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--mut);background:var(--inp);position:relative;overflow:hidden;font-size:13.5px;text-align:center;padding:10px}
.mb-photo b{color:var(--hd)}.mb-photo img{max-width:100%;max-height:260px;border-radius:12px;display:block}.mb-photo .bx{position:absolute;border:3px solid #22c55e;border-radius:6px;box-shadow:0 0 0 2000px rgba(0,0,0,.35);pointer-events:none}
.mb-chips{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.mb-chip{border:1.5px solid var(--acc)!important;background:var(--soft)!important;color:var(--acc)!important;border-radius:999px;padding:8px 14px!important;font-weight:700;font-size:15px}
.mb-hint{font-size:12.5px;color:var(--mut);line-height:1.4}.mb-hint b{color:var(--hd)}.mb-ok{color:#22c55e!important}.mb-warn{color:#f59e0b!important}.mb-bad{color:#ef4444!important}
.mb-li{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--line)}.mb-li:last-child{border-bottom:0}.mb-li .d{flex:1;min-width:0}.mb-li .d b{display:block;font-size:14px;color:var(--hd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mb-li .d small{font-size:12px;color:var(--mut)}
.mb-li.on{background:var(--soft);border-radius:12px;padding-left:10px}
.mb-li .v{font-weight:700;font-variant-numeric:tabular-nums;text-align:right;color:var(--hd)}.mb-pill{font-size:11px;font-weight:700;border-radius:999px;padding:3px 9px;background:var(--soft);color:var(--acc);white-space:nowrap}.mb-pill.g{background:rgba(34,197,94,.16);color:#16a34a}.mb-pill.r{background:rgba(239,68,68,.16);color:#dc2626}.mb-pill.o{background:rgba(245,158,11,.18);color:#d97706}
.mb-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}.mb-k{background:var(--inp);border:1px solid var(--cardb);border-radius:14px;padding:10px}.mb-k span{display:block;font-size:11px;color:var(--mut)}.mb-k b{font-size:18px;font-variant-numeric:tabular-nums;color:var(--hd)}
.mb-step{display:flex;align-items:center;justify-content:space-between;gap:8px}.mb-step button{width:44px!important;height:44px;border-radius:12px;border:1.5px solid var(--inpb)!important;background:var(--card)!important;font-size:22px;font-weight:700;color:var(--acc)!important;padding:0!important}.mb-step input{text-align:center;font-weight:700;font-size:19px!important;height:44px;padding:0 4px!important;min-width:0}
.mb-pos{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px}.mb-pos button{height:44px;border-radius:12px;border:1.5px solid var(--inpb)!important;background:var(--card)!important;font-weight:700;font-size:13px;color:var(--hd)!important;padding:0!important}.mb-pos button.used{background:rgba(239,68,68,.16)!important;border-color:rgba(239,68,68,.35)!important;color:#ef4444!important}.mb-pos button.on{background:linear-gradient(135deg,#3b82f6,#1d4ed8)!important;border-color:#1d4ed8!important;color:#fff!important;box-shadow:0 6px 14px -6px rgba(37,99,235,.8)}
.mb-empty{text-align:center;color:var(--mut);padding:24px 10px;font-size:13.5px}
.mb-sess{background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.4);color:#d97706;border-radius:16px;padding:12px;font-size:13px;margin-bottom:12px;display:flex;gap:10px;align-items:center}.mb-sess button{border:0!important;background:#b45309!important;color:#fff!important;border-radius:10px;padding:8px 12px!important;font-weight:700;white-space:nowrap}
#mobBtn{width:auto;padding:0 10px;font-size:13px}
#mob{--z:1}#mob .mb-top,#mob .mb-body,#mob .mb-nav{zoom:var(--z)}
body.mob-on .sidebar,body.mob-on .m-menu-btn{display:none!important}
body.mob-on #sectionToast{left:14px!important;right:14px!important;bottom:calc(env(safe-area-inset-bottom,0px) + 92px)!important;max-width:none!important;border-radius:14px!important;padding:12px 16px!important;font-size:14px!important;box-shadow:0 14px 34px -10px rgba(0,0,0,.45)!important}
#mob .mb-top{-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
#mob.light .mb-ib{box-shadow:0 1px 2px rgba(16,24,40,.06)}
#mob .mb-card{border-radius:22px}#mob .mb-card h3{font-size:15.5px;font-weight:800;letter-spacing:-.01em}
#mob .mb-kv{padding:11px 4px}#mob .mb-kv .d small{display:block;font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--mut);margin-bottom:3px}#mob .mb-kv .d b{font-size:15px;font-weight:650}
#mob .mb-btn.s{font-weight:650;box-shadow:0 1px 2px rgba(16,24,40,.05)}
#mob .mb-nav button.on span{transform:translateY(-1px)}#mob .mb-nav button{transition:background .2s,color .2s}
#mob .mb-zoom{display:flex;gap:6px}#mob .mb-zoom button{flex:1;height:44px;border-radius:12px!important;border:1.5px solid var(--inpb)!important;background:var(--inp)!important;color:var(--hd)!important;font-weight:700;padding:0!important}#mob .mb-zoom button.on{border-color:var(--acc)!important;background:var(--soft)!important;color:var(--acc)!important}
@media(min-width:700px){.mb-body{max-width:640px;margin:0 auto;width:100%}.mb-top .mb-bar{max-width:640px;margin:0 auto}.mb-nav{max-width:620px;margin:0 auto}.mb-grid3{grid-template-columns:repeat(4,minmax(0,1fr))}}
/* ===== layouts: A glossy grid · B soft clay bento · C dark premium (default) · D iOS style — the ☀️/🌙 theme works with every layout ===== */
#mob.lay-a.light{background:#eef2f8}#mob.lay-b.light{background:#f5f1ea;--card:#fff;--soft:#fff3e8;--acc:#c2410c;--accb:#c2410c}#mob.lay-d.light{background:#fff;--card:#fff;--cardb:#eef2f7;--sh:none}
#mob.lay-a .mb-in,#mob.lay-d .mb-in{border-radius:30%;background:linear-gradient(150deg,var(--a),var(--b));box-shadow:0 12px 18px -8px var(--b),0 4px 6px -2px rgba(15,23,42,.25),inset 0 2px 1px rgba(255,255,255,.55),inset 0 -5px 8px rgba(0,0,0,.22)}
#mob.lay-a .mb-in:before,#mob.lay-d .mb-in:before{content:"";position:absolute;left:8%;right:8%;top:5%;height:46%;border-radius:40% 40% 45% 45%/50% 50% 40% 40%;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0))}
#mob.lay-b .mb-in{border-radius:34%;background:color-mix(in srgb,var(--a) 22%,#fff);box-shadow:6px 8px 16px -4px rgba(120,113,108,.35),inset -4px -5px 8px rgba(0,0,0,.07),inset 4px 4px 8px rgba(255,255,255,.95)}
#mob.lay-b:not(.light) .mb-in{background:color-mix(in srgb,var(--a) 30%,#1e293b);box-shadow:6px 8px 16px -4px rgba(0,0,0,.5),inset 3px 3px 6px rgba(255,255,255,.12)}
#mob.lay-b .mb-in span{filter:drop-shadow(0 4px 3px rgba(0,0,0,.25))}
/* A — blue band on the home page and the section page */
#mob.lay-a.pg-home .mb-top,#mob.lay-a.pg-sec .mb-top{background:linear-gradient(135deg,#1e3a8a,#2563eb)}#mob.lay-a.pg-home .mb-ib,#mob.lay-a.pg-sec .mb-ib{color:#fff!important;background:rgba(255,255,255,.15)!important;border-color:rgba(255,255,255,.2)!important}
.mb-aband{background:linear-gradient(135deg,#1e3a8a,#2563eb);margin:-8px -16px 0;padding:0 20px 46px;border-radius:0 0 28px 28px;color:#fff}.mb-aband .mb-eyb{color:#bfdbfe}.mb-aband .mb-h1{color:#fff}
.mb-aquick{margin:-34px 0 6px;background:var(--card);border:1px solid var(--cardb);border-radius:20px;padding:12px 6px;display:flex;justify-content:space-around;box-shadow:0 14px 28px -14px rgba(15,23,42,.45)}
.mb-aquick .mb-gi{width:auto!important;flex:1}.mb-aquick .mb-gi b{font-size:10.5px;font-weight:600}
.mb-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.mb-acard{background:var(--card)!important;border:1px solid var(--cardb)!important;border-radius:20px!important;padding:14px!important;display:flex!important;flex-direction:column;align-items:flex-start!important;gap:8px;text-align:left!important;box-shadow:var(--sh);height:auto!important;width:100%!important;white-space:normal!important}
.mb-acard b{font-size:13.5px;color:var(--hd);line-height:1.2}.mb-acard small{font-size:11px;color:var(--mut)}
/* B — bento */
.mb-bento{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:96px;gap:12px}
.mb-bt{border:0!important;border-radius:26px!important;padding:13px!important;display:flex!important;gap:10px;text-align:left!important;align-items:center;background:color-mix(in srgb,var(--a) 20%,#fff)!important;box-shadow:8px 10px 20px -10px rgba(120,113,108,.5),inset 2px 2px 4px rgba(255,255,255,.8);height:auto!important;width:100%!important;white-space:normal!important;color:#0f172a!important;min-width:0}
#mob:not(.light) .mb-bt{background:color-mix(in srgb,var(--a) 22%,#111827)!important;color:#e2e8f0!important;box-shadow:8px 10px 20px -10px rgba(0,0,0,.6)}
.mb-bt.tall{grid-row:span 2;flex-direction:column;align-items:flex-start;justify-content:space-between}.mb-bt b{font-size:13px;line-height:1.2;display:block}.mb-bt.tall b{font-size:16px}.mb-bt small{font-size:11px;opacity:.65}
.mb-bhead{border-radius:28px;padding:16px;display:flex;align-items:center;gap:14px;margin-bottom:14px;background:color-mix(in srgb,var(--a) 20%,#fff);color:#0f172a;box-shadow:8px 10px 20px -10px rgba(120,113,108,.5)}#mob:not(.light) .mb-bhead{background:color-mix(in srgb,var(--a) 22%,#111827);color:#e2e8f0}.mb-bhead b{font-size:21px;display:block}.mb-bhead small{opacity:.65;font-size:12px}
/* D — iOS list */
.mb-dlist{background:var(--card);border-radius:18px;border:1px solid var(--cardb);overflow:hidden}
.mb-drow{display:flex;align-items:center;gap:14px;padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer}.mb-drow:last-child{border-bottom:0}.mb-drow .d{flex:1;min-width:0}.mb-drow b{display:block;font-size:15px;color:var(--hd)}.mb-drow small{font-size:12px;color:var(--mut)}
.mb-dfav{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 10px;scrollbar-width:none}.mb-dfav .mb-gi{width:72px!important;flex:none}
.mb-dtitle{font-size:30px;font-weight:800;color:var(--hd);letter-spacing:-.02em}
/* layout picker (Profile) */
.mb-lays{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mb-lay{border:2px solid var(--inpb)!important;background:var(--inp)!important;border-radius:16px!important;padding:10px!important;text-align:left!important;display:flex!important;flex-direction:column;gap:6px;height:auto!important;width:100%!important;white-space:normal!important}.mb-lay.on{border-color:var(--acc)!important;box-shadow:0 0 0 3px var(--soft)}
.mb-lay b{font-size:13px;color:var(--hd)}.mb-lay small{font-size:11px;color:var(--mut);line-height:1.3}.mb-lay i{display:block;width:100%;height:44px;border-radius:10px;flex:none}`;
  document.head.appendChild(css);

  /* [section, icon, glow colour, deep colour, [screen key ('' = still in Power Apps), icon, title, subtitle, colour, deep colour]] */
  const GROUPS = [
    ['Vehicles & fleet', '🚐', '#22d3ee', '#0e7490', [['veh', '🚐', 'Vehicle ODO Reading', 'Start / parking / exception — camera reads the ODO', '#22d3ee', '#0e7490'], ['', '⛽', 'Fuel Refill', 'Fuel receipts and litres', '#fbbf24', '#b45309'], ['', '🔁', 'FL Device ODO Adjust', 'Correct a forklift hour meter', '#a78bfa', '#6d28d9'], ['', '🚛', 'Trls Unit ODO Adjust', 'Correct a trailer unit reading', '#60a5fa', '#1d4ed8'], ['', '🧾', 'Drivers Activity', 'Daily trips and stops', '#34d399', '#047857']]],
    ['WMS operation', '📦', '#60a5fa', '#1d4ed8', [['put', '📥', 'Put Away Pallets', 'Receive a pallet into a rack position', '#60a5fa', '#1d4ed8'], ['move', '🔀', 'Move Stock (Racks)', 'Move a pallet to another rack', '#818cf8', '#4338ca'], ['count', '🔢', 'Rack Stock Count', 'Count the pallets in a rack', '#38bdf8', '#0369a1'], ['', '🧺', 'Dispatch Picking', 'Pick tasks for trucks', '#34d399', '#047857'], ['', '🏷️', 'RMPM Picking', 'Raw and pack material', '#2dd4bf', '#0f766e'], ['', '🗂️', 'Move RMPM (Bins)', 'Bin to bin', '#a78bfa', '#6d28d9'], ['', '🛡️', 'Rack Inspection', 'Damages and safety', '#f87171', '#b91c1c']]],
    ['Warehouse', '🌡️', '#c084fc', '#7c3aed', [['temp', '🌡️', 'Temperature Reading', 'Temperature, humidity and photo', '#c084fc', '#7c3aed'], ['', '📤', 'Receive Stocks', 'Goods received into the store', '#34d399', '#047857'], ['', '📦', 'Release Stocks', 'Goods issued from the store', '#fb923c', '#c2410c'], ['', '📊', 'Stock Balance', 'Balance by item and location', '#60a5fa', '#1d4ed8'], ['', '⏳', 'Expired SKUs', 'Expired and near-expiry stock', '#f87171', '#b91c1c']]],
    ['Forklifts & trailers', '🚜', '#fbbf24', '#c2410c', [['', '🚜', 'Receive FL Unit', 'Take a forklift at shift start', '#fbbf24', '#c2410c'], ['', '🅿️', 'Park FL Unit', 'Hand back the forklift', '#94a3b8', '#475569'], ['', '🔋', 'Electric / LPG Change', 'Battery or gas cylinder change', '#4ade80', '#15803d'], ['', '🗺️', 'Planned Trips', 'Trips planned for you', '#38bdf8', '#0369a1'], ['', '▶️', 'Start Trip', 'Start a planned trip', '#34d399', '#047857']]],
    ['People & approvals', '👥', '#f472b6', '#be185d', [['', '⏱️', 'OT Approval Request', 'Overtime requests', '#f472b6', '#be185d'], ['', '👥', 'Employees List', 'Your team', '#818cf8', '#4338ca'], ['', '✅', 'Approvals', 'Waiting for you', '#4ade80', '#15803d']]],
    ['Cooler service', '🧊', '#fb923c', '#ea580c', [['', '📲', 'Field service tickets', 'Visits assigned to you', '#fb923c', '#ea580c'], ['', '🛠️', 'Workshop repairs', 'Coolers in the workshop', '#94a3b8', '#475569'], ['', '🚐', 'My van & custody', 'Van stock and parts', '#22d3ee', '#0e7490']]]];
  const ALL = []; GROUPS.forEach((g, gi) => g[4].forEach(it => ALL.push({ k: it[0], ic: it[1], t: it[2], sub: it[3], a: it[4], b: it[5], g: gi })));
  const icon = (e, a, b, sz, dim) => `<span class="mb-in${dim ? ' dim' : ''}" style="--a:${a};--b:${b};--s:${sz || 56}px"><span>${e}</span></span>`;
  let THEME = 'dark';
  function setTheme(t, keep) { THEME = t; if (!keep) try { localStorage.setItem(PKEY + '_theme', t); } catch (e) {} const m = Q('#mob'); if (m) m.classList.toggle('light', t === 'light'); const tb = Q('[data-m="theme"]'); if (tb) tb.textContent = t === 'light' ? '🌙' : '☀️'; let mt = document.querySelector('meta[name=theme-color]'); if (!mt) { mt = document.createElement('meta'); mt.name = 'theme-color'; document.head.appendChild(mt); } mt.content = t === 'light' ? '#eef2ff' : '#0f1a3a'; }
  const LAYS = { A: ['Glossy grid', 'Blue header, quick actions, section cards', 'light', 'linear-gradient(135deg,#1e3a8a,#2563eb 55%,#eef2f8 55%)'], B: ['Soft clay bento', 'Warm pastel tiles of different sizes', 'light', 'linear-gradient(135deg,#cffafe 0 33%,#dbeafe 33% 66%,#fef3c7 66%)'], C: ['Dark premium', 'Night-blue with glowing round icons', 'dark', 'radial-gradient(circle at 20% 0%,#1e3a8a,#0b1226 70%)'], D: ['iOS style', 'Favourites row and a big section list', 'light', 'linear-gradient(#fff,#fff) padding-box,linear-gradient(135deg,#60a5fa,#c084fc) border-box'] };
  /* the admin's choice comes from App_Config_tbl (row "MOBILE:layout" = {"layout":"C","userChoice":true}); a user may pick their own only when userChoice is on */
  let CFG = { layout: 'C', userChoice: true }; try { Object.assign(CFG, JSON.parse(localStorage.getItem(PKEY + '_cfg') || '{}')); } catch (e) {}
  const myLay = () => { let u = ''; try { u = localStorage.getItem(PKEY + '_lay') || ''; } catch (e) {} return (CFG.userChoice && LAYS[u]) ? u : (LAYS[CFG.layout] ? CFG.layout : 'C'); };
  let LAY = myLay();
  function setLay(l, mine) { if (mine) { try { localStorage.setItem(PKEY + '_lay', l); } catch (e) {} } LAY = myLay(); const m = Q('#mob'); if (m) { m.className = m.className.replace(/\blay-[a-d]\b/g, '').trim(); m.classList.add('lay-' + LAY.toLowerCase()); } let t = ''; try { t = localStorage.getItem(PKEY + '_theme') || ''; } catch (e) {} setTheme(t || LAYS[LAY][2], !t); }
  async function cfgLoad() { try { const c = await tpCtx(); if (!c) return; const its = await fetchAllItems(c.siteId, c.listId, c.token), it = its.find(x => String((x.fields || {}).Title || '').trim() === 'MOBILE:layout'); if (!it) return; const v = JSON.parse(String(it.fields.Config_Value || '{}'));
      CFG = { layout: LAYS[v.layout] ? v.layout : 'C', userChoice: v.userChoice !== false }; try { localStorage.setItem(PKEY + '_cfg', JSON.stringify(CFG)); } catch (e) {} const was = LAY; setLay(); if (was !== LAY || S.page === 'me') render(); } catch (e) { console.warn('ORBIT mobile: layout setting not read', e); } }
  let ZOOM = 1; try { ZOOM = +localStorage.getItem(PKEY + '_zoom') || 1; } catch (e) {}
  function setZoom(z) { ZOOM = z; try { localStorage.setItem(PKEY + '_zoom', String(z)); } catch (e) {} const m = Q('#mob'); if (m) m.style.setProperty('--z', z); }
  let FAV = []; try { FAV = JSON.parse(localStorage.getItem(PKEY + '_fav') || '[]'); } catch (e) {}
  const favToggle = t => { FAV = FAV.includes(t) ? FAV.filter(x => x !== t) : FAV.concat(t); try { localStorage.setItem(PKEY + '_fav', JSON.stringify(FAV)); } catch (e) {} };
  const TITLES = { home: 'ORBIT', veh: 'Vehicle ODO Reading', temp: 'Temperature Reading', count: 'Rack Stock Count', put: 'Put Away Pallets', move: 'Move Stock (Racks)', recent: 'My activity', me: 'Profile', fav: 'Favourites' };
  const S = { page: 'home', q: '', v: {}, recent: [] };
  try { S.recent = JSON.parse(localStorage.getItem(PKEY + '_recent') || '[]'); } catch (e) {}
  const log = (t, k) => { S.recent.unshift({ t, k: k || 'ok', at: Date.now() }); S.recent = S.recent.slice(0, 60); try { localStorage.setItem(PKEY + '_recent', JSON.stringify(S.recent)); } catch (e) {} };

  function shell() { if (Q('#mob')) return; const d = document.createElement('div'); d.id = 'mob'; d.dataset.nohc = '1';
    d.innerHTML = `<div class="mb-top"><div class="mb-bar"><button class="mb-ib" data-m="back" aria-label="Back">‹</button><h1 id="mbTitle">ORBIT</h1><button class="mb-ib" data-m="theme" aria-label="Light or dark">☀️</button><button class="mb-ib" data-m="refresh" aria-label="Refresh">↻</button></div><div class="mb-hi" id="mbHi"></div></div>
      <div class="mb-body" id="mbBody"></div>
      <nav class="mb-nav"><button data-nav="home"><span>🏠</span>Home</button><button data-nav="fav"><span>⭐</span>Favourites</button><button data-nav="recent"><span>🕘</span>Activity</button><button data-nav="me"><span>👤</span>Profile</button></nav>`;
    document.body.appendChild(d); setLay(); setZoom(ZOOM);
    d.addEventListener('click', onClick); d.addEventListener('input', onInput); d.addEventListener('change', onChange); }
  S.stack = [];
  const go = (p, mode) => { if (mode === 'tab' || p === 'home') S.stack = []; else if (mode !== 'back' && p !== S.page) S.stack.push({ p: S.page, sec: S.sec }); if (p !== S.page) { S.page = p; S.v = {}; } render(); const b = Q('#mbBody'); if (b) b.scrollTop = 0; if (LOADERS[p]) LOADERS[p](); if (p === 'home') LOADERS.temp(true); };
  let rendering = 0;
  function render() { if (rendering) { setTimeout(render, 0); return; } rendering = 1; try { render0(); } finally { rendering = 0; } }
  function render0() { const b = Q('#mbBody'); if (!b) return; { const m = Q('#mob'); m.className = m.className.replace(/\bpg-\S+/g, '').trim(); m.classList.add('pg-' + S.page); } Q('#mbTitle').textContent = S.page === 'home' ? '' : S.page === 'sec' ? '' : TITLES[S.page] || 'ORBIT'; Q('#mbHi').style.display = ['home', 'sec', 'fav', 'recent', 'me'].includes(S.page) ? 'none' : ''; Q('[data-m="back"]').style.display = S.page === 'home' ? 'none' : '';
    const h = new Date().getHours(); Q('#mbHi').innerHTML = S.page === 'home' ? `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, <b>${esc((currentUser && (currentUser.displayName || currentUser.username)) || '')}</b>${myWh() || myLoc() ? ' · 📍 ' + esc(myWh() || 'Location ' + myLoc()) : ''}` : esc(myWh() || (myLoc() ? 'Location ' + myLoc() : ''));
    document.querySelectorAll('#mob .mb-nav button').forEach(x => x.classList.toggle('on', x.dataset.nav === S.page));
    b.innerHTML = sess() + (PAGES[S.page] || PAGES.home)(); }
  const sess = () => getGlobalAccessToken() ? '' : `<div class="mb-sess"><span>🔑 Not connected to Microsoft 365 — nothing can be read or saved.</span><button data-m="renew">Renew session</button></div>`;

  /* ---------- pages ---------- */
  const row = x => `<div class="mb-sr${x.k ? '' : ' soon'}" ${x.k ? `data-go="${x.k}"` : 'data-soon="1"'}>${icon(x.ic, x.a, x.b, 44, !x.k)}<div class="d"><b>${esc(x.t)}</b><small>${esc(x.sub || '')}</small></div><button class="mb-star${FAV.includes(x.t) ? ' on' : ''}" data-fav="${esc(x.t)}" aria-label="Favourite">${FAV.includes(x.t) ? '★' : '☆'}</button>${x.k ? '<span class="mb-chev">›</span>' : '<span class="mb-pill o">Soon</span>'}</div>`;
  const tile = x => `<button class="mb-gi" ${x.k ? `data-go="${x.k}"` : 'data-soon="1"'}>${icon(x.ic, x.a, x.b, 56, !x.k)}<b>${esc(x.t)}</b></button>`;
  function todayCard() { const D = M.temp; let n = 0, d = 0; if (D && D.stores) D.stores.forEach(s2 => { const l = D.lim[s2.desc] || {}; n += l.n || 0; d += Math.min(D.today[s2.desc] || 0, l.n || 0); });
    const sv = S.recent.filter(r => r.k === 'ok' && new Date(r.at).toDateString() === new Date().toDateString()).length;
    if (n) return `<button class="mb-today" data-go="temp"><div><small>Today</small><b>${d} / ${n} temp readings</b><small>${d >= n ? 'All done for today ✓' : 'Tap to record the next one'}${sv ? ' · ' + sv + ' saved from this phone' : ''}</small></div>${icon('🌡️', '#c084fc', '#6d28d9', 54)}</button>`;
    return `<button class="mb-today" data-nav="recent"><div><small>Today</small><b>${sv} saved from this phone</b><small>ODO, temperature, put away, moves, counts</small></div>${icon('📊', '#60a5fa', '#1d4ed8', 54)}</button>`; }
  const PAGES = {
    homeC() { const q = S.q.toLowerCase().trim(), u = currentUser || {}, h = new Date().getHours(), first = String(u.displayName || u.username || '').split(/[ .]/)[0];
      const top = `<div class="mb-hero"><div class="mb-eyb">ORBIT${myWh() || myLoc() ? ' · ' + esc(myWh() || 'Location ' + myLoc()) : ''}</div><div class="mb-h1">${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, ${esc(first)}</div></div>`;
      const srch = `<div class="mb-search"><span>🔍</span><input id="mbQ" placeholder="Search all screens…" value="${esc(S.q)}" autocomplete="off"></div>`;
      if (q) { const L2 = ALL.filter(x => (x.t + ' ' + x.sub + ' ' + GROUPS[x.g][0]).toLowerCase().includes(q)); return top + srch + '<div style="height:10px"></div>' + (L2.map(row).join('') || '<div class="mb-empty">No screen matches.</div>'); }
      const favs = ALL.filter(x => FAV.includes(x.t));
      return top + todayCard() + srch + (favs.length ? `<div class="mb-g">⭐ Favourites</div><div class="mb-grid3">${favs.slice(0, 6).map(tile).join('')}</div>` : '')
        + `<div class="mb-g">Sections</div><div class="mb-grid3">${GROUPS.map((g, i) => `<button class="mb-gi" data-sec="${i}">${icon(g[1], g[2], g[3], 64)}<b>${esc(g[0])}</b><small>${g[4].filter(x => x[0]).length} of ${g[4].length} ready</small></button>`).join('')}</div>`; },
    secC() { const g = GROUPS[S.sec] || GROUPS[0]; return `<div class="mb-sh">${icon(g[1], g[2], g[3], 60)}<div><b>${esc(g[0])}</b><small>${g[4].length} screens · ${g[4].filter(x => x[0]).length} ready here</small></div></div>` + ALL.filter(x => x.g === (S.sec || 0)).map(row).join(''); },
    home() { const q = S.q.toLowerCase().trim(); if (q || LAY === 'C') return PAGES.homeC(); return PAGES['home' + LAY](); },
    sec() { return PAGES['sec' + LAY](); },
    homeA() { const u = currentUser || {}, h = new Date().getHours(), favs = ALL.filter(x => FAV.includes(x.t)), quick = (favs.length ? favs : ALL.filter(x => x.k)).slice(0, 4);
      return `<div class="mb-aband"><div class="mb-eyb">${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}</div><div class="mb-h1">${esc(u.displayName || u.username || '')}</div><div style="font-size:12px;opacity:.85;margin-top:2px">📍 ${esc(myWh() || (myLoc() ? 'Location ' + myLoc() : 'ORBIT'))}</div></div>
        <div class="mb-aquick">${quick.map(x => `<button class="mb-gi" ${x.k ? `data-go="${x.k}"` : 'data-soon="1"'}>${icon(x.ic, x.a, x.b, 42, !x.k)}<b>${esc(x.t.replace(/ \(.*\)| Reading| Pallets/g, ''))}</b></button>`).join('')}</div>
        ${todayCard()}<div class="mb-search"><span>🔍</span><input id="mbQ" placeholder="Search all screens…" value="" autocomplete="off"></div>
        <div class="mb-g">Sections</div><div class="mb-grid2">${GROUPS.map((g, i) => `<button class="mb-acard" data-sec="${i}">${icon(g[1], g[2], g[3], 48)}<b>${esc(g[0])}</b><small>${g[4].length} screens · ${g[4].filter(x => x[0]).length} ready</small></button>`).join('')}</div>`; },
    secA() { const g = GROUPS[S.sec] || GROUPS[0]; return `<div class="mb-aband" style="padding-bottom:22px"><div style="display:flex;align-items:center;gap:14px">${icon(g[1], g[2], g[3], 56)}<div><div class="mb-h1" style="font-size:21px">${esc(g[0])}</div><div style="font-size:12px;opacity:.85">${g[4].length} screens · ${g[4].filter(x => x[0]).length} ready here</div></div></div></div><div style="height:14px"></div>` + ALL.filter(x => x.g === (S.sec || 0)).map(row).join(''); },
    homeB() { const u = currentUser || {}, first = String(u.displayName || u.username || '').split(/[ .]/)[0], favs = ALL.filter(x => FAV.includes(x.t));
      return `<div class="mb-hero"><div class="mb-eyb" style="color:var(--mut)">Hello ${esc(first)} 👋 · ${esc(myWh() || 'ORBIT')}</div><div class="mb-h1">What's today?</div></div>${todayCard()}
        <div class="mb-bento">${GROUPS.map((g, i) => { const tall = i === 0 || i === 3; return `<button class="mb-bt${tall ? ' tall' : ''}" data-sec="${i}" style="--a:${g[2]}">${icon(g[1], g[2], g[3], tall ? 62 : 42)}<div><b>${esc(g[0])}</b><small>${g[4].length} screens</small></div></button>`; }).join('')}</div>
        ${favs.length ? `<div class="mb-g">⭐ Favourites</div><div class="mb-grid3">${favs.slice(0, 6).map(tile).join('')}</div>` : ''}<div style="height:12px"></div><div class="mb-search"><span>🔍</span><input id="mbQ" placeholder="Search all screens…" value="" autocomplete="off"></div>`; },
    secB() { const g = GROUPS[S.sec] || GROUPS[0]; return `<div class="mb-bhead" style="--a:${g[2]}">${icon(g[1], g[2], g[3], 60)}<div><b>${esc(g[0])}</b><small>${g[4].length} screens · ${g[4].filter(x => x[0]).length} ready here</small></div></div><div class="mb-bento" style="grid-auto-rows:auto">${ALL.filter(x => x.g === (S.sec || 0)).map(x => `<button class="mb-bt tall" style="--a:${x.a};grid-row:auto;min-height:118px" ${x.k ? `data-go="${x.k}"` : 'data-soon="1"'}>${icon(x.ic, x.a, x.b, 44, !x.k)}<div><b>${esc(x.t)}</b><small>${x.k ? esc(x.sub) : 'Soon'}</small></div></button>`).join('')}</div>`; },
    homeD() { const u = currentUser || {}, favs = ALL.filter(x => FAV.includes(x.t)), quick = favs.length ? favs : ALL.filter(x => x.k);
      return `<div style="padding:0 2px 8px"><div class="mb-dtitle">ORBIT</div><div class="mb-hint">${esc(u.displayName || u.username || '')}${myWh() ? ' · ' + esc(myWh()) : ''}</div></div>
        <div class="mb-g" style="margin-top:6px">${favs.length ? '⭐ Favourites' : 'Quick start'}</div><div class="mb-dfav">${quick.map(tile).join('')}</div>${todayCard()}
        <div class="mb-search"><span>🔍</span><input id="mbQ" placeholder="Search" value="" autocomplete="off"></div><div class="mb-g">Sections</div>
        <div class="mb-dlist">${GROUPS.map((g, i) => `<div class="mb-drow" data-sec="${i}">${icon(g[1], g[2], g[3], 46)}<div class="d"><b>${esc(g[0])}</b><small>${g[4].length} screens · ${g[4].filter(x => x[0]).length} ready</small></div><span class="mb-chev">›</span></div>`).join('')}</div>`; },
    secD() { const g = GROUPS[S.sec] || GROUPS[0]; return `<div style="display:flex;align-items:center;gap:12px;padding:0 2px 16px">${icon(g[1], g[2], g[3], 58)}<div class="mb-dtitle" style="font-size:24px">${esc(g[0])}</div></div><div class="mb-grid3">${ALL.filter(x => x.g === (S.sec || 0)).map(x => `<div style="position:relative">${tile(x)}<button class="mb-star${FAV.includes(x.t) ? ' on' : ''}" data-fav="${esc(x.t)}" style="position:absolute;top:-6px;right:0">${FAV.includes(x.t) ? '★' : '☆'}</button></div>`).join('')}</div>`; },
    fav() { const favs = ALL.filter(x => FAV.includes(x.t)); return favs.length ? `<div class="mb-hint" style="margin:4px 2px 14px">Your pinned screens. Tap ☆ on any screen in a section to add it here.</div>` + favs.map(row).join('') : `<div class="mb-card" style="text-align:center;padding:28px 18px">${icon('⭐', '#fbbf24', '#b45309', 64)}<h3 style="justify-content:center;margin:14px 0 6px">No favourites yet</h3><div class="mb-hint">Open a section and tap ☆ next to the screens you use most — they appear here and on the home page.</div></div>`; },
    recent() { return `<div class="mb-card"><h3>🕘 Saved from this phone</h3>${S.recent.length ? S.recent.map(r => `<div class="mb-li"><div class="d"><b>${esc(r.t)}</b><small>${new Date(r.at).toLocaleString()}</small></div><span class="mb-pill ${r.k === 'ok' ? 'g' : 'r'}">${r.k === 'ok' ? 'Saved' : 'Failed'}</span></div>`).join('') : '<div class="mb-empty">Nothing saved yet.</div>'}</div>`; },
    me() { const u = currentUser || {}; return `<div class="mb-card"><h3>👤 ${esc(u.displayName || u.username || '')}</h3>${[['User', u.username], ['Role', u.role], ['Job title', u.jobTitle], ['Location', (myWh() ? myWh() + ' · ' : '') + (myLoc() ? 'ID ' + myLoc() : '—')], ['Microsoft 365', getGlobalAccessToken() ? 'Connected' : 'Not connected']].map(([k, v]) => `<div class="mb-li mb-kv"><div class="d"><small>${k}</small><b>${esc(v || '—')}</b></div></div>`).join('')}</div>
      <div class="mb-card"><h3>🔠 Text size</h3><div class="mb-zoom">${[['S', .9], ['M', 1], ['L', 1.12], ['XL', 1.25]].map(([l, z]) => `<button type="button" data-zoom="${z}" class="${Math.abs(ZOOM - z) < .01 ? 'on' : ''}" style="font-size:${12 + z * 4}px">${l}</button>`).join('')}</div></div>
      <button class="mb-btn s" data-m="renew">🔑 Renew Microsoft session</button><div style="height:10px"></div>${CFG.userChoice ? `<div class="mb-card"><h3>🎨 Home layout</h3><div class="mb-lays">${Object.entries(LAYS).map(([k, v]) => `<button class="mb-lay${k === LAY ? ' on' : ''}" data-lay="${k}"><i style="background:${v[3]};border:2px solid transparent"></i><b>${k} · ${v[0]}</b><small>${v[1]}</small></button>`).join('')}</div></div>` : `<div class="mb-hint" style="margin:0 4px 12px">🎨 Layout <b>${LAY} · ${LAYS[LAY][0]}</b> — set by your administrator.</div>`}<button class="mb-btn s" data-m="theme2">🎨 Theme: ${THEME === 'light' ? 'Light ☀️' : 'Dark 🌙'} — tap to switch</button><div style="height:10px"></div><button class="mb-btn s" data-m="desktop">🖥 Desktop view</button><div style="height:10px"></div><button class="mb-btn s" data-m="logout">⏻ Sign out</button>`; },

    /* ----- Vehicle ODO ----- */
    veh() { const v = S.v, D = M.veh || {}, vehs = D.vehs || [], last = lastOdo(v.veh), cands = v.cands || [];
      return `<div class="mb-card"><div class="mb-seg">${['Start', 'Parking', 'Exception'].map(t => `<button data-set="type" data-val="${t}" class="${(v.type || 'Start') === t ? 'on' : ''}">${t === 'Start' ? '▶ ' : t === 'Parking' ? '🅿 ' : '⚠ '}${t}</button>`).join('')}</div>
        <div class="mb-f"><label>Vehicle</label><select id="vVeh">${vehs.length > 1 ? '<option value="">— choose the vehicle —</option>' : ''}${vehs.map(x => `<option${x === v.veh ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>${D.err ? `<span class="mb-hint mb-bad">${esc(D.err)}</span>` : !vehs.length ? '<span class="mb-hint">Loading the vehicles…</span>' : ''}</div>
        ${v.veh ? `<div class="mb-hint" style="margin:-4px 0 12px">Last reading: <b>${last ? num(last.odo).toLocaleString() + ' km' : '—'}</b>${last ? ' · ' + esc(last.type) + ' · ' + esc(last.when) : ''}</div>` : ''}
        <div class="mb-f"><label>📷 Odometer photo</label><label class="mb-photo" for="vCam" id="vPh">${v.photo ? `<img src="${v.photo.url}" alt="odometer">${v.box ? `<span class="bx" style="left:${v.box.x * 100}%;top:${v.box.y * 100}%;width:${v.box.w * 100}%;height:${v.box.h * 100}%"></span>` : ''}` : '<span style="font-size:34px">📷</span><b>Take the odometer photo</b><span>The ODO is read from the photo automatically</span>'}</label><input id="vCam" type="file" accept="image/*" capture="environment" hidden></div>
        ${v.photo ? `<div class="mb-hint" style="margin:-4px 0 8px">${esc(v.ocr || '')}</div>${cands.length ? `<div class="mb-hint">Tap the right number:</div><div class="mb-chips">${cands.map(c => `<button class="mb-chip" data-pick="${c}">${c.toLocaleString()}</button>`).join('')}</div>` : ''}<div class="mb-row" style="margin-bottom:12px"><button class="mb-btn s" data-m="crop">✂ Mark the ODO area</button><button class="mb-btn s" data-m="reread">🔍 Read again</button></div>` : ''}
        <div class="mb-f"><label>ODO reading (km)</label><input id="vOdo" class="mb-big" inputmode="numeric" pattern="[0-9]*" value="${esc(v.odo || '')}" placeholder="000000"></div>
        ${v.odo && last && num(v.odo) < num(last.odo) ? `<div class="mb-hint mb-warn" style="margin:-6px 0 10px">⚠ Lower than the last reading (${num(last.odo).toLocaleString()} km) — please check.</div>` : v.odo && last ? `<div class="mb-hint mb-ok" style="margin:-6px 0 10px">+${(num(v.odo) - num(last.odo)).toLocaleString()} km since the last reading</div>` : ''}
        <div class="mb-f"><label>Remarks</label><input id="vRem" value="${esc(v.rem || '')}" placeholder="optional"></div>
        <button class="mb-btn p" data-m="vSave">💾 Save ${esc(v.type || 'Start')} reading</button></div>
        <div class="mb-card"><h3>🕘 My recent readings</h3>${(D.reads || []).filter(r => r.user && nz(r.user) === nz(me())).slice(0, 8).map(r => `<div class="mb-li"><div class="d"><b>${esc(r.veh)}</b><small>${esc(r.type)} · ${esc(r.when)}</small></div><div class="v">${num(r.odo).toLocaleString()}</div></div>`).join('') || '<div class="mb-empty">No readings in the last 30 days.</div>'}</div>`; },

    /* ----- Temperature ----- */
    temp() { const v = S.v, D = M.temp || {}, st = D.stores || [], cur = st.find(x => x.desc === v.store), lim = cur ? D.lim[cur.desc] || {} : {}, done = cur ? D.today[cur.desc] || 0 : 0, t = v.t === '' || v.t == null ? null : num(v.t), hm = v.h === '' || v.h == null ? null : num(v.h);
      const alarmT = t != null && lim.maxT != null && t > lim.maxT, alarmH = hm != null && lim.maxH != null && hm / 100 > lim.maxH;
      return `<div class="mb-card"><div class="mb-f"><label>Store / warehouse</label><select id="tSt">${st.length > 1 ? '<option value="">— choose the store —</option>' : ''}${st.map(x => `<option value="${esc(x.desc)}"${x.desc === v.store ? ' selected' : ''}>${esc(x.id + ' · ' + x.desc)}</option>`).join('')}</select>${D.err ? `<span class="mb-hint mb-bad">${esc(D.err)}</span>` : !st.length ? '<span class="mb-hint">Loading your assigned stores…</span>' : ''}</div>
        ${cur ? `<div class="mb-kpis"><div class="mb-k"><span>Max temp</span><b>${lim.maxT != null ? lim.maxT + '°' : '—'}</b></div><div class="mb-k"><span>Max humidity</span><b>${lim.maxH != null ? Math.round(lim.maxH * 100) + '%' : '—'}</b></div><div class="mb-k"><span>Today</span><b>${done}/${lim.n || '—'}</b></div></div>` : ''}
        <div class="mb-row"><div class="mb-f"><label>Temperature °C</label><input id="tT" class="mb-big" inputmode="decimal" value="${esc(v.t || '')}" placeholder="0.0" style="${alarmT ? 'border-color:#dc2626;color:#b91c1c' : ''}"></div><div class="mb-f"><label>Humidity %</label><input id="tH" class="mb-big" inputmode="decimal" value="${esc(v.h || '')}" placeholder="0" style="${alarmH ? 'border-color:#dc2626;color:#b91c1c' : ''}"></div></div>
        ${alarmT || alarmH ? `<div id="tWarn" class="mb-hint mb-bad" style="margin:-4px 0 10px">⚠ Above the limit — an alarm email goes to your line manager when you save.</div>` : ''}
        <div class="mb-f"><label>📷 Thermometer photo</label><label class="mb-photo" for="tCam">${v.photo ? `<img src="${v.photo.url}" alt="thermometer">` : '<span style="font-size:34px">📷</span><b>Take the thermometer photo</b>'}</label><input id="tCam" type="file" accept="image/*" capture="environment" hidden></div>
        <div class="mb-f"><label>Remarks</label><input id="tRem" value="${esc(v.rem || '')}" placeholder="optional"></div>
        <button class="mb-btn p" data-m="tSave">💾 Save temperature</button></div>
        <div class="mb-card"><h3>🌡 Today</h3>${st.map(x => { const r = (D.lastBy || {})[x.desc]; return `<div class="mb-li"><div class="d"><b>${esc(x.desc)}</b><small>${r ? esc(r.time) : 'Not read yet today'}</small></div>${r ? `<div class="v">${num(r.t).toFixed(1)}° · ${num(r.h).toFixed(0)}%</div>` : ''}<span class="mb-pill ${(D.today[x.desc] || 0) >= ((D.lim[x.desc] || {}).n || 1) ? 'g' : 'o'}">${D.today[x.desc] || 0}/${(D.lim[x.desc] || {}).n || '—'}</span></div>`; }).join('') || '<div class="mb-empty">—</div>'}</div>`; },

    /* ----- Rack stock count ----- */
    count() { const v = S.v, rk = v.rack ? srkFind(v.rack) : null, items = v.items || [];
      return `<div class="mb-card">${rackPicker('cRack', v.rack)}${rk ? `<div class="mb-hint" style="margin:-4px 0 12px">${esc([rk.loc, rk.area].filter(Boolean).join(' · '))} · capacity <b>${num(rk.cap) || '—'}</b> pallets</div>` : ''}
        ${rk ? (items.length ? items.map((it, i) => `<div class="mb-li"><div class="d"><b>${esc(it.code)}</b><small>${esc(it.dtls || '')}${it.batch ? ' · ' + esc(it.batch) : ''} · system ${it.sys}</small></div><div class="mb-step" style="width:150px"><button data-step="${i}" data-d="-1">−</button><input data-cnt="${i}" inputmode="numeric" value="${it.qty}"><button data-step="${i}" data-d="1">+</button></div></div>`).join('') : '<div class="mb-empty">No stock in this rack in ORBIT — add what you see below.</div>')
          + `<div class="mb-row" style="margin:10px 0"><div class="mb-f" style="margin:0"><input id="cAdd" placeholder="Add SKU code" list="mbSkus"></div><button class="mb-btn s" data-m="cAdd" style="width:90px!important;flex:none">＋</button></div>${skuList()}
          <button class="mb-btn p" data-m="cSave">💾 Save count (${items.reduce((a, x) => a + num(x.qty), 0)} pallets)</button>` : '<div class="mb-hint">Type or scan the rack code to count it.</div>'}</div>`; },

    /* ----- Put away ----- */
    put() { const v = S.v, s = v.sku ? sku(v.sku) : null, rk = v.rack ? srkFind(v.rack) : null, B = rk && typeof rackBal === 'function' ? rackBal(rk.code, 0) : null;
      return `<div class="mb-card"><h3>📦 Pallet</h3><div class="mb-f"><label>SKU</label><input id="pSku" list="mbSkus" value="${esc(v.sku || '')}" placeholder="SKU code or name">${skuList()}${s ? `<span class="mb-hint">${esc(s.dtls)}${s.uom ? ' · ' + esc(s.uom) : ''}${s.upp ? ' · ' + s.upp + ' per pallet' : ''}</span>` : ''}</div>
        <div class="mb-f"><label>Batch</label><input id="pBatch" list="mbBatches" value="${esc(v.batch || '')}" placeholder="batch code">${s ? `<datalist id="mbBatches">${[...s.batches.values()].map(b => `<option value="${esc(b.batch)}">${esc((b.exp ? 'exp ' + b.exp : ''))}</option>`).join('')}</datalist>` : ''}</div>
        <div class="mb-row"><div class="mb-f"><label>Production</label><input id="pProd" type="date" value="${esc(v.prod || '')}"></div><div class="mb-f"><label>Expiry</label><input id="pExp" type="date" value="${esc(v.exp || '')}"></div></div>
        <div class="mb-f"><label>Quantity (${esc((s && s.uom) || 'units')})</label><input id="pQty" class="mb-big" inputmode="decimal" value="${esc(v.qty || (s && s.upp) || '')}"></div></div>
        <div class="mb-card"><h3>🧭 Where</h3>${rackPicker('pRack', v.rack)}${posGrid(rk, B, v.pos)}</div>
        <button class="mb-btn p" data-m="pSave">📥 Put away</button>`; },

    /* ----- Move stock ----- */
    move() { const v = S.v, fr = v.from ? srkFind(v.from) : null, pals = fr ? palletsIn(fr.code) : [], sel = pals[v.pi], to = v.to ? srkFind(v.to) : null, B = to && typeof rackBal === 'function' ? rackBal(to.code, 0) : null;
      return `<div class="mb-card"><h3>From</h3>${rackPicker('mFrom', v.from)}${fr ? (pals.length ? pals.map((p, i) => `<div data-pal="${i}" style="cursor:pointer" class="mb-li${i === v.pi ? ' on' : ''}"><div class="d"><b>${esc(p.code)} · ${esc(p.batch)}</b><small>${esc(p.dtls || '')}${p.pos ? ' · P' + p.pos : ''}${p.exp ? ' · exp ' + esc(p.exp) : ''}</small></div><div class="v">${p.qty.toLocaleString()}</div></div>`).join('') : '<div class="mb-empty">No pallets in this rack.</div>') : ''}</div>
        ${sel ? `<div class="mb-card"><h3>To</h3>${rackPicker('mTo', v.to)}${posGrid(to, B, v.pos)}</div><button class="mb-btn p" data-m="mSave">🔀 Move pallet</button>` : ''}`; }
  };
  const skuList = () => { const H = window.WMVX && WMVX.S && WMVX.S.hist; return H ? `<datalist id="mbSkus">${[...H.sku.values()].slice(0, 3000).map(s => `<option value="${esc(s.code)}">${esc(s.dtls)}</option>`).join('')}</datalist>` : ''; };
  const sku = code => { const H = window.WMVX && WMVX.S && WMVX.S.hist; return H ? H.sku.get(String(code).trim()) || [...H.sku.values()].find(s => nz(s.code) === nz(code)) : null; };
  function rackPicker(id, val) { const mine = myLoc(), rows = (SRK.rows || []).filter(r => !mine || !r.locId || String(r.locId).replace(/\.0+$/, '') === mine);
    return `<div class="mb-f"><label>Rack code</label><input id="${id}" list="${id}L" value="${esc(val || '')}" placeholder="e.g. ST-R01-P01" style="text-transform:uppercase" autocomplete="off"><datalist id="${id}L">${rows.slice(0, 2500).map(r => `<option value="${esc(r.code)}">${esc([r.loc, r.area].filter(Boolean).join(' · '))}</option>`).join('')}</datalist>${!SRK.ok ? '<span class="mb-hint">Loading the racks…</span>' : val && !srkFind(val) ? '<span class="mb-hint mb-bad">This rack is not in the rack setup.</span>' : ''}</div>`; }
  function posGrid(rk, B, sel) { if (!rk) return ''; const cap = Math.round(num(rk.cap)); if (!(cap > 0 && cap <= 60)) return `<div class="mb-hint">${B && B.known ? B.lane.free + ' of ' + B.lane.cap + ' positions free' : ''}</div>`; const free = new Set(B && B.known ? B.lane.freeList : []);
    return `<div class="mb-hint" style="margin-bottom:8px">${B && B.known ? `<b>${B.lane.free}</b> of ${cap} positions free — tap one` : 'Tap a position'}</div><div class="mb-pos">${Array.from({ length: cap }, (_, i) => i + 1).map(p => `<button data-pos="${p}" class="${String(sel) === String(p) ? 'on' : B && B.known && !free.has(p) ? 'used' : ''}">P${p}</button>`).join('')}</div>`; }
  function palletsIn(code) { const H = window.WMVX && WMVX.S && WMVX.S.hist, lc = String(code).toUpperCase(), out = []; if (!H) return out;
    H.sku.forEach(s => s.batches.forEach(b => { const pm = b.pp && b.pp.get(lc); if (!pm) return; pm.forEach((e, ps) => { if (e.qty > 1e-9) out.push({ code: s.code, dtls: s.dtls, uom: s.uom, batch: b.batch, prod: b.prod, exp: b.exp, pos: ps, qty: e.qty, row: e.first < 1e15 ? e.first : (b.lf && b.lf.get(lc) < 1e15 ? b.lf.get(lc) : 0) }); }); }));
    return out.sort((a, b) => a.pos - b.pos); }

  /* ---------- loaders ---------- */
  const M = {};
  function lastOdo(veh) { const R = ((M.veh || {}).reads || []).filter(r => r.veh === veh); return R[0] || null; }
  const LOADERS = {
    async veh() { if (M.veh && M.veh.vehs.length) return; M.veh = { vehs: [], reads: [] }; try { const V = await read('Vehicles_Dtls_tbl'); M.veh.vehs = [...new Set(V.map(x => String(x.vehiclesplatenr || x.vehiclenr || x.title || '').trim()).filter(Boolean))].sort(); if (M.veh.vehs.length === 1) S.v.veh = M.veh.vehs[0];
        const since = ymd(new Date(Date.now() - 30 * 864e5)) + 'T00:00:00Z', R = await read('Vehicle_Mngmnt_tbl', ['Reading_Date', 'ge', since]);
        M.veh.reads = R.filter(r => String(r.readingdate || '') >= since.slice(0, 10) || !r.readingdate).sort((a, b) => b.id - a.id).map(r => ({ veh: String(r.vehiclenr || ''), odo: r.odoreading, type: r.odoreadingtype || '', when: r.readingtimestamp || String(r.readingdate || '').slice(0, 10), user: r.username || '' })); }
      catch (e) { M.veh.err = e.message; } if (S.page === 'veh') render(); },
    async temp(quiet) { if (M.temp && (M.temp.stores.length || (quiet && M.temp.err !== undefined))) return; if (quiet && M.temp && M.temp.busy) return; M.temp = { stores: [], lim: {}, today: {}, lastBy: {}, busy: 1 }; try {
        const A = await read('WHs_Assigment_tbl'), mine = A.filter(a => nz(a.assignedstaff) === nz(me())); const st = new Map(); mine.forEach(a => { const d = String(a.whsdesc || '').trim(); if (d) st.set(d, { id: String(a.whsid || '').replace(/\.0+$/, ''), desc: d }); }); M.temp.stores = [...st.values()];
        if (M.temp.stores.length === 1) S.v.store = M.temp.stores[0].desc; if (!M.temp.stores.length) M.temp.err = 'No store is assigned to you in WHs_Assigment_tbl.';
        const SL = await read('Stores_Locations_tbl'); SL.forEach(s => { const d = String(s.storedesc || '').trim(); if (!st.has(d)) return; let mh = s.minihumdtylevel; mh = mh == null || mh === '' ? null : num(mh); if (mh != null && mh > 1.5) mh = mh / 100; M.temp.lim[d] = { maxT: s.strminitemp == null || s.strminitemp === '' ? null : num(s.strminitemp), maxH: mh, n: num(s.nrofdailytempreading) || 0 }; });
        const today = ymd(new Date()), R = await read('WHs_Temperature_Reading_tbl', ['Trans_Date', 'ge', today + 'T00:00:00Z']);
        R.filter(r => String(r.transdate || '').slice(0, 10) >= ymd(new Date(Date.now() - 864e5))).sort((a, b) => a.id - b.id).forEach(r => { const d = String(r.whsdesc || ''); if (dateOnly(r.transdate) !== today) return; M.temp.today[d] = (M.temp.today[d] || 0) + 1; M.temp.lastBy[d] = { t: r.temperaturedegree, h: r.humidityreading, time: r.transtime || '' }; }); }
      catch (e) { M.temp.err = e.message; } M.temp.busy = 0; if (M.temp.err === undefined) M.temp.err = ''; if (S.page === 'temp' || (S.page === 'home' && !S.q)) render(); },
    async count() { await wms(); }, async put() { await wms(); }, async move() { await wms(); }
  };
  const dateOnly = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? String(v).slice(0, 10) : ymd(d); };
  async function wms(force) { try { await srkLoad(!!force); } catch (e) {} if (window.WMVX && (force || !WMVX.S.hist) && !WMVX.S.loading) { try { WMVX.load(!!force); } catch (e) {} const t0 = Date.now(); while (WMVX.S.loading && Date.now() - t0 < 60000) await new Promise(r => setTimeout(r, 250)); } if (['count', 'put', 'move'].includes(S.page)) render(); }

  /* ---------- actions ---------- */
  async function photoInto(input, key, readIt) { const f = input.files && input.files[0]; if (!f) return; try { S.v[key] = await shrink(f, 1600, 0.82); S.v.box = null; S.v.cands = []; render(); if (readIt) runOcr(); } catch (e) { toast('Could not open the photo', 'error'); } }
  async function runOcr() { const v = S.v; if (!v.photo) return; v.ocr = 'Loading the reader…'; render(); const last = lastOdo(v.veh);
    try { v.cands = await readOdo(v.photo.img, v.box, last && last.odo, t => { v.ocr = t; const h = Q('#vPh'); const hint = h && h.parentElement && h.parentElement.nextElementSibling; if (hint && hint.classList.contains('mb-hint')) hint.textContent = t; });
      if (v.cands.length) { if (!v.odo) v.odo = String(v.cands[0]); v.ocr = '✔ Read ' + v.cands[0].toLocaleString() + ' — check it against the photo.'; } else v.ocr = 'No number found — mark the ODO area and read again, or type it.'; }
    catch (e) { v.ocr = '⚠ ' + e.message + ' — type the reading.'; } render(); }
  function cropMode() { const v = S.v, box = Q('#vPh'), img = box && box.querySelector('img'); if (!img) return; toast('Drag a box around the ODO digits on the photo', 'info'); let st = null;
    const pt = e => { const r = img.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; return { x: Math.min(1, Math.max(0, (p.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (p.clientY - r.top) / r.height)) }; };
    const down = e => { e.preventDefault(); st = pt(e); }, move = e => { if (!st) return; e.preventDefault(); const p = pt(e); v.box = { x: Math.min(st.x, p.x), y: Math.min(st.y, p.y), w: Math.abs(p.x - st.x), h: Math.abs(p.y - st.y) }; let b = box.querySelector('.bx'); if (!b) { b = document.createElement('span'); b.className = 'bx'; box.appendChild(b); } Object.assign(b.style, { left: v.box.x * 100 + '%', top: v.box.y * 100 + '%', width: v.box.w * 100 + '%', height: v.box.h * 100 + '%' }); };
    const up = () => { if (!st) return; st = null; ['mousedown', 'touchstart'].forEach(ev => box.removeEventListener(ev, down)); ['mousemove', 'touchmove'].forEach(ev => box.removeEventListener(ev, move)); ['mouseup', 'touchend'].forEach(ev => box.removeEventListener(ev, up)); if (v.box && v.box.w > 0.03 && v.box.h > 0.02) runOcr(); };
    ['mousedown', 'touchstart'].forEach(ev => box.addEventListener(ev, down, { passive: false })); ['mousemove', 'touchmove'].forEach(ev => box.addEventListener(ev, move, { passive: false })); ['mouseup', 'touchend'].forEach(ev => box.addEventListener(ev, up));
    box.addEventListener('click', e => e.preventDefault(), { once: true }); }

  async function vSave() { const v = S.v; v.odo = (Q('#vOdo') || {}).value || v.odo; v.rem = (Q('#vRem') || {}).value || '';
    if (!v.veh) return toast('Please choose the vehicle.', 'warn'); if (!(num(v.odo) > 0)) return toast('Please enter the ODO reading.', 'warn'); if (!v.photo) return toast('Please take a photo of the odometer.', 'warn');
    const g = await geo(), last = lastOdo(v.veh), d = new Date(), type = v.type || 'Start';
    try { await L('Vehicle_Mngmnt_tbl'); const photoTxt = /multiline/.test(colType('Vehicle_Mngmnt_tbl', 'ODO_Taken_Photo')) ? (await shrink(dataToBlob(v.photo.url), 640, 0.6)).url : undefined;
      window.orbProg && orbProg.expect && orbProg.expect(1, type + ' ODO reading · ' + v.veh);
      const r = await add('Vehicle_Mngmnt_tbl', { Title: v.veh, ODO_Reading_Type: type, Vehicle_Nr: v.veh, ODO_Reading: num(v.odo), Remarks: v.rem, User_Name: me(), Latitude_Reading: g ? String(g.lat) : '', Longitude_Reading: g ? String(g.lng) : '', Reading_Date: ymd(d), Reading_TimeStamp: TS.us(d), ODO_Reading_Diff: String(num(v.odo) - (last ? num(last.odo) : 0)), ODO_Taken_Photo: photoTxt });
      if (r && r.id) await attach('Vehicle_Mngmnt_tbl', r.id, v.photo.blob, 'ODO_' + v.veh.replace(/\W+/g, '_') + '_' + ymd(d) + '.jpg');
      M.veh.reads.unshift({ veh: v.veh, odo: num(v.odo), type, when: TS.us(d), user: me() }); log(type + ' ODO ' + v.veh + ' · ' + num(v.odo).toLocaleString() + ' km'); toast('✅ ' + type + ' ODO reading saved'); S.v = { veh: v.veh, type }; render(); }
    catch (e) { if (!/Cancelled/.test(e.message)) { log('ODO ' + v.veh + ' — ' + e.message, 'bad'); toast('Not saved: ' + e.message, 'error'); } } }
  const dataToBlob = u => { const [h, b] = u.split(','), bin = atob(b), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg' }); };

  async function tSave() { const v = S.v, D = M.temp || {}; v.t = (Q('#tT') || {}).value; v.h = (Q('#tH') || {}).value; v.rem = (Q('#tRem') || {}).value || '';
    const cur = (D.stores || []).find(x => x.desc === v.store); if (!cur || v.t === '' || v.h === '' || !v.photo) return toast('All fields are required: store, temperature, humidity and the thermometer photo.', 'warn');
    const lim = D.lim[cur.desc] || {}, t = num(v.t), h = num(v.h), cnt = (D.today[cur.desc] || 0) + 1, d = new Date(), g = await geo();
    try { await L('WHs_Temperature_Reading_tbl'); const img = /multiline/.test(colType('WHs_Temperature_Reading_tbl', 'Temperature_Image')) ? (await shrink(dataToBlob(v.photo.url), 640, 0.6)).url : undefined;
      window.orbProg && orbProg.expect && orbProg.expect(1, 'Temperature ' + cur.desc + ' ' + t + '°C');
      const r = await add('WHs_Temperature_Reading_tbl', { Title: cur.desc, Reading_By: me(), Trans_Time: ampm(d).replace(/ /, ':' + pad(d.getSeconds()) + ' '), Trans_Date: ymd(d), Trans_TimeStamp: TS.dmy(d), WHs_ID: cur.id, WHs_Desc: cur.desc, WHs_Location: g ? g.lat + ', ' + g.lng : '0, 0', Temperature_Degree: t, Humidity_Reading: h,
        Temperature_Degree_Default: lim.maxT, Temperature_Degree_Diff: lim.maxT != null ? t - lim.maxT : undefined, Humidity_Default: lim.maxH, Humidity_Diff: lim.maxH != null ? lim.maxH - h / 100 : undefined, Temperature_Remarks: v.rem, Actual_Nr_of_Reading: cnt, Remaining_Nr_of_Reading: lim.n ? lim.n - cnt : undefined, Temperature_Image: img });
      if (r && r.id) await attach('WHs_Temperature_Reading_tbl', r.id, v.photo.blob, 'Temp_' + cur.desc.replace(/\W+/g, '_') + '_' + ymd(d) + '.jpg');
      D.today[cur.desc] = cnt; D.lastBy[cur.desc] = { t, h, time: ampm(d) }; log('Temperature ' + cur.desc + ' · ' + t + '°C · ' + h + '%');
      if ((lim.maxT != null && t > lim.maxT) || (lim.maxH != null && h / 100 > lim.maxH)) alarm(cur, t, h, lim);
      toast('✅ Temperature saved' + (lim.n ? ' (' + cnt + ' of ' + lim.n + ' today)' : '')); S.v = { store: v.store }; render(); }
    catch (e) { if (!/Cancelled/.test(e.message)) { log('Temperature ' + cur.desc + ' — ' + e.message, 'bad'); toast('Not saved: ' + e.message, 'error'); } } }
  async function alarm(cur, t, h, lim) { try { const U = await read('LoginUserList'), row = U.find(u => nz(u.username) === nz(me())) || {}, to = row.lmemail || row.linemanageremail || row.lmmail || '', cc = row.recipientemail || '';
      if (!to || typeof mailSend_graphToken !== 'function') return; const tok = await mailSend_graphToken(), both = t > lim.maxT && h / 100 > lim.maxH, subj = (both ? '⚠️ TEMPERATURE & HUMIDITY DOUBLE ALARM' : t > lim.maxT ? '⚠️ TEMPERATURE ALARM | ' + (t - lim.maxT).toFixed(2) + ' °C' : '⚠️ HUMIDITY ALARM | ' + (h - lim.maxH * 100).toFixed(1) + ' %') + ' | ' + me() + ' | ' + cur.id + '-->' + cur.desc;
      const html = `<div style="font-family:Segoe UI,Arial;max-width:620px"><div style="background:#B91C1C;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0"><div style="font-size:12px;letter-spacing:1px">NFPC · W/L OPERATIONS</div><div style="font-size:20px;font-weight:700">${esc(subj.split(' | ')[0])}</div></div><div style="border:1px solid #e2e8f0;border-top:0;padding:18px 22px;border-radius:0 0 12px 12px"><p>${esc(cur.id + ' → ' + cur.desc)}</p><p>Temperature <b>${t} °C</b> (max ${lim.maxT}) · Humidity <b>${h} %</b> (max ${Math.round(lim.maxH * 100)} %)</p><p>Recorded by ${esc(me())} on ${new Date().toLocaleString()} from ORBIT mobile.</p></div></div>`;
      const ad = s => String(s).split(/[;,]/).map(x => x.trim()).filter(Boolean).map(x => ({ emailAddress: { address: x } }));
      await fetch('https://graph.microsoft.com/v1.0/me/sendMail', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { subject: subj, body: { contentType: 'HTML', content: html }, toRecipients: ad(to), ccRecipients: ad(cc) }, saveToSentItems: true }) }); toast('📧 Alarm email sent to your line manager', 'info'); } catch (e) { console.warn('alarm mail', e); } }

  function countLoad(code) { const pal = palletsIn(code), m = new Map(); pal.forEach(p => { const k = p.code + '|' + p.batch; const o = m.get(k) || { code: p.code, dtls: p.dtls, uom: p.uom, batch: p.batch, sys: 0, qty: 0 }; o.sys += 1; o.qty += 1; m.set(k, o); }); S.v.items = [...m.values()]; }
  async function cSave() { const v = S.v, rk = srkFind(v.rack); if (!rk) return toast('Choose the rack.', 'warn'); const d = new Date(), wh = myWh() || rk.loc || '';
    try { window.orbProg && orbProg.expect && orbProg.expect(1 + v.items.length, 'Rack count ' + rk.code); const h = await add('Store_Inspection_Hdr_tbl', { Title: 'Stock Count', Inspection_Date: ymd(d), Inspection_Purpose: 'Stock Count', WHs_Desc: wh, User_Name: me(), Trns_TimeStamp: TS.dmy(d), Posted_Rcrd: true });
      const rows = v.items.length ? v.items : [{ code: '', dtls: '', uom: '', sys: 0, qty: 0 }];
      for (const it of rows) await add('Store_Inspections_RowDtls_tbl', { Title: rk.code, Trans_Date: ymd(d), Header_Link: h && h.id ? +h.id : 0, WHs_Desc: rk.whs || wh, Area_Desc: rk.area, Location_Desc: rk.loc, Inspection_Purpose: 'Stock Count', Rack_Code: rk.code, Item_Code: it.code, Item_Desc: it.dtls, UOM_Desc: it.uom, Default_Capacity: num(rk.cap), Actual_Utilization: num(it.qty), Remarks: num(it.qty) !== it.sys ? 'Changed' : 'Same as last', User_Name: me(), Trns_TimeStamp: TS.dmy(d) });
      log('Rack count ' + rk.code + ' · ' + rows.reduce((a, x) => a + num(x.qty), 0) + ' pallets'); toast('✅ Count saved for ' + rk.code); S.v = {}; render(); }
    catch (e) { if (!/Cancelled/.test(e.message)) { log('Rack count ' + rk.code + ' — ' + e.message, 'bad'); toast('Not saved: ' + e.message, 'error'); } } }

  async function pSave() { const v = S.v; ['sku', 'batch', 'prod', 'exp', 'qty'].forEach(k => { const e = Q('#p' + k[0].toUpperCase() + k.slice(1)); if (e) v[k] = e.value.trim(); });
    const s = sku(v.sku), rk = srkFind(v.rack), q = num(v.qty), conv = num(s && s.base) || 1, base = q * conv, d = new Date(), loc = myLoc(), pos = num(v.pos) || 0;
    if (!s) return toast('Choose a known SKU.', 'warn'); if (!v.batch) return toast('Enter the batch.', 'warn'); if (!v.exp) return toast('Enter the expiry date.', 'warn'); if (!(q > 0)) return toast('Enter the quantity.', 'warn'); if (!rk) return toast('Choose the rack.', 'warn');
    const cap = Math.round(num(rk.cap)); if (cap > 0 && cap <= 60 && !pos) return toast('Tap the pallet position.', 'warn');
    try { window.orbProg && orbProg.expect && orbProg.expect(3, 'Put away ' + s.code + ' → ' + rk.code + (pos ? ' P' + pos : ''));
      const RB = await read('SKUs_Received_Batch_tbl', ['SKUs_Code', 'eq', s.code]), rb = RB.find(x => String(x.batchcode) === v.batch && (!loc || String(x.locationid || '').replace(/\.0+$/, '') === loc));
      if (rb) await upd('SKUs_Received_Batch_tbl', rb.id, { Total_Rcvd_Qty_Base: num(rb.totalrcvdqtybase) + base, Total_Bal_Qty_Base: num(rb.totalbalqtybase) + base, Total_Bal_Based_UOM: (num(rb.totalbalqtybase) + base) / (num(rb.uomconvrsn) || conv), User_Name: me(), TimeStamp: TS.long(d) });
      else await add('SKUs_Received_Batch_tbl', { Title: s.code, Trans_Date: ymd(d), SKUs_Code: s.code, SKUs_Desc: s.dtls, Batch_Code: v.batch, Total_Rcvd_Qty_Base: base, Total_Rlsd_Qty_Base: 0, Total_Bal_Qty_Base: base, Prod_Date: v.prod || undefined, Expiry_Date: v.exp, Ref_Nr: 'FLO put away ' + rk.code, User_Name: me(), TimeStamp: TS.long(d), Location_ID: loc, UOM_Desc: s.uom, UOM_Convrsn: conv, Total_Bal_Based_UOM: q });
      const prev = s.batches.get(v.batch) ? num(s.batches.get(v.batch).bal) * conv : 0;
      await add('SKUs_Movements_Batch_tbl', { Title: s.code, Trans_Date: ymd(d), Trans_Type: 'FLO Put away', Ref_Nr: rk.code, SKU_Code: s.code, SKU_Dtls: s.dtls, Batch_Code: v.batch, Qty_Rcvd: q, Qty_Rlsd: 0, Qty_Bal: q, Prod_Date: v.prod || undefined, Expiry_Date: v.exp, UOM_Base: String(conv), UOM_Desc: s.uom, User_Name: me(), Action_TimeStamp: TS.long(d), Base_Rcvd_Qty: base, Base_Rlsd_Qty: '0', Base_Bal_Qty: base, Location_ID: loc, SKU_Prvs_Bal: prev, SKU_Crnt_Bal: prev + base, Storage_Location: rk.code, Receiving_Status: 'Put away', PLT_Position: pos || undefined });
      await add('Store_Inspections_RowDtls_tbl', { Title: rk.code, Trans_Date: ymd(d), Header_Link: 0, WHs_Desc: rk.whs || myWh(), Area_Desc: rk.area, Location_Desc: rk.loc, Inspection_Purpose: 'Put away', Rack_Code: rk.code, Item_Code: s.code, Item_Desc: s.dtls, UOM_Desc: s.uom, Default_Capacity: num(rk.cap), Actual_Utilization: 1, Remarks: q + ' ' + (s.uom || '') + '  ·  batch ' + v.batch, User_Name: me(), Trns_TimeStamp: TS.dmy(d), Batch_Code: v.batch, Prod_Date: v.prod || undefined, Expiry_Date: v.exp, Pallet_Pos: pos ? 'P' + pos : '' });
      log('Put away ' + s.code + ' · ' + v.batch + ' → ' + rk.code + (pos ? ' P' + pos : '')); toast('✅ Put away to ' + rk.code + (pos ? ' P' + pos : '')); S.v = { rack: rk.code }; render(); wms(true); }
    catch (e) { if (!/Cancelled/.test(e.message)) { log('Put away ' + v.sku + ' — ' + e.message, 'bad'); toast('Not saved: ' + e.message, 'error'); } } }

  async function mSave() { const v = S.v, fr = srkFind(v.from), to = srkFind(v.to), p = fr ? palletsIn(fr.code)[v.pi] : null, pos = num(v.pos) || 0, d = new Date();
    if (!p) return toast('Choose the pallet to move.', 'warn'); if (!to) return toast('Choose the destination rack.', 'warn'); const cap = Math.round(num(to.cap)); if (cap > 0 && cap <= 60 && !pos) return toast('Tap the destination position.', 'warn');
    if (to.code === fr.code && pos === p.pos) return toast('That is the same position.', 'warn'); if (!p.row) return toast('The movement row of this pallet was not found — refresh and try again.', 'error');
    try { window.orbProg && orbProg.expect && orbProg.expect(3, 'Move ' + p.code + ' ' + fr.code + ' → ' + to.code);
      await upd('SKUs_Movements_Batch_tbl', p.row, { Storage_Location: to.code, PLT_Position: pos || undefined, User_Name: me(), Action_TimeStamp: TS.long(d) });
      const fp = fr.code + (p.pos ? ' P' + p.pos : ''), tp = to.code + (pos ? ' P' + pos : '');
      await add('Store_Inspections_RowDtls_tbl', { Title: to.code, Trans_Date: ymd(d), Header_Link: 0, WHs_Desc: to.whs || myWh(), Area_Desc: to.area, Location_Desc: to.loc, Inspection_Purpose: 'Put away', Rack_Code: to.code, Item_Code: p.code, Item_Desc: p.dtls, UOM_Desc: p.uom, Default_Capacity: num(to.cap), Actual_Utilization: 1, Remarks: 'MOVE in from ' + fp + '  ·  ' + p.qty + ' ' + (p.uom || '') + '  ·  batch ' + p.batch, User_Name: me(), Trns_TimeStamp: TS.dmy(d), Batch_Code: p.batch, Prod_Date: p.prod || undefined, Expiry_Date: p.exp || undefined, Pallet_Pos: pos ? 'P' + pos : '' });
      await add('Store_Inspections_RowDtls_tbl', { Title: fr.code, Trans_Date: ymd(d), Header_Link: 0, WHs_Desc: fr.whs || myWh(), Area_Desc: fr.area, Location_Desc: fr.loc, Inspection_Purpose: 'Put away', Rack_Code: fr.code, Item_Code: '', Item_Desc: '', UOM_Desc: p.uom, Default_Capacity: num(fr.cap), Actual_Utilization: -1, Remarks: 'MOVE out to ' + tp + '  ·  ' + p.code + '  ·  batch ' + p.batch + '  ·  ' + p.qty + ' ' + (p.uom || ''), User_Name: me(), Trns_TimeStamp: TS.dmy(d), Batch_Code: '', Pallet_Pos: p.pos ? 'P' + p.pos : '' });
      log('Move ' + p.code + ' ' + fp + ' → ' + tp); toast('✅ Moved to ' + tp); S.v = {}; render(); wms(true); }
    catch (e) { if (!/Cancelled/.test(e.message)) { log('Move ' + p.code + ' — ' + e.message, 'bad'); toast('Not saved: ' + e.message, 'error'); } } }

  /* ---------- events ---------- */
  function onClick(e) { const t = e.target.closest('button,[data-pal],[data-go],[data-soon],[data-sec]'); if (!t) return; const v = S.v;
    if (t.dataset.zoom) { setZoom(+t.dataset.zoom); return render(); } if (t.dataset.lay) { setLay(t.dataset.lay, true); return render(); } if (t.dataset.fav) { e.stopPropagation(); favToggle(t.dataset.fav); return render(); } if (t.dataset.sec != null) { S.sec = +t.dataset.sec; S.v = {}; S.stack.push({ p: S.page, sec: S.sec }); S.page = 'sec'; render(); Q('#mbBody').scrollTop = 0; return; }
    if (t.dataset.nav) return go(t.dataset.nav, 'tab'); if (t.dataset.go) return go(t.dataset.go); if (t.dataset.soon) return toast('This screen is still in the Power Apps app — it comes to ORBIT mobile in the next version.', 'info');
    if (t.dataset.set) { v[t.dataset.set] = t.dataset.val; return render(); }
    if (t.dataset.pick) { v.odo = t.dataset.pick; return render(); }
    if (t.dataset.pos) { v.pos = t.dataset.pos; return render(); }
    if (t.dataset.pal != null) { v.pi = +t.dataset.pal; v.to = v.to || ''; return render(); }
    if (t.dataset.step != null) { const it = v.items[+t.dataset.step]; it.qty = Math.max(0, num(it.qty) + num(t.dataset.d)); return render(); }
    const a = t.dataset.m; if (!a) return;
    if (a === 'back') { const b = S.stack.pop(); if (!b) return go('home'); S.sec = b.sec; return go(b.p, 'back'); } if (a === 'theme' || a === 'theme2') { setTheme(THEME === 'light' ? 'dark' : 'light'); return render(); } if (a === 'refresh') { Object.keys(M).forEach(k => { if (k === S.page) delete M[k]; }); if (['count', 'put', 'move'].includes(S.page)) return wms(true); return go(S.page); }
    if (a === 'renew') { if (window.srRenew) srRenew(); else toast('Open the desktop view to renew the session.', 'info'); return; }
    if (a === 'desktop') return setOn(false); if (a === 'logout') { document.body.classList.remove('mob-on'); const b = Q('#logoutBtn') || [...document.querySelectorAll('button')].find(x => /sign out|log ?out/i.test(x.title || x.textContent)); if (b) b.click(); return; }
    if (a === 'crop') return cropMode(); if (a === 'reread') return runOcr(); if (a === 'vSave') return vSave(); if (a === 'tSave') return tSave(); if (a === 'cSave') return cSave(); if (a === 'pSave') return pSave(); if (a === 'mSave') return mSave();
    if (a === 'cAdd') { const c = (Q('#cAdd') || {}).value || '', s = sku(c); if (!c.trim()) return; v.items = v.items || []; v.items.push({ code: s ? s.code : c.trim(), dtls: s ? s.dtls : '', uom: s ? s.uom : '', sys: 0, qty: 1 }); return render(); } }
  function onInput(e) { const t = e.target; if (t.id === 'mbQ') { S.q = t.value; const p = t.selectionStart; render(); const n = Q('#mbQ'); if (n) { n.focus(); n.setSelectionRange(p, p); } } else if (t.id === 'vOdo') S.v.odo = t.value; else if (t.id === 'tT' || t.id === 'tH') { S.v[t.id === 'tT' ? 't' : 'h'] = t.value; tWarn(); } else if (t.dataset.cnt != null) S.v.items[+t.dataset.cnt].qty = num(t.value); }
  function tWarn() { const D = M.temp || {}, cur = (D.stores || []).find(x => x.desc === S.v.store), lim = cur ? D.lim[cur.desc] || {} : {}, t = Q('#tT'), h = Q('#tH'); if (!t || !h) return;
    const aT = t.value !== '' && lim.maxT != null && num(t.value) > lim.maxT, aH = h.value !== '' && lim.maxH != null && num(h.value) / 100 > lim.maxH;
    [[t, aT], [h, aH]].forEach(([el, a]) => { el.style.borderColor = a ? '#dc2626' : ''; el.style.color = a ? '#b91c1c' : ''; });
    let w = Q('#tWarn'); if (aT || aH) { if (!w) { w = document.createElement('div'); w.id = 'tWarn'; w.className = 'mb-hint mb-bad'; w.style.margin = '-4px 0 10px'; t.closest('.mb-row').after(w); } w.textContent = '⚠ ' + (aT && aH ? 'Temperature and humidity are' : aT ? 'Temperature is' : 'Humidity is') + ' above the limit — an alarm email goes to your line manager when you save.'; } else if (w) w.remove(); }
  function onChange(e) { const t = e.target, v = S.v;
    if (t.id === 'vCam') return photoInto(t, 'photo', true); if (t.id === 'tCam') return photoInto(t, 'photo', false);
    if (t.id === 'vVeh') { v.veh = t.value; return render(); } if (t.id === 'tSt') { v.store = t.value; return render(); }
    if (t.id === 'cRack') { v.rack = t.value.trim().toUpperCase(); if (srkFind(v.rack)) countLoad(v.rack); return render(); }
    if (t.id === 'pRack') { v.rack = t.value.trim().toUpperCase(); v.pos = ''; return render(); } if (t.id === 'pSku') { v.sku = t.value.trim(); const s = sku(v.sku); if (s) v.sku = s.code; return render(); }
    if (t.id === 'pBatch') { v.batch = t.value.trim(); const s = sku(v.sku), b = s && s.batches.get(v.batch); if (b) { v.prod = v.prod || b.prod || ''; v.exp = v.exp || b.exp || ''; } return render(); }
    if (['pProd', 'pExp', 'pQty'].includes(t.id)) { v[{ pProd: 'prod', pExp: 'exp', pQty: 'qty' }[t.id]] = t.value; return; }
    if (t.id === 'mFrom') { v.from = t.value.trim().toUpperCase(); v.pi = null; return render(); } if (t.id === 'mTo') { v.to = t.value.trim().toUpperCase(); v.pos = ''; return render(); } }

  /* ---------- on / off ---------- */
  /* the web app (index.html) and the mobile app (mobile.html) are separate entry pages of the same package: index.html never opens the mobile app by itself */
  const MOBILE_PAGE = !!window.ORBIT_MOBILE;
  const goPage = f => { try { const u = new URL(f, location.href); location.href = u.href; } catch (e) { location.href = f; } };
  function setOn(on) { if (!on && MOBILE_PAGE) return goPage('index.html'); if (on && !MOBILE_PAGE) { const W = Math.min(440, screen.availWidth - 40), H = Math.min(900, screen.availHeight - 60), w = window.open(new URL('mobile.html', location.href).href, 'orbitMobile', `popup=yes,width=${W},height=${H},left=${Math.max(0, screen.availWidth - W - 30)},top=20,resizable=yes,scrollbars=yes`); if (!w) goPage('mobile.html'); return; }   /* 📱 Mobile opens the mobile app in a new tab */ shell(); document.body.classList.toggle('mob-on', !!on); if (on) go(S.page || 'home'); }
  function topBtn() { const acts = Q('.topbar-actions'); if (!acts || Q('#mobBtn')) return; const b = document.createElement('button'); b.type = 'button'; b.id = 'mobBtn'; b.className = 'icon-btn'; b.title = 'Open the ORBIT mobile app (mobile.html — phone layout)'; b.textContent = '📱 Mobile'; b.addEventListener('click', () => (typeof isAdmin === 'function' && isAdmin()) ? adminBox() : setOn(true)); acts.insertBefore(b, acts.firstChild); }
  if (!window.ORBIT_MOBILE) setTimeout(topBtn, 800);
  const prevLogin = window.onLoginComplete; if (typeof onLoginComplete === 'function') { const _o = onLoginComplete; onLoginComplete = function () { setTimeout(() => { if (MOBILE_PAGE) { setOn(true); cfgLoad(); } else topBtn(); }, 700); return _o.apply(this, arguments); }; }
  /* admin dialog in the web app: open the mobile app, or choose the layout every mobile user gets */
  async function adminBox() { const old = Q('#mbAdm'); if (old) old.remove(); const d = document.createElement('div'); d.id = 'mbAdm'; d.dataset.nohc = '1';
    d.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit';
    const cards = () => Object.entries(LAYS).map(([k, v]) => `<label style="display:flex;flex-direction:column;gap:6px;border:2px solid ${k === sel ? '#1d4ed8' : '#e2e8f0'};border-radius:14px;padding:10px;cursor:pointer;background:${k === sel ? '#eff6ff' : '#fff'}"><input type="radio" name="mbl" value="${k}" ${k === sel ? 'checked' : ''} style="display:none"><span style="display:block;height:54px;border-radius:10px;background:${v[3]};border:2px solid transparent"></span><b style="font-size:13.5px">${k} · ${v[0]}</b><small style="color:#64748b;font-size:11.5px">${v[1]}</small></label>`).join('');
    let sel = CFG.layout, uc = CFG.userChoice, row = null, c = null;
    const draw = () => { d.innerHTML = `<div style="background:#fff;border-radius:18px;width:min(560px,100%);max-height:90vh;overflow:auto;padding:20px;box-shadow:0 30px 60px -20px rgba(15,23,42,.5);color:#0f172a">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><b style="font-size:17px;flex:1">📱 ORBIT mobile app</b><button type="button" data-a="x" class="ghost small">✕</button></div>
      <div style="font-size:12.5px;color:#64748b;margin-bottom:12px">Layout of the mobile home page for <b>all users</b> (saved in ${esc(TP_LIST)}). Users open the app at <b>mobile.html</b>.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${cards()}</div>
      <label style="display:flex;gap:8px;align-items:center;margin:14px 0 4px;font-size:13px"><input type="checkbox" id="mbUc" ${uc ? 'checked' : ''} style="width:16px;height:16px;margin:0"> Let users choose their own layout in the app (Profile)</label>
      <div id="mbAdmMsg" style="font-size:12px;color:#64748b;min-height:16px;margin:6px 0"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" data-a="open" class="secondary">Open the mobile app</button><button type="button" data-a="save">💾 Save layout for everyone</button></div></div>`; };
    draw(); document.body.appendChild(d);
    d.addEventListener('click', async e => { if (e.target === d) return d.remove(); const r = e.target.closest('input[name=mbl]'); if (r) { sel = r.value; uc = Q('#mbUc').checked; return draw(); }
      const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a; if (a === 'x') return d.remove(); if (a === 'open') return setOn(true);
      if (a === 'save') { uc = Q('#mbUc').checked; const msg = Q('#mbAdmMsg'); msg.textContent = 'Saving…';
        try { c = c || await tpCtx(); if (!c) throw new Error('sign in first'); const its = await fetchAllItems(c.siteId, c.listId, c.token); row = its.find(x => String((x.fields || {}).Title || '').trim() === 'MOBILE:layout'); const val = JSON.stringify({ layout: sel, userChoice: uc, by: me(), at: new Date().toISOString() });
          if (row) await updateItem(c.siteId, c.listId, row.id, spCoerceFields(c.listId, { Config_Value: val }), c.token); else await createItem(c.siteId, c.listId, { Title: 'MOBILE:layout', Config_Value: val }, c.token);
          CFG = { layout: sel, userChoice: uc }; try { localStorage.setItem(PKEY + '_cfg', JSON.stringify(CFG)); } catch (x) {} msg.style.color = '#15803d'; msg.textContent = '✔ Saved — mobile users get layout ' + sel + ' · ' + LAYS[sel][0] + ' the next time they open the app.'; toast('📱 Mobile layout ' + sel + ' saved for everyone'); }
        catch (x) { if (/Cancelled|400/.test(x.message)) { msg.textContent = 'Not saved.'; return; } msg.style.color = '#b91c1c'; msg.textContent = '⚠ Not saved: ' + x.message; } } });
    d.addEventListener('change', e => { if (e.target.name === 'mbl') { sel = e.target.value; uc = Q('#mbUc').checked; draw(); } }); }
  window.orbMobile = { on: () => setOn(true), off: () => setOn(false), S, M, go, readOdo, prep, setLay, adminBox, cfg: () => CFG };
})();
