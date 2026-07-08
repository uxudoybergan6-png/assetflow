import { TemplateReviewStatus } from "@creative-tools/database";
import {
  publicAssetUrl,
  findScenePreview,
  findSceneVideo,
  publicSceneUrl,
  publicMogrtUrl,
  sceneFileIsVideo,
  SCENE_IMAGE_EXTS,
  SCENE_VIDEO_EXTS,
} from "./template-files.js";
import {
  isS3Configured,
  s3ObjectExists,
  templateAssetFlags,
  listTemplateS3Keys,
  s3AssetKeyFromSet,
  getPublicOrSignedUrl,
} from "./s3.js";
import { assetKeySetFromStored, syncTemplateAssetKeys } from "./asset-state.js";

// Thumb/preview/sahna ko'rsatish URL muddati. CDN_BASE_URL bo'lsa public URL
// (muddatsiz), aks holda (GCS private bucket) signed URL — plain public GCS URL
// 403 qaytarardi (bucket public-read emas) → katalogda qora kartalar (#1).
const DISPLAY_URL_TTL = 86400; // 24 soat

/**
 * Sahna fayli uchun mavjud R2 kalitini topadi (ext bo'yicha). knownS3Keys
 * berilsa tarmoqsiz (List natijasidan), aks holda HeadObject bilan. Topilsa —
 * to'g'ridan CDN public URL qurish mumkin (Render orqali stream EMAS).
 */
async function resolveSceneS3Key(
  templateId: string,
  key: string,
  exts: string[],
  knownS3Keys?: Set<string>
): Promise<string | null> {
  const base = `templates/${templateId}/scenes/${key}`;
  const candidates = [base, ...exts.map((e) => base + e)];
  for (const c of candidates) {
    const hit = knownS3Keys ? knownS3Keys.has(c) : await s3ObjectExists(c);
    if (hit) return c;
  }
  return null;
}

/**
 * CDN public URL'iga cache-bust query qo'shadi (?v=<epoch>). Kalit (R2 key)
 * versiyalanmagani uchun (templates/{id}/thumb.jpg), contributor assetni qayta
 * yuklaganda CDN/brauzer keshi eskini ko'rsatadi. updatedAt epoch query'si URL'ni
 * har yangilanishda o'zgartiradi → yangi versiya olinadi. Faqat ochiq CDN
 * (getPublicUrl) natijalariga qo'llanadi; pack signed-URL oqimiga ALOQASI YO'Q. */
function withCacheBust(url: string | null, version: number | string): string | null {
  if (!url) return url;
  if (url.includes("?")) return url; // signed yoki query'li URL'larga tegmaymiz
  return `${url}?v=${version}`;
}

/** R2/S3: sahna preview URL — disk + object storage.
 *  knownS3Keys berilsa HeadObject chaqirilmaydi (N+1 oldini olish). */
