/** Derived statistics. Everything here is computed from authoritative records. */
import {
  balanceCents,
  levelForXp,
  minutesToEarn,
  sessionCredits,
  sessionXp,
  totalXp,
} from './economy';
import { addDays, dayKey, daysBetween, parseDayKey, shiftDayKey, startOfMonth, startOfWeek } from './dates';
import { activePurchaseFor } from './commands';
import type { AppData, DayKey, Reward, RewardPurchase, StudySession } from './types';

// ---------------------------------------------------------------------------
// Study time
// ---------------------------------------------------------------------------

export function minutesByDay(sessions: readonly StudySession[]): Map<DayKey, number> {
  const map = new Map<DayKey, number>();
  for (const s of sessions) map.set(s.date, (map.get(s.date) ?? 0) + s.minutes);
  return map;
}

export function minutesBetween(sessions: readonly StudySession[], from: DayKey, to: DayKey): number {
  let sum = 0;
  for (const s of sessions) if (s.date >= from && s.date <= to) sum += s.minutes;
  return sum;
}

/** Consecutive study days ending today – or yesterday, so a streak isn't lost before today's session. */
export function currentStreak(sessions: readonly StudySession[], now: Date): number {
  const days = minutesByDay(sessions);
  let cursor = dayKey(now);
  if (!days.has(cursor)) cursor = shiftDayKey(cursor, -1);
  let streak = 0;
  while ((days.get(cursor) ?? 0) > 0) {
    streak++;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

export function longestStreak(sessions: readonly StudySession[]): number {
  const days = [...minutesByDay(sessions).keys()].sort();
  let best = 0;
  let run = 0;
  let prev: DayKey | null = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface StudyStats {
  totalMinutes: number;
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  averageDailyMinutes: number;
  longestSessionMinutes: number;
  sessionCount: number;
  streak: number;
  bestStreak: number;
  activeDays: number;
}

export function studyStats(sessions: readonly StudySession[], now: Date): StudyStats {
  const today = dayKey(now);
  const totalMinutes = sessions.reduce((a, s) => a + s.minutes, 0);
  const firstDay = sessions.reduce<DayKey | null>((min, s) => (min === null || s.date < min ? s.date : min), null);
  const spanDays = firstDay ? daysBetween(firstDay, today) + 1 : 0;
  return {
    totalMinutes,
    todayMinutes: minutesBetween(sessions, today, today),
    weekMinutes: minutesBetween(sessions, dayKey(startOfWeek(now)), today),
    monthMinutes: minutesBetween(sessions, dayKey(startOfMonth(now)), today),
    averageDailyMinutes: spanDays > 0 ? totalMinutes / spanDays : 0,
    longestSessionMinutes: sessions.reduce((a, s) => Math.max(a, s.minutes), 0),
    sessionCount: sessions.length,
    streak: currentStreak(sessions, now),
    bestStreak: longestStreak(sessions),
    activeDays: minutesByDay(sessions).size,
  };
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export interface PlayerSnapshot {
  balanceCents: number;
  xp: number;
  level: number;
}

export function playerSnapshot(data: AppData): PlayerSnapshot {
  const xp = totalXp(data.sessions);
  return { balanceCents: balanceCents(data.transactions), xp, level: levelForXp(xp) };
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export type RewardStatus = 'gesperrt' | 'freischaltbar' | 'freigeschaltet' | 'vorhanden';

export const REWARD_STATUS_LABEL: Record<RewardStatus, string> = {
  gesperrt: 'Gesperrt',
  freischaltbar: 'Freischaltbar',
  freigeschaltet: 'Freigeschaltet',
  vorhanden: 'Bereits vorhanden',
};

export interface RewardProgress {
  reward: Reward;
  status: RewardStatus;
  purchase: RewardPurchase | null;
  /** 0 … 1 */
  ratio: number;
  missingCents: number;
  /** Focused study minutes still required at the current rate. */
  minutesNeeded: number;
  /** Study minutes the full price represents from zero. */
  minutesFromZero: number;
}

export function rewardProgress(data: AppData, reward: Reward, balance = balanceCents(data.transactions)): RewardProgress {
  const rates = data.settings.rates;
  const purchase = activePurchaseFor(data, reward.id);
  const minutesFromZero = minutesToEarn(reward.priceCents, rates);
  if (reward.preOwned) {
    return { reward, status: 'vorhanden', purchase: null, ratio: 1, missingCents: 0, minutesNeeded: 0, minutesFromZero };
  }
  if (purchase) {
    return { reward, status: 'freigeschaltet', purchase, ratio: 1, missingCents: 0, minutesNeeded: 0, minutesFromZero };
  }
  const missingCents = Math.max(0, reward.priceCents - balance);
  return {
    reward,
    status: missingCents === 0 ? 'freischaltbar' : 'gesperrt',
    purchase: null,
    ratio: reward.priceCents > 0 ? Math.min(1, Math.max(0, balance) / reward.priceCents) : 1,
    missingCents,
    minutesNeeded: minutesToEarn(missingCents, rates),
    minutesFromZero,
  };
}

export function shopRewards(data: AppData): Reward[] {
  return data.rewards.filter((r) => !r.archived && !r.preOwned).sort((a, b) => a.sortOrder - b.sortOrder);
}

export interface InventoryItem {
  reward: Reward;
  purchase: RewardPurchase | null;
}

export function inventory(data: AppData): InventoryItem[] {
  const items: InventoryItem[] = [];
  for (const r of data.rewards) {
    if (r.preOwned && !r.archived) items.push({ reward: r, purchase: null });
  }
  const active = data.purchases.filter((p) => p.refundedAt === null).sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt));
  for (const p of active) {
    const reward = data.rewards.find((r) => r.id === p.rewardId);
    if (reward) items.push({ reward, purchase: p });
  }
  return items;
}

/** Rewards that became affordable between two balances (and are not yet unlocked). */
export function newlyAffordable(data: AppData, before: number, after: number): Reward[] {
  return shopRewards(data).filter(
    (r) => !activePurchaseFor(data, r.id) && r.priceCents > before && r.priceCents <= after,
  );
}

export function goalReward(data: AppData): Reward | null {
  const id = data.settings.goalRewardId;
  const goal = id ? data.rewards.find((r) => r.id === id && !r.archived && !r.preOwned) : undefined;
  if (goal && !activePurchaseFor(data, goal.id)) return goal;
  // Fall back to the cheapest reward that is still locked.
  const open = shopRewards(data).filter((r) => !activePurchaseFor(data, r.id));
  return open.sort((a, b) => a.priceCents - b.priceCents)[0] ?? goal ?? null;
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

export const PROJECTION_WINDOW_DAYS = 14;
export const PROJECTION_MIN_ACTIVE_DAYS = 3;

export type Projection =
  | { kind: 'reached' }
  | { kind: 'insufficient'; activeDays: number }
  | { kind: 'estimate'; averageDailyMinutes: number; days: number; date: Date };

/**
 * Estimate when `minutesNeeded` will be studied, based on the recent average.
 * Requires a minimum amount of history – otherwise no date is invented.
 */
export function projectCompletion(sessions: readonly StudySession[], minutesNeeded: number, now: Date): Projection {
  if (minutesNeeded <= 0) return { kind: 'reached' };
  const today = dayKey(now);
  const from = shiftDayKey(today, -(PROJECTION_WINDOW_DAYS - 1));
  const recent = sessions.filter((s) => s.date >= from && s.date <= today);
  const activeDays = new Set(recent.map((s) => s.date)).size;
  if (activeDays < PROJECTION_MIN_ACTIVE_DAYS) return { kind: 'insufficient', activeDays };
  const averageDailyMinutes = recent.reduce((a, s) => a + s.minutes, 0) / PROJECTION_WINDOW_DAYS;
  const days = Math.ceil(minutesNeeded / averageDailyMinutes);
  return { kind: 'estimate', averageDailyMinutes, days, date: addDays(parseDayKey(today), days) };
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

export type ActivityItem =
  | { kind: 'session'; id: string; at: string; session: StudySession; credits: number; xp: number }
  | { kind: 'purchase'; id: string; at: string; name: string; priceCents: number }
  | { kind: 'refund'; id: string; at: string; name: string; priceCents: number }
  | { kind: 'levelup'; id: string; at: string; level: number };

export function activityFeed(data: AppData, limit = 8): ActivityItem[] {
  const items: ActivityItem[] = [];
  // Level-ups are reconstructed from sessions in the order they were recorded.
  const ordered = [...data.sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let xp = 0;
  for (const s of ordered) {
    const before = levelForXp(xp);
    xp += sessionXp(s);
    const after = levelForXp(xp);
    items.push({ kind: 'session', id: s.id, at: s.createdAt, session: s, credits: sessionCredits(s), xp: sessionXp(s) });
    for (let l = before + 1; l <= after; l++) items.push({ kind: 'levelup', id: `lvl-${s.id}-${l}`, at: s.createdAt, level: l });
  }
  for (const p of data.purchases) {
    items.push({ kind: 'purchase', id: p.id, at: p.unlockedAt, name: p.rewardName, priceCents: p.priceCents });
    if (p.refundedAt) items.push({ kind: 'refund', id: `ref-${p.id}`, at: p.refundedAt, name: p.rewardName, priceCents: p.priceCents });
  }
  // Newest first; a level-up is shown above the session that caused it.
  const rank = (i: ActivityItem) => (i.kind === 'levelup' ? 1 : 0);
  return items.sort((a, b) => b.at.localeCompare(a.at) || rank(b) - rank(a)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Chart series
// ---------------------------------------------------------------------------

export type RangeKey = '7' | '30' | '90' | 'all';

export function rangeStart(range: RangeKey, sessions: readonly StudySession[], now: Date): DayKey {
  const today = dayKey(now);
  if (range !== 'all') return shiftDayKey(today, -(Number(range) - 1));
  const first = sessions.reduce<DayKey | null>((min, s) => (min === null || s.date < min ? s.date : min), null);
  // Show at least a week so the chart never collapses to a single bar.
  const weekAgo = shiftDayKey(today, -6);
  return first && first < weekAgo ? first : weekAgo;
}

export interface DailyPoint {
  day: DayKey;
  minutes: number;
  hours: number;
}

export function dailySeries(sessions: readonly StudySession[], from: DayKey, to: DayKey): DailyPoint[] {
  const byDay = minutesByDay(sessions);
  const out: DailyPoint[] = [];
  for (let d = from; d <= to; d = shiftDayKey(d, 1)) {
    const minutes = byDay.get(d) ?? 0;
    out.push({ day: d, minutes, hours: minutes / 60 });
  }
  return out;
}

export interface BucketPoint {
  key: string;
  label: string;
  hours: number;
}

export function weeklySeries(sessions: readonly StudySession[], from: DayKey, to: DayKey): BucketPoint[] {
  const out: BucketPoint[] = [];
  let cursor = startOfWeek(parseDayKey(from));
  const end = parseDayKey(to);
  while (cursor <= end) {
    const start = dayKey(cursor);
    const stop = dayKey(addDays(cursor, 6));
    const minutes = minutesBetween(sessions, start < from ? from : start, stop > to ? to : stop);
    out.push({ key: start, label: `KW ${isoWeek(cursor)}`, hours: minutes / 60 });
    cursor = addDays(cursor, 7);
  }
  return out;
}

export function monthlySeries(sessions: readonly StudySession[], from: DayKey, to: DayKey): BucketPoint[] {
  const out: BucketPoint[] = [];
  const fmt = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' });
  let cursor = startOfMonth(parseDayKey(from));
  const end = parseDayKey(to);
  while (cursor <= end) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const start = dayKey(cursor);
    const stop = dayKey(addDays(next, -1));
    const minutes = minutesBetween(sessions, start < from ? from : start, stop > to ? to : stop);
    out.push({ key: start, label: fmt.format(cursor), hours: minutes / 60 });
    cursor = next;
  }
  return out;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export interface XpPoint {
  day: DayKey;
  xp: number;
  level: number;
}

/** Cumulative XP at the end of each day in the range (by study date). */
export function xpSeries(sessions: readonly StudySession[], from: DayKey, to: DayKey): XpPoint[] {
  const xpByDay = new Map<DayKey, number>();
  let base = 0;
  for (const s of sessions) {
    if (s.date < from) base += sessionXp(s);
    else xpByDay.set(s.date, (xpByDay.get(s.date) ?? 0) + sessionXp(s));
  }
  const out: XpPoint[] = [];
  let running = base;
  for (let d = from; d <= to; d = shiftDayKey(d, 1)) {
    running += xpByDay.get(d) ?? 0;
    out.push({ day: d, xp: running, level: levelForXp(running) });
  }
  return out;
}

export interface CreditFlowPoint {
  key: string;
  label: string;
  earned: number;
  spent: number;
}

/** Credits earned vs. spent per bucket, based on ledger timestamps. */
export function creditFlowSeries(data: AppData, from: DayKey, to: DayKey, bucket: 'day' | 'week'): CreditFlowPoint[] {
  const buckets = new Map<string, CreditFlowPoint>();
  const fmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
  const keyFor = (d: DayKey) => (bucket === 'day' ? d : dayKey(startOfWeek(parseDayKey(d))));
  for (let d = from; d <= to; d = shiftDayKey(d, 1)) {
    const k = keyFor(d);
    if (!buckets.has(k)) {
      const label = bucket === 'day' ? fmt.format(parseDayKey(d)) : `KW ${isoWeek(parseDayKey(k))}`;
      buckets.set(k, { key: k, label, earned: 0, spent: 0 });
    }
  }
  for (const t of data.transactions) {
    const d = dayKey(new Date(t.createdAt));
    if (d < from || d > to) continue;
    const point = buckets.get(keyFor(d));
    if (!point) continue;
    const sc = t.amountCents / 100;
    if (t.type === 'purchase' || t.type === 'refund') point.spent -= sc;
    else point.earned += sc;
  }
  return [...buckets.values()];
}

export interface CategorySlice {
  id: string;
  name: string;
  color: string;
  minutes: number;
}

export function categoryBreakdown(data: AppData, from: DayKey, to: DayKey): CategorySlice[] {
  const map = new Map<string, number>();
  for (const s of data.sessions) {
    if (s.date >= from && s.date <= to) map.set(s.categoryId, (map.get(s.categoryId) ?? 0) + s.minutes);
  }
  return [...map.entries()]
    .map(([id, minutes]) => {
      const c = data.categories.find((x) => x.id === id);
      return { id, minutes, name: c?.name ?? 'Unbekannt', color: c?.color ?? '#8A93A3' };
    })
    .sort((a, b) => b.minutes - a.minutes);
}
