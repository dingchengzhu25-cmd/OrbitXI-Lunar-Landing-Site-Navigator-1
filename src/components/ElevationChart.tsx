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

export const SUN_COLOR = "#fbbf24";
export const EARTH_COLOR = "#38bdf8";

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
  sun: EphemerisPoint[];
  earth: EphemerisPoint[];
  /** Shared y-axis range so two site charts can be compared by eye. */
  yDomain: [number, number];
}

/** Sun and Earth elevation over time for one site. Both series share the same time grid. */
export function ElevationChart({ sun, earth, yDomain }: Props) {
  const earthByTime = new Map(earth.map((p) => [p.t, p.elDeg]));
  const data = sun.map((p) => ({ ms: Date.parse(p.t), sun: p.elDeg, earth: earthByTime.get(p.t) ?? null }));

  return (
    <div className="h-72 w-full" data-testid="elevation-chart">
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
            domain={yDomain}
            allowDataOverflow={false}
            tickFormatter={(v: number) => `${v}°`}
            width={48}
            label={{
              value: "Elevation (deg)",
              angle: -90,
              position: "insideLeft",
              offset: 12,
              fill: "#94a3b8",
              fontSize: 11,
              style: { textAnchor: "middle" },
            }}
          />
          <ReferenceLine
            y={0}
            stroke="#f87171"
            strokeDasharray="6 4"
            label={{ value: "0° geometric horizon", position: "insideBottomRight", fill: "#f87171", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: "#e2e8f0" }}
            labelFormatter={(ms) => `${fullFmt.format(Number(ms))} UTC`}
            formatter={(value, name) => [`${Number(value).toFixed(3)}°`, name]}
          />
          <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 12 }} />
          <Line name="Sun elevation" type="monotone" dataKey="sun" stroke={SUN_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line name="Earth elevation" type="monotone" dataKey="earth" stroke={EARTH_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
