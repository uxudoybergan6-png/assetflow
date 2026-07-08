# Ingest infra: retention + katta zip uchun Cloud Run sozlamalari (FAZA 6a)

Kod tomoni `apps/api/src/lib/ingest-zip.ts` + `apps/api/src/routes/contributor.ts`
(`ingestOneZip`) da. Bu hujjat — **USER qo'lda bajaradigan** infra qadamlar.

## 1. GCS lifecycle — eski `incoming/` ziplarni avto-o'chirish (USER qadami)

Kod muvaffaqiyatli/doimiy-rad bo'lgan incoming zipni o'zi o'chiradi. Bu qoida —
zaxira to'r: yiqilgan/retry qilinmagan yuklashlar 7 kundan keyin tozalanadi.

`lifecycle.json`:

```json
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 7, "matchesPrefix": ["incoming/"] }
    }
  ]
}
```

Qo'llash (bucket nomi = Cloud Run'dagi `AWS_S3_BUCKET` env qiymati):

```bash
gcloud storage buckets update gs://<BUCKET_NOMI> --lifecycle-file=lifecycle.json
# tekshirish:
gcloud storage buckets describe gs://<BUCKET_NOMI> --format="yaml(lifecycle)"
```

⚠️ `matchesPrefix` faqat `incoming/` ga tegadi — `templates/` (doimiy asset'lar)
va boshqa prefikslar ta'sirlanmaydi.

## 2. Cloud Run — katta zip (500MB+) uchun timeout/memory (USER qadami)

Muhim fakt: Cloud Run'da `/tmp` = **tmpfs (xotira)**. Ingest vaqtinchalik diskka
zip + ochilgan pack + preview yozadi → cho'qqi tmp sarfi ≈ **2× zip hajmi**
(753MB zip ≈ ~1.5GB xotira faqat fayllar uchun, jarayon xotirasidan tashqari).
753MB holatdagi yiqilish shu chegara bilan mos.

Tavsiya (xizmat nomini o'zingiznikiga almashtiring):

```bash
gcloud run services update assetflow-api \
  --memory=4Gi --cpu=2 --timeout=900
```

- `--memory=4Gi` — 1GB gacha zip xavfsiz (2GB+ zip kutilsa 8Gi).
- `--timeout=900` — bitta so'rovda bir nechta katta zip ketma-ket ishlanadi
  (download+hash+upload); default 300s yetmasligi mumkin. Max 3600.

Agar so'rov baribir timeout bo'lsa: shablon endi YARIM holatda QOLMAYDI —
kompensatsiya yozuvni o'chiradi, incoming zip saqlanadi, UI xato ko'rsatadi va
qayta "Upload & process" bosish xavfsiz retry qiladi.

## 3. Ingest chegaralari (env, ixtiyoriy)

| Env | Default | Ma'no |
|---|---|---|
| `INGEST_MAX_UNCOMPRESSED_BYTES` | 5 GiB | zip ichidagi umumiy ochiq hajm capi (zip-bomb) |
| `INGEST_MAX_ENTRIES` | 5000 | zip entry soni capi |
| `INGEST_MAX_COMPRESSION_RATIO` | 1000 | >10MB entry uchun siqish nisbati capi |

## 4. Asset tozalash holati (ma'lumot uchun, kod allaqachon qiladi)

- Muvaffaqiyatli ingest → incoming zip o'chadi.
- Doimiy rad (loyiha fayli yo'q / zip-bomb / zip-slip / malware) → incoming zip
  o'chadi + `template.ingest_rejected` audit yozuvi.
- Duplicate (o'z packHash / qayta ingest) → incoming zip o'chadi, ikkinchi nusxa yaratilmaydi.
- Shablon DELETE → `deleteTemplateAssets` `templates/<id>/` ni tozalaydi (mavjud).
- Asset yuklash yarim yo'lda yiqilsa → kompensatsiya: DB yozuvi + yarim asset'lar
  o'chadi, incoming zip retry uchun QOLADI.
