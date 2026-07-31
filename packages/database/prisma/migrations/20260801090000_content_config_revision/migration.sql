-- SC_62 — CMS konfiguratsiya versiya tarixi (undo/restore).
-- ADDITIVE: faqat yangi jadval; mavjud jadvallarga tegilmaydi.
CREATE TABLE "ContentConfigRevision" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "savedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentConfigRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentConfigRevision_kind_createdAt_idx" ON "ContentConfigRevision"("kind", "createdAt");
