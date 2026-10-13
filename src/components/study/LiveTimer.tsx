import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Flag, Focus, Minimize2, Pause, Play, Plus, Square, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useActiveCategories, useData, useNow } from '../../store/hooks';
import { creditsForMinutes, xpForMinutes } from '../../domain/economy';
import { formatClock, formatInt, formatSC, formatTime, formatWeight } from '../../domain/format';
import { timerElapsedMs } from '../../domain/timer';
import type { ActiveTimer } from '../../domain/types';
import { Button, Card, Field, Input, Segmented, Textarea } from '../ui/primitives';
import { ConfirmDialog, Dialog } from '../ui/dialog';
import { CategoryDialog } from './CategoryDialog';
import { cn } from '../../lib/cn';

const GOAL_SUGGESTIONS = ['Lecture 1 abschließen', 'Problem Set bearbeiten', '20 Matheaufgaben lösen', 'Kapitel wiederholen'];

function CategoryChips({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const categories = useActiveCategories();
  const [dialog, setDialog] = useState(false);
  return (
    <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Kategorie">
      {categories.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c.id)}
            className={cn(
              'focus-ring flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
              active ? 'border-line bg-elevated text-fg' : 'border-line-soft text-muted hover:border-line hover:text-fg',
            )}
          >
            <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
            {c.name}
            <span className="tabular text-[11px] text-faint">{formatWeight(c.weightPercent)}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setDialog(true)}
        className="focus-ring flex h-9 items-center gap-1.5 rounded-full border border-dashed border-line px-3.5 text-[13px] text-faint transition-colors hover:text-fg"
      >
        <Plus className="size-3.5" /> Eigene
      </button>
      <CategoryDialog open={dialog} onClose={() => setDialog(false)} onCreated={onChange} />
    </div>
  );
}

function FinishDialog({ timer, open, onClose }: { timer: ActiveTimer; open: boolean; onClose: () => void }) {
  const data = useData();
  const finishTimer = useAppStore((s) => s.finishTimer);
  const discardTimer = useAppStore((s) => s.discardTimer);
  const categories = useActiveCategories();
  const weightOf = (id: string) => data.categories.find((c) => c.id === id)?.weightPercent ?? 100;
  const [frozenAt] = useState(() => new Date());
  const measuredMs = timerElapsedMs(timer, frozenAt);
  const maxMinutes = Math.max(1, Math.ceil(measuredMs / 60_000));
  const measured = Math.floor(measuredMs / 60_000);

  const [minutes, setMinutes] = useState(String(Math.max(measured, 0)));
  const [categoryId, setCategoryId] = useState(timer.categoryId);
  const [goal, setGoal] = useState(timer.goal);
  const [description, setDescription] = useState('');
  const [task, setTask] = useState<'na' | 'yes' | 'no'>('na');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const n = Number(minutes);
  const valid = minutes.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= maxMinutes;
  const tooShort = measuredMs < 60_000;

  const save = () => {
    if (!valid || saving) return;
    setSaving(true); // prevents double submission
    const r = finishTimer({ minutes: n, categoryId, goal, description, taskCompleted: task === 'na' ? null : task === 'yes' });
    if (!r.ok) {
      setError(r.error);
      setSaving(false);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Session abschließen"
      description={
        tooShort
          ? 'Die Session war kürzer als eine Minute. Credits gibt es ab einer bestätigten Minute.'
          : `Gemessen: ${formatClock(measuredMs)} reine Lernzeit (ohne Pausen). Bestätige deine tatsächlich fokussierte Zeit.`
      }
      size="md"
      footer={
        tooShort ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Weiterlernen
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                discardTimer();
                onClose();
              }}
            >
              Verwerfen
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Zurück
            </Button>
            <Button variant="primary" onClick={save} disabled={!valid || saving} icon={Flag}>
              Session bestätigen
            </Button>
          </>
        )
      }
    >
      {!tooShort && (
        <form
          className="flex flex-col gap-4 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Fokussierte Minuten" htmlFor="fin-min" error={!valid ? `Bitte 1 bis ${maxMinutes} Minuten angeben.` : error} hint={`Maximal ${maxMinutes} Min. (gemessene Zeit)`}>
            <Input id="fin-min" data-autofocus type="number" inputMode="numeric" min={1} max={maxMinutes} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
          <Field label="Kategorie" htmlFor="fin-cat">
            <select id="fin-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="focus-ring h-10 w-full rounded-xl border border-line bg-[#111418] px-3.5 text-sm text-fg">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lernziel" htmlFor="fin-goal">
            <Input id="fin-goal" value={goal} maxLength={120} onChange={(e) => setGoal(e.target.value)} placeholder="Optional" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-muted">Ziel erreicht?</span>
            <Segmented
              label="Ziel erreicht"
              value={task}
              onChange={setTask}
              options={[
                { value: 'na', label: 'Keine Angabe' },
                { value: 'yes', label: 'Erledigt' },
                { value: 'no', label: 'Offen' },
              ]}
            />
          </div>
          <Field label="Notiz (optional)" htmlFor="fin-desc">
            <Textarea id="fin-desc" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="Was hast du geschafft?" />
          </Field>
          {valid && (
            <p className="rounded-xl border border-line-soft bg-[#111418] px-4 py-3 text-sm text-muted">
              Belohnung: <span className="tabular font-semibold text-gold">{formatSC(creditsForMinutes(n, data.settings.rates, weightOf(categoryId)))}</span> ·{' '}
              <span className="tabular font-semibold text-accent">{formatInt(xpForMinutes(n, data.settings.rates, weightOf(categoryId)))} XP</span>
            </p>
          )}
        </form>
      )}
    </Dialog>
  );
}

