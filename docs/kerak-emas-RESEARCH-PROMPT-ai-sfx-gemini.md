# RESEARCH PROMPT — AE Timeline → Gemini 2.5 Pro tahlil → AI SFX (auto-sync)

> Bu hujjat **deep-research harness uchun system/research prompt**. Maqsad: quyidagi
> funksiyani qurish uchun zarur barcha texnik haqiqatlarni (provayder, model, API,
> narx, limit, arxitektura, misol kod, eng yaxshi yondashuv) chuqur va manbaga
> asoslangan holda aniqlash. Taxmin emas — har bir da'vo manba bilan tasdiqlansin.

---

## 0. Funksiya ta'rifi (nimani quramiz)

After Effects ichidagi AssetFlow CEP plugin'da yangi AI tool:

1. Foydalanuvchi AE timeline'da **oraliq tanlaydi** (work area yoki belgilangan in/out).
2. Plugin o'sha oraliqni **video (+ mavjud bo'lsa musiqa/audio)** sifatida temp faylga eksport qiladi.
3. **Google Gemini 2.5 Pro** o'sha videoni (vizual + audio) tahlil qiladi va
   **vaqt belgilangan "sound design plan"** qaytaradi: qaysi soniyada qanday SFX kerak,
   musiqa bo'lsa uning temp/janr/urg'usiga moslab.
4. **AI Sound provayder** (research solishtirib eng yaxshisini tanlaydi) shu plan asosida
   SFX audio kliplar generatsiya qiladi.
5. SFX kliplar AE timeline'ga **avtomatik to'g'ri vaqtga (auto-sync)** joylashtiriladi.

### Foydalanuvchi tomonidan tasdiqlangan qarorlar
- **Sound AI:** bitta emas — **ElevenLabs SFX, fal.ai modellari, Stable Audio va boshqalarni solishtirib**, narx/sifat/API/timing nazorati/AE integratsiya bo'yicha eng yaxshisini tavsiya qil.
- **Output:** **auto-sync** — SFX kliplari Gemini aniqlagan vaqtlarga AE timeline'da avtomatik joylashadi (MVP sifatida oddiy import ham yo'l xaritasida bo'lsin).
- **Video analiz usuli:** research o'zi hal qilsin — **nativ video upload** vs **frame-extraction + audio alohida** ni aniqlik/narx/yo'qotish bo'yicha solishtirib tavsiya ber.

---

## 1. Mavjud texnik kontekst (AssetFlow — shu ustiga quriladi)

Research tavsiyalari shu stack'ga **amaliy mos** bo'lsin:

- **Backend:** Express + TypeScript (`apps/api`), Prisma (`AiGeneration` modeli mavjud), kredit-gate (`consumeAiCredits`/`refundAiCredits`), rate-limit middleware.
- **Mavjud AI:** Cloudflare Workers AI (Flux rasm, MeloTTS ovoz, bge-m3 embeddings). Workers AI **video tushunmaydi va SFX'da kuchsiz** — shuning uchun bu funksiya uchun tashqi provayder kerak.
- **Storage:** Cloudflare R2 (S3-mos), signed download URL, `CDN_BASE_URL`. Natijalar R2'ga yoziladi, AE signed URL'dan yuklaydi.
- **Plugin:** After Effects CEP (HTML panel + `jsx/host.jsx` ExtendScript). Import allaqachon bor: `importMediaFromPath()`, `AssetFlowCatalog.downloadUrlToFile()`. `evalScript` orqali HTML↔JSX ko'prik.
- **Deploy:** API → Render, Studio → Cloudflare Pages.
- **Til:** UI o'zbekcha. Kod minimal-diff, mavjud konventsiyaga mos.

---

## 2. RESEARCH SOHALARI (har biriga aniq javob kerak)

