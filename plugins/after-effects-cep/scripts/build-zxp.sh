#!/bin/bash
# AssetFlow/FrameFlow CEP extensionni paketlash.
# Signed (.zxp): talab ZXPSignCmd (Adobe Extension Manager yoki cc-extension-sign dan).
#   Ko'chirish: https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD
# Unsigned (--unsigned yoki UNSIGNED_ZXP=1): sertifikat/ZXPSignCmd shart emas — faqat
#   stage papkasini oddiy .zip qiladi, tarkibni tekshirish uchun (AE'ga o'rnatilmaydi).
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$SRC/../.." && pwd)"
DIST="$ROOT/dist/zxp"
VERSION="$(grep -m1 'ExtensionBundleVersion' "$SRC/CSXS/manifest.xml" | sed 's/.*Version="\([^"]*\)".*/\1/')"
STAGE="$DIST/_stage"

DO_UNSIGNED=0
for arg in "$@"; do
  case "$arg" in
    --unsigned) DO_UNSIGNED=1 ;;
  esac
done
if [ "${UNSIGNED_ZXP:-0}" = "1" ]; then DO_UNSIGNED=1; fi

# ── Stage papka tayyorlash — CEP kengaytma RUNTIME'da o'qiydigan HAMMA fayl ──
# (manifest, ikkala panel HTML, panel JS'lari, host JSX, CEP bridge, CSS + o'z-hostli
# shriftlar). AE'da internet YO'Q — css/fonts/*.woff2 tushib qolsa panel shriftsiz/uslubsiz
# ochiladi (ilgari shu papka butunlay tushib qolgan edi).
rm -rf "$STAGE"
mkdir -p "$STAGE/CSXS" "$STAGE/js" "$STAGE/jsx" "$STAGE/css/fonts"

cp "$SRC/CSXS/manifest.xml"     "$STAGE/CSXS/"
cp "$SRC/AssetFlow_Plugin.html" "$STAGE/"
cp "$SRC/AssetFlow_Admin.html"  "$STAGE/"
cp "$SRC/assetflow-"*.js        "$STAGE/" 2>/dev/null || true
cp "$SRC/js/CSInterface.js"     "$STAGE/js/"
cp "$SRC/jsx/host.jsx"          "$STAGE/jsx/"
cp "$SRC/css/"*.css             "$STAGE/css/"
cp "$SRC/css/fonts/"*.woff2     "$STAGE/css/fonts/"

mkdir -p "$DIST"

if [ "$DO_UNSIGNED" = "1" ]; then
  # Sertifikatsiz tekshiruv paketi — AE'ga o'rnatib bo'lmaydi, faqat tarkib tasdig'i uchun.
  UNSIGNED_OUT="$DIST/assetflow-v${VERSION}-unsigned.zip"
  rm -f "$UNSIGNED_OUT"
  (cd "$STAGE" && zip -qr "$UNSIGNED_OUT" .)
  echo "✓ Imzolanmagan tekshiruv paketi tayyor: $UNSIGNED_OUT"
  echo "  (AE'ga o'rnatib bo'lmaydi — faqat fayl tarkibini tasdiqlash uchun.)"
  rm -rf "$STAGE"
  exit 0
fi

ZXP_OUT="$DIST/assetflow-v${VERSION}.zxp"

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
  echo "  Sertifikatsiz tarkibni tekshirish uchun: $0 --unsigned"
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

# Paketlash va imzolash
echo "→ ZXP paketlanmoqda: $ZXP_OUT"
"$ZXPCMD" -sign "$STAGE" "$ZXP_OUT" "$CERT" "$CERT_PASS"

rm -rf "$STAGE"

echo "✓ Tayyor: $ZXP_OUT"
echo "  O'rnatish: Adobe Extension Manager yoki aep:// havolasi orqali."
