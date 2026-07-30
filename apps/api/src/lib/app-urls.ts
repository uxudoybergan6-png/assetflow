import { createHmac, timingSafeEqual } from "node:crypto";

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

// #106 (SEC5) — avatar endpointi <img> uchun auth'siz bo'lishi shart, ammo xom `userId`
// bilan u ID enumeratsiyasiga (kim ro'yxatdan o'tgan / kimda avatar bor) aylanadi.
// Yechim: yo'lda imzolangan ma'lumotnoma `<userId>.<sig>` — imzo faqat server
// bergan URL'da bo'ladi, boshqa ID'ni taxmin qilib bo'lmaydi.
const AVATAR_SECRET =
  process.env.AVATAR_URL_SECRET?.trim() ||
  process.env.COST_QUOTE_SECRET?.trim() ||
  process.env.JWT_SECRET ||
  "dev-secret-change-me";

function avatarSig(userId: string): string {
  return createHmac("sha256", AVATAR_SECRET).update(`avatar:${userId}`).digest("base64url").slice(0, 22);
}

/** `<userId>.<sig>` → userId (imzo noto'g'ri bo'lsa null). */
export function verifyAvatarRef(ref: string): string | null {
  const i = ref.lastIndexOf(".");
  if (i <= 0) return null;
  const userId = ref.slice(0, i);
  const sig = ref.slice(i + 1);
  const expected = avatarSig(userId);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

/** User.image → brauzer/plagin <img> ishlata oladigan URL.
 *  GCS key bo'lsa auth'siz redirect endpoint'ga yo'naltiradi (bucket private —
 *  <img> Authorization header yubora olmaydi); to'liq URL bo'lsa o'zini qaytaradi. */
export function avatarPublicUrl(userId: string, image?: string | null): string | null {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return `${getPublicApiUrl()}/api/auth/avatar/${userId}.${avatarSig(userId)}`;
}
