/**
 * AssetFlow CEP — production API/admin (file:// panelda ham cloud ishlaydi)
 */
window.ASSETFLOW_ENV = (function () {
  const PROD_API = "https://api.getframeflow.app";
  const PROD_ADMIN = "https://admin.getframeflow.app/";
  const LOCAL_API = "http://localhost:4000";
  const LOCAL_ADMIN = "http://localhost:3001/";
  // Eski deploy'larda (Render, keyin Cloud Run to'g'ridan URL) login qilingan
  // panellarda prefs.json'da shu eski manzillar saqlanib qolgan bo'lishi mumkin —
  // kod yangilangach ham bu qiymat doimiy ustun kelaveradi. Topilsa joriy
  // default'ga almashtiriladi (sanitizeApi). FAZA 5 (B2): kanonik domen
  // api.getframeflow.app — eski run.app ham endi stale.
  const STALE_APIS = [
    "https://assetflow-rqbq.onrender.com",
    "https://assetflow-api-331762958776.europe-west1.run.app",
  ];

  function isLocalDev() {
    try {
      if (typeof window === "undefined") return false;
      const h = window.location.hostname;
      return h === "localhost" || h === "127.0.0.1";
    } catch {
      return false;
    }
  }

  function sanitizeApi(url) {
    if (!url || typeof url !== "string") return isLocalDev() ? LOCAL_API : PROD_API;
    const clean = url.trim().replace(/\/+$/, "");
    if (!clean) return isLocalDev() ? LOCAL_API : PROD_API;
    if (STALE_APIS.includes(clean)) return isLocalDev() ? LOCAL_API : PROD_API;
    try {
      const parsed = new URL(clean);
      const isLoopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      // Customer CEP/UXP panels run from file/plugin origins. A loopback value
      // left by development therefore points at a service that does not exist
      // on the subscriber's machine and makes login/catalog/AI all look dead.
      if (isLoopback) return isLocalDev() ? LOCAL_API : PROD_API;
      if (parsed.protocol !== "https:") return isLocalDev() ? LOCAL_API : PROD_API;
      // The customer plugin has one canonical production API. Unknown or old
      // hosts are not allowed to persist forever in prefs after a migration.
      if (parsed.hostname !== "api.getframeflow.app") return PROD_API;
      return PROD_API;
    } catch (_) {
      return isLocalDev() ? LOCAL_API : PROD_API;
    }
  }

  return {
    defaultApi() {
      return isLocalDev() ? LOCAL_API : PROD_API;
    },
    defaultAdmin() {
      return isLocalDev() ? LOCAL_ADMIN : PROD_ADMIN;
    },
    sanitizeApi: sanitizeApi,
    prodApi: PROD_API,
    prodAdmin: PROD_ADMIN,
  };
})();
