# SESSION REPORT — 2026-06-27 — Video model almashmaydi (BUG) tuzatildi

## Root cause
Asosiy sabab: o'rnatilgan CEP STALE edi (eski kodда model option click faqat `closeVgSheets()` qilardi — `switchVgModel` yo'q). Qo'shimcha CEF88 xavf: option ichidagi SVG `<text>`/`<b>` ga bosilganda per-option listener'ga bubble bo'lmasligi mumkin.

## Tuzatish (robust — barcha 5 ishorani qoplaydi)
1. **Delegatsiya:** per-option `addEventListener` o'rniga `#vgMList`'ga BIR marta delegated listener. Bosilgan element bola (SVG/`<text>`/`<b>`) bo'lsa ham `.opt`'gача ko'tariladi → ishlaydi (CEF88-safe).
2. **`data-mid`:** har option `data-mid=id`; listener `vm.models`'дан `String(id)` bo'yicha topadi.
3. **String id taqqoslash:** `switchVgModel` va `cur` (✓) endi `String(m.id)===String(vm.model.id)` (number/string mosligi).
4. **Backdrop:** `.axvg .sheet` `e.target===s` tekshiruvi option bosishini ushlamaydi (delegatsiya alohida `#vgMList`'да) — to'qnashuv yo'q.
5. **Log:** `ensureVgMeta` `[vg] video modellar: 3101:...(frames), 3102:...(media-refs)` — ikkala model distinct id bilan kelishini tasdiqlaydi.

## Tekshiruv (headless harness, REAL funksiyalar)
Bosish: SVG `<text>` (eng chuqur bola) → Fast; `<b>` label → R2V; `.opt` div → R2V — HAMMA holatда almashadi. ✓ checkmark + `cur` + `vgMName` ("Seedance 2.0 R2V") + referens hudud (frames↔media-refs) almashadi, sheet yopiladi. data-mid=[3101,3102]. 7 inline script 0 xato, console 0 xato.

## O'rnatish
`install-cep.sh` qayta o'rnatildi (exit 0) → o'rnatilgan HTML'да `data-mid`×3 + log bor. AE'ni QAYTA OCHIB R2V tanlanishini tasdiqlang (R2V tagida "ByteDance · R2V (ko'p-modal)").
