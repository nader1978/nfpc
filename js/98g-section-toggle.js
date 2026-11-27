/* ============================================================
   ▾ Hide / ▸ Show for every section of every page
   • cards (.card) already have their own ▾ Hide button (js/34) — this file adds the same for the other section blocks
     (the sub-sections of the Warehouse / RMPM / Master-data screens … any block with a heading) and a page-level
     "☰ Sections" button in the top bar: Hide all sections / Show all sections of the page you are on.
   • remembered per user, per page and per section title.
   ============================================================ */
(function () {
  const Q = s => document.querySelector(s), QA = (s, r) => [...(r || document).querySelectorAll(s)];
  const SEL = '.wm-sec,.rp-sec,.wd-sec,.md-sec,.g5-sec,.dv-sec,.pg-sec,section.sx';
  const base = () => (typeof LS_BASE !== 'undefined' ? LS_BASE : 'orbit') + '_sx_';
  const get = k => { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } }, put = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { } };
  const css = document.createElement('style'); css.textContent = `
.sx-collapsed>:not(.sx-hd){display:none!important}.sx-hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sx-btn{margin-left:auto;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:7px;border:1px solid var(--border,#cbd5e1);background:var(--card,#fff);color:var(--gray-700,#334155);cursor:pointer;line-height:1.3}
.sx-btn:hover{background:var(--gray-100,#f1f5f9)}
#sxAll{width:auto;padding:0 10px;font-size:13px}
#sxMenu{position:fixed;z-index:2147483000;background:var(--card,#fff);color:var(--text,#111827);border:1px solid var(--border,#cbd5e1);border-radius:10px;box-shadow:0 12px 30px rgba(15,23,42,.25);padding:6px;min-width:210px}
#sxMenu button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:8px 10px;border-radius:7px;font-size:13px;cursor:pointer;color:inherit}#sxMenu button:hover{background:var(--gray-100,#f1f5f9)}`;
  document.head.appendChild(css);
  const view = () => Q('.view.active');
  const headOf = s => { const h = [...s.children].find(c => /^(H[1-6])$/.test(c.tagName) || /(^|\s)(card-title|sec-title|sec-h|sx-h)(\s|$)/.test(c.className)); return h || null; };
  const keyOf = (s, h) => { const v = s.closest('.view'); return base() + (v ? v.id : '') + '_' + h.textContent.replace(/\s+/g, ' ').trim().slice(0, 40); };
  function scan() {
    const v = view(); if (!v) return;
    QA(SEL, v).forEach(s => { if (s.dataset.sx || s.closest('[id$="Modal"],#tblExpandOverlay,.fd-modal,.md-ov')) return; const h = headOf(s); if (!h || s.children.length < 2) return; s.dataset.sx = '1';
      h.classList.add('sx-hd'); const k = keyOf(s, h), b = document.createElement('button'); b.type = 'button'; b.className = 'sx-btn';
      const set = on => { s.classList.toggle('sx-collapsed', on); b.textContent = on ? '▸ Show' : '▾ Hide'; b.title = on ? 'Show this section' : 'Hide this section (only the title stays)'; }; set(get(k));
      b.addEventListener('click', e => { e.stopPropagation(); const on = !s.classList.contains('sx-collapsed'); set(on); put(k, on); }); b._set = set; b._k = k; h.appendChild(b); });
    if (!Q('#sxAll')) { const a = Q('.topbar-actions'); if (a) { const b = document.createElement('button'); b.id = 'sxAll'; b.type = 'button'; b.className = 'icon-btn'; b.textContent = '☰ Sections'; b.title = 'Hide or show all the sections of this page'; b.addEventListener('click', menu); a.insertBefore(b, a.firstChild); } }
  }
  function all(hide) { const v = view(); if (!v) return;
    QA('.cc-btn', v).forEach(b => { const c = b.closest('.card,.ro-card'); if (c && c.classList.contains('cc-collapsed') !== hide) b.click(); });
    QA('.sx-btn', v).forEach(b => { const s = b.closest('[data-sx]'); if (s && s.classList.contains('sx-collapsed') !== hide) b.click(); }); }
  function menu(e) { e.stopPropagation(); const o = Q('#sxMenu'); if (o) return o.remove(); const m = document.createElement('div'); m.id = 'sxMenu'; const r = e.currentTarget.getBoundingClientRect(); m.style.top = r.bottom + 6 + 'px'; m.style.right = Math.max(8, innerWidth - r.right) + 'px';
    m.innerHTML = '<button data-h="1">▸ Hide all sections of this page</button><button data-h="0">▾ Show all sections of this page</button>'; document.body.appendChild(m);
    m.addEventListener('click', ev => { const b = ev.target.closest('button[data-h]'); if (!b) return; all(b.dataset.h === '1'); m.remove(); });
    setTimeout(() => document.addEventListener('click', function f() { document.removeEventListener('click', f); m.remove(); }), 0); }
  let t = null; new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 300); }).observe(document.body, { childList: true, subtree: true }); document.addEventListener('click', () => setTimeout(scan, 350)); setTimeout(scan, 1000);
  window.SXT = { scan, all };
})();
