#!/usr/bin/env node
/**
 * Contributor → Admin → (reject/approve) → Plugin katalog smoke test
 *
 * Bu skript front-end UI emas, backend funksiyalarini tekshiradi:
 * - register/login
 * - template create
 * - multipart assets upload (thumb/preview/pack)
 * - submit → PENDING_REVIEW
 * - admin review: reject va approve (published true/false)
 * - plugin catalog orqali APPROVED+published filtrni tekshirish
 * - delete → katalogdan chiqishi
 *
 * npm run pm2:start oldin ishlayotgan bo'lsin (API: :4000).
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const API = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");

function tmpPath(name) {
  return path.join(os.tmpdir(), `assetflow_${Date.now()}_${name}`);
}

const execFileAsync = promisify(execFile);

async function reqJson(endpoint, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status} ${endpoint}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function uploadAssets(templateId, token, { thumbPath, previewPath, packPath }) {
  const endpoint = `${API}/api/contributor/templates/${templateId}/assets`;
  const curlArgs = ["-sS", "-X", "POST", endpoint];
  if (token) curlArgs.push("-H", `Authorization: Bearer ${token}`);
  if (thumbPath)
    curlArgs.push("-F", `thumb=@${thumbPath};filename=${path.basename(thumbPath)}`);
  if (previewPath)
    curlArgs.push("-F", `preview=@${previewPath};filename=${path.basename(previewPath)}`);
  if (packPath) curlArgs.push("-F", `pack=@${packPath};filename=${path.basename(packPath)}`);

  const { stdout } = await execFileAsync("curl", curlArgs, { timeout: 180_000 });
  let data = null;
  try {
    data = stdout ? JSON.parse(stdout) : null;
  } catch {
    data = { raw: stdout };
  }
  if (data?.error) {
    const err = new Error(data.error || "Upload xato");
    err.data = data;
    throw err;
  }
  return data;
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function warn(msg) {
  console.log(`  ⚠ ${msg}`);
}
function fail(msg) {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
}

async function main() {
  console.log("\n=== Contributor/Admin full smoke test (API) ===\n");
  console.log(`API: ${API}\n`);

  // 0) health
  const health = await reqJson("/health");
  if (health.status !== "ok") fail("API /health status!=ok");
  else ok("API /health");

  // 1) login admin
  const adminLogin = await reqJson("/api/auth/login", {
    method: "POST",
    body: { email: "admin@assetflow.uz", password: "admin123" },
  });
  const adminToken = adminLogin.token;
  if (adminLogin.user?.role !== "ADMIN") {
    fail(`Admin role: ${adminLogin.user?.role}`);
    return;
  }
  ok("Admin login (ADMIN)");

  // 2) make contributor user
  const stamp = Date.now();
  const email = `smoke-${stamp}@test.local`;
  const pass = "testpass12345";
  const reg = await reqJson("/api/auth/register", {
    method: "POST",
    body: {
      email,
      password: pass,
      name: "Smoke Test",
      asContributor: true,
    },
  });
  const contribToken = reg.token;
  ok(`Contributor ro'yxat: ${email}`);

  // 3) Prepare upload files
  // preview optimizatsiya ffmpeg bilan ishlaydi, shuning uchun tez bo‘lishi uchun kichik mp4 generatsiya qilamiz.
  const previewPath = tmpPath("preview.mp4");
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=160x90",
      "-t",
      "1",
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      previewPath,
    ],
    { timeout: 30_000 }
  );

  const thumbPath = tmpPath("thumb.png");
  // 1x1 transparent PNG (base64)
  fs.writeFileSync(
    thumbPath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X9kQAAAAASUVORK5CYII=",
      "base64"
    )
  );

  const packPath = tmpPath("pack.aep");
  fs.writeFileSync(packPath, Buffer.from("dummy-assetflow-pack-aep"));

  async function createAndSubmit(name, catLabel) {
    const created = await reqJson("/api/contributor/templates", {
      method: "POST",
      token: contribToken,
      body: {
        name,
        description: "Smoke test template",
        cat: "logos",
        catLabel,
        nav: "video",
        orient: "horizontal",
        res: "4k",
        tags: ["smoke", "api"],
        templateApp: "ae",
      },
    });
    ok(`Template create: ${created.id}`);

    const uploaded = await uploadAssets(created.id, contribToken, {
      thumbPath,
      previewPath,
      packPath,
    });
    ok(
      `Assets upload (${created.id}) thumb=${uploaded?.uploaded?.thumb} preview=${uploaded?.uploaded?.preview} pack=${uploaded?.uploaded?.pack}`
    );

    const submitted = await reqJson(`/api/contributor/templates/${created.id}/submit`, {
      method: "POST",
      token: contribToken,
    });
    if (submitted.reviewStatus !== "PENDING_REVIEW") {
      fail(`Submit status: ${submitted.reviewStatus}`);
    } else {
      ok("Submit → PENDING_REVIEW");
    }
    return created.id;
  }

  // 4) Reject flow: should not appear in plugin catalog
  const tReject = await createAndSubmit(`Smoke Reject ${stamp}`, "Title / Intro");
  await reqJson(`/api/contributor/templates/${tReject}/review`, {
    method: "POST",
    token: adminToken,
    body: { action: "reject", note: "unit test reject" },
  });
  ok("Admin reject");

  const catalogAfterReject = await reqJson("/api/plugin/catalog");
  const inRejectCatalog = catalogAfterReject.items?.some((i) => i.id === tReject);
  if (inRejectCatalog) fail("Rejected template katalogda turibdi (xato)");
  else ok("Rejected template katalogdan yo'q (to'g'ri)");

  // 5) Approve but published=false: should also not appear
  const tNoPublish = await createAndSubmit(`Smoke NoPublish ${stamp}`, "Title / Intro");
  await reqJson(`/api/contributor/templates/${tNoPublish}/review`, {
    method: "POST",
    token: adminToken,
    body: { action: "approve", published: false, note: "unit test: unpublished" },
  });
  ok("Admin approve (published=false)");

  const catalogAfterNoPublish = await reqJson("/api/plugin/catalog");
  const inNoPublishCatalog = catalogAfterNoPublish.items?.some((i) => i.id === tNoPublish);
  if (inNoPublishCatalog) fail("published=false bo'lgan template katalogda turibdi (xato)");
  else ok("published=false katalogda yo'q (to'g'ri)");

  // 6) Approve with published=true: should appear, pack should be available (hasPack)
  const tApprove = await createAndSubmit(`Smoke Approve ${stamp}`, "Title / Intro");
  await reqJson(`/api/contributor/templates/${tApprove}/review`, {
    method: "POST",
    token: adminToken,
    body: { action: "approve", published: true, note: "unit test approve" },
  });
  ok("Admin approve (published=true)");

  const catalogAfterApprove = await reqJson("/api/plugin/catalog");
  const item = catalogAfterApprove.items?.find((i) => i.id === tApprove);
  if (!item) fail("Approved template katalogda yo'q (xato)");
  else {
    ok("Approved template katalogda bor");
    if (item.hasPack === false) warn("hasPack=false: pack fayl topilmadi (disk/extension tekshiring)");
    else ok("hasPack=true (pack bor)");
  }

  // 7) Delete (admin) should remove from DB → catalog
  await reqJson(`/api/contributor/templates/${tApprove}`, {
    method: "DELETE",
    token: adminToken,
  });
  ok("Admin delete template");

  const catalogAfterDelete = await reqJson("/api/plugin/catalog");
  const stillThere = catalogAfterDelete.items?.some((i) => i.id === tApprove);
  if (stillThere) fail("Delete qilingan template hali ham katalogda");
  else ok("Delete → katalogdan chiqdi");

  console.log("\n=== Tekshiruv yakuni ===\n");
}

main().catch((e) => {
  console.error("\nUnexpected error:", e?.message || e);
  process.exit(1);
});

