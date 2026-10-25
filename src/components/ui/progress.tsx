import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { animate, motion } from 'motion/react';
import { useReducedMotion } from '../../store/hooks';
import { cn } from '../../lib/cn';

type Tone = 'accent' | 'gold' | 'success' | 'creative';

const fills: Record<Tone, string> = {
  accent: 'bg-accent',
  gold: 'bg-gold',
  success: 'bg-success',
  creative: 'bg-creative',
};

/** Smoothly filling progress bar. `value` 0 … 1. */
export function ProgressBar({
  value,
  tone = 'accent',
  size = 'md',
  label,
  className,
  from,
  delay = 0,
}: {
  value: number;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  label: string;
  className?: string;
  /** Optional start value for "fill from" animations (0 … 1). */
  from?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, value));
  const height = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn('relative w-full overflow-hidden rounded-full bg-[#0f1216] ring-1 ring-inset ring-white/[0.04]', height, className)}
    >
      <motion.div
        className={cn('absolute inset-y-0 left-0 rounded-full', fills[tone])}
        initial={reduced ? false : { width: `${(from ?? 0) * 100}%` }}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ duration: reduced ? 0 : 1.1, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0 : delay }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent" />
      </motion.div>
    </div>
  );
}

/** Number that counts from its previous value to the new one. */
export function AnimatedNumber({
  value,
  format,
  className,
  duration = 0.9,
  from,
  delay = 0,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
  from?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(from ?? value);
  const prev = useRef(from ?? value);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduced, duration, delay]);

  return (
    <span className={cn('tabular', className)} aria-label={format(value)}>
      <span aria-hidden>{format(display)}</span>
    </span>
  );
}

/** Circular progress ring (used for daily goal). */
export function Ring({ value, size = 64, stroke = 6, tone = 'accent', children }: { value: number; size?: number; stroke?: number; tone?: Tone; children?: ReactNode }) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, value));
  const color =
    tone === 'gold' ? 'var(--color-gold)' : tone === 'success' ? 'var(--color-success)' : tone === 'creative' ? 'var(--color-creative)' : 'var(--accent)';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0f1216" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduced ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped) }}
          transition={{ duration: reduced ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
