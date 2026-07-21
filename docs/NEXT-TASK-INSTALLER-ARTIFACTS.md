# NEXT TASK (Task 3) — imzolangan macOS/Windows installer artefaktlarini qurish

> Task 2 (2026-07-22) panel tomonini TUGATDI: panel endi o'zini o'zi yozmaydi, platformaga
> xos installerni yuklab oladi, SHA-256'ni majburiy tekshiradi va OS installeriga topshiradi.
> **Qolgani — artefaktning O'ZI.** Quyidagi prompt Claude Code'ga TO'G'RIDAN nusxa-joylashtiriladi.

## Task 3'dan oldin (ega/operator ishi — kod EMAS)

Bularsiz Task 3 tugallanmaydi (repo'ga HECH QACHON yozilmaydi — faqat operator muhitida / CI secret):

| Kerak | Nima uchun | Holat |
|---|---|---|
| Apple Developer Program hisobi | `.pkg` imzolash + notarizatsiya | ⬜ |
| **Developer ID Installer** sertifikati (`.p12`) | `productsign` / `productbuild --sign` | ⬜ |
| Apple notarizatsiya kredensiali (App Store Connect API key yoki app-specific parol) | `notarytool submit --wait` + `stapler` | ⬜ |
| Windows **Authenticode** kod-imzolash sertifikati (EV tavsiya — SmartScreen) | `signtool sign /fd sha256` | ⬜ |
| Windows imzolash mashinasi/CI (yoki HSM/token) | EV sertifikat ko'pincha token talab qiladi | ⬜ |

Sertifikat/parol/token repo'da, artefaktda, testda yoki hujjatda **hech qachon** saqlanmaydi
(`docs/RELEASE-ARCHITECTURE.md` §5 qoidasi kuchda).

---

## COPY-PASTE PROMPT (Task 3)

```
You are implementing Director Task 3 in /Users/usmonov/Projects/creative-tools-saas.
Read AGENTS.md, docs/PLUGIN-UPDATE-CHAIN.md, docs/RELEASE-ARCHITECTURE.md,
docs/NEXT-TASK-INSTALLER-ARTIFACTS.md, plugins/after-effects-cep/scripts/package-flavors.mjs,
scripts/build-zxp.sh, scripts/install-cep.sh and the Task 2 updater block
(AF-UPDATER-BEGIN…AF-UPDATER-END in plugins/after-effects-cep/AssetFlow_Plugin.html)
before editing.

Outcome in plain terms: build the real, signable macOS .pkg and Windows .exe/.msi installers
that Task 2's in-panel updater already knows how to verify and hand to the OS. The installers
must place the CUSTOMER plugin flavor into the per-user Adobe CEP extensions directory, and
must never install the internal Admin flavor.

Scope you own:
- plugins/after-effects-cep/scripts/ — new installer build scripts (macOS pkg + Windows
  exe/msi), reusing package-flavors.mjs as the single source of the shipped file list
- packaging payload/preinstall/postinstall logic and the Windows installer script
  (WiX/Inno/msi authoring), including uninstall
- a SHA-256 manifest emitter so the admin release upload matches byte-for-byte
- focused executable tests over the real scripts and real staged payloads, with negative cases
- docs updates (RELEASE-ARCHITECTURE.md build commands, PLUGIN-UPDATE-CHAIN.md step 2)
- docs/SESSION-REPORT.md (replace, max 15 physical lines) and the current block in
  docs/DIREKTOR-HANDOFF.md

Hard requirements:
1. Installer payload = EXACTLY the customer flavor file list from package-flavors.mjs
   (no Admin HTML, no com.frameflow.admin id, no af_admin_* keys, no --disable-web-security,
   no scripts/, no mockups). Reuse the existing verification helpers where possible.
2. Install target is the PER-USER CEP extensions directory
   (macOS ~/Library/Application Support/Adobe/CEP/extensions/com.frameflow,
   Windows %APPDATA%\Adobe\CEP\extensions\com.frameflow). Do not require root/admin more
   than the chosen installer format inherently does, do not write to /Library outside the
   OS installer's own mechanism, and do not modify unrelated Adobe state.
3. Signing is FAIL-CLOSED, exactly like build-zxp.sh: required credentials come only from
   environment variables; no self-signed fallback, no hardcoded password, no credential
   printed to stdout/stderr; on any failure no final artifact and no temp is left behind
   (bounded temp dir + trap cleanup + atomic mv only on success).
4. macOS: productbuild/productsign with a Developer ID Installer identity, then notarytool
   submit --wait and stapler staple. Windows: signtool sign /fd sha256 with a timestamp URL.
   If credentials are absent the script must stop with a clear error and produce an
   explicitly named -unsigned artifact ONLY when --unsigned is passed.
5. Emit, next to each artifact, its SHA-256 (64 lowercase hex) so the admin publish flow can
   be verified. The panel and the API both require this digest to match the stored bytes.
6. The artifact contract is already fixed by Task 2 and must not be changed: mac accepts
   ONLY .pkg; win accepts ONLY .exe or .msi. Do not touch the updater block, the
   /api/plugin/version response shape, plugin-release-contract.ts, or the admin publish rules.
7. Version must stay synchronized across CSXS/manifest.xml, CSXS/manifest.admin.xml,
   AssetFlow_Plugin.html (window.AF_PLUGIN_VERSION) and the installer package version.
   Add a test that fails if they drift.
8. Never put credentials, certificates, passwords, private keys or signing identities in the
   repo. The repo is public.

Protected/non-goals:
- Do not touch money, credits, billing, checkout, auth, AI generation/providers,
  catalog/import, contributor payout, production data, or deployment.
- Do not install anything on this Mac, do not run the produced installer, do not modify
  /Library or ~/Library Adobe extensions, do not push or deploy.
- Do not broaden-refactor the 1.1MB plugin HTML; preserve the customer/Admin package
  separation from commit 9fc7a81 and the Task 2 updater behavior.

Verification / definition of done:
- Build real staged payloads and run the real scripts in a temp workspace (no mocks) for:
  unsigned build, missing-credential build, and signing-command-failure — proving fail-closed
  and no leftover temp/final artifact, and that the other flavor's artifact is untouched
  (prove by unchanged SHA-256, not by absence).
- Run: npm run test:plugin-package, npm run test:plugin-updater, npm run test:release-contract,
  npm run test:plugin-download-state, plus the new installer tests; report counts.
- Review the final diff for protected-scope changes and secrets.
- Produce one concise git commit, no Co-Authored-By, and do not push.
- Return: architecture decisions, files changed, exact build commands, tests/counts,
  what the operator must supply (certs/notarization), remaining blockers, and commit hash.

If a technical choice is needed, decide it yourself and document the rationale.
Do not ask the nontechnical user. Begin with a read-only audit, then implement.
```

---

## Task 3 tugagach nima qoladi (ega ishi)

1. Sertifikatlar bilan **imzolangan** `.pkg` va `.exe`/`.msi` qurish (operator mashinasida).
2. Admin → **Releases**: versiya + release notes + har ikki installer yuklash → Publish.
   (Server SHA-256'ni storage'dan qayta hisoblab tekshiradi — mos kelmasa rad etiladi.)
3. AE'da **jonli E2E**: eski versiyali panel → modal chiqishi → Download & install →
   OS ruxsat so'rashi → AE ⌘Q va qayta ochish → yangi versiya.
