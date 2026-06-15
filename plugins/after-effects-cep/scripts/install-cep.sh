#!/bin/bash
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.assetflow.demo"
AE_APP="/Applications/Adobe After Effects 2025/Adobe After Effects 2025.app"

for v in 9 10 11 12; do
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

if [ ! -d "$AE_APP" ]; then
  echo "⚠ After Effects 2025 topilmadi — qo'lda: Window → Extensions → AssetFlow"
  exit 0
fi

echo "→ After Effects qayta ishga tushirilmoqda..."
osascript -e "tell application \"Adobe After Effects 2025\" to quit" 2>/dev/null || true
for _ in {1..25}; do
  pgrep -f "Adobe After Effects 2025.app/Contents/MacOS/After Effects" >/dev/null || break
  sleep 1
done

open -a "$AE_APP"
sleep 10

echo "→ AssetFlow panel ochilmoqda..."
osascript <<'APPLESCRIPT'
tell application "Adobe After Effects 2025" to activate
delay 1.5
tell application "System Events"
  tell process "After Effects"
    click menu item "AssetFlow" of menu "Extensions" of menu item "Extensions" of menu "Window" of menu bar 1
  end tell
end tell
APPLESCRIPT

echo "✓ Tayyor"
