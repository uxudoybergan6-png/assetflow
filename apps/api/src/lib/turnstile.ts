/**
 * Cloudflare Turnstile — register formasida bot-himoyasi.
 *
 * FAIL-CLOSED PRODUCTIONДА (Bosqich 1 #5): `TURNSTILE_SECRET_KEY` yo'q bo'lsa —
 *   • dev (NODE_ENV !== production) → o'tkazib yuboriladi (fail-open, dev qulayligi);
 *   • production → RAD ETILADI (fail-closed) — bot ro'yxatdan o'tishning oldini oladi.
 * ⚠️ Shu sabab productionда TURNSTILE_SECRET_KEY (+ frontend site-key) SOZLANMASA
 *    RO'YXATDAN O'TISH BLOKLANADI. Kalitni sozlash MAJBURIY manual qadam.
 * Frontend site-key'i alohida (studio-config / meta-tag).
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY?.trim();
}

/**
 * Turnstile token'ini Cloudflare'da tekshiradi. Kalit yo'q → dev true (fail-open),
 * production false (fail-closed). Tarmoq/xato holatida false (kalit BOR bo'lsa tekshiruv haqiqiy).
 */
export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string
): Promise<boolean> {
  if (!isTurnstileConfigured()) {
    // Fail-CLOSED productionда: sozlanmagan bo'lsa rad et. Dev'da fail-open (qulaylik).
    return process.env.NODE_ENV !== "production";
  }
  if (!token || typeof token !== "string") return false;
  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!.trim(),
      response: token,
    });
    if (remoteIp) body.set("remoteip", remoteIp);
    const resp = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await resp.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("[turnstile] tekshiruv xatosi:", e);
    return false;
  }
}
