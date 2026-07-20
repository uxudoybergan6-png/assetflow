/* ============================================================
   FrameFlow — Admin BUSINESS center screens (Phase 5 · mockup b1–b5)
   Finance · Pricing management · Gen spend · Payout · Activity log.
   All data is REAL from admin endpoints (money logic is READ,
   not written — only price PATCH is admin-only). adx- design system.
   ============================================================ */
window.VIEWS = window.VIEWS || {};
window.afterRender = window.afterRender || {};

/* Shared helpers */
function bizUsd(n){ n = Number(n)||0; const a=Math.abs(n); return "$" + (a>=1000 ? n.toLocaleString(undefined,{maximumFractionDigits:0}) : n.toFixed(a>0&&a<1?3:2)); }
function bizUsdCents(c){ return "$" + ((Number(c)||0)/100).toFixed(2); }
/** Margin percentage color: ≥60 lime · 30–60 amber · <30 red. */
function bizMarginColor(pct){ if(pct==null) return "#5E6675"; if(pct>=60) return "#C2F04A"; if(pct>=30) return "#FFB27C"; return "#FF6B5E"; }
function bizErr(msg){ return `<div class="adx-empty" style="max-width:440px;margin:50px auto"><span class="ei"><i class="ph ph-warning"></i></span><div style="font-weight:600;font-size:13px">Failed to load data</div><div style="font-size:11px;color:var(--muted2);line-height:1.5">${esc(msg||'Could not connect to the API. Sign in as admin and check that the API is running.')}</div></div>`; }
function bizLoading(){ return `<div style="display:flex;align-items:center;justify-content:center;padding:80px 0"><span class="adx-spin" style="font-size:22px;color:var(--lime)"><i class="ph ph-arrow-clockwise"></i></span></div>`; }
function bizModeBadge(mode){
  const m = {
    image:['adx-bdg-info','Image'], video:['','Video'], voice:['adx-bdg-soft','Voice'],
    sfx:['adx-bdg-soft','SFX'], music:['adx-bdg-info','Music'],
  }[mode] || ['adx-bdg-draft', mode||'—'];
  if(mode==='video') return `<span class="adx-bdg" style="color:#b794f6;background:rgba(183,148,246,.14)">Video</span>`;
  return `<span class="adx-bdg ${m[0]}">${m[1]}</span>`;
}

/* ============================================================
   b2 · PRICING MANAGEMENT — per-model credit price + margin (real PATCH)
   ============================================================ */
let PRICING_DATA = null;
let PRICING_FILTER = "all";
let PRICING_SHOW_ALL = false; // BATCH4 #3 — default: faqat enabled (o'chirilgan zaxiralar yashirin)
// R4_06 — hozir o'lchanayotgan model ID'lar (proba davomida qatorni bloklash uchun).
const MEASURING = new Set();

VIEWS.pricing = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.pricing = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='pricing') tba.innerHTML =
    `<button class="adx-btn sm" onclick="applyMarginAll()" title="Every enabled model: credits = ceil(provider cost × target margin ÷ credit value)"><i class="ph ph-magic-wand"></i>Apply target margin</button>`+
    `<button class="adx-btn2 sm" onclick="measureAllMissing()" title="Measure real provider cost for every enabled BytePlus model that has no measured data yet — one cheap gen each"><i class="ph ph-gauge"></i>Measure all missing</button>`+
    `<button class="adx-btn2 sm" onclick="openPricingConfig()"><i class="ph ph-currency-circle-dollar"></i>Credit &amp; margin</button>`;
  await loadPricing();
};

/** R4_06 — provider xarajat manbai badge'i: measured (yashil) / table / estimate (amber, ma'lumot yo'q). */
function providerCostBadge(m){
  const src = m.providerCostSource || 'estimate';
  if(src==='measured') return `<span class="adx-bdg" style="color:#C2F04A;background:rgba(194,240,74,.14)" title="Measured from ${m.measuredSamples||1} real generation(s)">measured (${m.measuredSamples||1})</span>`;
  if(src==='table') return `<span class="adx-bdg adx-bdg-soft" title="From the provider-cost.ts price table">table</span>`;
  return `<span class="adx-bdg" style="color:#FFB27C;background:rgba(255,178,124,.14)" title="No cost data yet — $0.50 fail-safe. Click Measure cost to calibrate.">estimate</span>`;
}
/** BytePlus modellar per-gen token usage qaytaradi → "Measure cost" faqat shular uchun ma'noli. */
function isMeasurable(m){ return m && m.provider==='byteplus' && m.catalogEnabled!==false; }

/** BATCH4 #3 — "Apply target margin": maqsad so'raladi (default 2.0×, DB hali 1.8 bo'lsa ham)
 *  → POST apply-margin (marginTarget'ni config'ga YOZADI + barcha enabled narxni derive qiladi). */
async function applyMarginAll(){
  // P25 — prefill ACTUAL current margin (avval `cur>=2?cur:2` bilan 2 gacha ko'tarilardi → minimum
  // kabi ko'rinardi). Vergul (1,5) ham qabul qilinadi — ko'p klaviatura/lokalda o'nlik ajratkich
  // vergul; avval `Number("1,5")→NaN` edi (owner'ni bloklagan asosiy bug).
  const cur = PRICING_DATA ? PRICING_DATA.marginTarget : 2;
  const raw = prompt('Target margin (×) — applied to EVERY enabled model as ceil(provider cost × margin ÷ credit value).\nPinned (product-priced) models are skipped. Prices can go DOWN as well as up. You can enter e.g. 1.5 or 1,5.', String(cur));
  if(raw==null) return;
  const mt = Number(String(raw).trim().replace(',', '.'));
  if(!(mt>0)){ toast('Error','Enter a positive margin, e.g. 1.5 or 2','danger'); return; }
  // P25 — 1.0× dan past = provider cost'dan ARZON sotish (loss-leader). Bloklamaymiz, lekin
  // ANIQ tasdiq so'raymiz (owner ataylab xohlashi mumkin).
  if(mt < 1.0 && !confirm(`At ${mt}× you will LOSE money on every generation (selling below provider cost). Continue?`)) return;
  try {
    const res = await StudioApi.applyAdminPricingMargin({ marginTarget: mt });
    const r = res && res.report;
    const rose = (r && r.skippedNeedsConfirm) || [];
    let msg = `${r?r.applied.length:0} model(s) repriced at ${r?r.marginTarget:mt}× · ${r?r.skippedPinned.length:0} pinned skipped`;
    if(rose.length) msg += ` · ${rose.length} skipped (cost rose)`;
    toast('Margin applied', msg, 'success');
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Auto-margin applied',{action:'pricing',detail:`x${r?r.marginTarget:mt}`});
    // R4_05/06 — measured xarajat statik bazadan YUQORI modellar JIMGINA narxlanmadi (obunachi narxi
    // sakramasin). Aniq tasdiq bilan ularni ham qo'llash mumkin (confirmModelIds).
    if(rose.length){
      const names = rose.map(s=>`• ${s.label}  ($${(s.staticUsd||0).toFixed(3)} → measured $${(s.measuredUsd||0).toFixed(3)})`).join('\n');
      if(confirm(`${rose.length} model(s) have a MEASURED cost higher than their table cost, so Apply skipped them to avoid silently raising subscriber prices:\n\n${names}\n\nRe-apply INCLUDING these — this raises their credit price to (measured cost × margin)?`)){
        await StudioApi.applyAdminPricingMargin({ marginTarget: mt, confirmModelIds: rose.map(s=>s.modelId) });
        toast('Applied with confirm', `${rose.length} risen-cost model(s) repriced to measured cost`, 'success');
      }
    }
    await loadPricing();
  } catch(e){ toast('Error',(e&&e.message)||'Failed to apply margin','danger'); }
}

/** BATCH4 #3 — per-row "auto": bitta modelni maqsad marjaga keltirish. */
async function autoPriceRow(modelId){
  try {
    const res = await StudioApi.autoAdminPricingModel(modelId);
    const t = (res&&res.derived&&res.derived.tiers||[]).map(x=>`${x.key}→✦${x.credits}`).join(' · ');
    toast('Auto-priced', t || 'Price recalculated at the target margin', 'success');
    await loadPricing();
  } catch(e){ toast('Error',(e&&e.message)||'No provider cost table — set the price manually','danger'); }
}

/** R4_06 — bitta model "Measure cost": eng arzon tier'da BIR MARTA real gen → measured xarajat.
 *  Kredit yechilmaydi; kichik provider puli sarflanadi (tasdiq dialogi bilan). */
async function measureRowCost(modelId){
  const m = PRICING_DATA && PRICING_DATA.models.find(x=>x.modelId===modelId);
  if(!m) return;
  const est = m.mode==='video' ? '~$0.03–0.20 and up to a minute to finish' : '~$0.02–0.09';
  if(!confirm(`Measure "${m.label}" by generating ONE ${m.mode} at its lowest tier.\n\nThis spends a small REAL provider cost (${est}) — no subscriber credits are used. The result calibrates this model's cost/margin. Continue?`)) return;
  MEASURING.add(modelId); renderPricing();
  try {
    const res = await StudioApi.measureAdminPricingCost(modelId);
    const r = res && res.result;
    toast('Measured', `${m.label}: $${(r&&r.usd||0).toFixed(4)} (${r&&r.tokens||0} tokens) → cost & margin recalculated`, 'success');
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Cost measured',{action:'pricing',detail:`${modelId}:$${(r&&r.usd||0).toFixed(4)}`});
  } catch(e){
    toast('Measure failed', (e&&e.message)||'Probe failed', 'danger');
  } finally {
    MEASURING.delete(modelId);
    await loadPricing(); // yangi measured qiymat bilan qatorni yangilaydi
  }
}

/** R4_06 — "Measure all missing": measured ma'lumoti yo'q har enabled BytePlus modelni ketma-ket
 *  o'lchaydi (rate-limit'ga xush, har birini kutib). Butun jadval bir bosishda kalibrlaydi. */
