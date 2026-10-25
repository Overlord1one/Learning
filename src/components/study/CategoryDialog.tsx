import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button, Field, Input, Select, Toggle } from '../ui/primitives';
import { useAppStore } from '../../store/appStore';
import { CATEGORY_COLORS, WEIGHT_OPTIONS } from '../../domain/defaults';
import { formatCredits, formatDecimal, formatWeight, parseDecimal } from '../../domain/format';
import { creditsForMinutes, xpForMinutes } from '../../domain/economy';
import type { StudyCategory } from '../../domain/types';
import { cn } from '../../lib/cn';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn('focus-ring flex size-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-105', value === c ? 'border-fg' : 'border-transparent')}
          style={{ background: c }}
        >
          {value === c && <Check className="size-3.5 text-[#0b0d10]" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

/** Create or edit a study category. */
export function CategoryDialog({ open, onClose, onCreated, category }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void; category?: StudyCategory }) {
  const addCategory = useAppStore((s) => s.addCategory);
  const renameCategory = useAppStore((s) => s.renameCategory);
  const used = useAppStore((s) => s.data.categories);
  const rates = useAppStore((s) => s.data.settings.rates);
  // Fixed palette order: the next colour not yet taken by a visible category.
  const nextColor = CATEGORY_COLORS.find((c) => !used.some((u) => !u.archived && u.color === c)) ?? CATEGORY_COLORS[7]!;
  const [name, setName] = useState('');
  const [color, setColor] = useState(nextColor);
  const [weight, setWeight] = useState(100);
  const [weekly, setWeekly] = useState('0');
  const [creative, setCreative] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setColor(category?.color ?? nextColor);
      setWeight(category?.weightPercent ?? 100);
      setWeekly(formatDecimal((category?.weeklyTargetMinutes ?? 0) / 60));
      setCreative(category?.creative ?? false);
      setError(null);
    }
  }, [open, category]);

  const save = () => {
    const weeklyHours = parseDecimal(weekly === '' ? '0' : weekly);
    if (!Number.isFinite(weeklyHours) || weeklyHours < 0 || weeklyHours > 168) return setError('Bitte gib ein gültiges Wochenziel in Stunden an.');
    const weeklyMinutes = Math.round(weeklyHours * 60);
    if (category) {
      const r = renameCategory(category.id, name, color, weight, weeklyMinutes, creative);
      if (!r.ok) return setError(r.error);
    } else {
      const r = addCategory(name, color, weight, weeklyMinutes, creative);
      if (!r.ok) return setError(r.error);
      onCreated?.(r.value);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={category ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={save}>
            Speichern
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name" htmlFor="cat-name" error={error}>
          <Input id="cat-name" data-autofocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="z. B. Physik" />
        </Field>
        <Field label="Priorität / Gewichtung" htmlFor="cat-weight" hint="Bestimmt Credits und XP pro Stunde. Gilt für zukünftige Sessions.">
          <Select id="cat-weight" value={weight} onChange={(e) => setWeight(Number(e.target.value))}>
            {[...new Set([...WEIGHT_OPTIONS, weight])]
              .sort((a, b) => b - a)
              .map((w) => (
                <option key={w} value={w}>
                  {formatWeight(w)} · {formatCredits(creditsForMinutes(60, rates, w))} SC und {xpForMinutes(60, rates, w)} XP pro Stunde
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Wochenziel (Stunden)" htmlFor="cat-weekly" hint="Erscheint im Wochenplan auf dem Dashboard. 0 = kein Wochenziel.">
          <Input id="cat-weekly" inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder="z. B. 4" />
        </Field>
        <div className="rounded-xl border border-line-soft bg-[#111418] p-4">
          <Toggle
            id="cat-creative"
            checked={creative}
            onChange={setCreative}
            label="Kreativ-Fach"
            description={`Verdient zusätzlich ${formatCredits(rates.creativeCentsPerHour)} Kreativ-Credits pro Stunde für Kreativ-Equipment.`}
          />
        </div>
        <Field label="Farbe">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </form>
    </Dialog>
  );
}
