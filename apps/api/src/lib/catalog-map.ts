import { TemplateReviewStatus } from "@creative-tools/database";
import {
  findAssetPath,
  publicAssetUrl,
  findScenePreview,
  findSceneVideo,
  publicSceneUrl,
  sceneFileIsVideo,
} from "./template-files.js";

/**
 * metaJson.scenes ichidagi har sahnani per-scene preview URL bilan boyitadi.
 * Manifest'da `previewKey` bo'lsa va PNG fayl mavjud bo'lsa — `preview` URL va
 * `previewKind:"image"` qo'shiladi (subscriber panelda <img> sifatida ko'rinadi).
 */
function enrichScenes(meta: Record<string, unknown>, templateId: string, apiBase: string) {
  const scenes = meta.scenes;
  if (!Array.isArray(scenes)) return meta;
  const mapped = scenes.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const s = { ...(raw as Record<string, unknown>) };
    const key =
      (typeof s.previewKey === "string" && s.previewKey) ||
      (typeof s.aeComp === "string" && s.aeComp) ||
      (typeof s.n === "string" && s.n) ||
      "";
    if (key) {
      // Video preview ustuvorlik: video bo'lsa shu ko'rsatiladi, yo'q bo'lsa thumbnail rasm
      const videoFile = findSceneVideo(templateId, key);
      if (videoFile) {
        // Preview video sifatida (previewKind yo'q → plugin <video> ishlatadi)
        s.preview = publicSceneUrl(apiBase, templateId, key);
        // Thumbnail ham bo'lsa thumbnail sifatida saqlash
        const imgFile = findScenePreview(templateId, key);
        if (imgFile && !sceneFileIsVideo(imgFile)) {
          s.thumb = publicSceneUrl(apiBase, templateId, key + "_thumb");
        }
      } else {
        const previewFile = findScenePreview(templateId, key);
        if (previewFile) {
          s.preview = publicSceneUrl(apiBase, templateId, key);
          s.previewKind = "image";
        }
      }
    }
    return s;
  });
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
  updatedAt: Date;
};

export function mapCatalogItem(t: TemplateRow, apiBase: string) {
  const rawMeta = (t.metaJson ?? {}) as Record<string, unknown>;
  const meta = enrichScenes(rawMeta, t.id, apiBase);
  const hasThumb = !!findAssetPath(t.id, "thumb");
  const hasPreview = !!findAssetPath(t.id, "preview");
  const hasPack = !!findAssetPath(t.id, "pack");
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
    packUrl: hasPack ? publicAssetUrl(apiBase, t.id, "pack") : null,
    metaJson: meta,
    updatedAt: t.updatedAt.toISOString(),
  };
}

export const approvedCatalogWhere = {
  reviewStatus: TemplateReviewStatus.APPROVED,
  published: true,
};
