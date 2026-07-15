// P27 — UNIVERSAL provayder fetch timeout.
// Muammo: AbortSignal qo'yilmagan provayder fetch'lari (openrouter/elevenlabs/vertex-omni/
// google-tts/workers-ai) abadiy osilishi mumkin. gen-processor slot tizimida .finally()
// slotni FAQAT processGeneration qaytgach/otgach bo'shatadi → osilgan fetch → finally hech
// ishlamaydi → GEN_CONCURRENCY slotlari tugaydi → BUTUN gen navbati qotadi.
// Yechim: har fetch AbortController bilan `ms`dan keyin uziladi va aniq "provider timeout"
// xatosini otadi → processGeneration catch → MAVJUD fail+refund yo'li → slot bo'shaydi.
// (fal/byteplus/magnific'da allaqachon timeout bor — bu qolgan provayderlar uchun.)

export const PROVIDER_TIMEOUT_MS = 120_000; // submit/generatsiya — uzunroq, ammo bounded
export const PROVIDER_POLL_TIMEOUT_MS = 30_000; // status/poll — qisqaroq

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  ms: number = PROVIDER_TIMEOUT_MS,
): Promise<Response> {
  // Chaqiruvchi o'z signalini bergan bo'lsa — o'shani hurmat qilamiz (o'z timeout'ini boshqaradi).
  if (opts.signal) return fetch(url, opts);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      throw new Error(`provider timeout after ${Math.round(ms / 1000)}s: ${String(url).split("?")[0]}`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}
