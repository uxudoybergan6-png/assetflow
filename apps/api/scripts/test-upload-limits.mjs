// Security Task 1 — multipart (multer) parser cheklovlari regressiya testi.
//
// Test AYNAN production konfiguratsiyasini import qiladi (`dist/lib/upload-limits.js`) —
// nusxa/qattiq yozilgan qiymat EMAS — va uni HAQIQIY multer + express + HTTP so'rov bilan
// ishga tushiradi. DB/Prisma kerak emas.
//
// Nima isbotlanadi:
//   A) mahsulot imkoniyati SAQLANGAN (3GB pack, 512MB/160 sahna fayli, ko'p fayl, matn maydonlar),
//   B) GHSA-72gw-mp4g-v24j (chuqur nested maydon nomi DoS) YOPILGAN — va u faqat versiya
//      ko'tarilgani uchun emas, `fieldNestingDepth` berilgani uchun yopilgan (kontrol holat),
//   C) parts/fields/fileSize/files chegaralari to'g'ri kod bilan rad etadi,
//   D) diskStorage'да xato bo'lganда yozilgan qism fayllar TOZALANADI (GHSA-3p4h-7m6x-2hcm).
//
// Ishga tushirish: npm run build -w apps/api && node apps/api/scripts/test-upload-limits.mjs

import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import multer from "multer";
import {
  AVATAR_UPLOAD_LIMITS,
  GEN_REF_UPLOAD_LIMITS,
  TEMPLATE_ASSET_UPLOAD_LIMITS,
  SCENE_PREVIEW_UPLOAD_LIMITS,
  MAX_REF_UPLOAD_BYTES,
  MAX_FIELD_NESTING_DEPTH,
} from "../dist/lib/upload-limits.js";

let fail = 0;
function check(ok, label, detail) {
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}`);
  if (!ok && detail) console.log(`         ${detail}`);
}

const MB = 1024 * 1024;

// ---------------------------------------------------------------------------------------
// 1) Deklarativ tekshiruv — mahsulot imkoniyati PASAYTIRILMAGAN + himoya YOQILGAN
// ---------------------------------------------------------------------------------------
console.log("\n  A) Cheklov qiymatlari (imkoniyat saqlangan + himoya yoqilgan)\n");

check(TEMPLATE_ASSET_UPLOAD_LIMITS.fileSize === 3300 * MB, "contributor assets: fileSize 3300MB (3GB UI limiti) o'zgarmagan");
check(TEMPLATE_ASSET_UPLOAD_LIMITS.files === 3, "contributor assets: files = 3 (thumb+preview+pack)");
check(SCENE_PREVIEW_UPLOAD_LIMITS.fileSize === 512 * MB, "scene previews: fileSize 512MB o'zgarmagan");
check(SCENE_PREVIEW_UPLOAD_LIMITS.files === 160, "scene previews: files = 160 o'zgarmagan");
check(AVATAR_UPLOAD_LIMITS.fileSize === 5 * MB, "avatar: fileSize 5MB o'zgarmagan");
check(GEN_REF_UPLOAD_LIMITS.fileSize === MAX_REF_UPLOAD_BYTES && MAX_REF_UPLOAD_BYTES === 100 * MB, "gen ref: fileSize 100MB o'zgarmagan");

const ALL = {
  AVATAR_UPLOAD_LIMITS,
  GEN_REF_UPLOAD_LIMITS,
  TEMPLATE_ASSET_UPLOAD_LIMITS,
  SCENE_PREVIEW_UPLOAD_LIMITS,
};
for (const [name, lim] of Object.entries(ALL)) {
  check(lim.fieldNestingDepth === MAX_FIELD_NESTING_DEPTH && Number.isFinite(lim.fieldNestingDepth),
    `${name}: fieldNestingDepth = ${MAX_FIELD_NESTING_DEPTH} (GHSA-72gw-mp4g-v24j opt-in himoya YOQILGAN)`);
  check(Number.isFinite(lim.fields), `${name}: fields chekli (${lim.fields}) — busboy default Infinity emas`);
  check(Number.isFinite(lim.parts), `${name}: parts chekli (${lim.parts}) — busboy default Infinity emas`);
  check(Number.isFinite(lim.files), `${name}: files chekli (${lim.files})`);
  check(lim.parts >= lim.files + lim.fields, `${name}: parts (${lim.parts}) ≥ files+fields (${lim.files}+${lim.fields}) — qonuniy so'rov bo'g'ilmaydi`);
}

// ---------------------------------------------------------------------------------------
// Test serveri — har marshrutда HAQIQIY konfiguratsiya
// ---------------------------------------------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ff-upload-test-"));
const app = express();

/** Multer xatosini test uchun JSON'ga aylantiruvchi wrapper (production error-handler naqshi). */
function mount(route, mw) {
  app.post(route, (req, res) => {
    mw(req, res, (err) => {
      if (err) {
        res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
          ok: false,
          code: err.code || err.name || "ERR",
          field: err.field || null,
        });
        return;
      }
      const files = req.files
        ? Array.isArray(req.files)
          ? req.files
          : Object.values(req.files).flat()
        : req.file
          ? [req.file]
          : [];
      res.json({
        ok: true,
        fileCount: files.length,
        fileNames: files.map((f) => f.fieldname),
        bodyKeys: Object.keys(req.body || {}),
        // Nested nom qabul qilinsa qanday obyekt yasalganini ko'rish uchun (kontrol holat).
        bodyDepth: maxDepth(req.body),
      });
    });
  });
}

