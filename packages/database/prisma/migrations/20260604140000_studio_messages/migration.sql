-- CreateTable
CREATE TABLE "StudioMessageThread" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "templateId" TEXT,
    "subject" TEXT NOT NULL,
    "isBroadcast" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioMessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioMessageThread_contributorId_idx" ON "StudioMessageThread"("contributorId");
CREATE INDEX "StudioMessageThread_lastMessageAt_idx" ON "StudioMessageThread"("lastMessageAt");
CREATE INDEX "StudioMessageThread_templateId_idx" ON "StudioMessageThread"("templateId");
CREATE INDEX "StudioMessage_threadId_idx" ON "StudioMessage"("threadId");
CREATE INDEX "StudioMessage_senderId_idx" ON "StudioMessage"("senderId");

-- AddForeignKey
ALTER TABLE "StudioMessageThread" ADD CONSTRAINT "StudioMessageThread_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioMessageThread" ADD CONSTRAINT "StudioMessageThread_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContributorTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudioMessage" ADD CONSTRAINT "StudioMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "StudioMessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioMessage" ADD CONSTRAINT "StudioMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
