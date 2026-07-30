import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsPath = path.join(__dirname, "../../data/system-logs.json");
const MAX_LOGS = 500;

/**
 * (#103) Ilgari HAR POST faylni sinxron o'qib, 500 qatorli JSON'ni sinxron QAYTA
 * yozardi → event loop bloklanardi va disk yozuvi kuchayardi. Endi ro'yxat
 * XOTIRADA (yagona manba), diskka yozish ASINXRON va birlashtirilgan (coalesced):
 * ketma-ket yozuvlar bitta flush'ga yig'iladi.
 */
let cache: LogEntry[] | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let flushing = false;

function readLogs(): LogEntry[] {
  if (cache) return cache;
  try {
    if (fs.existsSync(logsPath)) {
      const parsed = JSON.parse(fs.readFileSync(logsPath, "utf8")) as LogEntry[];
      cache = Array.isArray(parsed) ? parsed : [];
    } else {
      cache = [];
    }
  } catch {
    cache = [];
  }
  return cache;
}

async function flushLogs() {
  if (flushing || !cache) return;
  flushing = true;
  const snapshot = cache.slice(0, MAX_LOGS);
  try {
    await fs.promises.mkdir(path.dirname(logsPath), { recursive: true });
    await fs.promises.writeFile(logsPath, JSON.stringify(snapshot, null, 2), "utf8");
  } catch (e) {
    console.error("[logs] flush failed", e);
  } finally {
    flushing = false;
  }
}

/** Xotiradagi ro'yxatni yangilaydi va diskka yozishni ~1s ga birlashtiradi. */
function writeLogs(entries: LogEntry[]) {
  cache = entries.slice(0, MAX_LOGS);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushLogs();
  }, 1000);
  flushTimer.unref?.();
}

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

export const logsRouter = Router();

// Yozish — har qanday autentifikatsiyalangan manba (admin/contributor/AE plagin)
// o'z faoliyat logini yuborishi mumkin. O'qish/tozalash — faqat admin.
logsRouter.use(requireAuth);

logsRouter.get("/", requireAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, MAX_LOGS);
  const source = req.query.source as string | undefined;
  let items = readLogs();
  if (source && source !== "all") {
    items = items.filter((e) => e.source === source);
  }
  res.json({ items: items.slice(0, limit) });
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
// mumkin, lekin flood (har POST 500-qatorli faylni qayta yozadi = disk write amplifikatsiyasi)
// cheklanadi. Store allaqachon bounded (MAX_LOGS=500). O'qish/tozalash — faqat admin (yuqorida).
const logWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "logs-write",
  // (#103) per-USER: NAT ortidagi jamoa bir-birini bloklamasin, bitta hisob esa
  // IP almashtirib limitni chetlab o'tolmasin.
  keyOf: (req) => req.user?.userId,
  message: "Too many log writes — please slow down",
});

logsRouter.post("/", logWriteLimiter, (req, res) => {
  const entry = req.body;
  if (!entry?.message) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  const source = sourceFromRole(req.user?.role);
  const ts = typeof entry.ts === "string" && !Number.isNaN(Date.parse(entry.ts))
    ? entry.ts
    : new Date().toISOString();
  const row: LogEntry = {
    id: clip(entry.id, 80) || crypto.randomUUID(),
    ts,
    level: ALLOWED_LEVELS.has(entry.level) ? entry.level : "info",
    source,
    sourceLabel: clip(entry.sourceLabel || source, 60),
    message: clip(entry.message, 500),
    action: clip(entry.action, 120),
    detail: clip(entry.detail, 1000),
    meta: clipMeta(entry.meta),
  };
  const all = readLogs();
  const idx = all.findIndex((x) => x.id === row.id);
  if (idx >= 0) all[idx] = row;
  else all.unshift(row);
  writeLogs(all);
  res.json({ ok: true, id: row.id });
});

logsRouter.delete("/", requireAdmin, (_req, res) => {
  writeLogs([]);
  res.json({ ok: true });
});
