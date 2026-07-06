# Sessiya hisoboti — 2026-07-06 (Google sign-in bug fix — device-code brauzer ochilmasligi)

**Bug:** AE plaginda "Sign in with Google" / "Continue with Google" tugmasi bosilganda hech narsa
bo'lmasdi — brauzer ochilmasdi, xato ham chiqmasdi.

**Root cause:** `plugins/after-effects-cep/js/CSInterface.js` (minimal shim) — `openURLInDefaultBrowser`
faqat `window.__adobe_cep__.openURLInDefaultBrowser` to'g'ridan-to'g'ri metodini tekshirardi, lekin
Adobe'ning haqiqiy CSInterface.js buni ko'pincha `invokeSync('openURLInDefaultBrowser', url)` orqali
taqdim etadi. To'g'ridan-to'g'ri metod bo'lmaganda shim `require("uxp")` (Photoshop/XD API, CEP'da
mavjud emas — doim throw) ga, so'ng `window.open()`ga tushardi — bu esa `await` fetch'dan KEYIN
(click gesture'dan tashqarida) chaqirilgani uchun CEF panelida sukut bilan popup-block bo'ladi.
Natija: brauzer ochilmaydi, xato chiqmaydi — aynan tasvirlangan simptom. Ikkala tugma
(`homeGuestGoogle` va `accountLoginWithGoogle`) bir xil `AssetFlowAccount.openExternal` orqali
shu buzuq shim'ga tayanadi edi.

**Tuzatish (`js/CSInterface.js`):** ikkinchi native yo'l — `invokeSync('openURLInDefaultBrowser', url)`
qo'shildi; manifestda `--enable-nodejs` yoqilgani uchun haqiqiy `child_process` OS-shell fallback
(`open`/`start`/`xdg-open`) qo'shildi; `window.open()` faqat oxirgi chora sifatida qoldi.

**Tekshirildi:** brauzer preview (cep-plugin-preview, 1400px) — ikkala tugma ham to'liq zanjirni
bosib o'tadi (device/start POST → openExternal chaqiriladi → xato bo'lsa toast/hint to'g'ri
ishlaydi), 0 konsol xato, syntax OK (`node -c`). Email/parol login o'zgarmadi.

**Bajarildi:** `install-cep.sh` bilan qayta o'rnatildi, AE qayta ishga tushirildi (build ebe1e1e,
16:35). Real AE'da Google tugmasini bosib yakuniy tasdiq — foydalanuvchi tomonidan kutilmoqda.
Push YO'Q (user o'zi).
