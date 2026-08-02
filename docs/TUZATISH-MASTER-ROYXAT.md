# FrameFlow — Tuzatish MASTER ro'yxati (konsolidatsiya)

**Sana:** 2026-07-30 · **Manba:** `FULL-AUDIT-2026-07-30.md` (127 topilma) + COWORK-AUDIT (2026-07-28) + direktor daftari (MUAMMOLAR V1/V2, DIREKTOR-AUDIT)

---

## 1. Nechta muammo — umumiy sanoq

**Muhim:** uch qatlam bir-birini takrorlaydi. `FULL-AUDIT-2026-07-30` — eng oxirgi hujjat va u avvalgilarni **qayta tekshirib, ichiga singdirgan** (COWORK P0-1…P0-7 dan 6/7 tasi tasdiqlandi, 2 tasi rad etildi). Shuning uchun "127 + avvalgilari" = 127 emas — 127 bu **deduplikatsiya qilingan yakuniy to'plam**. Avvalgilari uning bir qismi.

### Kategoriyalar bo'yicha (ID bilan belgilangan bandlar)

| # | Kategoriya | Soni | Belgi |
|---|---|---|---|
| P0 | Bloklovchilar | 4 | P0-A…P0-D |
| 💰 | Pul dvigateli | 10 | M1–M10 |
| 💰 | Billing / obuna | 11 | B1–B11 |
| 💰 | Yangi pul teshiklari (Explore hovuz, fire-and-forget, kvota) | 3 | §4.3–4.5 |
| 🔗 | Zanjir uzilishlari | 11 | §5.2 + Z1–Z10 |
| 📈 | Miqyos to'siqlari | 15 | S1–S12 + OOM/N+1/perf-harness |
| 👤 | User yuklash | 7 | U1–U7 |
| 🌐 | Web infra | 4 | W1–W4 |
| 🌐 | Web UI/UX | 12 | X1–X12 |
| 🌐 | Contributor Studio | 14 | C1–C14 |
| 🌐 | Admin panel | 8 | A1–A8 |
| 🔌 | Plagin yadro | 10 | P1a–P1j |
| 🔌 | Plagin UI/UX | 7 | PU1–PU7 |
| 🔒 | Xavfsizlik | 9 | S1–S9 |
| ⚙️ | Infra / operatsiya | 18 | I1–I18 |
| 📣 | Huquq / narx / ommaviy daʼvo | 10 | L1–L10 |
| | **JAMI (ID bilan)** | **~143** | hujjat sarlavhasida "127" — ba'zi bandlar guruhlangan |

**Darajalar bo'yicha:** P0 = 4 · P1 ≈ 30 · P2 ≈ 75 · P3 ≈ 34.

---

## 2. CLAUDE CODE QILADIGANLAR (kod/konfiguratsiya — repo ichida)

Ro'yxat audit §14 tartibida (bugun → hafta → oy). Deyarli hammasi kod tuzatishi; faqat sertifikat/parol/lawyer/monitoring akkaunti EGA tomonida (§3).

### 🔴 BUGUN (bozorga chiqishdan oldin — muzokara qilinmaydi)

| Band | Ish | Fayl | Kim |
|---|---|---|---|
| P0-A / I1 | `demo:clear` — prod-guard + `--yes` majburiy + filtr (hozir 3 jadvalni filtrsiz o'chiradi) | `scripts/clear-assetflow-demo.mjs` | CC |
| P0-B / P1a | Windows zip import: Admin paneldagi tuzatishni mijoz plaginiga ko'chirish + `unzip` shell'ni butunlay olib tashlash (yauzl kabi kutubxona) | `plugins/after-effects-cep/assetflow-local-store.js` | CC |
| §6.1 | `/api/contributor/catalog` → `requireAuth` + `take`/paginatsiya + `metaJson` ni javobdan olib tashlash (OOM + maʼlumot sizishi) | `apps/api/src/routes/contributor.ts:3575` | CC |
| §4.3 | Explore earning filtri: `templateType`/`aiSource` bo'yicha `kind:"download"` earning **yozmaslik** (30% hovuz suyultirilishini to'xtatadi) | `download-events.ts:152`, `earnings.ts:133` | CC |
| B1/B2 | LS mijozi uchun: yo `Subscription` qatorini LS webhook'da yozish, yo plaginda "Free" tugmasini bloklash (pullik mijoz qamalib qolishini to'xtatadi) | `lemonsqueezy.ts`, `plugin-profile.ts` | CC |
| P0-D / I6 | `SENTRY_DSN` ni kod ishlatishga tayyor qilish + `/health` monitoringiga ulanish nuqtasi | `apps/api/src/index.ts` | CC (qiymat = EGA) |
| P0-4 | Plagin `openExternal` shell-injection → `execFile('open',[url])` | `assetflow-account.js:391` | CC |

