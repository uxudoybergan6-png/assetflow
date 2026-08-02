/*
 * FrameFlow UXP — katalog ma'lumot qatlami (FAZA 2).
 *
 * Qoidalar:
 *  - Filtr/qidiruv/saralash/sahifalash SERVER tomonda (`GET /api/plugin/catalog`
 *    P1 #15 param'lari). Klientda butun katalogni yuklab olib filtrlash TAQIQ.
 *  - `app=pr` FAQAT bitta joyda qo'shiladi (system prompt §10 gotcha #9) — shu
 *    fayldagi `buildQuery`. Server javobi ustidan yana `templateApp==='pr'`
 *    zaxira filtri o'tkaziladi (gotcha #1: `templateApp` default `"ae"`).
 *  - Stock/LUT app-neutral (.mp4/.wav/.cube har NLE'da ishlaydi) → ular uchun
 *    `app` param YUBORILMAYDI. Shuning uchun backend o'zgarishi shart emas.
 *  - Oflayn kesh: FAQAT filtrsiz birinchi sahifa (tab bo'yicha). Kesh ko'rsatilsa
 *    UI halol banner chiqaradi — jim eski ma'lumot ko'rsatilmaydi.
 */
(function () {
  "use strict";

  /** Bitta sahifa hajmi. Panel tor (320px) — 24 karta scroll uchun yetarli. */
  var PAGE_SIZE = 24;
  var CACHE_PREFIX = "catalog.cache.";
  /** Keshni eskirgan deb belgilash chegarasi (imzolangan URL TTL 24 soat). */
  var CACHE_STALE_MS = 12 * 3600 * 1000;

  /**
   * Panel tablari — `lib/taxonomy.ts` (server yagona manba) ning klient nusxasi.
   * `app:true` — faqat Premiere shablonlari (templateApp=pr).
   * `visual:false` — orient/sifat filtri ma'nosiz (audio).
   */
  var TABS = [
    { key: "video", label: "Shablonlar", catKey: "video-templates", templateType: "video-templates", app: true, visual: true },
    { key: "luts", label: "LUT", catKey: "luts", templateType: "luts", app: false, visual: false },
    { key: "graphics", label: "Grafika", catKey: "graphics", kind: "stock", stockType: "graphics", app: false, visual: true },
    { key: "motion", label: "Motion", catKey: "motion-graphics", kind: "stock", stockType: "motion-graphics", app: false, visual: true },
    { key: "music", label: "Musiqa", catKey: "music", kind: "stock", stockType: "music", app: false, visual: false },
    { key: "sfx", label: "SFX", catKey: "sfx", kind: "stock", stockType: "sfx", app: false, visual: false },
  ];

  /** Kategoriya ro'yxatlari — `CATEGORIES_BY_TYPE` (taxonomy.ts) nusxasi. */
  var CATS = {
    "video-templates": ["titles", "lower-thirds", "transitions", "intros", "logo-reveal", "openers",
      "slideshows", "backgrounds", "overlays", "infographics", "social-media", "logos", "mockups"],
    luts: ["cinematic", "vintage", "film-emulation", "black-white", "warm", "cool", "teal-orange",
      "moody", "vibrant", "natural"],
    graphics: ["backgrounds", "textures", "patterns", "icons", "illustrations", "mockups",
      "abstract", "gradients", "shapes", "social-media"],
    "motion-graphics": ["backgrounds", "overlays", "transitions", "elements", "light-leaks",
      "particles", "abstract", "loops", "social-media"],
    music: ["cinematic", "corporate", "ambient", "electronic", "hip-hop", "rock", "pop", "folk",
      "jazz", "classical"],
    sfx: ["whoosh", "impact", "ui", "ambience", "foley", "transitions", "glitch", "nature",
      "mechanical", "voice"],
  };

  var SORTS = [
    { value: "new", label: "Yangi" },
    { value: "az", label: "A→Z" },
    { value: "za", label: "Z→A" },
  ];
  var ORIENTS = [
    { value: "", label: "Barchasi" },
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
    { value: "1:1", label: "1:1" },
  ];
  var QUALS = [
    { value: "", label: "Barchasi" },
    { value: "hd", label: "HD" },
    { value: "4k", label: "4K+" },
  ];
  var TIERS = [
    { value: "", label: "Barchasi" },
    { value: "0", label: "Free" },
    { value: "1", label: "Pro" },
  ];

  function tabByKey(key) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].key === key) return TABS[i];
    return TABS[0];
  }

  /** Kategoriya slug → ko'rsatiladigan yorliq ("lower-thirds" → "Lower Thirds"). */
  function catLabel(slug) {
    return String(slug || "")
      .split("-")
      .map(function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; })
      .join(" ");
  }

  function categoriesFor(tabKey) {
    return CATS[tabByKey(tabKey).catKey] || [];
  }

  /** DB enum ('horizontal') → foydalanuvchi ko'radigan nisbat ('16:9'). */
  var ORIENT_LABELS = { horizontal: "16:9", vertical: "9:16", square: "1:1" };
  function orientLabel(v) {
    var s = String(v || "").toLowerCase();
    return ORIENT_LABELS[s] || (s ? s : "");
  }

  /** Dastur kodi → to'liq nom (apps/api/src/lib/apps.ts bilan bir xil ro'yxat). */
  var APP_LABELS = { ae: "After Effects", pr: "Premiere Pro", motion: "Apple Motion", resolve: "DaVinci Resolve" };
  function appLabel(code) {
    var s = String(code || "").toLowerCase();
    return APP_LABELS[s] || (s ? s.toUpperCase() : "");
  }

  /** Filtr/qidiruv qo'llanganmi (kesh yozish va "tozalash" tugmasi shunga bog'liq). */
  function isFiltered(state) {
    return !!(state.q || state.cat || state.pro || state.orient || state.qual) ||
      (state.sort && state.sort !== "new");
  }

  /** Yagona query quruvchi — `app=pr` FAQAT shu yerda qo'shiladi. */
  function buildQuery(state, cursor) {
    var tab = tabByKey(state.tab);
    var q = { take: PAGE_SIZE, sort: state.sort || "new" };
    if (cursor) q.cursor = cursor;
    if (tab.app) q.app = window.FF_ENV.app;
    if (tab.templateType) q.templateType = tab.templateType;
    if (tab.kind) q.kind = tab.kind;
    if (tab.stockType) q.stockType = tab.stockType;
    if (state.cat) q.cat = state.cat;
    if (state.pro) q.pro = state.pro;
    if (state.q) q.q = state.q;
    if (tab.visual) {
      if (state.orient) q.orient = state.orient;
      if (state.qual) q.res = state.qual;
    }
    return q;
  }

  /** Bir sahifa. Xato yuqoriga uzatiladi (UI oflayn keshga o'tishi uchun). */
  async function list(state, cursor) {
    var res = await window.FFApi.get("/api/plugin/catalog", {
      auth: false,
      query: buildQuery(state, cursor),
    });
    var items = (res && res.items) || [];
    var tab = tabByKey(state.tab);
    if (tab.app) {
      items = items.filter(function (it) {
        return String(it.templateApp || "") === window.FF_ENV.app;
      });
    }
    return { items: items, nextCursor: (res && res.nextCursor) || null };
  }

  /** Detal (metaJson + sahnalar) — ro'yxat kartasi buni bermaydi (P1 #16). */
  function detail(id) {
    return window.FFApi.get("/api/plugin/catalog/" + encodeURIComponent(id), { auth: false });
  }

  // ── Oflayn kesh ────────────────────────────────────────────────────────
  // Faqat filtrsiz birinchi sahifa. Katta maydonlar (description/tags) tashlanadi:
  // localStorage kvotasi kichik va kartada ular ko'rsatilmaydi.
  var CACHE_FIELDS = ["id", "name", "cat", "catLabel", "orient", "res", "type", "kind",
    "templateApp", "isPro", "hasThumb", "hasPreview", "hasPack", "thumbUrl", "previewUrl",
    "author", "authorInitials", "fileSize", "fileName"];

  function slimForCache(items) {
    return items.map(function (it) {
      var o = {};
      CACHE_FIELDS.forEach(function (k) { if (it[k] !== undefined) o[k] = it[k]; });
      return o;
    });
  }

  function writeCache(state, items) {
    if (isFiltered(state)) return;
    try {
      window.FFStore.setPref(CACHE_PREFIX + state.tab, {
        savedAt: Date.now(),
        items: slimForCache(items.slice(0, PAGE_SIZE)),
      });
    } catch (e) { /* kvota — kesh ixtiyoriy */ }
  }

  function readCache(state) {
    if (isFiltered(state)) return null;
    var c = window.FFStore.getPref(CACHE_PREFIX + state.tab, null);
    if (!c || !c.items || !c.items.length) return null;
    return { items: c.items, savedAt: c.savedAt || 0, stale: Date.now() - (c.savedAt || 0) > CACHE_STALE_MS };
  }

  window.FFCatalog = {
    PAGE_SIZE: PAGE_SIZE,
    TABS: TABS,
    SORTS: SORTS,
    ORIENTS: ORIENTS,
    QUALS: QUALS,
    TIERS: TIERS,
    tabByKey: tabByKey,
    categoriesFor: categoriesFor,
    catLabel: catLabel,
    orientLabel: orientLabel,
    appLabel: appLabel,
    isFiltered: isFiltered,
    buildQuery: buildQuery,
    list: list,
    detail: detail,
    writeCache: writeCache,
    readCache: readCache,
  };
})();
