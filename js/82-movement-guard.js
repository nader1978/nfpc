/* ============================================================
   📍 MOVEMENT GUARD — no stock movement is saved without its full location
   Applies to EVERY section that saves through ORBIT (desktop + mobile web): WHs Movements, Stock Movement Entry,
   FOC release, Pick transit, Pallet relocation, mobile put-away / move, RMPM …  — checked at the single save point
   (createItem / updateItem), so a new screen is covered automatically.
   Rules, by the columns the list has:
     · FEFO movements (Location_Code + Storage_Location + PLT_Position, e.g. SKUs_Movements_Batch_tbl):
         rack code (Location_Code), location (Storage_Location) and pallet position (PLT_Position) are required
         (PLT_Position is not required for Move_Mode = Bulk). PLT_Rack_Nr / Storage_Location are filled from the rack
         setup when only the rack code is given, and the rack code is found from Storage_Location + PLT_Rack_Nr.
     · Pick transit (Location_Code + Rack_Code + PLT_Position): all three required.
     · RMPM movements (Item_Code + Location with Qty_In / Qty_Out): the location / bin is required.
   A row that is still missing something is refused with a clear message — nothing is written.
   ============================================================ */
(function () {
  'use strict';
  const COLQ = new Map();
  const blank = v => v == null || String(v).trim() === '' || (typeof v === 'number' && !isFinite(v));
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  async function cols(siteId, listId, token) { let T = (window.SP_COLT || {})[listId]; if (!T && typeof fetchColumns === 'function') { if (!COLQ.has(listId)) COLQ.set(listId, fetchColumns(siteId, listId, token).catch(() => null)); await COLQ.get(listId); T = (window.SP_COLT || {})[listId]; } return T || null; }
  async function racks() { try { if (typeof SRK !== 'undefined' && !SRK.ok && !SRK.loading && typeof srkLoad === 'function') await Promise.race([srkLoad(), new Promise(r => setTimeout(r, 12000))]); } catch (e) {} }
  const find = c => { try { return typeof srkFind === 'function' ? srkFind(c) : null; } catch (e) { return null; } };
  const label = f => [f.SKU_Code || f.Item_Code || f.RM_Code || '', f.Batch_Code || f.Lot_No || ''].filter(Boolean).join(' / ');
  function fail(f, miss, where) { const e = new Error('📍 Not saved — ' + (label(f) ? label(f) + ': ' : '') + 'missing ' + miss.join(', ') + '. Every stock movement needs ' + where + '.'); e.movGuard = true; throw e; }
  async function check(siteId, listId, fields, token, isUpdate) {
    if (!fields || typeof fields !== 'object') return fields;
    const T = await cols(siteId, listId, token); if (!T) return fields;
    const out = Object.assign({}, fields), qty = ['Qty_Rcvd', 'Qty_Rlsd', 'Qty', 'Quantity', 'Qty_In', 'Qty_Out', 'Qty_Moved'].some(k => has(out, k));
    /* ---- FEFO movements ---- */
    if (T.PLT_Position && T.Storage_Location && (T.Location_Code || T.PLT_Rack_Nr)) { const LC = !!T.Location_Code;   /* lists without a Location_Code column identify the rack by Storage_Location + PLT_Rack_Nr */
      if (!isUpdate && !qty) return fields;
      if (isUpdate && !['Location_Code', 'Storage_Location', 'PLT_Rack_Nr', 'PLT_Position'].some(k => has(out, k))) return fields;   /* an update that does not touch the location */
      await racks();
      if (blank(out.Location_Code)) { const s = String(out.Storage_Location || '').trim(), n = String(out.PLT_Rack_Nr || '').trim();
        if (s && find(s)) out.Location_Code = find(s).code;   /* mobile rows: the rack code is in Storage_Location */
        else if (s && n && window.WMVX && WMVX.resolveLoc) { try { const q = WMVX.resolveLoc(out); if (q && q.lc && find(q.lc)) out.Location_Code = q.lc; } catch (e) {} } }
      const rk = !blank(out.Location_Code) ? find(out.Location_Code) : null;
      const slRack = !blank(out.Storage_Location) && !!find(out.Storage_Location);   /* mobile rows keep the rack code in Storage_Location — leave them as they are */
      if (rk && !slRack) { if (blank(out.Storage_Location)) out.Storage_Location = rk.loc || ''; if (T.PLT_Rack_Nr && blank(out.PLT_Rack_Nr) && rk.r3d) out.PLT_Rack_Nr = rk.r3d; }
      if (!LC) { const code = !blank(out.Location_Code) ? out.Location_Code : ''; delete out.Location_Code;   /* the column does not exist in this list */
        if (isUpdate && !['Storage_Location', 'PLT_Rack_Nr', 'PLT_Position'].some(k => has(out, k))) return out; const m = [];
        if ((!isUpdate || has(out, 'Storage_Location')) && blank(out.Storage_Location)) m.push('location (Storage_Location)');
        if ((!isUpdate || has(out, 'PLT_Rack_Nr')) && blank(out.PLT_Rack_Nr) && !(code && find(code)) && !slRack) m.push('rack no. (PLT_Rack_Nr)');
        if ((!isUpdate || has(out, 'PLT_Position')) && !/bulk/i.test(out.Move_Mode || '') && !(Number(String(out.PLT_Position == null ? '' : out.PLT_Position).replace(/\D/g, '')) > 0)) m.push('pallet position (PLT_Position)');
        if (m.length) fail(out, m, 'a location, a rack no. and a pallet position'); return out; }
      if (isUpdate) { const m = []; if (has(out, 'Location_Code') && blank(out.Location_Code)) m.push('rack code'); if (has(out, 'Storage_Location') && blank(out.Storage_Location)) m.push('location'); if (has(out, 'PLT_Position') && blank(out.PLT_Position) && !/bulk/i.test(out.Move_Mode || '')) m.push('pallet position'); if (m.length) fail(out, m, 'its rack code, location and pallet position'); return out; }
      const m = []; if (blank(out.Location_Code)) m.push('rack code (Location_Code)'); if (blank(out.Storage_Location)) m.push('location (Storage_Location)');
      if (!/bulk/i.test(out.Move_Mode || '') && !(Number(String(out.PLT_Position).replace(/\D/g, '')) > 0)) m.push('pallet position (PLT_Position)');
      if (!blank(out.Location_Code) && typeof SRK !== 'undefined' && SRK.ok && !rk) m.push('a rack code that exists in the rack setup (“' + out.Location_Code + '” not found)');
      if (m.length) fail(out, m, 'a rack code, a location and a pallet position');
      return out; }
    /* ---- pick transit ---- */
    if (T.Location_Code && T.Rack_Code && T.PLT_Position) {
      if (isUpdate || !qty) return fields;
      if (blank(out.Rack_Code) && !blank(out.Location_Code)) out.Rack_Code = out.Location_Code; if (blank(out.Location_Code) && !blank(out.Rack_Code)) out.Location_Code = out.Rack_Code;
      const m = []; if (blank(out.Location_Code)) m.push('location code'); if (blank(out.Rack_Code)) m.push('rack code'); if (blank(out.PLT_Position) && !/bulk/i.test(out.Move_Mode || '')) m.push('pallet position');
      if (m.length) fail(out, m, 'a location code, a rack code and a pallet position'); return out; }
    /* ---- RMPM movements (Item_Code + Location, Qty_In / Qty_Out) ---- */
    if (T.Location && T.Item_Code && (has(out, 'Qty_In') || has(out, 'Qty_Out')) && !isUpdate) {
      const m = []; if (blank(out.Location)) m.push('location / bin (Location)'); if (T.Pallet_Pos && has(out, 'Pallet_Pos') && blank(out.Pallet_Pos)) m.push('pallet position');
      if (m.length) fail(out, m, 'its location'); return out; }
    return fields;
  }
  window.MOVGUARD = { check };
})();
