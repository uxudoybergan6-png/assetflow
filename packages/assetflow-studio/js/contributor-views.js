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
// #84 (C5) — contributor ro'yxatlari HAQIQIY thumbnail ko'rsatsin. Ilgari hamma joyda
// `thumbArt(t.grad)` — ya'ni SOXTA gradient edi: yuklovchi o'z shablonini rasmi bo'lsa
// ham tanimasdi. Admin tarafda bu allaqachon shunday (adxModThumb) — o'sha naqsh.
// Media yo'q bo'lsa gradient fallback qoladi.
function cThumb(t, size){
  const hasMedia = typeof StudioMedia !== 'undefined' && StudioMedia.hasAsset &&
    (StudioMedia.hasAsset(t,'thumb') || StudioMedia.hasAsset(t,'preview'));
  if (hasMedia) return StudioMedia.renderThumb(t, size || 'lg');
  return thumbArt(t.grad || 'g1', t.dur || '', true);
}
/** Grid kartasi uchun: `.thumb` konteyner allaqachon bor — faqat ichki media (yoki play ikonkasi). */
function cThumbMedia(t){
  const hasMedia = typeof StudioMedia !== 'undefined' && StudioMedia.hasAsset &&
    (StudioMedia.hasAsset(t,'thumb') || StudioMedia.hasAsset(t,'preview'));
  if (!hasMedia) return `<div class="play"><span>${ic('play')}</span></div>`;
  return `<div style="position:absolute;inset:0">${StudioMedia.renderThumb(t,'lg')}</div>`;
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

/* D4 (#10) — bu yerda VIEWS.overview va afterRender.overview ning ESKI nusxasi (~100 qator)
   turgan edi: contributor-dashboard.js index.html da KEYIN yuklanib ikkisini ham to'liq qayta
   ta'riflaydi, ya'ni bu kod hech qachon bajarilmasdi (drift xavfi). U bilan birga faqat shu
   blokda ishlatilgan `kpiCard` helperi ham o'chirildi.
   Overview'ning JONLI manbasi: js/contributor-dashboard.js. */

/* ============================================================
   D4 (#2) — YUKLASH HOLATI: skelet + xato kartasi
   ------------------------------------------------------------
   TEMPLATES tarmoqdan kelguncha ekranlar "No templates" empty-state ko'rsatardi —
   yuklovchi o'z ishlarini yo'qolgan deb o'ylashi mumkin edi. Bayroqlar
   contributor/index.html boot'ida (`loadContributorTemplates`) yoqiladi.
   Naqsh plagin Browse a7 holat tizimidan olingan (skelet → xato → bo'sh).
   ============================================================ */
function tplLoading(){ return !!window._TPL_LOADING; }
function tplLoadError(){ return window._TPL_ERROR || null; }
/** Bitta skelet qator: thumb + 2 matn chizig'i + badge. */
function skelRow(){
  return `<div class="row center gap-12" style="padding:13px 18px;border-bottom:1px solid var(--line-soft)">
    <div class="skeleton" style="width:54px;height:34px;flex:none"></div>
    <div class="col grow" style="gap:7px;min-width:0">
      <div class="skeleton skeleton-line w40" style="margin-bottom:0"></div>
      <div class="skeleton skeleton-line w60" style="height:10px;margin-bottom:0"></div>
    </div>
    <div class="skeleton" style="width:78px;height:20px;border-radius:999px;flex:none"></div>
  </div>`;
}
function skelTableCard(rows){
  const n = rows || 4;
  return `<div class="card" aria-busy="true" aria-label="Loading templates"><div class="col">${
    Array.from({ length: n }, skelRow).join('')}</div></div>`;
}
function skelChipRow(){
  return `<div class="toolbar between" aria-hidden="true"><div class="chips">${
    [70, 96, 84, 92].map(w=>`<div class="skeleton" style="width:${w}px;height:30px;border-radius:999px"></div>`).join('')
  }</div><div class="skeleton" style="width:150px;height:32px;border-radius:var(--r-sm)"></div></div>`;
}
/** Yuklash muvaffaqiyatsiz — jim qolmasdan Retry taklif qilamiz. */
function tplErrorCard(){
  return `<div class="card"><div class="empty"><div class="ico">${ic('alert')}</div>
    <h3>Could not load your templates</h3>
    <p>${esc(tplLoadError() || '')}</p>
    <button class="btn btn-primary" onclick="retryContributorLoad()">${ic('refresh')} Retry</button>
  </div></div>`;
}

/* ============================================================
   MY TEMPLATES — table + grid toggle
   ============================================================ */
let MY_VIEW='table', MY_FILTER='all';
VIEWS.templates = function(){ return `<div id="myRoot"></div>`; };
window.afterRender.templates = function(){ renderMy(); };

function renderMy(){
  const root = document.getElementById('myRoot');
  if (!root) return;
  // D4 (#2) — yuklanmagan/xato holatlar filtr chiplaridan OLDIN: chip sanoqlari 0 bo'lib
  // "hech narsa yo'q" degan noto'g'ri xabar bermasin.
  if (tplLoading()) { root.innerHTML = `<div class="col gap-16">${skelChipRow()}${skelTableCard(4)}</div>`; return; }
  if (tplLoadError()) { root.innerHTML = tplErrorCard(); return; }
  let ts = tByContributor(contributorId());
  if(MY_FILTER!=='all') ts = ts.filter(t=>t.status===MY_FILTER);
  const q = (typeof CONTRIB_SEARCH !== "undefined" ? CONTRIB_SEARCH : "").trim();
  if (q) ts = ts.filter((t) => (t.name + " " + t.cat + " " + t.id).toLowerCase().includes(q));
  const all = tByContributor(contributorId());
  const cnt = s=>all.filter(t=>t.status===s).length;
  root.innerHTML = `<div class="col gap-16">
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
    <tbody>${ts.map(t=>`<tr style="cursor:pointer" tabindex="0" data-kbd-click onclick="openTplDrawer('${t.id}')">
      <td><div class="tmpl-cell"><div class="row-thumb">${cThumb(t)}</div><div class="tmpl-meta"><span class="nm">${esc(t.name)}</span><span class="sub">${esc(t.cat)}</span></div></div></td>
      <td>${badge(t.status)}${t.status==='approved'?'<div class="small" style="color:var(--green);margin-top:3px;font-size:10.5px">Live in AE</div>':''}${scanBadge(t.packScanStatus)?`<div style="margin-top:3px">${scanBadge(t.packScanStatus)}</div>`:''}${transcodeBadge(t.previewTranscodeStatus)?`<div style="margin-top:3px">${transcodeBadge(t.previewTranscodeStatus)}</div>`:''}</td>
      <td class="cell-muted mono">${esc(t.created)}</td>
      <td class="cell-num cell-strong">${t.dl?t.dl.toLocaleString():'\u2014'}${t.imports?`<div class="small" style="font-size:10.5px;font-weight:400">${t.imports.toLocaleString()} imports</div>`:''}</td>
      <!-- D4 (#11) \u2014 sabab HAR DOIM "\u2026" bilan tugardi (46 belgidan qisqa bo'lsa ham) va
           to'liq matnni ko'rish imkoni yo'q edi: endi shartli qisqartirish + title. -->
      <td class="cell-muted" style="max-width:200px">${t.reason?`<span style="color:var(--orange)" title="${esc(t.reason)}">${esc(t.reason.length>46?t.reason.slice(0,46)+'\u2026':t.reason)}</span>`:'\u2014'}</td>
      <td onclick="event.stopPropagation()"><div class="row-actions">
        ${(t.status==='draft'||t.status==='soft')?`<button class="act" title="Edit" onclick="event.stopPropagation();openEditTemplate('${t.id}')">${ic('edit')}</button>`:''}
        ${(t.status==='draft'||t.status==='soft')?`<button class="act success" title="Submit to moderation" onclick="submitDraftToModeration('${t.id}')">${ic('upload')}</button>`:''}
        ${t.status==='soft'?`<button class="act" title="Resubmit" onclick="resubmit('${t.id}')">${ic('refresh')}</button>`:''}
        <button class="act" title="View" onclick="openTplDrawer('${t.id}')">${ic('eye')}</button>
        ${canDeleteMine(t)?`<button class="act danger" title="Delete" onclick="deleteMyTemplate('${t.id}')">${ic('trash')}</button>`:''}
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div></div>`;
}
function myGrid(ts){
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:16px">
    ${ts.map(t=>`<div class="card" style="overflow:hidden;cursor:pointer" role="button" tabindex="0" data-kbd-click onclick="openTplDrawer('${t.id}')">
      <div class="thumb ${t.grad} grain" style="width:100%;aspect-ratio:16/10">
        ${cThumbMedia(t)}
        ${t.dur?`<span class="dur">${esc(t.dur)}</span>`:''}<div style="position:absolute;top:8px;left:8px;display:flex;flex-direction:column;gap:4px;align-items:flex-start">${badge(t.status)}${scanBadge(t.packScanStatus)}${transcodeBadge(t.previewTranscodeStatus)}</div></div>
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

/** #52 (T3.4) — contributor FAQAT qoralama yoki rad etilgan yozuvni o'chira oladi.
 *  Moderatsiya navbatidagi (`pending`) va jonli (`approved`) yozuv server tomonda ham
 *  409 bilan rad etiladi — tugmani ko'rsatmaymiz. */
function canDeleteMine(t) {
  return t.status === "draft" || t.status === "soft" || t.status === "hard";
}
async function deleteMyTemplate(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (t && !canDeleteMine(t)) return;
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--red-dim,rgba(230,90,90,.12));color:var(--red,#e65a5a)">${ic("trash")}</div>
      <div><h3>Delete this product?</h3><p>${esc(t ? t.name : "")}</p></div></div>
    <div class="modal-body"><p class="body">The record and its uploaded files are removed permanently. This cannot be undone.</p></div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmDeleteMyTemplate('${id}')">${ic("trash")} Delete</button></div>`);
}
async function confirmDeleteMyTemplate(id) {
  closeModal();
  try {
    await StudioApi.deleteTemplate(id);
    await StudioTemplates.refreshAfterUpload();
    toast("Deleted", "The product was removed", "success");
    closeDrawer();
    if (CURRENT === "overview") route("overview");
    else if (CURRENT === "templates") renderMy();
  } catch (e) {
    toast("Error", e.message || "Delete failed", "danger");
  }
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
      { sub: "pr", label: "Premiere Pro", exts: [".mogrt", ".prproj", ".zip"] },
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
let BULK_ABORT = null; // #25 (C2) — faol partiyani bekor qilish uchun AbortController
let BULK_BATCH_ID = null; // #26 (C3) — joriy ingest partiyasi (uzilishdan keyin tiklash uchun)

/** #26 (C3) — UZILGAN PARTIYA. Sessiya tugashi (401 → login redirect), sahifa yopilishi
 *  yoki qayta yuklanishida faol bulk butunlay yo'qolardi: fayllar bulutga chiqib
 *  ingest navbatiga tushgan bo'lsa ham foydalanuvchi buni bilmasdi. Partiya raqamini
 *  `localStorage`'ga yozamiz va keyingi kirishda "tekshirish" bannerini ko'rsatamiz.
 *  (File obyektlari serializatsiya qilinmaydi — faqat nom/son saqlanadi.) */
const BULK_RESUME_KEY = "af_bulk_resume";
function saveBulkResume() {
  if (!BULK_BATCH_ID) return;
  try {
    localStorage.setItem(
      BULK_RESUME_KEY,
      JSON.stringify({
        batchId: BULK_BATCH_ID,
        cat: BULK_CAT,
        at: Date.now(),
        files: BULK_FILES.filter((b) => b.stage === "processing" || b.stage === "uploading").map(
          (b) => b.file.name
        ),
      })
    );
  } catch {
    /* kvota/private rejim — tiklash shunchaki bo'lmaydi */
  }
}
function loadBulkResume() {
  try {
    const raw = localStorage.getItem(BULK_RESUME_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    // 24 soatdan eski yozuv qiziq emas (ingest retention'idan ham uzoq).
    if (!d || !d.batchId || Date.now() - (d.at || 0) > 24 * 3600 * 1000) {
      clearBulkResume();
      return null;
    }
    return d;
  } catch {
    return null;
  }
}
function clearBulkResume() {
  try {
    localStorage.removeItem(BULK_RESUME_KEY);
  } catch {
    /* ignore */
  }
}
window.clearBulkResumeAndRender = function () {
  clearBulkResume();
  renderUpload();
};

/** Saqlangan partiyani serverdan tekshiradi va natijani ko'rsatadi. */
async function checkBulkResume() {
  const d = loadBulkResume();
  if (!d) return;
  const btn = document.getElementById("bulkResumeBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Checking…";
  }
  try {
    const prog = await StudioApi.ingestProgress(d.batchId);
    const items = (prog && prog.items) || [];
    const done = items.filter((i) => i.status === "done").length;
    const dup = items.filter((i) => i.status === "duplicate").length;
    const failed = items.filter((i) => i.status === "failed").length;
    const busy = items.length - done - dup - failed;
    if (busy > 0) {
      toast("Upload", `${busy} file(s) are still processing — check again in a few minutes`, "info");
    } else {
      toast(
        "Upload",
        `Batch finished: ${done} sent to moderation${dup ? `, ${dup} duplicate` : ""}${failed ? `, ${failed} failed` : ""}`,
        done ? "success" : "warn"
      );
      clearBulkResume();
    }
    if (done) await StudioTemplates.refreshAfterUpload();
  } catch (e) {
    toast("Error", e.message || "Could not check the batch", "danger");
  }
  renderUpload();
}
window.checkBulkResume = checkBulkResume;

// #26 — sessiya tugab login'ga otishdan oldin partiyani saqlab qolamiz.
if (typeof StudioApi !== "undefined" && StudioApi.onSessionExpired) {
  StudioApi.onSessionExpired(() => {
    if (BULK_RUNNING) saveBulkResume();
  });
}
// Faol yuklashda tasodifiy sahifa yopilishi — brauzer tasdig'i (+ partiyani saqlash).
// D4 (#14) — UP_UPLOADING ham hisobga olinadi: edit-wizard/bitta fayl yuklashda sahifa
// yopilsa ilgari hech qanday ogohlantirish yo'q edi (katta pack jimgina yo'qolardi).
window.addEventListener("beforeunload", (e) => {
  if (!BULK_RUNNING && !UP_UPLOADING) return;
  if (BULK_RUNNING) saveBulkResume();
  e.preventDefault();
  e.returnValue = "";
});

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
async function selectBulkCat(key) {
  if (BULK_RUNNING) return;
  if (!taxonByKey(key)) return;
  if (BULK_FILES.length && key !== BULK_CAT && !(await afConfirm({
    title: "Change category?",
    warn: `${BULK_FILES.length} selected file(s) will be cleared because the allowed formats may change.`,
    okLabel: "Change and clear",
  }))) return;
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
  // #25 (C2) — kuzatuv to'xtadi, natija noma'lum (server ishlashda davom etishi mumkin).
  if (b.stage === "unknown") return `? ${b.error || "Unknown status — check My templates"}`;
  return "";
}
function bulkStageColor(b) {
  if (b.stage === "done") return "var(--green,#82c341)";
  if (b.stage === "duplicate" || b.stage === "unknown") return "var(--amber,#f59e0b)";
  if (b.stage === "error") return "var(--red,#ef4444)";
  return "var(--text-dim)";
}
function bulkFillColor(b) {
  if (b.stage === "error") return "var(--red,#ef4444)";
  if (b.stage === "duplicate" || b.stage === "unknown") return "var(--amber,#f59e0b)";
  return "var(--green,#82c341)";
}

function bulkRenderRow(b, i) {
  // #25 — `unknown` ham o'chiriladigan: aks holda qator abadiy osilib qolardi.
  const removable =
    b.stage === "queued" || b.stage === "error" || b.stage === "duplicate" || b.stage === "unknown";
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
  dz.setAttribute("role", "button");
  dz.setAttribute("tabindex", "0");
  dz.setAttribute("aria-label", "Choose files to upload");
  dz.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
  };
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
  BULK_ABORT = typeof AbortController !== "undefined" ? new AbortController() : null;
  const signal = BULK_ABORT ? BULK_ABORT.signal : null;
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
    const onBatchId = (id) => {
      BULK_BATCH_ID = id;
      saveBulkResume(); // #26 — endi partiya serverda; uzilsa ham tiklab tekshiriladi
    };
    if (t.source === "zip") {
      await StudioApi.bulkIngestZips(files, onProg, rights, signal, onBatchId);
    } else {
      await StudioApi.bulkIngestAssets(t.key, files, onProg, rights, signal, onBatchId);
    }
    const doneCount = queued.filter((b) => b.stage === "done").length;
    const dupCount = queued.filter((b) => b.stage === "duplicate").length;
    const errCount = queued.filter((b) => b.stage === "error").length;
    const unkCount = queued.filter((b) => b.stage === "unknown").length;
    if (signal && signal.aborted) {
      toast(
        "Cancelled",
        unkCount
          ? `Upload stopped — ${unkCount} file(s) already reached the server and keep processing`
          : "Upload stopped",
        "warn"
      );
      if (doneCount) await StudioTemplates.refreshAfterUpload();
      return;
    }
    if (unkCount) {
      toast("Upload", `${unkCount} file(s) are still processing — check My templates later`, "warn");
    }
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
    if (!(e && e.__aborted)) toast("Error", e.message || "Upload failed", "danger");
  } finally {
    BULK_RUNNING = false;
    BULK_ABORT = null;
    // Partiya terminalga yetdi (yoki bekor qilindi) → tiklash yozuvi kerak emas.
    // `unknown` qolgan bo'lsa yozuvni SAQLAYMIZ — foydalanuvchi keyin tekshiradi.
    if (!BULK_FILES.some((b) => b.stage === "unknown")) clearBulkResume();
    BULK_BATCH_ID = null;
    renderUpload();
  }
}

/** #25 (C2) — faol partiyani to'xtatadi: ochiq PUT'lar uziladi, navbatdagi fayllar
 *  `queued` bo'lib qoladi, serverga yetib ulgurgan fayllar `unknown` bo'ladi
 *  (server ularni ishlashda davom etadi — natija My templates'da ko'rinadi). */
function bulkAbort() {
  if (!BULK_RUNNING || !BULK_ABORT) return;
  BULK_ABORT.abort();
  const btn = document.getElementById("bulkAbortBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Stopping…";
  }
}
window.bulkAbort = bulkAbort;

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

  // #26 (C3) — uzilgan partiya banneri (sessiya tugashi / sahifa yopilishi).
  const resume = !BULK_RUNNING ? loadBulkResume() : null;
  const resumeCard = resume
    ? `<div class="card card-pad row between center gap-12" style="border-color:var(--amber,#f59e0b)">
        <div class="col" style="gap:2px;min-width:0">
          <span class="cell-strong">A previous upload was interrupted</span>
          <span class="small">${resume.files && resume.files.length ? `${resume.files.length} file(s)` : "Some files"} may still be processing on the server.</span>
        </div>
        <div class="row gap-8">
          <button class="btn btn-ghost btn-sm" onclick="clearBulkResumeAndRender()">Dismiss</button>
          <button class="btn btn-primary btn-sm" id="bulkResumeBtn" onclick="checkBulkResume()">${ic("refresh")} Check status</button>
        </div>
      </div>`
    : "";

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
    ${resumeCard}
    <div class="card card-pad col gap-16">
      ${bulkCatPicker()}
      ${t ? infoBanner(t.hint) : ""}
      <div class="dropzone${t ? "" : " disabled"}" id="bulkDz" style="${t ? "" : "opacity:.55;pointer-events:none"}">
        <input type="file" id="bulkFileInput" accept="${acceptAttr}" multiple style="display:none">
        ${dzBody}
      </div>
      ${BULK_FILES.length ? `<div class="col">${BULK_FILES.map((b, i) => bulkRenderRow(b, i)).join("")}</div>` : ""}
      <label class="row gap-8" style="cursor:pointer;align-items:flex-start"><div class="checkbox${BULK_RIGHTS ? " on" : ""}" role="checkbox" tabindex="0" aria-checked="${BULK_RIGHTS ? "true" : "false"}" onclick="toggleBulkRights()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleBulkRights()}">${ic("check")}</div><span class="body" style="flex:1">${RIGHTS_ATTEST_TEXT}</span></label>
      <div class="row between center">
        <button class="btn btn-ghost" onclick="bulkClearFinished()" ${BULK_FILES.some((b) => b.stage === "done") && !BULK_RUNNING ? "" : "disabled"}>Clear finished</button>
        ${BULK_RUNNING ? `<button class="btn btn-danger-ghost" id="bulkAbortBtn" onclick="bulkAbort()">${ic("x")} Stop</button>` : ""}
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
    prog = await listenUploadProgress(tid, (p) => { if (!p.error) setUploadServerStage(p); });
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

async function listenUploadProgress(tid, onUpdate) {
  const handle = { stage: "", close() {} };
  if (typeof EventSource === "undefined") return handle;
  let es = null;
  try {
    const capability = await StudioApi.getUploadProgressToken(tid);
    if (!capability?.token) return handle;
    es = new EventSource(
      `${StudioApi.baseUrl()}/api/contributor/templates/${encodeURIComponent(tid)}/upload-progress?token=${encodeURIComponent(capability.token)}`
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
        prog = await listenUploadProgress(tid, (p) => {
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
  const renderEpoch = (window.__cmsgEpoch = (window.__cmsgEpoch || 0) + 1);
  const root = document.getElementById("cmsgRoot");
  if (!C_THREADS.length) {
    root.innerHTML = `<div class="card card-pad empty"><div class="ico">${ic("inbox")}</div><h3>No messages</h3><p class="body">Admin moderation and broadcast messages will appear here.</p></div>`;
    return;
  }
  if (CMSG_SEL >= C_THREADS.length) CMSG_SEL = 0;
  const th = C_THREADS[CMSG_SEL];
  let loadedMessages = [];
  try {
    const data = await StudioApi.getMessageThread(th.id);
    if (renderEpoch !== window.__cmsgEpoch || C_THREADS[CMSG_SEL]?.id !== th.id) return;
    loadedMessages = data.messages || [];
    await StudioApi.markMessageThreadRead(th.id);
    if (renderEpoch !== window.__cmsgEpoch || C_THREADS[CMSG_SEL]?.id !== th.id) return;
    C_THREAD_MESSAGES = loadedMessages;
    th.unread = false;
    window._STUDIO_MSG_UNREAD = contributorUnreadCount();
    if (typeof renderNav === "function") renderNav();
  } catch (e) {
    toast("Error", e.message || "Failed to load messages", "danger");
  }

  const canReply = !th.isBroadcast;
  const me = typeof AssetFlowAuth !== "undefined" ? AssetFlowAuth.getSession() : null;
  const myInitials = (me?.name || "S").slice(0, 2).toUpperCase();

  // D4 (#8) — inline `height:640px` o'rniga `.msg-layout` klassi: mobil media-qoida
  // faqat display/flex-direction ni bosa olardi, balandlik esa qotib qolardi (kesilish).
  root.innerHTML = `<div class="card" style="overflow:hidden"><div class="msg-layout">
    <div class="col" style="border-right:1px solid var(--line)">
      <div class="card-head"><h3>Messages</h3><span class="nav-badge brand">${contributorUnreadCount()}</span></div>
      <div class="col" style="overflow-y:auto">
        ${C_THREADS.map(
          (t, i) => `<div class="mod-item ${i === CMSG_SEL ? "sel" : ""}" role="button" tabindex="0" data-kbd-click onclick="selectContributorThread(${i})">
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
          // D4 (#13) — avatar gradienti tokenlarga: admin = brend, o'zim = neytral.
          return `<div class="msg ${isMe ? "me" : ""}"><div class="avatar ${isMe ? "avatar-neutral" : "avatar-brand"}" style="width:28px;height:28px;font-size:11px">${isMe ? esc(myInitials) : esc(ini)}</div><div class="msg-body"><div class="msg-name" style="color:${isMe ? "var(--tx-1)" : "var(--violet-bright)"}">${isMe ? "You" : esc(nm)}</div><div class="msg-text">${esc(m.body)}</div><div class="msg-time">${esc(formatMsgDate(m.createdAt))}</div></div></div>`;
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
  const threadId = th?.id;
  const input = document.getElementById("cReplyInput");
  const body = input?.value?.trim();
  if (!th || !body || input?.dataset.busy === "1") return;
  if (input) { input.dataset.busy = "1"; input.disabled = true; }
  try {
    await StudioApi.replyMessageThread(threadId, body);
    if (input) input.value = "";
    const data = await StudioApi.getMessageThread(threadId);
    th.last = body;
    if (C_THREADS[CMSG_SEL]?.id === threadId) {
      C_THREAD_MESSAGES = data.messages || [];
      await renderCMsg();
    }
    toast("Sent", "Your reply was delivered to the admin", "success");
  } catch (e) {
    toast("Error", e.message || "Send failed", "danger");
  } finally {
    const current = document.getElementById("cReplyInput");
    if (current) { current.dataset.busy = ""; current.disabled = false; }
  }
}

async function saveContributorProfile() {
  const nameEl = document.getElementById("cProfileName");
  const name = nameEl?.value?.trim();
  if (!name) {
    toast("Profile", "Enter a name", "warn");
    return;
  }
  // #86 (C7) — bio ham saqlanadi (ilgari maydon `id`siz edi va hech qayerga bormasdi).
  const bioEl = document.getElementById("cProfileBio");
  const bio = bioEl ? bioEl.value.trim().slice(0, 500) : undefined;
  try {
    await StudioApi.patchProfile(bio === undefined ? { name } : { name, bio });
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
        <div class="field"><label>Bio</label><textarea id="cProfileBio" class="textarea" maxlength="500" placeholder="A short bio about yourself…"></textarea><span class="hint">Up to 500 characters. Saved with the Save button below.</span></div>
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
    <!-- #83 (C4) \u2014 daromad/to'lovlar endi ALOHIDA "Earnings" ekranida (nav'da). -->
    <div class="card"><div class="card-head"><h3>Earnings &amp; payouts</h3></div>
      <div class="card-pad row between center gap-14 wrap">
        <p class="body" style="color:var(--tx-2);margin:0">Your balance, total earned and payout history moved to their own screen.</p>
        <button class="btn btn-ghost" onclick="route('earnings')">${ic('dollar')} Open Earnings</button>
      </div>
    </div>
    <!-- #135 (C13) — "Coming soon" placeholder O'RNIGA haqiqiy holat: bu emaillar
         hozir HAQIQATAN yuboriladi (routes/contributor.ts review → sendEmail).
         Soxta sozlash tugmalari qo'ymaymiz — sozlanadigan narsa hali yo'q. -->
    <div class="card"><div class="card-head"><h3>Notifications</h3><span class="small">${esc(em)}</span></div>
      <div class="card-pad col gap-10">
        <p class="body" style="color:var(--tx-2)">We email you at the address above when:</p>
        <ul class="body" style="color:var(--tx-2);padding-left:18px;line-height:1.8;margin:0">
          <li>a template of yours is <b>approved</b> and goes live in the AE catalog;</li>
          <li>a template is <b>sent back or rejected</b> — the moderation note is included.</li>
        </ul>
        <div class="info-banner" style="font-size:12px">${ic('inbox')}<span>The full conversation with the admin is in the <a href="#" onclick="event.preventDefault();route('messages')" style="color:var(--violet-bright)">Messages</a> section.</span></div>
      </div>
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
  if (typeof StudioApi === 'undefined' || !StudioApi.token()) return;
  // #86 (C7) — saqlangan bio'ni serverdan tortamiz (sessiya faqat name/email saqlaydi).
  if (StudioApi.getProfile) {
    StudioApi.getProfile().then(p => {
      const el = document.getElementById('cProfileBio');
      if (el && !el.value) el.value = p?.bio || '';
    }).catch(() => { /* bio yuklanmasa maydon bo'sh qoladi — saqlash baribir ishlaydi */ });
  }
};

/* #83 (C4) — DAROMAD ALOHIDA EKRAN. Ilgari bu blok Settings sahifasining uchinchi
   kartasi edi: yuklovchi balansini topolmasdi. Endi nav'da o'z bo'limi bor. */
VIEWS.earnings = function(){
  return `<div style="max-width:900px" class="col gap-16">
    <div class="card"><div class="card-head"><h3>Earnings &amp; payouts</h3><span class="small" id="cEarnMode"></span></div>
      <div class="card-pad col gap-14" id="cEarningsBody">
        <p class="body" style="color:var(--tx-2)">Loading your earnings…</p>
      </div>
    </div>
  </div>`;
};
window.afterRender.earnings = async function(){
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
// #85 (C6) — TARIX HAQIQIY VAQT MUHRLARIDAN. Ilgari bu funksiya faqat joriy
// holatdan "ishonarli" tarix TO'QIRDI: har shablon "Submitted <created>" bilan
// boshlanardi (draft ham), moderatsiya sanasi umuman ko'rsatilmasdi. Endi qatorlar
// serverdagi maydonlardan quriladi: createdAt / reviewedAt / takedownAt / published.
// Sana yo'q bo'lsa qator ham yo'q — soxta bosqich chizmaymiz.
function statusTimeline(t){
  const a=(t&&t._api)||{};
  const when=iso=>(typeof fmtLocalDateTime==='function'?fmtLocalDateTime(iso):String(iso||'—'));
  const rows=[{t:'Draft created',meta:when(a.createdAt)+' · uploaded to Studio',c:'gray',ic:'edit'}];
  if(t.status==='draft') return rows;
  // Yuborilgan payt alohida saqlanmaydi — DRAFT dan chiqqan yozuv uchun eng yaqin
  // ma'lum belgi `reviewedAt` gacha bo'lgan oraliq. Shuning uchun "Submitted" qatori
  // sanasiz beriladi (yolg'on sana yozgandan ko'ra ko'rsatmagan afzal).
  rows.push({t:'Submitted for moderation',meta:t.status==='pending'?'Waiting for admin review':'Sent to the moderation queue',c:'violet',ic:'upload'});
  if(a.reviewedAt) rows.push({t:'Reviewed',meta:when(a.reviewedAt)+' · admin moderation',c:'blue',ic:'eye'});
  if(t.status==='soft') rows.push({t:'Sent back for changes',meta:a.reviewedAt?when(a.reviewedAt):'Admin · with a reason',c:'orange',ic:'reply',note:t.reason});
  if(t.status==='hard') rows.push({t:'Rejected',meta:a.reviewedAt?when(a.reviewedAt)+' · final rejection':'Admin · final rejection',c:'red',ic:'ban',note:t.reason});
  if(t.status==='approved'){
    rows.push({t:'Approved',meta:(a.reviewedAt?when(a.reviewedAt)+' · ':'')+(a.published?'live in the AE catalog':'approved, not published yet'),c:a.published?'green':'orange',ic:'check'});
  }
  if(a.takedownAt) rows.push({t:'Taken down',meta:when(a.takedownAt)+' · removed from the catalog',c:'red',ic:'ban',note:a.takedownReason||''});
  // Almashtirilgandan keyin qayta navbatga tushgan (reviewedAt bor, lekin yana pending).
  if(t.status==='pending'&&a.reviewedAt) rows.push({t:'Back in the queue',meta:'Files or metadata were replaced after review',c:'violet',ic:'refresh'});
  return rows;
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
          return `<div class="msg"><div class="avatar ${isAdmin ? "avatar-brand" : "avatar-neutral"}" style="width:28px;height:28px;font-size:11px">${esc(who.slice(0, 2).toUpperCase())}</div>
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

/* D4 (#5) — thread bo'limi o'rniga vaqtincha skelet: drawer DARHOL ochilishi kerak. */
function drawerThreadPlaceholder(t){
  if (!(t.status === "soft" || t.status === "hard")) return '<div id="drawerThread"></div>';
  return `<div id="drawerThread"><div class="divider"></div>
    <div class="col gap-8" aria-busy="true" aria-label="Loading conversation">
      <div class="skeleton skeleton-line w40"></div>
      <div class="skeleton" style="height:44px"></div>
      <div class="skeleton" style="height:44px;width:78%"></div>
    </div></div>`;
}

function openTplDrawer(id){
  const t=TEMPLATES.find(x=>x.id===id);
  if (!t) return;
  // D4 (#5) — ilgari drawer IKKI tarmoq so'rovi (threads + thread detail) tugagach ochilardi:
  // qatorni bosgandan keyin ~1s hech qanday javob yo'q edi. Endi skelet bilan darhol ochiladi.
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

      ${drawerThreadPlaceholder(t)}
    </div>
    <div class="drawer-foot">
      ${t.status==='soft'?`<button class="btn btn-success grow" onclick="closeDrawer();openEditTemplate('${t.id}')">${ic('edit')} Fix and resubmit</button><button class="btn btn-ghost" title="Resubmit without changes" aria-label="Resubmit without changes" onclick="closeDrawer();resubmit('${t.id}')">${ic('refresh')}</button>`:''}
      ${t.status==='draft'?`<button class="btn btn-success grow" onclick="submitDraftToModeration('${t.id}')">${ic('upload')} Submit for moderation</button><button class="btn btn-ghost" title="Edit" aria-label="Edit" onclick="closeDrawer();openEditTemplate('${t.id}')">${ic('edit')} Edit</button>`:''}
      ${t.status==='approved'?`<button class="btn btn-ghost grow" onclick="closeDrawer()">Close</button>`:''}
      ${t.status==='hard'?`<button class="btn btn-ghost grow" onclick="closeDrawer()">Close</button>`:''}
      ${t.status==='pending'?`<button class="btn btn-ghost grow" onclick="closeDrawer()">Close · in moderation</button>`:''}
      ${canDeleteMine(t)?`<button class="btn btn-danger-ghost" title="Delete" aria-label="Delete" onclick="deleteMyTemplate('${t.id}')">${ic('trash')}</button>`:''}
    </div>`);

  // Suhbat bo'limi drawer ochilgandan KEYIN to'ldiriladi (skeletni almashtiradi).
  if (t.status === "soft" || t.status === "hard") {
    renderDrawerThreadSection(t)
      .then((html) => {
        const host = document.getElementById("drawerThread");
        if (host) host.innerHTML = html;
      })
      .catch(() => {
        const host = document.getElementById("drawerThread");
        if (host) host.innerHTML = t.reason
          ? `<div class="divider"></div><div class="info-banner warn">${ic("reply")}<span>${esc(t.reason)}</span></div>`
          : "";
      });
  }
}
