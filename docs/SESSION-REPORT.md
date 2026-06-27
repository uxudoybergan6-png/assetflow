# SESSION REPORT — 2026-06-27 — R2V referensга 3-manba menyu

## So'rov
R2V ko'p-modal referens (＋Rasm/＋Video/＋Ovoz) ham kadrlardagidek manba menyusiga ega bo'lsin: Fayl yuklash / Project paneldan / Timeline'dan (faqat to'g'ridan fayl emas).

## Bajarildi (vgScript)
1. `addMediaRef` (faqat showOpenDialog) o'rniga **modality-aware 3 picker**: `pickFileMedia` (kompyuter, type-exts), `pickProjMedia` (AE footage, mediaType filtr image/video/audio), `pickTlMedia` (Timeline kadr → PNG, FAQAT rasm).
2. `openMediaSrc(type)` — ＋Rasm/＋Video/＋Ovoz bosilganda mavjud `vgSrcSheet` (Fayl/Project/Timeline) qayta ishlatiladi. Timeline FAQAT rasm uchun ko'rinadi (video/ovozда yashirin). Sarlavha + File/Project subtitle turga moslanadi.
3. **Yagona manba-nishon** `_vgSrcTarget={kind:'frame',which}|{kind:'media',type}`. `vgSrcFile/Proj/Tl` handlerlari shunga qarab kadr ↔ media'ga marshrutlaydi. `openFrameSrc` Timeline'ni qayta ko'rsatadi + subtitle'ни tiklaydi.
4. `mediaAllowed(type)` — limit (jami≤12, image≤9/video≤3/audio≤3) menyu ochishdan oldin tekshiriladi. Mavjud `uploadMediaRef`/`readDataUrl`/`hostCall` qayta ishlatildi.

## Tekshiruv (headless harness, REAL funksiyalar)
＋Rasm → menyu (Fayl/Project/**Timeline ko'rinadi**); ＋Video/＋Ovoz → menyu (**Timeline yashirin**), sarlavha "Video/Ovoz referens", subtitle "kompyuterdan video/ovoz". ＋Video→Fayl yuklash→@Video1 qo'shildi (1/12). Kadr regressiyasiz: Fast'да start-box→manba menyu, Timeline qayta ko'rinadi. 7 inline script 0 xato, console 0 xato.

## O'rnatish
`install-cep.sh` qayta o'rnatildi → AE'ni qayta oching. R2V referens ＋ tugmalari endi Fayl/Project/Timeline menyusini ochadi.
