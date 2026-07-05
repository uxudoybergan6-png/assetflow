/* ============================================================
   AssetFlow — Admin views (part 2):
   Templates, Contributors, Detail, Messaging, Analytics,
   Settings, Audit + all modals & actions
   ============================================================ */

/* ============================================================
   XSS guard — escape untrusted server/user strings before innerHTML.
   Reuses window.StudioMedia.escapeHtml when available (same page),
   with a self-contained fallback.
   ============================================================ */
const esc = (s) =>
  (window.StudioMedia && StudioMedia.escapeHtml
    ? StudioMedia.escapeHtml(s)
    : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c])));

/* ============================================================
   ALL TEMPLATES — global table
   ============================================================ */
let T_FILTER = 'all', T_SEARCH = '';
VIEWS.templates = function(){ return `<div id="tplRoot"></div>`; };
window.afterRender.templates = function(){ tplTopbarActions(); renderTemplates(); };

/* Topbar amallari (maket e3): Filtr + CSV. Qidiruv global topbar orqali. */
function tplTopbarActions(){
  const tba = document.getElementById('tbActions');
  if(!tba || (typeof CURRENT!=='undefined' && CURRENT!=='templates')) return;
  tba.innerHTML =
    `<button class="adx-btn2 sm" onclick="toast('Filtr','Kengaytirilgan filtr keyingi versiyada','info')"><i class="ph ph-funnel"></i>Filtr</button>`+
    `<button class="adx-btn2 sm" onclick="toast('Eksport','CSV fayli tayyorlanmoqda\u2026','info')"><i class="ph ph-export"></i>CSV</button>`;
}

function shortId(id){
  id = String(id||'');
  return id.length>10 ? id.slice(0,4)+'\u2026'+id.slice(-4) : id;
}

function renderTemplates(){
  let rows = TEMPLATES.slice();
  if(T_FILTER!=='all') rows = rows.filter(t=>t.status===T_FILTER);
  if(T_SEARCH) rows = rows.filter(t=>(t.name+t.id+cById(t.cid).email).toLowerCase().includes(T_SEARCH.toLowerCase()));
  const c=counts();
  const tags = [['all','Barchasi',c.total],['approved','Tasdiqlangan',c.approved],['pending','Kutilmoqda',c.pending],['soft','Soft',c.soft],['hard','Hard',c.hard],['draft','Qoralama',c.draft],['archived','Arxiv',c.archived]];
  const decision = (t) => {
    if(t.reason) return `<span style="font-size:11px;color:${t.status==='hard'?'#FF6B5E':'#FFB27C'}">${esc(t.reason)}</span>`;
    if(t.status==='approved') return `<span style="color:#5E6675">\u2014</span>`;
    return `<span style="color:#5E6675">\u2014</span>`;
  };
  document.getElementById('tplRoot').innerHTML = `
    <div class="adx-tagrow">
      ${tags.map(([k,l,n])=>`<button class="adx-tag ${T_FILTER===k?'on':''}" onclick="T_FILTER='${k}';renderTemplates()">${l} <span class="n">${n}</span></button>`).join('')}
    </div>
    <div class="adx-card" style="overflow:hidden">
      <div style="overflow-x:auto">
        <table class="adx-tbl" style="min-width:1000px">
          <thead><tr>
            <th style="width:24px"></th><th>Shablon</th><th>ID</th><th>Contributor</th><th>Holat</th><th>Yuklangan</th><th class="r">Downloads</th><th>Oxirgi qaror</th><th class="r">Amal</th>
          </tr></thead>
          <tbody>
          ${rows.length ? rows.map(t=>{ const con=cById(t.cid); return `<tr>
            <td><span class="adx-modcheck" onclick="this.classList.toggle('on')"><i class="ph-bold ph-check"></i></span></td>
            <td><div style="display:flex;align-items:center;gap:10px"><span style="width:44px;height:30px;border-radius:6px;flex:none;overflow:hidden;display:block;background:var(--media)">${adxModThumb(t)}</span><div style="min-width:0"><div style="font-weight:600;font-size:12.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</div><div style="font-size:10px;color:#8A93A3">${esc(t.cat)} \u00b7 ${esc(t.res)}</div></div></div></td>
            <td class="adx-num" style="font-size:10.5px;color:#8A93A3" title="${esc(t.id)}">${esc(shortId(t.id))}</td>
            <td style="font-size:11px;color:#8A93A3">${esc((con.email||'').split('@')[0])}${con.email?'@\u2026':''}</td>
            <td>${axTplStatus(t.status)}</td>
            <td class="adx-num" style="font-size:11px;color:#8A93A3">${esc(t.created||'\u2014')}</td>
            <td class="r adx-num">${t.dl?t.dl.toLocaleString():'\u2014'}</td>
            <td>${decision(t)}</td>
            <td class="r"><div style="display:flex;gap:6px;justify-content:flex-end;align-items:center">
              <span class="adx-bdg ${t.isPro?'adx-bdg-pro':'adx-bdg-free'}" style="cursor:pointer" title="${t.isPro?'Pro \u2014 bosib Free qiling':'Free \u2014 bosib Pro qiling'}" onclick="openToggleTierTpl('${t.id}')">${t.isPro?'PRO':'FREE'}</span>
              <button class="adx-iact" title="Ko\u2018rish" onclick="openTplDrawer('${t.id}')"><i class="ph ph-eye"></i></button>
              <button class="adx-iact" title="Tahrir" onclick="openEditMeta('${t.id}')"><i class="ph ph-pencil-simple"></i></button>
              <button class="adx-iact dg" title="O\u2018chirish" onclick="modDelete('${t.id}')"><i class="ph ph-trash"></i></button>
            </div></td>
          </tr>`; }).join('') : `<tr><td colspan="9"><div class="adx-empty" style="border:0;padding:34px 20px"><span class="ei"><i class="ph ph-stack"></i></span><div style="font-weight:600;font-size:13px">Shablon topilmadi</div><div style="font-size:11px;color:var(--muted2)">Filtr yoki qidiruvni o\u2018zgartiring.</div></div></td></tr>`}
          </tbody>
        </table>
      </div>
      <div style="display:flex;align-items:center;padding:12px 16px;border-top:1px solid var(--hair2)">
        <span class="adx-num" style="font-size:11px;color:#8A93A3">${rows.length} ta natija ko\u2018rsatildi</span>
        <span style="flex:1"></span>
        <button class="adx-btn2 sm" disabled><i class="ph ph-caret-left"></i></button>
        <span class="adx-num" style="font-size:11px;color:#B7C0CE;padding:0 8px">1 / 1</span>
        <button class="adx-btn2 sm" disabled><i class="ph ph-caret-right"></i></button>
      </div>
    </div>`;
}

