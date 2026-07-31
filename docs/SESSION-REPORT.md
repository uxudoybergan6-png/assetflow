# Sessiya hisoboti — 2026-07-31 (PRODUCTION INSIDENT: DB DOWN)

**Vazifa:** `api.getframeflow.app/health` → `db: down`, `/api/plugin/catalog` 500 — sababini topish.

**Topildi (root cause):** Neon PostgreSQL bepul tarifining oylik compute-vaqt kvotasi tugagan.
psql bilan to'g'ridan-to'g'ri ulanishda Neon xatosi: *"Your account or project has exceeded the
compute time quota. Upgrade your plan to increase limits."* `DATABASE_URL` to'g'ri, TCP ochiq,
storage ok, Cloud Run loglari toza — muammo faqat Neon kvotasi, deploy/secret emas.

**Nega tugadi:** Cloud Run `minScale=1` + `cpu-throttling=false` (24/7 yoniq instans) +
`template-reconcile.ts` har 10 daqiqada DB so'rovi → Neon autosuspend (5 daq) samarasiz,
compute deyarli doim uyg'oq → oy oxirida (30–31 iyul) kvota tugadi. Har oy takrorlanadi.

**Kutilmoqda:** (1) darhol tiklash — Neon planini upgrade (egasi, billing) YOKI 1-avgust kvota
resetini kutish (Prisma o'zi qayta ulanadi, restart shart emas); (2) takror bo'lmasligi uchun
reconciler intervalini oshirish / paid plan; (3) oldingi batchlardan 8 migratsiya hali prod'ga qo'llanmagan.
