/* ============================================================
   FrameFlow — Admin BIZNES markaz ekranlari (Bosqich 5 · maket b1–b5)
   Moliya · Narx boshqaruvi · Gen sarfi · Payout · Faoliyat jurnali.
   Barcha ma'lumot REAL admin endpointlaridan (pul mantig'i O'QILADI,
   yozilmaydi — faqat narx PATCH admin-only). adx- dizayn tizimi.
   ============================================================ */
window.VIEWS = window.VIEWS || {};
window.afterRender = window.afterRender || {};

/* Umumiy yordamchilar */
function bizUsd(n){ n = Number(n)||0; return "$" + (n>=1000 ? n.toLocaleString(undefined,{maximumFractionDigits:0}) : n.toFixed(n<1?3:2)); }
function bizUsdCents(c){ return "$" + ((Number(c)||0)/100).toFixed(2); }
/** Margin foizi rangi: ≥60 lime · 30–60 amber · <30 qizil. */
function bizMarginColor(pct){ if(pct==null) return "#5E6675"; if(pct>=60) return "#C2F04A"; if(pct>=30) return "#FFB27C"; return "#FF6B5E"; }
function bizErr(msg){ return `<div class="adx-empty" style="max-width:440px;margin:50px auto"><span class="ei"><i class="ph ph-warning"></i></span><div style="font-weight:600;font-size:13px">Ma'lumot yuklanmadi</div><div style="font-size:11px;color:var(--muted2);line-height:1.5">${esc(msg||'API bilan bog‘lanib bo‘lmadi. Admin sifatida kiring va API ishlayotganini tekshiring.')}</div></div>`; }
function bizLoading(){ return `<div style="display:flex;align-items:center;justify-content:center;padding:80px 0"><span class="adx-spin" style="font-size:22px;color:var(--lime)"><i class="ph ph-arrow-clockwise"></i></span></div>`; }
function bizModeBadge(mode){
  const m = {
    image:['adx-bdg-info','Rasm'], video:['','Video'], voice:['adx-bdg-soft','Ovoz'],
    sfx:['adx-bdg-soft','SFX'], music:['adx-bdg-info','Musiqa'],
  }[mode] || ['adx-bdg-draft', mode||'—'];
  if(mode==='video') return `<span class="adx-bdg" style="color:#b794f6;background:rgba(183,148,246,.14)">Video</span>`;
  return `<span class="adx-bdg ${m[0]}">${m[1]}</span>`;
}

/* ============================================================
   b2 · NARX BOSHQARUVI — per-model kredit narx + margin (real PATCH)
   ============================================================ */
let PRICING_DATA = null;
let PRICING_FILTER = "all";

VIEWS.pricing = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.pricing = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='pricing') tba.innerHTML =
    `<button class="adx-btn2 sm" onclick="toast('Standart','Standart narxga qaytarish — model tahriridan bekor qiling','info')"><i class="ph ph-arrow-clockwise"></i>Standart</button>`+
    `<button class="adx-btn sm" onclick="openPricingConfig()"><i class="ph ph-currency-circle-dollar"></i>Kredit qiymati</button>`;
  await loadPricing();
};

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
  if(PRICING_FILTER!=='all') rows = rows.filter(m=>m.mode===PRICING_FILTER);
  return rows;
}

