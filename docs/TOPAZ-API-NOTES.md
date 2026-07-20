# TOPAZ-API-NOTES — Topaz Labs Enhance API (curated truth source, 2026-07-20)

Canonical, code-verified reference for integrating Topaz Labs (upscale/enhance) as a
FrameFlow provider. Machine-precise specs live beside this file:
`docs/topaz/image-yaml-feb-2026.yaml` (OpenAPI 3.1.2, Image API v1.2.0) ·
`docs/topaz/video-12-25-updated.yaml` (Video API) · `docs/topaz/model-selection.md`
(model decision tree) · `docs/topaz/introduction.md` · `docs/topaz/quickstart.md`.
Full 105-doc set on the owner's machine at `/Users/usmonov/Projects/Topaz/`.

> ⚠️ OpenAPI enums LAG the model pages. The live truth for available models is
> `GET /video/status` (`supportedModels[]`) and the model pages. Treat the yaml as the
> mechanics spec, not the full model list.

---

## 1. Auth + base URLs

- Header on EVERY call: `X-API-Key: <TOPAZ_API_KEY>` (env key created at
  account.topazlabs.com/manage-api; shown once).
- Image API base: `https://api.topazlabs.com/image/v1`
- Video API base: `https://api.topazlabs.com` (paths `/video/...`)
- Account API base: `https://api.topazlabs.com/account/v1`
- HTTPS only. Request size cap 500 MB (→413). 429 under load → exponential backoff.

## 2. IMAGE flow (async, multipart)

Submit → poll → download. Endpoints (POST, `multipart/form-data`, all `.../async`):
| Endpoint | model enum (yaml) | default |
|---|---|---|
| `/enhance/async` | Standard V2, Low Resolution V2, CGI, High Fidelity V2, Text Refine | Standard V2 |
| `/enhance-gen/async` | Standard MAX, Recovery V2, Wonder, Redefine (+ page-only: Wonder 2/3, Recover 3, Bloom, Bloom Realism, Detail, Upscale High Fidelity V3) | Redefine |
| `/sharpen/async` | Standard, Strong, Lens Blur V2, Motion Blur, Natural, Refocus, Wildlife, Portrait, Auto Sharpen | Standard |
| `/sharpen-gen/async` | Super Focus V2/V3 | Super Focus V2 |
| `/denoise/async` | Normal, Strong, Extreme | Normal |
| `/denoise-gen/async` (page-only) | Denoise Max | — |
| `/restore-gen/async` | Dust-Scratch, Dust-Scratch V2, Faces | Dust-Scratch |
| `/lighting/async` | Adjust, Adjust V2, White Balance, Colorize | Adjust |
| `/matting/async` | Object, RemoveBG | Object (png out) |
| `/tool/async` | Transparency Upscale | (png in/out) |

- Multipart fields: `image` (file; jpeg/jpg/png/tiff/tif) **or** `source_url` (URL — our
  R2/GCS URL works), `model`, `output_height`/`output_width` (1–32000; one → proportional),
  `crop_to_fill` (bool, def false = letterbox), `output_format` (jpeg/png/tiff, def jpeg),
  `webhook_url`, + arbitrary model settings (unknown keys ignored; **omitted = Autopilot
  auto-configures**).
- Response 200: `{process_id, source_id, eta}`.
- Poll `GET /status/{process_id}` → status `Pending|Processing|Completed|Cancelled|Failed`,
  `progress`, `credits` (charged on completion).
- Download `GET /download/{process_id}` → `{download_url, head_url, expiry}` —
  **presigned, expire in 1 HOUR**; outputs retained **7 days**. → copy to our storage NOW.
- Cancel `DELETE /cancel/{process_id}`. Estimate (free, no upload): `POST /estimate` /
  `/estimate-gen` / `/estimate-bulk` with `{input_height,input_width,category,model,...}`
  → `{duration, credits}`.
- Image webhook payload: `{notification_id, process_id, status, download_url, head_url,
  input_download_url, ...}`; retries on 5xx.

## 3. VIDEO flow (async, S3 upload)

Two lifecycles:
- **Standard** (cost known BEFORE upload — preferred for our signed cost-quote):
  1. `POST /video/` (FREE, no credits) body `{source:{container(mp4|mov|mkv), size, duration,
     frameCount, frameRate, resolution{width,height}, external?}, filters:[...], output:{...}}`
     → `{requestId, estimates:{cost:[low,high], time:[low,high]}}`. **Lower bound is billed.**
  2. `PATCH /video/{requestId}/accept` → `{uploadId, urls[]}` — **reserves credits**;
     split file into `urls.length` even byte ranges, PUT each, keep (partNum, ETag).
  3. `PATCH /video/{requestId}/complete-upload/` body `{uploadResults:[{partNum,eTag}], md5Hash?}`.
- **Express** (fewer round-trips, but no pre-upload cost): `POST /video/express` (same
  filters+output, source only needs container) → `{requestId, uploadId, uploadUrls[]}` →
  PUT whole file; cost appears in status after analysis.
