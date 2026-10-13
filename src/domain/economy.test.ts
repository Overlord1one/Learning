import { describe, expect, it } from 'vitest';
import { createInitialData } from './defaults';
import { shiftDayKey } from './dates';
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
  resolveTimerAway,
  renameCategory,
} from './commands';
import { balanceCents, creditsForMinutes, levelForXp, levelProgress, minutesToEarn, totalXp, xpForMinutes, DEFAULT_RATES } from './economy';
import { goalReward, playerSnapshot, projectCompletion, rewardProgress, studyStats, weeklyPlan } from './stats';
import { evaluateAchievements } from './achievements';
import { migrate, validateAppData } from './schema';
import { rankForLevel, DEFAULT_RANKS } from './ranks';
import { awayMs, reconcileTimer, resolveAway, timerElapsedMs } from './timer';
import { formatCredits } from './format';
import type { AppData } from './types';

const NOW = new Date(2026, 9, 13, 18, 0, 0);
const ctx = { now: NOW };

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

function log(data: AppData, minutes: number, date = '2026-10-13', id?: string): AppData {
  // Spread long totals over previous days – a single day holds at most 24 h.
  let rest = minutes;
  let day = date;
  while (rest > 600) {
    data = unwrap(addSession(data, { categoryId: 'cat-etechnik', minutes: 600, date: day, source: 'manual' }, ctx)).data;
    rest -= 600;
    day = shiftDayKey(day, -1);
  }
  return unwrap(addSession(data, { id, categoryId: 'cat-etechnik', minutes: rest, date: day, source: 'manual' }, ctx)).data;
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

  it('uses a rising level curve', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2); // 5 h
    expect(levelForXp(899)).toBe(2);
    expect(levelForXp(900)).toBe(3); // 15 h
    expect(levelForXp(3000)).toBe(5); // 50 h
    expect(levelForXp(13_500)).toBe(10); // 225 h
    expect(levelForXp(31_500)).toBe(15); // 525 h
    expect(levelProgress(1000)).toMatchObject({ level: 3, xpIntoLevel: 100, xpForLevel: 900, xpToNext: 800 });
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
    expect(minutesToEarn(15000, DEFAULT_RATES)).toBe(900); // mousepad: 15 h
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
    expect(shop.reduce((a, r) => a + r.priceCents, 0)).toBe(455000);
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

  it('150 SC unlock the mousepad, deduct exactly 150 SC and leave XP untouched', () => {
    let data = log(createInitialData(NOW), 900);
    const before = playerSnapshot(data);
    expect(rewardProgress(data, data.rewards.find((r) => r.id === 'rw-mousepad')!).status).toBe('freischaltbar');
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    const after = playerSnapshot(data);
    expect(after.balanceCents).toBe(before.balanceCents - 15000);
    expect(after.xp).toBe(before.xp);
    expect(after.level).toBe(before.level);
    expect(rewardProgress(data, data.rewards.find((r) => r.id === 'rw-mousepad')!).status).toBe('freigeschaltet');
  });

  it('insufficient credits cannot unlock an item', () => {
    const data = log(createInitialData(NOW), 899);
    const r = purchaseReward(data, 'rw-mousepad', ctx);
    expect(r.ok).toBe(false);
  });

  it('cannot unlock the same reward twice', () => {
    let data = log(createInitialData(NOW), 900);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    expect(purchaseReward(data, 'rw-mousepad', ctx).ok).toBe(false);
  });

  it('pre-owned items cannot be bought', () => {
    const data = log(createInitialData(NOW), 600);
    expect(purchaseReward(data, 'rw-roccat', ctx).ok).toBe(false);
  });

  it('saving the same session twice does not duplicate rewards', () => {
    let data = log(createInitialData(NOW), 90, '2026-10-13', 'ses-fixed');
    const again = unwrap(addSession(data, { id: 'ses-fixed', categoryId: 'cat-etechnik', minutes: 90, date: '2026-10-13', source: 'manual' }, ctx));
    expect(again.created).toBe(false);
    data = again.data;
    expect(data.sessions).toHaveLength(1);
    expect(balanceCents(data.transactions)).toBe(1500);
  });

  it('committing a timer twice does not duplicate rewards', () => {
    let data = unwrap(startTimer(createInitialData(NOW), { categoryId: 'cat-etechnik', goal: '' }, { now: new Date(NOW.getTime() - 90 * 60_000) }));
    const timer = data.activeTimer!;
    const input = { minutes: 90, categoryId: 'cat-etechnik', goal: '', description: '', taskCompleted: null };
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
    let data = log(createInitialData(NOW), 900);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    const id = data.sessions[0]!.id;
    expect(deleteSession(data, id, ctx).ok).toBe(false);
    expect(updateSession(data, id, { minutes: 100 }, ctx).ok).toBe(false);
    data = unwrap(refundPurchase(data, data.purchases[0]!.id, ctx));
    expect(balanceCents(data.transactions)).toBe(15000);
    expect(deleteSession(data, id, ctx).ok).toBe(true);
  });

  it('purchases keep their historic price when the reward price changes', () => {
    let data = log(createInitialData(NOW), 900);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    data = { ...data, rewards: data.rewards.map((r) => (r.id === 'rw-mousepad' ? { ...r, priceCents: 9900 } : r)) };
    data = unwrap(refundPurchase(data, data.purchases[0]!.id, ctx));
    expect(balanceCents(data.transactions)).toBe(15000);
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
    const base = { categoryId: 'cat-etechnik', date: '2026-10-13', source: 'manual' as const };
    expect(addSession(data, { ...base, minutes: 0 }, ctx).ok).toBe(false);
    expect(addSession(data, { ...base, minutes: -30 }, ctx).ok).toBe(false);
    expect(addSession(data, { ...base, minutes: 12.5 }, ctx).ok).toBe(false);
    expect(addSession(data, { ...base, minutes: 30, date: '2026-10-14' }, ctx).ok).toBe(false);
    expect(addSession(data, { ...base, minutes: 30, date: '2020-02-30' }, ctx).ok).toBe(false);
    expect(addSession(data, { ...base, minutes: 30, date: '2025-01-01' }, ctx).ok).toBe(true);
  });

  it('survives a JSON round trip (persistence) with validation', () => {
    let data = log(createInitialData(NOW), 900);
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

  it('flags time spent outside the app and lets the user decide', () => {
    const t0 = new Date(2026, 9, 13, 10, 0, 0);
    const at = (min: number) => new Date(t0.getTime() + min * 60_000);
    const data = unwrap(startTimer(createInitialData(t0), { categoryId: 'cat-mathe', goal: '' }, { now: t0 }));
    // App last seen after 25 min (e.g. phone locked), user returns after 60 min.
    const timer = { ...data.activeTimer!, heartbeatAt: at(25).toISOString() };
    const flagged = reconcileTimer(timer, at(60));
    expect(flagged.status).toBe('running');
    expect(flagged.interruptedAt).toBe(at(25).toISOString());
    expect(awayMs(flagged, at(60))).toBe(35 * 60_000);
    // Re-checking while undecided keeps the original start of the gap.
    expect(reconcileTimer(flagged, at(70)).interruptedAt).toBe(at(25).toISOString());
    // Counted: the full 60 minutes stay.
    expect(timerElapsedMs(resolveAway(flagged, true, at(60)), at(60))).toBe(60 * 60_000);
    // Not counted: 25 minutes, then the timer continues from now.
    const removed = resolveAway(flagged, false, at(60));
    expect(removed.interruptedAt).toBeNull();
    expect(timerElapsedMs(removed, at(60))).toBe(25 * 60_000);
    expect(timerElapsedMs(removed, at(70))).toBe(35 * 60_000);
  });

  it('cannot finish while a gap is undecided', () => {
    const t0 = new Date(NOW.getTime() - 60 * 60_000);
    let data = unwrap(startTimer(createInitialData(t0), { categoryId: 'cat-mathe', goal: '' }, { now: t0 }));
    data = { ...data, activeTimer: reconcileTimer(data.activeTimer!, NOW) };
    const input = { minutes: 30, categoryId: 'cat-mathe', goal: '', description: '', taskCompleted: null };
    expect(commitTimer(data, input, ctx).ok).toBe(false);
    // Counting the time away (e.g. studied with the phone locked) allows finishing.
    data = unwrap(resolveTimerAway(data, true, ctx));
    expect(unwrap(commitTimer(data, input, ctx)).session.minutes).toBe(30);
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
    expect(projectCompletion(data.sessions, 10_000, NOW).kind).toBe('insufficient');
  });

  it('estimates days with enough data', () => {
    let data = createInitialData(NOW);
    for (const d of ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']) data = log(data, 210, d); // 840 min / 14 days = 60/day
    const p = projectCompletion(data.sessions, 10_000, NOW); // 1.000 cents per day → 10 days
    expect(p.kind).toBe('estimate');
    if (p.kind === 'estimate') expect(p.days).toBe(10);
  });

  it('falls back to the cheapest locked reward as goal', () => {
    let data = log(createInitialData(NOW), 900);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    expect(goalReward(data)?.id).toBe('rw-mx-master');
  });
});

describe('subject weighting (v2)', () => {
  it('math is weighted highest, video editing lowest', () => {
    const data = createInitialData(NOW);
    const order = [...data.categories].sort((a, b) => b.weightPercent - a.weightPercent).map((c) => c.name);
    expect(order.slice(0, 6)).toEqual([
      'Mathematik',
      'Harvard CS50x',
      'Harvard CS50P / Python',
      'Elektrotechnik',
      'Digitalrechner',
      'Vorlesungen',
    ]);
    expect(data.categories.find((c) => c.id === 'cat-video')?.weightPercent).toBe(50);
  });

  it('90 minutes of math earn 22,5 SC and 135 XP', () => {
    const data = unwrap(addSession(createInitialData(NOW), { categoryId: 'cat-mathe', minutes: 90, date: '2026-10-13', source: 'manual' }, ctx)).data;
    expect(playerSnapshot(data)).toMatchObject({ balanceCents: 2250, xp: 135 });
    expect(xpForMinutes(60, DEFAULT_RATES, 150)).toBe(90);
    expect(creditsForMinutes(60, DEFAULT_RATES, 50)).toBe(500);
  });

  it('moving a session to another subject re-applies the weighting', () => {
    let data = unwrap(addSession(createInitialData(NOW), { categoryId: 'cat-video', minutes: 60, date: '2026-10-13', source: 'manual' }, ctx)).data;
    expect(balanceCents(data.transactions)).toBe(500);
    data = unwrap(updateSession(data, data.sessions[0]!.id, { categoryId: 'cat-mathe' }, ctx));
    expect(balanceCents(data.transactions)).toBe(1500);
    expect(validateAppData(JSON.parse(JSON.stringify(data))).ok).toBe(true);
  });

  it('a later weighting change does not alter recorded sessions', () => {
    let data = unwrap(addSession(createInitialData(NOW), { categoryId: 'cat-mathe', minutes: 60, date: '2026-10-13', source: 'manual' }, ctx)).data;
    data = unwrap(renameCategory(data, 'cat-mathe', 'Mathematik', '#199e70', 200));
    expect(balanceCents(data.transactions)).toBe(1500);
    data = unwrap(updateSession(data, data.sessions[0]!.id, { minutes: 120 }, ctx));
    expect(balanceCents(data.transactions)).toBe(3000);
  });

  it('awards Mathe-Woche for 8 hours of math in one week', () => {
    let data = createInitialData(NOW);
    for (const d of ['2026-10-12', '2026-10-13']) {
      data = unwrap(addSession(data, { categoryId: 'cat-mathe', minutes: 240, date: d, source: 'manual' }, ctx)).data;
    }
    expect(evaluateAchievements(data, NOW).find((a) => a.def.id === 'mathe-woche')?.unlocked).toBe(true);
  });
});

describe('migration v1 → v2', () => {
  function v1Data() {
    const v2 = log(createInitialData(NOW), 90, '2026-10-13'); // 15 SC at 100 %
    const data = JSON.parse(JSON.stringify(v2));
    data.schemaVersion = 1;
    for (const c of data.categories) {
      delete c.weightPercent;
      delete c.weeklyTargetMinutes;
    }
    data.categories = data.categories.filter((c: { id: string }) => !['cat-digitalrechner', 'cat-vorlesungen', 'cat-video'].includes(c.id));
    for (const s of data.sessions) delete s.weightPercent;
    const v1Prices: Record<string, number> = { 'rw-mousepad': 4000, 'rw-mx-master': 10000, 'rw-lofree-flow': 17500, 'rw-dt900': 20000, 'rw-flexispot': 70000 };
    for (const r of data.rewards) if (v1Prices[r.id]) r.priceCents = v1Prices[r.id];
    data.settings.defaultCategoryId = 'cat-cs50x';
    return data;
  }

  it('adds subjects, applies weights through the ledger and raises untouched prices', () => {
    const raw = v1Data();
    raw.sessions[0].categoryId = 'cat-mathe';
    raw.transactions[0].sessionId = raw.sessions[0].id;
    const migrated = unwrap(validateAppData(migrate(raw)));
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.categories.map((c) => c.id)).toContain('cat-digitalrechner');
    expect(migrated.categories.map((c) => c.id)).toContain('cat-video');
    expect(migrated.sessions[0]!.weightPercent).toBe(150);
    expect(balanceCents(migrated.transactions)).toBe(2250); // 15 SC + 7,5 SC correction
    expect(migrated.transactions.at(-1)!.type).toBe('session_adjust');
    expect(migrated.rewards.find((r) => r.id === 'rw-flexispot')!.priceCents).toBe(250000);
    expect(migrated.settings.defaultCategoryId).toBe('cat-mathe');
  });

  it('keeps old credits when a lower weight would make the balance negative', () => {
    const raw = v1Data();
    raw.sessions[0].categoryId = 'cat-sonstiges'; // 50 %
    raw.purchases.push({ id: 'pur-1', rewardId: 'rw-mousepad', rewardName: 'Mauspad', priceCents: 1500, unlockedAt: NOW.toISOString(), realPurchasedAt: null, refundedAt: null });
    raw.transactions.push({ id: 'tx-p', type: 'purchase', amountCents: -1500, createdAt: NOW.toISOString(), sessionId: null, purchaseId: 'pur-1', rewardId: 'rw-mousepad', note: '' });
    const migrated = unwrap(validateAppData(migrate(raw)));
    expect(migrated.sessions[0]!.weightPercent).toBe(100);
    expect(balanceCents(migrated.transactions)).toBe(0);
  });
});

describe('school-hour weighting (v4)', () => {
  it('weights math highest because it has twice the school hours', () => {
    const data = createInitialData(NOW);
    const w = (id: string) => data.categories.find((c) => c.id === id)!.weightPercent;
    expect(w('cat-mathe')).toBe(150);
    expect(w('cat-cs50x')).toBe(120);
    expect(w('cat-etechnik')).toBe(100);
    expect(w('cat-digitalrechner')).toBe(100);
    expect(w('cat-vorlesungen')).toBe(75);
    expect(w('cat-video')).toBe(50);
    expect(data.settings.dailyGoalMinutes).toBe(120);
    // No weekly targets by default – the weekly plan card stays hidden.
    expect(weeklyPlan(data, NOW).items).toHaveLength(0);
  });

  it('migrates v3 data: new math weight via ledger correction, targets off, v2 prices', () => {
    let v4 = createInitialData(NOW);
    v4 = unwrap(addSession(v4, { categoryId: 'cat-mathe', minutes: 180, date: '2026-10-13', source: 'manual' }, ctx)).data;
    const raw = JSON.parse(JSON.stringify(v4));
    raw.schemaVersion = 3;
    const v3Weights: Record<string, number> = { 'cat-mathe': 125, 'cat-cs50x': 110, 'cat-cs50p': 110, 'cat-digitalrechner': 90 };
    const v3Targets: Record<string, number> = { 'cat-mathe': 480, 'cat-etechnik': 240 };
    for (const c of raw.categories) {
      c.weightPercent = v3Weights[c.id] ?? c.weightPercent;
      c.weeklyTargetMinutes = v3Targets[c.id] ?? 0;
    }
    raw.sessions[0].weightPercent = 125;
    raw.transactions[0].amountCents = 3750; // 3 h × 12,5 SC
    raw.settings.dailyGoalMinutes = 240;
    raw.rewards.find((r: { id: string }) => r.id === 'rw-mousepad').priceCents = 25000;
    raw.rewards.find((r: { id: string }) => r.id === 'rw-dt900').priceCents = 12345; // customised
    const migrated = unwrap(validateAppData(migrate(raw)));
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.categories.find((c) => c.id === 'cat-mathe')!.weightPercent).toBe(150);
    expect(migrated.categories.every((c) => c.weeklyTargetMinutes === 0)).toBe(true);
    expect(migrated.sessions[0]!.weightPercent).toBe(150);
    expect(balanceCents(migrated.transactions)).toBe(4500); // 37,5 SC + 7,5 SC correction
    expect(migrated.settings.dailyGoalMinutes).toBe(120);
    expect(migrated.rewards.find((r) => r.id === 'rw-mousepad')!.priceCents).toBe(15000);
    expect(migrated.rewards.find((r) => r.id === 'rw-dt900')!.priceCents).toBe(12345);
  });
});
