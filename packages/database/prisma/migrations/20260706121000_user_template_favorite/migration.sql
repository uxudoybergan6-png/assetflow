-- FAZA 2 #17 — plagin↔web umumiy sevimlilar. ADDITIVE, NON-destructive.

CREATE TABLE "UserTemplateFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTemplateFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTemplateFavorite_userId_templateId_key" ON "UserTemplateFavorite"("userId", "templateId");

CREATE INDEX "UserTemplateFavorite_userId_idx" ON "UserTemplateFavorite"("userId");
