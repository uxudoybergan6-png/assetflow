/**
 * Contributor saqlash — hozir brauzer (IndexedDB).
 * Keyin: provider = "server" → obunachilar pluginida catalog.
 * AE plugin papkasi bilan aralashmaydi.
 */
const AssetFlowStorage = (() => {
  let provider = "browser";

  function store() {
    if (typeof AssetFlowStore === "undefined") throw new Error("AssetFlowStore not found");
    return AssetFlowStore;
  }

  async function init() {
    provider = "browser";
    await store().init();
    await store().ensureStorageGeneration();
    return { provider, linked: true };
  }

  /** Kelajak: POST /api/contributor/... + token */
  async function publishToServer() {
    return { ok: false, message: "Server publishing will be added later" };
  }

  return {
    init,
    publishToServer,
    get mode() {
      return provider;
    },
    isPluginLinked: () => false,
    listMeta: async () => store().listMeta(),
    saveMeta: async (items) => store().saveMeta(items),
    addUpload: async (p, f) => store().addUpload(p, f),
    updateUpload: async (id, p, f) => store().updateUpload(id, p, f),
    deleteUpload: async (id) => store().deleteUpload(id),
    getBlob: async (id) => store().getBlob(id),
    getBlobUrl: (id) => store().getBlobUrl(id),
    hydrateBlobUrls: async (items) => store().hydrateBlobUrls(items),
  };
})();

if (typeof window !== "undefined") window.AssetFlowStorage = AssetFlowStorage;
