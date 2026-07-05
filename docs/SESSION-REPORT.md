# Sessiya hisoboti — 2026-07-06 (FAZA 2: backend yadro, 8 qism / 8 commit)

Commitlar (main, push YO'Q): f6d61f1 media (#1 #8 #9) · favorites-sync (#17) ·
7a2f384 delete (#2 #18) · dbf73c8 storage (#20) · fecea1d vertex (#12) ·
a61d7ff billing (#25) · plans (#13) · bf630c9 web-sessiya (#14).

- #1 ildiz (jonli isbot): private GCS bucket + imzosiz public URL → 403. Thumb/preview/sahna endi signed; pack/.mogrt private (5 daq signed).
- #8/#9: video gen'ga ffmpeg poster (GenAsset.thumbKey, additive), hidratatsiya parallel (HEAD faqat sizeBytes yo'qda), plagin gen-keshlariga 25 daq TTL, history xatosi sabab+Retry.
- #17: identity allaqachon yagona (web/plagin login = bitta User id, jonli tasdiq); sevimlilar endi DB (UserTemplateFavorite + /api/plugin/favorites).
- #13: PlanConfig DB + admin GET/PUT + 60s kesh (statik fallback, seed teng) — pul-zonasi (consume/refund/quote/webhook) TEGILMAGAN.
- #25: plagin paketlari LS checkout (500/$5, 1500/$12, 5000/$35). ⚠️ LS do'konida "N Credits" variantlar hali YO'Q (VARIANT_NOT_FOUND) — yaratish kerak.
- #14: token localStorage'da edi; muammo kirish oqimida — endi sessiya borida to'g'ridan dashboard; JWT 7d→30d (tokenVersion revoke saqlangan).
- Kutilmoqda: Cloud Run deploy + `migrate:deploy` (3 yangi migratsiya) + AE jonli test + install-cep; env: GOOGLE_CLOUD_PROJECT_VIDEO (+SA cross-project).
