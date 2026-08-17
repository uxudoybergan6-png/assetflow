/* ============================================================
   AssetFlow — AE Plugin obunachilari (subscribers)
   ============================================================ */
let SUB_FILTER = "all";
let SUB_SEARCH = "";
let SUB_PLAN_FILTER = "all";

/** AI semantik qidiruv — tasdiqlangan shablonlarga embedding backfill (admin). */
async function aiReindex() {
  const btn = document.getElementById("aiReindexBtn");
  if (btn) btn.disabled = true;
  toast("AI", "Indexing…", "info");
  try {
    const r = await StudioApi.reindexAi(false);
    const done = r && typeof r.done === "number" ? r.done : 0;
    const failed = (r && r.failed) || 0;
    toast(
      "Done",
      `${done} template${done===1?"":"s"} indexed${failed ? ` (${failed} failed)` : ""}`,
      "success"
    );
  } catch (e) {
    const msg =
      e && e.status === 503
        ? "AI not configured (CF key required)"
        : e && e.status === 403
          ? "Admin only"
          : (e && e.message) || "Error";
    toast("Error", msg, "danger");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// #67 — server paginatsiyasi (take/skip). Jadval filtr/qidiruvi klientda ishlaydi,
// shuning uchun sahifalar ketma-ket yig'iladi — lekin CHEKLANGAN: SUB_MAX_ROWS dan
// keyin to'xtaymiz (brauzerni 50k qator bilan o'ldirmaslik uchun). KPI raqamlari
// `stats` dan keladi va u serverda BUTUN populyatsiya bo'yicha hisoblanadi.
const SUB_PAGE_SIZE = 200;
const SUB_MAX_ROWS = 2000;

async function refreshSubscribersFromApi() {
  if (typeof StudioApi === "undefined" || !StudioApi.listPluginSubscribers) return false;
  try {
    const rows = [];
    let stats = null;
    let truncated = false;
    for (let skip = 0; skip < SUB_MAX_ROWS; skip += SUB_PAGE_SIZE) {
      const data = await StudioApi.listPluginSubscribers({ take: SUB_PAGE_SIZE, skip });
      if (!stats) stats = data.stats || null;
      const items = data.items || [];
      items.forEach((s) => rows.push({ ...s }));
      if (!data.hasMore || !items.length) break;
      if (skip + SUB_PAGE_SIZE >= SUB_MAX_ROWS) truncated = true;
    }
    SUBSCRIBERS.length = 0;
    rows.forEach((s) => SUBSCRIBERS.push(s));
    window._ASSETFLOW_SUBSCRIBER_STATS = stats;
    window._ASSETFLOW_SUBSCRIBER_TRUNCATED = truncated;
    return true;
  } catch (e) {
    console.warn("plugin-subscribers", e);
    return false;
  }
}

function subscriberStatusBadge(status) {
  if (status === "active")
    return `<span class="badge badge-active"><span class="dot"></span>Active</span>`;
  if (status === "blocked")
    return `<span class="badge badge-blocked"><span class="dot"></span>Blocked</span>`;
  return `<span class="badge badge-removed"><span class="dot"></span>Removed</span>`;
}

function planBadge(plan) {
  const label = normalizePlanLabel(plan);
  const isPro = label === "Pro";
  return `<span class="badge badge-plan ${isPro ? "pro" : "free"}">${label}</span>`;
}

function usageCell(s) {
  // Audit §C (P2) — per-obunachi downloadLimitOverride hisobga olinadi (detail bilan mos)
  const label = normalizePlanLabel(s.plan);
  const p = planById(label.toLowerCase());
  const effLim = s.downloadLimitOverride != null ? s.downloadLimitOverride : (p.unlimitedDownloads ? null : p.downloadLimit);
  if (effLim == null) {
    return `<span class="small" style="color:var(--green)">Unlimited</span><br><span class="cell-muted mono">${s.downloadsMonth ?? 0} this month</span>`;
  }
  const used = s.downloadsMonth ?? 0;
  const lim = effLim || 0;
  const pct = subscriberUsagePct(s) ?? 0;
  const over = used >= lim;
  return `<div class="col gap-4" style="min-width:88px">
    <span class="cell-strong" ${over ? 'style="color:var(--red)"' : ""}>${used} / ${lim}</span>
    <div class="progress" style="height:5px"><span style="width:${pct}%;background:${over ? "var(--red)" : "var(--violet)"}"></span></div>
  </div>`;
}

function filteredSubscribers() {
  let list = SUBSCRIBERS.slice();
  if (SUB_FILTER === "active") list = list.filter((s) => s.status === "active");
  else if (SUB_FILTER === "blocked") list = list.filter((s) => s.status === "blocked");
  else if (SUB_FILTER === "removed") list = list.filter((s) => s.status === "removed");
  else if (SUB_FILTER === "online")
    // Audit §C (P1) — server `online` predikati (60 daqiqa) — KPI badge bilan BIR manba;
    // eski regex "Hozir"ni (eng onlaynlarni) tushirib qoldirardi.
    list = list.filter(
      (s) => s.status === "active" && (s.online != null ? !!s.online : /daq|Bugun|minut|Hozir/i.test(s.lastSeen))
    );
  if (SUB_PLAN_FILTER !== "all") {
    list = list.filter((s) => normalizePlanLabel(s.plan) === SUB_PLAN_FILTER);
  }
  const q = SUB_SEARCH.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.device && s.device.toLowerCase().includes(q))
    );
  }
  return list;
}

function setSubFilter(f) {
  SUB_FILTER = f;
  if (CURRENT === "subscribers") route("subscribers");
  else if (CURRENT === "subscriber-detail") route("subscriber-detail", SUB_DETAIL_ID);
}

