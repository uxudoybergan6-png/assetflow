/* ============================================================
   AssetFlow — Plugin tariflari (Free / Pro)
   ============================================================ */

function axFlab(t){ return `<div class="adx-flab">${t}</div>`; }

function renderDiscountSection() {
  const pr = getProPrices();
  const promo = PLUGIN_PROMO;
  const pctOrUsd = promo.type === "percent" ? "%" : ` ${planById("pro").currency}`;
  const preview = promoAppliesTo("monthly")
    ? `<div style="display:flex;align-items:center;gap:10px;margin-top:14px;padding:11px 13px;background:var(--surface2);border-radius:10px">
        <span style="font-size:11.5px;color:#8A93A3">Obunachi ko‘radigan narx:</span>
        ${pr.hasDiscount && promo.enabled ? `<span class="adx-num" style="font-size:13px;color:#8A93A3;text-decoration:line-through">${formatMoney(pr.monthly)}</span>` : ""}
        <span class="adx-num" style="font-size:15px;font-weight:600;color:#C2F04A">${formatMoney(pr.monthlyFinal)} / oy</span>
        ${promo.enabled ? `<span class="adx-bdg adx-bdg-approved" style="margin-left:4px">${promo.type==="percent"?"−"+promo.value+"%":"−"+formatMoney(promo.value)}</span>` : ""}
      </div>`
    : "";
  return `<div class="adx-card" style="padding:18px 20px;margin-top:16px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px"><span class="adx-h16" style="font-size:14px">Chegirma va promo kod</span><span style="flex:1"></span><span class="small" style="font-size:11px;color:#8A93A3">${promo.enabled?"Faol":"O‘chirilgan"}</span><button class="adx-tog ${promo.enabled?'on':'off'}" onclick="togglePromoEnabled()"><i></i></button></div>
    <div style="font-size:11px;color:#8A93A3;margin-bottom:14px">Faqat Pro tarifiga — plugin upgrade oynasida ko‘rinadi</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
      <div>${axFlab("PROMO KOD")}<input class="adx-input mono promo-input" data-promo="code" value="${(promo.code||"").replace(/"/g,"&quot;")}" placeholder="FRAME20"></div>
      <div>${axFlab("CHEGIRMA TURI")}<div class="adx-seg" style="width:100%"><button class="${promo.type==="percent"?"on":""}" style="flex:1" onclick="setPromoType('percent')">Foiz %</button><button class="${promo.type==="fixed"?"on":""}" style="flex:1" onclick="setPromoType('fixed')">Summa</button></div></div>
      <div>${axFlab(`QIYMAT ${pctOrUsd}`)}<input class="adx-input mono promo-input" data-promo="value" type="number" min="0" step="${promo.type==="percent"?1:0.5}" value="${promo.value}"></div>
      <div>${axFlab("QO‘LLANADI")}<select class="adx-input promo-input" data-promo="appliesTo"><option value="both" ${promo.appliesTo==="both"?"selected":""}>Oylik va yillik</option><option value="monthly" ${promo.appliesTo==="monthly"?"selected":""}>Faqat oylik</option><option value="yearly" ${promo.appliesTo==="yearly"?"selected":""}>Faqat yillik</option></select></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px">
      <div>${axFlab("AMAL BOSHLANISHI")}<input class="adx-input mono promo-input" data-promo="validFrom" type="date" value="${promo.validFrom||""}"></div>
      <div>${axFlab("AMAL TUGASHI")}<input class="adx-input mono promo-input" data-promo="validUntil" type="date" value="${promo.validUntil||""}"></div>
      <div>${axFlab("MAKS. ISHLATISH")}<input class="adx-input mono promo-input" data-promo="maxUses" type="number" min="0" placeholder="∞" value="${promo.maxUses ?? ""}"></div>
      <div>${axFlab("ISHLATILGAN")}<input class="adx-input mono" type="number" value="${promo.usedCount ?? 0}" disabled></div>
    </div>
    ${preview}
  </div>`;
}

