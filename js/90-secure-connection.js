/* ============================================================
   Secure connection file (.orbitcfg)
   The Tenant ID, Client ID and SharePoint site are NOT typed or stored in the app files. An administrator
   creates an encrypted file (orbit_connection_maker.html: AES-256-GCM, key derived from a password with
   PBKDF2-SHA256, 250 000 rounds). On first start the app shows "Connect to your workspace"; the file +
   password are imported, the values are written into the correct fields, and only then the sign-in
   (e-mail / Microsoft login) screen opens.
   ============================================================ */
(function () {
  'use strict';
  const PEPPER = 'ORBIT|connection|v1|nfpc', MAGIC = 'ORBITCFG1', ITER = 250000;
  const Q = s => document.querySelector(s), b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, SITE = /^https:\/\/[a-z0-9-]+\.sharepoint\.(com|us|cn|de)\/(sites|teams)\/[^\s?#]+$/i;
  let fails = 0, lockUntil = 0;

  async function decrypt(text, pass) {
    const t = String(text || '').trim(); if (t.slice(0, MAGIC.length) !== MAGIC) throw new Error('This is not an ORBIT connection file.');
    let o; try { o = JSON.parse(atob(t.slice(MAGIC.length).trim())); } catch (e) { throw new Error('The file is damaged.'); }
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass + PEPPER), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64d(o.s), iterations: o.n || ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    let plain; try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(o.i) }, key, b64d(o.c)); } catch (e) { throw new Error('Wrong password, or the file was changed.'); }
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function apply(c) {
    if (!c || c.app !== 'ORBIT') throw new Error('The file is not for this application.');
    const ten = String(c.tenantId || '').trim(), cli = String(c.clientId || '').trim(), site = String(c.siteUrl || '').trim().replace(/\/+$/, '');
    if (!GUID.test(ten)) throw new Error('The Tenant ID in the file is not valid.'); if (!GUID.test(cli)) throw new Error('The Client ID in the file is not valid.'); if (!SITE.test(site)) throw new Error('The SharePoint site address in the file is not valid.');
    localStorage.setItem(MS_CFG_KEY, JSON.stringify({ tenantId: ten, clientId: cli, siteUrl: site }));
    try { const g = loadGlobalSettings(); localStorage.setItem(GLOBAL_KEY, JSON.stringify({ siteUrl: site, accessToken: g.accessToken || '', updatedAt: Date.now(), updatedBy: 'connection file' })); } catch (e) {}
    [['#msTenant', ten], ['#msClient', cli], ['#globalSiteUrl', site], ['#siteUrl', site]].forEach(([s, v]) => { const e = Q(s); if (e) e.value = v; });
    try { ms_app = null; } catch (e) {}
  }

  async function importFile(file, pass, say) {
    if (Date.now() < lockUntil) throw new Error('Too many wrong attempts — wait ' + Math.ceil((lockUntil - Date.now()) / 1000) + ' s.');
    if (!file) throw new Error('Choose the connection file first.'); if (!pass) throw new Error('Enter the file password.');
    try { say('Checking the file…'); apply(await decrypt(await file.text(), pass)); fails = 0; }
    catch (e) { if (/password/i.test(e.message) && ++fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; } throw e; }
  }

  const CSS = '#cfgGate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f2f66,#1d4ed8);font-family:inherit}#cfgGate .cg{background:#fff;border-radius:18px;padding:28px 30px;width:min(440px,92vw);box-shadow:0 20px 60px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:12px}#cfgGate h2{margin:0;font-size:20px}#cfgGate p{margin:0;font-size:13px;color:#475569}#cfgGate input[type=password]{padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px}#cfgGate .cgf{border:2px dashed #94a3b8;border-radius:12px;padding:16px;text-align:center;cursor:pointer;font-size:13px;color:#334155}#cfgGate .cgf.on{border-color:#1d4ed8;background:#eff6ff}#cfgGate button{padding:11px;border:0;border-radius:10px;background:#1d4ed8;color:#fff;font-weight:700;font-size:14px;cursor:pointer}#cfgGate .cgs{font-size:12.5px;min-height:18px}#cfgGate .cgs.error{color:#b91c1c}#cfgGate .cgs.ok{color:#15803d}';
  function gate(onDone, closable) {
    if (Q('#cfgGate')) return; if (!Q('#cfgCss')) { const s = document.createElement('style'); s.id = 'cfgCss'; s.textContent = CSS; document.head.appendChild(s); }
    const g = document.createElement('div'); g.id = 'cfgGate';
    g.innerHTML = '<div class="cg"><h2>🔐 Connect to your workspace</h2><p>Select the encrypted connection file <b>(.orbitcfg)</b> your administrator gave you and enter its password. The sign-in screen opens after the connection details are loaded.</p><label class="cgf" id="cgDrop"><input type="file" id="cgFile" accept=".orbitcfg,.txt" hidden><span id="cgName">Click to choose the file, or drop it here</span></label><input type="password" id="cgPass" placeholder="File password" autocomplete="off"><button id="cgGo" type="button">Import &amp; continue</button>' + (closable ? '<button id="cgX" type="button" style="background:#e2e8f0;color:#0f172a">Cancel</button>' : '') + '<div class="cgs" id="cgSt"></div></div>';
    document.body.appendChild(g);
    const st = (m, k) => { const e = Q('#cgSt'); e.className = 'cgs ' + (k || ''); e.textContent = m; }, fi = Q('#cgFile'); let file = null;
    const pick = f => { file = f; Q('#cgName').textContent = f ? '📄 ' + f.name : 'Click to choose the file, or drop it here'; Q('#cgDrop').classList.toggle('on', !!f); };
    fi.addEventListener('change', () => pick(fi.files[0]));
    const dr = Q('#cgDrop'); dr.addEventListener('dragover', e => e.preventDefault()); dr.addEventListener('drop', e => { e.preventDefault(); pick(e.dataTransfer.files[0]); });
    const go = async () => { const b = Q('#cgGo'); b.disabled = true; try { await importFile(file, Q('#cgPass').value, m => st(m)); st('✅ Connection details loaded.', 'ok'); Q('#cgPass').value = ''; setTimeout(() => { g.remove(); try { const ls = Q('#loginScreen'); if (ls && !(typeof currentUser !== 'undefined' && currentUser)) { ls.style.display = 'flex'; const u = Q('#loginUsername'); if (u) u.focus(); } } catch (e) {} onDone && onDone(); }, 500); } catch (e) { st('✘ ' + e.message, 'error'); } finally { b.disabled = false; } };
    Q('#cgGo').addEventListener('click', go); Q('#cgPass').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    const x = Q('#cgX'); if (x) x.addEventListener('click', () => g.remove());
  }

  function boot() {
    try { if (typeof ms_configured === 'function' && !ms_configured()) gate(); } catch (e) {}
    /* admin: re-import from Settings */
    const sv = Q('#msSaveBtn'); if (sv && !Q('#cfgImportBtn')) { const b = document.createElement('button'); b.type = 'button'; b.id = 'cfgImportBtn'; b.className = sv.className; b.textContent = '🔐 Import connection file'; b.style.marginLeft = '8px'; b.addEventListener('click', () => { if (typeof isAdmin === 'function' && !isAdmin()) return alert('Only administrators can change the connection.'); gate(() => { try { ms_status('✅ Connection imported from the encrypted file.', 'success'); } catch (e) {} }, true); }); sv.insertAdjacentElement('afterend', b); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 50)); else setTimeout(boot, 50);
  window.orbitConnGate = gate;
})();
