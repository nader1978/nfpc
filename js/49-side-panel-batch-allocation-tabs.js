/* ============================================================
   SIDE PANEL — collapsible groups, mini mode, user-defined layout (Settings)
   ============================================================ */
const NAV_DEF_KEY = LS_BASE + '_navlayout_default', NAV_MINI_KEY = LS_BASE + '_navmini', NAV_COL_KEY = LS_BASE + '_navcollapsed';
const navUserKey = () => LS_BASE + '_navlayout_' + ((typeof currentUser !== 'undefined' && currentUser && currentUser.id) || 'anon');
const navJ = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const navW = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
let navOrig = null, navMeta = {}, navSig = '';
function navCapture() {
  if (navOrig) return navOrig; const nav = document.querySelector('.sidebar-nav'), groups = []; let cur = null;
  [...nav.children].forEach(el => { if (el.classList.contains('nav-section-label')) { cur = { id: 'g' + groups.length, name: el.textContent.trim(), items: [] }; groups.push(cur); } else if (el.classList.contains('nav-item')) { if (!cur) { cur = { id: 'g0', name: 'Main', items: [] }; groups.push(cur); } cur.items.push(el.dataset.view); navMeta[el.dataset.view] = { el, name: (el.querySelector('span:nth-child(2)') || el).textContent.trim(), icon: (el.querySelector('.icon') || {}).textContent || '' }; el.title = navMeta[el.dataset.view].name; } });
  navOrig = { v: 1, groups }; return navOrig;
}
function navReconcile(l) {
  const orig = navCapture(), known = new Set(Object.keys(navMeta)), seen = new Set(), out = { v: 1, groups: [] };
  (l && l.groups ? l.groups : orig.groups).forEach((g, i) => { const items = (g.items || []).filter(v => known.has(v) && !seen.has(v)); items.forEach(v => seen.add(v)); out.groups.push({ id: g.id || 'g' + i, name: String(g.name || 'Group').slice(0, 40), items, collapsed: !!g.collapsed }); });
  known.forEach(v => { if (seen.has(v)) return; const og = orig.groups.find(g => g.items.includes(v)), tg = og && out.groups.find(g => g.name === og.name); if (tg) tg.items.push(v); else { let o = out.groups.find(g => g.name === 'Other'); if (!o) { o = { id: 'gother', name: 'Other', items: [], collapsed: false }; out.groups.push(o); } o.items.push(v); } });
  return out;
}
const navLayout = () => navReconcile(navJ(navUserKey()) || navJ(NAV_DEF_KEY) || null);
function navApply(force) {
  const nav = document.querySelector('.sidebar-nav'); if (!nav) return; navCapture(); const lay = navLayout(), col = navJ(NAV_COL_KEY) || {}, sig = navUserKey() + JSON.stringify(lay); if (!force && sig === navSig) return; navSig = sig;
  const tools = nav.querySelector('.nav-tools') || (() => { const d = document.createElement('div'); d.className = 'nav-tools'; d.innerHTML = '<button type="button" data-n="collapse" title="Collapse all groups">▸ Collapse all</button><button type="button" data-n="expand" title="Expand all groups">▾ Expand all</button>'; return d; })();
  [...nav.querySelectorAll('.nav-group')].forEach(g => g.remove()); [...nav.querySelectorAll(':scope > .nav-section-label')].forEach(l => l.remove()); nav.prepend(tools);
  lay.groups.forEach(g => { if (!g.items.length) return; const box = document.createElement('div'), isCol = g.name in col ? !!col[g.name] : !!g.collapsed; box.className = 'nav-group' + (isCol ? ' collapsed' : ''); box.dataset.g = g.name;
    box.innerHTML = `<div class="nav-section-label nav-group-head" tabindex="0" role="button" aria-expanded="${!isCol}"><span class="caret">▾</span><span class="gname"></span><span class="gcount">${g.items.length}</span></div><div class="nav-group-body"></div>`; box.querySelector('.gname').textContent = g.name; const body = box.querySelector('.nav-group-body'); g.items.forEach(v => body.appendChild(navMeta[v].el)); nav.appendChild(box); });
  try { acApplyNav(); } catch (e) {}
}
function navToggleGroup(box, on) { const c = navJ(NAV_COL_KEY) || {}; const v = on == null ? !box.classList.contains('collapsed') : on; box.classList.toggle('collapsed', v); box.querySelector('.nav-group-head').setAttribute('aria-expanded', !v); c[box.dataset.g] = v; navW(NAV_COL_KEY, c); }
function navMini(on) { document.body.classList.toggle('sb-mini', on); const b = document.querySelector('#sbToggle'); if (b) { b.textContent = on ? '»' : '«'; b.title = on ? 'Expand the side panel' : 'Collapse the side panel'; } try { localStorage.setItem(NAV_MINI_KEY, on ? '1' : ''); } catch (e) {} }
/* ---------- Settings editor ---------- */
const navSet = { draft: null };
function navSetRender() {
  const host = document.querySelector('#navSetHost'); if (!host) return; navCapture(); if (!navSet.draft) navSet.draft = JSON.parse(JSON.stringify(navLayout())); const d = navSet.draft;
  host.innerHTML = d.groups.map((g, gi) => `<div class="ns-group" data-gi="${gi}"><div class="ns-gh"><input class="ns-name" data-gi="${gi}" value="${plEsc(g.name)}" maxlength="40"><button class="ghost small" data-a="gup" ${gi ? '' : 'disabled'} type="button" title="Move group up">▲</button><button class="ghost small" data-a="gdn" ${gi < d.groups.length - 1 ? '' : 'disabled'} type="button" title="Move group down">▼</button><label class="text-sm"><input type="checkbox" data-a="gcol" ${g.collapsed ? 'checked' : ''}> start collapsed</label><button class="ghost small" data-a="gdel" type="button" title="Delete group (items move to the previous group)">🗑</button></div>
    ${g.items.length ? `<ul class="ns-items">${g.items.map((v, ii) => `<li data-v="${v}"><span class="ns-n">${plEsc((navMeta[v] || {}).icon || '')} ${plEsc((navMeta[v] || {}).name || v)}</span><button class="ghost small" data-a="iup" ${ii ? '' : 'disabled'} type="button">▲</button><button class="ghost small" data-a="idn" ${ii < g.items.length - 1 ? '' : 'disabled'} type="button">▼</button><select data-a="imv"><option value="">Move to…</option>${d.groups.map((h, hi) => hi === gi ? '' : `<option value="${hi}">${plEsc(h.name)}</option>`).join('')}</select></li>`).join('')}</ul>` : '<div class="text-sm" style="color:var(--gray-500);padding:4px 2px">Empty group — it is hidden in the side panel.</div>'}</div>`).join('');
}


