# Sessiya hisoboti — 2026-07-06 · FAZA 5 BUILD (Variant A web-app redesign)

**Nima qilindi:** `_webapp-redesign-mockup.html` Variant A (editorial) jonli platformaga port qilindi — `platform/index.html`, 4 ta login-ekran + umumiy shell (5 commit).
1. **Shell** — sidebar o'rniga Variant A top-nav (logo · 4 link · qidiruv · ✦credpill · avatar), inline SVG ikonlar (`va-ic` symbol to'plami), mobil pastki tablar (va-mtabs).
2. **Home (A1)** — hero salomlashuv + kredit-karta (balans/bar/reset) + 3 gradient quick-action + "Jump back in" (gen tarixi, IMAGE·✦5 teglar) + "Recommended for you".
3. **Katalog (A2/A2b)** — qidiruv hero + kategoriya chiplar + fbar (App/Free-Pro dropdown, 16:9/9:16/1:1, HD/4K, sort) + detal endi alohida SAHIFA (crumb, specs, 2 CTA, gate eslatma, More like this). Eski modal/rail/drawer olib tashlandi — filter state/handlerlar o'sha-o'sha.
4. **AI Studio (A3/A3b)** — tool-picker (4 media karta, "from ✦N" real model katalogidan) → canvas + suzuvchi dock (mode/model/aspect/quality/res/duration/voice/count chiplari, Enhance, "2 × ✦5 = ✦10" quote, Generate) + "This session" strip (sarf hisoblagichi). Voice/SFX ham shu dock'dan.
5. **Account (A4)** — chip tablar (Profile / Subscription & credits / Downloads), plan-karta + katta kredit-karta + 3 pack (real narxlar $5/$12/$35) + Credit activity ledger.

**Saqlangan logika (diff'da tegilmagan):** quote→gen→poll→refund, checkout/packLink, auth/sessiya, katalog filtr/qidiruv, kredit yangilash. `git diff`da FFAPI pul chaqiriqlari 0 qator.
**Deviatsiyalar:** detal CTA hamma planda "Download pack" (gate backend'da, eslatma matn bilan); Security tab yo'q (real sozlama yo'q); ledger "model·params" o'rniga prompt (mapGen'da model yo'q); fmtDate/fmtDay uz-UZ→en-US.
**Tekshirildi:** stub-FFAPI harness (scratchpad) bilan 1280/390 skrinshotlar barcha ekranlarda mockupga solishtirildi; generate/filtr/lightbox/kredit-modal jonli test o'tdi; gorizontal overflow yo'q.
**Kutilmoqda:** push + CF Pages deploy; real API bilan smoke-test (getframeflow.app).
