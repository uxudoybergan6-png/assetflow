import path from "path";
import { PassThrough, Readable } from "stream";
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
/** Markaziy katalog (+EOCD dumi) xotira keshi capi — 5000 entry uchun mo'l-ko'l;
 *  undan katta katalog = shubhali zip (streaming ingest'da butun zip yuklanmaydi,
 *  faqat shu dum keshlanadi). */
const MAX_CENTRAL_DIR_BYTES = envInt("INGEST_MAX_CENTRAL_DIR_BYTES", 32 * 1024 * 1024);

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

/* ────────────────────────────────────────────────────────────────────────
 * Streaming ingest (FAZA 6b) — zip HECH QACHON butunligicha yuklab olinmaydi.
 * Manba bucket'dan ranged GET bilan: (1) EOCD + markaziy katalog dumi xotira
 * keshiga olinadi (kichik, MAX_CENTRAL_DIR_BYTES cap), (2) barcha FAZA 6a
 * guardlar markaziy katalog metadata'sida (entry baytlarisiz) tekshiriladi,
 * (3) faqat kerakli 3 entry (pack + preview rasm + video) yauzl
 * fromRandomAccessReader orqali ranged stream bilan o'qiladi. Cho'qqi xotira
 * = katalog keshi + stream buferlari, zip hajmidan MUSTAQIL.
 * ──────────────────────────────────────────────────────────────────────── */

/** Streaming zip manbasi — s3.ts (yoki testda lokal fayl) in'ektsiya qilinadi. */
export interface RangedZipSource {
  /** Obyekt umumiy hajmi (HEAD'dan). */
  size: number;
  /** [start, end) KICHIK bo'lakni Buffer sifatida o'qish (EOCD/katalog). */
  read(start: number, endExclusive: number): Promise<Buffer>;
  /** [start, end) bo'lakni stream sifatida o'qish (entry baytlari — katta). */
  stream(start: number, endExclusive: number): Readable;
}

export interface ZipEntryRef {
  entry: yauzl.Entry;
  ext: string;
}

export interface StreamingIngestZip {
  pack: ZipEntryRef | null;
  image: ZipEntryRef | null;
  video: ZipEntryRef | null;
  templateApp: string;
  /** Entry'ning OCHILGAN (inflate) baytlari — bufersiz. Har chaqiruv yangi stream. */
  openEntryStream(ref: ZipEntryRef): Promise<Readable>;
  close(): void;
}

const EOCD_SIG = 0x06054b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;
const ZIP64_EOCD_SIG = 0x06064b50;
/** yauzl bilan bir xil EOCD qidiruv oynasi: EOCD(22) + max comment(65535) + zip64 locator(20). */
const EOCD_SEARCH_LEN = 22 + 0xffff + 20;

/**
 * EOCD (+zip64) ni dumdan topib, markaziy katalogni QAMRAB oluvchi xotira
 * keshini qaytaradi. Keshga EOCD qidiruv oynasi ham kiradi — yauzl'ning barcha
 * metadata o'qishlari (EOCD skan + har entry uchun 2 ta kichik read) tarmoqsiz,
 * xotiradan xizmatlanadi (aks holda 5000 entry = ~10 000 ranged GET bo'lardi).
 */
