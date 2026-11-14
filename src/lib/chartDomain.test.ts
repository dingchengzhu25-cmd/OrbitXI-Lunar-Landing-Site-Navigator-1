import { describe, expect, it } from "vitest";
import { domainTicks, fitElevationDomain, nearHorizonDomain, niceStepDeg } from "./chartDomain";

describe("fitElevationDomain", () => {
  it("zooms in on a series that stays near the horizon", () => {
    // Range of the Sun at a site near latitude -85.4 over 30 days (Horizons, 14 Nov 2026).
    const [lo, hi] = fitElevationDomain([-3.111372, 1.611258, 6.101327], 0);
    expect(lo).toBe(-4);
    expect(hi).toBe(8);
  });

  it("keeps a wide range for a mid-latitude site", () => {
    expect(fitElevationDomain([-45.27, 48.21], 0)).toEqual([-50, 60]);
  });

  it("always contains the threshold and every value", () => {
    for (const values of [[12, 30], [-30, -12], [0.2, 0.4], [-0.01], [89.9], [-89.9]]) {
      const [lo, hi] = fitElevationDomain(values, 0);
      expect(lo).toBeLessThan(0);
      expect(hi).toBeGreaterThan(0);
      expect(lo).toBeLessThanOrEqual(Math.min(...values));
      expect(hi).toBeGreaterThanOrEqual(Math.max(...values));
    }
  });

  it("never leaves the physical range of an elevation angle", () => {
    const [lo, hi] = fitElevationDomain([-89.99, 89.99], 0);
    expect(lo).toBe(-90);
    expect(hi).toBe(90);
  });

  it("ignores non-finite values and copes with no data", () => {
    expect(fitElevationDomain([Number.NaN, 2, 3], 0)).toEqual(fitElevationDomain([2, 3], 0));
    const [lo, hi] = fitElevationDomain([], 0);
    expect(lo).toBeLessThan(0);
    expect(hi).toBeGreaterThan(0);
  });

  it("follows a non-zero threshold", () => {
    const [lo, hi] = fitElevationDomain([6, 7], 5);
    expect(lo).toBeLessThan(5);
    expect(hi).toBeGreaterThan(7);
  });
});

describe("near-horizon view and ticks", () => {
  it("is centred on the threshold", () => {
    expect(nearHorizonDomain(0)).toEqual([-5, 5]);
    expect(nearHorizonDomain(2)).toEqual([-3, 7]);
  });

  it("puts a tick on 0 and uses a readable spacing", () => {
    expect(domainTicks([-4, 8])).toEqual([-4, -2, 0, 2, 4, 6, 8]);
    expect(domainTicks([-5, 5])).toContain(0);
    expect(domainTicks([-50, 50])).toHaveLength(11);
    expect(niceStepDeg(3)).toBe(1);
    expect(niceStepDeg(180)).toBe(10);
  });
});
