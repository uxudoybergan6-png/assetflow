/* ============================================================
   AssetFlow — Admin views (part 2):
   Templates, Contributors, Detail, Messaging, Analytics,
   Settings, Audit + all modals & actions
   ============================================================ */

/* ============================================================
   ALL TEMPLATES — global table
   ============================================================ */
let T_FILTER = 'all', T_SEARCH = '';
VIEWS.templates = function(){ return `<div id="tplRoot"></div>`; };
window.afterRender.templates = function(){ renderTemplates(); };

function renderTemplates(){
  let rows = TEMPLATES.slice();
  if(T_FILTER!=='all') rows = rows.filter(t=>t.status===T_FILTER);
  if(T_SEARCH) rows = rows.filter(t=>(t.name+t.id+cById(t.cid).email).toLowerCase().includes(T_SEARCH.toLowerCase()));
  const c=counts();
  document.getElementById('tplRoot').innerHTML = `
  <div class="col gap-16">
    <div class="toolbar between">
      <div class="chips">
        ${[['all','Barchasi',c.total],['approved','Tasdiqlangan',c.approved],['pending','Kutilmoqda',c.pending],['soft','Soft',c.soft],['hard','Hard',c.hard],['draft','Qoralama',c.draft],['archived','Arxiv',c.archived]].map(([k,l,n])=>
          `<button class="chip ${T_FILTER===k?'active':''}" onclick="T_FILTER='${k}';renderTemplates()">${l}<span class="cnt">${n}</span></button>`).join('')}
      </div>
      <div class="toolbar">
        <div class="search" style="width:230px;height:34px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input placeholder="Qidirish\u2026" oninput="T_SEARCH=this.value;renderTemplates()" value="${T_SEARCH}"></div>
        <button class="btn btn-ghost btn-sm">${ic('filter')} Filtr</button>
        <button class="btn btn-ghost btn-sm" onclick="toast('Eksport','CSV fayli yuklab olinmoqda\u2026','info')">${ic('download')} CSV</button>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table class="data" style="min-width:980px">
          <thead><tr>
            <th style="width:30px"></th>
            <th class="sortable">Shablon</th>
            <th>ID</th>
            <th>Contributor</th>
            <th>Holat</th>
            <th class="sortable">Yuklangan</th>
            <th class="th-num sortable">Downloads</th>
            <th>Oxirgi qaror</th>
            <th style="width:96px"></th>
          </tr></thead>
          <tbody>
          ${rows.map(t=>{ const con=cById(t.cid); return `<tr>
            <td><div class="checkbox" onclick="this.classList.toggle('on')">${ic('check')}</div></td>
            <td><div class="tmpl-cell"><div class="row-thumb" style="overflow:hidden">${typeof StudioMedia!=='undefined'?StudioMedia.renderThumb(t,'lg'):thumbArt(t.grad,'','lg')}</div><div class="tmpl-meta"><span class="nm">${t.name}</span><span class="sub">${t.cat} \u00b7 ${t.res}</span></div></div></td>
            <td class="cell-muted mono">${t.id}</td>
            <td><div class="row center gap-8">${avatar(con.name,24)}<span class="cell-muted" style="white-space:nowrap">${con.email.split('@')[0]}</span></div></td>
            <td>${badge(t.status)}</td>
            <td class="cell-muted mono">${t.created}</td>
            <td class="cell-num cell-strong">${t.dl?t.dl.toLocaleString():'\u2014'}</td>
            <td class="cell-muted">${t.reason?'Sabab bilan':t.status==='approved'?'Tasdiqlangan':'\u2014'}</td>
            <td><div class="row-actions">
              <button class="act" title="Ko\u2018rish" onclick="openTplDrawer('${t.id}')">${ic('eye')}</button>
              <button class="act" title="Tahrir" onclick="openEditMeta('${t.id}')">${ic('edit')}</button>
              <button class="act danger" title="O\u2018chirish" onclick="modDelete('${t.id}')">${ic('trash')}</button>
            </div></td>
          </tr>`; }).join('')}
          </tbody>
        </table>
      </div>
      <div class="card-head" style="border-top:1px solid var(--line);border-bottom:none">
        <span class="small">${rows.length} ta natija ko\u2018rsatildi</span>
        <div class="row gap-6"><button class="btn btn-ghost btn-sm" disabled>${ic('chevL')}</button><span class="pill">1 / 1</span><button class="btn btn-ghost btn-sm" disabled>${ic('chevR')}</button></div>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   CONTRIBUTORS — list
   ============================================================ */
VIEWS.contributors = function(){
  const rows = CONTRIBUTORS.map(c=>{
    const ts=tByContributor(c.id);
    return {c, total:ts.length, ap:ts.filter(t=>t.status==='approved').length, pe:ts.filter(t=>t.status==='pending').length, re:ts.filter(t=>['soft','hard'].includes(t.status)).length};
  });
  return `<div class="col gap-16">
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard({label:'Jami contributorlar',val:CONTRIBUTORS.length,ic:'users',c:'violet',foot:'ro\u2018yxatdan o\u2018tgan'})}
      ${kpiCard({label:'Faol',val:CONTRIBUTORS.filter(c=>c.status==='active').length,ic:'checkCircle',c:'green',foot:'kontent yuklamoqda'})}
      ${kpiCard({label:'Bloklangan',val:CONTRIBUTORS.filter(c=>c.status==='blocked').length,ic:'ban',c:'red',foot:'kirish cheklangan'})}
      ${kpiCard({label:'O\u2018rtacha approval',val:'78%',ic:'star',c:'yellow',trend:3,foot:'platforma bo\u2018ylab'})}
    </div>
    <div class="toolbar between">
      <div class="search" style="width:280px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input placeholder="Contributor yoki email\u2026"></div>
      <div class="toolbar"><select class="select"><option>Barcha holat</option><option>Faol</option><option>Bloklangan</option></select><button class="btn btn-ghost btn-sm" onclick="toast('Eksport','CSV yuklab olinmoqda','info')">${ic('download')} CSV</button></div>
    </div>
    <div class="card"><div class="table-wrap"><table class="data" style="min-width:1020px">
      <thead><tr><th>Contributor</th><th>Holat</th><th class="th-num">Jami</th><th class="th-num">Approved</th><th class="th-num">Pending</th><th class="th-num">Rejected</th><th>Oxirgi faoliyat</th><th style="width:120px"></th></tr></thead>
      <tbody>
      ${rows.map(({c,total,ap,pe,re})=>`<tr style="cursor:pointer" onclick="route('contributor-detail','${c.id}')">
        <td><div class="row center gap-10">${avatar(c.name,32)}<div class="col" style="gap:1px"><span class="cell-strong">${c.name}</span><span class="sub" style="font-size:11px;color:var(--tx-3)">${c.email}</span></div></div></td>
        <td><span class="badge ${c.status==='active'?'badge-active':'badge-blocked'}"><span class="dot"></span>${c.status==='active'?'Faol':'Bloklangan'}</span></td>
        <td class="cell-num cell-strong">${total}</td>
        <td class="cell-num" style="color:var(--green)">${ap}</td>
        <td class="cell-num" style="color:var(--yellow)">${pe||'\u2014'}</td>
        <td class="cell-num" style="color:var(--orange)">${re||'\u2014'}</td>
        <td class="cell-muted mono">${c.joined}</td>
        <td onclick="event.stopPropagation()"><div class="row-actions">
          <button class="act" title="Xabar" onclick="openMessage('${c.id}')">${ic('message')}</button>
          ${c.status==='active'?`<button class="act danger" title="Bloklash" onclick="openBlock('${c.id}')">${ic('ban')}</button>`:`<button class="act success" title="Blokdan chiqarish" onclick="unblock('${c.id}')">${ic('checkCircle')}</button>`}
          <button class="act" title="Profil" onclick="route('contributor-detail','${c.id}')">${ic('chevR')}</button>
        </div></td>
      </tr>`).join('')}
      </tbody>
    </table></div></div>
  </div>`;
};

/* ============================================================
   CONTRIBUTOR DETAIL
   ============================================================ */
VIEWS['contributor-detail'] = function(id){
  const c = cById(id) || CONTRIBUTORS[0];
  const ts = tByContributor(c.id);
  const ap=ts.filter(t=>t.status==='approved').length, pe=ts.filter(t=>t.status==='pending').length, re=ts.filter(t=>['soft','hard'].includes(t.status)).length;
  const blocked = c.status==='blocked';
  return `<div class="col gap-16">
    <button class="btn btn-subtle btn-sm" style="align-self:flex-start" onclick="route('contributors')">${ic('chevL')} Contributorlar</button>
    ${blocked?`<div class="info-banner danger">${ic('ban')}<div><b style="color:var(--tx-0)">Bu contributor bloklangan</b> \u2014 kirish cheklangan, yangi yuklash mumkin emas. <a style="color:var(--red);text-decoration:underline;cursor:pointer" onclick="unblock('${c.id}')">Blokdan chiqarish</a></div></div>`:''}

    <div class="card card-pad">
      <div class="row between center wrap gap-16">
        <div class="row center gap-14">
          ${avatar(c.name,56)}
          <div class="col" style="gap:4px">
            <div class="row center gap-10"><span class="h2">${c.name}</span><span class="badge ${blocked?'badge-blocked':'badge-active'}"><span class="dot"></span>${blocked?'Bloklangan':'Faol'}</span></div>
            <div class="row center gap-12 small"><span>${ic('mail')} ${c.email}</span><span class="dot-sep">\u00b7</span><span>${ic('globe')} ${c.country}</span><span class="dot-sep">\u00b7</span><span>${ic('calendar')} ${c.joined} dan beri</span></div>
          </div>
        </div>
        <div class="row gap-8">
          <button class="btn btn-ghost" onclick="openMessage('${c.id}')">${ic('message')} Xabar yozish</button>
          ${blocked?`<button class="btn btn-success" onclick="unblock('${c.id}')">${ic('checkCircle')} Blokdan chiqarish</button>`:`<button class="btn btn-danger-ghost" onclick="openBlock('${c.id}')">${ic('ban')} Bloklash</button>`}
        </div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard({label:'Jami shablon',val:ts.length,ic:'layers',c:'violet'})}
      ${kpiCard({label:'Tasdiqlangan',val:ap,ic:'checkCircle',c:'green',foot:'AE\u2018da live'})}
      ${kpiCard({label:'Kutilmoqda',val:pe,ic:'clock',c:'yellow'})}
      ${kpiCard({label:'Rad etilgan',val:re,ic:'xCircle',c:'orange',foot:'soft + hard'})}
    </div>

    <div class="card">
      <div class="card-head"><div><h3>${c.name.split(' ')[0]}ning shablonlari</h3><span class="small">${ts.length} ta element</span></div>
        ${pe?`<button class="btn btn-ghost btn-sm" onclick="route('moderation')">${ic('shield')} ${pe} ta pending\u2018ni ko\u2018rish</button>`:''}</div>
      <div class="table-wrap"><table class="data" style="min-width:760px">
        <thead><tr><th>Shablon</th><th>Holat</th><th>Kategoriya</th><th class="th-num">Downloads</th><th>Sana</th><th style="width:70px"></th></tr></thead>
        <tbody>
        ${ts.length?ts.map(t=>`<tr>
          <td><div class="tmpl-cell"><div class="row-thumb">${thumbArt(t.grad,'','lg')}</div><div class="tmpl-meta"><span class="nm">${t.name}</span><span class="sub">${t.id}</span></div></div></td>
          <td>${badge(t.status)}</td><td class="cell-muted">${t.cat}</td>
          <td class="cell-num cell-strong">${t.dl?t.dl.toLocaleString():'\u2014'}</td>
          <td class="cell-muted mono">${t.created}</td>
          <td><div class="row-actions"><button class="act" onclick="openTplDrawer('${t.id}')">${ic('eye')}</button></div></td>
        </tr>`).join('')
        :`<tr><td colspan="6"><div class="empty" style="padding:30px"><p>Hali shablon yo\u2018q</p></div></td></tr>`}
        </tbody>
      </table></div>
    </div>
  </div>`;
};

/* ============================================================
   MESSAGING
   ============================================================ */
const THREADS = [
  {cid:'c1', sub:'Neon Glitch Logo Reveal — moderatsiya', last:'Rahmat! Bitrate\u2018ni oshirdim, qayta yubordim.', t:'18 daq', unread:true, tid:'AF-2041'},
  {cid:'c1', sub:'Wedding Photo Gallery — soft reject', last:'Tushundim, preview sifatini yaxshilayman.', t:'1 soat', unread:true, tid:'AF-2029'},
  {cid:'c2', sub:'Umumiy savol', last:'Yangi kategoriya qo\u2018shsangiz bo\u2018ladimi?', t:'3 soat', unread:false},
  {cid:'c7', sub:'Tech Product Showcase', last:'Metadata tuzatdim.', t:'1 kun', unread:false, tid:'AF-2028'},
];
let MSG_SEL = 0;
VIEWS.messaging = function(){ return `<div id="msgRoot"></div>`; };
window.afterRender.messaging = function(){ renderMessaging(); };

function renderMessaging(){
  const th = THREADS[MSG_SEL]; const c = cById(th.cid);
  document.getElementById('msgRoot').innerHTML = `
  <div class="row between center mb-16">
    <div></div>
    <button class="btn btn-primary" onclick="openBroadcast()">${ic('megaphone')} Broadcast e\u2018lon</button>
  </div>
  <div class="card" style="overflow:hidden">
   <div style="display:grid;grid-template-columns:320px 1fr;height:640px">
    <div class="col" style="border-right:1px solid var(--line)">
      <div class="card-head"><h3>Suhbatlar</h3><span class="nav-badge brand">${THREADS.filter(t=>t.unread).length}</span></div>
      <div class="col" style="overflow-y:auto">
        ${THREADS.map((t,i)=>{const cc=cById(t.cid); return `<div class="mod-item ${i===MSG_SEL?'sel':''}" onclick="MSG_SEL=${i};renderMessaging()">
          ${avatar(cc.name,38)}
          <div class="col grow" style="gap:2px;min-width:0">
            <div class="row between center"><span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cc.name}</span><span class="sub" style="font-size:10.5px;color:var(--tx-3)">${t.t}</span></div>
            <span class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px">${t.sub}</span>
          </div>
          ${t.unread?'<span style="width:8px;height:8px;border-radius:50%;background:var(--violet-bright);flex:0 0 auto"></span>':''}
        </div>`;}).join('')}
      </div>
    </div>
    <div class="col">
      <div class="card-head">
        <div class="row center gap-10">${avatar(c.name,34)}<div class="col" style="gap:1px"><span class="cell-strong">${c.name}</span><span class="small">${th.tid?'Shablon: '+th.tid:'Umumiy suhbat'}</span></div></div>
        <button class="btn btn-ghost btn-sm" onclick="route('contributor-detail','${c.id}')">${ic('ext')} Profil</button>
      </div>
      <div class="col grow" style="overflow-y:auto;padding:18px;background:var(--bg-0)">
        ${th.tid?`<div class="text-c mb-16"><span class="pill">${ic('link')} ${th.tid} ga bog\u2018langan</span></div>`:''}
        <div class="msg"><div class="avatar" style="width:28px;height:28px;font-size:11px;background:linear-gradient(140deg,${avColor(c.name).join(',')})">${initials(c.name)}</div><div class="msg-body"><div class="msg-name" style="color:var(--violet-bright)">${c.name}</div><div class="msg-text">${th.last}</div><div class="msg-time">${th.t} oldin</div></div></div>
        <div class="msg me"><div class="avatar" style="width:28px;height:28px;font-size:11px;background:linear-gradient(140deg,#7b5cff,#4a2fb0)">AD</div><div class="msg-body"><div class="msg-name">Admin</div><div class="msg-text">Salom! Preview sifatini tekshirdim \u2014 endi standartga javob beradi. Tasdiqlash uchun navbatga oldim.</div><div class="msg-time">12 daq oldin</div></div></div>
      </div>
      <div class="row gap-8 center" style="padding:14px;border-top:1px solid var(--line)">
        <input class="input" placeholder="Xabar yozing\u2026" style="height:40px">
        <button class="btn btn-primary" style="height:40px" onclick="toast('Yuborildi','Xabar '+'${c.name}'+' ga yetkazildi','success')">${ic('send')} Yuborish</button>
      </div>
    </div>
   </div>
  </div>`;
}

/* ============================================================
   ANALYTICS (deep)
   ============================================================ */
VIEWS.analytics = function(){
  const contribRank = CONTRIBUTORS.map(c=>{const ts=tByContributor(c.id);const dl=ts.reduce((a,t)=>a+t.dl,0);const ap=ts.filter(t=>t.status==='approved').length;return {c,dl,ap,total:ts.length,rate:ts.length?Math.round(ap/ts.length*100):0};}).sort((a,b)=>b.dl-a.dl);
  return `<div class="col gap-20">
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard({label:'Jami yuklab olishlar',val:(counts().totalDl/1000).toFixed(1)+'K',ic:'download',c:'green',trend:14,foot:'30 kun'})}
      ${kpiCard({label:'O\u2018rtacha / shablon',val:Math.round(counts().totalDl/counts().approved),ic:'chart',c:'violet',trend:6})}
      ${kpiCard({label:'Approval rate',val:'78%',ic:'checkCircle',c:'blue',trend:3,foot:'soft+hard hisobga olib'})}
      ${kpiCard({label:'O\u2018rtacha moderatsiya',val:'4.2 soat',ic:'clock',c:'yellow',trend:-12,foot:'yuborish \u2192 qaror'})}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-head"><h3>Contributor leaderboard</h3><span class="label">Downloads bo\u2018yicha</span></div>
        <div class="card-pad col gap-4">
          ${contribRank.slice(0,6).map((r,i)=>`<div class="leader-row">
            <span class="leader-rank">${i+1}</span>${avatar(r.c.name,30)}
            <div class="col grow" style="gap:3px;min-width:0"><span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.c.name}</span>
            <div class="leader-bar"><span style="width:${contribRank[0].dl?r.dl/contribRank[0].dl*100:0}%"></span></div></div>
            <div class="col" style="align-items:flex-end;gap:1px"><span class="num" style="font-weight:700">${(r.dl/1000).toFixed(1)}K</span><span class="sub" style="font-size:10.5px;color:var(--tx-3)">${r.rate}% approval</span></div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Rad sabablari</h3><span class="label">Soft vs Hard</span></div>
        <div class="card-pad col gap-12">
          ${REJECT_REASONS.map(r=>{const tot=r.soft+r.hard;const mx=Math.max(...REJECT_REASONS.map(x=>x.soft+x.hard));return `<div class="col gap-6">
            <div class="row between center"><span class="body" style="color:var(--tx-1)">${r.nm}</span><span class="small">${tot}</span></div>
            <div class="row gap-2" style="height:8px;border-radius:999px;overflow:hidden;background:var(--bg-4)">
              <div style="width:${r.soft/mx*100}%;background:var(--orange)"></div>
              <div style="width:${r.hard/mx*100}%;background:var(--red)"></div>
            </div>
          </div>`;}).join('')}
          <div class="row gap-16 mt-8"><span class="leg-item"><span class="sw" style="background:var(--orange)"></span>Soft reject</span><span class="leg-item"><span class="sw" style="background:var(--red)"></span>Hard reject</span></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Oylik trend</h3><span class="small">Yuklash, tasdiq va rad dinamikasi</span></div>
      <div class="segmented"><button class="active">Downloads</button><button>Yangi yuklash</button><button>Approval</button></div></div>
      <div class="card-pad"><div class="bars">${DL_30.map((v,i)=>`<div class="bar ${i%5===4?'alt':''}" style="height:${v/910*100}%" title="${v}"></div>`).join('')}</div>
      <div class="row between mt-12 small"><span>1-may</span><span>15-may</span><span>30-may</span></div></div>
    </div>
  </div>`;
};

/* ============================================================
   SETTINGS
   ============================================================ */
VIEWS.settings = function(){
  return `<div style="max-width:760px" class="col gap-16">
    <div class="card"><div class="card-head"><h3>Marketplace sozlamalari</h3></div>
      <div class="card-pad col gap-16">
        <div class="field"><label>Platforma nomi</label><input class="input" value="AssetFlow"></div>
        <div class="row gap-16"><div class="field grow"><label>Maks. fayl hajmi (.aep pack)</label><input class="input" value="500 MB"></div>
        <div class="field grow"><label>Preview maks. davomiylik</label><input class="input" value="60 sekund"></div></div>
        <div class="field"><label>Avto-arxiv (faolsiz kunlar)</label><input class="input" value="180"><span class="hint">Approved bo\u2018lmagan qoralamalar shu muddatdan keyin arxivlanadi.</span></div>
      </div>
    </div>
    <div class="card"><div class="card-head"><h3>Kategoriyalar</h3><button class="btn btn-ghost btn-sm">${ic('plus')} Qo\u2018shish</button></div>
      <div class="card-pad"><div class="row gap-8 wrap">${CATS.map(c=>`<span class="pill" style="height:28px">${ic('folder')}${c} <span style="color:var(--tx-3);cursor:pointer">${ic('x')}</span></span>`).join('')}</div></div>
    </div>
    <div class="card"><div class="card-head"><h3>Moderatsiya qoidalari</h3></div>
      <div class="card-pad col gap-2">
        ${[['Yangi yuklash uchun majburiy moderatsiya',true],['Hard reject\u2018dan keyin qayta yuborishni bloklash',true],['Approve\u2018dan keyin AE katalogiga avtomatik push',true],['Soft reject\u2018da contributorga email yuborish',false]].map(([l,on])=>
          `<div class="row between center" style="padding:11px 0;border-bottom:1px solid var(--line-soft)"><span class="body" style="color:var(--tx-1)">${l}</span><div class="switch ${on?'on':''}" onclick="this.classList.toggle('on')"></div></div>`).join('')}
      </div>
    </div>
    <div class="row gap-8"><button class="btn btn-primary" onclick="toast('Saqlandi','Sozlamalar yangilandi','success')">Saqlash</button><button class="btn btn-ghost">Bekor</button></div>
  </div>`;
};

/* ============================================================
   AUDIT LOG
   ============================================================ */
VIEWS.audit = function(){
  return `<div class="col gap-16">
    ${infoBanner('Audit jurnali barcha moderatsiya va boshqaruv harakatlarini compliance uchun yozib boradi. O\u2018zgartirib bo\u2018lmaydi.')}
    <div class="toolbar between">
      <div class="chips"><button class="chip active">Barchasi<span class="cnt">${AUDIT.length}</span></button><button class="chip">Approve</button><button class="chip">Reject</button><button class="chip">Block</button></div>
      <button class="btn btn-ghost btn-sm" onclick="toast('Eksport','Audit log CSV ga eksport qilindi','info')">${ic('download')} Eksport</button>
    </div>
    <div class="card"><div class="table-wrap"><table class="data" style="min-width:880px">
      <thead><tr><th>Vaqt</th><th>Aktor</th><th>Amal</th><th>Nishon</th><th>IP</th></tr></thead>
      <tbody>${AUDIT.map(a=>{const m=AUDIT_META[a.action];return `<tr>
        <td class="cell-muted mono" style="white-space:nowrap">${a.t}</td>
        <td><div class="row center gap-8">${avatar(a.actor.replace(' (siz)',''),24)}<span class="cell-strong">${a.actor}</span></div></td>
        <td><span class="badge" style="background:var(--${m.cls}-dim);color:var(--${m.cls});border-color:var(--${m.cls}-line,var(--line))">${ic(m.ic)}${m.label}</span></td>
        <td class="cell-muted">${a.target}</td>
        <td class="cell-muted mono">${a.ip}</td>
      </tr>`;}).join('')}</tbody>
    </table></div></div>
  </div>`;
};

/* ============================================================
   DRAWER — template quick view
   ============================================================ */
function openTplDrawer(id){
  const t=TEMPLATES.find(x=>x.id===id); const con=cById(t.cid);
  openDrawer(`
    <div class="drawer-head"><span class="h3 grow">Shablon tafsiloti</span><button class="icon-btn" onclick="closeDrawer()">${ic('x')}</button></div>
    <div class="drawer-body col gap-16">
      ${typeof StudioMedia!=='undefined'?`<div style="border-radius:var(--r-md);overflow:hidden">${StudioMedia.renderPreview(t,{aspect:'16/9',radius:'var(--r-md)'})}</div>`:`<div class="thumb ${t.grad} grain" style="width:100%;aspect-ratio:16/9;border-radius:var(--r-md)"></div>`}
      <div class="row gap-8 wrap">${typeof StudioMedia!=='undefined'?StudioMedia.filePills(t):''}</div>
      <div class="row between center"><span class="h3">${t.name}</span>${badge(t.status)}</div>
      <p class="body">${t.desc}</p>
      <div class="meta-grid">${[['ID',t.id],['Kategoriya',t.cat],['Resolution',t.res],['Downloads',t.dl?t.dl.toLocaleString():'\u2014'],['Fayl',t.size],['Yuklangan',t.created]].map(([k,v])=>`<div><div class="label" style="margin-bottom:3px">${k}</div><div class="cell-strong">${v}</div></div>`).join('')}</div>
      <div class="row gap-6 wrap">${t.tags.map(x=>`<span class="pill">${ic('tag')}${x}</span>`).join('')}</div>
      <div class="divider"></div>
      <div class="row center gap-10">${avatar(con.name,34)}<div class="col grow" style="gap:1px"><span class="cell-strong">${con.name}</span><span class="small">${con.email}</span></div><button class="btn btn-ghost btn-sm" onclick="closeDrawer();route('contributor-detail','${con.id}')">Profil</button></div>
      ${t.reason?`<div class="info-banner ${t.status==='hard'?'danger':'warn'}" style="align-items:flex-start">${ic('alert')}<div><b style="color:var(--tx-0)">Qaror sababi</b><div class="small mt-4" style="color:var(--tx-1)">${t.reason}</div></div></div>`:''}
    </div>
    <div class="drawer-foot">
      ${t.status==='pending'||t.status==='soft'?`<button class="btn btn-success grow" onclick="closeDrawer();modApprove('${t.id}')">${ic('check')} Tasdiqlash</button><button class="btn btn-warn grow" onclick="closeDrawer();modSoftReject('${t.id}')">${ic('reply')} Soft reject</button>`:`<button class="btn btn-ghost grow" onclick="openEditMeta('${t.id}')">${ic('edit')} Tahrirlash</button>`}
    </div>`);
}

/* ============================================================
   MODALS & ACTIONS
   ============================================================ */
function tName(id){ return TEMPLATES.find(t=>t.id===id).name; }

function modApprove(id){
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--green-dim);color:var(--green)">${ic('checkCircle')}</div>
      <div><h3>Shablonni tasdiqlash</h3><p>"${tName(id)}" AE katalogiga qo\u2018shiladi.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner">${ic('ext')}<span>Tasdiqlangach bu shablon obunachilar uchun <b>After Effects \u2192 AssetFlow Browse</b> panelida darhol ko\u2018rinadi.</span></div>
      <label class="row center gap-8" style="cursor:pointer"><div class="checkbox on" onclick="this.classList.toggle('on')">${ic('check')}</div><span class="body">Contributorga tasdiq xabarini yuborish</span></label>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-success" onclick="modApproveConfirm('${id}')">${ic('check')} Tasdiqlash va nashr</button></div>`);
}

