# SESSION REPORT — 2026-06-19 — Dropdown overlap-fix (menyu TARIX kartalari bilan aralashmasin)

## Sabab (ikki omil)
1. **Stacking-context tuzog'i:** `.ai-composer` `backdrop-filter` (glass qoidasi, standartda blur:0) tufayli stacking-context yaratadi → menyu `z-index` SHU kontekst ICHIDA qamaladi. `.ai-history` (keyingi sibling, z:auto) butun composer kontekstini USTIDAN chizadi → kartalar menyu ustida ko'rinadi (skrinshotda dark temada ham, garchi menyu foni opaque bo'lsa-da).
2. **Glass temalar shaffof foni:** `--surface-2` liquid/light-glass'da rgba (yarim shaffof) → menyu foni glass temalarda tiniq emas.

## Yechim
1. **Stacking:** `.ai-composer{position:relative;z-index:60}` — composer kontekstini (va undagi menyuni) `.ai-history`/kartalar/result ustiga ko'taradi. `.ai-menu` z-index 40→**80** (composer ichida). Karta amallari (acts z:5, status z:2, .ai-h-menu z:30) endi ochiq menyu OSTIDA.
2. **Opaque fon (har tema):** yangi `--pop-bg` token — standart `#1c1f18`, liquid-glass `#161a13`, light-glass `#f6f8f2` (hammasi OPAQUE). `.ai-menu` + `.ai-h-menu` foni `var(--pop-bg)` + kuchli box-shadow → ostidagi kontent ko'rinmaydi.
3. **All-models modal** (`.ai-mm-overlay` z:200, position:fixed, `--bg` opaque) — allaqachon yuqori, tegmadi; izchillik tasdiqlandi (200 > 60).

## Tekshirildi
- Parse: 2 blok, 0 xato. `--pop-bg` 3 temada. `.ai-menu`/`.ai-h-menu` `var(--pop-bg)` ishlatadi. Composer z:60 > history/kartalar.
- Oqim BUZILMADI. 3 tema (fon har temada solid). aiPositionMenu (flip/clamp) saqlandi. CEP'ga HTML+CSS ko'chirildi (AE qo'zg'atilmadi).

## Holat
- Deploy talab qilmaydi (faqat plugin). AE'da reload — menyu ochib, ostidagi TARIX kartalari ko'rinmasligini va 3 temada solid fon ekanini tasdiqlash.