- **Source can be external S3** (`source.external.provider:"s3"`, `presignedUrl` OR
  `awsCredentials{roleArn,externalId}`, `bucketName`, `key`). ⭐ Our R2 is S3-compatible →
  a gen video's presigned R2 URL can be handed to Topaz directly (no re-upload). CONFIRM
  Topaz can fetch R2 presigned URLs during integration (like SC_57 confirmed for BytePlus).
- Poll `GET /video/{requestId}/status` → status `requested|accepted|initializing|
  preprocessing|processing|postprocessing|complete|canceling|canceled|failed`, `progress`,
  and on complete `download:{url, expiresIn, expiresAt}` — **URL TTL 24h** (re-call status
  to mint new); files auto-deleted after **7 days**. → copy to our storage.
- `GET /video/status` (system) → `{isAvailable, supportedModels[]}` — LIVE model list.
- Cancel `DELETE /video/{requestId}` → full refund pre-processing, **pro-rata partial**
  mid-processing. History `GET /video/history` (transactions: reserve/commit/rollback).
- `filters[]`: UpscaleFilter `{model (short code), auto:"Auto"|"Manual"|"Relative", ...}`
  or FrameInterpolationFilter. `output` requires `resolution{w,h}`, `frameRate`,
  `audioCodec(AAC|AC3|PCM)`, `audioTransfer(Copy|Convert|None)`, and exactly ONE of
  `videoBitrate` OR `dynamicCompressionLevel(Low|Mid|High)`, `container`.

## 4. Credits / billing

- Image billed on **OUTPUT megapixels**, charged on completion. Family MP-per-credit:
  Gigapixel 24 · Wonder 4 · Wonder 3 ~8 · Bloom 2 · Sharpen GAN 24 / Gen 20 · Denoise 24 ·
  Removal/Cleanup 24 · Color/Lighting 24. (Per-model exceptions exist — see model pages.)
- Video reference (10s @1080p 30fps): Proteus 4 · Starlight Fast 6 / Quality 12 · Astra 40 ·
  Denoise Fast 2 / Quality 4 · Frame-Interp Fast 1 / Quality 2 · Utilities 2. Video bills
  the estimate **lower bound**; reserved at accept → committed/rolled back.
- Balance `GET /account/v1/credits/balance` → `{available_credits, reserved_credits,
  total_credits}`.
- **Owner cost (real account tiers):** PAYG $0.195/Topaz-credit; subscription 400/$39.99
  ($0.10) · 1400/$99.99 ($0.071) · 3000/$199.99 ($0.067) · 20000/$999.99 ($0.05). Requires
  a monthly subscription (min ~$10/mo) — unlike BytePlus/Kling pure pay-per-use.

## 5. Autopilot (one-click)

- Image: pass ONLY `image` (+ optional output dims) → Autopilot sets everything.
- Video: `filters:[{"model":"prob-4","auto":"Auto"}]` (Proteus, param estimation).
- Recommended "one-click Enhance" pipeline:
  - Image → `POST /image/v1/enhance/async` `{source_url, model:"Standard V2",
    output_width/height for target}`; preflight `POST /estimate` for cost display.
  - Video → standard flow with `filters:[{model:"prob-4",auto:"Auto"}]` + minimal `output`
    (target resolution, source frameRate, audioCodec AAC, audioTransfer Copy,
    dynamicCompressionLevel High, container mp4); estimate returned by `POST /video/` gates cost.

## 6. Recommended models for FrameFlow (Director)

- **Video upscale (one-click): Proteus `prob-4` (auto).** Precision, cheapest quality path
  (10s: 720p=1, 1080p=2, 4K=6 credits). Premium later: Starlight Fast 2 `slf-2` (~2.6×).
- **Image upscale: Gigapixel `Standard V2`** (AI-art → `CGI`; text/logos → `Text Refine`;
  tiny/compressed → `Low Resolution V2`; face <512px → `Faces` via `/restore-gen`).
- **Background removal: `RemoveBG`** via `/matting/async` (png).
- Skip on cost: Astra ($4/10s 1080p), Starlight Quality.

## 7. GOTCHAS (integrator must know)

- Output URLs expire (image 1h / video 24h); files purged after 7 days → COPY to our
  storage immediately (reuse the byteplus url→storage pattern).
- Video bills the estimate lower bound; a large post-upload re-estimate → request fails +
  full refund (maps to our refund path).
- Image formats jpeg/png/tiff only (no webp/heic). Matting/tool → png only.
- Image dim cap 32000px; per-model MP caps (Gigapixel 512 in/1024 out; Standard MAX/
  Recover 3 only 24 MP input; Wonder 128; Super Focus/Redefine/Dust-Scratch 256).
- Video output resolution caps by encoder (H264 4096, H265 8192, ProRes 16386).
- OpenAPI enums lag model pages — use `GET /video/status supportedModels` + model pages.
- Requires a paid subscription (fixed monthly cost) — factor into the launch budget.
