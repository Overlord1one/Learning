import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clapperboard } from 'lucide-react';
import { useData, usePlayer } from '../store/hooks';
import { rewardProgress, shopRewards } from '../domain/stats';
import { formatCredits, formatHoursPrecise, formatKC } from '../domain/format';
import { Button, Card, CardTitle } from './ui/primitives';
import { AnimatedNumber, ProgressBar } from './ui/progress';
import { CreativeCoin, ProductVisual } from './ui/visuals';

/** Kreativ-Konto: balance and the next creative reward. */
export function CreativeAccountCard({ className }: { className?: string }) {
  const data = useData();
  const player = usePlayer();
  const navigate = useNavigate();
  const next = useMemo(
    () =>
      shopRewards(data, 'creative')
        .map((r) => rewardProgress(data, r))
        .filter((p) => p.status === 'gesperrt' || p.status === 'freischaltbar')
        .sort((a, b) => a.reward.priceCents - b.reward.priceCents)[0] ?? null,
    [data],
  );
  const hasCreativeSubject = data.categories.some((c) => c.creative && !c.archived);
  if (!hasCreativeSubject && player.creativeCents === 0) return null;

  return (
    <Card className={className}>
      <CardTitle
        icon={Clapperboard}
        action={
          <Button size="sm" variant="ghost" iconRight={ArrowRight} onClick={() => navigate('/shop?ansicht=kreativ')}>
            Kreativ-Shop
          </Button>
        }
      >
        Kreativ-Konto
      </CardTitle>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="sm:w-48">
          <p className="flex items-center gap-2 text-[28px] font-semibold tracking-[-0.02em] text-creative">
            <CreativeCoin className="size-5" />
            <AnimatedNumber value={player.creativeCents} format={(v) => formatCredits(Math.round(v))} />
            <span className="text-base font-medium text-creative/70">KC</span>
          </p>
          <p className="mt-1 text-xs text-faint">{formatKC(data.settings.rates.creativeCentsPerHour)} pro Stunde Video-Schnitt</p>
        </div>
        {next ? (
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <ProductVisual reward={next.reward} tone={next.status === 'freischaltbar' ? 'ready' : 'locked'} className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-fg">{next.reward.name}</span>
                <span className="tabular shrink-0 text-xs text-muted">{Math.floor(next.ratio * 100)} %</span>
              </div>
              <ProgressBar value={next.ratio} tone="creative" size="sm" label={`Fortschritt zu ${next.reward.name}`} />
              <p className="tabular mt-1.5 text-xs text-faint">
                {next.status === 'freischaltbar'
                  ? 'Freischaltbar!'
                  : `noch ${formatKC(next.missingCents)} · ca. ${formatHoursPrecise(next.minutesNeeded)} Schnitt`}
              </p>
            </div>
          </div>
        ) : (
          <p className="flex-1 text-sm text-muted">Lege im Kreativ-Shop dein nächstes Kreativ-Equipment an, z. B. Kamera-Zubehör.</p>
        )}
      </div>
    </Card>
  );
}
