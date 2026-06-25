# AI Tool UI — STANDART (majburiy, har tool uchun bir xil)

> Bu barcha AI Tools ekranlari (Rasm yaratish, Rasm tahrirlash, Video, Ovoz, 3D, ...) uchun
> **yagona standart**. Yangi tool yoki model qo'shilganда AYNAN shu tuzilma ishlatiladi.
> Kanonik namuna: `design-preview/tool-image-edit.html` (va `tool-image-gen.html`).

## Ekran tuzilishi (yuqoridan pastga)

1. **Header (pbar)**: `‹ AI Tools` (orqaga) · `✏️ Tool nomi` + ostida kichik **model selektori** (`Model nomi ▾`) · kredit chip (`✦ N`).
   - Model bitta bo'lsa ham shu yerда ko'rsatiladi (bar joyni egallamasin).
2. **Natija zonasi (scroll)**: bo'sh holat ko'rsatmasi → progress (bar + Bekor) → natija kartalari (Import / Saqlash / Yuklab olish).
3. **Composer (pastда, doimiy)** — yaxlit quti:
   - **Referens thumbnaillar** qatori (kerak bo'lsa; composer ichida, × bilan o'chirish).
   - **Prompt textarea** (auto-grow).
   - **✨ Yaxshilash** — prompt ostiда, o'ngда, ixcham havola (joy egallamasin).
   - **Boshqaruv qatori (ctrls)** — BITTA tekis qator, o'ralmaydi (`flex-wrap:nowrap`):
     - chap: ikona tugma (masalan `＋` referens) — kvadrat-yumaloq, `40×40`.
     - qolgan: **teng kenglikdagi chiplar** (`flex:1 1 0`) — har biri `Label Qiymat ▾` (masalan `O'lcham Auto ▾`, `Sifat High ▾`).
   - **Asosiy tugma** (Yaratish / Tahrirlash) — alohida, **to'liq enlik**, ctrls'dan keyin. Matnда narx: `Yaratish ✦N`.

## Oltin qoidalar

- **Yangi boshqaruv qo'shilsa → ctrls qatoriga YONIDAN qo'shiladi** (yangi chip), pastiga yoki tepasiga EMAS.
  Chiplar teng kenglikda qoladi va qatorга sig'adi.
- Asosiy tugma har doim pastда, to'liq enlik, alohida.
- ✨ Yaxshilash har doim prompt ostiда, o'ngда, kichik havola.
- Faqat **schemaда bor** parametr UI'ga chiqadi. Yo'q funksiya qo'shilmaydi.
- Ikonalar **SVG** (emoji emas — AE CEP'da chiqmaydi).
- Sheet (tanlov oynalari): pastdan chiqadi, backdrop bosish + Esc bilan yopiladi.
- Asosiy tugma majburiy maydonlar (masalan referens + prompt) to'lмaguncha **disabled**.
- Brand: dark + lime (`--acc:#c2f04a`), `.axroot` scope.

## Ranglar / o'lchamlar (kanonik mockupdan)

- Panel eni: `392px`. Composer radius: `18px`. Chip radius: `11px`. Asosiy tugma: balandlik `44px`, radius `12px`.
- ctrls: `gap:8px`, ikona tugma `40×40`, chiplar `flex:1 1 0; min-width:0`.

*Yangilangan: 2026-06-25*