async function measureAllMissing(){
  if(!PRICING_DATA) return;
  const targets = pricingRows().filter(m=> isMeasurable(m) && m.providerCostSource!=='measured' && !MEASURING.has(m.modelId));
  if(!targets.length){ toast('Nothing to measure','Every visible BytePlus model already has a measured cost','info'); return; }
  if(!confirm(`Measure ${targets.length} model(s) that have no measured cost yet?\n\nEach runs ONE real low-tier generation (small provider cost, no subscriber credits). Video models take up to a minute each. They run one at a time.`)) return;
  let done=0, failed=0;
  for(const m of targets){
    MEASURING.add(m.modelId); renderPricing();
    try {
      const res = await StudioApi.measureAdminPricingCost(m.modelId);
      const r = res && res.result;
      done++;
      toast('Measured', `${m.label}: $${(r&&r.usd||0).toFixed(4)}`, 'success');
    } catch(e){
      failed++;
      toast('Skipped '+m.label, (e&&e.message)||'probe failed', 'danger');
    } finally {
      MEASURING.delete(m.modelId);
    }
  }
  await loadPricing();
  toast('Measure all done', `${done} measured${failed?` · ${failed} skipped`:''}`, failed?'warn':'success');
}

async function loadPricing(){
  const root = document.getElementById('bizRoot');
  try {
    PRICING_DATA = await StudioApi.getAdminPricing();
    renderPricing();
  } catch(e){
    if(root) root.innerHTML = bizErr(e && e.message);
  }
}

function pricingRows(){
  if(!PRICING_DATA) return [];
  let rows = PRICING_DATA.models.slice();
  // BATCH4 #3 — default faqat ENABLED (katalog haqiqati); "Show all" zaxiralarni ochadi
  if(!PRICING_SHOW_ALL) rows = rows.filter(m=>m.catalogEnabled!==false);
  if(PRICING_FILTER!=='all') rows = rows.filter(m=>m.mode===PRICING_FILTER);
  return rows;
}

function renderPricing(){
  const root = document.getElementById('bizRoot');
  if(!root || !PRICING_DATA) return;
  const creditUsd = PRICING_DATA.creditUsdValue;
  const marginT = PRICING_DATA.marginTarget;
  const pool = PRICING_DATA.models.filter(m=>PRICING_SHOW_ALL || m.catalogEnabled!==false);
  const modeCount = (mode)=> pool.filter(m=>m.mode===mode).length;
  const disabledCount = PRICING_DATA.models.filter(m=>m.catalogEnabled===false).length;
  const tags = [['all','All',pool.length],['image','Image',modeCount('image')],['video','Video',modeCount('video')],['voice','Voice',modeCount('voice')],['sfx','SFX',modeCount('sfx')],['music','Music',modeCount('music')]].filter(t=>t[0]==='all'||t[2]>0);
  const rows = pricingRows();
  root.innerHTML = `
    ${axInfo(`Every AI tool shows the subscriber a credit (✦) price. <b style="color:var(--text)">Apply target margin</b> derives every enabled model's price as ceil(provider cost × margin ÷ credit value) — no hand math, no silent losses. Current: <b style="color:var(--text)">1 ✦ = ${bizUsd(creditUsd)}</b> · target margin <b style="color:var(--text)">${marginT}×</b>.`,'info')}
    <div class="adx-tagrow">${tags.map(([k,l,n])=>`<button class="adx-tag ${PRICING_FILTER===k?'on':''}" onclick="PRICING_FILTER='${k}';renderPricing()">${l} <span class="n">${n}</span></button>`).join('')}
      <span style="flex:1"></span>
      <button class="adx-tag ${PRICING_SHOW_ALL?'on':''}" onclick="PRICING_SHOW_ALL=!PRICING_SHOW_ALL;renderPricing()" title="Disabled openrouter/fal backups are hidden by default — they are never charged"><i class="ph ph-eye${PRICING_SHOW_ALL?'':'-slash'}" style="font-size:11px"></i>${PRICING_SHOW_ALL?'Enabled only':'Show all'} <span class="n">${disabledCount}</span></button>
    </div>
    <div class="adx-card" style="overflow:hidden">
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:1120px">
        <thead><tr><th>Model</th><th>Type</th><th>Provider</th><th class="r">Provider cost</th><th class="r">Credit price (✦)</th><th class="r">Subscriber price</th><th class="r">Margin</th><th class="r">Action</th></tr></thead>
        <tbody>${rows.length ? rows.map(m=>{
          const off = m.catalogEnabled===false; // BATCH4 #3 — o'chirilgan zaxira: xira + marja "—"
          const rep = m.price.representative;
          const perSec = m.mode==='video' && (m.price.pricing==='per-second' || m.price.pricing==null);
          // R4_05 — YECHILGAN provider xarajati (measured→table→estimate); eski estCostUsd fallback.
          const cost = (m.providerCostUsd!=null) ? m.providerCostUsd : m.estCostUsd;
          // representative = TOTAL credit for default params (computeGenCost) → we compare totals.
          const subUsd = rep!=null ? rep*creditUsd : null;
          const marginPct = (subUsd!=null && cost!=null && subUsd>0) ? Math.round((subUsd - cost)/subUsd*100) : null;
          const costStr = cost!=null ? bizUsd(cost) : '—';
          const credStr = rep!=null ? '✦ '+rep : '—';
          const subStr = subUsd!=null ? bizUsd(subUsd) : '—';
          const perSecHint = perSec ? '<div style="font-size:9px;color:#5E6675">per second</div>' : '';
          const measuring = MEASURING.has(m.modelId);
          const riseChip = (!off && m.needsConfirm) ? ` <span class="adx-bdg" style="color:#FFB27C;background:rgba(255,178,124,.14);margin-left:5px" title="Measured cost ($${(m.measuredUsd||0).toFixed(3)}) is HIGHER than the table cost — review before it raises subscriber prices">cost rose — review</span>` : '';
          const badges = (off?' <span class="adx-bdg adx-bdg-draft" style="margin-left:5px">Disabled</span>':'')
            + (m.pinned?' <span class="adx-bdg adx-bdg-info" style="margin-left:5px" title="Product-priced — Apply target margin skips this row">Pinned</span>':'');
          const measureBtn = (!off && isMeasurable(m))
            ? (measuring
                ? `<button class="adx-iact" disabled title="Measuring…"><span class="adx-spin"><i class="ph ph-arrow-clockwise"></i></span></button> `
                : `<button class="adx-iact" title="Measure cost — generate once at the lowest tier to learn the real provider cost" onclick="measureRowCost(${m.modelId})"><i class="ph ph-gauge"></i></button> `)
            : '';
          return `<tr ${off?'style="opacity:.45"':(m.belowTarget?'style="background:rgba(255,107,94,.05)"':'')}>
            <td style="color:var(--text);font-weight:600">${esc(m.label)}${!off&&m.belowTarget?' <i class="ph ph-warning" style="color:#FF6B5E;font-size:12px" title="Margin below target"></i>':''}${badges}${riseChip}</td>
            <td>${bizModeBadge(m.mode)}</td>
            <td style="font-size:11.5px;color:#B7C0CE">${esc(m.provider)}</td>
            <td class="r adx-num" style="color:#7CC4FF">${off?'—':`${costStr}<div style="margin-top:2px">${providerCostBadge(m)}</div>`}</td>
            <td class="r adx-num" style="color:var(--text)">${credStr}${perSecHint}</td>
            <td class="r adx-num">${off?'—':subStr}</td>
            <td class="r adx-num" style="color:${off?'#5E6675':bizMarginColor(marginPct)}">${off?'not charged':(marginPct!=null?marginPct+'%':'—')}</td>
            <td class="r" style="white-space:nowrap">${off?'':measureBtn+`<button class="adx-iact" title="Auto — set to target margin (${marginT}×)" onclick="autoPriceRow(${m.modelId})"><i class="ph ph-magic-wand"></i></button> `}<button class="adx-iact" title="Edit price" onclick="openPriceEdit(${m.modelId})"><i class="ph ph-pencil-simple"></i></button></td>
          </tr>`;
        }).join('') : `<tr><td colspan="8"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-currency-circle-dollar"></i></span><div style="font-size:12px;color:var(--muted2)">No models of this type</div></div></td></tr>`}</tbody>
      </table></div>
    </div>
    <div id="bizEditPanel"></div>`;
}

function openPriceEdit(modelId){
  const m = PRICING_DATA.models.find(x=>x.modelId===modelId);
  if(!m) return;
  const creditUsd = PRICING_DATA.creditUsdValue;
  const perSec = m.mode==='video' && (m.price.pricing==='per-second' || m.price.pricing==null);
  const host = document.getElementById('bizEditPanel');
  const cur = m.price.representative ?? m.price.cost ?? 0;
  host.innerHTML = `<div class="adx-editpanel"><div style="padding:16px 18px">
    <div style="display:flex;align-items:center;gap:8px"><i class="ph ph-pencil-simple" style="color:#C2F04A"></i><span style="font-weight:700;font-size:13.5px">${esc(m.label)} — price</span><span style="flex:1"></span><button class="adx-iact" onclick="document.getElementById('bizEditPanel').innerHTML=''"><i class="ph ph-x"></i></button></div>
    <div class="adx-flab" style="margin-top:14px">CREDIT PRICE (✦)${perSec?' / SECOND':''}</div>
    <input class="adx-input mono" id="priceEditVal" type="number" min="1" step="1" value="${cur}" oninput="updatePriceMarginPreview(${modelId})">
    <div id="priceEditPreview" style="margin-top:10px"></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="adx-btn2" style="flex:1;height:34px" onclick="document.getElementById('bizEditPanel').innerHTML=''">Cancel</button><button class="adx-btn" style="flex:1;height:34px" onclick="savePriceEdit(${modelId})">Save</button></div>
  </div></div>`;
  updatePriceMarginPreview(modelId);
}

function updatePriceMarginPreview(modelId){
  const m = PRICING_DATA.models.find(x=>x.modelId===modelId);
  const creditUsd = PRICING_DATA.creditUsdValue;
  const val = Number(document.getElementById('priceEditVal')?.value)||0;
  const cost = (m.providerCostUsd!=null) ? m.providerCostUsd : m.estCostUsd; // R4_05 yechilgan xarajat
  const subUsd = val*creditUsd;
  const marginPct = (cost!=null && subUsd>0) ? Math.round((subUsd-cost)/subUsd*100) : null;
  const col = bizMarginColor(marginPct);
  const box = document.getElementById('priceEditPreview');
  if(!box) return;
  const warn = marginPct!=null && marginPct<30;
  box.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:${warn?'var(--reddim)':'var(--surface2)'};border:1px solid ${warn?'rgba(255,107,94,.25)':'var(--hair2)'};border-radius:9px">
    <i class="ph ph-${warn?'warning':'chart-pie-slice'}" style="color:${col};font-size:14px"></i>
    <span style="font-size:10.5px;color:#B7C0CE">Margin <b style="color:${col}">${marginPct!=null?marginPct+'%':'—'}</b> — cost ${cost!=null?bizUsd(cost):'—'}, subscriber ${bizUsd(subUsd)}.</span></div>`;
}

