/**
 * AssetFlow CEP — production API/admin (file:// panelda ham cloud ishlaydi)
 */
window.ASSETFLOW_ENV = (function () {
  const PROD_API = "https://assetflow-api-331762958776.europe-west1.run.app";
  const PROD_ADMIN = "https://assetflow-20j.pages.dev/admin/";
  const LOCAL_API = "http://localhost:4000";
  const LOCAL_ADMIN = "http://localhost:3001/";
  // Render'dan Cloud Run'ga ko'chishdan oldin login qilingan panellarda
  // prefs.json'da shu eski manzil saqlanib qolgan bo'lishi mumkin — kod
  // yangilangach ham bu qiymat doimiy ustun kelaveradi. Topilsa joriy
  // default'ga almashtiriladi (sanitizeApi).
  const STALE_APIS = ["https://assetflow-rqbq.onrender.com"];

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
    if (!url || typeof url !== "string") return url;
    const clean = url.replace(/\/$/, "");
    return STALE_APIS.includes(clean) ? (isLocalDev() ? LOCAL_API : PROD_API) : url;
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