/* ============================================================
   CONTRIBUTORS — list
   ============================================================ */
let C_LIST_SEARCH = "";
let C_STATUS_FILTER = "all";
window.afterRender.contributors = function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='contributors'){
    tba.innerHTML =
      `<label class="adx-sel"><i class="ph ph-funnel" style="font-size:13px"></i><span>${C_STATUS_FILTER==='all'?'Barcha holat':(C_STATUS_FILTER==='active'?'Faol':'Bloklangan')}</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i><select onchange="C_STATUS_FILTER=this.value;route('contributors')"><option value="all">Barcha holat</option><option value="active" ${C_STATUS_FILTER==='active'?'selected':''}>Faol</option><option value="blocked" ${C_STATUS_FILTER==='blocked'?'selected':''}>Bloklangan</option></select></label>`+
      `<button class="adx-btn2 sm" onclick="toast('Eksport','Contributorlar CSV tayyorlanmoqda…','info')"><i class="ph ph-export"></i>CSV</button>`;
  }
};
VIEWS.contributors = function(){
  const q = (C_LIST_SEARCH || (typeof ADMIN_GLOBAL_SEARCH !== "undefined" ? ADMIN_GLOBAL_SEARCH : "")).toLowerCase();
  let list = q
    ? CONTRIBUTORS.filter((c) => (c.name + " " + c.email).toLowerCase().includes(q))
    : CONTRIBUTORS.slice();
  if(C_STATUS_FILTER!=='all') list = list.filter(c=>c.status===C_STATUS_FILTER);
  const rows = list.map(c=>{
    const ts=tByContributor(c.id);
    return {c, total:ts.length, ap:ts.filter(t=>t.status==='approved').length, pe:ts.filter(t=>t.status==='pending').length, re:ts.filter(t=>['soft','hard'].includes(t.status)).length};
  });
  const appr = typeof platformApprovalRatePct === "function" ? platformApprovalRatePct() : null;
  return `
    <div class="adx-grid4" style="margin-bottom:18px">
      ${axStat({label:'Jami contributorlar',val:CONTRIBUTORS.length,ic:'users-three',icColor:'#7CC4FF',foot:'ro‘yxatdan o‘tgan'})}
      ${axStat({label:'Faol',val:CONTRIBUTORS.filter(c=>c.status==='active').length,ic:'check-circle',icColor:'#C2F04A',foot:'kontent yuklamoqda'})}
      ${axStat({label:'Bloklangan',val:CONTRIBUTORS.filter(c=>c.status==='blocked').length,ic:'prohibit',icColor:'#FF6B5E',foot:'kirish cheklangan'})}
      ${axStat({label:'Approval rate',val:appr!=null?appr+'%':'—',ic:'crown',foot:appr!=null?'tasdiq / rad':'qaror yo‘q'})}
    </div>
    <div class="adx-card" style="overflow:hidden">
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:1020px">
        <thead><tr><th>Contributor</th><th>Holat</th><th class="r">Jami</th><th class="r">Approved</th><th class="r">Pending</th><th class="r">Rejected</th><th>Oxirgi faoliyat</th><th class="r">Amal</th></tr></thead>
        <tbody>
        ${rows.length ? rows.map(({c,total,ap,pe,re})=>`<tr style="cursor:pointer" onclick="route('contributor-detail','${c.id}')">
          <td><div class="adx-who">${axAv(c.name,c.email,32)}<div style="min-width:0"><div class="nm">${esc(c.name)}</div><div class="em">${esc(c.email)}</div></div></div></td>
          <td>${axStatus(c.status==='blocked'?'blocked':'active')}</td>
          <td class="r adx-num">${total}</td>
          <td class="r adx-num" style="color:#C2F04A">${ap}</td>
          <td class="r adx-num" style="color:#FFB27C">${pe||'—'}</td>
          <td class="r adx-num" style="color:#FF6B5E">${re||'—'}</td>
          <td class="adx-num" style="font-size:11px;color:#8A93A3">${esc(c.joined||'—')}</td>
          <td class="r" onclick="event.stopPropagation()"><div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="adx-iact" title="Xabar" onclick="openMessage('${c.id}')"><i class="ph ph-chat-circle"></i></button>
            ${c.status==='active'?`<button class="adx-iact dg" title="Bloklash" onclick="openBlock('${c.id}')"><i class="ph ph-prohibit"></i></button>`:`<button class="adx-iact" title="Blokdan chiqarish" onclick="unblock('${c.id}')"><i class="ph ph-check-circle"></i></button>`}
            <button class="adx-iact" title="Profil" onclick="route('contributor-detail','${c.id}')"><i class="ph ph-caret-right"></i></button>
          </div></td>
        </tr>`).join('') : `<tr><td colspan="8"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-users-three"></i></span><div style="font-weight:600;font-size:13px">Contributor topilmadi</div><div style="font-size:11px;color:var(--muted2)">Qidiruv yoki filtrni o‘zgartiring.</div></div></td></tr>`}
        </tbody>
      </table></div>
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
  return `
    <button class="adx-btn2 sm" style="margin-bottom:16px" onclick="route('contributors')"><i class="ph ph-caret-left"></i>Contributorlar</button>
    ${blocked?axInfo(`<b style="color:var(--text)">Bu contributor bloklangan</b> — kirish cheklangan, yangi yuklash mumkin emas. <a style="color:#FF6B5E;text-decoration:underline;cursor:pointer" onclick="unblock('${c.id}')">Blokdan chiqarish</a>`,'red'):''}
    <div class="adx-card" style="padding:18px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      ${axAv(c.name,c.email,56)}
      <div style="flex:1;min-width:220px"><div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap"><span class="adx-h18">${esc(c.name)}</span>${axStatus(blocked?'blocked':'active')}</div>
        <div style="font-size:11.5px;color:#8A93A3;margin-top:3px">${esc(c.email)}${c.country?' · '+esc(c.country):''}${c.joined?' · Ro‘yxatdan: '+esc(c.joined):''}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="adx-btn2 sm" onclick="openMessage('${c.id}')"><i class="ph ph-chat-circle"></i>Xabar yozish</button>
        ${blocked?`<button class="adx-btn2 sm adx-btn-ok" onclick="unblock('${c.id}')"><i class="ph ph-check-circle"></i>Blokdan chiqarish</button>`:`<button class="adx-btn-danger adx-btn-dghost sm" onclick="openBlock('${c.id}')"><i class="ph ph-prohibit"></i>Bloklash</button>`}
      </div>
    </div>
    <div class="adx-grid4" style="margin-top:16px">
      ${axStat({label:'Jami shablon',val:ts.length,ic:'stack'})}
      ${axStat({label:'Tasdiqlangan',val:ap,ic:'check-circle',icColor:'#C2F04A',foot:'AE‘da live'})}
      ${axStat({label:'Kutilmoqda',val:pe,ic:'clock-countdown',icColor:'#FFB27C'})}
      ${axStat({label:'Rad etilgan',val:re,ic:'x-circle',icColor:'#FF6B5E',foot:'soft + hard'})}
    </div>
    <div class="adx-card" style="overflow:hidden;margin-top:16px">
      <div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Yuklangan shablonlar</span><span style="flex:1"></span><span style="font-size:11px;color:#8A93A3">${ts.length} ta element</span>
        ${pe?`<button class="adx-btn2 sm" style="margin-left:10px" onclick="route('moderation')"><i class="ph ph-shield-check"></i>${pe} ta pending</button>`:''}</div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:760px">
        <thead><tr><th>Shablon</th><th>Holat</th><th>Kategoriya</th><th class="r">Downloads</th><th>Sana</th><th class="r"></th></tr></thead>
        <tbody>
        ${ts.length?ts.map(t=>`<tr>
          <td><div style="display:flex;align-items:center;gap:9px"><span style="width:38px;height:26px;border-radius:5px;flex:none;overflow:hidden;display:block;background:var(--media)">${adxModThumb(t)}</span><div style="min-width:0"><div style="font-weight:600;font-size:12px;color:var(--text)">${esc(t.name)}</div><div class="adx-num" style="font-size:9.5px;color:#8A93A3">${esc(shortId(t.id))}</div></div></div></td>
          <td>${axTplStatus(t.status,true)}</td><td style="font-size:11.5px;color:#B7C0CE">${esc(t.cat)}</td>
          <td class="r adx-num">${t.dl?t.dl.toLocaleString():'—'}</td>
          <td class="adx-num" style="font-size:11px;color:#8A93A3">${esc(t.created||'—')}</td>
          <td class="r"><button class="adx-iact" onclick="openTplDrawer('${t.id}')"><i class="ph ph-eye"></i></button></td>
        </tr>`).join('')
        :`<tr><td colspan="6"><div class="adx-empty" style="border:0;padding:30px"><span class="ei"><i class="ph ph-stack"></i></span><div style="font-size:12px;color:var(--muted2)">Hali shablon yo‘q</div></div></td></tr>`}
        </tbody>
      </table></div>
    </div>`;
};

