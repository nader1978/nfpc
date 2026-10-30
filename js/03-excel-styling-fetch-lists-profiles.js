/* ============================================================
   Excel export styling — layout A · Corporate Blue, applied to every .xlsx the system downloads
   ============================================================ */
const XL_THEMES = {   // tf title fill (null = none) · tc title text · ac accent line · h header fill · hc header text · hb header border · b cell border · bo borders: 'box' or 'row' · a banded row · s totals
  A: { n: 'A · Corporate Blue — blue title band, banded rows', tf: '1F4E79', tc: 'FFFFFF', ac: '2E75B6', h: '1F4E79', hc: 'FFFFFF', hb: 'B8C7DB', b: 'B8C7DB', bo: 'box', a: 'EAF1FB', s: 'D6E4F5' },
  B: { n: 'B · Fresh Teal — clean white title, teal header', tf: null, tc: '0F766E', ac: '14B8A6', h: '0F766E', hc: 'FFFFFF', hb: '14B8A6', b: 'CBD5D1', bo: 'row', a: 'F0F9F8', s: 'CCEBE8' },
  C: { n: 'C · Classic Grey — print friendly, grey header, no colour', tf: null, tc: '222222', ac: '7F7F7F', h: 'D9D9D9', hc: '000000', hb: '999999', b: '999999', bo: 'box', a: null, s: 'EDEDED' },
  D: { n: 'D · Executive Dark — charcoal title, gold header text', tf: '262B33', tc: 'FFFFFF', ac: 'F5C542', h: '262B33', hc: 'F5C542', hb: 'F5C542', b: 'D8D2C2', bo: 'row', a: 'F4F1EA', s: 'E8DFC8' }
};
const XL_PAL = () => XL_THEMES[XL_PREF().style] || XL_THEMES.A;
const XL_PREF = () => { try { return JSON.parse(localStorage.getItem(LS_BASE + '_xlstyle') || '{}') || {}; } catch (e) { return {}; } };
async function roXlBuild(wb, fileName) {
  const EJ = await roSmLoadExcelJs(), pref = XL_PREF(), P = XL_PAL(), bi = (typeof brandGet === 'function' ? brandGet() : { co: {} }), bk = bi.co || {}, co = (pref.company || '').trim() || bk.name || 'NFPC · Supply Chain', coLine = [bk.addr, bk.phone && 'Tel ' + bk.phone, bk.fax && 'Fax ' + bk.fax, bk.mail && 'Email ' + bk.mail, bk.web && 'Web ' + bk.web, bk.reg && 'Reg/Tax ' + bk.reg].filter(Boolean).join('  ·  '),  who = (typeof getCurrentUserValue === 'function' ? getCurrentUserValue() : '') || '', now = new Date().toLocaleString(), out = new EJ.Workbook();
  out.creator = who || 'NFPC'; out.created = new Date();
  let logoId = null; { const m = /^data:image\/(png|jpe?g);base64,/i.exec(bi.img || ''); if (m) { try { logoId = out.addImage({ base64: bi.img, extension: /png/i.test(m[1]) ? 'png' : 'jpeg' }); } catch (e) { logoId = null; } } }
  const thin = c => ({ style: 'thin', color: { argb: c } }), box = c => ({ top: thin(c), left: thin(c), bottom: thin(c), right: thin(c) }), fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
  const base = String(fileName || 'Export').replace(/\.xlsx$/i, '').replace(/[_ -]*\d{4}-\d\d-\d\d.*$/, '').replace(/_+/g, ' ').trim() || 'Export', idHdr = /(^|[\s_])(nr|no|id|code|sku|icode|batch|phone|mobile|barcode|ean|plate|seal|trip|doc|document|pallet id)([\s_.:]|$)|file|number/i;
  wb.SheetNames.forEach(sn => {
    const ws0 = wb.Sheets[sn], name = String(sn).slice(0, 31); if (!ws0 || !ws0['!ref']) { out.addWorksheet(name); return; }
    const M = XLSX.utils.sheet_to_json(ws0, { header: 1, defval: '', raw: true }); let C = 0; M.forEach(r => { C = Math.max(C, r.length); }); if (!M.length || !C) { out.addWorksheet(name); return; }
    const R = M.length, ws = out.addWorksheet(name), big = R * C > 150000, tc = Math.max(C, 4), generic = /^(sheet\d*|list|export|data|sheet1)$/i.test(sn);
    let hi = M.findIndex(r => r.filter(v => v !== '' && v != null).length >= Math.max(2, Math.ceil(C / 3))); if (hi < 0) hi = 0;
    ws.mergeCells(1, 1, 1, tc); const t = ws.getCell(1, 1); t.value = `${co}  |  ${(generic ? base : sn).toUpperCase()}`; if (P.tf) t.fill = fill('FF' + P.tf); t.font = { bold: true, size: 14, color: { argb: 'FF' + P.tc } }; t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }; ws.getRow(1).height = 28;
    ws.mergeCells(2, 1, 2, tc); const inf = ws.getCell(2, 1); inf.value = `${base}  ·  ${now}${who ? '  ·  Prepared by ' + who : ''}  ·  ${Math.max(0, R - 1 - hi)} row(s)`; inf.font = { italic: true, size: 10, color: { argb: 'FF555555' } }; inf.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }; for (let c = 1; c <= tc; c++) ws.getCell(2, c).border = { bottom: { style: 'medium', color: { argb: 'FF' + P.ac } } }; ws.getRow(2).height = 18;
    if (logoId !== null) { ws.getRow(1).height = 34; try { ws.addImage(logoId, { tl: { col: tc - 0.95, row: 0.06 }, ext: { width: 44, height: 30 }, editAs: 'oneCell' }); } catch (e) {} }
    let top = 3; if (coLine) { ws.mergeCells(3, 1, 3, tc); const cl = ws.getCell(3, 1); cl.value = coLine; cl.font = { size: 9, color: { argb: 'FF555555' } }; cl.alignment = { vertical: 'middle' }; top = 4; }
    // rows before the real header (rare) are written as they are
    for (let r = 0; r < hi; r++) { const row = ws.getRow(top + r); M[r].forEach((v, c) => { if (v !== '' && v != null) { const cell = row.getCell(c + 1); cell.value = v; cell.font = { bold: true, size: 10 }; } }); }
    const hr = top + hi, H = M[hi] || [];
    for (let c = 0; c < C; c++) { const cell = ws.getCell(hr, c + 1); cell.value = H[c] === '' || H[c] == null ? null : H[c]; cell.fill = fill('FF' + P.h); cell.font = { bold: true, size: 10, color: { argb: 'FF' + P.hc } }; cell.border = box('FF' + P.hb); cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; }
    ws.getRow(hr).height = 24;
    const isTot = r => /^\s*total/i.test(String(M[r][0] == null ? '' : M[r][0])) || (R - 1 === r && /^\s*total/i.test(String(M[r].find(v => v !== '' && v != null) || ''))), colFmt = [];
    for (let c = 0; c < C; c++) colFmt[c] = idHdr.test(String(H[c] == null ? '' : H[c])) ? '0' : null;
    let last = hr; const widths = Array(C).fill(0); H.forEach((h, c) => { widths[c] = String(h == null ? '' : h).length + 4; });
    for (let r = hi + 1; r < R; r++) {
      const row = ws.getRow(top + r), tot = isTot(r), band = (r - hi) % 2 === 0; if (!tot) last = top + r;
      for (let c = 0; c < C; c++) { const v = M[r][c]; const cell = row.getCell(c + 1); if (v !== '' && v != null) cell.value = v; if (r - hi < 400) { const L = v instanceof Date ? 10 : String(v == null ? '' : v).length; if (L + 2 > widths[c]) widths[c] = L + 2; }
        if (big) continue;
        const bc = 'FF' + P.b, ac = 'FF' + P.ac; cell.border = P.bo === 'row' ? { bottom: thin(bc) } : box(bc); cell.font = tot ? { bold: true, size: 10 } : { size: 10 };
        if (tot) { cell.fill = fill('FF' + P.s); cell.border = { top: { style: 'medium', color: { argb: ac } }, bottom: { style: 'medium', color: { argb: ac } } }; } else if (band && P.a) cell.fill = fill('FF' + P.a);
        if (typeof v === 'number') { cell.alignment = { horizontal: colFmt[c] === '0' ? 'left' : 'right', vertical: 'middle' }; cell.numFmt = colFmt[c] === '0' ? '0' : (Number.isInteger(v) ? '#,##0' : '#,##0.00#'); } else if (v instanceof Date) { cell.numFmt = 'yyyy-mm-dd'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; } else cell.alignment = { vertical: 'middle', wrapText: String(v).length > 60 };
      }
    }
    widths.forEach((w, c) => { ws.getColumn(c + 1).width = Math.max(10, Math.min(46, w)); });
    ws.views = [{ state: 'frozen', ySplit: hr, xSplit: 0 }]; if (last > hr) ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: last, column: C } };
    ws.pageSetup = { orientation: C > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: `${hr}:${hr}`, margins: { left: .4, right: .4, top: .5, bottom: .6, header: .3, footer: .3 } };
    ws.headerFooter = { oddFooter: `&L${co.replace(/&/g, '&&')}&C${base.replace(/&/g, '&&')}&RPage &P of &N` };
  });
  return out;
}
async function roXlBuf(wb, name) { return (await roXlBuild(wb, name)).xlsx.writeBuffer(); }
async function roXlSave(wb, name) { if (featBlock('excel')) return; const buf = await roXlBuf(wb, name), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function roXlB64(wb, name) {   // for e-mail attachments: coloured when possible, plain otherwise
  if (XL_PREF().style !== 'plain') { try { const u = new Uint8Array(await roXlBuf(wb, name || 'Export.xlsx')); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); } catch (e) {} }
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
(function () {   // every XLSX.writeFile(...xlsx) in the system now produces the Corporate Blue layout
  if (typeof XLSX === 'undefined' || XLSX.__styled) return; XLSX.__styled = true; const plain = XLSX.writeFile.bind(XLSX);
  XLSX.writeFile = function (wb, name, opts) {
    if (featBlock('excel')) return;
    if (XL_PREF().style === 'plain' || !/\.xlsx$/i.test(String(name || '')) || (opts && opts.bookType && opts.bookType !== 'xlsx')) return plain(wb, name, opts);
    roXlSave(wb, name).catch(err => { try { plain(wb, name, opts); sectionToast('Saved without colours — ' + err.message, 'warn'); } catch (e) {} });
  };
})();

(function () {   // colour theme (saved at once, per browser)
  const T = [['blue', 'Blue', 'linear-gradient(120deg,#12306b,#3b82f6)'], ['green', 'Green', 'linear-gradient(120deg,#14532d,#34b863)'], ['navy', 'Dark blue', 'linear-gradient(120deg,#071433,#1e40af)'], ['gray', 'Gray', 'linear-gradient(120deg,#1f2937,#8795a8)'], ['red', 'Dark red', 'linear-gradient(120deg,#5b0f1b,#d6455a)']], KEY = LS_BASE + '_accent';
  const get = () => { try { return localStorage.getItem(KEY) || 'blue'; } catch (e) { return 'blue'; } };
  const apply = v => { if (v === 'blue') document.documentElement.removeAttribute('data-accent'); else document.documentElement.setAttribute('data-accent', v); const box = document.getElementById('setAccent'); if (box) box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.a === v)); };
  apply(get());
  const box = document.getElementById('setAccent'); if (!box) return;
  box.innerHTML = T.map(t => `<button type="button" data-a="${t[0]}"><i style="background:${t[2]}"></i>${t[1]}</button>`).join(''); apply(get());
  box.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; try { localStorage.setItem(KEY, b.dataset.a); } catch (x) {} apply(b.dataset.a); });
})();
(function () {   // Excel style settings (saved at once)
  const st = document.getElementById('setXlStyle'), co = document.getElementById('setXlCompany'); if (!st || !co) return; const p = XL_PREF();
  st.innerHTML = Object.keys(XL_THEMES).map(k => `<option value="${k}">${XL_THEMES[k].n}</option>`).join('') + '<option value="plain">Plain (no colours, no formatting)</option>';
  st.value = p.style === 'plain' ? 'plain' : (XL_THEMES[p.style] ? p.style : 'A'); co.value = p.company || '';
  const prev = () => { const el = document.getElementById('setXlPrev'); if (!el) return; const T = XL_THEMES[st.value]; el.style.flexDirection = 'column'; el.innerHTML = T ? `<div style="font:700 12px Calibri,Arial;padding:6px 8px;${T.tf ? `background:#${T.tf};color:#${T.tc}` : `color:#${T.tc}`};border-bottom:2px solid #${T.ac}">NFPC · Supply Chain | LIST</div><div style="display:flex;font:700 11px Calibri,Arial;background:#${T.h};color:#${T.hc};padding:4px 8px;border:1px solid #${T.hb}"><span style="flex:1">Code</span><span style="flex:2">Item</span><span>Qty</span></div><div style="display:flex;font:11px Calibri,Arial;padding:3px 8px;border-bottom:1px solid #${T.b}"><span style="flex:1">A-01</span><span style="flex:2">Full cream milk</span><span>1,200</span></div><div style="display:flex;font:11px Calibri,Arial;padding:3px 8px;border-bottom:1px solid #${T.b};${T.a ? 'background:#' + T.a : ''}"><span style="flex:1">A-02</span><span style="flex:2">Laban 2L</span><span>600</span></div><div style="display:flex;font:700 11px Calibri,Arial;padding:3px 8px;background:#${T.s};border-top:2px solid #${T.ac};border-bottom:2px solid #${T.ac}"><span style="flex:3">TOTAL</span><span>1,800</span></div>` : '<span class="text-sm" style="color:var(--gray-600)">No colours — raw spreadsheet</span>'; };
  const save = () => { try { localStorage.setItem(LS_BASE + '_xlstyle', JSON.stringify({ style: st.value, company: co.value.trim() })); } catch (e) {} prev(); }; prev();
  st.addEventListener('change', save); co.addEventListener('input', save);
})();

/* ============================================================
   Throttle-aware fetch
   ============================================================ */
async function fetchWithRetry(url, options = {}, context = '') {
  let attempt = 0;
  while (true) {
    let response;
    try { response = await fetch(url, options); }
    catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) throw new Error(`Network error after ${MAX_RETRIES} retries: ${err.message}`);
      const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (response.status !== 429 && response.status !== 503 && response.status !== 504) return response;
    attempt++;
    if (attempt > MAX_RETRIES) { setThrottleState(false); throw new Error(`HTTP ${response.status} — gave up after ${MAX_RETRIES} retries`); }
    const retryAfter = response.headers.get('Retry-After');
    let waitSec = retryAfter ? parseInt(retryAfter, 10) : null;
    if (!waitSec || isNaN(waitSec)) waitSec = Math.max(1, Math.round(BASE_BACKOFF_MS * Math.pow(2, attempt - 1) / 1000));
    waitSec = Math.min(waitSec, 120);
    setThrottleState(true, `⏳ Throttled — waiting ${waitSec}s (retry ${attempt}/${MAX_RETRIES})...`);
    addActivity('throttle', `Throttled ${context || url}. Waiting ${waitSec}s`);
    await new Promise(r => setTimeout(r, waitSec * 1000));
  }
}
let throttleActive = false;
function setThrottleState(active, msg = '') {
  throttleActive = active;
  const pill = $('tokenPill'), text = $('tokenPillText');
  if (active) { pill.classList.remove('ok'); pill.classList.add('throttled'); text.textContent = msg || 'Throttled...'; }
  else { pill.classList.remove('throttled'); syncToken(); }
}

