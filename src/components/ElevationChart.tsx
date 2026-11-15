"use client";

import { useState } from "react";
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
import { domainTicks, fitElevationDomain, NEAR_HORIZON_HALF_RANGE_DEG, nearHorizonDomain } from "@/lib/chartDomain";
import type { EphemerisPoint } from "@/lib/horizons/types";

export const SITE_A_COLOR = "#38bdf8";
export const SITE_B_COLOR = "#fb923c";
/** Site B is drawn dashed so the two sites can be told apart without relying on colour. */
export const SITE_B_DASH = "7 5";

/** Small line sample (solid for A, dashed for B) shown next to site names. */
export function LineSample({ site }: { site: "A" | "B" }) {
  return (
    <svg width="28" height="8" aria-hidden="true" className="mr-1.5 inline-block align-middle">
      <line
        x1="1"
        y1="4"
        x2="27"
        y2="4"
        stroke={site === "A" ? SITE_A_COLOR : SITE_B_COLOR}
        strokeWidth="2.5"
        strokeDasharray={site === "A" ? undefined : SITE_B_DASH}
      />
    </svg>
  );
}

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
  const [nearHorizon, setNearHorizon] = useState(false);
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

  const elevations = data.flatMap((r) => [r.a, r.b]).filter((v): v is number => v !== undefined);
  const domain = nearHorizon ? nearHorizonDomain(thresholdDeg) : fitElevationDomain(elevations, thresholdDeg);
  const clipped = nearHorizon && elevations.some((v) => v < domain[0] || v > domain[1]);

  return (
    <div data-testid={`chart-${body.toLowerCase()}`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          Vertical axis: {domain[0]}° to {domain[1]}°{nearHorizon ? " (near-horizon view)" : " (fitted to the data)"}
        </span>
        <button
          type="button"
          aria-pressed={nearHorizon}
          onClick={() => setNearHorizon((v) => !v)}
          className="rounded border border-slate-600 px-2 py-0.5 text-slate-200 hover:bg-slate-800"
        >
          {nearHorizon ? "Show full range" : `Zoom to ±${NEAR_HORIZON_HALF_RANGE_DEG}° around the horizon`}
        </button>
      </div>
      {/* Legend as ordinary text above the plot, so long site names wrap instead of covering the chart. */}
      <ul className="mb-1 space-y-0.5 text-xs" data-testid={`legend-${body.toLowerCase()}`}>
        {siteA.points && (
          <li style={{ color: SITE_A_COLOR }}>
            <LineSample site="A" />A (solid): {siteA.label}
          </li>
        )}
        {siteB.points && (
          <li style={{ color: SITE_B_COLOR }}>
            <LineSample site="B" />B (dashed): {siteB.label}
          </li>
        )}
      </ul>
      <div className="h-72 w-full">
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
            type="number"
            domain={domain}
            ticks={domainTicks(domain)}
            allowDataOverflow={nearHorizon}
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
            strokeDasharray="2 3"
            label={{
              value: `${thresholdDeg}° horizon, dotted (geometric, no terrain)`,
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
          {siteA.points && (
            <Line name={`A (solid): ${siteA.label}`} legendType="plainline" type="monotone" dataKey="a" stroke={SITE_A_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          )}
          {siteB.points && (
            <Line name={`B (dashed): ${siteB.label}`} legendType="plainline" strokeDasharray={SITE_B_DASH} type="monotone" dataKey="b" stroke={SITE_B_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
      </div>
      {clipped && (
        <p className="mt-1 text-xs text-amber-300">
          Near-horizon view: parts of a line above {domain[1]}° or below {domain[0]}° are outside the chart. The data is
          unchanged.
        </p>
      )}
    </div>
  );
}
