/* ============================================================
   MASTER DATA — add / edit the lists behind the app, in one pop-up window layout:
   Inventory items · Item UoM · Login users · Forklift units · RMPM items · RMPM UoM · Trucks · Trailers · Employees · Employee history
   • columns are read from the SharePoint list itself, so every field is shown (all visible by default)
   • show / hide fields is remembered per user (this browser) · required fields cannot be hidden
   • who may open it is decided by the administrator: Admin Console → Module access → "Master Data"
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = escapeHtml;
  const ENT = [
    { k: 'inv', t: 'Inventory items', ic: '📦', list: 'Inventory_Item_List', d: 'Item code, description, basic UoM, shelf life, category, status.' },
    { k: 'uom', t: 'Item UoM', ic: '⚖', list: 'UOM_tbl', d: 'UoM per item with the factor to base PC.' },
    { k: 'usr', t: 'Login users', ic: '🔑', list: 'LoginUserList', d: 'Users who sign in: name, role, locations, status.' },
    { k: 'fk', t: 'Forklift units', ic: '🏗', list: 'Forklift_Units_tbl', d: 'Unit no., type, warehouse, capacity, service dates.' },
    { k: 'rmi', t: 'RMPM items', ic: '🧪', list: 'RMPM_Items_tbl', d: 'Raw and packing material master.' },
    { k: 'rmu', t: 'RMPM UoM', ic: '⚖', list: 'UOM_tbl', d: 'Same list as Item UoM (UOM_tbl) — use the search box for the RMPM item codes.' },
    { k: 'trk', t: 'Trucks', ic: '🚚', list: 'Truck_List_tbl', d: 'Plate no., type, capacity, owner, status.' },
    { k: 'trl', t: 'Trailers', ic: '🚛', list: 'Trls_Units_tbl', d: 'Trailer units.' },
    { k: 'emp', t: 'Employees', ic: '👥', list: 'Employees_tbl', d: 'Staff master — with a History button for each employee.' },
    { k: 'eh', t: 'Employee history', ic: '🕘', list: 'Employees_RRF_History', d: 'Add or edit the history rows of employees (Employees_RRF_History).' }
  ];
  const SKIP = new Set(['ContentType', 'Attachments', 'Edit', 'DocIcon', 'LinkTitle', 'LinkTitleNoMenu', 'ItemChildCount', 'FolderChildCount', 'AppAuthor', 'AppEditor', '_UIVersionString', 'Created', 'Modified', 'Author', 'Editor', 'ID', 'Id']);
  const uname = () => String((currentUser && currentUser.username) || '').trim().toLowerCase();
  /* each window is its own section ("md-inv", "md-emp" …) so the administrator can give every window to different users */
  const canOpen = k => typeof acLevel === 'function' ? acLevel('md-' + k) !== 'none' : true;
  const canEdit = k => typeof acLevel === 'function' ? acLevel('md-' + k) === 'full' : true;
  const hk = e => LS_BASE + '_mdhide_' + uname() + '_' + e.k, lk = e => LS_BASE + '_mdlist_' + e.k, ordk = e => LS_BASE + '_mdord_' + uname() + '_' + e.k;
  /* the columns in the order this user arranged them (saved per user and per window); new columns stay at the end */
  const ordered = W => { const o = rd(ordk(W.e), []), ix = n => { const i = o.indexOf(n); return i < 0 ? 1e6 + W.cols.findIndex(c => c.name === n) : i; }; return W.cols.slice().sort((a, b) => ix(a.name) - ix(b.name)); };
  const rd = (k, d) => { try { const j = JSON.parse(localStorage.getItem(k) || 'null'); return j == null ? d : j; } catch (x) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) {} };
  const listOf = e => rd(lk(e), null) || e.list;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (c, v) => { if (v == null || v === '') return ''; if (c.type === 'date') { const d = new Date(v); return isNaN(d) ? String(v) : String(d.getUTCDate()).padStart(2, '0') + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); } if (c.type === 'bool') return v ? 'Yes' : 'No'; return String(v); };
  const cache = {}; let zc = 0;
  /* brand mark (current logo + ORBIT) for the window title bar */
  function brand() { let src = ''; try { const fv = document.querySelector('link[rel~="icon"]'), im = document.querySelector('.sidebar-brand .logo img'); src = (fv && fv.href) || (typeof NFPC_FAV !== 'undefined' ? NFPC_FAV : '') || (im && im.src) || ''; } catch (x) {}
    return `<span class="md-brand">${src ? `<span class="md-logo"><img src="${esc(src)}" alt=""></span>` : ''}<b>ORBIT</b></span>`; }
  /* place a window in the middle, resizable from the bottom-right corner, movable by its title bar */
  function win(ov, w, h) {
    const b = ov.querySelector('.md-box'), vw = innerWidth, vh = innerHeight, small = vw < 820; ov.style.display = 'block'; ov.style.padding = '0';
    const W = small ? vw : Math.min(w, vw - 24), H = small ? vh : Math.min(h, vh - 24); b.style.cssText += `;position:absolute;width:${W}px;height:${H}px;left:${Math.round((vw - W) / 2)}px;top:${Math.round((vh - H) / 2)}px;max-width:100vw;max-height:100vh;min-width:${small ? 0 : 520}px;min-height:${small ? 0 : 320}px;resize:${small ? 'none' : 'both'};overflow:hidden`;
    const hd = b.querySelector('.md-hd'); if (!hd || small) return;
    hd.addEventListener('pointerdown', e => { if (e.button || e.target.closest('button,input,select,.mdl-ctl') || b.classList.contains('mdl-full')) return; const r = b.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; hd.setPointerCapture(e.pointerId);
      const mv = ev => { b.style.left = Math.max(-r.width + 80, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px'; b.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px'; }, up = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); }; hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); });
  }

  async function schema(e, force) {
    const name = listOf(e), token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign in first (no token / Site URL)');
    const c = cache[name]; if (c && !force) return c;
    const ids = await resolveIds(site, name, token), r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${ids.siteId}/lists/${ids.listId}/columns`, { headers: { Authorization: `Bearer ${token}` } }, 'fetch columns');
    if (!r.ok) throw new Error('Column fetch failed (' + r.status + ')'); const d = await r.json(), T = {}, cols = [];
    d.value.forEach(x => { const t = spColType(x); T[t.name] = t;
      if (x.hidden || x.readOnly || SKIP.has(x.name) || x.calculated || x.lookup || x.personOrGroup || x.term || x.hyperlinkOrPicture || x.name.startsWith('_') || x.name.startsWith('OData')) return;
      cols.push({ name: x.name, label: x.displayName || x.name, type: t.type === 'multiline' ? 'long' : t.type === 'boolean' ? 'bool' : t.type, choices: t.choices || null, req: !!x.required, max: t.max || 0, uniq: !!x.enforceUniqueValues, dateOnly: t.dateOnly, def: x.defaultValue && x.defaultValue.value }); });
    (window.SP_COLT = window.SP_COLT || {})[ids.listId] = T; cols.forEach(c => { if (c.type === 'boolean') c.type = 'bool'; });
    cols.sort((a, b) => (b.name === 'Title') - (a.name === 'Title') || (b.req - a.req));
    return (cache[name] = { ids, cols, token });
  }
  const stCol = cols => cols.find(c => /^(status|active|is_?active|isactive)$/i.test(c.name));
  const isOff = (c, v) => c.type === 'bool' ? v === false : /inactive|disabled|closed|blocked|left|resigned|^no$|^false$/i.test(String(v == null ? '' : v));

  /* ---------- the pop-up window ---------- */
  function open(k, opt) {
    opt = opt || {}; const e = ENT.find(x => x.k === k); if (!e) return; if (!canOpen(k)) return sectionToast('“' + e.t + '” is not enabled for your user — ask the administrator (Admin Console → Module access).', 'warn');
    const W = { e, cols: [], items: [], q: opt.q || '', sort: null, show: 300, st: 'act', sel: null, prefill: opt.prefill || null, id: 'md' + (++zc) }, z = 2147482900 + zc * 4;
    const ov = document.createElement('div'); ov.className = 'md-ov'; ov.dataset.nohc = '1'; ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:18px'; ov.style.setProperty('z-index', z, 'important');
    ov.innerHTML = `<div class="md-box"><div class="md-hd">${brand()}<span class="md-sep"></span><b>${e.ic} ${esc(e.t)}</b><span class="md-sub" data-r="sub">${esc(listOf(e))}</span><i></i><button data-a="cfg" class="md-hb" title="Change the SharePoint list name">⚙ List</button><button data-a="max" class="md-hb">Max</button><button data-a="x" class="md-hb">Close</button></div>
      <div class="md-cfg" data-r="cfg" hidden>SharePoint list name <input data-r="lname" value="${esc(listOf(e))}"> <button data-a="lapply" class="md-b">Apply</button> <button data-a="lreset" class="md-b">Default</button></div>
      <div class="md-tb"><input data-r="q" class="md-in" style="width:260px" placeholder="Search any field" value="${esc(W.q)}"><select data-r="st" class="md-in" style="width:140px"><option value="act">Active only</option><option value="all">All</option><option value="off">Inactive only</option></select><i></i>
        <button data-a="reload" class="md-b">🔄 Reload</button><button data-a="xl" class="md-b">Export</button><button data-a="fields" class="md-b">Show / hide fields</button>${canEdit(k) ? '<button data-a="new" class="md-b md-p">+ New</button>' : ''}</div>
      <div class="md-msg" data-r="msg">Reading…</div><div class="md-tw" data-r="tw"></div></div>`;
    document.body.appendChild(ov); win(ov, 1100, 720); W.ov = ov; const R = n => ov.querySelector('[data-r="' + n + '"]');
    const say = (t, w) => { R('msg').textContent = t; R('msg').style.color = w ? '#b45309' : ''; };
    const hidden = () => new Set(rd(hk(e), []));
    const vis = () => { const h = hidden(); return ordered(W).filter(c => c.req || !h.has(c.name)); };
    W.vis = vis; W.say = say;
    async function load(force) {
      say('Reading ' + listOf(e) + '…'); try { const S = await schema(e, force); W.S = S; W.cols = S.cols; const it = await fetchAllItems(S.ids.siteId, S.ids.listId, S.token, n => say('Reading ' + listOf(e) + '… ' + n)); W.items = it.map(x => ({ id: x.id, f: x.fields || {} })); draw(); }
      catch (x) { say('⚠ ' + x.message + ' — check the list name with ⚙ List.', 1); R('tw').innerHTML = ''; }
    }
    function rows() { const q = W.q.toLowerCase(), sc = stCol(W.cols); let L = W.items.filter(r => { if (sc && W.st !== 'all') { const off = isOff(sc, r.f[sc.name]); if ((W.st === 'act') === off) return false; } return !q || W.cols.some(c => String(r.f[c.name] == null ? '' : r.f[c.name]).toLowerCase().includes(q)); });
      if (W.sort) { const s = W.sort, cc = W.cols.find(c => c.name === s.n); L = L.slice().sort((a, b) => { const x = a.f[s.n], y = b.f[s.n]; const r = cc && cc.type === 'number' ? (+x || 0) - (+y || 0) : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), undefined, { numeric: true }); return s.d * r; }); } return L; }
    function draw() { const V = vis(), L = rows(), sc = stCol(W.cols); R('st').style.display = sc ? '' : 'none'; W.L = L;
      R('msg').textContent = L.length + ' of ' + W.items.length + ' record(s) · ' + V.length + ' of ' + W.cols.length + ' field(s) shown' + (canEdit(W.e.k) ? ' · click a row to edit' : ' · view only'); R('msg').style.color = '';
      R('tw').innerHTML = `<table class="md-t"><thead><tr>${V.map(c => `<th data-s="${esc(c.name)}">${esc(c.label)}${W.sort && W.sort.n === c.name ? (W.sort.d > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead><tbody>${L.slice(0, W.show).map(r => `<tr data-id="${r.id}">${V.map(c => `<td${c.type === 'number' ? ' class="n"' : ''}>${esc(fmt(c, r.f[c.name]))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${V.length || 1}" class="md-e">Nothing found.</td></tr>`}</tbody></table>${L.length > W.show ? `<div style="padding:8px;text-align:center"><button class="md-b" data-a="more">Show more (${L.length - W.show} left)</button></div>` : ''}`; }
    W.draw = draw; W.load = load;
    ov.addEventListener('click', ev => { const a = ev.target.closest('[data-a]'), th = ev.target.closest('th[data-s]'), tr = ev.target.closest('tr[data-id]');
      if (th) { const n = th.dataset.s; W.sort = W.sort && W.sort.n === n ? { n, d: -W.sort.d } : { n, d: 1 }; return draw(); }
      if (tr && !a) { editor(W, W.items.find(r => String(r.id) === tr.dataset.id)); return; }
      if (!a) return; const t = a.dataset.a;
      if (t === 'x') { ov.remove(); } else if (t === 'max') { const b = ov.querySelector('.md-box'); b.classList.toggle('mx'); a.textContent = b.classList.contains('mx') ? 'Restore' : 'Max'; }
      else if (t === 'cfg') { R('cfg').hidden = !R('cfg').hidden; } else if (t === 'lapply') { const v = R('lname').value.trim(); if (v) { wr(lk(e), v); R('sub').textContent = v; load(true); } } else if (t === 'lreset') { try { localStorage.removeItem(lk(e)); } catch (x) {} R('lname').value = e.list; R('sub').textContent = e.list; load(true); }
      else if (t === 'reload') load(true); else if (t === 'more') { W.show += 300; draw(); } else if (t === 'new') editor(W, null);
      else if (t === 'fields') fieldsPanel(W); else if (t === 'xl') { const V = vis(), L = rows(); a2Export({ title: e.t, sheet: e.t, headers: V.map(c => c.label), rows: L.map(r => V.map(c => fmt(c, r.f[c.name]))) }); } });
    ov.addEventListener('dblclick', () => {});
    R('q').addEventListener('input', ev => { W.q = ev.target.value.trim(); clearTimeout(W.tm); W.tm = setTimeout(() => { W.show = 300; if (W.cols.length) draw(); }, 250); });
    R('st').addEventListener('change', ev => { W.st = ev.target.value; W.show = 300; draw(); });
    load(false);
  }

  /* ---------- show / hide fields (remembered per user) ---------- */
  function fieldsPanel(W, after) {
    const e = W.e, h = new Set(rd(hk(e), [])), p = document.createElement('div'); p.className = 'md-ov'; p.dataset.nohc = '1'; p.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center'; p.style.setProperty('z-index', 2147483300, 'important');
    p.innerHTML = `<div class="md-box"><div class="md-hd">${brand()}<span class="md-sep"></span><b>Show, hide and arrange fields</b><i></i><button class="md-hb" data-a="x">Done</button></div><div style="padding:12px 16px;overflow:auto"><div class="md-sub" style="color:#64748b;margin-bottom:8px">Saved for you (${esc(uname() || 'this user')}) on this browser. Tick to show, use ▲ ▼ to change the order. Required fields cannot be hidden.</div>
      ${ordered(W).map(c => `<label class="md-ck" data-nm="${esc(c.name)}"><input type="checkbox" data-n="${esc(c.name)}"${c.req ? ' disabled checked' : !h.has(c.name) ? ' checked' : ''}> <span style="flex:1">${esc(c.label)}${c.req ? ' <small>required</small>' : ''}</span><span class="md-mv"><button type="button" data-mv="-1" title="Move up">▲</button><button type="button" data-mv="1" title="Move down">▼</button></span></label>`).join('')}<div style="margin-top:10px;display:flex;gap:8px"><button class="md-b" data-a="all">Show all</button><button class="md-b" data-a="rord">Reset order</button></div></div></div>`;
    document.body.appendChild(p); win(p, 440, 560); const save = () => { const hid = [...p.querySelectorAll('input[data-n]')].filter(i => !i.checked && !i.disabled).map(i => i.dataset.n); wr(hk(e), hid); W.draw(); if (after) after(); };
    const saveOrd = () => { wr(ordk(e), [...p.querySelectorAll('label[data-nm]')].map(l => l.dataset.nm)); W.draw(); if (after) after(); };
    p.addEventListener('change', save);
    p.addEventListener('click', ev => { const mv = ev.target.closest('[data-mv]'); if (mv) { const l = mv.closest('label'), up = mv.dataset.mv === '-1', o = up ? l.previousElementSibling : l.nextElementSibling; if (o && o.matches('label[data-nm]')) { if (up) l.parentNode.insertBefore(l, o); else l.parentNode.insertBefore(o, l); saveOrd(); } return; }
      const a = ev.target.closest('[data-a]'); if (!a) return; if (a.dataset.a === 'x') p.remove(); else if (a.dataset.a === 'rord') { try { localStorage.removeItem(ordk(e)); } catch (x) {} p.remove(); W.draw(); if (after) after(); } else { p.querySelectorAll('input[data-n]').forEach(i => { i.checked = true; }); save(); } });
  }

  /* ---------- add / edit dialog ---------- */
  function editor(W, rec, pre) {
    const e = W.e, isNew = !rec, ro = !canEdit(W.e.k), V = W.vis(), sc = stCol(W.cols), f = rec ? rec.f : Object.assign({}, W.prefill || {}, pre || {}), z = 2147483000 + zc * 4;
    const d = document.createElement('div'); d.className = 'md-ov'; d.dataset.nohc = '1'; d.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:18px'; d.style.setProperty('z-index', z, 'important');
    const val = (c, v) => c.type === 'date' ? (v ? String(v).slice(0, 10) : '') : v == null ? '' : v;
    /* every text / number field offers the values already used in the same column (most used first) — pick one or type a new value */
    const hist = c => { if (ro || c.uniq || ['choice', 'bool', 'long', 'date'].includes(c.type)) return []; const m = new Map(); W.items.forEach(r => { const x = r.f[c.name]; if (x == null || x === '' || typeof x === 'object') return; const t = String(x); m.set(t, (m.get(t) || 0) + 1); });
      return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { numeric: true })).slice(0, 400).map(x => x[0]); };
    const inp = c => { const v = val(c, f[c.name]), n = esc(c.name), dis = ro ? ' disabled' : '', H = hist(c), lid = 'mdl' + zc + '_' + c.name.replace(/\W/g, '_');
      if (c.type === 'choice') return `<select data-f="${n}"${dis}><option value=""></option>${(c.choices || []).concat(v && !(c.choices || []).includes(v) ? [v] : []).map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      if (c.type === 'bool') return `<select data-f="${n}"${dis}><option value=""></option><option value="1"${v === true ? ' selected' : ''}>Yes</option><option value="0"${v === false ? ' selected' : ''}>No</option></select>`;
      if (c.type === 'long') return `<textarea data-f="${n}" rows="3"${dis}>${esc(v)}</textarea>`;
      return `<input data-f="${n}" type="${c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}"${c.type === 'number' ? ' step="any"' : ''}${c.max ? ' maxlength="' + c.max + '"' : ''}${H.length ? ' list="' + lid + '" autocomplete="off"' : ''} value="${esc(v)}"${dis}>${H.length ? '<datalist id="' + lid + '">' + H.map(o => '<option value="' + esc(o) + '"></option>').join('') + '</datalist>' : ''}`; };
    const sec = (t, L) => L.length ? `<div class="md-sec"><div class="md-sh"><span>${t}</span><span>${L.length} field(s)</span></div><div class="md-sb">${L.map(c => `<div data-fn="${esc(c.name)}"${c.type === 'long' ? ' style="grid-column:1/-1"' : ''}><label>${esc(c.label)}${c.req ? ' <b style="color:#b91c1c">*</b>' : ''}</label>${inp(c)}</div>`).join('')}</div></div>` : '';
    const main = V.filter(c => c.type !== 'long'), notes = V.filter(c => c.type === 'long'), key = rec ? (rec.f.Title || '') : '';
    const empKey = () => { const c = W.cols.find(c => /file|(emp|staff).*(no|nr|id|num|code)|(_|\\s)(no|nr)$/i.test(c.name + ' ' + c.label) && c.name !== 'Title'); return String(rec && (c ? rec.f[c.name] : '') || rec && rec.f.Title || '').trim(); };
    d.innerHTML = `<div class="md-box"><div class="md-hd">${brand()}<span class="md-sep"></span><b>${isNew ? 'New' : ro ? 'View' : 'Edit'} · ${esc(e.t)}${key ? ' · ' + esc(key) : ''}</b><span class="md-sub">${esc(listOf(e))}${rec ? ' · ID ' + rec.id : ''}</span><i></i><button class="md-hb" data-a="x">Close</button></div>
      <div style="display:flex;flex:1;min-height:0"><div style="flex:1;padding:14px 18px;overflow:auto">${sec('Details', main)}${sec('Notes', notes)}${V.length < W.cols.length ? `<div class="md-sec"><div class="md-sh"><span>Hidden fields</span><span>${W.cols.length - V.length} hidden</span></div></div>` : ''}<div class="md-err" data-r="err"></div></div>
      <div class="md-side"><b>Show or hide fields</b><div class="md-sub" style="margin:4px 0 8px;color:#64748b">Remembered per user. Required fields stay on.</div><button class="md-b" data-a="fields">Choose fields…</button><button class="md-b" data-a="arr" style="margin-top:8px">↕ Arrange fields</button><div class="md-sub" style="margin-top:6px;color:#64748b;font-size:11.5px">Press “Arrange fields”, then drag a field onto the place you want. Saved for you.</div>
      <div style="margin-top:16px;font-weight:700">Quick actions</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${rec && !ro ? '<button class="md-b" data-a="copy">Copy as new</button>' : ''}${e.k === 'emp' && rec ? '<button class="md-b" data-a="hist">🕘 History (Employees_RRF_History)</button>' : ''}${rec && !ro && sc ? '<button class="md-b" data-a="off" style="color:#b91c1c;border-color:#f0b4b4">Deactivate</button>' : ''}</div></div></div>
      <div class="md-ft">${ro ? '' : '<button class="md-b md-ok" data-a="save">Save</button><button class="md-b md-p" data-a="savenew">Save and add another</button>'}<button class="md-b" data-a="x">Cancel</button><i></i><span class="md-sub" data-r="s"></span></div></div>`;
    document.body.appendChild(d); win(d, 980, 708); const R = n => d.querySelector('[data-r="' + n + '"]');
    /* arrange mode: drag a field onto another one to move it there (the order is saved per user and also orders the table columns) */
    const setArr = on => { d.classList.toggle('md-arr', on); d.querySelectorAll('.md-sb > div[data-fn]').forEach(x => { x.draggable = on; }); const b = d.querySelector('[data-a="arr"]'); if (b) b.textContent = on ? '✔ Done arranging' : '↕ Arrange fields'; };
    let drag = null; if (W.arrNext) { W.arrNext = false; setArr(true); }
    d.addEventListener('dragstart', ev => { const x = ev.target.closest && ev.target.closest('div[data-fn]'); if (!x) return; drag = x.dataset.fn; try { ev.dataTransfer.setData('text/plain', drag); ev.dataTransfer.effectAllowed = 'move'; } catch (q) {} });
    d.addEventListener('dragover', ev => { const x = ev.target.closest && ev.target.closest('div[data-fn]'); if (!x || !drag) return; ev.preventDefault(); d.querySelectorAll('.md-over').forEach(y => y.classList.remove('md-over')); x.classList.add('md-over'); });
    d.addEventListener('drop', ev => { const x = ev.target.closest && ev.target.closest('div[data-fn]'); if (!x || !drag) return; ev.preventDefault(); const to = x.dataset.fn, from = drag; drag = null; if (to === from) return;
      const names = ordered(W).map(c => c.name), i = names.indexOf(from), ti = names.indexOf(to); names.splice(i, 1); names.splice(names.indexOf(to) + (i < ti ? 1 : 0), 0, from); wr(ordk(e), names); W.draw();
      const cur = collect(); d.remove(); W.arrNext = true; editor(W, rec ? Object.assign(rec, { f: Object.assign(rec.f, cur) }) : null, rec ? null : cur); });
    const collect = () => { const o = {}; d.querySelectorAll('[data-f]').forEach(el => { const c = W.cols.find(x => x.name === el.dataset.f); let v = el.value; if (c.type === 'bool') v = v === '' ? null : v === '1'; else if (c.type === 'number') v = v === '' ? null : Number(v); else if (c.type === 'date') v = v === '' ? null : v; o[c.name] = v; }); return o; };
    async function persist(next) { const o = collect(), miss = V.filter(c => c.req && (o[c.name] == null || o[c.name] === '')).map(c => c.label); if (miss.length) { R('err').textContent = 'Required: ' + miss.join(', '); return; }
      const uc = W.cols.find(c => c.uniq || c.name === 'Title' || c.req); if (isNew && uc && o[uc.name] && !d._dup && W.items.some(r => String(r.f[uc.name] || '').trim().toLowerCase() === String(o[uc.name]).trim().toLowerCase())) { d._dup = 1; R('err').textContent = 'Another record already has ' + uc.label + ' “' + o[uc.name] + '”. Press Save again to add it anyway.'; return; }
      R('err').textContent = ''; R('s').textContent = 'Saving…'; const S = W.S, fields = {}; Object.keys(o).forEach(n => { if (o[n] !== null || !isNew) fields[n] = o[n]; });
      try { if (isNew) { await createItem(S.ids.siteId, S.ids.listId, spCoerceFields(S.ids.listId, fields), S.token); sectionToast('✔ Added to ' + listOf(e), 'success'); await W.load(true); }
        else { await updateItem(S.ids.siteId, S.ids.listId, rec.id, spCoerceFields(S.ids.listId, fields), S.token); Object.assign(rec.f, o); W.draw(); sectionToast('✔ Saved to ' + listOf(e), 'success'); }
        d.remove(); if (next) editor(W, null); } catch (x) { R('s').textContent = ''; R('err').textContent = '⚠ ' + x.message; } }
    d.addEventListener('click', ev => { const a = ev.target.closest('[data-a]'); if (!a) return; const t = a.dataset.a;
      if (t === 'x') d.remove(); else if (t === 'save') persist(false); else if (t === 'savenew') persist(true);
      else if (t === 'fields') fieldsPanel(W, () => { const cur = collect(); d.remove(); editor(W, rec ? Object.assign(rec, { f: Object.assign(rec.f, cur) }) : null, rec ? null : cur); });
      else if (t === 'arr') setArr(!d.classList.contains('md-arr'));
      else if (t === 'copy') { const o = collect(); d.remove(); const keep = {}; Object.keys(o).forEach(n => { const c = W.cols.find(x => x.name === n); if (c && !c.uniq && n !== 'Title') keep[n] = o[n]; }); editor(W, null, keep); }
      else if (t === 'hist') { const k = empKey(), pf = {}; const H = ENT.find(x => x.k === 'eh'); Object.keys(f).forEach(n => { if (n !== 'Title' || true) pf[n] = f[n]; }); open('eh', { q: k, prefill: pf }); }
      else if (t === 'off') { const S = W.S, v = sc.type === 'bool' ? false : ((sc.choices || []).find(o => /inactive|disabled|closed|blocked/i.test(o)) || 'Inactive'); R('s').textContent = 'Saving…';
        updateItem(S.ids.siteId, S.ids.listId, rec.id, spCoerceFields(S.ids.listId, { [sc.name]: v }), S.token).then(() => { rec.f[sc.name] = v; W.draw(); sectionToast('✔ Deactivated', 'success'); d.remove(); }).catch(x => { R('s').textContent = ''; R('err').textContent = '⚠ ' + x.message; }); } });
  }

  /* ---------- one small launcher page per window + styles ---------- */
  function page(e) { const v = Q('#view-md-' + e.k); if (!v) return; if (!canOpen(e.k)) { v.innerHTML = '<div class="card"><div class="card-desc">“' + esc(e.t) + '” is not enabled for your user. Ask the administrator (Admin Console → Module access).</div></div>'; return; }
    v.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">${e.ic} ${esc(e.t)} <span class="text-sm" style="font-weight:400">— ${esc(listOf(e))} · ${canEdit(e.k) ? 'edit access' : 'view only'}</span></div></div><div class="card-desc">${esc(e.d)}</div><div class="btn-row" style="margin-top:10px"><button class="md-b md-p" data-md="${e.k}">Open ${esc(e.t)}</button></div>
      <div class="card-desc" style="margin-top:10px">Search, sort, add, edit, copy as new, deactivate (instead of delete), export, show or hide fields (remembered per user), required-field and duplicate checks. If the list has a different name in your SharePoint, change it with “⚙ List” inside the window.</div></div>`; }
  function init() {
    const css = document.createElement('style'); css.textContent = `.md-box{background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(10,20,50,.45);display:flex;flex-direction:column;overflow:hidden;width:1100px;max-width:100%;height:min(720px,94vh);font-size:13px;color:#1b2533}.md-box.mx{width:100%;height:100%}
.md-brand{display:inline-flex;align-items:center;gap:8px;font-size:15px;letter-spacing:.06em}.md-logo{background:#fff;border-radius:50%;width:36px;height:36px;padding:3px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex:none;box-shadow:0 0 0 2px rgba(255,255,255,.35)}.md-logo img{width:100%;height:100%;border-radius:50%;object-fit:contain}.md-sep{width:1px;height:22px;background:rgba(255,255,255,.4)}.md-box .mdl-ctl button,.md-box .mdl-ctl.mdl-lt button{color:#fff!important}.md-box .mdl-ctl button:hover{background:rgba(255,255,255,.22)!important}.md-box.mdl-full{left:0!important;top:0!important;resize:none!important}.md-box.mx{left:0!important;top:0!important;resize:none!important}.md-box::-webkit-resizer{background:linear-gradient(135deg,transparent 50%,#94a3b8 50%)}
.md-hd{display:flex;cursor:move;user-select:none;align-items:center;gap:10px;padding:12px 18px;background:#1f4ea8;color:#fff}.md-hd i,.md-tb i,.md-ft i{flex:1}.md-hd .md-sub{opacity:.85;font-size:12px}.md-hb{height:30px;padding:0 12px;border-radius:8px;border:1px solid #9db8ea;background:transparent;color:#fff;font-weight:600;cursor:pointer}
.md-tb{display:flex;gap:8px;align-items:center;padding:10px 18px;border-bottom:1px solid #e5eaf3;flex-wrap:wrap}.md-cfg{padding:8px 18px;background:#fef9e7;border-bottom:1px solid #e5eaf3}.md-cfg input{width:260px;height:30px;border:1px solid #c5cfe0;border-radius:8px;padding:0 8px}
.md-in{height:34px;border:1px solid #c5cfe0;border-radius:8px;padding:0 10px;background:#fff;margin:0}.md-b{height:34px;padding:0 14px;border-radius:8px;border:1px solid #c5cfe0;background:#fff;color:#1f3b73;font-weight:600;cursor:pointer;width:auto;margin:0}.md-p{background:#1f4ea8;border-color:#1f4ea8;color:#fff}.md-ok{background:#15803d;border-color:#15803d;color:#fff}
.md-msg{padding:6px 18px;color:#64748b;font-size:12px}.md-tw{flex:1;overflow:auto;border-top:1px solid #e5eaf3}.md-t{border-collapse:collapse;width:100%;font-size:12.5px}.md-t th{position:sticky;top:0;background:#eef2fa;padding:8px 10px;text-align:left;white-space:nowrap;cursor:pointer;z-index:1}.md-t td{padding:7px 10px;border-top:1px solid #e5eaf3;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis}.md-t td.n{text-align:right}.md-t tbody tr{cursor:pointer}.md-t tbody tr:hover{background:#e8effc}.md-e{text-align:center;color:#64748b;padding:24px!important}
.md-sec{border:1px solid #dbe3f1;border-radius:12px;margin-bottom:12px;overflow:hidden}.md-sh{padding:9px 14px;background:#eef2fa;font-weight:700;color:#1f3b73;display:flex;justify-content:space-between}.md-sb{padding:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 14px}.md-sb label{display:block;font-size:11.5px;font-weight:600;color:#475569;margin-bottom:4px}.md-sb input,.md-sb select,.md-sb textarea{width:100%;margin:0;border:1px solid #c5cfe0;border-radius:8px;padding:7px 10px;font:inherit;background:#fff;box-sizing:border-box}.md-sb input,.md-sb select{height:34px;padding:0 10px}
.md-side{width:240px;border-left:1px solid #e5eaf3;background:#f6f8fc;padding:16px 14px;overflow:auto}.md-ft{display:flex;gap:10px;align-items:center;padding:12px 18px;border-top:1px solid #e5eaf3;background:#f6f8fc}.md-err{color:#b91c1c;font-weight:600;padding:4px 2px}.md-ck{display:flex;gap:8px;align-items:center;padding:5px 0}.md-ck input{width:auto;margin:0}.md-ck small{color:#64748b}
.md-hub{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-top:10px}.md-card{border:1px solid #d5deee;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:6px;background:#fff}.md-ct{font-weight:700;color:#1f3b73;font-size:15px}.md-cs{font-size:12px;color:#64748b}.md-cd{color:#334155;line-height:1.4;flex:1;min-height:38px}.md-card .md-b{align-self:flex-start;margin-top:6px}
.md-sb input[list]{padding-right:26px;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%2364748b' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 9px center}.md-sb input[list]::-webkit-calendar-picker-indicator{opacity:0;width:26px;margin:0;cursor:pointer}.md-sb>div{position:relative}
.md-mv{display:inline-flex;gap:4px}.md-mv button{width:28px;height:24px;padding:0;margin:0;border:1px solid #c5cfe0;border-radius:6px;background:#fff;color:#1f3b73;cursor:pointer;font-size:11px}
.md-arr .md-sb>div[data-fn]{cursor:grab;outline:1px dashed #94a3b8;outline-offset:2px;border-radius:8px;background:#f8fafc}.md-arr .md-sb input,.md-arr .md-sb select,.md-arr .md-sb textarea{pointer-events:none}.md-arr .md-over{outline:2px solid #1f4ea8;background:#e8effc}
@media(max-width:820px){.md-sb{grid-template-columns:1fr 1fr}.md-side{display:none}}`; document.head.appendChild(css);
    document.addEventListener('click', ev => { const b = ev.target.closest('[data-md]'); if (b && b.closest('[id^="view-md-"]')) open(b.dataset.md); });
  }
  let ready = false; ENT.forEach(e => { try { VIEW_META['md-' + e.k] = { title: e.t, sub: e.d }; } catch (x) {} const n = Q('.nav-item[data-view="md-' + e.k + '"]'); if (n) n.addEventListener('click', () => { if (!ready) { ready = true; init(); } page(e); setTimeout(() => open(e.k), 80); }); });
  window.MD = { open, ENT };
})();
