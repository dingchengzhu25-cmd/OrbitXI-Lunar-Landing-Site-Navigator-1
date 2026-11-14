import { describe, expect, it } from "vitest";
import { parseHorizonsObserverJson } from "./horizons/parse";
import type { EphemerisPoint } from "./horizons/types";
import {
  analyseJoint,
  analyseSeries,
  analyseSite,
  compareSites,
  PROVISIONAL_CONFIG,
  type VisibilityResult,
} from "./visibility";
import a11Earth from "@/data/samples/apollo11-earth-2026-11-14_30d_60m.json";
import a11Sun from "@/data/samples/apollo11-sun-2026-11-14_30d_60m.json";
import a17Earth from "@/data/samples/apollo17-earth-2026-11-14_30d_60m.json";
import a17Sun from "@/data/samples/apollo17-sun-2026-11-14_30d_60m.json";

const T0 = Date.UTC(2026, 0, 1);
const H = 3_600_000;
/** Hourly synthetic series. Used only to exercise interval logic; never shown to users. */
const series = (els: number[], startHour = 0): EphemerisPoint[] =>
  els.map((elDeg, i) => ({ t: new Date(T0 + (startHour + i) * H).toISOString(), azDeg: 0, elDeg }));
const ok = (v: ReturnType<typeof analyseSeries>): VisibilityResult => {
  if (!v.ok) throw new Error(`expected ok, got ${v.reason}`);
  return v;
};
const one = (els: number[], thr = 0, band = 1) => ok(analyseSeries(series(els), thr, band, 60));

describe("analyseSeries", () => {
  it("always visible: one window limited by the range at both ends", () => {
    const v = one([5, 4, 3]);
    expect(v.visibleSamples).toBe(3);
    expect(v.fractionOfSamples).toBe(1);
    expect(v.windows).toHaveLength(1);
    expect(v.windows[0].start).toEqual({ type: "range-limit" });
    expect(v.windows[0].end).toEqual({ type: "range-limit" });
    expect(v.windows[0].estimatedHours).toBe(2);
    expect(v.firstTransition).toBeNull();
  });

  it("never visible: no windows", () => {
    const v = one([-5, -4, -3]);
    expect(v.visibleSamples).toBe(0);
    expect(v.windows).toEqual([]);
    expect(v.estimatedVisibleHours).toBe(0);
    expect(v.firstTransition).toBeNull();
  });

  it("multiple crossings: separate windows with bracketed, estimated edges", () => {
    const v = one([-10, 10, 10, -30, -30, 20, -20]);
    expect(v.windows).toHaveLength(2);
    const [w1, w2] = v.windows;
    expect(w1.start).toEqual({ type: "transition", beforeMs: T0, afterMs: T0 + H, estimateMs: T0 + 0.5 * H });
    expect(w1.end).toEqual({ type: "transition", beforeMs: T0 + 2 * H, afterMs: T0 + 3 * H, estimateMs: T0 + 2.25 * H });
    expect(w1.firstVisibleMs).toBe(T0 + H);
    expect(w1.lastVisibleMs).toBe(T0 + 2 * H);
    expect(w1.visibleSamples).toBe(2);
    expect(w1.estimatedHours).toBeCloseTo(1.75, 9);
    expect(w2.visibleSamples).toBe(1);
    expect(v.longestEstimatedHours).toBeCloseTo(1.75, 9);
    expect(v.firstTransition).toMatchObject({ kind: "rise", beforeMs: T0, afterMs: T0 + H });
  });

  it("every estimated edge lies inside its bracketing sample interval", () => {
    const v = one([-1, 30, -80, 2, -3]);
    for (const w of v.windows) {
      for (const e of [w.start, w.end]) {
        if (e.type === "transition") {
          expect(e.estimateMs).toBeGreaterThanOrEqual(e.beforeMs);
          expect(e.estimateMs).toBeLessThanOrEqual(e.afterMs);
          expect(e.afterMs - e.beforeMs).toBe(H);
        }
      }
    }
  });

  it("first and last sample boundaries are reported as range limits, not transitions", () => {
    const v = one([4, -4, 4]);
    expect(v.visibleAtFirstSample).toBe(true);
    expect(v.windows[0].start.type).toBe("range-limit");
    expect(v.windows[0].end.type).toBe("transition");
    expect(v.windows[1].start.type).toBe("transition");
    expect(v.windows[1].end.type).toBe("range-limit");
    expect(v.firstTransition?.kind).toBe("set");
  });

  it("exactly 0° is not visible, and is flagged as a boundary case", () => {
    const v = one([0, 0, 0]);
    expect(v.visibleSamples).toBe(0);
    expect(v.nearThresholdSamples).toBe(3);
  });

  it("counts near-threshold samples using the configured band", () => {
    expect(one([-0.4, 0.3, 5, -5], 0, 0.5).nearThresholdSamples).toBe(2);
    expect(one([-0.4, 0.3, 5, -5], 0, 0.1).nearThresholdSamples).toBe(0);
  });

  it("uses a configurable threshold", () => {
    const v = one([0, 10, 0], 5);
    expect(v.visibleSamples).toBe(1);
    expect(v.windows[0].start).toMatchObject({ type: "transition", estimateMs: T0 + 0.5 * H });
    expect(one([0, 10, 0], 15).visibleSamples).toBe(0);
  });

  it("missing timestamps split a window; nothing is assumed across the gap", () => {
    // Hours 0,1 then a jump to hours 4,5: two samples are missing.
    const pts = [...series([5, 5]), ...series([5, 5], 4)];
    const v = ok(analyseSeries(pts, 0, 1, 60));
    expect(v.gapCount).toBe(1);
    expect(v.windows).toHaveLength(2);
    expect(v.windows[0].end).toEqual({ type: "gap" });
    expect(v.windows[1].start).toEqual({ type: "gap" });
    // 1 h + 1 h of sampled visibility; the 3 h gap is not counted.
    expect(v.estimatedVisibleHours).toBe(2);
  });

  it("does not estimate a transition across a gap", () => {
    const pts = [...series([-5, -5]), ...series([5, 5], 6)];
    const v = ok(analyseSeries(pts, 0, 1, 60));
    expect(v.windows[0].start).toEqual({ type: "gap" });
    expect(v.firstTransition).toBeNull();
  });

  it("reports missing target data", () => {
    expect(analyseSeries(null, 0, 1)).toMatchObject({ ok: false, reason: "NO_DATA" });
    expect(analyseSeries([], 0, 1)).toMatchObject({ ok: false, reason: "NO_DATA" });
  });

  it("rejects unreadable or unordered timestamps", () => {
    const bad = [{ t: "not a date", azDeg: 0, elDeg: 1 }];
    expect(analyseSeries(bad, 0, 1)).toMatchObject({ ok: false, reason: "INVALID_TIMESTAMPS" });
    const reversed = series([1, 2]).reverse();
    expect(analyseSeries(reversed, 0, 1)).toMatchObject({ ok: false, reason: "INVALID_TIMESTAMPS" });
  });
});

