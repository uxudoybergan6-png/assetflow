/**
 * Browse global state — boshqa skriptlardan OLDIN yuklanadi (TDZ yo'q)
 */
(function () {
  if (!Array.isArray(window.assets)) window.assets = [];
  if (!window.packs || typeof window.packs !== "object") window.packs = {};
  if (!(window.favorites instanceof Set)) window.favorites = new Set();
  if (!(window.downloaded instanceof Set)) window.downloaded = new Set();
  window.__afBrowseReady = true;
})();
