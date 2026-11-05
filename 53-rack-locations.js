/* ---------- Store racks / pallet locations: Store_Racks_Setup_tbl → pick-list for inbound entries ---------- */
const SRK_LIST = 'Store_Racks_Setup_tbl';
const SRK = { rows: [], map: new Map(), ok: false, loading: false, err: '', p: null };
const srkNorm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function srkKey(f, re) { return Object.keys(f || {}).find(k => re.test(srkNorm(k))); }
async function srkLoad(force) {
  if (SRK.p && !force) return SRK.p;
  SRK.p = (async () => { SRK.loading = true; SRK.err = '';
    try { const token = getGlobalAccessToken(), site = getGlobalSiteUrl(); if (!token || !site) throw new Error('sign-in / Site URL is not ready');
      const ids = await resolveIds(site, SRK_LIST, token), items = await fetchAllItems(ids.siteId, ids.listId, token), rows = [], map = new Map();
      const mine = (typeof locScoped === 'function' && locScoped()) ? new Set(locIds(currentUser).map(String)) : null;   /* only the racks of the user's Location ID */
      items.forEach(it => { const f = it.fields || {}, kc = srkKey(f, /^rackcode$/); if (!kc) return; const code = String(f[kc] == null ? '' : f[kc]).trim(); if (!code) return;
        const ka = srkKey(f, /^activestat/), act = ka === undefined ? true : !(f[ka] === false || /^(no|false|0|inactive)$/i.test(String(f[ka]))); if (!act) return;
        const g = re => { const k = srkKey(f, re); return k === undefined || f[k] == null ? '' : String(f[k]).trim(); };
        const r = { code, loc: g(/^locationdesc$/), whs: g(/^whsdesc$/), area: g(/^areadesc$/), cap: g(/^defaultcapacity$/), locId: g(/^locationid$/), aisle: g(/^aisle(no|num|number)?$/), bay: g(/^bay(no|num|number)?$/), level: g(/^(level|lvl)(no|num|number)?$/), pos: g(/^(pos|position)(no|num|number)?$/), rtype: g(/^(racktype|type)$/), r3d: g(/^rack3d/), dmg: g(/^nrofdam/) };
        if (!map.has(code.toUpperCase())) { map.set(code.toUpperCase(), r); rows.push(r); } });
      SRK.hidden = 0; SRK.other = null; SRK.otherStores = null; SRK.mineStores = null;
      if (mine) {   /* a rack belongs to the user's Location ID by its own Location_ID, else by the Location_ID of its store (Location_Desc) — racks that cannot be placed are hidden */
        const sv = new Map(); rows.forEach(r => { const id = String(r.locId).trim().replace(/\.0+$/, ''); if (id !== '' && r.loc) { const m = sv.get(r.loc.toUpperCase()) || new Map(); m.set(id, (m.get(id) || 0) + 1); sv.set(r.loc.toUpperCase(), m); } });
        const storeId = z => { const m = sv.get(String(z || '').toUpperCase()); if (!m) return ''; return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]; };
        const keep = rows.filter(r => { const own = String(r.locId).trim().replace(/\.0+$/, ''), id = own !== '' ? own : storeId(r.loc); if (id !== '' && own === '') r.locId = id; return id !== '' && (mine.has(id) || mine.has(String(+id))); });
        SRK.hidden = rows.length - keep.length; SRK.other = new Set(rows.filter(r => !keep.includes(r)).map(r => r.code.toUpperCase())); SRK.otherStores = new Set(rows.filter(r => !keep.includes(r)).map(r => String(r.loc || '').toUpperCase())); SRK.mineStores = new Set(keep.map(r => String(r.loc || '').toUpperCase())); rows.length = 0; map.clear(); keep.forEach(r => { rows.push(r); map.set(r.code.toUpperCase(), r); }); }
      rows.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })); SRK.rows = rows; SRK.map = map; SRK.ok = rows.length > 0; if (!rows.length) SRK.err = 'no active racks found in ' + SRK_LIST; }
    catch (e) { SRK.ok = false; SRK.err = e.message; } finally { SRK.loading = false; }
    return SRK; })();
  return SRK.p;
}
const srkFind = code => SRK.map.get(String(code || '').trim().toUpperCase()) || null;
function srkDatalist(id) { return '<datalist id="' + id + '">' + SRK.rows.map(r => '<option value="' + escapeHtml(r.code) + '" label="' + escapeHtml([r.loc, r.area, r.cap ? 'cap ' + r.cap : ''].filter(Boolean).join(' · ')) + '">' + escapeHtml([r.loc, r.area].filter(Boolean).join(' · ')) + '</option>').join('') + '</datalist>'; }
const srkDesc = code => { const r = srkFind(code); return r ? [r.loc, r.area, r.whs].filter(Boolean).join(' · ') : ''; };
function srkNote() { const ids = (typeof locIds === 'function' && currentUser) ? locIds(currentUser) : []; return SRK.ok ? '📍 ' + SRK.rows.length + ' racks of ' + (ids.length ? 'Location ID ' + ids.join(', ') : 'all locations') + ' — from ' + SRK_LIST + (SRK.hidden ? ' (' + SRK.hidden + ' racks of other locations / without Location ID are hidden)' : '') : '⚠ rack list not available (' + (SRK.err || 'not loaded') + ') — location codes are not checked'; }
