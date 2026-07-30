-- #86 (C7) — contributor profil bio'si.
-- Studio Settings'dagi "Bio" maydoni ilgari hech qayerga saqlanmasdi (id'siz textarea).
-- Additive, nullable — eski qatorlarga ta'sir qilmaydi.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT;
