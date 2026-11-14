"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EphemerisPoint } from "@/lib/horizons/types";

export const SITE_A_COLOR = "#38bdf8";
export const SITE_B_COLOR = "#fb923c";

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" });
const fullFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface Props {
  /** "Sun" or "Earth" — used in the tooltip. */
  body: string;
  siteA: { label: string; points: EphemerisPoint[] | null };
  siteB: { label: string; points: EphemerisPoint[] | null };
  thresholdDeg: number;
}

/**
 * Elevation of one body at Site A and Site B on a shared UTC time axis.
 * A site whose series failed to load is simply absent; nothing is drawn in its place.
 */
export function ElevationChart({ body, siteA, siteB, thresholdDeg }: Props) {
  const rows = new Map<number, { ms: number; a?: number; b?: number }>();
  for (const p of siteA.points ?? []) {
    const ms = Date.parse(p.t);
    rows.set(ms, { ...(rows.get(ms) ?? { ms }), a: p.elDeg });
  }
  for (const p of siteB.points ?? []) {
    const ms = Date.parse(p.t);
    rows.set(ms, { ...(rows.get(ms) ?? { ms }), b: p.elDeg });
  }
  const data = [...rows.values()].sort((x, y) => x.ms - y.ms);

  if (data.length === 0) {
    return (
      <p className="rounded border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
        No {body} elevation data is available for either site.
      </p>
    );
  }

  return (
    <div className="h-72 w-full" data-testid={`chart-${body.toLowerCase()}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 22, left: 4 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="ms"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(ms: number) => dayFmt.format(ms)}
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            minTickGap={36}
            label={{ value: "Time (UTC)", position: "insideBottom", offset: -12, fill: "#94a3b8", fontSize: 11 }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            domain={[
              (min: number) => Math.floor(Math.min(min, thresholdDeg - 5) / 10) * 10,
              (max: number) => Math.ceil(Math.max(max, thresholdDeg + 5) / 10) * 10,
            ]}
            tickFormatter={(v: number) => `${v}°`}
            width={48}
            label={{
              value: `${body} elevation (degrees)`,
              angle: -90,
              position: "insideLeft",
              offset: 12,
              fill: "#94a3b8",
              fontSize: 11,
              style: { textAnchor: "middle" },
            }}
          />
          <ReferenceLine
            y={thresholdDeg}
            stroke="#f87171"
            strokeDasharray="6 4"
            label={{
              value: `${thresholdDeg}° horizon (geometric, no terrain)`,
              position: "insideBottomRight",
              fill: "#f87171",
              fontSize: 10,
            }}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: "#e2e8f0" }}
            labelFormatter={(ms) => `${fullFmt.format(Number(ms))} UTC`}
            formatter={(value, name) => [`${Number(value).toFixed(3)}° ${body} elevation`, name]}
          />
          <Legend verticalAlign="top" height={26} wrapperStyle={{ fontSize: 12 }} />
          {siteA.points && (
            <Line name={`A: ${siteA.label}`} type="monotone" dataKey="a" stroke={SITE_A_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          )}
          {siteB.points && (
            <Line name={`B: ${siteB.label}`} type="monotone" dataKey="b" stroke={SITE_B_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
