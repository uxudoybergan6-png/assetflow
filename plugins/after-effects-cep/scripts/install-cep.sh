#!/bin/bash
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.frameflow"

# AF_SKIP_AE=1 → AE'ni yopmasdan/ochmasdan faqat fayl + kesh yangilanadi
# (CI yoki "AE'ga tegma, men o'zim qayta ochaman" holati uchun).
SKIP_AE="${AF_SKIP_AE:-0}"

# AE versiyasini AVTO-aniqlash: avval ISHLAYOTGAN jarayon (foydalanuvchi aynan shuni ishlatadi),
# bo'lmasa eng yangi o'rnatilgan.
AE_BIN="$(ps -axo args= 2>/dev/null | grep -oE '/Applications/Adobe After Effects [0-9]+/Adobe After Effects [0-9]+\.app/Contents/MacOS/After Effects' | head -1 || true)"
if [ -n "$AE_BIN" ]; then
  AE_APP="${AE_BIN%/Contents/MacOS/After Effects}"
else
  AE_DIR="$(ls -d /Applications/Adobe\ After\ Effects\ * 2>/dev/null | sort -V | tail -1 || true)"
  [ -n "$AE_DIR" ] && AE_APP="$AE_DIR/$(basename "$AE_DIR").app" || AE_APP=""
fi
AE_NAME=""
[ -n "${AE_APP:-}" ] && [ -d "$AE_APP" ] && AE_NAME="$(basename "$AE_APP" .app)"

for v in 9 10 11 12 13 14; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1 2>/dev/null || true
done

# ── 1) FAYLNI AVVAL KO'CHIRISH (har doim yetib boradi) ──────────────────────
# MUHIM: copy AE yopilishidan OLDIN bajariladi. Aks holda AE "Save?" dialogi
# quit'ni bloklasa (yoki foydalanuvchi 25s kutishni Ctrl+C qilsa), copy umuman
# ishlamay qolardi va DEST eski qolardi (kuzatilgan bug). Open faylga yozish
# macOS'da xavfsiz (eski inode AE xotirasida qoladi, disk yangilanadi) —
# ko'rinishi uchun keyin AE qayta ochiladi.
# User ma'lumotini (token/favorites/downloads — assetflow-data) saqlab qolamiz:
# rm -rf "$DEST" uni ham o'chirardi → restart'dan keyin "Mehmon" (login chiqib ketardi).
AF_DATA_BAK=""
if [ -d "$DEST/assetflow-data" ]; then
  AF_DATA_BAK="$(mktemp -d)/afdata"
  cp -R "$DEST/assetflow-data" "$AF_DATA_BAK" 2>/dev/null || AF_DATA_BAK=""
fi
rm -rf "$DEST"
mkdir -p "$DEST/CSXS" "$DEST/js" "$DEST/jsx" "$DEST/css"

# Saqlangan user ma'lumotini tiklaymiz (token → login restart'dan keyin qoladi)
if [ -n "$AF_DATA_BAK" ] && [ -d "$AF_DATA_BAK" ]; then
  cp -R "$AF_DATA_BAK" "$DEST/assetflow-data" && echo "  ✓ assetflow-data saqlandi (token/favorites)"
  rm -rf "$(dirname "$AF_DATA_BAK")" 2>/dev/null || true
fi

cp "$SRC/CSXS/manifest.xml" "$DEST/CSXS/"
cp "$SRC/.debug" "$DEST/" 2>/dev/null || true
cp "$SRC/AssetFlow_Plugin.html" "$DEST/"
cp "$SRC/AssetFlow_Admin.html" "$DEST/"
cp "$SRC/assetflow-"*.js "$DEST/" 2>/dev/null || true
cp "$SRC/js/CSInterface.js" "$DEST/js/"
cp "$SRC/jsx/host.jsx" "$DEST/jsx/"
cp "$SRC/css/"*.css "$DEST/css/" 2>/dev/null || true
# Shriftlar (o'zini-host woff2) — CEP'da tarmoq yo'q, shuning uchun DOIM ko'chirilishi shart
mkdir -p "$DEST/css/fonts"
cp "$SRC/css/fonts/"*.woff2 "$DEST/css/fonts/" 2>/dev/null || true

