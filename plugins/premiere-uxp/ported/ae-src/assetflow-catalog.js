/**
 * Server katalog — tasdiqlangan shablonlar (API)
 */
const AssetFlowCatalog = (() => {
  const DEFAULT_API =
    typeof ASSETFLOW_ENV !== "undefined"
      ? ASSETFLOW_ENV.defaultApi()
      : "https://api.getframeflow.app";
  let countByNav = { video: 0, motion: 0, graphics: 0, luts: 0, music: 0, sfx: 0 };

  function apiBase() {
    if (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.apiUrl) {
      return window.ASSETFLOW_STUDIO.apiUrl.replace(/\/$/, "");
    }
    if (typeof AssetFlowStore !== "undefined") {
      const c = AssetFlowStore.loadPrefs?.().client || {};
      if (c.apiBaseUrl) {
        const saved = String(c.apiBaseUrl).replace(/\/$/, "");
        if (typeof ASSETFLOW_ENV !== "undefined" && ASSETFLOW_ENV.sanitizeApi) {
          try { return ASSETFLOW_ENV.sanitizeApi(saved).replace(/\/$/, ""); } catch {}
        }
        return saved;
      }
    }
    return DEFAULT_API;
  }

  function catalogHeaders() {
    const h = { Accept: "application/json", "X-FF-App": hostTemplateApp() };
    if (typeof AssetFlowAccount !== "undefined") {
      Object.assign(h, AssetFlowAccount.authHeaders());
    }
    return h;
  }

  /** Pack/MOGRT yuklab olish uchun Authorization header (gate'langan route) */
  function newDownloadRequestId() {
    try {
      if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    } catch {}
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function downloadHeaders(requestId) {
    const h = { "X-FF-App": hostTemplateApp() };
    const key = String(requestId || "").trim();
    if (key) h["Idempotency-Key"] = key;
    if (typeof AssetFlowAccount !== "undefined" && AssetFlowAccount.authHeaders) {
      const auth = AssetFlowAccount.authHeaders();
      if (auth && auth.Authorization) h.Authorization = auth.Authorization;
    }
    return h;
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
          const te = new Error("Server did not respond (timed out)");
          te.timeout = true;
          throw te;
        }
        throw e;
      })
      .finally(() => clearTimeout(timer));
  }

  /**
   * Barqaror sozlamalar fayli yo'li.
   *
   * #139 (PL-i): ilgari HAR platformada macOS yo'li qattiq kodlangan edi
   * (`~/Library/Application Support/AssetFlow`) — Windows'da bu uy papkasida
   * begona "Library" daraxti yaratardi (AppData emas), Linux'da ham noto'g'ri.
   * Endi yo'lni `AssetFlowSecret.settingsDir()` beradi (yagona manba), va
   * mac bo'lmagan platformada eski joydagi fayl bir marta ko'chiriladi.
   */
  function settingsFilePath() {
    if (typeof window.__adobe_cep__ === "undefined") return "";
    try {
      const path = __ffRequire("path");
      const fs = __ffRequire("fs");
      const dir =
        typeof AssetFlowSecret !== "undefined" && AssetFlowSecret.settingsDir
          ? AssetFlowSecret.settingsDir()
          : path.join(__ffRequire("os").homedir(), "Library", "Application Support", "AssetFlow");
      fs.mkdirSync(dir, { recursive: true });
      const p = path.join(dir, "settings.json");
      // Migratsiya: eski (macOS-shaklidagi) fayl boshqa platformada qolgan bo'lsa
      if (!fs.existsSync(p) && typeof AssetFlowSecret !== "undefined" && AssetFlowSecret.legacySettingsDir) {
        try {
          const legacy = path.join(AssetFlowSecret.legacySettingsDir(), "settings.json");
          if (legacy !== p && fs.existsSync(legacy)) fs.copyFileSync(legacy, p);
        } catch {
          /* migratsiya majburiy emas */
        }
      }
      return p;
    } catch {
      return "";
    }
  }

  function readSettings() {
    const p = settingsFilePath();
    if (!p) return {};
    try {
      const fs = __ffRequire("fs");
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
    } catch {
      return {};
    }
  }

  function writeSettings(patch) {
    const p = settingsFilePath();
    if (!p) return false;
    try {
      const fs = __ffRequire("fs");
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
    const fs = __ffRequire("fs");
    const os = __ffRequire("os");
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

  /**
   * P34 — .mogrt/.zip extraction'dan qolgan eski papkalarni (14+ kun) boot'da
   * fon rejimida tozalaydi (assetflow_mogrt_* — downloadDir/tmpdir; extract_* —
   * AssetFlowStore export papkasi). Xatolar e'tiborsiz — foreground'ni bloklamaydi.
   */
  function pruneOldTempDirs() {
    if (typeof window === "undefined" || typeof window.__adobe_cep__ === "undefined") return;
    try {
      const fs = __ffRequire("fs");
      const path = __ffRequire("path");
      const CUTOFF_MS = 14 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const pruneDir = (dir, prefix) => {
        if (!dir) return;
        let entries = [];
        try {
          entries = fs.readdirSync(dir);
        } catch {
          return;
        }
        entries.forEach((name) => {
          if (name.indexOf(prefix) !== 0) return;
          const p = path.join(dir, name);
          try {
            const st = fs.statSync(p);
            if (st.isDirectory() && now - st.mtimeMs > CUTOFF_MS) fs.rmSync(p, { recursive: true, force: true });
          } catch {}
        });
      };
      pruneDir(downloadDir(), "assetflow_mogrt_");
      if (typeof AssetFlowStore !== "undefined" && AssetFlowStore.getExportsDir) {
        pruneDir(AssetFlowStore.getExportsDir(), "extract_");
      }
    } catch {}
  }

  // ── P1 #15 — server-side browse sahifalash holati (filtr bilan) ──
  // Ilgari fetchCatalog MAX_PAGES sikli BUTUN katalogni yuklardi (5000 assetda ~50
  // ketma-ket so'rov + Premiere muzlashi) va filtr/qidiruv BRAUZERDA ishlardi (P5.1 —
  // "LUTs" faqat birinchi sahifa ichidan qidirar edi). Endi filtr/qidiruv/sort SERVER
  // tomonda (butun baza), bir vaqtda BITTA sahifa (48) olinadi, scroll bilan qo'shiladi.
  let browseCursor = null;
  let browseDone = false;
  let browseLoading = false;
  let browseSig = "";

  const BROWSE_FILTER_KEYS = ["templateType", "cat", "orient", "res", "q", "sort"];
  function hostTemplateApp(forced) {
    const requested = String(forced || "").toLowerCase();
    if (requested === "pr" || requested === "ae") return requested;
    try {
      const globalApp = String((typeof window !== "undefined" && window.AF_TEMPLATE_APP) || "").toLowerCase();
      if (globalApp === "pr" || globalApp === "ae") return globalApp;
    } catch {}
    try {
      const env = typeof CSInterface !== "undefined" ? new CSInterface().getHostEnvironment() : null;
      const id = String((env && (env.appName || env.appId)) || "AEFT").toUpperCase();
      return id === "PPRO" || id.indexOf("PREMIERE") >= 0 ? "pr" : "ae";
    } catch {
      return "ae";
    }
  }
  function browseQueryStr(filters, cursor) {
    const p = new URLSearchParams();
    p.set("app", hostTemplateApp()); // dual-host CEP: Premiere → ae, Premiere → pr
    p.set("take", "48");
    const f = filters || {};
    BROWSE_FILTER_KEYS.forEach((k) => {
      const v = f[k];
      if (v != null && v !== "" && v !== "all" && v !== "All") p.set(k, String(v));
    });
    if (cursor) p.set("cursor", cursor);
    return p.toString();
  }
  function filtersSig(filters) {
    const f = filters || {};
    return BROWSE_FILTER_KEYS.map((k) => String(f[k] || "")).join("|");
  }

  async function fetchCatalogPage(cursor, filters) {
    const res = await fetchWithTimeout(
      `${apiBase()}/api/plugin/catalog?${browseQueryStr(filters, cursor)}`,
      { headers: catalogHeaders() }
    );
    if (!res.ok) {
      // P20: javob tanasidan `code`ni o'qib markaziy ushlagichga BERAMIZ — faqat auth-bekor
      // (401 / 403 ACCOUNT_BLOCKED|INACTIVE) sessiyani tugatadi; LIMIT_REACHED va h.k. EMAS.
      let body = null;
      try { body = await res.json(); } catch { body = null; }
      const code = body && body.code;
      if (typeof AssetFlowAccount !== "undefined" && AssetFlowAccount.handleAuthFailure) {
        AssetFlowAccount.handleAuthFailure(res.status, !!AssetFlowAccount.token(), code);
      }
      const err = new Error((body && body.error) || `Catalog HTTP ${res.status}`);
      err.status = res.status;
      err.code = code;
      throw err;
    }
    return res.json();
  }

  /**
   * P1 #15 — "hamma sahifani yuklab ol" sikli O'CHIRILDI. Endi bitta sahifa olinadi
   * (ixtiyoriy filtrlar bilan). Qo'shimcha sahifalar loadMoreBrowse orqali scroll'da.
   */
  async function fetchCatalog(filters) {
    const data = await fetchCatalogPage(null, filters);
    return { items: Array.isArray(data.items) ? data.items : [], nextCursor: data.nextCursor || null };
  }

  /** P1 #16 — bitta shablonning to'liq detali (enriched sahnalar + metaJson). SLIM
   *  ro'yxat sahnalarni bermaydi — pack ochilganda shundan lazy olinadi. */
  async function fetchTemplateDetail(id) {
    const res = await fetchWithTimeout(
      `${apiBase()}/api/plugin/catalog/${encodeURIComponent(id)}`,
      { headers: catalogHeaders() }
    );
    if (!res.ok) throw new Error(`Detail HTTP ${res.status}`);
    return res.json();
  }

  /** Katalog itemidan (u) sahnalar ro'yxatini quradi (merge va lazy-load umumiy). */
  function scenesFromItem(u) {
    const meta =
      u && u.metaJson && typeof u.metaJson === "object" && !Array.isArray(u.metaJson)
        ? u.metaJson
        : {};
    const preview = (u && u.previewUrl) || "";
    const resLabel = ((u && u.res) || "4k").toUpperCase();
    const metaScenes = Array.isArray(meta.scenes) ? meta.scenes : [];
    const scenes = metaScenes.length
      ? metaScenes.map((s) => ({
          n: s.n || s.name || (u && u.name),
          aeComp: s.aeComp || s.compName || s.name || s.n || "",
          slug: s.slug || s.previewKey || undefined,
          mogrtUrl: s.mogrtUrl || undefined,
          meta: s.meta || resLabel,
          ico: s.ico || (u && u.icon) || "✦",
          bg: s.bg || (u && u.bg),
          preview: s.preview || preview || undefined,
          previewKind: s.previewKind || undefined,
        }))
      : [
          {
            n: u && u.name,
            aeComp: "",
            meta: resLabel,
            ico: (u && u.icon) || "✦",
            bg: u && u.bg,
            preview: preview || undefined,
          },
        ];
    return { scenes, aeScenesFolder: meta.scenesFolder || meta.aeScenesFolder || "Scenes" };
  }

  /** P1 #16 — pack sahnalarini detaldan lazy yuklaydi (openPack chaqiradi). */
  async function loadPackScenes(templateId) {
    const u = await fetchTemplateDetail(templateId);
    return scenesFromItem(u);
  }

  async function fetchFeatured(limit = 6) {
    const res = await fetchWithTimeout(`${apiBase()}/api/plugin/featured?limit=${limit}&app=${hostTemplateApp()}`, {
      headers: catalogHeaders(),
    });
    if (!res.ok) throw new Error(`Featured HTTP ${res.status}`);
    return res.json();
  }

  /** Home javonlari uchun katalogni browse holatiga tegmasdan ixcham yuklaydi. */
  async function fetchHomeShelf(templateType, limit = 6) {
    const take = Math.max(1, Math.min(12, Number(limit) || 6));
    const p = new URLSearchParams();
    p.set("app", hostTemplateApp());
    p.set("take", String(take));
    if (templateType) p.set("templateType", String(templateType));
    const res = await fetchWithTimeout(`${apiBase()}/api/plugin/catalog?${p.toString()}`, {
      headers: catalogHeaders(),
    });
    if (!res.ok) throw new Error(`Home shelf HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data && data.items) ? data.items : [];
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

  // P1 #15 — opts.append: true bo'lsa server itemlari TOZALANMAYDI (keyingi sahifa
  // qo'shiladi); false/undefined (reset) bo'lsa eski server itemlar o'chiriladi (bo'sh
  // natijada ham — filtr hech narsaga mos kelmasa grid bo'shab qolsin).
  function mergeIntoBrowse(items, opts) {
    const append = !!(opts && opts.append);
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
    if (!append) {
      countByNav = { video: 0, motion: 0, graphics: 0, luts: 0, music: 0, sfx: 0 };
      clearServerFromBrowse(); // reset — eski server itemlarini oldin o'chiramiz
    }
    if (!items?.length) return 0;
    const NAV_LABELS_REF =
      typeof NAV_LABELS !== "undefined"
        ? NAV_LABELS
        : { video: "Video Templates", motion: "Motion Graphics", graphics: "Graphics", luts: "LUTs", music: "Music", sfx: "Sound Effects" };

    items.forEach((u) => {
      const packKey = "__srv_" + u.id;
      const navKey = u.nav || "video";
      if (countByNav[navKey] !== undefined) countByNav[navKey]++;
      else countByNav.video++;
      const thumb = u.thumbUrl || "";
      const preview = u.previewUrl || "";
      const resLabel = (u.res || "4k").toUpperCase();
      // P1 #16 — SLIM ro'yxatda metaJson YO'Q → scenesFromItem placeholder beradi;
      // sahnalar pack ochilganda detaldan (loadPackScenes) lazy yuklanadi.
      const hasRealScenes =
        !!(u.metaJson && typeof u.metaJson === "object" && Array.isArray(u.metaJson.scenes) && u.metaJson.scenes.length);
      const built = scenesFromItem(u);
      packs[packKey] = {
        ico: u.icon || "✦",
        bg: u.bg,
        displayName: u.name,
        sub: `${NAV_LABELS_REF[u.nav] || u.nav} · ${u.catLabel} · ${resLabel}`,
        preview: preview || undefined,
        scenes: built.scenes,
        // detalScenesLoaded: to'liq sahnalar bormi (openPack lazy fetch qaror qiladi)
        detailScenesLoaded: hasRealScenes,
        aeScenesFolder: built.aeScenesFolder,
        server: true,
        serverTemplateId: u.id,
        hasPack: u.hasPack !== false,
        serverPackUrl: u.packUrl || undefined,
        fileSize: u.fileSize || 0,
        packSha256: u.packSha256 || "",
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
        // Premiere redesign — karta author + per-shablon tier (katalog API additive maydonlari)
        author: u.author || null,
        authorInitials: u.authorInitials || "",
        isPro: !!u.isPro,
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
    for (const key of ["video", "motion", "graphics", "luts", "music", "sfx"]) {
      if (countByNav[key] > 0) return key;
    }
    return "video";
  }

  function navHint(nav) {
    const labels =
      typeof NAV_LABELS !== "undefined"
        ? NAV_LABELS
        : { video: "Video Templates", motion: "Motion Graphics", graphics: "Graphics", luts: "LUTs", music: "Music", sfx: "Sound Effects" };
    return labels[nav] || nav;
  }

  /**
   * P1 #15 — server-driven, SAHIFALANGAN browse. filters = { templateType, cat,
   * orient, res, q, sort } (plagin joriy nav/qidiruv/filtrlaridan quriladi). reset=true
   * (default): yangi filtr — 1-sahifa, server itemlari o'rnini bosadi. reset=false:
   * keyingi sahifa (append, scroll'da). Filtr BUTUN baza bo'yicha SERVER tomonda —
   * grid endi "birinchi sahifa ichidan" qidirmaydi (P5.1 tuzatildi).
   *
   * Eslatma: eski "server'dan o'chirilgan downloaded'ni tozalash" mantig'i OLIB
   * TASHLANDI — u BUTUN katalog ro'yxatiga tayanardi; sahifalanganda bitta sahifa
   * yetarli emas (noto'g'ri o'chirib yuborardi).
   */
  // SC_37 — poyga himoyasi: so'rov ketayotganda yangi filtr/qidiruv kelsa tashlab
  // yubormaymiz — OXIRGISI eslab qolinadi va joriy so'rov tugagach avtomatik yuklanadi
  // (aks holda tez yozishda grid eski so'rov natijasida "yopishib" qolardi).
  let browsePending = null;
  async function refreshBrowse(filters, opts) {
    const reset = !opts || opts.reset !== false;
    const sig = filtersSig(filters);
    if (browseLoading) {
      if (reset) browsePending = filters;
      return 0;
    }
    if (!reset && (browseDone || sig !== browseSig)) return 0;
    browseLoading = true;
    let data;
    try {
      data = await fetchCatalogPage(reset ? null : browseCursor, filters);
    } catch (e) {
      browseLoading = false;
      const pendingAfterError = browsePending;
      browsePending = null;
      if (pendingAfterError && filtersSig(pendingAfterError) !== sig) {
        return refreshBrowse(pendingAfterError, { reset: true });
      }
      // P4: foydalanuvchiga do'stona xabar (URL/xom xato YO'Q) — texnik tafsilot konsolda.
      try { console.warn("refreshBrowse xatosi · API:", apiBase(), e); } catch (_) {}
      if (typeof showToast === "function") {
        const friendly =
          typeof friendlyError === "function"
            ? friendlyError(e)
            : "Couldn’t reach the server — try again shortly";
        showToast(friendly, "error");
      }
      throw e;
    }
    if (browsePending && filtersSig(browsePending) !== sig) {
      const newest = browsePending;
      browsePending = null;
      browseLoading = false;
      return refreshBrowse(newest, { reset: true });
    }
    const items = Array.isArray(data.items) ? data.items : [];
    const n = mergeIntoBrowse(items, { append: !reset });
    browseCursor = data.nextCursor || null;
    browseDone = !browseCursor;
    browseSig = sig;
    browseLoading = false;
    // SC_37 — yuklash davomida yangi filtr kelgan bo'lsa: oraliq render'siz darhol
    // OXIRGI filtr bilan qayta yuklaymiz (stale natija ko'rsatilmaydi).
    if (browsePending) {
      const nf = browsePending;
      browsePending = null;
      if (filtersSig(nf) !== sig) return refreshBrowse(nf, { reset: true });
    }
    if (reset && typeof window !== "undefined" && typeof buildCategoryMenu === "function") {
      buildCategoryMenu(window.currentNav || "video");
    }
    if (reset && n > 0) await refreshFeatured();
    if (typeof window !== "undefined") {
      if (typeof render === "function") render();
      if (typeof updateServerNavBadges === "function") updateServerNavBadges();
    }
    return n;
  }

  /** P1 #15 — keyingi sahifa (scroll load-more). Filtr o'zgargan bo'lsa reset qiladi. */
  async function loadMoreBrowse(filters) {
    if (filtersSig(filters) !== browseSig) return refreshBrowse(filters, { reset: true });
    if (browseDone || browseLoading) return 0;
    return refreshBrowse(filters, { reset: false });
  }
  function browseHasMore() { return !browseDone; }
  function isBrowseLoading() { return browseLoading; }

  function findServerPackMeta(templateId) {
    const packs = browsePacks();
    if (!packs) return { url: null, fileSize: 0, name: "", sha256: "" };
    for (const key of Object.keys(packs)) {
      const p = packs[key];
      if (p.serverTemplateId === templateId) {
        return {
          url: p.serverPackUrl || null,
          fileSize: p.fileSize || 0,
          sha256: p.packSha256 || "",
          name: p.displayName || key || "", // P9: papka nomi shablon NOMIdan
        };
      }
    }
    return { url: null, fileSize: 0, name: "", sha256: "" };
  }

  /**
   * P9 — ekstraksiya papkasi endi SHABLON NOMI bilan: "Fast Light Leaks (af-zla3mz)".
   * Inson o'qiy oladigan nom yetakchi; qisqa id-suffiks kolliziyadan saqlaydi.
   * Nom topilmasa eski `assetflow_<id>_unzipped` shakli (orqaga moslik).
   * Eski id-nomli kesh topilmay qolsa — bir marta qayta yuklab olinadi (QA-FIX #7
   * marker baribir yangi paketni majburlaydi), import esa yangi papkada ishlayveradi.
   */
  function unzipDirName(templateId, name) {
    const base = String(name || "")
      .replace(/[\\/:*?"<>|\x00-\x1f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60)
      .trim()
      .replace(/^[. ]+|[. ]+$/g, "");
    if (!base) return `assetflow_${templateId}_unzipped`;
    const sid = String(templateId || "").slice(-6) || "x";
    return `${base} (af-${sid})`;
  }
  function unzipDirFor(fs, path, baseDir, templateId, name) {
    // Eski `assetflow_<id>_unzipped` kesh endi ISHLATILMAYDI — nomli papka topilmasa
    // pack bir marta qayta yuklab olinadi (doc: eski .aep-only kesh baribir yangilanishi kerak);
    // eski papka diskda qoladi, foydalanuvchi xohlasa o'zi o'chiradi.
    return path.join(baseDir, unzipDirName(templateId, name));
  }

  /**
   * #29 (PL-b) — kesh yozuvini YAGONA joyda aniqlaymiz. P9 dan keyin ekstraksiya
   * papkasi "Fast Light Leaks (af-zla3mz)" ko'rinishida; u `assetflow_` bilan
   * BOSHLANMAYDI, shu sabab "Clear download cache" ning eski `assetflow_*` filtri
   * uni hech qachon o'chirmasdi — kesh cheksiz o'sardi, UI esa "tozalandi" derdi.
   */
  const P9_DIR_RE = /\s\(af-[A-Za-z0-9]{1,6}\)$/;
  function isCacheEntryName(name) {
    const s = String(name || "");
    return s.indexOf("assetflow_") === 0 || P9_DIR_RE.test(s);
  }
  /**
   * #29 (PL-b) — nom AYNAN shu shablonning kesh yozuvimi? Papka nomi shablon
   * NOMIdan yasalgani uchun nomga emas, `(af-<id oxirgi 6>)` suffiksiga qaraymiz:
   * shablon keyin qayta nomlangan bo'lsa ham kesh topiladi.
   */
  function isTemplateCacheEntryName(name, templateId) {
    const s = String(name || "");
    const tid = String(templateId || "");
    if (!s || !tid) return false;
    if (s === `assetflow_${tid}` || s === `assetflow_${tid}_unzipped`) return true;
    if (s.indexOf(`assetflow_${tid}.`) === 0) return true; // .zip / .aep / .mogrt
    if (s.indexOf(`assetflow_mogrt_${tid}_`) === 0) return true; // har importda unikal
    const suffix = ` (af-${tid.slice(-6) || "x"})`;
    return s.length > suffix.length && s.slice(-suffix.length) === suffix;
  }

  /** macOS zip axlati: __MACOSX papkasi va AppleDouble ._fayllar */
  function isJunkEntry(name) {
    return name.indexOf("._") === 0 || name === "__MACOSX" || name === ".DS_Store";
  }

  /**
   * P35 — server yuklab-olish nusxasidan olib tashlaydigan ILDIZ darajadagi
   * marketing fayl (preview/thumbnail/…). Footage-bundle importida mijoz tomonda
   * ham chiqaramiz (eski kesh yoki to'g'ridan-URL uchun belt-and-braces). Faqat
   * extraction ILDIZidagi fayl — ichki papkadagi media = kontent, tegilmaydi.
   */
  function isStrippedMarketingFile(fs, path, rootDir, absPath) {
    var rel = path.relative(rootDir, absPath).replace(/\\/g, "/");
    if (rel.indexOf("/") >= 0) return false;
    return /^(preview|thumbnail|thumb|screenshot|poster|cover)\.(mp4|mov|webm|png|jpe?g|webp|gif)$/i.test(
      rel
    );
  }

  /** P35 — footage-to'plamida Premiere'ga FOOTAGE sifatida import qilinadigan media. */
  var FOOTAGE_MEDIA_EXTS = [
    ".mp4", ".mov", ".webm",
    ".mp3", ".wav", ".aiff", ".aif",
    ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ];
  /** Ochilgan papkadan import qilinadigan media (ildizdagi marketing fayllar chiqarilgan). */
  function collectBundleMedia(fs, path, dir) {
    return findAllFilesByExtInDir(fs, path, dir, FOOTAGE_MEDIA_EXTS).filter(
      function (p) { return !isStrippedMarketingFile(fs, path, dir, p); }
    );
  }

  /**
   * Sof-Node ZIP kutubxonasi (assetflow-zip.js). Audit #2 (P0): ilgari bu yerda
   * `unzip` CLI ishlatilardi — Windows'da bunday buyruq YO'Q (har pack importi
   * sinardi) va fayl nomi shell'ga tushardi. Endi shell umuman chaqirilmaydi.
   */
  function zipLib() {
    if (!window.AFZip) {
      throw new Error("ZIP module is not loaded (assetflow-zip.js).");
    }
    return window.AFZip;
  }

  /**
   * ZIP ichidagi barcha fayllarni kengaytma bo'yicha filterlash — papka nomi muhim emas.
   */
  function listEntriesInZip(zipPath, extLower) {
    return zipLib()
      .listEntries(zipPath)
      .map((e) => e.name)
      .filter((name) => name.toLowerCase().endsWith(extLower));
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
      const fs = __ffRequire("fs");
      const path = __ffRequire("path");
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
   * yangi Premiere'larda .aegraphic O'ZI ham ZIP (ichida asl RIFX .aep).
   */
  async function extractMogrtFileToAep(fs, path, NodeBuffer, baseDir, templateId, mogrtPath) {
    const slug = mogrtSlug(path.basename(mogrtPath, path.extname(mogrtPath)));
    const dir = path.join(
      baseDir,
      `assetflow_mogrt_${templateId}_${slug}_${Date.now()}`
    );
    fs.mkdirSync(dir, { recursive: true });
    if (typeof showToast === "function") showToast("Opening item…");
    try {
      await zipLib().extractAll(mogrtPath, dir);
    } catch (e) {
      throw new Error("Could not open MOGRT — the file may be corrupted.");
    }
    // Robustlik: ochish nol fayl chiqarsa aniq xato (jimgina davom etmaydi)
    let __mextract = [];
    try { __mextract = fs.readdirSync(dir); } catch {}
    if (!__mextract.length) throw new Error("MOGRT is empty or could not be opened.");
    let aep = null;
    const graphic = findFileByExtInDir(fs, path, dir, [".aegraphic"]);
    if (graphic) {
      const head = NodeBuffer.alloc(2);
      const fd = fs.openSync(graphic, "r");
      fs.readSync(fd, head, 0, 2, 0);
      fs.closeSync(fd);
      if (head[0] === 0x50 && head[1] === 0x4b) {
        try {
          await zipLib().extractAll(graphic, dir);
        } catch (e) {
          throw new Error("Could not open MOGRT project part (aegraphic).");
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
      throw new Error("No .aep project found inside MOGRT.");
    }
    rememberMogrtCompName(dir, aep);
    return aep;
  }

  /**
   * ZIP-pack keshidagi .mogrt elementlar ro'yxati. Har element uchun
   * thumb.png/thumb.mp4 ni mogrt ichidan __af_thumbs/<slug>/ ga chiqaradi
   * (bir marta — keyin keshdan). Render KERAK EMAS: preview .mogrt'ning o'zida.
   */
  function mogrtItemsFromDir(fs, path, cacheDir) {
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
          // flatten: papkasiz; faqat thumb a'zolari (yo'q bo'lsa 0 — e'tiborsiz).
          // Fayllar kichik → sinxron ochamiz (UI ro'yxati sync quriladi).
          zipLib().extractEntriesSync(p, tdir, ["thumb.png", "thumb.mp4"], {
            flatten: true,
          });
        } catch (e) {
          /* thumb'siz mogrt — karta ikonka bilan qoladi */
        }
      }
      let size = 0;
      try { size = fs.statSync(p).size || 0; } catch (e) { /* nomavjud/o'qib bo'lmadi */ }
      return {
        name: base,
        path: p,
        size,
        thumbPng: fs.existsSync(png) ? fileUrl(png) : "",
        thumbMp4: fs.existsSync(mp4) ? fileUrl(mp4) : "",
      };
    });
  }

  /** ZIP keshi ochilgan bo'lsa — undagi .mogrt elementlar (sync, yuklab olmaydi) */
  function cachedMogrtItems(templateId) {
    if (typeof window.__adobe_cep__ === "undefined") return [];
    try {
      const fs = __ffRequire("fs");
      const path = __ffRequire("path");
      const os = __ffRequire("os");
      const baseDir = downloadDir() || os.tmpdir();
      const cacheDir = unzipDirFor(fs, path, baseDir, templateId, findServerPackMeta(templateId).name); // P9
      if (!fs.existsSync(cacheDir)) return [];
      return mogrtItemsFromDir(fs, path, cacheDir);
    } catch {
      return [];
    }
  }

  /** Tanlangan .mogrt elementni import uchun .aep ga tayyorlaydi */
  async function extractMogrtItem(templateId, mogrtPath) {
    if (typeof window.__adobe_cep__ === "undefined") {
      throw new Error("Import requires the FrameFlow Adobe extension");
    }
    const fs = __ffRequire("fs");
    const path = __ffRequire("path");
    const os = __ffRequire("os");
    const { Buffer: NodeBuffer } = __ffRequire("buffer");
    if (!mogrtPath || !fs.existsSync(mogrtPath)) {
      throw new Error("MOGRT file not found — please re-download the pack.");
    }
    if (hostTemplateApp() === "pr") return mogrtPath;
    const baseDir = downloadDir() || os.tmpdir();
    return extractMogrtFileToAep(
      fs, path, NodeBuffer, baseDir, templateId, mogrtPath
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

  // ── Yaxlitlik (Mister Horse ishonchli-yuklash mexanizmi ekvivalenti) ──────────
  // COMPOSER-MECHANISM-ANALYSIS.md §3: og'ir I/O Node'da (host.jsx'da emas). Bu
  // yerda uni atomik-yozish + sha256 yaxlitlik bilan mustahkamlaymiz.

  const __packHashes = {}; // out yo'li → sha256 (sessiya keshi)

  /** Streaming sha256 (200MB'ni xotiraga yig'masdan — download oqim naqshiga mos). */
  function sha256FileAsync(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const fs = __ffRequire("fs");
        const crypto = __ffRequire("crypto");
        const h = crypto.createHash("sha256");
        const rs = fs.createReadStream(filePath);
        rs.on("data", (c) => h.update(c));
        rs.on("end", () => resolve(h.digest("hex")));
        rs.on("error", reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  function sha256Sidecar(p) {
    return p + ".sha256";
  }

  /**
   * QA-FIX #7: unzip kesh papkasi qaysi katalog fileSize bilan yuklab olinganini
   * eslab qoladi — pack yangilansa (fileSize o'zgaradi) eski keshdan import
   * qilinmaydi (aks holda footage/audio'siz eski nusxa xizmat qilaverardi).
   * Marker yo'q (eski avlod kesh) = eskirgan deb hisoblanadi — bir marta qayta
   * yuklab olinadi, keyin marker yoziladi.
   */
  function zipCacheMarker(path, cacheDir) {
    return path.join(cacheDir, ".assetflow_pack_size");
  }
  function zipCacheFresh(fs, path, cacheDir, expectedSize, expectedSha256) {
    if (!expectedSha256) return false;
    try {
      const rec = JSON.parse(String(fs.readFileSync(zipCacheMarker(path, cacheDir), "utf8")));
      return rec && rec.size === expectedSize && rec.sha256 === String(expectedSha256).toLowerCase();
    } catch {
      return false;
    }
  }
  function writeZipCacheMarker(fs, path, cacheDir, expectedSize, expectedSha256) {
    try {
      fs.writeFileSync(zipCacheMarker(path, cacheDir), JSON.stringify({ size: expectedSize || 0, sha256: String(expectedSha256 || "").toLowerCase() }), "utf8");
    } catch {
      /* marker yozilmadi — keyingi import qayta yuklab oladi, xolos */
    }
  }

  /** Fayl uchun yozib qo'yilgan hash (sidecar yoki sessiya keshi) — "" agar yo'q. */
  function recordedHash(fs, p) {
    try {
      const sp = sha256Sidecar(p);
      if (fs.existsSync(sp)) return String(fs.readFileSync(sp, "utf8")).trim();
    } catch {}
    return __packHashes[p] || "";
  }

  function recordHash(fs, p, hash) {
    if (!hash) return;
    __packHashes[p] = hash;
    try {
      fs.writeFileSync(sha256Sidecar(p), hash, "utf8");
    } catch {
      /* sidecar yozib bo'lmadi — sessiya keshida qoladi */
    }
  }

  /**
   * Idempotent kesh tekshiruvi: fayl bor + o'lcham mos + (kutilgan hash bo'lsa)
   * yozib qo'yilgan hash mos. Kutilgan hash yo'q bo'lsa — o'lcham bo'yicha (hozirgi
   * xatti-harakat). Mos kelmasa qayta yuklab olinadi (buzuq keshni qayta ishlatmaydi).
   */
  function cacheValid(fs, filePath, expectedSize, expectedSha256) {
    if (!cachedFileOk(fs, filePath, expectedSize)) return false;
    if (!expectedSha256) return false;
    const rec = recordedHash(fs, filePath);
    return !!rec && rec.toLowerCase() === String(expectedSha256).toLowerCase();
  }

  /**
   * Yuklab olingandan keyin yaxlitlik darvozasi: sha256 hisoblaydi; kutilgan hash
   * berilgan bo'lsa solishtiradi (mos kelmasa faylni o'chirib, aniq xato beradi —
   * buzuq/qisman pack import'ni bloklamasin); aks holda hash'ni yozib qo'yadi.
   * #96 (PL-d): kutilgan hash endi SERVERDAN keladi — pack endpointining
   * `X-Pack-Sha256` header'i (yoki chaqiruvchi bergan `opts.expectedSha256`).
   */
  async function verifyDownloadedFile(fs, filePath, expectedSha256) {
    if (!/^[0-9a-f]{64}$/i.test(String(expectedSha256 || ""))) {
      try { fs.rmSync(filePath, { force: true }); } catch {}
      throw new Error("Pack integrity metadata is missing — refresh the catalog and try again.");
    }
    const hash = await sha256FileAsync(filePath);
    if (hash.toLowerCase() !== String(expectedSha256).toLowerCase()) {
        try {
          fs.rmSync(filePath, { force: true });
        } catch {}
        const err = new Error("Pack integrity check failed (sha256 mismatch) — please try downloading again.");
        err.integrity = true;
        throw err;
    }
    recordHash(fs, filePath, hash);
    return hash;
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
        const fs = __ffRequire("fs");
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
   *
   * `opts` ixtiyoriy; xavfsiz defaultlar HTTPS, 3 GiB va 30 soniya timeoutni
   * majbur qiladi. Lokal test/dev transporti kerak bo'lsa `httpsOnly:false` aniq beriladi.
   *   opts.httpsOnly — boshlang'ich URL ham, HAR BIR redirect ham https bo'lishi SHART;
   *     downgrade (https→http) yoki https bo'lmagan sxema = darhol uzish + temp o'chirish.
   *   opts.maxBytes  — qattiq hajm chegarasi: Content-Length undan katta bo'lsa umuman
   *     yozilmaydi, oqim chegaradan oshgan zahoti uziladi va qisman fayl o'chiriladi.
   * Updater va pack/mogrt oqimlari bir xil fail-closed downloaderdan foydalanadi.
   */
  function downloadUrlToFile(url, destPath, onProgress, headers, opts) {
    return new Promise((resolve, reject) => {
      const fs = __ffRequire("fs");
      const httpsOnly = !opts || opts.httpsOnly !== false;
      const maxBytes = opts && Number(opts.maxBytes) > 0 ? Number(opts.maxBytes) : 3 * 1024 * 1024 * 1024;
      const timeoutMs = opts && Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 30000;
      const isHttps = (u) => /^https:\/\//i.test(String(u || ""));
      const startOrigin = urlOrigin(url);
      // #96 (PL-d): server yuklab olinadigan AYNAN shu obyektning sha256'ini
      // `X-Pack-Sha256` header'ida beradi. Header 302 javobida keladi (signed URL
      // GCS/R2'ga ketadi — u yerda header yo'q), shu bois BIRINCHI javobda o'qiymiz.
      let serverSha = "";
      const captureSha = (res) => {
        if (serverSha) return;
        const v = String(res.headers["x-pack-sha256"] || "").trim();
        if (/^[0-9a-f]{64}$/i.test(v)) {
          serverSha = v.toLowerCase();
          if (opts && typeof opts.onServerSha === "function") {
            try { opts.onServerSha(serverSha); } catch (e) {}
          }
        }
      };
      const holder = { req: null, ws: null, dest: destPath, cancelled: false, fail: null };
      __activeDownloads.add(holder);
      const cleanup = () => __activeDownloads.delete(holder);
      const failCancelled = () => {
        cleanup();
        const err = new Error("Download cancelled");
        err.cancelled = true;
        reject(err);
      };
      holder.fail = failCancelled;
      // Strict rejim uchun umumiy uzish: temp `.part` qoldirilmaydi, promise rad etiladi.
      const abortStrict = (msg) => {
        cleanup();
        try { if (holder.req) holder.req.destroy(); } catch (e) {}
        try { fs.rmSync(destPath + ".part", { force: true }); } catch (e) {}
        reject(new Error(msg));
      };
      const go = (u, redirectsLeft, hdrs) => {
        if (holder.cancelled) { failCancelled(); return; }
        // Strict: boshlang'ich URL va HAR BIR redirect https bo'lishi shart (downgrade = uzish).
        if (httpsOnly && !isHttps(u)) { abortStrict("Insecure (non-HTTPS) download URL"); return; }
        if (redirectsLeft <= 0) {
          cleanup();
          reject(new Error("Redirect limit"));
          return;
        }
        // Redirect protokolni almashtirishi mumkin (http↔https) — modulni URL'ga qarab tanlaymiz
        const lib = u.startsWith("https") ? __ffRequire("https") : __ffRequire("http");
        // Authorization faqat boshlang'ich API origin'iga; redirect boshqa
        // hostga ketsa header'ni tushiramiz (token leak oldini olish).
        const sameOrigin = !!hdrs && urlOrigin(u) === startOrigin && startOrigin !== "";
        const reqCb = (res) => {
          captureSha(res);
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
              let code; // P20: biznes-kod (LIMIT_REACHED / PRO_REQUIRED / ACCOUNT_BLOCKED) — caller tarmoqlansin
              try {
                const j = JSON.parse(body);
                if (j && j.error) msg = j.error;
                if (j && j.code) code = j.code;
              } catch (ignore) {}
              const err = new Error(msg);
              err.status = res.statusCode;
              err.code = code;
              reject(err);
            });
            res.on("error", () => { cleanup(); reject(new Error(`Pack HTTP ${res.statusCode}`)); });
            return;
          }
          const total = parseInt(res.headers["content-length"], 10) || 0;
          // Strict: e'lon qilingan hajm chegaradan katta bo'lsa — bitta bayt ham yozilmaydi.
          if (maxBytes && total > maxBytes) {
            try { res.destroy(); } catch (e) {}
            abortStrict("Download exceeds the size limit");
            return;
          }
          let done = 0;
          let lastTime = 0;
          // Atomik yozish: avval temp `.part` faylga oqim, tugagach rename → destPath.
          // Yarim-yozilgan pack HECH QACHON yakuniy yo'lda ko'rinmaydi (buzuq import'dan
          // himoya). Bekor qilinsa yoki xato bo'lsa faqat temp o'chadi.
          const partPath = destPath + ".part";
          holder.dest = partPath; // cancelDownload temp'ni o'chiradi, yakuniy faylni emas
          const ws = fs.createWriteStream(partPath);
          holder.ws = ws;
          // Birinchi baytda darhol ko'rsatamiz, keyin har ~250ms (MB hisoblagich jonli bo'lsin)
          if (onProgress) onProgress(0, total);
          let failed = false;
          const onFail = (e) => {
            if (failed) return; // birinchi xato hal qiladi (destroy ikkinchi hodisa bermasin)
            failed = true;
            cleanup();
            try { fs.rmSync(partPath, { force: true }); } catch {} // qisman temp'ni tozalash
            holder.cancelled ? failCancelled() : reject(e);
          };
          let overflowed = false;
          res.on("data", (chunk) => {
            if (holder.cancelled || overflowed) return;
            done += chunk.length;
            // Strict: chegaradan OSHGAN ZAHOTI uzamiz — disk to'lguncha kutmaymiz
            // (Content-Length yolg'on yoki umuman yo'q bo'lishi mumkin).
            if (maxBytes && done > maxBytes) {
              overflowed = true;
              try { res.unpipe(ws); } catch (e) {}
              try { res.destroy(); } catch (e) {}
              try { ws.destroy(); } catch (e) {}
              onFail(new Error("Download exceeds the size limit"));
              return;
            }
            if (onProgress) {
              const now = Date.now();
              if (now - lastTime > 250 || done === total) {
                lastTime = now;
                onProgress(done, total);
              }
            }
          });
          res.pipe(ws);
          ws.on("finish", () => {
            if (holder.cancelled) { onFail(new Error("cancelled")); return; }
            try {
              try { if (fs.existsSync(destPath)) fs.rmSync(destPath, { force: true }); } catch {}
              fs.renameSync(partPath, destPath); // atomik publish (bir xil fayl tizimi)
            } catch (e) {
              onFail(e);
              return;
            }
            cleanup();
            resolve(destPath);
          });
          ws.on("error", onFail);
          res.on("error", onFail);
        };
        const req = sameOrigin ? lib.get(u, { headers: hdrs }, reqCb) : lib.get(u, reqCb);
        holder.req = req;
        if(req&&typeof req.setTimeout==="function"){
          req.setTimeout(timeoutMs, () => abortStrict("Download timed out"));
        }
        req.on("error", (e) => {
          cleanup();
          if (holder.cancelled) failCancelled(); else reject(e);
        });
      };
      go(url, 8, headers || null);
    });
  }

  function retryableDownloadError(error) {
    if (!error || error.cancelled) return false;
    const status = Number(error.status) || 0;
    if (status) return status === 408 || status === 425 || status === 429 || status >= 500;
    return /timed?\s*out|timeout|network|fetch|socket|econn|reset|hang\s*up|aborted|load failed/i.test(String(error.message || error));
  }

  async function downloadUrlToFileWithRetry(url, destPath, onProgress, headers, opts) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // `headers` (including Idempotency-Key) is intentionally reused. If
        // the API consumed quota but its redirect/response was lost, retrying
        // this logical download cannot consume a second slot.
        return await downloadUrlToFile(url, destPath, onProgress, headers, opts);
      } catch (error) {
        lastError = error;
        if (attempt || !retryableDownloadError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
    throw lastError;
  }

  /**
   * M2: faqat tanlangan sahnaning .mogrt faylini yuklab olib .aep ga
   * tayyorlaydi — butun ZIP (200MB+) yuklanmaydi. Fayl
   * assetflow_<id>_mogrts/<slug>.mogrt da keshlanadi.
   */
  async function downloadSceneMogrt(templateId, scene, opts) {
    if (typeof window.__adobe_cep__ === "undefined") {
      throw new Error("Import requires the FrameFlow Adobe extension");
    }
    if (!scene || !scene.mogrtUrl) {
      throw new Error("Scene has no MOGRT URL");
    }
    const fs = __ffRequire("fs");
    const path = __ffRequire("path");
    const os = __ffRequire("os");
    const { Buffer: NodeBuffer } = __ffRequire("buffer");
    const slug = mogrtSlug(scene.slug || scene.aeComp || scene.n);
    const baseDir = downloadDir() || os.tmpdir();
    const dir = path.join(baseDir, `assetflow_${templateId}_mogrts`);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
    const out = path.join(dir, `${slug}.mogrt`);
    const requestId = String((opts && opts.downloadRequestId) || newDownloadRequestId());
    if (opts && !opts.downloadRequestId) opts.downloadRequestId = requestId;
    let _freshDownload = false;
    if (!cachedFileOk(fs, out, 0)) {
      if (typeof showToast === "function") showToast("Loading scene…");
      const onProgress = opts && opts.onProgress;
      let sceneSha = ""; // #96 (PL-d) — server hash bersa (X-Pack-Sha256) tekshiriladi
      await downloadUrlToFileWithRetry(scene.mogrtUrl, out, onProgress, downloadHeaders(requestId), {
        onServerSha: (h) => { sceneSha = h; },
        httpsOnly: true,
        maxBytes: 512 * 1024 * 1024,
        timeoutMs: 30000,
      });
      if (!cachedFileOk(fs, out, 0)) {
        try {
          fs.rmSync(out, { force: true });
        } catch {}
        throw new Error("MOGRT failed to download or file is empty");
      }
      // Yaxlitlik: sha256 record + kutilgan hash tekshiruvi (server header yoki opts)
      await verifyDownloadedFile(fs, out, (opts && opts.expectedSha256) || sceneSha || "");
      _freshDownload = true;
    }
    if (hostTemplateApp(opts && opts.hostApp) === "pr") return out;
    const result = await extractMogrtFileToAep(
      fs, path, NodeBuffer, baseDir, templateId, out
    );
    // Hisob endi faqat bitta joyda: Premiere'ga import muvaffaqiyatli bo'lgach
    // recordImport (HTML) chaqiriladi — shu yerda recordDownload chaqirilmaydi
    // (aks holda bitta foydalanuvchi harakati ikki marta hisoblanardi).
    void _freshDownload;
    return result;
  }

  async function downloadPackToTemp(templateId, fileName, opts) {
    if (typeof window.__adobe_cep__ === "undefined") {
      throw new Error("Import requires the FrameFlow Adobe extension");
    }
    const fs = __ffRequire("fs");
    const path = __ffRequire("path");
    const os = __ffRequire("os");
    const { Buffer: NodeBuffer } = __ffRequire("buffer");
    const ext = path.extname(fileName || "") || ".aep";
    const extLower = ext.toLowerCase();
    const templateApp = hostTemplateApp(opts && opts.hostApp);
    const baseDir = downloadDir() || os.tmpdir();
    const out = path.join(baseDir, `assetflow_${templateId}${ext}`);
    const meta = findServerPackMeta(templateId);
    const expectedSize = (opts && opts.fileSize) || meta.fileSize || 0;
    const expectedSha256 = (opts && opts.expectedSha256) || meta.sha256 || "";
    const onProgress = opts && opts.onProgress;
    const requestId = String((opts && opts.downloadRequestId) || newDownloadRequestId());
    if (opts && !opts.downloadRequestId) opts.downloadRequestId = requestId;

    // ZIP bo'lsa — unzip papkasini tekshiramiz (kesh)
    if (extLower === ".zip") {
      const cacheDir = unzipDirFor(fs, path, baseDir, templateId, meta.name); // P9: nom bilan
      // QA-FIX #7: pack serverда yangilangan bo'lsa (fileSize o'zgargan) eski
      // ochilgan keshni tashlab, yangisini yuklab olamiz.
      if (fs.existsSync(cacheDir) && !zipCacheFresh(fs, path, cacheDir, expectedSize, expectedSha256)) {
        try {
          fs.rmSync(cacheDir, { recursive: true, force: true });
        } catch {}
      }
      if (fs.existsSync(cacheDir)) {
        if (templateApp === "pr") {
          const projects = findAllFilesByExtInDir(fs, path, cacheDir, [".prproj"]);
          if (projects.length === 1) return projects[0];
          if (projects.length > 1) {
            throw new Error("This pack contains multiple Premiere projects. Choose a project in Contributor Studio before importing.");
          }
          const nativeMogrts = findAllFilesByExtInDir(fs, path, cacheDir, [".mogrt"]);
          if (nativeMogrts.length === 1) return nativeMogrts[0];
          if (nativeMogrts.length > 1) throw mogrtPackError(mogrtItemsFromDir(fs, path, cacheDir));
          if (findAepInDir(fs, path, cacheDir)) {
            throw new Error("This is an Premiere Pro project pack and cannot be imported into Premiere Pro.");
          }
        }
        const cached = findAepInDir(fs, path, cacheDir);
        if (cached) return cached;
        // .aep yo'q — ochilgan papkadan kengaytma bo'yicha topamiz (papka nomi muhim emas)
        const mogrts = findAllFilesByExtInDir(fs, path, cacheDir, [".mogrt"]);
        if (mogrts.length === 1) {
          return extractMogrtFileToAep(
            fs, path, NodeBuffer, baseDir, templateId, mogrts[0]
          );
        }
        if (mogrts.length > 1) {
          throw mogrtPackError(mogrtItemsFromDir(fs, path, cacheDir));
        }
        // P35 — footage-to'plami keshi: .aep/.mogrt yo'q, lekin media bor →
        // qayta yuklab olmaymiz (277MB'ni har importda emas), keshdan qaytaramiz.
        const cachedMedia = collectBundleMedia(fs, path, cacheDir);
        if (cachedMedia.length) {
          return { __footageBundle: true, dir: cacheDir, files: cachedMedia };
        }
      }
    } else if (
      extLower !== ".mogrt" &&
      cacheValid(fs, out, expectedSize, expectedSha256)
    ) {
      if (templateApp === "pr" && extLower === ".aep") {
        throw new Error("This is an Premiere Pro project pack and cannot be imported into Premiere Pro.");
      }
      if (templateApp === "ae" && extLower === ".prproj") {
        throw new Error("This is a Premiere Pro project pack and cannot be imported into Premiere Pro.");
      }
      // .mogrt bu yerdan o'tmaydi — Premiere kesh bo'lsa ham har import yangi extract oladi
      return out;
    }

    // Idempotent: yaroqli kesh bo'lsa qayta yuklamaymiz; yo'q/buzuq bo'lsa yuklaymiz
    const needDownload = !cacheValid(fs, out, expectedSize, expectedSha256);

    let _needRecord = false;
    if (needDownload) {
      const directUrl = (opts && opts.packUrl) || meta.url;
      // Har doim API gate orqali boshlaymiz: u immutable X-Pack-Sha256 headerini beradi.
      const url = `${apiBase()}/api/plugin/assets/${templateId}/pack?downloadRequestId=${encodeURIComponent(requestId)}`;
      if (typeof showToast === "function") {
        const mb =
          expectedSize > 0
            ? (expectedSize / 1048576).toFixed(0)
            : "?";
        showToast(`Downloading pack (~${mb} MB)…`);
      }
      // #96 (PL-d): server hash'i (X-Pack-Sha256) — yuklab olishdan keyin AYNAN
      // shu qiymat bilan solishtiriladi. Ilgari `expectedSha256`ni hech kim
      // bermasdi → yaxlitlik tekshiruvi abadiy no-op edi.
      let serverSha = "";
      const shaOpts = { onServerSha: (h) => { serverSha = h; }, httpsOnly: true, maxBytes: 3 * 1024 * 1024 * 1024, timeoutMs: 30000 };
      try {
        await downloadUrlToFileWithRetry(url, out, onProgress, downloadHeaders(requestId), shaOpts);
      } catch (e) {
        // Limit/nashr/sessiya xatosi (403/401) — fallback bilan yashirmaymiz
        if (e && (e.status === 401 || e.status === 403)) throw e;
        void directUrl;
        throw e;
      }
      if (!cachedFileOk(fs, out, 0)) {
        throw new Error("Pack failed to download or file is empty");
      }
      // Yaxlitlik: sha256 hisobla + kutilgan hash bo'lsa tekshir (aks holda yozib qo'y).
      // Server hash bermasa (eski API / hosila kesh hali hash'siz) — eski xulq.
      await verifyDownloadedFile(fs, out, expectedSha256 || serverSha || "");
      _needRecord = true;
    }

    // Hisob endi faqat bitta joyda: Premiere'ga import muvaffaqiyatli bo'lgach
    // recordImport (HTML) chaqiriladi. Bu yerda recordDownload chaqirilmaydi —
    // aks holda bitta foydalanuvchi harakati (yuklab olib import qilish) ikki
    // marta hisoblanardi. _needRecord/_record chaqiruv joylari (pastda)
    // minimal-diff uchun saqlab qolindi, faqat endi hech narsa qilmaydi.
    const _record = async () => { void _needRecord; };

    // Premiere can’t import .zip directly. If pack is a zip, extract and return first .aep inside.
    if (extLower === ".zip") {
      const finalDir = unzipDirFor(fs, path, baseDir, templateId, meta.name); // P9: nom bilan
      const stageDir = finalDir + ".part-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      let dir = stageDir;
      try {
        fs.mkdirSync(stageDir, { recursive: true });
      } catch {}
      // zip ichidagi .mogrt yo’llarini o’chirishdan OLDIN olamiz — papka nomi muhim emas
      const zipMogrts = listEntriesInZip(out, ".mogrt");
      if (typeof showToast === "function") showToast("Extracting pack…");
      try {
        // Papka strukturasi SAQLANADI (.aep'ning nisbiy footage/audio havolalari
        // buzilmaydi). Katta pack oqim bilan ochiladi — xotiraga to'liq yuklanmaydi.
        await zipLib().extractAll(out, stageDir, {
          onProgress: function (done, total) {
            if (typeof showToast === "function" && total > 40 && done % 25 === 0) {
              showToast(`Extracting pack… ${done}/${total}`);
            }
          },
        });
      } catch (e) {
        try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch {}
        throw new Error("Could not open ZIP. The pack must contain an .aep or .mogrt file.");
      }
      // Robustlik: ochish nol fayl chiqarsa (buzuq/bo'sh arxiv) — jimgina emas, aniq xato
      let __extracted = [];
      try { __extracted = fs.readdirSync(stageDir); } catch {}
      if (!__extracted.length) {
        try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch {}
        throw new Error("ZIP is empty or could not be opened — the pack may be corrupted.");
      }
      try {
        if (fs.existsSync(finalDir)) fs.rmSync(finalDir, { recursive: true, force: true });
        fs.renameSync(stageDir, finalDir);
        dir = finalDir;
      } catch (e) {
        try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch {}
        throw new Error("Could not publish the extracted pack atomically.");
      }
      // QA-FIX #7: kesh markeri — bu papka aynan shu fileSize'li pack'dan ochilgan.
      writeZipCacheMarker(fs, path, dir, expectedSize, expectedSha256 || serverSha);
      // Zip endi kerak emas — faqat ochilgan papka qoladi (sidecar hash ham)
      try {
        fs.rmSync(out, { force: true });
        fs.rmSync(sha256Sidecar(out), { force: true });
      } catch {}
      if (templateApp === "pr") {
        const projects = findAllFilesByExtInDir(fs, path, dir, [".prproj"]);
        if (projects.length === 1) { await _record(); return projects[0]; }
        if (projects.length > 1) {
          throw new Error("This pack contains multiple Premiere projects. Choose a project in Contributor Studio before importing.");
        }
        const nativeMogrts = findAllFilesByExtInDir(fs, path, dir, [".mogrt"]);
        if (nativeMogrts.length === 1) { await _record(); return nativeMogrts[0]; }
        if (nativeMogrts.length > 1) throw mogrtPackError(mogrtItemsFromDir(fs, path, dir));
        if (findAepInDir(fs, path, dir)) {
          throw new Error("This is an Premiere Pro project pack and cannot be imported into Premiere Pro.");
        }
      }
      const aep = findAepInDir(fs, path, dir);
      if (aep) { await _record(); return aep; }
      // .aep yo’q — zip entry yo’llari bo’yicha .mogrt’larni topamiz
      const mogrts = zipMogrts.map(e => path.join(dir, e)).filter(p => fs.existsSync(p));
      if (!mogrts.length) mogrts.push(...findAllFilesByExtInDir(fs, path, dir, [".mogrt"]));
      if (mogrts.length === 1) {
        const r = await extractMogrtFileToAep(
          fs, path, NodeBuffer, baseDir, templateId, mogrts[0]
        );
        await _record();
        return r;
      }
      if (mogrts.length > 1) {
        throw mogrtPackError(mogrtItemsFromDir(fs, path, dir));
      }
      // P35 — .aep/.mogrt YO'Q: bu FOOTAGE-to'plami (transitions/overlays/elements
      // bundle — raw-file ingest quvuri endi aynan shunday pack ishlab chiqaradi).
      // Ichidagi barcha import qilinadigan media'ni Premiere'ga FOOTAGE sifatida import
      // qilamiz (host importFootageBundle → shablon nomidagi bin). Bo'lmasa — aniq xato.
      const mediaFiles = collectBundleMedia(fs, path, dir);
      if (mediaFiles.length) {
        await _record();
        // Signal obyekt — HTML importPackFileToAE buni footage-bundle deb import qiladi.
        return { __footageBundle: true, dir: dir, files: mediaFiles };
      }
      throw new Error("No .aep or .mogrt found inside the ZIP. The pack file is invalid.");
    }

    // .mogrt — to’g’ridan yuklangan yakka fayl: extract (unikal papka,
    // .mogrt’ning o’zi kesh bo’lib qoladi, qayta yuklab olinmaydi).
    if (extLower === ".mogrt") {
      if (templateApp === "pr") { await _record(); return out; }
      const r = await extractMogrtFileToAep(
        fs, path, NodeBuffer, baseDir, templateId, out
      );
      await _record();
      return r;
    }

    if (templateApp === "pr" && extLower === ".aep") {
      throw new Error("This is an Premiere Pro project pack and cannot be imported into Premiere Pro.");
    }
    if (templateApp === "ae" && extLower === ".prproj") {
      throw new Error("This is a Premiere Pro project pack and cannot be imported into Premiere Pro.");
    }
    await _record();
    return out;
  }

  // ── FAZA 4: yetishmagan shrift hal qiluvchi (3 bosqich) ───────────────────
  // Import'dan keyin host.jsx aniqlagan missing shriftlar shu yerga keladi.
  // Har biri uchun: (1) Google Fonts / ochiq manba → yuklab OS font papkasiga
  // o'rnatamiz; (2) bo'lmasa Adobe Fonts → CC avtomat yoqadi (dasturiy majburlab
  // yoqib bo'lmaydi — foydalanuvchini xabardor qilamiz); (3) topilmasa → qo'lda.
  //
  // LITSENZIYA: faqat Google Fonts / ochiq-manba shriftni YUKLAYMIZ. Pullik
  // Adobe/maxsus shriftlar hech qachon yuklab tarqatilmaydi (a→CC yoki c→qo'lda).
  //
  // Google'ni BIRINCHI tekshiramiz: ochiq-manba bo'lgani uchun uni erkin
  // o'rnatishimiz mumkin (foydalanuvchi hech narsa qilmaydi). Google'da yo'q
  // bo'lsa — Adobe'da bormi tekshirib, bor bo'lsa CC yoqishini aytamiz.

  // Platformaga mos foydalanuvchi font papkasi (admin talab qilmaydi).
  function userFontsDir() {
    const os = __ffRequire("os");
    const path = __ffRequire("path");
    const fs = __ffRequire("fs");
    let dir;
    if (process.platform === "darwin") {
      dir = path.join(os.homedir(), "Library", "Fonts");
    } else if (process.platform === "win32") {
      const base =
        process.env.LOCALAPPDATA ||
        path.join(os.homedir(), "AppData", "Local");
      dir = path.join(base, "Microsoft", "Windows", "Fonts");
    } else {
      dir = path.join(os.homedir(), ".fonts");
    }
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    return dir;
  }

  // Oddiy GET (kichik javob) — status + tanani qaytaradi. Redirect'ni kuzatadi.
  function safeFontUrl(url, binary) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      const allowed = binary ? ["fonts.gstatic.com"] : ["fonts.googleapis.com", "fonts.adobe.com"];
      if (u.protocol !== "https:" || allowed.indexOf(host) < 0) throw new Error("Untrusted font host");
      return u.toString();
    } catch (e) { throw new Error("Untrusted font URL"); }
  }
  function httpGetText(url, extraHeaders, redirectsLeft) {
    return new Promise((resolve, reject) => {
      try { url = safeFontUrl(url, false); } catch (e) { reject(e); return; }
      if (redirectsLeft == null) redirectsLeft = 5;
      if (redirectsLeft <= 0) { reject(new Error("Redirect limit")); return; }
      const lib = url.indexOf("https") === 0 ? __ffRequire("https") : __ffRequire("http");
      const headers = Object.assign(
        { "Accept": "*/*" },
        extraHeaders || {}
      );
      const req = lib.get(url, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          let next = res.headers.location;
          try { next = new URL(next, url).toString(); } catch (e) {}
          try { next = safeFontUrl(next, false); } catch (e) { reject(e); return; }
          httpGetText(next, extraHeaders, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { if (body.length < 65536) body += c; });
        res.on("end", () => resolve({ status: res.statusCode, body }));
        res.on("error", reject);
      });
      req.setTimeout(12000, () => { req.destroy(new Error("timeout")); });
      req.on("error", reject);
    });
  }

  // Google Fonts KLASSIK /css endpoint — eski/UAsiz so'rovda .ttf URL qaytaradi
  // (Premiere .ttf/.otf kutadi, woff2 emas). Family topilmasa 400 qaytadi.
  async function googleFontTtfUrl(family) {
    const q = encodeURIComponent(String(family || "").trim()).replace(/%20/g, "+");
    if (!q) return null;
    const url = "https://fonts.googleapis.com/css?family=" + q;
    let res;
    try {
      // Google Fonts KLASSIK /css tanilmagan UA'ga TTF beradi (zamonaviy brauzer
      // UA'siga woff2 — Premiere uni o'qiy olmaydi). Shu sabab o'z UA'mizni yuboramiz.
      res = await httpGetText(url, { "User-Agent": "AssetFlow-FontFetcher/1.0" });
    } catch (e) { return null; }
    if (!res || res.status !== 200 || !res.body) return null;
    const m = res.body.match(/url\((https:\/\/[^)]+\.(?:ttf|otf))\)/i);
    return m ? m[1] : null;
  }

  // URL faylni to'g'ridan diskka yuklaydi (font — kichik, xotiraga to'g'ri).
  function downloadBinaryToFile(url, destPath, redirectsLeft) {
    return new Promise((resolve, reject) => {
      const fs = __ffRequire("fs");
      try { url = safeFontUrl(url, true); } catch (e) { reject(e); return; }
      if (redirectsLeft == null) redirectsLeft = 5;
      if (redirectsLeft <= 0) { reject(new Error("Redirect limit")); return; }
      const lib = url.indexOf("https") === 0 ? __ffRequire("https") : __ffRequire("http");
      const req = lib.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          let next = res.headers.location;
          try { next = new URL(next, url).toString(); } catch (e) {}
          try { next = safeFontUrl(next, true); } catch (e) { reject(e); return; }
          downloadBinaryToFile(next, destPath, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error("HTTP " + res.statusCode));
          return;
        }
        const maxBytes = 20 * 1024 * 1024;
        const declared = parseInt(res.headers["content-length"], 10) || 0;
        const contentType = String(res.headers["content-type"] || "").toLowerCase();
        if (declared > maxBytes || (contentType && !/(font|octet-stream|truetype|opentype)/.test(contentType))) {
          res.destroy(); reject(new Error("Invalid or oversized font response")); return;
        }
        const partPath = destPath + ".part";
        const ws = fs.createWriteStream(partPath);
        let written = 0;
        res.on("data", (chunk) => {
          written += chunk.length;
          if (written > maxBytes) { res.destroy(); ws.destroy(); try { fs.rmSync(partPath,{force:true}); } catch(e){} reject(new Error("Font exceeds size limit")); }
        });
        res.pipe(ws);
        ws.on("finish", () => {
          try {
            const fd=fs.openSync(partPath,"r"),head=Buffer.alloc(4);try{fs.readSync(fd,head,0,4,0);}finally{fs.closeSync(fd);}
            const magic=head.toString("ascii"),hex=head.toString("hex");
            if (!(hex==="00010000"||magic==="OTTO"||magic==="true"||magic==="ttcf")) throw new Error("Downloaded file is not a valid TTF/OTF font");
            try { if (fs.existsSync(destPath)) fs.rmSync(destPath, { force: true }); } catch (e) {}
            fs.renameSync(partPath, destPath);
          } catch (e) { reject(e); return; }
          resolve(destPath);
        });
        ws.on("error", (e) => { try { fs.rmSync(partPath, { force: true }); } catch (x) {} reject(e); });
        res.on("error", (e) => { try { fs.rmSync(partPath, { force: true }); } catch (x) {} reject(e); });
      });
      req.setTimeout(20000, () => { req.destroy(new Error("timeout")); });
      req.on("error", reject);
    });
  }

  function safeFontFileName(family, ext) {
    const base = String(family || "font").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return (base || "font") + (ext || ".ttf");
  }

  // Windows'da per-user font'ni ro'yxatga qo'shish (restart'siz ham Premiere ko'rishi
  // uchun). Best-effort — muvaffaqiyatsiz bo'lsa restart baribir yordam beradi.
  function registerWindowsUserFont(filePath, family) {
    if (process.platform !== "win32") return;
    try {
      const child = __ffRequire("child_process");
      const valueName = String(family || "AssetFlow Font") + " (TrueType)";
      child.execFileSync("reg", [
        "add",
        "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
        "/v", valueName,
        "/t", "REG_SZ",
        "/d", filePath,
        "/f"
      ], { stdio: "ignore", timeout: 8000 });
    } catch (e) { /* best-effort */ }
  }

  // Adobe Fonts'da shu family bormi? (best-effort — public font sahifasi 200 bersa).
  async function isAdobeFont(family) {
    const slug = String(family || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) return false;
    const url = "https://fonts.adobe.com/fonts/" + slug;
    try {
      const res = await httpGetText(url, {
        "User-Agent": "Mozilla/5.0 (compatible; AssetFlow/1.0)"
      });
      return !!res && res.status === 200;
    } catch (e) { return false; }
  }

  // Bitta shriftni hal qiladi → { name, status, message }.
  //   status: "installed" | "adobe" | "manual" | "error"
  async function resolveOneFont(font) {
    const family = String((font && (font.family || font.postScript)) || "").trim();
    if (!family) return { name: "(unknown)", status: "manual", message: "Font name missing" };

    // 1) Google Fonts / ochiq manba → yuklab o'rnatamiz.
    try {
      const ttfUrl = await googleFontTtfUrl(family);
      if (ttfUrl) {
        const path = __ffRequire("path");
        const ext = /\.otf($|\?)/i.test(ttfUrl) ? ".otf" : ".ttf";
        const dir = userFontsDir();
        const dest = path.join(dir, safeFontFileName(family, ext));
        await downloadBinaryToFile(ttfUrl, dest);
        registerWindowsUserFont(dest, family);
        return {
          name: family,
          status: "installed",
          message: "Installed from Google Fonts — restart Premiere"
        };
      }
    } catch (e) {
      // yuklab o'rnatishda xato — Adobe/manual bosqichiga o'tamiz
    }

    // 2) Adobe Fonts → CC avtomat yoqadi (dasturiy majburlab bo'lmaydi).
    try {
      if (await isAdobeFont(family)) {
        return {
          name: family,
          status: "adobe",
          message: "Adobe Font — Creative Cloud will activate it automatically (keep CC open)"
        };
      }
    } catch (e) {}

    // 3) Topilmadi — qo'lda o'rnatish.
    return {
      name: family,
      status: "manual",
      message: "Not found — install it manually"
    };
  }

  // Missing shriftlar ro'yxatini ketma-ket hal qiladi. `onStatus(result, index,
  // total)` har shrift tugagach chaqiriladi (jonli UI uchun). Faqat Premiere (Node)
  // ichida ishlaydi; brauzer preview'da bo'sh qaytaradi.
  //
  // #99 (PL-g): bu funksiya OS shrift papkasiga YOZADI (Windows'da HKCU registriga
  // ham). Foydalanuvchi ROZILIGI — chaqiruvchining mas'uliyati; panelda
  // `confirmFontInstall()` dialogi shu vazifani bajaradi. Rozilikni so'ramasdan
  // chaqirmang.
  async function resolveMissingFonts(fonts, onStatus) {
    const list = Array.isArray(fonts) ? fonts : [];
    const results = [];
    if (typeof window !== "undefined" && typeof window.__adobe_cep__ === "undefined") {
      return results; // Premiere tashqarisida OS font papkasiga yozmaymiz
    }
    for (let i = 0; i < list.length; i++) {
      let r;
      try {
        r = await resolveOneFont(list[i]);
      } catch (e) {
        const nm = String((list[i] && (list[i].family || list[i].postScript)) || "shrift");
        r = { name: nm, status: "error", message: String((e && e.message) || e) };
      }
      results.push(r);
      if (typeof onStatus === "function") {
        try { onStatus(r, i, list.length); } catch (cbErr) {}
      }
    }
    return results;
  }

  return {
    apiBase,
    resolveMissingFonts,
    fetchCatalog,
    fetchFeatured,
    fetchHomeShelf,
    refreshFeatured,
    refreshBrowse,
    loadMoreBrowse,
    browseHasMore,
    isBrowseLoading,
    loadPackScenes,
    fetchTemplateDetail,
    mergeIntoBrowse,
    downloadPackToTemp,
    downloadSceneMogrt,
    newDownloadRequestId,
    downloadUrlToFile,
    // downloadUrlToFile `opts` (httpsOnly/maxBytes) ni QO'LLAB-QUVVATLAYDI. Updater shu
    // bayroqni tekshiradi: eski nusxa yonida ishga tushsa — hech narsa yuklamaydi.
    downloadStrictSupported: true,
    cancelDownload,
    hasActiveDownload,
    mogrtCompName,
    cachedMogrtItems,
    extractMogrtItem,
    downloadDir,
    unzipDirName,
    isCacheEntryName,
    isTemplateCacheEntryName,
    configuredDownloadDir,
    saveDownloadDir,
    pruneOldTempDirs,
    serverCountForNav,
    totalServerCount,
    primaryServerNav,
    navHint,
    getCountByNav: () => ({ ...countByNav }),
  };
})();

if (typeof window !== "undefined") window.AssetFlowCatalog = AssetFlowCatalog;
