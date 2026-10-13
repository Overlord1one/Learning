import { ChartNoAxesColumn, LayoutDashboard, Settings, ShoppingBag, Timer, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  shortcut: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, shortcut: '1' },
  { to: '/lernen', label: 'Lernen', icon: Timer, shortcut: '2' },
  { to: '/shop', label: 'Shop', icon: ShoppingBag, shortcut: '3' },
  { to: '/fortschritt', label: 'Fortschritt', icon: ChartNoAxesColumn, shortcut: '4' },
  { to: '/erfolge', label: 'Erfolge', icon: Trophy, shortcut: '5' },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings, shortcut: '6' },
];
