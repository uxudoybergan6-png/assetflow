# AssetFlow — UI/UX Review + Redesign yo'nalishi

> **Holat:** REVIEW + dizayn taklifi · kod/production **o'zgartirilmagan** · mockuplar `design-preview/` da · sana **2026-06-21**
>
> Bu hujjat read-only tahlil bosqichi natijasi. Hech qanday production fayl (`packages/assetflow-studio/{js,styles,*.html}`, `plugins/...`) tegilmadi. Quyidagi baholar markup + CSS + render funksiyalari statik tahlilidan olingan — jonli skrinshotlar yo'q, shu sababli pixel-darajadagi kontrast/kesilish topilmalari brauzerда tasdiqlanishi kerak.

---

## 0. Qisqacha xulosa

AssetFlow funksional jihatdan pishган mahsulot (holat boshqaruvi, cold-start retry, cost shaffofligi mukammal), lekin **vizual-strukturaviy darajada uchta jiddiy muammosi bor**:

1. **Uch brend bir vaqtda.** AE plagin lime (`#82c341`), Web Studio binafsha (`--violet #8b7cf6`), `reset-password.html` esa alohida lime-leaf — ikkala UI bitta `:root` token ham bo'lishmaydi. Foydalanuvchi "bir AssetFlow" emas, ikki-uch mahsulot ko'radi.
2. **WCAG AA kontrast buzilishi token darajasida.** `--muted-2` (.40, ≈2.6:1) va Studio `--tx-3` aniq o'tmaydi; `--muted` (.55, ≈3.5:1) va `--tx-2` normal body matn uchun o'tmaydi. AE'da tashqi yorug'lik muhitida bu matnlar deyarli o'qilmaydi.
3. **Mahsulot-kritik UX bo'shliqlari.** Katalog kartasida Pro/Free badge yo'q (import paytida kutilmagan paywall); AE Gen composer kontrol qatori tor panelда 4-5 qatorga o'raladi; Admin "obunachiga xabar" amali aslida faqat email nusxalaydi (yolg'on affordans); kredit berish UI umuman yo'q.

**Dizayn yondashuvi:** bitta brend (lime), bitta token nom-konvensiyasi, ikkala sirt aynan bir xil `:root` qiymatlarni bo'lishadi (faqat layout/zichlik farq qiladi), AA kontrast poydevori, inline SVG ikona (CDN/emoji yo'q). Qorong'i-birламchi vizual birlashtiruvchi element bo'lib qoladi.

---

## 1. AE plagin paneli (Browse + Gen Studio) — review

