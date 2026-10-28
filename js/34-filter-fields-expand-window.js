/* ============================================================
   FILTER FIELDS — add / remove the filter dropdowns of any filter bar (⚙ Filter fields), remembered in this browser
   ============================================================ */
(function () { const st = document.createElement('style'); st.textContent = '.ro-cf label{font-size:14px!important;font-weight:600}.ro-cf .mc-input,.ro-cf select,.ro-cf input[type=text],.ro-cf input[type=date]{font-size:14.5px}.lp-tbl thead th{font-size:14px;vertical-align:bottom}.lp-tbl thead th input{padding:5px 8px!important;height:auto!important}.te-filters .mc-input{font-size:13px}.ff-btn{align-self:flex-end;margin-bottom:2px}'; document.head.appendChild(st); })();
const FF_KEY = LS_BASE + '_ff', ff = { map: {} };
try { ff.map = JSON.parse(localStorage.getItem(FF_KEY) || '{}') || {}; } catch (e) {}
const ffSave = () => { try { localStorage.setItem(FF_KEY, JSON.stringify(ff.map)); } catch (e) {} };
const ffHidden = (key, def) => Object.prototype.hasOwnProperty.call(ff.map, key) ? ff.map[key] : (def || []);
const ffLabel = c => { const l = c.querySelector(':scope > label'); return l ? l.textContent.replace(/\s+/g, ' ').trim() : ''; };
function ffGroups() { const m = new Map(); document.querySelectorAll('.ro-cf').forEach(c => { const p = c.parentElement; if (!p || p.closest('#tblExpandOverlay,.pl-card') || /DimHost$|Active$/.test(p.id || '')) return; if (!m.has(p)) m.set(p, []); m.get(p).push(c); }); return [...m].filter(([, a]) => a.length >= 2); }
function ffKeyOf(p) { if (p.dataset.ff) return p.dataset.ff; const anc = p.id ? p : p.closest('[id]'); return ((p.closest('.view') || {}).id || '') + '|' + (anc ? anc.id : '') + '|' + (p.id ? '' : String(p.className || '').split(' ')[0]); }
const ffDef = p => p.dataset.ffDef ? p.dataset.ffDef.split('|') : [];
function ffApply() { ffGroups().forEach(([p, arr]) => { const H = new Set(ffHidden(ffKeyOf(p), ffDef(p))); arr.forEach(c => { const l = ffLabel(c), h = l && H.has(l); if (h) { if (c.style.display !== 'none') { c.style.display = 'none'; c.dataset.ffh = '1'; } } else if (c.dataset.ffh) { c.style.display = ''; delete c.dataset.ffh; } }); }); }
function ffActive(c) { return !!(c.querySelector('.mc-chip') || [...c.querySelectorAll('select')].some(x => x.value) || [...c.querySelectorAll('input[type=text],input[type=date]')].some(x => x.value && !x.classList.contains('mc-input'))); }
function ffMenu(btn, p) {
  document.querySelectorAll('.ff-pop').forEach(x => x.remove()); const key = ffKeyOf(p), cells = () => [...p.querySelectorAll(':scope > .ro-cf')], names = [...new Set(cells().map(ffLabel).filter(Boolean))], r = btn.getBoundingClientRect();
  const pop = document.createElement('div'); pop.className = 'ff-pop gf-pop'; pop.style.cssText = 'position:fixed;z-index:100010;background:var(--card);color:inherit;border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.25);padding:10px;width:270px;max-height:70vh;display:flex;flex-direction:column;gap:6px;left:' + Math.max(8, Math.min(innerWidth - 282, r.left)) + 'px;top:' + Math.min(innerHeight - 140, r.bottom + 4) + 'px';
  const cur = () => new Set(ffHidden(key, ffDef(p))), draw = () => { const H = cur(); pop.querySelector('[data-l]').innerHTML = names.map(n => { const c = cells().find(x => ffLabel(x) === n); return `<label style="display:flex;gap:8px;padding:3px 2px;cursor:pointer"><input type="checkbox" data-n="${plEsc(n)}" ${H.has(n) ? '' : 'checked'} style="width:auto;margin:0"> <span>${plEsc(n)}</span>${H.has(n) && c && ffActive(c) ? ' <small style="color:#c0392b">(has a value)</small>' : ''}</label>`; }).join(''); };
  pop.innerHTML = '<b>⚙ Filter fields — tick to show, untick to remove</b><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="ghost small" data-v="all">Show all</button><button type="button" class="ghost small" data-v="def">Reset</button></div><div data-l style="overflow:auto;max-height:50vh"></div><span class="text-sm">Remembered in this browser for this filter bar.</span>'; document.body.appendChild(pop); draw();
  const commit = H => { ff.map[key] = [...H]; ffSave(); ffApply(); if (key === 'logplan' && typeof lpRenderTbl === 'function') lpRenderTbl(); draw(); };
  pop.addEventListener('change', e => { const c = e.target.closest('input[data-n]'); if (!c) return; const H = cur(); c.checked ? H.delete(c.dataset.n) : H.add(c.dataset.n); if (H.size >= names.length) { H.delete(c.dataset.n); sectionToast('Keep at least one filter field.', 'warn'); } commit(H); });
  pop.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-v]'); if (!b) return; if (b.dataset.v === 'all') commit(new Set()); else { delete ff.map[key]; ffSave(); ffApply(); if (key === 'logplan' && typeof lpRenderTbl === 'function') lpRenderTbl(); draw(); } });
  setTimeout(() => { const off = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', off, true); } }; document.addEventListener('mousedown', off, true); }, 0);
}
function ffScan() {
  ffGroups().forEach(([p]) => { if (p.querySelector(':scope > .ff-btn')) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost small ff-btn'; b.textContent = '⚙ Filter fields'; b.title = 'Add or remove filter fields'; b.addEventListener('click', e => { e.stopPropagation(); ffMenu(b, p); }); p.appendChild(b); }); ffApply();
}
(function () { let t1 = null, t2 = null; new MutationObserver(() => { if (!t1) t1 = setTimeout(() => { t1 = null; ffScan(); }, 350); if (!t2) t2 = setTimeout(() => { t2 = null; ffApply(); }, 30); }).observe(document.body, { childList: true, subtree: true }); setTimeout(ffScan, 1300); })();

/* ============================================================
   EXPAND WINDOW — opens as a popup (Small / Medium / Large / Full screen, drag the title bar, drag the corner to resize) with ▦ Columns show / hide. Applies to every expanded list in the system.
   ============================================================ */
(function () {
  const ov = document.querySelector('#tblExpandOverlay'); if (!ov) return; const TW_KEY = LS_BASE + '_te_win', bar = ov.querySelector('.te-bar'), anchor = ov.querySelector('#teExcel'); if (!bar || !anchor) return;
  const css = document.createElement('style'); css.textContent = '#teBackdrop{display:none;position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.45)}#tblExpandOverlay.te-win{border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 70px rgba(0,0,0,.5);resize:both;overflow:hidden;min-width:480px;min-height:280px}#tblExpandOverlay.te-win .te-bar{cursor:move}'; document.head.appendChild(css);
  const bd = document.createElement('div'); bd.id = 'teBackdrop'; document.body.insertBefore(bd, ov);
  const szSel = document.createElement('select'); szSel.id = 'teSize'; szSel.title = 'Window size'; szSel.style.cssText = 'margin:0;width:auto'; szSel.innerHTML = '<option value="s">▭ Small</option><option value="m">▭ Medium</option><option value="l">▭ Large</option><option value="c">✥ Custom</option><option value="f">⛶ Full screen</option>';
  const colBtn = document.createElement('button'); colBtn.type = 'button'; colBtn.id = 'teCols'; colBtn.className = 'secondary small'; colBtn.textContent = '▦ Columns'; bar.insertBefore(szSel, anchor); bar.insertBefore(colBtn, anchor);
  let W = {}; try { W = JSON.parse(localStorage.getItem(TW_KEY) || '{}') || {}; } catch (e) {} let prog = false, key = null, was = false, rt = null;
  const save = () => { try { localStorage.setItem(TW_KEY, JSON.stringify(W)); } catch (e) {} }, PRE = { s: [.55, .62], m: [.74, .8], l: [.9, .9] };
  function geom() {
    const vw = innerWidth, vh = innerHeight, mode = W.mode || 'm';
    if (mode === 'f' || vw < 760) { ov.classList.remove('te-win'); ['inset', 'left', 'top', 'width', 'height'].forEach(p => ov.style.removeProperty(p)); szSel.value = 'f'; return; }
    ov.classList.add('te-win'); const cu = mode === 'c' && W.w; let w, h; if (cu) { w = W.w; h = W.h; } else { const p = PRE[mode] || PRE.m; w = Math.round(vw * p[0]); h = Math.round(vh * p[1]); }
    w = Math.max(480, Math.min(w, vw - 8)); h = Math.max(280, Math.min(h, vh - 8)); let x = cu && W.x != null ? W.x : Math.round((vw - w) / 2), y = cu && W.y != null ? W.y : Math.round((vh - h) / 2); x = Math.max(0, Math.min(x, vw - 140)); y = Math.max(0, Math.min(y, vh - 60));
    prog = true; ov.style.inset = 'auto'; ov.style.left = x + 'px'; ov.style.top = y + 'px'; ov.style.width = w + 'px'; ov.style.height = h + 'px'; setTimeout(() => { prog = false; }, 120); szSel.value = mode === 'c' && !W.w ? 'm' : mode;
  }
  szSel.addEventListener('change', () => { const v = szSel.value; W = v === 'c' ? Object.assign({}, W, { mode: W.w ? 'c' : 'm' }) : { mode: v }; save(); geom(); });
  const rect = () => { const b = ov.getBoundingClientRect(); W = { mode: 'c', w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left), y: Math.round(b.top) }; save(); szSel.value = 'c'; };
  bar.addEventListener('mousedown', e => { if (!ov.classList.contains('te-win') || e.button || e.target.closest('button,select,input,.te-combo,.combo,.mcombo')) return; const r = ov.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = ev => { ov.style.left = Math.max(-r.width + 140, Math.min(innerWidth - 140, ev.clientX - dx)) + 'px'; ov.style.top = Math.max(0, Math.min(innerHeight - 50, ev.clientY - dy)) + 'px'; }, up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); rect(); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); e.preventDefault(); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (prog || !was || !ov.classList.contains('te-win')) return; clearTimeout(rt); rt = setTimeout(rect, 200); }).observe(ov);
  function srcKey(t) { const L = hcLabels(t); if (!L) return null; const sig = L.join('~'), src = [...document.querySelectorAll('table')].find(x => !x.closest('#tblExpandOverlay') && (l2 => l2 && l2.join('~') === sig)(hcLabels(x))); return src ? hcKey(src, L) : 'te|' + sig.slice(0, 160); }
  function applyCols() { const t = ov.querySelector('#teBody table'); if (!t || !key) return; const L = hcLabels(t); if (!L) return; const H = new Set(hc.map[key] || []), n = L.length, hr = t.tHead.rows[0]; [...t.rows].forEach(r => { if (r.cells.length !== n) return; for (let i = 0; i < n; i++) { const c = r.cells[i], h = L[i] !== '' && H.has(L[i]), want = h ? 'none' : ''; if (c.style.display !== want) c.style.display = want; if (r === hr) { if (h) { c.dataset.noexport = '1'; c.dataset.hcnx = '1'; } else if (c.dataset.hcnx) { delete c.dataset.noexport; delete c.dataset.hcnx; } } } }); const k = (hc.map[key] || []).length; colBtn.textContent = '▦ Columns' + (k ? ' (' + k + ' hidden)' : ''); }
  colBtn.addEventListener('click', e => { e.stopPropagation(); const t = ov.querySelector('#teBody table'); if (!t) { sectionToast('Nothing to show or hide here.', 'warn'); return; } key = srcKey(t); if (!key) { sectionToast('This list has no column headings to hide.', 'warn'); return; } hcMenu(colBtn, { t, key, after: applyCols }); });
  new MutationObserver(() => { const on = ov.style.display === 'flex'; if (on && !was) { was = true; bd.style.display = 'block'; geom(); const t = ov.querySelector('#teBody table'); key = t ? srcKey(t) : null; applyCols(); colBtn.style.display = key ? '' : 'none'; } else if (!on && was) { was = false; bd.style.display = 'none'; document.querySelectorAll('.hc-pop').forEach(p => p.remove()); } }).observe(ov, { attributes: true, attributeFilter: ['style'] });
  window.addEventListener('resize', () => { if (was) geom(); });
})();

