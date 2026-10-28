
/* ---------- Stock Movement Entry (SKUs_Movements_Batch_tbl) ---------- */
(function () {
  const Q = s => document.querySelector(s), esc = escapeHtml, ID = 'smv', DEF_LIST = 'SKUs_Movements_Batch_tbl';
  const F = [['Trans_Date', 'Transaction date', ['transdate', 'date']], ['SKU_Code', 'SKU code', ['skucode', 'sku']], ['SKU_Dtls', 'SKU description', ['skudtls', 'skudetails', 'description']], ['Batch_Code', 'Batch code', ['batchcode', 'batch']], ['Qty_Rcvd', 'Quantity received', ['qtyrcvd', 'received']], ['Qty_Rlsd', 'Quantity released', ['qtyrlsd', 'released']], ['Qty_Bal', 'Quantity balance', ['qtybal', 'balance']], ['Prod_Date', 'Production date', ['proddate', 'productiondate']], ['Expiry_Date', 'Expiry date', ['expirydate', 'expiry']], ['Recevied_Trl_Nr', 'Received trailer no. / source', ['receviedtrlnr', 'receivedtrlnr', 'trailer']], ['UOM_Base', 'UoM base (units per UoM)', ['uombase']], ['UOM_Desc', 'UoM', ['uomdesc', 'uom']], ['User_Name', 'User name', ['username', 'user']], ['Ref_Nr', 'Reference no.', ['refnr', 'reference']], ['Action_TimeStamp', 'Action time stamp', ['actiontimestamp', 'timestamp']], ['Trans_Type', 'Transaction type', ['transtype', 'type']]];
  utRegister(ID, { section: 'Warehouse', label: 'Stock Movement Entry → SKUs_Movements_Batch_tbl', fields: () => F.map(f => ({ key: f[0], label: f[1], alias: [f[0]].concat(f[2]), doc: true })), note: 'Used by Warehouse → Stock Movement Entry. The list defaults to ' + DEF_LIST + ' and the columns are matched by name automatically.' });
  const st = { type: 'SKU Receive', lines: [], hist: null, loading: false, saving: false, n: 0 };
  const uid = () => (currentUser && currentUser.id) || 'anon', DK = () => LS_BASE + '_smv_draft_' + uid();
  const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => iso(new Date());
  function pd(v) { if (v == null || v === '') return ''; if (v instanceof Date) return isNaN(v) ? '' : iso(v); if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 864e5)); return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
    const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3]; m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); if (m) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]); const d = new Date(s); return isNaN(d) ? '' : iso(d); }
  const toDate = s => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const addDays = (s, n) => { const d = toDate(s); if (!d) return ''; d.setDate(d.getDate() + n); return iso(d); };
  const dayDiff = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; };
  const fmt = n => (Math.round(n * 1000) / 1000).toLocaleString();
  const stamp = () => { const d = new Date(), M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()]; let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${M} ${d.getDate()}, ${d.getFullYear()} ${h}:${pad(d.getMinutes())} ${ap}`; };
  const msg = (t, k) => sectionToast(t, k);
  const blank = () => ({ id: ++st.n, sku: '', dtls: '', batch: '', prod: '', exp: '', rcvd: '', rlsd: '', uom: 'PC', base: '1' });
  const head = () => ({ date: (Q('#smvDate') || {}).value || today(), ref: (Q('#smvRef') || {}).value || '', trl: (Q('#smvTrl') || {}).value || '' });
  const saveDraft = () => { try { localStorage.setItem(DK(), JSON.stringify({ type: st.type, h: head(), lines: st.lines })); } catch (e) {} };
  const css = document.createElement('style'); css.textContent = `
