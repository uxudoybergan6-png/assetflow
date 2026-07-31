# Sessiya hisoboti — 2026-07-31 (dizayn fix-kampaniya: D0, D1)

**BATCH D0 — Neon compute kvota (P0, commit a8f92c5).** Auditning taxmini (`minScale=1` + 10-daq
reconciler) NOTO'G'RI edi: haqiqiy uyg'otuvchilar `savedRef cleanup` (2 daq) va `gen resume` (30 s)
qat'iy `setInterval`lari — bo'sh baza ham 24/7 compute yozardi. Yangi `apps/api/src/lib/idle-timer.ts`
(`startAdaptiveTimer`): bo'sh passda kechikish 1 soatgacha ikkilanadi, ish topilsa/`nudge()` bo'lsa
baza intervalga qaytadi. 4 jadvalga qo'llandi. Pul zonasi tegilmagan. `minScale=0` rad etildi
(fire-and-forget fon ishlari muzlaydi). P0-2/P0-3 — jonli tekshirildi, "no change needed".

**BATCH D1 — klaviatura + fokus a11y (6/6).** (1) `js/ui.js`: umumiy div-checkbox qatlami
(role/tabindex/aria-checked + Space/Enter delegatsiya + MutationObserver → dinamik render ham);
(2) plagin `.axws-promptwrap:focus-within` halqa + `.axig .pbox:focus-within` no-op qoida tuzatildi;
(3) platforma top-nav `.va-search:focus-within`; (4) verify/reset/device: label 8px→10.5px +
`:focus-visible`; (5) CEP Admin: global Escape, aria-label (↻/×/🗑), `:focus-visible`, mini-btn ≥30px;
(6) contributor interaktiv qatorlar `role=button tabindex=0 data-kbd-click`.
**Tekshirildi:** Space/Enter toggle (statik+dinamik), Escape 2 overlay, real Tab halqasi, plagin
halqalari 3 temada (noir/neon/cold), `#aiPage.axws-tool` balandlik zanjiri va `test:plugin-responsive` — OK.

**Keyingi qadam:** D2 (CEP Admin panel) → D3–D9. Egasi tomonida: Neon upgrade / 1-avg reset, keyin 8 migratsiya.
