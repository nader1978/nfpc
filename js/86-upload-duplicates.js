/* ============================================================
   ⚠ UPLOAD DUPLICATES — before an upload writes data that is already in the database (same dates / same keys),
   the user is asked what to do:  ➕ Append (keep the old, add the new)  ·  ♻ Overwrite (remove / replace the old first)
   · (⏭ Skip the duplicates, where it makes sense)  ·  ✕ Cancel.
   Used by: Attendance upload, the Data Upload (incremental uploader), Daily plan, F&D picking, Good-return balance,
   and every "Upload destination" push that is a bulk upload (Staff roster, FOC vouchers, Logistics ready plan …).
     UPDUP.ask({ title, what, sample, count, options })   → 'append' | 'overwrite' | 'skip' | 'cancel'
     UPDUP.guard({ siteId, listId, token, listName, label, fields: [fieldObj…], keyCols?: [col…] })
        reads the list, finds the items that the upload repeats (by key columns, or by the date / plan / document
        columns that are the same on every row), asks, deletes them on "Overwrite"  → 'new' | 'append' | 'overwrite' | 'cancel'
   ============================================================ */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = document.createElement('style'); css.textContent = `
#updDlg{position:fixed;inset:0;z-index:100008;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:18px}
#updDlg .ud{background:var(--card,#fff);color:var(--text,#0f172a);width:min(620px,100%);border-radius:16px;box-shadow:0 30px 70px -20px rgba(15,23,42,.65);overflow:hidden}
#updDlg .ud-h{display:flex;gap:12px;align-items:flex-start;padding:16px 18px;background:linear-gradient(120deg,#fff7ed,#fef3c7);border-bottom:1px solid #fde68a;color:#7c2d12}body.dark #updDlg .ud-h{background:linear-gradient(120deg,#3b2410,#3a2e0c);color:#fde68a;border-color:#6b4f1d}
#updDlg .ud-h .i{font-size:28px;line-height:1}#updDlg .ud-h b{font-size:16px;display:block}#updDlg .ud-h small{font-size:12.5px;opacity:.9}
#updDlg .ud-b{padding:14px 18px;font-size:13.5px;max-height:44vh;overflow:auto}#updDlg .ud-s{margin:8px 0 0;padding:8px 10px;border:1px dashed var(--border);border-radius:10px;font-size:12.5px;background:var(--gray-50,#f8fafc);max-height:140px;overflow:auto}
#updDlg .ud-o{display:grid;gap:8px;padding:0 18px 12px}#updDlg .ud-o button{display:flex;gap:12px;align-items:center;text-align:left;width:100%!important;padding:10px 12px!important;border-radius:12px!important;border:1px solid var(--border)!important;background:var(--card,#fff)!important;color:inherit!important;cursor:pointer;font-size:13.5px}
#updDlg .ud-o button:hover{border-color:var(--brand,#2563eb)!important;box-shadow:0 0 0 3px rgba(37,99,235,.12)}#updDlg .ud-o button i{font-style:normal;font-size:20px;width:28px;text-align:center}#updDlg .ud-o button b{display:block}#updDlg .ud-o button small{color:var(--gray-600,#64748b);font-size:12px}
#updDlg .ud-o button.ow{border-color:#fca5a5!important}#updDlg .ud-o button.ow:hover{box-shadow:0 0 0 3px rgba(220,38,38,.14)}
#updDlg .ud-f{display:flex;justify-content:flex-end;padding:10px 18px 14px;border-top:1px solid var(--border)}#updDlg .ud-f button{width:auto!important}`;
  document.head.appendChild(css);
  const OPT = {
    append: ['➕', 'Append', 'Keep what is already there and add the new data as well'],
    overwrite: ['♻', 'Overwrite', 'Remove the existing data for these dates / keys first, then upload the file'],
    skip: ['⏭', 'Skip the duplicates', 'Upload only the rows that are not there yet']
  };
  function ask(o) { return new Promise(res => { let d = document.querySelector('#updDlg'); if (d) d.remove(); d = document.createElement('div'); d.id = 'updDlg'; d.dataset.nohc = '1';
    const opts = o.options || ['append', 'overwrite'], lab = Object.assign({}, OPT, o.labels || {});
    d.innerHTML = `<div class="ud" data-nohc="1"><div class="ud-h"><span class="i">⚠</span><div><b>${esc(o.title || 'This data is already uploaded')}</b><small>${esc(o.sub || '')}</small></div></div>
      <div class="ud-b">${o.what || ''}${o.sample && o.sample.length ? `<div class="ud-s">${o.sample.slice(0, 40).map(esc).join(' · ')}${o.sample.length > 40 ? ' … +' + (o.sample.length - 40) + ' more' : ''}</div>` : ''}<div style="margin-top:10px;font-weight:600">What do you want to do?</div></div>
      <div class="ud-o">${opts.map(k => `<button type="button" data-ud="${k}" class="${k === 'overwrite' ? 'ow' : ''}"><i>${lab[k][0]}</i><span><b>${esc(lab[k][1])}</b><small>${esc(lab[k][2])}</small></span></button>`).join('')}</div>
      <div class="ud-f"><button type="button" class="ghost" data-ud="cancel">✕ Cancel the upload</button></div></div>`;
    document.body.appendChild(d); const done = v => { d.remove(); document.removeEventListener('keydown', k); res(v); }, k = e => { if (e.key === 'Escape') done('cancel'); };
    document.addEventListener('keydown', k); d.addEventListener('click', e => { const b = e.target.closest('[data-ud]'); if (b) done(b.dataset.ud); }); }); }
  /* ---- value normalising (dates compared by day) ---- */
  const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;
  const dayOf = v => { const s = String(v == null ? '' : v).trim(); if (ISO.test(s)) { if (s.length > 10) { const d = new Date(s); if (!isNaN(d)) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0'); return y + '-' + m + '-' + dd; } } return s.slice(0, 10); } const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : s.toLowerCase(); };
  const isNowStamp = v => { const s = String(v || ''); if (!/T\d{2}:\d{2}/.test(s)) return false; const t = new Date(s).getTime(); return isFinite(t) && Math.abs(Date.now() - t) < 6 * 3600e3 && !/T00:00(:00)?/.test(s); };
  const KEYNAME = /date|day|week|month|period|plan|trip|doc|ref|voucher|batch|shift|route/i, SKIPNAME = /^(created|modified|author|editor|uploaded.?by|upload.?by|user|title)$|timestamp|time_?stamp|uploaded.?at|upload.?date/i;
  /* the columns that identify "this upload": the same value on every row, and a date / plan / document kind of column */
  function constKeys(F) { if (!F.length) return []; const ks = Object.keys(F[0]).filter(k => KEYNAME.test(k) && !SKIPNAME.test(k));
    return ks.filter(k => { const v0 = dayOf(F[0][k]); if (!v0 || isNowStamp(F[0][k])) return false; return F.every(f => dayOf(f[k]) === v0); }); }
  async function guard(o) { try {
    const F = (o.fields || []).filter(f => f && Object.keys(f).length); if (!F.length || !o.siteId || !o.listId) return 'new';
    let keys = (o.keyCols || []).filter(k => F[0][k] != null), mode = 'combo';
    if (!keys.length) { keys = constKeys(F); mode = 'const'; } if (!keys.length) return 'new';
    const sig = f => keys.map(k => dayOf(f[k])).join('\u0001'), want = new Set(F.map(sig));
    window.__opQuiet = Date.now() + 60000;
    const items = await fetchAllItems(o.siteId, o.listId, o.token || getGlobalAccessToken());
    const hit = items.filter(it => want.has(sig(it.fields || {}))); if (!hit.length) return 'new';
    const vals = [...new Set(hit.map(it => keys.map(k => { const v = (it.fields || {})[k]; return ISO.test(String(v || '')) ? dayOf(v) : v; }).join(' · ')))];
    const ch = await ask({ title: 'This data is already in “' + (o.listName || 'the list') + '”', sub: (o.label ? o.label + ' · ' : '') + hit.length + ' existing item(s) match this upload',
      what: `<p style="margin:0">The list already holds <b>${hit.length}</b> item(s) with the same <b>${esc(keys.map(k => k.replace(/_/g, ' ')).join(' + '))}</b> as the file you are uploading (${F.length} row(s)).</p>`, sample: vals, options: o.options || ['append', 'overwrite'] });
    if (ch === 'cancel') return 'cancel';
    window.__opNoAsk = Date.now() + 10 * 60000;   /* the user decided — no second "save?" question for this upload */
    if (ch === 'overwrite') { let n = 0, bad = 0; const say = o.onProg || (() => {}); const q = hit.slice();
      const w = async () => { while (q.length) { const it = q.shift(); try { await deleteItem(o.siteId, o.listId, it.id, o.token || getGlobalAccessToken()); n++; } catch (e) { bad++; } say('Removing the existing data… ' + (n + bad) + ' / ' + hit.length); } };
      await Promise.all([w(), w(), w(), w()]); try { addActivity('upload', `Overwrite: ${n} existing item(s) removed from "${o.listName || o.listId}" before the upload`); } catch (e) {}
      if (bad) try { sectionToast(`⚠ ${bad} existing item(s) could not be removed — they stay in the list.`, 'warn'); } catch (e) {} }
    return ch; } catch (e) { console.warn('UPDUP.guard', e); return 'new'; } }
  window.UPDUP = { ask, guard, dayOf };
})();
