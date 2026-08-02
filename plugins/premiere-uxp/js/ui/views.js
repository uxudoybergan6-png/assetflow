/*
 * FrameFlow UXP — ekranlar (FAZA 1: yuklanish · login · hisob).
 * Katalog ko'rinishi FAZA 2 da qo'shiladi (js/catalog.js + views.browse).
 *
 * Har ekranda: loading / empty / error / success holatlari halol ko'rsatiladi.
 */
(function () {
  "use strict";

  var el = window.FFUI.el;
  var button = window.FFUI.button;

  /** Footer'dagi "Loglar" tugmasi main.js ro'yxatga olgan callback'ni chaqiradi. */
  var logToggle = null;
  function setLogToggle(fn) { logToggle = fn; }

  /** Panel qobig'i: header + body + footer. `bodyNode` almashtiriladi. */
  function shell(opts) {
    var o = opts || {};
    var body = el("div", { class: "ff-body" }, [o.body].filter(Boolean));
    var headerRight = o.headerRight ? [o.headerRight] : [];
    var header = el("div", { class: "ff-header" }, [
      el("div", { class: "ff-brand" }, [
        el("div", { class: "ff-brand-mark" }),
        el("div", { class: "ff-brand-name", text: "FrameFlow" }),
        el("div", { class: "ff-brand-sub", text: window.FF_ENV.appLabel }),
      ]),
    ].concat(headerRight));

    var footer = el("div", { class: "ff-footer" }, [
      el("div", { text: "v" + window.FF_ENV.version }),
      el("div", { class: "ff-footer-spacer" }),
      el("div", { class: "ff-footer-note", text: o.footerRight || "" }),
      button("Loglar", {
        variant: "ghost",
        title: "Diagnostika loglari",
        onClick: function () { if (logToggle) logToggle(); },
      }),
    ]);

    return el("div", { class: "ff-root" }, [header, body, footer]);
  }

  /**
   * Diagnostika ekrani. UXP'da UDT'siz developer console yo'q — shuning uchun
   * FFLog halqa buferi panel ichida ko'rsatiladi (token/parol hech qachon
   * loglanmaydi, FFLog o'zi filtrlaydi).
   */
  function logs(onBack) {
    var entries = window.FFLog.entries();
    var body = [
      el("div", { class: "ff-row" }, [
        el("div", { class: "ff-h2 ff-row-grow", text: "Diagnostika" }),
        button("Orqaga", { variant: "ghost", onClick: onBack }),
      ]),
      el("div", { class: "ff-faint", style: "margin-bottom:8px;",
        text: "API: " + window.FF_ENV.apiBase + " · token: " + window.FFStore.tokenBackend() }),
    ];
    if (!entries.length) {
      body.push(el("div", { class: "ff-muted", text: "Log yozuvlari yo'q." }));
    } else {
      var list = el("div", { class: "ff-log" });
      entries.slice().reverse().forEach(function (e) {
        var d = new Date(e.t);
        var hhmmss = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) +
          ":" + ("0" + d.getSeconds()).slice(-2);
        list.appendChild(el("div", { class: "ff-log-line ff-log-" + e.level, text: hhmmss + "  " + e.msg }));
      });
      body.push(list);
    }
    return shell({ body: el("div", {}, body) });
  }

  /** Boshlang'ich yuklanish. */
  function loading(text) {
    return shell({ body: window.FFUI.spinnerText(text) });
  }

  /** Tarmoq/API yiqilganda — qayta urinish bilan. */
  function fatal(message, onRetry) {
    return shell({
      body: window.FFUI.unavailable("Ulanib bo'lmadi", message, "Qayta urinish", onRetry),
    });
  }

  /**
   * Login ekrani.
   * @param {{onPassword:Function,onGoogle:Function,busy:boolean,error:string,device:object}} p
   */
  function login(p) {
    var emailF = window.FFUI.field("Email", { type: "text", placeholder: "siz@example.com" });
    var passF = window.FFUI.field("Parol", { type: "password", placeholder: "••••••••" });
    var totpF = window.FFUI.field("2FA kodi (agar yoqilgan bo'lsa)", { type: "text", placeholder: "123456" });

    function submit() {
      p.onPassword(emailF.input.value, passF.input.value, totpF.input.value);
    }
    function onEnter(e) {
      if (e.key === "Enter") submit();
    }
    emailF.input.addEventListener("keydown", onEnter);
    passF.input.addEventListener("keydown", onEnter);
    totpF.input.addEventListener("keydown", onEnter);

    var kids = [
      el("div", { class: "ff-h1", text: "Kirish" }),
      el("div", { class: "ff-muted", style: "margin-bottom:16px;",
        text: "FrameFlow hisobingiz bilan kiring — Premiere shablonlari va importlar shu hisobga bog'lanadi." }),
    ];

    if (p.error) kids.push(window.FFUI.note(p.error, "danger"));

    // Google device-code oqimi faol bo'lsa — kod ekrani birinchi o'rinda.
    if (p.device) {
      var d = p.device;
      var dev = [
        el("div", { class: "ff-h2", text: "Google bilan kirish" }),
        el("div", { class: "ff-muted", style: "margin-bottom:8px;",
          text: "Brauzerda ochilgan sahifaga quyidagi kodni kiriting:" }),
        el("div", { class: "ff-code", text: d.code || "…" }),
      ];
      if (d.browserFailed) {
        dev.push(window.FFUI.note("Brauzer avtomatik ochilmadi. Havolani qo'lda oching: " + (d.url || ""), "warn"));
      }
      if (d.status === "expired" || d.status === "denied") {
        dev.push(window.FFUI.note(d.message || "Kod muddati tugadi.", "danger"));
        dev.push(button("Qayta urinish", { variant: "primary", onClick: p.onGoogle }));
      } else {
        dev.push(el("div", { class: "ff-faint", style: "margin-bottom:8px;", text: "Tasdiqlash kutilmoqda…" }));
        dev.push(el("div", { class: "ff-btn-row" }, [
          button("Havolani qayta ochish", { onClick: function () { p.onReopen(d.url); } }),
          button("Bekor qilish", { onClick: p.onCancelDevice }),
        ]));
      }
      kids.push(el("div", { class: "ff-card" }, dev));
      kids.push(el("div", { class: "ff-divider" }));
    }

    kids.push(el("div", { class: "ff-card" }, [
      emailF.wrap,
      passF.wrap,
      totpF.wrap,
      button(p.busy ? "Kirilmoqda…" : "Kirish", {
        variant: "primary",
        disabled: !!p.busy,
        disabledReason: "So'rov bajarilmoqda",
        onClick: submit,
      }),
    ]));

    if (!p.device) {
      kids.push(el("div", { class: "ff-card" }, [
        el("div", { class: "ff-muted", style: "margin-bottom:8px;", text: "Yoki" }),
        button("Google bilan kirish", { onClick: p.onGoogle, disabled: !!p.busy }),
      ]));
    }

    return shell({ body: el("div", {}, kids) });
  }

  /** Hisob / bosh ekran (FAZA 1). FAZA 2 da katalog shu qobiq ichiga keladi. */
  function home(p) {
    var u = p.user || {};
    var ctx = p.context || {};

    var planBadge = el("span", {
      class: "ff-badge" + (u.plan && u.plan !== "free" ? " ff-badge-pro" : ""),
      text: u.planLabel || (u.plan || "free").toUpperCase(),
    });

    var kids = [
      el("div", { class: "ff-card" }, [
        el("div", { class: "ff-row" }, [
          el("div", { class: "ff-row-grow" }, [
            el("div", { class: "ff-h2", text: u.name || u.email || "Foydalanuvchi" }),
            el("div", { class: "ff-faint", text: u.email || "" }),
          ]),
          planBadge,
        ]),
      ]),
    ];

    // Host konteksti — import amallarining halol sababi shu yerdan chiqadi.
    kids.push(el("div", { class: "ff-card" }, [
      el("div", { class: "ff-h2", text: "Premiere konteksti" }),
      ctx.ok
        ? el("div", {}, [
            el("div", { class: "ff-muted", text: "Loyiha: " + (ctx.projectName || "—") }),
            el("div", { class: "ff-muted", text: "Ketma-ketlik: " + (ctx.sequenceName || "—") }),
            el("div", { class: "ff-faint", text: "Video treklar: " + (ctx.videoTrackCount || 0) }),
          ])
        : window.FFUI.note(
            (ctx.reason || "Kontekst aniqlanmadi") + " — import amallari shu sababdan faol emas.",
            "warn"
          ),
      el("div", { style: "margin-top:8px;" }, [
        button("Kontekstni yangilash", { onClick: p.onRefreshContext }),
      ]),
    ]));

    // Reliz kanali (/api/plugin/version) — halol status.
    var rel = p.release;
    var relBody;
    if (!rel) relBody = window.FFUI.spinnerText("Versiya tekshirilmoqda…");
    else if (rel.error) relBody = window.FFUI.note(rel.error, "danger");
    else if (rel.updateAvailable)
      relBody = window.FFUI.note(
        "Yangi versiya mavjud: " + (rel.latest || "?") +
          (rel.mandatory ? " (majburiy)" : "") +
          ". Yangilanish getframeflow.app orqali o'rnatiladi.",
        "warn"
      );
    else relBody = el("div", { class: "ff-muted", text: "Eng so'nggi versiya o'rnatilgan (" + window.FF_ENV.version + ")." });

    kids.push(el("div", { class: "ff-card" }, [
      el("div", { class: "ff-h2", text: "Versiya" }),
      relBody,
    ]));

    // FAZA 2 — katalog. Ishlamaydigan narsani faol tugma qilmaymiz (UX qoidasi).
    kids.push(el("div", { class: "ff-card" }, [
      el("div", { class: "ff-h2", text: "Shablonlar katalogi" }),
      el("div", { class: "ff-muted", style: "margin-bottom:8px;",
        text: "Premiere shablonlari (app=pr) katalogi keyingi fazada shu panelga ulanadi." }),
      button("Katalog — tez orada", {
        disabled: true,
        disabledReason: "FAZA 2 da ulanadi",
      }),
    ]));

    var logoutBtn = button("Chiqish", { variant: "ghost", onClick: p.onLogout });

    return shell({
      body: el("div", {}, kids),
      headerRight: logoutBtn,
      footerRight: window.FF_ENV.appLabel + (window.FFHost.hostVersion() ? " " + window.FFHost.hostVersion() : ""),
    });
  }

  window.FFViews = {
    shell: shell,
    loading: loading,
    fatal: fatal,
    login: login,
    home: home,
    logs: logs,
    setLogToggle: setLogToggle,
  };
})();
