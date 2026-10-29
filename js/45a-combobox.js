/* ---------- searchable dropdown (combobox): <input data-cb="name"> — sources are registered with cbRegister(name, fn(input) → [{v, l}]) ---------- */
const CB_SRC = {};
function cbRegister(name, fn) { CB_SRC[name] = fn; }
(function () {
  const st = document.createElement('style'); st.textContent = `
input[data-cb],input[list]{width:100%;border:1px solid var(--gray-300,#c8c6c4);border-radius:6px;font-size:13px;font-family:inherit;background-color:var(--card,#fff);color:var(--gray-800,#323130);background-repeat:no-repeat;background-position:right 7px center;background-size:11px 7px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'><path d='M1 1l4.5 4.5L10 1' fill='none' stroke='%23605e5c' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg>")}
input[data-cb]:focus,input[list]:focus{outline:none;border-color:var(--brand,#0078d4);box-shadow:0 0 0 3px rgba(0,120,212,.15)}
input[data-cb]::-webkit-calendar-picker-indicator,input[list]::-webkit-calendar-picker-indicator{display:none!important}
table input[data-cb],table input[list]{min-width:120px!important}
#cbPanel{position:fixed;z-index:100000;background:var(--card,#fff);color:inherit;border:1px solid var(--border,#cbd5e1);border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.25);max-height:260px;overflow:auto;min-width:200px;font-size:13px;display:none}
#cbPanel div{padding:6px 10px;cursor:pointer;display:flex;gap:10px;justify-content:space-between;border-bottom:1px solid rgba(128,128,128,.12)}#cbPanel div:last-child{border-bottom:0}
#cbPanel div.on,#cbPanel div:hover{background:var(--brand-light,#e8f0fe)}#cbPanel small{color:var(--gray-600,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%}#cbPanel em{padding:8px 10px;display:block;color:var(--gray-600,#64748b)}`; document.head.appendChild(st);
  const P = document.createElement('div'); P.id = 'cbPanel'; document.body.appendChild(P);
  let cur = null, items = [], hi = -1, typed = false;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function paint() { const q = typed ? cur.value.trim().toLowerCase().split(/\s+/).filter(Boolean) : []; let all = []; try { const nm = cur.dataset.cb; if (nm.startsWith('dl:')) { const d = document.getElementById(nm.slice(3)); all = d ? [...d.options].map(o => ({ v: o.value, l: o.label && o.label !== o.value ? o.label : (o.textContent || '').trim() !== o.value ? (o.textContent || '').trim() : '' })) : []; } else all = (CB_SRC[nm] || (() => []))(cur) || []; } catch (e) {}
    items = all.filter(o => !q.length || q.every(t => (String(o.v) + ' ' + String(o.l || '')).toLowerCase().includes(t))).slice(0, 120); hi = items.length ? 0 : -1;
    P.innerHTML = items.length ? items.map((o, i) => `<div data-i="${i}" class="${i === hi ? 'on' : ''}"><b>${esc(o.v)}</b>${o.l ? '<small>' + esc(o.l) + '</small>' : ''}</div>`).join('') : `<em>${all.length ? 'No match' : 'No entries yet'}${cur.value.trim() ? ' — “' + esc(cur.value.trim()) + '” will be used as typed' : ''}</em>`; }
  function place() { const r = cur.getBoundingClientRect(); P.style.left = Math.max(4, Math.min(r.left, innerWidth - 220)) + 'px'; P.style.minWidth = Math.max(200, r.width) + 'px'; const below = innerHeight - r.bottom; if (below < 180 && r.top > below) { P.style.top = ''; P.style.bottom = (innerHeight - r.top + 2) + 'px'; } else { P.style.bottom = ''; P.style.top = (r.bottom + 2) + 'px'; } }
  function open(el, t) { cur = el; typed = !!t; paint(); place(); P.style.display = 'block'; }
  function close() { P.style.display = 'none'; cur = null; }
  function pick(i) { const o = items[i], el = cur; if (!o || !el) return; close(); el.value = o.v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  const upgrade = t => { if (t && t.matches && t.matches('input[list]') && !t.dataset.cb) { const id = t.getAttribute('list'); t.dataset.cb = 'dl:' + id; t.removeAttribute('list'); t.setAttribute('autocomplete', 'off'); } };
  document.addEventListener('focusin', e => upgrade(e.target), true); document.addEventListener('mousedown', e => upgrade(e.target), true);
  const isCb = t => t && t.matches && t.matches('input[data-cb]');
  document.addEventListener('focusin', e => { if (isCb(e.target) && !e.target.readOnly && !e.target.disabled) open(e.target, false); });
  document.addEventListener('click', e => { if (isCb(e.target) && cur !== e.target && !e.target.disabled) open(e.target, false); });
  document.addEventListener('input', e => { if (isCb(e.target)) { if (cur !== e.target) cur = e.target; typed = true; paint(); place(); P.style.display = 'block'; } });
  document.addEventListener('keydown', e => { if (!cur || P.style.display === 'none' || e.target !== cur) return; if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!items.length) return; hi = (hi + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; [...P.children].forEach((c, i) => c.classList.toggle('on', i === hi)); const c = P.children[hi]; if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && hi >= 0 && items.length) { e.preventDefault(); e.stopPropagation(); pick(hi); } else if (e.key === 'Escape') close(); else if (e.key === 'Tab') close(); }, true);
  P.addEventListener('mousedown', e => { e.preventDefault(); const d = e.target.closest('[data-i]'); if (d) pick(+d.dataset.i); });
  document.addEventListener('focusout', e => { if (isCb(e.target)) setTimeout(() => { if (document.activeElement !== cur) close(); }, 120); });
  addEventListener('resize', close); document.addEventListener('scroll', e => { if (cur && !P.contains(e.target)) { const r = cur.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) close(); else place(); } }, true);
})();
