import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useActiveCategories, useData } from '../../store/hooks';
import { creativeCreditsForMinutes, creditsForMinutes, xpForMinutes, MAX_SESSION_MINUTES } from '../../domain/economy';
import { dayKey } from '../../domain/dates';
import { formatInt, formatKC, formatSC, formatWeight } from '../../domain/format';
import type { StudySession } from '../../domain/types';
import { Button, Field, Input, Segmented, Select, Textarea } from '../ui/primitives';
import { CategoryDialog } from './CategoryDialog';

export interface SessionFormValues {
  categoryId: string;
  minutes: number;
  date: string;
  goal: string;
  description: string;
  taskCompleted: boolean | null;
}

type TaskValue = 'na' | 'yes' | 'no';
const toTask = (v: boolean | null): TaskValue => (v === null ? 'na' : v ? 'yes' : 'no');
const fromTask = (v: TaskValue) => (v === 'na' ? null : v === 'yes');

interface Props {
  initial?: StudySession;
  submitLabel: string;
  onSubmit: (values: SessionFormValues) => string | null;
  onCancel?: () => void;
}

/** Manual logging and editing of sessions. Returns an error string from onSubmit to display it. */
export function SessionForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const data = useData();
  const categories = useActiveCategories();
  const presets = data.settings.sessionPresets;
  const today = dayKey(new Date());

  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? data.settings.defaultCategoryId);
  const [hours, setHours] = useState(initial ? String(Math.floor(initial.minutes / 60)) : '1');
  const [mins, setMins] = useState(initial ? String(initial.minutes % 60) : '0');
  const [date, setDate] = useState(initial?.date ?? today);
  const [goal, setGoal] = useState(initial?.goal ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [task, setTask] = useState<TaskValue>(toTask(initial?.taskCompleted ?? null));
  const [error, setError] = useState<string | null>(null);
  const [catDialog, setCatDialog] = useState(false);

  const h = hours.trim() === '' ? 0 : Number(hours);
  const m = mins.trim() === '' ? 0 : Number(mins);
  const valid = Number.isInteger(h) && Number.isInteger(m) && h >= 0 && m >= 0 && m < 60;
  const total = valid ? h * 60 + m : NaN;
  const durationError = !valid
    ? 'Bitte gib ganze Stunden und Minuten (0–59) ein.'
    : total < 1
      ? 'Die Dauer muss mindestens 1 Minute betragen.'
      : total > MAX_SESSION_MINUTES
        ? 'Maximal 24 Stunden pro Session.'
        : null;

  // Edits keep the rates locked into the session; new sessions use the current rates.
  const rates = initial?.rates ?? data.settings.rates;
  // The subject weighting stays locked unless the session moves to another subject.
  const weight =
    initial && initial.categoryId === categoryId ? initial.weightPercent : (data.categories.find((c) => c.id === categoryId)?.weightPercent ?? 100);
  const creative =
    initial && initial.categoryId === categoryId ? initial.creative : (data.categories.find((c) => c.id === categoryId)?.creative ?? false);
  const preview = useMemo(
    () =>
      durationError
        ? null
        : {
            credits: creditsForMinutes(total, rates, weight),
            xp: xpForMinutes(total, rates, weight),
            creative: creative ? creativeCreditsForMinutes(total, rates) : 0,
          },
    [durationError, total, rates, weight, creative],
  );

  // Archived categories stay selectable when editing an old session that uses one.
  const options = initial && !categories.some((c) => c.id === initial.categoryId)
    ? [...categories, ...data.categories.filter((c) => c.id === initial.categoryId)]
    : categories;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (durationError) return setError(durationError);
    const result = onSubmit({ categoryId, minutes: total, date, goal, description, taskCompleted: fromTask(task) });
    setError(result);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fach / Kategorie" htmlFor="sf-cat">
          <div className="flex gap-2">
            <Select id="sf-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({formatWeight(c.weightPercent)})
                  {c.archived ? ' (archiviert)' : ''}
                </option>
              ))}
            </Select>
            <Button variant="secondary" className="w-10 px-0" onClick={() => setCatDialog(true)} aria-label="Eigene Kategorie hinzufügen" title="Eigene Kategorie hinzufügen">
              <Plus className="size-4" />
            </Button>
          </div>
        </Field>
        <Field label="Datum" htmlFor="sf-date" hint="Nachträgliche Einträge sind erlaubt.">
          <Input id="sf-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>

      <Field label="Lerndauer" error={error && durationError ? durationError : null}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Input aria-label="Stunden" type="number" inputMode="numeric" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} className="w-20 text-center" />
            <span className="text-sm text-muted">Std.</span>
            <Input aria-label="Minuten" type="number" inputMode="numeric" min={0} max={59} value={mins} onChange={(e) => setMins(e.target.value)} className="w-20 text-center" />
            <span className="text-sm text-muted">Min.</span>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:ml-auto">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setHours(String(Math.floor(p / 60)));
                  setMins(String(p % 60));
                }}
                className="focus-ring h-8 rounded-lg border border-line-soft bg-[#111418] px-2.5 text-xs font-medium text-muted transition-colors hover:border-line hover:text-fg"
              >
                {p} Min.
              </button>
            ))}
          </div>
        </div>
      </Field>

      <Field label="Lernziel (optional)" htmlFor="sf-goal">
        <Input id="sf-goal" value={goal} maxLength={120} onChange={(e) => setGoal(e.target.value)} placeholder="z. B. Lecture 1 abschließen" />
      </Field>

      <Field label="Beschreibung (optional)" htmlFor="sf-desc">
        <Textarea id="sf-desc" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="Was hast du gelernt?" />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">Aufgabe erledigt? (optional)</span>
        <Segmented
          label="Aufgabe erledigt"
          value={task}
          onChange={setTask}
          options={[
            { value: 'na', label: 'Keine Angabe' },
            { value: 'yes', label: 'Erledigt' },
            { value: 'no', label: 'Offen' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-line-soft pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {preview ? (
            <>
              {initial ? 'Neuer Wert' : 'Du erhältst'} <span className="tabular font-semibold text-gold">{formatSC(preview.credits)}</span>
              {preview.creative > 0 && (
                <>
                  , <span className="tabular font-semibold text-creative">{formatKC(preview.creative)}</span>
                </>
              )}{' '}
              und <span className="tabular font-semibold text-accent">{formatInt(preview.xp)} XP</span>
            </>
          ) : (
            <span className="text-danger">{durationError}</span>
          )}
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Abbrechen
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!!durationError}>
            {submitLabel}
          </Button>
        </div>
      </div>
      {error && !durationError && <p role="alert" className="-mt-2 rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}

      <CategoryDialog open={catDialog} onClose={() => setCatDialog(false)} onCreated={setCategoryId} />
    </form>
  );
}
