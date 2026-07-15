/* ============================================================
   AssetFlow — Admin views (part 1): helpers, Overview, Moderation
   ============================================================ */
window.VIEWS = window.VIEWS || {};
window.afterRender = window.afterRender || {};

/* Skeleton list — prevents empty flicker until the API responds (catalog/AI history style).
   n = row count; av = show avatar/thumb block on the left. */
window.adxSkelList = function (n, av) {
  n = n || 5;
  var rows = "";
  for (var i = 0; i < n; i++) {
    rows +=
      '<div class="adx-skel-row">' +
      (av === false ? "" : '<span class="adx-skel adx-skel-av"></span>') +
      '<div style="flex:1;min-width:0"><span class="adx-skel adx-skel-ln" style="display:block;width:' +
      (52 - (i % 3) * 8) + '%;margin-bottom:8px"></span>' +
      '<span class="adx-skel adx-skel-ln" style="display:block;width:' + (30 + (i % 2) * 8) + '%"></span></div>' +
      '<span class="adx-skel adx-skel-ln" style="width:48px"></span>' +
      "</div>";
  }
  return '<div class="adx-skel-list">' + rows + "</div>";
};

/* ---------- shared building blocks ---------- */
function thumbArt(grad, dur, size){
  const h = size==='lg'?'100%':'30px';
  return `<div class="thumb ${grad} grain" style="width:100%;height:${h}">
    <div class="play"><span>${ic('play')}</span></div>
    ${dur?`<span class="dur">${dur}</span>`:''}
  </div>`;
}
function kpiCard(o){
  return `<div class="kpi">
    <div class="kpi-top">
      <div class="kpi-ico" style="background:var(--${o.c}-dim);color:var(--${o.c})">${ic(o.ic)}</div>
      <span class="kpi-label">${o.label}</span>
    </div>
    <div class="kpi-val">${o.val}</div>
    <div class="kpi-foot">
      ${o.trend!=null?`<span class="trend ${o.trend>0?'up':'down'}">${ic(o.trend>0?'trendUp':'trendDn')}${Math.abs(o.trend)}%</span>`:''}
      <span>${o.foot||''}</span>
    </div>
  </div>`;
}
function infoBanner(text, kind){
  return `<div class="info-banner ${kind||''}">${ic('ext')}<span>${text}</span></div>`;
}

/* ============================================================
   Umumiy adx- yordamchilar (5b/5c/Biznes ekranlari uchun) —
   maket komponentlariga (av/stat/badge/banner) 1:1.
   ============================================================ */
var AX_G = ["adx-g1","adx-g2","adx-g3","adx-g4","adx-g5","adx-g6","adx-g7","adx-g8"];
function axGrad(seed){
  var h=0,s=String(seed||"");
  for(var i=0;i<s.length;i++) h=s.charCodeAt(i)+((h<<5)-h);
  return AX_G[Math.abs(h)%AX_G.length];
}
function axInit(name){ return initialsOf(name); }
/** Avatar (gradient fon) — size px. */
function axAv(name, seed, size){
  var sz = size||30;
  return '<span class="adx-av '+axGrad(seed||name)+'" style="width:'+sz+'px;height:'+sz+'px;'+(sz<=26?'font-size:9px':sz>=48?'font-size:16px':'')+'">'+esc(axInit(name))+'</span>';
}
/** Info banner — kind: 'info'(ko'k) | 'lime' | 'amber' | 'red'. */
function axInfo(html, kind){
  var m = {
    info:  ['var(--seldim)','rgba(124,196,255,.22)','#7CC4FF','ph-info'],
    lime:  ['var(--limedim)','rgba(194,240,74,.22)','#C2F04A','ph-info'],
    amber: ['var(--amberdim)','rgba(255,178,124,.22)','#FFB27C','ph-warning'],
    red:   ['var(--reddim)','rgba(255,107,94,.25)','#FF6B5E','ph-warning'],
  }[kind||'info'];
  return '<div style="display:flex;align-items:center;gap:9px;padding:10px 13px;background:'+m[0]+';border:1px solid '+m[1]+';border-radius:11px;margin-bottom:16px">'+
    '<i class="ph '+m[3]+'" style="color:'+m[2]+';font-size:16px;flex:none"></i>'+
    '<span style="font-size:11.5px;color:#B7C0CE;line-height:1.5">'+html+'</span></div>';
}
/** Stat karta (maket .stat). o: {label,val,foot,ic,icColor,trend('up'|'down'),footCls}. */
function axStat(o){
  var icon = o.ic ? '<i class="ph ph-'+o.ic+'"'+(o.icColor?' style="color:'+o.icColor+'"':'')+'></i>' : '';
  var foot = o.foot ? '<div class="sf'+(o.footCls?' '+o.footCls:'')+'">'+(o.footIco?'<i class="ph '+o.footIco+'"></i>':'')+esc(o.foot)+'</div>' : '';
  return '<div class="adx-stat"><div class="sl">'+icon+esc(o.label)+'</div><div class="sv">'+o.val+'</div>'+foot+'</div>';
}
/** Plan (PRO/FREE) badge. */
function axPlan(plan){
  var label = (typeof normalizePlanLabel==='function') ? normalizePlanLabel(plan) : String(plan||'Free');
  return label==='Pro'
    ? '<span class="adx-bdg adx-bdg-pro">PRO</span>'
    : '<span class="adx-bdg adx-bdg-free">FREE</span>';
}
/** Subscriber/contributor status badge (active/blocked/removed). */
function axStatus(status){
  if(status==='active')  return '<span class="adx-bdg adx-bdg-active"><span class="bd"></span>Active</span>';
  if(status==='blocked') return '<span class="adx-bdg adx-bdg-blocked"><span class="bd"></span>Blocked</span>';
  if(status==='removed') return '<span class="adx-bdg adx-bdg-removed"><span class="bd"></span>Removed</span>';
  return '<span class="adx-bdg adx-bdg-draft"><span class="bd"></span>'+esc(status||'')+'</span>';
}
/** Template status badge (mockup bdg-*). short = abbreviated label. */
function axTplStatus(status, short){
  var m = {
    approved:['adx-bdg-approved', short?'Appr.':'Approved'],
    pending: ['adx-bdg-pending',  short?'Pend.':'Pending'],
    soft:    ['adx-bdg-soft','Soft'],
    hard:    ['adx-bdg-hard','Hard'],
    draft:   ['adx-bdg-draft','Draft'],
    archived:['adx-bdg-removed','Archived'],
  }[status] || ['adx-bdg-draft', status||''];
  return '<span class="adx-bdg '+m[0]+'"><span class="bd"></span>'+esc(m[1])+'</span>';
}
/** Raqamni qisqartir (12480 → 12.5K). */
function axNum(n){
  n = Number(n)||0;
  return n>=1000 ? (n/1000).toFixed(1).replace(/\.0$/,'')+'K' : String(n);
}