/* ============================================================
   SIDE PANEL WIDTH — drag the right edge of the control panel to resize it (double-click resets); remembered in this browser
   ============================================================ */
(function () {
  const sb = document.querySelector('.sidebar'); if (!sb) return; const K = LS_BASE + '_sb_w', root = document.documentElement;
  const st = document.createElement('style'); st.textContent = '.sidebar{position:relative}.sb-resizer{position:absolute;top:0;right:0;width:6px;height:100%;cursor:col-resize;z-index:30}.sb-resizer:hover,.sb-resizer.on{background:rgba(59,130,246,.5)}body.sb-mini .sb-resizer{display:none}body.sb-drag .sidebar{transition:none!important}body.sb-drag{user-select:none;cursor:col-resize}@media(max-width:900px){.sb-resizer{display:none}}'; document.head.appendChild(st);
  const set = w => root.style.setProperty('--sidebar-w', w + 'px'); try { const w = parseInt(localStorage.getItem(K), 10); if (w >= 200 && w <= 560) set(w); } catch (e) {}
  const h = document.createElement('div'); h.className = 'sb-resizer'; h.title = 'Drag to resize the side panel — double-click to reset'; sb.appendChild(h);
  h.addEventListener('mousedown', e => { e.preventDefault(); h.classList.add('on'); document.body.classList.add('sb-drag');
    const mv = ev => set(Math.max(200, Math.min(560, Math.round(ev.clientX - sb.getBoundingClientRect().left)))), up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); h.classList.remove('on'); document.body.classList.remove('sb-drag'); try { localStorage.setItem(K, String(parseInt(root.style.getPropertyValue('--sidebar-w'), 10) || 260)); } catch (x) {} };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); });
  h.addEventListener('dblclick', () => { root.style.removeProperty('--sidebar-w'); try { localStorage.removeItem(K); } catch (e) {} });
})();

