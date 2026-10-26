import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Check, Clapperboard, LayoutGrid, Package, Plus, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useData, usePlayer } from '../store/hooks';
import { inventory, rewardProgress, shopRewards } from '../domain/stats';
import type { RewardStatus } from '../domain/stats';
import { formatAmount, formatDate, formatKC, formatSC } from '../domain/format';
import { defaultCreativeShare } from '../domain/commands';
import type { Wallet } from '../domain/types';
import { cn } from '../lib/cn';
import type { Reward } from '../domain/types';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Segmented, Select, Toggle } from '../components/ui/primitives';
import { ConfirmDialog } from '../components/ui/dialog';
import { ProductVisual, WalletCoin } from '../components/ui/visuals';
import { RewardCard } from '../components/shop/RewardCard';
import { RewardDetailDialog } from '../components/shop/RewardDetailDialog';
import { RewardFormDialog } from '../components/shop/RewardFormDialog';

type View = 'shop' | 'kreativ' | 'inventar';
type StatusFilter = 'alle' | RewardStatus;
type Sort = 'standard' | 'preis' | 'fortschritt' | 'prioritaet';

const PRIORITY_RANK = { hoch: 0, mittel: 1, niedrig: 2 };

export function ShopPage() {
  const data = useData();
  const player = usePlayer();
  const purchase = useAppStore((s) => s.purchase);
  const pushToast = useAppStore((s) => s.pushToast);
  const [params, setParams] = useSearchParams();

  const view: View = params.get('ansicht') === 'inventar' ? 'inventar' : params.get('ansicht') === 'kreativ' ? 'kreativ' : 'shop';
  const wallet: Wallet = view === 'kreativ' ? 'creative' : 'main';
  const detailId = params.get('belohnung');
  const creating = params.get('neu') === '1';

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('alle');
  const [category, setCategory] = useState('alle');
  const [sort, setSort] = useState<Sort>('standard');
  const [confirming, setConfirming] = useState<Reward | null>(null);
  /** Kreativ-Credits share when paying a reward from both accounts. */
  const [splitKc, setSplitKc] = useState(0);
  const splitMin = confirming ? Math.max(0, confirming.priceCents - player.balanceCents) : 0;
  const splitMax = confirming ? Math.min(confirming.priceCents, player.creativeCents) : 0;
  const askUnlock = (r: Reward) => {
    setSplitKc(defaultCreativeShare(data, r));
    setConfirming(r);
  };
  const [editing, setEditing] = useState<Reward | null>(null);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const items = useMemo(() => shopRewards(data, wallet).map((r) => rewardProgress(data, r)), [data, wallet]);
  const balance = wallet === 'main' ? player.balanceCents : player.creativeCents;
  const categories = useMemo(() => [...new Set(items.map((i) => i.reward.category))], [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        (status === 'alle' || i.status === status) &&
        (category === 'alle' || i.reward.category === category) &&
        (!q || `${i.reward.name} ${i.reward.category} ${i.reward.variant}`.toLowerCase().includes(q)),
    );
    if (sort === 'preis') list.sort((a, b) => a.reward.priceCents - b.reward.priceCents);
    if (sort === 'fortschritt') list.sort((a, b) => b.ratio - a.ratio);
    if (sort === 'prioritaet') list.sort((a, b) => PRIORITY_RANK[a.reward.priority] - PRIORITY_RANK[b.reward.priority]);
    return list;
  }, [items, query, status, category, sort]);

  const unlockedCount = items.filter((i) => i.status === 'freigeschaltet').length;
  const totalValue = items.reduce((a, i) => a + i.reward.priceCents, 0);
  const owned = inventory(data);
  const detail = detailId ? (data.rewards.find((r) => r.id === detailId) ?? null) : null;

  const confirmUnlock = () => {
    if (!confirming) return;
    const r = purchase(confirming.id, confirming.wallet === 'both' ? splitKc : undefined);
    if (!r.ok) pushToast({ tone: 'error', title: 'Freischaltung nicht möglich', message: r.error });
    else setParam('belohnung', null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Shop"
        title="Belohnungen"
        description="Verdiente Credits schaltest du hier für echte Produkte frei. Freischalten bedeutet: Du darfst dich belohnen – es wird nichts bestellt."
        action={
          <Button variant="primary" icon={Plus} onClick={() => setParam('neu', '1')}>
            Eigene Belohnung
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-faint">{wallet === 'main' ? 'Guthaben' : 'Kreativ-Konto'}</p>
          <p className={cn('tabular mt-1 flex items-center gap-1.5 text-lg font-semibold sm:text-xl', wallet === 'main' ? 'text-gold' : 'text-creative')}>
            <WalletCoin wallet={wallet} className="hidden sm:block" /> {formatAmount(balance, wallet)}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-faint">Freigeschaltet</p>
          <p className="tabular mt-1 text-lg font-semibold text-fg sm:text-xl">
            {unlockedCount} <span className="text-muted">/ {items.length}</span>
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-faint">Shop-Wert</p>
          <p className="tabular mt-1 text-lg font-semibold text-fg sm:text-xl">{formatAmount(totalValue, wallet)}</p>
        </Card>
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented<View>
          label="Ansicht"
          value={view}
          onChange={(v) => setParam('ansicht', v === 'shop' ? null : v)}
          options={[
            { value: 'shop', label: 'Shop', icon: LayoutGrid },
            { value: 'kreativ', label: 'Kreativ', icon: Clapperboard },
            { value: 'inventar', label: `Inventar (${owned.length})`, icon: Package },
          ]}
        />
        {view !== 'inventar' && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
              <Input aria-label="Belohnungen durchsuchen" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen …" className="pl-9" />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex">
              <Select aria-label="Status filtern" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="sm:w-40">
                <option value="alle">Alle Status</option>
                <option value="freischaltbar">Freischaltbar</option>
                <option value="gesperrt">Gesperrt</option>
                <option value="freigeschaltet">Freigeschaltet</option>
              </Select>
              <Select aria-label="Kategorie filtern" value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-44">
                <option value="alle">Alle Kategorien</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select aria-label="Sortieren" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="sm:w-40">
                <option value="standard">Standard</option>
                <option value="preis">Preis</option>
                <option value="fortschritt">Fortschritt</option>
                <option value="prioritaet">Priorität</option>
              </Select>
            </div>
          </div>
        )}
      </div>

      {view === 'kreativ' && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-creative/20 bg-creative-soft px-4 py-3.5 text-[13px] leading-relaxed text-muted">
          <Clapperboard className="mt-0.5 size-4 shrink-0 text-creative" aria-hidden />
          <p>
            <span className="font-medium text-fg">Kreativ-Konto:</span> Jede Stunde Video-Schnitt bringt zusätzlich zu den normalen SC{' '}
            <span className="text-creative">{formatAmount(data.settings.rates.creativeCentsPerHour, 'creative')}</span>. Damit schaltest du ausschließlich Kreativ-Equipment frei – z. B.
            einen Schnitt-Monitor oder Kamera-Zubehör. Eigene Kreativ-Belohnungen legst du über „Eigene Belohnung“ an.
          </p>
        </div>
      )}

      {view !== 'inventar' ? (
        filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={ShoppingBag}
              title={items.length === 0 ? 'Der Shop ist leer' : 'Keine Treffer'}
              description={items.length === 0 ? 'Lege eine eigene Belohnung an oder stelle den Standard-Shop in den Einstellungen wieder her.' : 'Passe Suche oder Filter an.'}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((item, i) => (
                <RewardCard
                  key={item.reward.id}
                  item={item}
                  index={i}
                  isGoal={data.settings.goalRewardId === item.reward.id}
                  onOpen={() => setParam('belohnung', item.reward.id)}
                  onUnlock={() => askUnlock(item.reward)}
                />
              ))}
            </AnimatePresence>
          </div>
        )
      ) : (
        <InventoryView onOpen={(id) => setParam('belohnung', id)} />
      )}

      <RewardDetailDialog
        reward={detail}
        onClose={() => setParam('belohnung', null)}
        onUnlock={(r) => askUnlock(r)}
        onEdit={(r) => {
          setParam('belohnung', null);
          setEditing(r);
        }}
      />

      <RewardFormDialog
        open={creating || !!editing}
        reward={editing}
        defaultWallet={wallet}
        onClose={() => (editing ? setEditing(null) : setParam('neu', null))}
      />

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={confirmUnlock}
        tone="gold"
        title="Belohnung freischalten?"
        confirmLabel={confirming ? `Für ${formatAmount(confirming.priceCents, confirming.wallet)} freischalten` : 'Freischalten'}
        description={
          confirming && (
            <>
              <span className="font-medium text-fg">{confirming.name}</span> wird für {formatAmount(confirming.priceCents, confirming.wallet)} virtuell freigeschaltet.{' '}
              {confirming.wallet === 'both' ? (
                <>Wähle unten, wie viel aus welchem Konto kommt.</>
              ) : (
                <>
                  {confirming.wallet === 'main' ? 'Dein Guthaben' : 'Dein Kreativ-Konto'} sinkt auf{' '}
                  {formatAmount((confirming.wallet === 'main' ? player.balanceCents : player.creativeCents) - confirming.priceCents, confirming.wallet)}.
                </>
              )}{' '}
              XP und Level bleiben unverändert. Es wird nichts bestellt oder bezahlt.
            </>
          )
        }
      >
        {confirming?.wallet === 'both' && (
          <div className="mb-3 rounded-2xl border border-line-soft bg-[#111418] p-4">
            <div className="mb-3 flex justify-between text-sm">
              <span className="tabular font-medium text-gold">{formatSC(confirming.priceCents - splitKc)}</span>
              <span className="text-faint">+</span>
              <span className="tabular font-medium text-creative">{formatKC(splitKc)}</span>
            </div>
            <input
              type="range"
              aria-label="Anteil Kreativ-Credits"
              min={splitMin}
              max={splitMax}
              step={1}
              value={splitKc}
              disabled={splitMin === splitMax}
              onChange={(e) => setSplitKc(Number(e.target.value))}
              className="w-full accent-[var(--color-creative)]"
            />
            <p className="tabular mt-2 text-xs text-faint">
              Danach: {formatSC(player.balanceCents - (confirming.priceCents - splitKc))} · {formatKC(player.creativeCents - splitKc)}
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

function InventoryView({ onOpen }: { onOpen: (id: string) => void }) {
  const data = useData();
  const setRealPurchased = useAppStore((s) => s.setRealPurchased);
  const items = inventory(data);
  const bought = items.filter((i) => i.purchase?.realPurchasedAt || i.reward.preOwned).length;

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState icon={Package} title="Noch leer" description="Freigeschaltete Belohnungen und bereits vorhandene Artikel erscheinen hier." />
      </Card>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        {items.length} {items.length === 1 ? 'Artikel' : 'Artikel'} in deinem Setup · {bought} davon tatsächlich vorhanden
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map(({ reward, purchase }) => (
          <Card key={purchase?.id ?? reward.id} className="flex items-center gap-4 !p-4">
            <button type="button" onClick={() => onOpen(reward.id)} className="focus-ring shrink-0 rounded-xl" aria-label={`${reward.name} – Details`}>
              <ProductVisual reward={reward} tone="owned" className="size-16 rounded-xl" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{reward.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {reward.preOwned ? (
                  <Badge tone="success" icon={Check}>
                    Bereits vorhanden
                  </Badge>
                ) : (
                  <Badge tone="gold" icon={Sparkles}>
                    Virtuell freigeschaltet
                  </Badge>
                )}
                {purchase && <span className="text-xs text-faint">{formatDate(new Date(purchase.unlockedAt))} · {formatAmount(purchase.priceCents, purchase.wallet)}</span>}
              </div>
              {purchase && (
                <div className="mt-3">
                  <Toggle id={`real-${purchase.id}`} checked={purchase.realPurchasedAt !== null} onChange={(v) => setRealPurchased(purchase.id, v)} label="Tatsächlich gekauft" />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
