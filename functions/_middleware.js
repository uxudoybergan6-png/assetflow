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

  return context.next();
}
