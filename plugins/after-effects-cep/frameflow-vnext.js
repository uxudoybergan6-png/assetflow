(function () {
  "use strict";

  var state = {
    mode: "image",
    showcase: 0,
    timer: null,
    showcasePaused: false,
    sessionSignature: "",
    toolsTrigger: null,
    wired: false
  };
  var tools = [
    { id: "assistant", name: "Creative Assistant", desc: "Start with an idea and keep refining", icon: "FF", mode: "assistant", color: "#c9ff19", featured: true },
    { id: "activity", name: "Activity", desc: "Follow active and recent generations", icon: "ACT", action: "activity", color: "#bd8cff" },
    { id: "sessions", name: "Sessions", desc: "Continue a persistent creative session", icon: "SES", action: "sessions", color: "#7ec7ff" },
    { id: "projects", name: "Projects", desc: "Organize generations and assets", icon: "PRJ", action: "projects", color: "#ff9973" },
    { id: "templates", name: "Video Templates", desc: "Browse Adobe-ready templates", icon: "TPL", action: "video", color: "#72cfff" }
  ];
  var allTools = [
    { id: "assistant", name: "Creative Assistant", desc: "Start with an idea and keep refining", icon: "FF", mode: "assistant", color: "#c9ff19" },
    { id: "image", name: "Image Generator", desc: "Create and edit with references", icon: "IMG", mode: "image", color: "#c9ff19" },
    { id: "video", name: "Video Generator", desc: "Create cinematic video", icon: "VID", mode: "video", color: "#80e5ff" },
    { id: "voice", name: "Voiceover", desc: "Natural multilingual narration", icon: "VO", mode: "voice", color: "#ffd26f" },
    { id: "sfx", name: "Sound FX", desc: "Generate production-ready effects", icon: "SFX", mode: "sfx", color: "#ff8fa3" },
    { id: "activity", name: "Activity", desc: "Follow active and recent generations", icon: "ACT", action: "activity", color: "#bd8cff" },
    { id: "sessions", name: "Sessions", desc: "Continue a persistent creative session", icon: "SES", action: "sessions", color: "#7ec7ff" },
    { id: "projects", name: "Projects", desc: "Organize generations and assets", icon: "PRJ", action: "projects", color: "#ff9973" },
    { id: "library", name: "My Library", desc: "Generated media and downloads", icon: "LIB", action: "library", color: "#8ef0c2" },
    { id: "templates", name: "Video Templates", desc: "Browse Adobe-ready templates", icon: "TPL", action: "video", color: "#72cfff" },
    { id: "music", name: "Music", desc: "Browse music for your edit", icon: "MUS", action: "music", color: "#ffce64" },
    { id: "luts", name: "LUTs", desc: "Browse color looks", icon: "LUT", action: "luts", color: "#e2a8ff" }
  ];

  function byId(id) { return document.getElementById(id); }
  function isPremiere() { return String(window.AF_TEMPLATE_APP || "").toLowerCase() === "pr"; }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function toast(message, type) {
    try { if (typeof window.showToast === "function") window.showToast(message, type || "info"); } catch (_) {}
  }
  function goBrowse(nav) {
    if (typeof window.homeGo === "function") window.homeGo(nav || "video");
    else if (typeof window.afNavTab === "function") window.afNavTab("catalog");
  }
  function goCreate(mode) {
    if (typeof window.afOpenCreateDraft === "function") window.afOpenCreateDraft({ mode: mode === "assistant" ? "image" : mode });
  }

  function setMode(mode) {
    state.mode = ["image", "video", "voice", "sfx"].indexOf(mode) >= 0 ? mode : "image";
    var root = byId("ffxQuickModes");
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll("[data-ffx-mode]"), function (button) {
      var on = button.getAttribute("data-ffx-mode") === state.mode;
      button.classList.toggle("active", on);
      button.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function writePrompt(target, text) {
    if (!target) return;
    if ("value" in target) target.value = text;
    else target.textContent = text;
    try { target.dispatchEvent(new Event("input", { bubbles: true })); } catch (_) {}
    try { target.focus(); } catch (_) {}
  }
  function startSession() {
    var input = byId("homeHeroPrompt");
    var prompt = String(input && input.value || "").trim();
    var mode = state.mode;
    if (!prompt) {
      toast("Write a prompt to start creating.", "warning");
      if (input) {
        input.setAttribute("aria-invalid", "true");
        try { input.focus(); } catch (_) {}
      }
      return;
    }
    if (input) input.removeAttribute("aria-invalid");
    if (typeof window.afOpenCreateDraft === "function") {
      Promise.resolve(window.afOpenCreateDraft({ mode: mode, prompt: prompt })).then(function () {
        if (input) input.value = "";
      }).catch(function (error) {
        toast((error && error.message) || "The Create workspace could not be prepared.", "error");
      });
    }
  }

  function templateRows() {
    var source = [];
    try { source = (window.__fhomeShelves && window.__fhomeShelves.visual) || []; } catch (_) {}
    if (!source.length) return [];
    return source.slice(0, 3).map(function (item, index) {
      return {
        title: item.displayName || item.name || item.n || "Adobe-ready template",
        desc: item.description || item.desc || "Adobe-ready creative template.",
        meta: item.isPro ? "PRO · Adobe ready" : "Adobe ready",
        nav: item.nav || "video",
        key: item.id && !item.n ? "__srv_" + item.id : item.n,
        thumb: item.thumb || item.thumbUrl || ""
      };
    });
  }
  function renderShowcase() {
    var stage = byId("ffxShowcaseStage"), progress = byId("ffxShowcaseProgress");
    if (!stage || !progress) return;
    var rows = templateRows();
    if (!rows.length) {
      stage.innerHTML = '<div class="ffx-showcase-empty"><b>Templates are syncing</b><span>Refresh the catalog to load live trending templates.</span></div>';
      progress.innerHTML = "";
      return;
    }
    if (state.showcase >= rows.length) state.showcase = 0;
    stage.innerHTML = rows.map(function (item, index) {
      var active = index === state.showcase;
      return '<button type="button" class="ffx-showcase-slide' + (active ? " active" : "") + '" data-ffx-slide="' + index + '" data-nav="' + esc(item.nav) + '" data-key="' + esc(item.key || "") + '" aria-hidden="' + (active ? "false" : "true") + '" tabindex="' + (active ? "0" : "-1") + '">' +
        '<img src="' + esc(item.thumb) + '" alt="' + esc(item.title) + '"><span class="ffx-showcase-copy"><span>0' + (index + 1) + ' · TRENDING</span><h3>' + esc(item.title) + '</h3><p>' + esc(item.desc) + '</p><b>' + esc(item.meta) + '</b></span></button>';
    }).join("");
    progress.innerHTML = rows.map(function (_, index) { return '<button type="button" class="' + (index === state.showcase ? "active" : "") + '" data-ffx-show="' + index + '" aria-label="Show template ' + (index + 1) + '"></button>'; }).join("");
  }
  function setShowcase(index) {
    var count = templateRows().length || 1;
    state.showcase = (index + count) % count;
    renderShowcase();
    restartShowcase();
  }
  function restartShowcase() {
    clearInterval(state.timer);
    try { if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (_) {}
    state.timer = setInterval(function () {
      if (!state.showcasePaused && !document.hidden && document.documentElement.classList.contains("home-mode")) setShowcase(state.showcase + 1);
    }, 4200);
  }

  function sessions() {
    try { return typeof window.axwsGetSessions === "function" ? (window.axwsGetSessions() || []) : []; } catch (_) { return []; }
  }
  function sessionTitle(session) {
    try { if (typeof window.afSessionDisplayName === "function") return window.afSessionDisplayName(session); } catch (_) {}
    return session.title || "Creative session";
  }
  function openSession(session) {
    if (typeof window.afOpenCreateSession === "function") window.afOpenCreateSession(session);
  }
  function renderSessions() {
    var rail = byId("ffxSessionRail");
    if (!rail) return;
    var rows = sessions().slice(0, 8);
    var signature = rows.map(function (session) {
      return [session.id, session.updatedAt, session.count, session.thumb || session.lastThumb || ""].join(":");
    }).join("|");
    if (signature === state.sessionSignature && rail.children.length) return;
    var previousScroll = rail.scrollLeft;
    var focused = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("data-ffx-session");
    state.sessionSignature = signature;
    rail.innerHTML = '<button type="button" class="ffx-session-card new" data-ffx-new><span>＋</span><b>New session</b></button>' + rows.map(function (session, index) {
      var thumb = session.thumb || session.lastThumb || "";
      var mode = session.mode || "image";
      var art = thumb ? '<img src="' + esc(thumb) + '" alt="">' : '<span class="ffx-session-art" style="background:linear-gradient(145deg,' + (index % 2 ? "#252a43,#11131c" : "#28301c,#12150f") + ')"></span>';
      return '<button type="button" class="ffx-session-card" data-ffx-session="' + index + '">' + art + '<div><b>' + esc(sessionTitle(session)) + '</b><small>' + esc(mode.toUpperCase()) + ' · ' + Number(session.count || 0) + ' results</small></div></button>';
    }).join("");
    Array.prototype.forEach.call(rail.querySelectorAll("[data-ffx-session]"), function (button) {
      button.addEventListener("click", function () { openSession(rows[Number(button.getAttribute("data-ffx-session"))]); });
    });
    var fresh = rail.querySelector("[data-ffx-new]");
    if (fresh) fresh.addEventListener("click", function () { startSession(); });
    rail.scrollLeft = previousScroll;
    if (focused != null) {
      var restore = rail.querySelector('[data-ffx-session="' + focused + '"]');
      if (restore) try { restore.focus(); } catch (_) {}
    }
  }

  function renderPulse() {
    var jobs = [];
    try { jobs = window.afJobStore ? window.afJobStore.list() : []; } catch (_) {}
    var active = jobs[0];
    var title = byId("ffxPulseTitle"), meta = byId("ffxPulseMeta"), status = byId("ffxPulseState"), bar = byId("ffxPulseProgress"), adobe = byId("ffxAdobeState");
    if (title) title.textContent = active ? (active.prompt || active.title || "Generation in progress") : "No active render";
    if (meta) meta.textContent = active ? ((active.cat || active.tool || "Generation") + " · processing") : "Your queue is clear";
    if (status) status.textContent = active ? "ACTIVE" : "READY";
    if (bar) {
      var progress = Number(active && (active.progress != null ? active.progress : active.percent));
      var known = isFinite(progress) && progress >= 0;
      bar.classList.toggle("indeterminate", !!active && !known);
      bar.style.width = active && known ? Math.max(0, Math.min(100, progress)) + "%" : "0";
    }
    var capabilities = window.AF_HOST_CAPABILITIES;
    var hostLabel = isPremiere() ? "Premiere" : "After Effects";
    if (adobe) adobe.textContent = capabilities && capabilities.ok ? hostLabel + " bridge connected" : capabilities === null ? hostLabel + " bridge unavailable" : "Checking " + hostLabel + " bridge…";
    var adobeState = adobe && adobe.closest ? adobe.closest(".ffx-pulse-item") : null;
    if (adobeState) {
      var badge = adobeState.querySelector("strong");
      if (badge) {
        badge.textContent = capabilities && capabilities.ok ? "LIVE" : capabilities === null ? "OFFLINE" : "CHECKING";
        badge.classList.toggle("ready-text", !!(capabilities && capabilities.ok));
      }
      var icon = adobeState.children && adobeState.children[0];
      if (icon) {
        icon.textContent = capabilities && capabilities.ok ? "✓" : capabilities === null ? "!" : "…";
        icon.classList.toggle("ready", !!(capabilities && capabilities.ok));
      }
    }
  }

  function renderTools() {
    var grid = byId("ffxToolGrid");
    if (!grid) return;
    grid.innerHTML = tools.map(function (tool) {
      return '<button type="button" class="ffx-tool-card' + (tool.featured ? " featured" : "") + '" data-ffx-tool="' + esc(tool.mode || tool.action) + '" style="--tool-color:' + tool.color + '"><span class="ffx-tool-icon">' + esc(tool.icon) + '</span><strong>' + esc(tool.name) + '</strong><small>' + esc(tool.desc) + '</small></button>';
    }).join("");
    var allButton = byId("ffxAllTools");
    var count = allButton && allButton.querySelector("span");
    if (count) count.textContent = String(allTools.length);
  }
  function ensureToolsModal() {
    var layer = byId("ffxToolsModal");
    if (layer) return layer;
    layer = document.createElement("div");
    layer.className = "ffx-tools-modal";
    layer.id = "ffxToolsModal";
    layer.hidden = true;
    layer.innerHTML = '<section class="ffx-tools-dialog" role="dialog" aria-modal="true" aria-labelledby="ffxToolsDialogTitle"><header><div><span>TOOL LIBRARY</span><h2 id="ffxToolsDialogTitle">All FrameFlow tools</h2></div><button type="button" data-ffx-close aria-label="Close">×</button></header><input id="ffxToolSearch" type="search" placeholder="Search tools"><div class="ffx-tools-list" id="ffxToolsList"></div></section>';
    document.body.appendChild(layer);
    layer.addEventListener("click", function (event) { if (event.target === layer || event.target.closest("[data-ffx-close]")) closeTools(); });
    byId("ffxToolSearch").addEventListener("input", function () { renderAllTools(this.value); });
    return layer;
  }
  function renderAllTools(query) {
    var host = byId("ffxToolsList");
    if (!host) return;
    var needle = String(query || "").trim().toLowerCase();
    var rows = allTools.filter(function (tool) { return !needle || (tool.name + " " + tool.desc).toLowerCase().indexOf(needle) >= 0; });
    host.innerHTML = rows.map(function (tool) {
      return '<button type="button" class="ffx-tool-row" data-ffx-all="' + esc(tool.mode || tool.action) + '" style="--tool-color:' + tool.color + '"><span>' + esc(tool.icon) + '</span><div><b>' + esc(tool.name) + '</b><small>' + esc(tool.desc) + '</small></div><em>OPEN ↗</em></button>';
    }).join("");
  }
  function openTools() {
    var layer = ensureToolsModal();
    state.toolsTrigger = document.activeElement;
    byId("ffxToolSearch").value = "";
    renderAllTools("");
    layer.hidden = false;
    var app = byId("demoStage");
    if (app) { app.setAttribute("aria-hidden", "true"); try { app.inert = true; } catch (_) {} }
    setTimeout(function () { try { byId("ffxToolSearch").focus(); } catch (_) {} }, 0);
  }
  function closeTools() {
    var layer = byId("ffxToolsModal");
    if (!layer || layer.hidden) return;
    layer.hidden = true;
    var app = byId("demoStage");
    if (app) { app.removeAttribute("aria-hidden"); try { app.inert = false; } catch (_) {} }
    if (state.toolsTrigger && state.toolsTrigger.focus) try { state.toolsTrigger.focus(); } catch (_) {}
    state.toolsTrigger = null;
  }
  function trapTools(event) {
    var layer = byId("ffxToolsModal");
    if (!layer || layer.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); closeTools(); return; }
    if (event.key !== "Tab") return;
    var focusable = layer.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function runTool(action) {
    closeTools();
    if (["assistant", "image", "video", "voice", "sfx"].indexOf(action) >= 0) { goCreate(action); return; }
    if (action === "activity") { var activity = byId("ffActivityBtn"); if (activity) activity.click(); return; }
    if (action === "sessions" || action === "projects" || action === "library") {
      if (typeof window.afNavTab === "function") window.afNavTab("ai");
      if (typeof window.axGo === "function") window.axGo(action === "library" ? "history" : action);
      return;
    }
    goBrowse(action || "video");
  }

  function renderHost() {
    var host = byId("ffxHostContext");
    if (!host) return;
    var capabilities = window.AF_HOST_CAPABILITIES;
    var stateLabel = capabilities && capabilities.ok ? "LIVE" : capabilities === null ? "OFFLINE" : "CHECKING";
    host.innerHTML = (isPremiere() ? "PR · Active sequence" : "AE · Active composition") + " <b>" + stateLabel + "</b>";
    host.setAttribute("data-state", stateLabel);
    host.classList.toggle("offline", capabilities === null);
  }
  function renderHomeVNext() {
    if (!byId("ffxHome")) return;
    renderHost(); renderShowcase(); renderSessions(); renderPulse(); renderTools(); restartShowcase();
  }

  function wire() {
    if (state.wired || !byId("ffxHome")) return;
    state.wired = true;
    byId("ffxQuickModes").addEventListener("click", function (event) { var button = event.target.closest("[data-ffx-mode]"); if (button) setMode(button.getAttribute("data-ffx-mode")); });
    byId("ffxStartCreate").addEventListener("click", startSession);
    byId("ffxAutoModel").addEventListener("click", function () {
      this.setAttribute("aria-pressed", "true");
      toast("FrameFlow Auto will use the best live model for this mode.", "info");
      byId("homeHeroPrompt").focus();
    });
    byId("homeHeroPrompt").addEventListener("keydown", function (event) { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); startSession(); } });
    byId("ffxHome").addEventListener("click", function (event) {
      var prompt = event.target.closest("[data-ffx-prompt]"); if (prompt) { byId("homeHeroPrompt").value = prompt.getAttribute("data-ffx-prompt"); byId("homeHeroPrompt").focus(); return; }
      var tool = event.target.closest("[data-ffx-tool]"); if (tool) { goCreate(tool.getAttribute("data-ffx-tool")); return; }
      var slide = event.target.closest("[data-ffx-slide]"); if (slide) {
        var key = slide.getAttribute("data-key");
        goBrowse(slide.getAttribute("data-nav") || "video");
        try { if (key && typeof packs !== "undefined" && packs && packs[key] && typeof window.openPack === "function") window.openPack(key); } catch (_) {}
        return;
      }
      var show = event.target.closest("[data-ffx-show]"); if (show) setShowcase(Number(show.getAttribute("data-ffx-show")));
    });
    byId("ffxShowcasePrev").addEventListener("click", function () { setShowcase(state.showcase - 1); });
    byId("ffxShowcaseNext").addEventListener("click", function () { setShowcase(state.showcase + 1); });
    byId("ffxBrowseTemplates").addEventListener("click", function () { goBrowse("video"); });
    byId("ffxRecentPrev").addEventListener("click", function () { byId("ffxSessionRail").scrollBy({ left: -320, behavior: "smooth" }); });
    byId("ffxRecentNext").addEventListener("click", function () { byId("ffxSessionRail").scrollBy({ left: 320, behavior: "smooth" }); });
    byId("ffxOpenActivity").addEventListener("click", function () { var button = byId("ffActivityBtn"); if (button) button.click(); });
    byId("ffxOpenProjects").addEventListener("click", function () { runTool("projects"); });
    byId("ffxAllTools").addEventListener("click", openTools);
    document.addEventListener("click", function (event) { var row = event.target.closest && event.target.closest("[data-ffx-all]"); if (row) runTool(row.getAttribute("data-ffx-all")); });
    var showcase = byId("ffxShowcaseStage");
    if (showcase) {
      showcase.addEventListener("mouseenter", function () { state.showcasePaused = true; });
      showcase.addEventListener("mouseleave", function () { state.showcasePaused = false; });
      showcase.addEventListener("focusin", function () { state.showcasePaused = true; });
      showcase.addEventListener("focusout", function () { state.showcasePaused = false; });
    }
    document.addEventListener("keydown", trapTools);
  }

  var originalRenderHome = window.renderHome;
  if (typeof originalRenderHome === "function") {
    window.renderHome = function () { var result = originalRenderHome.apply(this, arguments); renderHomeVNext(); return result; };
  }
  wire(); renderHomeVNext(); setMode("image");
  window.FrameFlowVNext = { render: renderHomeVNext, setMode: setMode, startSession: startSession };
  window.addEventListener("resize", renderPulse);
  setInterval(function () { if (document.documentElement.classList.contains("home-mode")) { renderSessions(); renderPulse(); renderHost(); } }, 5000);
})();