/** Obunachi limit foydalanish katakchasi (maket e5 — adx-prog). */
function axUsageCell(s){
  // Audit §C (P2) — override-aware (usageCell bilan bir xil qoida)
  const label = normalizePlanLabel(s.plan);
  const p = planById(label.toLowerCase());
  const effLim = s.downloadLimitOverride != null ? s.downloadLimitOverride : (p.unlimitedDownloads ? null : p.downloadLimit);
  if(effLim == null){
    return `<span style="font-size:11px;color:var(--lime)">Unlimited</span><div class="adx-num" style="font-size:9.5px;color:var(--muted);margin-top:3px">${s.downloadsMonth ?? 0} this month</div>`;
  }
  const used = s.downloadsMonth ?? 0;
  const lim = effLim || 0;
  const pct = subscriberUsagePct(s) ?? 0;
  const cls = pct>=100 ? 'dan' : pct>=80 ? 'warn' : '';
  return `<div style="min-width:110px"><div class="adx-prog"><div class="pb ${cls}" style="width:${Math.min(100,pct)}%"></div></div><div class="adx-num" style="font-size:9.5px;color:var(--muted);margin-top:4px">${used} / ${lim}</div></div>`;
}

/** Obunachilar topbar amallari (reja filtri + AI reindex + CSV). */
function axSubTopbar(){
  const tba = document.getElementById('tbActions');
  if(!tba || (typeof CURRENT!=='undefined' && CURRENT!=='subscribers')) return;
  tba.innerHTML =
    `<label class="adx-sel"><i class="ph ph-funnel" style="font-size:13px"></i><span>${SUB_PLAN_FILTER==='all'?'All plans':SUB_PLAN_FILTER}</span><i class="ph ph-caret-down" style="font-size:11px;color:var(--muted)"></i><select onchange="SUB_PLAN_FILTER=this.value;route('subscribers')"><option value="all">All plans</option><option value="Free" ${SUB_PLAN_FILTER==='Free'?'selected':''}>Free</option><option value="Pro" ${SUB_PLAN_FILTER==='Pro'?'selected':''}>Pro</option></select></label>`+
    `<button class="adx-btn2 sm" id="aiReindexBtn" onclick="aiReindex()" title="Generates AI semantic search embeddings for approved templates"><i class="ph ph-arrow-clockwise"></i>Re-index AI</button>`+
    `<button class="adx-btn2 sm" onclick="exportVisibleTableCsv('frameflow-subscribers.csv')"><i class="ph ph-export"></i>CSV</button>`;
}

