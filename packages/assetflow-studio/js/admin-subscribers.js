/* ============================================================
   AssetFlow — AE Plugin obunachilari (subscribers)
   ============================================================ */
let SUB_FILTER = "all";
let SUB_SEARCH = "";
let SUB_PLAN_FILTER = "all";

/** AI semantik qidiruv — tasdiqlangan shablonlarga embedding backfill (admin). */
async function aiReindex() {
  const btn = document.getElementById("aiReindexBtn");
  if (btn) btn.disabled = true;
  toast("AI", "Indekslanmoqda…", "info");
  try {
    const r = await StudioApi.reindexAi(false);
    const done = r && typeof r.done === "number" ? r.done : 0;
    const failed = (r && r.failed) || 0;
    toast(
      "Tayyor",
      `${done} shablon indekslandi${failed ? ` (${failed} xato)` : ""}`,
      "success"
    );
  } catch (e) {
    const msg =
      e && e.status === 503
        ? "AI sozlanmagan (CF kaliti kerak)"
        : e && e.status === 403
          ? "Faqat admin"
          : (e && e.message) || "Xato";
    toast("Xato", msg, "danger");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function refreshSubscribersFromApi() {
  if (typeof StudioApi === "undefined" || !StudioApi.listPluginSubscribers) return false;
  try {
    const data = await StudioApi.listPluginSubscribers();
    SUBSCRIBERS.length = 0;
    (data.items || []).forEach((s) => SUBSCRIBERS.push({ ...s }));
    window._ASSETFLOW_SUBSCRIBER_STATS = data.stats || null;
    return true;
  } catch (e) {
    console.warn("plugin-subscribers", e);
    return false;
  }
}

function subscriberStatusBadge(status) {
  if (status === "active")
    return `<span class="badge badge-active"><span class="dot"></span>Faol</span>`;
  if (status === "blocked")
    return `<span class="badge badge-blocked"><span class="dot"></span>Bloklangan</span>`;
  return `<span class="badge badge-removed"><span class="dot"></span>Chiqarilgan</span>`;
}

function planBadge(plan) {
  const label = normalizePlanLabel(plan);
  const isPro = label === "Pro";
  return `<span class="badge badge-plan ${isPro ? "pro" : "free"}">${label}</span>`;
}

function usageCell(s) {
  const label = normalizePlanLabel(s.plan);
  const p = planById(label.toLowerCase());
  if (p.unlimitedDownloads) {
    return `<span class="small" style="color:var(--green)">Cheksiz</span><br><span class="cell-muted mono">${s.downloadsMonth ?? 0} bu oy</span>`;
  }
  const used = s.downloadsMonth ?? 0;
  const lim = p.downloadLimit || 0;
  const pct = subscriberUsagePct(s) ?? 0;
  const over = used >= lim;
  return `<div class="col gap-4" style="min-width:88px">
    <span class="cell-strong" ${over ? 'style="color:var(--red)"' : ""}>${used} / ${lim}</span>
    <div class="progress" style="height:5px"><span style="width:${pct}%;background:${over ? "var(--red)" : "var(--violet)"}"></span></div>
  </div>`;
}

function filteredSubscribers() {
  let list = SUBSCRIBERS.slice();
  if (SUB_FILTER === "active") list = list.filter((s) => s.status === "active");
  else if (SUB_FILTER === "blocked") list = list.filter((s) => s.status === "blocked");
  else if (SUB_FILTER === "removed") list = list.filter((s) => s.status === "removed");
  else if (SUB_FILTER === "online")
    list = list.filter(
      (s) => s.status === "active" && /daq|Bugun|minut/i.test(s.lastSeen)
    );
  if (SUB_PLAN_FILTER !== "all") {
    list = list.filter((s) => normalizePlanLabel(s.plan) === SUB_PLAN_FILTER);
  }
  const q = SUB_SEARCH.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.device && s.device.toLowerCase().includes(q))
    );
  }
  return list;
}

