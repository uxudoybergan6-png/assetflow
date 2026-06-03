/**
 * AssetFlow storage — browser (IndexedDB) yoki AE CEP (disk, ikkala panel uchun umumiy).
 */
const AssetFlowStore = (() => {
  const DB_NAME = "assetflow_contributor";
  const DB_VERSION = 1;
  const STORE = "blobs";
  const META_KEY = "assetflow_contributor_meta";
  const STORAGE_GEN_KEY = "assetflow_storage_gen";
  const STORAGE_GEN = "2";
  const CEP_EVENT = "com.assetflow.demo.metaUpdated";

  let db = null;
  const blobUrls = new Map();
  let useDisk = false;
  let fs = null;
  let pathLib = null;
  let dataRoot = "";
  let blobDir = "";
  let metaPath = "";
  let genPath = "";

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function initDiskBackend() {
    if (useDisk || typeof window === "undefined" || !window.__adobe_cep__) return useDisk;
    try {
      fs = require("fs");
      pathLib = require("path");
      const extPath = new CSInterface().getSystemPath(SystemPath.EXTENSION);
      dataRoot = pathLib.join(extPath, "assetflow-data");
      blobDir = pathLib.join(dataRoot, "blobs");
      metaPath = pathLib.join(dataRoot, "meta.json");
      genPath = pathLib.join(dataRoot, ".storage-gen");
      fs.mkdirSync(blobDir, { recursive: true });
      useDisk = true;
    } catch (e) {
      console.warn("AssetFlow disk store unavailable", e);
    }
    return useDisk;
  }

  function readGenFlag() {
    if (useDisk && fs.existsSync(genPath)) return fs.readFileSync(genPath, "utf8");
    try {
      return localStorage.getItem(STORAGE_GEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function writeGenFlag(value) {
    if (useDisk) fs.writeFileSync(genPath, value, "utf8");
    else localStorage.setItem(STORAGE_GEN_KEY, value);
  }

  function notifyMetaUpdated() {
    window.dispatchEvent(new CustomEvent("assetflow:meta-updated"));
    if (typeof window.__adobe_cep__ !== "undefined" && typeof CSInterface !== "undefined") {
      try {
        const cs = new CSInterface();
        const ev = new CSEvent(CEP_EVENT, "APPLICATION", "AEFT");
        cs.dispatchEvent(ev);
      } catch (e) {}
    }
  }

  function openDb() {
    initDiskBackend();
    if (useDisk) return Promise.resolve(null);
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        db = req.result;
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function listMeta() {
    initDiskBackend();
    if (useDisk) {
      try {
        if (!fs.existsSync(metaPath)) return [];
        return JSON.parse(fs.readFileSync(metaPath, "utf8"));
      } catch {
        return [];
      }
    }
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveMeta(items) {
    initDiskBackend();
    if (useDisk) fs.writeFileSync(metaPath, JSON.stringify(items), "utf8");
    else localStorage.setItem(META_KEY, JSON.stringify(items));
    notifyMetaUpdated();
  }

  async function blobToBuffer(blob) {
    const ab = await blob.arrayBuffer();
    if (typeof Buffer !== "undefined") return Buffer.from(ab);
    return ab;
  }

  async function putBlob(id, blob, type) {
    await openDb();
    if (useDisk) {
      const buf = await blobToBuffer(blob);
      fs.writeFileSync(pathLib.join(blobDir, id), buf);
      fs.writeFileSync(pathLib.join(blobDir, `${id}.type`), type || blob.type || "application/octet-stream", "utf8");
      return id;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ id, blob, type, createdAt: Date.now() });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getBlob(id) {
    if (!id) return null;
    await openDb();
    if (useDisk) {
      const filePath = pathLib.join(blobDir, id);
      if (!fs.existsSync(filePath)) return null;
      const typePath = pathLib.join(blobDir, `${id}.type`);
      const type = fs.existsSync(typePath)
        ? fs.readFileSync(typePath, "utf8")
        : "application/octet-stream";
      const buf = fs.readFileSync(filePath);
      return new Blob([buf], { type });
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result?.blob || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteBlob(id) {
    if (!id) return;
    if (blobUrls.has(id)) {
      URL.revokeObjectURL(blobUrls.get(id));
      blobUrls.delete(id);
    }
    await openDb();
    if (useDisk) {
      const filePath = pathLib.join(blobDir, id);
      const typePath = pathLib.join(blobDir, `${id}.type`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(typePath)) fs.unlinkSync(typePath);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function getBlobUrl(id) {
    if (!id) return "";
    if (blobUrls.has(id)) return blobUrls.get(id);
    return "";
  }

  async function hydrateBlobUrls(metaList) {
    await openDb();
    const ids = new Set();
    metaList.forEach((item) => {
      [item.thumbBlobId, item.previewBlobId].forEach((bid) => {
        if (bid) ids.add(bid);
      });
      (item.scenes || []).forEach((scene) => {
        if (scene.previewBlobId) ids.add(scene.previewBlobId);
      });
    });
    await Promise.all(
      [...ids].map(async (id) => {
        if (blobUrls.has(id)) return;
        const blob = await getBlob(id);
        if (blob) blobUrls.set(id, URL.createObjectURL(blob));
      })
    );
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i += 1;
    }
    return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function defaultScenes(name) {
    const base = name || "Scene";
    return [1, 2, 3, 4].map((n, i) => ({
      n: `${base} ${String(n).padStart(2, "0")}`,
      meta: "MOGRT · 4K",
      ico: "✦",
      bg: ["#312e81", "#4338ca", "#4f46e5", "#6366f1"][i],
    }));
  }

  function previewKindFromFile(file, fallback) {
    if (!file) return fallback || "video";
    return file.type.startsWith("image/") ? "image" : "video";
  }

  function stripScenePayload(scene) {
    const next = { n: scene.n, meta: scene.meta, ico: scene.ico, bg: scene.bg };
    if (scene.previewBlobId) next.previewBlobId = scene.previewBlobId;
    if (scene.previewKind) next.previewKind = scene.previewKind;
    if (scene.aeComp) next.aeComp = scene.aeComp;
    return next;
  }

  async function persistScenes(scenes) {
    const saved = [];
    for (const scene of scenes || []) {
      const next = stripScenePayload(scene);
      if (scene.previewFile) {
        next.previewBlobId = uid("scene_preview");
        next.previewKind = previewKindFromFile(scene.previewFile, scene.previewKind);
        await putBlob(next.previewBlobId, scene.previewFile, scene.previewFile.type);
      }
      saved.push(next);
    }
    return saved;
  }

  async function mergeScenes(oldScenes, newScenes) {
    const keptBlobIds = new Set();
    const merged = [];
    for (let i = 0; i < (newScenes || []).length; i += 1) {
      const scene = { ...(newScenes[i] || {}) };
      const old = oldScenes?.[i];
      if (scene.previewFile) {
        if (scene.previewBlobId) await deleteBlob(scene.previewBlobId);
        else if (old?.previewBlobId) await deleteBlob(old.previewBlobId);
        scene.previewBlobId = uid("scene_preview");
        scene.previewKind = previewKindFromFile(scene.previewFile, scene.previewKind);
        await putBlob(scene.previewBlobId, scene.previewFile, scene.previewFile.type);
      } else if (!scene.previewBlobId && old?.previewBlobId) {
        scene.previewBlobId = old.previewBlobId;
        scene.previewKind = scene.previewKind || old.previewKind;
      }
      const next = stripScenePayload(scene);
      if (next.previewBlobId) keptBlobIds.add(next.previewBlobId);
      merged.push(next);
    }
    await Promise.all(
      (oldScenes || [])
        .filter((old) => old.previewBlobId && !keptBlobIds.has(old.previewBlobId))
        .map((old) => deleteBlob(old.previewBlobId))
    );
    return merged;
  }

  async function addUpload(payload, files) {
    await openDb();
    const id = uid("contrib");
    const thumbBlobId = files.thumb ? uid("thumb") : null;
    const previewBlobId = files.preview ? uid("preview") : null;
    const fileBlobId = files.template ? uid("file") : null;

    if (files.thumb) await putBlob(thumbBlobId, files.thumb, files.thumb.type);
    if (files.preview) await putBlob(previewBlobId, files.preview, files.preview.type);
    if (files.template) await putBlob(fileBlobId, files.template, files.template.type);

    const scenes = payload.scenes?.length ? await persistScenes(payload.scenes) : [];

    const record = {
      id,
      name: payload.name.trim(),
      description: (payload.description || "").trim(),
      nav: payload.nav,
      cat: payload.cat,
      catLabel: payload.catLabel,
      orient: payload.orient || "horizontal",
      res: payload.res || "4k",
      icon: payload.icon || "✦",
      bg: payload.bg || "linear-gradient(135deg,#312e81,#6366f1)",
      tags: payload.tags || [],
      published: payload.published !== false,
      nw: !!payload.nw,
      scenes,
      thumbBlobId,
      previewBlobId,
      fileBlobId,
      fileName: files.template?.name || "",
      fileSize: files.template?.size || 0,
      assetType: payload.assetType || payload.nav,
      templateApp: payload.templateApp || null,
      extra: payload.extra || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const items = listMeta();
    items.unshift(record);
    saveMeta(items);
    await hydrateBlobUrls([record]);
    return record;
  }

  async function updateUpload(id, patch, files) {
    const items = listMeta();
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error("Upload not found");
    const current = items[idx];

    if (files?.thumb) {
      if (current.thumbBlobId) await deleteBlob(current.thumbBlobId);
      current.thumbBlobId = uid("thumb");
      await putBlob(current.thumbBlobId, files.thumb, files.thumb.type);
    } else if (files?.clearThumb) {
      if (current.thumbBlobId) await deleteBlob(current.thumbBlobId);
      current.thumbBlobId = null;
    }
    if (files?.preview) {
      if (current.previewBlobId) await deleteBlob(current.previewBlobId);
      current.previewBlobId = uid("preview");
      await putBlob(current.previewBlobId, files.preview, files.preview.type);
    } else if (files?.clearPreview) {
      if (current.previewBlobId) await deleteBlob(current.previewBlobId);
      current.previewBlobId = null;
    }
    if (files?.template) {
      if (current.fileBlobId) await deleteBlob(current.fileBlobId);
      current.fileBlobId = uid("file");
      await putBlob(current.fileBlobId, files.template, files.template.type);
      current.fileName = files.template.name;
      current.fileSize = files.template.size;
    }

    if (patch.scenes) patch.scenes = await mergeScenes(current.scenes, patch.scenes);

    Object.assign(
      current,
      {
        ...patch,
        nw: patch.nw !== undefined ? !!patch.nw : current.nw,
        published: patch.published !== undefined ? patch.published !== false : current.published,
      },
      { updatedAt: new Date().toISOString() }
    );
    items[idx] = current;
    saveMeta(items);
    await hydrateBlobUrls([current]);
    return current;
  }

  async function deleteUpload(id) {
    const items = listMeta();
    const item = items.find((x) => x.id === id);
    if (!item) return;
    await Promise.all([
      deleteBlob(item.thumbBlobId),
      deleteBlob(item.previewBlobId),
      deleteBlob(item.fileBlobId),
      ...(item.scenes || []).map((scene) => deleteBlob(scene.previewBlobId)),
    ]);
    saveMeta(items.filter((x) => x.id !== id));
  }

  async function clearAll() {
    await openDb();
    const items = listMeta();
    await Promise.all(items.map((item) => deleteUpload(item.id)));
    if (useDisk && fs.existsSync(blobDir)) {
      for (const name of fs.readdirSync(blobDir)) {
        fs.unlinkSync(pathLib.join(blobDir, name));
      }
    } else if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    blobUrls.forEach((url) => URL.revokeObjectURL(url));
    blobUrls.clear();
    saveMeta([]);
  }

  async function ensureStorageGeneration() {
    await openDb();
    if (readGenFlag() === STORAGE_GEN) return false;
    await clearAll();
    writeGenFlag(STORAGE_GEN);
    return true;
  }

  async function togglePublished(id) {
    const items = listMeta();
    const item = items.find((x) => x.id === id);
    if (!item) return null;
    item.published = !item.published;
    item.updatedAt = new Date().toISOString();
    saveMeta(items);
    return item;
  }

  function collectBlobIds(items) {
    const ids = new Set();
    (items || []).forEach((item) => {
      [item.thumbBlobId, item.previewBlobId, item.fileBlobId].forEach((id) => {
        if (id) ids.add(id);
      });
      (item.scenes || []).forEach((scene) => {
        if (scene.previewBlobId) ids.add(scene.previewBlobId);
      });
    });
    return [...ids];
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        resolve(typeof result === "string" ? result.split(",")[1] : "");
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function base64ToBlob(base64, type) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || "application/octet-stream" });
  }

  async function exportDemoPack() {
    await openDb();
    const items = listMeta();
    const blobs = {};
    await Promise.all(
      collectBlobIds(items).map(async (id) => {
        const blob = await getBlob(id);
        if (!blob) return;
        blobs[id] = {
          type: blob.type || "application/octet-stream",
          data: await blobToBase64(blob),
        };
      })
    );
    return {
      version: 1,
      app: "AssetFlow Demo",
      exportedAt: new Date().toISOString(),
      itemCount: items.length,
      blobCount: Object.keys(blobs).length,
      items,
      blobs,
    };
  }

  async function importDemoPack(payload, { replace = true } = {}) {
    if (!payload || !Array.isArray(payload.items)) throw new Error("Invalid demo pack");
    await openDb();
    if (replace) {
      const existing = listMeta();
      await Promise.all(existing.map((item) => deleteUpload(item.id)));
    }
    const blobEntries = Object.entries(payload.blobs || {});
    for (const [id, entry] of blobEntries) {
      const blob = base64ToBlob(entry.data, entry.type);
      await putBlob(id, blob, entry.type || blob.type);
    }
    const existing = replace ? [] : listMeta();
    const merged = replace
      ? payload.items
      : [...payload.items, ...existing.filter((e) => !payload.items.some((p) => p.id === e.id))];
    saveMeta(merged);
    await hydrateBlobUrls(merged);
    return { items: merged.length, blobs: blobEntries.length };
  }

  function exportMetaJson() {
    return JSON.stringify(listMeta(), null, 2);
  }

  async function importMetaJson(text) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Invalid JSON");
    const existing = listMeta();
    const merged = [...parsed, ...existing.filter((e) => !parsed.some((p) => p.id === e.id))];
    saveMeta(merged);
    await hydrateBlobUrls(merged);
    return merged.length;
  }

  function getExportsDir() {
    initDiskBackend();
    if (!useDisk) return null;
    const dir = pathLib.join(dataRoot, "exports");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async function exportBlobToPath(blobId, fileName) {
    await openDb();
    if (!useDisk) throw new Error("Fayl eksporti faqat AE panelida");
    const blob = await getBlob(blobId);
    if (!blob) throw new Error("Fayl topilmadi");
    const dir = getExportsDir();
    const safe = (fileName || blobId).replace(/[/\\?%*:|"<>]/g, "_");
    const outPath = pathLib.join(dir, safe);
    fs.writeFileSync(outPath, await blobToBuffer(blob));
    return outPath;
  }

  async function prepareImportFile(blobId, fileName) {
    const outPath = await exportBlobToPath(blobId, fileName || "template.aep");
    if (!/\.zip$/i.test(outPath)) return outPath;
    const { execSync } = require("child_process");
    const dest = pathLib.join(pathLib.dirname(outPath), `extract_${Date.now()}`);
    fs.mkdirSync(dest, { recursive: true });
    execSync(`unzip -o -q ${JSON.stringify(outPath)} -d ${JSON.stringify(dest)}`, { stdio: "pipe" });
    const findAep = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = pathLib.join(dir, name);
        if (fs.statSync(p).isDirectory()) {
          const nested = findAep(p);
          if (nested) return nested;
        } else if (/\.aep$/i.test(name)) return p;
      }
      return null;
    };
    const aep = findAep(dest);
    if (!aep) throw new Error("Zip ichida .aep topilmadi");
    return aep;
  }

  function loadPrefs() {
    initDiskBackend();
    const defaults = { favorites: [], downloaded: [], client: null };
    if (useDisk) {
      const p = pathLib.join(dataRoot, "prefs.json");
      if (!fs.existsSync(p)) return defaults;
      try {
        return { ...defaults, ...JSON.parse(fs.readFileSync(p, "utf8")) };
      } catch {
        return defaults;
      }
    }
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem("assetflow_prefs") || "{}") };
    } catch {
      return defaults;
    }
  }

  function savePrefs(prefs) {
    initDiskBackend();
    const payload = JSON.stringify(prefs, null, 2);
    if (useDisk) fs.writeFileSync(pathLib.join(dataRoot, "prefs.json"), payload, "utf8");
    else localStorage.setItem("assetflow_prefs", payload);
  }

  return {
    META_KEY,
    STORAGE_GEN_KEY,
    CEP_EVENT,
    init: openDb,
    listMeta,
    saveMeta,
    getBlob,
    getBlobUrl,
    hydrateBlobUrls,
    addUpload,
    updateUpload,
    deleteUpload,
    clearAll,
    ensureStorageGeneration,
    togglePublished,
    exportMetaJson,
    importMetaJson,
    exportDemoPack,
    importDemoPack,
    exportBlobToPath,
    prepareImportFile,
    loadPrefs,
    savePrefs,
    formatBytes,
    defaultScenes,
    usesDiskStorage: () => initDiskBackend(),
  };
})();

if (typeof window !== "undefined") {
  window.AssetFlowStore = AssetFlowStore;
}
