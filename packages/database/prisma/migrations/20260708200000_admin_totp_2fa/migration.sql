-- ADMIN 2FA (TOTP) — additive. totpSecret shifrlangan (AES-256-GCM, API lib/twofa.ts),
-- totpBackupCodes sha256-hash'langan bir martalik tiklash kodlari.
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "totpBackupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
