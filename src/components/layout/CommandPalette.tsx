import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CornerDownLeft, Download, Focus, PenLine, Play, Plus, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/cn';

interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  run: () => void;
  keywords?: string;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const setFocusMode = useAppStore((s) => s.setFocusMode);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<CommandItem[]>(
    () => [
      { id: 'start', label: 'Lernsession starten', group: 'Aktionen', icon: Play, run: () => navigate('/lernen'), keywords: 'timer start lernen' },
      { id: 'manual', label: 'Session manuell eintragen', group: 'Aktionen', icon: PenLine, run: () => navigate('/lernen?modus=manuell'), keywords: 'eintragen log' },
      { id: 'reward', label: 'Eigene Belohnung hinzufügen', group: 'Aktionen', icon: Plus, run: () => navigate('/shop?neu=1'), keywords: 'reward shop' },
      {
        id: 'focus',
        label: 'Fokus-Modus aktivieren',
        group: 'Aktionen',
        icon: Focus,
        run: () => {
          navigate('/lernen');
          setFocusMode(true);
        },
        keywords: 'focus ablenkung',
      },
      { id: 'export', label: 'Daten exportieren', group: 'Aktionen', icon: Download, run: () => navigate('/einstellungen#daten'), keywords: 'backup json' },
      ...NAV_ITEMS.map((n) => ({ id: `nav-${n.to}`, label: n.label, group: 'Navigation', icon: n.icon, run: () => navigate(n.to) })),
    ],
    [navigate, setFocusMode],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  const execute = (item: CommandItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[14vh]">
          <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Befehlspalette"
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-card shadow-2xl"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                execute(filtered[index]);
              }
            }}
          >
            <div className="flex items-center gap-3 border-b border-line-soft px-4">
              <Search className="size-4 text-faint" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Befehl oder Seite suchen …"
                aria-label="Befehl suchen"
                className="h-12 w-full bg-transparent text-[15px] text-fg placeholder:text-faint focus:outline-none"
              />
            </div>
            <ul className="scrollbar-thin max-h-[320px] overflow-y-auto p-2" role="listbox">
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-faint">Keine Treffer</li>}
              {filtered.map((c, i) => (
                <li key={c.id} role="option" aria-selected={i === index}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => execute(c)}
                    className={cn('flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm', i === index ? 'bg-elevated text-fg' : 'text-muted')}
                  >
                    <c.icon className="size-4 text-faint" aria-hidden />
                    {c.label}
                    <span className="ml-auto text-[11px] text-faint">{i === index ? <CornerDownLeft className="size-3.5" /> : c.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
