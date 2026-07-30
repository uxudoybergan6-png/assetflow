# BytePlus / Seedance 2.0 Mini — ulanish tahlili + Claude Code prompti

**Sana:** 2026-07-28 · **Manba:** `~/Projects/byteplus` (rasmiy BytePlus docs) + `~/Projects/creative-tools-saas` (kod, `origin/main` bilan bir xil)

---

## 1. Asosiy xulosa (muhim)

**Tekshiruv shuni ko'rsatdi: BytePlus modellari to'g'ri ulangan, va Seedance 2.0 Mini ASLIDA allaqachon to'liq ulangan** — server katalogida, generatsiya dispatcherida, narx jadvalida, hamda web va plagin klientlarida. Ya'ni "umuman ulanmagan" degan taxmin kod bo'yicha **tasdiqlanmadi**.

Buni har bir bosqichda dalili bilan ko'rsataman, so'ng agar jonli mahsulotda ko'rinmayotgan bo'lsa — sabab kodda emas, **deploy yoki BytePlus konsol aktivatsiyasida** ekanini tekshiradigan to'liq Claude Code promptini beraman.

### Seedance 2.0 Mini — ulanish holati (dalillar bilan)

| Bosqich | Holat | Dalil |
|---|---|---|
| Rasmiy model ID to'g'rimi | ✅ | Kod: `dreamina-seedance-2-0-mini-260615` — rasmiy `Model list.txt:283` bilan **aynan bir xil** |
| Region to'g'rimi | ✅ | `ark.ap-southeast.bytepluses.com/api/v3` = docs `ark+ap-southeast-1` |
| Server katalogda bormi | ✅ | `gen-models.ts:1393` id **3103**, `enabled: true`, `provider: "byteplus"`, feature `reference-to-video` |
| Imkoniyatlar to'g'rimi | ✅ | 480p/720p (docs: Mini faqat shu), media-refs image≤9/video≤3/audio≤3, endFrame, i2v — hammasi docs bilan mos |
| Generatsiya dispatcheri | ✅ | `gen-processor.ts:1709` `provider === "byteplus"` → `runByteplusVideo` (deskriptordan haydaladi, Mini uchun yangi kod shart emas) |
| Narx/cost-quote | ✅ | `provider-cost.ts:79` `3103: { "480p": 0.032, "720p": 0.071 }` — cost-quote xato bermaydi, floor ushlanadi (480p ≈ 4.7× marja) |
| Web klient ulangan | ✅ | `platform/index.html` — video model ro'yxatini `/api/studio/gen/models?mode=video` dan oladi, **katalog-driven** (hardcoded ro'yxat yo'q) → yoqilgan har model avtomatik chiqadi |
| Plagin klient ulangan | ✅ | `AssetFlow_Plugin.html:14429` — `/api/studio/gen/models?mode=video` dan oladi; **SC_19 da klient-tomon whitelist OLIB TASHLANGAN** ("endi web bilan aynan bir xil yoqilgan to'plamni ko'rsatadi") |
| E2E tasdiqlangan | ✅ | Commit `f74c7ee` (2026-07-20): "R4_01: add Seedance 2.0 Mini (BytePlus) — activated + verified e2e"; `scripts/probe-byteplus-model.mjs` t2v 480p/4s submit+succeed |
| Lokal kod = deploy | ✅ | `git status`: `main...origin/main`, 0 ta commit ilgarida — lokal daraxt remote bilan bir xil |

**Xulosa:** Mini kod bo'yicha to'liq ulangan. Ikkala klient ham katalog-driven bo'lgani uchun, model server katalogida `enabled:true` bo'lsa — u avtomatik ko'rinadi.

### Agar jonli mahsulotda Mini ko'rinmayotgan bo'lsa — 3 ta ehtimoliy sabab (kodda emas)

1. **Prod hali deploy qilinmagan.** Mini 2026-07-20 da qo'shilgan. Cloud Run revizyasi shundan eskiroq bo'lsa, katalogda Mini yo'q. (Deploy `apps/api/**` o'zgarganda `main`ga push'da avtomatik ishga tushadi — lekin buni jonli tasdiqlash kerak.)
2. **BytePlus ModelArk konsolida Mini aktivlashtirilmagan** — aynan prod `BYTEPLUS_API_KEY` uchun. ModelArk'da har model konsolda yoqilishi shart, aks holda API `ModelNotOpen` qaytaradi. Probe 07-20 da o'tgan, lekin prod kaliti boshqa bo'lsa yoki aktivatsiya so'ngan bo'lsa — qayta tekshirish kerak.
3. **Foydalanuvchida eski plagin ZXP o'rnatilgan** — SC_19 (07-16) dan oldingi build bo'lsa, unda klient whitelist hali bor va Mini'ni yashiradi. (07-16 dan keyingi build'da bu muammo yo'q.)

