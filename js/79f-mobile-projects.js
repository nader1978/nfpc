/* ORBIT MOBILE SUITE — 🏗️ Projects: field staff update the progress of a project phase (with photos),
   raise requests for additional cost / material / manpower / equipment (with photos), and follow their projects & requests.
   Same SharePoint lists as the desktop Project Progress module (js/43):
   Project_Reg_tbl · Project_Phases_tbl · Project_Updates_tbl (+ photo attachments) · Project_Requests_tbl (+ photo attachments). */
(function () {
  'use strict';
  const K = window.MOBXK; if (!K) return;
  const { A, reg, need, drop, user, put, patch, saved, fail, prog, attachAll, mail, mailTbl, H, esc, nz, num, today, dOnly, dmy, str, fmtN, iso, me, isMe, toast, render, byIdDesc, sheet } = K;
  const LP = { prj: ['Project_Reg_tbl'], ph: ['Project_Phases_tbl'], up: ['Project_Updates_tbl'], rq: ['Project_Requests_tbl'] };
  const STATUS = ['On track', 'At risk', 'Delayed', 'On hold', 'Completed'];
  const RTYPES = ['Additional cost', 'Material', 'Manpower', 'Equipment', 'Subcontractor', 'Other'];
  const C1 = '#f59e0b', C2 = '#b45309';
  const code = r => str(r.projectcode), pname = r => str(r.projectname);
  const phasesOf = (d, c) => (d.ph || []).filter(p => code(p) === c).sort((a, b) => num(a.phaseno) - num(b.phaseno));
  const overall = (d, c) => { const ph = phasesOf(d, c), tw = ph.reduce((s, p) => s + num(p.weight), 0); return tw ? ph.reduce((s, p) => s + num(p.weight) * Math.min(100, num(p.progress)), 0) / tw : (ph.length ? ph.reduce((s, p) => s + Math.min(100, num(p.progress)), 0) / ph.length : 0); };
  const active = d => (d.prj || []).filter(p => !/complet|closed|cancel/i.test(str(p.status)) && overall(d, code(p)) < 99.9).sort((a, b) => code(a).localeCompare(code(b)));
  const prjOpts = d => active(d).map(p => [code(p), code(p) + ' · ' + pname(p)]);
  const phOpts = (d, c) => phasesOf(d, c).map(p => [str(p.phasename), str(p.phasename) + ' — ' + fmtN(num(p.progress)) + '%']);
  const bar = (pct, c) => `<div style="height:8px;border-radius:99px;background:var(--line,#e2e8f0);overflow:hidden;margin-top:6px"><i style="display:block;height:100%;width:${Math.max(0, Math.min(100, pct))}%;background:${c || C1};border-radius:99px"></i></div>`;
  const rid = p => p + '-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
  const stPill = s => /approv|complet/i.test(s) ? 'g' : /reject|delay/i.test(s) ? 'r' : /risk|pend|hold/i.test(s) ? 'o' : '';
  /* e-mail of a name (project manager): ORBIT users list → LoginUserList → the value itself when it is an address */
  async function emailOf(name) { const v = String(name || '').trim(); if (!v) return ''; if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return v;
    try { if (typeof orbEmailOf === 'function') { const e = orbEmailOf(v); if (e) return e; } } catch (e) {}
    const u = await user(), k = nz(v), r = (u.rows || []).find(x => nz(x.username) === k || nz(x.title) === k || nz(x.fullname || x.employeename) === k) || (u.rows || []).find(x => k.length > 2 && (nz(x.username).startsWith(k) || nz(x.title).startsWith(k)));
    return r ? str(r.emailid || r.email || r.mail) : ''; }
  const noProj = d => d.busy ? '' : H.empty((d.prj || []).length ? 'No open projects — every project is completed.' : 'No projects found in Project_Reg_tbl. Projects are registered on the ORBIT web → Project Progress.');

  /* ================= 📈 Update progress ================= */
  reg('x_prjupd', { lists: LP, load(v, f) { if (!v.st) Object.assign(v, { st: 'On track', ud: today() }); need('x_prjupd', LP, f); },
    onChange(k, val, v) { if (k === 'pc') { v.phase = ''; v.pct = ''; } if (k === 'phase') v.pct = ''; },
    view(v, d) { let h = H.head('📈', 'Update progress', 'Phase progress, issues & site photos', C2) + H.load(d);
      const P = (d.prj || []).find(p => code(p) === v.pc), ph = P ? phasesOf(d, v.pc).find(p => str(p.phasename) === v.phase) : null;
      if (!active(d).length && !P) return h + noProj(d);
      h += H.card('Project', H.f('Project', H.sel('pc', prjOpts(d))) + (P ? `<div class="mb-hint">Manager ${esc(str(P.projectmanager) || '—')} · overall <b>${fmtN(overall(d, v.pc), 1)}%</b>${str(P.enddate) ? ' · planned end ' + dmy(P.enddate) : ''}</div>${bar(overall(d, v.pc))}` : '')
        + (P ? H.f('Phase', phasesOf(d, v.pc).length ? H.sel('phase', phOpts(d, v.pc)) : '<div class="mb-hint mb-warn">This project has no phases yet — add them on the ORBIT web.</div>') : ''));
      if (!ph) return h;
      const cur = num(ph.progress), np = v.pct === '' || v.pct == null ? null : num(v.pct);
      h += H.card('Progress', `<div class="mb-hint">Last progress <b>${fmtN(cur)}%</b>${str(ph.status) ? ' · ' + esc(str(ph.status)) : ''}${str(ph.actualstart) ? ' · started ' + dmy(ph.actualstart) : ''}</div>`
        + H.f('New progress %', H.num('pct', { big: 1, ph: String(cur) }), np != null && np < cur ? '<span class="mb-bad">Lower than the last progress</span>' : '')
        + `<div class="mb-seg">${[10, 25, 50, 75, 90, 100].map(x => `<button type="button" data-x="set" data-k="pct" data-val="${x}" class="${np === x ? 'on' : ''}">${x}%</button>`).join('')}</div>`
        + H.f('Status', H.sel('st', STATUS, { ph: false, r: false })) + H.f('Update date', H.date('ud')));
      h += H.card('Notes', H.f('Issues / obstacles', H.txt('iss', 'What is blocking or slowing the work?')) + H.f('Next steps', H.txt('nxt', 'What happens next?')));
      h += H.card('📷 Site photos (up to 8)', H.photos('ph', 8));
      return h + H.bar(H.btn('☁ Save progress update', 'save')); },
    act: {
      async save(t, v, d) { const P = (d.prj || []).find(p => code(p) === v.pc), ph = P && phasesOf(d, v.pc).find(p => str(p.phasename) === v.phase);
        if (!P || !ph) return toast('Choose the project and the phase.', 'warn'); if (v.pct === '' || v.pct == null) return toast('Enter the new progress %.', 'warn');
        const pct = num(v.pct), cur = num(ph.progress), date = v.ud || today(); if (pct < 0 || pct > 100) return toast('Progress must be between 0 and 100.', 'warn');
        if (pct < cur && !confirm('The new progress (' + pct + '%) is LOWER than the last one (' + fmtN(cur) + '%). Save anyway?')) return;
        const as = str(ph.actualstart) ? dOnly(ph.actualstart) : (pct > 0 ? date : ''), ae = str(ph.actualend) ? dOnly(ph.actualend) : (pct >= 100 ? date : ''), st = pct >= 100 ? 'Completed' : (v.st || 'On track');
        const photos = v.ph || []; prog(2 + photos.length, 'Project ' + v.pc);
        try { const r = await put('Project_Updates_tbl', { Title: v.pc, Update_Id: rid('U'), Project_Code: v.pc, Phase_Name: v.phase, Update_Date: date, Progress: pct, Prev_Progress: cur, Status: st, Issues: String(v.iss || '').trim(), Next_Steps: String(v.nxt || '').trim(), Actual_Start: as, Actual_End: ae, Updated_By: me() }, 'Progress ' + v.pc);
          let n = 0; if (r && r.id) n = await attachAll('Project_Updates_tbl', r.id, photos, 'Progress_' + v.pc);
          await patch('Project_Phases_tbl', ph.id, Object.assign({ Progress: pct, Status: st }, as ? { Actual_Start: as } : {}, ae ? { Actual_End: ae } : {}), 'Phase ' + v.phase);
          Object.assign(ph, { progress: pct, status: st, actualstart: as, actualend: ae });
          const ov = overall(d, v.pc); if (ov >= 99.9 && !/complet/i.test(str(P.status))) await patch('Project_Reg_tbl', P.id, { Status: 'Completed' }, 'Project ' + v.pc).catch(() => {}); else if (!str(P.status) || /plan|not/i.test(str(P.status))) await patch('Project_Reg_tbl', P.id, { Status: 'In progress' }, 'Project ' + v.pc).catch(() => {});
          saved(r, v.phase + ' ' + fmtN(cur) + '% → ' + fmtN(pct) + '%' + (n ? ' · ' + n + ' photo(s)' : '') + (r && r.queued && photos.length ? ' (photos are sent only online — add them again later)' : ''));
          drop('Project_Updates_tbl', 'Project_Phases_tbl', 'Project_Reg_tbl'); const keep = { pc: v.pc }; A().S.v = Object.assign({ st: 'On track', ud: today() }, keep); need('x_prjupd', LP, true); render();
        } catch (e) { fail('Progress update', e); } } } });

  /* ================= 📨 Request cost / requirement ================= */
  reg('x_prjreq', { lists: { prj: LP.prj, ph: LP.ph }, load(v, f) { if (!v.ty) Object.assign(v, { ty: 'Additional cost', pr: 'Normal', nb: '' }); need('x_prjreq', this.lists, f); },
    onChange(k, val, v) { if (k === 'pc') v.phase = ''; },
    view(v, d) { let h = H.head('📨', 'Request cost / requirement', 'Additional cost, material, manpower or equipment', '#7c3aed') + H.load(d);
      const P = (d.prj || []).find(p => code(p) === v.pc); if (!active(d).length && !P) return h + noProj(d);
      h += H.card('Project', H.f('Project', H.sel('pc', prjOpts(d))) + (P ? H.f('Phase (optional)', H.sel('phase', phOpts(d, v.pc), { ph: '— whole project —', r: false })) + `<div class="mb-hint">The request goes to the project manager <b>${esc(str(P.projectmanager) || '—')}</b> for approval.</div>` : ''));
      if (!P) return h;
      h += H.card('Request', H.f('Type', H.sel('ty', RTYPES, { ph: false })) + H.f('What is needed and why *', H.txt('ds', 'e.g. 20 extra bags of cement — the slab area was increased'))
        + `<div class="mb-row">${H.f('Quantity', H.num('qt', { ph: '0' }))}${H.f('Unit', H.inp('un', { ph: 'pcs, bags, m², days…' }))}</div>`
        + H.f('Estimated amount (AED)', H.num('am', { ph: '0.00' })) + `<div class="mb-row">${H.f('Needed by', H.inp('nb', { type: 'date' }))}${H.f('Priority', H.seg('pr', ['Normal', 'Urgent'], 'Normal'))}</div>`);
      h += H.card('📷 Photos / quotation (up to 6)', H.photos('ph', 6));
      return h + H.bar(H.btn('📨 Send request', 'send')); },
    act: {
      async send(t, v, d) { const P = (d.prj || []).find(p => code(p) === v.pc); if (!P) return toast('Choose the project.', 'warn');
        const ds = String(v.ds || '').trim(); if (!ds) return toast('Describe what is needed.', 'warn'); if (num(v.am) < 0) return toast('The amount cannot be negative.', 'warn');
        const id = rid('R'), photos = v.ph || [], rec = { Title: v.pc, Request_Id: id, Project_Code: v.pc, Phase_Name: v.phase || '', Request_Date: today(), Request_Type: v.ty || 'Additional cost', Description: ds, Qty: num(v.qt) || '', Unit: String(v.un || '').trim(), Est_Amount: num(v.am) || '', Needed_By: v.nb || '', Priority: v.pr || 'Normal', Status: 'Pending', Requested_By: me() };
        prog(1 + photos.length, 'Request ' + v.pc);
        try { const r = await put('Project_Requests_tbl', rec, 'Request ' + v.pc); let n = 0; if (r && r.id) n = await attachAll('Project_Requests_tbl', r.id, photos, 'Request_' + v.pc);
          const pm = str(P.projectmanager), to = await emailOf(pm), u = await user();
          if (to) mail(to, (rec.Priority === 'Urgent' ? '🔴 URGENT · ' : '') + '📨 Project request · ' + v.pc + ' · ' + rec.Request_Type, mailTbl('Project request · ' + v.pc + ' · ' + pname(P), [['Request ID', id], ['Project', v.pc + ' · ' + pname(P)], ['Phase', rec.Phase_Name || 'Whole project'], ['Type', rec.Request_Type], ['Description', ds], ['Quantity', rec.Qty ? rec.Qty + ' ' + rec.Unit : ''], ['Estimated amount', rec.Est_Amount ? fmtN(rec.Est_Amount, 2) + ' AED' : ''], ['Needed by', rec.Needed_By ? dmy(rec.Needed_By) : ''], ['Priority', rec.Priority], ['Requested by', me()], ['Photos', n ? n + ' attached in SharePoint' : '—'], ['Approve', 'ORBIT web → Project Progress → 📨 Requests']].filter(x => x[1] !== ''), '#7c3aed'), u.myEmail);
          else toast('No e-mail found for the project manager "' + (pm || '—') + '" — the request is saved; tell the manager to check ORBIT.', 'warn');
          saved(r, 'Request ' + id + (n ? ' · ' + n + ' photo(s)' : '') + (r && r.queued && photos.length ? ' (photos are sent only online)' : ''));
          drop('Project_Requests_tbl'); A().S.v = { pc: v.pc, ty: 'Additional cost', pr: 'Normal' }; render();
        } catch (e) { fail('Project request', e); } } } });

  /* ================= 🏗️ My projects & requests ================= */
  reg('x_prjmine', { lists: LP, load(v, f) { need('x_prjmine', LP, f); },
    view(v, d) { const tab = v.tab || 'prj', mine = (d.rq || []).filter(r => isMe(r.requestedby)).sort(byIdDesc), pend = mine.filter(r => /pend/i.test(str(r.status))).length;
      let h = H.head('🏗️', 'Projects & my requests', 'Progress of every project · status of your requests', '#0e7490') + H.load(d) + H.tabs('tab', [['prj', 'Projects', active(d).length], ['rq', 'My requests', mine.length]], 'prj');
      if (tab === 'prj') { const L = active(d); h += L.length ? L.map(p => { const c = code(p), ov = overall(d, c), lu = (d.up || []).filter(u => code(u) === c).sort((a, b) => dOnly(b.updatedate).localeCompare(dOnly(a.updatedate)))[0];
          return `<div class="mb-card" data-x="open" data-i="${esc(c)}" style="cursor:pointer"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(c)} · ${esc(pname(p))}</b><b>${fmtN(ov, 1)}%</b></div>${bar(ov, ov >= 99.9 ? '#16a34a' : C1)}<div class="mb-hint" style="margin-top:6px">${esc(str(p.projectmanager) || '—')}${lu ? ' · last update ' + dmy(lu.updatedate) + ' (' + esc(str(lu.status)) + ')' : ' · no update yet'}</div></div>`; }).join('') : noProj(d); }
      else h += (pend ? `<div class="mb-hint" style="margin:0 4px 8px">${pend} request(s) waiting for approval</div>` : '') + (mine.length ? mine.map(r => H.li({ ic: /approv/i.test(str(r.status)) ? '✅' : /reject/i.test(str(r.status)) ? '⛔' : '⏳', c: /approv/i.test(str(r.status)) ? '#16a34a' : /reject/i.test(str(r.status)) ? '#dc2626' : C1, t: code(r) + ' · ' + str(r.requesttype), s: str(r.description).slice(0, 90), s2: dmy(r.requestdate) + (num(r.estamount) ? ' · ' + fmtN(r.estamount, 2) + ' AED' : ''), p: [stPill(str(r.status)), str(r.status) || 'Pending'], x: 'rq', i: r.id })).join('') : H.empty('You have not raised any request yet.'));
      return h + H.bar(`<div class="mb-row">${H.btn('📈 Update progress', 'goUpd', 's')}${H.btn('📨 New request', 'goReq', 'p')}</div>`); },
    act: {
      open(t, v, d) { const c = t.dataset.i, p = (d.prj || []).find(x => code(x) === c) || {}, ph = phasesOf(d, c);
        sheet(c + ' · ' + pname(p), [['Overall progress', fmtN(overall(d, c), 1) + '%'], ['Manager', str(p.projectmanager)], ['Location', str(p.location)], ['Planned', [dmy(p.startdate), dmy(p.enddate)].filter(Boolean).join(' → ')]].concat(ph.map(x => [num(x.phaseno) + ' · ' + str(x.phasename) + (num(x.weight) ? ' (' + fmtN(x.weight) + '%)' : ''), fmtN(num(x.progress)) + '%' + (str(x.status) ? ' · ' + str(x.status) : '')])),
          `<div class="mb-row">${H.btn('📈 Update', 'goUpd', 's', `data-i="${esc(c)}"`)}${H.btn('📨 Request', 'goReq', 'p', `data-i="${esc(c)}"`)}</div>`); },
      rq(t, v, d) { const r = (d.rq || []).find(x => String(x.id) === String(t.dataset.i)); if (!r) return;
        sheet('Request ' + str(r.requestid), [['Project', code(r)], ['Phase', str(r.phasename) || 'Whole project'], ['Type', str(r.requesttype)], ['Description', str(r.description)], ['Quantity', num(r.qty) ? fmtN(r.qty) + ' ' + str(r.unit) : ''], ['Estimated amount', num(r.estamount) ? fmtN(r.estamount, 2) + ' AED' : ''], ['Needed by', dmy(r.neededby)], ['Priority', str(r.priority)], ['Status', str(r.status) || 'Pending'], ['Decided by', str(r.approvedby)], ['Decision date', dmy(r.approvaldate)], ['Remarks', str(r.approvalrmrks)]]); },
      goUpd(t, v) { const c = t.dataset.i; A().go('x_prjupd'); if (c) { A().S.v.pc = c; render(); } },
      goReq(t, v) { const c = t.dataset.i; A().go('x_prjreq'); if (c) { A().S.v.pc = c; render(); } } } });
})();
