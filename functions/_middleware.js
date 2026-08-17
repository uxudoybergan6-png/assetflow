/**
 * CF Pages host-router — subdomen bo'yicha to'g'ri statik faylni beradi.
 * getframeflow.app/        → platform/index.html (default, o'zgarishsiz)
 * admin.getframeflow.app/  → /admin/index.html
 * studio.getframeflow.app/ → /studio/login.html
 * Boshqa barcha yo'llar (path'lar) mavjud _redirects orqali host'dan mustaqil
 * ishlaydi — bu funksiya faqat "/" (bosh sahifa) so'rovini qayta yo'naltiradi.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    const host = url.hostname;
    if (host.startsWith("admin.")) {
      url.pathname = "/admin/index.html";
      return env.ASSETS.fetch(new Request(url.toString(), request));
    }
    if (host.startsWith("studio.")) {
      url.pathname = "/studio/login.html";
      return env.ASSETS.fetch(new Request(url.toString(), request));
    }
  }

  // Cloudflare'ning SPA fallback'i noma'lum URL va brauzer assetlariga 1.1 MB
  // index.html + 200 qaytarmasin. Faqat haqiqiy ilova route'lari shellga o'tadi;
  // qolgan yo'llar exact static asset bo'lmasa haqiqiy 404 oladi.
  const spaRoots = ["/stock", "/pricing", "/plugin", "/dashboard", "/account", "/projects", "/aistudio", "/auth", "/login"];
  const isSpaRoute = spaRoots.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"));
  if (!isSpaRoute && url.pathname !== "/" && url.pathname !== "/index.html") {
    const exact = await env.ASSETS.fetch(request);
    if (exact.status !== 404) return exact;
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  return context.next();
}
