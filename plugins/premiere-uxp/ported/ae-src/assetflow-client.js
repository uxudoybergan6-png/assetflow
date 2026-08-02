/**
 * AssetFlow — lokal kutubxona (meta.json + blobs) va server token (⚙).
 */
const AssetFlow = (() => {
  const Local = () => window.AssetFlowStore;
  const DEFAULT_API =
    typeof ASSETFLOW_ENV !== "undefined"
      ? ASSETFLOW_ENV.defaultApi()
      : "https://api.getframeflow.app";

  let apiBaseUrl = DEFAULT_API;
  let token = "";

  function loadConfig() {
    const c = Local().loadPrefs().client || {};
    apiBaseUrl = (c.apiBaseUrl || DEFAULT_API).replace(/\/$/, "");
    token = (c.token || "").trim();
  }

  function hasCloud() {
    return !!(apiBaseUrl && token);
  }

  async function init() {
    loadConfig();
    await Local().init();
    await Local().ensureStorageGeneration();
    return { hasCloud: hasCloud() };
  }

  const passthrough = [
    "listMeta",
    "saveMeta",
    "getBlob",
    "getBlobUrl",
    "hydrateBlobUrls",
    "clearAll",
    "togglePublished",
    "exportMetaJson",
    "importMetaJson",
    "exportDemoPack",
    "importDemoPack",
    "exportBlobToPath",
    "prepareImportFile",
    "loadPrefs",
    "savePrefs",
    "formatBytes",
    "defaultScenes",
    "usesDiskStorage",
    "ensureStorageGeneration",
    "addUpload",
    "updateUpload",
    "deleteUpload",
  ];

  const api = {
    init,
    hasCloud,
    isCloudEnabled: hasCloud,
  };

  passthrough.forEach((name) => {
    api[name] = (...args) => Local()[name](...args);
  });

  Object.defineProperties(api, {
    META_KEY: { get: () => Local().META_KEY },
    CEP_EVENT: { get: () => Local().CEP_EVENT },
    STORAGE_GEN_KEY: { get: () => Local().STORAGE_GEN_KEY },
  });

  return api;
})();

if (typeof window !== "undefined") window.AssetFlow = AssetFlow;
