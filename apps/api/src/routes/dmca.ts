import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@creative-tools/database";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { writeAuditLog } from "../lib/audit-log.js";

/**
 * FAZA 1d — DMCA / infringement report.
 *
 * Ommaviy (auth'siz) "Report infringement" formasi PENDING `InfringementReport`
 * yaratadi. Admin ro'yxatni ko'rib, tasdiqlangan da'voni MAVJUD takedown endpoint'i
 * (POST /api/contributor/admin/templates/:id/takedown) orqali amalga oshiradi va bu
 * yerda hisobotni "actioned"/"dismissed" deb belgilaydi.
 *
 * ⚠️ needs lawyer review — designated agent va notice/counter-notice tartibi.
 */
export const dmcaRouter = Router();

const reportSchema = z.object({
  reporterEmail: z.string().trim().email().max(200),
  reporterName: z.string().trim().max(200).optional(),
  claimantType: z.enum(["owner", "authorized_agent"]).optional(),
  templateId: z.string().trim().max(60).optional(),
  infringingUrl: z.string().trim().max(1000).optional(),
  workDescription: z.string().trim().min(10).max(5000),
  goodFaith: z.boolean().optional(),
});

/** Ommaviy: infringement/DMCA da'vosini yuborish (auth'siz — da'vo istalgan shaxsdan). */
dmcaRouter.post("/report", async (req: Request, res: Response) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid report" });
    return;
  }
  const d = parsed.data;
  const report = await prisma.infringementReport.create({
    data: {
      reporterEmail: d.reporterEmail,
      reporterName: d.reporterName ?? null,
      claimantType: d.claimantType ?? null,
      templateId: d.templateId ?? null,
      infringingUrl: d.infringingUrl ?? null,
      workDescription: d.workDescription,
      goodFaith: d.goodFaith ?? false,
    },
  });
  await writeAuditLog({
    actorId: null,
    action: "dmca.report_submitted",
    targetType: "infringement_report",
    targetId: report.id,
    detail: d.reporterEmail,
    meta: { templateId: d.templateId ?? null },
  });
  res.status(201).json({ ok: true, id: report.id });
});

/** Admin: pending/barcha hisobotlar ro'yxati. */
dmcaRouter.get("/admin/reports", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const status = typeof req.query.status === "string" ? req.query.status : "pending";
  const where = status === "all" ? {} : { status };
  const reports = await prisma.infringementReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ reports });
});

const resolveSchema = z.object({
  status: z.enum(["actioned", "dismissed"]),
  resolutionNote: z.string().trim().max(1000).optional(),
});

/** Admin: hisobotni yakunlash (actual takedown mavjud endpoint orqali qilinadi). */
dmcaRouter.post(
  "/admin/reports/:id/resolve",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
      return;
    }
    const existing = await prisma.infringementReport.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    const updated = await prisma.infringementReport.update({
      where: { id },
      data: {
        status: parsed.data.status,
        resolutionNote: parsed.data.resolutionNote ?? null,
        reviewedById: req.user!.userId,
        reviewedAt: new Date(),
      },
    });
    await writeAuditLog({
      actorId: req.user!.userId,
      action: "dmca.report_resolved",
      targetType: "infringement_report",
      targetId: id,
      detail: parsed.data.status,
    });
    res.json({ ok: true, report: updated });
  }
);
