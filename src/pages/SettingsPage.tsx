import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Coins,
  Database,
  Download,
  Medal,
  Palette,
  Pencil,
  Plus,
  Receipt,
  Smartphone,
  RotateCcw,
  ShoppingBag,
  Tags,
  Timer,
  Trash2,
  Undo2,
  Upload,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useActiveCategories, useData } from '../store/hooks';
import { DEFAULT_RATES } from '../domain/economy';
import { DEFAULT_RANKS } from '../domain/ranks';
import { formatCredits, formatDate, formatDecimal, formatSC, formatTime, formatWeight, parseCreditsInput } from '../domain/format';
import type { AccentName, MotionPreference, RankTier, Reward, StudyCategory, TransactionType } from '../domain/types';
import { Badge, Button, Card, Field, IconButton, Input, PageHeader, Segmented, Select, Toggle } from '../components/ui/primitives';
import { ConfirmDialog } from '../components/ui/dialog';
import { ProductVisual } from '../components/ui/visuals';
import { CategoryDialog } from '../components/study/CategoryDialog';
import { RewardFormDialog } from '../components/shop/RewardFormDialog';
import { cn } from '../lib/cn';
import { isStandalone, saveFile } from '../lib/pwa';
import { InstallSteps } from '../components/InstallHint';