/* ---- pop-up windows: movable, bold header-coloured border, minimise / maximise / close (all dialogs) ---- */
(function () {
  const GR = 'var(--acc-grad,linear-gradient(120deg,#12306b,#1d4ed8 55%,#3b82f6))', CARD = 'linear-gradient(var(--card,#fff),var(--card,#fff)) padding-box';
  const st = document.createElement('style');
  st.textContent = [
    '.mdl-box{border:4px solid transparent !important;background:' + CARD + ',' + GR + ' border-box !important;border-radius:16px !important;box-shadow:0 18px 60px rgba(10,20,50,.45) !important}',
    '#tblExpandOverlay.te-win{border:4px solid transparent !important;background:' + CARD + ',' + GR + ' border-box !important;border-radius:16px !important}',
    '[data-mdl] .tm-head,[data-mdl] .card-header,[data-mdl] .modal-header,[data-mdl] [data-drag]{cursor:move}',
    'body.mdl-drag,body.mdl-drag *{user-select:none !important;cursor:move !important}',
    '.mdl-ctl{display:inline-flex;align-items:stretch;margin-left:8px;flex:none;order:99;align-self:center}',
    '.mdl-ctl button{all:unset;box-sizing:border-box;width:44px;height:32px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font:400 16px/1 "Segoe UI",system-ui,sans-serif;cursor:pointer;transition:background .12s}',
    '.mdl-ctl button:hover{background:rgba(255,255,255,.22)}',
    '.mdl-ctl.mdl-lt button{color:var(--text,#1f2937)}.mdl-ctl.mdl-lt button:hover{background:rgba(0,0,0,.09)}',
    '.mdl-ctl button.mdl-x:hover{background:#e81123;color:#fff}',
    '.mdl-ctlw{position:sticky;top:0;height:0;z-index:60;text-align:right;overflow:visible}',
    '.mdl-ctlw>.mdl-ctl{position:absolute;right:0;top:0;margin:0;background:' + GR + ';border-radius:0 10px 0 8px;overflow:hidden}',
    '.mdl-min{background:transparent !important;pointer-events:none !important;align-items:flex-end !important;justify-content:flex-start !important;padding:0 0 10px 10px !important}',
    '.mdl-min>[data-mdl]{pointer-events:auto !important;width:auto !important;min-width:250px;max-width:320px !important;height:auto !important;max-height:none !important;transform:none !important;overflow:hidden !important;border-radius:10px !important;background:' + GR + ' !important}',
    '.mdl-min>[data-mdl]>*:not(.mdl-ctlw):not(.mdl-chip){display:none !important}',
    '.mdl-min.mdl-min>[data-mdl][data-mdl]>:is(.tm-head,.card-header,.modal-header,.mdl-bar){display:flex !important;padding:0 !important;margin:0 !important;background:none !important;flex-wrap:nowrap !important;border:0 !important}',
    '.mdl-min.mdl-min>[data-mdl][data-mdl]>:is(.tm-head,.card-header,.modal-header,.mdl-bar)>*:not(.mdl-ctl){display:none !important}',
    '.mdl-min>[data-mdl] .mdl-ctlw{position:static;height:auto}',
    '.mdl-min>[data-mdl] .mdl-ctlw>.mdl-ctl{position:static;background:none;border-radius:0}',
    '.mdl-min .mdl-ctl button{color:#fff !important}',
    '.mdl-chip{display:none;color:#fff;font:600 13px system-ui,sans-serif;padding:0 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;align-self:center}',
    '.mdl-min>[data-mdl]{display:flex !important;flex-direction:row !important;align-items:center}',
    '.mdl-min>[data-mdl] .mdl-chip{display:block}',
    '.mdl-ovfull{padding:0 !important}',
    '[data-mdl].mdl-full{width:100vw !important;max-width:100vw !important;height:100vh !important;max-height:100vh !important;border-radius:0 !important;transform:none !important}',
    '[data-mdl] [data-mdl-hid]{display:none !important}',
    '.mdl-bar{position:relative;padding-right:150px !important}',
    '.mdl-bar>.mdl-ctl{position:absolute;right:6px;top:10px;margin:0;order:0;align-self:auto}',
    '.mdl-min .mdl-bar,[data-mdl].mdl-min2 .mdl-bar,[data-mdl].mdl-min2>.mdl-bar{padding-right:0 !important}',
    '.mdl-min .mdl-bar>.mdl-ctl,[data-mdl].mdl-min2 .mdl-bar>.mdl-ctl,[data-mdl].mdl-min2>.mdl-bar>.mdl-ctl{position:static;margin-left:8px}',
    /* full-screen window overlays */
    '[data-mdl].mdl-win{inset:6vh 7vw !important;width:auto !important;height:auto !important;border:4px solid transparent !important;background:' + CARD + ',' + GR + ' border-box !important;border-radius:16px !important;box-shadow:0 18px 60px rgba(10,20,50,.45) !important;overflow:hidden}',
    '[data-mdl].mdl-win>:first-child{cursor:move}',
    '[data-mdl].mdl-min2{inset:auto auto 10px 10px !important;width:300px !important;height:auto !important;min-width:0 !important;min-height:0 !important;resize:none !important;overflow:hidden !important;border-radius:10px !important;border:3px solid transparent !important;background:' + CARD + ',' + GR + ' border-box !important;transform:none !important;box-shadow:0 8px 24px rgba(0,0,0,.35) !important}',
    '[data-mdl].mdl-min2>*:not(:first-child){display:none !important}',
    '[data-mdl].mdl-min2>:first-child{border:0 !important;padding:4px 6px !important;flex-wrap:nowrap !important}',
    '[data-mdl].mdl-min2>:first-child>*:not(.mdl-ctl):not(:first-child){display:none !important}',
    '[data-mdl].mdl-min2>:first-child>:first-child{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  ].join('\n');
  document.head.appendChild(st);
  const SKIP = '#teBackdrop,.m-backdrop,#lulLock,.lul-lock';
  const WINSEL = '#tblExpandOverlay,#roSmGridModal,#roLvGridModal';
  const HEAD = '.tm-head,.card-header,.modal-header';
  const alpha = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 0; const p = m[1].split(','); return p.length > 3 ? parseFloat(p[3]) : 1; };
  const vis = ov => { const c = getComputedStyle(ov); return c.display !== 'none' && c.visibility !== 'hidden'; };
  function closeBtn(box) {
    let b = box.querySelector('[data-x=close],[data-close],.modal-close,[id$=Close]:not(.mdl-x)');
    if (b) return b;
    const top = box.getBoundingClientRect().top;
    return Array.from(box.querySelectorAll('button,a,span[role=button]')).find(x => { const t = x.textContent.trim(); return !x.closest('.mdl-ctl') && t && /^([✕×✖✗xX]\s*)?(close|cancel|done)?$/i.test(t) && x.getBoundingClientRect().top - top < 90; }) || null;
  }
  function findBar(box) {
    let h = box.querySelector(':scope > ' + HEAD.split(',').join(',:scope > ')) || box.querySelector(HEAD); if (h) return h;
    const cs = [...box.children]; if (box.children[0]) cs.push(...box.children[0].children);
    const top = box.getBoundingClientRect().top;
    return cs.slice(0, 8).find(c => c instanceof HTMLElement && !c.classList.contains('mdl-ctl') && !c.classList.contains('mdl-ctlw') && !c.classList.contains('mdl-chip') && getComputedStyle(c).display === 'flex' && c.offsetHeight >= 28 && c.offsetHeight <= 150 && c.querySelector('button,select,input') && c.getBoundingClientRect().top - top < 90) || null;
  }
  function title(box) { const h = box.querySelector('h1,h2,h3,h4,.tm-title,.card-header,strong'); return ((h && h.textContent) || box.textContent || 'Window').replace(/\s+/g, ' ').trim().slice(0, 60); }
  function doClose(ov, box, win) {
    const b = closeBtn(box); ov.classList.remove('mdl-min', 'mdl-ovfull', 'mdl-min2', 'mdl-win'); ov._mdl = null; ov._mdlFull = false; ov.style.transform = '';
    if (b) b.click(); else if (win) ov.style.display = 'none'; else ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    setTimeout(() => { if (ov.isConnected && vis(ov)) ov.style.display = 'none'; }, 250);
  }
  function apply(ov, box) { box.classList.toggle('mdl-full', !!ov._mdlFull); ov.classList.toggle('mdl-ovfull', !!ov._mdlFull); }
  function setBd(on) { const bd = document.querySelector('#teBackdrop'); if (bd) bd.style.display = on ? 'block' : 'none'; }
  function addCtl(ov, box, isFull, win) {
    let c = box.querySelector('.mdl-ctl');
    if (c) { const f = c.querySelector('.mdl-f'); if (f) { f.textContent = isFull ? '❐' : '☐'; f.title = isFull ? 'Restore down' : 'Maximize'; } return; }
    c = document.createElement('div'); c.className = 'mdl-ctl';
    c.innerHTML = '<button class="mdl-m" type="button" title="Minimize">—</button><button class="mdl-f" type="button" title="' + (isFull ? 'Restore down' : 'Maximize') + '">' + (isFull ? '❐' : '☐') + '</button><button class="mdl-x" type="button" title="Close">✕</button>';
    c.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); e.preventDefault();
      if (win) {
        if (b.classList.contains('mdl-m')) { ov.classList.add('mdl-min2'); if (ov.id === 'tblExpandOverlay') setBd(false); }
        else if (b.classList.contains('mdl-f')) {
          if (ov.classList.contains('mdl-min2')) { ov.classList.remove('mdl-min2'); if (ov.id === 'tblExpandOverlay') setBd(true); }
          else if (ov.id === 'tblExpandOverlay') { const sel = ov.querySelector('#teSize'); if (sel) { if (sel.value === 'f') sel.value = ov._prev && ov._prev !== 'f' ? ov._prev : 'm'; else { ov._prev = sel.value; sel.value = 'f'; } sel.dispatchEvent(new Event('change', { bubbles: true })); } }
          else { ov.classList.toggle('mdl-win'); if (!ov.classList.contains('mdl-win')) { ov.style.transform = ''; ov._mdl = null; } }
        } else doClose(ov, box, true);
        sched(); return;
      }
      if (b.classList.contains('mdl-m')) { ov.classList.add('mdl-min'); sched(); }
      else if (b.classList.contains('mdl-f')) { if (ov.classList.contains('mdl-min')) { ov.classList.remove('mdl-min'); sched(); } else { const mx = box.querySelector('[data-x=max]'); if (mx) mx.click(); else { ov._mdlFull = !ov._mdlFull; apply(ov, box); } } }
      else doClose(ov, box, false);
    });
    const bar = findBar(box);
    if (!win) {
      const chip = document.createElement('div'); chip.className = 'mdl-chip'; chip.textContent = title(box);
      chip.addEventListener('click', () => { ov.classList.remove('mdl-min'); sched(); });
      box.insertBefore(chip, box.firstChild);
    }
    if (bar) {
      bar.appendChild(c); bar.classList.add('mdl-bar');
      const dark = bar.matches('.tm-head') || /gradient/.test(getComputedStyle(bar).backgroundImage);
      if (!dark) c.classList.add('mdl-lt');
    } else {
      const w = document.createElement('div'); w.className = 'mdl-ctlw'; w.appendChild(c); box.insertBefore(w, box.firstChild);
    }
    // the window's own plain Close / Expand buttons are replaced by these
    const cb = closeBtn(box); if (cb && !cb.closest('.mdl-ctl')) cb.setAttribute('data-mdl-hid', '1');
    const mb = box.querySelector('[data-x=max]'); if (mb) mb.setAttribute('data-mdl-hid', '1');
  }
  function scanOne(ov, vw, vh, st) {
    const cs = getComputedStyle(ov);
    if (cs.position !== 'fixed') return;
    const win = ov.matches(WINSEL);
    if (cs.display === 'none' || cs.visibility === 'hidden') {
      if (ov._mdl || ov._mdlFull || ov.classList.contains('mdl-min') || ov.classList.contains('mdl-min2') || ov.classList.contains('mdl-win')) { ov._mdl = null; ov._mdlFull = false; ov.classList.remove('mdl-min', 'mdl-min2', 'mdl-win', 'mdl-ovfull'); ov.style.transform = ''; ov.querySelectorAll(':scope > [data-mdl]').forEach(b => { b.style.transform = ''; b.classList.remove('mdl-full'); }); if (ov.id === 'tblExpandOverlay') { /* its own observer manages the backdrop */ } }
      return;
    }
    if (win) {
      ov.dataset.mdl = '1';
      const f = ov.id === 'tblExpandOverlay' ? !ov.classList.contains('te-win') : !ov.classList.contains('mdl-win');
      if (ov.classList.contains('mdl-win') && ov._mdl && ov.style.transform === '') ov.style.transform = 'translate(' + ov._mdl.x + 'px,' + ov._mdl.y + 'px)';
      addCtl(ov, ov, f && !ov.classList.contains('mdl-min2'), true); return;
    }
    const min = ov.classList.contains('mdl-min');
    const r = ov.getBoundingClientRect();
    if (!min && (r.width < vw * .9 || r.height < vh * .9 || alpha(cs.backgroundColor) >= .9) && !ov.querySelector(':scope > [data-mdl]')) return;
    const box = Array.from(ov.children).find(c => c instanceof HTMLElement && getComputedStyle(c).display !== 'none' && (c.hasAttribute('data-mdl') || (c.offsetWidth > 120 && c.offsetHeight > 80 && getComputedStyle(c).position !== 'fixed')));
    if (!box) return;
    box.dataset.mdl = '1';
    if (ov._mdlFull) apply(ov, box);
    const full = box.classList.contains('mdl-full') || (!min && box.offsetWidth >= vw - 6 && box.offsetHeight >= vh - 6);
    box.classList.toggle('mdl-box', !full && !min);
    if (!full && !min && ov._mdl && box.style.transform === '') box.style.transform = 'translate(' + ov._mdl.x + 'px,' + ov._mdl.y + 'px)';
    if (full) box.style.transform = '';
    addCtl(ov, box, full, false);
    if (min) { box.style.marginLeft = (st.mins++ * 262) + 'px'; } else box.style.marginLeft = '';
  }
  function scan() {
    const vw = innerWidth, vh = innerHeight, S = { mins: 0 };
    Array.from(document.body.children).forEach(ov => {
      if (!(ov instanceof HTMLElement) || ov.matches(SKIP) || /^(SCRIPT|STYLE|LINK)$/.test(ov.tagName)) return;
      try { scanOne(ov, vw, vh, S); } catch (e) { }
    });
  }
  let last = 0, tm = 0;
  function sched() { const n = Date.now(); if (tm) return; tm = setTimeout(() => { tm = 0; last = Date.now(); try { scan(); } catch (e) { } }, Math.max(0, 120 - (n - last))); }
  new MutationObserver(sched).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  addEventListener('resize', sched); sched();
  document.addEventListener('pointerdown', e => {
    if (e.button || innerWidth < 820) return;
    const box = e.target.closest && e.target.closest('[data-mdl]'); if (!box) return;
    const winMode = box.classList.contains('mdl-win');
    if (!winMode && !box.classList.contains('mdl-box')) return;
    if (e.target.closest('button,input,select,textarea,a,label,[contenteditable],summary,.combo,.mcombo')) return;
    const rb = box.getBoundingClientRect(), inHead = e.target.closest('.tm-head,.card-header,.modal-header,[data-drag],.mdl-bar') || (e.clientY - rb.top <= 60);
    if (!inHead) return;
    const holder = winMode ? box : box.parentElement, o = holder._mdl || (holder._mdl = { x: 0, y: 0 }), sx = e.clientX, sy = e.clientY, ox = o.x, oy = o.y;
    const baseL = rb.left - ox, baseT = rb.top - oy, w = rb.width;
    document.body.classList.add('mdl-drag'); e.preventDefault();
    const mv = ev => {
      let x = ox + ev.clientX - sx, y = oy + ev.clientY - sy;
      x = Math.max(-baseL - w + 80, Math.min(innerWidth - baseL - 80, x));
      y = Math.max(-baseT, Math.min(innerHeight - baseT - 50, y));
      o.x = x; o.y = y; box.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    };
    const up = () => { document.body.classList.remove('mdl-drag'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }, true);
})();

