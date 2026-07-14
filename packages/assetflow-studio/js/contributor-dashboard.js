/* ============================================================
   AssetFlow — Contributor Dashboard (Overview) · phase 2a
   Layout: 1:1 with design-preview/studio-dashboard.html mockup.
   This file REDEFINES VIEWS.overview from contributor-views.js
   (loaded AFTER contributor-views.js in index.html → takes precedence).
   Connected to real data (TEMPLATES + DL_7). NO fake numbers.
   ============================================================ */
(function () {
  "use strict";

  /* short weekday names for the last 7 days (old->new) */
  function af7Weekdays() {
    var NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var out = [];
    var now = new Date();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(now.getDate() - i);
      out.push(NAMES[d.getDay()]);
    }
    return out;
  }

  /* Chart data — REAL.
     1) If daily activityByDay (DL_7) is populated → last 7 days.
        (Note: this comes from admin /plugin-analytics — contributor init
         doesn't load it, so it's usually empty.)
     2) Otherwise → REAL per-template downloads (contributor always sees these).
     3) If nothing → empty state (NO fake bars). */
  function overviewChartData() {
    var ts = tByContributor(contributorId());
    var daily = (typeof DL_7 !== "undefined" && Array.isArray(DL_7)) ? DL_7 : [];
    var dailySum = daily.reduce(function (a, b) { return a + (b || 0); }, 0);
    if (dailySum > 0) {
      var labels = af7Weekdays();
      return {
        title: "Activity — downloads",
        meta: "Last 7 days · total " + dailySum.toLocaleString(),
        bars: daily.map(function (v, i) { return { v: v || 0, label: labels[i] }; }),
      };
    }
    var totalDl = ts.reduce(function (a, t) { return a + (t.dl || 0); }, 0);
    var top = ts.filter(function (t) { return (t.dl || 0) > 0; })
      .sort(function (a, b) { return (b.dl || 0) - (a.dl || 0); })
      .slice(0, 7);
    if (top.length) {
      return {
        title: "Downloads — by template",
        meta: "Top " + top.length + " · total " + totalDl.toLocaleString(),
        bars: top.map(function (t) { return { v: t.dl || 0, label: t.name || "" }; }),
      };
    }
    return { title: "Activity — downloads", meta: "No data", bars: [] };
  }

  function overviewChartHtml(ch) {
    if (!ch.bars.length) {
      return '<div class="empty" style="padding:30px 16px"><div class="ico">' + ic("chart") +
        '</div><p class="small">No download data yet. It will appear here once your ' +
        'templates are downloaded in the AE plugin.</p></div>';
    }
    var max = Math.max.apply(null, ch.bars.map(function (b) { return b.v; }).concat([1]));
    var aria = ch.bars.map(function (b) { return b.label + " " + b.v; }).join(", ");
    return '<div class="chart" role="img" aria-label="' + esc(ch.title + ": " + aria) + '">' +
      ch.bars.map(function (b) {
        var h = Math.max(4, Math.round((b.v / max) * 100));
        var lbl = b.label.length > 10 ? b.label.slice(0, 9) + "…" : b.label;
        return '<div class="chart-col" title="' + esc(b.label + ": " + b.v.toLocaleString()) +
          '"><div class="chart-bar-wrap"><div class="chart-bar" style="height:' + h +
          '%"></div></div><span class="chart-x">' + esc(lbl) + "</span></div>";
      }).join("") + "</div>";
  }

  function statCard(o) {
    return '<div class="statcard"><div class="stat-top"><span class="lbl">' + esc(o.label) +
      '</span><span class="stat-ico ' + (o.variant || "") + '">' + ic(o.ic) + "</span></div>" +
      '<div class="num">' + o.val + '</div><span class="trend flat">' + esc(o.foot || "") + "</span></div>";
  }

  var SEARCH_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;flex:0 0 auto">' +
    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

  function ovTable(ts) {
    return '<div class="card"><div class="table-wrap"><table class="data" id="ovTable" style="min-width:680px">' +
      '<thead><tr><th style="width:46%">Template</th><th>Status</th><th>Date</th>' +
      '<th class="th-num">Downloads</th><th style="width:84px"></th></tr></thead><tbody>' +
      ts.map(function (t) {
        var dl = t.dl ? Number(t.dl).toLocaleString() : "—";
        var actions =
          ((t.status === "draft" || t.status === "soft")
            ? '<button class="act success" title="Submit for moderation" onclick="event.stopPropagation();submitDraftToModeration(\'' + t.id + '\')">' + ic("upload") + "</button>"
            : "") +
          '<button class="act" title="View" onclick="event.stopPropagation();openTplDrawer(\'' + t.id + '\')">' + ic("eye") + "</button>";
        return '<tr data-name="' + esc(((t.name || "") + " " + (t.cat || "")).toLowerCase()) +
          '" style="cursor:pointer" onclick="openTplDrawer(\'' + t.id + '\')">' +
          '<td><div class="tmpl-cell"><div class="row-thumb">' + thumbArt(t.grad, "", true) +
          '</div><div class="tmpl-meta"><span class="nm">' + esc(t.name) +
          '</span><span class="sub">' + esc(t.cat || "") + "</span></div></div></td>" +
          "<td>" + badge(t.status) + "</td>" +
          '<td class="cell-muted mono">' + esc(t.created || "") + "</td>" +
          '<td class="cell-num cell-strong">' + dl + "</td>" +
          '<td onclick="event.stopPropagation()"><div class="row-actions">' + actions + "</div></td></tr>";
      }).join("") +
      "</tbody></table></div></div>";
  }

  window.ovTableFilter = function (q) {
    q = (q || "").trim().toLowerCase();
    var rows = document.querySelectorAll("#ovTable tbody tr");
    Array.prototype.forEach.call(rows, function (tr) {
      var hay = tr.getAttribute("data-name") || "";
      tr.style.display = !q || hay.indexOf(q) !== -1 ? "" : "none";
    });
  };

  VIEWS.overview = function () {
    var ts = tByContributor(contributorId());
    var ap = ts.filter(function (t) { return t.status === "approved"; }).length;
    var pe = ts.filter(function (t) { return t.status === "pending"; }).length;
    var reviewed = ts.filter(function (t) { return ["approved", "soft", "hard"].indexOf(t.status) !== -1; }).length;
    var rate = reviewed ? Math.round((ap / reviewed) * 100) : (ts.length ? Math.round((ap / ts.length) * 100) : 0);
    var dl = ts.reduce(function (a, t) { return a + (t.dl || 0); }, 0);
    var im = ts.reduce(function (a, t) { return a + (t.imports || 0); }, 0);
    var sess = (typeof AssetFlowAuth !== "undefined" && AssetFlowAuth.getSession) ? AssetFlowAuth.getSession() : null;
    var first = ((sess && sess.name) || "").split(" ")[0] || "";
    var ch = overviewChartData();

    return '<div class="col gap-20">' +
      '<div class="page-head"><div><h1 class="h2">Dashboard</h1><div class="lead">' +
        (first ? "Welcome, " + esc(first) + " — " : "") +
        "your status today and your templates.</div></div>" +
        '<button class="btn btn-primary btn-lg" onclick="startNewUpload()">' + ic("upload") +
        " Upload new template</button></div>" +

      '<section class="stat-grid" aria-label="Key metrics">' +
        statCard({ label: "Total templates", val: ts.length, ic: "layers", foot: "all statuses" }) +
        statCard({ label: "Approved", val: ap, ic: "checkCircle", foot: reviewed ? rate + "% approval rate" : "not reviewed yet" }) +
        statCard({ label: "Under review", val: pe, ic: "clock", variant: "amber", foot: pe ? "in moderation" : "queue empty" }) +
        statCard({ label: "Total downloads", val: dl.toLocaleString(), ic: "download", variant: "blue", foot: im.toLocaleString() + " imports" }) +
      "</section>" +

      '<div class="dash-grid">' +
        '<div class="card"><div class="card-head"><div><h3>' + esc(ch.title) +
          '</h3><span class="small">' + esc(ch.meta) + "</span></div></div>" +
          '<div class="card-pad" id="ovChart">' + overviewChartHtml(ch) + "</div></div>" +

        '<div class="col gap-12"><div class="row between center wrap gap-12">' +
          "<h3>Your templates</h3>" +
          '<div class="search" style="height:34px;width:240px;max-width:100%">' + SEARCH_SVG +
          '<input id="ovTableSearch" placeholder="Search templates…" oninput="ovTableFilter(this.value)"></div></div>' +
          (ts.length
            ? ovTable(ts)
            : '<div class="card"><div class="empty"><div class="ico">' + ic("layers") +
              '</div><h3>No templates</h3><p>Upload your first motion template to get started.</p>' +
              '<button class="btn btn-primary" onclick="startNewUpload()">' + ic("upload") +
              " Upload new</button></div></div>") +
        "</div>" +
      "</div>" +
    "</div>";
  };

  /* Overview renders fully in sync from real data (TEMPLATES + DL_7).
     Old messages panel removed for 1:1 mockup match — no extra async. */
  window.afterRender.overview = function () {};
})();
