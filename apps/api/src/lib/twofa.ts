import crypto from "crypto";
import jwt from "jsonwebtoken";
import { generateSecret, generateURI, verify as otpVerify } from "otplib";
import QRCode from "qrcode";

/**
 * ADMIN 2FA (TOTP) yordamchilari.
 *
 * - TOTP siri DB'da AES-256-GCM bilan shifrlangan saqlanadi (kalit:
 *   TOTP_ENC_KEY yoki, berilmagan bo'lsa, JWT_SECRET'dan sha256 orqali).
 * - Backup kodlar sha256-hash ko'rinishida saqlanadi va BIR MARTA ishlaydi
 *   (mos kelgan hash ro'yxatdan olib tashlanadi).
 * - Parol bosqichidan keyingi "pending" token ALOHIDA secret bilan imzolanadi —
 *   requireAuth uni hech qachon sessiya sifatida qabul qilmaydi.
 */

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const PENDING_SECRET = `${JWT_SECRET}::2fa-pending`;
const PENDING_TTL = "5m";

const TOTP_ISSUER = "FrameFlow Admin";

function encKey(): Buffer {
  return crypto
    .createHash("sha256")
    .update(process.env.TOTP_ENC_KEY || JWT_SECRET)
    .digest();
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptTotpSecret(stored: string): string | null {
  try {
    const [v, ivB64, tagB64, encB64] = stored.split(":");
    if (v !== "v1" || !ivB64 || !tagB64 || !encB64) return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export function totpKeyUri(email: string, secret: string): string {
  return generateURI({ secret, issuer: TOTP_ISSUER, label: email });
}

export async function totpQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
}

export async function verifyTotpCode(code: string, secret: string): Promise<boolean> {
  const token = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(token)) return false;
  try {
    // ±30s tolerans — qurilma soati siljishiga bardosh.
    const r = await otpVerify({ token, secret, epochTolerance: 30 });
    return !!r.valid;
  } catch {
    return false;
  }
}

/* ── Backup kodlar ── */

function hashBackupCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .digest("hex");
}

/** 10 ta bir martalik kod: XXXX-XXXX (A-Z0-9). Ochiq kodlar FAQAT bir marta
 *  qaytariladi; DB'ga hash yoziladi. */
export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // o'qishda adashtiruvchi 0/O/1/I yo'q
  const plain: string[] = [];
  for (let i = 0; i < 10; i++) {
    let c = "";
    for (let j = 0; j < 8; j++) c += ALPHA[crypto.randomInt(ALPHA.length)];
    plain.push(`${c.slice(0, 4)}-${c.slice(4)}`);
  }
  return { plain, hashed: plain.map(hashBackupCode) };
}

/** Backup kodni tekshiradi. Mos kelsa — QOLGAN hash'lar ro'yxatini qaytaradi
 *  (chaqiruvchi DB'ga yozadi → kod bir martalik). Mos kelmasa null. */
export function consumeBackupCode(
  code: string,
  hashedCodes: string[]
): string[] | null {
  const h = hashBackupCode(code);
  if (!hashedCodes.includes(h)) return null;
  return hashedCodes.filter((x) => x !== h);
}

/** Backup kod formatiga o'xshaydimi (6 raqamli TOTP emas). */
export function looksLikeBackupCode(code: string): boolean {
  return /^[a-z0-9]{4}-?[a-z0-9]{4}$/i.test(String(code || "").trim());
}

/* ── Parol → TOTP orasidagi "pending" token ── */

interface PendingPayload {
  kind: "2fa-pending";
  userId: string;
  tokenVersion: number;
}

export function signPendingToken(userId: string, tokenVersion: number): string {
  const payload: PendingPayload = { kind: "2fa-pending", userId, tokenVersion };
  return jwt.sign(payload, PENDING_SECRET, { expiresIn: PENDING_TTL });
}

export function verifyPendingToken(
  token: string
): { userId: string; tokenVersion: number } | null {
  try {
    const p = jwt.verify(token, PENDING_SECRET) as PendingPayload;
    if (p.kind !== "2fa-pending" || !p.userId) return null;
    return { userId: p.userId, tokenVersion: p.tokenVersion ?? 0 };
  } catch {
    return null;
  }
}

/** ADMIN_REQUIRE_2FA=true/1 — adminlar uchun 2FA yozilishi majburiy (setup gate). */
export function adminRequire2fa(): boolean {
  const v = String(process.env.ADMIN_REQUIRE_2FA || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
