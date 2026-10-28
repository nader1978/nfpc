/* ============================================================
   FEFO multi-value filter engine
   ============================================================ */

function wFefoFilter_fields() {
  const fields = [
    { key: 'sku',         label: 'SKU',         get: r => r.sku },
    { key: 'uom',         label: 'UOM',         get: r => r.uom },
    { key: 'batchCode',   label: 'Batch_Code',  get: r => r.batchCode },
    { key: 'status',      label: 'Status',      get: r => r.status },
    { key: 'whsCode', label: 'WHs_Code', get: r => rkWhs(r.locationCode) },
    { key: 'locationCode', label: 'Location_Code', get: r => r.locationCode },
    { key: 'prodDate',    label: 'Prod_Date',   get: r => r.prodDate ? new Date(r.prodDate).toISOString().slice(0, 10) : '' },
    { key: 'expiryDate',  label: 'Expiry_Date', get: r => r.expiryDate ? new Date(r.expiryDate).toISOString().slice(0, 10) : '' },
  ];
  warehouseState.groupByFields.forEach(f => {
    fields.push({
      key: 'g:' + f.column,
      label: f.column + ' (group)',
      get: r => r.groupValues ? r.groupValues[f.column] : '',
    });
  });
  return fields;
}

const W_FEFO_OPERATORS = [
  { key: 'isAnyOf',       label: 'is any of' },
  { key: 'isNotAnyOf',    label: 'is not any of' },
  { key: 'containsAnyOf', label: 'contains any of' },
];

function wFefoFilter_distinct(fieldKey) {
  const field = wFefoFilter_fields().find(f => f.key === fieldKey);
  if (!field) return [];
  const seen = new Set();
  const out = [];
  wFefoState.results.forEach(r => {
    let v = field.get(r);
    if (v === null || v === undefined) return;
    v = String(v).trim();
    if (!v) return;
    const k = v.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(v);
  });
  out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return out;
}

function wFefoFilter_rowMatches(r, row) {
  const field = wFefoFilter_fields().find(f => f.key === row.field);
  if (!field) return true;
  if (!row.values || !row.values.length) return true;
  const cellRaw = field.get(r);
  const cell = String(cellRaw == null ? '' : cellRaw).toLowerCase();
  const values = row.values.map(v => String(v).toLowerCase());
  if (row.op === 'isAnyOf')       return values.includes(cell);
  if (row.op === 'isNotAnyOf')    return !values.includes(cell);
  if (row.op === 'containsAnyOf') return values.some(v => cell.includes(v));
  return true;
}

function wFefo_applySearchFilter() {
  const onlyProblems = $('wFefoOnlyProblems')?.checked;
  const rows = wFefoState.filterRows || [];
  wFefoState.filteredResults = wFefoState.results.filter(r => {
    if (onlyProblems && r.statusKey === 'ok') return false;
    for (const row of rows) {
      if (!wFefoFilter_rowMatches(r, row)) return false;
    }
    return true;
  });
  wFefoFilter_updateSummary();
}

function wFefo_getVisibleResults() {
  return wFefoState.filteredResults.slice();
}

function wFefo_getFilterSummary() {
  const parts = [];
  (wFefoState.filterRows || []).forEach(row => {
    if (!row.values || !row.values.length) return;
    const field = wFefoFilter_fields().find(f => f.key === row.field);
    const op = W_FEFO_OPERATORS.find(o => o.key === row.op);
    parts.push(`${field ? field.label : row.field} ${op ? op.label : row.op} [${row.values.join(', ')}]`);
  });
  if ($('wFefoOnlyProblems')?.checked) parts.push('only problems');
  return parts.join(' AND ');
}

