#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const MIGRATION = "20260817123000_ingest_active_dedupe";
const prisma = new PrismaClient();

try {
  const failed = await prisma.$queryRawUnsafe(
    `SELECT "migration_name"
       FROM "_prisma_migrations"
      WHERE "finished_at" IS NULL
        AND "rolled_back_at" IS NULL
      ORDER BY "started_at" ASC`
  );
  const names = failed.map((row) => String(row.migration_name || ""));
  const unexpected = names.filter((name) => name !== MIGRATION);
  if (unexpected.length) {
    throw new Error(`Unexpected failed Prisma migration(s): ${unexpected.join(", ")}`);
  }
  if (!names.includes(MIGRATION)) {
    console.log("No known failed ingest-dedupe migration to recover.");
  } else {
    console.log(`Marking ${MIGRATION} rolled back before its corrected idempotent retry.`);
    execFileSync(
      "npm",
      ["exec", "--workspace", "@creative-tools/database", "--", "prisma", "migrate", "resolve", "--rolled-back", MIGRATION],
      { stdio: "inherit", env: process.env }
    );
  }
} finally {
  await prisma.$disconnect();
}
