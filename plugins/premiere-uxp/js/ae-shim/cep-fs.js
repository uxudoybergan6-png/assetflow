/*
 * cep-fs.js — AE `window.cep.fs` yuzasining Premiere UXP adapteri.
 *
 * CEP `showOpenDialog()` sinxron obyekt qaytaradi, UXP picker esa Promise.
 * Shu sabab `scripts/ae-port.mjs` FAQAT portlangan nusxadagi picker
 * chaqiruvlarini `await` qiladi; bu fayl esa CEP shaklini saqlaydi:
 *   { err: 0, data: [nativePath, ...] }
 *
 * `readFile(path, Base64)` sinxron qoladi — AI referens preview/upload oqimi
 * aynan shu shaklni kutadi. Faqat haqiqiy UXP runtime'da e'lon qilinadi.
 */
(function () {
  "use strict";

  var uxp = null;
  try { uxp = require("uxp"); } catch (e) { return; }
  var log = window.FFLog || { warn: function () {} };

  function fsPath(p) {
    var s = String(p || "");
    if (s.indexOf("file://") === 0) s = s.replace(/^file:\/\//, "");
    try { s = decodeURIComponent(s); } catch (e) { /* oddiy yo'l qoladi */ }
    return s;
  }

  function fileTypes(exts) {
    if (!Array.isArray(exts)) return undefined;
    var out = exts.map(function (x) {
      return String(x || "").trim().replace(/^\./, "").toLowerCase();
    }).filter(Boolean);
    return out.length ? out : undefined;
  }

  async function showOpenDialog(allowMultiple, chooseFolder, _title, _initial, exts) {
    var lfs = uxp.storage && uxp.storage.localFileSystem;
    if (!lfs) return { err: 1, data: [], error: "UXP file system is unavailable" };
    try {
      var picked;
      if (chooseFolder) {
        picked = await lfs.getFolder();
      } else {
        var opts = { allowMultiple: !!allowMultiple };
        var types = fileTypes(exts);
        if (types) opts.types = types;
        picked = await lfs.getFileForOpening(opts);
      }
      if (!picked) return { err: 0, data: [] }; // foydalanuvchi bekor qildi
      var list = Array.isArray(picked) ? picked : [picked];
      return {
        err: 0,
        data: list.map(function (entry) { return entry && entry.nativePath ? entry.nativePath : ""; }).filter(Boolean),
      };
    } catch (e) {
      // UXP picker bekor qilinganda versiyaga qarab null yoki exception beradi.
      var msg = String((e && e.message) || e || "");
      if (/cancel/i.test(msg)) return { err: 0, data: [] };
      log.warn("cep.fs picker xato:", msg);
      return { err: 1, data: [], error: msg };
    }
  }

  function readFile(path, encoding) {
    try {
      var fs = typeof window.__ffRequire === "function" ? window.__ffRequire("fs") : require("fs");
      var raw = fs.readFileSync(fsPath(path));
      var u8 = raw instanceof Uint8Array
        ? raw
        : raw instanceof ArrayBuffer
          ? new Uint8Array(raw)
          : new Uint8Array(raw && raw.buffer ? raw.buffer : []);
      var enc = String(encoding || "").toLowerCase();
      if (enc === "base64") {
        var bin = "";
        var STEP = 0x8000;
        for (var i = 0; i < u8.length; i += STEP) {
          bin += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + STEP, u8.length)));
        }
        return { err: 0, data: btoa(bin) };
      }
      var text = window.FFBytes && window.FFBytes.utf8Decode
        ? window.FFBytes.utf8Decode(u8)
        : String.fromCharCode.apply(null, u8);
      return { err: 0, data: text };
    } catch (e) {
      return { err: 3, data: "", error: String((e && e.message) || e) };
    }
  }

  window.cep = window.cep || {};
  window.cep.encoding = window.cep.encoding || {};
  window.cep.encoding.Base64 = window.cep.encoding.Base64 || "Base64";
  window.cep.fs = window.cep.fs || {};
  window.cep.fs.showOpenDialog = showOpenDialog;
  window.cep.fs.readFile = readFile;
})();