async function modApproveConfirm(id) {
  closeModal();
  if (!StudioApi.token()) {
    toast("API", "Admin sifatida API orqali kiring", "warn");
    return;
  }
  try {
    await StudioApi.reviewTemplate(id, "approve");
    await StudioTemplates.refreshAfterReview();
    toast("Tasdiqlandi", `\u201c${tName(id)}\u201d AE Browse katalogida`, "success");
    if (typeof AssetFlowLog !== "undefined") {
      AssetFlowLog.info("Shablon tasdiqlandi", { action: "approve", detail: id });
    }
    MOD_SELECTED = null;
    renderModeration();
  } catch (e) {
    toast("Xato", e.message || "Tasdiqlash muvaffaqiyatsiz", "danger");
  }
}

function modSoftReject(id){
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--orange-dim);color:var(--orange)">${ic('reply')}</div>
      <div><h3>Soft reject</h3><p>Contributor sababni ko\u2018radi va tuzatib qayta yuborishi mumkin.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="field"><label>Rad sababi <span class="req">*</span></label><textarea class="textarea" placeholder="Aniq, foydali izoh yozing \u2014 contributor nimani tuzatishini bilsin\u2026">Preview sifati past. Iltimos kamida 15 Mbps bitrate bilan qayta eksport qiling.</textarea></div>
      <div class="field"><label>Kategoriya</label><select class="select" style="height:38px;width:100%"><option>Sifat / kompressiya</option><option>Noto\u2018g\u2018ri metadata</option><option>Texnik nosozlik</option><option>Boshqa</option></select></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-warn" onclick="modRejectConfirm('${id}',false)">${ic('reply')} Yuborish</button></div>`);
}

