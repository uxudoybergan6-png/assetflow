import {
  prisma,
  TemplateReviewStatus,
  Prisma,
} from "@creative-tools/database";
import { aiEmbed, isAiConfigured } from "./workers-ai.js";

/** Embedding uchun matn — title + kategoriya + teglar + tavsif (semantik kontekst). */
export function templateEmbedText(t: {
  name: string;
  description: string;
  tags: string[];
  catLabel: string;
}): string {
  return [t.name, t.catLabel, (t.tags || []).join(" "), t.description]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}

/** Bitta shablon uchun embedding yaratib saqlaydi (best-effort, bloklamaydi). */
export async function embedTemplate(
  templateId: string
): Promise<{ ok: boolean; reason?: string }> {
  if (!isAiConfigured()) return { ok: false, reason: "AI sozlanmagan" };
  const t = await prisma.contributorTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true, description: true, tags: true, catLabel: true },
  });
  if (!t) return { ok: false, reason: "Shablon topilmadi" };
  const out = await aiEmbed(templateEmbedText(t));
  if (!out.ok) return { ok: false, reason: out.error };
  await prisma.contributorTemplate.update({
    where: { id: templateId },
    data: { embedding: out.data as unknown as Prisma.InputJsonValue },
  });
  return { ok: true };
}

/** Approve hook'da fon rejimida chaqirish uchun — xatoni yutadi (loyiha oqimini bloklamaydi). */
export function embedTemplateInBackground(templateId: string): void {
  if (!isAiConfigured()) return;
  void embedTemplate(templateId).catch((e) => {
    console.warn(`[ai:embed] shablon embedding xato (${templateId}):`, e);
  });
}

/**
 * Mavjud APPROVED+published shablonlarga embedding yaratish (bir martalik backfill).
 * force=false bo'lsa faqat embedding'i yo'qlar; true — barchasi qayta hisoblanadi.
 */
export async function backfillEmbeddings(
  opts?: { force?: boolean }
): Promise<{ total: number; done: number; failed: number }> {
  if (!isAiConfigured()) return { total: 0, done: 0, failed: 0 };
  const rows = await prisma.contributorTemplate.findMany({
    where: {
      reviewStatus: TemplateReviewStatus.APPROVED,
      published: true,
    },
    select: { id: true, embedding: true },
  });
  const todo = opts?.force
    ? rows
    : rows.filter((r) => !Array.isArray(r.embedding));
  let done = 0;
  let failed = 0;
  for (const r of todo) {
    const res = await embedTemplate(r.id);
    if (res.ok) done++;
    else failed++;
  }
  return { total: todo.length, done, failed };
}

/** Ikki vektor orasidagi cosine o'xshashlik (−1..1). */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
