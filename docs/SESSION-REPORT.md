# Session report — 2026-08-04 (Premiere UXP 0.1.3)

- AE va Premiere jonli yonma-yon ko‘rildi; Home/AI/Stock dizayn oilasi tenglashtirildi.
- UXP Home/AI/Stock, dinamik karta va Import hodisalari native listenerga o‘tkazildi.
- Image/Video `contenteditable` promptlari UXP’da native textarea: fokus va yozish PASS.
- Repaint `visibility` qora-kadr xatosidan `opacity` paint invalidatsiyasiga o‘tkazildi.
- MutationObserver olib tashlandi; input scan click/mousedown + interval bilan ishlaydi.
- Raw stock app-neutral qilindi: Premiere endi video/rasm/audio stockni ham oladi.
- Inactive/removed profil login, `/me` va device-confirm’da `ACCOUNT_INACTIVE` bilan rad etiladi.
- `getSystemPath` writable data/temp; `.prproj`, media import va `cep.fs` kontrakti PASS.
- Release CCX’da dev diag yo‘q; salbiy buzilgan-paket testi qo‘riqchi rad etishini tasdiqladi.
- API build: 51 model/24 enabled; release-contract 110/110; host-shim PASS.
- CCX: 59 fayl, 768.4 KB; byte-verify va `git diff --check` PASS.
- SHA-256: `9c5b2d92b93d65202812b31f9d8fff88735c9aaec86c6a9e72c40a638113d9c9`.
- Production deploy, active-user AI generation/import va `pr` release publish — kutilmoqda.
