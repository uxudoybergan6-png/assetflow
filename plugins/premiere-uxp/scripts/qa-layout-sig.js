/**
 * Layout imzosi — AE originali (localhost:8976) va portlangan sahifa (:8974)
 * bir xil holatda bir xil joylashuvni beryaptimi, shuni O'LCHAB tekshiradi.
 * Ko'z bilan solishtirish ekranma-ekran sekin va ishonchsiz; bu esa har `id`li
 * ko'rinadigan elementning qutisini taqqoslaydi.
 *
 * Foydalanish (brauzer konsolida / javascript_tool orqali):
 *   FFQA.capture('home')            // AE tabida — imzoni proksi xotirasiga yozadi
 *   await FFQA.compare('home')      // port tabida — farqlar ro'yxatini qaytaradi
 *
 * Proksi (`qa-proxy.mjs`) `/__qa/<kalit>` ni saqlaydi; ikki origin shu orqali
 * gaplashadi. FAQAT lokal QA — paketga kirmaydi.
 */
(function () {
  var QA = "http://localhost:4000/__qa/";

  /**
   * `deep` — `id` siz elementlarni ham qamrab oladi (kartalar, chiplar…).
   * Kalit: `birinchiKlass[N]`, N — hujjat tartibidagi indeks. Element soni ikki
   * tomonda bir xil bo'lsa kalitlar mos tushadi; ma'lumot farq qilsa (masalan
   * katalog `app=pr` vs `app=ae`) avval so'rovni tenglashtirish kerak.
   */
  function sig(deep) {
    var out = {};
    var seen = {};
    var els = document.querySelectorAll(deep ? "[id],[class]" : "[id]");
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (!e.getClientRects().length) continue;
      var key = e.id;
      if (!key) {
        var cls = (e.getAttribute("class") || "").trim().split(/\s+/)[0];
        if (!cls) continue;
        seen[cls] = (seen[cls] || 0) + 1;
        key = cls + "[" + seen[cls] + "]";
      }
      var r = e.getBoundingClientRect();
      out[key] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }
    return { w: Math.round(document.documentElement.getBoundingClientRect().width), els: out };
  }

  window.FFQA = {
    sig: sig,
    capture: function (key, deep) {
      var s = sig(deep);
      return fetch(QA + key, { method: "POST", body: JSON.stringify(s) })
        .then(function () { return { saved: key, count: Object.keys(s.els).length, w: s.w }; });
    },
    compare: function (key, tol, deep) {
      tol = tol == null ? 2 : tol;
      return fetch(QA + key).then(function (r) { return r.json(); }).then(function (ref) {
        var mine = sig(deep);
        var diffs = [], missing = [], extra = [];
        // Kenglik farq qilsa taqqoslash ma'nosiz — avval buni aytamiz.
        var scale = ref.w && mine.w ? (mine.w / ref.w) : 1;
        for (var id in ref.els) {
          if (!(id in mine.els)) { missing.push(id); continue; }
          var a = ref.els[id], b = mine.els[id];
          var d = [0, 1, 2, 3].map(function (i) { return Math.round(b[i] - a[i] * (i === 1 || i === 3 ? 1 : scale)); });
          if (d.some(function (x) { return Math.abs(x) > tol; })) {
            diffs.push({ id: id, ae: a, pr: b, d: d });
          }
        }
        for (var id2 in mine.els) if (!(id2 in ref.els)) extra.push(id2);
        diffs.sort(function (x, y) {
          var mx = Math.max.apply(null, x.d.map(Math.abs)), my = Math.max.apply(null, y.d.map(Math.abs));
          return my - mx;
        });
        return { refW: ref.w, myW: mine.w, scale: Math.round(scale * 100) / 100,
          checked: Object.keys(ref.els).length, diffCount: diffs.length,
          missing: missing.slice(0, 20), missingCount: missing.length,
          extra: extra.slice(0, 20), extraCount: extra.length,
          diffs: diffs.slice(0, 20) };
      });
    },
  };
})();
