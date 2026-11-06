/* ============================================================
   UoM NORMALISATION — every ledger quantity is converted to the BASE unit (PC) with the UOM list (UOM_tbl: UOM_Desc × UOM_Base_Nr)
   so that balances never add cartons / outers / pallets to pieces. 2,912 OT with OT = 12 → 34,944 PC.
   Order of the factor: UOM list (per SKU + UoM) → the row's own UOM_Base (> 1) → unknown (kept as entered and reported).
   Switch: localStorage <LS_BASE>_uomconv ("0" = off). Used when the ledger is read (WHs Movements, Stock Movement Entry) — so the balances, FEFO,
   3D view, position list and movement reports all show the same quantity.
   ============================================================ */
(function () {
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; };
  const KEY = () => (typeof LS_BASE !== 'undefined' ? LS_BASE : 'orbit') + '_uomconv';
  const U = window.UOMC = {
    last: null,
    on() { try { return localStorage.getItem(KEY()) !== '0'; } catch (e) { return true; } },
    set(v) { try { localStorage.setItem(KEY(), v ? '1' : '0'); } catch (e) {} },
    ready() { try { return wUomState.table.size > 0; } catch (e) { return false; } },
    async ensure() { if (!U.on() || U.ready()) return; try { if (!wUomState.listName || typeof wUom_loadFromList !== 'function') return; await Promise.race([wUom_loadFromList().catch(() => {}), new Promise(r => setTimeout(r, 25000))]); } catch (e) {} },
    factor(sku, uom, rowBase) { const c = wUomCanon(uom); if (!c || c === 'pc') return 1; let f = null; try { f = wUom_factor(sku, uom); } catch (e) {} if (f > 0) return f; const b = num(rowBase); return b > 1 ? b : null; },
    /* converts the rows in place; returns the summary also kept in UOMC.last */
    norm(rows) { const st = U.last = { on: U.on(), n: rows.length, conv: 0, unk: new Map(), unkL: new Map(), mixed: new Set(), skipped: '' };
      if (!st.on) { st.skipped = 'conversion is off'; return st; } if (!U.ready()) { st.skipped = 'the UOM list is not loaded'; return st; }
      const seen = new Map();
      rows.forEach(r => { const sku = String(r.SKU_Code || '').trim(); if (!sku) return; const uom = String(r.UOM_Desc == null ? '' : r.UOM_Desc).trim(), c = wUomCanon(uom) || 'pc'; let s = seen.get(sku); if (!s) seen.set(sku, s = new Set()); s.add(c);
        if (c === 'pc') return; const f = U.factor(sku, uom, r.UOM_Base); if (f == null) { const k = sku + ' · ' + uom; st.unk.set(k, (st.unk.get(k) || 0) + 1); const o = st.unkL.get(k) || { sku, uom, dt: String(r.SKU_Dtls || ''), n: 0 }; o.n++; st.unkL.set(k, o); return; } if (f === 1) return;
        r._raw = { rcvd: num(r.Qty_Rcvd), rlsd: num(r.Qty_Rlsd), uom, f }; r.Qty_Rcvd = num(r.Qty_Rcvd) * f; r.Qty_Rlsd = num(r.Qty_Rlsd) * f; r.UOM_Desc = 'PC'; r.UOM_Base = '1'; r._f = f; st.conv++; });
      seen.forEach((s, k) => { if (s.size > 1) st.mixed.add(k); }); return st; },
    note() { const s = U.last; if (!s) return ''; if (s.skipped) return 'UoM: ' + s.skipped + ' — quantities as entered'; return 'UoM → PC: ' + s.conv.toLocaleString() + ' row(s) converted' + (s.mixed.size ? ' · ' + s.mixed.size + ' SKU(s) had mixed units' : '') + (s.unk.size ? ' · ⚠ ' + [...s.unk.values()].reduce((a, b) => a + b, 0) + ' row(s) without a factor (' + [...s.unk.keys()].slice(0, 3).join(', ') + (s.unk.size > 3 ? '…' : '') + ')' : ''); },
    /* same note with a link on every SKU · UoM that has no value in the UOM list → opens the UOM editor */
    noteHtml() { const s = U.last, e = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); if (!s) return ''; if (s.skipped) return e(U.note());
      const L = [...s.unkL.values()].sort((a, b) => b.n - a.n), more = L.length > 6;
      return e('UoM → PC: ' + s.conv.toLocaleString() + ' row(s) converted' + (s.mixed.size ? ' · ' + s.mixed.size + ' SKU(s) had mixed units' : '')) + (L.length ? ' · ⚠ no UOM value for: ' + L.slice(0, 6).map(o => `<a href="#" data-uomed="${e(o.sku)}" data-uomu="${e(o.uom)}" title="${e(o.dt)} — open the UOM values to add or change ${e(o.uom)}" style="font-weight:700;text-decoration:underline">${e(o.sku)} · ${e(o.uom)}</a> (${o.n})`).join(', ') + (more ? ` <a href="#" data-uomed="" style="font-weight:700;text-decoration:underline">+${L.length - 6} more…</a>` : '') : ''); }
  };
})();

