import { DEFAULT_RATES } from './economy';
import { DEFAULT_RANKS } from './ranks';
import { SCHEMA_VERSION } from './types';
import type { AppData, Reward, Settings, StudyCategory } from './types';

/**
 * Subjects ordered by priority. The weighting scales credits and XP per hour.
 * Math has 8 school hours per week – twice as many as the other school subjects
 * (4 h each) – and is weighted highest. Programming (self-study) comes next,
 * then the 4-hour school subjects, lectures and finally video editing.
 */
export const DEFAULT_CATEGORIES: StudyCategory[] = [
  { id: 'cat-mathe', name: 'Mathematik', color: '#199e70', isDefault: true, archived: false, weightPercent: 150, weeklyTargetMinutes: 0 },
  { id: 'cat-cs50x', name: 'Harvard CS50x', color: '#3987e5', isDefault: true, archived: false, weightPercent: 120, weeklyTargetMinutes: 0 },
  { id: 'cat-cs50p', name: 'Harvard CS50P / Python', color: '#d95926', isDefault: true, archived: false, weightPercent: 120, weeklyTargetMinutes: 0 },
  { id: 'cat-etechnik', name: 'Elektrotechnik', color: '#c98500', isDefault: true, archived: false, weightPercent: 100, weeklyTargetMinutes: 0 },
  { id: 'cat-digitalrechner', name: 'Digitalrechner', color: '#008300', isDefault: true, archived: false, weightPercent: 100, weeklyTargetMinutes: 0 },
  { id: 'cat-vorlesungen', name: 'Vorlesungen', color: '#9085e9', isDefault: true, archived: false, weightPercent: 75, weeklyTargetMinutes: 0 },
  { id: 'cat-video', name: 'Video-Schnitt (Social Media)', color: '#e66767', isDefault: true, archived: false, weightPercent: 50, weeklyTargetMinutes: 0 },
  { id: 'cat-sonstiges', name: 'Sonstiges', color: '#d55181', isDefault: true, archived: false, weightPercent: 50, weeklyTargetMinutes: 0 },
];

export const WEIGHT_OPTIONS = [50, 75, 90, 100, 110, 120, 125, 150, 200];

/** Categorical palette – validated for colour-vision deficiency on the dark surface. */
export const CATEGORY_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

type DefaultRewardSeed = Omit<Reward, 'createdAt'>;

export const DEFAULT_REWARDS: DefaultRewardSeed[] = [
  {
    id: 'rw-mousepad',
    name: 'Endgame Gear MPC890 Stealth Edition',
    description: 'Großes Stoff-Mauspad mit gleichmäßiger Gleitfläche – die Basis für ein aufgeräumtes Setup.',
    category: 'Desk Accessories',
    variant: 'Stealth Edition',
    icon: 'mousepad',
    imageUrl: '',
    priceCents: 15000,
    realPriceEuroCents: null,
    productUrl: '',
    priority: 'mittel',
    isDefault: true,
    preOwned: false,
    archived: false,
    sortOrder: 1,
  },
  {
    id: 'rw-mx-master',
    name: 'Logitech MX Master 3S',
    description: 'Ergonomische Produktivitätsmaus mit leisen Klicks und MagSpeed-Scrollrad.',
    category: 'Maus',
    variant: 'Weiß / Hellgrau',
    icon: 'mouse',
    imageUrl: '',
    priceCents: 40000,
    realPriceEuroCents: null,
    productUrl: '',
    priority: 'mittel',
    isDefault: true,
    preOwned: false,
    archived: false,
    sortOrder: 2,
  },
  {
    id: 'rw-lofree-flow',
    name: 'Lofree Flow 2',
    description: 'Flache mechanische Low-Profile-Tastatur mit gedämpftem, weichem Anschlag.',
    category: 'Tastatur',
    variant: 'Light / Silber / Weiß',
    icon: 'keyboard',
    imageUrl: '',
    priceCents: 70000,
    realPriceEuroCents: null,
    productUrl: '',
    priority: 'mittel',
    isDefault: true,
    preOwned: false,
    archived: false,
    sortOrder: 3,
  },
  {
    id: 'rw-dt900',
    name: 'Beyerdynamic DT 900 PRO X',
    description: 'Offener Studio-Kopfhörer für präzisen Klang und lange, konzentrierte Sessions.',
    category: 'Audio',
    variant: 'Open-Back',
    icon: 'headphones',
    imageUrl: '',
    priceCents: 80000,
    realPriceEuroCents: null,
    productUrl: '',
    priority: 'mittel',
    isDefault: true,
    preOwned: false,
    archived: false,
    sortOrder: 4,
  },
  {
    id: 'rw-flexispot',
    name: 'FlexiSpot E7 Pro 2026',
    description: 'Elektrisch höhenverstellbarer Schreibtisch – das Fundament des Traum-Setups.',
    category: 'Schreibtisch',
    variant: 'Große Tischplatte, dunkles Finish',
    icon: 'desk',
    imageUrl: '',
    priceCents: 250000,
    realPriceEuroCents: null,
    productUrl: '',
    priority: 'hoch',
    isDefault: true,
    preOwned: false,
    archived: false,
    sortOrder: 5,
  },
];

