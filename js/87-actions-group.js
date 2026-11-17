/* ACTIONS GROUP — a header / tool bar with too many buttons is folded into ONE "☰ Actions ▾" button that opens a drop-down list
   (the real buttons stay in place, hidden; choosing an item presses the real button). Applies automatically to every pop-up window
   and to the card headers of the pages, so a crowded bar never overlaps the window controls (— ▢ ✕) or wraps over the content. */
(function () {
  'use strict';
  const MAXV = 4;                                              /* more than this many plain buttons in a bar → fold them */
  const SEL = '.pl-h,.modal-header,.tm-head,.tm-acts,.sdb-dh,.dst-wh,.mdl-bar,.ed-pbar,.card-header,.card-header .btn-row,.mdl-box .btn-row,[data-mdl] .btn-row,#plBox .pl-c>div';
  const KEEP = 'success,primary,danger,warn,mdl-ctl,ag-menu,tm-menu,hc-btn,tbl-expand-btn'.split(',');
  const isClose = b => b.dataset.x !== undefined || b.dataset.close !== undefined || /^\s*(✕|✖|×|x)\s*(close|cancel)?\s*$/i.test(b.textContent) || /^close$/i.test(b.title || '') || /^\s*(✕|✖)?\s*close\s*$/i.test(b.textContent);
  const KEEPTXT = /^\W*(hide|show|add|new|save|post|reload|refresh|clear|back|apply|ok)\b/i;
  const plain = b => b.tagName === 'BUTTON' && !KEEPTXT.test((b.textContent || '').trim()) && !b.classList.contains('ag-hid') && !b.classList.contains('ag-btn') && !KEEP.some(k => b.classList.contains(k)) && !b.hasAttribute('data-acm') && !isClose(b) && b.style.display !== 'none' && !b.closest('.mdl-ctl,.mdl-ctlw');
  const label = b => { const t = (b.textContent || '').replace(/\s+/g, ' ').trim(); return t || b.title || 'Action'; };
  let css = null;
  function styles() { if (css) return; css = document.createElement('style'); css.textContent = [
    '.ag-hid{display:none!important}',
    '.ag-btn{white-space:nowrap}',
    '#agMenu{position:fixed;z-index:2147483200;min-width:230px;max-width:min(380px,96vw);max-height:72vh;overflow:auto;background:var(--card,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);border-radius:14px;box-shadow:0 18px 40px rgba(15,23,42,.3);padding:6px;font-family:inherit}',
    '#agMenu button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:9px;width:100%;padding:9px 12px;border-radius:9px;font-size:13.5px;font-weight:500;cursor:pointer;color:inherit}',
    '#agMenu button:hover,#agMenu button:focus-visible{background:var(--brand-light,#dbeafe);color:var(--brand,#1e3a8a)}',
    '#agMenu button[disabled]{opacity:.45;pointer-events:none}',
    '#agMenu .ag-h{font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;padding:6px 12px 3px}',
    'html body .mdl-box .pl-h{padding-right:150px!important}'
  ].join('\n'); document.head.appendChild(css); }
  function group(c) {
    if (c._agBusy || c.closest('#agMenu,#tmActMenu')) return;
    if (c.querySelector(':scope > [data-acm], :scope > .tm-hid')) return;              /* that screen already has its own Actions menu */
    const btns = [...c.children].filter(plain);
    const had = c.querySelector(':scope > .ag-btn');
    const lim = c.closest('.mdl-box,[data-mdl],#plBox,.dst-win,.sdb-dw,.sdb-rw,.sdb-mw,#tblExpandOverlay') ? MAXV : 6;   /* pop-ups fold earlier than page bars */
    if (!had && btns.length <= lim) return;
    if (had && !btns.length) return;
    styles(); c._agBusy = true;
    try { let ab = had; if (!ab) { ab = document.createElement('button'); ab.type = 'button'; ab.className = 'secondary small ag-btn'; ab.textContent = '☰ Actions ▾'; ab.title = 'All actions of this window'; btns[0].before(ab); }
      btns.forEach(b => b.classList.add('ag-hid')); }
    finally { c._agBusy = false; }
  }
  function scan() { document.querySelectorAll(SEL).forEach(c => { try { group(c); } catch (e) {} }); }
  let t = 0; const sched = () => { if (t) return; t = setTimeout(() => { t = 0; scan(); }, 150); };
  function closeMenu() { const m = document.querySelector('#agMenu'); if (m) m.remove(); }
  window.addEventListener('click', e => {
    const ab = e.target.closest && e.target.closest('.ag-btn'); const m0 = document.querySelector('#agMenu');
    if (m0 && !e.target.closest('#agMenu')) { closeMenu(); if (ab) { e.preventDefault(); e.stopPropagation(); return; } }
    if (!ab) return; e.preventDefault(); e.stopPropagation();
    const c = ab.parentNode, hid = [...c.children].filter(b => b.classList.contains('ag-hid') && b.tagName === 'BUTTON' && b.style.display !== 'none'); if (!hid.length) return;
    const m = document.createElement('div'); m.id = 'agMenu';
    hid.forEach((b, i) => { const it = document.createElement('button'); it.type = 'button'; it.textContent = label(b); if (b.title) it.title = b.title; if (b.disabled) it.disabled = true; it.dataset.i = i; m.appendChild(it); });
    document.body.appendChild(m); const r = ab.getBoundingClientRect(), W = m.offsetWidth, H = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(r.right - W, innerWidth - W - 8)) + 'px'; m.style.top = (r.bottom + 6 + H > innerHeight ? Math.max(8, r.top - H - 6) : r.bottom + 6) + 'px';
    m.addEventListener('click', ev => { const it = ev.target.closest('button[data-i]'); if (!it) return; const real = hid[+it.dataset.i]; closeMenu(); if (real) setTimeout(() => real.click(), 0); });
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  addEventListener('resize', closeMenu);
  function init() { try { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); } catch (e) {} sched(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
