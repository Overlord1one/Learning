import { create } from 'zustand';
import * as cmd from '../domain/commands';
import { evaluateAchievements } from '../domain/achievements';
import type { AchievementDef } from '../domain/achievements';
import { createInitialData } from '../domain/defaults';
import { sessionCredits, sessionXp } from '../domain/economy';
import { migrate, validateAppData } from '../domain/schema';
import { newlyAffordable, playerSnapshot } from '../domain/stats';
import type { PlayerSnapshot } from '../domain/stats';
import { reconcileTimer } from '../domain/timer';
import type { AppData, Result, Reward, Settings, StudySession } from '../domain/types';
import { fail, ok } from '../domain/types';
import { createLocalStorageAdapter } from './persistence';
import type { PersistenceAdapter } from './persistence';

export interface SessionCelebration {
  kind: 'session';
  session: StudySession;
  credits: number;
  xp: number;
  before: PlayerSnapshot;
  after: PlayerSnapshot;
  affordable: Reward[];
  achievements: AchievementDef[];
}

export interface UnlockCelebration {
  kind: 'unlock';
  reward: Reward;
  priceCents: number;
  balanceAfter: number;
  achievements: AchievementDef[];
}

export type Celebration = SessionCelebration | UnlockCelebration;

export interface Toast {
  id: number;
  tone: 'info' | 'success' | 'error' | 'achievement';
  title: string;
  message?: string;
}

interface AppState {
  data: AppData;
  celebration: Celebration | null;
  toasts: Toast[];
  /** Focus mode hides navigation while studying. */
  focusMode: boolean;

  // Sessions
  logSession: (input: Omit<cmd.SessionInput, 'source'>) => Result<StudySession>;
  editSession: (id: string, patch: cmd.SessionPatch) => Result<void>;
  deleteSession: (id: string) => Result<void>;
  // Timer
  startTimer: (categoryId: string, goal: string) => Result<void>;
  pauseTimer: () => void;
  resumeTimer: () => void;
  updateTimerDetails: (patch: { categoryId?: string; goal?: string }) => void;
  heartbeat: () => void;
  resolveAway: (count: boolean) => void;
  discardTimer: () => void;
  finishTimer: (input: cmd.CommitTimerInput) => Result<StudySession>;
  // Shop
  purchase: (rewardId: string) => Result<void>;
  refund: (purchaseId: string) => Result<void>;
  setRealPurchased: (purchaseId: string, bought: boolean) => Result<void>;
  addReward: (input: cmd.RewardInput) => Result<Reward>;
  updateReward: (id: string, input: cmd.RewardInput) => Result<void>;
  removeReward: (id: string) => Result<void>;
  restoreReward: (id: string) => Result<void>;
  restoreDefaultShop: () => Result<void>;
  setGoalReward: (id: string | null) => Result<void>;
  // Categories
  addCategory: (name: string, color: string) => Result<string>;
  renameCategory: (id: string, name: string, color: string) => Result<void>;
  removeCategory: (id: string) => Result<void>;
  // Settings & data
  updateSettings: (patch: Partial<Settings>) => Result<void>;
  importData: (raw: unknown) => Result<void>;
  resetProgress: () => void;
  factoryReset: () => void;
  markAchievementsSeen: (ids: string[]) => void;
  // UI
  dismissCelebration: () => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setFocusMode: (on: boolean) => void;
}

let toastSeq = 0;

function initialLoad(): { data: AppData; warning: string | null; adapter: PersistenceAdapter | null } {
  if (typeof window === 'undefined') return { data: createInitialData(), warning: null, adapter: null };
  const adapter = createLocalStorageAdapter();
  const loaded = adapter.load();
  const data = loaded.data.activeTimer
    ? { ...loaded.data, activeTimer: reconcileTimer(loaded.data.activeTimer, new Date()) }
    : loaded.data;
  return { data, warning: loaded.warning, adapter };
}

const boot = initialLoad();

/** Ids of achievements that are unlocked but have not been celebrated yet. */
function freshAchievements(data: AppData, now: Date): AchievementDef[] {
  return evaluateAchievements(data, now)
    .filter((a) => a.unlocked && !data.achievementsSeen[a.def.id])
    .map((a) => a.def);
}

