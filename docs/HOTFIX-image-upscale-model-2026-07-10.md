# HOTFIX — Image Upscale model `imagegeneration@002` is RETIRED (404) → switch to fal clarity-upscaler

> 🔴 Live bug. Image Upscale (catalog model **1015**) calls Vertex `imagegeneration@002` and gets:
> `404 NOT_FOUND — Publisher model imagegeneration@002 was not found or your project does not have access`.
> ROOT CAUSE: Google has **retired** `imagegeneration@002` (and @003–@006); the old Imagen 2 upscale
> endpoint no longer exists. Region won't fix it. (Imagen 4 upscale exists but is preview / may need
> approval.) FIX: route image upscale to **fal `fal-ai/clarity-upscaler`** — GA, Commercial/resell, and the
> **fal adapter is ALREADY wired** (BATCH4 #2 used it for `topaz/upscale/video`), so this is a small change.
> DO NOT PUSH — the USER pushes. No `Co-Authored-By`. Money-zone: prices only via `upsertModelPricing`;
> computeGenCost/HMAC/consume/refund unchanged.

**Prompt (one-shot):**

> **CONTEXT.** FrameFlow's Image Upscale (catalog model **1015**, added in BATCH4 #1, `apps/api/src/lib/
> gen-models.ts` + routed in `gen-processor.ts` via `apps/api/src/lib/ai/vertex-image.ts` `upscaleImage`)
> calls Vertex `imagegeneration@002`, which Google RETIRED → 404 `NOT_FOUND`. The fal adapter already exists
> and works (BATCH4 #2 video upscale uses `fal-ai/topaz/upscale/video`). Re-point image upscale to fal
> `fal-ai/clarity-upscaler`.
>
> **fal clarity-upscaler facts:** endpoint `fal-ai/clarity-upscaler` (queue submit → poll → result), auth
> `Authorization: Key $FAL_KEY` (already in prod). Input: `image_url` (required), `upscale_factor` (default
> 2 — expose 2 and 4). Output: `{ image: { url, width, height } }`. **Price = $0.03 / output megapixel**
> (Commercial use). Docs: `docs/FAL-DOCS-MODELS.md` / `FAL-AI-CATALOG.md` (project's fal source of truth).
>
> **TASK (commit per logical group).**
> A. **Route model 1015 to fal.** Change its provider/adapter from Vertex `imagegeneration@002` to fal
>    `fal-ai/clarity-upscaler` (reuse the existing fal adapter/queue/poll/download→R2 path from BATCH4 #2).
>    Input = the source image (the gen's signed asset OR an uploaded image) as `image_url`; pass
>    `upscale_factor` = 2 (x2→2K) or 4 (x4→4K). Store the result like other image gens. Refund on failure via
>    the EXISTING path. Remove the now-dead `imagegeneration@002` upscale call from `vertex-image.ts` (or
>    leave it unused but unreferenced) — do NOT break the working Imagen-4/Nano image GENERATION calls.
> B. **Pricing (money-zone, via `upsertModelPricing`).** clarity is **$0.03/output-megapixel**. In the
>    signed cost-quote, compute the OUTPUT megapixels deterministically from the SOURCE image dimensions ×
>    `upscale_factor²` (source w×h known; output = w·factor × h·factor), then credits =
>    `ceil(outputMP × $0.03 × 2 ÷ $0.019)`. Include the computed MP/factor in the signed payload (tamper-safe,
>    like the Topaz tier). Representative: 2K (~4 MP) ≈ **12 credits**, 4K (~8 MP) ≈ **25 credits** at 2×.
>    Set `estCostUsd`/`videoPerSec`-equivalent so the pricing page shows a real ~2× margin. (If exact source
>    dims aren't available pre-run, price by the target factor using a representative MP and NEVER below
>    provider cost.) State the arithmetic.
> C. **UI copy.** The web + plugin Upscale tool: the x2/x4 rows now show the fal-derived ✦ cost (no code
>    change beyond the cost source). Keep the "Upscale x2 → 2K / x4 → 4K" labels.
>
> **CONSTRAINTS.** MONEY-ZONE: computeGenCost/HMAC/consume/refund unchanged; prices via `upsertModelPricing`.
> Reuse the existing fal adapter — do NOT add a new one. `FAL_KEY` already set. Additive only. English UI;
> Uzbek comments. Don't touch the working Vertex image-GENERATION models or landing `ffl-`.
>
> **VERIFY.** A real (or dry) image-upscale run through fal clarity returns an upscaled image stored in R2 (no
> more 404); the ✦ cost shows and holds ≥2× margin with the arithmetic; a git-diff shows NO change to
> computeGenCost/HMAC/consume/refund; the working image-generation models still work. USER pushes → deploy.
>
> When finished: (a) commit per logical group (no Co-Authored-By); do NOT push. (b) summary: the swap + the
> final upscale credit prices (2K/4K) + arithmetic.
