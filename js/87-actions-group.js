/* PAGE TOOLBAR LAYOUT — "Option B" on every page and pop-up window:
     • title bar  : title + window controls only
     • toolbar strip under it : filters / selectors on the left, [Reload] [☰ Actions ▾] pinned to the RIGHT end
     • ☰ Actions  : the same grouped menu with the description panel (PRINT · SHARE & EXPORT · SETTINGS & VIEW · Cancel / Run)
   A crowded bar is folded automatically: the real buttons move into a hidden holder (.tm-hid) and the Actions menu of js/37 presses them. */
(function () {
  'use strict';
  const MAXV = 3;                                              /* pop-ups: more than this many plain buttons → Actions menu */
  const MAXP = 6;                                              /* pages: card-header bars fold from this many buttons */
  const POP = '.mdl-box,[data-mdl],#plBox,.dst-win,.sdb-dw,.sdb-rw,.sdb-mw,#tblExpandOverlay';
  const STRIP = '.pl-h,.mv-h,.rmv-h,.rps-h,.sdb-dh,.modal-header';                 /* title bars that also carry filters / buttons → split into title bar + strip */
  const SEL = '.pl-h,.modal-header,.sdb-dh,.ag-strip,.tm-acts,.ed-pbar,.card-header,.card-header .btn-row,.mdl-box .btn-row,[data-mdl] .btn-row';
  const KEEPK = 'success,primary,danger,warn,mdl-ctl,ag-btn,tm-menu,hc-btn,tbl-expand-btn'.split(',');
  const KEEPTXT = /^\W*(hide|show|add|new|save|post|reload|refresh|clear|back|apply|ok|grid|list|undo)\b/i;
  const RELOAD = /^\W*(reload|refresh)\b/i;
  const isClose = b => b.dataset.x !== undefined || b.dataset.close !== undefined || /^\s*(✕|✖|×)\s*(close|cancel)?\s*$/i.test(b.textContent) || /^\s*(✕|✖)?\s*close\s*$/i.test(b.textContent) || /^close$/i.test(b.title || '');
  const plain = b => b.tagName === 'BUTTON' && !KEEPTXT.test((b.textContent || '').trim()) && !KEEPK.some(k => b.classList.contains(k)) && !b.hasAttribute('data-acm') && !isClose(b) && b.style.display !== 'none' && !b.closest('.mdl-ctl,.mdl-ctlw,.tm-hid');
  let css = null;
  function styles() { if (css) return; css = document.createElement('style'); css.textContent = [
    '.ag-strip{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid var(--border,#e5e7eb);background:var(--card,#fff);color:var(--text,#111827)}',
    '.ag-strip select{width:auto;margin:0}.ag-strip input[type=search]{width:220px;margin:0}.ag-strip input,.ag-strip select{margin:0}',
    '.ag-strip>.ag-btn,.ag-bar>.ag-btn{margin-left:auto}',
    '.ag-btn{white-space:nowrap;display:inline-flex;align-items:center;gap:6px}',
    'html body .mdl-box [data-ag-strip="1"]{padding-right:150px!important;flex-wrap:nowrap!important;align-items:center!important}',
    'html body .mdl-box [data-ag-strip="1"] .ag-x{display:none!important}',
    '[data-ag-strip="1"]>:is(h1,h2,h3,h4,h5,h6){margin:0 auto 0 0!important}'
  ].join('\n'); document.head.appendChild(css); }

  /* 1) title bar → title + strip */
  function strip(c) {
    if (c.dataset.agStrip || !c.closest(POP) || c.classList.contains('ag-strip')) return;
    const kids = [...c.children].filter(k => k instanceof HTMLElement); if (kids.length < 3) return;
    const tOf = k => /^H[1-6]$/.test(k.tagName) || /^(B|STRONG)$/.test(k.tagName) || /title|ttl/i.test(k.className) || (k.firstElementChild && /^(H[1-6]|B|STRONG)$/.test(k.firstElementChild.tagName)), title = kids.find(tOf) || null;
    if (!title) return;                                                          /* a real title bar has a title */
    const keep = k => k === title || k.matches('.mdl-ctl,.mdl-ctlw') || (k.tagName === 'BUTTON' && isClose(k) && (k.classList.add('ag-x'), true));
    const rest = kids.filter(k => !keep(k)); if (!rest.length) return;
    styles(); const s = document.createElement('div'); s.className = 'ag-strip'; rest.forEach(k => s.appendChild(k)); c.after(s); c.dataset.agStrip = '1';
  }

  /* 2) crowded bar → Reload stays, everything else goes behind ☰ Actions ▾ (pinned to the right end) */
  function group(c) {
    if (c._agBusy || c.closest('#tmActMenu,.tm-hid')) return;
    if (c.querySelector(':scope > [data-acm], :scope > .tm-hid')) { if (!c.matches('.tm-acts')) pin(c); return; }                 /* the screen already has its own Actions menu */
    const btns = [...c.children].filter(plain);
    const had = c.querySelector(':scope > .ag-btn');
    const lim = c.closest(POP) ? MAXV : MAXP;
    if (!had && btns.length <= lim) return;
    if (had && !btns.length) { pin(c); return; }
    styles(); c._agBusy = true;
    try {
      let ab = had, holder = c.querySelector(':scope > .tm-hid');
      if (!ab) { ab = document.createElement('button'); ab.type = 'button'; ab.className = 'secondary small ag-btn'; ab.setAttribute('data-acm', '1'); ab.title = 'All actions of this window'; ab.innerHTML = '☰ Actions ▾'; holder = document.createElement('div'); holder.className = 'tm-hid'; holder.style.display = 'none'; c.appendChild(ab); c.appendChild(holder); }
      const rl = btns.filter(b => RELOAD.test((b.textContent || '').trim()));
      btns.forEach(b => { if (!RELOAD.test((b.textContent || '').trim())) holder.appendChild(b); });
      pin(c); void rl;
    } finally { c._agBusy = false; }
  }
  /* Reload (if any) immediately before Actions, both at the right end of the bar */
  function pin(c) { const ab = c.querySelector(':scope > .ag-btn, :scope > [data-acm]'); if (!ab) return; c.classList.add('ag-bar');
    const rl = [...c.children].find(b => b.tagName === 'BUTTON' && b !== ab && RELOAD.test((b.textContent || '').trim()));
    if (c.lastElementChild !== ab && !(c.lastElementChild && c.lastElementChild.classList.contains('tm-hid') && c.lastElementChild.previousElementSibling === ab)) { c.appendChild(ab); const h = c.querySelector(':scope > .tm-hid'); if (h) c.appendChild(h); }
    if (rl && rl.nextElementSibling !== ab) ab.before(rl);
    if (rl) { rl.style.marginLeft = 'auto'; ab.style.marginLeft = '0'; } else ab.style.marginLeft = 'auto'; }

  /* every pop-up's title bar: the first element of the window box (whatever its class is called: pl-h, mv-h, rmv-h, rps-h, …) */
  function heads() { const out = new Set(); document.querySelectorAll(POP).forEach(b => { const f = [...b.children].find(k => !k.matches('.mdl-ctlw,.mdl-ctl,style,script')); if (f) out.add(f); b.querySelectorAll(':scope > [class$="-h"],:scope > [class*="-head"]').forEach(x => out.add(x)); }); document.querySelectorAll('[id$="Box"] > div > [class$="-h"]').forEach(x => out.add(x)); document.querySelectorAll(STRIP).forEach(x => out.add(x)); return out; }
  function scan() { heads().forEach(c => { try { strip(c); } catch (e) {} }); document.querySelectorAll(SEL).forEach(c => { try { group(c); } catch (e) {} }); }
  let t = 0; const sched = () => { if (t) return; t = setTimeout(() => { t = 0; scan(); }, 150); };
  function init() { try { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); } catch (e) {} sched(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
