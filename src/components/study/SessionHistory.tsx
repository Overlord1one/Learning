import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, History, Pencil, Timer, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useData } from '../../store/hooks';
import { sessionCredits, sessionXp } from '../../domain/economy';
import { formatDate, formatInt, formatMinutes, formatSC } from '../../domain/format';
import { parseDayKey } from '../../domain/dates';
import type { StudySession } from '../../domain/types';
import { Card, CardTitle, EmptyState, IconButton, Select, Button } from '../ui/primitives';
import { ConfirmDialog, Dialog } from '../ui/dialog';
import { SessionForm } from './SessionForm';

const PAGE = 12;

export function SessionHistory() {
  const data = useData();
  const editSession = useAppStore((s) => s.editSession);
  const deleteSession = useAppStore((s) => s.deleteSession);
  const pushToast = useAppStore((s) => s.pushToast);
  const [filter, setFilter] = useState('alle');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<StudySession | null>(null);
  const [deleting, setDeleting] = useState<StudySession | null>(null);

  const sessions = useMemo(
    () =>
      data.sessions
        .filter((s) => filter === 'alle' || s.categoryId === filter)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [data.sessions, filter],
  );
  const usedCategories = data.categories.filter((c) => data.sessions.some((s) => s.categoryId === c.id));

  return (
    <Card>
      <CardTitle
        icon={History}
        action={
          usedCategories.length > 1 ? (
            <Select aria-label="Nach Kategorie filtern" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 w-auto text-xs">
              <option value="alle">Alle Kategorien</option>
              {usedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      >
        Lernverlauf
      </CardTitle>

      {sessions.length === 0 ? (
        <EmptyState icon={History} title="Noch keine Sessions" description="Abgeschlossene und eingetragene Sessions erscheinen hier. Du kannst sie jederzeit korrigieren oder löschen." />
      ) : (
        <ul className="flex flex-col">
          {sessions.slice(0, limit).map((s) => {
            const cat = data.categories.find((c) => c.id === s.categoryId);
            return (
              <li key={s.id} className="group flex items-center gap-3 border-b border-line-soft py-3 last:border-0">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: cat?.color ?? '#8A93A3' }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-fg">
                    {formatMinutes(s.minutes)}
                    <span className="truncate font-normal text-muted">· {cat?.name ?? 'Unbekannt'}</span>
                    {s.source === 'timer' && <Timer className="size-3 shrink-0 text-faint" aria-label="Live-Timer" />}
                    {s.taskCompleted === true && <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-label="Aufgabe erledigt" />}
                    {s.taskCompleted === false && <Circle className="size-3.5 shrink-0 text-faint" aria-label="Aufgabe offen" />}
                  </p>
                  <p className="truncate text-xs text-faint">
                    {formatDate(parseDayKey(s.date))}
                    {s.goal && ` · ${s.goal}`}
                    {s.description && ` · ${s.description}`}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="tabular text-sm font-medium text-gold">+{formatSC(sessionCredits(s))}</p>
                  <p className="tabular text-xs text-faint">+{formatInt(sessionXp(s))} XP</p>
                </div>
                <div className="flex gap-0.5 sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100">
                  <IconButton icon={Pencil} label="Session bearbeiten" onClick={() => setEditing(s)} />
                  <IconButton icon={Trash2} label="Session löschen" tone="danger" onClick={() => setDeleting(s)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {sessions.length > limit && (
        <div className="mt-3 flex justify-center">
          <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>
            Weitere anzeigen ({sessions.length - limit})
          </Button>
        </div>
      )}

      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Session bearbeiten" description="Credits und XP werden mit den Raten dieser Session neu berechnet." size="lg">
        {editing && (
          <div className="pb-5">
            <SessionForm
              initial={editing}
              submitLabel="Änderungen speichern"
              onCancel={() => setEditing(null)}
              onSubmit={(v) => {
                const r = editSession(editing.id, v);
                if (!r.ok) return r.error;
                setEditing(null);
                pushToast({ tone: 'success', title: 'Session aktualisiert' });
                return null;
              }}
            />
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Session löschen?"
        confirmLabel="Löschen"
        description={
          deleting && (
            <>
              Die Session über {formatMinutes(deleting.minutes)} wird entfernt. Die dafür erhaltenen {formatSC(sessionCredits(deleting))} und {formatInt(sessionXp(deleting))} XP werden abgezogen. Die
              Korrektur bleibt im Transaktionsverlauf nachvollziehbar.
            </>
          )
        }
        onConfirm={() => {
          if (!deleting) return;
          const r = deleteSession(deleting.id);
          if (!r.ok) pushToast({ tone: 'error', title: 'Löschen nicht möglich', message: r.error });
          else pushToast({ tone: 'info', title: 'Session gelöscht' });
        }}
      />
    </Card>
  );
}
