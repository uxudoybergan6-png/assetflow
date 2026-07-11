# HOTFIX — API Cloud Run deploy fails: container startup probe (BATCH4 boot crash)

> 🔴 URGENT. Push happened; "Deploy API to Cloud Run" #70 FAILED with:
> `ERROR: (gcloud.run.deploy) The user-provided container failed the configured startup probe checks.`
> Build + push + migrations succeeded → the failure is a **runtime BOOT crash** in the new BATCH4 code
> (the container starts but never becomes healthy). BATCH3 (#69) deployed fine, so it's a BATCH4 change.
> DO NOT PUSH — the USER pushes. No `Co-Authored-By`. Money-zone untouched (this is a boot/deps fix).

**BATCH4 commits to inspect:** #1 `79190f2 72947ac 9993def` · #4 `7b597c8 aa541ac` · #2 `3cd0d4b 4f31570
235de5b` · #3 `14a3838 0e048cb`. Diff them against the pre-batch commit to see everything BATCH4 added.

**Prompt (one-shot):**

> **CONTEXT.** The API (`apps/api`) Cloud Run deploy fails the **startup probe** — the container boots then
> crashes/hangs before the health endpoint responds. Build/push/migrations passed, so this is a runtime
> boot error introduced by BATCH4 (commits above). The most likely causes, in order:
> 1. **New Google TTS adapter `apps/api/src/lib/ai/google-tts.ts`** imports a package that is NOT in the
>    production image (e.g. `@google-cloud/text-to-speech`), or constructs a client / reads a required env
>    **at module load** → the import throws at boot → the whole app crashes.
> 2. A new **top-level (module-load) side effect** — a client init, a thrown error on a missing env, or a
>    blocking/`await` call — anywhere in the BATCH4 diff.
> 3. A **startup seed / init** (e.g. `seedModelPricing`, spend-guard, pricing) that throws at boot instead
>    of failing safe.
>
> **GOAL — make the container boot cleanly and pass the startup probe, WITHOUT touching money-zone logic.**
>
> **TASK.**
> 1. **Diagnose:** `git diff <pre-batch>..HEAD -- apps/api` and find every NEW module-load-time execution:
>    top-level `new XClient(...)`, top-level `await`, top-level env reads that throw, and any new `import`
>    of a package. Cross-check new imports against `apps/api/package.json` — if a package (e.g.
>    `@google-cloud/text-to-speech`) is imported but NOT a declared dependency (or not installed in the
>    Docker image), that's the crash.
> 2. **Fix `google-tts.ts` to match the other Vertex adapters:** do NOT import/instantiate an SDK client at
>    module load. Preferred: call the REST endpoint (`https://texttospeech.googleapis.com/v1/text:synthesize`)
>    with the SAME GCP auth-token pattern used in `ai/vertex-*.ts` (google-auth-library access token) — no
>    new heavy SDK dependency. If you keep the SDK, add it to `package.json` deps AND lazy-init the client
>    inside the function (first call), wrapped in try/catch. Either way, `import`ing this module must NEVER
>    execute network/auth code or throw.
> 3. **Make every startup init fail-safe:** any BATCH4 module-load call and any startup seed
>    (`seedModelPricing`, pricing/config, spend-guard) must be wrapped so a failure logs a warning and the
>    server still boots + serves `/health`. The health endpoint must respond 200 quickly regardless.
> 4. **Confirm required env is optional at boot:** if the Google TTS voice model needs an env/flag, missing
>    it should behave like `enabled:false` (no crash) — not throw at startup.
>
> **CONSTRAINTS.** MONEY-ZONE UNTOUCHED (computeGenCost/HMAC/consume/refund/pricing logic unchanged — this is
> purely boot resilience + deps). Migrations additive only (likely none). English UI; Uzbek comments.
>
> **VERIFY (critical — reproduce the boot locally).** After the fix: `npm run build -w apps/api`, then start
> the built server the SAME way the Docker image does (e.g. `node apps/api/dist/index.js` with a minimal env)
> and confirm the process **stays up** and `GET /health` (and `/livez` if present) returns 200 within a few
> seconds — i.e. the startup probe would pass. Also confirm `google-tts.ts` imports without side effects
> (import it in a tiny script; it must not throw with no env). Print the boot log showing a clean start.
>
> When finished: (a) commit with a clear message (no Co-Authored-By); do NOT push. (b) summary: the exact
> boot-crash root cause + the fix + the local boot/health proof. Tell the USER to push → the Cloud Run
> deploy should now pass, then click Admin → Pricing → "Apply target margin".
