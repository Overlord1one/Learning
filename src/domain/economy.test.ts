import { describe, expect, it } from 'vitest';
import { createInitialData } from './defaults';
import {
  addSession,
  commitTimer,
  deleteSession,
  purchaseReward,
  refundPurchase,
  startTimer,
  pauseTimer,
  resumeTimer,
  updateSession,
  updateSettings,
} from './commands';
import { balanceCents, creditsForMinutes, levelForXp, minutesToEarn, totalXp, DEFAULT_RATES } from './economy';
import { goalReward, playerSnapshot, projectCompletion, rewardProgress, studyStats } from './stats';
import { evaluateAchievements } from './achievements';
import { validateAppData } from './schema';
import { rankForLevel, DEFAULT_RANKS } from './ranks';
import { reconcileTimer, timerElapsedMs } from './timer';
import { formatCredits } from './format';
import type { AppData } from './types';

const NOW = new Date(2026, 9, 13, 18, 0, 0);
const ctx = { now: NOW };

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

function log(data: AppData, minutes: number, date = '2026-10-13', id?: string): AppData {
  return unwrap(addSession(data, { id, categoryId: 'cat-cs50x', minutes, date, source: 'manual' }, ctx)).data;
}

describe('credit & XP formulas', () => {
  it.each([
    [30, 500, 30],
    [45, 750, 45],
    [60, 1000, 60],
    [90, 1500, 90],
    [120, 2000, 120],
  ])('%i minutes → %i centi credits and %i XP', (minutes, cents, xp) => {
    expect(creditsForMinutes(minutes, DEFAULT_RATES)).toBe(cents);
    const data = log(createInitialData(NOW), minutes);
    expect(balanceCents(data.transactions)).toBe(cents);
    expect(totalXp(data.sessions)).toBe(xp);
  });

  it('formats decimal credits in German', () => {
    expect(formatCredits(750)).toBe('7,5');
    expect(formatCredits(121500)).toBe('1.215');
  });

  it('levels every 300 XP', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(2700)).toBe(10);
    expect(levelForXp(4200)).toBe(15);
  });

  it('derives intermediate ranks consistently', () => {
    expect(rankForLevel(1, DEFAULT_RANKS)).toBe('Anfänger');
    expect(rankForLevel(5, DEFAULT_RANKS)).toBe('System Builder');
    expect(rankForLevel(7, DEFAULT_RANKS)).toBe('System Builder III');
    expect(rankForLevel(10, DEFAULT_RANKS)).toBe('Setup Architect');
    expect(rankForLevel(16, DEFAULT_RANKS)).toBe('Master Developer II');
  });

  it('computes study time needed for a reward', () => {
    expect(minutesToEarn(4000, DEFAULT_RATES)).toBe(240);
    expect(minutesToEarn(17500, DEFAULT_RATES)).toBe(1050);
    expect(minutesToEarn(15000, DEFAULT_RATES)).toBe(900); // 150 SC → 15 h
  });
});