VIEWS.subscribers = function () {
  const sc = subscriberCounts();
  const rows = filteredSubscribers();
  return `
    ${axInfo(`<b style="color:var(--text)">AE Plugin subscribers</b> — real customers using the <b style="color:var(--text)">FrameFlow Browse</b> panel inside After Effects. Blocking = stops plugin access. Removing = takes the account out of the system.`,'info')}
    ${window._ASSETFLOW_SUBSCRIBER_TRUNCATED ? axInfo(`<b style="color:var(--text)">Showing the ${SUB_MAX_ROWS.toLocaleString()} most recently active</b> of ${sc.total.toLocaleString()} subscribers — the table search only covers the loaded rows. The counters above are for all subscribers.`,'amber') : ''}
    <div class="adx-grid5" style="margin-bottom:16px">
      ${axStat({label:'Total subscribers',val:sc.total,ic:'users',foot:'registered'})}
      ${axStat({label:'Active',val:sc.active,ic:'check-circle',icColor:'var(--lime)',foot:'account status'})}
      ${axStat({label:'Online',val:sc.online,ic:'gauge',icColor:'#7CC4FF',foot:'seen in last hour'})}
      ${axStat({label:'Blocked',val:sc.blocked,ic:'prohibit',icColor:'#FF6B5E',foot:'access closed'})}
      ${axStat({label:'Removed',val:sc.removed,ic:'trash',foot:'removed'})}
    </div>
    <div class="adx-tagrow">
      ${[['all','All',sc.total],['active','Active',sc.active],['online','Online',sc.online],['blocked','Blocked',sc.blocked],['removed','Removed',sc.removed]]
        .map(([k,l,n])=>`<button class="adx-tag ${SUB_FILTER===k?'on':''}" onclick="setSubFilter('${k}')">${l} <span class="n">${n}</span></button>`).join('')}
    </div>
    <div class="adx-card" style="overflow:hidden">
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:1180px">
        <thead><tr><th>Subscriber</th><th>Status</th><th>Plan</th><th>AE / device</th><th>Limit (mo)</th><th class="r">Downloads</th><th class="r">Import</th><th>Token</th><th>Last active</th><th class="r">Action</th></tr></thead>
        <tbody id="subTbody">
        ${rows.length ? rows.map(s=>{
          const rowMuted = s.status==='removed' ? 'opacity:.55' : '';
          return `<tr style="cursor:pointer;${rowMuted}" role="link" tabindex="0" onclick="route('subscriber-detail','${s.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();route('subscriber-detail','${s.id}')}">
            <td><div class="adx-who">${axAv(s.name,s.email,32)}<div style="min-width:0"><div class="nm">${esc(s.name)}</div><div class="em">${esc(s.email)}</div></div></div></td>
            <td>${axStatus(s.status)}</td>
            <td>${axPlan(s.plan)}</td>
            <td style="font-size:11px"><div style="color:var(--text)">AE ${esc(s.ae||'—')}</div><div style="color:var(--muted)">${esc(s.device||'—')}</div></td>
            <td>${axUsageCell(s)}</td>
            <td class="r adx-num">${(s.downloads||0).toLocaleString()}</td>
            <td class="r adx-num">${s.imports||0}</td>
            <td>${s.tokenOk?'<span class="adx-bdg adx-bdg-approved">OK</span>':'<span class="adx-bdg adx-bdg-blocked">Closed</span>'}</td>
            <td class="adx-num" style="font-size:11px;color:var(--muted);white-space:nowrap">${esc(s.lastSeen||'—')}</td>
            <td class="r" onclick="event.stopPropagation()"><div style="display:flex;gap:6px;justify-content:flex-end;align-items:center">
              <button class="adx-iact" title="Message" onclick="openMessageSub('${s.id}')"><i class="ph ph-chat-circle"></i></button>
              ${subActMenu(s)}
              <button class="adx-iact" title="Profile" onclick="route('subscriber-detail','${s.id}')"><i class="ph ph-caret-right"></i></button>
            </div></td>
          </tr>`;
        }).join('') : `<tr><td colspan="10"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-puzzle-piece"></i></span><div style="font-weight:600;font-size:13px">No subscribers found</div><div style="font-size:11px;color:var(--muted2)">Try changing the filter or search.</div></div></td></tr>`}
        </tbody>
      </table></div>
    </div>`;
};
let SUB_DETAIL_ID = null;

VIEWS["subscriber-detail"] = function (id) {
  const s = sById(id) || SUBSCRIBERS[0];
  if(!s) return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-puzzle-piece"></i></span><div style="font-weight:600;font-size:13px">Subscriber not found</div></div>`;
  SUB_DETAIL_ID = s.id;
  const blocked = s.status === "blocked";
  const removed = s.status === "removed";
  const isPro = normalizePlanLabel(s.plan) === "Pro";
  const pl = planById(normalizePlanLabel(s.plan).toLowerCase());
  const effDl = s.downloadLimitOverride != null ? s.downloadLimitOverride : (pl.unlimitedDownloads ? null : pl.downloadLimit);
  const hasOverride = s.downloadLimitOverride != null || s.importLimitOverride != null;
  const limNote = effDl === null ? "unlimited downloads · unlimited import" : `${effDl} downloads / month`;
  return `
    <button class="adx-btn2 sm" style="margin-bottom:16px" onclick="route('subscribers')"><i class="ph ph-caret-left"></i>AE subscribers</button>
    ${blocked?axInfo(`<b style="color:var(--text)">Plugin access blocked</b> — ${esc(s.blockReason||"Blocked by admin.")} <a style="color:#FF6B5E;text-decoration:underline;cursor:pointer" onclick="unblockSub('${s.id}')">Unblock</a>`,'red'):''}
    ${removed?axInfo(`<b style="color:var(--text)">Removed from system</b> — ${esc(s.removeReason||"")} ${esc(s.removedAt||"")} <a style="color:var(--lime);text-decoration:underline;cursor:pointer" onclick="restoreSub('${s.id}')">Restore</a>`,'amber'):''}
    <div class="adx-card" style="padding:18px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      ${axAv(s.name,s.email,56)}
      <div style="flex:1;min-width:220px"><div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap"><span class="adx-h18">${esc(s.name)}</span>${axStatus(s.status)}${axPlan(s.plan)}</div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:3px">${esc(s.email)}${s.device?' · '+esc(s.device):''} · ID: <span class="adx-num">${esc(shortId(s.id))}</span></div></div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;max-width:380px">
        ${!removed?`<button class="adx-btn2 sm" onclick="openTogglePlanSub('${s.id}')"><i class="ph ph-${isPro?'arrow-u-up-left':'crown'}"></i>${isPro?'Make Free':'Make Pro'}</button>`:''}
        ${!removed?`<button class="adx-btn2 sm" onclick="openAiCreditsSub('${s.id}')"><i class="ph ph-coins"></i>AI credits (${typeof s.aiCredits==='number'?s.aiCredits:'—'})</button>`:''}
        <button class="adx-btn2 sm" onclick="openMessageSub('${s.id}')"><i class="ph ph-chat-circle"></i>Message</button>
        ${s.status==='active'?`<button class="adx-btn-danger adx-btn-dghost sm" onclick="openBlockSub('${s.id}')">Block</button>`:''}
        ${blocked?`<button class="adx-btn2 sm adx-btn-ok" onclick="unblockSub('${s.id}')"><i class="ph ph-check-circle"></i>Unblock</button>`:''}
        ${!removed?`<button class="adx-btn-danger sm" onclick="openRemoveSub('${s.id}')">Remove</button>`:`<button class="adx-btn2 sm adx-btn-ok" onclick="restoreSub('${s.id}')"><i class="ph ph-arrow-clockwise"></i>Restore</button>`}
      </div>
    </div>
    ${!removed?`<div style="display:flex;align-items:center;gap:9px;padding:10px 13px;background:var(--limedim);border:1px solid var(--glow);border-radius:11px;margin-top:14px"><i class="ph ph-crown" style="color:var(--lime);font-size:15px"></i><span style="font-size:11.5px;color:var(--text2)">Plan: <b style="color:var(--text)">${normalizePlanLabel(s.plan)}</b> — ${limNote}${hasOverride?' · <b style="color:#FFB27C">custom limit</b>':''}.</span><span style="flex:1"></span><span class="adx-num" style="font-size:10.5px;color:var(--lime);cursor:pointer" onclick="openLimitOverrideSub('${s.id}')">Edit limit</span></div>`:''}
    <div class="adx-grid4" style="margin-top:14px">
      ${axStat({label:'Downloads this month',val:s.downloadsMonth ?? 0,ic:'download-simple',foot:effDl===null?'unlimited':effDl+' limit'})}
      ${axStat({label:'Total downloads',val:(s.downloads||0).toLocaleString(),ic:'download-simple',icColor:'var(--lime)'})}
      ${axStat({label:'AE imports',val:(s.imports||0).toLocaleString(),ic:'export',icColor:'#7CC4FF'})}
      ${axStat({label:'Last active',val:`<span style="font-size:18px">${esc(s.lastSeen||'—')}</span>`,ic:'clock-countdown',foot:s.device||''})}
    </div>
    <div class="adx-grid2" style="margin-top:14px">
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Plugin connection</span></div><div style="padding:6px 4px">
        <div style="display:flex;justify-content:space-between;padding:9px 14px;font-size:12px"><span style="color:var(--muted)">Token</span>${s.tokenOk?'<span class="adx-bdg adx-bdg-approved">Active</span>':'<span class="adx-bdg adx-bdg-blocked">Revoked</span>'}</div>
        <div style="display:flex;justify-content:space-between;padding:9px 14px;font-size:12px;border-top:1px solid var(--hair)"><span style="color:var(--muted)">Device</span><span style="color:var(--text)">${esc(s.device||'—')}${s.ae?' · AE '+esc(s.ae):''}</span></div>
        <div style="display:flex;justify-content:space-between;padding:9px 14px;font-size:12px;border-top:1px solid var(--hair)"><span style="color:var(--muted)">Country</span><span style="color:var(--text)">${esc(s.country||'—')}</span></div>
        <div style="display:flex;justify-content:space-between;padding:9px 14px;font-size:12px;border-top:1px solid var(--hair)"><span style="color:var(--muted)">Plan</span>${axPlan(s.plan)}</div>
      </div></div>
      <div class="adx-card"><div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Recent activity</span></div>
        <div class="adx-empty" style="border:0;padding:22px"><span class="ei"><i class="ph ph-clock-countdown"></i></span><div style="font-size:11.5px;color:var(--text2);line-height:1.5">Last seen <b style="color:var(--text)">${esc(s.lastSeen||'—')}</b>${s.device?' · '+esc(s.device):''}${s.ae?' · AE '+esc(s.ae):''}</div><div style="font-size:10.5px;color:var(--muted2)">Detailed event log — in the Activity log section.</div>
      </div>
    </div>
    <div class="adx-card" id="subGenSection" style="margin-top:14px">
      <div class="adx-cardhd"><span class="adx-h16" style="font-size:13.5px">Generations</span><span id="subGenSummary" style="font-size:11px;color:var(--muted)"></span></div>
      <div id="subGenBody" style="padding:8px 4px"><div class="adx-empty" style="border:0;padding:22px;font-size:11.5px;color:var(--muted)">Loading generations…</div></div>
    </div>`;
};