describe("analyseJoint", () => {
  it("is visible only at samples where both bodies are above their thresholds", () => {
    const sun = series([-5, 5, 5, 5, -5]);
    const earth = series([5, 5, -5, 5, 5]);
    const v = ok(analyseJoint(sun, earth, PROVISIONAL_CONFIG, 60));
    expect(v.visibleSamples).toBe(2);
    expect(v.windows.map((w) => w.firstVisibleMs)).toEqual([T0 + H, T0 + 3 * H]);
  });

  it("opens when the later body rises and closes when the earlier body sets", () => {
    // Between hours 0 and 1: Sun crosses at 0.25 h, Earth at 0.75 h → joint opens at 0.75 h.
    const sun = series([-10, 30, 30]);
    const earth = series([-30, 10, 10]);
    const v = ok(analyseJoint(sun, earth, PROVISIONAL_CONFIG, 60));
    expect(v.windows[0].start).toMatchObject({ type: "transition", estimateMs: T0 + 0.75 * H });
  });

  it("refuses misaligned Sun/Earth timestamps", () => {
    const sun = series([5, 5, 5]);
    const shifted = series([5, 5, 5]).map((p) => ({ ...p, t: new Date(Date.parse(p.t) + 60_000).toISOString() }));
    expect(analyseJoint(sun, shifted, PROVISIONAL_CONFIG)).toMatchObject({ ok: false, reason: "MISALIGNED_TIMESTAMPS" });
    expect(analyseJoint(sun, series([5, 5]), PROVISIONAL_CONFIG)).toMatchObject({ ok: false, reason: "MISALIGNED_TIMESTAMPS" });
  });

  it("reports a missing series instead of guessing", () => {
    expect(analyseJoint(series([5]), null, PROVISIONAL_CONFIG)).toMatchObject({ ok: false, reason: "MISSING_SERIES" });
    expect(analyseJoint(undefined, series([5]), PROVISIONAL_CONFIG)).toMatchObject({ ok: false, reason: "MISSING_SERIES" });
  });

  it("applies separate thresholds per body", () => {
    const cfg = { ...PROVISIONAL_CONFIG, sunThresholdDeg: 10, earthThresholdDeg: 2 };
    const v = ok(analyseJoint(series([5, 15, 15]), series([3, 3, 1]), cfg, 60));
    expect(v.visibleSamples).toBe(1);
  });
});

