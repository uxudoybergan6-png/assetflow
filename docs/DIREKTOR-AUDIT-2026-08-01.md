# Direktor audit — 2026-08-01

**Manba:** foydalanuvchi hisoboti (skrinshot, getframeflow.app/stock) + kod tekshiruvi + jonli brauzer/tarmoq tekshiruvi
**Holat:** faqat ro'yxat, tuzatish boshlanmagan

---

## D1 · Stock kategoriyasi to'liq emas · P1 · [MASTER'da bor: EGA#11 + yangi tafsilot]

**Egasi aytdi:** "stock kategoriyasi to'liq emas" (skrinshot: getframeflow.app/stock, "All" tab'da 15 natija, 7 ta pill: Video Templates / Motion Graphics / Graphics / LUTs / Music / Sound Effects / AI Stock)

**Tushunilgan sifatida:** web Stock Catalog sahifasida ba'zi kategoriya tab'lari bosilganda kutilganidek kontent chiqmayapti / kam chiqyapti.

**Takror eslatildi:** yo'q

**Kodda tasdiq:** ✅ tasdiqlandi — jonli API (`api.getframeflow.app/api/plugin/catalog?templateType=X`) va brauzerda LUTs tab'ini bosib tekshirdim:

| Pill | Element soni |
|---|---|
| Video Templates | 5 |
| Motion Graphics | 6 |
| AI Stock | 4 |
| **Graphics** | **0** |
| **LUTs** | **0** |
| **Music** | **0** |
| **Sound Effects** | **0** |

Jami 15 — skrinshotdagi "15 results" bilan bir xil. **4 ta pill'dan 7 tasi (Graphics, LUTs, Music, Sound Effects) butunlay bo'sh.** LUTs tab'ini brauzerda bosganimda "Nothing matches these filters" bo'sh holati to'g'ri chiqdi (kod ishlayapti), lekin kategoriya haqiqatan bo'sh.

**Ildiz sabab:** kod muammosi EMAS — filtr/tab/routing to'g'ri ishlaydi. Sabab **kontent yo'qligi**: contributor upload yo'li 6 ta turni ham qo'llab-quvvatlaydi (`contributor-views.js:422` — `video-templates|luts|graphics|motion-graphics|music|sfx`), lekin hech kim LUTs/Graphics/Music/SFX yuklamagan yoki admin tasdiqlamagan.

**Fayl:** kontent — DB (Template jadvali), kod emas. Tekshirilgan fayllar: `packages/assetflow-studio/platform/index.html:19436` (pill kategoriya xaritasi), `packages/assetflow-studio/js/contributor-views.js:422` (upload turlari).

**Nima buziladi:** mijoz — foydalanuvchi 7 tab'dan 4 tasini bossa hech narsa topolmaydi, "bu marketplace bo'sh-ku" taassuroti qoladi, ishonch yo'qoladi.

**Kim:** EGA (kontent yuklash — LUTs/Graphics/Music/SFX uchun contributor topish yoki o'zi yuklash)

### Yashirin atrof

- **D1.1** — Bo'sh-kategoriya holatida matn noaniq: "Nothing matches these filters ... clear them to see the whole catalog" — bu **filtr torligini** anglatadi, lekin haqiqiy sabab **butun kategoriya bo'sh** (filtrni tozalash yordam bermaydi, chunki hech qanday filtr tanlanmagan — faqat pill). Foydalanuvchini chalg'itadi. `packages/assetflow-studio/platform/index.html:22138-22151` (`emptyTitle`/`emptyDesc` logikasi 3 holatni ажратadi: qidiruv / filtr / bo'sh-katalog, lekin "pill o'zi bo'sh" holatini alohida ajratmagan — "faqat filtr" shoxobchasiga tushib ketadi). · P2 · CC

- **D1.2** — Frontend `catalogCatsByType` (index.html:19436-19444) backend `CATEGORIES_BY_TYPE` (`apps/api/src/lib/taxonomy.ts:155`) ning **qo'lda saqlanadigan nusxasi**. Kodning o'zidagi izoh buni tan oladi: "SINXRON tut, aks holda filtr 0 natija beradi". Hozircha ikkalasi mos (tekshirdim — label'lar bir xil), lekin **hech qanday test bu sinxronni tekshirmaydi**. Kelajakda backend'da bitta kategoriya qo'shilsa/o'zgarsa, frontend eskirgan qoladi va granular filtr jim 0 natija beradi — hech kim bilmaydi. · P2 · CC

- **D1.3** — "Categories" granular dropdown (masalan Video Templates ostida 13 ta: Titles, Lower Thirds, ...) hech qanday son ko'rsatmaydi. Video Templates'da bor-yo'g'i 5 ta element bor — demak 13 tanlovdan aksariyati 0 natijaga olib boradi, foydalanuvchi oldindan bilmaydi. Kosmetik, lekin "to'liq emas" taassurotini kuchaytiradi. `index.html:22087` (`fGranView`). · P3 · CC

### Direktor topilmasi

- **D2 · Ishlatilmagan `{{ }}` shablon ifodalari `src`/`href` atributiga xom oqib chiqyapti · P2 · [YANGI]**

  Brauzerda `/stock` sahifasini ochib tarmoq so'rovlarini tekshirganimda, sahifa **birinchi yuklanishda** o'zining domenidan 20+ ta g'alati so'rov yuboradi:
  `GET https://getframeflow.app/%7B%7B%20detail.posterUrl%20%7D%7D`,
  `.../%7B%7B%20g.vidPoster%20%7D%7D`, `.../%7B%7B%20lb.poster%20%7D%7D`,
  `.../%7B%7B%20featHero.fmedia%20%7D%7D`, `.../%7B%7B%20m.iconRef%20%7D%7D`,
  `.../%7B%7B%20hmUrl%20%7D%7D`, `.../%7B%7B%20rc.url%20%7D%7D` va yana 15+ ta shu kabi
  (`detail`, `r`, `g`, `t`, `lb`, `q`, `featHero`, `rc`, `toolIconRef`, `grp`, `m`, `hmUrl`,
  `cinUrl`, `c`, `p` — Home hero, lightbox, model modal, recent grid, tool icons, group kartalar
  kabi turli komponentlarga tegishli).

  Barchasi `%7B%7B ... %7D%7D` = URL-encoded `{{ ... }}` — ya'ni dc-runtime shablon
  interpolatsiyasi **hal qilinmagan** holda tom matn sifatida `src`/`poster`/`href`
  atributiga yozilgan, brauzer buni nisbiy URL deb domenga so'rov yuborgan (SPA catchall
  200 qaytaradi, lekin bu HTML — rasm/video emas).

  **Ildiz sabab:** loyihada allaqachon hujjatlashtirilgan qoida bor —
  [[dc-runtime-boolean-attr-gotcha]]: `poster`/`src` atributi "resolve() `null` qaytarishi
  SHART, aks holda bo'sh satr sahifa URL'iga aylanadi". Bu ~25 ta binding shu qoidaga
  amal qilmayapti — o'zgaruvchi aniqlanmagan bo'lsa `null` o'rniga xom shablon matnini
  chiqaryapti. Bu **[[spa-deeplink-asset-paths-gotcha]] emas** (u butun dc-runtime mount
  bo'lmay qolish holati edi — bu yerda mount ishlayapti, LUTs tab bosilganda state
  to'g'ri yangilanadi, rasm/video to'g'ri yuklanadi asosiy grid'da).

  Ehtimoliy sabab: Home/AI Studio/Model-library kabi boshqa tab'larga tegishli
  komponentlar (`featHero`, `hmUrl`, `cinUrl`, `m.*` — model kutubxonasi, `lb.*` —
  lightbox) umumiy SPA qobig'ida `/stock` yo'lida ham DOM'ga chiqarilgan, lekin ularning
  ma'lumot manbai (faqat shu tab faol bo'lganda fetch qilinadigan state) hali bo'sh —
  natijada binding `undefined` bo'ladi va noto'g'ri fallback ishlaydi.

  **Fayl:** `packages/assetflow-studio/platform/index.html` — `detail`/`r`/`g`/`t`/`lb`/`q`/
  `featHero`/`rc`/`grp`/`m`/`c`/`p` render funksiyalari (aniq qator raqamlari uchun har
  binding alohida qidirilishi kerak — 25 ta joy).

  **Nima buziladi:** hozircha ko'zga ko'ringan buzilish yo'q (asosiy grid to'g'ri ishlaydi) —
  lekin (1) har `/stock` yuklanishda ~25 ta keraksiz so'rov serverga tushadi (server
  yuklamasi, miqyosda sezilarli), (2) shu komponentlar (lightbox, Home hero, model modal)
  haqiqatda ochilganda — agar ma'lumot hali kelmagan bo'lsa — foydalanuvchi buzilgan
  rasm ikonkasini ko'rishi mumkin (tasdiqlanmagan, taxmin — alohida tekshiruv kerak).
  Kosmetik/perf.

  **Kim:** CC

