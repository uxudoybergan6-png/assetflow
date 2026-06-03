# CreativeTools SaaS

Adobe Plugin + Asset Marketplace platform (Pixflow.net model).

## Stack

| Component | Technology |
|-----------|------------|
| Web | Next.js 15 + Tailwind + NextAuth |
| API | Node.js + Express + Prisma |
| DB | PostgreSQL |
| Payments | Stripe ($4.99/mo, $39.99/yr) |
| Storage | AWS S3 + Cloudflare CDN |
| Premiere Plugin | UXP + React |
| After Effects Plugin | CEP |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and configure
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local

# 3. Start PostgreSQL, then push schema
npm run db:push
npm run db:seed

# 4. Run dev servers (two terminals)
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

## Admin User

After seed, promote your user to admin in PostgreSQL:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
```

## AssetFlow Studio (Admin + Contributor + AE)

Desktop prototiplar monorepoga ko‘chirildi:

```bash
npm run studio:sync   # → apps/web/public/studio/
npm run dev:api
npm run dev:web
# http://localhost:3000/studio/login.html
```

- **Static dashboards:** `packages/assetflow-studio/README.md`
- **AE Browse plugin:** `plugins/after-effects-cep/README.md` — `./plugins/after-effects-cep/scripts/install-cep.sh`

## Plugin Development

- **Premiere Pro UXP:** `plugins/premiere-uxp/README.md`
- **After Effects CEP:** `plugins/after-effects-cep/README.md`

## MVP Scope

See [SCOPE.md](./SCOPE.md) — Phase 1: Premiere + Web + Stripe + S3. AE plugin includes full AssetFlow Browse UI (CEP).

## Stripe Webhook (local)

```bash
stripe listen --forward-to localhost:4000/api/stripe/webhook
```

## Project Structure

```
apps/
  api/          Express REST API
  web/          Next.js frontend + admin
packages/
  database/     Prisma schema
  shared/       Shared types
  assetflow-studio/  Admin + Contributor HTML dashboards
plugins/
  premiere-uxp/ Premiere Pro panel
  after-effects-cep/ After Effects panel
```
