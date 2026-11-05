/* ---- Mapping sample check: next to every mapping table, show sample values of the source side and of the mapped SharePoint column, to verify the link ---- */
(function () {
  const E = escapeHtml, cache = new Map(), LSK = k => LS_BASE + '_ms_' + k;
  const css = document.createElement('style'); css.textContent = '.ms-bar{display:flex;align-items:center;gap:8px;margin:0 0 6px;flex-wrap:wrap}.ms-bar .ms-t.on{background:var(--acc-soft,#eaf0fb);border-color:var(--acc-2,#2563eb);color:var(--acc-2,#2563eb);font-weight:700}.ms-x{font-size:12px;min-width:170px;vertical-align:middle}.ms-chip{display:inline-block;padding:1px 8px;margin:1px 4px 1px 0;border-radius:999px;background:var(--acc-soft,#eaf0fb);border:1px solid var(--acc-line,#c9d7f0);font-size:11.5px;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle}.ms-chip.l{background:var(--brand-light,#e6f5ec);border-color:#b8dfc7}.ms-dim{color:var(--gray-400,#94a3b8);font-style:italic}.ms-ok{color:#0b7a0b;font-weight:700;margin-left:4px}.ms-bad{color:#b45309;font-weight:700;margin-left:4px}';
  document.head.appendChild(css);
  const fmt = v => { if (v == null || v === '') return ''; if (Array.isArray(v)) return v.map(fmt).filter(Boolean).join(', '); if (typeof v === 'object') return String(v.LookupValue || v.Email || v.Title || v.Label || v.Url || v.Description || ''); return String(v); };
  const uniq = (arr, n = 4) => { const seen = new Set(), out = []; for (const x of arr) { const t = String(x == null ? '' : x).trim(); if (!t || seen.has(t.toLowerCase())) continue; seen.add(t.toLowerCase()); out.push(t); if (out.length >= n) break; } return out; };
  const chips = (a, c) => a.map(t => `<span class="ms-chip ${c || ''}" title="${E(t)}">${E(t)}</span>`).join('');
  /* source side: the app's own data behind each mapped field (by table) */
  const SRC = [
    ['.a2e-map', 'Attendance file', (tr, i) => { const k = (typeof A2E_FIELDS !== 'undefined' && A2E_FIELDS[i] || {}).key; if (!at.rows.length) return { note: 'upload the attendance file' }; const f = { id: r => r.id, wh: r => a2Store(r), name: r => r.name }[k]; return f ? uniq(at.rows.map(f)) : null; }],
    ['#dpLstMapBody', 'Daily plan rows', (tr, i) => { const s = dpLstSnap(), k = (DP_LST_FIELDS[i] || {}).key; if (!s) return { note: 'choose a plan first' }; const rows = dpLstRows(s, (document.querySelector('#dpLstDay') || {}).value || '').slice(0, 60); return k && rows.length ? uniq(rows.map(r => r[k])) : null; }],
    ['#fdUpMapBody', 'F&D rows', (tr, i) => { const k = (FD_FIELDS[i] || {}).key, rows = fdUpRows().slice(0, 60); return k && rows.length ? uniq(rows.map(r => r[k])) : { note: 'no F&D rows yet' }; }],
    ['#lpMapBody', 'Trip plan', (tr, i) => { const k = (LP_FIELDS[i] || {}).key, rows = lp.rows.filter(r => !r.auto).slice(0, 60); return k && rows.length ? uniq(rows.map(r => r[k])) : { note: 'no trips in the plan' }; }]
  ];
  const srcOf = tb => SRC.find(x => tb.matches(x[0]));
  function listNameFor(tb) { const table = tb.closest('table'); for (let el = table.parentElement; el && el !== document.body; el = el.parentElement) { const ps = [...el.querySelectorAll('.list-picker-input')]; if (ps.length) { const c = ps.filter(p => p.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING); return ((c.length ? c[c.length - 1] : ps[0]).value || '').trim(); } } return ''; }
  async function itemsOf(name, force) { const c = cache.get(name); if (c && !force && Date.now() - c.t < 120000) return c.items; const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('Configure the global Site URL and sign-in first.'); const ids = await resolveIds(site, name, token), items = await fetchRecentItems(ids.siteId, ids.listId, token, 60); cache.set(name, { t: Date.now(), items }); return items; }
  const isNum = a => a.length && a.every(x => /^-?[\d,.]+$/.test(x));
  async function apply(tb, force) {
    const bar = tb._ms, on = bar.querySelector('.ms-t').classList.contains('on'), st = bar.querySelector('.ms-s'), table = tb.closest('table');
    table.querySelectorAll('.ms-x').forEach(x => x.remove()); if (!on) { st.textContent = ''; return; }
    const name = listNameFor(tb); if (!name) { st.textContent = '⚠ pick the list above first'; return; }
    const sp = srcOf(tb); let items; st.textContent = 'Loading sample rows of "' + name + '"…';
    try { items = await itemsOf(name, force); } catch (e) { st.textContent = '✘ ' + e.message; return; }
    st.textContent = '✓ ' + items.length + ' recent row(s) of "' + name + '"' + (sp ? ' · source: ' + sp[1] : '');
    table.querySelectorAll('.ms-x').forEach(x => x.remove());
    const hr = table.querySelector('thead tr'); if (hr) { if (sp) hr.insertAdjacentHTML('beforeend', '<th class="ms-x">Sample — ' + E(sp[1]) + '</th>'); hr.insertAdjacentHTML('beforeend', '<th class="ms-x">Sample — in the list column</th>'); }
    [...tb.children].forEach((tr, i) => { const cb = tr.querySelector('.combo'); if (!cb) return; const col = cb.dataset.col || '';
      let src = null, sv = null; if (sp) { try { sv = sp[2](tr, i); } catch (e) { sv = { note: 'n/a' }; } }
      const ls = col ? uniq(items.map(it => { const f = it.fields || {}; let v = fmt(f[col]); if (!v && f[col + 'LookupId'] != null) v = 'ID ' + f[col + 'LookupId']; return v; })) : [];
      let verdict = ''; if (Array.isArray(sv) && sv.length && ls.length) { const norm = x => x.toLowerCase().replace(/\s+/g, ''), set = new Set(ls.map(norm)); verdict = isNum(sv) !== isNum(ls) ? '<span class="ms-bad" title="One side looks numeric, the other text">⚠ type differs</span>' : sv.some(x => set.has(norm(x))) ? '<span class="ms-ok" title="A sample value of the source is found in the list column">✔ match</span>' : ''; }
      if (sp) tr.insertAdjacentHTML('beforeend', '<td class="ms-x">' + (Array.isArray(sv) ? (sv.length ? chips(sv) : '<span class="ms-dim">— empty —</span>') : sv && sv.note ? '<span class="ms-dim">' + E(sv.note) + '</span>' : '<span class="ms-dim">— not in the data —</span>') + '</td>');
      tr.insertAdjacentHTML('beforeend', '<td class="ms-x">' + (col ? (ls.length ? chips(ls, 'l') + verdict : '<span class="ms-dim">— empty in the last ' + items.length + ' rows —</span>') : '<span class="ms-dim">not mapped</span>') + '</td>'); });
  }
  function attach(tb) {
    if (tb._ms) return; const table = tb.closest('table'); if (!table) return; const key = (tb.id || tb.className || 'tb') + '_' + (table.id || ''), bar = document.createElement('div'); bar.className = 'ms-bar';
    bar.innerHTML = '<button type="button" class="ghost small ms-t" title="Show sample values from both sides of the mapping to verify the link">🔎 Sample check</button><button type="button" class="ghost small ms-r" title="Reload the sample rows from SharePoint">🔄</button><span class="text-sm ms-s"></span>';
    const w = table.closest('.table-wrap,.fd-wrap') || table; w.parentNode.insertBefore(bar, w); tb._ms = bar;
    const on = (() => { try { return localStorage.getItem(LSK(key)) === '1'; } catch (e) { return false; } })(); bar.querySelector('.ms-t').classList.toggle('on', on);
    bar.querySelector('.ms-t').addEventListener('click', e => { const b = e.currentTarget, v = !b.classList.contains('on'); b.classList.toggle('on', v); try { localStorage.setItem(LSK(key), v ? '1' : '0'); } catch (_) {} apply(tb); });
    bar.querySelector('.ms-r').addEventListener('click', () => { if (bar.querySelector('.ms-t').classList.contains('on')) apply(tb, true); });
    let t = null; const again = () => { clearTimeout(t); t = setTimeout(() => apply(tb), 200); };
    new MutationObserver(again).observe(tb, { childList: true }); tb.addEventListener('combochange', again); if (on) again();
  }
  const scan = () => document.querySelectorAll('td.combo-cell').forEach(td => { const tb = td.closest('tbody'); if (tb) attach(tb); });
  let st = null; const content = document.querySelector('.content'); if (content) new MutationObserver(() => { clearTimeout(st); st = setTimeout(scan, 400); }).observe(content, { childList: true, subtree: true }); setTimeout(scan, 600); window.msScan = scan;
})();
/* ---- Arrange blocks: the user can re-order the blocks of any page (drag or ▲▼), the order is remembered ---- */
(function () {
  const SEL = '.card,.lp-grp', OK = LS_BASE + '_ord_', SK = '[id$="Modal"],#tblExpandOverlay,.fd-modal,.mdl-box,[data-mdl],.pl-card,.pl-grid';
  const ls = { g: k => { try { return JSON.parse(localStorage.getItem(OK + k) || 'null'); } catch (e) { return null; } }, s: (k, v) => { try { v ? localStorage.setItem(OK + k, JSON.stringify(v)) : localStorage.removeItem(OK + k); } catch (e) {} } };
  const tx = el => ((el.querySelector('.card-title,h3,h2,b') || el).textContent || '').trim().replace(/[\d,.()%]+/g, '').replace(/\s+/g, ' ').slice(0, 32) || 'block';
  const bk1 = el => el.id || tx(el), bkey = (el, seen) => { const k = bk1(el), n = seen[k] = (seen[k] || 0) + 1; return n > 1 ? k + '#' + n : k; };
  const blocks = p => [...p.children].filter(c => c.matches(SEL) && !(p.closest(SK)));
  const keys = p => { const seen = {}; return blocks(p).map(c => bkey(c, seen)); };
  const groups = view => { const ps = new Set(); view.querySelectorAll(SEL).forEach(c => { const p = c.parentElement; if (p && !p.closest(SK) && !p.closest('.mdl-box,[data-mdl]')) ps.add(p); }); return [...ps].filter(p => blocks(p).length >= 2).map(p => { const own = p.closest(SEL), key = view.id + '/' + (p === view ? 'root' : (p.id || ((own && own !== p ? bk1(own) : '') + '>' + (String(p.className).split(' ')[0] || p.tagName)))); return { p, key }; }); };
  const orig = {};
  function reorder(p, order) { const bl = blocks(p), seen = {}, ks = bl.map(c => bkey(c, seen)), idx = k => { const i = order.indexOf(k); return i < 0 ? 1e6 + ks.indexOf(k) : i; }, sorted = bl.map((c, i) => [c, idx(ks[i])]).sort((a, b) => a[1] - b[1]).map(x => x[0]); if (sorted.every((c, i) => c === bl[i])) return; const ph = bl.map(c => { const m = document.createComment(''); p.insertBefore(m, c); return m; }); bl.forEach(c => c.remove()); sorted.forEach((c, i) => { p.insertBefore(c, ph[i]); ph[i].remove(); }); }
  function applyAll() { document.querySelectorAll('.view').forEach(v => groups(v).forEach(({ p, key }) => { if (!orig[key]) orig[key] = keys(p); const sv = ls.g(key); if (sv) reorder(p, sv); })); if (on) refresh(); }
  let on = false, drag = null; const layer = document.createElement('div'); layer.id = 'arrLayer'; document.body.appendChild(layer);
  const css = document.createElement('style'); css.textContent = '#arrLayer{position:fixed;inset:0;pointer-events:none;z-index:60}.arr-p{position:fixed;pointer-events:auto;display:flex;gap:2px;background:var(--acc-grad,#2563eb);color:#fff;border-radius:999px;padding:2px 4px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.3);transform:translateX(-50%);user-select:none}.arr-p span{padding:2px 8px;cursor:pointer;border-radius:999px}.arr-p span:hover{background:rgba(255,255,255,.25)}.arr-p [data-drag]{cursor:grab}body.arr-on [data-arr]{outline:2px dashed var(--acc-2,#2563eb);outline-offset:3px}body.arr-on [data-arr].arr-drag{opacity:.45}#arrBar{display:none;position:sticky;top:0;z-index:70;margin:0 0 12px;padding:10px 14px;border-radius:12px;background:var(--acc-soft,#eaf0fb);border:1px solid var(--acc-line,#c9d7f0);align-items:center;gap:10px;flex-wrap:wrap;font-size:13px}body.arr-on #arrBar{display:flex}#arrBar .sp{margin-left:auto;display:flex;gap:6px}';
  document.head.appendChild(css);
  const content = document.querySelector('.content'), bar = document.createElement('div'); bar.id = 'arrBar'; bar.innerHTML = '<b>↕ Arrange blocks</b><span>drag the <b>⠿ Drag</b> handle of a block (or use ▲ ▼) — the order is saved on this computer</span><span class="sp"><button type="button" class="ghost small" data-r>↺ Reset this page</button><button type="button" class="small" data-d>✓ Done</button></span>'; if (content) content.insertBefore(bar, content.firstChild);
  const actv = () => document.querySelector('.view.active');
  function refresh() { if (drag) { place(); return; } layer.innerHTML = ''; document.querySelectorAll('[data-arr]').forEach(e => e.removeAttribute('data-arr')); if (!on) return; const v = actv(); if (!v) return; groups(v).forEach(({ p, key }) => blocks(p).forEach(b => { b.setAttribute('data-arr', '1'); const r = b.getBoundingClientRect(); if (r.width < 40 || r.height < 20) return; const pl = document.createElement('div'); pl.className = 'arr-p'; pl.innerHTML = '<span data-up title="Move up">▲</span><span data-drag draggable="true" title="Drag to a new position">⠿ Drag</span><span data-dn title="Move down">▼</span>'; pl._b = b; pl._k = key; pl._p = p; layer.appendChild(pl); })); place(); }
  function place() { layer.querySelectorAll('.arr-p').forEach(pl => { const r = pl._b.getBoundingClientRect(); pl.style.display = r.bottom < 80 || r.top > innerHeight - 24 ? 'none' : ''; pl.style.left = (r.left + r.width / 2) + 'px'; pl.style.top = Math.max(r.top + 6, 76) + 'px'; }); }
  const save = (p, key) => { ls.s(key, keys(p)); };
  layer.addEventListener('click', e => { const pl = e.target.closest('.arr-p'); if (!pl) return; const up = e.target.closest('[data-up]'), dn = e.target.closest('[data-dn]'); if (!up && !dn) return; const b = pl._b, bl = blocks(pl._p), i = bl.indexOf(b); if (up && i > 0) pl._p.insertBefore(b, bl[i - 1]); else if (dn && i < bl.length - 1) pl._p.insertBefore(bl[i + 1], b); else return; save(pl._p, pl._k); refresh(); try { b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {} });
  layer.addEventListener('dragstart', e => { const pl = e.target.closest('.arr-p'); if (!pl || !e.target.closest('[data-drag]')) { e.preventDefault(); return; } drag = pl; pl._b.classList.add('arr-drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'block'); } catch (_) {} });
  document.addEventListener('dragover', e => { if (!drag) return; let t = e.target; while (t && t !== document.body && !(t.getAttribute && t.getAttribute('data-arr') && t.parentElement === drag._p)) t = t.parentElement; if (!t || t === document.body || t === drag._b) return; e.preventDefault(); const r = t.getBoundingClientRect(), d = drag._b.getBoundingClientRect(), row = Math.abs(r.top - d.top) < 8, before = row ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2; if (before) { if (t.previousElementSibling !== drag._b) drag._p.insertBefore(drag._b, t); } else if (t.nextElementSibling !== drag._b) drag._p.insertBefore(drag._b, t.nextSibling); });
  document.addEventListener('drop', e => { if (drag) e.preventDefault(); });
  document.addEventListener('dragend', () => { if (!drag) return; drag._b.classList.remove('arr-drag'); save(drag._p, drag._k); drag = null; refresh(); });
  const setOn = v => { on = v; document.body.classList.toggle('arr-on', on); const bt = document.querySelector('#arrBtn'); if (bt) bt.textContent = on ? '✓ Done' : '↕ Arrange'; refresh(); };
  bar.addEventListener('click', e => { if (e.target.closest('[data-d]')) setOn(false); else if (e.target.closest('[data-r]')) { const v = actv(); if (!v) return; groups(v).forEach(({ p, key }) => { if (orig[key]) reorder(p, orig[key]); ls.s(key, null); }); refresh(); try { sectionToast('↺ Original order restored for this page.', 'success'); } catch (_) {} } });
  const acts = document.querySelector('.topbar-actions'); if (acts) { const bt = document.createElement('button'); bt.type = 'button'; bt.id = 'arrBtn'; bt.className = 'icon-btn'; bt.style.cssText = 'width:auto;padding:0 10px;font-size:13px;'; bt.title = 'Re-arrange the blocks of this page'; bt.textContent = '↕ Arrange'; bt.addEventListener('click', () => setOn(!on)); acts.insertBefore(bt, acts.firstChild.nextSibling || null); }
  window.addEventListener('scroll', () => { if (on) place(); }, true); window.addEventListener('resize', () => { if (on) place(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && on && !drag) setOn(false); });
  document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', () => setTimeout(() => { applyAll(); if (on) refresh(); }, 250)));
  let t = null; if (content) new MutationObserver(() => { clearTimeout(t); t = setTimeout(applyAll, 500); }).observe(content, { childList: true, subtree: true });
  setTimeout(applyAll, 400);
  window.arrApply = applyAll;
})();
/* ---- Data Editor: choose which data is shown on each record card (and search in it) ---- */
(function () {
  const hd = document.querySelector('#editorTab-edit .editor-panel-header'), body = document.querySelector('#editorTab-edit .editor-panel-body'), search = $('editorSearch'); if (!hd || !body || !search) return;
  const css = document.createElement('style'); css.textContent = '.ed-cardbtn{margin-left:auto;margin-right:6px}#editorRecordsList mark{background:#fde68a;padding:0 1px;border-radius:3px}#editorRecordsList .record-sub{white-space:normal;line-height:1.35}.ed-stick{position:sticky;top:-8px;z-index:5;background:var(--card,#fff);margin:-8px -8px 8px;padding:8px 8px 4px;max-height:62vh;overflow:auto;box-shadow:0 6px 8px -8px rgba(15,23,42,.35)}.ed-stick #editorSearch{margin-bottom:6px !important}.ed-cardp{border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:10px;margin-bottom:8px;background:var(--gray-50,#f8fafc);display:none}.ed-cardp.open{display:block}.ed-cardp .ed-cr{display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:12px;font-weight:600}.ed-cardp .ed-cr select{flex:1;height:32px;margin:0}.ed-cardp .ed-cf{max-height:190px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;margin:6px 0}.ed-cardp label.ed-ci{display:flex;gap:6px;align-items:center;font-size:12.5px;margin:0;font-weight:500;cursor:pointer}.ed-cardp label.ed-ci input{width:auto;margin:0}';
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ghost small ed-cardbtn'; btn.textContent = '🗂 Card data'; btn.title = 'Choose which data is shown on each record card and where the search looks';
  const rl = $('editorReloadRecordsBtn'); rl.parentNode.insertBefore(btn, rl);
  const pn = document.createElement('div'); pn.className = 'ed-cardp'; const stk = document.createElement('div'); stk.className = 'ed-stick'; search.parentNode.insertBefore(stk, search); stk.appendChild(search); stk.appendChild(pn);
  const draw = () => { const cc = ed_cardCfg(), cols = editorState.columns.filter(c => c.name && c.name[0] !== '@'), sel = new Set(cc.fields || []), opt = (v, t, cur) => `<option value="${escapeHtml(v)}" ${cur === v ? 'selected' : ''}>${escapeHtml(t)}</option>`;
    pn.innerHTML = `<div class="ed-cr">Card title <select data-k="title">${opt('', '(Title – automatic)', cc.title || '')}${cols.map(c => opt(c.name, c.displayName || c.name, cc.title || '')).join('')}</select></div><div class="ed-cr">Search in <select data-k="scope"><option value="" ${cc.only ? '' : 'selected'}>All fields</option>${cc.fields && cc.fields.length ? `<option value="" data-only="1" ${cc.only && !cc.scope ? 'selected' : ''}>Only the fields shown on the card</option>` : ''}${opt('@id', 'Record ID', cc.scope || '')}${cols.map(c => opt(c.name, c.displayName || c.name, cc.scope || '')).join('')}</select></div><div class="text-sm" style="font-weight:600">Show on the card:</div><div class="ed-cf">${cols.map(c => `<label class="ed-ci"><input type="checkbox" data-f="${escapeHtml(c.name)}" ${sel.has(c.name) ? 'checked' : ''}> ${escapeHtml(c.displayName || c.name)}</label>`).join('')}</div><div class="btn-row"><button type="button" class="ghost small" data-q="all">Show all</button><button type="button" class="ghost small" data-q="none">Hide all</button><button type="button" class="ghost small" data-q="def">Default</button></div>`; };
  btn.addEventListener('click', () => { pn.classList.toggle('open'); if (pn.classList.contains('open')) draw(); });
  pn.addEventListener('change', e => { const cc = ed_cardCfg(), t = e.target; if (t.dataset.f) { const set = new Set(cc.fields || []); t.checked ? set.add(t.dataset.f) : set.delete(t.dataset.f); cc.fields = editorState.columns.map(c => c.name).filter(n => set.has(n)); if (!cc.fields.length) { cc.fields = null; cc.only = false; } } else if (t.dataset.k === 'title') cc.title = t.value; else if (t.dataset.k === 'scope') { cc.scope = t.value; cc.only = !!t.selectedOptions[0].dataset.only; } ed_cardSave(cc); ed_renderRecordsList(); if (t.dataset.f) draw(); });
  pn.addEventListener('click', e => { const q = e.target.dataset && e.target.dataset.q; if (!q) return; const cc = ed_cardCfg(); if (q === 'all') cc.fields = editorState.columns.filter(c => c.name[0] !== '@').map(c => c.name); else { cc.fields = null; cc.only = false; if (q === 'def') { cc.title = ''; cc.scope = ''; } } ed_cardSave(cc); ed_renderRecordsList(); draw(); });
})();
/* ---- Data Editor: fast data entry (keyboard flow, keep values, same-as-last, required highlighting, 2-column pop-up) ---- */
(function () {
  const KEEP = LS_BASE + '_ed_keep', PN = '#editorTab-add', st = { n: 0, last: null, keepNow: false };
  const lsG = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const card = document.querySelector(PN + ' .card'), form = $('editorCreateForm'); if (!card || !form) return;
  const bar = document.createElement('div'); bar.className = 'ed-fast';
  bar.innerHTML = '<label class="ed-chk"><input type="checkbox" id="edKeep" style="width:auto"> Keep the values after Create <span class="hint">(fast repeated entry — change only what differs)</span></label><button type="button" class="ghost small" id="edSameLast" disabled title="Fill the form with the values of the record you created last">↺ Same as last</button><span class="text-sm" id="edCnt" style="margin-left:auto"></span><span class="text-sm ed-keys">Enter = next field · Ctrl+Enter = Create</span>';
  form.parentNode.insertBefore(bar, form); $('edKeep').checked = lsG(KEEP) === '1'; $('edKeep').addEventListener('change', e => lsS(KEEP, e.target.checked ? '1' : '0'));
  const css = document.createElement('style'); css.textContent = '.ed-fast{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:8px 10px;margin:0 0 10px;background:var(--gray-50,#f8fafc);border:1px solid var(--gray-200,#e2e8f0);border-radius:10px}.ed-chk{display:inline-flex;gap:6px;align-items:center;font-weight:600;margin:0}.ed-keys{opacity:.7}.ed-bad{border-color:#dc2626 !important;background:#fef2f2 !important;box-shadow:0 0 0 2px rgba(220,38,38,.18)}.ed-pop #editorCreateForm .form-grid.full,.ed-full #editorCreateForm .form-grid.full{grid-template-columns:repeat(auto-fit,minmax(300px,1fr));column-gap:18px}';
  document.head.appendChild(css);
  const cols = () => { try { return ed_saveColumns(); } catch (e) { return []; } }, el = (c, pre) => document.getElementById('ed_field_' + (pre || 'create_') + c.name);
  const snap = () => { const o = {}; cols().forEach(c => { const e = el(c); if (e) o[c.name] = c.type === 'boolean' ? e.checked : e.value; }); return o; };
  const fill = o => { cols().forEach(c => { const e = el(c); if (e && o && c.name in o) { if (c.type === 'boolean') e.checked = !!o[c.name]; else e.value = o[c.name]; } }); };
  const focus1 = () => { const e = [...form.querySelectorAll('input:not([type=checkbox]):not([disabled]):not([readonly]),select:not([disabled]),textarea:not([disabled])')].find(x => x.offsetParent); if (e) { e.focus(); try { e.select && e.select(); } catch (_) {} } };
  /* validation highlight + remember values (before the original handler runs) */
  $('editorCreateBtn').addEventListener('click', () => { st.keepNow = $('edKeep').checked; st.pending = snap(); let first = null; cols().forEach(c => { const e = el(c); if (!e) return; const v = c.type === 'boolean' ? true : String(e.value || '').trim(), bad = c.required && v === ''; e.classList.toggle('ed-bad', bad); if (bad && !first) first = e; }); if (first) first.focus(); }, true);
  $('editorClearFormBtn').addEventListener('click', () => { st.keepNow = false; }, true);
  form.addEventListener('input', e => e.target.classList && e.target.classList.remove('ed-bad'));
  $('edSameLast').addEventListener('click', () => { if (st.last) { fill(st.last); focus1(); } });
  /* after a form re-render: keep values or start clean, then jump to the first field */
  const r0 = ed_renderCreateForm; ed_renderCreateForm = function () { const keep = st.keepNow ? st.pending : null; st.keepNow = false; const r = r0.apply(this, arguments); if (keep) fill(keep); setTimeout(focus1, 30); return r; };
  const h0 = ed_addHistory; ed_addHistory = function (t) { if (t === 'create') { st.n++; st.last = st.pending || st.last; $('edSameLast').disabled = !st.last; $('edCnt').textContent = '✅ ' + st.n + ' created in this session'; } return h0.apply(this, arguments); };
  /* keyboard: Enter → next field, Ctrl+Enter → Create, Ctrl+S → Save (Edit screen) ; focusing a field selects its value */
  const nextField = t => { const all = [...t.closest('.editor-tab-panel').querySelectorAll('input:not([type=checkbox]):not([type=hidden]):not([disabled]):not([readonly]),select:not([disabled]),textarea:not([disabled])')].filter(x => x.offsetParent && !x.closest('.ed-pbar,.ed-fast,#editorSearch')), i = all.indexOf(t); return all[i + 1] || null; };
  document.addEventListener('keydown', e => { const t = e.target, p = t.closest && t.closest('#editorTab-add,#editorTab-edit'); if (!p) return; const add = p.id === 'editorTab-add';
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && add) { e.preventDefault(); $('editorCreateBtn').click(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && !add) { e.preventDefault(); $('editorSaveBtn').click(); return; }
    if (e.key === 'Enter' && !e.shiftKey && t.tagName === 'INPUT' && !['checkbox', 'button'].includes(t.type) && t.id !== 'editorSearch' && !t.closest('.ed-dd,.sg-pop,[role=listbox]')) { const n = nextField(t); if (n) { e.preventDefault(); n.focus(); try { n.select && n.select(); } catch (_) {} } else if (add) { e.preventDefault(); $('editorCreateBtn').click(); } } });
  document.addEventListener('focusin', e => { const t = e.target; if (t.tagName === 'INPUT' && ['text', 'number'].includes(t.type) && t.closest('#editorCreateForm,#editorEditForm')) setTimeout(() => { try { t.select(); } catch (_) {} }, 0); });
  document.querySelector('.editor-tab[data-tab="add"]').addEventListener('click', () => setTimeout(focus1, 60));
})();
async function ed_reloadItems() {
  const d = editorState.dl;
  if (!getGlobalAccessToken() || d.running) return;
  if (d.kind === 'search') return ed_quickSearch();
  if (d.kind === 'recent') return ed_loadRecent();
  if (d.kind === 'all') return ed_startDownload();
  ed_setStatus('Nothing downloaded yet — use Download all, Latest rows or Search in the toolbar.', 'info');
}
$('editorReloadRecordsBtn').addEventListener('click', ed_reloadItems);
const ed_cardKey = () => LS_BASE + '_ed_card_' + (editorState.listId || '');
function ed_cardCfg() { try { return JSON.parse(localStorage.getItem(ed_cardKey()) || '{}') || {}; } catch (e) { return {}; } }
function ed_cardSave(c) { try { localStorage.setItem(ed_cardKey(), JSON.stringify(c)); } catch (e) {} }
function ed_renderRecordsList() {
  const c = $('editorRecordsList');
  if (!c) return;
  if (!editorState.items.length) { c.innerHTML = '<p class="text-sm" style="padding:10px;">No records loaded. Click 🔄 to refresh.</p>'; return; }
  const q = ($('editorSearch').value || '').trim().toLowerCase();
  const cc = ed_cardCfg(), shownF = cc.fields && cc.fields.length ? cc.fields : null;
  const filtered = !q ? editorState.items : editorState.items.filter(it => {
    if (cc.scope === '@id') return String(it.id).includes(q);
    if (cc.scope) return String((it.fields || {})[cc.scope] ?? '').toLowerCase().includes(q);
    if (!cc.scope && cc.only && shownF) return shownF.some(k => String((it.fields || {})[k] ?? '').toLowerCase().includes(q)) || String(it.id).includes(q);
    const title = (it.fields?.Title || '').toString().toLowerCase();
    if (title.includes(q)) return true;
    if (String(it.id).includes(q)) return true;
    return Object.values(it.fields || {}).some(v => String(v).toLowerCase().includes(q));
  });
  if (!filtered.length) { c.innerHTML = '<p class="text-sm" style="padding:10px;">No matching records.</p>'; return; }
  c.innerHTML = filtered.slice(0, 500).map(it => {
    const title = (cc.title && it.fields?.[cc.title] != null && it.fields[cc.title] !== '' ? it.fields[cc.title] : null) || it.fields?.Title || it.fields?.LinkTitle || `Item #${it.id}`;
    const hl = t => { t = escapeHtml(String(t)); if (!q) return t; const i = t.toLowerCase().indexOf(escapeHtml(q).toLowerCase()); return i < 0 ? t : t.slice(0, i) + '<mark>' + t.slice(i, i + escapeHtml(q).length) + '</mark>' + t.slice(i + escapeHtml(q).length); };
    if (shownF) { const lab = k => (editorState.columns.find(c => c.name === k) || {}).displayName || k; const lines = shownF.filter(k => k !== cc.title).map(k => { const v = it.fields?.[k]; return `<div class="record-sub"><b>${escapeHtml(lab(k))}</b>: ${v == null || v === '' ? '<i>—</i>' : hl(truncate(v, 60))}</div>`; }).join(''); const sel2 = String(it.id) === String(editorState.selectedItemId) ? ' selected' : ''; return `<div class="record-item${sel2}" data-id="${it.id}" role="button" tabindex="0"><div class="record-title">${hl(title)}</div>${lines}<div class="record-id">ID: ${it.id}</div></div>`; }
    const sub = Object.entries(it.fields || {}).filter(([k, v]) => k[0] !== '@' && k !== 'Title' && k !== 'LinkTitle' && k !== 'ID' && v != null && v !== '').slice(0, 2).map(([k, v]) => `${k}: ${truncate(v, 20)}`).join(' · ');
    const sel = String(it.id) === String(editorState.selectedItemId) ? ' selected' : '';
    return `<div class="record-item${sel}" data-id="${it.id}" role="button" tabindex="0">
      <div class="record-title">${escapeHtml(String(title))}</div>
      <div class="record-sub">${escapeHtml(sub)}</div>
      <div class="record-id">ID: ${it.id}</div>
    </div>`;
  }).join('');
  try { const it = editorState.items.find(x => String(x.id) === String(editorState.selectedItemId)), t = $('editorEditTitle'); if (it && t && /^Editing #/.test(t.textContent)) t.textContent = ed_editTitle(it); } catch (e) {}
}
(function attachRecordListDelegation() {
  const c = $('editorRecordsList');
  if (!c) return;
  const handleSelect = (e) => {
    const itemEl = e.target.closest('.record-item');
    if (!itemEl) return;
    const rawId = itemEl.dataset.id;
    const found = editorState.items.find(x => String(x.id) === String(rawId));
    if (found) ed_selectRecord(found);
  };
  c.addEventListener('click', handleSelect);
  c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(e); } });
})();
$('editorSearch').addEventListener('input', ed_renderRecordsList);
function ed_selectRecord(item) {
  editorState.selectedItemId = item.id;
  ed_renderRecordsList();
  ed_renderEditForm(item);
  $('editorJsonTextarea').disabled = !hasPerm('editor-json') || !editorState.canEditThisList;
  $('editorJsonTextarea').value = JSON.stringify(item.fields, null, 2);
  $('editorJsonTargetId').textContent = `#${item.id}`;
  $('editorJsonSaveBtn').disabled = !hasPerm('editor-json') || !editorState.canEditThisList;
  try { window.edSubRefresh && window.edSubRefresh(item); } catch (e) { console.error(e); }
}
function ed_editTitle(item) {
  const cc = ed_cardCfg(), shownF = cc.fields && cc.fields.length ? cc.fields : null, f = item.fields || {}, lab = k => (editorState.columns.find(c => c.name === k) || {}).displayName || k, tx = v => truncate(typeof v === 'object' && v ? (v.Value ?? v.LookupValue ?? JSON.stringify(v)) : v, 40);
  const title = (cc.title && f[cc.title] != null && f[cc.title] !== '' ? f[cc.title] : null) || f.Title || f.LinkTitle || '';
  const parts = shownF ? shownF.filter(k => k !== cc.title && f[k] != null && f[k] !== '').map(k => `${lab(k)}: ${tx(f[k])}`) : Object.entries(f).filter(([k, v]) => k[0] !== '@' && k !== 'Title' && k !== 'LinkTitle' && k !== 'ID' && v != null && v !== '').slice(0, 2).map(([k, v]) => `${k}: ${tx(v)}`);
  return [`Editing #${item.id}`, title ? String(title) : '', ...parts].filter(Boolean).join(' · ');
}
function ed_renderEditForm(item) {
  $('editorEditTitle').textContent = ed_editTitle(item);
  const c = $('editorEditForm');
  c.innerHTML = `<div class="form-grid full">${ed_shownColumns().map(col => ed_renderField(col, item.fields?.[col.name], { idPrefix: 'edit_', readOnly: !ed_isEditable(col) })).join('')}</div>`;
  ed_attachAllSuggestions(c);
  { const ah = document.createElement('div'); ah.style.marginTop = '12px'; c.appendChild(ah); att_render(ah, editorState.listId, [{ id: String(item.id), f: item.fields || {} }]).catch(() => {}); }
  $('editorSaveBtn').disabled = !hasPerm('editor-edit') || !editorState.canEditThisList;
  $('editorDeleteBtn').disabled = !hasPerm('delete') || !editorState.canEditThisList;
  $('editorDuplicateBtn').disabled = !hasPerm('editor-add') || !editorState.canEditThisList;
}
$('editorSaveBtn').addEventListener('click', async () => {
  if (!hasPerm('editor-edit') || !editorState.canEditThisList) { ed_setStatus('Permission denied.', 'error'); return; }
  const token = getGlobalAccessToken();
  if (!token) { ed_setStatus('Global token not configured.', 'error'); return; }
  if (!editorState.selectedItemId) return;
  const item = editorState.items.find(x => String(x.id) === String(editorState.selectedItemId));
  if (!item) return;
  const fields = {}; const changes = [];
  ed_saveColumns().forEach(col => {
    const nv = ed_readField(col, 'edit_'); const ov = item.fields?.[col.name] ?? null;
    let same = false;
    if (col.type === 'boolean') same = (Boolean(ov) === Boolean(nv));
    else if (col.type === 'date') same = (ov && nv) ? new Date(ov).getTime() === new Date(nv).getTime() : ov === nv;
    else same = (ov == null ? '' : String(ov)) === (nv == null ? '' : String(nv));
    if (!same) { fields[col.name] = nv; changes.push({ field: col.name, oldValue: ov, newValue: nv }); }
  });
  if (!Object.keys(fields).length) { ed_setStatus('No changes.', 'info'); return; }
  $('editorSaveBtn').disabled = true; ed_setStatus('Saving...', 'info');
  try {
    await updateItem(editorState.siteId, editorState.listId, editorState.selectedItemId, fields, token);
    ed_addHistory('update', editorState.selectedItemId, changes);
    ed_setStatus(`✅ Updated #${editorState.selectedItemId} (${changes.length} fields)`, 'success');
    addActivity('edit', `Updated #${editorState.selectedItemId}`);
    const resp = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${editorState.siteId}/lists/${editorState.listId}/items/${editorState.selectedItemId}?$expand=fields`, { headers: { Authorization: `Bearer ${token}` } }, 'fetch updated item');
    if (resp.ok) {
      const updated = await resp.json();
      const idx = editorState.items.findIndex(x => String(x.id) === String(editorState.selectedItemId));
      if (idx >= 0) editorState.items[idx] = updated;
      ed_selectRecord(updated);
    }
    ed_renderHistory();
  } catch (err) { ed_setStatus('✘ ' + err.message, 'error'); addActivity('error', `Update failed: ${err.message}`); }
  finally { $('editorSaveBtn').disabled = false; }
});
$('editorDuplicateBtn').addEventListener('click', async () => {
  if (!hasPerm('editor-add') || !editorState.canEditThisList) { ed_setStatus('Permission denied.', 'error'); return; }
  const token = getGlobalAccessToken();
  if (!token) { ed_setStatus('Global token not configured.', 'error'); return; }
  if (!editorState.selectedItemId) return;
  const item = editorState.items.find(x => String(x.id) === String(editorState.selectedItemId));
  if (!item) return;
  if (!confirm(`Duplicate item #${item.id}?`)) return;
  const fields = {};
  editorState.columns.forEach(col => { const v = item.fields?.[col.name]; if (v !== undefined && v !== null && v !== '') fields[col.name] = v; });
  if (fields.Title) fields.Title = fields.Title + ' (copy)';
  $('editorDuplicateBtn').disabled = true; ed_setStatus('Duplicating...', 'info');
  try {
    const created = await createItem(editorState.siteId, editorState.listId, fields, token);
    const changes = Object.entries(fields).map(([field, val]) => ({ field, oldValue: `(from #${item.id})`, newValue: val }));
    ed_addHistory('create', created.id, changes, { duplicatedFrom: item.id });
    ed_setStatus(`✅ Duplicated as #${created.id}`, 'success');
    addActivity('edit', `Duplicated #${item.id} → #${created.id}`);
    await ed_reloadItems();
    const newItem = editorState.items.find(x => String(x.id) === String(created.id));
    if (newItem) ed_selectRecord(newItem);
    ed_renderHistory();
  } catch (err) { ed_setStatus('✘ ' + err.message, 'error'); }
  finally { $('editorDuplicateBtn').disabled = false; }
});
$('editorDeleteBtn').addEventListener('click', async () => {
  if (!hasPerm('delete') || !editorState.canEditThisList) { ed_setStatus('Permission denied.', 'error'); return; }
  const token = getGlobalAccessToken();
  if (!token) { ed_setStatus('Global token not configured.', 'error'); return; }
  if (!editorState.selectedItemId) return;
  if (!confirm(`Delete item #${editorState.selectedItemId}?`)) return;
  const item = editorState.items.find(x => String(x.id) === String(editorState.selectedItemId));
  $('editorDeleteBtn').disabled = true; ed_setStatus('Deleting...', 'info');
  try {
    await deleteItem(editorState.siteId, editorState.listId, editorState.selectedItemId, token);
    ed_addHistory('delete', editorState.selectedItemId, [{ field: 'Title', oldValue: item?.fields?.Title || '', newValue: '' }]);
    ed_setStatus(`✅ Deleted #${editorState.selectedItemId}`, 'success');
    addActivity('edit', `Deleted #${editorState.selectedItemId}`);
    editorState.items = editorState.items.filter(x => String(x.id) !== String(editorState.selectedItemId));
    editorState.selectedItemId = null;
    $('editorEditTitle').textContent = 'Select a record to edit';
    $('editorEditForm').innerHTML = '<p class="text-sm">Choose a record from the list on the left.</p>';
    $('editorSaveBtn').disabled = true; $('editorDeleteBtn').disabled = true; $('editorDuplicateBtn').disabled = true;
    $('editorJsonTextarea').value = ''; $('editorJsonTextarea').disabled = true;
    $('editorJsonSaveBtn').disabled = true; $('editorJsonTargetId').textContent = '—';
    $('editorRecordCount').textContent = editorState.items.length;
    ed_renderRecordsList(); ed_renderBulkRecordsList(); ed_renderInlineTable(); ed_renderHistory();
  } catch (err) { ed_setStatus('✘ ' + err.message, 'error'); }
  finally { $('editorDeleteBtn').disabled = false; }
});
$('editorJsonSaveBtn').addEventListener('click', async () => {
  if (!hasPerm('editor-json') || !editorState.canEditThisList) { ed_setStatus('Permission denied.', 'error'); return; }
  const token = getGlobalAccessToken();
  if (!token) { ed_setStatus('Global token not configured.', 'error'); return; }
  if (!editorState.selectedItemId) return;
  let parsed;
  try { parsed = JSON.parse($('editorJsonTextarea').value); } catch (e) { ed_setStatus('Invalid JSON: ' + e.message, 'error'); return; }
  $('editorJsonSaveBtn').disabled = true; ed_setStatus('Saving JSON...', 'info');
  try {
    const item = editorState.items.find(x => String(x.id) === String(editorState.selectedItemId));
    const changes = [];
    Object.entries(parsed).forEach(([f, nv]) => { const ov = item?.fields?.[f]; if (String(ov ?? '') !== String(nv ?? '')) changes.push({ field: f, oldValue: ov, newValue: nv }); });
    await updateItem(editorState.siteId, editorState.listId, editorState.selectedItemId, parsed, token);
    ed_addHistory('update', editorState.selectedItemId, changes, { viaJson: true });
    ed_setStatus('✅ JSON saved.', 'success');
    await ed_reloadItems();
    const it = editorState.items.find(x => String(x.id) === String(editorState.selectedItemId));
    if (it) ed_selectRecord(it);
    ed_renderHistory();
  } catch (err) { ed_setStatus('✘ ' + err.message, 'error'); }
  finally { $('editorJsonSaveBtn').disabled = false; }
});
$('editorJsonCopyBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('editorJsonTextarea').value); ed_setStatus('Copied.', 'success'); } catch (e) { ed_setStatus('Copy failed: ' + e.message, 'error'); } });
function ed_renderBulkFieldSelect() {
  const sel = $('bulkFieldSelect');
  sel.innerHTML = '<option value="">— Select field —</option>' + ed_saveColumns().map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.displayName)} (${c.type})</option>`).join('');
}
function ed_renderBulkRecordsList() {
  const c = $('bulkRecordsList'); if (!c) return;
  const q = ($('bulkSearch').value || '').trim().toLowerCase();
  const filtered = !q ? editorState.items : editorState.items.filter(it => { const t = (it.fields?.Title || '').toString().toLowerCase(); return t.includes(q) || String(it.id).includes(q) || Object.values(it.fields || {}).some(v => String(v).toLowerCase().includes(q)); });
  c.innerHTML = filtered.slice(0, 500).map(it => {
    const title = it.fields?.Title || `Item #${it.id}`;
    const checked = editorState.bulkSelected.has(String(it.id)) ? 'checked' : '';
    return `<div class="record-item"><input type="checkbox" class="record-cb" data-id="${it.id}" ${checked} /><div class="record-title">${escapeHtml(String(title))}</div><div class="record-id">ID: ${it.id}</div></div>`;
  }).join('');
  c.querySelectorAll('input.record-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) editorState.bulkSelected.add(String(id)); else editorState.bulkSelected.delete(String(id));
      ed_updateBulkUI();
    });
  });
  ed_updateBulkUI();
}
$('bulkSearch').addEventListener('input', ed_renderBulkRecordsList);
function ed_updateBulkUI() {
  const n = editorState.bulkSelected.size;
  $('bulkSelectedCount').textContent = String(n);
  const bar = $('bulkActionBar');
  if (n > 0) bar.classList.add('visible'); else bar.classList.remove('visible');
  $('bulkApplyBtn').disabled = n === 0 || !hasPerm('editor-bulk') || !editorState.canEditThisList;
  $('bulkDeleteBtn').disabled = n === 0 || !hasPerm('delete') || !editorState.canEditThisList;
}
$('bulkSelectAllBtn').addEventListener('click', () => { editorState.items.forEach(it => editorState.bulkSelected.add(String(it.id))); ed_renderBulkRecordsList(); });
$('bulkClearSelectionBtn').addEventListener('click', () => { editorState.bulkSelected.clear(); ed_renderBulkRecordsList(); });
$('bulkFieldSelect').addEventListener('change', (e) => {
  const fieldName = e.target.value;
  const col = editorState.columns.find(c => c.name === fieldName);
  const wrap = $('bulkValueInput');
  if (!col) { wrap.innerHTML = '<input type="text" id="bulkValueText" placeholder="Select a field first" disabled />'; return; }
  if (col.type === 'choice') wrap.innerHTML = `<select id="bulkValueText"><option value="">— Select —</option>${(col.choices || []).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>`;
  else if (col.type === 'boolean') wrap.innerHTML = `<select id="bulkValueText"><option value="true">Yes</option><option value="false">No</option></select>`;
  else if (col.type === 'number') wrap.innerHTML = `<input type="number" id="bulkValueText" step="any" placeholder="Number..." />`;
  else if (col.type === 'date') wrap.innerHTML = `<input type="datetime-local" id="bulkValueText" />`;
  else if (col.type === 'multiline') wrap.innerHTML = `<textarea id="bulkValueText" rows="3" placeholder="Value..."></textarea>`;
  else wrap.innerHTML = `<input type="text" id="bulkValueText" placeholder="Value..." />`;
});
$('bulkApplyBtn').addEventListener('click', async () => {
  if (!hasPerm('editor-bulk') || !editorState.canEditThisList) { ed_setStatus('Permission denied.', 'error'); return; }
  const token = getGlobalAccessToken();
  if (!token) { ed_setStatus('Global token not configured.', 'error'); return; }
  const fieldName = $('bulkFieldSelect').value;
  if (!fieldName) { ed_setStatus('Pick a field first.', 'warn'); return; }
  const col = editorState.columns.find(c => c.name === fieldName);
  const inputEl = $('bulkValueText');
  if (!inputEl) { ed_setStatus('Enter a value.', 'warn'); return; }
  let value;
  if (col.type === 'boolean') value = inputEl.value === 'true';
  else if (col.type === 'number') value = inputEl.value === '' ? null : parseFloat(inputEl.value);
  else if (col.type === 'date') { const d = new Date(inputEl.value); value = isNaN(d.getTime()) ? null : d.toISOString(); }
  else value = inputEl.value.trim() === '' ? null : inputEl.value.trim();
  const ids = Array.from(editorState.bulkSelected);
  if (!ids.length) return;
  if (!confirm(`Apply "${fieldName} = ${value}" to ${ids.length} record(s)?`)) return;
  $('bulkApplyBtn').disabled = true;
  bulkProgress.start(`Applying "${fieldName} = ${value}" to ${ids.length} records...`, ids.length);
  let ok = 0, fail = 0; const errors = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const item = editorState.items.find(x => String(x.id) === String(id));
      const oldValue = item?.fields?.[fieldName];
      await updateItem(editorState.siteId, editorState.listId, id, { [fieldName]: value }, token);
      ed_addHistory('update', id, [{ field: fieldName, oldValue, newValue: value }], { bulk: true });
      if (item) { item.fields = item.fields || {}; item.fields[fieldName] = value; }
      ok++;
      bulkProgress.update(i + 1, ids.length, `✔ ${ok} ok, ${fail} failed — item #${id}`);
    } catch (err) { fail++; errors.push(`#${id}: ${err.message}`); bulkProgress.update(i + 1, ids.length, `✘ #${id}: ${err.message.slice(0, 60)}`); }
  }
  if (fail === 0) bulkProgress.finish(`✅ Updated ${ok} records`); else bulkProgress.error(`⚠ ${ok} ok, ${fail} failed`);
  addActivity('edit', `Bulk update: ${fieldName}=${value} on ${ok}/${ids.length}`);
  if (fail) notifyFailure('Bulk Update Partial Failure', `${fail} failures.\n\n${errors.slice(0, 5).join('\n')}`);
  editorState.bulkSelected.clear(); ed_updateBulkUI(); ed_renderBulkRecordsList(); ed_renderRecordsList(); ed_renderHistory(); ed_renderInlineTable();
  $('bulkApplyBtn').disabled = false;
});
$('bulkDeleteBtn').addEventListener('click', async () => {
  if (!hasPerm('delete') || !editorState.canEditThisList) { ed_setStatus('Permission denied.', 'error'); return; }
  const token = getGlobalAccessToken();
  if (!token) { ed_setStatus('Global token not configured.', 'error'); return; }
  const ids = Array.from(editorState.bulkSelected);
  if (!ids.length) return;
  if (!confirm(`Delete ${ids.length} record(s)?`)) return;
  $('bulkDeleteBtn').disabled = true;
  bulkProgress.start(`Deleting ${ids.length} records...`, ids.length);
  let ok = 0, fail = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const item = editorState.items.find(x => String(x.id) === String(id));
      await deleteItem(editorState.siteId, editorState.listId, id, token);
      ed_addHistory('delete', id, [{ field: 'Title', oldValue: item?.fields?.Title || '', newValue: '' }], { bulk: true });
      editorState.items = editorState.items.filter(x => String(x.id) !== String(id));
      ok++;
      bulkProgress.update(i + 1, ids.length, `✔ Deleted #${id}`);
    } catch (err) { fail++; bulkProgress.update(i + 1, ids.length, `✘ Failed #${id}`); }
  }
  if (fail === 0) bulkProgress.finish(`✅ Deleted ${ok} records`); else bulkProgress.error(`⚠ ${ok} ok, ${fail} failed`);
  editorState.bulkSelected.clear();
  ed_updateBulkUI(); ed_renderBulkRecordsList(); ed_renderRecordsList();
  $('editorRecordCount').textContent = editorState.items.length;
  ed_renderInlineTable(); ed_renderHistory();
  $('bulkDeleteBtn').disabled = false;
});

