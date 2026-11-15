"use client";

import { useState } from "react";
import type { EphemerisPoint } from "@/lib/horizons/types";
import { SITE_A_COLOR, SITE_B_COLOR } from "./ElevationChart";

interface SiteSky {
  label: string;
  sun: EphemerisPoint[] | null;
  earth: EphemerisPoint[] | null;
}

const W = 720;
const H = 300;
const L = 46;
const R = 712;
const T = 14;
const B = 262;
const fmt = (ms: number) => `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;

/** Sample of a series at the cursor: exact match on the shared grid, else the nearest earlier sample. */
function sampleAt(points: EphemerisPoint[] | null, ms: number): EphemerisPoint | null {
  if (!points || points.length === 0) return null;
  let lo = 0;
  let hi = points.length - 1;
  if (Date.parse(points[0].t) > ms) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (Date.parse(points[mid].t) <= ms) lo = mid;
    else hi = mid - 1;
  }
  return points[lo];
}

/**
 * Where the Sun and Earth are in this site's sky at the cursor time: real Horizons azimuth and
 * elevation, drawn against the 0° geometric horizon of a smooth sphere. Nothing here models
 * terrain; that is stated on the figure.
 */
export function SkyView({ a, b, cursorMs }: { a: SiteSky; b: SiteSky; cursorMs: number | null }) {
  const [which, setWhich] = useState<"A" | "B">("A");
  const site = which === "A" ? a : b;
  const all = [...(site.sun ?? []), ...(site.earth ?? [])].map((p) => p.elDeg);
  if (all.length === 0 || cursorMs == null) {
    return <p className="border border-dashed border-rule p-6 text-center text-sm text-ink-2">No position data for Site {which}.</p>;
  }
  let lo = Math.min(0, ...all) - 1;
  let hi = Math.max(0, ...all) + 1;
  if (hi - lo < 10) {
    const mid = (hi + lo) / 2;
    lo = mid - 5;
    hi = mid + 5;
  }
  const stepDeg = hi - lo > 60 ? 30 : hi - lo > 24 ? 10 : hi - lo > 12 ? 4 : 2;
  lo = Math.floor(lo / stepDeg) * stepDeg;
  hi = Math.ceil(hi / stepDeg) * stepDeg;
  const x = (az: number) => L + (((az % 360) + 360) % 360) / 360 * (R - L);
  const y = (el: number) => B - ((el - lo) / (hi - lo)) * (B - T);
  const yTicks: number[] = [];
  for (let v = lo; v <= hi; v += stepDeg) yTicks.push(v);

  const sun = sampleAt(site.sun, cursorMs);
  const earth = sampleAt(site.earth, cursorMs);
  // Sun path over the 72 h before the cursor, broken where azimuth wraps through north.
  const trail: string[] = [];
  if (site.sun) {
    let d = "";
    let prev: number | null = null;
    for (const p of site.sun) {
      const ms = Date.parse(p.t);
      if (ms > cursorMs || ms < cursorMs - 72 * 3_600_000) continue;
      const px = x(p.azDeg);
      d += `${prev === null || Math.abs(px - prev) > (R - L) / 2 ? "M" : "L"}${px.toFixed(1)},${y(p.elDeg).toFixed(1)} `;
      prev = px;
    }
    if (d) trail.push(d);
  }
  const marker = (p: EphemerisPoint, body: "Sun" | "Earth") => {
    const cx = x(p.azDeg);
    const cy = y(p.elDeg);
    const label = `${body} ${p.elDeg.toFixed(1)}° elevation, ${p.azDeg.toFixed(0)}° azimuth`;
    const right = cx < R - 210;
    return (
      <g key={body}>
        {body === "Sun" && <circle cx={cx} cy={cy} r={22} fill="url(#sunGlow)" />}
        <image href={body === "Sun" ? "/vision/sun_sdo.png" : "/vision/earth_epic.png"} x={cx - 10} y={cy - 10} width={20} height={20} />
        {body === "Earth" && <circle cx={cx} cy={cy} r={11.5} fill="none" stroke="#8fd0ff" strokeWidth={1.2} />}
        <text x={right ? cx + 16 : cx - 16} y={cy - 12} textAnchor={right ? "start" : "end"} className="fill-ink font-mono text-[11px]" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 3 }}>
          {label}
        </text>
      </g>
    );
  };

  return (
    <div data-testid="sky-view">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-2">
          At <span className="font-mono text-ink">{fmt(cursorMs)}</span>, seen from{" "}
          <span style={{ color: which === "A" ? SITE_A_COLOR : SITE_B_COLOR }}>{site.label}</span>
        </p>
        <div role="group" aria-label="Site shown in the sky view" className="flex border border-rule-strong text-xs">
          {(["A", "B"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={which === s}
              onClick={() => setWhich(s)}
              className="min-w-11 px-3 py-1.5 font-semibold text-ink-2 aria-pressed:bg-ink aria-pressed:text-space"
            >
              Site {s}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Sky view for Site ${which}: ${[sun && `Sun at ${sun.elDeg.toFixed(1)} degrees elevation`, earth && `Earth at ${earth.elDeg.toFixed(1)} degrees elevation`].filter(Boolean).join("; ")}, relative to the 0 degree geometric horizon.`}>
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#02040a" />
            <stop offset="1" stopColor="#0d1424" />
          </linearGradient>
          <radialGradient id="sunGlow">
            <stop offset="0" stopColor="#ffcf73" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffcf73" stopOpacity="0" />
          </radialGradient>
          <clipPath id="plotClip">
            <rect x={L} y={T} width={R - L} height={B - T} />
          </clipPath>
        </defs>
        <rect x={L} y={T} width={R - L} height={B - T} fill="url(#skyGrad)" />
        {/* Decorative star field from the NASA SVS Deep Star Maps 2020 (not positioned by the data). */}
        <image href="/vision/milky-way-core.jpg" x={L} y={T} width={R - L} height={B - T} preserveAspectRatio="xMidYMid slice" opacity={0.45} clipPath="url(#plotClip)" />
        <rect x={L} y={y(0)} width={R - L} height={Math.max(0, B - y(0))} fill="#000" opacity={0.62} />
        {[0, 90, 180, 270, 360].map((az) => (
          <line key={az} x1={x(az === 360 ? 359.999 : az)} x2={x(az === 360 ? 359.999 : az)} y1={T} y2={B} stroke="#ffffff" strokeOpacity={0.06} />
        ))}
        <line x1={L} x2={R} y1={y(0)} y2={y(0)} stroke="#c4ccd8" strokeDasharray="4 4" />
        <text x={L + 8} y={y(0) - 6} className="fill-[#c4ccd8] text-[11px]">0° horizon (geometric, no terrain)</text>
        <text x={L + 8} y={Math.min(B - 8, y(0) + 16)} className="fill-ink-3 text-[11px]">below the horizon</text>
        <g clipPath="url(#plotClip)">
          {trail.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#ffcf73" strokeOpacity={0.55} strokeWidth={1.4} strokeDasharray="2 3" />
          ))}
          {earth && marker(earth, "Earth")}
          {sun && marker(sun, "Sun")}
        </g>
        {yTicks.map((v) => (
          <text key={v} x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[11px]">
            {v}°
          </text>
        ))}
        {[
          [0, "N 0°"],
          [90, "E 90°"],
          [180, "S 180°"],
          [270, "W 270°"],
          [360, "N 360°"],
        ].map(([az, t]) => (
          <text key={t} x={x(Number(az) === 360 ? 359.999 : Number(az))} y={B + 18} textAnchor={az === 0 ? "start" : az === 360 ? "end" : "middle"} className="fill-ink-3 font-mono text-[11px]">
            {t}
          </text>
        ))}
        <text x={(L + R) / 2} y={H - 4} textAnchor="middle" className="fill-ink-3 text-[11px]">
          Azimuth, degrees clockwise from north
        </text>
      </svg>
      <p className="mt-1 text-xs text-ink-3">
        Positions are the NASA/JPL Horizons sample at the cursor (disc centres; markers not to scale). The dotted line
        is the Sun&apos;s path over the previous 72 hours. The star field is decorative. A terrain skyline is not modelled;
        mountains and crater rims can hide a body that is above 0° here.
      </p>
    </div>
  );
}
