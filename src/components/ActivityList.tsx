import { useMemo } from 'react';
import { ArrowUpCircle, BookOpen, Gift, Undo2 } from 'lucide-react';
import { activityFeed } from '../domain/stats';
import type { ActivityItem } from '../domain/stats';
import { formatInt, formatMinutes, formatSC, formatShortDate, formatTime } from '../domain/format';
import { rankForLevel } from '../domain/ranks';
import { useData } from '../store/hooks';
import { cn } from '../lib/cn';

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Heute, ${formatTime(d)}`;
  if (d.toDateString() === yesterday.toDateString()) return `Gestern, ${formatTime(d)}`;
  return formatShortDate(d);
}

export function ActivityList({ limit = 8 }: { limit?: number }) {
  const data = useData();
  const items = useMemo(() => activityFeed(data, limit), [data, limit]);
  const categories = data.categories;

  const render = (item: ActivityItem) => {
    switch (item.kind) {
      case 'session': {
        const cat = categories.find((c) => c.id === item.session.categoryId);
        return {
          icon: BookOpen,
          tone: 'text-accent bg-accent-soft',
          title: `${formatMinutes(item.session.minutes)} · ${cat?.name ?? 'Lernen'}`,
          sub: item.session.goal || item.session.description || (item.session.source === 'timer' ? 'Live-Timer' : 'Manuell eingetragen'),
          right: (
            <div className="text-right">
              <p className="tabular text-sm font-medium text-gold">+{formatSC(item.credits)}</p>
              <p className="tabular text-xs text-faint">+{formatInt(item.xp)} XP</p>
            </div>
          ),
        };
      }
      case 'levelup':
        return {
          icon: ArrowUpCircle,
          tone: 'text-success bg-success-soft',
          title: `Level ${item.level} erreicht`,
          sub: rankForLevel(item.level, data.settings.ranks),
          right: null,
        };
      case 'purchase':
        return {
          icon: Gift,
          tone: 'text-gold bg-gold-soft',
          title: `Freigeschaltet: ${item.name}`,
          sub: 'Belohnung',
          right: <p className="tabular text-sm font-medium text-muted">−{formatSC(item.priceCents)}</p>,
        };
      case 'refund':
        return {
          icon: Undo2,
          tone: 'text-muted bg-elevated',
          title: `Rückgängig: ${item.name}`,
          sub: 'Credits erstattet',
          right: <p className="tabular text-sm font-medium text-muted">+{formatSC(item.priceCents)}</p>,
        };
    }
  };

  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col">
      {items.map((item) => {
        const r = render(item);
        return (
          <li key={item.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-0">
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', r.tone)}>
              <r.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{r.title}</p>
              <p className="truncate text-xs text-faint">
                {r.sub} · {relativeDay(item.at)}
              </p>
            </div>
            {r.right}
          </li>
        );
      })}
    </ul>
  );
}
