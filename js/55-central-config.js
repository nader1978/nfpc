/* ---------- Upload Destinations & Data Sources: the setup lives in SharePoint (App_Config_tbl, one row per destination: Title "UT:<id>") + search ---------- */
const CC_PREFIX = 'UT:';
const CC = { busy: false, timer: null, queue: new Set(), msg: '' };
const ccSay = (t, w) => { CC.msg = t; const e = document.querySelector('#ccStatus'); if (e) { e.textContent = t; e.style.color = w ? '#b45309' : ''; } };
const ccLocalIds = () => { const p = LS_BASE + '_ut_', ids = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(p) && k !== LS_BASE + '_ut_grp') ids.push(k.slice(p.length)); } } catch (e) {} return ids; };
async function ccPush(ids) {   /* admin: write the given destinations (or all) to SharePoint */
  if (!utIsAdmin()) return; const c = await tpCtx(); if (!c) throw new Error('sign in / Site URL is not ready'); const its = await fetchAllItems(c.siteId, c.listId, c.token), by = new Map(); its.forEach(x => { const t = String((x.fields || {}).Title || '').trim(); if (t.startsWith(CC_PREFIX)) by.set(t, x); });
  let n = 0; for (const id of ids) { const t = CC_PREFIX + id, val = JSON.stringify(utGet(id)), ex = by.get(t); if (ex && String((ex.fields || {}).Config_Value || '') === val) continue;
    if (ex) await updateItem(c.siteId, c.listId, ex.id, spCoerceFields(c.listId, { Config_Value: val }), c.token); else await createItem(c.siteId, c.listId, { Title: t, Config_Value: val }, c.token); n++; }
  return n;
}
function ccQueue(id) { if (!utIsAdmin()) return; CC.queue.add(id); clearTimeout(CC.timer); CC.timer = setTimeout(async () => { const ids = [...CC.queue]; CC.queue.clear(); try { const n = await ccPush(ids); ccSay('☁ Saved to SharePoint (' + (n || 0) + ' changed) · ' + new Date().toLocaleTimeString()); } catch (e) { ccSay('⚠ Saved here only — SharePoint: ' + e.message, 1); } }, 900); }
const _ccSet = utSet; utSet = function (id, v) { const r = _ccSet.apply(this, arguments); ccQueue(id); return r; };
async function ccPull(silent) {   /* everybody: read the destinations from SharePoint into this browser */
  try { const c = await tpCtx(); if (!c) return false; const its = await fetchAllItems(c.siteId, c.listId, c.token), rows = its.filter(x => String((x.fields || {}).Title || '').trim().startsWith(CC_PREFIX));
    if (!rows.length) { if (utIsAdmin()) { const ids = ccLocalIds().filter(i => { const v = utGet(i); return v.list; }); if (ids.length) { const n = await ccPush(ids); ccSay('☁ First time: ' + n + ' destination(s) of this browser were saved to SharePoint.'); } else ccSay('No destinations saved in SharePoint yet.'); } return false; }
    let n = 0; rows.forEach(x => { const id = String(x.fields.Title).trim().slice(CC_PREFIX.length); let v = null; try { v = JSON.parse(String(x.fields.Config_Value || '')); } catch (e) {} if (!v || typeof v !== 'object') return; const cur = JSON.stringify(utGet(id)), nv = { list: v.list || '', map: v.map || {} };
      if (!nv.list && !Object.keys(nv.map).length) { try { if (localStorage.getItem(utKey(id))) { localStorage.removeItem(utKey(id)); n++; } } catch (e) {} return; } if (cur !== JSON.stringify(nv)) { try { localStorage.setItem(utKey(id), JSON.stringify(nv)); n++; } catch (e) {} } });
    if (n) { try { if (typeof utSummary === 'function') utSummary(); if (activeViewId() === 'uploaddest') utRender(); } catch (e) {} try { if (typeof utSrcApplyAll === 'function') utSrcApplyAll(true); } catch (e) {} }
    ccSay('✔ ' + rows.length + ' destination(s) read from SharePoint' + (n ? ' · ' + n + ' updated here' : '') + ' · ' + new Date().toLocaleTimeString()); if (!silent && n) sectionToast('Upload destinations loaded from SharePoint (' + n + ' updated).', 'success'); return true; }
  catch (e) { ccSay('⚠ SharePoint (' + TP_LIST + '): ' + e.message, 1); return false; }
}
/* clearing a destination also clears it in SharePoint */
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#utHost button[data-a="clear"]'); if (!b) return; const id = b.closest('details[data-id]') && b.closest('details[data-id]').dataset.id; if (id) setTimeout(() => { try { if (!localStorage.getItem(utKey(id))) { CC.queue.add(id); const run = async () => { const c = await tpCtx(), its = await fetchAllItems(c.siteId, c.listId, c.token), ex = its.find(x => String((x.fields || {}).Title || '').trim() === CC_PREFIX + id); if (ex) await updateItem(c.siteId, c.listId, ex.id, spCoerceFields(c.listId, { Config_Value: JSON.stringify({ list: '', map: {} }) }), c.token); CC.queue.delete(id); ccSay('☁ Removed in SharePoint.'); }; if (utIsAdmin()) run().catch(er => ccSay('⚠ ' + er.message, 1)); } } catch (x) {} }, 50); }, true);
/* ---- search over the summary table and the destination groups ---- */
function ccFilter() { const q = ((document.querySelector('#ccSearch') || {}).value || '').toLowerCase().split(/\s+/).filter(Boolean), hit = t => q.every(w => t.includes(w));
  document.querySelectorAll('#utSumBody tr').forEach(r => { r.style.display = !q.length || hit(r.textContent.toLowerCase()) ? '' : 'none'; });
  const host = document.querySelector('#utHost'); if (!host) return; let shown = 0;
  host.querySelectorAll('[data-utg]').forEach(h => { const wrap = h.nextElementSibling; if (!wrap) return; let any = 0; wrap.querySelectorAll('details.fd-set').forEach(d => { const ok = !q.length || hit(((d.querySelector('summary') || d).textContent + ' ' + h.dataset.utg).toLowerCase()); d.style.display = ok ? '' : 'none'; if (ok) { any++; if (q.length) d.open = false; } }); h.style.display = any ? '' : 'none'; if (q.length && any) wrap.style.display = ''; else if (!q.length && h._paint) h._paint(); if (!any) wrap.style.display = 'none'; shown += any; });
  const c = document.querySelector('#ccCount'); if (c) c.textContent = q.length ? shown + ' destination(s) match' : ''; }
