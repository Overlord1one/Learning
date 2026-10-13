import { AnimatePresence, motion } from 'motion/react';
import { Award, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/cn';

const ICON = { info: Info, success: CheckCircle2, error: XCircle, achievement: Award };
const TONE = { info: 'text-accent', success: 'text-success', error: 'text-danger', achievement: 'text-gold' };

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-[80] flex flex-col items-center gap-2 px-4 lg:top-auto lg:right-6 lg:bottom-6 lg:left-auto lg:items-end">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-elevated/95 p-4 shadow-2xl backdrop-blur-xl"
              role={t.tone === 'error' ? 'alert' : 'status'}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', TONE[t.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{t.title}</p>
                {t.message && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{t.message}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Hinweis schließen" className="focus-ring -m-1 rounded-md p-1 text-faint hover:text-fg">
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