describe('acceptance', () => {
  it('a brand-new user starts from zero with no invented history', () => {
    const data = createInitialData(NOW);
    const p = playerSnapshot(data);
    expect(p).toEqual({ balanceCents: 0, xp: 0, level: 1 });
    expect(data.sessions).toHaveLength(0);
    expect(data.transactions).toHaveLength(0);
    const shop = data.rewards.filter((r) => !r.preOwned);
    expect(shop).toHaveLength(5);
    expect(shop.every((r) => rewardProgress(data, r).status === 'gesperrt')).toBe(true);
    expect(shop.reduce((a, r) => a + r.priceCents, 0)).toBe(121500);
    expect(data.rewards.find((r) => r.preOwned)?.name).toMatch(/ROCCAT/);
    expect(evaluateAchievements(data, NOW).some((a) => a.unlocked)).toBe(false);
  });

  it('a 90 minute session earns exactly 15 SC and 90 XP', () => {
    const p = playerSnapshot(log(createInitialData(NOW), 90));
    expect(p.balanceCents).toBe(1500);
    expect(p.xp).toBe(90);
  });

  it('five hours grant 50 SC and level 2', () => {
    let data = createInitialData(NOW);
    for (let i = 0; i < 5; i++) data = log(data, 60, `2026-10-0${i + 1}`);
    const p = playerSnapshot(data);
    expect(p.balanceCents).toBe(5000);
    expect(p.level).toBe(2);
  });

  it('40 SC unlock the mousepad, deduct exactly 40 SC and leave XP untouched', () => {
    let data = log(createInitialData(NOW), 240);
    const before = playerSnapshot(data);
    expect(rewardProgress(data, data.rewards.find((r) => r.id === 'rw-mousepad')!).status).toBe('freischaltbar');
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    const after = playerSnapshot(data);
    expect(after.balanceCents).toBe(before.balanceCents - 4000);
    expect(after.xp).toBe(before.xp);
    expect(after.level).toBe(before.level);
    expect(rewardProgress(data, data.rewards.find((r) => r.id === 'rw-mousepad')!).status).toBe('freigeschaltet');
  });

  it('insufficient credits cannot unlock an item', () => {
    const data = log(createInitialData(NOW), 239);
    const r = purchaseReward(data, 'rw-mousepad', ctx);
    expect(r.ok).toBe(false);
  });

  it('cannot unlock the same reward twice', () => {
    let data = log(createInitialData(NOW), 600);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    expect(purchaseReward(data, 'rw-mousepad', ctx).ok).toBe(false);
  });

  it('pre-owned items cannot be bought', () => {
    const data = log(createInitialData(NOW), 600);
    expect(purchaseReward(data, 'rw-roccat', ctx).ok).toBe(false);
  });

  it('saving the same session twice does not duplicate rewards', () => {
    let data = log(createInitialData(NOW), 90, '2026-10-13', 'ses-fixed');
    const again = unwrap(addSession(data, { id: 'ses-fixed', categoryId: 'cat-cs50x', minutes: 90, date: '2026-10-13', source: 'manual' }, ctx));
    expect(again.created).toBe(false);
    data = again.data;
    expect(data.sessions).toHaveLength(1);
    expect(balanceCents(data.transactions)).toBe(1500);
  });

  it('committing a timer twice does not duplicate rewards', () => {
    let data = unwrap(startTimer(createInitialData(NOW), { categoryId: 'cat-mathe', goal: '' }, { now: new Date(NOW.getTime() - 90 * 60_000) }));
    const timer = data.activeTimer!;
    const input = { minutes: 90, categoryId: 'cat-mathe', goal: '', description: '', taskCompleted: null };
    data = unwrap(commitTimer(data, input, ctx)).data;
    expect(data.activeTimer).toBeNull();
    // A stale copy of the state with the timer still present (e.g. a second tab) cannot credit again.
    const stale = { ...data, activeTimer: timer };
    const second = unwrap(commitTimer(stale, input, ctx));
    expect(second.created).toBe(false);
    expect(balanceCents(second.data.transactions)).toBe(1500);
  });

  it('editing a session recalculates credits and XP', () => {
    let data = log(createInitialData(NOW), 90);
    const id = data.sessions[0]!.id;
    data = unwrap(updateSession(data, id, { minutes: 30 }, ctx));
    expect(playerSnapshot(data)).toEqual({ balanceCents: 500, xp: 30, level: 1 });
    data = unwrap(updateSession(data, id, { minutes: 360 }, ctx));
    expect(playerSnapshot(data)).toEqual({ balanceCents: 6000, xp: 360, level: 2 });
    expect(data.transactions.map((t) => t.type)).toEqual(['session_earn', 'session_adjust', 'session_adjust']);
  });

  it('deleting a session revokes its credits and keeps history', () => {
    let data = log(createInitialData(NOW), 90);
    data = unwrap(deleteSession(data, data.sessions[0]!.id, ctx));
    expect(playerSnapshot(data)).toEqual({ balanceCents: 0, xp: 0, level: 1 });
    expect(data.transactions).toHaveLength(2);
  });

  it('never allows a negative balance through edits or deletes', () => {
    let data = log(createInitialData(NOW), 240);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    const id = data.sessions[0]!.id;
    expect(deleteSession(data, id, ctx).ok).toBe(false);
    expect(updateSession(data, id, { minutes: 100 }, ctx).ok).toBe(false);
    data = unwrap(refundPurchase(data, data.purchases[0]!.id, ctx));
    expect(balanceCents(data.transactions)).toBe(4000);
    expect(deleteSession(data, id, ctx).ok).toBe(true);
  });

  it('purchases keep their historic price when the reward price changes', () => {
    let data = log(createInitialData(NOW), 240);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    data = { ...data, rewards: data.rewards.map((r) => (r.id === 'rw-mousepad' ? { ...r, priceCents: 9900 } : r)) };
    data = unwrap(refundPurchase(data, data.purchases[0]!.id, ctx));
    expect(balanceCents(data.transactions)).toBe(4000);
  });

  it('rate changes only affect new sessions', () => {
    let data = log(createInitialData(NOW), 60);
    data = unwrap(updateSettings(data, { rates: { creditCentsPerHour: 2000, xpPerHour: 120 } }));
    data = log(data, 60, '2026-10-12');
    expect(playerSnapshot(data)).toEqual({ balanceCents: 3000, xp: 180, level: 1 });
    // Editing the first session still uses its locked rate.
    data = unwrap(updateSession(data, data.sessions[0]!.id, { minutes: 120 }, ctx));
    expect(balanceCents(data.transactions)).toBe(4000);
  });

  it('rejects invalid durations and future dates', () => {
    const data = createInitialData(NOW);
    const base = { categoryId: 'cat-cs50x', date: '2026-10-13', source: 'manual' as const };
    expect(addSession(data, { ...base, minutes: 0 }, ctx).ok).toBe(false);
    expect(addSession(data, { ...base, minutes: -30 }, ctx).ok).toBe(false);
    expect(addSession(data, { ...base, minutes: 12.5 }, ctx).ok).toBe(false);
    expect(addSession(data, { ...base, minutes: 30, date: '2026-10-14' }, ctx).ok).toBe(false);
    expect(addSession(data, { ...base, minutes: 30, date: '2020-02-30' }, ctx).ok).toBe(false);
    expect(addSession(data, { ...base, minutes: 30, date: '2025-01-01' }, ctx).ok).toBe(true);
  });

  it('survives a JSON round trip (persistence) with validation', () => {
    let data = log(createInitialData(NOW), 240);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    const restored = unwrap(validateAppData(JSON.parse(JSON.stringify(data))));
    expect(restored).toEqual(data);
  });

  it('rejects tampered imports', () => {
    const data = log(createInitialData(NOW), 60);
    const tampered = { ...data, transactions: [...data.transactions, { ...data.transactions[0]!, id: 'tx-dup' }] };
    expect(validateAppData(tampered).ok).toBe(false);
    expect(validateAppData({ hello: 'world' }).ok).toBe(false);
  });
});

