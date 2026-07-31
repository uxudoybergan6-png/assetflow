/**
 * D0 (2026-07-31) — IDLE-AWARE fon jadvali (Neon compute-kvota insidenti fix).
 *
 * Muammo: fon timerlari `setInterval` bilan QAT'IY intervalda ishlardi (gen resume 30s,
 * saved-ref cleanup 2 daq, template reconcile 10 daq). Neon serverless compute faqat
 * ~5 daqiqa TO'LIQ jimlikdan keyin suspend bo'ladi — 30 sekundlik so'rov halqasi uni
 * hech qachon uxlatmaydi, ya'ni hech kim mahsulotdan foydalanmaganda ham compute soati
 * 24/7 sarflanadi. Natija: bepul tarifning oylik kvotasi oy oxirida tugab, DB down
 * (SESSION-REPORT 2026-07-31, docs/DIZAYN-AUDIT-2026-07-31.md P0).
 *
 * Yechim: ish BO'LMAGANDA eksponensial orqaga chekinish. Pass ish topsa — baza intervalga
 * qaytadi (aktiv paytda hech narsa sekinlashmaydi), ketma-ket bo'sh passlarda kechikish
 * `maxMs`gacha ikkilanadi → bo'sh baza uzoq uxlaydi. Yangi ish HTTP so'rov orqali keladi,
 * shuning uchun chaqiruvchi `nudge()` bilan jadvalni darhol bazaga tushiradi (kechikish yo'q).
 *
 * MUHIM: bu FAQAT JADVAL. Pul zonasi mantiqi (imzolangan quote → atomik consume → refund,
 * stuck cutoff) o'zgarmaydi — refund'ning eng yomon kechikishi baribir `cutoff + interval`,
 * va aktiv/nudge qilingan holatda interval ilgarigidek baza qiymatida qoladi.
 */

export type AdaptiveTimer = {
  /** Jadvalni baza intervalga qaytaradi (yangi ish paydo bo'lganda chaqiriladi). */
  nudge(): void;
};

export type AdaptiveTimerOptions = {
  /** Loglar uchun nom. */
  name: string;
  /** Ish bor paytdagi interval. */
  baseMs: number;
  /** Ketma-ket bo'sh passlardan keyingi maksimal interval. */
  maxMs: number;
  /** Birinchi pass kechikishi (startup — default `baseMs`). */
  firstDelayMs?: number;
  /** Pass. `true` = ish topildi (bazaga qaytamiz), `false` = bo'sh (orqaga chekinamiz). */
  task: () => Promise<boolean>;
};

export function startAdaptiveTimer(opts: AdaptiveTimerOptions): AdaptiveTimer {
  const { name, baseMs, maxMs, task } = opts;
  let delay = baseMs;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  /** Rejalashtirilgan passning taxminiy vaqti — nudge undan yaqinroq bo'lsa qayta rejalashtiradi. */
  let dueAt = 0;

  const schedule = (ms: number): void => {
    if (timer) clearTimeout(timer);
    dueAt = Date.now() + ms;
    timer = setTimeout(() => void run(), ms);
    if (typeof timer.unref === "function") timer.unref();
  };

  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    let hadWork = false;
    try {
      hadWork = await task();
    } catch (e) {
      console.error(`[idle-timer:${name}] pass xato:`, e);
      // Xato — ish bor deb hisoblamaymiz, lekin bazadan boshlab qayta urinamiz.
      hadWork = false;
    } finally {
      running = false;
      delay = hadWork ? baseMs : Math.min(maxMs, Math.max(baseMs, delay * 2));
      schedule(delay);
    }
  };

  schedule(opts.firstDelayMs ?? baseMs);

  return {
    nudge() {
      delay = baseMs;
      // Faqat rejadagi pass bazadan uzoqroq bo'lsa qayta rejalashtiramiz (ortiqcha so'rov yo'q).
      if (!running && Date.now() + baseMs < dueAt) schedule(baseMs);
    },
  };
}