function renderPricing(){
  const root = document.getElementById('bizRoot');
  if(!root || !PRICING_DATA) return;
  const creditUsd = PRICING_DATA.creditUsdValue;
  const modeCount = (mode)=> PRICING_DATA.models.filter(m=>m.mode===mode).length;
  const tags = [['all','Hammasi',PRICING_DATA.models.length],['image','Rasm',modeCount('image')],['video','Video',modeCount('video')],['voice','Ovoz',modeCount('voice')],['sfx','SFX',modeCount('sfx')],['music','Musiqa',modeCount('music')]].filter(t=>t[0]==='all'||t[2]>0);
  const rows = pricingRows();
  root.innerHTML = `
    ${axInfo(`Har AI tool obunachiga kredit (✦) narxda ko‘rinadi. Kredit narxini shu yerda boshqarasiz — provayder xarajatiga qarab margin avtomatik hisoblanadi. Video narxi = soniya × kredit. Joriy kredit qiymati: <b style="color:var(--text)">1 ✦ = ${bizUsd(creditUsd)}</b>.`,'info')}
    <div class="adx-tagrow">${tags.map(([k,l,n])=>`<button class="adx-tag ${PRICING_FILTER===k?'on':''}" onclick="PRICING_FILTER='${k}';renderPricing()">${l} <span class="n">${n}</span></button>`).join('')}</div>
    <div class="adx-card" style="overflow:hidden">
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:1080px">
        <thead><tr><th>Model</th><th>Tur</th><th>Provayder</th><th class="r">Provayder xarajati</th><th class="r">Kredit narxi (✦)</th><th class="r">Obunachi narxi</th><th class="r">Margin</th><th class="r">Amal</th></tr></thead>
        <tbody>${rows.length ? rows.map(m=>{
          const rep = m.price.representative;
          const perSec = m.mode==='video' && (m.price.pricing==='per-second' || m.price.pricing==null);
          const cost = m.estCostUsd;
          // representative = default paramlar uchun JAMI kredit (computeGenCost) → jami solishtiramiz.
          const subUsd = rep!=null ? rep*creditUsd : null;
          const marginPct = (subUsd!=null && cost!=null && subUsd>0) ? Math.round((subUsd - cost)/subUsd*100) : null;
          const costStr = cost!=null ? bizUsd(cost) : '—';
          const credStr = rep!=null ? '✦ '+rep : '—';
          const subStr = subUsd!=null ? bizUsd(subUsd) : '—';
          const perSecHint = perSec ? '<div style="font-size:9px;color:#5E6675">soniya asosida</div>' : '';
          return `<tr ${m.belowTarget?'style="background:rgba(255,107,94,.05)"':''}>
            <td style="color:var(--text);font-weight:600">${esc(m.label)}${m.belowTarget?' <i class="ph ph-warning" style="color:#FF6B5E;font-size:12px" title="Margin maqsaddan past"></i>':''}</td>
            <td>${bizModeBadge(m.mode)}</td>
            <td style="font-size:11.5px;color:#B7C0CE">${esc(m.provider)}</td>
            <td class="r adx-num" style="color:#7CC4FF">${costStr}</td>
            <td class="r adx-num" style="color:var(--text)">${credStr}${perSecHint}</td>
            <td class="r adx-num">${subStr}</td>
            <td class="r adx-num" style="color:${bizMarginColor(marginPct)}">${marginPct!=null?marginPct+'%':'—'}</td>
            <td class="r"><button class="adx-iact" title="Narxni tahrirlash" onclick="openPriceEdit(${m.modelId})"><i class="ph ph-pencil-simple"></i></button></td>
          </tr>`;
        }).join('') : `<tr><td colspan="8"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-currency-circle-dollar"></i></span><div style="font-size:12px;color:var(--muted2)">Bu turda model yo‘q</div></div></td></tr>`}</tbody>
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
    <div style="display:flex;align-items:center;gap:8px"><i class="ph ph-pencil-simple" style="color:#C2F04A"></i><span style="font-weight:700;font-size:13.5px">${esc(m.label)} — narx</span><span style="flex:1"></span><button class="adx-iact" onclick="document.getElementById('bizEditPanel').innerHTML=''"><i class="ph ph-x"></i></button></div>
    <div class="adx-flab" style="margin-top:14px">KREDIT NARXI (✦)${perSec?' / SONIYA':''}</div>
    <input class="adx-input mono" id="priceEditVal" type="number" min="1" step="1" value="${cur}" oninput="updatePriceMarginPreview(${modelId})">
    <div id="priceEditPreview" style="margin-top:10px"></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="adx-btn2" style="flex:1;height:34px" onclick="document.getElementById('bizEditPanel').innerHTML=''">Bekor</button><button class="adx-btn" style="flex:1;height:34px" onclick="savePriceEdit(${modelId})">Saqlash</button></div>
  </div></div>`;
  updatePriceMarginPreview(modelId);
}

function updatePriceMarginPreview(modelId){
  const m = PRICING_DATA.models.find(x=>x.modelId===modelId);
  const creditUsd = PRICING_DATA.creditUsdValue;
  const val = Number(document.getElementById('priceEditVal')?.value)||0;
  const cost = m.estCostUsd;
  const subUsd = val*creditUsd;
  const marginPct = (cost!=null && subUsd>0) ? Math.round((subUsd-cost)/subUsd*100) : null;
  const col = bizMarginColor(marginPct);
  const box = document.getElementById('priceEditPreview');
  if(!box) return;
  const warn = marginPct!=null && marginPct<30;
  box.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:${warn?'var(--reddim)':'var(--surface2)'};border:1px solid ${warn?'rgba(255,107,94,.25)':'var(--hair2)'};border-radius:9px">
    <i class="ph ph-${warn?'warning':'chart-pie-slice'}" style="color:${col};font-size:14px"></i>
    <span style="font-size:10.5px;color:#B7C0CE">Margin <b style="color:${col}">${marginPct!=null?marginPct+'%':'—'}</b> — xarajat ${cost!=null?bizUsd(cost):'—'}, obunachi ${bizUsd(subUsd)}.</span></div>`;
}