function wFefoFilter_render() {
  const host = $('wFefoFilterRows');
  const emptyEl = $('wFefoFilterEmpty');
  if (!host) return;
  host.innerHTML = '';
  const rows = wFefoState.filterRows || [];
  if (!rows.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    wFefoFilter_updateSummary();
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  const fields = wFefoFilter_fields();

  rows.forEach((row, idx) => {
    const el = document.createElement('div');
    el.className = 'w-fefo-filter-row';

    const fieldSel = document.createElement('select');
    fields.forEach(f => {
      const o = document.createElement('option');
      o.value = f.key;
      o.textContent = f.label;
      if (f.key === row.field) o.selected = true;
      fieldSel.appendChild(o);
    });
    fieldSel.addEventListener('change', (e) => {
      row.field = e.target.value;
      row.values = [];
      wFefoFilter_render();
      wFefo_applySearchFilter();
      wFefo_renderResults();
      wFefo_updateExportScopeNote();
      wFefoFilter_saveToStorage();
    });

    const opSel = document.createElement('select');
    W_FEFO_OPERATORS.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.key;
      opt.textContent = o.label;
      if (o.key === row.op) opt.selected = true;
      opSel.appendChild(opt);
    });
    opSel.addEventListener('change', (e) => {
      row.op = e.target.value;
      wFefo_applySearchFilter();
      wFefo_renderResults();
      wFefo_updateExportScopeNote();
      wFefoFilter_saveToStorage();
    });

    const chipInput = wFefoFilter_makeChipInput(row, () => {
      wFefo_applySearchFilter();
      wFefo_renderResults();
      wFefo_updateExportScopeNote();
      wFefoFilter_saveToStorage();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'danger small icon-only';
    removeBtn.textContent = '✖';
    removeBtn.title = 'Remove this filter';
    removeBtn.addEventListener('click', () => {
      wFefoState.filterRows.splice(idx, 1);
      wFefoFilter_render();
      wFefo_applySearchFilter();
      wFefo_renderResults();
      wFefo_updateExportScopeNote();
      wFefoFilter_saveToStorage();
    });

    if (idx > 0) {
      const badge = document.createElement('span');
      badge.className = 'op-badge';
      badge.textContent = 'AND';
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.appendChild(badge);
      wrapper.appendChild(fieldSel);
      el.appendChild(wrapper);
    } else {
      el.appendChild(fieldSel);
    }
    el.appendChild(opSel);
    el.appendChild(chipInput);
    el.appendChild(removeBtn);
    host.appendChild(el);
  });
}

function wFefoFilter_makeChipInput(row, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'w-fefo-chip-input';
  wrap.tabIndex = 0;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type a value, press Enter…';

  const drop = document.createElement('div');
  drop.className = 'w-fefo-chip-drop';

  let allValues = wFefoFilter_distinct(row.field);
  let filtered = [];
  let highlighted = 0;
  let open = false;

  function closeDrop() {
    if (!open) return;
    open = false;
    drop.classList.remove('open');
  }
  function highlightMatch(text, q) {
    const safe = escapeHtml(text);
    if (!q) return safe;
    try { return safe.replace(new RegExp('(' + escapeRegex(q) + ')', 'ig'), '<mark>$1</mark>'); }
    catch { return safe; }
  }
  function openDrop() {
    if (open) return;
    open = true;
    renderDrop(input.value);
    drop.classList.add('open');
  }
  function renderDrop(q) {
    const query = (q || '').trim().toLowerCase();
    const chosen = new Set(row.values.map(v => String(v).toLowerCase()));
    filtered = allValues.filter(v => {
      const lc = v.toLowerCase();
      if (chosen.has(lc)) return false;
      if (!query) return true;
      return lc.includes(query);
    });
    if (!filtered.length) {
      drop.innerHTML = '<div class="empty">No matching values</div>';
      highlighted = -1;
      return;
    }
    highlighted = 0;
    drop.innerHTML = filtered.slice(0, 200).map((v, i) => {
      const cls = i === highlighted ? 'opt highlighted' : 'opt';
      return `<div class="${cls}" data-idx="${i}">${highlightMatch(v, query)}</div>`;
    }).join('');
    drop.querySelectorAll('.opt').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        addValue(filtered[parseInt(el.dataset.idx, 10)]);
      });
    });
  }
  function addValue(v) {
    const value = String(v == null ? '' : v).trim();
    if (!value) return;
    if (!row.values.some(x => String(x).toLowerCase() === value.toLowerCase())) {
      row.values.push(value);
    }
    input.value = '';
    renderChips();
    if (open) renderDrop('');
    onChange();
  }
  function removeValue(v) {
    row.values = row.values.filter(x => x !== v);
    renderChips();
    if (open) renderDrop(input.value);
    onChange();
  }
  function renderChips() {
    Array.from(wrap.querySelectorAll('.w-fefo-chip')).forEach(c => c.remove());
    row.values.forEach(v => {
      const chip = document.createElement('span');
      chip.className = 'w-fefo-chip';
      chip.innerHTML = `<span class="chip-text" title="${escapeHtml(v)}">${escapeHtml(truncate(v, 30))}</span>`;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'chip-x';
      x.textContent = '✖';
      x.title = 'Remove';
      x.addEventListener('mousedown', (e) => { e.preventDefault(); removeValue(v); });
      chip.appendChild(x);
      wrap.insertBefore(chip, input);
    });
  }
  input.addEventListener('focus', () => {
    allValues = wFefoFilter_distinct(row.field);
    openDrop();
  });
  input.addEventListener('click', () => {
    allValues = wFefoFilter_distinct(row.field);
    openDrop();
  });
  input.addEventListener('input', () => {
    if (!open) openDrop();
    else renderDrop(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { openDrop(); return; }
      highlighted = Math.min(highlighted + 1, filtered.length - 1);
      renderDrop(input.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      renderDrop(input.value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value.trim();
      if (v && (!filtered.length || highlighted < 0)) {
        addValue(v);
      } else if (filtered[highlighted] !== undefined) {
        addValue(filtered[highlighted]);
      } else if (v) {
        addValue(v);
      }
    } else if (e.key === 'Backspace' && !input.value && row.values.length) {
      removeValue(row.values[row.values.length - 1]);
    } else if (e.key === 'Escape') {
      closeDrop();
      input.blur();
    }
  });
  input.addEventListener('blur', () => setTimeout(closeDrop, 150));

  wrap.addEventListener('mousedown', (e) => {
    if (e.target === wrap) {
      e.preventDefault();
      input.focus();
    }
  });

  renderChips();
  wrap.appendChild(input);
  wrap.appendChild(drop);
  return wrap;
}

function wFefoFilter_updateSummary() {
  const el = $('wFefoFilterSummary');
  if (!el) return;
  const active = (wFefoState.filterRows || []).filter(r => r.values && r.values.length).length;
  const shown = wFefoState.filteredResults.length;
  const total = wFefoState.results.length;
  if (!wFefoState.results.length) { el.textContent = ''; return; }
  if (!active && !$('wFefoOnlyProblems')?.checked) {
    el.textContent = `Showing all ${total} rows.`;
  } else {
    el.textContent = `Showing ${shown} of ${total} rows.`;
  }
}

function wFefoFilter_storageKey() {
  if (!wFefoState.batchListName) return null;
  const userPart = currentUser?.id || 'anon';
  return LS_BASE + "_wfefo_filters_" + userPart + "_" + String(wFefoState.batchListName).toLowerCase();
}
function wFefoFilter_saveToStorage() {
  const key = wFefoFilter_storageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({
      rows: wFefoState.filterRows,
      onlyProblems: !!$('wFefoOnlyProblems')?.checked,
      savedAt: Date.now(),
    }));
  } catch (e) {}
}
function wFefoFilter_loadFromStorage() {
  const key = wFefoFilter_storageKey();
  if (!key) return;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) { wFefoState.filterRows = []; return; }
    const p = JSON.parse(raw);
    wFefoState.filterRows = Array.isArray(p.rows) ? p.rows : [];
    const cb = $('wFefoOnlyProblems');
    if (cb) cb.checked = !!p.onlyProblems;
  } catch (e) { wFefoState.filterRows = []; }
}

