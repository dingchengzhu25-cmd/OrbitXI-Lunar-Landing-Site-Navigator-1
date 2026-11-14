import { describe, expect, it } from "vitest";
import { parseHorizonsObserverJson } from "./horizons/parse";
import type { EphemerisPoint } from "./horizons/types";
import { findWindowsAbove, intersectWindows, summariseWindows } from "./windows";
import a11Earth from "@/data/samples/apollo11-earth-2026-11-14_30d_60m.json";
import a11Sun from "@/data/samples/apollo11-sun-2026-11-14_30d_60m.json";

const T0 = Date.UTC(2026, 0, 1);
const H = 3_600_000;
/** Hourly synthetic series for exercising the interval logic only. */
const series = (els: number[]): EphemerisPoint[] =>
  els.map((elDeg, i) => ({ t: new Date(T0 + i * H).toISOString(), azDeg: 0, elDeg }));

describe("findWindowsAbove (synthetic series)", () => {
  it("returns nothing when always below", () => {
    expect(findWindowsAbove(series([-5, -4, -3]))).toEqual([]);
  });

  it("returns one open window when always above", () => {
    expect(findWindowsAbove(series([5, 4, 3]))).toEqual([
      { startMs: T0, endMs: T0 + 2 * H, openStart: true, openEnd: true },
    ]);
  });

  it("interpolates rise and set times linearly", () => {
    // -10 → +10 crosses 0 half-way through hour 0–1; +10 → -30 crosses a quarter into hour 2–3.
    const w = findWindowsAbove(series([-10, 10, 10, -30]));
    expect(w).toEqual([{ startMs: T0 + 0.5 * H, endMs: T0 + 2.25 * H, openStart: false, openEnd: false }]);
  });

  it("treats a sample exactly on the threshold as not above", () => {
    expect(findWindowsAbove(series([0, 0, 0]))).toEqual([]);
  });

  it("honours a non-zero threshold", () => {
    const w = findWindowsAbove(series([0, 10, 0]), 5);
    expect(w).toEqual([{ startMs: T0 + 0.5 * H, endMs: T0 + 1.5 * H, openStart: false, openEnd: false }]);
  });

  it("finds several windows and flags open ends", () => {
    const w = findWindowsAbove(series([4, -4, 4, -4, 4]));
    expect(w.map((x) => [x.openStart, x.openEnd])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
    expect(w[0].endMs).toBe(T0 + 0.5 * H);
  });
});

describe("intersectWindows", () => {
  it("keeps only the overlap", () => {
    const a = [{ startMs: 0, endMs: 10, openStart: true, openEnd: false }];
    const b = [
      { startMs: 4, endMs: 6, openStart: false, openEnd: false },
      { startMs: 8, endMs: 20, openStart: false, openEnd: true },
    ];
    expect(intersectWindows(a, b)).toEqual([
      { startMs: 4, endMs: 6, openStart: false, openEnd: false },
      { startMs: 8, endMs: 10, openStart: false, openEnd: false },
    ]);
  });

  it("is empty when either side is empty", () => {
    expect(intersectWindows([], [{ startMs: 0, endMs: 1, openStart: true, openEnd: true }])).toEqual([]);
  });
});

describe("summariseWindows", () => {
  it("reports totals, longest window, and time to the next set", () => {
    const pts = series([4, -4, 4, 4, -4]);
    const s = summariseWindows(findWindowsAbove(pts), T0, T0 + 4 * H);
    expect(s.rangeHours).toBe(4);
    expect(s.hoursAbove).toBeCloseTo(0.5 + 2, 9);
    expect(s.longestHours).toBeCloseTo(2, 9);
    expect(s.windowCount).toBe(2);
    expect(s.aboveAtStart).toBe(true);
    expect(s.hoursToNextChange).toBeCloseTo(0.5, 9);
  });

  it("reports time to the next rise when starting below", () => {
    const s = summariseWindows(findWindowsAbove(series([-4, 4, 4])), T0, T0 + 2 * H);
    expect(s.aboveAtStart).toBe(false);
    expect(s.hoursToNextChange).toBeCloseTo(0.5, 9);
  });

  it("reports no change when above for the whole range", () => {
    const s = summariseWindows(findWindowsAbove(series([4, 4, 4])), T0, T0 + 2 * H);
    expect(s.fractionAbove).toBe(1);
    expect(s.hoursToNextChange).toBeNull();
  });
});

describe("windows on real Horizons data (Apollo 11 site, 30 days hourly)", () => {
  const sun = parseHorizonsObserverJson(a11Sun.response).points;
  const earth = parseHorizonsObserverJson(a11Earth.response).points;
  const start = Date.parse(sun[0].t);
  const end = Date.parse(sun.at(-1)!.t);

  it("agrees with a direct count of samples above 0°", () => {
    const s = summariseWindows(findWindowsAbove(sun), start, end);
    const sampleFraction = sun.filter((p) => p.elDeg > 0).length / sun.length;
    // Interpolated duration and raw sample count must agree to within one step per edge.
    expect(Math.abs(s.fractionAbove - sampleFraction)).toBeLessThan(0.01);
    expect(s.hoursAbove).toBeGreaterThan(300);
    expect(s.hoursAbove).toBeLessThan(420);
  });

  it("keeps Earth above 0° for the entire range at this near-side site", () => {
    const s = summariseWindows(findWindowsAbove(earth), start, end);
    expect(s.fractionAbove).toBe(1);
    expect(s.windowCount).toBe(1);
  });

  it("makes Sun-and-Earth overlap equal the Sun windows when Earth never sets", () => {
    const sunW = findWindowsAbove(sun);
    const both = intersectWindows(sunW, findWindowsAbove(earth));
    expect(both.map((w) => [w.startMs, w.endMs])).toEqual(sunW.map((w) => [w.startMs, w.endMs]));
  });
});
