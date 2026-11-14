"use client";

import { useState } from "react";
import { ElevationChart } from "./ElevationChart";
import type { ApiErrorBody, EphemerisResponse } from "@/lib/horizons/types";
import { SITE_PRESETS } from "@/lib/sites";

const preset = SITE_PRESETS[0];
const DEFAULT_START = "2026-11-14";

function addDaysUtc(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function fmtUtc(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: EphemerisResponse };

async function readJson(res: Response): Promise<EphemerisResponse> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // fall through to the generic message below
  }
  if (!res.ok) {
    const message = (body as ApiErrorBody | null)?.error?.message;
    throw new Error(message ?? `The server answered with HTTP ${res.status}.`);
  }
  return body as EphemerisResponse;
}

export function SunElevationExplorer() {
  const [lon, setLon] = useState(String(preset.lonEastDeg));
  const [lat, setLat] = useState(String(preset.latDeg));
  const [alt, setAlt] = useState(String(preset.altKm));
  const [start, setStart] = useState(DEFAULT_START);
  const [days, setDays] = useState("30");
  const [stepMin, setStepMin] = useState("60");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isPreset =
    Number(lon) === preset.lonEastDeg && Number(lat) === preset.latDeg && Number(alt) === preset.altKm;

  async function run(url: string) {
    setStatus({ kind: "loading" });
    try {
      const res = await fetch(url);
      setStatus({ kind: "ready", data: await readJson(res) });
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
    const qs = new URLSearchParams({
      target: "sun",
      lon,
      lat,
      alt,
      start,
      stop: addDaysUtc(start, d),
      stepMin,
    });
    void run(`/api/ephemeris?${qs}`);
  }

  const data = status.kind === "ready" ? status.data : null;
  const stats = data
    ? (() => {
        const els = data.points.map((p) => p.elDeg);
        return {
          min: Math.min(...els),
          max: Math.max(...els),
          above: els.filter((v) => v > 0).length,
          total: els.length,
        };
      })()
    : null;

  const field = "mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100";
  const label = "block text-xs font-medium uppercase tracking-wide text-slate-400";

  return (
    <div className="space-y-6">
      <form onSubmit={queryLive} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 text-sm">
          <span className="font-semibold text-slate-100">Site: </span>
          {isPreset ? (
            <>
              <span className="text-slate-200">{preset.name}</span>
              <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                technical verification site — not a landing candidate
              </span>
            </>
          ) : (
            <span className="text-slate-200">Custom coordinates (user-entered, unverified)</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label className={label}>
            East longitude (°)
            <input className={field} value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" required />
          </label>
          <label className={label}>
            Latitude (°)
            <input className={field} value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" required />
          </label>
          <label className={label}>
            Height (km)
            <input className={field} value={alt} onChange={(e) => setAlt(e.target.value)} inputMode="decimal" required />
          </label>
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
            disabled={status.kind === "loading"}
            className="rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            {status.kind === "loading" ? "Querying NASA/JPL Horizons…" : "Query NASA/JPL Horizons"}
          </button>
          <button
            type="button"
            disabled={status.kind === "loading"}
            onClick={() => void run("/api/sample?id=tycho-sun")}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Load archived Horizons sample
          </button>
          <span className="text-xs text-slate-500">
            Longitude is east-positive in the Moon mean-Earth (ME) frame; height is above a 1737.4 km sphere.
          </span>
        </div>
      </form>

      {status.kind === "error" && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
          <p className="font-semibold">No data shown.</p>
          <p className="mt-1">{status.message}</p>
          <p className="mt-2 text-red-300/80">
            Nothing has been substituted. You can retry, or explicitly load the archived real Horizons sample above.
          </p>
        </div>
      )}

      {status.kind === "idle" && (
        <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
          Run a query to chart Sun elevation from NASA/JPL Horizons.
        </p>
      )}

      {data && stats && (
        <>
          {data.source === "archive" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-200">
              <span className="font-semibold">Archived data, not a live query.</span> This is a real NASA/JPL Horizons
              response saved on {fmtUtc(data.retrievedAtUtc)}. {data.archiveNote}
            </div>
          )}

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-base font-semibold text-slate-100">
              Sun elevation at {data.request.lonEastDeg}° E, {data.request.latDeg}° ({data.request.altKm} km)
            </h2>
            <p className="mb-2 text-xs text-slate-400">
              {data.request.startUt} to {data.request.stopUt} UT · {data.points.length} samples every{" "}
              {data.request.stepMinutes} min · airless apparent elevation of the Sun&apos;s centre
            </p>
            <ElevationChart points={data.points} bodyLabel="Sun" />
            <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded bg-slate-950/60 p-3">
                <dt className="text-xs text-slate-400">Lowest elevation in range</dt>
                <dd className="font-mono text-slate-100">{stats.min.toFixed(3)}°</dd>
              </div>
              <div className="rounded bg-slate-950/60 p-3">
                <dt className="text-xs text-slate-400">Highest elevation in range</dt>
                <dd className="font-mono text-slate-100">{stats.max.toFixed(3)}°</dd>
              </div>
              <div className="rounded bg-slate-950/60 p-3">
                <dt className="text-xs text-slate-400">Samples with Sun centre above 0° (geometric)</dt>
                <dd className="font-mono text-slate-100">
                  {stats.above} of {stats.total}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm">
            <h2 className="text-base font-semibold text-slate-100">Data provenance</h2>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {[
                ["Source", `${data.signature.source ?? "unknown"} (API version ${data.signature.version ?? "unknown"})`],
                ["Retrieved", `${fmtUtc(data.retrievedAtUtc)} (${data.source})`],
                ["Target", `${data.meta.targetBody ?? "unknown"} — ephemeris ${data.meta.targetEphemeris ?? "unknown"}`],
                ["Observer", `${data.meta.centerBody ?? "unknown"} — ephemeris ${data.meta.centerEphemeris ?? "unknown"}`],
                ["Site frame", `${data.meta.centerFrame ?? "unknown"}, ${data.meta.centerFrameNote ?? ""}`],
                ["Reference radii", `${data.meta.centerRadiiKm ?? "unknown"} km`],
                ["Refraction", data.meta.refraction ?? "unknown"],
                ["Earth orientation file", data.meta.eopFile ?? "unknown"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-40 shrink-0 text-slate-400">{k}</dt>
                  <dd className="text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 break-all text-xs text-slate-400">
              Exact request:{" "}
              <a className="text-sky-400 underline" href={data.horizonsUrl} target="_blank" rel="noreferrer">
                {data.horizonsUrl}
              </a>
            </p>
          </section>
        </>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        <h2 className="text-base font-semibold text-slate-100">What this does and does not show</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Elevation is the angle of the Sun&apos;s centre above the local horizontal plane of a smooth reference
            sphere, computed by NASA/JPL Horizons. It is <strong>geometric</strong>.
          </li>
          <li>
            <strong>Terrain is not included.</strong> Mountains and crater rims can block the Sun when this value is
            positive, especially near the lunar poles.
          </li>
          <li>It is not a measure of solar power, thermal conditions, or communication availability.</li>
          <li>All times are UTC. The Moon has no atmosphere, so no refraction is applied.</li>
        </ul>
      </section>
    </div>
  );
}
