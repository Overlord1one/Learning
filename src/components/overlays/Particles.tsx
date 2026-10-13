import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '../../store/hooks';

/** Very subtle drifting particles – purely decorative. */
const DEFAULT_COLORS = ['var(--accent)', 'var(--color-gold)'];

export function Particles({ count = 18, colors = DEFAULT_COLORS }: { count?: number; colors?: string[] }) {
  const reduced = useReducedMotion();
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: 8 + Math.random() * 84,
        size: 2 + Math.random() * 3,
        delay: Math.random() * 0.8,
        duration: 1.8 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 40,
        rise: 140 + Math.random() * 60,
        color: colors[i % colors.length],
      })),
    [count, colors],
  );
  if (reduced) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full"
          style={{ left: `${p.x}%`, bottom: '30%', width: p.size, height: p.size, background: p.color }}
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={{ opacity: [0, 0.9, 0], y: -p.rise, x: p.drift }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
