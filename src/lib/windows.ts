import type { EphemerisPoint } from "./horizons/types";

/**
 * A continuous interval during which elevation stays above a threshold.
 * These are GEOMETRIC intervals on a smooth reference sphere; terrain is not considered.
 */
export interface VisibilityWindow {
  startMs: number;
  endMs: number;
  /** True when the series already was above the threshold at its first sample. */
  openStart: boolean;
  /** True when the series still was above the threshold at its last sample. */
  openEnd: boolean;
}

export interface WindowSummary {
  rangeHours: number;
  hoursAbove: number;
  fractionAbove: number;
  windowCount: number;
  longestHours: number;
  /** State at the first sample. */
  aboveAtStart: boolean;
  /** Hours from the first sample to the next threshold crossing; null if none in range. */
  hoursToNextChange: number | null;
  nextChangeMs: number | null;
}

const HOUR = 3_600_000;

/** Time at which a straight line between two samples crosses the threshold. */
function crossing(t0: number, v0: number, t1: number, v1: number, threshold: number): number {
  return t0 + ((threshold - v0) / (v1 - v0)) * (t1 - t0);
}

/**
 * Finds intervals where elevation is strictly above `thresholdDeg`, placing each
 * edge by linear interpolation between the two samples that bracket it. Edge times
 * are therefore approximate to within one sampling step.
 */
export function findWindowsAbove(points: EphemerisPoint[], thresholdDeg = 0): VisibilityWindow[] {
  const windows: VisibilityWindow[] = [];
  if (points.length === 0) return windows;

  const t = points.map((p) => Date.parse(p.t));
  const above = points.map((p) => p.elDeg > thresholdDeg);
  let start: number | null = above[0] ? t[0] : null;
  let openStart = above[0];

  for (let i = 1; i < points.length; i++) {
    if (above[i] === above[i - 1]) continue;
    const edge = crossing(t[i - 1], points[i - 1].elDeg, t[i], points[i].elDeg, thresholdDeg);
    if (above[i]) {
      start = edge;
      openStart = false;
    } else if (start !== null) {
      windows.push({ startMs: start, endMs: edge, openStart, openEnd: false });
      start = null;
    }
  }
  if (start !== null) {
    windows.push({ startMs: start, endMs: t[t.length - 1], openStart, openEnd: true });
  }
  return windows;
}

/** Intervals during which both inputs are above their thresholds. */
export function intersectWindows(a: VisibilityWindow[], b: VisibilityWindow[]): VisibilityWindow[] {
  const out: VisibilityWindow[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const startMs = Math.max(a[i].startMs, b[j].startMs);
    const endMs = Math.min(a[i].endMs, b[j].endMs);
    if (endMs > startMs) {
      const startsWith = a[i].startMs >= b[j].startMs ? a[i] : b[j];
      const endsWith = a[i].endMs <= b[j].endMs ? a[i] : b[j];
      out.push({
        startMs,
        endMs,
        openStart: a[i].startMs === b[j].startMs ? a[i].openStart && b[j].openStart : startsWith.openStart,
        openEnd: a[i].endMs === b[j].endMs ? a[i].openEnd && b[j].openEnd : endsWith.openEnd,
      });
    }
    if (a[i].endMs < b[j].endMs) i++;
    else j++;
  }
  return out;
}

export function summariseWindows(windows: VisibilityWindow[], rangeStartMs: number, rangeEndMs: number): WindowSummary {
  const rangeHours = (rangeEndMs - rangeStartMs) / HOUR;
  const durations = windows.map((w) => (w.endMs - w.startMs) / HOUR);
  const hoursAbove = durations.reduce((s, d) => s + d, 0);
  const aboveAtStart = windows.length > 0 && windows[0].openStart;

  let nextChangeMs: number | null = null;
  if (aboveAtStart) {
    nextChangeMs = windows[0].openEnd ? null : windows[0].endMs;
  } else if (windows.length > 0) {
    nextChangeMs = windows[0].startMs;
  }

  return {
    rangeHours,
    hoursAbove,
    fractionAbove: rangeHours > 0 ? hoursAbove / rangeHours : 0,
    windowCount: windows.length,
    longestHours: durations.length ? Math.max(...durations) : 0,
    aboveAtStart,
    hoursToNextChange: nextChangeMs === null ? null : (nextChangeMs - rangeStartMs) / HOUR,
    nextChangeMs,
  };
}
