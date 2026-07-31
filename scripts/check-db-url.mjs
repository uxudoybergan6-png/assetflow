#!/usr/bin/env node
/**
 * DB ulanish satrini deploy'dan OLDIN tekshiradi (parolni HECH QACHON chop etmasdan).
 *
 * NEGA: Cloud SQL'ga ko'chishda `CLOUDRUN_ENV_YAML` sirida yangi parol paydo bo'ldi va
 * unda URL uchun maxsus belgi (`#` yoki `?`) foiz-kodlanmagan edi. URL grammatikasida
 * bunday belgi authority'ni TUGATADI: `postgres://user:pa#ss@host/db` → xost `user`,
 * port `pa` → Prisma `P1013: invalid port number` deydi. Bu xato parolni ko'rsatmaydi,
 * shuning uchun sababini topish uzoq davom etadi — va u FAQAT migratsiyani emas, jonli
 * Cloud Run konteynerini ham yiqitadi (app o'sha env'dan o'qiydi).
 *
 * Shu sabab tekshiruv deploy oqimining boshida turadi va sababni ANIQ aytadi.
 *
 * Foydalanish:  node scripts/check-db-url.mjs "<url>" [nom]
 * Exit: 0 = joyida, 1 = noto'g'ri (sabab stderr'da, qiymatsiz).
 */
const raw = process.argv[2] ?? "";
const label = process.argv[3] || "DATABASE_URL";

function fail(msg, hint) {
  console.error(`::error::${label}: ${msg}`);
  if (hint) console.error(`         ${hint}`);
  process.exit(1);
}

if (!raw) fail("qiymat bo'sh yoki topilmadi.");
if (!/^postgres(ql)?:\/\//.test(raw)) {
  fail("`postgresql://` bilan boshlanmaydi (qo'shtirnoq yoki bo'shliq qolgan bo'lishi mumkin).");
}

// Faqat userinfo (`://` va authority'ni tugatuvchi birinchi belgi orasi) tekshiriladi —
// buyerdagi kodlanmagan belgi butun URL'ning ma'nosini o'zgartiradi.
const afterScheme = raw.slice(raw.indexOf("://") + 3);
const at = afterScheme.lastIndexOf("@");
const userinfo = at === -1 ? "" : afterScheme.slice(0, at);
const BAD = { "#": "%23", "?": "%3F", "/": "%2F", "@": "%40", ":": "%3A (parol ichida)" };
const found = Object.keys(BAD).filter((c) => userinfo.includes(c) && c !== ":");

let url;
try {
  url = new URL(raw);
} catch {
  fail(
    "URL sifatida o'qib bo'lmadi (Prisma ham P1013 qaytaradi).",
    found.length
      ? `Sabab: foydalanuvchi/parol qismida kodlanmagan belgi bor → ${found
          .map((c) => `${c} → ${BAD[c]}`)
          .join(", ")}. Parolni foiz-kodlang (yoki parolni faqat harf/raqamga almashtiring).`
      : "Sirdagi qiymatni tekshiring: ortiqcha qo'shtirnoq, bo'shliq yoki qator uzilishi."
  );
}

if (!url.hostname) fail("xost bo'sh (`@` dan keyin xost yozilmagan).");
if (!url.pathname || url.pathname === "/") fail("baza nomi yo'q (`/frameflow` kabi yo'l kutiladi).");

// Cloud SQL Unix socket shakli: …@localhost/<db>?host=/cloudsql/<INSTANCE>
const sock = url.searchParams.get("host");
const shape = sock ? `unix socket (${sock})` : `TCP (${url.hostname}${url.port ? ":" + url.port : ""})`;
if (found.length) {
  console.log(
    `⚠️  ${label}: parol qismida kodlanmagan belgi bor (${found.join(", ")}) — hozircha o'qildi, lekin kodlang.`
  );
}
console.log(`✓ ${label} joyida — ${shape}, baza: ${url.pathname.slice(1)}`);
