-- Landing CMS (admin "Website" tab) — ADDITIVE: yangi jadval, mavjudlarga tegmaydi.
-- Bitta qator (id=1) butun landing konfiguratsiyasini JSON blob sifatida saqlaydi;
-- default kontent kodda, shu sabab jadval bo'sh bo'lsa ham landing o'zgarmaydi.
CREATE TABLE "LandingConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingConfig_pkey" PRIMARY KEY ("id")
);
