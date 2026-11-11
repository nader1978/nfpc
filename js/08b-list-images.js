/* ============================================================
   🖼 Images from SharePoint lists in every ORBIT table.
   A table cell that holds a picture-column value — the JSON SharePoint returns for an Image column
   ({"fileName":…,"serverRelativeUrl":…}), a Hyperlink/Picture value ({Url}) or a plain link to an image —
   is shown as a thumbnail (loaded with the SharePoint sign-in, only when it scrolls into view).
   Click a thumbnail → full-size viewer with ‹ › for the other images of the table, download and open in SharePoint.
   ============================================================ */
(function () {
  'use strict';
  const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)(\?|#|$)/i;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const origin = () => { try { return new URL(getGlobalSiteUrl()).origin; } catch (e) { return ''; } };
  const spTok = () => { try { return (typeof sp_token === 'function' && sp_token()) || getGlobalAccessToken() || ''; } catch (e) { return ''; } };
  const css = document.createElement('style'); css.textContent = `
.lim-cell{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.lim-th{width:44px;height:44px;border-radius:8px;border:1px solid var(--border,#e2e8f0);background:var(--gray-100,#f1f5f9) center/cover no-repeat;cursor:zoom-in;display:inline-flex;align-items:center;justify-content:center;font-size:16px;color:#94a3b8;flex:none;overflow:hidden;transition:transform .12s}
.lim-th:hover{transform:scale(1.06);box-shadow:0 4px 12px rgba(15,23,42,.18)}.lim-th.err{cursor:pointer;font-size:12px}
#limView{position:fixed;inset:0;z-index:2147483150;background:rgba(10,15,30,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;gap:10px}
#limView img{max-width:94vw;max-height:78vh;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.5);background:#fff}
#limView .lv-bar{display:flex;gap:10px;align-items:center;color:#e2e8f0;font-size:13px;flex-wrap:wrap;justify-content:center}
#limView button,#limView a.lv-b{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:7px 14px;cursor:pointer;font-size:13px;text-decoration:none}

.lim-att{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px;min-height:20px}.lim-att .lim-th{width:64px;height:64px}.lim-att.sm .lim-th{width:40px;height:40px}.lim-att .lim-n{font-size:11.5px;color:var(--gray-500,#94a3b8)}.lim-att .lim-doc{font-size:12px;border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:4px 8px;cursor:pointer;text-decoration:none;color:inherit}
#limView .lv-nav{position:absolute;top:50%;transform:translateY(-50%);font-size:26px;padding:10px 16px}#limView .lv-p{left:14px}#limView .lv-n{right:14px}`;
  document.head.appendChild(css);

  /* ---------- what is an image value ---------- */
  function parse(txt) { const t = String(txt || '').trim(); if (!t) return null;
    if (t[0] === '{' && /serverRelativeUrl|"url"|"Url"/i.test(t)) { let o; try { o = JSON.parse(t); } catch (e) { return null; }
      const rel = o.serverRelativeUrl || o.ServerRelativeUrl, url = o.Url || o.url, srv = o.serverUrl || '';
      if (rel) return [{ name: o.fileName || rel.split('/').pop(), rel, abs: srv ? srv.replace(/\/+$/, '') + rel : '' }];
      if (url && IMG_EXT.test(url)) return [{ name: o.Description || url.split('/').pop(), abs: url }]; return null; }
    if (/^data:image\/[a-z+]+;base64,/i.test(t)) return [{ name: 'photo', abs: t }];
    if (/^https?:\/\/\S+$/i.test(t) && IMG_EXT.test(t)) return [{ name: decodeURIComponent(t.split('/').pop().split('?')[0]), abs: t }];
    return null; }
  /* ---------- loading (SharePoint needs the sign-in → blob URL; other sites load directly) ---------- */
  const cache = new Map();
  function srcOf(a) { const url = a.rel ? origin() + a.rel : a.abs; if (!url) return Promise.reject(new Error('no address'));
    if (cache.has(url)) return cache.get(url);
    const sp = /\.sharepoint\.com/i.test(url);
    const p = !sp ? Promise.resolve(url) : (async () => {
      const tok = spTok(); if (!tok) throw new Error('sign in to SharePoint');
      let r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } }).catch(() => null);
      if (!r || !r.ok) { const site = (getGlobalSiteUrl() || '').replace(/\/+$/, ''), rel = a.rel || new URL(url).pathname; r = await fetch(`${site}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(decodeURIComponent(rel)).replace(/'/g, "''")}')/$value`, { headers: { Authorization: 'Bearer ' + tok } }).catch(() => null); }
      if (!r || !r.ok) throw new Error(r ? 'HTTP ' + r.status : 'network error');
      return URL.createObjectURL(await r.blob()); })();
    cache.set(url, p); p.catch(() => cache.delete(url)); return p; }
  const linkOf = a => a.rel ? origin() + a.rel : a.abs;
  /* ---------- thumbnails: only load when visible ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } }), { rootMargin: '200px' }) : null;
  function load(el) { const a = el._img; srcOf(a).then(u => { el.style.backgroundImage = `url("${u}")`; el.textContent = ''; el._src = u; }).catch(e => { el.classList.add('err'); el.textContent = '🖼'; el.title = a.name + ' — ' + e.message + ' (click to open in SharePoint)'; }); }
  function thumbs(cell, list) { cell.dataset.limDone = '1'; cell.title = list.map(a => a.name).join(', ');
    const w = document.createElement('div'); w.className = 'lim-cell';
    list.forEach(a => { const t = document.createElement('span'); t.className = 'lim-th'; t._img = a; t.textContent = '⏳'; t.title = a.name; w.appendChild(t); if (io) io.observe(t); else load(t); });
    cell.textContent = ''; cell.appendChild(w); }
  /* ---------- 📷 photo strip of a list item's attachments: <div class="lim-att" data-list="title or guid" data-item="id"> ---------- */
  const attC = new Map();
  async function attOf(list, id) { const k = list + '|' + id; if (attC.has(k)) return attC.get(k);
    const p = (async () => { const tok = spTok(), site = (getGlobalSiteUrl() || '').replace(/\/+$/, ''); if (!tok || !site) throw new Error('sign in to SharePoint');
      const L = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(list) ? `lists(guid'${list}')` : `lists/getbytitle('${encodeURIComponent(list).replace(/'/g, "''")}')`;
      const r = await fetch(`${site}/_api/web/${L}/items(${+id})/AttachmentFiles`, { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json;odata=nometadata' } });
      if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'no SharePoint access (sign in again)' : 'HTTP ' + r.status);
      return ((await r.json()).value || []).map(a => ({ name: a.FileName, rel: a.ServerRelativeUrl })); })();
    attC.set(k, p); p.catch(() => attC.delete(k)); return p; }
  function attLoad(box) { const max = +box.dataset.max || 12, quiet = box.dataset.quiet === '1';
    attOf(box.dataset.list, box.dataset.item).then(L => { box.textContent = ''; const img = L.filter(a => IMG_EXT.test(a.name)), doc = L.filter(a => !IMG_EXT.test(a.name));
      if (!L.length) { if (quiet) box.style.display = 'none'; else box.innerHTML = '<span class="lim-n">📷 no photos</span>'; return; }
      img.slice(0, max).forEach(a => { const t = document.createElement('span'); t.className = 'lim-th'; t._img = a; t.textContent = '⏳'; t.title = a.name; box.appendChild(t); if (io) io.observe(t); else load(t); });
      if (img.length > max) box.insertAdjacentHTML('beforeend', `<span class="lim-n">+${img.length - max} more</span>`);
      doc.forEach(a => { const d = document.createElement('a'); d.className = 'lim-doc'; d.textContent = '📄 ' + a.name; d.href = '#'; d.addEventListener('click', e => { e.preventDefault(); srcOf(a).then(u => { const x = document.createElement('a'); x.href = u; x.download = a.name; document.body.appendChild(x); x.click(); x.remove(); }).catch(er => window.open(linkOf(a), '_blank')); }); box.appendChild(d); }); })
      .catch(e => { box.innerHTML = quiet ? '' : `<span class="lim-n" title="${esc(e.message)}">📷 photos not available — ${esc(e.message)}</span>`; }); }
  const aio = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { aio.unobserve(e.target); attLoad(e.target); } }), { rootMargin: '150px' }) : null;
  const attSeen = new WeakSet();
  function attScan(root) { (root || document).querySelectorAll('.lim-att').forEach(b => { if (attSeen.has(b) || b.dataset.limSkip) return; attSeen.add(b); if (!b.dataset.list || !b.dataset.item) return; if (!b.dataset.quiet) b.innerHTML = '<span class="lim-n">📷 …</span>'; if (aio) aio.observe(b); else attLoad(b); }); }
  const ph = (list, id, o) => list && id ? `<div class="lim-att${o && o.sm ? ' sm' : ''}" data-list="${esc(list)}" data-item="${esc(id)}"${o && o.max ? ' data-max="' + o.max + '"' : ''}${o && o.quiet ? ' data-quiet="1"' : ''}></div>` : '';
  /* ---------- scan tables ---------- */
  const seen = new WeakSet();
  function scan(root) { (root || document).querySelectorAll('td, .ed-card-v, .card-val, dd').forEach(td => {
      if (seen.has(td) || td.dataset.limDone || td.closest('#limView,#orbAlert,.lim-att')) return; seen.add(td);
      if (td.querySelector('input,select,textarea,button')) return;
      const a = td.querySelector('a[href]'); if (a && td.children.length === 1 && IMG_EXT.test(a.getAttribute('href'))) { const l = parse(a.href); if (l) return thumbs(td, l); }
      if (td.children.length) return; const t = td.textContent; if (!t || (t.length > 2000 && !/^\s*data:image\//.test(t))) return; const c = t.trimStart()[0]; if (c !== '{' && c !== 'h' && c !== 'H' && c !== 'd') return;
      const l = parse(t); if (l) thumbs(td, l); }); }
  let tm = 0; const mo = new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(() => { scan(document.querySelector('.view.active') || document.body); attScan(document.body); }, 120); });
  const start = () => { mo.observe(document.body, { childList: true, subtree: true }); scan(document.body); attScan(document.body); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ---------- viewer ---------- */
  function view(el) { const tbl = el.closest('.lim-att') || el.closest('table') || el.closest('.view') || document.body, all = [...tbl.querySelectorAll('.lim-th')]; let i = Math.max(0, all.indexOf(el));
    const old = document.querySelector('#limView'); if (old) old.remove(); const v = document.createElement('div'); v.id = 'limView'; v.dataset.nohc = '1';
    const draw = () => { const t = all[i], a = t._img; v.innerHTML = `<img alt="" src="${t._src || ''}"><div class="lv-bar"><b>${esc(a.name)}</b>${all.length > 1 ? ` · ${i + 1} / ${all.length}` : ''}${t._src ? `<a class="lv-b" href="${t._src}" download="${esc(a.name)}">⬇ Download</a>` : ''}<a class="lv-b" href="${esc(linkOf(a))}" target="_blank" rel="noopener">↗ Open in SharePoint</a><button type="button" data-lv="x">✕ Close</button></div>${all.length > 1 ? '<button type="button" class="lv-nav lv-p" data-lv="p">‹</button><button type="button" class="lv-nav lv-n" data-lv="n">›</button>' : ''}`;
      if (!t._src) srcOf(a).then(u => { t._src = u; if (all[i] === t) draw(); }).catch(e => { const im = v.querySelector('img'); if (im) im.replaceWith(Object.assign(document.createElement('div'), { textContent: '⚠ ' + e.message + ' — use “Open in SharePoint”', style: 'color:#fff;padding:30px' })); }); };
    const close = () => { v.remove(); document.removeEventListener('keydown', key, true); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'ArrowRight' && all.length > 1) { i = (i + 1) % all.length; draw(); } else if (e.key === 'ArrowLeft' && all.length > 1) { i = (i - 1 + all.length) % all.length; draw(); } };
    v.addEventListener('click', e => { const b = e.target.closest('[data-lv]'); if (e.target === v || (b && b.dataset.lv === 'x')) return close(); if (b && b.dataset.lv === 'n') { i = (i + 1) % all.length; draw(); } if (b && b.dataset.lv === 'p') { i = (i - 1 + all.length) % all.length; draw(); } });
    document.addEventListener('keydown', key, true); document.body.appendChild(v); draw(); }
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('.lim-th'); if (!t) return; e.preventDefault(); e.stopPropagation(); view(t); }, true);
  /* the photos of list items as e-mail attachments (resized to max 1600 px JPEG so a mail stays under the ~3 MB Graph limit) */
  async function shrink(blob) { try { const bm = await createImageBitmap(blob), k = Math.min(1, 1600 / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); return await new Promise(r => c.toBlob(b => r(b || blob), 'image/jpeg', .82)); } catch (e) { return blob; } }
  const b64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
  async function mailAtts(list, ids, max) { max = max || 8; const out = []; let tot = 0;
    for (const id of ids) { let L = []; try { L = await attOf(list, id); } catch (e) { continue; }
      for (const a of L.filter(x => IMG_EXT.test(x.name))) { if (out.length >= max) break; try { const u = await srcOf(a), raw = await (await fetch(u)).blob(), sm = await shrink(raw), d = await b64(sm); if (tot + d.length > 3000000) break; tot += d.length; out.push({ fileName: a.name.replace(/\.(png|gif|webp|bmp|heic|heif)$/i, '.jpg'), dataB64: d, contentType: sm.type || 'image/jpeg' }); } catch (e) {} } }
    return out; }
  async function fileAtts(files, max) { const out = []; let tot = 0; for (const f of [...(files || [])].slice(0, max || 8)) { try { const sm = await shrink(f), d = await b64(sm); if (tot + d.length > 3000000) break; tot += d.length; out.push({ fileName: String(f.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', dataB64: d, contentType: sm.type || 'image/jpeg' }); } catch (e) {} } return out; }
  window.LIM = { parse, scan, srcOf, ph, attScan, attOf, mailAtts, fileAtts };
})();
