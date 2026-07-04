# DR-RUNBOOK — FrameFlow tiklash yo'riqnomasi

> Ma'lumotlar bazasi (Neon Postgres) va assetlar (GCS bucket) uchun zaxira + tiklash.
> Bosqich 1 #8. Yakuniy yangilanish: 2026-07-04.

## 1. Nimalar zaxiralanadi

| Manba | Zaxira mexanizmi | Joylashuv |
|---|---|---|
| **Postgres (Neon)** | (a) Neon o'z branch/PITR; (b) mustaqil `pg_dump` → GCS | `gs://<BACKUP_GCS_BUCKET>/db/` |
| **Assetlar (GCS)** | Object versioning + (ixtiyoriy) lifecycle | asosiy bucket (`AWS_S3_BUCKET`) |

Mustaqil DB nusxa provider-lock'siz (Neon hisobiga kirish imkonsiz bo'lsa ham tiklash mumkin).

## 2. DB backup (kod)

- Skript: [`scripts/db-backup.mjs`](../scripts/db-backup.mjs) — `pg_dump -Fc` (custom, siqilgan) →
  `./backups/frameflow-<UTC>.dump`; `BACKUP_GCS_BUCKET` bo'lsa `gcloud storage cp` bilan GCS'ga yuklaydi.
- Qo'lda: `DATABASE_URL=... BACKUP_GCS_BUCKET=frameflow-db-backups node scripts/db-backup.mjs`
- Avtomatik: [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml) — kunlik 03:00 UTC.

### 2.1 Manual sozlash (BIR MARTA — kod bilan qilib bo'lmaydi)

```bash
# 1) Backup bucket + versioning
gcloud storage buckets create gs://frameflow-db-backups --location=europe-west1
gcloud storage buckets update  gs://frameflow-db-backups --versioning

# 2) (ixtiyoriy) 30 kundan eski backup'larni avtomatik o'chirish
cat > /tmp/lifecycle.json <<'JSON'
{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}
JSON
gcloud storage buckets update gs://frameflow-db-backups --lifecycle-file=/tmp/lifecycle.json

# 3) Deployer SA'ga yozish huquqi
gcloud storage buckets add-iam-policy-binding gs://frameflow-db-backups \
  --member="serviceAccount:github-deployer@project-289028d3-984c-4d84-bd4.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# 4) Repo secret/var
#    GitHub → Settings → Secrets and variables → Actions → New variable
#    BACKUP_GCS_BUCKET = frameflow-db-backups
```

## 3. DB tiklash (restore)

### Variant A — mustaqil pg_dump nusxadan (asosiy DR yo'li)

```bash
# 1) Kerakli backup'ni GCS'dan oling
gcloud storage cp gs://frameflow-db-backups/db/frameflow-2026-07-04_03-00-00.dump ./restore.dump

# 2) BO'SH/yangi target DB'ga tiklang (Neon: yangi branch yoki yangi DB yarating).
#    -Fc dump → pg_restore. --clean --if-exists mavjud obyektlarni almashtiradi (EHTIYOT: to'g'ri
#    target ekaniga ishonch hosil qiling — bu ma'lumotni ustiga yozadi).
pg_restore --no-owner --no-acl --clean --if-exists \
  -d "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" ./restore.dump

# 3) Sxema/migratsiya holatini tasdiqlang
DATABASE_URL="<yangi-target>" npm run migrate:deploy -w @creative-tools/database
```

### Variant B — Neon PITR (tez, oxirgi nuqtaga)

Neon konsolida: Project → **Restore** / **Branches** → kerakli vaqt nuqtasiga branch yarating,
so'ng Cloud Run `DATABASE_URL`'ni yangi branch connection string'iga o'zgartiring
(`gh secret set CLOUDRUN_ENV_YAML` orqali — [[faza-e-platform-api-2026-07]]) va qayta deploy.

### 3.1 Deploydan keyin

- `/health` (readiness) 200 qaytishini tekshiring: `curl https://<api>/health` — `db: ok`.
- Kritik oqim: plugin login → `/api/plugin/catalog` → 1 ta kichik gen.

## 4. Asset (GCS) tiklash

Asosiy bucketda **object versioning** yoqilgan bo'lsa, o'chirilgan/ustiga yozilgan obyektni tiklash mumkin.

```bash
# Versioningni yoqish (BIR MARTA — manual)
gcloud storage buckets update gs://<AWS_S3_BUCKET> --versioning

# Obyekt versiyalarini ko'rish
gcloud storage ls --all-versions gs://<AWS_S3_BUCKET>/<key>

# Ma'lum generation (versiya) ni tiklash
gcloud storage cp "gs://<AWS_S3_BUCKET>/<key>#<generation>" "gs://<AWS_S3_BUCKET>/<key>"
```

> Assetlar (thumb/preview/pack/gen natijalari) key bo'yicha versiyalangan va deyarli o'zgarmas —
> versioning tasodifiy o'chirish/buzilishdan himoya qiladi. Katalogdagi asosiy manba baribir DB;
> shu sabab DB restore + versioning birga to'liq tiklashni beradi.

## 5. Tashqi qadamlar (bajarilmagan — sizdan)

- [ ] Backup bucket yaratish + versioning (yuqoridagi 2.1).
- [ ] `BACKUP_GCS_BUCKET` repo var + deployer SA IAM.
- [ ] Asosiy asset bucket'da versioning yoqish (bo'lim 4).
- [ ] Kvartalda BIR MARTA restore mashqi (backup haqiqatan tiklanishini tasdiqlash).
