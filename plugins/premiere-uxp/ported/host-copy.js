/* Generatsiya: scripts/ae-port.mjs (TEXT_COPY) — QO'LDA TAHRIRLAMA. */
(function () {
  "use strict";
  var RULES = [
  [/After Effects/g, "Premiere Pro"],
  [/AfterEffects/g, "PremierePro"],
  [/\bAE\b/g, "Premiere"],
  [/into your comp\b/g, "into your sequence"],
  [/your comp\b/g, "your sequence"],
  [/the comp\b/g, "the sequence"],
  [/\bactive composition\b/g, "active sequence"],
  [/\byour composition\b/g, "your sequence"],
  [/\ba composition\b/g, "a sequence"],
  [/\bComposition\b/g, "Sequence"],
  [/'composition'/g, "'sequence'"],
  [/frame from composition/g, "frame from sequence"],
  [/\(\.aep\/\.zip\)/g, "(.mogrt/.zip)"],
  [/\(\.aep \+ footage\)/g, "(.mogrt + footage)"],
  [/No pack \(\.aep\)/g, "No pack (.mogrt)"],
  [/Project \(\.aep\) file/g, "Project (.mogrt) file"]
  ];

  function mapText(s) {
    var out = s;
    for (var i = 0; i < RULES.length; i++) out = out.replace(RULES[i][0], RULES[i][1]);
    return out;
  }

  // JSON daraxtidagi HAR satrni xaritalaymiz: CMS tugunlari erkin shaklda
  // (matn, massiv, ichma-ich obyekt) — kalitlarni qattiq yozib qo'yish mo'rt bo'lardi.
  function mapDeep(v, depth) {
    if (depth > 12) return v;
    if (typeof v === "string") return mapText(v);
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) v[i] = mapDeep(v[i], depth + 1); return v; }
    if (v && typeof v === "object") { for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) v[k] = mapDeep(v[k], depth + 1); return v; }
    return v;
  }
  window.__ffHostCopy = mapText;
  window.__ffHostCopyDeep = function (v) { return mapDeep(v, 0); };

  // ── 1. Tarmoq qatlami: CMS javobini xaritalash ───────────────────────────
  var CMS_RE = /\/api\/plugin\/content-config/;
  var nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var p = nativeFetch.apply(this, arguments);
      if (!CMS_RE.test(url)) return p;
      return p.then(function (res) {
        // `Response` konstruktoriga tayanmaymiz (UXP'da bor-yo'qligi kafolatsiz) —
        // asl javobni o'rab, faqat `json()`/`text()` ni ustidan yozamiz.
        var wrap = Object.create(res);
        wrap.ok = res.ok; wrap.status = res.status; wrap.statusText = res.statusText;
        wrap.headers = res.headers; wrap.url = res.url;
        wrap.json = function () { return res.json().then(function (d) { return mapDeep(d, 0); }); };
        wrap.text = function () { return res.text().then(mapText); };
        return wrap;
      });
    };
  } else {
    (window.FFLog ? FFLog.warn : console.warn)("host-copy: fetch yo'q — CMS matni xaritalanmaydi");
  }

  // ── 2. Kesh qatlami: oldingi sessiyada saqlangan CMS matni ───────────────
  // `afCmsApply()` boot'da localStorage keshidan o'qiydi — tarmoqdan oldin.
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || !/cms/i.test(key)) continue;
      var raw = localStorage.getItem(key);
      if (!raw) continue;
      var fixed = mapText(raw);
      if (fixed !== raw) localStorage.setItem(key, fixed);
    }
  } catch (e) { /* storage yo'q → jim */ }
})();
