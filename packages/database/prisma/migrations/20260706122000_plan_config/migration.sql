-- FAZA 2 #13 — tarif limitlari DB'da (admin-managed + backend-enforced).
-- ADDITIVE. Seed bugungi konstantalarga teng qiymatlar yozadi — xatti-harakat o'zgarmaydi.

CREATE TABLE "PlanConfig" (
    "plan" "PluginPlanTier" NOT NULL,
    "label" TEXT NOT NULL,
    "aiMonthlyCredits" INTEGER NOT NULL,
    "downloadLimit" INTEGER,
    "importLimit" INTEGER,
    "maxResolution" TEXT NOT NULL DEFAULT '1080p',
    "priceMonthlyCents" INTEGER,
    "priceYearlyCents" INTEGER,
    "lsVariantMonthly" TEXT,
    "lsVariantYearly" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanConfig_pkey" PRIMARY KEY ("plan")
);

-- Bugungi kod konstantalari bilan seed (migratsiya darhol to'liq holat beradi;
-- prisma seed ham xuddi shu qiymatlarni upsert qiladi).
INSERT INTO "PlanConfig" ("plan", "label", "aiMonthlyCredits", "downloadLimit", "importLimit", "maxResolution", "priceMonthlyCents", "priceYearlyCents", "updatedAt") VALUES
  ('FREE',   'Free',   50,   15,   10,   '1080p', 0,     0,      CURRENT_TIMESTAMP),
  ('PRO',    'Pro',    1000, NULL, NULL, '4K',    1900,  19000,  CURRENT_TIMESTAMP),
  ('STUDIO', 'Studio', 6000, NULL, NULL, '4K',    5900,  58800,  CURRENT_TIMESTAMP)
ON CONFLICT ("plan") DO NOTHING;
