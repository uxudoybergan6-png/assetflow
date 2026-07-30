/* ============================================================
   AssetFlow — Plugin plans (Free / Pro)
   ============================================================ */

function axFlab(t){ return `<div class="adx-flab">${t}</div>`; }

/* FAZA 2 #13 — limitlar endi SERVER (PlanConfig DB)da. Bu modul serverdan
   o'qiydi va saqlashda PUT qiladi; localStorage faqat feature-matn kabi
   display-only qismlar uchun qoladi. */
let PLAN_CFG_LOADED = false;
async function syncPlanConfigFromServer() {
  if (PLAN_CFG_LOADED || typeof StudioApi === "undefined") return;
  try {
    const d = await StudioApi.request("/api/admin/plan-config");
    (d.items || []).forEach((r) => {
      // Audit §C — ANIQ moslik: planById fallback'i noma'lum planlarni (STUDIO) FREE
      // kartasiga yozib yuborardi (Free limitlari Studio qiymatlari bilan buzilardi).
      const key = String(r.plan || "").toLowerCase();
      const p = PLUGIN_PLANS.find((x) => x.id === key);
      if (!p) return;
      if (typeof r.active === "boolean") p.active = r.active;
      p.aiMonthlyCredits = r.aiMonthlyCredits;
      p.downloadLimit = r.downloadLimit;
      p.importLimit = r.importLimit;
      p.unlimitedDownloads = r.downloadLimit == null;
      if (r.maxResolution) p.maxResolution = r.maxResolution;
      if (r.priceMonthlyCents != null) p.priceMonthly = r.priceMonthlyCents / 100;
      if (r.priceYearlyCents != null) p.priceYearly = r.priceYearlyCents / 100;
      p.lsVariantMonthly = r.lsVariantMonthly || "";
      p.lsVariantYearly = r.lsVariantYearly || "";
    });
    PLAN_CFG_LOADED = true;
    savePluginPlans();
    if (CURRENT === "plans") route("plans");
  } catch (e) {
    console.warn("plan-config load", e);
  }
}

async function pushPlanConfigToServer() {
  if (typeof StudioApi === "undefined") throw new Error("API is unavailable");
  // Audit §C — STUDIO ham push qilinadi + Active toggle endi serverda saqlanadi
  for (const id of ["free", "pro", "studio"]) {
    const p = PLUGIN_PLANS.find((x) => x.id === id);
    if (!p) continue;
    await StudioApi.request("/api/admin/plan-config/" + id.toUpperCase(), {
      method: "PUT",
      body: {
        label: p.name,
        active: p.active !== false,
        aiMonthlyCredits: Math.max(0, Number(p.aiMonthlyCredits) || 0),
        downloadLimit: p.unlimitedDownloads ? null : (p.downloadLimit ?? null),
        importLimit: p.unlimitedDownloads ? null : (p.importLimit ?? null),
        maxResolution: p.maxResolution || "1080p",
        priceMonthlyCents: Math.round((Number(p.priceMonthly) || 0) * 100),
        priceYearlyCents: Math.round((Number(p.priceYearly) || 0) * 100),
        lsVariantMonthly: p.lsVariantMonthly || null,
        lsVariantYearly: p.lsVariantYearly || null,
      },
    });
  }
}

/** #92 (A4) — Tahrirlanadigan promo formasi OLIB TASHLANDI. U faqat brauzer
 *  localStorage'iga yozilardi: promo kodi, muddati va max-uses hech qachon
 *  serverga ham, to'lov provayderiga ham yetib bormasdi, ya'ni obunachi hech
 *  qachon chegirma ko'rmasdi. Chegirma haqiqiy manbai — Lemon Squeezy. */
function renderDiscountSection() {
  return `<div class="adx-card" style="padding:18px 20px;margin-top:16px">
    <div class="adx-h16" style="font-size:14px;margin-bottom:6px">Discounts and promo codes</div>
    <div style="font-size:11.5px;color:#8A93A3;line-height:1.6">
      Discount codes are created in <b>Lemon Squeezy</b> (Store → Discounts) and applied at checkout,
      so they work for both the plugin upgrade window and the web checkout.
      This screen does not manage them — a code entered here would never reach the checkout.
      <br>Link the plan to its Lemon Squeezy variant IDs above; the discount then applies automatically.
    </div>
  </div>`;
}

