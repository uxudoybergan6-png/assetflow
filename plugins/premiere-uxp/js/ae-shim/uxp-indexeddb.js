/*
 * `indexedDB` minimal shim'i — UXP'da bu API umuman YO'Q.
 *
 * SABAB: `assetflow-local-store.js:75` disk backend'i ishga tushmasa
 * `indexedDB.open(...)` ga tushadi. UXP'da `indexedDB` e'lon qilinmagan →
 * `ReferenceError` va har boot'da xato-log; lokal kesh esa umuman o'chiq
 * qolardi. (Asosiy davo — `csinterface-shim.getSystemPath(EXTENSION)` endi
 * YOZILADIGAN papka qaytaradi, ya'ni disk backend haqiqatan ishlaydi; bu shim
 * shu yo'l yiqilganda ham panel xatosiz qolishi uchun.)
 *
 * QAMROV — AE kodi HAQIQATAN chaqiradigan yuza, ortiqchasi emas:
 *   open(name, ver) → { onupgradeneeded, onsuccess, onerror, result }
 *   db.objectStoreNames.contains(n) · db.createObjectStore(n, {keyPath})
 *   db.transaction(n, mode) → { objectStore(n), oncomplete, onerror }
 *   store.put(v[, key]) · get(key) · delete(key) · clear()
 *
 * SAQLASH: JSON'ga aylanadigan qiymatlar `localStorage` ga yoziladi va panel
 * qayta ochilganda tiklanadi. `Blob`/`File` esa FAQAT xotirada qoladi —
 * panel yopilishi bilan yo'qoladi. Bu ataylab: baytlarni base64 qilib
 * `localStorage` ga tiqish 200 MB pack'da panelni o'ldiradi, disk backend esa
 * aynan shu ish uchun bor. Yo'qolish jim emas — `FFLog.warn` bilan aytiladi.
 *
 * FAQAT UXP: brauzerdagi 1:1 QA etaloni haqiqiy IndexedDB bilan qoladi.
 */
(function () {
  "use strict";

  try { if (!require("uxp")) return; } catch (e) { return; }   // brauzer QA — tegmaymiz
  if (typeof window.indexedDB !== "undefined" && window.indexedDB) return;

  var log = window.FFLog || { warn: function () {}, info: function () {} };
  var LS_PREFIX = "__ff_idb__";
  var DBS = {};            // name → { stores: {store: {key→value}}, keyPaths: {} }

  function lsKey(dbName, store) { return LS_PREFIX + dbName + "/" + store; }

  function loadStore(dbName, store) {
    try {
      var raw = localStorage.getItem(lsKey(dbName, store));
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveStore(dbName, store, map) {
    // Faqat serializatsiya qilinadigan yozuvlar. Blob bo'lgani jimgina
    // tushib qolmasin — bir marta ogohlantiramiz.
    var out = {}, dropped = 0;
    for (var k in map) {
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      try {
        JSON.stringify(map[k]);
        out[k] = map[k];
      } catch (e) { dropped++; }
    }
    if (dropped) log.warn("indexedDB shim: " + dropped + " ta yozuv (Blob) diskka saqlanmadi — panel yopilganda yo'qoladi");
    try { localStorage.setItem(lsKey(dbName, store), JSON.stringify(out)); } catch (e) { /* kvota */ }
  }

  /** Node-uslub callback'lar keyingi tick'da chaqiriladi (haqiqiy IDB ham async). */
  function later(fn) { setTimeout(fn, 0); }

  function makeRequest() {
    return { onsuccess: null, onerror: null, result: undefined, error: null };
  }
  function fire(req, result) {
    req.result = result;
    later(function () { if (typeof req.onsuccess === "function") req.onsuccess({ target: req }); });
  }

  function makeStore(db, name) {
    var map = db.__stores[name];
    var keyPath = db.__keyPaths[name] || null;

    function keyOf(value, explicit) {
      if (explicit !== undefined && explicit !== null) return String(explicit);
      if (keyPath && value && typeof value === "object") return String(value[keyPath]);
      throw new Error("indexedDB shim: kalit yo'q (keyPath=" + keyPath + ")");
    }

    return {
      put: function (value, key) {
        var req = makeRequest();
        var k = keyOf(value, key);
        map[k] = value;
        db.__dirty[name] = 1;
        fire(req, k);
        return req;
      },
      add: function (value, key) { return this.put(value, key); },
      get: function (key) {
        var req = makeRequest();
        fire(req, map[String(key)]);
        return req;
      },
      delete: function (key) {
        var req = makeRequest();
        delete map[String(key)];
        db.__dirty[name] = 1;
        fire(req, undefined);
        return req;
      },
      clear: function () {
        var req = makeRequest();
        for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) delete map[k];
        db.__dirty[name] = 1;
        fire(req, undefined);
        return req;
      },
      getAll: function () {
        var req = makeRequest(), out = [];
        for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) out.push(map[k]);
        fire(req, out);
        return req;
      },
    };
  }

  function makeDb(name) {
    var db = {
      name: name,
      __stores: {},
      __keyPaths: {},
      __dirty: {},
      objectStoreNames: {
        contains: function (n) { return Object.prototype.hasOwnProperty.call(db.__stores, n); },
      },
      createObjectStore: function (n, opts) {
        db.__stores[n] = loadStore(name, n);
        db.__keyPaths[n] = (opts && opts.keyPath) || null;
        return makeStore(db, n);
      },
      transaction: function (n) {
        var storeName = Array.isArray(n) ? n[0] : n;
        if (!db.__stores[storeName]) {
          db.__stores[storeName] = loadStore(name, storeName);
        }
        var tx = { oncomplete: null, onerror: null, error: null, abort: function () {} };
        tx.objectStore = function () { return makeStore(db, storeName); };
        // Tranzaksiya "yakunlanishi" — shu tick oxirida: `put`/`delete` ham
        // `later()` bilan ishlaydi, ya'ni ular allaqachon bajarilgan bo'ladi.
        later(function () {
          later(function () {
            if (db.__dirty[storeName]) {
              db.__dirty[storeName] = 0;
              saveStore(name, storeName, db.__stores[storeName]);
            }
            if (typeof tx.oncomplete === "function") tx.oncomplete({ target: tx });
          });
        });
        return tx;
      },
      close: function () {},
    };
    return db;
  }

  window.indexedDB = {
    open: function (name) {
      var req = makeRequest();
      var fresh = !DBS[name];
      var db = DBS[name] || (DBS[name] = makeDb(name));
      req.onupgradeneeded = null;
      later(function () {
        req.result = db;
        // Birinchi ochilishda `onupgradeneeded` — chaqiruvchi shu yerda
        // `createObjectStore` qiladi (haqiqiy IDB bilan bir xil tartib).
        if (fresh && typeof req.onupgradeneeded === "function") {
          try { req.onupgradeneeded({ target: req }); } catch (e) { log.warn("indexedDB shim: onupgradeneeded", e); }
        }
        if (typeof req.onsuccess === "function") req.onsuccess({ target: req });
      });
      return req;
    },
    deleteDatabase: function (name) {
      var req = makeRequest();
      delete DBS[name];
      later(function () { if (typeof req.onsuccess === "function") req.onsuccess({ target: req }); });
      return req;
    },
  };

  log.info("indexedDB shim faol (localStorage ustida; Blob faqat xotirada)");
})();