/* ---- collapse / expand every list card ---- */
(function () {
  const key = c => { const v = c.closest('.view'), h = c.querySelector(':scope > .card-header .card-title'); return LS_BASE + '_cc_' + (v ? v.id : '') + '_' + (h ? h.textContent.trim().slice(0, 40) : (c.id || '')); };
  const get = k => { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } }, put = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
  function scan() { document.querySelectorAll('.view.active .card, .view.active .ro-card').forEach(c => {
    if (c.closest('[id$="Modal"],#tblExpandOverlay,.fd-modal')) return; const h = c.querySelector(':scope > .card-header'); if (!h || h.querySelector('.cc-btn') || c.children.length < 2) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cc-btn'; const k = key(c), set = on => { c.classList.toggle('cc-collapsed', on); b.textContent = on ? '▸ Show' : '▾ Hide'; b.title = on ? 'Show this section' : 'Hide this section (only the title stays)'; }; set(get(k));
    b.addEventListener('click', e => { e.stopPropagation(); const on = !c.classList.contains('cc-collapsed'); set(on); put(k, on); }); const row = h.querySelector(':scope > .btn-row'); if (row) row.insertBefore(b, row.firstChild); else h.appendChild(b); }); }
  let t = null; new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 250); }).observe(document.body, { childList: true, subtree: true }); document.addEventListener('click', () => setTimeout(scan, 300)); setTimeout(scan, 800);
})();