### A. AE/CEP — tanlangan oraliqni eksport qilish
1. CEP/ExtendScript'da timeline'dan **work area yoki tanlangan in/out oralig'ini** qanday olish mumkin? (`comp.workAreaStart`, `workAreaDuration`, layer `inPoint/outPoint`, tanlangan layerlar).
2. Faqat o'sha oraliqni **video fayl sifatida render/eksport** qilishning ishonchli usuli: Render Queue + Output Module avtomatlashtirish (`app.project.renderQueue`), yoki Adobe Media Encoder (`aerender`/AME queue), yoki `comp.saveFrameToPng` (faqat kadr). Qaysi biri CEP fon rejimida barqaror?
3. Timeline'dagi **audio/musiqani** ham eksportga qo'shish — alohida audio (mp3/wav) eksport qilib bo'ladimi yoki video ichida muxlanadimi? Faqat tanlangan audio layerni izolyatsiya qilish mumkinmi?
4. Render tugaganini CEP'dan **aniqlash** (callback/polling), temp fayl yo'lini olish, fayl hajmini cheklash (uzun oraliq = katta fayl).
5. **Frame rate / timecode** muvofiqligi: Gemini qaytargan soniyani AE timecode'ga aniq xaritalash (comp fps, work area offset). Bu auto-sync uchun kritik.
6. Cheklovlar: CEP'da `aerender` chaqirsa bo'ladimi (alohida jarayon), yoki AME orqalimi? Render davomida AE bloklanadimi (UX)?

### B. Google Gemini 2.5 Pro — video+audio tahlil
1. Gemini 2.5 Pro **video kirishini** qanday qabul qiladi: inline bytes vs **File API** (upload → URI). Hajm/davomiylik chegaralari, qancha vaqt saqlanadi.
2. **Audio tahlili:** Gemini video ichidagi audioni (musiqa) ham tahlil qiladimi, yoki audio alohida yuborilishi kerakmi? Musiqa temp/BPM/janr/urg'u (beat) aniqlash imkoniyati qanchalik aniq?
3. **Vaqt belgilangan natija (timestamps):** Gemini videoda hodisalarni soniya/timecode bilan qaytara oladimi? `MM:SS` aniqligi qanday — kadr darajasidami yoki taxminiymi? Auto-sync uchun yetarlimi?
4. **Structured output:** `responseSchema` / JSON mode bilan qat'iy sxema (masalan `[{startSec, endSec, label, sfxPrompt, intensity}]`) qaytarish. Misol so'rov + javob.
5. **Video sampling:** Gemini videoni necha FPS'da namuna oladi (default ~1 fps), buni o'zgartirib bo'ladimi, tez hodisalar (zarba, portlash) o'tkazib yuborilmaydimi?
6. **Narx va limit:** Gemini 2.5 Pro video token narxi (video soniyasiga token), audio token, kontekst oynasi, rate limit. 10–30 soniyalik klip taxminan qancha turadi?
7. **Nativ video upload vs frame+audio alohida** — aniqlik, narx, kodlash murakkabligi bo'yicha to'g'ridan-to'g'ri solishtirish va **aniq tavsiya**. (Foydalanuvchi buni research'ga topshirdi.)
8. SDK: Node/TypeScript uchun rasmiy `@google/genai` (yoki `@google/generative-ai`) — File API upload + structured output misoli.

### C. AI SFX generatsiya — provayderlarni solishtirish (asosiy)
Quyidagilarni **bir jadvalda** solishtir: ElevenLabs Sound Effects, fal.ai'dagi audio modellari (masalan Stable Audio, AudioGen/MMAudio), Stability AI Stable Audio, ElevenLabs, Meta AudioCraft (self-host), va boshqa jiddiy nomzodlar.

Har biri uchun:
1. **Text-to-SFX** sifati va mosligi (kino SFX uchun — whoosh, impact, ambient, foley).
2. **Davomiylik nazorati:** aniq uzunlik (masalan 0.8s zarba) so'rab bo'ladimi? Maksimal/minimal davomiylik.
3. **Vaqtga/videoga moslash:** ba'zi modellar (masalan video-to-audio / MMAudio / Foley) **to'g'ridan-to'g'ri videodan SFX** generatsiya qiladi — bu Gemini'siz yoki Gemini bilan birga ishlatilishi mumkinmi? Bu alternativani ham baholang.
4. **API:** REST/SDK, auth, async vs sync, javob formati (mp3/wav), Node misol.
5. **Narx:** har generatsiya/soniya narxi; AssetFlow kredit modeliga (image=5, voice=3 kabi) qanday joylashadi.
6. **Litsenziya:** tijoriy foydalanish, foydalanuvchi natijani sotishi mumkinmi (AssetFlow contributor konteksti).
7. **Rate limit, ishonchlilik, latency.**

