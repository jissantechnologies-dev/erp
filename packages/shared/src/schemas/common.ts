import { z } from 'zod';

/** Shared query envelope for every list endpoint; mirrors the design's
 *  toolbar (search + selects) and `foot()` pager. */
export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().max(60).optional(),
  dir: z.enum(['asc', 'desc']).default('asc'),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export type Paginated<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  /** status -> count, drives the design's filter `chips` row. */
  facets?: Record<string, number>;
};

export const idParam = z.object({ id: z.string().min(1) });

/** A required text field, with the design's "Fields marked * are required". */
export const req = (label: string, max = 160) =>
  z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);

export const opt = (max = 160) => z.string().trim().max(max).optional().or(z.literal(''));

/** Weights/quantities arrive from text inputs that may carry en-IN grouping. */
export const decimalFromInput = (label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.replace(/,/g, '').trim() : v),
    z.coerce.number({ invalid_type_error: `${label} must be a number` }).nonnegative(),
  );
