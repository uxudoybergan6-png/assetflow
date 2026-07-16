-- Plugin CMS (admin "Plugin CMS" tab) — ADDITIVE: yangi jadval, mavjudlarga tegmaydi.
-- Bitta qator (id=1) AE plagin UI kontenti (matnlar + fon media URL) JSON blob'da;
-- default kontent kodda, shu sabab jadval bo'sh bo'lsa ham plagin o'zgarmaydi.
CREATE TABLE "PluginContentConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginContentConfig_pkey" PRIMARY KEY ("id")
);
