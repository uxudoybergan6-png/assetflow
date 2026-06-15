# RESEARCH NATIJASI — AE Timeline → Gemini 2.5 Pro → AI SFX (auto-sync)

*Deep-research natijasi. Har texnik da'vo rasmiy manbalardan tekshirilgan (2026-iyun holati).*
*Manbalar oxirida. "⚠️ Flag" — to'liq tasdiqlanmagan yoki ehtiyot kerak joylar.*

---

## 0. UMUMIY XULOSA (verdict)

**Funksiya to'liq bajariladi.** Hech bir bo'g'in texnik to'siqqa duch kelmaydi. Lekin **ikki xil arxitektura** bor va tanlash kerak:

| Arxitektura | Mantiq | Kuchli tomoni | Zaif tomoni |
|---|---|---|---|
| **A — Gemini-plan** (siz so'ragan) | Gemini videoni tahlil qiladi → vaqt belgilangan SFX plan → ElevenLabs SFX generatsiya → AE'ga auto-sync | To'liq nazorat, "designed" SFX (whoosh/impact/braam), aniq davomiylik, musiqa-aware | Ko'p qadam, timing Gemini aniqligiga bog'liq (~±1s) |
| **B — Video-to-audio (foley)** | Videoni to'g'ridan **fal.ai MMAudio**'ga berasiz → u kadrlarga sinxron foley audio qaytaradi | Bitta qadam, kadrga **avtomatik sinxron**, juda arzon (~$0.001/s) | Abstrakt/designer SFX'da kuchsiz, ~8s klipga moslashgan, prompt nazorati kam |

**Tavsiya: ikkalasini birlashtir.** Asosiy oqim — **A (Gemini + ElevenLabs)** chunki "designed" kino SFX va aniq davomiylik beradi; **B (MMAudio)**'ni "ambient/foley to'ldirish" rejimi sifatida qo'sh. Bu Higgsfield qila olmaydigan ustunlik (timeline-grounded + musiqa-aware).

---

## A. AE/ExtendScript — oraliqni eksport qilish

**Verdict: bajariladi, lekin render usulini to'g'ri tanlash kritik.**

### Oraliqni o'qish (tasdiqlangan)
- `comp.workAreaStart` + `comp.workAreaDuration` — work area (soniya, float).
- `comp.frameRate`, `comp.frameDuration` (=1/fps), `comp.displayStartTime`, `comp.displayStartFrame` (AE 17.1+).
- Tanlangan layerlar: `comp.selectedLayers`, har birida `inPoint`/`outPoint` (mutlaq comp soniya).

### Render usuli — solishtirish
| Usul | AE UI bloklaydimi? | Fonда ishlaydimi? | Izoh |
|---|---|---|---|
| `renderQueue.render()` | **Ha — to'liq muzlaydi** (tasdiqlangan: tugaguncha qaytmaydi) | Yo'q | Faqat qisqa kliplar uchun |
| **`aerender` (child_process)** | Yo'q (alohida jarayon) | **Ha** ✅ | **Eng ishonchli.** ⚠️ MP4/H.264 chiqara olmaydi → ProRes/PCM MOV render → FFmpeg transcode |
| AME `queueInAME(false)` | Yo'q | Ha | Native MP4, lekin oxirgi preset'ni ishlatadi |
| `renderAsync()` | — | — | ⚠️ Hujjatlanmagan, ishonmang |

**Tavsiya:** CEP Node-enabled — `require('child_process').spawn` bilan **aerender**'ni fon jarayon qilib chaqir (`system.callSystem` o'zi bloklaydi, ishlatmang). `-s`/`-e` flag'lari bilan faqat oraliqni render qil. So'ng FFmpeg bilan Gemini/SFX API kutgan formatga o'tkaz.

