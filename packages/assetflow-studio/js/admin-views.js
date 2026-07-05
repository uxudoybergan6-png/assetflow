/* ============================================================
   AssetFlow — Admin views (part 1): helpers, Overview, Moderation
   ============================================================ */
window.VIEWS = window.VIEWS || {};
window.afterRender = window.afterRender || {};

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
/** Obunachi/contributor status badge (active/blocked/removed). */
function axStatus(status){
  if(status==='active')  return '<span class="adx-bdg adx-bdg-active"><span class="bd"></span>Faol</span>';
  if(status==='blocked') return '<span class="adx-bdg adx-bdg-blocked"><span class="bd"></span>Bloklangan</span>';
  if(status==='removed') return '<span class="adx-bdg adx-bdg-removed"><span class="bd"></span>Chiqarilgan</span>';
  return '<span class="adx-bdg adx-bdg-draft"><span class="bd"></span>'+esc(status||'')+'</span>';
}
/** Shablon holat badge (maket bdg-*). short=qisqa yozuv. */
function axTplStatus(status, short){
  var m = {
    approved:['adx-bdg-approved', short?'Tasd.':'Tasdiqlangan'],
    pending: ['adx-bdg-pending',  short?'Kut.':'Kutilmoqda'],
    soft:    ['adx-bdg-soft','Soft'],
    hard:    ['adx-bdg-hard','Hard'],
    draft:   ['adx-bdg-draft','Qoralama'],
    archived:['adx-bdg-removed','Arxiv'],
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
    {label:'Jami shablonlar', val:c.total, ic:'layers', c:'violet', foot:'barcha holatlar'},
    {label:'Tasdiqlangan (AE live)', val:c.approved, ic:'checkCircle', c:'green', foot:'pluginda ko\u2018rinadi'},
    {label:'Kutilayotgan moderatsiya', val:c.pending, ic:'clock', c:'yellow', foot:'navbatda'},
    {label:'Contributorlar', val:c.contributors, ic:'users', c:'blue', foot:`${c.blocked} bloklangan`},
    {label:'AE obunachilar', val:c.subscribersActive, ic:'plugin', c:'violet', foot:`${c.subscribers} jami · Browse`},
    {label:'Jami yuklab olishlar', val:totalDlDisplay >= 1000 ? (totalDlDisplay/1000).toFixed(1)+'K' : String(totalDlDisplay), ic:'download', c:'green', foot:'plugin hisobi'},
    ...(apprPct != null
      ? [{ label: "Approval rate", val: `${apprPct}%`, ic: "star", c: "yellow", foot: "qaror qilingan shablonlar" }]
      : []),
  ];
  return `
  <div class="col gap-20">
    ${infoBanner('Tasdiqlangan shablonlar obunachilar After Effects \u2192 <b>AssetFlow Browse</b> panelida avtomatik ko\u2018rinadi.')}

    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      ${kpis.map(kpiCard).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1.7fr 1fr;gap:20px">
      <!-- downloads chart -->
      <div class="card">
        <div class="card-head">
          <div><h3>Platforma faolligi</h3><span class="small">Audit log · so\u2018nggi 30 kun</span></div>
          <div class="segmented"><button data-r="7">7 kun</button><button class="active" data-r="30">30 kun</button></div>
        </div>
        <div class="card-pad">
          <div class="row between center mb-16">
            <div class="col" style="gap:2px">
              <span class="num" style="font-size:28px;font-weight:700">${totalDlDisplay >= 1000 ? (totalDlDisplay/1000).toFixed(1)+'K' : totalDlDisplay}</span>
              <span class="small">plugin yuklab olishlar · audit grafigi alohida</span>
            </div>
          </div>
          <div id="ovChart" style="height:170px"></div>
        </div>
      </div>

      <!-- category donut -->
      <div class="card">
        <div class="card-head"><h3>Kategoriya taqsimoti</h3></div>
        <div class="card-pad row gap-20 center">
          <div style="position:relative;flex:0 0 auto">
            ${donut(catDist, 140)}
            <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center">
              <div><div class="num" style="font-size:22px;font-weight:700">${counts().total}</div><div class="small">shablon</div></div>
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
        <div class="card-head"><div><h3>TOP yuklab olinadigan</h3><span class="small">Eng mashhur shablonlar</span></div><button class="btn btn-subtle btn-sm" onclick="route('analytics')">Hammasi ${ic('chevR')}</button></div>
        <div class="card-pad col gap-4">
          ${(() => {
            const top = topTemplates();
            if (!top.length) return '<div class="empty" style="padding:24px"><p class="small">Hali tasdiqlangan shablon yo\u2018q</p></div>';
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

      <!-- recent activity -->
      <div class="card">
        <div class="card-head"><div><h3>So\u2018nggi faoliyat</h3><span class="small">Tizim bo\u2018ylab harakatlar</span></div><button class="btn btn-subtle btn-sm" onclick="route('audit')">Audit log ${ic('chevR')}</button></div>
        <div class="card-pad">
          <div class="timeline">
            ${(ACTIVITY.length ? ACTIVITY : [{who:'—', verb:'faoliyat', obj:'hali yo\'q', t:'', cls:'gray', ic:'clock'}]).map(a=>`
              <div class="tl-item">
                <div class="tl-dot" style="background:var(--${a.cls})">${ic(a.ic)}</div>
                <div class="tl-title"><b>${a.who}</b> ${a.verb} <span style="color:var(--violet-bright)">${a.obj}</span></div>
                <div class="tl-meta">${a.t}</div>
              </div>`).join('')}
          </div>
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
        '<div class="empty" style="padding:32px 0"><p class="small">Hali audit voqealari yo\u2018q</p></div>';
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
   MODERATION QUEUE \u2014 redesign port (maket e2): ikki panel
   chap: filtrli navbat ro'yxati \u00b7 o'ng: detal + qaror paneli.
   Logika saqlangan: modApprove/modSoftReject/modHardReject/modDelete/
   openEditMeta/openMessage/bulkAction \u2014 mavjud handlerlar.
   ============================================================ */
let MOD_SELECTED = null;
let MOD_FILTER = 'pending';
let MOD_CHECKED = new Set();
let MOD_CAT = 'all';
let MOD_SORT = 'new';

VIEWS.moderation = function(){
  return `<div id="modRoot" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>`;
};
window.afterRender.moderation = function(){
  // Real API moderation queue
  if (typeof StudioTemplates !== "undefined" && StudioTemplates.loadModerationOnly) {
    StudioTemplates.loadModerationOnly()
      .catch((e) => {
        console.warn("loadModerationOnly", e);
        if (typeof toast === "function") toast("API", e.message || "Ma'lumot yuklanmadi", "warn");
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
  return items.slice().sort((a,b)=> MOD_SORT==='new'
    ? String(b.created||'').localeCompare(String(a.created||''))
    : String(a.created||'').localeCompare(String(b.created||'')));
}

/* maket g1\u2013g8 thumb gradienti (app.css g9/g10 \u2192 1/2 ga o'raladi) */
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
  if(status==='pending') return `<span class="adx-bdg adx-bdg-pending"><span class="bd"></span>${short?'Kut.':'Kutilmoqda'}</span>`;
  if(status==='soft') return `<span class="adx-bdg adx-bdg-soft"><span class="bd"></span>Soft</span>`;
  if(status==='hard') return `<span class="adx-bdg adx-bdg-hard"><span class="bd"></span>Hard</span>`;
  if(status==='approved') return `<span class="adx-bdg adx-bdg-approved"><span class="bd"></span>Tasdiqlangan</span>`;
  return `<span class="adx-bdg adx-bdg-draft"><span class="bd"></span>${esc(status||'')}</span>`;
}

/* Topbar amallari \u2014 kategoriya + sana sort (maket e2 topbar) */
function modTopbarActions(){
  const tba = document.getElementById('tbActions');
  if(!tba || (typeof CURRENT!=='undefined' && CURRENT!=='moderation')) return;
  tba.innerHTML = `
    <label class="adx-sel"><i class="ph ph-funnel" style="font-size:13px"></i><span>${MOD_CAT==='all'?'Barcha kategoriyalar':esc(MOD_CAT)}</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i>
      <select onchange="setModCat(this.value)">
        <option value="all" ${MOD_CAT==='all'?'selected':''}>Barcha kategoriyalar</option>
        ${CATS.map(c=>`<option value="${esc(c)}" ${MOD_CAT===c?'selected':''}>${esc(c)}</option>`).join('')}
      </select></label>
    <label class="adx-sel"><i class="ph ph-sort-descending" style="font-size:13px"></i><span>${MOD_SORT==='new'?'Sana: Yangi \u2192 eski':'Sana: Eski \u2192 yangi'}</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i>
      <select onchange="setModSort(this.value)">
        <option value="new" ${MOD_SORT==='new'?'selected':''}>Sana: Yangi \u2192 eski</option>
        <option value="old" ${MOD_SORT==='old'?'selected':''}>Eski \u2192 yangi</option>
      </select></label>`;
}

function renderModeration(){
  const items = modQueueItems();
  if(MOD_SELECTED===null && items.length) MOD_SELECTED = items[0].id;
  const sel = TEMPLATES.find(t=>t.id===MOD_SELECTED);

  modTopbarActions();
  if (typeof renderNav === 'function') renderNav(); // badge/bell yangilansin (approve/reject'dan keyin)

  const tagRow = [['pending','Kutilmoqda'],['new','Faqat yangi'],['soft','Soft'],['all','Barchasi']].map(([k,l])=>{
    const n = k==='new'?tByStatus('pending').filter(t=>t.isNew).length : k==='all'?TEMPLATES.filter(t=>['pending','soft','hard'].includes(t.status)).length : tByStatus(k).length;
    return `<button class="adx-tag ${MOD_FILTER===k?'on':''}" onclick="setModFilter('${k}')">${l} <span class="n">${n}</span></button>`;
  }).join('');

  const root = document.getElementById('modRoot');
  if(!root) return;
  root.innerHTML = `
    ${MOD_CHECKED.size?`<div class="adx-bulkbar">
      <span class="adx-bdg adx-bdg-info">${MOD_CHECKED.size} tanlandi</span>
      <span style="font-size:11.5px;color:var(--muted)">Bulk amal:</span>
      <span style="flex:1"></span>
      <button class="adx-btn adx-btn-ok sm" onclick="bulkAction('approve')"><i class="ph ph-check"></i>Approve</button>
      <button class="adx-btn2 adx-btn-warn sm" onclick="bulkAction('soft')"><i class="ph ph-arrow-u-up-left"></i>Soft reject</button>
      <button class="adx-btn2 sm" onclick="bulkAction('export')"><i class="ph ph-export"></i>Export</button>
      <button class="adx-btn2 sm" onclick="MOD_CHECKED.clear();renderModeration()">Bekor</button>
    </div>`:''}
    <div class="adx-modwrap">
      <!-- list panel -->
      <div class="adx-modlist">
        <div class="adx-modtags">${tagRow}</div>
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
                ${t.isNew?'<span class="adx-bdg adx-bdg-info">Yangi</span>':''}
                ${adxModStatusBdg(t.status, true)}
              </div>
            </div>`;
          }).join('') : `<div class="adx-empty" style="margin:14px 4px"><span class="ei"><i class="ph ph-check-circle"></i></span><div style="font-weight:600;font-size:13px">Navbat bo\u2018sh</div><div style="font-size:11px;color:var(--muted2);line-height:1.5">Bu filtrda ko\u2018rib chiqiladigan shablon yo\u2018q.</div></div>`}
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
  if(!chips.length) chips.push(`<span style="font-size:11px;color:var(--amber)">Fayllar yuklanmagan</span>`);
  return chips.join('');
}

function renderModDetail(t){
  const host = document.getElementById('modDetail');
  if(!host) return;
  if(!t){ host.innerHTML = `<div class="adx-empty" style="max-width:420px;margin:40px auto"><span class="ei"><i class="ph ph-shield-check"></i></span><div style="font-weight:600;font-size:13px">Shablon tanlanmagan</div><div style="font-size:11px;color:var(--muted2);line-height:1.5">Chapdagi navbatdan element tanlang.</div></div>`; return; }
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
          <div style="flex:1;min-width:0"><div class="adx-h18">${esc(t.name)}</div><div style="font-size:12px;color:#8A93A3;margin-top:3px">${esc(t.cat)} \u00b7 After Effects</div></div>
          ${adxModStatusBdg(t.status)}
          ${t.isNew?'<span class="adx-bdg adx-bdg-info">Yangi</span>':''}
        </div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">${adxFileChips(t)}</div>
        <div style="display:flex;align-items:center;gap:9px;margin-top:14px;padding:10px 12px;background:var(--surface);border:1px solid rgba(255,255,255,.07);border-radius:11px">
          <span class="adx-av ${adxModGrad(t.grad)}" style="width:34px;height:34px">${esc(initialsOf(con.name))}</span>
          <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12px">${esc(con.name)}</div><div style="font-size:10.5px;color:#8A93A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(con.email||'')}</div></div>
          <button class="adx-btn2 sm" onclick="route('contributor-detail','${t.cid}')"><i class="ph ph-user"></i>Profil</button>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px">
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">ID</div><div class="adx-mono" style="font-size:11px;color:#B7C0CE" title="${esc(t.id)}">${esc(shortId)}</div></div>
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">KATEGORIYA</div><div style="font-size:12px;color:#B7C0CE">${esc(t.cat)}</div></div>
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">RESOLUTION</div><div style="font-size:12px;color:#B7C0CE">${esc(t.res)}</div></div>
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">ORIENTATSIYA</div><div style="font-size:12px;color:#B7C0CE">${esc(t.orient)}</div></div>
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">FAYL HAJMI</div><div style="font-size:12px;color:#B7C0CE">${esc(t.size||'\u2014')}</div></div>
      <div class="adx-metabox"><div class="adx-flab" style="margin:0">YUKLANGAN</div><div class="adx-mono" style="font-size:11px;color:#B7C0CE">${esc(t.created||'\u2014')}</div></div>
    </div>
    <div style="margin-top:16px"><div class="adx-flab">TAVSIF</div><div style="font-size:12.5px;color:#B7C0CE;line-height:1.6">${esc(t.desc)}</div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${(t.tags||[]).map(tag=>`<span class="adx-tagpill">${esc(tag)}</span>`).join('')}</div></div>
    ${t.reason?`<div style="margin-top:16px;background:${t.status==='hard'?'var(--reddim)':'var(--amberdim)'};border:1px solid ${t.status==='hard'?'rgba(255,107,94,.3)':'rgba(255,178,124,.32)'};border-radius:11px;padding:10px 12px">
      <div class="adx-flab" style="margin:0;color:${t.status==='hard'?'#FF6B5E':'#FFB27C'}">OLDINGI QAROR SABABI</div>
      <div style="font-size:12px;color:#B7C0CE;margin-top:4px;line-height:1.55">${esc(t.reason)}</div></div>`:''}
    <!-- decision panel -->
    <div class="adx-decide">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><i class="ph ph-gavel" style="color:#C2F04A;font-size:16px"></i><span class="adx-h16" style="font-size:14px">Qaror paneli</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="adx-btn adx-btn-ok" onclick="modApprove('${t.id}')"><i class="ph ph-check-circle"></i>Tasdiqlash \u2014 AE\u2018da nashr</button>
        <button class="adx-btn2 adx-btn-warn" onclick="modSoftReject('${t.id}')"><i class="ph ph-arrow-u-up-left"></i>Soft reject</button>
        <button class="adx-btn-danger adx-btn-dghost" onclick="modHardReject('${t.id}')"><i class="ph ph-prohibit"></i>Hard reject</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--hair2)">
        <button class="adx-btn2 sm" onclick="openEditMeta('${t.id}')"><i class="ph ph-pencil-simple"></i>Metadata tahrirlash (admin override)</button>
        <button class="adx-btn2 sm" onclick="openMessage('${con.id}','${t.id}')"><i class="ph ph-chat-circle"></i>Contributorga xabar</button>
        <button class="adx-btn2 sm adx-btn-dghost" onclick="modDelete('${t.id}')"><i class="ph ph-trash"></i>Shablonni o\u2018chirish</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:16px">
      <button class="adx-btn2 sm" onclick="navMod(-1)"><i class="ph ph-caret-left"></i>Oldingi</button>
      <span class="adx-mono" style="font-size:11px;color:#8A93A3">${idx+1} / ${items.length}</span>
      <button class="adx-btn2 sm" onclick="navMod(1)">Keyingi<i class="ph ph-caret-right"></i></button>
    </div>`;
}