function maxDepth(o, d = 0) {
  if (!o || typeof o !== "object" || d > 50) return d;
  let m = d;
  for (const v of Object.values(o)) m = Math.max(m, maxDepth(v, d + 1));
  return m;
}

const memory = multer.memoryStorage();
mount("/avatar", multer({ storage: memory, limits: AVATAR_UPLOAD_LIMITS }).single("avatar"));
mount("/ref", multer({ storage: memory, limits: GEN_REF_UPLOAD_LIMITS }).single("file"));
mount("/assets", multer({ storage: memory, limits: TEMPLATE_ASSET_UPLOAD_LIMITS }).fields([
  { name: "thumb", maxCount: 1 },
  { name: "preview", maxCount: 1 },
  { name: "pack", maxCount: 1 },
]));
mount("/scenes", multer({ storage: memory, limits: SCENE_PREVIEW_UPLOAD_LIMITS }).any());

// KONTROL — bir xil multer 2.2.0, lekin `fieldNestingDepth` BERILMAGAN (advisory aytgan holat).
mount("/control-no-nesting-limit", multer({
  storage: memory,
  limits: { fileSize: 5 * MB, files: 1, fields: 4, parts: 6 },
}).single("avatar"));

// diskStorage — xatoda tozalash (GHSA-3p4h-7m6x-2hcm) tekshiruvi uchun
const diskDir = path.join(TMP, "disk");
fs.mkdirSync(diskDir, { recursive: true });
mount("/disk", multer({
  storage: multer.diskStorage({
    destination: (_req, _f, cb) => cb(null, diskDir),
    filename: (_req, f, cb) => cb(null, `${f.fieldname}.bin`),
  }),
  limits: { ...TEMPLATE_ASSET_UPLOAD_LIMITS, fileSize: 64 * 1024 },
}).fields([
  { name: "thumb", maxCount: 1 },
  { name: "pack", maxCount: 1 },
]));

const server = http.createServer(app);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

async function post(route, form) {
  const res = await fetch(`${BASE}${route}`, { method: "POST", body: form });
  return { status: res.status, body: await res.json() };
}
const blob = (bytes, type = "application/octet-stream") =>
  new Blob([new Uint8Array(bytes)], { type });

// ---------------------------------------------------------------------------------------
// B) Qonuniy ish oqimlari — REGRESS BO'LMASLIGI SHART
// ---------------------------------------------------------------------------------------
console.log("\n  B) Qonuniy yuklashlar (regress yo'q)\n");

{
  const fd = new FormData();
  fd.append("avatar", blob(1024, "image/png"), "a.png");
  const r = await post("/avatar", fd);
  check(r.status === 200 && r.body.ok && r.body.fileCount === 1, "avatar: bitta rasm qabul qilindi", JSON.stringify(r));
}
{
  // gen ref — 1 fayl + haqiqiy matn maydonlari (klient aynan shularni yuboradi)
  const fd = new FormData();
  fd.append("file", blob(2048, "image/png"), "ref.png");
  fd.append("clipMode", "part");
  fd.append("clipStartSec", "1.5");
  fd.append("clipEndSec", "3.5");
  fd.append("extractAudioRef", "1");
  const r = await post("/ref", fd);
  check(
    r.status === 200 && r.body.fileCount === 1 && r.body.bodyKeys.length === 4,
    "gen ref: fayl + 4 matn maydoni qabul qilindi",
    JSON.stringify(r)
  );
}
{
  const fd = new FormData();
  fd.append("thumb", blob(512, "image/png"), "thumb.png");
  fd.append("preview", blob(1024, "video/mp4"), "preview.mp4");
  fd.append("pack", blob(4096, "application/zip"), "pack.zip");
  const r = await post("/assets", fd);
  check(r.status === 200 && r.body.fileCount === 3, "contributor assets: thumb+preview+pack qabul qilindi", JSON.stringify(r));
}
{
  // 160 sahna fayli — ENG KATTA qonuniy oqim, hali ham o'tishi SHART
  const fd = new FormData();
  for (let i = 0; i < 160; i++) fd.append(`scene-${i}`, blob(64, "image/png"), `scene-${i}.png`);
  const r = await post("/scenes", fd);
  check(r.status === 200 && r.body.fileCount === 160, "scene previews: 160 fayl qabul qilindi (ish oqimi buzilmagan)", JSON.stringify(r).slice(0, 200));
}

// ---------------------------------------------------------------------------------------
// C) Hujum holatlari — RAD ETILISHI SHART
// ---------------------------------------------------------------------------------------
console.log("\n  C) Hujum holatlari (rad etiladi)\n");

