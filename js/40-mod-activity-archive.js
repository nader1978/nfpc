
/* ---------- Recent Activity: archived to a SharePoint list before anything is deleted ---------- */
(function () {
  const Q = s => document.querySelector(s), QK = () => LS_BASE + '_actq';
  utRegister('activity', { section: 'Recent Activity', label: 'Recent Activity archive → SharePoint', fields: () => [
    { key: 'when', label: 'Date & time', alias: ['timestamp', 'datetime', 'when', 'activitydate', 'date', 'time'] },
    { key: 'kind', label: 'Kind', alias: ['kind', 'type', 'category', 'action'] },
    { key: 'detail', label: 'Detail', alias: ['detail', 'details', 'activity', 'description', 'message', 'title'] },
    { key: 'profile', label: 'Profile', alias: ['profile', 'profilename'] },
    { key: 'eid', label: 'Entry ID', alias: ['entryid', 'activityid', 'guid', 'id'] }],
    note: 'Used by the 🕘 Recent Activity drawer. Entries are uploaded here before they are cleared from the log or pushed out when the log is full.' });
  const ready = () => { try { return !!getGlobalAccessToken() && !!getGlobalSiteUrl() && utReady('activity'); } catch (e) { return false; } };
  const row = x => ({ when: new Date(x.ts).toISOString(), kind: x.kind, detail: String(x.detail || ''), profile: (typeof profiles !== 'undefined' && profiles && profiles.activeId) || '', eid: x.id });
  const qRead = () => { try { return JSON.parse(localStorage.getItem(QK()) || '[]') || []; } catch (e) { return []; } };
  const qWrite = a => { try { localStorage.setItem(QK(), JSON.stringify(a.slice(-3000))); } catch (e) {} };
  const msg = (t, w) => sectionToast(t, w ? 'warn' : 'ok');
  async function pushList(list) { let ok = 0; for (let i = 0; i < list.length; i += 25) { const part = list.slice(i, i + 25), r = await utPush('activity', part.map(row), x => x.kind); if (r.fail) throw new Error((r.errors && r.errors[0]) || 'some rows were refused'); ok += part.length; } return ok; }
  let flushing = false;
  async function flush() { if (flushing || !ready()) return; const q = qRead(); if (!q.length) return; flushing = true; try { let n = 0; while (true) { const cur = qRead(); if (!cur.length) break; const part = cur.slice(0, 25); await pushList(part); qWrite(qRead().slice(part.length)); n += part.length; } if (n) msg('☁ ' + n + ' older activity entries were saved to SharePoint.'); } catch (e) {} finally { flushing = false; status(); } }
  const _add = addActivity;
  addActivity = function (k, d) { const old = activityLog.length >= MAX_ACTIVITY ? activityLog[0] : null; _add(k, d); if (old && !activityLog.includes(old) && !old.arch) { qWrite(qRead().concat([old])); flush(); } };
  function status() { const el = Q('#actLinkInfo'); if (!el) return; const c = utGet('activity'), q = qRead().length;
    el.innerHTML = c.list ? '🔗 Linked to SharePoint list <b>' + escapeHtml(c.list) + '</b>' + (q ? ' · ' + q + ' waiting to upload' : '') : '⚠ Not linked to a SharePoint list yet — an administrator sets it in <b>Upload Destinations &amp; Sources</b> (Recent Activity).'; }
  async function archive(manual) {
    const list = activityLog.filter(x => !x.arch); if (!list.length) return { ok: true, n: 0 };
    if (!ready()) return { ok: false, why: utGet('activity').list ? 'Sign-in / Site URL is not ready.' : 'No SharePoint list is linked.' };
    try { const n = await pushList(list); list.forEach(x => { x.arch = true; }); saveActivity(); await flush(); return { ok: true, n }; } catch (e) { return { ok: false, why: e.message }; }
  }
  const foot = Q('.activity-footer');
  if (foot) { foot.insertAdjacentHTML('beforebegin', '<div id="actLinkInfo" style="font-size:12px;padding:6px 14px;color:var(--gray-600)"></div>'); const b = document.createElement('button'); b.className = 'secondary small'; b.id = 'activityUpBtn'; b.type = 'button'; b.textContent = '☁ Upload to SharePoint'; foot.insertBefore(b, foot.firstChild);
    b.onclick = async () => { b.disabled = true; const r = await archive(true); b.disabled = false; msg(r.ok ? (r.n ? '☁ ' + r.n + ' entries uploaded to SharePoint.' : 'Nothing new to upload.') : 'Could not upload: ' + r.why, !r.ok); status(); }; }
  const clr = Q('#activityClearBtn');
  if (clr) clr.addEventListener('click', async e => {
    e.stopImmediatePropagation(); e.preventDefault();
    if (!activityLog.length) return; const pend = activityLog.filter(x => !x.arch).length; let go = true;
    if (pend) { msg('☁ Saving ' + pend + ' entries to SharePoint before clearing…'); const r = await archive(false);
      if (!r.ok) go = confirm('The activity could NOT be saved to SharePoint (' + r.why + ').\n\nClear the log anyway? The ' + pend + ' unsaved entries will be lost.'); else { msg('☁ ' + r.n + ' entries saved to SharePoint.'); go = confirm('Saved to SharePoint. Clear the log now?'); } }
    else go = confirm('All entries are already saved to SharePoint. Clear the log?');
    if (go) { activityLog = []; saveActivity(); renderActivity(); status(); }
  }, true);
  const tg = Q('#activityToggle'); if (tg) tg.addEventListener('click', () => { status(); flush(); });
  setInterval(flush, 120000); setTimeout(() => { status(); flush(); }, 4000);
})();
