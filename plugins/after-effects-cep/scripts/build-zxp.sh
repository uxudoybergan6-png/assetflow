#!/bin/bash
# FrameFlow CEP paketlash — FLAVOR'GA BOG'LANGAN va FAIL-CLOSED.
#
#   customer (DEFAULT) → ommaviy paket. FAQAT com.frameflow.panel.
#   admin  (--admin)   → ICHKI paket. FAQAT com.frameflow.admin. Mijozga BERILMAYDI.
#
# Bitta artefaktda ikkala extension ID hech qachon bo'lmaydi. Fayl ro'yxati/manifest/nom —
# yagona manbadan: scripts/package-flavors.mjs.
#
# Foydalanish:
#   ./build-zxp.sh --unsigned                 # mijoz QA arxivi (AE'ga o'rnatilmaydi)
#   ./build-zxp.sh --admin --unsigned         # ichki Admin QA arxivi
#   ZXP_CERT=/secure/path/ff.p12 ZXP_CERT_PASS='…' ./build-zxp.sh            # imzolangan mijoz
#   ZXP_CERT=… ZXP_CERT_PASS='…' ./build-zxp.sh --admin                      # imzolangan ichki
#
# IMZOLASH FAIL-CLOSED: ZXP_CERT + ZXP_CERT_PASS ANIQ berilishi SHART. O'z-o'zidan imzolangan
# sertifikat YARATILMAYDI, standart parol YO'Q. Sirlar hech qachon ekranga chiqarilmaydi.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$SRC/../.." && pwd)"
DIST="$ROOT/dist/zxp"
FLAVORS="$SRC/scripts/package-flavors.mjs"

FLAVOR="customer"
DO_UNSIGNED=0
for arg in "$@"; do
  case "$arg" in
    --unsigned)  DO_UNSIGNED=1 ;;
    --admin|--flavor=admin)     FLAVOR="admin" ;;
    --customer|--flavor=customer) FLAVOR="customer" ;;
    -h|--help)
      sed -n '2,20p' "$0"; exit 0 ;;
    *)
      echo "✗ Noma'lum argument: $arg (--unsigned | --admin | --customer)"; exit 2 ;;
  esac
done
if [ "${UNSIGNED_ZXP:-0}" = "1" ]; then DO_UNSIGNED=1; fi

VERSION="$(node "$FLAVORS" version "$FLAVOR")"
LABEL="$(node "$FLAVORS" field "$FLAVOR" label)"
EXT_ID="$(node "$FLAVORS" field "$FLAVOR" extensionId)"

# ── Chegaralangan staging + cleanup trap ─────────────────────────────────────
# STAGE DOIM $DIST ichida va noyob; rm -rf faqat SHU papkaga tegadi (keng nishon YO'Q).
mkdir -p "$DIST"
STAGE="$(mktemp -d "$DIST/_stage.$FLAVOR.XXXXXX")"
case "$STAGE" in
  "$DIST"/_stage.*) : ;;
  *) echo "✗ Staging yo'li kutilmagan: $STAGE"; exit 1 ;;
esac
SIGNDIR=""
cleanup() {
  [ -n "${STAGE:-}" ] && [ -d "$STAGE" ] && rm -rf "$STAGE"
  # Imzolash vaqtinchalik fayli (qisman yozilgan .zxp) HECH QACHON qolmaydi.
  [ -n "${SIGNDIR:-}" ] && [ -d "$SIGNDIR" ] && rm -rf "$SIGNDIR"
  return 0
}
trap cleanup EXIT INT TERM

echo "→ Flavor: $FLAVOR — $LABEL"
echo "  Extension ID: $EXT_ID · versiya: $VERSION"

# ── Stage: FAQAT shu flavor'ning runtime fayllari (glob emas, aniq ro'yxat) ──
while IFS=$'\t' read -r from to; do
  [ -z "$from" ] && continue
  if [ ! -f "$SRC/$from" ]; then
    echo "✗ Manba fayl yo'q: $from"; exit 1
  fi
  mkdir -p "$STAGE/$(dirname "$to")"
  cp "$SRC/$from" "$STAGE/$to"
done < <(node "$FLAVORS" files "$FLAVOR")

STAGED="$(find "$STAGE" -type f | wc -l | tr -d ' ')"
echo "  Stage: $STAGED fayl"

if [ "$DO_UNSIGNED" = "1" ]; then
  # Sertifikatsiz STRUKTURA QA paketi — AE'ga o'rnatib BO'LMAYDI, nomi "unsigned".
  OUT="$(node "$FLAVORS" artifact "$FLAVOR" unsigned)"
  rm -f "$OUT"
  (cd "$STAGE" && zip -qr "$OUT" .)
  echo "✓ Imzolanmagan QA arxivi: $OUT"
  echo "  (faqat lokal struktura tekshiruvi uchun — AE'ga o'rnatilmaydi)"
  exit 0
fi

