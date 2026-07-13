/**
 * P1 #19 — ALOHIDA BULK-INGEST ISHCHISI (Cloud Run job entrypoint).
 *
 * Bu skript API servisidan MUSTAQIL ishlaydi — ingest CPU foydalanuvchi trafigi bilan
 * raqobatlashmasin (P7 §8 talabi). API servisida INGEST_WORKER_INLINE=0 qilinadi,
 * bu job esa navbatni (IngestJob) uzluksiz ishlaydi.
 *
 * Deploy: scripts/deploy-ingest-worker.sh (Cloud Run JOB, `--command node
 * dist/scripts/ingest-worker.js`). Job doim ishlab turadi (uzluksiz poller) yoki
 * Cloud Scheduler bilan davriy triggerlanadi (RUN_ONCE=1 → navbat bo'shaganда chiqadi).
 *
 * MUHIM: ../routes/contributor.js SIDE-EFFECT uchun import qilinadi — u modul
 * yuklanganda registerIngestProcessor(...) ni chaqiradi (ingestOneZip/ingestOneAsset
 * ni ulaydi). Router bu yerda LISTEN qilmaydi.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
dotenv.config({ path: path.join(monorepoRoot, ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

import { prisma } from "@creative-tools/database";
import { initSentry } from "../lib/sentry.js";
// Side-effect: ingest processor'ini ro'yxatga oladi (ingestOneZip/ingestOneAsset).
import "../routes/contributor.js";
import { runIngestWorkerLoop, stopIngestWorkerLoop, ingestWorkerTick } from "../lib/ingest-worker.js";

initSentry();

async function main() {
  console.log("[ingest-worker-job] boshlandi");
  await prisma.$queryRaw`SELECT 1`.catch((e) => {
    console.error("[ingest-worker-job] DB ulanmadi:", e);
    process.exit(1);
  });

  process.on("SIGTERM", () => {
    console.log("[ingest-worker-job] SIGTERM — to'xtayapman");
    stopIngestWorkerLoop();
  });
  process.on("SIGINT", () => {
    console.log("[ingest-worker-job] SIGINT — to'xtayapman");
    stopIngestWorkerLoop();
  });

  // RUN_ONCE=1 — navbat bo'shaguncha ishlab, keyin chiqadi (Cloud Scheduler triggeri uchun).
  if (process.env.RUN_ONCE === "1") {
    let empty = 0;
    // Ketma-ket bo'sh tick'lar ~2 marta bo'lsa navbat tugagan deb hisoblab chiqamiz.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const n = await ingestWorkerTick();
      if (n === 0) {
        if (++empty >= 2) break;
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        empty = 0;
      }
    }
    console.log("[ingest-worker-job] navbat bo'sh — chiqyapman (RUN_ONCE)");
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  }

  // Doimiy poller (default).
  await runIngestWorkerLoop();
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}

main().catch((e) => {
  console.error("[ingest-worker-job] fatal:", e);
  process.exit(1);
});
