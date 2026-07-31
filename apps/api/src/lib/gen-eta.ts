/**
 * #141 (PX4) — model bo'yicha REAL kutish vaqti bahosi.
 *
 * MUAMMO: plagin video kompozerida "≈ 1–2 min" QATTIQ KODLANGAN matn turardi. U model
 * tanlovidan mustaqil edi va haqiqatdan uzoq: Seedance 1080p yoki Topaz upscale o'n
 * daqiqalarga cho'ziladi, TTS esa bir necha soniyada tugaydi. Foydalanuvchi "muzlab
 * qoldi" deb o'ylab bekor qilardi.
 *
 * YECHIM: taxmin qilmaymiz — O'ZIMIZNING tarixdan o'lchaymiz. Oxirgi 7 kunning
 * tugagan gen'lari bo'yicha `createdAt → updatedAt` medianasi (model bo'yicha).
 * Ma'lumot yetarli bo'lmasa (yangi model, kam ishlatilgan) — feature bo'yicha
 * konservativ zaxira qiymat.
 *
 * Eslatma: `updatedAt` job'ning OXIRGI yozuvida yangilanadi (done o'tishi) — ya'ni
 * navbat + provayder + saqlash vaqtini birgalikda o'lchaydi. Aynan foydalanuvchi
 * kutadigan vaqt shu.
 */
import { prisma } from "@creative-tools/database";
import type { GenModel } from "./gen-models.js";

const TTL_MS = 10 * 60 * 1000; // kesh — har so'rovda DB skanlamaymiz
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SAMPLE = 600; // oxirgi N tugagan gen
const MIN_SAMPLES = 3; // shundan kam bo'lsa medianaga ishonmaymiz

let cache: { at: number; map: Record<number, number> } | null = null;

/** Feature bo'yicha zaxira baho (soniya) — o'lchov yig'ilmaguncha. */
export function fallbackEtaSeconds(model: GenModel | null | undefined): number {
  switch (model?.feature) {
    case "video-upscale":
      return 900;
    case "reference-to-video":
      return 300;
    case "text-to-video":
    case "image-to-video":
      return 210;
    case "image-upscale":
      return 90;
    case "text-to-image":
    case "image-edit":
      return 40;
    case "text-to-speech":
    case "text-to-sfx":
      return 20;
    default:
      return 120;
  }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Model ID → o'lchangan mediana (soniya). Ma'lumot yo'q modellar ro'yxatga kirmaydi. */
export async function measuredEtaSeconds(): Promise<Record<number, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const map: Record<number, number> = {};
  try {
    const rows = await prisma.generation.findMany({
      where: { status: "done", createdAt: { gt: new Date(Date.now() - WINDOW_MS) } },
      select: { modelId: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: SAMPLE,
    });
    const byModel = new Map<number, number[]>();
    for (const r of rows) {
      const sec = Math.round((r.updatedAt.getTime() - r.createdAt.getTime()) / 1000);
      if (!(sec > 0) || sec > 4 * 60 * 60) continue; // buzuq/g'ayritabiiy yozuv
      const arr = byModel.get(r.modelId) || [];
      arr.push(sec);
      byModel.set(r.modelId, arr);
    }
    for (const [modelId, arr] of byModel) {
      if (arr.length < MIN_SAMPLES) continue;
      map[modelId] = Math.max(5, Math.min(3600, median(arr)));
    }
  } catch (e) {
    console.warn("[gen-eta] o'lchov o'qilmadi:", e instanceof Error ? e.message : e);
  }
  cache = { at: Date.now(), map };
  return map;
}
