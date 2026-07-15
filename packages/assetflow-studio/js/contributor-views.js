/* ============================================================
   AssetFlow — Contributor views
   Overview, My templates, Upload, Detail drawer, Messages, Settings
   ============================================================ */
window.VIEWS = window.VIEWS || {};
window.afterRender = window.afterRender || {};

/** XSS protection — escapes server/user text before inserting into innerHTML */
const esc = (s) =>
  window.StudioMedia && StudioMedia.escapeHtml
    ? StudioMedia.escapeHtml(s)
    : String(s == null ? "" : s).replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
      );

function contributorId() {
  const s = typeof AssetFlowAuth !== "undefined" ? AssetFlowAuth.getSession() : null;
  return s?.userId || window.ME || "";
}

function thumbArt(grad, dur, lg){
  return `<div class="thumb ${grad} grain" style="width:100%;height:${lg?'100%':'30px'}">
    <div class="play"><span>${ic('play')}</span></div>${dur?`<span class="dur">${dur}</span>`:''}</div>`;
}
function kpiCard(o){
  return `<div class="kpi"><div class="kpi-top"><div class="kpi-ico" style="background:var(--${o.c}-dim);color:var(--${o.c})">${ic(o.ic)}</div><span class="kpi-label">${o.label}</span></div>
    <div class="kpi-val">${o.val}</div><div class="kpi-foot">${o.trend!=null?`<span class="trend ${o.trend>0?'up':'down'}">${ic(o.trend>0?'trendUp':'trendDn')}${Math.abs(o.trend)}%</span>`:''}<span>${o.foot||''}</span></div></div>`;
}
function infoBanner(text, kind){ return `<div class="info-banner ${kind||''}">${ic('ext')}<span>${text}</span></div>`; }

/** #15 Preview background-transcode status badge — only shown for 'pending'/'failed'.
    'done'/null → empty string (no badge). Uses the existing .badge-* style. */
function transcodeBadge(status){
  if (status === 'pending')
    return `<span class="badge badge-pending" title="Preview is being compressed to 720p"><span class="dot"></span>${esc('Compressing…')}</span>`;
  if (status === 'failed')
    return `<span class="badge badge-hard" title="Preview compression failed — showing raw file"><span class="dot"></span>${esc('Compression failed')}</span>`;
  return '';
}

/* FAZA 5 (C1) — pack xavfsizlik skan holati badge'i (contributor ko'rinishi).
   Admin moderatsiyadagi adxPackScanInfo bilan BIR XIL statuslar; matn contributor
   tiliga moslangan (admin "Clear pack" harakati bu yerda taklif qilinmaydi).
   Ilgari karantin/duplicate shablon shunchaki "Pending" bo'lib jim turardi. */
function scanBadge(status){
  const M = {
    pending:     { cls:'badge-pending', lab:'Security check…', tip:'The pack security scan hasn’t finished yet. This usually resolves automatically.' },
    quarantined: { cls:'badge-soft',    lab:'Security review', tip:'The security check was inconclusive — an admin will review this pack manually.' },
    duplicate:   { cls:'badge-hard',    lab:'Duplicate pack',  tip:'This pack is identical to another template — it cannot be approved. Delete and upload an original pack.' },
    malicious:   { cls:'badge-hard',    lab:'Blocked (security)', tip:'The malware scan flagged this pack — it cannot be approved. Delete and re-upload a clean pack.' },
  };
  const m = M[status];
  if (!m) return '';
  return `<span class="badge ${m.cls}" title="${esc(m.tip)}"><span class="dot"></span>${esc(m.lab)}</span>`;
}

/* Drawer uchun to'liq banner varianti (badge + tushuntirish matni). */
function scanNotice(t){
  const b = scanBadge(t && t.packScanStatus);
  if (!b) return '';
  const detail = t.packScanDetail && String(t.packScanDetail).trim()
    ? `<div class="small" style="margin-top:4px;color:var(--muted)">${esc(t.packScanDetail)}</div>` : '';
  return `<div style="margin-top:10px">${b}${detail}</div>`;
}

/* ============================================================
   OVERVIEW
   ============================================================ */
VIEWS.overview = function(){
  const ts = tByContributor(contributorId());
  const ap=ts.filter(t=>t.status==='approved').length, pe=ts.filter(t=>t.status==='pending').length,
        sr=ts.filter(t=>t.status==='soft').length, hr=ts.filter(t=>t.status==='hard').length;
  const dl=ts.reduce((a,t)=>a+(t.dl||0),0);
  const im=ts.reduce((a,t)=>a+(t.imports||0),0);
  const needsAction = ts.filter(t=>t.status==='soft' || t.status==='draft');
  const sc = subscriberCounts();
  const freeP = planById('free');
  const proP = planById('pro');
  return `<div class="col gap-20">
    ${infoBanner('Subscribers use the AE plugin in <b>Free</b> or <b>Pro</b> mode. Your approved templates appear in <b>After Effects \u2192 FrameFlow Browse</b>.')}

    <div class="plan-mini-row">
      <div class="plan-mini plan-mini-free">
        <span class="label">Free subscribers</span>
        <span class="num" style="font-size:22px;font-weight:700">${sc.free}</span>
        <span class="small">${formatPlanLimit(freeP)} downloads</span>
      </div>
      <div class="plan-mini plan-mini-pro">
        <span class="label">Pro subscribers</span>
        <span class="num" style="font-size:22px;font-weight:700">${sc.pro}</span>
        <span class="small">${planPriceLabel(proP)} · ${formatPlanLimit(proP)}</span>
      </div>
      <div class="plan-mini">
        <span class="label">Downloads / imports</span>
        <span class="num" style="font-size:22px;font-weight:700">${dl.toLocaleString()} <span style="font-size:13px;font-weight:500;color:var(--text-dim)">/ ${im.toLocaleString()} imports</span></span>
        <span class="small">across ${ap} approved templates</span>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard({label:'Total uploaded',val:ts.length,ic:'layers',c:'violet',foot:'all statuses'})}
      ${kpiCard({label:'Approved',val:ap,ic:'checkCircle',c:'green',foot:'live in AE'})}
      ${kpiCard({label:'Pending',val:pe,ic:'clock',c:'yellow',foot:'in moderation'})}
      ${kpiCard({label:'Rejected',val:sr+hr,ic:'xCircle',c:'orange',foot:`${sr} soft \u00b7 ${hr} hard`})}
    </div>

    <div class="ov-grid">
      <!-- next step + needs action -->
      <div class="col gap-16">
        <div class="card" style="background:linear-gradient(120deg,var(--violet-dim),transparent);border-color:var(--violet-line)">
          <div class="card-pad row between center gap-16 wrap">
            <div class="col gap-4"><span class="h3">Next step</span><span class="small" style="max-width:380px">Upload a new motion template \u2014 once it passes moderation it goes live in the AE catalog.</span></div>
            <button class="btn btn-primary btn-lg" onclick="startNewUpload()">${ic('upload')} Upload new template</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div><h3>Needs attention</h3><span class="small">Soft rejects and drafts</span></div></div>
          <div class="col">
            ${needsAction.length? needsAction.map(t=>`<div class="row center gap-12" style="padding:13px 18px;border-bottom:1px solid var(--line-soft)">
              <div class="row-thumb" style="width:54px;height:34px">${thumbArt(t.grad,'',true)}</div>
              <div class="col grow" style="gap:3px;min-width:0"><span class="cell-strong">${esc(t.name)}</span><span class="small">${t.status==='soft'?'Soft reject \u2014 fix and resubmit':'Draft \u2014 not yet submitted'}</span></div>
              ${badge(t.status)}
              ${t.status==='draft'?`<button class="btn btn-primary btn-sm" onclick="submitDraftToModeration('${t.id}')">${ic('upload')} Submit</button>`:''}
              <button class="btn btn-ghost btn-sm" onclick="openTplDrawer('${t.id}')">View</button>
            </div>`).join('') : `<div class="empty" style="padding:34px"><div class="ico">${ic('checkCircle')}</div><h3>All good</h3><p>No templates need attention.</p></div>`}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Activity history</h3></div>
          <div class="card-pad">${ts.length ? `<div class="timeline">${ts.slice(0,5).map(t=>`<div class="tl-item"><div class="tl-dot" style="background:var(--${t.status==='approved'?'green':'violet'})">${ic(t.status==='approved'?'check':'upload')}</div><div class="tl-title">${esc(t.name)}</div><div class="tl-meta">${badge(t.status)} \u00b7 ${esc(t.created||'')}</div></div>`).join('')}</div>` : `<div class="empty" style="padding:24px"><p class="small">No activity yet</p></div>`}
          </div>
        </div>
      </div>

      <!-- recent admin messages -->
      <div class="card">
        <div class="card-head"><div><h3>Admin messages</h3><span class="small">Recent</span></div><button class="btn btn-subtle btn-sm" onclick="route('messages')">View all ${ic('chevR')}</button></div>
        <div class="col" id="ovMsgs">
          <div class="empty" style="padding:34px"><div class="ico">${ic('message')}</div><h3>No messages</h3><p class="small">Admin replies will appear here</p></div>
        </div>
      </div>
    </div>
  </div>`;
};

/** When Overview opens, loads admin messages from the API and fills the panel */
window.afterRender.overview = async function(){
  if (!StudioApi.token()) return;
  try {
    const data = await StudioApi.listMessageThreads();
    const threads = (data.items || data.threads || []).slice(0, 4);
    const box = document.getElementById('ovMsgs');
    if (!box || !threads.length) return;
    box.innerHTML = threads.map(th => `<div class="row center gap-12" style="padding:12px 18px;border-bottom:1px solid var(--line-soft);cursor:pointer" onclick="route('messages')">
      <div class="col grow" style="gap:2px;min-width:0">
        <span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(th.subject || 'Message')}</span>
        <span class="small">${esc(fmtLocalDate(th.lastMessageAt))}</span>
      </div>
      ${th.unreadCount ? `<span class="badge badge-pending"><span class="dot"></span>${esc(th.unreadCount)} new</span>` : ''}
    </div>`).join('');
  } catch (e) {
    /* messages panel is optional \u2014 overview is not blocked */
  }
};

/* ============================================================
   MY TEMPLATES — table + grid toggle
   ============================================================ */
let MY_VIEW='table', MY_FILTER='all';
VIEWS.templates = function(){ return `<div id="myRoot"></div>`; };
window.afterRender.templates = function(){ renderMy(); };

