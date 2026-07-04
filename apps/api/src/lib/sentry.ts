/**
 * Sentry — xato monitoringi (Bosqich 1 #6). NO-OP agar SENTRY_DSN yo'q YOKI @sentry/node
 * o'rnatilmagan bo'lsa. @sentry/node hozircha DEPENDENCY EMAS — shu sabab DINAMIK import
 * (o'zgaruvchili spec) bilan yuklaymiz: paket bo'lmasa build/runtime yiqilmaydi, shunchaki
 * o'tkazib yuboriladi. Paket qo'shilgach (npm i @sentry/node) va SENTRY_DSN qo'yilgach avtomatik faollashadi.
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

/** Xatoni Sentry'ga yuboradi (Sentry sozlanmagan → no-op). Hech qachon throw qilmaydi. */
export function captureException(err: unknown): void {
  try {
    if (sentry) sentry.captureException(err);
  } catch {
    /* no-op */
  }
}
