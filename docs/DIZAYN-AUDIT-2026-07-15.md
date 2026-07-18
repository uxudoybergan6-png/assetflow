# DIZAYN-AUDIT — web + plagin (jonli ko'rik, 2026-07-15)

**Usul:** jonli sayt (getframeflow.app: landing, /stock, detail, pricing) Chrome'da + plagin (CEP debug-mirror, b99f541) ekranma-ekran skrinshot bilan ko'rildi. Har topilma: D-raqam · jiddiylik (🔴 HIGH — ishonch/funksiya buziladi · 🟠 MED — nomuvofiqlik · 🟢 LOW — pardoz).

**MUHIM eslatma:** ko'rik paytida CF Pages/Render'ga oxirgi 24 commit deploy qilinganmi noma'lum edi — D1/D2/D6 kabi "copy" topilmalari deploy+CMS re-save bilan o'z-o'zidan hal bo'lishi mumkin. Fix'dan OLDIN deploy holatini tekshiring.

---

## A. LANDING (index.html — marketing)

**D1 🔴 Yolg'on statistika.** Hero hisoblagichlar "5,000+ READY-MADE TEMPLATES", pricing kartada "All 10,000+ templates" — real katalogda ~15 shablon. Ikkalasi BIR sahifada bir-biriga ham zid (5,000 vs 10,000). P33 "halollik" ishining ruhiga to'g'ridan zid. Fix: real son yoki halol ifoda ("Yangi kutubxona — har hafta to'ldiriladi"), CMS+kod ikkalasida.

**D2 🔴 Pricing kartalar ESKI YOLG'ON matn bilan.** "/#pricing"da: Free "Watermarked export", Pro "4K, watermark-free downloads" — V2-MED2 E buni olib tashlagan edi. Sabab: CMS DB'dagi saqlangan landing-config kod default'ini bosadi (MED2 flag'i). Fix: deploy → admin Website tab'dan bir marta re-save (yoki bir-martalik DB update).

**D3 🟠 Hisoblagich "0" bilan boshlanadi.** Stats strip birinchi paint'da "0 · 0 · 0" ko'rinadi, keyin count-up. Sekin scroll'da foydalanuvchi "0 AI tools" ni ko'rib ulguradi (skrinshotda ham tushdi). Fix: boshlang'ich qiymat = yakuniy son (animatsiya faqat viewport'ga kirganda, 0'dan emas ~40%dan).

**D4 🔴 Shelf kartalari BO'SH gradient + takrorlar.** "A library of ready-made templates" bo'limida barcha kartalar thumbnail'siz (flat gradient), nomlar demo-data ("Neon Pulse Intro" 2x, "Retro VHS Pack" 2x, "Corporate Slideshow" 3x, "Vlog Starter Kit" 3x). Real katalog turganda landing soxta demo ro'yxat ko'rsatyapti. Fix: real katalogdan real preview'lar (P11 shelf-dedup naqshi bilan), yoki bo'limni real "View all" katalogga bog'lash.

**D5 🟠 "One-click creative presets" kartalari ham bo'sh gradient.** Editorial portrait / Cinematic dolly / Product refraction / Type explosion — cover rasm yo'q. (Bonus: bu bo'lim PRESETS-DIRECTOR-BRIEF bilan bog'lanadi — golden testdan chiqqan real namunalar shu kartalarga qo'yiladi.)

**D6 🟠 "02 — AI STUDIO" bo'limi o'ng yarmi bo'sh.** Matn chapda, o'ngda katta qora bo'shliq (vizual yo'q yoki lazy-load ishlamagan). AI tool kartalarında "Image generation / + / 5 credits" — "+" alohida qatorda yetim belgi bo'lib qolgan.

**D7 🟠 Landing pricing mini-kartalari yarim-bo'sh.** Free/Pro/Studio kartalarining yuqori 60% butunlay bo'sh, narx pastda — kartalar "yuklanmagan"dek ko'rinadi. Fix: 2-3 qatorlik feature xulosasi yoki balandlikni kamaytirish.

**D8 🟢 /pricing → /#pricing redirect.** Alohida pricing sahifa o'rniga anchor'ga qaytaradi (BATCH6'da alohida `isPricing` ekran qilingan edi — routing tekshirilsin).

## B. /STOCK + DETAIL (app)

**D9 🔴 Header kredit-pill raqamsiz.** "+ ␣ FREE" — kredit soni bo'sh/chizqacha bo'lib qoladi (skrinshotda aniq). refreshCredits kelguncha placeholder ko'rinishi yoki skeleton kerak; hozir "buzuq" ko'rinadi.

