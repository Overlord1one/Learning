/**
 * Domain model for SETUP QUEST.
 *
 * Money-like values are stored as integer "centi credits" (1 SC = 100 units)
 * so no floating point arithmetic touches the balance. Study durations are
 * stored as whole minutes. All aggregate numbers (balance, XP, level, streaks…)
 * are derived from these authoritative records – never stored separately.
 */

export type ISODateTime = string; // 2026-10-13T08:15:00.000Z
export type DayKey = string; // 2026-10-13 (local calendar day)

export const SCHEMA_VERSION = 4;

/** Rates that were valid when a session was recorded. Locked per session. */
export interface RateSnapshot {
  /** Centi credits earned per 60 focused minutes (default 1000 = 10 SC). */
  creditCentsPerHour: number;
  /** XP earned per 60 focused minutes (default 60). */
  xpPerHour: number;
}

export interface StudyCategory {
  id: string;
  name: string;
  /** Hex color used in charts and chips. */
  color: string;
  isDefault: boolean;
  archived: boolean;
  /**
   * Priority weighting of this subject in percent (100 = normal). A math hour
   * at 120 % earns 12 SC and 72 XP instead of 10 SC and 60 XP.
   */
  weightPercent: number;
  /** Planned study time per week in minutes (0 = no weekly target). */
  weeklyTargetMinutes: number;
}

export type SessionSource = 'timer' | 'manual';

export interface StudySession {
  id: string;
  categoryId: string;
  /** Confirmed focused minutes (integer, 1 … 1440). */
  minutes: number;
  /** Local calendar day the study happened on. */
  date: DayKey;
  source: SessionSource;
  startedAt: ISODateTime | null;
  endedAt: ISODateTime | null;
  goal: string;
  description: string;
  /** null = not specified. */
  taskCompleted: boolean | null;
  rates: RateSnapshot;
  /** Subject weighting locked in when the session was recorded (or its subject changed). */
  weightPercent: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type TransactionType =
  | 'session_earn' // credits granted for a confirmed session
  | 'session_adjust' // delta after a session was edited
  | 'session_revoke' // session deleted → credits removed
  | 'purchase' // reward unlocked
  | 'refund'; // reward unlock reversed

/** Append-only credit ledger. The balance is the sum of all amounts. */
export interface CreditTransaction {
  id: string;
  type: TransactionType;
  /** Signed centi credits. */
  amountCents: number;
  createdAt: ISODateTime;
  sessionId: string | null;
  purchaseId: string | null;
  rewardId: string | null;
  note: string;
}

export type RewardPriority = 'niedrig' | 'mittel' | 'hoch';

export type RewardIcon =
  | 'mousepad'
  | 'mouse'
  | 'keyboard'
  | 'headphones'
  | 'desk'
  | 'monitor'
  | 'lamp'
  | 'chair'
  | 'speaker'
  | 'gift';

export interface Reward {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Short configuration / color note, e.g. "Weiß / Hellgrau". */
  variant: string;
  icon: RewardIcon;
  /** Remote URL or data URL (uploaded image, downscaled). */
  imageUrl: string;
  priceCents: number;
  /** Optional real-world price in euro cents – informational only. */
  realPriceEuroCents: number | null;
  productUrl: string;
  priority: RewardPriority;
  /** Part of the original five-item shop. */
  isDefault: boolean;
  /** Already owned before using the app – shown in inventory, not purchasable. */
  preOwned: boolean;
  /** Archived rewards are hidden from the shop but keep purchase history. */
  archived: boolean;
  createdAt: ISODateTime;
  sortOrder: number;
}

export interface RewardPurchase {
  id: string;
  rewardId: string;
  /** Snapshot of the reward name at unlock time for traceability. */
  rewardName: string;
  /** Price paid at unlock time. Never changes afterwards. */
  priceCents: number;
  unlockedAt: ISODateTime;
  /** Set when the user marks the real-world product as bought. */
  realPurchasedAt: ISODateTime | null;
  /** Set when the unlock was reversed (credits refunded). */
  refundedAt: ISODateTime | null;
}

export interface RankTier {
  minLevel: number;
  name: string;
}

export type MotionPreference = 'system' | 'reduced' | 'full';
export type AccentName = 'blau' | 'gruen' | 'violett';

export interface Settings {
  profileName: string;
  dailyGoalMinutes: number;
  defaultCategoryId: string;
  rates: RateSnapshot;
  ranks: RankTier[];
  goalRewardId: string | null;
  motion: MotionPreference;
  accent: AccentName;
  /** Timer: remind via browser notification after N minutes (0 = off). */
  timerReminderMinutes: number;
  /** Timer: quick presets shown on the study page, in minutes. */
  sessionPresets: number[];
  /** Ask for browser notification when the daily goal is reached. */
  notifications: boolean;
}

export type TimerStatus = 'running' | 'paused';

/**
 * Persisted live timer. Elapsed time is computed from timestamps, so the
 * timer survives reloads and never counts paused time.
 */
export interface ActiveTimer {
  /** The id the resulting session will receive – guarantees idempotency. */
  sessionId: string;
  categoryId: string;
  goal: string;
  status: TimerStatus;
  startedAt: ISODateTime;
  /** Milliseconds accumulated across finished running segments. */
  accumulatedMs: number;
  /** Start of the current running segment (null while paused). */
  segmentStartedAt: ISODateTime | null;
  /** Last time an open tab confirmed the timer was alive. */
  heartbeatAt: ISODateTime;
  /** Set when the timer was auto-paused because the app was closed. */
  interruptedAt: ISODateTime | null;
}

export interface AppData {
  schemaVersion: number;
  createdAt: ISODateTime;
  settings: Settings;
  categories: StudyCategory[];
  sessions: StudySession[];
  transactions: CreditTransaction[];
  rewards: Reward[];
  purchases: RewardPurchase[];
  /** Achievement id → first time the user saw it unlocked. */
  achievementsSeen: Record<string, ISODateTime>;
  activeTimer: ActiveTimer | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });
