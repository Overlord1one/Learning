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
 * Called on app start and on every heartbeat. When the app was closed or the
 * device slept while the timer was running, the timer is paused at the last
 * confirmed moment instead of silently counting the gap.
 */
export function reconcileTimer(timer: ActiveTimer, now: Date): ActiveTimer {
  if (timer.status !== 'running') return timer;
  const lastAlive = Date.parse(timer.heartbeatAt);
  if (now.getTime() - lastAlive > HEARTBEAT_GRACE_MS) {
    const paused = pauseTimerAt(timer, new Date(lastAlive));
    return { ...paused, interruptedAt: timer.heartbeatAt };
  }
  return { ...timer, heartbeatAt: now.toISOString() };
}

/** Minutes the timer measured – the default proposal in the summary. */
export const measuredMinutes = (timer: ActiveTimer, now: Date) =>
  Math.floor(timerElapsedMs(timer, now) / 60_000);