Yakunda: **eng yaxshi 1–2 provayderni tavsiya qil** (asosiy + zaxira), sabablari bilan.

### D. Auto-sync — SFX'ni AE timeline'ga joylashtirish
1. ExtendScript'da yangi audio footage'ni **comp'ga aniq vaqtda (startTime) layer sifatida** qo'shish: `comp.layers.add(footage)` + `layer.startTime = sec`. Work area offsetini hisobga olish.
2. Bir nechta SFX klipni bir necha layerga joylash, nomlash, rang/label berish (foydalanuvchi keyin tahrirlasin).
3. Gemini soniyasi (klip-nisbiy) → AE comp timecode (mutlaq) xaritalash formulasi.
4. **Undo guruhi** (`app.beginUndoGroup`) — hammasi bitta undo bo'lsin.
5. Xatolarga chidamlilik: bitta SFX yuklanmasa qolganlari joylashsinmi; import format guard (mavjud `canImportAs`/format-detect mantig'idan foydalanish).

### E. End-to-end arxitektura
1. **Oqim:** CEP eksport → R2 upload (yoki to'g'ridan backend) → backend Gemini'ni chaqiradi → plan → SFX provayder → R2 → CEP plan+URL'larni oladi → JSX auto-sync.
2. **Async/job:** video tahlil + ko'p SFX = sekund/daqiqalar. Mavjud SSE/job naqshidan foydalanib **job + status** (queued→analyzing→generating→done) qanday qurish.
3. **Kredit modeli:** bu tool qimmat (Gemini video + N ta SFX). Narxni qanday hisoblash (oraliq uzunligi + SFX soniga qarab) va oldindan **cost-estimate** ko'rsatish.
4. **Xavfsizlik:** API kalitlar (Gemini, SFX) faqat backend'da; foydalanuvchi yuklagan video o'lcham/davomiylik limiti; vaqtinchalik fayllarni tozalash.
5. **Xato-ishlovi:** Gemini bo'sh/yaroqsiz JSON qaytarsa, SFX provayder fail bo'lsa — kredit refund (mavjud `refundAiCredits`).

---

## 3. KUTILAYOTGAN NATIJA (research qanday qaytarsin)

Research hisobi quyidagilarni o'z ichiga olsin:

1. **Bajariladimi? (verdict)** — to'liq, qisman, yoki cheklovlar bilan; har bo'g'in uchun.
2. **Tavsiya etilgan stack** — Gemini chaqirish usuli + tanlangan SFX provayder(lar) + AE eksport usuli, aniq sabablar bilan.
3. **Solishtirish jadvallari** — SFX provayderlar; video-analiz usullari (nativ vs frame+audio).
4. **Aniq API misollari** — Node/TypeScript: Gemini File API + structured output; tanlangan SFX provayder chaqirig'i; ExtendScript eksport + auto-sync snippetlari.
5. **Narx modeli** — bir tipik so'rov (masalan 20s klip, 5 ta SFX) taxminiy xarajati; AssetFlow kredit narxiga taklif.
6. **Asosiy xavf/tuzoqlar** — timecode noaniqligi, render barqarorligi, Gemini timestamp aniqligi, latency, litsenziya.
7. **Bosqichli yo'l xaritasi** — MVP (oddiy import) → auto-sync → musiqa-aware → bir nechta SFX/variant. AssetFlow `REJA-AI-toliq-yol-xaritasi.md` bosqichlariga moslab.
8. **Manbalar** — har bir muhim da'vo uchun rasmiy hujjat havolasi (Gemini docs, ElevenLabs/fal.ai/Stability docs, Adobe ExtendScript/CEP docs).

---

## 4. Qoidalar
- Har texnik da'voni **rasmiy manba** bilan tasdiqla (narx, limit, model nomi — eng yangi holatini tekshir, 2026 holatiga).
- Eskirgan/taxminiy ma'lumotdan saqlan; model nomlari va narxlar tez o'zgaradi.
- Tavsiyalar **AssetFlow stack'iga amaliy** bo'lsin (Express/Prisma/R2/CEP), umumiy nazariya emas.
- "Video-to-audio / Foley" modellarini (Gemini'siz to'g'ridan SFX) **muqobil arxitektura** sifatida ko'rib chiq — ehtimol soddaroq bo'lishi mumkin.
