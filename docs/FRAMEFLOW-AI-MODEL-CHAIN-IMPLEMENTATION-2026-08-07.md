# FrameFlow AI model zanjiri — implementatsiya va dalil

> Sana: 2026-08-07  
> Scope: Web + umumiy AE/PR CEP + Studio Gen API + provider payload + reference/session lifecycle.  
> Holat: lokal kod va avtomatik QA yakunlangan; production deploy va real provider/Adobe smoke qilinmagan.

## Natija

Auditdagi P1-01…P1-07 va tegishli P2 kontrakt muammolari lokal kodda yopildi. Model ko'rinishidan
boshlab quote, canonical params, reference ownership, provider request va historygacha bitta
fail-closed zanjir ishlaydi. Real kredit sarflanmadi, Adobe ochilmadi, commit/push/deploy qilinmadi.

## Enabled model inventari

| Oila | ID'lar | Provider | Asosiy oqim | Reference |
|---|---|---|---|---|
| Image generation/edit | 1010, 1013, 1014 | Vertex Image | text/image → image | optional multi-image |
| Image generation | 1011, 1012 | Vertex Image | text → image | none |
| Image generation/edit | 1020, 1021, 1022 | BytePlus | text/image → image | optional multi-image |
| Image generation/edit | 1030, 1031 | Kling | text/image → image | optional multi-image |
| Voiceover | 2002 | Google TTS | text → MP3 | none |
| Sound FX | 4001 | ElevenLabs | text + duration → audio | none |
| Video generation | 3001, 3002, 3003 | Vertex | text/start/end → video | frames by capability |
| Multimodal video | 3010 | Vertex Omni | text + image/video/audio → video | media refs |
| Image-to-video | 3004, 3005 | Kling | start/end → video | optional/required frames |
| Multimodal video | 3008 | Kling Omni | text + media → video | media refs |
| Image/reference video | 3101, 3102, 3103 | BytePlus | frames/media → video | required/media refs |
| Upscale operation | 5001, 5002 | Topaz | owned source → video/image | required owned source |

Har entry uchun startup invariant, canonical default/negative matrix va adapter request contracti bor.
Provider yo'q bo'lsa katalog, quote va generation bir xil safe availability qarorini ishlatadi.

## Asosiy kod

- `apps/api/src/lib/gen-provider-availability.ts` — exhaustive provider truth va catalog fingerprint.
- `apps/api/src/lib/gen-param-validation.ts` — canonical setting/reference schema va manifest.
- `apps/api/src/lib/gen-quote.ts` — priced params + reference manifest hash.
- `apps/api/src/routes/studio-gen.ts` — bir xil availability/validation/ownership pre-credit gate.
- `apps/api/src/lib/gen-processor.ts` — jim truncation yo'q, explicit provider input limits.
- `apps/api/src/lib/ai/*` — production ishlatadigan pure request builderlar.
- `packages/assetflow-studio/platform/index.html` — actual web canonical ref builder.
- `plugins/after-effects-cep/frameflow-create-workspace.js` — umumiy AE/PR canonical controller.
- `scripts/verify-gen-production-readonly.mjs` — generation qilmaydigan production drift/availability gate.

## Avtomatik dalil

- API/monorepo build: PASS — 51 katalog entry, 24 enabled, 0 issue.
- Provider availability: 24 enabled fail-closed PASS.
- Canonical param + quote/reference invariant: 89 checks PASS.
- Actual Web ↔ CEP ↔ API parity: 44 model variants PASS.
- Provider adapter: 24/24 enabled entry PASS.
- Reference security/lifecycle: ownership, MIME, size, TTL, re-sign, orphan cleanup PASS.
- CEP Create 12/12; responsive/session 103/103; Premiere host 18/18; integration 19/19 PASS.
- Package 59/59; Marketplace 100/100; installers 262/262; release contract 110/110 PASS.
- `git diff --check`: PASS.

## Artefakt va lokal install

- `dist/zxp/frameflow-plugin-v1.2.0-unsigned.zip` — 844469 bayt —
  `d02793ccc22ea7ffbc53efddcda0b4866fcdfa20ec137ae09d4d343c69629f8b`.
- `dist/installers/frameflow-plugin-1.2.0-mac-unsigned.pkg` — 840741 bayt —
  `a3ce797baa9b8616d9aa25ce35d0ea21297c9416f7a6e1cb08fe22b00b26c4f6`.
- `dist/uxp/frameflow-premiere-host-v1.0.0.ccx` — 14312 bayt —
  `e76f08a2810270a25cb7c442b08f75300c9788ea40208c2d846695ed8ed57885`.
- CEP `~/Library/Application Support/Adobe/CEP/extensions/com.frameflow`ga qayta o'rnatildi.

## Hali avtomatik PASS emas

1. `api.getframeflow.app` hali eski build; deploydan keyin production availability/drift smoke qayta
   bajarilishi shart. Eski `assetflow-rqbq.onrender.com` suspended legacy endpoint, runtime manba emas.
2. Real provider schema canary kredit talab qiladi; owner belgilagan staging budjetsiz bajarilmadi.
3. Imzolangan ZXP sertifikati va Marketplace owner metadata yo'q.
4. AE va Premiere ichidagi real import/smoke foydalanuvchi ishiga tegmaslik uchun avtomatlashtirilmadi.

Shuning uchun hukm: **local code-complete + automated-QA complete; production/release smoke pending**.
