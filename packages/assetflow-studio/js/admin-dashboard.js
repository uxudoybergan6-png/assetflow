/* ============================================================
   FrameFlow — Admin Dashboard (Overview) · redesign port (mockup e1)
   Layout: 1:1 with admin/_admin-redesign-mockup.html #e1 (adx- classes).
   REDEFINES VIEWS.overview from admin-views.js (loaded after → takes precedence).
   Real data: counts() · subscriberCounts() · tByStatus('pending') · SUBSCRIBERS.
   #2 XSS: all contributor/user text goes through esc(). NO fake numbers.
   Logic preserved: modApprove / modSoftReject / openTplDrawer / route — existing handlers.
   ============================================================ */
(function () {
  "use strict";

  function initials(name) {
    return String(name || "").trim().split(/\s+/).map(function (w) { return w[0] || ""; }).join("").toUpperCase().slice(0, 2) || "?";
  }

  /* mockup g1–g8 avatar/thumb gradient — string hash */
  var ADX_G = ["adx-g1", "adx-g2", "adx-g3", "adx-g4", "adx-g5", "adx-g6", "adx-g7", "adx-g8"];
  function adxGradFor(s) {
    var h = 0; s = String(s || "");
    for (var i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return ADX_G[Math.abs(h) % ADX_G.length];
  }
  function adxGradClass(grad) {
    var n = parseInt(String(grad || "g1").replace("g", ""), 10);
    if (!n || n < 1) n = 1;
    return ADX_G[(n - 1) % ADX_G.length];
  }

  function qthumbHtml(t) {
    var hasMedia = typeof StudioMedia !== "undefined" && StudioMedia.hasAsset &&
      (StudioMedia.hasAsset(t, "thumb") || StudioMedia.hasAsset(t, "preview"));
    if (hasMedia) return StudioMedia.renderThumb(t, "lg");
    return '<span class="' + adxGradClass(t.grad) + '" style="display:block;width:100%;height:100%"></span>';
  }

  /* ---- STAT CARDS (mockup e1 — real values) ---- */
  function statCard(o) {
    return '<div class="adx-stat"><div class="sl"><i class="ph ph-' + o.ic + '"' +
      (o.icColor ? ' style="color:' + o.icColor + '"' : "") + "></i>" + esc(o.label) + "</div>" +
      '<div class="sv">' + o.val + '</div><div class="sf">' + esc(o.foot || "") + "</div></div>";
  }

  function adminStatsHtml() {
    var c = (typeof counts === "function") ? counts() : { pending: 0 };
    var sc = (typeof subscriberCounts === "function") ? subscriberCounts() : { active: 0, total: 0, pro: 0, free: 0, totalDownloads: 0 };
    var usage = (typeof window !== "undefined" && window._ASSETFLOW_PLUGIN_ANALYTICS) ? window._ASSETFLOW_PLUGIN_ANALYTICS.usage : null;
    var dl = (usage && typeof usage.downloadsTotal === "number") ? usage.downloadsTotal : (sc.totalDownloads || 0);
    var dlDisp = dl >= 1000 ? (dl / 1000).toFixed(1) + "K" : String(dl);
    return statCard({ label: "In queue", val: c.pending, ic: "clock-countdown", icColor: "#FFB27C", foot: "awaiting review" }) +
      statCard({ label: "Active subscribers", val: sc.active, ic: "users-three", icColor: "#7CC4FF", foot: sc.total + " total" }) +
      statCard({ label: "Pro subscriptions", val: sc.pro, ic: "crown", icColor: "#C2F04A", foot: sc.free + " Free" }) +
      statCard({ label: "Total downloads", val: dlDisp, ic: "download-simple", foot: "plugin count" });
  }

  /* ---- APPROVAL QUEUE preview (mockup e1 rows — real pending) ---- */
  function adminModRow(t) {
    var con = (t._con) || ((typeof CONTRIBUTORS !== "undefined" && CONTRIBUTORS) ? CONTRIBUTORS.find(function (x) { return x.id === t.cid; }) : null);
    var author = (con && con.name) ? con.name : "Contributor";
    var meta = [author].concat([t.cat, t.res].filter(Boolean)).join(" · ");
    return '<div class="adx-qrow">' +
      '<span class="adx-qthumb">' + qthumbHtml(t) + "</span>" +
      '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.name) + "</div>" +
        '<div style="font-size:10.5px;color:#8A93A3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(meta) + "</div></div>" +
      '<button class="adx-btn adx-btn-ok sm" onclick="modApprove(\'' + t.id + '\')"><i class="ph ph-check"></i>Approve</button>' +
      '<button class="adx-btn2 adx-btn-warn sm" onclick="modSoftReject(\'' + t.id + '\')">Reject</button>' +
      '<button class="adx-iact" title="View" onclick="openTplDrawer(\'' + t.id + '\')"><i class="ph ph-eye"></i></button>' +
      "</div>";
  }

  function adminModQueueHtml() {
    var pend = (typeof tByStatus === "function") ? tByStatus("pending").slice(0, 6) : [];
    if (!pend.length) {
      return '<div class="adx-empty" style="border:0;padding:26px 20px"><span class="ei"><i class="ph ph-check-circle"></i></span>' +
        '<div style="font-weight:600;font-size:13px">Queue is empty</div><div style="font-size:11px;color:var(--muted2);line-height:1.5">All new templates have been reviewed.</div></div>';
    }
    return '<div style="padding:12px 14px;display:flex;flex-direction:column;gap:9px">' + pend.map(adminModRow).join("") + "</div>";
  }

  /* ---- RECENT SUBSCRIBERS table (mockup e1 — real SUBSCRIBERS) ---- */
  function adxPlanBadge(plan) {
    var label = (typeof normalizePlanLabel === "function") ? normalizePlanLabel(plan) : String(plan || "Free");
    var isPro = label === "Pro";
    return '<span class="adx-bdg ' + (isPro ? "adx-bdg-pro" : "adx-bdg-free") + '">' + (isPro ? "PRO" : "FREE") + "</span>";
  }
  function adxSubStatusBadge(status) {
    if (status === "active") return '<span class="adx-bdg adx-bdg-active"><span class="bd"></span>Active</span>';
    if (status === "blocked") return '<span class="adx-bdg adx-bdg-blocked"><span class="bd"></span>Blocked</span>';
    return '<span class="adx-bdg adx-bdg-removed"><span class="bd"></span>Removed</span>';
  }

  function adminSubRow(s) {
    var credit = (typeof s.aiCredits === "number") ? s.aiCredits.toLocaleString() : "—";
    var nm = s.name || s.email || "";
    return '<tr style="cursor:pointer" onclick="route(\'subscriber-detail\',\'' + s.id + '\')">' +
      '<td><div class="adx-who"><span class="adx-av ' + adxGradFor(s.email || nm) + '">' + esc(initials(nm)) +
        '</span><div style="min-width:0"><div class="nm">' + esc(nm) + '</div><div class="em">' + esc(s.email || "") + "</div></div></div></td>" +
      "<td>" + adxPlanBadge(s.plan) + "</td>" +
      '<td class="num" style="text-align:right">' + credit + "</td>" +
      "<td>" + adxSubStatusBadge(s.status) + "</td></tr>";
  }

  function adminSubsHtml() {
    var subs = (typeof SUBSCRIBERS !== "undefined" && SUBSCRIBERS ? SUBSCRIBERS : []).slice(0, 6);
    if (!subs.length) {
      return '<tr><td colspan="4"><div class="adx-empty" style="border:0;padding:26px 20px"><span class="ei"><i class="ph ph-puzzle-piece"></i></span>' +
        '<div style="font-weight:600;font-size:13px">No subscribers</div><div style="font-size:11px;color:var(--muted2)">AE plugin subscribers will appear here.</div></div></td></tr>';
    }
    return subs.map(adminSubRow).join("");
  }

  /* ---- VIEW (mockup e1) ---- */
  VIEWS.overview = function () {
    var pendCount = (typeof tByStatus === "function") ? tByStatus("pending").length : 0;
    return '<div style="display:flex;align-items:flex-end">' +
        '<div><div class="adx-h22">Platform status</div><div style="font-size:12.5px;color:#8A93A3;margin-top:3px">Today’s moderation and subscription metrics</div></div>' +
        '<span style="flex:1"></span>' +
        '<button class="adx-btn2 sm" onclick="route(\'overview\')"><i class="ph ph-arrow-clockwise"></i>Refresh</button></div>' +

      '<div class="adx-statgrid" id="ovAdminStats">' + adminStatsHtml() + "</div>" +

      '<div class="adx-ovgrid">' +
        '<div class="adx-card">' +
          '<div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Approval queue</span>' +
            '<span class="adx-bdg adx-bdg-pending" style="margin-left:8px" id="ovModCount"><span class="bd"></span>' + pendCount + ' pending</span>' +
            '<span style="flex:1"></span>' +
            '<button class="adx-link" onclick="route(\'moderation\')">Full queue <i class="ph ph-arrow-right"></i></button></div>' +
          '<div id="ovModQueue">' + adminModQueueHtml() + "</div>" +
        "</div>" +
        '<div class="adx-card">' +
          '<div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">Recent subscribers</span><span style="flex:1"></span>' +
            '<button class="adx-link" onclick="route(\'subscribers\')">View all <i class="ph ph-arrow-right"></i></button></div>' +
          '<div style="overflow-x:auto"><table class="adx-tbl" style="min-width:420px"><thead><tr><th>Subscriber</th><th>Plan</th><th style="text-align:right">Credits</th><th>Status</th></tr></thead>' +
          '<tbody id="ovSubs">' + adminSubsHtml() + "</tbody></table></div>" +
        "</div>" +
      "</div>";
  };

  /* ---- afterRender: load real data and refresh sections (no loop) ---- */
  window.afterRender.overview = async function () {
    // Skeleton until the API responds (avoid a flash of empty preview).
    if (typeof adxSkelList === "function") {
      if (!(typeof TEMPLATES !== "undefined" && TEMPLATES.length)) {
        var mqS = document.getElementById("ovModQueue"); if (mqS) mqS.innerHTML = adxSkelList(3);
      }
      if (!(typeof SUBSCRIBERS !== "undefined" && SUBSCRIBERS.length)) {
        var suS = document.getElementById("ovSubs");
        if (suS) suS.innerHTML = '<tr><td colspan="4" style="padding:4px">' + adxSkelList(3, false) + "</td></tr>";
      }
    }
    try {
      if (typeof StudioTemplates !== "undefined" && StudioTemplates.loadModerationOnly) {
        await StudioTemplates.loadModerationOnly();
      }
    } catch (e) { /* moderation failed to load — empty state remains */ }
    try {
      if (typeof refreshSubscribersFromApi === "function") await refreshSubscribersFromApi();
    } catch (e) { /* subscribers failed to load — empty state remains */ }
    if (typeof CURRENT !== "undefined" && CURRENT !== "overview") return;
    var st = document.getElementById("ovAdminStats"); if (st) st.innerHTML = adminStatsHtml();
    var mq = document.getElementById("ovModQueue"); if (mq) mq.innerHTML = adminModQueueHtml();
    var mc = document.getElementById("ovModCount");
    if (mc && typeof tByStatus === "function") mc.innerHTML = '<span class="bd"></span>' + tByStatus("pending").length + " pending";
    var su = document.getElementById("ovSubs"); if (su) su.innerHTML = adminSubsHtml();
    if (typeof renderNav === "function") renderNav();
  };
})();
