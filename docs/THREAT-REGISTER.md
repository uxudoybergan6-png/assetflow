# FrameFlow — Tahdid Registri (Red-Team Audit)

*2026-07-08 · Direktor tashabbusi bilan proaktiv red-team (3 agent: iqtisod affe2fbe · kirish a647af9c · kontent/resurs a07a9334)*

Butun tizim hujumchi ko'zi bilan tekshirildi. **Yadro xavfsizligi kuchli** (auth/tokenVersion, IDOR yopiq,
webhook imzo, kredit ledger atomik, zip-bomb/slip stream guard, SSRF allowlist — hammasi solid). Quyida —
**qolgan abuse teshiklari**, ustuvorlik bo'yicha. Bular launch oldidan bosqichma-bosqich yopiladi.

---

## 🔴 CRIT / HIGH

**H1 — Earnings farming (kengaytirilgan).** O'z shabloningni yuklab o'zingga pul: self-exclusion YO'Q +
pack route'da rate-limit YO'Q + PRO/STUDIO unlimited-download → **cheksiz payout** (skript bilan). Sybil
(email-verify gated emas) kuchaytiradi. *Fix: self-check + @@unique(userId,templateId)/daily-cap + rate-limit
+ email-verify gate + revenue-share model (obunaga bog'lash).* (earnings.ts:32, plugin.ts:301, plugin-profile.ts:393)

**H2 — Malware-scan bypass (multipart /assets).** `/templates/:id/assets` pack yo'li skanni CHAQIRMAYDI →
packScanStatus=null. null approve gate'дан HAM download gate'дан HAM O'TADI → skanланмаган (zararli) pack
publish + serve bo'ladi. *Fix: /assets branch'да scan + gate'lar null'ni "pending" deb fail-closed ko'rsin.* (contributor.ts:1779, 2247, plugin.ts:225)

**H3 — pending/null pack yuklab olinadi.** guardDownloadable pending/null'ni bloklamaydi → skan tugamаган
(yoki hech bo'lmagan) pack APPROVED+published bo'lса serve bo'ladi. *Fix: pending/null'ni download gate'да blokla.* (plugin.ts:225)

**H4 — Katalog: unauth + paginatsiyasiz + per-item S3 fan-out.** /catalog auth yo'q, take yo'q, har shablonga
S3 ListObjectsV2+signed → istalgan anonim GET = N S3 chaqiruv → DoS + xarajat. *Fix: paginatsiya + rate-limit +
S3 flag DB/cache.* (plugin.ts:102, catalog-map.ts:175)

**H5 — Contributor route'larда rate-limit YO'Q.** /ingest (50 zip), /pack-uploaded (yuzlab MB sinxron),
/assets (3.3GB) throttle'siz → bitta contributor flood → memory/CPU/tmpfs/S3 bill portlashi. *Fix: per-user
rate-limit + ingest concurrency cap.* (contributor.ts butun router)

**H6 — COST_QUOTE_SECRET → JWT_SECRET fallback, faqat WARNING.** Prod'да o'rnatilmasa quote auth-secret bilan
imzolanadi → JWT sizsa arzon quote forge → deyarli bepul AI. *Fix: prod'да FATAL, fallback olib tashlash.* (gen-quote.ts:8, index.ts:224)

**H7 — Gen daily cap in-memory + global $ ceiling opt-in fail-open.** Cap process Map'да → multi-instance/restart
ko'paytiradi; ceiling env yo'q bo'lса umuman yo'q; DB xato → fail-OPEN. *Fix: cap Redis/DB'да, default ceiling,
ceiling DB-xato fail-closed.* (spend-guard.ts:28,86,105)

**H8 — Global ceiling under-count.** provider-cost.ts'да yo'q model → estimatedCostUsd=null → ceiling'дан
tashqarida. Yangi model qo'shsang ko'rinmaydi. *Fix: har enabled model'га non-null estimate majburiy.* (provider-cost.ts:77, spend-guard.ts:68)

---

## 🟡 MEDIUM

**M1 — Self-service CONTRIBUTOR (register asContributor:true).** Admin-approval gate'ни (endigina qurgan)
CHETLAB o'tadi. *Fix: register doim USER; contributor faqat request→admin-approve.* (auth.ts:114)

**M2 — Legacy role endpoint** (contributor.ts:2733 PATCH /users/:id/role) — last-admin himoya YO'Q, audit YO'Q.
*Fix: o'chir, hamma rol admin.ts orqali.*

**M3 — Multer ownership-check'dan OLDIN diskка yozadi.** Boshqa contributor templateId'siga multipart →
cross-tenant disk yozuv / disk-exhaustion (3.3GB). *Fix: ownership guard multer'дан oldin.* (contributor.ts:1779 vs 1800)

**M4 — Auto-approve scan gate'ни o'tkazadi.** requireApproval=false bo'lса reviewOneTemplate umuman chaqirilmaydi
→ skansiz publish. *Fix: auto-approve'да ham packScan gate.* (contributor.ts:2052,2554)

**M5 — Multi-account FREE 50 kredit** (faqat email-verify to'siq) + arzon sink (enhance/describe). *Fix: device/IP
heuristika, yangi-hisob kredit velocity throttle.* (plugin-profile.ts:145,493)

**M6 — Reference upload storage quota'ни chetlaydi** (100MB, hisoblanmaydi). *Fix: SavedReference.sizeBytes quotaga.* (studio-gen.ts:561,784)

**M7 — Admin/test download contributor earning yozadi** (guard skip'дан keyin ham). *Fix: charged download'дагина earning.* (plugin.ts:305)

**M8 — Contributor karantin/dublikatni ko'rmaydi** → shablon jimgina o'lik ("Pending" ko'rinadi, admin blok).
*Fix: contributor UI'да scan-status badge.* (contributor-views.js:172)

**M9 — Contributor earnings UI yo'q** (endpoint bor, chaqiruvchi yo'q). *Fix: earnings ekrani.*

---

## 🟢 LOW / FAIL-OPEN

- L1 web download source:"plugin" deb yoziladi (analytics). L2 forgeable downloadsCount Int hali ba'zi UI'да
  ko'rsatiladi. L3 SSE upload-progress auth yo'q. L4 /api/logs har user yozadi. L5 admin upload-url folder sanitize yo'q.
  L6 signed cost-quote user'ga bog'lanmagan (15min replay). L7 multi-scene = ko'p earning event.
- **FAIL-OPEN (env yo'q bo'lса jim o'chadi):** moderation (MODERATION_API_KEY yo'q→no-op clean; provider xato→open;
  MODERATION_MODERATE_OUTPUTS default OFF → video/audio hech qачон moderatsiya emas); malware scan hash-only
  (yangi fayl tahlil qilinmaydi, faqat karantin); CORS_ORIGIN yo'q→* ; ceiling env yo'q→yo'q. *Fix: prod env
  checklist + fail-closed default'lar.*

---

## ✅ MUSTAHKAM (tasdiqlandi — tegma)
JWT/tokenVersion revocation; IDOR yopiq (gen/session/ref/message/template ownership); 3 webhook imzo (Stripe/LS/fal);
kredit spend atomik + refund idempotent; download/import limit atomik fail-closed; PRO self-grant yo'q (Stripe/flag);
zip-bomb/slip streaming guard; SSRF allowlist (IPv4/6); presign scoping (cross-tenant yozuv yo'q); path traversal cuid regex;
Turnstile prod fail-closed; Google audience/email_verified; last-admin himoya (canonical endpoint).

---

## Yopish rejasi (ustuvorlik)
1. **Pul-abuse (H1,H6,H7,H8,M5,M6,M7):** earning farming fix (self+dedup+ratelimit+revenue-share) · COST_QUOTE_SECRET
   fatal · cap Redis+ceiling default · ref-quota. ⚠️ PUL-ZONA — ehtiyot, minimal diff.
2. **Skan/moderatsiya gate (H2,H3,M4):** /assets scan · pending/null fail-closed · auto-approve gate. (Huquqiy/kontent xavf)
3. **DoS/miqyos (H4,H5):** katalog paginatsiya+N+1 · contributor rate-limit+concurrency. (= Faza 7 miqyos)
4. **Onboarding/rol (M1,M2,M3):** register→USER · legacy role o'chir · multer ownership.
5. **Ko'rinish + LOW (M8,M9,L*):** scan badge · earnings UI · fail-open env checklist · mayda.
