/** Production fallback URL'lar (Render/Vercel env bo'lmasa) */
export const DEFAULT_API_PUBLIC_URL = "https://assetflow-rqbq.onrender.com";
export const DEFAULT_ADMIN_URL = "https://assetflow-studio-one.vercel.app/admin/";
export const DEFAULT_WEB_URL = "https://assetflow-studio-one.vercel.app";

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