async function modRejectConfirm(id, hard) {
  closeModal();
  const note =
    document.querySelector(".modal-body textarea")?.value?.trim() ||
    "Moderatsiya rad etildi";
  if (!StudioApi.token()) {
    toast("API", "Admin sifatida API orqali kiring", "warn");
    return;
  }
  try {
    await StudioApi.reviewTemplate(
      id,
      "reject",
      hard ? `[hard] ${note}` : note
    );
    await StudioTemplates.refreshAfterReview();
    toast(
      hard ? "Hard reject" : "Soft reject",
      "Contributorga xabar yuborildi (demo)",
      hard ? "danger" : "warn"
    );
    MOD_SELECTED = null;
    renderModeration();
  } catch (e) {
    toast("Xato", e.message || "Rad etish muvaffaqiyatsiz", "danger");
  }
}

function modHardReject(id){
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--red-dim);color:var(--red)">${ic('ban')}</div>
      <div><h3>Hard reject</h3><p>Qat\u2018iy rad \u2014 qayta yuborish imkoni yo\u2018q.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner danger">${ic('alert')}<span>Bu amal qaytarib bo\u2018lmaydi. Shablon butunlay rad etiladi.</span></div>
      <div class="field"><label>Sabab <span class="req">*</span></label><textarea class="textarea" placeholder="Masalan: litsenziyasiz musiqa, stock qayta sotish, copyright buzilishi\u2026"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-danger" onclick="modRejectConfirm('${id}',true)">${ic('ban')} Hard reject</button></div>`);
}

