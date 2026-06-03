# AssetFlow — bitta yo‘l (chalkashmaslik uchun)

Maqsad: **API internetda ishlasin** (Neon DB + Render server).

---

## Sizda nima bor

| Narsa | Holat |
|-------|--------|
| Kod GitHub | https://github.com/uxudoybergan6-png/assetflow |
| Neon DB | Yaratilgan (`ep-shy-cake-...`) |
| Render API | Hali qilinmagan |
| AE plugin | Kompyuterda, keyin onlayn URL ulanadi |

**E’tibor:** `creative-tools-saas/assetflow` ichki papka — **loyiha emas**. O‘chirildi, `.gitignore` da.

---

## FAQAT 4 QADAM

### QADAM 1 — GitHub (5 daqiqa)

GitHub Desktop:

1. Papka: `/Users/usmonov/Projects/creative-tools-saas`
2. `assetflow` papkasi ro‘yxatda **ko‘rinmasin** (biz o‘chirdik)
3. Commit qilingan fayllar: `render.yaml`, `apps/api/...`, `docs/`
4. **Summary:** `Render deploy sozlama`
5. **Commit** → **Push** (⌘P)

Tugadi: GitHub yangilandi.

---

### QADAM 2 — Render (10 daqiqa)

1. Brauzer: https://dashboard.render.com
2. **Sign in with GitHub** → `uxudoybergan6-png`
3. **New +** → **Blueprint**
4. Repo **assetflow** → **Apply**
5. **Environment** (muhim):

```
DATABASE_URL = (Neon Copy snippet — to'liq)
CORS_ORIGIN = *
PLUGIN_ALLOW_PRO_WITHOUT_STRIPE = true
```

`JWT_SECRET` — Render o‘zi yaratishi mumkin.

6. **Deploy** kuting (yashil “Live”)

7. Yuqoridagi URL, masalan: `https://assetflow-api-xxxx.onrender.com`

8. Brauzerda oching: `.../health` → `{"status":"ok"}`

9. Environment ga qo‘shing va yana save:

```
API_PUBLIC_URL = https://assetflow-api-xxxx.onrender.com
```

---

### QADAM 3 — Demo ma’lumot (5 daqiqa)

**Eng oson: Render Shell** (Neon allaqachon ulangan)

1. Render → servis **assetflow** → **Shell** (yoki Logs yonidagi Shell)
2. Buyruq:

```bash
cd /opt/render/project/src && npm run db:seed:assetflow
```

Mac’dan (faqat Neon string **to‘liq** nusxa bo‘lsa):

```bash
cd /Users/usmonov/Projects/creative-tools-saas
DATABASE_URL='postgresql://...' npm run db:seed:assetflow
```

`items:[]` bo‘lsa — seed ishlamagan; yuqoridagi Shell ishlating.

Loginlar:

- Plugin: `user@assetflow.uz` / `user123`
- Admin: `admin@assetflow.uz` / `admin123`

---

### QADAM 4 — Sinash

Brauzer: `https://SIZNING-URL.onrender.com/api/plugin/catalog`

AE plugin: API manzil = shu Render URL.

---

## Chalkashadigan narsalar — UNUTING

| Narsa | Kerakmi? |
|-------|----------|
| `npx neonctl init` | Yo‘q |
| Ichki `assetflow/` papka | Yo‘q (loyiha emas) |
| GitHub ni Cursor ga ulash | Yo‘q |
| Windows server | Yo‘q (A variant: Render) |
| Eski hisob `khudoyberganusmonov-lang` | Yo‘q |

---

## Muammo bo‘lsa

Faqat bittasini yuboring:

1. Qaysi qadam (1–4)
2. Skrin yoki xato matni
