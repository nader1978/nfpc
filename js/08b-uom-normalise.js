/* ============================================================
   UoM NORMALISATION — every ledger quantity is converted to the BASE unit (PC) with the UOM list (UOM_tbl: UOM_Desc × UOM_Base_Nr)
   so that balances never add cartons / outers / pallets to pieces. 2,912 OT with OT = 12 → 34,944 PC.
   Order of the factor: UOM list (per SKU + UoM) → the row's own UOM_Base (> 1) → unknown (kept as entered and reported).
   Switch: localStorage <LS_BASE>_uomconv ("0" = off). Used when the ledger is read (WHs Movements, Stock Movement Entry) — so the balances, FEFO,
   3D view, position list and movement reports all show the same quantity.
   ============================================================ */
(function () {
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; };
  const KEY = () => (typeof LS_BASE !== 'undefined' ? LS_BASE : 'orbit') + '_uomconv';
  const U = window.UOMC = {
    last: null,
    on() { try { return localStorage.getItem(KEY()) !== '0'; } catch (e) { return true; } },
    set(v) { try { localStorage.setItem(KEY(), v ? '1' : '0'); } catch (e) {} },
    ready() { try { return wUomState.table.size > 0; } catch (e) { return false; } },
    async ensure() { if (!U.on() || U.ready()) return; try { if (!wUomState.listName || typeof wUom_loadFromList !== 'function') return; await Promise.race([wUom_loadFromList().catch(() => {}), new Promise(r => setTimeout(r, 25000))]); } catch (e) {} },
    factor(sku, uom, rowBase) { const c = wUomCanon(uom); if (!c || c === 'pc') return 1; let f = null; try { f = wUom_factor(sku, uom); } catch (e) {} if (f > 0) return f; const b = num(rowBase); return b > 1 ? b : null; },
    /* converts the rows in place; returns the summary also kept in UOMC.last */
    norm(rows) { const st = U.last = { on: U.on(), n: rows.length, conv: 0, unk: new Map(), mixed: new Set(), skipped: '' };
      if (!st.on) { st.skipped = 'conversion is off'; return st; } if (!U.ready()) { st.skipped = 'the UOM list is not loaded'; return st; }
      const seen = new Map();
      rows.forEach(r => { const sku = String(r.SKU_Code || '').trim(); if (!sku) return; const uom = String(r.UOM_Desc == null ? '' : r.UOM_Desc).trim(), c = wUomCanon(uom) || 'pc'; let s = seen.get(sku); if (!s) seen.set(sku, s = new Set()); s.add(c);
        if (c === 'pc') return; const f = U.factor(sku, uom, r.UOM_Base); if (f == null) { const k = sku + ' · ' + uom; st.unk.set(k, (st.unk.get(k) || 0) + 1); return; } if (f === 1) return;
        r._raw = { rcvd: num(r.Qty_Rcvd), rlsd: num(r.Qty_Rlsd), uom, f }; r.Qty_Rcvd = num(r.Qty_Rcvd) * f; r.Qty_Rlsd = num(r.Qty_Rlsd) * f; r.UOM_Desc = 'PC'; r.UOM_Base = '1'; r._f = f; st.conv++; });
      seen.forEach((s, k) => { if (s.size > 1) st.mixed.add(k); }); return st; },
    note() { const s = U.last; if (!s) return ''; if (s.skipped) return 'UoM: ' + s.skipped + ' — quantities as entered'; return 'UoM → PC: ' + s.conv.toLocaleString() + ' row(s) converted' + (s.mixed.size ? ' · ' + s.mixed.size + ' SKU(s) had mixed units' : '') + (s.unk.size ? ' · ⚠ ' + [...s.unk.values()].reduce((a, b) => a + b, 0) + ' row(s) without a factor (' + [...s.unk.keys()].slice(0, 3).join(', ') + (s.unk.size > 3 ? '…' : '') + ')' : ''); }
  };
})();