/* ============================================================
   Inline table column width management
   ============================================================ */
const INLINE_COL_WIDTHS_PREFIX = 'inline_colwidths_';
function inlineColWidthsKey() { return profileKey(INLINE_COL_WIDTHS_PREFIX + (editorState.listName || '').toLowerCase()); }
function loadInlineColWidths() { try { const raw = localStorage.getItem(inlineColWidthsKey()); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; } }
function saveInlineColWidths(widths) { try { localStorage.setItem(inlineColWidthsKey(), JSON.stringify(widths)); } catch (e) {} }
function clearInlineColWidths() { try { localStorage.removeItem(inlineColWidthsKey()); } catch (e) {} }
function applyInlineColWidths(table, widths) {
  if (!table) return;
  let colgroup = table.querySelector('colgroup');
  if (!colgroup) { colgroup = document.createElement('colgroup'); table.insertBefore(colgroup, table.firstChild); }
  const ths = table.querySelectorAll('thead th');
  while (colgroup.children.length < ths.length) colgroup.appendChild(document.createElement('col'));
  while (colgroup.children.length > ths.length) colgroup.removeChild(colgroup.lastChild);
  let anyWidth = false;
  ths.forEach((th, i) => {
    const key = th.dataset.colKey;
    const w = widths[key];
    if (w && w > 30) { colgroup.children[i].style.width = w + 'px'; anyWidth = true; }
    else { colgroup.children[i].style.width = ''; }
  });
  table.classList.toggle('resized', anyWidth);
}
function ed_renderInlineTable() {
  const table = $('inlineEditTable');
  const thead = table.querySelector('thead'); const tbody = table.querySelector('tbody');
  const q = ($('inlineSearch').value || '').trim().toLowerCase();
  const pageSize = parseInt($('inlinePageSize').value, 10) || 50;
  let visibleItems = editorState.items;
  if (q) visibleItems = visibleItems.filter(it => String(it.id).includes(q) || Object.values(it.fields || {}).some(v => v != null && String(v).toLowerCase().includes(q)));
  visibleItems = visibleItems.slice(0, pageSize);
  const editableCols = ed_shownColumns();
  const colDefs = [
    { key: 'fixed_0', label: 'ID' },
    ...editableCols.map(c => ({ key: 'col_' + c.name, label: c.displayName })),
    { key: 'fixed_actions', label: 'Actions' },
  ];
  thead.innerHTML = `<tr>${colDefs.map((d, i) => {
    const cls = i === 0 ? 'sticky-col' : '';
    const isActions = d.key === 'fixed_actions';
    return `<th class="${cls}" data-col-key="${escapeHtml(d.key)}" data-col-index="${i}">
      <span class="th-inner">${escapeHtml(d.label)}</span>
      ${isActions ? '' : '<span class="col-resizer" data-col-index="' + i + '"></span>'}
    </th>`;
  }).join('')}</tr>`;
  let html = '';
  editorState.inlineNewRows.forEach((nr) => {
    html += `<tr class="new-row" data-new-id="${nr.tempId}">
      <td class="sticky-col" style="font-family:'Consolas',monospace;color:var(--success);font-weight:600;">NEW</td>
      ${editableCols.map(col => `<td>${ed_inlineInput(col, nr.fields[col.name], nr.tempId)}</td>`).join('')}
      <td class="row-actions"><button class="ghost tiny" data-action="remove-new" data-tempid="${nr.tempId}" type="button">✖</button></td>
    </tr>`;
  });
  visibleItems.forEach(item => {
    const dirtyFields = editorState.inlineDirty.get(String(item.id)) || {};
    const isDirty = Object.keys(dirtyFields).length > 0;
    html += `<tr class="${isDirty ? 'dirty' : ''}" data-id="${item.id}">
      <td class="sticky-col" style="font-family:'Consolas',monospace;font-weight:600;">#${item.id}</td>
      ${editableCols.map(col => { const val = dirtyFields[col.name] !== undefined ? dirtyFields[col.name] : item.fields?.[col.name]; return `<td>${ed_inlineInput(col, val, item.id)}</td>`; }).join('')}
      <td class="row-actions">
        <button class="ghost tiny" data-att="ed:${item.id}" type="button" title="Show attachments / pictures"${item.fields && item.fields.Attachments === false ? ' style="opacity:.35"' : ''}>📎</button>
        <button class="ghost tiny" data-action="reset" data-id="${item.id}" type="button" title="Reset" ${isDirty ? '' : 'disabled'}>↺</button>
        ${hasPerm('delete') ? `<button class="danger tiny" data-action="delete-inline" data-id="${item.id}" type="button" title="Delete">🗑</button>` : ''}
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
  tbody.querySelectorAll('input[data-field], select[data-field], textarea[data-field]').forEach(el => { el.addEventListener('input', ed_inlineHandleInput); el.addEventListener('change', ed_inlineHandleInput); });
  tbody.querySelectorAll('button[data-action]').forEach(btn => { btn.addEventListener('click', ed_inlineHandleAction); });
  const widths = loadInlineColWidths();
  applyInlineColWidths(table, widths);
  ed_attachColResizers(table);
  ed_updateInlineDirtyCount();
}
function ed_attachColResizers(table) {
  const ths = table.querySelectorAll('thead th');
  ths.forEach(th => {
    const handle = th.querySelector('.col-resizer');
    if (!handle) return;
    if (handle.dataset.bound === '1') return;
    handle.dataset.bound = '1';
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = th.getBoundingClientRect().width;
      handle.classList.add('resizing');
      document.body.classList.add('col-resizing');
      table.classList.add('resized');
      const colgroup = table.querySelector('colgroup');
      if (colgroup) { const col = colgroup.children[th.cellIndex]; if (col) col.style.width = startWidth + 'px'; }
      function onMove(ev) {
        const dx = ev.clientX - startX;
        const newWidth = Math.max(50, startWidth + dx);
        if (colgroup) { const col = colgroup.children[th.cellIndex]; if (col) col.style.width = newWidth + 'px'; }
        th.style.width = newWidth + 'px';
      }
      function onUp() {
        handle.classList.remove('resizing');
        document.body.classList.remove('col-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const widths = loadInlineColWidths();
        const thsNow = table.querySelectorAll('thead th');
        thsNow.forEach(t => { const key = t.dataset.colKey; const w = Math.round(t.getBoundingClientRect().width); if (key && w > 30) widths[key] = w; });
        saveInlineColWidths(widths);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    handle.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const widths = loadInlineColWidths();
      const key = th.dataset.colKey;
      if (key) delete widths[key];
      saveInlineColWidths(widths);
      applyInlineColWidths(table, widths);
      th.style.width = '';
      const colgroup = table.querySelector('colgroup');
      if (colgroup) { const col = colgroup.children[th.cellIndex]; if (col) col.style.width = ''; }
      if (!Object.keys(widths).length) table.classList.remove('resized');
    });
  });
}
function ed_inlineInput(col, value, rowKey) {
  const id = `inline_${rowKey}_${col.name}`;
  const vs = value == null ? '' : String(value);
  if (!ed_isEditable(col)) return `<span class="inline-ro" title="Read-only (change in 🧩 Fields…)">${escapeHtml(vs)}</span>`;
  const common = `name="${id}" id="${id}" data-field="${escapeHtml(col.name)}" data-rowkey="${rowKey}"`;
  if (col.type === 'choice') return `<select ${common}>${(col.choices || []).map(c => `<option value="${escapeHtml(c)}" ${c === vs ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>`;
  if (col.type === 'boolean') return `<input type="checkbox" ${common} ${value === true || vs === 'true' ? 'checked' : ''} />`;
  if (col.type === 'multiline') { const html = `<textarea ${common} rows="1">${escapeHtml(vs)}</textarea>`; setTimeout(() => { const el = document.getElementById(id); if (el) attachFieldSuggestions(el, col.name); }, 0); return html; }
  if (col.type === 'number') { const html = `<input type="number" ${common} value="${escapeHtml(vs)}" step="any" />`; setTimeout(() => { const el = document.getElementById(id); if (el) attachFieldSuggestions(el, col.name); }, 0); return html; }
  if (col.type === 'date') {
    let dt = '';
    if (vs) { const d = new Date(vs); if (!isNaN(d.getTime())) { const p = n => String(n).padStart(2, '0'); dt = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; } }
    return `<input type="datetime-local" ${common} value="${dt}" />`;
  }
  const html = `<input type="text" ${common} value="${escapeHtml(vs)}" />`;
  setTimeout(() => { const el = document.getElementById(id); if (el) attachFieldSuggestions(el, col.name); }, 0);
  return html;
}
function ed_inlineHandleInput(e) {
  const el = e.target;
  const field = el.dataset.field; const rowKey = el.dataset.rowkey;
  if (!field || rowKey === undefined) return;
  const col = editorState.columns.find(c => c.name === field);
  if (!col) return;
  let v;
  if (col.type === 'boolean') v = el.checked;
  else if (col.type === 'number') v = el.value === '' ? null : parseFloat(el.value);
  else if (col.type === 'date') { const d = new Date(el.value); v = isNaN(d.getTime()) ? null : d.toISOString(); }
  else v = el.value;
  if (String(rowKey).startsWith('new_')) {
    const nr = editorState.inlineNewRows.find(x => x.tempId === rowKey);
    if (nr) nr.fields[field] = v;
  } else {
    const itemId = String(rowKey);
    const item = editorState.items.find(x => String(x.id) === itemId);
    if (!item) return;
    const existing = item.fields?.[field];
    let same = false;
    if (col.type === 'boolean') same = Boolean(existing) === Boolean(v);
    else if (col.type === 'date') same = (existing && v) ? new Date(existing).getTime() === new Date(v).getTime() : existing === v;
    else same = (existing == null ? '' : String(existing)) === (v == null ? '' : String(v));
    if (same) {
      const dirty = editorState.inlineDirty.get(itemId) || {};
      delete dirty[field];
      if (Object.keys(dirty).length) editorState.inlineDirty.set(itemId, dirty); else editorState.inlineDirty.delete(itemId);
      el.closest('tr')?.classList.toggle('dirty', Object.keys(dirty).length > 0);
    } else {
      const dirty = editorState.inlineDirty.get(itemId) || {};
      dirty[field] = v;
      editorState.inlineDirty.set(itemId, dirty);
      el.closest('tr')?.classList.add('dirty');
    }
  }
  ed_updateInlineDirtyCount();
}
function ed_inlineHandleAction(e) {
  const btn = e.target.closest('button[data-action]'); if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'reset') { const id = String(btn.dataset.id); editorState.inlineDirty.delete(id); ed_renderInlineTable(); }
  else if (action === 'remove-new') { const tid = btn.dataset.tempid; editorState.inlineNewRows = editorState.inlineNewRows.filter(x => x.tempId !== tid); ed_renderInlineTable(); }
  else if (action === 'delete-inline') { if (!hasPerm('delete') || !editorState.canEditThisList) { alert('Permission denied.'); return; } ed_inlineDeleteRow(btn.dataset.id); }
}
async function ed_inlineDeleteRow(id) {
  const token = getGlobalAccessToken(); if (!token) return;
  if (!confirm(`Delete item #${id}?`)) return;
  try {
    const item = editorState.items.find(x => String(x.id) === String(id));
    await deleteItem(editorState.siteId, editorState.listId, id, token);
    ed_addHistory('delete', id, [{ field: 'Title', oldValue: item?.fields?.Title || '', newValue: '' }], { inline: true });
    editorState.items = editorState.items.filter(x => String(x.id) !== String(id));
    editorState.inlineDirty.delete(String(id));
    ed_setStatus(`✅ Deleted #${id}`, 'success');
    ed_renderInlineTable(); ed_renderRecordsList(); ed_renderHistory();
    $('editorRecordCount').textContent = editorState.items.length;
  } catch (err) { ed_setStatus('Delete failed: ' + err.message, 'error'); }
}
function ed_updateInlineDirtyCount() {
  const n = editorState.inlineDirty.size + editorState.inlineNewRows.length;
  const el = $('inlineDirtyCount');
  if (n > 0) { el.style.display = 'inline-flex'; el.textContent = `${n} pending change${n > 1 ? 's' : ''}`; } else el.style.display = 'none';
  $('inlineSaveAllBtn').disabled = n === 0 || !hasPerm('editor-inline') || !editorState.canEditThisList;
  $('inlineDiscardBtn').disabled = n === 0;
}
$('inlineAddRowBtn').addEventListener('click', () => { if (!hasPerm('editor-inline') || !editorState.canEditThisList) { alert('Permission denied.'); return; } editorState.inlineNewRows.push({ tempId: 'new_' + uid(), fields: {} }); ed_renderInlineTable(); });
$('inlineDiscardBtn').addEventListener('click', () => { if (!confirm('Discard all pending changes?')) return; editorState.inlineDirty.clear(); editorState.inlineNewRows = []; ed_renderInlineTable(); });
$('inlineSearch').addEventListener('input', ed_renderInlineTable);
$('inlinePageSize').addEventListener('change', ed_renderInlineTable);
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-ddopen]')) ddOpenCfg(); });
$('inlineRefreshSuggestBtn').addEventListener('click', () => { loadSuggestionPool(true); ed_setStatus('Refreshing suggestion pool (last 10K rows)...', 'info'); });
$('inlineResetColsBtn').addEventListener('click', () => {
  if (!confirm('Reset all column widths to automatic?')) return;
  clearInlineColWidths();
  const table = $('inlineEditTable');
  table.classList.remove('resized');
  const colgroup = table.querySelector('colgroup');
  if (colgroup) colgroup.innerHTML = '';
  table.querySelectorAll('thead th').forEach(th => { th.style.width = ''; });
  ed_renderInlineTable();
  ed_setStatus('Column widths reset.', 'success');
});
$('inlineSaveAllBtn').addEventListener('click', async () => {
  if (!hasPerm('editor-inline') || !editorState.canEditThisList) { ed_setStatus('Permission denied.', 'error'); return; }
  const token = getGlobalAccessToken();
  if (!token) { ed_setStatus('Global token not configured.', 'error'); return; }
  const updates = Array.from(editorState.inlineDirty.entries());
  const creates = editorState.inlineNewRows.slice();
  const total = updates.length + creates.length;
  if (!total) return;
  $('inlineSaveAllBtn').disabled = true;
  inlineProgress.start(`Saving ${total} changes...`, total);
  let ok = 0, fail = 0; const errors = [];
  let step = 0;
  for (const [id, fields] of updates) {
    try {
      const item = editorState.items.find(x => String(x.id) === String(id));
      const changes = Object.entries(fields).map(([f, nv]) => ({ field: f, oldValue: item?.fields?.[f], newValue: nv }));
      await updateItem(editorState.siteId, editorState.listId, id, fields, token);
      ed_addHistory('update', id, changes, { inline: true });
      if (item) item.fields = { ...(item.fields || {}), ...fields };
      ok++;
    } catch (err) { fail++; errors.push(`#${id}: ${err.message}`); }
    step++;
    inlineProgress.update(step, total, `✔ Updated #${id} (${ok} ok, ${fail} failed)`);
  }
  for (const nr of creates) {
    const fields = {};
    Object.entries(nr.fields).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') fields[k] = v; });
    if (!Object.keys(fields).length) { step++; continue; }
    try {
      const created = await createItem(editorState.siteId, editorState.listId, fields, token);
      const changes = Object.entries(fields).map(([f, nv]) => ({ field: f, oldValue: '', newValue: nv }));
      ed_addHistory('create', created.id, changes, { inline: true });
      ok++;
    } catch (err) { fail++; errors.push(`new: ${err.message}`); }
    step++;
    inlineProgress.update(step, total, `✔ Saved ${step}/${total} (${ok} ok, ${fail} failed)`);
  }
  if (fail === 0) inlineProgress.finish(`✅ Saved ${ok} records`); else inlineProgress.error(`⚠ ${ok} ok, ${fail} failed`);
  addActivity('edit', `Inline save: ${ok}/${total}`);
  if (fail) notifyFailure('Inline Save Partial Failure', `${fail} failures.\n\n${errors.slice(0, 5).join('\n')}`);
  editorState.inlineDirty.clear(); editorState.inlineNewRows = [];
  await ed_reloadItems(); ed_renderHistory();
  $('inlineSaveAllBtn').disabled = false;
});

