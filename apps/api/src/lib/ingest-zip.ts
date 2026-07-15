import path from "path";
import { PassThrough, Readable } from "stream";
import yauzl from "yauzl";
import yazl from "yazl";
import { PACK_EXT_APP, DEFAULT_APP } from "./apps.js";

/** Zip ichidan qidiriladigan pack kengaytmalari (papka/joylashuv muhim emas — tolerant).
 *  Kanonik ro'yxat apps.ts'da (ae/pr/motion/resolve). */
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VIDEO_EXTS = [".mp4", ".mov", ".webm"];

// P19: preview media tanlash — FIRST-MATCH emas, SKORLASH. Zip'da bir nechta rasm/video bo'lishi
// mumkin (masalan "Preview Video.mp4" + "Help.mp4" + (Footage)/…). "Preview…" nomli faylni afzal,
// "Help/Tutorial/…" o'quv kliplarini va (Footage)/assets papka manbalarini pastga tushiramiz.
type MediaCandidate = { entry: yauzl.Entry; ext: string; name: string };
// Help/o'quv klipi — bularni HECH QACHON preview qilib olmaymiz (boshqa nomzod bo'lmasa ham bo'sh qoldiramiz).
const HELP_RE = /\b(help|tutorial|instruction|instructions|guide|readme|read[ _-]?me|howto|how[ _-]?to|manual|tips?)\b/i;
// (Footage) / footage / assets / sources papkasi — loyiha manbalari, preview emas → pastga.
const SOURCE_DIR_RE = /(^|\/)\(?\s*(footage|assets?|sources?|src|elements?|media)\s*\)?\//i;
function scoreMediaCandidate(name: string, isVideo: boolean): number {
  const base = path.basename(name).toLowerCase();
  let score = 0;
  if (SOURCE_DIR_RE.test(name)) score -= 100; // manba papkasi → demote
  if (HELP_RE.test(base)) score -= 1000; // help/tutorial → deyarli hech qachon
  // "Preview Video" / "Preview Image" eng kuchli; oddiy "preview" — kuchli.
  if (isVideo && /preview[ _-]*video|video[ _-]*preview/.test(base)) score += 60;
  else if (!isVideo && /preview[ _-]*image|image[ _-]*preview/.test(base)) score += 60;
  else if (/\bpreview\b/.test(base)) score += 40;
  return score;
}
/** Eng yaxshi nomzodni tanlaydi; barcha nomzod help klip bo'lsa → null (preview bo'sh, help EMAS). */
export function _pickBestMediaName(names: string[], isVideo: boolean): string | null {
  // Test uchun sof yordamchi (P19): nom ro'yxatidan tanlangan preview nomini qaytaradi.
  if (!names.length) return null;
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const n of names) {
    const s = scoreMediaCandidate(n, isVideo);
    if (s > bestScore) { bestScore = s; best = n; }
  }
  if (best && HELP_RE.test(path.basename(best).toLowerCase())) return null;
  return best;
}
function pickBestMedia(cands: MediaCandidate[], isVideo: boolean): ZipEntryRef | null {
  if (!cands.length) return null;
  let best: MediaCandidate | null = null;
  let bestScore = -Infinity;
  for (const c of cands) {
    const s = scoreMediaCandidate(c.name, isVideo);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  if (!best) return null;
  // Eng yaxshi ham help klip bo'lsa (ya'ni hammasi help) → preview bo'sh qoldiramiz.
  if (HELP_RE.test(path.basename(best.name).toLowerCase())) return null;
  return { entry: best.entry, ext: best.ext };
}

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

/**
 * P35 — DOIMO-XAVFSIZ axlat/marketing entry detektori. INGEST bu naqshga tushgan
 * entry nomlarini (tanlangan preview/thumb'dan TASHQARI) `metaJson.packJunkEntries`ga
 * yozadi; SERVE ularni yuklab-olish nusxasidan chiqarib tashlaydi; backfill skript
 * ham AYNAN shu detektordan foydalanadi — yagona haqiqat manbai. Faqat mutlaqo
 * xavfsiz naqshlar: OS axlati + ILDIZ darajadagi marketing fayllari (ichki
 * papkadagi "preview.mp4" .aep havola qilgan footage bo'lishi mumkin — TEGMAYMIZ).
 */
export function isMarketingJunkEntry(name: string): boolean {
  const norm = name.replace(/\\/g, "/");
  if (norm.includes("__MACOSX/")) return true;
  const base = path.posix.basename(norm);
  if (base.startsWith("._") || base === ".DS_Store" || base === "Thumbs.db") return true;
  const isRoot = !norm.includes("/");
  if (
    isRoot &&
    /^(preview|thumbnail|thumb|screenshot|poster|cover)\.(mp4|mov|webm|png|jpe?g|webp|gif)$/i.test(
      base
    )
  ) {
    return true;
  }
  return false;
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

/**
 * P35 — zip pack'dan yuklab-olishda chiqariladigan XAVFSIZ entry ro'yxati (yagona
 * manba: ingest yozadi, backfill qayta hisoblaydi). Tarkibi:
 *  (a) aniq axlat/marketing — `junkEntries` (isMarketingJunkEntry),
 *  (b) tanlangan preview/thumb entrylari — LEKIN faqat ular MANBA (footage/assets/
 *      elements/…) papkasida BO'LMASA. Manba papkasidagi media pack loyihasi
 *      (.aep/.mogrt) HAVOLA qilgan kontent bo'lishi mumkin — uni HECH QACHON strip
 *      qilmaymiz (P35.3 — "never risks deleting real footage the .aep references").
 */
export function computePackJunkEntries(
  zip: Pick<StreamingIngestZip, "image" | "video" | "junkEntries">
): string[] {
  const out = new Set<string>();
  for (const n of zip.junkEntries) if (n) out.add(n);
  for (const ref of [zip.image, zip.video]) {
    const name = ref?.entry.fileName;
    if (name && !SOURCE_DIR_RE.test(name)) out.add(name);
  }
  return Array.from(out);
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
  /** P35 — DOIMO-XAVFSIZ axlat/marketing entry nomlari (isMarketingJunkEntry).
   *  Tanlangan preview/thumb entry nomlaridan ALOHIDA — chaqiruvchi ularni
   *  qo'shib `metaJson.packJunkEntries` ro'yxatini quradi. */
  junkEntries: string[];
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
      let templateApp = DEFAULT_APP;
      // P19: rasm/video NOMZODLARINI yig'amiz (faqat metadata — extract yo'q), end'da eng yaxshisini
      // skorlash bilan tanlaymiz. Pack esa avvalgidek first-match.
      const imageCandidates: MediaCandidate[] = [];
      const videoCandidates: MediaCandidate[] = [];
      // P35 — yuklab-olish nusxasidan chiqariladigan aniq axlat/marketing entrylar.
      const junkEntries: string[] = [];
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
        // P35 — aniq axlat/marketing entrylarni ro'yxatga olamiz (yuklab-olishdan
        // chiqarish uchun); bular preview/thumb NOMZODI ham bo'lmaydi (isJunkEntry).
        if (isMarketingJunkEntry(name)) junkEntries.push(name);
        if (!/\/$/.test(name) && !isJunkEntry(name)) {
          const ext = path.extname(name).toLowerCase();
          if (!pack && PACK_EXT_APP[ext]) {
            pack = { entry, ext };
            templateApp = PACK_EXT_APP[ext];
          } else if (IMAGE_EXTS.includes(ext)) {
            imageCandidates.push({ entry, ext, name });
          } else if (VIDEO_EXTS.includes(ext)) {
            videoCandidates.push({ entry, ext, name });
          }
        }
        zip.readEntry();
      });
      zip.on("end", () => {
        if (settled) return;
        settled = true;
        // P19: end'da eng yaxshi preview rasm/videoni skorlash bilan tanlaymiz (Help.mp4 emas,
        // (Footage)/… emas — "Preview Video/Image" afzal). Faqat tanlangan entry keyin stream qilinadi.
        const image = pickBestMedia(imageCandidates, false);
        const video = pickBestMedia(videoCandidates, true);
        resolve({
          pack,
          image,
          video,
          templateApp,
          junkEntries,
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

/**
 * P35 — Zipni RANGED o'qishlar ustida STREAMING nusxalaydi, `exclude` to'plamidagi
 * entry nomlarini (aniq nom mosligi) TASHLAB. Cho'qqi xotira
 * `openStreamingIngestZip` bilan bir xil intizom: markaziy katalog keshi + BITTA
 * ochiq entry stream (har entry to'liq o'qilgach keyingisiga o'tamiz — bir vaqtda
 * bitta ranged GAT soketi). yazl chiqishi chaqiruvchi tomonidan (uploadStreamToS3)
 * iste'mol qilinishi SHART — aks holda blok. Chaqiruvchi `target.outputStream`ni
 * OLDIN pipe qilib, so'ng bu funksiyani await qilsin; funksiya oxirida `target.end()`
 * chaqiriladi. Papka entrylari o'tkaziladi (yazl yo'lni fayl nomidan tiklaydi).
 */
export async function copyZipExcluding(
  source: RangedZipSource,
  exclude: Set<string>,
  target: yazl.ZipFile
): Promise<{ copied: number; dropped: number }> {
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

  let copied = 0;
  let dropped = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (e: Error) => {
        if (settled) return;
        settled = true;
        reject(classifyZipError(e));
      };
      zip.on("entry", (entry: yauzl.Entry) => {
        if (settled) return;
        const name = entry.fileName;
        // Papka entrylari — yazl yo'l strukturasini fayllar yo'lidan tiklaydi.
        if (/\/$/.test(name)) {
          zip.readEntry();
          return;
        }
        const norm = name.replace(/\\/g, "/");
        if (exclude.has(name) || exclude.has(norm)) {
          dropped++;
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (err, rs) => {
          if (err || !rs) {
            fail(err ?? new Error("Zip entry stream failed"));
            return;
          }
          rs.on("error", (e) => fail(e));
          // Faqat stream TO'LIQ iste'mol qilingach keyingi entryga o'tamiz —
          // bir vaqtning o'zida bitta ochiq ranged stream.
          rs.on("end", () => {
            if (settled) return;
            copied++;
            zip.readEntry();
          });
          // Store (compress:false): pack ichidagi media allaqachon siqilgan —
          // qayta siqish CPU'ni behuda sarflaydi; size berilmaydi → yazl data
          // descriptor ishlatadi (e'lon/haqiqiy hajm nomuvofiqligi throw'idan xoli).
          target.addReadStream(rs, name, {
            mtime: entry.getLastModDate(),
            compress: false,
          });
        });
      });
      zip.on("end", () => {
        if (settled) return;
        settled = true;
        resolve();
      });
      zip.on("error", (e: Error) => fail(e));
      zip.readEntry();
    });
    target.end();
    return { copied, dropped };
  } finally {
    try {
      zip.close();
    } catch {}
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
