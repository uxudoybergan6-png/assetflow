/*
 * node-io.js — AE kodining Node I/O yuzasi uchun UXP adapteri.
 *
 * NIMA UCHUN KERAK. `assetflow-catalog.js` dagi `downloadUrlToFile()` — pack va
 * `.mogrt` yuklab olishning YAGONA yo'li — sof Node naqshida yozilgan:
 *
 *     const lib = u.startsWith("https") ? require("https") : require("http");
 *     const ws  = fs.createWriteStream(destPath + ".part");
 *     lib.get(u, { headers }, (res) => { res.on("data", …); res.pipe(ws); });
 *     ws.on("finish", () => fs.renameSync(part, dest));
 *
 * UXP'da `http`/`https` moduli ham, `fs.createWriteStream` ham YO'Q. Ya'ni
 * Premiere panelida import umuman ishga tushmasdi. AE manbasini o'zgartirmaymiz
 * (1:1 parity shartи) — o'rniga shu modullarni `fetch` + UXP `fs` ustida
 * QAYTA YASAYMIZ. `require-shim.js` shu yerdagi fabrikalarni ishlatadi.
 *
 * SPIKE TUZOG'I (SPIKE-NATIJA §4): `fetch` reader chunk'i — **ArrayBuffer**,
 * ya'ni `.length === undefined`. AE `done += chunk.length` deb progress
 * hisoblaydi → `NaN`, `body += chunk` esa buzuq matn beradi. Shu bois har bir
 * chunk `Uint8Array` ga o'giriladi va unga utf8 beruvchi `toString()` qo'yiladi.
 *
 * REDIRECT VA `Authorization`. AE 3xx ni O'ZI kuzatadi va boshqa origin'ga
 * ketganda auth header'ini tushiradi (token leak himoyasi). `fetch` redirect'ni
 * o'zi kuzatadi, shuning uchun AE ning 3xx shoxi umuman ishlamaydi — himoya esa
 * yo'qolmaydi: Fetch spetsifikatsiyasi cross-origin redirect'da `Authorization`
 * ni O'ZI olib tashlaydi. Manifest `network.domains` allowlist'i qo'shimcha
 * to'siq bo'lib qoladi (imzolangan URL `storage.googleapis.com` ga ketadi).
 *
 * QAMROV. Bu yerda "to'liq Node" YO'Q — faqat AE kodi HAQIQATAN chaqiradigan
 * yuza. Chaqirilmagan metod qo'shilmaydi: jim `{}` qaytarish o'rniga
 * `require-shim.js` dagi halol xato afzal.
 */
