/**
 * AssetFlow Studio — monorepo static dashboards
 * Served from Next.js at /studio/*
 */
(function () {
  const isAdminHost =
    typeof window !== "undefined" && window.location.port === "3001";

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const match = path.match(/^(.*\/studio)\//);
  const studioBase = match ? `${match[1]}/` : "/studio/";

  const base = isAdminHost ? "/" : studioBase;

  const apiFromMeta =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="assetflow-api"]')?.getAttribute("content")
      : null;

  let apiUrl = apiFromMeta || "http://localhost:4000";
  let mediaUrl = apiUrl;
  if (typeof window !== "undefined") {
    const { hostname, port, origin } = window.location;
    if (hostname === "localhost" && port === "3001") {
      // Admin: /api proxy — video Range bir xil origin
      apiUrl = apiFromMeta || origin;
      mediaUrl = apiUrl;
    } else if (hostname === "localhost" && port === "3000") {
      apiUrl = apiFromMeta || "http://localhost:4000";
      mediaUrl = origin;
    }
  }

  window.ASSETFLOW_STUDIO = {
    isAdminHost,
    base,
    apiUrl: apiUrl.replace(/\/$/, ""),
    mediaUrl: mediaUrl.replace(/\/$/, ""),
    loginUrl: isAdminHost ? "/login.html" : `${studioBase}login.html`,
    adminUrl: isAdminHost ? "/" : `${studioBase}admin/`,
    contributorUrl: "http://localhost:3000/studio/contributor/",
    contributorLoginUrl: "http://localhost:3000/studio/login.html",
  };
})();