function renderMy(){
  let ts = tByContributor(contributorId());
  if(MY_FILTER!=='all') ts = ts.filter(t=>t.status===MY_FILTER);
  const q = (typeof CONTRIB_SEARCH !== "undefined" ? CONTRIB_SEARCH : "").trim();
  if (q) ts = ts.filter((t) => (t.name + " " + t.cat + " " + t.id).toLowerCase().includes(q));
  const all = tByContributor(contributorId());
  const cnt = s=>all.filter(t=>t.status===s).length;
  document.getElementById('myRoot').innerHTML = `<div class="col gap-16">
    <div class="toolbar between">
      <div class="chips">
        ${[['all','All',all.length],['approved','Approved',cnt('approved')],['pending','Pending',cnt('pending')],['soft','Soft reject',cnt('soft')],['hard','Hard reject',cnt('hard')],['draft','Draft',cnt('draft')]].map(([k,l,n])=>
          `<button class="chip ${MY_FILTER===k?'active':''}" onclick="MY_FILTER='${k}';renderMy()">${l}<span class="cnt">${n}</span></button>`).join('')}
      </div>
      <div class="segmented">
        <button class="${MY_VIEW==='table'?'active':''}" onclick="MY_VIEW='table';renderMy()">${ic('list')} Table</button>
        <button class="${MY_VIEW==='grid'?'active':''}" onclick="MY_VIEW='grid';renderMy()">${ic('grid')} Grid</button>
      </div>
    </div>
    ${ts.length? (MY_VIEW==='table'?myTable(ts):myGrid(ts)) : `<div class="card"><div class="empty"><div class="ico">${ic('layers')}</div><h3>No templates</h3><p>No templates match this filter. Upload a new template to get started.</p><button class="btn btn-primary" onclick="startNewUpload()">${ic('upload')} Upload new</button></div></div>`}
  </div>`;
}
function myTable(ts){
  return `<div class="card"><div class="table-wrap"><table class="data" style="min-width:820px">
    <thead><tr><th>Template</th><th>Status</th><th>Created</th><th class="th-num">Downloads / imports</th><th>Admin note</th><th style="width:130px"></th></tr></thead>
    <tbody>${ts.map(t=>`<tr style="cursor:pointer" onclick="openTplDrawer('${t.id}')">
      <td><div class="tmpl-cell"><div class="row-thumb">${thumbArt(t.grad,'',true)}</div><div class="tmpl-meta"><span class="nm">${esc(t.name)}</span><span class="sub">${esc(t.cat)}</span></div></div></td>
      <td>${badge(t.status)}${t.status==='approved'?'<div class="small" style="color:var(--green);margin-top:3px;font-size:10.5px">Live in AE</div>':''}${scanBadge(t.packScanStatus)?`<div style="margin-top:3px">${scanBadge(t.packScanStatus)}</div>`:''}${transcodeBadge(t.previewTranscodeStatus)?`<div style="margin-top:3px">${transcodeBadge(t.previewTranscodeStatus)}</div>`:''}</td>
      <td class="cell-muted mono">${esc(t.created)}</td>
      <td class="cell-num cell-strong">${t.dl?t.dl.toLocaleString():'\u2014'}${t.imports?`<div class="small" style="font-size:10.5px;font-weight:400">${t.imports.toLocaleString()} imports</div>`:''}</td>
      <td class="cell-muted" style="max-width:200px">${t.reason?`<span style="color:var(--orange)">${esc(t.reason.slice(0,46))}\u2026</span>`:'\u2014'}</td>
      <td onclick="event.stopPropagation()"><div class="row-actions">
        ${(t.status==='draft'||t.status==='soft')?`<button class="act" title="Edit" onclick="event.stopPropagation();openEditTemplate('${t.id}')">${ic('edit')}</button>`:''}
        ${(t.status==='draft'||t.status==='soft')?`<button class="act success" title="Submit to moderation" onclick="submitDraftToModeration('${t.id}')">${ic('upload')}</button>`:''}
        ${t.status==='soft'?`<button class="act" title="Resubmit" onclick="resubmit('${t.id}')">${ic('refresh')}</button>`:''}
        <button class="act" title="View" onclick="openTplDrawer('${t.id}')">${ic('eye')}</button>
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div></div>`;
}
function myGrid(ts){
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:16px">
    ${ts.map(t=>`<div class="card" style="overflow:hidden;cursor:pointer" onclick="openTplDrawer('${t.id}')">
      <div class="thumb ${t.grad} grain" style="width:100%;aspect-ratio:16/10"><div class="play"><span>${ic('play')}</span></div>${t.dur?`<span class="dur">${esc(t.dur)}</span>`:''}<div style="position:absolute;top:8px;left:8px;display:flex;flex-direction:column;gap:4px;align-items:flex-start">${badge(t.status)}${scanBadge(t.packScanStatus)}${transcodeBadge(t.previewTranscodeStatus)}</div></div>
      <div class="card-pad col gap-8">
        <div class="col" style="gap:2px"><span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</span><span class="small">${esc(t.cat)} \u00b7 ${esc(t.created)}</span></div>
        <div class="row between center"><span class="small">${t.dl?t.dl.toLocaleString()+' downloads':'\u2014'}</span>
        ${t.status==='soft'?`<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();resubmit('${t.id}')">${ic('refresh')} Resubmit</button>`:''}</div>
      </div>
    </div>`).join('')}
  </div>`;
}
async function submitDraftToModeration(id) {
  if (!StudioApi.token()) {
    toast("API", "Please sign in again", "warn");
    return;
  }
  // Audit §D (P1) — rights dead-end: wizard'dan oldin saqlangan draft'da rightsAcceptedAt
  // bo'lmaydi; ro'yxat/drawer submit'i 400 RIGHTS_REQUIRED bilan abadiy bloklanardi.
  // Endi attestatsiya shu yerda modal bilan so'raladi va submit body'da yuboriladi.
  const t = TEMPLATES.find((x) => x.id === id);
  if (t && t._api && !t._api.rightsAcceptedAt) {
    openRightsSubmitModal(id);
    return;
  }
  try {
    await StudioApi.submitTemplate(id);
    await StudioTemplates.refreshAfterUpload();
    toast("Submitted", "Sent to the moderation queue — the admin will review it", "success");
    if (CURRENT === "overview" || CURRENT === "templates") {
      if (CURRENT === "overview") route("overview");
      else renderMy();
    }
    closeDrawer();
  } catch (e) {
    toast("Error", e.message || "Submission failed", "danger");
  }
}

async function resubmit(id) {
  await submitDraftToModeration(id);
}

/** Audit §D — ro'yxat/drawer submit'ida rights-attestatsiya modali (wizard Step 3 muqobili). */
let RIGHTS_MODAL_CHECKED = false;
function openRightsSubmitModal(id) {
  RIGHTS_MODAL_CHECKED = false;
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--green-dim,rgba(130,195,65,.12));color:var(--green,#82c341)">${ic("check")}</div>
      <div><h3>Confirm your rights</h3><p>Required once before this product can be submitted</p></div></div>
    <div class="modal-body col gap-12">
      <label class="row gap-8" style="cursor:pointer;align-items:flex-start"><div id="rightsModalCheck" class="checkbox" onclick="toggleRightsModal()">${ic("check")}</div><span class="body" style="flex:1">${RIGHTS_ATTEST_TEXT}</span></label>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" id="rightsModalSubmit" disabled onclick="confirmRightsSubmit('${id}')">${ic("check")} Submit for moderation</button></div>`);
}
function toggleRightsModal() {
  RIGHTS_MODAL_CHECKED = !RIGHTS_MODAL_CHECKED;
  const box = document.getElementById("rightsModalCheck");
  const btn = document.getElementById("rightsModalSubmit");
  if (box) box.classList.toggle("on", RIGHTS_MODAL_CHECKED);
  if (btn) btn.disabled = !RIGHTS_MODAL_CHECKED;
}
async function confirmRightsSubmit(id) {
  if (!RIGHTS_MODAL_CHECKED) return;
  closeModal();
  try {
    await StudioApi.submitTemplate(id, {
      rightsAccepted: true,
      rightsTermsVersion: RIGHTS_TERMS_VERSION,
    });
    await StudioTemplates.refreshAfterUpload();
    toast("Submitted", "Sent to the moderation queue — the admin will review it", "success");
    if (CURRENT === "overview") route("overview");
    else if (CURRENT === "templates") renderMy();
    closeDrawer();
  } catch (e) {
    toast("Error", e.message || "Submission failed", "danger");
  }
}
window.openRightsSubmitModal = openRightsSubmitModal;
window.toggleRightsModal = toggleRightsModal;
window.confirmRightsSubmit = confirmRightsSubmit;

/* ============================================================
   UPLOAD WIZARD
   ============================================================ */
let UP_STEP=1;
let UP_EDIT_ID = null;
const UP_DRAFT = { files: {} };
// FAZA 1b — contributor rights attestation (majburiy). Submit shu true bo'lmaguncha bloklanadi.
let UP_RIGHTS = false;
let BULK_RIGHTS = false;
const RIGHTS_TERMS_VERSION = "2026-07-08";
const RIGHTS_ATTEST_TEXT =
  "I confirm I own this content or have the necessary rights to distribute it, and it does not infringe third-party rights.";
// Signature of files uploaded during the media step (to avoid re-uploading) + status
let UP_UPLOADED_SIG = "";
let UP_UPLOADING = false;

/* ============================================================
   Stock S1 — mahsulot turi (kind) tanlovi (docs/STOCK-EXPANSION-PLAN.md)
   Tanlangan karta kind/stockType/templateApp + qabul formatlar +
   Step-1 maydonlarini belgilaydi. TEMPLATE_TYPES/STOCK_CATS — data.js.
   ============================================================ */
const PRODUCT_KIND_GROUPS = [
  {
    kind: "template",
    label: "Template",
    options: [
      { sub: "ae", label: "After Effects", exts: [".aep", ".ffx", ".zip"] },
      { sub: "pr", label: "Premiere Pro", exts: [".mogrt", ".zip"] },
      { sub: "motion", label: "Apple Motion", exts: [".motn", ".zip"] },
      { sub: "resolve", label: "DaVinci Resolve", exts: [".drfx", ".setting", ".zip"] },
    ],
  },
  {
    kind: "stock",
    label: "Stock",
    options: [
      { sub: "video", label: "Video", exts: [".mp4", ".mov"] },
      { sub: "music", label: "Music", exts: [".wav", ".mp3", ".aiff"] },
      { sub: "sfx", label: "Sound FX", exts: [".wav", ".aiff"] },
      { sub: "photo", label: "Photo", exts: [".jpg", ".jpeg", ".png", ".webp"] },
    ],
  },
];

/** Joriy tanlov (kind + sub) uchun option konfiguratsiyasi; tanlanmagan bo'lsa null. */
function upKindOption() {
  const grp = PRODUCT_KIND_GROUPS.find((g) => g.kind === UP_DRAFT.kind);
  if (!grp) return null;
  const sub = UP_DRAFT.kind === "stock" ? UP_DRAFT.stockType : UP_DRAFT.templateApp;
  return grp.options.find((o) => o.sub === sub) || null;
}

/** Granular kategoriya → keng Type taklifi (foydalanuvchi o'zgartira oladi). */
function typeForCatLabel(label) {
  const l = String(label || "").toLowerCase();
  if (l === "luts") return "luts";
  if (["infographics", "social media", "logos", "mockups", "backgrounds"].includes(l)) return "graphics";
  if (["titles", "lower thirds", "transitions", "intros", "openers", "overlays", "slideshows"].includes(l)) return "motion-graphics";
  return "video-templates";
}

function selectProductKind(kind, sub) {
  saveUploadStep1(); // yozilgan name/desc yo'qolmasin
  const branchChanged =
    UP_DRAFT.kind !== kind || (kind === "stock" && UP_DRAFT.stockType !== sub);
  UP_DRAFT.kind = kind;
  if (kind === "stock") {
    UP_DRAFT.stockType = sub;
  } else {
    UP_DRAFT.templateApp = sub;
    UP_DRAFT.stockType = null;
  }
  // Boshqa taksonomiyaga o'tildi — eski kategoriya endi mos emas
  if (branchChanged) UP_DRAFT.catLabel = "";
  renderUpload();
}
window.selectProductKind = selectProductKind;

/** Step-3 xulosa pill matni: "Stock · Music" yoki "After Effects · Motion Graphics". */
function upKindSummary() {
  const o = upKindOption();
  if (UP_DRAFT.kind === "stock") return "Stock · " + (o ? o.label : "");
  const tt = TEMPLATE_TYPES.find((t) => t.value === (UP_DRAFT.templateType || "video-templates"));
  return (o ? o.label : "After Effects") + (tt ? " · " + tt.label : "");
}

/** Kategoriya o'zgarganda keng Type taklifini sinxronlash (faqat template branch). */
function onUpCatChange() {
  const cat = document.getElementById("upCat")?.value;
  const typeEl = document.getElementById("upType");
  if (cat && typeEl) typeEl.value = typeForCatLabel(cat);
}
window.onUpCatChange = onUpCatChange;