/* ---------- Upload Destinations: collapse the whole "Define & map" section, or open / close every destination ---------- */
(function utCollapseInit() {
  const KEY = LS_BASE + '_ut_card_collapsed', go = () => {
    const card = document.querySelector('#utDefCard'), b = document.querySelector('#utCardCol'); if (!card || !b || b.dataset.init) return; b.dataset.init = '1';
    const host = () => document.querySelector('#utHost'), all = open => host().querySelectorAll('details').forEach(d => { d.open = open; });
    const apply = c => { host().style.display = c ? 'none' : ''; ['#utExpAll', '#utColAll'].forEach(x => { document.querySelector(x).style.display = c ? 'none' : ''; }); b.textContent = c ? '▸ Expand' : '▾ Collapse'; b.setAttribute('aria-expanded', String(!c)); };
    let c = false; try { c = localStorage.getItem(KEY) === '1'; } catch (e) {} apply(c);
    b.addEventListener('click', () => { c = !c; try { localStorage.setItem(KEY, c ? '1' : '0'); } catch (e) {} apply(c); });
    document.querySelector('#utExpAll').addEventListener('click', () => all(true)); document.querySelector('#utColAll').addEventListener('click', () => all(false));
  };
  go(); document.addEventListener('DOMContentLoaded', go);
})();
/* ---------- Settings › Side panel layout: collapse / expand (remembered) ---------- */
(function navSetCollapseInit() {
  const KEY = LS_BASE + '_navset_collapsed', go = () => {
    const card = document.querySelector('#navSetCard'), btn = document.querySelector('#navSetCollapse'); if (!card || !btn || btn.dataset.init) return; btn.dataset.init = '1';
    const apply = c => { [...card.children].forEach(ch => { if (!ch.classList.contains('card-header')) ch.style.display = c ? 'none' : ''; }); btn.textContent = c ? '▸ Expand' : '▾ Collapse'; btn.setAttribute('aria-expanded', String(!c)); card.classList.toggle('ns-collapsed', c); };
    let c = false; try { c = localStorage.getItem(KEY) === '1'; } catch (e) {} apply(c);
    btn.addEventListener('click', () => { c = !c; try { localStorage.setItem(KEY, c ? '1' : '0'); } catch (e) {} apply(c); });
  };
  go(); document.addEventListener('DOMContentLoaded', go);
})();
function navSetInit() {
  const q = s => document.querySelector(s), host = q('#navSetHost'); if (!host || host.dataset.init) return; host.dataset.init = '1'; const st = (t) => { q('#navSetStatus').textContent = t; };
  host.addEventListener('input', e => { const i = e.target.closest('.ns-name'); if (i) navSet.draft.groups[+i.dataset.gi].name = i.value; });
  host.addEventListener('change', e => { const t = e.target, gi = +t.closest('.ns-group').dataset.gi, g = navSet.draft.groups[gi]; if (t.dataset.a === 'gcol') g.collapsed = t.checked; else if (t.dataset.a === 'imv' && t.value !== '') { const v = t.closest('li').dataset.v; g.items = g.items.filter(x => x !== v); navSet.draft.groups[+t.value].items.push(v); navSetRender(); } });
  host.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a, gi = +b.closest('.ns-group').dataset.gi, G = navSet.draft.groups, g = G[gi], li = b.closest('li'), v = li && li.dataset.v, ii = v ? g.items.indexOf(v) : -1;
    if (a === 'gup' && gi) [G[gi - 1], G[gi]] = [G[gi], G[gi - 1]]; else if (a === 'gdn' && gi < G.length - 1) [G[gi + 1], G[gi]] = [G[gi], G[gi + 1]];
    else if (a === 'gdel') { if (G.length < 2) return; const to = G[gi ? gi - 1 : 1]; to.items.push(...g.items); G.splice(gi, 1); }
    else if (a === 'iup' && ii > 0) [g.items[ii - 1], g.items[ii]] = [g.items[ii], g.items[ii - 1]]; else if (a === 'idn' && ii < g.items.length - 1) [g.items[ii + 1], g.items[ii]] = [g.items[ii], g.items[ii + 1]]; navSetRender(); });
  q('#navSetAdd').addEventListener('click', () => { navSet.draft.groups.push({ id: 'g' + Date.now(), name: 'New group', items: [], collapsed: false }); navSetRender(); });
  const clean = () => { const d = JSON.parse(JSON.stringify(navSet.draft)); d.groups.forEach(g => { g.name = (g.name || '').trim() || 'Group'; }); return d; };
  q('#navSetSave').addEventListener('click', () => { navW(navUserKey(), clean()); const c = {}; navW(NAV_COL_KEY, c); navApply(true); st('✅ Saved for your account.'); addActivity('settings', 'Side-panel layout saved'); });
  q('#navSetDefault').addEventListener('click', () => { if (!isAdmin()) { st('Only an administrator can set the default.'); return; } navW(NAV_DEF_KEY, clean()); st('✅ Saved as the default layout for every user without their own layout (this browser).'); addActivity('settings', 'Default side-panel layout saved'); });
  q('#navSetReset').addEventListener('click', () => { try { localStorage.removeItem(navUserKey()); localStorage.removeItem(NAV_COL_KEY); } catch (e) {} navSet.draft = null; navApply(true); navSetRender(); st('↺ Back to the default layout.'); });
  q('#navSetExport').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ kind: 'nfpc-sidepanel-layout', ...clean() }, null, 2)], { type: 'application/json' })); a.download = 'side_panel_layout.json'; document.body.appendChild(a); a.click(); a.remove(); st('⬇ Layout file downloaded.'); });
  q('#navSetImportBtn').addEventListener('click', () => q('#navSetFile').click());
  q('#navSetFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const j = JSON.parse(await f.text()); if (!j || !Array.isArray(j.groups)) throw new Error('Not a side-panel layout file.'); navSet.draft = navReconcile(j); navSetRender(); st('📂 File loaded — check it and press “Save for me”.'); } catch (x) { st('✘ ' + x.message); } });
  navSetRender();
}
(function navBoot() {
  const nav = document.querySelector('.sidebar-nav'); if (!nav) return; navCapture();
  const head = document.querySelector('.sidebar-header'); if (head && !head.querySelector('#sbToggle')) { const b = document.createElement('button'); b.id = 'sbToggle'; b.type = 'button'; b.className = 'sb-toggle'; b.addEventListener('click', () => navMini(!document.body.classList.contains('sb-mini'))); head.appendChild(b); }
  navMini(localStorage.getItem(NAV_MINI_KEY) === '1');
  nav.addEventListener('click', e => { const h = e.target.closest('.nav-group-head'); if (h) { navToggleGroup(h.parentElement); return; } const t = e.target.closest('[data-n]'); if (t) { nav.querySelectorAll('.nav-group').forEach(g => navToggleGroup(g, t.dataset.n === 'collapse')); return; } const it = e.target.closest('.nav-item'); if (it) { const g = it.closest('.nav-group'); if (g && g.classList.contains('collapsed')) navToggleGroup(g, false); try { acRoApply(); } catch (x) {} } });
  nav.addEventListener('keydown', e => { const h = e.target.closest && e.target.closest('.nav-group-head'); if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navToggleGroup(h.parentElement); } });
  navApply(true);
  document.querySelectorAll('.nav-item[data-view="settings"]').forEach(n => n.addEventListener('click', () => { navSet.draft = null; navSetInit(); navSetRender(); }));
})();


