/* ============================================================
   COLUMN TOOLS — every list in the system: show / hide, re-arrange (drag the heading) and resize (drag the heading's right edge).
   Right-click a heading or use "▦ Columns" for the menu. Remembered in this browser per table (same key as Show / hide columns).
   ============================================================ */
(function () {
  const CT_KEY = LS_BASE + '_ct', SKIP = '#tblExpandOverlay,[data-nohc],[data-noct],.hc-pop,.ct-pop';
  let ct = {}; try { ct = JSON.parse(localStorage.getItem(CT_KEY) || '{}') || {}; } catch (e) {}
  const save = () => { try { localStorage.setItem(CT_KEY, JSON.stringify(ct)); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => { try { sectionToast(m, t); } catch (e) {} };
  const lab = c => String(c.dataset.hl || c.textContent).replace(/\s+/g, ' ').trim();
  const st = document.createElement('style');
  st.textContent = '.ct-rz{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:3;user-select:none}.ct-rz:hover,.ct-rz.on{background:rgba(59,130,246,.55)}'
    + 'table.ct-fixed{table-layout:fixed}table.ct-fixed.rn-on tr::before{width:42px;min-width:42px!important;max-width:42px}table.ct-fixed tbody td{overflow:hidden;text-overflow:ellipsis}table.ct-fixed th{white-space:normal!important;overflow-wrap:anywhere}'
    + 'table.ct-fixed td input,table.ct-fixed td select,table.ct-fixed td textarea,table.ct-fixed td .combo,table.ct-fixed td .mcombo{max-width:100%;min-width:0!important;box-sizing:border-box}'
    + 'body.ct-drag,body.ct-drag *{cursor:grabbing!important;user-select:none!important}body.ct-rsz,body.ct-rsz *{cursor:col-resize!important;user-select:none!important}'
    + '.ct-ind{position:fixed;width:3px;background:#2563eb;z-index:100020;pointer-events:none;border-radius:2px;box-shadow:0 0 0 2px rgba(37,99,235,.25)}'
    + '.ct-ghost{position:fixed;z-index:100021;pointer-events:none;background:var(--brand,#1e3a8a);color:#fff;font-size:12px;font-weight:600;padding:5px 10px;border-radius:8px;box-shadow:0 8px 22px rgba(0,0,0,.3);opacity:.92}'
    + 'th.ct-src{opacity:.45}.ct-pop .ct-it{display:flex;align-items:center;gap:6px;padding:3px 2px;border-radius:6px}.ct-pop .ct-it.ov{background:rgba(37,99,235,.12)}.ct-pop .ct-it .h{cursor:grab;color:var(--gray-500,#94a3b8);padding:0 2px}'
    + '.ct-pop .ct-it span.n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ct-pop .ct-it button{padding:0 6px!important;min-width:0;height:22px;line-height:20px;font-size:12px}.ct-pop .ct-it input[type=number]{width:58px!important;margin:0!important;padding:2px 4px!important;font-size:12px!important;height:24px}'
    + '.ct-pop .ct-it.dis .h,.ct-pop .ct-it.dis [data-mv]{visibility:hidden}';
  document.head.appendChild(st);

  /* ---------- table model ---------- */
  function head(t) { const hr = t.tHead && t.tHead.rows[0]; if (!hr) return null; const cs = [...hr.cells]; if (cs.length < 2 || cs.some(c => c.colSpan > 1)) return null; return hr; }
  const stamped = hr => hr.hasAttribute('data-cor');
  function origL(hr) { const cs = [...hr.cells], L = []; cs.forEach((c, j) => { L[stamped(hr) ? +c.dataset.co : j] = lab(c); }); return L; }
  function keyOf(t, hr) {
    if (!stamped(hr) && t.dataset.hcauto) { delete t.dataset.hc; delete t.dataset.hcauto; }
    if (t.dataset.hc) return t.dataset.hc;
    return ((t.closest('.view') || {}).id || '') + '|' + (t.id || '') + '|' + origL(hr).join('~').slice(0, 160);
  }
  const noReorder = t => !!(t.querySelector(':scope > colgroup') || t.id === 'roSmPlanTbl' || t.closest('#swStaff'));
  const movable = (L, i) => !!L[i] && L.indexOf(L[i]) === L.lastIndexOf(L[i]);
  function perm(L, P) {   // display position j shows original column res[j]
    const n = L.length, res = [...Array(n).keys()]; if (!P || !P.o || !P.o.length) return res;
    const slots = res.filter(i => movable(L, i)); let list = [...new Set(P.o.map(l => L.indexOf(l)).filter(i => i >= 0 && movable(L, i)))];
    slots.forEach(m => { if (!list.includes(m)) list.splice(Math.min(slots.indexOf(m), list.length), 0, m); });
    slots.forEach((s, k) => { res[s] = list[k]; }); return res;
  }
  const colId = (L, i) => movable(L, i) ? L[i] : '#' + i;

  function moveRow(r, res, sig) {
    const by = {}; for (const c of r.cells) by[c.dataset.co] = c; if (res.some(i => !by[i])) return;
    const a = document.activeElement, own = a && r.contains(a); let s0 = null, s1 = null; if (own) { try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) {} }
    res.forEach((i, j) => { if (r.cells[j] !== by[i]) r.insertBefore(by[i], r.cells[j] || null); });
    r.dataset.cor = sig;
    if (own && a.isConnected && document.activeElement !== a) { try { a.focus({ preventScroll: true }); if (s0 != null) a.setSelectionRange(s0, s1); } catch (e) {} }
  }

  function process(t) {
    if (!t || !t.isConnected || t.closest(SKIP)) return; const hr = head(t); if (!hr) return;
    const n = hr.cells.length, key = keyOf(t, hr), P = ct[key], L = origL(hr), res = noReorder(t) ? [...Array(n).keys()] : perm(L, P), ident = res.every((v, i) => v === i);
    // ---- order
    if (!ident || stamped(hr)) {
      const id0 = [...Array(n).keys()].join(','), sig = res.join(','), hrSeq = stamped(hr) ? [...hr.cells].map(c => c.dataset.co) : null;
      if (!stamped(hr)) { [...hr.cells].forEach((c, j) => { c.dataset.co = j; }); hr.dataset.cor = id0; if (!t.dataset.hc) { t.dataset.hc = key; t.dataset.hcauto = '1'; } }
      for (const r of t.rows) {
        if (r.cells.length !== n) continue; let bad = false; for (const c of r.cells) if (c.colSpan > 1) { bad = true; break; } if (bad) continue;
        if (!r.hasAttribute('data-cor')) {
          if (r.parentNode === t.tHead && r !== hr && hrSeq) { [...r.cells].forEach((c, j) => { c.dataset.co = hrSeq[j]; }); r.dataset.cor = hrSeq.join(','); }   // a row built from the current headings (filters)
          else { [...r.cells].forEach((c, j) => { c.dataset.co = j; }); r.dataset.cor = id0; }
        }
        if (r.dataset.cor !== sig) moveRow(r, res, sig);
      }
    }
    // ---- handles on the headings
    for (const c of hr.cells) {
      if (!c.querySelector(':scope > .ct-rz')) { if (getComputedStyle(c).position === 'static') c.style.position = 'relative'; const h = document.createElement('span'); h.className = 'ct-rz'; h.title = 'Drag to resize · double-click to reset the widths'; c.appendChild(h); }
    }
    // ---- widths
    const W = P && P.w && Object.keys(P.w).length ? P.w : null;
    if (W && !t.querySelector(':scope > colgroup')) {
      let sum = 0; [...hr.cells].forEach((c, j) => { const oi = stamped(hr) ? +c.dataset.co : j, w = Math.max(30, Math.round(W[colId(L, oi)] || 120)); const px = w + 'px'; if (c.style.width !== px) { c.style.width = px; c.style.minWidth = px; c.style.maxWidth = px; } if (c.style.display !== 'none') sum += w; });
      if (t.classList.contains('rn-on')) sum += 42; t.classList.add('ct-fixed'); t.style.width = sum + 'px'; t.style.minWidth = '0'; t.style.maxWidth = 'none';
    } else if (t.classList.contains('ct-fixed')) {
      t.classList.remove('ct-fixed'); ['width', 'minWidth', 'maxWidth'].forEach(p => { t.style[p] = ''; }); [...hr.cells].forEach(c => { c.style.width = c.style.minWidth = c.style.maxWidth = ''; });
    }
  }
  const all = () => document.querySelectorAll('table').forEach(process);
  window.ctProcess = process; window.ctAll = all;
  function refresh(t) { process(t); try { hcAll(); hcRefreshBtns(); } catch (e) {} ctBtns(); }

  /* ---------- watch the page ---------- */
  new MutationObserver(recs => {
    const S = new Set();
    for (const r of recs) {
      const tg = r.target.nodeType === 1 ? r.target : r.target.parentElement; if (tg) { const t = tg.closest('table'); if (t) S.add(t); }
      for (const a of r.addedNodes) if (a.nodeType === 1) { if (a.tagName === 'TABLE') S.add(a); else if (a.firstElementChild) a.querySelectorAll('table').forEach(x => S.add(x)); }
    }
    S.forEach(t => { try { process(t); } catch (e) {} }); if (S.size) { clearTimeout(window._ctEt); window._ctEt = setTimeout(ensureAll, 60); }
  }).observe(document.body, { childList: true, subtree: true });
  setTimeout(all, 1300);

  /* ---------- resize by dragging the heading edge ---------- */
  function freeze(t, hr, key) {
    const P = ct[key] = ct[key] || {}; if (P.w && Object.keys(P.w).length) return P; const L = origL(hr); P.w = {};
    [...hr.cells].forEach((c, j) => { const oi = stamped(hr) ? +c.dataset.co : j; P.w[colId(L, oi)] = Math.max(30, Math.round(c.getBoundingClientRect().width) || 120); }); return P;
  }
  document.addEventListener('mousedown', e => {
    const h = e.target.closest && e.target.closest('.ct-rz'); if (!h || e.button) return; const th = h.parentElement, t = th.closest('table'), hr = t && head(t); if (!hr || th.parentElement !== hr) return;
    e.preventDefault(); e.stopPropagation(); const key = keyOf(t, hr), P = freeze(t, hr, key); process(t);
    const L = origL(hr), oi = stamped(hr) ? +th.dataset.co : th.cellIndex, id = colId(L, oi), x0 = e.clientX, w0 = P.w[id] || th.getBoundingClientRect().width;
    h.classList.add('on'); document.body.classList.add('ct-rsz');
    const mv = ev => { P.w[id] = Math.max(30, Math.round(w0 + ev.clientX - x0)); process(t); }, up = () => { document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true); h.classList.remove('on'); document.body.classList.remove('ct-rsz'); save(); swallow(); };
    document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true);
  }, true);
  document.addEventListener('dblclick', e => { const h = e.target.closest && e.target.closest('.ct-rz'); if (!h) return; e.preventDefault(); e.stopPropagation(); const t = h.closest('table'), hr = head(t); if (!hr) return; const P = ct[keyOf(t, hr)]; if (P) { delete P.w; save(); } refresh(t); toast('Column widths reset for this list.', 'success'); }, true);
  const swallow = () => { const k = ev => { ev.stopPropagation(); ev.preventDefault(); }; document.addEventListener('click', k, true); setTimeout(() => document.removeEventListener('click', k, true), 0); };

  /* ---------- re-arrange by dragging a heading ---------- */
  document.addEventListener('mousedown', e => {
    if (e.button) return; const th = e.target.closest && e.target.closest('th'); if (!th || e.target.closest('.ct-rz,input,select,textarea,button,a,label,.combo,.mcombo,[contenteditable]')) return;
    const t = th.closest('table'), hr = t && head(t); if (!hr || th.parentElement !== hr || t.closest(SKIP) || noReorder(t)) return;
    const L0 = [...hr.cells].map(lab); if (!movable(L0, th.cellIndex)) return;
    const x0 = e.clientX, y0 = e.clientY; let on = false, ind = null, gh = null, drop = null;
    const targets = () => [...hr.cells].filter((c, j) => c.style.display !== 'none' && movable(L0, j));
    const mv = ev => {
      if (!on) { if (Math.abs(ev.clientX - x0) < 8 && Math.abs(ev.clientY - y0) < 8) return; on = true; document.body.classList.add('ct-drag'); th.classList.add('ct-src');
        ind = document.createElement('div'); ind.className = 'ct-ind'; gh = document.createElement('div'); gh.className = 'ct-ghost'; gh.textContent = '⇄ ' + L0[th.cellIndex]; document.body.append(ind, gh); }
      ev.preventDefault(); gh.style.left = (ev.clientX + 12) + 'px'; gh.style.top = (ev.clientY + 10) + 'px';
      const T = targets(), tb = t.getBoundingClientRect(); let best = null;
      T.forEach(c => { const b = c.getBoundingClientRect(); [[b.left, c, 'b'], [b.right, c, 'a']].forEach(([x, c2, w]) => { const d = Math.abs(ev.clientX - x); if (!best || d < best.d) best = { d, x, c: c2, w }; }); });
      drop = best; if (best) { const hb = hr.getBoundingClientRect(); ind.style.left = (best.x - 1) + 'px'; ind.style.top = Math.max(0, hb.top) + 'px'; ind.style.height = Math.max(24, Math.min(innerHeight, tb.bottom) - Math.max(0, hb.top)) + 'px'; }
    };
    const up = () => {
      document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true); if (!on) return;
      document.body.classList.remove('ct-drag'); th.classList.remove('ct-src'); ind && ind.remove(); gh && gh.remove(); swallow();
      if (!drop || drop.c === th) return; const cur = [...hr.cells].map(lab).filter((l, j, A) => movable(A, j)), me = L0[th.cellIndex];
      const tgt = lab(drop.c); const list = cur.filter(l => l !== me); let at = list.indexOf(tgt); if (at < 0) return; if (drop.w === 'a') at++; list.splice(at, 0, me);
      const key = keyOf(t, hr); ct[key] = ct[key] || {}; ct[key].o = list; save(); refresh(t);
    };
    document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true);
  });

  /* ---------- menu: show / hide · order · width ---------- */
  function menu(btn, t, o) {
    document.querySelectorAll('.hc-pop,.ct-pop').forEach(p => p.remove());
    if (!t || !t.isConnected) { toast('Nothing to arrange here yet.', 'warn'); return; }
    const hr = head(t); if (!hr) { toast('This list has no column headings to arrange.', 'warn'); return; }
    const key = (o && o.key) || keyOf(t, hr), inOv = !!t.closest('#tblExpandOverlay');
    const pop = document.createElement('div'); pop.className = 'hc-pop ct-pop'; const r = btn ? btn.getBoundingClientRect() : { left: innerWidth / 2 - 150, bottom: 120 };
    pop.style.cssText = 'position:fixed;z-index:100010;background:var(--card,#fff);color:inherit;border:1px solid var(--border);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.25);padding:10px;width:310px;max-height:76vh;display:flex;flex-direction:column;gap:7px;left:' + Math.max(8, Math.min(innerWidth - 322, r.left)) + 'px;top:' + Math.max(8, Math.min(innerHeight - 220, r.bottom + 4)) + 'px';
    pop.innerHTML = '<b>▦ Columns — show, order &amp; width</b><div style="display:flex;gap:5px;flex-wrap:wrap"><button type="button" class="ghost small" data-v="all">Show all</button><button type="button" class="ghost small" data-v="none">Hide all</button><button type="button" class="ghost small" data-v="ord">↺ Order</button><button type="button" class="ghost small" data-v="wid">↺ Widths</button></div>'
      + '<div data-l style="overflow:auto;max-height:52vh;display:flex;flex-direction:column;gap:1px"></div><span class="text-sm" style="color:var(--gray-600)">Tick to show · drag ⠿ or ↑ ↓ to re-arrange · px = width (blank = auto). On the list itself: drag a heading to move it, drag its right edge to resize, right-click a heading for this menu. Remembered in this browser.</span>';
    document.body.appendChild(pop);
    const names = () => { const L = [...hr.cells].map(lab); return [...new Set(L.filter(x => x))].map(n => ({ n, mv: !inOv && !noReorder(t) && movable(L, L.indexOf(n)) })); };
    const hid = () => new Set(hc.map[key] || []), P = () => (ct[key] = ct[key] || {});
    const draw = () => {
      const H = hid(), W = (ct[key] && ct[key].w) || {}, N = names();
      pop.querySelector('[data-l]').innerHTML = N.map((x, i) => `<div class="ct-it${x.mv ? '' : ' dis'}" draggable="${x.mv}" data-i="${i}"><span class="h">⠿</span><input type="checkbox" data-n="${esc(x.n)}" ${H.has(x.n) ? '' : 'checked'} style="width:auto;margin:0"><span class="n" title="${esc(x.n)}">${esc(x.n)}</span>`
        + `<input type="number" min="30" step="10" placeholder="px" data-w="${esc(x.n)}" value="${W[x.n] ? Math.round(W[x.n]) : ''}" ${inOv ? 'disabled' : ''}><button type="button" class="ghost small" data-mv="-1" title="Move left">↑</button><button type="button" class="ghost small" data-mv="1" title="Move right">↓</button></div>`).join('');
    };
    const after = () => { refresh(t); if (inOv) { const src = [...document.querySelectorAll('table')].find(x => !x.closest('#tblExpandOverlay') && x.dataset.hc === key); if (src) process(src); } if (o && o.after) o.after(); };
    const setHide = H => { if (H.size) hc.map[key] = [...H]; else delete hc.map[key]; hcSave(); after(); };
    const setOrder = list => { P().o = list; save(); after(); draw(); };
    pop.addEventListener('change', e => {
      const c = e.target.closest('input[data-n]'); if (c) { const H = hid(), N = names(); c.checked ? H.delete(c.dataset.n) : H.add(c.dataset.n); if (H.size >= N.length) { H.delete(c.dataset.n); c.checked = true; toast('Keep at least one column visible.', 'warn'); } setHide(H); return; }
      const w = e.target.closest('input[data-w]'); if (w) { const v = Math.round(+w.value); if (w.value !== '' && v >= 30) { freeze(t, hr, key); P().w[w.dataset.w] = v; } else if (ct[key] && ct[key].w) delete ct[key].w[w.dataset.w]; save(); after(); }
    });
    pop.addEventListener('click', e => {
      e.stopPropagation(); const b = e.target.closest('button'); if (!b) return; const N = names();
      if (b.dataset.v === 'all') { setHide(new Set()); draw(); }
      else if (b.dataset.v === 'none') { setHide(new Set(N.slice(1).map(x => x.n))); draw(); }
      else if (b.dataset.v === 'ord') { if (ct[key]) delete ct[key].o; save(); after(); draw(); }
      else if (b.dataset.v === 'wid') { if (ct[key]) delete ct[key].w; save(); after(); draw(); }
      else if (b.dataset.mv) { const it = b.closest('.ct-it'), i = +it.dataset.i, M = N.filter(x => x.mv).map(x => x.n), me = N[i].n, k = M.indexOf(me), j = k + (+b.dataset.mv); if (k < 0 || j < 0 || j >= M.length) return; M.splice(k, 1); M.splice(j, 0, me); setOrder(M); }
    });
    let dragI = null; const L = pop.querySelector('[data-l]');
    L.addEventListener('dragstart', e => { const it = e.target.closest('.ct-it'); if (!it || it.classList.contains('dis')) { e.preventDefault(); return; } dragI = +it.dataset.i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragI)); } catch (x) {} });
    L.addEventListener('dragover', e => { const it = e.target.closest('.ct-it'); if (dragI == null || !it || it.classList.contains('dis')) return; e.preventDefault(); L.querySelectorAll('.ov').forEach(x => x.classList.remove('ov')); it.classList.add('ov'); });
    L.addEventListener('drop', e => { e.preventDefault(); const it = e.target.closest('.ct-it'); L.querySelectorAll('.ov').forEach(x => x.classList.remove('ov')); if (dragI == null || !it) return; const N = names(), M = N.filter(x => x.mv).map(x => x.n), me = N[dragI].n, tg = N[+it.dataset.i].n; dragI = null; if (me === tg) return; M.splice(M.indexOf(me), 1); M.splice(M.indexOf(tg), 0, me); setOrder(M); });
    L.addEventListener('dragend', () => { dragI = null; L.querySelectorAll('.ov').forEach(x => x.classList.remove('ov')); });
    draw();
    setTimeout(() => { const off = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', off, true); } }; document.addEventListener('mousedown', off, true); }, 0);
  }
  window.ctMenu = menu;
  // the existing "▦ Columns" buttons (every list + the expanded window) now open the full menu
  try { hcMenu = function (btn, o) { const t = o ? o.t : (btn._t && btn._t.isConnected ? btn._t : (btn._host && btn._host.querySelector('table'))); menu(btn, t, o); }; } catch (e) {}
  // right-click a heading
  document.addEventListener('contextmenu', e => { const th = e.target.closest && e.target.closest('th'); if (!th || e.target.closest('input,select,textarea')) return; const t = th.closest('table'), hr = t && head(t); if (!hr || th.parentElement !== hr || t.closest('[data-nohc],[data-noct]')) return; e.preventDefault(); menu({ getBoundingClientRect: () => ({ left: e.clientX, bottom: e.clientY }) }, t, t.closest('#tblExpandOverlay') ? { key: t.dataset.hc } : null); });
  // fixed "▦ Columns" buttons placed in a screen: <button class="ct-open" data-ct-for="#hostSelector">
  function ctBtns() {
    document.querySelectorAll('.ct-own').forEach(b => { const t = b._t && b._t.isConnected ? b._t : (b._host && b._host.querySelector('table')), hr = t && head(t); if (!hr) return; const k = keyOf(t, hr), nh = (hc.map[k] || []).length, P = ct[k], tx = '▦ Columns' + (nh ? ' (' + nh + ' hidden)' : '') + (P && ((P.o && P.o.length) || (P.w && Object.keys(P.w).length)) ? ' ✎' : ''); if (b.textContent !== tx) b.textContent = tx; }); document.querySelectorAll('.ct-open[data-ct-for]').forEach(b => { const h = document.querySelector(b.dataset.ctFor), t = h && h.querySelector('table'), hr = t && head(t); if (!hr) { b.disabled = !t; return; } b.disabled = false; const k = keyOf(t, hr), nh = (hc.map[k] || []).length, P = ct[k]; b.textContent = '▦ Columns' + (nh ? ' (' + nh + ' hidden)' : '') + (P && ((P.o && P.o.length) || (P.w && Object.keys(P.w).length)) ? ' ✎' : ''); }); }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.ct-open[data-ct-for]'); if (!b) return; e.stopPropagation(); const h = document.querySelector(b.dataset.ctFor); menu(b, h && h.querySelector('table')); });
  /* every list gets a visible "▦ Columns" button: lists whose own button sits in a hidden header (or that never got one) get a small bar above them */
  const covered = t => [...document.querySelectorAll('.ct-open[data-ct-for]')].some(b => { const h = document.querySelector(b.dataset.ctFor); return h && h.contains(t); });
  function ensure(t) {
    if (!t || !t.isConnected || t.closest(SKIP) || t.closest('#tblExpandOverlay,[data-nohc]')) return; const hr = head(t); if (!hr || ![...hr.cells].some(c => lab(c))) return;
    const host = t.closest('.table-wrap') || t.parentElement; if (!host || !host.parentElement) return; const own = host._ctBtn && host._ctBtn.isConnected ? host._ctBtn : null;
    if (own) { own._t = t; return; } if (!t.offsetParent) return;
    const hb = host._hcBtn; if ((hb && hb.isConnected && hb.offsetParent) || covered(t)) return;
    const bar = document.createElement('div'); bar.className = 'ct-bar'; bar.style.cssText = 'display:flex;justify-content:flex-end;margin:2px 0 5px';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost small ct-own'; b.textContent = '▦ Columns'; b.title = 'Show / hide, re-arrange and resize the columns of this list'; b._t = t; b._host = host; host._ctBtn = b; bar.appendChild(b);
    host.parentElement.insertBefore(bar, host);
  }
  function ensureAll() {
    document.querySelectorAll('.ct-own').forEach(b => { const h = b._host; if (!h || !h.isConnected || (h._hcBtn && h._hcBtn.isConnected && h._hcBtn.offsetParent)) { if (h) h._ctBtn = null; b.parentElement && b.parentElement.classList.contains('ct-bar') ? b.parentElement.remove() : b.remove(); } });
    document.querySelectorAll('table').forEach(t => { try { ensure(t); } catch (e) {} }); ctBtns();
  }
  window.ctEnsure = ensure;
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.ct-own'); if (!b) return; e.stopPropagation(); menu(b, b._t && b._t.isConnected ? b._t : (b._host && b._host.querySelector('table'))); });
  setInterval(ensureAll, 1200); setTimeout(ensureAll, 1500);
  document.addEventListener('click', () => setTimeout(ensureAll, 250));
  /* report data (print / Excel / e-mail) from a table as it is shown: visible columns, current order, body + footer rows */
  window.tblReport = function (t, title, note, sheet) {
    if (!t || !t.tHead) return { title, sheet: sheet || title, note, headers: [], rows: [], totals: null };
    const vis = c => c.style.display !== 'none', txt = c => String(c.innerText || c.textContent || '').replace(/\s+/g, ' ').trim(), hr = t.tHead.rows[0], idx = [...hr.cells].map((c, i) => vis(c) && lab(c) ? i : -1).filter(i => i >= 0);
    const val = v => { const n = v.replace(/,/g, ''); return v !== '' && /^-?\d+(\.\d+)?%?$/.test(n) && !/%$/.test(n) && !/^0\d/.test(n) ? +n : v; };
    const rowOf = r => { if (r.cells.length === 1 && r.cells[0].colSpan > 1) return [txt(r.cells[0])]; if (r.cells.length !== hr.cells.length) { const out = []; let k = 0; [...r.cells].forEach(c => { for (let j = 0; j < (c.colSpan || 1); j++) { if (idx.includes(k)) out.push(j ? '' : val(txt(c))); k++; } }); return out; } return idx.map(i => val(txt(r.cells[i]))); };
    const rows = [...t.tBodies].flatMap(b => [...b.rows]).filter(r => r.style.display !== 'none').map(rowOf).filter(r => r.some(v => v !== '')), foot = t.tFoot ? [...t.tFoot.rows].map(rowOf) : [];
    return { title, sheet: (sheet || title).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31), note: note || ('Printed ' + new Date().toLocaleString()), headers: idx.map(i => lab(hr.cells[i])), rows: rows.concat(foot.slice(0, -1)), totals: foot.length ? foot[foot.length - 1] : null };
  };
  /* ---------- shared layout for the report pages (filters with labels · period group · tabs bar with Print / Excel / Email / Columns / Expand) ---------- */
  const rpCss = document.createElement('style'); rpCss.textContent = '.rp-f{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin:8px 0 6px}.rp-fi{display:flex;flex-direction:column;gap:3px}.rp-fi>span{font-size:11px;font-weight:600;color:var(--gray-600)}.rp-fi select,.rp-fi input{width:auto;min-width:120px;margin:0}'
    + '.rp-ck{display:flex;gap:6px;align-items:center;font-size:13px;padding-bottom:9px;white-space:nowrap}.rp-ck input{width:auto;margin:0}.rp-sp{flex:1}'
    + '.rp-grp{display:inline-flex;border:1px solid var(--brand,#1e3a8a);border-radius:8px;overflow:hidden;margin-bottom:2px}.rp-grp button{border:0!important;border-radius:0!important;border-left:1px solid var(--border)!important;margin:0!important}.rp-grp button:first-child{border-left:0!important}'
    + '.rp-tabbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 8px}.rp-tabbar .pl-tabs{margin:0!important}.rp-sep{width:1px;height:22px;background:var(--border);margin:0 2px}';
  document.head.appendChild(rpCss);
  window.rpUI = {
    fi: (label, html) => `<label class="rp-fi"><span>${label}</span>${html}</label>`,
    grp: btns => `<div class="rp-grp">${btns}</div>`,
    tabbar: (tabsHtml, attr, host, extra) => `<div class="rp-tabbar"><div class="pl-tabs">${tabsHtml}</div><span class="rp-sp"></span>${extra || ''}<button class="secondary small" type="button" ${attr}="print" title="Print the table shown">🖨 Print</button><button class="secondary small" type="button" ${attr}="excel" title="Excel file of the table shown">📊 Excel</button><button class="secondary small" type="button" ${attr}="mail" title="E-mail the table shown">✉ Email</button><span class="rp-sep"></span><button class="secondary small ct-open" type="button" data-ct-for="${host}" title="Show / hide, re-arrange and resize the columns">▦ Columns</button><button class="secondary small" type="button" ${attr}="expand" title="Open the table in the expanded window">⤢ Expand</button></div>`
  };
})();
