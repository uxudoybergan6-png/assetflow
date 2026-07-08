import { Router } from "express";
import type { Request, Response } from "express";
import { prisma, PluginAccountStatus, UserRole } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";
import { writeAuditLog } from "../lib/audit-log.js";

export const accountRouter = Router();

/**
 * FAZA 1c — GDPR self-serve account deletion.
 *
 * Qat'iy o'chirish (row DELETE) EMAS — moliyaviy yozuvlar (ContributorEarning/Payout)
 * va katalog butunligi buzilmasin uchun ANONIMLASHTIRAMIZ:
 *   • User PII tozalanadi (email → deleted-<id>@deleted.frameflow.app, name/image/parol null),
 *     tokenVersion++ (barcha JWT bekor), deletedAt = hozir.
 *   • PluginToken/Session/Account (OAuth) qatorlari o'chiriladi (token/kredensial revoke).
 *   • PluginProfile.status = REMOVED (plugin-profile.ts "Account is deleted" holatiga ulanadi).
 *   • Contributor PUBLISHED shablonlari UNPUBLISH qilinadi (published=false) va saqlanadi —
 *     atribut (ism/email) anonimlashtirilgani uchun attributsiz qoladi. Earning/payout SAQLANADI.
 *   • OXIRGI adminni o'chirib bo'lmaydi. Audit yoziladi.
 *
 * ⚠️ needs lawyer review — anonimlashtirish vs qat'iy o'chirish siyosati va moliyaviy
 * saqlash muddati huquqshunos bilan tasdiqlansin. docs/LEGAL-TODO.md.
 */
accountRouter.delete("/", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  // Tasdiqlash — UI'da typed-confirmation ("DELETE"). Body: { confirm: "DELETE" }.
  const confirm = String((req.body as { confirm?: unknown } | undefined)?.confirm ?? "")
    .trim()
    .toUpperCase();
  if (confirm !== "DELETE") {
    res.status(400).json({
      error: 'Confirmation required — send { "confirm": "DELETE" }',
      code: "CONFIRM_REQUIRED",
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.deletedAt) {
    res.status(410).json({ error: "Account already deleted", code: "ALREADY_DELETED" });
    return;
  }

  // Oxirgi adminni o'chirib bo'lmaydi (last-admin guard).
  if (user.role === UserRole.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: UserRole.ADMIN, deletedAt: null },
    });
    if (adminCount <= 1) {
      res.status(400).json({
        error: "Cannot delete the last admin account",
        code: "LAST_ADMIN",
      });
      return;
    }
  }

  const anonEmail = `deleted-${userId}@deleted.frameflow.app`;

  await prisma.$transaction(async (tx) => {
    // PII tozalash + barcha JWT bekor (tokenVersion++)
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonEmail,
        name: null,
        passwordHash: null,
        image: null,
        emailVerified: null,
        contributorRequestedAt: null,
        tokenVersion: { increment: 1 },
        deletedAt: new Date(),
      },
    });

    // Token/kredensiallarni revoke qilish
    await tx.pluginToken.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });

    // Plugin profilini "deleted" holatiga o'tkazish + qurilma PII tozalash
    await tx.pluginProfile.updateMany({
      where: { userId },
      data: {
        status: PluginAccountStatus.REMOVED,
        deviceLabel: null,
        aeVersion: null,
      },
    });

    // Contributor shablonlarini UNPUBLISH (saqlanadi, atributsiz qoladi)
    await tx.contributorTemplate.updateMany({
      where: { contributorId: userId, published: true },
      data: { published: false },
    });
  });

  await writeAuditLog({
    actorId: userId,
    action: "account.delete",
    targetType: "user",
    targetId: userId,
    detail: user.email,
    meta: { role: user.role, anonymizedTo: anonEmail },
  });

  res.json({
    ok: true,
    deleted: true,
    note: "Your account has been anonymized and access revoked. Financial records are retained (anonymized). Any active subscription must be cancelled with the payment provider (Lemon Squeezy) separately.",
  });
});
