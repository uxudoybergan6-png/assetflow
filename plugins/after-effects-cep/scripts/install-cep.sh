#!/bin/bash
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.assetflow.demo"

# AE versiyasini AVTO-aniqlash: avval ISHLAYOTGAN jarayon (foydalanuvchi aynan shuni ishlatadi),
# bo'lmasa eng yangi o'rnatilgan. (Hardcode 2025 edi — foydalanuvchi 2026 ishlatsa noto'g'ri AE
# restart bo'lardi, panel eski qolardi.)
AE_BIN="$(ps -axo args= 2>/dev/null | grep -oE '/Applications/Adobe After Effects [0-9]+/Adobe After Effects [0-9]+\.app/Contents/MacOS/After Effects' | head -1 || true)"
if [ -n "$AE_BIN" ]; then
  AE_APP="${AE_BIN%/Contents/MacOS/After Effects}"
else
  AE_DIR="$(ls -d /Applications/Adobe\ After\ Effects\ * 2>/dev/null | sort -V | tail -1 || true)"
  [ -n "$AE_DIR" ] && AE_APP="$AE_DIR/$(basename "$AE_DIR").app" || AE_APP=""
fi

for v in 9 10 11 12 13 14; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1 2>/dev/null || true
done

mkdir -p "$DEST/CSXS" "$DEST/js" "$DEST/jsx" "$DEST/css"

cp "$SRC/CSXS/manifest.xml" "$DEST/CSXS/"
cp "$SRC/.debug" "$DEST/" 2>/dev/null || true
cp "$SRC/AssetFlow_Plugin.html" "$DEST/"
cp "$SRC/AssetFlow_Admin.html" "$DEST/"
cp "$SRC/assetflow-"*.js "$DEST/" 2>/dev/null || true
cp "$SRC/js/CSInterface.js" "$DEST/js/"
cp "$SRC/jsx/host.jsx" "$DEST/jsx/"
cp "$SRC/css/"*.css "$DEST/css/" 2>/dev/null || true

# Build yorlig'i — o'rnatilgan HTML'ga sana + git-hash shtamplanadi (manba placeholder qoladi).
# Panelda ko'rinadi → install + AE qayta ochishdan keyin yangi build yuklanganini bilish.
BUILD_STAMP="$(date '+%Y-%m-%d %H:%M') · $(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo nogit)"
for f in "$DEST/AssetFlow_Plugin.html" "$DEST/AssetFlow_Admin.html"; do
  [ -f "$f" ] && sed -i '' "s|__AF_BUILD__|${BUILD_STAMP}|g" "$f" 2>/dev/null || true
done
echo "  Build: $BUILD_STAMP"

echo "✓ AssetFlow o'rnatildi: $DEST"
echo "  Manba: $SRC"

if [ -z "${AE_APP:-}" ] || [ ! -d "$AE_APP" ]; then
  echo "⚠ After Effects topilmadi — qo'lda: Window → Extensions → AssetFlow"
  exit 0
fi
AE_NAME="$(basename "$AE_APP" .app)"   # masalan "Adobe After Effects 2026"

echo "→ $AE_NAME qayta ishga tushirilmoqda..."
osascript -e "tell application \"$AE_NAME\" to quit" 2>/dev/null || true
for _ in {1..25}; do
  pgrep -f "$AE_APP/Contents/MacOS/After Effects" >/dev/null || break
  sleep 1
done

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