function initialsOf(name){
  return String(name||'').trim().split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,2) || '?';
}

function setModFilter(f){
  MOD_FILTER=f; MOD_SELECTED=null;
  if (f === "pending" || f === "new") {
    if (typeof StudioTemplates !== "undefined" && StudioTemplates.loadModerationOnly) {
      StudioTemplates.loadModerationOnly().finally(() => renderModeration());
      return;
    }
  }
  renderModeration();
}
function setModCat(v){ MOD_CAT=v||'all'; renderModeration(); }
function setModSort(v){ MOD_SORT=v==='old'?'old':'new'; renderModeration(); }
function selectMod(id){ MOD_SELECTED=id; renderModeration(); }
function toggleCheck(id){ MOD_CHECKED.has(id)?MOD_CHECKED.delete(id):MOD_CHECKED.add(id); renderModeration(); }
function navMod(dir){
  const items=modQueueItems(); if(!items.length) return;
  const i=items.findIndex(x=>x.id===MOD_SELECTED);
  const ni=Math.max(0,Math.min(items.length-1,i+dir)); MOD_SELECTED=items[ni].id; renderModeration();
}
async function bulkAction(a){
  const n=MOD_CHECKED.size;
  if(a==='approve'&&StudioApi.token()){
    for(const id of MOD_CHECKED){
      try{ await StudioApi.reviewTemplate(id,'approve'); }catch(e){ console.warn(id,e); }
    }
    await StudioTemplates.refreshAfterReview();
    if (StudioTemplates.loadModerationOnly) await StudioTemplates.loadModerationOnly();
    toast('Bulk tasdiqlash', `${n} ta shablon tasdiqlandi va AE katalogiga qo\u2018shildi`,'success');
  }else if(a==='approve'){
    toast('Bulk tasdiqlash', 'Avval admin sifatida kiring','warn');
  }
  if(a==='soft'&&StudioApi.token()){
    for(const id of MOD_CHECKED){
      try{ await StudioApi.reviewTemplate(id,'reject','Bulk soft reject'); }catch(e){ console.warn(id,e); }
    }
    await StudioTemplates.refreshAfterReview();
    if (StudioTemplates.loadModerationOnly) await StudioTemplates.loadModerationOnly();
    toast('Bulk soft reject', `${n} ta shablon rad etildi`,'warn');
  }else if(a==='soft'){
    toast('Bulk soft reject', 'Avval admin sifatida kiring','warn');
  }
  if(a==='export'){ toast('Eksport', `${n} ta yozuv CSV ga eksport qilindi`,'info'); }
  MOD_CHECKED.clear(); renderModeration();
}
