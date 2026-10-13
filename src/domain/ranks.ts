import type { RankTier } from './types';

export const DEFAULT_RANKS: RankTier[] = [
  { minLevel: 1, name: 'Anfänger' },
  { minLevel: 2, name: 'Lehrling' },
  { minLevel: 3, name: 'Code Explorer' },
  { minLevel: 4, name: 'Entwickler' },
  { minLevel: 5, name: 'System Builder' },
  { minLevel: 10, name: 'Setup Architect' },
  { minLevel: 15, name: 'Master Developer' },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function roman(n: number): string {
  if (n <= ROMAN.length) return ROMAN[n - 1] ?? String(n);
  return String(n);
}

/**
 * Rank name for a level. Levels between two milestones receive a consistent
 * numeral suffix: System Builder → System Builder II → … → Setup Architect.
 */
export function rankForLevel(level: number, tiers: readonly RankTier[]): string {
  const sorted = [...tiers].sort((a, b) => a.minLevel - b.minLevel);
  let tier = sorted[0];
  for (const t of sorted) if (t.minLevel <= level) tier = t;
  if (!tier) return 'Anfänger';
  const step = level - tier.minLevel;
  return step === 0 ? tier.name : `${tier.name} ${roman(step + 1)}`;
}
