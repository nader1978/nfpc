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
        const r = { code, loc: g(/^locationdesc$/), whs: g(/^whsdesc$/), area: g(/^areadesc$/), cap: g(/^defaultcapacity$/), locId: g(/^locationid$/), aisle: g(/^aisle(no|num|number)?$/), bay: g(/^bay(no|num|number)?$/), level: g(/^(level|lvl)(no|num|number)?$/), pos: g(/^(pos|position)(no|num|number)?$/), rtype: g(/^(racktype|type)$/) };
        if (mine && r.locId !== '' && !mine.has(String(r.locId).trim()) && !mine.has(String(+r.locId))) return;
        if (!map.has(code.toUpperCase())) { map.set(code.toUpperCase(), r); rows.push(r); } });
      rows.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })); SRK.rows = rows; SRK.map = map; SRK.ok = rows.length > 0; if (!rows.length) SRK.err = 'no active racks found in ' + SRK_LIST; }
    catch (e) { SRK.ok = false; SRK.err = e.message; } finally { SRK.loading = false; }
    return SRK; })();
  return SRK.p;
}
const srkFind = code => SRK.map.get(String(code || '').trim().toUpperCase()) || null;
function srkDatalist(id) { return '<datalist id="' + id + '">' + SRK.rows.map(r => '<option value="' + escapeHtml(r.code) + '" label="' + escapeHtml([r.loc, r.area, r.cap ? 'cap ' + r.cap : ''].filter(Boolean).join(' · ')) + '">' + escapeHtml([r.loc, r.area].filter(Boolean).join(' · ')) + '</option>').join('') + '</datalist>'; }
const srkDesc = code => { const r = srkFind(code); return r ? [r.loc, r.area, r.whs].filter(Boolean).join(' · ') : ''; };
function srkNote() { const ids = (typeof locIds === 'function' && currentUser) ? locIds(currentUser) : []; return SRK.ok ? '📍 ' + SRK.rows.length + ' racks of ' + (ids.length ? 'Location ID ' + ids.join(', ') : 'all locations') + ' — from ' + SRK_LIST : '⚠ rack list not available (' + (SRK.err || 'not loaded') + ') — location codes are not checked'; }
