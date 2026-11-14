"use client";

import { useState } from "react";
import { ElevationChart, LineSample, SITE_A_COLOR, SITE_B_COLOR } from "./ElevationChart";
import {
  expectedSiteFrom,
  loadComparison,
  pointsOf,
  summariseLoad,
  type SeriesFetcher,
  type SeriesState,
  type SiteLoad,
} from "@/lib/comparison";
import type { ApiErrorBody, DataSourceKind, EphemerisResponse } from "@/lib/horizons/types";
import { LIMITS } from "@/lib/horizons/request";
import { planRequest } from "@/lib/requestPlan";
import { defaultSiteIds, findPreset, hasRegionalReferences, hasSouthPoleCandidates, KIND_LABEL, presetsByGroup } from "@/lib/sites";
import { compareSites, PROVISIONAL_CONFIG, type Visibility, type WindowEdge } from "@/lib/visibility";

const DEFAULT_START = "2026-11-14";
const CUSTOM = "custom";
const CONFIG = PROVISIONAL_CONFIG;

interface SiteInput {
  presetId: string;
  lon: string;
  lat: string;
  alt: string;
}

interface LoadedSite {
  label: string;
  kindLabel: string;
  input: SiteInput;
  load: SiteLoad;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "done"; sites: [LoadedSite, LoadedSite] };

const SOURCE_LABEL: Record<DataSourceKind, string> = { live: "LIVE", cached: "CACHED", archive: "ARCHIVED" };
const SOURCE_STYLE: Record<DataSourceKind, string> = {
  live: "bg-emerald-500/15 text-emerald-300",
  cached: "bg-sky-500/15 text-sky-300",
  archive: "bg-amber-500/15 text-amber-300",
};

function fromPreset(id: string): SiteInput {
  const p = findPreset(id)!;
  return { presetId: id, lon: String(p.lonEastDeg), lat: String(p.latDeg), alt: String(p.altKm) };
}

function describe(s: SiteInput): { label: string; kindLabel: string } {
  const p = s.presetId === CUSTOM ? undefined : findPreset(s.presetId);
  return p
    ? { label: p.name, kindLabel: KIND_LABEL[p.kind] }
    : { label: "Custom test location", kindLabel: "UNVERIFIED / EXPERIMENTAL — user-entered coordinates" };
}

function addDaysUtc(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

const fmtIso = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;
const fmtMs = (ms: number) => fmtIso(new Date(ms).toISOString());
const fmtHours = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)} days` : `${h.toFixed(1)} h`);

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

/* ---------- small presentational pieces ---------- */

const card = "rounded-lg border border-slate-800 bg-slate-900/60 p-4";
const field = "mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100";
const labelCls = "block text-xs font-medium uppercase tracking-wide text-slate-400";

function SitePicker({ site, value, onChange }: { site: "A" | "B"; value: SiteInput; onChange: (v: SiteInput) => void }) {
  const preset = value.presetId === CUSTOM ? undefined : findPreset(value.presetId);
  const edit = (patch: Partial<SiteInput>) => onChange({ ...value, ...patch, presetId: CUSTOM });
  return (
    <fieldset className={card}>
      <legend className="px-1 text-sm font-semibold text-slate-100">
        <LineSample site={site} />
        Site {site} <span className="font-normal text-slate-400">— {site === "A" ? "solid" : "dashed"} line on the charts</span>
      </legend>
      <label className={labelCls}>
        Location
        <select
          className={field}
          value={value.presetId}
          onChange={(e) => onChange(e.target.value === CUSTOM ? { ...value, presetId: CUSTOM } : fromPreset(e.target.value))}
        >
          {presetsByGroup().map((g) => (
            <optgroup key={g.kind} label={g.title}>
              {g.presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
          <optgroup label="Custom — Unverified / Experimental">
            <option value={CUSTOM}>Custom test location (enter coordinates)</option>
          </optgroup>
        </select>
      </label>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <label className={labelCls}>
          East longitude (°)
          <input className={field} value={value.lon} onChange={(e) => edit({ lon: e.target.value })} inputMode="decimal" required />
        </label>
        <label className={labelCls}>
          Latitude (°)
          <input className={field} value={value.lat} onChange={(e) => edit({ lat: e.target.value })} inputMode="decimal" required />
        </label>
        <label className={labelCls}>
          Height (km)
          <input className={field} value={value.alt} onChange={(e) => edit({ alt: e.target.value })} inputMode="decimal" required />
        </label>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        {preset ? (
          <>
            <span
              className={`rounded px-1.5 py-0.5 ${preset.kind === "south-pole-candidate" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 font-semibold text-amber-300"}`}
            >
              {KIND_LABEL[preset.kind]}
            </span>{" "}
            Coordinate source:{" "}
            <a className="text-sky-400 underline" href={preset.sourceUrl} target="_blank" rel="noreferrer">
              {preset.source}
            </a>
            . {preset.note}
          </>
        ) : (
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-semibold text-red-300">
            UNVERIFIED / EXPERIMENTAL — user-entered coordinates, not checked against any source and not a landing
            candidate.
          </span>
        )}
      </p>
    </fieldset>
  );
}

