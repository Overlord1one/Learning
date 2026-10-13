import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CalendarRange, Check } from 'lucide-react';
import { useData, useNow, useReducedMotion } from '../store/hooks';
import { weeklyPlan } from '../domain/stats';
import { formatDecimal, formatHours } from '../domain/format';
import { Button, Card, CardTitle } from './ui/primitives';
import { ProgressBar } from './ui/progress';
import { cn } from '../lib/cn';

const hours = (minutes: number) => formatDecimal(minutes / 60);

/** This week's progress against every subject's weekly target. */
export function WeeklyPlanCard({ className }: { className?: string }) {
  const data = useData();
  const now = useNow();
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const plan = useMemo(() => weeklyPlan(data, now), [data, now]);
  if (plan.items.length === 0) return null;

  const daysLeft = 7 - ((now.getDay() + 6) % 7); // including today
  const open = plan.totalTargetMinutes - plan.totalMinutes;

  return (
    <Card className={className}>
      <CardTitle
        icon={CalendarRange}
        action={
          <span className="tabular text-xs text-faint">
            {plan.completed ? 'Alle Ziele erreicht' : `noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}`}
          </span>
        }
      >
        Wochenplan
      </CardTitle>

      <div className="mb-5 flex items-end justify-between gap-3">
        <p className="tabular text-2xl font-semibold tracking-[-0.02em] text-fg">
          {hours(plan.totalMinutes)} <span className="text-base font-medium text-muted">/ {hours(plan.totalTargetMinutes)} h</span>
        </p>
        <p className="text-right text-xs text-muted">{plan.completed ? 'Starke Woche!' : `${formatHours(open)} offen`}</p>
      </div>
      <ProgressBar value={plan.totalMinutes / plan.totalTargetMinutes} tone={plan.completed ? 'success' : 'accent'} label="Wochenplan gesamt" className="mb-6" />

      <ul className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {plan.items.map((item) => (
          <li key={item.category.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: item.category.color }} aria-hidden />
                <span className={cn('truncate', item.done ? 'text-muted' : 'text-fg')}>{item.category.name}</span>
              </span>
              <span className="tabular flex shrink-0 items-center gap-1 text-xs text-muted">
                {item.done && <Check className="size-3.5 text-success" aria-label="erreicht" />}
                {hours(item.minutes)} / {hours(item.targetMinutes)} h
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[#0f1216]"
              role="progressbar"
              aria-label={`${item.category.name} diese Woche`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.ratio * 100)}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: item.category.color }}
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${item.ratio * 100}%` }}
                transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => navigate('/einstellungen')}>
          Wochenziele anpassen
        </Button>
      </div>
    </Card>
  );
}