Quyidagi prompt aynan shu 3 nuqtani tekshiradi va qandaydir haqiqiy bo'shliq topilsa — tuzatadi.

---

## 2. Claude Code prompti (to'liq, o'zi-yetarli)

> Quyidagini butunicha Claude Code'ga bering. U "noldan ulash" emas — chunki kod allaqachon bor — balki **ulanishni oxirigacha tasdiqlash va har qanday haqiqiy bo'shliqni yopish** prompti. Bu ancha foydaliroq, chunki mavjud ishlaydigan kodni dublikatlamaydi.

```
VAZIFA: Seedance 2.0 Mini (BytePlus ModelArk, id 3103, model `dreamina-seedance-2-0-mini-260615`)
ning web platforma VA After Effects plaginigacha to'liq, uchdan-uchgacha (end-to-end) ulanganini
TASDIQLA, va agar biror bosqichda haqiqiy uzilish topsang — MINIMAL o'zgarish bilan yop.

MUHIM KONTEKST (buni bilib tur, qayta ixtiro qilma):
- Loyiha: FrameFlow, monorepo. Backend: apps/api (Express+Prisma+TS). Web: packages/assetflow-studio/
  platform/index.html (katalog-driven SPA). Plagin: plugins/after-effects-cep/AssetFlow_Plugin.html.
- Model katalogi YAGONA manba: apps/api/src/lib/gen-models.ts. Klientlar modellarni
  GET /api/studio/gen/models?mode=video dan oladi — hardcoded ro'yxat YO'Q. Shuning uchun katalogda
  enabled:true bo'lgan model ikkala klientda avtomatik chiqishi KERAK.
- Seedance 2.0 Mini allaqachon kodda bor: gen-models.ts id 3103 (enabled:true, provider "byteplus",
  byteplusModel "dreamina-seedance-2-0-mini-260615", feature "reference-to-video", 480p/720p,
  media-refs, endFrame). Dispatch: gen-processor.ts provider==="byteplus" → runByteplusVideo.
  Narx: provider-cost.ts 3103 {480p:0.032, 720p:0.071}. Adapter: apps/api/src/lib/ai/byteplus.ts.
- PUL ZONASINI O'ZGARTIRMA: computeGenCost, cost-quote HMAC, consume/refund, model.cost/perSec
  qiymatlari — bularga TEGMA. Faqat ulanish/ko'rinish/aktivatsiyani tekshir.

BAJARADIGAN TEKSHIRUVLAR (har birida ANIQ natija yoz — PASS/FAIL + fayl:qator):

1) KATALOG (server):
   - gen-models.ts da 3103 haqiqatan enabled:true, provider "byteplus", to'g'ri byteplusModel,
     feature "reference-to-video", resolutions faqat ["480p","720p"] ekanini tasdiqla.
   - getModelsByMode("video") 3103 ni QAYTARISHINI tekshir (enabled !== false filtri o'tadimi).
   - Rasmiy docs bilan solishtir: ~/Projects/byteplus/"Model list.txt" 283-qator
     (dreamina-seedance-2-0-mini-260615, 480p/720p, multimodal ref + i2v). Farq bo'lsa yoz.

2) DISPATCH + NARX:
   - gen-processor.ts: 3103 (provider "byteplus", feature reference-to-video, media-refs+endFrame)
     runByteplusVideo → buildByteplusVideoBody yo'lidan to'g'ri o'tishini kod bo'yicha tasdiqla.
     buildByteplusVideoBody model.byteplusModel ni ishlatishini, mediaRefs/endFrame/resolution/
     duration ni deskriptordan olishini tekshir (Mini uchun maxsus shart kerak emasligini tasdiqla).
   - provider-cost.ts: 3103 uchun 480p/720p USD borligini, cost-quote null qaytarmasligini,
     assert-pricing-floors boot-tekshiruvi Mini kanalini floor'dan pastga tushirmasligini tasdiqla.

3) WEB KLIENT (platform/index.html):
   - Video model ro'yxati /api/studio/gen/models?mode=video dan olinib, feature!=='video-upscale'
     dan boshqa filtr YO'Qligini tasdiqla (ya'ni 3103 chiqadi). Agar biror hardcoded
     brand/label/id whitelist yoki dedup 3103 ni yashirsa — TOP va olib tashla.
   - Composer video model tanlagichida "Seedance 2.0 Mini" alohida yozuv sifatida ko'rinishini,
     3102 "Seedance 2.0" bilan ADASHTIRILMASLIGINI (label to'qnashuvi yo'q) tasdiqla.

4) PLAGIN KLIENT (AssetFlow_Plugin.html):
   - ensureVgMeta() /api/studio/gen/models?mode=video dan olishini, SC_19 da olib tashlangan
     klient-tomon whitelist QAYTA KELIB QOLMAGANINI tasdiqla (faqat video-upscale chetlanadi).
   - media-refs + endFrame + 480p/720p li model (Mini) plagin video composer'ida to'liq
     ishlashini (vgCapsFor/mref mashinasi) kod bo'yicha tasdiqla. refKind media-refs UI (+Image/
     +Video/+Audio) va kadr (start/end) Mini uchun ko'rinishini tekshir.
   - Plagin versiyasi/build sanasi SC_19 (2026-07-16) dan keyin ekanini tasdiqla; agar shipped
     AssetFlow_Plugin.html hali eski whitelist'ni saqlab tursa — yangile.

5) DEPLOY HOLATI (kod emas, jonli):
   - `git log -1 --format="%h %ad" -- apps/api/src/lib/gen-models.ts` va Cloud Run oxirgi revizya
     sanasini solishtir. Prod Mini commit'idan (f74c7ee, 2026-07-20) ESKIROQ bo'lsa — bu ASOSIY
     sabab. Deploy zarurligini ANIQ ayt (men, ega, o'zim deploy qilaman — sen deploy QILMA,
     faqat holatni ayt).
   - Eslatma: sen `git push` yoki deploy QILMA. Faqat holatni raportla.

6) BYTEPLUS KONSOL AKTIVATSIYASI (jonli, prod kalit bilan):
   - `node scripts/probe-byteplus-model.mjs dreamina-seedance-2-0-mini-260615 480p 4` ni prod
     BYTEPLUS_API_KEY bilan ishga tushirib bo'lادиган buyruqni menga ber (kalitni chiqarma).
     Javob HTTP 200 + task id = aktiv; "ModelNotOpen"/403 = konsolda yoqish kerak. Natijani izohla.
   - Agar men ishga tushirib "ModelNotOpen" chiqsa — BytePlus ModelArk konsolida qaysi menyudan
     Mini'ni yoqishim kerakligini qisqa yozib ber.

TUZATISH QOIDASI:
- Faqat 3–4 bosqichlarda HAQIQIY uzilish topilsa tuzat (masalan klientda Mini'ni yashiradigan
  qoldiq whitelist/dedup). Har tuzatishni web VA plaginda birga qil (biri qolib ketmasin).
- Pul zonasi, model.cost, cost-quote HMAC — TEGILMAYDI.
- Hech narsa deploy/push QILMA.

YAKUNIY NATIJA: qisqa jadval — har bosqich PASS/FAIL, topilgan haqiqiy bo'shliqlar (bo'lsa),
qilingan minimal tuzatishlar, va MENING qo'limda qoladigan 2 ta jonli qadam (deploy kerakmi +
konsol aktivatsiya probe natijasi).
```

---

## 3. Qo'shimcha: BytePlus katalogda bor, lekin hali ulanmagan modellar (ixtiyoriy)

Rasmiy `Model list.txt` da mavjud, kodda YO'Q (kelajakda qo'shsangiz bo'ladi):

- `seedance-1-5-pro-251215` — 480p/720p/1080p, i2v (Mini/2.0 dan boshqa oila)
- `seedance-1-0-pro-250528`, `seedance-1-0-pro-fast-251015` — eski avlod

Bular hozir kerak emas — 2.0 oilasi (Fast/standard/Mini) allaqachon eng yaxshi qamrovni beradi. Faqat ma'lumot uchun.
