/** Runtime validation for persisted and imported data. */
import { z } from 'zod';
import { balanceCents, creditsForMinutes, DEFAULT_RATES, sessionCreativeCredits, sessionCredits } from './economy';
import { creditedForSession } from './commands';
import { isValidDayKey } from './dates';
import { SCHEMA_VERSION } from './types';
import type { AppData, CreditTransaction, Result, StudyCategory, StudySession } from './types';
import {
  CREATIVE_REWARDS,
  DEFAULT_CATEGORIES,
  DEFAULT_REWARDS,
  V1_DEFAULT_PRICES,
  V2_DEFAULT_PRICES,
  V3_DEFAULT_PRICES,
  V3_DEFAULT_WEEKLY_TARGETS,
  V3_DEFAULT_WEIGHTS,
} from './defaults';
import { createId } from './ids';
import { fail, ok } from './types';

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Ungültiger Zeitstempel');
const dayKeySchema = z.string().refine(isValidDayKey, 'Ungültiges Datum');
const int = z.number().int();
const weight = z.number().min(10).max(300).refine((v) => Number.isInteger(v * 4), 'Ungültige Gewichtung');

const rates = z.object({ creditCentsPerHour: int.min(1), xpPerHour: int.min(1), creativeCentsPerHour: int.min(0) });
const wallet = z.enum(['main', 'creative']);
const rewardWallet = z.enum(['main', 'creative', 'both']);

const schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  createdAt: iso,
  settings: z.object({
    profileName: z.string().max(40),
    dailyGoalMinutes: int.min(0).max(1440),
    defaultCategoryId: z.string(),
    rates,
    ranks: z.array(z.object({ minLevel: int.min(1), name: z.string().min(1) })).min(1),
    goalRewardId: z.string().nullable(),
    motion: z.enum(['system', 'reduced', 'full']),
    accent: z.enum(['blau', 'gruen', 'violett']),
    timerReminderMinutes: int.min(0).max(720),
    sessionPresets: z.array(int.min(1).max(1440)).max(8),
    notifications: z.boolean(),
  }),
  categories: z
    .array(
      z.object({ id: z.string(), name: z.string().min(1), color: z.string(), isDefault: z.boolean(), archived: z.boolean(), weightPercent: weight, weeklyTargetMinutes: int.min(0).max(10080), creative: z.boolean() }),
    )
    .min(1),
  sessions: z.array(
    z.object({
      id: z.string(),
      categoryId: z.string(),
      minutes: int.min(1).max(1440),
      date: dayKeySchema,
      source: z.enum(['timer', 'manual']),
      startedAt: iso.nullable(),
      endedAt: iso.nullable(),
      goal: z.string(),
      description: z.string(),
      taskCompleted: z.boolean().nullable(),
      rates,
      weightPercent: weight,
      creative: z.boolean(),
      createdAt: iso,
      updatedAt: iso,
    }),
  ),
  transactions: z.array(
    z.object({
      id: z.string(),
      wallet,
      type: z.enum(['session_earn', 'session_adjust', 'session_revoke', 'purchase', 'refund']),
      amountCents: int,
      createdAt: iso,
      sessionId: z.string().nullable(),
      purchaseId: z.string().nullable(),
      rewardId: z.string().nullable(),
      note: z.string(),
    }),
  ),
  rewards: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      description: z.string(),
      category: z.string(),
      variant: z.string(),
      icon: z.enum(['mousepad', 'mouse', 'keyboard', 'headphones', 'desk', 'monitor', 'lamp', 'chair', 'speaker', 'mic', 'gift']),
      imageUrl: z.string(),
      priceCents: int.min(0),
      realPriceEuroCents: int.min(0).nullable(),
      productUrl: z.string(),
      priority: z.enum(['niedrig', 'mittel', 'hoch']),
      wallet: rewardWallet,
      isDefault: z.boolean(),
      preOwned: z.boolean(),
      archived: z.boolean(),
      createdAt: iso,
      sortOrder: z.number(),
    }),
  ),
  purchases: z.array(
    z.object({
      id: z.string(),
      rewardId: z.string(),
      rewardName: z.string(),
      wallet: rewardWallet,
      creativeCents: int.min(0),
      priceCents: int.min(0),
      unlockedAt: iso,
      realPurchasedAt: iso.nullable(),
      refundedAt: iso.nullable(),
    }),
  ),
  achievementsSeen: z.record(z.string(), iso),
  activeTimer: z
    .object({
      sessionId: z.string(),
      categoryId: z.string(),
      goal: z.string(),
      status: z.enum(['running', 'paused']),
      startedAt: iso,
      accumulatedMs: z.number().min(0),
      segmentStartedAt: iso.nullable(),
      heartbeatAt: iso,
      interruptedAt: iso.nullable(),
    })
    .nullable(),
});

