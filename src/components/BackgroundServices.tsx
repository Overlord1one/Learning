import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { evaluateAchievements } from '../domain/achievements';
import { HEARTBEAT_INTERVAL_MS, timerElapsedMs } from '../domain/timer';
import { studyStats } from '../domain/stats';
import { formatMinutes } from '../domain/format';

function notify(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.svg' });
  } catch {
    /* some browsers only allow notifications from service workers */
  }
}

/** Non-visual effects: timer heartbeat, theme attributes, achievements, reminders. */
export function BackgroundServices() {
  const data = useAppStore((s) => s.data);
  const celebration = useAppStore((s) => s.celebration);
  const heartbeat = useAppStore((s) => s.heartbeat);
  const pushToast = useAppStore((s) => s.pushToast);
  const markSeen = useAppStore((s) => s.markAchievementsSeen);
  const timerRunning = data.activeTimer?.status === 'running';

  // Keep the live timer alive. A gap (sleep, closed tab) pauses it at the last heartbeat.
  useEffect(() => {
    if (!timerRunning) return;
    heartbeat();
    const id = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    const onVisible = () => document.visibilityState === 'visible' && heartbeat();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', heartbeat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', heartbeat);
    };
  }, [timerRunning, heartbeat]);

  // Appearance
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = data.settings.accent;
    root.dataset.motion = data.settings.motion;
  }, [data.settings.accent, data.settings.motion]);

  // Achievements unlocked outside of a celebration (e.g. after an import or edits).
  useEffect(() => {
    if (celebration) return;
    const fresh = evaluateAchievements(data, new Date()).filter((a) => a.unlocked && !data.achievementsSeen[a.def.id]);
    if (fresh.length === 0) return;
    markSeen(fresh.map((a) => a.def.id));
    for (const a of fresh) pushToast({ tone: 'achievement', title: `Erfolg: ${a.def.title}`, message: a.def.description });
  }, [data, celebration, markSeen, pushToast]);

  // Timer reminder notification
  const remindedFor = useRef<string | null>(null);
  useEffect(() => {
    const timer = data.activeTimer;
    const minutes = data.settings.timerReminderMinutes;
    if (!timer || timer.status !== 'running' || minutes <= 0) return;
    const key = `${timer.sessionId}-${minutes}`;
    if (remindedFor.current === key) return;
    const remaining = minutes * 60_000 - timerElapsedMs(timer, new Date());
    const fire = () => {
      remindedFor.current = key;
      pushToast({ tone: 'info', title: 'Zeit für eine Pause?', message: `Du lernst seit ${formatMinutes(minutes)}.` });
      notify('Setup Quest', `Du lernst seit ${formatMinutes(minutes)} – Zeit für eine kurze Pause?`);
    };
    if (remaining <= 0) return;
    const id = window.setTimeout(fire, remaining);
    return () => window.clearTimeout(id);
  }, [data.activeTimer, data.settings.timerReminderMinutes, pushToast]);

  // Daily goal: celebrate the moment it is reached (not on app start).
  const goalState = useRef<{ day: string; reached: boolean } | null>(null);
  useEffect(() => {
    const goal = data.settings.dailyGoalMinutes;
    if (goal <= 0) return;
    const today = new Date().toDateString();
    const todayMinutes = studyStats(data.sessions, new Date()).todayMinutes;
    const reached = todayMinutes >= goal;
    const prev = goalState.current;
    goalState.current = { day: today, reached };
    if (prev && prev.day === today && !prev.reached && reached) {
      pushToast({ tone: 'success', title: 'Tagesziel erreicht', message: `Du hast heute ${formatMinutes(todayMinutes)} gelernt.` });
      if (data.settings.notifications) notify('Tagesziel erreicht', `Du hast heute ${formatMinutes(todayMinutes)} gelernt.`);
    }
  }, [data.sessions, data.settings.dailyGoalMinutes, data.settings.notifications, pushToast]);

  return null;
}
