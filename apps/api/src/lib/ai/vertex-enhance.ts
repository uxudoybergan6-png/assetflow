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

// Fallback (2026-07-01): GitHub Actions deploy env secret'ida Google var yo'qligi sabab
// VERTEX_NOT_CONFIGURED qayta-qayta chiqardi. Loyiha ID maxfiy emas (deploy config'da ochiq).
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "project-289028d3-984c-4d84-bd4";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
// Ko'p-modal TAHLIL modeli — matn chiqishli (rasm generatsiya EMAS). 2.5 Flash image+video+audio in.
const ENHANCE_MODEL = "gemini-2.5-flash";

// INLINE-ONLY (base64) — haqiqiy content-type bilan, isbotlangan naqsh (describe endpoint video'ni
// base64 16MB'gача yuboradi va gemini-2.5-flash qabul qiladi). gs:// fileData ISHLATILMAYDI: bucket
// turi (GCS/R2) + mimeType taxminidan qochish uchun (100% to'g'rilik).
//
// MUHIM: Vertex inline chegarasi SO'ROV TANASI (base64) ustida (~20MB) — XOM bayt EMAS. Shu sabab
// cap'lar base64 UZUNLIGIDA o'lchanadi (aynan so'rovga ketadigan hajm). Budjet YIG'IB HISOBLANADI
// (fetch'lar parallel, lekin budjet o'tkazish fetch'lardan KEYIN, SINXRON va DETERMINISTIK tartibda
// — poyga yo'q, qaysi referens tashlanishi barqaror). Oshsa — o'sha referens tashlab, promptga izoh.
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
// Yuklab olingan xom referens (base64), budjet o'tkazishga tayyor. idx — kind ichidagi tartib (@imgN).
type RawRef = { kind: RefKind; idx: number; data: string; mimeType: string };

/** Bitta referens URL → xom base64 (haqiqiy content-type bilan). data-URI to'g'ridan; URL → yuklab
 * olinadi. Xato → null. Budjet BU YERDA TEKSHIRILMAYDI (fetch'dan keyin sinxron o'tkaziladi). */
async function fetchRef(url: string, kind: RefKind, idx: number): Promise<RawRef | null> {
  const dm = /^data:([^;]+);base64,([\s\S]*)$/.exec(url);
  if (dm) return { kind, idx, data: dm[2].replace(/\s+/g, ""), mimeType: dm[1] || DEFAULT_MIME[kind] };
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || DEFAULT_MIME[kind];
    return { kind, idx, data: buf.toString("base64"), mimeType: ct };
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

  // 1) Barcha referenslarni PARALLEL yuklab ol (Promise.all TARTIBNI saqlaydi: rasm→video→audio,
  //    har biri o'z guruhida idx bilan). Fetch xatosi → null (filtrlanadi). Budjet BU YERDA EMAS.
  const raw = (
    await Promise.all([
      ...imgs.map((u, i) => fetchRef(u, "image", i)),
      ...vids.map((u, i) => fetchRef(u, "video", i)),
      ...auds.map((u, i) => fetchRef(u, "audio", i)),
    ])
  ).filter((r): r is RawRef => r !== null);

  // 2) SINXRON, DETERMINISTIK budjet o'tkazish (poyga yo'q). Cap = base64 UZUNLIGI (aynan so'rovga
  //    ketadigan hajm). @imgN/@videoN/@audioN yorlig'i idx'dan (referens tashlansa ham raqam barqaror).
  const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [];
  let usedB64 = 0;
  let skipped = 0;
  for (const r of raw) {
    const cost = r.data.length; // base64 belgilar soni ≈ so'rov tanasidagi bayt
    if (cost > PER_REF_MAX_B64 || usedB64 + cost > TOTAL_B64_MAX) {
      skipped++;
      continue;
    }
    usedB64 += cost;
    const tag = r.kind === "image" ? "img" : r.kind; // @img1 / @video1 / @audio1
    parts.push({ text: `@${tag}${r.idx + 1} (referens):` });
    parts.push({ inlineData: { data: r.data, mimeType: r.mimeType } });
  }

  const skipNote = skipped
    ? `\n\n(eslatma: ${skipped} ta referens juda katta bo'lgani uchun tahlilga kirmadi — matn asosida davom et.)`
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
