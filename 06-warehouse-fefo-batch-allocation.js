/* ============================================================
   WAREHOUSE — Batch Allocation (FEFO)
   ============================================================ */
const warehouseState = {
  parsedRows: [],
  parsedHeaders: [],
  lastFile: null,
  groupByFields: [],
  groupOrder: 'asc',
  withinGroupOrder: 'file',
};
function w_setStatus(msg, type = 'info') {
  const el = $('wFileStatus');
  if (!msg) { el.className = 'status-msg'; el.textContent = ''; return; }
  el.className = 'status-msg ' + type;
  el.textContent = msg;
}
function w_logToActivity(detail) { addActivity('warehouse', detail); }

const wDropzone = $('wDropzone'), wFileInput = $('wFileInput');
wDropzone.addEventListener('click', () => { if (hasPerm('uploader')) wFileInput.click(); });
wDropzone.addEventListener('dragover', (e) => { e.preventDefault(); if (hasPerm('uploader')) wDropzone.classList.add('dragover'); });
wDropzone.addEventListener('dragleave', () => wDropzone.classList.remove('dragover'));
wDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  wDropzone.classList.remove('dragover');
  if (!hasPerm('uploader')) { w_setStatus('Permission denied.', 'error'); return; }
  if (e.dataTransfer.files.length) w_handleFile(e.dataTransfer.files[0]);
});
wFileInput.addEventListener('change', (e) => { if (e.target.files.length) w_handleFile(e.target.files[0]); });

async function w_handleFile(file) {
  if (!hasPerm('uploader')) { w_setStatus('Permission denied.', 'error'); return; }
  w_setStatus('', '');
  warehouseParseProgress.start(`Parsing "${file.name}"...`, 0);
  try {
    warehouseParseProgress.update(1, 3, 'Reading file...');
    await new Promise(r => setTimeout(r, 0));
    const rows = await parseFileToRows(file);
    warehouseParseProgress.update(2, 3, `${rows.length.toLocaleString()} rows parsed`);
    await new Promise(r => setTimeout(r, 0));
    if (!rows.length) {
      warehouseParseProgress.error('No data rows');
      w_setStatus('No data rows found in file.', 'warn');
      return;
    }
    warehouseParseProgress.update(3, 3, 'Indexing headers...');
    warehouseState.parsedRows = rows;
    warehouseState.parsedHeaders = Object.keys(rows[0]);
    warehouseState.lastFile = file;
    warehouseState.groupByFields = [];
    warehouseState.groupOrder = 'asc';
    warehouseState.withinGroupOrder = 'file';

    const s = $('wFileSummary');
    s.style.display = 'block';
    s.textContent = `✓ Loaded "${file.name}" — ${rows.length.toLocaleString()} rows, ${warehouseState.parsedHeaders.length} columns.`;

    warehouseParseProgress.finish(`✅ Parsed ${rows.length.toLocaleString()} rows`);
    w_setStatus(`✓ File ready. ${rows.length.toLocaleString()} rows · ${warehouseState.parsedHeaders.length} columns.`, 'success');

    /* Auto-detect file-side mapping for the FEFO lookup */
    const autoFile = wFefoMap_detectFile(warehouseState.parsedHeaders);
    wFefoState.fileMapping = { ...wFefoState.fileMapping, ...autoFile };

    w_renderGroupControls();
    wFefoMap_render();
    wFefoMap_updateLookupGate();
    w_logToActivity(`Warehouse: parsed "${file.name}" — ${rows.length} rows`);
  } catch (err) {
    warehouseParseProgress.error('✘ ' + err.message);
    w_setStatus('Failed to parse: ' + err.message, 'error');
    w_logToActivity(`Warehouse parse error: ${err.message}`);
    notifyFailure('Warehouse Parse Error', `Failed to parse "${file.name}": ${err.message}`);
  }
}

