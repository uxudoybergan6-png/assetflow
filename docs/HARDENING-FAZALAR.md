# FrameFlow — Hardening Fazalari (launch oldidan)

*2026-07-08 · Barcha audit topilmalari (miqyos + biznes-mantiq + red-team) → fazalarga bo'lingan.*
Manba: docs/THREAT-REGISTER.md (to'liq tafsilot). Kontent quvuri F1–F6 tugagan; bu — undan keyingi
xavfsizlik/abuse/miqyos qatlamи. Har faza bitta yaxlit Code prompt. ⚠️ ko'pi PUL-ZONA — ehtiyot, minimal diff.

Tartib ustuvorlik bo'yicha: pul-yo'qotish → huquqiy → DoS → onboarding → ko'rinish.

---

## HF-1 — Pul-abuse yopish (guards) 🔴 eng katta biznes-xavf
- Earning farming: **self-download exclusion** (yuklovchi=muallif→0) + **dedup** @@unique(userId,templateId) yoki
  per-user daily cap + **pack-route rate-limit** + earning'ga **email-verify gate**.
- **Admin/test download** earning yozmasin (charged download'дагина).
- **COST_QUOTE_SECRET** prod'да FATAL (JWT fallback olib tashlash).
- Gen **daily cap** persistent (Redis/DB, in-memory emas) + **global $ ceiling default** + DB-xato fail-CLOSED.
- **Global ceiling to'liq**: har enabled model non-null USD estimate (aks holda gen rad yoki konservativ default).
- **Multi-account** bepul kredit throttle (device/IP heuristika, yangi-hisob velocity).
- **Reference upload** storage quota'ga hisoblansin (SavedReference.sizeBytes).
> Manba: THREAT H1,H6,H7,H8,M5,M6,M7.

## HF-2 — Payout modeli: revenue-share (obunaga bog'lash) 🔴 qaror + qurish
- Qat'iy per-download tsent → **obuna daromadi havzasi** contributor'larga **legitim download ulushi** bo'yicha.
- Legitim = pullik + email-tasdiqlangan + muallif emas + per-user-template bir marta.
- Admin panel: havza hajmi + har contributor ulush → payout + **firibgarlik bayroqlari** (bir hisob/IP/yangi-hisob dominant).
- ⚠️ Biznes qaror: avval per-download vs revenue-share tasdiqlanadi, keyin quriladi. HF-1 guards ustiga.
> Manba: USER talab + THREAT H1.

## HF-3 — Skan/moderatsiya gate (huquqiy/kontent xavf) 🔴
- **/templates/:id/assets** pack yo'lida malware scan chaqirilsin (hozir skansiz→null).
- **Download + approve gate'lar** packScanStatus=null/pending'ni **fail-closed** ("skanlanmagan" deb blokla).
- **Auto-approve** (requireApproval=false) rejimida ham packScan gate ishlasin.
- **Fail-open env → fail-closed default** + prod ENV checklist (MODERATION_API_KEY, VIRUSTOTAL, MODERATION_MODERATE_OUTPUTS,
  CORS_ORIGIN, ceiling, COST_QUOTE_SECRET).
> Manba: THREAT H2,H3,M4 + fail-open ro'yxati.

## HF-4 — DoS / miqyos (eski Faza 7) 🔴 "5000 shablon ko'taradimi"
- **Katalog + admin navbati PAGINATSIYA** (take/cursor) + **N+1 yechish** (S3 asset-flaglarni DB'ga saqlash yoki batch/cache).
- **Unauth katalog rate-limit**.
- **Contributor route rate-limit** (ingest/pack-uploaded/assets) + **ingest concurrency cap**.
- **.aep→.zip download streaming** (2× RAM buferlashni olib tashlash).
- **Bulk-approve** pack re-scan'ni async/queue (200 item timeout).
- **CDN_BASE_URL prod'да** o'rnatilganini tasdiqla (aks holda preview 24h signed→qora).
> Manba: MIQYOS AUDIT + THREAT H4,H5.

## HF-5 — Onboarding / rol / kirish 🟡
- **Register doim USER** (`asContributor:true` self-serve olib tashlansin) → contributor faqat request→admin-approve.
- **Legacy role endpoint** (contributor.ts PATCH /users/:id/role) o'chir (last-admin/audit yo'q).
- **Multer** ownership-check'dan **oldin** yozmasin (cross-tenant disk / DoS).
- SSE upload-progress + /api/logs write auth/rate-limit; admin upload-url folder sanitize.
> Manba: THREAT M1,M2,M3,L3,L4,L5.

## HF-6 — Ko'rinish + sayqal 🟡🟢
- **Contributor scan-status badge** (karantin/dublikat/pending ko'rinsin — hozir "Pending" bo'lib o'lik qoladi).
- **Contributor earnings UI** (endpoint bor, ekran yo'q).
- **Web detail hero poster** (video qora-kadr → poster=thumbUrl).
- Web download **shablon-nomли**; ".zip" yorlig'ini .aep'ga moslash; hasPack nomuvofiqligi.
- **Plagin o'lik sahna kodi** tozalash (renderSceneCard, eski scene-import yo'li).
- **Admin count moslash** (Pro/Free removed, "Active"=7-kun, "Total downloads" manbaи).
- signed thumb/preview uzoq-panel re-sign; source:"web"; multi-scene earning.
> Manba: MIQYOS + VISIBILITY + THREAT L1,L2,L6,L7.

---

## Ketma-ketlik va parallel
- **Tartib:** HF-1 → HF-3 → HF-4 → (HF-2 qaror bo'lsa) → HF-5 → HF-6. (Pul+huquq+DoS avval; ko'rinish/sayqal keyin.)
- **Parallel xavfsiz juftlik:** HF-4 (asosan plugin.ts/catalog + rate-limit infra) yoki HF-6 (UI) — HF-1/HF-3 (money+scan backend) bilan
  ba'zan bir faylga (plugin.ts, contributor.ts) tegadi → EHTIYOT; bir vaqtda bir faylga 2 sessiya QILMA. UI-only (HF-6 frontend)
  backend faza bilan parallel bo'la oladi.
- Har faza pul-zonaga tegsa: minimal diff, mavjud atomik mantiqni buzmaslik, jonli test.

## Eslatma — bu FAZA emas, jonli tasdiq (yig'ilgan)
`.trim`-keyin AE import · deploy-keyin AI metadata · AE'da 3 font · 753MB streaming · ?app filtr · push+migrate:deploy (F6b ustun).
