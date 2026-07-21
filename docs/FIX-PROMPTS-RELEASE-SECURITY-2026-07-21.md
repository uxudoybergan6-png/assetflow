# GLOBAL RULES

- Work only in `/Users/usmonov/Projects/creative-tools-saas`.
- This is FrameFlow (legacy AssetFlow names remain in some files). Read `AGENTS.md`, `docs/DIREKTOR-HANDOFF.md`, `docs/PROJECT-STATUS.md`, and the relevant current code before editing.
- Keep the diff focused. Do not touch credits, cost quotes, billing, payments, checkout, auth semantics, database schema, AI generation, contributor payouts, deployment, or production data.
- Do not install anything into the user's real Adobe/CEP directories. Do not run the supplied third-party Higgsfield installer. Do not push or deploy.
- English UI; Uzbek code comments are acceptable. Do not claim obfuscation or signing hides client code.
- Preserve customer plugin behavior. This task is packaging/security separation, not a UI redesign.
- Never put credentials, private keys, signing certificates, default signing passwords, or access tokens in source, artifacts, logs, tests, or docs.
- When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push. (b) write a short summary.

# TASK — Split the public customer plugin from the internal Admin extension and fail closed in release packaging

## Context and verified findings

The current default unsigned archive `dist/zxp/assetflow-v1.1.1-unsigned.zip` contains both `AssetFlow_Plugin.html` and the full `AssetFlow_Admin.html`. `CSXS/manifest.xml` exposes both `com.frameflow.panel` and `com.frameflow.admin`. The Admin dispatch enables Node.js, local file access, mixed context, and `--disable-web-security`. The public package therefore exposes an unnecessary privileged internal surface to every customer. The server correctly protects admin routes with `requireAuth` + `requireAdmin`; do not change those semantics.

The current `build-zxp.sh` also falls back to creating a self-signed certificate and a hardcoded password. That must never happen in a production-signing path. An unsigned test artifact is fine, but a signed release must fail closed unless explicit signing credentials are provided.

The customer plugin itself legitimately uses CEP Node/file capabilities for importing/downloading media. Do not blindly remove capabilities that would break customer behavior. This task must eliminate the Admin surface from the customer artifact and eliminate `--disable-web-security` from every generated/shipped manifest. A later task will redesign the updater/installer.

## Required implementation

1. Establish explicit package flavors with one clear source of truth:
   - Default/public `customer` flavor contains only `com.frameflow.panel` and its runtime-referenced files.
   - Explicit `admin` flavor is internal-only, contains only `com.frameflow.admin` and its required runtime files, and produces a clearly named internal artifact.
   - Do not ship both extension IDs in one artifact.
   - Keep version `1.1.1` synchronized across the bundle/extension manifests and existing `window.AF_PLUGIN_VERSION` contract.

2. Make the default behavior safe:
   - `build-zxp.sh --unsigned` with no flavor flag must build only the customer package.
   - A separate explicit flag/subcommand may build the internal Admin artifact.
   - The default/customer archive must not contain `AssetFlow_Admin.html`, the `com.frameflow.admin` ID, Admin-only localStorage keys, Admin UI text, or `--disable-web-security`.
   - The internal Admin manifest must also not use `--disable-web-security`. Use the existing first-party HTTPS API/CORS contract. Do not weaken backend CORS or auth to compensate.
   - `install-cep.sh` must default to installing customer-only source. Installing the internal Admin flavor must require an explicit opt-in flag and use a separate extension directory/bundle so it can never be installed accidentally. Do not execute this installer during the task.

3. Harden signing/build behavior:
   - Unsigned artifacts remain available only for local structural QA and must be unmistakably named `unsigned`.
   - Signed builds must require an explicitly supplied real certificate path and password (environment variables are acceptable); fail with an actionable message if either is absent.
   - Remove automatic self-signed certificate creation and every hardcoded/default certificate password.
   - Do not echo secrets.
   - Use bounded, validated staging paths and cleanup traps. Never make a broad destructive target.
   - Keep customer and internal Admin output names unmistakably different.

4. Add executable regression/security checks against the actual built archives, not copied in-memory mock objects:
   - Build both unsigned flavors in the test.
   - Verify each archive's manifest has exactly one expected extension ID and matching dispatch.
   - Verify all manifest MainPath/ScriptPath and local HTML/CSS runtime references resolve.
   - Assert the customer archive excludes all Admin files/identifiers/flags/known Admin storage keys.
   - Assert neither manifest contains `--disable-web-security`.
   - Scan packaged text files for obvious private-key blocks and common hardcoded secret patterns, reporting file names only and never printing a matched secret.
   - Add negative fixtures or temporary mutated archives proving the assertions fail when an Admin file/ID or forbidden flag is introduced.
   - Preserve/update existing `verify-zxp-package.mjs` rather than duplicating its useful reference logic where practical.

5. Documentation:
   - Add a concise release architecture document explaining that CEP client code is inspectable by design, signing proves authenticity rather than secrecy, customer and internal Admin distributions are separate, and secrets/business authorization remain server-side.
   - Record exact build commands for unsigned customer QA, unsigned internal Admin QA, and credential-required signed builds without including any credential values.
   - Explain that the current in-panel self-updater is NOT approved for release yet and will be replaced by a verified external installer/updater in the next task.
   - Update `docs/SESSION-REPORT.md` (maximum 15 lines) and replace the current-status block in `docs/DIREKTOR-HANDOFF.md` concisely; do not append a long history.

## Protected/non-goal areas

- Do not modify the existing in-panel updater implementation in this task except documentation/tests needed to mark it unapproved. Do not design the full installer yet.
- Do not modify API release behavior, PluginRelease schema, admin web release UI, money/credits/billing/auth, AI systems, public landing design, or deployment.
- Do not minify/obfuscate as a security control.
- Do not copy code/assets from the supplied Higgsfield package. It is only an architectural reference.
- Do not install, sign, notarize, upload, publish, push, or deploy anything.

## Verification and definition of done

- Clean starting worktree except for this task prompt file.
- Customer unsigned artifact builds and passes all runtime-reference/security assertions.
- Internal Admin unsigned artifact builds separately and passes its runtime-reference/security assertions.
- Default customer archive contains no Admin surface and no forbidden flag.
- Signed build without explicit credential variables fails closed before producing a signed artifact.
- Existing database/API build, root build, public-copy check, plugin release contract test, and plugin download-state test still pass.
- Run `git diff --check`, inspect the complete diff for protected-zone changes, and report exact changed files, artifacts, commands, test counts, remaining limitations, and commit hash.
- One concise commit, no Co-Authored-By, no push.
