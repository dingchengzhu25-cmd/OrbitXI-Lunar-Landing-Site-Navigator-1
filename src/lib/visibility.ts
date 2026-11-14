import type { EphemerisPoint } from "./horizons/types";

/**
 * Geometric visibility from sampled elevation series.
 *
 * Everything here is derived from discrete samples of the disc-centre elevation above
 * the horizontal plane of a smooth reference sphere. Terrain, disc size, power and
 * link quality are not modelled. Windows are SAMPLED (which samples are above the
 * threshold) with ESTIMATED edges (linear interpolation inside the bracketing sample
 * interval). They are not exact physical predictions.
 */

export interface VisibilityConfig {
  /** Sun counts as geometrically visible when disc-centre elevation is strictly above this. */
  sunThresholdDeg: number;
  /** Earth counts as geometrically visible when disc-centre elevation is strictly above this. */
  earthThresholdDeg: number;
  /** Samples within ± this many degrees of the threshold are flagged as boundary cases. */
  nearThresholdBandDeg: number;
  /** PROVISIONAL until the thresholds pass scientific review. */
  status: "PROVISIONAL" | "APPROVED";
}

export const PROVISIONAL_CONFIG: VisibilityConfig = {
  sunThresholdDeg: 0,
  earthThresholdDeg: 0,
  nearThresholdBandDeg: 1,
  status: "PROVISIONAL",
};

/** How one edge of a sampled window is bounded. */
export type WindowEdge =
  /** The series was already (or still) visible at its first (or last) sample; the true edge lies outside the range. */
  | { type: "range-limit" }
  /** A sample is missing next to this edge; nothing is assumed across the gap. */
  | { type: "gap" }
  /**
   * The state changed between two consecutive samples. The true transition lies somewhere
   * in (beforeMs, afterMs); estimateMs is a linear-interpolation estimate inside it.
   */
  | { type: "transition"; beforeMs: number; afterMs: number; estimateMs: number };

export interface SampledWindow {
  /** First and last samples observed above the threshold. */
  firstVisibleMs: number;
  lastVisibleMs: number;
  visibleSamples: number;
  start: WindowEdge;
  end: WindowEdge;
  /**
   * Estimated duration in hours, from estimated start to estimated end. Edges bounded by the
   * range or by a gap use the first/last visible sample, so this is then a lower bound.
   * Assumes elevation varies smoothly between consecutive samples.
   */
  estimatedHours: number;
}

export type VisibilityFailure = {
  ok: false;
  reason: "NO_DATA" | "INVALID_TIMESTAMPS" | "MISSING_SERIES" | "MISALIGNED_TIMESTAMPS";
  message: string;
};

export interface VisibilityResult {
  ok: true;
  sampleCount: number;
  /** Expected spacing between samples, ms. */
  stepMs: number;
  visibleSamples: number;
  /** visibleSamples / sampleCount. A sample-count ratio, not a measured duration. */
  fractionOfSamples: number;
  /** Samples within the near-threshold band: the classification is sensitive there. */
  nearThresholdSamples: number;
  /** Places where a sample is missing (spacing larger than 1.5 steps). */
  gapCount: number;
  windows: SampledWindow[];
  estimatedVisibleHours: number;
  longestEstimatedHours: number;
  visibleAtFirstSample: boolean;
  /** First estimated rise or set after the first sample, if one occurs in range. */
  firstTransition: { kind: "rise" | "set"; beforeMs: number; afterMs: number; estimateMs: number } | null;
}

export type Visibility = VisibilityResult | VisibilityFailure;

const HOUR = 3_600_000;

const fail = (reason: VisibilityFailure["reason"], message: string): VisibilityFailure => ({ ok: false, reason, message });

function toTimes(points: EphemerisPoint[]): number[] | null {
  const t = points.map((p) => Date.parse(p.t));
  for (let i = 0; i < t.length; i++) {
    if (!Number.isFinite(t[i]) || (i > 0 && t[i] <= t[i - 1])) return null;
  }
  return t;
}

/** Most common spacing between consecutive samples; falls back to the given step. */
function inferStepMs(t: number[], stepMinutes?: number): number {
  if (stepMinutes && stepMinutes > 0) return stepMinutes * 60_000;
  const counts = new Map<number, number>();
  for (let i = 1; i < t.length; i++) counts.set(t[i] - t[i - 1], (counts.get(t[i] - t[i - 1]) ?? 0) + 1);
  let best = 0;
  let bestCount = 0;
  for (const [dt, c] of counts) if (c > bestCount || (c === bestCount && dt < best)) [best, bestCount] = [dt, c];
  return best;
}

