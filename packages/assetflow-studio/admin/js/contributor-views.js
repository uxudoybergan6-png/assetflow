/* ============================================================
   AssetFlow — Contributor views
   Overview, My templates, Upload, Detail drawer, Messages, Settings
   ============================================================ */
window.VIEWS = window.VIEWS || {};
window.afterRender = window.afterRender || {};

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

/* ============================================================
   OVERVIEW
   ============================================================ */
VIEWS.overview = function(){
  const ts = tByContributor(contributorId());
  const ap=ts.filter(t=>t.status==='approved').length, pe=ts.filter(t=>t.status==='pending').length,
        sr=ts.filter(t=>t.status==='soft').length, hr=ts.filter(t=>t.status==='hard').length;
  const dl=ts.reduce((a,t)=>a+t.dl,0);
  const needsAction = ts.filter(t=>t.status==='soft' || t.status==='draft');
  const sc = subscriberCounts();
  const freeP = planById('free');
  const proP = planById('pro');
  return `<div class="col gap-20">
    ${infoBanner('Obunachilar AE pluginida <b>Free</b> yoki <b>Pro</b> rejimda. Tasdiqlangan shablonlaringiz <b>After Effects \u2192 AssetFlow Browse</b> da ko\u2018rinadi.')}

    <div class="plan-mini-row">
      <div class="plan-mini plan-mini-free">
        <span class="label">Free obunachilar</span>
        <span class="num" style="font-size:22px;font-weight:700">${sc.free}</span>
        <span class="small">${formatPlanLimit(freeP)} yuklab olish</span>
      </div>
      <div class="plan-mini plan-mini-pro">
        <span class="label">Pro obunachilar</span>
        <span class="num" style="font-size:22px;font-weight:700">${sc.pro}</span>
        <span class="small">${planPriceLabel(proP)} · ${formatPlanLimit(proP)}</span>
      </div>
      <div class="plan-mini">
        <span class="label">Sizning shablon yuklab olishlari</span>
        <span class="num" style="font-size:22px;font-weight:700">${dl.toLocaleString()}</span>
        <span class="small">tasdiqlangan ${ap} ta shablon</span>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard({label:'Jami yuklangan',val:ts.length,ic:'layers',c:'violet',foot:'barcha holatlar'})}
      ${kpiCard({label:'Tasdiqlangan',val:ap,ic:'checkCircle',c:'green',foot:'AE\u2018da live'})}
      ${kpiCard({label:'Kutilmoqda',val:pe,ic:'clock',c:'yellow',foot:'moderatsiyada'})}
      ${kpiCard({label:'Rad etilgan',val:sr+hr,ic:'xCircle',c:'orange',foot:`${sr} soft \u00b7 ${hr} hard`})}
    </div>

    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:20px;align-items:start">
      <!-- next step + needs action -->
      <div class="col gap-16">
        <div class="card" style="background:linear-gradient(120deg,var(--violet-dim),transparent);border-color:var(--violet-line)">
          <div class="card-pad row between center gap-16 wrap">
            <div class="col gap-4"><span class="h3">Keyingi qadam</span><span class="small" style="max-width:380px">Yangi motion shablon yuklang \u2014 moderatsiyadan o\u2018tgach AE katalogida joy oladi.</span></div>
            <button class="btn btn-primary btn-lg" onclick="route('upload')">${ic('upload')} Yangi shablon yuklash</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div><h3>E\u2018tibor talab qiladi</h3><span class="small">Soft reject va qoralamalar</span></div></div>
          <div class="col">
            ${needsAction.length? needsAction.map(t=>`<div class="row center gap-12" style="padding:13px 18px;border-bottom:1px solid var(--line-soft)">
              <div class="row-thumb" style="width:54px;height:34px">${thumbArt(t.grad,'',true)}</div>
              <div class="col grow" style="gap:3px;min-width:0"><span class="cell-strong">${t.name}</span><span class="small">${t.status==='soft'?'Soft reject \u2014 tuzatib qayta yuboring':'Qoralama \u2014 hali yuborilmagan'}</span></div>
              ${badge(t.status)}
              ${t.status==='draft'?`<button class="btn btn-primary btn-sm" onclick="submitDraftToModeration('${t.id}')">${ic('upload')} Yuborish</button>`:''}
              <button class="btn btn-ghost btn-sm" onclick="openTplDrawer('${t.id}')">Ko\u2018rish</button>
            </div>`).join('') : `<div class="empty" style="padding:34px"><div class="ico">${ic('checkCircle')}</div><h3>Hammasi joyida</h3><p>E\u2018tibor talab qiladigan shablon yo\u2018q.</p></div>`}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Faoliyat tarixi</h3></div>
          <div class="card-pad">${ts.length ? `<div class="timeline">${ts.slice(0,5).map(t=>`<div class="tl-item"><div class="tl-dot" style="background:var(--${t.status==='approved'?'green':'violet'})">${ic(t.status==='approved'?'check':'upload')}</div><div class="tl-title">${t.name}</div><div class="tl-meta">${badge(t.status)} \u00b7 ${t.created||''}</div></div>`).join('')}</div>` : `<div class="empty" style="padding:24px"><p class="small">Hali faoliyat yo\u2018q</p></div>`}
          </div>
        </div>
      </div>

      <!-- recent admin messages -->
      <div class="card">
        <div class="card-head"><div><h3>Admin xabarlari</h3><span class="small">So\u2018nggi</span></div><button class="btn btn-subtle btn-sm" onclick="route('messages')">Barchasi ${ic('chevR')}</button></div>
        <div class="col">
          <div class="empty" style="padding:34px"><div class="ico">${ic('message')}</div><h3>Xabar yo\u2018q</h3><p class="small">Admin javobi shu yerda chiqadi</p></div>
        </div>
      </div>
    </div>
  </div>`;
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
        ${[['all','Barchasi',all.length],['approved','Tasdiqlangan',cnt('approved')],['pending','Kutilmoqda',cnt('pending')],['soft','Soft reject',cnt('soft')],['hard','Hard reject',cnt('hard')],['draft','Qoralama',cnt('draft')]].map(([k,l,n])=>
          `<button class="chip ${MY_FILTER===k?'active':''}" onclick="MY_FILTER='${k}';renderMy()">${l}<span class="cnt">${n}</span></button>`).join('')}
      </div>
      <div class="segmented">
        <button class="${MY_VIEW==='table'?'active':''}" onclick="MY_VIEW='table';renderMy()">${ic('list')} Jadval</button>
        <button class="${MY_VIEW==='grid'?'active':''}" onclick="MY_VIEW='grid';renderMy()">${ic('grid')} Grid</button>
      </div>
    </div>
    ${ts.length? (MY_VIEW==='table'?myTable(ts):myGrid(ts)) : `<div class="card"><div class="empty"><div class="ico">${ic('layers')}</div><h3>Shablon yo\u2018q</h3><p>Bu filtrda shablon topilmadi. Yangi shablon yuklab boshlang.</p><button class="btn btn-primary" onclick="route('upload')">${ic('upload')} Yangi yuklash</button></div></div>`}
  </div>`;
}
function myTable(ts){
  return `<div class="card"><div class="table-wrap"><table class="data" style="min-width:820px">
    <thead><tr><th>Shablon</th><th>Holat</th><th>Yaratilgan</th><th class="th-num">Downloads</th><th>Admin izohi</th><th style="width:130px"></th></tr></thead>
    <tbody>${ts.map(t=>`<tr style="cursor:pointer" onclick="openTplDrawer('${t.id}')">
      <td><div class="tmpl-cell"><div class="row-thumb">${thumbArt(t.grad,'',true)}</div><div class="tmpl-meta"><span class="nm">${t.name}</span><span class="sub">${t.cat}</span></div></div></td>
      <td>${badge(t.status)}${t.status==='approved'?'<div class="small" style="color:var(--green);margin-top:3px;font-size:10.5px">AE\u2018da live</div>':''}</td>
      <td class="cell-muted mono">${t.created}</td>
      <td class="cell-num cell-strong">${t.dl?t.dl.toLocaleString():'\u2014'}</td>
      <td class="cell-muted" style="max-width:200px">${t.reason?`<span style="color:var(--orange)">${t.reason.slice(0,46)}\u2026</span>`:'\u2014'}</td>
      <td onclick="event.stopPropagation()"><div class="row-actions">
        ${(t.status==='draft'||t.status==='soft')?`<button class="act" title="Tahrir" onclick="event.stopPropagation();openEditTemplate('${t.id}')">${ic('edit')}</button>`:''}
        ${(t.status==='draft'||t.status==='soft')?`<button class="act success" title="Moderatsiyaga yuborish" onclick="submitDraftToModeration('${t.id}')">${ic('upload')}</button>`:''}
        ${t.status==='soft'?`<button class="act" title="Qayta yuborish" onclick="resubmit('${t.id}')">${ic('refresh')}</button>`:''}
        <button class="act" title="Ko\u2018rish" onclick="openTplDrawer('${t.id}')">${ic('eye')}</button>
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div></div>`;
}
function myGrid(ts){
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:16px">
    ${ts.map(t=>`<div class="card" style="overflow:hidden;cursor:pointer" onclick="openTplDrawer('${t.id}')">
      <div class="thumb ${t.grad} grain" style="width:100%;aspect-ratio:16/10"><div class="play"><span>${ic('play')}</span></div>${t.dur?`<span class="dur">${t.dur}</span>`:''}<div style="position:absolute;top:8px;left:8px">${badge(t.status)}</div></div>
      <div class="card-pad col gap-8">
        <div class="col" style="gap:2px"><span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</span><span class="small">${t.cat} \u00b7 ${t.created}</span></div>
        <div class="row between center"><span class="small">${t.dl?t.dl.toLocaleString()+' yuklab olindi':'\u2014'}</span>
        ${t.status==='soft'?`<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();resubmit('${t.id}')">${ic('refresh')} Qayta</button>`:''}</div>
      </div>
    </div>`).join('')}
  </div>`;
}
async function submitDraftToModeration(id) {
  if (!StudioApi.token()) {
    toast("API", "Qayta kiring", "warn");
    return;
  }
  try {
    await StudioApi.submitTemplate(id);
    await StudioTemplates.refreshAfterUpload();
    toast("Yuborildi", "Moderatsiya navbatiga yuborildi — Admin tasdiqlaydi", "success");
    if (CURRENT === "overview" || CURRENT === "templates") {
      if (CURRENT === "overview") route("overview");
      else renderMy();
    }
    closeDrawer();
  } catch (e) {
    toast("Xato", e.message || "Yuborish muvaffaqiyatsiz", "danger");
  }
}

async function resubmit(id) {
  await submitDraftToModeration(id);
}

/* ============================================================
   UPLOAD WIZARD
   ============================================================ */
let UP_STEP=1;
let UP_EDIT_ID = null;
const UP_DRAFT = { files: {} };

function openEditTemplate(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) {
    toast("Xato", "Shablon topilmadi", "danger");
    return;
  }
  UP_EDIT_ID = id;
  UP_STEP = 1;
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
  UP_DRAFT.files = {};
  route("upload");
  toast("Tahrirlash", "Ma\u2018lumot va fayllarni yangilang, keyin yuboring", "info");
}
function saveUploadStep1() {
  const root = document.getElementById("upRoot");
  if (!root) return;
  // 2–3-qadamda #upName yo'q — mavjud UP_DRAFT ni bo'sh qilib yozmaslik
  const nameEl = root.querySelector("#upName");
  if (nameEl) UP_DRAFT.name = nameEl.value.trim();
  const descEl = root.querySelector("#upDesc");
  if (descEl) UP_DRAFT.desc = descEl.value.trim();
  const catEl = root.querySelector("#upCat");
  if (catEl) UP_DRAFT.catLabel = catEl.value;
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
  if (!UP_DRAFT.name || !UP_DRAFT.desc || !UP_DRAFT.catLabel) {
    toast("Maydonlar", "Nom, tavsif va kategoriya to'ldiring", "warn");
    return false;
  }
  return true;
}

function validateUploadPackFile() {
  const pack = UP_DRAFT.files?.pack;
  if (!pack) {
    toast(
      "Loyiha fayli",
      "After Effects import uchun .aep yoki .zip pack yuklang",
      "warn"
    );
    return false;
  }
  const name = (pack.name || "").toLowerCase();
  if (!/\.(aep|zip)$/i.test(name)) {
    toast("Loyiha fayli", "Faqat .aep yoki .zip qabul qilinadi", "warn");
    return false;
  }
  return true;
}

function uploadStepNext() {
  if (UP_STEP === 1 && !validateUploadStep1()) return;
  UP_STEP = Math.min(3, UP_STEP + 1);
  renderUpload();
}

function bindUploadFileInputs() {
  const thumb = document.getElementById("upThumb");
  const preview = document.getElementById("upPreview");
  const pack = document.getElementById("upPack");
  if (thumb) thumb.onchange = () => { UP_DRAFT.files.thumb = thumb.files?.[0] || null; };
  if (preview) preview.onchange = () => { UP_DRAFT.files.preview = preview.files?.[0] || null; };
  if (pack) pack.onchange = () => { UP_DRAFT.files.pack = pack.files?.[0] || null; };
}

VIEWS.upload = function(){ return `<div id="upRoot"></div>`; };
window.afterRender.upload = function(){ renderUpload(); };

function renderUpload(){
  const steps=['Asosiy ma\u2018lumot','Media fayllar','Yuborish'];
  document.getElementById('upRoot').innerHTML = `<div style="max-width:880px;margin:0 auto" class="col gap-20">
    <!-- stepper -->
    <div class="row between center" style="gap:8px">
      ${steps.map((s,i)=>{const n=i+1;const st=n<UP_STEP?'done':n===UP_STEP?'active':'';return `
        <div class="row center gap-10 ${i<steps.length-1?'grow':''}">
          <div class="step-dot ${st}">${n<UP_STEP?ic('check'):n}</div>
          <span class="step-label ${st}">${s}</span>
          ${i<steps.length-1?`<div class="step-line ${n<UP_STEP?'done':''}"></div>`:''}
        </div>`;}).join('')}
    </div>

    ${UP_STEP===1?`<div class="card card-pad col gap-16">
      <div class="field"><label>Shablon nomi <span class="req">*</span></label><input id="upName" class="input" value="${UP_DRAFT.name||''}" placeholder="Masalan: Neon Glitch Logo Reveal"></div>
      <div class="field"><label>Tavsif <span class="req">*</span></label><textarea id="upDesc" class="textarea" placeholder="Shablon nimadan iborat, qanday foydalaniladi\u2026">${UP_DRAFT.desc||''}</textarea><span class="hint">Aniq tavsif tezroq moderatsiyadan o\u2018tishga yordam beradi.</span></div>
      <div class="row gap-16"><div class="field grow"><label>Kategoriya <span class="req">*</span></label><select id="upCat" class="select" style="height:38px;width:100%"><option value="">Tanlang\u2026</option>${CATS.map(c=>`<option ${UP_DRAFT.catLabel===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field grow"><label>Yo\u2018nalish</label><select id="upNav" class="select" style="height:38px;width:100%"><option value="video" ${UP_DRAFT.nav==='video'?'selected':''}>Video / Broadcast</option><option value="social" ${UP_DRAFT.nav==='social'?'selected':''}>Social Media</option><option value="corp" ${UP_DRAFT.nav==='corp'?'selected':''}>Korporativ</option></select></div></div>
      <div class="row gap-16"><div class="field grow"><label>Orientatsiya</label><select id="upOrient" class="select" style="height:38px;width:100%"><option>Landscape (16:9)</option><option>Portrait (9:16)</option><option>Square (1:1)</option></select></div>
      <div class="field grow"><label>Resolution</label><select id="upRes" class="select" style="height:38px;width:100%"><option>4K (3840\u00d72160)</option><option>1080p</option><option>1080\u00d71920</option></select></div></div>
      <div class="field"><label>Teglar</label><input id="upTags" class="input" value="${(UP_DRAFT.tags||[]).join(', ')}" placeholder="vergul bilan: glitch, neon, logo"></div>
    </div>`:''}

    ${UP_STEP===2?`<div class="card card-pad col gap-16">
      <div class="row gap-16">
        <div class="field grow"><label>Preview video</label>
          <input type="file" id="upPreview" accept="video/*" class="input" style="padding:8px">
          <span class="small">MP4 / MOV</span></div>
        <div class="field grow"><label>Thumbnail</label>
          <input type="file" id="upThumb" accept="image/*" class="input" style="padding:8px">
          <span class="small">JPG / PNG</span></div>
      </div>
      <div class="field"><label>Loyiha fayli (.aep / pack)</label>
        <input type="file" id="upPack" accept=".aep,.zip,application/zip" class="input" style="padding:8px">
        <span class="small">Maksimal hajm: <b>500 MB</b></span></div>
    </div>`:''}

    ${UP_STEP===3?`<div class="card card-pad col gap-16">
      <div class="row gap-16">
        <div class="thumb g1 grain" style="width:200px;aspect-ratio:16/10;border-radius:var(--r-md);flex:0 0 auto"><div class="play"><span>${ic('play')}</span></div></div>
        <div class="col gap-8 grow" style="min-width:0">
          <span class="h3">${UP_DRAFT.name||'Shablon'}</span>
          <div class="row gap-6 wrap"><span class="pill">${UP_DRAFT.catLabel||'—'}</span><span class="pill">${(UP_DRAFT.res||'4k').toUpperCase()}</span><span class="pill">${UP_DRAFT.orient==='vertical'?'Portrait':UP_DRAFT.orient==='square'?'Square':'Landscape'}</span></div>
          <p class="body" style="max-width:100%;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden">${UP_DRAFT.desc||''}</p>
          <div class="row gap-8 wrap" style="min-width:0">
            ${UP_DRAFT.files.preview?`<span class="pill trunc" title="${UP_DRAFT.files.preview.name}">${ic('film')} ${UP_DRAFT.files.preview.name}</span>`:''}
            ${UP_DRAFT.files.thumb?`<span class="pill trunc" title="${UP_DRAFT.files.thumb.name}">${ic('image')} ${UP_DRAFT.files.thumb.name}</span>`:''}
            ${UP_DRAFT.files.pack?`<span class="pill trunc" title="${UP_DRAFT.files.pack.name}">${ic('file')} ${UP_DRAFT.files.pack.name}</span>`:'<span class="small" style="color:var(--orange)">Pack (.aep) majburiy — AE import uchun</span>'}
          </div>
        </div>
      </div>
      ${infoBanner('Yuborgach holat <b>PENDING_REVIEW</b> bo\u2018ladi. Admin tasdiqlagach AE \u2192 AssetFlow Browse panelida ko\u2018rinadi.')}
      <label class="row center gap-8" style="cursor:pointer"><div class="checkbox on" onclick="this.classList.toggle('on')">${ic('check')}</div><span class="body">Platforma qoidalari va litsenziya shartlariga roziman</span></label>
    </div>`:''}

    <div class="row between center">
      <button class="btn btn-ghost" onclick="UP_STEP=Math.max(1,UP_STEP-1);renderUpload()" ${UP_STEP===1?'disabled':''}>${ic('chevL')} Orqaga</button>
      <div class="row gap-8">
        <button class="btn btn-subtle" onclick="saveDraftOnly()">Qoralama saqlash</button>
        ${UP_STEP<3?`<button class="btn btn-primary" onclick="uploadStepNext()">Davom etish ${ic('chevR')}</button>`
          :`<button class="btn btn-success" id="upSubmitBtn" onclick="submitUpload()">${ic('check')} Moderatsiyaga yuborish</button>`}
      </div>
    </div>
  </div>`;
  if (UP_STEP === 2) bindUploadFileInputs();
}
async function saveDraftOnly() {
  if (!StudioApi.token()) {
    toast("API", "Avval tizimga kiring", "warn");
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
    try {
      if (UP_DRAFT.files.thumb || UP_DRAFT.files.preview || UP_DRAFT.files.pack) {
        await StudioApi.uploadAssets(tid, UP_DRAFT.files);
      }
    } catch (e) {
      toast("Ogohlantirish", "Fayllar saqlanmadi: " + (e.message || ""), "warn");
    }
    UP_EDIT_ID = null;
    await StudioTemplates.refreshAfterUpload();
    toast("Qoralama", "Saqlendi. «Moderatsiyaga yuborish» yoki ro'yxatdan «Yuborish» bosing", "info");
    route("templates");
  } catch (e) {
    toast("Xato", e.message || "Saqlash muvaffaqiyatsiz", "danger");
  }
}

async function createUploadTemplateRecord() {
  const { cat, catLabel } = catFromLabel(UP_DRAFT.catLabel);
  const body = {
    name: UP_DRAFT.name,
    description: UP_DRAFT.desc,
    nav: UP_DRAFT.nav || "video",
    cat,
    catLabel,
    orient: UP_DRAFT.orient,
    res: UP_DRAFT.res,
    tags: UP_DRAFT.tags,
    metaJson: { grad: "g1", dur: "0:12" },
  };
  if (UP_EDIT_ID) {
    return StudioApi.patchTemplate(UP_EDIT_ID, body);
  }
  return StudioApi.createTemplate(body);
}

async function submitUpload(){
  if (!StudioApi.token()) {
    toast('API', 'Avval tizimga kiring', 'warn');
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
  if (btn) btn.disabled = true;
  try {
    const created = await createUploadTemplateRecord();
    const tid = UP_EDIT_ID || created.id;
    try {
      if (UP_DRAFT.files.thumb || UP_DRAFT.files.preview || UP_DRAFT.files.pack) {
        await StudioApi.uploadAssets(tid, UP_DRAFT.files);
      }
    } catch (e) {
      toast("Xato", "Fayllar yuklanmadi: " + (e.message || ""), "danger");
      return;
    }
    await StudioApi.submitTemplate(tid);
    await StudioTemplates.refreshAfterUpload();
    toast('Yuborildi', 'Shablon moderatsiyaga yuborildi — admin tasdiqlagach AE da chiqadi', 'success');
    if (typeof AssetFlowLog !== 'undefined') {
      AssetFlowLog.info('Shablon moderatsiyaga yuborildi', {
        action: 'upload_submit',
        detail: tid,
      });
    }
    UP_STEP = 1;
    UP_EDIT_ID = null;
    UP_DRAFT.name = '';
    UP_DRAFT.desc = '';
    UP_DRAFT.files = {};
    route('templates');
  } catch (e) {
    toast('Xato', e.message || 'Yuklash muvaffaqiyatsiz', 'danger');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ============================================================
   MESSAGES (API)
   ============================================================ */
let C_THREADS = [];
let CMSG_SEL = 0;
let C_THREAD_MESSAGES = [];

function formatMsgDate(iso) {
  if (!iso) return "—";
  return String(iso).slice(0, 16).replace("T", " ");
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
  root.innerHTML = `<div class="card card-pad empty"><p class="small">Yuklanmoqda…</p></div>`;
  try {
    C_THREADS = await loadContributorThreads();
    window._STUDIO_MSG_UNREAD = contributorUnreadCount();
    if (typeof renderNav === "function") renderNav();
    CMSG_SEL = 0;
    await renderCMsg();
  } catch (e) {
    root.innerHTML = `<div class="card card-pad empty"><h3>Xatolik</h3><p>${e.message}</p></div>`;
  }
};

async function selectContributorThread(i) {
  CMSG_SEL = i;
  await renderCMsg();
}

async function renderCMsg() {
  const root = document.getElementById("cmsgRoot");
  if (!C_THREADS.length) {
    root.innerHTML = `<div class="card card-pad empty"><div class="ico">${ic("inbox")}</div><h3>Xabar yo\u2018q</h3><p class="body">Admin moderatsiya yoki broadcast xabarlari shu yerda ko\u2018rinadi.</p></div>`;
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
    toast("Xato", e.message || "Xabarlar yuklanmadi", "danger");
  }

  const canReply = !th.isBroadcast;
  const me = typeof AssetFlowAuth !== "undefined" ? AssetFlowAuth.getSession() : null;
  const myInitials = (me?.name || "S").slice(0, 2).toUpperCase();

  root.innerHTML = `<div class="card" style="overflow:hidden"><div style="display:grid;grid-template-columns:320px 1fr;height:640px">
    <div class="col" style="border-right:1px solid var(--line)">
      <div class="card-head"><h3>Xabarlar</h3><span class="nav-badge brand">${contributorUnreadCount()}</span></div>
      <div class="col" style="overflow-y:auto">
        ${C_THREADS.map(
          (t, i) => `<div class="mod-item ${i === CMSG_SEL ? "sel" : ""}" onclick="selectContributorThread(${i})">
          <div class="kpi-ico" style="width:38px;height:38px;flex:0 0 auto;background:var(--${t.kind}-dim);color:var(--${t.kind})">${ic(t.isBroadcast ? "megaphone" : "message")}</div>
          <div class="col grow" style="gap:2px;min-width:0"><div class="row between"><span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.sub}</span><span class="sub" style="font-size:10.5px;color:var(--tx-3)">${t.t}</span></div><span class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px">${t.last}</span></div>
          ${t.unread ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--violet-bright);flex:0 0 auto"></span>' : ""}
        </div>`
        ).join("")}
      </div>
    </div>
    <div class="col">
      <div class="card-head"><div class="col" style="gap:1px"><span class="cell-strong">${th.sub}</span>${th.tid ? `<span class="small">Shablon: <a style="color:var(--violet-bright);cursor:pointer" onclick="openTplDrawer('${th.tid}')">${th.tid}</a></span>` : `<span class="small">${th.isBroadcast ? "Broadcast" : "Suhbat"}</span>`}</div>${th.tid ? `<button class="btn btn-ghost btn-sm" onclick="openTplDrawer('${th.tid}')">${ic("eye")} Shablon</button>` : ""}</div>
      <div class="col grow" style="overflow-y:auto;padding:18px;background:var(--bg-0)">
        ${C_THREAD_MESSAGES.map((m) => {
          const isMe = m.sender?.isMe;
          const nm = m.sender?.name || "User";
          const ini = nm.slice(0, 2).toUpperCase();
          return `<div class="msg ${isMe ? "me" : ""}"><div class="avatar" style="width:28px;height:28px;font-size:11px;background:linear-gradient(140deg,#7b5cff,#4a2fb0)">${isMe ? myInitials : ini}</div><div class="msg-body"><div class="msg-name" style="color:${isMe ? "var(--tx-1)" : "var(--violet-bright)"}">${isMe ? "Siz" : nm}</div><div class="msg-text">${m.body}</div><div class="msg-time">${formatMsgDate(m.createdAt)}</div></div></div>`;
        }).join("")}
      </div>
      ${
        canReply
          ? `<div class="row gap-8 center" style="padding:14px;border-top:1px solid var(--line)">
        <input id="cReplyInput" class="input" placeholder="Javob yozing\u2026" style="height:40px">
        <button class="btn btn-primary" style="height:40px" onclick="sendContributorReply()">${ic("send")} Javob</button>
      </div>`
          : `<div class="row center gap-8" style="padding:14px;border-top:1px solid var(--line);color:var(--tx-3);justify-content:center">${ic("inbox")}<span class="small">Broadcast xabarlariga javob berib bo\u2018lmaydi</span></div>`
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
    toast("Yuborildi", "Javobingiz adminга yetkazildi", "success");
  } catch (e) {
    toast("Xato", e.message || "Yuborish muvaffaqiyatsiz", "danger");
  }
}

async function saveContributorProfile() {
  const nameEl = document.getElementById("cProfileName");
  const name = nameEl?.value?.trim();
  if (!name) {
    toast("Profil", "Ism kiriting", "warn");
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
    toast("Saqlandi", "Profil yangilandi", "success");
  } catch (e) {
    toast("Xato", e.message || "Saqlash muvaffaqiyatsiz", "danger");
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
    <div class="card"><div class="card-head"><h3>Profil</h3></div>
      <div class="card-pad col gap-16">
        <div class="row center gap-14">${avatar(nm,56)}<div class="col gap-6"><span class="hint">Ism API orqali saqlanadi</span></div></div>
        <div class="row gap-16"><div class="field grow"><label>Ism</label><input id="cProfileName" class="input" value="${nm}"></div><div class="field grow"><label>Email</label><input class="input" value="${em}" readonly></div></div>
        <div class="field"><label>Bio</label><textarea class="textarea" placeholder="O\u2018zingiz haqingizda qisqacha\u2026"></textarea></div>
      </div>
    </div>
    <div class="card"><div class="card-head"><h3>Obunachilar: Free vs Pro</h3><span class="small">Admin tariflar bo\u2018yicha</span></div>
      <div class="card-pad col gap-14">
        <p class="body">Shablonlaringiz ikkala rejimda ham katalogda, lekin <b>Pro</b> obunachilar cheksiz yuklab olish va 4K import qiladi.</p>
        <table class="data" style="min-width:auto">
          <thead><tr><th></th><th>Free</th><th>Pro</th></tr></thead>
          <tbody>
            <tr><td class="cell-strong">Yuklab olish</td><td>${formatPlanLimit(planById('free'))}</td><td>${formatPlanLimit(planById('pro'))}</td></tr>
            <tr><td class="cell-strong">Narx (oylik)</td><td>Bepul</td><td>${formatProPriceForContributor()}</td></tr>
            <tr><td class="cell-strong">Resolution</td><td>${planById('free').maxResolution}</td><td>${planById('pro').maxResolution}</td></tr>
          </tbody>
        </table>
        <div class="info-banner" style="font-size:12px">${ic('plugin')}<span>Tariflarni faqat admin o\u2018zgartiradi. Savollar bo\u2018lsa <a href="#" onclick="event.preventDefault();route('messages')" style="color:var(--violet-bright)">xabarlar</a> orqali yozing.</span></div>
      </div>
    </div>
    <div class="card"><div class="card-head"><h3>To\u2018lov / aloqa (contributor)</h3><span class="badge badge-pending"><span class="dot"></span>Tez orada</span></div>
      <div class="card-pad col gap-16" style="opacity:.6;pointer-events:none">
        <div class="field"><label>Payout usuli</label><select class="select" style="height:38px;width:100%"><option>Bank kartasi</option></select></div>
        <div class="field"><label>Karta raqami</label><input class="input" placeholder="\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022"></div>
      </div>
    </div>
    <div class="card"><div class="card-head"><h3>Bildirishnomalar</h3><span class="badge badge-pending"><span class="dot"></span>Tez orada</span></div>
      <div class="card-pad"><p class="body" style="color:var(--tx-2)">Email va push bildirishnomalar ulangach shu yerda sozlanadi. Hozir moderatsiya xabarlari <b>Xabarlar</b> bo\u2018limida (API).</p></div>
    </div>
        <div class="row gap-8"><button class="btn btn-primary" onclick="saveContributorProfile()">Saqlash</button><button class="btn btn-ghost" onclick="route('settings')">Bekor</button></div>
  </div>`;
};

/* ============================================================
   TEMPLATE DETAIL DRAWER — preview, metadata, status timeline, chat thread
   ============================================================ */
function statusTimeline(t){
  // build a plausible history from status
  const base=[{t:'Yuborildi',meta:t.created+' \u00b7 PENDING_REVIEW',c:'violet',ic:'upload'}];
  if(t.status==='soft'){ base.push({t:'Soft reject',meta:'Admin \u00b7 sabab bilan',c:'orange',ic:'reply',note:t.reason}); }
  if(t.status==='hard'){ base.push({t:'Hard reject',meta:'Admin \u00b7 qat\u2018iy rad',c:'red',ic:'ban',note:t.reason}); }
  if(t.status==='approved'){ base.push({t:'Ko\u2018rib chiqildi',meta:'Admin moderatsiyasi',c:'blue',ic:'eye'}); base.push({t:'Tasdiqlandi',meta:'AE katalogiga qo\u2018shildi \u00b7 live',c:'green',ic:'check'}); }
  if(t.status==='draft'){ return [{t:'Qoralama yaratildi',meta:t.created+' \u00b7 hali yuborilmagan',c:'gray',ic:'edit'}]; }
  return base;
}
async function renderDrawerThreadSection(t) {
  if (!(t.status === "soft" || t.status === "hard")) return "";
  if (!StudioApi.token()) {
    return t.reason
      ? `<div class="divider"></div><div class="col gap-10"><span class="label">Moderatsiya izohi</span>
      <div class="info-banner warn">${ic("reply")}<span>${t.reason}</span></div></div>`
      : "";
  }
  try {
    const { items } = await StudioApi.listMessageThreads();
    const th = (items || []).find((x) => x.templateId === t.id);
    if (!th) {
      return t.reason
        ? `<div class="divider"></div><div class="col gap-10"><span class="label">Moderatsiya izohi</span>
        <div class="info-banner warn">${ic("reply")}<span>${t.reason}</span></div>
        <span class="hint">To\u2018liq suhbat uchun <a style="color:var(--violet-bright);cursor:pointer" onclick="closeDrawer();route('messages')">Xabarlar</a> bo\u2018limiga o\u2018ting.</span></div>`
        : `<div class="divider"></div><div class="info-banner">${ic("inbox")}<span>Xabarlar bo\u2018limida admin bilan yozishingiz mumkin.</span></div>`;
    }
    const detail = await StudioApi.getMessageThread(th.id);
    const msgs = detail.messages || [];
    const canReply = t.status === "soft" && !th.isBroadcast;
    return `<div class="divider"></div><div class="col gap-10"><span class="label">Admin bilan suhbat</span>
      <div class="col gap-8">${msgs
        .map((m) => {
          const isAdmin = m.sender?.role === "ADMIN";
          const who = m.sender?.name || m.sender?.email || (isAdmin ? "Admin" : "Siz");
          const when = String(m.createdAt || "").slice(0, 16).replace("T", " ");
          return `<div class="msg"><div class="avatar" style="width:28px;height:28px;font-size:11px;background:${isAdmin ? "linear-gradient(140deg,#7b5cff,#4a2fb0)" : "var(--bg-4)"}">${who.slice(0, 2).toUpperCase()}</div>
          <div class="msg-body"><div class="msg-name" style="color:var(--${isAdmin ? "violet-bright" : "tx-1"})">${who}</div><div class="msg-text">${m.body}</div><div class="msg-time">${when}</div></div></div>`;
        })
        .join("")}</div>
      ${
        canReply
          ? `<div class="row gap-8 center"><input id="drawerReplyInput" class="input" placeholder="Javob yozing\u2026" style="height:36px"><button class="btn btn-primary btn-sm" onclick="replyFromDrawer('${th.id}')">${ic("send")}</button></div>`
          : `<div class="info-banner danger" style="font-size:12px">${ic("ban")}<span>Hard reject \u2014 javob yopiq. <a style="color:var(--violet-bright);cursor:pointer" onclick="closeDrawer();route('messages')">Xabarlar</a></span></div>`
      }</div>`;
  } catch (e) {
    return t.reason
      ? `<div class="info-banner warn">${ic("reply")}<span>${t.reason}</span></div>`
      : "";
  }
}

async function replyFromDrawer(threadId) {
  const input = document.getElementById("drawerReplyInput");
  const body = (input?.value || "").trim();
  if (!body) {
    toast("Xabar", "Matn yozing", "warn");
    return;
  }
  try {
    await StudioApi.replyMessageThread(threadId, body);
    toast("Yuborildi", "Admin ga xabar yuborildi", "success");
    closeDrawer();
    route("messages");
  } catch (e) {
    toast("Xato", e.message || "Yuborilmadi", "danger");
  }
}

async function openTplDrawer(id){
  const t=TEMPLATES.find(x=>x.id===id);
  if (!t) return;
  const threadBlock = await renderDrawerThreadSection(t);
  openDrawer(`
    <div class="drawer-head"><span class="h3 grow">Shablon tafsiloti</span><button class="icon-btn" onclick="closeDrawer()">${ic('x')}</button></div>
    <div class="drawer-body col gap-18">
      ${typeof StudioMedia!=='undefined'?`<div style="border-radius:var(--r-md);overflow:hidden">${StudioMedia.renderPreview(t,{aspect:'16/9'})}</div>`:`<div class="thumb ${t.grad} grain" style="width:100%;aspect-ratio:16/9;border-radius:var(--r-md)"></div>`}
      <div class="row gap-8 wrap">${typeof StudioMedia!=='undefined'?StudioMedia.filePills(t):''}</div>
      <div class="row between center"><span class="h3">${t.name}</span>${badge(t.status)}</div>
      ${t.status==='approved'?`<div class="info-banner">${ic('ext')}<span>Bu shablon hozir <b>AE \u2192 AssetFlow Browse</b> panelida live. <b>${t.dl.toLocaleString()}</b> marta yuklab olingan.</span></div>`:''}
      <p class="body">${t.desc}</p>
      <div class="meta-grid">${[['ID',t.id],['Kategoriya',t.cat],['Resolution',t.res],['Orientatsiya',t.orient],['Fayl',t.size],['Yaratilgan',t.created]].map(([k,v])=>`<div><div class="label" style="margin-bottom:3px">${k}</div><div class="cell-strong">${v}</div></div>`).join('')}</div>
      <div class="row gap-6 wrap">${t.tags.map(x=>`<span class="pill">${ic('tag')}${x}</span>`).join('')}</div>

      <div class="divider"></div>
      <div class="col gap-12"><span class="label">Holat tarixi</span>
        <div class="timeline">${statusTimeline(t).map(s=>`<div class="tl-item"><div class="tl-dot" style="background:var(--${s.c})">${ic(s.ic)}</div><div class="tl-title">${s.t}</div><div class="tl-meta">${s.meta}</div>${s.note?`<div class="tl-note">${s.note}</div>`:''}</div>`).join('')}</div>
      </div>

      ${threadBlock}
    </div>
    <div class="drawer-foot">
      ${t.status==='soft'?`<button class="btn btn-success grow" onclick="closeDrawer();resubmit('${t.id}')">${ic('refresh')} Tuzatib qayta yuborish</button><button class="btn btn-ghost" onclick="closeDrawer();openEditTemplate('${t.id}')">${ic('edit')}</button>`:''}
      ${t.status==='draft'?`<button class="btn btn-success grow" onclick="submitDraftToModeration('${t.id}')">${ic('upload')} Moderatsiyaga yuborish</button><button class="btn btn-ghost" onclick="closeDrawer();route('upload')">${ic('edit')} Tahrirlash</button>`:''}
      ${t.status==='approved'?`<button class="btn btn-ghost grow" onclick="closeDrawer()">Yopish</button>`:''}
      ${t.status==='hard'?`<button class="btn btn-ghost grow" onclick="closeDrawer()">Yopish</button>`:''}
      ${t.status==='pending'?`<button class="btn btn-ghost grow" onclick="closeDrawer()">Yopish \u00b7 moderatsiyada</button>`:''}
    </div>`);
}
