import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.join(__dirname, "../../uploads/contributor-templates");

export type TemplateAssetKind = "thumb" | "preview" | "pack";

const KIND_EXT: Record<TemplateAssetKind, string[]> = {
  thumb: [".jpg", ".jpeg", ".png", ".webp"],
  preview: [".mp4", ".mov", ".webm"],
  pack: [".aep", ".zip", ".mogrt"],
};

export function templateDir(templateId: string) {
  return path.join(UPLOADS_ROOT, templateId);
}

export function ensureTemplateDir(templateId: string) {
  const dir = templateDir(templateId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function assetPath(templateId: string, kind: TemplateAssetKind, ext: string) {
  return path.join(templateDir(templateId), `${kind}${ext}`);
}

export function findAssetPath(
  templateId: string,
  kind: TemplateAssetKind
): string | null {
  const dir = templateDir(templateId);
  if (!fs.existsSync(dir)) return null;
  const allowed = KIND_EXT[kind];
  for (const name of fs.readdirSync(dir)) {
    const lower = name.toLowerCase();
    if (lower.startsWith(kind) && allowed.some((e) => lower.endsWith(e))) {
      return path.join(dir, name);
    }
  }
  return null;
}

export function publicAssetUrl(
  apiBase: string,
  templateId: string,
  kind: TemplateAssetKind
) {
  return `${apiBase.replace(/\/$/, "")}/api/plugin/assets/${templateId}/${kind}`;
}

/** Sahna comp nomidan barqaror, fayl-xavfsiz kalit (per-scene preview uchun) */
export function sceneKey(name: string) {
  return (
    String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "scene"
  );
}

export function scenesDir(templateId: string) {
  return path.join(templateDir(templateId), "scenes");
}

export function ensureScenesDir(templateId: string) {
  const dir = scenesDir(templateId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Pack ichidan ajratilgan yakka .mogrt fayllar papkasi (selective download) */
export function mogrtDir(templateId: string) {
  return path.join(templateDir(templateId), "mogrt");
}

export function ensureMogrtDir(templateId: string) {
  const dir = mogrtDir(templateId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function findMogrtFile(templateId: string, slug: string): string | null {
  const p = path.join(mogrtDir(templateId), `${sceneKey(slug)}.mogrt`);
  return fs.existsSync(p) ? p : null;
}

export function publicMogrtUrl(
  apiBase: string,
  templateId: string,
  slug: string
) {
  return `${apiBase.replace(/\/$/, "")}/api/plugin/assets/${templateId}/mogrt/${sceneKey(slug)}`;
}

const SCENE_IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];
const SCENE_VIDEO_EXTS = [".mp4", ".mov", ".webm"];

/** Per-scene preview yo'li — avval rasm, keyin video (mavjud bo'lsa) */
export function findScenePreview(templateId: string, key: string): string | null {
  const dir = scenesDir(templateId);
  if (!fs.existsSync(dir)) return null;
  const safe = sceneKey(key);
  for (const ext of [...SCENE_IMAGE_EXTS, ...SCENE_VIDEO_EXTS]) {
    const p = path.join(dir, `${safe}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Alohida video preview yo'li (rasm bo'lsa ham video qaytaradi) */
export function findSceneVideo(templateId: string, key: string): string | null {
  const dir = scenesDir(templateId);
  if (!fs.existsSync(dir)) return null;
  const safe = sceneKey(key);
  for (const ext of SCENE_VIDEO_EXTS) {
    const p = path.join(dir, `${safe}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function sceneFileIsVideo(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SCENE_VIDEO_EXTS.includes(ext);
}

export function publicSceneUrl(
  apiBase: string,
  templateId: string,
  key: string
) {
  return `${apiBase.replace(/\/$/, "")}/api/plugin/assets/${templateId}/scene/${sceneKey(key)}`;
}

/** Thumbnail faylini topish (scene key + "_thumb" suffix) */
export function findSceneThumb(templateId: string, key: string): string | null {
  const dir = scenesDir(templateId);
  if (!fs.existsSync(dir)) return null;
  const safe = sceneKey(key) + "_thumb";
  for (const ext of SCENE_IMAGE_EXTS) {
    const p = path.join(dir, `${safe}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