function w_renderGroupControls() {
  const section = $('wGroupSection');
  const fefoCard = $('wFefoCard');
  const addSel = $('wGroupColumnToAdd');
  if (!warehouseState.parsedHeaders.length) { section.style.display = 'none'; fefoCard.style.display = 'none'; return; }
  section.style.display = 'block';
  fefoCard.style.display = 'block';
  const chosen = new Set(warehouseState.groupByFields.map(f => f.column));
  const available = warehouseState.parsedHeaders.filter(h => !chosen.has(h));
  addSel.innerHTML = '<option value="">— Pick a column —</option>' + available.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');
  addSel.value = '';
  addSel.disabled = !available.length;
  $('wGroupOrder').value = warehouseState.groupOrder;
  $('wWithinGroupOrder').value = warehouseState.withinGroupOrder;
  w_renderGroupChain();
  w_updateGroupSummary();
}
function w_renderGroupChain() {
  const chain = $('wGroupChain');
  const empty = $('wGroupChainEmpty');
  chain.innerHTML = '';
  if (!warehouseState.groupByFields.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  warehouseState.groupByFields.forEach((f, idx) => {
    const el = document.createElement('div');
    el.className = 'group-chain-item';
    el.dataset.idx = idx;
    el.draggable = true;
    el.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
      <span class="idx" style="opacity:0.6;font-size:11px;">${idx + 1}.</span>
      <span class="col-name">${escapeHtml(f.column)}</span>
      <button class="dir-btn" type="button" data-action="toggle-dir" title="Toggle sort direction">${f.dir === 'asc' ? 'A→Z' : 'Z→A'}</button>
      <button class="remove-btn" type="button" data-action="remove" title="Remove column">✖</button>`;
    el.querySelector('[data-action="toggle-dir"]').addEventListener('click', (e) => { e.stopPropagation(); f.dir = f.dir === 'asc' ? 'desc' : 'asc'; w_renderGroupChain(); w_updateGroupSummary(); if ($('wGroupPreviewWrap').classList.contains('visible')) w_renderGroupPreview(); });
    el.querySelector('[data-action="remove"]').addEventListener('click', (e) => { e.stopPropagation(); warehouseState.groupByFields.splice(idx, 1); w_renderGroupControls(); w_setExpanded(false); $('wGroupPreviewWrap').classList.remove('visible'); $('wGroupChips').innerHTML = ''; });
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); chain.querySelectorAll('.group-chain-item').forEach(x => x.classList.remove('drop-before', 'drop-after')); });
    el.addEventListener('dragover', (e) => { e.preventDefault(); const rect = el.getBoundingClientRect(); const isAfter = (e.clientX - rect.left) > rect.width / 2; chain.querySelectorAll('.group-chain-item').forEach(x => x.classList.remove('drop-before', 'drop-after')); el.classList.add(isAfter ? 'drop-after' : 'drop-before'); });
    el.addEventListener('dragleave', () => { el.classList.remove('drop-before', 'drop-after'); });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (isNaN(fromIdx) || fromIdx === idx) return;
      const rect = el.getBoundingClientRect();
      const isAfter = (e.clientX - rect.left) > rect.width / 2;
      const item = warehouseState.groupByFields.splice(fromIdx, 1)[0];
      let toIdx = idx;
      if (fromIdx < idx) toIdx = isAfter ? idx : idx - 1;
      else toIdx = isAfter ? idx + 1 : idx;
      warehouseState.groupByFields.splice(toIdx, 0, item);
      w_renderGroupChain(); w_updateGroupSummary();
      if ($('wGroupPreviewWrap').classList.contains('visible')) w_renderGroupPreview();
    });
    chain.appendChild(el);
  });
}
function w_updateGroupSummary() {
  const el = $('wGroupSummary');
  if (!warehouseState.groupByFields.length || !warehouseState.parsedRows.length) { el.textContent = ''; return; }
  const groups = w_computeGroups();
  const keys = warehouseState.groupByFields.map(f => `${f.column} ${f.dir === 'asc' ? '↑' : '↓'}`).join(' + ');
  el.textContent = `${groups.length} group${groups.length !== 1 ? 's' : ''} · ${warehouseState.parsedRows.length} rows · key: ${keys}`;
}
function w_rowGroupKey(row) { return warehouseState.groupByFields.map(f => String(row[f.column] ?? '')).join('\u0001'); }
function w_rowGroupKeyDisplay(row) { return warehouseState.groupByFields.map(f => String(row[f.column] ?? '')).map(v => v === '' ? '(empty)' : v).join('  ·  '); }
function w_computeGroups() {
  if (!warehouseState.groupByFields.length || !warehouseState.parsedRows.length) return [];
  const map = new Map();
  warehouseState.parsedRows.forEach((r, idx) => {
    const k = w_rowGroupKey(r);
    if (!map.has(k)) map.set(k, { key: k, displayKey: w_rowGroupKeyDisplay(r), count: 0, firstIndex: idx, rows: [] });
    const g = map.get(k); g.count++; g.rows.push(r);
  });
  let groups = Array.from(map.values());
  const fields = warehouseState.groupByFields;
  const order = warehouseState.groupOrder;
  if (order === 'asc' || order === 'desc') {
    groups.sort((a, b) => {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const av = String(a.rows[0][f.column] ?? '');
        const bv = String(b.rows[0][f.column] ?? '');
        let cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp === 0) continue;
        let dirSign = f.dir === 'asc' ? 1 : -1;
        if (order === 'desc') dirSign = -dirSign;
        return cmp * dirSign;
      }
      return 0;
    });
  } else if (order === 'size') {
    groups.sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex);
  } else if (order === 'firstSeen') {
    groups.sort((a, b) => a.firstIndex - b.firstIndex);
  }
  if (warehouseState.withinGroupOrder === 'reverse') groups.forEach(g => g.rows.reverse());
  return groups;
}
function w_isNumericColumn(colName) {
  let sawNumber = false; let sampleCount = 0;
  const maxScan = Math.min(warehouseState.parsedRows.length, 200);
  for (let i = 0; i < maxScan; i++) {
    const raw = warehouseState.parsedRows[i][colName];
    if (raw === '' || raw === null || raw === undefined) continue;
    sampleCount++;
    const cleaned = String(raw).replace(/,/g, '').trim();
    if (cleaned !== '' && !isNaN(Number(cleaned))) { sawNumber = true; }
    else if (cleaned !== '') return false;
    if (sampleCount >= 50) break;
  }
  return sawNumber;
}
function w_getNumericColumns() {
  const groupCols = new Set(warehouseState.groupByFields.map(f => f.column));
  return warehouseState.parsedHeaders.filter(h => !groupCols.has(h) && w_isNumericColumn(h));
}
function w_renderGroupPreview() {
  const wrap = $('wGroupPreviewWrap');
  const thead = $('wGroupPreviewHead');
  const tbody = $('wGroupPreviewBody');
  const controls = $('wGroupPreviewControls');
  const groups = w_computeGroups();
  if (!groups.length) { wrap.classList.remove('visible'); controls.style.display = 'none'; thead.innerHTML = ''; tbody.innerHTML = ''; return; }
  wrap.classList.add('visible');
  controls.style.display = 'flex';
  const showSums = $('wGroupShowSums').checked;
  const showTotals = $('wGroupShowTotals').checked;
  const dims = warehouseState.groupByFields.map(f => ({ name: f.column, dir: f.dir }));
  const numericCols = showSums ? w_getNumericColumns() : [];
  const headerCells = [
    `<th class="grp-meta" style="width:50px;">#</th>`,
    ...dims.map(d => `<th class="grp-dim">${escapeHtml(d.name)} <span style="opacity:0.6;font-size:10px;">${d.dir === 'asc' ? '↑' : '↓'}</span></th>`),
    `<th class="grp-meta" style="width:80px;">Rows</th>`,
    `<th class="grp-meta" style="width:90px;">First #</th>`,
    ...numericCols.map(c => `<th class="grp-sum">Σ ${escapeHtml(c)}</th>`),
  ];
  thead.innerHTML = `<tr>${headerCells.join('')}</tr>`;
  const groupRows = groups.map(g => {
    const sums = {};
    if (numericCols.length) { numericCols.forEach(c => { sums[c] = 0; }); g.rows.forEach(r => { numericCols.forEach(c => { const n = u_toNumber(r[c]); if (n !== null) sums[c] += n; }); }); }
    return { g, sums };
  });
  const totals = {};
  if (numericCols.length) { numericCols.forEach(c => { totals[c] = 0; }); groupRows.forEach(({ sums }) => numericCols.forEach(c => { totals[c] += sums[c] || 0; })); }
  const totalRowCount = groups.reduce((a, g) => a + g.count, 0);
  const maxRows = 500;
  const bodyHtml = [];
  groupRows.slice(0, maxRows).forEach(({ g, sums }, i) => {
    const altCls = i % 2 === 1 ? ' class="group-alt"' : '';
    const firstRow = g.rows[0];
    const dimCells = dims.map(d => { const v = String(firstRow[d.name] ?? ''); return v === '' ? `<td class="grp-dim grp-empty">(empty)</td>` : `<td class="grp-dim">${escapeHtml(v)}</td>`; }).join('');
    const sumCells = numericCols.map(c => `<td class="grp-sum">${escapeHtml(u_formatNumber(sums[c]))}</td>`).join('');
    bodyHtml.push(`<tr${altCls}><td class="grp-meta">${i + 1}</td>${dimCells}<td class="grp-meta">${g.count}</td><td class="grp-meta">#${g.firstIndex + 1}</td>${sumCells}</tr>`);
  });
  if (groups.length > maxRows) bodyHtml.push(`<tr><td colspan="${4 + dims.length + numericCols.length}" style="text-align:center;color:var(--gray-400);font-style:italic;">…and ${groups.length - maxRows} more groups (only first ${maxRows} shown)</td></tr>`);
  if (showTotals && numericCols.length) {
    const totalDimCells = dims.map((_, idx) => idx === 0 ? `<td class="grp-dim">TOTAL</td>` : `<td class="grp-dim" style="opacity:0.5;">—</td>`).join('');
    const totalSumCells = numericCols.map(c => `<td class="grp-sum">${escapeHtml(u_formatNumber(totals[c]))}</td>`).join('');
    bodyHtml.push(`<tr class="group-total-row"><td class="grp-meta">Σ</td>${totalDimCells}<td class="grp-meta">${totalRowCount}</td><td class="grp-meta">—</td>${totalSumCells}</tr>`);
  }
  tbody.innerHTML = bodyHtml.join('');
  const chips = $('wGroupChips');
  chips.innerHTML = groups.slice(0, 20).map(g => {
    const label = warehouseState.groupByFields.map(f => { const v = String(g.rows[0][f.column] ?? ''); return v === '' ? '(empty)' : v; }).join(' · ');
    return `<span class="group-chip">${escapeHtml(truncate(label, 28))} <span class="count">${g.count}</span></span>`;
  }).join('') + (groups.length > 20 ? `<span class="group-chip">+${groups.length - 20} more</span>` : '');
}
function w_setExpanded(on) {
  const wrap = $('wGroupPreviewWrap');
  const backdrop = $('wGroupPreviewBackdrop');
  const btn = $('wGroupPreviewExpandBtn');
  if (on) { wrap.classList.add('expanded'); backdrop.classList.add('open'); btn.textContent = '⤡ Collapse'; }
  else { wrap.classList.remove('expanded'); backdrop.classList.remove('open'); btn.textContent = '⤢ Expand'; }
}
$('wGroupColumnToAdd').addEventListener('change', (e) => {
  const col = e.target.value;
  if (!col) return;
  if (!warehouseState.groupByFields.some(f => f.column === col)) warehouseState.groupByFields.push({ column: col, dir: 'asc' });
  e.target.value = '';
  w_renderGroupControls();
  w_setExpanded(false);
  $('wGroupPreviewWrap').classList.remove('visible');
  $('wGroupChips').innerHTML = '';
  w_updateGroupSummary();
});
$('wGroupOrder').addEventListener('change', (e) => { warehouseState.groupOrder = e.target.value; w_updateGroupSummary(); if ($('wGroupPreviewWrap').classList.contains('visible')) w_renderGroupPreview(); });
$('wWithinGroupOrder').addEventListener('change', (e) => { warehouseState.withinGroupOrder = e.target.value; w_updateGroupSummary(); if ($('wGroupPreviewWrap').classList.contains('visible')) w_renderGroupPreview(); });
$('wGroupPreviewBtn').addEventListener('click', () => {
  if (!warehouseState.groupByFields.length) { w_setStatus('Add at least one group-by column first.', 'warn'); return; }
  w_renderGroupPreview();
  w_setStatus(`Preview: ${w_computeGroups().length} groups across ${warehouseState.parsedRows.length} rows.`, 'info');
});
$('wGroupClearBtn').addEventListener('click', () => {
  warehouseState.groupByFields = [];
  warehouseState.groupOrder = 'asc';
  warehouseState.withinGroupOrder = 'file';
  $('wGroupOrder').value = 'asc';
  $('wWithinGroupOrder').value = 'file';
  w_setExpanded(false);
  $('wGroupPreviewWrap').classList.remove('visible');
  $('wGroupChips').innerHTML = '';
  w_renderGroupControls();
  w_setStatus('Grouping reset.', 'success');
});
$('wGroupShowSums').addEventListener('change', () => { if ($('wGroupPreviewWrap').classList.contains('visible')) w_renderGroupPreview(); });
$('wGroupShowTotals').addEventListener('change', () => { if ($('wGroupPreviewWrap').classList.contains('visible')) w_renderGroupPreview(); });
$('wGroupPreviewExpandBtn').addEventListener('click', () => { const wrap = $('wGroupPreviewWrap'); w_setExpanded(!wrap.classList.contains('expanded')); });
$('wGroupPreviewCloseBtn').addEventListener('click', () => w_setExpanded(false));
$('wGroupPreviewBackdrop').addEventListener('click', () => w_setExpanded(false));
function w_buildGroupExportRows() {
  const dims = warehouseState.groupByFields.map(f => ({ name: f.column, dir: f.dir }));
  const numericCols = w_getNumericColumns();
  const groups = w_computeGroups();
  const headers = ['#', ...dims.map(d => `${d.name} (${d.dir === 'asc' ? '↑' : '↓'})`), 'Rows', 'First #', ...numericCols.map(c => `Σ ${c}`)];
  const rows = [headers];
  const totals = {};
  numericCols.forEach(c => { totals[c] = 0; });
  groups.forEach((g, i) => {
    const firstRow = g.rows[0];
    const sums = {};
    numericCols.forEach(c => { sums[c] = 0; g.rows.forEach(r => { const n = u_toNumber(r[c]); if (n !== null) sums[c] += n; }); totals[c] += sums[c]; });
    rows.push([i + 1, ...dims.map(d => { const v = String(firstRow[d.name] ?? ''); return v === '' ? '(empty)' : v; }), g.count, `#${g.firstIndex + 1}`, ...numericCols.map(c => sums[c])]);
  });
  if ($('wGroupShowTotals').checked && numericCols.length) {
    rows.push(['Σ', ...dims.map((_, idx) => idx === 0 ? 'TOTAL' : '—'), groups.reduce((a, g) => a + g.count, 0), '—', ...numericCols.map(c => totals[c])]);
  }
  return { headers, rows, numericCols, dims, groups };
}
$('wGroupExportExcelBtn').addEventListener('click', () => {
  if (!warehouseState.groupByFields.length) { w_setStatus('Add at least one group-by column first.', 'warn'); return; }
  if (!warehouseState.parsedRows.length) { w_setStatus('No data to export.', 'warn'); return; }
  try {
    const { rows, numericCols, dims } = w_buildGroupExportRows();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map(h => ({ wch: Math.max(12, Math.min(40, String(h || '').length + 4)) }));
    const numStart = 1 + dims.length + 2;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= range.e.r; R++) for (let C = numStart; C <= range.e.c; C++) { const addr = XLSX.utils.encode_cell({ r: R, c: C }); if (ws[addr]) ws[addr].z = '#,##0.###'; }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Warehouse Groups');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    XLSX.writeFile(wb, `Warehouse_Groups_${ts}.xlsx`);
    w_setStatus(`✅ Exported grouped data to Excel (${rows.length - 1} rows).`, 'success');
    w_logToActivity(`Warehouse: exported grouped Excel (${rows.length - 1} rows)`);
  } catch (err) { w_setStatus('Excel export failed: ' + err.message, 'error'); }
});
$('wGroupExportCsvBtn').addEventListener('click', () => {
  if (!warehouseState.groupByFields.length) { w_setStatus('Add at least one group-by column first.', 'warn'); return; }
  if (!warehouseState.parsedRows.length) { w_setStatus('No data to export.', 'warn'); return; }
  try {
    const { rows } = w_buildGroupExportRows();
    const esc = v => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = rows.map(r => r.map(esc).join(','));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `Warehouse_Groups_${ts}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    w_setStatus(`✅ Exported grouped data to CSV (${rows.length - 1} rows).`, 'success');
  } catch (err) { w_setStatus('CSV export failed: ' + err.message, 'error'); }
});

/* ============================================================
   WAREHOUSE — FEFO Field Mapping engine
   ============================================================ */
const wFefoState = {
  locSel: [], locOptions: [], locTotals: new Map(),
  batchIndex: null,
  batchLoadedAt: 0,
  batchListName: '',
  results: [],
  filteredResults: [],
  searchQuery: '',
  filterRows: [],
  listPicker: null,
  uploadColumns: [],
  uploadMapping: {},
  uploadSiteId: null,
  uploadListId: null,
  batchColumns: [],
  batchColumnsLoadedFor: '',
  fileMapping: { sku: '', uom: '', qty: '' },
  batchMapping: { sku: '', uom: '', qty: '', batchCode: '', locationCode: '', prodDate: '', expiryDate: '' },
};

/* File side — split into MATCH (SKU only; UOM is for conversion) and VALUE (Qty) */
const FEFO_MAP_FILE_MATCH_ROLES = [
  { key: 'sku', label: 'SKU / Item Code', required: true, aliases: ['2nd item number','2nd_item_number','2nditemnumber','2nd item no','2nd_item_no','sku','sku_code','item code','itemcode','item_code','item','item number','item no'] },
  { key: 'uom', label: 'UOM (conversion only — not used for matching)', required: false, aliases: ['uom_desc','uom desc','uom','uom_base','uom base','unit','unit of measure'] },
];
const FEFO_MAP_FILE_VALUE_ROLES = [
  { key: 'qty', label: 'Qty Requested', required: true, aliases: ['qty','quantity','order qty','order_qty','qty requested','qty_requested','qty_bal','balance','available'], note: 'numeric' },
];
/* Kept for backward compatibility — anything that iterates file roles should use the match+value split */
const FEFO_MAP_FILE_ROLES = [...FEFO_MAP_FILE_MATCH_ROLES, ...FEFO_MAP_FILE_VALUE_ROLES];

/* Batch side — split into MATCH (SKU only; UOM is for conversion) and DATA (Qty/Batch/Dates) */
const FEFO_MAP_BATCH_MATCH_ROLES = [
  { key: 'sku', label: 'SKU / Item Code', required: true, aliases: ['sku_code','item code','itemcode','item_code','sku','item','item number','item no','2nd item number'] },
  { key: 'uom', label: 'UOM (conversion only — not used for matching)', required: false, aliases: ['uom_desc','uom desc','uom_base','uom base','uom','unit','unit of measure'] },
];
const FEFO_MAP_BATCH_DATA_ROLES = [
  { key: 'qty', label: 'Qty Balance', required: true, aliases: ['qty_bal','qty balance','balance','available qty','available','on hand','onhand','qty'] },
  { key: 'batchCode', label: 'Batch Code', required: true, aliases: ['batch_code','batchcode','batch code','batch no','batch_no','batchno','batch'] },
  { key: 'locationCode', label: 'Location Code', required: false, aliases: ['location_code','locationcode','location code','location','loc_code','loc code','loccode','warehouse','wh_code','wh code','site','store','storage location','bin','whs_desc','whs desc','warehouse_location','location_desc','location_name','loc','location_id'] },
  { key: 'prodDate', label: 'Prod Date', required: false, aliases: ['prod_date','proddate','production date','productiondate','prod date','mfg date','mfgdate','manufactured'] },
  { key: 'expiryDate', label: 'Expiry Date', required: true, aliases: ['expiry_date','expirydate','expiry date','exp date','expdate','expiration date','expirationdate','best before'] },
];
const FEFO_MAP_BATCH_ROLES = [...FEFO_MAP_BATCH_MATCH_ROLES, ...FEFO_MAP_BATCH_DATA_ROLES];

function wFefoMap_keyForList(listName) {
  const userPart = (currentUser?.id || 'anon');
  return LS_BASE + "_wfefo_map_" + userPart + "_" + String(listName || '').toLowerCase();
}
function wFefoMap_loadFromStorage(listName) {
  if (!listName) return null;
  try {
    const raw = localStorage.getItem(wFefoMap_keyForList(listName));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function wFefoMap_saveToStorage() {
  if (!wFefoState.batchListName) return;
  try {
    localStorage.setItem(wFefoMap_keyForList(wFefoState.batchListName), JSON.stringify({
      batchMapping: { ...wFefoState.batchMapping },
      savedAt: Date.now(),
      savedBy: currentUser?.username || 'unknown',
    }));
  } catch (e) {}
}

function wFefoMap_detectFile(headers) {
  if (!headers || !headers.length) return { sku: '', uom: '', qty: '' };
  const lc = headers.map(h => String(h).trim().toLowerCase());
  const norm = (s) => String(s).toLowerCase().replace(/[\s_\-\.]+/g, '').trim();
  const pick = (aliases) => {
    for (const a of aliases) { const idx = lc.indexOf(a); if (idx >= 0) return headers[idx]; }
    for (let i = 0; i < lc.length; i++) { const n = norm(lc[i]); for (const a of aliases) if (n === norm(a)) return headers[i]; }
    for (let i = 0; i < lc.length; i++) for (const a of aliases) if (lc[i].includes(a)) return headers[i];
    return '';
  };
  const out = {};
  FEFO_MAP_FILE_ROLES.forEach(r => { out[r.key] = pick(r.aliases); });
  return out;
}

function wFefoMap_detectBatch(columns) {
  if (!columns || !columns.length) return { sku: '', uom: '', qty: '', batchCode: '', locationCode: '', prodDate: '', expiryDate: '' };
  const norm = (s) => String(s).toLowerCase().replace(/[\s_\-\.]+/g, '').trim();
  const pick = (aliases) => {
    for (const a of aliases) { const hit = columns.find(c => c.name.toLowerCase() === a); if (hit) return hit.name; }
    for (const a of aliases) { const hit = columns.find(c => norm(c.displayName) === norm(a)); if (hit) return hit.name; }
    for (const a of aliases) { const hit = columns.find(c => c.name.toLowerCase().includes(a) || c.displayName.toLowerCase().includes(a)); if (hit) return hit.name; }
    return '';
  };
  const out = {};
  FEFO_MAP_BATCH_ROLES.forEach(r => { out[r.key] = pick(r.aliases); });
  return out;
}

/* ---------- Batch list picker + column loading ---------- */
function w_initBatchListPicker() {
  const host = document.querySelector('[data-list-picker="w-fefo-batch"]');
  if (!host || wFefoState.listPicker) return;
  wFefoState.listPicker = createListPicker(host, {
    getSiteUrl: () => getGlobalSiteUrl(),
    getToken: () => getGlobalAccessToken(),
    initialValue: wFefoState.batchListName || '',
    onChange: async (val) => {
      if (val === wFefoState.batchListName) return;
      wFefoState.batchListName = val;
      wFefoState.batchIndex = null;
      wFefoState.batchLoadedAt = 0;
      wFefoState.batchColumns = [];
      wFefoState.batchColumnsLoadedFor = '';
      wFefoState.batchMapping = { sku: '', uom: '', qty: '', batchCode: '', locationCode: '', prodDate: '', expiryDate: '' };
      try { localStorage.setItem(LS_BASE + "_wfefo_batchList", val || ''); } catch (e) {}
      wFefoMap_render();
      wFefoMap_render();
      wFefoMap_updateLookupGate();
      wFefoState.filterRows = [];
      wFefoFilter_loadFromStorage();
      wFefoFilter_render();
      /* Auto-load batch columns on selection */
      if (val) {
        try { await wFefoMap_loadBatchColumns(true); } catch (e) {}
      }
    },
  });
}
function w_restoreBatchListName() {
  try {
    const saved = localStorage.getItem(LS_BASE + "_wfefo_batchList") || 'SKUs_Movements_Batch_tbl';
    if (saved) {
      wFefoState.batchListName = saved;
      wFefoState.listPicker?.setValue(saved);
      /* Load columns for the restored list on login */
      wFefoMap_loadBatchColumns(true).catch(() => {});
    }
  } catch (e) {}
}

async function wFefoMap_loadBatchColumns(force = false) {
  const listName = wFefoState.batchListName;
  if (!listName) { wFefoMap_setStatus('Pick a batch list first.', 'incomplete'); return; }
  if (!force && wFefoState.batchColumnsLoadedFor === listName && wFefoState.batchColumns.length) return;

  const token = getGlobalAccessToken();
  const siteUrl = getGlobalSiteUrl();
  if (!token || !siteUrl) { wFefoMap_setStatus('Global Site URL and Token are not configured.', 'error'); return; }
  wFefoMap_setStatus('Loading batch columns...', '');
  try {
    const { siteId, listId } = await resolveIds(siteUrl, listName, token);
    const cols = await fetchColumns(siteId, listId, token);
    wFefoState.batchColumns = cols;
    wFefoState.batchColumnsLoadedFor = listName;

    /* Try to restore saved mapping for this list */
    const saved = wFefoMap_loadFromStorage(listName);
    if (saved && saved.batchMapping) {
      const restored = {};
      FEFO_MAP_BATCH_ROLES.forEach(r => {
        const v = saved.batchMapping[r.key];
        restored[r.key] = (v && cols.some(c => c.name === v)) ? v : '';
      });
      /* Fill any missing roles with auto-detect */
      const auto = wFefoMap_detectBatch(cols);
      FEFO_MAP_BATCH_ROLES.forEach(r => { if (!restored[r.key]) restored[r.key] = auto[r.key] || ''; });
      wFefoState.batchMapping = restored;
      wFefoMap_setStatus(`Loaded ${cols.length} columns · restored`, '');
    } else {
      const auto = wFefoMap_detectBatch(cols);
      wFefoState.batchMapping = { ...wFefoState.batchMapping, ...auto };
      wFefoMap_setStatus(`Loaded ${cols.length} columns · auto-detected`, '');
    }
    try { utBatchOverride(cols); } catch (e) {}
    wFefoMap_render();
    wFefoMap_updateLookupGate();
    wFefoMap_printDiag();
  } catch (err) {
    wFefoMap_setStatus('✘ ' + err.message, 'error');
  }
}

function wFefoMap_autoDetect() {
  if (warehouseState.parsedHeaders.length) {
    const auto = wFefoMap_detectFile(warehouseState.parsedHeaders);
    wFefoState.fileMapping = { ...wFefoState.fileMapping, ...auto };
  }
  if (wFefoState.batchColumns.length) {
    const auto = wFefoMap_detectBatch(wFefoState.batchColumns);
    wFefoState.batchMapping = { ...wFefoState.batchMapping, ...auto };
  }
  wFefoMap_render();
  wFefoMap_updateLookupGate();
}

function wFefoMap_validate() {
  const missing = [];
  FEFO_MAP_FILE_ROLES.forEach(r => {
    const v = wFefoState.fileMapping[r.key];
    if (r.required && !v) missing.push(`File · ${r.label}`);
    else if (v && !warehouseState.parsedHeaders.includes(v)) missing.push(`File · ${r.label} (not in file)`);
  });
  if (!wFefoState.batchColumns.length) missing.push('Batch columns not loaded');
  else FEFO_MAP_BATCH_ROLES.forEach(r => {
    const v = wFefoState.batchMapping[r.key];
    if (r.required && !v) missing.push(`Batch · ${r.label}`);
    else if (v && !wFefoState.batchColumns.some(c => c.name === v)) missing.push(`Batch · ${r.label} (not in list)`);
  });
  return { ready: missing.length === 0, missing };
}

function wFefoMap_setStatus(msg, cls = '') {
  const el = $('wFefoMapStatus');
  if (!el) return;
  el.className = 'text-sm ' + (cls || '');
  el.textContent = msg || '';
}

function wFefoMap_updateLookupGate() {
  const { ready, missing } = wFefoMap_validate();
  const btn = $('wFefoLookupBtn');
  if (btn) btn.disabled = !ready || !warehouseState.parsedRows.length;
  if (ready && warehouseState.parsedRows.length) wFefoMap_setStatus('✓ Mapping ready', 'ready');
  else if (!warehouseState.parsedRows.length) wFefoMap_setStatus('Load an order file first.', 'incomplete');
  else wFefoMap_setStatus('⚠ Missing: ' + missing.slice(0, 3).join(', ') + (missing.length > 3 ? ` (+${missing.length - 3})` : ''), 'incomplete');
}

function wFefoMap_printDiag() {
  const el = $('wFefoMapDiag');
  if (!el) return;
  const fileCols = warehouseState.parsedHeaders.length;
  const batchCols = wFefoState.batchColumns.length;
  if (!fileCols && !batchCols) { el.textContent = ''; return; }
  const fm = wFefoState.fileMapping;
  const bm = wFefoState.batchMapping;
  el.innerHTML =
    `File (${fileCols} cols) → SKU: <strong>${escapeHtml(fm.sku || '—')}</strong> · UOM: <strong>${escapeHtml(fm.uom || '—')}</strong> · Qty: <strong>${escapeHtml(fm.qty || '—')}</strong><br>` +
    `Batch (${batchCols} cols) → SKU: <strong>${escapeHtml(bm.sku || '—')}</strong> · UOM: <strong>${escapeHtml(bm.uom || '—')}</strong> · Qty: <strong>${escapeHtml(bm.qty || '—')}</strong> · Batch: <strong>${escapeHtml(bm.batchCode || '—')}</strong> · Prod: <strong>${escapeHtml(bm.prodDate || '—')}</strong> · Exp: <strong>${escapeHtml(bm.expiryDate || '—')}</strong>`;
}

