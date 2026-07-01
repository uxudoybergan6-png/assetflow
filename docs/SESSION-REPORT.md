# SESSION REPORT — 2026-07-01 — VERTEX_NOT_CONFIGURED asosiy sabab tuzatildi + barcha funksiya tekshirildi

Nano Banana 2 ulangach, plaginda qayta VERTEX_NOT_CONFIGURED + referens ishlamasligi. Asosiy sabab topilib, doimiy tuzatildi.

## ASOSIY SABAB (nihoyat aniqlandi)
- `.github/workflows/deploy-cloudrun.yml` — git push'da (apps/api o'zgarsa) AVTO-deploy qiladi. Env'ni `CLOUDRUN_ENV_YAML` GitHub secret'idan oladi. O'sha **secret'da GOOGLE_CLOUD_PROJECT/LOCATION YO'Q** (lokal cloudrun-env.yaml'da bor, lekin secret eski 26-var). Har push → GitHub deploy → Google env tushadi → VERTEX_NOT_CONFIGURED. (Shuning uchun qayta-qayta: men lokal deploy qilaman → ishlaydi → user push qiladi → GitHub deploy env'ni tushiradi.)

## TUZATISH (doimiy)
- 3 adapter (vertex/vertex-omni/vertex-image): `process.env.GOOGLE_CLOUD_PROJECT || "project-289028d3-984c-4d84-bd4"` hardcode fallback. Env tushsa ham ishlaydi (ID maxfiy emas — deploy config'da ochiq). Endi qaysi deploy yo'li bo'lsa ham (lokal/GitHub) Vertex ishlaydi.
- Toza fix (ixtiyoriy): `gh secret set CLOUDRUN_ENV_YAML < cloudrun-env.yaml` — GitHub secret'ni yangilash (foydalanuvchi ruxsati bilan).

## BARCHA FUNKSIYA TEKSHIRILDI (e2e prod, hozir) ✅
- A) t2i (1:1,1K) narx 4 · B) nisbat+sifat (16:9,2K) narx 8 · C) soni 2 → narx 8, 2 rasm · D) ref-upload → URL · E) ref-tahrir (referens bilan) → narx 4. Hammasi ishlaydi.
- "Referens import bo'lmadi" ham aslida VERTEX_NOT_CONFIGURED sabab edi (edit ham Vertex talab qiladi). CEP fayl-tanlash dialogini AE'da sinash kerak (client-side).

## Holat
- Nano Banana 2 (id 1010) JONLI, barcha funksiya ishlaydi. Boshqa modellar hali o'chiq (birin-ketin).