function setSubFilter(f) {
  SUB_FILTER = f;
  if (CURRENT === "subscribers") route("subscribers");
  else if (CURRENT === "subscriber-detail") route("subscriber-detail", SUB_DETAIL_ID);
}

/** Obunachi limit foydalanish katakchasi (maket e5 — adx-prog). */
function axUsageCell(s){
  const label = normalizePlanLabel(s.plan);
  const p = planById(label.toLowerCase());
  if(p.unlimitedDownloads){
    return `<span style="font-size:11px;color:#C2F04A">Cheksiz</span><div class="adx-num" style="font-size:9.5px;color:#8A93A3;margin-top:3px">${s.downloadsMonth ?? 0} bu oy</div>`;
  }
  const used = s.downloadsMonth ?? 0;
  const lim = p.downloadLimit || 0;
  const pct = subscriberUsagePct(s) ?? 0;
  const cls = pct>=100 ? 'dan' : pct>=80 ? 'warn' : '';
  return `<div style="min-width:110px"><div class="adx-prog"><div class="pb ${cls}" style="width:${Math.min(100,pct)}%"></div></div><div class="adx-num" style="font-size:9.5px;color:#8A93A3;margin-top:4px">${used} / ${lim}</div></div>`;
}

/** Obunachilar topbar amallari (reja filtri + AI reindex + CSV). */
function axSubTopbar(){
  const tba = document.getElementById('tbActions');
  if(!tba || (typeof CURRENT!=='undefined' && CURRENT!=='subscribers')) return;
  tba.innerHTML =
    `<label class="adx-sel"><i class="ph ph-funnel" style="font-size:13px"></i><span>${SUB_PLAN_FILTER==='all'?'Barcha rejalar':SUB_PLAN_FILTER}</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i><select onchange="SUB_PLAN_FILTER=this.value;route('subscribers')"><option value="all">Barcha rejalar</option><option value="Free" ${SUB_PLAN_FILTER==='Free'?'selected':''}>Free</option><option value="Pro" ${SUB_PLAN_FILTER==='Pro'?'selected':''}>Pro</option></select></label>`+
    `<button class="adx-btn2 sm" id="aiReindexBtn" onclick="aiReindex()" title="Tasdiqlangan shablonlarga AI semantik qidiruv embeddinglarini yaratadi"><i class="ph ph-arrow-clockwise"></i>AI qayta indekslash</button>`+
    `<button class="adx-btn2 sm" onclick="toast('Eksport','Obunachilar CSV tayyorlanmoqda…','info')"><i class="ph ph-export"></i>CSV</button>`;
}

