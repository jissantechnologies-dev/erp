import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { can, type Permission, type JwtPayload } from '@erp/shared';
import { PERMISSIONS_KEY, PUBLIC_KEY } from '../decorators/permissions.decorator';
import type { TenantContext } from '../../prisma/tenant-context';

/**
 * Verifies the access token, builds the TenantContext and enforces the
 * permissions declared by @RequirePermissions. The context is attached to the
 * request; TenantContextInterceptor then puts it into AsyncLocalStorage so
 * Prisma can scope queries.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Sign in to continue');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }

    // When the tenant is resolved from the subdomain, the token must agree with
    // it — otherwise a valid token for tenant A could be replayed against B.
    const hostTenant: string | undefined = req.resolvedTenantSlug;
    if (hostTenant && hostTenant !== payload.tenantSlug) {
      throw new ForbiddenException('This session does not belong to this workspace');
    }

    const ctx: TenantContext = {
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      userId: payload.sub,
      actorName: payload.email,
      permissions: payload.permissions ?? [],
      plantIds: payload.plantIds ?? [],
    };
    req.tenantContext = ctx;

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (required?.length) {
      const missing = required.filter((p) => !can(ctx.permissions, p));
      if (missing.length) {
        throw new ForbiddenException(
          `You do not have permission to do this (requires ${missing.join(', ')})`,
        );
      }
    }
    return true;
  }

  private extractToken(req: { headers: Record<string, string | undefined>; cookies?: Record<string, string> }): string | null {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return req.cookies?.access_token ?? null;
  }
}