/** Motion-Elements uslubidagi guruhlangan kind-picker kartasi (Step 1 tepasi). */
function kindPickerCard() {
  const groups = PRODUCT_KIND_GROUPS.map((g) => `
    <div class="col gap-8 grow" style="min-width:230px">
      <span class="small" style="font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text-dim)">${g.label}</span>
      ${g.options.map((o) => {
        const active =
          UP_DRAFT.kind === g.kind &&
          (g.kind === "stock" ? UP_DRAFT.stockType : UP_DRAFT.templateApp) === o.sub;
        return `<button type="button" onclick="selectProductKind('${g.kind}','${o.sub}')"
          style="display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;cursor:pointer;padding:10px 12px;border-radius:10px;border:1px solid ${active ? "var(--green,#82c341)" : "var(--line,#2a2a2a)"};background:${active ? "rgba(130,195,65,.08)" : "transparent"};color:inherit;font:inherit;width:100%">
          <span class="body" style="font-weight:600">${o.label}</span>
          <span class="small" style="color:var(--text-dim)">${o.exts.join(" · ")}</span>
        </button>`;
      }).join("")}
    </div>`).join("");
  return `<div class="card card-pad col gap-12">
    <div class="col" style="gap:2px"><span class="h3">What are you uploading?</span>
    <span class="small" style="color:var(--text-dim)">Pick a product type — it sets the accepted file formats and the fields below.</span></div>
    <div class="row gap-16 wrap" style="align-items:flex-start">${groups}</div>
  </div>`;
}

/* ============================================================
   BULK ZIP UPLOAD (cloud ingest) — each .zip = one template
   (project file + preview image + preview video), auto-processed
   server-side into a PENDING_REVIEW template. No manual form.
   ============================================================ */
// P1 (step 30) — YUKLASH endi FAQAT bulk (kategoriya-asosli). Wizard (single) faqat
// TAHRIRLASH uchun qoladi (openEditTemplate uni ishlatadi). UP_MODE 'single' = edit wizard.
let UP_MODE = "bulk"; // 'bulk' (yangi yuklash) | 'single' (faqat edit — openEditTemplate)
let BULK_CAT = null; // tanlangan taxon key (video-templates|luts|graphics|motion-graphics|music|sfx)
let BULK_FILES = []; // { file, stage: 'queued'|'uploading'|'processing'|'done'|'duplicate'|'error', pct, error, id }
let BULK_RUNNING = false;
let BULK_SUMMARY = null; // P3 — { done, dup, err } tugagan partiya; success card ko'rsatish uchun

/** Yangi bulk yuklashni boshlaydi (edit holatini tozalaydi). "Upload" tugmalari chaqiradi. */
function startNewUpload() {
  UP_EDIT_ID = null;
  UP_MODE = "bulk";
  BULK_FILES = [];
  BULK_RIGHTS = false;
  BULK_SUMMARY = null;
  route("upload");
}
window.startNewUpload = startNewUpload;

/** Kategoriyani tanlaydi (top-level yoki stock sub). Fayllarni tozalaydi (ext o'zgaradi). */
function selectBulkCat(key) {
  if (BULK_RUNNING) return;
  if (!taxonByKey(key)) return;
  BULK_CAT = key;
  BULK_FILES = [];
  renderUpload();
}
window.selectBulkCat = selectBulkCat;

/** Tanlangan kategoriya ruxsat etgan kengaytmalar (dropzone accept + filtr). */
function bulkAcceptExts() {
  const t = taxonByKey(BULK_CAT);
  return t ? t.exts : [];
}

function bulkAddFiles(fileList) {
  const t = taxonByKey(BULK_CAT);
  if (!t) {
    toast("Upload", "Choose a category first", "warn");
    return;
  }
  const incoming = Array.from(fileList || []);
  const exts = t.exts;
  const extRe = new RegExp("(" + exts.map((e) => e.replace(".", "\\.")).join("|") + ")$", "i");
  const ok = incoming.filter((f) => extRe.test(f.name));
  if (incoming.length && !ok.length) {
    toast("Upload", `${t.label} accepts: ${exts.join(", ")}`, "warn");
  }
  for (const f of ok) {
    if (BULK_FILES.some((b) => b.file.name === f.name && b.file.size === f.size)) continue;
    if (!checkUploadFile(f, t.label)) continue;
    BULK_FILES.push({ file: f, stage: "queued", pct: 0 });
  }
  renderUpload();
}

function bulkRemoveFile(i) {
  if (BULK_RUNNING) return;
  BULK_FILES.splice(i, 1);
  renderUpload();
}

function bulkClearFinished() {
  if (BULK_RUNNING) return;
  BULK_FILES = BULK_FILES.filter((b) => b.stage !== "done" && b.stage !== "duplicate");
  renderUpload();
}

/** P3 — success card "Upload more": done+dup qatorlarni tozalaydi, xato qatorlar (retry uchun)
 *  qoladi, huquq checkbox'i qayta so'raladi (yangi partiya uchun). */
function bulkUploadMore() {
  if (BULK_RUNNING) return;
  BULK_FILES = BULK_FILES.filter((b) => b.stage !== "done" && b.stage !== "duplicate");
  BULK_SUMMARY = null;
  BULK_RIGHTS = false;
  renderUpload();
}
window.bulkUploadMore = bulkUploadMore;

function bulkStageLabel(b) {
  if (b.stage === "queued") return "Waiting…";
  if (b.stage === "uploading") return `Uploading… ${b.pct}%`;
  if (b.stage === "processing") return "Processing…";
  if (b.stage === "done") return "✓ Sent to moderation";
  if (b.stage === "duplicate") return `⊘ ${b.error || "Duplicate — already exists"}`;
  if (b.stage === "error") return `✗ ${b.error || "Failed"}`;
  return "";
}
function bulkStageColor(b) {
  if (b.stage === "done") return "var(--green,#82c341)";
  if (b.stage === "duplicate") return "var(--amber,#f59e0b)";
  if (b.stage === "error") return "var(--red,#ef4444)";
  return "var(--text-dim)";
}
function bulkFillColor(b) {
  if (b.stage === "error") return "var(--red,#ef4444)";
  if (b.stage === "duplicate") return "var(--amber,#f59e0b)";
  return "var(--green,#82c341)";
}

function bulkRenderRow(b, i) {
  const removable = b.stage === "queued" || b.stage === "error" || b.stage === "duplicate";
  return `<div class="up-prog-row" id="bulk-row-${i}" style="display:flex;flex-direction:column;gap:5px;padding:8px 0;border-bottom:1px solid var(--line,#2a2a2a)">
    <div class="row between center" style="font-size:12px;gap:8px">
      <span class="trunc" title="${esc(b.file.name)}" style="min-width:0">${ic("file")} ${esc(b.file.name)} · ${fmtMB(b.file.size)}</span>
      <div class="row gap-8 center">
        <span class="bulk-stat" style="color:${bulkStageColor(b)};white-space:nowrap">${esc(bulkStageLabel(b))}</span>
        <button class="btn btn-icon btn-sm btn-ghost" style="${removable ? "" : "visibility:hidden"}" onclick="bulkRemoveFile(${i})">${ic("x")}</button>
      </div>
    </div>
    <div style="height:6px;background:var(--line,#2a2a2a);border-radius:4px;overflow:hidden">
      <div class="bulk-fill" style="height:100%;width:${b.stage === "done" || b.stage === "duplicate" ? 100 : b.pct}%;background:${bulkFillColor(b)};transition:width .15s"></div>
    </div>
  </div>`;
}

function bulkUpdateRow(idx) {
  const b = BULK_FILES[idx];
  const row = document.getElementById(`bulk-row-${idx}`);
  if (!b || !row) return;
  const fill = row.querySelector(".bulk-fill");
  const stat = row.querySelector(".bulk-stat");
  if (fill) {
    fill.style.width = (b.stage === "done" || b.stage === "duplicate" ? 100 : b.pct) + "%";
    fill.style.background = bulkFillColor(b);
  }
  if (stat) {
    stat.textContent = bulkStageLabel(b);
    stat.style.color = bulkStageColor(b);
  }
}

function bulkDzHandlers() {
  const dz = document.getElementById("bulkDz");
  const input = document.getElementById("bulkFileInput");
  if (!dz || !input) return;
  dz.onclick = () => input.click();
  input.onchange = () => {
    bulkAddFiles(input.files);
    input.value = "";
  };
  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove("drag");
    })
  );
  dz.addEventListener("drop", (e) => bulkAddFiles(e.dataTransfer && e.dataTransfer.files));
}

async function startBulkIngest() {
  if (BULK_RUNNING) return;
  const t = taxonByKey(BULK_CAT);
  if (!t) {
    toast("Upload", "Choose a category first", "warn");
    return;
  }
  if (!StudioApi.token()) {
    toast("API", "Please sign in first", "warn");
    return;
  }
  if (!BULK_RIGHTS) {
    toast("Rights", "Please confirm you have the rights to distribute this content", "warn");
    return;
  }
  const queued = BULK_FILES.filter((b) => b.stage === "queued" || b.stage === "error");
  if (!queued.length) return;
  queued.forEach((b) => {
    b.stage = "queued";
    b.pct = 0;
    b.error = null;
  });
  BULK_RUNNING = true;
  renderUpload();
  const onProg = (qi, p) => {
    const b = queued[qi];
    const idx = BULK_FILES.indexOf(b);
    if (p.stage) b.stage = p.stage;
    if (typeof p.pct === "number") b.pct = p.pct;
    if (p.error) b.error = p.error;
    if (p.id) b.id = p.id;
    bulkUpdateRow(idx);
  };
  const rights = { rightsAccepted: true, rightsTermsVersion: RIGHTS_TERMS_VERSION };
  const files = queued.map((b) => b.file);
  const noun = t.kind === "stock" ? "asset" : t.key === "luts" ? "LUT" : "template";
  try {
    // Video Templates → zip quvuri; LUTs/Stock → xom-fayl quvuri (fayl = pack).
    if (t.source === "zip") {
      await StudioApi.bulkIngestZips(files, onProg, rights);
    } else {
      await StudioApi.bulkIngestAssets(t.key, files, onProg, rights);
    }
    const doneCount = queued.filter((b) => b.stage === "done").length;
    const dupCount = queued.filter((b) => b.stage === "duplicate").length;
    const errCount = queued.filter((b) => b.stage === "error").length;
    if (doneCount) {
      toast("Upload", `${doneCount} ${noun}(s) sent to moderation`, "success");
      await StudioTemplates.refreshAfterUpload();
    }
    if (dupCount) {
      toast("Upload", `${dupCount} duplicate(s) skipped — already exists`, "warn");
    }
    if (errCount) {
      toast("Upload", `${errCount} file(s) failed — see the list below`, "warn");
    }
    // P3 — partiya tugadi (queue'da hech narsa qolmadi) va kamida bittasi o'tdi → success card.
    if (doneCount && !BULK_FILES.some((b) => b.stage === "queued")) {
      BULK_SUMMARY = { done: doneCount, dup: dupCount, err: errCount };
    }
  } catch (e) {
    toast("Error", e.message || "Upload failed", "danger");
  } finally {
    BULK_RUNNING = false;
    renderUpload();
  }
}