### 🟠 SHU HAFTA

| Band | Ish | Kim |
|---|---|---|
| M1 (P0-1) | Oylik reset'ni atomik `updateMany` guard'ga o'tkazish (race → bepul kredit) | CC |
| M2 (P0-2) | `refundAiCredits` ni `increment` + guard'ga o'tkazish (absolyut yozuv race) | CC |
| M4 | `DELETE /gen/:jobId` ga `status` guard (running job o'chirilishi → refund yo'qoladi) | CC |
| M5 (P0-6) | `generation.create` P2002'dan boshqa xatoda ham refund | CC |
| B3 (P0-5) | `grantAiCreditsTopup` ga order-id idempotentligi (LS retry → ikki marta kredit) | CC |
| M3 | Seedance 3102 @4K + video-ref narxini tuzatish (har klipda −$2.28 zarar) | CC |
| M8 | SFX (4001) maksimal davomiylik narxini tuzatish (xarajatdan past) | CC |
| §5.2 | `/sync` va `/pack-uploaded` da APPROVED shablonni `PENDING_REVIEW` + `published=false` ga qaytarish (tasdiqdan keyin kontent almashtirish teshigi) | CC |
| W1 | `prepare-cf-pages.mjs` da `_*` mockup istisnosi (17 ta ichki mockup prod'da) | CC |
| U1 | `promptPublic:false` ni server tomonda majburlash (promptlar anonim internetga oqadi) | CC |
| P0-C (kod qismi) | Marketplace metadata skeletini to'ldirish + `.zxp` build zanjiri (kontent + sertifikat = EGA) | CC + EGA |

### 🟡 SHU OY

| Band | Ish | Kim |
|---|---|---|
| §6.1–6.4, S1–S12, Z6/Z7 | Miqyos bloki: `assetKeysJson` backfill + N+1 yo'qotish, `previewTranscodeStatus` indeksi, trigram indeks, katalog tartibini `updatedAt`dan ajratish, `pack-uploaded` ni asinxron qilish, perf-harness'ni to'g'ri kod yo'liga qaratish | CC |
| C1–C14 | Contributor Studio: Edit tugmasi (C1), bulk abort/qayta tiklash (C2), sessiya tugashini boshqarish (C3), soxta thumbnail/timeline (C5/C6), o'lik qidiruv (C9), dev-only matnlar (C11) | CC |
| A1–A8 | Admin: bulk-select tasdiqlash dialogi (A1), DMCA UI (A2), "Save" yolg'on muvaffaqiyatini tuzatish (A3/A5), localStorage promo (A4) | CC |
| L1–L8, L10 | Huquqiy/narx matnlari: mavjud bo'lmagan Premiere daʼvosi (L1), `verify-public-copy.mjs` qamrovi (L2), narx nomuvofiqligi (L3/L4), "30+ til"→10 (L7), SEO/OG/robots.txt (L10) | CC (L9 matn = EGA/lawyer) |
| S1–S9 | Xavfsizlik: device-code entropiya+tasdiq (S1), `/api/logs` meta chegarasi (S2), Google auto-link pre-hijack (S3), auth'siz endpointlar (S4–S6) | CC |
| I2,I3,I5,I7–I13,I15–I18 | Infra kod: graceful shutdown (I3), CI'ga `test:*` ulash (I5), resumable claim (I7), `npm ci` (I11), Node 20→yangilash (I12), eski `render.yaml`/`deploy-cloudrun.sh`/`_to_delete` tozalash | CC |
| U2–U7 | User: Explore submission tahrir/o'chirish (U2), ref-upload hajm limiti (U4), GDPR storage tozalash (U5/U6) | CC |
| PU1–PU7, P1b–P1j | Plagin: uchayotgan job persistence (PU1), bekor qilish (PU2), o'lik kod tozalash (PU5/PU6), kesh o'chirish (P1b), sha256 tekshiruvi (P1d), evalScript timeout (P1e) | CC |
| Z1–Z10 | Zanjir: yetim zip tozalovchi (Z1), fencing (Z2), contributor self-delete (Z3), kesh/kalit nomuvofiqligi (Z6–Z9), majburiy yangilanish (Z10) | CC |

**Claude Code jami: ~135 band** (deyarli barchasi — arxitektura yaxshi, ko'pchiligi lokal tuzatish).

---

## 3. EGA QILADIGANLAR (Claude Code KODda qila olmaydi)

Bular akkaunt, sertifikat, parol, pul yoki tashqi xizmat — kod emas:

| # | Ish | Nega Claude Code emas |
|---|---|---|
| 1 | **Prod DB'ni tiklash** — Neon dashboard, suspended/kvota tekshirish, kerak bo'lsa Launch plan (~$19/oy) | Neon akkaunti + to'lov |
| 2 | **`SENTRY_DSN` qiymatini olish** + uptime monitor (UptimeRobot/BetterStack) sozlash | Tashqi akkaunt ro'yxatdan o'tish |
| 3 | **Maxfiy kalitlarni rotatsiya** — GCS HMAC, R2, Neon parol, `COST_QUOTE_SECRET` (I14; CC faqat `vwrap.mjs`ni o'chiradi + `.dockerignore` yozadi) | Kalitlar cloud konsollarida |
| 4 | **Adobe ZXP signing sertifikati** + `ZXPSignCmd` (P0-C) | Adobe Developer akkaunt + sertifikat sotib olish |
| 5 | **Apple Developer ID Installer + notarization** va **Windows Authenticode** | Apple/Windows dasturchi akkauntlari |
| 6 | **Marketplace listing kontenti** — 16/19 maydon matni, skrinshot, video | Marketing kontenti (CC skelet beradi) |
| 7 | **Lemon Squeezy LIVE rejimi** + webhook secret + store id | LS konsol sozlamasi |
| 8 | **Resend domen DKIM/SPF** (email fail-closed shusiz) | DNS + Resend akkaunt |
| 9 | **2FA enrol** → `ADMIN_REQUIRE_2FA` | Shaxsiy 2FA qurilma |
| 10 | **Lawyer review** — huquqiy sahifalar (L9: yuridik nom, yurisdiksiya, min. yosh) | Yurist |
| 11 | **Katalogni to'ldirish** — hozir prod'da ~15 aset, landing "10,000+" deydi | Kontent yuklash |

**Ega jami: 11 blok** (asosan launch-checklist, kod emas).

---

## 4. Qisqa javob

- **Nechta muammo:** eng oxirgi audit **127 topilma** deb belgilagan (ID bilan ~143 band); bu avvalgi COWORK auditi va direktor daftarini **qayta tekshirib ichiga olgan** deduplikatsiya qilingan to'plam — ustiga qo'shilmaydi.
- **Claude Code qiladigan:** ~135 band (deyarli hammasi — kod/konfiguratsiya). Tartib: bugun 7 ta P0/P1 → shu hafta 11 ta pul+zanjir → shu oy qolgan bloklar.
- **Ega qiladigan:** 11 blok (DB tiklash, sertifikatlar, parol rotatsiya, LS/monitoring/DNS akkauntlari, lawyer, katalog).

> Muhim tartib: avval **prod DB tiklash + monitoring** (ega), keyin **pul-zonasi 3 P0** (CC: M1, M2, B3), keyin qolgani. Pul zonasiga har tuzatish web+plagin bilan birga va imzolangan-quote/atomik-guard naqshiga tegmasdan.
