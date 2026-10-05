import type { ListQuery, Paginated } from '@erp/shared';

/** Prisma delegate surface we need; keeps `paginate` model-agnostic. */
type Delegate<TRow> = {
  findMany: (args: Record<string, unknown>) => Promise<TRow[]>;
  count: (args: Record<string, unknown>) => Promise<number>;
  groupBy: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
};

export type PaginateOptions<TRow> = {
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
  /** Default ordering when the query supplies no `sort`. */
  defaultSort?: Record<string, 'asc' | 'desc'>;
  /** Columns the client is allowed to sort by, guarding against injection
   *  of arbitrary field names into orderBy. */
  sortable?: readonly string[];
  /** Field to group by for the design's filter chips (usually "status"). */
  facetField?: string;
  mapRow?: (row: TRow) => unknown;
};

/**
 * One list-endpoint implementation for every register screen: page, sort,
 * total and the status counts that drive the design's `chips` row.
 *
 * The count and the page are fetched in parallel; on a tenant-scoped delegate
 * the tenantId filter is already injected by the Prisma extension.
 */
export async function paginate<TRow>(
  delegate: Delegate<TRow>,
  query: ListQuery,
  opts: PaginateOptions<TRow> = {},
): Promise<Paginated<unknown>> {
  const { page, pageSize, sort, dir } = query;
  const where = opts.where ?? {};

  const orderBy =
    sort && opts.sortable?.includes(sort)
      ? { [sort]: dir }
      : (opts.defaultSort ?? { createdAt: 'desc' as const });

  const [rows, total, facetRows] = await Promise.all([
    delegate.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...(opts.include ? { include: opts.include } : {}),
      ...(opts.select ? { select: opts.select } : {}),
    }),
    delegate.count({ where }),
    opts.facetField
      // Facets deliberately ignore the facet field's own filter, so the chips
      // keep showing every status's count once one chip is selected.
      ? delegate.groupBy({
          by: [opts.facetField],
          where: Object.fromEntries(
            Object.entries(where).filter(([k]) => k !== opts.facetField),
          ),
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const facets = opts.facetField
    ? Object.fromEntries(
        facetRows.map((r) => [
          String(r[opts.facetField as string]),
          (r._count as { _all: number })._all,
        ]),
      )
    : undefined;

  return {
    rows: opts.mapRow ? rows.map(opts.mapRow) : rows,
    total,
    page,
    pageSize,
    ...(facets ? { facets } : {}),
  };
}

/** Case-insensitive "contains" across several columns, for the toolbar search. */
export const searchAcross = (
  q: string | undefined,
  fields: readonly string[],
): Record<string, unknown> | undefined =>
  q?.trim()
    ? { OR: fields.map((f) => ({ [f]: { contains: q.trim(), mode: 'insensitive' } })) }
    : undefined;

/** Drops undefined keys so Prisma does not see `{ status: undefined }`. */
export const compact = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
