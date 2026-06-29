CREATE TABLE "SavedReference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generationId" TEXT,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "resultKey" TEXT,
    "thumbUrl" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedReference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedReference_userId_createdAt_idx" ON "SavedReference"("userId", "createdAt");
CREATE INDEX "SavedReference_userId_expiresAt_idx" ON "SavedReference"("userId", "expiresAt");
CREATE INDEX "SavedReference_generationId_idx" ON "SavedReference"("generationId");

ALTER TABLE "SavedReference"
ADD CONSTRAINT "SavedReference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedReference"
ADD CONSTRAINT "SavedReference_generationId_fkey"
FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