function ccMount() { if (document.querySelector('#ccBar')) return; const m = document.querySelector('#utMsg'); if (!m) return; const bar = document.createElement('div'); bar.id = 'ccBar'; bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 10px';
  bar.innerHTML = '<input id="ccSearch" type="search" placeholder="🔍 Search sections, actions, lists…" style="max-width:320px;margin:0"><span id="ccCount" class="text-sm"></span><span style="flex:1"></span><button type="button" class="ghost small" data-cc="pull" title="Read the setup from SharePoint now">☁ Load from SharePoint</button><button type="button" class="secondary small" data-cc="push" title="Write every destination of this browser to SharePoint">☁ Save all to SharePoint</button><span id="ccStatus" class="text-sm"></span>';
  m.parentNode.insertBefore(bar, m); bar.querySelector('#ccSearch').addEventListener('input', ccFilter);
  bar.addEventListener('click', async e => { const b = e.target.closest('[data-cc]'); if (!b) return; if (b.dataset.cc === 'pull') { ccSay('Reading…'); await ccPull(false); } else { if (!utIsAdmin()) return ccSay('Only administrators can save.', 1); ccSay('Saving…'); try { const ids = ccLocalIds().filter(i => utGet(i).list); const n = await ccPush(ids); ccSay('☁ ' + ids.length + ' destination(s) checked, ' + n + ' written to SharePoint.'); } catch (er) { ccSay('⚠ ' + er.message, 1); } } });
  if (CC.msg) ccSay(CC.msg);
  const sb = document.querySelector('#utSumBody'); if (sb) new MutationObserver(() => ccFilter()).observe(sb, { childList: true }); }
const _ccRender = utRender; utRender = function () { const r = _ccRender.apply(this, arguments); ccMount(); ccFilter(); return r; };
document.querySelectorAll('.nav-item[data-view="uploaddest"]').forEach(n => n.addEventListener('click', () => setTimeout(() => { ccMount(); ccPull(true); }, 60)));
const _ccLogin = onLoginComplete; onLoginComplete = function () { const r = _ccLogin.apply(this, arguments); setTimeout(() => ccPull(true), 900); return r; };
setInterval(() => { if (currentUser) ccPull(true); }, 10 * 60 * 1000);