```javascript
// Oraliqni RenderQueue bilan (qisqa klip uchun, in-process)
var comp = app.project.activeItem;
var fd = comp.frameDuration;
var rangeStart = comp.workAreaStart, rangeDur = comp.workAreaDuration;
var rq = app.project.renderQueue.items.add(comp);
// ⚠️ timeSpanStart non-integer soniyada xato beradi — KADRGA yaxlitla:
rq.timeSpanStart    = Math.round(rangeStart / fd) * fd;
rq.timeSpanDuration = Math.round(rangeDur   / fd) * fd;
var om = rq.outputModule(1);
om.applyTemplate("Lossless with Alpha");  // audio yoqilgan template ishlat
om.file = new File("/tmp/clip.mov");
app.project.renderQueue.render();         // BLOKLAYDI
```

### Audio eksport (⚠️ ehtiyot)
OutputModule'da alohida audio atribut **yo'q** — audio faqat **OM template** orqali yoki `getSettings()/setSettings()` map'i orqali boshqariladi. "Audio Output On" yoqilgan template ishlat. ⚠️ `setSettings()` dan keyin OM obyekti yaroqsiz bo'ladi — `rq.outputModule(1)` qayta ol. Audio kalit nomlarini runtime'da `getSettings(GetSettingsFormat.STRING).toSource()` bilan top.

### Timecode xaritalash (kritik — auto-sync uchun)
Render frame 0 = mutlaq comp time `workAreaStart`. `displayStartTime` faqat **ko'rsatiladigan** timecode'ni siljitadi, render boshini emas.
```
clipRelativeSeconds = absoluteCompSeconds - workAreaStart   // Gemini'ga yuborish
absoluteCompSeconds = clipRelativeSeconds + workAreaStart   // natijani qaytarish
```
**MUHIM:** `workAreaStart` ishlat, `displayStartTime` EMAS. Hamma vaqtni kadrga yaxlitla (`Math.round(t/fd)*fd`) — float drift va `timeSpanStart` xatosini oldini oladi.

---

## B. Gemini 2.5 Pro — video+audio tahlil

**Verdict: bajariladi. Sifat-aniqlik: vizual/mood/intensity uchun zo'r; aniq BPM/beat uchun ishonchsiz.**

### Video kirish (tasdiqlangan)
| Usul | Max hajm | Izoh |
|---|---|---|
| **File API** (upload→URI) | 20GB pullik / 2GB bepul | >20MB so'rov uchun tavsiya. **48 soatdan keyin avto o'chadi.** Bepul saqlash |
| Inline bytes | so'rov <20MB bo'lsa | Qisqa klip uchun (lekin File API xavfsizroq) |

**Tavsiya: File API** (audio+video birga, qayta ishlatish uchun).

### Audio (musiqa) tahlili — ⚠️ MUHIM cheklov
Gemini videoning **audio oqimini nativ tahlil qiladi** (1 Kbps mono, 32 token/s). **Mood, janr, instrument, energiya o'zgarishini** yaxshi tasvirlaydi. LEKIN ⚠️ **aniq BPM, kalit, beat-grid uchun ISHONCHSIZ** (mustaqil tadqiqotlar — Music Flamingo). Google rasmiy beat-aniqlik da'vosi yo'q.

**Yechim:** Mood/janr/intensity uchun Gemini'ga ishon; **aniq BPM/beat kerak bo'lsa** — ajratilgan audioga **librosa/aubio/Essentia** (DSP beat-tracker) qo'llab, raqamlarni Gemini plan'iga qo'sh.

### Timestamp aniqligi
- Gemini `MM:SS` timestamp qaytaradi (tasdiqlangan) — lekin **~±1s, kadr darajasida emas**.
- Default sampling **1 FPS**; `videoMetadata.fps` bilan o'zgartiriladi (masalan `fps:3` tez hodisalar uchun, token narxi proporsional oshadi).
- 10–30s klip uchun **fps: 2–4** muvozanat.