function unique(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

/** Structural + semantic validation (ledger integrity, references, uniqueness). */
export function validateAppData(input: unknown): Result<AppData> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(`Ungültige Datei: ${issue ? `${issue.path.join('.')} – ${issue.message}` : 'unbekannter Fehler'}`);
  }
  const data = parsed.data as AppData;

  if (!unique(data.sessions.map((s) => s.id))) return fail('Ungültige Datei: doppelte Sessions gefunden.');
  if (!unique(data.transactions.map((t) => t.id))) return fail('Ungültige Datei: doppelte Transaktionen gefunden.');
  if (!unique(data.rewards.map((r) => r.id))) return fail('Ungültige Datei: doppelte Belohnungen gefunden.');
  if (!unique(data.purchases.map((p) => p.id))) return fail('Ungültige Datei: doppelte Freischaltungen gefunden.');

  const categoryIds = new Set(data.categories.map((c) => c.id));
  if (data.sessions.some((s) => !categoryIds.has(s.categoryId))) return fail('Ungültige Datei: Session mit unbekannter Kategorie.');

  // Every existing session must be credited exactly with its value.
  for (const s of data.sessions) {
    const earns = data.transactions.filter((t) => t.type === 'session_earn' && t.sessionId === s.id && t.wallet === 'main').length;
    if (earns !== 1) return fail('Ungültige Datei: Eine Session wurde nicht genau einmal gutgeschrieben.');
    if (
      creditedForSession(data, s.id, 'main') !== sessionCredits(s) ||
      creditedForSession(data, s.id, 'creative') !== sessionCreativeCredits(s)
    ) {
      return fail('Ungültige Datei: Gutschriften passen nicht zu den Sessions.');
    }
  }
  const rewardIds = new Set(data.rewards.map((r) => r.id));
  for (const p of data.purchases) {
    if (!rewardIds.has(p.rewardId)) return fail('Ungültige Datei: Freischaltung ohne zugehörige Belohnung.');
    if (p.creativeCents > p.priceCents) return fail('Ungültige Datei: Freischaltung mit fehlerhafter Aufteilung.');
  }
  const activePerReward = new Map<string, number>();
  for (const p of data.purchases) {
    if (p.refundedAt === null) activePerReward.set(p.rewardId, (activePerReward.get(p.rewardId) ?? 0) + 1);
  }
  if ([...activePerReward.values()].some((n) => n > 1)) return fail('Ungültige Datei: doppelte Freischaltung gefunden.');
  if (balanceCents(data.transactions, 'main') < 0 || balanceCents(data.transactions, 'creative') < 0) {
    return fail('Ungültige Datei: Ein Guthaben wäre negativ.');
  }

  return ok(data);
}

/** Bring older persisted data up to the current schema. */
export function migrate(raw: unknown): unknown {
  // Before v8 there was only one account: every booking belongs to it.
  let data = isRecord(raw) && typeof raw.schemaVersion === 'number' && raw.schemaVersion < 8 ? withMainWallet(raw) : raw;
  if (isRecord(data) && data.schemaVersion === 1) data = migrateV1toV2(data);
  if (isRecord(data) && data.schemaVersion === 2) data = migrateV2toV3(data);
  if (isRecord(data) && data.schemaVersion === 3) data = migrateV3toV4(data);
  // v5: lectures worth half (×0,75 → ×0,375); v6: half again (→ ×0,1875).
  if (isRecord(data) && data.schemaVersion === 4) data = changeDefaultWeight(data, 'cat-vorlesungen', 75, 37.5, 5);
  if (isRecord(data) && data.schemaVersion === 5) data = changeDefaultWeight(data, 'cat-vorlesungen', 37.5, 18.75, 6);
  if (isRecord(data) && data.schemaVersion === 6) data = migrateV6toV7(data);
  if (isRecord(data) && data.schemaVersion === 7) data = migrateV7toV8(data);
  if (isRecord(data) && data.schemaVersion === 8) data = migrateV8toV9(data);
  return data;
}

