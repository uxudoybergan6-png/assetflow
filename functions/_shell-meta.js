const SITE_ORIGIN = "https://getframeflow.app";

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function renderShellMeta(context, meta) {
  const url = new URL(context.request.url);
  const shellUrl = new URL("/index.html", url);
  const shell = await context.env.ASSETS.fetch(new Request(shellUrl, {
    method: "GET",
    headers: context.request.headers,
  }));
  const canonical = SITE_ORIGIN + url.pathname;
  const head =
    `<meta name="description" content="${esc(meta.description)}">` +
    `<meta property="og:site_name" content="FrameFlow">` +
    `<meta property="og:type" content="website">` +
    `<meta property="og:title" content="${esc(meta.title)}">` +
    `<meta property="og:description" content="${esc(meta.description)}">` +
    `<meta property="og:url" content="${esc(canonical)}">` +
    `<meta name="twitter:card" content="summary">` +
    `<meta name="twitter:title" content="${esc(meta.title)}">` +
    `<meta name="twitter:description" content="${esc(meta.description)}">` +
    `<link rel="canonical" href="${esc(canonical)}">`;
  const rewritten = new HTMLRewriter()
    .on('link[rel="canonical"]', { element(el) { el.remove(); } })
    .on('meta[name="description"],meta[property^="og:"],meta[name^="twitter:"]', { element(el) { el.remove(); } })
    .on("title", { element(el) { el.setInnerContent(meta.title); } })
    .on("head", { element(el) { el.append(head, { html: true }); } })
    .transform(shell);
  const response = new Response(rewritten.body, rewritten);
  response.headers.set("Content-Type", "text/html; charset=utf-8");
  response.headers.set("Cache-Control", "public, max-age=300, s-maxage=3600");
  return response;
}