**Manba:** `plugins/after-effects-cep/AssetFlow_Plugin.html` (Browse + Gen, inline `<style>`), `AssetFlow_Admin.html`, `css/tokens.css`, `assetflow-catalog.js`. Cheklov: CEP/CEF kontekst (tor ~320-380px, qorong'i, eski Chromium), sichqoncha-only.

> Aniqlash: `css/styles.css` (indigo `#6366f1`, `adobe-clean`, `#1e1e1e`) bu fayllar tomonidan **ishlatilmaydi** — faqat `tokens.css` + inline style ulangan. O'lik/legacy artefakt, alohida tozalanishi kerak.

### 1.1 Browse katalog ekrani

**Kuchli:**
- Grid tor panelga to'g'ri: `repeat(auto-fill,minmax(148-150px,1fr))`, `aspect-ratio:16/9` thumbnail → layout sakramaydi.
- Karta ierarxiyasi toza: thumbnail → caps kategoriya → nom (14px/600) → meta qatori (sahna · sifat · format). Tanish marketplace patterni.
- Hover affordance to'g'ri: poster→video preview almashinuvi, `translateY(-3px)`, doimiy ★/⬇ tugmalari.
- Toolbar progressiv ochilish: qidiruv/filtr default yopiq, ikonka bosilganda ochiladi → tor panelда chrome minimal. **To'g'ri qaror.**
- **Holatlar to'liq va professional:** loading (shimmer skeleton ×4 + "server uyg'onmoqda ~60s" cold-start izohi — ajoyib), error (retry), filtr-bo'sh ("N ta filtr yashiryapti" + tozalash), haqiqiy-bo'sh.
- Badge'lar mazmunli: `nopack` (⏳, amber — import bloklanishini oldindan ogohlantiradi), `new`, `ai`, `dl` (✓ yuklandi).

**Zaif:**
- **[Yuqori] Pro/Free badge kartada YO'Q.** `renderCard` hech qayerda reja yorlig'ini chiqarmaydi — faqat sidebar plan chip'i bor. Natija: foydalanuvchi `openPack` qilmaguncha ruxsatni bilmaydi → import paytida kutilmagan paywall.
- **[O'rta] `thumb-badges` to'planib ketadi.** nopack + ai + new bir vaqtda 148px kartada thumbnail yarmidan ko'pini to'sadi. Maks cheklov yoki ustuvorlik kerak.
- **[Past] `card-get`/`card-fav` 30×30px** (44px touch minimaldan past — CEP sichqoncha-only да o'tadi); gradient ustида ★/⬇ kontrasti past.
- **[Past] Hero karusel tor panelга og'ir:** `flex:0 0 230px` → 320px panelда deyarli butun kenglik, faqat 1 ko'rinadi, vertikal joy isrof.
- **[Past] "Sevimli/Yuklab olingan" tab'lari ikki joyda** (sidebar + yashirin `.env-subnav`) — mantiq dublikati, drift xavfi.

### 1.2 Gen Studio (AI tools) ekrani

**Kuchli:**
- Yagona kompozer patterni (Artlist/Magnific uslubi): bitta karta ichida prompt textarea (auto-grow 44-172px) + pastki kontrollar qatori. Tor panel uchun eng zich, tanish AI-gen layout.
- Kontrollar `flex-wrap` → 320px да pastga o'raladi, gorizontal kesilish yo'q.
- **Narx shaffofligi mukammal:** Generate tugmasida imzolangan `cost-quote` narxi, debounce bilan qayta hisoblanadi, video uchun cost=soniya/kredit oralig'i. Kredit-asosli mahsulot uchun kritik to'g'ri.
- Generatsiya holati professional: ekvalayzer animatsiyasi + radial glow + 0-100% progress + audio uchun to'lqin. "Jonli" his.
- Reference oqimi izchil: Timeline / Project / Upload bir menyu patternida — AE-native (timeline'dan klip) integratsiyasi kuchli farqlovchi.
- Model tanlovi ikki bosqichli: tezkor menyu + "Barcha modellar" full-screen modal.
- Tarix (Creations) to'liq: filtr + grid/list toggle, hover amallar, running/failed status.

**Zaif:**
- **[Yuqori] Pastki kontrol qatori 320px да 4-5 qatorga o'raladi.** media + model + sozlama + reference + Generate — har biri katta padding. `flex-wrap` ishlaydi, lekin composer balandlashadi, Generate prompt'dan uzoqlashadi → "qanday generatsiya qilaman?" aniq emas. **Generate'ni alohida full-width primary qator** qilish kerak.
- **[Yuqori] Prompt yordamchi tugmalari ko'p va shovqinli:** "Yaxshilash" + "JSON" + "Tasvirdan" prompt ostida, har biri rangli. "JSON" oddiy obunachi (USER) uchun juda texnik → advanced ostiga yashirish kerak.
- **[O'rta] `ai-improve-json` indigo `#9aa6ff` — brend palitrasidan tashqari rang** (faqat select-ko'k `#327bfa` bor). Begona aksent.
- **[Past] `ai-charcount` "0 / 5000"** doimiy ko'rinishi shart emas — faqat limitга yaqinlashganda.
- **[Past] Sozlama yorlig'i zич:** `16:9 · 2K · 1 rasm` `white-space:nowrap` → tugma kengayadi → wrap. Ikona+qiymat qisqartmasi kerak.
- **[O'rta] Empty-prompt validatsiya yo'q:** prompt bo'sh Generate bosilsa disabled holat ko'rinmaydi (faqat toast). Generate `disabled` yaxshiroq affordans.

### 1.3 AE Admin paneli (`AssetFlow_Admin.html`)

> Eslatma: bu panelда **kredit/balans UI umuman yo'q** (`kredit|credit|grant|balance` topilmadi). "Obunachiга xabar" amali aslida `copyToClipboard(email)` — xabar yuborish emas.

**Kuchli:**
- Token Browse bilan bitta manba (`tokens.css`) → vizual izchillik.
- Tor panel uchun to'g'ri zichlik: qator-asosli ro'yxat (karta emas), `min-width:0` + ellipsis hamma joyda → uzun nom/email panelni yormaydi.
- Holatlar to'liq, kontekstga moslangan: moderatsiya bo'sh → ✅ "Hammasi ko'rib chiqilgan" + CTA; obunachi yo'q → 👤; yuklangan yo'q → 📂.
- **"Failed to fetch" eng yaxshi ishlangan joy:** `isNetworkErr` → tushunarli o'zbekcha sabab + "Brauzer Admin" muqobil; cold-start retry (`waitForApi`, "Server uyg'onmoqda… (i/n)"); login hint + `install-cep.sh` eslatma.
- Statuslar semantik rang bilan izchil (amber/green/red/neutral); tab-badge ish hajmini ko'rsatadi.
- Pack workflow 4-qadamli visual stepper (done/active/warn + progress + jonli log) — murakkab AE-ichi amalни tushunarli qiladi.
- Destruktiv amallar `confirm()` + busy-holat ("⏳ Tasdiqlanmoqda…").

**Zaif:**
- **[Yuqori] Kredit berish amali umuman yo'q.** Kredit-asosli Gen AI mahsulotда admin obunachiga kredit bera olmaydi. Obunachi qatori eng tabiiy joy (balans + "Kredit berish").
- **[Yuqori] "Xabar" yolg'on affordans.** `messageSubscriber`/`sub-msg-btn` xabarni anglatadi, amal — email clipboard. Real `/api/studio/messages/*` backend bor, lekin Admin CEP undan foydalanmaydi.
- **[O'rta] AE-native his yo'q:** radius juda yumshoq (login `14px`, modal `14px`, karta `10px` — AE panellar 2-4px); emoji ikonalar (📁 📢 🔕 🧹 💾 🌐 🎬 🗑) CEF da platformaga bog'liq render; toast pastда spring bilan sakraydi (moderatsiya asbobi uchun ortiqcha).
- **[O'rta] Detail panel tor panelда juda baland inline akkordion** — bitta shablon butun ekranni egallaydi, admin ro'yxat kontekstini yo'qotadi. Drawer/modal yaxshiroq.
- **[O'rta] Approve/Reject bir bosishда, tasdiqsiz.** Approve = `published:true` (jonli katalogga chiqaradi) — `confirm()` yo'q. Tor panelда noto'g'ri bosish oson; reject uchun izoh majburiy yoki oraliq tasdiq foydali.
- **[Past] Native `<select>` CEF da OS-native oq dropdown chiqaradi** (qorong'i tema bilan jiringlaydi); `select option{background:#222}` token emas, qattiq qiymat.

---

## 2. Web Studio (Contributor + Admin) — review

**Manba:** `packages/assetflow-studio/styles/app.css` (token+komponent), `js/ui.js`, `js/theme.js`, `js/contributor-views.js`, `js/admin-views.js`/`admin-views2.js`/`admin-subscribers.js`, `reset-password.html`.

### 2.1 Login / Admin-login

**Kuchli:** Ikki ustunli `auth-shell` (chap brend hikoya / o'ng forma) — Linear/Vercel uslubi. Login va Admin-login vizual ajratilgan (Admin sub-label, qalqon ikoni). Rol tekshiruvi yetuk (USER login'да rad etiladi aniq xabar bilan). Holatlar boy (API sog'liq banner, sessiya tugashi banner, `role="alert"`). Segmented "Kirish/Ro'yxat" toza.

**Zaif:**
- **[O'rta] Dev-tafsilotlar oxirgi foydalanuvchiga oqib chiqqan:** login footer `UPDATE "User" SET role='ADMIN'` SQL; admin-login `npm run dev:api`, "PostgreSQL да ADMIN qiling". Production contributor uchun noprofessional + xavfsizlik hidi.
- **[Past] Brend rang nomuvofiq:** "Parolni unutdingizmi?" `#9ecbff` (qattiq ko'k), "Contributor Studio" `var(--violet-bright)` — bir sahifada ikki havola rangi.
- **[Past] Chap panel mobil'да butunlay yashiriladi** (`.auth-side{display:none}`) — brend hikoya yo'qoladi, faqat yalang'och forma.
- **[Past] "Meni eslab qol" `<div role="checkbox">`** — haqiqiy `<input>` emas, Space/Enter qo'lda ulanmagan. A11y bo'shliq.

### 2.2 Hub

**Kuchli:** Sodda ikki-kartali tanlash (Contributor/Admin), jonli API/Studio/Admin status pill'lari, "Xatcho'p qiling" ko'rsatmasi.
**Zaif:** Hub inline `<style>` da yashaydi (`.hub-card` `.card` mavjud bo'la turib qayta yaratilgan — drift); ikon sifatida matn belgilar (↑ ✓ ▶ — shrift-bog'liq); `theme.js` yuklanmagan (light-tema holati qo'llanilmasligi mumkin, FOUC).

### 2.3 Contributor Dashboard

**Kuchli:** Overview ierarxiyasi a'lo (info-banner → plan-mini-row → 4-li KPI → "Keyingi qadam" CTA + "E'tibor talab" + timeline + "Admin xabarlari"). "Keyingi qadam" gradient bilan ajratilgan bitta primary CTA. Templates: chip-filtr (son bilan) + Jadval/Grid toggle, `table-wrap min-width:820px`. Status badge tizimi izchil (rang + nuqta + matn — faqat rangga tayanmaydi). Empty holatlar har joyда CTA bilan. Xato chegarasi (`route()` try/catch).

**Zaif:**
- **[Yuqori] Skeleton deyarli ishlatilmagan.** `app.css` да to'liq skeleton tizimi bor, lekin `afterRender` API'ni `await` qilganда KPI/jadval bo'sh turadi yoki demo→real almashadi (layout siljishi).
- **[O'rta] `var(--text-dim)` mavjud emas** (`contributor-views.js:71`) — `app.css` да aniqlanmagan token (faqat `--tx-2/3`). Matn ranglanmaydi.
- **[O'rta] Inline `style=` 93 ta** (contributor-views.js) — takroriy `padding:13px 18px...` patternlari, komponent klasslari yo'q. Texnik qarz + nomuvofiqlik.
- **[Past] Topbar messages ikonда doim ko'rinadigan qizil `.dot`** (statik HTML) — o'qilmagan xabar yo'q bo'lsa ham. Yolg'on bildirishnoma.

### 2.4 Admin Console

**Kuchli:**
- **Moderatsiya navbati — eng kuchli ekran.** Master-detail split (`380px 1fr`): chapда scrollable navbat (thumb + contributor + kategoriya + badge), o'ngда qaror paneli, bulk-amal banneri. Envato/Shutterstock darajasi.
- Navigatsiya guruhlangan (Workspace / Boshqaruv / Tizim), nav-badge jonli (moderatsiya/obunachi/xabar/log soni).
- Obunachilar jadvali 10 ustun (`min-width:1100px`), tabular-nums, usage cell, row-actions. "removed" qatorlar `opacity:.55`. B2B-mos yuqori zichlik.
- Audit log, tizim loglari, tariflar editori, analitika (CSS bars/donut/leaderboard) — keng qamrov. Empty holatlar jadval ichида ham (`colspan`).

**Zaif:**
- **[Yuqori] A11y deyarli yo'q.** 4 view-renderer faylда `aria-*`/`role=`/`alt=` — **0 marta**. Jadvallarда `scope` yo'q, klikable `<tr onclick>` tugma/havola emas (klaviatura yo'q), thumb'lar `alt`siz, ikon-tugmalar `aria-label`siz. Screen-reader uchun deyarli yaroqsiz.
- **[O'rta] Ulanmagan moderatsiya `select` filtrlari** ("Barcha kategoriyalar", "Sana: Yangi→eski") — `onchange` ulanmagan, faqat vizual. Foydalanuvchini chalg'itadi.
- **[Past] Statik nav-badge `badge:'5'`** qattiq kodlangan (demo qoldig'i); klikable jadval qatorlari `stopPropagation` ga tayanadi (o'ng-klik-yangi-tab buzadi); inline `style=` admin-views2.js'да 83 ta, subscribers'да 42 ta.

### 2.5 Responsive / mobil

**Kuchli:** Uch breakpoint jiddiy qamrov (≤1100px ikon-sidebar, ≤768px off-canvas + scrim, ≤390px KPI 1 ustun). Jadvallar `table-wrap overflow-x:auto` (ma'lumot saqlanadi). Drawer/modal mobilда full-width.

**Zaif:**
- **[O'rta] Mobil moderatsiya mo'rt:** split-pane `[style*="grid-template-columns:380px"]` **inline-style-substring selektori** orqali stack qilinadi (`app.css:1196`). Inline grid o'zgarsa CSS jim buziladi. Xuddi shu xabarlar layoutida. Anti-pattern.
- **[O'rta] ≤1100px ikon-sidebar tooltip'siz** — label yashiriladi, hover'да matn yo'q, yangi admin yo'qoladi.
- **[Past] ≤390px да 10-ustunli jadval baribir 1100px scroll** — kichik telefonда amaliy emas (karta-rejim yo'q).

### 2.6 Brending (Studio ichи)

- **[KRITIK] `reset-password.html` to'liq off-system:** yagona lime/leaf brend (`#82c341` gradient leaf logo), `app.css`/`theme.js` YUKLAMAYDI, alohida inline CSS. Ironik: bu AE plagin lime'ига mos keladigan yagona Studio sahifasi, lekin qolgani binafsha. Foydalanuvchi `login → reset` yo'lида binafsha→lime o'zgarishini ko'radi — ishonchsizlik signali. Logo ham ikki xil (Studio kub vs reset leaf).

---

## 3. Tokenlar + brending izchilligi (AE ↔ Studio) — review

**Eng muhim xulosa:** AssetFlow'да **ikki alohida, bog'lanmagan dizayn tizimi** bor. `tokens.css` boshidagi "yagona dizayn tizim manbai" izohi **faqat AE plagin uchun** to'g'ri — Studio web undan bitta token ham olmaydi.

| | AE plugin (`tokens.css`) | Studio web (`app.css`) |
|---|---|---|
| Brend rangi | lime `--accent #82c341` | binafsha `--violet #8b7cf6` |
| Yuza tokenlari | `--surface`, `--surface-2/3`, `--bg`, `--sidebar` | `--bg-0..4`, `--bg-glass`, `--line*` |
| Matn | `--text`, `--muted`, `--muted-2` | `--tx-0..3` |
| Radius | bitta `--radius:8px` | shkala `--r-xs..xl` (5→18) |
| Shrift | faqat Inter | Inter + Inter Tight |
| Eng katta sarlavha | `--fs-title 22px` | H1 26px |
| Semantik | red/amber + select(blue) | green/yellow/orange/red/blue/gray |
| Ease | `cubic-bezier(.34,1.2,.64,1)` (spring) | `cubic-bezier(.4,.1,.2,1)` (ease-out) |

### WCAG AA kontrast topilmalari (tahminiy nisbatlar — brauzerда tasdiqlash kerak)

| Token | Fon ustida | Nisbat | Holat |
|---|---|---|---|
| `--muted-2` `rgba(255,255,255,.40)` | `#141612` | ≈**2.6:1** | **O'tmaydi** — faqat dekorativ bo'lishi kerak, lekin `card-cat`/`charcount`/`ai-sec-label`да matn sifatида ishlatilgan |
| `--muted` `rgba(255,255,255,.55)` | `#141612` | ≈**3.5:1** | Normal body matn uchun **o'tmaydi** (4.5 kerak); katta/bold da AA |
| Studio `--tx-3 #5d6675` | `#0d0f14` | ≈**2.0:1** | **O'tmaydi** — faqat placeholder |
| Studio `--tx-2 #828b9b` | `#171a21` | ≈**3.9:1** | Normal matn uchun o'tmaydi |
| `--select #327bfa` + oq matn | — | ≈**3.6:1** | To'liq ko'k fon + oq matn да chegara; dim fon bilan ishlatilsa muammo yo'q |
| `--accent-cta #a3e635` + `--on-accent #0a0b08` | CTA | ≈**13:1** | **AAA — mukammal** |

**Eng kuchli muammo:** ikkala UI ham muted matnni AA chegarасидан past ohangда ishlatadi. Token darajасида `--muted` `.55→.66` ga ko'tarish (≈4.6:1) va `--muted-2` ni faqat dekorativ deb cheklash kerak.

### Boshqa strukturaviy topilmalar

- **`design-system.html` haqiqatдан uzilgan:** binafsha + green/yellow/orange palitrasini "AssetFlow brend" deb hujjatlashtiradi — bu `tokens.css` lime brendiга butunlay zid. Rasmiy dizayn-tizim hujjati AE haqiqatини aks ettirmaydi.
- **Spacing:** AE'да `--sp-1..5` (4/8/12/16/24) bor, lekin yuqori poglar (32/48/64) yo'q; Studio'да spacing tokenlari **umuman yo'q** (hamma literal). Ikki UI masofa tili nomuvofiq.
- **Tipografiya:** line-height va font-weight tokenlari ikkala faylда ham yo'q (literal `600/700` takror); shrift oilasi farqи (Inter Tight vs Inter) → sarlavhalar ikki UI'да boshqa shriftда.
- **Logo:** kub/qatlam belgisi ikkala joyда bir xil shaklда — bu yagona ijobiy umumiy element.

---

## 4. Prioritetlangan tavsiyalar

| # | Tavsiya | UI | Ta'sir | Harakat hajmi |
|---|---------|-----|--------|---------------|
| 1 | **Brendni birlashtirish** — Studio binafshани lime'ga ko'chirish, bitta `:root` token manbai, `reset-password.html` ni `app.css`+`theme.js` ga ulash, logoni yagona qilish | Ikkala | Yuqori | Katta |
| 2 | **WCAG AA kontrast** — `--muted` .55→.66, `--muted-2` .40→.52 (faqat dekorativ), Studio `--tx-3` faqat placeholder, `card-cat` 10px→11px + `--muted` | Ikkala | Yuqori | Kichik |
| 3 | **Katalog kartасига Pro/Free badge** — import oldidан reja ruxsatini ko'rsatish, kutilmagan paywallни oldini olish | AE | Yuqori | O'rta |
| 4 | **AE Gen Generate'ni full-width primary qator** qilish; "JSON" advanced ostiga; indigo `ai-improve-json` → `--select`/`--muted` | AE | Yuqori | O'rta |
| 5 | **Admin obunachи tab'ini haqiqiy qilish** — kredit berish/balans UI yoki real `/api/studio/messages` ulash ("xabar" yolg'on affordans) | AE Admin | Yuqori | Katta |
| 6 | **A11y poydevori** — klikable `<tr>` → `<a>`/`tabindex`+klaviatura, ikon-tugmalarга `aria-label`, thumb'larга `alt`, toast `aria-live`, jadval `<th scope>` | Studio | Yuqori | O'rta |
| 7 | **Skeleton'ni real async yuklashlarга ulash** (KPI, jadval, moderatsiya navbати) — layout siljishi/miltillashни yo'qotish | Studio | Yuqori | O'rta |
| 8 | **`thumb-badges` ustuvorlik/cheklov** (maks 2, qolgани `+N`) — tor thumbnailни to'smasin | AE | O'rta | Kichik |
| 9 | **Radius skalасини normallashtirish** 6/10/14 + pill 999px (8/10/12/14/16/18 tarqoqligи); CEF uchun barcha chegара 1px (0.5px render muammosi) | Ikkala | O'rta | O'rta |
| 10 | **Emoji → inline SVG** (★⬇🗑⏳📁 va Admin ikonalari) — CEF render izchilligi | AE | O'rta | O'rta |
| 11 | **Dev-tafsilotlарни login/admin-login'дан olib tashlash** (SQL, npm buyruqlar) — production ko'rinishi | Studio | O'rta | Kichik |
| 12 | **AE Admin moderatsiya himoyasi** — reject'да izoh majburiy yoki approve'да oraliq tasdiq | AE Admin | O'rta | Kichik |
| 13 | **Inline-style → komponent klasslari** (`.list-row`, `.stat`, `.detail-grid`) — `[style*=...]` mobil selektor mo'rtligи | Studio | O'rta | Katta |
| 14 | **AE Admin detail panel** inline akkordion → drawer/modal — ro'yxat kontekstини saqlash | AE Admin | O'rta | O'rta |
| 15 | **Spacing/tipografiya tokenlари** — Studio'ga spacing shkalаси, ikkala UI'ga `--sp-6/7/8`, line-height + font-weight tokenlari, display 30px (bir xil) | Ikkala | O'rta | O'rta |
| 16 | **Statik artefaktlar** — topbar `.dot` (yolg'on bildirishnoma), NAV `badge:'5'`, `var(--text-dim)`, ulanmagan moderatsiya `select` filtrlari | Studio | Past | Kichik |
| 17 | **Native `<select>` → custom dropdown** (AE Admin + Studio) — CEF/qorong'i temада oq dropdown jiringlаши | Ikkala | Past | O'rta |
| 18 | **AE Gen empty-prompt** → Generate `disabled`; `ai-charcount` faqat limitга yaqin; sozlama yorlig'и ikona+qiymat qisqartma | AE | Past | Kichik |

---

## 5. Yangi dizayn yo'nalishi (dizayn tizimi)

### Tamoyil: bitta brend, ikki sirt

Hozir AssetFlow'да **uch brend** (AE lime, Studio binafsha, reset-password lime-leaf) va **ikki bog'lanmagan token oilаси** mavjud. Yangi yo'nalish buni bitta haqiqat manbаига keltiradi:

- **Lime brend** har ikkala sirtда (CLAUDE.md "lime aksent" qarорига muvofiq). Studio binafsha (`--violet`) butunlay olib tashlanadi.
- **Qorong'и birламчи** ikkаласида default — bu brendni vizual birlashtiradigan eng kuchli element. AE majburiy qorong'и; Studio ham qorong'и default, light ixtiyoriy override.
- `:root` token **qiymatlари AYNAN bir xil**; faqat layout/zichlik farq qiladi (AE = tor ~380px panel, Studio = responsive web).

### 5.1 Rang palitra (hex + WCAG-AA tuzatish)

| Token | Qiymat | Rol | Kontrast (qorong'и fon ustида) |
|---|---|---|---|
| `--bg` | `#0a0b08` | App fon | — |
| `--surface` | `#141612` | Karta/panel | — |
| `--surface-2` | `#1c1f18` | Ko'tarilgан/hover | — |
| `--surface-3` | `#23271e` | Input/active | — |
| `--text` | `#f5f7f0` | Asosiy matn | 17:1 (AAA) |
| `--text-2` | `#c2c8ba` | Ikkilamchi matn | 9.2:1 (AAA) |
| `--muted` | `rgba(255,255,255,.66)` | Muted matn (.55→**.66**) | ~4.6:1 (**AA tuzatildi**) |
| `--muted-2` | `rgba(255,255,255,.52)` | Faqat dekorativ/disabled (.40→**.52**) | ~3.3:1 (faint, matn emas) |
| `--accent` | `#82c341` | Brend baza/chegара | — |
| `--accent-hi` | `#9fd356` | Ikon/hover | — |
| `--accent-cta` | `#a3e635` | CTA fon / lime matn | matn sifatида 9:1 (AAA) |
| `--on-accent` | `#0a0b08` | Lime ustида matn | CTA ustида 13:1 (**AAA**) |
| `--select` | `#327bfa` | Tanlash (ko'k, brend EMAS) | dim fon bilan ishlatiladi |
| `--red` | `#ef4444` | Xato | — |
| `--amber` | `#f59e0b` | Ogohlantirish | — |
| `--green-ok` | `#4ade80` | Muvaffaqiyat (lime brenddан ajratilgан semantik) | — |

**Kritik tuzatishlar (review topgan AA buzilishlari):**
- `--muted` `.55→.66`: `card-meta-line`, `empty-txt`, `ai-card-sub` (AE) va body matn (Studio) endi AA o'tadi.
- `--muted-2` `.40→.52` va **qoida**: hech qachon o'qiladigan matnга qo'yilmaydi — faqat ikona-fon, disabled, dekorativ ajratuvchi.
- `card-cat` (AE 10px uppercase) → **11px** (`--fs-xs`) + `--muted` (`.66`), `--muted-2` emas.
- Studio `--tx-3 #5d6675` (~2:1) faqat `::placeholder` да qoladi.
- Lime gradient ustидаги `★/⬇` → qattiq qorong'и pill fon (`rgba(10,11,8,.78)`), gradient ustида emas.

### 5.2 Tipografiya shkаласи

**Shrift oilаси (yangi):** display uchun **Space Grotesk** (geometrik, "tech-creative"), UI matn uchun **Inter**. Ikkala sirt bir xil — Studio'ning Inter Tight'и olib tashlanadi.

| Token | Qiymat | Qo'llanish |
|---|---|---|
| `--font-display` | `'Space Grotesk', 'Inter', system-ui` | Sarlavha, KPI raqam, brend |
| `--font-sans` | `'Inter', system-ui` | Body, label, UI |
| `--fs-xs` | `11px` | Caps label, badge (minimal) |
| `--fs-sm` | `12px` | Meta, ikkilamchi |
| `--fs-md` | `13px` | Body |
| `--fs-base` | `14px` | Body large (yangi pog) |
| `--fs-lg` | `16px` | Sub-sarlavha |
| `--fs-xl` | `19px` | Bo'lim sarlavha |
| `--fs-title` | `23px` | Sahifa sarlavha |
| `--fs-display` | `30px` | Hero/display (yangi — AE va Studio bir xil) |
| `--lh-tight` | `1.15` | Sarlavha (yangi token) |
| `--lh-normal` | `1.45` | Body (yangi token) |
| `--lh-relaxed` | `1.6` | Uzun matn |
| `--fw-regular/medium/semibold/bold` | `400/500/600/700` | Vazn tokenlari |

Caps label uslubi standartlashadi: `--fs-xs` + `font-weight:600` + `letter-spacing:.06em` + `text-transform:uppercase` + `color:var(--muted)`.

### 5.3 Spacing tizimi

4px baza grid, yuqori poglar qo'shildi: `--sp-1:4` · `--sp-2:8` · `--sp-3:12` · `--sp-4:16` · `--sp-5:24` · **`--sp-6:32`** · **`--sp-7:48`** · **`--sp-8:64`**. Ikkala UI literal padding/gap o'rниga shu tokenlарни ishlatadi → masofa tili birlashadi.

### 5.4 Radius / elevation

**Yagona radius skаласи** (8/10/12/14/16/18 tarqoqligи tugatildi): `--r-sm:6px` (input, badge) · `--r-md:10px` (karta, menyu, tugma) · `--r-lg:14px` (modal, composer) · `--r-full:999px` (pill, avatar). AE va Studio bir xil. CEP/CEF uchun barcha chegара **1px**.

**Elevation:** `--sh-1:0 1px 2px rgba(0,0,0,.4)` · `--sh-2:0 8px 24px rgba(0,0,0,.4)` · `--sh-3:0 18px 48px rgba(0,0,0,.5)`. Glow: `--accent-glow:rgba(163,230,53,.25)`.

### 5.5 Komponent uslubi

- **Tugma:** `.btn` baza (radius `--r-md`, `--fs-md`, 600, 1px border). `.btn-primary` lime CTA + qora matn (AAA). `.btn-ghost` shaffof + `--border`. Generate **alohida full-width primary qator**; yordamchilar ghost, "JSON" advanced ostида; indigo → `--select`/`--muted`.
- **Input/Select:** `.input` surface-3 fon, fokusда `--accent` border + 2px glow. Native `<select>` → custom dropdown. `::placeholder` = `--muted-2`.
- **Karta:** `.card` surface, `--r-md`, hover `translateY(-2px)` + `--sh-1`. Katalog: thumbnail (16/9) + caps kategoriya + nom + meta. **Pro/Free badge kartада**. `thumb-badges` maks **2** (ustuvorlik nopack > ai > new), qolgани `+N`.
- **Badge/chip:** `.badge` (pending=amber, approved=lime, rejected=red, draft=muted) — rang + nuqta + matn. `.chip` `--r-full`.
- **Jadval (Studio):** zич B2B, `tabular-nums`, `<th scope>`, klikable qatorlar `<a>`/`tabindex+role`. Mobilда `overflow-x:auto`.
- **Menyu/Modal:** opaque `--pop-bg`, `--sh-2`/`--sh-3`. Modal mobilда full-width.

### 5.6 AE qorong'и-tor vs Studio web qo'llаниши

**Umumiy (bir xil tokenlar):** rang, tipografiya, spacing, radius, ease, komponent tili.

**AE plagin (~380px, majburiy qorong'и, CEP/CEF):** qator-asosли ro'yxat, grid `minmax(148px,1fr)`, sidebar default yig'iq (64px tooltip), toolbar progressiv ochilish (saqlanadi), composer + full-width Generate, emoji → inline SVG, uch tema token-darajада.

**Studio web (responsive, qorong'и default + light override):** topnav + sidebar + shell, KPI grid, master-detail moderatsiya, `reset-password.html` ulanadi (off-system tugatildi), inline-style → komponent klass, login dev-tafsilotlar olib tashlanadi.

### 5.7 Holatlar uslubi

- **Loading:** `.skeleton` shimmer (surface-2→surface-3, 1.2s). AE cold-start izoh saqlanadi. Studio: skeleton real async yuklashларга **ulanadi**.
- **Bo'sh holat:** inline SVG + sarlavha + tushuntirish + CTA, kontekstга moslangan (filtr-bo'sh ≠ haqiqиy-bo'sh).
- **Xato:** ikona + o'zbekcha xabar (`netErrMsg`) + Retry. Saqlanadi.
- **Muvaffaqiyat:** toast (4 tur, border-left + `aria-live`). AE spring → standart `--ease`; `white-space:normal`.
- AI composer: prompt bo'sh → Generate `disabled`.

### 5.8 Mikro-animatsiya

Yagona `--ease: cubic-bezier(.4,.14,.3,1)` (AE springи va Studio ease-out o'rtаси). `--dur:.18s`, `--dur-slow:.32s`. Hover: karta `translateY(-2px)`, tugma `brightness(1.06)`. Generate ekvалайzer + glow + progress saqlanadi. `prefers-reduced-motion` hurmat qilinadi.

---

## 6. Mockuplar (`design-preview/`)

Quyidagi statik HTML mockuplar yangi dizayn tizimini ko'rsatadi. Production'га ta'sir qilmaydi — alohida `design-preview/` papkасида. **Brauzerда oching** (`open design-preview/<fayl>`):

| Fayl | Tavsif |
|------|--------|
| `ae-gen-studio.html` | AE Gen Studio composer — full-width Generate qatori, yangi kontrol zichligi, lime CTA, AA kontrast |
| `ae-browse.html` | AE Browse katalog — Pro/Free badge'li kartalar, cheklangan thumb-badges, inline SVG ikona |
| `studio-dashboard.html` | Contributor Dashboard — yangi lime brend, skeleton, komponent klasslar, KPI grid |
| `admin.html` | Admin Console moderatsiya navbati — master-detail, a11y-mos jadval, lime brend |
| `login.html` | Login/Auth — yagona lime brend, dev-tafsilotsiz, yangi logo |
| `index.html` | Mockup indeksi — barcha ekranларга navigatsiya + dizayn tizimi xulosаси |

---

## 7. Keyingi qadamlar

Tasdiqlangач bosqichли implementatsiya (production buzilmаслиги birinchi o'rinда):

1. **Token poydevori (Yuqori #1, #2).** `tokens.css` ga yangi lime + AA-tuzatilgан muted qiymatlар; Studio `app.css :root` ni shu tokenларга moslashtirish (binafsha → lime). **Manba**: `tokens.css`, `packages/assetflow-studio/styles/app.css`. Studio uchun **`styles/` MANBA** ga edit qil, keyin `npm run studio:sync`.
2. **WCAG kontrast (Yuqori #2).** `--muted`/`--muted-2` ko'tarish, `card-cat` 11px, placeholder cheklov. Tez, past xavf.
3. **AE Browse Pro/Free badge + thumb-badge cheklov (#3, #8).** `assetflow-catalog.js renderCard`. AE o'zgartirишдан keyin `bash plugins/after-effects-cep/scripts/install-cep.sh`.
4. **AE Gen composer (#4).** Generate full-width, JSON advanced, indigo → brend. Inline `<style>` `AssetFlow_Plugin.html` да.
5. **Admin obunachи kredit/xabar (#5).** Backend bor (`/api/studio/messages`) — UI ulash yoki kredit berish endpointи qo'shish.
6. **A11y + skeleton (Studio #6, #7).** `js/*-views.js` + `app.css`. **MANBA** `js/` ga edit, `npm run studio:sync`.
7. **Refaktor (#13, #15, #17).** Inline-style → klass, spacing/typo tokenlari, custom dropdown. Katta hajm — alohida bosqich.

**Production buzilmаслиги eslatma:**
- Studio'да **HAR DOIM** root `packages/assetflow-studio/js/` va `styles/` ga edit qil; `studio/js/`, `admin/js/` build artefakti — `prepare-cf-pages.mjs`/`studio:sync` qayta yozadi. So'ng `npm run studio:sync`.
- AE plagin o'zgartirишдан keyin `install-cep.sh` bilan qayta o'rnat.
- Har bosqичдан keyin `npm run verify:pipeline` va katalog `hasPack` productionда tekshir.
- Token o'zgaришлари uch temага (standart/liquid-glass/light-glass) ta'sir qiladi — uchаласини sinab ko'r.
