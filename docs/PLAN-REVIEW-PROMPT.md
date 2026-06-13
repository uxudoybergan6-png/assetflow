# Reja-tekshiruv prompti (Claude Code uchun)

Bu rejalar (`docs/PLAN-bosqich-*.md`) kod tahlilida yozilgan, lekin kod o'zgargan bo'lishi mumkin.
**Kod yozishdan OLDIN** Claude Code bilan har bir rejani haqiqiy kodga solishtirib tasdiqlang.

---

## 1-qadam: bitta rejani tekshirtirish

Claude Code'ga quyidagini bering (bosqich raqamini almashtiring):

```
docs/PLAN-bosqich-0-blocker.md ni o'qi. KOD YOZMA.
Rejadagi har bir "tasdiqlangan holat" da'vosini va har bir fayl/qator
havolasini haqiqiy kod bilan solishtir. Har biri uchun ayt:
  ✅ TO'G'RI — kod rejaga mos
  ⚠️ O'ZGARGAN — qator/nom siljigan (yangi joyini ko'rsat)
  ❌ NOTO'G'RI — bunday narsa yo'q yoki boshqacha
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

## Tekshirishda diqqat qilinadigan asosiy bandlar

| Bosqich | Eng muhim tekshiruv |
|---|---|
| 0 | `render.yaml` `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE` qiymati; `plugin-profile.ts` gate mantig'i; `ZXPSignCmd` o'rnatilganmi |
| 1 | `Plugin.html:9` va `Admin.html:8` `:root` hali ham ajraganmi; indigo grep 0 ga tushganmi; mayda shrift qatorlari |
| 2 | 6 ta `evalScript` chaqiruvi o'sha qatorlardami; Sentry hali yo'qmi; CORS domeni qaysi (vercel yoki pages.dev faol?) |
| 3 | `ai.ts` yo'qligini, `AiGeneration`/`aiCredits` yo'qligini tasdiqlash; `requireAuth` nomi (reja `requirePluginAuth` emas, `requireAuth` deb tuzatilgan) |
| 4 | `premiere-uxp/src/api.ts` qaysi endpoint'ni chaqiradi (legacy `Asset` yoki `ContributorTemplate`?); SSE/rate-limit hali in-memory'mi |

> Eslatma: har reja "REJA — kod yozilmaydi" deb belgilangan. Tekshiruv ham
> faqat o'qish/hukm — implementatsiya 3-qadamda, sizning tasdig'ingizdan keyin.
