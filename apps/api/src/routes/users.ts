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
