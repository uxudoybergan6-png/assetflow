import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { approvedCatalogWhere, mapCatalogItem } from "../lib/catalog-map.js";
import { getPublicApiUrl } from "../lib/app-urls.js";
import { hydrateGenAssets, genCoverThumbUrl } from "./studio-gen.js";

/**
 * QA-FIX #13 — Projects: foydalanuvchi gen natijalari va katalog shablonlarini
 * loyihalarga yig'adi. Barcha yo'llar egaga qat'iy bog'langan (ownerId = req.user).
 * refId polimorf: kind='gen' → Generation.id, kind='template' → ContributorTemplate.id.
 * Manba o'chirilgan/unpublish bo'lsa item o'qishda tashlab yuboriladi (FK yo'q).
 */
export const projectsRouter = Router();

projectsRouter.use(
  requireAuth,
  rateLimit({
    windowMs: 60_000,
    max: 60,
    keyPrefix: "studio-projects",
    message: "Too many requests — please try again in a minute",
  })
);

// Katalog bilan bir xil maydonlar — mapCatalogItem shu shaklni kutadi (plugin.ts CATALOG_SELECT)
const PROJECT_TPL_SELECT = {
  id: true,
  externalId: true,
  name: true,
  description: true,
  nav: true,
  cat: true,
  catLabel: true,
  orient: true,
  res: true,
  tags: true,
  icon: true,
  bg: true,
  templateApp: true,
  metaJson: true,
  fileName: true,
  fileSize: true,
  isPro: true,
  contributor: { select: { name: true, email: true } },
  createdAt: true,
  updatedAt: true,
  assetKeysJson: true,
} as const;

const nameSchema = z.object({ name: z.string().trim().min(1).max(120) });
const itemSchema = z.object({
  kind: z.enum(["gen", "template"]),
  refId: z.string().min(1).max(64),
});

/** Egalik tekshiruvi — topilmasa/begona bo'lsa null (route 404 qaytaradi). */
async function ownedProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return project && project.ownerId === userId ? project : null;
}

/** GET / — mening loyihalarim (item soni + 4 tagacha real cover media). */
projectsRouter.get("/", async (req: Request, res: Response) => {
  const base = getPublicApiUrl(req);
  const projects = await prisma.project.findMany({
    where: { ownerId: req.user!.userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      _count: { select: { items: true } },
      items: { orderBy: { addedAt: "desc" }, take: 4 },
    },
  });
  // Cover'lar batch: gen'lar bitta so'rov, shablonlar bitta so'rov (dedupe bilan)
  const genIds = new Set<string>();
  const tplIds = new Set<string>();
  for (const p of projects) {
    for (const it of p.items) {
      if (it.kind === "gen") genIds.add(it.refId);
      else tplIds.add(it.refId);
    }
  }
  const [gens, tplRows] = await Promise.all([
    genIds.size
      ? prisma.generation.findMany({
          where: { id: { in: [...genIds] }, userId: req.user!.userId, status: "done" },
          include: { assets: { take: 1 } },
        })
      : Promise.resolve([]),
    tplIds.size
      ? prisma.contributorTemplate.findMany({
          where: { id: { in: [...tplIds] }, ...approvedCatalogWhere },
          select: PROJECT_TPL_SELECT,
        })
      : Promise.resolve([]),
  ]);
  const genCover = new Map<string, { thumb: string | null; mode: string }>();
  await Promise.all(
    gens.map(async (g) => {
      genCover.set(g.id, { thumb: await genCoverThumbUrl(g.assets[0]), mode: g.mode });
    })
  );
  const tplCover = new Map<string, string | null>();
  await Promise.all(
    tplRows.map(async (t) => {
      const mapped = await mapCatalogItem(t, base);
      tplCover.set(t.id, mapped.thumbUrl);
    })
  );
  res.json({
    items: projects.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      count: p._count.items,
      covers: p.items
        .map((it) =>
          it.kind === "gen"
            ? genCover.has(it.refId)
              ? { kind: "gen", thumb: genCover.get(it.refId)!.thumb, mode: genCover.get(it.refId)!.mode }
              : null
            : tplCover.has(it.refId)
              ? { kind: "template", thumb: tplCover.get(it.refId) ?? null, mode: "template" }
              : null
        )
        .filter(Boolean),
    })),
  });
});

