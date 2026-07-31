/* ============================================================
   COPYRIGHT / DMCA — #28 (A2)
   Backend (routes/dmca.ts + admin/templates/:id/takedown|restore)
   ALLAQACHON to'liq edi, lekin admin UI umuman yo'q edi —
   operator kelgan shikoyatni ko'ra olmasdi (huquqiy xavf).

   API: GET  /api/dmca/admin/reports?status=
        POST /api/dmca/admin/reports/:id/resolve
        POST /api/contributor/admin/templates/:id/takedown
        POST /api/contributor/admin/templates/:id/restore
   ============================================================ */

let DM_REPORTS = [];
let DM_TAKEDOWNS = [];
let DM_FILTER = "pending";

function dmById(id){ return DM_REPORTS.find(r => r.id === id); }

/** Hisobot holati badge'i. */
function dmStatus(s){
  if(s === "actioned")  return '<span class="adx-bdg adx-bdg-approved">Actioned</span>';
  if(s === "dismissed") return '<span class="adx-bdg adx-bdg-removed"><span class="bd"></span>Dismissed</span>';
  return '<span class="adx-bdg adx-bdg-pending">Pending</span>';
}

function dmDate(v){
  if(!v) return '—';
  return (typeof fmtLocalDateTime === 'function') ? fmtLocalDateTime(v) : String(v).slice(0,16).replace('T',' ');
}

function dmClip(s, n){
  const v = String(s || '');
  return v.length > n ? v.slice(0, n) + '…' : v;
}

VIEWS.dmca = function(){
  return `<div id="dmcaRoot"><div style="display:flex;align-items:center;justify-content:center;padding:80px 0"><span class="adx-spin" style="font-size:22px;color:var(--lime)"><i class="ph ph-arrow-clockwise"></i></span></div></div>`;
};

window.afterRender.dmca = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT === 'dmca'){
    tba.innerHTML = `<label class="adx-sel"><i class="ph ph-funnel" style="font-size:13px"></i><span>${DM_FILTER === 'all' ? 'All reports' : DM_FILTER}</span><i class="ph ph-caret-down" style="font-size:11px;color:var(--muted)"></i>
      <select onchange="DM_FILTER=this.value;refreshDmca()">
        <option value="pending" ${DM_FILTER==='pending'?'selected':''}>Pending</option>
        <option value="actioned" ${DM_FILTER==='actioned'?'selected':''}>Actioned</option>
        <option value="dismissed" ${DM_FILTER==='dismissed'?'selected':''}>Dismissed</option>
        <option value="all" ${DM_FILTER==='all'?'selected':''}>All reports</option>
      </select></label>`;
  }
  await refreshDmca();
};

async function refreshDmca(){
  const root = document.getElementById('dmcaRoot');
  if(!root) return;
  try{
    // Takedown ro'yxati serverdan filtrlanadi (#28) — katalog hajmidan mustaqil.
    const [rep, tds] = await Promise.all([
      StudioApi.listInfringementReports(DM_FILTER),
      StudioTemplates.fetchTemplatePage
        ? StudioTemplates.fetchTemplatePage({ takedown: 'true', take: 100 }).catch(() => ({ items: [] }))
        : Promise.resolve({ items: [] }),
    ]);
    DM_REPORTS = rep.reports || [];
    DM_TAKEDOWNS = tds.items || [];
    window._AF_DMCA_PENDING = DM_FILTER === 'pending' ? DM_REPORTS.length : window._AF_DMCA_PENDING;
    if(typeof renderNav === 'function') renderNav();
    renderDmca();
  }catch(e){
    root.innerHTML = axInfo(`Could not load copyright reports: ${esc(e.message || 'API')}`, 'red');
  }
}