async function savePriceEdit(modelId){
  const val = parseInt(document.getElementById('priceEditVal')?.value,10);
  if(!Number.isInteger(val) || val<1){ toast('Error','Credit price must be a whole number ≥1','danger'); return; }
  try {
    await StudioApi.patchAdminPricing(modelId, { cost: val });
    document.getElementById('bizEditPanel').innerHTML='';
    toast('Saved','Model credit price updated','success');
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Model price changed',{action:'pricing',detail:`${modelId}:${val}`});
    await loadPricing();
  } catch(e){
    toast('Error', (e&&e.message)||'Failed to save price', 'danger');
  }
}

function openPricingConfig(){
  const cur = PRICING_DATA ? PRICING_DATA.creditUsdValue : 0.019;
  const curM = PRICING_DATA ? PRICING_DATA.marginTarget : 2;
  const host = document.getElementById('bizEditPanel');
  host.innerHTML = `<div class="adx-editpanel"><div style="padding:16px 18px">
    <div style="display:flex;align-items:center;gap:8px"><i class="ph ph-currency-circle-dollar" style="color:#C2F04A"></i><span style="font-weight:700;font-size:13.5px">Credit value &amp; target margin</span><span style="flex:1"></span><button class="adx-iact" onclick="document.getElementById('bizEditPanel').innerHTML=''"><i class="ph ph-x"></i></button></div>
    <div style="font-size:10.5px;color:#8A93A3;margin-top:6px;line-height:1.5">Credit value = how many $ one credit (✦) is worth. Target margin drives "Apply target margin" and the below-target warnings.</div>
    <div class="adx-flab" style="margin-top:12px">1 ✦ = $</div>
    <input class="adx-input mono" id="creditUsdVal" type="number" min="0.001" step="0.001" value="${cur}">
    <div class="adx-flab" style="margin-top:10px">TARGET MARGIN (×)</div>
    <input class="adx-input mono" id="marginTargetVal" type="number" min="1" step="0.1" value="${curM}">
    <div style="display:flex;gap:8px;margin-top:12px"><button class="adx-btn2" style="flex:1;height:34px" onclick="document.getElementById('bizEditPanel').innerHTML=''">Cancel</button><button class="adx-btn" style="flex:1;height:34px" onclick="savePricingConfig()">Save</button></div>
  </div></div>`;
}

async function savePricingConfig(){
  const val = Number(document.getElementById('creditUsdVal')?.value);
  const mv = Number(document.getElementById('marginTargetVal')?.value);
  if(!(val>0)){ toast('Error','Enter a positive credit value','danger'); return; }
  if(!(mv>0)){ toast('Error','Enter a positive target margin','danger'); return; }
  try {
    await StudioApi.patchAdminPricingConfig({ creditUsdValue: val, marginTarget: mv });
    document.getElementById('bizEditPanel').innerHTML='';
    toast('Saved','Credit value & target margin updated','success');
    await loadPricing();
  } catch(e){
    toast('Error', (e&&e.message)||'Failed to save', 'danger');
  }
}

/* ============================================================
   b1 · FINANCE — REAL revenue (RevenueEvent) vs provider cost + pool
   ============================================================ */
let FINANCE_DATA = null;
let FINANCE_MONTH = ""; // "" = all time; "YYYY-MM" = month filter

VIEWS.finance = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.finance = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='finance') tba.innerHTML =
    `<input type="month" class="adx-input" style="width:160px;height:34px" value="${esc(FINANCE_MONTH)}" onchange="FINANCE_MONTH=this.value;loadFinance()" title="Period (empty = all time)">`+
    `<button class="adx-btn2 sm" onclick="toast('Export','Preparing finance report CSV…','info')"><i class="ph ph-export"></i>Export</button>`;
  await loadFinance();
};

async function loadFinance(){
  const root = document.getElementById('bizRoot');
  if(root) root.innerHTML = bizLoading();
  try {
    FINANCE_DATA = await StudioApi.getAdminFinance(FINANCE_MONTH || undefined);
    renderFinance();
  } catch(e){ if(root) root.innerHTML = bizErr(e && e.message); }
}

function financeDonut(providers){
  const colors = ['#C2F04A','#7CC4FF','#FFB27C','rgba(255,255,255,.14)','#b794f6'];
  const total = providers.reduce((a,p)=>a+p.estimatedUsd,0) || 1;
  let acc=0; const stops=[];
  providers.forEach((p,i)=>{ const from=acc/total*360; acc+=p.estimatedUsd; const to=acc/total*360; stops.push(`${colors[i%colors.length]} ${from}deg ${to}deg`); });
  const grad = stops.length ? `conic-gradient(${stops.join(',')})` : 'var(--f2)';
  return `<div class="adx-donut" style="background:${grad}"><div class="hole"><span class="adx-num" style="font-size:16px;font-weight:600">${bizUsd(total)}</span><span style="font-size:9px;color:#8A93A3">total</span></div></div>`;
}

function renderFinance(){
  const root = document.getElementById('bizRoot');
  if(!root || !FINANCE_DATA) return;
  const d = FINANCE_DATA;
  const providers = (d.providers||[]).slice();
  const providerCost = providers.reduce((a,p)=>a+p.estimatedUsd,0);
  // FAZA 4 — REAL revenue (RevenueEvent), not the credit-value proxy.
  const rev = d.revenue || {};
  const grossUsd = (rev.grossCents||0)/100;
  const netUsd = (rev.netCents||0)/100;
  const refundsUsd = (rev.refundsNetCents||0)/100; // negative or 0
  const mrr = (d.mrrCents||0)/100;                 // real: current-month subscription net
  const netAfterAi = netUsd - providerCost;
  const grossMarginPct = netUsd>0 ? Math.round(netAfterAi/netUsd*100) : null;
  const colors = ['#C2F04A','#7CC4FF','#FFB27C','rgba(255,255,255,.35)','#b794f6'];
  const maxBar = Math.max(netUsd, providerCost, ...providers.map(p=>Math.max(p.revenueUsd,p.estimatedUsd)), 1);
  return renderFinanceHtml(root, {d,rev,providers,providerCost,grossUsd,netUsd,refundsUsd,grossMarginPct,netAfterAi,mrr,colors,maxBar});
}

/** Pool preview line inside Finance — recalculates as the share slider moves.
 *  Step 20 (D3): infra bazadan ayiriladi (obuna net − AI − infra) × share. */
function financePoolPreview(){
  const d = FINANCE_DATA; if(!d) return;
  const share = Number(document.getElementById('poolShareKnob')?.value||0)/100;
  const providerCost = (d.providers||[]).reduce((a,p)=>a+p.estimatedUsd,0);
  const subNet = (d.poolBaseCents||0)/100; // obuna net − obuna refundlari (pool bazasi)
  const infra = (d.infraCents||0)/100;      // Step 20 (D3) — admin kiritgan oylik infra
  const pool = Math.max(0, (subNet - providerCost - infra) * share);
  const lbl = document.getElementById('poolShareLbl');
  const out = document.getElementById('poolShareOut');
  if(lbl) lbl.textContent = Math.round(share*100)+'%';
  if(out) out.innerHTML = `${bizUsd(pool)} <span style="font-size:10px;color:#8A93A3">= (${bizUsd(subNet)} subscription net − ${bizUsd(providerCost)} AI cost − ${bizUsd(infra)} infra) × ${Math.round(share*100)}%</span>`;
}

