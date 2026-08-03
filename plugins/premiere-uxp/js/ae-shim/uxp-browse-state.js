/* Premiere UXP browse holatini qayta ochilganda tiklash (P5).
 * MutationObserver ishlatilmaydi: spike'da konstruktor bor, ammo callback otilmaydi. */
(function () {
  "use strict";
  try { if (!require("uxp")) return; } catch (e) { return; }

  var KEY = "ff.pr.browseState.v1";
  var restored = false;
  var saveTimer = 0;
  var pending = read();
  var userTouched = false;

  function allowed(v, list, fallback) { return list.indexOf(v) >= 0 ? v : fallback; }
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function snapshot() {
    var html = document.documentElement;
    var sc = document.querySelector(".scroll-area");
    return {
      nav: typeof currentNav !== "undefined" ? currentNav : "video",
      page: typeof currentPage !== "undefined" ? currentPage : "assets",
      sub: typeof currentSub !== "undefined" ? currentSub : "all",
      orient: typeof currentOrient !== "undefined" ? currentOrient : "all",
      res: typeof currentRes !== "undefined" ? currentRes : "all",
      search: typeof currentSearch !== "undefined" ? currentSearch : "",
      sort: typeof currentSort !== "undefined" ? currentSort : "relevant",
      mode: html.classList.contains("home-mode") ? "home"
        : html.classList.contains("lib-mode") ? "library"
          : html.classList.contains("ai-mode") ? "ai" : "catalog",
      scrollTop: sc ? Math.max(0, Math.round(sc.scrollTop || 0)) : 0,
      at: Date.now(),
    };
  }
  function save() {
    if (!restored) return;
    try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (e) { /* kv limit */ }
  }
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 180);
  }
  function restoreScroll(top) {
    if (!(top > 0)) return;
    [80, 350, 1000].forEach(function (ms) {
      setTimeout(function () {
        var sc = document.querySelector(".scroll-area");
        if (sc) sc.scrollTop = top;
      }, ms);
    });
  }
  function restore() {
    if (restored) return;
    restored = true;
    // Cold-start davomida foydalanuvchi o'zi pane/filtrni almashtirgan bo'lsa,
    // 50s keyin eski holat bilan uning tanlovini bosib ketmaymiz.
    if (userTouched) { save(); return; }
    var s = pending;
    if (!s || Date.now() - Number(s.at || 0) > 30 * 24 * 60 * 60 * 1000) return;

    var nav = allowed(String(s.nav || ""), ["video", "motion", "graphics", "luts", "music", "sfx", "ai"], "video");
    if (s.mode === "home" && typeof goHome === "function") {
      goHome(); restoreScroll(Number(s.scrollTop || 0)); return;
    }
    if (s.mode === "library" && typeof afLibOpen === "function") {
      afLibOpen("downloaded"); restoreScroll(Number(s.scrollTop || 0)); return;
    }
    var link = document.querySelector('.env-side-link[data-nav="' + nav + '"]');
    if (typeof switchNavFromSidebar === "function") switchNavFromSidebar(link, nav);
    if (nav === "ai") { restoreScroll(Number(s.scrollTop || 0)); return; }

    currentPage = allowed(String(s.page || ""), ["assets", "downloaded"], "assets");
    currentSub = String(s.sub || "all");
    currentOrient = allowed(String(s.orient || ""), ["all", "horizontal", "vertical", "square"], "all");
    currentRes = allowed(String(s.res || ""), ["all", "2k", "4k", "5k"], "all");
    currentSearch = String(s.search || "").slice(0, 200).toLowerCase();
    currentSort = allowed(String(s.sort || ""), ["relevant", "name", "newest"], "relevant");
    var input = document.getElementById("searchInput"); if (input) input.value = currentSearch;
    var sortLabels = { relevant: "Relevant", newest: "Newest", name: "Name A–Z" };
    var sortLabel = document.getElementById("sortLabel"); if (sortLabel) sortLabel.textContent = sortLabels[currentSort];
    document.querySelectorAll("#sortMenu .dd-item").forEach(function (item) {
      item.classList.toggle("selected", item.dataset.sort === currentSort);
    });
    try { syncFilterDropMenu("orientMenu", currentOrient); syncFilterDropMenu("resMenu", currentRes); } catch (e) {}
    try { updateOrientResPillLabels(); buildCategoryMenu(nav); } catch (e) {}
    if (currentPage === "downloaded" && typeof switchPage === "function") {
      switchPage(document.querySelector('.ptab[data-page="downloaded"]'), "downloaded");
    } else if (typeof reloadServerBrowse === "function") {
      reloadServerBrowse();
    }
    restoreScroll(Number(s.scrollTop || 0));
  }

  // Boot katalog refresh'i yakunlangach tiklaymiz; MutationObserver emas.
  var tries = 0;
  var poll = setInterval(function () {
    tries++;
    var ready = typeof catalogLoadState === "undefined" || catalogLoadState !== "loading";
    if (ready || tries >= 120) { clearInterval(poll); restore(); }
  }, 500);

  function touched(event) {
    if (!event || event.isTrusted !== false) userTouched = true;
    if (restored) scheduleSave();
  }
  var sc = document.querySelector(".scroll-area"); if (sc) sc.addEventListener("scroll", touched, { passive: true });
  document.addEventListener("click", function (event) { touched(event); });
  document.addEventListener("input", touched);
  document.addEventListener("change", touched);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", function () { if (document.hidden) save(); });
  setInterval(save, 5000);
})();