/* P2: bitta userning generatsiyalari (done/FAILED/running) — status badge + refund + cost + prompt
   + media thumb. afterRender'da yuklanadi (view sinxron; media imzo async).
   #137 (A8): ilgari qattiq `take:40` edi va davomi umuman ko'rinmasdi (server allaqachon
   cursor sahifalashini beradi) + refund faqat AVTOMATIK (provayder xatosi) yo'l bilan
   bo'lardi, ya'ni obunachi shikoyat qilsa admin qo'lida hech narsa yo'q edi. Endi
   "Load more" + har element uchun "Refund" bor. */
const SUB_GEN = { userId: null, cursor: null, loading: false, items: [] };
const SUB_GEN_PAGE = 30;
function subGenStatusBadge(st) {
  if (st === "done") return `<span class="adx-bdg adx-bdg-approved">Done</span>`;
  if (st === "failed") return `<span class="adx-bdg adx-bdg-blocked">Failed</span>`;
  return `<span class="adx-bdg" style="background:rgba(255,178,124,.16);color:#FFB27C">${esc((st||"running").replace(/^\w/,c=>c.toUpperCase()))}</span>`;
}
function subGenCard(g) {
  const a = (g.assets && g.assets[0]) || null;
  // #2 — backend endi normalized `kind` ("image"|"video"|"audio") beradi; eski raqamli
  // `type` (140/120) bilan solishtirish har doim false edi → video <img>da sinardi.
  const kind = (a && a.kind) || "image";
  const isVideo = kind === "video";
  const isAudio = kind === "audio";
  // Thumb sifatida faqat RASM manba: thumbUrl, yoki (rasm asset bo'lsa) url'ning o'zi.
  // Video/audio url'ini <img>ga solmaymiz — aynan shu singan preview'ning ildizi edi.
  const thumb = a ? (a.thumbUrl || (kind === "image" ? a.url : null)) : null;
  const openClick = a && a.url ? ` onclick="subGenPreview('${esc(a.url)}','${esc(kind)}','${esc(a.downloadUrl||a.url)}')"` : "";
  const media = thumb
    ? `<div style="position:relative;width:52px;height:52px;flex:none;border-radius:8px;overflow:hidden;background:#0c0f14;cursor:pointer"${openClick}><img src="${esc(thumb)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.display='none'">${isVideo?'<i class="ph ph-play-circle" style="position:absolute;inset:0;margin:auto;width:18px;height:18px;color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;text-shadow:0 1px 3px rgba(0,0,0,.6)"></i>':''}</div>`
    : `<div style="width:52px;height:52px;flex:none;border-radius:8px;background:#0c0f14;display:flex;align-items:center;justify-content:center;color:${a&&a.url?'#7CC4FF;cursor:pointer':'#3a4150'}"${openClick}><i class="ph ph-${isAudio||g.mode==='audio'?'waveform':(isVideo||g.mode==='video'?'film-slate':'image')}"></i></div>`;
  const when = g.createdAt ? new Date(g.createdAt).toLocaleString() : "";
  // #137 (A8) — refund tugmasi faqat haqiqatan qaytariladigan holatda: hali qaytarilmagan
  // va narxi > 0. Aks holda tugma bosilsa server 400/409 qaytarardi (soxta imkoniyat).
  const canRefund = !g.refunded && (g.cost || 0) > 0;
  const act = canRefund
    ? `<button class="adx-btn2 sm" id="subGenRf_${esc(g.id)}" onclick="openRefundGen('${esc(g.id)}')" style="flex:none">Refund</button>`
    : "";
  return `<div style="display:flex;gap:11px;padding:9px 10px;border-top:1px solid var(--hair);align-items:flex-start" id="subGenRow_${esc(g.id)}">
    ${media}
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">${subGenStatusBadge(g.status)}<span style="font-size:10.5px;color:var(--muted)">${esc(g.model||'')}</span><span style="font-size:10.5px;color:#6b7280">· ${g.cost||0} cr</span>${g.refunded?'<span class="adx-bdg" style="background:rgba(124,196,255,.14);color:#7CC4FF">Refunded</span>':''}</div>
      <div style="font-size:11.5px;color:var(--text2);margin-top:3px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(g.prompt||'—')}</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:2px">${esc(when)}</div>
    </div>
    ${act}
  </div>`;
}

