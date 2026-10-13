import { useState } from 'react';
import { Armchair, Gift, Lamp, Monitor, Speaker } from 'lucide-react';
import type { Reward, RewardIcon } from '../../domain/types';
import { cn } from '../../lib/cn';

/** Small warm-gold coin used as the Setup Credits symbol. */
export function CreditCoin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn('size-4 shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id="coin-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ecd29b" />
          <stop offset="1" stopColor="#b98f45" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="8.5" fill="url(#coin-g)" />
      <circle cx="10" cy="10" r="6.2" fill="none" stroke="#7d5f2a" strokeOpacity="0.45" strokeWidth="1" />
      <path d="M11.9 7.6c-.4-.6-1.1-.9-1.9-.9-1.1 0-1.9.6-1.9 1.4 0 1.9 3.9 1 3.9 3 0 .9-.9 1.5-2 1.5-.9 0-1.6-.4-2-1" fill="none" stroke="#5c4519" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Minimal line-art product illustrations – no external images required. */
function Illustration({ icon }: { icon: RewardIcon }) {
  switch (icon) {
    case 'mousepad':
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full">
          <path d="M14 30 L70 14 L108 34 L52 52 Z" {...stroke} strokeOpacity={0.9} />
          <path d="M14 30 L14 34 L52 56 L108 38 L108 34" {...stroke} strokeOpacity={0.45} />
          <path d="M30 32 L64 22" {...stroke} strokeOpacity={0.18} />
          <path d="M38 38 L76 27" {...stroke} strokeOpacity={0.18} />
          <ellipse cx="74" cy="31" rx="7" ry="4.5" {...stroke} strokeOpacity={0.7} />
        </svg>
      );
    case 'mouse':
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full">
          <path d="M60 10 C78 10 84 26 84 42 C84 60 74 70 60 70 C46 70 36 60 36 42 C36 26 42 10 60 10 Z" {...stroke} />
          <path d="M60 10 L60 32" {...stroke} strokeOpacity={0.6} />
          <rect x="57" y="18" width="6" height="10" rx="3" {...stroke} strokeOpacity={0.9} />
          <path d="M38 36 C46 34 52 34 60 34 C68 34 74 34 82 36" {...stroke} strokeOpacity={0.3} />
          <path d="M84 40 C88 41 90 44 89 48" {...stroke} strokeOpacity={0.45} />
        </svg>
      );
    case 'keyboard':
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full">
          <rect x="10" y="22" width="100" height="38" rx="6" {...stroke} />
          {[0, 1, 2].map((row) =>
            Array.from({ length: 10 - (row === 2 ? 2 : 0) }).map((_, i) => (
              <rect key={`${row}-${i}`} x={17 + i * 9.2 + (row === 2 ? 9.2 : 0)} y={28 + row * 8.5} width="6.4" height="5.6" rx="1.4" {...stroke} strokeWidth={1.1} strokeOpacity={0.55} />
            )),
          )}
          <rect x="35" y="53" width="50" height="3.2" rx="1.6" {...stroke} strokeWidth={1.1} strokeOpacity={0.55} />
        </svg>
      );
    case 'headphones':
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full">
          <path d="M34 50 L34 40 C34 22 46 10 60 10 C74 10 86 22 86 40 L86 50" {...stroke} />
          <path d="M40 40 C40 26 48 16 60 16 C72 16 80 26 80 40" {...stroke} strokeOpacity={0.35} />
          <rect x="26" y="44" width="16" height="26" rx="7" {...stroke} />
          <rect x="78" y="44" width="16" height="26" rx="7" {...stroke} />
          <path d="M30 52 L30 62 M90 52 L90 62" {...stroke} strokeOpacity={0.4} />
        </svg>
      );
    case 'desk':
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full">
          <rect x="8" y="24" width="104" height="7" rx="2.5" {...stroke} />
          <path d="M28 31 L28 66 M92 31 L92 66" {...stroke} strokeWidth={3} strokeOpacity={0.8} />
          <path d="M28 44 L28 66 M92 44 L92 66" {...stroke} strokeWidth={4.4} strokeOpacity={0.35} />
          <path d="M18 68 L38 68 M82 68 L102 68" {...stroke} strokeWidth={2.4} />
          <rect x="84" y="33" width="10" height="5" rx="1.5" {...stroke} strokeWidth={1.1} strokeOpacity={0.6} />
          <path d="M44 24 L44 14 L76 14 L76 24" {...stroke} strokeOpacity={0.3} />
        </svg>
      );
    default: {
      const Icon = { monitor: Monitor, lamp: Lamp, chair: Armchair, speaker: Speaker, gift: Gift }[icon] ?? Gift;
      return <Icon className="h-3/5 w-3/5" strokeWidth={1.2} />;
    }
  }
}

interface ProductVisualProps {
  reward: Pick<Reward, 'icon' | 'imageUrl' | 'name'>;
  tone?: 'locked' | 'ready' | 'owned';
  className?: string;
}

export function ProductVisual({ reward, tone = 'locked', className }: ProductVisualProps) {
  const [broken, setBroken] = useState(false);
  const color = tone === 'ready' ? 'text-gold' : tone === 'owned' ? 'text-success' : 'text-[#aeb6c3]';
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-2xl border border-line-soft',
        'bg-[radial-gradient(120%_90%_at_50%_0%,#222831_0%,#15181d_55%,#111418_100%)]',
        className,
      )}
    >
      {reward.imageUrl && !broken ? (
        <img src={reward.imageUrl} alt={reward.name} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <div className={cn('flex h-full w-full items-center justify-center p-[14%]', color)} aria-hidden>
          <Illustration icon={reward.icon} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
}

export const REWARD_ICON_OPTIONS: { value: RewardIcon; label: string }[] = [
  { value: 'gift', label: 'Geschenk' },
  { value: 'mousepad', label: 'Mauspad' },
  { value: 'mouse', label: 'Maus' },
  { value: 'keyboard', label: 'Tastatur' },
  { value: 'headphones', label: 'Kopfhörer' },
  { value: 'desk', label: 'Schreibtisch' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'lamp', label: 'Lampe' },
  { value: 'chair', label: 'Stuhl' },
  { value: 'speaker', label: 'Lautsprecher' },
];
