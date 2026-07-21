# SESSION-REPORT — Reliz xavfsizligi: mijoz plagini ↔ ichki Admin ajratildi (2026-07-21)
**1 commit (amend), push/deploy/o'rnatish YO'Q. Pul/kredit/billing/auth/DB sxema/AI diff'da YO'Q.**
- **Muammo:** bitta ommaviy arxiv `AssetFlow_Plugin.html` HAM `AssetFlow_Admin.html` HAM olib yurardi;
  `manifest.xml` ikkala extension ID'ni ochardi; Admin dispatch `--disable-web-security` bilan ishlardi;
  `build-zxp.sh` sertifikat topilmasa self-signed sertifikat + qattiq yozilgan parol yaratardi.
- **Ajratish:** 2 flavor — **customer** (`com.frameflow.panel`, default) va **admin** (`com.frameflow.admin`,
  ICHKI: bundle `com.frameflow.internal.admin`, alohida papka/nom). Yagona manba `scripts/package-flavors.mjs`;
  `install-cep.sh` default=mijoz, Admin=`--admin`. `--disable-web-security` IKKALADAN olib tashlandi; CORS/auth TEGILMADI.
- **Imzolash fail-closed:** `ZXP_CERT`+`ZXP_CERT_PASS` majburiy; build boshida eski yakuniy `.zxp` bekor qilinadi;
  imzo chegaralangan temp'ga tushadi va faqat muvaffaqiyatda atomik `mv` bo'ladi — nosozlikda na temp,
  na yakuniy artefakt qoladi; parol chop etilmaydi; self-signed/standart kredensial YO'Q.
- **Testlar:** `test-package-security.mjs` (haqiqiy arxiv + haqiqiy build) **47/47 PASS** — mavjud imzolangan
  relizga TEGMAYDI (darvoza); DB/API/root build PASS · public-copy **67/67** · release **14/14** · download **10/10**.
- **Kutilmoqda:** panel-ichi self-updater RELIZGA TASDIQLANMAGAN (keyingi task — tashqi, imzo tekshiradigan
  installer/updater); imzolangan `.zxp` + `PluginRelease` yozuvi hali yo'q — ega ishi.
