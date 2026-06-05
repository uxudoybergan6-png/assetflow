import { Router } from "express";
import { prisma } from "@creative-tools/database";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

export const auditRouter = Router();

auditRouter.get("/", requireAuth, requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const action = (req.query.action as string | undefined)?.trim();

  const items = await prisma.studioAuditLog.findMany({
    where: action && action !== "all" ? { action } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  res.json({
    items: items.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      detail: row.detail,
      meta: row.metaJson,
      createdAt: row.createdAt,
      who: row.actor?.name || row.actor?.email || "Tizim",
      email: row.actor?.email,
    })),
  });
});
