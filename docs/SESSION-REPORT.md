# SESSION REPORT — 2026-06-19 — G3: Video reference (image-to-video / boshlang'ich kadr)

## Tasdiqlangan format (/videos/models, 2026-06-18 — taxmin emas)
- Barcha 7 video modeli `supported_frame_images:["first_frame"(,"last_frame")]` → request maydoni `frame_images:[{type:image_url,image_url:{url},frame_type:"first_frame"}]`.
- `input_references` / `references` ni HECH BIR video model qo'llamaydi (xom qidiruv = 0). Demak Veo uchun ham `first_frame` ishlatilishi kerak.

## Topilgan bug + tuzatish
- gen-processor video router `feature==="image-to-video" ? frame_images : input_references` edi → Veo (text-to-video) uchun `input_references` yuborardi, lekin Veo uni qo'llamaydi → reference E'TIBORSIZ qolardi. Endi `referenceMode==="video-ref"` bo'lsa BARCHA video modellarga `first_frame` (G2 router mantiqiga mos).
- **Hosted URL:** video provayderlar frame'ni TASHQARIDAN yuklaydi — data-URI'ni qabul qilmasligi mumkin. Yangi `materializeRefUrl()` data-URI'ni R2'ga yuklab signed URL (2 soat) qaytaradi; URL bo'lsa o'zini. `runVideo(model,prompt,params,userId,genId)`.

## Frontend
- `aiReferenceDataUri` endi `video` rejimni ham qo'llaydi — reference video bo'lsa first_frame kadr ajratiladi (mavjud canvas yo'li), rasm bo'lsa o'zi kadr. Send oqimi (G1) referenceUrl'ni video'ga ham qo'shadi.
- G2 affordance (`aiRefSupported`) video+video-ref'ni allaqachon yoqadi; G2 validatsiyasi (none→400) video'ni qamraydi.

## Tekshirildi
- tsc toza. Plugin parse: 2 blok, 0 xato. CEP'ga ko'chirildi (AE qo'zg'atilmadi). Studio static UI tegmadi → studio:sync shart emas.
- Eslatma: `input_references` plumbing (openrouter.ts) hozir ishlatilmaydi — kelajak modellari uchun saqlandi. Jonli test deploy'dan keyin.

## Kutilmoqda
- G4: Project panel'dan reference (host.jsx selektsiya) + "Rasm reference" menyu. G5: image/video-to-prompt.