export function LiveTimer() {
  const data = useData();
  const timer = data.activeTimer;
  const startTimer = useAppStore((s) => s.startTimer);
  const pauseTimer = useAppStore((s) => s.pauseTimer);
  const resumeTimer = useAppStore((s) => s.resumeTimer);
  const discardTimer = useAppStore((s) => s.discardTimer);
  const updateTimerDetails = useAppStore((s) => s.updateTimerDetails);
  const focusMode = useAppStore((s) => s.focusMode);
  const setFocusMode = useAppStore((s) => s.setFocusMode);
  const pushToast = useAppStore((s) => s.pushToast);
  const categories = useActiveCategories();
  const now = useNow(250);

  const fallbackCategory = categories.some((c) => c.id === data.settings.defaultCategoryId) ? data.settings.defaultCategoryId : (categories[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(fallbackCategory);
  const [goal, setGoal] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  useEffect(() => () => setFocusMode(false), [setFocusMode]);

  const elapsed = timer ? timerElapsedMs(timer, now) : 0;
  const running = timer?.status === 'running';
  const minutesSoFar = Math.floor(elapsed / 60_000);
  const activeCategory = data.categories.find((c) => c.id === (timer?.categoryId ?? categoryId));

  const start = () => {
    const r = startTimer(categoryId, goal);
    if (!r.ok) pushToast({ tone: 'error', title: 'Start nicht möglich', message: r.error });
  };

  return (
    <Card className={cn('relative overflow-hidden', focusMode && 'border-transparent bg-transparent shadow-none')} padded={false}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,var(--accent-soft),transparent)] opacity-70" />
      <div className={cn('relative flex flex-col items-center px-5 py-10 sm:px-10 sm:py-14', focusMode && 'min-h-[70dvh] justify-center')}>
        <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em]">
          <span className={cn('size-1.5 rounded-full', running ? 'bg-accent' : timer ? 'bg-gold' : 'bg-faint')} />
          <span className={running ? 'text-accent' : timer ? 'text-gold' : 'text-faint'}>{running ? 'Fokus läuft' : timer ? 'Pausiert' : 'Bereit'}</span>
        </div>

        <motion.div
          className={cn('tabular mt-5 font-mono font-medium tracking-[-0.04em] text-fg', focusMode ? 'text-[64px] sm:text-[128px]' : 'text-[56px] sm:text-[96px]')}
          animate={{ opacity: timer && !running ? 0.55 : 1 }}
          aria-live="off"
          role="timer"
        >
          {formatClock(elapsed)}
        </motion.div>

        {timer ? (
          <div className="mt-2 flex flex-col items-center gap-1 text-center">
            <p className="text-sm text-muted">
              <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: activeCategory?.color }} />
              {activeCategory?.name}
              {activeCategory && <span className="tabular text-faint"> {formatWeight(activeCategory.weightPercent)}</span>}
              {timer.goal && <span className="text-faint"> · {timer.goal}</span>}
            </p>
            <p className="tabular text-xs text-faint">
              Bisher: <span className="text-gold">{formatSC(creditsForMinutes(minutesSoFar, data.settings.rates, activeCategory?.weightPercent))}</span> · <span className="text-accent">{formatInt(xpForMinutes(minutesSoFar, data.settings.rates, activeCategory?.weightPercent))} XP</span> · gestartet {formatTime(new Date(timer.startedAt))}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Pausen werden nicht gezählt. Credits gibt es nach deiner Bestätigung.</p>
        )}


        {!timer && (
          <div className="mt-9 flex w-full max-w-xl flex-col items-center gap-5">
            <CategoryChips value={categoryId} onChange={setCategoryId} />
            <div className="w-full">
              <label htmlFor="timer-goal" className="sr-only">
                Lernziel (optional)
              </label>
              <Input id="timer-goal" value={goal} maxLength={120} onChange={(e) => setGoal(e.target.value)} placeholder="Lernziel (optional) – z. B. Lecture 1 abschließen" className="h-11 text-center" />
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {GOAL_SUGGESTIONS.map((g) => (
                  <button key={g} type="button" onClick={() => setGoal(g)} className="focus-ring rounded-md px-2 py-1 text-xs text-faint transition-colors hover:bg-elevated hover:text-muted">
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
          {!timer && (
            <Button variant="primary" size="lg" icon={Play} onClick={start} className="min-w-44" disabled={!categoryId}>
              Start
            </Button>
          )}
          {timer && running && (
            <Button size="lg" icon={Pause} onClick={pauseTimer} className="min-w-36">
              Pause
            </Button>
          )}
          {timer && !running && (
            <Button variant="primary" size="lg" icon={Play} onClick={resumeTimer} className="min-w-36">
              Fortsetzen
            </Button>
          )}
          {timer && (
            <Button variant={running ? 'primary' : 'secondary'} size="lg" icon={Square} onClick={() => setFinishing(true)} className="min-w-36">
              Beenden
            </Button>
          )}
          {timer && <Button variant="ghost" size="lg" icon={Trash2} onClick={() => setDiscarding(true)} aria-label="Session verwerfen" />}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {timer && !focusMode && (
              <select
                aria-label="Kategorie der laufenden Session"
                value={timer.categoryId}
                onChange={(e) => updateTimerDetails({ categoryId: e.target.value })}
                className="focus-ring h-8 rounded-lg border border-line-soft bg-transparent px-2 text-xs text-muted"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <Button size="sm" variant="ghost" icon={focusMode ? Minimize2 : Focus} onClick={() => setFocusMode(!focusMode)}>
              {focusMode ? 'Fokus-Modus verlassen' : 'Fokus-Modus'}
            </Button>
        </div>
      </div>

      {timer && finishing && <FinishDialog timer={timer} open={finishing} onClose={() => setFinishing(false)} />}
      <ConfirmDialog
        open={discarding}
        onClose={() => setDiscarding(false)}
        title="Session verwerfen?"
        description="Die laufende Session wird ohne Credits und XP beendet. Das kann nicht rückgängig gemacht werden."
        confirmLabel="Verwerfen"
        onConfirm={discardTimer}
      />
    </Card>
  );
}
