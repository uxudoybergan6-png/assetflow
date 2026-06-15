/**
 * ElevenLabs — Sound Effects (SFX) generatsiya. OpenRouter SFX'ni qoplamaydi.
 * Endpoint: POST /v1/sound-generation → RAW audio (mp3) qaytaradi.
 * Kalit: ELEVENLABS_API_KEY (faqat backend env).
 */
const BASE = "https://api.elevenlabs.io/v1";
const KEY = process.env.ELEVENLABS_API_KEY ?? "";

export function isElevenLabsConfigured(): boolean {
  return Boolean(KEY);
}

export type ElResult =
  | { ok: true; data: Buffer }
  | { ok: false; error: string; status?: number };

const NOT_CONFIGURED: ElResult = { ok: false, error: "ELEVENLABS_NOT_CONFIGURED" };

/**
 * Matn → tovush effekti. duration 0.5–22s (berilmasa model avto tanlaydi).
 * RAW mp3 bayt qaytaradi (JSON emas) — orSpeech naqshiga o'xshash.
 */
export async function elSoundEffects(
  prompt: string,
  durationSeconds?: number
): Promise<ElResult> {
  if (!isElevenLabsConfigured()) return NOT_CONFIGURED;
  const body: Record<string, unknown> = { text: prompt, prompt_influence: 0.4 };
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
    body.duration_seconds = Math.max(0.5, Math.min(22, durationSeconds));
  }
  const res = await fetch(BASE + "/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `ElevenLabs HTTP ${res.status}`;
    try {
      const t = await res.text();
      if (t) {
        try {
          const j = JSON.parse(t) as { detail?: { message?: string } | string; message?: string };
          msg =
            (typeof j?.detail === "string" ? j.detail : j?.detail?.message) ||
            j?.message ||
            t.slice(0, 200);
        } catch {
          msg = t.slice(0, 200);
        }
      }
    } catch {
      /* ignore */
    }
    return { ok: false, error: String(msg), status: res.status };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) return { ok: false, error: "Bo'sh audio" };
  return { ok: true, data: buf };
}