/* ============================================================
   MESSAGING
   ============================================================ */
let ADMIN_THREADS = [];
let MSG_SEL = 0;
let ADMIN_THREAD_MESSAGES = [];

function adminMsgUnread() {
  return ADMIN_THREADS.reduce((a, t) => a + (t.unread ? 1 : 0), 0);
}

async function loadAdminThreads() {
  if (!StudioApi.token()) return [];
  const { items } = await StudioApi.listMessageThreads();
  return items.map((t) => ({
    id: t.id,
    cid: t.contributorId,
    sub: t.subject,
    last: t.lastMessage,
    t: String(t.lastMessageAt || "").slice(0, 10),
    unread: t.unreadCount > 0,
    tid: t.templateId,
    isBroadcast: t.isBroadcast,
    contributorName: t.contributor?.name || t.contributor?.email,
  }));
}

VIEWS.messaging = function(){ return `<div id="msgRoot" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>`; };
window.afterRender.messaging = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='messaging') tba.innerHTML = `<button class="adx-btn sm" onclick="openBroadcast()"><i class="ph ph-chat-circle-dots"></i>Broadcast e‘lon</button>`;
  const root = document.getElementById("msgRoot");
  root.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center"><span class="adx-spin"><i class="ph ph-arrow-clockwise"></i></span></div>`;
  try {
    ADMIN_THREADS = await loadAdminThreads();
    window._STUDIO_MSG_UNREAD = ADMIN_THREADS.reduce((a, t) => a + (t.unread ? 1 : 0), 0);
    if (typeof renderNav === "function") renderNav();
    MSG_SEL = 0;
    await renderMessaging();
  } catch (e) {
    root.innerHTML = `<div class="adx-empty" style="max-width:420px;margin:40px auto"><span class="ei"><i class="ph ph-warning"></i></span><div style="font-weight:600;font-size:13px">Xatolik</div><div style="font-size:11px;color:var(--muted2)">${esc(e.message)}</div></div>`;
  }
};

async function selectAdminThread(i) {
  MSG_SEL = i;
  await renderMessaging();
}

