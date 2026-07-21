#!/bin/bash
# FrameFlow macOS INSTALLER (.pkg) — MIJOZ paneli uchun, FAIL-CLOSED.
#
# Nima quriladi: `productbuild` distribution paketi. U mijoz flavor fayllarini FAQAT
# foydalanuvchi domeniga yozadi:
#   ~/Library/Application Support/Adobe/CEP/extensions/com.frameflow
# root/`sudo` TALAB QILINMAYDI, `/Library` ga tegilmaydi, boshqa Adobe holati o'zgarmaydi.
# Payload ro'yxati — scripts/package-flavors.mjs (yagona manba). Ichki Admin paneli
# installerga HECH QACHON kirmaydi (installer-payload.mjs buni majburlaydi).
#
# Foydalanish:
#   ./build-installer-mac.sh --unsigned                 # QA .pkg (imzosiz, "-unsigned" nomi)
#   FF_MAC_INSTALLER_IDENTITY=… FF_SIGNED_ZXP=… \
#   FF_NOTARY_KEY_ID=… FF_NOTARY_ISSUER_ID=… FF_NOTARY_KEY_PATH=… \
#     ./build-installer-mac.sh                          # reliz: imzo + notarizatsiya + staple
#
# Kredensiallar FAQAT env'dan (repo'da/artefaktda/logda hech qachon saqlanmaydi):
#   FF_MAC_INSTALLER_IDENTITY  "Developer ID Installer: … (TEAMID)"
#   FF_SIGNED_ZXP              ZXPSignCmd bilan imzolangan mijoz .zxp yo'li (CEP imzo konverti)
#   Notarizatsiya — App Store Connect API kaliti (TAVSIYA):
#   FF_NOTARY_KEY_ID / FF_NOTARY_ISSUER_ID / FF_NOTARY_KEY_PATH (.p8)
#   yoki Apple ID + app-specific parol:
#   FF_NOTARY_APPLE_ID / FF_NOTARY_TEAM_ID / FF_NOTARY_PASSWORD
#
# FAIL-CLOSED: kredensial to'liq bo'lmasa yakuniy artefakt YARATILMAYDI va vaqtinchalik
# fayl QOLMAYDI. O'z-o'zidan imzolangan sertifikat YARATILMAYDI, standart parol YO'Q.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$SRC/../.." && pwd)"
HELPER="$SRC/scripts/installer-payload.mjs"

PKG_IDENTIFIER="com.frameflow.plugin"
DO_UNSIGNED=0
for arg in "$@"; do
  case "$arg" in
    --unsigned) DO_UNSIGNED=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "✗ Noma'lum argument: $arg (--unsigned)"; exit 2 ;;
  esac
done

if [ "$(uname -s)" != "Darwin" ]; then
  echo "✗ macOS .pkg faqat macOS'da quriladi (pkgbuild/productbuild kerak)."
  exit 1
fi

VERSION="$(node "$HELPER" version)"
INSTALL_LOCATION="Library/Application Support/Adobe/CEP/extensions/com.frameflow"

if [ "$DO_UNSIGNED" = "1" ]; then
  OUT="$(node "$HELPER" artifact mac pkg unsigned)"
else
  OUT="$(node "$HELPER" artifact mac pkg signed)"
fi
# Chiqish papkasi HAR DOIM helper bergan yo'ldan olinadi (yagona manba; FF_INSTALLERS_DIR
# test/CI izolyatsiyasi uchun faqat joyni ko'chiradi, siyosatga ta'sir qilmaydi).
OUTDIR="$(dirname "$OUT")"

mkdir -p "$OUTDIR"

# ── Eski/qisman chiqishni DARHOL bekor qilish (tekshiruvlardan OLDIN) ────────
# Build to'xtasa, eski artefakt "yangi reliz" deb chalg'itmasin. Boshqa platforma va
# boshqa flavor artefaktlari TEGILMAYDI.
if [ -e "$OUT" ]; then
  rm -f "$OUT" "$OUT.sha256"
  echo "  ⓘ Eski chiqish bekor qilindi: $(basename "$OUT")"
fi

# ── Chegaralangan ish papkasi + trap ────────────────────────────────────────
WORK="$(mktemp -d "$OUTDIR/_build.mac.XXXXXX")"
case "$WORK" in
  "$OUTDIR"/_build.mac.*) : ;;
  *) echo "✗ Ish papkasi yo'li kutilmagan: $WORK"; exit 1 ;;
esac
cleanup() {
  [ -n "${WORK:-}" ] && [ -d "$WORK" ] && rm -rf "$WORK"
  return 0
}
trap cleanup EXIT INT TERM