/** #137 (A8) — qo'lda refund tasdiqi. Kredit qaytarish pul harakati, shu bois
 *  bir bosishda emas — avval nimani qaytarayotgani ko'rsatiladi. */
function openRefundGen(genId) {
  const g = (SUB_GEN.items || []).find((x) => x.id === genId);
  if (!g) return;
  openModal(`
    <div class="modal-head">
      <div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">${ic("refresh")}</div>
      <div><h3>Refund ${g.cost} credits</h3><p>${esc(g.model || g.modelId || "")} \xb7 ${esc(String(g.status || ""))}</p></div>
    </div>
    <div class="modal-body">
      <div class="info-banner">${ic("alert")}<span>${g.cost} credits will be returned to the subscriber's balance. This generation is then marked <b>Refunded</b> and cannot be refunded again.</span></div>
      <div style="font-size:11.5px;color:var(--text2);margin-top:10px;line-height:1.5">${esc(g.prompt || "—")}</div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doRefundGen('${esc(genId)}')">Refund ${g.cost} cr</button>
    </div>`);
}

async function doRefundGen(genId) {
  closeModal();
  try {
    const r = await StudioApi.refundGeneration(SUB_GEN.userId, genId);
    const g = (SUB_GEN.items || []).find((x) => x.id === genId);
    if (g) g.refunded = true;
    const row = document.getElementById(`subGenRow_${genId}`);
    if (row && g) row.outerHTML = subGenCard(g);
    toast(
      "Refunded",
      `${r && r.refunded ? r.refunded : g ? g.cost : ""} credits returned${r && typeof r.aiCredits === "number" ? ` · balance ${r.aiCredits} cr` : ""}`,
      "success"
    );
    // Xulosa (total/refunded/net) serverdan qayta o'qiladi — hisob mos qolsin.
    if (SUB_GEN.userId) refreshSubGenSummary(SUB_GEN.userId);
  } catch (e) {
    // Tarmoq uzilishida StudioApi POST'ni QAYTA yuboradi — birinchi urinish o'tgan bo'lsa
    // ikkinchisi 409 ALREADY_REFUNDED beradi. Bu xato emas: kredit qaytarilgan.
    if (e && (e.status === 409 || (e.data && e.data.code === "ALREADY_REFUNDED"))) {
      const g = (SUB_GEN.items || []).find((x) => x.id === genId);
      if (g) g.refunded = true;
      const row = document.getElementById(`subGenRow_${genId}`);
      if (row && g) row.outerHTML = subGenCard(g);
      toast("Already refunded", "These credits were already returned", "info");
      if (SUB_GEN.userId) refreshSubGenSummary(SUB_GEN.userId);
      return;
    }
    toast("Refund failed", (e && e.message) || "unknown error", "danger");
  }
}

async function refreshSubGenSummary(userId) {
  const sumEl = document.getElementById("subGenSummary");
  if (!sumEl) return;
  try {
    const d = await StudioApi.getUserGenerations(userId, { take: 10 });
    const su = d.summary || {};
    sumEl.textContent = `${su.total||0} total · ${su.failed||0} failed · ${su.refunded||0} refunded · ${su.creditsNet||0} cr net`;
  } catch { /* xulosa yangilanmasa ham refund allaqachon amalga oshdi */ }
}
function subGenPreview(url, kind, downloadUrl) {
  if (!url) return;
  // #2 — kind bo'yicha render (video/audio/image) + Download (attachment signed URL) +
  // inline embed yiqilsa "Open in new tab" zaxira havolasi.
  const body =
    kind === "video"
      ? `<video src="${esc(url)}" controls autoplay style="width:100%;border-radius:10px"></video>`
      : kind === "audio"
        ? `<audio src="${esc(url)}" controls autoplay style="width:100%"></audio>`
        : `<img src="${esc(url)}" style="width:100%;border-radius:10px" onerror="this.outerHTML='<div style=&quot;padding:28px;text-align:center;font-size:12px;color:var(--muted)&quot;>Preview unavailable — use “Open in new tab”.</div>'">`;
  openModal(`<div class="modal-body" style="padding:8px"><div style="max-width:640px;margin:0 auto">${body}</div></div>
    <div class="modal-foot" style="gap:8px">
      <a class="btn btn-ghost" href="${esc(url)}" target="_blank" rel="noopener">Open in new tab</a>
      <span style="flex:1"></span>
      <a class="btn btn-primary" href="${esc(downloadUrl || url)}" target="_blank" rel="noopener" download>Download</a>
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>`);
}
async function loadSubGenerations(userId) {
  const body = document.getElementById("subGenBody");
  if (!body) return;
  SUB_GEN.userId = userId;
  SUB_GEN.cursor = null;
  SUB_GEN.items = [];
  body.innerHTML = `<div id="subGenList"></div><div id="subGenMore" style="padding:10px 12px"><span style="font-size:11.5px;color:var(--muted)">Loading generations…</span></div>`;
  await loadMoreSubGenerations();
}

