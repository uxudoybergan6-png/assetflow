# SESSION REPORT — 2026-06-15 — AI Ovoz: audio ham comp'ga qo'shiladi ✅

Muammo: AI audio Project'ga tushardi, lekin aktiv comp'ga qo'shilmasdi (rasm qo'shilardi).

## Sabab
`importMediaFromPath` comp-add guard'i `item.hasAudio === true` edi. mp3/wav AE'da
import'dan keyin DARROV "conform" bo'lmaydi → `hasAudio` sinxron tarzda `false` qaytishi
mumkin → `addable=false` → audio comp'ga qo'shilmasdi. Rasm `hasVideo` darrov `true` —
shu sabab rasm ishlardi.

## Tuzatish — host.jsx importMediaFromPath
- Comp-add guard endi **TIP bo'yicha**: `item instanceof FootageItem || item instanceof CompItem`
  (= `comp.layers.add()` qabul qiladigan AVItem). Conform holatiga bog'liq emas → mp3/wav
  ham aktiv comp'ga **playhead'da LAYER** sifatida qo'shiladi (rasm kabi).
- Aktiv comp yo'q → faqat Project (XATO emas); bor → comp + layer. `layers.add` try/catch
  bilan o'ralgan (chinakam qo'shib bo'lmaydigan tur bo'lsa import baribir ok:true).
- Structured `{ok, addedToComp, compName, item}` — audio uchun ham to'g'ri toast (frontend
  `addedToComp`ga qarab "kompozitsiyaga qo'shildi" deydi).

## Tekshirildi
- host.jsx `node --check` TOZA ✅ (manba va o'rnatilgan nusxa)
- `install-cep.sh` qayta o'rnatdi; o'rnatilgan host.jsx'da yangi tip-guard tasdiqlandi ✅
- (Frontend o'zgarmadi — audio pleyer + import oqimi avvaldan tayyor.)

## Holat / kutilmoqda
Commit foydalanuvchi so'raganda. AE'da: aktiv comp ochiq → AI Ovoz generatsiya → import →
audio layer comp'ga (playhead) qo'shiladi + to'g'ri toast. CF_* env Render'da kerak (real audio).
