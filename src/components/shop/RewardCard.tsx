import { motion } from 'motion/react';
import { Check, Crosshair, Lock, Sparkles } from 'lucide-react';
import type { RewardProgress } from '../../domain/stats';
import { REWARD_STATUS_LABEL } from '../../domain/stats';
import { formatAmount, formatHoursPrecise } from '../../domain/format';
import { Badge, Button } from '../ui/primitives';
import { ProgressBar } from '../ui/progress';
import { ProductVisual, WalletCoin } from '../ui/visuals';
import { cn } from '../../lib/cn';

interface Props {
  item: RewardProgress;
  isGoal: boolean;
  index: number;
  onOpen: () => void;
  onUnlock: () => void;
}

export function RewardCard({ item, isGoal, index, onOpen, onUnlock }: Props) {
  const { reward, status } = item;
  const tone = status === 'freischaltbar' ? 'ready' : status === 'freigeschaltet' || status === 'vorhanden' ? 'owned' : 'locked';
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: index * 0.035, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'surface group flex flex-col overflow-hidden rounded-[var(--radius-card)] transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line',
        status === 'freischaltbar' && 'border-gold/25 hover:border-gold/40',
      )}
    >
      <button type="button" onClick={onOpen} className="focus-ring relative block p-3 pb-0 text-left" aria-label={`${reward.name} – Details`}>
        <ProductVisual reward={reward} tone={tone} className="aspect-[16/10] w-full transition-transform duration-500 group-hover:scale-[1.01]" />
        <div className="absolute top-5 left-5 flex gap-1.5">
          {isGoal && (
            <Badge tone="accent" icon={Crosshair}>
              Ziel
            </Badge>
          )}
        </div>
        <div className="absolute top-5 right-5">
          <StatusBadge status={status} />
        </div>
      </button>

      <div className="flex flex-1 flex-col p-5 pt-4">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-faint">{reward.category}</p>
        <h3 className="mt-1 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-fg">{reward.name}</h3>
        {reward.variant && <p className="mt-0.5 text-[13px] text-muted">{reward.variant}</p>}

        <div className="mt-4 flex items-center gap-1.5">
          <WalletCoin wallet={reward.wallet} />
          <span className="tabular text-lg font-semibold text-fg">{formatAmount(reward.priceCents, reward.wallet)}</span>
          <span className="ml-auto text-xs text-faint">≈ {formatHoursPrecise(item.minutesFromZero)} {reward.wallet === 'creative' ? 'Schnitt' : 'Lernzeit'}</span>
        </div>

        {status === 'gesperrt' || status === 'freischaltbar' ? (
          <div className="mt-3">
            <ProgressBar value={item.ratio} tone={reward.wallet === 'creative' ? 'creative' : 'gold'} size="sm" label={`Fortschritt zu ${reward.name}`} />
            <div className="tabular mt-2 flex justify-between text-xs">
              <span className="text-muted">{Math.floor(item.ratio * 100)} %</span>
              <span className="text-faint">{status === 'gesperrt' ? `noch ${formatAmount(item.missingCents, reward.wallet)} · ${formatHoursPrecise(item.minutesNeeded)}` : 'Genug Credits'}</span>
            </div>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
            <Check className="size-3.5" />
            {status === 'vorhanden' ? 'Bereits in deinem Setup' : item.purchase?.realPurchasedAt ? 'Virtuell freigeschaltet · tatsächlich gekauft' : 'Virtuell freigeschaltet'}
          </p>
        )}

        <div className="mt-5 flex gap-2 pt-0 sm:mt-auto sm:pt-5">
          {status === 'freischaltbar' ? (
            <Button variant="gold" className="flex-1" icon={Sparkles} onClick={onUnlock}>
              Freischalten
            </Button>
          ) : status === 'gesperrt' ? (
            <Button variant="secondary" className="flex-1" icon={Lock} disabled aria-label={`${reward.name} ist gesperrt – es fehlen ${formatAmount(item.missingCents, reward.wallet)}`}>
              Gesperrt
            </Button>
          ) : null}
          <Button variant="ghost" className={status === 'freigeschaltet' || status === 'vorhanden' ? 'flex-1' : ''} onClick={onOpen}>
            Details
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

export function StatusBadge({ status }: { status: RewardProgress['status'] }) {
  const tone = status === 'freischaltbar' ? 'gold' : status === 'gesperrt' ? 'neutral' : 'success';
  const icon = status === 'gesperrt' ? Lock : status === 'freischaltbar' ? Sparkles : Check;
  return (
    <Badge tone={tone} icon={icon} className="bg-[#0f1216]/85 backdrop-blur">
      {REWARD_STATUS_LABEL[status]}
    </Badge>
  );
}
