/**
 * The design (and therefore the shared Zod schemas and the API surface) speaks
 * in display strings — "Under Revision", "Maintenance Due". Postgres enums use
 * SCREAMING_SNAKE. Rather than leak the DB spelling into the UI or give up enum
 * constraints in the DB, every boundary passes through here.
 *
 * The transform is mechanical, so one pair of functions covers all of them and
 * there is no per-enum table to keep in sync.
 */

/** "Under Revision" -> "UNDER_REVISION"; "Machined & painted" -> "MACHINED_PAINTED". */
export const toDbEnum = <T extends string>(display: string): T =>
  display
    .trim()
    .toUpperCase()
    .replace(/[&/()]/g, ' ')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') as T;

/**
 * Reverses the transform by looking the value up in the canonical display list,
 * because the mapping is not reversible on its own ("MACHINED_PAINTED" cannot
 * be turned back into "Machined & painted" mechanically).
 */
export const fromDbEnum = <T extends string>(
  dbValue: string | null | undefined,
  displayValues: readonly T[],
): T | null => {
  if (!dbValue) return null;
  const match = displayValues.find((d) => toDbEnum(d) === dbValue);
  if (match) return match;
  // Should be unreachable; surfaces a schema/enum drift loudly rather than
  // silently rendering a blank cell.
  throw new Error(
    `Enum value "${dbValue}" has no display form in [${displayValues.join(', ')}]. ` +
      'The Prisma enum and the @erp/shared list have drifted apart.',
  );
};

/** Optional variant for nullable columns. */
export const fromDbEnumOrNull = <T extends string>(
  dbValue: string | null | undefined,
  displayValues: readonly T[],
): T | null => (dbValue == null ? null : fromDbEnum(dbValue, displayValues));

/** Maps an optional display value for use in a Prisma `where`. */
export const toDbEnumOrUndefined = <T extends string>(display: string | undefined): T | undefined =>
  display == null ? undefined : toDbEnum<T>(display);