/**
 * v3: weekly study targets per subject (8 h math, 4 h for the others), a 4-hour
 * daily goal and reward prices scaled to a 28-hour study week.
 */
function migrateV2toV3(raw: Record<string, unknown>): unknown {
  const data = structuredClone(raw) as Record<string, any>;
  if (Array.isArray(data.categories)) {
    data.categories = data.categories.map((c: StudyCategory) => ({
      ...c,
      weeklyTargetMinutes: c.weeklyTargetMinutes ?? DEFAULT_CATEGORIES.find((d) => d.id === c.id)?.weeklyTargetMinutes ?? 0,
    }));
  }
  if (Array.isArray(data.rewards)) {
    data.rewards = data.rewards.map((r: { id: string; priceCents: number }) => {
      const seed = DEFAULT_REWARDS.find((d) => d.id === r.id);
      return seed && V2_DEFAULT_PRICES[r.id] === r.priceCents ? { ...r, priceCents: seed.priceCents } : r;
    });
  }
  if (isRecord(data.settings) && data.settings.dailyGoalMinutes === 120) data.settings.dailyGoalMinutes = 240;
  data.schemaVersion = 3;
  return data;
}

/**
 * Give sessions a new weighting and book the credit difference as traceable
 * corrections. Does nothing (returns false) if the balance would turn negative.
 */
function reweightSessions(data: Record<string, any>, weightFor: (s: StudySession) => number): boolean {
  return rebookSessions(data, (s) => ({ ...s, weightPercent: weightFor(s) }), (s) => `Fach-Gewichtung ${s.weightPercent} % angewendet`);
}

/**
 * Apply a change to sessions and book every resulting credit difference as a
 * traceable correction. Does nothing (returns false) if the balance would turn negative.
 */
function rebookSessions(
  data: Record<string, any>,
  change: (s: StudySession) => StudySession,
  note: (s: StudySession) => string,
): boolean {
  const sessions: StudySession[] = Array.isArray(data.sessions) ? data.sessions : [];
  const transactions: CreditTransaction[] = Array.isArray(data.transactions) ? data.transactions : [];
  const now = new Date().toISOString();
  const weighted = sessions.map(change);
  const corrections: CreditTransaction[] = [];
  for (const s of weighted) {
    const credited = transactions.filter((t) => t.sessionId === s.id && t.wallet === 'main').reduce((a, t) => a + t.amountCents, 0);
    const delta = creditsForMinutes(s.minutes, s.rates, s.weightPercent) - credited;
    if (delta !== 0) {
      corrections.push({
        id: createId('tx'),
        wallet: 'main',
        type: 'session_adjust',
        amountCents: delta,
        createdAt: now,
        sessionId: s.id,
        purchaseId: null,
        rewardId: null,
        note: note(s),
      });
    }
  }
  if (balanceCents([...transactions, ...corrections]) < 0) return false;
  data.sessions = weighted;
  data.transactions = [...transactions, ...corrections];
  return true;
}

/**
 * v4: weighting based on school hours (math ×1.5), no default weekly targets,
 * prices and daily goal back to the v2 level. Untouched defaults move along;
 * sessions recorded with an old default weight get the new one.
 */
function migrateV3toV4(raw: Record<string, unknown>): unknown {
  const data = structuredClone(raw) as Record<string, any>;
  const categories: StudyCategory[] = Array.isArray(data.categories) ? data.categories : [];
  const oldWeights = new Map<string, number>();
  data.categories = categories.map((c) => {
    const seed = DEFAULT_CATEGORIES.find((d) => d.id === c.id);
    if (!seed) return c;
    oldWeights.set(c.id, c.weightPercent);
    return {
      ...c,
      weightPercent: V3_DEFAULT_WEIGHTS[c.id] === c.weightPercent ? seed.weightPercent : c.weightPercent,
      weeklyTargetMinutes: V3_DEFAULT_WEEKLY_TARGETS[c.id] === c.weeklyTargetMinutes ? 0 : c.weeklyTargetMinutes,
    };
  });
  const current = (id: string) => (data.categories as StudyCategory[]).find((c) => c.id === id)?.weightPercent ?? 100;
  reweightSessions(data, (s) => (V3_DEFAULT_WEIGHTS[s.categoryId] === s.weightPercent && oldWeights.get(s.categoryId) === s.weightPercent ? current(s.categoryId) : s.weightPercent));
  if (Array.isArray(data.rewards)) {
    data.rewards = data.rewards.map((r: { id: string; priceCents: number }) => {
      const seed = DEFAULT_REWARDS.find((d) => d.id === r.id);
      return seed && V3_DEFAULT_PRICES[r.id] === r.priceCents ? { ...r, priceCents: seed.priceCents } : r;
    });
  }
  if (isRecord(data.settings) && data.settings.dailyGoalMinutes === 240) data.settings.dailyGoalMinutes = 120;
  data.schemaVersion = 4;
  return data;
}