async function renderMessaging(){
  const root = document.getElementById("msgRoot");
  if(!root) return;
  if (!ADMIN_THREADS.length) {
    root.innerHTML = `<div class="adx-empty" style="max-width:420px;margin:auto"><span class="ei"><i class="ph ph-chat-circle-dots"></i></span><div style="font-weight:600;font-size:13px">Suhbat yo‘q</div><div style="font-size:11px;color:var(--muted2);line-height:1.5">Contributorlarga xabar yuboring yoki moderatsiya qiling.</div></div>`;
    return;
  }
  if (MSG_SEL >= ADMIN_THREADS.length) MSG_SEL = 0;
  const th = ADMIN_THREADS[MSG_SEL];
  const c = cById(th.cid);
  ADMIN_THREAD_MESSAGES = [];
  try {
    const data = await StudioApi.getMessageThread(th.id);
    ADMIN_THREAD_MESSAGES = data.messages || [];
    await StudioApi.markMessageThreadRead(th.id);
    th.unread = false;
    window._STUDIO_MSG_UNREAD = adminMsgUnread();
    if (typeof renderNav === "function") renderNav();
  } catch (e) {
    if (typeof toast === "function") toast("Xato", e.message || "Xabarlar yuklanmadi", "danger");
  }
  const unread = adminMsgUnread();
  root.innerHTML = `
    <div style="flex:1;display:flex;min-height:0">
      <div style="width:320px;flex:none;border-right:1px solid var(--hair);display:flex;flex-direction:column;min-height:0">
        <div class="adx-cardhd" style="border-bottom:1px solid var(--hair)"><span class="adx-h16" style="font-size:13.5px">Suhbatlar</span>${unread?`<span class="adx-nbadge brand" style="margin-left:6px">${unread}</span>`:''}</div>
        <div style="flex:1;overflow:auto">
          ${ADMIN_THREADS.map((t,i)=>{const cc=cById(t.cid); const nm = t.contributorName || cc.name; const sel=i===MSG_SEL; return `<button style="display:flex;gap:10px;padding:12px 14px;width:100%;text-align:left;font-family:inherit;color:inherit;cursor:pointer;border:0;border-left:2px solid ${sel?'var(--lime)':'transparent'};background:${sel?'var(--surface2)':'none'}" onclick="selectAdminThread(${i})">
            ${axAv(nm,t.cid,34)}
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px"><span style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(cc.name)}</span>${t.unread?'<span style="width:6px;height:6px;border-radius:50%;background:#C2F04A;margin-left:auto;flex:none"></span>':`<span style="margin-left:auto;font-size:10px;color:#8A93A3;flex:none">${esc(t.t||'')}</span>`}</div>
              <div style="font-size:11px;color:#8A93A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.sub||'')}</div>
              <div style="font-size:10.5px;color:#8A93A3;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.last||'')}</div>
            </div>
          </button>`;}).join('')}
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;min-width:0">
        <div class="adx-cardhd" style="border-bottom:1px solid var(--hair)">${axAv(c.name,th.cid,32)}<div><div style="font-weight:600;font-size:13px">${esc(c.name)}</div><div class="adx-num" style="font-size:10px;color:#8A93A3">${th.tid?'Shablon: '+esc(shortId(th.tid)):'Umumiy suhbat'}</div></div><span style="flex:1"></span><button class="adx-btn2 sm" onclick="route('contributor-detail','${c.id}')"><i class="ph ph-user"></i>Profil</button></div>
        <div class="adx-chatwrap">
          ${ADMIN_THREAD_MESSAGES.length ? ADMIN_THREAD_MESSAGES.map((m) => {
            const isMe = m.sender?.isMe;
            const nm = m.sender?.name || c.name;
            const t = String(m.createdAt || "").slice(0,16).replace("T"," ");
            return `<div class="adx-msg ${isMe?'me':''}">${isMe?'<span class="adx-av" style="width:28px;height:28px;font-size:10px;background:linear-gradient(140deg,#7b5cff,#4a2fb0)">AD</span>':axAv(nm,th.cid,28)}<div><div class="adx-bub">${esc(m.body)}</div><div class="adx-msgt">${esc(t)}${isMe?' · Admin':''}</div></div></div>`;
          }).join("") : `<div class="adx-empty" style="border:0;margin:auto"><span class="ei"><i class="ph ph-chat-circle"></i></span><div style="font-size:11.5px;color:var(--muted2)">Hali xabar yo‘q</div></div>`}
        </div>
        <div style="padding:12px 18px;border-top:1px solid var(--hair);display:flex;align-items:center;gap:10px"><input id="adminReplyInput" class="adx-input" placeholder="Xabar yozing…" style="flex:1" onkeydown="if(event.key==='Enter')sendAdminReply()"><button class="adx-btn sm" onclick="sendAdminReply()"><i class="ph ph-arrow-right"></i>Yuborish</button></div>
      </div>
    </div>`;
}

/* ============================================================
   ANALYTICS (deep)
   ============================================================ */
