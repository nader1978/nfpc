/* ============================================================
   PROGRESS POPUP — every SharePoint save / post / upload / download shows its progress
   B · ring + steps  for short jobs (reads, a few saves)
   D · batch blocks + live log  automatically for large uploads (more than BIG rows written, or orbProg.expect(n) > BIG)
   It watches the SharePoint (Graph / _api) requests of the whole system, so no screen needs its own code.
   Optional, for a known total:  orbProg.expect(n, 'Saving the ready plan')  before a bulk save.
   ============================================================ */
(function () {
  const BIG = 1000, B0 = 25, SHOW_AFTER = 250, IDLE_END = 900;   /* B up to 1,000 rows · D above 1,000 */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => (Math.round(n) || 0).toLocaleString();
  const names = new Map();   /* listId → list name (from resolveIds) */
  let lastUser = 0; ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { lastUser = Date.now(); }, true));
  let J = null, el = null, paused = null, stopReq = false, hideT = 0, idleT = 0, showT = 0, exp = null;

  const css = document.createElement('style'); css.textContent = `
#opBack{position:fixed;inset:0;z-index:2147482900;background:rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;padding:16px;animation:opIn .15s ease-out}
#opBack.min{inset:auto 18px 18px auto;background:none;padding:0}
@keyframes opIn{from{opacity:0}to{opacity:1}}
.op-c{background:var(--card,#fff);color:var(--text,#0f172a);border-radius:18px;box-shadow:0 24px 60px rgba(15,23,42,.35);padding:22px 24px;width:min(470px,100%);box-sizing:border-box;font-size:13px}
.op-c.d{width:min(540px,100%)}
.op-b{display:flex;gap:22px;align-items:center}.op-ring{position:relative;width:124px;height:124px;flex:none}.op-ring svg{display:block}
.op-ring .ar{transition:stroke-dasharray .35s ease}.op-ring.ind svg{animation:opSpin 1.1s linear infinite}@keyframes opSpin{to{transform:rotate(360deg)}}
.op-rc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}.op-rc b{font-size:25px;font-variant-numeric:tabular-nums}.op-rc small{font-size:11px;color:var(--gray-600,#475569);font-family:ui-monospace,Consolas,monospace}
.op-m{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}.op-t{font-size:15.5px;font-weight:700;line-height:1.25}.op-s{font-size:12px;color:var(--gray-600,#475569);margin-top:2px;word-break:break-word}
.op-st{display:flex;align-items:center;gap:10px}.op-st i{width:22px;height:22px;border-radius:11px;flex:none;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-style:normal;background:var(--gray-100,#f1f5f9);color:var(--gray-500,#64748b)}
.op-st.ok i{background:#dcfce7;color:#166534}.op-st.ok span{color:#166534}.op-st.on i{background:var(--brand,#2563eb);color:#fff}.op-st.on span{font-weight:600}.op-st.bad i{background:#fee2e2;color:#991b1b}.op-st span{color:var(--gray-600,#64748b)}.op-st.on span{color:var(--text,#0f172a)}
.op-f{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:14px}.op-f .h{font-size:11.5px;color:var(--gray-500,#64748b)}.op-f .bt{display:flex;gap:8px}
.op-f button{height:38px;padding:0 14px;border-radius:10px;border:1px solid var(--border,#cbd5e1);background:var(--card,#fff);color:var(--text,#0f172a);font:inherit;font-size:13px;font-weight:600;cursor:pointer;width:auto;margin:0}
.op-f button.r{color:#b91c1c;border-color:#fecaca}.op-f button.p{background:var(--brand,#2563eb);color:#fff;border-color:transparent}
.op-dh{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.op-dh b{font-size:22px;font-variant-numeric:tabular-nums}
.op-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(14px,1fr));gap:4px;margin:12px 0 8px}.op-g u{height:14px;border-radius:4px;background:var(--gray-200,#e2e8f0);text-decoration:none}.op-g u.ok{background:#15803d}.op-g u.bad{background:#dc2626}.op-g u.on{background:#60a5fa;animation:opPulse 1s ease-in-out infinite}@keyframes opPulse{50%{opacity:.45}}
.op-cnt{display:flex;gap:16px;font-size:12.5px;flex-wrap:wrap}.op-cnt span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px;background:var(--c)}
.op-log{background:#0f172a;border-radius:10px;padding:9px 12px;height:118px;overflow:auto;display:flex;flex-direction:column;gap:3px;font-family:ui-monospace,Consolas,monospace;font-size:11.5px;margin-top:10px}.op-log div{flex:none;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.op-mini{display:flex;align-items:center;gap:10px;background:#0f172a;color:#e2e8f0;border-radius:14px;padding:10px 14px;box-shadow:0 14px 36px rgba(15,23,42,.4);cursor:pointer;font-size:12.5px;min-width:230px}.op-mini .bar{flex:1;height:6px;border-radius:4px;background:#334155;overflow:hidden}.op-mini .bar i{display:block;height:6px;background:#60a5fa;border-radius:4px}
@media (prefers-reduced-motion:reduce){.op-ring.ind svg,.op-g u.on{animation:none}}`;
  document.head.appendChild(css);

  /* ---------- classify a request ---------- */
  function classify(url, method) {
    url = String(url || ''); method = (method || 'GET').toUpperCase();
    const g = /graph\.microsoft\.com/i.test(url), sp = /\/_api\//i.test(url); if (!g && !sp) return null;
    if (/\/me\/sendMail/i.test(url)) return { k: 'mail' };
    const m = url.match(/\/lists\/([0-9a-f-]{36}|[^/?]+)\/items/i) || url.match(/lists\(guid'([0-9a-f-]{36})'\)\/items/i), list = m ? decodeURIComponent(m[1]) : '';
    if (/\$batch/i.test(url) && method === 'POST') return { k: 'w', list, batch: true };
    if (/AttachmentFiles\/add/i.test(url)) return { k: 'w', list, file: true };
    if (method === 'GET') return m ? { k: 'r', list } : { k: 'meta' };
    if (/\/drive|\/content/i.test(url)) return { k: 'w', list: '', file: true };
    return m || /\/fields$/i.test(url) ? { k: 'w', list, del: method === 'DELETE' } : { k: 'meta' };
  }
  const listName = id => names.get(id) || (id && !/^[0-9a-f-]{36}$/i.test(id) ? id : '');

  /* ---------- the job ---------- */
  function begin() {
    clearTimeout(hideT); if (J && !J.fin) return J;
    shownRows = 0; J = { t0: Date.now(), user: Date.now() - lastUser < 15000 || (okAt > 0 && Date.now() - okAt < 90000), live: 0, r: 0, rows: 0, w: 0, ok: 0, bad: 0, del: 0, files: 0, mail: 0, lists: new Set(), log: [], batches: [], meta: 0, fin: false, shown: false, min: false, total: exp ? exp.n : null, label: exp ? exp.label : '' };
    exp = null; stopReq = false; clearTimeout(showT); showT = setTimeout(() => { if (J && !J.fin && J.user && !asking) { J.shown = true; draw(); } }, SHOW_AFTER);
    return J;
  }
  const bsz = j => j.total > 0 ? Math.max(5, Math.ceil(j.total / 48)) : B0;
  function mode() { return J.w + J.del > BIG || (J.total || 0) > BIG ? 'D' : 'B'; }
  function title() {
    const L = [...J.lists].map(listName).filter(Boolean), on = L.length ? L.slice(0, 2).join(', ') + (L.length > 2 ? ' +' + (L.length - 2) : '') : 'SharePoint';
    if (J.label) return [J.label, on];
    if (J.mail && !J.w && !J.r) return ['Sending the email', 'Microsoft 365 mail'];
    if (J.files && J.w === J.files) return ['Uploading attachments', on];
    if (J.w || J.del) return [J.del && !J.w ? 'Deleting from SharePoint' : 'Saving to SharePoint', on];
    return ['Downloading data', on]; }
  function done() {
    clearTimeout(idleT); if (!J || J.fin) return; J.fin = true; const j = J;
    if (!j.shown) { J = null; return; }
    if (j.bad) { const B = j.log.filter(l => l.bad && /^✖ row/.test(l.t)); if (B.length) j.log.push({ c: '#fde68a', t: '■ ' + fmt(j.bad) + ' failed: ' + B.slice(0, 8).map(l => l.t.replace(/^✖ /, '').split(' · ')[0]).join(', ') + (B.length > 8 ? ' …' : '') + ' — ' + (B[B.length - 1].t.split(' · ').slice(1).join(' · ')) }); }
    draw(); if (!j.bad) hideT = setTimeout(() => { if (J === j) close(); }, j.min ? 1500 : 1300);
  }
  function close() { if (el) el.remove(); el = null; if (J && J.fin) J = null; paused = null; }
  function tick() { clearTimeout(idleT); if (J && !J.fin && J.live <= 0) idleT = setTimeout(() => { if (J && J.live <= 0) done(); }, IDLE_END); if (J && J.shown) draw(); }

  /* ---------- drawing ---------- */
  const ring = (p, ind) => { const C = 2 * Math.PI * 52, d = ind ? C * 0.28 : C * Math.max(0, Math.min(1, p)); return `<div class="op-ring${ind ? ' ind' : ''}"><svg width="124" height="124" viewBox="0 0 124 124" role="img" aria-label="progress"><circle cx="62" cy="62" r="52" fill="none" stroke="var(--gray-200,#e2e8f0)" stroke-width="11"></circle><circle class="ar" cx="62" cy="62" r="52" fill="none" stroke="${J.bad ? '#dc2626' : J.fin ? '#15803d' : 'var(--brand,#2563eb)'}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${d.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 62 62)"></circle></svg>`; };
  /* update the popup in place (keeps the spinning ring / pulsing cells running smoothly instead of rebuilding them) */
  function morph(host, html) { const t = document.createElement('template'); t.innerHTML = html.trim(); sync(host, t.content); }
  function sync(a, b) {
    const A = [...a.childNodes], B = [...b.childNodes];
    B.forEach((nb, i) => { const na = A[i];
      if (!na) { a.appendChild(nb.cloneNode(true)); return; }
      if (na.nodeType !== nb.nodeType || na.nodeName !== nb.nodeName) { a.replaceChild(nb.cloneNode(true), na); return; }
      if (nb.nodeType === 3) { if (na.nodeValue !== nb.nodeValue) na.nodeValue = nb.nodeValue; return; }
      if (nb.nodeType !== 1) return;
      [...na.attributes].forEach(x => { if (!nb.hasAttribute(x.name)) na.removeAttribute(x.name); });
      [...nb.attributes].forEach(x => { if (na.getAttribute(x.name) !== x.value) na.setAttribute(x.name, x.value); });
      sync(na, nb); });
    for (let i = A.length - 1; i >= B.length; i--) a.removeChild(A[i]); }
  /* the row counter glides to its value */
  let shownRows = 0, rowRaf = 0;
  function glide() { cancelAnimationFrame(rowRaf); const step = () => { if (!J) return; const tgt = J.rows; if (Math.abs(tgt - shownRows) < 1) shownRows = tgt; else shownRows += (tgt - shownRows) * 0.18; const b = el && el.querySelector('.op-rc b[data-rows]'); if (b) b.textContent = fmt(shownRows); if (shownRows !== tgt) rowRaf = requestAnimationFrame(step); }; rowRaf = requestAnimationFrame(step); }
  function draw() {
    if (!J) return; if (!el) { el = document.createElement('div'); el.id = 'opBack'; el.dataset.nohc = '1'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); el.addEventListener('click', onClick); }
    const [t, sub] = title(), wr = J.w + J.del, writing = wr > 0, tot = J.total, pc = tot ? Math.min(1, wr / tot) : null, dur = ((Date.now() - J.t0) / 1000).toFixed(0);
    el.classList.toggle('min', J.min && !J.fin);
    if (J.min && !J.fin) { morph(el, `<div class="op-mini" data-op="max" title="Show the progress"><span>${esc(t)}</span><span class="bar"><i style="width:${pc != null ? Math.round(pc * 100) : 40}%"></i></span><b>${writing ? fmt(wr) + (tot ? '/' + fmt(tot) : '') : fmt(J.rows)}</b></div>`); return; }
    const foot = (h, b) => `<div class="op-f"><span class="h">${h}</span><span class="bt">${b}</span></div>`;
    if (mode() === 'D') {
      const BATCH = bsz(J), n = tot || wr, nb = Math.max(1, Math.ceil(n / BATCH)), cells = [];
      for (let i = 0; i < nb; i++) { const b = J.batches[i]; cells.push(`<u class="${b ? (b.bad ? 'bad' : b.n >= BATCH || J.fin || (tot && i === nb - 1 && b.n >= tot - i * BATCH) ? 'ok' : 'on') : (i === J.batches.length && !J.fin ? 'on' : '')}"></u>`); }
      const pct = pc != null ? Math.round(pc * 100) + '%' : fmt(wr) + ' rows';
      morph(el, `<div class="op-c d"><div class="op-dh"><div><div class="op-t">${esc(J.fin ? (J.bad ? 'Finished with errors' : 'Saved') + ' — ' + t.toLowerCase() : t)}</div><div class="op-s">${esc(sub)}${paused ? ' · paused' : ''}</div></div><b>${J.fin && !J.bad ? '✓ ' : ''}${pct}</b></div>
        <div class="op-g">${cells.join('')}</div>
        <div class="op-cnt"><span style="--c:#15803d">Saved <b>${fmt(J.ok)}</b></span><span style="--c:#dc2626">Failed <b>${fmt(J.bad)}</b></span>${tot ? `<span style="--c:#cbd5e1">Waiting <b>${fmt(Math.max(0, tot - wr))}</b></span>` : ''}<span style="--c:transparent">${dur} s</span></div>
        <div class="op-log">${J.log.slice(-40).map(l => `<div style="color:${l.c}">${esc(l.t)}</div>`).join('')}</div>
        ${J.fin ? foot(J.bad ? 'Failed rows were not saved — fix the reason above and save them again' : 'All rows saved', `<button type="button" class="p" data-op="close">Close</button>`)
          : foot('Failed rows can be saved again at the end', `<button type="button" data-op="min">Run in background</button><button type="button" data-op="pause">${paused ? 'Resume' : 'Pause'}</button><button type="button" class="r" data-op="stop">Stop</button>`)}</div>`);
      const lg = el.querySelector('.op-log'); if (lg) lg.scrollTop = lg.scrollHeight; return;
    }
    const steps = writing ? [['Connecting to SharePoint', J.meta + wr > 0], [(J.del && !J.w ? 'Deleting' : 'Writing') + ' ' + (tot ? fmt(wr) + ' of ' + fmt(tot) : fmt(wr)) + ' row' + (wr === 1 ? '' : 's'), J.fin], ['Confirming', J.fin], ['Done', J.fin]]
      : [['Connecting to SharePoint', J.r > 0 || J.fin], ['Reading rows' + (J.rows ? ' — ' + fmt(J.rows) : ''), J.fin], ['Done', J.fin]];
    let on = steps.findIndex(s => !s[1]); const ind = !J.fin && pc == null;
    morph(el, `<div class="op-c"><div class="op-b">${ring(J.fin ? 1 : pc || 0, ind)}<div class="op-rc"><b${!J.fin && pc == null && !writing ? ' data-rows="1"' : ''}>${J.fin ? (J.bad ? '!' : '✓') : pc != null ? Math.round(pc * 100) + '%' : writing ? fmt(wr) : fmt(shownRows)}</b><small>${J.fin ? dur + ' s' : pc != null ? fmt(wr) + ' / ' + fmt(tot) : writing ? 'rows saved' : 'rows read'}</small></div></div>
      <div class="op-m"><div><div class="op-t">${esc(J.fin ? (J.bad ? 'Finished with errors' : writing ? 'Saved' : 'Loaded') : t)}</div><div class="op-s">${esc(sub)}</div></div>
      ${steps.map((s, i) => `<div class="op-st ${s[1] ? 'ok' : i === on ? 'on' : ''}${J.fin && J.bad && i === 1 ? ' bad' : ''}"><i>${s[1] ? '✓' : i + 1}</i><span>${esc(s[0])}</span></div>`).join('')}
      ${J.bad ? `<div class="op-s" style="color:#b91c1c">${fmt(J.bad)} request(s) failed — ${esc((J.log.filter(l => l.bad).slice(-1)[0] || {}).t || '')}</div>` : ''}</div></div>
      ${J.fin ? (J.bad ? foot('', '<button type="button" class="p" data-op="close">Close</button>') : '') : foot('', '<button type="button" data-op="min">Run in background</button>')}</div>`);
    if (!writing && !J.fin && pc == null) glide();
  }
  function onClick(e) { const b = e.target.closest('[data-op]'); if (!b) return; const a = b.dataset.op;
    if (a === 'close') return close(); if (a === 'min') { J.min = true; return draw(); } if (a === 'max') { J.min = false; return draw(); }
    if (a === 'pause') { if (paused) { const r = paused.r; paused = null; r(); } else { let r; const p = new Promise(x => { r = x; }); paused = { p, r }; } return draw(); }
    if (a === 'stop') { stopReq = true; if (paused) { const r = paused.r; paused = null; r(); } J.log.push({ c: '#fca5a5', t: '■ stopped by the user — the rest is not saved', bad: true }); return draw(); } }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el && J && J.fin) close(); });

  /* the progress window, the confirmation dialog and the toast messages always stay in front of every pop-up / report window of the application */
  { const zf = document.createElement('style'); zf.textContent = '#wMailModal,#prtSetup,#prtBack{z-index:2147483400 !important}#opBack,#opAsk,#sectionToast{z-index:2147483600 !important}#opAsk{z-index:2147483640 !important}#ssPanel,#cbPanel,.ss-panel,.cb-panel{z-index:2147483500 !important}'; document.head.appendChild(zf); }
  /* ---------- confirm before writing (only for work the user started; asked once per action) ---------- */
  let asking = null, okAt = 0, noAt = 0;
  const cssC = document.createElement('style'); cssC.textContent = `#opAsk{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;animation:opIn .12s ease-out}
#opAsk .op-c{width:min(440px,100%)}#opAsk .op-qh{display:flex;gap:14px;align-items:flex-start}#opAsk .op-qi{width:44px;height:44px;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center;background:#dbeafe;color:#1d4ed8}
#opAsk .op-qi.del{background:#fee2e2;color:#b91c1c}#opAsk .op-q{font-size:13px;color:var(--gray-600,#475569);margin-top:6px;line-height:1.45}#opAsk .op-q b{color:var(--text,#0f172a)}#opAsk .op-f button.dl{background:#b91c1c;color:#fff;border-color:transparent}`; document.head.appendChild(cssC);
  const ICO = { up: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 13.5 4 4 0 0 0 7 19z"/><path d="M12 12v6"/><path d="m9 14 3-3 3 3"/>', del: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', q: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>' };
  function ask(c, j) {
    if (asking) return asking;
    const L = [...j.lists, c.list].map(listName).filter(Boolean), on = [...new Set(L)].join(', ') || 'SharePoint', del = !!c.del, mail = c.k === 'mail', file = !!c.file;
    const loc = (typeof currentUser !== 'undefined' && currentUser && (currentUser.locationName || currentUser.location || '')) || '';
    const o = mail ? { title: 'Send the email?', label: 'Send email', html: 'The email will be sent from your Microsoft 365 account.', yes: 'Yes, send', icon: 'mail' }
      : del ? { title: 'Delete ' + (j.total ? fmt(j.total) + ' record' + (j.total > 1 ? 's' : '') : 'the selected record(s)') + '?', label: 'Delete from SharePoint', rows: [['List', on]], yes: 'Yes, delete', kind: 'del' }
      : file ? { title: 'Upload the file(s)?', label: 'Upload to SharePoint', rows: [['List', on]], yes: 'Yes, upload', icon: 'up' }
      : { title: j.label ? j.label + '?' : 'Save ' + (j.total ? fmt(j.total) + ' row' + (j.total > 1 ? 's' : '') : 'the changes') + '?', label: 'Save to SharePoint', rows: [['List', on], ['Rows', j.total ? fmt(j.total) : ''], ['Location', String(loc)]], yes: 'Yes, save', icon: 'up' };
    asking = box(o).then(v => { const t = Date.now() + 400; if (v) okAt = t; else noAt = t; asking = null; return v; });
    return asking; }
  /* ---------- every confirm() of the system in the same ORBIT dialog ----------
     confirm() must answer at once, so the first call answers "no", shows this dialog, and on "Yes" repeats the click
     that asked — the repeated question is then answered "yes" straight away (and the SharePoint save does not ask again). */
  const nativeConfirm = window.confirm.bind(window); window.nativeConfirm = nativeConfirm;
  let lastAct = null, okMsgs = new Map(), boxOpen = false;
  document.addEventListener('click', e => { if (!(e.target.closest && e.target.closest('#opAsk'))) lastAct = { el: e.target, t: Date.now() }; }, true);
  /* design A: colour header band + summary rows · deletes need press-and-hold */
  const cssA = document.createElement('style'); cssA.textContent = `
#opAsk .oa{width:min(430px,100%);background:var(--card,#fff);color:var(--text,#0f172a);border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,.45);font-size:13.5px;animation:oaIn .16s ease-out}
@keyframes oaIn{from{transform:translateY(8px) scale(.98);opacity:0}to{transform:none;opacity:1}}
#opAsk .oa-h{background:#1e3a8a;color:#fff;padding:11px 18px;display:flex;align-items:center;gap:11px}#opAsk .oa.del .oa-h{background:#991b1b}
#opAsk .oa-i svg{width:18px;height:18px}.oa-i{width:34px;height:34px;border-radius:17px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;flex:none}
#opAsk .oa-l{font-size:10.5px;opacity:.85;letter-spacing:.07em;text-transform:uppercase;line-height:1.2}#opAsk .oa-t{font-size:16px;font-weight:700;line-height:1.2;word-break:break-word}
#opAsk .oa-b{padding:16px 22px 4px;display:flex;flex-direction:column;gap:9px}#opAsk .oa-r{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid var(--border,#eef2f7);padding-bottom:8px}
#opAsk .oa-r span{color:var(--gray-500,#64748b)}#opAsk .oa-r b{text-align:right;word-break:break-word}#opAsk .oa-p{color:var(--gray-600,#475569);line-height:1.45}#opAsk .oa-w{color:#991b1b;font-weight:600}
#opAsk .oa-f{padding:14px 22px 20px;display:flex;justify-content:flex-end;align-items:center;gap:10px}#opAsk .oa-f .h{margin-right:auto;font-size:11.5px;color:var(--gray-500,#64748b)}
#opAsk .oa-f button{height:42px;padding:0 18px;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;width:auto;margin:0}
#opAsk .oa-n{border:1px solid var(--border,#cbd5e1);background:var(--card,#fff);color:var(--text,#0f172a)}#opAsk .oa-y{border:none;background:#1d4ed8;color:#fff;font-weight:700!important}
#opAsk .oa-hold{position:relative;overflow:hidden;border:none;background:#fecaca;color:#fff;font-weight:700!important;min-width:170px;user-select:none;-webkit-user-select:none;touch-action:none}
#opAsk .oa-hold i{position:absolute;left:0;top:0;bottom:0;width:0;background:#b91c1c}#opAsk .oa-hold span{position:relative;text-shadow:0 1px 1px rgba(0,0,0,.25)}
#opAsk .oa-y:focus-visible,#opAsk .oa-n:focus-visible,#opAsk .oa-hold:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}`; document.head.appendChild(cssA);
  const HOLD_MS = 1200;
  function box(o) {
    return new Promise(res => { boxOpen = true; const del = o.kind === 'del', d = document.createElement('div'); d.id = 'opAsk'; d.dataset.nohc = '1'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true');
      const rows = (o.rows || []).filter(r => r && r[1] !== '' && r[1] != null).map(r => `<div class="oa-r"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('');
      const label = o.label || (del ? 'Delete' : o.icon === 'up' ? 'Save to SharePoint' : o.icon === 'mail' ? 'Send email' : 'Please confirm');
      d.innerHTML = `<div class="oa${del ? ' del' : ''}"><div class="oa-h"><div class="oa-i"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[o.icon || (del ? 'del' : 'q')]}</svg></div><div style="min-width:0"><div class="oa-l">${esc(label)}</div><div class="oa-t">${esc(o.title)}</div></div></div>
        <div class="oa-b">${rows}${o.html ? `<div class="oa-p">${o.html}</div>` : ''}${del && !/cannot be undone/i.test(o.html || '') ? '<div class="oa-w">This cannot be undone.</div>' : ''}</div>
        <div class="oa-f">${del ? '<span class="h">Press and hold to delete</span>' : ''}<button type="button" class="oa-n" data-q="0">${esc(o.no || 'Cancel')}</button>${del ? `<button type="button" class="oa-hold" data-hold="1" aria-label="Press and hold to ${esc((o.yes || 'Yes, delete').replace(/^Yes, /, ''))}"><i></i><span>Hold to ${esc((o.yes || 'Yes, delete').replace(/^Yes, /, ''))}</span></button>` : `<button type="button" class="oa-y" data-q="1">${esc(o.yes || 'Yes')}</button>`}</div></div>`;
      document.body.appendChild(d); setTimeout(() => { const b = d.querySelector(del ? '[data-q="0"]' : '[data-q="1"]'); if (b) b.focus(); }, 30);
      let done = false; const fin = v => { if (done) return; done = true; stopH(); d.remove(); boxOpen = false; document.removeEventListener('keydown', key, true); document.removeEventListener('keyup', kup, true); res(v); };
      /* hold to delete */
      const hb = d.querySelector('[data-hold]'), bar = hb && hb.querySelector('i'), txt = hb && hb.querySelector('span'); let h0 = 0, raf = 0;
      const step = () => { const f = Math.min(1, (Date.now() - h0) / HOLD_MS); bar.style.width = (f * 100) + '%'; txt.textContent = f >= 1 ? '✓ ' + (o.yes || 'Yes, delete').replace(/^Yes, /, '') : 'Keep holding…'; if (f >= 1) { setTimeout(() => fin(true), 180); return; } raf = requestAnimationFrame(step); };
      const startH = e => { if (!hb || h0) return; if (e) e.preventDefault(); h0 = Date.now(); raf = requestAnimationFrame(step); };
      function stopH() { if (!hb || !h0) return; cancelAnimationFrame(raf); if (Date.now() - h0 < HOLD_MS) { h0 = 0; bar.style.transition = 'width .25s'; bar.style.width = '0'; txt.textContent = 'Hold to ' + (o.yes || 'Yes, delete').replace(/^Yes, /, ''); setTimeout(() => { if (bar) bar.style.transition = ''; }, 260); } }
      if (hb) { hb.addEventListener('pointerdown', startH); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => hb.addEventListener(ev, stopH)); hb.addEventListener('contextmenu', e => e.preventDefault()); }
      const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fin(false); }
        else if ((e.key === 'Enter' || e.key === ' ') && del) { if (document.activeElement === hb) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) startH(); } else if (e.key === 'Enter' && document.activeElement && document.activeElement.dataset.q === '0') { e.preventDefault(); fin(false); } }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const a = document.activeElement; fin(!(a && a.dataset && a.dataset.q === '0')); } };
      const kup = e => { if (del && (e.key === 'Enter' || e.key === ' ')) stopH(); };
      document.addEventListener('keydown', key, true); document.addEventListener('keyup', kup, true);
      d.addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) fin(b.dataset.q === '1'); else if (e.target === d) fin(false); }); }); }
  window.orbAsk = box;
  /* the older upload question (spAsk, used by 13 screens) now opens this same dialog (design A); "Yes" counts as the confirmation for the save that follows */
  if (typeof spAsk === 'function') { const sp = function (text, title) { if (window.__orbSched > 0 && Date.now() - lastUser > 3000) return Promise.resolve(true); text = String(text == null ? '' : text) + (sp.extra || ''); sp.extra = '';
      const L = text.split('\n').map(x => x.trim()).filter(Boolean), first = (L[0] || 'Upload the data').replace(/\?\s*$/, ''), rows = [], html = [];
      L.slice(1).forEach(l => { const m = l.match(/^([^:⚠✔✖]{2,32}):\s*(.+)$/); if (m) rows.push([m[1].trim(), m[2].trim()]); else html.push(esc(l)); });
      const del = /\b(delete|remove|clear|wipe)\b/i.test(first);
      return box({ title: first + '?', label: title || (del ? 'Delete' : 'Save to SharePoint'), rows, html: html.join('<br>'), yes: del ? 'Yes, delete' : /upload/i.test(first) ? 'Yes, upload' : 'Yes, save', kind: del ? 'del' : undefined, icon: del ? undefined : 'up' })
        .then(v => { const t = Date.now() + 400; if (v) okAt = t; else noAt = t; return v; }); };
    sp.extra = ''; spAsk = sp; }
  window.confirm = function (msg) {
    if (window.__orbSched > 0 && Date.now() - lastUser > 3000) return true;   /* a schedule is running — nobody to ask */
    msg = String(msg == null ? '' : msg); const now = Date.now(); okMsgs.forEach((t, k) => { if (now - t > 12000) okMsgs.delete(k); });
    if (okMsgs.has(msg)) { okMsgs.delete(msg); okAt = now + 4000; return true; }
    const a = lastAct; if (boxOpen || !a || now - a.t > 4000 || !a.el || !a.el.isConnected) return nativeConfirm(msg);
    const lines = msg.split('\n').filter(x => x.trim() !== ''), first = lines[0] || 'Please confirm', rest = lines.slice(1);
    const del = /\b(delete|remove|clear|discard|erase|wipe|reset|cancel the|danger)\b/i.test(msg), up = /\b(upload|save|post|push|send|import|register|approve|issue|apply)\b/i.test(first);
    box({ title: first.length <= 90 ? first.replace(/^[⚠✔✖ ]+/, '') : 'Please confirm', label: del ? 'Delete' : up ? 'Save' : 'Please confirm', html: (first.length > 90 ? [first].concat(rest) : rest).map(l => esc(l)).join('<br>') || (del ? '' : 'Do you want to continue?'), kind: del ? 'del' : '', icon: del ? 'del' : up ? 'up' : 'q', yes: del ? 'Yes, ' + (/clear/i.test(msg) ? 'clear' : /remove/i.test(msg) ? 'remove' : /discard/i.test(msg) ? 'discard' : /reset/i.test(msg) ? 'reset' : 'delete') : 'Yes, continue' })
      .then(ok => { if (!ok) return; okMsgs.set(msg, Date.now()); okAt = Date.now() + 4000; const el = a.el; lastAct = { el, t: Date.now() }; try { el.click(); } catch (e) {} });
    return false; };

  async function gate(c, j) {
    if (!j.user) return true;                       /* background work: no question */
    if (noAt && lastUser <= noAt) return false;      /* already cancelled for this action */
    if (okAt && lastUser <= okAt) return true;       /* already confirmed for this action */
    const ok = await ask(c, j); if (ok && !j.fin) { j.t0 = Date.now(); j.shown = true; draw(); } return ok; }

  /* ---------- the watcher ---------- */
  const bgNow = () => window.__orbBg > 0 && Date.now() - lastUser > 3000 && !(J && !J.fin && J.user);   /* a running user job keeps being tracked */
  const F0 = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url, method = (init && init.method) || (input && input.method) || 'GET', c = classify(url, method);
    if (!c) return F0(input, init);
    if (bgNow()) return F0(input, init);   /* timer / schedule work: no progress window, no question */
    /* background system-log writes (Admin Console) are silent: no question, no progress window */
    if (window.__orbQuiet && c.k !== 'mail') { let sl = ''; try { sl = String((utGet('syslog') || {}).list || '').toLowerCase(); } catch (x) {} const ln = String(listName(c.list) || c.list || '').toLowerCase(); if (!c.list || (sl && (ln === sl || String(c.list).toLowerCase() === sl))) return F0(input, init); }
    const j = begin(); if (c.k === 'meta') { j.meta++; } else if (c.list) j.lists.add(c.list);
    if ((c.k === 'w' || c.k === 'mail') && !(await gate(c, j))) { j.cancel = true; tick(); return new Response(JSON.stringify({ error: { code: 'cancelled', message: 'Cancelled by the user — nothing was saved' } }), { status: 400, statusText: 'Cancelled', headers: { 'Content-Type': 'application/json' } }); }
    if (c.k === 'w' && paused) await paused.p;
    if (c.k === 'w' && stopReq) { tick(); return new Response(JSON.stringify({ error: { code: 'stopped', message: 'Stopped by the user — not saved' } }), { status: 400, statusText: 'Stopped', headers: { 'Content-Type': 'application/json' } }); }
    let nb = 1; if (c.batch) { try { nb = (JSON.parse(init.body).requests || []).length || 1; } catch (x) {} }
    j.live++; let res;
    try { res = await F0(input, init); }
    catch (err) { j.live--; if (c.k === 'w') { j.bad += nb; addB(j, nb, true); j.log.push({ c: '#fca5a5', t: '✖ ' + (listName(c.list) || 'request') + ' · network error: ' + err.message, bad: true }); } tick(); throw err; }
    j.live--;
    if (c.k === 'r') { if (res.ok) { j.r++; try { res.clone().json().then(d => { if (d && d.value) { j.rows += d.value.length; if (j.shown) draw(); } }).catch(() => {}); } catch (x) {} } }
    else if (c.k === 'mail') j.mail++;
    else if (c.k === 'w' && res.status !== 429 && res.status !== 503 && res.status !== 504) {
      if (c.del) j.del += nb; else j.w += nb; if (c.file) j.files++;
      if (res.ok || res.status === 204) { j.ok += nb; addB(j, nb, false); const b = j.batches[j.batches.length - 1]; if (b && b.n >= bsz(j) && !b.logged) { b.logged = 1; j.log.push({ c: '#86efac', t: '✔ rows ' + fmt(b.from) + '–' + fmt(b.from + b.n - 1) + ' saved' + (listName(c.list) ? ' · ' + listName(c.list) : '') }); } }
      else { j.bad += nb; addB(j, nb, true); let m = 'HTTP ' + res.status; try { const t = await res.clone().text(); try { m += ': ' + (JSON.parse(t).error || {}).message; } catch (x) { m += ': ' + t.slice(0, 140); } } catch (x) {} j.log.push({ c: '#fca5a5', t: '✖ row ' + fmt(j.w + j.del) + ' · ' + m, bad: true }); }
    }
    tick(); return res;
  };
  function addB(j, n, bad) { const BATCH = bsz(j); let b = j.batches[j.batches.length - 1]; for (let k = 0; k < n; k++) { if (!b || b.n >= BATCH) { b = { from: (j.batches.length * BATCH) + 1, n: 0, bad: false }; j.batches.push(b); } b.n++; if (bad) b.bad = true; } }

  /* list names for the titles */
  if (typeof resolveIds === 'function') { const R0 = resolveIds; window.resolveIds = async function (site, name, token) { const r = await R0.apply(this, arguments); try { if (r && r.listId) names.set(r.listId, name); } catch (x) {} return r; }; try { resolveIds = window.resolveIds; } catch (x) {} }

  window.orbProg = {
    expect(n, label) { if (J && !J.fin) { J.total = n; if (label) J.label = label; if (J.shown) draw(); } else exp = { n, label }; },
    label(t) { if (J && !J.fin) { J.label = t; if (J.shown) draw(); } else exp = Object.assign(exp || { n: null }, { label: t }); },
    show() { if (J && !J.fin) { J.user = true; J.shown = true; draw(); } },
    state: () => J
  };
})();
