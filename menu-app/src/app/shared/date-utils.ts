/**
 * Calendar-date helpers. Use these instead of `toISOString().split('T')[0]`, which returns the
 * UTC date — in IST that is still "yesterday" between midnight and 05:30.
 */

/** Local calendar date as yyyy-MM-dd. */
export function toDateKey(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses yyyy-MM-dd as a local calendar date (`new Date('yyyy-MM-dd')` would parse it as UTC). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
