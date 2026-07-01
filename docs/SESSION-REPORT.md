# SESSION REPORT — 2026-07-01 — Google Vertex modellar: parametr to'g'riligi tekshiruvi

Video + rasm Google Vertex'ga ulanган (Veo Fast, Omni Flash, Imagen 4, Imagen 4 Ultra, Nano Banana). Bu qadam: har model parametrlarini (nisbat/soni/davomiylik/audio) HAQIQIY qo'llab-quvvatlashiga solishtirib to'g'rilash.

## RASM — to'g'rilandi + tasdiqlandi ✅
- **Nano Banana aspectRatio ULANDI:** adapter avval imageConfig.aspectRatio yubormasди → "Nisbat" ishlamasди. Endi yuboradi. Sinov: 16:9 → 1344×768 ✓.
- **Model-aware nisbat ro'yxati:** Imagen 4/Ultra = 5 (1:1,3:4,4:3,16:9,9:16); Nano Banana = 8 (Gemini ImageConfig). Eski IMG_ASPECTS'da 4:5/5:4 ikkalasida ham YO'Q edi (xato manbasi).
- **resolutions olib tashlandi** (adapter imageSize ishlatmaydi; UI flat-cost fallback). Ultra "1 rasm/chaqiruv" limiti muammo emas (adapter har chaqiruvda numberOfImages:1, processor count marta loop).
- Deploy: cloudrun-env.yaml bilan (Google env qayta tasdiqlandi). Prod katalog to'g'ri nisbatlarni ko'rsatadi.

## VIDEO — holat
- **Omni Flash** ✅ tasdiqlangan (10s qat'iy, audio, 16:9/9:16).
- **Veo 3.1 Fast** ⚠️ katalog: aspects[16:9,9:16] res[720p,1080p] dur[4,6,8] audio=false. FAQAT 720p/16:9/4s real sinaldi. 1080p/6s/8s — standart Veo qiymati, lekin "Fast" variant cheklangan bo'lishi mumkin. Metadata endpoint spec bermaydi.
- **Kutilmoqda:** foydalanuvchi Google konsol Veo 3.1 Fast model-card'dan aniq durations/resolutions/audio ro'yxatini beradi → katalog moslanadi.

## Env eslatma
- Cloud Run env'ini KONSOLDAN tahrirlashda Google 2 var (PROJECT/LOCATION) tushib qolmasin — deploy-cloudrun.sh (env-vars-file) ishlatilsin. Bu deploy ularni qayta tasdiqladi.
