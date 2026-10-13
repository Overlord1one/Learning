import type { ActiveTimer } from './types';

/** If no open tab confirmed the timer for this long, the session counts as interrupted. */
export const HEARTBEAT_GRACE_MS = 3 * 60_000;
export const HEARTBEAT_INTERVAL_MS = 15_000;
/** Hard cap so a forgotten timer can never produce absurd durations. */
export const MAX_TIMER_MS = 12 * 60 * 60_000;

/** Focused milliseconds – paused time is never counted. */
export function timerElapsedMs(timer: ActiveTimer, now: Date): number {
  let ms = timer.accumulatedMs;
  if (timer.status === 'running' && timer.segmentStartedAt) {
    ms += Math.max(0, now.getTime() - Date.parse(timer.segmentStartedAt));
  }
  return Math.min(Math.max(0, ms), MAX_TIMER_MS);
}

export function pauseTimerAt(timer: ActiveTimer, at: Date): ActiveTimer {
  if (timer.status !== 'running') return timer;
  // A pending gap must be decided before pausing, otherwise it would be counted.
  if (timer.interruptedAt) return timer;
  return {
    ...timer,
    accumulatedMs: timerElapsedMs(timer, at),
    status: 'paused',
    segmentStartedAt: null,
    heartbeatAt: at.toISOString(),
  };
}

export function resumeTimerAt(timer: ActiveTimer, at: Date): ActiveTimer {
  if (timer.status !== 'paused') return timer;
  return {
    ...timer,
    status: 'running',
    segmentStartedAt: at.toISOString(),
    heartbeatAt: at.toISOString(),
    interruptedAt: null,
  };
}

/**
 * Called on app start, when the app becomes visible and on every heartbeat.
 * When the app was closed or the phone was locked while the timer was running
 * (iOS freezes the app then), the gap is flagged with `interruptedAt` so the
 * user can decide whether that time counts. Nothing is counted silently: the
 * timer keeps running, and the decision is made via `resolveAway`.
 */
export function reconcileTimer(timer: ActiveTimer, now: Date): ActiveTimer {
  if (timer.status !== 'running') return timer;
  const lastAlive = Date.parse(timer.heartbeatAt);
  if (!timer.interruptedAt && now.getTime() - lastAlive > HEARTBEAT_GRACE_MS) {
    return { ...timer, interruptedAt: timer.heartbeatAt, heartbeatAt: now.toISOString() };
  }
  return { ...timer, heartbeatAt: now.toISOString() };
}

/** Milliseconds the app was away (not confirmed alive) – 0 if no gap is pending. */
export function awayMs(timer: ActiveTimer, now: Date): number {
  if (!timer.interruptedAt) return 0;
  return Math.max(0, now.getTime() - Date.parse(timer.interruptedAt));
}

/**
 * Resolve a pending gap. `count = true` keeps the time away as study time;
 * `count = false` removes it – the timer continues from now as if it had been
 * paused while the app was inactive.
 */
export function resolveAway(timer: ActiveTimer, count: boolean, now: Date): ActiveTimer {
  if (!timer.interruptedAt) return timer;
  if (count || timer.status !== 'running') return { ...timer, interruptedAt: null };
  const until = new Date(timer.interruptedAt);
  return {
    ...timer,
    accumulatedMs: timerElapsedMs(timer, until),
    segmentStartedAt: now.toISOString(),
    heartbeatAt: now.toISOString(),
    interruptedAt: null,
  };
}

/** Minutes the timer measured – the default proposal in the summary. */
export const measuredMinutes = (timer: ActiveTimer, now: Date) =>
  Math.floor(timerElapsedMs(timer, now) / 60_000);