/** #137 (A8) — keyingi sahifa (server `nextCursor` beradi). Sahifa qo'shiladi, qayta
 *  yuklanmaydi — allaqachon imzolangan media URL'lari yo'qolmasin. */
async function loadMoreSubGenerations() {
  if (SUB_GEN.loading || !SUB_GEN.userId) return;
  const list = document.getElementById("subGenList");
  const more = document.getElementById("subGenMore");
  const sumEl = document.getElementById("subGenSummary");
  if (!list || !more) return;
  SUB_GEN.loading = true;
  more.innerHTML = `<span style="font-size:11.5px;color:var(--muted)">Loading…</span>`;
  try {
    const d = await StudioApi.getUserGenerations(SUB_GEN.userId, {
      take: SUB_GEN_PAGE,
      cursor: SUB_GEN.cursor || undefined,
    });
    const items = d.items || [];
    const su = d.summary || {};
    if (sumEl) sumEl.textContent = `${su.total||0} total · ${su.failed||0} failed · ${su.refunded||0} refunded · ${su.creditsNet||0} cr net`;
    SUB_GEN.items = SUB_GEN.items.concat(items);
    SUB_GEN.cursor = d.nextCursor || null;
    if (!SUB_GEN.items.length) {
      list.innerHTML = `<div class="adx-empty" style="border:0;padding:22px;font-size:11.5px;color:var(--muted)">No generations yet.</div>`;
      more.innerHTML = "";
      return;
    }
    list.insertAdjacentHTML("beforeend", items.map(subGenCard).join(""));
    more.innerHTML = SUB_GEN.cursor
      ? `<button class="adx-btn2 sm" onclick="loadMoreSubGenerations()">Load more (${SUB_GEN.items.length} of ${su.total||SUB_GEN.items.length})</button>`
      : `<span style="font-size:10.5px;color:var(--muted2)">All ${SUB_GEN.items.length} generations shown.</span>`;
  } catch (e) {
    more.innerHTML = `<span style="font-size:11.5px;color:var(--muted)">Couldn’t load generations${e&&e.message?` — ${esc(e.message)}`:''}. </span><button class="adx-btn2 sm" onclick="loadMoreSubGenerations()">Retry</button>`;
  } finally {
    SUB_GEN.loading = false;
  }
}
function subActMenu(s) {
  const isPro = normalizePlanLabel(s.plan) === "Pro";
  const isRemoved = s.status === "removed";
  const isBlocked = s.status === "blocked";
  const isActive = s.status === "active";
  const cl = "this.closest('details').open=false;";
  const planItem = !isRemoved
    ? `<button class="act-item${isPro ? "" : " success"}" onclick="${cl}openTogglePlanSub('${s.id}')">${ic(isPro ? "chevD" : "star")} ${isPro ? "Make Free" : "Make Pro"}</button><div class="act-sep"></div>`
    : "";
  const blockUnblock = isActive
    ? `<button class="act-item danger" onclick="${cl}openBlockSub('${s.id}')">${ic("ban")} Block</button>`
    : isBlocked
    ? `<button class="act-item success" onclick="${cl}unblockSub('${s.id}')">${ic("checkCircle")} Unblock</button>`
    : "";
  const removeRestore = isRemoved
    ? `<button class="act-item success" onclick="${cl}restoreSub('${s.id}')">${ic("refresh")} Restore</button>`
    : `<button class="act-item danger" onclick="${cl}openRemoveSub('${s.id}')">${ic("trash")} Remove</button>`;
  return `<details class="act-menu"><summary class="adx-iact" title="Actions" style="list-style:none">${ic("more")}</summary><div class="act-drop">${planItem}${blockUnblock}${removeRestore}</div></details>`;
}

function openTogglePlanSub(id) {
  const s = sById(id);
  const isPro = normalizePlanLabel(s.plan) === "Pro";
  const newPlan = isPro ? "free" : "pro";
  const label = isPro ? "Free" : "Pro";
  openModal(`
    <div class="modal-head">
      <div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">${ic(isPro ? "chevD" : "star")}</div>
      <div><h3>Move to ${label} plan</h3><p>${esc(s.name)} \xb7 ${esc(s.email)}</p></div>
    </div>
    <div class="modal-body">
      <div class="info-banner">${ic("alert")}<span>${isPro
        ? `<b>${esc(s.name)}</b> will be moved to the Free plan — the monthly limit is re-enabled.`
        : `<b>${esc(s.name)}</b> will be moved to the Pro plan — unlimited downloads are granted.`
      }</span></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doTogglePlanSub('${id}','${newPlan}')">${ic(isPro ? "chevD" : "star")} Make ${label}</button>
    </div>`);
}

