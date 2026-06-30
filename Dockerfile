# Cloud Run uchun AssetFlow API (Render o'rniga). DB=Neon, assetlar=R2 (o'zgarmaydi).
# Tizim ffmpeg (transcode/optimize-preview) + Prisma uchun openssl SHART.
FROM node:20-bookworm-slim

WORKDIR /app

# ffmpeg (preview transcode) + openssl/ca (Prisma engine + TLS)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Monorepo: barcha workspace manbasi (node_modules .dockerignore'da chiqarilgan)
COPY . .

# render.yaml buildCommand bilan AYNAN bir xil: install → prisma generate → build db → build api
RUN npm install --include=dev \
 && npm run generate -w @creative-tools/database \
 && npm run build -w @creative-tools/database \
 && npm run build -w apps/api

ENV NODE_ENV=production
# Cloud Run PORT=8080 ni inject qiladi; app process.env.PORT'ni o'qiydi (index.ts:29)
EXPOSE 8080

CMD ["node", "apps/api/dist/index.js"]
