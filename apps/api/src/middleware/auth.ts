import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma, UserRole } from "@creative-tools/database";

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  tokenVersion?: number;
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
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
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const pluginToken = await prisma.pluginToken.findUnique({
    where: { token },
    include: { user: { include: { pluginProfile: true } } },
  });

  if (pluginToken && pluginToken.expiresAt > new Date()) {
    if (isBlocked(pluginToken.user)) {
      res.status(403).json({ error: "Hisob bloklangan", code: "ACCOUNT_BLOCKED" });
      return;
    }
    req.user = {
      userId: pluginToken.user.id,
      email: pluginToken.user.email,
      role: pluginToken.user.role,
    };
    next();
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  // JWT payload can outlive DB rows (e.g. demo:clear). Always re-hydrate from DB.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { pluginProfile: true },
  });
  if (!user) {
    res.status(401).json({ error: "Session expired" });
    return;
  }
  // Token-version: reset/block tokenVersion'ni oshiradi — eski JWT bekor bo'ladi.
  if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
    res.status(401).json({ error: "Sessiya tugadi — qayta kiring", code: "TOKEN_REVOKED" });
    return;
  }
  if (isBlocked(user)) {
    res.status(403).json({ error: "Hisob bloklangan", code: "ACCOUNT_BLOCKED" });
    return;
  }
  req.user = { userId: user.id, email: user.email, role: user.role };
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
