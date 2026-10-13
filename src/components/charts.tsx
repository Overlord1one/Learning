import type { ReactNode } from 'react';

/** Shared dark chart styling for Recharts. */
export const CHART = {
  series1: '#3987e5',
  series2: '#d95926',
  grid: '#20252c',
  axis: '#636b78',
  surface: '#15181D',
};

export const axisProps = {
  stroke: CHART.axis,
  tickLine: false,
  axisLine: false,
  fontSize: 11,
} as const;

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  format,
  labelFormat,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  format: (v: number, key: string) => string;
  labelFormat?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-elevated/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-medium text-fg">{labelFormat ? labelFormat(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="tabular flex items-center gap-2 text-muted">
          {payload.length > 1 && <span className="size-2 rounded-sm" style={{ background: p.color }} />}
          {payload.length > 1 && <span>{p.name}</span>}
          <span className="font-medium text-fg">{format(Number(p.value), String(p.dataKey))}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-[200px] items-center justify-center text-center text-sm text-faint">{children}</div>;
}
