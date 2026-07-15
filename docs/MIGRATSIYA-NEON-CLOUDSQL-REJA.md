# Neon → Google Cloud SQL ko'chirish rejasi (TAYYORGARLIK)

> 🔴 EGA QARORI (2026-07-14): baza Neon'dan Google Cloud SQL (PostgreSQL)'ga ko'chadi.
> VAQTI: V2 + audit muammolari TUGAGACH. Bu hujjat — oldindan tayyorgarlik. HOZIR ko'chirilMAYDI.
> Ko'chirish = alohida "maydonda" (jonli test), ega + Code birga, boshqa ish parallel EMAS.

## 0. Hozirgi holat (kod tasdig'i)

- **Baza:** Neon PostgreSQL, region **eu-central-1 (Frankfurt)**, pgbouncer pooling.
- **ORM:** Prisma. Ikki URL: `DATABASE_URL` (pooled — app o'qiydi) + `DIRECT_DATABASE_URL`
  (migratsiyalar — pgbouncer prepared-statement'ni qo'llamaydi, shu sabab direct).
- **App:** Cloud Run **europe-west1**. Pooling knob: `DATABASE_CONNECTION_LIMIT` (env-gated,
  `packages/database/src/index.ts`).
- **Migratsiyalar:** `prisma migrate deploy` (`npm run migrate:deploy -w @creative-tools/database`).
- **Mavjud DR hujjat:** `docs/DR-RUNBOOK.md` (connection pooling, backup) — ko'chirishда qayta o'qi.
- **Xavf:** Neon bepul tarif 100-soat/oy limiti — tugasa sayt o'ladi. Ko'chguncha oraliq chora =
  Neon Launch 1 oyga (bu qarorni bekor qilmaydi, ko'prik).

## 1. Oldindan QARORLAR (ega — ko'chirishdan oldin belgilash)

| Qaror | Tavsiya | Izoh |
|-------|---------|------|
| Region | **europe-west1** (Cloud Run bilan BIR joy) | Frankfurt→Belgiya ~10ms; muhim: app bilan yaqin |
| Instance tier | **db-custom-1-3840** (1 vCPU / 3.75GB) start | Kichik; keyin ko'tarish oson. Launch'da monitoring bilan sozlanadi |
| PostgreSQL versiya | Neon'dagi bilan BIR XIL major (15 yoki 16 — tekshir) | Major farqi = qo'shimcha moslik testi |
| HA (High Availability) | Launch'gача **yo'q** (single zone), daromad kelганда regional HA | HA ~2x narx; hozir shart emas |
| Ulanish | **Cloud SQL Auth Proxy** (Cloud Run uchun sidecar/connector) | Private IP + IAM; parol URL'да ochiq turmaydi |
| Backup | Avtomatik kunlik + PITR (point-in-time) YOQ | Neon'да bor edi — Cloud SQL'да ham yoqiladi |

## 2. Ko'chirish QADAMLARI (ketma-ket)

### Faza 0 — Tayyorgarlik (ega, downtime YO'Q)
1. GCP loyihada **Cloud SQL Admin API** yoqilsin.
2. Cloud SQL PostgreSQL instance yaratilsin (yuqoridagi tier/region/versiya).
3. Baza + foydalanuvchi yaratilsin (masalan `frameflow` / kuchli parol — Secret Manager'да).
4. Cloud SQL Auth Proxy o'rnatilsin (lokal test uchun) yoki Cloud Run connector sozlansin.
5. `DR-RUNBOOK.md` qayta o'qilsin.

### Faza 1 — Sxema (Code yordam beradi, downtime YO'Q)
6. Yangi bazaga sxema qo'yiladi: `DIRECT_DATABASE_URL` = yangi Cloud SQL → `prisma migrate deploy`.
   → Migratsiyalar TOZA yangi bazada ishlashi tasdiqlanadi (bo'sh sxema).
7. Prisma migratsiya holati tekshiruvi: `prisma migrate status` — barcha migratsiya "applied".

### Faza 2 — Ma'lumot ko'chirish (ega, QISQA downtime)
> 🔴 Ma'lumot yaxlitligi uchun ko'chirish paytida yozuv TO'XTATILADI (read-only oynasi).
8. Sayt "maintenance" rejimiga (yoki past-trafik oynasi — masalan tunda).
9. `pg_dump` Neon'dan (data-only yoki full):
   ```
   pg_dump "$NEON_DIRECT_URL" --no-owner --no-privileges --format=custom -f frameflow.dump
   ```
10. `pg_restore` Cloud SQL'ga:
    ```
    pg_restore --no-owner --no-privileges --dbname="$CLOUDSQL_DIRECT_URL" frameflow.dump
    ```
    (Agar sxema Faza 1'da qo'yilган bo'lsa → `--data-only`; aks holda full restore.)
11. Sequence/serial qiymatlari, extension'lar (`pg_trgm` kelajakda — hozir yo'q), `Decimal`
    ustunlar tekshiruvi. Prisma `Decimal(10,4)` — pg `numeric` bilan bir xil ko'chadi.

### Faza 3 — Almashish (ega, deploy)
12. Cloud Run env yangilanadi: `DATABASE_URL` + `DIRECT_DATABASE_URL` = Cloud SQL (Auth Proxy
    orqali). Parol Secret Manager'дан.
13. Deploy → `/health` (db+storage) tekshiruvi → OK bo'lса maintenance o'chiriladi.
14. `DATABASE_CONNECTION_LIMIT` Cloud SQL max_connections'ga moslab qo'yiladi (Cloud Run
    instans soni × limit < Cloud SQL max; kichik tier ~25-100 ulanish).

### Faza 4 — Tekshirish (ega + Code)
15. `node scripts/verify-pipeline.mjs` (API_URL=prod) — katalog, login, gen oqimi.
16. Kritik oqimlar jonli: contributor upload → admin approve → plugin sync; gen + kredit
    (ledger); to'lov webhook (LS test).
17. 🔴 Kredit ledger yaxlitligi: bir necha foydalanuvchi balansi ko'chishdan oldin/keyin BIR XIL.

### Faza 5 — Eski bazani zaxira (ega)
18. Neon **1-2 hafta faqat-o'qish** zaxira sifatida saqlanadi (darrov o'chirilMAYDI).
19. Barqaror ishlagach (1-2 hafta) — Neon obunasi to'xtatiladi.

## 3. Rollback (agar Faza 3-4'да muammo chiqsa)

- Cloud Run env'ni Neon URL'lariga QAYTARISH (Neon hali tirik, faqat-o'qish emas — yozuv yoniq
  qoldirilgan bo'lsa). Shuning uchun Faza 2 downtime oynasida yangi yozuvlar KAM bo'lsin —
  rollback'да ular yo'qolmasin (past-trafik oyna muhim).
- Agar ma'lumot ikkala bazaga tushган bo'lsa → qaysi biri "haqiqat" ekanini oldindan belgila
  (ko'chirishdan keyin Neon'га YOZUV bo'lmasligi kerak — app faqat Cloud SQL'га yozadi).

## 4. Xarajat (taxminiy, oyiga)

- Cloud SQL db-custom-1-3840 (single zone) + 10GB SSD + backup: **~$50-70/oy**.
- HA (regional) yoqilса: ~2x.
- Neon Launch (oraliq ko'prik, agar kerak bo'lsa): ~$19/oy 1 oyga.
- 👉 Bu Neon bepul (0$) + 100-soat xavfdan qimmatroq, lekin **barqaror + limit yo'q + Google
  ekotizim** (Vertex/GCS bilan bir joyda, tarmoq ichkarida).

## 5. Code'ga BERILADIGAN qism (ko'chirish vaqti kelганda)

Ko'pi ega/infra ishi. Code faqat:
- `prisma migrate deploy` yangi bazada TOZA o'tishini tasdiqlash (Faza 1).
- `verify-pipeline.mjs` + kritik-oqim tekshiruvini yangi bazaga qarshi yugurtirish (Faza 4).
- Kerak bo'lsa: `DATABASE_CONNECTION_LIMIT` va connector sozlamasini kodда tekshirish.
- ⚠️ Sxema/migratsiya FAYLLARIGA tegilMAYDI — bir xil sxema ikkala bazada.

## 6. TEKSHIRUV RO'YXATI (ko'chirish kuni)

- [ ] Cloud SQL instance UP, `/health` yangi bazani ko'radi
- [ ] `prisma migrate status` — hammasi applied
- [ ] Qatorlar soni Neon == Cloud SQL (har asosiy jadval: User, ContributorTemplate,
      Generation, GenAsset, CreditLedger, Subscription, ProviderSpend)
- [ ] Kredit balanslari bir xil (namuna 5 foydalanuvchi)
- [ ] Login (3 portal) · katalog · gen · to'lov webhook — ishlaydi
- [ ] Cloud Run env Secret Manager'dan (parol ochiq emas)
- [ ] Neon 1-2 hafta zaxira, app unga YOZMAYDI
- [ ] Rollback yo'li sinovdan o'tgan (env qaytarish)

---

*Tayyorlandi: 2026-07-14. Ijro: V2 muammolari tugagach, alohida.*
