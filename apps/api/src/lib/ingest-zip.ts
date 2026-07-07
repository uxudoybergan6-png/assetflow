import fs from "fs";
import path from "path";
import yauzl from "yauzl";

/** Zip ichidan qidiriladigan kengaytmalar — papka/joylashuv muhim emas (tolerant). */
const PACK_EXT_APP: Record<string, string> = { ".aep": "ae", ".mogrt": "pr" };
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VIDEO_EXTS = [".mp4", ".mov", ".webm"];

function isJunkEntry(name: string): boolean {
  const base = path.basename(name);
  return base.startsWith("._") || name.includes("__MACOSX/") || base === ".DS_Store";
}

export interface IngestZipResult {
  packPath: string | null;
  packExt: string | null;
  templateApp: string;
  imagePath: string | null;
  videoPath: string | null;
}

/**
 * Ingest zipini ochib, pack (.aep/.mogrt) + preview rasm + preview videoni
 * kengaytma bo'yicha topib workDir'ga ajratib oladi (papka/nomlanish muhim
 * emas — tolerant). Har bir turdan faqat BIRINCHI topilgan entry olinadi.
 * Pack topilmasa packPath=null (chaqiruvchi buni "skip" sifatida ko'radi).
 */
export async function extractIngestZip(
  zipPath: string,
  workDir: string
): Promise<IngestZipResult> {
  fs.mkdirSync(workDir, { recursive: true });
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) {
        reject(err || new Error("Zip failed to open"));
        return;
      }
      let packPath: string | null = null;
      let packExt: string | null = null;
      let templateApp = "ae";
      let imagePath: string | null = null;
      let videoPath: string | null = null;
      let finished = false;
      let pending = 0;

      const maybeResolve = () => {
        if (finished && pending === 0) {
          resolve({ packPath, packExt, templateApp, imagePath, videoPath });
        }
      };

      zip.on("entry", (entry) => {
        const name = entry.fileName;
        if (/\/$/.test(name) || isJunkEntry(name)) {
          zip.readEntry();
          return;
        }
        const ext = path.extname(name).toLowerCase();
        let kind: "pack" | "image" | "video" | null = null;
        if (!packPath && PACK_EXT_APP[ext]) kind = "pack";
        else if (!imagePath && IMAGE_EXTS.includes(ext)) kind = "image";
        else if (!videoPath && VIDEO_EXTS.includes(ext)) kind = "video";
        if (!kind) {
          zip.readEntry();
          return;
        }
        const dest = path.join(workDir, `${kind}${ext}`);
        pending++;
        zip.openReadStream(entry, (err2, readStream) => {
          if (err2 || !readStream) {
            pending--;
            zip.readEntry();
            maybeResolve();
            return;
          }
          const out = fs.createWriteStream(dest);
          readStream.pipe(out);
          out.on("finish", () => {
            if (kind === "pack") {
              packPath = dest;
              packExt = ext;
              templateApp = PACK_EXT_APP[ext];
            } else if (kind === "image") {
              imagePath = dest;
            } else if (kind === "video") {
              videoPath = dest;
            }
            pending--;
            zip.readEntry();
            maybeResolve();
          });
          out.on("error", () => {
            pending--;
            zip.readEntry();
            maybeResolve();
          });
        });
      });
      zip.on("end", () => {
        finished = true;
        maybeResolve();
      });
      zip.on("error", (e) => reject(e));
      zip.readEntry();
    });
  });
}

/** Zip nomidan toza sarlavha: kengaytma olib tashlanadi, - _ bo'sh joyga aylanadi. */
export function titleFromZipFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/\.zip$/i, "");
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Untitled template";
}

/** Fayl nomi uchun xavfsiz sanitizatsiya (Content-Disposition/disk uchun). */
export function sanitizeFileBaseName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 120) || "template";
}
