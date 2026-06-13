/**
 * AssetFlow CEP — production API/admin (file:// panelda ham cloud ishlaydi)
 */
window.ASSETFLOW_ENV = (function () {
  const PROD_API = "https://assetflow-rqbq.onrender.com";
  const PROD_ADMIN = "https://assetflow-20j.pages.dev/admin/";
  const LOCAL_API = "http://localhost:4000";
  const LOCAL_ADMIN = "http://localhost:3001/";

  function isLocalDev() {
    try {
      if (typeof window === "undefined") return false;
      const h = window.location.hostname;
      return h === "localhost" || h === "127.0.0.1";
    } catch {
      return false;
    }
  }

  return {
    defaultApi() {
      return isLocalDev() ? LOCAL_API : PROD_API;
    },
    defaultAdmin() {
      return isLocalDev() ? LOCAL_ADMIN : PROD_ADMIN;
    },
    prodApi: PROD_API,
    prodAdmin: PROD_ADMIN,
  };
})();
