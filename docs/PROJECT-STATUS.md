# FrameFlow — joriy loyiha holati

> **Yagona current-state hujjat.** Kod va migratsiyalar birlamchi manba; ushbu fayl operator uchun
> qisqa xarita. 2026-08-07 gacha bo‘lgan uzun sessiya tarixi
> [`archive/PROJECT-STATUS-LEGACY-THROUGH-2026-08-07.md`](archive/PROJECT-STATUS-LEGACY-THROUGH-2026-08-07.md)da.
> `REJA-*`, `STUDIO-GEN-*`, mockup va archive fayllari bajarilgan holat deb talqin qilinmaydi.

**Yangilangan:** 2026-08-20
**Holat:** audit hardening va AI safety outage remediation joriy kodda; Cloud Run rollout GitHub
Actions health gate orqali, Marketplace signed release esa tashqi gate’da.

## Joriy arxitektura

| Qism | Joriy manba / runtime |
|---|---|
| Public web + Admin/Contributor Studio | `packages/assetflow-studio/`; production `https://getframeflow.app` |
| API | `apps/api/`; production `https://api.getframeflow.app`; Google Cloud Run |
| Database | `packages/database/prisma/`; PostgreSQL, production Google Cloud SQL |
| Object storage | S3-compatible adapter (`apps/api/src/lib/s3.ts`), production GCS |
| AE/Premiere customer UI | shared CEP `plugins/after-effects-cep/`, bundle `com.frameflow`, version 1.2.0 |
| Premiere host adapter | hidden UXP companion `plugins/premiere-uxp/`, version 1.0.0 |
| Billing | Lemon Squeezy canonical; legacy Stripe checkout productionda o‘chiq |
| AI | server-side model catalog + signed quote; fal/BytePlus/Kling/Vertex/OpenRouter/ElevenLabs adapterlari |

Studio manbasi faqat `packages/assetflow-studio/js/` va `styles/`da tahrirlanadi; so‘ng
`npm run studio:sync`. `studio/js`, `studio/styles`, `admin/js`, `admin/styles` build artefaktlari.

## Ishlaydigan asosiy oqimlar

- Contributor upload/ingest → Admin moderation → `APPROVED + published` katalog → CEP download/import.
- Template media API orqali authorization/publish/takedown gate’dan o‘tadi; pack SHA-256 katalogga beriladi.
- Import limit reserve → host import → commit/cancel protokoli bilan hisoblanadi.
- Studio Gen: session, signed cost quote, idempotent reservation, atomik credit ledger, job processing,
  refund, history, saved references va storage retention.
- Admin/Contributor web session tokeni `sessionStorage`da; logout server revoke’ni kutadi.
- Admin uchun majburiy 2FA, alohida TOTP key, session revoke va last-admin invariantlari bor.
- Lemon Squeezy webhooklari lease/idempotency va transactional plan/top-up/refund bilan ishlaydi.
- AE/Premiere customer paketi ichki Admin panelini o‘z ichiga olmaydi; updater HTTPS/SHA-256/size
  tekshiradi va faqat OS installerga argument-array orqali handoff qiladi.

## 2026-08-17 audit hardening

- Pul: DB CHECK migratsiyalari, atomik reset/consume/refund/top-up, durable generation-linked ledger,
  stale reservation reconciliation va import reservation modeli qo‘shildi.
- Auth/privacy: prod 2FA, backup-code lock, takeover URL redaction, billing cancel-before-delete,
  private object cleanup va PII anonymization mustahkamlandi.
- Upload/storage: exact content length presign, active-ingest dedupe/limit, signed SSE capability,
  bounded streaming download va generation derivative cleanup qo‘shildi.
- AI: external reference URL rad etiladi, media moderation prod’da fail-closed, legacy charge yo‘llari
  productionda 410, exact one-time quote unified composerga yetkaziladi.
- CEP/UXP: immutable pack cache, ZIP bomb/path/symlink/encryption gate, safe extraction, per-session
  authenticated bridge mailbox, user-scoped job store va transactional installer registry yangilandi.
- Studio: server matnlari escape, stale request guards, dialog focus/inert/live-region, keyboard upload/
  rows, CMS unsaved guard, truthful guest/release UI, Turnstile runtime config va real CSV export.
- Web/SEO: route metadata/canonical, real 404, favicon/manifest, H1 va reduced-motion tuzatildi.
- DevOps: multi-stage non-root Docker, CI-before-deploy, production audit, barcha Actions immutable SHA.

## 2026-08-18 web/customer-plugin control audit remediation

- Web: public Stock browse/detail, landing showcase/cinema/import CTAlari, Projects/Downloads/footer filtrlari,
  guest account ko‘rinishi, kredit nusxasi, share fallback va release loading guard tuzatildi.
- Billing: real Lemon Squeezy customer portal API qo‘shildi; faol obuna checkout 409 holati portalga
  yo‘naltiriladi, CMS ko‘rsatma narxi canonical checkout narxini almashtira olmaydi.
- Studio Gen: audio session playback, immutable retry snapshot/idempotency, ledger/session/project stale
  response guardlari, audio ARIA va ko‘p fayl yuklash tasdig‘i qo‘shildi.
- Customer plugin: secure-store token plaintextga qayta yozilmaydi; billing portal Lemon Squeezyga ulandi;
  Comp/Bin import tanlovi saqlanadi va ishlaydi; blank New session, Auto model, update check va project
  template import ishlaydi; Premiere’da qo‘llanmaydigan host-delete va’dasi olib tashlandi.
