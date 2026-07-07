/**
 * API ↔ Studio UI (TEMPLATES array)
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
      "https://assetflow-api-331762958776.europe-west1.run.app"
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
      // Real counters (AE plugin usage) — legacy meta.dl is fallback only
      dl: typeof t.downloadsCount === "number" ? t.downloadsCount : meta.dl || 0,
      imports: typeof t.importsCount === "number" ? t.importsCount : 0,
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
      // Per-template tier (set by admin). API returns isPro via include.
      isPro: !!t.isPro,
      // #15: preview background-transcode status ('pending'|'done'|'failed'|null) — for UI badge
      previewTranscodeStatus: t.previewTranscodeStatus || null,
      // Bosqich 2 #2: pack malware/dedup skan holati — approve blokining sababini ko'rsatadi
      // ('clean'|'pending'|'quarantined'|'malicious'|'duplicate'|null)
      packScanStatus: t.packScanStatus || null,
      packScanDetail: t.packScanDetail || null,
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
    // scope=moderation only returns PENDING_REVIEW — we don't drop soft entries
    // (the Soft filter tab relies on soft records loaded by scope=all)
    const rest = (typeof TEMPLATES !== "undefined" ? TEMPLATES : []).filter(
      (t) => t.status !== "pending"
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
          status: u.status || "active",
          joined: (u.createdAt || "").slice(0, 10),
          templates: u.templateCount ?? 0,
        }))
      );
    }
    if (typeof window !== "undefined") {
      window._ASSETFLOW_ADMIN_STATS = data.stats || null;
      if (typeof ACTIVITY !== "undefined" && Array.isArray(data.recent)) {
        ACTIVITY.splice(
          0,
          ACTIVITY.length,
          ...data.recent.map((r) => ({
            who: r.contributor?.name || r.contributor?.email || "Contributor",
            verb:
              r.reviewStatus === "APPROVED"
                ? "approved"
                : r.reviewStatus === "PENDING_REVIEW"
                  ? "submitted"
                  : "updated",
            obj: r.name,
            t: (r.updatedAt || "").slice(0, 16).replace("T", " "),
            cls:
              r.reviewStatus === "APPROVED"
                ? "green"
                : r.reviewStatus === "REJECTED"
                  ? "orange"
                  : "violet",
            ic:
              r.reviewStatus === "APPROVED"
                ? "check"
                : r.reviewStatus === "REJECTED"
                  ? "reply"
                  : "upload",
          }))
        );
      }
    }
    return true;
  }

  async function loadAuditLogs() {
    if (!hasToken()) return false;
    try {
      const { items } = await StudioApi.listAuditLogs("?limit=80");
      if (typeof AUDIT !== "undefined") {
        AUDIT.splice(
          0,
          AUDIT.length,
          ...items.map((i) => ({
            action: i.action,
            actor: i.who,
            target: i.detail || i.targetId || "—",
            t: String(i.createdAt || "").slice(0, 16).replace("T", " "),
            ip: "—",
          }))
        );
      }
      if (typeof ACTIVITY !== "undefined" && items.length) {
        ACTIVITY.splice(
          0,
          ACTIVITY.length,
          ...items.slice(0, 8).map((i) => {
            const m =
              typeof AUDIT_META !== "undefined" ? AUDIT_META[i.action] : null;
            return {
              who: i.who,
              verb: (m?.label || i.action).toLowerCase(),
              obj: i.detail || i.targetId || "",
              t: String(i.createdAt || "").slice(0, 16).replace("T", " "),
              cls: m?.cls || "violet",
              ic: m?.ic || "clock",
            };
          })
        );
      }
      return true;
    } catch (e) {
      console.warn("loadAuditLogs", e);
      return false;
    }
  }

  async function loadPluginAnalytics() {
    if (!hasToken()) return false;
    try {
      const data = await StudioApi.pluginAnalytics();
      if (typeof window !== "undefined") {
        window._ASSETFLOW_PLUGIN_ANALYTICS = data;
        if (typeof applyActivityByDay === "function" && data.activityByDay) {
          applyActivityByDay(data.activityByDay);
        } else if (typeof applyActivityByDay === "function") {
          applyActivityByDay([]);
        }
        window._ASSETFLOW_SUBSCRIBER_STATS = {
          total: data?.subscribers?.total ?? 0,
          active: data?.subscribers?.activeLast7d ?? 0,
          blocked: data?.subscribers?.byStatus?.blocked ?? 0,
          removed: data?.subscribers?.byStatus?.removed ?? 0,
          online: data?.subscribers?.activeLast24h ?? 0,
          totalDownloads: data?.usage?.downloadsTotal ?? 0,
          free: data?.subscribers?.byPlan?.free ?? 0,
          pro: data?.subscribers?.byPlan?.pro ?? 0,
        };
      }
      return true;
    } catch (e) {
      console.warn("loadPluginAnalytics", e);
      return false;
    }
  }

  async function init(role) {
    if (!hasToken()) return false;
    try {
      if (role === "admin") {
        await loadForAdmin();
        await loadAdminContributors();
        await loadPluginAnalytics();
        await loadAuditLogs();
        if (typeof syncRejectReasons === "function") syncRejectReasons();
      } else {
        await loadForContributor();
      }
      return true;
    } catch (e) {
      console.warn("StudioTemplates.init", e);
      if (typeof toast === "function") {
        toast("API", e.message || "Failed to load data", "warn");
      }
      return false;
    }
  }

  async function refreshAfterUpload() {
    return loadForContributor();
  }

  async function refreshAfterReview() {
    await loadForAdmin();
    await loadAdminContributors();
    await loadAuditLogs();
    await loadPluginAnalytics();
    if (typeof syncRejectReasons === "function") syncRejectReasons();
    return true;
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
    loadPluginAnalytics,
    loadAuditLogs,
  };
})();

if (typeof window !== "undefined") window.StudioTemplates = StudioTemplates;
