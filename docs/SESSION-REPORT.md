# SESSION-REPORT — SC_57 (Seedance failure + BytePlus models) 2026-07-20

**Qilindi (2 commit, push YO'Q):**
- PART 1: Seedance r2v FAIL root-cause topildi + tuzatildi.
- PART 2: 3 aktivlashgan BytePlus modeli qo'shildi/yoqildi.

**Topildi (PART 1 root cause):** `optimizeVideoReferenceForUpload` faqat BALANDLIKNI 720 ga
cheklardi (`scale=-2:min(720,ih)`) → portret video-referens 406×720 = ~292k px, BytePlus
Seedance r2v'ning HAR KADR ≥409600 px minimumidan past → `InvalidParameter` 400 → Failed+Refund.
Egasining "50 kredit" job'i = 480p×10s×0.6 video-input multiplier = FAQAT video-referens bilan.
Tuzatish: QISQA tomon 720 ga (720×1280 portret / 1280×720 landshaft), maydon ≥518400. `expired`
poll statusi ham endi failed'ga map qilinadi.

**PART 2:** Seedance 2.0 Fast (3101, video) + Seedream 5.0 Lite (1020) + Seedream 4.5 (1022 yangi)
yoqildi — jonli probe: aktiv. 4.5 `output_format` param'ni rad etadi → adapter tashlaydi. Mini +
Seedream 4.0 aktiv EMAS (qoldirildi). Yangi narxlar cost'dan past emas, boot floor o'tdi.

**Tekshirildi:** verify-gen-payloads ALL PASS (16 yoqilgan model quote OK); real gen: Seedance Fast
video, portret video-ref 480p/10s (eski FAIL sahnasi endi "done"), Lite 2K, Seedream 4.5 2K — hammasi done.

**Kutilmoqda:** deploy (Cloud Run) — productionda tasdiqlash; egadan: agar Mini/4.0 kerak bo'lsa prepay pack.