VIEWS.subscribers = function () {
  const sc = subscriberCounts();
  const rows = filteredSubscribers();
  return `
    ${axInfo(`<b style="color:var(--text)">AE Plugin obunachilari</b> — After Effects ichidagi <b style="color:var(--text)">FrameFlow Browse</b> panelidan foydalanadigan haqiqiy mijozlar. Bloklash = plugin kirishini to‘xtatadi. Chiqarib tashlash = hisobni tizimdan olib tashlaydi.`,'info')}
    <div class="adx-grid5" style="margin-bottom:16px">
      ${axStat({label:'Jami obunachilar',val:sc.total,ic:'users',foot:'ro‘yxatda'})}
      ${axStat({label:'Faol (AE)',val:sc.active,ic:'check-circle',icColor:'#C2F04A',foot:'pluginda ishlayapti'})}
      ${axStat({label:'Onlayn (yaqin)',val:sc.online,ic:'gauge',icColor:'#7CC4FF',foot:'so‘nggi 1 soat'})}
      ${axStat({label:'Bloklangan',val:sc.blocked,ic:'prohibit',icColor:'#FF6B5E',foot:'kirish yopiq'})}
      ${axStat({label:'Chiqarilgan',val:sc.removed,ic:'trash',foot:'olib tashlangan'})}
    </div>
    <div class="adx-tagrow">
      ${[['all','Barchasi',sc.total],['active','Faol',sc.active],['online','Onlayn',sc.online],['blocked','Bloklangan',sc.blocked],['removed','Chiqarilgan',sc.removed]]
        .map(([k,l,n])=>`<button class="adx-tag ${SUB_FILTER===k?'on':''}" onclick="setSubFilter('${k}')">${l} <span class="n">${n}</span></button>`).join('')}
    </div>
    <div class="adx-card" style="overflow:hidden">
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:1180px">
        <thead><tr><th>Obunachi</th><th>Holat</th><th>Reja</th><th>AE / qurilma</th><th>Limit (oy)</th><th class="r">Yuklab olish</th><th class="r">Import</th><th>Token</th><th>Oxirgi faol</th><th class="r">Amal</th></tr></thead>
        <tbody>
        ${rows.length ? rows.map(s=>{
          const rowMuted = s.status==='removed' ? 'opacity:.55' : '';
          return `<tr style="cursor:pointer;${rowMuted}" onclick="route('subscriber-detail','${s.id}')">
            <td><div class="adx-who">${axAv(s.name,s.email,32)}<div style="min-width:0"><div class="nm">${esc(s.name)}</div><div class="em">${esc(s.email)}</div></div></div></td>
            <td>${axStatus(s.status)}</td>
            <td>${axPlan(s.plan)}</td>
            <td style="font-size:11px"><div style="color:var(--text)">AE ${esc(s.ae||'—')}</div><div style="color:#8A93A3">${esc(s.device||'—')}</div></td>
            <td>${axUsageCell(s)}</td>
            <td class="r adx-num">${(s.downloads||0).toLocaleString()}</td>
            <td class="r adx-num">${s.imports||0}</td>
            <td>${s.tokenOk?'<span class="adx-bdg adx-bdg-approved">OK</span>':'<span class="adx-bdg adx-bdg-blocked">Yopiq</span>'}</td>
            <td class="adx-num" style="font-size:11px;color:#8A93A3;white-space:nowrap">${esc(s.lastSeen||'—')}</td>
            <td class="r" onclick="event.stopPropagation()"><div style="display:flex;gap:6px;justify-content:flex-end;align-items:center">
              <button class="adx-iact" title="Xabar" onclick="openMessageSub('${s.id}')"><i class="ph ph-chat-circle"></i></button>
              ${subActMenu(s)}
              <button class="adx-iact" title="Profil" onclick="route('subscriber-detail','${s.id}')"><i class="ph ph-caret-right"></i></button>
            </div></td>
          </tr>`;
        }).join('') : `<tr><td colspan="10"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-puzzle-piece"></i></span><div style="font-weight:600;font-size:13px">Obunachi topilmadi</div><div style="font-size:11px;color:var(--muted2)">Filtr yoki qidiruvni o‘zgartiring.</div></div></td></tr>`}
        </tbody>
      </table></div>
    </div>`;
};
let SUB_DETAIL_ID = null;

VIEWS["subscriber-detail"] = function (id) {
  const s = sById(id) || SUBSCRIBERS[0];
  if(!s) return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-puzzle-piece"></i></span><div style="font-weight:600;font-size:13px">Obunachi topilmadi</div></div>`;
  SUB_DETAIL_ID = s.id;
  const blocked = s.status === "blocked";
  const removed = s.status === "removed";
  const isPro = normalizePlanLabel(s.plan) === "Pro";
  const pl = planById(normalizePlanLabel(s.plan).toLowerCase());
  const effDl = s.downloadLimitOverride != null ? s.downloadLimitOverride : (pl.unlimitedDownloads ? null : pl.downloadLimit);
  const hasOverride = s.downloadLimitOverride != null || s.importLimitOverride != null;
  const limNote = effDl === null ? "cheksiz yuklab olish · import cheksiz" : `${effDl} yuklab olish / oy`;
  return `
    <button class="adx-btn2 sm" style="margin-bottom:16px" onclick="route('subscribers')"><i class="ph ph-caret-left"></i>AE obunachilari</button>
    ${blocked?axInfo(`<b style="color:var(--text)">Plugin kirishi bloklangan</b> — ${esc(s.blockReason||"Admin tomonidan bloklandi.")} <a style="color:#FF6B5E;text-decoration:underline;cursor:pointer" onclick="unblockSub('${s.id}')">Blokdan chiqarish</a>`,'red'):''}
    ${removed?axInfo(`<b style="color:var(--text)">Tizimdan chiqarilgan</b> — ${esc(s.removeReason||"")} ${esc(s.removedAt||"")} <a style="color:#C2F04A;text-decoration:underline;cursor:pointer" onclick="restoreSub('${s.id}')">Qayta tiklash</a>`,'amber'):''}
    <div class="adx-card" style="padding:18px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      ${axAv(s.name,s.email,56)}
      <div style="flex:1;min-width:220px"><div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap"><span class="adx-h18">${esc(s.name)}</span>${axStatus(s.status)}${axPlan(s.plan)}</div>
        <div style="font-size:11.5px;color:#8A93A3;margin-top:3px">${esc(s.email)}${s.device?' · '+esc(s.device):''} · ID: <span class="adx-num">${esc(shortId(s.id))}</span></div></div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;max-width:380px">
        ${!removed?`<button class="adx-btn2 sm" onclick="openTogglePlanSub('${s.id}')"><i class="ph ph-${isPro?'arrow-u-up-left':'crown'}"></i>${isPro?'Free qilish':'Pro qilish'}</button>`:''}
        ${!removed?`<button class="adx-btn2 sm" onclick="openAiCreditsSub('${s.id}')"><i class="ph ph-coins"></i>AI kredit (${typeof s.aiCredits==='number'?s.aiCredits:'—'})</button>`:''}
        <button class="adx-btn2 sm" onclick="openMessageSub('${s.id}')"><i class="ph ph-chat-circle"></i>Xabar</button>
        ${s.status==='active'?`<button class="adx-btn-danger adx-btn-dghost sm" onclick="openBlockSub('${s.id}')">Bloklash</button>`:''}
        ${blocked?`<button class="adx-btn2 sm adx-btn-ok" onclick="unblockSub('${s.id}')"><i class="ph ph-check-circle"></i>Blokdan chiqarish</button>`:''}
        ${!removed?`<button class="adx-btn-danger sm" onclick="openRemoveSub('${s.id}')">Chiqarish</button>`:`<button class="adx-btn2 sm adx-btn-ok" onclick="restoreSub('${s.id}')"><i class="ph ph-arrow-clockwise"></i>Qayta tiklash</button>`}
      </div>
    </div>
    ${!removed?`<div style="display:flex;align-items:center;gap:9px;padding:10px 13px;background:var(--limedim);border:1px solid rgba(194,240,74,.22);border-radius:11px;margin-top:14px"><i class="ph ph-crown" style="color:#C2F04A;font-size:15px"></i><span style="font-size:11.5px;color:#B7C0CE">Reja: <b style="color:var(--text)">${normalizePlanLabel(s.plan)}</b> — ${limNote}${hasOverride?' · <b style="color:#FFB27C">shaxsiy limit</b>':''}.</span><span style="flex:1"></span><span class="adx-num" style="font-size:10.5px;color:#C2F04A;cursor:pointer" onclick="openLimitOverrideSub('${s.id}')">Limitni tahrirlash</span></div>`:''}
    <div class="adx-grid4" style="margin-top:14px">
      ${axStat({label:'Bu oy yuklab olish',val:s.downloadsMonth ?? 0,ic:'download-simple',foot:effDl===null?'cheksiz':effDl+' limit'})}
      ${axStat({label:'Jami yuklab olish',val:(s.downloads||0).toLocaleString(),ic:'download-simple',icColor:'#C2F04A'})}
      ${axStat({label:'AE import',val:(s.imports||0).toLocaleString(),ic:'export',icColor:'#7CC4FF'})}
      ${axStat({label:'Oxirgi faol',val:`<span style="font-size:18px">${esc(s.lastSeen||'—')}</span>`,ic:'clock-countdown',foot:s.device||''})}
    </div>
    <div class="adx-grid2" style="margin-top:14px">
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Plugin ulanishi</span></div><div style="padding:6px 4px">
        <div style="display:flex;justify-content:space-between;padding:9px 14px;font-size:12px"><span style="color:#8A93A3">Token</span>${s.tokenOk?'<span class="adx-bdg adx-bdg-approved">Faol</span>':'<span class="adx-bdg adx-bdg-blocked">Bekor</span>'}</div>
        <div style="display:flex;justify-content:space-between;padding:9px 14px;font-size:12px;border-top:1px solid var(--hair)"><span style="color:#8A93A3">Qurilma</span><span style="color:var(--text)">${esc(s.device||'—')}${s.ae?' · AE '+esc(s.ae):''}</span></div>
        <div style="display:flex;justify-content:space-between;padding:9px 14px;font-size:12px;border-top:1px solid var(--hair)"><span style="color:#8A93A3">Mamlakat</span><span style="color:var(--text)">${esc(s.country||'—')}</span></div>
        <div style="display:flex;justify-content:space-between;padding:9px 14px;font-size:12px;border-top:1px solid var(--hair)"><span style="color:#8A93A3">Reja</span>${axPlan(s.plan)}</div>
      </div></div>
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">So‘nggi faoliyat</span></div>
        <div class="adx-empty" style="border:0;padding:22px"><span class="ei"><i class="ph ph-clock-countdown"></i></span><div style="font-size:11.5px;color:#B7C0CE;line-height:1.5">Oxirgi ko‘rinish <b style="color:var(--text)">${esc(s.lastSeen||'—')}</b>${s.device?' · '+esc(s.device):''}${s.ae?' · AE '+esc(s.ae):''}</div><div style="font-size:10.5px;color:var(--muted2)">Batafsil event log — Faoliyat jurnali bo‘limida.</div></div>
      </div>
    </div>`;
};
function subActMenu(s) {
  const isPro = normalizePlanLabel(s.plan) === "Pro";
  const isRemoved = s.status === "removed";
  const isBlocked = s.status === "blocked";
  const isActive = s.status === "active";
  const cl = "this.closest('details').open=false;";
  const planItem = !isRemoved
    ? `<button class="act-item${isPro ? "" : " success"}" onclick="${cl}openTogglePlanSub('${s.id}')">${ic(isPro ? "chevD" : "star")} ${isPro ? "Free qilish" : "Pro qilish"}</button><div class="act-sep"></div>`
    : "";
  const blockUnblock = isActive
    ? `<button class="act-item danger" onclick="${cl}openBlockSub('${s.id}')">${ic("ban")} Bloklash</button>`
    : isBlocked
    ? `<button class="act-item success" onclick="${cl}unblockSub('${s.id}')">${ic("checkCircle")} Blokdan chiqarish</button>`
    : "";
  const removeRestore = isRemoved
    ? `<button class="act-item success" onclick="${cl}restoreSub('${s.id}')">${ic("refresh")} Qayta tiklash</button>`
    : `<button class="act-item danger" onclick="${cl}openRemoveSub('${s.id}')">${ic("trash")} Chiqarish</button>`;
  return `<details class="act-menu"><summary class="adx-iact" title="Amallar" style="list-style:none">${ic("more")}</summary><div class="act-drop">${planItem}${blockUnblock}${removeRestore}</div></details>`;
}