async function locateCentralDirectory(
  source: RangedZipSource
): Promise<{ cacheStart: number; cache: Buffer }> {
  if (source.size < 22) throw new IngestZipError("Zip rejected: file too small to be a zip");
  const tailLen = Math.min(source.size, EOCD_SEARCH_LEN);
  const tailStart = source.size - tailLen;
  const tail = await source.read(tailStart, source.size);

  let eocdPos = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === EOCD_SIG) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos < 0) {
    throw new IngestZipError("Zip rejected: end of central directory not found (not a zip / corrupt)");
  }
  let entryCount: number = tail.readUInt16LE(eocdPos + 10);
  const cdSize32 = tail.readUInt32LE(eocdPos + 12);
  let cdOffset: number = tail.readUInt32LE(eocdPos + 16);

  if (entryCount === 0xffff || cdSize32 === 0xffffffff || cdOffset === 0xffffffff) {
    // zip64: EOCD'dan oldin 20-baytlik locator → zip64 EOCD record (56B).
    const locPos = eocdPos - 20;
    if (locPos < 0 || tail.readUInt32LE(locPos) !== ZIP64_LOCATOR_SIG) {
      throw new IngestZipError("Zip rejected: broken zip64 metadata");
    }
    const z64Off = Number(tail.readBigUInt64LE(locPos + 8));
    if (!Number.isSafeInteger(z64Off) || z64Off < 0 || z64Off + 56 > source.size) {
      throw new IngestZipError("Zip rejected: broken zip64 metadata");
    }
    const z64 =
      z64Off >= tailStart
        ? tail.subarray(z64Off - tailStart, z64Off - tailStart + 56)
        : await source.read(z64Off, z64Off + 56);
    if (z64.length < 56 || z64.readUInt32LE(0) !== ZIP64_EOCD_SIG) {
      throw new IngestZipError("Zip rejected: broken zip64 metadata");
    }
    entryCount = Number(z64.readBigUInt64LE(32));
    cdOffset = Number(z64.readBigUInt64LE(48));
  }

  // Arzon oldindan-guard: katalogni yuklab olishdan OLDIN entry soni (FAZA 6a cap).
  if (entryCount > MAX_ENTRIES) {
    throw new IngestZipError(`Zip rejected: more than ${MAX_ENTRIES} entries`);
  }
  if (!Number.isSafeInteger(cdOffset) || cdOffset < 0 || cdOffset > source.size) {
    throw new IngestZipError("Zip rejected: corrupt central directory offset");
  }
  const cacheStart = Math.min(cdOffset, tailStart);
  if (source.size - cacheStart > MAX_CENTRAL_DIR_BYTES) {
    throw new IngestZipError("Zip rejected: central directory too large");
  }
  const cache =
    cacheStart >= tailStart
      ? tail.subarray(cacheStart - tailStart)
      : Buffer.concat([await source.read(cacheStart, tailStart), tail]);
  return { cacheStart, cache };
}

/** yauzl RandomAccessReader: [cacheStart, size) — xotira keshidan (katalog+EOCD),
 *  undan pastki o'qishlar (entry local header + siqilgan baytlar) — ranged stream. */
class RangedZipReader extends yauzl.RandomAccessReader {
  constructor(
    private readonly source: RangedZipSource,
    private readonly cacheStart: number,
    private readonly cache: Buffer
  ) {
    super();
  }
  _readStreamForRange(start: number, end: number): Readable {
    if (start >= this.cacheStart) {
      return Readable.from([
        this.cache.subarray(start - this.cacheStart, end - this.cacheStart),
      ]);
    }
    if (end <= this.cacheStart) {
      return this.source.stream(start, end);
    }
    // Chegara kesishmasi (oxirgi entry baytlari kesh boshlanishiga kirib boradi):
    // tarmoq qismi + kesh qismi ketma-ket bitta stream sifatida.
    const out = new PassThrough();
    const net = this.source.stream(start, this.cacheStart);
    net.on("error", (e) => out.destroy(e));
    out.on("close", () => {
      if (!net.destroyed) net.destroy();
    });
    net.pipe(out, { end: false });
    net.on("end", () => out.end(this.cache.subarray(0, end - this.cacheStart)));
    return out;
  }
}

/** Entry stream himoya o'rami: yauzl xatolari (validateEntrySizes, buzuq data)
 *  IngestZipError'ga aylanadi + e'lon qilingandan ortiq bayt kelsa uziladi
 *  (belt-and-braces — eski writtenTotal guardining per-entry ekvivalenti). */
