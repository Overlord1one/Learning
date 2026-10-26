import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Calculator, CalendarDays, Clock, Coins, Flame, Layers, Timer, TrendingUp, Trophy, Zap } from 'lucide-react';
import { useData, usePlayer, useStudyStats } from '../store/hooks';
import {
  categoryBreakdown,
  creditFlowSeries,
  dailySeries,
  monthlySeries,
  projectCompletion,
  rangeStart,
  rewardProgress,
  shopRewards,
  weeklySeries,
  xpSeries,
} from '../domain/stats';
import type { RangeKey } from '../domain/stats';
import { dayKey, parseDayKey } from '../domain/dates';
import { earnedCents, levelForXp, spentCents } from '../domain/economy';
import { formatAmount, formatDate, formatDecimal, formatHours, formatHoursPrecise, formatInt, formatMinutes, formatSC, formatShortDate } from '../domain/format';
import { Card, CardTitle, PageHeader, Segmented, Select } from '../components/ui/primitives';
import { ProgressBar } from '../components/ui/progress';
import { StatCard } from '../components/StatCard';
import { axisProps, CHART, ChartEmpty, ChartTooltip, Legend } from '../components/charts';
import { useReducedMotion } from '../store/hooks';

const RANGES: { value: RangeKey; label: string }[] = [
  { value: '7', label: '7 Tage' },
  { value: '30', label: '30 Tage' },
  { value: '90', label: '90 Tage' },
  { value: 'all', label: 'Gesamt' },
];

const shortDay = (key: string) => formatShortDate(parseDayKey(key));
const hoursFmt = (v: number) => `${formatDecimal(v)} h`;