#view-smv .smv-seg{display:inline-flex;border:1px solid var(--border);border-radius:10px;overflow:hidden}#view-smv .smv-seg button{border:0;background:transparent;color:inherit;padding:9px 18px;font-weight:600;cursor:pointer;font-size:14px}
#view-smv .smv-seg button.on{background:var(--brand);color:#fff}#view-smv .smv-seg button.on.rel{background:#b45309}
#view-smv .smv-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}#view-smv .smv-kpi{border:1px solid var(--border);border-radius:12px;padding:10px 14px}#view-smv .smv-kpi span{font-size:12px;color:var(--gray-600);display:block}#view-smv .smv-kpi b{font-size:20px}
#view-smv .smv-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px}#view-smv table.smv-t{width:100%;border-collapse:collapse;font-size:13px}#view-smv .smv-t th{background:var(--brand-light,#eef2fb);text-align:left;padding:8px 6px;font-size:12px;white-space:nowrap;position:sticky;top:0}
#view-smv .smv-t td{padding:4px 5px;border-top:1px solid var(--border);vertical-align:middle}#view-smv .smv-t input,#view-smv .smv-t select{width:100%;margin:0!important;padding:6px 7px!important;font-size:13px!important;min-width:0}
#view-smv .smv-t td.c{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}#view-smv .smv-bad{outline:2px solid #dc2626;border-radius:6px}#view-smv .smv-ok{color:#047857}#view-smv .smv-neg{color:#b91c1c;font-weight:700}
#view-smv #smvRoot ~ .tbl-expand-bar,#view-smv .tbl-expand-bar,#view-smv .hc-bar,#view-smv .hc-btn,#view-smv .tbl-expand-btn{display:none!important}
#view-smv .smv-t{min-width:980px}
#smvCard.smv-full{position:fixed;inset:10px;z-index:2000;margin:0!important;overflow:auto;box-shadow:0 20px 70px rgba(0,0,0,.45);background:var(--card,#fff);border-radius:14px}#smvCard .tbl-expand-inline{display:none!important}
#smvCard.smv-full .tbl-expand-bar,#smvCard.smv-full .hc-bar{display:none!important}
body.smv-fs{overflow:hidden}
#view-smv .smv-hint{font-size:12px;color:var(--gray-600)}#view-smv .smv-pill{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;font-weight:700}#view-smv .smv-pill.r{background:#dcfce7;color:#166534}#view-smv .smv-pill.l{background:#fef3c7;color:#92400e}
body.dark #view-smv .smv-pill.r{background:#14532d;color:#bbf7d0}body.dark #view-smv .smv-pill.l{background:#78350f;color:#fde68a}
#smvPaste{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px}#smvPaste .card{max-width:760px;width:100%;margin:0}`;
  document.head.appendChild(css);
  /* ---------- history (SKU master, batches, balances) ---------- */
  async function loadHist(force) {
    if (st.loading) return; if (st.hist && !force) return; const c = utGet(ID); if (!c.list) utSet(ID, { list: DEF_LIST, map: c.map || {} });
    const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) { say('Sign-in / Site URL is not ready — suggestions are off. You can still type everything by hand.', 1); return; }
    st.loading = true; say('Loading recent movements and SKU master from SharePoint…');
    try { const list = utGet(ID).list || DEF_LIST, ids = await resolveIds(site, list, token); try { await fetchColumns(ids.siteId, ids.listId, token); } catch (e) {}
      const items = await fetchRecentItems(ids.siteId, ids.listId, token, 6000), rows = items.map(i => i.fields || i).filter(Boolean); build(rows); say('✔ ' + rows.length + ' movements read from ' + list + ' · ' + st.hist.sku.size + ' SKUs known.'); }
    catch (e) { say('Could not read the list: ' + e.message, 1); st.hist = st.hist || build([]); } finally { st.loading = false; render(); }
  }
  function build(rows) {
    const sku = new Map(), bal = new Map();
    rows.forEach(r => { const code = String(r.SKU_Code || '').trim(); if (!code) return; const s = sku.get(code) || { code, dtls: '', uom: '', base: '', shelf: [], batches: new Map() };
      if (!s.dtls && r.SKU_Dtls) s.dtls = r.SKU_Dtls; if (!s.uom && r.UOM_Desc) s.uom = r.UOM_Desc; if (!s.base && r.UOM_Base) s.base = String(r.UOM_Base);
      const p = pd(r.Prod_Date), x = pd(r.Expiry_Date); if (p && x) { const d = dayDiff(p, x); if (d > 0 && d < 1500) s.shelf.push(d); }
      const b = String(r.Batch_Code == null ? '' : r.Batch_Code).trim(); if (b !== '') { const o = s.batches.get(b) || { batch: b, prod: '', exp: '', bal: 0 }; if (!o.prod && p) o.prod = p; if (!o.exp && x) o.exp = x; o.bal += num(r.Qty_Rcvd) - num(r.Qty_Rlsd); s.batches.set(b, o); }
      sku.set(code, s); });
    sku.forEach(s => { s.shelf.sort((a, b) => a - b); s.sd = s.shelf.length ? s.shelf[Math.floor(s.shelf.length / 2)] : 0; });
    const recent = rows.slice(0, 15), refs = new Set(rows.map(r => [r.Trans_Type, r.Ref_Nr, r.SKU_Code, r.Batch_Code].join('|')));
    return (st.hist = { sku, recent, refs, rows: rows.length }); }
  function say(t, w) { const e = Q('#smvStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } }
  /* ---------- line logic ---------- */
  function fillSku(L) { const h = st.hist, s = h && h.sku.get(String(L.sku).trim()); if (!s) return false; L.dtls = s.dtls || L.dtls; if (s.uom) L.uom = s.uom; if (s.base) L.base = s.base; return true; }
  function fillBatch(L) { const s = st.hist && st.hist.sku.get(String(L.sku).trim()), b = s && s.batches.get(String(L.batch).trim()); if (b) { if (b.prod && !L.prod) L.prod = b.prod; if (b.exp && !L.exp) L.exp = b.exp; } }
  const avail = L => { const s = st.hist && st.hist.sku.get(String(L.sku).trim()), b = s && s.batches.get(String(L.batch).trim()); return b ? b.bal : null; };
  const bal = L => num(L.rcvd) - num(L.rlsd);
  function problems(L, i) { const p = [], rel = st.type === 'SKU Release';
    if (!String(L.sku).trim()) p.push('SKU code'); if (String(L.batch).trim() === '') p.push('Batch code');
    if (!(rel ? num(L.rlsd) > 0 : num(L.rcvd) > 0)) p.push(rel ? 'Quantity released' : 'Quantity received');
    if (!rel) { if (!L.prod) p.push('Production date'); if (!L.exp) p.push('Expiry date'); }
    if (L.prod && L.exp && L.exp <= L.prod) p.push('Expiry must be after production'); return p; }
  /* ---------- rendering ---------- */
  function render() {
    const root = Q('#smvRoot'); if (!root) return; const rel = st.type === 'SKU Release', h0 = head(), keep = { date: h0.date, ref: h0.ref, trl: h0.trl };
    const ak = document.activeElement, ref = ak && ak.dataset && ak.dataset.f ? [ak.closest('tr').dataset.id, ak.dataset.f, ak.selectionStart] : null;
    const sk = st.hist ? [...st.hist.sku.values()] : [];
    root.innerHTML = `<datalist id="smvSkuDl">${sk.map(s => `<option value="${esc(s.code)}">${esc(s.dtls)}</option>`).join('')}</datalist>
    ${st.lines.map(L => { const s = st.hist && st.hist.sku.get(String(L.sku).trim()); return `<datalist id="smvB${L.id}">${s ? [...s.batches.values()].map(b => `<option value="${esc(b.batch)}">${esc((b.exp ? 'exp ' + b.exp + ' · ' : '') + 'bal ' + fmt(b.bal))}</option>`).join('') : ''}</datalist>`; }).join('')}
    <div class="smv-kpis"><div class="smv-kpi"><span>Lines</span><b id="smvKL">0</b></div><div class="smv-kpi"><span>Total received</span><b id="smvKR">0</b></div><div class="smv-kpi"><span>Total released</span><b id="smvKX">0</b></div><div class="smv-kpi"><span>Net balance</span><b id="smvKB">0</b></div><div class="smv-kpi"><span>Entered by</span><b style="font-size:15px">${esc(getCurrentUserValue())}</b></div></div>
    <div class="smv-wrap"><table class="smv-t"><thead><tr><th>SKU code *</th><th>Description</th><th>Batch *</th><th>Prod. date${rel ? '' : ' *'}</th><th>Expiry${rel ? '' : ' *'}</th><th>Qty received${rel ? '' : ' *'}</th><th>Qty released${rel ? ' *' : ''}</th><th>Balance</th><th>UoM</th><th>Base</th>${rel ? '<th>Available</th>' : ''}<th></th></tr></thead><tbody>
    ${st.lines.map((L, i) => `<tr data-id="${L.id}">
      <td style="min-width:120px"><input data-f="sku" list="smvSkuDl" value="${esc(L.sku)}" autocomplete="off" placeholder="e.g. GF2001"></td>
      <td style="min-width:200px"><input data-f="dtls" value="${esc(L.dtls)}" placeholder="auto from SKU"></td>
      <td style="min-width:100px"><input data-f="batch" list="smvB${L.id}" value="${esc(L.batch)}" autocomplete="off" placeholder="batch"></td>
      <td style="min-width:130px"><input type="date" data-f="prod" value="${esc(L.prod)}"></td><td style="min-width:130px"><input type="date" data-f="exp" value="${esc(L.exp)}"></td>
      <td style="min-width:95px"><input data-f="rcvd" inputmode="decimal" value="${esc(L.rcvd)}" ${rel ? 'title="Optional on a release"' : ''}></td><td style="min-width:95px"><input data-f="rlsd" inputmode="decimal" value="${esc(rel ? L.rlsd : '')}" ${rel ? '' : 'disabled placeholder="0"'}></td>
      <td class="c" data-c="bal">0</td>
      <td style="min-width:70px"><select data-f="uom">${['PC', 'CT', 'OT', 'TR', 'KG'].concat(L.uom && !['PC', 'CT', 'OT', 'TR', 'KG'].includes(L.uom) ? [L.uom] : []).map(u => `<option ${u === L.uom ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></td>
      <td style="min-width:60px"><input data-f="base" value="${esc(L.base)}"></td>${rel ? '<td class="c" data-c="av">—</td>' : ''}
      <td><button class="ghost small" type="button" data-rm="${L.id}" title="Remove line">✕</button></td></tr>`).join('') || `<tr><td colspan="12" style="text-align:center;padding:26px;color:var(--gray-600)">No lines yet — press <b>➕ Add line</b> or paste from Excel.</td></tr>`}
    </tbody></table></div>`;
    Object.entries(keep).forEach(([k, v]) => { const el = Q({ date: '#smvDate', ref: '#smvRef', trl: '#smvTrl' }[k]); if (el && v) el.value = v; });
    calc(); if (ref) { const el = root.querySelector(`tr[data-id="${ref[0]}"] [data-f="${ref[1]}"]`); if (el) { el.focus(); try { el.setSelectionRange(ref[2], ref[2]); } catch (e) {} } }
    renderRecent();
  }
  function calc() { const rel = st.type === 'SKU Release'; let r = 0, x = 0;
    st.lines.forEach(L => { const tr = Q(`#smvRoot tr[data-id="${L.id}"]`); if (!tr) return; r += num(L.rcvd); x += rel ? num(L.rlsd) : 0; const b = bal(L), c = tr.querySelector('[data-c="bal"]'); if (c) { c.textContent = fmt(b); c.className = 'c ' + (b < 0 ? 'smv-neg' : ''); }
      const a = tr.querySelector('[data-c="av"]'); if (a) { const v = avail(L); a.textContent = v == null ? '—' : fmt(v); a.className = 'c ' + (v != null && num(L.rlsd) > v ? 'smv-neg' : v != null ? 'smv-ok' : ''); } });
    const set = (id, v) => { const e = Q(id); if (e) e.textContent = v; }; set('#smvKL', st.lines.length); set('#smvKR', fmt(r)); set('#smvKX', fmt(x)); set('#smvKB', fmt(r - x)); }
  function renderRecent() { const h = Q('#smvRecent'); if (!h) return; const rec = st.hist ? st.hist.recent : [];
    h.innerHTML = rec.length ? `<div class="smv-wrap"><table class="smv-t" style="min-width:820px"><thead><tr><th>Date</th><th>Type</th><th>SKU</th><th>Description</th><th>Batch</th><th>Rcvd</th><th>Rlsd</th><th>Bal</th><th>Ref</th><th></th></tr></thead><tbody>${rec.map((r, i) => `<tr><td>${esc(pd(r.Trans_Date))}</td><td><span class="smv-pill ${/Release/.test(r.Trans_Type) ? 'l' : 'r'}">${esc(r.Trans_Type || '—')}</span></td><td>${esc(r.SKU_Code)}</td><td>${esc(r.SKU_Dtls)}</td><td>${esc(r.Batch_Code)}</td><td class="c">${fmt(num(r.Qty_Rcvd))}</td><td class="c">${fmt(num(r.Qty_Rlsd))}</td><td class="c">${fmt(num(r.Qty_Bal))}</td><td>${esc(r.Ref_Nr)}</td><td><button class="ghost small" type="button" data-reuse="${i}" title="Copy this line into the form">↩ Reuse</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="smv-hint">Recent movements appear here once the list has been read.</div>'; }
  /* ---------- actions ---------- */
  function addLines(n) { for (let i = 0; i < n; i++) st.lines.push(blank()); render(); saveDraft(); }
  function setType(t) { st.type = t; Q('#smvRoot').closest('.card').querySelectorAll('[data-type]').forEach(b => { b.classList.toggle('on', b.dataset.type === t); b.classList.toggle('rel', t === 'SKU Release' && b.dataset.type === t); }); if (t !== 'SKU Release') st.lines.forEach(L => { L.rlsd = ''; }); render(); saveDraft(); }
  function parseRows(grid) { const first = grid[0] || [], hdr = first.map(x => String(x || '').toLowerCase().replace(/[^a-z]/g, '')), hasH = hdr.includes('skucode'); const idx = k => hdr.indexOf(k), body = hasH ? grid.slice(1) : grid, out = [], H = {};
    body.forEach(r => { if (!r || !r.some(x => x !== '' && x != null)) return; const g = (k, d) => hasH ? (idx(k) >= 0 ? r[idx(k)] : '') : r[d]; const L = blank(); L.sku = String(g('skucode', 0) || '').trim(); L.batch = String(g('batchcode', 1) == null ? '' : g('batchcode', 1)).trim();
      if (hasH) { L.dtls = String(g('skudtls') || ''); L.rcvd = g('qtyrcvd') === '' ? '' : String(g('qtyrcvd')); L.rlsd = g('qtyrlsd') === '' ? '' : String(g('qtyrlsd')); L.prod = pd(g('proddate')); L.exp = pd(g('expirydate')); L.uom = String(g('uomdesc') || 'PC'); L.base = String(g('uombase') || '1');
        if (!H.type && g('transtype')) H.type = String(g('transtype')); if (!H.date && g('transdate')) H.date = pd(g('transdate')); if (!H.ref && g('refnr')) H.ref = String(g('refnr')); if (!H.trl && idx('receviedtrlnr') >= 0 && r[idx('receviedtrlnr')]) H.trl = String(r[idx('receviedtrlnr')]).trim(); }
      else { const q = String(g('', 2) || ''); if (st.type === 'SKU Release') L.rlsd = q; else L.rcvd = q; L.prod = pd(r[3]); L.exp = pd(r[4]); }
      fillSku(L); fillBatch(L); out.push(L); }); return { lines: out, H }; }
  function applyGrid(grid) { const { lines, H } = parseRows(grid); if (!lines.length) return msg('No lines found in that data.', 'warn'); if (H.type && /release/i.test(H.type)) st.type = 'SKU Release'; else if (H.type && /receive/i.test(H.type)) st.type = 'SKU Receive';
    if (st.type !== 'SKU Release') lines.forEach(L => { if (!L.rcvd && L.rlsd) L.rcvd = L.rlsd; L.rlsd = ''; });
    st.lines = st.lines.filter(L => L.sku || L.batch).concat(lines); setType(st.type); if (H.date) Q('#smvDate').value = H.date; if (H.ref) Q('#smvRef').value = H.ref; if (H.trl) Q('#smvTrl').value = H.trl; saveDraft(); msg('✔ ' + lines.length + ' line(s) added.'); }
  function pasteBox() { let m = Q('#smvPaste'); if (m) m.remove(); m = document.createElement('div'); m.id = 'smvPaste'; m.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">📋 Paste from Excel</div><button class="ghost small" data-x="1" type="button">✖ Close</button></div><div class="card-desc">Copy cells in Excel and paste below. With the <b>sample file's headers</b> (SKU_Code, Batch_Code, Qty_Rcvd, Qty_Rlsd, Prod_Date, Expiry_Date …) every column is used. Without headers use the order <b>SKU code · Batch · Quantity · Production date · Expiry date</b>.</div><textarea id="smvPasteTa" rows="10" style="width:100%" placeholder="Paste here…"></textarea><div class="btn-row" style="margin-top:10px"><button class="success" data-ok="1" type="button">➕ Add lines</button><button class="ghost" data-x="1" type="button">Cancel</button></div></div>`; document.body.appendChild(m);
    m.onclick = e => { if (e.target === m || e.target.closest('[data-x]')) m.remove(); else if (e.target.closest('[data-ok]')) { const t = Q('#smvPasteTa').value.replace(/\r/g, ''); m.remove(); applyGrid(t.split('\n').filter(x => x.trim() !== '').map(l => l.split('\t').map(x => x.trim()))); } }; setTimeout(() => { const t = Q('#smvPasteTa'); if (t) t.focus(); }, 50); }
  async function importFile(f) { try { const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true }); const ws = wb.Sheets[wb.SheetNames[0]]; applyGrid(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })); } catch (e) { msg('Could not read that file: ' + e.message, 'error'); } }
  async function save() {
    if (st.saving) return; const h = head(), rel = st.type === 'SKU Release', lines = st.lines.filter(L => String(L.sku).trim() || String(L.batch).trim() || num(L.rcvd) || num(L.rlsd));
    const errs = []; if (!h.date) errs.push('Transaction date'); if (!h.ref.trim()) errs.push('Reference no.'); if (!lines.length) errs.push('at least one line');
    document.querySelectorAll('#smvRoot .smv-bad').forEach(e => e.classList.remove('smv-bad'));
    lines.forEach((L, i) => { const p = problems(L, i); if (p.length) { errs.push('Line ' + (st.lines.indexOf(L) + 1) + ': ' + p.join(', ')); const tr = Q(`#smvRoot tr[data-id="${L.id}"]`); if (tr) tr.querySelectorAll('input').forEach(inp => { const f = inp.dataset.f; if (!inp.disabled && ((f === 'sku' && p.includes('SKU code')) || (f === 'batch' && p.includes('Batch code')) || (f === 'prod' && p.some(x => /Production|Expiry must/.test(x))) || (f === 'exp' && p.some(x => /Expiry/.test(x))) || ((f === 'rcvd' && p.includes('Quantity received')) || (f === 'rlsd' && p.includes('Quantity released'))))) inp.classList.add('smv-bad'); }); } });
    ['#smvDate', '#smvRef'].forEach(i => { const e = Q(i); if (e) e.classList.toggle('smv-bad', !e.value.trim()); });
    if (errs.length) { say('Please complete: ' + errs.slice(0, 4).join(' · ') + (errs.length > 4 ? ' …' : ''), 1); msg('Some required fields are missing — highlighted in red.', 'warn'); return; }
    const seen = new Set(), dup = []; lines.forEach(L => { const k = [L.sku.trim(), L.batch.trim()].join('|'); if (seen.has(k)) dup.push(L.sku + ' / ' + L.batch); seen.add(k); });
    if (dup.length && !confirm('The same SKU + batch appears more than once: ' + dup.slice(0, 3).join(', ') + '.\n\nSave anyway?')) return;
    const there = lines.filter(L => st.hist && st.hist.refs.has([st.type, h.ref.trim(), L.sku.trim(), L.batch.trim()].join('|'))); if (there.length && !confirm(there.length + ' line(s) already exist in SharePoint with the same reference, SKU and batch (' + there.slice(0, 2).map(L => L.sku + '/' + L.batch).join(', ') + ').\n\nSave again?')) return;
    const over = rel ? lines.filter(L => { const a = avail(L); return a != null && num(L.rlsd) > a; }) : []; if (over.length && !confirm(over.length + ' line(s) release more than the available balance (' + over.slice(0, 3).map(L => L.sku + '/' + L.batch).join(', ') + ').\n\nSave anyway?')) return;
    if (!confirm('Save ' + lines.length + ' ' + st.type.replace('SKU ', '').toLowerCase() + ' line(s) to SharePoint?')) return;
    st.saving = true; const b = Q('#smvSave'); if (b) b.disabled = true; const ts = stamp(), d = toDate(h.date);
    const rows = lines.map(L => ({ Trans_Date: d, SKU_Code: L.sku.trim(), SKU_Dtls: L.dtls, Batch_Code: String(L.batch).trim(), Qty_Rcvd: num(L.rcvd), Qty_Rlsd: rel ? num(L.rlsd) : 0, Qty_Bal: bal(L), Prod_Date: L.prod ? toDate(L.prod) : '', Expiry_Date: L.exp ? toDate(L.exp) : '', Recevied_Trl_Nr: h.trl.trim(), UOM_Base: String(L.base || ''), UOM_Desc: L.uom, User_Name: getCurrentUserValue(), Ref_Nr: h.ref.trim(), Action_TimeStamp: ts, Trans_Type: st.type }));
    try { const c = utGet(ID); if (!c.list) utSet(ID, { list: DEF_LIST, map: c.map || {} }); try { const ids = await resolveIds(getGlobalSiteUrl(), utGet(ID).list, getGlobalAccessToken()); await fetchColumns(ids.siteId, ids.listId, getGlobalAccessToken()); } catch (e) {}
      const r = await utPush(ID, rows, x => x.SKU_Code + '/' + x.Batch_Code, (n, t) => say('Saving… ' + n + '/' + t));
      if (r.fail) { say('Saved ' + r.ok + ', failed ' + r.fail + ': ' + (r.errors[0] || ''), 1); msg('⚠ ' + r.fail + ' line(s) failed — nothing was cleared, check the message and try again.', 'error'); }
      else { msg('✔ ' + r.ok + ' line(s) saved to ' + r.list + '.'); say('✔ Saved ' + r.ok + ' line(s) to ' + r.list + ' at ' + ts + '.'); try { addActivity('upload', `Stock movement (${st.type}) ${h.ref}: ${r.ok} line(s) → ${r.list}`); } catch (e) {}
        if (st.hist) { rows.slice().reverse().forEach(x => { st.hist.recent.unshift(x); st.hist.refs.add([x.Trans_Type, x.Ref_Nr, x.SKU_Code, x.Batch_Code].join('|')); }); st.hist.recent = st.hist.recent.slice(0, 15); }
        st.lines = []; try { localStorage.removeItem(DK()); } catch (e) {} const rf = Q('#smvRef'); if (rf) rf.value = ''; addLines(3); loadHist(true); } }
    catch (e) { say('Could not save: ' + e.message, 1); msg('Could not save — ' + e.message, 'error'); } finally { st.saving = false; if (b) b.disabled = false; }
  }
  function data() { const h = head(), rel = st.type === 'SKU Release', L = st.lines.filter(x => String(x.sku).trim() || String(x.batch).trim() || num(x.rcvd) || num(x.rlsd)), n = v => (Math.round(v * 1000) / 1000);
    const headers = ['Date', 'Type', 'Ref no.', 'SKU code', 'Description', 'Batch', 'Prod. date', 'Expiry date', 'Qty received', 'Qty released', 'Balance', 'UoM', 'Base'].concat(rel ? ['Available'] : []);
    const rows = L.map(x => [h.date, st.type, h.ref, x.sku, x.dtls, x.batch, x.prod, x.exp, n(num(x.rcvd)), rel ? n(num(x.rlsd)) : 0, n(bal(x)), x.uom, x.base].concat(rel ? [(avail(x) == null ? '' : n(avail(x)))] : []));
    const t = r => rows.reduce((s, x) => s + (+x[r] || 0), 0), totals = ['TOTAL', '', '', '', '', '', '', '', n(t(8)), n(t(9)), n(t(10)), '', ''].concat(rel ? [''] : []);
    return { title: 'Stock movement — ' + st.type.replace('SKU ', '') + (h.ref ? ' · ' + h.ref : ''), sheet: 'Stock movement entry', note: [st.type, h.date, h.ref && 'Ref ' + h.ref, h.trl && 'Trailer / source ' + h.trl, 'Entered by ' + getCurrentUserValue()].filter(Boolean).join(' · '), headers, rows, totals }; }
  function full(on) { const c = Q('#smvCard'), b = Q('#smvFullBtn'); if (!c) return; on = on == null ? !c.classList.contains('smv-full') : on; c.classList.toggle('smv-full', on); document.body.classList.toggle('smv-fs', on); if (b) { b.textContent = on ? '✕ Close' : '⤢ Expand'; b.title = on ? 'Back to the normal view (Esc)' : 'Open this section in a large window'; if (on) b.dataset.x = 'close'; else b.dataset.x = ''; } }
  /* ---------- wiring ---------- */
  function init() {
    const v = Q('#view-smv'); if (!v || v._i) return; v._i = 1;
    v.addEventListener('click', e => { const t = e.target.closest('[data-type],[data-rm],[data-reuse],[data-a]'); if (!t) return;
      if (t.dataset.type) setType(t.dataset.type); else if (t.dataset.rm) { st.lines = st.lines.filter(L => L.id !== +t.dataset.rm); render(); saveDraft(); }
      else if (t.dataset.reuse != null) { const r = st.hist.recent[+t.dataset.reuse], L = blank(); L.sku = r.SKU_Code || ''; L.dtls = r.SKU_Dtls || ''; L.batch = String(r.Batch_Code == null ? '' : r.Batch_Code); L.prod = pd(r.Prod_Date); L.exp = pd(r.Expiry_Date); L.uom = r.UOM_Desc || 'PC'; L.base = String(r.UOM_Base || '1'); if (st.type === 'SKU Release') L.rlsd = ''; st.lines.push(L); render(); saveDraft(); }
      else { const a = t.dataset.a; if (a === 'add') addLines(1); else if (a === 'add5') addLines(5); else if (a === 'paste') pasteBox(); else if (a === 'file') Q('#smvFile').click(); else if (a === 'save') save(); else if (a === 'reload') loadHist(true); else if (a === 'print') a2Print(data()); else if (a === 'excel') a2Export(data()); else if (a === 'mail') a2Mail(data); else if (a === 'full') full(); else if (a === 'clear') { if (st.lines.length && !confirm('Clear all lines?')) return; st.lines = []; try { localStorage.removeItem(DK()); } catch (x) {} addLines(3); } else if (a === 'dest') { const n = Q('.nav-item[data-view="uploaddest"]'); if (n) n.click(); } } });
    v.addEventListener('input', e => { const el = e.target; if (!el.dataset.f) { saveDraft(); return; } const tr = el.closest('tr'), L = st.lines.find(x => x.id === +tr.dataset.id); if (!L) return; L[el.dataset.f] = el.value;
      if (el.dataset.f === 'sku' && fillSku(L)) { tr.querySelector('[data-f=dtls]').value = L.dtls; tr.querySelector('[data-f=base]').value = L.base; tr.querySelector('[data-f=uom]').value = L.uom; render(); }
      if (el.dataset.f === 'batch') { const o = { p: L.prod, x: L.exp }; fillBatch(L); if (L.prod !== o.p || L.exp !== o.x) render(); }
      if (el.dataset.f === 'prod' && L.prod && !L.exp && st.type !== 'SKU Release') { const s = st.hist && st.hist.sku.get(String(L.sku).trim()); if (s && s.sd) { L.exp = addDays(L.prod, s.sd); tr.querySelector('[data-f=exp]').value = L.exp; say('Expiry set to ' + L.exp + ' = production + ' + s.sd + ' days (this SKU\'s usual shelf life).'); } }
      calc(); saveDraft(); });
    v.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.f) { e.preventDefault(); const tr = e.target.closest('tr'), nx = tr.nextElementSibling; if (nx && nx.querySelector('[data-f]')) nx.querySelector(`[data-f="${e.target.dataset.f}"]`).focus(); else if (e.target.dataset.f === 'rcvd' || e.target.dataset.f === 'rlsd') { addLines(1); const l = v.querySelectorAll('tbody tr'); const last = l[l.length - 1]; if (last) last.querySelector('[data-f=sku]').focus(); } } });
    Q('#smvFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
    try { const d = JSON.parse(localStorage.getItem(DK()) || 'null'); if (d && d.lines && d.lines.length) { st.type = d.type || st.type; st.lines = d.lines; st.n = Math.max(0, ...d.lines.map(x => x.id || 0)); setTimeout(() => { if (d.h) { if (Q('#smvDate')) Q('#smvDate').value = d.h.date || today(); if (Q('#smvRef')) Q('#smvRef').value = d.h.ref || ''; if (Q('#smvTrl')) Q('#smvTrl').value = d.h.trl || ''; } say('Your unsaved draft was restored.'); }, 0); } } catch (e) {}
    if (!st.lines.length) { st.lines = [blank(), blank(), blank()]; } Q('#smvDate').value = today(); setType(st.type);
    ['#smvDate', '#smvRef', '#smvTrl'].forEach(s => Q(s).addEventListener('input', saveDraft));
  }
  const nav = Q('.nav-item[data-view="smv"]'); if (nav) nav.addEventListener('click', () => { init(); setTimeout(() => loadHist(false), 50); });
  const rb = Q('#sectionRefreshBtn'); if (rb) rb.addEventListener('click', e => { if (activeViewId() === 'smv') { e.stopImmediatePropagation(); loadHist(true); } }, true);
})();