async function doTogglePlanSub(id, plan) {
  const s = sById(id);
  try {
    await patchSubOnServer(id, { plan });
    closeModal();
    toast("Updated", `${s.name} moved to the ${plan === "pro" ? "Pro" : "Free"} plan`, plan === "pro" ? "success" : "info");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Error", e.message || "API", "danger");
  }
}

function openLimitOverrideSub(id) {
  const s = sById(id);
  const pl = planById(normalizePlanLabel(s.plan).toLowerCase());
  const defaultDl = pl.unlimitedDownloads ? "unlimited" : pl.downloadLimit;
  const defaultImp = pl.unlimitedImports ? "unlimited" : pl.importLimit;
  openModal(`
    <div class="modal-head">
      <div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">${ic("sliders")}</div>
      <div><h3>Edit custom limit</h3><p>${esc(s.name)}</p></div>
    </div>
    <div class="modal-body col gap-12">
      <div class="info-banner">${ic("alert")}<span>Plan default: downloads <b>${defaultDl}</b>, import <b>${defaultImp}</b>. Leave blank to revert to the plan default.</span></div>
      <div class="field"><label>Download limit (per month)</label>
        <input class="input" id="subDlLimit" type="number" min="0" value="${s.downloadLimitOverride != null ? s.downloadLimitOverride : ""}" placeholder="Blank = plan default (${defaultDl})">
      </div>
      <div class="field"><label>Import limit (total)</label>
        <input class="input" id="subImpLimit" type="number" min="0" value="${s.importLimitOverride != null ? s.importLimitOverride : ""}" placeholder="Blank = plan default (${defaultImp})">
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-ghost btn-sm" onclick="doLimitOverrideSub('${id}',true)" style="color:var(--tx-2)">Revert to default</button>
      <button class="btn btn-primary" onclick="doLimitOverrideSub('${id}')">Save</button>
    </div>`);
}

async function doLimitOverrideSub(id, reset) {
  const dlRaw = reset ? null : document.getElementById("subDlLimit")?.value.trim();
  const impRaw = reset ? null : document.getElementById("subImpLimit")?.value.trim();
  const body = {
    downloadLimitOverride: dlRaw != null && dlRaw !== "" ? parseInt(dlRaw, 10) : null,
    importLimitOverride: impRaw != null && impRaw !== "" ? parseInt(impRaw, 10) : null,
  };
  try {
    await patchSubOnServer(id, body);
    closeModal();
    toast("Saved", reset ? "Limits reverted to plan default" : "Custom limit updated", "success");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Error", e.message || "API", "danger");
  }
}

/** Grant/reset AI credits (admin) — PATCH /plugin-subscribers/:id { aiCredits }. */
function openAiCreditsSub(id) {
  const s = sById(id);
  if (!s) return;
  const cur = typeof s.aiCredits === "number" ? s.aiCredits : 0;
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">⚡</div>
      <div><h3>AI credits</h3><p>${esc(s.name)} — current: <b>${cur}</b> credits</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner">${ic("alert")}<span>AI generation (image/video/voice) is spent from these credits. ADMIN role is unlimited.</span></div>
      <div class="field"><label>New value</label><input class="input" id="subAiCredits" type="number" min="0" value="${cur}"></div>
      <div class="row gap-8">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('subAiCredits').value=50">Free (50)</button>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('subAiCredits').value=1000">Pro (1000)</button>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doAiCreditsSub('${id}')">Save</button></div>`);
}

async function doAiCreditsSub(id) {
  const raw = document.getElementById("subAiCredits")?.value.trim();
  const n = raw != null && raw !== "" ? parseInt(raw, 10) : NaN;
  if (isNaN(n) || n < 0) {
    toast("Error", "Enter a positive number", "danger");
    return;
  }
  try {
    await patchSubOnServer(id, { aiCredits: n });
    closeModal();
    toast("Saved", `AI credits set to ${n}`, "success");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Error", e.message || "API", "danger");
  }
}

function openBlockSub(id) {
  const s = sById(id);
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--red-dim);color:var(--red)">${ic("ban")}</div>
      <div><h3>Block subscriber</h3><p>${esc(s.name)} — will lose access to the AE Browse panel.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner danger">${ic("alert")}<span>The token is revoked. Existing local files are not deleted, but new catalog sync will stop.</span></div>
      <div class="field"><label>Reason for blocking <span class="req">*</span></label><textarea class="textarea" id="subBlockReason" placeholder="e.g. token sharing, payment overdue…"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="doBlockSub('${id}')">${ic("ban")} Block</button></div>`);
}

async function patchSubOnServer(id, body) {
  if (typeof StudioApi !== "undefined" && StudioApi.patchPluginSubscriber) {
    const data = await StudioApi.patchPluginSubscriber(id, body);
    const idx = SUBSCRIBERS.findIndex((x) => x.id === id);
    if (idx >= 0 && data.item) SUBSCRIBERS[idx] = { ...data.item };
    await refreshSubscribersFromApi();
    return data.item;
  }
  return null;
}

async function doBlockSub(id) {
  const s = sById(id);
  const reason =
    document.getElementById("subBlockReason")?.value.trim() ||
    "Blocked by admin";
  try {
    await patchSubOnServer(id, { status: "blocked" });
    s.status = "blocked";
    s.tokenOk = false;
    s.blockReason = reason;
    closeModal();
    toast("Blocked", `${s.name} was blocked from the AE plugin`, "danger");
    if (typeof AssetFlowLog !== "undefined")
      AssetFlowLog.warn("Subscriber blocked", { action: "sub_block", detail: s.email });
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Error", e.message || "API", "danger");
  }
}

async function unblockSub(id) {
  const s = sById(id);
  try {
    await patchSubOnServer(id, { status: "active" });
    s.status = "active";
    s.tokenOk = true;
    delete s.blockReason;
    toast("Activated", `${s.name} can use the Browse panel again`, "success");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Error", e.message || "API", "danger");
  }
}

function openRemoveSub(id) {
  const s = sById(id);
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--red-dim);color:var(--red)">${ic("trash")}</div>
      <div><h3>Remove</h3><p>${esc(s.name)} will be completely removed from the system.</p></div></div>
    <div class="modal-body col gap-12">
      <div class="info-banner danger">${ic("alert")}<span><b>Destructive.</b> The subscriber leaves the list and the token is revoked. Can be reactivated later via <b>Restore</b>.</span></div>
      <div class="field"><label>Reason <span class="req">*</span></label><textarea class="textarea" id="subRemoveReason" placeholder="Reason for the audit log…"></textarea></div>
      <label class="row center gap-8" style="cursor:pointer;font-size:13px"><div class="checkbox on" id="subRemoveConfirm" onclick="this.classList.toggle('on')">${ic("check")}</div>I confirm the removal</label>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="doRemoveSub('${id}')">${ic("trash")} Remove</button></div>`);
}