/* ============================================================
   Lists cache
   ============================================================ */
const listsCache = new Map();
async function getListsForSite(siteUrl, token, forceRefresh = false) {
  if (!siteUrl || !token) throw new Error(!siteUrl && token ? 'The SharePoint Site URL is empty — enter it in Settings → Global Connection Settings and click Save IDs.' : 'Global Site URL and Token are not configured. Contact your admin.');
  const key = siteUrl.trim().replace(/\/$/, '').toLowerCase();
  const existing = listsCache.get(key);
  if (existing && !forceRefresh && Date.now() - existing.ts < LISTS_CACHE_TTL) return filterVisibleLists(existing.lists);
  if (existing && existing.fetching && !forceRefresh) {
    const all = await existing.fetching;
    return filterVisibleLists(all);
  }
  const fetchPromise = (async () => {
    const { siteId } = await resolveIdsOnly(siteUrl, token);
    const lists = [];
    let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,name,displayName,webUrl,list&$top=200`;
    while (url) {
      const r = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } }, 'fetch lists');
      if (!r.ok) { let e; try { e = await r.text(); } catch { e = r.statusText; } throw new Error(`List fetch failed (${r.status}): ${e}`); }
      const d = await r.json();
      if (d.value) lists.push(...d.value);
      url = d['@odata.nextLink'] || null;
    }
    return lists;
  })();
  listsCache.set(key, { lists: existing?.lists || [], ts: existing?.ts || 0, fetching: fetchPromise });
  try {
    const lists = await fetchPromise;
    listsCache.set(key, { lists, ts: Date.now(), fetching: null });
    return filterVisibleLists(lists);
  } catch (err) {
    listsCache.set(key, { lists: existing?.lists || [], ts: existing?.ts || 0, fetching: null });
    throw err;
  }
}
async function resolveIdsOnly(siteUrl, token) {
  const { hostname, sitePath } = parseSiteUrl(siteUrl);
  const graphSiteUrl = (!sitePath || sitePath === '/') ? `https://graph.microsoft.com/v1.0/sites/${hostname}` : `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`;
  const r = await fetchWithRetry(graphSiteUrl, { headers: { Authorization: `Bearer ${token}` } }, 'resolve site');
  if (!r.ok) throw new Error(`Site resolution failed (${r.status})`);
  const s = await r.json();
  return { siteId: s.id };
}

/* ============================================================
   List Picker
   ============================================================ */
function createListPicker(container, options = {}) {
  const { getSiteUrl, getToken, onChange, initialValue = '', placeholder = 'Search or select a list...' } = options;
  container.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'list-picker';
  const inputWrap = document.createElement('div'); inputWrap.className = 'list-picker-input-wrap';
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'list-picker-input'; input.autocomplete = 'off';
  input.placeholder = placeholder;
  input.name = 'listpicker-' + Math.random().toString(36).slice(2, 8);
  input.id = input.name;
  const clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.className = 'list-picker-clear'; clearBtn.innerHTML = '✖';
  const refreshBtn = document.createElement('button'); refreshBtn.type = 'button'; refreshBtn.className = 'list-picker-refresh'; refreshBtn.innerHTML = '🔄';
  const list = document.createElement('div'); list.className = 'list-picker-list';
  inputWrap.appendChild(input); inputWrap.appendChild(clearBtn); inputWrap.appendChild(refreshBtn);
  wrap.appendChild(inputWrap); wrap.appendChild(list); container.appendChild(wrap);
  let isOpen = false, highlightedIndex = -1, filteredItems = [], selectedValue = initialValue || '';
  function setDisplayFromValue(val) {
    if (!val) { input.value = ''; clearBtn.style.display = 'none'; return; }
    const key = (getSiteUrl() || '').trim().replace(/\/$/, '').toLowerCase();
    const cached = listsCache.get(key);
    if (cached && cached.lists) {
      const found = cached.lists.find(l => l.displayName === val || l.name === val);
      if (found) { input.value = found.displayName; clearBtn.style.display = 'block'; return; }
    }
    input.value = val; clearBtn.style.display = 'block';
  }
  function openList() { if (isOpen) return; isOpen = true; list.classList.add('open'); loadAndRender(); }
  function closeList() { isOpen = false; list.classList.remove('open'); setDisplayFromValue(selectedValue); }
  async function loadAndRender(force = false) {
    const siteUrl = getSiteUrl(), token = getToken();
    if (!siteUrl || !token) { list.innerHTML = '<div class="list-picker-error">' + (!siteUrl && token ? '⚠ The <b>SharePoint Site URL</b> is empty (you are signed in, the token is fine).<br>Open <b>Settings → Global Connection Settings</b>, type the site address, e.g. <code>https://yourtenant.sharepoint.com/sites/YourSite</code>, click <b>Save IDs</b>, then Refresh.' : 'Global Site URL and Token are not configured.') + '</div>'; return; }
    list.innerHTML = '<div class="list-picker-loading">Loading lists...</div>';
    try { await getListsForSite(siteUrl, token, force); renderFiltered(input.value); }
    catch (err) { list.innerHTML = `<div class="list-picker-error">⚠ ${escapeHtml(err.message)}</div>`; }
  }
  function renderFiltered(query) {
    const q = (query || '').trim().toLowerCase();
    const key = (getSiteUrl() || '').trim().replace(/\/$/, '').toLowerCase();
    const allRaw = listsCache.get(key)?.lists || [];
    const all = filterVisibleLists(allRaw);
    const sorted = [...all].sort((a, b) => (a.displayName || a.name || '').localeCompare(b.displayName || b.name || ''));
    filteredItems = !q ? sorted : sorted.filter(l => (l.displayName || '').toLowerCase().includes(q) || (l.name || '').toLowerCase().includes(q));
    if (!filteredItems.length) { list.innerHTML = `<div class="combo-empty">${all.length ? 'No matching lists' : 'No lists assigned to you'}</div>`; return; }
    list.innerHTML = filteredItems.map((l, i) => `
      <div class="list-picker-item${i === highlightedIndex ? ' highlighted' : ''}" data-idx="${i}">
        <div><div class="list-name">${highlight(l.displayName || l.name, q)}</div><div class="list-meta">${highlight(l.name, q)}</div></div>
      </div>`).join('');
    list.querySelectorAll('.list-picker-item').forEach((el, i) => {
      el.addEventListener('mousedown', (e) => { e.preventDefault(); selectItem(filteredItems[i]); });
      el.addEventListener('mouseenter', () => { highlightedIndex = i; list.querySelectorAll('.list-picker-item').forEach((x, j) => x.classList.toggle('highlighted', j === i)); });
    });
  }
  function highlight(text, q) {
    const safe = escapeHtml(text || '');
    if (!q) return safe;
    try { return safe.replace(new RegExp('(' + escapeRegex(q) + ')', 'ig'), '<span class="mark">$1</span>'); } catch { return safe; }
  }
  function selectItem(item) {
    selectedValue = item.displayName || item.name;
    input.value = selectedValue; clearBtn.style.display = 'block';
    closeList();
    if (onChange) onChange(selectedValue, item);
  }
  input.addEventListener('focus', () => openList());
  input.addEventListener('input', () => { if (!isOpen) openList(); renderFiltered(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) { openList(); return; } highlightedIndex = Math.min(highlightedIndex + 1, filteredItems.length - 1); renderFiltered(input.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlightedIndex = Math.max(highlightedIndex - 1, 0); renderFiltered(input.value); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = filteredItems[highlightedIndex]; if (it) selectItem(it); }
    else if (e.key === 'Escape') { closeList(); input.blur(); }
  });
  clearBtn.addEventListener('mousedown', (e) => { e.preventDefault(); selectedValue = ''; input.value = ''; clearBtn.style.display = 'none'; closeList(); if (onChange) onChange('', null); });
  refreshBtn.addEventListener('mousedown', async (e) => { e.preventDefault(); await loadAndRender(true); });
  document.addEventListener('mousedown', (e) => { if (!wrap.contains(e.target) && isOpen) closeList(); });
  setDisplayFromValue(selectedValue);
  return {
    getValue: () => selectedValue,
    setValue: (v) => { selectedValue = v || ''; setDisplayFromValue(selectedValue); },
    refresh: () => loadAndRender(true),
  };
}

/* ============================================================
   Profiles
   ============================================================ */
const profiles = { list: [], activeId: null };
function userKeyPrefix() { return LS_BASE + "_u_" + (currentUser?.id || 'anon'); }
function profileKey(suffix = '') { return userKeyPrefix() + "_profile_" + profiles.activeId + (suffix ? "_" + suffix : ""); }
function loadProfiles() {
  try {
    const raw = localStorage.getItem(userKeyPrefix() + "_profiles");
    if (raw) { const p = JSON.parse(raw); profiles.list = p.list || []; profiles.activeId = p.activeId || null; }
    else { profiles.list = []; profiles.activeId = null; }
  } catch (e) { profiles.list = []; profiles.activeId = null; }
  if (!profiles.list.length) {
    const dp = { id: uid(), name: "Default", createdAt: Date.now(), defaultList: "" };
    profiles.list.push(dp); profiles.activeId = dp.id;
    saveProfiles();
  }
}
function saveProfiles() { try { localStorage.setItem(userKeyPrefix() + "_profiles", JSON.stringify({ list: profiles.list, activeId: profiles.activeId })); } catch (e) {} }
function getActiveProfile() { return profiles.list.find(p => p.id === profiles.activeId) || profiles.list[0]; }
function renderProfileSwitcher() {
  const sel = $('profileSelect');
  if (!sel) return;
  sel.innerHTML = profiles.list.map(p => `<option value="${p.id}" ${p.id === profiles.activeId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
}
function reloadProfileData() {
  const p = getActiveProfile();
  if (!p) return;
  $('setDefaultList').value = p.defaultList || '';
  exporterPicker?.setValue(p.defaultList || '');
  editorPicker?.setValue(p.defaultList || '');
  loadTargetsForProfile(); u_renderTargets(); u_renderMappingTable(); u_refreshUploadBtn();
  loadSchedulesFromStorage(); loadUploadSchedulesFromStorage(); renderSchedules(); renderUploadSchedules();
  loadNotificationSettings(); loadActivity(); renderActivity();
  applyGlobalSettingsToUI();
}

/* ============================================================
   Theme
   ============================================================ */
function applyTheme(t) {
  if (t === 'dark') { document.body.classList.add('dark'); $('themeToggle').textContent = '☀'; }
  else { document.body.classList.remove('dark'); $('themeToggle').textContent = '🌙'; }
  try { localStorage.setItem(LS_BASE + "_theme", t); } catch (e) {}
}
$('themeToggle').addEventListener('click', () => applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));
(function initTheme() {
  try { const s = localStorage.getItem(LS_BASE + "_theme"); if (s) applyTheme(s); else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark'); } catch (e) {}
})();

/* ============================================================
   Activity Log
   ============================================================ */
let activityLog = [];
function loadActivity() { try { const raw = localStorage.getItem(profileKey('activity')); activityLog = raw ? JSON.parse(raw) : []; } catch (e) { activityLog = []; } }
function saveActivity() { try { localStorage.setItem(profileKey('activity'), JSON.stringify(activityLog.slice(-MAX_ACTIVITY))); } catch (e) {} }
function renderActivity() {
  const body = $('activityBody');
  if (!activityLog.length) { body.innerHTML = '<div class="activity-empty">No activity yet.</div>'; $('activityToggle').classList.remove('has-badge'); return; }
  body.innerHTML = activityLog.slice().reverse().map(item => `
    <div class="activity-item">
      <div class="meta"><span class="kind ${item.kind}">${item.kind}</span><span>${formatDate(item.ts)}</span></div>
      <div class="detail">${escapeHtml(item.detail)}</div>
    </div>`).join('');
  const unread = activityLog.filter(x => !x.seen).length;
  const toggle = $('activityToggle');
  if (unread > 0) { toggle.classList.add('has-badge'); toggle.setAttribute('data-count', unread > 99 ? '99+' : unread); }
  else toggle.classList.remove('has-badge');
}
function addActivity(kind, detail) {
  activityLog.push({ id: uid(), kind, detail, ts: Date.now(), seen: false });
  if (activityLog.length > MAX_ACTIVITY) activityLog = activityLog.slice(-MAX_ACTIVITY);
  saveActivity(); renderActivity();
}
$('activityToggle').addEventListener('click', () => { $('activityDrawer').classList.add('open'); $('activityBackdrop').classList.add('open'); activityLog.forEach(x => x.seen = true); saveActivity(); renderActivity(); });
$('activityCloseBtn').addEventListener('click', () => { $('activityDrawer').classList.remove('open'); $('activityBackdrop').classList.remove('open'); });
$('activityBackdrop').addEventListener('click', () => { $('activityDrawer').classList.remove('open'); $('activityBackdrop').classList.remove('open'); });
$('activityClearBtn').addEventListener('click', () => { if (!confirm('Clear the entire activity log?')) return; activityLog = []; saveActivity(); renderActivity(); });
$('activityExportBtn').addEventListener('click', () => {
  if (!activityLog.length) return;
  const lines = [['Timestamp','Kind','Detail'].join(','), ...activityLog.map(x => [new Date(x.ts).toISOString(), x.kind, `"${String(x.detail).replace(/"/g, '""')}"`].join(','))];
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `activity_${Date.now()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});

/* ============================================================
   Navigation
   ============================================================ */
const VIEW_META = {
  wh3d: { title: '3D Warehouse View', sub: 'Racks and pallet storage visualised in 3D — colour by expiry, fill or SKU' },
  eqw: { title: 'Marketing Equipment Workshop', sub: 'Receive equipment from sales, estimate repair vs book value, assign technicians, track KPIs and asset history' },
  rmp: { title: 'RMPM Inventory Control', sub: 'Raw & packaging materials — GRN with QC, FEFO issue to production, alerts, bins, stock count' },
  wmv: { title: 'WHs Movements (FEFO)', sub: 'Inbound / outbound by pallets or bulk with FEFO batch allocation' },
  flt: { title: 'Fleet Management', sub: 'Vehicles, drivers, maintenance, fuel, documents, incidents, tyres and trips' },
  prj: { title: 'Project Progress', sub: 'Register projects, phase progress, costs and manpower' },
  smv: { title: 'Stock Movement Entry', sub: 'Receive / release SKUs by batch → SKUs_Movements_Batch_tbl' },
  home: { title: 'Dashboard', sub: 'Your starting point — every group and page you can open' },
  uploader: { title: 'Uploader', sub: 'Push Excel/CSV data to SharePoint lists' },
  warehouse: { title: 'Batch Allocation (FEFO)', sub: 'Warehouse order preparation with FEFO batch allocation' },
  listan: { title: 'List Analytics', sub: 'Self-adapting dashboard for any list downloaded from Data Download' },
  roster: { title: 'Staff Roster', sub: 'Daily time-slot availability, weekly plan and SharePoint push' },
  mdp: { title: 'Milco Daily Planning', sub: 'DSO demand, good returns and SharePoint stock → picking lists per route' },
  fdplan: { title: 'F&D Plan', sub: 'Dispatch plan, picking lists, trailers, compliance and delivery notes' },
  logplan: { title: 'Logistics Trip Planning', sub: 'Import the NE / SE plans or the daily template, add the required trips, review & amend, upload to SharePoint' },
  fdlog: { title: 'F&D Change Log', sub: 'Every SKU / quantity change made in a picking list — who, when, why' },
  'fdplan-upload': { title: 'F&D Picking Upload', sub: 'Upload the picking list of each trip / trailer to SharePoint' },
  fddemand: { title: 'F&D Demand — Weekly / Daily', sub: 'Upload the weekly and daily demand plans, set them up, and compare them with each other and with the actual quantities' },
  dailyplan: { title: 'Daily Plan Dashboard', sub: 'Production & delivery requirement by SKU and location' },
  'dailyplan-upload': { title: 'Daily Plan Upload', sub: 'Upload the daily plan file · save to SharePoint' },
  planning: { title: 'Planning Dashboard', sub: 'Inventory, cover and sales analysis — UHT tracking sheet' },
  'planning-upload': { title: 'Planning Data Upload', sub: 'Upload the daily Planning Data file' },
  brkplan: { title: 'Smart Break Planner', sub: 'Plan staggered breaks for one attendance shift — by role, region, warehouse and store' },
  leaveplan: { title: 'Annual Leave Planner', sub: 'Suggest annual leave through the year without leaving a role short of staff — then write it to the roster or queue it for SharePoint' },
  otrules: { title: 'Overtime, Slots & Breaks', sub: 'Overtime rules, the roster time slots and the break hours (several slots per person)' },
  att: { title: 'Attendance Analytics', sub: 'Biometric check IN / OUT analysis and roster-vs-actual comparison' },
  locsign: { title: 'Signboards & Rack Labels', sub: 'Location signboards, rack labels with barcodes, and the WHs code register used by Batch Allocation FEFO' },
  foc: { title: 'FOC Release Voucher', sub: 'Free-of-charge stock release with signatures, history and SharePoint upload' },
  mgt: { title: 'Management Daily Report', sub: 'Productivity, overtime, headcount and volumes from your SharePoint lists' },
  mgw: { title: 'Management Daily Report (SharePoint)', sub: 'Read directly from Mngmnt_Daily_Data_tbl with the targets from Trgt_tbl' },
  dailytracker: { title: 'Daily Update Tracker', sub: 'See which places update their data every day' },
  incupload: { title: 'Incremental Upload', sub: 'Upload only new rows from a cumulative Excel file' },
  exporter: { title: 'Exporter', sub: 'Pull SharePoint list data to Excel' },
  emailer: { title: 'Email Results', sub: 'Pull data from any SharePoint list and email it' },
  editor: { title: 'Record Editor', sub: 'Add · Edit · Bulk · Inline · History' },
  scheduler: { title: 'Scheduled Exports', sub: 'Recurring automated exports' },
  'scheduler-upload': { title: 'Scheduled Uploads', sub: 'Recurring automated uploads' },
  profiles: { title: 'Profiles', sub: 'Manage per-user configurations' },
  users: { title: 'Users & Roles', sub: 'Manage sign-in accounts and permissions' },
  notifications: { title: 'Email Notifications', sub: 'Alerts on failures' },
  uploaddest: { title: 'Upload Destinations & Data Sources', sub: 'Admin: SharePoint lists + field mapping for uploads and data sources' },
  settings: { title: 'Settings', sub: 'Global + personal settings' },
  help: { title: 'Help', sub: 'How to use this app' },
};
/* ---------- Refresh button for every section ---------- */
function activeViewId() { const v = document.querySelector('.view.active'); return v ? v.id.replace(/^view-/, '') : ''; }
function sectionToast(msg, type) {
  let t = document.querySelector('#sectionToast');
  if (!t) { t = document.createElement('div'); t.id = 'sectionToast'; t.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:100002;padding:10px 14px;border-radius:8px;background:#1e293b;color:#fff;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,.3);max-width:380px;'; document.body.appendChild(t); }
  t.textContent = msg; t.style.background = type === 'warn' ? '#b45309' : type === 'error' ? '#b91c1c' : '#166534'; t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 4000);
}
const REFRESH_VIEWS = new Set(['planning', 'dailyplan', 'uploader', 'warehouse', 'dailytracker', 'incupload', 'exporter', 'emailer', 'editor', 'scheduler', 'scheduler-upload']);
async function refreshSection(view) {
  if (view === 'planning') { plOpen.synced = false; plOpen(); sectionToast('🔄 Refreshing planning snapshots…', 'ok'); return; }
  if (view === 'dailyplan') { dpOpen.synced = false; dpOpen(); sectionToast('🔄 Refreshing daily plans…', 'ok'); return; }
  if (typeof refreshLocalView === 'function' && refreshLocalView(view)) return;
  if (!getGlobalAccessToken() || !getGlobalSiteUrl()) { sectionToast('Global Site URL and Token are not configured.', 'error'); return; }
  const click = id => { const b = document.querySelector('#' + id); if (b && !b.disabled) b.click(); return !!b; };
  listsCache.clear();   // forces every list picker / lookup to re-read SharePoint
  let what = 'list names';
  if (view === 'warehouse') { click('wFefoRefreshAllBtn'); what = 'batch list, UOM list and results'; }
  else if (view === 'dailytracker') { if (dtrk.data) { click('dtrkLoadBtn'); what = 'update tracker records'; } }
  else if (view === 'exporter') {
    if (expState.allItems.length) { click(expState.preFilters && expState.preFilters.length ? 'expApplyAndLoadBtn' : 'expLoadBtn'); what = 'list data'; }
    else if (expState.columnsLoadedFor) { click('expLoadColumnsBtn'); what = 'columns'; }
    click('expReloadValuesBtn');
  } else if (view === 'emailer') {
    if (emlState.allItems.length) { click('emlLoadAllBtn'); what = 'list data'; } else if (emlState.columnsLoadedFor) { click('emlLoadColumnsBtn'); what = 'columns'; }
    click('emlReloadValuesBtn');
  } else if (view === 'editor') { if (editorState.listId) { click('editorLoadBtn'); what = 'records'; } }
  sectionToast(`🔄 Refreshing ${what}…`, 'ok');
  addActivity('settings', `Refreshed section: ${view}`);
}
$('sectionRefreshBtn').addEventListener('click', () => refreshSection(activeViewId()));
(function () {
  const upd = () => { $('sectionRefreshBtn').style.display = ''; };
  new MutationObserver(upd).observe($('topbarTitle'), { childList: true, characterData: true, subtree: true }); upd();
})();

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (item.classList.contains('locked')) return;
    const view = item.dataset.view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('view-' + view).classList.add('active');
    $('topbarTitle').textContent = VIEW_META[view].title;
    $('topbarSub').textContent = VIEW_META[view].sub;
    if (view === 'settings') applyGlobalSettingsToUI();
  });
});

function syncToken() {
  const t = getGlobalAccessToken();
  const pill = $('tokenPill'), text = $('tokenPillText');
  if (throttleActive) return;
  if (t && !getGlobalSiteUrl()) { pill.classList.remove('ok'); pill.classList.add('throttled'); text.textContent = 'Token ready — Site URL missing'; }
  else if (t) { pill.classList.add('ok'); pill.classList.remove('throttled'); text.textContent = 'Token ready'; }
  else { pill.classList.remove('ok'); pill.classList.remove('throttled'); text.textContent = 'No token — Admin required'; }
}

/* ============================================================
   Graph API
   ============================================================ */
function parseSiteUrl(url) { const u = new URL(url); return { hostname: u.hostname, sitePath: u.pathname.replace(/\/$/, '') }; }
async function resolveIds(siteUrl, listName, token) {
  const { hostname, sitePath } = parseSiteUrl(siteUrl);
  const graphSiteUrl = (!sitePath || sitePath === '/') ? `https://graph.microsoft.com/v1.0/sites/${hostname}` : `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`;
  const siteResp = await fetchWithRetry(graphSiteUrl, { headers: { Authorization: `Bearer ${token}` } }, 'resolve site');
  if (!siteResp.ok) throw new Error(`Site resolution failed (${siteResp.status})`);
  const site = await siteResp.json();
  const listResp = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${site.id}/lists?$filter=displayName eq '${listName.replace(/'/g, "''")}'`, { headers: { Authorization: `Bearer ${token}` } }, 'resolve list');
  if (!listResp.ok) throw new Error(`List resolution failed (${listResp.status})`);
  const listData = await listResp.json();
  if (!listData.value || !listData.value.length) throw new Error(`List "${listName}" not found`);
  try { (window.spListNames = window.spListNames || {})[listData.value[0].id] = listName; } catch (e) {}
  return { siteId: site.id, listId: listData.value[0].id };
}
async function fetchColumns(siteId, listId, token) {
  const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns`, { headers: { Authorization: `Bearer ${token}` } }, 'fetch columns');
  if (!r.ok) throw new Error(`Column fetch failed (${r.status})`);
  const d = await r.json();
  const typed = d.value.map(c => spColType(c)); (window.SP_COLT = window.SP_COLT || {})[listId] = Object.fromEntries(typed.map(t => [t.name, t]));
  return d.value.map(c => ({ name: c.name, displayName: c.displayName || c.name, type: spColType(c).type }));
}
/* what kind of value a SharePoint column accepts — used to convert the uploaded values (a date, a number …) so SharePoint does not reject the row */
function spColType(c) {
  let type = 'text', choices = null; if (c.choice) { type = 'choice'; choices = c.choice.choices || []; } else if (c.text && c.text.allowMultipleLines) type = 'multiline'; else if (c.number !== undefined) type = 'number'; else if (c.currency !== undefined) type = 'number'; else if (c.dateTime) type = 'date'; else if (c.boolean) type = 'boolean';
  else if (c.hyperlinkOrPicture) type = 'link'; else if (c.lookup) type = 'lookup'; else if (c.personOrGroup) type = 'person'; else if (c.term) type = 'term'; else if (c.calculated) type = 'calculated';
  return { name: c.name, type, dateOnly: c.dateTime ? c.dateTime.format === 'dateOnly' : false, choices, max: c.text && !c.text.allowMultipleLines ? (c.text.maxLength || 255) : 0, decimals: c.number && c.number.decimalPlaces };
}
function spParseDate(v) {
  if (v instanceof Date) return isNaN(v) ? null : v; if (v == null || v === '') return null;
  if (typeof v === 'number') return v > 20000 && v < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.round(v * 864e5) + 12 * 36e5 - 12 * 36e5) : null;
  const t = String(v).trim(); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(t))) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
  if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(t))) { let y = +m[3]; if (y < 100) y += 2000; let d = +m[1], mo = +m[2]; if (mo > 12 && d <= 12) { const x = d; d = mo; mo = x; } return new Date(Date.UTC(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0))); }
  const p = Date.parse(t); if (isNaN(p)) return null; const dd = new Date(p); dd._loc = true; return dd;
}
function spCoerceFields(listId, fields) {
  const T = (window.SP_COLT || {})[listId]; if (!T) return fields; const out = {};
  for (const [k, v] of Object.entries(fields)) {
    const c = T[k]; if (!c || v == null || v === '') { out[k] = v; continue; }
    if (c.type === 'number') { const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s]/g, '')); if (isFinite(n)) out[k] = n; }
    else if (c.type === 'date') { let d = spParseDate(v); if (!d && typeof v === 'string') { const p = new Date(v); if (!isNaN(p)) d = p; }
      if (d) { const loc = v instanceof Date || !!d._loc; const base = loc ? new Date(d.getTime() + 6 * 36e5) : d; const iso = (loc ? base.toISOString() : d.toISOString()); out[k] = c.dateOnly ? iso.slice(0, 10) : (loc ? iso.slice(0, 10) + 'T00:00:00Z' : iso); } }
    else if (c.type === 'boolean') out[k] = typeof v === 'boolean' ? v : /^(true|yes|y|1|✔)$/i.test(String(v).trim());
    else if (c.type === 'text') out[k] = c.max ? String(v).slice(0, c.max) : String(v);
    else if (c.type === 'choice') { const sv = String(v), hit = (c.choices || []).find(x => String(x).toLowerCase() === sv.trim().toLowerCase()); out[k] = hit != null ? hit : sv; }
    else if (c.type === 'link') out[k] = typeof v === 'object' ? v : { Url: String(v), Description: String(v) };
    else if (c.type === 'multiline') out[k] = String(v);
    else if (c.type === 'lookup' || c.type === 'person' || c.type === 'term' || c.type === 'calculated') { /* cannot be written as plain text — left out so the rest of the row is still saved */ }
    else out[k] = v;
  }
  return out;
}
function spBadHint(listId, fields) {
  const T = (window.SP_COLT || {})[listId]; if (!T) return ''; const bad = [];
  Object.entries(fields).forEach(([k, v]) => { const c = T[k]; if (!c) bad.push(`“${k}” is not a column of this list`); });
  return bad.length ? ' — ' + bad.slice(0, 4).join('; ') : '';
}
async function fetchColumnsDetailed(siteId, listId, token) {
  const r = await fetchWithRetry(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns`, { headers: { Authorization: `Bearer ${token}` } }, 'fetch columns');
  if (!r.ok) throw new Error(`Column fetch failed (${r.status})`);
  const d = await r.json();
  return d.value.map(col => {
    let type = 'text', choices = null;
    if (col.choice) { type = 'choice'; choices = col.choice.choices || []; }
    else if (col.text && col.text.allowMultipleLines) type = 'multiline';
    else if (col.number !== undefined) type = 'number';
    else if (col.dateTime) type = 'date';
    else if (col.boolean) type = 'boolean';
    else if (col.hyperlinkOrPicture) type = 'hyperlinkOrPicture';
    else if (col.lookup) type = 'lookup';
    else if (col.personOrGroup) type = 'personOrGroup';
    else if (col.term) type = 'term';
    else if (col.calculated) type = 'calculated';
    const readOnly = READ_ONLY_COLUMNS.has(col.name.toLowerCase()) || col.readOnly === true || UNSUPPORTED_EDIT_TYPES.has(type);
    return { name: col.name, displayName: col.displayName || col.name, type, dateOnly: col.dateTime ? col.dateTime.format === 'dateOnly' : undefined, choices, readOnly, required: col.required === true, description: col.description || '', default: col.defaultValue?.value ?? '' };
  });
}
