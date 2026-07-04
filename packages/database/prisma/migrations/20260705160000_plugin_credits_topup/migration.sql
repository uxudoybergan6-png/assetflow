-- Bosqich 4 #5 — TOP-UP kredit carry-over. ADDITIVE, NON-destructive.
-- aiCredits ichidagi sotib olingan top-up ulushini kuzatadi; oylik reset endi
-- balansni allotment + qolgan top-up ga tiklaydi (avval faqat allotment edi →
-- sarflanmagan top-up yo'qolardi). Default 0 = mavjud userlar top-up'siz (xavfsiz).

ALTER TABLE "PluginProfile" ADD COLUMN "aiCreditsTopup" INTEGER NOT NULL DEFAULT 0;
