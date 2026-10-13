import { Brain, Calendar, CalendarCheck, Clock, Crown, Flame, Footprints, Gift, Layers, Lock, Trophy } from 'lucide-react';
import type { AchievementDef, AchievementIcon } from '../domain/achievements';
import { cn } from '../lib/cn';

const ICONS: Record<AchievementIcon, typeof Trophy> = {
  footprints: Footprints,
  flame: Flame,
  calendar: Calendar,
  calendarCheck: CalendarCheck,
  brain: Brain,
  gift: Gift,
  layers: Layers,
  crown: Crown,
  clock: Clock,
  trophy: Trophy,
};

const TIER = {
  bronze: { ring: '#b9875a', glow: 'rgba(185,135,90,0.18)', icon: '#e2b48a' },
  silber: { ring: '#aab4c3', glow: 'rgba(170,180,195,0.16)', icon: '#dfe5ee' },
  gold: { ring: '#d9b46a', glow: 'rgba(217,180,106,0.2)', icon: '#f0d39a' },
};

/** Collectible hexagonal badge. */
export function AchievementBadge({ def, unlocked, size = 64 }: { def: AchievementDef; unlocked: boolean; size?: number }) {
  const Icon = unlocked ? ICONS[def.icon] : Lock;
  const tier = TIER[def.tier];
  const id = `badge-${def.id}-${size}`;
  return (
    <div className={cn('relative shrink-0', !unlocked && 'opacity-60')} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={unlocked ? '#262c35' : '#1a1e24'} />
            <stop offset="1" stopColor={unlocked ? '#171b21' : '#14171b'} />
          </linearGradient>
        </defs>
        {unlocked && <circle cx="32" cy="32" r="30" fill={tier.glow} />}
        <path d="M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z" fill={`url(#${id})`} stroke={unlocked ? tier.ring : '#2c323b'} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M32 10 L51 21 L51 43 L32 54 L13 43 L13 21 Z" fill="none" stroke={unlocked ? tier.ring : '#2c323b'} strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon style={{ width: size * 0.34, height: size * 0.34, color: unlocked ? tier.icon : '#5a616c' }} strokeWidth={1.8} />
      </div>
    </div>
  );
}