function modDelete(id){
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--red-dim);color:var(--red)">${ic('trash')}</div>
      <div><h3>Shablonni o\u2018chirish</h3><p>"${tName(id)}" butunlay o\u2018chiriladi.</p></div></div>
    <div class="modal-body"><div class="info-banner danger">${ic('alert')}<span>Bu destructive amal. Fayllar va statistika qaytarilmaydi.</span></div></div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-danger" onclick="modDeleteConfirm('${id}')">${ic('trash')} O\u2018chirish</button></div>`);
}

async function modDeleteConfirm(id) {
  closeModal();
  if (!StudioApi.token()) {
    toast("API", "Admin sifatida kiring", "warn");
    return;
  }
  try {
    await StudioApi.deleteTemplate(id);
    await StudioTemplates.refreshAfterReview();
    if (MOD_SELECTED === id) MOD_SELECTED = null;
    toast("O'chirildi", "Shablon tizimdan olib tashlandi", "danger");
    if (CURRENT === "moderation") renderModeration();
    else if (CURRENT === "templates") renderTemplates();
  } catch (e) {
    toast("Xato", e.message || "O'chirish muvaffaqiyatsiz", "danger");
  }
}

function openEditMeta(id){
  const t=TEMPLATES.find(x=>x.id===id);
  const { cat, catLabel } = typeof catFromLabel === "function" ? catFromLabel(t.cat) : { cat: "intros", catLabel: t.cat };
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--blue-dim);color:var(--blue)">${ic('edit')}</div>
      <div><h3>Metadata tahrirlash</h3><p>Admin override \u2014 ${t.id}</p></div></div>
    <div class="modal-body col gap-12" id="editMetaBody">
      <div class="field"><label>Nomi</label><input id="emName" class="input" value="${t.name.replace(/"/g,'&quot;')}"></div>
      <div class="field"><label>Tavsif</label><textarea id="emDesc" class="textarea">${(t.desc||'').replace(/</g,'&lt;')}</textarea></div>
      <div class="row gap-12"><div class="field grow"><label>Kategoriya</label><select id="emCat" class="select" style="height:38px;width:100%">${CATS.map(c=>`<option ${c===t.cat||c===t.catLabel?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field grow"><label>Resolution</label><input id="emRes" class="input" value="${t.res}"></div></div>
      <div class="field"><label>Teglar</label><input id="emTags" class="input" value="${t.tags.join(', ')}"></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-primary" onclick="saveEditMeta('${id}')">Saqlash</button></div>`);
}