**D10 🟠 Badge-shovqin.** Har kartada NEW+FREE+4K birga; 15 kartaning 15'i NEW. NEW mantiqi (7 kun?) qayta ko'rilsin; FREE faqat filter kontekstida ma'noli.

**D11 🟠 "Uncategorized" hali ko'rinadi.** "Emergency Alarm" (AI audio) — V2-HIGH1 D taksonomiya fix'i bor, lekin backfill ishga tushirilmagan → eski yozuvlar Uncategorized. Fix: `backfill-ai-audio-type.mjs` ni ishga tushirish (kod emas).

**D12 🟠 Detail'da "X of 15 downloads left" ko'rinmadi.** V2-MED2 E pre-flight qo'shgan edi — deploy'dan keyin qayta tekshirilsin; bo'lmasa Free foydalanuvchi limitni 403'da biladi.

**D13 🟢 Teg-bulut ortiqcha.** Detail'da 19 hashtag-chip — vizual shovqin. 8-10 tagacha qisqartirish + "show more".

**D14 🟢 Preview videoda texnik yozuv.** Player ichida "(16:9 4K)-(9:16)-(1:1)-(4:5)" matni ko'rinadi — bu preview kontentining o'zida; contributor'larga preview-standart eslatma (kontent masalasi, kod emas).

## C. PLAGIN

**D15 🟠 AI launcher'da ikkala karta ham accent-ramkali.** Image Tools ekranida "Generate image" ham "Upscale" ham yorqin lime outline — ikkalasi "tanlangan"dek. Bitta accent qoidasi buzilgan; hover/focus'dagina outline bo'lsin.

**D16 🟠 Launcher ekrani 70% bo'sh.** 2 qator ro'yxat + katta qora bo'shliq. (Bonus: bu bo'shliq PRESET-kartalar uchun tayyor joy — F1'da shu yerga preset to'ri kiradi, alohida fix shart emas.)

**D17 🟠 "Generate image" tugmasi xira-olive.** Aktiv holatda ham loyqa zaytun rang — disabled'dek ko'rinadi (webdagi yorqin lime bilan solishtirganda). Disabled/enabled holatlar vizual aniq farqlansin.

**D18 🟢 History'da bo'sh thumbnail'lar.** AI Tools History lentasida 2 ta IMAGE kartasi qop-qora (thumb yuklanmagan/onerror fallback yo'q — web B-fix'idagi onerror naqshini plaginga ham).

**D19 🟢 Katalog pastki bar'idagi doimiy "Import" tugmasi kontekstsiz.** Hech narsa tanlanmaganda ham katta lime "Import" turadi — nima import bo'lishi noaniq. Tanlov yo'qda disabled yoki yashirin bo'lsin.

**D20 🟢 Kategoriya pill'lari web bilan farq.** Plagin: 6 pill, "All" va "AI Stock" yo'q (webda bor). Paritet tekshirilsin.

## D. UMUMIY (web↔plagin til farqlari)

**D21 🟢 Ikki xil header-model.** Marketing shell (logged-out: Sign in/Start free) vs app shell (logged-in: Home/Stock/AI/Projects) — /pricing marketing'da qolib ketadi, app'dan pricing'ga o'tganda kontekst sakraydi. App ichida pricing'ni app-shell bilan ko'rsatish (BATCH6 isPricing).

---

## FIX REJASI (2 prompt)

### DIZAYN-1 — "Halollik + marketing" (Sonnet 5, ega ishtiroki: CMS re-save)
Tartib: deploy holatini tasdiqlash → D2 (CMS re-save) → D1 → D4 → D5 → D3 → D6 → D7 → D8. CMS+kod IKKALASI. Money-zone yo'q. Har seksiya commit.
Bonus vazifa: D11 backfill + D12 tekshiruv (deploy'dan keyin).

### DIZAYN-2 — "App + plagin pardozi" (Sonnet 5, plagin parity)
Tartib: D9 (kredit-pill skeleton) → D15 → D17 → D10 (NEW mantiqi) → D18 → D19 → D13 → D20 → D21. Har seksiya web+plagin; install-cep.sh; node --check.
D16 ATAYLAB QILINMAYDI — preset F1 shu joyni to'ldiradi.

**Baholash:** DIZAYN-1 ~ yarim kun · DIZAYN-2 ~ 1 kun (Claude Code). Ikkalasi ham jonli regressiya-tekshiruv talab qiladi (3 tema: standart/noir/neon — BATCH6 qoidasi).

---
*Skrinshot-dalillar sessiya ichida (Chrome jonli ko'rik). Claude (Cowork), 2026-07-15.*