describe("analyseSite / compareSites", () => {
  it("keeps working for one body when the other failed to load", () => {
    const v = analyseSite({ sun: series([5, -5]), earth: null, stepMinutes: 60 });
    expect(v.sun.ok).toBe(true);
    expect(v.earth).toMatchObject({ ok: false, reason: "NO_DATA" });
    expect(v.joint).toMatchObject({ ok: false, reason: "MISSING_SERIES" });
  });

  it("compares two sites on the same grid", () => {
    const a = { sun: series([5, 5, 5, 5, 5]), earth: series([5, 5, 5, 5, 5]), stepMinutes: 60 };
    const b = { sun: series([5, 5, 5, -5, -5]), earth: series([5, 5, 5, 5, 5]), stepMinutes: 60 };
    const c = compareSites(a, b);
    expect(c.sameTimeGrid).toBe(true);
    expect(c.differenceHours.sun).toBeCloseTo(4 - 2.5, 9);
    expect(c.differenceHours.earth).toBe(0);
    expect(c.differenceHours.joint).toBeCloseTo(1.5, 9);
  });

  it("withholds differences when the two sites use different time grids", () => {
    const a = { sun: series([5, 5, 5]), earth: series([5, 5, 5]) };
    const b = { sun: series([5, 5, 5], 1), earth: series([5, 5, 5], 1) };
    const c = compareSites(a, b);
    expect(c.sameTimeGrid).toBe(false);
    expect(c.differenceHours).toEqual({ sun: null, earth: null, joint: null });
    expect(c.a.sun.ok && c.b.sun.ok).toBe(true);
  });

  it("withholds a difference when one site lacks that series", () => {
    const a = { sun: series([5, 5, 5]), earth: series([5, 5, 5]) };
    const b = { sun: null, earth: series([5, 5, 5]) };
    const c = compareSites(a, b);
    expect(c.differenceHours.sun).toBeNull();
    expect(c.differenceHours.earth).toBe(0);
  });
});

describe("real Horizons data (Apollo 11 and Apollo 17 sites, 30 days hourly)", () => {
  const pts = (s: { response: unknown }) => parseHorizonsObserverJson(s.response).points;
  const a = { sun: pts(a11Sun), earth: pts(a11Earth), stepMinutes: 60 };
  const b = { sun: pts(a17Sun), earth: pts(a17Earth), stepMinutes: 60 };
  const c = compareSites(a, b);

  it("counts exactly the samples that are above 0°", () => {
    if (!c.a.sun.ok) throw new Error("expected data");
    expect(c.a.sun.sampleCount).toBe(721);
    expect(c.a.sun.visibleSamples).toBe(a.sun.filter((p) => p.elDeg > 0).length);
    expect(c.a.sun.gapCount).toBe(0);
  });

  it("estimated duration agrees with the sample count to within one step per edge", () => {
    if (!c.a.sun.ok) throw new Error("expected data");
    const sampledHours = c.a.sun.visibleSamples;
    const edges = c.a.sun.windows.length * 2;
    expect(Math.abs(c.a.sun.estimatedVisibleHours - sampledHours)).toBeLessThanOrEqual(edges);
  });

  it("finds Earth above 0° at every sample for these near-side sites", () => {
    expect(c.a.earth.ok && c.a.earth.fractionOfSamples).toBe(1);
    expect(c.b.earth.ok && c.b.earth.fractionOfSamples).toBe(1);
  });

  it("joint visibility equals Sun visibility when Earth never sets", () => {
    if (!c.a.sun.ok || !c.a.joint.ok) throw new Error("expected data");
    expect(c.a.joint.visibleSamples).toBe(c.a.sun.visibleSamples);
    expect(c.a.joint.estimatedVisibleHours).toBeCloseTo(c.a.sun.estimatedVisibleHours, 9);
  });

  it("the two archived sites share a time grid, so differences are reported", () => {
    expect(c.sameTimeGrid).toBe(true);
    expect(c.differenceHours.sun).not.toBeNull();
  });
});
