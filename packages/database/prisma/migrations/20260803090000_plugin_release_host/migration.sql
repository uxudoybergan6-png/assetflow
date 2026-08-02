-- FAZA 5 (ko'p-host) — plagin reliz kanali HOST bo'yicha ajratildi + download
-- hodisasiga host dasturi kodi qo'shildi.
--
-- AE (CEP) va Premiere Pro (UXP) panellari MUSTAQIL versiyalanadi: bir xil
-- "1.4.0" ikkala hostda ham bo'lishi mumkin. Shu sabab `version` ustunidagi
-- yakka unikallik `(host, version)` juftligiga ko'chiriladi.
--
-- Additive va back-compat: `host` DEFAULT 'ae' → mavjud qatorlar AE relizlari
-- bo'lib qoladi, `?app=` yubormaydigan eski panel bugungidek AE'ni oladi.
-- Pul zonasiga (kredit/quote/billing) TEGMAYDI.

ALTER TABLE "PluginRelease" ADD COLUMN "host" TEXT NOT NULL DEFAULT 'ae';

DROP INDEX IF EXISTS "PluginRelease_version_key";
CREATE UNIQUE INDEX "PluginRelease_host_version_key" ON "PluginRelease"("host", "version");
CREATE INDEX "PluginRelease_host_publishedAt_idx" ON "PluginRelease"("host", "publishedAt");

-- Hodisa qaysi host plaginidan kelgani (analitika). Nullable — eski yozuvlar va
-- host yubormaydigan klientlar uchun null; dedup/earning mantig'iga TEGMAYDI.
ALTER TABLE "TemplateDownloadEvent" ADD COLUMN "app" TEXT;
