import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { ProductVisual } from '../ui/visuals';
import { useAppStore } from '../../store/appStore';
import { useData } from '../../store/hooks';
import { rewardProgress, shopRewards } from '../../domain/stats';
import { formatAmount, formatHoursPrecise } from '../../domain/format';
import { cn } from '../../lib/cn';

export function GoalPickerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const setGoal = useAppStore((s) => s.setGoalReward);
  const items = useMemo(() => shopRewards(data).map((r) => rewardProgress(data, r)).filter((p) => p.status !== 'freigeschaltet'), [data]);
  const current = data.settings.goalRewardId;

  return (
    <Dialog open={open} onClose={onClose} title="Belohnungsziel wählen" description="Worauf möchtest du als Nächstes hinarbeiten?">
      <ul className="flex flex-col gap-2 pb-4">
        {items.length === 0 && <li className="py-6 text-center text-sm text-muted">Alle Belohnungen sind freigeschaltet.</li>}
        {items.map(({ reward, ratio, minutesNeeded, status }) => {
          const active = reward.id === current;
          return (
            <li key={reward.id}>
              <button
                type="button"
                onClick={() => {
                  setGoal(reward.id);
                  onClose();
                }}
                className={cn(
                  'focus-ring flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                  active ? 'border-accent/40 bg-accent-soft' : 'border-line-soft bg-[#111418] hover:border-line',
                )}
              >
                <ProductVisual reward={reward} tone={status === 'freischaltbar' ? 'ready' : 'locked'} className="size-12 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{reward.name}</p>
                  <p className="tabular text-xs text-muted">
                    {formatAmount(reward.priceCents, reward.wallet)} · {Math.round(ratio * 100)} % · {minutesNeeded > 0 ? `noch ${formatHoursPrecise(minutesNeeded)}` : 'Freischaltbar'}
                  </p>
                </div>
                {active && <Check className="size-4 text-accent" aria-label="Aktuelles Ziel" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