/* ============================================================
   BATCH ALLOCATION (FEFO) — tabbed layout with KPI strip (same look as Milco Daily Planning)
   The existing cards and their ids are untouched; they are only grouped into tabs.
   ============================================================ */
(function wTabsBoot() {
  const v = document.querySelector('#view-warehouse'); if (!v) return;
  const TABS = [['order', '📄 1 · Order file & grouping'], ['uom', '⚖ 2 · UOM conversion'], ['fefo', '📦 3 · FEFO allocation & picking']]; let cur = 'order';
  [...v.children].filter(e => e.classList.contains('card')).forEach(c => { c.dataset.wtab = c.id === 'wUomCard' ? 'uom' : c.id === 'wFefoCard' ? 'fefo' : 'order'; });
  const head = document.createElement('div'); head.className = 'card'; head.style.paddingBottom = '8px'; head.dataset.wtab = 'all';
  head.innerHTML = '<div class="card-header"><div class="card-title">📦 Batch Allocation (FEFO) <span class="text-sm" style="font-weight:400;">— order file × batch stock → first-expiry-first-out picking</span></div><div class="pl-tabs" id="wTabs"></div></div><div class="pl-kpis" id="wKpis" style="margin:8px 0 0;"></div>';
  const first = v.querySelector(':scope > .card'); v.insertBefore(head, first);
  const hint = document.createElement('div'); hint.className = 'card'; hint.dataset.wtab = 'hint'; hint.style.display = 'none'; hint.innerHTML = '<div class="pl-empty">📄 Load the order file in tab 1 first — the FEFO allocation, picking list and good-return balance appear here once the order is loaded.</div>'; v.insertBefore(hint, first);
  const K = (l, x, s) => `<div class="pl-kpi"><div class="lbl">${l}</div><div class="val">${x}</div><div class="sub">${s}</div></div>`, N = n => (n || 0).toLocaleString();
  function kpis() {
    const s = typeof wFefoState !== 'undefined' ? wFefoState : {}, r = s.results || [], cnt = k => r.filter(x => x.statusKey === k).length, units = r.reduce((a, x) => a + (+x.qtyAllocated || 0), 0), gr = typeof wGR !== 'undefined' && wGR.lines ? wGR.lines.length : 0;
    const fc = document.querySelector('#wFefoCard'); hint.style.display = cur === 'fefo' && fc && fc.style.display === 'none' ? '' : 'none'; document.querySelector('#wKpis').innerHTML = K('Batch stock indexed', s.batchIndex ? N(s.batchIndex.size) : '—', s.batchListName ? 'SKUs in “' + s.batchListName + '”' : 'pick the batch list in tab 3') + K('Allocation lines', N(r.length), r.length ? 'after the last run' : 'not run yet') + K('Allocated', N(units), 'units (Pcs)') + K('Fully covered', N(cnt('ok') || cnt('full') || r.filter(x => /ok|full|allocated/i.test(x.statusKey || '')).length), 'lines') + K('Insufficient / no batch', `${N(cnt('insufficient'))} / ${N(cnt('nobatch'))}`, 'lines needing attention') + K('Good return lines', N(gr), gr ? 'deducted from the demand' : 'none loaded');
  }
  function show(t) { cur = t; v.querySelectorAll(':scope > .card[data-wtab]').forEach(c => c.classList.toggle('wtab-hid', c.dataset.wtab !== 'all' && c.dataset.wtab !== 'hint' && c.dataset.wtab !== t)); document.querySelector('#wTabs').innerHTML = TABS.map(x => `<button type="button" data-t="${x[0]}" class="${cur === x[0] ? 'on' : ''}">${x[1]}</button>`).join(''); kpis(); }
  document.querySelector('#wTabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) show(b.dataset.t); });
  show('order'); setInterval(() => { if (v.classList.contains('active')) { try { kpis(); } catch (e) {} } }, 1500);
  document.querySelectorAll('.nav-item[data-view="warehouse"]').forEach(n => n.addEventListener('click', () => setTimeout(kpis, 50)));
})();

/* ===== Upload guard: confirm every Excel upload + "Remove file" for loaded files ===== */
(function () {
  const XL = /\.(xlsx|xlsm|xlsb|xls|csv)$/i, esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), $i = id => { const e = document.getElementById(id); return e && e.nodeType === 1 ? e : null; };
  const sz = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const call = (f, ...a) => { try { return f(...a); } catch (e) { console.warn('[upguard]', e); } };
  let bypass = false; const snaps = {}, names = {};
  function modal(title, body, btns) {
    return new Promise(res => {
      const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
      o.innerHTML = `<div role="dialog" aria-modal="true" style="background:var(--card,#fff);color:var(--text,#222);border-radius:12px;max-width:520px;width:100%;padding:18px 20px;box-shadow:0 10px 40px rgba(0,0,0,.35);max-height:90vh;overflow:auto;"><div style="font-weight:700;font-size:16px;margin-bottom:8px;">${title}</div><div class="text-sm" style="margin-bottom:14px;line-height:1.5;">${body}</div><div class="btn-row" style="justify-content:flex-end;gap:8px;flex-wrap:wrap;">${btns.map(b => `<button type="button" class="${b[2] || 'ghost'}" data-v="${b[0]}">${b[1]}</button>`).join('')}</div></div>`;
      const done = v => { o.remove(); document.removeEventListener('keydown', kd, true); res(v); }, kd = e => { if (e.key === 'Escape') { e.stopPropagation(); done('cancel'); } };
      o.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) done(b.dataset.v); else if (e.target === o) done('cancel'); });
      document.addEventListener('keydown', kd, true); document.body.appendChild(o); const f = o.querySelector('button.primary,button.success'); if (f) f.focus();
    });
  }
  /* ---- what each upload box holds, and how to remove it ---- */
  const K = {
    fileInput: { n: 'SharePoint uploader file', has: () => uploadState.lastFile && `${uploadState.lastFile.name} · ${uploadState.parsedRows.length} rows`, clear() { uploadState.parsedRows = []; uploadState.parsedHeaders = []; uploadState.lastFile = null; uploadState.groupByFields = []; const s = $i('fileSummary'); if (s) s.style.display = 'none'; const b = $i('navUploaderBadge'); if (b) b.textContent = ''; ['u_renderTargets', 'u_renderMappingTable', 'u_renderGroupControls', 'u_refreshUploadBtn'].forEach(f => call(window[f] || (() => { })));  } },
    wFileInput: { n: 'Warehouse file', has: () => warehouseState.lastFile && `${warehouseState.lastFile.name} · ${warehouseState.parsedRows.length} rows`, clear() { warehouseState.parsedRows = []; warehouseState.parsedHeaders = []; warehouseState.lastFile = null; warehouseState.groupByFields = []; const s = $i('wFileSummary'); if (s) s.style.display = 'none'; ['w_renderGroupControls', 'wFefoMap_render', 'wFefoMap_updateLookupGate'].forEach(f => call(window[f] || (() => { }))); } },
    wUomFileInput: { n: 'UOM file', has: () => wUomState.source === 'file' && wUomState.fileName && `${wUomState.fileName} · ${wUomState.rows.length} rows`, clear() { wUomState.rows = []; wUomState.headers = []; wUomState.fileName = ''; wUomState.source = ''; wUomState.table = new Map(); wUomState.version++; try { wFefoState.batchIndex = null; } catch (e) { } ['wUomSummary', 'wUomMapWrap'].forEach(i => { const e = $i(i); if (e) e.style.display = 'none'; }); } },
    wGRInput: { n: 'Good Return file', has: () => wGR.fileName && wGR.lines.length && `${wGR.fileName} · ${wGR.lines.length} lines`, clear() { $i('wGRClearBtn').click(); } },
    incUploadFileInput: { n: 'Incentive upload file', has: () => incUploadState.fileName && `${incUploadState.fileName} · ${incUploadState.parsedRows.length} rows`, clear() { $i('incUploadClearBtn').click(); } },
    plFile: { n: 'Planning data file', has: () => plUp.snap && `${plUp.snap.fileName || 'file'} · ${plUp.snap.rows.length} SKU rows (not saved yet)`, clear() { plUp.snap = null; plUpRender(); plUpStatus('File removed.', 'info'); } },
    dpFile: { n: 'Daily plan file', has: () => dpUp.snap && `${dpUp.snap.fileName || 'file'} · ${dpUp.snap.rows.length} SKU rows (not saved yet)`, clear() { dpUp.snap = null; dpUpRender(); dpUpStatus('File removed.', 'info'); } },
    mdpFileD: { n: 'Daily Sales Order files', has: () => { const n = Object.keys(mdp.data.demand || {}).length; return n && `${n} imported set(s)`; }, clear() { mdp.data.demand = {}; mdpSave(); mdpRender(); } },
    mdpFileG: { n: 'Good Return file', has: () => { const n = Object.keys(mdp.data.gr || {}).length; return n && `${n} imported set(s)`; }, clear() { mdp.data.gr = {}; mdpSave(); mdpRender(); } },
    atFile: { n: 'Attendance report', has: () => at.file && at.rows.length && `${at.file} · ${plF(at.rows.length)} records`, clear() { at.rows = []; at.file = ''; at.loaded = ''; at.f = {}; at.q = []; atSave(); if (typeof a2Bump === 'function') a2Bump(); atRefresh(); } },
    roFile: { n: 'Staff roster sheet', has: () => snaps.roFile && names.roFile && `${names.roFile} (restores the roster as it was before)`, clear() { Object.assign(ro, JSON.parse(snaps.roFile)); delete snaps.roFile; roSave(); roRender(); }, pre() { snaps.roFile = JSON.stringify({ staff: ro.staff, slots: ro.slots, days: ro.days, status: ro.status, date: ro.date, week: ro.week }); } },
    laFile: { n: 'List Analytics file', has: () => la.rows.length && `${la.name} · ${plF(la.rows.length)} rows`, clear() { la.rows = []; la.cols = []; try { localStorage.removeItem(LA_KEY); } catch (e) { } laRefresh(); } },
  };
  const NAMEONLY = { sbImpFile: 'Locations import', rkRFile: 'Rack register import' };
  const label = inp => (K[inp.id] && K[inp.id].n) || NAMEONLY[inp.id] || 'Excel file';

  async function ask(files, inp) {
    const k = K[inp.id], cur = k && call(k.has), L = files.map(f => `<li><b>${esc(f.name)}</b> · ${sz(f.size)}${f.lastModified ? ' · modified ' + new Date(f.lastModified).toLocaleDateString('en-GB') : ''}</li>`).join('');
    return modal('📤 Upload ' + esc(label(inp)) + '?', `You selected:<ul style="margin:6px 0 6px 18px;">${L}</ul>${cur ? `<div style="margin-top:6px;">Currently loaded: <b>${esc(cur)}</b> — it may be replaced or merged by this upload.</div>` : ''}<div style="margin-top:6px;">Nothing is read until you confirm.</div>`, [['cancel', 'Cancel'], ['again', 'Choose another file'], ['ok', '⬆ Upload', 'primary']]);
  }
  window.upConfirm = async function (files, what) {
    files = [...files]; if (!files.some(f => XL.test(f.name))) return true;
    const r = await modal('📤 Upload ' + esc(what || 'Excel file') + '?', `You selected:<ul style="margin:6px 0 6px 18px;">${files.map(f => `<li><b>${esc(f.name)}</b> · ${sz(f.size)}</li>`).join('')}</ul>Nothing is read until you confirm.`, [['cancel', 'Cancel'], ['ok', '⬆ Upload', 'primary']]); return r === 'ok';
  };
  document.addEventListener('change', async e => {
    const t = e.target; if (bypass || !t || t.type !== 'file' || !t.files || !t.files.length) return;
    const fs = [...t.files]; if (!fs.some(f => XL.test(f.name))) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const r = await ask(fs, t);
    if (r === 'ok') { const k = K[t.id]; if (k && k.pre) call(k.pre); names[t.id] = fs.map(f => f.name).join(', '); bypass = true; try { t.dispatchEvent(new Event('change', { bubbles: true })); } finally { bypass = false; } setTimeout(chips, 400); setTimeout(chips, 2500); }
    else { t.value = ''; if (r === 'again') t.click(); }
  }, true);
  document.addEventListener('drop', async e => {
    if (bypass) return; const dt = e.dataTransfer, tg = e.target; if (!dt || !dt.files || !dt.files.length || !tg.closest || !tg.closest('.dropzone')) return;
    const fs = [...dt.files]; if (!fs.some(f => XL.test(f.name))) return; e.stopImmediatePropagation(); e.preventDefault();
    const dz = tg.closest('.dropzone'), inp = dz.querySelector('input[type=file]') || (dz.parentElement && dz.parentElement.querySelector('input[type=file]')) || {}, r = await ask(fs, inp);
    if (r !== 'ok') { dz.classList.remove('drag', 'dragover'); if (r === 'again' && inp.click) inp.click(); return; }
    const k = K[inp.id]; if (k && k.pre) call(k.pre); if (inp.id) names[inp.id] = fs.map(f => f.name).join(', ');
    const d2 = new DataTransfer(); fs.forEach(f => d2.items.add(f)); bypass = true; try { tg.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: d2 })); } finally { bypass = false; } setTimeout(chips, 400); setTimeout(chips, 2500);
  }, true);

  /* ---- "currently loaded" chip with Remove next to each upload box ---- */
  function chips() {
    Object.keys(K).forEach(id => {
      const inp = $i(id); if (!inp) return; const h = call(K[id].has), cid = 'upchip_' + id; let c = $i(cid);
      if (!h) { if (c) c.remove(); return; }
      if (!c) { c = document.createElement('div'); c.id = cid; c.className = 'status-msg ok'; c.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;'; const dz = inp.closest('.dropzone') || (inp.parentElement && inp.parentElement.querySelector('.dropzone')); if (dz && dz.parentElement) dz.insertAdjacentElement('afterend', c); else inp.parentElement.appendChild(c);
        c.addEventListener('click', async ev => { if (!ev.target.closest('button')) return; const info = call(K[id].has); if (!info) return; const r = await modal('🗑 Remove ' + esc(K[id].n) + '?', `<b>${esc(info)}</b><br>The data loaded from this file will be removed from the app. You can upload it again at any time.`, [['cancel', 'Keep it'], ['ok', '🗑 Remove file', 'danger']]); if (r === 'ok') { call(K[id].clear.bind(K[id])); delete names[id]; chips(); if (typeof sectionToast === 'function') sectionToast(K[id].n + ' removed.', 'success'); } }); }
      const html = `📎 <span><b>${esc(K[id].n)}:</b> ${esc(h)}</span> <button type="button" class="ghost small" style="margin-left:auto;">🗑 Remove file</button>`; if (c.dataset.h !== html) { c.dataset.h = html; c.innerHTML = html; }
    });
  }
  window.upChips = chips; window.upK = K; setInterval(() => { try { chips(); } catch (e) { console.error("[upguard] " + e.message); } }, 1500); setTimeout(chips, 800);
})();


