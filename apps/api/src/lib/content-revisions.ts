import { prisma, Prisma } from "@creative-tools/database";

// ── SC_62 — CMS konfiguratsiya versiya tarixi ────────────────────────────────
// Har muvaffaqiyatli saqlashda YANGI saqlangan blob snapshot qilinadi; admin
// oxirgi N versiyani ko'rib, bir bosishda qaytara oladi. Jadval hali migratsiya
// qilinmagan bo'lsa yozish/o'qish jim muvaffaqiyatsiz bo'ladi (CMS yiqilmasin).

export type ContentConfigKind = "landing" | "plugin";

const KEEP_REVISIONS = 20;

export async function recordContentRevision(
  kind: ContentConfigKind,
  data: unknown,
  savedById: string | null
): Promise<void> {
  try {
    await prisma.contentConfigRevision.create({
      data: { kind, data: (data ?? {}) as Prisma.InputJsonValue, savedById },
    });
    // Eskilarini kesish — faqat oxirgi KEEP_REVISIONS qoladi (kind bo'yicha).
    const stale = await prisma.contentConfigRevision.findMany({
      where: { kind },
      orderBy: { createdAt: "desc" },
      skip: KEEP_REVISIONS,
      select: { id: true },
    });
    if (stale.length) {
      await prisma.contentConfigRevision.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
    }
  } catch (e) {
    console.warn("[content-revisions] record failed:", (e as Error)?.message);
  }
}

export interface ContentRevisionListItem {
  id: string;
  kind: string;
  createdAt: string;
  savedById: string | null;
  savedByEmail: string | null;
  keys: string[]; // blob'dagi yuqori darajali bo'lim kalitlari (qisqa ko'rinish uchun)
}

export async function listContentRevisions(kind: ContentConfigKind): Promise<ContentRevisionListItem[]> {
  try {
    const rows = await prisma.contentConfigRevision.findMany({
      where: { kind },
      orderBy: { createdAt: "desc" },
      take: KEEP_REVISIONS,
    });
    const ids = Array.from(new Set(rows.map((r) => r.savedById).filter((v): v is string => !!v)));
    const users = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })
      : [];
    const emailById = new Map(users.map((u) => [u.id, u.email]));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      createdAt: r.createdAt.toISOString(),
      savedById: r.savedById,
      savedByEmail: r.savedById ? (emailById.get(r.savedById) ?? null) : null,
      keys: r.data && typeof r.data === "object" && !Array.isArray(r.data) ? Object.keys(r.data as object).slice(0, 24) : [],
    }));
  } catch (e) {
    console.warn("[content-revisions] list failed:", (e as Error)?.message);
    return [];
  }
}

export async function getContentRevision(
  id: string
): Promise<{ id: string; kind: string; data: unknown } | null> {
  try {
    const row = await prisma.contentConfigRevision.findUnique({ where: { id } });
    return row ? { id: row.id, kind: row.kind, data: row.data } : null;
  } catch {
    return null;
  }
}
