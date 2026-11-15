"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BodyIcon } from "./BodyIcon";
import { ElevationChart, LineSample, SITE_A_COLOR, SITE_B_COLOR } from "./ElevationChart";
import { SkyView } from "./SkyView";
import { VisibilityTimeline } from "./VisibilityTimeline";
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
import { describeLongitude } from "@/lib/coordinates";
import { LIMITS } from "@/lib/horizons/request";
import { planRequest } from "@/lib/requestPlan";
import { checkSiteInput, errorCount, type SiteFieldErrors } from "@/lib/siteInputCheck";
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
/* Words carry the meaning; the frame only reinforces it (solid = live, outline = cached, dashed = archived). */
const SOURCE_STYLE: Record<DataSourceKind, string> = {
  live: "bg-ink text-space",
  cached: "border border-ink text-ink",
  archive: "border border-dashed border-ink-2 text-ink-2",
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

/* ---------- shared styles ---------- */

const card = "border border-rule bg-panel p-5 sm:p-6";
const field =
  "mt-1.5 w-full rounded-sm border border-rule-strong bg-space px-3 py-2 text-sm text-ink transition-colors focus:border-accent aria-invalid:border-fail";
const labelCls = "block text-[13px] font-medium text-ink-2";
const h2Cls = "font-display text-[26px] leading-tight font-normal tracking-[-0.01em] text-ink sm:text-[30px]";

/** Section heading with its reading-order number (the page is a real sequence: set up, read, verify). */
function SectionTitle({ id, n, children }: { id: string; n?: number; children: React.ReactNode }) {
  return (
    <h2 id={id} className={h2Cls}>
      {n !== undefined && <span className="mr-3 font-display text-accent-hover italic">{n}</span>}
      {children}
    </h2>
  );
}

/* ---------- small presentational pieces ---------- */

function SitePicker({
  site,
  value,
  errors,
  onChange,
}: {
  site: "A" | "B";
  value: SiteInput;
  errors: SiteFieldErrors;
  onChange: (v: SiteInput) => void;
}) {
  const preset = value.presetId === CUSTOM ? undefined : findPreset(value.presetId);
  const edit = (patch: Partial<SiteInput>) => onChange({ ...value, ...patch, presetId: CUSTOM });
  const errId = (f: keyof SiteFieldErrors) => `site-${site}-${f}-error`;
  return (
    <fieldset className={card}>
      <legend className="px-1 text-base font-semibold text-ink">
        <LineSample site={site} />
        Site {site} <span className="font-normal text-ink-2">({site === "A" ? "solid" : "dashed"} line on the charts)</span>
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
        {(
          [
            ["lon", "East longitude (°)"],
            ["lat", "Latitude (°)"],
            ["alt", "Height (km)"],
          ] as const
        ).map(([f, text]) => (
          <label key={f} className={labelCls}>
            {text}
            <input
              className={`${field} font-mono`}
              value={value[f]}
              onChange={(e) => edit({ [f]: e.target.value })}
              inputMode="decimal"
              required
              aria-invalid={errors[f] ? true : undefined}
              aria-describedby={errors[f] ? errId(f) : undefined}
            />
          </label>
        ))}
      </div>
      {errorCount(errors) > 0 && (
        <ul className="mt-2 space-y-0.5 text-[13px] text-fail" data-testid={`site-${site}-errors`}>
          {(["lon", "lat", "alt"] as const).map((f) =>
            errors[f] ? (
              <li key={f} id={errId(f)}>
                {errors[f]}
              </li>
            ) : null,
          )}
        </ul>
      )}
      <p className="mt-3 text-xs leading-relaxed text-ink-2">
        {preset ? (
          <>
            <span
              className={`mr-1 inline-block rounded-sm px-1.5 py-0.5 font-semibold ${preset.kind === "south-pole-candidate" ? "bg-earth/15 text-earth" : "bg-caution text-caution-ink ring-1 ring-caution-rule"}`}
            >
              {KIND_LABEL[preset.kind]}
            </span>{" "}
            Coordinate source:{" "}
            <a className="text-accent-hover underline underline-offset-2" href={preset.sourceUrl} target="_blank" rel="noreferrer">
              {preset.source}
            </a>
            . {preset.note}
          </>
        ) : (
          <span className="inline-block rounded-sm bg-fail/10 px-1.5 py-0.5 font-semibold text-fail ring-1 ring-fail/40">
            UNVERIFIED / EXPERIMENTAL — user-entered coordinates, not checked against any source and not a landing
            candidate.
          </span>
        )}
      </p>
    </fieldset>
  );
}

function SourceBadge({ state }: { state: SeriesState }) {
  const base = "rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wide";
  if (state.status === "error") {
    return <span className={`${base} border border-fail text-fail`}>FAILED</span>;
  }
  const s = state.data.source;
  return <span className={`${base} ${SOURCE_STYLE[s]}`}>{SOURCE_LABEL[s]}</span>;
}

function edgeText(edge: WindowEdge, which: "start" | "end"): string {
  if (edge.type === "range-limit") return which === "start" ? "already visible at range start" : "still visible at range end";
  if (edge.type === "gap") return "bounded by missing samples";
  return `≈ ${fmtMs(edge.estimateMs)} (between ${fmtMs(edge.beforeMs).slice(11, 16)} and ${fmtMs(edge.afterMs).slice(11, 21)})`;
}

function visibilityCell(v: Visibility): React.ReactNode {
  if (!v.ok) return <span className="text-fail">Not available — {v.message}</span>;
  const first = v.firstTransition;
  return (
    <div className="space-y-0.5">
      <div>
        {v.visibleSamples} of {v.sampleCount} samples ({(v.fractionOfSamples * 100).toFixed(1)}%)
      </div>
      <div>≈ {fmtHours(v.estimatedVisibleHours)} estimated</div>
      <div className="text-ink-2">
        {v.windows.length} window{v.windows.length === 1 ? "" : "s"}
        {v.windows.length > 0 && `, longest ≈ ${fmtHours(v.longestEstimatedHours)}`}
      </div>
      <div className="text-ink-2">
        {first
          ? `First ${first.kind} ≈ ${fmtMs(first.estimateMs)}`
          : v.visibleAtFirstSample
            ? "Visible at every sample"
            : v.visibleSamples === 0
              ? "Not visible at any sample"
              : "No transition between adjacent samples"}
      </div>
      {v.nearThresholdSamples > 0 && (
        <div className="text-caution-ink">
          {v.nearThresholdSamples} sample{v.nearThresholdSamples === 1 ? "" : "s"} within ±{CONFIG.nearThresholdBandDeg}° of the
          threshold
        </div>
      )}
      {v.gapCount > 0 && <div className="text-caution-ink">{v.gapCount} gap(s) in the samples — not bridged</div>}
    </div>
  );
}

function WindowList({ title, v }: { title: string; v: Visibility }) {
  if (!v.ok || v.windows.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-accent-hover">
        {title}: {v.windows.length} sampled window{v.windows.length === 1 ? "" : "s"}
      </summary>
      <ol className="mt-1 space-y-1 text-xs text-ink-2">
        {v.windows.slice(0, 12).map((w, i) => (
          <li key={i} className="bg-space/60 p-2 font-mono">
            <div>Start: {edgeText(w.start, "start")}</div>
            <div>End: {edgeText(w.end, "end")}</div>
            <div className="text-ink-3">
              {w.visibleSamples} visible sample{w.visibleSamples === 1 ? "" : "s"}, first {fmtMs(w.firstVisibleMs)}, last{" "}
              {fmtMs(w.lastVisibleMs)}, ≈ {fmtHours(w.estimatedHours)}
            </div>
          </li>
        ))}
        {v.windows.length > 12 && <li className="text-ink-3">…and {v.windows.length - 12} more.</li>}
      </ol>
    </details>
  );
}

/** One figure in the summary card: big number, then what it counts. */
function Metric({ body, title, v, mode }: { body: "Sun" | "Earth" | "Both"; title: string; v: Visibility; mode: "share" | "longest" }) {
  const rule = body === "Sun" ? "border-sun" : body === "Earth" ? "border-earth" : "border-ink-3";
  if (!v.ok) {
    return (
      <div className={`border-t-2 ${rule} pt-2`}>
        <div className="text-[13px] text-ink-2">{title}</div>
        <div className="mt-1 text-sm text-fail">Not available</div>
      </div>
    );
  }
  const openEnded =
    mode === "longest" &&
    v.windows.some((w) => Math.abs(w.estimatedHours - v.longestEstimatedHours) < 1e-9 && (w.start.type !== "transition" || w.end.type !== "transition"));
  return (
    <div className={`border-t-2 ${rule} pt-2`}>
      <div className="flex items-center gap-1.5 text-[13px] text-ink-2">
        {body === "Both" ? (
          <>
            <BodyIcon body="Sun" size={14} />
            <BodyIcon body="Earth" size={14} />
          </>
        ) : (
          <BodyIcon body={body} size={14} />
        )}
        {title}
      </div>
      {mode === "share" ? (
        <>
          <div className="mt-1 font-mono text-[22px] leading-none text-ink tabular-nums sm:text-[28px]">
            {(v.fractionOfSamples * 100).toFixed(1)}
            <span className="ml-0.5 text-base text-ink-2">%</span>
          </div>
          <div className="mt-1.5 text-xs text-ink-2">
            of {v.sampleCount} samples, ≈ {fmtHours(v.estimatedVisibleHours)} estimated
          </div>
        </>
      ) : (
        <>
          <div className="mt-1 font-mono text-[22px] leading-none text-ink tabular-nums sm:text-[28px]">
            {v.windows.length === 0 ? "None" : `≈ ${fmtHours(v.longestEstimatedHours)}`}
          </div>
          <div className="mt-1.5 text-xs text-ink-2">
            {v.windows.length === 0 ? "not above the horizon at any sample" : openEnded ? "at least; it runs past the range edge" : "estimated from samples"}
          </div>
        </>
      )}
      {v.nearThresholdSamples > 0 && (
        <div className="mt-1 text-xs text-caution-ink">
          {v.nearThresholdSamples} sample{v.nearThresholdSamples === 1 ? "" : "s"} within ±{CONFIG.nearThresholdBandDeg}° of the threshold
        </div>
      )}
    </div>
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
  const [cursorIdx, setCursorIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const plan = planRequest(days, stepMin);
  const errorsA = checkSiteInput(siteA.lon, siteA.lat, siteA.alt);
  const errorsB = checkSiteInput(siteB.lon, siteB.lat, siteB.alt);
  const inputErrors = errorCount(errorsA) + errorCount(errorsB);

  async function run(inputs: [SiteInput, SiteInput], fetcher: SeriesFetcher) {
    setStatus({ kind: "loading" });
    setPlaying(false);
    const expected = inputs.map((s) => expectedSiteFrom(s.lon, s.lat, s.alt)) as [
      ReturnType<typeof expectedSiteFrom>,
      ReturnType<typeof expectedSiteFrom>,
    ];
    const loads = await loadComparison(fetcher, expected);
    setCursorIdx(null);
    setStatus({
      kind: "done",
      sites: [
        { ...describe(inputs[0]), input: inputs[0], load: loads[0] },
        { ...describe(inputs[1]), input: inputs[1], load: loads[1] },
      ],
    });
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function queryLive(e: React.FormEvent) {
    e.preventDefault();
    // Checked here as well as on the server, so no request is sent that the server would refuse.
    if (inputErrors > 0) {
      setStatus({ kind: "invalid", message: "Fix the highlighted coordinates before comparing. Nothing was sent." });
      return;
    }
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

  /* The shared time cursor moves only between real sample times (no interpolated positions). */
  const sampleTimes = useMemo(() => {
    if (!sites) return [] as number[];
    const set = new Set<number>();
    for (const s of sites) for (const st of [s.load.sun, s.load.earth]) for (const p of pointsOf(st) ?? []) set.add(Date.parse(p.t));
    return [...set].sort((x, y) => x - y);
  }, [sites]);
  // Until the user moves it, the cursor opens on a meaningful real sample: the one just after
  // Site A's first Sun rise or set (else the first sample).
  const firstEventMs = comparison?.a.sun.ok ? comparison.a.sun.firstTransition?.afterMs ?? null : null;
  const defaultIdx = firstEventMs != null ? Math.max(0, sampleTimes.indexOf(firstEventMs)) : 0;
  const idx = Math.min(cursorIdx ?? defaultIdx, Math.max(0, sampleTimes.length - 1));
  const cursorMs = sampleTimes.length ? sampleTimes[idx] : null;
  const pickTime = (ms: number) => {
    if (!sampleTimes.length) return;
    let best = 0;
    for (let i = 1; i < sampleTimes.length; i++) if (Math.abs(sampleTimes[i] - ms) < Math.abs(sampleTimes[best] - ms)) best = i;
    setPlaying(false);
    setCursorIdx(best);
  };

  useEffect(() => {
    if (!playing || sampleTimes.length < 2) return;
    const perTick = Math.max(1, Math.round(sampleTimes.length / 280)); // whole range in about 14 s
    const id = window.setInterval(() => {
      setCursorIdx((i) => {
        const cur = i ?? defaultIdx;
        return cur + perTick >= sampleTimes.length ? 0 : cur + perTick;
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [playing, sampleTimes.length, defaultIdx]);

  const diffText = (h: number | null) =>
    h === null ? "not available" : Math.abs(h) < 0.05 ? "no difference" : `${h > 0 ? "A" : "B"} longer by ≈ ${fmtHours(Math.abs(h))}`;

  return (
    <div className="space-y-10">
      {/* 1. Choose sites + 2. Date range */}
      <form onSubmit={queryLive} className="space-y-6" noValidate>
        <section aria-labelledby="h-sites" id="compare">
          <SectionTitle id="h-sites" n={1}>
            Choose two sites
          </SectionTitle>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SitePicker site="A" value={siteA} errors={errorsA} onChange={setSiteA} />
            <SitePicker site="B" value={siteB} errors={errorsB} onChange={setSiteB} />
          </div>
          {hasRegionalReferences() && (
            <p role="note" className="mt-3 border border-caution-rule bg-caution p-3 text-xs leading-relaxed text-caution-ink">
              <strong>NASA 2023 regional reference points are NOT NASA-approved landing points.</strong> They are
              centre points of region polygons in a 2023 NASA reference table, and not necessarily the centres of the
              2024 Artemis III candidate regions. Results for them are sampled geometric estimates of Sun and Earth
              disc-centre visibility over a smooth sphere only. Site height is assumed to be 0 km. Near-polar
              geometry can place the Sun or Earth close to the smooth-sphere horizon at some times; even small
              geometric or terrain differences may change whether a sample counts as visible. No terrain, power
              output or radio-link performance is modelled.
            </p>
          )}
          {!hasSouthPoleCandidates() && !hasRegionalReferences() && (
            <p className="mt-3 border border-rule bg-panel p-3 text-xs text-ink-2">
              <strong>Lunar south-pole candidate sites are pending.</strong> They will be added once coordinates with a
              citable NASA source are confirmed. The locations offered now are validation examples and are NOT lunar
              south-pole landing candidates.
            </p>
          )}
        </section>

        <section aria-labelledby="h-dates" className={card}>
          <SectionTitle id="h-dates" n={2}>
            Date range (UTC)
          </SectionTitle>
          {/* One column on phones so the native date field shows its whole value; three columns from 640 px. */}
          <div className="mt-4">
          <div className="grid grid-cols-1 gap-3 sm:max-w-xl sm:grid-cols-3" data-testid="date-range-fields">
            <label className={labelCls}>
              Start date
              <input className={`${field} font-mono`} type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label className={labelCls}>
              Number of days
              <input className={`${field} font-mono`} type="number" min={1} max={62} value={days} onChange={(e) => setDays(e.target.value)} required />
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
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Both sites use the same start, end and sampling interval. A lunar day lasts about 29.5 Earth days.
          </p>
          {plan.ok ? (
            <p id="request-size" data-testid="request-size" className="mt-1 text-xs text-ink-2">
              This request: {plan.samplesPerSeries.toLocaleString("en-US")} samples per series, four series (Sun and
              Earth for each site). Limits: {LIMITS.maxPoints.toLocaleString("en-US")} samples per series and{" "}
              {LIMITS.maxSpanDays} days.
            </p>
          ) : (
            <p
              id="request-size"
              data-testid="request-size"
              role="alert"
              className="mt-2 border border-caution-rule bg-caution p-2.5 text-xs text-caution-ink"
            >
              <strong>Not sent — outside the request limits.</strong> {plan.message}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading || !plan.ok || inputErrors > 0}
              aria-describedby="request-size"
              className="rounded-sm bg-accent px-6 py-2.5 text-[15px] font-semibold text-white transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-raised disabled:text-ink-3"
            >
              {loading ? "Querying NASA/JPL Horizons…" : "Compare sites"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={loadArchive}
              className="rounded-sm border border-rule-strong px-5 py-2.5 text-[15px] text-ink transition-colors hover:border-ink-3 disabled:opacity-50"
            >
              Load archived example (Apollo 11 vs Apollo 17)
            </button>
            {inputErrors > 0 && (
              <span className="text-[13px] text-fail">
                Fix {inputErrors} coordinate{inputErrors === 1 ? "" : "s"} above to compare.
              </span>
            )}
          </div>
        </section>
      </form>

      {status.kind === "invalid" && (
        <div role="alert" className="border border-fail/50 bg-fail/10 p-4 text-sm text-fail">
          {status.message}
        </div>
      )}

      {status.kind === "idle" && (
        <p className="border border-dashed border-rule-strong p-8 text-center text-sm text-ink-2">
          No data yet. Choose two sites and a date range, then select <strong className="text-ink">Compare sites</strong>.
        </p>
      )}

      {loading && (
        <p role="status" className="border border-rule p-8 text-center text-sm text-ink-2">
          Requesting four data series from NASA/JPL Horizons (Sun and Earth for each site)…
        </p>
      )}

      {sites && loadSummary && comparison && (
        <div ref={resultsRef} className="scroll-mt-6 space-y-10">
          {/* Load status and provenance */}
          <section aria-labelledby="h-status" className={card}>
            <h2 id="h-status" className="text-base font-semibold text-ink">
              Data loaded: {loadSummary.loaded} of {loadSummary.total} series
            </h2>
            {loadSummary.failures.length > 0 && (
              <div role="alert" className="mt-3 border border-fail/50 bg-fail/10 p-3 text-sm text-fail">
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
                <p className="mt-1 opacity-80">Missing series are left blank. No values have been substituted.</p>
              </div>
            )}
            {anyArchive && (
              <p className="mt-3 border border-caution-rule bg-caution p-2.5 text-sm text-caution-ink">
                <strong>Archived data, not a live query.</strong> These are real NASA/JPL Horizons responses stored in
                the project repository.
              </p>
            )}
            <ul className="mt-3 grid gap-2 text-xs text-ink-2 sm:grid-cols-2">
              {sites.flatMap((s, i) =>
                ([["Sun", s.load.sun], ["Earth", s.load.earth]] as const).map(([body, st]) => (
                  <li key={`${i}${body}`} className="flex flex-wrap items-center gap-2">
                    <SourceBadge state={st} />
                    <BodyIcon body={body} size={14} />
                    <span className="text-ink">
                      Site {i === 0 ? "A" : "B"} · {body}
                    </span>
                    {st.status === "ok" && (
                      <>
                        <span className="font-mono text-ink-3">retrieved {fmtIso(st.data.retrievedAtUtc)}</span>
                        <a className="text-accent-hover underline underline-offset-2" href={st.data.horizonsUrl} target="_blank" rel="noreferrer">
                          NASA request
                        </a>
                      </>
                    )}
                  </li>
                )),
              )}
            </ul>
            <p className="mt-3 text-xs text-ink-3">
              LIVE = fetched from NASA now · CACHED = an earlier live response reused by this server · ARCHIVED = a real
              response stored in the repository.
            </p>
          </section>

          {/* 3. Summary: the answer first */}
          <section aria-labelledby="h-summary">
            <SectionTitle id="h-summary" n={3}>
              Comparison summary
            </SectionTitle>
            {firstOk && (
              <p className="mt-1 font-mono text-xs text-ink-2">
                {firstOk.request.startUt} to {firstOk.request.stopUt} UTC, sampled every {firstOk.request.stepMinutes} minutes
              </p>
            )}
            {!comparison.sameTimeGrid && (
              <p className="mt-3 border border-caution-rule bg-caution p-2.5 text-sm text-caution-ink">
                The two sites do not have complete data on the same time grid, so differences between them are not reported.
              </p>
            )}
            <ul className="mt-4 grid gap-2 text-[15px] text-ink sm:grid-cols-3" data-testid="summary-differences">
              {(
                [
                  ["Sun above horizon", "Sun", comparison.differenceHours.sun],
                  ["Earth above horizon", "Earth", comparison.differenceHours.earth],
                  ["Sun and Earth together", "Both", comparison.differenceHours.joint],
                ] as const
              ).map(([name, body, h]) => (
                <li key={name} className="border border-rule bg-panel px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[13px] text-ink-2">
                    {body === "Both" ? (
                      <>
                        <BodyIcon body="Sun" size={14} />
                        <BodyIcon body="Earth" size={14} />
                      </>
                    ) : (
                      <BodyIcon body={body} size={14} />
                    )}
                    {name} (estimated time)
                  </div>
                  <div className="mt-1 font-semibold">{diffText(h)}</div>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {sites.map((s, i) => {
                const v = i === 0 ? comparison.a : comparison.b;
                return (
                  <article key={i} className={card} aria-label={`Site ${i === 0 ? "A" : "B"} summary`}>
                    <header>
                      <h3 className="text-lg font-semibold" style={{ color: i === 0 ? SITE_A_COLOR : SITE_B_COLOR }}>
                        <LineSample site={i === 0 ? "A" : "B"} />
                        Site {i === 0 ? "A" : "B"}: {s.label}
                      </h3>
                      <p className="mt-1 text-xs text-ink-2">
                        Longitude {describeLongitude(s.input.lon)}, latitude {s.input.lat}°, height {s.input.alt} km
                      </p>
                      <p className="text-xs text-ink-3">{s.kindLabel}</p>
                    </header>
                    <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5">
                      <Metric body="Sun" title="Sun above horizon" v={v.sun} mode="share" />
                      <Metric body="Sun" title="Longest Sun window" v={v.sun} mode="longest" />
                      <Metric body="Earth" title="Earth above horizon" v={v.earth} mode="share" />
                      <Metric body="Both" title="Sun and Earth together" v={v.joint} mode="share" />
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-ink-3">
              “Longer” compares estimated geometric time above the horizon only. It is not a statement about which site
              is better for a mission.
            </p>
          </section>

          {/* 4. Timeline + shared time cursor */}
          <section aria-labelledby="h-timeline" className={card}>
            <SectionTitle id="h-timeline" n={4}>
              When each body is above the horizon
            </SectionTitle>
            <div className="mt-5">
              <VisibilityTimeline
                rows={[
                  { site: "A", body: "Sun", siteLabel: sites[0].label, v: comparison.a.sun },
                  { site: "A", body: "Earth", siteLabel: sites[0].label, v: comparison.a.earth },
                  { site: "B", body: "Sun", siteLabel: sites[1].label, v: comparison.b.sun },
                  { site: "B", body: "Earth", siteLabel: sites[1].label, v: comparison.b.earth },
                ]}
                startMs={sampleTimes[0] ?? 0}
                endMs={sampleTimes[sampleTimes.length - 1] ?? 1}
                cursorMs={cursorMs}
                onPick={pickTime}
              />
            </div>
            {sampleTimes.length > 1 && (
              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-rule pt-4">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-pressed={playing}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-rule-strong text-ink transition-colors hover:border-ink-3"
                  aria-label={playing ? "Pause the time cursor" : "Play the time cursor through the range"}
                >
                  {playing ? (
                    <svg width="12" height="14" aria-hidden="true"><rect x="0" y="0" width="4" height="14" fill="currentColor" /><rect x="8" y="0" width="4" height="14" fill="currentColor" /></svg>
                  ) : (
                    <svg width="12" height="14" aria-hidden="true"><path d="M0 0 L12 7 L0 14 Z" fill="currentColor" /></svg>
                  )}
                </button>
                <label className="flex min-w-48 flex-1 items-center gap-3 text-[13px] text-ink-2">
                  <span className="sr-only">Time cursor</span>
                  <input
                    type="range"
                    min={0}
                    max={sampleTimes.length - 1}
                    value={idx}
                    onChange={(e) => {
                      setPlaying(false);
                      setCursorIdx(Number(e.target.value));
                    }}
                    className="w-full accent-accent"
                    aria-valuetext={cursorMs != null ? fmtMs(cursorMs) : undefined}
                  />
                </label>
                <span className="font-mono text-[13px] text-ink" data-testid="cursor-time">
                  {cursorMs != null ? fmtMs(cursorMs) : ""}
                </span>
              </div>
            )}
          </section>

          {/* 5. Sky view at the cursor */}
          <section aria-labelledby="h-sky" className={card}>
            <SectionTitle id="h-sky" n={5}>
              Where the Sun and Earth are in the sky
            </SectionTitle>
            <div className="mt-4">
              <SkyView
                a={{ label: sites[0].label, sun: pointsOf(sites[0].load.sun), earth: pointsOf(sites[0].load.earth) }}
                b={{ label: sites[1].label, sun: pointsOf(sites[1].load.sun), earth: pointsOf(sites[1].load.earth) }}
                cursorMs={cursorMs}
              />
            </div>
          </section>

          {/* 6. Sun / 7. Earth */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-labelledby="h-sun" className={card}>
              <SectionTitle id="h-sun" n={6}>
                <BodyIcon body="Sun" size={22} className="mr-2" />
                Sun elevation
              </SectionTitle>
              <p className="mt-1 mb-3 text-xs text-ink-2">Angle of the Sun&apos;s centre above the local horizon. Negative means below.</p>
              <ElevationChart
                body="Sun"
                thresholdDeg={CONFIG.sunThresholdDeg}
                cursorMs={cursorMs}
                siteA={{ label: sites[0].label, points: pointsOf(sites[0].load.sun) }}
                siteB={{ label: sites[1].label, points: pointsOf(sites[1].load.sun) }}
              />
            </section>
            <section aria-labelledby="h-earth" className={card}>
              <SectionTitle id="h-earth" n={7}>
                <BodyIcon body="Earth" size={22} className="mr-2" />
                Earth elevation
              </SectionTitle>
              <p className="mt-1 mb-3 text-xs text-ink-2">Angle of Earth&apos;s centre above the local horizon. Negative means below.</p>
              <ElevationChart
                body="Earth"
                thresholdDeg={CONFIG.earthThresholdDeg}
                cursorMs={cursorMs}
                siteA={{ label: sites[0].label, points: pointsOf(sites[0].load.earth) }}
                siteB={{ label: sites[1].label, points: pointsOf(sites[1].load.earth) }}
              />
            </section>
          </div>

          {/* 8. Geometric visibility in detail */}
          <section aria-labelledby="h-vis" className={card}>
            <SectionTitle id="h-vis" n={8}>
              Geometric visibility in detail
            </SectionTitle>
            <p role="note" className="mt-4 border-2 border-caution-rule bg-caution p-3 text-sm font-semibold text-caution-ink">
              Geometric centre-of-disc visibility only. Terrain obstruction, solar panel output and communication link
              quality are NOT modeled.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-2">
              <span className="rounded-sm bg-caution px-1.5 py-0.5 font-semibold text-caution-ink ring-1 ring-caution-rule">{CONFIG.status}</span>{" "}
              thresholds, reviewed by the team for the tested cases only: Sun visible when its centre is above {CONFIG.sunThresholdDeg}°;
              Earth visible when its centre is above {CONFIG.earthThresholdDeg}°; joint when both hold at the same
              sample. A sample exactly on the threshold counts as not visible. Counts are of samples; durations and
              rise/set times marked “≈” are estimates by straight-line interpolation between two adjacent samples, so
              each lies within one sampling interval ({firstOk ? `${firstOk.request.stepMinutes} min` : "one step"}) of
              the true geometric time, assuming elevation changes smoothly between samples. Missing samples are never
              filled in.
            </p>
            {/* Desktop: side-by-side table. Phones: one card per site, so Site B is never off-screen. */}
            <div className="mt-4 hidden md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-rule-strong text-[13px] text-ink-2">
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
                    <tr key={name} className="border-b border-rule">
                      <th scope="row" className="py-3 pr-3 text-sm font-normal text-ink">
                        {name}
                      </th>
                      <td className="py-3 pr-3 font-mono text-ink">{visibilityCell(va)}</td>
                      <td className="py-3 font-mono text-ink">{visibilityCell(vb)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-4 md:hidden" data-testid="visibility-cards">
              {sites.map((s, i) => {
                const v = i === 0 ? comparison.a : comparison.b;
                return (
                  <div key={i} className="border border-rule p-3">
                    <h3 className="text-sm font-semibold" style={{ color: i === 0 ? SITE_A_COLOR : SITE_B_COLOR }}>
                      <LineSample site={i === 0 ? "A" : "B"} />
                      {i === 0 ? "A (solid)" : "B (dashed)"}: {s.label}
                    </h3>
                    <dl className="mt-2 space-y-3 text-xs">
                      {(
                        [
                          ["Sun above horizon", v.sun],
                          ["Earth above horizon", v.earth],
                          ["Sun and Earth together", v.joint],
                        ] as const
                      ).map(([name, vv]) => (
                        <div key={name}>
                          <dt className="text-[13px] text-ink">{name}</dt>
                          <dd className="mt-0.5 font-mono text-ink">{visibilityCell(vv)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 grid gap-x-6 md:grid-cols-2">
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
        </div>
      )}

      {/* Data source & limitations */}
      <section aria-labelledby="h-source" className={card} id="sources">
        <SectionTitle id="h-source" n={sites ? 9 : undefined}>
          Data source &amp; limitations
        </SectionTitle>
        <div className="mt-4 grid gap-6 text-sm text-ink-2 md:grid-cols-2">
          <div>
            <h3 className="text-[13px] font-semibold text-ink">Data source</h3>
            <ul className="mt-2 space-y-1.5">
              <li>
                Sun and Earth positions:{" "}
                <a className="text-accent-hover underline underline-offset-2" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">
                  NASA/JPL Horizons System
                </a>{" "}
                (
                <a className="text-accent-hover underline underline-offset-2" href="https://ssd-api.jpl.nasa.gov/doc/horizons.html" target="_blank" rel="noreferrer">
                  API documentation
                </a>
                )
              </li>
              <li>
                Apollo site coordinates:{" "}
                <a className="text-accent-hover underline underline-offset-2" href="https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html" target="_blank" rel="noreferrer">
                  NASA NSSDCA
                </a>
              </li>
              {hasRegionalReferences() && (
                <li>
                  NASA 2023 regional reference coordinates:{" "}
                  <a
                    className="text-accent-hover underline underline-offset-2"
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
                <a className="text-accent-hover underline underline-offset-2" href="https://github.com/dingchengzhu25-cmd/OrbitXI-Lunar-Landing-Site-Navigator-1" target="_blank" rel="noreferrer">
                  project repository
                </a>
              </li>
              <li className="text-ink-3">
                Imagery, for identification and decoration only (not used in any calculation): Sun disk from NASA SDO/HMI
                (14 Nov 2026); Earth disk from NASA EPIC on DSCOVR (11 Nov 2026); star field from{" "}
                <a className="underline underline-offset-2" href="https://svs.gsfc.nasa.gov/4851" target="_blank" rel="noreferrer">
                  NASA SVS Deep Star Maps 2020
                </a>
                .
              </li>
            </ul>
            {firstOk && (
              <dl className="mt-4 space-y-1 text-xs">
                {[
                  ["Service", `${firstOk.signature.source ?? "unknown"}, API version ${firstOk.signature.version ?? "unknown"}`],
                  ["Ephemeris", `${firstOk.meta.targetEphemeris ?? "unknown"} (target), ${firstOk.meta.centerEphemeris ?? "unknown"} (Moon)`],
                  ["Site frame", `${firstOk.meta.centerFrame ?? "unknown"}, ${firstOk.meta.centerFrameNote ?? ""}`],
                  ["Reference sphere radii", `${firstOk.meta.centerRadiiKm ?? "unknown"} km`],
                  ["Refraction", firstOk.meta.refraction ?? "unknown"],
                  ["Earth-orientation file", firstOk.meta.eopFile ?? "unknown"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-40 shrink-0 text-ink-3">{k}</dt>
                    <dd className="font-mono text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-ink">Limitations</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                Angles are <strong className="text-ink">geometric</strong>: measured from the horizontal plane of a smooth sphere at the
                site, for the centre of the Sun or Earth.
              </li>
              <li>
                <strong className="text-ink">Terrain is not included.</strong> Mountains and crater rims can hide the Sun or Earth even when
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