/** Linear estimate of when a series crosses its threshold between samples i-1 and i. */
function crossingMs(t: number[], el: number[], i: number, threshold: number): number {
  const frac = (threshold - el[i - 1]) / (el[i] - el[i - 1]);
  return t[i - 1] + Math.min(1, Math.max(0, frac)) * (t[i] - t[i - 1]);
}

/**
 * Turns per-sample visibility flags into sampled windows.
 * `estimate(i)` gives the estimated transition time between samples i-1 and i.
 */
function buildResult(
  t: number[],
  flags: boolean[],
  nearThresholdSamples: number,
  stepMs: number,
  estimate: (i: number) => number,
): VisibilityResult {
  const n = t.length;
  const isGap = (i: number) => i > 0 && t[i] - t[i - 1] > stepMs * 1.5;
  let gapCount = 0;
  for (let i = 1; i < n; i++) if (isGap(i)) gapCount++;

  const edgeBefore = (i: number): WindowEdge =>
    i === 0
      ? { type: "range-limit" }
      : isGap(i)
        ? { type: "gap" }
        : { type: "transition", beforeMs: t[i - 1], afterMs: t[i], estimateMs: estimate(i) };
  const edgeAfter = (i: number): WindowEdge =>
    i === n - 1
      ? { type: "range-limit" }
      : isGap(i + 1)
        ? { type: "gap" }
        : { type: "transition", beforeMs: t[i], afterMs: t[i + 1], estimateMs: estimate(i + 1) };

  const windows: SampledWindow[] = [];
  let runStart = -1;
  for (let i = 0; i < n; i++) {
    if (flags[i] && (runStart < 0 || isGap(i))) {
      if (runStart >= 0) windows.push(makeWindow(runStart, i - 1));
      runStart = i;
    }
    if (!flags[i] && runStart >= 0) {
      windows.push(makeWindow(runStart, i - 1));
      runStart = -1;
    }
  }
  if (runStart >= 0) windows.push(makeWindow(runStart, n - 1));

  function makeWindow(first: number, last: number): SampledWindow {
    const start = edgeBefore(first);
    const end = edgeAfter(last);
    const from = start.type === "transition" ? start.estimateMs : t[first];
    const to = end.type === "transition" ? end.estimateMs : t[last];
    return {
      firstVisibleMs: t[first],
      lastVisibleMs: t[last],
      visibleSamples: last - first + 1,
      start,
      end,
      estimatedHours: (to - from) / HOUR,
    };
  }

  let firstTransition: VisibilityResult["firstTransition"] = null;
  for (let i = 1; i < n && firstTransition === null; i++) {
    if (flags[i] !== flags[i - 1] && !isGap(i)) {
      firstTransition = { kind: flags[i] ? "rise" : "set", beforeMs: t[i - 1], afterMs: t[i], estimateMs: estimate(i) };
    }
  }

  const visibleSamples = flags.filter(Boolean).length;
  const durations = windows.map((w) => w.estimatedHours);
  return {
    ok: true,
    sampleCount: n,
    stepMs,
    visibleSamples,
    fractionOfSamples: visibleSamples / n,
    nearThresholdSamples,
    gapCount,
    windows,
    estimatedVisibleHours: durations.reduce((s, d) => s + d, 0),
    longestEstimatedHours: durations.length ? Math.max(...durations) : 0,
    visibleAtFirstSample: flags[0],
    firstTransition,
  };
}

/**
 * Visibility of one body at one site. A sample exactly on the threshold counts as
 * NOT visible (strictly-greater rule).
 */
export function analyseSeries(
  points: EphemerisPoint[] | null | undefined,
  thresholdDeg: number,
  nearThresholdBandDeg: number,
  stepMinutes?: number,
): Visibility {
  if (!points || points.length === 0) return fail("NO_DATA", "No elevation samples are available for this series.");
  const t = toTimes(points);
  if (!t) return fail("INVALID_TIMESTAMPS", "Timestamps are missing, unreadable, or not in increasing order.");
  const el = points.map((p) => p.elDeg);
  const flags = el.map((v) => v > thresholdDeg);
  const near = el.filter((v) => Math.abs(v - thresholdDeg) <= nearThresholdBandDeg).length;
  return buildResult(t, flags, near, inferStepMs(t, stepMinutes), (i) => crossingMs(t, el, i, thresholdDeg));
}

/**
 * Joint visibility: Sun AND Earth above their thresholds at the same sampled time.
 * Both series must carry exactly the same UTC timestamps; otherwise nothing is computed.
 */