echo "→ FrameFlow macOS installer · versiya $VERSION"
echo "  Nishon (per-user): ~/$INSTALL_LOCATION"

# ── FAIL-CLOSED siyosat tekshiruvi — asboblardan OLDIN ──────────────────────
if [ "$DO_UNSIGNED" != "1" ]; then
  if [ -z "${FF_MAC_INSTALLER_IDENTITY:-}" ]; then
    echo "✗ FF_MAC_INSTALLER_IDENTITY berilmagan — imzolangan build BEKOR QILINDI."
    echo "  Developer ID Installer identikasi shart (o'z-o'zidan imzolangan zaxira YO'Q):"
    echo "    FF_MAC_INSTALLER_IDENTITY='Developer ID Installer: … (TEAMID)' $0"
    exit 1
  fi
  if [ -z "${FF_SIGNED_ZXP:-}" ]; then
    echo "✗ FF_SIGNED_ZXP berilmagan — imzolangan build BEKOR QILINDI."
    echo "  Reliz payload'i Adobe imzo konverti (META-INF) bilan kelishi SHART — aks holda CEP"
    echo "  o'rnatilgan papkani imzosiz deb hisoblaydi va AE panelni yuklamaydi."
    echo "  Avval: bash $SRC/scripts/build-zxp.sh   (ZXP_CERT/ZXP_CERT_PASS bilan)"
    exit 1
  fi
  if [ ! -f "${FF_SIGNED_ZXP:-}" ]; then
    echo "✗ FF_SIGNED_ZXP fayli topilmadi: ${FF_SIGNED_ZXP:-}"
    exit 1
  fi
  NOTARY_MODE=""
  if [ -n "${FF_NOTARY_KEY_ID:-}" ] || [ -n "${FF_NOTARY_ISSUER_ID:-}" ] || [ -n "${FF_NOTARY_KEY_PATH:-}" ]; then
    if [ -z "${FF_NOTARY_KEY_ID:-}" ] || [ -z "${FF_NOTARY_ISSUER_ID:-}" ] || [ -z "${FF_NOTARY_KEY_PATH:-}" ]; then
      echo "✗ Notarizatsiya API kaliti to'liq emas — FF_NOTARY_KEY_ID + FF_NOTARY_ISSUER_ID + FF_NOTARY_KEY_PATH shart."
      exit 1
    fi
    if [ ! -f "$FF_NOTARY_KEY_PATH" ]; then
      echo "✗ FF_NOTARY_KEY_PATH fayli topilmadi (.p8)."
      exit 1
    fi
    NOTARY_MODE="api-key"
  elif [ -n "${FF_NOTARY_APPLE_ID:-}" ] || [ -n "${FF_NOTARY_TEAM_ID:-}" ] || [ -n "${FF_NOTARY_PASSWORD:-}" ]; then
    if [ -z "${FF_NOTARY_APPLE_ID:-}" ] || [ -z "${FF_NOTARY_TEAM_ID:-}" ] || [ -z "${FF_NOTARY_PASSWORD:-}" ]; then
      echo "✗ Notarizatsiya Apple ID kredensiali to'liq emas — FF_NOTARY_APPLE_ID + FF_NOTARY_TEAM_ID + FF_NOTARY_PASSWORD shart."
      exit 1
    fi
    NOTARY_MODE="apple-id"
  else
    echo "✗ Notarizatsiya kredensiali berilmagan — imzolangan build BEKOR QILINDI."
    echo "  API kaliti (tavsiya): FF_NOTARY_KEY_ID + FF_NOTARY_ISSUER_ID + FF_NOTARY_KEY_PATH"
    echo "  yoki: FF_NOTARY_APPLE_ID + FF_NOTARY_TEAM_ID + FF_NOTARY_PASSWORD"
    echo "  (notarizatsiyasiz .pkg mijoz mashinasida Gatekeeper tomonidan bloklanadi)"
    exit 1
  fi
fi

# ── Asboblar ────────────────────────────────────────────────────────────────
need_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "✗ $1 topilmadi — Xcode Command Line Tools o'rnating: xcode-select --install"
    exit 1
  fi
}
need_tool pkgbuild
need_tool productbuild

# ── Payload (mijoz flavor ro'yxati + ixtiyoriy CEP imzo konverti) ───────────
PAYLOAD="$WORK/payload"
STAGE_ARGS=()
if [ -n "${FF_SIGNED_ZXP:-}" ]; then STAGE_ARGS+=("--signed-zxp=$FF_SIGNED_ZXP"); fi
STAGED="$(node "$HELPER" stage "$PAYLOAD" ${STAGE_ARGS[@]+"${STAGE_ARGS[@]}"})"
# Kengaytirilgan atributlarni (masalan com.apple.provenance) tozalaymiz — aks holda pkgbuild
# har fayl yoniga AppleDouble `._` nusxasini qo'shadi va payload flavor ro'yxatidan chetlashadi.
xattr -cr "$PAYLOAD" 2>/dev/null || true
PAYLOAD_KIND="$(node "$HELPER" verify "$PAYLOAD")"
echo "  Payload: $STAGED fayl ($PAYLOAD_KIND)"