function renderPlanEditorCard(p) {
  const unlim = !!p.unlimitedDownloads;
  const isPro = p.id === "pro";
  return `<div class="adx-card" style="padding:18px 20px${isPro?';border-color:rgba(194,240,74,.3)':''}" data-plan-id="${p.id}">
    <div style="display:flex;align-items:center;gap:9px;margin-bottom:14px">${isPro?'<span class="adx-bdg adx-bdg-pro">PRO TARIF</span>':'<span class="adx-bdg adx-bdg-free">FREE TARIF</span>'}<span style="flex:1"></span><button class="adx-tog ${p.active?'on':'off'}" data-plan-active="${p.id}" onclick="togglePlanActive('${p.id}')" title="Faol"><i></i></button></div>
    ${isPro
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px"><div>${axFlab(`NARXI (OYLIK) · ${p.currency}`)}<input class="adx-input mono plan-input" data-field="priceMonthly" data-plan="${p.id}" type="number" min="0" step="1" value="${p.priceMonthly}"></div><div>${axFlab(`NARXI (YILLIK) · ${p.currency}`)}<input class="adx-input mono plan-input" data-field="priceYearly" data-plan="${p.id}" type="number" min="0" step="1" value="${p.priceYearly}"></div></div>`
      : `<div style="font-size:11px;color:#8A93A3;margin-bottom:14px">Free — har doim $0. Faqat limitlarni sozlaysiz.</div>`}
    ${axFlab("YUKLAB OLISH / OY")}
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><input class="adx-input mono plan-input plan-limit-input" data-field="downloadLimit" data-plan="${p.id}" type="number" min="1" max="9999" value="${p.downloadLimit ?? 15}" ${unlim?"disabled":""} style="flex:1"><label style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:#8A93A3;cursor:pointer;white-space:nowrap"><button class="adx-tog ${unlim?'on':'off'}" data-plan-unlim="${p.id}" onclick="togglePlanUnlimited('${p.id}')" style="transform:scale(.85)"><i></i></button>Cheksiz</label></div>
    ${axFlab("IMPORT LIMITI (AE) / OY")}
    <div style="margin-bottom:12px"><input class="adx-input mono plan-input" data-field="importLimit" data-plan="${p.id}" type="number" min="0" placeholder="${unlim?"Cheksiz":"10"}" value="${p.importLimit != null ? p.importLimit : ""}" ${unlim?"disabled":""}></div>
    ${axFlab("MAKS. RESOLUTION")}
    <div style="margin-bottom:12px"><select class="adx-input plan-input" data-field="maxResolution" data-plan="${p.id}">${["1080p","4K","4K + 8K"].map(r=>`<option ${p.maxResolution===r?"selected":""}>${r}</option>`).join("")}</select></div>
    ${axFlab("KATALOG TAVSIFI (PLUGIN UI)")}
    <div style="margin-bottom:12px"><input class="adx-input plan-input" data-field="catalog" data-plan="${p.id}" value="${(p.catalog||"").replace(/"/g,"&quot;")}"></div>
    ${axFlab("XUSUSIYATLAR (HAR SATR)")}
    <textarea class="adx-input plan-input" data-field="features" data-plan="${p.id}" rows="3">${(p.features||[]).join("\n")}</textarea>
  </div>`;
}

window.afterRender.plans = function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='plans'){
    tba.innerHTML =
      `<button class="adx-btn2 sm" onclick="resetPluginPlans()"><i class="ph ph-arrow-clockwise"></i>Standartga qaytarish</button>`+
      `<button class="adx-btn sm" onclick="savePlansFromForm()"><i class="ph ph-check"></i>Tariflarni saqlash</button>`;
  }
};

VIEWS.plans = function () {
  const sc = subscriberCounts();
  const freeP = planById("free");
  const proP = planById("pro");
  const pr = getProPrices();
  return `
    ${axInfo(`AE Browse faqat Free va Pro rejimda. Narxlar va limitlar shu yerda saqlanadi (hozircha brauzer cache; Paddle ulangach serverdan).`,'amber')}
    <div class="adx-grid5" style="margin-bottom:18px">
      ${axStat({label:'Free obunachilar',val:sc.free,foot:formatPlanLimit(freeP)})}
      ${axStat({label:'Pro obunachilar',val:sc.pro,foot:planPriceLabel(proP)})}
      ${axStat({label:'Pro narx (oy)',val:pr.hasDiscount?'$'+pr.monthlyFinal:'$'+proP.priceMonthly,foot:pr.hasDiscount?'chegirma faol':'yillik $'+proP.priceYearly,footCls:pr.hasDiscount?'adx-up':''})}
      ${axStat({label:'Chegirma',val:PLUGIN_PROMO.enabled?(PLUGIN_PROMO.type==="percent"?PLUGIN_PROMO.value+"%":"$"+PLUGIN_PROMO.value):"—",foot:PLUGIN_PROMO.enabled?PLUGIN_PROMO.code:"o‘chirilgan"})}
      ${axStat({label:'Free limit',val:freeP.unlimitedDownloads?"∞":freeP.downloadLimit,foot:'yuklab olish / oy'})}
    </div>
    <div class="adx-grid2">
      ${renderPlanEditorCard(freeP)}
      ${renderPlanEditorCard(proP)}
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