describe('timer', () => {
  it('does not count paused time', () => {
    const t0 = new Date(2026, 9, 13, 10, 0, 0);
    let data = unwrap(startTimer(createInitialData(t0), { categoryId: 'cat-mathe', goal: '' }, { now: t0 }));
    data = unwrap(pauseTimer(data, { now: new Date(t0.getTime() + 20 * 60_000) }));
    data = unwrap(resumeTimer(data, { now: new Date(t0.getTime() + 50 * 60_000) }));
    expect(timerElapsedMs(data.activeTimer!, new Date(t0.getTime() + 60 * 60_000))).toBe(30 * 60_000);
  });

  it('pauses at the last heartbeat after an interruption', () => {
    const t0 = new Date(2026, 9, 13, 10, 0, 0);
    const data = unwrap(startTimer(createInitialData(t0), { categoryId: 'cat-mathe', goal: '' }, { now: t0 }));
    const timer = { ...data.activeTimer!, heartbeatAt: new Date(t0.getTime() + 25 * 60_000).toISOString() };
    const reconciled = reconcileTimer(timer, new Date(t0.getTime() + 8 * 3600_000));
    expect(reconciled.status).toBe('paused');
    expect(reconciled.interruptedAt).not.toBeNull();
    expect(timerElapsedMs(reconciled, new Date(t0.getTime() + 9 * 3600_000))).toBe(25 * 60_000);
  });

  it('cannot confirm more time than measured', () => {
    const t0 = new Date(NOW.getTime() - 30 * 60_000);
    const data = unwrap(startTimer(createInitialData(t0), { categoryId: 'cat-mathe', goal: '' }, { now: t0 }));
    const r = commitTimer(data, { minutes: 90, categoryId: 'cat-mathe', goal: '', description: '', taskCompleted: null }, ctx);
    expect(r.ok).toBe(false);
  });
});

describe('stats & projections', () => {
  it('computes streaks', () => {
    let data = createInitialData(NOW);
    for (const d of ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-05']) data = log(data, 30, d);
    const s = studyStats(data.sessions, NOW);
    expect(s.streak).toBe(3);
    expect(s.bestStreak).toBe(3);
    expect(evaluateAchievements(data, NOW).find((a) => a.def.id === 'dranbleiben')?.unlocked).toBe(true);
  });

  it('never invents a completion date without enough history', () => {
    const data = log(createInitialData(NOW), 60);
    expect(projectCompletion(data.sessions, 600, NOW).kind).toBe('insufficient');
  });

  it('estimates days with enough data', () => {
    let data = createInitialData(NOW);
    for (const d of ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']) data = log(data, 210, d); // 840 min / 14 days = 60/day
    const p = projectCompletion(data.sessions, 600, NOW);
    expect(p.kind).toBe('estimate');
    if (p.kind === 'estimate') expect(p.days).toBe(10);
  });

  it('falls back to the cheapest locked reward as goal', () => {
    let data = log(createInitialData(NOW), 240);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    expect(goalReward(data)?.id).toBe('rw-mx-master');
  });
});
