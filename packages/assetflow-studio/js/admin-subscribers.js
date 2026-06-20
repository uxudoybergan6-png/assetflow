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

VIEWS.subscribers = function () {
  const sc = subscriberCounts();
  const rows = filteredSubscribers();
  return `<div class="col gap-16">
    ${infoBanner(`${ic("plugin")}<span><b>AE Plugin obunachilari</b> — After Effects ichidagi <b>AssetFlow Browse</b> panelidan foydalanadigan haqiqiy mijozlar. Bloklash = plugin kirishini to\u2018xtatadi. Chiqarib tashlash = hisobni tizimdan olib tashlaydi.</span>`)}

    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr)">
      ${kpiCard({ label: "Jami obunachilar", val: sc.total, ic: "plugin", c: "violet", foot: "ro\u2018yxatda" })}
      ${kpiCard({ label: "Faol (AE)", val: sc.active, ic: "checkCircle", c: "green", foot: "pluginda ishlayapti" })}
      ${kpiCard({ label: "Onlayn (yaqin)", val: sc.online, ic: "globe", c: "blue", foot: "so\u2018nggi 1 soat" })}
      ${kpiCard({ label: "Bloklangan", val: sc.blocked, ic: "ban", c: "red", foot: "kirish yopiq" })}
      ${kpiCard({ label: "Chiqarilgan", val: sc.removed, ic: "trash", c: "gray", foot: "tizimdan olib tashlangan" })}
    </div>

    <div class="toolbar between wrap gap-10">
      <div class="chips">
        ${[
          ["all", "Barchasi", sc.total],
          ["active", "Faol", sc.active],
          ["online", "Onlayn", sc.online],
          ["blocked", "Bloklangan", sc.blocked],
          ["removed", "Chiqarilgan", sc.removed],
        ]
          .map(
            ([k, l, n]) =>
              `<button class="chip ${SUB_FILTER === k ? "active" : ""}" onclick="setSubFilter('${k}')">${l}<span class="cnt">${n}</span></button>`
          )
          .join("")}
      </div>
      <div class="toolbar wrap gap-8">
        <div class="search" style="width:260px;height:34px">
          ${ic("search")}
          <input placeholder="Ism, email, qurilma\u2026" value="${esc(SUB_SEARCH)}" oninput="SUB_SEARCH=this.value;route('subscribers')">
        </div>
        <select class="select" style="height:34px" onchange="SUB_PLAN_FILTER=this.value;route('subscribers')">
          <option value="all" ${SUB_PLAN_FILTER==="all"?"selected":""}>Barcha rejalar</option>
          <option value="Free" ${SUB_PLAN_FILTER==="Free"?"selected":""}>Free</option>
          <option value="Pro" ${SUB_PLAN_FILTER==="Pro"?"selected":""}>Pro</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="toast('Eksport','Obunachilar CSV','info')">${ic("download")} CSV</button>
        <button class="btn btn-ghost btn-sm" id="aiReindexBtn" onclick="aiReindex()" title="Tasdiqlangan shablonlarga AI semantik qidiruv embeddinglarini yaratadi">${ic("refresh")} AI qayta indekslash</button>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><h3>Obunachilar ro\u2018yxati</h3><span class="small">${rows.length} ta ko\u2018rsatilmoqda · jami yuklab olish: <b>${(sc.totalDownloads / 1000).toFixed(1)}K</b></span></div>
      </div>
      <div class="table-wrap">
        <table class="data" style="min-width:1100px">
          <thead>
            <tr>
              <th>Obunachi</th>
              <th>Holat</th>
              <th>Reja</th>
              <th>AE / qurilma</th>
              <th class="th-num">Limit (oy)</th>
              <th class="th-num">Jami yuklab olish</th>
              <th class="th-num">Import</th>
              <th>Token</th>
              <th>Oxirgi faol</th>
              <th style="width:140px"></th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map((s) => {
                      const rowMuted = s.status === "removed" ? "opacity:.55" : "";
                      return `<tr style="cursor:pointer;${rowMuted}" onclick="route('subscriber-detail','${s.id}')">
                <td><div class="row center gap-10">${avatar(s.name, 32)}<div class="col" style="gap:1px"><span class="cell-strong">${esc(s.name)}</span><span class="sub" style="font-size:11px;color:var(--tx-3)">${esc(s.email)}</span></div></div></td>
                <td>${subscriberStatusBadge(s.status)}</td>
                <td>${planBadge(s.plan)}</td>
                <td class="cell-muted" style="max-width:200px"><span class="cell-strong" style="font-size:12px">AE ${esc(s.ae)}</span><br><span class="small">${esc(s.device)}</span></td>
                <td>${usageCell(s)}</td>
                <td class="cell-num cell-strong">${s.downloads.toLocaleString()}</td>
                <td class="cell-num">${s.imports}</td>
                <td>${s.tokenOk ? `<span class="badge badge-approved" style="font-size:10px"><span class="dot"></span>OK</span>` : `<span class="badge badge-blocked" style="font-size:10px"><span class="dot"></span>Yopiq</span>`}</td>
                <td class="cell-muted mono" style="white-space:nowrap">${s.lastSeen}</td>
                <td onclick="event.stopPropagation()"><div class="row-actions">
                  <button class="act" title="Xabar" onclick="openMessageSub('${s.id}')">${ic("message")}</button>
                  ${subActMenu(s)}
                  <button class="act" title="Profil" onclick="route('subscriber-detail','${s.id}')">${ic("chevR")}</button>
                </div></td>
              </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="10"><div class="empty" style="padding:28px"><div class="ico">${ic("plugin")}</div><h3>Topilmadi</h3><p>Filtr yoki qidiruvni o\u2018zgartiring.</p></div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
};