function guardEntryStream(raw: Readable, declaredSize: number): Readable {
  const out = new PassThrough();
  let seen = 0;
  raw.on("data", (chunk: Buffer) => {
    seen += chunk.length;
    if (seen > declaredSize) {
      raw.unpipe(out);
      raw.destroy();
      out.destroy(new IngestZipError("Zip rejected: corrupt or size-mismatched entry"));
    }
  });
  raw.on("error", () =>
    out.destroy(new IngestZipError("Zip rejected: corrupt or size-mismatched entry"))
  );
  out.on("close", () => {
    if (!raw.destroyed) raw.destroy();
  });
  raw.pipe(out);
  return out;
}

/**
 * Ingest zipni RANGED o'qishlar ustida ochadi: pack (.aep/.mogrt/…) + preview
 * rasm + preview video entry'larini kengaytma bo'yicha topadi (papka/nomlanish
 * muhim emas — tolerant, har turdan BIRINCHI topilgani). Barcha FAZA 6a
 * guardlar (entry soni, zip-slip, ochilgan hajm capi, siqish nisbati) markaziy
 * katalogda — entry baytlari o'qilishidan OLDIN — tekshiriladi; qoidabuzarlik
 * IngestZipError (DOIMIY rad). Pack topilmasa pack=null.
 * validateEntrySizes (default ON) yolg'on header'ni stream'da ushlaydi.
 */
export async function openStreamingIngestZip(
  source: RangedZipSource
): Promise<StreamingIngestZip> {
  const { cacheStart, cache } = await locateCentralDirectory(source);
  const reader = new RangedZipReader(source, cacheStart, cache);
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.fromRandomAccessReader(
      reader,
      source.size,
      { lazyEntries: true, autoClose: false },
      (err, zf) => {
        if (err || !zf) reject(classifyZipError(err ?? new Error("Zip failed to open")));
        else resolve(zf);
      }
    );
  });

  try {
    return await new Promise<StreamingIngestZip>((resolve, reject) => {
      let pack: ZipEntryRef | null = null;
      let image: ZipEntryRef | null = null;
      let video: ZipEntryRef | null = null;
      let templateApp = DEFAULT_APP;
      let entryCount = 0;
      let declaredTotal = 0; // markaziy katalogdagi e'lon qilingan ochiq hajm
      let settled = false;
      const fail = (e: Error) => {
        if (settled) return;
        settled = true;
        reject(e);
      };

      zip.on("entry", (entry: yauzl.Entry) => {
        if (settled) return;
        const name = entry.fileName;
        // Har entry uchun (stream qilinmaydiganlar ham) arzon metadata guardlar (FAZA 6a):
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
        if (!/\/$/.test(name) && !isJunkEntry(name)) {
          const ext = path.extname(name).toLowerCase();
          if (!pack && PACK_EXT_APP[ext]) {
            pack = { entry, ext };
            templateApp = PACK_EXT_APP[ext];
          } else if (!image && IMAGE_EXTS.includes(ext)) {
            image = { entry, ext };
          } else if (!video && VIDEO_EXTS.includes(ext)) {
            video = { entry, ext };
          }
        }
        zip.readEntry();
      });
      zip.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({
          pack,
          image,
          video,
          templateApp,
          openEntryStream: (ref: ZipEntryRef) =>
            new Promise<Readable>((res, rej) => {
              zip.openReadStream(ref.entry, (err, rs) => {
                if (err || !rs) {
                  rej(classifyZipError(err ?? new Error("Zip entry stream failed")));
                } else {
                  res(guardEntryStream(rs, Number(ref.entry.uncompressedSize) || 0));
                }
              });
            }),
          close: () => {
            try {
              zip.close();
            } catch {}
          },
        });
      });
      zip.on("error", (e: Error) => fail(classifyZipError(e)));
      zip.readEntry();
    });
  } catch (e) {
    try {
      zip.close();
    } catch {}
    throw e;
  }
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
