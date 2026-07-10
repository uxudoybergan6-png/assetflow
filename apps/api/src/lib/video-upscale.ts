/**
 * VIDEO UPSCALE derivatsiyasi (BATCH4 #2) — MONEY-ZONE'GA TEGMAYDI.
 *
 * fal Topaz narxi CHIQISH videoning soniyasiga, rezolyutsiya-tier'li. Tier'ni KLIENT EMAS,
 * SERVER aniqlaydi: manba video metasi (ffprobe, signed URL orqali) × faktor → chiqish tier;
 * billing soniya = ceil(duration) (60fps chiqishda ×2 — fal qoidasi). Natija params'ga
 * (resolution/duration) YOZILADI va imzolangan cost-quote hash'iga kiradi → klient narxni
 * soxtalashtira olmaydi (MAVJUD computeGenCost perSec[res]×duration formulasi o'zgarishsiz).
 *
 * Manba FAQAT o'z obyektlari: gen/<uid>/... (gen natijasi) yoki gen-refs/<uid>/... (yuklama).
 * Probe natijasi qisqa TTL bilan keshlanadi (quote → /gen orasida ikkinchi ffprobe bo'lmaydi).
 */
import { getSignedDownloadUrl, gcsKeyFromUrl, isS3Configured } from "./s3.js";
import { probeVideoMetaUrl } from "./optimize-preview.js";

// fal Topaz cheklovi bizda: billing 300s (5 daq) dan oshmasin — narx/latensiya jilovi.
const MAX_BILLED_SEC = 300;
// 60fps qoidasi: chiqish fps manba fps'i (target_fps yubormaymiz) — >40fps manba = 60fps tarif (×2).
const HIGH_FPS_THRESHOLD = 40;

type ProbeMeta = { width: number; height: number; durationSec: number; fps: number };
const probeCache = new Map<string, { at: number; meta: ProbeMeta }>();
const PROBE_TTL_MS = 10 * 60 * 1000;

export type UpscaleDerived = {
  ok: true;
  sourceKey: string;
  factor: 2 | 4;
  resolution: "720p" | "1080p" | "4k";
  duration: number; // billing soniya (60fps bo'lsa ×2 kiritilgan)
  meta: ProbeMeta;
  fpsDoubled: boolean;
};
export type UpscaleDeriveError = { ok: false; status: number; error: string; code: string };

/** params.sourceKey / params.sourceUrl → o'z storage kaliti (egalik tekshirilgan). */
export function resolveUpscaleSourceKey(
  userId: string,
  params: Record<string, unknown>
): { ok: true; key: string } | UpscaleDeriveError {
  let key = typeof params.sourceKey === "string" ? params.sourceKey.trim() : "";
  if (!key && typeof params.sourceUrl === "string") key = gcsKeyFromUrl(params.sourceUrl) || "";
  if (!key) {
    return { ok: false, status: 400, error: "Pick a source video (a generation or an upload) to upscale", code: "UPSCALE_SOURCE_REQUIRED" };
  }
  // FAQAT o'z obyektlari (ref-upload srcUrl qoidasi bilan bir xil) — begona kalit bilan
  // boshqa foydalanuvchi videosini upscale qilib bo'lmaydi.
  if (!key.startsWith(`gen/${userId}/`) && !key.startsWith(`gen-refs/${userId}/`)) {
    return { ok: false, status: 403, error: "This source does not belong to you", code: "UPSCALE_SOURCE_FORBIDDEN" };
  }
  return { ok: true, key };
}

/** Chiqish tier: kichik tomon × faktor bo'yicha (720p/1080p/4k — perSec kalitlari bilan mos). */
function outputTier(meta: ProbeMeta, factor: 2 | 4): "720p" | "1080p" | "4k" {
  const outMin = Math.min(meta.width, meta.height) * factor;
  if (outMin <= 720) return "720p";
  if (outMin <= 1080) return "1080p";
  return "4k";
}

/**
 * Derivatsiya: manba meta (kesh yoki ffprobe) → {resolution, duration}. Deterministik —
 * cost-quote HAM /gen HAM bir xil natija oladi (kesh + o'zgarmas GCS obyekt).
 */
export async function deriveVideoUpscaleParams(
  userId: string,
  params: Record<string, unknown>
): Promise<UpscaleDerived | UpscaleDeriveError> {
  if (!isS3Configured()) {
    return { ok: false, status: 503, error: "Storage not configured", code: "S3_NOT_CONFIGURED" };
  }
  const src = resolveUpscaleSourceKey(userId, params);
  if (!src.ok) return src;
  const fRaw = Number(params.factor);
  const factor: 2 | 4 = fRaw === 4 ? 4 : 2;

  let meta: ProbeMeta | null = null;
  const cached = probeCache.get(src.key);
  if (cached && Date.now() - cached.at < PROBE_TTL_MS) meta = cached.meta;
  if (!meta) {
    let url: string;
    try {
      url = await getSignedDownloadUrl(src.key, 600);
    } catch {
      return { ok: false, status: 404, error: "Source video not found — upload it again", code: "UPSCALE_SOURCE_NOT_FOUND" };
    }
    meta = await probeVideoMetaUrl(url);
    if (!meta) {
      return { ok: false, status: 400, error: "Could not read the source video (is it a valid video file?)", code: "UPSCALE_PROBE_FAILED" };
    }
    probeCache.set(src.key, { at: Date.now(), meta });
    // Kesh o'smasin — eng eski yozuvlarni tozalash (oddiy chegara).
    if (probeCache.size > 500) {
      const oldest = [...probeCache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100);
      for (const [k] of oldest) probeCache.delete(k);
    }
  }

  const fpsDoubled = meta.fps > HIGH_FPS_THRESHOLD; // fal: 60fps chiqish = ×2 narx
  const billed = Math.ceil(meta.durationSec) * (fpsDoubled ? 2 : 1);
  if (billed > MAX_BILLED_SEC) {
    return {
      ok: false,
      status: 400,
      error: `Source video is too long for upscaling — max ${fpsDoubled ? MAX_BILLED_SEC / 2 : MAX_BILLED_SEC}s${fpsDoubled ? " for 60fps sources" : ""} (yours: ${Math.ceil(meta.durationSec)}s)`,
      code: "UPSCALE_TOO_LONG",
    };
  }
  return {
    ok: true,
    sourceKey: src.key,
    factor,
    resolution: outputTier(meta, factor),
    duration: Math.max(1, billed),
    meta,
    fpsDoubled,
  };
}

/**
 * params'ni KANONIK shaklga keltiradi (quote ham /gen ham shu bilan hash oldidan chaqiradi):
 * sourceKey/factor/resolution/duration server qiymatlari bilan YOZILADI, sourceUrl (signed,
 * beqaror satr) O'CHIRILADI. Shu tufayli klient quote'dagi pricedParams'ni AYNAN qaytarsa
 * imzo mos keladi; qiymatlarni o'zgartirsa BAD_QUOTE.
 */
export function canonicalizeUpscaleParams(
  params: Record<string, unknown>,
  d: UpscaleDerived
): void {
  params.sourceKey = d.sourceKey;
  params.factor = d.factor;
  params.resolution = d.resolution;
  params.duration = d.duration;
  delete params.sourceUrl;
}
