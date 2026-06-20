# Studio Gen — jonli tahlil (Artlist AI Toolkit → AssetFlow namunasi)

*Manba: toolkit.artlist.io AI Toolkit — Claude in Chrome orqali jonli DOM + Network tahlili (2026-06-15).*
*Maqsad: AssetFlow Studio'da shunga o'xshash "generativ studio" oqimini qurish.*

> Bu hujjat taxmin emas — quyidagi endpoint va elementlar Artlist sahifasidagi **real tarmoq so'rovlari** va DOM'dan olingan. `Generate` mutatsiyasi (kredit sarflagani uchun) bosilmadi — u "Ochiq savollar" bo'limida.

## 1. Texnologiya steki (kuzatilgan)

| Qatlam | Texnologiya |
|--------|-------------|
| Frontend | Next.js (SPA, client-side routing) |
| API | **tRPC** — `https://toolkit.artlist.io/api/trpc/<router>.<procedure>` |
| Serializatsiya | **superjson** (`{"json":{...},"meta":{...}}` shakli) |
| Asset CDN | `cms-toolkit-public-artifacts.artlist.io/content/video/...` |
| Analitika | Segment (`api.segment.artlist.io`), Datadog RUM, GA4 |

## 2. Asosiy tushuncha — Session = Workspace

URL: `toolkit.artlist.io/019ea64c-f5e9-7388-b3ad-55d88f17dd31?mode=music&mediaTypes=generatedVideo`

- Path segment `019ea64c-...` = **sessionId** (UUID v7). Bitta ish maydoni.
- Query: `mode` (music/video/image), `mediaTypes` (filter), tanlangan asset uchun `assetId`, `mediaType`, `assetWidth/Height/AspectRatio`.
- Har generatsiya shu sessiyaga bog'lanadi va sidebar tarixida chiqadi.

## 3. Kuzatilgan tRPC routerlar (real so'rovlar)

```
GET /api/trpc/userGenerationRouter.getUserGenerationsBySession
    input={"json":{"sessionId":"<uuid>","cursor":1,"perPage":25,
                   "category":null,"status":null,"generationType":[]}}
    → sessiya generatsiyalari (sidebar/grid), paginatsiya + filtr

GET /api/trpc/chatSession.getChatSessions
    input={"json":{"page":1,"perPage":25}}
    → "AI Agent" rejimidagi chat sessiyalari ro'yxati

GET /api/trpc/modelRouter.getModel
    input={"json":{"modelId":2318}}
    → model metadatasi (modellar raqamli ID: 2318, 1044, 2209...)

GET /api/trpc/favorites.getFavoritesByIds
    input={"json":{"assets":[{"id":"<uuid>","type":140}],...}}
    → sevimlilar holati
```

Naqsh: har asset `{id, type}` juftligi bilan ataladi (`type:140` = generated video kabi raqamli tur kodi).

### 3.1 To'liq router xaritasi (kuzatilgan, 17+ procedure)

```
modelRouter.getModelGroups        → barcha modellar katalogi ("All Models")
modelRouter.getModel{modelId}     → bitta model metadatasi
modelRouter.getCostQuote (POST)   → generatsiyadan OLDIN kredit narxini hisoblash
userGenerationRouter.getUserGenerationsBySession → sessiya tarixi (grid/sidebar)
userGenerationRouter.getOutputTypesForSession    → sessiya uchun chiqish turlari
chatSession.getChatSessions       → AI Agent chat sessiyalari
chatSession.getFreeGenerations    → bepul generatsiya limiti
wallet.getWalletBalance           → kredit balansi
dynamicPromptSettings.getDynamicPromptSettings → "Enhance"/auto sozlamalar
favorites.getFavoritesByIds       → sevimlilar
packages.resolve                  → asset paketlari
billing.getSubscriptionHistory, journeys.getPlans/getLeadInfo,
subscriptionPermissionRouter.getPermissions, enterprise.getAccountManager → obuna/billing
```

**Kredit oqimi (real):** `wallet.getWalletBalance` (balans) → `modelRouter.getCostQuote` (har model+param uchun narx; masalan Lyria 3 Pro = **300**, Lyria 3 = **150** kredit) → Generate. Bepul limit `chatSession.getFreeGenerations` orqali.

## 4. Composer tuzilishi (real DOM elementlar)