window.afterRender.analytics = function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='analytics') tba.innerHTML = `<span class="adx-sel"><i class="ph ph-clock-countdown" style="font-size:13px"></i><span>So‘nggi 30 kun</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i></span>`;
};
VIEWS.analytics = function(){
  const usage = typeof window !== "undefined" ? window._ASSETFLOW_PLUGIN_ANALYTICS?.usage : null;
  const totalDl = usage?.downloadsTotal ?? counts().totalDl;
  const appr = window._ASSETFLOW_PLUGIN_ANALYTICS?.approvalRatePct ?? (typeof platformApprovalRatePct === "function" ? platformApprovalRatePct() : null);
  const avgDl = typeof avgDownloadsPerApproved === "function" ? avgDownloadsPerApproved() : 0;
  const contribRank = CONTRIBUTORS.map(c=>{const ts=tByContributor(c.id);const dl=ts.reduce((a,t)=>a+t.dl,0);const ap=ts.filter(t=>t.status==='approved').length;return {c,dl,ap,total:ts.length,rate:ts.length?Math.round(ap/ts.length*100):0};}).sort((a,b)=>b.dl-a.dl);
  const maxDl = contribRank[0]?.dl || 1;
  const rejectBlock = REJECT_REASONS.length > 0
    ? REJECT_REASONS.map(r=>{const tot=r.soft+r.hard; const s=tot?r.soft/tot*100:0; const h=tot?r.hard/tot*100:0; return `<div><div style="display:flex;font-size:11.5px;margin-bottom:5px"><span style="flex:1;color:var(--text)">${esc(r.nm)}</span><span class="adx-num" style="color:#8A93A3">${tot}</span></div><div style="height:7px;border-radius:99px;overflow:hidden;display:flex">${s?`<span style="width:${s}%;background:#FFB27C"></span>`:''}${h?`<span style="width:${h}%;background:#FF6B5E"></span>`:''}</div></div>`;}).join('')
    : `<div class="adx-empty" style="border:0;padding:20px"><span class="ei"><i class="ph ph-check-circle"></i></span><div style="font-size:11px;color:var(--muted2)">Rad etilgan shablonlar sababi hali yo‘q</div></div>`;
  const barMax = typeof chartMax === "function" ? chartMax(DL_30) : Math.max(...DL_30, 1);
  const rankColors = ['#C2F04A','#8A93A3','#8A93A3','#8A93A3'];
  return `
    <div class="adx-grid4" style="margin-bottom:18px">
      ${axStat({label:'Jami yuklab olishlar',val:axNum(totalDl),ic:'download-simple',foot:'plugin hisobi'})}
      ${axStat({label:'O‘rtacha / tasdiqlangan',val:counts().approved?String(avgDl):'—',ic:'chart-bar',foot:'yuklab olish / shablon'})}
      ${axStat({label:'Approval rate',val:appr!=null?appr+'%':'—',ic:'check-circle',icColor:'#C2F04A',foot:'DB bo‘yicha'})}
      ${axStat({label:'Audit (30 kun)',val:DL_30.reduce((a,b)=>a+b,0),ic:'shield-check',icColor:'#7CC4FF',foot:'moderatsiya va tizim'})}
    </div>
    <div class="adx-grid2">
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Contributor leaderboard</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">DOWNLOADS BO‘YICHA</span></div>
        <div style="padding:12px 16px;display:flex;flex-direction:column;gap:11px">
          ${contribRank.length? contribRank.slice(0,6).map((r,i)=>`<div style="display:flex;align-items:center;gap:11px"><span class="adx-num" style="font-size:11px;color:${rankColors[i]||'#8A93A3'};width:16px">${i+1}</span>${axAv(r.c.name,r.c.email,28)}<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.c.name)}</div><div class="adx-prog" style="margin-top:5px"><div class="pb" style="width:${maxDl?r.dl/maxDl*100:0}%"></div></div></div><span class="adx-num" style="font-size:11.5px;color:#B7C0CE">${axNum(r.dl)}</span><span class="adx-num" style="font-size:9.5px;color:#8A93A3;width:34px;text-align:right">${r.rate}%</span></div>`).join('') : `<div class="adx-empty" style="border:0;padding:20px"><span class="ei"><i class="ph ph-users-three"></i></span><div style="font-size:11px;color:var(--muted2)">Hali ma‘lumot yo‘q</div></div>`}
        </div>
      </div>
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Rad sabablari</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">SOFT VS HARD</span></div>
        <div style="padding:14px 16px;display:flex;flex-direction:column;gap:12px">
          ${rejectBlock}
          <div style="display:flex;gap:14px;margin-top:2px"><span style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:#8A93A3"><span style="width:9px;height:9px;border-radius:3px;background:#FFB27C"></span>Soft reject</span><span style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:#8A93A3"><span style="width:9px;height:9px;border-radius:3px;background:#FF6B5E"></span>Hard reject</span></div>
        </div>
      </div>
    </div>
    <div class="adx-card" style="margin-top:16px"><div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Audit trend</span><span style="flex:1"></span><span class="adx-num" style="font-size:9.5px;color:#8A93A3">SO‘NGGI 30 KUN · HAR KUN VOQEALAR</span></div>
      <div style="padding:16px 18px"><div class="adx-bars">${DL_30.map((v,i)=>`<div class="b ${i===DL_30.length-1?'sel':''}" style="height:${Math.max(4,(v/barMax)*100)}%" title="${v} voqea"></div>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;margin-top:10px"><span style="font-size:10px;color:#8A93A3">-30 kun</span><span style="font-size:10px;color:#8A93A3">bugun</span></div></div>
    </div>`;
};

/* ============================================================
   SETTINGS
   ============================================================ */
window.afterRender.settings = function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='settings') tba.innerHTML =
    `<button class="adx-btn2 sm" onclick="route('settings')">Bekor</button>`+
    `<button class="adx-btn sm" onclick="toast('Saqlandi','Sozlamalar brauzerda saqlandi (server sync keyingi versiyada)','success')"><i class="ph ph-check"></i>Saqlash</button>`;
};
VIEWS.settings = function(){
  const cats = (typeof CATS!=='undefined'?CATS:[]);
  const rules = [
    ['Yangi yuklash uchun majburiy moderatsiya',true],
    ['Hard reject‘dan keyin qayta yuborishni bloklash',true],
    ['Approve‘dan keyin AE katalogiga avtomatik push',true],
    ['Soft reject‘da contributorga email yuborish',false],
  ];
  return `
    <div class="adx-grid2">
      <div class="adx-card" style="padding:18px 20px">
        <div class="adx-h16" style="font-size:14px;margin-bottom:14px">Marketplace sozlamalari</div>
        <div class="adx-flab">PLATFORMA NOMI</div><input class="adx-input" value="FrameFlow" style="margin-bottom:12px">
        <div class="adx-flab">MAKS. FAYL HAJMI (.aep PACK)</div><input class="adx-input mono" value="200 MB" style="margin-bottom:12px">
        <div class="adx-flab">PREVIEW MAKS. DAVOMIYLIK</div><input class="adx-input mono" value="30 s" style="margin-bottom:12px">
        <div class="adx-flab">AVTO-ARXIV (FAOLSIZ KUNLAR)</div><input class="adx-input mono" value="90 kun">
        <div style="font-size:10.5px;color:#5E6675;margin-top:6px">Approved bo‘lmagan qoralamalar shu muddatdan keyin arxivlanadi. <span style="color:#FFB27C">Server sync keyingi versiyada</span>.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="adx-card" style="padding:18px 20px">
          <div style="display:flex;align-items:center;margin-bottom:12px"><span class="adx-h16" style="font-size:14px">Kategoriyalar</span><span style="flex:1"></span><button class="adx-btn2 sm" onclick="toast('Kategoriya','Kategoriya qo‘shish keyingi versiyada','info')"><i class="ph ph-check"></i>Qo‘shish</button></div>
          <div style="display:flex;flex-wrap:wrap;gap:7px">${cats.length?cats.map(c=>`<span class="adx-tag">${esc(c)}<i class="ph ph-x" style="font-size:11px;margin-left:2px;cursor:pointer"></i></span>`).join(''):'<span style="font-size:11px;color:var(--muted2)">Kategoriya yo‘q</span>'}</div>
        </div>
        <div class="adx-card" style="padding:18px 20px">
          <div class="adx-h16" style="font-size:14px;margin-bottom:12px">Moderatsiya qoidalari</div>
          ${rules.map(([l,on],i)=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;font-size:12px;${i?'border-top:1px solid var(--hair)':''}"><span style="flex:1">${l}</span><button class="adx-tog ${on?'on':'off'}" onclick="this.classList.toggle('on');this.classList.toggle('off')"><i></i></button></div>`).join('')}
          <div style="font-size:10.5px;color:#5E6675;margin-top:10px">Qoidalar hozircha brauzerda — server tomonlama qo‘llash keyingi versiyada.</div>
        </div>
      </div>
    </div>`;
};

/* ============================================================
   AUDIT LOG
   ============================================================ */
let AUDIT_FILTER = "all";

VIEWS.audit = function () {
  return `<div id="auditRoot"></div>`;
};

window.afterRender.audit = async function () {
  const tba = document.getElementById("tbActions");
  if(tba && CURRENT==="audit") tba.innerHTML = `<button class="adx-btn2 sm" onclick="StudioTemplates.loadAuditLogs().then(renderAuditTable)"><i class="ph ph-arrow-clockwise"></i>Yangilash</button>`;
  const root = document.getElementById("auditRoot");
  root.innerHTML = `<div class="card card-pad empty"><p class="small">Yuklanmoqda…</p></div>`;
  try {
    await StudioTemplates.loadAuditLogs();
    renderAuditTable();
  } catch (e) {
    root.innerHTML = `<div class="empty"><h3>Xatolik</h3><p>${esc(e.message)}</p></div>`;
  }
};

function axAuditBadge(action){
  const a = String(action||'');
  if(a==='approve') return `<span class="adx-bdg adx-bdg-approved"><i class="ph ph-check" style="font-size:10px"></i>Approve</span>`;
  if(a.includes('hard')) return `<span class="adx-bdg adx-bdg-hard"><i class="ph ph-prohibit" style="font-size:10px"></i>Reject</span>`;
  if(a.includes('reject')) return `<span class="adx-bdg adx-bdg-soft"><i class="ph ph-arrow-u-up-left" style="font-size:10px"></i>Reject</span>`;
  if(a.includes('block')||a.includes('remove')) return `<span class="adx-bdg adx-bdg-hard"><i class="ph ph-prohibit" style="font-size:10px"></i>Block</span>`;
  const m = (typeof AUDIT_META!=='undefined'&&AUDIT_META[a])?AUDIT_META[a]:{label:a};
  return `<span class="adx-bdg adx-bdg-info">${esc(m.label||a)}</span>`;
}

function renderAuditTable() {
  const list = AUDIT_FILTER === "all" ? AUDIT : AUDIT.filter((a) => a.action.includes(AUDIT_FILTER));
  const tags = [
    ["all","Barchasi",AUDIT.length],
    ["approve","Approve",AUDIT.filter((a)=>a.action==="approve").length],
    ["reject","Reject",AUDIT.filter((a)=>a.action.includes("reject")).length],
    ["block","Block",AUDIT.filter((a)=>a.action.includes("block")).length],
  ];
  document.getElementById("auditRoot").innerHTML = `
    ${axInfo("Audit jurnali — moderatsiya va boshqaruv harakatlari (API).",'info')}
    <div class="adx-tagrow">
      ${tags.map(([k,l,n])=>`<button class="adx-tag ${AUDIT_FILTER===k?'on':''}" onclick="AUDIT_FILTER='${k}';renderAuditTable()">${l} <span class="n">${n}</span></button>`).join('')}
    </div>
    <div class="adx-card" style="overflow:hidden">
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:820px">
        <thead><tr><th>Vaqt</th><th>Aktor</th><th>Amal</th><th>Nishon</th></tr></thead>
        <tbody>${
          list.length ? list.map((a)=>{
            const actor = String(a.actor||'');
            const isMe = actor.includes('(siz)');
            const nm = actor.replace(' (siz)','');
            return `<tr>
              <td class="adx-num" style="font-size:11px;color:#8A93A3;white-space:nowrap">${esc(a.t)}</td>
              <td><div class="adx-who">${isMe?'<span class="adx-av" style="width:26px;height:26px;font-size:9px;background:linear-gradient(140deg,#7b5cff,#4a2fb0)">AD</span>':axAv(nm,nm,26)}<span class="nm" style="font-size:12px">${esc(nm)}${isMe?' <span style="color:#5E6675;font-weight:400">(siz)</span>':''}</span></div></td>
              <td>${axAuditBadge(a.action)}</td>
              <td class="adx-num" style="font-size:10.5px;color:#8A93A3">${esc(a.target)}</td>
            </tr>`;
          }).join("") : `<tr><td colspan="4"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-clipboard-text"></i></span><div style="font-weight:600;font-size:13px">Hali yozuv yo‘q</div><div style="font-size:11px;color:var(--muted2)">Moderatsiya harakatlari shu yerda ko‘rinadi.</div></div></td></tr>`
        }</tbody>
      </table></div>
    </div>`;
}

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
      <div class="row between center"><span class="h3">${esc(t.name)}</span>${badge(t.status)}</div>
      <div class="row between center"><span class="label">Tarif (tier)</span><button class="badge badge-plan ${t.isPro?'pro':'free'} tier-toggle" title="${t.isPro?'Pro tarif — bosib Free qiling':'Free tarif — bosib Pro qiling'}" onclick="openToggleTierTpl('${t.id}')">${t.isPro?'PRO — bosib Free':'FREE — bosib Pro'}</button></div>
      <p class="body">${esc(t.desc)}</p>
      <div class="meta-grid">${[['ID',t.id],['Kategoriya',t.cat],['Resolution',t.res],['Downloads',t.dl?t.dl.toLocaleString():'\u2014'],['Fayl',t.size],['Yuklangan',t.created]].map(([k,v])=>`<div><div class="label" style="margin-bottom:3px">${k}</div><div class="cell-strong">${esc(v)}</div></div>`).join('')}</div>
      <div class="row gap-6 wrap">${t.tags.map(x=>`<span class="pill">${ic('tag')}${esc(x)}</span>`).join('')}</div>
      <div class="divider"></div>
      <div class="row center gap-10">${avatar(con.name,34)}<div class="col grow" style="gap:1px"><span class="cell-strong">${esc(con.name)}</span><span class="small">${esc(con.email)}</span></div><button class="btn btn-ghost btn-sm" onclick="closeDrawer();route('contributor-detail','${con.id}')">Profil</button></div>
      ${t.reason?`<div class="info-banner ${t.status==='hard'?'danger':'warn'}" style="align-items:flex-start">${ic('alert')}<div><b style="color:var(--tx-0)">Qaror sababi</b><div class="small mt-4" style="color:var(--tx-1)">${esc(t.reason)}</div></div></div>`:''}
    </div>
    <div class="drawer-foot">
      ${t.status==='pending'||t.status==='soft'?`<button class="btn btn-success grow" onclick="closeDrawer();modApprove('${t.id}')">${ic('check')} Tasdiqlash</button><button class="btn btn-warn grow" onclick="closeDrawer();modSoftReject('${t.id}')">${ic('reply')} Soft reject</button>`:`<button class="btn btn-ghost grow" onclick="openEditMeta('${t.id}')">${ic('edit')} Tahrirlash</button>`}
    </div>`);
}

