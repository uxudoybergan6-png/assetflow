/**
 * Server katalog — tasdiqlangan shablonlar (API)
 */
const AssetFlowCatalog = (() => {
  const DEFAULT_API = "http://localhost:4000";
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
      packs[u.name] = {
        ico: u.icon || "✦",
        bg: u.bg,
        sub: `${NAV_LABELS_REF[u.nav] || u.nav} · ${u.catLabel} · ${resLabel}`,
        preview: preview || undefined,
        scenes,
        aeScenesFolder: meta.scenesFolder || meta.aeScenesFolder || "Scenes",
        server: true,
        serverTemplateId: u.id,
        hasPack: u.hasPack !== false,
        serverPackUrl: u.packUrl || undefined,
        fileName: u.hasPack ? u.fileName || "template.aep" : "template.aep",
        templateApp: u.templateApp || "ae",
        catLabel: u.catLabel,
        orient: u.orient,
        res: u.res,
        nav: u.nav,
        description: (u.description || "").trim(),
      };
      assets.push({
        n: u.name,
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
    const data = await fetchCatalog();
    const n = mergeIntoBrowse(data.items || []);
    if (n > 0) await refreshFeatured();
    if (n > 0 && typeof window !== "undefined") {
      if (typeof buildCategoryMenu === "function") buildCategoryMenu(window.currentNav || "video");
      if (typeof render === "function") render();
      if (typeof updateServerNavBadges === "function") updateServerNavBadges();
    }
    return n;
  }

  async function downloadPackToTemp(templateId, fileName) {
    if (typeof window.__adobe_cep__ === "undefined") {
      throw new Error("Faqat After Effects ichida import");
    }
    const url = `${apiBase()}/api/plugin/assets/${templateId}/pack`;
    const res = await fetch(url, { headers: catalogHeaders() });
    if (res.status === 404) {
      throw new Error("Pack (.aep) fayli yo'q — contributor Studio'dan loyiha faylini yuklashi kerak");
    }
    if (!res.ok) throw new Error(`Pack HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const child = require("child_process");
    const ext = path.extname(fileName || "") || ".aep";
    const out = path.join(os.tmpdir(), `assetflow_${templateId}${ext}`);
    fs.writeFileSync(out, buf);

    // AE can't import .zip directly. If pack is a zip, extract and return first .aep inside.
    if (ext.toLowerCase() === ".zip") {
      const dir = path.join(os.tmpdir(), `assetflow_${templateId}_unzipped`);
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
      try {
        // macOS ships `unzip` by default.
        child.execFileSync("unzip", ["-o", out, "-d", dir], { timeout: 60_000 });
      } catch (e) {
        throw new Error("ZIP ochilmadi. Pack ichida .aep bo‘lishi kerak.");
      }
      const stack = [dir];
      while (stack.length) {
        const cur = stack.pop();
        let items = [];
        try {
          items = fs.readdirSync(cur);
        } catch {
          continue;
        }
        for (const name of items) {
          const p = path.join(cur, name);
          let st;
          try {
            st = fs.statSync(p);
          } catch {
            continue;
          }
          if (st.isDirectory()) stack.push(p);
          else if (String(name).toLowerCase().endsWith(".aep")) {
            return p;
          }
        }
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
    serverCountForNav,
    totalServerCount,
    primaryServerNav,
    navHint,
    getCountByNav: () => ({ ...countByNav }),
  };
})();

if (typeof window !== "undefined") window.AssetFlowCatalog = AssetFlowCatalog;