/** POST / — yangi loyiha. */
projectsRouter.post("/", async (req: Request, res: Response) => {
  const p = nameSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const project = await prisma.project.create({
    data: { ownerId: req.user!.userId, name: p.data.name },
  });
  res.status(201).json(project);
});

/** GET /:id — loyiha + item'lari (media to'liq resolve qilingan holda). */
projectsRouter.get("/:id", async (req: Request, res: Response) => {
  const project = await ownedProject(String(req.params.id), req.user!.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const base = getPublicApiUrl(req);
  const items = await prisma.projectItem.findMany({
    where: { projectId: project.id },
    orderBy: { addedAt: "desc" },
  });
  const genIds = items.filter((i) => i.kind === "gen").map((i) => i.refId);
  const tplIds = items.filter((i) => i.kind === "template").map((i) => i.refId);
  const [gens, tplRows] = await Promise.all([
    genIds.length
      ? prisma.generation.findMany({
          where: { id: { in: genIds }, userId: req.user!.userId, status: "done" },
          include: { assets: true },
        })
      : Promise.resolve([]),
    tplIds.length
      ? prisma.contributorTemplate.findMany({
          where: { id: { in: tplIds }, ...approvedCatalogWhere },
          select: PROJECT_TPL_SELECT,
        })
      : Promise.resolve([]),
  ]);
  await Promise.all(gens.map((g) => hydrateGenAssets(g)));
  const tplMapped = await Promise.all(tplRows.map((t) => mapCatalogItem(t, base)));
  const genById = new Map(gens.map((g) => [g.id, g]));
  const tplById = new Map(tplMapped.map((t) => [t.id, t]));
  res.json({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    items: items
      .map((it) => {
        const src = it.kind === "gen" ? genById.get(it.refId) : tplById.get(it.refId);
        if (!src) return null; // manba o'chirilgan/unpublish — ko'rsatilmaydi
        return {
          id: it.id,
          kind: it.kind,
          refId: it.refId,
          addedAt: it.addedAt,
          ...(it.kind === "gen" ? { gen: src } : { template: src }),
        };
      })
      .filter(Boolean),
  });
});

/** PATCH /:id — qayta nomlash. */
projectsRouter.patch("/:id", async (req: Request, res: Response) => {
  const p = nameSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const project = await ownedProject(String(req.params.id), req.user!.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { name: p.data.name },
  });
  res.json(updated);
});

/** DELETE /:id — loyihani o'chirish (item'lar cascade). */
projectsRouter.delete("/:id", async (req: Request, res: Response) => {
  const project = await ownedProject(String(req.params.id), req.user!.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  await prisma.project.delete({ where: { id: project.id } });
  res.json({ ok: true });
});

/** POST /:id/items — gen yoki shablonni loyihaga qo'shish (idempotent upsert). */
projectsRouter.post("/:id/items", async (req: Request, res: Response) => {
  const p = itemSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const project = await ownedProject(String(req.params.id), req.user!.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const { kind, refId } = p.data;
  if (kind === "gen") {
    const gen = await prisma.generation.findUnique({ where: { id: refId } });
    if (!gen || gen.userId !== req.user!.userId) {
      res.status(404).json({ error: "Generation not found" });
      return;
    }
  } else {
    const tpl = await prisma.contributorTemplate.findFirst({
      where: { id: refId, ...approvedCatalogWhere },
      select: { id: true },
    });
    if (!tpl) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
  }
  const item = await prisma.projectItem.upsert({
    where: { projectId_kind_refId: { projectId: project.id, kind, refId } },
    create: { projectId: project.id, kind, refId },
    update: {},
  });
  // Ro'yxat tartibi uchun loyiha faoliyat vaqti yangilanadi
  await prisma.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
  res.status(201).json(item);
});

/** DELETE /:id/items/:itemId — item'ni loyihadan olib tashlash. */
projectsRouter.delete("/:id/items/:itemId", async (req: Request, res: Response) => {
  const project = await ownedProject(String(req.params.id), req.user!.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const item = await prisma.projectItem.findUnique({ where: { id: String(req.params.itemId) } });
  if (!item || item.projectId !== project.id) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  await prisma.projectItem.delete({ where: { id: item.id } });
  res.json({ ok: true });
});
