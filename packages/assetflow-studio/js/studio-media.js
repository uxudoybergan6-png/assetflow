/**
 * Template media — API asset URL and preview HTML
 */
const StudioMedia = (() => {
  function apiBase() {
    return (
      (typeof window !== "undefined" &&
        (window.ASSETFLOW_STUDIO?.mediaUrl || window.ASSETFLOW_STUDIO?.apiUrl)) ||
      "https://api.getframeflow.app"
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

  /** P1 (step 32) — asset media sinfini aniqlaydi (moderatsiya pleyeri uchun). */
  function mediaClassOf(t) {
    const st = t.stockType || "";
    const tt = t.templateType || "";
    if (st === "music" || st === "sfx" || tt === "music" || tt === "sfx") return "audio";
    if (st === "graphics" || tt === "graphics") return "image";
    if (st === "motion-graphics" || tt === "motion-graphics") return "video";
    if (tt === "luts") return "lut";
    return "video"; // video-templates (preview = render video)
  }

  /** Large preview (moderation / drawer) — kind-aware: video/audio pleyer, image, LUT. */
  function renderPreview(t, opts = {}) {
    const aspect = opts.aspect || "16/10";
    const style = `width:100%;aspect-ratio:${aspect};object-fit:${opts.fit || "cover"};background:#0f0f14;border-radius:${opts.radius || "0"};display:block;max-height:${opts.maxHeight || "none"}`;
    const grad = t.grad || "g1";
    const mc = mediaClassOf(t);
    const previewSrc = escapeAttr(t.previewUrl || assetUrl(t.id, "preview"));
    const thumbSrc = escapeAttr(t.thumbUrl || assetUrl(t.id, "thumb"));
    const hasPreview = t.id && (hasAsset(t, "preview") || t.previewUrl);
    const hasThumb = t.id && (hasAsset(t, "thumb") || t.thumbUrl);

    // AUDIO (Music / SFX) — inline audio pleyer (video EMAS). Suv belgili preview.mp3.
    if (mc === "audio" && hasPreview) {
      return `<div style="width:100%;aspect-ratio:${aspect};background:#0f0f14;border-radius:${opts.radius || "0"};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px">
        <div style="font-size:26px;color:var(--tx-2)">${ic("play")}</div>
        <audio controls preload="metadata" src="${previewSrc}" style="width:100%;max-width:420px"></audio>
        <span class="small" style="color:var(--tx-2)">Watermarked preview — original is clean</span>
      </div>`;
    }
    // IMAGE (Graphics) — suv belgili thumb'ni to'liq ko'rsatamiz (contain, kesilmasin).
    if (mc === "image" && hasThumb) {
      return `<img class="studio-preview-img" alt="" src="${thumbSrc}" style="${style.replace("object-fit:cover", "object-fit:contain")}" />`;
    }
    // LUT — vizual media yo'q; toza fayl pack'da.
    if (mc === "lut") {
      return `<div class="thumb ${grad} grain" style="width:100%;aspect-ratio:${aspect};display:grid;place-items:center"><span class="small" style="color:var(--tx-2);padding:12px;text-align:center">${ic("sliders")} LUT file — download to preview in your grading tool</span></div>`;
    }
    // VIDEO (video-templates render + motion-graphics stock).
    if (hasPreview) {
      return `<video class="studio-preview-video" controls playsinline preload="auto" src="${previewSrc}" style="${style}"></video>`;
    }
    if (hasThumb) {
      return `<img class="studio-preview-img" alt="" src="${thumbSrc}" style="${style}" />`;
    }
    return `<div class="thumb ${grad} grain" style="width:100%;aspect-ratio:${aspect};display:grid;place-items:center"><span class="small" style="color:var(--tx-2);padding:12px;text-align:center">${ic("film")} Preview not uploaded</span></div>`;
  }

  /** Small thumbnail (table / queue) */
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
      parts.push(`<span class="small" style="color:var(--orange)">Files not uploaded</span>`);
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
    mediaClassOf,
  };
})();

if (typeof window !== "undefined") window.StudioMedia = StudioMedia;