```
┌─ COMPOSER ─────────────────────────────────────────────┐
│ [Standard mode] [AI Agent]          ← rejim toggle      │
│ [+] Music input options                                 │
│ [ Prompt textbox..................]  [Enhance prompt ✨] │
│ [Mode ▾ Music] [Model ▾] [Auto Lyrics ▾] [Settings ⚙]  │
│                                          [ Generate ]   │
└─────────────────────────────────────────────────────────┘
```

Muhim elementlar:
- **Standard mode ↔ AI Agent** — bir composer ikki rejimda: oddiy generatsiya yoki chatbot agent.
- **Enhance prompt** — promptni AI bilan kengaytirish (alohida tugma).
- **Mode** comboboxi `mode` ni almashtiradi → model ro'yxati va sozlamalar to'plami o'zgaradi.
- **Generation settings** (⚙) — Auto Duration / Auto Genre / Auto Mood kabi.
- Topbar: **Credits balance** + **Get More Credits** (har gen kredit yeydi).

## 5. AssetFlow uchun moslashtirilgan namuna

### 5.1 URL / session modeli
AssetFlow'da ham har "studio ish maydoni" = `sessionId`:
```
/studio/gen/:sessionId?mode=video&mediaTypes=template
```

### 5.2 API (AssetFlow Express uslubida — tRPC shart emas)

| Metod | Yo'l | Artlist ekvivalenti |
|-------|------|---------------------|
| `GET` | `/api/studio/gen/sessions/:id/generations?cursor=&perPage=25&status=` | `getUserGenerationsBySession` |
| `POST` | `/api/studio/gen/sessions` | yangi session |
| `GET` | `/api/studio/gen/models?mode=video` | `modelRouter` |
| `POST` | `/api/studio/gen` → `{ jobId }` | generate mutation |
| `GET` | `/api/studio/gen/:jobId` | job holati polling |
| `POST` | `/api/studio/gen/prompt/enhance` | Enhance prompt |
| `GET` | `/api/studio/credits` | Credits balance |

### 5.3 Prisma modeli

```prisma
model GenSession {
  id          String       @id @default(cuid())
  userId      String
  title       String?
  createdAt   DateTime     @default(now())
  generations Generation[]
  user        User         @relation(fields: [userId], references: [id])
}

model Generation {
  id         String   @id @default(cuid())
  sessionId  String
  mode       String              // music | video | image
  prompt     String
  modelId    Int                 // raqamli model ID (Artlist uslubi)
  params     Json                // lyrics/duration/genre/mood/aspectRatio...
  status     String   @default("queued") // queued|running|done|failed
  category   String?
  cost       Int      @default(0)
  assets     GenAsset[]
  createdAt  DateTime @default(now())
  session    GenSession @relation(fields: [sessionId], references: [id])
}

model GenAsset {
  id          String  @id @default(cuid())
  generationId String
  type        Int                // 140=video kabi tur kodi
  url         String             // CDN URL
  thumbUrl    String?
  width       Int?
  height      Int?
  aspectRatio String?            // "16:9"
  generation  Generation @relation(fields: [generationId], references: [id])
}
```

### 5.4 Oqim
```
1. Composer: mode + prompt (+ Enhance) + model + params
2. POST /api/studio/gen { sessionId, mode, prompt, modelId, params }
   → 202 { jobId } (kredit zaxiraga olinadi)
3. Polling GET /api/studio/gen/:jobId → status/progress/assets
4. done → grid + sidebar tarixiga qo'shiladi (getGenerationsBySession qayta yuklanadi)
5. failed → kredit qaytariladi
```

## 6. AssetFlow konventsiyalariga eslatma
- UI matnlari o'zbekcha.
- Manba: `packages/assetflow-studio/js/` + `styles/`, so'ng `npm run studio:sync`.
- Asset saqlash: mavjud R2 (`s3.ts`) — CDN sifatida `CDN_BASE_URL`.
- Tarix → mavjud `templateAssetFlags` oqimiga ulanishi mumkin.

## 7. Generatsiya oqimi — TO'LIQ ANIQLANDI (jonli test, 150 kredit)

Bitta haqiqiy generatsiya (Lyria 3, "calm lo-fi piano with soft rain") orqali butun zanjir kuzatildi.