/** Kategoriya tanlash kartalari (top-level + Stock sub). */
function bulkCatPicker() {
  const card = (key, label, icon, active) =>
    `<button class="up-cat${active ? " active" : ""}" onclick="selectBulkCat('${key}')"
       style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;border:1px solid ${active ? "var(--violet-bright,#8b5cf6)" : "var(--line,#2a2a2a)"};border-radius:12px;background:${active ? "var(--violet-dim,rgba(139,92,246,.12))" : "transparent"};cursor:pointer;min-width:0">
       <span style="font-size:20px">${ic(icon)}</span>
       <span class="body" style="font-weight:600;text-align:center">${esc(label)}</span>
     </button>`;
  const cards = UPLOAD_TAXONOMY.map((t) => card(t.key, t.label, t.icon, BULK_CAT === t.key)).join("");
  return `<div class="col gap-8">
    <div class="small" style="color:var(--text-dim)">What are you uploading?</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">${cards}</div>
  </div>`;
}

function renderBulkUpload() {
  const root = document.getElementById("upRoot");
  if (!root) return;

  // P3 — partiya tugagach ro'yxat abadiy osilib qolmasin: dropzone+qatorlar o'rniga
  // qisqa xulosa karta (done+dup qatorlar yashirin, xato qatorlar retry uchun qoladi).
  if (BULK_SUMMARY && !BULK_RUNNING) {
    const s = BULK_SUMMARY;
    const leftover = BULK_FILES.map((b, i) => ({ b, i })).filter(({ b }) => b.stage === "duplicate" || b.stage === "error");
    root.innerHTML = `<div style="max-width:880px;margin:0 auto" class="col gap-20">
      <div class="row between center">
        <h2 class="h2" style="margin:0">Upload</h2>
      </div>
      <div class="card card-pad col gap-16">
        <div class="empty" style="padding:36px 24px">
          <div class="ico" style="color:var(--green,#82c341);border-color:var(--green,#82c341)">${ic("checkCircle")}</div>
          <h3>${s.done} asset${s.done === 1 ? "" : "s"} sent to moderation</h3>
          <p>They'll appear in My templates with a Pending review status.</p>
        </div>
        ${s.dup ? infoBanner(`${s.dup} duplicate${s.dup === 1 ? "" : "s"} skipped — already exists`, "warn") : ""}
        ${s.err ? infoBanner(`${s.err} file${s.err === 1 ? "" : "s"} failed — see below`, "danger") : ""}
        ${leftover.length ? `<div class="col">${leftover.map(({ b, i }) => bulkRenderRow(b, i)).join("")}</div>` : ""}
        <div class="row gap-10" style="justify-content:center">
          <button class="btn btn-ghost" onclick="route('templates')">View my templates</button>
          <button class="btn btn-primary" onclick="bulkUploadMore()">${ic("upload")} Upload more</button>
        </div>
      </div>
    </div>`;
    return;
  }

  const t = taxonByKey(BULK_CAT);
  const acceptAttr = t ? t.exts.join(",") : "";
  const dzBody = t
    ? `<div class="dz-ico">${ic(t.icon || "upload")}</div>
       <div class="body" style="font-weight:600">Drag & drop ${esc(t.label)} files here, or click to choose</div>
       <span class="small">Accepts: <b>${t.exts.join(" · ")}</b> · Multiple at once · Max per file: <b>${MAX_UPLOAD_LABEL}</b></span>`
    : `<div class="dz-ico">${ic("upload")}</div>
       <div class="body" style="font-weight:600">Choose a category above to start</div>`;
  root.innerHTML = `<div style="max-width:880px;margin:0 auto" class="col gap-20">
    <div class="row between center">
      <h2 class="h2" style="margin:0">Upload</h2>
    </div>
    <div class="card card-pad col gap-16">
      ${bulkCatPicker()}
      ${t ? infoBanner(t.hint) : ""}
      <div class="dropzone${t ? "" : " disabled"}" id="bulkDz" style="${t ? "" : "opacity:.55;pointer-events:none"}">
        <input type="file" id="bulkFileInput" accept="${acceptAttr}" multiple style="display:none">
        ${dzBody}
      </div>
      ${BULK_FILES.length ? `<div class="col">${BULK_FILES.map((b, i) => bulkRenderRow(b, i)).join("")}</div>` : ""}
      <label class="row gap-8" style="cursor:pointer;align-items:flex-start"><div class="checkbox${BULK_RIGHTS ? " on" : ""}" onclick="toggleBulkRights()">${ic("check")}</div><span class="body" style="flex:1">${RIGHTS_ATTEST_TEXT}</span></label>
      <div class="row between center">
        <button class="btn btn-ghost" onclick="bulkClearFinished()" ${BULK_FILES.some((b) => b.stage === "done") && !BULK_RUNNING ? "" : "disabled"}>Clear finished</button>
        <button class="btn btn-primary" id="bulkStartBtn" onclick="startBulkIngest()" ${BULK_CAT && BULK_RIGHTS && BULK_FILES.some((b) => b.stage === "queued" || b.stage === "error") && !BULK_RUNNING ? "" : "disabled"}>${ic("upload")} ${BULK_RUNNING ? "Processing…" : "Upload & process"}</button>
      </div>
    </div>
  </div>`;
  if (t) bulkDzHandlers();
}

