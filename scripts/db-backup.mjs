#!/usr/bin/env node
/**
 * DB backup (Bosqich 1 #8) — Postgres (Neon) logical backup.
 *
 * `pg_dump` (custom format -Fc, o'zi siqilgan) bilan DATABASE_URL'dan snapshot oladi:
 *   node scripts/db-backup.mjs
 *
 * Natija: ./backups/frameflow-<UTC-stamp>.dump (yoki BACKUP_DIR).
 * BACKUP_GCS_BUCKET o'rnatilgan bo'lsa — `gcloud storage cp` bilan gs://<bucket>/db/ ga yuklaydi
 * (retention/versioning bucket tomonida — DR-RUNBOOK'ga qarang).
 *
 * Talab: `pg_dump` PATH'da (Neon PG versiyasiga mos, masalan postgresql-client-16). Env: DATABASE_URL.
 * Restore yo'riqnomasi: docs/DR-RUNBOOK.md.
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("[db-backup] DATABASE_URL yo'q — bekor qilindi");
  process.exit(1);
}

// pg_dump mavjudligini tekshiramiz (aniq xato — jim yiqilmasin).
try {
  execSync("pg_dump --version", { stdio: "ignore" });
} catch {
  console.error(
    "[db-backup] pg_dump topilmadi — PostgreSQL client o'rnating (masalan: apt-get install postgresql-client-16)"
  );
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
const dir = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `frameflow-${stamp}.dump`);

console.log(`[db-backup] pg_dump → ${file}`);
try {
  // -Fc: custom format (siqilgan, pg_restore bilan tanlab tiklash mumkin). --no-owner/--no-acl:
  // boshqa rolga tiklashda muammo bo'lmasin (Neon).
  execFileSync("pg_dump", ["-Fc", "--no-owner", "--no-acl", "-f", file, DB_URL], {
    stdio: ["ignore", "inherit", "inherit"],
  });
} catch (e) {
  console.error("[db-backup] pg_dump xatosi:", e.message || e);
  process.exit(1);
}

const sizeMb = (fs.statSync(file).size / (1024 * 1024)).toFixed(2);
console.log(`[db-backup] tayyor — ${sizeMb} MB`);

const bucket = process.env.BACKUP_GCS_BUCKET?.trim();
if (bucket) {
  const dest = `gs://${bucket.replace(/^gs:\/\//, "").replace(/\/$/, "")}/db/${path.basename(file)}`;
  console.log(`[db-backup] yuklanmoqda → ${dest}`);
  try {
    execFileSync("gcloud", ["storage", "cp", file, dest], { stdio: "inherit" });
    console.log("[db-backup] GCS'ga yuklandi");
  } catch (e) {
    console.error("[db-backup] GCS yuklash xatosi (lokal nusxa saqlanadi):", e.message || e);
    process.exit(1);
  }
} else {
  console.log("[db-backup] BACKUP_GCS_BUCKET yo'q — faqat lokal nusxa saqlandi");
}
