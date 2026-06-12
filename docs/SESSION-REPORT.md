# Session Report — 2026-06-12 (R2 upload diagnostika + stream fix)

## Muammo
Production'da ba'zi yangi yuklangan shablonlar R2'ga yetib bormagan (orphan).

## Diagnostika (chuqur tekshiruv)
- **isS3Configured() = TRUE (production):** orphan pack → prod **302 → r2.dev CDN**. R2 o'qish ishlaydi, env kalitlar Render'da sozlangan.
- **R2 yozish ISHLAYDI:** yangi `cmqapfzto000blx211mod9hg1` (215MB pack.zip + 114MB preview.mp4 + thumb.jpg) R2'da to'liq bor → token yozish huquqiga ega. (Avvalgi "token read-only" xulosasi NOTO'G'RI edi.)
- **Sabab — intermittent (katta fayl):** `uploadFileToS3` faylni `fs.readFileSync` bilan butunlay xotiraga o'qirdi va R2 sync upload so'rovi ichida ketma-ket (~330MB) bajarilardi. So'rov timeout / Render bepul-tarif spin-down sync tugashidan oldin → R2 bo'sh, ephemeral disk keyin o'chadi → orphan. Xato `contributor.ts:360` `catch` da yutilardi.

## Tuzatish (commit qilindi)
- **`s3.ts` `uploadFileToS3`** — `fs.readFileSync` o'rniga `fs.createReadStream` + `ContentLength` (stat'dan). Fayl xotiraga to'liq yuklanmaydi (OOM xavfi kamayadi). Xato endi aniq log (`[s3] uploadFileToS3 muvaffaqiyatsiz — key/size/src`) + `throw` (yutilmaydi). Commit `3193352`. Boshqa funksiyalar o'zgarmagan.

## Ochiq / keyingi
- Push qilinmagan: `3193352` (s3 stream fix) + `47efa23` (mogrt-extract) — foydalanuvchi o'zi push qiladi → Render auto-deploy.
- Caveat: PutObject + stream'da SDK retry stream qayta o'qiy olmaydi. To'liq retry-bardosh kerak bo'lsa `@aws-sdk/lib-storage` `Upload` (yangi dep).
- Tavsiya: R2 sync'ni so'rovdan ajratish (background) yoki DB'da `r2Synced` flag + retry.
