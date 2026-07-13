import path from "path";
import { prisma, TemplateReviewStatus } from "@creative-tools/database";
import {
  copyS3Object,
  downloadS3ToBuffer,
  uploadBufferToS3,
  getS3ObjectMeta,
  getPublicOrSignedUrl,
  deleteTemplateAssets,
  isS3Configured,
} from "./s3.js";
import { syncTemplateAssetKeys } from "./asset-state.js";
import { generateStockWatermarkedDerivatives } from "./stock-derivatives.js";
import { generateAssetMetadata } from "./ai/asset-metadata.js";
import { moderateContent, moderateOutputsEnabled } from "./moderation.js";

/**
 * P3 (step 34) — "Add to Explore": foydalanuvchi GENERATSIYASINI ommaviy AI Stock
 * asetiga aylantiradi (Generation → ContributorTemplate, design (a)).
 *
 * ⚠️ Pul-zonasi (kredit/quote/refund) TEGILMAYDI — bu faqat yetkazish + katalog.
 * ⚠️ Fayl NUSXALANADI (havola EMAS): gen retention/o'chirish katalog asetini 404
 *    qilib qo'ymasin. Toza asl → private `pack`; suv belgili preview/thumb → public
 *    (generateStockWatermarkedDerivatives — stock quvurining AYNI o'zi).
 * ⚠️ Idempotent: externalId = "gen:<jobId>" (@@unique[contributorId, externalId]) →
 *    bir generatsiya = bir topshiriq.
 *
 * Owner qarori (2026-07-13): AI Stock aseti Free (isPro=false) — admin moderatsiyada
 * har asetni Pro qilishi mumkin (mavjud bulk Free/Pro). Payout YO'Q (earnings yaratilmaydi).
 */

// ⚠️ contributor.ts:181 RIGHTS_TERMS_VERSION bilan SINXRON tut (legal attestatsiya versiyasi).
export const RIGHTS_TERMS_VERSION = "2026-07-08";

// Kunlik topshiriq chegarasi (takror-spam oldini oladi). Admin ozod.
const EXPLORE_DAILY_CAP = Math.max(1, Number(process.env.EXPLORE_DAILY_CAP) || 20);

export class ExploreError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// gen.mode → { mediaClass (metadata vision), stockType (derivativ sinfi + sub-filtr) }.
// stockType RECOGNIZED qiymatlar (derivativeKindForStockType) — noma'lum stockType
// derivativ quvurini buzardi. Web AI Stock "Image|Video" sub-filtri shu stockType'ga tayanadi.
function classifyMode(mode: string): {
  mediaClass: "image" | "video" | "audio";
  stockType: string;
} {
  switch (String(mode)) {
    case "image":
      return { mediaClass: "image", stockType: "graphics" };
    case "video":
      return { mediaClass: "video", stockType: "motion-graphics" };
    case "sfx":
      return { mediaClass: "audio", stockType: "sfx" };
    default: // voice | music
      return { mediaClass: "audio", stockType: "music" };
  }
}

function orientFromDims(w?: number | null, h?: number | null): string {
  if (!w || !h) return "horizontal";
  return w > h ? "horizontal" : w < h ? "vertical" : "square";
}
function resFromDims(w?: number | null, h?: number | null): string {
  const m = Math.max(w || 0, h || 0);
  if (m >= 2000) return "4k";
  if (m >= 1080) return "1080p";
  if (m >= 720) return "720p";
  return "hd";
}

export type ExploreSubmitOpts = {
  userId: string;
  jobId: string;
  isAdmin: boolean;
  rightsAccepted?: boolean;
  rightsTermsVersion?: string | null;
  promptPublic?: boolean;
};

