# Cloud Run uchun AssetFlow API (Render o'rniga). DB=Neon, assetlar=R2 (o'zgarmaydi).
# Tizim ffmpeg (transcode/optimize-preview) + Prisma uchun openssl SHART.
# #114 (I12) — Node 22 LTS: Node 20 xavfsizlik qo'llab-quvvatlashi 2026-04'da tugadi
# (EOL) — yangi CVE'lar uchun patch CHIQMAYDI. CI (ci.yml, deploy-cloudrun.yml) va
# root package.json `engines` bilan bir xil major bo'lishi SHART.
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Prisma `native` binaryTarget'ni generate paytida OpenSSL orqali aniqlaydi.
# Build stage'da openssl bo'lmasa noto'g'ri engine varianti tanlanib, runtime'da
# `query_engine_openssl` bilan faqat birinchi DB so'rovida yiqiladi.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ffmpeg (preview transcode) + openssl/ca (Prisma engine + TLS)
# Monorepo: barcha workspace manbasi (node_modules .dockerignore'da chiqarilgan)
COPY . .

# #113 (I11) — `npm install` EMAS, `npm ci`: `install` lockfile'ni e'tiborsiz
# qoldirib yangi mos versiyalarni tortishi mumkin edi → productionда LOKALDA
# SINALMAGAN bog'liqlik daraxti (deploy takrorlanmaydigan, "lokalda ishlaydi"
# klassikasi). `ci` lockfile'ga qat'iy amal qiladi va node_modules'ni toza quradi.
# Soxta stub package.json'lar olib tashlandi — .dockerignore endi haqiqiy
# manifestlarni kiritadi (aks holda `ci` nom/deps nomuvofiqligida yiqilardi).
# render.yaml buildCommand bilan bir xil tartib: install → prisma generate → build db → build api
# `npm prune` prisma CLI/@prisma/engines paketlarini devOptional sifatida olib
# tashlaydi. Generated Client'ning platform query-engine faylini oldindan saqlab,
# prune'dan keyin qaytarmasak runtime faqat DB so'rovida yiqiladi (server/livez tirik).
RUN npm ci --include=dev \
 && npm run generate -w @creative-tools/database \
 && npm run build -w @creative-tools/database \
 && npm run build -w apps/api \
 && cp -a node_modules/.prisma /tmp/prisma-generated \
 && npm prune --omit=dev --omit=optional \
 && cp -a /tmp/prisma-generated/. node_modules/.prisma/ \
 && test -f node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/packages/database/package.json ./packages/database/package.json
COPY --from=build --chown=node:node /app/packages/database/dist ./packages/database/dist
COPY --from=build --chown=node:node /app/packages/database/prisma ./packages/database/prisma

ENV NODE_ENV=production
# Cloud Run PORT=8080 ni inject qiladi; app process.env.PORT'ni o'qiydi (index.ts:29)
EXPOSE 8080

USER node
CMD ["node", "apps/api/dist/bootstrap.js"]