function renderFinanceHtml(root, m){
  const {d,rev,providers,providerCost,grossUsd,netUsd,refundsUsd,grossMarginPct,netAfterAi,mrr,colors,maxBar}=m;
  const byKind = rev.byKind||{};
  const kindRow = (key,label)=>{ const k=byKind[key]; if(!k) return ''; return `<div style="display:flex;align-items:center;gap:7px;font-size:11.5px"><span style="color:#B7C0CE">${label}</span><span style="flex:1"></span><span class="adx-num" style="color:${(k.netCents||0)<0?'#FF6B5E':'#B7C0CE'}">${bizUsdCents(k.netCents)}</span><span class="adx-num" style="font-size:10px;color:#5E6675">${k.events}×</span></div>`; };
  const planRows = (rev.byPlan||[]).map(p=>`<div style="display:flex;align-items:center;gap:7px;font-size:11.5px">${axPlan(p.plan)}<span style="flex:1"></span><span class="adx-num" style="color:#C2F04A">${bizUsdCents(p.netCents)}</span><span class="adx-num" style="font-size:10px;color:#5E6675">${p.events}×</span></div>`).join('');
  const shareDefault = Math.round(((d.poolShare!=null?d.poolShare:0.3))*100);
  root.innerHTML = `
    <div class="adx-grid4">
      ${axStat({label:'MRR (real, this month)',val:bizUsd(mrr),ic:'trend-up',icColor:'#C2F04A',foot:'subscription net · RevenueEvent'})}
      ${axStat({label:'Gross revenue',val:bizUsd(grossUsd),ic:'currency-circle-dollar',icColor:'#C2F04A',foot:(rev.events||0)+' payment events'})}
      ${axStat({label:'Net revenue',val:bizUsd(netUsd),ic:'wallet',icColor:'#7CC4FF',foot:refundsUsd<0?bizUsd(refundsUsd)+' refunds included':'no refunds',footCls:refundsUsd<0?'adx-down':''})}
      ${axStat({label:'Payout (pending)',val:bizUsdCents(d.payoutPendingCents),ic:'hand-coins',icColor:'#FFB27C',foot:'contributor payouts'})}
    </div>
    <div class="adx-grid4" style="margin-top:12px">
      ${axStat({label:'AI provider cost',val:bizUsd(providerCost),ic:'coins',icColor:'#7CC4FF',foot:'fal · vertex · elevenlabs'})}
      ${axStat({label:'Margin (net − AI cost)',val:grossMarginPct!=null?grossMarginPct+'%':'—',ic:'chart-bar',icColor:bizMarginColor(grossMarginPct),foot:bizUsd(netAfterAi)+' after AI cost',footCls:netAfterAi>=0?'adx-up':'adx-down'})}
      ${axStat({label:'Subscription net (pool base)',val:bizUsdCents(d.poolBaseCents),ic:'arrows-clockwise',icColor:'#C2F04A',foot:'after subscription refunds'})}
      ${axStat({label:'Credit packs net',val:bizUsdCents(rev.creditPackNetCents),ic:'stack-plus',icColor:'#b794f6',foot:'top-up orders'})}
    </div>
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-top:16px" class="biz-fin-grid">
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Contributor pool <span class="adx-bdg ${d.payoutMode==='pool'?'adx-bdg-approved':'adx-bdg-draft'}" style="margin-left:6px">${d.payoutMode==='pool'?'POOL mode':'per-download mode'}</span></span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">CONTRIBUTOR_POOL_SHARE</span></div>
        <div style="padding:14px 18px">
          <div style="display:flex;align-items:center;gap:12px"><input id="poolShareKnob" type="range" min="0" max="100" step="5" value="${shareDefault}" style="flex:1" oninput="financePoolPreview()"><span id="poolShareLbl" class="adx-num" style="width:38px;text-align:right;color:var(--text);font-weight:600">${shareDefault}%</span></div>
          <div id="poolShareOut" class="adx-num" style="margin-top:10px;font-size:15px;font-weight:600;color:#C2F04A"></div>
          <div style="font-size:10px;color:#5E6675;margin-top:8px;line-height:1.5">Pool = (subscription net revenue − AI provider cost) × share, distributed by legitimate-download share. Configured via <b>CONTRIBUTOR_POOL_SHARE</b> env (current ${shareDefault}%) — the slider is a what-if preview only. Compute &amp; write on the Payouts screen.</div>
        </div>
      </div>
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Revenue breakdown</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">NET · ${esc(FINANCE_MONTH||'ALL TIME')}</span></div>
        <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px">
          ${kindRow('subscription_initial','New subscriptions')||''}
          ${kindRow('renewal','Renewals')||''}
          ${kindRow('credit_pack','Credit packs')||''}
          ${kindRow('refund','Refunds')||''}
          ${kindRow('chargeback','Chargebacks')||''}
          ${planRows?`<div style="border-top:1px solid var(--hair2);margin:4px 0 2px"></div><div style="font-size:9.5px;color:#8A93A3;letter-spacing:.4px">BY PLAN (SUBSCRIPTION NET)</div>${planRows}`:''}
          ${!(rev.events>0)?'<span style="font-size:11px;color:var(--muted2)">No revenue events yet — they are recorded from Lemon Squeezy webhooks.</span>':''}
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-top:16px" class="biz-fin-grid">
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">AI credit revenue vs cost</span><span style="flex:1"></span><span style="display:flex;gap:12px"><span style="display:flex;align-items:center;gap:5px;font-size:10.5px;color:#8A93A3"><span style="width:9px;height:9px;border-radius:3px;background:#C2F04A"></span>Credit revenue (proxy)</span><span style="display:flex;align-items:center;gap:5px;font-size:10.5px;color:#8A93A3"><span style="width:9px;height:9px;border-radius:3px;background:#7CC4FF"></span>Cost</span></span></div>
        <div style="padding:16px 18px">${providers.length?`<div style="display:flex;align-items:flex-end;gap:12px;height:170px">${providers.slice(0,8).map(p=>`<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;height:100%" title="${esc(p.provider)}: revenue ${bizUsd(p.revenueUsd)}, cost ${bizUsd(p.estimatedUsd)}"><div style="height:${Math.max(3,p.revenueUsd/maxBar*100)}%;background:linear-gradient(180deg,#C2F04A,rgba(194,240,74,.3));border-radius:4px 4px 0 0"></div><div style="height:${Math.max(2,p.estimatedUsd/maxBar*100)}%;background:linear-gradient(180deg,#7CC4FF,rgba(124,196,255,.3))"></div></div>`).join('')}</div><div style="display:flex;gap:12px;margin-top:8px">${providers.slice(0,8).map(p=>`<span style="flex:1;text-align:center;font-size:9px;color:#5E6675;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.provider)}</span>`).join('')}</div>`:`<div class="adx-empty" style="border:0;padding:30px"><span class="ei"><i class="ph ph-chart-bar"></i></span><div style="font-size:11px;color:var(--muted2)">No gen spend yet</div></div>`}</div>
      </div>
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Cost breakdown</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">PROVIDER</span></div>
        <div style="padding:14px 16px;display:flex;align-items:center;gap:16px">${financeDonut(providers)}
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;font-size:11.5px">${providers.length?providers.slice(0,5).map((p,i)=>`<div style="display:flex;align-items:center;gap:7px"><span style="width:9px;height:9px;border-radius:3px;background:${colors[i%colors.length]}"></span>${esc(p.provider)}<span style="flex:1"></span><span class="adx-num" style="color:#B7C0CE">${bizUsd(p.estimatedUsd)}</span></div>`).join(''):'<span style="font-size:11px;color:var(--muted2)">No data</span>'}</div>
        </div>
      </div>
    </div>
    <div class="adx-card" style="margin-top:16px;overflow:hidden"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Provider cost (ProviderSpend aggregate)</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:900px">
        <thead><tr><th>Provider</th><th class="r">Generations</th><th class="r">Credits spent</th><th class="r">Cost (USD)</th><th class="r">Credit revenue</th><th class="r">Margin</th></tr></thead>
        <tbody>${providers.length?providers.map(p=>{ const mp=p.revenueUsd>0?Math.round((p.revenueUsd-p.estimatedUsd)/p.revenueUsd*100):null; return `<tr>
          <td style="color:var(--text);font-weight:600">${esc(p.provider)}</td>
          <td class="r adx-num">${(p.gens||0).toLocaleString()}</td>
          <td class="r adx-num">${(p.credits||0).toLocaleString()}</td>
          <td class="r adx-num" style="color:#7CC4FF">${bizUsd(p.estimatedUsd)}</td>
          <td class="r adx-num" style="color:#C2F04A">${bizUsd(p.revenueUsd)}</td>
          <td class="r adx-num" style="color:${bizMarginColor(mp)}">${mp!=null?mp+'%':'—'}</td>
        </tr>`;}).join(''):`<tr><td colspan="6"><div class="adx-empty" style="border:0;padding:30px"><span class="ei"><i class="ph ph-coins"></i></span><div style="font-size:11px;color:var(--muted2)">No provider spend recorded yet</div></div></td></tr>`}</tbody>
      </table></div>
    </div>`;
  financePoolPreview();
}

/* ============================================================
   b3 · GEN SPEND — per-user AI generation spend (real aggregate)
   ============================================================ */
let GENSPEND_DATA = null;

VIEWS.genspend = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.genspend = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='genspend') tba.innerHTML =
    `<span class="adx-sel"><i class="ph ph-clock-countdown" style="font-size:13px"></i><span>All time</span></span>`+
    `<button class="adx-btn2 sm" onclick="toast('Export','Preparing gen spend CSV…','info')"><i class="ph ph-export"></i>CSV</button>`;
  const root = document.getElementById('bizRoot');
  try { GENSPEND_DATA = await StudioApi.getAdminGenSpend(); renderGenSpend(); }
  catch(e){ if(root) root.innerHTML = bizErr(e && e.message); }
};

