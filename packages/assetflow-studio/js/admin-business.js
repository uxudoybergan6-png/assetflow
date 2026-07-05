/* ============================================================
   FrameFlow — Admin BUSINESS center screens (Phase 5 · mockup b1–b5)
   Finance · Pricing management · Gen spend · Payout · Activity log.
   All data is REAL from admin endpoints (money logic is READ,
   not written — only price PATCH is admin-only). adx- design system.
   ============================================================ */
window.VIEWS = window.VIEWS || {};
window.afterRender = window.afterRender || {};

/* Shared helpers */
function bizUsd(n){ n = Number(n)||0; return "$" + (n>=1000 ? n.toLocaleString(undefined,{maximumFractionDigits:0}) : n.toFixed(n<1?3:2)); }
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

VIEWS.pricing = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.pricing = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='pricing') tba.innerHTML =
    `<button class="adx-btn2 sm" onclick="toast('Standart','Reset to default price — cancel the model edit','info')"><i class="ph ph-arrow-clockwise"></i>Default</button>`+
    `<button class="adx-btn sm" onclick="openPricingConfig()"><i class="ph ph-currency-circle-dollar"></i>Credit value</button>`;
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
  const tags = [['all','All',PRICING_DATA.models.length],['image','Image',modeCount('image')],['video','Video',modeCount('video')],['voice','Voice',modeCount('voice')],['sfx','SFX',modeCount('sfx')],['music','Music',modeCount('music')]].filter(t=>t[0]==='all'||t[2]>0);
  const rows = pricingRows();
  root.innerHTML = `
    ${axInfo(`Every AI tool shows the subscriber a credit (✦) price. You manage the credit price here — margin is calculated automatically based on provider cost. Video price = seconds × credit. Current credit value: <b style="color:var(--text)">1 ✦ = ${bizUsd(creditUsd)}</b>.`,'info')}
    <div class="adx-tagrow">${tags.map(([k,l,n])=>`<button class="adx-tag ${PRICING_FILTER===k?'on':''}" onclick="PRICING_FILTER='${k}';renderPricing()">${l} <span class="n">${n}</span></button>`).join('')}</div>
    <div class="adx-card" style="overflow:hidden">
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:1080px">
        <thead><tr><th>Model</th><th>Type</th><th>Provider</th><th class="r">Provider cost</th><th class="r">Credit price (✦)</th><th class="r">Subscriber price</th><th class="r">Margin</th><th class="r">Action</th></tr></thead>
        <tbody>${rows.length ? rows.map(m=>{
          const rep = m.price.representative;
          const perSec = m.mode==='video' && (m.price.pricing==='per-second' || m.price.pricing==null);
          const cost = m.estCostUsd;
          // representative = TOTAL credit for default params (computeGenCost) → we compare totals.
          const subUsd = rep!=null ? rep*creditUsd : null;
          const marginPct = (subUsd!=null && cost!=null && subUsd>0) ? Math.round((subUsd - cost)/subUsd*100) : null;
          const costStr = cost!=null ? bizUsd(cost) : '—';
          const credStr = rep!=null ? '✦ '+rep : '—';
          const subStr = subUsd!=null ? bizUsd(subUsd) : '—';
          const perSecHint = perSec ? '<div style="font-size:9px;color:#5E6675">per second</div>' : '';
          return `<tr ${m.belowTarget?'style="background:rgba(255,107,94,.05)"':''}>
            <td style="color:var(--text);font-weight:600">${esc(m.label)}${m.belowTarget?' <i class="ph ph-warning" style="color:#FF6B5E;font-size:12px" title="Margin below target"></i>':''}</td>
            <td>${bizModeBadge(m.mode)}</td>
            <td style="font-size:11.5px;color:#B7C0CE">${esc(m.provider)}</td>
            <td class="r adx-num" style="color:#7CC4FF">${costStr}</td>
            <td class="r adx-num" style="color:var(--text)">${credStr}${perSecHint}</td>
            <td class="r adx-num">${subStr}</td>
            <td class="r adx-num" style="color:${bizMarginColor(marginPct)}">${marginPct!=null?marginPct+'%':'—'}</td>
            <td class="r"><button class="adx-iact" title="Edit price" onclick="openPriceEdit(${m.modelId})"><i class="ph ph-pencil-simple"></i></button></td>
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
  const cost = m.estCostUsd;
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
  const host = document.getElementById('bizEditPanel');
  host.innerHTML = `<div class="adx-editpanel"><div style="padding:16px 18px">
    <div style="display:flex;align-items:center;gap:8px"><i class="ph ph-currency-circle-dollar" style="color:#C2F04A"></i><span style="font-weight:700;font-size:13.5px">Credit value (USD)</span><span style="flex:1"></span><button class="adx-iact" onclick="document.getElementById('bizEditPanel').innerHTML=''"><i class="ph ph-x"></i></button></div>
    <div style="font-size:10.5px;color:#8A93A3;margin-top:6px;line-height:1.5">How many $ one credit (✦) is worth. All model margin calculations rely on this.</div>
    <div class="adx-flab" style="margin-top:12px">1 ✦ = $</div>
    <input class="adx-input mono" id="creditUsdVal" type="number" min="0.001" step="0.001" value="${cur}">
    <div style="display:flex;gap:8px;margin-top:12px"><button class="adx-btn2" style="flex:1;height:34px" onclick="document.getElementById('bizEditPanel').innerHTML=''">Cancel</button><button class="adx-btn" style="flex:1;height:34px" onclick="savePricingConfig()">Save</button></div>
  </div></div>`;
}

