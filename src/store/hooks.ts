import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion as useSystemReducedMotion } from 'motion/react';
import { levelProgress, totalXp, balanceCents } from '../domain/economy';
import { rankForLevel } from '../domain/ranks';
import { studyStats } from '../domain/stats';
import { useAppStore } from './appStore';

export const useData = () => useAppStore((s) => s.data);

export function usePlayer() {
  const data = useData();
  return useMemo(() => {
    const xp = totalXp(data.sessions);
    const progress = levelProgress(xp);
    return {
      xp,
      balanceCents: balanceCents(data.transactions),
      level: progress.level,
      progress,
      rank: rankForLevel(progress.level, data.settings.ranks),
      name: data.settings.profileName.trim(),
    };
  }, [data.sessions, data.transactions, data.settings.ranks, data.settings.profileName]);
}

/** A Date that refreshes on an interval – used for live views. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useStudyStats() {
  const sessions = useAppStore((s) => s.data.sessions);
  const now = useNow();
  const day = now.toDateString();
  return useMemo(() => studyStats(sessions, new Date()), [sessions, day]);
}

/** Combines the in-app motion setting with the OS preference. */
export function useReducedMotion(): boolean {
  const pref = useAppStore((s) => s.data.settings.motion);
  const system = useSystemReducedMotion();
  if (pref === 'reduced') return true;
  if (pref === 'full') return false;
  return Boolean(system);
}

export const useActiveCategories = () => {
  const categories = useAppStore((s) => s.data.categories);
  return useMemo(() => categories.filter((c) => !c.archived), [categories]);
};
