#!/usr/bin/env node
/**
 * Contributor → Admin → Plugin katalog zanjirini tekshiradi.
 * npm run studio / dev:api ishlab turgan bo'lishi kerak.
 *
 * #35 (I4) — ⚠️ BU SKRIPT YOZADI: haqiqiy contributor hisobi ochadi va shablonni
 * APPROVED + published qiladi, ya'ni u PLAGIN KATALOGIDA ko'rinadi. Ilgari hech narsa
 * tozalanmasdi va prod'ga qarshi ishlatish hujjatlashtirilgan edi → har ishga tushirish
 * mijoz katalogiga soxta "E2E Template …" qoldirardi.
 *
 * Endi:
 *   • LOKAL bo'lmagan API'ga qarshi ishlash BLOKLANGAN — ataylab `--allow-remote`
 *     bayrog'i (yoki VERIFY_ALLOW_REMOTE=1) kerak;
 *   • test shabloni va test hisobi OXIRIDA (xatoda ham) TOZALANADI.
 */
const argv = process.argv.slice(2);
const API = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const ALLOW_REMOTE = argv.includes("--allow-remote") || process.env.VERIFY_ALLOW_REMOTE === "1";
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(API);

if (!IS_LOCAL && !ALLOW_REMOTE) {
  console.error(
    `\n✗ ${API} — LOKAL emas.\n\n` +
      "Bu skript haqiqiy shablon yaratadi va uni PUBLISHED qiladi (plagin katalogida ko'rinadi).\n" +
      "Production/staging'ga qarshi ishlatish uchun aniq ruxsat kerak:\n\n" +
      `  API_URL=${API} node scripts/verify-pipeline.mjs --allow-remote\n\n` +
      "Yaratilgan yozuvlar oxirida tozalanadi, lekin moderatsiya/audit izlari qoladi.\n"
  );
  process.exit(2);
}

async function req(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
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
    err.data = data;
    throw err;
  }
  return data;
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
}

const stamp = Date.now();
const contribEmail = `pipeline-test-${stamp}@test.local`;
const contribPass = "testpass12345";

// #35 (I4) — tozalash uchun holat (main ichida emas: `finally` ham ko'rishi kerak).
let contribToken;
let adminToken;
let templateId;

/** Test artefaktlarini o'chiradi: shablon (admin — APPROVED bo'lsa faqat admin o'chira
 *  oladi) va test contributor hisobi. Best-effort — xato tekshiruv natijasini buzmaydi. */
async function cleanup() {
  console.log("\n--- Tozalash ---");
  if (templateId) {
    // Admin tokeni bo'lmasa olishga urinamiz (register bosqichidan keyin yiqilgan holat).
    if (!adminToken) {
      adminToken = await req("/api/auth/login", {
        method: "POST",
        body: { email: "admin@assetflow.uz", password: "admin123" },
      })
        .then((r) => r.token)
        .catch(() => undefined);
    }
    if (adminToken) {
      try {
        await req(`/api/contributor/templates/${templateId}`, { method: "DELETE", token: adminToken });
        ok(`test shabloni o'chirildi: ${templateId}`);
      } catch (e) {
        console.error(`  ✗ shablon o'chmadi (${templateId}): ${e.message} — QO'LDA o'chiring`);
      }
    } else {
      console.error(`  ✗ admin tokeni yo'q — shablon ${templateId} QOLDI, qo'lda o'chiring`);
    }
  }
  if (contribToken) {
    try {
      await req("/api/account", { method: "DELETE", token: contribToken, body: { confirm: "DELETE" } });
      ok(`test hisobi o'chirildi: ${contribEmail}`);
    } catch (e) {
      console.error(`  ✗ hisob o'chmadi (${contribEmail}): ${e.message} — QO'LDA o'chiring`);
    }
  }
}

