# Sessiya hisoboti — 2026-07-12 (BATCH6 Prompt #1 — PRODUCTION tema poydevori)

- Manba: docs/mockups/batch6 → PRODUCTION packages/assetflow-studio/platform/index.html (CF Pages direct-source).
- **3-tema token qatlami**: `:root[data-theme="noir|neon|cold"]` (rang/surface/border/accent/grad/danger + radius/space/motion shkala). Default noir.
- **Compat shim**: eski lime `.ff` o'zgaruvchilari (`--acc/--lime/--txt/--bd/--grad/--surface/--text/--muted/--border`…) → theme tokenlariga bog'landi; hech bir sahifa buzilmadi. Eski Cyan/Amber accent-picker neytrallandi; `landingAccentVars` inline override o'chirildi.
- **Tipografiya**: Space Grotesk (display h1-h4) · Inter (body) · JetBrains Mono (label); Google Fonts link (CSP allaqachon ruxsat — audit #17); hanken font-stack → Inter.
- **Global chrome**: ffm-nav brand-mark gradient + Space Grotesk, Plugin'da NEW badge (JetBrains Mono), footer bg → bg-deep. Nav/footer chrome'da hardcode lime = **0**.
- **Tema almashtirgich**: html[data-theme], localStorage `ff-theme`, FOUC-siz (head snippet), header swatch picker (dc re-render'dan MutationObserver bilan omon qoladi), reload'siz oniy almashish.
- Tekshirildi: node --check (dc/switcher/fouc OK); 3 tema landing skrinshot (oniy almashadi, persist); konsol xatosiz; footer/brand/NEW/link computed-style theme-aware.
- Qoldiq: 103 bo'lim-darajali lime literal (ffl-/ffm-plan/AI karta/kredit-pack) — keyingi bo'lim redizayn promptlarida. studio:sync SHART EMAS (platform direct-source).