function openEditTemplate(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) {
    toast("Error", "Template not found", "danger");
    return;
  }
  UP_EDIT_ID = id;
  UP_MODE = "single"; // edit = wizard (bulk faqat yangi yuklash)
  UP_STEP = 1;
  UP_UPLOADED_SIG = ""; // editing context — files must be re-uploaded
  UP_DRAFT.name = t.name;
  UP_DRAFT.desc = t.desc || "";
  UP_DRAFT.catLabel = t.cat;
  UP_DRAFT.nav = "video";
  UP_DRAFT.orient =
    t.orient === "Portrait"
      ? "vertical"
      : t.orient === "Square"
        ? "square"
        : "horizontal";
  UP_DRAFT.res = (t.res || "4K").toLowerCase().includes("1080") ? "1080p" : "4k";
  UP_DRAFT.tags = t.tags || [];
  // Stock S1 — mavjud yozuvdan mahsulot turini tiklash (API xom qatori _api'da)
  const api = t._api || {};
  UP_DRAFT.kind = api.kind || "template";
  UP_DRAFT.stockType = api.stockType || null;
  UP_DRAFT.templateApp = api.templateApp || "ae";
  UP_DRAFT.templateType = api.templateType || "video-templates";
  UP_DRAFT.files = {};
  route("upload");
  toast("Editing", "Update the details and files, then submit", "info");
}
function saveUploadStep1() {
  const root = document.getElementById("upRoot");
  if (!root) return;
  // #upName doesn't exist on steps 2–3 — avoid overwriting the existing UP_DRAFT with blanks
  const nameEl = root.querySelector("#upName");
  if (nameEl) UP_DRAFT.name = nameEl.value.trim();
  const descEl = root.querySelector("#upDesc");
  if (descEl) UP_DRAFT.desc = descEl.value.trim();
  const catEl = root.querySelector("#upCat");
  if (catEl) UP_DRAFT.catLabel = catEl.value;
  // Stock S1 — keng Type (faqat template branch'da mavjud)
  const typeEl = root.querySelector("#upType");
  if (typeEl) UP_DRAFT.templateType = typeEl.value || "video-templates";
  const navEl = root.querySelector("#upNav");
  if (navEl) UP_DRAFT.nav = navEl.value || "video";
  const orientEl = root.querySelector("#upOrient");
  if (orientEl) {
    const orient = orientEl.value || "Landscape";
    UP_DRAFT.orient = orient.includes("Portrait")
      ? "vertical"
      : orient.includes("Square")
        ? "square"
        : "horizontal";
  }
  const resEl = root.querySelector("#upRes");
  if (resEl) {
    const res = resEl.value || "4K";
    UP_DRAFT.res = res.toLowerCase().includes("1080") ? "1080p" : "4k";
  }
  const tagsEl = root.querySelector("#upTags");
  if (tagsEl) {
    UP_DRAFT.tags = tagsEl.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function validateUploadStep1() {
  saveUploadStep1();
  // Stock S1 — avval mahsulot turi tanlanishi shart (formatlar + maydonlar shunga bog'liq)
  if (!upKindOption()) {
    toast("Product type", "Choose what you're uploading first", "warn");
    return false;
  }
  if (!UP_DRAFT.name || !UP_DRAFT.desc || !UP_DRAFT.catLabel) {
    toast("Fields", "Fill in the name, description, and category", "warn");
    return false;
  }
  return true;
}

const MAX_UPLOAD_MB = 3072; // 3 GB
const MAX_UPLOAD_LABEL = "3 GB";

function fmtMB(bytes) {
  return (bytes / 1048576).toFixed(1) + " MB";
}

/** Size/format check — shows a toast with the reason on failure, returns true/false */
function checkUploadFile(file, label) {
  if (!file) return true;
  if (file.size > MAX_UPLOAD_MB * 1048576) {
    toast(
      label,
      `File is ${fmtMB(file.size)} — maximum is ${MAX_UPLOAD_LABEL}. Reduce the size and choose again`,
      "danger"
    );
    return false;
  }
  return true;
}

/** Audit §D (P2) — edit rejimida serverda allaqachon pack bor bo'lsa, uni qayta
 *  yuklashga majburlamaymiz (3 GB'gacha faylni qayta yuklash shart emas edi). */
function serverPackSatisfies() {
  if (!UP_EDIT_ID) return false;
  const t = (typeof TEMPLATES !== "undefined" ? TEMPLATES : []).find((x) => x.id === UP_EDIT_ID);
  return !!(t && (t.assets?.pack || t.fileName));
}

function validateUploadPackFile() {
  // Stock S1 — qabul kengaytmalar tanlangan mahsulot turidan olinadi
  const opt = upKindOption();
  const isStock = UP_DRAFT.kind === "stock";
  const label = isStock ? "Media file" : "Project file";
  const exts = opt ? opt.exts : [".mogrt", ".zip"];
  const pack = UP_DRAFT.files?.pack;
  if (!pack) {
    // Edit rejimi: mavjud server pack yetarli — faqat preview hajmi tekshiriladi
    if (serverPackSatisfies()) {
      return checkUploadFile(UP_DRAFT.files?.preview, "Preview video");
    }
    toast(label, `Upload the ${isStock ? "media" : "project"} file (${exts.join(" / ")})`, "warn");
    return false;
  }
  const name = (pack.name || "").toLowerCase();
  const extRe = new RegExp(`\\.(${exts.map((e) => e.slice(1)).join("|")})$`, "i");
  if (!extRe.test(name)) {
    toast(label, `Only ${exts.join(" / ")} is accepted for ${opt ? opt.label : "this product"}`, "warn");
    return false;
  }
  if (!checkUploadFile(pack, label)) return false;
  if (!checkUploadFile(UP_DRAFT.files?.preview, "Preview video")) return false;
  return true;
}

function uploadStepNext() {
  if (UP_STEP === 1 && !validateUploadStep1()) return;
  // Media step: when "Continue" is clicked we upload the selected files
  // (with a progress bar per file), then move to the next step.
  if (UP_STEP === 2) { startMediaUploadThenNext(); return; }
  UP_STEP = Math.min(3, UP_STEP + 1);
  renderUpload();
}

/** Files in FormData append order (thumb→preview→pack) + byte offsets */
function orderedUploadFiles(files) {
  const order = [
    { key: "thumb", label: "Thumbnail" },
    { key: "preview", label: "Preview video" },
    { key: "pack", label: "Project file" },
  ];
  const list = [];
  let offset = 0;
  for (const o of order) {
    const f = files[o.key];
    if (!f) continue;
    list.push({ key: o.key, label: o.label, name: f.name, size: f.size, start: offset });
    offset += f.size;
  }
  return { list, totalBytes: offset };
}

function uploadFilesSig(files) {
  return ["thumb", "preview", "pack"]
    .map((k) => (files[k] ? `${k}:${files[k].name}:${files[k].size}` : `${k}:-`))
    .join("|");
}

/** Draws the progress panel on the Media step card (a bar per file) */
function showUploadProgressPanel(list) {
  const el = document.getElementById("upProgress");
  if (!el) return;
  const rows = list
    .map(
      (it) => `
      <div class="up-prog-row" style="display:flex;flex-direction:column;gap:5px;padding:8px 0">
        <div class="row between center" style="font-size:12px;gap:8px">
          <span class="trunc" title="${esc(it.name)}" style="min-width:0">${ic("file")} ${esc(it.label)} — ${esc(it.name)}</span>
          <span id="up-stat-${it.key}" style="color:var(--text-dim);white-space:nowrap">Waiting…</span>
        </div>
        <div style="height:6px;background:var(--line,#2a2a2a);border-radius:4px;overflow:hidden">
          <div id="up-fill-${it.key}" style="height:100%;width:0%;background:var(--green,#82c341);transition:width .15s"></div>
        </div>
      </div>`
    )
    .join("");
  el.innerHTML = `<div class="card" style="padding:12px;margin-top:4px;border:1px solid var(--line,#2a2a2a)">
      <div class="small" style="margin-bottom:4px;font-weight:600">Uploading files</div>
      ${rows}
      <div id="upServerStage" class="small" style="margin-top:8px;color:var(--text-dim)"></div>
    </div>`;
}

/** During byte upload, shows each file's 0-100% and "210MB / 500MB" indicator */
function updateFileProgress(list, loaded) {
  for (const it of list) {
    const fill = document.getElementById(`up-fill-${it.key}`);
    const stat = document.getElementById(`up-stat-${it.key}`);
    if (!fill || !stat) continue;
    const fileLoaded = Math.max(0, Math.min(it.size, loaded - it.start));
    const pct = it.size > 0 ? Math.floor((fileLoaded / it.size) * 100) : 100;
    fill.style.width = pct + "%";
    if (pct >= 100) {
      stat.textContent = "✓ Uploaded";
      stat.style.color = "var(--green,#82c341)";
    } else {
      stat.textContent = `Uploading… ${pct}% (${fmtMB(fileLoaded)} / ${fmtMB(it.size)})`;
      stat.style.color = "var(--text-dim)";
    }
  }
}

function markAllFilesDone(list) {
  for (const it of list) {
    const fill = document.getElementById(`up-fill-${it.key}`);
    const stat = document.getElementById(`up-stat-${it.key}`);
    if (fill) fill.style.width = "100%";
    if (stat) { stat.textContent = "✓ Uploaded"; stat.style.color = "var(--green,#82c341)"; }
  }
}

function setUploadServerStage(p) {
  const el = document.getElementById("upServerStage");
  if (!el) return;
  if (p.done) { el.textContent = "✓ Server processing complete"; el.style.color = "var(--green,#82c341)"; return; }
  const label = UPLOAD_STAGE_LABELS[p.stage] || p.message || "Processing";
  el.textContent = `${label}… ${Math.round(p.pct || 0)}%`;
  el.style.color = "var(--text-dim)";
}

function setUploadStageError(msg) {
  const el = document.getElementById("upServerStage");
  if (el) { el.textContent = "Error: " + msg; el.style.color = "var(--red,#ef4444)"; }
}

/** Media step: uploads files (with per-file progress), then moves to step 3 */
async function startMediaUploadThenNext() {
  if (UP_UPLOADING) return;
  if (!validateUploadStep1()) { UP_STEP = 1; renderUpload(); return; }
  const files = UP_DRAFT.files || {};
  const hasFiles = !!(files.thumb || files.preview || files.pack);
  // If a pack is selected, check its format/size (stop on failure)
  if (files.pack && !validateUploadPackFile()) return;
  if (!hasFiles) { UP_STEP = 3; renderUpload(); return; }
  const sig = uploadFilesSig(files);
  if (UP_UPLOADED_SIG === sig) { UP_STEP = 3; renderUpload(); return; } // already uploaded
  if (!StudioApi.token()) { toast("API", "Please sign in first", "warn"); return; }

  const { list } = orderedUploadFiles(files);
  const btn = document.getElementById("upNextBtn");
  if (btn) { btn.disabled = true; btn.innerHTML = "Uploading…"; }
  showUploadProgressPanel(list);
  UP_UPLOADING = true;
  let prog = null;
  try {
    const created = await createUploadTemplateRecord();
    const tid = UP_EDIT_ID || created.id;
    UP_EDIT_ID = tid; // avoid creating a duplicate record on retry
    prog = listenUploadProgress(tid, (p) => { if (!p.error) setUploadServerStage(p); });
    await StudioApi.uploadAssets(tid, files, (done) => updateFileProgress(list, done));
    markAllFilesDone(list);
    setUploadServerStage({ done: true });
    UP_UPLOADED_SIG = sig;
    // brief pause so "✓ Uploaded" is visible, then move to the next step
    await new Promise((r) => setTimeout(r, 700));
    UP_STEP = 3;
    renderUpload();
  } catch (e) {
    const stageLabel = prog && prog.stage ? UPLOAD_STAGE_LABELS[prog.stage] : "";
    setUploadStageError(e.message || "Files failed to upload");
    toast(
      "Error" + (stageLabel ? ` — during ${stageLabel}` : ""),
      (e.message || "Files failed to upload") + ". Click \u00abContinue\u00bb again to retry uploading to this template",
      "danger"
    );
    if (btn) { btn.disabled = false; btn.innerHTML = `Continue ${ic("chevR")}`; }
  } finally {
    if (prog) prog.close();
    UP_UPLOADING = false;
  }
}

function bindUploadFileInputs() {
  const thumb = document.getElementById("upThumb");
  const preview = document.getElementById("upPreview");
  const pack = document.getElementById("upPack");
  if (thumb) thumb.onchange = () => { UP_DRAFT.files.thumb = thumb.files?.[0] || null; UP_UPLOADED_SIG = ""; };
  if (preview) preview.onchange = () => {
    const f = preview.files?.[0] || null;
    // Size is checked immediately — no need to wait for submit
    if (f && !checkUploadFile(f, "Preview video")) {
      preview.value = "";
      UP_DRAFT.files.preview = null;
      return;
    }
    UP_DRAFT.files.preview = f;
    UP_UPLOADED_SIG = ""; // file changed — needs re-uploading
  };
  if (pack) pack.onchange = () => {
    const f = pack.files?.[0] || null;
    if (f && !checkUploadFile(f, "Project file")) {
      pack.value = "";
      UP_DRAFT.files.pack = null;
      return;
    }
    UP_DRAFT.files.pack = f;
    UP_UPLOADED_SIG = ""; // file changed — needs re-uploading
    if (f) toast("Project file", `${f.name} (${fmtMB(f.size)}) selected`, "info");
  };
}

VIEWS.upload = function(){ return `<div id="upRoot"></div>`; };
window.afterRender.upload = function(){
  // P3 — sidebar/topbar orqali qayta kirilganda tugagan partiya (karta ko'rsatilgan yoki
  // hammasi done/duplicate) tozalanadi — eskirgan ro'yxat/karta abadiy osilib qolmaydi.
  // BULK_RUNNING gate: faol yuklash o'rtasida navigatsiya progress'ni saqlaydi.
  if (!BULK_RUNNING && (BULK_SUMMARY || (BULK_FILES.length && BULK_FILES.every((b) => b.stage === "done" || b.stage === "duplicate")))) {
    BULK_FILES = BULK_FILES.filter((b) => b.stage !== "done" && b.stage !== "duplicate");
    BULK_SUMMARY = null;
    BULK_RIGHTS = false;
  }
  renderUpload();
};

function renderUpload(){
  // P1 (step 30) — yangi yuklash FAQAT bulk. Wizard faqat TAHRIRLASH uchun (UP_EDIT_ID).
  // Xavfsizlik: edit id yo'q bo'lsa har doim bulk (eski single-create yo'li o'chirilgan).
  if (UP_MODE !== 'single' || !UP_EDIT_ID) { renderBulkUpload(); return; }
  const steps=['Basic info','Media files','Submit'];
  document.getElementById('upRoot').innerHTML = `<div style="max-width:880px;margin:0 auto" class="col gap-20">
    <div class="row between center"><h2 class="h2" style="margin:0">${ic('edit')} Edit template</h2><button class="btn btn-ghost btn-sm" onclick="startNewUpload()">${ic('x')} Cancel edit</button></div>
    <!-- stepper -->
    <div class="row between center" style="gap:8px">
      ${steps.map((s,i)=>{const n=i+1;const st=n<UP_STEP?'done':n===UP_STEP?'active':'';return `
        <div class="row center gap-10 ${i<steps.length-1?'grow':''}">
          <div class="step-dot ${st}">${n<UP_STEP?ic('check'):n}</div>
          <span class="step-label ${st}">${s}</span>
          ${i<steps.length-1?`<div class="step-line ${n<UP_STEP?'done':''}"></div>`:''}
        </div>`;}).join('')}
    </div>

    ${UP_STEP===1?kindPickerCard():''}
    ${UP_STEP===1&&upKindOption()?`<div class="card card-pad col gap-16">
      <div class="field"><label>${UP_DRAFT.kind==='stock'?'Product name':'Template name'} <span class="req">*</span></label><input id="upName" class="input" value="${esc(UP_DRAFT.name||'')}" placeholder="${UP_DRAFT.kind==='stock'?'e.g. Cinematic Sunset Timelapse':'e.g. Neon Glitch Logo Reveal'}"></div>
      <div class="field"><label>Description <span class="req">*</span></label><textarea id="upDesc" class="textarea" placeholder="What it is, how it's used\u2026">${esc(UP_DRAFT.desc||'')}</textarea><span class="hint">A clear description helps moderation go faster.</span></div>
      ${UP_DRAFT.kind==='stock'?`
      <div class="row gap-16"><div class="field grow"><label>Category <span class="req">*</span></label><select id="upCat" class="select" style="height:38px;width:100%"><option value="">Select\u2026</option>${(STOCK_CATS[UP_DRAFT.stockType]||[]).map(c=>`<option ${UP_DRAFT.catLabel===c?'selected':''}>${c}</option>`).join('')}</select></div>
      ${(UP_DRAFT.stockType==='video'||UP_DRAFT.stockType==='photo')?`<div class="field grow"><label>Orientation</label><select id="upOrient" class="select" style="height:38px;width:100%"><option ${!UP_DRAFT.orient||UP_DRAFT.orient==='horizontal'?'selected':''}>Landscape (16:9)</option><option ${UP_DRAFT.orient==='vertical'?'selected':''}>Portrait (9:16)</option><option ${UP_DRAFT.orient==='square'?'selected':''}>Square (1:1)</option></select></div>
      <div class="field grow"><label>Resolution</label><select id="upRes" class="select" style="height:38px;width:100%"><option ${UP_DRAFT.res!=='1080p'?'selected':''}>4K (3840\u00d72160)</option><option ${UP_DRAFT.res==='1080p'?'selected':''}>1080p</option><option>1080\u00d71920</option></select></div>`:''}</div>
      `:`
      <div class="row gap-16"><div class="field grow"><label>Type <span class="req">*</span></label><select id="upType" class="select" style="height:38px;width:100%">${TEMPLATE_TYPES.map(t=>`<option value="${t.value}" ${(UP_DRAFT.templateType||'video-templates')===t.value?'selected':''}>${t.label}</option>`).join('')}</select></div>
      <div class="field grow"><label>Category <span class="req">*</span></label><select id="upCat" class="select" style="height:38px;width:100%" onchange="onUpCatChange()"><option value="">Select\u2026</option>${CATS.map(c=>`<option ${UP_DRAFT.catLabel===c?'selected':''}>${c}</option>`).join('')}</select></div></div>
      <div class="row gap-16"><div class="field grow"><label>Section</label><select id="upNav" class="select" style="height:38px;width:100%"><option value="video" ${UP_DRAFT.nav==='video'?'selected':''}>Video / Broadcast</option><option value="social" ${UP_DRAFT.nav==='social'?'selected':''}>Social Media</option><option value="corp" ${UP_DRAFT.nav==='corp'?'selected':''}>Corporate</option></select></div>
      <div class="field grow"><label>Orientation</label><select id="upOrient" class="select" style="height:38px;width:100%"><option ${!UP_DRAFT.orient||UP_DRAFT.orient==='horizontal'?'selected':''}>Landscape (16:9)</option><option ${UP_DRAFT.orient==='vertical'?'selected':''}>Portrait (9:16)</option><option ${UP_DRAFT.orient==='square'?'selected':''}>Square (1:1)</option></select></div>
      <div class="field grow"><label>Resolution</label><select id="upRes" class="select" style="height:38px;width:100%"><option ${UP_DRAFT.res!=='1080p'?'selected':''}>4K (3840\u00d72160)</option><option ${UP_DRAFT.res==='1080p'?'selected':''}>1080p</option><option>1080\u00d71920</option></select></div></div>
      `}
      <div class="field"><label>Tags</label><input id="upTags" class="input" value="${esc((UP_DRAFT.tags||[]).join(', '))}" placeholder="comma-separated: glitch, neon, logo"></div>
    </div>`:''}

    ${UP_STEP===2?(()=>{const opt=upKindOption();const isStock=UP_DRAFT.kind==='stock';const exts=opt?opt.exts:['.mogrt','.zip'];const accept=exts.join(',')+(exts.includes('.zip')?',application/zip':'');
    return `<div class="card card-pad col gap-16">
      ${isStock?`
      <div class="field"><label>Media file (${exts.join(' / ')}) <span class="req">*</span></label>
        <input type="file" id="upPack" accept="${accept}" class="input" style="padding:8px">
        <span class="small">This file <b>is the product</b> (${opt?opt.label:''} stock) · Maximum size: <b>3 GB</b></span></div>
      ${UP_DRAFT.stockType==='video'?`<div class="field"><label>Thumbnail (optional)</label>
        <input type="file" id="upThumb" accept="image/*" class="input" style="padding:8px">
        <span class="small">JPG / PNG poster frame</span></div>`:''}
      `:`
      <div class="row gap-16">
        <div class="field grow"><label>Preview video</label>
          <input type="file" id="upPreview" accept="video/*" class="input" style="padding:8px">
          <span class="small">MP4 / MOV</span></div>
        <div class="field grow"><label>Thumbnail</label>
          <input type="file" id="upThumb" accept="image/*" class="input" style="padding:8px">
          <span class="small">JPG / PNG</span></div>
      </div>
      <div class="field"><label>Project file (${exts.join(' / ')})</label>
        <input type="file" id="upPack" accept="${accept}" class="input" style="padding:8px">
        <span class="small">${opt?opt.label:'After Effects'} project (${exts.join(' / ')}) or a .zip pack · Maximum size: <b>3 GB</b></span></div>
      `}
      <div id="upProgress"></div>
    </div>`})():''}

    ${UP_STEP===3?`<div class="card card-pad col gap-16">
      <div class="row gap-16">
        <div class="thumb g1 grain" style="width:200px;aspect-ratio:16/10;border-radius:var(--r-md);flex:0 0 auto"><div class="play"><span>${ic('play')}</span></div></div>
        <div class="col gap-8 grow" style="min-width:0">
          <span class="h3">${esc(UP_DRAFT.name||'Template')}</span>
          <div class="row gap-6 wrap"><span class="pill">${esc(upKindSummary())}</span><span class="pill">${esc(UP_DRAFT.catLabel||'—')}</span>${(UP_DRAFT.kind!=='stock'||UP_DRAFT.stockType==='video'||UP_DRAFT.stockType==='photo')?`<span class="pill">${(UP_DRAFT.res||'4k').toUpperCase()}</span><span class="pill">${UP_DRAFT.orient==='vertical'?'Portrait':UP_DRAFT.orient==='square'?'Square':'Landscape'}</span>`:''}</div>
          <p class="body" style="max-width:100%;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden">${esc(UP_DRAFT.desc||'')}</p>
          <div class="row gap-8 wrap" style="min-width:0">
            ${UP_DRAFT.files.preview?`<span class="pill trunc" title="${esc(UP_DRAFT.files.preview.name)}">${ic('film')} ${esc(UP_DRAFT.files.preview.name)} · ${fmtMB(UP_DRAFT.files.preview.size)}</span>`:''}
            ${UP_DRAFT.files.thumb?`<span class="pill trunc" title="${esc(UP_DRAFT.files.thumb.name)}">${ic('image')} ${esc(UP_DRAFT.files.thumb.name)}</span>`:''}
            ${UP_DRAFT.files.pack?`<span class="pill trunc" title="${esc(UP_DRAFT.files.pack.name)}">${ic('file')} ${esc(UP_DRAFT.files.pack.name)} · ${fmtMB(UP_DRAFT.files.pack.size)}</span>`:serverPackSatisfies()?`<span class="small" style="color:var(--text-dim)">${ic('file')} Existing uploaded file will be kept</span>`:`<span class="small" style="color:var(--orange)">${UP_DRAFT.kind==='stock'?'Media file is required — it is the product itself':'Project file is required for import'}</span>`}
          </div>
        </div>
      </div>
      ${infoBanner(UP_DRAFT.kind==='stock'
        ?'Once submitted, the status becomes <b>PENDING_REVIEW</b>. Stock browsing surfaces launch in an upcoming phase — approved stock is stored and will appear there automatically.'
        :'Once submitted, the status becomes <b>PENDING_REVIEW</b>. After admin approval it appears in AE → FrameFlow Browse.')}
      <label class="row gap-8" style="cursor:pointer;align-items:flex-start"><div class="checkbox${UP_RIGHTS?' on':''}" onclick="toggleUpRights()">${ic('check')}</div><span class="body" style="flex:1">${RIGHTS_ATTEST_TEXT}</span></label>
    </div>`:''}

    <div class="row between center">
      <button class="btn btn-ghost" onclick="UP_STEP=Math.max(1,UP_STEP-1);renderUpload()" ${UP_STEP===1?'disabled':''}>${ic('chevL')} Back</button>
      <div class="row gap-8">
        <button class="btn btn-subtle" onclick="saveDraftOnly()">Save draft</button>
        ${UP_STEP<3?`<button class="btn btn-primary" id="upNextBtn" onclick="uploadStepNext()">Continue ${ic('chevR')}</button>`
          :`<button class="btn btn-success" id="upSubmitBtn" onclick="submitUpload()" ${UP_RIGHTS?'':'disabled'}>${ic('check')} Submit for moderation</button>`}
      </div>
    </div>
  </div>`;
  if (UP_STEP === 2) bindUploadFileInputs();
}
async function saveDraftOnly() {
  if (!StudioApi.token()) {
    toast("API", "Please sign in first", "warn");
    return;
  }
  if (!validateUploadStep1()) {
    UP_STEP = 1;
    renderUpload();
    return;
  }
  try {
    const created = await createUploadTemplateRecord();
    const tid = UP_EDIT_ID || created.id;
    // Bind immediately so a retry doesn't create a new duplicate record
    UP_EDIT_ID = tid;
    try {
      if (UP_DRAFT.files.thumb || UP_DRAFT.files.preview || UP_DRAFT.files.pack) {
        await StudioApi.uploadAssets(tid, UP_DRAFT.files);
      }
    } catch (e) {
      toast("Warning", "Files were not saved: " + (e.message || "") + ". Saving again will upload to this same draft", "warn");
    }
    UP_EDIT_ID = null;
    await StudioTemplates.refreshAfterUpload();
    toast("Draft", "Saved. Click «Submit for moderation» or «Submit» from the list", "info");
    route("templates");
  } catch (e) {
    toast("Error", e.message || "Save failed", "danger");
  }
}

async function createUploadTemplateRecord() {
  // Stock S1 — stock kategoriyasi slug'i alohida (stockCatFromLabel, data.js)
  const isStock = UP_DRAFT.kind === "stock";
  const { cat, catLabel } = isStock
    ? stockCatFromLabel(UP_DRAFT.catLabel)
    : catFromLabel(UP_DRAFT.catLabel);
  const body = {
    name: UP_DRAFT.name,
    description: UP_DRAFT.desc,
    nav: UP_DRAFT.nav || "video",
    cat,
    catLabel,
    orient: UP_DRAFT.orient,
    res: UP_DRAFT.res,
    tags: UP_DRAFT.tags,
    // Stock S1 — mahsulot turi maydonlari
    kind: UP_DRAFT.kind || "template",
    ...(isStock
      ? { stockType: UP_DRAFT.stockType }
      : {
          templateApp: UP_DRAFT.templateApp || "ae",
          templateType: UP_DRAFT.templateType || "video-templates",
        }),
    metaJson: { grad: "g1", dur: "0:12" },
    // FAZA 1b — rights attestation: faqat checkbox belgilanganda qayd etiladi
    rightsAccepted: UP_RIGHTS === true,
    rightsTermsVersion: RIGHTS_TERMS_VERSION,
  };
  if (UP_EDIT_ID) {
    return StudioApi.patchTemplate(UP_EDIT_ID, body);
  }
  return StudioApi.createTemplate(body);
}

/** FAZA 1b — rights-attestation checkbox (single form). Submit shu true bo'lmaguncha bloklangan. */
function toggleUpRights() {
  UP_RIGHTS = !UP_RIGHTS;
  renderUpload();
}
window.toggleUpRights = toggleUpRights;

/** FAZA 1b — rights-attestation checkbox (bulk form). */
function toggleBulkRights() {
  BULK_RIGHTS = !BULK_RIGHTS;
  renderUpload();
}
window.toggleBulkRights = toggleBulkRights;

/** Server-side stages (80-100%) — real-time via SSE */
const UPLOAD_STAGE_LABELS = {
  receive: "Receiving file",
  sync: "Saving to cloud",
  extract: "Preparing scenes",
  db: "Writing to database",
};

function listenUploadProgress(tid, onUpdate) {
  const handle = { stage: "", close() {} };
  if (typeof EventSource === "undefined") return handle;
  let es = null;
  try {
    es = new EventSource(
      `${StudioApi.baseUrl()}/api/contributor/templates/${tid}/upload-progress`
    );
  } catch {
    return handle;
  }
  let live = false;
  es.onmessage = (ev) => {
    let p = null;
    try { p = JSON.parse(ev.data); } catch { return; }
    if (p.stage === "receive" && !p.error) { live = true; return; }
    // Ignore stale (already finished) events from before the ES connection
    if (!live && p.done && !p.error) return;
    handle.stage = p.stage;
    onUpdate(p);
  };
  es.onerror = () => {}; // if SSE drops, XHR progress remains as a fallback
  handle.close = () => { try { es.close(); } catch {} };
  return handle;
}

async function submitUpload(){
  if (!StudioApi.token()) {
    toast('API', 'Please sign in first', 'warn');
    return;
  }
  if (!UP_RIGHTS) {
    UP_STEP = 3;
    renderUpload();
    toast('Rights', 'Please confirm you have the rights to distribute this content', 'warn');
    return;
  }
  if (!validateUploadStep1()) {
    UP_STEP = 1;
    renderUpload();
    return;
  }
  if (!validateUploadPackFile()) {
    UP_STEP = 2;
    renderUpload();
    return;
  }
  const btn = document.getElementById('upSubmitBtn');
  const btnHtml = btn ? btn.innerHTML : '';
  if (btn) btn.disabled = true;
  try {
    const created = await createUploadTemplateRecord();
    const tid = UP_EDIT_ID || created.id;
    // If the upload fails, a retry shouldn't create a NEW template —
    // bind to this same record (fixed the duplicate-draft bug)
    UP_EDIT_ID = tid;
    let prog = null;
    const filesPresent = !!(UP_DRAFT.files.thumb || UP_DRAFT.files.preview || UP_DRAFT.files.pack);
    const alreadyUploaded = !!UP_UPLOADED_SIG && UP_UPLOADED_SIG === uploadFilesSig(UP_DRAFT.files || {});
    try {
      // If these files were already uploaded during the media step — don't re-upload
      if (filesPresent && !alreadyUploaded) {
        // Server-side stages (80-100%): storage save, scene extract, DB write
        prog = listenUploadProgress(tid, (p) => {
          if (!btn || p.error) return;
          btn.innerHTML = `${esc(p.message || "Processing…")} ${Math.round(p.pct)}%`;
        });
        // File bytes going to the server — the 0-80% portion of the overall process
        await StudioApi.uploadAssets(tid, UP_DRAFT.files, (done, total) => {
          if (!btn) return;
          if (total > 0 && done >= total) {
            btn.innerHTML = "Server processing… 80%";
            return;
          }
          const pct = total > 0 ? Math.floor((done / total) * 80) : 0;
          btn.innerHTML = `Uploading… ${pct}% (${fmtMB(done)} / ${fmtMB(total)})`;
        });
        UP_UPLOADED_SIG = uploadFilesSig(UP_DRAFT.files || {});
      }
    } catch (e) {
      const stageLabel = prog && prog.stage ? UPLOAD_STAGE_LABELS[prog.stage] : "";
      toast(
        "Error" + (stageLabel ? ` — during ${stageLabel}` : ""),
        (e.message || "Files failed to upload") + ". Click «Submit for moderation» again to retry uploading to this template",
        "danger"
      );
      return;
    } finally {
      if (prog) prog.close();
    }
    await StudioApi.submitTemplate(tid);
    await StudioTemplates.refreshAfterUpload();
    toast('Submitted', 'Template sent to moderation — it will appear in AE once approved', 'success');
    if (typeof AssetFlowLog !== 'undefined') {
      AssetFlowLog.info('Template submitted for moderation', {
        action: 'upload_submit',
        detail: tid,
      });
    }
    UP_STEP = 1;
    UP_EDIT_ID = null;
    UP_UPLOADED_SIG = '';
    UP_DRAFT.name = '';
    UP_DRAFT.desc = '';
    UP_DRAFT.files = {};
    route('templates');
  } catch (e) {
    toast('Error', e.message || 'Upload failed', 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btnHtml;
    }
  }
}

/* ============================================================
   MESSAGES (API)
   ============================================================ */
let C_THREADS = [];
let CMSG_SEL = 0;
let C_THREAD_MESSAGES = [];

function formatMsgDate(iso) {
  // §F (P33) — xom UTC slice o'rniga umumiy lokal yordamchi (ui.js)
  return (typeof fmtLocalDateTime === "function") ? fmtLocalDateTime(iso) : (iso ? String(iso).slice(0, 16).replace("T", " ") : "—");
}

function buildContributorThreads() {
  return C_THREADS;
}

async function loadContributorThreads() {
  if (!StudioApi.token()) return [];
  const { items } = await StudioApi.listMessageThreads();
  return items.map((t) => ({
    id: t.id,
    sub: t.subject,
    last: t.lastMessage,
    t: formatMsgDate(t.lastMessageAt),
    tid: t.templateId,
    from: "Admin",
    kind: t.isBroadcast ? "yellow" : "violet",
    unread: t.unreadCount > 0,
    isBroadcast: t.isBroadcast,
  }));
}

function contributorUnreadCount() {
  return C_THREADS.filter((t) => t.unread).length;
}

VIEWS.messages = function () {
  return `<div id="cmsgRoot"></div>`;
};

window.afterRender.messages = async function () {
  const root = document.getElementById("cmsgRoot");
  root.innerHTML = `<div class="card card-pad empty"><p class="small">Loading…</p></div>`;
  try {
    C_THREADS = await loadContributorThreads();
    window._STUDIO_MSG_UNREAD = contributorUnreadCount();
    if (typeof renderNav === "function") renderNav();
    CMSG_SEL = 0;
    await renderCMsg();
  } catch (e) {
    root.innerHTML = `<div class="card card-pad empty"><h3>Error</h3><p>${esc(e.message)}</p></div>`;
  }
};

async function selectContributorThread(i) {
  CMSG_SEL = i;
  await renderCMsg();
}

async function renderCMsg() {
  const root = document.getElementById("cmsgRoot");
  if (!C_THREADS.length) {
    root.innerHTML = `<div class="card card-pad empty"><div class="ico">${ic("inbox")}</div><h3>No messages</h3><p class="body">Admin moderation and broadcast messages will appear here.</p></div>`;
    return;
  }
  if (CMSG_SEL >= C_THREADS.length) CMSG_SEL = 0;
  const th = C_THREADS[CMSG_SEL];
  C_THREAD_MESSAGES = [];
  try {
    const data = await StudioApi.getMessageThread(th.id);
    C_THREAD_MESSAGES = data.messages || [];
    await StudioApi.markMessageThreadRead(th.id);
    th.unread = false;
    window._STUDIO_MSG_UNREAD = contributorUnreadCount();
    if (typeof renderNav === "function") renderNav();
  } catch (e) {
    toast("Error", e.message || "Failed to load messages", "danger");
  }

  const canReply = !th.isBroadcast;
  const me = typeof AssetFlowAuth !== "undefined" ? AssetFlowAuth.getSession() : null;
  const myInitials = (me?.name || "S").slice(0, 2).toUpperCase();

  root.innerHTML = `<div class="card" style="overflow:hidden"><div style="display:grid;grid-template-columns:320px 1fr;height:640px">
    <div class="col" style="border-right:1px solid var(--line)">
      <div class="card-head"><h3>Messages</h3><span class="nav-badge brand">${contributorUnreadCount()}</span></div>
      <div class="col" style="overflow-y:auto">
        ${C_THREADS.map(
          (t, i) => `<div class="mod-item ${i === CMSG_SEL ? "sel" : ""}" onclick="selectContributorThread(${i})">
          <div class="kpi-ico" style="width:38px;height:38px;flex:0 0 auto;background:var(--${t.kind}-dim);color:var(--${t.kind})">${ic(t.isBroadcast ? "megaphone" : "message")}</div>
          <div class="col grow" style="gap:2px;min-width:0"><div class="row between"><span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.sub)}</span><span class="sub" style="font-size:10.5px;color:var(--tx-3)">${esc(t.t)}</span></div><span class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px">${esc(t.last)}</span></div>
          ${t.unread ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--violet-bright);flex:0 0 auto"></span>' : ""}
        </div>`
        ).join("")}
      </div>
    </div>
    <div class="col">
      <div class="card-head"><div class="col" style="gap:1px"><span class="cell-strong">${esc(th.sub)}</span>${th.tid ? `<span class="small">Template: <a style="color:var(--violet-bright);cursor:pointer" onclick="openTplDrawer('${th.tid}')">${esc(th.tid)}</a></span>` : `<span class="small">${th.isBroadcast ? "Broadcast" : "Conversation"}</span>`}</div>${th.tid ? `<button class="btn btn-ghost btn-sm" onclick="openTplDrawer('${th.tid}')">${ic("eye")} Template</button>` : ""}</div>
      <div class="col grow" style="overflow-y:auto;padding:18px;background:var(--bg-0)">
        ${C_THREAD_MESSAGES.map((m) => {
          const isMe = m.sender?.isMe;
          const nm = m.sender?.name || "User";
          const ini = nm.slice(0, 2).toUpperCase();
          return `<div class="msg ${isMe ? "me" : ""}"><div class="avatar" style="width:28px;height:28px;font-size:11px;background:linear-gradient(140deg,#7b5cff,#4a2fb0)">${isMe ? esc(myInitials) : esc(ini)}</div><div class="msg-body"><div class="msg-name" style="color:${isMe ? "var(--tx-1)" : "var(--violet-bright)"}">${isMe ? "You" : esc(nm)}</div><div class="msg-text">${esc(m.body)}</div><div class="msg-time">${esc(formatMsgDate(m.createdAt))}</div></div></div>`;
        }).join("")}
      </div>
      ${
        canReply
          ? `<div class="row gap-8 center" style="padding:14px;border-top:1px solid var(--line)">
        <input id="cReplyInput" class="input" placeholder="Write a reply…" style="height:40px">
        <button class="btn btn-primary" style="height:40px" onclick="sendContributorReply()">${ic("send")} Reply</button>
      </div>`
          : `<div class="row center gap-8" style="padding:14px;border-top:1px solid var(--line);color:var(--tx-3);justify-content:center">${ic("inbox")}<span class="small">You cannot reply to broadcast messages</span></div>`
      }
    </div>
  </div></div>`;
}

