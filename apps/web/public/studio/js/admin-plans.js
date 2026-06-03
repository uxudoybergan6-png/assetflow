/* ============================================================
   AssetFlow — Plugin tariflari (Free / Pro)
   ============================================================ */

function renderDiscountSection() {
  const pr = getProPrices();
  const promo = PLUGIN_PROMO;
  const pctOrUsd = promo.type === "percent" ? "%" : ` ${planById("pro").currency}`;

  return `<div class="card plan-discount-card">
    <div class="card-head">
      <div>
        <h3>Chegirma va promo kod</h3>
        <span class="small">Faqat <b>Pro</b> tarifiga — plugin upgrade oynasida ko\u2018rinadi</span>
      </div>
      <div class="row center gap-10">
        <span class="small">${promo.enabled ? "Faol" : "O\u2018chirilgan"}</span>
        <div class="switch ${promo.enabled ? "on" : ""}" onclick="togglePromoEnabled()"></div>
      </div>
    </div>
    <div class="card-pad col gap-16">
      <div class="row gap-12 wrap">
        <div class="field grow">
          <label>Promo kod</label>
          <input class="input promo-input" data-promo="code" value="${(promo.code || "").replace(/"/g, "&quot;")}" placeholder="MASALAN: SUMMER20">
        </div>
        <div class="field grow">
          <label>Banner matni (plugin)</label>
          <input class="input promo-input" data-promo="bannerText" value="${(promo.bannerText || "").replace(/"/g, "&quot;")}">
        </div>
      </div>

      <div class="row gap-12 wrap">
        <div class="field" style="min-width:160px">
          <label>Chegirma turi</label>
          <div class="segmented promo-type-seg">
            <button type="button" class="${promo.type === "percent" ? "active" : ""}" onclick="setPromoType('percent')">Foiz %</button>
            <button type="button" class="${promo.type === "fixed" ? "active" : ""}" onclick="setPromoType('fixed')">Qat\u2018iy summa</button>
          </div>
        </div>
        <div class="field" style="width:120px">
          <label>Qiymat ${pctOrUsd}</label>
          <input class="input promo-input" data-promo="value" type="number" min="0" step="${promo.type === "percent" ? 1 : 0.5}" value="${promo.value}">
        </div>
        <div class="field grow">
          <label>Qo\u2018llanadi</label>
          <select class="select promo-input" data-promo="appliesTo" style="height:38px;width:100%">
            <option value="both" ${promo.appliesTo === "both" ? "selected" : ""}>Oylik va yillik</option>
            <option value="monthly" ${promo.appliesTo === "monthly" ? "selected" : ""}>Faqat oylik</option>
            <option value="yearly" ${promo.appliesTo === "yearly" ? "selected" : ""}>Faqat yillik</option>
          </select>
        </div>
      </div>

      <div class="row gap-12 wrap">
        <div class="field grow">
          <label>Amal boshlanishi</label>
          <input class="input promo-input" data-promo="validFrom" type="date" value="${promo.validFrom || ""}">
        </div>
        <div class="field grow">
          <label>Amal tugashi</label>
          <input class="input promo-input" data-promo="validUntil" type="date" value="${promo.validUntil || ""}">
        </div>
        <div class="field" style="width:140px">
          <label>Maks. ishlatish</label>
          <input class="input promo-input" data-promo="maxUses" type="number" min="0" placeholder="\u221e" value="${promo.maxUses ?? ""}">
        </div>
        <div class="field" style="width:120px">
          <label>Ishlatilgan (demo)</label>
          <input class="input" type="number" value="${promo.usedCount ?? 0}" disabled style="opacity:.7">
        </div>
      </div>

      <div class="plan-price-preview">
        <span class="label">Obunachi ko\u2018radigan narx (preview)</span>
        <div class="row center gap-16 wrap" style="margin-top:10px">
          ${
            promoAppliesTo("monthly")
              ? `<div class="col gap-4">
              <span class="small">Oylik Pro</span>
              <div class="row center gap-8">
                ${pr.hasDiscount && promo.enabled ? `<span class="price-old">${formatMoney(pr.monthly)}</span>` : ""}
                <span class="price-new">${formatMoney(pr.monthlyFinal)}</span>
                <span class="small">/ oy</span>
              </div>
              ${promo.enabled ? `<span class="pill" style="color:var(--green);border-color:var(--green-line)">${ic("tag")} ${promo.code}</span>` : ""}
            </div>`
              : `<div class="col gap-4"><span class="small">Oylik</span><span class="price-new">${formatMoney(pr.monthly)}</span><span class="small">chegirmasiz</span></div>`
          }
          ${
            promoAppliesTo("yearly")
              ? `<div class="col gap-4">
              <span class="small">Yillik Pro</span>
              <div class="row center gap-8">
                ${pr.hasDiscount && promo.enabled ? `<span class="price-old">${formatMoney(pr.yearly)}</span>` : ""}
                <span class="price-new">${formatMoney(pr.yearlyFinal)}</span>
                <span class="small">/ yil</span>
              </div>
            </div>`
              : `<div class="col gap-4"><span class="small">Yillik</span><span class="price-new">${formatMoney(pr.yearly)}</span></div>`
          }
        </div>
      </div>

      <div class="info-banner warn" style="font-size:12px">${ic("alert")}<span>Promo kod pluginda kiritilganda shu chegirma qo\u2018llanadi. Muddati tugaganda yoki o\u2018chirilganda asl narx qaytadi.</span></div>
    </div>
  </div>`;
}

