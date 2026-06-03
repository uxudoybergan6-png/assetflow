# Studio + Admin onlayn (Vercel)

Bitta Vercel loyiha — Contributor va Admin bir URL ostida.

## URL lar (deploy dan keyin)

| Vazifa | Manzil |
|--------|--------|
| Hub | `https://SIZNING-APP.vercel.app/` |
| Contributor login | `.../studio/login.html` |
| Contributor panel | `.../studio/contributor/` |
| Admin login | `.../admin/login.html` |
| Admin panel | `.../admin/` |

API: `https://assetflow-rqbq.onrender.com` (meta tag orqali)

---

## 1. GitHub Push

Yangi o'zgarishlar (`vercel.json`, `studio-config.js`) push qiling.

---

## 2. Vercel

1. https://vercel.com → **Add New → Project**
2. GitHub → repo **assetflow**
3. **Root Directory:** `packages/assetflow-studio`
4. Framework: **Other** (static)
5. Build Command: **bo'sh**
6. Output Directory: **`.`** (nuqta)
7. **Deploy**

---

## 3. Render CORS

Render → Environment → `CORS_ORIGIN`:

```
https://SIZNING-APP.vercel.app,*
```

(yoki faqat Vercel URL)

---

## 4. Tekshirish

- Hub ochiladi
- Contributor: `dilnoza.k@gmail.com` / `contrib123`
- Admin: `admin@assetflow.uz` / `admin123`
- Yuklash → Render API → Neon DB

---

## API URL o'zgartirish

Barcha HTML `<head>` da (yoki keyingi deployda):

```html
<meta name="assetflow-api" content="https://assetflow-rqbq.onrender.com">
```

Default `studio-config.js` da ham shu URL bor.

---

## Lokal ishlash (o'zgarmaydi)

```bash
npm run studio
# localhost:3000/studio/hub.html
# localhost:3001/
```
