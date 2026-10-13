import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Command, Pause, Play } from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { CommandPalette } from './CommandPalette';
import { useAppStore } from '../../store/appStore';
import { useNow, usePlayer, useReducedMotion } from '../../store/hooks';
import { formatClock, formatCredits } from '../../domain/format';
import { timerElapsedMs } from '../../domain/timer';
import { CreditCoin } from '../ui/visuals';
import { Kbd } from '../ui/primitives';
import { ProgressBar } from '../ui/progress';
import { cn } from '../../lib/cn';

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-[10px] border border-line bg-elevated">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path d="M9 21l7-11 7 11" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="22.5" r="2" fill="var(--color-gold)" />
        </svg>
      </div>
      {!compact && (
        <span className="hidden font-mono text-[12.5px] font-semibold tracking-[0.2em] whitespace-nowrap text-fg min-[440px]:inline lg:inline">
          SETUP<span className="text-faint"> QUEST</span>
        </span>
      )}
    </div>
  );
}

function CreditChip({ className }: { className?: string }) {
  const { balanceCents } = usePlayer();
  return (
    <div className={cn('flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold-soft px-2.5 py-1', className)} title="Verfügbare Setup Credits">
      <CreditCoin className="size-3.5" />
      <span className="tabular text-[13px] font-semibold text-gold">{formatCredits(balanceCents)}</span>
      <span className="text-[11px] font-medium text-gold/70">SC</span>
    </div>
  );
}

function TimerPill({ compact = false }: { compact?: boolean }) {
  const timer = useAppStore((s) => s.data.activeTimer);
  const now = useNow(1000);
  const navigate = useNavigate();
  const location = useLocation();
  if (!timer || location.pathname === '/lernen') return null;
  const running = timer.status === 'running';
  return (
    <button
      type="button"
      onClick={() => navigate('/lernen')}
      className={cn(
        'focus-ring flex items-center gap-2 rounded-xl border border-accent/25 bg-accent-soft text-left transition-colors hover:border-accent/50',
        compact ? 'px-2.5 py-1' : 'w-full px-3 py-2.5',
      )}
      aria-label="Zur laufenden Lernsession"
    >
      <span className="relative flex size-2">
        {running && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />}
        <span className="relative inline-flex size-2 rounded-full bg-accent" />
      </span>
      <span className="tabular font-mono text-[13px] font-medium text-fg">{formatClock(timerElapsedMs(timer, now))}</span>
      {!compact && (
        <span className="ml-auto text-muted">{running ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}</span>
      )}
    </button>
  );
}

function Sidebar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const player = usePlayer();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line-soft bg-[#0d0f13] px-4 py-5 lg:flex">
      <div className="px-2">
        <Logo />
      </div>

      <nav aria-label="Hauptnavigation" className="mt-8 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'focus-ring group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors',
                isActive ? 'text-fg' : 'text-muted hover:bg-white/[0.03] hover:text-fg',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl border border-line bg-elevated"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
                  />
                )}
                <item.icon className={cn('relative size-[18px]', isActive ? 'text-accent' : 'text-faint group-hover:text-muted')} strokeWidth={1.9} aria-hidden />
                <span className="relative">{item.label}</span>
                <span className="relative ml-auto opacity-0 transition-opacity group-hover:opacity-100">
                  <Kbd>{item.shortcut}</Kbd>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <TimerPill />
        <button
          type="button"
          onClick={onOpenPalette}
          className="focus-ring flex h-9 items-center gap-2 rounded-xl border border-line-soft px-3 text-[13px] text-faint transition-colors hover:border-line hover:text-muted"
        >
          <Command className="size-3.5" aria-hidden />
          Befehle
          <span className="ml-auto flex gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <div className="rounded-2xl border border-line-soft bg-card p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-faint">Level {player.level}</p>
              <p className="mt-0.5 text-[13px] font-medium text-fg">{player.rank}</p>
            </div>
            <CreditChip />
          </div>
          <ProgressBar value={player.progress.ratio} size="sm" label="Level-Fortschritt" className="mt-3" />
          <p className="tabular mt-1.5 text-[11px] text-faint">
            {player.progress.xpIntoLevel} / {player.progress.xpForLevel} XP
          </p>
        </div>
      </div>
    </aside>
  );
}

function MobileTopBar() {
  const player = usePlayer();
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line-soft bg-bg/85 backdrop-blur-xl lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
      <Logo />
      <div className="flex items-center gap-2">
        <TimerPill compact />
        <span className="rounded-full border border-line px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-muted">Lv. {player.level}</span>
        <CreditChip />
      </div>
      </div>
    </header>
  );
}

function MobileNav() {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-[#0d0f13]/92 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-6">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn('focus-ring relative flex h-[60px] flex-col items-center justify-center gap-1 text-[10px] font-medium', isActive ? 'text-fg' : 'text-faint')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="mnav-active" className="absolute top-0 h-[2px] w-7 rounded-full bg-accent" />}
                <item.icon className={cn('size-[19px]', isActive && 'text-accent')} strokeWidth={1.9} aria-hidden />
                <span className="max-w-full truncate px-0.5">{item.label === 'Einstellungen' ? 'Setup' : item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Keeps the outgoing page rendered during its exit animation. */
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const focusMode = useAppStore((s) => s.focusMode);
  const reduced = useReducedMotion();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      const item = NAV_ITEMS.find((n) => n.shortcut === e.key);
      if (item) navigate(item.to);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh">
      {!focusMode && <Sidebar onOpenPalette={() => setPaletteOpen(true)} />}
      {!focusMode && <MobileTopBar />}
      <main className={cn('transition-[padding] duration-300', !focusMode && 'lg:pl-[248px]')}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn('mx-auto w-full max-w-[1180px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10', focusMode ? 'pt-[max(1.5rem,env(safe-area-inset-top))] pb-10' : 'pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-14')}
          >
            <FrozenOutlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {!focusMode && <MobileNav />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
