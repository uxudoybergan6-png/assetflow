import { prisma } from "@creative-tools/database";
import { grantContributorEarning } from "./earnings.js";

/**
 * Bosqich 4 #1 — REAL download/import event tracking.
 *
 * Har haqiqiy pack/mogrt yuklab olish yoki AE import uchun BITTA atomik
 * `TemplateDownloadEvent` qatori yaratadi. Contributor statistikasi shu real
 * hodisalardan olinadi — ilgari forgeable `ContributorTemplate.downloadsCount`
 * Int hisoblagichdan olinardi. Yozuv NON-BLOCKING: xato yuz bersa ham asosiy
 * yuklab olish (fayl berish / redirect) BLOKLANMAYDI (writeCreditLedger naqshi).
 *
 * `contributorId` denormalizatsiya qilingan (payout attribution + tez agregatsiya).
 * Shablon topilmasa (o'chirilgan/noto'g'ri id) — jim o'tadi.
 */
export async function recordTemplateDownloadEvent(input: {
  templateId: string | undefined;
  userId: string;
  kind: "download" | "import";
  source?: "plugin" | "web";
}): Promise<{ id: string; contributorId: string } | null> {
  if (!input.templateId) return null;
  try {
    const tpl = await prisma.contributorTemplate.findUnique({
      where: { id: input.templateId },
      select: { contributorId: true },
    });
    if (!tpl) return null;
    const ev = await prisma.templateDownloadEvent.create({
      data: {
        templateId: input.templateId,
        userId: input.userId,
        contributorId: tpl.contributorId,
        kind: input.kind,
        source: input.source ?? "plugin",
      },
      select: { id: true, contributorId: true },
    });
    // Bosqich 4 #3: har download hodisasidan contributor earning (idempotent, best-effort).
    await grantContributorEarning({
      downloadEventId: ev.id,
      templateId: input.templateId,
      contributorId: ev.contributorId,
      kind: input.kind,
    });
    return ev;
  } catch (e) {
    console.error("recordTemplateDownloadEvent", e);
    return null;
  }
}

/**
 * Bir nechta shablon uchun REAL download/import sonini bitta groupBy so'rov bilan
 * qaytaradi (N+1 emas). Contributor dashboard statistikasi shu yerdan olinadi.
 * Bo'sh ro'yxat → bo'sh Map.
 */
export async function realTemplateCounts(
  templateIds: string[]
): Promise<Map<string, { downloads: number; imports: number }>> {
  const out = new Map<string, { downloads: number; imports: number }>();
  const ids = Array.from(new Set(templateIds.filter(Boolean)));
  if (ids.length === 0) return out;
  try {
    const rows = await prisma.templateDownloadEvent.groupBy({
      by: ["templateId", "kind"],
      where: { templateId: { in: ids } },
      _count: { _all: true },
    });
    for (const r of rows) {
      const cur = out.get(r.templateId) ?? { downloads: 0, imports: 0 };
      if (r.kind === "import") cur.imports += r._count._all;
      else cur.downloads += r._count._all;
      out.set(r.templateId, cur);
    }
  } catch (e) {
    console.error("realTemplateCounts", e);
  }
  return out;
}

/**
 * Shablon qatoriga real download/import sonini qo'shadi (transitional fallback:
 * real hodisa hali 0 bo'lsa — eski Int hisoblagichni ko'rsatadi, birinchi real
 * hodisadan keyin real songa o'tadi; deploy'da tarixiy son yo'qolmaydi).
 */
export function applyRealCounts<
  T extends { id: string; downloadsCount?: number; importsCount?: number }
>(row: T, counts: Map<string, { downloads: number; imports: number }>): T {
  const real = counts.get(row.id);
  if (!real) return row;
  return {
    ...row,
    downloadsCount: real.downloads > 0 ? real.downloads : row.downloadsCount ?? 0,
    importsCount: real.imports > 0 ? real.imports : row.importsCount ?? 0,
  };
}
