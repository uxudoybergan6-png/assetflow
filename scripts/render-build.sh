#!/usr/bin/env bash
# Render build — nusxalab Build Command maydoniga qo'ying yoki shu skriptni chaqiring
set -euo pipefail
npm install
npm run generate -w @creative-tools/database
npm run migrate:deploy -w @creative-tools/database
npm run build -w @creative-tools/database
npm run build -w apps/api
