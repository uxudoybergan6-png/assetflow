#!/usr/bin/env node
/**
 * Eski/katta previewlarni 720p H.264 ga QAYTA transcode qiladi (bir martalik).
 * optimizePreviewForStreaming tuzatishi faqat YANGI uploadlarga tushgan — eski
 * shablonlarning previewlari hali 250MB/4K. Bu skript admin sifatida kirib,
 * barcha shablonlarni (scope=all) aylanadi va preview'i borlari uchun
 * POST /api/contributor/admin/templates/:id/re-transcode-preview ni KETMA-KET
 * chaqiradi (parallel emas — Render 512MB OOM oldini olish uchun).
 *
 * Ishlatish:
 *   API_URL=https://assetflow-api-331762958776.europe-west1.run.app \
 *   ADMIN_EMAIL=admin@assetflow.uz ADMIN_PASSWORD=admin123 \
 *   node scripts/retranscode-previews.mjs
 *
 *   # Faqat ayrim shablonlar:
 *   node scripts/retranscode-previews.mjs <templateId> [<templateId> ...]
 *
 *   # Quruq yurish (hech narsa o'zgartirmaydi, ro'yxatni ko'rsatadi):
 *   DRY_RUN=1 node scripts/retranscode-previews.mjs
 */
const API = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@assetflow.uz";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const DRY_RUN = process.env.DRY_RUN === "1";
const idArgs = process.argv.slice(2).filter(Boolean);

async function req(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status} ${path}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function mb(bytes) {
  return (Number(bytes || 0) / 1024 / 1024).toFixed(1) + "MB";
}

async function main() {
  console.log(`\n=== Preview re-transcode (720p) ===`);
  console.log(`API: ${API}`);
  if (DRY_RUN) console.log("DRY_RUN — hech narsa o'zgartirilmaydi\n");

  // 1) Admin login
  const login = await req("/api/auth/login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = login.token;
  if (!token) throw new Error("Admin token olinmadi");

  // 2) Ishlanadigan shablon ID'lari
  let ids = idArgs;
  if (ids.length === 0) {
    const list = await req("/api/contributor/templates?scope=all", { token });
    const items = list.items || [];
    ids = items
      .filter((t) => t?.assets?.preview) // faqat preview'i borlar
      .map((t) => t.id);
    console.log(
      `${items.length} shablon, preview'i bor: ${ids.length}\n`
    );
  } else {
    console.log(`Argumentdan ${ids.length} ta shablon ID\n`);
  }

  if (ids.length === 0) {
    console.log("Ishlanadigan preview yo'q.");
    return;
  }

  // 3) Ketma-ket transcode
  let okCount = 0;
  let failCount = 0;
  let savedTotal = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const tag = `[${i + 1}/${ids.length}] ${id}`;
    if (DRY_RUN) {
      console.log(`${tag} — (dry) o'tkazib yuborildi`);
      continue;
    }
    try {
      const r = await req(
        `/api/contributor/admin/templates/${id}/re-transcode-preview`,
        { method: "POST", token }
      );
      const saved = Number(r.savedBytes || 0);
      savedTotal += saved;
      okCount++;
      console.log(
        `${tag} — ✓ ${mb(r.beforeBytes)} → ${mb(r.afterBytes)} ` +
          `(tejaldi ${mb(saved)}${r.transcoded ? "" : ", faststart-only"}` +
          `${r.removedOldKey ? ", eski kalit o'chirildi" : ""})`
      );
    } catch (e) {
      failCount++;
      console.error(`${tag} — ✗ ${e.message}`);
    }
  }

  console.log(
    `\nTayyor: ${okCount} ✓ / ${failCount} ✗ — jami tejaldi ${mb(savedTotal)}`
  );
  if (failCount > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("\nXATO:", e.message);
  process.exit(1);
});
