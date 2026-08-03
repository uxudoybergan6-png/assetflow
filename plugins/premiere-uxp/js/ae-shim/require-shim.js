/*
 * `__ffRequire` — AE kodidagi har bir `require(…)` shu yerga keladi
 * (almashtirishni `scripts/ae-port.mjs` bajaradi).
 *
 * UXP Node yuzasi CEP'nikidan tor: `fs`, `os`, `path` bor; `child_process`,
 * `http`, `https`, `zlib`, `buffer`, `crypto` YO'Q (SPIKE-NATIJA §1.6).
 *
 * Qoida: mavjud modul → o'zi; mavjud bo'lmagani → **UXP muqobili yoki halol
 * xato**. Jim `{}` qaytarish TAQIQ — chaqiruvchi "ishladi" deb o'ylab, xato
 * keyinroq tushunarsiz joyda chiqadi.
 */
(function () {
  "use strict";

  var native = typeof require === "function" ? require : null;
  var cache = {};

  function nativeModule(name) {
    if (!native) return null;
    try { return native(name); } catch (e) { return null; }
  }

  /** Modul mavjud emas — chaqirilganda tushunarli xato beradi. */
  function absent(mod, hint) {
    return new Proxy({}, {
      get: function (_t, prop) {
        if (prop === "__ffAbsent") return mod;
        if (prop === "then") return undefined;          // await qilib qo'ymasin
        return function () {
          throw new Error("UXP'da `" + mod + "." + String(prop) + "` yo'q. " + hint);
        };
      },
    });
  }

  /**
   * `Buffer` o'rnini bosuvchi minimal yuza. AE kodi uni faqat
   * `Buffer.from(x)` / `.length` / `.toString('base64'|'utf8')` uchun
   * ishlatadi (assetflow-catalog.js: 3 joy).
   */
  var BufferShim = {
    from: function (input, enc) {
      var u8;
      if (input instanceof Uint8Array) u8 = input;
      else if (input instanceof ArrayBuffer) u8 = new Uint8Array(input);
      else if (typeof input === "string") {
        if (enc === "base64") {
          var bin = atob(input);
          u8 = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        } else {
          u8 = window.FFBytes ? window.FFBytes.utf8Encode(input) : utf8(input);
        }
      } else if (Array.isArray(input)) u8 = new Uint8Array(input);
      else throw new Error("Buffer.from: qo'llab-quvvatlanmaydigan kirish");
      u8.toString = function (e) {
        if (e === "base64") {
          var s = "";
          for (var i = 0; i < this.length; i++) s += String.fromCharCode(this[i]);
          return btoa(s);
        }
        return window.FFBytes ? window.FFBytes.utf8Decode(this) : String.fromCharCode.apply(null, this);
      };
      return u8;
    },
    concat: function (list) {
      var total = 0, i;
      for (i = 0; i < list.length; i++) total += list[i].length;
      var out = new Uint8Array(total), off = 0;
      for (i = 0; i < list.length; i++) { out.set(list[i], off); off += list[i].length; }
      return BufferShim.from(out);
    },
    isBuffer: function (x) { return x instanceof Uint8Array; },
    alloc: function (n) { return BufferShim.from(new Uint8Array(n)); },
  };

  // UXP'da `TextEncoder` yo'q (SPIKE-NATIJA §2) — qo'lda.
  function utf8(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(++i);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  // `js/ae-shim/node-io.js` — `fetch`/UXP `fs` ustidagi Node adapteri (shu
  // fayldan OLDIN yuklanadi). Bo'lmasa native modul o'zi qaytariladi.
  var IO = window.__FFNodeIO || null;

  var MAP = {
    // Native UXP `fs` da AE kutadigan bir nechta sync metod yo'q
    // (`existsSync`, `rmSync`, `createWriteStream` …) — adapter to'ldiradi.
    fs: function () {
      var n = nativeModule("fs");
      if (!n) return absent("fs", "UXP `fs` moduli mavjud emas.");
      return (IO && IO.wrapFs(n)) || n;
    },
    "fs/promises": function () { var m = nativeModule("fs"); return (m && m.promises) || m; },
    // `tmpdir()`/`homedir()` → UXP plugin-temp / plugin-data nativePath.
    // Spike: `insertMogrtFromPath()` plugin-temp yo'lidan ishlaydi.
    os: function () {
      var n = nativeModule("os");
      if (!n && !IO) return absent("os", "UXP `os` moduli mavjud emas.");
      return IO ? IO.wrapOs(n) : n;
    },
    path: function () { return nativeModule("path") || absent("path", "UXP `path` moduli mavjud emas."); },
    buffer: function () { return { Buffer: BufferShim }; },
    child_process: function () {
      return absent("child_process",
        "Premiere UXP jarayon ishga tushira olmaydi. Kalit saqlash → `uxp.storage.secureStorage`, " +
        "brauzer ochish → `uxp.shell.openExternal`.");
    },
    // `downloadUrlToFile()` (pack/.mogrt yuklab olish) sof Node naqshida —
    // `lib.get(u, {headers}, res => res.pipe(ws))`. Adapter uni `fetch` ustida
    // qayta yasaydi; usiz Premiere'da import umuman ishga tushmasdi.
    http: function () {
      return IO ? IO.makeHttp("http") : absent("http", "Tarmoq uchun `fetch()` ishlating.");
    },
    https: function () {
      return IO ? IO.makeHttp("https") : absent("https", "Tarmoq uchun `fetch()` ishlating.");
    },
    zlib: function () {
      return absent("zlib", "UXP'da siqish yo'q. `.zip`/`.mogrt` ochish SERVERDA bajariladi.");
    },
    crypto: function () {
      var wc = (typeof crypto !== "undefined" && crypto) || null;
      return {
        webcrypto: wc,
        randomUUID: function () {
          if (wc && wc.randomUUID) return wc.randomUUID();
          var b = new Uint8Array(16);
          if (wc && wc.getRandomValues) wc.getRandomValues(b);
          b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
          var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
          return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
        },
        createHash: function () {
          throw new Error("UXP'da `crypto.createHash` yo'q — `crypto.subtle.digest()` ishlating.");
        },
      };
    },
    uxp: function () { return nativeModule("uxp"); },
    premierepro: function () { return nativeModule("premierepro"); },
  };

  window.__ffRequire = function (name) {
    var key = String(name);
    if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
    var make = MAP[key];
    var mod = make ? make() : (nativeModule(key) || absent(key, "Modul UXP'da mavjud emas."));
    cache[key] = mod;
    return mod;
  };

  window.__ffRequire.Buffer = BufferShim;
  if (typeof window.Buffer === "undefined") window.Buffer = BufferShim;
})();