$('wFefoFilterAddBtn').addEventListener('click', () => {
  const fields = wFefoFilter_fields();
  if (!fields.length) return;
  wFefoState.filterRows.push({ id: uid(), field: fields[0].key, op: 'isAnyOf', values: [] });
  wFefoFilter_render();
  wFefo_applySearchFilter();
  wFefo_renderResults();
  wFefo_updateExportScopeNote();
  wFefoFilter_saveToStorage();
});
$('wFefoFilterClearBtn').addEventListener('click', () => {
  wFefoState.filterRows = [];
  const cb = $('wFefoOnlyProblems');
  if (cb) cb.checked = false;
  wFefoFilter_render();
  wFefo_applySearchFilter();
  wFefo_renderResults();
  wFefo_updateExportScopeNote();
  wFefoFilter_saveToStorage();
});


function wFefo_renderResults() {
  const wrap = $('wFefoResultsWrap');
  const head = $('wFefoResultsHead');
  const body = $('wFefoResultsBody');
  if (!wFefoState.results.length) { wrap.style.display = 'none'; head.innerHTML = ''; body.innerHTML = ''; return; }
  const groupCols = warehouseState.groupByFields.map(f => f.column);
  const cols = [
    ...groupCols.map(c => ({ key: 'g:' + c, label: c, kind: 'group' })),
    { key: 'sku', label: 'SKU', kind: 'text' },
    { key: 'uom', label: 'UOM', kind: 'text' },
    ...(wFefoState.resultsUomOn ? [{ key: 'origDisplay', label: 'Ordered (Original UOM)', kind: 'text' }] : []),
    { key: 'qty', label: wFefoState.resultsUomOn ? 'Qty Requested (Pcs)' : 'Qty Requested', kind: 'num' },
    { key: 'batchCode', label: 'Batch_Code', kind: 'text' },
    { key: 'whsCode', label: 'WHs_Code', kind: 'text' },
    { key: 'locationCode', label: 'Location_Code', kind: 'text' },
    { key: 'prodDate', label: 'Prod_Date', kind: 'date' },
    { key: 'expiryDate', label: 'Expiry_Date', kind: 'date' },
    { key: 'qtyAllocated', label: wFefoState.resultsUomOn ? 'Qty Allocated (Pcs)' : 'Qty Allocated', kind: 'num' },
    { key: 'qtyRemaining', label: wFefoState.resultsUomOn ? 'Qty Remaining (Pcs)' : 'Qty Remaining', kind: 'num' },
    { key: 'status', label: 'Status', kind: 'status' },
  ];
  head.innerHTML = '<tr>' + cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join('') + '</tr>';
  const fmtDate = (d) => { if (!d) return ''; const dt = new Date(d); if (isNaN(dt.getTime())) return String(d); return dt.toISOString().slice(0, 10); };
  const fmtNum = (n) => (n === '' || n == null || isNaN(n)) ? '' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 6 });
  const q = (wFefoState.searchQuery || '').trim().toLowerCase();
  const highlight = (s) => {
    const safe = escapeHtml(String(s ?? ''));
    if (!q) return safe;
    try { return safe.replace(new RegExp('(' + escapeRegex(q) + ')', 'ig'), '<mark>$1</mark>'); }
    catch { return safe; }
  };
  const rows = wFefoState.filteredResults;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--gray-400);padding:20px;font-style:italic;">No rows match the current search / filter.</td></tr>`;
    wrap.style.display = 'block';
    return;
  }
  body.innerHTML = rows.map(r => {
    const trCls = ['fefo-' + r.statusKey, r.isFirstOfSplit ? 'fefo-split-first' : ''].filter(Boolean).join(' ');
    const xf = r.batchCode ? wExp_flag(r.expiryDate) : null, xc = xf ? (xf.expired ? 'exp-expired' : 'exp-near') : '';
    const cells = cols.map(c => {
      let val = '';
      if (xf && c.key === 'sku') return `<td class="${xc}" title="Expiry in ${xf.days} day(s)">${highlight(r.sku ?? '')}</td>`;
      if (xf && c.key === 'expiryDate') return `<td class="${xc}">${highlight(fmtDate(r.expiryDate))}<span class="exp-tag ${xf.expired ? 'exp' : ''}">${xf.label}</span></td>`;
      if (c.kind === 'group') val = r.groupValues[c.key.slice(2)] ?? '';
      else if (c.key === 'prodDate' || c.key === 'expiryDate') val = fmtDate(r[c.key]);
      else if (c.kind === 'num') val = fmtNum(r[c.key]);
      else if (c.kind === 'status') {
        return `<td class="fefo-status ${r.statusKey}" title="${escapeHtml(r.statusNote || '')}">${highlight(r.status)}</td>`;
      } else val = c.key === 'whsCode' ? rkWhs(r.locationCode) : (r[c.key] ?? '');
      const cls = c.kind === 'num' ? 'fefo-num' : '';
      return `<td class="${cls}">${highlight(val)}</td>`;
    }).join('');
    return `<tr class="${trCls}${xf ? ' exp-row-near' : ''}">${cells}</tr>`;
  }).join('');
  wrap.style.display = 'block';
}

function wFefo_updateExportScopeNote() {
  const el = $('wFefoExportScope');
  if (!el) return;
  if (!wFefoState.results.length) { el.textContent = ''; return; }
  const visible = wFefo_getVisibleResults().length;
  const total = wFefoState.results.length;
  const desc = wFefo_getFilterSummary();
  if (!desc) {
    el.textContent = `Print / Export / Upload will use all ${total} row(s).`;
  } else {
    el.innerHTML = `Filter active: <strong>${escapeHtml(desc)}</strong> — Print / Export / Upload will use only the <strong>${visible}</strong> visible row(s) (out of ${total}).`;
  }
}

document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'wFefoSearch') {
    wFefoState.searchQuery = e.target.value || '';
    wFefo_applySearchFilter();
    wFefo_renderResults();
    wFefo_updateExportScopeNote();
  }
});
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'wFefoOnlyProblems') {
    wFefo_applySearchFilter();
    wFefo_renderResults();
    wFefo_updateExportScopeNote();
  }
});