async function savePriceEdit(modelId){
  const val = parseInt(document.getElementById('priceEditVal')?.value,10);
  if(!Number.isInteger(val) || val<1){ toast('Xato','Kredit narxi butun va ≥1 bo‘lsin','danger'); return; }
  try {
    await StudioApi.patchAdminPricing(modelId, { cost: val });
    document.getElementById('bizEditPanel').innerHTML='';
    toast('Saqlandi','Model kredit narxi yangilandi','success');
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Model narxi o‘zgartirildi',{action:'pricing',detail:`${modelId}:${val}`});
    await loadPricing();
  } catch(e){
    toast('Xato', (e&&e.message)||'Narx saqlanmadi', 'danger');
  }
}

function openPricingConfig(){
  const cur = PRICING_DATA ? PRICING_DATA.creditUsdValue : 0.019;
  const host = document.getElementById('bizEditPanel');
  host.innerHTML = `<div class="adx-editpanel"><div style="padding:16px 18px">
    <div style="display:flex;align-items:center;gap:8px"><i class="ph ph-currency-circle-dollar" style="color:#C2F04A"></i><span style="font-weight:700;font-size:13.5px">Kredit qiymati (USD)</span><span style="flex:1"></span><button class="adx-iact" onclick="document.getElementById('bizEditPanel').innerHTML=''"><i class="ph ph-x"></i></button></div>
    <div style="font-size:10.5px;color:#8A93A3;margin-top:6px;line-height:1.5">1 kredit (✦) necha $ turadi. Barcha model margin hisobi shunga tayanadi.</div>
    <div class="adx-flab" style="margin-top:12px">1 ✦ = $</div>
    <input class="adx-input mono" id="creditUsdVal" type="number" min="0.001" step="0.001" value="${cur}">
    <div style="display:flex;gap:8px;margin-top:12px"><button class="adx-btn2" style="flex:1;height:34px" onclick="document.getElementById('bizEditPanel').innerHTML=''">Bekor</button><button class="adx-btn" style="flex:1;height:34px" onclick="savePricingConfig()">Saqlash</button></div>
  </div></div>`;
}

async function savePricingConfig(){
  const val = Number(document.getElementById('creditUsdVal')?.value);
  if(!(val>0)){ toast('Xato','Musbat qiymat kiriting','danger'); return; }
  try {
    await StudioApi.patchAdminPricingConfig({ creditUsdValue: val });
    document.getElementById('bizEditPanel').innerHTML='';
    toast('Saqlandi','Kredit qiymati yangilandi','success');
    await loadPricing();
  } catch(e){
    toast('Xato', (e&&e.message)||'Saqlanmadi', 'danger');
  }
}

/* ============================================================
   b1 · MOLIYA — daromad vs provayder xarajati + margin + payout
   ============================================================ */
let FINANCE_DATA = null;

VIEWS.finance = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.finance = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='finance') tba.innerHTML =
    `<span class="adx-sel"><i class="ph ph-clock-countdown" style="font-size:13px"></i><span>Butun davr</span></span>`+
    `<button class="adx-btn2 sm" onclick="toast('Eksport','Moliya hisoboti CSV tayyorlanmoqda…','info')"><i class="ph ph-export"></i>Eksport</button>`;
  const root = document.getElementById('bizRoot');
  try {
    try { if(typeof refreshSubscribersFromApi==='function') await refreshSubscribersFromApi(); } catch(_){}
    FINANCE_DATA = await StudioApi.getAdminFinance();
    renderFinance();
  } catch(e){ if(root) root.innerHTML = bizErr(e && e.message); }
};

function financeDonut(providers){
  const colors = ['#C2F04A','#7CC4FF','#FFB27C','rgba(255,255,255,.14)','#b794f6'];
  const total = providers.reduce((a,p)=>a+p.estimatedUsd,0) || 1;
  let acc=0; const stops=[];
  providers.forEach((p,i)=>{ const from=acc/total*360; acc+=p.estimatedUsd; const to=acc/total*360; stops.push(`${colors[i%colors.length]} ${from}deg ${to}deg`); });
  const grad = stops.length ? `conic-gradient(${stops.join(',')})` : 'var(--f2)';
  return `<div class="adx-donut" style="background:${grad}"><div class="hole"><span class="adx-num" style="font-size:16px;font-weight:600">${bizUsd(total)}</span><span style="font-size:9px;color:#8A93A3">jami</span></div></div>`;
}