export const PREOWNED_REWARDS: DefaultRewardSeed[] = [
  {
    id: 'rw-roccat',
    name: 'ROCCAT Gaming-Maus (kabelgebunden)',
    description: 'Bereits im Besitz – Teil des aktuellen Setups.',
    category: 'Maus',
    variant: 'Kabelgebunden',
    icon: 'mouse',
    imageUrl: '',
    priceCents: 0,
    realPriceEuroCents: null,
    productUrl: '',
    priority: 'niedrig',
    isDefault: true,
    preOwned: true,
    archived: false,
    sortOrder: 0,
  },
];

/** Prices of the first release – used to migrate untouched rewards to the new prices. */
export const V1_DEFAULT_PRICES: Record<string, number> = {
  'rw-mousepad': 4000,
  'rw-mx-master': 10000,
  'rw-lofree-flow': 17500,
  'rw-dt900': 20000,
  'rw-flexispot': 70000,
};

/** Prices of version 2 (before the 28-hour weekly plan was considered). */
export const V2_DEFAULT_PRICES: Record<string, number> = {
  'rw-mousepad': 15000,
  'rw-mx-master': 40000,
  'rw-lofree-flow': 70000,
  'rw-dt900': 80000,
  'rw-flexispot': 250000,
};

/** Version 3 defaults – used to migrate untouched values to version 4. */
export const V3_DEFAULT_PRICES: Record<string, number> = {
  'rw-mousepad': 25000,
  'rw-mx-master': 60000,
  'rw-lofree-flow': 100000,
  'rw-dt900': 110000,
  'rw-flexispot': 350000,
};
export const V3_DEFAULT_WEIGHTS: Record<string, number> = {
  'cat-mathe': 125,
  'cat-cs50x': 110,
  'cat-cs50p': 110,
  'cat-etechnik': 100,
  'cat-digitalrechner': 90,
  'cat-vorlesungen': 75,
  'cat-video': 50,
  'cat-sonstiges': 50,
};
export const V3_DEFAULT_WEEKLY_TARGETS: Record<string, number> = {
  'cat-mathe': 480,
  'cat-cs50x': 120,
  'cat-cs50p': 120,
  'cat-etechnik': 240,
  'cat-digitalrechner': 240,
  'cat-vorlesungen': 240,
  'cat-video': 240,
};

export const DEFAULT_REWARD_IDS = DEFAULT_REWARDS.map((r) => r.id);

export function defaultSettings(): Settings {
  return {
    profileName: '',
    dailyGoalMinutes: 120,
    defaultCategoryId: 'cat-mathe',
    rates: { ...DEFAULT_RATES },
    ranks: DEFAULT_RANKS.map((r) => ({ ...r })),
    goalRewardId: 'rw-mousepad',
    motion: 'system',
    accent: 'blau',
    timerReminderMinutes: 0,
    sessionPresets: [25, 45, 60, 90],
    notifications: false,
  };
}

/** A brand new account: 0 SC, 0 XP, level 1, no sessions, no invented history. */
export function createInitialData(now: Date = new Date()): AppData {
  const createdAt = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt,
    settings: defaultSettings(),
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    sessions: [],
    transactions: [],
    rewards: [...PREOWNED_REWARDS, ...DEFAULT_REWARDS].map((r) => ({ ...r, createdAt })),
    purchases: [],
    achievementsSeen: {},
    activeTimer: null,
  };
}
