import fs from "fs";
import path from "path";
import yauzl from "yauzl";
import { PACK_EXT_APP, DEFAULT_APP } from "./apps.js";

/** Zip ichidan qidiriladigan pack kengaytmalari (papka/joylashuv muhim emas — tolerant).
 *  Kanonik ro'yxat apps.ts'da (ae/pr/motion/resolve). */
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VIDEO_EXTS = [".mp4", ".mov", ".webm"];

/* ── Ishonchsiz-arxiv chegaralari (FAZA 6a). Env orqali sozlanadi. ──
 * Zip-bomb: umumiy ochilgan hajm capi + absurd siqish nisbati + entry soni.
 * Tekshiruvlar markaziy katalog metadata'sida (ekstraktsiyasiz) ishlaydi;
 * yauzl'ning validateEntrySizes (default ON) yolg'on header'ni stream'da ushlaydi. */
const MAX_UNCOMPRESSED_BYTES = envInt(
  "INGEST_MAX_UNCOMPRESSED_BYTES",
  5 * 1024 * 1024 * 1024 // 5 GiB
);
const MAX_ENTRIES = envInt("INGEST_MAX_ENTRIES", 5000);
const MAX_COMPRESSION_RATIO = envInt("INGEST_MAX_COMPRESSION_RATIO", 1000);
const RATIO_MIN_SIZE = 10 * 1024 * 1024; // nisbat tekshiruvi faqat >10MB entry'larda

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/**
 * Zip xavfsizlik qoidabuzarligi (bomb/slip/limit) — DOIMIY rad: retry foyda
 * bermaydi, chaqiruvchi incoming zipni o'chirishi mumkin. `message` foydalanuvchiga
 * ko'rsatsa bo'ladigan darajada toza.
 */
export class IngestZipError extends Error {
  readonly permanent = true;
  constructor(message: string) {
    super(message);
    this.name = "IngestZipError";
  }
}

function isJunkEntry(name: string): boolean {
  const base = path.basename(name);
  return base.startsWith("._") || name.includes("__MACOSX/") || base === ".DS_Store";
}

/** ZIP-SLIP: normalizatsiyadan keyin workDir'dan tashqariga chiqadigan yo'l.
 *  (Yozish yo'li entry nomidan OLINMAYDI — bu himoya qatlami, hujumkor zipni
 *  butunlay rad etish uchun.) */
function isUnsafeEntryPath(name: string): boolean {
  const norm = path.posix.normalize(name.replace(/\\/g, "/"));
  return (
    norm.startsWith("/") ||
    /^[a-zA-Z]:/.test(norm) ||
    norm === ".." ||
    norm.startsWith("../") ||
    norm.split("/").includes("..")
  );
}

/** yauzl o'zi ham hujumkor entry nomlarini parse bosqichida rad etadi
 *  ("invalid relative path", "absolute path", "invalid characters") — ularni
 *  IngestZipError'ga o'raymiz, chaqiruvchi DOIMIY rad deb bilsin. */
function classifyZipError(e: Error): Error {
  if (/invalid relative path|absolute path|invalid characters in fileName/i.test(e.message)) {
    return new IngestZipError("Zip rejected: entry path escapes the archive (zip-slip)");
  }
  return e;
}