function renderDmca(){
  const root = document.getElementById('dmcaRoot');
  if(!root) return;
  const pending = DM_REPORTS.filter(r => r.status === 'pending').length;

  const reportRows = DM_REPORTS.length ? DM_REPORTS.map(r => `<tr>
    <td><div style="min-width:0">
      <div style="font-weight:600;font-size:12.5px">${esc(r.reporterName || r.reporterEmail)}</div>
      <div style="font-size:10.5px;color:var(--muted)">${esc(r.reporterEmail)}${r.claimantType ? ' · ' + esc(r.claimantType.replace('_',' ')) : ''}</div>
    </div></td>
    <td style="max-width:340px"><div style="font-size:11.5px;color:var(--text2);line-height:1.5">${esc(dmClip(r.workDescription, 160))}</div></td>
    <td style="font-size:11px;color:var(--muted)">${r.templateId ? `<span class="adx-mono">${esc(r.templateId)}</span>` : (r.infringingUrl ? esc(dmClip(r.infringingUrl, 40)) : '—')}</td>
    <td class="adx-num" style="font-size:11px;color:var(--muted)">${esc(dmDate(r.createdAt))}</td>
    <td>${dmStatus(r.status)}${r.goodFaith ? '' : ' <span class="adx-bdg" style="background:rgba(255,178,124,.14);color:#FFB27C" title="The claimant did not tick the good-faith statement">no good-faith</span>'}</td>
    <td class="r"><button class="adx-btn2 sm" onclick="openDmcaReport('${esc(r.id)}')"><i class="ph ph-eye"></i>Review</button></td>
  </tr>`).join('') : `<tr><td colspan="6"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-scales"></i></span><div style="font-weight:600;font-size:13px">No reports</div><div style="font-size:11px;color:var(--muted2)">Nothing to review in this filter.</div></div></td></tr>`;

  const tdRows = DM_TAKEDOWNS.length ? DM_TAKEDOWNS.map(t => {
    const a = t._api || {};
    return `<tr>
      <td><div style="font-weight:600;font-size:12.5px">${esc(t.name)}</div><div class="adx-mono" style="font-size:10.5px;color:var(--muted)">${esc(t.id)}</div></td>
      <td style="font-size:11.5px;color:var(--text2);max-width:320px">${esc(dmClip(a.takedownReason || '—', 140))}</td>
      <td class="adx-num" style="font-size:11px;color:var(--muted)">${esc(dmDate(a.takedownAt))}</td>
      <td class="r"><button class="adx-btn2 sm adx-btn-ok" onclick="openDmcaRestore('${esc(t.id)}')"><i class="ph ph-arrow-clockwise"></i>Restore</button></td>
    </tr>`;
  }).join('') : `<tr><td colspan="4"><div class="adx-empty" style="border:0;padding:28px"><span class="ei"><i class="ph ph-check-circle"></i></span><div style="font-weight:600;font-size:13px">Nothing taken down</div><div style="font-size:11px;color:var(--muted2)">No template is currently removed from the catalog.</div></div></td></tr>`;

  root.innerHTML = `
    ${axInfo('Copyright claims arrive from the public "Report infringement" form. A takedown removes the template from the AE catalog and the public site immediately — <b style="color:var(--text)">the files are kept as evidence</b> and can be restored. ⚠️ The notice / counter-notice procedure still needs legal review.', 'amber')}
    <div class="adx-grid4" style="margin-bottom:18px">
      ${axStat({label:'Pending claims',val:pending,ic:'scales',icColor:'#FFB27C',foot:'awaiting a decision'})}
      ${axStat({label:'Shown',val:DM_REPORTS.length,ic:'list',foot:DM_FILTER==='all'?'all statuses':DM_FILTER})}
      ${axStat({label:'Taken down',val:DM_TAKEDOWNS.length,ic:'prohibit',icColor:'#FF6B5E',foot:'removed from the catalog'})}
      ${axStat({label:'Actioned',val:DM_REPORTS.filter(r=>r.status==='actioned').length,ic:'check-circle',icColor:'var(--lime)',foot:'in this list'})}
    </div>

    <div class="adx-card" style="overflow:hidden;margin-bottom:18px">
      <div class="adx-cardhd"><i class="ph ph-scales" style="color:#FFB27C;font-size:15px"></i><span class="adx-h16" style="font-size:14px">Infringement reports</span><span style="flex:1"></span><span style="font-size:11px;color:var(--muted)">latest 200</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:980px">
        <thead><tr><th>Claimant</th><th>Claimed work</th><th>Target</th><th>Submitted</th><th>Status</th><th class="r">Action</th></tr></thead>
        <tbody>${reportRows}</tbody>
      </table></div>
    </div>

    <div class="adx-card" style="overflow:hidden">
      <div class="adx-cardhd"><i class="ph ph-prohibit" style="color:#FF6B5E;font-size:15px"></i><span class="adx-h16" style="font-size:14px">Taken-down templates</span><span style="flex:1"></span><span style="font-size:11px;color:var(--muted)">restore returns it to the catalog</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:800px">
        <thead><tr><th>Template</th><th>Reason</th><th>Taken down</th><th class="r">Action</th></tr></thead>
        <tbody>${tdRows}</tbody>
      </table></div>
    </div>`;
}

