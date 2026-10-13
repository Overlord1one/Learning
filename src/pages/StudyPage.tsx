import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PenLine, Timer } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Card, CardTitle, PageHeader, Segmented } from '../components/ui/primitives';
import { LiveTimer } from '../components/study/LiveTimer';
import { SessionForm } from '../components/study/SessionForm';
import { SessionHistory } from '../components/study/SessionHistory';

type Mode = 'timer' | 'manuell';

export function StudyPage() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('modus') === 'manuell' ? 'manuell' : 'timer';
  const focusMode = useAppStore((s) => s.focusMode);
  const logSession = useAppStore((s) => s.logSession);
  const hasTimer = useAppStore((s) => s.data.activeTimer !== null);

  const [formKey, setFormKey] = useState(0);

  return (
    <div>
      {!focusMode && (
      <PageHeader
        eyebrow="Lernen"
        title="Fokus-Session"
        description="Starte den Live-Timer oder trage eine bereits abgeschlossene Session nach."
        action={
          <Segmented<Mode>
            label="Modus"
            value={mode}
            onChange={(m) => setParams(m === 'manuell' ? { modus: 'manuell' } : {}, { replace: true })}
            options={[
              { value: 'timer', label: hasTimer ? 'Timer läuft' : 'Live-Timer', icon: Timer },
              { value: 'manuell', label: 'Manuell', icon: PenLine },
            ]}
          />
        }
      />
      )}

      <div className={focusMode ? '' : 'grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]'}>
        <div>
          {mode === 'timer' || focusMode ? (
            <LiveTimer />
          ) : (
            <Card>
              <CardTitle icon={PenLine}>Session manuell eintragen</CardTitle>
              <SessionForm
                key={formKey}
                submitLabel="Session speichern"
                onSubmit={(v) => {
                  const r = logSession(v);
                  if (!r.ok) return r.error;
                  setFormKey((k) => k + 1);
                  return null;
                }}
              />
            </Card>
          )}
        </div>
        {!focusMode && <SessionHistory />}
      </div>
    </div>
  );
}
