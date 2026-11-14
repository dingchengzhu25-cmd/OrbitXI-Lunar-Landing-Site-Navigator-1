import { describe, expect, it } from "vitest";
import { parseHorizonsObserverJson } from "./horizons/parse";
import type { HorizonsRequest } from "./horizons/types";
import { assertMatchesRequest } from "./horizons/verify";
import { compareSites, PROVISIONAL_CONFIG } from "./visibility";
import a11Earth from "../../docs/handoff-data/apollo11-earth-2026-11-14_2d_180m.json";
import a11Sun from "../../docs/handoff-data/apollo11-sun-2026-11-14_2d_180m.json";
import a17Earth from "../../docs/handoff-data/apollo17-earth-2026-11-14_2d_180m.json";
import a17Sun from "../../docs/handoff-data/apollo17-sun-2026-11-14_2d_180m.json";

/**
 * Pins the numbers quoted in SCIENTIFIC_HANDOFF.md to the raw Horizons responses in
 * docs/handoff-data/. If either changes, this fails. It checks that the document and
 * the code agree with the stored data — it is NOT a scientific validation.
 */
const load = (s: { meta: { request: unknown }; response: unknown }) => {
  const parsed = parseHorizonsObserverJson(s.response);
  assertMatchesRequest(parsed, s.meta.request as HorizonsRequest);
  return parsed.points;
};
const a = { sun: load(a11Sun), earth: load(a11Earth), stepMinutes: 180 };
const b = { sun: load(a17Sun), earth: load(a17Earth), stepMinutes: 180 };
const c = compareSites(a, b, PROVISIONAL_CONFIG);
const iso = (ms: number) => new Date(ms).toISOString();

describe("SCIENTIFIC_HANDOFF.md sample (14–16 Nov 2026, 3-hour step)", () => {
  it("has 17 samples per series on one shared UTC grid", () => {
    for (const s of [a.sun, a.earth, b.sun, b.earth]) expect(s).toHaveLength(17);
    expect(c.sameTimeGrid).toBe(true);
  });

  it("quotes the first Sun and Earth rows exactly", () => {
    expect(a.sun[0]).toEqual({ t: "2026-11-14T00:00:00.000Z", azDeg: 91.441727, elDeg: -13.157931 });
    expect(a.earth[0]).toEqual({ t: "2026-11-14T00:00:00.000Z", azDeg: 279.017376, elDeg: 64.944298 });
    expect(b.sun[0]).toEqual({ t: "2026-11-14T00:00:00.000Z", azDeg: 89.445094, elDeg: -6.023618 });
    expect(b.earth[0]).toEqual({ t: "2026-11-14T00:00:00.000Z", azDeg: 247.414022, elDeg: 54.952621 });
  });

  it("reproduces the Sun visibility figures quoted for both sites", () => {
    if (!c.a.sun.ok || !c.b.sun.ok) throw new Error("expected data");
    expect(c.a.sun.visibleSamples).toBe(8);
    expect(c.b.sun.visibleSamples).toBe(12);
    expect(c.a.sun.firstTransition).toMatchObject({ kind: "rise", beforeMs: Date.parse("2026-11-15T00:00:00Z"), afterMs: Date.parse("2026-11-15T03:00:00Z") });
    expect(c.b.sun.firstTransition).toMatchObject({ kind: "rise", beforeMs: Date.parse("2026-11-14T12:00:00Z"), afterMs: Date.parse("2026-11-14T15:00:00Z") });
    expect(iso(c.a.sun.firstTransition!.estimateMs).slice(0, 16)).toBe("2026-11-15T01:55");
    expect(iso(c.b.sun.firstTransition!.estimateMs).slice(0, 16)).toBe("2026-11-14T12:38");
  });

  it("reproduces the estimated durations and near-threshold counts", () => {
    if (!c.a.sun.ok || !c.b.sun.ok) throw new Error("expected data");
    expect(c.a.sun.estimatedVisibleHours).toBeCloseTo(22.075, 3);
    expect(c.b.sun.estimatedVisibleHours).toBeCloseTo(35.36, 3);
    expect(c.a.sun.nearThresholdSamples).toBe(2);
    expect(c.b.sun.nearThresholdSamples).toBe(1);
    expect(c.a.sun.windows[0].end).toEqual({ type: "range-limit" });
    expect(c.differenceHours.sun).toBeCloseTo(-13.285, 3);
  });

  it("joint visibility equals Sun visibility here because Earth is above 0° throughout", () => {
    if (!c.a.joint.ok || !c.b.joint.ok) throw new Error("expected data");
    expect(c.a.joint.visibleSamples).toBe(8);
    expect(c.b.joint.visibleSamples).toBe(12);
  });

  it("finds Earth above 0° at every sample for both sites", () => {
    expect(c.a.earth.ok && c.a.earth.visibleSamples).toBe(17);
    expect(c.b.earth.ok && c.b.earth.visibleSamples).toBe(17);
  });
});
