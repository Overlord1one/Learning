import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useData } from '../store/hooks';
import { evaluateAchievements } from '../domain/achievements';
import { formatDate, formatDecimal } from '../domain/format';
import { Card, PageHeader } from '../components/ui/primitives';
import { ProgressBar } from '../components/ui/progress';
import { AchievementBadge } from '../components/AchievementBadge';
import { cn } from '../lib/cn';

const TIER_LABEL = { bronze: 'Bronze', silber: 'Silber', gold: 'Gold' };

export function AchievementsPage() {
  const data = useData();
  const list = useMemo(() => evaluateAchievements(data, new Date()), [data]);
  const unlocked = list.filter((a) => a.unlocked).length;

  return (
    <div>
      <PageHeader
        eyebrow="Erfolge"
        title="Abzeichen"
        description="Erfolge werden automatisch aus deinem echten Fortschritt abgeleitet. Sie bringen Abzeichen, keine zusätzlichen Credits."
      />

      <Card className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm text-muted">Gesammelt</p>
          <p className="tabular mt-1 text-3xl font-semibold tracking-[-0.02em] text-fg">
            {unlocked} <span className="text-muted">/ {list.length}</span>
          </p>
        </div>
        <div className="sm:w-1/2">
          <ProgressBar value={unlocked / list.length} label="Gesammelte Erfolge" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((a, i) => (
          <motion.div
            key={a.def.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={cn('surface flex gap-4 rounded-[var(--radius-card)] p-5', a.unlocked ? 'hover:border-line' : 'opacity-90')}
          >
            <motion.div whileHover={a.unlocked ? { rotate: -4, scale: 1.05 } : undefined} transition={{ type: 'spring', bounce: 0.5 }}>
              <AchievementBadge def={a.def} unlocked={a.unlocked} size={64} />
            </motion.div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className={cn('text-[15px] font-semibold', a.unlocked ? 'text-fg' : 'text-muted')}>{a.def.title}</h3>
                <span className="text-[10.5px] uppercase tracking-[0.12em] text-faint">{TIER_LABEL[a.def.tier]}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{a.def.description}</p>
              {a.unlocked ? (
                <p className="mt-3 text-xs text-success">Erreicht{a.seenAt ? ` am ${formatDate(new Date(a.seenAt))}` : ''}</p>
              ) : (
                <div className="mt-3">
                  <ProgressBar value={a.ratio} size="sm" label={`Fortschritt ${a.def.title}`} />
                  <p className="tabular mt-1.5 text-xs text-faint">
                    {formatDecimal(a.value)} / {formatDecimal(a.def.target)} {a.def.unit}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