function openTogglePlanSub(id) {
  const s = sById(id);
  const isPro = normalizePlanLabel(s.plan) === "Pro";
  const newPlan = isPro ? "free" : "pro";
  const label = isPro ? "Free" : "Pro";
  openModal(`
    <div class="modal-head">
      <div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">${ic(isPro ? "chevD" : "star")}</div>
      <div><h3>${label} rejasiga o'tkazish</h3><p>${esc(s.name)} \xb7 ${esc(s.email)}</p></div>
    </div>
    <div class="modal-body">
      <div class="info-banner">${ic("alert")}<span>${isPro
        ? `<b>${esc(s.name)}</b> Free rejaga o'tkaziladi — oylik limit qayta yoqiladi.`
        : `<b>${esc(s.name)}</b> Pro rejaga o'tkaziladi — cheksiz yuklab olish imkoni beriladi.`
      }</span></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-primary" onclick="doTogglePlanSub('${id}','${newPlan}')">${ic(isPro ? "chevD" : "star")} ${label} qilish</button>
    </div>`);
}

async function doTogglePlanSub(id, plan) {
  const s = sById(id);
  try {
    await patchSubOnServer(id, { plan });
    closeModal();
    toast("Yangilandi", `${s.name} ${plan === "pro" ? "Pro" : "Free"} rejaga o'tkazildi`, plan === "pro" ? "success" : "info");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Xato", e.message || "API", "danger");
  }
}

