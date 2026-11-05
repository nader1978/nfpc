/* ---------- Key computation ---------- */
function inc_computeKey(row, keyCols) {
  const parts = keyCols.map(c => {
    let v = row[c];
    if (v === null || v === undefined) v = '';
    return String(v).trim().toLowerCase();
  });
  return parts.join('\u0001');
}

/* ---------- Load target list columns ---------- */
async function inc_loadColumns(force = false) {
  const listName = incUploadState.listName;
  if (!listName) { inc_setColsStatus('⚠ Pick a list first.'); return; }
  if (!force && incUploadState.columnsLoadedFor === listName && incUploadState.columns.length) return;
  const token = getGlobalAccessToken();
  const siteUrl = getGlobalSiteUrl();
  if (!token || !siteUrl) { inc_setColsStatus('⚠ Global Site URL and Token are not configured.'); return; }
  if (!isListVisible(listName)) { inc_setColsStatus(`✘ No permission to access "${listName}"`); return; }
  if (!isListEditable(listName)) { inc_setColsStatus(`✘ READ-ONLY access to "${listName}" — upload blocked`); return; }
  inc_setColsStatus('Loading columns...');
  try {
    const { siteId, listId } = await resolveIds(siteUrl, listName, token);
    incUploadState.siteId = siteId;
    incUploadState.listId = listId;
    const cols = await fetchColumns(siteId, listId, token);
    incUploadState.columns = cols.filter(c => !READ_ONLY_COLUMNS.has(c.name.toLowerCase()));
    incUploadState.columnsLoadedFor = listName;
    inc_setColsStatus(`✓ ${incUploadState.columns.length} writable columns`);
    inc_resetExistingCache();
    $('incUploadKeyCard').style.display = 'block';
    $('incUploadFileCard').style.display = 'block';
    inc_renderKeyRows();
    if (incUploadState.parsedRows.length) inc_autoMap();
    inc_updateReadySummary();
  } catch (err) {
    inc_setColsStatus('✘ ' + err.message);
  }
}

function inc_resetExistingCache() {
  incUploadState.existingKeys = null;
  incUploadState.existingCount = 0;
}

/* ---------- Existing-key set (read the whole target list) ---------- */
async function inc_loadExistingKeys() {
  if (!incUploadState.siteId || !incUploadState.listId) throw new Error('Load target list columns first.');
  const token = getGlobalAccessToken();
  if (!token) throw new Error('Global token not configured.');
  const keyCols = incUploadState.keyColumns;
  if (!keyCols.length) throw new Error('Pick at least one key column.');
  // Map key columns (Excel names) to SharePoint field names using current mapping,
  // except the split fields — those use the same name on both sides.
  const spKeyFields = keyCols.map(c => {
    const mapped = incUploadState.mapping[c];
    if (mapped && mapped !== SKIP_VALUE) return mapped;
    // Fall back to the raw name — may or may not exist on the list
    return c;
  });
  const items = await fetchAllItems(incUploadState.siteId, incUploadState.listId, token, n => {
    $('incUploadColsStatus').textContent = `Reading target list... ${n.toLocaleString()} rows`;
  });
  const keys = new Set();
  for (const it of items) {
    const f = it.fields || {};
    const parts = spKeyFields.map(sp => {
      const v = f[sp];
      if (v === null || v === undefined) return '';
      return String(v).trim().toLowerCase();
    });
    keys.add(parts.join('\u0001'));
  }
  incUploadState.existingKeys = keys;
  incUploadState.existingCount = items.length;
  $('incUploadColsStatus').textContent = `✓ ${items.length.toLocaleString()} existing rows indexed`;
}

