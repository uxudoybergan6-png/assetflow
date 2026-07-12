import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma, UserRole } from "@creative-tools/database";
import { adminRequire2fa } from "../lib/twofa.js";

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  tokenVersion?: number;
  /** requireAuth DB'dan to'ldiradi (JWT'da YO'Q) — ADMIN_REQUIRE_2FA gate uchun. */
  totpEnabled?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export function signToken(payload: AuthPayload): string {
  // FAZA 2 #14 — web sessiya persistence: 7d → 30d. Xavfsizlik zaiflashmaydi:
  // requireAuth har so'rovda userni DB'dan qayta o'qiydi va tokenVersion mos
  // kelmasa 401 TOKEN_REVOKED — parol reset/blok darhol amal qiladi.
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized", code: "NO_TOKEN" });
    return;
  }

  const pluginToken = await prisma.pluginToken.findUnique({
    where: { token },
    include: { user: { include: { pluginProfile: true } } },
  });

  if (pluginToken && pluginToken.expiresAt > new Date()) {
    if (isBlocked(pluginToken.user)) {
      res.status(403).json({ error: "Account is blocked", code: "ACCOUNT_BLOCKED" });
      return;
    }
    req.user = {
      userId: pluginToken.user.id,
      email: pluginToken.user.email,
      role: pluginToken.user.role,
      totpEnabled: pluginToken.user.totpEnabled,
    };
    next();
    return;
  }

  // P8 #4 — muddati o'tgan (EXPIRED) vs buzuq (INVALID) tokenni AJRATAMIZ, ikkalasiga ham aniq
  // `code` beramiz. Klient faqat SESSIYA O'LGAN kodlarda (TOKEN_EXPIRED/INVALID/REVOKED/NO_TOKEN)
  // sessiyani tozalaydi — TWO_FA_INVALID kabi boshqa 401'lar sessiyani NUKE qilmaydi.
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch (e) {
    const expired = e instanceof jwt.TokenExpiredError;
    res.status(401).json({
      error: expired ? "Session expired — please sign in again" : "Invalid token",
      code: expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
    });
    return;
  }

  // JWT payload can outlive DB rows (e.g. demo:clear). Always re-hydrate from DB.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { pluginProfile: true },
  });
  if (!user) {
    res.status(401).json({ error: "Session expired", code: "TOKEN_INVALID" });
    return;
  }
  // Token-version: reset/block tokenVersion'ni oshiradi — eski JWT bekor bo'ladi.
  if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
    res.status(401).json({ error: "Session expired — please sign in again", code: "TOKEN_REVOKED" });
    return;
  }
  if (isBlocked(user)) {
    res.status(403).json({ error: "Account is blocked", code: "ACCOUNT_BLOCKED" });
    return;
  }
  req.user = {
    userId: user.id,
    email: user.email,
    role: user.role,
    totpEnabled: user.totpEnabled,
  };
  next();
}

/** Markaziy block tekshiruvi: contributor bloklangan YOKI plugin hisobi BLOCKED. */
function isBlocked(
  user: { contributorBlockedAt: Date | null; pluginProfile?: { status: string } | null }
): boolean {
  if (user.contributorBlockedAt != null) return true;
  if (user.pluginProfile?.status === "BLOCKED") return true;
  return false;
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  // ADMIN_REQUIRE_2FA yoqilgan bo'lsa: 2FA yozilmagan admin admin-endpointlarga
  // KIRA OLMAYDI (setup gate). Login va /api/auth/2fa/* (requireAuth, requireAdmin
  // emas) ochiq qoladi — admin avval enrol qiladi, hech kim qulflanib qolmaydi.
  if (adminRequire2fa() && req.user.totpEnabled !== true) {
    res.status(403).json({
      error: "Two-factor authentication is required for admin accounts — set it up in Settings → Security",
      code: "TWO_FA_SETUP_REQUIRED",
    });
    return;
  }
  next();
}

export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: req.user.userId },
  });

  const active =
    sub?.status === "ACTIVE" || sub?.status === "TRIALING";

  if (!active) {
    res.status(403).json({
      error: "Active subscription required",
      code: "SUBSCRIPTION_REQUIRED",
    });
    return;
  }

  next();
}