/* ---------- missing reports: which warehouses did not report, on which days ---------- */
const MGM_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function mgMissCalc() {
  const f = mg.f, ds = mg.rows.map(r => r.date).sort(); if (!ds.length) return null;
  const from = f.from || ds[0], to = f.to || ds[ds.length - 1]; if (from > to) return null;
  const opt = { ign: PLQ('#mgMissIgn').checked, fri: PLQ('#mgMissFri').checked, all: PLQ('#mgMissAll').checked, q: (PLQ('#mgMissQ').value || '').trim().toLowerCase() };
  const cal = []; for (let d = new Date(from + 'T00:00:00'), n = 0; dpIso(d) <= to && n < 800; d.setDate(d.getDate() + 1), n++) cal.push(dpIso(d));
  const inRange = mg.rows.filter(r => r.date >= from && r.date <= to), anyDay = new Set(inRange.map(r => r.date));
  const days = cal.filter(d => (!opt.ign || anyDay.has(d)) && !(opt.fri && new Date(d + 'T00:00:00').getDay() === 5));
  const uni = new Map(); mg.rows.forEach(r => { if (!r.wh) return; const o = uni.get(r.wh) || { wh: r.wh, area: '', region: '', last: '' }; if (r.date >= o.last) { o.last = r.date; o.area = r.area || o.area; o.region = r.region || o.region; } uni.set(r.wh, o); });
  const rep = new Map(); inRange.forEach(r => { let st = rep.get(r.wh); if (!st) rep.set(r.wh, st = new Set()); st.add(r.date); });
  const yr = from.slice(0, 4) !== to.slice(0, 4), fmt = d => d.slice(8) + ' ' + MGM_MON[+d.slice(5, 7) - 1] + (yr ? ' ' + d.slice(2, 4) : '');
  const rows = []; uni.forEach(o => {
    if ((f.area.length && !f.area.includes(o.area)) || (f.region.length && !f.region.includes(o.region)) || (f.wh.length && !f.wh.includes(o.wh))) return;
    const st = rep.get(o.wh) || new Set(), miss = days.filter(d => !st.has(d)); if (!miss.length && !opt.all) return;
    if (opt.q && !(o.wh + ' ' + o.area + ' ' + o.region).toLowerCase().includes(opt.q)) return;
    const idx = new Map(days.map((d, i) => [d, i])), rg = []; let a = null, b = null; miss.forEach(d => { const i = idx.get(d); if (a === null) { a = b = d; b = d; } else if (i === idx.get(b) + 1) b = d; else { rg.push([a, b]); a = b = d; } }); if (a !== null) rg.push([a, b]);
    const txt = rg.map(([x, y]) => x === y ? fmt(x) : (idx.get(y) - idx.get(x) + 1 > 2 ? fmt(x) + ' → ' + fmt(y) + ' (' + (idx.get(y) - idx.get(x) + 1) + ' d)' : fmt(x) + ', ' + fmt(y))).join(' · ');
    rows.push({ wh: o.wh, area: o.area, region: o.region, exp: days.length, rep: days.length - miss.length, miss, last: [...st].sort().pop() || '', everLast: o.last, txt });
  });
  rows.sort((x, y) => y.miss.length - x.miss.length || x.wh.localeCompare(y.wh));
  return { from, to, days, rows, fmt, whTotal: [...uni.values()].filter(o => (!f.area.length || f.area.includes(o.area)) && (!f.region.length || f.region.includes(o.region)) && (!f.wh.length || f.wh.includes(o.wh))).length };
}
function mgMissData(noF) {
  const m = mgMissCalc(); if (!m) return { title: 'Management Daily Report — missing reports', sheet: 'Missing reports', note: '', headers: [], rows: [] };
  const pct = r => r.exp ? Math.round(r.rep / r.exp * 1000) / 10 : '';
  return { title: 'Management Daily Report — missing reports', sheet: 'Missing reports', note: `${m.from} → ${m.to} · ${m.days.length} day(s) counted · ${m.rows.filter(r => r.miss.length).length} warehouse(s) with missing days${mgFilterText ? ' · ' + mgFilterText() : ''}`,
    headers: ['WHs', 'Area', 'Regions', 'Days expected', 'Days reported', 'Days missing', 'Compliance %', 'Last report', 'Missing dates'],
    rows: m.rows.filter(r => noF || tcfRowOk('mgMissTable', [r.wh, r.area, r.region, r.exp, r.rep, r.miss.length, pct(r) === '' ? '' : pct(r) + '%', r.last || r.everLast || '—', r.txt || '—'])).map(r => [r.wh, r.area, r.region, r.exp, r.rep, r.miss.length, pct(r), r.last || r.everLast || '—', r.txt || '—']), detail: m.rows.filter(r => noF || tcfRowOk('mgMissTable', [r.wh, r.area, r.region, r.exp, r.rep, r.miss.length, pct(r) === '' ? '' : pct(r) + '%', r.last || r.everLast || '—', r.txt || '—'])).flatMap(r => r.miss.map(d => [r.wh, r.area, r.region, d, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T00:00:00').getDay()]])) };
}
function mgMissRender() {
  const t = PLQ('#mgMissTable'), kp = PLQ('#mgMissKpi'); if (!t) return; const m = mgMissCalc();
  if (!m) { t.innerHTML = ''; kp.innerHTML = ''; PLQ('#mgMissSub').textContent = ''; return; }
  const d = mgMissData(true), bad = m.rows.filter(r => r.miss.length), tot = bad.reduce((a, r) => a + r.miss.length, 0), worst = bad[0];
  PLQ('#mgMissSub').textContent = `— ${m.from} → ${m.to} · ${m.days.length} day(s) counted`;
  kp.innerHTML = `<div class="mgm-k ${bad.length ? 'bad' : 'ok'}"><b>${bad.length}</b><span>of ${m.whTotal} warehouse(s) with missing reports</span></div><div class="mgm-k"><b>${tot}</b><span>missing warehouse-days</span></div>${worst ? `<div class="mgm-k"><b>${plEsc(worst.wh)}</b><span>most missing · ${worst.miss.length} of ${worst.exp} days</span></div>` : ''}${bad.length ? '' : '<div class="mgm-k ok" style="flex:2"><b>✅ All reported</b><span>every warehouse reported on every counted day</span></div>'}`;
  t.innerHTML = d.rows.length ? `<thead><tr>${d.headers.map((h, i) => `<th class="${i >= 3 && i <= 6 ? 'n' : ''}">${plEsc(h)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r => `<tr><td><b>${plEsc(r[0])}</b></td><td>${plEsc(r[1])}</td><td>${plEsc(r[2])}</td><td class="n">${r[3]}</td><td class="n">${r[4]}</td><td class="n">${r[5] ? `<span class="mgm-chip">${r[5]}</span>` : '0'}</td><td class="n">${r[6] === '' ? '' : r[6] + '%'}</td><td>${plEsc(r[7])}</td><td class="mgm-dates">${plEsc(r[8])}</td></tr>`).join('')}</tbody>` : `<tbody><tr><td style="padding:14px;color:var(--gray-600)">No warehouse matches — nothing is missing for this selection.</td></tr></tbody>`;
  if (d.rows.length) tblColFilters(t); const sb = PLQ('#mgMissSub'); if (sb && !sb.querySelector('.tcf-count')) { const sp = document.createElement('span'); sp.className = 'tcf-count'; sb.appendChild(sp); } tcfApply(t);
}
(function () {   // wiring for the missing-reports card
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#mgMissCard [data-m]'); if (!b) return; const d = mgMissData(), k = b.dataset.m;
    if (!d.rows.length) { sectionToast('Nothing missing for this selection — nothing to ' + (k === 'email' ? 'email' : k === 'excel' ? 'export' : k === 'print' ? 'print' : 'expand') + '.', 'info'); return; }
    if (k === 'excel') { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.headers, ...d.rows]), 'Missing summary'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['WHs', 'Area', 'Regions', 'Missing date', 'Weekday'], ...d.detail]), 'Missing days'); XLSX.writeFile(wb, 'Missing_reports_' + mgMissCalc().from + '_' + mgMissCalc().to + '.xlsx'); addActivity('export', d.title); }
    else if (k === 'print') a2Print(d); else if (k === 'email') a2Mail(mgMissData); else a2Expand(d); });
  const rd = () => { if (document.querySelector('#view-mgt.active') && mg.rows.length) mgMissRender(); };
  document.addEventListener('change', e => { if (e.target.closest && e.target.closest('.mg-missbar')) rd(); });
  document.addEventListener('input', e => { if (e.target.id === 'mgMissQ') rd(); });
})();
/* ---------- measures panel ---------- */
function mgDefsRender() {
  const o = mg.cfg.opt, inc = [o.out && 'Outbound', o.inb && 'Inbound', o.ret && 'Returns'].filter(Boolean).join(' + ') || '(nothing ticked)', hb = o.hrs === 'all' ? 'Working Hrs + Working OT Hrs' : 'Working Hrs (already includes OT)';
  const D = [['Working Volume', mg.cfg.map.daily.vol && mg.cfg.map.daily.vol !== SKIP_VALUE ? 'Sum of the mapped Working Volume column' : `Sum of ${inc}`], ['WorkingHrs', 'Normal Working Hours + Normal Overtime Hours + Week-Off OT + Public_OT'], ['WorkingOTHrs', 'Normal Overtime Hours + Week-Off OT + Public_OT (the overtime part of WorkingHrs)'],
    ['Prod_Value (Productivity)', `Working Volume ÷ (${hb})  — volume per working hour`], ['Target Value', `Targets list lookup that depends on the slicers — Area only: Area_Desc, Region_Code and WHs_Code all = the Area. Area + Regions: Area_Desc = Area, Region_Code = Region, WHs_Code = Region. + WHs Desc: Area_Desc = Area, Region_Code = Region, WHs_Code = WHs Desc. ${o.tAgg === 'sum' ? 'Summed' : 'Averaged'} when several rows match. With no slicer set: the targets of every warehouse that has records.`], ['ProdOverAll (Productivity %)', 'Prod_Value ÷ Target Value × 100'],
    ['AvrgOT (OT Actual)', 'WorkingOTHrs ÷ WorkingHrs × 100  (OT share of all hours worked)'], ['TargetOT', 'TargetOT of the same matched rows, averaged'], ['OTDiff (Over Time %)', 'OT Actual − OT Target, in percentage points'], ['OTDiff_2 (Over Time %)', '(OT Actual − OT Target) ÷ OT Target × 100'],
    ['Budget_HC / Nr_TACCS_HC', 'Sum over the warehouses that have records in the selection (headcount is not dated)'], ['Latest Entry_Date', 'Latest Entry_Date in the selection']];
  PLQ('#mgDefs').innerHTML = D.map(([a, b]) => `<tr><td><strong>${plEsc(a)}</strong></td><td>${plEsc(b)}</td></tr>`).join('');
}
/* ---------- filters + refresh ---------- */
/* connected dropdowns: each list only offers the values that still exist under the other selections (and the date range) */
const MG_FK = [['area', 'Area (Region_Desc)'], ['region', 'Regions (BU_Decs)'], ['wh', 'WHs Desc']];
function mgOptions(k) { const f = mg.f; return [...new Set(mg.rows.filter(r => (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && MG_FK.every(([x]) => x === k || !f[x].length || f[x].includes(r[x]))).map(r => r[k]).filter(Boolean))].sort(mdpNat); }
function mgPrune() { for (let i = 0; i < 3; i++) MG_FK.forEach(([k]) => { if (mg.f[k].length) { const ok = new Set(mgOptions(k)); mg.f[k] = mg.f[k].filter(v => ok.has(v)); } }); }
function mgFilterUi(except) {
  const host = PLQ('#mgFHost'), sig = mg.rows.length + '|' + mg.loaded; if (host.dataset.sig !== sig) { host.dataset.sig = sig; host.innerHTML = ''; }
  MG_FK.forEach(([k, l]) => { let w = host.querySelector(`[data-k="${k}"]`); if (!w) { w = document.createElement('div'); w.className = 'ro-cf'; w.dataset.k = k; w.innerHTML = `<label>${plEsc(l)}</label>`; host.appendChild(w); } if (k === except) return;
    const old = w.querySelector('.combo'); if (old) old.remove(); const vals = mgOptions(k); w.appendChild(buildMultiCombo(mg.f[k].filter(v => vals.includes(v)), vals, arr => { mg.f[k] = arr; mgPrune(); mgFilterUi(k); mgRenderReport(); }, { placeholder: 'All' })); });
}
function mgRenderReport() {
  const pane = PLQ('#view-mgt .mg-pane[data-p="rep"]'); if (!pane) return;
  if (!mg.rows.length) { PLQ('#mgKpis').innerHTML = `<div class="pl-empty" style="grid-column:1/-1">${mgSetupOk() ? 'No report data yet — open <strong>🔌 Lists &amp; mapping</strong>, pick the lists and click <strong>Load report data</strong>.' : (mg.cfg.list.daily ? 'No report data yet — press <strong>Refresh</strong> to load it.' : 'The administrator has not set up the report lists yet.')}</div>`; PLQ('#mgGrid').innerHTML = ''; PLQ('#mgTable').innerHTML = ''; return; }
  if (document.querySelector('#mgFHost').dataset.sig !== mg.rows.length + '|' + mg.loaded) mgFilterUi(); PLQ('#mgFrom').value = mg.f.from; PLQ('#mgTo').value = mg.f.to; PLQ('#mgBy').value = mg.cfg.by;
  const rows = mgView(), T = mgTargets(), WM = mgWhsMap(); mg.ctx = { groups: mgGroups(rows, T, WM), all: mgAgg(rows, T, WM, { area: mg.f.area, region: mg.f.region, wh: mg.f.wh }) };
  mgKpis(mg.ctx.all); atDrawGrid(PLQ('#mgGrid'), MG_DEFS, { rows: () => mg.ctx }); mgTableRender(); try { mgMissRender(); } catch (e) { console.error(e); }
}
function mgTabsRender() { if (mg.tab === 'setup' && !mgSetupOk()) mg.tab = 'rep'; PLQ('#mgTabs').innerHTML = MG_TABS.filter(t => t[0] !== 'setup' || mgSetupOk()).map(t => `<button type="button" data-t="${t[0]}" class="${mg.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join(''); document.querySelectorAll('#view-mgt .mg-pane').forEach(p => { p.style.display = p.dataset.p === mg.tab ? '' : 'none'; }); }
function mgRefresh() {
  mgTabsRender(); const d = mg.cfg.list.daily; if (typeof a2MgSrcUi === 'function') a2MgSrcUi(); PLQ('#mgSrcLine').textContent = mg.cfg.src === 'att' ? (mg.rows.length ? `Attendance file “${at.file || ''}” · ${plF(mg.rows.length)} store-day rows · OT rules: normal day ${a2.cfg.normal} h` : 'Attendance version — upload the attendance report in Attendance Analytics.') : mg.rows.length ? `Daily list “${d}” · ${plF(mg.rows.length)} rows · loaded ${new Date(mg.loaded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No data loaded yet.';
  PLQ('#mgIncOut').checked = !!mg.cfg.opt.out; PLQ('#mgIncIn').checked = !!mg.cfg.opt.inb; PLQ('#mgIncRet').checked = !!mg.cfg.opt.ret; PLQ('#mgHrsBasis').value = mg.cfg.opt.hrs; PLQ('#mgOtFmt').value = mg.cfg.opt.otFmt; PLQ('#mgTAgg').value = mg.cfg.opt.tAgg || 'avg'; mgDefsRender();
  if (mg.tab === 'rep') mgRenderReport(); else if (mg.tab === 'links' && typeof a2LinkRender === 'function') { if (!at.rows.length) atLoad(); PLQ('#mgLinkInfo').textContent = at.rows.length ? '' : 'Upload the attendance report in Attendance Analytics first.'; a2LinkRender(PLQ('#mgLinkHost')); }
}
function mgQuick(q) {
  const ds = mg.rows.map(r => r.date).sort(), last = ds[ds.length - 1] || '', first = ds[0] || ''; const sh = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return dpIso(d); };
  if (q === 'last') mg.f.from = mg.f.to = last; else if (q === '7') { mg.f.from = sh(last, -6); mg.f.to = last; } else if (q === 'mtd') { mg.f.from = last.slice(0, 8) + '01'; mg.f.to = last; } else { mg.f.from = first; mg.f.to = last; } mgRenderReport();
}
/* ---------- wiring ---------- */
function mgInit() {
  if (mg.inited) return; mg.inited = true; mgLoadCfg(); try { visInit({ pre: 'mg', view: 'mgt', grid: '#mgGrid', kpis: '#mgKpis', redraw: () => mgRenderReport() }); } catch (e) { console.error(e); } const q = PLQ; mg.tab = !mgSetupOk() || mg.cfg.src === 'att' || (mg.cfg.list.daily && mgMapOk('daily')) ? 'rep' : 'setup';
  q('#mgTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b) return; mg.tab = b.dataset.t; mgRefresh(); });
  ['daily', 'whs', 'trgt'].forEach(w => { mg.pick[w] = createListPicker(document.querySelector(`[data-list-picker="mg-${w}"]`), { getSiteUrl: () => getGlobalSiteUrl(), getToken: () => getGlobalAccessToken(), onChange: () => { mg.cols[w] = []; mgMapRender(w); } }); try { if (mg.cfg.list[w] && mg.pick[w].setValue) mg.pick[w].setValue(mg.cfg.list[w]); } catch (e) {} mgMapRender(w); });
  q('#mgColsBtn').addEventListener('click', async () => {
    const st = q('#mgColsStatus'), token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(); if (!token || !siteUrl) { st.textContent = '⚠ Configure the global Site URL and sign-in first.'; return; }
    try { st.textContent = 'Loading…'; for (const w of ['daily', 'whs', 'trgt']) { const nm = mg.pick[w].getValue(); mg.cfg.list[w] = nm; if (!nm) { mg.cols[w] = []; continue; } const { siteId, listId } = await resolveIds(siteUrl, nm, token); mg.cols[w] = (await fetchColumns(siteId, listId, token)).filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase())); if (!Object.keys(mg.cfg.map[w]).length) mg.cfg.map[w] = mdpAuto(MG_FIELDS[w], mg.cols[w]); mgMapRender(w); }
      st.textContent = `✓ ${mg.cols.daily.length} daily · ${mg.cols.whs.length} headcount · ${mg.cols.trgt.length} target columns`; mgSaveCfg(); } catch (e) { st.textContent = '✘ ' + e.message; }
  });
  q('#mgAutoBtn').addEventListener('click', () => { let any = false; ['daily', 'whs', 'trgt'].forEach(w => { if (mg.cols[w].length) { mg.cfg.map[w] = mdpAuto(MG_FIELDS[w], mg.cols[w]); mgMapRender(w); any = true; } }); if (!any) q('#mgColsStatus').textContent = '⚠ Load columns first.'; mgSaveCfg(); });
  q('#mgCopyDef').addEventListener('click', async () => { if (!mgSetupOk()) return; const t = 'const MG_DEFAULT = ' + JSON.stringify({ list: mg.cfg.list, map: mg.cfg.map, opt: mg.cfg.opt }) + ';'; try { await navigator.clipboard.writeText(t); q('#mgLoadStatus').textContent = '✔ Copied — paste it over the MG_DEFAULT line in the HTML file; everyone then uses these lists.'; } catch (e) { prompt('Copy this line:', t); } });
  q('#mgLoadBtn').addEventListener('click', () => mgLoad(false)); q('#mgRefresh').addEventListener('click', () => mgLoad(false));
  const opt = () => { const o = mg.cfg.opt; o.out = q('#mgIncOut').checked; o.inb = q('#mgIncIn').checked; o.ret = q('#mgIncRet').checked; o.hrs = q('#mgHrsBasis').value; o.otFmt = q('#mgOtFmt').value; o.tAgg = q('#mgTAgg').value; mgSaveCfg(); mgDefsRender(); }; ['#mgIncOut', '#mgIncIn', '#mgIncRet', '#mgHrsBasis', '#mgOtFmt', '#mgTAgg'].forEach(s => q(s).addEventListener('change', opt));
  q('#mgFrom').addEventListener('change', e => { mg.f.from = e.target.value; mgPrune(); mgFilterUi(); mgRenderReport(); }); q('#mgTo').addEventListener('change', e => { mg.f.to = e.target.value; mgPrune(); mgFilterUi(); mgRenderReport(); }); q('#mgBy').addEventListener('change', e => { mg.cfg.by = e.target.value; mgSaveCfg(); mgRenderReport(); });
  document.querySelectorAll('#view-mgt [data-q]').forEach(b => b.addEventListener('click', () => mgQuick(b.dataset.q)));
  q('#mgExcel').addEventListener('click', () => { const d = mgTableData(); if (!d.rows.length) { sectionToast('Nothing to export.', 'warn'); return; } const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.headers, ...d.rows, ...(d.totals ? [d.totals] : [])]), d.sheet); XLSX.writeFile(wb, `Mngt_Daily_Report_${new Date().toISOString().slice(0, 10)}.xlsx`); addActivity('export', 'Management daily report Excel'); });
  q('#mgPrint').addEventListener('click', () => { const d = mgTableData(); if (!d.rows.length) { sectionToast('Nothing to print.', 'warn'); return; } w_printTable(d.title, d.note, d.headers, d.rows, d.totals || undefined); });
  q('#mgEmail').addEventListener('click', () => { if (!mgTableData().rows.length) { sectionToast('Nothing to email.', 'warn'); return; } window.extMailData = mgTableData; wMail_open('ext'); });
  q('#mgExpand').addEventListener('click', () => { const d = mgTableData(), tb = document.createElement('table'); tb.id = 'mgExpTable'; tb.dataset.title = d.title; tb.innerHTML = '<thead><tr>' + d.headers.map(x => '<th>' + plEsc(x) + '</th>').join('') + '</tr></thead><tbody>' + d.rows.concat(d.totals ? [d.totals] : []).map(r => '<tr>' + r.map(v => '<td>' + plEsc(v == null ? '' : v) + '</td>').join('') + '</tr>').join('') + '</tbody>'; if (window.tableExpandOpen) window.tableExpandOpen(tb); });
  window.addEventListener('resize', () => { if (document.querySelector('#view-mgt.active') && mg.tab === 'rep' && mg.rows.length) atDrawGrid(PLQ('#mgGrid'), MG_DEFS, { rows: () => mg.ctx }); });
}
function mgOpen() { mgInit(); a2EAuto(); if (mg.cfg.src !== 'sp' && typeof mgApplySrc === 'function' && mgApplySrc(true)) mg.tab = 'rep'; mgRefresh(); if ((!mg.rows.length || mg.cfg.src !== 'sp') && !mg.sp && !mg.autoTried && mg.cfg.list.daily && mgMapOk('daily') && getGlobalAccessToken() && getGlobalSiteUrl()) { mg.autoTried = true; mgLoad(true); } }
document.querySelectorAll('.nav-item[data-view="mgt"]').forEach(n => n.addEventListener('click', () => setTimeout(mgOpen, 0)));
/* ============================================================
   MANAGEMENT DAILY REPORT — SharePoint version only (second page): reads Mngmnt_Daily_Data_tbl, targets from Trgt_tbl
   ============================================================ */
/* ============================================================
   MANAGEMENT DAILY REPORT — the Power BI "Mngt Daily Report" rebuilt on SharePoint lists
   tables: Mngmnt_Daily_Data_tbl (daily), WHs_tbl (headcount), Trgt_Dtls_tbl (targets, looked up by WHs_Code)
   ============================================================ */
const MW_KEY = LS_BASE + '_mgw_cfg1';
const MW_DEFAULT = null;   // fixed by the administrator: use "Copy fixed settings" in Lists & mapping and paste it over this line
const mwSetupOk = () => featOk('mgsetup');
const mw = { cfg: { list: { daily: 'Mngmnt_Daily_Data_tbl', whs: '', trgt: 'Trgt_tbl' }, map: { daily: {}, whs: {}, trgt: {} }, opt: { out: true, inb: false, ret: true, hrs: 'reg', otFmt: 'auto', tAgg: 'avg' }, by: 'areareg', src: 'sp' }, cols: { daily: [], whs: [], trgt: [] }, pick: {}, rows: [], whs: [], trg: [], f: { from: '', to: '', area: [], region: [], wh: [] }, tab: 'setup', loaded: 0, inited: false, ctx: { groups: [], all: null } };
const MW_FIELDS = {
  daily: [
    { key: 'date', label: 'Entry_Date', req: 1, al: ['entrydate', 'recorddate', 'reportdate', 'date', 'day'] },
    { key: 'wh', label: 'WHs_Desc (warehouse)', req: 1, al: ['whsdesc', 'whdesc', 'whs', 'warehouse', 'whname', 'site', 'wh'] },
    { key: 'area', label: 'Region_Desc  (shown as “Area”)', al: ['regiondesc', 'area', 'region'] },
    { key: 'region', label: 'BU_Decs  (shown as “Regions”)', al: ['budecs', 'budesc', 'bu', 'regions', 'businessunit'] },
    { key: 'out', label: 'Outbound Volume Ltrs-Kg', al: ['outboundvolumeltrskg', 'outboundvolume', 'outboundltrs', 'outbound'] },
    { key: 'inb', label: 'Inbound Volume Ltrs-Kg', al: ['inboundvolumeltrskg', 'inboundvolume', 'inboundltrs', 'inbound'] },
    { key: 'ret', label: 'WHs_Returns_Ltrs', al: ['whsreturnsltrs', 'returnsltrs', 'returnvolume', 'returns'] },
    { key: 'orders', label: 'Number of Orders Processed', al: ['numberofordersprocessed', 'ordersprocessed', 'numberoforders', 'noorders', 'orders'] },
    { key: 'nh', label: 'Normal Working Hours', al: ['normalworkinghours', 'normalworkinghrs', 'normalhours', 'normalhrs', 'workinghours', 'workinghrs'] },
    { key: 'not', label: 'Normal Overtime Hours', al: ['normalovertimehours', 'normalovertimehrs', 'normalothours', 'normalothrs', 'normalot', 'overtimehours'] },
    { key: 'wo', label: 'Week-Off OT', al: ['weekoffot', 'weekoffovertime', 'weekoffothours', 'weekoff'] },
    { key: 'po', label: 'Public_OT', al: ['publicot', 'publicotthours', 'publicholidayot', 'publicovertime', 'public'] },
    { key: 'vol', label: 'Working Volume (only if a ready column exists)', al: ['workingvolume', 'totalvolume'] }],
  whs: [
    { key: 'wh', label: 'WHs_Desc (warehouse)', req: 1, al: ['whsdesc', 'whdesc', 'whs', 'warehouse', 'whname', 'wh'] },
    { key: 'bud', label: 'Budget_HC', req: 1, al: ['budgethc', 'budgetheadcount', 'budget', 'bdgt'] },
    { key: 'act', label: 'Nr_TACCS_HC (actual headcount)', req: 1, al: ['nrtaccshc', 'taccshc', 'actualhc', 'actualheadcount', 'headcount', 'actual', 'hc'] }],
  trgt: [
    { key: 'area', label: 'Area_Desc (matches Area / Region_Desc) — optional', al: ['areadesc', 'locationdesc', 'area', 'regiondesc'] },
    { key: 'region', label: 'Region_Code (matches Regions / BU_Decs) — optional', al: ['regioncode', 'budecs', 'bucode', 'region'] },
    { key: 'code', label: 'WHs_Code (matches WHs Desc, or the Region at region level)', req: 1, al: ['whscode', 'whcode', 'linkcode', 'warehousecode', 'code'] },
    { key: 'prod', label: 'Target Value (productivity target)', req: 1, al: ['targetvalue', 'targetprod', 'productivitytarget', 'prodtarget', 'target'] },
    { key: 'tot', label: 'TargetOT (overtime target)', al: ['targetot', 'ottarget', 'overtimetarget', 'otpercent'] }]
};
const MW_TABS = [['rep', '📊 Report'], ['setup', '🔌 Lists & mapping'], ['measures', 'ƒ Measures']];
const mwS = v => v == null ? '' : typeof v === 'object' ? String(v.Value ?? v.LookupValue ?? v.Title ?? v.DisplayName ?? '').trim() : String(v).trim();
const mwNull = v => { if (v == null || v === '') return null; if (typeof v === 'object') v = v.Value; const n = Number(String(v).replace(/,/g, '').replace(/%$/, '')); return isFinite(n) ? n : null; };
const mwN = v => mwNull(v) || 0;
const mwAvg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const mwMapOk = (w) => MW_FIELDS[w].filter(f => f.req).every(f => mw.cfg.map[w][f.key] && mw.cfg.map[w][f.key] !== SKIP_VALUE);
function mwLoadCfg() { try { const c = JSON.parse(localStorage.getItem(MW_KEY) || 'null'); if (c) { Object.assign(mw.cfg.list, c.list || {}); ['daily', 'whs', 'trgt'].forEach(w => Object.assign(mw.cfg.map[w], (c.map || {})[w] || {})); Object.assign(mw.cfg.opt, c.opt || {}); if (c.by) mw.cfg.by = c.by; } } catch (e) {}
  if (!mwSetupOk() && MW_DEFAULT) { try { Object.assign(mw.cfg.list, MW_DEFAULT.list || {}); ['daily', 'whs', 'trgt'].forEach(w => { mw.cfg.map[w] = Object.assign({}, (MW_DEFAULT.map || {})[w] || {}); }); Object.assign(mw.cfg.opt, MW_DEFAULT.opt || {}); } catch (e) {} } }
function mwSaveCfg() { try { localStorage.setItem(MW_KEY, JSON.stringify(mw.cfg)); } catch (e) {} }

/* ---------- mapping UI ---------- */
function mwMapRender(w) {
  const host = PLQ({ daily: '#mwMapDaily', whs: '#mwMapWhs', trgt: '#mwMapTrgt' }[w]), cols = mw.cols[w]; host.innerHTML = '';
  if (!cols.length) { host.innerHTML = '<tr><td colspan="2" style="padding:14px;text-align:center;color:var(--gray-400);font-style:italic;">Pick the list and click 🔄 Load Columns.</td></tr>'; return; }
  MW_FIELDS[w].forEach(f => { const tr = document.createElement('tr'); tr.innerHTML = `<td><strong>${plEsc(f.label)}</strong>${f.req ? ' <span style="color:#c0392b">*</span>' : ''}</td><td class="combo-cell"></td>`; tr.querySelector('.combo-cell').appendChild(buildCombo(mw.cfg.map[w][f.key] || SKIP_VALUE, cols, nv => { mw.cfg.map[w][f.key] = nv; mwSaveCfg(); })); host.appendChild(tr); });
}
/* ---------- loading ---------- */
async function mwReadList(w, say) {
  const token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl(), name = mw.cfg.list[w]; if (!name) return null;
  if (!isListVisible(name)) throw new Error(`No permission to access "${name}"`);
  say(`Reading "${name}"…`); const a = await resolveIds(siteUrl, name, token);
  return await fetchAllItems(a.siteId, a.listId, token, n => say(`"${name}": ${plF(n)} rows…`));
}
async function mwLoad(silent) {
  const st = PLQ('#mwLoadStatus'), say = (t, c) => { st.className = 'text-sm'; st.textContent = t; st.style.color = c === 'e' ? '#c0392b' : ''; }, prog = PLQ('#mwProg'), token = getGlobalAccessToken(), siteUrl = getGlobalSiteUrl();
  if (mwSetupOk()) { mw.cfg.list.daily = mw.pick.daily.getValue(); mw.cfg.list.whs = mw.pick.whs.getValue(); mw.cfg.list.trgt = mw.pick.trgt.getValue(); mwSaveCfg(); }
  if (!token || !siteUrl) { if (!silent) say('⚠ Configure the global Site URL and sign-in first.', 'e'); return; }
  if (!mw.cfg.list.daily) { say('⚠ Pick the daily data list.', 'e'); return; }
  for (const w of ['daily', 'whs', 'trgt']) { if (mw.cfg.list[w] && !mwMapOk(w)) { try { say('Finding the columns of "' + mw.cfg.list[w] + '"…'); const ids = await resolveIds(siteUrl, mw.cfg.list[w], token), cols = (await fetchColumns(ids.siteId, ids.listId, token)).filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase())), keep = Object.fromEntries(Object.entries(mw.cfg.map[w]).filter(([k, v]) => v && v !== SKIP_VALUE)); mw.cols[w] = cols; mw.cfg.map[w] = Object.assign(mdpAuto(MW_FIELDS[w], cols), keep); mwMapRender(w); } catch (e) { say('✘ ' + e.message, 'e'); return; } } } mwSaveCfg();
  if (!mwMapOk('daily')) { say('⚠ Map at least Entry_Date and WHs_Desc of the daily data list.', 'e'); return; }
  if (mw.cfg.list.trgt && !mwMapOk('trgt')) { say('⚠ Map WHs_Code and Target Value of the targets list.', 'e'); return; }
  if (mw.cfg.list.whs && !mwMapOk('whs')) { say('⚠ Map WHs_Desc, Budget_HC and Nr_TACCS_HC of the headcount list (or clear that list).', 'e'); return; }
  prog.style.display = 'inline-block'; prog.removeAttribute('value'); PLQ('#mwLoadBtn').disabled = true;
  try {
    const g = (w, k) => { const c = mw.cfg.map[w][k]; return c && c !== SKIP_VALUE ? c : null; };
    const dItems = await mwReadList('daily', say), M = mw.cfg.map.daily, gd = k => g('daily', k); let bad = 0; const rows = [];
    dItems.forEach(it => { const f = it.fields || {}, date = mdpDate(f[gd('date')] instanceof Object ? '' : f[gd('date')]); if (!date) { bad++; return; }
      rows.push({ date, wh: mwS(f[gd('wh')]), area: gd('area') ? mwS(f[gd('area')]) : '', region: gd('region') ? mwS(f[gd('region')]) : '', out: gd('out') ? mwN(f[gd('out')]) : 0, inb: gd('inb') ? mwN(f[gd('inb')]) : 0, ret: gd('ret') ? mwN(f[gd('ret')]) : 0, orders: gd('orders') ? mwN(f[gd('orders')]) : 0, nh: gd('nh') ? mwN(f[gd('nh')]) : 0, not: gd('not') ? mwN(f[gd('not')]) : 0, wo: gd('wo') ? mwN(f[gd('wo')]) : 0, po: gd('po') ? mwN(f[gd('po')]) : 0, vol: gd('vol') ? mwN(f[gd('vol')]) : 0 }); });
    rows.forEach(r => { r.ot = r.not + r.wo + r.po; r.hrs = r.nh + r.ot; }); mw.rows = rows; mw.whs = []; mw.trg = [];
    if (mw.cfg.list.whs) { const items = await mwReadList('whs', say); items.forEach(it => { const f = it.fields || {}, wh = mwS(f[g('whs', 'wh')]); if (wh) mw.whs.push({ wh, bud: mwN(f[g('whs', 'bud')]), act: mwN(f[g('whs', 'act')]) }); }); }
    if (mw.cfg.list.trgt) { const items = await mwReadList('trgt', say); items.forEach(it => { const f = it.fields || {}, o = { area: mwS(f[g('trgt', 'area')]), region: mwS(f[g('trgt', 'region')]), code: mwS(f[g('trgt', 'code')]), prod: g('trgt', 'prod') ? mwNull(f[g('trgt', 'prod')]) : null, tot: g('trgt', 'tot') ? mwNull(f[g('trgt', 'tot')]) : null }; if (o.prod != null || o.tot != null) mw.trg.push(o); }); }
    mw.sp = { rows, whs: mw.whs, trg: mw.trg };
    mw.loaded = Date.now(); mw.f.area = []; mw.f.region = []; mw.f.wh = []; document.querySelector('#mwFHost').dataset.sig = '';
    const ds = mw.rows.map(r => r.date).sort(); mw.f.from = ds[0] || ''; mw.f.to = ds[ds.length - 1] || '';
    say(`✅ ${plF(rows.length)} daily rows (${ds[0] || '—'} → ${ds[ds.length - 1] || '—'})${mw.cfg.list.whs ? ` · ${plF(mw.whs.length)} headcount rows` : ''}${mw.cfg.list.trgt ? ` · ${plF(mw.trg.length)} target rows` : ''}${bad ? ` · ${bad} rows without a valid date skipped` : ''}`);
    addActivity('download', `Management daily report loaded from "${mw.cfg.list.daily}"`);
    if (rows.length) { mw.tab = 'rep'; } mwRefresh();
  } catch (e) { say('✘ ' + e.message, 'e'); } finally { prog.style.display = 'none'; PLQ('#mwLoadBtn').disabled = false; }
}
/* ---------- calculations ---------- */
function mwView() { const f = mw.f; return mw.rows.filter(r => (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && (!f.area.length || f.area.includes(r.area)) && (!f.region.length || f.region.includes(r.region)) && (!f.wh.length || f.wh.includes(r.wh))); }
function mwTargets() {
  /* Target lookup in the targets list — driven by the deepest slicer that is set:
     Area only         → Area_Desc = Area  AND Region_Code = Area    AND WHs_Code = Area   (the same input is searched in all 3 columns)
     Area + Regions    → Area_Desc = Area  AND Region_Code = Region  AND WHs_Code = Region
     + WHs Desc        → Area_Desc = Area  AND Region_Code = Region  AND WHs_Code = WHs Desc */
  const o = mw.cfg.opt, ots = mw.trg.filter(t => t.tot != null), frac = o.otFmt === 'frac' || (o.otFmt === 'auto' && ots.length && ots.every(t => Math.abs(t.tot) <= 1)), nk = v => String(v == null ? '' : v).trim().toLowerCase();
  const has = (a, v) => !a || !a.length || nk(v) === '' || a.some(x => nk(x) === nk(v));
  return (lvl, whSet) => {
    lvl = lvl || {}; let rows;
    if (lvl.wh && lvl.wh.length) rows = mw.trg.filter(t => has(lvl.area, t.area) && has(lvl.region, t.region) && has(lvl.wh, t.code));
    else if (lvl.region && lvl.region.length) rows = mw.trg.filter(t => has(lvl.area, t.area) && has(lvl.region, t.region) && has(lvl.region, t.code));
    else if (lvl.area && lvl.area.length) rows = mw.trg.filter(t => has(lvl.area, t.area) && has(lvl.area, t.region) && has(lvl.area, t.code));
    else { const d = new Set([...(whSet ? whSet.keys() : [])].map(nk)); rows = mw.trg.filter(t => d.has(nk(t.code))); }   // nothing selected: every warehouse that has a record
    if (!rows.length) return null;
    const p = rows.map(t => t.prod).filter(v => v != null), q = rows.map(t => t.tot).filter(v => v != null).map(v => frac ? v * 100 : v);
    return { prod: !p.length ? null : o.tAgg === 'sum' ? p.reduce((x, y) => x + y, 0) : mwAvg(p), ot: mwAvg(q), n: rows.length };
  };
}
function mwWhsMap() { const m = new Map(); mw.whs.forEach(h => { const o = m.get(h.wh) || { bud: 0, act: 0 }; o.bud += h.bud; o.act += h.act; m.set(h.wh, o); }); return m; }
function mwAgg(rows, T, WM, lvl) {
  const o = mw.cfg.opt, s = { n: rows.length, out: 0, inb: 0, ret: 0, orders: 0, hrs: 0, ot: 0, volc: 0, latest: '' }, whSet = new Map();
  rows.forEach(r => { s.out += r.out; s.inb += r.inb; s.ret += r.ret; s.orders += r.orders; s.hrs += r.hrs; s.ot += r.ot; s.volc += r.vol; if (r.date > s.latest) s.latest = r.date; if (!whSet.has(r.wh)) whSet.set(r.wh, r); });
  const hasVol = mw.cfg.map.daily.vol && mw.cfg.map.daily.vol !== SKIP_VALUE;
  s.vol = hasVol ? s.volc : (o.out ? s.out : 0) + (o.inb ? s.inb : 0) + (o.ret ? s.ret : 0);
  const hb = o.hrs === 'all' ? s.hrs + s.ot : s.hrs; s.prod = hb > 0 && !(mw.cfg.src === 'att' && !s.vol) ? s.vol / hb : null; s.otPct = s.hrs > 0 ? s.ot / s.hrs * 100 : null;
  const tg = T(lvl, whSet); s.tProd = tg ? tg.prod : null; s.tOT = tg ? tg.ot : null; s.noT = tg ? 0 : 1; s.prodPct = s.prod != null && s.tProd ? s.prod / s.tProd * 100 : null;
  s.otDiff = s.otPct != null && s.tOT != null ? s.otPct - s.tOT : null; s.otDiff2 = s.otDiff != null && s.tOT ? s.otDiff / s.tOT * 100 : null;
  s.bud = s.act = null; s.whN = whSet.size; if (mw.whs.length) { let b = 0, a = 0; whSet.forEach((_, wh) => { const h = WM.get(wh); if (h) { b += h.bud; a += h.act; } }); s.bud = b; s.act = a; }
  return s;
}
const MW_BY = { areareg: r => (r.area || '—') + ' › ' + (r.region || '—'), area: r => r.area || '—', region: r => r.region || '—', wh: r => r.wh || '—', day: r => r.date, month: r => r.date.slice(0, 7) };
function mwGroups(rows, T, WM) { const g = new Map(), kf = MW_BY[mw.cfg.by] || MW_BY.areareg; rows.forEach(r => { const k = kf(r); let o = g.get(k); if (!o) g.set(k, o = { k, rows: [] }); o.rows.push(r); }); const L = [...g.values()].sort((a, b) => mdpNat(a.k, b.k)); const d = (x, k) => [...new Set(x.rows.map(r => r[k]).filter(Boolean))], by = mw.cfg.by;
  L.forEach(x => { const lv = by === 'area' ? { area: d(x, 'area') } : by === 'wh' ? { area: d(x, 'area'), region: d(x, 'region'), wh: d(x, 'wh') } : (by === 'areareg' || by === 'region') ? { area: d(x, 'area'), region: d(x, 'region') } : { area: mw.f.area, region: mw.f.region, wh: mw.f.wh }; x.a = mwAgg(x.rows, T, WM, lv); }); return L; }
const mwFilterText = () => { const f = mw.f, p = []; if (f.from || f.to) p.push(`${f.from || '…'} → ${f.to || '…'}`); if (f.area.length) p.push('Area: ' + f.area.join(', ')); if (f.region.length) p.push('Region: ' + f.region.join(', ')); if (f.wh.length) p.push('WHs: ' + f.wh.join(', ')); return p.join(' · ') || 'All data'; };

