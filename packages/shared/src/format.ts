/**
 * en-IN formatting helpers. The design renders quantities with Indian
 * grouping and money as "₹ 11,47,500" / "₹ 52.4 L", so these live in shared
 * and are used by both the API (exports, PDFs) and the web app.
 */

export const nf = new Intl.NumberFormat('en-IN');

export const qty = (n: number | null | undefined): string => (n == null ? '—' : nf.format(n));

/** Money is stored in paise; render as whole rupees with en-IN grouping. */
export const rupees = (paise: number | null | undefined): string =>
  paise == null ? '—' : `₹ ${nf.format(Math.round(paise / 100))}`;

/** Compact lakh form used in dashboard tiles: 5240000 paise -> "₹ 52.4 L". */
export const lakhs = (paise: number | null | undefined, digits = 1): string =>
  paise == null ? '—' : `₹ ${(paise / 100 / 100_000).toFixed(digits)} L`;

export const kg = (n: number | null | undefined, digits = 1): string =>
  n == null ? '—' : `${n.toFixed(digits)} kg`;

export const pct = (n: number | null | undefined, digits = 1): string =>
  n == null ? '—' : `${n.toFixed(digits)} %`;

/** The design's date format throughout: "05-Oct-2026". */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const shortDate = (d: Date | string | null | undefined): string => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return `${String(dt.getDate()).padStart(2, '0')}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
};

/** Casting yield — the ratio the Part Master shows read-only. */
export const yieldPct = (castingWeightKg: number, pouredWeightKg: number): number | null =>
  pouredWeightKg > 0 ? (castingWeightKg / pouredWeightKg) * 100 : null;

/** Tool life bar colour thresholds, ported from `lifeBar()` in the prototype. */
export const lifeBarTone = (usedShots: number, lifeShots: number) => {
  const p = lifeShots > 0 ? Math.min(100, Math.round((usedShots / lifeShots) * 100)) : 0;
  const tone = p >= 100 ? 'var(--fg-3)' : p >= 85 ? 'var(--bad)' : p >= 60 ? 'var(--warn)' : 'var(--ok)';
  return { pct: p, tone };
};