/* ============================================================
   OVERVIEW
   ============================================================ */
VIEWS.overview = function(){
  const c = counts();
  const usage = typeof window !== "undefined" ? window._ASSETFLOW_PLUGIN_ANALYTICS?.usage : null;
  const totalDlDisplay = usage?.downloadsTotal ?? c.totalDl;
  const catDist = buildCatDist();
  const apprPct =
    typeof platformApprovalRatePct === "function" ? platformApprovalRatePct() : null;
  const kpis = [
    {label:'Total templates', val:c.total, ic:'layers', c:'violet', foot:'all statuses'},
    {label:'Approved (AE live)', val:c.approved, ic:'checkCircle', c:'green', foot:'visible in plugin'},
    {label:'Pending moderation', val:c.pending, ic:'clock', c:'yellow', foot:'in queue'},
    {label:'Contributors', val:c.contributors, ic:'users', c:'blue', foot:`${c.blocked} blocked`},
    {label:'AE subscribers', val:c.subscribersActive, ic:'plugin', c:'violet', foot:`${c.subscribers} total · Browse`},
    {label:'Total downloads', val:totalDlDisplay >= 1000 ? (totalDlDisplay/1000).toFixed(1)+'K' : String(totalDlDisplay), ic:'download', c:'green', foot:'plugin count'},
    ...(apprPct != null
      ? [{ label: "Approval rate", val: `${apprPct}%`, ic: "star", c: "yellow", foot: "decided templates" }]
      : []),
  ];
  return `
  <div class="col gap-20">
    ${infoBanner('Approved templates automatically appear for subscribers in the After Effects \u2192 <b>FrameFlow Browse</b> panel.')}

    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      ${kpis.map(kpiCard).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1.7fr 1fr;gap:20px">
      <!-- downloads chart -->
      <div class="card">
        <div class="card-head">
          <div><h3>Platform activity</h3><span class="small">Audit log · last 30 days</span></div>
          <div class="segmented"><button data-r="7">7 days</button><button class="active" data-r="30">30 days</button></div>
        </div>
        <div class="card-pad">
          <div class="row between center mb-16">
            <div class="col" style="gap:2px">
              <span class="num" style="font-size:28px;font-weight:700">${totalDlDisplay >= 1000 ? (totalDlDisplay/1000).toFixed(1)+'K' : totalDlDisplay}</span>
              <span class="small">plugin downloads · audit chart is separate</span>
            </div>
          </div>
          <div id="ovChart" style="height:170px"></div>
        </div>
      </div>

      <!-- category donut -->
      <div class="card">
        <div class="card-head"><h3>Category breakdown</h3></div>
        <div class="card-pad row gap-20 center">
          <div style="position:relative;flex:0 0 auto">
            ${donut(catDist, 140)}
            <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center">
              <div><div class="num" style="font-size:22px;font-weight:700">${counts().total}</div><div class="small">templates</div></div>
            </div>
          </div>
          <div class="donut-legend grow">
            ${catDist.map(s=>`<div class="leg-item"><span class="sw" style="background:${s.color}"></span><span class="nm">${s.nm}</span><span class="vl">${Math.round(s.v*100)}%</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:20px">
      <!-- top templates -->
      <div class="card">
        <div class="card-head"><div><h3>TOP downloads</h3><span class="small">Most popular templates</span></div><button class="btn btn-subtle btn-sm" onclick="route('analytics')">View all ${ic('chevR')}</button></div>
        <div class="card-pad col gap-4">
          ${(() => {
            const top = topTemplates();
            if (!top.length) return '<div class="empty" style="padding:24px"><p class="small">No approved templates yet</p></div>';
            const max = top[0].dl || 1;
            return top.slice(0, 5).map((t, i) => `
            <div class="leader-row">
              <span class="leader-rank">${i + 1}</span>
              <div class="row-thumb"><div class="thumb ${t.grad} grain" style="width:100%;height:100%"></div></div>
              <div class="col grow" style="gap:3px;min-width:0">
                <span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</span>
                <div class="leader-bar"><span style="width:${(t.dl / max) * 100}%"></span></div>
              </div>
              <span class="num" style="font-weight:700;white-space:nowrap">${t.dl >= 1000 ? (t.dl / 1000).toFixed(1) + "K" : t.dl}</span>
            </div>`).join("");
          })()}
        </div>
      </div>
    </div>
  </div>`;
};
window.afterRender.overview = function(){
  const el = document.getElementById('ovChart');
  const max = typeof chartMax === "function" ? chartMax(DL_30) : 1;
  if (el) {
    if (max <= 1 && !DL_30.some((v) => v > 0)) {
      el.innerHTML =
        '<div class="empty" style="padding:32px 0"><p class="small">No audit events yet</p></div>';
    } else {
      el.innerHTML = areaChart(DL_30, 600, 170, "#8b7cf6");
    }
  }
  let active = 30;
  document.querySelectorAll('#ovChart').length;
  document.querySelectorAll('.segmented button[data-r]').forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll('.segmented button[data-r]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      el.innerHTML = areaChart(b.dataset.r==='7'?DL_7:DL_30, 600, 170, '#8b7cf6');
    };
  });
};

/* ============================================================
   MODERATION QUEUE \u2014 redesign port (mockup e2): two panels
   left: filterable queue list \u00b7 right: detail + decision panel.
   Logic preserved: modApprove/modSoftReject/modHardReject/modDelete/
   openEditMeta/openMessage/bulkAction \u2014 existing handlers.
   ============================================================ */
let MOD_SELECTED = null;
let MOD_FILTER = 'pending';
let MOD_CHECKED = new Set();
let MOD_CAT = 'all';
let MOD_SORT = 'new';
// P1 (step 32 / P5.4) — 200 klipli navbat uchun tur (taksonomiya pill) + contributor filtri.
let MOD_TYPE = 'all';
let MOD_CON = 'all';

VIEWS.moderation = function(){
  return `<div id="modRoot" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>`;
};
window.afterRender.moderation = function(){
  // Real API moderation queue
  if (typeof StudioTemplates !== "undefined" && StudioTemplates.loadModerationOnly) {
    // Skeleton until the data arrives (Render cold-start can take ~50s — avoid an empty flash).
    if (!(typeof TEMPLATES !== "undefined" && TEMPLATES.length)) {
      var mr = document.getElementById("modRoot");
      if (mr) mr.innerHTML = '<div style="padding:8px 4px">' + adxSkelList(5) + "</div>";
    }
    // Audit §C (P1) — Soft/All filtrida scope=all yuklanadi (loadModerationOnly faqat
    // pending'ni oladi — Moderation'ga to'g'ridan kirilganda Soft/All 0/stale chiqardi).
    const loader = (MOD_FILTER === "soft" || MOD_FILTER === "all") && StudioTemplates.ensureFullCatalog
      ? StudioTemplates.ensureFullCatalog
      : StudioTemplates.loadModerationOnly;
    loader()
      .catch((e) => {
        console.warn("moderation load", e);
        if (typeof toast === "function") toast("API", e.message || "Failed to load data", "warn");
      })
      .finally(() => renderModeration());
    return;
  }
  renderModeration();
};

function modQueueItems(){
  let items;
  if(MOD_FILTER==='new') items = tByStatus('pending').filter(t=>t.isNew);
  else if(MOD_FILTER==='all') items = TEMPLATES.filter(t=>['pending','soft','hard'].includes(t.status));
  else items = tByStatus(MOD_FILTER);
  if(MOD_CAT!=='all') items = items.filter(t=>t.cat===MOD_CAT);
  // P5.4 — tur (taksonomiya pill: video-templates|luts|graphics|motion-graphics|music|sfx)
  if(MOD_TYPE!=='all') items = items.filter(t=>(t.templateType||'video-templates')===MOD_TYPE);
  // P5.4 — contributor bo'yicha (cid = contributor id)
  if(MOD_CON!=='all') items = items.filter(t=>(t.cid||(t._con&&t._con.id))===MOD_CON);
  return items.slice().sort((a,b)=> MOD_SORT==='new'
    ? String(b.created||'').localeCompare(String(a.created||''))
    : String(a.created||'').localeCompare(String(b.created||'')));
}

/** Navbatdagi contributor'lar ro'yxati (filter selecti uchun) — {id, name}. */
function modContributors(){
  const seen = new Map();
  for(const t of TEMPLATES){
    if(!['pending','soft','hard'].includes(t.status)) continue;
    const id = t.cid || (t._con && t._con.id);
    if(!id || seen.has(id)) continue;
    const c = t._con || (typeof cById==='function' ? cById(id) : null);
    seen.set(id, (c && (c.name||c.email)) || id);
  }
  return [...seen.entries()].map(([id,name])=>({id,name}));
}

/* mockup g1\u2013g8 thumb gradient (app.css g9/g10 \u2192 wraps to 1/2) */
function adxModGrad(grad){
  const n = parseInt(String(grad||'g1').replace('g',''),10) || 1;
  return 'adx-g' + (((n-1)%8)+1);
}
function adxModThumb(t){
  const hasMedia = typeof StudioMedia!=='undefined' && StudioMedia.hasAsset &&
    (StudioMedia.hasAsset(t,'thumb') || StudioMedia.hasAsset(t,'preview'));
  if(hasMedia) return StudioMedia.renderThumb(t,'lg');
  return `<span class="${adxModGrad(t.grad)}" style="display:block;width:100%;height:100%"></span>`;
}
function adxModStatusBdg(status, short){
  if(status==='pending') return `<span class="adx-bdg adx-bdg-pending"><span class="bd"></span>${short?'Pend.':'Pending'}</span>`;
  if(status==='soft') return `<span class="adx-bdg adx-bdg-soft"><span class="bd"></span>Soft</span>`;
  if(status==='hard') return `<span class="adx-bdg adx-bdg-hard"><span class="bd"></span>Hard</span>`;
  if(status==='approved') return `<span class="adx-bdg adx-bdg-approved"><span class="bd"></span>Approved</span>`;
  return `<span class="adx-bdg adx-bdg-draft"><span class="bd"></span>${esc(status||'')}</span>`;
}

/* Pack xavfsizlik skani (Bosqich 2 #2) — approve nega bloklanganini ko'rsatadi.
   hard=true (malicious/duplicate) → Clear pack ISHLAMAYDI (o'chirib qayta yuklash);
   hard=false (quarantined/pending) → admin "Clear pack" bilan qo'lda ochishi mumkin. */
function adxPackScanInfo(s){
  if(s==='malicious')   return {t:'hard', lab:'Malware', msg:'The malware scan flagged this pack as malicious — it cannot be approved. Delete and re-upload.', hard:true};
  if(s==='duplicate')   return {t:'hard', lab:'Duplicate', msg:'This pack is identical to another contributor’s template (anti-theft) — it cannot be approved. Delete and re-upload.', hard:true};
  if(s==='quarantined') return {t:'warn', lab:'Quarantined', msg:'The security check was inconclusive and needs a manual review. If you trust this pack, click “Clear pack” to unblock approval.', hard:false};
  if(s==='pending')     return {t:'warn', lab:'Scan pending', msg:'The security scan hasn’t finished. Approving will resolve it on demand; if it stays stuck, click “Clear pack” to unblock.', hard:false};
  return null;
}

/* Skan holati banneri (moderatsiya detali) — problemali status bo'lsagina chiqadi. */
function adxPackScanBanner(t){
  const info = adxPackScanInfo(t && t.packScanStatus);
  if(!info) return '';
  const isHard = info.t==='hard';
  const bg = isHard?'var(--reddim)':'var(--amberdim)';
  const bd = isHard?'rgba(255,107,94,.3)':'rgba(255,178,124,.32)';
  const fg = isHard?'#FF6B5E':'#FFB27C';
  const detail = (t.packScanDetail && String(t.packScanDetail).trim()) ? `<div style="font-size:11px;color:#8A93A3;margin-top:4px">${esc(t.packScanDetail)}</div>` : '';
  return `<div style="margin-top:16px;background:${bg};border:1px solid ${bd};border-radius:11px;padding:10px 12px">
    <div class="adx-flab" style="margin:0;color:${fg};display:flex;align-items:center;gap:6px"><i class="ph ph-shield-warning"></i>SECURITY: ${esc(info.lab.toUpperCase())}</div>
    <div style="font-size:12px;color:#B7C0CE;margin-top:4px;line-height:1.55">${esc(info.msg)}</div>${detail}</div>`;
}

/* "Clear pack (security)" tugmasi — faqat qo'lda ochsa bo'ladigan holatda (pending/quarantined). */
function adxPackClearBtn(t, cls){
  const info = adxPackScanInfo(t && t.packScanStatus);
  if(!info || info.hard) return '';
  return `<button class="${cls||'adx-btn2 adx-btn-warn'}" onclick="modClearPack('${t.id}')"><i class="ph ph-shield-check"></i>Clear pack (security)</button>`;
}

/* Topbar actions \u2014 category + date sort (mockup e2 topbar) */
function modTopbarActions(){
  const tba = document.getElementById('tbActions');
  if(!tba || (typeof CURRENT!=='undefined' && CURRENT!=='moderation')) return;
  // P5.4 \u2014 tur (taksonomiya pill) yorliqlari (UPLOAD_TAXONOMY data.js'dan)
  const typeList = (typeof UPLOAD_TAXONOMY!=='undefined') ? UPLOAD_TAXONOMY : [];
  const typeLabel = MOD_TYPE==='all' ? 'All types' : ((typeList.find(x=>x.key===MOD_TYPE)||{}).label || MOD_TYPE);
  const cons = modContributors();
  const conLabel = MOD_CON==='all' ? 'All contributors' : ((cons.find(c=>c.id===MOD_CON)||{}).name || 'Contributor');
  tba.innerHTML = `
    <label class="adx-sel"><i class="ph ph-stack" style="font-size:13px"></i><span>${esc(typeLabel)}</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i>
      <select onchange="setModType(this.value)">
        <option value="all" ${MOD_TYPE==='all'?'selected':''}>All types</option>
        ${typeList.map(x=>`<option value="${esc(x.key)}" ${MOD_TYPE===x.key?'selected':''}>${esc(x.label)}</option>`).join('')}
      </select></label>
    <label class="adx-sel"><i class="ph ph-user" style="font-size:13px"></i><span>${esc(conLabel)}</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i>
      <select onchange="setModCon(this.value)">
        <option value="all" ${MOD_CON==='all'?'selected':''}>All contributors</option>
        ${cons.map(c=>`<option value="${esc(c.id)}" ${MOD_CON===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
      </select></label>
    <label class="adx-sel"><i class="ph ph-sort-descending" style="font-size:13px"></i><span>${MOD_SORT==='new'?'Date: Newest \u2192 oldest':'Date: Oldest \u2192 newest'}</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i>
      <select onchange="setModSort(this.value)">
        <option value="new" ${MOD_SORT==='new'?'selected':''}>Date: Newest \u2192 oldest</option>
        <option value="old" ${MOD_SORT==='old'?'selected':''}>Oldest \u2192 newest</option>
      </select></label>`;
}
function setModType(v){ MOD_TYPE=v; MOD_SELECTED=null; MOD_CHECKED=new Set(); renderModeration(); }
function setModCon(v){ MOD_CON=v; MOD_SELECTED=null; MOD_CHECKED=new Set(); renderModeration(); }
window.setModType = setModType; window.setModCon = setModCon;

function renderModeration(){
  const items = modQueueItems();
  if(MOD_SELECTED===null && items.length) MOD_SELECTED = items[0].id;
  const sel = TEMPLATES.find(t=>t.id===MOD_SELECTED);

  modTopbarActions();
  if (typeof renderNav === 'function') renderNav(); // refresh badge/bell (after approve/reject)

  const tagRow = [['pending','Pending'],['new','New only'],['soft','Soft'],['all','All']].map(([k,l])=>{
    const n = k==='new'?tByStatus('pending').filter(t=>t.isNew).length : k==='all'?TEMPLATES.filter(t=>['pending','soft','hard'].includes(t.status)).length : tByStatus(k).length;
    return `<button class="adx-tag ${MOD_FILTER===k?'on':''}" onclick="setModFilter('${k}')">${l} <span class="n">${n}</span></button>`;
  }).join('');

  // Select-all faqat joriy ko'rinadigan navbat elementlariga ta'sir qiladi.
  const allChecked = items.length>0 && items.every(t=>MOD_CHECKED.has(t.id));

  const root = document.getElementById('modRoot');
  if(!root) return;
  root.innerHTML = `
    ${MOD_CHECKED.size?`<div class="adx-bulkbar">
      <span class="adx-bdg adx-bdg-info">${MOD_CHECKED.size} selected</span>
      <span style="font-size:11.5px;color:var(--muted)">Bulk action:</span>
      <span style="flex:1"></span>
      <button class="adx-btn adx-btn-ok sm" onclick="bulkAction('approve-free')"><i class="ph ph-check"></i>Approve · Free</button>
      <button class="adx-btn adx-btn-ok sm" onclick="bulkAction('approve-pro')"><i class="ph ph-crown-simple"></i>Approve · Pro</button>
      <button class="adx-btn2 adx-btn-warn sm" onclick="bulkAction('reject')"><i class="ph ph-arrow-u-up-left"></i>Reject</button>
      <button class="adx-btn2 sm" onclick="bulkAction('clear-pack')"><i class="ph ph-shield-check"></i>Clear pack</button>
      <button class="adx-btn2 sm" onclick="MOD_CHECKED.clear();renderModeration()">Cancel</button>
    </div>`:items.length?`<div class="adx-bulkbar" style="color:var(--muted)"><i class="ph ph-cursor-click" style="font-size:13px"></i><span style="font-size:11.5px">Tip: select items (or Select all) to bulk Approve / Reject / Clear pack.</span></div>`:''}
    <div class="adx-modwrap">
      <!-- list panel -->
      <div class="adx-modlist">
        <div class="adx-modtags">${tagRow}</div>
        ${items.length?`<div class="adx-modselall" onclick="toggleCheckAll()"><span class="adx-modcheck ${allChecked?'on':''}"><i class="ph-bold ph-check"></i></span><span style="font-size:11px;color:var(--muted)">${allChecked?'Deselect all':'Select all'} (${items.length})</span></div>`:''}
        <div class="adx-modscroll">
          ${items.length? items.map(t=>{
            const con = t._con || cById(t.cid) || { name: "Contributor", email: "" };
            const isSel = t.id===MOD_SELECTED;
            const checked = MOD_CHECKED.has(t.id);
            const meta = [con.name, t.cat, t.res].filter(Boolean).join(' \u00b7 ');
            return `<div class="adx-moditem ${isSel?'sel':''}" onclick="selectMod('${t.id}')">
              <span class="adx-modcheck ${checked?'on':''}" onclick="event.stopPropagation();toggleCheck('${t.id}')"><i class="ph-bold ph-check"></i></span>
              <span class="adx-modthumb">${adxModThumb(t)}</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</div>
                <div style="font-size:10.5px;color:#8A93A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meta)}</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex:none">
                ${t.isNew?'<span class="adx-bdg adx-bdg-info">New</span>':''}
                ${adxModStatusBdg(t.status, true)}
              </div>
            </div>`;
          }).join('') : `<div class="adx-empty" style="margin:14px 4px"><span class="ei"><i class="ph ph-check-circle"></i></span><div style="font-weight:600;font-size:13px">Queue is empty</div><div style="font-size:11px;color:var(--muted2);line-height:1.5">No templates to review in this filter.</div></div>`}
        </div>
      </div>
      <!-- detail panel -->
      <div id="modDetail" class="adx-moddetail"></div>
    </div>`;

  renderModDetail(sel);
}

function adxFileChips(t){
  if(typeof StudioMedia==='undefined') return '';
  const chips = [];
  if (t.assets?.pack || t.fileName) {
    chips.push(`<a class="adx-filechip" href="${StudioMedia.escapeAttr(t.packUrl || StudioMedia.assetUrl(t.id,'pack'))}" target="_blank" rel="noopener">${StudioMedia.escapeHtml(t.fileName || 'pack')}${t.size?' '+StudioMedia.escapeHtml(t.size):''}</a>`);
  }
  if (t.assets?.preview || t.previewUrl) {
    chips.push(`<a class="adx-filechip" href="${StudioMedia.escapeAttr(t.previewUrl || StudioMedia.assetUrl(t.id,'preview'))}" target="_blank" rel="noopener">preview${t.dur?' '+StudioMedia.escapeHtml(t.dur):''}</a>`);
  }
  if (t.assets?.thumb || t.thumbUrl) {
    chips.push(`<a class="adx-filechip" href="${StudioMedia.escapeAttr(t.thumbUrl || StudioMedia.assetUrl(t.id,'thumb'))}" target="_blank" rel="noopener">thumb</a>`);
  }
  if(!chips.length) chips.push(`<span style="font-size:11px;color:var(--amber)">No files uploaded</span>`);
  return chips.join('');
}

/** P5.4 — ffprobe spec metaboxlari (t._api xom qatoridan). Faqat NULL bo'lmagan qatorlar
 *  chiqadi (eski shablonlar bo'sh). Reja: Length/Resolution/FPS/Alpha/Looped/Codec/Orientation. */
function adxSpecBoxes(t){
  const a = (t && t._api) || {};
  const box = (lab, val) => `<div class="adx-metabox"><div class="adx-flab" style="margin:0">${lab}</div><div style="font-size:12px;color:#B7C0CE">${esc(val)}</div></div>`;
  const out = [];
  if(a.width && a.height) out.push(box('DIMENSIONS', `${a.width} × ${a.height}`));
  if(a.durationSec!=null && a.durationSec>0){ const s=Math.round(a.durationSec); out.push(box('LENGTH', `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`)); }
  if(a.fps) out.push(box('FRAME RATE', `${a.fps} fps`));
  if(a.hasAlpha!=null) out.push(box('ALPHA', a.hasAlpha?'Yes':'No'));
  if(a.looped!=null) out.push(box('LOOPED', a.looped?'Yes':'No'));
  if(a.videoCodec) out.push(box('VIDEO CODEC', String(a.videoCodec).toUpperCase()));
  if(a.audioCodec){ const parts=[String(a.audioCodec).toUpperCase()]; if(a.sampleRate) parts.push(`${Math.round(a.sampleRate/1000)} kHz`); if(a.audioBitrate) parts.push(`${Math.round(a.audioBitrate/1000)} kbps`); out.push(box('AUDIO', parts.join(' · '))); }
  if(Array.isArray(a.orientations) && a.orientations.length>1) out.push(box('ORIENTATIONS', a.orientations.join(' + ')));
  return out.join('');
}

function renderModDetail(t){
  const host = document.getElementById('modDetail');
  if(!host) return;
  if(!t){ host.innerHTML = `<div class="adx-empty" style="max-width:420px;margin:40px auto"><span class="ei"><i class="ph ph-shield-check"></i></span><div style="font-weight:600;font-size:13px">No template selected</div><div style="font-size:11px;color:var(--muted2);line-height:1.5">Select an item from the queue on the left.</div></div>`; return; }
  const con = t._con || cById(t.cid) || { name: "Contributor", email: "" };
  const items = modQueueItems();
  const idx = items.findIndex(x=>x.id===t.id);
  const shortId = t.id.length>10 ? t.id.slice(0,4)+'\u2026'+t.id.slice(-4) : t.id;
  const preview = typeof StudioMedia!=='undefined'
    ? StudioMedia.renderPreview(t,{aspect:'300/190'})
    : `<span class="${adxModGrad(t.grad)}" style="display:block;width:100%;height:100%"></span>`;
  host.innerHTML = `
    <div style="display:flex;gap:20px;flex-wrap:wrap">
      <div class="adx-prevbox">${preview}</div>
      <div style="flex:1;min-width:260px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0"><div class="adx-h18">${esc(t.name)}</div><div style="font-size:12px;color:#8A93A3;margin-top:3px">${esc(t.cat)} \u00b7 ${esc(typeof kindTypeLabel==='function'?kindTypeLabel(t):'After Effects')}</div></div>
          ${adxModStatusBdg(t.status)}
          ${t.isNew?'<span class="adx-bdg adx-bdg-info">New</span>':''}
        </div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">${adxFileChips(t)}</div>
        <div style="display:flex;align-items:center;gap:9px;margin-top:14px;padding:10px 12px;background:var(--surface);border:1px solid rgba(255,255,255,.07);border-radius:11px">
          <span class="adx-av ${adxModGrad(t.grad)}" style="width:34px;height:34px">${esc(initialsOf(con.name))}</span>
          <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12px">${esc(con.name)}</div><div style="font-size:10.5px;color:#8A93A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(con.email||'')}</div></div>
          <button class="adx-btn2 sm" onclick="route('contributor-detail','${t.cid}')"><i class="ph ph-user"></i>Profile</button>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px">
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">ID</div><div class="adx-mono" style="font-size:11px;color:#B7C0CE" title="${esc(t.id)}">${esc(shortId)}</div></div>
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">KIND</div><div style="font-size:12px;color:#B7C0CE">${esc(typeof kindTypeLabel==='function'?kindTypeLabel(t):'Template')}</div></div>
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">CATEGORY</div><div style="font-size:12px;color:#B7C0CE">${esc(t.cat)}</div></div>
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">RESOLUTION</div><div style="font-size:12px;color:#B7C0CE">${esc(t.res)}</div></div>
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">ORIENTATION</div><div style="font-size:12px;color:#B7C0CE">${esc(t.orient)}</div></div>
      ${adxSpecBoxes(t)}
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">FILE SIZE</div><div style="font-size:12px;color:#B7C0CE">${esc(t.size||'\u2014')}</div></div>
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">UPLOADED</div><div class="adx-mono" style="font-size:11px;color:#B7C0CE">${esc(t.created||'\u2014')}</div></div>
    </div>
    <div style="margin-top:16px"><div class="adx-flab">DESCRIPTION</div><div style="font-size:12.5px;color:#B7C0CE;line-height:1.6">${esc(t.desc)}</div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${(t.tags||[]).map(tag=>`<span class="adx-tagpill">${esc(tag)}</span>`).join('')}</div></div>
    ${t.aiSource==='ai'||t.templateType==='ai-stock'?`<div style="margin-top:16px;background:var(--limedim,rgba(194,240,74,.08));border:1px solid rgba(194,240,74,.28);border-radius:11px;padding:10px 12px">
      <div class="adx-flab" style="margin:0;color:#C2F04A;display:flex;align-items:center;gap:6px"><i class="ph ph-sparkle"></i>AI GENERATION PROMPT</div>
      <div style="font-size:12px;color:#B7C0CE;margin-top:5px;line-height:1.55">${t.aiPrompt?esc(t.aiPrompt):'<span style="color:#8A93A3">(no prompt captured)</span>'}</div></div>`:''}
    ${t.reason?`<div style="margin-top:16px;background:${t.status==='hard'?'var(--reddim)':'var(--amberdim)'};border:1px solid ${t.status==='hard'?'rgba(255,107,94,.3)':'rgba(255,178,124,.32)'};border-radius:11px;padding:10px 12px">
      <div class="adx-flab" style="margin:0;color:${t.status==='hard'?'#FF6B5E':'#FFB27C'}">PREVIOUS DECISION REASON</div>
      <div style="font-size:12px;color:#B7C0CE;margin-top:4px;line-height:1.55">${esc(t.reason)}</div></div>`:''}
    ${adxPackScanBanner(t)}
    <!-- decision panel -->
    <div class="adx-decide">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><i class="ph ph-gavel" style="color:#C2F04A;font-size:16px"></i><span class="adx-h16" style="font-size:14px">Decision panel</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="adx-btn adx-btn-ok" onclick="modApprove('${t.id}')"><i class="ph ph-check-circle"></i>Approve \u2014 publish in AE</button>
        <button class="adx-btn2 adx-btn-warn" onclick="modSoftReject('${t.id}')"><i class="ph ph-arrow-u-up-left"></i>Soft reject</button>
        <button class="adx-btn-danger adx-btn-dghost" onclick="modHardReject('${t.id}')"><i class="ph ph-prohibit"></i>Hard reject</button>
        ${adxPackClearBtn(t, 'adx-btn2 adx-btn-warn')}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--hair2)">
        <button class="adx-btn2 sm" onclick="openEditMeta('${t.id}')"><i class="ph ph-pencil-simple"></i>Edit metadata (admin override)</button>
        <button class="adx-btn2 sm" onclick="openMessage('${con.id}','${t.id}')"><i class="ph ph-chat-circle"></i>Message contributor</button>
        <button class="adx-btn2 sm adx-btn-dghost" onclick="modDelete('${t.id}')"><i class="ph ph-trash"></i>Delete template</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:16px">
      <button class="adx-btn2 sm" onclick="navMod(-1)"><i class="ph ph-caret-left"></i>Previous</button>
      <span class="adx-mono" style="font-size:11px;color:#8A93A3">${idx+1} / ${items.length}</span>
      <button class="adx-btn2 sm" onclick="navMod(1)">Next<i class="ph ph-caret-right"></i></button>
    </div>`;
}

function initialsOf(name){
  return String(name||'').trim().split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,2) || '?';
}

function setModFilter(f){
  MOD_FILTER=f; MOD_SELECTED=null;
  if (typeof StudioTemplates !== "undefined") {
    // Audit §C (P1) — Soft/All rad etilganlarni scope=all bilan oladi (avval bu
    // filtrlar hech qachon yangilanmasdan bo'sh/stale ma'lumot ko'rsatardi).
    const loader = (f === "soft" || f === "all") ? StudioTemplates.ensureFullCatalog : StudioTemplates.loadModerationOnly;
    if (loader) {
      loader().finally(() => renderModeration());
      return;
    }
  }
  renderModeration();
}
function setModCat(v){ MOD_CAT=v||'all'; renderModeration(); }
function setModSort(v){ MOD_SORT=v==='old'?'old':'new'; renderModeration(); }
function selectMod(id){ MOD_SELECTED=id; renderModeration(); }
function toggleCheck(id){ MOD_CHECKED.has(id)?MOD_CHECKED.delete(id):MOD_CHECKED.add(id); renderModeration(); }
function toggleCheckAll(){
  const items=modQueueItems();
  const allChecked = items.length>0 && items.every(t=>MOD_CHECKED.has(t.id));
  if(allChecked) items.forEach(t=>MOD_CHECKED.delete(t.id));
  else items.forEach(t=>MOD_CHECKED.add(t.id));
  renderModeration();
}
function navMod(dir){
  const items=modQueueItems(); if(!items.length) return;
  const i=items.findIndex(x=>x.id===MOD_SELECTED);
  const ni=Math.max(0,Math.min(items.length-1,i+dir)); MOD_SELECTED=items[ni].id; renderModeration();
}
// OMMAVIY moderatsiya — bitta server so'rovi (StudioApi.bulkReview), har element ALOHIDA
// ishlanadi (bitta yomon element partiyani to'xtatmaydi). a: approve-free | approve-pro |
// reject | clear-pack. Karantin gate saqlanadi (clear-pack → so'ng approve).
async function bulkAction(a){
  const ids=[...MOD_CHECKED]; const n=ids.length;
  if(!n) return;
  if(!StudioApi.token()){ toast('Bulk action','Sign in as admin first','warn'); return; }
  // P4 3(b) — reject qaytarilmasi qiyin, boshqa amallar (approve/clear-pack) darhol bajariladi.
  if(a==='reject' && !confirm(`Reject ${n} template${n===1?'':'s'}?`)) return;

  const map = {
    'approve-free': { action:'approve', opts:{ published:true, isPro:false }, label:'Bulk approve · Free' },
    'approve-pro':  { action:'approve', opts:{ published:true, isPro:true },  label:'Bulk approve · Pro' },
    'reject':       { action:'reject',  opts:{ note:'Bulk reject' },          label:'Bulk reject' },
    'clear-pack':   { action:'clear-pack', opts:{},                            label:'Bulk clear pack' },
  };
  const m = map[a];
  if(!m) return;

  let resp;
  try{
    resp = await StudioApi.bulkReview(ids, m.action, m.opts);
  }catch(e){
    console.warn('bulkReview', e);
    toast(m.label, (e && e.message) || 'Request failed','warn');
    return;
  }

  await StudioTemplates.refreshAfterReview();
  if (StudioTemplates.loadModerationOnly) await StudioTemplates.loadModerationOnly();

  const ok = resp && typeof resp.okCount==='number' ? resp.okCount : n;
  const total = resp && typeof resp.total==='number' ? resp.total : n;
  const failed = total - ok;
  const firstErr = (resp && Array.isArray(resp.results) ? resp.results.find(r=>!r.ok) : null);
  if(failed>0){
    toast(m.label, `${ok}/${total} succeeded · ${failed} failed${firstErr&&firstErr.error?' ('+firstErr.error+')':''}`,'warn');
  }else{
    const suffix = a==='approve-pro'?' as Pro' : a==='approve-free'?' as Free' : '';
    toast(m.label, `${ok} template${ok===1?'':'s'} processed${suffix}`,'success');
  }
  MOD_CHECKED.clear(); renderModeration();
}
