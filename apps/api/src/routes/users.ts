import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";

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
