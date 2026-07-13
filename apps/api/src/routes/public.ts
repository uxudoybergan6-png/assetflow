import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "@creative-tools/database";
import { approvedCatalogWhere, mapCatalogItem } from "../lib/catalog-map.js";
import { getPublicApiUrl } from "../lib/app-urls.js";
import { CATALOG_SELECT } from "./plugin.js";

/**
 * P2 (step 31) — OCHIQ per-asset endpoint (auth yo'q, kredit yo'q).
 *   Faqat `GET /api/public/asset/:id` — published aset metadatasi (deep-link + CF Pages
 *   OG-preview funksiyasi shundan o'qiydi). ⚠️ FAQAT published: unpublished/pending/takedown
 *   → 404 (moderatsiya navbatini oshkor qilmaydi). Pul-zonasiga tegmaydi.
 */
export const publicRouter = Router();

publicRouter.get("/asset/:id", async (req: Request, res: Response) => {
  const base = getPublicApiUrl(req);
  const raw = String(req.params.id || "");
  // id = to'liq cuid (a-z0-9) YOKI qisqa suffiks (URL shortId). Boshqasi → 400.
  if (!/^[a-z0-9]{4,40}$/i.test(raw)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // 1) To'liq id bo'yicha aniq mos (asosiy yo'l — client to'liq id yuborishi mumkin).
  let t = await prisma.contributorTemplate.findFirst({
    where: { ...approvedCatalogWhere, id: raw },
    select: CATALOG_SELECT,
  });
  // 2) Topilmasa VA qisqa (≤12) bo'lsa — suffiks (endsWith) bo'yicha yechamiz (URL shortId).
  //    Published to'plami kichik, 8-belgi cuid suffiksi amalda to'qnashmaydi; birinchisini olamiz.
  if (!t && raw.length <= 12) {
    t = await prisma.contributorTemplate.findFirst({
      where: { ...approvedCatalogWhere, id: { endsWith: raw } },
      orderBy: { createdAt: "asc" },
      select: CATALOG_SELECT,
    });
  }
  if (!t) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // OG-preview funksiyasi keshlaydi — qisqa edge-cache maslahati.
  res.set("Cache-Control", "public, max-age=300, s-maxage=600");
  res.json({ item: await mapCatalogItem(t, base) });
});
