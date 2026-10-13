import { useState } from 'react';
import { Share, SquarePlus, X } from 'lucide-react';
import { isIOS, isStandalone } from '../lib/pwa';
import { Card } from './ui/primitives';

const KEY = 'setup-quest:install-hint-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function InstallSteps() {
  return (
    <ol className="flex flex-col gap-2 text-sm text-muted">
      <li className="flex items-center gap-2">
        <span className="tabular w-4 text-faint">1.</span> In Safari unten auf <Share className="inline size-4 text-accent" aria-label="Teilen" /> <span className="text-fg">Teilen</span> tippen
      </li>
      <li className="flex items-center gap-2">
        <span className="tabular w-4 text-faint">2.</span> <SquarePlus className="inline size-4 text-accent" aria-hidden /> <span className="text-fg">Zum Home-Bildschirm</span> wählen
      </li>
      <li className="flex items-center gap-2">
        <span className="tabular w-4 text-faint">3.</span> Setup Quest ab jetzt über das App-Symbol öffnen
      </li>
    </ol>
  );
}

/** Shown in iPhone Safari until the app is installed to the home screen. */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(readDismissed);
  if (dismissed || !isIOS() || isStandalone()) return null;
  return (
    <Card className="relative mb-5 border-accent/25">
      <button
        type="button"
        aria-label="Hinweis ausblenden"
        className="focus-ring absolute top-3 right-3 rounded-lg p-1.5 text-faint hover:text-fg"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            /* ignore */
          }
        }}
      >
        <X className="size-4" />
      </button>
      <p className="pr-8 text-[15px] font-semibold text-fg">Als App auf dem iPhone installieren</p>
      <p className="mt-1 mb-4 text-sm text-muted">Vollbild, offline nutzbar und deine Daten bleiben dauerhaft gespeichert.</p>
      <InstallSteps />
    </Card>
  );
}
