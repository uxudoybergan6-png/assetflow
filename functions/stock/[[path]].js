/**
 * P2 (step 31) — /stock/* uchun CF Pages Function.
 *
 * Ikki vazifa:
 *   1) SPA qobig'ini beradi (env.ASSETS.fetch → dist/index.html) — _redirects'da /*
 *      catch-all YO'Q, shuning uchun hard-refresh'da /stock/... aks holda 404 bo'lardi.
 *   2) ASSET yo'li uchun (/stock/<type>/<slug>-<shortId>) API'dan metadata olib,
 *      HTMLRewriter bilan og:title/og:description/og:image/twitter:card/canonical
 *      joylashtiradi — Telegram/Twitter/Slack havolada RASM ko'rsatadi (EGA talabi).
 *
 * Xatoga chidamli: API yiqilsa/aset topilmasa — sukut OG bilan qobiqni beradi (500 EMAS).
 * Edge'da keshlaydi. og:image = barqaror CDN URL (imzolangan/muddatli havola EMAS).
 */

const API_BASE = "https://api.getframeflow.app";
const SITE_ORIGIN = "https://getframeflow.app";
const DEFAULT_TITLE = "FrameFlow — Creative Assets & AI Generation Platform";
const DEFAULT_DESC =
  "Download templates and stock, generate images, video and audio with AI — all in one creative space.";

// type → ko'rinadigan label (katalog sahifa sarlavhasi uchun).
const TYPE_LABEL = {
  "video-templates": "Video Templates",
  "motion-graphics": "Motion Graphics",
  graphics: "Graphics",
  luts: "LUTs",
  music: "Music",
  sfx: "Sound Effects",
  "ai-stock": "AI Stock",
};

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Imzolangan/muddatli havolani og:image sifatida ISHLATMAYMIZ (crawler uzoq keshlaydi → siniq).
function stableImage(url) {
  if (!url) return "";
  const u = String(url);
  if (!/^https?:\/\//i.test(u)) return "";
  if (/[?&]X-Amz-|[?&]Signature=|[?&]Expires=/i.test(u)) return "";
  return u;
}

async function fetchAsset(shortId) {
  try {
    const r = await fetch(
      API_BASE + "/api/public/asset/" + encodeURIComponent(shortId),
      { headers: { accept: "application/json" } }
    );
    if (!r.ok) return null;
    const j = await r.json();
    return (j && (j.item || j)) || null;
  } catch (e) {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // SPA qobig'ini (dist ildizidagi index.html) olamiz — path /stock/... bo'lsa ham.
  const shellReq = new Request(new URL("/index.html", url).toString(), {
    method: "GET",
    headers: request.headers,
  });
  let shell;
  try {
    shell = await env.ASSETS.fetch(shellReq);
  } catch (e) {
    // ASSETS mavjud bo'lmasa (mahalliy) — oddiy davom
    return context.next();
  }

  // Path segmentlari: ['stock', <type>, <seg3>]
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const typeSlug = parts[1] || "";
  const seg3 = parts[2] || "";
  // Asset iff 3-segment DEFIS tutsa (slug har doim `-<shortId>` bilan tugaydi).
  const isAsset = !!seg3 && seg3.indexOf("-") >= 0;

  let title = DEFAULT_TITLE;
  let desc = DEFAULT_DESC;
  let image = ""; // og:image faqat REAL, barqaror rasm bo'lsa (siniq default'dan yaxshiroq)
  const canonical = SITE_ORIGIN + url.pathname;
  let ogType = "website";

  if (isAsset) {
    const shortId = seg3.split("-").pop();
    const item = await fetchAsset(shortId);
    if (item && item.id) {
      title = (item.name || "Asset") + " — FrameFlow";
      desc =
        item.description ||
        ((TYPE_LABEL[item.type] || "Stock") + " on FrameFlow.");
      const img = stableImage(item.thumbUrl);
      if (img) image = img;
      ogType = "article";
    }
    // Aset topilmasa — sukut OG (SPA o'zi 404 holatini ko'rsatadi).
  } else if (typeSlug) {
    const label = TYPE_LABEL[typeSlug] || "Stock Catalog";
    title = label + " — Stock Catalog — FrameFlow";
    desc = "Browse " + label + " on the FrameFlow Stock Catalog.";
  } else {
    title = "Stock Catalog — FrameFlow";
    desc = "Templates, motion graphics, graphics, LUTs, music and sound effects — all in one catalog.";
  }

  const imgTags = image
    ? '<meta property="og:image" content="' + esc(image) + '">' +
      '<meta name="twitter:card" content="summary_large_image">' +
      '<meta name="twitter:image" content="' + esc(image) + '">'
    : '<meta name="twitter:card" content="summary">';

  const head =
    '<meta property="og:site_name" content="FrameFlow">' +
    '<meta property="og:type" content="' + esc(ogType) + '">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + esc(canonical) + '">' +
    imgTags +
    '<meta name="twitter:title" content="' + esc(title) + '">' +
    '<meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<link rel="canonical" href="' + esc(canonical) + '">';

  const rewriter = new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .on("head", {
      element(el) {
        el.append(head, { html: true });
      },
    });

  const out = rewriter.transform(shell);
  const res = new Response(out.body, out);
  // Edge kesh — crawler API'ni bosmasin. HTML no-cache o'rniga qisqa s-maxage.
  res.headers.set("Cache-Control", "public, max-age=300, s-maxage=3600");
  res.headers.set("Content-Type", "text/html; charset=utf-8");
  return res;
}
