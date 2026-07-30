import { Router } from "express";
import crypto from "crypto";
import { prisma } from "@creative-tools/database";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";

/**
 * (#94 / A6) Tizim loglari endi DB'da (`SystemLog`).
 *
 * Ilgari `apps/api/data/system-logs.json` fayli ishlatilardi. Cloud Run'da bu
 * ishonchsiz: konteyner o'chishi bilan loglar yo'qolardi, ko'p instansiyada esa
 * har biri O'Z faylini ko'rardi — admin panelida loglar tasodifiy "yo'qolib"
 * turardi. DB barcha instansiya uchun yagona va chidamli manba.
 *
 * (#103) Yozuv oqimi hali ham arzon bo'lishi kerak: POST javobni bloklamaydi,
 * yozuv fon rejimida bajariladi va xatolar yutiladi (log yozuvi asosiy oqimni
 * hech qachon buzmasligi kerak).
 */

const MAX_LOGS = 500; // bitta o'qishda qaytariladigan maksimal qator
const RETENTION_ROWS = 20_000; // shu chegaradan oshsa eng eskilari o'chiriladi
const TRIM_EVERY = 200; // har N yozuvda bir marta trim

type LogEntry = {
  id: string;
  ts: string;
  level: string;
  source: string;
  sourceLabel?: string;
  message: string;
  action?: string;
  detail?: string;
  meta?: unknown;
};

function rowToEntry(r: {
  id: string;
  ts: Date;
  level: string;
  source: string;
  sourceLabel: string | null;
  message: string;
  action: string | null;
  detail: string | null;
  metaJson: unknown;
}): LogEntry {
  return {
    id: r.id,
    ts: r.ts.toISOString(),
    level: r.level,
    source: r.source,
    sourceLabel: r.sourceLabel ?? r.source,
    message: r.message,
    action: r.action ?? "",
    detail: r.detail ?? "",
    meta: r.metaJson ?? null,
  };
}

export const logsRouter = Router();

// Yozish — har qanday autentifikatsiyalangan manba (admin/contributor/AE plagin)
// o'z faoliyat logini yuborishi mumkin. O'qish/tozalash — faqat admin.
logsRouter.use(requireAuth);

logsRouter.get("/", requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, MAX_LOGS);
  const source = req.query.source as string | undefined;
  const where = source && source !== "all" ? { source } : {};
  try {
    const rows = await prisma.systemLog.findMany({
      where,
      orderBy: { ts: "desc" },
      take: limit,
    });
    res.json({ items: rows.map(rowToEntry) });
  } catch (e) {
    // Migratsiya hali qo'llanmagan bo'lsa (jadval yo'q) — admin ekrani
    // yiqilmasin, bo'sh ro'yxat + sabab qaytadi.
    console.error("[logs] read failed", e);
    res.json({ items: [], degraded: true });
  }
});

const ALLOWED_LEVELS = new Set(["error", "warn", "info", "debug"]);
const clip = (v: unknown, n: number): string => String(v ?? "").slice(0, n);
/** (#103) `meta` chegarasiz edi — istalgan foydalanuvchi cheksiz JSON yozardi.
 *  2KB dan katta bo'lsa qisqartirilgan matn bilan almashtiriladi. */
const MAX_META_BYTES = 2048;
function clipMeta(meta: unknown): unknown {
  if (meta == null) return null;
  let json: string;
  try {
    json = JSON.stringify(meta) ?? "";
  } catch {
    return { truncated: true, reason: "unserializable" };
  }
  if (json.length <= MAX_META_BYTES) return meta;
  return { truncated: true, bytes: json.length, preview: json.slice(0, MAX_META_BYTES) };
}
/** Manba SPOOF qilinmasin — autentifikatsiyalangan roldan majburlanadi
 *  (klient body'siga ishonmaymiz). Admin panelidagi saqlangan-XSS (source
 *  badge'ida escape'siz matn) va manba soxtalashtirishni ildizidan yopadi. */
function sourceFromRole(role?: string): string {
  if (role === "ADMIN") return "admin";
  if (role === "CONTRIBUTOR") return "contributor";
  return "ae_plugin"; // USER (plugin obunachi)
}

// FAZA 2 (L4) — yozuv per-IP rate-limit: har autentifikatsiyalangan manba log yuborishi
// mumkin, lekin flood cheklanadi. O'qish/tozalash — faqat admin (yuqorida).
const logWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "logs-write",
  // (#103) per-USER: NAT ortidagi jamoa bir-birini bloklamasin, bitta hisob esa
  // IP almashtirib limitni chetlab o'tolmasin.
  keyOf: (req) => req.user?.userId,
  message: "Too many log writes — please slow down",
});

let writesSinceTrim = 0;

/** Eng eski qatorlarni supuradi (RETENTION_ROWS dan oshgani). Best-effort. */
async function trimOldLogs() {
  const total = await prisma.systemLog.count();
  if (total <= RETENTION_ROWS) return;
  const cutoffRow = await prisma.systemLog.findMany({
    orderBy: { ts: "desc" },
    skip: RETENTION_ROWS,
    take: 1,
    select: { ts: true },
  });
  const cutoff = cutoffRow[0]?.ts;
  if (!cutoff) return;
  await prisma.systemLog.deleteMany({ where: { ts: { lte: cutoff } } });
}

logsRouter.post("/", logWriteLimiter, async (req, res) => {
  const entry = req.body;
  if (!entry?.message) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  const source = sourceFromRole(req.user?.role);
  const ts =
    typeof entry.ts === "string" && !Number.isNaN(Date.parse(entry.ts))
      ? new Date(entry.ts)
      : new Date();
  const id = clip(entry.id, 80) || crypto.randomUUID();
  const data = {
    ts,
    level: ALLOWED_LEVELS.has(entry.level) ? entry.level : "info",
    source,
    sourceLabel: clip(entry.sourceLabel || source, 60),
    message: clip(entry.message, 500),
    action: clip(entry.action, 120),
    detail: clip(entry.detail, 1000),
    metaJson: clipMeta(entry.meta) as never,
    userId: req.user?.userId ?? null,
  };
  try {
    // Klient bir xil `id` bilan qayta yuborishi mumkin (retry) → upsert.
    await prisma.systemLog.upsert({ where: { id }, update: data, create: { id, ...data } });
    if (++writesSinceTrim >= TRIM_EVERY) {
      writesSinceTrim = 0;
      // Cloud Run javobdan keyin CPU'ni to'xtatadi — trim'ni ham kutamiz.
      await trimOldLogs().catch((e) => console.error("[logs] trim failed", e));
    }
    res.json({ ok: true, id });
  } catch (e) {
    // Log yozuvi hech qachon chaqiruvchini buzmasligi kerak.
    console.error("[logs] write failed", e);
    res.json({ ok: false, id, degraded: true });
  }
});

logsRouter.delete("/", requireAdmin, async (_req, res) => {
  try {
    await prisma.systemLog.deleteMany({});
    res.json({ ok: true });
  } catch (e) {
    console.error("[logs] clear failed", e);
    res.status(500).json({ error: "Failed to clear logs" });
  }
});
