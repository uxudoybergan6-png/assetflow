/* ============================================================
   AssetFlow — Admin Dashboard (Overview) · phase 2c
   Layout: design-preview/admin.html mockup'iga 1:1.
   admin-views.js dagi VIEWS.overview ni QAYTA belgilaydi (keyin yuklanadi → ustun).
   Real ma'lumot: counts() · subscriberCounts() · tByStatus('pending') · SUBSCRIBERS.
   #2 XSS: barcha contributor/user matni esc() bilan. SOXTA raqam yo'q.
   Logika saqlangan: modApprove / modSoftReject / openAiCreditsSub / route — mavjud handlerlar.
   ============================================================ */
(function () {
  "use strict";

  function initials(name) {
    return String(name || "").trim().split(/\s+/).map(function (w) { return w[0] || ""; }).join("").toUpperCase().slice(0, 2) || "?";
  }

  /* ---- STAT KARTALAR (real) ---- */
  function statCard2(o) {
    return '<div class="statcard' + (o.primary ? " is-primary" : "") + '"><div class="stat-top"><span class="lbl">' +
      esc(o.label) + '</span><span class="stat-ico ' + (o.variant || "") + '">' + ic(o.ic) + "</span></div>" +
      '<div class="num">' + o.val + '</div><span class="trend flat">' + esc(o.foot || "") + "</span></div>";
  }

  function adminStatsHtml() {
    var c = (typeof counts === "function") ? counts() : { pending: 0 };
    var sc = (typeof subscriberCounts === "function") ? subscriberCounts() : { active: 0, total: 0, pro: 0, free: 0, totalDownloads: 0 };
    var usage = (typeof window !== "undefined" && window._ASSETFLOW_PLUGIN_ANALYTICS) ? window._ASSETFLOW_PLUGIN_ANALYTICS.usage : null;
    var dl = (usage && typeof usage.downloadsTotal === "number") ? usage.downloadsTotal : (sc.totalDownloads || 0);
    var dlDisp = dl >= 1000 ? (dl / 1000).toFixed(1) + "K" : String(dl);
    return statCard2({ label: "Navbatda", val: c.pending, ic: "clock", primary: true, foot: "ko‘rib chiqishni kutmoqda" }) +
      statCard2({ label: "Faol obunachilar", val: sc.active, ic: "plugin", foot: sc.total + " jami" }) +
      statCard2({ label: "Pro obunalar", val: sc.pro, ic: "star", foot: sc.free + " Free" }) +
      statCard2({ label: "Jami yuklab olishlar", val: dlDisp, ic: "download", variant: "blue", foot: "plugin hisobi" });
  }

  /* ---- MODERATSIYA NAVBATI (real pending shablonlar) ---- */
  function adminModCard(t) {
    var con = (typeof CONTRIBUTORS !== "undefined" && CONTRIBUTORS) ? CONTRIBUTORS.find(function (x) { return x.id === t.cid; }) : null;
    var author = (con && con.name) ? con.name : "Contributor";
    var tags = [t.cat, t.res, t.size].filter(Boolean);
    return '<article class="mod-card">' +
      '<div class="mod-thumb ' + (t.grad || "g1") + '">' +
        '<span class="type">' + ic("play") + esc(t.kind || "Shablon") + "</span>" +
        (t.isNew ? '<span class="new">Yangi</span>' : "") +
        '<span class="mod-thumb-ic">' + ic("play") + "</span>" +
      "</div>" +
      '<div class="mod-body">' +
        '<div class="mod-title">' + esc(t.name) + "</div>" +
        '<div class="mod-meta"><span class="av">' + esc(initials(author)) + "</span><span>" + esc(author) +
          '</span><span aria-hidden="true">·</span><span>' + esc(t.created || "") + "</span></div>" +
        '<div class="mod-tags">' + tags.map(function (x) { return '<span class="tag">' + esc(x) + "</span>"; }).join("") + "</div>" +
        '<div class="mod-actions">' +
          '<button class="btn btn-success btn-sm" onclick="modApprove(\'' + t.id + '\')">' + ic("check") + " Approve</button>" +
          '<button class="btn btn-danger-ghost btn-sm" onclick="modSoftReject(\'' + t.id + '\')">' + ic("reply") + " Reject</button>" +
          '<button class="act" title="Ko‘rish" onclick="openTplDrawer(\'' + t.id + '\')">' + ic("eye") + "</button>" +
        "</div>" +
      "</div></article>";
  }

  function adminModQueueHtml() {
    var pend = (typeof tByStatus === "function") ? tByStatus("pending").slice(0, 6) : [];
    if (!pend.length) {
      return '<div class="card" style="grid-column:1/-1"><div class="empty"><div class="ico">' + ic("checkCircle") +
        '</div><h3>Navbat bo‘sh</h3><p>Hamma yangi shablonlar ko‘rib chiqilgan.</p></div></div>';
    }
    return pend.map(adminModCard).join("");
  }

  /* ---- OBUNACHILAR JADVALI (real SUBSCRIBERS) ---- */
  function adminSubRow(s) {
    var credit = (typeof s.aiCredits === "number") ? s.aiCredits.toLocaleString() : "—";
    var removed = s.status === "removed";
    var plan = (typeof planBadge === "function") ? planBadge(s.plan) : esc(s.plan || "");
    var stat = (typeof subscriberStatusBadge === "function") ? subscriberStatusBadge(s.status) : esc(s.status || "");
    return "<tr" + (removed ? ' class="removed"' : "") + ">" +
      '<td><div class="row center gap-10"><span class="av">' + esc(initials(s.name || s.email)) +
        '</span><div class="col" style="gap:1px;min-width:0"><span class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        esc(s.email) + '</span><span class="sub" style="font-size:11px;color:var(--tx-3)">AE ' + esc(s.ae || "—") + " · " + esc(s.device || "—") + "</span></div></div></td>" +
      "<td>" + plan + "</td>" +
      '<td class="cell-strong">' + credit + "</td>" +
      "<td>" + stat + "</td>" +
      '<td onclick="event.stopPropagation()"><div class="row-actions">' +
        (!removed ? '<button class="btn btn-ghost btn-sm" onclick="openAiCreditsSub(\'' + s.id + '\')">Kredit berish</button>' : "") +
        '<button class="act" title="Profil" onclick="route(\'subscriber-detail\',\'' + s.id + '\')">' + ic("chevR") + "</button>" +
      "</div></td></tr>";
  }

  function adminSubsHtml() {
    var subs = (typeof SUBSCRIBERS !== "undefined" && SUBSCRIBERS ? SUBSCRIBERS : []).slice(0, 6);
    if (!subs.length) {
      return '<tr><td colspan="5"><div class="empty" style="padding:26px"><div class="ico">' + ic("plugin") +
        '</div><h3>Obunachi yo‘q</h3><p>AE plugin obunachilari shu yerda ko‘rinadi.</p></div></td></tr>';
    }
    return subs.map(adminSubRow).join("");
  }

  /* ---- VIEW ---- */
  VIEWS.overview = function () {
    var pendCount = (typeof tByStatus === "function") ? tByStatus("pending").length : 0;
    return '<div class="col gap-20">' +
      '<div class="page-head"><div><h1 class="h2">Boshqaruv paneli</h1><div class="lead">Moderatsiya navbati, obunachilar va platforma holati.</div></div>' +
        '<button class="btn btn-ghost" onclick="route(\'overview\')">' + ic("refresh") + " Yangilash</button></div>" +

      '<div class="stat-grid" id="ovAdminStats">' + adminStatsHtml() + "</div>" +

      '<div class="sec-head"><h2>Tasdiqlash navbati</h2><span class="count" id="ovModCount">' + pendCount + ' ta kutmoqda</span>' +
        '<div class="filters"><button class="btn btn-subtle btn-sm" onclick="route(\'moderation\')">To‘liq navbat ' + ic("chevR") + "</button></div></div>" +
      '<div class="mod-grid" id="ovModQueue">' + adminModQueueHtml() + "</div>" +

      '<div class="sec-head"><h2>So‘nggi obunachilar</h2><div class="filters">' +
        '<button class="btn btn-ghost btn-sm" onclick="route(\'subscribers\')">Barchasini ko‘rish ' + ic("chevR") + "</button></div></div>" +
      '<div class="card" style="padding:0"><div class="table-wrap"><table class="data" style="min-width:680px">' +
        '<thead><tr><th>Obunachi</th><th>Reja</th><th class="th-num">Kredit</th><th>Holat</th><th style="width:160px"></th></tr></thead>' +
        '<tbody id="ovSubs">' + adminSubsHtml() + "</tbody></table></div></div>" +
    "</div>";
  };

  /* ---- afterRender: real ma'lumotni yuklab, bo'limlarni yangilash (loopsiz) ---- */
  window.afterRender.overview = async function () {
    try {
      if (typeof StudioTemplates !== "undefined" && StudioTemplates.loadModerationOnly) {
        await StudioTemplates.loadModerationOnly();
      }
    } catch (e) { /* moderatsiya yuklanmadi — bo'sh holat qoladi */ }
    try {
      if (typeof refreshSubscribersFromApi === "function") await refreshSubscribersFromApi();
    } catch (e) { /* obunachilar yuklanmadi — bo'sh holat qoladi */ }
    if (typeof CURRENT !== "undefined" && CURRENT !== "overview") return;
    var st = document.getElementById("ovAdminStats"); if (st) st.innerHTML = adminStatsHtml();
    var mq = document.getElementById("ovModQueue"); if (mq) mq.innerHTML = adminModQueueHtml();
    var mc = document.getElementById("ovModCount");
    if (mc && typeof tByStatus === "function") mc.textContent = tByStatus("pending").length + " ta kutmoqda";
    var su = document.getElementById("ovSubs"); if (su) su.innerHTML = adminSubsHtml();
    if (typeof renderNav === "function") renderNav();
  };
})();
