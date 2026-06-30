# SESSION REPORT — 2026-06-30 — "Yaxshilash" (enhance) sekinligi: sabab + tuzatish

SABAB (kod tahlili): enhance har doim **fal QUEUE** orqali ketardi (`falEnhancePrompt` → `falSubmit` = submit + POLL). Har chaqiruv:
1. fal queue overhead — submit + birinchi pollдан OLDIN `sleep(600ms)` + status GET + response GET.
2. 3 sakrash: Render → fal queue → fal worker → OpenRouter → gemini-2.5-flash.
3. Referensли holatda KETMA-KET: rasm tahlili + har video + har audio + yakuniy birlashtirish (hammasi alohida queue submit+poll) → ko'paytiriladi.
(JSON/describe yo'li allaqachon to'g'ridan-to'g'ri OpenRouter (`orChatSys`) — tezroq edi; text-enhance esa fal'da qolgan edi.)

TUZATISH (1-bosqich, `studio-gen.ts`, tsc ✓):
- **Referenssiz (faqat matn) enhance → to'g'ridan-to'g'ri OpenRouter (sync)** `orChatSys(gemini-2.5-flash)` — fal queue/poll/3-hop overhead'siz. Eng keng tarqalgan holat (ikkala tool) sezilarli tezlashadi. META-blok yo'qligi (ctx) saqlanadi. OpenRouter sozlanmagan bo'lsa → fal'ga qaytadi.
- Referens (rasm/video/audio) holati hali fal'da (vision/video/audio understanding faqat fal'da). Keyingi: rasm-only'ni OpenRouter vision'ga + multimodal tahlilni PARALLEL qilish.

⚠️ Backend o'zgardi — **push → Render deploy** SHART (aks holda eski sekin yo'l). Frontend tegilmadi.