async function saveEditMeta(id) {
  if (!StudioApi.token()) {
    toast("API", "Admin sifatida kiring", "warn");
    return;
  }
  const name = document.getElementById("emName")?.value?.trim();
  const description = document.getElementById("emDesc")?.value?.trim();
  const catLabel = document.getElementById("emCat")?.value;
  const resRaw = document.getElementById("emRes")?.value || "4K";
  const tags = (document.getElementById("emTags")?.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const mapped = typeof catFromLabel === "function" ? catFromLabel(catLabel) : { cat: "intros", catLabel };
  try {
    await StudioApi.patchTemplate(id, {
      name,
      description,
      cat: mapped.cat,
      catLabel: mapped.catLabel,
      res: resRaw.toLowerCase().includes("1080") ? "1080p" : "4k",
      tags,
    });
    await StudioTemplates.refreshAfterReview();
    closeModal();
    toast("Saqlandi", "Metadata yangilandi", "success");
    if (CURRENT === "moderation") renderModeration();
    else if (CURRENT === "templates") renderTemplates();
  } catch (e) {
    toast("Xato", e.message || "Saqlash muvaffaqiyatsiz", "danger");
  }
}

function openBlock(id){
  const c=cById(id);
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--red-dim);color:var(--red)">${ic('ban')}</div>
      <div><h3>Contributorni bloklash</h3><p>${c.name} platformaga kira olmaydi.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner danger">${ic('alert')}<span>Bloklangan contributor yangi shablon yuklay olmaydi. Mavjud approved shablonlar AE\u2018da qoladi (alohida o\u2018chirmaguningizcha).</span></div>
      <div class="field"><label>Bloklash sababi <span class="req">*</span></label><textarea class="textarea" placeholder="Sabab \u2014 audit logga yoziladi\u2026"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-danger" onclick="doBlock('${id}')">${ic('ban')} Bloklash</button></div>`);
}
function doBlock(id){ const c=cById(id); c.status='blocked'; closeModal(); toast('Bloklandi',`${c.name} bloklandi`,'danger'); if(typeof AssetFlowLog!=='undefined') AssetFlowLog.warn('Contributor bloklandi',{action:'block',detail:c.email}); route(CURRENT==='contributor-detail'?'contributor-detail':'contributors', id); }
function unblock(id){ const c=cById(id); c.status='active'; toast('Blokdan chiqarildi',`${c.name} qayta faollashtirildi`,'success'); route(CURRENT==='contributor-detail'?'contributor-detail':'contributors', id); }

