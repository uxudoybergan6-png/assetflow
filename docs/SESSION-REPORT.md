# SESSION-REPORT — Bosqich 4 (zanjir yaxlitligi · payout · storage)

Backend-only, additive, har item alohida commit (5 commit, PUSH YO'Q). Build toza.

- **#1 Real download tracking:** `TemplateDownloadEvent` (atomik, non-blocking) — pack/mogrt/import. Contributor stat forgeable Int emas real hodisadan (transitional fallback).
- **#2 Konsolidatsiya:** ContributorTemplate = jonli katalog manbai. Asset+Download o'lik → DEPRECATED (destructive migratsiya EMAS); `/api/users/downloads` real hodisaga o'tdi.
- **#3 Payout/Earnings:** `ContributorEarning`(idempotent downloadEventId UNIQUE) + `ContributorPayout`. DEFAULT: $0.10/download (`CONTRIBUTOR_PAYOUT_PER_DOWNLOAD_CENTS`) — **EGA QARORI** (stavka/formula, "50%"). Endpoint: /earnings, /admin/earnings, /admin/payouts.
- **#4 Storage kvota:** `GenAsset.sizeBytes`. Kvota FREE 3GB/PRO 50GB/STUDIO 200GB (env, **EGA QARORI**). /gen consume'dan OLDIN 413 rad (charge yo'q) + persist'dan keyin retention (eng eski o'chirish). Privacy tasdiqlandi (ownership + signed URL).
- **#5 Top-up carry-over (money fix):** `aiCreditsTopup` tracker — reset endi allotment+topup (sarflanmagan top-up yo'qolmaydi). Consume allotment-avval; refund ceiling +topup; lapse/upgrade saqlaydi.

**Money-logic tasdiq:** atomik consume gate, signed cost-quote (0 diff), idempotent refund claim, ADMIN ozodligi — TEGILMAGAN. Migratsiyalar additive (4 ta, DROP yo'q) — `migrate:deploy` ISHLATILMADI.
