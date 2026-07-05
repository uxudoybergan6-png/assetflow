/** Production fallback URL'lar (env bo'lmasa). Eski run.app/pages.dev originlar
 *  CORS/CSP ro'yxatlarida saqlanadi — eskirgan CEP panellari uzilmasligi uchun. */
export const DEFAULT_API_PUBLIC_URL = "https://api.getframeflow.app";
export const DEFAULT_ADMIN_URL = "https://admin.getframeflow.app/";
export const DEFAULT_WEB_URL = "https://getframeflow.app";
export const LEGACY_API_PUBLIC_URL = "https://assetflow-api-331762958776.europe-west1.run.app";

/** Foydalanuvchi web ilovasi (parol tiklash, checkout return va h.k.) */
export function getWebUrl(): string {
  const raw = process.env.WEB_URL || process.env.CORS_ORIGIN || DEFAULT_WEB_URL;
  const first = raw.split(",")[0].trim();
  return first.replace(/\/$/, "");
}

export function getPublicApiUrl(req?: {
  protocol: string;
  get: (name: string) => string | undefined;
}): string {
  const env = process.env.API_PUBLIC_URL?.replace(/\/$/, "");
  if (env) return env;
  if (req) {
    const host = req.get("host");
    if (host) return `${req.protocol}://${host}`;
  }
  return DEFAULT_API_PUBLIC_URL;
}

export function getAdminUrl(): string {
  const raw = process.env.ADMIN_URL || DEFAULT_ADMIN_URL;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/** User.image → brauzer/plagin <img> ishlata oladigan URL.
 *  GCS key bo'lsa auth'siz redirect endpoint'ga yo'naltiradi (bucket private —
 *  <img> Authorization header yubora olmaydi); to'liq URL bo'lsa o'zini qaytaradi. */
export function avatarPublicUrl(userId: string, image?: string | null): string | null {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return `${getPublicApiUrl()}/api/auth/avatar/${userId}`;
}
