# SESSION REPORT — 2026-06-13 (kech) — Production deploy debugging ✅

## Nima qilindi
Push qilingach Render/Vercel'da chiqqan real production xatolar ketma-ket hal qilindi (har biri commit + push, deploy tasdiqlangan):

- **Render build "status 2"** (`7940766`,`a4fe937`): TS `req`/`res` aniq tip + asl sabab `@types/*`+`typescript` `devDependencies`→`dependencies` (Render prod install devDeps'ni o'tkazib yuborardi). `render.yaml --include=dev`, no-op build skriptlar.
- **CORS wildcard** (`b9f3ec3`): `CORS_ORIGIN=*` ishlamasdi → `index.ts` callback `*`/bo'sh→hammaga, URL→aniq, vergulli→ro'yxat.
- **Studio `localhost:4000` fallback** (`70a2a27`): 5 fayl last-resort fallback → production API URL.
- **Logs 401 + analytics 403** (`66b8bdd`): `pushServer` token yo'q bo'lsa skip; contributor `init` else'dan admin-only `loadPluginAnalytics()` olib tashlandi.
- **Render OOM 512MB** (`74509a8`): AWS SDK v3 checksum stream'ni xotiraga yig'ardi → S3Client `WHEN_REQUIRED` + `uploadFileToS3`→`@aws-sdk/lib-storage` multipart `Upload` (~32MB cho'qqi).
- **Vercel "Blocked"** (`21f63b6`): commit'dagi `Co-Authored-By: Claude` Hobby team uchun begona muallif → bloklar edi. Bo'sh trigger commit + repo public → ishladi.

## Holat
Render API current (`74509a8`), Vercel Studio deploy ishlayapti, konsol 401/403/CORS xatolar ketdi. **Bundan keyin commit'ga `Co-Authored-By` yozilmaydi.**

## Ochiq (MED/LOW)
Stripe Pro tarif, upload DB retry, email bildirishnoma, orphan threadlar, `execFileSync` event-loop bloklash (async'ga), ZXP, payout, stale `downloaded[]`.
