> **STATUS:** PLANNED — dizayn/yaxshilash rejasi (Artlist parity), joriy holat EMAS. Asosiy Studio Gen kodga yozilgan — `docs/PROJECT-STATUS.md`'ga qara. — 2026-06-20

# Studio Gen — AI tools'ni Artlist darajasiga ko'tarish (blueprint + model fix)

*Manba: STUDIO-GEN-BLUEPRINT.md (Artlist AI Toolkit jonli tahlili) + reference-edit muammosi.*

## ASL MUAMMO — model imkoniyati
- Timeline reference OLINADI ✅, lekin Flux schnell = **text-to-image** → reference'ni
  e'tiborga olmaydi. "Rangini o'zgartir" = EDIT → flux schnell qila olmaydi.
- **Yechim — vazifaga mos model:**
  - Matn → rasm (reference yo'q): Flux schnell ✅ (Workers AI).
  - Rasm EDIT / reference ("rangini o'zgartir", "shu uslubda"): **instruct-edit model** kerak.
    - Workers AI: img2img (SDXL) — qo'pol, instruct-edit emas.
    - **fal.ai Flux Kontext** — instruct image editing (aynan "rangini o'zgartir" uchun).
      Yangi provayder + kalit + xarajat.
- **Composer marshrutlashi:** reference bor + edit-niyat → edit model; aks holda → Flux.

## Blueprint'dan olinadigan naqshlar (Artlist Studio Gen)
1. **Session = workspace** — har studio ish maydoni `sessionId`; generatsiyalar shunga
   bog'lanadi, sidebar tarixi. (Prisma: GenSession + Generation + GenAsset.)
2. **Model katalog** — `getModelGroups` (barcha modellar), har model raqamli ID + metadata.
   UI'da model tanlash (text2img / img2img / edit / video / music).
3. **Imzolangan cost-quote (xavfsizlik!)** — `getCostQuote` narxni JWT bilan imzolaydi;
   generate shu imzoni qaytaradi, server tekshiradi → klient narxni soxtalashtira olmaydi.
   **AssetFlow:** kredit narxini klientga ishonmang — imzolangan quote.
4. **Job + status** — generate → {jobId, queued} → status (WebSocket yoki polling) →
   completed → asset. failed → kredit qaytariladi.
5. **Enhance prompt** — promptni AI bilan kengaytirish (alohida tugma).
6. **Generation history** — sessiya grid/sidebar; qayta ishlatish.

## AssetFlow oqimi (blueprint §8 moslashtirilgan)
```
1. getCostQuote(modelId, settings) → {price, signature}   # imzolangan narx
2. createGeneration({settings, price, costQuoteSignature}) # server imzoni tekshiradi
   → {generationId, status:"queued"}                       # kredit zaxira
3. polling (Render'da WebSocket qiyin) GET /gen/:id        # har 3-5s
4. completed → asset (R2 signed URL) → AE import
5. failed → kredit qaytariladi
```

## Bosqichlar (ustuvorlik)
### A — Model marshrutlash + EDIT model (asl muammo) 🔴
- Vazifa turi bo'yicha model tanlash: text2img→Flux, edit/reference→edit model.
- Edit model qarori: Workers AI img2img (bepul, qo'pol) YOKI fal.ai Flux Kontext (instruct
  edit, kalit+xarajat). → "rangini o'zgartir" haqiqatan ishlaydi.
- Composer: reference bor bo'lsa edit-rejim; UI aniq ko'rsatadi (matn-dan / edit).

### B — Studio Gen arxitektura (blueprint)
- Prisma: GenSession + Generation + GenAsset. (AiGeneration'ni kengaytirish/ko'chirish.)
- Session-based history (sidebar grid).
- Imzolangan cost-quote (getCostQuote → JWT → createGeneration tekshiradi).
- Job + polling status.
- Model katalog endpoint + UI model tanlash.

### C — Enhance prompt + ko'p-model selektor (blueprint UI)
- "Enhance prompt" tugmasi (Workers AI text model bilan promptni boyitadi).
- Model dropdown funksional (katalogdan).

## Qaror (foydalanuvchi)
1. **Edit model:** Workers AI img2img (bepul, qo'pol) yoki fal.ai Flux Kontext
   (instruct-edit, kalit+xarajat — "rangini o'zgartir" aniq ishlaydi)?
2. **Arxitektura:** to'liq Studio Gen (session/history/signed-quote/job) yoki avval
   faqat model-fix (edit ishlasin), arxitektura keyin?

## Eslatma
- Reference/edit MODEL imkoniyatiga bog'liq — kod tayyor, lekin model qabul qilishi shart.
- Imzolangan cost-quote — xavfsizlik uchun muhim (klient narxni soxtalashtirmasin).
- WebSocket Render'da qiyin → polling bilan boshlanadi.
