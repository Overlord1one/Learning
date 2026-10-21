import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Clock, Crosshair, Flame, Gauge, PenLine, Play, ShoppingBag, Sparkles, Star, Target, Zap } from 'lucide-react';
import { useData, usePlayer, useStudyStats } from '../store/hooks';
import { goalReward, projectCompletion, rewardProgress } from '../domain/stats';
import { formatDecimal, formatHours, formatHoursPrecise, formatInt, formatLongDate, formatMinutes, formatSC, formatCredits } from '../domain/format';
import { Badge, Button, Card, CardTitle, EmptyState } from '../components/ui/primitives';
import { AnimatedNumber, ProgressBar, Ring } from '../components/ui/progress';
import { CreditCoin, ProductVisual } from '../components/ui/visuals';
import { StatCard } from '../components/StatCard';
import { ActivityList } from '../components/ActivityList';
import { GoalPickerDialog } from '../components/shop/GoalPicker';
import { InstallHint } from '../components/InstallHint';
import { WeeklyPlanCard } from '../components/WeeklyPlanCard';

function LevelAvatar({ level, ratio }: { level: number; ratio: number }) {
  return (
    <Ring value={ratio} size={64} stroke={4}>
      <div className="flex size-[50px] flex-col items-center justify-center rounded-full border border-line bg-elevated">
        <span className="text-[8.5px] font-medium uppercase tracking-[0.16em] text-faint">Lv</span>
        <span className="-mt-0.5 text-lg font-semibold leading-none text-fg">{level}</span>
      </div>
    </Ring>
  );
}