function openLimitOverrideSub(id) {
  const s = sById(id);
  const pl = planById(normalizePlanLabel(s.plan).toLowerCase());
  const defaultDl = pl.unlimitedDownloads ? "cheksiz" : pl.downloadLimit;
  const defaultImp = pl.unlimitedImports ? "cheksiz" : pl.importLimit;
  openModal(`
    <div class="modal-head">
      <div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">${ic("sliders")}</div>
      <div><h3>Shaxsiy limitni tahrirlash</h3><p>${esc(s.name)}</p></div>
    </div>
    <div class="modal-body col gap-12">
      <div class="info-banner">${ic("alert")}<span>Reja default: yuklab olish <b>${defaultDl}</b>, import <b>${defaultImp}</b>. Bo'sh qoldiring — reja defaultiga qaytadi.</span></div>
      <div class="field"><label>Yuklab olish limiti (oy, dona)</label>
        <input class="input" id="subDlLimit" type="number" min="0" value="${s.downloadLimitOverride != null ? s.downloadLimitOverride : ""}" placeholder="Bo'sh = reja default (${defaultDl})">
      </div>
      <div class="field"><label>Import limiti (jami, dona)</label>
        <input class="input" id="subImpLimit" type="number" min="0" value="${s.importLimitOverride != null ? s.importLimitOverride : ""}" placeholder="Bo'sh = reja default (${defaultImp})">
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-ghost btn-sm" onclick="doLimitOverrideSub('${id}',true)" style="color:var(--tx-2)">Defaultga qaytarish</button>
      <button class="btn btn-primary" onclick="doLimitOverrideSub('${id}')">Saqlash</button>
    </div>`);
}

