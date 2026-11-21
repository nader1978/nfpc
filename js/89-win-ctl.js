/* ORBIT 394 — the drill-down / original-entry / e-mail windows get the same ⎯ ▢ ✕ window buttons as every other pop-up.
   Runs after js/87 has split the header into title bar + toolbar strip; the new buttons sit on the title bar and
   simply click the window's own maximise / close buttons (which are hidden). */
(function () {
  'use strict';
  const WIN = '.sdb-dw,.sdb-rw,.sdb-mw';
  function fix(w) {
    const bar = w.querySelector(':scope > [data-ag-strip="1"]') || (w.querySelector(':scope > .sdb-dh') && w.querySelector(':scope > .sdb-dh:not([data-ag-strip])') ? null : null);
    if (!bar || bar.querySelector('.wc-trio')) return;
    const close = w.querySelector('.sdb-dx,[data-x],[data-rx]'), max = w.querySelector('[data-mx],[data-rmx]');
    const mk = (txt, title, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'wc-b ' + cls; b.textContent = txt; b.title = title; b.style.cssText = 'cursor:pointer;line-height:1'; b.addEventListener('click', e => { e.stopPropagation(); fn(); }); return b; };
    const trio = document.createElement('span'); trio.className = 'wc-trio'; trio.style.cssText = 'display:inline-flex;gap:4px;margin-left:auto;flex:none;align-self:center';
    trio.appendChild(mk('—', 'Minimise / restore', 'wc-n', () => w.classList.toggle('sdb-mini')));
    trio.appendChild(mk('▢', 'Maximise / restore', 'wc-m', () => { w.classList.remove('sdb-mini'); if (w._max) w._max(); else if (max) max.click(); }));
    trio.appendChild(mk('✕', 'Close', 'wc-x', () => { if (close) close.click(); }));
    [close, max].forEach(x => { if (x) { x.classList.add('wc-orig'); x.style.setProperty('display', 'none', 'important'); } });
    bar.appendChild(trio);
  }
  function scan() { document.querySelectorAll(WIN).forEach(w => { try { fix(w); } catch (e) {} }); }
  let t = 0; const sched = () => { if (t) return; t = setTimeout(() => { t = 0; scan(); }, 400); };
  function init() { const st = document.createElement('style'); st.textContent = 'html body .wc-orig.wc-orig.wc-orig{display:none!important}'; document.head.appendChild(st); try { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); } catch (e) {} sched(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* ORBIT 448 — every Rack / Forklift record, e-mail and action window (#flrAct / #flrPop) can be resized: drag any edge or corner.
   Moving stays with the title bar (js/34). The size is remembered for the session. */
(function () {
  'use strict';
  const css = document.createElement('style'); css.textContent = '#flrAct .flr-pc,#flrPop .flr-pc{position:relative}#flrAct .flr-pc>.flr-pb,#flrPop .flr-pc>.flr-pb{flex:1 1 auto;min-height:0}#flrAct .flr-pc.flr-sized,#flrPop .flr-pc.flr-sized{max-width:none!important;max-height:none!important}.flr-rz{position:absolute;z-index:6}.flr-rz-n,.flr-rz-s{left:12px;right:12px;height:11px;cursor:ns-resize}.flr-rz-n{top:-4px}.flr-rz-s{bottom:-4px}.flr-rz-e,.flr-rz-w{top:12px;bottom:12px;width:11px;cursor:ew-resize}.flr-rz-e{right:-4px}.flr-rz-w{left:-4px}.flr-rz-ne,.flr-rz-nw,.flr-rz-se,.flr-rz-sw{width:18px;height:18px}.flr-rz-ne{top:-4px;right:-4px;cursor:nesw-resize}.flr-rz-sw{bottom:-4px;left:-4px;cursor:nesw-resize}.flr-rz-nw{top:-4px;left:-4px;cursor:nwse-resize}.flr-rz-se{bottom:-4px;right:-4px;cursor:nwse-resize}.mdl-full .flr-rz{display:none}';
  document.head.appendChild(css);
  let saved = null; try { saved = JSON.parse(sessionStorage.getItem('flrSize') || 'null'); } catch (e) { }
  function fx(W) {
    if (!W || W._rz) return; W._rz = 1;
    const holder = () => W.parentElement, off = () => holder()._mdl || (holder()._mdl = { x: 0, y: 0 }), put = () => { const o = off(); W.style.transform = 'translate(' + o.x + 'px,' + o.y + 'px)'; };
    const size = (w, h) => { W.classList.add('flr-sized'); W.style.width = w + 'px'; W.style.height = h + 'px'; };
    if (saved && saved.w > 400 && saved.h > 260) size(Math.min(innerWidth - 20, saved.w), Math.min(innerHeight - 20, saved.h));
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(d => { const g = document.createElement('i'); g.className = 'flr-rz flr-rz-' + d; g.title = 'Drag to resize'; W.appendChild(g);
      g.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); e.stopPropagation(); const r = W.getBoundingClientRect(), o = off(), x0 = e.clientX, y0 = e.clientY, ox = o.x, oy = o.y; g.setPointerCapture(e.pointerId);
        const mv = ev => { let w = r.width, h = r.height, dx = ev.clientX - x0, dy = ev.clientY - y0; if (d.includes('e')) w = r.width + dx; if (d.includes('w')) w = r.width - dx; if (d.includes('s')) h = r.height + dy; if (d.includes('n')) h = r.height - dy;
          w = Math.max(420, Math.min(innerWidth - 8, w)); h = Math.max(260, Math.min(innerHeight - 8, h)); size(w, h);
          /* the window is centred by its overlay: shift it by half of the growth so the opposite edge stays where it is */
          o.x = ox + (d.includes('e') ? (w - r.width) / 2 : d.includes('w') ? -(w - r.width) / 2 : 0); o.y = oy + (d.includes('s') ? (h - r.height) / 2 : d.includes('n') ? -(h - r.height) / 2 : 0); put(); };
        const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); const b = W.getBoundingClientRect(); saved = { w: Math.round(b.width), h: Math.round(b.height) }; try { sessionStorage.setItem('flrSize', JSON.stringify(saved)); } catch (x) { } };
        g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); }); });
  }
  const scan = () => document.querySelectorAll('#flrAct .flr-pc,#flrPop .flr-pc').forEach(fx);
  new MutationObserver(scan).observe(document.body, { childList: true }); scan();
})();