async function savePricingConfig(){
  const val = Number(document.getElementById('creditUsdVal')?.value);
  if(!(val>0)){ toast('Error','Enter a positive value','danger'); return; }
  try {
    await StudioApi.patchAdminPricingConfig({ creditUsdValue: val });
    document.getElementById('bizEditPanel').innerHTML='';
    toast('Saved','Credit value updated','success');
    await loadPricing();
  } catch(e){
    toast('Error', (e&&e.message)||'Failed to save', 'danger');
  }
}

/* ============================================================
   b1 · FINANCE — revenue vs provider cost + margin + payout
   ============================================================ */
let FINANCE_DATA = null;

VIEWS.finance = function(){ return `<div id="bizRoot">${bizLoading()}</div>`; };
window.afterRender.finance = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='finance') tba.innerHTML =
    `<span class="adx-sel"><i class="ph ph-clock-countdown" style="font-size:13px"></i><span>All time</span></span>`+
    `<button class="adx-btn2 sm" onclick="toast('Export','Preparing finance report CSV…','info')"><i class="ph ph-export"></i>Export</button>`;
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
  return `<div class="adx-donut" style="background:${grad}"><div class="hole"><span class="adx-num" style="font-size:16px;font-weight:600">${bizUsd(total)}</span><span style="font-size:9px;color:#8A93A3">total</span></div></div>`;
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
  // MRR — active Pro subscriptions × Pro monthly price (subscriber stats + plan price)
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
      ${axStat({label:'Monthly revenue (MRR)',val:bizUsd(mrr),ic:'trend-up',icColor:'#C2F04A',foot:`${sc.pro||0} Pro subscriptions`})}
      ${axStat({label:'Provider cost',val:bizUsd(providerCost),ic:'coins',icColor:'#7CC4FF',foot:'fal · vertex · elevenlabs'})}
      ${axStat({label:'Gross margin',val:grossMarginPct!=null?grossMarginPct+'%':'—',ic:'chart-bar',icColor:bizMarginColor(grossMarginPct),foot:bizUsd(net)+' net',footCls:net>=0?'adx-up':'adx-down'})}
      ${axStat({label:'Payout (pending)',val:bizUsdCents(d.payoutPendingCents),ic:'hand-coins',icColor:'#FFB27C',foot:'contributor payouts'})}
    </div>
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-top:16px" class="biz-fin-grid">
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Revenue vs cost</span><span style="flex:1"></span><span style="display:flex;gap:12px"><span style="display:flex;align-items:center;gap:5px;font-size:10.5px;color:#8A93A3"><span style="width:9px;height:9px;border-radius:3px;background:#C2F04A"></span>Revenue</span><span style="display:flex;align-items:center;gap:5px;font-size:10.5px;color:#8A93A3"><span style="width:9px;height:9px;border-radius:3px;background:#7CC4FF"></span>Cost</span></span></div>
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
    ${axInfo(`Templates are included in the subscription (unlimited downloads) — no automatic $ is calculated. Admin sees the download count and <b style="color:var(--text)">records payment manually</b>. The rate and formula (strict per-download or monthly pool share) is an <b style="color:var(--text)">OWNER DECISION</b>. Current rate: <b style="color:var(--text)">${bizUsdCents(perDl)} / download</b>.`,'amber')}
    <div class="adx-grid4" style="margin-bottom:16px">
      ${axStat({label:'Earning events',val:totalEvents.toLocaleString(),ic:'download-simple',icColor:'#C2F04A',foot:'TemplateDownloadEvent'})}
      ${axStat({label:'Ready for payout',val:pendingCount,ic:'users-three',foot:'contributor'})}
      ${axStat({label:'Unpaid balance',val:bizUsdCents(poolCents),ic:'hand-coins',icColor:'#FFB27C',foot:bizUsdCents(perDl)+' / download'})}
      ${axStat({label:'Paid (total)',val:bizUsdCents(paidCents),ic:'check-circle',icColor:'#C2F04A',foot:'recorded payouts'})}
    </div>
    <div class="adx-card" style="overflow:hidden"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Contributor earning → payout</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">RATE: ${bizUsdCents(perDl)} / DOWNLOAD</span></div>
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
}

function openPayoutRecord(contributorId){
  const r = (PAYOUT_DATA.contributors||[]).find(x=>x.contributorId===contributorId);
  if(!r) return;
  const host = document.getElementById('bizEditPanel');
  host.innerHTML = `<div class="adx-editpanel" style="width:340px"><div style="padding:18px 20px">
    <div style="display:flex;align-items:center;gap:8px"><i class="ph ph-hand-coins" style="color:#C2F04A"></i><span style="font-weight:700;font-size:13.5px">Record payout</span><span style="flex:1"></span><button class="adx-iact" onclick="document.getElementById('bizEditPanel').innerHTML=''"><i class="ph ph-x"></i></button></div>
    <div style="font-size:11.5px;color:#8A93A3;margin-top:6px;line-height:1.5">${esc(r.name||r.email||'')} — unpaid balance <b style="color:var(--text)">${bizUsdCents(r.balanceCents)}</b>. This is a manually entered payout record (ContributorPayout) — the money transfer happens outside the system. All unpaid earnings will be linked.</div>
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
