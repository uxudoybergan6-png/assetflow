// Google Cloud Text-to-Speech — Chirp 3 HD adapter (BATCH4 #4, Kokoro/OpenRouter o'rniga).
// Auth ADC orqali (Cloud Run service account / lokal `gcloud auth application-default login`) —
// vertex-omni.ts naqshi bilan BIR XIL (GoogleAuth + Bearer + x-goog-user-project).
//
// Endpoint: POST https://texttospeech.googleapis.com/v1/text:synthesize
//   { input:{text}, voice:{languageCode,name}, audioConfig:{audioEncoding:"MP3"} } → { audioContent: base64 }
// Chirp 3 HD ovozlari SSML/pitch QO'LLAMAYDI — faqat oddiy matn.
// Narx: $0.00003/belgi ($30/1M) — katalogdagi maxChars cap + flat kredit bilan himoyalangan
// (route /gen pre-consume guard; bu adapter ham qat'iy kesadi — hech qachon cap'dan oshiq yubormaydi).
import { GoogleAuth } from "google-auth-library";
import type { OrResult } from "./openrouter.js";
import { fetchWithTimeout, PROVIDER_TIMEOUT_MS } from "./fetch-timeout.js";

// vertex-image.ts bilan bir xil fallback (loyiha ID maxfiy emas — deploy config'da ochiq).
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "project-289028d3-984c-4d84-bd4";
const TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
// Google cheklovi: so'rov input'i ≤5000 bayt. Katalog maxChars (1000) bundan ancha kichik —
// bu yerdagi kesim faqat himoya kamari (eski/g'ayrioddiy chaqiruvchilar uchun).
const HARD_INPUT_CHARS = 4000;

export function isGoogleTtsConfigured(): boolean {
  return Boolean(PROJECT);
}

let auth: GoogleAuth | null = null;
async function getToken(): Promise<string> {
  if (!auth) auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error("TTS: could not get ADC access token");
  return t.token;
}

/** Ovoz nomidan locale ("en-US-Chirp3-HD-Aoede" → "en-US"). Chirp nomlash naqshi barqaror. */
function languageCodeOf(voiceName: string): string {
  const m = /^([a-z]{2,3}-[A-Za-z]{2,4})-/.exec(String(voiceName || ""));
  return m ? m[1] : "en-US";
}

/** Matn → mp3 Buffer (Chirp 3 HD). voiceName = to'liq Google ovoz nomi (katalog voices[].id). */
export async function googleTtsSynthesize(
  voiceName: string,
  text: string
): Promise<OrResult<Buffer>> {
  if (!isGoogleTtsConfigured()) return { ok: false, error: "GOOGLE_TTS_NOT_CONFIGURED" };
  const input = String(text || "").slice(0, HARD_INPUT_CHARS);
  if (!input.trim()) return { ok: false, error: "TTS: text is empty" };
  try {
    const token = await getToken();
    const res = await fetchWithTimeout(TTS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-goog-user-project": PROJECT,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text: input },
        voice: { languageCode: languageCodeOf(voiceName), name: voiceName },
        audioConfig: { audioEncoding: "MP3" },
      }),
    }, PROVIDER_TIMEOUT_MS); // P27 — TTS sintez: bounded
    const raw = await res.text();
    if (!res.ok) {
      // Eng ko'p uchraydigan sozlama xatosi — API yoqilmagan: foydalanuvchiga aniq ko'rsatma.
      if (res.status === 403 && /SERVICE_DISABLED|has not been used|is disabled/i.test(raw)) {
        return { ok: false, error: "Cloud Text-to-Speech API is not enabled on the GCP project — enable texttospeech.googleapis.com", status: 403 };
      }
      return { ok: false, error: `TTS ${res.status}: ${raw.slice(0, 300)}`, status: res.status };
    }
    const json = JSON.parse(raw) as { audioContent?: string };
    if (!json.audioContent) return { ok: false, error: "TTS: no audio was returned" };
    return { ok: true, data: Buffer.from(json.audioContent, "base64") };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Google TTS error" };
  }
}
