CREATE TABLE "ImportReservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "templateId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'reserved',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportReservation_status_valid" CHECK ("status" IN ('reserved','committed','cancelled','expired'))
);
CREATE INDEX "ImportReservation_userId_status_expiresAt_idx" ON "ImportReservation"("userId", "status", "expiresAt");
