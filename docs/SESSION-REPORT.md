# SESSION REPORT — 2026-07-01 — Rasm generatsiyasi fal.ai → GOOGLE (Vertex) to'liq ko'chirildi

Video (Veo Fast + Omni Flash) jonli qilingandan so'ng: rasm yaratish fal.ai/openrouter'dan Google Vertex'ga (to'g'ridan-to'g'ri) ko'chirildi. Foydalanuvchi qarori: "to'liq Google".

## Yangi adapter
- `apps/api/src/lib/ai/vertex-image.ts` — `vertexImage` (Imagen: generateImages) + `vertexImageEdit` (Nano Banana: generateContent + inlineData). ADC token, fal'siz.

## Katalog (gen-models.ts)
- **Qo'shildi (provider `vertex-image`):** 1010 Nano Banana (`gemini-2.5-flash-image`, default, 4 kr), 1011 Imagen 4 (`imagen-4.0-generate-001`, 4 kr), 1012 Imagen 4 Ultra (`imagen-4.0-ultra-generate-001`, 8 kr).
- **O'chirildi (enabled:false):** 15 ta eski rasm modeli — 1001-1005 (openrouter: Nano Banana/Seedream/Flux/Grok), 1101-1110 (fal: GPT Image/Seedream/Flux/Nano Banana). Google modeli fal orqali ulanib ustama to'lanardi.

## gen-processor.ts
- `useVertexImg = provider==="vertex-image"`; genOne zanjiriga vertex-image yo'li (edit → vertexImageEdit, aks holda vertexImage). count/persist/refund skeleton o'zgarmadi.

## Sinovlar (real, jonli)
- Smoke: Imagen 4 (1024×1024, 8s), Nano Banana (1024×1024, 7s) — haqiqiy rasmlar.
- Built adapter: vertexImage + vertexImageEdit (robotga shlyapa qo'shildi — edit to'g'ri).
- **Uchidan-uchiga PROD:** login→session→quote(narx=4)→gen→DONE, rasm GCS'ga saqlandi. Kredit to'g'ri yechildi.
- Deploy: revision **assetflow-api-00016-759**, 100% traffic. Prod `?mode=image` faqat 3 Google modelini ko'rsatadi.

## Narx afzalligi
- Imagen/Nano Banana ~$0.04/rasm ≈ 4 kredit (fal orqali 6-16 edi). Arzon + bir provayder.

## Ochiq
- "Sifat" selektori Imagen/Nano Banana'ga ta'sir qilmaydi (adapter image_size yubormaydi) — kelajakda aniqlash mumkin. AE plagindan real UI oqimini ko'rish tavsiya.
