/**
 * studio:sync — Vercel uchun studio/admin artefaktlarini MANBADAN qayta yaratadi.
 *
 * #10: eski apps/web (Next.js) lokal host + uning public/studio mirror'i o'chirildi.
 * Endi:
 *   - Lokal dev: dev-studio-server.mjs (:3000) + dev-admin-server.mjs (:3001) MANBANI
 *     to'g'ridan serv qiladi — sync KERAK EMAS.
 *   - CF Pages: prepare-cf-pages.mjs (manbadan self-regen).
 *   - Vercel: prepare-vercel.mjs (manbadan studio/ + admin/ artefakt).
 * Bu skript endi faqat prepare-vercel.mjs ni chaqiradi (Vercel artefaktini yangilash).
 * Hech bir deploy/lokal-host bu skriptga BOG'LIQ EMAS.
 */
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
execSync("node scripts/prepare-vercel.mjs", { cwd: root, stdio: "inherit" });
console.log("Studio Vercel artefaktlari manbadan qayta yaratildi (prepare-vercel).");
