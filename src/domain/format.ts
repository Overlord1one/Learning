import { CENTS_PER_CREDIT } from './economy';

const creditFmt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const oneDecimalFmt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const euroFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** 1500 → "15", 750 → "7,5", 123456 → "1.234,56" */
export const formatCredits = (cents: number) => creditFmt.format(cents / CENTS_PER_CREDIT);
export const formatSC = (cents: number) => `${formatCredits(cents)} SC`;
export const formatInt = (n: number) => intFmt.format(n);
export const formatDecimal = (n: number) => oneDecimalFmt.format(n);
export const formatEuro = (cents: number) => euroFmt.format(cents / 100);

/** Subject weighting: 125 → "×1,25" */
export const formatWeight = (percent: number) => `×${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(percent / 100)}`;

/** 95 → "1 Std. 35 Min.", 45 → "45 Min." */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} Std.` : `${h} Std. ${rest} Min.`;
}

/** 95 → "1,6 h" */
export const formatHours = (minutes: number) => `${oneDecimalFmt.format(minutes / 60)} h`;

/** Hours with up to 2 decimals – used for study requirements (17,5 h). */
export const formatHoursPrecise = (minutes: number) =>
  `${creditFmt.format(Math.round((minutes / 60) * 100) / 100)} h`;

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' });
const longDateFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

export const formatDate = (d: Date) => dateFmt.format(d);
export const formatShortDate = (d: Date) => shortDateFmt.format(d);
export const formatLongDate = (d: Date) => longDateFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d);

/** Parse German or plain decimal input ("7,5" / "7.5") into a number. */
export function parseDecimal(input: string): number {
  const normalized = input.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (normalized === '') return NaN;
  return Number(normalized);
}

/** "7,5" SC → 750 centi credits (rounded to whole cents). */
export function parseCreditsInput(input: string): number {
  const n = parseDecimal(input);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * CENTS_PER_CREDIT);
}
