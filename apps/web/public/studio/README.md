# AssetFlow Studio

## Yangi boshlash (demo yo'q)

```bash
# 1. Bazadagi demo shablonlar va fayllarni tozalash
cd ~/Projects/creative-tools-saas
npm run demo:clear

# 2. Serverlar (3 ta terminal)
npm run studio:sync
npm run dev:api
npm run dev:web
npm run dev:studio-admin
```

| Vazifa | URL |
|--------|-----|
| Contributor (yuklash) | http://localhost:3000/studio/login.html |
| **Admin (tasdiqlash)** | **http://localhost:3001/** |
| Admin login | http://localhost:3001/login.html |

## Ro'yxatdan o'tish

http://localhost:3000/studio/login.html → **Ro'yxatdan o'tish** (Contributor)

## Admin

PostgreSQL:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'siz@email.com';
```

Keyin: **http://localhost:3001/login.html** → Kirish → **Moderation**

## Eslatma

`db:seed:assetflow` demo hisoblar uchun — endi shart emas.