# ── 2) VERIFY: o'rnatilgan HTML manbaga BAYT-BA-BAYT mosmi? ─────────────────
# Build stamp HALI urilmadi (placeholder __AF_BUILD__ saqlanib turibdi), shuning
# uchun DEST aynan SRC bilan bir xil bo'lishi shart. Farq bo'lsa — copy ishlamadi.
verify_file() {
  local name="$1"
  if [ ! -f "$DEST/$name" ]; then
    echo "  ✗ VERIFY: $name DEST'da YO'Q — copy muvaffaqiyatsiz!"; return 1
  fi
  if diff -q "$SRC/$name" "$DEST/$name" >/dev/null 2>&1; then
    echo "  ✓ VERIFY: $name manbaga mos ($(wc -c <"$DEST/$name" | tr -d ' ') bayt)"
  else
    echo "  ✗ VERIFY: $name manbadan FARQ qiladi — copy muvaffaqiyatsiz!"; return 1
  fi
}
echo "→ O'rnatish tekshirilmoqda..."
verify_file "AssetFlow_Plugin.html"
verify_file "AssetFlow_Admin.html"

# ── 3) Build yorlig'i — VERIFY'dan KEYIN stamplaymiz ───────────────────────
BUILD_STAMP="$(date '+%Y-%m-%d %H:%M') · $(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo nogit)"
for f in "$DEST/AssetFlow_Plugin.html" "$DEST/AssetFlow_Admin.html"; do
  [ -f "$f" ] && sed -i '' "s|__AF_BUILD__|${BUILD_STAMP}|g" "$f" 2>/dev/null || true
done
echo "  Build: $BUILD_STAMP"
echo "✓ Fayl o'rnatildi: $DEST"
echo "  Manba: $SRC"

# ── 4) AE'ni yopish (CEP xotiradagi ESKI panelni bo'shatish uchun) ─────────
# Fayl allaqachon diskda yangi; AE faqat CEP keshi/xotirasini yangilash uchun
# qayta ishga tushishi kerak. Quit muvaffaqiyatsiz bo'lsa ham fayl to'g'ri qoladi.
AE_OPEN=0
if [ "$SKIP_AE" != "1" ] && [ -n "$AE_NAME" ]; then
  echo "→ $AE_NAME yopilmoqda (CEP keshini yangilash uchun)..."
  osascript -e "tell application \"$AE_NAME\" to quit" 2>/dev/null || true
  for _ in {1..25}; do
    pgrep -f "$AE_APP/Contents/MacOS/After Effects" >/dev/null 2>&1 || break
    sleep 1
  done
  if pgrep -f "$AE_APP/Contents/MacOS/After Effects" >/dev/null 2>&1; then
    AE_OPEN=1
    echo "  ⚠ AE yopilmadi (saqlash dialogi ochiq bo'lishi mumkin)."
  else
    echo "  ✓ AE yopildi"
  fi
fi

# ── 5) CEP render/HTML keshini tozalash (AE yopiq holatda eng samarali) ────
echo "→ CEP keshi tozalanmoqda..."
rm -rf "$HOME/Library/Caches/CSXS/cep_cache" 2>/dev/null || true
rm -rf "$DEST/cef_cache" "$DEST/Cache" "$DEST/GPUCache" 2>/dev/null || true
echo "  ✓ kesh tozalandi"

# ── 6) AE'ni qayta ochish ──────────────────────────────────────────────────
if [ "$SKIP_AE" = "1" ]; then
  echo "ℹ AF_SKIP_AE=1 — AE qayta ochilmadi. Qo'lda: AE'ni TO'LIQ yoping (Cmd+Q) va qayta oching."
  exit 0
fi
if [ -z "$AE_NAME" ]; then
  echo "⚠ After Effects topilmadi — qo'lda: Window → Extensions → AssetFlow"
  exit 0
fi
if [ "$AE_OPEN" = "1" ]; then
  echo "⚠ AE yopilmadi — fayl to'g'ri o'rnatildi, LEKIN ko'rinishi uchun AE'ni"
  echo "  TO'LIQ yoping (Cmd+Q, kerak bo'lsa saqlang) va qayta oching."
  exit 0
fi

echo "→ $AE_NAME ishga tushirilmoqda..."
open -a "$AE_APP"
sleep 10

echo "→ AssetFlow panel ochilmoqda..."
osascript <<APPLESCRIPT 2>/dev/null || true
tell application "$AE_NAME" to activate
delay 1.5
tell application "System Events"
  tell process "After Effects"
    click menu item "AssetFlow" of menu "Extensions" of menu item "Extensions" of menu "Window" of menu bar 1
  end tell
end tell
APPLESCRIPT

echo "✓ Tayyor ($AE_NAME)"
