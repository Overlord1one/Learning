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
    expect(minutesToEarn(25000, DEFAULT_RATES)).toBe(1500); // mousepad: 25 h
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
    expect(shop.reduce((a, r) => a + r.priceCents, 0)).toBe(645000);
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

  it('250 SC unlock the mousepad, deduct exactly 250 SC and leave XP untouched', () => {
    let data = log(createInitialData(NOW), 1500);
    const before = playerSnapshot(data);
    expect(rewardProgress(data, data.rewards.find((r) => r.id === 'rw-mousepad')!).status).toBe('freischaltbar');
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    const after = playerSnapshot(data);
    expect(after.balanceCents).toBe(before.balanceCents - 25000);
    expect(after.xp).toBe(before.xp);
    expect(after.level).toBe(before.level);
    expect(rewardProgress(data, data.rewards.find((r) => r.id === 'rw-mousepad')!).status).toBe('freigeschaltet');
  });

  it('insufficient credits cannot unlock an item', () => {
    const data = log(createInitialData(NOW), 1499);
    const r = purchaseReward(data, 'rw-mousepad', ctx);
    expect(r.ok).toBe(false);
  });

  it('cannot unlock the same reward twice', () => {
    let data = log(createInitialData(NOW), 1500);
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
    let data = log(createInitialData(NOW), 1500);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    const id = data.sessions[0]!.id;
    expect(deleteSession(data, id, ctx).ok).toBe(false);
    expect(updateSession(data, id, { minutes: 100 }, ctx).ok).toBe(false);
    data = unwrap(refundPurchase(data, data.purchases[0]!.id, ctx));
    expect(balanceCents(data.transactions)).toBe(25000);
    expect(deleteSession(data, id, ctx).ok).toBe(true);
  });

  it('purchases keep their historic price when the reward price changes', () => {
    let data = log(createInitialData(NOW), 1500);
    data = unwrap(purchaseReward(data, 'rw-mousepad', ctx));
    data = { ...data, rewards: data.rewards.map((r) => (r.id === 'rw-mousepad' ? { ...r, priceCents: 9900 } : r)) };
    data = unwrap(refundPurchase(data, data.purchases[0]!.id, ctx));
    expect(balanceCents(data.transactions)).toBe(25000);
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
    let data = log(createInitialData(NOW), 1500);
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
    let data = log(createInitialData(NOW), 1500);
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

  it('90 minutes of math earn 18,75 SC and 113 XP', () => {
    const data = unwrap(addSession(createInitialData(NOW), { categoryId: 'cat-mathe', minutes: 90, date: '2026-10-13', source: 'manual' }, ctx)).data;
    expect(playerSnapshot(data)).toMatchObject({ balanceCents: 1875, xp: 113 });
    expect(xpForMinutes(60, DEFAULT_RATES, 125)).toBe(75);
    expect(creditsForMinutes(60, DEFAULT_RATES, 50)).toBe(500);
  });

  it('moving a session to another subject re-applies the weighting', () => {
    let data = unwrap(addSession(createInitialData(NOW), { categoryId: 'cat-video', minutes: 60, date: '2026-10-13', source: 'manual' }, ctx)).data;
    expect(balanceCents(data.transactions)).toBe(500);
    data = unwrap(updateSession(data, data.sessions[0]!.id, { categoryId: 'cat-mathe' }, ctx));
    expect(balanceCents(data.transactions)).toBe(1250);
    expect(validateAppData(JSON.parse(JSON.stringify(data))).ok).toBe(true);
  });

  it('a later weighting change does not alter recorded sessions', () => {
    let data = unwrap(addSession(createInitialData(NOW), { categoryId: 'cat-mathe', minutes: 60, date: '2026-10-13', source: 'manual' }, ctx)).data;
    data = unwrap(renameCategory(data, 'cat-mathe', 'Mathematik', '#199e70', 150));
    expect(balanceCents(data.transactions)).toBe(1250);
    data = unwrap(updateSession(data, data.sessions[0]!.id, { minutes: 120 }, ctx));
    expect(balanceCents(data.transactions)).toBe(2500);
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
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.categories.map((c) => c.id)).toContain('cat-digitalrechner');
    expect(migrated.categories.map((c) => c.id)).toContain('cat-video');
    expect(migrated.sessions[0]!.weightPercent).toBe(125);
    expect(balanceCents(migrated.transactions)).toBe(1875); // 15 SC + 3,75 SC correction
    expect(migrated.transactions.at(-1)!.type).toBe('session_adjust');
    expect(migrated.rewards.find((r) => r.id === 'rw-flexispot')!.priceCents).toBe(350000);
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

describe('weekly plan (v3)', () => {
  it('plans 8 h math and 4 h for every other subject – 28 h in total', () => {
    const plan = weeklyPlan(createInitialData(NOW), NOW);
    expect(plan.items[0]!.category.id).toBe('cat-mathe');
    expect(plan.items[0]!.targetMinutes).toBe(480);
    expect(plan.totalTargetMinutes).toBe(28 * 60);
    expect(plan.completed).toBe(false);
  });

  it('counts only this week and completes when every target is met', () => {
    let data = createInitialData(NOW);
    const add = (categoryId: string, minutes: number, date = '2026-10-12') => {
      data = unwrap(addSession(data, { categoryId, minutes, date, source: 'manual' }, ctx)).data;
    };
    add('cat-mathe', 300, '2026-10-05'); // previous week
    const days = ['2026-10-12', '2026-10-13'];
    createInitialData(NOW)
      .categories.filter((c) => c.weeklyTargetMinutes > 0)
      .forEach((c, i) => add(c.id, c.weeklyTargetMinutes, days[i % 2]));
    const plan = weeklyPlan(data, NOW);
    expect(plan.items.find((i) => i.category.id === 'cat-mathe')!.minutes).toBe(480);
    expect(plan.completed).toBe(true);
    expect(evaluateAchievements(data, NOW).find((a) => a.def.id === 'wochenplan')?.unlocked).toBe(true);
  });

  it('migrates v2 data: weekly targets, 4 h daily goal and new prices', () => {
    const raw = JSON.parse(JSON.stringify(createInitialData(NOW)));
    raw.schemaVersion = 2;
    for (const c of raw.categories) delete c.weeklyTargetMinutes;
    raw.settings.dailyGoalMinutes = 120;
    raw.rewards.find((r: { id: string }) => r.id === 'rw-mousepad').priceCents = 15000;
    raw.rewards.find((r: { id: string }) => r.id === 'rw-dt900').priceCents = 12345; // customised by the user
    const migrated = unwrap(validateAppData(migrate(raw)));
    expect(migrated.categories.find((c) => c.id === 'cat-mathe')!.weeklyTargetMinutes).toBe(480);
    expect(migrated.settings.dailyGoalMinutes).toBe(240);
    expect(migrated.rewards.find((r) => r.id === 'rw-mousepad')!.priceCents).toBe(25000);
    expect(migrated.rewards.find((r) => r.id === 'rw-dt900')!.priceCents).toBe(12345);
  });
});