/* ORBIT 451 — one minimise behaviour for every window: the window shrinks to its title bar and docks at the bottom-left corner
   (same place as the js/34 pop-ups); the restore / maximise button brings it back where it was. */
(function () {
  'use strict';
  const st = document.createElement('style');
  st.textContent = 'html body .sdb-dw.sdb-mini,html body .sdb-rw.sdb-mini,html body .sdb-mw.sdb-mini,html body .dst-ov.dst-mini .dst-win,html body #ttModal .tt-rw.tt-mini{position:fixed!important;left:10px!important;right:auto!important;top:auto!important;bottom:10px!important;width:440px!important;max-width:calc(100vw - 20px)!important;height:auto!important;min-height:0!important;max-height:none!important;transform:none!important;margin:0!important;overflow:hidden!important;z-index:100000!important;box-shadow:0 8px 24px rgba(0,0,0,.35)!important}html body .dst-ov.dst-mini .dst-wh{flex-wrap:nowrap;overflow:hidden}html body .dst-ov.dst-mini [data-dsth],html body .dst-ov.dst-mini .dst-wh .d,html body .dst-ov.dst-mini .dst-wh .ag-btn{display:none!important}html body .sdb-mini .sdb-dh small{display:none!important}';
  document.head.appendChild(st);
})();

