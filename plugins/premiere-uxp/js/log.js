/*
 * FrameFlow UXP — log. UXP'da DevTools har doim ochiq bo'lmaydi, shu sabab
 * oxirgi N yozuv xotirada saqlanadi va "Diagnostika" ekranida ko'rsatiladi.
 * Nozik ma'lumot (token, parol) hech qachon yozilmaydi.
 */
(function () {
  "use strict";

  var MAX = 200;
  var buf = [];

  function push(level, args) {
    var msg = Array.prototype.map
      .call(args, function (a) {
        if (a instanceof Error) return a.message;
        if (typeof a === "object") {
          try { return JSON.stringify(a); } catch (e) { return String(a); }
        }
        return String(a);
      })
      .join(" ");
    buf.push({ t: Date.now(), level: level, msg: msg });
    if (buf.length > MAX) buf.shift();
    try { (console[level] || console.log).call(console, "[FF]", msg); } catch (e) { /* konsol yo'q */ }
  }

  window.FFLog = {
    info: function () { push("log", arguments); },
    warn: function () { push("warn", arguments); },
    error: function () { push("error", arguments); },
    entries: function () { return buf.slice(); },
    text: function () {
      return buf
        .map(function (e) { return e.level.toUpperCase() + " " + e.msg; })
        .join("\n");
    },
  };
})();
