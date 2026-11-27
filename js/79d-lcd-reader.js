/* ORBIT MOBILE — LCD reader: reads the seven-segment digits of a thermo-hygrometer photo (temperature °C and humidity %).
   Runs fully on the phone (no download): threshold → digit blobs → segment test (italic-aware) → rows → decimal point → temperature / humidity.
   window.lcdRead(imageOrCanvas) → { temps:[{v,txt,conf}], hums:[{v,conf}], rows:[...] } */
(function () {
  'use strict';
  const SEG = { '1111110': 0, '0110000': 1, '1101101': 2, '1111001': 3, '0110011': 4, '1011011': 5, '1011111': 6, '1110000': 7, '1110010': 7, '1111111': 8, '1111011': 9, '1110011': 9, '0011111': 6 };   /* a b c d e f g */
  const KEYS = Object.keys(SEG);
  function toGray(src, maxW) { const sw = src.naturalWidth || src.videoWidth || src.width, sh = src.naturalHeight || src.videoHeight || src.height, s = Math.min(1, maxW / sw), W = Math.round(sw * s), H = Math.round(sh * s), c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data, a = new Float32Array(W * H); for (let i = 0, j = 0; j < a.length; i += 4, j++) a[j] = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; return { a, W, H }; }
  function threshold(G, win, C) { const { a, W, H } = G, I = new Float64Array((W + 1) * (H + 1)); for (let y = 0; y < H; y++) { let r = 0; for (let x = 0; x < W; x++) { r += a[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + r; } }
    const m = new Uint8Array(W * H), R = Math.max(4, win >> 1); for (let y = 0; y < H; y++) { const y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1); for (let x = 0; x < W; x++) { const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1), n = (y1 - y0) * (x1 - x0), s = I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]; m[y * W + x] = a[y * W + x] < s / n - C ? 1 : 0; } } return m; }
  /* background = brightest value nearby (sliding max), so a dark frame next to the digits does not hide them */
  function slideMax(a, W, H, R) { const t = new Float32Array(W * H), o = new Float32Array(W * H), q = new Int32Array(Math.max(W, H));
    for (let y = 0; y < H; y++) { let h = 0, e = 0; for (let x = 0; x < W + R; x++) { if (x < W) { const v = a[y * W + x]; while (e > h && a[y * W + q[e - 1]] <= v) e--; q[e++] = x; } const c = x - R; if (c >= 0) { while (q[h] < c - R) h++; t[y * W + c] = a[y * W + q[h]]; } } }
    for (let x = 0; x < W; x++) { let h = 0, e = 0; for (let y = 0; y < H + R; y++) { if (y < H) { const v = t[y * W + x]; while (e > h && t[q[e - 1] * W + x] <= v) e--; q[e++] = y; } const c = y - R; if (c >= 0) { while (q[h] < c - R) h++; o[c * W + x] = t[q[h] * W + x]; } } } return o; }
  function thresholdBg(G, R, k) { const { a, W, H } = G, bg = slideMax(a, W, H, R), m = new Uint8Array(W * H); for (let i = 0; i < m.length; i++) m[i] = a[i] < bg[i] * k ? 1 : 0; return m; }
  function dilate(m, W, H, r, ry) { if (!r && !ry) return m; if (ry == null) ry = r; const t = new Uint8Array(W * H), o = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { let run = -1e9; for (let x = 0; x < W; x++) { if (m[y * W + x]) run = x; if (x - run <= r) t[y * W + x] = 1; } run = 1e9; for (let x = W - 1; x >= 0; x--) { if (m[y * W + x]) run = x; if (run - x <= r) t[y * W + x] = 1; } }
    for (let x = 0; x < W; x++) { let run = -1e9; for (let y = 0; y < H; y++) { if (t[y * W + x]) run = y; if (y - run <= ry) o[y * W + x] = 1; } run = 1e9; for (let y = H - 1; y >= 0; y--) { if (t[y * W + x]) run = y; if (run - y <= ry) o[y * W + x] = 1; } } return o; }
  /* remove long straight runs (display frame, divider lines) so the digits stand alone */
  function deline(m, W, H, lh, lv) { const o = m.slice(); for (let y = 0; y < H; y++) { let x = 0; while (x < W) { if (!m[y * W + x]) { x++; continue; } let e = x; while (e < W && m[y * W + e]) e++; if (e - x > lh) for (let k = x; k < e; k++) o[y * W + k] = 0; x = e; } }
    for (let x = 0; x < W; x++) { let y = 0; while (y < H) { if (!m[y * W + x]) { y++; continue; } let e = y; while (e < H && m[e * W + x]) e++; if (e - y > lv) for (let k = y; k < e; k++) o[k * W + x] = 0; y = e; } } return o; }
  function opening(m, W, H, r) { if (!r) return m; const inv = new Uint8Array(W * H); for (let i = 0; i < inv.length; i++) inv[i] = m[i] ? 0 : 1; const e = dilate(inv, W, H, r); for (let i = 0; i < e.length; i++) e[i] = e[i] ? 0 : 1; return dilate(e, W, H, r); }
  function comps(m, W, H) { const lab = new Int32Array(W * H), out = [], st = []; let n = 0;
    for (let i = 0; i < W * H; i++) { if (!m[i] || lab[i]) continue; n++; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, cnt = 0; st.push(i); lab[i] = n;
      while (st.length) { const p = st.pop(), x = p % W, y = (p / W) | 0; cnt++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx; if (m[q] && !lab[q]) { lab[q] = n; st.push(q); } } }
      out.push({ x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n: cnt }); } return out; }
  /* fraction of dark pixels along a segment band, with the italic shear s (top leans right) */
  function segOn(m, W, b, s, u0, u1, v0, v1) { const ww = b.w - s * b.h; let hit = 0, tot = 0; const steps = 9;
    for (let i = 0; i < steps; i++) { let any = 0; for (let j = 0; j < 5; j++) { const u = u0 + (u1 - u0) * (u0 === u1 ? 0 : i / (steps - 1)), v = v0 + (v1 - v0) * (v0 === v1 ? 0 : i / (steps - 1));
        const du = u0 === u1 ? (j - 2) * 0.06 : 0, dv = v0 === v1 ? (j - 2) * 0.035 : 0, uu = u + du, vv = v + dv, x = Math.round(b.x0 + uu * ww + s * b.h * (1 - vv)), y = Math.round(b.y0 + vv * (b.h - 1));
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && m[y * W + x]) any = 1; } hit += any; tot++; } return hit / tot; }
  function decode(m, W, b, s) { if (b.w < b.h * 0.42) { return { d: 1, conf: 0.8 }; }
    const f = [segOn(m, W, b, s, .3, .7, .05, .05), segOn(m, W, b, s, .88, .88, .18, .38), segOn(m, W, b, s, .88, .88, .62, .82), segOn(m, W, b, s, .3, .7, .95, .95), segOn(m, W, b, s, .1, .1, .62, .82), segOn(m, W, b, s, .1, .1, .18, .38), segOn(m, W, b, s, .3, .7, .5, .5)];
    const bits = f.map(x => x > .45 ? '1' : '0').join(''); if (SEG[bits] != null) return { d: SEG[bits], conf: Math.min(...f.map(x => Math.abs(x - .45) * 2 + .3)), bits };
    let best = null; KEYS.forEach(k => { let dist = 0; for (let i = 0; i < 7; i++) dist += Math.abs((k[i] === '1' ? 1 : 0) - f[i]); if (!best || dist < best.dist) best = { k, dist }; });
    return best.dist < 1.3 ? { d: SEG[best.k], conf: .5 - best.dist * .25, bits } : null; }
  function skew(src) { const G = toGray(src, 360), { a, W, H } = G, m = threshold(G, Math.round(W / 14), 10), pts = []; for (let y = 1; y < H; y += 1) for (let x = 1; x < W; x += 1) { const i = y * W + x; if (m[i] !== m[i - W] && m[i] === m[i - 1]) pts.push(x, y); }
    let best = 0, bv = -1; for (let d = -15; d <= 15; d += .5) { const t = d * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), hist = new Float32Array(H * 2 + W); for (let i = 0; i < pts.length; i += 2) { const r = Math.round(-pts[i] * s + pts[i + 1] * c + W); if (r >= 0 && r < hist.length) hist[r]++; } let v = 0; for (let i = 0; i < hist.length; i++) v += hist[i] * hist[i]; if (v > bv) { bv = v; best = d; } } return best; }
  function rotated(src, deg) { if (!deg) return src; const sw = src.naturalWidth || src.videoWidth || src.width, sh = src.naturalHeight || src.videoHeight || src.height, sc = Math.min(1, 1400 / Math.max(sw, sh)), w = sw * sc, h = sh * sc, t = deg * Math.PI / 180, c = document.createElement('canvas');
    c.width = Math.round(w * Math.abs(Math.cos(t)) + h * Math.abs(Math.sin(t))); c.height = Math.round(w * Math.abs(Math.sin(t)) + h * Math.abs(Math.cos(t))); const g = c.getContext('2d'); g.fillStyle = '#999'; g.fillRect(0, 0, c.width, c.height); g.translate(c.width / 2, c.height / 2); g.rotate(-t); g.drawImage(src, -w / 2, -h / 2, w, h); return c; }
  function read(src0) { const deg = skew(src0), src = rotated(src0, deg), G = toGray(src, 900), { W, H } = G, TH = [threshold(G, Math.round(W / 14), 10), thresholdBg(G, Math.round(W / 40), .72)];
    const all = [];
    for (const raw0 of TH) for (const lim of [.12, .25]) { const dl = deline(raw0, W, H, W * lim, H * lim * 1.1); for (const op of [0, 1, 2, 3]) { const raw = opening(dl, W, H, op), rawC = comps(raw, W, H);
    for (const [r, ry] of [[1, 4], [2, 7], [3, 3]]) { const dm = dilate(raw, W, H, r, ry), cs = comps(dm, W, H);
      const dig = cs.filter(c => c.h > H * .025 && c.h < H * .5 && c.h / c.w > 1.15 && c.h / c.w < 6 && c.n > c.w * c.h * .12);
      /* rows: similar height and centre line */
      dig.sort((p, q) => p.y0 - q.y0); const rows = [];
      dig.forEach(c => { const row = rows.find(R => Math.abs((R.cy) - (c.y0 + c.h / 2)) < R.h * .35 && Math.max(R.h, c.h) / Math.min(R.h, c.h) < 1.35); if (row) { row.c.push(c); row.h = (row.h * (row.c.length - 1) + c.h) / row.c.length; } else rows.push({ c: [c], h: c.h, cy: c.y0 + c.h / 2 }); });
      const groups = []; rows.forEach(R => { R.c.sort((p, q) => p.x0 - q.x0); let g = [R.c[0]]; for (let i = 1; i < R.c.length; i++) { const gap = R.c[i].x0 - R.c[i - 1].x1; if (gap > R.h * .9) { groups.push(g); g = []; } g.push(R.c[i]); } groups.push(g); });
      const out = [];
      groups.filter(g => g.length >= 1 && g.length <= 5).forEach(g => { const h = g.reduce((s, c) => s + c.h, 0) / g.length; if (g.some(c => Math.abs(c.h - h) > h * .3)) return;
        let best = null; for (const s of [0, .06, .1, .14, .18, .22]) { const ds = g.map(c => decode(raw, W, c, s)); if (ds.some(x => !x)) continue; const sc = ds.reduce((a, x) => a + x.conf, 0) / ds.length; if (!best || sc > best.sc) best = { ds, sc, s }; }
        if (!best || best.ds.every(x => x.d === 1)) return; const x0 = g[0].x0, x1 = g[g.length - 1].x1, y0 = Math.min(...g.map(c => c.y0)), y1 = Math.max(...g.map(c => c.y1));
        /* decimal point: small blob near the baseline between two digits; colon: two small blobs one above the other */
        let dot = -1, colon = false; for (let i = 0; i < g.length - 1; i++) { const a = g[i], b = g[i + 1], sm = rawC.filter(c => c.w < h * .28 && c.h < h * .28 && c.n > 3 && c.x0 >= a.x1 - h * .25 && c.x1 <= b.x0 + h * .12);
          if (sm.some(c => c.y0 > y0 + h * .72 && c.y1 < y0 + h * 1.08 && c.w > h * .05 && c.h > h * .05 && c.w / c.h > .5 && c.w / c.h < 2 && c.n > c.w * c.h * .45)) dot = i; const mid = sm.filter(c => c.y0 > y0 + h * .12 && c.y1 < y0 + h * .82); if (mid.length >= 2 && Math.max(...mid.map(c => c.y0)) - Math.min(...mid.map(c => c.y0)) > h * .25) colon = true; }
        const digs = best.ds.map(x => x.d).join(''); out.push({ digs, dot, colon, h, x0, x1, y0, y1, conf: best.sc, shear: best.s, txt: dot >= 0 ? digs.slice(0, dot + 1) + '.' + digs.slice(dot + 1) : colon ? digs.slice(0, -2) + ':' + digs.slice(-2) : digs }); });
      out.filter(o => o.digs.length >= 2).forEach(o => all.push(o)); } } }
    /* the same number found by several settings: keep the most confident reading of each place on the photo */
    const ov = (p, q) => { const ix = Math.max(0, Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0)), iy = Math.max(0, Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0)); return ix * iy / Math.min((p.x1 - p.x0) * (p.y1 - p.y0), (q.x1 - q.x0) * (q.y1 - q.y0)); };
    const votes = new Map(); all.forEach(o => { const k = Math.round(o.x0 / 20) + ':' + Math.round(o.y0 / 20) + ':' + o.txt; votes.set(k, (votes.get(k) || 0) + 1); o.vote = k; });
    all.forEach(o => { o.score = o.conf + (votes.get(o.vote) - 1) * .15 + (o.dot >= 0 ? .2 : 0); }); all.sort((p, q) => q.score - p.score);
    const kept = []; all.forEach(o => { if (!kept.some(k => ov(k, o) > .5)) kept.push(o); });
    const rows = kept.sort((a, b) => b.h - a.h || a.y0 - b.y0), maxH = rows.length ? rows[0].h : 0;
    const temps = [], hums = [];
    rows.forEach(o => { if (o.colon) return; const v = parseFloat(o.txt); if (!isFinite(v)) return; const big = o.h / maxH;
      if (o.dot >= 0 && v > -40 && v < 70) temps.push({ v, txt: o.txt, conf: o.conf * big + .5 + (o.digs.length >= 3 && o.dot === o.digs.length - 2 ? .8 : 0) });
      else if (o.digs.length === 3 && o.dot < 0 && v / 10 > -40 && v / 10 < 70) temps.push({ v: v / 10, txt: (v / 10).toFixed(1), conf: o.conf * big * .6 });
      if (o.dot >= 0 && o.digs.length === 2 && +o.digs >= 5) hums.push({ v: +o.digs, conf: o.conf * .6 });
      if (o.dot < 0 && o.digs.length <= 3 && v >= 1 && v <= 100) hums.push({ v, conf: o.conf * (o.digs.length === 2 ? 1 : .5) + (rows.some(t => t.dot >= 0 && Math.abs(t.y0 - o.y0) < 3) ? -1 : 0) }); });
    const uniq = (a, k) => { const m = new Map(); a.sort((p, q) => q.conf - p.conf).forEach(x => { if (!m.has(x[k])) m.set(x[k], x); }); return [...m.values()]; };
    return { temps: uniq(temps, 'txt'), hums: uniq(hums, 'v'), rows, W, H, deg }; }
  window.lcdRead = src => { try { return read(src); } catch (e) { console.error('lcdRead', e); return { temps: [], hums: [], rows: [] }; } };
})();