## D3 · Grid o'ng tomoni bo'sh qolyapti — kartalar chapdan "terilyapti" · P2 · [YANGI]

**Egasi aytdi:** "men yon tomon bo'sh deb aytdim qara shablonlar chap tarafdan terilyapti" (ikkinchi skrinshot — Stock Catalog grid, filtr panelidan pastda, 13-15 karta 5 ustunga joylashgan, o'ng tarafda katta bo'sh joy)

**Tushunilgan sifatida:** foydalanuvchining asl "stock kategoriyasi to'liq emas" degani, aslida (yoki qo'shimcha ravishda) **grid layoutga** tegishli ekan — kartalar butun qator kengligini to'ldirmay, ekranning chap tomoniga siqilib qolyapti, o'ng tomonda bo'sh maydon qolyapti. Bu D1 (kategoriya kontenti yo'qligi) dan **boshqa** — hatto kontent to'liq bo'lsa ham, shu CSS bilan bir xil buziladi.

**Takror eslatildi:** qisman — D1 bilan bir xil foydalanuvchi xabaridan (bitta skrinshot ketma-ketligi), lekin **ildiz sabab boshqa** (D1 = DB'da kontent yo'qligi, D3 = CSS grid algoritmi) → alohida ID sifatida qoldirildi, D1'ga qo'shilmadi.

**Kodda tasdiq:** ✅ tasdiqlandi — jonli saytda (`getframeflow.app/stock`, 1920px viewport) DevTools o'lchovi:

```
containerWidth: 1909px, columnWidth: "260px", columnCount: "auto", columnFill: "balance"
cardCount: 13, ustunlar (unique left): 5 ta (40, 348, 656, 964, 1271)
maxCardRight: 1561px → 1909−1561 = ~348px o'ng tarafda BO'SH (ekran kengligining ~18%)
```

Skrinshotda ham xuddi shu ko'rinadi: 5 ustun chap tomonda, o'ng tomonda katta qora bo'sh maydon.

**Qo'shimcha tasdiq (3-skrinshot, 6 ustunli holat):** foydalanuvchi savol berdi — "nimaga birinchi qatorni to'ldirmasdan ikkinchi qatorga tushyapti". Skrinshotda 6-ustun ("Football Championship Logo Reveal") va 5-ustun ("FrameFlow" matnli karta) boshqalarga qaraganda balandroq — shu ustunlar balans algoritmi bo'yicha "to'ldi" deb hisoblanib, keyingi elementlar o'sha ustunga tushmay bo'sh qoladi. Bu **qator emas — ustun asosidagi joylashuv**: elementlar chapdan-o'ngga qator bo'ylab emas, DOM tartibida 1-ustunni to'liq to'ldirib, keyin 2-ustunga o'tadi; har kartaning balandligi (`aspect-ratio`) turlicha bo'lgani uchun "qator chegaralari" ustunlar orasida tekis emas — shuning uchun vizual "1-qator to'lmay 2-qatorga tushish" taassuroti paydo bo'ladi. Ildiz sababi bilan bir xil (pastda).

**Ildiz sabab:** grid `.va-mas{columns:260px;...}` (`index.html:14961`) — CSS **multi-column** layout (`column-width` + default `column-fill:balance`), **CSS Grid emas**. `columns:260px` brauzerga "taxminan 260px'lik ustunlar yarat" deydi, lekin ustun SONI va joylashuvi butun konteyner kengligiga emas — **kontent balandligini ustunlar orasida tenglashtirish** algoritmiga bog'liq (`column-fill:balance`). Kam va turli balandlikdagi elementlar (har birining `aspect-ratio:{{t.ar}}` boshqa) bilan brauzer "balans" uchun kerakli ustun sonini kam hisoblaydi (bu yerda 5, konteyner esa ~7 ustunga sig'adi) va qolgan ustunlarni ishlatmaydi — ular konteyner o'ng chetiga cho'zilmaydi, faqat bo'sh qoladi. Bu **CSS Grid'ning `repeat(auto-fill,minmax(...))` xatti-harakatidan tubdan farq qiladi** (u har doim butun qatorni to'ldiradi, qator-birinchi tartibda). Demak bu dizayn xatosi emas — CSS multi-column'ning tabiiy cheklovi, kam elementli katalogda (D1 bilan bog'liq — hozir bor-yo'g'i 13-15 element) ayniqsa yaqqol ko'rinadi.

**Fayl:** `packages/assetflow-studio/platform/index.html:14961-14962` (`.va-mas` CSS), `index.html:16762-16782` (Stock Catalog grid render, `sc-for list="{{ filtered }}"`).

**Nima buziladi:** mijoz/taassurot — sahifa "yarim bo'sh"/tugallanmagan ko'rinadi, D1'dagi "marketplace bo'sh-ku" taassurotini yanada kuchaytiradi. Ma'lumot yoki pul buzilmaydi — sof vizual/UX.

**Kim:** CC

### Yashirin atrof

- **D3.1** — Xuddi shu `.va-mas` klassi **Projects → loyiha detali** grid'ida ham ishlatiladi (`index.html:17352`, `sc-for list="{{ projItemsView }}"`). Loyihada kam element bo'lsa (odatiy holat — yangi loyiha), xuddi shu "o'ng tomon bo'sh" muammosi shu yerda ham takrorlanadi. · `index.html:17352` · P3 · CC

- **D3.2** — Multi-column layout **o'qish tartibini** buzadi: elementlar chapdan-o'ngga emas, **ustun bo'ylab yuqoridan-pastga** joylashadi (1-ustun to'liq, keyin 2-ustun...). Bu katalog uchun kutilmagan UX — foydalanuvchi odatda qator bo'ylab skanerlaydi, CSS columns esa DOM tartibini ustunlarga "burab" qo'yadi. Ekran o'lchami o'zgarganda (resize) elementlar butunlay boshqa joyga sakraydi. Kod ichidagi izoh (`index.html:16746`) buni bilib qabul qilgan: "CSS columns sort tartibini ustun bo'ylab o'qiydi (Artlist-accepted)" — ya'ni ataylab shunday qilingan, lekin savdo-tarozida "bo'sh ustun" holati hisobga olinmagan. · P3 · CC

## D4 · Gen natija lightbox — "ikki qavat" + 70% o'lcham  ·  P2 · [YANGI]

**Egasi aytdi:** "Upscalelar umuman ishlamayapti..." xabari ichida (screenshot orqali) — gen natija ochilganda rasm/video ikki qavat bo'lib ko'rinadi; karta bosilganda ekranning 70% o'lchamida ochilishi kerak (hozir deyarli to'liq ekran).
**Tushunilgan sifatida:** Web AI Studio — gen natija kartasiga bosilganda ochiladigan lightbox (`openLightbox`). Kutilgan: bitta tiniq media qatlami, ekranning ~70%ida. Haqiqiy: orqada xira/boshqa nisbatdagi thumbnail fon + ustida asl media — ikki tasvir bir-biriga to'liq mos kelmay "qo'sh qatlam" ko'rinishi beradi; o'lcham deyarli to'liq ekran (96vw/94vh).
**Kodda tasdiq:** ✅ tasdiqlandi
**Ildiz sabab:** `.va-lb-stage` CSS'da `background:var(--media) center/contain no-repeat` (`index.html:15572`) + JS orqali inline `style="background-image:{{ lb.stageBgCss }}"` (`index.html:17585`) qo'yiladi — `stageBgCss` = shu gen'ning **thumbnail**'i (`lbRaw.thumb`, `index.html:22235`). Ya'ni sahna orqasiga xuddi shu asset'ning (ko'pincha boshqa crop/nisbatdagi yoki video uchun eski poster kadrli) thumb'i "contain" qilib fon sifatida chizib qo'yiladi, ustiga esa haqiqiy `<img>`/`<video>` (`index.html:17588-17589`, asl sifat, `lb.maxW` bilan) chiziladi. Ikkisining aspekt nisbati/pozitsiyasi bir xil bo'lmasa (video uchun ehtimoli yuqori — poster kadr ≠ thumb, yoki portret/landshaft crop farqi) — orqadagi xira nusxa chekkalarda ko'rinib qoladi, foydalanuvchiga "ikki qavat" taassurotini beradi. O'lcham tarafi: `.va-lb-shell{max-width:min(96vw,1880px);max-height:94vh}` (`index.html:15570`) — 70% emas, amalda deyarli to'liq ekran; kod ichida sozlanadigan/foydalanuvchi belgilaydigan 70% rejimi umuman yo'q.
**Fayl:** `packages/assetflow-studio/platform/index.html:15570-15573, 17585-17589, 22235, 22239`
**Nima buziladi:** kosmetik — mijoz ko'radi, ayniqsa video natijalarda (SC harakati "chirog'lanish"/ikki qavat effektiga o'xshaydi). Pul yoki ma'lumot buzilmaydi.
**Kim:** CC

### Yashirin atrof
- **D4.1** — `lb.poster` (video uchun) ham alohida manba — agar u ham `thumb`dan farq qilsa, video ochilganda backdrop + poster + o'zi bo'lib UCH xil kadr bir vaqtda ko'rinishi mumkin (poster yuklanguncha). · `index.html:17588` · P3

---

## D5 · Sessiya o'chirish — cascade+ogohlantirish  ·  P3 · [YANGI, lekin asosan allaqachon to'g'ri]

**Egasi aytdi:** sessiyani o'chirishda uning ichidagi barcha gen'lar va saqlangan fayllar ("bunker"dagi) ham o'chishi, va foydalanuvchi oldindan ogohlantirilishi kerak (web + plagin).
**Tushunilgan sifatida:** taxmin: hozirda sessiya o'chirish yo cascade qilmaydi, yoki ogohlantirmasdan o'chiradi — ammo bu taxmin audit natijasida **noto'g'ri** chiqdi (pastga qara).
**Kodda tasdiq:** ⚠️ qisman — asosiy talab ALLAQACHON to'g'ri ishlaydi, faqat bitta kirish nuqtasi noqulay.
**Ildiz sabab (aslida bug emas, tekshiruv natijasi):**
1. **Server cascade + bunker tozalash** — `DELETE /gen/sessions/:id` (`apps/api/src/routes/studio-gen.ts:689-732`): egalik tekshiradi → sessiyadagi barcha `Generation`/`GenAsset` obyektlarini (`resultKey`/`thumbKey`/`watermarkKey`) va ularga bog'langan `SavedReference`larni R2/GCS'dan `deleteS3Objects` bilan o'chiradi → keyin `GenSession` qatorini o'chiradi (Prisma `onDelete: Cascade` DB qatorlarini tozalaydi). Kredit tarixi (`CreditLedger`) ataylab saqlanadi (FK'siz) — to'g'ri dizayn.
2. **Ogohlantirish** — **web**: "Select" rejimiga o'tib checkbox belgilash → "Delete" tugmasi ikki marta bosilishi kerak ("armed" holat, 3.5s ichida, `index.html:22935-22950`) + toast. **Plagin**: `window.afConfirm('Delete N sessions?...permanently deleted...')` modal tasdig'i (`AssetFlow_Plugin.html:16891-16906`).
3. **Yagona kamchilik:** ikkala tomonda ham o'chirish **faqat bulk-select rejimi orqali** ishlaydi — bitta sessiyani o'chirish uchun ham avval "Select" tugmasini bosib, keyin faqat o'sha bitta sessiyani belgilab, "Delete"ni bosish kerak. Sessiya qatorida to'g'ridan-to'g'ri chiqindi/o'chirish ikonkasi yo'q (faqat qalam — nomini o'zgartirish, `index.html:16836`). Bu ehtimol foydalanuvchi "o'chirish imkoniyati yo'q" deb o'ylashiga sabab bo'lgan — funksiya bor, lekin yashirin.
**Fayl:** `apps/api/src/routes/studio-gen.ts:689-732`, `packages/assetflow-studio/platform/index.html:16827-16837, 22935-22950`, `plugins/after-effects-cep/AssetFlow_Plugin.html:16891-16906`
**Nima buziladi:** kosmetik/topilish qiyinligi — real funksionallik yo'qolmaydi, faqat kirish nuqtasi (UX discoverability) yashirin. Pul/ma'lumot xavfsiz.
**Kim:** CC (agar EGA bitta-sessiya tezkor o'chirish tugmasini xohlasa)

---

## D6 · Gen kartani "pin" qilish + doim birinchi o'rinda  ·  P2 · [YANGI]

**Egasi aytdi:** My Library / sessiya grid'ida yangi generatsiya qilingan kartalar doim birinchi bo'lib chiqishi kerak; pin funksiyasi qo'shilsin — pin bosilganda karta avtomatik birinchi o'ringa ko'chsin.
**Tushunilgan sifatida:** Web (va plagin) — My Library / sessiya-ichi gen grid'i. Kutilgan: yangi natija va pin qilingan kartalar ustunlik bilan tepada. Haqiqiy: hozircha pin tushunchasi gen kartalarga umuman yo'q.
**Kodda tasdiq:** ✅ tasdiqlandi (funksiya yo'qligi)
**Ildiz sabab:** `pinnedModels`/`axPins` (`index.html:21850,21857,21863`) faqat **AI model tanlash ro'yxati** uchun mavjud (P13 — modelni dropdown tepasiga qadash) — gen NATIJALARIGA (kartalarga) tegishli emas. My Library ro'yxati (`wsGens = this.state.gens`, `index.html:21600`) serverdan qaytgan tartibda ko'rsatiladi, mijozda qo'shimcha pin-asosli qayta saralash yo'q. `Generation` modelida ham "pinned"ga o'xshash maydon yo'q (grep natijasi bo'sh).
**Fayl:** `packages/assetflow-studio/platform/index.html:21600, 21850-21868` (mavjud pin — faqat model uchun, gen kartaga tegishli emas)
**Nima buziladi:** mijoz qulayligi — tez-tez ishlatiladigan natijani tepada ushlab turish imkoni yo'q, katta kutubxonada eski/kerak natijani qayta qidirish kerak bo'ladi. Pul/ma'lumot buzilmaydi.
**Kim:** CC (yangi DB maydon + API + UI kerak — o'rtacha hajmli feature)

---

## D7 · Sessiya gen ro'yxati faol asbobga qarab filtrlanadi  ·  P2 · [YANGI]

**Egasi aytdi:** sessiya ichidagi gen natijalar ro'yxati faol asbob (masalan image-to-video vs video-to-image) turiga qarab boshqa turdagi natijalarni yashiradi — bu turlar barchasi ko'rinishi kerak.
**Tushunilgan sifatida:** Web AI Studio, "This session" strip (composer ostidagi joriy sessiya natijalar polosasi). Kutilgan: sessiyadagi barcha gen turlari (rasm+video) ko'rinsin. Haqiqiy: faqat joriy asbobning `mode`iga (image/video) mos turdagi natijalar ko'rsatiladi, boshqasi butunlay filtrlanib tashlanadi.
**Kodda tasdiq:** ✅ tasdiqlandi
**Ildiz sabab:** `const sessGens = aiIsCanvas ? genView.filter(g => g.type === (tool.mode === 'video' ? 'video' : 'image')).slice(0, 12)... : []` (`index.html:21672`) — "This session" polosasi qattiq kod bilan faqat joriy `tool.mode`ga mos `g.type`ni filtrlaydi. Asbob image'dan video'ga almashtirilsa, polosa oldingi (masalan rasm) natijalarini yashirib, faqat videolarni ko'rsatadi — foydalanuvchiga "natijalarim yo'qolib qoldi" taassurotini beradi, aslida ular sessiyada bor, faqat filtrlangan.
**Fayl:** `packages/assetflow-studio/platform/index.html:21671-21675`
**Nima buziladi:** mijoz — "natija yo'qolib qoldi" degan yolg'on taassurot, ayniqsa Upscale/variatsiya kabi turlar aralash bo'lganda (D11/Q8c bilan bog'liq — pastga qara). Ma'lumot yo'qolmaydi (server tarafda bor), faqat UI ko'rsatmaydi.
**Kim:** CC

> **⚠️ Tuzatish paytidagi aniqlik (2026-08-01, kod o'zgarganda):** Audit xulosasi QISMAN
> noto'g'ri edi. `sessGens`/`sessLine`/`showSess` hisoblanardi va `render()` eksportiga
> qo'shilardi, lekin **shablonda hech qayerda ishlatilmasdi** — ya'ni bu **o'lik binding** edi,
> jonli ta'siri yo'q. Jonli grid — `axVisGens`/`axAudGens` (`index.html:21684-21685`), u faqat
> **Visuals ↔ Audio** ajratadi; rasm va video Visuals ichida BIRGA turadi. Shuning uchun webda
> asbob almashtirilganda natija yashirinmaydi (sessiya ham saqlanadi: `curSessId` tool.mode
> bo'yicha yangilanmaydi, `index.html:20610`).
>
> **Haqiqiy sabab — plagin tarafida:** har asbob o'ziga alohida `GenSession` ochadi
> (`__axwsSess.imggen` / `.vidgen` / `.audgen` — `AssetFlow_Plugin.html:13346, 15093, 16538`), va
> So'nggi feed SC_29 bo'yicha faqat o'sha sessiya bilan chegaralangan (`loadRecent` 14156-14179,
> `loadVgRecent` 16189-16199). Asbob almashtirilsa **sessiya ham almashadi** → oldingi natijalar
> "yo'qolgan"dek ko'rinadi. Feed ichida tur filtri YO'Q (video rasm-feedida ko'rinadi, faqat audio
> ataylab ajratilgan) — demak muammo filtr emas, **sessiya arxitekturasi**.
>
> **Bajarildi (CC):** webdagi o'lik mode-filtri olib tashlandi (`index.html:21671`) — latent
> regressiya qaytmasin.
> **Ochiq (EGA qarori):** plaginda uch asbob bitta umumiy sessiyani bo'lishsinmi? Bu sessiya
> nomlanishi, cover rejimi, tarix guruhlanishi va "New session" semantikasini o'zgartiradi —
> shuning uchun bir tomonlama tuzatilmadi.

### Yashirin atrof
- **D7.1** — Xuddi shu chegaralash sabab, Upscale natijasi (D11c) alohida karta sifatida "chiqib qolganda" ham shu filtr orqali yashirilishi mumkin (masalan rasmni video-upscale qilsangiz, natija video turida bo'ladi va rasm-rejimidagi polosada ko'rinmay qoladi). · `index.html:21672` · P2
  - **Bekor:** o'lik binding bo'lgani uchun bu xavf hech qachon jonli emas edi; endi kod ham olib tashlandi. Upscale natijasi Visuals grid'ida normal ko'rinadi.

---

## D8 · AI Tools model tanlash — qisqargan nom, to'liq Magnific-uslub kerak  ·  P3 · [YANGI]

**Egasi aytdi:** AI Tools composer/chat zonasi tartibsiz ko'rinadi, model dropdown to'liq model nomini ko'rsatmaydi (qisqarib qoladi), model tanlash Magnific-uslubda (to'liq nom + logo) qayta ishlansin — web + plagin.
**Tushunilgan sifatida:** taxmin: model tanlash popover/chip tor konteynerda, uzun model nomlari `text-overflow:ellipsis` bilan kesiladi; brend belgisi bor-yo'g'i kichik rangli glif, to'liq logotip emas.
**Kodda tasdiq:** ⚠️ qisman tasdiqlandi
**Ildiz sabab:** Model qatori (`.va-axmrow`/`.va-axpm`, `index.html:15724,15750`) va popover ro'yxati (`modelPickView`, `index.html:21836-21868`) — har model uchun **brand nishon** (P13, `brandBadge(m.brand)`, `index.html:21844,21868`) qo'shilgan, lekin bu **rangli qisqa glif** (harflar/rang), to'liq brand logotipi (SVG ikonka) emas (`index.html:15762` izohi: "rangli qisqa glyph"). Model nomi (`.nm`) `white-space:nowrap` bilan chiziladi (`index.html:15724`) — konteyner torligi sabab uzun nomlar (masalan "Google Veo 3.1 Fast") vizual kesiladi/siqiladi. Bu qisman Phase B ("AI Studio depth" mockup, model modal rejasi — [[aistudio-depth-mockup-2026-07]] xotirasida qayd qilingan) rejalashtirilgan, lekin **hali to'liq portlanmagan** — joriy kodda katta model-modal (to'liq nom+logo+tavsif kartochkalari) emas, kichik popover qatorlari bor.
**Fayl:** `packages/assetflow-studio/platform/index.html:15724, 15750, 21836-21868`
**Nima buziladi:** kosmetik/qulaylik — model nomini adashtirish xavfi (masalan ikki o'xshash nomli model orasida). Pul/ma'lumot buzilmaydi.
**Kim:** CC (dizayn+port ishi — Phase B rejasining davomi)

---

## D9 · Stock Catalog audio karta player + turga mos "Related"  ·  P3 · ⚠️ qisman [YANGI]

**Egasi aytdi:** audio kartaning previewi/playerini chiroyli qilish kerak (detal sahifadagi kabi); tavsiya (related) bo'limi turga mos bo'lsin — audioga audio, videoga video, shablonga shablon.
**Tushunilgan sifatida:** Web Stock Catalog — grid kartasi (ro'yxat) va detal sahifa. Kutilgan: (a) grid'dagi audio karta ham waveform/player ko'rinishida; (b) related bo'lim faqat bir xil turdagi elementlarni ko'rsatadi.
**Kodda tasdiq:** ⚠️ qisman — (b) allaqachon to'g'ri, (a) tasdiqlandi.
**Ildiz sabab:**
- **(a) Grid kartada player yo'q** — grid/related kartalar `rcOf()` (`index.html:22036-22049`) orqali quriladi: faqat `thumbUrl`(rasm)/`previewUrl`(hover video) ishlatadi, audio uchun maxsus branch (waveform/pleer) yo'q — audio element oddiy statik thumbnail/gradient plitka sifatida chiqadi. Chiroyli `.va-aplayer` komponent (waveform+play tugma) faqat **detal sahifada** (`index.html:16397`) va lightbox'da (`index.html:17590`) ishlatiladi, grid darajasida YO'Q.
- **(b) Related turga mos filtrlash — ALLAQACHON TO'G'RI:** `colAll = ... filter(t => this.pillOf(t) === this.pillOf(dRaw))` (`index.html:22162`) — `pillOf()` (`index.html:19416-19420`) turni aniq ажратadi (Music/SFX/Templates/Motion/Graphics/LUTs/AIStock alohida-alohida), demak SFX detali faqat SFX bilan, Music faqat Music bilan, video-shablon faqat Templates bilan related bo'ladi — aralashmaydi. **Faqat bitta kosmetik nomuvofiqlik topildi:** bo'lim sarlavhasi barcha turlar uchun qattiq kod bilan "Related templates" (`index.html:16403`) deb yozilgan — audio (SFX/Music) sahifasida ham xuddi shu matn chiqadi, holbuki mazmun to'g'ri filtrlangan bo'ladi (faqat sarlavha matni noto'g'ri turga ishora qiladi).
**Fayl:** `packages/assetflow-studio/platform/index.html:22036-22049` (a — grid audio player yo'q), `16403, 22162, 19416-19420` (b — filtr to'g'ri, sarlavha noto'g'ri)
**Nima buziladi:** kosmetik — (a) audio kontent grid'da "kambag'al" ko'rinadi, boshqa turlardan farqlanmaydi; (b) sarlavha chalkashligi ("Related templates" audio sahifasida) kichik ishonch masalasi. Pul/ma'lumot buzilmaydi.
**Kim:** CC

---

## D10 · Video shablon kartada dastur logotipi o'rniga rangli nuqta  ·  P3 · [YANGI]

**Egasi aytdi:** video shablon qaysi dasturga (After Effects va h.k.) tegishli bo'lsa, o'sha dasturning haqiqiy logotipi ko'rsatilsin — hozir faqat kichik rangli nuqta + "Ae" kabi qisqartma bor, foydalanuvchi adashadi.
**Tushunilgan sifatida:** Web Stock Catalog — grid/related karta meta qatori. Kutilgan: dastur logotipi (masalan AE ikonkasi). Haqiqiy: rangli `<i>` nuqta + 2 harfli qisqartma matn.
**Kodda tasdiq:** ✅ tasdiqlandi
**Ildiz sabab:** karta meta qatori — `<div class="meta">...<span class="sub"><i style="background:{{ r.ac }}"></i>{{ r.a }}</span></div>` (`index.html:16420`) — `r.ac` = rang (dot fon rangi), `r.a` = dastur qisqartmasi ("Ae"/"Pr"/"Mn"/"Dr", to'liq nom xaritasi `appFull` da bor: `index.html:22184`, `{Ae:'After Effects', Pr:'Premiere Pro', Mn:'Apple Motion', Dr:'DaVinci Resolve'}`). Haqiqiy SVG/PNG logotip hech qayerda ishlatilmaydi — faqat rang+harf. Detal sahifada esa `appFull` orqali to'liq nom matn sifatida chiqadi (`metaPills`, `index.html:22185`), lekin u ham logotip emas, matn.
**Fayl:** `packages/assetflow-studio/platform/index.html:16420, 22184-22185`
**Nima buziladi:** kosmetik/qulaylik — "Ae"/"Pr"/"Mn"/"Dr" qisqartmalari tanish bo'lmagan foydalanuvchi uchun tushunarsiz, logotip bilan bir qarashda tanish bo'lardi. Pul/ma'lumot buzilmaydi.
**Kim:** CC (dastur logotiplari — SVG asset kerak, litsenziya/brand-guideline'ga e'tibor: Adobe/Blackmagic/Apple logotiplarini ishlatish shartlarini EGA tasdiqlashi tavsiya etiladi)

---

## D11 · Upscale (Gigapixel/Topaz) umuman ishlamayapti  ·  P0 · [YANGI]

**Egasi aytdi:** "Use ▾" menyudagi Upscale (rasm — Gigapixel, video — Topaz Proteus 2×/4×) bosilganda umuman ishlamaydi; bosilganda faqat sof upscale bo'lsin (ortiqcha parametr/promt chiqmasin); natija alohida yangi karta sifatida sanalsin; before/after taqqoslash slайderi rasm va videoda ham ishlasin (Magnific'dagi kabi: `https://www.magnific.com/app/creation/79OcpZ9JAL`).
**Tushunilgan sifatida:** Web AI Studio — gen natija kartasi "Use ▾" menyusi → "Upscale Image (Gigapixel)" / "Upscale video 2×/4×" (Topaz Proteus). Kutilgan: bosilganda darhol sof upscale ishga tushadi, alohida karta chiqadi, natijada before/after slider bor. Haqiqiy: bosilganda umuman natija chiqmaydi ("ishlamayapti").
**Kodda tasdiq:** ✅ tasdiqlandi — ildiz sabab aniq topildi.

**Ildiz sabab:** production muhitida **`TOPAZ_API_KEY` sozlanmagan**. `isTopazConfigured()` (`apps/api/src/lib/ai/topaz.ts`) `process.env.TOPAZ_API_KEY` mavjudligini tekshiradi; `cloudrun-env.yaml` (Cloud Run'ga `gh secret set CLOUDRUN_ENV_YAML` orqali yuboriladigan haqiqiy production konfiguratsiya) kalitlar ro'yxatida **`TOPAZ_API_KEY` yo'q** (boshqa 40+ kalit bor — `FAL_KEY`, `BYTEPLUS_API_KEY`, `ELEVENLABS_API_KEY` va h.k. bor, faqat shu bitta yo'q). Natijada: foydalanuvchi "Upscale" bosadi → `POST /gen` server tarafda `model.provider === 'topaz'` uchun `isTopazConfigured()`ni tekshiradi (`apps/api/src/routes/studio-gen.ts:1320-1361`) → `false` → `503 {error:"AI is not configured", code:"AI_NOT_CONFIGURED"}` qaytadi — **kredit yechilishidan OLDIN** (pul zarari yo'q), lekin foydalanuvchiga umumiy xato toast'idan boshqa hech narsa ko'rinmaydi, hech qanday progress-karta boshlanmaydi ("umuman ishlamayapti" taassuroti to'g'ri).

Muhim: Topaz provayder kodi (`topaz.ts`) va model katalog yozuvlari (`gen-models.ts:1450-1530`, id 5001 video/Proteus va 5002 rasm/Gigapixel, ikkalasi ham `enabled:true`) **2026-07-20'da bir martalik probe skript orqali E2E tekshirilgan va ishlagan** (izoh: "to'liq lifecycle E2E PASS") — ya'ni o'sha paytda mahalliy/vaqtinchalik kalit bilan sinalgan, lekin bu kalit hech qachon production deploy sekret fayliga (`cloudrun-env.yaml`) yozilmagan. Bu holat `docs/FIX-PROMPTS-R4-2026-07-20.md`da ham oldindan qayd etilgan ("TOPAZ_API_KEY is missing") — ya'ni bilinar edi, lekin yopilmagan.

> **✅ HAL QILINDI (2026-08-02).** Aniqlik: kalit **yo'q emas** edi — lokal `.env`da bor va
> yaroqli (36 belgi; Topaz auth sinovi: haqiqiy kalit `404 process ID does not exist`,
> yaroqsiz kalit `401 Invalid authentication token`; `prob-4`/Proteus hisobda mavjud). Muammo:
> `.env` (lokal dev) va `cloudrun-env.yaml` (prod, gitignore'da → `gh secret set
> CLOUDRUN_ENV_YAML`) **ikki mustaqil manba** — kalit ikkinchisiga hech qachon yozilmagan.
> Bajarildi: yaml'ga `TOPAZ_API_KEY` qo'shildi (48 kalit, dublikat yo'q) → sekret yangilandi →
> "Deploy API to Cloud Run" qayta ishga tushirildi (migratsiya + deploy ✅). **Prod tasdiq:**
> `GET /api/studio/gen/ops` endi `5001 Upscale Video (Proteus)` + `5002 Upscale Image
> (Gigapixel)` qaytaradi. D11.a darvozasi (provayder-configured tekshiruvi) ishlayotgani ham
> shu bilan tasdiqlandi — kalit qo'shilishi bilan tugmalar o'zi qaytdi, kod o'zgarmadi.

**Fayl:** `apps/api/src/lib/ai/topaz.ts` (`isTopazConfigured`), `apps/api/src/routes/studio-gen.ts:1320-1361` (guard), `cloudrun-env.yaml` (EGA'ning lokal fayli — kalit yo'q), `apps/api/src/lib/gen-models.ts:1450-1530`
**Nima buziladi:** mijoz + pul (bilvosita) — Upscale funksiyasi reklama qilingan/UI'da ko'rinadi, lekin ishlamaydi; foydalanuvchi vaqtini yo'qotadi, ishonchni yo'qotadi. To'g'ridan-to'g'ri kredit zarari yo'q (guard kredit yechishdan oldin ishlaydi).
**Kim:** EGA (Topaz akkauntida yangi/amaldagi API kalitni olish + `cloudrun-env.yaml`ga qo'shish + `gh secret set CLOUDRUN_ENV_YAML` bilan qayta yuborish + Cloud Run qayta deploy) — CC EMAS, chunki bu tashqi xizmat kalit/hisob masalasi.

### Yashirin atrof

- **D11.a** — `GET /gen/ops` (`apps/api/src/routes/studio-gen.ts:874-892`) faqat `GEN_MODELS` katalogidagi `enabled:true` bo'yicha filtrlaydi, **`isTopazConfigured()`ni tekshirmaydi**. Demak UI'da "Upscale" tugmalari har doim ko'rinadi (chunki katalogda `enabled:true`), lekin backend kalit yo'qligi sabab hech qachon ishlamaydi — foydalanuvchi uchun "bosdim-hech narsa bo'lmadi" tajribasi. EGA kalitni qo'shgandan keyin ham, kelajakda boshqa provayder kaliti yo'qolib qolsa xuddi shu muammo qaytishi mumkin — tuzatish: `/gen/ops` provayder-konfiguratsiya holatini ham hisobga olsin. · `apps/api/src/routes/studio-gen.ts:874-892` · P2 · CC

- **D11.b** — Eski "composer Upscale tool" rejimi (`axIsUpscaleTool`, kod izohlarida "SC_17: butunlay olib tashlandi" deyilgan, `index.html:16956-16957,18292,21128`) aslida **hali ham to'liq ishlaydi** — mavjud upscale-turdagi gen'ni "Regenerate" qilganda shu rejimga qaytiladi (`index.html:21522,21637,21170` — to'liq composer: promt bar, sifat chip'lari, ref-chip'lar). Bu foydalanuvchining "ortiqcha parametr va promtlar chiqyapti" shikoyatining aynan sababi bo'lishi mumkin — "Use ▾ → Upscale" yo'li o'zi toza (`runTopazOp`, `index.html:20642-20681` — hech qanday promt/parametr so'ramaydi), lekin "Regenerate" orqali eski to'liq composer'ga qaytish mumkin. · `index.html:21522, 21637, 21170` · P2 · CC

  > **✅ Tuzatildi (2026-08-02).** Aniqlik: server `GET /gen/models` `opType` modellarni composer
  > picker'idan ALLAQACHON chiqarib tashlaydi (`studio-gen.ts:854-857`, R4_07) — demak upscale
  > rejimiga model tanlash orqali KIRIB bo'lmaydi, yagona kirish nuqtasi "Regenerate"
  > (`restoreGenToComposer`, `index.html:21200-21245`). Sozlama chiplari ham aslida toza edi
  > (5002: `aspects:["Auto"]`, `count:[1]` → ⚙ chip umuman yo'q; 5001: faqat `Factor x2/x4`).
  > Haqiqiy ortiqcha yuza — **prompt paneli va "Enhance" chipi**: ular render bo'lardi, lekin
  > upscale provayderi promptni O'QIMAYDI (`generate()` avto-nom yozadi) — ya'ni yolg'on UI.
  > Tuzatish: `showPromptBar = !axIsUpscaleTool` — prompt paneli + Enhance chipi render bo'lmaydi;
  > `hasComposerContent` yashirin promptdan "Clear" chiqarmaydi; `generate()` upscale'da har doim
  > avto-nom yozadi (boshqa asbobdan qolgan ko'rinmas matn natija nomiga sizib ketmasin).
  > Qolgani: manba (＋) + faktor (⚙ x2/x4) + Generate. Plaginda bu yuza umuman yo'q (SC_17).
  > **Qilinmadi (ataylab):** "Regenerate"ni to'g'ridan-to'g'ri `runTopazOp` bilan qayta ishga
  > tushirish — gen `params`ida faqat muddati o'tuvchi imzolangan URL saqlanadi, manba `genId`
  > emas; uni qo'shish imzolangan-quote canonical params'ini o'zgartiradi (pul zonasi).

- **D11.c** — Upscale natijasi "alohida yangi karta" bo'lib chiqishi kerak degan talab — kodda `runTopazOp` haqiqatan yangi `Generation` yaratadi (`FFAPI.gen(...)`, alohida `id`), demak texnik jihatdan alohida karta sifatida saqlanadi. Lekin D7 (sessiya grid faol asbobga qarab filtrlaydi) sabab, agar joriy asbob rejimi (image/video) upscale natija turiga mos kelmasa, bu yangi karta "This session" polosasida ko'rinmasligi mumkin — D7 bilan bog'liq, alohida tuzatish emas. · bog'liq: D7 · P2

- **D11.d** — Before/after taqqoslash slайder — **kodda umuman yo'q** (butun loyihada faqat `.compare-strip` klassi topildi, u esa narx sahifasidagi marketing taqqoslash jadvali, media slайder emas — `index.html:15836-15881`). Bu D12 (Q9, natija detal ko'rinishi) bilan bir xil ildiz — pastga qara, alohida ID ochilmadi. · bog'liq: D12 · P2

**Takror eslatildi:** yo'q — yangi band, avvalgi D1-D3.2 bilan bog'liq emas.

---

## D12 · Gen natija detal ko'rinishi — Magnific-uslub redizayn  ·  P2 · [YANGI]

**Egasi aytdi:** rasm va video gen natijasi ochilganda Magnific'dagidek (tabs: Details/Comments/Edit, Prompt, Settings teglar, References, "Use image/video", "Edit image", "Create video", "Extract frame", "Save as template", "Share" kabi funksiyalar) bir xil ko'rinish bo'lsin — rasm va video uchun umumiy.
**Tushunilgan sifatida:** Web — gen lightbox panel (`index.html:17593-17623`). Kutilgan: tab'li panel, boy amal tugmalari, before/after (D11.d bilan bog'liq), referenslar ro'yxati. Haqiqiy: bitta yassi panel (tab'siz), cheklangan amal tugmalari.
**Kodda tasdiq:** ✅ tasdiqlandi (gap aniq)
**Ildiz sabab:** joriy lightbox panel (`va-lb-panel`, `index.html:17593-17623`) da: (1) **tab yo'q** — Details/Comments/Edit bo'linishi mavjud emas, hammasi bitta ustunda; (2) PROMPT + DETAILS (Model/Quality/Size/Duration/Created) qatorlari bor — Magnific'ning "Settings" teglariga konseptual yaqin, lekin key-value ro'yxat shaklida, chip/tag emas; (3) amal tugmalari: Download/Project/Explore/Reference/Delete (`index.html:17614-17621`) — Magnific'dagi "Edit image"/"Create video"/"Extract frame"/"Save as template" kabi ishlab chiqarish zanjiri tugmalari YO'Q; **"Upscale" tugmasi lightbox'dan ataylab olib tashlangan** (izoh: "SC_17: lightbox Upscale tugmasi o'chirildi", `index.html:17620`) — ya'ni upscale'ga faqat grid kartadagi "Use ▾" orqali kirish mumkin, detal ko'rinishidan emas — izchillik yo'q; (4) **References** bo'limi (qaysi ref-rasmlar asosida generatsiya qilingani) umuman ko'rsatilmaydi; (5) before/after slайder yo'q (D11.d).
**Fayl:** `packages/assetflow-studio/platform/index.html:17593-17623`
**Nima buziladi:** mijoz — natija bilan ishlash (tahrirlash, video yaratish, kadr ajratish, shablon sifatida saqlash) uchun foydalanuvchi lightbox'dan chiqib boshqa joyni qidirishga majbur bo'ladi; ishlab chiqarish zanjiri uzuq-yuluq. Pul/ma'lumot buzilmaydi — sof UX/feature gap.
**Kim:** CC (katta dizayn+implementatsiya ishi — alohida reja/faza sifatida qaralishi tavsiya etiladi, D11.d bilan birga)

**Takror eslatildi:** yo'q — D11.d shu bilan bog'liq (before/after), lekin D12 kengroq (butun panel redizayni), shuning uchun alohida ID.

---

## Yig'ma jadval

| ID | Daraja | Zona | Kim | Holat |
|---|---|---|---|---|
| D1 | P1 | Web — Stock Catalog kontenti | EGA | Tasdiqlandi — 4/7 kategoriya bo'sh |
| D1.1 | P2 | Web — bo'sh holat matni | CC | Tasdiqlandi |
| D1.2 | P2 | Web/API — taksonomiya sinxron testi yo'q | CC | Tasdiqlandi (risk, hozircha drift yo'q) |
| D1.3 | P3 | Web — granular dropdown son ko'rsatmaydi | CC | Tasdiqlandi |
| D2 | P2 | Web — dc-runtime shablon leak (25 joy) | CC | Tasdiqlandi (jonli tarmoqda) |
| D3 | P2 | Web — masonry grid o'ng tomoni bo'sh | CC | Tasdiqlandi (jonli o'lchov: ~348px bo'sh) |
| D3.1 | P3 | Web — Projects detail xuddi shu grid | CC | Tasdiqlandi (bir xil klass) |
| D3.2 | P3 | Web — o'qish tartibi ustun-bo'ylab | CC | Tasdiqlandi (ataylab, lekin oqibat hisobga olinmagan) |
| D4 | P2 | Web — lightbox ikki qavat + 96%~100% o'lcham | CC | ✅ **Tuzatildi** — fon alohida `.va-lb-bg` (cover+blur), shell 72vw×~78vh (o'lchandi: 922×559 @1280×720) |
| D4.1 | P3 | Web — video poster/thumb/asl 3 xil kadr | CC | ✅ Yopildi — fon endi kuchli blur, "uchinchi kadr" sifatida o'qilmaydi (poster→asl = odatiy blur-up) |
| D5 | P3 | Web/Plagin — sessiya o'chirish kirish nuqtasi yashirin | CC | Qisman — asosiy funksiya to'g'ri ishlaydi |
| D6 | P2 | Web/Plagin — gen kartani pin qilish yo'q | CC | Tasdiqlandi (yo'qligi) |
| D7 | P2 | Web (o'lik kod) / Plagin (sessiya arxitekturasi) | CC + EGA | ⚠️ Qayta baholandi — web o'lik filtr **tuzatildi**; plaginda per-tool sessiya = EGA qarori |
| D7.1 | P2 | Web — Upscale natija shu filtr sabab yo'qolishi mumkin | CC | ❌ Bekor — filtr o'lik edi, jonli xavf yo'q |
| D8 | P3 | Web/Plagin — model nomi qisqargan, logotip yo'q | CC | Qisman tasdiqlandi |
| D9 | P3 | Web — audio karta player yo'q; related sarlavha noto'g'ri | CC | ✅ **Tuzatildi** — `waveBg()` to'lqin fon (muqovasiz Music/SFX) + `relatedTitle` turga mos. Grid'da inline `<audio>` ATAYLAB yo'q (30+ karta = 30+ preload) — pleer detal/lightbox'da |
| D10 | P3 | Web — dastur logotipi o'rniga rang+qisqartma | CC | Tasdiqlandi |
| D11 | P0 | API — Upscale (Topaz) umuman ishlamaydi | EGA | ✅ Hal qilindi 2026-08-02 (kalit prod'ga chiqarildi, `/gen/ops` 5001+5002 qaytaradi) |
| D11.a | P2 | API — `/gen/ops` provayder holatini tekshirmaydi | CC | ✅ **Tuzatildi** — `isProviderConfigured()` yagona manba (`/gen` guard + `/gen/ops`) |
| D11.b | P2 | Web — eski composer-Upscale rejimi "Regenerate" orqali qaytadi | CC | ✅ Tuzatildi (prompt+Enhance yashirildi; qolgani manba+faktor+Generate) |
| D11.c | P2 | Web — Upscale natija D7 filtri sabab yo'qolishi mumkin | CC | ❌ Bekor — D7 filtri o'lik edi (D7.1 bilan bir xil) |
| D11.d | P2 | Web — before/after slайder yo'q | CC | Tasdiqlandi (yo'qligi), bog'liq D12 |
| D12 | P2 | Web — gen detal ko'rinish Magnific-uslub emas | CC | Tasdiqlandi (gap aniq) |
