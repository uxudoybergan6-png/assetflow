# SESSION REPORT — 2026-06-30 — saved references fon rejimiga o'tkazildi

- Foydalanuvchi uchun `Saved References` ko‘rinadigan blok olib tashlandi.
- Saved referenslar endi UI’da chiqmaydi, lekin backend’da vaqtincha saqlanishda davom etadi.
- TTL 1 soatdan 10 minutga tushirildi.
- Referens cleanup intervali ham qisqartirildi, shunda amalda tezroq o‘chadi.
- Video tool ichida saved ref fetch fon rejimida qoladi, lekin foydalanuvchi ko‘rmaydi.
- Demak: user referens yuklaydi, gen qiladi, keyin referenslar taxminan 10 minut ichida avtomatik tozalanadi.
- Qo‘shimcha: saved ref mapping ichiga `contentType` ham qo‘shildi.
- Kutilayotgan tekshiruv: plugin qayta ochilganda `Saved References` bo‘limi umuman ko‘rinmasligi kerak.