/* ── Hisobotni ko'rish + qaror ───────────────────────────── */

function openDmcaReport(id){
  const r = dmById(id);
  if(!r) return;
  const target = r.templateId
    ? `<div class="adx-mono" style="font-size:11.5px">${esc(r.templateId)}</div>`
    : `<div style="font-size:11.5px;color:var(--text2);word-break:break-all">${esc(r.infringingUrl || '(not specified)')}</div>`;
  const resolved = r.status !== 'pending';
  openModal(`
    <div class="modal-head">
      <div class="modal-ico" style="background:var(--amber-dim);color:var(--amber)">${ic('alert')}</div>
      <div><h3>Copyright claim</h3><p>${esc(r.reporterEmail)} · ${esc(dmDate(r.createdAt))}</p></div>
    </div>
    <div class="modal-body col gap-12">
      <div><div class="adx-flab">CLAIMANT</div><div style="font-size:12.5px;color:var(--text2)">${esc(r.reporterName || '—')} · ${esc(r.claimantType ? r.claimantType.replace('_',' ') : 'not stated')}${r.goodFaith ? '' : ' · <span style="color:#FFB27C">good-faith statement NOT ticked</span>'}</div></div>
      <div><div class="adx-flab">CLAIMED WORK</div><div style="font-size:12.5px;color:var(--text2);line-height:1.6;white-space:pre-wrap">${esc(r.workDescription)}</div></div>
      <div><div class="adx-flab">TARGET</div>${target}</div>
      ${r.resolutionNote ? `<div><div class="adx-flab">RESOLUTION NOTE</div><div style="font-size:12px;color:var(--text2)">${esc(r.resolutionNote)}</div></div>` : ''}
      ${resolved ? axInfo(`Already <b style="color:var(--text)">${esc(r.status)}</b>${r.reviewedAt ? ' on ' + esc(dmDate(r.reviewedAt)) : ''}.`, 'info') : `
      <div><div class="adx-flab">DECISION NOTE (saved with the report)</div>
        <textarea id="dmNote" class="textarea" rows="2" placeholder="Why this claim was actioned or dismissed…"></textarea></div>`}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      ${resolved ? '' : `
        <button class="btn btn-ghost" onclick="doDmcaResolve('${esc(id)}','dismissed')">Dismiss claim</button>
        ${r.templateId
          ? `<button class="btn btn-danger" onclick="openDmcaTakedown('${esc(id)}')">${ic('ban')} Take down template</button>`
          : `<button class="btn btn-primary" onclick="doDmcaResolve('${esc(id)}','actioned')">Mark actioned</button>`}
      `}
    </div>`);
}

async function doDmcaResolve(id, status){
  const noteEl = document.getElementById('dmNote');
  const note = noteEl ? noteEl.value.trim() : '';
  try{
    await StudioApi.resolveInfringementReport(id, status, note || undefined);
    closeModal();
    toast('Report ' + status, status === 'actioned' ? 'Marked as actioned' : 'Claim dismissed', status === 'actioned' ? 'success' : 'info');
    await refreshDmca();
  }catch(e){
    toast('Error', e.message || 'API', 'danger');
  }
}