### Structured JSON (tasdiqlangan)
`responseMimeType: "application/json"` + `responseJsonSchema`. 2.5 Pro qo'llab-quvvatlaydi. ⚠️ Sintaksis kafolatlangan, semantika emas — har doim validatsiya qil.

```ts
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import { z } from "zod"; import { zodToJsonSchema } from "zod-to-json-schema";
const ai = new GoogleGenAI({}); // GEMINI_API_KEY

const cue = z.object({
  startSec: z.number(), endSec: z.number(),
  label: z.string(), sfxPrompt: z.string(),
  intensity: z.enum(["low","medium","high"]),
});
const plan = z.object({ cues: z.array(cue) });

const file = await ai.files.upload({ file: "clip.mp4", config: { mimeType: "video/mp4" }});
let f = await ai.files.get({ name: file.name });
while (f.state === "PROCESSING") { await new Promise(r=>setTimeout(r,2000)); f = await ai.files.get({name:file.name}); }

const res = await ai.models.generateContent({
  model: "gemini-2.5-pro",
  contents: createUserContent([
    { ...createPartFromUri(file.uri!, file.mimeType!), videoMetadata: { fps: 3 } },
    `Sound designer sifatida HAM vizual HAM musiqani tahlil qil. Har muhim
     lahza (kesim, zarba, harakat, energiya o'zgarishi, beat-aksent) uchun cue
     ber. Aniq beat timing'da ehtiyotkor bo'l.`,
  ]),
  config: { responseMimeType: "application/json", responseJsonSchema: zodToJsonSchema(plan) },
});
const result = plan.parse(JSON.parse(res.text!)); // validatsiya
```

### Narx (tasdiqlangan, 2.5 Pro paid)
- Video ≈ **300 token/s** (default) yoki 100 token/s (low-res); audio 32 token/s.
- Narx: input **$1.25/1M**, output **$10/1M**.
- **20s klip ≈ $0.035–0.06** (output token'lar ustun — output uzunligini cheklang).
- ⚠️ Arzonroq kerak bo'lsa: 2.5 Flash input ~4× arzon.

### Nativ video vs frame+audio
**Tavsiya: nativ video upload (File API).** Soddaroq, arzonroq, audio-vizual birgalikda mantiq yuritadi (zarbani musiqa aksenti bilan bog'laydi). Frame-extraction faqat sub-soniya vizual aniqlik kerak bo'lsa.

---

## C. AI SFX provayderlar — solishtirish

**Verdict: ElevenLabs SFX (asosiy) + fal.ai MMAudio (alternativ/foley) eng yaxshi juftlik.**

| Mezon | **ElevenLabs SFX** | **fal.ai MMAudio V2** | **Stability Stable Audio 2.5** | MMAudio/AudioGen (self-host) |
|---|---|---|---|---|
| Kino SFX sifati | **Eng yaxshi** (whoosh/impact/braam vokabulyari) | Video-foley uchun yaxshi, abstrakt SFX'da kuchsiz | Kuchli (music+SFX) | O'rtacha, eskiroq |
| Davomiylik nazorati | **0.5–30s aniq** (`duration_seconds`) | `duration` float, ~8s'ga moslashgan | ~3 min gacha | 8s atrofi |
| Video-to-audio (sync) | ❌ yo'q | ✅ **asosiy kuchi** (Synchformer) | ❌ | ✅ (lekin litsenziya) |
| API | REST sync, MP3/WAV, JS/Py SDK | fal client, async queue, video_url | REST Bearer | self-host |
| Narx | ~20 kredit/s (~$0.0033/s) | **~$0.001/s** (juda arzon) | ~1 kredit=$0.01 | GPU narxi |
| Tijoriy litsenziya | ✅ toza | ✅ (hosted) | ✅ <$1M daromad | ❌ **CC-BY-NC — sotib bo'lmaydi** |

⚠️ **Self-host MMAudio/AudioGen'dan saqlaning** — model og'irliklari CC-BY-NC (non-commercial). fal.ai hosted MMAudio "commercial use" — xavfsiz yo'l.

### Tavsiya
- **(a) Gemini-plan asosida text-to-SFX:** asosiy **ElevenLabs SFX**, zaxira **Stable Audio 2.5**. ElevenLabs aniq davomiylik (`{prompt, duration:0.8, atTime:12.4}`) va designer SFX vokabulyariga eng mos.
- **(b) Video-to-audio alternativ:** asosiy **fal.ai MMAudio V2** (~$0.001/s, kadrga sinxron, commercial), zaxira — bo'shliqlarni ElevenLabs bilan to'ldirish.

```js
// ElevenLabs SFX — aniq davomiylik bilan (Gemini cue'dan)
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
const el = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
async function makeSfx({ prompt, duration }) {
  const audio = await el.textToSoundEffects.convert({
    text: prompt, durationSeconds: duration,   // 0.8 → aniq uzunlik (0.5–30)
    promptInfluence: 0.6, outputFormat: "mp3_44100_128",
  });
  const chunks = []; for await (const c of audio) chunks.push(c);
  return Buffer.concat(chunks);
}
```
```js
// fal.ai MMAudio — video-to-audio (foley)
import { fal } from "@fal-ai/client";
const r = await fal.subscribe("fal-ai/mmaudio-v2", {
  input: { video_url: "https://r2/clip_8s.mp4", prompt: "footsteps, distant wind", duration: 8 },
});
```

---

## D. Auto-sync — SFX'ni timeline'ga joylash

**Verdict: bajariladi, oddiy.**

```javascript
app.beginUndoGroup("AI SFX joylash");
var fd = comp.frameDuration;
for (var i = 0; i < cues.length; i++) {
  try {
    var f = new File(cues[i].path);
    if (!f.exists) continue;
    var io = new ImportOptions(f);
    if (!io.canImportAs(ImportAsType.FOOTAGE)) continue;
    io.importAs = ImportAsType.FOOTAGE;
    var footage = app.project.importFile(io);
    var layer = comp.layers.add(footage);
    // clip-nisbiy soniya → mutlaq comp time (workAreaStart bilan!), kadrga yaxlit:
    layer.startTime = Math.round((cues[i].startSec + rangeStart) / fd) * fd;
    layer.name  = "SFX – " + cues[i].label;
    layer.label = 9;            // rang (0–16)
  } catch (e) { /* bittasi yiqilsa qolganlari davom etadi */ }
}
app.endUndoGroup();
```
**Kalit:** `startTime = clipRelativeSec + workAreaStart` (⚠️ `displayStartTime` QO'SHMA — ikki marta siljiydi). Hammasi bitta undo guruhda. Har faylga try/catch — xatoga chidamli.

---

## E. End-to-end arxitektura (AssetFlow stack)

**Oqim:**
```
CEP: oraliq eksport (aerender→MOV→FFmpeg mp4)
  → R2'ga upload (signed PUT)
  → POST /api/ai/sfx-plan {videoUrl, rangeStart, fps, duration}
      backend: Gemini File API → structured plan (cues[])
               (ixtiyoriy: librosa beat-tracker → BPM)
      → har cue uchun ElevenLabs SFX → R2 (ai/sfx/<user>/<job>/<i>.mp3)
  → job status (SSE): queued→analyzing→generating→done
  → CEP plan+URL'larni oladi → downloadUrlToFile → JSX auto-sync
```

**Mavjud asboblardan foydalanish:**
- **Prisma `AiGeneration`** modeli bor — `type: SFX` (yangi enum), `prompt`, `resultUrl`, `status` saqlash.
- **Kredit-gate:** `consumeAiCredits` oldindan ushlab tur, **`refundAiCredits`** Gemini/SFX fail bo'lsa qaytar (mavjud naqsh). `AI_COST`'da `sfx` allaqachon bor (4).
- **Narx hisobi (dynamic):** bu tool qimmat — `kredit = base + (cueSoni × sfxNarx) + videoTahlilNarx`. Oraliq uzunligi + cue soniga qarab **oldindan cost-estimate** ko'rsat (mavjud cost-estimate UI naqshi).
- **Job + SSE:** mavjud SSE infratuzilma ustiga `analyzing→generating→done` bosqichlari. Gemini (sekundlar) + N SFX (sekundlar) = async shart.
- **Xavfsizlik:** Gemini/ElevenLabs/fal kalitlari **faqat backend env** (`render.yaml`). Video o'lcham/davomiylik limiti (masalan max 60s, max 50MB). R2 temp fayllar TTL bilan tozalansin.
- **R2:** natija R2'ga, AE signed URL'dan yuklaydi (mavjud `getSignedDownloadUrl`, `downloadUrlToFile`).

---

## BOSQICHLI YO'L XARITASI

| Bosqich | Nima | Tavsiya |
|---|---|---|
| **MVP-0** | Faqat work area eksport → Gemini plan → ElevenLabs SFX → AE'ga **oddiy import** (qo'lda joylash) | `renderQueue.render()` qisqa klip, File API, ElevenLabs |
| **1 — auto-sync** | Cue'lar `startTime`ga avtomatik joylanadi (undo guruh, frame-snap) | D bo'limidagi JSX |
| **2 — musiqa-aware** | librosa beat-tracker → BPM Gemini plan'iga; SFX beat'ga moslab | DSP qo'shimcha |
| **3 — fon render + job** | aerender child_process + SSE job status + cost-estimate | uzun kliplar, UX |
| **4 — video-to-audio rejim** | fal.ai MMAudio "foley" tugmasi (ambient to'ldirish) | alternativ arxitektura B |

---

## ASOSIY XAVF/TUZOQLAR

1. **Gemini timestamp ~±1s** — kadr-aniq emas. Beat-sync kerak bo'lsa DSP qo'sh. `fps:3` aniqlikni oshiradi.
2. **`timeSpanStart` non-integer xatosi** — har doim kadrga yaxlitla.
3. **Timecode o'qi** — `workAreaStart` ishlat, `displayStartTime` emas (auto-sync buziladi aks holda).
4. **aerender MP4 chiqarmaydi** — MOV→FFmpeg transcode.
5. **Self-host SFX litsenziya** (CC-BY-NC) — fal.ai hosted ishlat, sotiladigan mahsulot uchun.
6. **render() AE'ni muzlatadi** — uzun klip uchun aerender fon jarayon.
7. **Gemini File API 48s o'chadi** — saqlash kerak bo'lsa R2'da o'zingiz sakla.
8. ⚠️ **`videoMetadata.fps` TS SDK'da fileData part'da** — versiyangizda tekshir (inline'da tasdiqlangan).

---

## MANBALAR

**Gemini:**
- https://ai.google.dev/gemini-api/docs/video-understanding
- https://ai.google.dev/gemini-api/docs/files (48s retention)
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/pricing

**SFX:**
- https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
- https://elevenlabs.io/docs/overview/capabilities/sound-effects
- https://fal.ai/models/fal-ai/mmaudio-v2
- https://github.com/hkchengrex/MMAudio (litsenziya)
- https://stability.ai/license
- https://platform.stability.ai/pricing

**After Effects:**
- https://ae-scripting.docsforadobe.dev/renderqueue/renderqueueitem/
- https://ae-scripting.docsforadobe.dev/renderqueue/outputmodule/
- https://ae-scripting.docsforadobe.dev/item/compitem/
- https://ae-scripting.docsforadobe.dev/other/importoptions/
- https://helpx.adobe.com/after-effects/using/automated-rendering-network-rendering.html
- https://github.com/inlife/nexrender/issues/25 (aerender MP4 yo'q)

*Tayyorlandi: 2026-06-15*
