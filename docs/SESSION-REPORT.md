# Sessiya hisoboti — 2026-07-07 · QA production bugfix (P1 CSP + P2)

**Nima qilindi (2 commit):**
1. **P1 KRITIK (CSP)** — getframeflow.app'da SPA path route'lar (/templates …) `/*` qoidasidagi
   'unsafe-eval'SIZ CSP olardi ('unsafe-eval' faqat `/` va `/index.html`da edi) → dc-runtime
   `new Function` bloklanib butun interaktivlik o'lik. Tuzatish: `prepare-cf-pages.mjs`da BITTA
   platforma-darajali CSP (eval+blob) hamma yo'lga; connect/img allowlist o'zgarmagan.
   Bonus: path deep-link (/templates → Templates ekrani) qo'shildi.
2. **P2** — #5 kredit "✦0"/bo'sh-holat chaqnashi (creditsLoaded/gensLoaded + "…"); #6 "from ✦N"
   endi deterministik (katalog kelguncha "…", fallback ko'rsatilmaydi); #7 device.html dark/lime
   tema; #7/#8 GIS tugmalari EN (gsi/client?hl=en + locale:'en' — platform, login, device);
   #8 admin-login "Parol"→"Password"; #9 email input — #1 kaskadi, kod sog' (tekshirildi).

**Tekshirildi (lokal CF-simulyatsiya: dist + real CSP header + API proxy):** EvalError yo'q,
login/nav/filtrlar/AI composer/account tablar ishlaydi, kredit "✦…→✦25", SFX barqaror ✦4.
**Kutilmoqda:** push + CF Pages deploy; deploy'dan keyin production'da /templates smoke-test.
