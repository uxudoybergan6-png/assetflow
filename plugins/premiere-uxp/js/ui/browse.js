/*
 * FrameFlow UXP — Browse (katalog) ko'rinishi. FAZA 2.
 *
 * DOM DOIMIY: `view()` HAR DOIM bitta va o'sha node'ni qaytaradi. Sabab —
 * router har renderda root'ni almashtiradi; agar browse har safar qaytadan
 * qurilsa qidiruv maydonidagi fokus, filtrlar, yuklangan sahifalar va scroll
 * yo'qolardi (UX qoidasi: "nav almashganda kontekst yo'qolmasin"). Shuning
 * uchun faqat KERAKLI bo'laklar (tablar, filtr paneli, natijalar) qayta
 * chiziladi — qidiruv `<input>` hech qachon almashtirilmaydi.
 *
 * Layout: flex-wrap + margin. CSS Grid va `gap` UXP'da ISHLAMAYDI (spike §3).
 */
(function () {
  "use strict";

  var el = window.FFUI.el;
  var clear = window.FFUI.clear;
  var button = window.FFUI.button;

  /** Ko'rinish holati — panel yopilib ochilmaguncha saqlanadi. */
  var state = {
    tab: "video",
    q: "",
    cat: "",
    pro: "",
    orient: "",
    qual: "",
    sort: "new",
    items: [],
    nextCursor: null,
    loading: false,
    loadingMore: false,
    error: "",
    /** Oflayn keshdan ko'rsatilyaptimi: {savedAt, stale} */
    offline: null,
    filtersOpen: false,
    loaded: false,
  };

  var node = null;
  var refs = {};
  var ctx = {};
  var searchTimer = null;
  var savedScroll = 0;
  /** Ketma-ket so'rovlar poygasi: faqat oxirgi so'rov javobi qabul qilinadi. */
  var reqId = 0;

  // ── Hover video: BUTUN panelda YAGONA instansiya ────────────────────────
  // Gotcha #7: src almashtirishda eski instansiyani pause()+src='' qilmasa
  // dekoder oqadi. Shuning uchun bitta element kartadan kartaga ko'chiriladi.
  var hoverVideo = null;
  var hoverImg = null;

  /**
   * UXP `<img>`/`<video>` ning ichki (intrinsic) o'lchamini o'lchamaydi: bir
   * o'lchov `auto` qolsa element 0 bo'ladi va hech narsa ko'rinmaydi. Shuning
   * uchun ikkala o'lchov ham element `orient` idan hisoblanadi va inline
   * beriladi. Nomalum orient = 16:9 (katalogdagi ustun nisbat).
   */
  /** Media qutilari balandligi — CSS'dagi `.ff-card-media` / `.ff-detail-media` bilan mos. */
  var CARD_MEDIA_H = 70;
  var DETAIL_MEDIA_H = 180;

  function sizeMedia(node, orient, boxH) {
    var o = String(orient || "").toLowerCase();
    var ratio = o === "vertical" ? 9 / 16 : o === "square" ? 1 : 16 / 9;
    node.style.height = boxH + "px";
    node.style.width = Math.round(boxH * ratio) + "px";
  }

  function makeVideo(cls) {
    var v = document.createElement("video");
    v.className = cls;
    v.setAttribute("muted", "");
    v.muted = true;
    v.setAttribute("loop", "");
    v.loop = true;
    v.setAttribute("playsinline", "");
    return v;
  }

  function stopHover() {
    if (!hoverVideo) return;
    try { hoverVideo.pause(); } catch (e) { /* allaqachon to'xtagan */ }
    hoverVideo.removeAttribute("src");
    if (hoverVideo.parentNode) hoverVideo.parentNode.removeChild(hoverVideo);
    hoverVideo.className = "ff-card-video ff-hidden";
    if (hoverImg) hoverImg.className = "ff-card-img";
    hoverImg = null;
  }

  function startHover(media, img, url, orient) {
    if (!url) return;
    if (hoverVideo && hoverVideo.parentNode === media) return;
    stopHover();
    if (!hoverVideo) {
      hoverVideo = makeVideo("ff-card-video");
      // Video kadr kelgunicha yashirin turadi — aks holda thumbnail o'rnida
      // bo'sh qora quti chiqadi (jonli panelda o'lchangan).
      var reveal = function () {
        hoverVideo.className = "ff-card-video";
        if (hoverImg) hoverImg.className = "ff-card-img ff-hidden";
      };
      hoverVideo.addEventListener("loadeddata", reveal);
      hoverVideo.addEventListener("playing", reveal);
    }
    hoverVideo.className = "ff-card-video ff-hidden";
    sizeMedia(hoverVideo, orient, CARD_MEDIA_H);
    hoverVideo.setAttribute("src", url);
    media.appendChild(hoverVideo);
    hoverImg = img || null;
    try {
      var p = hoverVideo.play();
      if (p && p.catch) p.catch(function () { /* autoplay rad etildi — thumb qoladi */ });
    } catch (e) { /* ixtiyoriy */ }
  }

  /** Detal ekranidagi katta preview — u ham yagona instansiya. */
  var detailVideo = null;
  function stopDetailVideo() {
    if (!detailVideo) return;
    try { detailVideo.pause(); } catch (e) { /* — */ }
    detailVideo.removeAttribute("src");
    if (detailVideo.parentNode) detailVideo.parentNode.removeChild(detailVideo);
    detailVideo = null;
  }

  function stopMedia() {
    stopHover();
    stopDetailVideo();
  }

  // ── Yordamchilar ────────────────────────────────────────────────────────

  function fmtSize(bytes) {
    var n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  function fmtTime(ms) {
    var d = new Date(ms);
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  function activeFilterCount() {
    var n = 0;
    if (state.cat) n++;
    if (state.pro) n++;
    if (state.orient) n++;
    if (state.qual) n++;
    if (state.sort && state.sort !== "new") n++;
    return n;
  }

  /** Filtr chipi — kichik, bosiladigan (div, `<button>` emas: FAZA 1 gotcha). */
  function chip(label, active, onClick, title) {
    return el("div", {
      class: "ff-chip" + (active ? " ff-chip-on" : ""),
      role: "button",
      tabindex: "0",
      title: title || label,
      "aria-pressed": active ? "true" : "false",
      text: label,
      onClick: onClick,
      onKeyDown: function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); onClick(e); }
      },
    });
  }

  function chipRow(labelText, options, current, onPick) {
    var row = el("div", { class: "ff-chips" });
    options.forEach(function (o) {
      row.appendChild(chip(o.label, String(current || "") === String(o.value), function () { onPick(o.value); }));
    });
    return el("div", { class: "ff-filter-group" }, [
      el("div", { class: "ff-label", text: labelText }),
      row,
    ]);
  }

  // ── Bo'lak renderlari ───────────────────────────────────────────────────

  function renderTabs() {
    clear(refs.tabsRow);
    window.FFCatalog.TABS.forEach(function (t) {
      refs.tabsRow.appendChild(
        chip(t.label, state.tab === t.key, function () { pickTab(t.key); }, t.label + " bo'limi")
      );
    });
  }

  function renderFilterButton() {
    clear(refs.filterBtnBox);
    var n = activeFilterCount();
    refs.filterBtnBox.appendChild(
      button("Filtr" + (n ? " (" + n + ")" : ""), {
        variant: state.filtersOpen || n ? "primary" : "",
        title: "Filtr va saralash",
        onClick: function () {
          state.filtersOpen = !state.filtersOpen;
          renderFilterButton();
          renderFilters();
        },
      })
    );
  }

  function renderFilters() {
    clear(refs.filtersBox);
    if (!state.filtersOpen) return;
    var tab = window.FFCatalog.tabByKey(state.tab);
    var cats = [{ value: "", label: "Barchasi" }].concat(
      window.FFCatalog.categoriesFor(state.tab).map(function (c) {
        return { value: c, label: window.FFCatalog.catLabel(c) };
      })
    );

    var groups = [
      chipRow("Kategoriya", cats, state.cat, function (v) { state.cat = v; refresh(); }),
      chipRow("Tarif", window.FFCatalog.TIERS, state.pro, function (v) { state.pro = v; refresh(); }),
    ];
    if (tab.visual) {
      groups.push(chipRow("Orientatsiya", window.FFCatalog.ORIENTS, state.orient, function (v) { state.orient = v; refresh(); }));
      groups.push(chipRow("Sifat", window.FFCatalog.QUALS, state.qual, function (v) { state.qual = v; refresh(); }));
    }
    groups.push(chipRow("Saralash", window.FFCatalog.SORTS, state.sort, function (v) { state.sort = v; refresh(); }));

    if (window.FFCatalog.isFiltered(state)) {
      groups.push(el("div", { style: "margin-top:8px;" }, [
        button("Filtrlarni tozalash", { onClick: clearFilters }),
      ]));
    }
    refs.filtersBox.appendChild(el("div", { class: "ff-filters" }, groups));
  }

  function renderStatus() {
    clear(refs.statusRow);
    if (state.offline) {
      refs.statusRow.appendChild(
        window.FFUI.note(
          "Oflayn: serverga ulanib bo'lmadi, oxirgi saqlangan ro'yxat ko'rsatilmoqda (" +
            fmtTime(state.offline.savedAt) + (state.offline.stale ? ", eskirgan" : "") + ").",
          "warn"
        )
      );
    }
    var left = state.loading
      ? "Yuklanmoqda…"
      : state.items.length
        ? state.items.length + " ta natija" + (state.nextCursor ? " (davomi bor)" : "")
        : "";
    refs.statusRow.appendChild(el("div", { class: "ff-row" }, [
      el("div", { class: "ff-faint ff-row-grow", text: left }),
      button("↻", {
        variant: "ghost",
        title: "Ro'yxatni yangilash",
        ariaLabel: "Ro'yxatni yangilash",
        onClick: function () { refresh(); },
      }),
    ]));
  }

  function skeletonGrid() {
    var grid = el("div", { class: "ff-grid" });
    for (var i = 0; i < 6; i++) {
      grid.appendChild(el("div", { class: "ff-card-item" }, [
        el("div", { class: "ff-card-media ff-skel" }),
        el("div", { class: "ff-skel-line" }),
        el("div", { class: "ff-skel-line ff-skel-line-sm" }),
      ]));
    }
    return grid;
  }

  function card(it) {
    var media = el("div", { class: "ff-card-media" });
    var img = null;
    if (it.hasThumb && it.thumbUrl) {
      img = el("img", { class: "ff-card-img", src: it.thumbUrl, alt: it.name || "" });
      sizeMedia(img, it.orient, CARD_MEDIA_H);
      img.addEventListener("error", function () {
        if (img.parentNode) img.parentNode.removeChild(img);
        media.appendChild(el("div", { class: "ff-card-noimg", text: "Ko'rinish yo'q" }));
      });
      media.appendChild(img);
    } else {
      media.appendChild(el("div", { class: "ff-card-noimg", text: "Ko'rinish yo'q" }));
    }

    if (it.hasPreview && it.previewUrl) {
      // UXP'da mouseenter/mouseleave bor, lekin barcha buildlarda emas — mouseover/
      // mouseout ham ulanadi (startHover idempotent, ikki marta ishga tushmaydi).
      var onIn = function () { startHover(media, img, it.previewUrl, it.orient); };
      media.addEventListener("mouseenter", onIn);
      media.addEventListener("mouseover", onIn);
      media.addEventListener("mouseleave", stopHover);
      media.addEventListener("mouseout", function (e) {
        // mouseout bola elementlar orasida ham otiladi — media ichida qolsa e'tiborsiz.
        if (e && e.relatedTarget && media.contains && media.contains(e.relatedTarget)) return;
        stopHover();
      });
    }

    var badges = el("div", { class: "ff-card-badges" });
    if (it.isPro) badges.appendChild(el("span", { class: "ff-tag ff-tag-pro", text: "PRO" }));
    if (it.res) badges.appendChild(el("span", { class: "ff-tag", text: String(it.res).toUpperCase() }));
    if (!it.hasPack) badges.appendChild(el("span", { class: "ff-tag ff-tag-warn", text: "Fayl yo'q" }));

    var open = function () { if (ctx.onOpenDetail) ctx.onOpenDetail(it); };
    return el("div", {
      class: "ff-card-item",
      role: "button",
      tabindex: "0",
      title: it.name || "",
      "aria-label": (it.name || "") + (it.isPro ? " — Pro" : ""),
      onClick: open,
      onKeyDown: function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); open(); }
      },
    }, [
      media,
      badges,
      el("div", { class: "ff-card-title", text: it.name || "Nomsiz" }),
      el("div", { class: "ff-card-sub", text: (it.catLabel || window.FFCatalog.catLabel(it.cat) || "") + (it.author ? " · " + it.author : "") }),
    ]);
  }

  function emptyState() {
    var filtered = window.FFCatalog.isFiltered(state);
    var tab = window.FFCatalog.tabByKey(state.tab);
    var kids = [
      el("div", { class: "ff-h2", text: filtered ? "Filtrga mos natija yo'q" : "Bu bo'lim hozircha bo'sh" }),
      el("div", { class: "ff-muted", style: "margin-bottom:12px;",
        text: filtered
          ? "Qidiruv yoki filtrlarni yumshating."
          : tab.app
            ? "Premiere Pro uchun tasdiqlangan shablon hali nashr qilinmagan. Boshqa bo'limlarni ko'ring yoki saytdagi katalogni oching."
            : "Bu turdagi kontent hali nashr qilinmagan." }),
    ];

    // Bosiladigan presetlar — bosilganda filtr HAQIQATAN qo'llanadi (bo'sh grid TAQIQ).
    var presets = el("div", { class: "ff-chips" });
    if (filtered) {
      presets.appendChild(chip("Filtrlarni tozalash", false, clearFilters));
    }
    window.FFCatalog.TABS.forEach(function (t) {
      if (t.key === state.tab) return;
      presets.appendChild(chip(t.label, false, function () { pickTab(t.key); }, t.label + " bo'limiga o'tish"));
    });
    kids.push(presets);

    kids.push(el("div", { style: "margin-top:12px;" }, [
      button("Saytda katalogni ochish", {
        variant: "primary",
        onClick: function () { window.FFHost.openExternal(window.FF_ENV.webBase + "/app/shablonlar"); },
      }),
    ]));
    return el("div", { class: "ff-card" }, kids);
  }

  function renderResults() {
    clear(refs.results);
    if (state.loading) {
      refs.results.appendChild(skeletonGrid());
      return;
    }
    if (state.error && !state.items.length) {
      refs.results.appendChild(
        window.FFUI.unavailable("Katalogni yuklab bo'lmadi", state.error, "Qayta urinish", function () { refresh(); })
      );
      return;
    }
    if (!state.items.length) {
      refs.results.appendChild(emptyState());
      return;
    }
    var grid = el("div", { class: "ff-grid" });
    state.items.forEach(function (it) { grid.appendChild(card(it)); });
    refs.results.appendChild(grid);
  }

  function renderMore() {
    clear(refs.moreRow);
    if (state.loading || !state.items.length) return;
    if (!state.nextCursor) {
      if (state.items.length >= window.FFCatalog.PAGE_SIZE)
        refs.moreRow.appendChild(el("div", { class: "ff-faint", style: "text-align:center;padding:8px;", text: "Ro'yxat oxiri." }));
      return;
    }
    refs.moreRow.appendChild(
      button(state.loadingMore ? "Yuklanmoqda…" : "Ko'proq yuklash", {
        disabled: state.loadingMore,
        disabledReason: "So'rov bajarilmoqda",
        onClick: function () { load({ more: true }); },
      })
    );
  }

  // ── Harakatlar ──────────────────────────────────────────────────────────

  function pickTab(key) {
    if (state.tab === key) return;
    state.tab = key;
    // Kategoriya/orient/sifat tabga xos — almashganda tozalanadi. Qidiruv va
    // saralash saqlanadi (foydalanuvchi niyati o'zgarmagan).
    state.cat = "";
    state.orient = "";
    state.qual = "";
    window.FFStore.setPref("catalog.tab", key);
    renderTabs();
    renderFilterButton();
    renderFilters();
    refresh();
  }

  function clearFilters() {
    state.cat = "";
    state.pro = "";
    state.orient = "";
    state.qual = "";
    state.sort = "new";
    state.q = "";
    if (refs.searchInput) refs.searchInput.value = "";
    renderFilterButton();
    renderFilters();
    refresh();
  }

  function applySearch() {
    var v = refs.searchInput ? String(refs.searchInput.value || "").trim() : "";
    if (v === state.q) return;
    state.q = v;
    refresh();
  }

  function onSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(applySearch, 400);
  }

  function refresh() {
    load({});
  }

  async function load(opts) {
    var more = !!(opts && opts.more);
    if (more && (!state.nextCursor || state.loadingMore)) return;
    var my = ++reqId;

    if (more) {
      state.loadingMore = true;
      renderMore();
    } else {
      stopHover();
      state.loading = true;
      state.error = "";
      state.offline = null;
      renderStatus();
      renderResults();
      renderMore();
    }

    var result = null;
    var failure = "";
    try {
      result = await window.FFCatalog.list(state, more ? state.nextCursor : null);
    } catch (e) {
      failure = window.FFApi.humanize(e);
      window.FFLog.warn("katalog so'rovi:", failure);
    }
    if (my !== reqId) return; // eskirgan javob — e'tiborsiz

    if (result) {
      state.items = more ? state.items.concat(result.items) : result.items;
      state.nextCursor = result.nextCursor;
      state.error = "";
      if (!more) window.FFCatalog.writeCache(state, result.items);
    } else if (more) {
      state.error = "";
      window.FFUI.toast(failure, "error");
    } else {
      var cached = window.FFCatalog.readCache(state);
      if (cached) {
        state.items = cached.items;
        state.nextCursor = null;
        state.offline = { savedAt: cached.savedAt, stale: cached.stale };
        state.error = "";
      } else {
        state.items = [];
        state.nextCursor = null;
        state.error = failure;
      }
    }

    state.loading = false;
    state.loadingMore = false;
    state.loaded = true;
    renderStatus();
    renderResults();
    renderMore();
  }

  // ── Qurish / ko'rsatish ─────────────────────────────────────────────────

  function build() {
    refs.tabsRow = el("div", { class: "ff-tabs" });
    refs.filterBtnBox = el("div", { class: "ff-search-btn" });
    refs.searchInput = el("input", {
      class: "ff-input ff-search-input",
      type: "text",
      placeholder: "Nom, kategoriya yoki teg bo'yicha qidirish…",
      "aria-label": "Katalogda qidirish",
    });
    refs.searchInput.addEventListener("input", onSearchInput);
    refs.searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        if (searchTimer) clearTimeout(searchTimer);
        applySearch();
      }
    });

    refs.filtersBox = el("div", {});
    refs.statusRow = el("div", {});
    refs.results = el("div", {});
    refs.moreRow = el("div", { style: "margin-top:8px;" });

    var inner = el("div", {}, [
      refs.tabsRow,
      el("div", { class: "ff-search-row" }, [refs.searchInput, refs.filterBtnBox]),
      refs.filtersBox,
      refs.statusRow,
      refs.results,
      refs.moreRow,
    ]);

    node = window.FFViews.shell({
      body: inner,
      headerRight: button("Hisob", {
        variant: "ghost",
        title: "Hisob va sozlamalar",
        onClick: function () { if (ctx.onHome) ctx.onHome(); },
      }),
      footerRight: window.FF_ENV.appLabel,
    });
    var bodies = node.getElementsByClassName("ff-body");
    refs.bodyEl = bodies && bodies.length ? bodies[0] : null;

    state.tab = window.FFStore.getPref("catalog.tab", "video");
    renderTabs();
    renderFilterButton();
    renderFilters();
    renderStatus();
    renderResults();
  }

  /** Router chaqiradi. Node DOIMIY — holat va fokus saqlanadi. */
  function view(c) {
    if (c) ctx = c;
    if (!node) build();
    if (!state.loaded && !state.loading) load({});
    // Scroll qayta biriktirilganda nolga tushadi — layout tayyor bo'lgach tiklaymiz.
    if (savedScroll && refs.bodyEl) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (refs.bodyEl) refs.bodyEl.scrollTop = savedScroll;
        });
      });
    }
    return node;
  }

  function saveScroll() {
    if (refs.bodyEl) savedScroll = refs.bodyEl.scrollTop || 0;
  }

  /** Chiqishda: holat butunlay tozalanadi (boshqa hisob boshqa katalog ko'radi). */
  function reset() {
    stopMedia();
    node = null;
    refs = {};
    savedScroll = 0;
    reqId++;
    state.items = [];
    state.nextCursor = null;
    state.loaded = false;
    state.loading = false;
    state.loadingMore = false;
    state.error = "";
    state.offline = null;
    state.q = "";
    state.cat = "";
    state.pro = "";
    state.orient = "";
    state.qual = "";
    state.sort = "new";
    state.filtersOpen = false;
  }

  // ── Detal ekrani ────────────────────────────────────────────────────────

  function metaRow(label, value) {
    if (!value) return null;
    return el("div", { class: "ff-meta-row" }, [
      el("div", { class: "ff-meta-key", text: label }),
      el("div", { class: "ff-meta-val", text: String(value) }),
    ]);
  }

  function renderDetail(box, it, full, status) {
    stopDetailVideo();
    clear(box);
    var d = full || it;

    var media = el("div", { class: "ff-detail-media" });
    if (d.hasPreview && d.previewUrl) {
      detailVideo = makeVideo("ff-detail-video");
      detailVideo.setAttribute("controls", "");
      detailVideo.controls = true;
      if (d.thumbUrl) detailVideo.setAttribute("poster", d.thumbUrl);
      sizeMedia(detailVideo, d.orient, DETAIL_MEDIA_H);
      detailVideo.setAttribute("src", d.previewUrl);
      media.appendChild(detailVideo);
    } else if (d.hasThumb && d.thumbUrl) {
      var dimg = el("img", { class: "ff-detail-img", src: d.thumbUrl, alt: d.name || "" });
      sizeMedia(dimg, d.orient, DETAIL_MEDIA_H);
      media.appendChild(dimg);
    } else {
      media.appendChild(el("div", { class: "ff-card-noimg", text: "Ko'rinish yo'q" }));
    }
    box.appendChild(media);

    var badges = el("div", { class: "ff-card-badges" });
    if (d.isPro) badges.appendChild(el("span", { class: "ff-tag ff-tag-pro", text: "PRO" }));
    if (d.res) badges.appendChild(el("span", { class: "ff-tag", text: String(d.res).toUpperCase() }));
    if (d.orient) badges.appendChild(el("span", { class: "ff-tag", text: window.FFCatalog.orientLabel(d.orient) }));

    box.appendChild(el("div", { class: "ff-h1", style: "margin-top:12px;", text: d.name || "Nomsiz" }));
    box.appendChild(badges);
    if (d.description) box.appendChild(el("div", { class: "ff-muted", style: "margin-top:8px;", text: d.description }));

    var scenes = full && full.metaJson && Array.isArray(full.metaJson.scenes) ? full.metaJson.scenes.length : 0;
    var metaKids = [
      metaRow("Kategoriya", d.catLabel || window.FFCatalog.catLabel(d.cat)),
      metaRow("Muallif", d.author),
      metaRow("Fayl", d.fileName),
      metaRow("Hajm", fmtSize(d.fileSize)),
      metaRow("Sahnalar", scenes ? String(scenes) : ""),
      metaRow("Nashr", fmtDate(d.publishedAt || d.createdAt)),
      metaRow("Dastur", window.FFCatalog.appLabel(d.templateApp)),
    ].filter(Boolean);
    box.appendChild(el("div", { class: "ff-card", style: "margin-top:12px;" }, metaKids));

    if (status === "loading") {
      box.appendChild(window.FFUI.spinnerText("To'liq ma'lumot yuklanmoqda…"));
    } else if (status && status !== "ok") {
      box.appendChild(window.FFUI.note("To'liq ma'lumotni yuklab bo'lmadi: " + status, "warn"));
    }

    if (d.tags && d.tags.length) {
      var tags = el("div", { class: "ff-chips" });
      d.tags.slice(0, 12).forEach(function (t) { tags.appendChild(el("span", { class: "ff-tag", text: t })); });
      box.appendChild(el("div", { style: "margin-top:8px;" }, [tags]));
    }

    // Import amallari FAZA 3 da ulanadi — ishlamaydigan narsa FAOL tugma bo'lmaydi.
    box.appendChild(el("div", { class: "ff-card", style: "margin-top:12px;" }, [
      el("div", { class: "ff-h2", text: "Amallar" }),
      button("Timeline'ga qo'shish", {
        disabled: true,
        disabledReason: d.hasPack ? "Import FAZA 3 da ulanadi" : "Pack fayli yuklanmagan",
      }),
      el("div", { style: "height:8px;" }),
      button("Packni yuklab olish", {
        disabled: true,
        disabledReason: d.hasPack ? "Yuklab olish FAZA 3 da ulanadi" : "Pack fayli yuklanmagan",
      }),
      el("div", { class: "ff-faint", style: "margin-top:8px;",
        text: d.hasPack ? "Import quvuri keyingi fazada ulanadi." : "Bu shablonga pack fayli biriktirilmagan." }),
    ]));
  }

  function detailView(it, onBack) {
    var box = el("div", {});
    var root = window.FFViews.shell({
      body: box,
      headerRight: button("Orqaga", { variant: "ghost", title: "Katalogga qaytish", onClick: onBack }),
      footerRight: window.FF_ENV.appLabel,
    });
    renderDetail(box, it, null, "loading");
    window.FFCatalog.detail(it.id).then(
      function (full) { renderDetail(box, it, full, "ok"); },
      function (e) { renderDetail(box, it, null, window.FFApi.humanize(e)); }
    );
    return root;
  }

  window.FFBrowse = {
    view: view,
    detailView: detailView,
    saveScroll: saveScroll,
    stopMedia: stopMedia,
    reset: reset,
  };
})();
