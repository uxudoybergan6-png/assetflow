# SESSION REPORT — 2026-06-18 — E: AE Admin "Failed to fetch" diagnostika + tuzatish

## Diagnostika (sabablar)
- CEP origin `file://` → API CORS allowlist'dan o'tadi (index.ts), demak CORS odatda SABAB EMAS.
- "Failed to fetch" asosiy sabablari: (a) API prefs `localhost` (AE ichida ishlamaydi) — `apiBase()` allaqachon localhost→PROD auto-fix qiladi; (b) Render cold-start (uxlagan); (c) eski extension (eski HTML kesh) — yangi ↻ Refresh + auto-fix yumshatadi.
- **Bo'shliq topildi:** `apiForm()` (FormData upload) raw `fetch` edi — cold-start retry YO'Q, xato tarjimasi YO'Q → upload'da tarjimasiz "Failed to fetch". Ikki XHR `onerror` ham xom "Network error"/"Tarmoq xatosi" qaytarardi.

## Tuzatish (AssetFlow_Admin.html)
- `apiForm()` ga `api()` bilan bir xil cold-start retry (`waitForApi`) + `formatFetchError` qo'shildi.
- `formatFetchError` qayta yozildi: `netErrMsg()` + `isNetworkErr()` helperlar — tushunarli o'zbekcha sabab + «🌐 Brauzer Admin» muqobilini taklif qiladi. Ikki XHR `onerror` shu xabarni ishlatadi.
- Login ekranidagi «Brauzer Admin» tugmasi `btn-ghost`(kichik)→`btn-secondary` (yashil konturli, ko'zga tashlanadigan) qilindi; noto'g'ri "(Vercel)" yorlig'i olib tashlandi (URL CF Pages). Yangi `.btn-secondary` CSS.

## Tekshirildi
- Inline JS parse: 1 blok, 0 syntax xato. Fayllar CEP papkasiga ko'chirildi (AE qo'zg'atilmadi), build shtamplandi.

## Kutilmoqda
- F: Studio Gen tarix grid (eng katta).
