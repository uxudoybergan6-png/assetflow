/*
 * FrameFlow UXP dev harness — fikstura ma'lumot va stub auth.
 * FAQAT `dev/harness.html` uchun. Plagin paketiga KIRMAYDI (install/build
 * skriptlari `dev/` papkasini tashlab ketadi).
 */
(function () {
  "use strict";

  // Rejim: query-string, yoki (ba'zi preview muhitlari `?...` ni yo'qotadi)
  // `localStorage.ff_dev_harness` — masalan "mock=1&empty=1".
  var raw = location.search.replace(/^\?/, "");
  if (!raw) {
    try {
      raw = localStorage.getItem("ff_dev_harness") || "";
    } catch (e) {
      raw = "";
    }
  }
  var params = new URLSearchParams(raw);
  var mock = params.get("mock") !== "0";
  var empty = params.get("empty") === "1";
  var fail = params.get("fail") === "1";
  if (!mock) return;

  // ── Auth stub: to'g'ridan hisob ekraniga tushamiz ──────────────────────
  window.FFAuth.restore = function () {
    return Promise.resolve({ id: "u1", name: "Demo Obunachi", email: "user@assetflow.uz", plan: "free" });
  };
  window.FFAuth.heartbeat = function () {};
  window.FFAuth.logout = function () { return Promise.resolve(); };

  // ── Katalog stub ───────────────────────────────────────────────────────
  var THUMB =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">' +
        '<rect width="320" height="180" fill="#242a1e"/>' +
        '<text x="160" y="96" fill="#c8f24c" font-size="22" text-anchor="middle">FrameFlow</text></svg>'
    );

  function mk(i, tab) {
    return {
      id: "fx" + tab + i,
      name: "Fikstura " + tab + " " + i + " — uzun nom qanday kesilishini tekshirish",
      description: "Fikstura tavsifi. Bu matn detal ekranida ko'rinadi.",
      cat: "overlays",
      catLabel: "Overlays",
      orient: i % 2 ? "horizontal" : "vertical",
      res: i % 3 ? "4k" : "hd",
      tags: ["fikstura", "test", "overlay"],
      templateApp: tab === "video" ? "pr" : "ae",
      kind: tab === "video" || tab === "luts" ? "template" : "stock",
      type: tab,
      isPro: i % 3 === 0,
      hasThumb: true,
      hasPreview: false,
      hasPack: i % 4 !== 0,
      thumbUrl: THUMB,
      previewUrl: null,
      author: "Demo Muallif",
      fileName: "pack.zip",
      fileSize: 1024 * 1024 * (i + 1),
      publishedAt: "2026-07-14T20:29:11.937Z",
    };
  }

  var PAGES = {};
  window.FFCatalog.list = function (state, cursor) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        if (fail) return reject(new window.FFApi.ApiError(0, "NETWORK", "stub: tarmoq yo'q"));
        if (empty || state.q === "yoq") return resolve({ items: [], nextCursor: null });
        var page = cursor ? 2 : 1;
        PAGES[state.tab] = page;
        var items = [];
        for (var i = 0; i < 7; i++) items.push(mk((page - 1) * 7 + i + 1, state.tab));
        resolve({ items: items, nextCursor: page === 1 ? "cur2" : null });
      }, 300);
    });
  };
  window.FFCatalog.detail = function (id) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var it = mk(1, "video");
        it.id = id;
        it.metaJson = { scenes: [{ n: 1 }, { n: 2 }, { n: 3 }] };
        resolve(it);
      }, 400);
    });
  };

  window.FFLog.info("dev harness: fikstura rejimi yoqildi");
})();
