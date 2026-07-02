/**
 * FrameFlow Studio — static dashboards (lokal + CF Pages)
 */
(function () {
  const loc = typeof window !== "undefined" ? window.location : null;
  const hostname = loc?.hostname ?? "";
  const port = loc?.port ?? "";
  const pathname = loc?.pathname ?? "";
  const origin = loc?.origin ?? "";

  const isLocalAdmin = hostname === "localhost" && port === "3001";
  const isLocalStudio = hostname === "localhost" && port === "3000";
  // Subdomen-asosli aniqlash (admin.getframeflow.app)
  const isAdminSubdomain = hostname.startsWith("admin.");
  const isOnlineAdminPath = pathname.startsWith("/admin") || isAdminSubdomain;
  const isAdminHost = isLocalAdmin || isOnlineAdminPath;

  const pathMatch = pathname.match(/^(.*\/studio)\//);
  const studioBase = pathMatch ? `${pathMatch[1]}/` : "/studio/";

  const base = isAdminHost
    ? isOnlineAdminPath
      ? "/admin/"
      : "/"
    : studioBase;

  const apiFromMeta =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="frameflow-api"]')?.getAttribute("content") ||
        document.querySelector('meta[name="assetflow-api"]')?.getAttribute("content")
      : null;

  const DEFAULT_ONLINE_API = "https://api.getframeflow.app";

  let apiUrl = apiFromMeta || DEFAULT_ONLINE_API;
  let mediaUrl = apiUrl;

  if (isLocalAdmin) {
    apiUrl = apiFromMeta || origin;
    mediaUrl = apiUrl;
  } else if (isLocalStudio) {
    apiUrl = apiFromMeta || "http://localhost:4000";
    mediaUrl = origin;
  } else if (!apiFromMeta) {
    apiUrl = DEFAULT_ONLINE_API;
    mediaUrl = apiUrl;
  }

  let contributorLoginUrl;
  let contributorUrl;
  let adminUrl;
  let adminLoginUrl;

  if (isLocalStudio || isLocalAdmin) {
    contributorLoginUrl = "http://localhost:3000/studio/login.html";
    contributorUrl = "http://localhost:3000/studio/contributor/";
    adminLoginUrl = "http://localhost:3001/login.html";
    adminUrl = "http://localhost:3001/";
  } else {
    contributorLoginUrl = `${origin}/studio/login.html`;
    contributorUrl = `${origin}/studio/contributor/`;
    adminLoginUrl = `${origin}/admin/login.html`;
    adminUrl = `${origin}/admin/`;
  }

  window.ASSETFLOW_STUDIO = {
    isAdminHost,
    base,
    apiUrl: apiUrl.replace(/\/$/, ""),
    mediaUrl: mediaUrl.replace(/\/$/, ""),
    loginUrl: isAdminHost ? adminLoginUrl : `${studioBase}login.html`.replace("//", "/"),
    adminUrl,
    contributorUrl,
    contributorLoginUrl,
    adminLoginUrl,
  };
})();
