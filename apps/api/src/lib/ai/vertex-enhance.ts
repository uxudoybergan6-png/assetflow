// Google Vertex AI — Gemini ko'p-modal "Yaxshilash" (enhance) adapteri, TO'G'RIDAN-TO'G'RI.
// ADC orqali (Cloud Run service account / lokal `gcloud auth application-default login`).
//
// ILGARI (fal + OpenRouter + NVIDIA) enhance 3 vendor / 4 model ishlatardi:
//   rasm → openrouter/router/vision (gemini-2.5-flash), video → fal-ai/video-understanding,
//   audio → nvidia/nemotron-3-nano-omni/audio, keyin openrouter/router (gemini-2.5-flash) jamlardi.
// ENDI: hammasi BITTA Gemini generateContent chaqiruvi. Gemini 2.5 Flash tabiiy ko'p-modal —
// matn + rasm + video + audio'ni BIRGA ko'rib, foydalanuvchi promti bilan BITTA ma'noga jamlaydi
// (vositasiz, Google $300 kreditidan). Region us-central1 (rasm loyihasi = [[vertex-image.ts]]).
//
// gemini-2.5-flash Vertex'da image+video+audio input, text out qo'llaydi (describe endpoint
// 2026-06-18 jonli tasdiqlagan). SDK sxemasi node_modules/@google/genai@2.10.0 .d.ts'dan:
//   generateContent({ model, contents:[{role,parts}], config:{ systemInstruction, responseMimeType,
//   maxOutputTokens, temperature } }) → response.text (matn), Part: inlineData{data,mimeType}|text.
import { GoogleGenAI } from "@google/genai";
import type { OrResult } from "./openrouter.js";
import { gcsUriFromUrl, gcsKeyFromUrl, getS3ObjectMeta } from "../s3.js";

// Fallback (2026-07-01): GitHub Actions deploy env secret'ida Google var yo'qligi sabab
// VERTEX_NOT_CONFIGURED qayta-qayta chiqardi. Loyiha ID maxfiy emas (deploy config'da ochiq).
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "project-289028d3-984c-4d84-bd4";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
// Ko'p-modal TAHLIL modeli — matn chiqishli (rasm generatsiya EMAS). 2.5 Flash image+video+audio in.
const ENHANCE_MODEL = "gemini-2.5-flash";

// Referens yetkazish — IKKI YO'L (katta/uzun video ham qo'llab-quvvatlanadi):
//  1) BIZNING GCS bucket'dagi referens (assetflow-assets-2026, S3_ENDPOINT=storage.googleapis.com) →
//     gs:// fileData. So'rov TANASIGA KIRMAYDI → HAJM CHEGARASI YO'Q (uzun/katta video ham). mimeType
//     HeadObject'dan (getS3ObjectMeta — taxmin YO'Q). Enhance rasm loyihasida (GOOGLE_CLOUD_PROJECT),
//     bucket ham shu loyihada → Vertex gs:// o'qiydi (Veo shu bucket'ga gs:// yozgani jonli tasdiqlangan).
//  2) TASHQI URL / data-URI → inline base64 (haqiqiy content-type). Vertex inline chegarasi SO'ROV
//     TANASI (base64) ustida ~20MB — shu sabab cap base64 UZUNLIGIDA: per-ref 16MB, umumiy 18MB. Oshsa
//     o'sha referens tashlanadi (promptga izoh). gs:// refs bu budjetga KIRMAYDI (URI kичик).
// Budjet fetch'lardan KEYIN SINXRON, DETERMINISTIK o'tkaziladi (poyga yo'q).
const PER_REF_MAX_B64 = 16 * 1024 * 1024;
const TOTAL_B64_MAX = 18 * 1024 * 1024;

export function isVertexEnhanceConfigured(): boolean {
  return Boolean(PROJECT);
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION });
  return client;
}

type RefKind = "image" | "video" | "audio";
const DEFAULT_MIME: Record<RefKind, string> = {
  image: "image/png",
  video: "video/mp4",
  audio: "audio/mpeg",
};
// Yechilgan referens: inline (base64 — budjetga kiradi) YOKI gcs (gs:// URI — budjetsiz, katta fayl).
type ResolvedRef =
  | { kind: RefKind; idx: number; mode: "inline"; data: string; mimeType: string }
  | { kind: RefKind; idx: number; mode: "gcs"; fileUri: string; mimeType: string };

// mimeType'ni trim + `type/subtype` validatsiya; yaroqsiz bo'lsa kind default (Gemini'ga yaroqli mime).
function validMime(raw: string | undefined, kind: RefKind): string {
  const mt = (raw || "").trim();
  return /^[\w.+-]+\/[\w.+-]+$/.test(mt) ? mt : DEFAULT_MIME[kind];
}

