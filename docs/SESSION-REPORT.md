# Sessiya hisoboti — 2026-07-08 (FAZA 6b: rol boshqaruvi + onboarding)

**Nima qilindi (3 commit):**
1. `96575c1` — login.html/admin-login.html/README'dan "UPDATE User SET role" SQL hint'lari olib tashlandi (grep toza, dist qayta yaratildi).
2. `69d39a5` — Rol boshqaruvi: `GET /api/admin/users` (qidiruv/rol/pending), `PATCH /api/admin/users/:id/role` (last-admin guard tranzaksiyada, audit `user.role_change`), `DELETE .../contributor-request`; admin "Users & roles" ekrani (adx-, pending so'rovlar kartasi, rol dropdown+confirm modal, nav badge). Eski himoyasiz GET/PATCH /users olib tashlandi (UI chaqirmasdi).
3. `d3f33e5` — Onboarding: `contributorRequestedAt` (additive migration), `POST /api/users/contributor-request` (idempotent, audit), login.html'da USER kirsa "Request contributor access" paneli.

**Topildi:** admin.ts'da eski himoyasiz PATCH /users/:id/role bor edi (auditsiz, guard'siz) — almashtirildi. login.html meta production API'ni hardcode qiladi (lokalda ham) — tegilmadi, mavjud xatti-harakat.

**Tekshirildi (lokal jonli):** request→pending→approve→CONTRIBUTOR, dismiss, last-admin 409, invalid rol 400, 404, non-admin 403, har o'zgarish auditda; admin UI (modal/badge/pending karta) skrinshot bilan.

**Kutilmoqda:** git push + Cloud Run deploy + production `migrate:deploy`, keyin production smoke-test.