function GoalCard() {
  const data = useData();
  const navigate = useNavigate();
  const player = usePlayer();
  const [picker, setPicker] = useState(false);
  const goal = goalReward(data);
  const progress = goal ? rewardProgress(data, goal, player.balanceCents) : null;
  const projection = useMemo(
    () => (progress ? projectCompletion(data.sessions, progress.missingCents, new Date()) : null),
    [data.sessions, progress],
  );

  if (!goal || !progress) {
    return (
      <Card className="lg:col-span-2">
        <EmptyState
          icon={Sparkles}
          title="Alle Belohnungen freigeschaltet"
          description="Dein Setup ist komplett. Lege im Shop eine neue, eigene Belohnung als nächstes Ziel an."
          action={<Button variant="primary" onClick={() => navigate('/shop?neu=1')}>Eigene Belohnung anlegen</Button>}
        />
      </Card>
    );
  }

  const ready = progress.status === 'freischaltbar';
  return (
    <Card className="relative overflow-hidden lg:col-span-2" padded={false}>
      <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-[radial-gradient(circle,var(--color-gold-soft),transparent_70%)]" />
      <div className="relative grid grid-cols-1 gap-6 p-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:p-6">
        <ProductVisual reward={goal} tone={ready ? 'ready' : 'locked'} className="aspect-[2/1] w-full sm:aspect-square" />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-gold">
                <Crosshair className="size-3.5" aria-hidden /> Aktuelles Ziel
              </p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.015em] text-fg sm:text-[22px]">{goal.name}</h2>
              <p className="mt-0.5 text-sm text-muted">{goal.variant || goal.category}</p>
            </div>
            <Badge tone={ready ? 'gold' : 'neutral'}>{ready ? 'Freischaltbar' : 'Gesperrt'}</Badge>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-end justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm">
                <CreditCoin className="size-3.5" />
                <span className="tabular font-semibold text-fg">{formatCredits(Math.min(player.balanceCents, goal.priceCents))}</span>
                <span className="tabular text-muted">/ {formatSC(goal.priceCents)}</span>
              </span>
              <span className="tabular text-2xl font-semibold tracking-[-0.02em] text-fg">
                <AnimatedNumber value={Math.floor(progress.ratio * 100)} format={(v) => `${Math.round(v)} %`} />
              </span>
            </div>
            <ProgressBar value={progress.ratio} tone="gold" size="lg" label={`Fortschritt zu ${goal.name}`} />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line-soft bg-[#111418] px-3.5 py-3">
              <dt className="text-[11.5px] text-faint">Fehlende Credits</dt>
              <dd className="tabular mt-0.5 text-[15px] font-semibold text-fg">{formatSC(progress.missingCents)}</dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-[#111418] px-3.5 py-3">
              <dt className="text-[11.5px] text-faint">Noch lernen</dt>
              <dd className="tabular mt-0.5 text-[15px] font-semibold text-fg">{progress.minutesNeeded > 0 ? formatHoursPrecise(progress.minutesNeeded) : '—'}</dd>
            </div>
            <div className="col-span-2 rounded-xl border border-line-soft bg-[#111418] px-3.5 py-3 sm:col-span-1">
              <dt className="text-[11.5px] text-faint">Prognose</dt>
              <dd className="mt-0.5 text-[13px] font-medium leading-snug text-fg">
                {projection?.kind === 'reached'
                  ? 'Jetzt verfügbar'
                  : projection?.kind === 'estimate'
                    ? `in ca. ${projection.days} ${projection.days === 1 ? 'Tag' : 'Tagen'}`
                    : 'Zu wenig Daten'}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2 sm:mt-auto sm:pt-5">
            {ready ? (
              <Button variant="gold" icon={Sparkles} onClick={() => navigate(`/shop?belohnung=${goal.id}`)}>
                Jetzt freischalten
              </Button>
            ) : (
              <Button variant="secondary" iconRight={ArrowRight} onClick={() => navigate(`/shop?belohnung=${goal.id}`)}>
                Details ansehen
              </Button>
            )}
            <Button variant="ghost" icon={Target} onClick={() => setPicker(true)}>
              Ziel ändern
            </Button>
          </div>
        </div>
      </div>
      <GoalPickerDialog open={picker} onClose={() => setPicker(false)} />
    </Card>
  );
}

function LevelCard() {
  const player = usePlayer();
  const data = useData();
  const stats = useStudyStats();
  const goal = data.settings.dailyGoalMinutes;
  return (
    <Card className="flex flex-col">
      <CardTitle icon={Zap}>Level-Fortschritt</CardTitle>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[34px] font-semibold leading-none tracking-[-0.03em] text-fg">
            Level <AnimatedNumber value={player.level} format={(v) => String(Math.round(v))} />
          </p>
          <p className="mt-1.5 text-sm text-muted">{player.rank}</p>
        </div>
        <Star className="size-5 text-accent" aria-hidden />
      </div>
      <div className="mt-6">
        <ProgressBar value={player.progress.ratio} label="XP im aktuellen Level" />
        <div className="tabular mt-2 flex justify-between text-xs">
          <span className="text-muted">
            <span className="font-medium text-fg">{formatInt(player.progress.xpIntoLevel)}</span> / {formatInt(player.progress.xpForLevel)} XP
          </span>
          <span className="text-faint">noch {formatInt(player.progress.xpToNext)} XP bis Lv. {player.level + 1}</span>
        </div>
      </div>
      {goal > 0 && (
        <div className="mt-auto flex items-center gap-4 border-t border-line-soft pt-5">
          <Ring value={stats.todayMinutes / goal} size={52} stroke={5} tone={stats.todayMinutes >= goal ? 'success' : 'accent'}>
            <span className="tabular text-[11px] font-semibold text-fg">{Math.min(100, Math.round((stats.todayMinutes / goal) * 100))}%</span>
          </Ring>
          <div>
            <p className="text-sm font-medium text-fg">Tagesziel</p>
            <p className="tabular text-xs text-muted">
              {formatMinutes(stats.todayMinutes)} von {formatMinutes(goal)}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const player = usePlayer();
  const stats = useStudyStats();
  const data = useData();
  const hasActivity = data.sessions.length > 0 || data.purchases.length > 0;

  return (
    <div>
      <InstallHint />
      <header className="mb-8 flex items-center gap-4 sm:mb-10">
        <LevelAvatar level={player.level} ratio={player.progress.ratio} />
        <div className="min-w-0">
          <p className="text-[13px] text-faint">{formatLongDate(new Date())}</p>
          <h1 className="truncate text-[26px] font-semibold tracking-[-0.02em] text-fg sm:text-[32px]">
            Willkommen zurück{player.name ? `, ${player.name}` : ''}
          </h1>
          <p className="text-sm text-muted">
            Level {player.level} · <span className="text-accent">{player.rank}</span>
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <GoalCard />
        <LevelCard />
      </div>

      <WeeklyPlanCard className="mt-4 lg:mt-5" />

      <section aria-label="Statistiken" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mt-5 lg:grid-cols-6 lg:gap-4">
        <StatCard index={0} icon={Gauge} tone="gold" label="Setup Credits" value={<AnimatedNumber value={player.balanceCents} format={(v) => formatCredits(Math.round(v))} />} sub="SC verfügbar" />
        <StatCard index={1} icon={Star} tone="accent" label="Level" value={player.level} sub={player.rank} />
        <StatCard index={2} icon={Zap} tone="accent" label="Gesamt-XP" value={<AnimatedNumber value={player.xp} format={(v) => formatInt(v)} />} sub="Erfahrungspunkte" />
        <StatCard index={3} icon={Clock} label="Lernzeit gesamt" value={formatHours(stats.totalMinutes)} sub={`${formatInt(stats.sessionCount)} ${stats.sessionCount === 1 ? 'Session' : 'Sessions'}`} />
        <StatCard index={4} icon={Clock} label="Diese Woche" value={formatHours(stats.weekMinutes)} sub={`Ø ${formatDecimal(stats.weekMinutes / 60 / 7)} h pro Tag`} />
        <StatCard index={5} icon={Flame} tone={stats.streak > 0 ? 'success' : 'neutral'} label="Lernserie" value={`${stats.streak} ${stats.streak === 1 ? 'Tag' : 'Tage'}`} sub={`Rekord: ${stats.bestStreak}`} />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-3 lg:gap-5">
        <Card className="flex flex-col gap-2.5">
          <CardTitle icon={Play}>Schnellaktionen</CardTitle>
          <motion.div whileHover={{ y: -1 }}>
            <Button variant="primary" size="lg" icon={Play} className="w-full justify-start" onClick={() => navigate('/lernen')}>
              {data.activeTimer ? 'Zur laufenden Session' : 'Lernsession starten'}
            </Button>
          </motion.div>
          <Button size="lg" icon={PenLine} className="w-full justify-start" onClick={() => navigate('/lernen?modus=manuell')}>
            Session manuell eintragen
          </Button>
          <Button size="lg" icon={ShoppingBag} className="w-full justify-start" onClick={() => navigate('/shop')}>
            Shop öffnen
          </Button>
          <p className="mt-auto pt-3 text-xs leading-relaxed text-faint">
            60 Minuten Fokus = 16 SC + 60 XP, gewichtet nach Fach: Mathematik ×1,5 (24 SC) bis Vorlesungen ×0,1875. Credits gibt es nur für bestätigte Sessions.
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle icon={Clock} action={hasActivity ? <Button size="sm" variant="ghost" onClick={() => navigate('/fortschritt')}>Alle Statistiken</Button> : undefined}>
            Letzte Aktivität
          </CardTitle>
          {hasActivity ? (
            <ActivityList limit={7} />
          ) : (
            <EmptyState
              icon={Play}
              title="Noch keine Aktivität"
              description="Starte deine erste Lernsession. Jede bestätigte Minute bringt dich deinem Traum-Setup näher."
              action={<Button variant="primary" icon={Play} onClick={() => navigate('/lernen')}>Erste Session starten</Button>}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
