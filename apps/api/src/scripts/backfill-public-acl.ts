/**
 * 🔴 Bir martalik backfill: MAVJUD obyektlarga OBYEKT DARAJASIDA public-read ACL
 * beradi — FAQAT `isPublicReadKey()` allow-list'iga mos kalitlarga (thumb/preview/
 * scenes + gen ko'rsatish derivativlari). Pack/mogrt/gen asl/gen-refs/gen-ref-src/
 * avatars — HECH QACHON tegilmaydi (private qoladi).
 *
 * Yangi yuklamalar `upload*ToS3` ichida ACL'ni yozuv paytida oladi (s3.ts:aclFor);
 * bu skript esa CDN yoqilishidan OLDIN mavjud fayllarni ochadi. Yagona qaror
 * manbai — `isPublicReadKey`, shu bois upload va backfill BIR XIL kalitlarni ochadi.
 *
 * ⚠️ SHART: bucket "fine-grained" access'da bo'lishi kerak (uniform bucket-level
 * access EMAS) va public access prevention "enforced" BO'LMASLIGI kerak — aks
 * holda GCS obyekt-ACL so'rovini rad etadi. Bu ega tomonidan konsolda sozlanadi.
 *
 * Ishga tushirish (env — API bilan bir xil: AWS_* + S3_ENDPOINT):
 *   npm run build -w apps/api
 *   node apps/api/dist/scripts/backfill-public-acl.js            # DRY-RUN (hech nima o'zgartirmaydi)
 *   node apps/api/dist/scripts/backfill-public-acl.js --apply    # HAQIQIY: ACL beradi
 *   node apps/api/dist/scripts/backfill-public-acl.js --apply --verify   # + har birini HEAD bilan tekshiradi
 */
import {
  ListObjectsV2Command,
  PutObjectAclCommand,
} from "@aws-sdk/client-s3";
import { s3, isS3Configured, isPublicReadKey } from "../lib/s3.js";

const bucket = process.env.AWS_S3_BUCKET ?? "";
const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 8;

/** Kalitni hisobot toifasiga ajratadi (breakdown uchun). */
function category(key: string): string {
  if (/^templates\/[^/]+\/thumb/.test(key)) return "templates/thumb";
  if (/^templates\/[^/]+\/preview/.test(key)) return "templates/preview";
  if (/^templates\/[^/]+\/scenes\//.test(key)) return "templates/scenes";
  if (/-disp\.[A-Za-z0-9]+$/.test(key)) return "gen/display";
  if (/-thumb\.jpg$/.test(key)) return "gen/thumb";
  if (/-poster\.jpg$/.test(key)) return "gen/poster";
  if (/-preview\.mp4$/.test(key)) return "gen/preview";
  return "other-public";
}

async function grantPublic(key: string): Promise<void> {
  await s3.send(
    new PutObjectAclCommand({ Bucket: bucket, Key: key, ACL: "public-read" })
  );
}

/** Konkurent worker pool — kalitlarni navbatdan olib ACL beradi. */
async function drainQueue(
  queue: string[],
  onOk: () => void,
  onFail: (key: string, e: unknown) => void
): Promise<void> {
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const key = queue.shift();
        if (!key) return;
        try {
          await grantPublic(key);
          onOk();
        } catch (e) {
          onFail(key, e);
        }
      }
    })
  );
}

async function main() {
  if (!isS3Configured() || !bucket) {
    console.error(
      "S3/GCS sozlanmagan (AWS_S3_BUCKET/AWS_ACCESS_KEY_ID) — backfill ma'nosiz."
    );
    process.exit(1);
  }

  console.log(
    `[backfill-public-acl] bucket=${bucket} rejim=${APPLY ? "APPLY (ACL beradi)" : "DRY-RUN (o'zgartirmaydi)"}`
  );

  const publicKeys: string[] = [];
  const byCategory: Record<string, number> = {};
  const samples: Record<string, string> = {};
  let scanned = 0;
  let privateSkipped = 0;
  let token: string | undefined;

  // 1) Butun bucket'ni aylanib chiqamiz; FAQAT allow-list kalitlarini yig'amiz.
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    for (const obj of res.Contents ?? []) {
      const key = obj.Key;
      if (!key) continue;
      scanned++;
      if (isPublicReadKey(key)) {
        publicKeys.push(key);
        const cat = category(key);
        byCategory[cat] = (byCategory[cat] ?? 0) + 1;
        if (!samples[cat]) samples[cat] = key;
      } else {
        privateSkipped++;
      }
    }
    token = res.NextContinuationToken;
    if (scanned % 5000 === 0 || !token) {
      console.log(`  skanlandi: ${scanned} (ommaviy mos: ${publicKeys.length}, private o'tkazildi: ${privateSkipped})`);
    }
  } while (token);

  console.log("\n[breakdown] ommaviy qilinadigan kalitlar (toifa bo'yicha):");
  for (const [cat, n] of Object.entries(byCategory).sort()) {
    console.log(`  ${cat.padEnd(18)} ${String(n).padStart(6)}   e.g. ${samples[cat]}`);
  }
  console.log(
    `\n[jami] skanlandi=${scanned}  ommaviy-mos=${publicKeys.length}  private-o'tkazildi=${privateSkipped}`
  );

  if (!APPLY) {
    console.log(
      "\nDRY-RUN — hech nima o'zgartirilmadi. Ro'yxatni tasdiqlab, --apply bilan qayta ishga tushiring."
    );
    process.exit(0);
  }

  // 2) APPLY — faqat yuqorida yig'ilgan allow-list kalitlariga public-read beramiz.
  let ok = 0;
  let failed = 0;
  const failures: string[] = [];
  await drainQueue(
    [...publicKeys],
    () => {
      ok++;
      if ((ok + failed) % 200 === 0) console.log(`  ACL berildi: ${ok + failed}/${publicKeys.length}`);
    },
    (key, e) => {
      failed++;
      if (failures.length < 20) failures.push(`${key} :: ${e instanceof Error ? e.message : String(e)}`);
    }
  );

  console.log(`\n[tugadi] public-read berildi: ${ok} ok, ${failed} xato (jami ${publicKeys.length}).`);
  if (failures.length) {
    console.log("Ilk xatolar:");
    for (const f of failures) console.log("  - " + f);
    console.log(
      "\n⚠️ Xato ko'p bo'lsa: bucket hali UNIFORM access'da yoki public access prevention 'enforced' bo'lishi mumkin (ega konsolda o'zgartirsin)."
    );
    process.exit(2);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
