import { prisma, Prisma } from "@creative-tools/database";

export async function writeAuditLog(opts: {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.studioAuditLog.create({
      data: {
        actorId: opts.actorId ?? null,
        action: opts.action,
        targetType: opts.targetType ?? null,
        targetId: opts.targetId ?? null,
        detail: opts.detail ?? null,
        metaJson: (opts.meta ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error("writeAuditLog", e);
  }
}