async function doLimitOverrideSub(id, reset) {
  const dlRaw = reset ? null : document.getElementById("subDlLimit")?.value.trim();
  const impRaw = reset ? null : document.getElementById("subImpLimit")?.value.trim();
  const body = {
    downloadLimitOverride: dlRaw != null && dlRaw !== "" ? parseInt(dlRaw, 10) : null,
    importLimitOverride: impRaw != null && impRaw !== "" ? parseInt(impRaw, 10) : null,
  };
  try {
    await patchSubOnServer(id, body);
    closeModal();
    toast("Saqlandi", reset ? "Limitlar reja defaultiga qaytarildi" : "Shaxsiy limit yangilandi", "success");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Xato", e.message || "API", "danger");
  }
}

/** AI kredit berish/reset (admin) — PATCH /plugin-subscribers/:id { aiCredits }. */
function openAiCreditsSub(id) {
  const s = sById(id);
  if (!s) return;
  const cur = typeof s.aiCredits === "number" ? s.aiCredits : 0;
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">⚡</div>
      <div><h3>AI kredit</h3><p>${esc(s.name)} — joriy: <b>${cur}</b> kredit</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner">${ic("alert")}<span>AI generatsiya (rasm/video/ovoz) shu kreditdan sarflanadi. ADMIN rol cheksiz.</span></div>
      <div class="field"><label>Yangi qiymat</label><input class="input" id="subAiCredits" type="number" min="0" value="${cur}"></div>
      <div class="row gap-8">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('subAiCredits').value=50">Free (50)</button>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('subAiCredits').value=1000">Pro (1000)</button>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-primary" onclick="doAiCreditsSub('${id}')">Saqlash</button></div>`);
}