/** Bitta referens URL → ResolvedRef. Bizning GCS bucket → gs:// (yuklab OLINMAYDI, hajm chegarasiz);
 * data-URI/tashqi URL → inline base64 (haqiqiy content-type). Xato/mavjud emas → null. Budjet BU YERDA EMAS. */
async function resolveRef(url: string, kind: RefKind, idx: number): Promise<ResolvedRef | null> {
  // data-URI → inline (mimeType trim + validatsiya, aks holda default)
  const dm = /^data:([^;]+);base64,([\s\S]*)$/.exec(url);
  if (dm) return { kind, idx, mode: "inline", data: dm[2].replace(/\s+/g, ""), mimeType: validMime(dm[1], kind) };
  // Bizning GCS bucket → gs:// fileData (hajm chegarasi yo'q). mimeType HeadObject'dan (taxmin yo'q).
  const gsUri = gcsUriFromUrl(url);
  if (gsUri) {
    const key = gcsKeyFromUrl(url);
    const meta = key ? await getS3ObjectMeta(key) : { contentType: null, sizeBytes: null };
    // Obyekt MAVJUDLIGINI tasdiqla: HeadObject sizeBytes qaytarsa bor. YO'Q bo'lsa (o'chirilgan yoki
    // o'qib bo'lmaydi) → SKIP (null) — tashqi 404'dek muloyim degradatsiya. Aks holda Vertex yo'q
    // gs:// obyektni o'qishga urinib BUTUN enhance'ni yiqitardi (audit #2). null → filtrlanadi + sanaladi.
    if (meta.sizeBytes == null) return null;
    return { kind, idx, mode: "gcs", fileUri: gsUri, mimeType: validMime(meta.contentType || undefined, kind) };
  }
  // Tashqi URL → yuklab olib inline (haqiqiy content-type)
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = validMime(res.headers.get("content-type") || undefined, kind);
    return { kind, idx, mode: "inline", data: buf.toString("base64"), mimeType: ct };
  } catch {
    return null;
  }
}

/**
 * "Yaxshilash" — foydalanuvchi promti + referens (rasm/video/audio) BITTA Gemini chaqiruvida
 * ko'p-modal tahlil qilinib, yakuniy promptga jamlanadi. KIRISH TILINI saqlaydi, faqat yakuniy
 * promptni qaytaradi. falEnhancePrompt bilan bir xil imzo (drop-in almashtirish).
 */
