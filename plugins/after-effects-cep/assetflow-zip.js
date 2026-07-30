/**
 * assetflow-zip.js — SOF NODE ZIP o'quvchi (CEP paneli uchun).
 *
 * Audit #2 (P0): ilgari pack/mogrt ochish `unzip` CLI'siga tayanardi —
 * Windows'da bunday buyruq YO'Q (har zip importi sinardi), qolaversa
 * fayl nomi orqali shell'ga argument uzatish xavfi bor edi. Bu modul
 * SHELL'siz ishlaydi: markaziy katalogni o'zi o'qiydi va `zlib` bilan
 * ochadi → macOS + Windows'da bir xil xatti-harakat.
 *
 * Eksport (window.AFZip):
 *   listEntries(zipPath)                       → [{ name, size, isDir }]  (sync, arzon)
 *   extractAll(zipPath, destDir, opts)         → Promise<number>          (stream — katta pack)
 *   extractEntriesSync(zipPath, destDir, names, opts) → number            (kichik fayl: thumb)
 *
 * Xavfsizlik: zip-slip (`../`, absolyut yo'l, disk harfi) BLOKLANADI;
 * macOS axlati (`__MACOSX/`, `._*`, `.DS_Store`) sukut bo'yicha o'tkazib yuboriladi.
 */
