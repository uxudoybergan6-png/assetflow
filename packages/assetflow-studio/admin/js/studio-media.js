/**
 * Shablon media — API asset URL va preview HTML
 */
const StudioMedia = (() => {
  function apiBase() {
    return (
      (typeof window !== "undefined" &&
        (window.ASSETFLOW_STUDIO?.mediaUrl || window.ASSETFLOW_STUDIO?.apiUrl)) ||
      "https://assetflow-rqbq.onrender.com"
    ).replace(/\/$/, "");
  }

  function assetUrl(templateId, kind) {
    if (!templateId) return "";
    return `${apiBase()}/api/plugin/assets/${templateId}/${kind}`;
  }

  function hasAsset(t, kind) {
    if (t?.assets && typeof t.assets[kind] === "boolean") return t.assets[kind];
    return false;
  }

  function escapeAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtml(s) {
    return escapeAttr(s).replace(/>/g, "&gt;");
  }

  /** Katta preview (moderatsiya / drawer) */
  function renderPreview(t, opts = {}) {
    const h = opts.height || "auto";
    const aspect = opts.aspect || "16/10";
    const style = `width:100%;aspect-ratio:${aspect};object-fit:cover;background:#0f0f14;border-radius:${opts.radius || "0"};display:block;max-height:${opts.maxHeight || "none"}`;
    const grad = t.grad || "g1";
    const fallback = `<div class="thumb ${grad} grain" style="width:100%;aspect-ratio:${aspect};display:grid;place-items:center"><span class="small" style="color:var(--tx-2);padding:12px;text-align:center">${ic("film")} Preview yuklanmagan</span></div>`;

    if (t.id && (hasAsset(t, "preview") || t.previewUrl)) {
      const src = escapeAttr(t.previewUrl || assetUrl(t.id, "preview"));
      return `<video class="studio-preview-video" controls playsinline preload="auto" src="${src}" style="${style}"></video>`;
    }
    if (t.id && (hasAsset(t, "thumb") || t.thumbUrl)) {
      const src = escapeAttr(t.thumbUrl || assetUrl(t.id, "thumb"));
      return `<img class="studio-preview-img" alt="" src="${src}" style="${style}" />`;
    }
    return fallback;
  }

  /** Kichik thumbnail (jadval / navbat) */
  function renderThumb(t, size) {
    const lg = size === "lg";
    const h = lg ? "100%" : "42px";
    const w = lg ? "100%" : "64px";
    const box = `width:${w};height:${h};object-fit:cover;border-radius:var(--r-sm);background:#0a0a0f;display:block`;
    if (t.id && hasAsset(t, "thumb")) {
      const src = escapeAttr(t.thumbUrl || assetUrl(t.id, "thumb"));
      return `<img src="${src}" alt="" style="${box}" onerror="this.outerHTML='${thumbArt(t.grad || "g1", t.dur || "", size).replace(/'/g, "\\'")}'" />`;
    }
    if (t.id && hasAsset(t, "preview")) {
      const src = escapeAttr(t.previewUrl || assetUrl(t.id, "preview"));
      return `<video src="${src}" muted playsinline preload="metadata" style="${box}"></video>`;
    }
    return thumbArt(t.grad || "g1", t.dur || "", size);
  }

  function filePills(t) {
    const parts = [];
    if (t.assets?.preview || t.previewUrl) {
      parts.push(
        `<a class="pill" href="${escapeAttr(t.previewUrl || assetUrl(t.id, "preview"))}" target="_blank" rel="noopener">${ic("film")} preview</a>`
      );
    }
    if (t.assets?.thumb || t.thumbUrl) {
      parts.push(
        `<a class="pill" href="${escapeAttr(t.thumbUrl || assetUrl(t.id, "thumb"))}" target="_blank" rel="noopener">${ic("image")} thumb</a>`
      );
    }
    if (t.assets?.pack || t.fileName) {
      parts.push(
        `<a class="pill" href="${escapeAttr(t.packUrl || assetUrl(t.id, "pack"))}" target="_blank" rel="noopener">${ic("file")} ${escapeAttr(t.fileName || "pack")}</a>`
      );
    }
    if (!parts.length) {
      parts.push(`<span class="small" style="color:var(--orange)">Fayllar yuklanmagan</span>`);
    }
    return parts.join("");
  }

  return {
    apiBase,
    assetUrl,
    hasAsset,
    escapeHtml,
    escapeAttr,
    renderPreview,
    renderThumb,
    filePills,
  };
})();

if (typeof window !== "undefined") window.StudioMedia = StudioMedia;
