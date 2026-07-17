# SESSION-REPORT — SC_30 (2026-07-17)

**Vazifa:** Use ▾ menyu barcha amallari (plagin + web) tekshiruv-matritsasi + tuzatishlar.

- Tekshirildi (lokal API :4000 + brauzer QA): Import, Add to project (idempotent upsert),
  Add to Explore (rights gate + dedupe), Use as reference, Regenerate (prefill, kredit yo'q),
  Copy prompt, Delete (confirm + R2 + storage usedBytes kamayadi).
- Tuzatildi (plagin): My Library'da AUDIO Regenerate rasm tool'iga noto'g'ri ketardi → yashirildi
  + galRestore guard; audio/session feed Delete tasdiqsiz edi → afConfirm; loyiha view'da menyu
  "Delete" → "Remove from project"; window.afCopyText toast'siz/CEP'da jim sinishi mumkin edi →
  execCommand-first + "Prompt copied" toast; onDelete'siz ctx'da o'lik Delete bandi yashirin.
- Tuzatildi (web): Edit image / i2v bandlari rasm bo'lmagan natijada yashirin (o'lik band emas);
  delete'dan keyin menyu yopiladi (qo'shni kartada ochiq qolardi).
- Kutilmoqda: jonli AE'da Import (fayl + ExtendScript) tasdig'i; explore submit lokalda NO_ASSET
  (seed genlarda R2 resultKey yo'q — production yo'li kod bilan tasdiqlangan).

Commit: 3540d05 (main). Pul-zonasi TEGILMAGAN.
