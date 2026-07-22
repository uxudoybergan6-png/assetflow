# SESSION-REPORT — Windows CI: masofada YASHIL, msiexec isbotlandi (2026-07-22)

**Bitta hujjat commit'i (hali push qilinmagan); kod/schema/narx/auth/pul-zona TEGILMAGAN.**

- **MASOFAVIY DALIL (3-iteratsiya, YASHIL):** `4293a6c` `origin/main`'da. CI run **29902381702** to'liq yashil.
- Windows job **88865831801** (1m16s) — qadalgan WiX, haqiqiy imzolanmagan MSI build, `wix msi validate`, **"Per-user install → migration → uninstall proof"** — HAMMASI o'tdi.
- Build job **88865831812** yashil · Cloudflare Pages check yashil.
- **BIRINCHI HAQIQIY ISBOT:** `msiexec` o'rnatish VA o'chirish masofada ishladi; eski qoldiqlardan migratsiya o'tdi; payload/hash aynan mos; `assetflow-data` sentinel saqlandi; umumiy CEP profil papkalari joyida qoldi.
- **JONLI API:** `GET .../plugin/version?current=1.1.1&platform=mac` → `latest:null, updateAvailable:false, installer:null, installerStatus:"not_published"` — kontrakt ishlaydi, `PluginRelease` hali yo'q.
- **Lokal testlar (o'zgarishsiz):** ci-windows-installer 135 · plugin-installers 244 · plugin-package 47 · plugin-updater 118 · release-contract 108 · plugin-download-state 10.
- **QOLGAN BLOKER (EGA ishi):** signing yo'q — keychain 0 valid identity, `ZXPSignCmd` yo'q, Apple Developer ID Installer/notarizatsiya va Windows Authenticode env'lari yo'q (GitHub secret'da faqat `CLOUDRUN_ENV_YAML`); shu sabab birinchi imzolangan `PluginRelease` hali chiqmagan.
