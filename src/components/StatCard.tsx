import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'neutral',
  index = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'neutral' | 'accent' | 'gold' | 'success';
  index?: number;
}) {
  const iconTone = {
    neutral: 'text-muted bg-elevated border-line',
    accent: 'text-accent bg-accent-soft border-accent/15',
    gold: 'text-gold bg-gold-soft border-gold/15',
    success: 'text-success bg-success-soft border-success/15',
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="surface flex flex-col rounded-[var(--radius-card)] p-4 transition-colors hover:border-line sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        <span className={cn('flex size-7 items-center justify-center rounded-lg border', iconTone)}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <div className="tabular mt-3 text-[22px] font-semibold tracking-[-0.02em] text-fg sm:text-[26px]">{value}</div>
      {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
    </motion.div>
  );
}
