import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Crosshair, ExternalLink, Pencil, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { Dialog, ConfirmDialog } from '../ui/dialog';
import { Badge, Button, Toggle } from '../ui/primitives';
import { ProgressBar } from '../ui/progress';
import { CreditCoin, ProductVisual } from '../ui/visuals';
import { StatusBadge } from './RewardCard';
import { useAppStore } from '../../store/appStore';
import { useData } from '../../store/hooks';
import { projectCompletion, rewardProgress } from '../../domain/stats';
import { formatDate, formatEuro, formatHoursPrecise, formatSC } from '../../domain/format';
import type { Reward } from '../../domain/types';

interface Props {
  reward: Reward | null;
  onClose: () => void;
  onUnlock: (r: Reward) => void;
  onEdit: (r: Reward) => void;
}

export function RewardDetailDialog({ reward, onClose, onUnlock, onEdit }: Props) {
  const data = useData();
  const setGoal = useAppStore((s) => s.setGoalReward);
  const refund = useAppStore((s) => s.refund);
  const setRealPurchased = useAppStore((s) => s.setRealPurchased);
  const removeReward = useAppStore((s) => s.removeReward);
  const pushToast = useAppStore((s) => s.pushToast);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const live = reward ? (data.rewards.find((r) => r.id === reward.id) ?? reward) : null;
  const item = live ? rewardProgress(data, live) : null;
  const projection = useMemo(() => (item ? projectCompletion(data.sessions, item.missingCents, new Date()) : null), [data.sessions, item]);
  const history = live ? data.purchases.filter((p) => p.rewardId === live.id).sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt)) : [];

  return (
    <>
      <Dialog open={!!live} onClose={onClose} title={live?.name ?? ''} description={live ? [live.category, live.variant].filter(Boolean).join(' · ') : undefined} size="lg">
        {live && item && (
          <div className="flex flex-col gap-5 pb-6">
            <div className="relative">
              <ProductVisual reward={live} tone={item.status === 'freischaltbar' ? 'ready' : item.status === 'gesperrt' ? 'locked' : 'owned'} className="aspect-[16/8] w-full" />
              <div className="absolute top-3 right-3">
                <StatusBadge status={item.status} />
              </div>
            </div>
            {live.description && <p className="text-sm leading-relaxed text-muted">{live.description}</p>}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Info label="Preis" value={<span className="flex items-center gap-1.5"><CreditCoin className="size-3.5" />{formatSC(live.priceCents)}</span>} />
              <Info label="Lernzeit ab null" value={formatHoursPrecise(item.minutesFromZero)} />
              <Info label="Priorität" value={live.priority[0]!.toUpperCase() + live.priority.slice(1)} />
              <Info label="Realer Preis" value={live.realPriceEuroCents != null ? formatEuro(live.realPriceEuroCents) : '—'} />
            </div>

            {(item.status === 'gesperrt' || item.status === 'freischaltbar') && (
              <div className="rounded-2xl border border-line-soft bg-[#111418] p-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-muted">Fortschritt</span>
                  <span className="tabular font-medium text-fg">{Math.floor(item.ratio * 100)} %</span>
                </div>
                <ProgressBar value={item.ratio} tone="gold" label="Fortschritt" />
                <p className="mt-3 text-sm text-muted">
                  {item.status === 'freischaltbar' ? (
                    'Du hast genug Credits, um diese Belohnung freizuschalten.'
                  ) : (
                    <>
                      Es fehlen <span className="tabular font-medium text-fg">{formatSC(item.missingCents)}</span> – das sind{' '}
                      <span className="tabular font-medium text-fg">{formatHoursPrecise(item.minutesNeeded)}</span> fokussiertes Lernen.{' '}
                      {projection?.kind === 'estimate'
                        ? `Bei deinem aktuellen Tempo (Ø ${Math.round(projection.averageDailyMinutes)} Min./Tag) etwa am ${formatDate(projection.date)}.`
                        : 'Für eine Prognose brauchst du Lernaktivität an mindestens 3 der letzten 14 Tage.'}
                    </>
                  )}
                </p>
              </div>
            )}

            {item.purchase && (
              <div className="rounded-2xl border border-success/20 bg-success-soft p-4">
                <p className="text-sm font-medium text-success">Virtuell freigeschaltet am {formatDate(new Date(item.purchase.unlockedAt))}</p>
                <p className="mt-0.5 text-xs text-muted">Für {formatSC(item.purchase.priceCents)} – das bedeutet: Du darfst dir dieses Produkt gönnen. Es wurde nichts bestellt.</p>
                <div className="mt-4 border-t border-success/15 pt-4">
                  <Toggle
                    id="real-bought"
                    checked={item.purchase.realPurchasedAt !== null}
                    onChange={(v) => setRealPurchased(item.purchase!.id, v)}
                    label="Tatsächlich gekauft"
                    description={item.purchase.realPurchasedAt ? `Markiert am ${formatDate(new Date(item.purchase.realPurchasedAt))}` : 'Markiere, wenn du das Produkt in echt besitzt.'}
                  />
                </div>
              </div>
            )}

            {history.some((p) => p.refundedAt) && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.1em] text-faint">Verlauf</p>
                <ul className="space-y-1 text-xs text-muted">
                  {history.map((p) => (
                    <li key={p.id} className="tabular">
                      {formatDate(new Date(p.unlockedAt))}: freigeschaltet für {formatSC(p.priceCents)}
                      {p.refundedAt && ` · rückgängig am ${formatDate(new Date(p.refundedAt))}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-line-soft pt-5">
              {item.status === 'freischaltbar' && (
                <Button variant="gold" icon={Sparkles} onClick={() => onUnlock(live)}>
                  Freischalten
                </Button>
              )}
              {(item.status === 'gesperrt' || item.status === 'freischaltbar') &&
                (data.settings.goalRewardId === live.id ? (
                  <Badge tone="accent" icon={Crosshair} className="h-10 rounded-xl px-3 text-sm">
                    Aktuelles Ziel
                  </Badge>
                ) : (
                  <Button
                    icon={Crosshair}
                    onClick={() => {
                      setGoal(live.id);
                      pushToast({ tone: 'success', title: 'Neues Ziel gesetzt', message: live.name });
                    }}
                  >
                    Als Ziel setzen
                  </Button>
                ))}
              {live.productUrl && (
                <a href={live.productUrl} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-muted hover:bg-elevated hover:text-fg">
                  <ExternalLink className="size-4" /> Produktseite
                </a>
              )}
              <div className="ml-auto flex gap-1">
                {item.purchase && (
                  <Button variant="ghost" icon={Undo2} onClick={() => setConfirmRefund(true)}>
                    Rückgängig
                  </Button>
                )}
                <Button variant="ghost" icon={Pencil} onClick={() => onEdit(live)} aria-label="Bearbeiten" />
                {!item.purchase && <Button variant="ghost" icon={Trash2} onClick={() => setConfirmRemove(true)} aria-label="Entfernen" />}
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmRefund}
        onClose={() => setConfirmRefund(false)}
        title="Freischaltung rückgängig machen?"
        confirmLabel="Rückgängig machen"
        description={item?.purchase && <>Du erhältst {formatSC(item.purchase.priceCents)} zurück. Die Freischaltung und die Erstattung bleiben im Verlauf nachvollziehbar.</>}
        onConfirm={() => {
          if (!item?.purchase) return;
          const r = refund(item.purchase.id);
          pushToast(r.ok ? { tone: 'info', title: 'Freischaltung rückgängig gemacht' } : { tone: 'error', title: 'Fehler', message: r.error });
        }}
      />
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Belohnung entfernen?"
        confirmLabel="Entfernen"
        description={live?.isDefault ? 'Die Standard-Belohnung wird ausgeblendet. Du kannst sie in den Einstellungen wiederherstellen.' : 'Die Belohnung wird aus dem Shop entfernt.'}
        onConfirm={() => {
          if (!live) return;
          const r = removeReward(live.id);
          if (r.ok) {
            pushToast({ tone: 'info', title: 'Belohnung entfernt' });
            onClose();
          } else pushToast({ tone: 'error', title: 'Entfernen nicht möglich', message: r.error });
        }}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line-soft bg-[#111418] px-3.5 py-3">
      <p className="text-[11.5px] text-faint">{label}</p>
      <div className="tabular mt-0.5 text-sm font-semibold text-fg">{value}</div>
    </div>
  );
}