function renderPlanEditorCard(p) {
  const unlim = !!p.unlimitedDownloads;
  // Audit §C — STUDIO ham to'liq kartaga ega (narx/LS variant maydonlari barcha pullik planlar uchun)
  const isPaid = p.id !== "free";
  const isPro = p.id === "pro";
  const badge = isPro
    ? '<span class="adx-bdg adx-bdg-pro">PRO PLAN</span>'
    : p.id === "studio"
      ? '<span class="adx-bdg adx-bdg-pro" style="background:rgba(124,196,255,.16);color:#7CC4FF">STUDIO PLAN</span>'
      : '<span class="adx-bdg adx-bdg-free">FREE PLAN</span>';
  return `<div class="adx-card" style="padding:18px 20px${isPaid?';border-color:rgba(194,240,74,.3)':''}" data-plan-id="${p.id}">
    <div style="display:flex;align-items:center;gap:9px;margin-bottom:14px">${badge}<span style="flex:1"></span><button class="adx-tog ${p.active!==false?'on':'off'}" data-plan-active="${p.id}" onclick="togglePlanActive('${p.id}')" title="Active"><i></i></button></div>
    ${isPaid
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px"><div>${axFlab(`PRICE (MONTHLY) · ${p.currency}`)}<input class="adx-input mono plan-input" data-field="priceMonthly" data-plan="${p.id}" type="number" min="0" step="1" value="${p.priceMonthly}"></div><div>${axFlab(`PRICE (YEARLY) · ${p.currency}`)}<input class="adx-input mono plan-input" data-field="priceYearly" data-plan="${p.id}" type="number" min="0" step="1" value="${p.priceYearly}"></div></div>`
      : `<div style="font-size:11px;color:#8A93A3;margin-bottom:14px">Free — always $0. Only limits are configurable.</div>`}
    ${axFlab("AI CREDITS / MONTH")}
    <div style="margin-bottom:12px"><input class="adx-input mono plan-input" data-field="aiMonthlyCredits" data-plan="${p.id}" type="number" min="0" max="1000000" value="${p.aiMonthlyCredits ?? (isPro?1000:50)}"></div>
    ${axFlab("DOWNLOADS / MONTH")}
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><input class="adx-input mono plan-input plan-limit-input" data-field="downloadLimit" data-plan="${p.id}" type="number" min="1" max="9999" value="${p.downloadLimit ?? 15}" ${unlim?"disabled":""} style="flex:1"><label style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:#8A93A3;cursor:pointer;white-space:nowrap"><button class="adx-tog ${unlim?'on':'off'}" data-plan-unlim="${p.id}" onclick="togglePlanUnlimited('${p.id}')" style="transform:scale(.85)"><i></i></button>Unlimited</label></div>
    ${axFlab("IMPORT LIMIT (AE) / MONTH")}
    <div style="margin-bottom:12px"><input class="adx-input mono plan-input" data-field="importLimit" data-plan="${p.id}" type="number" min="0" placeholder="${unlim?"Unlimited":"10"}" value="${p.importLimit != null ? p.importLimit : ""}" ${unlim?"disabled":""}></div>
    ${axFlab("MAX RESOLUTION")}
    <div style="margin-bottom:12px"><select class="adx-input plan-input" data-field="maxResolution" data-plan="${p.id}">${["1080p","4K","4K + 8K"].map(r=>`<option ${p.maxResolution===r?"selected":""}>${r}</option>`).join("")}</select></div>
    ${isPaid?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px"><div>${axFlab("LS VARIANT (MONTHLY)")}<input class="adx-input mono plan-input" data-field="lsVariantMonthly" data-plan="${p.id}" placeholder="variant id" value="${(p.lsVariantMonthly||"").replace(/"/g,"&quot;")}"></div><div>${axFlab("LS VARIANT (YEARLY)")}<input class="adx-input mono plan-input" data-field="lsVariantYearly" data-plan="${p.id}" placeholder="variant id" value="${(p.lsVariantYearly||"").replace(/"/g,"&quot;")}"></div></div>`:""}
    ${axFlab("CATALOG DESCRIPTION (PLUGIN UI)")}
    <div style="margin-bottom:12px"><input class="adx-input plan-input" data-field="catalog" data-plan="${p.id}" value="${(p.catalog||"").replace(/"/g,"&quot;")}"></div>
    ${axFlab("FEATURES (ONE PER LINE)")}
    <textarea class="adx-input plan-input" data-field="features" data-plan="${p.id}" rows="3">${(p.features||[]).join("\n")}</textarea>
  </div>`;
}

window.afterRender.plans = function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='plans'){
    tba.innerHTML =
      `<button class="adx-btn2 sm" onclick="resetPluginPlans()"><i class="ph ph-arrow-clockwise"></i>Reset to default</button>`+
      `<button class="adx-btn sm" onclick="savePlansFromForm()"><i class="ph ph-check"></i>Save plans</button>`;
  }
  syncPlanConfigFromServer(); // FAZA 2 #13 — DB'dagi haqiqiy limitlar (bir marta)
};

VIEWS.plans = function () {
  const sc = subscriberCounts();
  const freeP = planById("free");
  const proP = planById("pro");
  // #92 (A4) — chegirma statistikasi olib tashlandi (localStorage promo hech kimga ta'sir qilmasdi).
  const activePlans = PLUGIN_PLANS.filter(p=>p.active!==false).length;
  return `
    ${axInfo(`Limits (AI credits, downloads, imports, resolution) are stored on the SERVER and enforced by the backend. Prices shown here are display-only — the billing truth lives in Lemon Squeezy (link variant IDs below).`,'amber')}
    <div class="adx-grid5" style="margin-bottom:18px">
      ${axStat({label:'Free subscribers',val:sc.free,foot:formatPlanLimit(freeP)})}
      ${axStat({label:'Pro subscribers',val:sc.pro,foot:planPriceLabel(proP)})}
      ${axStat({label:'Pro price (mo)',val:'$'+proP.priceMonthly,foot:'yearly $'+proP.priceYearly})}
      ${axStat({label:'Active plans',val:activePlans,foot:'of '+PLUGIN_PLANS.length+' configured'})}
      ${axStat({label:'Free limit',val:freeP.unlimitedDownloads?"∞":freeP.downloadLimit,foot:'downloads / mo'})}
    </div>
    <div class="adx-grid2">
      ${renderPlanEditorCard(freeP)}
      ${renderPlanEditorCard(proP)}
      ${PLUGIN_PLANS.some(x=>x.id==='studio')?renderPlanEditorCard(PLUGIN_PLANS.find(x=>x.id==='studio')):''}
    </div>
    ${renderDiscountSection()}`;
};
function togglePlanUnlimited(planId) {
  const p = planById(planId);
  p.unlimitedDownloads = !p.unlimitedDownloads;
  if (p.unlimitedDownloads) {
    p.downloadLimit = null;
    p.importLimit = null;
  } else if (planId === "free") {
    p.downloadLimit = 15;
    p.importLimit = 10;
  } else {
    p.downloadLimit = 100;
    p.importLimit = 50;
  }
  route("plans");
}

function togglePlanActive(planId) {
  const p = planById(planId);
  p.active = p.active === false; // §C — endi "Save plans" bilan serverga (PlanConfig.active) yoziladi
  toast(
    p.active ? "Active" : "Inactive",
    `${p.name} plan ${p.active ? "enabled" : "disabled"} — click “Save plans” to persist`,
    p.active ? "success" : "warn"
  );
  route("plans");
}

function collectPlanFromForm(planId) {
  const p = planById(planId);
  document.querySelectorAll(`.plan-input[data-plan="${planId}"]`).forEach((el) => {
    const field = el.dataset.field;
    if (!field) return;
    if (field === "features") {
      p.features = el.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return;
    }
    if (field === "aiMonthlyCredits") {
      const n = Number(el.value);
      if (!Number.isNaN(n) && n >= 0) p.aiMonthlyCredits = Math.floor(n);
      return;
    }
    if (field === "priceMonthly" || field === "priceYearly" || field === "downloadLimit" || field === "importLimit") {
      const v = el.value === "" ? null : Number(el.value);
      if (field === "downloadLimit" && p.unlimitedDownloads) p.downloadLimit = null;
      else if (field === "importLimit" && v === null) p.importLimit = null;
      else if (v !== null && !Number.isNaN(v)) p[field] = v;
      return;
    }
    p[field] = el.value;
  });
}

// #92 (A4) — collectPromoFromForm / togglePromoEnabled / setPromoType olib tashlandi:
// promo endi bu ekrandan boshqarilmaydi (Lemon Squeezy Discounts).

async function savePlansFromForm() {
  collectPlanFromForm("free");
  collectPlanFromForm("pro");
  if (PLUGIN_PLANS.some((x) => x.id === "studio")) collectPlanFromForm("studio"); // §C — Studio ham
  savePluginPlans();
  // FAZA 2 #13 — limitlar SERVERGA yoziladi (backend enforce shu qiymatlardan o'qiydi).
  let serverOk = true;
  try {
    await pushPlanConfigToServer();
  } catch (e) {
    serverOk = false;
    console.error("plan-config save", e);
  }
  if (typeof AssetFlowLog !== "undefined") {
    AssetFlowLog.info("Plans saved", {
      action: "plans_save",
      detail: `Free limit ${formatPlanLimit(planById("free"))}, server ${serverOk ? "ok" : "FAILED"}`,
    });
  }
  if (serverOk) {
    toast(
      "Plans saved",
      `Free: ${formatPlanLimit(planById("free"))} · Pro: ${planPriceLabel(planById("pro"))} · limits enforced on the server`,
      "success"
    );
  } else {
    toast("Server save failed", "Limits were NOT saved to the server — check the connection and try again", "warn");
  }
  if (CURRENT === "plans") route("plans");
  else renderNav();
}

function resetPluginPlans() {
  localStorage.removeItem("af_plugin_plans");
  location.reload();
}