function renderGenSpend(){
  const root = document.getElementById('bizRoot');
  if(!root || !GENSPEND_DATA) return;
  const d = GENSPEND_DATA;
  const rows = d.rows||[];
  const t = d.totals||{gens:0,credits:0,costUsd:0,negative:0};
  root.innerHTML = `
    <div class="adx-grid4" style="margin-bottom:16px">
      ${axStat({label:'Total generations',val:(t.gens||0).toLocaleString(),ic:'gauge',icColor:'#C2F04A',foot:'selected period'})}
      ${axStat({label:'Credits spent',val:(t.credits||0).toLocaleString(),ic:'coins',foot:'✦ total'})}
      ${axStat({label:'Provider cost',val:bizUsd(t.costUsd),ic:'coins',icColor:'#7CC4FF',foot:'real cost'})}
      ${axStat({label:'Loss-making',val:t.negative||0,ic:'warning',icColor:'#FF6B5E',foot:'margin < 0 user'})}
    </div>
    <div class="adx-card" style="overflow:hidden"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Top users — AI spend</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">BY SPEND</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:920px">
        <thead><tr><th>User</th><th>Plan</th><th class="r">Generations</th><th class="r">Spent ✦</th><th class="r">Provider cost</th><th class="r">Credit balance</th><th class="r">Margin</th></tr></thead>
        <tbody>${rows.length ? rows.map(r=>`<tr>
          <td><div class="adx-who">${axAv(r.name||r.email||'?',r.email,32)}<div style="min-width:0"><div class="nm">${esc(r.name||r.email||'—')}</div><div class="em">${esc(r.email||'')}</div></div></div></td>
          <td>${axPlan(r.plan)}</td>
          <td class="r adx-num">${(r.gens||0).toLocaleString()}</td>
          <td class="r adx-num">${(r.creditsSpent||0).toLocaleString()}</td>
          <td class="r adx-num" style="color:#7CC4FF">${bizUsd(r.providerCostUsd)}</td>
          <td class="r adx-num">${r.creditsRemaining!=null?r.creditsRemaining.toLocaleString():'—'}</td>
          <td class="r adx-num" style="color:${r.marginPct!=null&&r.marginPct<0?'#FF6B5E':bizMarginColor(r.marginPct)}">${r.marginPct!=null?(r.marginPct<0?'−':'')+Math.abs(r.marginPct)+'%':'—'}</td>
        </tr>`).join('') : `<tr><td colspan="7"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-gauge"></i></span><div style="font-weight:600;font-size:13px">No gen spend yet</div><div style="font-size:11px;color:var(--muted2)">Appears here once subscribers generate with AI.</div></div></td></tr>`}</tbody>
      </table></div>
    </div>`;
}

/* ============================================================
   b4 · PAYOUT — contributor payments (recorded manually, NO auto-$)
   ============================================================ */
let PAYOUT_DATA = null;

VIEWS.payouts = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.payouts = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='payouts') tba.innerHTML =
    `<span class="adx-sel"><i class="ph ph-clock-countdown" style="font-size:13px"></i><span>All time</span></span>`+
    `<button class="adx-btn2 sm" onclick="toast('Export','Preparing payout report CSV…','info')"><i class="ph ph-export"></i>Export</button>`;
  const root = document.getElementById('bizRoot');
  try {
    // Step 20 — earning + sybil tahlilini parallel yuklaymiz (sybil xatosi payout'ni buzmasin).
    const [earn, sybil] = await Promise.all([
      StudioApi.getAdminEarnings(),
      StudioApi.getAdminSybil(90, false).catch(()=>null),
    ]);
    PAYOUT_DATA = earn; SYBIL_DATA = sybil;
    renderPayouts();
  }
  catch(e){ if(root) root.innerHTML = bizErr(e && e.message); }
};
let SYBIL_DATA = null;
let SYBIL_EXPANDED = {};

/* FAZA 4 (C) — pool compute panel state */
let POOL_PREVIEW = null;
function poolDefaultMonth(){
  const dt = new Date(); dt.setUTCDate(1); dt.setUTCMonth(dt.getUTCMonth()-1); // previous month
  return dt.toISOString().slice(0,7);
}
async function loadPoolPreview(){
  const month = document.getElementById('poolMonth')?.value || poolDefaultMonth();
  const box = document.getElementById('poolPanelBody');
  if(box) box.innerHTML = bizLoading();
  try { POOL_PREVIEW = await StudioApi.getAdminPoolPreview(month); renderPoolPanel(); }
  catch(e){ if(box) box.innerHTML = `<div style="padding:12px;font-size:11px;color:#FF6B5E">${esc(e&&e.message||'Failed to compute pool')}</div>`; }
}
async function writePoolRows(recompute){
  const month = document.getElementById('poolMonth')?.value || poolDefaultMonth();
  try {
    const res = await StudioApi.computeAdminPool(month, recompute);
    toast('Pool written', `${bizUsdCents(res.poolCents)} pool for ${month} — ${res.written} earning row(s) written${recompute?' (recomputed)':''}`, 'success');
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Pool payout computed',{action:'payout',detail:`${month}:${res.poolCents}`});
    POOL_PREVIEW = res; renderPoolPanel();
    PAYOUT_DATA = await StudioApi.getAdminEarnings(); renderPayouts();
  } catch(e){ toast('Error',(e&&e.message)||'Failed to write pool','danger'); }
}
function renderPoolPanel(){
  const box = document.getElementById('poolPanelBody');
  if(!box) return;
  const p = POOL_PREVIEW;
  if(!p){ box.innerHTML = `<div style="padding:10px 0;font-size:11px;color:#8A93A3">Pick a month and press Preview to compute the pool distribution.</div>`; return; }
  const rows = (p.contributors||[]);
  box.innerHTML = `
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;margin-bottom:10px">
      <span>Subscription net <b class="adx-num" style="color:#C2F04A">${bizUsdCents(p.netSubscriptionCents)}</b></span>
      <span>AI cost <b class="adx-num" style="color:#7CC4FF">−${bizUsdCents(p.providerCostCents)}</b></span>
      <span>Infra <b class="adx-num" style="color:${p.infraPresent?'#FFB27C':'#5E6675'}">−${bizUsdCents(p.infraCents||0)}</b>${p.infraPresent?'':' <span style="color:#5E6675;font-size:9.5px">(not entered)</span>'}</span>
      <span>× share <b class="adx-num">${Math.round((p.poolShare||0)*100)}%</b></span>
      <span>= pool <b class="adx-num" style="color:#C2F04A">${bizUsdCents(p.poolCents)}</b></span>
      <span style="color:#8A93A3">${(p.totalLegitimateDownloads||0).toLocaleString()} legitimate downloads</span>
      ${p.persisted?`<span class="adx-bdg adx-bdg-approved">written: ${p.written}</span>`:''}
    </div>
    ${p.poolNegative?`<div style="margin-bottom:10px;padding:8px 11px;background:rgba(255,107,94,.12);border:1px solid rgba(255,107,94,.28);border-radius:9px;font-size:10.5px;color:#FF6B5E;line-height:1.5"><i class="ph ph-warning"></i> Pool base is <b>negative</b> (AI + infra exceed subscription revenue) — clamped to $0. Contributors earn nothing this period (P26.7).</div>`:''}
    ${(!p.infraPresent && (p.poolCents>0))?`<div style="margin-bottom:10px;padding:8px 11px;background:rgba(255,178,124,.1);border:1px solid rgba(255,178,124,.24);border-radius:9px;font-size:10px;color:#FFB27C;line-height:1.5">No infra cost entered for ${esc(p.month||'this month')} — the pool base excludes bandwidth/compute, so this pool is overstated. Enter it on the Profit screen.</div>`:''}
    ${rows.length?`<table class="adx-tbl"><thead><tr><th>Contributor</th><th class="r">Legit downloads</th><th class="r">Share</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows.slice(0,50).map(r=>{
        const who = (PAYOUT_DATA&&(PAYOUT_DATA.contributors||[]).find(c=>c.contributorId===r.contributorId))||{};
        const sh = p.totalLegitimateDownloads>0?Math.round(r.downloads/p.totalLegitimateDownloads*1000)/10:0;
        return `<tr><td style="font-size:12px">${esc(who.name||who.email||r.contributorId)}</td><td class="r adx-num">${r.downloads.toLocaleString()}</td><td class="r adx-num">${sh}%</td><td class="r adx-num" style="color:#C2F04A">${bizUsdCents(r.amountCents)}</td></tr>`;
      }).join('')}</tbody></table>`:`<div style="font-size:11px;color:var(--muted2);padding:6px 0">No legitimate downloads in this period.</div>`}`;
}

/* Step 20 (P26.4) — SYBIL / self-dealing paneli (READ; payout xavfsizligi). */
function sybilScoreBadge(s, suspicious){
  const col = suspicious ? '#FF6B5E' : (s>=25 ? '#FFB27C' : '#8A93A3');
  const bg  = suspicious ? 'rgba(255,107,94,.14)' : (s>=25 ? 'rgba(255,178,124,.14)' : 'rgba(255,255,255,.06)');
  return `<span class="adx-bdg" style="color:${col};background:${bg}">${suspicious?'<i class="ph ph-warning" style="font-size:10px"></i>':''}risk ${s}</span>`;
}
function toggleSybilRow(id){ SYBIL_EXPANDED[id]=!SYBIL_EXPANDED[id]; renderPayouts(); }
function renderSybilPanel(){
  const s = SYBIL_DATA;
  if(!s) return '';
  const rows = (s.contributors||[]);
  const flagged = rows.filter(r=>r.suspicious);
  const shown = rows.filter(r=>r.score>0 || r.suspicious).slice(0,40);
  const hold = s.holdDays!=null?s.holdDays:30;
  return `
    <div class="adx-card" style="margin-bottom:16px"><div class="adx-cardhd">
        <span class="adx-h16" style="font-size:13.5px"><i class="ph ph-shield-warning" style="color:${flagged.length?'#FF6B5E':'#8A93A3'};margin-right:6px"></i>Trust &amp; safety — sybil / self-dealing</span>
        <span style="flex:1"></span>
        <span class="adx-bdg ${flagged.length?'adx-bdg-pending':'adx-bdg-approved'}">${flagged.length} flagged</span></div>
      <div style="padding:10px 18px 14px">
        <div style="font-size:10.5px;color:#8A93A3;line-height:1.6;margin-bottom:10px">Downloads are clustered by network (IP subnet), account-age proximity, exclusivity and fresh-account activity over the last ${s.sinceDays||90} days. A contributor scoring ≥ ${s.flagScore||50} is flagged for <b style="color:var(--text)">mandatory manual review before payout</b>. Earnings younger than <b style="color:var(--text)">${hold} days</b> are <b style="color:var(--text)">held</b>. This only surfaces signal — it never changes any earning or pool amount.</div>
        ${shown.length?`<table class="adx-tbl"><thead><tr><th>Contributor</th><th class="r">Risk</th><th class="r">Downloaders</th><th>Signals</th><th></th></tr></thead>
          <tbody>${shown.map(r=>{
            const open = !!SYBIL_EXPANDED[r.contributorId];
            const sig = r.signals||{};
            const reasons = (r.reasons||[]).length ? r.reasons.map(x=>`<div style="font-size:10.5px;color:#B7C0CE;line-height:1.5">• ${esc(x)}</div>`).join('') : '<span style="font-size:10.5px;color:#5E6675">no strong signal</span>';
            const main = `<tr>
              <td style="font-size:12px">${esc(r.name||r.email||r.contributorId)}<div style="font-size:9.5px;color:#5E6675">${esc(r.confidence)} confidence</div></td>
              <td class="r">${sybilScoreBadge(r.score,r.suspicious)}</td>
              <td class="r adx-num">${sig.downloaders||0}<div style="font-size:9px;color:#5E6675">${sig.distinctNetworks||0} nets</div></td>
              <td style="max-width:340px">${reasons}</td>
              <td class="r"><button class="adx-btn2 sm" onclick="toggleSybilRow('${r.contributorId}')">${open?'Hide':'Events'}</button></td>
            </tr>`;
            const detail = open ? `<tr><td colspan="5" style="background:rgba(255,255,255,.02);padding:0">
              <div style="padding:8px 14px">
                <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:#8A93A3;margin-bottom:6px">
                  <span>exclusive ${Math.round((sig.exclusiveRatio||0)*100)}%</span>
                  <span>top network ${Math.round((sig.topNetworkShare||0)*100)}%</span>
                  <span>age cluster ${Math.round((sig.ageClusterRatio||0)*100)}%</span>
                  <span>fresh ${Math.round((sig.freshRatio||0)*100)}%</span>
                  <span>${sig.withIp||0}/${sig.events||0} events with IP</span>
                </div>
                <table class="adx-tbl" style="font-size:10.5px"><thead><tr><th>Downloader</th><th>IP</th><th>Subnet</th><th class="r">Acct age</th><th>Exclusive</th><th class="r">When</th></tr></thead>
                <tbody>${(r.sample||[]).map(e=>`<tr>
                  <td>${esc(e.userLabel||e.userId)}</td>
                  <td class="adx-num" style="color:#8A93A3">${esc(e.ip||'—')}</td>
                  <td class="adx-num" style="color:#8A93A3">${esc(e.ipPrefix||'—')}</td>
                  <td class="r adx-num" style="color:${e.accountAgeHours!=null&&e.accountAgeHours<24?'#FF6B5E':'#B7C0CE'}">${e.accountAgeHours!=null?e.accountAgeHours+'h':'—'}</td>
                  <td>${e.exclusive?'<span class="adx-bdg adx-bdg-pending" style="font-size:9px">only this</span>':'<span style="color:#5E6675">no</span>'}</td>
                  <td class="r adx-num" style="color:#5E6675">${esc(String(e.createdAt||'').slice(0,10))}</td>
                </tr>`).join('')}</tbody></table>
              </div></td></tr>` : '';
            return main+detail;
          }).join('')}</tbody></table>`
        :`<div style="font-size:11px;color:var(--muted2);padding:6px 0">No download clustering signal yet — not enough download events, or none in the window.</div>`}
      </div>
    </div>`;
}

function renderPayouts(){
  const root = document.getElementById('bizRoot');
  if(!root || !PAYOUT_DATA) return;
  const d = PAYOUT_DATA;
  const rows = (d.contributors||[]).slice().sort((a,b)=>(b.balanceCents||0)-(a.balanceCents||0));
  const perDl = (d.perDownloadCents||10);
  const isPool = d.payoutMode==='pool';
  const sharePct = Math.round(((d.poolShare!=null?d.poolShare:0.3))*100);
  const totalEvents = rows.reduce((a,r)=>a+(r.earningEvents||0),0);
  const pendingCount = rows.filter(r=>(r.balanceCents||0)>0).length;
  const poolCents = rows.reduce((a,r)=>a+(r.balanceCents||0),0);
  const paidCents = rows.reduce((a,r)=>a+Math.max(0,(r.totalEarnedCents||0)-(r.balanceCents||0)),0);
  root.innerHTML = `
    ${isPool
      ? axInfo(`<b style="color:var(--text)">POOL mode</b> (PAYOUT_MODE=pool): monthly pool = (subscription net revenue − AI provider cost − infra) × <b style="color:var(--text)">${sharePct}%</b>, distributed by each contributor's share of legitimate downloads. Compute below writes the period earnings; the money transfer stays <b style="color:var(--text)">manual</b> (record payout per contributor). Switch back with PAYOUT_MODE=per_download.`,'info')
      : axInfo(`<b style="color:var(--text)">Per-download mode</b> (PAYOUT_MODE=per_download): every legitimate download accrues a flat <b style="color:var(--text)">${bizUsdCents(perDl)}</b>. The revenue-share POOL model is available with PAYOUT_MODE=pool. Payment is recorded manually.`,'amber')}
    ${renderSybilPanel()}
    <div class="adx-card" style="margin-bottom:16px"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Pool distribution ${isPool?'':'<span class="adx-bdg adx-bdg-draft" style="margin-left:6px">preview only — per-download mode active</span>'}</span><span style="flex:1"></span>
        <input type="month" class="adx-input" id="poolMonth" style="width:150px;height:30px" value="${poolDefaultMonth()}">
        <button class="adx-btn2 sm" onclick="loadPoolPreview()"><i class="ph ph-eye"></i>Preview</button>
        <button class="adx-btn sm" onclick="writePoolRows(false)" title="Write pool earning rows (idempotent per period+contributor)"><i class="ph ph-check"></i>Compute &amp; write</button>
        <button class="adx-btn2 sm" onclick="writePoolRows(true)" title="Delete UNPAID pool rows for the period and recompute"><i class="ph ph-arrow-clockwise"></i>Recompute</button></div>
      <div id="poolPanelBody" style="padding:12px 18px"></div>
    </div>
    <div class="adx-grid4" style="margin-bottom:16px">
      ${axStat({label:'Earning events',val:totalEvents.toLocaleString(),ic:'download-simple',icColor:'#C2F04A',foot:'TemplateDownloadEvent'})}
      ${axStat({label:'Ready for payout',val:pendingCount,ic:'users-three',foot:'contributor'})}
      ${axStat({label:'Unpaid balance',val:bizUsdCents(poolCents),ic:'hand-coins',icColor:'#FFB27C',foot:isPool?'pool + legacy accruals':bizUsdCents(perDl)+' / download'})}
      ${axStat({label:'Paid (total)',val:bizUsdCents(paidCents),ic:'check-circle',icColor:'#C2F04A',foot:'recorded payouts'})}
    </div>
    <div class="adx-card" style="overflow:hidden"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Contributor earning → payout</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">${isPool?`POOL · SHARE ${sharePct}%`:`RATE: ${bizUsdCents(perDl)} / DOWNLOAD`}</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:960px">
        <thead><tr><th>Contributor</th><th class="r">Earning events</th><th class="r">Total earned</th><th class="r">Accrued (balance)</th><th class="r">Paid</th><th>Status</th><th class="r">Action</th></tr></thead>
        <tbody>${rows.length ? rows.map(r=>{
          const paid = Math.max(0,(r.totalEarnedCents||0)-(r.balanceCents||0));
          const pending = (r.balanceCents||0)>0;
          return `<tr>
            <td><div class="adx-who">${axAv(r.name||r.email||'?',r.email,32)}<div style="min-width:0"><div class="nm">${esc(r.name||r.email||'—')}</div><div class="em">${esc(r.email||'')}</div></div></div></td>
            <td class="r adx-num">${(r.earningEvents||0).toLocaleString()}</td>
            <td class="r adx-num">${bizUsdCents(r.totalEarnedCents)}</td>
            <td class="r adx-num" style="color:#FFB27C">${bizUsdCents(r.balanceCents)}</td>
            <td class="r adx-num" style="color:#C2F04A">${bizUsdCents(paid)}</td>
            <td>${pending?'<span class="adx-bdg adx-bdg-pending"><span class="bd"></span>Pending':'<span class="adx-bdg adx-bdg-approved"><span class="bd"></span>Paid'}</span></td>
            <td class="r">${pending?`<button class="adx-btn sm" onclick="openPayoutRecord('${r.contributorId}')"><i class="ph ph-check"></i>Record payout</button>`:`<button class="adx-btn2 sm" onclick="toast('Receipt','Viewing payout history coming in a future version','info')"><i class="ph ph-clipboard-text"></i>Receipt</button>`}</td>
          </tr>`;
        }).join('') : `<tr><td colspan="7"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-hand-coins"></i></span><div style="font-weight:600;font-size:13px">No earnings yet</div><div style="font-size:11px;color:var(--muted2)">Contributor earnings accrue as approved templates are downloaded.</div></div></td></tr>`}</tbody>
      </table></div>
    </div>
    <div id="bizEditPanel"></div>`;
  renderPoolPanel();
}

function openPayoutRecord(contributorId){
  const r = (PAYOUT_DATA.contributors||[]).find(x=>x.contributorId===contributorId);
  if(!r) return;
  const host = document.getElementById('bizEditPanel');
  const held = r.heldCents||0, payable = r.payableCents!=null?r.payableCents:(r.balanceCents||0);
  const holdDays = r.payoutHoldDays!=null?r.payoutHoldDays:30;
  const sybil = SYBIL_DATA && (SYBIL_DATA.contributors||[]).find(x=>x.contributorId===contributorId && x.suspicious);
  host.innerHTML = `<div class="adx-editpanel" style="width:340px"><div style="padding:18px 20px">
    <div style="display:flex;align-items:center;gap:8px"><i class="ph ph-hand-coins" style="color:#C2F04A"></i><span style="font-weight:700;font-size:13.5px">Record payout</span><span style="flex:1"></span><button class="adx-iact" onclick="document.getElementById('bizEditPanel').innerHTML=''"><i class="ph ph-x"></i></button></div>
    <div style="font-size:11.5px;color:#8A93A3;margin-top:6px;line-height:1.5">${esc(r.name||r.email||'')} — unpaid balance <b style="color:var(--text)">${bizUsdCents(r.balanceCents)}</b>. This is a manually entered payout record (ContributorPayout) — the money transfer happens outside the system. All unpaid earnings will be linked.</div>
    ${sybil?`<div style="margin-top:10px;padding:9px 11px;background:rgba(255,107,94,.12);border:1px solid rgba(255,107,94,.28);border-radius:9px;font-size:10.5px;color:#FF6B5E;line-height:1.5"><i class="ph ph-warning"></i> <b>Flagged (risk ${sybil.score})</b> — review the Trust &amp; safety panel before paying. ${esc((sybil.reasons||[])[0]||'')}</div>`:''}
    ${held>0?`<div style="margin-top:10px;padding:9px 11px;background:rgba(255,178,124,.12);border:1px solid rgba(255,178,124,.28);border-radius:9px;font-size:10.5px;color:#FFB27C;line-height:1.5"><i class="ph ph-clock-countdown"></i> ${bizUsdCents(held)} of this is within the ${holdDays}-day hold window. Payable now: <b>${bizUsdCents(payable)}</b>. Recording links ALL unpaid earnings — hold is advisory.</div>`:''}
    <div class="adx-flab" style="margin-top:12px">AMOUNT</div><input class="adx-input mono" value="${bizUsdCents(r.balanceCents)}" disabled>
    <div class="adx-flab" style="margin-top:10px">METHOD</div>
    <select class="adx-input" id="payoutMethod"><option value="bank">Bank transfer</option><option value="payme">Payme</option><option value="click">Click</option><option value="manual">Other (manual)</option></select>
    <div class="adx-flab" style="margin-top:10px">NOTE / REFERENCE (optional)</div><input class="adx-input" id="payoutNote" placeholder="Bank ref or note…">
    <div style="display:flex;gap:8px;margin-top:14px"><button class="adx-btn2" style="flex:1;height:36px" onclick="document.getElementById('bizEditPanel').innerHTML=''">Cancel</button><button class="adx-btn" style="flex:1;height:36px" onclick="submitPayoutRecord('${contributorId}')"><i class="ph ph-check"></i>Record payout</button></div>
  </div></div>`;
}

async function submitPayoutRecord(contributorId){
  const method = document.getElementById('payoutMethod')?.value || 'manual';
  const note = document.getElementById('payoutNote')?.value?.trim() || '';
  try {
    const res = await StudioApi.createAdminPayout({ contributorId, method, reference: note, note });
    document.getElementById('bizEditPanel').innerHTML='';
    const amt = res && res.payout ? bizUsdCents(res.payout.amountCents) : '';
    toast('Payout recorded', `${amt} payout record created (${res && res.linkedEarnings||0} earnings linked)`, 'success');
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Contributor payout recorded',{action:'payout',detail:contributorId});
    PAYOUT_DATA = await StudioApi.getAdminEarnings();
    renderPayouts();
  } catch(e){
    toast('Error', (e&&e.message)||'Failed to record payout', 'danger');
  }
}

/* ============================================================
   b5 · ACTIVITY LOG — unified user event stream
   ============================================================ */
let ACTIVITY_DATA = null;
let ACTIVITY_FILTER = "all";
let ACTIVITY_SEARCH = "";

VIEWS.activity = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.activity = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='activity') tba.innerHTML =
    `<div class="adx-inp" style="width:220px;height:34px"><i class="ph ph-magnifying-glass" style="font-size:14px;color:#8A93A3"></i><input placeholder="User, ID…" value="${esc(ACTIVITY_SEARCH)}" oninput="ACTIVITY_SEARCH=this.value;renderActivity()"></div>`+
    `<button class="adx-btn2 sm" onclick="toast('Export','Preparing activity log CSV…','info')"><i class="ph ph-export"></i>CSV</button>`;
  await loadActivity();
};

async function loadActivity(){
  const root = document.getElementById('bizRoot');
  try { ACTIVITY_DATA = await StudioApi.getAdminActivity(ACTIVITY_FILTER); renderActivity(); }
  catch(e){ if(root) root.innerHTML = bizErr(e && e.message); }
}
async function setActivityFilter(f){ ACTIVITY_FILTER=f; await loadActivity(); }

function activityEventBadge(ev){
  if(ev==='gen') return `<span class="adx-bdg adx-bdg-info"><i class="ph ph-gauge" style="font-size:10px"></i>Generation</span>`;
  if(ev==='import') return `<span class="adx-bdg" style="color:#b794f6;background:rgba(183,148,246,.14)"><i class="ph ph-export" style="font-size:10px"></i>Import</span>`;
  return `<span class="adx-bdg adx-bdg-approved"><i class="ph ph-download-simple" style="font-size:10px"></i>Download</span>`;
}
function activitySourceBadge(src){
  if(src==='web') return `<span class="adx-bdg" style="color:#C2F04A;background:rgba(194,240,74,.1)">Web</span>`;
  return `<span class="adx-bdg" style="color:#7CC4FF;background:rgba(124,196,255,.12)">AE Plugin</span>`;
}

/* ============================================================
   b6 · BUSINESS METRICS — churn / conversion / ARPU / LTV (FAZA 4 D)
   ============================================================ */
let METRICS_DATA = null;
let METRICS_MONTH = "";

VIEWS.metrics = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.metrics = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='metrics') tba.innerHTML =
    `<input type="month" class="adx-input" style="width:160px;height:34px" value="${esc(METRICS_MONTH)}" onchange="METRICS_MONTH=this.value;loadMetrics()" title="Period (empty = current month)">`;
  await loadMetrics();
};

async function loadMetrics(){
  const root = document.getElementById('bizRoot');
  if(root) root.innerHTML = bizLoading();
  try { METRICS_DATA = await StudioApi.getAdminMetrics(METRICS_MONTH || undefined); renderMetrics(); }
  catch(e){ if(root) root.innerHTML = bizErr(e && e.message); }
}

function metricsChangeBadge(from,to){
  const paidTo = to!=='FREE', paidFrom = from!=='FREE';
  if(!paidFrom && paidTo) return `<span class="adx-bdg adx-bdg-approved"><i class="ph ph-arrow-up-right" style="font-size:10px"></i>Upgrade</span>`;
  if(paidFrom && !paidTo) return `<span class="adx-bdg" style="color:#FF6B5E;background:rgba(255,107,94,.12)"><i class="ph ph-arrow-down-right" style="font-size:10px"></i>Downgrade</span>`;
  return `<span class="adx-bdg adx-bdg-info">Change</span>`;
}

function renderMetrics(){
  const root = document.getElementById('bizRoot');
  if(!root || !METRICS_DATA) return;
  const d = METRICS_DATA;
  const rev = d.revenue||{};
  const pct = (v)=> v!=null ? v+'%' : '—';
  root.innerHTML = `
    ${axInfo(`Basic business metrics for <b style="color:var(--text)">${esc(d.month)}</b> from real revenue (RevenueEvent) + plan-change history (PlanChangeEvent). Churn = downgrades ÷ paying at period start; conversion = free→paid upgrades ÷ free users; ARPU = period net revenue ÷ paying users; LTV = ARPU ÷ churn. Deeper cohort analytics is a future iteration.`,'info')}
    <div class="adx-grid4" style="margin-bottom:12px">
      ${axStat({label:'Paying subscribers',val:(d.payingNow||0).toLocaleString(),ic:'users-three',icColor:'#C2F04A',foot:`${(d.freeNow||0).toLocaleString()} free`})}
      ${axStat({label:'Free → paid (period)',val:d.upgrades||0,ic:'arrow-up-right',icColor:'#C2F04A',foot:'conversion '+pct(d.conversionPct),footCls:'adx-up'})}
      ${axStat({label:'Downgrades (period)',val:d.downgrades||0,ic:'arrow-down-right',icColor:'#FF6B5E',foot:'churn '+pct(d.churnPct),footCls:(d.downgrades||0)>0?'adx-down':''})}
      ${axStat({label:'Dunning / at-risk',val:d.dunningCount||0,ic:'warning',icColor:'#FFB27C',foot:'billing issue flagged'})}
    </div>
    <div class="adx-grid4" style="margin-bottom:16px">
      ${axStat({label:'Net revenue (period)',val:bizUsdCents(rev.netCents),ic:'wallet',icColor:'#C2F04A',foot:(rev.events||0)+' events'})}
      ${axStat({label:'MRR (subscription net)',val:bizUsdCents(rev.mrrCents),ic:'trend-up',icColor:'#C2F04A',foot:'this period'})}
      ${axStat({label:'ARPU',val:d.arpuCents!=null?bizUsdCents(d.arpuCents):'—',ic:'user',icColor:'#7CC4FF',foot:'net ÷ paying users'})}
      ${axStat({label:'LTV (basic)',val:d.ltvCents!=null?bizUsdCents(d.ltvCents):'—',ic:'chart-line-up',icColor:'#b794f6',foot:'ARPU ÷ churn'})}
    </div>
    <div class="adx-card" style="overflow:hidden"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Recent plan changes</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">LAST ${(d.recentChanges||[]).length}</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:760px">
        <thead><tr><th>Time</th><th>User</th><th>Change</th><th>From → To</th><th>Source</th></tr></thead>
        <tbody>${(d.recentChanges||[]).length ? d.recentChanges.map(c=>`<tr>
          <td class="adx-num" style="font-size:10.5px;color:#8A93A3;white-space:nowrap">${esc(String(c.at||'').slice(0,16).replace('T',' '))}</td>
          <td><div class="adx-who">${axAv(c.userName||c.userEmail||'?',c.userEmail,26)}<span class="nm" style="font-size:12px">${esc(c.userName||c.userEmail||'—')}</span></div></td>
          <td>${metricsChangeBadge(c.fromPlan,c.toPlan)}</td>
          <td style="font-size:11.5px;color:#B7C0CE">${esc(c.fromPlan)} → <b style="color:var(--text)">${esc(c.toPlan)}</b></td>
          <td style="font-size:11px;color:#8A93A3">${esc(c.source)}</td>
        </tr>`).join('') : `<tr><td colspan="5"><div class="adx-empty" style="border:0;padding:30px"><span class="ei"><i class="ph ph-chart-line-up"></i></span><div style="font-size:11px;color:var(--muted2)">No plan changes recorded yet — they are captured from billing webhooks and admin actions.</div></div></td></tr>`}</tbody>
      </table></div>
    </div>`;
}

function renderActivity(){
  const root = document.getElementById('bizRoot');
  if(!root || !ACTIVITY_DATA) return;
  let items = (ACTIVITY_DATA.items||[]).slice();
  const q = ACTIVITY_SEARCH.trim().toLowerCase();
  if(q) items = items.filter(it=>((it.userName||'')+(it.userEmail||'')+(it.detail||'')+(it.id||'')).toLowerCase().includes(q));
  const all = ACTIVITY_DATA.items||[];
  const cnt = (ev)=> all.filter(i=>i.event===ev).length;
  const tags = [['all','All',all.length,''],['gen','Generation',cnt('gen'),'ph-gauge'],['download','Download',cnt('download'),'ph-download-simple'],['import','Import',cnt('import'),'ph-export']];
  root.innerHTML = `
    <div class="adx-tagrow">${tags.map(([k,l,n,ic])=>`<button class="adx-tag ${ACTIVITY_FILTER===k?'on':''}" onclick="setActivityFilter('${k}')">${ic?`<i class="ph ${ic}" style="font-size:11px"></i>`:''}${l} <span class="n">${n}</span></button>`).join('')}</div>
    <div class="adx-card" style="overflow:hidden">
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:940px">
        <thead><tr><th>Time</th><th>User</th><th>Event</th><th>Detail</th><th>Source</th><th class="r">Credit / cost</th></tr></thead>
        <tbody>${items.length ? items.map(it=>{
          const time = String(it.at||'').slice(11,19) || String(it.at||'').slice(0,10);
          const cred = it.event==='gen' && it.credits>0 ? `<span style="color:#C2F04A">−✦ ${it.credits}</span>` : '<span style="color:#8A93A3">—</span>';
          return `<tr>
            <td class="adx-num" style="font-size:10.5px;color:#8A93A3;white-space:nowrap">${esc(time)}</td>
            <td><div class="adx-who">${axAv(it.userName||it.userEmail||'?',it.userEmail,26)}<span class="nm" style="font-size:12px">${esc(it.userName||it.userEmail||'—')}</span></div></td>
            <td>${activityEventBadge(it.event)}</td>
            <td style="font-size:11.5px;color:#B7C0CE">${esc(it.detail||'—')}</td>
            <td>${activitySourceBadge(it.source)}</td>
            <td class="r adx-num">${cred}</td>
          </tr>`;
        }).join('') : `<tr><td colspan="6"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-list-checks"></i></span><div style="font-weight:600;font-size:13px">No activity found</div><div style="font-size:11px;color:var(--muted2)">Gen / download / import events stream here.</div></div></td></tr>`}</tbody>
      </table></div>
    </div>`;
}

/* ============================================================
   Step 21 (P26.8) · PROFIT — revenue − AI − LS − infra − contributor = profit
   Bitta ekran: "FOYDA KO'RYAPMANMI?". BEPUL kredit = DAROMAD EMAS (CAC).
   Barcha raqamlar REAL admin endpoint'dan (READ). Infra = admin kiritadi.
   ============================================================ */
let PROFIT_DATA = null;
let PROFIT_MONTH = new Date().toISOString().slice(0,7); // joriy oy

VIEWS.profit = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.profit = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='profit') tba.innerHTML =
    `<input type="month" class="adx-input" style="width:160px;height:34px" value="${esc(PROFIT_MONTH)}" onchange="PROFIT_MONTH=this.value;loadProfit()" title="Period (empty = all time)">`+
    `<button class="adx-btn2 sm" onclick="loadProfit()"><i class="ph ph-arrow-clockwise"></i>Refresh</button>`;
  await loadProfit();
};

async function loadProfit(){
  const root = document.getElementById('bizRoot');
  if(root) root.innerHTML = bizLoading();
  try { PROFIT_DATA = await StudioApi.getAdminProfit(PROFIT_MONTH || undefined); renderProfit(); }
  catch(e){ if(root) root.innerHTML = bizErr(e && e.message); }
}

/** P&L bitta qatori: label, signed cents, izoh, rang. */
function plRow(label, cents, opts){
  opts = opts || {};
  const neg = opts.cost ? -Math.abs(cents) : cents;
  const color = opts.color || (neg<0 ? '#FF6B5E' : (neg>0 ? '#C2F04A' : '#B7C0CE'));
  const sign = neg>0 ? '+' : (neg<0 ? '−' : '');
  return `<div style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--hair2)">
    <span style="font-size:12.5px;color:${opts.strong?'var(--text)':'#B7C0CE'};font-weight:${opts.strong?'600':'400'}">${label}</span>
    ${opts.note?`<span style="font-size:10px;color:#5E6675">${opts.note}</span>`:''}
    <span style="flex:1"></span>
    <span class="adx-num" style="font-size:${opts.strong?'15px':'13px'};font-weight:${opts.strong?'700':'500'};color:${color}">${sign}${bizUsd(Math.abs(neg)/100)}</span>
  </div>`;
}

function renderProfit(){
  const root = document.getElementById('bizRoot');
  if(!root || !PROFIT_DATA) return;
  const d = PROFIT_DATA;
  const rev = d.revenue||{}, c = d.costs||{}, cac = d.customerAcquisition||{};
  const profit = d.profitCents||0;
  const conf = c.aiConfidence||{measured:0,official:0,estimated:0};
  const measuredRows = (conf.measured||0)+(conf.official||0);
  const estRows = conf.estimated||0;
  const totRows = measuredRows+estRows;
  const measPct = totRows>0 ? Math.round(measuredRows/totRows*100) : 0;
  const floors = d.pricingFloors||{channels:[],violations:[]};
  const infraB = c.infraBreakdown||{storageCents:0,egressCents:0,computeCents:0};
  const isMonth = !!d.month;

  root.innerHTML = `
    ${(floors.violations&&floors.violations.length)
      ? axInfo(`<b style="color:#FF6B5E">Below-cost channel${floors.violations.length>1?'s':''}:</b> ${floors.violations.map(esc).join(' · ')}. A channel priced under $${(floors.floorUsd||0).toFixed(4)}/credit loses money on every credit spent (P27 D6). Fix the plan/pack price or the credit anchor.`,'red')
      : axInfo(`No sales channel is priced below the cost floor ($${(floors.floorUsd||0).toFixed(4)}/credit). Boot assertion enforces this on every deploy.`,'lime')}

    <div class="adx-grid4" style="margin-bottom:12px">
      ${axStat({label:'Net revenue',val:bizUsdCents(rev.netCents),ic:'currency-circle-dollar',icColor:'#C2F04A',foot:isMonth?esc(d.month):'all time'})}
      ${axStat({label:'Total costs',val:bizUsd((( (c.aiCents||0)+(c.lsFeeCents||0)+(c.infraCents||0)+(c.contributorCents||0) ))/100),ic:'coins',icColor:'#7CC4FF',foot:'AI + LS + infra + payout'})}
      ${axStat({label:'PROFIT',val:bizUsd(profit/100),ic:profit>=0?'trend-up':'trend-down',icColor:profit>=0?'#C2F04A':'#FF6B5E',foot:profit>=0?'in the black':'operating at a loss',footCls:profit>=0?'adx-up':'adx-down'})}
      ${axStat({label:'Free-user AI (CAC)',val:bizUsd((cac.freeUserAiCents||0)/100),ic:'gift',icColor:'#FFB27C',foot:'spent · revenue $0'})}
    </div>

    <div style="display:grid;grid-template-columns:1.25fr 1fr;gap:16px" class="biz-fin-grid">
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Profit &amp; loss ${isMonth?`· ${esc(d.month)}`:'· all time'}</span></div>
        <div style="padding:8px 18px 16px">
          ${plRow('Net revenue', rev.netCents||0, {strong:true, note:'subscriptions + credit packs, after refunds'})}
          <div style="padding:2px 0 2px 14px">
            ${plRow('· Subscriptions', rev.subscriptionNetCents||0, {})}
            ${plRow('· Credit packs', rev.creditPackNetCents||0, {})}
            ${(rev.refundsNetCents||0)!==0?plRow('· Refunds', rev.refundsNetCents||0, {}):''}
          </div>
          ${plRow('AI provider cost', c.aiCents||0, {cost:true, note:`${measPct}% measured · ${100-measPct}% estimated`})}
          ${plRow('Lemon Squeezy commission', c.lsFeeCents||0, {cost:true, note:`est. ${Math.round((c.lsFeeBasis&&c.lsFeeBasis.pct||0.05)*100)}% + $0.50/tx · ${(c.lsFeeBasis&&c.lsFeeBasis.saleEvents)||0} tx`})}
          ${plRow('Infrastructure', c.infraCents||0, {cost:true, note:c.infraPresent?`storage ${bizUsd(infraB.storageCents/100)} · egress ${bizUsd(infraB.egressCents/100)} · compute ${bizUsd(infraB.computeCents/100)}`:'not entered — profit overstated'})}
          ${plRow('Contributor pool', c.contributorCents||0, {cost:true, note:c.poolNegative?'pool base is NEGATIVE → clamped to 0':'30% of (sub net − AI − infra)'})}
          <div style="height:6px"></div>
          ${plRow('PROFIT', profit, {strong:true, color:profit>=0?'#C2F04A':'#FF6B5E'})}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Infrastructure cost</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">${esc(d.month||'—')}</span></div>
          <div style="padding:12px 16px">
            ${!isMonth?`<div style="font-size:11px;color:#FFB27C;margin-bottom:8px">Pick a specific month to enter infra cost.</div>`:`
            <div style="font-size:10.5px;color:#8A93A3;line-height:1.5;margin-bottom:10px">Admin-entered monthly infra (storage + <b style="color:var(--text)">egress / traffic</b> + compute). Subtracted from the contributor pool base and shown above. ${c.infraPresent?'':'<b style="color:#FFB27C">Not entered for this month.</b>'}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
              <div><div class="adx-flab">STORAGE $</div><input class="adx-input mono" id="infStorage" type="number" min="0" step="0.01" value="${(infraB.storageCents/100)||''}" placeholder="0"></div>
              <div><div class="adx-flab">EGRESS $</div><input class="adx-input mono" id="infEgress" type="number" min="0" step="0.01" value="${(infraB.egressCents/100)||''}" placeholder="0"></div>
              <div><div class="adx-flab">COMPUTE $</div><input class="adx-input mono" id="infCompute" type="number" min="0" step="0.01" value="${(infraB.computeCents/100)||''}" placeholder="0"></div>
            </div>
            <button class="adx-btn sm" style="margin-top:10px;width:100%" onclick="saveInfraCost()"><i class="ph ph-check"></i>Save infra cost for ${esc(d.month)}</button>`}
          </div>
        </div>
        <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Cost confidence (P24)</span></div>
          <div style="padding:12px 16px;font-size:11.5px;color:#B7C0CE;line-height:1.7">
            <div style="display:flex;gap:8px;align-items:center"><span style="width:9px;height:9px;border-radius:3px;background:#C2F04A"></span>Measured / official <span style="flex:1"></span><b class="adx-num">${measuredRows} rows</b></div>
            <div style="display:flex;gap:8px;align-items:center"><span style="width:9px;height:9px;border-radius:3px;background:#FFB27C"></span>Estimated <span style="flex:1"></span><b class="adx-num">${estRows} rows</b></div>
            <div style="height:8px;border-radius:5px;overflow:hidden;background:rgba(255,178,124,.25);margin-top:8px"><div style="height:100%;width:${measPct}%;background:#C2F04A"></div></div>
            <div style="font-size:10px;color:#5E6675;margin-top:6px">${measPct}% of AI cost is measured (BytePlus tokens / invoice), the rest is estimated. Trust the measured share; treat the rest as directional.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="adx-card" style="margin-top:16px;overflow:hidden"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Loss-making models <span class="adx-bdg ${(d.lossMakingModels||[]).length?'adx-bdg-pending':'adx-bdg-approved'}" style="margin-left:6px">${(d.lossMakingModels||[]).length} under water</span></span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">MARGIN &lt; 1.0× (credit-value proxy)</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:820px">
        <thead><tr><th>Model</th><th>Provider</th><th>Mode</th><th class="r">Gens</th><th class="r">Credit revenue</th><th class="r">Real cost</th><th class="r">Margin</th></tr></thead>
        <tbody>${(d.lossMakingModels||[]).length ? d.lossMakingModels.map(m=>`<tr>
          <td style="color:var(--text);font-weight:600">${esc(m.label||('model '+m.modelId))}</td>
          <td style="font-size:11px;color:#8A93A3">${esc(m.provider||'—')}</td>
          <td>${bizModeBadge(m.mode)}</td>
          <td class="r adx-num">${(m.credits||0).toLocaleString()}</td>
          <td class="r adx-num" style="color:#C2F04A">${bizUsd(m.revenueUsd)}</td>
          <td class="r adx-num" style="color:#7CC4FF">${bizUsd(m.realCostUsd)}</td>
          <td class="r adx-num" style="color:#FF6B5E">${m.margin!=null?m.margin.toFixed(2)+'×':'—'}</td>
        </tr>`).join('') : `<tr><td colspan="7"><div class="adx-empty" style="border:0;padding:26px"><span class="ei"><i class="ph ph-check-circle"></i></span><div style="font-size:11px;color:var(--muted2)">No model is selling below its provider cost this period.</div></div></td></tr>`}</tbody>
      </table></div>
      <div style="padding:10px 16px;font-size:10.5px;color:#5E6675;line-height:1.5;border-top:1px solid var(--hair2)">⚠️ "Credit revenue" is the credit-value proxy (credits × anchor). For <b>free-plan</b> generations the user paid nothing — that spend is <b>customer-acquisition cost</b> (${bizUsd((cac.freeUserAiCents||0)/100)} this period), not revenue.</div>
    </div>`;
}

async function saveInfraCost(){
  const month = PROFIT_MONTH;
  const num = (id)=>{ const v=Number(document.getElementById(id)?.value); return Number.isFinite(v)&&v>=0?v:0; };
  try {
    await StudioApi.saveAdminInfraCost({ periodMonth: month, storageUsd:num('infStorage'), egressUsd:num('infEgress'), computeUsd:num('infCompute') });
    toast('Infra saved', `Infrastructure cost recorded for ${month}`, 'success');
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Infra cost saved',{action:'finance',detail:month});
    await loadProfit();
  } catch(e){ toast('Error',(e&&e.message)||'Failed to save infra cost','danger'); }
}
