import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStorage } from '../../prisma/tenant-context';

/**
 * Bridges the request to AsyncLocalStorage so the Prisma extension can read the
 * tenant without it being threaded through every call.
 *
 * Note the `tenantStorage.run(...)` wraps the *subscription*, not just the call
 * to `next.handle()`, because the handler's work happens inside the returned
 * Observable — running only the synchronous call would lose the context.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp().getRequest().tenantContext;
    if (!ctx) return next.handle();

    return new Observable((subscriber) =>
      tenantStorage.run(ctx, () =>
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        }),
      ),
    );
  }
}
