# SESSION REPORT — 2026-06-15 — AI kredit boshqaruvi (admin) + ADMIN cheksiz ✅

"Kredit yetarli emas" — ichki aiCredits (FREE 50/oy) tugagan, OpenRouter EMAS (gate'gacha yetdi ✅).

## Backend
- **`consumeAiCredits` — ADMIN bypass**: `profile.user.role==="ADMIN"` → cheksiz, kredit kamaymaydi
  (ega erkin test qiladi).
- **`mapSubscriberRow`** — `aiCredits` + `aiCreditsMonthly` qaytaradi (admin UI ko'rsatadi).
- **PATCH /admin/plugin-subscribers/:userId** — `aiCredits` maydoni qo'shildi (set). Birga
  `aiCreditsResetAt=now` (shu oy avtomatik reset qiymatni qayta yozmasin).

## Frontend (admin-subscribers.js)
- Obunachi detalida **"⚡ AI kredit (N)"** tugmasi → `openAiCreditsSub` modali (yangi qiymat input +
  "Free 50"/"Pro 1000" tezkor) → `doAiCreditsSub` → `patchPluginSubscriber({aiCredits})`.

## Demo (test davom etsin)
`user@assetflow.uz` aiCredits → **1000** (SQL update). API tasdiq: `/studio/credits` = 1000.

## Tekshirildi
- `tsc -p apps/api` EXIT 0 ✅
- Smoke: demo /studio/credits=1000; admin PATCH aiCredits=777→200 (item.aiCredits:777);
  admin o'zi consume'da bypass (cheksiz) ✅
- `node --check` admin-subscribers.js TOZA ✅; `studio:sync` (2x) artefaktlar izchil ✅

## Holat
Commit foydalanuvchi so'raganda. Endi admin har obunachiga AI kredit bera oladi, ADMIN o'zi
cheksiz — OpenRouter kaliti qo'shilgach generatsiya testi kreditdan to'siqsiz davom etadi.
