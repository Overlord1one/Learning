import type { CreditTransaction, RateSnapshot, RewardWallet, StudySession, Wallet } from './types';

export const CENTS_PER_CREDIT = 100;
/** XP needed for level 2. Every further level needs 300 XP more than the previous one. */
export const XP_PER_LEVEL = 300;
export const MAX_SESSION_MINUTES = 24 * 60;

/** 16 SC per hour at ×1 – one hour of math (×1,5) is 24 SC ≈ 6 € at ~4 SC per euro. */
export const DEFAULT_RATES: RateSnapshot = {
  creditCentsPerHour: 16 * CENTS_PER_CREDIT,
  xpPerHour: 60,
  /** 16 KC per hour of video editing – a ~300 € monitor (1.200 KC) takes ~75 h. */
  creativeCentsPerHour: 16 * CENTS_PER_CREDIT,
};

/** Integer division with round-half-up – deterministic for positive inputs. */
function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}

/**
 * Centi credits earned for a number of focused minutes, optionally weighted by
 * subject priority. 90 min @ 10 SC/h → 1500; with 120 % weighting → 1800.
 */
export function creditsForMinutes(minutes: number, rates: RateSnapshot, weightPercent = 100): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return roundDiv(Math.round(minutes) * rates.creditCentsPerHour * weightPercent, 60 * 100);
}

/** XP earned for a number of focused minutes. 90 min @ 60 XP/h → 90; with 120 % → 108. */
export function xpForMinutes(minutes: number, rates: RateSnapshot, weightPercent = 100): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return roundDiv(Math.round(minutes) * rates.xpPerHour * weightPercent, 60 * 100);
}

/** Kreativ-Credits for minutes in a creative subject – not weighted. */
export function creativeCreditsForMinutes(minutes: number, rates: RateSnapshot): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return roundDiv(Math.round(minutes) * rates.creativeCentsPerHour, 60);
}

export const sessionCredits = (s: StudySession) => creditsForMinutes(s.minutes, s.rates, s.weightPercent);
export const sessionCreativeCredits = (s: StudySession) => (s.creative ? creativeCreditsForMinutes(s.minutes, s.rates) : 0);
/** Credits a session is worth on the given account. */
export const sessionWalletCredits = (s: StudySession, wallet: Wallet) => (wallet === 'main' ? sessionCredits(s) : sessionCreativeCredits(s));
export const sessionXp = (s: StudySession) => xpForMinutes(s.minutes, s.rates, s.weightPercent);

/** Current spendable balance of one account – the single source of truth is the ledger. */
export function balanceCents(transactions: readonly CreditTransaction[], wallet: Wallet = 'main'): number {
  let sum = 0;
  for (const t of transactions) if (t.wallet === wallet) sum += t.amountCents;
  return sum;
}

export function totalXp(sessions: readonly StudySession[]): number {
  let sum = 0;
  for (const s of sessions) sum += sessionXp(s);
  return sum;
}

/** Credits earned through studying (net of edits / deletions). */
/** Spendable credits for a reward: one account, or SC + KC combined. */
export function rewardBalance(transactions: readonly CreditTransaction[], wallet: RewardWallet): number {
  return wallet === 'both' ? balanceCents(transactions, 'main') + balanceCents(transactions, 'creative') : balanceCents(transactions, wallet);
}

export function earnedCents(transactions: readonly CreditTransaction[], wallet: Wallet = 'main'): number {
  let sum = 0;
  for (const t of transactions) {
    if (t.wallet !== wallet) continue;
    if (t.type === 'session_earn' || t.type === 'session_adjust' || t.type === 'session_revoke') {
      sum += t.amountCents;
    }
  }
  return sum;
}

/** Credits spent on rewards (net of refunds). */
export function spentCents(transactions: readonly CreditTransaction[], wallet: Wallet = 'main'): number {
  let sum = 0;
  for (const t of transactions) {
    if (t.wallet !== wallet) continue;
    if (t.type === 'purchase' || t.type === 'refund') sum -= t.amountCents;
  }
  return sum;
}

/**
 * Minutes of focused study still needed to earn `missingCents` at the
 * given rate. Rounded up – you can't earn a fraction of a minute.
 */
export function minutesToEarn(missingCents: number, rates: RateSnapshot, wallet: RewardWallet = 'main'): number {
  if (missingCents <= 0) return 0;
  // Rewards paid from both accounts are estimated with the Setup Credit rate.
  const rate = wallet !== 'creative' ? rates.creditCentsPerHour : rates.creativeCentsPerHour;
  if (rate <= 0) return Infinity;
  const earn = (m: number) => (wallet !== 'creative' ? creditsForMinutes(m, rates) : creativeCreditsForMinutes(m, rates));
  let minutes = Math.ceil((missingCents * 60) / rate);
  // Guard against rounding: make sure those minutes really earn enough.
  while (earn(minutes) < missingCents) minutes++;
  return minutes;
}

// ---------------------------------------------------------------------------
// Levels & ranks
// ---------------------------------------------------------------------------

/**
 * Total XP needed to reach a level. The curve rises: level 2 needs 300 XP,
 * level 3 another 600, level 4 another 900 … so early levels come quickly and
 * later ranks take real commitment. Level L starts at 150 · L · (L − 1) XP.
 */
export const xpForLevel = (level: number) => (XP_PER_LEVEL / 2) * Math.max(0, level - 1) * Math.max(1, level);

export function levelForXp(xp: number): number {
  const total = Math.max(0, xp);
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * total) / XP_PER_LEVEL)) / 2));
  // Correct possible floating point drift around exact thresholds.
  while (xpForLevel(level + 1) <= total) level++;
  while (level > 1 && xpForLevel(level) > total) level--;
  return level;
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
  const levelStartXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - levelStartXp;
  const xpIntoLevel = Math.max(0, xp) - levelStartXp;
  return {
    level,
    xpIntoLevel,
    xpForLevel: span,
    xpToNext: nextLevelXp - Math.max(0, xp),
    ratio: xpIntoLevel / span,
    levelStartXp,
    nextLevelXp,
  };
}

