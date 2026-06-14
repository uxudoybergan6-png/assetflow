-- CreateEnum
CREATE TYPE "AiGenerationType" AS ENUM ('IMAGE', 'VOICEOVER', 'SFX', 'SEARCH');

-- CreateEnum
CREATE TYPE "AiGenerationStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "PluginProfile" ADD COLUMN     "aiCredits" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "aiCreditsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AiGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AiGenerationType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "resultKey" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "status" "AiGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiGeneration_userId_idx" ON "AiGeneration"("userId");

-- CreateIndex
CREATE INDEX "AiGeneration_type_idx" ON "AiGeneration"("type");

-- CreateIndex
CREATE INDEX "AiGeneration_createdAt_idx" ON "AiGeneration"("createdAt");

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

