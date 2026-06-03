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
   OVERVIEW
   ============================================================ */
VIEWS.overview = function(){
  const c = counts();
  const kpis = [
    {label:'Jami shablonlar', val:c.total, ic:'layers', c:'violet', trend:8, foot:'barcha holatlar'},
    {label:'Tasdiqlangan (AE live)', val:c.approved, ic:'checkCircle', c:'green', trend:5, foot:'pluginda ko\u2018rinadi'},
    {label:'Kutilayotgan moderatsiya', val:c.pending, ic:'clock', c:'yellow', trend:12, foot:'navbatda'},
    {label:'Contributorlar', val:c.contributors, ic:'users', c:'blue', foot:`${c.blocked} bloklangan`},
    {label:'AE obunachilar', val:c.subscribersActive, ic:'plugin', c:'violet', foot:`${c.subscribers} jami · Browse`},
    {label:'Jami yuklab olishlar', val:(c.totalDl/1000).toFixed(1)+'K', ic:'download', c:'green', trend:14, foot:'30 kunda'},
  ];
  return `
  <div class="col gap-20">
    ${infoBanner('Tasdiqlangan shablonlar obunachilar After Effects \u2192 <b>AssetFlow Browse</b> panelida avtomatik ko\u2018rinadi.')}

    <div class="kpi-grid" style="grid-template-columns:repeat(6,1fr)">
      ${kpis.map(kpiCard).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1.7fr 1fr;gap:20px">
      <!-- downloads chart -->
      <div class="card">
        <div class="card-head">
          <div><h3>Yuklab olishlar dinamikasi</h3><span class="small">So\u2018nggi 30 kun</span></div>
          <div class="segmented"><button data-r="7">7 kun</button><button class="active" data-r="30">30 kun</button></div>
        </div>
        <div class="card-pad">
          <div class="row between center mb-16">
            <div class="col" style="gap:2px">
              <span class="num" style="font-size:28px;font-weight:700">38.1K</span>
              <span class="small">jami yuklab olishlar \u00b7 <span class="trend up" style="display:inline-flex">${ic('trendUp')}14%</span> o\u2018tgan oyga nisbatan</span>
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
            ${donut(CAT_DIST, 140)}
            <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center">
              <div><div class="num" style="font-size:22px;font-weight:700">${counts().total}</div><div class="small">shablon</div></div>
            </div>
          </div>
          <div class="donut-legend grow">
            ${CAT_DIST.map(s=>`<div class="leg-item"><span class="sw" style="background:${s.color}"></span><span class="nm">${s.nm}</span><span class="vl">${Math.round(s.v*100)}%</span></div>`).join('')}
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
                <span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</span>
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
            ${ACTIVITY.map(a=>`
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
  if(el) el.innerHTML = areaChart(DL_30, 600, 170, '#8b7cf6');
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
   MODERATION QUEUE  (list + split detail)
   ============================================================ */
let MOD_SELECTED = null;
let MOD_FILTER = 'pending';
let MOD_CHECKED = new Set();

VIEWS.moderation = function(){
  return `<div id="modRoot"></div>`;
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
  if(MOD_FILTER==='new') return tByStatus('pending').filter(t=>t.isNew);
  if(MOD_FILTER==='all') return TEMPLATES.filter(t=>['pending','soft','hard'].includes(t.status));
  return tByStatus(MOD_FILTER);
}

function renderModeration(){
  const items = modQueueItems();
  if(MOD_SELECTED===null && items.length) MOD_SELECTED = items[0].id;
  const sel = TEMPLATES.find(t=>t.id===MOD_SELECTED);

  const root = document.getElementById('modRoot');
  root.innerHTML = `
  <div class="col gap-16">
    <div class="toolbar between">
      <div class="chips">
        ${[['pending','Kutilmoqda'],['new','Faqat yangi'],['soft','Soft reject'],['all','Barchasi']].map(([k,l])=>{
          const n = k==='new'?tByStatus('pending').filter(t=>t.isNew).length : k==='all'?TEMPLATES.filter(t=>['pending','soft','hard'].includes(t.status)).length : tByStatus(k).length;
          return `<button class="chip ${MOD_FILTER===k?'active':''}" onclick="setModFilter('${k}')">${l}<span class="cnt">${n}</span></button>`;
        }).join('')}
      </div>
      <div class="toolbar">
        <select class="select"><option>Barcha kategoriyalar</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select>
        <select class="select"><option>Sana: Yangi \u2192 eski</option><option>Eski \u2192 yangi</option></select>
      </div>
    </div>

    ${MOD_CHECKED.size?`<div class="info-banner" style="background:var(--bg-3);border-color:var(--line-strong)">
      <div class="row center gap-10 grow"><span class="badge badge-violet">${MOD_CHECKED.size} tanlandi</span>
      <span class="small">Bulk amal:</span></div>
      <div class="row gap-8">
        <button class="btn btn-sm btn-success" onclick="bulkAction('approve')">${ic('check')} Approve</button>
        <button class="btn btn-sm btn-warn" onclick="bulkAction('soft')">${ic('reply')} Soft reject</button>
        <button class="btn btn-sm btn-ghost" onclick="bulkAction('export')">${ic('download')} Export</button>
        <button class="btn btn-sm btn-subtle" onclick="MOD_CHECKED.clear();renderModeration()">Bekor</button>
      </div></div>`:''}

    <div style="display:grid;grid-template-columns:380px 1fr;gap:16px;align-items:start">
      <!-- queue list -->
      <div class="card" style="overflow:hidden">
        <div class="card-head"><h3>Navbat</h3><span class="label">${items.length} ta</span></div>
        <div class="col" style="max-height:680px;overflow-y:auto">
          ${items.length? items.map(t=>{
            const con = t._con || cById(t.cid) || { name: "Contributor", email: "" };
            return `<div class="mod-item ${t.id===MOD_SELECTED?'sel':''}" onclick="selectMod('${t.id}')">
              <div class="checkbox ${MOD_CHECKED.has(t.id)?'on':''}" onclick="event.stopPropagation();toggleCheck('${t.id}')">${ic('check')}</div>
              <div class="row-thumb" style="width:64px;height:42px;overflow:hidden;border-radius:var(--r-sm)">${typeof StudioMedia!=='undefined'?StudioMedia.renderThumb(t,'lg'):thumbArt(t.grad,t.dur,'lg')}</div>
              <div class="col grow" style="gap:3px;min-width:0">
                <span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</span>
                <span class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${con.name} \u00b7 ${t.cat}</span>
                <div class="row center gap-8 mt-4">${badge(t.status)}${t.isNew?'<span class="pill" style="color:var(--violet-bright);border-color:var(--violet-line)">Yangi</span>':''}</div>
              </div>
            </div>`;
          }).join('') : `<div class="empty"><div class="ico">${ic('checkCircle')}</div><h3>Navbat bo\u2018sh</h3><p>Bu filtrda ko\u2018rib chiqiladigan shablon yo\u2018q.</p></div>`}
        </div>
      </div>

      <!-- detail / decision -->
      <div id="modDetail"></div>
    </div>
  </div>`;

  renderModDetail(sel);
}

function renderModDetail(t){
  const host = document.getElementById('modDetail');
  if(!t){ host.innerHTML = `<div class="card card-pad empty"><div class="ico">${ic('shield')}</div><h3>Shablon tanlanmagan</h3><p>Chapdagi navbatdan element tanlang.</p></div>`; return; }
  const con = t._con || cById(t.cid) || { name: "Contributor", email: "" };
  host.innerHTML = `
  <div class="col gap-16">
    <div class="card" style="overflow:hidden">
      <div style="display:grid;grid-template-columns:1.3fr 1fr">
        <!-- preview side -->
        <div style="border-right:1px solid var(--line)">
          <div style="position:relative;background:#0a0a0f">
            ${typeof StudioMedia!=='undefined'?StudioMedia.renderPreview(t):`<div class="thumb ${t.grad} grain" style="width:100%;aspect-ratio:16/10"></div>`}
            <div style="position:absolute;top:10px;left:10px;z-index:2" class="row gap-6">
              <span class="pill" style="background:rgba(0,0,0,.5);backdrop-filter:blur(4px)">${t.res}</span>
              <span class="pill" style="background:rgba(0,0,0,.5);backdrop-filter:blur(4px)">${t.orient}</span>
            </div>
          </div>
          <div class="row gap-8 wrap" style="padding:10px;border-bottom:1px solid var(--line)">
            ${typeof StudioMedia!=='undefined'?StudioMedia.filePills(t):''}
          </div>
          <div class="card-pad col gap-12">
            <div class="row center gap-10">
              ${avatar(con.name,34)}
              <div class="col grow" style="gap:1px">
                <span class="cell-strong">${con.name}</span>
                <span class="small">${con.email}</span>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="route('contributor-detail','${t.cid}')">${ic('ext')} Profil</button>
            </div>
            <div class="divider" style="margin:2px 0"></div>
            <div class="meta-grid">
              ${[['ID',t.id],['Kategoriya',t.cat],['Resolution',t.res],['Orientatsiya',t.orient],['Fayl hajmi',t.size],['Yuklangan',t.created]].map(([k,v])=>
                `<div><div class="label" style="margin-bottom:3px">${k}</div><div class="cell-strong">${v}</div></div>`).join('')}
            </div>
            <div>
              <div class="label" style="margin-bottom:6px">Tavsif</div>
              <p class="body">${t.desc}</p>
            </div>
            <div class="row gap-6 wrap">${t.tags.map(tag=>`<span class="pill">${ic('tag')}${tag}</span>`).join('')}</div>
          </div>
        </div>

        <!-- decision side -->
        <div class="col" style="background:var(--bg-1)">
          <div class="card-pad col gap-14 grow">
            <div class="row between center">
              <span class="label">Qaror paneli</span>
              ${badge(t.status)}
            </div>
            ${t.reason?`<div class="info-banner ${t.status==='hard'?'danger':'warn'}" style="align-items:flex-start">${ic(t.status==='hard'?'ban':'reply')}<div><b style="color:var(--tx-0)">Oldingi qaror sababi</b><div class="small mt-4" style="color:var(--tx-1)">${t.reason}</div></div></div>`:''}

            <div class="col gap-8">
              <button class="btn btn-success btn-lg" onclick="modApprove('${t.id}')">${ic('checkCircle')} Tasdiqlash \u2014 AE\u2018da nashr</button>
              <div class="row gap-8">
                <button class="btn btn-warn grow" onclick="modSoftReject('${t.id}')">${ic('reply')} Soft reject</button>
                <button class="btn btn-danger grow" onclick="modHardReject('${t.id}')">${ic('ban')} Hard reject</button>
              </div>
            </div>

            <div class="divider"></div>
            <span class="label">Qo\u2018shimcha amallar</span>
            <div class="col gap-6">
              <button class="btn btn-ghost" style="justify-content:flex-start" onclick="openEditMeta('${t.id}')">${ic('edit')} Metadata tahrirlash (admin override)</button>
              <button class="btn btn-ghost" style="justify-content:flex-start" onclick="route('contributor-detail','${t.cid}')">${ic('users')} Contributor profiliga o\u2018tish</button>
              <button class="btn btn-ghost" style="justify-content:flex-start" onclick="openMessage('${con.id}','${t.id}')">${ic('message')} Contributorga xabar yozish</button>
              <button class="btn btn-danger-ghost" style="justify-content:flex-start" onclick="modDelete('${t.id}')">${ic('trash')} Shablonni o\u2018chirish</button>
            </div>

            <div class="grow"></div>
            ${infoBanner('Tasdiqlangach bu shablon AE katalogiga qo\u2018shiladi.')}
          </div>
          <div class="card-head" style="border-top:1px solid var(--line);border-bottom:none">
            <span class="small">${modQueueItems().findIndex(x=>x.id===t.id)+1} / ${modQueueItems().length}</span>
            <div class="row gap-6">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="navMod(-1)">${ic('chevL')}</button>
              <button class="btn btn-ghost btn-sm btn-icon" onclick="navMod(1)">${ic('chevR')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
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
function selectMod(id){ MOD_SELECTED=id; renderModeration(); }
function toggleCheck(id){ MOD_CHECKED.has(id)?MOD_CHECKED.delete(id):MOD_CHECKED.add(id); renderModeration(); }
function navMod(dir){
  const items=modQueueItems(); const i=items.findIndex(x=>x.id===MOD_SELECTED);
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
    toast('Bulk tasdiqlash', `${n} ta (demo)`,'success');
  }
  if(a==='soft'&&StudioApi.token()){
    for(const id of MOD_CHECKED){
      try{ await StudioApi.reviewTemplate(id,'reject','Bulk soft reject'); }catch(e){ console.warn(id,e); }
    }
    await StudioTemplates.refreshAfterReview();
    if (StudioTemplates.loadModerationOnly) await StudioTemplates.loadModerationOnly();
    toast('Bulk soft reject', `${n} ta shablon rad etildi`,'warn');
  }else if(a==='soft'){
    toast('Bulk soft reject', `${n} ta (demo)`,'warn');
  }
  if(a==='export'){ toast('Eksport', `${n} ta yozuv CSV ga eksport qilindi`,'info'); }
  MOD_CHECKED.clear(); renderModeration();
}