# ── Skriptlar: per-user, chegaralangan, boshqa Adobe holatiga tegmaydi ──────
# `preinstall` YO'Q — ATAYLAB. Ishlayotgan panel yangi payload muvaffaqiyatli joylashishidan
# OLDIN hech qachon o'chirilmaydi (o'rnatma yarim yo'lda to'xtasa, eskisi joyida qoladi).
# `postinstall` — GENERATSIYA (installer-payload.mjs): o'rnatma MUVAFFAQIYATLI tugagach
# FAQAT aniq nomli eski fayllarni olib tashlaydi. Adobe sozlamalari (CSXS debug bayroqlari)
# HECH QACHON o'zgartirilmaydi — na imzolangan, na imzosiz yo'lda.
SCRIPTS="$WORK/scripts"
mkdir -p "$SCRIPTS"

node "$HELPER" postinstall-script > "$SCRIPTS/postinstall"
if [ ! -s "$SCRIPTS/postinstall" ] || ! head -1 "$SCRIPTS/postinstall" | grep -q '^#!/bin/bash'; then
  echo "✗ postinstall skripti generatsiya qilinmadi — build to'xtadi."
  exit 1
fi
bash -n "$SCRIPTS/postinstall"

chmod 755 "$SCRIPTS/postinstall"

# ── Komponent paketi ────────────────────────────────────────────────────────
pkgbuild \
  --root "$PAYLOAD" \
  --scripts "$SCRIPTS" \
  --identifier "$PKG_IDENTIFIER" \
  --version "$VERSION" \
  --install-location "$INSTALL_LOCATION" \
  "$WORK/frameflow-component.pkg.raw" >/dev/null

# ── Komponent paketini tuzatish: auth="none" + AppleDouble'siz payload ──────
# (a) pkgbuild komponentga DOIM `auth="root"` yozadi. Bu paket faqat foydalanuvchi
#     papkasiga yozadi → administrator paroli SO'RALMASLIGI kerak. pkgbuild'da bayroq yo'q.
# (b) macOS har faylga o'chirib bo'lmaydigan `com.apple.provenance` xatributini qo'yadi va
#     pkgbuild uni har fayl yoniga AppleDouble `._…` yozuvi qilib qo'shadi. Ular o'rnatma
#     papkasiga tushib, CEP imzo tekshiruvini buzishi mumkin — shuning uchun Payload va Bom
#     STAGE papkasidan qaytadan quriladi (`cpio --format odc` AppleDouble qo'shmaydi).
pkgutil --expand "$WORK/frameflow-component.pkg.raw" "$WORK/component-expanded" >/dev/null
if ! grep -q 'auth="root"' "$WORK/component-expanded/PackageInfo"; then
  echo "✗ PackageInfo kutilgan auth=\"root\" atributisiz — paket shakli o'zgargan, build to'xtadi."
  exit 1
fi
( cd "$PAYLOAD" && find . -print | cpio -o --format odc --quiet ) | gzip -c \
  > "$WORK/component-expanded/Payload"
# Bom egaligi ahamiyatsiz: home-domain o'rnatma root'siz bajariladi, ya'ni fayllar baribir
# O'RNATAYOTGAN foydalanuvchi nomiga tushadi (chown imkonsiz) — pkgbuild'ning root/wheel
# yozuvi ham xuddi shunday qo'llanmasdi.
mkbom "$PAYLOAD" "$WORK/component-expanded/Bom"
PAYLOAD_ENTRIES="$(lsbom -s "$WORK/component-expanded/Bom" | wc -l | tr -d ' ')"
PAYLOAD_KB="$(du -sk "$PAYLOAD" | awk '{print $1}')"
sed -i '' \
  -e 's/auth="root"/auth="none"/' \
  -e "s/numberOfFiles=\"[0-9]*\"/numberOfFiles=\"$PAYLOAD_ENTRIES\"/" \
  -e "s/installKBytes=\"[0-9]*\"/installKBytes=\"$PAYLOAD_KB\"/" \
  "$WORK/component-expanded/PackageInfo"
pkgutil --flatten "$WORK/component-expanded" "$WORK/frameflow-component.pkg" >/dev/null
rm -rf "$WORK/component-expanded" "$WORK/frameflow-component.pkg.raw"