/* ORBIT 453 — ❓ Help on every record / list / page window: a short guide to what the window shows and what each button does. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const G = {
    rec: { t: 'Record comparison — previous vs recent inspection', what: 'Each block puts the previous inspection of the same rack / unit (left) next to the recent one (right). Rows that changed are shaded, so you can see at a glance what is new.',
      parts: [['Chips (▲ New hit · Critical / Watch / Good)', 'The result of the recent inspection and the condition of the rack / unit (hits on record).'], ['🔍 Compare photos', 'Reads the photos of both inspections on your device, matches each recent photo with the most similar previous photo and marks the areas that changed. Verdict: ✅ looks the same (likely old damage) · ⚠ some differences · 🔴 differences found (possible new damage) · ❔ different views (compare by eye) · 🆕 no earlier photo.'], ['🤖 Ask AI to check (inside the photo comparison)', 'Optional: sends the photos of this one record to Google Gemini and shows its opinion (new / old / unclear). Needs a key in ⚙ AI settings; nothing is sent unless you press the button.'], ['📧 Take action — email', 'E-mails the observation (with the photos if you choose) to the team and records a line-manager action. Use ❓ Ask for clarification inside it to ask first without recording an action.'], ['📌 n action(s) taken', 'Line-manager actions already raised for this record.'], ['Photos', 'Click a photo to enlarge it; ‹ › moves between photos.'], ['— ▢ ✕ · drag the title bar · drag the edges', 'Minimise (docks bottom-left), maximise / restore, close, move and resize the window.']],
      tips: ['The photo analysis is a guide only: a different angle, distance or light lowers the confidence — the inspector decides.', 'Press Esc to close.'] },
    drill: { t: 'Records list', what: 'The records behind the number you clicked, with a search box. Click a row to open the record comparison (previous vs recent, with the photos).',
      parts: [['Search in these records…', 'Filters the table as you type.'], ['☰ Actions', 'Print · Print setup · Email (table + Excel) · Email to Civil & HSE / Email observations (with the attachments, as files or one ZIP) · Excel · corners style.'], ['Table', 'Drag the column edges to resize the columns; photo / attachment cells show thumbnails.'], ['— ▢ ✕', 'Minimise (docks bottom-left), maximise / restore, close. Drag the title bar to move, drag the edges to resize.']],
      tips: ['The e-mail windows keep the records you opened — they are preselected.'] },
    page: { t: 'Dashboard page window', what: 'A full page of the dashboard opened as a window — it keeps the filters of the dashboard behind it.',
      parts: [['☰ Actions', 'Excel · Email · Print · Print setup of the tables on this page.'], ['— ▢ ✕', 'Minimise (docks bottom-left), maximise / restore, close (back to the dashboard).'], ['Click a number', 'Opens the records behind it.']], tips: [] },
    digest: { t: 'E-mail observations', what: 'Builds one e-mail with the observations you tick, asks for the action required and saves them as line-manager actions.',
      parts: [['Scope / day', 'Choose which records are listed.'], ['Tick the observations', 'Only ticked ones are e-mailed.'], ['Attachments', 'Send the photos / files as separate files or as one ZIP (large sets are split into several e-mails).'], ['📧 Send & save', 'Sends the e-mail and records the actions.'], ['❓ Ask for clarification', 'Sends the amber clarification request — nothing is recorded yet.'], ['💾 Save actions only · 📦 Download ZIP · 📋 Copy · ✉ Plain-text', 'Save without sending, download the attachments, or use your own mail app.']], tips: [] }
  };
  function open(k) { const g = G[k]; if (!g) return; let m = document.querySelector('#winHelp'); if (m) m.remove(); m = document.createElement('div'); m.id = 'winHelp'; m.style.cssText = 'position:fixed;inset:0;z-index:2147483200;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px';
    m.innerHTML = '<div style="background:var(--card,#fff);color:var(--text,#0f172a);border-radius:14px;width:min(640px,100%);max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)"><div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border,#e2e8f0);position:sticky;top:0;background:inherit"><b style="flex:1;font-size:15px">❓ ' + esc(g.t) + '</b><button type="button" data-x style="cursor:pointer;border:1px solid var(--border,#cbd5e1);background:transparent;color:inherit;border-radius:8px;padding:4px 12px">✕ Close</button></div><div style="padding:14px 18px;font-size:13.5px;line-height:1.5"><p style="margin:0 0 10px">' + esc(g.what) + '</p>' + g.parts.map(p => '<div style="margin:0 0 8px"><b>' + esc(p[0]) + '</b><div style="color:var(--gray-600,#475569)">' + esc(p[1]) + '</div></div>').join('') + (g.tips.length ? '<div style="margin-top:10px;padding:8px 12px;border-radius:10px;background:#eff6ff;color:#1e3a8a">' + g.tips.map(t => '💡 ' + esc(t)).join('<br>') + '</div>' : '') + '</div></div>';
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-x]')) m.remove(); }); document.body.appendChild(m); }
  const kindOf = w => w.closest('#flrPop') ? (w.querySelector('[data-cmp]') || w.querySelector('.flr-pair') ? 'rec' : 'rec') : w.closest('#flrAct') ? 'digest' : w.matches('.dst-win') ? 'page' : w.closest('#sdbDrill') ? 'drill' : w.closest('#sdbRec') ? 'rec' : w.closest('#sdbMail') ? 'digest' : '';
  function mkBtn(k) { const b = document.createElement('button'); b.type = 'button'; b.className = 'wc-help'; b.textContent = '❓ Help'; b.title = 'What is this window? How do I use it?'; b.style.cssText = 'cursor:pointer;line-height:1;white-space:nowrap;border-radius:8px;border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.16);color:#fff;padding:6px 10px;font-size:12.5px;font-weight:600;flex:none;align-self:center;margin-left:auto'; b.addEventListener('click', e => { e.stopPropagation(); open(k); }); return b; }
  /* windows with a ☰ Actions list get "Help" as one of its entries (a hidden button in the Actions holder); the others keep a title-bar button */
  function inActions(w, k) { const acm = w.querySelector('[data-acm]'); if (!acm) return false; const hid = acm.parentNode.querySelector(':scope > .tm-hid'); if (!hid) return false; if (!hid.querySelector('[data-winhelp]')) { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-winhelp', '1'); b.textContent = '❓ Help'; b.title = 'What is this window? How do I use it?'; b.addEventListener('click', e => { e.stopPropagation(); open(k); }); hid.appendChild(b); } return true; }
  function scan() {
    document.querySelectorAll('#flrPop .flr-pc,#flrAct .flr-pc').forEach(w => { const bar = w.querySelector('.mdl-bar'); if (!bar || bar.querySelector('.wc-help')) return; const k = kindOf(w), ctl = bar.querySelector('.mdl-ctl'); if (!k || inActions(w, k)) return; const b = mkBtn(k); b.style.marginLeft = '0'; b.style.marginRight = '8px'; if (ctl) bar.insertBefore(b, ctl); else bar.appendChild(b); });
    document.querySelectorAll('.sdb-dw,.sdb-rw,.sdb-mw').forEach(w => { const k = kindOf(w); if (!k || inActions(w, k)) return; const trio = w.querySelector('.wc-trio'); if (!trio || trio.querySelector('.wc-help')) return; const b = mkBtn(k); b.style.marginLeft = '0'; b.style.marginRight = '6px'; trio.insertBefore(b, trio.firstChild); trio.style.alignItems = 'center'; });
    document.querySelectorAll('.dst-win').forEach(w => { if (inActions(w, 'page')) return; const c = w.querySelector('.dst-wc'); if (!c || c.querySelector('.wc-help')) return; const b = mkBtn('page'); b.style.marginLeft = '0'; b.style.marginRight = '6px'; c.insertBefore(b, c.firstChild); });
  }
  let t = 0; const sched = () => { if (t) return; t = setTimeout(() => { t = 0; try { scan(); } catch (e) {} }, 350); };
  function init() { try { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); } catch (e) {} sched(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.WINHELP = { open };
})();
