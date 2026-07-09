# Sessiya hisoboti — AI Studio kirish redizayni (Artlist uslubi) · 2026-07-09

**Vazifa:** Web AI Studio kirishi workspace-first (Artlist AI Toolkit naqshi) + ff-api.js cache-bust.

**Qilindi:**
- "What are we making today?" picker EKRANI olib tashlandi — AI Studio endi to'g'ridan workspace ochadi: chap rail (New session / My Library / sessiyalar), markazda "Start with your idea" bo'sh holati, pastda doimiy composer (MODE pill Image/Video/Voice/SFX + model + sozlamalar + jonli narx + Generate).
- Rejim endi dock'dagi MODE pill'dan; oxirgi rejim `localStorage.ff_ai_tool`da saqlanadi (mount'da tiklanadi, default Image). Kirish = yangi bo'sh sessiya (`viewSess:'new'`).
- Pul zonasi (gen/quote/consume/refund) va PARTIYA 4/5 kodiga tegilmagan; olib tashlangan: picker markup, `openTool`/`backToPicker`, `toolCards`/`minCostOf` hisoblari.
- Cache-bust: manba `ff-api.js?v=dev` → `prepare-cf-pages.mjs` dist index.html'da sha256 kontent-hash (`?v=<hash10>`) bilan almashtiradi ("FFAPI.projectCreate is not a function" incidenti ildizi).

**Tekshirildi (lokal preview + production API proxy orqali, headless):** kirish workspace'ni ochadi (picker yo'q); MODE pill joyida qayta konfiguratsiya (Image↔SFX↔Voice, chip'lar model-driven); sessiya rail'dan yuklanadi (2 gen), My Library 41 gen; REAL gen end-to-end (Nano Banana 2 Lite ✦2, balans 3→1, GCS rasm, sessiya avtonom nomlandi); reload'da oxirgi rejim tiklandi; 390px chip-rail + dock ishlaydi; konsol xatosiz; dist'da `ff-api.js?v=150bb20839`.

**Kutilmoqda:** push + CF Pages deploy, production'da jonli tekshiruv.