# ── Distribution: FAQAT foydalanuvchi domeni (root/`/Library` YO'Q) ────────
cat > "$WORK/distribution.xml" <<DISTRIBUTION
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
    <title>FrameFlow for After Effects</title>
    <options customize="never" require-scripts="false" hostArchitectures="x86_64,arm64"/>
    <domains enable_anywhere="false" enable_currentUserHome="true" enable_localSystem="false"/>
    <choices-outline>
        <line choice="default">
            <line choice="$PKG_IDENTIFIER"/>
        </line>
    </choices-outline>
    <choice id="default"/>
    <choice id="$PKG_IDENTIFIER" visible="false">
        <pkg-ref id="$PKG_IDENTIFIER"/>
    </choice>
    <pkg-ref id="$PKG_IDENTIFIER" version="$VERSION" onConclusion="none">frameflow-component.pkg</pkg-ref>
</installer-gui-script>
DISTRIBUTION

productbuild \
  --distribution "$WORK/distribution.xml" \
  --package-path "$WORK" \
  "$WORK/frameflow-product.pkg" >/dev/null

if [ ! -s "$WORK/frameflow-product.pkg" ]; then
  echo "✗ productbuild chiqish fayli yo'q yoki bo'sh — artefakt YARATILMADI."
  exit 1
fi

# ── Imzolanmagan QA yo'li ───────────────────────────────────────────────────
if [ "$DO_UNSIGNED" = "1" ]; then
  mv -f "$WORK/frameflow-product.pkg" "$OUT"
  SHA="$(node "$HELPER" checksum "$OUT")"
  node "$HELPER" record mac pkg "$OUT" unsigned >/dev/null
  echo "✓ Imzolanmagan QA installer: $OUT"
  echo "  SHA-256: $SHA"
  echo "  ⚠ FAQAT lokal QA uchun — imzo/notarizatsiya yo'q, mijozga tarqatilmaydi."
  echo "  ⚠ Payload'da Adobe imzo konverti YO'Q: AE bu panelni FAQAT operator o'sha mashinada"
  echo "    CEP dasturchi rejimini (PlayerDebugMode) O'ZI QO'LDA yoqgan bo'lsa yuklaydi."
  echo "    Installer bu sozlamani hech qachon o'zgartirmaydi."
  exit 0
fi

# ── Imzolash → notarizatsiya → staple (hammasi WORK ichida) ────────────────
need_tool productsign
need_tool xcrun

echo "→ productsign (identika env'dan — chop etilmaydi)"
if ! productsign --sign "$FF_MAC_INSTALLER_IDENTITY" \
     "$WORK/frameflow-product.pkg" "$WORK/frameflow-signed.pkg" >/dev/null 2>"$WORK/sign.err"; then
  echo "✗ productsign muvaffaqiyatsiz — yakuniy artefakt YARATILMADI."
  sed -n '1,20p' "$WORK/sign.err" 2>/dev/null || true
  exit 1
fi
if [ ! -s "$WORK/frameflow-signed.pkg" ]; then
  echo "✗ Imzolangan fayl yo'q yoki bo'sh — yakuniy artefakt YARATILMADI."
  exit 1
fi

echo "→ notarytool submit --wait ($NOTARY_MODE)"
if [ "$NOTARY_MODE" = "api-key" ]; then
  xcrun notarytool submit "$WORK/frameflow-signed.pkg" \
    --key "$FF_NOTARY_KEY_PATH" --key-id "$FF_NOTARY_KEY_ID" --issuer "$FF_NOTARY_ISSUER_ID" \
    --wait
else
  xcrun notarytool submit "$WORK/frameflow-signed.pkg" \
    --apple-id "$FF_NOTARY_APPLE_ID" --team-id "$FF_NOTARY_TEAM_ID" --password "$FF_NOTARY_PASSWORD" \
    --wait
fi

echo "→ stapler staple"
xcrun stapler staple "$WORK/frameflow-signed.pkg"
xcrun stapler validate "$WORK/frameflow-signed.pkg"
pkgutil --check-signature "$WORK/frameflow-signed.pkg" >/dev/null

# ── Faqat HAMMASI muvaffaqiyatli tugagach — atomik mv ──────────────────────
mv -f "$WORK/frameflow-signed.pkg" "$OUT"
SHA="$(node "$HELPER" checksum "$OUT")"
node "$HELPER" record mac pkg "$OUT" signed >/dev/null

echo "✓ Imzolangan + notarizatsiya qilingan installer: $OUT"
echo "  SHA-256: $SHA"
echo "  Admin → Releases → Upload macOS installer (.pkg) — server SHA-256'ni qayta hisoblaydi."
