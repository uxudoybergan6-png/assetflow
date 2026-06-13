# 1-bosqich — Birlashtirilgan dizayn tizimi (implementatsiya rejasi)

*Manba: Dizayn hisoboti §5. Kod tahlilida tasdiqlangan (haqiqiy fayl + qator manzillari bilan).*
*Holat: REJA — kod yozilmaydi, faqat rejalashtirilmoqda.*

Hisobot §5.3 migratsiya strategiyasi: "hammasini bir vaqtda qayta yozma — 4 kichik qadam, har biri alohida deploy". Quyida har qadam aniq fayl/qatorlarga bog'langan.

---

## Kod tahlilidan tasdiqlangan holat

| Da'vo (hisobot) | Kodda haqiqat |
|---|---|
| Browse va Admin umumiy token tizimiga ega emas | `AssetFlow_Plugin.html:9` → `:root{--bg:#0d0d0d; --accent:#82c341; --surface-2…}` **vs** `AssetFlow_Admin.html:8` → `:root{--bg:#0f0f0f; --green:#82c341; --surface2; --blue:#6366f1}` — turli nom + turli qiymat |
| Qoldiq indigo aralashgan | 11 ta joy. Aniq: Plugin `496,510` (featured banner gradient), `760` (anim-bar), `1208` (`var(--accent,#6366f1)` fallback); Admin `14` (`--blue` token), `171,174,180,536` |
| Shriftlar 5–9px | Plugin.html'da `7px` (1087,1094), `8px` (1049,1141,1149), ko'p `9px` |
| Yig'ilgan sidebar tooltipsiz | `.env-sidebar` CEP'da `52px`, `.env-side-link{font-size:0}` (410-qator), tooltip yo'q |
| Inter shrifti | Yuklanmagan — `-apple-system, system-ui` ishlatiladi |

---

## Qadam 1 — Yagona token to'plami (eng past risk, eng katta ta'sir)

### Maqsad
Ikkala panel bitta `:root` token to'plamidan foydalansin; indigo butunlay yo'qolsin; shriftlar o'qiladigan bo'lsin.

### Yondashuv
1. **Yangi fayl: `plugins/after-effects-cep/css/tokens.css`** — hisobot §5.1 token to'plami (bitta manba haqiqat):
   - Ranglar: `--bg`, `--surface`, `--surface-2`, `--accent #82c341`, `--accent-hi #9fd356`, `--accent-cta #a3e635`, `--select #327BFA`, `--text`, `--muted` (≥ WCAG AA).
   - **Indigo yo'q.**
   - Shrift o'lchamlari: `--fs-xs:11px … --fs-title:22px` (minimum 11px).
   - Radius, masofa, harakat tokenlari.
2. **`AssetFlow_Plugin.html:9-21`** — mavjud `:root` blokini `tokens.css`ga link bilan almashtirish; faqat panelga xos override qoldirish.
3. **`AssetFlow_Admin.html:8-15`** — xuddi shunday; `--green`→`--accent`, `--surface2`→`--surface-2` nomlarini moslashtirish (yoki tokens.css'da ikkala aliasni berib, asta-sekin ko'chirish — kamroq diff).
4. **Indigo'ni o'chirish** (aniq qatorlar):
   - Plugin `496,510` — featured banner gradientini lime oilasiga (`--accent → --accent-hi`).
   - Plugin `760` — `.anim-bar` `#a855f7` → `--accent-hi`.
   - Plugin `1208` — `var(--accent,#6366f1)` → fallback'ni `var(--accent,#82c341)`.
   - Admin `14` — `--blue` tokenini `--select #327BFA`ga (MF ko'k = tanlash, indigo emas) yoki olib tashlash.
   - Admin `171,174,180,536` — `#6366f1` → `--select` yoki `--accent`.
5. **Mayda shriftlarni ko'tarish** — `7px→11px (chip)`, `8px→10px (meta)`, `9px→11px`. Aniq qatorlar yuqorida.

### Tekshirish
- `grep -rn "#6366f1\|#a855f7" *.html css/` → **0 natija** (indigo to'liq ketgani).
- `grep -noE "font-size:[5-9]px"` → 0 (o'qib bo'lmaydigan shrift yo'q).
- Ikkala panel skrinshoti (AE ochib, qo'lda) — bir xil ranglar.

### Risk
Past. Bitta CSS qatlam; mantiq tegmaydi. Eng yomon holat — ba'zi joyda override kerak.

---

## Qadam 2 — Sidebar + tooltip (MF naqshi)

### Maqsad
`.env-sidebar` yig'ilgan holatda (52→64px) ikonalarga tooltip; hover'da yoyilish (132→220px), label ko'rinadigan.

### O'zgartirishlar
- **`AssetFlow_Plugin.html` ~408-415** — CEP-mode sidebar kengligi (52→64), `font-size:0` o'rniga `title=` atributi yoki `:hover` da yoyilish.
- **1342-1350 navigatsiya markup** — har `env-side-link`ka `title` (yoki CSS tooltip) qo'shish: "Video Templates", "Motion Videos", "Graphics", "LUTs".
- (Ixtiyoriy) hisobotdagi yangi tartib: 🍃 Brend · ▦ Shablonlar · ✨ AI Tools · ★ Sevimli · ⬇ Yuklangan · 👤 Profil — AI tab keyin (3-bosqich) qo'shiladi.

### Risk
O'rta — navigatsiya holati (`switchNavFromSidebar`) tegmasligi kerak, faqat ko'rinish.

---

## Qadam 3 — Karta tugmalari doimo ko'rinadigan

### Muammo
★ (sevimli), 🗑/⬇ tugmalar `opacity:0`, faqat hover'da. Sichqonchasiz/birinchi qarashda topilmaydi.

### O'zgartirishlar
- Karta overlay tugmalarining `opacity:0`→doimiy ko'rinadigan, kontrastli (yarim-shaffof fon + lime ikona).
- Aniq selektorlar 1-bosqich kod fazasida grep bilan topiladi (`opacity:0` + `.card`/`.fav`/`.dl`).

### Risk
Past.

---

## Qadam 4 — AI Tools tab joyini tayyorlash (faqat skelet)
Navigatsiyaga `✨ AI Tools` bo'sh tab qo'shish (kontent 3-bosqichda). Bu 1 va 3-bosqichni bog'laydi, lekin majburiy emas.

---

## Bu bosqichda QILMAYDIGAN narsalar (keyinga)
- Bolt CEP migratsiyasi (katta ish, alohida qaror).
- i18n qatlami, light theme, a11y to'liq (past ustuvorlik — 3+ bosqich).
- Pagination/lazy-scroll (funksional, dizayn emas).

---

## Taklif qilinadigan ketma-ketlik
Qadam 1 (tokens) → alohida deploy → Qadam 3 (tugmalar) → Qadam 2 (sidebar) → Qadam 4 (AI skelet).
Sabab: Qadam 1 eng katta vizual yutuq + eng past risk; sidebar eng ko'p ehtiyot talab qiladi, oxirroqda.