- CMS notice: ishlaydigan CTA bo‘lmasa notice majburan yopiladigan bo‘ladi; guest register havolasi saqlanadi.
- Lokal API/public/plugin build va regression testlari hamda GitHub Linux/Windows CI o‘tdi.
- Production rollout: eski faol ingest dublikatlari deterministik terminal holatga keltirilib 4 audit
  migratsiyasi qo‘llandi; Cloud Run DB/storage health gate’dan o‘tib 100% trafikka chiqarildi; CDN Worker ishlaydi.
- Live billing canary va signed Marketplace installer tashqi gate bo‘lib qoladi.

## 2026-08-20 Studio Gen outage remediation

- Production AI’ni to‘liq bloklagan faqat-`MODERATION_API_KEY` gate’i mavjud Cloud Run Vertex ADC
  bilan ishlaydigan Gemini multimodal safety fallbackiga almashtirildi.
- Prompt va start/end/image/video/audio referenslar kredit yechilishidan oldin tekshiriladi; yaratilgan
  image/video/audio ham natija berilishidan oldin tekshiriladi. Tekshiruv xatosi fail-closed va refund.
- `/gen/health` hamda `/gen/models` endi moderation/generation readinessni rost ko‘rsatadi; xavfsizlik
  tayyor bo‘lmasa klient modelni “Ready” deb ko‘rsatmaydi.
- Web, AE va generatsiya qilingan Premiere klienti doimiy konfiguratsiya 503’ini to‘rt marta qayta
  yubormaydi va texnik xato o‘rniga tushunarli xabar beradi.
- Enhance referens butunligi buzilgan rewrite bekor qilinsa kredit qaytariladi; javob missing/
  extraneous/changed sababini va authoritative balansni qaytaradi.

Migratsiyalar:

- `20260817120000_audit_money_invariants`
- `20260817123000_ingest_active_dedupe`
- `20260817124000_generation_reservation`
- `20260817125000_import_reservations`

## Xavfsizlik invariantlari

- Klient yuborgan narx, plan, kredit yoki asset URL ishonchli emas.
- Generation narxi server signed quote’iga va canonical params/reference hashiga bog‘langan.
- Kredit kamayishi bilan ledger bir transactionda; generation refund idempotent.
- Public katalog faqat approved + published + takedown bo‘lmagan yozuvlarni beradi.
- User media to‘g‘ridan public bucket allowlistiga kirmaydi; API ownership/publish gate ishlaydi.
- Production konfiguratsiyasi moderation, Turnstile, 2FA, storage va billing secretlarisiz fail-closed;
  moderation uchun Vertex ADC yoki dedicated provider kerak, Turnstile yetishmasa signup bloklanadi,
  katalog/auth/health esa ishlaydi.
- ZIP/installer/bridge hech qachon shell interpolation yoki tekshirilmagan tashqi path ishlatmaydi.

## Lokal tekshiruv

```bash
npm run generate -w @creative-tools/database
npm run build -w @creative-tools/database
npm run build -w apps/api
npm run studio:sync
npm run test:plugin-package
npm run test:plugin-updater
npm run test:plugin-responsive
npm run test:plugin-create
npm run test:plugin-installers
npm run test:marketplace-preflight
npm run test:release-contract
npm run test:ci-windows-installer
npm run test:dep-floors
npm run test:public-copy
npm audit --omit=dev --omit=optional
```

Audit regressiya skriptlari `apps/api/scripts/test-*.mjs`,
`packages/assetflow-studio/scripts/test-*.mjs` va `plugins/premiere-uxp/scripts/test-*.mjs`da.

## Production release gate — hali ochiq

Quyidagilar lokal kod bilan tasdiqlanmaydi va bajarilmaguncha **production/Marketplace ready emas**:

1. Production secret/env: haqiqiy Turnstile site+secret, TOTP key, Vertex/dedicated moderation
   readiness, Sentry, billing, provider va storage qiymatlarini boot validation’dan o‘tkazish.
2. Signed ZXP + notarized PKG + signed MSI; haqiqiy ZXPSignCmd/signtool/notary tekshiruvi.
3. Clean macOS/Windows profilida install/update/uninstall va AE/Premiere restart/import smoke.
4. Premiere CEP UI + hidden UXP companion uchun Adobe tasdiqlagan bitta orchestrated release kanali;
   hozir `.ccx` alohida va shared updater uni avtomatik o‘rnatmay, fail-closed download sahifasiga yuboradi.
5. Arzon real-provider canary va output moderation dalili.
6. Live checkout → webhook → plan/credit → cancel/refund end-to-end sinovi.
7. Cloud SQL restore drill, GCS object versioning/lifecycle va backup restore dalili.
8. GitHub `main` branch protection/ruleset: required CI, review, direct-push/force-push taqiqi.
9. Terms/privacy/refund/DMCA uchun yurist sign-off.
10. Production katalog content ishi: PRO assortiment, preview completeness, taxonomy/format normalization.

## Ataylab current scope’dan tashqarida

- Public SPA’ni route-level bundlelarga ajratish — alohida arxitektura migratsiyasi; hozirgi audit
  xavfsizlik fixlari shell metadata/404/CSP sirtini kamaytiradi, lekin monolit bundle’ni bo‘lmaydi.
- Eski HANDOFF va reja hujjatlari tarixiy kontekst. Production URL/infra uchun ushbu fayl va kod ustun.