function renderFinance(){
  const root = document.getElementById('bizRoot');
  if(!root || !FINANCE_DATA) return;
  const d = FINANCE_DATA;
  const agg = d.aggregate || {revenueUsd:0,realCostUsd:0};
  const providers = (d.providers||[]).slice();
  const providerCost = providers.reduce((a,p)=>a+p.estimatedUsd,0);
  const revenue = agg.revenueUsd || providers.reduce((a,p)=>a+p.revenueUsd,0);
  const grossMarginPct = revenue>0 ? Math.round((revenue - providerCost)/revenue*100) : null;
  const net = revenue - providerCost;
  // MRR — faol Pro obunalar × Pro oylik narx (obunachi stats + tarif narxi)
  const sc = typeof subscriberCounts==='function' ? subscriberCounts() : {pro:0};
  const proPrice = (typeof planById==='function' && planById('pro')) ? (planById('pro').priceMonthly||0) : 0;
  const mrr = (sc.pro||0) * proPrice;
  const colors = ['#C2F04A','#7CC4FF','#FFB27C','rgba(255,255,255,.35)','#b794f6'];
  const maxBar = Math.max(revenue, providerCost, ...providers.map(p=>Math.max(p.revenueUsd,p.estimatedUsd)), 1);
  return renderFinanceHtml(root, {d,agg,providers,providerCost,revenue,grossMarginPct,net,mrr,sc,colors,maxBar});
}

function renderFinanceHtml(root, m){
  const {d,providers,providerCost,revenue,grossMarginPct,net,mrr,sc,colors,maxBar}=m;
  root.innerHTML = `
    <div class="adx-grid4">
      ${axStat({label:'Oylik daromad (MRR)',val:bizUsd(mrr),ic:'trend-up',icColor:'#C2F04A',foot:`${sc.pro||0} Pro obuna`})}
      ${axStat({label:'Provayder xarajati',val:bizUsd(providerCost),ic:'coins',icColor:'#7CC4FF',foot:'fal · vertex · elevenlabs'})}
      ${axStat({label:'Yalpi margin',val:grossMarginPct!=null?grossMarginPct+'%':'—',ic:'chart-bar',icColor:bizMarginColor(grossMarginPct),foot:bizUsd(net)+' sof',footCls:net>=0?'adx-up':'adx-down'})}
      ${axStat({label:'Payout (kutilmoqda)',val:bizUsdCents(d.payoutPendingCents),ic:'hand-coins',icColor:'#FFB27C',foot:'contributor to‘lovlari'})}
    </div>
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-top:16px" class="biz-fin-grid">
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Daromad vs xarajat</span><span style="flex:1"></span><span style="display:flex;gap:12px"><span style="display:flex;align-items:center;gap:5px;font-size:10.5px;color:#8A93A3"><span style="width:9px;height:9px;border-radius:3px;background:#C2F04A"></span>Daromad</span><span style="display:flex;align-items:center;gap:5px;font-size:10.5px;color:#8A93A3"><span style="width:9px;height:9px;border-radius:3px;background:#7CC4FF"></span>Xarajat</span></span></div>
        <div style="padding:16px 18px">${providers.length?`<div style="display:flex;align-items:flex-end;gap:12px;height:170px">${providers.slice(0,8).map(p=>`<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;height:100%" title="${esc(p.provider)}: daromad ${bizUsd(p.revenueUsd)}, xarajat ${bizUsd(p.estimatedUsd)}"><div style="height:${Math.max(3,p.revenueUsd/maxBar*100)}%;background:linear-gradient(180deg,#C2F04A,rgba(194,240,74,.3));border-radius:4px 4px 0 0"></div><div style="height:${Math.max(2,p.estimatedUsd/maxBar*100)}%;background:linear-gradient(180deg,#7CC4FF,rgba(124,196,255,.3))"></div></div>`).join('')}</div><div style="display:flex;gap:12px;margin-top:8px">${providers.slice(0,8).map(p=>`<span style="flex:1;text-align:center;font-size:9px;color:#5E6675;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.provider)}</span>`).join('')}</div>`:`<div class="adx-empty" style="border:0;padding:30px"><span class="ei"><i class="ph ph-chart-bar"></i></span><div style="font-size:11px;color:var(--muted2)">Hali gen sarfi yo‘q</div></div>`}</div>
      </div>
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Xarajat taqsimoti</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">PROVAYDER</span></div>
        <div style="padding:14px 16px;display:flex;align-items:center;gap:16px">${financeDonut(providers)}
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;font-size:11.5px">${providers.length?providers.slice(0,5).map((p,i)=>`<div style="display:flex;align-items:center;gap:7px"><span style="width:9px;height:9px;border-radius:3px;background:${colors[i%colors.length]}"></span>${esc(p.provider)}<span style="flex:1"></span><span class="adx-num" style="color:#B7C0CE">${bizUsd(p.estimatedUsd)}</span></div>`).join(''):'<span style="font-size:11px;color:var(--muted2)">Ma‘lumot yo‘q</span>'}</div>
        </div>
      </div>
    </div>
    <div class="adx-card" style="margin-top:16px;overflow:hidden"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Provayder xarajati (ProviderSpend agregatsiya)</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:900px">
        <thead><tr><th>Provayder</th><th class="r">Generatsiyalar</th><th class="r">Sarflangan kredit</th><th class="r">Xarajat (USD)</th><th class="r">Kredit daromadi</th><th class="r">Margin</th></tr></thead>
        <tbody>${providers.length?providers.map(p=>{ const mp=p.revenueUsd>0?Math.round((p.revenueUsd-p.estimatedUsd)/p.revenueUsd*100):null; return `<tr>
          <td style="color:var(--text);font-weight:600">${esc(p.provider)}</td>
          <td class="r adx-num">${(p.gens||0).toLocaleString()}</td>
          <td class="r adx-num">${(p.credits||0).toLocaleString()}</td>
          <td class="r adx-num" style="color:#7CC4FF">${bizUsd(p.estimatedUsd)}</td>
          <td class="r adx-num" style="color:#C2F04A">${bizUsd(p.revenueUsd)}</td>
          <td class="r adx-num" style="color:${bizMarginColor(mp)}">${mp!=null?mp+'%':'—'}</td>
        </tr>`;}).join(''):`<tr><td colspan="6"><div class="adx-empty" style="border:0;padding:30px"><span class="ei"><i class="ph ph-coins"></i></span><div style="font-size:11px;color:var(--muted2)">Hali provayder sarfi yozilmagan</div></div></td></tr>`}</tbody>
      </table></div>
    </div>`;
}