async function doAiCreditsSub(id) {
  const raw = document.getElementById("subAiCredits")?.value.trim();
  const n = raw != null && raw !== "" ? parseInt(raw, 10) : NaN;
  if (isNaN(n) || n < 0) {
    toast("Xato", "Musbat son kiriting", "danger");
    return;
  }
  try {
    await patchSubOnServer(id, { aiCredits: n });
    closeModal();
    toast("Saqlandi", `AI kredit ${n} ga o'rnatildi`, "success");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Xato", e.message || "API", "danger");
  }
}

function openBlockSub(id) {
  const s = sById(id);
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--red-dim);color:var(--red)">${ic("ban")}</div>
      <div><h3>Obunachini bloklash</h3><p>${esc(s.name)} — AE Browse paneliga kira olmaydi.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner danger">${ic("alert")}<span>Token bekor qilinadi. Mavjud lokal fayllar o\u2018chirilmaydi, lekin yangi katalog sync bo\u2018lmaydi.</span></div>
      <div class="field"><label>Bloklash sababi <span class="req">*</span></label><textarea class="textarea" id="subBlockReason" placeholder="Masalan: token ulashish, to\u2018lov kechikishi\u2026"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-danger" onclick="doBlockSub('${id}')">${ic("ban")} Bloklash</button></div>`);
}

async function patchSubOnServer(id, body) {
  if (typeof StudioApi !== "undefined" && StudioApi.patchPluginSubscriber) {
    const data = await StudioApi.patchPluginSubscriber(id, body);
    const idx = SUBSCRIBERS.findIndex((x) => x.id === id);
    if (idx >= 0 && data.item) SUBSCRIBERS[idx] = { ...data.item };
    await refreshSubscribersFromApi();
    return data.item;
  }
  return null;
}

async function doBlockSub(id) {
  const s = sById(id);
  const reason =
    document.getElementById("subBlockReason")?.value.trim() ||
    "Admin tomonidan bloklandi";
  try {
    await patchSubOnServer(id, { status: "blocked" });
    s.status = "blocked";
    s.tokenOk = false;
    s.blockReason = reason;
    closeModal();
    toast("Bloklandi", `${s.name} AE plugindan bloklandi`, "danger");
    if (typeof AssetFlowLog !== "undefined")
      AssetFlowLog.warn("Obunachi bloklandi", { action: "sub_block", detail: s.email });
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Xato", e.message || "API", "danger");
  }
}

async function unblockSub(id) {
  const s = sById(id);
  try {
    await patchSubOnServer(id, { status: "active" });
    s.status = "active";
    s.tokenOk = true;
    delete s.blockReason;
    toast("Faollashtirildi", `${s.name} qayta Browse panelidan foydalanishi mumkin`, "success");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Xato", e.message || "API", "danger");
  }
}