export const useAppStore = create<AppState>()((set, get) => {
  const now = () => new Date();

  /** Apply a command result to the store. */
  function apply(result: Result<AppData>): Result<void> {
    if (!result.ok) return result;
    set({ data: result.value });
    return ok(undefined);
  }

  function celebrateSession(prev: AppData, outcome: cmd.AddSessionOutcome): Result<StudySession> {
    if (!outcome.created) {
      set({ data: outcome.data });
      return ok(outcome.session);
    }
    const at = now();
    const achievements = freshAchievements(outcome.data, at);
    const data = cmd.markAchievementsSeen(outcome.data, achievements.map((a) => a.id), { now: at });
    const before = playerSnapshot(prev);
    const after = playerSnapshot(data);
    set({
      data,
      celebration: {
        kind: 'session',
        session: outcome.session,
        credits: sessionCredits(outcome.session),
        xp: sessionXp(outcome.session),
        before,
        after,
        affordable: newlyAffordable(data, before.balanceCents, after.balanceCents),
        achievements,
      },
    });
    return ok(outcome.session);
  }

  return {
    data: boot.data,
    celebration: null,
    toasts: boot.warning ? [{ id: ++toastSeq, tone: 'error', title: 'Hinweis', message: boot.warning }] : [],
    focusMode: false,

    logSession(input) {
      const prev = get().data;
      const result = cmd.addSession(prev, { ...input, source: 'manual' }, { now: now() });
      if (!result.ok) return result;
      return celebrateSession(prev, result.value);
    },
    editSession: (id, patch) => apply(cmd.updateSession(get().data, id, patch, { now: now() })),
    deleteSession: (id) => apply(cmd.deleteSession(get().data, id, { now: now() })),

    startTimer: (categoryId, goal) => apply(cmd.startTimer(get().data, { categoryId, goal }, { now: now() })),
    pauseTimer: () => void apply(cmd.pauseTimer(get().data, { now: now() })),
    resumeTimer: () => void apply(cmd.resumeTimer(get().data, { now: now() })),
    updateTimerDetails: (patch) => void apply(cmd.updateTimerDetails(get().data, patch)),
    heartbeat() {
      const { data } = get();
      if (!data.activeTimer || data.activeTimer.status !== 'running') return;
      set({ data: { ...data, activeTimer: reconcileTimer(data.activeTimer, now()) } });
    },
    resolveAway: (count) => void apply(cmd.resolveTimerAway(get().data, count, { now: now() })),
    discardTimer: () => void apply(cmd.discardTimer(get().data)),
    finishTimer(input) {
      const prev = get().data;
      const result = cmd.commitTimer(prev, input, { now: now() });
      if (!result.ok) return result;
      return celebrateSession(prev, result.value);
    },

    purchase(rewardId) {
      const prev = get().data;
      const result = cmd.purchaseReward(prev, rewardId, { now: now() });
      if (!result.ok) return result;
      const at = now();
      const achievements = freshAchievements(result.value, at);
      const data = cmd.markAchievementsSeen(result.value, achievements.map((a) => a.id), { now: at });
      const reward = data.rewards.find((r) => r.id === rewardId)!;
      set({
        data,
        celebration: {
          kind: 'unlock',
          reward,
          priceCents: reward.priceCents,
          balanceAfter: playerSnapshot(data).balanceCents,
          achievements,
        },
      });
      return ok(undefined);
    },
    refund: (purchaseId) => apply(cmd.refundPurchase(get().data, purchaseId, { now: now() })),
    setRealPurchased: (purchaseId, bought) => apply(cmd.setRealPurchased(get().data, purchaseId, bought, { now: now() })),
    addReward(input) {
      const result = cmd.addReward(get().data, input, { now: now() });
      if (!result.ok) return result;
      set({ data: result.value.data });
      return ok(result.value.reward);
    },
    updateReward: (id, input) => apply(cmd.updateReward(get().data, id, input)),
    removeReward: (id) => apply(cmd.removeReward(get().data, id)),
    restoreReward: (id) => apply(cmd.restoreReward(get().data, id)),
    restoreDefaultShop: () => apply(cmd.restoreDefaultShop(get().data, { now: now() })),
    setGoalReward: (id) => apply(cmd.setGoalReward(get().data, id)),

    addCategory(name, color) {
      const result = cmd.addCategory(get().data, name, color);
      if (!result.ok) return result;
      set({ data: result.value.data });
      return ok(result.value.category.id);
    },
    renameCategory: (id, name, color) => apply(cmd.renameCategory(get().data, id, name, color)),
    removeCategory: (id) => apply(cmd.removeCategory(get().data, id)),

    updateSettings: (patch) => apply(cmd.updateSettings(get().data, patch)),
    importData(raw) {
      const result = validateAppData(migrate(raw));
      if (!result.ok) return fail(result.error);
      const data = result.value.activeTimer
        ? { ...result.value, activeTimer: reconcileTimer(result.value.activeTimer, now()) }
        : result.value;
      set({ data, celebration: null });
      return ok(undefined);
    },
    resetProgress: () => set({ data: cmd.resetProgress(get().data, { now: now() }), celebration: null }),
    factoryReset: () => set({ data: createInitialData(now()), celebration: null }),
    markAchievementsSeen: (ids) => set({ data: cmd.markAchievementsSeen(get().data, ids, { now: now() }) }),

    dismissCelebration: () => set({ celebration: null }),
    pushToast(toast) {
      const id = ++toastSeq;
      set({ toasts: [...get().toasts, { ...toast, id }].slice(-4) });
      window.setTimeout(() => get().dismissToast(id), toast.tone === 'error' ? 7000 : 4500);
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    setFocusMode: (on) => set({ focusMode: on }),
  };
});

// ---------------------------------------------------------------------------
// Persistence wiring
// ---------------------------------------------------------------------------

if (boot.adapter) {
  const a = boot.adapter;
  useAppStore.subscribe((state, prev) => {
    if (state.data === prev.data) return;
    const result = a.save(state.data);
    if (!result.ok) state.pushToast({ tone: 'error', title: 'Speicherfehler', message: result.error });
  });
  a.subscribe((data) => {
    // Another tab changed the data – adopt it so both tabs stay consistent.
    useAppStore.setState({ data });
  });
  // Persist the reconciled timer state from boot.
  a.save(useAppStore.getState().data);
}
