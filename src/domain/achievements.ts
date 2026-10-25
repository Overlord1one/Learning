/** Achievements are derived from real progress only – they cannot be granted manually. */
import { DEFAULT_REWARD_IDS } from './defaults';
import { studyStats } from './stats';
import { dayKey, parseDayKey, startOfWeek } from './dates';
import type { AppData } from './types';

export type AchievementIcon = 'footprints' | 'flame' | 'calendar' | 'calendarCheck' | 'brain' | 'gift' | 'layers' | 'crown' | 'clock' | 'trophy';

export interface AchievementContext {
  totalMinutes: number;
  sessionCount: number;
  bestStreak: number;
  longestSessionMinutes: number;
  /** Most math minutes studied within a single calendar week (Mon–Sun). */
  bestMathWeekMinutes: number;
  unlockedRewardIds: Set<string>;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  tier: 'bronze' | 'silber' | 'gold';
  /** Returns current progress (0 … target). */
  progress: (ctx: AchievementContext) => number;
  target: number;
  unit: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'erster-schritt',
    title: 'Erster Schritt',
    description: 'Schließe deine erste Lernsession ab.',
    icon: 'footprints',
    tier: 'bronze',
    progress: (c) => c.sessionCount,
    target: 1,
    unit: 'Session',
  },
  {
    id: 'warmgelaufen',
    title: 'Warmgelaufen',
    description: 'Lerne insgesamt 5 Stunden.',
    icon: 'flame',
    tier: 'bronze',
    progress: (c) => c.totalMinutes / 60,
    target: 5,
    unit: 'h',
  },
  {
    id: 'dranbleiben',
    title: 'Dranbleiben',
    description: 'Erreiche eine Lernserie von 3 Tagen.',
    icon: 'calendar',
    tier: 'bronze',
    progress: (c) => c.bestStreak,
    target: 3,
    unit: 'Tage',
  },
  {
    id: 'konsequent',
    title: 'Konsequent',
    description: 'Erreiche eine Lernserie von 7 Tagen.',
    icon: 'calendarCheck',
    tier: 'silber',
    progress: (c) => c.bestStreak,
    target: 7,
    unit: 'Tage',
  },
  {
    id: 'deep-work',
    title: 'Deep Work',
    description: 'Lerne 120 Minuten am Stück in einer einzigen Session.',
    icon: 'brain',
    tier: 'silber',
    progress: (c) => c.longestSessionMinutes,
    target: 120,
    unit: 'Min.',
  },
  {
    id: 'mathe-woche',
    title: 'Mathe-Woche',
    description: 'Lerne 8 Stunden Mathematik innerhalb einer Woche (Mo–So).',
    icon: 'brain',
    tier: 'silber',
    progress: (c) => c.bestMathWeekMinutes / 60,
    target: 8,
    unit: 'h',
  },
  {
    id: 'ausdauer',
    title: 'Ausdauer',
    description: 'Lerne insgesamt 50 Stunden.',
    icon: 'clock',
    tier: 'silber',
    progress: (c) => c.totalMinutes / 60,
    target: 50,
    unit: 'h',
  },
  {
    id: 'erstes-upgrade',
    title: 'Erstes Upgrade',
    description: 'Schalte deine erste Belohnung im Shop frei.',
    icon: 'gift',
    tier: 'bronze',
    progress: (c) => c.unlockedRewardIds.size,
    target: 1,
    unit: 'Belohnung',
  },
  {
    id: 'setup-builder',
    title: 'Setup Builder',
    description: 'Schalte drei Belohnungen frei.',
    icon: 'layers',
    tier: 'silber',
    progress: (c) => c.unlockedRewardIds.size,
    target: 3,
    unit: 'Belohnungen',
  },
  {
    id: 'hundert-stunden',
    title: 'Hundert Stunden',
    description: 'Lerne insgesamt 100 Stunden.',
    icon: 'trophy',
    tier: 'gold',
    progress: (c) => c.totalMinutes / 60,
    target: 100,
    unit: 'h',
  },
  {
    id: 'marathon',
    title: 'Marathon',
    description: 'Lerne insgesamt 250 Stunden.',
    icon: 'flame',
    tier: 'gold',
    progress: (c) => c.totalMinutes / 60,
    target: 250,
    unit: 'h',
  },
  {
    id: 'final-setup',
    title: 'Final Setup',
    description: 'Schalte alle fünf ursprünglichen Belohnungen frei.',
    icon: 'crown',
    tier: 'gold',
    progress: (c) => DEFAULT_REWARD_IDS.filter((id) => c.unlockedRewardIds.has(id)).length,
    target: DEFAULT_REWARD_IDS.length,
    unit: 'Belohnungen',
  },
];

export function achievementContext(data: AppData, now: Date): AchievementContext {
  // Learning achievements count only learning – creative subjects (video editing) are excluded.
  const stats = studyStats(data.sessions.filter((s) => !s.creative), now);
  return {
    totalMinutes: stats.totalMinutes,
    sessionCount: stats.sessionCount,
    bestStreak: stats.bestStreak,
    longestSessionMinutes: stats.longestSessionMinutes,
    bestMathWeekMinutes: bestWeekMinutes(data, 'cat-mathe'),
    unlockedRewardIds: new Set(data.purchases.filter((p) => p.refundedAt === null).map((p) => p.rewardId)),
  };
}

function bestWeekMinutes(data: AppData, categoryId: string): number {
  const weeks = new Map<string, number>();
  for (const s of data.sessions) {
    if (s.categoryId !== categoryId) continue;
    const week = dayKey(startOfWeek(parseDayKey(s.date)));
    weeks.set(week, (weeks.get(week) ?? 0) + s.minutes);
  }
  return Math.max(0, ...weeks.values());
}

export interface AchievementState {
  def: AchievementDef;
  unlocked: boolean;
  value: number;
  ratio: number;
  seenAt: string | null;
}

export function evaluateAchievements(data: AppData, now: Date): AchievementState[] {
  const ctx = achievementContext(data, now);
  return ACHIEVEMENTS.map((def) => {
    const value = Math.min(def.progress(ctx), def.target);
    const unlocked = def.progress(ctx) >= def.target;
    return { def, unlocked, value, ratio: value / def.target, seenAt: unlocked ? (data.achievementsSeen[def.id] ?? null) : null };
  });
}
