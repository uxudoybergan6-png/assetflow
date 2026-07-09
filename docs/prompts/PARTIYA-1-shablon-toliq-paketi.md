# PARTIYA 1 — Shablon to'liq paketi (#7) 🔴 KRITIK

> `docs/QA-FIX-PLAN.md` → PARTIYA 1 uchun tayyor Code prompt (Claude Code'ga bering).
> Ildiz sabab kod bilan tasdiqlangan (taxmin emas). Pul-zona tegilmaydi. Prompt inglizcha,
> UI matnlari o'zbekcha qoladi.

## PROMPT (copy from here)

```
FrameFlow — PARTIYA 1: template FULL PACKAGE ingest/download/import (#7). Repo: ~/Projects/creative-tools-saas.

GOAL: A contributor uploads a .zip (contains .aep + linked footage *.mp4/*.mov + Sound/ + folders). Today the subscriber imports in AE and ONLY the .aep arrives — linked assets are missing → AE shows "15 files missing". Ship the FULL package end-to-end (web + plugin) so AE resolves every linked file.

ROOT CAUSE (code-confirmed — do not re-diagnose, verify then fix):
- apps/api/src/lib/ingest-zip.ts → openStreamingIngestZip finds ONLY 3 entries (pack .aep/.mogrt, preview image, preview video) at L286-326. Everything else (footage/audio/folders) is discarded.
- apps/api/src/routes/contributor.ts → ingestOneZip pass-2 (L~1805-1889) streams ONLY the pack entry to templates/{id}/pack.aep (s3UploadKeyForFile(id,"pack","pack"+ext), L1814) and writes fileName="pack.aep" (L1879).
- apps/api/src/lib/serve-asset.ts → getOrBuildAepDownloadZip (L35-66) wraps ONLY that single .aep into the download zip.
- ALREADY OK downstream (no change needed, just confirm): catalog-map.ts L246-249 normalizes fileName to .zip for clients; plugin assetflow-catalog.js downloadPackToTemp (L950+, L1034-1075) unzips .zip and imports the .aep from the extracted dir — so if the zip carries footage/audio beside the .aep, AE resolves them by relative path.

FIX (minimal diff): at ingest, store the WHOLE incoming zip as the pack (pack.zip) instead of extracting only the .aep.

CONSTRAINTS:
- MONEY ZONE UNTOUCHED (this partiya must not touch credit/quote/consume/refund/gen).
- Minimal diff, existing conventions, Uzbek UI copy. COMMIT (main, no push, no Co-Authored-By).
- Do NOT change packHash logic (keep it = .aep entry hash for anti-theft dedup).

PART A — INGEST: store full package (apps/api/src/routes/contributor.ts, ingestOneZip pass-2 L~1805-1889)
- Replace "stream pack entry → pack.aep" with a server-side S3 CopyObject of the original incoming zip object (key = incoming/{contributorId}/…zip) to s3UploadKeyForFile(template.id,"pack","pack.zip"). No re-stream/re-hash needed.
- Verify storage: getS3ObjectMeta(packKey).sizeBytes must equal the incoming zip size (meta.sizeBytes from L1656-1659); throw on mismatch (keep the existing checksum-verify philosophy).
- Write fileName="pack.zip" and fileSize = zip size (L1877-1880). Use the new packKey in syncTemplateAssetKeys (L1883-1889).
- KEEP packHash = the .aep entry hash (L1681) unchanged. Keep image/video preview extraction and the compensation/catch block as-is.
- If s3.ts has no copy helper, add copyS3Object(srcKey,dstKey) using CopyObjectCommand (CopySource = URL-encoded `${bucket}/${srcKey}`, ContentType "application/zip"). Touch nothing else in s3.ts.

PART B — DOWNLOAD/CATALOG (verify only, likely 0 code)
- serve-asset.ts: a .zip pack already serves directly (L79-95 skips the .aep→zip wrap). getOrBuildAepDownloadZip now only runs for LEGACY raw-.aep templates — leave it. 
- catalog-map.ts: with t.fileName="pack.zip", L246-249 already returns .zip. Confirm only.

PART C — PLUGIN (verify on live AE, likely 0 code)
- assetflow-catalog.js downloadPackToTemp already unzips .zip → imports the .aep from the extracted dir. Only if import copies the .aep OUT of its extracted folder (losing siblings), fix it to import the .aep IN-PLACE (beside the footage). Otherwise no change.

EDGE CASES:
- Zip without a project file → keep current permanent-reject (L1668-1674).
- Manual pack-upload path (processPackInBackground, L~1263-1496): a direct .zip already persists whole; a raw .aep stays single-file (user's choice) → DO NOT TOUCH.
- Legacy templates ingested as raw .aep (footage already lost) are unfixable — need re-ingest; note in docs/SESSION-REPORT.md, write NO migration.
- pack.zip may also contain the preview mp4/thumb — harmless (self-contained); AE import opens only the .aep.

VERIFY (required):
1. npm run build -w apps/api — TS clean.
2. Ingest a test zip (.aep + footage.mp4 + Sound/x.wav). Confirm R2 templates/{id}/pack.zip is the FULL package (unzip -Z1 lists footage+audio), fileName="pack.zip", fileSize = zip size, packHash unchanged (= .aep hash).
3. API_URL=https://assetflow-rqbq.onrender.com node scripts/verify-pipeline.mjs → hasPack:true, packUrl → /api/plugin/assets/….
4. Web: template detail → Download → open .zip → .aep + footage + Sound/ present.
5. LIVE AE (plugin): Browse → Sync → import the template → AE shows NO "files missing" (footage/audio resolved). [only AE-only check]
6. Update docs/SESSION-REPORT.md (≤15 lines, replace): what changed (ingest stores whole zip), legacy re-ingest note, next = PARTIYA 2.

DONE = new ingest → pack.zip is full package; fileName/fileSize correct; packHash unchanged; web download full; live AE import has no missing files; money-zone code untouched; TS build clean; verify-pipeline green.
```