/* ============================================================
   MODALS & ACTIONS
   ============================================================ */
function tName(id){ return TEMPLATES.find(t=>t.id===id).name; }

/* ---- Per-shablon Pro/Free tier toggle (admin) ----
   Mavjud PATCH /api/contributor/templates/:id { isPro } ni chaqiradi (isPro
   server-side faqat ADMIN uchun). Subscriber plan-toggle naqshining aynan o'zi. */
function openToggleTierTpl(id){
  const t = TEMPLATES.find(x=>x.id===id);
  if(!t) return;
  const newPro = !t.isPro;
  const label = newPro ? 'Pro' : 'Free';
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:${newPro?'var(--violet-dim);color:var(--violet-bright)':'var(--gray-dim);color:var(--gray)'}">${ic('star')}</div>
      <div><h3>${label} tarifga o‘tkazish</h3><p>${esc(t.name)}</p></div></div>
    <div class="modal-body"><div class="info-banner">${ic('alert')}<span>${newPro
        ? `<b>${esc(t.name)}</b> endi faqat <b>Pro</b> obunachilarga ko‘rinadi va import qilinadi.`
        : `<b>${esc(t.name)}</b> barcha (Free) obunachilarga ochiq bo‘ladi.`}</span></div></div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn ${newPro?'btn-primary':'btn-success'}" onclick="doToggleTierTpl('${id}',${newPro})">${ic('star')} ${label} qilish</button></div>`);
}

