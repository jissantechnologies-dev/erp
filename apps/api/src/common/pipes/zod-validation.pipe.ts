import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, type ZodSchema } from 'zod';

/**
 * Validates a body/query against a Zod schema from @erp/shared — the same
 * schema the web form uses, so client and server validation cannot drift.
 *
 * Errors come back shaped as { field: message } so the web app can drop them
 * straight onto the matching inputs (the design's `.f.err` styling).
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.join('.') || '_';
          fieldErrors[key] ??= issue.message;
        }
        throw new BadRequestException({
          message: 'Please correct the highlighted fields',
          fieldErrors,
        });
      }
      throw err;
    }
  }
}

/** Convenience factory: `@Body(zodBody(partSchema)) dto: PartInput`. */
export const zodBody = <T>(schema: ZodSchema<T>) => new ZodValidationPipe(schema);