function withMainWallet(raw: Record<string, unknown>): Record<string, unknown> {
  const data = structuredClone(raw) as Record<string, any>;
  if (Array.isArray(data.transactions)) data.transactions = data.transactions.map((t: object) => ({ wallet: 'main', ...t }));
  if (Array.isArray(data.purchases)) data.purchases = data.purchases.map((p: object) => ({ wallet: 'main', ...p }));
  return data;
}

/** v9: rewards payable from both accounts (Rode PodMic USB); purchases record their KC share. */
function migrateV8toV9(raw: Record<string, unknown>): unknown {
  const data = structuredClone(raw) as Record<string, any>;
  if (Array.isArray(data.purchases)) {
    data.purchases = data.purchases.map((p: { wallet: string; priceCents: number; creativeCents?: number }) => ({
      ...p,
      creativeCents: p.creativeCents ?? (p.wallet === 'creative' ? p.priceCents : 0),
    }));
  }
  if (Array.isArray(data.rewards)) {
    const now = new Date().toISOString();
    for (const seed of DEFAULT_REWARDS) {
      if (!data.rewards.some((r: { id: string }) => r.id === seed.id)) data.rewards.push({ ...seed, createdAt: now });
    }
  }
  data.schemaVersion = 9;
  return data;
}

/**
 * v8: Kreativ-Konto. Video editing additionally earns Kreativ-Credits (KC) for
 * creative equipment. Adds the 7Hz x Crinacle Divine and an editing monitor,
 * and credits KC retroactively for video editing already logged.
 */
function migrateV7toV8(raw: Record<string, unknown>): unknown {
  const data = structuredClone(raw) as Record<string, any>;
  const creativeRate = DEFAULT_RATES.creativeCentsPerHour;
  if (isRecord(data.settings) && isRecord(data.settings.rates)) {
    data.settings.rates = { ...data.settings.rates, creativeCentsPerHour: creativeRate };
  }
  const categories: StudyCategory[] = Array.isArray(data.categories) ? data.categories : [];
  data.categories = categories.map((c) => ({ ...c, creative: c.id === 'cat-video' }));
  if (Array.isArray(data.rewards)) {
    data.rewards = data.rewards.map((r: object) => ({ wallet: 'main', ...r }));
    const now = new Date().toISOString();
    for (const seed of [...DEFAULT_REWARDS, ...CREATIVE_REWARDS]) {
      if (!data.rewards.some((r: { id: string }) => r.id === seed.id)) data.rewards.push({ ...seed, createdAt: now });
    }
  }
  const now = new Date().toISOString();
  const sessions: StudySession[] = Array.isArray(data.sessions) ? data.sessions : [];
  data.sessions = sessions.map((s) => ({
    ...s,
    rates: { ...s.rates, creativeCentsPerHour: creativeRate },
    creative: s.categoryId === 'cat-video',
  }));
  const transactions: CreditTransaction[] = Array.isArray(data.transactions) ? data.transactions : [];
  for (const s of data.sessions as StudySession[]) {
    const amount = sessionCreativeCredits(s);
    if (amount > 0) {
      transactions.push({
        id: createId('tx'),
        wallet: 'creative',
        type: 'session_earn',
        amountCents: amount,
        createdAt: now,
        sessionId: s.id,
        purchaseId: null,
        rewardId: null,
        note: `${s.minutes} Min. Video-Schnitt (Kreativ-Konto, rückwirkend)`,
      });
    }
  }
  data.transactions = transactions;
  data.schemaVersion = 8;
  return data;
}

