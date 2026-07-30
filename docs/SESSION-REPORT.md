# Sessiya hisoboti — 2026-07-30 (BATCH 0 + BATCH 1)

**Manba:** `docs/REJA-CLAUDE-2026-07-30.md`

## BATCH 0 — favqulodda (bajarildi)
- **#1 (P0)** `scripts/clear-assetflow-demo.mjs` qayta yozildi: prod-DB guard (URL belgilari), tasdiq so'rovi, `--dry-run/--yes/--all-users`, ko'lamli `where` (demo user yoki `demo-*` prefiks). `deleteMany({})` HECH QAYERDA yo'q; `CLAUDE.md` buyrug'iga ogohlantirish qo'shildi.
- **#155** `.dockerignore` → `_to_delete`. **#115** eski `render.yaml` o'chirildi.

## BATCH 1 — pul oqimi (bajarildi)
- **#5** oylik kredit reset ATOMIK (`updateMany` + `aiCreditsResetAt < start`).
- **#6/#43** `refundAiCredits` atomik increment + ceiling/skip loglari.
- **#8** `DELETE /gen/:jobId` — `queued|running` uchun 409 `GENERATION_ACTIVE`.
- **#39** `generation.create` xatosida DOIM refund (P2002 yo'lida ikki marta emas).
- **#40** `activeGenerations` hisoblagichi + `claim/releaseGenerationSlot` (3 ta terminal o'tishda release, drift o'z-o'zini tuzatadi).
- **#41/#7/#42/#123** yagona narx yo'li `priceGeneration()` — DB `enabled` gate, provayder tannarx floor'i (faqat o'lchangan/jadval manbasi), `/gen`da server-tomon qayta narxlash → 409 `PRICE_CHANGED`.
- **#44** kvota yonishidan OLDIN asset mavjudligi tekshiriladi (pack + mogrt).
- **#14** 3 ta `void recordTemplateDownloadEvent` → `await` (Cloud Run throttle).

**⚠️ Migratsiya kutilmoqda:** `20260730120000_active_generations_counter` — prodga men qo'llamadim.
**Qilinmadi:** #13 (Explore earning hovuzi) — egasi qarori kerak (reja §2).
`npm run build -w apps/api` ✓ o'tdi.
