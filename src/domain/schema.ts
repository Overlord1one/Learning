/** Runtime validation for persisted and imported data. */
import { z } from 'zod';
import { balanceCents, creditsForMinutes } from './economy';
import { creditedForSession } from './commands';
import { isValidDayKey } from './dates';
import { SCHEMA_VERSION } from './types';
import type { AppData, Result } from './types';
import { fail, ok } from './types';

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Ungültiger Zeitstempel');
const dayKeySchema = z.string().refine(isValidDayKey, 'Ungültiges Datum');
const int = z.number().int();

const rates = z.object({ creditCentsPerHour: int.min(1), xpPerHour: int.min(1) });

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
    .array(z.object({ id: z.string(), name: z.string().min(1), color: z.string(), isDefault: z.boolean(), archived: z.boolean() }))
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
      createdAt: iso,
      updatedAt: iso,
    }),
  ),
  transactions: z.array(
    z.object({
      id: z.string(),
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
      icon: z.enum(['mousepad', 'mouse', 'keyboard', 'headphones', 'desk', 'monitor', 'lamp', 'chair', 'speaker', 'gift']),
      imageUrl: z.string(),
      priceCents: int.min(0),
      realPriceEuroCents: int.min(0).nullable(),
      productUrl: z.string(),
      priority: z.enum(['niedrig', 'mittel', 'hoch']),
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
    const earns = data.transactions.filter((t) => t.type === 'session_earn' && t.sessionId === s.id).length;
    if (earns !== 1) return fail('Ungültige Datei: Eine Session wurde nicht genau einmal gutgeschrieben.');
    if (creditedForSession(data, s.id) !== creditsForMinutes(s.minutes, s.rates)) {
      return fail('Ungültige Datei: Gutschriften passen nicht zu den Sessions.');
    }
  }
  const rewardIds = new Set(data.rewards.map((r) => r.id));
  for (const p of data.purchases) {
    if (!rewardIds.has(p.rewardId)) return fail('Ungültige Datei: Freischaltung ohne zugehörige Belohnung.');
  }
  const activePerReward = new Map<string, number>();
  for (const p of data.purchases) {
    if (p.refundedAt === null) activePerReward.set(p.rewardId, (activePerReward.get(p.rewardId) ?? 0) + 1);
  }
  if ([...activePerReward.values()].some((n) => n > 1)) return fail('Ungültige Datei: doppelte Freischaltung gefunden.');
  if (balanceCents(data.transactions) < 0) return fail('Ungültige Datei: Das Guthaben wäre negativ.');

  return ok(data);
}

/** Bring older persisted data up to the current schema. */
export function migrate(raw: unknown): unknown {
  // Version 1 is the first released schema – nothing to migrate yet.
  return raw;
}
