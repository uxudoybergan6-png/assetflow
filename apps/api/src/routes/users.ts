import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";
import { writeAuditLog } from "../lib/audit-log.js";

export const usersRouter = Router();

/**
 * "Yuklamalarim" — foydalanuvchining yuklab olish/import tarixi.
 *
 * Bosqich 4 #2 (ikki template tizimini birlashtirish): ilgari bu endpoint O'LIK
 * `Download` modelini (`Asset`'ga bog'langan, hech qachon yaratilmagan) o'qirdi va
 * doim BO'SH qaytarardi. Jonli katalog = `ContributorTemplate`, shuning uchun endi
 * REAL `TemplateDownloadEvent` (Bosqich 4 #1) hodisalaridan o'qiydi. Bu `Download`/
 * `Asset` yagona jonli o'qish joyini olib tashlaydi (modellar migratsiya-xavfsizligi
 * uchun schema'da DEPRECATED sifatida qoladi).
 */
usersRouter.get("/downloads", requireAuth, async (req: Request, res: Response) => {
  const events = await prisma.templateDownloadEvent.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const ids = Array.from(new Set(events.map((e) => e.templateId)));
  const templates = ids.length
    ? await prisma.contributorTemplate.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, cat: true, catLabel: true, nav: true, icon: true },
      })
    : [];
  const byId = new Map(templates.map((t) => [t.id, t]));
  res.json(
    events.map((e) => ({
      id: e.id,
      templateId: e.templateId,
      kind: e.kind,
      source: e.source,
      createdAt: e.createdAt,
      template: byId.get(e.templateId) ?? null,
    }))
  );
});

/**
 * FAZA 6b — contributor onboarding: tizimga kirgan USER "Become a contributor"
 * so'rovi yuboradi. Admin "Users & roles" bo'limida ko'rib, rolni
 * PATCH /api/admin/users/:id/role orqali beradi (yoki so'rovni rad etadi).
 * Idempotent: takror so'rov birinchi sanani saqlaydi.
 */
usersRouter.post("/contributor-request", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.role !== "USER") {
    res.status(400).json({ error: "This account already has contributor access" });
    return;
  }
  if (user.contributorRequestedAt) {
    res.json({ ok: true, alreadyRequested: true, requestedAt: user.contributorRequestedAt });
    return;
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { contributorRequestedAt: new Date() },
  });
  await writeAuditLog({
    actorId: user.id,
    action: "user.contributor_request",
    targetType: "user",
    targetId: user.id,
    detail: user.email,
  });
  res.json({ ok: true, alreadyRequested: false, requestedAt: updated.contributorRequestedAt });
});

/**
 * FAZA 1c — GDPR data-portability: foydalanuvchi O'Z ma'lumotini JSON sifatida
 * yuklab oladi (profil, shablonlar, yuklab olishlar, generatsiyalar, daromadlar, obuna).
 * Faqat so'rovchining o'z ma'lumoti (requireAuth → userId). Hech qanday PII o'zgarmaydi.
 */
usersRouter.post("/export", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const [user, pluginProfile, subscription, templates, downloads, generations, earnings] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, name: true, role: true, image: true,
          emailVerified: true, createdAt: true, updatedAt: true,
          contributorRequestedAt: true, contributorBlockedAt: true, deletedAt: true,
        },
      }),
      prisma.pluginProfile.findUnique({ where: { userId } }),
      prisma.subscription.findUnique({
        where: { userId },
        select: {
          status: true, stripePriceId: true, currentPeriodEnd: true,
          cancelAtPeriodEnd: true, createdAt: true,
        },
      }),
      prisma.contributorTemplate.findMany({
        where: { contributorId: userId },
        select: {
          id: true, name: true, description: true, cat: true, catLabel: true, nav: true,
          tags: true, reviewStatus: true, published: true, isPro: true,
          downloadsCount: true, importsCount: true,
          rightsAcceptedAt: true, rightsTermsVersion: true, createdAt: true,
        },
      }),
      prisma.templateDownloadEvent.findMany({
        where: { userId },
        select: { templateId: true, kind: true, source: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.generation.findMany({
        where: { userId },
        select: {
          id: true, mode: true, prompt: true, modelId: true, status: true,
          cost: true, category: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.contributorEarning.findMany({
        where: { contributorId: userId },
        select: {
          templateId: true, amountCents: true, currency: true, payoutId: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="frameflow-data-export-${userId}.json"`
  );
  res.json({
    exportedAt: new Date().toISOString(),
    profile: user,
    pluginProfile,
    subscription,
    templates,
    downloads,
    generations,
    earnings,
  });
});
