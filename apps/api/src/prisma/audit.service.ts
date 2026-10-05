import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { getTenantContext } from './tenant-context';

export type AuditDiff = Record<string, { from: unknown; to: unknown }>;

/**
 * Writes the audit trail that feeds the design's "Activity" timeline and the
 * ISO traceability requirement. Never throws into the caller's path: a failed
 * audit write must not fail the business operation it describes.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    entityType: string,
    entityId: string,
    action: string,
    diff?: AuditDiff,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const ctx = getTenantContext();
    if (!ctx) return;
    const client = tx ?? this.prisma.unscoped;
    try {
      await client.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          entityType,
          entityId,
          action,
          diff: (diff ?? undefined) as Prisma.InputJsonValue | undefined,
          actorId: ctx.userId,
          actorName: ctx.actorName,
        },
      });
    } catch {
      // Swallowed deliberately — see class doc.
    }
  }

  /** Field-level diff of only what actually changed. */
  static diff<T extends Record<string, unknown>>(before: T, after: Partial<T>): AuditDiff {
    const out: AuditDiff = {};
    for (const [k, to] of Object.entries(after)) {
      const from = before[k];
      const same = from instanceof Date && to instanceof Date
        ? from.getTime() === to.getTime()
        : String(from) === String(to);
      if (!same) out[k] = { from, to };
    }
    return out;
  }
}