async function doToggleTierTpl(id, isPro){
  if(!StudioApi.token()){ toast('API','Admin sifatida API orqali kiring','warn'); return; }
  const t = TEMPLATES.find(x=>x.id===id);
  const nm = t ? t.name : id;
  try{
    await StudioApi.patchTemplate(id, { isPro: !!isPro });
    await StudioTemplates.refreshAfterReview();
    closeModal();
    toast('Yangilandi', `“${esc(nm)}” ${isPro?'Pro':'Free'} tarifga o‘tkazildi`, isPro?'success':'info');
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Shablon tarifi o‘zgartirildi',{action:'tier',detail:`${id}:${isPro?'pro':'free'}`});
    if(CURRENT==='templates') renderTemplates();
    else if(CURRENT==='moderation') renderModeration();
  }catch(e){
    toast('Xato', e.message || 'Tarif o‘zgartirilmadi', 'danger');
  }
}

function modApprove(id){
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--green-dim);color:var(--green)">${ic('checkCircle')}</div>
      <div><h3>Shablonni tasdiqlash</h3><p>"${esc(tName(id))}" AE katalogiga qo\u2018shiladi.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner">${ic('ext')}<span>Tasdiqlangach bu shablon obunachilar uchun <b>After Effects \u2192 FrameFlow Browse</b> panelida darhol ko\u2018rinadi.</span></div>
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
    toast("Tasdiqlandi", `\u201c${esc(tName(id))}\u201d AE Browse katalogida`, "success");
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
      <div class="field"><label>Rad sababi <span class="req">*</span></label><textarea class="textarea" id="softRejectReason" placeholder="Aniq, foydali izoh yozing \u2014 contributor nimani tuzatishini bilsin\u2026"></textarea></div>
      <div class="field"><label>Kategoriya</label><select class="select" style="height:38px;width:100%"><option>Sifat / kompressiya</option><option>Noto\u2018g\u2018ri metadata</option><option>Texnik nosozlik</option><option>Boshqa</option></select></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-warn" onclick="modRejectConfirm('${id}',false)">${ic('reply')} Yuborish</button></div>`);
}

