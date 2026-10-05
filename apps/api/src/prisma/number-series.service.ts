import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { requireTenantContext } from './tenant-context';

/**
 * Issues document numbers ("IF-PH-4410", "ENQ-0001") from the per-tenant
 * NumberSeries table, backing the design's read-only "(auto)" fields.
 *
 * Concurrency: the increment happens inside the caller's transaction via an
 * atomic UPDATE ... RETURNING, so two simultaneous creates cannot receive the
 * same number. Always call this inside the same transaction as the insert, so
 * a failed insert does not burn a number.
 */
@Injectable()
export class NumberSeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async next(docType: string, tx?: Prisma.TransactionClient): Promise<string> {
    const { tenantId } = requireTenantContext();
    const client = tx ?? this.prisma;

    const rows = await client.$queryRaw<{ prefix: string; padding: number; nextValue: number; suffix: string | null }[]>`
      UPDATE number_series
         SET "nextValue" = "nextValue" + 1, "updatedAt" = now()
       WHERE "tenantId" = ${tenantId} AND "docType" = ${docType}
      RETURNING prefix, padding, "nextValue" - 1 AS "nextValue", suffix
    `;

    const series = rows[0];
    if (!series) {
      throw new InternalServerErrorException(
        `No number series configured for document type "${docType}". ` +
          'Add one under Administration > Number Series.',
      );
    }

    const body = String(series.nextValue).padStart(series.padding, '0');
    return `${series.prefix}${body}${series.suffix ?? ''}`;
  }
}