async function enrichScenesAsync(
  meta: Record<string, unknown>,
  templateId: string,
  apiBase: string,
  cacheBust: number | string,
  knownS3Keys?: Set<string>
) {
  const scenes = meta.scenes;
  if (!Array.isArray(scenes)) return meta;
  const mapped = await Promise.all(
    scenes.map(async (raw) => {
      if (!raw || typeof raw !== "object") return raw;
      const s = { ...(raw as Record<string, unknown>) };
      // M2: mogrtKey bo'lsa — sahnani yakka .mogrt sifatida yuklab olish URL'i
      if (typeof s.mogrtKey === "string" && s.mogrtKey) {
        s.mogrtUrl = publicMogrtUrl(apiBase, templateId, s.mogrtKey);
      }
      const key =
        (typeof s.previewKey === "string" && s.previewKey) ||
        (typeof s.aeComp === "string" && s.aeComp) ||
        (typeof s.n === "string" && s.n) ||
        "";
      if (!key) return s;

      const useS3 = isS3Configured();
      // Bulut sozlangan bo'lsa diskni umuman tekshirmaymiz — serve-asset
      // endi S3'da topilmagan sahna faylini diskdan bermaydi, shu bois
      // disk-only mavjudlik bu yerda ham e'tiborga olinmasligi kerak.

      // Video preview: lokal disk (S3 sozlanmagan dev) yoki R2/GCS.
      const videoFile = useS3 ? null : findSceneVideo(templateId, key);
      const videoS3 = useS3
        ? await resolveSceneS3Key(templateId, key, SCENE_VIDEO_EXTS, knownS3Keys)
        : null;
      if (videoFile || videoS3) {
        // R2 bo'lsa TO'G'RIDAN CDN public URL — Render orqali stream EMAS
        // (bandwidth = 0). Faqat lokal disk bo'lsa API endpoint (stream).
        s.preview = videoS3
          ? withCacheBust(await getPublicOrSignedUrl(videoS3, DISPLAY_URL_TTL), cacheBust)
          : publicSceneUrl(apiBase, templateId, key);
        // Poster thumb (rasm) — mavjud bo'lsa
        const thumbS3 = useS3
          ? await resolveSceneS3Key(
              templateId,
              key + "_thumb",
              SCENE_IMAGE_EXTS,
              knownS3Keys
            )
          : null;
        const imgFile = useS3 ? null : findScenePreview(templateId, key);
        if (thumbS3) {
          s.thumb = withCacheBust(await getPublicOrSignedUrl(thumbS3, DISPLAY_URL_TTL), cacheBust);
        } else if (imgFile && !sceneFileIsVideo(imgFile)) {
          s.thumb = publicSceneUrl(apiBase, templateId, key + "_thumb");
        }
      } else {
        // Rasm preview
        const previewFile = useS3 ? null : findScenePreview(templateId, key);
        const imgS3 = useS3
          ? await resolveSceneS3Key(templateId, key, SCENE_IMAGE_EXTS, knownS3Keys)
          : null;
        if (imgS3) {
          s.preview = withCacheBust(await getPublicOrSignedUrl(imgS3, DISPLAY_URL_TTL), cacheBust); // to'g'ridan CDN yoki signed
          s.previewKind = "image";
        } else if (previewFile) {
          s.preview = publicSceneUrl(apiBase, templateId, key);
          s.previewKind = "image";
        }
      }
      return s;
    })
  );
  return { ...meta, scenes: mapped };
}

type TemplateRow = {
  id: string;
  externalId: string | null;
  name: string;
  description: string;
  nav: string;
  cat: string;
  catLabel: string;
  orient: string;
  res: string;
  tags: string[];
  icon: string;
  bg: string;
  templateApp: string;
  metaJson: unknown;
  fileName: string | null;
  fileSize: number | null;
  isPro: boolean;
  contributor: { name: string | null; email: string } | null;
  createdAt: Date;
  updatedAt: Date;
  // FAZA 5 (A2) — S3 kalitlar keshi (string[] | null). Berilsa listing S3'siz.
  assetKeysJson?: unknown;
};

/** Contributor display name + bosh harflar (karta avatar uchun). Ism yo'q bo'lsa
 *  email lokal qismidan. Hech qanday maxfiy ma'lumot chiqarilmaydi — faqat
 *  ko'rsatish nomi va initsiallar (email to'liq qaytarilmaydi). */
function contributorAuthor(
  c: { name: string | null; email: string } | null
): { author: string | null; authorInitials: string } {
  if (!c) return { author: null, authorInitials: "" };
  const display = (c.name && c.name.trim()) || c.email.split("@")[0] || "";
  const parts = display.trim().split(/\s+/).filter(Boolean);
  const initials = (
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0] || "").slice(0, 2)
  ).toUpperCase();
  return { author: display || null, authorInitials: initials };
}

