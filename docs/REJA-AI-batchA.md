# Batch A — AI 2/3/5-bosqich (Workers AI / mavjud infra)

*Yangi provayder/kalit kerak emas. Har sub-qadam alohida commit — AE'da testlanadi.*

## 2-bosqich — Timeline live-link
Higgsfield AEFT naqshi (tahlildan):
- `host.jsx`: `getActiveTimelineVideoReference()` — aktiv comp'dagi tanlangan layer manbasi
  (footage bo'lsa fayl yo'li). `getActiveTimelineClipDetails()` — trim/oraliq. Structured JSON.
- `exportSourceRangeToTempFile()` — tanlangan oraliqni render qilib temp faylga (render preset;
  yo'q bo'lsa fallback). (Ixtiyoriy/keyin — avval to'g'ridan footage yo'li.)
- Frontend: "Timeline'dan" tugmasi (hozir "tez orada") → tanlangan klipni REFERENCE sifatida
  oladi → AI composer'ga biriktiradi (chip + thumbnail).
- ⚠️ Reference'ni ISHLATISH: Workers AI'da image-input (img2img) model bormi tekshir.
  Bor bo'lsa /image reference qabul qilsin; yo'q bo'lsa reference 4-bosqich (reframe/edit)
  uchun saqlanadi va UI "reference olindi" deydi.

## 3-bosqich — Job + ko'p-model + reference
- **Ko'p-model selektor** (asosiy): UI model dropdown (hozir "Flux 2" statik) FUNKSIONAL bo'lsin.
  Env'da Workers AI model ro'yxati (Flux schnell/dev, SDXL...). /image `model` parametrini
  qabul qilsin. "Avto" opsiyasi (default).
- **Reference upload**: composer'ga rasm yuklash (Timeline'dan yoki fayldan) → img2img model'ga
  (mavjud bo'lsa).
- **Job/SSE** (yengil): Workers AI tez (sekundlar) — image/voice sinxron yetarli. SSE/job
  asosan sekin amallar (video, 4-bosqich) uchun. Batch A'da: AiGeneration status yangilanishi
  + xato holatlari aniq. To'liq SSE 4-bosqichda.

## 5-bosqich — Template-grounded (bizning ustunlik)
- **"Shablon uchun"** rejimi: composer'da shablon tanlanganda (yoki "Shablon uchun" chip),
  generatsiya shu shablon konteksti bilan (prompt shablon nomi/teglari bilan boyitiladi) +
  natijani o'sha shablon comp'iga import taklifi.
- **Auto-tagging**: contributor upload/approve'da — Workers AI bilan avtomatik teg taklifi.
  Vision model (rasm caption) yoki text model (title/desc'dan teg). Teglar metaJson/teglarga.
  ⚠️ Workers AI'da vision/caption model bormi tekshir; yo'q bo'lsa text model (Llama) title+desc'dan.
- Semantik qidiruv — ✅ allaqachon qilingan (1-bosqich).

## Ketma-ketlik (har biri commit + AE test)
1. **2a** — host.jsx Timeline funksiyalari + "Timeline'dan" tugma (reference capture).
2. **3a** — funksional model selektor (Workers AI ko'p model) + reference upload.
3. **2b/3b** — img2img reference (Workers AI image-input model bo'lsa).
4. **5a** — "Shablon uchun" generatsiya konteksti.
5. **5b** — auto-tagging (upload/approve hook).

## Tekshiruvlar
- Workers AI model mavjudligi: img2img (reference), vision/caption (auto-tag) — dashboard/API.
- Yo'q bo'lganlari: graceful "tez orada" yoki text-fallback.
- Mantiq buzilmaydi; har sub-qadam tsc/parse toza + install-cep + commit.