async function sendContributorReply() {
  const th = C_THREADS[CMSG_SEL];
  const input = document.getElementById("cReplyInput");
  const body = input?.value?.trim();
  if (!th || !body) return;
  try {
    await StudioApi.replyMessageThread(th.id, body);
    input.value = "";
    const data = await StudioApi.getMessageThread(th.id);
    C_THREAD_MESSAGES = data.messages || [];
    th.last = body;
    await renderCMsg();
    toast("Sent", "Your reply was delivered to the admin", "success");
  } catch (e) {
    toast("Error", e.message || "Send failed", "danger");
  }
}

async function saveContributorProfile() {
  const nameEl = document.getElementById("cProfileName");
  const name = nameEl?.value?.trim();
  if (!name) {
    toast("Profile", "Enter a name", "warn");
    return;
  }
  try {
    await StudioApi.patchProfile({ name });
    const s = AssetFlowAuth.getSession();
    if (s) {
      s.name = name;
      AssetFlowAuth.setSession(s);
      patchContributorUI();
    }
    toast("Saved", "Profile updated", "success");
  } catch (e) {
    toast("Error", e.message || "Save failed", "danger");
  }
}

/* ============================================================
   SETTINGS
   ============================================================ */
VIEWS.settings = function(){
  const s = typeof AssetFlowAuth !== 'undefined' ? AssetFlowAuth.getSession() : null;
  const nm = s?.name || 'Contributor';
  const em = s?.email || '';
  return `<div style="max-width:720px" class="col gap-16">
    <div class="card"><div class="card-head"><h3>Profile</h3></div>
      <div class="card-pad col gap-16">
        <div class="row center gap-14">${avatar(nm,56)}<div class="col gap-6"><span class="hint">Name is saved via the API</span></div></div>
        <div class="row gap-16"><div class="field grow"><label>Name</label><input id="cProfileName" class="input" value="${esc(nm)}"></div><div class="field grow"><label>Email</label><input class="input" value="${esc(em)}" readonly></div></div>
        <div class="field"><label>Bio</label><textarea class="textarea" placeholder="A short bio about yourself…"></textarea></div>
      </div>
    </div>
    <div class="card"><div class="card-head"><h3>Subscribers: Free vs Pro</h3><span class="small">Set by admin plans</span></div>
      <div class="card-pad col gap-14">
        <p class="body">Your templates appear in the catalog for everyone at full resolution, but <b>Pro</b> subscribers get unlimited downloads (Free is capped per month).</p>
        <table class="data" style="min-width:auto">
          <thead><tr><th></th><th>Free</th><th>Pro</th></tr></thead>
          <tbody>
            <!-- §E (P2) — "Resolution" qatori olib tashlandi: barcha tarif istalgan o'lchamda yuklaydi (gate yo'q). Farq = oylik yuklab olishlar. -->
            <tr><td class="cell-strong">Downloads</td><td>${formatPlanLimit(planById('free'))}</td><td>${formatPlanLimit(planById('pro'))}</td></tr>
            <tr><td class="cell-strong">Price (monthly)</td><td>Free</td><td>${formatProPriceForContributor()}</td></tr>
          </tbody>
        </table>
        <div class="info-banner" style="font-size:12px">${ic('plugin')}<span>Only the admin can change plans. If you have questions, write via <a href="#" onclick="event.preventDefault();route('messages')" style="color:var(--violet-bright)">messages</a>.</span></div>
      </div>
    </div>
    <div class="card"><div class="card-head"><h3>Earnings &amp; payouts</h3><span class="small" id="cEarnMode"></span></div>
      <div class="card-pad col gap-14" id="cEarningsBody">
        <p class="body" style="color:var(--tx-2)">Loading your earnings\u2026</p>
      </div>
    </div>
    <div class="card"><div class="card-head"><h3>Notifications</h3><span class="badge badge-pending"><span class="dot"></span>Coming soon</span></div>
      <div class="card-pad"><p class="body" style="color:var(--tx-2)">Email and push notifications will be configurable here once connected. Moderation messages are currently in the <b>Messages</b> section (API).</p></div>
    </div>
        <div class="row gap-8"><button class="btn btn-primary" onclick="saveContributorProfile()">Save</button><button class="btn btn-ghost" onclick="route('settings')">Cancel</button></div>
  </div>`;
};

