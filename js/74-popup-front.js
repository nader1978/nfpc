/* ============================================================
   POP-UPS IN FRONT — a pop-up that opens while another one is already on screen is lifted just above it
   (e.g. "Print setup" opened from the trip window). Confirmation / progress windows (opAsk / opBack) and the
   search lists stay above everything; only full-screen overlays (fixed, ≥ 60 % of the window) are handled.
   ============================================================ */
(function () {
  const CAP = 2147480000, SKIP = '#opBack,#opAsk,#sectionToast,#wxGo,#tw,#ssPanel,#cbPanel,#mob,.tt';
  const isOv = el => { if (!(el instanceof HTMLElement) || el.matches(SKIP) || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName)) return false; const cs = getComputedStyle(el); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width >= innerWidth * 0.6 && r.height >= innerHeight * 0.6; };
  const zOf = el => { const v = parseInt(getComputedStyle(el).zIndex, 10); return isFinite(v) ? v : 0; };
  let vis = new Set();
  function scan() { const now = [...document.body.children].filter(isOv), fresh = now.filter(el => !vis.has(el));
    if (fresh.length && now.length > fresh.length) { const others = now.filter(el => !fresh.includes(el)), top = Math.max(0, ...others.map(zOf).filter(v => v < CAP));
      fresh.forEach(el => { if (zOf(el) <= top && top + 1 < CAP) el.style.zIndex = String(top + 1); }); }
    vis = new Set(now); }
  let t = 0; const run = () => { cancelAnimationFrame(t); t = requestAnimationFrame(scan); };
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  window.popupFront = scan;
})();
