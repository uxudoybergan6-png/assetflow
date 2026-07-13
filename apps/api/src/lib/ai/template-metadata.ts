/**
 * Shablon AI metadatasi (Video Templates .zip) — ingest paytida zip nomidan (+ ixtiyoriy
 * preview rasmidan) nom / tavsif / kategoriya / 20 teg yozadi.
 *
 * P1.4 — endi umumiy `generateAssetMetadata` (lib/ai/asset-metadata.ts) ga delegatsiya
 * qiladi: Vertex Gemini BIRLAMCHI (OpenRouter retirilmoqda), OpenRouter fallback,
 * so'ng fayl-nomidan fallback. INTERNAL: foydalanuvchi krediti ISHLATILMAYDI.
 * Kategoriya ro'yxati YAGONA MANBA — lib/taxonomy.ts (video-templates).
 */
import { generateAssetMetadata } from "./asset-metadata.js";
import { categoriesForType } from "../taxonomy.js";

// Backward-compat re-export — video-templates kategoriya ro'yxati (yagona manba: taxonomy.ts).
export const TEMPLATE_CATEGORIES = categoriesForType("video-templates");

export type TemplateMetadata = {
  title: string;
  description: string;
  cat: string;
  catLabel: string;
  tags: string[];
  source: "vertex" | "openrouter" | "fallback";
};

/**
 * Ingest paytida (Video Templates .zip) chaqiriladi. Vertex Gemini birlamchi,
 * Description + type-scoped kategoriya + kunlik cap (P1.13). Hech qachon throw QILMAYDI.
 */
export async function generateTemplateMetadata(opts: {
  zipFileName: string;
  imagePath?: string | null;
  contributorId?: string;
  isAdmin?: boolean;
}): Promise<TemplateMetadata> {
  const meta = await generateAssetMetadata({
    typeKey: "video-templates",
    mediaClass: "project",
    displayName: opts.zipFileName,
    imagePaths: opts.imagePath ? [opts.imagePath] : [],
    contributorId: opts.contributorId,
    isAdmin: opts.isAdmin,
  });
  return {
    title: meta.title,
    description: meta.description,
    cat: meta.cat,
    catLabel: meta.catLabel,
    tags: meta.tags,
    source: meta.source,
  };
}
