import type { DayKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day key, e.g. 2026-10-13. */
export function dayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse a day key as local midnight. */
export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function shiftDayKey(key: DayKey, days: number): DayKey {
  return dayKey(addDays(parseDayKey(key), days));
}

/** Number of calendar days between two keys (b - a). DST-safe. */
export function daysBetween(a: DayKey, b: DayKey): number {
  const da = parseDayKey(a);
  const db = parseDayKey(b);
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

/** Monday of the week containing `date` (ISO week). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - weekday);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export const isValidDayKey = (key: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(key) && dayKey(parseDayKey(key)) === key;