export async function vertexEnhancePrompt(
  text: string,
  opts?: {
    imageUrls?: string[];
    videoUrls?: string[];
    audioUrls?: string[];
    mode?: string;
    modelContext?: string;
  }
): Promise<OrResult<string>> {
  if (!isVertexEnhanceConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  const isHttp = (u: unknown): u is string => typeof u === "string" && /^(https?:\/\/|data:)/i.test(u);
  const imgs = (opts?.imageUrls || []).filter(isHttp);
  const vids = (opts?.videoUrls || []).filter(isHttp);
  const auds = (opts?.audioUrls || []).filter(isHttp);
  const mode = String(opts?.mode || "image").toLowerCase() === "video" ? "video" : "image";

  const role =
    mode === "video"
      ? "Sen video generatsiyasi uchun prompt muhandisisan."
      : "Sen tasvir generatsiyasi uchun prompt muhandisisan.";
  const detailHint =
    mode === "video"
      ? "Qisqa g'oyani bitta boy, aniq video promptga aylantir (subyekt, kamera harakati, kompozitsiya, yorug'lik, atmosfera, detal)."
      : "Qisqa g'oyani bitta boy, tafsilotli promptga aylantir (kompozitsiya, yorug'lik, uslub, detal).";
  const tokenHint =
    " @img/@image/@video/@audio tokenlarini bo'lsa XUDDI O'ZICHA saqla, nomini o'zgartirma va olib tashlama.";
  const safetyHint =
    mode === "video"
      ? " Safety: referenslarda odam bo'lsa ham promptni xavfsiz tut. Yalang'ochlik, shirtless/topless, bare chest, tana qismlariga ortiqcha urg'u, sexual yoki erotik iboralar yozma. `full body` o'rniga `full figure`, `body parts` o'rniga `appearance details`, `muscular` o'rniga `athletic`, `torso/chest` o'rniga `upper silhouette/frame` kabi xavfsizroq til ishlat. Kiyim, harakat, kamera va atmosfera ustun bo'lsin."
      : "";
  const modelContext = opts?.modelContext ? ` ${opts.modelContext}` : "";

  const systemInstruction =
    `${role} ${detailHint} ` +
    "Sengga foydalanuvchi matni va (bo'lsa) referens media beriladi: rasmlar @img1, @img2..., " +
    "videolar @video1..., audiolar @audio1... tartibida. Referens media va foydalanuvchi matnini BIRGA " +
    "tahlil qilib, ularni BITTA yaxlit ma'noga jamlagan, ishlatishga tayyor yagona yakuniy prompt yoz. " +
    "Har bir referensdan faqat prompt uchun foydali kuzatuvlarni (subyekt, kompozitsiya, uslub, material, " +
    "rang, yorug'lik, fon, kayfiyat; video uchun harakat, kamera, temp, o'tishlar; audio uchun kayfiyat, " +
    "ritm, ohang, instrument) ol. Agar referens va matn ziddiyatli bo'lsa, foydalanuvchi matnini USTUN qo'y. " +
    `KIRISH TILINI saqla.${tokenHint}${safetyHint}${modelContext} ` +
    "Faqat yakuniy promptni qaytar — hech qanday sarlavha, izoh, referens tahlili, ro'yxat yoki metadata yozma.";

  // 1) Barcha referenslarni PARALLEL yech (Promise.all TARTIBNI saqlaydi: rasm→video→audio, har biri
  //    o'z guruhida idx bilan). Yuklab bo'lmadi/mavjud emas → null (filtrlanadi). Budjet BU YERDA EMAS.
  const totalRefs = imgs.length + vids.length + auds.length;
  const resolved = (
    await Promise.all([
      ...imgs.map((u, i) => resolveRef(u, "image", i)),
      ...vids.map((u, i) => resolveRef(u, "video", i)),
      ...auds.map((u, i) => resolveRef(u, "audio", i)),
    ])
  ).filter((r): r is ResolvedRef => r !== null);
  const droppedAtLoad = totalRefs - resolved.length; // yuklab bo'lmadi yoki obyekt mavjud emas

  // 2) SINXRON, DETERMINISTIK budjet o'tkazish (poyga yo'q). gs:// (mode:gcs) → so'rov tanasiga
  //    kirmaydi, HAJM CHEGARASI YO'Q (katta/uzun video). inline → cap = base64 UZUNLIGI (aynan
  //    so'rovga ketadigan hajm). @imgN/@videoN/@audioN yorlig'i idx'dan (tashlansa ham raqam barqaror).
  const parts: Array<
    | { inlineData: { data: string; mimeType: string } }
    | { fileData: { fileUri: string; mimeType: string } }
    | { text: string }
  > = [];
  let usedB64 = 0;
  let skipped = 0;
  for (const r of resolved) {
    const tag = r.kind === "image" ? "img" : r.kind; // @img1 / @video1 / @audio1
    const label = `@${tag}${r.idx + 1} (referens):`;
    if (r.mode === "gcs") {
      // gs:// — hajm chegarasisiz (uzun/katta video). Budjetga kirmaydi.
      parts.push({ text: label });
      parts.push({ fileData: { fileUri: r.fileUri, mimeType: r.mimeType } });
      continue;
    }
    const cost = r.data.length; // base64 belgilar soni ≈ so'rov tanasidagi bayt
    if (cost > PER_REF_MAX_B64 || usedB64 + cost > TOTAL_B64_MAX) {
      skipped++;
      continue;
    }
    usedB64 += cost;
    parts.push({ text: label });
    parts.push({ inlineData: { data: r.data, mimeType: r.mimeType } });
  }

  // Halol eslatma: yuklab bo'lmagan/mavjud emas (droppedAtLoad) + juda katta (skipped) — ikkalasi ham.
  const missing = droppedAtLoad + skipped;
  const skipNote = missing
    ? `\n\n(eslatma: ${missing} ta referens yuklanmadi yoki juda katta bo'lgani uchun tahlilga kirmadi — matn asosida davom et.)`
    : "";
  parts.push({ text: `Foydalanuvchi so'rovi: ${text}${skipNote}` });

  try {
    const r = await getClient().models.generateContent({
      model: ENHANCE_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 700,
      },
    });
    const out = (r.text || "").trim();
    if (!out) return { ok: false, error: "Vertex enhance bo'sh javob qaytardi" };
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex enhance xatosi" };
  }
}

/**
 * JSON-format enhance — g'oyani strukturalangan (kinematografik) JSON promptga aylantiradi.
 * ILGARI OpenRouter gpt-4o-mini (orChatSys jsonMode) ishlatardi — endi Gemini responseMimeType JSON.
 * `system` — to'liq ko'rsatma (schema bilan), `userIdea` — (kerak bo'lsa avval enhance qilingan) g'oya.
 */
export async function vertexEnhanceJson(system: string, userIdea: string): Promise<OrResult<string>> {
  if (!isVertexEnhanceConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  try {
    const r = await getClient().models.generateContent({
      model: ENHANCE_MODEL,
      contents: [{ role: "user", parts: [{ text: `Idea: ${userIdea}` }] }],
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 900,
      },
    });
    const out = (r.text || "").trim();
    if (!out) return { ok: false, error: "Vertex JSON enhance bo'sh javob qaytardi" };
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex JSON enhance xatosi" };
  }
}
