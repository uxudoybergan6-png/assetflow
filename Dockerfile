# Cloud Run uchun AssetFlow API (Render o'rniga). DB=Neon, assetlar=R2 (o'zgarmaydi).
# Tizim ffmpeg (transcode/optimize-preview) + Prisma uchun openssl SHART.
# #114 (I12) — Node 22 LTS: Node 20 xavfsizlik qo'llab-quvvatlashi 2026-04'da tugadi
# (EOL) — yangi CVE'lar uchun patch CHIQMAYDI. CI (ci.yml, deploy-cloudrun.yml) va
# root package.json `engines` bilan bir xil major bo'lishi SHART.
FROM node:22-bookworm-slim

WORKDIR /app

# ffmpeg (preview transcode) + openssl/ca (Prisma engine + TLS)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Monorepo: barcha workspace manbasi (node_modules .dockerignore'da chiqarilgan)
COPY . .

# #113 (I11) — `npm install` EMAS, `npm ci`: `install` lockfile'ni e'tiborsiz
# qoldirib yangi mos versiyalarni tortishi mumkin edi → productionда LOKALDA
# SINALMAGAN bog'liqlik daraxti (deploy takrorlanmaydigan, "lokalda ishlaydi"
# klassikasi). `ci` lockfile'ga qat'iy amal qiladi va node_modules'ni toza quradi.
# Soxta stub package.json'lar olib tashlandi — .dockerignore endi haqiqiy
# manifestlarni kiritadi (aks holda `ci` nom/deps nomuvofiqligida yiqilardi).
# render.yaml buildCommand bilan bir xil tartib: install → prisma generate → build db → build api
RUN npm ci --include=dev \
 && npm run generate -w @creative-tools/database \
 && npm run build -w @creative-tools/database \
 && npm run build -w apps/api

ENV NODE_ENV=production
# Cloud Run PORT=8080 ni inject qiladi; app process.env.PORT'ni o'qiydi (index.ts:29)
EXPOSE 8080

CMD ["node", "apps/api/dist/index.js"]