/* ---------- Key rows UI ---------- */
function inc_renderKeyRows() {
  const host = $('incUploadKeyRows');
  host.innerHTML = '';
  const headers = incUploadState.parsedHeaders.length ? incUploadState.parsedHeaders : [];
  if (!headers.length) {
    host.innerHTML = '<div class="inc-key-empty">Load a file first to see available columns.</div>';
    inc_updateKeySummary();
    return;
  }
  if (!incUploadState.keyColumns.length) {
    host.innerHTML = '<div class="inc-key-empty">No key columns selected — click ⚡ Auto-detect or ➕ Add.</div>';
    inc_updateKeySummary();
    return;
  }
  incUploadState.keyColumns.forEach((col, idx) => {
    const row = document.createElement('div');
    row.className = 'inc-key-row';
    const opts = headers.map(h => `<option value="${escapeHtml(h)}" ${h === col ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('');
    row.innerHTML = `
      <span class="key-idx">${idx + 1}</span>
      <select data-idx="${idx}">${opts}</select>
      <span class="text-sm" style="font-family:Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(String(incUploadState.parsedRows[0]?.[col] ?? ''))}">sample: ${escapeHtml(String(incUploadState.parsedRows[0]?.[col] ?? '').slice(0, 40))}</span>
      <button class="danger small icon-only" data-idx="${idx}" title="Remove">✖</button>`;
    row.querySelector('select').addEventListener('change', (e) => {
      incUploadState.keyColumns[idx] = e.target.value;
      inc_resetExistingCache();
      inc_updateKeySummary();
      inc_recomputeNewRows();
    });
    row.querySelector('button').addEventListener('click', () => {
      incUploadState.keyColumns.splice(idx, 1);
      inc_resetExistingCache();
      inc_renderKeyRows();
      inc_recomputeNewRows();
    });
    host.appendChild(row);
  });
  inc_updateKeySummary();
}
function inc_updateKeySummary() {
  const el = $('incUploadKeySummary');
  if (!el) return;
  if (!incUploadState.keyColumns.length) { el.textContent = ''; return; }
  el.textContent = `${incUploadState.keyColumns.length} key column(s)`;
}
$('incUploadKeyAddBtn').addEventListener('click', () => {
  if (!incUploadState.parsedHeaders.length) { inc_setFileStatus('Load a file first.', 'warn'); return; }
  const available = incUploadState.parsedHeaders.find(h => !incUploadState.keyColumns.includes(h));
  if (!available) { inc_setFileStatus('All columns already used as keys.', 'warn'); return; }
  incUploadState.keyColumns.push(available);
  inc_resetExistingCache();
  inc_renderKeyRows();
  inc_recomputeNewRows();
});
$('incUploadKeyAutoBtn').addEventListener('click', () => {
  if (!incUploadState.parsedHeaders.length) { inc_setFileStatus('Load a file first.', 'warn'); return; }
  const present = INC_DEFAULT_KEYS.filter(k => incUploadState.parsedHeaders.includes(k));
  if (present.length) {
    incUploadState.keyColumns = present;
  } else {
    // Fallback: first 3 headers that aren't the skip-noise column
    incUploadState.keyColumns = incUploadState.parsedHeaders
      .filter(h => !INC_SKIP_DEFAULT.includes(h.toLowerCase()))
      .slice(0, 3);
  }
  inc_resetExistingCache();
  inc_renderKeyRows();
  inc_recomputeNewRows();
  inc_setFileStatus(`Auto-detected ${incUploadState.keyColumns.length} key column(s).`, 'success');
});
$('incUploadKeyResetBtn').addEventListener('click', () => {
  incUploadState.keyColumns = [];
  inc_resetExistingCache();
  inc_renderKeyRows();
  inc_recomputeNewRows();
});
$('incUploadLoadColsBtn').addEventListener('click', async () => {
  try { await inc_loadColumns(true); } catch (e) { inc_setColsStatus('✘ ' + e.message); }
});

/* ---------- File handling ---------- */
const incDropzone = $('incUploadDropzone');
const incFileInput = $('incUploadFileInput');
incDropzone.addEventListener('click', () => { if (hasPerm('uploader')) incFileInput.click(); });
incDropzone.addEventListener('dragover', (e) => { e.preventDefault(); if (hasPerm('uploader')) incDropzone.classList.add('dragover'); });
incDropzone.addEventListener('dragleave', () => incDropzone.classList.remove('dragover'));
incDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  incDropzone.classList.remove('dragover');
  if (!hasPerm('uploader')) { inc_setFileStatus('Permission denied.', 'error'); return; }
  if (e.dataTransfer.files.length) inc_handleFile(e.dataTransfer.files[0]);
});
incFileInput.addEventListener('change', (e) => { if (e.target.files.length) inc_handleFile(e.target.files[0]); });

async function inc_handleFile(file) {
  if (!hasPerm('uploader')) { inc_setFileStatus('Permission denied.', 'error'); return; }
  inc_setFileStatus('');
  incUploadParseProgress.start(`Parsing "${file.name}"...`, 0);
  try {
    incUploadParseProgress.update(1, 3, 'Reading file...');
    await new Promise(r => setTimeout(r, 0));
    const rawRows = await parseFileToRows(file);
    incUploadParseProgress.update(2, 3, `${rawRows.length.toLocaleString()} rows parsed`);
    await new Promise(r => setTimeout(r, 0));
    if (!rawRows.length) { incUploadParseProgress.error('No data rows'); inc_setFileStatus('No data rows found.', 'warn'); return; }

    // Enrich each row with split fields + whitespace trims
    const enriched = rawRows.map(inc_enrichRow);
    const rawHeaders = Object.keys(rawRows[0]);
    const headers = inc_enrichHeaders(rawHeaders);

    incUploadState.parsedRows = enriched;
    incUploadState.parsedHeaders = headers;
    incUploadState.fileName = file.name;
    incUploadState.parsedAt = Date.now();
    incUploadState.newRows = [];

    // Seed defaults once
    if (!incUploadState.keyColumns.length) {
      const present = INC_DEFAULT_KEYS.filter(k => headers.includes(k));
      incUploadState.keyColumns = present.length ? present : headers.filter(h => !INC_SKIP_DEFAULT.includes(h.toLowerCase())).slice(0, 3);
    }
    if (!Object.keys(incUploadState.mapping).length && incUploadState.columns.length) {
      inc_autoMap();
    }

    incUploadParseProgress.finish(`✅ Parsed ${enriched.length.toLocaleString()} rows`);
    const s = $('incUploadFileSummary');
    s.style.display = 'block';
    s.textContent = `✓ Loaded "${file.name}" — ${enriched.length.toLocaleString()} rows, ${headers.length} columns (incl. ${INC_SPLIT_FIELDS.length} split fields).`;
    inc_setFileStatus(`✓ File ready.`, 'success');

    $('incUploadSummaryCard').style.display = 'block';
    $('incUploadPreviewCard').style.display = 'block';
    $('incUploadMappingCard').style.display = 'block';
    $('incUploadUploadCard').style.display = 'block';

    inc_renderKeyRows();
    inc_renderMapping();
    inc_recomputeNewRows();
    inc_updateReadySummary();
  } catch (err) {
    incUploadParseProgress.error('✘ ' + err.message);
    inc_setFileStatus('Failed to parse: ' + err.message, 'error');
  }
}

/* ---------- Recompute "new" rows ---------- */
async function inc_recomputeNewRows() {
  if (!incUploadState.parsedRows.length || !incUploadState.keyColumns.length) {
    incUploadState.newRows = [];
    inc_renderSummary();
    inc_renderPreview();
    inc_updateReadySummary();
    return;
  }
  // Need existing keys — load if not loaded
  if (incUploadState.existingKeys === null && incUploadState.listId) {
    try {
      inc_setColsStatus('Reading target list...');
      await inc_loadExistingKeys();
    } catch (err) {
      inc_setColsStatus('⚠ Could not read target list: ' + err.message);
      // Fall back to local cache only
      incUploadState.existingKeys = new Set();
    }
  }
  const existing = incUploadState.existingKeys || new Set();
  const keyCols = incUploadState.keyColumns;
  const seenInFile = new Set();
  const newRows = [];
  const dupCount = { existing: 0, inFile: 0 };
  for (const row of incUploadState.parsedRows) {
    const k = inc_computeKey(row, keyCols);
    if (existing.has(k)) { dupCount.existing++; continue; }
    if (seenInFile.has(k)) { dupCount.inFile++; continue; }
    seenInFile.add(k);
    newRows.push(row);
  }
  incUploadState.newRows = newRows;
  incUploadState.lastResult = {
    total: incUploadState.parsedRows.length,
    existingDup: dupCount.existing,
    inFileDup: dupCount.inFile,
    newCount: newRows.length,
    ts: Date.now(),
  };
  inc_renderSummary();
  inc_renderPreview();
  inc_updateReadySummary();
}
$('incUploadRescanBtn').addEventListener('click', async () => {
  if (!incUploadState.listId) { inc_setColsStatus('Load the target list first.'); return; }
  inc_resetExistingCache();
  await inc_recomputeNewRows();
});

/* ---------- Summary card ---------- */
function inc_renderSummary() {
  const body = $('incUploadSummaryBody');
  const note = $('incUploadSummaryNote');
  if (!body) return;
  const st = incUploadState;
  const lr = st.lastResult;
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
  const last = lr ? formatDate(lr.ts) : '—';
  body.innerHTML = `
    <div><strong>Target list:</strong> ${escapeHtml(st.listName || '—')}</div>
    <div><strong>File:</strong> ${escapeHtml(st.fileName || '—')}</div>
    <div><strong>Rows in file:</strong> ${fmt(st.parsedRows.length)}</div>
    <div><strong>Already in SharePoint:</strong> ${fmt(lr ? lr.existingDup : (st.existingKeys ? st.existingCount : null))}</div>
    <div><strong>Duplicate within file:</strong> ${fmt(lr ? lr.inFileDup : null)}</div>
    <div><strong>New rows to upload:</strong> <span style="color:var(--success);font-weight:700;">${fmt(st.newRows.length)}</span></div>
    <div><strong>Total rows in list (indexed):</strong> ${fmt(st.existingCount || null)}</div>
    <div><strong>Last scan:</strong> ${last}</div>`;
  if (st.keyColumns.length && st.existingKeys && st.newRows.length === 0 && st.parsedRows.length > 0) {
    note.style.display = 'block';
    note.innerHTML = 'ℹ Nothing to upload — every row in the file is already in the target list.';
  } else if (st.existingKeys === null) {
    note.style.display = 'block';
    note.innerHTML = 'ℹ Target list not read yet — click <strong>🔍 Rescan</strong> to compute new rows.';
  } else {
    note.style.display = 'none';
  }
}
$('incUploadResetBtn').addEventListener('click', () => {
  if (!incUploadState.listId) { inc_setStatus('Load the target list first.', 'warn'); return; }
  if (!confirm('Forget the locally cached "already uploaded" snapshot for this list?\n\nThis does NOT delete anything from SharePoint. It just forces a fresh read of the target list on the next scan.')) return;
  inc_resetExistingCache();
  inc_recomputeNewRows();
  inc_setStatus('Local history cleared. Rescanning...', 'info');
});

/* ---------- Preview table ---------- */
function inc_renderPreview() {
  const head = $('incUploadPreviewHead');
  const body = $('incUploadPreviewBody');
  const countEl = $('incUploadPreviewCount');
  if (!head || !body) return;
  const rows = incUploadState.newRows;
  countEl.textContent = `${rows.length} row${rows.length === 1 ? '' : 's'}`;
  if (!rows.length) {
    head.innerHTML = '';
    body.innerHTML = `<tr><td style="padding:20px;text-align:center;color:var(--gray-400);font-style:italic;">No new rows to show.</td></tr>`;
    return;
  }
  // Show: key columns + a few interesting fields
  const showCols = [
    ...incUploadState.keyColumns,
    ...INC_SPLIT_FIELDS.filter(f => incUploadState.parsedHeaders.includes(f) && !incUploadState.keyColumns.includes(f)),
    ...incUploadState.parsedHeaders
      .filter(h => !incUploadState.keyColumns.includes(h)
                && !INC_SPLIT_FIELDS.includes(h)
                && !INC_SKIP_DEFAULT.includes(h.toLowerCase()))
      .slice(0, 8),
  ].slice(0, 14);
  head.innerHTML = `<tr>${showCols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
  const preview = rows.slice(0, 200);
  body.innerHTML = preview.map(r => `<tr>${showCols.map(c => `<td title="${escapeHtml(String(r[c] ?? ''))}">${escapeHtml(String(r[c] ?? '').slice(0, 60))}</td>`).join('')}</tr>`).join('') +
    (rows.length > preview.length ? `<tr><td colspan="${showCols.length}" style="text-align:center;color:var(--gray-400);font-style:italic;">…and ${rows.length - preview.length} more</td></tr>` : '');
}

/* ---------- Mapping ---------- */
function inc_autoMap() {
  if (!incUploadState.columns.length || !incUploadState.parsedHeaders.length) return;
  const cols = incUploadState.columns;
  const map = {};
  incUploadState.parsedHeaders.forEach(h => {
    const lc = h.toLowerCase();
    if (INC_SKIP_DEFAULT.includes(lc)) { map[h] = SKIP_VALUE; return; }
    let hit = cols.find(c => c.name.toLowerCase() === lc);
    if (!hit) {
      const nh = normalize(h);
      hit = cols.find(c => normalize(c.name) === nh || normalize(c.displayName) === nh);
    }
    map[h] = hit ? hit.name : SKIP_VALUE;
  });

  /* Synthetic Current User */
  const userHit = findCurrentUserColumn(cols);
  map[CURRENT_USER_FIELD_KEY] = userHit ? userHit.name : SKIP_VALUE;

  try { if (utReady('incup')) { const am = Object.assign({}, utGet('incup').map, incUploadState._docMap || {}); incUploadState.parsedHeaders.forEach(h => { if (am[h] !== undefined) map[h] = am[h]; }); if (am[CURRENT_USER_FIELD_KEY] !== undefined) map[CURRENT_USER_FIELD_KEY] = am[CURRENT_USER_FIELD_KEY]; } } catch (e) {}
  incUploadState.mapping = map;
}
function inc_renderMapping() {
  try { if (incUploadState.parsedHeaders.length) localStorage.setItem(INC_HDR_KEY, JSON.stringify(incUploadState.parsedHeaders.filter(h => !INC_SKIP_DEFAULT.includes(String(h).toLowerCase())))); } catch (e) {}
  const body = $('incUploadMapBody');
  if (!body) return;
  body.innerHTML = '';
  if (!incUploadState.parsedHeaders.length) {
    body.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--gray-400);font-style:italic;padding:14px;">Load a file to see columns.</td></tr>`;
    return;
  }
  if (!incUploadState.columns.length) {
    body.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--gray-400);font-style:italic;padding:14px;">Load target list columns first.</td></tr>`;
    return;
  }

  /* Synthetic Current User row goes last (after Excel columns) */
  const headersForMapping = [...incUploadState.parsedHeaders, CURRENT_USER_FIELD_KEY];

  headersForMapping.forEach(h => {
    const isSynthetic = h === CURRENT_USER_FIELD_KEY;
    const isSplit = !isSynthetic && INC_SPLIT_FIELDS.includes(h);
    const isSkip = !isSynthetic && INC_SKIP_DEFAULT.includes(h.toLowerCase());
    const tr = document.createElement('tr');
    const sampleVal = isSynthetic
      ? getCurrentUserValue()
      : String(incUploadState.parsedRows[0]?.[h] ?? '').slice(0, 60);
    const current = incUploadState.mapping[h] || SKIP_VALUE;
    const badge = isSynthetic
      ? (current === SKIP_VALUE ? '<span class="badge skip">SKIP</span>' : '<span class="badge auto">USER</span>')
      : isSkip
        ? '<span class="badge skip">SKIP</span>'
        : (isSplit ? '<span class="badge auto">SPLIT</span>' : (current === SKIP_VALUE ? '<span class="badge skip">SKIP</span>' : '<span class="badge auto">→</span>'));
    const labelHtml = isSynthetic
      ? `<strong>${CURRENT_USER_FIELD_LABEL}</strong> ${badge}`
      : `<strong>${escapeHtml(h)}</strong> ${badge}`;
    tr.innerHTML = `<td>${labelHtml}</td>` +
                   `<td class="sample-value" title="${escapeHtml(sampleVal)}">${escapeHtml(sampleVal)}</td>` +
                   `<td class="combo-cell"></td>`;
    const combo = buildCombo(current, incUploadState.columns, (nv) => {
      incUploadState.mapping[h] = nv;
      inc_updateMapSummary();
      inc_updateReadySummary();
    });
    tr.querySelector('.combo-cell').appendChild(combo);
    body.appendChild(tr);
  });

  inc_updateMapSummary();
}
function inc_updateMapSummary() {
  const el = $('incUploadMapSummary');
  if (!el) return;
  const mapped = Object.values(incUploadState.mapping || {}).filter(v => v && v !== SKIP_VALUE).length;
  const skipped = Object.values(incUploadState.mapping || {}).filter(v => v === SKIP_VALUE).length;
  el.textContent = `${mapped} mapped, ${skipped} skipped`;
}
$('incUploadAutoMapBtn').addEventListener('click', () => { inc_autoMap(); inc_renderMapping(); inc_updateReadySummary(); });
$('incUploadResetMapBtn').addEventListener('click', () => { incUploadState.mapping = {}; inc_renderMapping(); inc_updateReadySummary(); });

/* ---------- Ready summary + upload button ---------- */
/* Oasis Prism Upload gate: nothing goes to SharePoint until the Picking List of exactly the rows being uploaded is printed / created, so its number travels with the data */
function incPlGate() {
  const rows = inc_uploadRows(); if (!rows.length) return '';
  const miss = rows.filter(r => !r['Picking_List_No']).length;
  return miss ? `Print / create the Picking List first — ${miss} of ${rows.length} selected row(s) have no Picking List number yet (use “🖨 Picking list” above the table). The number is uploaded with the rows.` : '';
}
function inc_updateReadySummary() {
  const el = $('incUploadReadySummary');
  const btn = $('incUploadGoBtn');
  if (!btn || !el) return;
  const canUpload = hasPerm('uploader')
    && incUploadState.listId
    && inc_uploadRows().length > 0
    && Object.values(incUploadState.mapping || {}).some(v => v && v !== SKIP_VALUE)
    && !incPlGate();
  btn.disabled = !canUpload; btn.title = incPlGate() || '';
  if (!incUploadState.newRows.length) { el.textContent = incUploadState.parsedRows.length ? 'Nothing new to upload.' : ''; return; }
  { const g = incPlGate(); el.innerHTML = `${inc_uploadRows().length} of ${incUploadState.newRows.length} new row(s) selected for upload` + (g ? `<div style="color:#b45309;font-weight:600;margin-top:4px">🔒 ${escapeHtml(g)}</div>` : (inc_uploadRows().length ? `<div style="color:#15803d;margin-top:4px">✓ Picking List ${escapeHtml([...new Set(inc_uploadRows().map(r => r['Picking_List_No']))].slice(0, 3).join(', '))} will be uploaded with the rows</div>` : '')); } try { inc_kpis(); } catch (e) {}
}

function incUpDocLines(rows) {   // tells the user which printed document numbers travel with the rows
  let t = ''; Object.values(INCP).forEach(D => { const n = rows.filter(r => r[D.col]).length; if (!n) return; const nos = [...new Set(rows.map(r => r[D.col]).filter(Boolean))], col = (incUploadState.mapping || {})[D.col], ok = col && col !== SKIP_VALUE;
    t += `\n${ok ? '✓' : '⚠'} ${D.title} no. ${nos.slice(0, 3).join(', ')}${nos.length > 3 ? ' …' : ''} — ${n} of ${rows.length} row(s)` + (ok ? ` → column “${col}”` : ` — NOT uploaded: “${D.col}” is not mapped to a SharePoint column (ask the administrator)`); }); return t; }
/* ---------- Upload ---------- */
$('incUploadGoBtn').addEventListener('click', async () => {
  if (!hasPerm('uploader')) { inc_setStatus('Permission denied.', 'error'); return; }
  if (!incUploadState.listId || !incUploadState.siteId) { inc_setStatus('Load target list columns first.', 'error'); return; }
  if (!incUploadState.newRows.length) { inc_setStatus('No new rows to upload.', 'warn'); return; }
  if (!inc_uploadRows().length) { inc_setStatus('No rows are selected — tick at least one new row (or clear the filters).', 'warn'); return; }
  { const g = incPlGate(); if (g) { inc_setStatus('🔒 ' + g, 'error'); sectionToast(g, 'warn'); return; } }
  const token = getGlobalAccessToken();
  if (!token) { inc_setStatus('Global token not configured.', 'error'); return; }
  try { const em = await utEffMap('incup'); Object.values(INCP).forEach(D => { if (inc_uploadRows().some(r => r[D.col]) && em[D.col] && em[D.col] !== SKIP_VALUE) incUploadState.mapping[D.col] = em[D.col]; }); } catch (e) {}
  { const pm = (incUploadState.mapping || {})[INCP.pl.col]; if (!pm || pm === SKIP_VALUE) { const m = `The Picking List number cannot travel with the data: “${INCP.pl.col}” is not mapped to a column of the SharePoint list — ask the administrator to map it (Upload Destinations › Oasis Prism Upload).`; inc_setStatus('🔒 ' + m, 'error'); sectionToast(m, 'warn'); return; } }
  const activeMapping = Object.entries(incUploadState.mapping || {}).filter(([, v]) => v && v !== SKIP_VALUE);
  if (!activeMapping.length) { inc_setStatus('Map at least one column.', 'error'); return; }

  const upRows = inc_uploadRows(); if (!upRows.length) { inc_setStatus('No rows are selected — tick at least one new row (or clear the filters).', 'warn'); return; }
  const total = upRows.length;
  if (!(await spAsk(`Upload ${total} of ${incUploadState.newRows.length} new row(s) to "${incUploadState.listName}"?` + (incX_filtersOn() ? ' (only the rows matching your filters)' : '') + incUpDocLines(upRows) + `\n\n` +
               `(Rows already in the list and duplicate rows in the file will be skipped.)`))) return;

  $('incUploadGoBtn').disabled = true; try { $('incUploadDoneSummary').style.display = 'none'; } catch (e) {}
  inc_setStatus('Uploading...', 'info');
  $('incUploadLog').textContent = '';
  incUploadGoProgress.start(`Uploading ${total} new row(s)...`, total);

  let ok = 0, fail = 0; const okRows = [];
  const errors = [];
  for (let i = 0; i < total; i++) {
    const row = upRows[i];
    const fields = {};
    activeMapping.forEach(([excelCol, spField]) => {
      if (excelCol === CURRENT_USER_FIELD_KEY) {
        fields[spField] = getCurrentUserValue();
        return;
      }
      let v = row[excelCol];
      if (v === null || v === undefined || v === '') return;
      fields[spField] = String(v);
    });
    addAuditMetadata(fields, { columns: incUploadState.columns });
    if (!Object.keys(fields).length) {
      fail++;
      incUploadGoProgress.update(i + 1, total, `Row ${i + 1}: no mappable values`);
      continue;
    }
    try {
      await createItem(incUploadState.siteId, incUploadState.listId, fields, token);
      ok++; okRows.push(row);
      incUploadGoProgress.update(i + 1, total, `✔ ${ok} ok, ${fail} failed`);
    } catch (err) {
      fail++;
      errors.push(`Row ${i + 1}: ${err.message}`);
      incUploadGoProgress.update(i + 1, total, `✘ ${err.message.slice(0, 60)}`);
      inc_log(`Row ${i + 1} failed: ${err.message}`);
    }
  }
  if (fail === 0) {
    incUploadGoProgress.finish(`✅ Uploaded ${ok.toLocaleString()} new row(s) to SharePoint`, true);
    inc_setStatus(`✓ Upload complete — ${ok.toLocaleString()} new row(s) added to “${incUploadState.listName}”.`, 'success');
    addActivity('upload', `Incremental upload: ${ok} new row(s) → "${incUploadState.listName}"`);
  } else {
    incUploadGoProgress.error(`⚠ ${ok} ok, ${fail} failed`);
    inc_setStatus(`⚠ ${ok.toLocaleString()} uploaded to “${incUploadState.listName}”, ${fail.toLocaleString()} failed.`, 'warn');
    addActivity('error', `Incremental upload: ${fail} failure(s)`);
    notifyFailure('Incremental Upload Partial Failure', `${fail} failure(s).\n\n${errors.slice(0, 5).join('\n')}`);
  }

  try { const ds = $('incUploadDoneSummary'); if (ds) { ds.style.display = 'block'; ds.style.color = fail ? 'var(--warning,#b45309)' : 'var(--success,#0b7a0b)'; ds.textContent = (fail ? '⚠ ' : '✓ ') + `${ok.toLocaleString()} new row(s) uploaded to “${incUploadState.listName}”` + (fail ? ` — ${fail.toLocaleString()} failed` : '') + ` — from “${incUploadState.fileName || 'file'}” · ${new Date().toLocaleString()}.`; ds.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } } catch (e) {}
  // Refresh the existing-key cache: add the keys we just uploaded
  if (incUploadState.existingKeys) {
    const keyCols = incUploadState.keyColumns;
    okRows.forEach(row => incUploadState.existingKeys.add(inc_computeKey(row, keyCols)));
    incUploadState.existingCount += ok;
  }
  incUploadState.sessionOk = (incUploadState.sessionOk || 0) + ok; incUploadState.sessionFail = (incUploadState.sessionFail || 0) + fail;
  // Recompute new rows against the now-updated cache
  await inc_recomputeNewRows();
  $('incUploadGoBtn').disabled = false;
});