export function analyseJoint(
  sun: EphemerisPoint[] | null | undefined,
  earth: EphemerisPoint[] | null | undefined,
  config: VisibilityConfig,
  stepMinutes?: number,
): Visibility {
  if (!sun || !earth || sun.length === 0 || earth.length === 0) {
    return fail("MISSING_SERIES", "Joint visibility needs both the Sun and the Earth series for this site.");
  }
  if (sun.length !== earth.length || sun.some((p, i) => p.t !== earth[i].t)) {
    return fail("MISALIGNED_TIMESTAMPS", "Sun and Earth samples do not share the same UTC timestamps, so overlap was not computed.");
  }
  const t = toTimes(sun);
  if (!t) return fail("INVALID_TIMESTAMPS", "Timestamps are missing, unreadable, or not in increasing order.");

  const sunEl = sun.map((p) => p.elDeg);
  const earthEl = earth.map((p) => p.elDeg);
  const sunUp = sunEl.map((v) => v > config.sunThresholdDeg);
  const earthUp = earthEl.map((v) => v > config.earthThresholdDeg);
  const flags = sunUp.map((s, i) => s && earthUp[i]);
  const near = sunEl.filter(
    (v, i) =>
      Math.abs(v - config.sunThresholdDeg) <= config.nearThresholdBandDeg ||
      Math.abs(earthEl[i] - config.earthThresholdDeg) <= config.nearThresholdBandDeg,
  ).length;

  // A joint window opens when the LAST of the two bodies rises and closes when the FIRST sets.
  const estimate = (i: number): number => {
    const rising = flags[i];
    const candidates: number[] = [];
    if (sunUp[i] !== sunUp[i - 1]) candidates.push(crossingMs(t, sunEl, i, config.sunThresholdDeg));
    if (earthUp[i] !== earthUp[i - 1]) candidates.push(crossingMs(t, earthEl, i, config.earthThresholdDeg));
    if (candidates.length === 0) return rising ? t[i] : t[i - 1];
    return rising ? Math.max(...candidates) : Math.min(...candidates);
  };
  return buildResult(t, flags, near, inferStepMs(t, stepMinutes), estimate);
}

export interface SiteSeries {
  sun: EphemerisPoint[] | null;
  earth: EphemerisPoint[] | null;
  stepMinutes?: number;
}

export interface SiteVisibility {
  sun: Visibility;
  earth: Visibility;
  joint: Visibility;
}

export function analyseSite(site: SiteSeries, config: VisibilityConfig = PROVISIONAL_CONFIG): SiteVisibility {
  return {
    sun: analyseSeries(site.sun, config.sunThresholdDeg, config.nearThresholdBandDeg, site.stepMinutes),
    earth: analyseSeries(site.earth, config.earthThresholdDeg, config.nearThresholdBandDeg, site.stepMinutes),
    joint: analyseJoint(site.sun, site.earth, config, site.stepMinutes),
  };
}

export interface SiteComparisonResult {
  a: SiteVisibility;
  b: SiteVisibility;
  /** True only when every available series of both sites uses identical UTC timestamps. */
  sameTimeGrid: boolean;
  /** A minus B, in estimated hours; null when either side is unavailable or the grids differ. */
  differenceHours: { sun: number | null; earth: number | null; joint: number | null };
}

function sameGrid(series: (EphemerisPoint[] | null)[]): boolean {
  const present = series.filter((s): s is EphemerisPoint[] => !!s && s.length > 0);
  if (present.length < 2) return present.length === series.length;
  const ref = present[0];
  return present.every((s) => s.length === ref.length && s.every((p, i) => p.t === ref[i].t));
}

/** Compares two sites. Differences are only reported when both use the same time grid. */
export function compareSites(
  a: SiteSeries,
  b: SiteSeries,
  config: VisibilityConfig = PROVISIONAL_CONFIG,
): SiteComparisonResult {
  const va = analyseSite(a, config);
  const vb = analyseSite(b, config);
  const sameTimeGrid = sameGrid([a.sun, a.earth, b.sun, b.earth]);
  const diff = (x: Visibility, y: Visibility) =>
    sameTimeGrid && x.ok && y.ok ? x.estimatedVisibleHours - y.estimatedVisibleHours : null;
  return {
    a: va,
    b: vb,
    sameTimeGrid,
    differenceHours: { sun: diff(va.sun, vb.sun), earth: diff(va.earth, vb.earth), joint: diff(va.joint, vb.joint) },
  };
}
