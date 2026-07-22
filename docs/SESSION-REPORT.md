# SESSION-REPORT — GitHub Actions Node 20 deprecation tuzatildi (2026-07-22)

**Faqat CI workflow'lar tegildi. Backend/DB/auth/pul-zona/deploy dizayni/installer/updater/marketplace TEGILMAGAN.**

- **Muammo:** direktor tasdiqlagan CI/Cloud Run annotatsiyalari `actions/checkout@v4`, `actions/setup-node@v4`, `google-github-actions/auth@v2`, `google-github-actions/setup-gcloud@v2`'ni eskirgan Node 20 runner'ga majburlangan deb belgiladi.
- **Tuzatildi:** uchala workflow (`ci.yml` — `build` + `windows-installer`, `db-backup.yml`, `deploy-cloudrun.yml`) → `actions/checkout@v7`, `actions/setup-node@v7`, `google-github-actions/auth@v3`, `google-github-actions/setup-gcloud@v3`. Loyiha `node-version: 20` HAMMA joyda O'ZGARMADI (action implementatsiyasi Node 24, ilova Node versiyasi mustaqil).
- Windows `Setup Node` qadamiga `package-manager-cache: false` aniq qo'shildi — setup-node v7 implicit kesh KIRITMASLIGI uchun. Linux CI'dagi `cache: npm` va Cloud Run migratsiya keshi SAQLANDI.
- `test-ci-windows-installer.mjs`'ga yangi (J) bo'lim: barcha `.github/workflows/*.yml` ustidan skanerlaydi, 4 eskirgan ref qaytarilmasligini, joriy major'larni va `node-version: 20`ni tasdiqlaydi, birinchi-tomon-yoki-SHA siyosatini `google-github-actions`ga ham kengaytiradi, 6 mutatsiya isboti bilan.
- **Testlar:** `test:ci-windows-installer` 162/162 PASS (avval 135; +27 yangi). `node --check`, `js-yaml` bilan 3 workflow parse, `git diff --check` — toza.
- Faqat to'g'ridan tegishli hujjatlar yangilandi: `RELEASE-ARCHITECTURE.md` §3A.4 (majorlar + kesh siyosati), `DIREKTOR-HANDOFF.md` JORIY HOLAT.
- **⚠️ QOLGAN:** lokal/statik isbot TO'LIQ, lekin "warning-free" haqiqiy isbot faqat push qilingandan keyingi masofaviy GitHub Actions run bilan tasdiqlanadi (bu sessiyada push YO'Q).
