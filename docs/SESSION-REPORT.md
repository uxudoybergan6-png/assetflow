# SESSION REPORT — 2026-06-15 — Video progress % + kredit refund tuzatish ✅

Foydalanuvchi: (1) video gen 100% shkalada ko'rinsin, (2) "kredit qaytarildi" dedi lekin qaytmadi.

## Kredit bug (asosiy)
Sabab: video job Render restart'da "running"da QOTIB qoladi → fail() chaqirilmaydi → refund yo'q.
UI timeout'da "qaytarildi" deb YOLG'ON ko'rsatardi.
- **gen-processor.reconcileStuckGenerations(userId)**: 10 daqiqadan oshган queued/running →
  failed + refundAiCredits (atomik). studio-gen /credits VA POST /gen'da chaqiriladi →
  panel ochilганда yo'qolган kredit AVTOMATIK qaytadi.
- UI aiPollJob: timeout endi {status:'timeout'} (failed EMAS) → "qaytarildi" demaydi, halol
  "hali tugamadi, muvaffaqiyatsiz bo'lsa avtomatik qaytadi" + aiRefreshCredits.

## Video progress %
- aiPollJob vaqt-asosli % hisoblaydi (asimptotik, 95% gacha); aiShowGenBox progress bar + "NN%".
- Done bo'lganда natija chiqadi.

## Tekshirildi
- tsc -p apps/api EXIT 0 ✅; inline JS node --check (0 xato) ✅; install-cep ✅
- refundAiCredits/consumeAiCredits simmetrik (pro user) — to'g'ri; muammo qotган job edi.

## Holat
Commit + push → deploy. Deploy'dan keyin foydalanuvchi panelni ochса (/credits) yo'qolган krediti
qaytadi (reconcile). Funksiya/param oqimi tegilmadi.