/* ============================================================
   UOM EDITOR — add or change the UOM values (UoM description × base quantity) of one item directly in the UOM list (UOM_tbl)
   Opened from the "no UOM value for SKU · UoM" links of the movement report, or from its ⚖ UOM values button.
   Works with the long layout of the list (one row per item and UoM). After saving, the UOM table and the ledger are re-read, so the
   balances are converted at once.
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = document.createElement('style'); css.textContent = `
#uomEd{position:fixed;inset:0;z-index:2147483300;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:16px}
#uomEd .ue-c{background:var(--card,#fff);color:var(--text,#111827);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.35);width:min(720px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden}
#uomEd .ue-h{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--border,#e5e7eb)}#uomEd h3{margin:0 auto 0 0;font-size:16px}
#uomEd .ue-b{padding:12px 16px;overflow:auto;flex:1;min-height:0}#uomEd table{width:100%;border-collapse:collapse;font-size:13px}#uomEd th{text-align:left;padding:6px;white-space:nowrap;background:var(--gray-50,#f8fafc)}#uomEd td{padding:4px 6px;border-top:1px solid var(--border,#eef0f3)}
#uomEd input{width:100%;margin:0;min-width:70px}#uomEd tr.miss td{background:#fffbeb}#uomEd .ue-m{font-size:12px;color:var(--gray-600,#4b5563);margin:8px 0}#uomEd .ue-bad{color:#b91c1c;font-weight:600}
#uomEd .ue-f{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:12px 16px;border-top:1px solid var(--border,#e5e7eb)}#uomEd a.ue-l{cursor:pointer;color:var(--brand,#1d4ed8);text-decoration:underline;font-weight:600}
@media (max-width:760px){#uomEd{padding:0;align-items:stretch}#uomEd .ue-c{width:100vw;max-height:100dvh;height:100dvh;border-radius:0}#uomEd .mdl-ctlw,#uomEd .mdl-ctl{display:none !important}}`;
  document.head.appendChild(css);
  const say = (t, k) => { if (typeof sectionToast === 'function') sectionToast(t, k || 'ok'); };
  const norm = v => String(v == null ? '' : v).trim().toLowerCase();
  const E = { sku: '', rows: [], msg: '', bad: false, busy: false };
  const hd = re => (wUomState.headers || []).find(h => re.test(String(h)) || re.test(String((wUomState.labels || {})[h] || ''))) || '';
  const cols = () => { const m = wUomState.map || {}; return { sku: m.sku, uom: hd(/^uom[_ ]?desc/i) || m.uom || m.text, code: hd(/^uom[_ ]?code$/i), itemId: hd(/^item[_ ]?id$/i), itemDesc: hd(/^item[_ ]?desc/i), fac: m.factor, long: wUomState.layout === 'long' }; };
  /* the UoM names come from the Items_UOM_tbl list (UOM_Desc; Item_Link = the item they belong to) */
  const MASTER = 'Items_UOM_tbl'; let MS = null;
  async function master() { if (MS) return MS; MS = []; try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) return MS; const x = await resolveIds(site, MASTER, token), its = await fetchAllItems(x.siteId, x.listId, token);
      MS = its.map(i => { const f = i.fields || {}; return { id: String(i.id || f.id || ''), title: String(f.Title == null ? '' : f.Title), desc: String(f.UOM_Desc == null ? '' : f.UOM_Desc).trim(), link: String(f.Item_Link == null ? '' : f.Item_Link).trim() }; }).filter(r => r.desc); } catch (e) { MS = []; E.mErr = e.message || String(e); } return MS; }
  const itemInfo = sku => { const c = cols(), r = (wUomState.rows || []).find(r => norm(r[c.sku]) === norm(sku)); let dt = '', id = ''; if (r) { dt = String(r[c.itemDesc] || '').trim(); id = String(r[c.itemId] == null ? '' : r[c.itemId]).trim(); }
    if (!dt) { try { const h = window.WMVX && WMVX.S.hist && WMVX.S.hist.sku.get(sku); if (h) dt = h.dtls || ''; } catch (e) {} } if (!dt && window.UOMC && UOMC.last) { const u = [...UOMC.last.unkL.values()].find(o => norm(o.sku) === norm(sku)); if (u) dt = u.dt || ''; } return { dt, id }; };
  const uomOpts = () => { const id = E.itemId, all = MS || [], mine = id ? all.filter(r => r.link === id || r.link === String(+id)) : [], src = mine.length ? mine : all, set = new Map(); src.forEach(r => set.set(norm(r.desc), r.desc)); if (!set.size) ['PC', 'CT', 'OT', 'BT', 'PLT', 'CRATE'].forEach(u => set.set(norm(u), u)); return [...set.values()]; };
  const codeOf = desc => { const c = cols(); if (!c.code) return ''; const r = (wUomState.rows || []).find(r => norm(r[c.uom]) === norm(desc) && String(r[c.code] == null ? '' : r[c.code]).trim() !== ''); return r ? r[c.code] : ''; };
  const rowsOf = sku => { const c = cols(); return (wUomState.rows || []).filter(r => norm(r[c.sku]) === norm(sku)).map(r => ({ id: r.id || r.ID || '', uom: String(r[c.uom] == null ? '' : r[c.uom]).trim(), code: c.code ? String(r[c.code] == null ? '' : r[c.code]).trim() : '', fac: String(r[c.fac] == null ? '' : r[c.fac]).trim(), o: null })); };
  function body() { const c = cols(), box = Q('#uomEd .ue-b'); if (!box) return;
    if (!wUomState.listName) { box.innerHTML = '<div class="ue-bad">The UOM list is not set. Pick it in Upload Destinations → Items, UOM &amp; Batch tables → UOM conversion table.</div>'; return; }
    if (!c.long || !c.sku || !c.uom || !c.fac) { box.innerHTML = `<div class="ue-bad">The UOM list “${esc(wUomState.listName)}” is not in the one-row-per-UoM layout (SKU column, UoM column, base-quantity column), so it cannot be edited here. Open the list in SharePoint to change it.</div>`; return; }
    if (!E.sku) { const L = (window.UOMC && UOMC.last && UOMC.last.unkL) ? [...UOMC.last.unkL.values()].sort((a, b) => b.n - a.n) : [];
      box.innerHTML = `<div class="ue-m">Type the SKU to open its UOM values:</div><div style="display:flex;gap:8px"><input id="ueSku" list="ueSkuDl" placeholder="SKU code" autocomplete="off"><datalist id="ueSkuDl">${[...new Set((wUomState.rows || []).map(r => String(r[c.sku] || '').trim()).filter(Boolean))].slice(0, 5000).map(k => `<option value="${esc(k)}">`).join('')}</datalist><button class="secondary" type="button" data-ue="go">Open</button></div>
      <div class="ue-m" style="margin-top:14px">${L.length ? '⚠ SKU · UoM without a value in the UOM list (from the last ledger read):' : 'No missing UOM values were found in the last ledger read.'}</div><div id="ueList">${L.map(o => `<div class="ue-it" data-k="${esc((o.sku + ' ' + (o.dt || '') + ' ' + o.uom).toLowerCase())}"><a class="ue-l" data-ue="open" data-s="${esc(o.sku)}" data-u="${esc(o.uom)}">${esc(o.sku)} · ${esc(o.uom)}</a> <span class="ue-m">${esc(o.dt || '')} · ${o.n} movement(s)</span></div>`).join('')}</div><div class="ue-m" id="ueNone" style="display:none">No missing value matches the filter — press Open to open this SKU anyway.</div>`; return; }
    box.innerHTML = `<div class="ue-m"><b>${esc(E.sku)}</b>${E.dt ? ' — ' + esc(E.dt) : ''}<br>List <b>${esc(wUomState.listName)}</b> · UoM names from <b>${esc(MASTER)}</b>${(MS && MS.length) ? '' : ' (list not readable — standard names shown)'} · base unit PC. “Base qty” = how many PC are in <b>1</b> of that UoM (OT = 12 means 1 OT = 12 PC). Leave PC = 1.</div>
      <table><thead><tr><th>UoM description</th><th>Base qty (PC per 1)</th><th></th></tr></thead><tbody>${E.rows.map((r, i) => `<tr data-i="${i}" class="${!r.fac || +String(r.fac).replace(/,/g, '') <= 0 ? 'miss' : ''}"><td>${r.id ? `<input data-f="uom" value="${esc(r.uom)}${r.code ? ' (code ' + esc(r.code) + ')' : ''}" readonly title="existing row — the UoM name cannot be renamed here">` : `<select data-f="uom"><option value="">— choose the UoM —</option>${uomOpts().concat(r.uom && !uomOpts().some(o => norm(o) === norm(r.uom)) ? [r.uom] : []).map(o => `<option value="${esc(o)}"${norm(o) === norm(r.uom) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`}</td><td><input data-f="fac" inputmode="decimal" value="${esc(r.fac)}" placeholder="e.g. 12"></td><td style="white-space:nowrap">${r.id ? '<span class="ue-m">saved #' + esc(r.id) + '</span>' : '<span class="ue-m">new</span> <a class="ue-l" data-ue="del" data-i="' + i + '">✕</a>'}</td></tr>`).join('')}</tbody></table>
      <div class="ue-m ${E.bad ? 'ue-bad' : ''}" id="ueMsg">${esc(E.msg)}</div>`; }
  function frame() { let m = Q('#uomEd'); if (m) m.remove(); m = document.createElement('div'); m.id = 'uomEd'; m.dataset.nohc = '1';
    m.innerHTML = `<div class="ue-c"><div class="ue-h"><h3>⚖ UOM values${E.sku ? ' — ' + esc(E.sku) + (E.dt ? ' · ' + esc(E.dt) : '') : ''}</h3>${E.sku ? '<button class="ghost small" type="button" data-ue="back">◀ Other SKU</button>' : ''}<button class="ghost small" type="button" data-ue="x">✕ Close</button></div><div class="ue-b"></div><div class="ue-f">${E.sku ? '<button class="secondary" type="button" data-ue="add">➕ Add UoM row</button><button class="success" type="button" data-ue="save">💾 Save to SharePoint</button>' : ''}</div></div>`;
    document.body.appendChild(m); body();
    m.addEventListener('click', e => { if (e.target === m) return m.remove(); const b = e.target.closest('[data-ue]'); if (!b) return; e.preventDefault(); const a = b.dataset.ue;
      if (a === 'x') m.remove(); else if (a === 'go') { const v = (Q('#ueSku') || {}).value; if (v && v.trim()) open(v.trim()); } else if (a === 'open') open(b.dataset.s, b.dataset.u); else if (a === 'back') open('');
      else if (a === 'add') { E.rows.push({ id: '', uom: '', fac: '' }); body(); } else if (a === 'del') { E.rows.splice(+b.dataset.i, 1); body(); } else if (a === 'save') save(); });
    const flt = e => { if (!e.target || e.target.id !== 'ueSku') return; const q = String(e.target.value || '').trim().toLowerCase(); let n = 0; m.querySelectorAll('.ue-it').forEach(d => { const ok = !q || d.dataset.k.includes(q); d.style.display = ok ? '' : 'none'; if (ok) n++; }); const z = m.querySelector('#ueNone'); if (z) z.style.display = q && !n ? '' : 'none'; };
    m.addEventListener('input', flt); m.addEventListener('change', flt); m.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'ueSku') { e.preventDefault(); const v = e.target.value.trim(); if (v) open(v); } });
    const upd = e => { const tr = e.target.closest('tr[data-i]'); if (!tr) return; const r = E.rows[+tr.dataset.i]; if (r && e.target.dataset.f) r[e.target.dataset.f] = e.target.value; }; m.addEventListener('input', upd); m.addEventListener('change', upd); }
  async function open(sku, uom) { if (typeof hasPerm === 'function' && !hasPerm('uploader')) return say('You do not have permission to change the UOM list.', 'warn');
    await master(); E.sku = String(sku || '').trim(); E.msg = ''; E.bad = false; E.rows = E.sku ? rowsOf(E.sku) : []; const ii = E.sku ? itemInfo(E.sku) : { dt: '', id: '' }; E.dt = ii.dt; E.itemId = ii.id;
    if (E.sku && uom && !E.rows.some(r => norm(r.uom) === norm(uom))) E.rows.push({ id: '', uom: String(uom).trim(), fac: '' });
    if (E.sku && !E.rows.some(r => /^(pc|pcs|piece)$/i.test(r.uom))) E.rows.unshift({ id: '', uom: 'PC', fac: '1' });
    frame(); }
  async function save() { if (E.busy) return; const c = cols(), say2 = (t, bad) => { E.msg = t; E.bad = !!bad; const e = Q('#ueMsg'); if (e) { e.textContent = t; e.className = 'ue-m ' + (bad ? 'ue-bad' : ''); } };
    const seen = new Set(), todo = []; for (const r of E.rows) { const u = String(r.uom || '').trim(), f = Number(String(r.fac || '').replace(/,/g, '')); if (!u) { if (!r.id && !String(r.fac || '').trim()) continue; return say2('Every row needs a UoM description.', 1); }
      if (!r.id && MS && MS.length && !uomOpts().some(o => norm(o) === norm(u))) return say2('“' + u + '” is not in ' + MASTER + ' — choose one of its UoM names.', 1); if (!(f > 0)) return say2('“' + u + '” needs a base quantity above 0.', 1); const k = (typeof wUomCanon === 'function' ? wUomCanon(u) : norm(u)); if (seen.has(k)) return say2('“' + u + '” is entered twice.', 1); seen.add(k);
      const old = rowsOf(E.sku).find(o => o.id && String(o.id) === String(r.id)); if (!r.id || !old || Number(String(old.fac).replace(/,/g, '')) !== f) todo.push({ r, u, f }); }
    if (!todo.length) return say2('Nothing changed.', 0);
    E.busy = true; say2('⏳ Saving to ' + wUomState.listName + '…');
    try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('Sign-in / Site URL is not ready.'); const x = await resolveIds(site, wUomState.listName, token); let n = 0;
      for (const t of todo) { if (t.r.id) await updateItem(x.siteId, x.listId, t.r.id, spCoerceFields(x.listId, { [c.fac]: t.f }), x.token || token); else { const cd = codeOf(t.u), fl = { Title: E.sku, [c.sku]: E.sku, [c.uom]: t.u, [c.fac]: t.f }; if (c.code && cd !== '') fl[c.code] = Number(cd); if (c.itemId && E.itemId) fl[c.itemId] = Number(E.itemId); if (c.itemDesc && E.dt) fl[c.itemDesc] = E.dt; await createItem(x.siteId, x.listId, spCoerceFields(x.listId, fl), token); } n++; }
      say2('✔ ' + n + ' row(s) saved — re-reading the UOM list…'); try { await wUom_loadFromList(); } catch (e) {}
      try { if (window.WMVX && WMVX.load) { await WMVX.load(true); } } catch (e) {}
      say('✔ UOM values saved — the balances are converted with the new values.'); const m = Q('#uomEd'); if (m) m.remove(); if (Q('#mvBox') && window.mvOpen) mvOpen(); }
    catch (e) { say2('⚠ Not saved: ' + (e.message || e), 1); } finally { E.busy = false; } }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q('#uomEd')) Q('#uomEd').remove(); });
  /* any link / button with data-uomed opens the editor (movement report note, WHs screens …) */
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-uomed]'); if (!a) return; e.preventDefault(); e.stopPropagation(); open(a.dataset.uomed, a.dataset.uomu || ''); }, true);
  window.UOMED = { open };
})();
