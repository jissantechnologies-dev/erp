import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getTenantContext } from './tenant-context';

/**
 * Models that carry a `tenantId` column and must therefore be scoped on every
 * query. Kept as an explicit list (not inferred) so that adding a tenant-owned
 * model without scoping it is a deliberate act, and so `TENANT_MODELS` can be
 * asserted against the Prisma DMMF in a test.
 */
export const TENANT_MODELS = new Set<string>([
  'Plant', 'User', 'Role', 'NumberSeries', 'Customer', 'Alloy', 'Part',
  'Drawing', 'Tool', 'PartMapping', 'Attachment', 'AuditLog',
]);

/** Read operations get a filter injected; writes get the tenantId stamped on. */
const READ_OPS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
  'findMany', 'count', 'aggregate', 'groupBy',
]);
const WRITE_MANY_OPS = new Set(['updateMany', 'deleteMany']);
const CREATE_OPS = new Set(['create', 'createMany']);
const SINGLE_WRITE_OPS = new Set(['update', 'delete', 'upsert']);

/**
 * Tenant-scoped Prisma client.
 *
 * The extension below is the primary guarantee that one tenant can never read
 * or write another's rows. Postgres RLS (prisma/rls.sql) is the second line of
 * defence in case a raw query bypasses this layer.
 *
 * Deliberate limitation: `$queryRaw` / `$executeRaw` are NOT scoped here —
 * raw SQL must filter by tenant itself, and RLS covers the mistake.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * The tenant-scoped client. Services inject PrismaService and use
   * `this.prisma.scoped.part.findMany(...)` — the tenant filter is automatic.
   */
  get scoped() {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_MODELS.has(model)) return query(args);

            const ctx = getTenantContext();
            if (!ctx) {
              throw new Error(
                `Tenant-scoped query on ${model}.${operation} ran without tenant context.`,
              );
            }
            const { tenantId } = ctx;
            const a = args as Record<string, unknown>;

            // Relies on Prisma's extendedWhereUnique (GA since v5): a
            // findUnique/update/delete `where` may carry non-unique filters
            // alongside the unique one, so injecting tenantId is valid and the
            // database itself returns "not found" for another tenant's row.
            if (READ_OPS.has(operation) || WRITE_MANY_OPS.has(operation)) {
              a.where = { ...((a.where as object) ?? {}), tenantId };
              return query(a);
            }

            if (CREATE_OPS.has(operation)) {
              if (operation === 'createMany') {
                const data = (a.data ?? []) as Record<string, unknown>[];
                a.data = (Array.isArray(data) ? data : [data]).map((d) => ({ ...d, tenantId }));
              } else {
                a.data = { ...((a.data as object) ?? {}), tenantId };
              }
              return query(a);
            }

            if (SINGLE_WRITE_OPS.has(operation)) {
              // Scope the row being written, and stamp tenantId on any create
              // branch of an upsert.
              a.where = { ...((a.where as object) ?? {}), tenantId };
              if (operation === 'upsert' && a.create) {
                a.create = { ...(a.create as object), tenantId };
              }
              return query(a);
            }

            return query(args);
          },
        },
      },
    });
  }

  /** Cached so each access does not build a fresh extended client. */
  private unscopedClient?: PrismaClient;

  /**
   * Escape hatch for genuinely cross-tenant work (login by email, tenant
   * provisioning, background jobs that iterate tenants). Named loudly so it is
   * obvious in review when scoping has been skipped.
   *
   * Returns `this.$extends({})` rather than `this`: Prisma wraps the client in
   * a Proxy that materialises the model delegates, and `this` inside a class
   * getter is the raw target, which has no `.user`, `.part` and so on. An empty
   * extension gives back a correctly proxied client that adds no behaviour.
   */
  get unscoped(): PrismaClient {
    this.unscopedClient ??= this.$extends({}) as unknown as PrismaClient;
    return this.unscopedClient;
  }

  /** Sets the Postgres session variable that RLS policies read. */
  async withRlsTenant<T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, tenantId);
      return fn(tx);
    });
  }
}
