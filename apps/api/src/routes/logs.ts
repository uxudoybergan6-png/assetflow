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

// Tizim loglari — faqat admin o'qiy/yoza/o'chira oladi
logsRouter.use(requireAuth, requireAdmin);

logsRouter.get("/", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, MAX_LOGS);
  const source = req.query.source as string | undefined;
  let items = readLogs();
  if (source && source !== "all") {
    items = items.filter((e) => e.source === source);
  }
  res.json({ items: items.slice(0, limit) });
});

logsRouter.post("/", (req, res) => {
  const entry = req.body;
  if (!entry?.message) {
    res.status(400).json({ error: "message kerak" });
    return;
  }
  const row: LogEntry = {
    id: entry.id || crypto.randomUUID(),
    ts: entry.ts || new Date().toISOString(),
    level: entry.level || "info",
    source: entry.source || "unknown",
    sourceLabel: entry.sourceLabel || entry.source,
    message: String(entry.message),
    action: entry.action || "",
    detail: entry.detail || "",
    meta: entry.meta ?? null,
  };
  const all = readLogs();
  const idx = all.findIndex((x) => x.id === row.id);
  if (idx >= 0) all[idx] = row;
  else all.unshift(row);
  writeLogs(all);
  res.json({ ok: true, id: row.id });
});

logsRouter.delete("/", (_req, res) => {
  writeLogs([]);
  res.json({ ok: true });
});
