# SESSION REPORT — 2026-07-02 — 4 ta AI Tools kamchilik tuzatildi

Foydalanuvchi 4 kamchilik xabar qildi — hammasi tuzatildi:

## TUZATILDI
- **#35+#36 (Qayta gen refs aralashadi / rasm restore video toolda qolib ketadi):** Restore/almashtirish logikasi (`igRestoreGen`/`vgRestoreGen`, cross-tool `axGo`+handoff) 5 marta jonli test qilindi — HAMMASI to'g'ri ishladi. Haqiqiy sabab: `window.afRecent` ikonkalari TESKARI edi — "Referens qilib ishlatish" (qo'shuvchi) refresh-ikonka, "Qayta gen" (almashtiruvchi, tool almashtiradi) qalam-ikonka bo'lib ko'rinardi → foydalanuvchi noto'g'ri tugmani bosardi. Ikonkalar almashtirildi ("+"=referens, refresh=qayta gen).
- **#37 (Omni: ovoz doim yoqiq bo'lsa ham "+ Ovoz" referens ko'rinardi):** `vgAddAud` tugmasi endi `vm.mediaRefs.audio` soniga qarab yashiriladi (Omni: audio:0 → yashirin; Seedance R2V: audio:3 → ko'rinadi).
- **#38 (Tozalash tugmasi kichkina/notiy edi):** `.clearbtn` CSS pill/chip dizaynga o'zgartirildi (fon, radius 20px, hover'da qizil).

## TEKSHIRILDI
- Barcha 4 tuzatish brauzer preview'da jonli tasdiqlandi (`getComputedStyle`, ikonka `.innerHTML`, ko'rinish/yashirish holatlari — Omni va Seedance R2V ikkalasida).
- Debug uchun qo'shilgan vaqtinchalik hook'lar (`__vgDebug/__vgSetup/__vgRcSetup`) olib tashlandi — `git diff` faqat 4 haqiqiy tuzatishni ko'rsatadi.

## KUTILMOQDA
- AE'da CEP orqali qo'lda test (ikonka almashinuvi, Omni'da Ovoz tugmasi yo'qligi, Tozalash tugmasi ko'rinishi).
