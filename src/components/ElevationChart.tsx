"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EphemerisPoint } from "@/lib/horizons/types";

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

export function ElevationChart({ points, bodyLabel }: { points: EphemerisPoint[]; bodyLabel: string }) {
  const data = points.map((p) => ({ ms: Date.parse(p.t), el: p.elDeg }));

  return (
    <div className="h-80 w-full" data-testid="elevation-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="ms"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(ms: number) => dayFmt.format(ms)}
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            minTickGap={40}
            label={{ value: "Time (UTC)", position: "insideBottom", offset: -14, fill: "#94a3b8", fontSize: 12 }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => `${v}°`}
            label={{
              value: `${bodyLabel} elevation (deg)`,
              angle: -90,
              position: "insideLeft",
              offset: 8,
              fill: "#94a3b8",
              fontSize: 12,
              style: { textAnchor: "middle" },
            }}
          />
          <ReferenceLine
            y={0}
            stroke="#f59e0b"
            strokeDasharray="6 4"
            label={{ value: "0° geometric horizon (no terrain)", position: "insideTopRight", fill: "#f59e0b", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: "#e2e8f0" }}
            labelFormatter={(ms) => `${fullFmt.format(Number(ms))} UTC`}
            formatter={(value) => [`${Number(value).toFixed(3)}°`, `${bodyLabel} elevation`]}
          />
          <Line type="monotone" dataKey="el" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
