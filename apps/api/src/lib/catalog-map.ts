import { TemplateReviewStatus } from "@creative-tools/database";
import {
  publicAssetUrl,
  findScenePreview,
  findSceneVideo,
  publicSceneUrl,
  publicMogrtUrl,
  sceneFileIsVideo,
} from "./template-files.js";
import {
  isS3Configured,
  s3ObjectExists,
  templateAssetFlags,
  listTemplateS3Keys,
} from "./s3.js";

/** R2/S3: sahna preview URL — disk + object storage.
 *  knownS3Keys berilsa HeadObject chaqirilmaydi (N+1 oldini olish). */
async function enrichScenesAsync(
  meta: Record<string, unknown>,
  templateId: string,
  apiBase: string,
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

      const videoFile = findSceneVideo(templateId, key);
      let hasVideo = !!videoFile;
      if (!hasVideo && isS3Configured()) {
        const s3Key = `templates/${templateId}/scenes/${key}.mp4`;
        hasVideo = knownS3Keys
          ? knownS3Keys.has(s3Key)
          : await s3ObjectExists(s3Key);
      }
      if (hasVideo) {
        s.preview = publicSceneUrl(apiBase, templateId, key);
        const imgFile = findScenePreview(templateId, key);
        if (imgFile && !sceneFileIsVideo(imgFile)) {
          s.thumb = publicSceneUrl(apiBase, templateId, key + "_thumb");
        }
      } else {
        const previewFile = findScenePreview(templateId, key);
        let hasImg = !!previewFile;
        if (!hasImg && isS3Configured()) {
          const s3Key = `templates/${templateId}/scenes/${key}.png`;
          hasImg = knownS3Keys
            ? knownS3Keys.has(s3Key)
            : await s3ObjectExists(s3Key);
        }
        if (hasImg) {
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
  createdAt: Date;
  updatedAt: Date;
};

export async function mapCatalogItem(t: TemplateRow, apiBase: string) {
  const rawMeta = (t.metaJson ?? {}) as Record<string, unknown>;
  // Bitta ListObjectsV2 bilan barcha S3 kalitlarini olish —
  // N×M HeadObject o'rniga 1 ta List chaqiruvi (N+1 muammo hal).
  const s3Keys = await listTemplateS3Keys(t.id);
  const meta = await enrichScenesAsync(rawMeta, t.id, apiBase, s3Keys);
  const assets = await templateAssetFlags(t.id, s3Keys);
  const hasThumb = assets.thumb;
  const hasPreview = assets.preview;
  const hasPack = assets.pack;

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
    fileName: hasPack ? t.fileName : null,
    fileSize: hasPack ? t.fileSize : null,
    hasThumb,
    hasPreview,
    hasPack,
    thumbUrl: hasThumb ? publicAssetUrl(apiBase, t.id, "thumb") : null,
    previewUrl: hasPreview ? publicAssetUrl(apiBase, t.id, "preview") : null,
    packUrl,
    metaJson: meta,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export const approvedCatalogWhere = {
  reviewStatus: TemplateReviewStatus.APPROVED,
  published: true,
};
