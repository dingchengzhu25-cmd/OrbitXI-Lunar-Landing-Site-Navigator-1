import { describe, expect, it } from "vitest";
import { LIMITS, validateQuery } from "./horizons/request";
import { maxDaysForStep, planRequest, samplesFor } from "./requestPlan";

const STEPS = [10, 30, 60, 120, 360];

/** What the server decides for the same whole-day range. */
function serverAccepts(days: number, step: number): boolean {
  const start = "2026-11-14";
  const stop = new Date(Date.parse(`${start}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  return validateQuery(new URLSearchParams({ target: "sun", lon: "0", lat: "-85", alt: "0", start, stop, stepMin: String(step) })).ok;
}

describe("planRequest", () => {
  it("accepts the default request and reports its size", () => {
    expect(planRequest("30", "60")).toEqual({ ok: true, days: 30, stepMinutes: 60, samplesPerSeries: 721 });
  });

  it("explains the 2,000-sample limit and offers a range that fits", () => {
    const plan = planRequest("62", "30");
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.message).toContain("2,977 samples per series");
      expect(plan.message).toContain("limit is 2,000");
      expect(plan.message).toContain("41 days or fewer");
    }
  });

  it("rejects more than the maximum span and non-numeric input", () => {
    expect(planRequest("63", "360").ok).toBe(false);
    expect(planRequest("90", "360").ok).toBe(false);
    expect(planRequest("", "60").ok).toBe(false);
    expect(planRequest("2.5", "60").ok).toBe(false);
    expect(planRequest("0", "60").ok).toBe(false);
    expect(planRequest("30", "5").ok).toBe(false);
  });

  it("agrees with the server for every offered interval and every range up to 70 days", () => {
    for (const step of STEPS) {
      for (let days = 1; days <= 70; days++) {
        expect(planRequest(String(days), String(step)).ok, `${days} d / ${step} min`).toBe(serverAccepts(days, step));
      }
    }
  });

  it("maxDaysForStep is the largest accepted range", () => {
    for (const step of STEPS) {
      const max = maxDaysForStep(step);
      expect(serverAccepts(max, step), `${step} min`).toBe(true);
      if (max < LIMITS.maxSpanDays) expect(samplesFor(max + 1, step)).toBeGreaterThan(LIMITS.maxPoints);
    }
    expect(maxDaysForStep(30)).toBe(41);
    expect(maxDaysForStep(10)).toBe(13);
    expect(maxDaysForStep(60)).toBe(62);
  });
});