// Chuqur nested maydon nomi. Bitta part header'i busboy'da 16KB bilan chegaralangan, shuning
// uchun 3000 daraja (~9KB) — real hujum shakli (hujumchi buni KO'P part bilan takrorlaydi).
const DEEP = 3000;
const deepName = "x" + "[a]".repeat(DEEP);

{
  const fd = new FormData();
  fd.append("avatar", blob(256, "image/png"), "a.png");
  fd.append(deepName, "1");
  const t0 = Date.now();
  const r = await post("/avatar", fd);
  const ms = Date.now() - t0;
  check(
    r.status === 400 && r.body.code === "LIMIT_FIELD_NESTING",
    `avatar: ${DEEP} darajali nested maydon nomi rad etildi (LIMIT_FIELD_NESTING, ${ms}ms)`,
    JSON.stringify(r)
  );
}
{
  // KONTROL — bir xil multer versiyasi, `fieldNestingDepth` YO'Q: rad etilmaydi va
  // append-field chuqur obyekt yasaydi ⇒ himoya versiyadan EMAS, konfiguratsiyadan keladi.
  const fd = new FormData();
  fd.append("avatar", blob(256, "image/png"), "a.png");
  fd.append(deepName, "1");
  const r = await post("/control-no-nesting-limit", fd);
  check(
    r.status === 200 && r.body.bodyDepth > 40,
    "kontrol: fieldNestingDepth'siz AYNI so'rov o'tib ketadi va chuqur obyekt yasaydi (opt-in ekani isbot)",
    JSON.stringify(r)
  );
}
{
  const fd = new FormData();
  for (let i = 0; i < 160; i++) fd.append(`scene-${i}`, blob(16, "image/png"), `s${i}.png`);
  fd.append(deepName, "1");
  const r = await post("/scenes", fd);
  check(r.status === 400 && r.body.code === "LIMIT_FIELD_NESTING", "scene previews: nested maydon nomi rad etildi", JSON.stringify(r).slice(0, 200));
}
{
  // parts limiti — 200 ta bo'sh matn maydon (avatar yo'lida parts = 6)
  const fd = new FormData();
  for (let i = 0; i < 200; i++) fd.append(`f${i}`, "v");
  const r = await post("/avatar", fd);
  check(
    r.status === 400 && (r.body.code === "LIMIT_PART_COUNT" || r.body.code === "LIMIT_FIELD_COUNT"),
    `avatar: 200 part rad etildi (${r.body.code})`,
    JSON.stringify(r)
  );
}
{
  // fields limiti — avatar yo'lida fields = 4
  const fd = new FormData();
  fd.append("avatar", blob(64, "image/png"), "a.png");
  for (let i = 0; i < 5; i++) fd.append(`t${i}`, "v");
  const r = await post("/avatar", fd);
  check(r.status === 400 && r.body.code === "LIMIT_FIELD_COUNT", "avatar: 5 matn maydoni (fields=4) rad etildi", JSON.stringify(r));
}
{
  // fileSize — 6MB > 5MB
  const fd = new FormData();
  fd.append("avatar", blob(6 * MB, "image/png"), "big.png");
  const r = await post("/avatar", fd);
  check(r.status === 413 && r.body.code === "LIMIT_FILE_SIZE", "avatar: 6MB fayl 413 LIMIT_FILE_SIZE bilan rad etildi", JSON.stringify(r));
}
{
  // files — 161 sahna fayli (files = 160)
  const fd = new FormData();
  for (let i = 0; i < 161; i++) fd.append(`scene-${i}`, blob(16, "image/png"), `s${i}.png`);
  const r = await post("/scenes", fd);
  check(r.status === 400 && r.body.code === "LIMIT_FILE_COUNT", "scene previews: 161-fayl rad etildi (LIMIT_FILE_COUNT)", JSON.stringify(r).slice(0, 200));
}

// ---------------------------------------------------------------------------------------
// D) diskStorage tozalash (GHSA-3p4h-7m6x-2hcm)
// ---------------------------------------------------------------------------------------
console.log("\n  D) diskStorage — xatoda qism fayllar tozalanadi\n");
{
  const fd = new FormData();
  fd.append("thumb", blob(1024, "image/png"), "thumb.png"); // OK — diskка yoziladi
  fd.append("pack", blob(256 * 1024, "application/zip"), "pack.zip"); // 64KB limitdan katta → xato
  const r = await post("/disk", fd);
  // Multer xatodan keyin async o'chiradi — bir tick kutamiz.
  await new Promise((res) => setTimeout(res, 300));
  const left = fs.readdirSync(diskDir);
  check(r.status === 413 && r.body.code === "LIMIT_FILE_SIZE", "disk: katta fayl rad etildi", JSON.stringify(r));
  check(left.length === 0, `disk: yarim yozilgan fayllar tozalandi (qoldiq: ${JSON.stringify(left)})`);
}

server.close();
fs.rmSync(TMP, { recursive: true, force: true });

console.log(
  fail === 0
    ? "\n  ✓ Barcha multipart cheklov testlari o'tdi\n"
    : `\n  ✗ ${fail} ta tekshiruv YIQILDI\n`
);
process.exit(fail === 0 ? 0 : 1);
