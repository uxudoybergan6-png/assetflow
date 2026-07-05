import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsPath = path.join(__dirname, "../../data/system-logs.json");
const MAX_LOGS = 500;

function readLogs(): LogEntry[] {
  try {
    if (fs.existsSync(logsPath)) {
      return JSON.parse(fs.readFileSync(logsPath, "utf8")) as LogEntry[];
    }
  } catch {
    /* */
  }
  return [];
}

function writeLogs(entries: LogEntry[]) {
  fs.mkdirSync(path.dirname(logsPath), { recursive: true });
  fs.writeFileSync(
    logsPath,
    JSON.stringify(entries.slice(0, MAX_LOGS), null, 2),
    "utf8"
  );
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
/** Manba SPOOF qilinmasin — autentifikatsiyalangan roldan majburlanadi
 *  (klient body'siga ishonmaymiz). Admin panelidagi saqlangan-XSS (source
 *  badge'ida escape'siz matn) va manba soxtalashtirishni ildizidan yopadi. */
function sourceFromRole(role?: string): string {
  if (role === "ADMIN") return "admin";
  if (role === "CONTRIBUTOR") return "contributor";
  return "ae_plugin"; // USER (plugin obunachi)
}

logsRouter.post("/", (req, res) => {
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
    meta: entry.meta ?? null,
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