function SourceBadge({ state }: { state: SeriesState }) {
  if (state.status === "error") {
    return <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-xs font-semibold text-red-300">FAILED</span>;
  }
  const s = state.data.source;
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${SOURCE_STYLE[s]}`}>{SOURCE_LABEL[s]}</span>;
}

function edgeText(edge: WindowEdge, which: "start" | "end"): string {
  if (edge.type === "range-limit") return which === "start" ? "already visible at range start" : "still visible at range end";
  if (edge.type === "gap") return "bounded by missing samples";
  return `≈ ${fmtMs(edge.estimateMs)} (between ${fmtMs(edge.beforeMs).slice(11, 16)} and ${fmtMs(edge.afterMs).slice(11, 21)})`;
}

function visibilityCell(v: Visibility): React.ReactNode {
  if (!v.ok) return <span className="text-red-300">Not available — {v.message}</span>;
  const first = v.firstTransition;
  return (
    <div className="space-y-0.5">
      <div>
        {v.visibleSamples} of {v.sampleCount} samples ({(v.fractionOfSamples * 100).toFixed(1)}%)
      </div>
      <div>≈ {fmtHours(v.estimatedVisibleHours)} estimated</div>
      <div className="text-slate-400">
        {v.windows.length} window{v.windows.length === 1 ? "" : "s"}
        {v.windows.length > 0 && `, longest ≈ ${fmtHours(v.longestEstimatedHours)}`}
      </div>
      <div className="text-slate-400">
        {first
          ? `First ${first.kind} ≈ ${fmtMs(first.estimateMs)}`
          : v.visibleAtFirstSample
            ? "Visible at every sample"
            : v.visibleSamples === 0
              ? "Not visible at any sample"
              : "No transition between adjacent samples"}
      </div>
      {v.nearThresholdSamples > 0 && (
        <div className="text-amber-300">
          {v.nearThresholdSamples} sample{v.nearThresholdSamples === 1 ? "" : "s"} within ±{CONFIG.nearThresholdBandDeg}° of the
          threshold
        </div>
      )}
      {v.gapCount > 0 && <div className="text-amber-300">{v.gapCount} gap(s) in the samples — not bridged</div>}
    </div>
  );
}

function WindowList({ title, v }: { title: string; v: Visibility }) {
  if (!v.ok || v.windows.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-sky-400">
        {title}: {v.windows.length} sampled window{v.windows.length === 1 ? "" : "s"}
      </summary>
      <ol className="mt-1 space-y-1 text-xs text-slate-300">
        {v.windows.slice(0, 12).map((w, i) => (
          <li key={i} className="rounded bg-slate-950/50 p-2">
            <div>Start: {edgeText(w.start, "start")}</div>
            <div>End: {edgeText(w.end, "end")}</div>
            <div className="text-slate-400">
              {w.visibleSamples} visible sample{w.visibleSamples === 1 ? "" : "s"}, first {fmtMs(w.firstVisibleMs)}, last{" "}
              {fmtMs(w.lastVisibleMs)} · ≈ {fmtHours(w.estimatedHours)}
            </div>
          </li>
        ))}
        {v.windows.length > 12 && <li className="text-slate-500">…and {v.windows.length - 12} more.</li>}
      </ol>
    </details>
  );
}

/* ---------- main component ---------- */

export function SiteComparison() {
  const [siteA, setSiteA] = useState<SiteInput>(() => fromPreset(defaultSiteIds()[0]));
  const [siteB, setSiteB] = useState<SiteInput>(() => fromPreset(defaultSiteIds()[1]));
  const [start, setStart] = useState(DEFAULT_START);
  const [days, setDays] = useState("30");
  const [stepMin, setStepMin] = useState("60");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const plan = planRequest(days, stepMin);

  async function run(inputs: [SiteInput, SiteInput], fetcher: SeriesFetcher) {
    setStatus({ kind: "loading" });
    const expected = inputs.map((s) => expectedSiteFrom(s.lon, s.lat, s.alt)) as [
      ReturnType<typeof expectedSiteFrom>,
      ReturnType<typeof expectedSiteFrom>,
    ];
    const loads = await loadComparison(fetcher, expected);
    setStatus({
      kind: "done",
      sites: [
        { ...describe(inputs[0]), input: inputs[0], load: loads[0] },
        { ...describe(inputs[1]), input: inputs[1], load: loads[1] },
      ],
    });
  }

  function queryLive(e: React.FormEvent) {
    e.preventDefault();
    // Checked here as well as on the server, so no request is sent that the server would refuse.
    if (!start) {
      setStatus({ kind: "invalid", message: "Enter a start date." });
      return;
    }
    if (!plan.ok) {
      setStatus({ kind: "invalid", message: plan.message });
      return;
    }
    const stop = addDaysUtc(start, plan.days);
    const inputs: [SiteInput, SiteInput] = [siteA, siteB];
    void run(inputs, (i, body) =>
      getJson(
        `/api/ephemeris?${new URLSearchParams({ target: body, lon: inputs[i].lon, lat: inputs[i].lat, alt: inputs[i].alt, start, stop, stepMin })}`,
      ),
    );
  }

  function loadArchive() {
    // Archived data exists only for these two sites; the selectors are set to match so
    // archived values are never shown under a different location.
    const inputs: [SiteInput, SiteInput] = [fromPreset("apollo11"), fromPreset("apollo17")];
    setSiteA(inputs[0]);
    setSiteB(inputs[1]);
    void run(inputs, (i, body) => getJson(`/api/sample?id=${inputs[i].presetId}-${body}`));
  }

  const loading = status.kind === "loading";
  const sites = status.kind === "done" ? status.sites : null;
  const loadSummary = sites ? summariseLoad([sites[0].load, sites[1].load]) : null;
  const firstOk = sites
    ?.flatMap((s) => [s.load.sun, s.load.earth])
    .find((s): s is Extract<SeriesState, { status: "ok" }> => s.status === "ok")?.data;
  const comparison = sites
    ? compareSites(
        { sun: pointsOf(sites[0].load.sun), earth: pointsOf(sites[0].load.earth), stepMinutes: firstOk?.request.stepMinutes },
        { sun: pointsOf(sites[1].load.sun), earth: pointsOf(sites[1].load.earth), stepMinutes: firstOk?.request.stepMinutes },
        CONFIG,
      )
    : null;
  const anyArchive = sites?.some((s) => [s.load.sun, s.load.earth].some((x) => x.status === "ok" && x.data.source === "archive"));

  const diffText = (h: number | null) =>
    h === null ? "not available" : Math.abs(h) < 0.05 ? "no difference" : `${h > 0 ? "A" : "B"} longer by ≈ ${fmtHours(Math.abs(h))}`;

  return (
    <div className="space-y-8">
      {/* 1. Choose Sites + 2. Date Range */}
      <form onSubmit={queryLive} className="space-y-4">
        <section aria-labelledby="h-sites">
          <h2 id="h-sites" className="mb-2 text-lg font-semibold text-slate-50">
            1. Choose Sites
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <SitePicker site="A" value={siteA} onChange={setSiteA} />
            <SitePicker site="B" value={siteB} onChange={setSiteB} />
          </div>
          {hasRegionalReferences() && (
            <p role="note" className="mt-2 rounded border border-amber-500/50 bg-amber-950/30 p-2 text-xs text-amber-100">
              <strong>NASA 2023 regional reference points are NOT NASA-approved landing points.</strong> They are
              centre points of region polygons in a 2023 NASA reference table, and not necessarily the centres of the
              2024 Artemis III candidate regions. Results for them are geometric Sun and Earth disc-centre visibility
              over a smooth sphere only. Site height is assumed to be 0 km. Near the pole the Sun and Earth stay
              within a few degrees of the horizon, where real terrain decides what is visible. No terrain, power
              output or radio-link performance is modelled.
            </p>
          )}
          {!hasSouthPoleCandidates() && !hasRegionalReferences() && (
            <p className="mt-2 rounded border border-slate-700 bg-slate-900/40 p-2 text-xs text-slate-300">
              <strong>Lunar south-pole candidate sites are pending.</strong> They will be added once coordinates with a
              citable NASA source are confirmed. The locations offered now are validation examples and are NOT lunar
              south-pole landing candidates.
            </p>
          )}
        </section>

        <section aria-labelledby="h-dates" className={card}>
          <h2 id="h-dates" className="mb-2 text-lg font-semibold text-slate-50">
            2. Date Range (UTC)
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
            <label className={labelCls}>
              Start date
              <input className={field} type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label className={labelCls}>
              Number of days
              <input className={field} type="number" min={1} max={62} value={days} onChange={(e) => setDays(e.target.value)} required />
            </label>
            <label className={labelCls}>
              Sample every
              <select className={field} value={stepMin} onChange={(e) => setStepMin(e.target.value)}>
                <option value="10">10 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="360">6 hours</option>
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Both sites use the same start, end and sampling interval. A lunar day lasts about 29.5 Earth days.
          </p>
          {plan.ok ? (
            <p id="request-size" data-testid="request-size" className="mt-1 text-xs text-slate-400">
              This request: {plan.samplesPerSeries.toLocaleString("en-US")} samples per series, four series (Sun and
              Earth for each site). Limits: {LIMITS.maxPoints.toLocaleString("en-US")} samples per series and{" "}
              {LIMITS.maxSpanDays} days.
            </p>
          ) : (
            <p
              id="request-size"
              data-testid="request-size"
              role="alert"
              className="mt-1 rounded border border-amber-500/50 bg-amber-950/30 p-2 text-xs text-amber-200"
            >
              <strong>Not sent — outside the request limits.</strong> {plan.message}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading || !plan.ok}
              aria-describedby="request-size"
              className="rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              {loading ? "Querying NASA/JPL Horizons…" : "Compare sites"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={loadArchive}
              className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Load archived example (Apollo 11 vs Apollo 17)
            </button>
          </div>
        </section>
      </form>

      {status.kind === "invalid" && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
          {status.message}
        </div>
      )}

      {status.kind === "idle" && (
        <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
          No data yet. Choose two sites and a date range, then select <strong>Compare sites</strong>.
        </p>
      )}

      {loading && (
        <p role="status" className="rounded-lg border border-slate-700 p-6 text-center text-sm text-slate-300">
          Requesting four data series from NASA/JPL Horizons (Sun and Earth for each site)…
        </p>
      )}

      {sites && loadSummary && comparison && (
        <>
          {/* Load status */}
          <section aria-labelledby="h-status" className={card}>
            <h2 id="h-status" className="text-sm font-semibold text-slate-100">
              Data loaded: {loadSummary.loaded} of {loadSummary.total} series
            </h2>
            {loadSummary.failures.length > 0 && (
              <div role="alert" className="mt-2 rounded border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
                <p className="font-semibold">
                  {loadSummary.loaded === 0 ? "No data could be loaded." : "Some data is missing. Results below are incomplete."}
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {loadSummary.failures.map((f) => (
                    <li key={f.site + f.body}>
                      Site {f.site} · {f.body}: {f.message}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-red-300/80">Missing series are left blank. No values have been substituted.</p>
              </div>
            )}
            {anyArchive && (
              <p className="mt-2 rounded border border-amber-500/40 bg-amber-950/30 p-2 text-sm text-amber-200">
                <strong>Archived data, not a live query.</strong> These are real NASA/JPL Horizons responses stored in
                the project repository.
              </p>
            )}
            <ul className="mt-2 grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
              {sites.flatMap((s, i) =>
                ([["Sun", s.load.sun], ["Earth", s.load.earth]] as const).map(([body, st]) => (
                  <li key={`${i}${body}`} className="flex flex-wrap items-center gap-2">
                    <SourceBadge state={st} />
                    <span>
                      Site {i === 0 ? "A" : "B"} · {body}
                    </span>
                    {st.status === "ok" && (
                      <>
                        <span className="text-slate-500">retrieved {fmtIso(st.data.retrievedAtUtc)}</span>
                        <a className="text-sky-400 underline" href={st.data.horizonsUrl} target="_blank" rel="noreferrer">
                          NASA request
                        </a>
                      </>
                    )}
                  </li>
                )),
              )}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              LIVE = fetched from NASA now · CACHED = an earlier live response reused by this server · ARCHIVED = a real
              response stored in the repository.
            </p>
          </section>

          {/* 3. Sun / 4. Earth */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-labelledby="h-sun" className={card}>
              <h2 id="h-sun" className="text-lg font-semibold text-slate-50">
                3. Sun Elevation
              </h2>
              <p className="mb-1 text-xs text-slate-400">Angle of the Sun&apos;s centre above the local horizon. Negative means below.</p>
              <ElevationChart
                body="Sun"
                thresholdDeg={CONFIG.sunThresholdDeg}
                siteA={{ label: sites[0].label, points: pointsOf(sites[0].load.sun) }}
                siteB={{ label: sites[1].label, points: pointsOf(sites[1].load.sun) }}
              />
            </section>
            <section aria-labelledby="h-earth" className={card}>
              <h2 id="h-earth" className="text-lg font-semibold text-slate-50">
                4. Earth Elevation
              </h2>
              <p className="mb-1 text-xs text-slate-400">Angle of Earth&apos;s centre above the local horizon. Negative means below.</p>
              <ElevationChart
                body="Earth"
                thresholdDeg={CONFIG.earthThresholdDeg}
                siteA={{ label: sites[0].label, points: pointsOf(sites[0].load.earth) }}
                siteB={{ label: sites[1].label, points: pointsOf(sites[1].load.earth) }}
              />
            </section>
          </div>

          {/* 5. Geometric Visibility */}
          <section aria-labelledby="h-vis" className={card}>
            <h2 id="h-vis" className="text-lg font-semibold text-slate-50">
              5. Geometric Visibility
            </h2>
            <p role="note" className="mt-2 rounded border-2 border-amber-500/60 bg-amber-950/40 p-3 text-sm font-semibold text-amber-200">
              Geometric centre-of-disc visibility only. Terrain obstruction, solar panel output and communication link
              quality are NOT modeled.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-300">{CONFIG.status}</span>{" "}
              thresholds, reviewed by the team for the tested cases only: Sun visible when its centre is above {CONFIG.sunThresholdDeg}°;
              Earth visible when its centre is above {CONFIG.earthThresholdDeg}°; joint when both hold at the same
              sample. A sample exactly on the threshold counts as not visible. Counts are of samples; durations and
              rise/set times marked “≈” are estimates by straight-line interpolation between two adjacent samples, so
              each lies within one sampling interval ({firstOk ? `${firstOk.request.stepMinutes} min` : "one step"}) of
              the true geometric time, assuming elevation changes smoothly between samples. Missing samples are never
              filled in.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3 font-medium">Geometric visibility</th>
                    <th className="py-2 pr-3 font-medium" style={{ color: SITE_A_COLOR }}>
                      <LineSample site="A" />A (solid): {sites[0].label}
                    </th>
                    <th className="py-2 font-medium" style={{ color: SITE_B_COLOR }}>
                      <LineSample site="B" />B (dashed): {sites[1].label}
                    </th>
                  </tr>
                </thead>
                <tbody className="align-top text-xs">
                  {(
                    [
                      ["Sun above horizon", comparison.a.sun, comparison.b.sun],
                      ["Earth above horizon", comparison.a.earth, comparison.b.earth],
                      ["Sun and Earth together", comparison.a.joint, comparison.b.joint],
                    ] as const
                  ).map(([name, va, vb]) => (
                    <tr key={name} className="border-b border-slate-800/70">
                      <th scope="row" className="py-2 pr-3 text-sm font-normal text-slate-200">
                        {name}
                      </th>
                      <td className="py-2 pr-3 font-mono text-slate-100">{visibilityCell(va)}</td>
                      <td className="py-2 font-mono text-slate-100">{visibilityCell(vb)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 grid gap-x-6 md:grid-cols-2">
              <div>
                <WindowList title="Site A · Sun" v={comparison.a.sun} />
                <WindowList title="Site A · Earth" v={comparison.a.earth} />
                <WindowList title="Site A · Sun and Earth together" v={comparison.a.joint} />
              </div>
              <div>
                <WindowList title="Site B · Sun" v={comparison.b.sun} />
                <WindowList title="Site B · Earth" v={comparison.b.earth} />
                <WindowList title="Site B · Sun and Earth together" v={comparison.b.joint} />
              </div>
            </div>
          </section>

          {/* 6. Comparison Summary */}
          <section aria-labelledby="h-summary" className={card}>
            <h2 id="h-summary" className="text-lg font-semibold text-slate-50">
              6. Comparison Summary
            </h2>
            {firstOk && (
              <p className="text-xs text-slate-400">
                {firstOk.request.startUt} to {firstOk.request.stopUt} UTC, sampled every {firstOk.request.stepMinutes} minutes.
              </p>
            )}
            {!comparison.sameTimeGrid && (
              <p className="mt-2 rounded border border-amber-500/40 bg-amber-950/30 p-2 text-sm text-amber-200">
                The two sites do not have complete data on the same time grid, so differences between them are not reported.
              </p>
            )}
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              <li>
                <strong>Sun above horizon (estimated time):</strong> {diffText(comparison.differenceHours.sun)}
              </li>
              <li>
                <strong>Earth above horizon (estimated time):</strong> {diffText(comparison.differenceHours.earth)}
              </li>
              <li>
                <strong>Sun and Earth together (estimated time):</strong> {diffText(comparison.differenceHours.joint)}
              </li>
            </ul>
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              {sites.map((s, i) => (
                <div key={i} className="rounded bg-slate-950/50 p-3">
                  <dt className="font-semibold" style={{ color: i === 0 ? SITE_A_COLOR : SITE_B_COLOR }}>
                    Site {i === 0 ? "A" : "B"}: {s.label}
                  </dt>
                  <dd className="mt-1 text-slate-300">
                    Longitude {s.input.lon}° E, latitude {s.input.lat}°, height {s.input.alt} km
                  </dd>
                  <dd className="text-slate-400">{s.kindLabel}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              “Longer” compares estimated geometric time above the horizon only. It is not a statement about which site
              is better for a mission.
            </p>
          </section>
        </>
      )}

      {/* 7. Data Source & Limitations */}
      <section aria-labelledby="h-source" className={card}>
        <h2 id="h-source" className="text-lg font-semibold text-slate-50">
          {sites ? "7. " : ""}Data Source &amp; Limitations
        </h2>
        <div className="mt-2 grid gap-4 text-sm text-slate-300 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Data source</h3>
            <ul className="mt-1 space-y-1">
              <li>
                Sun and Earth positions:{" "}
                <a className="text-sky-400 underline" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">
                  NASA/JPL Horizons System
                </a>{" "}
                (
                <a className="text-sky-400 underline" href="https://ssd-api.jpl.nasa.gov/doc/horizons.html" target="_blank" rel="noreferrer">
                  API documentation
                </a>
                )
              </li>
              <li>
                Apollo site coordinates:{" "}
                <a className="text-sky-400 underline" href="https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html" target="_blank" rel="noreferrer">
                  NASA NSSDCA
                </a>
              </li>
              {hasRegionalReferences() && (
                <li>
                  NASA 2023 regional reference coordinates:{" "}
                  <a
                    className="text-sky-400 underline"
                    href="https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf"
                    target="_blank"
                    rel="noreferrer"
                  >
                    NASA Lunar Surface Data Book, ACD-50044 Rev A (2023), Table A2-2
                  </a>
                </li>
              )}
              <li>
                Code, tests and stored responses:{" "}
                <a className="text-sky-400 underline" href="https://github.com/dingchengzhu25-cmd/OrbitXI-Lunar-Landing-Site-Navigator-1" target="_blank" rel="noreferrer">
                  project repository
                </a>
              </li>
            </ul>
            {firstOk && (
              <dl className="mt-3 space-y-0.5 text-xs">
                {[
                  ["Service", `${firstOk.signature.source ?? "unknown"}, API version ${firstOk.signature.version ?? "unknown"}`],
                  ["Ephemeris", `${firstOk.meta.targetEphemeris ?? "unknown"} (target), ${firstOk.meta.centerEphemeris ?? "unknown"} (Moon)`],
                  ["Site frame", `${firstOk.meta.centerFrame ?? "unknown"}, ${firstOk.meta.centerFrameNote ?? ""}`],
                  ["Reference sphere radii", `${firstOk.meta.centerRadiiKm ?? "unknown"} km`],
                  ["Refraction", firstOk.meta.refraction ?? "unknown"],
                  ["Earth-orientation file", firstOk.meta.eopFile ?? "unknown"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-36 shrink-0 text-slate-400">{k}</dt>
                    <dd className="text-slate-200">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Limitations</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                Angles are <strong>geometric</strong>: measured from the horizontal plane of a smooth sphere at the
                site, for the centre of the Sun or Earth.
              </li>
              <li>
                <strong>Terrain is not included.</strong> Mountains and crater rims can hide the Sun or Earth even when
                the angle is positive, especially near the lunar poles.
              </li>
              <li>This is not a solar-power or temperature estimate.</li>
              <li>Earth above the horizon does not guarantee a working communication link.</li>
              <li>
                The visibility rule (disc centre above 0°) was reviewed by the team&apos;s science lead for two
                Apollo sites only. It has not been validated near the lunar poles and stays provisional.
              </li>
              <li>
                Preset heights are assumed to be 0 km. A site on high ground sees a lower horizon, which this
                app does not calculate.
              </li>
              <li>All times are UTC. The Moon has no atmosphere, so no refraction is applied.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
