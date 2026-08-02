/*
 * FrameFlow UXP — boot va router.
 *
 * Oqim: tema → saqlangan sessiya → (login | home).
 * Kontekst saqlanadi: 401 bo'lganda login ekran chiqadi, lekin oxirgi marshrut
 * eslab qolinadi va kirgandan keyin shu yerga qaytiladi (UX qoidasi).
 */
(function () {
  "use strict";

  var root = document.getElementById("ffRoot");

  var app = {
    route: "boot",
    /** login'dan keyin qaytiladigan marshrut */
    returnTo: "home",
    user: null,
    context: null,
    release: null,
    loginBusy: false,
    loginError: "",
    device: null,
    deviceHandle: null,
    /** "logs" ekranidan qaytiladigan marshrut */
    prevRoute: "login",
    /** Detal ekranida ochilgan katalog elementi */
    detailItem: null,
  };

  function mount(node) {
    if (node === root) return; // browse node DOIMIY — qayta biriktirish shart emas
    var parent = root.parentNode;
    parent.replaceChild(node, root);
    node.id = "ffRoot";
    root = node;
  }

  function render() {
    if (app.route === "boot") return mount(window.FFViews.loading("FrameFlow yuklanmoqda…"));
    if (app.route === "fatal")
      return mount(window.FFViews.fatal(app.loginError || "Noma'lum xato", function () { boot(); }));
    if (app.route === "logs")
      return mount(window.FFViews.logs(function () { go(app.prevRoute || "login"); }));
    if (app.route === "browse")
      return mount(window.FFBrowse.view({
        onHome: function () { go("home"); },
        onOpenDetail: function (item) {
          app.detailItem = item;
          go("detail");
        },
      }));
    if (app.route === "detail" && app.detailItem)
      return mount(window.FFBrowse.detailView(app.detailItem, function () { go("browse"); }));
    if (app.route === "login")
      return mount(
        window.FFViews.login({
          busy: app.loginBusy,
          error: app.loginError,
          device: app.device,
          onPassword: onPasswordLogin,
          onGoogle: onGoogleLogin,
          onCancelDevice: onCancelDevice,
          onReopen: function (url) { if (url) window.FFHost.openExternal(url); },
        })
      );
    return mount(
      window.FFViews.home({
        user: app.user,
        context: app.context,
        release: app.release,
        onLogout: onLogout,
        onRefreshContext: refreshContext,
        onBrowse: function () { go("browse"); },
      })
    );
  }

  function go(route) {
    // Browse'dan chiqishda scroll eslab qolinadi, media to'xtatiladi (dekoder oqmasin).
    if (app.route === "browse" && route !== "browse") {
      window.FFBrowse.saveScroll();
      window.FFBrowse.stopMedia();
    }
    if (app.route === "detail" && route !== "detail") window.FFBrowse.stopMedia();
    app.route = route;
    render();
  }

  // ── Tema ──────────────────────────────────────────────────────────────
  // Premiere Dark/Darkest'da brend noir, Light/Lightest'da halol o'qiladigan
  // fallback (spike §8: getCurrent() + onUpdated ishlaydi).
  function applyTheme(name) {
    var light = name === "light" || name === "lightest";
    document.body.className = light ? "ff-theme-light" : "";
    window.FFLog.info("tema:", name);
  }

  function initTheme() {
    try {
      var theme = document.theme;
      if (!theme) return;
      applyTheme(theme.getCurrent ? theme.getCurrent() : "");
      if (theme.onUpdated && theme.onUpdated.addListener) {
        theme.onUpdated.addListener(function () {
          applyTheme(theme.getCurrent ? theme.getCurrent() : "");
        });
      }
    } catch (e) {
      window.FFLog.warn("tema init:", e);
    }
  }

  // ── Auth handlerlari ──────────────────────────────────────────────────

  async function onPasswordLogin(email, password, totp) {
    if (!email || !password) {
      app.loginError = "Email va parolni kiriting.";
      return render();
    }
    app.loginBusy = true;
    app.loginError = "";
    render();
    try {
      app.user = await window.FFAuth.loginWithPassword(email, password, totp);
      app.loginBusy = false;
      app.device = null;
      await afterLogin();
    } catch (e) {
      app.loginBusy = false;
      app.loginError = window.FFApi.humanize(e);
      render();
    }
  }

  function onGoogleLogin() {
    onCancelDevice();
    app.loginError = "";
    app.device = { status: "starting", code: "", url: "" };
    render();
    app.deviceHandle = window.FFAuth.startGoogleLogin(function (evt) {
      if (evt.type === "code") {
        app.device = { status: "pending", code: evt.code, url: evt.url };
      } else if (evt.type === "browser_failed") {
        app.device = Object.assign({}, app.device, { browserFailed: true, url: evt.url });
      } else if (evt.type === "success") {
        app.device = null;
        app.deviceHandle = null;
        app.user = evt.user;
        afterLogin();
        return;
      } else if (evt.type === "denied" || evt.type === "expired") {
        app.device = Object.assign({}, app.device, { status: evt.type, message: evt.message });
        app.deviceHandle = null;
      } else if (evt.type === "error") {
        app.device = null;
        app.deviceHandle = null;
        app.loginError = evt.message;
      }
      render();
    });
  }

  function onCancelDevice() {
    if (app.deviceHandle) app.deviceHandle.cancel();
    app.deviceHandle = null;
    app.device = null;
    render();
  }

  async function onLogout() {
    await window.FFAuth.logout();
    app.user = null;
    app.context = null;
    app.release = null;
    app.detailItem = null;
    // Boshqa hisob boshqa katalogni ko'radi — browse holati butunlay tozalanadi.
    window.FFBrowse.reset();
    go("login");
  }

  // ── Ma'lumot yuklash ──────────────────────────────────────────────────

  async function refreshContext() {
    app.context = await window.FFHost.context();
    render();
  }

  /** Reliz kanali: /api/plugin/version?app=pr (backend `app` ni FAZA "Backend"da
   *  taniydi; hozir e'tiborsiz qoldiradi — javob shakli o'zgarmaydi). */
  async function loadRelease() {
    try {
      var r = await window.FFApi.get("/api/plugin/version", {
        auth: false,
        query: { current: window.FF_ENV.version, app: window.FF_ENV.app },
      });
      app.release = {
        latest: r.latest,
        updateAvailable: !!r.updateAvailable,
        mandatory: !!r.mandatory,
        installerStatus: r.installerStatus,
      };
    } catch (e) {
      app.release = { error: "Versiyani tekshirib bo'lmadi: " + window.FFApi.humanize(e) };
    }
    render();
  }

  async function afterLogin() {
    go(app.returnTo || "home");
    refreshContext();
    loadRelease();
    window.FFAuth.heartbeat();
  }

  // ── Boot ──────────────────────────────────────────────────────────────

  async function boot() {
    go("boot");
    initTheme();

    window.FFViews.setLogToggle(function () {
      if (app.route === "logs") return go(app.prevRoute || "login");
      app.prevRoute = app.route;
      go("logs");
    });

    window.FFApi.onUnauthorized(function () {
      app.returnTo = app.route === "login" ? "home" : app.route;
      app.user = null;
      app.loginError = "Sessiya tugadi — qaytadan kiring.";
      go("login");
    });

    if (!window.FFHost.available()) {
      window.FFLog.error("premierepro moduli yo'q — panel faqat Premiere ichida ishlaydi.");
    }

    try {
      var user = await window.FFAuth.restore();
      if (!user) {
        app.loginError = "";
        return go("login");
      }
      app.user = user;
      await afterLogin();
    } catch (e) {
      // Tarmoq yiqilgan — tokenni saqlab qolamiz, qayta urinish beramiz.
      app.loginError = window.FFApi.humanize(e);
      go("fatal");
    }
  }

  boot();
})();