function openRemoveSub(id) {
  const s = sById(id);
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--red-dim);color:var(--red)">${ic("trash")}</div>
      <div><h3>Chiqarib tashlash</h3><p>${esc(s.name)} tizimdan butunlay olib tashlanadi.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner danger">${ic("alert")}<span><b>Destructive.</b> Obunachi ro\u2018yxatdan chiqadi, token o\u2018chiriladi. Keyinroq <b>Qayta tiklash</b> orqali faollashtirish mumkin.</span></div>
      <div class="field"><label>Sabab <span class="req">*</span></label><textarea class="textarea" id="subRemoveReason" placeholder="Audit log uchun sabab\u2026"></textarea></div>
      <label class="row center gap-8" style="cursor:pointer;font-size:13px"><div class="checkbox on" id="subRemoveConfirm" onclick="this.classList.toggle('on')">${ic("check")}</div>Chiqarishni tasdiqlayman</label>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-danger" onclick="doRemoveSub('${id}')">${ic("trash")} Chiqarib tashlash</button></div>`);
}

async function doRemoveSub(id) {
  const chk = document.getElementById("subRemoveConfirm");
  if (!chk?.classList.contains("on")) {
    toast("Tasdiq", "Chiqarishni tasdiqlang", "warn");
    return;
  }
  const s = sById(id);
  const reason =
    document.getElementById("subRemoveReason")?.value.trim() ||
    "Admin tomonidan chiqarib tashlandi";
  try {
    await patchSubOnServer(id, { status: "removed" });
    s.status = "removed";
    s.tokenOk = false;
    s.device = "—";
    s.removeReason = reason;
    s.removedAt = new Date().toISOString().slice(0, 10);
    closeModal();
    toast("Chiqarildi", `${s.name} obunachilar ro\u2018yxatidan olib tashlandi`, "danger");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Xato", e.message || "API", "danger");
  }
}

async function restoreSub(id) {
  const s = sById(id);
  try {
    await patchSubOnServer(id, { status: "active" });
    s.status = "active";
    s.tokenOk = true;
    s.device = s.device === "—" ? "Qayta tiklangan · AE" : s.device;
    delete s.removeReason;
    delete s.removedAt;
    delete s.blockReason;
    toast("Tiklandi", `${s.name} qayta faol obunachi`, "success");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Xato", e.message || "API", "danger");
  }
}

window.afterRender = window.afterRender || {};
// MUHIM: bu yerda route() ni QAYTA chaqirmaymiz — route() afterRender'ni
// qayta ishga tushiradi va cheksiz sikl (auto kirib-chiqish) hosil bo'ladi.
// Faqat ko'rinish tanasini yangi ma'lumot bilan qayta chizamiz.
window.afterRender.subscribers = async function () {
  axSubTopbar();
  const ok = await refreshSubscribersFromApi();
  if (ok && CURRENT === "subscribers") {
    const host = document.getElementById("view");
    if (host) host.innerHTML = VIEWS.subscribers();
  }
};
window.afterRender["subscriber-detail"] = async function (id) {
  if (id) SUB_DETAIL_ID = id;
  await refreshSubscribersFromApi();
  if (CURRENT === "subscriber-detail") {
    const host = document.getElementById("view");
    if (host) host.innerHTML = VIEWS["subscriber-detail"](SUB_DETAIL_ID || id);
  }
};

function openMessageSub(id) {
  const s = sById(id);
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">${ic("message")}</div>
      <div><h3>Obunachiga xabar</h3><p>${esc(s.name)} · ${esc(s.email)}</p></div></div>
    <div class="modal-body col gap-12">
      <div class="field"><label>Mavzu</label><input class="input" value="FrameFlow Browse — xabar"></div>
      <div class="field"><label>Xabar</label><textarea class="textarea" placeholder="Obunachiga email yoki in-app xabar\u2026"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-primary" onclick="closeModal();notifyMessageSent('${id}')">${ic("send")} Yuborish</button></div>`);
}

function notifyMessageSent(id) {
  const s = sById(id);
  toast("Yuborildi", `Xabar ${s ? s.name : "obunachi"} ga yuborildi`, "success");
}