async function main() {
  console.log("\n=== AssetFlow: Contributor → Admin → Plugin ===\n");
  console.log(`API: ${API}\n`);

  // 0. Health
  const health = await req("/health");
  if (health.status !== "ok") fail("Health");
  else ok("API /health");

  // 1. Contributor register + login
  try {
    const reg = await req("/api/auth/register", {
      method: "POST",
      body: {
        email: contribEmail,
        password: contribPass,
        name: "Pipeline Test",
        asContributor: true,
      },
    });
    contribToken = reg.token;
    ok(`Contributor ro'yxat: ${contribEmail} (${reg.user.role})`);
  } catch (e) {
    fail(`Contributor register: ${e.message}`);
    return;
  }

  // 2. Create + submit template
  try {
    const created = await req("/api/contributor/templates", {
      method: "POST",
      token: contribToken,
      body: {
        name: `E2E Template ${stamp}`,
        description: "Pipeline verification",
        cat: "intros",
        catLabel: "Title / Intro",
        nav: "video",
        orient: "horizontal",
        res: "4k",
        tags: ["test", "pipeline"],
      },
    });
    templateId = created.id;
    ok(`Shablon yaratildi: ${templateId} (${created.reviewStatus})`);

    const submitted = await req(`/api/contributor/templates/${templateId}/submit`, {
      method: "POST",
      token: contribToken,
    });
    if (submitted.reviewStatus !== "PENDING_REVIEW") {
      fail(`Submit status: ${submitted.reviewStatus}`);
    } else ok("Moderatsiyaga yuborildi (PENDING_REVIEW)");
  } catch (e) {
    fail(`Contributor upload: ${e.message}`);
    return;
  }

  // 3. Plugin catalog — hali bo'sh
  let catalog = await req("/api/plugin/catalog");
  const before = catalog.items?.length ?? 0;
  const inCatalogBefore = catalog.items?.some((i) => i.id === templateId);
  if (inCatalogBefore) fail("Tasdiqlanmagan shablon katalogda (xato)");
  else ok(`Plugin katalog: ${before} ta (yangi shablon yo'q — to'g'ri)`);

  // 4. Admin moderation list
  try {
    const admin = await req("/api/auth/login", {
      method: "POST",
      body: { email: "admin@assetflow.uz", password: "admin123" },
    });
    adminToken = admin.token;
    if (admin.user.role !== "ADMIN") fail(`Admin role: ${admin.user.role}`);
    else ok("Admin login");
  } catch (e) {
    fail(`Admin login: ${e.message} (npm run db:seed:assetflow?)`);
    return;
  }

  const mod = await req("/api/contributor/templates?scope=moderation", {
    token: adminToken,
  });
  const inMod = mod.items?.some((t) => t.id === templateId);
  if (!inMod) fail("Admin moderation ro'yxatida shablon yo'q");
  else ok("Admin moderation navbatida ko'rinadi");

  // 5. Approve
  try {
    const approved = await req(`/api/contributor/templates/${templateId}/review`, {
      method: "POST",
      token: adminToken,
      body: { action: "approve", published: true },
    });
    if (approved.reviewStatus !== "APPROVED" || !approved.published) {
      fail(`Approve: status=${approved.reviewStatus} published=${approved.published}`);
    } else ok("Admin tasdiqladi (APPROVED + published)");
  } catch (e) {
    fail(`Admin approve: ${e.message}`);
    return;
  }

  // 6. Plugin catalog — endi bor
  catalog = await req("/api/plugin/catalog");
  const item = catalog.items?.find((i) => i.id === templateId);
  if (!item) {
    fail("Plugin katalogida tasdiqlangan shablon yo'q");
  } else {
    ok(`Plugin katalog: "${item.name}"`);
    if (item.hasPack) {
      if (!item.packUrl?.includes(templateId)) {
        fail(`packUrl noto'g'ri: ${item.packUrl}`);
      } else ok("packUrl /api/plugin/assets/... ga ulanadi");
    } else {
      ok("hasPack: false (pack fayl yuklanmagan — AE import uchun .aep kerak)");
    }
  }

  // 7. Contributor o'z ro'yxatida approved
  const mine = await req("/api/contributor/templates?scope=mine", {
    token: contribToken,
  });
  const mineItem = mine.items?.find((t) => t.id === templateId);
  if (mineItem?.reviewStatus !== "APPROVED") {
    fail(`Contributor ko'rinishi: ${mineItem?.reviewStatus}`);
  } else ok("Contributor: status APPROVED");

  console.log("\n=== Natija: zanjir API darajasida ulangan ===\n");
  console.log("Studio UI:");
  console.log("  Contributor  http://localhost:3000/studio/contributor/");
  console.log("  Admin        http://localhost:3001/");
  console.log("  Plugin       AE Browse → server katalog (localhost:4000)\n");
}

// #35 (I4) — tozalash MUVAFFAQIYAT va XATO holatida ham ishlaydi (`process.exit` emas:
// aks holda `finally` bajarilmasdan qolardi).
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() =>
    cleanup().catch((e) => {
      console.error("  ✗ tozalash xato:", e.message);
    })
  );
