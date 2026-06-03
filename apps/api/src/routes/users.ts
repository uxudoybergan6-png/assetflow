import { Router } from "express";
import { prisma } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";

export const usersRouter = Router();

usersRouter.get("/downloads", requireAuth, async (req, res) => {
  const downloads = await prisma.download.findMany({
    where: { userId: req.user!.userId },
    include: { asset: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(downloads);
});
