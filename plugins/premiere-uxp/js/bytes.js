/*
 * FrameFlow UXP — bayt yordamchilari.
 *
 * NEGA KERAK (FAZA 0 spike, docs/PREMIERE-UXP-SPIKE-NATIJA.md §2, §4):
 *  1) UXP'da `TextDecoder`/`TextEncoder` YO'Q → UTF-8 ni qo'lda dekodlaymiz.
 *  2) `fetch` reader chunk'i `ArrayBuffer` (`.length` = undefined) → `chunk.length`
 *     bilan progress hisoblash NaN beradi va faylni buzadi. Har chunk toU8() dan o'tadi.
 *  3) `secureStorage.getItem` `Uint8Array` qaytaradi → o'qishda dekod shart.
 */
(function () {
  "use strict";

  /** Har qanday binar qiymatni Uint8Array'ga keltiradi (chunk turi barqaror emas). */
  function toU8(v) {
    if (!v) return new Uint8Array(0);
    if (v instanceof Uint8Array) return v;
    if (typeof ArrayBuffer !== "undefined" && v instanceof ArrayBuffer) return new Uint8Array(v);
    if (v.buffer) return new Uint8Array(v.buffer, v.byteOffset || 0, v.byteLength);
    if (typeof v.length === "number") return Uint8Array.from(v);
    return new Uint8Array(0);
  }

  /** UTF-8 baytlarni satrga (surrogat juftlar bilan). TextDecoder o'rnini bosadi. */
  function utf8Decode(input) {
    var u8 = toU8(input);
    var out = "";
    var i = 0;
    while (i < u8.length) {
      var b = u8[i++];
      var cp;
      if (b < 0x80) cp = b;
      else if (b >= 0xc0 && b < 0xe0) cp = ((b & 0x1f) << 6) | (u8[i++] & 0x3f);
      else if (b >= 0xe0 && b < 0xf0)
        cp = ((b & 0x0f) << 12) | ((u8[i++] & 0x3f) << 6) | (u8[i++] & 0x3f);
      else if (b >= 0xf0)
        cp =
          ((b & 0x07) << 18) |
          ((u8[i++] & 0x3f) << 12) |
          ((u8[i++] & 0x3f) << 6) |
          (u8[i++] & 0x3f);
      else continue; // yakka davomiy bayt — o'tkazib yuboramiz
      if (cp > 0xffff) {
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      } else {
        out += String.fromCharCode(cp);
      }
    }
    return out;
  }

  /** Satrni UTF-8 baytlarga. TextEncoder o'rnini bosadi. */
  function utf8Encode(str) {
    var s = String(str == null ? "" : str);
    var bytes = [];
    for (var i = 0; i < s.length; i++) {
      var cp = s.charCodeAt(i);
      if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
        var lo = s.charCodeAt(i + 1);
        if (lo >= 0xdc00 && lo <= 0xdfff) {
          cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
          i++;
        }
      }
      if (cp < 0x80) bytes.push(cp);
      else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
      else if (cp < 0x10000)
        bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      else
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
    }
    return Uint8Array.from(bytes);
  }

  /** Chunk'ning bayt o'lchami — `.length` emas, `.byteLength` (spike §4 tuzog'i). */
  function byteLen(v) {
    if (!v) return 0;
    if (typeof v.byteLength === "number") return v.byteLength;
    if (typeof v.length === "number") return v.length;
    return 0;
  }

  /** Bayt o'lchamini o'qiladigan matnga. */
  function humanSize(n) {
    var b = Number(n) || 0;
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + " MB";
    return (b / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  window.FFBytes = {
    toU8: toU8,
    utf8Decode: utf8Decode,
    utf8Encode: utf8Encode,
    byteLen: byteLen,
    humanSize: humanSize,
  };
})();
