# Sessiya hisoboti — 2026-07-07 · PHASE B build 2/2: Use ▾ handoff + mobil dock

**Qilindi:** Use ▾ "Edit image" / "Generate video from image" REAL ulandi (faqat `platform/index.html`).
Edit: genGet bilan trigger paytida YANGI imzolangan URL → image rejim + edit-qobiliyatli model
(refKind image / maxRefs>0) → `referenceUrl` + `referenceUrls` (plagin shakli 1:1). i2v: video rejim +
refKind "frames" model → faqat `referenceUrl` (start), `referenceEndUrl` YUBORILMAYDI. Dock referens
sloti funksional: thumb + yorliq + ×; rejim qo'lda almashsa yoki model ref qabul qilmasa tozalanadi;
VIDEO manba/mos model yo'q → tugma off + tooltip. Mobil ≤820: dock = mode+model+cost+Generate,
ratio/quality/res/duration/count/voice/Enhance mode-popover ichiga yig'ildi (frame F), popover yopilmay
tanlanadi, buildParams o'sha holatdan o'qiydi.

**Pul zonasi:** `generate`/`estCost`/`pollJob` HEAD bilan bayt-ma-bayt BIR XIL (diff tasdiqlangan);
`buildParams` faqat 2 shartli ref qator oldi; ff-api.js tegilmagan. Imzo refs'siz hash — mock'da
bir xil signature ref bilan/refsiz qabul qilindi.

**Tekshirildi:** headless + mock API (:4000, gen-quote imzo mexanikasi replikatsiya): 7 ssenariy
(t2i toza, edit ref, i2v start-only, × dan keyin toza, mode-switch tozalash, off-tooltip, mobil gen) o'tdi, konsol xatosiz.

**Kutilmoqda:** push foydalanuvchidan; keyin Upscale/Variations (backend-gated).
