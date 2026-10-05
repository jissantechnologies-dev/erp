import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantContext = {
  tenantId: string;
  tenantSlug: string;
  userId?: string;
  actorName?: string;
  permissions: string[];
  plantIds: string[];
};

/**
 * Request-scoped tenant context. Held in AsyncLocalStorage rather than passed
 * down through every service signature, so the Prisma extension can reach it
 * without each query having to remember to carry a tenantId.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export const getTenantContext = (): TenantContext | undefined => tenantStorage.getStore();

/** Throws rather than returning undefined — a missing tenant is never safe. */
export function requireTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error(
      'No tenant context. A tenant-scoped query ran outside a request; ' +
        'wrap it in tenantStorage.run() (see SystemPrismaService for admin tasks).',
    );
  }
  return ctx;
}

export const runWithTenant = <T>(ctx: TenantContext, fn: () => T): T => tenantStorage.run(ctx, fn);