### 7.1 Narx hisoblash (Generate'dan oldin)
Foydalanuvchi prompt/sozlamani o'zgartirganda har safar:
```
POST /api/trpc/modelRouter.getCostQuote
{"json":{"modelGroupId":2241,"input":{
  "prompt":"...","duration":30,"song_type":"generated_lyrics",
  "prompt_enhance_mode":"artlist_sound","song_genre":"auto",
  "song_mood":"auto","song_theme":"auto","song_tempo":"auto"}}}
→ narx (150) + IMZOLANGAN token (costQuoteDigitalSignature, JWT)
```

### 7.2 Generate mutatsiyasi (REAL payload)
```
POST /api/trpc/userGenerationRouter.createUserGeneration
{"json":{
  "chatSessionId":"<sessionId>",
  "inputs":{"prompt":"calm lo-fi piano with soft rain, relaxing"},
  "modelGroupId":2241,
  "feature":"text-to-music",
  "price":150,
  "settings":{ "prompt":"...","duration":30,"song_type":"generated_lyrics",
    "prompt_enhance_mode":"artlist_sound","song_genre":"auto",
    "song_mood":"auto","song_theme":"auto","song_tempo":"auto"},
  "artifacts":[],
  "costQuoteDigitalSignature":"eyJhbG...JWT..."   // 7.1 dan kelgan imzolangan narx
}}
→ { id, status:"queued", ... }   // yangi generation id (UUID v7)
```

🔐 **MUHIM xavfsizlik naqshi:** `costQuoteDigitalSignature` — server `getCostQuote` da narxni JWT bilan imzolaydi; `createUserGeneration` shu imzoni qaytaradi va server uni tekshiradi. Shunday qilib klient narxni (`price`) soxtalashtira olmaydi. **AssetFlow uchun tavsiya:** kredit narxini hech qachon klientga ishonmang — imzolangan quote ishlating.

### 7.3 Holat obyekti (status check)
```
GET /api/trpc/userGenerationRouter.getUserGeneration?input={"json":{"id":"<genId>"}}
→ { id, outputId, status, fileKey, thumbnailKey, audioUrl, metadata,
    prompt, modelId, settings, feature, price, type:"music",
    assetType:"generatedMusic", musicSettings, lyrics, inputLyrics, createdAt }
```
`status`: `queued` → (`processing`) → `completed`. Tugagach `audioUrl` + `fileKey` to'ladi.

### 7.4 Holat yangilanishi — WebSocket (polling EMAS) ✅
Jonli test natijasi: generatsiya davom etgan ~70 soniya davomida **hech qanday takroriy fetch/XHR so'rovi bo'lmadi** (`getUserGeneration` faqat 1 marta, yaratilgandan keyin). Backend `completed` bo'lganda ham UI fetch-poll qilmadi.
→ Xulosa: holat **event-driven, sahifa yuklanishida ochilgan doimiy WebSocket** orqali push qilinadi (polling bo'lganida UI allaqachon yangilanardi). Aniq WS endpoint'i faqat yuklanish vaqtida ushlash mumkin (instrumentatsiya yuklashdan keyin o'rnatilgani uchun socket URL ko'rinmadi).

### 7.5 Natija saqlash
Asset CDN: `cms-toolkit-public-artifacts.artlist.io` + model thumbnaillari `cms-artifacts.artlist.io` (imzolangan URL — `Expires`, `Signature`, `Key-Pair-Id` = AWS CloudFront signed URL).

## 8. AssetFlow uchun yakuniy tavsiya (real oqimga asoslangan)
```
1. getCostQuote(modelId, settings) → {price, signature}        # imzolangan narx
2. createGeneration({..settings, price, costQuoteSignature})   # server imzoni tekshiradi
   → {generationId, status:"queued"}                           # kredit zaxiraga olinadi
3. WebSocket push (yoki fallback polling) → status o'zgarishi
4. status="completed" → getGeneration(id) → {audioUrl/fileKey} # CloudFront signed URL
5. failed → kredit qaytariladi
```
Render'da WebSocket qiyin bo'lsa (ephemeral), boshlash uchun **fetch-polling** (har 3–5s `getGeneration(id)`) yetarli; keyin WebSocket'ga o'tish mumkin.

---
*Jonli tahlil: Claude in Chrome, 2026-06-15. Faqat ochiq frontend + API javoblari kuzatildi.*
