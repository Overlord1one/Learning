import { Clock } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useNow } from '../../store/hooks';
import { awayMs } from '../../domain/timer';
import { formatMinutes, formatTime } from '../../domain/format';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/primitives';

/**
 * Shown when the live timer was running while the app was closed or the
 * iPhone was locked. The user decides whether that time was study time.
 */
export function AwayPrompt() {
  const timer = useAppStore((s) => s.data.activeTimer);
  const resolveAway = useAppStore((s) => s.resolveAway);
  const now = useNow(15_000);
  const pending = !!timer?.interruptedAt;
  const minutes = timer ? Math.round(awayMs(timer, now) / 60_000) : 0;

  return (
    <Dialog
      open={pending}
      onClose={() => undefined}
      size="sm"
      hideClose
      title="Warst du am Lernen?"
      description={
        timer?.interruptedAt && (
          <>
            Seit {formatTime(new Date(timer.interruptedAt))} Uhr ({formatMinutes(minutes)}) war die App geschlossen oder dein iPhone gesperrt, während der Timer lief. Soll diese Zeit
            als Lernzeit zählen?
          </>
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => resolveAway(false)}>
            Nein, abziehen
          </Button>
          <Button variant="primary" icon={Clock} onClick={() => resolveAway(true)} data-autofocus>
            Ja, mitzählen
          </Button>
        </>
      }
    />
  );
}