try{visInit({pre:'la',view:'listan',grid:'#laGrid',kpis:'#laKpis',table:'#laTableCard',redraw:()=>laRedrawAll()});visInit({pre:'pl',view:'planning',grid:'#plGrid',kpis:'#plKpis',table:'#plTableCard',redraw:()=>plRedrawAll()});visInit({pre:'dp',view:'dailyplan',grid:'#dpGrid',kpis:'#dpKpis',table:'#dpTableCard',redraw:()=>dpRedrawAll()});}catch(e){console.error(e)}
try{ const rz = () => setTimeout(() => window.dispatchEvent(new Event('resize')), 50); [['at', 'att', '#atGrid'], ['cm', 'att', '#cmGrid'], ['a2', 'att', '#a2Grid'], ['st', 'att', '#stGrid'], ['ty', 'att', '#tyGrid'], ['lk', 'att', '#lkGrid'], ['dtk', 'dailytracker', '#dtkGrid']].forEach(x => { try { visInit({ pre: x[0], view: x[1], grid: x[2], redraw: rz }); } catch (e) { console.error(e); } }); }catch(e){console.error(e)}

/* phone layout: open / close the side menu */
(function () { const bd = () => document.body, close = () => bd().classList.remove('m-nav-open');
  document.addEventListener('click', e => { if (e.target.closest('#mMenuBtn')) { bd().classList.toggle('m-nav-open'); return; } if (e.target.closest('#mBackdrop')) { close(); return; } if (innerWidth <= 820 && e.target.closest('.sidebar .nav-item')) setTimeout(close, 60); });
  window.addEventListener('resize', () => { if (innerWidth > 820) close(); }); })();