let SUB_DETAIL_ID = null;

VIEWS["subscriber-detail"] = function (id) {
  const s = sById(id) || SUBSCRIBERS[0];
  SUB_DETAIL_ID = s.id;
  const blocked = s.status === "blocked";
  const removed = s.status === "removed";

  return `<div class="col gap-16">
    <button class="btn btn-subtle btn-sm" style="align-self:flex-start" onclick="route('subscribers')">${ic("chevL")} AE obunachilari</button>

    ${
      blocked
        ? `<div class="info-banner danger">${ic("ban")}<div><b style="color:var(--tx-0)">Plugin kirishi bloklangan</b> — ${s.blockReason || "Admin tomonidan bloklandi."} <a style="color:var(--red);cursor:pointer;text-decoration:underline" onclick="unblockSub('${s.id}')">Blokdan chiqarish</a></div></div>`
        : ""
    }
    ${
      removed
        ? `<div class="info-banner" style="border-color:var(--gray-line);background:var(--gray-dim)">${ic("trash")}<div><b style="color:var(--tx-0)">Tizimdan chiqarilgan</b> — ${s.removeReason || ""} · ${s.removedAt || ""} <a style="color:var(--green);cursor:pointer;text-decoration:underline" onclick="restoreSub('${s.id}')">Qayta tiklash</a></div></div>`
        : ""
    }

    <div class="card card-pad">
      <div class="row between center wrap gap-16">
        <div class="row center gap-14">
          ${avatar(s.name, 56)}
          <div class="col gap-6">
            <div class="row center gap-10 wrap">
              <span class="h2">${esc(s.name)}</span>
              ${subscriberStatusBadge(s.status)}
              ${planBadge(s.plan)}
            </div>
            <span class="body">${esc(s.email)}</span>
            <span class="small">${esc(s.device) || "—"} · ID: <span class="mono">${s.id}</span></span>
          </div>
        </div>
        <div class="row gap-8 wrap">
          ${
            s.status === "active"
              ? `<button class="btn btn-danger-ghost btn-sm" onclick="openBlockSub('${s.id}')">${ic("ban")} Bloklash</button>
                 <button class="btn btn-danger btn-sm" onclick="openRemoveSub('${s.id}')">${ic("trash")} Chiqarib tashlash</button>`
              : ""
          }
          ${
            s.status === "blocked"
              ? `<button class="btn btn-success btn-sm" onclick="unblockSub('${s.id}')">${ic("checkCircle")} Blokdan chiqarish</button>
                 <button class="btn btn-danger btn-sm" onclick="openRemoveSub('${s.id}')">${ic("trash")} Chiqarib tashlash</button>`
              : ""
          }
          ${removed ? `<button class="btn btn-success btn-sm" onclick="restoreSub('${s.id}')">${ic("refresh")} Qayta tiklash</button>` : ""}
          ${!removed ? `<button class="btn ${normalizePlanLabel(s.plan) === "Pro" ? "btn-ghost" : "btn-primary"} btn-sm" onclick="openTogglePlanSub('${s.id}')">${ic(normalizePlanLabel(s.plan) === "Pro" ? "chevD" : "star")} ${normalizePlanLabel(s.plan) === "Pro" ? "Free" : "Pro"} qilish</button>` : ""}
          <button class="btn btn-ghost btn-sm" onclick="openMessageSub('${s.id}')">${ic("message")} Xabar</button>
          ${!removed ? `<button class="btn btn-ghost btn-sm" onclick="openAiCreditsSub('${s.id}')">⚡ AI kredit (${typeof s.aiCredits === "number" ? s.aiCredits : "—"})</button>` : ""}
        </div>
      </div>
    </div>

    ${(() => {
      const pl = planById(normalizePlanLabel(s.plan).toLowerCase());
      const effDl = s.downloadLimitOverride != null ? s.downloadLimitOverride : (pl.unlimitedDownloads ? null : pl.downloadLimit);
      const hasOverride = s.downloadLimitOverride != null || s.importLimitOverride != null;
      const overrideNote = hasOverride ? ` \xb7 <b style="color:var(--yellow)">shaxsiy limit</b>` : "";
      const limNote = effDl === null
        ? "Cheksiz yuklab olish"
        : `${s.downloadsMonth ?? 0} / ${effDl} oy yuklab olish`;
      return `<div class="info-banner" style="margin-bottom:4px">${ic("download")}<span>Reja: <b>${normalizePlanLabel(s.plan)}</b> — ${limNote}${overrideNote}. <a href="#" style="color:var(--violet-bright);text-decoration:underline" onclick="event.preventDefault();openLimitOverrideSub('${s.id}')">Limitni tahrirlash</a></span></div>`;
    })()}

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard({ label: "Bu oy yuklab olish", val: s.downloadsMonth ?? 0, ic: "download", c: "green", foot: formatPlanLimit(planById(normalizePlanLabel(s.plan).toLowerCase())) })}
      ${kpiCard({ label: "Jami yuklab olish", val: s.downloads, ic: "chart", c: "blue" })}
      ${kpiCard({ label: "AE import", val: s.imports, ic: "layers", c: "violet" })}
      ${kpiCard({ label: "Oxirgi faol", val: s.lastSeen, ic: "clock", c: "yellow", foot: s.device })}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="sub-detail-grid">
      <div class="card card-pad col gap-12">
        <span class="label">Plugin ulanishi</span>
        <div class="meta-grid">
          ${[
            ["Token", s.tokenOk ? "Faol" : "Bekor qilingan"],
            ["Qurilma", s.device],
            ["Mamlakat", s.country],
            ["Reja", s.plan],
          ]
            .map(
              ([k, v]) =>
                `<div><div class="label" style="margin-bottom:3px">${k}</div><div class="cell-strong">${esc(v)}</div></div>`
            )
            .join("")}
        </div>
        ${
          !s.tokenOk
            ? `<div class="info-banner warn" style="font-size:12px">${ic("alert")}<span>Token yaroqsiz — Browse paneli katalogni yuklamaydi.</span></div>`
            : ""
        }
      </div>
      <div class="card card-pad col gap-12">
        <span class="label">So\u2018nggi faoliyat</span>
        <div class="empty" style="padding:20px">
          <p class="small">Plugin harakatlari: oxirgi ko\u2018rinish <b>${esc(s.lastSeen) || "—"}</b>${s.device ? ` · ${esc(s.device)}` : ""}${s.ae ? ` · AE ${esc(s.ae)}` : ""}</p>
          <p class="small mt-8" style="color:var(--tx-3)">Batafsil event log keyingi versiyada qo\u2018shiladi.</p>
        </div>
      </div>
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
  return `<details class="act-menu"><summary class="act" title="Amallar">${ic("more")}</summary><div class="act-drop">${planItem}${blockUnblock}${removeRestore}</div></details>`;
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
      <div class="field"><label>Mavzu</label><input class="input" value="AssetFlow Browse — xabar"></div>
      <div class="field"><label>Xabar</label><textarea class="textarea" placeholder="Obunachiga email yoki in-app xabar\u2026"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-primary" onclick="closeModal();notifyMessageSent('${id}')">${ic("send")} Yuborish</button></div>`);
}

function notifyMessageSent(id) {
  const s = sById(id);
  toast("Yuborildi", `Xabar ${s ? s.name : "obunachi"} ga yuborildi`, "success");
}
