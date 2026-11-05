/* ---------- Side panel layout published for ALL users (SharePoint App_Config_tbl, item SidePanelLayout) ---------- */
const NAV_ITEM = 'SidePanelLayout';
async function navCentralSave(lay, force) {
  const cfg = Object.assign({}, lay, { v: 1, force: !!force, by: getCurrentUserValue(), at: new Date().toISOString() }); navW(NAV_CEN_KEY, cfg);
  const c = await tpCtx(); if (!c) throw new Error('sign in / Site URL is not ready'); const its = await fetchAllItems(c.siteId, c.listId, c.token), ex = its.find(x => String((x.fields || {}).Title || '').trim() === NAV_ITEM), val = JSON.stringify(cfg);
  if (ex) await updateItem(c.siteId, c.listId, ex.id, spCoerceFields(c.listId, { Config_Value: val }), c.token); else await createItem(c.siteId, c.listId, { Title: NAV_ITEM, Config_Value: val }, c.token);
}
async function navPull(silent) {
  try { const c = await tpCtx(); if (!c) return false; const it = (await fetchAllItems(c.siteId, c.listId, c.token)).find(x => String((x.fields || {}).Title || '').trim() === NAV_ITEM);
    if (!it) { if (!silent) sectionToast('No “' + NAV_ITEM + '” row in ' + TP_LIST + ' yet.', 'warn'); return false; }
    const j = JSON.parse(String((it.fields || {}).Config_Value || '')); if (!j || !Array.isArray(j.groups)) return false;
    const old = JSON.stringify(navCentral() || ''); navW(NAV_CEN_KEY, j); if (JSON.stringify(j) !== old) navApply(true); if (!silent) sectionToast('✔ Side-panel layout loaded from SharePoint.', 'success'); return true; }
  catch (e) { if (!silent) sectionToast('Could not read ' + TP_LIST + ': ' + e.message, 'warn'); return false; }
}
(function () { const prev = onLoginComplete; onLoginComplete = function () { const r = prev.apply(this, arguments); setTimeout(() => { navPull(true); }, 600); return r; }; setInterval(() => { if (currentUser) navPull(true); }, 10 * 60 * 1000); })();
