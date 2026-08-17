/**
 * AssetFlow — theme (dark/light) + mobile sidebar
 */
const AssetFlowTheme = (() => {
  /**
   * #80 (X6) — YAGONA tema kaliti. Ilgari bitta domenda ikki xil kalit yashardi:
   * Studio `af-theme` (dark/light), ommaviy web va yordamchi sahifalar `ff-theme`
   * (noir/neon/cold) — qiymatlar bir-biriga mos emas edi. Endi kalit bitta:
   * `ff-theme`, qiymatlar to'plami bitta: noir | neon | cold | light.
   * Har sirt o'zi qo'llab-quvvatlaydigan eng yaqin ko'rinishni chizadi:
   *   · Studio (shu fayl) — `light` → yorug', qolgani → qorong'i
   *   · Ommaviy web / yordamchi sahifalar — `light` → noir (yorug' palitra yo'q)
   * (AE plagin CEP ichida ishlaydi, o'z `afPrefs.theme`ini saqlaydi — u brauzer
   * localStorage'ini bo'lishmaydi, lekin qiymat nomlari SHU to'plamdan.)
   */
  const STORAGE_KEY = "ff-theme";
  const LEGACY_KEY = "af-theme";
  const DARK_FLAVOURS = ["noir", "neon", "cold"];
  let hadStored = false;

  /** Saqlangan qiymat (eski `af-theme` bo'lsa bir martalik ko'chirib olinadi). */
  function readStored() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v) return v;
      const old = localStorage.getItem(LEGACY_KEY);
      if (old) {
        const migrated = old === "light" ? "light" : "noir";
        localStorage.setItem(STORAGE_KEY, migrated);
        localStorage.removeItem(LEGACY_KEY);
        return migrated;
      }
    } catch {
      /* private rejim — tema faqat shu sahifada */
    }
    return null;
  }

  function current() {
    return document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";
  }

  function apply(theme) {
    const t = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    // Qorong'iga qaytilganda ommaviy webda tanlangan "lazzat" (neon/cold) saqlanib
    // qolsin — faqat hech qanday lazzat bo'lmasa `noir` yoziladi.
    let store = "light";
    if (t === "dark") {
      const cur = readStored();
      store = DARK_FLAVOURS.indexOf(cur) >= 0 ? cur : "noir";
    }
    try {
      localStorage.setItem(STORAGE_KEY, store);
    } catch {
      /* ignore */
    }
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
    const saved = readStored();
    hadStored = !!saved;
    const prefersLight =
      !saved &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    apply(saved === "light" || (!saved && prefersLight) ? "light" : "dark");
  }

  /** Foydalanuvchi temani ATAYIN tanlaganmi (init'dan oldingi holat). */
  function hasPreference() {
    return hadStored;
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

    if (!app.dataset.navDelegateBound) {
      app.dataset.navDelegateBound = "1";
      app.addEventListener("click", (event) => {
        if (event.target.closest(".nav-item") && window.matchMedia("(max-width: 768px)").matches) closeNav();
      });
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

  return { init, toggle, apply, current, hasPreference, openNav, closeNav };
})();

if (typeof window !== "undefined") {
  window.AssetFlowTheme = AssetFlowTheme;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => AssetFlowTheme.init());
  } else {
    AssetFlowTheme.init();
  }
}