function openMessage(cid, tid){
  const c=cById(cid);
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">${ic('message')}</div>
      <div><h3>Xabar yozish</h3><p>${c.name} ga${tid?' \u00b7 '+tid:''}</p></div></div>
    <div class="modal-body col gap-12">
      <div class="segmented" style="width:100%"><button class="active grow">${ic('message')} In-app</button><button class="grow">${ic('mail')} Email preview</button></div>
      <div class="field"><label>Mavzu</label><input class="input" value="${tid?tName(tid)+' \u2014 moderatsiya':'AssetFlow xabar'}"></div>
      <div class="field"><label>Xabar</label><textarea class="textarea" placeholder="Xabaringiz\u2026"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-primary" onclick="closeModal();toast('Yuborildi','Xabar '+'${c.name}'+' ga yetkazildi','success')">${ic('send')} Yuborish</button></div>`);
}

function openBroadcast(){
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--yellow-dim);color:var(--yellow)">${ic('megaphone')}</div>
      <div><h3>Broadcast e\u2018lon</h3><p>Barcha faol contributorlarga yuboriladi.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner warn">${ic('alert')}<span>Bu xabar <b>${CONTRIBUTORS.filter(c=>c.status==='active').length} ta</b> contributorga bir vaqtda boradi. Ehtiyot bo\u2018ling.</span></div>
      <div class="field"><label>Sarlavha</label><input class="input" placeholder="Masalan: Yangi kategoriya ochildi"></div>
      <div class="field"><label>Xabar</label><textarea class="textarea"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-warn" onclick="closeModal();toast('Broadcast yuborildi','Barcha faol contributorlarga e\u2018lon yetkazildi','success')">${ic('megaphone')} Yuborish</button></div>`);
}
