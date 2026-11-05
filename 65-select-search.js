/* ============================================================
   SEARCHABLE DROP-DOWNS — every <select> in the system (mouse click / Alt+↓ / F4) opens a list with a search box.
   The <select> itself stays: picking sets its value and fires the usual input + change events, so every screen keeps working.
   Small lists (fewer than 6 choices), multi-selects and <select data-nosearch> keep the normal drop-down.
   ============================================================ */
(function () {
  const MIN = 6, esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = document.createElement('style'); css.textContent = `
#ssPanel{position:fixed;z-index:2147483100;background:var(--card,#fff);color:var(--text,#1f2937);border:1px solid var(--border,#cbd5e1);border-radius:10px;box-shadow:0 14px 36px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;font-size:13px}
#ssPanel .ss-q{display:flex;align-items:center;gap:6px;padding:7px 8px;border-bottom:1px solid var(--border,#e2e8f0);background:var(--gray-50,#f8fafc)}
#ssPanel .ss-q input{flex:1;margin:0!important;padding:6px 8px!important;font-size:13px!important;border:1px solid var(--border,#cbd5e1);border-radius:7px;min-width:0;width:auto!important;background:var(--card,#fff);color:inherit}
#ssPanel .ss-n{font-size:11px;color:var(--gray-600,#64748b);white-space:nowrap}
#ssPanel .ss-l{overflow:auto;padding:4px}
#ssPanel .ss-o{padding:6px 9px;border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ssPanel .ss-o.on{background:var(--brand,#1e3a8a);color:#fff}#ssPanel .ss-o.cur:not(.on){background:var(--brand-light,#dbeafe);font-weight:600}
#ssPanel .ss-o.dis{opacity:.45;cursor:default}#ssPanel .ss-g{padding:6px 9px 2px;font-size:11px;font-weight:700;color:var(--gray-600,#64748b);text-transform:uppercase;letter-spacing:.04em}
#ssPanel .ss-o mark{background:#fde68a;color:inherit;border-radius:2px;padding:0}#ssPanel .ss-e{padding:12px;color:var(--gray-600,#64748b);text-align:center}
select.ss-on{cursor:pointer}`;
  document.head.appendChild(css);
  let P = null, cur = null, items = [], hi = -1;
  const ok = s => s && s.tagName === 'SELECT' && !s.multiple && !s.disabled && !s.dataset.nosearch && !s.closest('[data-nosearch]') && s.options.length >= MIN;
  function close(focus) { if (!P) return; P.remove(); P = null; document.removeEventListener('mousedown', out, true); window.removeEventListener('resize', onWin, true); if (window.visualViewport) visualViewport.removeEventListener('resize', onWin); document.removeEventListener('scroll', onScroll, true); if (focus && cur && cur.isConnected) try { cur.focus({ preventScroll: true }); } catch (e) {} cur = null; }
  const out = e => { if (P && !P.contains(e.target) && e.target !== cur) close(false); };
  /* phones: the keyboard opening resizes and scrolls the page — keep the list open and move it with its drop-down; close only when the width changes (rotation) or the drop-down leaves the screen */
  let W0 = 0, T0 = 0;
  function place() { if (!P || !cur) return; const r = cur.getBoundingClientRect(), vh = (window.visualViewport && visualViewport.height) || innerHeight, W = Math.min(Math.max(r.width, 240), Math.max(240, innerWidth - 16)), below = vh - r.bottom - 10, above = r.top - 10, H = Math.min(360, Math.max(below, above));
    P.style.width = W + 'px'; P.style.left = Math.max(8, Math.min(r.left, innerWidth - W - 8)) + 'px'; P.querySelector('.ss-l').style.maxHeight = (Math.max(140, H) - 46) + 'px';
    if (below >= 220 || below >= above) { P.style.top = (r.bottom + 2) + 'px'; P.style.bottom = ''; } else { P.style.top = ''; P.style.bottom = (innerHeight - r.top + 2) + 'px'; } }
  const onWin = () => { if (!P) return; if (Math.abs(innerWidth - W0) > 40) close(false); else place(); },
    onScroll = e => { if (!P || P.contains(e.target)) return; const r = cur && cur.getBoundingClientRect(); if (!r || ((r.bottom < 0 || r.top > innerHeight) && Date.now() - T0 > 1500)) close(false); else place(); };
  function pick(i) { const it = items[i]; if (!it || it.dis || !cur) return; const s = cur; close(true); if (s.selectedIndex !== it.idx) { s.selectedIndex = it.idx; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); } }
  function draw(q) {
    const L = P.querySelector('.ss-l'), words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean), mk = t => { const lo = t.toLowerCase(), on = new Array(t.length).fill(false); words.forEach(w => { let k = lo.indexOf(w); while (k >= 0) { for (let j = k; j < k + w.length; j++) on[j] = true; k = lo.indexOf(w, k + 1); } }); let h = '', inM = false; for (let j = 0; j < t.length; j++) { if (on[j] !== inM) { h += on[j] ? '<mark>' : '</mark>'; inM = on[j]; } h += esc(t[j]); } return h + (inM ? '</mark>' : ''); };
    const vis = items.filter(it => !words.length || words.every(w => it.t.toLowerCase().includes(w) || String(it.v).toLowerCase().includes(w)));
    let html = '', g = null; vis.forEach(it => { if (it.g !== g) { g = it.g; if (g) html += `<div class="ss-g">${esc(g)}</div>`; } html += `<div class="ss-o${it.dis ? ' dis' : ''}${it.idx === cur.selectedIndex ? ' cur' : ''}" data-i="${items.indexOf(it)}" title="${esc(it.t)}">${mk(it.t) || '&nbsp;'}</div>`; });
    L.innerHTML = html || '<div class="ss-e">No match</div>'; P.querySelector('.ss-n').textContent = words.length ? vis.length + ' / ' + items.length : items.length + ' items';
    hi = -1; const first = vis.find(it => !it.dis && (words.length || it.idx === cur.selectedIndex)) || vis.find(it => !it.dis); if (first) setHi(items.indexOf(first), true);
  }
  function setHi(i, scroll) { if (!P) return; P.querySelectorAll('.ss-o.on').forEach(x => x.classList.remove('on')); const el = P.querySelector(`.ss-o[data-i="${i}"]`); if (!el) return; hi = i; el.classList.add('on'); if (scroll) el.scrollIntoView({ block: 'nearest' }); }
  function move(d) { const els = [...P.querySelectorAll('.ss-o:not(.dis)')]; if (!els.length) return; let k = els.findIndex(x => +x.dataset.i === hi); k = k < 0 ? 0 : Math.max(0, Math.min(els.length - 1, k + d)); setHi(+els[k].dataset.i, true); }
  const touchy = () => { try { return matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } };
  function open(s) {
    close(false); cur = s; items = [...s.options].map((o, idx) => ({ idx, v: o.value, t: (o.label || o.textContent || '').replace(/\s+/g, ' ').trim(), dis: o.disabled || o.hidden, g: o.parentElement && o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : '' })).filter(it => !(it.dis && it.t === ''));
    P = document.createElement('div'); P.id = 'ssPanel'; P.dataset.nohc = '1';
    P.innerHTML = `<div class="ss-q"><span>🔍</span><input type="text" placeholder="Search…" autocomplete="off" spellcheck="false"><span class="ss-n"></span></div><div class="ss-l"></div>`;
    document.body.appendChild(P); W0 = innerWidth; T0 = Date.now(); place();
    const q = P.querySelector('input'); draw(''); if (!touchy()) q.focus();   /* on a phone the keyboard opens only when the user taps 🔍 Search */
    q.addEventListener('input', () => draw(q.value));
    q.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); move(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); } else if (e.key === 'PageDown') { e.preventDefault(); move(8); } else if (e.key === 'PageUp') { e.preventDefault(); move(-8); }
      else if (e.key === 'Enter') { e.preventDefault(); if (hi >= 0) pick(hi); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } else if (e.key === 'Tab') { close(false); } });
    P.addEventListener('mousedown', e => { if (e.target !== q) e.preventDefault(); });
    P.addEventListener('click', e => { const o = e.target.closest('.ss-o'); if (o) pick(+o.dataset.i); });
    P.addEventListener('mousemove', e => { const o = e.target.closest('.ss-o:not(.dis)'); if (o && +o.dataset.i !== hi) setHi(+o.dataset.i, false); });
    setTimeout(() => { document.addEventListener('mousedown', out, true); window.addEventListener('resize', onWin, true); document.addEventListener('scroll', onScroll, true); if (window.visualViewport) visualViewport.addEventListener('resize', onWin); }, 0);
  }
  /* mouse: open our list instead of the native one (touch screens keep the phone's own picker) */
  document.addEventListener('mousedown', e => { if (e.button !== 0) return; const s = e.target.closest && e.target.closest('select'); if (!ok(s)) return; e.preventDefault(); if (P && cur === s) { close(true); return; } try { s.focus({ preventScroll: true }); } catch (x) {} open(s); }, true);
  /* keyboard: Alt+↓ / F4 / Enter / Space on a focused drop-down opens the search list; typing letters still jumps as usual */
  document.addEventListener('keydown', e => { const s = e.target; if (!ok(s) || P) return; if ((e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) || e.key === 'F4' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(s); } }, true);
  /* mark them (cursor) */
  const mark = () => document.querySelectorAll('select:not(.ss-on)').forEach(s => { if (ok(s)) { s.classList.add('ss-on'); if (!s.title) s.title = 'Click to choose — you can search in the list'; } });
  setInterval(mark, 2000); setTimeout(mark, 1200);
  window.ssOpen = open;
})();
