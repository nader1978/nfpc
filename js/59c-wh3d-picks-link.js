/* ---------- Batch Allocation (FEFO) → show the allocated batches in the 3D warehouse view ---------- */
(function () {
  document.addEventListener('click', e => { const b = e.target.closest('#wFefoPk3dBtn'); if (!b) return; const R = (typeof wFefoState !== 'undefined' && wFefoState.results) || [];
    const items = []; let n = 0; R.forEach(r => { if (r && r.qtyAllocated > 0 && r.locationCode) items.push({ n: ++n, loc: r.locationCode, pos: 0, sku: r.sku, batch: r.batchCode, take: r.qtyAllocated }); });
    if (!items.length) return sectionToast('No allocated batch with a location yet — run the batch lookup first.', 'warn');
    W3Pick.set(items, 'Batch Allocation (FEFO)'); const nav = document.querySelector('.nav-item[data-view="wh3d"]'); if (nav) nav.click(); setTimeout(() => { try { w3Api.zoomPicks(); } catch (x) {} }, 700); });
})();
