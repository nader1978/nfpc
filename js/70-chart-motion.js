/* ============================================================
   CHART MOTION — every chart of the ORBIT chart engine animates slowly when it is drawn
   columns grow up · bars grow right · lines draw left → right with their points following · areas and donuts fade / sweep in
   data labels appear when the bars arrive · KPI tiles count up. A redraw with the same data (resize) does not replay.
   Switch: "✨ Motion" next to 👁 Visuals (saved per computer). Respects the system "reduce motion" setting.
   ============================================================ */
(function () {
  const KEY = LS_BASE + '_motion', DUR = 1700, EASE = 'cubic-bezier(.22,1,.36,1)';
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const on = () => { let v = ''; try { v = localStorage.getItem(KEY) || ''; } catch (e) {} return v !== 'off' && !reduce(); };
  const last = new WeakMap();
  const isFill = el => { const f = (el.getAttribute('fill') || '').trim().toLowerCase(), s = (el.getAttribute('stroke') || '').trim().toLowerCase(); return f && f !== 'none' && f !== 'transparent' && !/^url/.test(f) && (!s || s === 'none'); };
  const isLine = el => { const f = (el.getAttribute('fill') || '').trim().toLowerCase(), s = (el.getAttribute('stroke') || '').trim().toLowerCase(); return (f === 'none' || f === 'transparent' || !f) && s && s !== 'none' && s !== 'transparent'; };
  const go = (el, kf, o) => { try { el.animate(kf, Object.assign({ duration: DUR, easing: EASE, fill: 'backwards' }, o)); } catch (e) {} };

  function anim(host, kind) {
    if (!host || !on()) return; const svg = host.tagName === 'svg' ? host : host.querySelector('svg'); if (!svg || !svg.isConnected) return;
    const sg = kind + '|' + svg.querySelectorAll('*').length + '|' + svg.textContent; if (last.get(host) === sg) return; last.set(host, sg);
    const W = +(svg.getAttribute('width') || svg.viewBox.baseVal.width || 600);
    if (kind === 'donut') { svg.querySelectorAll('path').forEach((p, i) => { p.style.transformBox = 'view-box'; p.style.transformOrigin = '50% 50%'; go(p, [{ transform: 'rotate(-100deg) scale(.82)', opacity: 0 }, { transform: 'none', opacity: 1 }], { delay: i * 90 }); }); fadeLabels(svg, 700); return; }
    if (kind === 'heat') { const R = [...svg.querySelectorAll('rect')].filter(isFill); R.forEach((r, i) => go(r, [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: Math.min(1100, i * 6) })); return; }
    /* bars / columns */
    const bars = [...svg.querySelectorAll('path,rect')].filter(el => isFill(el) && !el.closest('defs')).filter(el => { if (el.tagName === 'rect') { const w = +el.getAttribute('width'), h = +el.getAttribute('height'); if (w >= W - 2 || !(w > 0 && h > 0)) return false; } return true; });
    let dir = kind === 'barsH' ? 'h' : kind === 'cols' ? 'v' : '';
    if (!dir && bars.length && kind !== 'line' && kind !== 'scatter') { let v = 0, h = 0; bars.slice(0, 30).forEach(b => { try { const bb = b.getBBox(); if (bb.height > bb.width) v++; else h++; } catch (e) {} }); dir = v >= h ? 'v' : 'h'; }
    if (kind === 'line') bars.forEach(a => go(a, [{ opacity: 0 }, { opacity: 1 }], { duration: DUR * 1.2, delay: 300 }));   /* areas under lines */
    else if (kind === 'div') bars.forEach((b, i) => go(b, [{ opacity: 0 }, { opacity: 1 }], { delay: Math.min(700, i * 30), duration: 900 }));
    else if (dir) { const n = bars.length, step = n > 1 ? Math.min(40, 700 / n) : 0;
      bars.forEach((b, i) => { b.style.transformBox = 'fill-box'; b.style.transformOrigin = dir === 'v' ? '50% 100%' : '0% 50%'; go(b, [{ transform: dir === 'v' ? 'scaleY(0)' : 'scaleX(0)' }, { transform: 'none' }], { delay: i * step }); }); }
    /* lines draw left → right, points follow */
    svg.querySelectorAll('path,polyline,line').forEach(l => { if (!isLine(l) || l.tagName === 'line') return; let len = 0; try { len = l.getTotalLength(); } catch (e) {} if (!(len > 20)) return;
      l.style.strokeDasharray = len + ' ' + len; go(l, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: DUR * 1.5, easing: 'cubic-bezier(.45,.05,.25,1)' }); setTimeout(() => { l.style.strokeDasharray = ''; }, DUR * 1.5 + 60); });
    svg.querySelectorAll('circle').forEach(c => { const cx = +c.getAttribute('cx') || 0; c.style.transformBox = 'fill-box'; c.style.transformOrigin = '50% 50%'; go(c, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: kind === 'scatter' ? Math.random() * 600 : Math.max(0, cx / W) * DUR * 1.4 }); });
    fadeLabels(svg, dir ? DUR * 0.55 : DUR * 0.9);
  }
  function fadeLabels(svg, delay) { svg.querySelectorAll('text').forEach(t => { const w = t.getAttribute('font-weight'); if (w === '600' || w === '700' || w === 'bold') go(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay }); }); }

  /* hook the chart engine */
  let inPlc = 0;
  [['plcCols', 'cols'], ['plcBarsH', 'barsH'], ['plcLine', 'line'], ['plcDonut', 'donut'], ['plcScatter', 'scatter'], ['plcHeat', 'heat'], ['plcDiv', 'div']].forEach(([fn, kind]) => {
    const f0 = window[fn]; if (typeof f0 !== 'function') return;
    const w = function (host) { inPlc++; let r; try { r = f0.apply(this, arguments); } finally { inPlc--; } try { anim(host, kind); } catch (e) {} return r; };
    window[fn] = w; });
  if (typeof plSvg === 'function') { const s0 = plSvg; window.plSvg = function (host) { const r = s0.apply(this, arguments); if (!inPlc && host) Promise.resolve().then(() => { try { anim(host, 'auto'); } catch (e) {} }); return r; }; }

  /* home dashboard (CSS charts): donut + rings sweep round, columns grow up */
  try { CSS.registerProperty({ name: '--hm-sw', syntax: '<percentage>', inherits: false, initialValue: '100%' }); } catch (e) {}
  const hcss = document.createElement('style'); hcss.textContent = '@keyframes hmSweep{from{--hm-sw:0%}to{--hm-sw:100%}}'; document.head.appendChild(hcss);
  function homeAnim(root) {
    if (!on() || !root) return;
    root.querySelectorAll('.hm-donut,.hm-ring').forEach((el, i) => { const bg = el.style.background || el.style.backgroundImage; if (!bg || el._sw) return; el._sw = 1;
      el.style.background = 'conic-gradient(transparent 0 var(--hm-sw), var(--hm-l, #e3e9f4) 0), ' + bg; el.style.animation = `hmSweep ${el.classList.contains('hm-donut') ? 1.9 : 1.5}s cubic-bezier(.22,1,.36,1) ${Math.min(900, i * 60)}ms both`; });
    const cols = [...root.querySelectorAll('.hm-col span, .hm-bars i')]; cols.forEach((b, i) => { b.style.transformOrigin = '50% 100%'; go(b, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { delay: Math.min(900, (i % 7) * 70 + Math.floor(i / 7) * 40) }); });
    root.querySelectorAll('.hm-donut b, .hm-ring > span').forEach(countUp);
  }
  const hv = document.getElementById('view-home'); if (hv) new MutationObserver(ms => { if (ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && n.classList && n.classList.contains('hm-zoom')))) setTimeout(() => homeAnim(hv), 0); }).observe(hv, { childList: true });

  /* KPI tiles count up */
  const KSEL = '.pl-kpi .val,.otr-k b,.ew-k b,.rp-k b';
  const kLast = new Map();
  function countUp(el) {
    if (!on() || el._cu) return; const node = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.nodeValue)); if (!node) return;
    const txt = node.nodeValue; if (/\d{4}-\d\d|\d:\d\d|\d\/\d/.test(txt)) return; const m = txt.match(/^([^\d−\-+]*)([−\-+]?)([\d,]*\.?\d+)(.*)$/s); if (!m) return;
    const key = (el.closest('.pl-kpi,.otr-k,.ew-k,.rp-k') || el).textContent.replace(/[\d.,]+/g, '#').slice(0, 60) + '|' + txt; if (kLast.get(key) && Date.now() - kLast.get(key) < 4000) return; kLast.set(key, Date.now());
    const target = +m[3].replace(/,/g, ''), dec = (m[3].split('.')[1] || '').length, comma = m[3].includes(','); if (!isFinite(target) || target === 0) return;
    el._cu = 1; const t0 = performance.now(), D = DUR * 0.9, fmt = v => { let s = v.toFixed(dec); if (comma || target >= 10000) { const [a, b] = s.split('.'); s = a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : ''); } return m[1] + m[2] + s + m[4]; };
    const tick = now => { if (!node.isConnected || node.nodeValue !== (node._lastSet || txt)) { el._cu = 0; return; } const f = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - f, 3); node._lastSet = f >= 1 ? txt : fmt(target * e); node.nodeValue = node._lastSet; if (f < 1) requestAnimationFrame(tick); else el._cu = 0; };
    node._lastSet = fmt(0); node.nodeValue = node._lastSet; requestAnimationFrame(tick);
  }
  let kt = 0; new MutationObserver(ms => { if (!on()) return; const add = []; ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.matches && n.matches(KSEL)) add.push(n); if (n.querySelectorAll) n.querySelectorAll(KSEL).forEach(x => add.push(x)); })); if (add.length) { clearTimeout(kt); kt = setTimeout(() => add.forEach(countUp), 20); } }).observe(document.body, { childList: true, subtree: true });

  /* the ✨ Motion switch next to 👁 Visuals */
  function btns() { document.querySelectorAll('.vis-bar').forEach(bar => { let b = bar.querySelector('.mo-btn'); if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'ghost small mo-btn'; b.title = 'Animate the charts when they are drawn (saved on this computer)'; b.addEventListener('click', () => { try { localStorage.setItem(KEY, on() ? 'off' : 'on'); } catch (e) {} btns(); try { sectionToast(on() ? '✨ Chart motion on' : 'Chart motion off', 'success'); } catch (e) {} }); const ly = bar.querySelector('.ly-btn'); ly ? ly.after(b) : bar.appendChild(b); }
    const t = on() ? '✨ Motion: on' : '✨ Motion: off'; if (b.textContent !== t) b.textContent = t; b.classList.toggle('on', on()); }); }
  setInterval(btns, 1500); setTimeout(btns, 800);
  window.orbMotion = { anim, on, count: countUp, home: homeAnim };
})();
