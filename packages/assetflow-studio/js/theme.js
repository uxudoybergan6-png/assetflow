/**
 * AssetFlow — theme (dark/light) + mobile sidebar
 */
const AssetFlowTheme = (() => {
  const STORAGE_KEY = "af-theme";

  function current() {
    return document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";
  }

  function apply(theme) {
    const t = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(STORAGE_KEY, t);
    syncThemeButtons();
    window.dispatchEvent(new CustomEvent("af-theme-change", { detail: { theme: t } }));
  }

  function toggle() {
    const next = current() === "dark" ? "light" : "dark";
    apply(next);
    if (typeof toast === "function") {
      toast(
        next === "light" ? "Light mode" : "Dark mode",
        next === "light"
          ? "Light palette enabled"
          : "Default dark palette",
        "info"
      );
    }
  }

  function syncThemeButtons() {
    const light = current() === "light";
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.title = light ? "Dark mode" : "Light mode";
      btn.setAttribute("aria-label", btn.title);
      const icon = btn.querySelector("[data-theme-icon]");
      if (icon && typeof ic === "function") {
        icon.outerHTML = ic(light ? "moon" : "sun", "theme-ico");
      }
    });
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const prefersLight =
      !saved &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    apply(saved || (prefersLight ? "light" : "dark"));
  }

  function initMobileNav() {
    const app = document.querySelector(".app");
    if (!app || app.dataset.mobileNav === "off") return;

    let scrim = document.getElementById("sidebarScrim");
    if (!scrim) {
      scrim = document.createElement("div");
      scrim.id = "sidebarScrim";
      scrim.className = "sidebar-scrim";
      scrim.addEventListener("click", closeNav);
      app.insertBefore(scrim, app.firstChild);
    }

    document.querySelectorAll("[data-nav-toggle]").forEach((btn) => {
      if (btn.dataset.navBound) return;
      btn.dataset.navBound = "1";
      btn.addEventListener("click", () => {
        document.body.classList.contains("nav-open")
          ? closeNav()
          : openNav();
      });
    });

    document.querySelectorAll(".nav-item").forEach((item) => {
      if (item.dataset.navCloseBound) return;
      item.dataset.navCloseBound = "1";
      item.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 768px)").matches) closeNav();
      });
    });

    window.addEventListener("resize", () => {
      if (window.matchMedia("(min-width: 769px)").matches) closeNav();
    });
  }

  function openNav() {
    document.body.classList.add("nav-open");
  }

  function closeNav() {
    document.body.classList.remove("nav-open");
  }

  function initThemeToggles() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = "1";
      btn.addEventListener("click", () => toggle());
    });
    syncThemeButtons();
  }

  function init() {
    initTheme();
    initThemeToggles();
    initMobileNav();
  }

  return { init, toggle, apply, current, openNav, closeNav };
})();

if (typeof window !== "undefined") {
  window.AssetFlowTheme = AssetFlowTheme;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => AssetFlowTheme.init());
  } else {
    AssetFlowTheme.init();
  }
}
