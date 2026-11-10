/* ---------- 📥 Import receiving file (trailer / PO / JDE "Trailer Before Receiving" export) → the posting table of
   WHs Movements (FEFO) · Stock Movement Entry · RMPM Warehouse.  The user maps the columns once (remembered per page),
   checks a preview, then the lines go into the page's table to complete the missing information before ✅ Post to Inventory. ---------- */
(function () {
  const esc = escapeHtml, Q = s => document.querySelector(s);
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; };
  const pad = n => String(n).padStart(2, '0');
  const day = v => { if (v == null || v === '') return ''; if (v instanceof Date && !isNaN(v)) { const x = new Date(v.getTime() + 12 * 3600e3); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); }
    if (typeof v === 'number' && v > 30000 && v < 80000) return day(new Date(Math.round((v - 25569) * 864e5))); const t = String(v).trim(); let m = t.match(/^(\d{4})-(\d\d)-(\d\d)/); if (m) return m[0];
    m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad(+m[2]) + '-' + pad(+m[1]); return ''; };
  const str = v => v == null ? '' : v instanceof Date ? day(v) : String(v).trim();
  /* field · label · required · match patterns (first pattern that hits a free column wins) */
  const FLD = [
    ['sku', 'Item / SKU code', 1, [/^2nd item/, /^sku/, /item\s*code|^item$|material|product\s*code|^code$/, /item\s*(no|number)/]],
    ['dtls', 'Description', 0, [/^description$/, /^desc|item\s*name|description/]],
    ['qty', 'Quantity', 1, [/^quantity$/, /^qty|qty\s*(rcvd|received)|^units$|received/, /quantity|qty/]],
    ['uom', 'UoM', 0, [/^trans\s*uom$/, /^uom$|unit of measure|^unit$/, /uom/]],
    ['batch', 'Batch / lot', 0, [/^lot\s*\/\s*serial$/, /^batch|^lot(\s*(no|number|code))?$/]],
    ['slot', 'Supplier lot', 0, [/supplier\s*lot|vendor\s*lot/]],
    ['prod', 'Production date', 0, [/prod|mfg|manuf|^dop/, /lot\s*effective/]],
    ['exp', 'Expiry date', 0, [/lot\s*expir|expir|best\s*before|^exp|^bb/]],
    ['loc', 'Rack / location', 0, [/^location$/, /rack|^bin|location\s*code|store/]],
    ['pal', 'Pallets', 0, [/pallet|^plt/]],
    ['ref', 'Order / PO no.', 0, [/^order\s*number$/, /po\s*(no|number)|order\s*(no|number)|^po$/]],
    ['sup', 'Supplier', 0, [/^supplier$/, /supplier(\s*(name|no|number))?$|vendor/]],
    ['trl', 'Trailer / container', 0, [/container|trailer|truck|vehicle/]],
    ['rem', 'Remarks', 0, [/remark|note|comment/]]];
  const MK = k => LS_BASE + '_rcvimp_' + k;
  function headerOf(A) { const txt = v => v != null && !(v instanceof Date) && typeof v !== 'number' && String(v).trim() !== '';
    for (let i = 0; i < Math.min(25, A.length); i++) { const r = A[i] || []; if (r.filter(txt).length >= 2 && !r.some(v => v instanceof Date)) {
      const cols = []; r.forEach((v, c) => { if (!txt(v)) return; const smp = A.slice(i + 1).map(x => (x || [])[c]).map(str).filter(Boolean).slice(0, 3); cols.push({ c, name: String(v).trim(), smp }); }); return { h: i, cols }; } }
    return null; }
  function pick(file) { return new Promise(res => { const f = document.createElement('input'); f.type = 'file'; f.accept = '.xlsx,.xls,.xlsm,.csv'; f.style.display = 'none'; document.body.appendChild(f);
    f.addEventListener('change', () => { const x = f.files && f.files[0]; f.remove(); res(x || null); }); f.click(); }); }
  /* cfg: { key, page, use:[field keys the page fills], note, apply(rows, H, mode) → message } */
  async function open(cfg) {
    if (typeof XLSX === 'undefined') return sectionToast('The Excel library is not loaded.', 'error');
    const file = await pick(); if (!file) return; let wb; try { wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true }); } catch (e) { return sectionToast('The file could not be read: ' + e.message, 'error'); }
    const SH = wb.SheetNames.map(n => { const A = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }), k = headerOf(A); return k ? Object.assign({ name: n, A }, k) : null; }).filter(Boolean);
    if (!SH.length) return sectionToast('No header row found in this file.', 'warn');
    let si = Math.max(0, SH.findIndex(s => s.A.length - s.h > 1)); const F = FLD.filter(f => cfg.use.includes(f[0]));
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(MK(cfg.key)) || '{}'); } catch (e) {}
    let map = {}; const auto = () => { const S = SH[si], names = S.cols.map(c => c.name), low = s => s.toLowerCase(), used = new Set(); map = {};
      F.forEach(([k]) => { if (saved[k] && names.includes(saved[k])) { map[k] = saved[k]; used.add(saved[k]); } });
      F.forEach(([k, , , P]) => { if (map[k] != null) return; map[k] = ''; for (const re of P) { const n = names.find(x => !used.has(x) && re.test(low(x))); if (n) { map[k] = n; used.add(n); break; } } }); };
    auto();
    const rowsOf = () => { const S = SH[si], ci = k => { const c = S.cols.find(x => x.name === map[k]); return c ? c.c : -1; }, C = {}; F.forEach(([k]) => { C[k] = ci(k); }); const out = [], skip = { noItem: 0, noQty: 0 };
      if (C.sku < 0 || C.qty < 0) return { out, skip };
      S.A.slice(S.h + 1).forEach(r => { r = r || []; if (!r.some(v => v != null && String(v).trim() !== '')) return; const g = k => C[k] >= 0 ? r[C[k]] : null, sku = str(g('sku'));
        if (/^total/i.test(sku) || /^total/i.test(str(g('dtls')))) return; if (!sku) { skip.noItem++; return; } const q = num(g('qty')); if (!(q > 0)) { skip.noQty++; return; }
        const o = { sku, qty: q }; F.forEach(([k]) => { if (k === 'sku' || k === 'qty') return; o[k] = k === 'prod' || k === 'exp' ? day(g(k)) : k === 'pal' ? num(g(k)) : str(g(k)); }); if (o.loc) o.loc = o.loc.toUpperCase(); out.push(o); });
      return { out, skip }; };
    const old = Q('#rcvImpBox'); if (old) old.remove();
    const d = document.createElement('div'); d.id = 'rcvImpBox'; d.dataset.nohc = '1';
    d.style.cssText = 'position:fixed;inset:0;z-index:100060;background:rgba(10,20,40,.55);display:flex;align-items:center;justify-content:center;padding:12px';
    const draw = () => { const S = SH[si], R = rowsOf(), miss = F.filter(f => f[2] && !map[f[0]]).map(f => f[1]), tq = R.out.reduce((a, r) => a + r.qty, 0), first = k => (R.out.find(r => r[k]) || {})[k] || '';
      const pv = F.filter(f => map[f[0]]);
      d.innerHTML = `<div style="background:var(--card,#fff);color:var(--gray-800,#222);border-radius:14px;width:min(1080px,100%);max-height:94vh;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.45)">
      <div style="padding:16px 18px;border-bottom:1px solid var(--border)"><h3 style="margin:0 0 4px">📥 Import receiving file → ${esc(cfg.page)}</h3><div style="font-size:12px;color:var(--gray-600)"><b>${esc(file.name)}</b> · ORBIT matched the columns (JDE receiving export, trailer / PO list…) — change any of them, check the preview, then put the lines in the posting table. Your choice is remembered for the next file.</div></div>
      <div style="overflow:auto;padding:12px 18px;flex:1">
        ${SH.length > 1 ? `<div style="margin-bottom:10px;font-size:13px">Sheet: <select data-ri="sh" style="display:inline-block;width:auto;margin:0">${SH.map((s, i) => `<option value="${i}" ${i === si ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:8px 14px">${F.map(([k, l, req]) => { const c = S.cols.find(x => x.name === map[k]); return `<label style="display:flex;flex-direction:column;gap:3px;font-size:12px"><span><b>${esc(l)}</b>${req ? ' <span style="color:#dc2626">*</span>' : ''}</span><select data-rk="${k}" style="margin:0;${req && !map[k] ? 'border-color:#dc2626' : ''}"><option value="">— not in the file —</option>${S.cols.map(x => `<option ${map[k] === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><span style="color:var(--gray-600);min-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c && c.smp.length ? esc(c.smp.join(' · ')) : map[k] ? '(empty in the file)' : ''}</span></label>`; }).join('')}</div>
        <div style="margin-top:12px;font-size:12px;font-weight:700">Preview (${R.out.length} line(s))</div>
        <div style="overflow:auto;border:1px solid var(--border);border-radius:10px;margin-top:4px;max-height:300px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>${pv.map(f => `<th style="text-align:left;padding:6px;background:var(--brand-light,#eef2fb);white-space:nowrap;position:sticky;top:0">${esc(f[1])}</th>`).join('')}</tr></thead>
        <tbody>${R.out.slice(0, 50).map(r => `<tr>${pv.map(([k]) => `<td style="padding:4px 6px;border-top:1px solid var(--border);${k === 'qty' || k === 'pal' ? 'text-align:right' : ''}">${esc(k === 'qty' ? r.qty.toLocaleString() : r[k] || '')}</td>`).join('')}</tr>`).join('') || `<tr><td style="padding:14px;color:var(--gray-600)">No lines — map the item and quantity columns.</td></tr>`}</tbody></table></div>
        <div style="font-size:12px;color:var(--gray-600);margin-top:8px">${esc(cfg.note || '')}</div>
      </div>
      <div style="padding:12px 18px;border-top:1px solid var(--border);display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span style="font-size:13px;flex:1">${miss.length ? '<b style="color:#dc2626">Map: ' + esc(miss.join(', ')) + '</b>' : `<b>${R.out.length}</b> line(s) · <b>${tq.toLocaleString()}</b> units${first('ref') ? ' · order ' + esc(first('ref')) : ''}${R.skip.noItem + R.skip.noQty ? ' · ' + (R.skip.noItem + R.skip.noQty) + ' row(s) without item / quantity skipped' : ''}`}</span>
        <label style="font-size:12px;display:flex;gap:5px;align-items:center"><input type="radio" name="rcvImpM" value="rep" checked style="width:auto;margin:0"> Replace the lines</label><label style="font-size:12px;display:flex;gap:5px;align-items:center"><input type="radio" name="rcvImpM" value="add" style="width:auto;margin:0"> Add to them</label>
        <button class="ghost" type="button" data-ri="x">Cancel</button><button class="success" type="button" data-ri="go" ${miss.length || !R.out.length ? 'disabled' : ''}>⬇ Put ${R.out.length} line(s) in the posting table</button></div></div>`; };
    draw(); document.body.appendChild(d);
    d.addEventListener('change', e => { const t = e.target; if (t.dataset.rk) { map[t.dataset.rk] = t.value; saved[t.dataset.rk] = t.value; draw(); } else if (t.dataset.ri === 'sh') { si = +t.value; auto(); draw(); } });
    d.addEventListener('click', e => { if (e.target === d) return d.remove(); const b = e.target.closest('[data-ri]'); if (!b || b.tagName === 'SELECT') return; if (b.dataset.ri === 'x') return d.remove(); if (b.dataset.ri !== 'go') return;
      try { localStorage.setItem(MK(cfg.key), JSON.stringify(map)); } catch (x) {}
      const R = rowsOf(), H = { file: file.name, ref: '', sup: '', trl: '' }; ['ref', 'sup', 'trl'].forEach(k => { H[k] = (R.out.find(r => r[k]) || {})[k] || ''; });
      const mode = (d.querySelector('input[name=rcvImpM]:checked') || {}).value || 'rep'; d.remove();
      let m = ''; try { m = cfg.apply(R.out, H, mode) || ''; } catch (x) { return sectionToast('Import failed: ' + x.message, 'error'); }
      if (m) sectionToast(m.text || m, m.kind || 'success'); try { addActivity('upload', cfg.page + ': imported ' + R.out.length + ' line(s) from ' + file.name); } catch (x) {} }); }
  /* outline the empty required cells of the imported lines so the user sees what to complete */
  function mark(rowSel, ids, fields, cls) { setTimeout(() => { ids.forEach(id => { const tr = document.querySelector(rowSel + '[data-id="' + id + '"]'); if (!tr) return; fields.forEach(f => { const el = tr.querySelector('[data-f="' + f + '"]'); if (el && !String(el.value || '').trim()) el.classList.add(cls); }); }); }, 60); }
  /* ---------- 📋 paste a column of item codes (copied from Excel) into any SKU / Item cell → one row per code, description filled.
     A 2nd copied column with numbers is taken as the quantity. Each page registers how its lines are filled. ---------- */
  const PREG = [];
  function onPaste(sel, fn) { PREG.push({ sel, fn }); }
  document.addEventListener('paste', e => { const t = e.target; if (!t || !t.matches || !t.matches('input[data-f="sku"],input[data-f="item"]')) return; const reg = PREG.find(r => t.closest(r.sel)); if (!reg) return;
    const txt = (e.clipboardData || window.clipboardData).getData('text/plain') || ''; let rows = txt.replace(/\r/g, '').split('\n').map(l => l.split('\t').map(x => x.trim())).filter(c => c[0] !== '' || c.length > 1 && c[1] !== '');
    if (rows.length && /^(sku|item|code|2nd item|material|product)/i.test(rows[0][0]) && !/^\d/.test(rows[0][0]) && (rows[0][0].split(' ').length > 1 || !/\d/.test(rows[0][0]))) rows = rows.slice(1);
    rows = rows.filter(c => c[0] !== ''); if (rows.length < 2 && !(rows[0] && rows[0].length > 1)) return;
    const tr = t.closest('tr[data-id]'); if (!tr) return; e.preventDefault(); e.stopPropagation();
    const items = rows.map(c => ({ code: c[0], qty: c.length > 1 && c[1] !== '' && isFinite(Number(c[1].replace(/[,\s]/g, ''))) ? Number(c[1].replace(/[,\s]/g, '')) : null }));
    try { const r = reg.fn(+tr.dataset.id, items) || {}; sectionToast('📋 ' + items.length + ' item(s) pasted into ' + items.length + ' row(s)' + (r.unk && r.unk.length ? ' — ' + r.unk.length + ' code(s) not found in the item list: ' + r.unk.slice(0, 6).join(', ') + (r.unk.length > 6 ? ' …' : '') : '') + '.', r.unk && r.unk.length ? 'warn' : 'success'); } catch (x) { sectionToast('Paste failed: ' + x.message, 'error'); } }, true);
  /* put the codes from the pasted row down: the next rows are reused when their item is empty, otherwise new rows are inserted */
  function place(lines, id, items, mk, empty, set) { let pos = lines.findIndex(L => L.id === id); if (pos < 0) pos = lines.length - 1; const out = [];
    items.forEach((it, k) => { let L; if (k === 0) L = lines[pos]; else { pos++; if (pos < lines.length && empty(lines[pos])) L = lines[pos]; else { L = mk(); lines.splice(pos, 0, L); } } set(L, it); out.push(L); }); return out; }
  /* description of an item code from what ORBIT knows (stock history of WHs Movements, UOM list) */
  function descOf(code) { try { const w = window.WMVX; if (w) { const m = w.master && w.master(code); if (m && m.dtls) return m.dtls; const u = w.uomUpp && w.uomUpp(code); if (u && u.desc) return u.desc; } } catch (e) {} return ''; }
  window.RCVIMP = { open, mark, onPaste, place, descOf, BTN: '📥 Import receiving file', POST: '✅ Post to Inventory' };
})();
