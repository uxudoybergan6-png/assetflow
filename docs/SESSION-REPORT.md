# Sessiya hisoboti — 2026-07-09 (QA-FIX #7: pack asset'lari yo'qolishi)

**Ildiz sabab:** bulk ingest (`ingestOneZip`) contributor zip'idan FAQAT .aep entry'ni
`templates/{id}/pack.aep` sifatida saqlab, asl zipni O'CHIRARDI — footage/audio/papkalar
abadiy yo'qolardi; serve-asset esa yolg'iz .aep'ni `pack.dl.zip`ga o'rab berardi →
AE'da "N files missing". (Studio /pack-uploaded va /assets yo'llari sog' edi.)

**Tuzatildi:**
- contributor.ts: ingest endi ASL ZIPNI BUTUNLIGICHA `templates/{id}/pack.zip` qiladi
  (bucket→bucket stream, hajm + saqlangan-entry hash tekshiruvi); fileName/fileSize=to'liq zip.
- serve-asset.ts: .aep→zip o'rash faqat yakka-.aep pack'lar uchun ekani hujjatlandi (xulq bir xil).
- Plagin: unzip kesh markeri (.assetflow_pack_size — fileSize o'zgarsa kesh tashlanadi),
  unzip timeout 60s→600s. unzip -o strukturani saqlaydi — nisbiy havolalar ishlaydi.

**Tekshirildi:** to'liq zanjir simulyatsiyasi (real dist ingest kodi bilan): oldin=faqat pack.aep,
keyin=hamma fayl+papkalar, plagin extract'ida barcha nisbiy havolalar RESOLVES; API build yashil.

**Kutilmoqda:** push+deploy; eski (buruq ingest'dan o'tgan) shablonlar tiklanmaydi — contributor
qayta yuklashi kerak; jonli AE import testi.
