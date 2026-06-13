#!/bin/bash
# AssetFlow CEP extensionni .zxp formatiga paketlash.
# Talab: ZXPSignCmd (Adobe Extension Manager yoki cc-extension-sign dan).
# Ko'chirish: https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$SRC/../.." && pwd)"
DIST="$ROOT/dist/zxp"
VERSION="$(grep -m1 'ExtensionBundleVersion' "$SRC/CSXS/manifest.xml" | sed 's/.*Version="\([^"]*\)".*/\1/')"
ZXP_OUT="$DIST/assetflow-v${VERSION}.zxp"
STAGE="$DIST/_stage"

# ZXPSignCmd yo'lini topish
ZXPCMD="$(which ZXPSignCmd 2>/dev/null || echo "")"
if [ -z "$ZXPCMD" ]; then
  for candidate in \
    "/Applications/Adobe Extension Manager CC/ZXPSignCmd" \
    "$HOME/bin/ZXPSignCmd" \
    "$ROOT/tools/ZXPSignCmd"; do
    if [ -x "$candidate" ]; then ZXPCMD="$candidate"; break; fi
  done
fi
if [ -z "$ZXPCMD" ]; then
  echo "✗ ZXPSignCmd topilmadi. https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD"
  exit 1
fi

# Imzolash sertifikati
CERT="${ZXP_CERT:-$DIST/assetflow-cert.p12}"
CERT_PASS="${ZXP_CERT_PASS:-assetflow}"

# Yangi sertifikat yaratish (agar mavjud bo'lmasa)
if [ ! -f "$CERT" ]; then
  echo "→ Sertifikat yaratilmoqda: $CERT"
  mkdir -p "$(dirname "$CERT")"
  "$ZXPCMD" -selfSignedCert US CA AssetFlow AssetFlow "$CERT_PASS" "$CERT"
fi

# Stage papka tayyorlash
rm -rf "$STAGE"
mkdir -p "$STAGE/CSXS" "$STAGE/js" "$STAGE/jsx"

cp "$SRC/CSXS/manifest.xml"   "$STAGE/CSXS/"
cp "$SRC/AssetFlow_Plugin.html" "$STAGE/"
cp "$SRC/AssetFlow_Admin.html"  "$STAGE/"
cp "$SRC/assetflow-"*.js       "$STAGE/" 2>/dev/null || true
cp "$SRC/js/CSInterface.js"    "$STAGE/js/"
cp "$SRC/jsx/host.jsx"         "$STAGE/jsx/"

mkdir -p "$DIST"

# Paketlash va imzolash
echo "→ ZXP paketlanmoqda: $ZXP_OUT"
"$ZXPCMD" -sign "$STAGE" "$ZXP_OUT" "$CERT" "$CERT_PASS"

rm -rf "$STAGE"

echo "✓ Tayyor: $ZXP_OUT"
echo "  O'rnatish: Adobe Extension Manager yoki aep:// havolasi orqali."
