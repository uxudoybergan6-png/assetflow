/**
 * Server katalog — tasdiqlangan shablonlar (API)
 */
const AssetFlowCatalog = (() => {
  const DEFAULT_API =
    typeof ASSETFLOW_ENV !== "undefined"
      ? ASSETFLOW_ENV.defaultApi()
      : "https://assetflow-rqbq.onrender.com";
  let countByNav = { video: 0, motion: 0, graphics: 0, luts: 0 };

  function apiBase() {
    if (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.apiUrl) {
      return window.ASSETFLOW_STUDIO.apiUrl.replace(/\/$/, "");
    }
    if (typeof AssetFlowStore !== "undefined") {
      const c = AssetFlowStore.loadPrefs?.().client || {};
      if (c.apiBaseUrl) return String(c.apiBaseUrl).replace(/\/$/, "");
    }
    return DEFAULT_API;
  }

  function catalogHeaders() {
    const h = { Accept: "application/json" };
    if (typeof AssetFlowAccount !== "undefined") {
      Object.assign(h, AssetFlowAccount.authHeaders());
    }
    return h;
  }

  /** Barqaror sozlamalar fayli yo'li (~/Library/Application Support/AssetFlow/settings.json) */
  function settingsFilePath() {
    if (typeof window.__adobe_cep__ === "undefined") return "";
    try {
      const path = require("path");
      const os = require("os");
      const fs = require("fs");
      const dir = path.join(os.homedir(), "Library", "Application Support", "AssetFlow");
      fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, "settings.json");
    } catch {
      return "";
    }
  }

  function readSettings() {
    const p = settingsFilePath();
    if (!p) return {};
    try {
      const fs = require("fs");
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
    } catch {
      return {};
    }
  }

  function writeSettings(patch) {
    const p = settingsFilePath();
    if (!p) return false;
    try {
      const fs = require("fs");
      const cur = readSettings();
      fs.writeFileSync(p, JSON.stringify({ ...cur, ...patch }, null, 2), "utf8");
      return true;
    } catch {
      return false;
    }
  }

  /** Saqlangan yuklab olish papkasi (settings.json yoki eski prefs) */
  function configuredDownloadDir() {
    const s = readSettings();
    if (s && s.downloadDir) return String(s.downloadDir);
    // Eski joy — prefs.client.downloadDir (migratsiya)
    if (typeof AssetFlowStore !== "undefined") {
      const c = AssetFlowStore.loadPrefs?.().client || {};
      if (c.downloadDir) return String(c.downloadDir);
    }
    return "";
  }

  /** Yuklab olingan shablonlar saqlanadigan papka — sozlamadan yoki tmpdir */
  function downloadDir() {
    const base = configuredDownloadDir();
    if (typeof window.__adobe_cep__ === "undefined") return base;
    const fs = require("fs");
    const os = require("os");
    if (base) {
      try {
        if (fs.existsSync(base)) return base;
        fs.mkdirSync(base, { recursive: true });
        return base;
      } catch {
        /* yozib bo'lmadi — tmpdir'ga qaytamiz */
      }
    }
    return os.tmpdir();
  }

  /** Yuklab olish papkasini barqaror faylga saqlaydi */
  function saveDownloadDir(dir) {
    writeSettings({ downloadDir: dir || "" });
  }

  async function fetchCatalog() {
    const res = await fetch(`${apiBase()}/api/plugin/catalog`, {
      headers: catalogHeaders(),
    });
    if (!res.ok) throw new Error(`Katalog HTTP ${res.status}`);
    return res.json();
  }

  async function fetchFeatured(limit = 6) {
    const res = await fetch(`${apiBase()}/api/plugin/featured?limit=${limit}`, {
      headers: catalogHeaders(),
    });
    if (!res.ok) throw new Error(`Featured HTTP ${res.status}`);
    return res.json();
  }

  /** Featured shablonlarni server assetlarida `nw` (NEW/Featured) bilan belgilash */
  function markFeatured(items) {
    const assets = browseAssets();
    if (!assets) return 0;
    const ids = new Set((items || []).map((i) => i.id));
    assets.forEach((a) => {
      if (a.server && a.serverTemplateId) {
        a.nw = ids.has(a.serverTemplateId) ? 1 : 0;
      }
    });
    return ids.size;
  }

  async function refreshFeatured(limit = 6) {
    try {
      const data = await fetchFeatured(limit);
      return markFeatured(data.items || []);
    } catch (e) {
      console.warn("AssetFlow: featured", e);
      return 0;
    }
  }

  function browseAssets() {
    return typeof window !== "undefined" ? window.assets : undefined;
  }

  function browsePacks() {
    return typeof window !== "undefined" ? window.packs : undefined;
  }

  function clearServerFromBrowse() {
    const assets = browseAssets();
    const packs = browsePacks();
    if (!assets || !packs) return;
    for (let i = assets.length - 1; i >= 0; i--) {
      if (assets[i].server) assets.splice(i, 1);
    }
    Object.keys(packs).forEach((k) => {
      if (packs[k].server) delete packs[k];
    });
  }

  function mergeIntoBrowse(items) {
    if (!window.__afBrowseReady) {
      console.warn("AssetFlow: browse init kutilmoqda");
      return 0;
    }
    const assets = browseAssets();
    const packs = browsePacks();
    if (!assets || !packs) {
      console.warn("AssetFlow: assets/packs yo'q");
      return 0;
    }
    countByNav = { video: 0, motion: 0, graphics: 0, luts: 0 };
    if (!items?.length) return 0;
    clearServerFromBrowse();
    const NAV_LABELS_REF =
      typeof NAV_LABELS !== "undefined"
        ? NAV_LABELS
        : { video: "Templates", motion: "Motion", graphics: "Graphics", luts: "LUTs" };

    items.forEach((u) => {
      const packKey = "__srv_" + u.id;
      const navKey = u.nav || "video";
      if (countByNav[navKey] !== undefined) countByNav[navKey]++;
      else countByNav.video++;
      const thumb = u.thumbUrl || "";
      const preview = u.previewUrl || "";
      const resLabel = (u.res || "4k").toUpperCase();
      const meta =
        u.metaJson && typeof u.metaJson === "object" && !Array.isArray(u.metaJson)
          ? u.metaJson
          : {};
      const metaScenes = Array.isArray(meta.scenes) ? meta.scenes : [];
      const scenes = metaScenes.length
        ? metaScenes.map((s) => ({
            n: s.n || s.name || u.name,
            aeComp: s.aeComp || s.compName || s.name || s.n || "",
            meta: s.meta || resLabel,
            ico: s.ico || u.icon || "✦",
            bg: s.bg || u.bg,
            preview: s.preview || preview || undefined,
            previewKind: s.previewKind || undefined,
          }))
        : [
            {
              n: u.name,
              aeComp: "",
              meta: resLabel,
              ico: u.icon || "✦",
              bg: u.bg,
              preview: preview || undefined,
            },
          ];
      packs[packKey] = {
        ico: u.icon || "✦",
        bg: u.bg,
        displayName: u.name,
        sub: `${NAV_LABELS_REF[u.nav] || u.nav} · ${u.catLabel} · ${resLabel}`,
        preview: preview || undefined,
        scenes,
        aeScenesFolder: meta.scenesFolder || meta.aeScenesFolder || "Scenes",
        server: true,
        serverTemplateId: u.id,
        hasPack: u.hasPack !== false,
        serverPackUrl: u.packUrl || undefined,
        fileSize: u.fileSize || 0,
        fileName: u.hasPack ? u.fileName || "template.aep" : "template.aep",
        templateApp: u.templateApp || "ae",
        catLabel: u.catLabel,
        orient: u.orient,
        res: u.res,
        nav: u.nav,
        description: (u.description || "").trim(),
      };
      assets.push({
        n: packKey,
        displayName: u.name,
        t: u.catLabel,
        catLabel: u.catLabel,
        i: u.icon || "✦",
        nav: u.nav || "video",
        cat: u.cat,
        bg: u.bg,
        orient: u.orient || "horizontal",
        res: u.res || "4k",
        tags: u.tags || [],
        thumb: thumb || undefined,
        preview: preview || undefined,
        server: true,
        serverTemplateId: u.id,
        nw: 0,
        templateApp: u.templateApp || "ae",
      });
    });
    return items.length;
  }

  function serverCountForNav(nav) {
    return countByNav[nav] || 0;
  }

  function totalServerCount() {
    return Object.values(countByNav).reduce((a, b) => a + b, 0);
  }

  /** Birinchi server shablonlari bor bo'lim */
  function primaryServerNav() {
    for (const key of ["video", "motion", "graphics", "luts"]) {
      if (countByNav[key] > 0) return key;
    }
    return "video";
  }

  function navHint(nav) {
    const labels =
      typeof NAV_LABELS !== "undefined"
        ? NAV_LABELS
        : { video: "Video Templates", motion: "Motion", graphics: "Graphics", luts: "LUTs" };
    return labels[nav] || nav;
  }

  async function refreshBrowse() {
    let data;
    try {
      data = await fetchCatalog();
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (typeof showToast === "function") {
        showToast(
          "Server katalog xato: " + msg + " · API: " + apiBase(),
          "danger"
        );
      }
      throw e;
    }
    const n = mergeIntoBrowse(data.items || []);
    if (n > 0) await refreshFeatured();
    if (n > 0 && typeof window !== "undefined") {
      if (typeof buildCategoryMenu === "function") buildCategoryMenu(window.currentNav || "video");
      if (typeof render === "function") render();
      if (typeof updateServerNavBadges === "function") updateServerNavBadges();
    }
    return n;
  }

  function findServerPackMeta(templateId) {
    const packs = browsePacks();
    if (!packs) return { url: null, fileSize: 0 };
    for (const key of Object.keys(packs)) {
      const p = packs[key];
      if (p.serverTemplateId === templateId) {
        return {
          url: p.serverPackUrl || null,
          fileSize: p.fileSize || 0,
        };
      }
    }
    return { url: null, fileSize: 0 };
  }

  function findAepInDir(fs, path, rootDir) {
    const stack = [rootDir];
    while (stack.length) {
      const cur = stack.pop();
      try {
        for (const name of fs.readdirSync(cur)) {
          const p = path.join(cur, name);
          try {
            if (fs.statSync(p).isDirectory()) stack.push(p);
            else if (name.toLowerCase().endsWith(".aep")) return p;
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  function cachedFileOk(fs, filePath, expectedSize) {
    try {
      if (!fs.existsSync(filePath)) return false;
      const st = fs.statSync(filePath);
      if (st.size < 1024) return false;
      if (expectedSize > 0 && st.size !== expectedSize) return false;
      return true;
    } catch {
      return false;
    }
  }

  /** Katta packlar uchun diskka oqim bilan yuklash (xotiraga 200MB yig'masdan) */
  function downloadUrlToFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      const fs = require("fs");
      const lib = url.startsWith("https") ? require("https") : require("http");
      const go = (u, redirectsLeft) => {
        if (redirectsLeft <= 0) {
          reject(new Error("Redirect limit"));
          return;
        }
        lib
          .get(u, (res) => {
            if (
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              res.resume();
              go(res.headers.location, redirectsLeft - 1);
              return;
            }
            if (res.statusCode !== 200) {
              res.resume();
              reject(new Error(`Pack HTTP ${res.statusCode}`));
              return;
            }
            const total = parseInt(res.headers["content-length"], 10) || 0;
            let done = 0;
            let lastTime = 0;
            const ws = fs.createWriteStream(destPath);
            // Birinchi baytda darhol ko'rsatamiz, keyin har ~250ms (MB hisoblagich jonli bo'lsin)
            if (onProgress) onProgress(0, total);
            res.on("data", (chunk) => {
              done += chunk.length;
              if (onProgress) {
                const now = Date.now();
                if (now - lastTime > 250 || done === total) {
                  lastTime = now;
                  onProgress(done, total);
                }
              }
            });
            res.pipe(ws);
            ws.on("finish", () => resolve(destPath));
            ws.on("error", reject);
            res.on("error", reject);
          })
          .on("error", reject);
      };
      go(url, 8);
    });
  }

  async function downloadPackToTemp(templateId, fileName, opts) {
    if (typeof window.__adobe_cep__ === "undefined") {
      throw new Error("Faqat After Effects ichida import");
    }
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const child = require("child_process");
    const { Buffer: NodeBuffer } = require("buffer");
    const ext = path.extname(fileName || "") || ".aep";
    const baseDir = downloadDir() || os.tmpdir();
    const out = path.join(baseDir, `assetflow_${templateId}${ext}`);
    const meta = findServerPackMeta(templateId);
    const expectedSize = (opts && opts.fileSize) || meta.fileSize || 0;
    const onProgress = opts && opts.onProgress;

    // ZIP bo'lsa — unzip papkasini tekshiramiz (kesh)
    if (ext.toLowerCase() === ".zip") {
      const cacheDir = path.join(baseDir, `assetflow_${templateId}_unzipped`);
      if (fs.existsSync(cacheDir)) {
        const cached = findAepInDir(fs, path, cacheDir);
        if (cached) return cached;
      }
    } else if (cachedFileOk(fs, out, expectedSize)) {
      return out;
    }

    const needDownload =
      ext.toLowerCase() === ".zip"
        ? !cachedFileOk(fs, out, expectedSize)
        : !cachedFileOk(fs, out, expectedSize);

    if (needDownload) {
      const directUrl = (opts && opts.packUrl) || meta.url;
      const url =
        directUrl || `${apiBase()}/api/plugin/assets/${templateId}/pack`;
      if (typeof showToast === "function") {
        const mb =
          expectedSize > 0
            ? (expectedSize / 1048576).toFixed(0)
            : "?";
        showToast(`Pack yuklanmoqda (~${mb} MB)…`);
      }
      try {
        await downloadUrlToFile(url, out, onProgress);
      } catch (e) {
        if (directUrl && url === directUrl) {
          const fallback = `${apiBase()}/api/plugin/assets/${templateId}/pack`;
          await downloadUrlToFile(fallback, out, onProgress);
        } else {
          throw e;
        }
      }
      if (!cachedFileOk(fs, out, 0)) {
        throw new Error("Pack yuklanmadi yoki fayl bo'sh");
      }
    }

    // AE can't import .zip directly. If pack is a zip, extract and return first .aep inside.
    if (ext.toLowerCase() === ".zip") {
      const dir = path.join(baseDir, `assetflow_${templateId}_unzipped`);
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
      try {
        // macOS ships `unzip` by default.
        child.execFileSync("unzip", ["-o", out, "-d", dir], { timeout: 60_000 });
      } catch (e) {
        throw new Error("ZIP ochilmadi. Pack ichida .aep bo‘lishi kerak.");
      }
      const aep = findAepInDir(fs, path, dir);
      if (aep) {
        // Zip endi kerak emas — faqat ochilgan papka qoladi
        try {
          fs.rmSync(out, { force: true });
        } catch {}
        return aep;
      }
      throw new Error("ZIP ichida .aep topilmadi. Pack fayl noto‘g‘ri.");
    }

    return out;
  }

  return {
    apiBase,
    fetchCatalog,
    fetchFeatured,
    refreshFeatured,
    refreshBrowse,
    mergeIntoBrowse,
    downloadPackToTemp,
    downloadDir,
    configuredDownloadDir,
    saveDownloadDir,
    serverCountForNav,
    totalServerCount,
    primaryServerNav,
    navHint,
    getCountByNav: () => ({ ...countByNav }),
  };
})();

if (typeof window !== "undefined") window.AssetFlowCatalog = AssetFlowCatalog;
