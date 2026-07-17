# Sessiya hisoboti — SC_29 (2026-07-17)

**Vazifa:** Sessiyalar funksional buzuq — "+ New session" ishlamaydi, har sessiya bir xil feed, Visuals/Audio filtr noto'g'ri.

**3 root cause (hammasi plaginda; web allaqachon to'g'ri edi — viewSess/sessGens/visCount tekshirildi):**
1. **Feed sessiyaga bog'lanmagan** — imggen/vidgen/audgen "So'nggi" grid har doim global `/gen/history` yuklardi; `st.sessionId` e'tiborsiz. Fix: `/gen/sessions/:id/generations?status=done` bilan scope; sessiya yo'q → bo'sh feed (so'rovsiz).
2. **"+ New session" "o'lik"** — handler bog'langan edi, lekin feed global bo'lgani uchun hech narsa o'zgarmasdi. Fix: setter'lar (`axIGSetSession`/`axVG`/`axAG`) sessiya almashganda feedni reset qiladi → yangi sessiya = bo'sh workspace; birinchi genda lazy yaratish saqlanadi.
3. **Filtr/sanoq buzuq** — tab sanog'i faqat DOM karta sonidan (Visuals 12 = global aralash, Audio doim 0); audio kartalar Visuals'ga sizib chiqardi. Fix: kind-filtr (visual=image+video; audio=voice+sfx+music) feed renderda + `__axwsCounts` hook'lari — ikkala tab sanog'i FAOL sessiya elementlaridan.

**Qo'shimcha:** fon-toast "View" endi natijaning O'Z sessiyasini ochadi (`j.sid` + `__axToolSess`); sessiya almashganda tugagan job eski feedga aralashmaydi; gen done'da `axSPInvalidate` → picker sanoqlari yangi.

**QA (lokal API :4000 + seed user, brauzer cep-mode):** sessiya A/B alohida feed'lar, picker sanoq = ochilgan feed; mixed sessiyada Visuals 2/Audio 1, audio karta Visuals'da yo'q; "+ New session" 2 marta ketma-ket ishlaydi; yangi sessiyaga gen → count 1; My Library 9 (unscoped qoldi); 3 tema OK; console toza; node --check 7/7; install-cep OK.

**Kutilmoqda:** real AE'da jonli tekshiruv (owner).
