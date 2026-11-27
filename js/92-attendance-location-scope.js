/* ============================================================
   ATTENDANCE × LOCATION — a signed-in (non-admin) user sees the attendance, overtime and staff of HIS OWN Location ID only.
   A record belongs to a location by (1) the Location_ID column of the Employees list, when it has one, else
   (2) the employee's warehouse (WHs_Link) / the record's work location matching the warehouse NAME of the user's Location ID
       (name from his LoginUserList row or the "Warehouse names" table in Title profiles).
   Admins see everything. The full data stays untouched in SharePoint — only what is shown in this browser is limited.
   ============================================================ */
(function () {
  if (typeof at === 'undefined' || typeof locScoped !== 'function') return;
  const nk = v => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, '');
  let full = null, mine = null, mineLen = -1, lastInfo = null;
  function names() {
    const s = new Set(); try { String(locWhName(currentUser) || '').split(/\s*[\/;,]\s*/).forEach(x => { if (nk(x)) s.add(nk(x)); }); const m = locNameMap(); locIds(currentUser).forEach(i => { const v = m[i] || m[String(+i)]; if (v && nk(v)) s.add(nk(v)); }); } catch (e) { } return s;
  }
  function makeTest() {
    const ids = new Set(locIds(currentUser)), N = names(); let byCol = false; try { a2E.rows.forEach(e => { if (e && e.locid !== '' && e.locid != null) byCol = true; }); } catch (e) { }
    return { byCol, ids, N, ok(r) {
      if (!ids.size) return false;
      let e = null; try { e = a2E.rows.get(a2AKey(r)); } catch (x) { }
      if (byCol) return !!(e && e.locid !== '' && e.locid != null && ids.has(locNorm(e.locid)));
      if (!N.size) return false;
      const c = []; try { if (e && e.wh) c.push(a2EWh(e.wh)); } catch (x) { } try { c.push(a2MngtWh(r)); } catch (x) { } c.push(r.loc, r.payLoc); try { c.push(a2StoreRaw(r)); } catch (x) { }
      return c.some(v => v && N.has(nk(v)));
    } };
  }
  function apply() {
    if (!locScoped()) { if (full && at.rows === mine) at.rows = full; full = mine = null; banner(null); return; }
    if (!Array.isArray(at.rows)) return;
    if (at.rows !== mine || at.rows.length !== mineLen) full = at.rows;   /* rows were (re)loaded by something else → this is the new full set */
    const T = makeTest(), out = full.filter(r => T.ok(r)); if (!(mine && out.length === mine.length && out.every((r, i) => r === mine[i]))) { mine = out; try { a2Bump(); } catch (e) { } };
    at.rows = mine; mineLen = mine.length; lastInfo = { n: mine.length, all: full.length, T }; banner(lastInfo);
  }
  function banner(i) {
    const v = document.querySelector('#view-att'); if (!v) return; let b = document.querySelector('#atLocBanner');
    if (!i) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'atLocBanner'; b.style.cssText = 'margin:0 0 10px;padding:9px 14px;border-radius:12px;font-size:13px;font-weight:600;background:var(--acc-soft,#eaf0fb);border:1px solid var(--acc-line,#c9d7f0);color:var(--text,#16223b)'; v.insertBefore(b, v.firstChild); }
    const ids = [...i.T.ids]; let msg = '📍 ' + (locWhName(currentUser) ? locWhName(currentUser) + ' · ' : '') + 'Location ' + (ids.join(', ') || '—') + ' — you see the attendance and overtime of your location\'s staff only';
    if (i.all) msg += ' (' + i.n.toLocaleString() + ' of ' + i.all.toLocaleString() + ' records)';
    if (!ids.length) msg += ' — no Location ID on your user, ask the admin.'; else if (!i.T.byCol && !i.T.N.size) msg += ' — your warehouse name is not known; ask the admin to set the warehouse name for your Location ID.'; else if (i.all && !i.n) msg += ' — no record matched your location yet (load the Employees list in Settings → Employees link).';
    b.textContent = msg;
  }
  try {
    const defs = [['atRefresh', 0], ['atLoad', 1], ['atListLoad', 1], ['atSpLoad', 1], ['a2ELoad', 1]];
    defs.forEach(([n, post]) => { const f = eval('typeof ' + n + " === 'function' ? " + n + ' : null'); if (!f) return; const w = function () { if (!post) { try { apply(); } catch (e) { } } const r = f.apply(this, arguments); const fin = () => { try { apply(); if (n === 'a2ELoad' && document.querySelector('#view-att.active')) atRefresh(true); } catch (e) { } }; if (post) { if (r && typeof r.then === 'function') return r.then(x => { fin(); return x; }); fin(); } return r; }; eval(n + ' = w'); });
    if (typeof atSpSave === 'function') { const f = atSpSave; eval('atSpSave = async function () { if (locScoped() && full) throw new Error("Your view is limited to your location — the shared attendance file is saved by an admin only."); return f.apply(this, arguments); }'); }
  } catch (e) { console.error('attendance location scope', e); }
  document.querySelectorAll('.nav-item[data-view="att"],.nav-item[data-view="otr"],.nav-item[data-view="mgt"]').forEach(n => n.addEventListener('click', () => setTimeout(() => { try { apply(); } catch (e) { } }, 60)));
  window.atLocApply = apply;
})();
