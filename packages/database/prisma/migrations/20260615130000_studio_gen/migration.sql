-- CreateTable
CREATE TABLE "GenSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'image',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "modelId" INTEGER NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "category" TEXT,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenAsset" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "resultKey" TEXT,
    "thumbUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "aspectRatio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenSession_userId_idx" ON "GenSession"("userId");

-- CreateIndex
CREATE INDEX "GenSession_createdAt_idx" ON "GenSession"("createdAt");

-- CreateIndex
CREATE INDEX "Generation_sessionId_idx" ON "Generation"("sessionId");

-- CreateIndex
CREATE INDEX "Generation_userId_idx" ON "Generation"("userId");

-- CreateIndex
CREATE INDEX "Generation_status_idx" ON "Generation"("status");

-- CreateIndex
CREATE INDEX "Generation_createdAt_idx" ON "Generation"("createdAt");

-- CreateIndex
CREATE INDEX "GenAsset_generationId_idx" ON "GenAsset"("generationId");

-- AddForeignKey
ALTER TABLE "GenSession" ADD CONSTRAINT "GenSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GenSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenAsset" ADD CONSTRAINT "GenAsset_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

