/**
 * Sentry — xato monitoringi (Bosqich 1 #6 · FAZA 3 A). @sentry/node endi haqiqiy dependency;
 * SENTRY_DSN yo'q bo'lsa NO-OP (dev'da hech narsa o'zgarmaydi, crash yo'q). Dinamik import
 * saqlanadi — init faqat DSN bor bo'lganda paketni yuklaydi (dev boot yengil qoladi).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sentry: any = null;
let inited = false;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || inited) return;
  try {
    // `: string` — TS statik modul-yechishni O'TKAZIB yuboradi (paket bo'lmasa ham build o'tadi).
    const moduleName: string = "@sentry/node";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(moduleName);
    mod.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    });
    sentry = mod;
    inited = true;
    console.log("[sentry] ishga tushdi");
  } catch (e) {
    console.warn(
      "[sentry] @sentry/node topilmadi yoki init xatosi — monitoring o'tkazib yuborildi:",
      (e as Error).message
    );
  }
}

/** Xatoni Sentry'ga yuboradi (Sentry sozlanmagan → no-op). Hech qachon throw qilmaydi.
 *  ctx — qo'shimcha kontekst (genId, templateId, area …) event'ga `extra` sifatida biriktiriladi. */
export function captureException(err: unknown, ctx?: Record<string, unknown>): void {
  try {
    if (sentry) sentry.captureException(err, ctx ? { extra: ctx } : undefined);
  } catch {
    /* no-op */
  }
}