function fmtLimit(bytes: number): string {
  const gib = 1024 * 1024 * 1024;
  if (bytes >= gib) return `${Math.round(bytes / gib)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
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
    // validateEntrySizes (default ON) — header'da yolg'on uncompressedSize
    // e'lon qilgan entry stream paytida xato beradi (bomb himoyasi qatlami).
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) {
        reject(err || new Error("Zip failed to open"));
        return;
      }
      let packPath: string | null = null;
      let packExt: string | null = null;
      let templateApp = DEFAULT_APP;
      let imagePath: string | null = null;
      let videoPath: string | null = null;
      let finished = false;
      let settled = false;
      let pending = 0;
      let entryCount = 0;
      let declaredTotal = 0; // markaziy katalogdagi e'lon qilingan ochiq hajm
      let writtenTotal = 0; // real diskka yozilgan baytlar (belt-and-braces)
      const openStreams = new Set<NodeJS.ReadableStream>();

      const maybeResolve = () => {
        if (settled) return;
        if (finished && pending === 0) {
          settled = true;
          resolve({ packPath, packExt, templateApp, imagePath, videoPath });
        }
      };
      // Bitta qoidabuzarlik = butun zip rad (bir marta, ochiq stream'lar yopiladi).
      const fail = (e: Error) => {
        if (settled) return;
        settled = true;
        for (const s of openStreams) {
          try {
            (s as unknown as { destroy: () => void }).destroy();
          } catch {}
        }
        try {
          zip.close();
        } catch {}
        reject(e);
      };

      zip.on("entry", (entry) => {
        if (settled) return;
        const name = entry.fileName as string;
        // Har entry uchun (ekstrakt qilinmaydiganlar ham) arzon metadata guardlar:
        entryCount++;
        if (entryCount > MAX_ENTRIES) {
          fail(new IngestZipError(`Zip rejected: more than ${MAX_ENTRIES} entries`));
          return;
        }
        if (isUnsafeEntryPath(name)) {
          fail(new IngestZipError("Zip rejected: entry path escapes the archive (zip-slip)"));
          return;
        }
        const unc = Number(entry.uncompressedSize) || 0;
        const cmp = Number(entry.compressedSize) || 0;
        declaredTotal += unc;
        if (unc > MAX_UNCOMPRESSED_BYTES || declaredTotal > MAX_UNCOMPRESSED_BYTES) {
          fail(
            new IngestZipError(
              `Zip rejected: uncompressed size exceeds ${fmtLimit(MAX_UNCOMPRESSED_BYTES)} limit`
            )
          );
          return;
        }
        if (unc > RATIO_MIN_SIZE && cmp > 0 && unc / cmp > MAX_COMPRESSION_RATIO) {
          fail(new IngestZipError("Zip rejected: suspicious compression ratio (zip bomb)"));
          return;
        }
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
          // Faqat kerakli entry'lar (pack + preview) ekstrakt qilinadi, qolgani skip.
          zip.readEntry();
          return;
        }
        // MUHIM: yozish yo'li entry nomidan OLINMAYDI (workDir/<kind><ext>) —
        // zip-slip bu qatlamda ham imkonsiz.
        const dest = path.join(workDir, `${kind}${ext}`);
        pending++;
        zip.openReadStream(entry, (err2, readStream) => {
          if (settled) {
            readStream?.destroy();
            return;
          }
          if (err2 || !readStream) {
            pending--;
            zip.readEntry();
            maybeResolve();
            return;
          }
          openStreams.add(readStream);
          const out = fs.createWriteStream(dest);
          openStreams.add(out as unknown as NodeJS.ReadableStream);
          readStream.on("data", (chunk: Buffer) => {
            writtenTotal += chunk.length;
            if (writtenTotal > MAX_UNCOMPRESSED_BYTES) {
              fail(
                new IngestZipError(
                  `Zip rejected: extracted data exceeds ${fmtLimit(MAX_UNCOMPRESSED_BYTES)} limit`
                )
              );
            }
          });
          readStream.on("error", () => {
            // yauzl validateEntrySizes xatosi ham shu yerga keladi
            fail(new IngestZipError("Zip rejected: corrupt or size-mismatched entry"));
          });
          readStream.pipe(out);
          out.on("finish", () => {
            openStreams.delete(readStream);
            openStreams.delete(out as unknown as NodeJS.ReadableStream);
            if (settled) return;
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
            openStreams.delete(readStream);
            openStreams.delete(out as unknown as NodeJS.ReadableStream);
            if (settled) return;
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
      zip.on("error", (e) => fail(classifyZipError(e)));
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
