/**
 * API ↔ Studio UI (TEMPLATES massivi)
 */
const StudioTemplates = (() => {
  const GRAD_CYCLE = ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8", "g9", "g10"];

  function mapStatus(t) {
    const rs = t.reviewStatus;
    if (rs === "APPROVED") return "approved";
    if (rs === "PENDING_REVIEW") return "pending";
    if (rs === "DRAFT") return "draft";
    if (rs === "REJECTED") {
      const note = (t.reviewNote || "").toLowerCase();
      if (note.includes("[hard]") || note.includes("hard reject")) return "hard";
      return "soft";
    }
    return "pending";
  }

  function apiBase() {
    return (
      (typeof window !== "undefined" &&
        (window.ASSETFLOW_STUDIO?.mediaUrl || window.ASSETFLOW_STUDIO?.apiUrl)) ||
      "http://localhost:4000"
    ).replace(/\/$/, "");
  }

  function mapApiItem(t, i = 0) {
    const meta = (t.metaJson && typeof t.metaJson === "object" ? t.metaJson : {}) || {};
    const created = (t.createdAt || t.updatedAt || "").slice(0, 10);
    const assets = t.assets || {};
    const base = apiBase();
    const id = t.id;
    return {
      id,
      name: t.name,
      cat: t.catLabel || t.cat,
      cid: t.contributorId || t.contributor?.id,
      status: mapStatus(t),
      created,
      dur: meta.dur || "—",
      dl: meta.dl || 0,
      res: (t.res || "4k").toUpperCase().replace("4K", "4K"),
      orient:
        t.orient === "vertical"
          ? "Portrait"
          : t.orient === "square"
            ? "Square"
            : "Landscape",
      grad: meta.grad || GRAD_CYCLE[i % GRAD_CYCLE.length],
      size:
        meta.size ||
        (t.fileSize ? `${(t.fileSize / 1024 / 1024).toFixed(1)} MB` : "—"),
      isNew: t.reviewStatus === "PENDING_REVIEW",
      desc: t.description || "",
      tags: t.tags || [],
      reason: t.reviewNote || "",
      assets,
      thumbUrl: assets.thumb ? `${base}/api/plugin/assets/${id}/thumb` : null,
      previewUrl: assets.preview ? `${base}/api/plugin/assets/${id}/preview` : null,
      packUrl: assets.pack ? `${base}/api/plugin/assets/${id}/pack` : null,
      fileName: t.fileName || null,
      _api: t,
      _con: t.contributor
        ? { id: t.contributor.id, name: t.contributor.name || "", email: t.contributor.email || "" }
        : null,
    };
  }

  function replaceTemplates(items) {
    if (typeof TEMPLATES === "undefined") return;
    TEMPLATES.splice(0, TEMPLATES.length, ...items);
  }

  function hasToken() {
    return !!(typeof StudioApi !== "undefined" && StudioApi.token());
  }

  async function loadForContributor() {
    if (!hasToken()) return false;
    const { items } = await StudioApi.listTemplates("scope=mine");
    replaceTemplates(items.map(mapApiItem));
    return true;
  }

  async function loadForAdmin() {
    if (!hasToken()) return false;
    const { items } = await StudioApi.listTemplates("scope=all");
    replaceTemplates(items.map(mapApiItem));
    return true;
  }

  async function loadModerationOnly() {
    if (!hasToken()) return false;
    const { items } = await StudioApi.listTemplates("scope=moderation");
    const pending = items.map(mapApiItem);
    const rest = (typeof TEMPLATES !== "undefined" ? TEMPLATES : []).filter(
      (t) => !["pending", "soft"].includes(t.status)
    );
    replaceTemplates([...pending, ...rest.filter((r) => !pending.some((p) => p.id === r.id))]);
    return true;
  }

  async function loadAdminContributors() {
    if (!hasToken()) return false;
    const data = await StudioApi.adminOverview();
    if (typeof CONTRIBUTORS !== "undefined" && data.contributors) {
      CONTRIBUTORS.splice(
        0,
        CONTRIBUTORS.length,
        ...data.contributors.map((u) => ({
          id: u.id,
          name: u.name || u.email,
          email: u.email,
          status: "active",
          joined: (u.createdAt || "").slice(0, 10),
          templates: u.templateCount ?? 0,
        }))
      );
    }
    if (typeof window !== "undefined") {
      window._ASSETFLOW_ADMIN_STATS = data.stats || null;
    }
    return true;
  }

  async function init(role) {
    if (!hasToken()) return false;
    try {
      if (role === "admin") {
        await loadForAdmin();
        await loadAdminContributors();
      } else await loadForContributor();
      return true;
    } catch (e) {
      console.warn("StudioTemplates.init", e);
      if (typeof toast === "function") {
        toast("API", e.message || "Ma'lumot yuklanmadi", "warn");
      }
      return false;
    }
  }

  async function refreshAfterUpload() {
    return loadForContributor();
  }

  async function refreshAfterReview() {
    await loadForAdmin();
    return loadAdminContributors();
  }

  return {
    mapApiItem,
    replaceTemplates,
    init,
    loadForContributor,
    loadForAdmin,
    loadModerationOnly,
    refreshAfterUpload,
    refreshAfterReview,
    loadAdminContributors,
  };
})();

if (typeof window !== "undefined") window.StudioTemplates = StudioTemplates;
