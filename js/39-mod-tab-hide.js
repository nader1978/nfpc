
/* ---------- hide / show tabs on any page with a tab strip ---------- */
(function () {
  const Q = s => document.querySelector(s), SKIP = new Set(['dpDayTabs']);
  const KEY = () => LS_BASE + '_tabhide_' + ((typeof currentUser !== 'undefined' && currentUser && currentUser.id) || 'anon');
  const rd = () => { try { return JSON.parse(localStorage.getItem(KEY()) || '{}') || {}; } catch (e) { return {}; } };
  const wr = o => { try { localStorage.setItem(KEY(), JSON.stringify(o)); } catch (e) {} };
  const lab = b => (b.textContent || '').replace(/\s+/g, ' ').trim();
  const btns = s => [...s.querySelectorAll(':scope > button')].filter(b => !b.classList.contains('th-btn'));
  const st = document.createElement('style'); st.textContent = '.th-btn{border:1px solid var(--border);background:transparent;color:inherit;border-radius:999px;padding:2px 8px;font-size:12px;cursor:pointer;opacity:.75}.th-btn:hover{opacity:1}.th-hid{display:none!important}#tabHidePop{position:fixed;z-index:2147483000;background:var(--card-bg,#fff);color:var(--gray-800,#222);border:1px solid var(--border);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:10px 12px;min-width:240px;max-width:340px;font-size:13px}body.dark #tabHidePop{background:#1e293b;color:#e2e8f0}#tabHidePop label{display:flex;gap:8px;align-items:center;padding:4px 2px;cursor:pointer}#tabHidePop .th-h{font-weight:700;margin-bottom:4px}#tabHidePop .th-f{display:flex;gap:6px;margin-top:8px}';
  document.head.appendChild(st);
  let busy = false;
  function apply(s) {
    if (busy) return; busy = true; try {
      const hid = new Set(rd()[s.id] || []), bs = btns(s); bs.forEach(b => b.classList.toggle('th-hid', hid.has(lab(b))));
      const vis = bs.filter(b => !b.classList.contains('th-hid')), on = bs.find(b => b.classList.contains('on'));
      if (on && on.classList.contains('th-hid') && vis[0]) setTimeout(() => vis[0].click(), 0);
      const t = s.nextElementSibling; if (t && t.classList.contains('th-btn')) { t.style.display = bs.length > 1 ? '' : 'none'; t.textContent = hid.size ? '👁 Tabs (' + hid.size + ' hidden)' : '👁 Tabs'; }
    } finally { busy = false; }
  }
  function pop(s, anchor) {
    let p = Q('#tabHidePop'); if (p) { p.remove(); if (p._for === s) return; }
    p = document.createElement('div'); p.id = 'tabHidePop'; p._for = s; const all = btns(s).map(lab), hid = new Set(rd()[s.id] || []);
    p.innerHTML = '<div class="th-h">👁 Tabs on this page</div><div style="font-size:12px;opacity:.7;margin-bottom:4px">Untick a tab to hide it. Only on your account.</div>' + all.map(l => `<label><input type="checkbox" data-l="${escapeHtml(l)}" ${hid.has(l) ? '' : 'checked'}> ${escapeHtml(l)}</label>`).join('') + '<div class="th-f"><button type="button" class="ghost small" data-a="all">Show all</button><button type="button" class="ghost small" data-a="x">Close</button></div>';
    document.body.appendChild(p); const r = anchor.getBoundingClientRect(); p.style.top = Math.min(r.bottom + 6, innerHeight - p.offsetHeight - 10) + 'px'; p.style.left = Math.max(8, Math.min(r.left, innerWidth - p.offsetWidth - 10)) + 'px';
    p.onchange = e => { const c = e.target.closest('input[data-l]'); if (!c) return; const o = rd(), h = new Set(o[s.id] || []); if (c.checked) h.delete(c.dataset.l); else h.add(c.dataset.l);
      if (all.every(l => h.has(l))) { c.checked = true; h.delete(c.dataset.l); sectionToast('At least one tab must stay visible.', 'warn'); }
      if (h.size) o[s.id] = [...h]; else delete o[s.id]; wr(o); apply(s); };
    p.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'all') { const o = rd(); delete o[s.id]; wr(o); apply(s); p.remove(); } else p.remove(); };
  }
  function scan() {
    document.querySelectorAll('.view .pl-tabs[id]').forEach(s => {
      if (SKIP.has(s.id) || s._th) return; s._th = 1;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'th-btn'; b.title = 'Hide or show tabs on this page'; b.textContent = '👁 Tabs'; s.insertAdjacentElement('afterend', b);
      b.addEventListener('click', e => { e.stopPropagation(); pop(s, b); });
      new MutationObserver(() => apply(s)).observe(s, { childList: true }); apply(s);
    });
  }
  document.addEventListener('mousedown', e => { const p = Q('#tabHidePop'); if (p && !p.contains(e.target) && !e.target.closest('.th-btn')) p.remove(); });
  scan(); setTimeout(scan, 1500);
  new MutationObserver(() => scan()).observe(Q('.content'), { attributes: true, attributeFilter: ['class'], subtree: true });
})();
