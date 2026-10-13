import { DEFAULT_RATES } from './economy';
import { DEFAULT_RANKS } from './ranks';
import { SCHEMA_VERSION } from './types';
import type { AppData, Reward, Settings, StudyCategory } from './types';

export const DEFAULT_CATEGORIES: StudyCategory[] = [
  { id: 'cat-cs50x', name: 'Harvard CS50x', color: '#3987e5', isDefault: true, archived: false },
  { id: 'cat-cs50p', name: 'Harvard CS50P / Python', color: '#d95926', isDefault: true, archived: false },
  { id: 'cat-mathe', name: 'Mathematik', color: '#199e70', isDefault: true, archived: false },
  { id: 'cat-etechnik', name: 'Elektrotechnik', color: '#c98500', isDefault: true, archived: false },
  { id: 'cat-sonstiges', name: 'Sonstiges', color: '#d55181', isDefault: true, archived: false },
];

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
    priceCents: 4000,
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
    priceCents: 10000,
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
    priceCents: 17500,
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
    priceCents: 20000,
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
    priceCents: 70000,
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

export const DEFAULT_REWARD_IDS = DEFAULT_REWARDS.map((r) => r.id);

export function defaultSettings(): Settings {
  return {
    profileName: '',
    dailyGoalMinutes: 120,
    defaultCategoryId: 'cat-cs50x',
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