function renderPlanEditorCard(p) {
  const unlim = !!p.unlimitedDownloads;
  return `<div class="plan-card ${p.id === "pro" ? "plan-card-pro" : "plan-card-free"}" data-plan-id="${p.id}">
    <div class="plan-card-head">
      <div>
        <span class="label">${p.id === "pro" ? "Pro tarif" : "Free tarif"}</span>
        <h3 class="h2" style="margin-top:4px">${p.name}</h3>
        <p class="small">${p.tagline}</p>
      </div>
      <div class="switch ${p.active ? "on" : ""}" data-plan-active="${p.id}" onclick="togglePlanActive('${p.id}')" title="Faol"></div>
    </div>
    <div class="card-pad col gap-16">
      ${
        p.id === "pro"
          ? `<div class="row gap-12">
          <div class="field grow"><label>Narxi (oylik) · ${p.currency}</label>
            <input class="input plan-input" data-field="priceMonthly" data-plan="${p.id}" type="number" min="0" step="1" value="${p.priceMonthly}"></div>
          <div class="field grow"><label>Narxi (yillik) · ${p.currency}</label>
            <input class="input plan-input" data-field="priceYearly" data-plan="${p.id}" type="number" min="0" step="1" value="${p.priceYearly}"></div>
        </div>`
          : `<div class="info-banner" style="font-size:12px">${ic("checkCircle")}<span>Free — har doim <b>$0</b>. Faqat limitlarni sozlaysiz.</span></div>`
      }

      <div class="divider"></div>
      <span class="label">Yuklab olish limiti (Browse paneli)</span>
      <div class="row between center wrap gap-10">
        <label class="row center gap-8" style="cursor:pointer;font-size:13px;color:var(--tx-1)">
          <div class="switch ${unlim ? "on" : ""}" data-plan-unlim="${p.id}" onclick="togglePlanUnlimited('${p.id}')"></div>
          Cheksiz (unlimited)
        </label>
        <div class="field" style="width:140px;margin:0">
          <label>Yuklab olish / oy</label>
          <input class="input plan-input plan-limit-input" data-field="downloadLimit" data-plan="${p.id}" type="number" min="1" max="9999" value="${p.downloadLimit ?? 15}" ${unlim ? "disabled" : ""}>
        </div>
      </div>

      <div class="row gap-12">
        <div class="field grow">
          <label>Import limiti (AE) / oy</label>
          <input class="input plan-input" data-field="importLimit" data-plan="${p.id}" type="number" min="0" placeholder="${unlim ? "Cheksiz" : "10"}" value="${p.importLimit != null ? p.importLimit : ""}" ${unlim ? "disabled" : ""}>
        </div>
        <div class="field grow">
          <label>Maks. resolution</label>
          <select class="select plan-input" data-field="maxResolution" data-plan="${p.id}" style="height:38px;width:100%">
            ${["1080p", "4K", "4K + 8K"]
              .map(
                (r) =>
                  `<option ${p.maxResolution === r ? "selected" : ""}>${r}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>

      <div class="field">
        <label>Katalog tavsifi (plugin UI)</label>
        <input class="input plan-input" data-field="catalog" data-plan="${p.id}" value="${(p.catalog || "").replace(/"/g, "&quot;")}">
      </div>

      <div class="field">
        <label>Xususiyatlar (har satr — plugin pricing sahifasida)</label>
        <textarea class="textarea plan-input" data-field="features" data-plan="${p.id}" rows="4">${(p.features || []).join("\n")}</textarea>
      </div>
    </div>
  </div>`;
}

VIEWS.plans = function () {
  const sc = subscriberCounts();
  const freeP = planById("free");
  const proP = planById("pro");
  const pr = getProPrices();
  const promoFoot = pr.hasDiscount
    ? `chegirma: $${pr.monthlyFinal}/oy`
    : `yillik $${proP.priceYearly}`;

  return `<div class="col gap-20">
    ${infoBanner(`${ic("plugin")}<span><b>AE Browse</b> faqat <b>Free</b> va <b>Pro</b> rejimda. Narxlar, limitlar va <b>chegirma / promo kod</b> shu yerda — saqlangach plugin yangilanadi (demo: localStorage).</span>`)}

    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr)">
      ${kpiCard({ label: "Free obunachilar", val: sc.free, ic: "users", c: "gray", foot: formatPlanLimit(freeP) })}
      ${kpiCard({ label: "Pro obunachilar", val: sc.pro, ic: "star", c: "violet", foot: planPriceLabel(proP) })}
      ${kpiCard({ label: "Pro narx (oy)", val: pr.hasDiscount ? "$" + pr.monthlyFinal : "$" + proP.priceMonthly, ic: "dollar", c: "green", foot: promoFoot })}
      ${kpiCard({ label: "Chegirma", val: PLUGIN_PROMO.enabled ? (PLUGIN_PROMO.type === "percent" ? PLUGIN_PROMO.value + "%" : "$" + PLUGIN_PROMO.value) : "—", ic: "tag", c: "orange", foot: PLUGIN_PROMO.enabled ? PLUGIN_PROMO.code : "o\u2018chirilgan" })}
      ${kpiCard({ label: "Free limit", val: freeP.unlimitedDownloads ? "∞" : freeP.downloadLimit, ic: "download", c: "yellow", foot: "yuklab olish / oy" })}
    </div>

    ${renderDiscountSection()}

    <div class="plan-editor-grid">
      ${PLUGIN_PLANS.map(renderPlanEditorCard).join("")}
    </div>

    <div class="card card-pad">
      <div class="row between center wrap gap-12">
        <div class="col gap-4">
          <span class="h3">Saqlash</span>
          <span class="small">O‘zgarishlar barcha admin ko‘rinishlariga va demo plugin pricing ga tatbiq qilinadi.</span>
        </div>
        <div class="row gap-8">
          <button type="button" class="btn btn-ghost" onclick="resetPluginPlans()">${ic("refresh")} Standartga qaytarish</button>
          <button type="button" class="btn btn-primary" onclick="savePlansFromForm()">${ic("check")} Tariflarni saqlash</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Taqqoslash (obunachi ko‘radi)</h3><span class="small">Plugin ichidagi upgrade oynasi</span></div></div>
      <div class="card-pad plan-compare">
        <table class="data" style="min-width:640px">
          <thead><tr><th></th><th>Free</th><th>Pro</th></tr></thead>
          <tbody>
            ${[
              ["Narx (oylik)", planPriceLabel(freeP), pr.hasDiscount && PLUGIN_PROMO.enabled ? `<span class="price-old" style="font-size:12px">${formatMoney(pr.monthly)}</span> <span style="color:var(--green)">${formatMoney(pr.monthlyFinal)}</span>` : planPriceLabel(proP)],
              ["Promo kod", "—", PLUGIN_PROMO.enabled ? `<span class="mono">${PLUGIN_PROMO.code}</span>` : "—"],
              ["Yuklab olish", formatPlanLimit(freeP), formatPlanLimit(proP)],
              [
                "Import / oy",
                freeP.importLimit ?? "Cheksiz",
                proP.importLimit ?? "Cheksiz",
              ],
              ["Resolution", freeP.maxResolution, proP.maxResolution],
            ]
              .map(
                ([k, a, b]) =>
                  `<tr><td class="cell-strong">${k}</td><td>${a}</td><td style="color:var(--violet-bright)">${b}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
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
  p.active = !p.active;
  toast(
    p.active ? "Faol" : "Nofaol",
    `${p.name} tarifi ${p.active ? "yoqildi" : "o‘chirildi"}`,
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

function collectPromoFromForm() {
  document.querySelectorAll(".promo-input[data-promo]").forEach((el) => {
    const key = el.dataset.promo;
    if (!key) return;
    if (key === "value") {
      PLUGIN_PROMO.value = Number(el.value) || 0;
      return;
    }
    if (key === "maxUses") {
      PLUGIN_PROMO.maxUses = el.value === "" ? null : Number(el.value);
      return;
    }
    PLUGIN_PROMO[key] = el.value;
  });
}

function togglePromoEnabled() {
  PLUGIN_PROMO.enabled = !PLUGIN_PROMO.enabled;
  route("plans");
}

function setPromoType(type) {
  PLUGIN_PROMO.type = type;
  route("plans");
}

function savePlansFromForm() {
  collectPlanFromForm("free");
  collectPlanFromForm("pro");
  collectPromoFromForm();
  savePluginPlans();
  if (typeof AssetFlowLog !== "undefined") {
    AssetFlowLog.info("Tariflar saqlandi", {
      action: "plans_save",
      detail: `Free limit ${formatPlanLimit(planById("free"))}, promo ${PLUGIN_PROMO.enabled ? PLUGIN_PROMO.code : "off"}`,
    });
  }
  const pr = getProPrices();
  const promoMsg = pr.hasDiscount
    ? ` · Promo ${PLUGIN_PROMO.code}: $${pr.monthlyFinal}/oy`
    : "";
  toast(
    "Tariflar saqlandi",
    `Free: ${formatPlanLimit(planById("free"))} · Pro: ${planPriceLabel(planById("pro"))}${promoMsg}`,
    "success"
  );
  if (CURRENT === "plans") route("plans");
  else renderNav();
}

function resetPluginPlans() {
  localStorage.removeItem("af_plugin_plans");
  location.reload();
}