OUT="$(node "$FLAVORS" artifact "$FLAVOR" signed)"

# ── Eski/qisman chiqishni DARHOL bekor qilish ────────────────────────────────
# Har qanday tekshiruvdan OLDIN: shu flavor+versiya uchun kutilayotgan yakuniy .zxp
# o'chiriladi. Aks holda kredensial yo'q bo'lib build to'xtaganda ESKI artefakt joyida
# qolib, "yangi reliz" deb chalg'itishi mumkin edi. Boshqa flavor va imzolanmagan
# arxivlar TEGILMAYDI.
if [ -e "$OUT" ]; then
  rm -f "$OUT"
  echo "  ⓘ Eski imzolangan chiqish bekor qilindi: $(basename "$OUT")"
fi

# ── FAIL-CLOSED sertifikat tekshiruvi (ZXPSignCmd izlashdan OLDIN — siyosat birinchi).
#    Sertifikat YARATILMAYDI, standart/zaxira parol YO'Q. ───────────────────────
CERT="${ZXP_CERT:-}"
if [ -z "$CERT" ]; then
  echo "✗ ZXP_CERT berilmagan — imzolangan build BEKOR QILINDI."
  echo "  Haqiqiy .p12 sertifikat yo'lini bering:"
  echo "    ZXP_CERT=/secure/path/frameflow.p12 ZXP_CERT_PASS='…' $0 --$FLAVOR"
  echo "  (bu skript o'z-o'zidan imzolangan sertifikat YARATMAYDI — reliz autentikligi shart)"
  exit 1
fi
if [ ! -f "$CERT" ]; then
  echo "✗ ZXP_CERT fayli topilmadi: $CERT"
  exit 1
fi
if [ -z "${ZXP_CERT_PASS:-}" ]; then
  echo "✗ ZXP_CERT_PASS berilmagan — imzolangan build BEKOR QILINDI."
  echo "  Parolni env orqali bering (standart/zaxira parol YO'Q, qiymat log qilinmaydi)."
  exit 1
fi

# ── ZXPSignCmd yo'li ─────────────────────────────────────────────────────────
ZXPCMD="$(command -v ZXPSignCmd 2>/dev/null || echo "")"
if [ -z "$ZXPCMD" ]; then
  for candidate in \
    "/Applications/Adobe Extension Manager CC/ZXPSignCmd" \
    "$HOME/bin/ZXPSignCmd" \
    "$ROOT/tools/ZXPSignCmd"; do
    if [ -x "$candidate" ]; then ZXPCMD="$candidate"; break; fi
  done
fi
if [ -z "$ZXPCMD" ]; then
  echo "✗ ZXPSignCmd topilmadi."
  echo "  O'rnatish: https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD"
  echo "  Sertifikatsiz struktura tekshiruvi uchun: $0 --$FLAVOR --unsigned"
  exit 1
fi

# ── Imzolash: HECH QACHON to'g'ridan yakuniy artefaktga yozilmaydi ───────────
# Chegaralangan noyob vaqtinchalik papkaga imzolanadi; faqat ZXPSignCmd MUVAFFAQIYATLI
# tugab, fayl mavjud va BO'SH EMAS bo'lsagina atomik `mv` bilan yakuniy nomga o'tadi
# (bir xil fayl tizimi → rename atomik). Har qanday nosozlikda trap temp'ni o'chiradi
# va yakuniy .zxp umuman paydo bo'lmaydi.
SIGNDIR="$(mktemp -d "$DIST/_signing.$FLAVOR.XXXXXX")"
case "$SIGNDIR" in
  "$DIST"/_signing.*) : ;;
  *) echo "✗ Imzolash temp yo'li kutilmagan: $SIGNDIR"; exit 1 ;;
esac
SIGN_TMP="$SIGNDIR/$(basename "$OUT")"

echo "→ ZXP imzolanmoqda: $OUT"
echo "  Sertifikat: $(basename "$CERT") (parol env'dan — chop etilmaydi)"
if ! "$ZXPCMD" -sign "$STAGE" "$SIGN_TMP" "$CERT" "$ZXP_CERT_PASS"; then
  echo "✗ ZXPSignCmd imzolashda muvaffaqiyatsiz tugadi — yakuniy artefakt YARATILMADI."
  echo "  (qisman yozilgan fayl o'chiriladi; sertifikat/parol qiymatlari chop etilmaydi)"
  exit 1
fi
if [ ! -s "$SIGN_TMP" ]; then
  echo "✗ Imzolangan fayl yo'q yoki bo'sh — yakuniy artefakt YARATILMADI."
  exit 1
fi

mv -f "$SIGN_TMP" "$OUT"

echo "✓ Tayyor: $OUT"
if [ "$FLAVOR" = "admin" ]; then
  echo "  ⚠ ICHKI artefakt — mijozga tarqatilmaydi, reliz kanaliga yuklanmaydi."
fi
