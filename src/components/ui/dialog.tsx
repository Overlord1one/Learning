import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './primitives';
import { cn } from '../../lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the close button – for decisions that must be answered. */
  hideClose?: boolean;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible modal dialog: focus trap, Escape to close, scroll lock, returns focus. */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', hideClose = false }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab' && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-card shadow-2xl sm:rounded-3xl',
              size === 'sm' && 'sm:max-w-md',
              size === 'md' && 'sm:max-w-lg',
              size === 'lg' && 'sm:max-w-2xl',
            )}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', bounce: 0.12, duration: 0.42 }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div>
                <h2 id={titleId} className="text-lg font-semibold tracking-[-0.01em] text-fg">
                  {title}
                </h2>
                {description && <div className="mt-1.5 text-sm leading-relaxed text-muted">{description}</div>}
              </div>
              {!hideClose && <button type="button" onClick={onClose} aria-label="Schließen" className="focus-ring -mr-2 -mt-1 rounded-lg p-2 text-muted hover:bg-elevated hover:text-fg">
                <X className="size-4" />
              </button>}
            </div>
            {children && <div className="scrollbar-thin overflow-y-auto px-6 pt-5 pb-2">{children}</div>}
            {footer && <div className="flex flex-col-reverse gap-2 px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-6">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary' | 'gold';
  /** Require typing this word to enable the confirm button. */
  requireText?: string;
  children?: ReactNode;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, tone = 'danger', requireText, children }: ConfirmProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const blocked = requireText !== undefined && typed.trim() !== requireText;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      description={
        <div className="flex gap-3">
          {tone === 'danger' && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
          <div>{description}</div>
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : tone}
            disabled={blocked}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {requireText !== undefined && (
        <div className="pb-2">
          <label className="mb-1.5 block text-xs text-muted" htmlFor="confirm-text">
            Tippe <span className="font-mono text-fg">{requireText}</span> zur Bestätigung
          </label>
          <input
            id="confirm-text"
            data-autofocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="focus-ring h-10 w-full rounded-xl border border-line bg-[#111418] px-3.5 font-mono text-sm text-fg"
          />
        </div>
      )}
    </Dialog>
  );
}
