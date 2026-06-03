import { Router } from "express";
import { z } from "zod";
import { prisma, AssetType, Prisma } from "@creative-tools/database";
import {
  requireAuth,
  requireActiveSubscription,
} from "../middleware/auth.js";
import { getPublicUrl, getSignedDownloadUrl } from "../lib/s3.js";

export const assetsRouter = Router();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  type: z.nativeEnum(AssetType).optional(),
});

assetsRouter.get("/", async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { page, pageSize, search, category, type } = parsed.data;
  const where: Prisma.AssetWhereInput = { published: true };

  if (category) where.category = category;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { tags: { has: search.toLowerCase() } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.asset.count({ where }),
  ]);

  res.json({
    items: items.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      description: a.description,
      type: a.type,
      category: a.category,
      tags: a.tags,
      thumbnailUrl: a.thumbnailKey ? getPublicUrl(a.thumbnailKey) : null,
      fileSize: a.fileSize,
      downloadCount: a.downloadCount,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

assetsRouter.get("/categories", async (_req, res) => {
  const categories = await prisma.asset.findMany({
    where: { published: true },
    select: { category: true },
    distinct: ["category"],
  });
  res.json(categories.map((c) => c.category));
});

assetsRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const asset = await prisma.asset.findFirst({
    where: { id, published: true },
  });
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  res.json({
    ...asset,
    thumbnailUrl: asset.thumbnailKey
      ? getPublicUrl(asset.thumbnailKey)
      : null,
  });
});

assetsRouter.post(
  "/:id/download",
  requireAuth,
  requireActiveSubscription,
  async (req, res) => {
    const id = String(req.params.id);
    const asset = await prisma.asset.findFirst({
      where: { id, published: true },
    });

    if (!asset) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    const downloadUrl = await getSignedDownloadUrl(asset.fileKey);

    await prisma.$transaction([
      prisma.download.create({
        data: {
          userId: req.user!.userId,
          assetId: asset.id,
          source: (req.body.source as string) ?? "web",
        },
      }),
      prisma.asset.update({
        where: { id: asset.id },
        data: { downloadCount: { increment: 1 } },
      }),
    ]);

    res.json({
      downloadUrl,
      fileName: asset.fileKey.split("/").pop(),
      expiresIn: 3600,
    });
  }
);