export async function submitGenerationToExplore(opts: ExploreSubmitOpts): Promise<{
  id: string;
  reviewStatus: string;
  alreadySubmitted: boolean;
}> {
  if (!isS3Configured()) {
    throw new ExploreError("STORAGE_UNAVAILABLE", 503, "Storage is not configured");
  }

  // 1) Generatsiya — egasi + tugagan + asetli.
  const gen = await prisma.generation.findUnique({
    where: { id: opts.jobId },
    include: { assets: true },
  });
  if (!gen || gen.userId !== opts.userId) {
    throw new ExploreError("GEN_NOT_FOUND", 404, "Generation not found");
  }
  if (gen.status !== "done") {
    throw new ExploreError("GEN_NOT_READY", 400, "This generation is not finished yet");
  }
  const asset = gen.assets.find((a) => a.resultKey);
  if (!asset || !asset.resultKey) {
    throw new ExploreError("NO_ASSET", 400, "This generation has no downloadable asset");
  }

  // 2) HUQUQ attestatsiyasi (foydalanuvchi o'z generatsiyasini OMMAGA ochyapti) — SHART.
  if (!opts.rightsAccepted) {
    throw new ExploreError(
      "RIGHTS_REQUIRED",
      400,
      "You must confirm you own the rights to publish this generation"
    );
  }
  const rights = {
    rightsAcceptedAt: new Date(),
    rightsTermsVersion: (opts.rightsTermsVersion || RIGHTS_TERMS_VERSION).slice(0, 40),
  };

  // 3) Idempotentlik — bir generatsiya bir topshiriq (externalId = gen:<jobId>).
  const externalId = `gen:${opts.jobId}`;
  const existing = await prisma.contributorTemplate.findFirst({
    where: { contributorId: opts.userId, externalId },
    select: { id: true, reviewStatus: true },
  });
  if (existing) {
    return { id: existing.id, reviewStatus: existing.reviewStatus, alreadySubmitted: true };
  }

  // 4) Kunlik chegara — bugun yuborilgan AI Stock topshiriqlarini SANAYDI (idempotent-xavfsiz;
  //    qayta yuborish sanalmaydi, chunki yuqorida qaytariladi). Admin ozod.
  if (!opts.isAdmin) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const todayCount = await prisma.contributorTemplate.count({
      where: {
        contributorId: opts.userId,
        templateType: "ai-stock",
        createdAt: { gte: startOfDay },
      },
    });
    if (todayCount >= EXPLORE_DAILY_CAP) {
      throw new ExploreError(
        "DAILY_CAP",
        429,
        `Daily submission limit reached (${EXPLORE_DAILY_CAP}/day). Try again tomorrow.`
      );
    }
  }

  const { mediaClass, stockType } = classifyMode(gen.mode);

  // 5) MODERATSIYA (ochiq foydalanuvchi kontenti — NSFW/IP xavfi). Prompt (matn) + rasm.
  //    Bloklansa → topshiriq rad etiladi (navbatga TUSHMAYDI). Yumshoq flag → admin ko'radi.
  if (moderateOutputsEnabled()) {
    const imgUrls: string[] = [];
    const imgKey =
      mediaClass === "image"
        ? asset.resultKey || asset.displayKey
        : asset.thumbKey || asset.displayKey;
    if (imgKey) {
      try {
        imgUrls.push(await getPublicOrSignedUrl(imgKey, 3600));
      } catch {
        /* imzo xatosi — matn moderatsiyasi baribir ishlaydi */
      }
    }
    const verdict = await moderateContent({ text: gen.prompt || "", imageUrls: imgUrls });
    if (verdict.blocked) {
      throw new ExploreError(
        "MODERATION_BLOCKED",
        422,
        verdict.reason || "This content can't be published (moderation)"
      );
    }
  }

  // 6) AI METADATA (prompt = eng yaxshi manba). typeKey="ai-stock" → AI Stock kategoriyalari
  //    (lib/taxonomy.ts). INTERNAL — kredit ISHLATMAYDI. Hech qachon throw QILMAYDI.
  const meta = await generateAssetMetadata({
    typeKey: "ai-stock",
    mediaClass,
    displayName: gen.prompt || "AI generation",
    imagePaths: [],
    contributorId: opts.userId,
    isAdmin: opts.isAdmin,
  });

  const ext = (path.extname(asset.resultKey) || "").toLowerCase() || (mediaClass === "image" ? ".png" : mediaClass === "video" ? ".mp4" : ".mp3");
  const orient = orientFromDims(asset.width, asset.height);
  const res = resFromDims(asset.width, asset.height);

  // 7) ContributorTemplate — PENDING_REVIEW (mavjud moderatsiya/bulk-approve/katalog SHU HOLDA
  //    ishlaydi). packScanStatus="clean" (yuklangan pack yo'q → quarantine gate bloklamasin).
  let template;
  try {
    template = await prisma.contributorTemplate.create({
      data: {
        contributorId: opts.userId,
        externalId,
        name: meta.title,
        description: meta.description,
        nav: "video",
        cat: meta.cat,
        catLabel: meta.catLabel,
        orient,
        res,
        tags: meta.tags,
        templateApp: "ae",
        kind: "stock",
        templateType: "ai-stock",
        stockType,
        width: asset.width ?? null,
        height: asset.height ?? null,
        // Admin navbati PROMPTni ko'rsin + AI belgisi (metaJson — migratsiyasiz).
        metaJson: {
          aiSource: "ai",
          sourceGenerationId: opts.jobId,
          sourceGenAssetId: asset.id,
          prompt: (gen.prompt || "").slice(0, 4000),
          promptPublic: !!opts.promptPublic,
          modelId: gen.modelId,
          mode: gen.mode,
        },
        reviewStatus: TemplateReviewStatus.PENDING_REVIEW,
        published: false,
        isPro: false, // owner: Free default; admin bulk Free/Pro bilan o'zgartiradi
        packScanStatus: "clean",
        ...rights,
      },
    });
  } catch (e) {
    // Poyga: bir vaqtda ikki topshiriq (@@unique[contributorId, externalId]) → mavjudni qaytar.
    if ((e as { code?: string })?.code === "P2002") {
      const dup = await prisma.contributorTemplate.findFirst({
        where: { contributorId: opts.userId, externalId },
        select: { id: true, reviewStatus: true },
      });
      if (dup) return { id: dup.id, reviewStatus: dup.reviewStatus, alreadySubmitted: true };
    }
    throw e;
  }

  // 8) TOZA asl fayl → private `pack` (server-tomon nusxa; ilova xotirasidan o'tmaydi).
  //    So'ng suv belgili public preview/thumb (stock quvuri). Xatoda — KOMPENSATSIYA
  //    (yarim aset qolmasin): assetlar + qator o'chiriladi.
  try {
    const packKey = `templates/${template.id}/pack${ext}`;
    let copied = false;
    try {
      copied = await copyS3Object(asset.resultKey, packKey);
    } catch (copyErr) {
      console.error("[explore] copyS3Object yiqildi, download+reupload fallback:", copyErr);
    }
    if (!copied) {
      // Zaxira: yuklab olib qayta yuklash (CopyObject qo'llanmasa).
      const meta0 = await getS3ObjectMeta(asset.resultKey);
      const buf = await downloadS3ToBuffer(asset.resultKey);
      await uploadBufferToS3(buf, packKey, meta0.contentType || "application/octet-stream");
    }
    const stored = await getS3ObjectMeta(packKey);
    if (stored.sizeBytes == null) {
      throw new Error("Pack storage verification failed (no object)");
    }
    await syncTemplateAssetKeys(template.id, { ensure: [packKey] });
    await prisma.contributorTemplate.update({
      where: { id: template.id },
      data: { fileName: `pack${ext}`, fileSize: stored.sizeBytes },
    });
    // Suv belgili preview/thumb (Free reja shuni ko'radi; toza pack private qoladi).
    await generateStockWatermarkedDerivatives(template.id);
  } catch (e) {
    console.error("[explore] fayl saqlash/derivativ yiqildi, kompensatsiya:", template.id, e);
    await deleteTemplateAssets(template.id).catch(() => {});
    await prisma.contributorTemplate.delete({ where: { id: template.id } }).catch(() => {});
    throw new ExploreError(
      "STORAGE_FAILED",
      500,
      "Could not publish this generation — please try again"
    );
  }

  return { id: template.id, reviewStatus: template.reviewStatus, alreadySubmitted: false };
}

/** Foydalanuvchining AI Stock topshiriqlari (holat ko'rsatish uchun). generationId → status. */
export async function listExploreSubmissions(userId: string): Promise<
  Array<{ generationId: string; templateId: string; reviewStatus: string; published: boolean; name: string }>
> {
  const rows = await prisma.contributorTemplate.findMany({
    where: { contributorId: userId, templateType: "ai-stock" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, externalId: true, reviewStatus: true, published: true, name: true },
  });
  return rows.map((r) => ({
    generationId: (r.externalId || "").replace(/^gen:/, ""),
    templateId: r.id,
    reviewStatus: r.reviewStatus,
    published: r.published,
    name: r.name,
  }));
}