/* ============================================================
   b3 · GEN SARFI — per-user AI generatsiya sarfi (real agregat)
   ============================================================ */
let GENSPEND_DATA = null;

VIEWS.genspend = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.genspend = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='genspend') tba.innerHTML =
    `<span class="adx-sel"><i class="ph ph-clock-countdown" style="font-size:13px"></i><span>Butun davr</span></span>`+
    `<button class="adx-btn2 sm" onclick="toast('Eksport','Gen sarfi CSV tayyorlanmoqda…','info')"><i class="ph ph-export"></i>CSV</button>`;
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
      ${axStat({label:'Jami generatsiya',val:(t.gens||0).toLocaleString(),ic:'gauge',icColor:'#C2F04A',foot:'tanlangan davr'})}
      ${axStat({label:'Sarflangan kredit',val:(t.credits||0).toLocaleString(),ic:'coins',foot:'✦ hammasi'})}
      ${axStat({label:'Provayder xarajati',val:bizUsd(t.costUsd),ic:'coins',icColor:'#7CC4FF',foot:'real cost'})}
      ${axStat({label:'Zarar keltiruvchi',val:t.negative||0,ic:'warning',icColor:'#FF6B5E',foot:'margin < 0 user'})}
    </div>
    <div class="adx-card" style="overflow:hidden"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Top foydalanuvchilar — AI sarf</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">SARF BO‘YICHA</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:920px">
        <thead><tr><th>Foydalanuvchi</th><th>Reja</th><th class="r">Generatsiya</th><th class="r">Sarflangan ✦</th><th class="r">Provayder xarajati</th><th class="r">Kredit qoldiq</th><th class="r">Margin</th></tr></thead>
        <tbody>${rows.length ? rows.map(r=>`<tr>
          <td><div class="adx-who">${axAv(r.name||r.email||'?',r.email,32)}<div style="min-width:0"><div class="nm">${esc(r.name||r.email||'—')}</div><div class="em">${esc(r.email||'')}</div></div></div></td>
          <td>${axPlan(r.plan)}</td>
          <td class="r adx-num">${(r.gens||0).toLocaleString()}</td>
          <td class="r adx-num">${(r.creditsSpent||0).toLocaleString()}</td>
          <td class="r adx-num" style="color:#7CC4FF">${bizUsd(r.providerCostUsd)}</td>
          <td class="r adx-num">${r.creditsRemaining!=null?r.creditsRemaining.toLocaleString():'—'}</td>
          <td class="r adx-num" style="color:${r.marginPct!=null&&r.marginPct<0?'#FF6B5E':bizMarginColor(r.marginPct)}">${r.marginPct!=null?(r.marginPct<0?'−':'')+Math.abs(r.marginPct)+'%':'—'}</td>
        </tr>`).join('') : `<tr><td colspan="7"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-gauge"></i></span><div style="font-weight:600;font-size:13px">Hali gen sarfi yo‘q</div><div style="font-size:11px;color:var(--muted2)">Obunachi AI generatsiya qilganda shu yerda ko‘rinadi.</div></div></td></tr>`}</tbody>
      </table></div>
    </div>`;
}

/* ============================================================
   b4 · PAYOUT — contributor to'lovlari (qo'lda yoziladi, avto-$ YO'Q)
   ============================================================ */
let PAYOUT_DATA = null;

VIEWS.payouts = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.payouts = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='payouts') tba.innerHTML =
    `<span class="adx-sel"><i class="ph ph-clock-countdown" style="font-size:13px"></i><span>Butun davr</span></span>`+
    `<button class="adx-btn2 sm" onclick="toast('Eksport','Payout hisoboti CSV tayyorlanmoqda…','info')"><i class="ph ph-export"></i>Eksport</button>`;
  const root = document.getElementById('bizRoot');
  try { PAYOUT_DATA = await StudioApi.getAdminEarnings(); renderPayouts(); }
  catch(e){ if(root) root.innerHTML = bizErr(e && e.message); }
};

function renderPayouts(){
  const root = document.getElementById('bizRoot');
  if(!root || !PAYOUT_DATA) return;
  const d = PAYOUT_DATA;
  const rows = (d.contributors||[]).slice().sort((a,b)=>(b.balanceCents||0)-(a.balanceCents||0));
  const perDl = (d.perDownloadCents||10);
  const totalEvents = rows.reduce((a,r)=>a+(r.earningEvents||0),0);
  const pendingCount = rows.filter(r=>(r.balanceCents||0)>0).length;
  const poolCents = rows.reduce((a,r)=>a+(r.balanceCents||0),0);
  const paidCents = rows.reduce((a,r)=>a+Math.max(0,(r.totalEarnedCents||0)-(r.balanceCents||0)),0);
  root.innerHTML = `
    ${axInfo(`Shablonlar obunaga kiritilgan (cheksiz yuklab olish) — avtomatik $ hisoblanmaydi. Admin yuklab olish sonini ko‘radi va <b style="color:var(--text)">qo‘lda to‘lov yozadi</b>. Stavka va formula (qat‘iy-per-download yoki oylik pool ulushi) — <b style="color:var(--text)">EGA QARORI</b>. Joriy stavka: <b style="color:var(--text)">${bizUsdCents(perDl)} / download</b>.`,'amber')}
    <div class="adx-grid4" style="margin-bottom:16px">
      ${axStat({label:'Earning hodisalari',val:totalEvents.toLocaleString(),ic:'download-simple',icColor:'#C2F04A',foot:'TemplateDownloadEvent'})}
      ${axStat({label:'To‘lovga tayyor',val:pendingCount,ic:'users-three',foot:'contributor'})}
      ${axStat({label:'To‘lanmagan balans',val:bizUsdCents(poolCents),ic:'hand-coins',icColor:'#FFB27C',foot:bizUsdCents(perDl)+' / download'})}
      ${axStat({label:'To‘langan (jami)',val:bizUsdCents(paidCents),ic:'check-circle',icColor:'#C2F04A',foot:'yozilgan to‘lovlar'})}
    </div>
    <div class="adx-card" style="overflow:hidden"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Contributor bo‘yicha earning → to‘lov</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">STAVKA: ${bizUsdCents(perDl)} / DOWNLOAD</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:960px">
        <thead><tr><th>Contributor</th><th class="r">Earning hodisalari</th><th class="r">Jami topilgan</th><th class="r">Hisoblangan (balans)</th><th class="r">To‘langan</th><th>Holat</th><th class="r">Amal</th></tr></thead>
        <tbody>${rows.length ? rows.map(r=>{
          const paid = Math.max(0,(r.totalEarnedCents||0)-(r.balanceCents||0));
          const pending = (r.balanceCents||0)>0;
          return `<tr>
            <td><div class="adx-who">${axAv(r.name||r.email||'?',r.email,32)}<div style="min-width:0"><div class="nm">${esc(r.name||r.email||'—')}</div><div class="em">${esc(r.email||'')}</div></div></div></td>
            <td class="r adx-num">${(r.earningEvents||0).toLocaleString()}</td>
            <td class="r adx-num">${bizUsdCents(r.totalEarnedCents)}</td>
            <td class="r adx-num" style="color:#FFB27C">${bizUsdCents(r.balanceCents)}</td>
            <td class="r adx-num" style="color:#C2F04A">${bizUsdCents(paid)}</td>
            <td>${pending?'<span class="adx-bdg adx-bdg-pending"><span class="bd"></span>Kutilmoqda':'<span class="adx-bdg adx-bdg-approved"><span class="bd"></span>To‘langan'}</span></td>
            <td class="r">${pending?`<button class="adx-btn sm" onclick="openPayoutRecord('${r.contributorId}')"><i class="ph ph-check"></i>To‘lov yozish</button>`:`<button class="adx-btn2 sm" onclick="toast('Kvitansiya','To‘lov tarixida ko‘rish keyingi versiyada','info')"><i class="ph ph-clipboard-text"></i>Kvitansiya</button>`}</td>
          </tr>`;
        }).join('') : `<tr><td colspan="7"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-hand-coins"></i></span><div style="font-weight:600;font-size:13px">Hali earning yo‘q</div><div style="font-size:11px;color:var(--muted2)">Approved shablonlar yuklab olinganda contributor earning to‘planadi.</div></div></td></tr>`}</tbody>
      </table></div>
    </div>
    <div id="bizEditPanel"></div>`;
}

function openPayoutRecord(contributorId){
  const r = (PAYOUT_DATA.contributors||[]).find(x=>x.contributorId===contributorId);
  if(!r) return;
  const host = document.getElementById('bizEditPanel');
  host.innerHTML = `<div class="adx-editpanel" style="width:340px"><div style="padding:18px 20px">
    <div style="display:flex;align-items:center;gap:8px"><i class="ph ph-hand-coins" style="color:#C2F04A"></i><span style="font-weight:700;font-size:13.5px">To‘lov yozish</span><span style="flex:1"></span><button class="adx-iact" onclick="document.getElementById('bizEditPanel').innerHTML=''"><i class="ph ph-x"></i></button></div>
    <div style="font-size:11.5px;color:#8A93A3;margin-top:6px;line-height:1.5">${esc(r.name||r.email||'')} — to‘lanmagan balans <b style="color:var(--text)">${bizUsdCents(r.balanceCents)}</b>. Bu qo‘lda kiritilgan to‘lov yozuvi (ContributorPayout) — pul transferi tashqarida. Barcha to‘lanmagan earninglar bog‘lanadi.</div>
    <div class="adx-flab" style="margin-top:12px">SUMMA</div><input class="adx-input mono" value="${bizUsdCents(r.balanceCents)}" disabled>
    <div class="adx-flab" style="margin-top:10px">USUL</div>
    <select class="adx-input" id="payoutMethod"><option value="bank">Bank o‘tkazma</option><option value="payme">Payme</option><option value="click">Click</option><option value="manual">Boshqa (qo‘lda)</option></select>
    <div class="adx-flab" style="margin-top:10px">IZOH / REFERENCE (ixtiyoriy)</div><input class="adx-input" id="payoutNote" placeholder="Bank ref yoki izoh…">
    <div style="display:flex;gap:8px;margin-top:14px"><button class="adx-btn2" style="flex:1;height:36px" onclick="document.getElementById('bizEditPanel').innerHTML=''">Bekor</button><button class="adx-btn" style="flex:1;height:36px" onclick="submitPayoutRecord('${contributorId}')"><i class="ph ph-check"></i>To‘lovni yozish</button></div>
  </div></div>`;
}

async function submitPayoutRecord(contributorId){
  const method = document.getElementById('payoutMethod')?.value || 'manual';
  const note = document.getElementById('payoutNote')?.value?.trim() || '';
  try {
    const res = await StudioApi.createAdminPayout({ contributorId, method, reference: note, note });
    document.getElementById('bizEditPanel').innerHTML='';
    const amt = res && res.payout ? bizUsdCents(res.payout.amountCents) : '';
    toast('To‘lov yozildi', `${amt} to‘lov qaydi yaratildi (${res && res.linkedEarnings||0} earning bog‘landi)`, 'success');
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Contributor payout yozildi',{action:'payout',detail:contributorId});
    PAYOUT_DATA = await StudioApi.getAdminEarnings();
    renderPayouts();
  } catch(e){
    toast('Xato', (e&&e.message)||'To‘lov yozilmadi', 'danger');
  }
}

/* ============================================================
   b5 · FAOLIYAT JURNALI — birlashgan foydalanuvchi hodisa oqimi
   ============================================================ */
let ACTIVITY_DATA = null;
let ACTIVITY_FILTER = "all";
let ACTIVITY_SEARCH = "";

VIEWS.activity = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.activity = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='activity') tba.innerHTML =
    `<div class="adx-inp" style="width:220px;height:34px"><i class="ph ph-magnifying-glass" style="font-size:14px;color:#8A93A3"></i><input placeholder="Foydalanuvchi, ID…" value="${esc(ACTIVITY_SEARCH)}" oninput="ACTIVITY_SEARCH=this.value;renderActivity()"></div>`+
    `<button class="adx-btn2 sm" onclick="toast('Eksport','Faoliyat jurnali CSV tayyorlanmoqda…','info')"><i class="ph ph-export"></i>CSV</button>`;
  await loadActivity();
};

async function loadActivity(){
  const root = document.getElementById('bizRoot');
  try { ACTIVITY_DATA = await StudioApi.getAdminActivity(ACTIVITY_FILTER); renderActivity(); }
  catch(e){ if(root) root.innerHTML = bizErr(e && e.message); }
}
async function setActivityFilter(f){ ACTIVITY_FILTER=f; await loadActivity(); }

function activityEventBadge(ev){
  if(ev==='gen') return `<span class="adx-bdg adx-bdg-info"><i class="ph ph-gauge" style="font-size:10px"></i>Generatsiya</span>`;
  if(ev==='import') return `<span class="adx-bdg" style="color:#b794f6;background:rgba(183,148,246,.14)"><i class="ph ph-export" style="font-size:10px"></i>Import</span>`;
  return `<span class="adx-bdg adx-bdg-approved"><i class="ph ph-download-simple" style="font-size:10px"></i>Yuklab olish</span>`;
}
function activitySourceBadge(src){
  if(src==='web') return `<span class="adx-bdg" style="color:#C2F04A;background:rgba(194,240,74,.1)">Web</span>`;
  return `<span class="adx-bdg" style="color:#7CC4FF;background:rgba(124,196,255,.12)">AE Plugin</span>`;
}

function renderActivity(){
  const root = document.getElementById('bizRoot');
  if(!root || !ACTIVITY_DATA) return;
  let items = (ACTIVITY_DATA.items||[]).slice();
  const q = ACTIVITY_SEARCH.trim().toLowerCase();
  if(q) items = items.filter(it=>((it.userName||'')+(it.userEmail||'')+(it.detail||'')+(it.id||'')).toLowerCase().includes(q));
  const all = ACTIVITY_DATA.items||[];
  const cnt = (ev)=> all.filter(i=>i.event===ev).length;
  const tags = [['all','Hammasi',all.length,''],['gen','Generatsiya',cnt('gen'),'ph-gauge'],['download','Yuklab olish',cnt('download'),'ph-download-simple'],['import','Import',cnt('import'),'ph-export']];
  root.innerHTML = `
    <div class="adx-tagrow">${tags.map(([k,l,n,ic])=>`<button class="adx-tag ${ACTIVITY_FILTER===k?'on':''}" onclick="setActivityFilter('${k}')">${ic?`<i class="ph ${ic}" style="font-size:11px"></i>`:''}${l} <span class="n">${n}</span></button>`).join('')}</div>
    <div class="adx-card" style="overflow:hidden">
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:940px">
        <thead><tr><th>Vaqt</th><th>Foydalanuvchi</th><th>Hodisa</th><th>Tafsilot</th><th>Manba</th><th class="r">Kredit / narx</th></tr></thead>
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
        }).join('') : `<tr><td colspan="6"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-list-checks"></i></span><div style="font-weight:600;font-size:13px">Faoliyat topilmadi</div><div style="font-size:11px;color:var(--muted2)">Gen / yuklab olish / import hodisalari shu yerda oqadi.</div></div></td></tr>`}</tbody>
      </table></div>
    </div>`;
}