/**
 * v7: base rate 10 → 16 SC per hour (1 h math ≈ 6 €). If the rate was never
 * customised, every session recorded at 10 SC/h is re-booked at 16 SC/h, so
 * the balance is as if the new rate had always applied.
 */
function migrateV6toV7(raw: Record<string, unknown>): unknown {
  const data = structuredClone(raw) as Record<string, any>;
  const OLD = 1000;
  const NEW = DEFAULT_RATES.creditCentsPerHour;
  if (isRecord(data.settings) && isRecord(data.settings.rates) && data.settings.rates.creditCentsPerHour === OLD) {
    data.settings.rates = { ...data.settings.rates, creditCentsPerHour: NEW };
    rebookSessions(
      data,
      (s) => (s.rates.creditCentsPerHour === OLD ? { ...s, rates: { ...s.rates, creditCentsPerHour: NEW } } : s),
      () => `Neue Grundrate ${NEW / 100} SC/h rückwirkend angewendet`,
    );
  }
  data.schemaVersion = 7;
  return data;
}

/**
 * Move a default subject from an old default weight to a new one. Sessions
 * recorded with the old weight are re-weighted through ledger corrections.
 * Weights the user changed themselves stay untouched.
 */
function changeDefaultWeight(raw: Record<string, unknown>, categoryId: string, from: number, to: number, version: number): unknown {
  const data = structuredClone(raw) as Record<string, any>;
  let changed = false;
  if (Array.isArray(data.categories)) {
    data.categories = data.categories.map((c: StudyCategory) => {
      if (c.id !== categoryId || c.weightPercent !== from) return c;
      changed = true;
      return { ...c, weightPercent: to };
    });
  }
  if (changed) reweightSessions(data, (s) => (s.categoryId === categoryId && s.weightPercent === from ? to : s.weightPercent));
  data.schemaVersion = version;
  return data;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * v2: subject weighting, new subjects (Digitalrechner, Vorlesungen,
 * Video-Schnitt), higher reward prices and a rising level curve.
 * Existing sessions receive their subject's weighting through traceable
 * ledger corrections – unless that would make the balance negative.
 */
function migrateV1toV2(raw: Record<string, unknown>): unknown {
  const data = structuredClone(raw) as Record<string, any>;
  const defaultIndex = (id: string) => {
    const i = DEFAULT_CATEGORIES.findIndex((c) => c.id === id);
    return i === -1 ? DEFAULT_CATEGORIES.length : i;
  };

  // Categories: add weights and the new default subjects, order by priority.
  const categories: StudyCategory[] = (Array.isArray(data.categories) ? data.categories : []).map((c: StudyCategory) => ({
    ...c,
    weightPercent: DEFAULT_CATEGORIES.find((d) => d.id === c.id)?.weightPercent ?? 100,
  }));
  for (const d of DEFAULT_CATEGORIES) if (!categories.some((c) => c.id === d.id)) categories.push({ ...d });
  data.categories = categories.map((c, i) => ({ c, i })).sort((a, b) => defaultIndex(a.c.id) - defaultIndex(b.c.id) || a.i - b.i).map((x) => x.c);

  // Sessions: apply the subject weighting with ledger corrections.
  const weightOf = (categoryId: string) => categories.find((c) => c.id === categoryId)?.weightPercent ?? 100;
  const sessions: StudySession[] = Array.isArray(data.sessions) ? data.sessions : [];
  if (!reweightSessions(data, (s) => weightOf(s.categoryId))) {
    data.sessions = sessions.map((s) => ({ ...s, weightPercent: 100 }));
  }

  // Rewards: untouched default prices move to the new, longer-term goals.
  if (Array.isArray(data.rewards)) {
    data.rewards = data.rewards.map((r: { id: string; priceCents: number }) => {
      const seed = DEFAULT_REWARDS.find((d) => d.id === r.id);
      return seed && V1_DEFAULT_PRICES[r.id] === r.priceCents ? { ...r, priceCents: seed.priceCents } : r;
    });
  }

  if (isRecord(data.settings) && data.settings.defaultCategoryId === 'cat-cs50x') data.settings.defaultCategoryId = 'cat-mathe';
  data.schemaVersion = 2;
  return data;
}