(function () {
  "use strict";

  var SIG_EOCD = 0x06054b50;
  var SIG_EOCD64 = 0x06064b50;
  var SIG_LOC64 = 0x07064b50;
  var SIG_CDH = 0x02014b50;

  function nodeAvailable() {
    return typeof require === "function" && typeof window.__adobe_cep__ !== "undefined";
  }

  /** 64-bitli qiymat (Node 8 mos: readBigUInt64LE'siz). */
  function readU64(buf, off) {
    var lo = buf.readUInt32LE(off);
    var hi = buf.readUInt32LE(off + 4);
    return hi * 4294967296 + lo;
  }

  function isJunk(name) {
    return (
      /(^|\/)__MACOSX\//i.test(name) ||
      /(^|\/)\._/.test(name) ||
      /(^|\/)\.DS_Store$/i.test(name)
    );
  }

  /** Zip-slip himoyasi: dest ichida qoladigan xavfsiz nisbiy yo'l ("" = rad etilgan). */
  function safeRelPath(pathLib, name) {
    var rel = String(name || "").replace(/\\/g, "/");
    if (!rel || rel.indexOf("\u0000") >= 0) return "";
    if (/^([a-zA-Z]:)?\//.test(rel)) return ""; // absolyut yoki disk harfi
    var parts = rel.split("/").filter(function (s) {
      return s && s !== ".";
    });
    if (!parts.length) return "";
    for (var i = 0; i < parts.length; i++) if (parts[i] === "..") return "";
    return pathLib.join.apply(pathLib, parts);
  }

  /** EOCD + markaziy katalogni o'qib entry ro'yxatini qaytaradi. */
  function readCentralDirectory(zipPath) {
    var fs = require("fs");
    var stat = fs.statSync(zipPath);
    var size = stat.size;
    if (size < 22) throw new Error("ZIP is empty or truncated");

    var tailLen = Math.min(size, 66560); // 64KB izoh + EOCD
    var tail = Buffer.alloc(tailLen);
    var fd = fs.openSync(zipPath, "r");
    try {
      fs.readSync(fd, tail, 0, tailLen, size - tailLen);
      var p = -1;
      for (var i = tailLen - 22; i >= 0; i--) {
        if (tail.readUInt32LE(i) === SIG_EOCD) { p = i; break; }
      }
      if (p < 0) throw new Error("Not a ZIP archive (no end-of-directory record)");

      var count = tail.readUInt16LE(p + 10);
      var cdSize = tail.readUInt32LE(p + 12);
      var cdOffset = tail.readUInt32LE(p + 16);

      // ZIP64 — 4GB'dan katta yoki 65535'dan ko'p entry'li arxivlar
      if (cdOffset === 0xffffffff || cdSize === 0xffffffff || count === 0xffff) {
        var locAbs = size - tailLen + p - 20;
        if (locAbs >= 0) {
          var loc = Buffer.alloc(20);
          fs.readSync(fd, loc, 0, 20, locAbs);
          if (loc.readUInt32LE(0) === SIG_LOC64) {
            var eocd64At = readU64(loc, 8);
            var e64 = Buffer.alloc(56);
            fs.readSync(fd, e64, 0, 56, eocd64At);
            if (e64.readUInt32LE(0) === SIG_EOCD64) {
              count = readU64(e64, 32);
              cdSize = readU64(e64, 40);
              cdOffset = readU64(e64, 48);
            }
          }
        }
      }
      if (!(cdSize > 0) || cdOffset + cdSize > size) throw new Error("ZIP directory is corrupted");

      var cd = Buffer.alloc(cdSize);
      fs.readSync(fd, cd, 0, cdSize, cdOffset);

      var entries = [];
      var off = 0;
      while (off + 46 <= cd.length && entries.length < count + 8) {
        if (cd.readUInt32LE(off) !== SIG_CDH) break;
        var method = cd.readUInt16LE(off + 10);
        var compSize = cd.readUInt32LE(off + 20);
        var uncompSize = cd.readUInt32LE(off + 24);
        var nameLen = cd.readUInt16LE(off + 28);
        var extraLen = cd.readUInt16LE(off + 30);
        var commentLen = cd.readUInt16LE(off + 32);
        var localOffset = cd.readUInt32LE(off + 42);
        var name = cd.toString("utf8", off + 46, off + 46 + nameLen);

        // ZIP64 kengaytma (0x0001): 0xffffffff bo'lgan maydonlar shu yerda
        if (uncompSize === 0xffffffff || compSize === 0xffffffff || localOffset === 0xffffffff) {
          var ex = off + 46 + nameLen;
          var exEnd = ex + extraLen;
          while (ex + 4 <= exEnd) {
            var hid = cd.readUInt16LE(ex);
            var hlen = cd.readUInt16LE(ex + 2);
            var q = ex + 4;
            if (hid === 0x0001) {
              if (uncompSize === 0xffffffff && q + 8 <= exEnd) { uncompSize = readU64(cd, q); q += 8; }
              if (compSize === 0xffffffff && q + 8 <= exEnd) { compSize = readU64(cd, q); q += 8; }
              if (localOffset === 0xffffffff && q + 8 <= exEnd) { localOffset = readU64(cd, q); q += 8; }
              break;
            }
            ex += 4 + hlen;
          }
        }

        entries.push({
          name: name,
          isDir: /\/$/.test(name) || (uncompSize === 0 && compSize === 0 && /\/$/.test(name)),
          size: uncompSize,
          compSize: compSize,
          method: method,
          localOffset: localOffset,
        });
        off += 46 + nameLen + extraLen + commentLen;
      }
      return entries;
    } finally {
      try { fs.closeSync(fd); } catch (e) {}
    }
  }

  /** Entry ma'lumoti fayl ichida qayerdan boshlanadi (lokal sarlavhadan keyin). */
  function dataStart(fs, fd, entry) {
    var lh = Buffer.alloc(30);
    fs.readSync(fd, lh, 0, 30, entry.localOffset);
    if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error("ZIP entry header is corrupted");
    return entry.localOffset + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
  }

  function ensureDirFor(fs, pathLib, filePath) {
    fs.mkdirSync(pathLib.dirname(filePath), { recursive: true });
  }

  /** Bitta entry'ni oqim orqali yozadi (xotiraga to'liq yuklamaydi). */
  function writeEntryStream(fs, zlib, zipPath, entry, start, outPath) {
    return new Promise(function (resolve, reject) {
      var rs = fs.createReadStream(zipPath, { start: start, end: start + entry.compSize - 1 });
      var ws = fs.createWriteStream(outPath);
      var done = false;
      function fail(e) { if (!done) { done = true; try { rs.destroy(); } catch (x) {} reject(e); } }
      ws.on("error", fail);
      rs.on("error", fail);
      ws.on("close", function () { if (!done) { done = true; resolve(); } });
      if (entry.method === 0) {
        rs.pipe(ws);
      } else if (entry.method === 8) {
        var inf = zlib.createInflateRaw();
        inf.on("error", fail);
        rs.pipe(inf).pipe(ws);
      } else {
        fail(new Error("Unsupported ZIP compression method: " + entry.method));
      }
    });
  }

  /** Bo'sh (0 bayt) entry uchun oqim ochmaymiz. */
  function writeEmpty(fs, outPath) {
    fs.writeFileSync(outPath, Buffer.alloc(0));
  }

  /**
   * Arxivni to'liq ochadi (papka strukturasi SAQLANADI — .aep nisbiy
   * footage havolalari buzilmasin). Qaytaradi: yozilgan fayllar soni.
   * opts: { keepJunk, filter(name), onProgress(done, total) }
   */
  async function extractAll(zipPath, destDir, opts) {
    var options = opts || {};
    var fs = require("fs");
    var pathLib = require("path");
    var zlib = require("zlib");
    var entries = readCentralDirectory(zipPath);
    fs.mkdirSync(destDir, { recursive: true });

    var fd = fs.openSync(zipPath, "r");
    var written = 0;
    try {
      var total = entries.length;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!options.keepJunk && isJunk(e.name)) continue;
        if (options.filter && !options.filter(e.name)) continue;
        var rel = safeRelPath(pathLib, e.name);
        if (!rel) continue; // zip-slip / noto'g'ri nom — jimgina tashlab ketamiz
        var outPath = pathLib.join(destDir, rel);
        if (/\/$/.test(e.name)) {
          fs.mkdirSync(outPath, { recursive: true });
          continue;
        }
        ensureDirFor(fs, pathLib, outPath);
        if (e.compSize === 0 && e.size === 0) {
          writeEmpty(fs, outPath);
        } else {
          var start = dataStart(fs, fd, e);
          await writeEntryStream(fs, zlib, zipPath, e, start, outPath);
        }
        written++;
        if (options.onProgress) {
          try { options.onProgress(i + 1, total); } catch (x) {}
        }
      }
    } finally {
      try { fs.closeSync(fd); } catch (x) {}
    }
    return written;
  }

  /**
   * Nomlari bo'yicha bir nechta KICHIK entry'ni sinxron ochadi (thumb.png/thumb.mp4).
   * opts: { flatten } — papkasiz, faqat fayl nomi bilan yozadi.
   */
  function extractEntriesSync(zipPath, destDir, names, opts) {
    var options = opts || {};
    var fs = require("fs");
    var pathLib = require("path");
    var zlib = require("zlib");
    var want = {};
    (names || []).forEach(function (n) { want[String(n).toLowerCase()] = true; });
    var entries = readCentralDirectory(zipPath);
    fs.mkdirSync(destDir, { recursive: true });
    var fd = fs.openSync(zipPath, "r");
    var written = 0;
    try {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (/\/$/.test(e.name) || isJunk(e.name)) continue;
        var base = e.name.split("/").pop().toLowerCase();
        if (!want[e.name.toLowerCase()] && !want[base]) continue;
        var rel = options.flatten ? pathLib.basename(e.name) : safeRelPath(pathLib, e.name);
        if (!rel) continue;
        var outPath = pathLib.join(destDir, rel);
        ensureDirFor(fs, pathLib, outPath);
        if (e.compSize === 0 && e.size === 0) {
          writeEmpty(fs, outPath);
          written++;
          continue;
        }
        var start = dataStart(fs, fd, e);
        var raw = Buffer.alloc(e.compSize);
        fs.readSync(fd, raw, 0, e.compSize, start);
        var out = e.method === 0 ? raw : zlib.inflateRawSync(raw);
        fs.writeFileSync(outPath, out);
        written++;
      }
    } finally {
      try { fs.closeSync(fd); } catch (x) {}
    }
    return written;
  }

  /** Entry ro'yxati (axlat chiqarilgan). Xato bo'lsa — bo'sh massiv. */
  function listEntries(zipPath) {
    try {
      return readCentralDirectory(zipPath)
        .filter(function (e) { return !/\/$/.test(e.name) && !isJunk(e.name); })
        .map(function (e) { return { name: e.name, size: e.size, isDir: false }; });
    } catch (e) {
      return [];
    }
  }

  window.AFZip = {
    available: nodeAvailable,
    listEntries: listEntries,
    extractAll: extractAll,
    extractEntriesSync: extractEntriesSync,
  };
})();