export async function mapCatalogItem(t: TemplateRow, apiBase: string) {
  const rawMeta = (t.metaJson ?? {}) as Record<string, unknown>;
  const { author, authorInitials } = contributorAuthor(t.contributor);
  // FAZA 5 (A2): kalitlar avval DB keshidan (assetKeysJson — mutatsiya paytida
  // yoziladi) — listing S3'ga UMUMAN chiqmaydi. Kesh hali yo'q bo'lsa (eski
  // yozuv) bir marta live List + DB'ga saqlab o'zini to'ldiradi (lazy backfill);
  // sync yiqilsa ham live List bilan davom etadi.
  const storedKeys = assetKeySetFromStored(t.assetKeysJson);
  const s3Keys =
    storedKeys ??
    (await syncTemplateAssetKeys(t.id)) ??
    (await listTemplateS3Keys(t.id));
  // Cache-bust versiyasi: shablon oxirgi yangilangan vaqt (epoch ms). R2 kalitlari
  // versiyalanmagani uchun CDN public URL'lariga ?v=<epoch> qo'shamiz — assetni
  // qayta yuklaganda eski kesh ko'rinmasin.
  const cacheBust = t.updatedAt.getTime();
  const meta = await enrichScenesAsync(rawMeta, t.id, apiBase, cacheBust, s3Keys);
  const assets = await templateAssetFlags(t.id, s3Keys, {
    confirmPack: !storedKeys, // DB keshi authoritative — HeadObject re-tasdiq shart emas
  });
  const hasThumb = assets.thumb;
  const hasPreview = assets.preview;
  const hasPack = assets.pack;

  // Thumb/preview — ochiq assetlar. R2'da bo'lsa TO'G'RIDAN CDN public URL
  // qaytaramiz, shunda brauzer Cloudflare'dan oladi va Render bandwidth = 0
  // (avval har bir asset Render API → 302 redirect orqali o'tardi). Faqat
  // lokal disk (dev, R2 yo'q) holatida API endpoint orqali stream qilinadi.
  const useS3 = isS3Configured();
  const thumbS3 = useS3 ? s3AssetKeyFromSet(t.id, "thumb", s3Keys) : null;
  const previewS3 = useS3 ? s3AssetKeyFromSet(t.id, "preview", s3Keys) : null;
  // Raw .aep pack — serve-asset.ts uni yuklab olishda .zipga o'raydi (§9),
  // shu bois klient (ayniqsa AE plagin — fileName kengaytmasidan lokal keshni
  // nomlaydi) ham .zip kutishi kerak, aks holda zip baytlari .aep deb saqlanadi.
  const packS3Key = useS3 ? s3AssetKeyFromSet(t.id, "pack", s3Keys) : null;
  const packIsRawAep = !!packS3Key && /\.aep$/i.test(packS3Key);
  const thumbUrl = thumbS3
    ? withCacheBust(await getPublicOrSignedUrl(thumbS3, DISPLAY_URL_TTL), cacheBust)
    : hasThumb
      ? publicAssetUrl(apiBase, t.id, "thumb")
      : null;
  const previewUrl = previewS3
    ? withCacheBust(await getPublicOrSignedUrl(previewS3, DISPLAY_URL_TTL), cacheBust)
    : hasPreview
      ? publicAssetUrl(apiBase, t.id, "preview")
      : null;

  // Pack URL — DOIM API endpoint orqali (to'g'ridan R2 public URL EMAS).
  // Shu sabab pack yuklab olish auth + published + Free/Pro limit gate'idan
  // o'tadi; route esa qisqa muddatli signed R2 URL'ga redirect qiladi.
  const packUrl: string | null = hasPack
    ? publicAssetUrl(apiBase, t.id, "pack")
    : null;

  return {
    id: t.id,
    externalId: t.externalId,
    name: t.name,
    description: t.description,
    nav: t.nav,
    cat: t.cat,
    catLabel: t.catLabel,
    orient: t.orient,
    res: t.res,
    tags: t.tags,
    icon: t.icon,
    bg: t.bg || "linear-gradient(135deg,#312e81,#6366f1)",
    templateApp: t.templateApp,
    fileName: hasPack
      ? packIsRawAep
        ? (t.fileName || "template.aep").replace(/\.aep$/i, ".zip")
        : t.fileName
      : null,
    fileSize: hasPack ? t.fileSize : null,
    hasThumb,
    hasPreview,
    hasPack,
    thumbUrl,
    previewUrl,
    packUrl,
    metaJson: meta,
    // AE redesign uchun additive maydonlar (mavjud kontrakt o'zgarmaydi):
    author,            // contributor display name (yo'q bo'lsa null)
    authorInitials,    // avatar bosh harflar ("Dilnoza K." → "DK")
    isPro: t.isPro,    // per-shablon tier (false = FREE)
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export const approvedCatalogWhere = {
  reviewStatus: TemplateReviewStatus.APPROVED,
  published: true,
  takedownAt: null, // DMCA/takedown belgilangan shablonlar katalogda ko'rinmaydi (Bosqich 2 #2)
};
