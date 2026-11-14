"use client";

import { useState } from "react";
import { EARTH_COLOR, ElevationChart, SUN_COLOR } from "./ElevationChart";
import type { ApiErrorBody, EphemerisResponse } from "@/lib/horizons/types";
import { findPreset, KIND_LABEL, SITE_PRESETS } from "@/lib/sites";
import { findWindowsAbove, intersectWindows, summariseWindows, type WindowSummary } from "@/lib/windows";

const DEFAULT_START = "2026-11-14";
/** Provisional definition, pending science review: disc centre above 0° on the reference sphere. */
const THRESHOLD_DEG = 0;
const CUSTOM = "custom";

interface SiteInput {
  presetId: string;
  lon: string;
  lat: string;
  alt: string;
}

interface SiteResult {
  label: string;
  kindLabel: string;
  sun: EphemerisResponse;
  earth: EphemerisResponse;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading"; step: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; sites: [SiteResult, SiteResult] };

function fromPreset(id: string): SiteInput {
  const p = findPreset(id)!;
  return { presetId: id, lon: String(p.lonEastDeg), lat: String(p.latDeg), alt: String(p.altKm) };
}

function addDaysUtc(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

const fmtUtc = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;
const fmtMs = (ms: number) => fmtUtc(new Date(ms).toISOString());

function fmtHours(h: number): string {
  if (h >= 48) return `${(h / 24).toFixed(1)} days (${h.toFixed(0)} h)`;
  return `${h.toFixed(1)} h`;
}

async function getJson(url: string): Promise<EphemerisResponse> {
  const res = await fetch(url);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // handled below
  }
  if (!res.ok) {
    throw new Error((body as ApiErrorBody | null)?.error?.message ?? `The server answered with HTTP ${res.status}.`);
  }
  return body as EphemerisResponse;
}

function siteLabel(s: SiteInput): { label: string; kindLabel: string } {
  const p = s.presetId === CUSTOM ? undefined : findPreset(s.presetId);
  return p
    ? { label: p.name, kindLabel: KIND_LABEL[p.kind] }
    : { label: "Custom coordinates", kindLabel: "user-entered, unverified" };
}

function analyse(site: SiteResult) {
  const startMs = Date.parse(site.sun.points[0].t);
  const endMs = Date.parse(site.sun.points.at(-1)!.t);
  const sunW = findWindowsAbove(site.sun.points, THRESHOLD_DEG);
  const earthW = findWindowsAbove(site.earth.points, THRESHOLD_DEG);
  const range = (pts: { elDeg: number }[]) => {
    const v = pts.map((p) => p.elDeg);
    return { min: Math.min(...v), max: Math.max(...v) };
  };
  return {
    sun: summariseWindows(sunW, startMs, endMs),
    earth: summariseWindows(earthW, startMs, endMs),
    both: summariseWindows(intersectWindows(sunW, earthW), startMs, endMs),
    sunRange: range(site.sun.points),
    earthRange: range(site.earth.points),
  };
}

function nextChangeText(s: WindowSummary, body: string): string {
  if (s.hoursToNextChange === null || s.nextChangeMs === null) {
    return s.aboveAtStart ? `Above 0° for the whole range` : `Below 0° for the whole range`;
  }
  const verb = s.aboveAtStart ? `${body}set` : `${body}rise`;
  return `${verb} in ${fmtHours(s.hoursToNextChange)} — ${fmtMs(s.nextChangeMs)}`;
}

function SitePicker({
  title,
  value,
  onChange,
}: {
  title: string;
  value: SiteInput;
  onChange: (v: SiteInput) => void;
}) {
  const preset = value.presetId === CUSTOM ? undefined : findPreset(value.presetId);
  const field = "mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100";
  const label = "block text-xs font-medium uppercase tracking-wide text-slate-400";
  const edit = (patch: Partial<SiteInput>) => onChange({ ...value, ...patch, presetId: CUSTOM });

  return (
    <fieldset className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-100">{title}</legend>
      <label className={label}>
        Location
        <select
          className={field}
          value={value.presetId}
          onChange={(e) => onChange(e.target.value === CUSTOM ? { ...value, presetId: CUSTOM } : fromPreset(e.target.value))}
        >
          {SITE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={CUSTOM}>Custom coordinates</option>
        </select>
      </label>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <label className={label}>
          East lon (°)
          <input className={field} value={value.lon} onChange={(e) => edit({ lon: e.target.value })} inputMode="decimal" required />
        </label>
        <label className={label}>
          Latitude (°)
          <input className={field} value={value.lat} onChange={(e) => edit({ lat: e.target.value })} inputMode="decimal" required />
        </label>
        <label className={label}>
          Height (km)
          <input className={field} value={value.alt} onChange={(e) => edit({ alt: e.target.value })} inputMode="decimal" required />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {preset ? (
          <>
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{KIND_LABEL[preset.kind]}</span>{" "}
            Coordinates:{" "}
            <a className="text-sky-400 underline" href={preset.sourceUrl} target="_blank" rel="noreferrer">
              {preset.source}
            </a>
            . {preset.note}
          </>
        ) : (
          <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-slate-300">
            User-entered coordinates, not verified against any source.
          </span>
        )}
      </p>
    </fieldset>
  );
}

export function SiteComparison() {
  const [siteA, setSiteA] = useState<SiteInput>(() => fromPreset("apollo11"));
  const [siteB, setSiteB] = useState<SiteInput>(() => fromPreset("apollo17"));
  const [start, setStart] = useState(DEFAULT_START);
  const [days, setDays] = useState("30");
  const [stepMin, setStepMin] = useState("60");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function load(urls: (site: SiteInput, body: "sun" | "earth") => string, sites: [SiteInput, SiteInput]) {
    try {
      const results: SiteResult[] = [];
      // One request at a time, to stay polite to the Horizons service.
      for (const [i, site] of sites.entries()) {
        const name = `Site ${i === 0 ? "A" : "B"}`;
        setStatus({ kind: "loading", step: `${name}: Sun` });
        const sun = await getJson(urls(site, "sun"));
        setStatus({ kind: "loading", step: `${name}: Earth` });
        const earth = await getJson(urls(site, "earth"));
        results.push({ ...siteLabel(site), sun, earth });
      }
      setStatus({ kind: "ready", sites: [results[0], results[1]] });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Unknown error." });
    }
  }

  function queryLive(e: React.FormEvent) {
    e.preventDefault();
    const d = Number(days);
    if (!start || !Number.isInteger(d) || d < 1) {
      setStatus({ kind: "error", message: "Enter a start date and a whole number of days (1 or more)." });
      return;
    }
    const stop = addDaysUtc(start, d);
    void load(
      (s, body) =>
        `/api/ephemeris?${new URLSearchParams({ target: body, lon: s.lon, lat: s.lat, alt: s.alt, start, stop, stepMin })}`,
      [siteA, siteB],
    );
  }

  function loadArchive() {
    const a = fromPreset("apollo11");
    const b = fromPreset("apollo17");
    setSiteA(a);
    setSiteB(b);
    void load((s, body) => `/api/sample?id=${s.presetId}-${body}`, [a, b]);
  }

  const loading = status.kind === "loading";
  const sites = status.kind === "ready" ? status.sites : null;
  const analysis = sites ? sites.map(analyse) : null;

  let yDomain: [number, number] = [-90, 90];
  if (sites) {
    const all = sites.flatMap((s) => [...s.sun.points, ...s.earth.points]).map((p) => p.elDeg);
    yDomain = [Math.floor(Math.min(...all) / 10) * 10, Math.ceil(Math.max(...all) / 10) * 10];
  }
  const anyArchive = sites?.some((s) => s.sun.source === "archive" || s.earth.source === "archive") ?? false;

  const field = "mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100";
  const label = "block text-xs font-medium uppercase tracking-wide text-slate-400";

  const rows: { name: string; color?: string; cell: (a: ReturnType<typeof analyse>) => string }[] = [
    { name: "Sun above 0°", color: SUN_COLOR, cell: (a) => `${fmtHours(a.sun.hoursAbove)} · ${(a.sun.fractionAbove * 100).toFixed(1)}% of range` },
    { name: "Longest continuous Sun window", color: SUN_COLOR, cell: (a) => fmtHours(a.sun.longestHours) },
    { name: "Sun, from range start", color: SUN_COLOR, cell: (a) => nextChangeText(a.sun, "Sun") },
    { name: "Sun elevation range", color: SUN_COLOR, cell: (a) => `${a.sunRange.min.toFixed(2)}° to ${a.sunRange.max.toFixed(2)}°` },
    { name: "Earth above 0°", color: EARTH_COLOR, cell: (a) => `${fmtHours(a.earth.hoursAbove)} · ${(a.earth.fractionAbove * 100).toFixed(1)}% of range` },
    { name: "Earth, from range start", color: EARTH_COLOR, cell: (a) => nextChangeText(a.earth, "Earth") },
    { name: "Earth elevation range", color: EARTH_COLOR, cell: (a) => `${a.earthRange.min.toFixed(2)}° to ${a.earthRange.max.toFixed(2)}°` },
    { name: "Sun and Earth both above 0°", cell: (a) => `${fmtHours(a.both.hoursAbove)} · ${(a.both.fractionAbove * 100).toFixed(1)}% of range` },
  ];

  return (
    <div className="space-y-6">
      <form onSubmit={queryLive} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <SitePicker title="Site A" value={siteA} onChange={setSiteA} />
          <SitePicker title="Site B" value={siteB} onChange={setSiteB} />
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
            <label className={label}>
              Start date (UTC)
              <input className={field} type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label className={label}>
              Days
              <input className={field} type="number" min={1} max={62} value={days} onChange={(e) => setDays(e.target.value)} required />
            </label>
            <label className={label}>
              Step
              <select className={field} value={stepMin} onChange={(e) => setStepMin(e.target.value)}>
                <option value="30">30 min</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="360">6 hours</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              {loading ? `Querying NASA/JPL Horizons — ${status.step}…` : "Compare with NASA/JPL Horizons"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={loadArchive}
              className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Load archived sample (Apollo 11 vs Apollo 17)
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Longitude is east-positive (negative values are west) in the Moon mean-Earth frame. Height is above a
            1737.4 km sphere.
          </p>
        </div>
      </form>

      {status.kind === "error" && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
          <p className="font-semibold">No data shown.</p>
          <p className="mt-1">{status.message}</p>
          <p className="mt-2 text-red-300/80">
            Nothing has been substituted. You can retry, or explicitly load the archived real Horizons sample.
          </p>
        </div>
      )}

      {status.kind === "idle" && (
        <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
          Choose two sites and a date range, then compare Sun and Earth elevation from NASA/JPL Horizons.
        </p>
      )}

      {sites && analysis && (
        <>
          {anyArchive && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-200">
              <span className="font-semibold">Archived data, not a live query.</span> These are real NASA/JPL Horizons
              responses saved on {fmtUtc(sites[0].sun.retrievedAtUtc)}.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {sites.map((s, i) => (
              <section key={i} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-base font-semibold text-slate-100">
                  Site {i === 0 ? "A" : "B"}: {s.label}
                </h2>
                <p className="text-xs text-slate-400">
                  {s.sun.request.lonEastDeg}° E, {s.sun.request.latDeg}°, height {s.sun.request.altKm} km · {s.kindLabel}
                </p>
                <ElevationChart sun={s.sun.points} earth={s.earth.points} yDomain={yDomain} />
              </section>
            ))}
          </div>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-base font-semibold text-slate-100">Geometric comparison</h2>
            <p className="mb-3 text-xs text-slate-400">
              {sites[0].sun.request.startUt} to {sites[0].sun.request.stopUt} UT · {sites[0].sun.points.length} samples
              every {sites[0].sun.request.stepMinutes} min. “Above 0°” means the centre of the disc is above the
              horizontal plane of a smooth sphere — a provisional definition. Terrain is not included. Rise and set
              times are interpolated between samples.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3 font-medium">Metric</th>
                    <th className="py-2 pr-3 font-medium">A: {sites[0].label}</th>
                    <th className="py-2 font-medium">B: {sites[1].label}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} className="border-b border-slate-800/70 align-top">
                      <th scope="row" className="py-2 pr-3 font-normal text-slate-300">
                        {r.color && (
                          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
                        )}
                        {r.name}
                      </th>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-100">{r.cell(analysis[0])}</td>
                      <td className="py-2 font-mono text-xs text-slate-100">{r.cell(analysis[1])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm">
            <h2 className="text-base font-semibold text-slate-100">Data provenance</h2>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {[
                ["Source", `${sites[0].sun.signature.source ?? "unknown"} (API version ${sites[0].sun.signature.version ?? "unknown"})`],
                ["Ephemeris", `Sun ${sites[0].sun.meta.targetEphemeris ?? "unknown"}, Earth ${sites[0].earth.meta.targetEphemeris ?? "unknown"}, Moon ${sites[0].sun.meta.centerEphemeris ?? "unknown"}`],
                ["Site frame", `${sites[0].sun.meta.centerFrame ?? "unknown"}, ${sites[0].sun.meta.centerFrameNote ?? ""}`],
                ["Reference radii", `${sites[0].sun.meta.centerRadiiKm ?? "unknown"} km`],
                ["Refraction", sites[0].sun.meta.refraction ?? "unknown"],
                ["Earth orientation file", sites[0].sun.meta.eopFile ?? "unknown"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-40 shrink-0 text-slate-400">{k}</dt>
                  <dd className="text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">Exact requests</h3>
            <ul className="mt-1 space-y-1 text-xs">
              {sites.flatMap((s, i) =>
                ([["Sun", s.sun], ["Earth", s.earth]] as const).map(([body, r]) => (
                  <li key={`${i}-${body}`} className="text-slate-300">
                    Site {i === 0 ? "A" : "B"} · {body} · {r.source} · retrieved {fmtUtc(r.retrievedAtUtc)} ·{" "}
                    <a className="text-sky-400 underline" href={r.horizonsUrl} target="_blank" rel="noreferrer">
                      open Horizons request
                    </a>
                  </li>
                )),
              )}
            </ul>
          </section>
        </>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        <h2 className="text-base font-semibold text-slate-100">What this does and does not show</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Elevation is the angle of the centre of the Sun or Earth above the local horizontal plane of a smooth
            reference sphere, computed by NASA/JPL Horizons. It is <strong>geometric</strong>.
          </li>
          <li>
            <strong>Terrain is not included.</strong> Mountains and crater rims can block the Sun or Earth when the
            value is positive, especially near the lunar poles.
          </li>
          <li>
            It is not a measure of solar power or thermal conditions, and a positive Earth elevation does not guarantee
            a working communication link.
          </li>
          <li>All times are UTC. The Moon has no atmosphere, so no refraction is applied.</li>
        </ul>
      </section>
    </div>
  );
}
