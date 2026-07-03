/**
 * Cloudflare Turnstile — register formasida bot-himoyasi.
 *
 * FAIL-OPEN: `TURNSTILE_SECRET_KEY` o'rnatilmagan bo'lsa tekshiruv o'tkazib
 * yuboriladi (mavjud oqim buzilmaydi). Kalit qo'yilgach avtomatik majburlanadi.
 * Frontend site-key'i alohida (studio-config / meta-tag) — u ham bo'sh bo'lsa
 * widget ko'rsatilmaydi va token yuborilmaydi; server ham tekshirmaydi → izchil.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY?.trim();
}

/**
 * Turnstile token'ini Cloudflare'da tekshiradi. Kalit yo'q → true (fail-open).
 * Tarmoq/xato holatida false (fail-closed — kalit BOR bo'lsa tekshiruv haqiqiy).
 */
export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string
): Promise<boolean> {
  if (!isTurnstileConfigured()) return true; // sozlanmagan → o'tkazib yuboramiz
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
