# Reja-tekshiruv prompti (Claude Code uchun)

Bu rejalar (`docs/PLAN-bosqich-*.md`) kod tahlilida yozilgan, lekin kod o'zgargan bo'lishi mumkin.
**Kod yozishdan OLDIN** Claude Code bilan har bir rejani haqiqiy kodga solishtirib tasdiqlang.

> **Muhim:** har reja ichida endi "⚠️ HANDOFF.md bilan solishtiruv" jadvali bor (qaysi band 🟢 bajarilgan / 🔴 ochiq / 🟡 qisman). Tekshirishda **HANDOFF.md ham, haqiqiy kod ham** manba bo'lishi kerak — HANDOFF holat haqida gapiradi, kod esa hozirgi haqiqatni ko'rsatadi. Ikkalasi mos kelmasa, **kod ustun**.

---

## 1-qadam: bitta rejani tekshirtirish

Claude Code'ga quyidagini bering (bosqich raqamini almashtiring):

```
docs/PLAN-bosqich-0-blocker.md va HANDOFF.md ni o'qi. KOD YOZMA.
Rejadagi har bir "tasdiqlangan holat" da'vosini, "HANDOFF solishtiruv"
jadvalidagi har bir 🟢/🔴/🟡 belgini, va har bir fayl/qator havolasini
haqiqiy kod bilan solishtir. Har biri uchun ayt:
  ✅ TO'G'RI — kod va HANDOFF rejaga mos
  ⚠️ O'ZGARGAN — qator/nom siljigan yoki HANDOFF eskirgan (yangi joyini ko'rsat)
  ❌ NOTO'G'RI — bunday narsa yo'q yoki allaqachon qilingan (rejada ochiq deb belgilangan)
Har bir taklif qilingan o'zgartirish uchun: amalga oshirsa bo'ladimi,
qanday risk bor, va biror bog'liqlik buzilmaydimi — qisqa hukm ber.
Oxirida: bu bosqichni hozir boshlash mumkinmi yoki avval nima tuzatish kerak.
```

## 2-qadam: hukmni o'qib, qaror qabul qilish

- Hamma ✅ bo'lsa → bosqichni boshlash xavfsiz.
- ⚠️ bo'lsa → reja qator-havolalarini yangilatib, keyin boshlash.
- ❌ bo'lsa → o'sha bandni rejadan olib tashlash yoki qayta o'ylash.

## 3-qadam: faqat tasdiqdan keyin implementatsiya

```
Tekshiruv tasdiqlangan bandlarni amalga oshir. CLAUDE.md kod uslubiga amal qil:
minimal diff, mavjud konventsiya, o'zbekcha UI. Har bandni alohida qil,
har birida rejadagi "Tekshirish" qadamini bajar. Tugagach docs/SESSION-REPORT.md ni yangila.
```

---

## Tekshirishda diqqat qilinadigan asosiy bandlar (HANDOFF holatiga moslangan)

| Bosqich | Real yangi ish (tekshir) | Allaqachon qilingan (tasdiqla, qayta qilma) |
|---|---|---|
| 0 | **Vazifa A:** `render.yaml` `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE="true"` hali shundaymi; `plugin-profile.ts:79` gate | **B (ZXP):** `build-zxp.sh` bor (faqat test); **C (CORS):** klient `pages.dev`ga ko'chgan — `render.yaml`/dashboard tekshir |
| 1 | `tokens.css` yo'q; `Plugin.html:9` va `Admin.html:8` `:root` ajraganmi; indigo grep; shrift 7–9px | toast, skeleton, o'zbekcha label, filtr ko'rsatkichi — **bor, qayta yozma** |
| 2 | `evalJSX` wrapper yo'qligini; Sentry yo'qligini; `/plugin/version` yo'qligini | rate-limit, JWT validateEnv, trust proxy, error handler, 401 interceptor, evalScript watchdog — **bor** |
| 3 | `ai.ts`, `AiGeneration`, `aiCredits` yo'qligini; `requireAuth` nomi | R2 stream-upload, SSE, PluginToken auth, subscription gate — **poydevor tayyor** |
| 4 | `premiere-uxp/src/api.ts` qaysi endpoint (legacy `Asset`?); premiere HANDOFF'da eslanmaganini | `ContributorTemplate` faol model; SSE/rate-limit in-memory (Redis keyin) |

> Eslatma: har reja "REJA — kod yozilmaydi" deb belgilangan. Tekshiruv ham
> faqat o'qish/hukm — implementatsiya 3-qadamda, sizning tasdig'ingizdan keyin.
> HANDOFF'dagi "🟢 bajarilgan" bandlarni qayta implementatsiya qilmang — faqat
> ishlayotganini tasdiqlang.
