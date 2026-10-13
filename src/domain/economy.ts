import type { CreditTransaction, RateSnapshot, StudySession } from './types';

export const CENTS_PER_CREDIT = 100;
export const XP_PER_LEVEL = 300;
export const MAX_SESSION_MINUTES = 24 * 60;

export const DEFAULT_RATES: RateSnapshot = {
  creditCentsPerHour: 10 * CENTS_PER_CREDIT,
  xpPerHour: 60,
};

/** Integer division with round-half-up – deterministic for positive inputs. */
function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}

/** Centi credits earned for a number of focused minutes. 90 min @ 10 SC/h → 1500. */
export function creditsForMinutes(minutes: number, rates: RateSnapshot): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return roundDiv(Math.round(minutes) * rates.creditCentsPerHour, 60);
}

/** XP earned for a number of focused minutes. 90 min @ 60 XP/h → 90. */
export function xpForMinutes(minutes: number, rates: RateSnapshot): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return roundDiv(Math.round(minutes) * rates.xpPerHour, 60);
}

export const sessionCredits = (s: StudySession) => creditsForMinutes(s.minutes, s.rates);
export const sessionXp = (s: StudySession) => xpForMinutes(s.minutes, s.rates);

/** Current spendable balance – the single source of truth is the ledger. */
export function balanceCents(transactions: readonly CreditTransaction[]): number {
  let sum = 0;
  for (const t of transactions) sum += t.amountCents;
  return sum;
}

export function totalXp(sessions: readonly StudySession[]): number {
  let sum = 0;
  for (const s of sessions) sum += sessionXp(s);
  return sum;
}

/** Credits earned through studying (net of edits / deletions). */
export function earnedCents(transactions: readonly CreditTransaction[]): number {
  let sum = 0;
  for (const t of transactions) {
    if (t.type === 'session_earn' || t.type === 'session_adjust' || t.type === 'session_revoke') {
      sum += t.amountCents;
    }
  }
  return sum;
}

/** Credits spent on rewards (net of refunds). */
export function spentCents(transactions: readonly CreditTransaction[]): number {
  let sum = 0;
  for (const t of transactions) {
    if (t.type === 'purchase' || t.type === 'refund') sum -= t.amountCents;
  }
  return sum;
}

/**
 * Minutes of focused study still needed to earn `missingCents` at the
 * given rate. Rounded up – you can't earn a fraction of a minute.
 */
export function minutesToEarn(missingCents: number, rates: RateSnapshot): number {
  if (missingCents <= 0) return 0;
  if (rates.creditCentsPerHour <= 0) return Infinity;
  let minutes = Math.ceil((missingCents * 60) / rates.creditCentsPerHour);
  // Guard against rounding: make sure those minutes really earn enough.
  while (creditsForMinutes(minutes, rates) < missingCents) minutes++;
  return minutes;
}

// ---------------------------------------------------------------------------
// Levels & ranks
// ---------------------------------------------------------------------------

export function levelForXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
  xpToNext: number;
  /** 0 … 1 */
  ratio: number;
  levelStartXp: number;
  nextLevelXp: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const levelStartXp = (level - 1) * XP_PER_LEVEL;
  const nextLevelXp = level * XP_PER_LEVEL;
  const xpIntoLevel = Math.max(0, xp) - levelStartXp;
  return {
    level,
    xpIntoLevel,
    xpForLevel: XP_PER_LEVEL,
    xpToNext: nextLevelXp - Math.max(0, xp),
    ratio: xpIntoLevel / XP_PER_LEVEL,
    levelStartXp,
    nextLevelXp,
  };
}

export const xpForLevel = (level: number) => (Math.max(1, level) - 1) * XP_PER_LEVEL;