/** Takedown = shablonni katalogdan olib tashlash + hisobotni "actioned" qilish. */
function openDmcaTakedown(reportId){
  const r = dmById(reportId);
  if(!r || !r.templateId) return;
  const note = (document.getElementById('dmNote') || {}).value || '';
  const reason = note.trim() || `DMCA claim by ${r.reporterEmail}`;
  openModal(`
    <div class="modal-head">
      <div class="modal-ico" style="background:var(--red-dim);color:var(--red)">${ic('ban')}</div>
      <div><h3>Take down template</h3><p class="adx-mono">${esc(r.templateId)}</p></div>
    </div>
    <div class="modal-body col gap-12">
      <div class="info-banner danger">${ic('alert')}<span>The template is removed from the AE catalog and the public site <b>immediately</b> and is unpublished. Files are kept as evidence — you can restore it later.</span></div>
      <div><div class="adx-flab">TAKEDOWN REASON (stored on the template, min 3 characters)</div>
        <textarea id="dmReason" class="textarea" rows="3">${esc(reason)}</textarea></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="openDmcaReport('${esc(reportId)}')">Back</button>
      <button class="btn btn-danger" onclick="doDmcaTakedown('${esc(reportId)}')">Take down now</button>
    </div>`);
}

async function doDmcaTakedown(reportId){
  const r = dmById(reportId);
  if(!r || !r.templateId) return;
  const el = document.getElementById('dmReason');
  const reason = el ? el.value.trim() : '';
  if(reason.length < 3){ toast('Takedown', 'A reason is required (min 3 characters)', 'warn'); return; }
  try{
    await StudioApi.takedownTemplate(r.templateId, reason);
    // Takedown muvaffaqiyatli bo'lgandagina hisobot yopiladi (aks holda "actioned"
    // deb ko'rsatilib, shablon jonli qolib ketardi).
    await StudioApi.resolveInfringementReport(reportId, 'actioned', reason);
    closeModal();
    toast('Taken down', 'Template removed from the catalog', 'success');
    if(typeof StudioTemplates !== 'undefined' && StudioTemplates.refreshAfterReview) await StudioTemplates.refreshAfterReview();
    await refreshDmca();
  }catch(e){
    toast('Takedown failed', e.message || 'API', 'danger');
  }
}

/* ── Tiklash ─────────────────────────────────────────────── */

function openDmcaRestore(templateId){
  const t = DM_TAKEDOWNS.find(x => x.id === templateId);
  openModal(`
    <div class="modal-head">
      <div class="modal-ico" style="background:var(--green-dim);color:var(--green)">${ic('refresh')}</div>
      <div><h3>Restore template</h3><p>${esc(t ? t.name : templateId)}</p></div>
    </div>
    <div class="modal-body col gap-12">
      <div class="info-banner">${ic('alert')}<span>The takedown flag is cleared. Tick "republish" to put an <b>approved</b> template straight back into the AE catalog — otherwise it stays unpublished until you publish it.</span></div>
      <label style="display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--text2);cursor:pointer">
        <input type="checkbox" id="dmRepub" checked> Republish in the catalog (approved templates only)</label>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doDmcaRestore('${esc(templateId)}')">Restore</button>
    </div>`);
}

async function doDmcaRestore(templateId){
  const rep = (document.getElementById('dmRepub') || {}).checked;
  try{
    const out = await StudioApi.restoreTemplate(templateId, rep);
    closeModal();
    const live = out && out.published;
    toast('Restored', live ? 'Back in the AE catalog' : 'Takedown cleared — still unpublished', live ? 'success' : 'info');
    if(typeof StudioTemplates !== 'undefined' && StudioTemplates.refreshAfterReview) await StudioTemplates.refreshAfterReview();
    await refreshDmca();
  }catch(e){
    // 409 NOT_APPROVED — republish faqat APPROVED yozuv uchun.
    toast('Restore failed', e.message || 'API', 'danger');
  }
}
