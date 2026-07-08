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

/** Pool preview line inside Finance — recalculates as the share slider moves. */
function financePoolPreview(){
  const d = FINANCE_DATA; if(!d) return;
  const share = Number(document.getElementById('poolShareKnob')?.value||0)/100;
  const providerCost = (d.providers||[]).reduce((a,p)=>a+p.estimatedUsd,0);
  const subNet = (d.poolBaseCents||0)/100; // obuna net − obuna refundlari (pool bazasi)
  const pool = Math.max(0, (subNet - providerCost) * share);
  const lbl = document.getElementById('poolShareLbl');
  const out = document.getElementById('poolShareOut');
  if(lbl) lbl.textContent = Math.round(share*100)+'%';
  if(out) out.innerHTML = `${bizUsd(pool)} <span style="font-size:10px;color:#8A93A3">= (${bizUsd(subNet)} subscription net − ${bizUsd(providerCost)} AI cost) × ${Math.round(share*100)}%</span>`;
}

function renderFinanceHtml(root, m){
  const {d,rev,providers,providerCost,grossUsd,netUsd,refundsUsd,grossMarginPct,netAfterAi,mrr,colors,maxBar}=m;
  const byKind = rev.byKind||{};
  const kindRow = (key,label)=>{ const k=byKind[key]; if(!k) return ''; return `<div style="display:flex;align-items:center;gap:7px;font-size:11.5px"><span style="color:#B7C0CE">${label}</span><span style="flex:1"></span><span class="adx-num" style="color:${(k.netCents||0)<0?'#FF6B5E':'#B7C0CE'}">${bizUsdCents(k.netCents)}</span><span class="adx-num" style="font-size:10px;color:#5E6675">${k.events}×</span></div>`; };
  const planRows = (rev.byPlan||[]).map(p=>`<div style="display:flex;align-items:center;gap:7px;font-size:11.5px">${axPlan(p.plan)}<span style="flex:1"></span><span class="adx-num" style="color:#C2F04A">${bizUsdCents(p.netCents)}</span><span class="adx-num" style="font-size:10px;color:#5E6675">${p.events}×</span></div>`).join('');
  const shareDefault = Math.round(((d.poolShare!=null?d.poolShare:0.5))*100);
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
  try { PAYOUT_DATA = await StudioApi.getAdminEarnings(); renderPayouts(); }
  catch(e){ if(root) root.innerHTML = bizErr(e && e.message); }
};

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
      <span>× share <b class="adx-num">${Math.round((p.poolShare||0)*100)}%</b></span>
      <span>= pool <b class="adx-num" style="color:#C2F04A">${bizUsdCents(p.poolCents)}</b></span>
      <span style="color:#8A93A3">${(p.totalLegitimateDownloads||0).toLocaleString()} legitimate downloads</span>
      ${p.persisted?`<span class="adx-bdg adx-bdg-approved">written: ${p.written}</span>`:''}
    </div>
    ${rows.length?`<table class="adx-tbl"><thead><tr><th>Contributor</th><th class="r">Legit downloads</th><th class="r">Share</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows.slice(0,50).map(r=>{
        const who = (PAYOUT_DATA&&(PAYOUT_DATA.contributors||[]).find(c=>c.contributorId===r.contributorId))||{};
        const sh = p.totalLegitimateDownloads>0?Math.round(r.downloads/p.totalLegitimateDownloads*1000)/10:0;
        return `<tr><td style="font-size:12px">${esc(who.name||who.email||r.contributorId)}</td><td class="r adx-num">${r.downloads.toLocaleString()}</td><td class="r adx-num">${sh}%</td><td class="r adx-num" style="color:#C2F04A">${bizUsdCents(r.amountCents)}</td></tr>`;
      }).join('')}</tbody></table>`:`<div style="font-size:11px;color:var(--muted2);padding:6px 0">No legitimate downloads in this period.</div>`}`;
}

function renderPayouts(){
  const root = document.getElementById('bizRoot');
  if(!root || !PAYOUT_DATA) return;
  const d = PAYOUT_DATA;
  const rows = (d.contributors||[]).slice().sort((a,b)=>(b.balanceCents||0)-(a.balanceCents||0));
  const perDl = (d.perDownloadCents||10);
  const isPool = d.payoutMode==='pool';
  const sharePct = Math.round(((d.poolShare!=null?d.poolShare:0.5))*100);
  const totalEvents = rows.reduce((a,r)=>a+(r.earningEvents||0),0);
  const pendingCount = rows.filter(r=>(r.balanceCents||0)>0).length;
  const poolCents = rows.reduce((a,r)=>a+(r.balanceCents||0),0);
  const paidCents = rows.reduce((a,r)=>a+Math.max(0,(r.totalEarnedCents||0)-(r.balanceCents||0)),0);
  root.innerHTML = `
    ${isPool
      ? axInfo(`<b style="color:var(--text)">POOL mode</b> (PAYOUT_MODE=pool): monthly pool = (subscription net revenue − AI provider cost) × <b style="color:var(--text)">${sharePct}%</b>, distributed by each contributor's share of legitimate downloads. Compute below writes the period earnings; the money transfer stays <b style="color:var(--text)">manual</b> (record payout per contributor). Switch back with PAYOUT_MODE=per_download.`,'info')
      : axInfo(`<b style="color:var(--text)">Per-download mode</b> (PAYOUT_MODE=per_download): every legitimate download accrues a flat <b style="color:var(--text)">${bizUsdCents(perDl)}</b>. The revenue-share POOL model is available with PAYOUT_MODE=pool. Payment is recorded manually.`,'amber')}
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