function Section({ id, icon: Icon, title, description, children, className }: { id?: string; icon: LucideIcon; title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <Card id={id} className={cn('scroll-mt-20', className)}>
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-elevated">
          <Icon className="size-4 text-muted" aria-hidden />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function useSaveFeedback() {
  const pushToast = useAppStore((s) => s.pushToast);
  return (r: { ok: true } | { ok: false; error: string }, title = 'Gespeichert') => {
    if (r.ok) pushToast({ tone: 'success', title });
    else pushToast({ tone: 'error', title: 'Nicht gespeichert', message: r.error });
    return r.ok;
  };
}

// ---------------------------------------------------------------------------

function ProfileSection() {
  const data = useData();
  const update = useAppStore((s) => s.updateSettings);
  const feedback = useSaveFeedback();
  const categories = useActiveCategories();
  const [name, setName] = useState(data.settings.profileName);
  const [goal, setGoal] = useState(String(data.settings.dailyGoalMinutes));

  const save = () => {
    const minutes = Number(goal);
    if (!Number.isInteger(minutes)) return feedback({ ok: false, error: 'Das Tagesziel muss eine ganze Zahl sein.' });
    feedback(update({ profileName: name.trim(), dailyGoalMinutes: minutes }));
  };

  return (
    <Section icon={User} title="Profil" description="Wie du begrüßt wirst und worauf du täglich hinarbeitest.">
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Profilname" htmlFor="set-name">
          <Input id="set-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" />
        </Field>
        <Field label="Tägliches Lernziel (Minuten)" htmlFor="set-goal" hint="0 = kein Tagesziel">
          <Input id="set-goal" type="number" min={0} max={1440} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>
        <Field label="Standard-Kategorie" htmlFor="set-cat" className="sm:col-span-2">
          <Select id="set-cat" value={data.settings.defaultCategoryId} onChange={(e) => feedback(update({ defaultCategoryId: e.target.value }), 'Standard-Kategorie gespeichert')}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary">
            Profil speichern
          </Button>
        </div>
      </form>
    </Section>
  );
}

function TimerSection() {
  const data = useData();
  const update = useAppStore((s) => s.updateSettings);
  const feedback = useSaveFeedback();
  const [presets, setPresets] = useState(data.settings.sessionPresets.join(', '));
  const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

  const savePresets = () => {
    const values = presets
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map(Number);
    if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 1440)) {
      return feedback({ ok: false, error: 'Presets müssen ganze Minuten zwischen 1 und 1440 sein.' });
    }
    feedback(update({ sessionPresets: [...new Set(values)].slice(0, 6).sort((a, b) => a - b) }), 'Presets gespeichert');
  };

  const toggleNotifications = async (on: boolean) => {
    if (on && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return feedback({ ok: false, error: 'Benachrichtigungen wurden im Browser nicht erlaubt.' });
    }
    feedback(update({ notifications: on }), on ? 'Benachrichtigungen aktiv' : 'Benachrichtigungen aus');
  };

  return (
    <Section icon={Timer} title="Lern-Timer" description="Erinnerungen und Schnellauswahl für Sessions.">
      <div className="flex flex-col gap-5">
        <Field label="Pausen-Erinnerung" htmlFor="set-remind" hint="Hinweis während einer laufenden Session.">
          <Select id="set-remind" value={data.settings.timerReminderMinutes} onChange={(e) => feedback(update({ timerReminderMinutes: Number(e.target.value) }))}>
            <option value={0}>Aus</option>
            {[25, 45, 50, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                nach {m} Minuten
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Session-Presets (Minuten)" htmlFor="set-presets" hint="Kommagetrennt, max. 6 – z. B. 25, 45, 60, 90">
          <div className="flex gap-2">
            <Input id="set-presets" value={presets} onChange={(e) => setPresets(e.target.value)} />
            <Button onClick={savePresets}>Speichern</Button>
          </div>
        </Field>
        <Toggle
          id="set-notify"
          checked={data.settings.notifications && permission === 'granted'}
          onChange={(v) => void toggleNotifications(v)}
          label="Browser-Benachrichtigungen"
          description={permission === 'unsupported' ? 'Von diesem Browser nicht unterstützt.' : permission === 'denied' ? 'Im Browser blockiert.' : 'Für Pausen-Erinnerungen und erreichte Tagesziele.'}
        />
      </div>
    </Section>
  );
}

function EconomySection() {
  const data = useData();
  const update = useAppStore((s) => s.updateSettings);
  const feedback = useSaveFeedback();
  const [credits, setCredits] = useState(formatCredits(data.settings.rates.creditCentsPerHour));
  const [xp, setXp] = useState(String(data.settings.rates.xpPerHour));
  const [confirm, setConfirm] = useState(false);

  const creditCents = parseCreditsInput(credits);
  const xpRate = Number(xp);
  const changed = creditCents !== data.settings.rates.creditCentsPerHour || xpRate !== data.settings.rates.xpPerHour;
  const isDefault = data.settings.rates.creditCentsPerHour === DEFAULT_RATES.creditCentsPerHour && data.settings.rates.xpPerHour === DEFAULT_RATES.xpPerHour;

  const apply = (rates: { creditCentsPerHour: number; xpPerHour: number }) => {
    if (!Number.isFinite(rates.creditCentsPerHour)) return feedback({ ok: false, error: 'Ungültige Credit-Rate.' });
    if (feedback(update({ rates }), 'Raten aktualisiert')) {
      setCredits(formatCredits(rates.creditCentsPerHour));
      setXp(String(rates.xpPerHour));
    }
  };

  return (
    <Section icon={Coins} title="Belohnungsraten" description="Standard: 10 SC und 60 XP pro Stunde – multipliziert mit der Gewichtung des Fachs.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Setup Credits pro Stunde" htmlFor="set-sc">
          <Input id="set-sc" inputMode="decimal" value={credits} onChange={(e) => setCredits(e.target.value)} />
        </Field>
        <Field label="XP pro Stunde" htmlFor="set-xp">
          <Input id="set-xp" type="number" min={1} value={xp} onChange={(e) => setXp(e.target.value)} />
        </Field>
      </div>
      <p className="mt-4 rounded-xl border border-line-soft bg-[#111418] px-4 py-3 text-[13px] leading-relaxed text-muted">
        Neue Raten gelten nur für <span className="text-fg">zukünftige</span> Sessions. Jede Session speichert die Raten, mit denen sie erfasst wurde – auch beim späteren Bearbeiten.
        Vergangene Freischaltungen behalten ihren damaligen Preis. Pro Fach wird die Rate zusätzlich mit der Gewichtung multipliziert (z. B. Mathematik ×1,5).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={!changed} onClick={() => setConfirm(true)}>
          Raten übernehmen
        </Button>
        {!isDefault && (
          <Button variant="ghost" icon={RotateCcw} onClick={() => apply({ ...DEFAULT_RATES })}>
            Standard wiederherstellen
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone="primary"
        title="Raten ändern?"
        confirmLabel="Übernehmen"
        description={`Ab sofort: ${credits} SC und ${xp} XP pro Stunde. Bereits erfasste Sessions und Käufe bleiben unverändert.`}
        onConfirm={() => apply({ creditCentsPerHour: creditCents, xpPerHour: xpRate })}
      />
    </Section>
  );
}

function RanksSection() {
  const data = useData();
  const update = useAppStore((s) => s.updateSettings);
  const feedback = useSaveFeedback();
  const [ranks, setRanks] = useState<RankTier[]>(() => [...data.settings.ranks].sort((a, b) => a.minLevel - b.minLevel));

  useEffect(() => setRanks([...data.settings.ranks].sort((a, b) => a.minLevel - b.minLevel)), [data.settings.ranks]);

  const set = (i: number, patch: Partial<RankTier>) => setRanks((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = () => {
    const levels = ranks.map((r) => r.minLevel);
    if (levels.some((l) => !Number.isInteger(l) || l < 1)) return feedback({ ok: false, error: 'Level müssen ganze Zahlen ab 1 sein.' });
    if (new Set(levels).size !== levels.length) return feedback({ ok: false, error: 'Jedes Level darf nur einen Rang haben.' });
    feedback(update({ ranks: ranks.map((r) => ({ ...r, name: r.name.trim() })) }), 'Ränge gespeichert');
  };

  return (
    <Section icon={Medal} title="Ränge" description="Zwischenstufen erhalten automatisch eine Nummer, z. B. „System Builder II“.">
      <ul className="flex flex-col gap-2">
        {ranks.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-8 text-xs text-faint">Lv.</span>
            <Input aria-label="Ab Level" type="number" min={1} value={r.minLevel} disabled={r.minLevel === 1 && i === 0} onChange={(e) => set(i, { minLevel: Number(e.target.value) })} className="w-20" />
            <Input aria-label="Rangname" value={r.name} maxLength={30} onChange={(e) => set(i, { name: e.target.value })} />
            <IconButton icon={Trash2} label="Rang entfernen" tone="danger" disabled={r.minLevel === 1} onClick={() => setRanks((x) => x.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={save}>
          Ränge speichern
        </Button>
        <Button icon={Plus} onClick={() => setRanks((r) => [...r, { minLevel: Math.max(...r.map((x) => x.minLevel)) + 5, name: 'Neuer Rang' }])}>
          Rang hinzufügen
        </Button>
        <Button variant="ghost" icon={RotateCcw} onClick={() => feedback(update({ ranks: DEFAULT_RANKS.map((r) => ({ ...r })) }), 'Standard-Ränge wiederhergestellt')}>
          Standard
        </Button>
      </div>
    </Section>
  );
}

function CategoriesSection() {
  const removeCategory = useAppStore((s) => s.removeCategory);
  const feedback = useSaveFeedback();
  const [editing, setEditing] = useState<StudyCategory | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const active = useActiveCategories();

  return (
    <Section icon={Tags} title="Lernkategorien & Wochenziele" description="Sortiert nach Priorität. Die Gewichtung bestimmt Credits und XP pro Stunde; benutzte Kategorien werden archiviert statt gelöscht.">
      <ul className="flex flex-col">
        {active.map((c) => (
          <li key={c.id} className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
            <span className="size-2.5 rounded-full" style={{ background: c.color }} />
            <span className="flex-1 text-sm text-fg">{c.name}</span>
            {c.weeklyTargetMinutes > 0 && <span className="tabular text-xs text-faint">{formatDecimal(c.weeklyTargetMinutes / 60)} h/Wo.</span>}
            <span className="tabular text-xs text-muted" title="Gewichtung">{formatWeight(c.weightPercent)}</span>
            {c.isDefault && <Badge>Standard</Badge>}
            <IconButton
              icon={Pencil}
              label="Bearbeiten"
              onClick={() => {
                setEditing(c);
                setOpen(true);
              }}
            />
            <IconButton icon={Archive} label="Entfernen" tone="danger" onClick={() => feedback(removeCategory(c.id), 'Kategorie entfernt')} />
          </li>
        ))}
      </ul>
      <Button
        className="mt-4"
        icon={Plus}
        onClick={() => {
          setEditing(undefined);
          setOpen(true);
        }}
      >
        Kategorie hinzufügen
      </Button>
      <CategoryDialog open={open} onClose={() => setOpen(false)} category={editing} />
    </Section>
  );
}

function AppearanceSection() {
  const data = useData();
  const update = useAppStore((s) => s.updateSettings);
  return (
    <Section icon={Palette} title="Darstellung" description="Dunkles Design mit wählbarem Akzent.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Akzentfarbe</span>
          <div className="flex gap-2">
            {(
              [
                ['blau', '#6B9FFF', 'Blau'],
                ['gruen', '#67C9A0', 'Grün'],
                ['violett', '#A48CF2', 'Violett'],
              ] as [AccentName, string, string][]
            ).map(([key, color, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={data.settings.accent === key}
                onClick={() => update({ accent: key })}
                className={cn(
                  'focus-ring flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm transition-colors',
                  data.settings.accent === key ? 'border-line bg-elevated text-fg' : 'border-line-soft text-muted hover:text-fg',
                )}
              >
                <span className="size-3 rounded-full" style={{ background: color }} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Animationen</span>
          <Segmented<MotionPreference>
            label="Animationen"
            value={data.settings.motion}
            onChange={(m) => update({ motion: m })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'reduced', label: 'Reduziert' },
              { value: 'full', label: 'Voll' },
            ]}
          />
          <p className="text-xs text-faint">„System“ folgt der Einstellung „Bewegung reduzieren“ deines Geräts.</p>
        </div>
      </div>
    </Section>
  );
}

function ShopSection() {
  const data = useData();
  const removeReward = useAppStore((s) => s.removeReward);
  const restoreReward = useAppStore((s) => s.restoreReward);
  const restoreDefaultShop = useAppStore((s) => s.restoreDefaultShop);
  const feedback = useSaveFeedback();
  const [editing, setEditing] = useState<Reward | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDefaults, setConfirmDefaults] = useState(false);
  const rewards = [...data.rewards].sort((a, b) => Number(a.archived) - Number(b.archived) || a.sortOrder - b.sortOrder);

  return (
    <Section icon={ShoppingBag} title="Shop-Verwaltung" description="Belohnungen bearbeiten, ausblenden oder wiederherstellen. Preisänderungen betreffen nie vergangene Freischaltungen.">
      <ul className="flex flex-col">
        {rewards.map((r) => {
          const active = data.purchases.some((p) => p.rewardId === r.id && !p.refundedAt);
          return (
            <li key={r.id} className={cn('flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0', r.archived && 'opacity-50')}>
              <ProductVisual reward={r} className="size-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">{r.name}</p>
                <p className="tabular text-xs text-faint">
                  {r.preOwned ? 'Bereits vorhanden' : formatSC(r.priceCents)}
                  {r.isDefault ? ' · Standard' : ' · Eigene'}
                  {active ? ' · freigeschaltet' : ''}
                  {r.archived ? ' · ausgeblendet' : ''}
                </p>
              </div>
              {!r.archived && <IconButton icon={Pencil} label="Bearbeiten" onClick={() => setEditing(r)} />}
              {r.archived ? (
                <IconButton icon={ArchiveRestore} label="Wiederherstellen" onClick={() => feedback(restoreReward(r.id), 'Wiederhergestellt')} />
              ) : (
                <IconButton icon={r.isDefault ? Archive : Trash2} label={r.isDefault ? 'Ausblenden' : 'Entfernen'} tone="danger" disabled={active} onClick={() => feedback(removeReward(r.id), 'Entfernt')} />
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={Plus} onClick={() => setCreating(true)}>
          Eigene Belohnung
        </Button>
        <Button variant="ghost" icon={RotateCcw} onClick={() => setConfirmDefaults(true)}>
          Standard-Shop wiederherstellen
        </Button>
      </div>
      <RewardFormDialog open={creating || !!editing} reward={editing} onClose={() => (editing ? setEditing(null) : setCreating(false))} />
      <ConfirmDialog
        open={confirmDefaults}
        onClose={() => setConfirmDefaults(false)}
        tone="primary"
        title="Standard-Shop wiederherstellen?"
        confirmLabel="Wiederherstellen"
        description="Die fünf Original-Belohnungen und die ROCCAT-Maus erhalten wieder ihre ursprünglichen Namen und Preise. Eigene Belohnungen und bisherige Freischaltungen bleiben unverändert."
        onConfirm={() => feedback(restoreDefaultShop(), 'Standard-Shop wiederhergestellt')}
      />
    </Section>
  );
}

const TX_LABEL: Record<TransactionType, string> = {
  session_earn: 'Session',
  session_adjust: 'Korrektur',
  session_revoke: 'Session gelöscht',
  purchase: 'Freischaltung',
  refund: 'Erstattung',
};

function LedgerSection() {
  const data = useData();
  const refund = useAppStore((s) => s.refund);
  const pushToast = useAppStore((s) => s.pushToast);
  const [limit, setLimit] = useState(15);
  const [undo, setUndo] = useState<string | null>(null);
  const txs = useMemo(() => [...data.transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data.transactions]);
  const undoPurchase = data.purchases.find((p) => p.id === undo);

  return (
    <Section icon={Receipt} title="Transaktionsverlauf" description="Jede Credit-Bewegung wird protokolliert. Das Guthaben ist die Summe aller Buchungen.">
      {txs.length === 0 ? (
        <p className="text-sm text-faint">Noch keine Buchungen.</p>
      ) : (
        <div className="scrollbar-thin -mx-1 overflow-x-auto">
          <table className="tabular w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-xs text-faint">
                <th className="px-1 py-2 font-medium">Datum</th>
                <th className="px-1 py-2 font-medium">Art</th>
                <th className="px-1 py-2 font-medium">Beschreibung</th>
                <th className="px-1 py-2 text-right font-medium">Betrag</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {txs.slice(0, limit).map((t) => {
                const p = t.type === 'purchase' ? data.purchases.find((x) => x.id === t.purchaseId) : null;
                return (
                  <tr key={t.id} className="border-t border-line-soft">
                    <td className="px-1 py-2 text-xs whitespace-nowrap text-muted">
                      {formatDate(new Date(t.createdAt))} {formatTime(new Date(t.createdAt))}
                    </td>
                    <td className="px-1 py-2 text-xs text-muted">{TX_LABEL[t.type]}</td>
                    <td className="max-w-[220px] truncate px-1 py-2 text-fg">{t.note}</td>
                    <td className={cn('px-1 py-2 text-right font-medium whitespace-nowrap', t.amountCents >= 0 ? 'text-gold' : 'text-muted')}>
                      {t.amountCents >= 0 ? '+' : '−'}
                      {formatSC(Math.abs(t.amountCents))}
                    </td>
                    <td className="py-1 text-right">{p && !p.refundedAt && <IconButton icon={Undo2} label="Freischaltung rückgängig machen" onClick={() => setUndo(p.id)} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {txs.length > limit && (
        <Button size="sm" variant="ghost" className="mt-3" onClick={() => setLimit((l) => l + 25)}>
          Weitere anzeigen
        </Button>
      )}
      <ConfirmDialog
        open={!!undo}
        onClose={() => setUndo(null)}
        title="Freischaltung rückgängig machen?"
        confirmLabel="Rückgängig machen"
        description={undoPurchase && `${undoPurchase.rewardName}: ${formatSC(undoPurchase.priceCents)} werden erstattet. Beide Buchungen bleiben im Verlauf sichtbar.`}
        onConfirm={() => {
          if (!undo) return;
          const r = refund(undo);
          pushToast(r.ok ? { tone: 'info', title: 'Freischaltung rückgängig gemacht' } : { tone: 'error', title: 'Fehler', message: r.error });
        }}
      />
    </Section>
  );
}

function DataSection() {
  const data = useData();
  const importData = useAppStore((s) => s.importData);
  const resetProgress = useAppStore((s) => s.resetProgress);
  const factoryReset = useAppStore((s) => s.factoryReset);
  const pushToast = useAppStore((s) => s.pushToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ raw: unknown; name: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmFactory, setConfirmFactory] = useState(false);

  const exportData = async () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const result = await saveFile(blob, `setup-quest-backup-${new Date().toISOString().slice(0, 10)}.json`);
    if (result !== 'cancelled') pushToast({ tone: 'success', title: 'Export erstellt', message: result === 'shared' ? 'Tipp: „In Dateien sichern“ wählen.' : undefined });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const raw: unknown = JSON.parse(await file.text());
      setPending({ raw, name: file.name });
    } catch {
      pushToast({ tone: 'error', title: 'Import fehlgeschlagen', message: 'Die Datei ist kein gültiges JSON.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Section id="daten" icon={Database} title="Daten" description="Alle Daten liegen lokal in diesem Browser. Sichere sie regelmäßig als JSON.">
      <div className="flex flex-wrap gap-2">
        <Button icon={Download} onClick={() => void exportData()}>
          Exportieren
        </Button>
        <Button icon={Upload} onClick={() => fileRef.current?.click()}>
          Importieren
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-line-soft pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-fg">Fortschritt zurücksetzen</p>
            <p className="text-xs text-faint">Löscht Sessions, Credits, Freischaltungen und Erfolge. Einstellungen, Kategorien und Shop bleiben.</p>
          </div>
          <Button variant="danger" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
            Zurücksetzen
          </Button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-fg">Alles löschen</p>
            <p className="text-xs text-faint">Setzt die App vollständig auf den Auslieferungszustand zurück.</p>
          </div>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirmFactory(true)}>
            Alles löschen
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        tone="primary"
        title="Daten importieren?"
        confirmLabel="Importieren"
        description={`„${pending?.name}“ ersetzt alle aktuellen Daten. Die Datei wird vorher vollständig geprüft. Exportiere deine aktuellen Daten, falls du sie behalten möchtest.`}
        onConfirm={() => {
          if (!pending) return;
          const r = importData(pending.raw);
          pushToast(r.ok ? { tone: 'success', title: 'Import erfolgreich' } : { tone: 'error', title: 'Import abgelehnt', message: r.error });
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Fortschritt zurücksetzen?"
        confirmLabel="Endgültig zurücksetzen"
        requireText="ZURÜCKSETZEN"
        description="Alle Sessions, Credits, XP, Freischaltungen und Erfolge werden gelöscht. Das kann nicht rückgängig gemacht werden."
        onConfirm={() => {
          resetProgress();
          pushToast({ tone: 'info', title: 'Fortschritt zurückgesetzt' });
        }}
      />
      <ConfirmDialog
        open={confirmFactory}
        onClose={() => setConfirmFactory(false)}
        title="Alle Daten löschen?"
        confirmLabel="Alles löschen"
        requireText="LÖSCHEN"
        description="Alle Daten inklusive Einstellungen, Kategorien und eigener Belohnungen werden gelöscht."
        onConfirm={() => {
          factoryReset();
          pushToast({ tone: 'info', title: 'App zurückgesetzt' });
        }}
      />
    </Section>
  );
}

function DeviceSection() {
  const installed = isStandalone();
  return (
    <Section icon={Smartphone} title="iPhone-App" description={installed ? 'Setup Quest läuft als installierte App.' : 'Installiere Setup Quest auf deinem Home-Bildschirm.'}>
      {installed ? (
        <p className="text-sm text-success">Installiert – die App funktioniert auch offline.</p>
      ) : (
        <InstallSteps />
      )}
      <p className="mt-4 rounded-xl border border-line-soft bg-[#111418] px-4 py-3 text-[13px] leading-relaxed text-muted">
        Deine Daten werden nur auf diesem Gerät gespeichert. Öffne die App immer über dasselbe Symbol und erstelle ab und zu einen Export als Sicherung – zum Beispiel in iCloud Drive über „In Dateien sichern“.
      </p>
    </Section>
  );
}

export function SettingsPage() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  return (
    <div>
      <PageHeader eyebrow="Einstellungen" title="Einstellungen" description="Profil, Belohnungsraten, Shop und Datenverwaltung." />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <ProfileSection />
          <EconomySection />
          <TimerSection />
          <AppearanceSection />
        </div>
        <div className="flex flex-col gap-5">
          <DeviceSection />
          <CategoriesSection />
          <RanksSection />
          <DataSection />
        </div>
        <ShopSection />
        <LedgerSection />
      </div>
    </div>
  );
}
