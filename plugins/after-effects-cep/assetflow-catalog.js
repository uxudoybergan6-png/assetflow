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

  /** Pack/MOGRT yuklab olish uchun Authorization header (gate'langan route) */
  function downloadHeaders() {
    if (typeof AssetFlowAccount !== "undefined" && AssetFlowAccount.authHeaders) {
      const h = AssetFlowAccount.authHeaders();
      if (h && h.Authorization) return h;
    }
    return null;
  }

  /** 30s timeout bilan fetch — Render cold start cheksiz osilib qolmasin */
  function fetchWithTimeout(url, options, ms) {
    options = options || {};
    const timeout = ms || 30000;
    if (typeof AbortController === "undefined") {
      return fetch(url, options);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    return fetch(url, { ...options, signal: ctrl.signal })
      .catch((e) => {
        if (e && (e.name === "AbortError" || e.code === 20)) {
          const te = new Error("Server javob bermadi (vaqt tugadi)");
          te.timeout = true;
          throw te;
        }
        throw e;
      })
      .finally(() => clearTimeout(timer));
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

  /** Yuklab olish papkasini barqaror faylga saqlaydi. Muvaffaqiyatda true. */
  function saveDownloadDir(dir) {
    return writeSettings({ downloadDir: dir || "" });
  }

  async function fetchCatalog() {
    const res = await fetchWithTimeout(`${apiBase()}/api/plugin/catalog`, {
      headers: catalogHeaders(),
    });
    if (!res.ok) {
      // 401/403 — token eskirgan bo'lsa markaziy ushlagichga beramiz
      if (typeof AssetFlowAccount !== "undefined" && AssetFlowAccount.handleAuthFailure) {
        AssetFlowAccount.handleAuthFailure(res.status, !!AssetFlowAccount.token());
      }
      const err = new Error(`Katalog HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function fetchFeatured(limit = 6) {
    const res = await fetchWithTimeout(`${apiBase()}/api/plugin/featured?limit=${limit}`, {
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
            slug: s.slug || s.previewKey || undefined,
            mogrtUrl: s.mogrtUrl || undefined,
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
        // Saralash uchun haqiqiy sana (createdAt afzal, bo'lmasa updatedAt)
        createdAt: u.createdAt || u.updatedAt || "",
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
      if (typeof showToast === "function") {
        const friendly =
          typeof friendlyError === "function"
            ? friendlyError(e)
            : ((e && e.message) || String(e)) + " · API: " + apiBase();
        showToast(friendly, "error");
      }
      throw e;
    }
    const n = mergeIntoBrowse(data.items || []);
    // Server'dan o'chirilgan shablonlarni downloaded/importedScenes dan tozalash
    const serverIds = new Set((data.items || []).map((i) => i.id));
    if (typeof window !== "undefined" && window.downloaded instanceof Set) {
      for (const key of [...window.downloaded]) {
        if (!key.startsWith("__srv_")) continue;
        const id = key.slice(6);
        if (!serverIds.has(id)) {
          window.downloaded.delete(key);
          if (window.importedScenes instanceof Set) {
            const prefix = key + "::";
            for (const sk of [...window.importedScenes]) {
              if (sk === key || sk.startsWith(prefix)) window.importedScenes.delete(sk);
            }
          }
        }
      }
      if (typeof savePrefs === "function") savePrefs();
    }
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

  /** macOS zip axlati: __MACOSX papkasi va AppleDouble ._fayllar */
  function isJunkEntry(name) {
    return name.indexOf("._") === 0 || name === "__MACOSX" || name === ".DS_Store";
  }

  /**
   * ZIP ichidagi barcha fayllarni kengaytma bo'yicha filterlash — papka nomi muhim emas.
   * `unzip -Z1` barcha entry yo'llarini bir qatorda qaytaradi (portativ, tar kerak emas).
   */
  function listEntriesInZip(child, zipPath, extLower) {
    try {
      return child.execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8", timeout: 15_000 })
        .split("\n")
        .filter(e => e.trim().toLowerCase().endsWith(extLower) && !/(^|\/)__MACOSX\//i.test(e) && !/(?:^|\/)\.\_/.test(e))
        .map(e => e.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function findFileByExtInDir(fs, path, rootDir, exts) {
    const stack = [rootDir];
    while (stack.length) {
      const cur = stack.pop();
      try {
        for (const name of fs.readdirSync(cur)) {
          if (isJunkEntry(name)) continue;
          const p = path.join(cur, name);
          try {
            if (fs.statSync(p).isDirectory()) stack.push(p);
            else {
              const lower = name.toLowerCase();
              if (exts.some((e) => lower.endsWith(e))) return p;
            }
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

  /** Hamma mosliklar (nom bo'yicha sortlangan) — masalan zip ichidagi barcha .mogrt */
  function findAllFilesByExtInDir(fs, path, rootDir, exts) {
    const found = [];
    const stack = [rootDir];
    while (stack.length) {
      const cur = stack.pop();
      try {
        for (const name of fs.readdirSync(cur)) {
          if (isJunkEntry(name)) continue;
          const p = path.join(cur, name);
          try {
            if (fs.statSync(p).isDirectory()) stack.push(p);
            else {
              const lower = name.toLowerCase();
              if (exts.some((e) => lower.endsWith(e))) found.push(p);
            }
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
    found.sort((a, b) => a.localeCompare(b));
    return found;
  }

  function findAepInDir(fs, path, rootDir) {
    return findFileByExtInDir(fs, path, rootDir, [".aep"]);
  }

  /** .mogrt extract'dan keyin definition.json'dagi master comp nomi (aep yo'li bo'yicha) */
  const mogrtComps = {};

  function rememberMogrtCompName(dir, aepPath) {
    try {
      const fs = require("fs");
      const path = require("path");
      const def = JSON.parse(
        fs.readFileSync(path.join(dir, "definition.json"), "utf8")
      );
      const locales = def.sourceInfoLocalized || {};
      const loc = locales.en_US || locales[Object.keys(locales)[0]] || {};
      const name = String(loc.name || def.capsuleName || "").trim();
      if (name) mogrtComps[aepPath] = name;
    } catch {
      /* definition.json yo'q yoki buzilgan — hint'siz davom etamiz */
    }
  }

  /** Import cfg uchun: .mogrt'dan chiqqan .aep'ning master comp nomi ("" = noma'lum) */
  function mogrtCompName(aepPath) {
    return mogrtComps[aepPath] || "";
  }

  function mogrtSlug(name) {
    return (
      String(name || "")
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "item"
    );
  }

  function fileUrl(p) {
    return "file://" + encodeURI(String(p).replace(/\\/g, "/"));
  }

  /**
   * Bitta .mogrt faylni .aep ga ochadi. Har chaqiriqda UNIKAL papka —
   * oldingi importlarning footage yo'llari buzilmasligi uchun.
   * .mogrt = ZIP (project.aegraphic + definition.json + thumb'lar);
   * yangi AE'larda .aegraphic O'ZI ham ZIP (ichida asl RIFX .aep).
   */
  function extractMogrtFileToAep(fs, path, child, NodeBuffer, baseDir, templateId, mogrtPath) {
    const slug = mogrtSlug(path.basename(mogrtPath, path.extname(mogrtPath)));
    const dir = path.join(
      baseDir,
      `assetflow_mogrt_${templateId}_${slug}_${Date.now()}`
    );
    fs.mkdirSync(dir, { recursive: true });
    try {
      child.execFileSync("unzip", ["-o", mogrtPath, "-d", dir], {
        timeout: 120_000,
      });
    } catch (e) {
      throw new Error("MOGRT ochilmadi — fayl buzilgan bo'lishi mumkin.");
    }
    let aep = null;
    const graphic = findFileByExtInDir(fs, path, dir, [".aegraphic"]);
    if (graphic) {
      const head = NodeBuffer.alloc(2);
      const fd = fs.openSync(graphic, "r");
      fs.readSync(fd, head, 0, 2, 0);
      fs.closeSync(fd);
      if (head[0] === 0x50 && head[1] === 0x4b) {
        try {
          child.execFileSync("unzip", ["-o", graphic, "-d", dir], {
            timeout: 120_000,
          });
        } catch (e) {
          throw new Error("MOGRT loyiha qismi (aegraphic) ochilmadi.");
        }
        aep = findAepInDir(fs, path, dir);
      } else {
        aep = path.join(path.dirname(graphic), "mogrt_TEMP.aep");
        fs.renameSync(graphic, aep);
      }
    } else {
      aep = findAepInDir(fs, path, dir);
    }
    if (!aep) {
      throw new Error("MOGRT ichida .aep loyiha topilmadi.");
    }
    rememberMogrtCompName(dir, aep);
    return aep;
  }

  /**
   * ZIP-pack keshidagi .mogrt elementlar ro'yxati. Har element uchun
   * thumb.png/thumb.mp4 ni mogrt ichidan __af_thumbs/<slug>/ ga chiqaradi
   * (bir marta — keyin keshdan). Render KERAK EMAS: preview .mogrt'ning o'zida.
   */
  function mogrtItemsFromDir(fs, path, child, cacheDir) {
    const files = findAllFilesByExtInDir(fs, path, cacheDir, [".mogrt"]);
    return files.map((p) => {
      const base = path.basename(p, path.extname(p));
      const slug = mogrtSlug(base);
      const tdir = path.join(cacheDir, "__af_thumbs", slug);
      const png = path.join(tdir, "thumb.png");
      const mp4 = path.join(tdir, "thumb.mp4");
      if (!fs.existsSync(png) && !fs.existsSync(mp4)) {
        try {
          fs.mkdirSync(tdir, { recursive: true });
          // -j: papkasiz; faqat thumb a'zolari (yo'q bo'lsa exit!=0 — e'tiborsiz)
          child.execFileSync(
            "unzip",
            ["-o", "-j", p, "thumb.png", "thumb.mp4", "-d", tdir],
            { timeout: 30_000 }
          );
        } catch (e) {
          /* thumb'siz mogrt — karta ikonka bilan qoladi */
        }
      }
      return {
        name: base,
        path: p,
        thumbPng: fs.existsSync(png) ? fileUrl(png) : "",
        thumbMp4: fs.existsSync(mp4) ? fileUrl(mp4) : "",
      };
    });
  }

  /** ZIP keshi ochilgan bo'lsa — undagi .mogrt elementlar (sync, yuklab olmaydi) */
  function cachedMogrtItems(templateId) {
    if (typeof window.__adobe_cep__ === "undefined") return [];
    try {
      const fs = require("fs");
      const path = require("path");
      const os = require("os");
      const child = require("child_process");
      const baseDir = downloadDir() || os.tmpdir();
      const cacheDir = path.join(baseDir, `assetflow_${templateId}_unzipped`);
      if (!fs.existsSync(cacheDir)) return [];
      return mogrtItemsFromDir(fs, path, child, cacheDir);
    } catch {
      return [];
    }
  }

  /** Tanlangan .mogrt elementni import uchun .aep ga tayyorlaydi */
  async function extractMogrtItem(templateId, mogrtPath) {
    if (typeof window.__adobe_cep__ === "undefined") {
      throw new Error("Faqat After Effects ichida import");
    }
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const child = require("child_process");
    const { Buffer: NodeBuffer } = require("buffer");
    if (!mogrtPath || !fs.existsSync(mogrtPath)) {
      throw new Error("MOGRT fayl topilmadi — packni qayta yuklab oling.");
    }
    const baseDir = downloadDir() || os.tmpdir();
    return extractMogrtFileToAep(
      fs, path, child, NodeBuffer, baseDir, templateId, mogrtPath
    );
  }

  /** UI'ga "ichida bir nechta MOGRT bor — tanlang" signali */
  function mogrtPackError(items) {
    const err = new Error("MOGRT_PACK");
    err.mogrtItems = items;
    return err;
  }

  function cachedFileOk(fs, filePath, expectedSize) {
    try {
      if (!fs.existsSync(filePath)) return false;
      const st = fs.statSync(filePath);
      if (st.size < 1024) return false;
      if (expectedSize > 0 && st.size < expectedSize * 0.95) return false;
      return true;
    } catch {
      return false;
    }
  }

  // Faol (bekor qilinishi mumkin) yuklab olishlar — Bekor tugmasi/panel yopilishi uchun
  const __activeDownloads = new Set();

  /** Barcha faol yuklab olishlarni uzadi: oqimni to'xtatadi, qisman faylni o'chiradi */
  function cancelDownload() {
    const holders = Array.from(__activeDownloads);
    __activeDownloads.clear();
    holders.forEach((h) => {
      h.cancelled = true;
      try { if (h.req) h.req.destroy(); } catch (e) {}
      try { if (h.ws) h.ws.destroy(); } catch (e) {}
      try {
        const fs = require("fs");
        if (h.dest && fs.existsSync(h.dest)) fs.rmSync(h.dest, { force: true });
      } catch (e) {}
      try { if (h.fail) h.fail(); } catch (e) {}
    });
  }

  function hasActiveDownload() {
    return __activeDownloads.size > 0;
  }

  /** URL origin'ini olish (header'ni faqat o'z API origin'iga yuborish uchun) */
  function urlOrigin(u) {
    try { return new URL(u).origin; } catch { return ""; }
  }

  /**
   * Katta packlar uchun diskka oqim bilan yuklash (xotiraga 200MB yig'masdan).
   * `headers` — faqat BIRINCHI (o'z API) so'roviga qo'shiladi; redirect boshqa
   * origin'ga (R2/CDN) ketsa Authorization TASHLANADI (token sizib chiqmasin).
   */
  function downloadUrlToFile(url, destPath, onProgress, headers) {
    return new Promise((resolve, reject) => {
      const fs = require("fs");
      const startOrigin = urlOrigin(url);
      const holder = { req: null, ws: null, dest: destPath, cancelled: false, fail: null };
      __activeDownloads.add(holder);
      const cleanup = () => __activeDownloads.delete(holder);
      const failCancelled = () => {
        cleanup();
        const err = new Error("Yuklab olish bekor qilindi");
        err.cancelled = true;
        reject(err);
      };
      holder.fail = failCancelled;
      const go = (u, redirectsLeft, hdrs) => {
        if (holder.cancelled) { failCancelled(); return; }
        if (redirectsLeft <= 0) {
          cleanup();
          reject(new Error("Redirect limit"));
          return;
        }
        // Redirect protokolni almashtirishi mumkin (http↔https) — modulni URL'ga qarab tanlaymiz
        const lib = u.startsWith("https") ? require("https") : require("http");
        // Authorization faqat boshlang'ich API origin'iga; redirect boshqa
        // hostga ketsa header'ni tushiramiz (token leak oldini olish).
        const sameOrigin = !!hdrs && urlOrigin(u) === startOrigin && startOrigin !== "";
        const reqCb = (res) => {
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume();
            let next = res.headers.location;
            try {
              next = new URL(next, u).toString();
            } catch (ignore) {}
            go(next, redirectsLeft - 1, hdrs);
            return;
          }
          if (res.statusCode !== 200) {
            // Kichik JSON xato tanasini o'qib, foydalanuvchiga aniq xabar beramiz
            // (masalan 403 = limit tugadi yoki nashr etilmagan).
            let body = "";
            res.on("data", (c) => { if (body.length < 2048) body += c; });
            res.on("end", () => {
              cleanup();
              let msg = `Pack HTTP ${res.statusCode}`;
              try {
                const j = JSON.parse(body);
                if (j && j.error) msg = j.error;
              } catch (ignore) {}
              const err = new Error(msg);
              err.status = res.statusCode;
              reject(err);
            });
            res.on("error", () => { cleanup(); reject(new Error(`Pack HTTP ${res.statusCode}`)); });
            return;
          }
          const total = parseInt(res.headers["content-length"], 10) || 0;
          let done = 0;
          let lastTime = 0;
          const ws = fs.createWriteStream(destPath);
          holder.ws = ws;
          // Birinchi baytda darhol ko'rsatamiz, keyin har ~250ms (MB hisoblagich jonli bo'lsin)
          if (onProgress) onProgress(0, total);
          res.on("data", (chunk) => {
            if (holder.cancelled) return;
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
          ws.on("finish", () => { cleanup(); resolve(destPath); });
          ws.on("error", (e) => { cleanup(); holder.cancelled ? failCancelled() : reject(e); });
          res.on("error", (e) => { cleanup(); holder.cancelled ? failCancelled() : reject(e); });
        };
        const req = sameOrigin ? lib.get(u, { headers: hdrs }, reqCb) : lib.get(u, reqCb);
        holder.req = req;
        req.on("error", (e) => {
          cleanup();
          if (holder.cancelled) failCancelled(); else reject(e);
        });
      };
      go(url, 8, headers || null);
    });
  }

  /**
   * M2: faqat tanlangan sahnaning .mogrt faylini yuklab olib .aep ga
   * tayyorlaydi — butun ZIP (200MB+) yuklanmaydi. Fayl
   * assetflow_<id>_mogrts/<slug>.mogrt da keshlanadi.
   */
  async function downloadSceneMogrt(templateId, scene, opts) {
    if (typeof window.__adobe_cep__ === "undefined") {
      throw new Error("Faqat After Effects ichida import");
    }
    if (!scene || !scene.mogrtUrl) {
      throw new Error("Sahnada MOGRT URL yo'q");
    }
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const child = require("child_process");
    const { Buffer: NodeBuffer } = require("buffer");
    const slug = mogrtSlug(scene.slug || scene.aeComp || scene.n);
    const baseDir = downloadDir() || os.tmpdir();
    const dir = path.join(baseDir, `assetflow_${templateId}_mogrts`);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
    const out = path.join(dir, `${slug}.mogrt`);
    let _freshDownload = false;
    if (!cachedFileOk(fs, out, 0)) {
      if (typeof showToast === "function") showToast("Sahna yuklanmoqda…");
      const onProgress = opts && opts.onProgress;
      await downloadUrlToFile(scene.mogrtUrl, out, onProgress, downloadHeaders());
      if (!cachedFileOk(fs, out, 0)) {
        try {
          fs.rmSync(out, { force: true });
        } catch {}
        throw new Error("MOGRT yuklanmadi yoki fayl bo'sh");
      }
      _freshDownload = true;
    }
    const result = await extractMogrtFileToAep(
      fs, path, child, NodeBuffer, baseDir, templateId, out
    );
    // Usage hisobi — faqat muvaffaqiyatli import qilingandan keyin
    if (_freshDownload && typeof AssetFlowAccount !== "undefined" && AssetFlowAccount.isLoggedIn()) {
      try {
        await AssetFlowAccount.recordDownload(templateId);
        if (typeof refreshAccountUi === "function") refreshAccountUi();
      } catch (e) {
        console.warn("usage/download", e);
      }
    }
    return result;
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
        // .aep yo'q — ochilgan papkadan kengaytma bo'yicha topamiz (papka nomi muhim emas)
        const mogrts = findAllFilesByExtInDir(fs, path, cacheDir, [".mogrt"]);
        if (mogrts.length === 1) {
          return extractMogrtFileToAep(
            fs, path, child, NodeBuffer, baseDir, templateId, mogrts[0]
          );
        }
        if (mogrts.length > 1) {
          throw mogrtPackError(mogrtItemsFromDir(fs, path, child, cacheDir));
        }
      }
    } else if (ext.toLowerCase() !== ".mogrt" && cachedFileOk(fs, out, expectedSize)) {
      // .mogrt bu yerdan o'tmaydi — kesh bo'lsa ham har import yangi extract oladi
      return out;
    }

    const needDownload =
      ext.toLowerCase() === ".zip"
        ? !cachedFileOk(fs, out, expectedSize)
        : !cachedFileOk(fs, out, expectedSize);

    let _needRecord = false;
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
        await downloadUrlToFile(url, out, onProgress, downloadHeaders());
      } catch (e) {
        // Limit/nashr/sessiya xatosi (403/401) — fallback bilan yashirmaymiz
        if (e && (e.status === 401 || e.status === 403)) throw e;
        if (directUrl && url === directUrl) {
          const fallback = `${apiBase()}/api/plugin/assets/${templateId}/pack`;
          await downloadUrlToFile(fallback, out, onProgress, downloadHeaders());
        } else {
          throw e;
        }
      }
      if (!cachedFileOk(fs, out, 0)) {
        throw new Error("Pack yuklanmadi yoki fayl bo’sh");
      }
      _needRecord = true;
    }

    const _record = async () => {
      if (_needRecord && typeof AssetFlowAccount !== "undefined" && AssetFlowAccount.isLoggedIn()) {
        try {
          await AssetFlowAccount.recordDownload(templateId);
          if (typeof refreshAccountUi === "function") refreshAccountUi();
        } catch (e) {
          console.warn("usage/download", e);
        }
      }
    };

    // AE can’t import .zip directly. If pack is a zip, extract and return first .aep inside.
    if (ext.toLowerCase() === ".zip") {
      const dir = path.join(baseDir, `assetflow_${templateId}_unzipped`);
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
      // zip ichidagi .mogrt yo’llarini o’chirishdan OLDIN olamiz — papka nomi muhim emas
      const zipMogrts = listEntriesInZip(child, out, ".mogrt");
      try {
        // macOS ships `unzip` by default.
        child.execFileSync("unzip", ["-o", out, "-d", dir], { timeout: 60_000 });
      } catch (e) {
        throw new Error("ZIP ochilmadi. Pack ichida .aep yoki .mogrt bo’lishi kerak.");
      }
      // Zip endi kerak emas — faqat ochilgan papka qoladi
      try {
        fs.rmSync(out, { force: true });
      } catch {}
      const aep = findAepInDir(fs, path, dir);
      if (aep) { await _record(); return aep; }
      // .aep yo’q — unzip -Z1 dan olingan entry yo’llari bo’yicha .mogrt’larni topamiz
      const mogrts = zipMogrts.map(e => path.join(dir, e)).filter(p => fs.existsSync(p));
      if (!mogrts.length) mogrts.push(...findAllFilesByExtInDir(fs, path, dir, [".mogrt"]));
      if (mogrts.length === 1) {
        const r = await extractMogrtFileToAep(
          fs, path, child, NodeBuffer, baseDir, templateId, mogrts[0]
        );
        await _record();
        return r;
      }
      if (mogrts.length > 1) {
        throw mogrtPackError(mogrtItemsFromDir(fs, path, child, dir));
      }
      throw new Error("ZIP ichida .aep yoki .mogrt topilmadi. Pack fayl noto’g’ri.");
    }

    // .mogrt — to’g’ridan yuklangan yakka fayl: extract (unikal papka,
    // .mogrt’ning o’zi kesh bo’lib qoladi, qayta yuklab olinmaydi).
    if (ext.toLowerCase() === ".mogrt") {
      const r = await extractMogrtFileToAep(
        fs, path, child, NodeBuffer, baseDir, templateId, out
      );
      await _record();
      return r;
    }

    await _record();
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
    downloadSceneMogrt,
    cancelDownload,
    hasActiveDownload,
    mogrtCompName,
    cachedMogrtItems,
    extractMogrtItem,
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