(function () {
  "use strict";

  var log = window.FFLog || { warn: function () {}, error: function () {}, info: function () {} };

  var uxp = null;
  try { uxp = require("uxp"); } catch (e) { /* brauzerdagi QA harness */ }

  // ── kichik hodisa emitteri (Node `EventEmitter` ning kerakli qismi) ─────────

  function emitter(obj) {
    var map = {};
    obj = obj || {};
    obj.on = function (name, fn) {
      (map[name] || (map[name] = [])).push(fn);
      return obj;
    };
    obj.once = function (name, fn) {
      function one() { obj.off(name, one); fn.apply(null, arguments); }
      return obj.on(name, one);
    };
    obj.off = function (name, fn) {
      var l = map[name];
      if (l) map[name] = l.filter(function (f) { return f !== fn; });
      return obj;
    };
    obj.emit = function (name) {
      var l = (map[name] || []).slice();
      var args = Array.prototype.slice.call(arguments, 1);
      for (var i = 0; i < l.length; i++) {
        try { l[i].apply(null, args); } catch (e) { log.error("node-io hodisa:", name, e); }
      }
      // Node: tinglovchisiz "error" — jarayon yiqiladi. Bizda jim qolmasin.
      if (name === "error" && !l.length) log.error("node-io tinglanmagan error:", args[0]);
      return !!l.length;
    };
    obj.listenerCount = function (name) { return (map[name] || []).length; };
    return obj;
  }

  // ── bayt yordamchilari ──────────────────────────────────────────────────────

  function utf8Decode(u8) {
    if (window.FFBytes && window.FFBytes.utf8Decode) return window.FFBytes.utf8Decode(u8);
    var s = "";
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return s;
  }

  /**
   * Chunk normalizatsiyasi: ArrayBuffer → Uint8Array + utf8 `toString()`.
   * AE ikkala yuzani ham ishlatadi: `chunk.length` (progress) va `body += chunk`
   * (xato tanasini JSON.parse qilish uchun).
   */
  function toU8(chunk) {
    var u8;
    if (chunk instanceof Uint8Array) u8 = chunk;
    else if (chunk instanceof ArrayBuffer) u8 = new Uint8Array(chunk);
    else if (chunk && chunk.buffer instanceof ArrayBuffer) {
      u8 = new Uint8Array(chunk.buffer, chunk.byteOffset || 0, chunk.byteLength);
    } else if (typeof chunk === "string") {
      u8 = window.FFBytes ? window.FFBytes.utf8Encode(chunk) : new Uint8Array(0);
    } else u8 = new Uint8Array(0);
    if (!u8.__ffStr) {
      try {
        u8.toString = function () { return utf8Decode(this); };
        u8.__ffStr = true;
      } catch (e) { /* frozen — muhim emas */ }
    }
    return u8;
  }

  function concatU8(list, total) {
    var out = new Uint8Array(total), off = 0;
    for (var i = 0; i < list.length; i++) { out.set(list[i], off); off += list[i].length; }
    return out;
  }

  // ── UXP papkalari (sinxron `os.tmpdir()` uchun oldindan yechiladi) ──────────

  /*
   * `os.tmpdir()` va `os.homedir()` — SINXRON, UXP papka yo'llari esa ASINXRON
   * (`getTemporaryFolder()` → Promise). Shu bois yo'llarni panel ochilishida bir
   * marta yechib keshlaymiz; yuklab olish foydalanuvchi harakatidan keyin
   * bo'ladi, ya'ni o'shancha vaqt yetarli. Yechilmagan bo'lsa native `os` ga
   * qaytamiz — u ham bermasa bo'sh satr (chaqiruvchi `downloadDir()` bilan
   * tekshiradi).
   */
  var tmpPath = "";
  var dataPath = "";
  var pathsReady = (async function () {
    try {
      var lfs = uxp && uxp.storage && uxp.storage.localFileSystem;
      if (!lfs) return;
      if (lfs.getTemporaryFolder) {
        try { tmpPath = (await lfs.getTemporaryFolder()).nativePath || ""; } catch (e) { /* ixtiyoriy */ }
      }
      if (lfs.getDataFolder) {
        try { dataPath = (await lfs.getDataFolder()).nativePath || ""; } catch (e) { /* ixtiyoriy */ }
      }
    } catch (e) { log.warn("node-io: UXP papka yo'llari yechilmadi", e); }
  })();

  function wrapOs(nativeOs) {
    var base = nativeOs || {};
    return {
      platform: function () {
        if (base.platform) { try { return base.platform(); } catch (e) { /* pastga */ } }
        var p = String((navigator && navigator.platform) || "");
        if (/mac/i.test(p)) return "darwin";
        if (/win/i.test(p)) return "win32";
        return "linux";
      },
      // Yuklab olingan `.mogrt` shu yerga tushadi. Spike tasdiqladi:
      // `insertMogrtFromPath()` plugin-temp yo'lidan ISHLAYDI.
      tmpdir: function () {
        if (tmpPath) return tmpPath;
        if (base.tmpdir) { try { return base.tmpdir() || ""; } catch (e) { /* pastga */ } }
        return dataPath || "";
      },
      /*
       * `homedir()` — AE uni FAQAT sozlama papkasini yasash uchun ishlatadi
       * (`~/Library/Application Support/AssetFlow`). UXP sandbox'ida haqiqiy uy
       * papkasiga yozish kafolatlanmagan, shu bois plagin ma'lumot papkasini
       * beramiz: yo'l `<data>/Library/Application Support/AssetFlow` bo'ladi —
       * chiroyli emas, lekin BARQAROR va yozib bo'ladigan joy.
       */
      homedir: function () {
        if (dataPath) return dataPath;
        if (base.homedir) { try { return base.homedir() || ""; } catch (e) { /* pastga */ } }
        return tmpPath || "";
      },
      EOL: base.EOL || "\n",
      release: base.release || function () { return ""; },
      arch: base.arch || function () { return ""; },
    };
  }

  // ── path: Premiere UXP 26.2 dagi bo'sh native modulni to'ldiramiz ──────────

  /*
   * Host logi tasdiqladi: `require("path")` muvaffaqiyatli qaytadi, ammo
   * obyektning `join()` metodi yo'q. Shuning uchun `nativeModule("path") || …`
   * tekshiruvi yetarli emas. AE kodi ishlatadigan besh metodni mustaqil
   * beramiz; native metod mavjud bo'lsa uni saqlaymiz.
   */
  function wrapPath(nativePath) {
    var base = nativePath || {};

    function isWinPath(p) { return /^[A-Za-z]:[\\/]/.test(p) || /^\\\\/.test(p); }
    function sepFor(parts) {
      if (base.sep === "\\" || parts.some(function (p) { return isWinPath(String(p)); })) return "\\";
      return "/";
    }
    function parsePrefix(raw, sep) {
      var s = String(raw || "").replace(/[\\/]+/g, sep);
      if (sep === "\\") {
        if (/^\\\\/.test(s)) return { prefix: "\\\\", rest: s.replace(/^\\+/, "") };
        var drive = s.match(/^[A-Za-z]:/);
        if (drive) return { prefix: drive[0] + (s.charAt(2) === "\\" ? "\\" : ""), rest: s.slice(s.charAt(2) === "\\" ? 3 : 2) };
      }
      if (s.charAt(0) === sep) return { prefix: sep, rest: s.replace(new RegExp("^" + (sep === "\\" ? "\\\\" : "\\/") + "+"), "") };
      return { prefix: "", rest: s };
    }
    function normalizeParts(raw, sep) {
      var parsed = parsePrefix(raw, sep), out = [];
      parsed.rest.split(/[\\/]+/).forEach(function (part) {
        if (!part || part === ".") return;
        if (part === "..") {
          if (out.length && out[out.length - 1] !== "..") out.pop();
          else if (!parsed.prefix) out.push(part);
        } else out.push(part);
      });
      var body = out.join(sep);
      if (!body) return parsed.prefix || ".";
      return parsed.prefix + body;
    }
    function fallbackJoin() {
      var parts = Array.prototype.slice.call(arguments).filter(function (p) { return p !== undefined && p !== null && String(p) !== ""; });
      if (!parts.length) return ".";
      var sep = sepFor(parts);
      return normalizeParts(parts.map(String).join(sep), sep);
    }
    function fallbackDirname(p) {
      var raw = String(p || ""), sep = sepFor([raw]), n = normalizeParts(raw, sep);
      var parsed = parsePrefix(n, sep), rest = parsed.rest.replace(/[\\/]+$/, "");
      var i = rest.lastIndexOf(sep);
      if (i < 0) return parsed.prefix || ".";
      var dir = rest.slice(0, i);
      return parsed.prefix + dir || parsed.prefix || ".";
    }
    function fallbackBasename(p, suffix) {
      var raw = String(p || "").replace(/[\\/]+$/, "");
      var name = raw.slice(Math.max(raw.lastIndexOf("/"), raw.lastIndexOf("\\")) + 1);
      suffix = suffix === undefined ? "" : String(suffix);
      return suffix && name.slice(-suffix.length) === suffix ? name.slice(0, -suffix.length) : name;
    }
    function fallbackExtname(p) {
      var name = fallbackBasename(p), i = name.lastIndexOf(".");
      return i > 0 ? name.slice(i) : "";
    }
    function fallbackRelative(from, to) {
      var sep = sepFor([from, to]);
      var a = normalizeParts(from, sep), b = normalizeParts(to, sep);
      var ap = parsePrefix(a, sep), bp = parsePrefix(b, sep);
      if (ap.prefix.toLowerCase() !== bp.prefix.toLowerCase()) return b;
      var aa = ap.rest ? ap.rest.split(sep) : [], bb = bp.rest ? bp.rest.split(sep) : [], i = 0;
      while (i < aa.length && i < bb.length && (sep === "\\" ? aa[i].toLowerCase() === bb[i].toLowerCase() : aa[i] === bb[i])) i++;
      return aa.slice(i).map(function () { return ".."; }).concat(bb.slice(i)).join(sep);
    }

    return {
      join: typeof base.join === "function" ? base.join.bind(base) : fallbackJoin,
      dirname: typeof base.dirname === "function" ? base.dirname.bind(base) : fallbackDirname,
      basename: typeof base.basename === "function" ? base.basename.bind(base) : fallbackBasename,
      extname: typeof base.extname === "function" ? base.extname.bind(base) : fallbackExtname,
      relative: typeof base.relative === "function" ? base.relative.bind(base) : fallbackRelative,
      sep: base.sep || sepFor([]),
      delimiter: base.delimiter || (sepFor([]) === "\\" ? ";" : ":"),
      __ffWrapped: true,
    };
  }

  // ── fs: mavjud native yuzani polifil bilan to'ldiramiz ──────────────────────

  function wrapFs(nativeFs) {
    if (!nativeFs) return null;
    var fs = Object.create(nativeFs);   // native metodlar meros, ustiga qo'shamiz

    function statOf(p) {
      if (nativeFs.lstatSync) return nativeFs.lstatSync(p);
      if (nativeFs.statSync) return nativeFs.statSync(p);
      throw new Error("fs.lstatSync/statSync yo'q");
    }
    function isDir(st) {
      if (!st) return false;
      if (typeof st.isDirectory === "function") return st.isDirectory();
      return !!st.isDirectory;
    }

    // `existsSync` — UXP fs'da yo'q bo'lishi mumkin; stat orqali yasaymiz.
    if (!nativeFs.existsSync) {
      fs.existsSync = function (p) {
        try { statOf(p); return true; } catch (e) { return false; }
      };
    }

    // `rmSync(p, {recursive, force})` — rekursiv o'chirish (kesh tozalash,
    // `.part` qoldig'i). UXP fs faqat unlink/rmdir beradi.
    if (!nativeFs.rmSync) {
      fs.rmSync = function (p, opts) {
        opts = opts || {};
        var st;
        try { st = statOf(p); } catch (e) { if (opts.force) return; throw e; }
        if (isDir(st)) {
          if (!opts.recursive) throw new Error("fs.rmSync: papka uchun recursive:true kerak");
          var names = [];
          try { names = nativeFs.readdirSync(p) || []; } catch (e) { /* bo'sh */ }
          for (var i = 0; i < names.length; i++) {
            var child = names[i];
            // UXP `readdirSync` ba'zan Entry obyektlari beradi — nomga keltiramiz.
            var nm = typeof child === "string" ? child : (child && child.name) || "";
            if (!nm) continue;
            fs.rmSync(joinPath(p, nm), { recursive: true, force: true });
          }
          try { nativeFs.rmdirSync(p); } catch (e) { if (!opts.force) throw e; }
          return;
        }
        try { nativeFs.unlinkSync(p); } catch (e) { if (!opts.force) throw e; }
      };
    }

    if (!nativeFs.mkdtempSync) {
      fs.mkdtempSync = function (prefix) {
        var dir = String(prefix) + Math.random().toString(36).slice(2, 8);
        fs.mkdirSync(dir, { recursive: true });
        return dir;
      };
    }

    // UXP sandbox'ida POSIX huquqlari yo'q — `chmod` ma'nosiz, lekin AE uni
    // token faylini 0600 qilish uchun chaqiradi. Halol: jim o'tkazamiz
    // (fayl allaqachon plagin sandbox'ida, boshqa jarayon ko'rmaydi).
    if (!nativeFs.chmodSync) fs.chmodSync = function () {};

    if (!nativeFs.copyFileSync) {
      fs.copyFileSync = function (src, dst) { fs.writeFileSync(dst, fs.readFileSync(src)); };
    }

    // `mkdirSync(p, {recursive:true})` — UXP `mkdirSync` recursive bayrog'ini
    // qo'llab-quvvatlamasligi mumkin; ota-papkalarni o'zimiz yasaymiz.
    var nativeMkdir = nativeFs.mkdirSync;
    fs.mkdirSync = function (p, opts) {
      if (!opts || !opts.recursive) return nativeMkdir.call(nativeFs, p, opts);
      var parts = String(p).split("/");
      var cur = parts[0] === "" ? "/" : "";
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        cur = cur === "/" || cur === "" ? cur + parts[i] : cur + "/" + parts[i];
        try { nativeMkdir.call(nativeFs, cur); } catch (e) { /* mavjud — davom */ }
      }
    };

    /*
     * `createWriteStream` — yuklab olishning yozuv uchi.
     * Imkon bo'lsa DESKRIPTOR bilan bo'lak-bo'lak yozamiz (200 MB pack xotirani
     * yemasin); `openSync/writeSync` bo'lmasa chunk'larni yig'ib, `end()` da
     * bir marta yozamiz.
     */
    fs.createWriteStream = function (destPath) {
      var ws = emitter({});
      var fd = null, buf = [], total = 0, closed = false;
      try {
        if (nativeFs.openSync && nativeFs.writeSync) fd = nativeFs.openSync(destPath, "w");
      } catch (e) { fd = null; }

      ws.path = destPath;
      ws.write = function (chunk) {
        if (closed) return false;
        var u8 = toU8(chunk);
        if (fd !== null) {
          try { nativeFs.writeSync(fd, u8); } catch (e) { closed = true; safeClose(); ws.emit("error", e); return false; }
        } else { buf.push(u8); total += u8.length; }
        return true;
      };
      ws.end = function (chunk) {
        if (closed) return;
        if (chunk) ws.write(chunk);
        if (closed) return;               // write ichida xato bo'lgan bo'lsa
        closed = true;
        try {
          if (fd !== null) safeClose();
          else writeBinary(destPath, concatU8(buf, total));
          buf = null;
          ws.emit("finish");
        } catch (e) { ws.emit("error", e); }
      };
      ws.destroy = function () {
        if (closed) return;
        closed = true; buf = null; safeClose();
      };
      function safeClose() {
        if (fd === null) return;
        try { nativeFs.closeSync(fd); } catch (e) { /* muhim emas */ }
        fd = null;
      }
      return ws;
    };

    // `createReadStream` — AE'da faqat kichik fayllarda ishlatiladi; butun faylni
    // o'qib bo'laklab beramiz (UXP'da haqiqiy oqim o'quvchi yo'q).
    fs.createReadStream = function (srcPath) {
      var rs = emitter({});
      var started = false;
      rs.path = srcPath;
      rs.destroy = function () { started = true; };
      rs.pipe = function (dst) { start(dst); return dst; };
      rs.on = (function (orig) {
        return function (name, fn) {
          orig.call(rs, name, fn);
          if (name === "data") start(null);
          return rs;
        };
      })(rs.on);
      function start(dst) {
        if (started) return;
        started = true;
        setTimeout(function () {
          try {
            var all = toU8(fs.readFileSync(srcPath));
            var STEP = 1 << 20;
            for (var off = 0; off < all.length; off += STEP) {
              var part = toU8(all.subarray(off, Math.min(off + STEP, all.length)));
              rs.emit("data", part);
              if (dst) dst.write(part);
            }
            rs.emit("end");
            if (dst) dst.end();
          } catch (e) { rs.emit("error", e); }
        }, 0);
      }
      return rs;
    };

    /** Binar yozish — UXP `writeFileSync` imzosi versiyaga qarab farq qiladi. */
    function writeBinary(p, u8) {
      var tries = [
        function () { nativeFs.writeFileSync(p, u8); },
        function () { nativeFs.writeFileSync(p, u8, { encoding: "binary" }); },
        function () { nativeFs.writeFileSync(p, u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.length)); },
      ];
      var last = null;
      for (var i = 0; i < tries.length; i++) {
        try { tries[i](); return; } catch (e) { last = e; }
      }
      throw last || new Error("fs.writeFileSync: binar yozib bo'lmadi");
    }

    function joinPath(a, b) {
      return String(a).replace(/\/+$/, "") + "/" + String(b).replace(/^\/+/, "");
    }

    fs.__ffWrapped = true;
    return fs;
  }

  // ── http / https → fetch ────────────────────────────────────────────────────

  function makeHttp(scheme) {
    /**
     * `lib.get(url, [options], cb)` — Node imzosi. `cb(res)`, qaytish qiymati
     * `req` (faqat `.on("error")` va `.destroy()` ishlatiladi).
     */
    function get(url, optsOrCb, maybeCb) {
      var opts = typeof optsOrCb === "function" ? {} : (optsOrCb || {});
      var cb = typeof optsOrCb === "function" ? optsOrCb : maybeCb;
      var req = emitter({});
      var ctrl = null;
      var aborted = false;
      try { ctrl = new AbortController(); } catch (e) { ctrl = null; }

      req.destroy = function () {
        if (aborted) return;
        aborted = true;
        try { if (ctrl) ctrl.abort(); } catch (e) { /* muhim emas */ }
      };
      req.abort = req.destroy;
      req.setTimeout = function () { return req; };

      var init = { method: "GET" };
      if (opts.headers) init.headers = opts.headers;
      if (ctrl) init.signal = ctrl.signal;

      // Tinglovchilar SINXRON qo'shiladi (`req.on("error", …)` chaqiruvdan
      // KEYIN yoziladi) — shu bois javobni mikrovazifada uzatamiz.
      fetch(String(url), init).then(function (r) {
        if (aborted) return;
        if (cb) cb(makeRes(r, req));
      }).catch(function (e) {
        if (aborted) return;
        req.emit("error", e instanceof Error ? e : new Error(String(e)));
      });

      return req;
    }

    function makeRes(r, req) {
      var res = emitter({});
      var headers = {};
      try {
        r.headers.forEach(function (v, k) { headers[String(k).toLowerCase()] = v; });
      } catch (e) { /* header'siz javob — bo'sh xarita */ }

      res.statusCode = r.status;
      res.statusMessage = r.statusText || "";
      res.headers = headers;
      // `fetch` redirect'ni o'zi kuzatgani uchun AE ning 3xx shoxi yonmaydi;
      // yakuniy URL diagnostikada kerak bo'lishi mumkin.
      res.url = r.url || "";

      var dest = null, started = false, stopped = false;

      res.pipe = function (ws) { dest = ws; start(); return ws; };
      res.unpipe = function () { dest = null; };
      res.resume = function () { start(); };
      res.destroy = function () { stopped = true; if (req) req.destroy(); };
      res.setEncoding = function () {};

      // Node: "data" tinglovchisi qo'shilishi oqimni boshlaydi.
      res.on = (function (orig) {
        return function (name, fn) {
          orig.call(res, name, fn);
          if (name === "data") start();
          return res;
        };
      })(res.on);

      function start() {
        if (started) return;
        started = true;
        // `setTimeout(0)`: chaqiruvchi `res.on("data")` dan KEYIN `res.pipe(ws)`
        // qiladi — nasos boshlanguncha ikkalasi ham ro'yxatdan o'tsin.
        setTimeout(pump, 0);
      }

      async function pump() {
        try {
          var reader = r.body && r.body.getReader ? r.body.getReader() : null;
          if (!reader) {
            // Oqim yuzasi yo'q — butun tanani birdan (kichik JSON xatolar).
            var ab = await r.arrayBuffer();
            deliver(toU8(ab));
            finish();
            return;
          }
          for (;;) {
            var step = await reader.read();
            if (stopped) { try { await reader.cancel(); } catch (e) { /* muhim emas */ } return; }
            if (step.done) break;
            deliver(toU8(step.value));
          }
          finish();
        } catch (e) {
          if (stopped) return;
          res.emit("error", e instanceof Error ? e : new Error(String(e)));
          if (dest && dest.destroy) { try { dest.destroy(); } catch (e2) { /* muhim emas */ } }
        }
      }

      function deliver(u8) {
        res.emit("data", u8);
        // `unpipe()` "data" ichida chaqirilishi mumkin (hajm chegarasi) —
        // shuning uchun `dest` ni emitdan KEYIN qayta o'qiymiz.
        if (dest && !stopped) dest.write(u8);
      }
      function finish() {
        res.emit("end");
        if (dest) dest.end();
      }

      return res;
    }

    return {
      get: get,
      request: function (url, optsOrCb, maybeCb) {
        // AE faqat GET ishlatadi; boshqa metod kerak bo'lsa halol xato.
        var opts = typeof optsOrCb === "function" ? {} : (optsOrCb || {});
        var m = String(opts.method || "GET").toUpperCase();
        if (m !== "GET") {
          throw new Error("UXP `" + scheme + ".request` faqat GET: " + m + " uchun `fetch()` ishlating.");
        }
        return get(url, optsOrCb, maybeCb);
      },
      __ffScheme: scheme,
    };
  }

  window.__FFNodeIO = {
    wrapFs: wrapFs,
    wrapOs: wrapOs,
    wrapPath: wrapPath,
    makeHttp: makeHttp,
    toU8: toU8,
    ready: pathsReady,
    /**
     * Plaginning YOZILADIGAN ma'lumot papkasi (`getDataFolder`). Plagin
     * papkasining o'zi UXP'da faqat O'QISH uchun — lokal kesh/meta shu yerga
     * tushadi (`csinterface-shim.getSystemPath(EXTENSION)` shuni qaytaradi).
     */
    dataDir: function () { return dataPath; },
    tmpDir: function () { return tmpPath; },
    /** Diagnostika: bitta jonli chaqiruvda butun yuzani ko'rish uchun. */
    report: function () {
      var nfs = null;
      try { nfs = require("fs"); } catch (e) { /* yo'q */ }
      return {
        uxp: !!uxp,
        tmpdir: tmpPath,
        datadir: dataPath,
        fsNative: nfs ? Object.keys(nfs).sort() : null,
        adobeCep: typeof window.__adobe_cep__ !== "undefined",
      };
    },
  };
})();