/* FAZA 5 (C2) — real earnings: GET /api/contributor/earnings ni Settings'dagi
   "Earnings & payouts" kartasiga ulaydi (ilgari o'chirilgan "Coming soon" payout
   formasi turardi). Balans/jami/to'langan + so'nggi payoutlar ro'yxati. */
function fmtUsd(cents){
  return '$' + ((Number(cents) || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
window.afterRender = window.afterRender || {};
window.afterRender.settings = async function(){
  const body = document.getElementById('cEarningsBody');
  if (!body || typeof StudioApi === 'undefined' || !StudioApi.token()) return;
  try {
    const e = await StudioApi.getMyEarnings();
    const mode = document.getElementById('cEarnMode');
    if (mode) mode.textContent = e.payoutMode === 'pool'
      ? 'Revenue-share pool'
      : `Per download: ${fmtUsd(e.perDownloadCents)}`;
    const payouts = Array.isArray(e.payouts) ? e.payouts : [];
    body.innerHTML = `
      <div class="row gap-16 wrap">
        ${[['Unpaid balance', fmtUsd(e.balanceCents), 'green'],
           ['Total earned', fmtUsd(e.totalEarnedCents), ''],
           ['Paid out', fmtUsd(e.paidOutCents), ''],
           ['Earning downloads', (e.earningEvents || 0).toLocaleString(), '']].map(([l,v,c]) =>
          `<div class="col" style="gap:3px;min-width:120px"><span class="label">${l}</span><span class="h3" ${c?`style="color:var(--${c})"`:''}>${v}</span></div>`).join('')}
      </div>
      ${payouts.length ? `
        <div class="divider"></div>
        <span class="label">Recent payouts</span>
        <table class="data" style="min-width:auto">
          <thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Note</th></tr></thead>
          <tbody>${payouts.map(p => `<tr>
            <td class="cell-muted mono">${esc(fmtLocalDate(p.createdAt))}</td>
            <td class="cell-strong">${fmtUsd(p.amountCents)}</td>
            <td>${esc(p.status || '—')}</td>
            <td class="cell-muted">${esc(p.note || '—')}</td>
          </tr>`).join('')}</tbody>
        </table>` : ''}
      <div class="info-banner" style="font-size:12px">${ic('plugin')}<span>Payouts are processed by the admin team. Questions? Write via <a href="#" onclick="event.preventDefault();route('messages')" style="color:var(--violet-bright)">messages</a>.</span></div>`;
  } catch (err) {
    body.innerHTML = `<p class="body" style="color:var(--tx-2)">Could not load earnings — please try again later.</p>`;
    console.warn('earnings load failed:', err);
  }
};

/* ============================================================
   TEMPLATE DETAIL DRAWER — preview, metadata, status timeline, chat thread
   ============================================================ */
function statusTimeline(t){
  // build a plausible history from status
  const base=[{t:'Submitted',meta:t.created+' · PENDING_REVIEW',c:'violet',ic:'upload'}];
  if(t.status==='soft'){ base.push({t:'Soft reject',meta:'Admin · with a reason',c:'orange',ic:'reply',note:t.reason}); }
  if(t.status==='hard'){ base.push({t:'Hard reject',meta:'Admin · final rejection',c:'red',ic:'ban',note:t.reason}); }
  if(t.status==='approved'){ base.push({t:'Reviewed',meta:'Admin moderation',c:'blue',ic:'eye'}); base.push({t:'Approved',meta:'Added to the AE catalog · live',c:'green',ic:'check'}); }
  if(t.status==='draft'){ return [{t:'Draft created',meta:t.created+' · not yet submitted',c:'gray',ic:'edit'}]; }
  return base;
}
async function renderDrawerThreadSection(t) {
  if (!(t.status === "soft" || t.status === "hard")) return "";
  if (!StudioApi.token()) {
    return t.reason
      ? `<div class="divider"></div><div class="col gap-10"><span class="label">Moderation note</span>
      <div class="info-banner warn">${ic("reply")}<span>${esc(t.reason)}</span></div></div>`
      : "";
  }
  try {
    const { items } = await StudioApi.listMessageThreads();
    const th = (items || []).find((x) => x.templateId === t.id);
    if (!th) {
      return t.reason
        ? `<div class="divider"></div><div class="col gap-10"><span class="label">Moderation note</span>
        <div class="info-banner warn">${ic("reply")}<span>${esc(t.reason)}</span></div>
        <span class="hint">For the full conversation, go to <a style="color:var(--violet-bright);cursor:pointer" onclick="closeDrawer();route('messages')">Messages</a>.</span></div>`
        : `<div class="divider"></div><div class="info-banner">${ic("inbox")}<span>You can message the admin from the Messages section.</span></div>`;
    }
    const detail = await StudioApi.getMessageThread(th.id);
    const msgs = detail.messages || [];
    const canReply = t.status === "soft" && !th.isBroadcast;
    return `<div class="divider"></div><div class="col gap-10"><span class="label">Conversation with admin</span>
      <div class="col gap-8">${msgs
        .map((m) => {
          const isAdmin = m.sender?.role === "ADMIN";
          const who = m.sender?.name || m.sender?.email || (isAdmin ? "Admin" : "You");
          const when = fmtLocalDateTime(m.createdAt);
          return `<div class="msg"><div class="avatar" style="width:28px;height:28px;font-size:11px;background:${isAdmin ? "linear-gradient(140deg,#7b5cff,#4a2fb0)" : "var(--bg-4)"}">${esc(who.slice(0, 2).toUpperCase())}</div>
          <div class="msg-body"><div class="msg-name" style="color:var(--${isAdmin ? "violet-bright" : "tx-1"})">${esc(who)}</div><div class="msg-text">${esc(m.body)}</div><div class="msg-time">${esc(when)}</div></div></div>`;
        })
        .join("")}</div>
      ${
        canReply
          ? `<div class="row gap-8 center"><input id="drawerReplyInput" class="input" placeholder="Write a reply…" style="height:36px"><button class="btn btn-primary btn-sm" onclick="replyFromDrawer('${th.id}')">${ic("send")}</button></div>`
          : `<div class="info-banner danger" style="font-size:12px">${ic("ban")}<span>Hard reject — replies closed. <a style="color:var(--violet-bright);cursor:pointer" onclick="closeDrawer();route('messages')">Messages</a></span></div>`
      }</div>`;
  } catch (e) {
    return t.reason
      ? `<div class="info-banner warn">${ic("reply")}<span>${esc(t.reason)}</span></div>`
      : "";
  }
}

async function replyFromDrawer(threadId) {
  const input = document.getElementById("drawerReplyInput");
  const body = (input?.value || "").trim();
  if (!body) {
    toast("Message", "Enter some text", "warn");
    return;
  }
  try {
    await StudioApi.replyMessageThread(threadId, body);
    toast("Sent", "Message sent to the admin", "success");
    closeDrawer();
    route("messages");
  } catch (e) {
    toast("Error", e.message || "Failed to send", "danger");
  }
}

async function openTplDrawer(id){
  const t=TEMPLATES.find(x=>x.id===id);
  if (!t) return;
  const threadBlock = await renderDrawerThreadSection(t);
  openDrawer(`
    <div class="drawer-head"><span class="h3 grow">Template details</span><button class="icon-btn" onclick="closeDrawer()">${ic('x')}</button></div>
    <div class="drawer-body col gap-18">
      ${typeof StudioMedia!=='undefined'?`<div style="border-radius:var(--r-md);overflow:hidden">${StudioMedia.renderPreview(t,{aspect:'16/9'})}</div>`:`<div class="thumb ${t.grad} grain" style="width:100%;aspect-ratio:16/9;border-radius:var(--r-md)"></div>`}
      <div class="row gap-8 wrap">${typeof StudioMedia!=='undefined'?StudioMedia.filePills(t):''}</div>
      <div class="row between center"><span class="h3">${esc(t.name)}</span>${badge(t.status)}</div>
      ${scanNotice(t)}
      ${t.status==='approved'?`<div class="info-banner">${ic('ext')}<span>This template is currently live in <b>AE → FrameFlow Browse</b>. Downloaded <b>${t.dl.toLocaleString()}</b> times.</span></div>`:''}
      <p class="body">${esc(t.desc)}</p>
      <div class="meta-grid">${[['ID',t.id],['Category',t.cat],['Resolution',t.res],['Orientation',t.orient],['File',t.size],['Created',t.created]].map(([k,v])=>`<div><div class="label" style="margin-bottom:3px">${k}</div><div class="cell-strong">${esc(v)}</div></div>`).join('')}</div>
      <div class="row gap-6 wrap">${t.tags.map(x=>`<span class="pill">${ic('tag')}${esc(x)}</span>`).join('')}</div>

      <div class="divider"></div>
      <div class="col gap-12"><span class="label">Status history</span>
        <div class="timeline">${statusTimeline(t).map(s=>`<div class="tl-item"><div class="tl-dot" style="background:var(--${s.c})">${ic(s.ic)}</div><div class="tl-title">${s.t}</div><div class="tl-meta">${esc(s.meta)}</div>${s.note?`<div class="tl-note">${esc(s.note)}</div>`:''}</div>`).join('')}</div>
      </div>

      ${threadBlock}
    </div>
    <div class="drawer-foot">
      ${t.status==='soft'?`<button class="btn btn-success grow" onclick="closeDrawer();resubmit('${t.id}')">${ic('refresh')} Fix and resubmit</button><button class="btn btn-ghost" onclick="closeDrawer();openEditTemplate('${t.id}')">${ic('edit')}</button>`:''}
      ${t.status==='draft'?`<button class="btn btn-success grow" onclick="submitDraftToModeration('${t.id}')">${ic('upload')} Submit for moderation</button><button class="btn btn-ghost" onclick="closeDrawer();route('upload')">${ic('edit')} Edit</button>`:''}
      ${t.status==='approved'?`<button class="btn btn-ghost grow" onclick="closeDrawer()">Close</button>`:''}
      ${t.status==='hard'?`<button class="btn btn-ghost grow" onclick="closeDrawer()">Close</button>`:''}
      ${t.status==='pending'?`<button class="btn btn-ghost grow" onclick="closeDrawer()">Close · in moderation</button>`:''}
    </div>`);
}
