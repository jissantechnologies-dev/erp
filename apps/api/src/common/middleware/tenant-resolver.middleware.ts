import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

/**
 * Determines which workspace a request is aimed at, before auth runs.
 *
 *  - TENANT_STRATEGY=subdomain -> "indus.erp.app" resolves to slug "indus"
 *  - TENANT_STRATEGY=header    -> the X-Tenant header (used in local dev,
 *                                 where there are no subdomains)
 *
 * This only records the *claimed* tenant on the request. JwtAuthGuard checks it
 * against the token, so a claim alone grants nothing.
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  private readonly strategy: string;
  private static readonly RESERVED = new Set(['www', 'app', 'api', 'admin', 'static', 'cdn']);

  constructor(config: ConfigService) {
    this.strategy = config.get<string>('TENANT_STRATEGY') ?? 'header';
  }

  use(req: Request & { resolvedTenantSlug?: string }, _res: Response, next: NextFunction): void {
    if (this.strategy === 'subdomain') {
      const host = (req.hostname ?? '').toLowerCase();
      const [first, ...rest] = host.split('.');
      // Need at least sub.domain.tld, and the label must not be reserved.
      if (rest.length >= 2 && first && !TenantResolverMiddleware.RESERVED.has(first)) {
        req.resolvedTenantSlug = first;
      }
    } else {
      const header = req.headers['x-tenant'];
      if (typeof header === 'string' && header.trim()) {
        req.resolvedTenantSlug = header.trim().toLowerCase();
      }
    }
    next();
  }
}
