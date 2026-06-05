-- CreateTable
CREATE TABLE "StudioAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "detail" TEXT,
    "metaJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioAuditLog_action_idx" ON "StudioAuditLog"("action");
CREATE INDEX "StudioAuditLog_createdAt_idx" ON "StudioAuditLog"("createdAt");
CREATE INDEX "StudioAuditLog_actorId_idx" ON "StudioAuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "StudioAuditLog" ADD CONSTRAINT "StudioAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