export function ProgressPage() {
  const data = useData();
  const stats = useStudyStats();
  const reduced = useReducedMotion();
  const [range, setRange] = useState<RangeKey>('30');
  const [period, setPeriod] = useState<'woche' | 'monat'>('woche');

  const now = new Date();
  const to = dayKey(now);
  const from = rangeStart(range, data.sessions, now);
  const anim = !reduced;

  const daily = useMemo(() => dailySeries(data.sessions, from, to), [data.sessions, from, to]);
  const buckets = useMemo(
    () => (period === 'woche' ? weeklySeries(data.sessions, from, to) : monthlySeries(data.sessions, from, to)),
    [data.sessions, from, to, period],
  );
  const xp = useMemo(() => xpSeries(data.sessions, from, to), [data.sessions, from, to]);
  const flowBucket = daily.length > 31 ? 'week' : 'day';
  const flow = useMemo(() => creditFlowSeries(data, from, to, flowBucket), [data, from, to, flowBucket]);
  const cats = useMemo(() => categoryBreakdown(data, from, to), [data, from, to]);
  const catTotal = cats.reduce((a, c) => a + c.minutes, 0);
  const rangeMinutes = daily.reduce((a, d) => a + d.minutes, 0);
  const hasData = data.sessions.length > 0;
  const hasFlow = flow.some((f) => f.earned !== 0 || f.spent !== 0);

  return (
    <div>
      <PageHeader
        eyebrow="Fortschritt"
        title="Analyse"
        description="Alle Werte stammen aus deinen tatsächlich erfassten Sessions."
        action={<Segmented<RangeKey> label="Zeitraum" value={range} onChange={setRange} options={RANGES} size="sm" />}
      />

      <section aria-label="Lernstatistik" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <StatCard index={0} icon={Clock} tone="accent" label="Heute" value={formatMinutes(stats.todayMinutes)} />
        <StatCard index={1} icon={CalendarDays} label="Diese Woche" value={formatHours(stats.weekMinutes)} />
        <StatCard index={2} icon={CalendarDays} label="Dieser Monat" value={formatHours(stats.monthMinutes)} />
        <StatCard index={3} icon={Layers} label="Gesamt" value={formatHours(stats.totalMinutes)} />
        <StatCard index={4} icon={TrendingUp} label="Ø pro Tag" value={formatMinutes(Math.round(stats.averageDailyMinutes))} sub="seit der ersten Session" />
        <StatCard index={5} icon={Trophy} label="Längste Session" value={formatMinutes(stats.longestSessionMinutes)} />
        <StatCard index={6} icon={Timer} label="Sessions" value={formatInt(stats.sessionCount)} sub={`${stats.activeDays} aktive Tage`} />
        <StatCard index={7} icon={Flame} tone={stats.streak > 0 ? 'success' : 'neutral'} label="Lernserie" value={`${stats.streak} ${stats.streak === 1 ? 'Tag' : 'Tage'}`} sub={`Rekord: ${stats.bestStreak} Tage`} />
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle icon={BarChart3} action={<span className="tabular text-xs text-faint">{formatHours(rangeMinutes)} im Zeitraum</span>}>
            Tägliche Lernaktivität
          </CardTitle>
          <div className="h-[240px]">
            {!hasData ? (
              <ChartEmpty>Noch keine Lerndaten – deine erste Session erscheint hier.</ChartEmpty>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap={daily.length > 60 ? 1 : 2}>
                  <CartesianGrid vertical={false} strokeDasharray="0" />
                  <XAxis dataKey="day" tickFormatter={shortDay} {...axisProps} minTickGap={24} />
                  <YAxis {...axisProps} tickFormatter={(v: number) => `${formatDecimal(v)}h`} allowDecimals />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<ChartTooltip format={(v) => hoursFmt(v)} labelFormat={(l) => formatDate(parseDayKey(l))} />} />
                  <Bar dataKey="hours" name="Stunden" fill={CHART.series1} radius={[4, 4, 0, 0]} isAnimationActive={anim} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {hasData && (
            <details className="mt-3 text-xs text-muted">
              <summary className="cursor-pointer text-faint hover:text-muted">Als Tabelle anzeigen</summary>
              <table className="tabular mt-2 w-full max-w-sm text-left">
                <thead>
                  <tr className="text-faint">
                    <th className="py-1 font-medium">Datum</th>
                    <th className="py-1 text-right font-medium">Lernzeit</th>
                  </tr>
                </thead>
                <tbody>
                  {daily
                    .filter((d) => d.minutes > 0)
                    .reverse()
                    .map((d) => (
                      <tr key={d.day} className="border-t border-line-soft">
                        <td className="py-1">{formatDate(parseDayKey(d.day))}</td>
                        <td className="py-1 text-right text-fg">{formatMinutes(d.minutes)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
          )}
        </Card>

        <Card>
          <CardTitle icon={Layers}>Nach Kategorie</CardTitle>
          {cats.length === 0 ? (
            <ChartEmpty>Keine Sessions im Zeitraum.</ChartEmpty>
          ) : (
            <ul className="flex flex-col gap-4">
              {cats.map((c) => (
                <li key={c.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-fg">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: c.color }} aria-hidden />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="tabular shrink-0 text-xs text-muted">
                      {formatHours(c.minutes)} · {Math.round((c.minutes / catTotal) * 100)} %
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#0f1216]">
                    <div className="h-full rounded-full" style={{ width: `${(c.minutes / catTotal) * 100}%`, background: c.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle
            icon={CalendarDays}
            action={
              <Segmented
                label="Periode"
                size="sm"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: 'woche', label: 'Woche' },
                  { value: 'monat', label: 'Monat' },
                ]}
              />
            }
          >
            Lernstunden
          </CardTitle>
          <div className="h-[220px]">
            {!hasData ? (
              <ChartEmpty>Noch keine Daten.</ChartEmpty>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={12} />
                  <YAxis {...axisProps} tickFormatter={(v: number) => `${formatDecimal(v)}h`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<ChartTooltip format={(v) => hoursFmt(v)} />} />
                  <Bar dataKey="hours" name="Stunden" fill={CHART.series1} radius={[4, 4, 0, 0]} isAnimationActive={anim} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={Zap}>XP-Verlauf</CardTitle>
          <div className="h-[220px]">
            {!hasData ? (
              <ChartEmpty>Noch keine XP gesammelt.</ChartEmpty>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={xp} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="xp-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={CHART.series1} stopOpacity={0.28} />
                      <stop offset="1" stopColor={CHART.series1} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickFormatter={shortDay} {...axisProps} minTickGap={28} />
                  <YAxis {...axisProps} tickFormatter={(v: number) => formatInt(v)} />
                  <Tooltip
                    cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
                    content={<ChartTooltip format={(v) => `${formatInt(v)} XP · Level ${levelForXp(v)}`} labelFormat={(l) => formatDate(parseDayKey(l))} />}
                  />
                  <Area type="linear" dataKey="xp" name="XP" stroke={CHART.series1} strokeWidth={2} fill="url(#xp-fill)" isAnimationActive={anim} activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={Coins}>Credits: verdient vs. ausgegeben</CardTitle>
          <div className="mb-3 flex items-center justify-between gap-2">
            <Legend items={[{ label: 'Verdient', color: CHART.series1 }, { label: 'Ausgegeben', color: CHART.series2 }]} />
            <span className="tabular text-xs text-faint">
              gesamt {formatSC(earnedCents(data.transactions))} / {formatSC(spentCents(data.transactions))}
            </span>
          </div>
          <div className="h-[190px]">
            {!hasFlow ? (
              <ChartEmpty>Keine Buchungen im Zeitraum.</ChartEmpty>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flow} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                  <YAxis {...axisProps} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<ChartTooltip format={(v) => `${formatDecimal(v)} SC`} />} />
                  <Bar dataKey="earned" name="Verdient" fill={CHART.series1} radius={[4, 4, 0, 0]} isAnimationActive={anim} maxBarSize={18} />
                  <Bar dataKey="spent" name="Ausgegeben" fill={CHART.series2} radius={[4, 4, 0, 0]} isAnimationActive={anim} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <ProjectionCard />
    </div>
  );
}

function ProjectionCard() {
  const data = useData();
  const player = usePlayer();
  const rewards = useMemo(() => shopRewards(data).map((r) => rewardProgress(data, r)).filter((r) => r.status !== 'freigeschaltet'), [data, player.balanceCents]);
  const [selected, setSelected] = useState<string>(data.settings.goalRewardId ?? rewards[0]?.reward.id ?? '');
  const item = rewards.find((r) => r.reward.id === selected) ?? rewards[0];
  const projection = useMemo(() => (item ? projectCompletion(data.sessions, item.missingCents, new Date(), item.reward.wallet) : null), [data.sessions, item]);

  return (
    <Card className="mt-5">
      <CardTitle
        icon={Calculator}
        action={
          rewards.length > 0 && (
            <Select aria-label="Belohnung für Prognose" value={item?.reward.id ?? ''} onChange={(e) => setSelected(e.target.value)} className="h-8 w-auto max-w-[220px] text-xs">
              {rewards.map((r) => (
                <option key={r.reward.id} value={r.reward.id}>
                  {r.reward.name}
                </option>
              ))}
            </Select>
          )
        }
      >
        Belohnungs-Prognose
      </CardTitle>
      {!item ? (
        <p className="text-sm text-muted">Alle Belohnungen sind freigeschaltet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr]">
          <dl className="grid grid-cols-2 gap-3">
            {[
              ['Aktuelles Guthaben', formatSC(player.balanceCents)],
              ['Preis', formatAmount(item.reward.priceCents, item.reward.wallet)],
              ['Fehlende Credits', formatAmount(item.missingCents, item.reward.wallet)],
              ['Benötigte Lernzeit', item.minutesNeeded > 0 ? formatHoursPrecise(item.minutesNeeded) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line-soft bg-[#111418] px-3.5 py-3">
                <dt className="text-[11.5px] text-faint">{label}</dt>
                <dd className="tabular mt-0.5 text-[15px] font-semibold text-fg">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col justify-center rounded-2xl border border-line-soft bg-[#111418] p-5">
            <ProgressBar value={item.ratio} tone="gold" label="Fortschritt" />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {projection?.kind === 'reached' && <>Du kannst <span className="text-fg">{item.reward.name}</span> bereits jetzt freischalten.</>}
              {projection?.kind === 'insufficient' && (
                <>
                  Für eine realistische Prognose fehlen noch Daten: Lerne an mindestens 3 der letzten 14 Tage (aktuell {projection.activeDays}). Bis dahin gilt: noch{' '}
                  <span className="text-fg">{formatHoursPrecise(item.minutesNeeded)}</span> fokussiertes Lernen.
                </>
              )}
              {projection?.kind === 'estimate' && (
                <>
                  Bei deinem Durchschnitt der letzten 14 Tage (<span className="text-fg">{formatMinutes(Math.round(projection.averageDailyMinutes))}</span> pro Tag) erreichst du dein Ziel in etwa{' '}
                  <span className="text-fg">{projection.days} {projection.days === 1 ? 'Tag' : 'Tagen'}</span> – voraussichtlich am{' '}
                  <span className="text-fg">{formatDate(projection.date)}</span>.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
