/**
 * Brauzer → AE plugin: bir xil assetflow-data papkasi (File System Access API).
 * Keyin server provider shu formatni saqlab qoladi.
 */
const AssetFlowPluginDisk = (() => {
  const HANDLE_DB = "assetflow_handle_db";
  const HANDLE_KEY = "pluginDataRoot";
  const STORAGE_GEN = "2";

  let rootHandle = null;
  const blobUrls = new Map();

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async function openHandleDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(HANDLE_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveRootHandle(handle) {
    const db = await openHandleDb();
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(handle, HANDLE_KEY);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    rootHandle = handle;
  }

  async function restoreRootHandle() {
    if (rootHandle) return rootHandle;
    const db = await openHandleDb();
    const handle = await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readonly");
      const r = tx.objectStore("kv").get(HANDLE_KEY);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (!handle) return null;
    const ok = await verifyPermission(handle, true);
    if (!ok) return null;
    rootHandle = handle;
    return handle;
  }

  async function verifyPermission(handle, write = false) {
    const opts = { mode: write ? "readwrite" : "read" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    return (await handle.requestPermission(opts)) === "granted";
  }

  async function linkPluginFolder() {
    if (!window.showDirectoryPicker) {
      throw new Error("Chrome/Edge required (folder selection not supported)");
    }
    const handle = await window.showDirectoryPicker({
      id: "assetflow-plugin-data",
      mode: "readwrite",
      startIn: "documents",
    });
    await verifyPermission(handle, true);
    await saveRootHandle(handle);
    await ensureLayout(handle);
    return handle;
  }

  async function ensureLayout(handle) {
    await handle.getDirectoryHandle("blobs", { create: true });
    try {
      await handle.getFileHandle("meta.json", { create: true });
    } catch {
      /* */
    }
    try {
      const gen = await handle.getFileHandle(".storage-gen", { create: true });
      const w = await gen.createWritable();
      await w.write(STORAGE_GEN);
      await w.close();
    } catch {
      /* */
    }
  }

  function isLinked() {
    return !!rootHandle;
  }

  async function getFileHandle(name, create = false) {
    if (!rootHandle) throw new Error("Plugin folder not linked");
    return rootHandle.getFileHandle(name, { create });
  }

  async function getBlobsDir(create = true) {
    if (!rootHandle) throw new Error("Plugin folder not linked");
    return rootHandle.getDirectoryHandle("blobs", { create });
  }

  async function readTextFile(name) {
    try {
      const fh = await getFileHandle(name);
      const file = await fh.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  async function writeTextFile(name, text) {
    const fh = await getFileHandle(name, true);
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
    await touchSync();
  }

  async function touchSync() {
    try {
      const fh = await getFileHandle(".last-sync", true);
      const w = await fh.createWritable();
      await w.write(String(Date.now()));
      await w.close();
    } catch {
      /* */
    }
  }

  async function putBlob(id, blob, type) {
    const dir = await getBlobsDir(true);
    const fh = await dir.getFileHandle(id, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    try {
      const th = await dir.getFileHandle(`${id}.type`, { create: true });
      const tw = await th.createWritable();
      await tw.write(type || blob.type || "application/octet-stream");
      await tw.close();
    } catch {
      /* */
    }
    if (blobUrls.has(id)) URL.revokeObjectURL(blobUrls.get(id));
    blobUrls.set(id, URL.createObjectURL(blob));
    return id;
  }

  async function getBlob(id) {
    if (!id) return null;
    try {
      const dir = await getBlobsDir(false);
      const file = await (await dir.getFileHandle(id)).getFile();
      let type = file.type;
      try {
        const t = await (await dir.getFileHandle(`${id}.type`)).getFile();
        type = (await t.text()) || type;
      } catch {
        /* */
      }
      return new Blob([await file.arrayBuffer()], { type });
    } catch {
      return null;
    }
  }

  async function deleteBlob(id) {
    if (!id) return;
    if (blobUrls.has(id)) {
      URL.revokeObjectURL(blobUrls.get(id));
      blobUrls.delete(id);
    }
    try {
      const dir = await getBlobsDir(false);
      await dir.removeEntry(id);
      try {
        await dir.removeEntry(`${id}.type`);
      } catch {
        /* */
      }
    } catch {
      /* */
    }
  }

  function getBlobUrl(id) {
    return blobUrls.get(id) || "";
  }

  async function hydrateBlobUrls(items) {
    for (const item of items || []) {
      const ids = [
        item.thumbBlobId,
        item.previewBlobId,
        item.fileBlobId,
        ...(item.scenes || []).map((s) => s.previewBlobId),
      ].filter(Boolean);
      for (const id of ids) {
        if (blobUrls.has(id)) continue;
        const blob = await getBlob(id);
        if (blob) blobUrls.set(id, URL.createObjectURL(blob));
      }
    }
  }

  async function listMeta() {
    const raw = await readTextFile("meta.json");
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async function saveMeta(items) {
    await writeTextFile("meta.json", JSON.stringify(items));
  }

  function stripScene(scene) {
    const next = { n: scene.n, meta: scene.meta, ico: scene.ico, bg: scene.bg };
    if (scene.previewBlobId) next.previewBlobId = scene.previewBlobId;
    if (scene.previewKind) next.previewKind = scene.previewKind;
    return next;
  }

  async function persistScenes(scenes) {
    const out = [];
    for (const scene of scenes || []) {
      const next = stripScene(scene);
      if (scene.previewFile) {
        next.previewBlobId = uid("scene_preview");
        next.previewKind = scene.previewFile.type.startsWith("image/") ? "image" : "video";
        await putBlob(next.previewBlobId, scene.previewFile, scene.previewFile.type);
      }
      out.push(next);
    }
    return out;
  }

  async function addUpload(payload, files = {}) {
    const id = uid("contrib");
    let thumbBlobId = null;
    let previewBlobId = null;
    let fileBlobId = null;
    if (files.thumb) {
      thumbBlobId = uid("thumb");
      await putBlob(thumbBlobId, files.thumb, files.thumb.type);
    }
    if (files.preview) {
      previewBlobId = uid("preview");
      await putBlob(previewBlobId, files.preview, files.preview.type);
    }
    if (files.template) {
      fileBlobId = uid("file");
      await putBlob(fileBlobId, files.template, files.template.type);
    }
    const scenes = payload.scenes?.length ? await persistScenes(payload.scenes) : [];
    const record = {
      id,
      name: payload.name.trim(),
      description: (payload.description || "").trim(),
      nav: payload.nav || "video",
      cat: payload.cat,
      catLabel: payload.catLabel,
      orient: payload.orient || "horizontal",
      res: payload.res || "4k",
      icon: payload.icon || "✦",
      bg: payload.bg || "linear-gradient(135deg,#312e81,#6366f1)",
      tags: payload.tags || [],
      published: payload.published !== false,
      scenes,
      thumbBlobId,
      previewBlobId,
      fileBlobId,
      fileName: files.template?.name || "",
      fileSize: files.template?.size || 0,
      templateApp: payload.templateApp || "ae",
      extra: payload.extra || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const items = await listMeta();
    items.unshift(record);
    await saveMeta(items);
    await hydrateBlobUrls([record]);
    return record;
  }

  async function updateUpload(id, patch, files = {}) {
    const items = await listMeta();
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error("Not found");
    const cur = items[idx];
    if (files.thumb) {
      if (cur.thumbBlobId) await deleteBlob(cur.thumbBlobId);
      cur.thumbBlobId = uid("thumb");
      await putBlob(cur.thumbBlobId, files.thumb, files.thumb.type);
    }
    if (files.preview) {
      if (cur.previewBlobId) await deleteBlob(cur.previewBlobId);
      cur.previewBlobId = uid("preview");
      await putBlob(cur.previewBlobId, files.preview, files.preview.type);
    }
    if (files.template) {
      if (cur.fileBlobId) await deleteBlob(cur.fileBlobId);
      cur.fileBlobId = uid("file");
      await putBlob(cur.fileBlobId, files.template, files.template.type);
      cur.fileName = files.template.name;
      cur.fileSize = files.template.size;
    }
    if (patch.scenes) patch.scenes = await persistScenes(patch.scenes);
    Object.assign(cur, patch, { updatedAt: new Date().toISOString() });
    items[idx] = cur;
    await saveMeta(items);
    await hydrateBlobUrls([cur]);
    return cur;
  }

  async function deleteUpload(id) {
    const items = await listMeta();
    const item = items.find((x) => x.id === id);
    if (!item) return;
    await Promise.all([
      deleteBlob(item.thumbBlobId),
      deleteBlob(item.previewBlobId),
      deleteBlob(item.fileBlobId),
      ...(item.scenes || []).map((s) => deleteBlob(s.previewBlobId)),
    ]);
    await saveMeta(items.filter((x) => x.id !== id));
  }

  const PLUGIN_DATA_HINT =
    "~/Library/Application Support/Adobe/CEP/extensions/com.frameflow/assetflow-data";

  return {
    PLUGIN_DATA_HINT,
    linkPluginFolder,
    restoreRootHandle,
    isLinked,
    listMeta,
    saveMeta,
    addUpload,
    updateUpload,
    deleteUpload,
    getBlob,
    getBlobUrl,
    hydrateBlobUrls,
    touchSync,
  };
})();

if (typeof window !== "undefined") window.AssetFlowPluginDisk = AssetFlowPluginDisk;
