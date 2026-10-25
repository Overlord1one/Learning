import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Award, ChevronUp, PackageCheck, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { SessionCelebration, UnlockCelebration } from '../../store/appStore';
import { levelProgress } from '../../domain/economy';
import { rankForLevel } from '../../domain/ranks';
import { formatAmount, formatCredits, formatInt, formatSC } from '../../domain/format';
import { useReducedMotion } from '../../store/hooks';
import { AnimatedNumber, ProgressBar } from '../ui/progress';
import { Button } from '../ui/primitives';
import { CreditCoin, ProductVisual } from '../ui/visuals';
import { Particles } from './Particles';
import { AchievementBadge } from '../AchievementBadge';

export function CelebrationOverlay() {
  const celebration = useAppStore((s) => s.celebration);
  const dismiss = useAppStore((s) => s.dismissCelebration);

  useEffect(() => {
    if (!celebration) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [celebration, dismiss]);

  return createPortal(
    <AnimatePresence>
      {celebration && (
        <motion.div
          key="celebration"
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="absolute inset-0 bg-[#07080a]/80 backdrop-blur-md" onClick={dismiss} />
          {celebration.kind === 'session' ? (
            <SessionSummary c={celebration} onClose={dismiss} />
          ) : (
            <UnlockSummary c={celebration} onClose={dismiss} />
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const panelMotion = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.98 },
  transition: { type: 'spring' as const, bounce: 0.18, duration: 0.6 },
};

function SessionSummary({ c, onClose }: { c: SessionCelebration; onClose: () => void }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const ranks = useAppStore((s) => s.data.settings.ranks);
  const leveledUp = c.after.level > c.before.level;
  const [step, setStep] = useState<'summary' | 'levelup'>('summary');

  const beforeProgress = levelProgress(c.before.xp);
  const afterProgress = levelProgress(c.after.xp);

  useEffect(() => {
    if (!leveledUp) return;
    const t = window.setTimeout(() => setStep('levelup'), reduced ? 600 : 2100);
    return () => window.clearTimeout(t);
  }, [leveledUp, reduced]);

  const goShop = (rewardId: string) => {
    onClose();
    navigate(`/shop?belohnung=${rewardId}`);
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      {...panelMotion}
      className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-line bg-card shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(70%_100%_at_50%_0%,var(--accent-soft),transparent)]" />
      <Particles />
      <AnimatePresence mode="wait" initial={false}>
        {step === 'summary' ? (
          <motion.div key="summary" className="relative px-7 pt-9 pb-7" exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <p className="text-center font-mono text-[11px] font-medium tracking-[0.28em] text-accent">SESSION ABGESCHLOSSEN</p>
            <h2 id="celebration-title" className="mt-3 text-center text-[26px] font-semibold tracking-[-0.02em] text-fg">
              {formatInt(c.session.minutes)} {c.session.minutes === 1 ? 'Minute' : 'Minuten'} fokussiert gelernt
            </h2>
            <p className="mt-1 text-center text-sm text-muted">{c.session.goal || 'Starke Arbeit. Jede Minute zählt.'}</p>

            <div className={c.creativeCredits > 0 ? 'mt-7 grid grid-cols-3 gap-2.5' : 'mt-7 grid grid-cols-2 gap-3'}>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-gold/15 bg-gold-soft p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <CreditCoin />
                  <AnimatedNumber value={c.credits} from={0} delay={0.3} format={(v) => `+${formatCredits(Math.round(v))}`} className="text-2xl font-semibold text-gold" />
                </div>
                <p className="mt-1 text-xs text-gold/70">Setup Credits</p>
              </motion.div>
              {c.creativeCredits > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="rounded-2xl border border-creative/20 bg-creative-soft p-4 text-center">
                  <AnimatedNumber value={c.creativeCredits} from={0} delay={0.5} format={(v) => `+${formatCredits(Math.round(v))}`} className="text-2xl font-semibold text-creative" />
                  <p className="mt-1 text-xs text-creative/70">Kreativ-Credits</p>
                </motion.div>
              )}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-2xl border border-accent/15 bg-accent-soft p-4 text-center">
                <AnimatedNumber value={c.xp} from={0} delay={0.4} format={(v) => `+${formatInt(v)}`} className="text-2xl font-semibold text-accent" />
                <p className="mt-1 text-xs text-accent/70">XP</p>
              </motion.div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <div className="mb-2 flex items-baseline justify-between text-xs">
                  <span className="font-medium text-fg">Level {leveledUp ? c.before.level : c.after.level}</span>
                  <span className="tabular text-muted">
                    {leveledUp ? `${beforeProgress.xpForLevel} / ${beforeProgress.xpForLevel}` : `${afterProgress.xpIntoLevel} / ${afterProgress.xpForLevel}`} XP
                  </span>
                </div>
                <ProgressBar value={leveledUp ? 1 : afterProgress.ratio} from={beforeProgress.ratio} delay={0.5} label="XP-Fortschritt" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line-soft bg-[#111418] px-4 py-3">
                <span className="text-sm text-muted">Guthaben</span>
                <span className="flex items-center gap-1.5">
                  <CreditCoin className="size-3.5" />
                  <AnimatedNumber value={c.after.balanceCents} from={c.before.balanceCents} delay={0.6} duration={1.2} format={(v) => formatSC(Math.round(v))} className="text-sm font-semibold text-fg" />
                </span>
              </div>
            </div>

            <RewardsAndBadges c={c} onShop={goShop} />

            <div className="mt-6 flex gap-2">
              {leveledUp ? (
                <Button variant="primary" className="w-full" onClick={() => setStep('levelup')} iconRight={ChevronUp}>
                  Level-Up ansehen
                </Button>
              ) : (
                <Button variant="primary" className="w-full" onClick={onClose} data-autofocus>
                  Weiter
                </Button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="levelup" className="relative px-7 pt-10 pb-7 text-center" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <Particles count={26} />
            <p className="font-mono text-[11px] font-medium tracking-[0.28em] text-gold">LEVEL UP</p>
            <motion.div
              className="mx-auto mt-6 flex size-28 items-center justify-center rounded-full border border-accent/30 bg-[radial-gradient(circle,var(--accent-soft),transparent_70%)]"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.4, duration: 0.8, delay: 0.1 }}
            >
              <div className="flex size-20 flex-col items-center justify-center rounded-full border border-line bg-elevated">
                <span className="text-[10px] uppercase tracking-[0.18em] text-faint">Level</span>
                <AnimatedNumber value={c.after.level} from={c.before.level} delay={0.4} format={(v) => String(Math.round(v))} className="text-3xl font-semibold text-fg" />
              </div>
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-fg">
              {rankForLevel(c.after.level, ranks)}
            </motion.h2>
            <p className="mt-1.5 text-sm text-muted">
              Du hast Level {c.after.level} erreicht. Noch {afterProgress.xpToNext} XP bis Level {c.after.level + 1}.
            </p>
            <div className="mt-6">
              <ProgressBar value={afterProgress.ratio} from={0} delay={0.7} label="Fortschritt im neuen Level" />
            </div>
            <RewardsAndBadges c={c} onShop={goShop} />
            <div className="mt-6 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep('summary')}>
                Zusammenfassung
              </Button>
              <Button variant="primary" className="flex-1" onClick={onClose} data-autofocus>
                Weiter
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RewardsAndBadges({ c, onShop }: { c: SessionCelebration; onShop: (id: string) => void }) {
  if (c.affordable.length === 0 && c.achievements.length === 0) return null;
  return (
    <div className="mt-5 space-y-3 text-left">
      {c.affordable.map((r) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold-soft p-3"
        >
          <ProductVisual reward={r} tone="ready" className="size-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
              <Sparkles className="size-3" /> Neue Belohnung freigeschaltet!
            </p>
            <p className="truncate text-sm font-medium text-fg">{r.name}</p>
          </div>
          <Button size="sm" variant="gold" onClick={() => onShop(r.id)} iconRight={ArrowRight}>
            Shop
          </Button>
        </motion.div>
      ))}
      {c.achievements.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="rounded-2xl border border-line-soft bg-[#111418] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            <Award className="size-3" /> Erfolg{c.achievements.length > 1 ? 'e' : ''} erhalten
          </p>
          <div className="flex flex-wrap gap-3">
            {c.achievements.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <AchievementBadge def={a} unlocked size={36} />
                <span className="text-sm font-medium text-fg">{a.title}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function UnlockSummary({ c, onClose }: { c: UnlockCelebration; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-title"
      {...panelMotion}
      className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-line bg-card px-7 pt-9 pb-7 text-center shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(70%_100%_at_50%_0%,var(--color-gold-soft),transparent)]" />
      <Particles count={24} colors={['var(--color-gold)', '#f0dcb0']} />
      <p className="relative font-mono text-[11px] font-medium tracking-[0.28em] text-gold">BELOHNUNG FREIGESCHALTET</p>
      <motion.div
        className="relative mx-auto mt-6 w-44"
        initial={{ scale: 0.7, opacity: 0, rotate: -4 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', bounce: 0.35, duration: 0.9, delay: 0.1 }}
      >
        <motion.div
          className="absolute -inset-3 rounded-[26px] border border-gold/20"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0, 1, 0.5], scale: [0.9, 1.04, 1] }}
          transition={{ duration: 1.4, delay: 0.3 }}
        />
        <ProductVisual reward={c.reward} tone="ready" className="aspect-[4/3] w-full" />
      </motion.div>
      <motion.h2 id="unlock-title" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="relative mt-7 text-[22px] font-semibold tracking-[-0.02em] text-fg">
        {c.reward.name}
      </motion.h2>
      <p className="relative mt-1 text-sm text-muted">{c.reward.variant || c.reward.category}</p>
      <div className="relative mt-5 flex items-center justify-center gap-4 text-sm">
        <span className="tabular font-medium text-gold">−{formatAmount(c.priceCents, c.reward.wallet)}</span>
        <span className="h-3.5 w-px bg-line" />
        <span className="text-muted">
          Neues Guthaben <span className="tabular font-medium text-fg">{formatAmount(c.balanceAfter, c.reward.wallet)}</span>
        </span>
      </div>
      <p className="relative mx-auto mt-5 max-w-xs text-[13px] leading-relaxed text-faint">
        Du hast dir diese Belohnung verdient. Die Freischaltung ist virtuell – es wird nichts automatisch bestellt oder bezahlt.
      </p>
      {c.achievements.length > 0 && (
        <div className="relative mt-5 flex flex-wrap justify-center gap-3 rounded-2xl border border-line-soft bg-[#111418] p-3">
          {c.achievements.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <AchievementBadge def={a} unlocked size={32} />
              <span className="text-sm font-medium text-fg">{a.title}</span>
            </div>
          ))}
        </div>
      )}
      <div className="relative mt-6 flex gap-2">
        <Button
          variant="ghost"
          className="flex-1"
          icon={PackageCheck}
          onClick={() => {
            onClose();
            navigate('/shop?ansicht=inventar');
          }}
        >
          Inventar
        </Button>
        <Button variant="gold" className="flex-1" onClick={onClose} data-autofocus>
          Großartig
        </Button>
      </div>
    </motion.div>
  );
}