async function modRejectConfirm(id, hard) {
  // MUHIM: izohni modal yopilishidan OLDIN o'qiymiz (closeModal DOM'ni o'chiradi)
  const note =
    document.querySelector(".modal-body textarea")?.value?.trim() ||
    "Moderatsiya rad etildi";
  closeModal();
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
      "Reject izohi saqlandi — contributor Xabarlar bo'limida ko'radi",
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
      <div><h3>Shablonni o\u2018chirish</h3><p>"${esc(tName(id))}" butunlay o\u2018chiriladi.</p></div></div>
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
      <div class="field"><label>Nomi</label><input id="emName" class="input" value="${esc(t.name)}"></div>
      <div class="field"><label>Tavsif</label><textarea id="emDesc" class="textarea">${esc(t.desc||'')}</textarea></div>
      <div class="row gap-12"><div class="field grow"><label>Kategoriya</label><select id="emCat" class="select" style="height:38px;width:100%">${CATS.map(c=>`<option ${c===t.cat||c===t.catLabel?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field grow"><label>Resolution</label><input id="emRes" class="input" value="${esc(t.res)}"></div></div>
      <div class="field"><label>Teglar</label><input id="emTags" class="input" value="${esc(t.tags.join(', '))}"></div>
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
      <div><h3>Contributorni bloklash</h3><p>${esc(c.name)} platformaga kira olmaydi.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner danger">${ic('alert')}<span>Bloklangan contributor yangi shablon yuklay olmaydi. Mavjud approved shablonlar AE\u2018da qoladi (alohida o\u2018chirmaguningizcha).</span></div>
      <div class="field"><label>Bloklash sababi <span class="req">*</span></label><textarea class="textarea" placeholder="Sabab \u2014 audit logga yoziladi\u2026"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-danger" onclick="doBlock('${id}')">${ic('ban')} Bloklash</button></div>`);
}
async function doBlock(id){
  const c=cById(id);
  try {
    await StudioApi.patchContributorStatus(id, true);
    c.status='blocked';
    closeModal();
    toast('Bloklandi',`${esc(c.name)} bloklandi`,'danger');
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.warn('Contributor bloklandi',{action:'block',detail:c.email});
    await StudioTemplates.loadAdminContributors();
    route(CURRENT==='contributor-detail'?'contributor-detail':'contributors', id);
  } catch (e) {
    toast('Xato', e.message || 'Bloklash muvaffaqiyatsiz', 'danger');
  }
}
async function unblock(id){
  const c=cById(id);
  try {
    await StudioApi.patchContributorStatus(id, false);
    c.status='active';
    toast('Blokdan chiqarildi',`${esc(c.name)} qayta faollashtirildi`,'success');
    await StudioTemplates.loadAdminContributors();
    route(CURRENT==='contributor-detail'?'contributor-detail':'contributors', id);
  } catch (e) {
    toast('Xato', e.message || 'Blokdan chiqarish muvaffaqiyatsiz', 'danger');
  }
}

function openMessage(cid, tid){
  const c=cById(cid);
  const subj = tid ? (tName(tid) + " \u2014 moderatsiya") : "FrameFlow xabar";
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">${ic('message')}</div>
      <div><h3>Xabar yozish</h3><p>${esc(c.name)} ga${tid?' \u00b7 '+esc(tid):''}</p></div></div>
    <div class="modal-body col gap-12">
      <div class="field"><label>Mavzu</label><input id="dmSubject" class="input" value="${esc(subj)}"></div>
      <div class="field"><label>Xabar</label><textarea id="dmBody" class="textarea" placeholder="Xabaringiz\u2026"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-primary" onclick="submitDirectMessage('${cid}','${tid||""}')">${ic('send')} Yuborish</button></div>`);
}

async function submitDirectMessage(cid, tid) {
  const subject = document.getElementById("dmSubject")?.value?.trim();
  const body = document.getElementById("dmBody")?.value?.trim();
  if (!subject || !body) {
    toast("Maydonlar", "Mavzu va xabar to'ldiring", "warn");
    return;
  }
  try {
    await StudioApi.createMessageThread({
      contributorId: cid,
      templateId: tid || null,
      subject,
      body,
    });
    closeModal();
    toast("Yuborildi", "Xabar yetkazildi", "success");
    if (CURRENT === "messaging") window.afterRender.messaging();
  } catch (e) {
    toast("Xato", e.message || "Yuborish muvaffaqiyatsiz", "danger");
  }
}

function openBroadcast(){
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--yellow-dim);color:var(--yellow)">${ic('megaphone')}</div>
      <div><h3>Broadcast e\u2018lon</h3><p>Barcha faol contributorlarga yuboriladi.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner warn">${ic('alert')}<span>Bu xabar <b>${CONTRIBUTORS.filter(c=>c.status==='active').length} ta</b> contributorga bir vaqtda boradi. Ehtiyot bo\u2018ling.</span></div>
      <div class="field"><label>Sarlavha</label><input id="bcSubject" class="input" placeholder="Masalan: Yangi kategoriya ochildi"></div>
      <div class="field"><label>Xabar</label><textarea id="bcBody" class="textarea"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-warn" onclick="submitBroadcast()">${ic('megaphone')} Yuborish</button></div>`);
}

async function submitBroadcast() {
  const subject = document.getElementById("bcSubject")?.value?.trim();
  const body = document.getElementById("bcBody")?.value?.trim();
  if (!subject || !body) {
    toast("Maydonlar", "Sarlavha va xabar to'ldiring", "warn");
    return;
  }
  try {
    const res = await StudioApi.broadcastMessage(subject, body);
    closeModal();
    toast("Broadcast", `${res.sent} ta contributorga yuborildi`, "success");
    if (CURRENT === "messaging") window.afterRender.messaging();
  } catch (e) {
    toast("Xato", e.message || "Broadcast muvaffaqiyatsiz", "danger");
  }
}

async function sendAdminReply() {
  const th = ADMIN_THREADS[MSG_SEL];
  const input = document.getElementById("adminReplyInput");
  const body = input?.value?.trim();
  if (!th || !body) return;
  try {
    await StudioApi.replyMessageThread(th.id, body);
    input.value = "";
    const data = await StudioApi.getMessageThread(th.id);
    ADMIN_THREAD_MESSAGES = data.messages || [];
    th.last = body;
    await renderMessaging();
    toast("Yuborildi", "Xabar yuborildi", "success");
  } catch (e) {
    toast("Xato", e.message || "Yuborish muvaffaqiyatsiz", "danger");
  }
}
