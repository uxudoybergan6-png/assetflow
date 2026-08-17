import { Router } from "express";
import type { Request, Response } from "express";
import { prisma, PluginAccountStatus, SubscriptionStatus, UserRole } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";
import { writeAuditLog } from "../lib/audit-log.js";
import { cancelLemonSqueezySubscription, isLemonSqueezyConfigured } from "../lib/lemonsqueezy.js";
import { getStripe, isStripeConfigured } from "../lib/stripe.js";
import { deleteUserPrivateAssets } from "../lib/s3.js";

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

  // Avval provider obunasini bekor qilamiz. Muvaffaqiyatsiz bo'lsa accountni
  // anonimlashtirmaymiz — foydalanuvchi kira olmay qolib charge davom etmasin.
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const activeSubscription =
    subscription?.status === SubscriptionStatus.ACTIVE ||
    subscription?.status === SubscriptionStatus.TRIALING ||
    subscription?.status === SubscriptionStatus.PAST_DUE;
  if (subscription && activeSubscription) {
    try {
      if (subscription.provider === "lemonsqueezy" && subscription.lsSubscriptionId) {
        if (!isLemonSqueezyConfigured()) throw new Error("Lemon Squeezy is not configured");
        await cancelLemonSqueezySubscription(subscription.lsSubscriptionId);
      } else if (subscription.stripeSubscriptionId) {
        if (!isStripeConfigured()) throw new Error("Stripe is not configured");
        await getStripe().subscriptions.cancel(subscription.stripeSubscriptionId);
      }
    } catch (error) {
      console.error("[account-delete] subscription cancellation failed", error);
      res.status(502).json({
        error: "Could not cancel the active subscription. Your account was not deleted; please try again.",
        code: "SUBSCRIPTION_CANCEL_FAILED",
      });
      return;
    }
  }

  // Private generated/reference/upload media is removed before DB PII. Prefixes are
  // user-scoped and idempotent, so a retry is safe.
  try {
    await deleteUserPrivateAssets(userId);
  } catch (error) {
    console.error("[account-delete] storage cleanup failed", error);
    res.status(502).json({
      error: "Could not remove private media. Your account was not deleted; please try again.",
      code: "PRIVACY_CLEANUP_FAILED",
    });
    return;
  }

  const anonEmail = `deleted-${userId}@deleted.frameflow.app`;

  try {
    await prisma.$transaction(async (tx) => {
    // Barcha last-admin amallari bir xil advisory lock ostida serialize qilinadi.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('frameflow:last-admin'))`;
    if (user.role === UserRole.ADMIN) {
      const adminCount = await tx.user.count({
        where: { role: UserRole.ADMIN, deletedAt: null, suspendedAt: null },
      });
      if (adminCount <= 1) throw new Error("LAST_ADMIN");
    }

    // Privacy data: prompts/params/results/references/projects and contributor
    // conversations are deleted; sent admin messages are redacted to preserve threads.
    await tx.project.deleteMany({ where: { ownerId: userId } });
    await tx.savedReference.deleteMany({ where: { userId } });
    await tx.generation.deleteMany({ where: { userId } });
    await tx.genSession.deleteMany({ where: { userId } });
    await tx.studioMessageThread.deleteMany({ where: { contributorId: userId } });
    await tx.studioMessage.updateMany({ where: { senderId: userId }, data: { body: "[deleted]" } });
    await tx.studioAuditLog.updateMany({
      where: { actorId: userId },
      data: { detail: null, metaJson: {} },
    });

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
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ADMIN") {
      res.status(409).json({ error: "Cannot delete the last admin account", code: "LAST_ADMIN" });
      return;
    }
    throw error;
  }

  await writeAuditLog({
    actorId: userId,
    action: "account.delete",
    targetType: "user",
    targetId: userId,
    detail: "Self-service privacy deletion completed",
    meta: { role: user.role, receiptId: `delete:${userId}:${Date.now()}` },
  });

  res.json({
    ok: true,
    deleted: true,
    note: "Your subscription was cancelled, private media and account content were removed, and remaining financial records were anonymized.",
  });
});
