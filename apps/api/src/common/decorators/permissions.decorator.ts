import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Permission } from '@erp/shared';
import type { TenantContext } from '../../prisma/tenant-context';

export const PERMISSIONS_KEY = 'erp:permissions';

/** Guards a route behind one or more permissions (all must be satisfied). */
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms);

export const PUBLIC_KEY = 'erp:public';
/** Opts a route out of auth entirely (login, register, health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Injects the resolved tenant/user context into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext =>
    ctx.switchToHttp().getRequest().tenantContext,
);
