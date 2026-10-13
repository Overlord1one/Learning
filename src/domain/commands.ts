/**
 * Pure state transitions. Every mutation of the application data goes through
 * one of these functions, which validate input and keep the ledger consistent.
 * They are framework-agnostic so a future backend (e.g. Supabase) can reuse
 * the same rules server-side.
 */
import { balanceCents, creditsForMinutes, MAX_SESSION_MINUTES } from './economy';
import { dayKey, isValidDayKey } from './dates';
import { formatSC } from './format';
import { createId } from './ids';
import { pauseTimerAt, resolveAway, resumeTimerAt, timerElapsedMs } from './timer';
import { createInitialData, DEFAULT_REWARDS, PREOWNED_REWARDS } from './defaults';
import { fail, ok } from './types';
import type {
  AppData,
  CreditTransaction,
  Result,
  Reward,
  Settings,
  StudyCategory,
  StudySession,
  TransactionType,
} from './types';

export interface Ctx {
  now: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function txn(
  type: TransactionType,
  amountCents: number,
  now: Date,
  refs: Partial<Pick<CreditTransaction, 'sessionId' | 'purchaseId' | 'rewardId'>>,
  note: string,
): CreditTransaction {
  return {
    id: createId('tx'),
    type,
    amountCents,
    createdAt: now.toISOString(),
    sessionId: refs.sessionId ?? null,
    purchaseId: refs.purchaseId ?? null,
    rewardId: refs.rewardId ?? null,
    note,
  };
}

/** Net credits the ledger currently attributes to a session. */
export function creditedForSession(data: AppData, sessionId: string): number {
  let sum = 0;
  for (const t of data.transactions) if (t.sessionId === sessionId) sum += t.amountCents;
  return sum;
}

export function activePurchaseFor(data: AppData, rewardId: string) {
  return data.purchases.find((p) => p.rewardId === rewardId && p.refundedAt === null) ?? null;
}

export function categoryWeight(data: AppData, categoryId: string): number {
  return data.categories.find((c) => c.id === categoryId)?.weightPercent ?? 100;
}

function validWeight(weight: number): boolean {
  // Half percent steps are allowed (e.g. 37,5 % for lectures).
  return Number.isInteger(weight * 2) && weight >= 25 && weight <= 300;
}

function validWeeklyTarget(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= 7 * 24 * 60;
}

function minutesOnDay(data: AppData, date: string, excludeId?: string): number {
  let sum = 0;
  for (const s of data.sessions) if (s.date === date && s.id !== excludeId) sum += s.minutes;
  return sum;
}

const NEGATIVE_BALANCE_HINT =
  'Dein Guthaben würde dadurch negativ werden, weil die Credits bereits ausgegeben wurden. Mache zuerst eine Freischaltung im Shop rückgängig.';

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface SessionInput {
  id?: string;
  categoryId: string;
  minutes: number;
  date: string;
  source: StudySession['source'];
  startedAt?: string | null;
  endedAt?: string | null;
  goal?: string;
  description?: string;
  taskCompleted?: boolean | null;
}

function validateSessionFields(
  data: AppData,
  input: Pick<SessionInput, 'categoryId' | 'minutes' | 'date'>,
  now: Date,
  excludeId?: string,
): string | null {
  if (!Number.isInteger(input.minutes) || input.minutes < 1) {
    return 'Die Lerndauer muss mindestens 1 Minute betragen.';
  }
  if (input.minutes > MAX_SESSION_MINUTES) return 'Eine Session kann höchstens 24 Stunden dauern.';
  if (!isValidDayKey(input.date)) return 'Bitte gib ein gültiges Datum an.';
  if (input.date > dayKey(now)) return 'Sessions in der Zukunft können nicht eingetragen werden.';
  if (!data.categories.some((c) => c.id === input.categoryId)) return 'Bitte wähle eine gültige Kategorie.';
  if (minutesOnDay(data, input.date, excludeId) + input.minutes > MAX_SESSION_MINUTES) {
    return 'An diesem Tag wären damit mehr als 24 Stunden eingetragen.';
  }
  return null;
}

export interface AddSessionOutcome {
  data: AppData;
  session: StudySession;
  /** False when the session id was already recorded (idempotent no-op). */
  created: boolean;
}

/** Record a confirmed session and credit it exactly once. */
export function addSession(data: AppData, input: SessionInput, { now }: Ctx): Result<AddSessionOutcome> {
  if (input.id) {
    const existing = data.sessions.find((s) => s.id === input.id);
    if (existing) return ok({ data, session: existing, created: false });
  }
  const error = validateSessionFields(data, input, now);
  if (error) return fail(error);

  const iso = now.toISOString();
  const session: StudySession = {
    id: input.id ?? createId('ses'),
    categoryId: input.categoryId,
    minutes: input.minutes,
    date: input.date,
    source: input.source,
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? null,
    goal: (input.goal ?? '').trim(),
    description: (input.description ?? '').trim(),
    taskCompleted: input.taskCompleted ?? null,
    rates: { ...data.settings.rates },
    weightPercent: categoryWeight(data, input.categoryId),
    createdAt: iso,
    updatedAt: iso,
  };
  const amount = creditsForMinutes(session.minutes, session.rates, session.weightPercent);
  const transactions = data.transactions.some((t) => t.type === 'session_earn' && t.sessionId === session.id)
    ? data.transactions
    : [...data.transactions, txn('session_earn', amount, now, { sessionId: session.id }, `${session.minutes} Min. gelernt`)];

  return ok({ data: { ...data, sessions: [...data.sessions, session], transactions }, session, created: true });
}

export type SessionPatch = Partial<
  Pick<StudySession, 'categoryId' | 'minutes' | 'date' | 'goal' | 'description' | 'taskCompleted'>
>;

/** Edit a session. Credits are re-calculated with the rates locked in that session. */
export function updateSession(data: AppData, id: string, patch: SessionPatch, { now }: Ctx): Result<AppData> {
  const current = data.sessions.find((s) => s.id === id);
  if (!current) return fail('Diese Session existiert nicht mehr.');
  const next: StudySession = {
    ...current,
    ...patch,
    goal: (patch.goal ?? current.goal).trim(),
    description: (patch.description ?? current.description).trim(),
    // Moving a session to another subject applies that subject's weighting.
    weightPercent: patch.categoryId && patch.categoryId !== current.categoryId ? categoryWeight(data, patch.categoryId) : current.weightPercent,
    updatedAt: now.toISOString(),
  };
  const error = validateSessionFields(data, next, now, id);
  if (error) return fail(error);

  const target = creditsForMinutes(next.minutes, next.rates, next.weightPercent);
  const delta = target - creditedForSession(data, id);
  if (delta < 0 && balanceCents(data.transactions) + delta < 0) return fail(NEGATIVE_BALANCE_HINT);

  const transactions =
    delta === 0
      ? data.transactions
      : [
          ...data.transactions,
          txn('session_adjust', delta, now, { sessionId: id }, `Session korrigiert: ${current.minutes} → ${next.minutes} Min.`),
        ];
  return ok({ ...data, sessions: data.sessions.map((s) => (s.id === id ? next : s)), transactions });
}

/** Delete a session and revoke its credits. History stays traceable in the ledger. */
export function deleteSession(data: AppData, id: string, { now }: Ctx): Result<AppData> {
  const session = data.sessions.find((s) => s.id === id);
  if (!session) return fail('Diese Session existiert nicht mehr.');
  const credited = creditedForSession(data, id);
  if (balanceCents(data.transactions) - credited < 0) return fail(NEGATIVE_BALANCE_HINT);
  const transactions =
    credited === 0
      ? data.transactions
      : [
          ...data.transactions,
          txn('session_revoke', -credited, now, { sessionId: id }, `Session gelöscht (${session.minutes} Min.)`),
        ];
  return ok({ ...data, sessions: data.sessions.filter((s) => s.id !== id), transactions });
}

// ---------------------------------------------------------------------------
// Live timer
// ---------------------------------------------------------------------------

export function startTimer(data: AppData, input: { categoryId: string; goal: string }, { now }: Ctx): Result<AppData> {
  if (data.activeTimer) return fail('Es läuft bereits eine Lernsession.');
  if (!data.categories.some((c) => c.id === input.categoryId && !c.archived)) return fail('Bitte wähle eine Kategorie.');
  const iso = now.toISOString();
  return ok({
    ...data,
    activeTimer: {
      sessionId: createId('ses'),
      categoryId: input.categoryId,
      goal: input.goal.trim(),
      status: 'running',
      startedAt: iso,
      accumulatedMs: 0,
      segmentStartedAt: iso,
      heartbeatAt: iso,
      interruptedAt: null,
    },
  });
}

export function pauseTimer(data: AppData, { now }: Ctx): Result<AppData> {
  if (!data.activeTimer) return fail('Keine aktive Session.');
  if (data.activeTimer.interruptedAt) return fail('Bitte entscheide zuerst, ob die Zeit außerhalb der App mitzählt.');
  return ok({ ...data, activeTimer: pauseTimerAt(data.activeTimer, now) });
}

export function resumeTimer(data: AppData, { now }: Ctx): Result<AppData> {
  if (!data.activeTimer) return fail('Keine aktive Session.');
  return ok({ ...data, activeTimer: resumeTimerAt(data.activeTimer, now) });
}

export function updateTimerDetails(data: AppData, patch: { categoryId?: string; goal?: string }): Result<AppData> {
  if (!data.activeTimer) return fail('Keine aktive Session.');
  return ok({ ...data, activeTimer: { ...data.activeTimer, ...patch } });
}

/** Decide whether time spent outside the app counts as study time. */
export function resolveTimerAway(data: AppData, count: boolean, { now }: Ctx): Result<AppData> {
  if (!data.activeTimer) return fail('Keine aktive Session.');
  return ok({ ...data, activeTimer: resolveAway(data.activeTimer, count, now) });
}

export function discardTimer(data: AppData): Result<AppData> {
  return ok({ ...data, activeTimer: null });
}

export interface CommitTimerInput {
  minutes: number;
  categoryId: string;
  goal: string;
  description: string;
  taskCompleted: boolean | null;
}

/**
 * Turn the live timer into a confirmed session. The confirmed duration can be
 * corrected downwards but never exceed what the timer measured.
 */
export function commitTimer(data: AppData, input: CommitTimerInput, ctx: Ctx): Result<AddSessionOutcome> {
  const timer = data.activeTimer;
  if (!timer) return fail('Keine aktive Session.');
  if (timer.interruptedAt) return fail('Bitte entscheide zuerst, ob die Zeit außerhalb der App mitzählt.');
  const measured = Math.max(1, Math.ceil(timerElapsedMs(timer, ctx.now) / 60_000));
  if (input.minutes > measured) {
    return fail(`Die bestätigte Zeit kann die gemessene Zeit (${measured} Min.) nicht überschreiten.`);
  }
  const startedAt = new Date(timer.startedAt);
  const result = addSession(
    data,
    {
      id: timer.sessionId,
      categoryId: input.categoryId,
      minutes: input.minutes,
      date: dayKey(startedAt) > dayKey(ctx.now) ? dayKey(ctx.now) : dayKey(startedAt),
      source: 'timer',
      startedAt: timer.startedAt,
      endedAt: ctx.now.toISOString(),
      goal: input.goal,
      description: input.description,
      taskCompleted: input.taskCompleted,
    },
    ctx,
  );
  if (!result.ok) return result;
  return ok({ ...result.value, data: { ...result.value.data, activeTimer: null } });
}

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------

export function purchaseReward(data: AppData, rewardId: string, { now }: Ctx): Result<AppData> {
  const reward = data.rewards.find((r) => r.id === rewardId);
  if (!reward || reward.archived) return fail('Diese Belohnung ist nicht verfügbar.');
  if (reward.preOwned) return fail('Diesen Artikel besitzt du bereits.');
  if (activePurchaseFor(data, rewardId)) return fail('Diese Belohnung ist bereits freigeschaltet.');
  const balance = balanceCents(data.transactions);
  if (balance < reward.priceCents) {
    return fail(`Nicht genug Credits. Es fehlen noch ${formatSC(reward.priceCents - balance)}.`);
  }
  const purchaseId = createId('pur');
  const iso = now.toISOString();
  return ok({
    ...data,
    purchases: [
      ...data.purchases,
      { id: purchaseId, rewardId, rewardName: reward.name, priceCents: reward.priceCents, unlockedAt: iso, realPurchasedAt: null, refundedAt: null },
    ],
    transactions: [
      ...data.transactions,
      txn('purchase', -reward.priceCents, now, { purchaseId, rewardId }, `Freigeschaltet: ${reward.name}`),
    ],
  });
}

/** Reverse an unlock: refund exactly the price that was paid. */
export function refundPurchase(data: AppData, purchaseId: string, { now }: Ctx): Result<AppData> {
  const purchase = data.purchases.find((p) => p.id === purchaseId);
  if (!purchase) return fail('Freischaltung nicht gefunden.');
  if (purchase.refundedAt) return fail('Diese Freischaltung wurde bereits rückgängig gemacht.');
  const iso = now.toISOString();
  return ok({
    ...data,
    purchases: data.purchases.map((p) => (p.id === purchaseId ? { ...p, refundedAt: iso } : p)),
    transactions: [
      ...data.transactions,
      txn('refund', purchase.priceCents, now, { purchaseId, rewardId: purchase.rewardId }, `Rückgängig: ${purchase.rewardName}`),
    ],
  });
}

export function setRealPurchased(data: AppData, purchaseId: string, bought: boolean, { now }: Ctx): Result<AppData> {
  const purchase = data.purchases.find((p) => p.id === purchaseId);
  if (!purchase || purchase.refundedAt) return fail('Freischaltung nicht gefunden.');
  return ok({
    ...data,
    purchases: data.purchases.map((p) =>
      p.id === purchaseId ? { ...p, realPurchasedAt: bought ? now.toISOString() : null } : p,
    ),
  });
}

// ---------------------------------------------------------------------------
// Rewards (custom + shop management)
// ---------------------------------------------------------------------------

export type RewardInput = Pick<
  Reward,
  'name' | 'description' | 'category' | 'variant' | 'icon' | 'imageUrl' | 'priceCents' | 'realPriceEuroCents' | 'productUrl' | 'priority' | 'preOwned'
>;

function validateReward(input: RewardInput): string | null {
  if (!input.name.trim()) return 'Bitte gib einen Namen ein.';
  if (input.name.trim().length > 80) return 'Der Name ist zu lang (max. 80 Zeichen).';
  if (!input.preOwned && (!Number.isInteger(input.priceCents) || input.priceCents < 1)) {
    return 'Der virtuelle Preis muss größer als 0 SC sein.';
  }
  if (input.priceCents > 100_000_00) return 'Der virtuelle Preis ist zu hoch.';
  if (input.realPriceEuroCents !== null && (!Number.isInteger(input.realPriceEuroCents) || input.realPriceEuroCents < 0)) {
    return 'Der reale Preis ist ungültig.';
  }
  if (input.productUrl && !/^https?:\/\//i.test(input.productUrl)) return 'Die Produkt-URL muss mit http(s):// beginnen.';
  if (input.imageUrl && !/^(https?:\/\/|data:image\/)/i.test(input.imageUrl)) return 'Die Bild-URL ist ungültig.';
  return null;
}

export function addReward(data: AppData, input: RewardInput, { now }: Ctx): Result<{ data: AppData; reward: Reward }> {
  const error = validateReward(input);
  if (error) return fail(error);
  const reward: Reward = {
    ...input,
    name: input.name.trim(),
    description: input.description.trim(),
    category: input.category.trim() || 'Eigene Belohnung',
    priceCents: input.preOwned ? Math.max(0, input.priceCents) : input.priceCents,
    id: createId('rw'),
    isDefault: false,
    archived: false,
    createdAt: now.toISOString(),
    sortOrder: Math.max(0, ...data.rewards.map((r) => r.sortOrder)) + 1,
  };
  return ok({ data: { ...data, rewards: [...data.rewards, reward] }, reward });
}

export function updateReward(data: AppData, id: string, input: RewardInput): Result<AppData> {
  const current = data.rewards.find((r) => r.id === id);
  if (!current) return fail('Belohnung nicht gefunden.');
  const error = validateReward(input);
  if (error) return fail(error);
  if (input.preOwned && activePurchaseFor(data, id)) {
    return fail('Eine freigeschaltete Belohnung kann nicht als „bereits vorhanden“ markiert werden. Mache die Freischaltung zuerst rückgängig.');
  }
  // Price changes never touch past purchases – they keep their own price snapshot.
  return ok({
    ...data,
    rewards: data.rewards.map((r) => (r.id === id ? { ...r, ...input, name: input.name.trim(), description: input.description.trim() } : r)),
  });
}

/** Remove a reward. Rewards with purchase history are archived to stay traceable. */
export function removeReward(data: AppData, id: string): Result<AppData> {
  const reward = data.rewards.find((r) => r.id === id);
  if (!reward) return fail('Belohnung nicht gefunden.');
  if (activePurchaseFor(data, id)) {
    return fail('Diese Belohnung ist freigeschaltet. Mache die Freischaltung zuerst rückgängig, bevor du sie entfernst.');
  }
  const hasHistory = data.purchases.some((p) => p.rewardId === id);
  const rewards =
    hasHistory || reward.isDefault
      ? data.rewards.map((r) => (r.id === id ? { ...r, archived: true } : r))
      : data.rewards.filter((r) => r.id !== id);
  const settings = data.settings.goalRewardId === id ? { ...data.settings, goalRewardId: null } : data.settings;
  return ok({ ...data, rewards, settings });
}

export function restoreReward(data: AppData, id: string): Result<AppData> {
  return ok({ ...data, rewards: data.rewards.map((r) => (r.id === id ? { ...r, archived: false } : r)) });
}

/** Restore the five original items (and the pre-owned mouse) to factory values. */
export function restoreDefaultShop(data: AppData, { now }: Ctx): Result<AppData> {
  const seeds = [...PREOWNED_REWARDS, ...DEFAULT_REWARDS];
  const rewards = data.rewards.map((r) => {
    const seed = seeds.find((s) => s.id === r.id);
    return seed ? { ...seed, createdAt: r.createdAt } : r;
  });
  for (const seed of seeds) {
    if (!rewards.some((r) => r.id === seed.id)) rewards.push({ ...seed, createdAt: now.toISOString() });
  }
  return ok({ ...data, rewards });
}

export function setGoalReward(data: AppData, rewardId: string | null): Result<AppData> {
  if (rewardId && !data.rewards.some((r) => r.id === rewardId && !r.archived && !r.preOwned)) {
    return fail('Diese Belohnung kann nicht als Ziel gewählt werden.');
  }
  return ok({ ...data, settings: { ...data.settings, goalRewardId: rewardId } });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function addCategory(
  data: AppData,
  name: string,
  color: string,
  weightPercent = 100,
  weeklyTargetMinutes = 0,
): Result<{ data: AppData; category: StudyCategory }> {
  const trimmed = name.trim();
  if (!validWeight(weightPercent)) return fail('Die Gewichtung ist ungültig.');
  if (!validWeeklyTarget(weeklyTargetMinutes)) return fail('Das Wochenziel ist ungültig.');
  if (!trimmed) return fail('Bitte gib einen Namen für die Kategorie ein.');
  if (trimmed.length > 40) return fail('Der Name ist zu lang (max. 40 Zeichen).');
  const existing = data.categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing && !existing.archived) return fail('Diese Kategorie gibt es bereits.');
  if (existing) {
    const category = { ...existing, archived: false, color, weightPercent, weeklyTargetMinutes };
    return ok({ data: { ...data, categories: data.categories.map((c) => (c.id === existing.id ? category : c)) }, category });
  }
  const category: StudyCategory = { id: createId('cat'), name: trimmed, color, isDefault: false, archived: false, weightPercent, weeklyTargetMinutes };
  return ok({ data: { ...data, categories: [...data.categories, category] }, category });
}

/** Categories used by sessions are archived (hidden from pickers) instead of deleted. */
export function removeCategory(data: AppData, id: string): Result<AppData> {
  const category = data.categories.find((c) => c.id === id);
  if (!category) return fail('Kategorie nicht gefunden.');
  if (data.categories.filter((c) => !c.archived).length <= 1) return fail('Mindestens eine Kategorie wird benötigt.');
  if (data.activeTimer?.categoryId === id) return fail('Diese Kategorie wird von der laufenden Session verwendet.');
  const used = data.sessions.some((s) => s.categoryId === id);
  const categories = used || category.isDefault
    ? data.categories.map((c) => (c.id === id ? { ...c, archived: true } : c))
    : data.categories.filter((c) => c.id !== id);
  let settings = data.settings;
  if (settings.defaultCategoryId === id) {
    const fallback = categories.find((c) => !c.archived);
    settings = { ...settings, defaultCategoryId: fallback?.id ?? settings.defaultCategoryId };
  }
  return ok({ ...data, categories, settings });
}

/** Edit a subject. A new weighting applies to future sessions only. */
export function renameCategory(
  data: AppData,
  id: string,
  name: string,
  color: string,
  weightPercent?: number,
  weeklyTargetMinutes?: number,
): Result<AppData> {
  const trimmed = name.trim();
  if (weightPercent !== undefined && !validWeight(weightPercent)) return fail('Die Gewichtung ist ungültig.');
  if (weeklyTargetMinutes !== undefined && !validWeeklyTarget(weeklyTargetMinutes)) return fail('Das Wochenziel ist ungültig.');
  if (!trimmed) return fail('Bitte gib einen Namen ein.');
  if (data.categories.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase() && !c.archived)) {
    return fail('Diese Kategorie gibt es bereits.');
  }
  return ok({
    ...data,
    categories: data.categories.map((c) => (c.id === id ? {
            ...c,
            name: trimmed,
            color,
            weightPercent: weightPercent ?? c.weightPercent,
            weeklyTargetMinutes: weeklyTargetMinutes ?? c.weeklyTargetMinutes,
          } : c)),
  });
}

// ---------------------------------------------------------------------------
// Settings & data management
// ---------------------------------------------------------------------------

export function updateSettings(data: AppData, patch: Partial<Settings>): Result<AppData> {
  const next = { ...data.settings, ...patch };
  if (next.rates.creditCentsPerHour < 1 || next.rates.creditCentsPerHour > 100_000) {
    return fail('Die Credit-Rate muss zwischen 0,01 und 1.000 SC pro Stunde liegen.');
  }
  if (!Number.isInteger(next.rates.xpPerHour) || next.rates.xpPerHour < 1 || next.rates.xpPerHour > 10_000) {
    return fail('Die XP-Rate muss eine ganze Zahl zwischen 1 und 10.000 sein.');
  }
  if (!Number.isInteger(next.dailyGoalMinutes) || next.dailyGoalMinutes < 0 || next.dailyGoalMinutes > MAX_SESSION_MINUTES) {
    return fail('Das Tagesziel ist ungültig.');
  }
  if (next.profileName.length > 40) return fail('Der Name ist zu lang (max. 40 Zeichen).');
  if (next.ranks.length === 0 || !next.ranks.some((r) => r.minLevel === 1)) return fail('Es wird ein Rang für Level 1 benötigt.');
  if (next.ranks.some((r) => !r.name.trim())) return fail('Ränge benötigen einen Namen.');
  return ok({ ...data, settings: next });
}

export function markAchievementsSeen(data: AppData, ids: string[], { now }: Ctx): AppData {
  const fresh = ids.filter((id) => !data.achievementsSeen[id]);
  if (fresh.length === 0) return data;
  const seen = { ...data.achievementsSeen };
  for (const id of fresh) seen[id] = now.toISOString();
  return { ...data, achievementsSeen: seen };
}

/** Clear learning progress but keep settings, categories and the shop configuration. */
export function resetProgress(data: AppData, { now }: Ctx): AppData {
  const fresh = createInitialData(now);
  return {
    ...data,
    createdAt: now.toISOString(),
    sessions: [],
    transactions: [],
    purchases: [],
    achievementsSeen: {},
    activeTimer: null,
    rewards: data.rewards.filter((r) => !r.archived || r.isDefault).map((r) => (r.isDefault ? { ...r, archived: false } : r)),
    settings: { ...data.settings, goalRewardId: data.settings.goalRewardId ?? fresh.settings.goalRewardId },
  };
}