async function doRemoveSub(id) {
  const chk = document.getElementById("subRemoveConfirm");
  if (!chk?.classList.contains("on")) {
    toast("Confirm", "Please confirm the removal", "warn");
    return;
  }
  const s = sById(id);
  const reason =
    document.getElementById("subRemoveReason")?.value.trim() ||
    "Removed by admin";
  try {
    await patchSubOnServer(id, { status: "removed" });
    s.status = "removed";
    s.tokenOk = false;
    s.device = "—";
    s.removeReason = reason;
    s.removedAt = new Date().toISOString().slice(0, 10);
    closeModal();
    toast("Removed", `${s.name} was removed from the subscriber list`, "danger");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Error", e.message || "API", "danger");
  }
}

async function restoreSub(id) {
  const s = sById(id);
  try {
    await patchSubOnServer(id, { status: "active" });
    s.status = "active";
    s.tokenOk = true;
    s.device = s.device === "—" ? "Restored · AE" : s.device;
    delete s.removeReason;
    delete s.removedAt;
    delete s.blockReason;
    toast("Restored", `${s.name} is active again`, "success");
    route(CURRENT === "subscriber-detail" ? "subscriber-detail" : "subscribers", id);
  } catch (e) {
    toast("Error", e.message || "API", "danger");
  }
}

window.afterRender = window.afterRender || {};
// MUHIM: bu yerda route() ni QAYTA chaqirmaymiz — route() afterRender'ni
// qayta ishga tushiradi va cheksiz sikl (auto kirib-chiqish) hosil bo'ladi.
// Faqat ko'rinish tanasini yangi ma'lumot bilan qayta chizamiz.
window.afterRender.subscribers = async function () {
  axSubTopbar();
  // Ma'lumot kelguncha skeleton qatorlar (bo'sh jadval miltillamasin).
  if (!SUBSCRIBERS.length) {
    const tb = document.getElementById("subTbody");
    if (tb) tb.innerHTML = '<tr><td colspan="10" style="padding:6px">' + adxSkelList(6) + "</td></tr>";
  }
  const ok = await refreshSubscribersFromApi();
  if (ok && CURRENT === "subscribers") {
    const host = document.getElementById("view");
    if (host) host.innerHTML = VIEWS.subscribers();
  }
};
window.afterRender["subscriber-detail"] = async function (id) {
  if (id) SUB_DETAIL_ID = id;
  await refreshSubscribersFromApi();
  if (CURRENT === "subscriber-detail") {
    const host = document.getElementById("view");
    if (host) host.innerHTML = VIEWS["subscriber-detail"](SUB_DETAIL_ID || id);
    // P2: generatsiyalarni async yuklaymiz (view sinxron render bo'lgach).
    loadSubGenerations(SUB_DETAIL_ID || id);
  }
};

function openMessageSub(id) {
  const s = sById(id);
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">${ic("message")}</div>
      <div><h3>Message subscriber</h3><p>${esc(s.name)} · ${esc(s.email)}</p></div></div>
    <div class="modal-body col gap-12">
      <div class="field"><label>Subject</label><input class="input" id="subMsgSubject" value="FrameFlow — a message from the team"></div>
      <div class="field"><label>Message</label><textarea class="textarea" id="subMsgBody" placeholder="Email message to the subscriber…"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="subMsgSend" onclick="sendMessageSub('${id}')">${ic("send")} Send</button></div>`);
}

/** Audit §C (P1) — endi REAL yuboradi (POST /plugin-subscribers/:id/message → email). */
async function sendMessageSub(id) {
  const subject = document.getElementById("subMsgSubject")?.value?.trim();
  const message = document.getElementById("subMsgBody")?.value?.trim();
  if (!subject || !message) {
    toast("Message", "Write a subject and a message first", "warn");
    return;
  }
  const btn = document.getElementById("subMsgSend");
  if (btn) btn.disabled = true;
  try {
    const r = await StudioApi.messagePluginSubscriber(id, { subject, message });
    closeModal();
    const s = sById(id);
    if (r && r.sent) toast("Sent", `Email sent to ${s ? s.name : "subscriber"}`, "success");
    else toast("Not sent", "Email service is not configured (RESEND_API_KEY) — message was NOT delivered", "warn");
  } catch (e) {
    toast("Error", e.message || "Message failed to send", "danger");
    if (btn) btn.disabled = false;
  }
}
window.sendMessageSub = sendMessageSub;
