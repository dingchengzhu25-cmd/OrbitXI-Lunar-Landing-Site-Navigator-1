import { describe, expect, it } from "vitest";
import a11Sun from "@/data/samples/apollo11-sun-2026-11-14_30d_60m.json";
import { parseHorizonsObserverJson } from "./parse";
import { HorizonsError, type HorizonsRequest, type ParsedEphemeris } from "./types";
import { assertMatchesRequest, assertTimeGridMatchesRequest, longitudeDifferenceDeg } from "./verify";

const REQ = a11Sun.meta.request as HorizonsRequest;
const parsed = (): ParsedEphemeris => parseHorizonsObserverJson(a11Sun.response);

const mismatch = (fn: () => void) => {
  try {
    fn();
    return "no error";
  } catch (e) {
    return e instanceof HorizonsError ? e.code : `other: ${String(e)}`;
  }
};

describe("assertTimeGridMatchesRequest", () => {
  it("accepts a real Horizons table for the range and step that were requested", () => {
    expect(mismatch(() => assertMatchesRequest(parsed(), REQ))).toBe("no error");
  });

  it("refuses a table that is missing its last rows", () => {
    const p = parsed();
    p.points = p.points.slice(0, -5);
    expect(mismatch(() => assertTimeGridMatchesRequest(p, REQ))).toBe("HORIZONS_MISMATCH");
  });

  it("refuses a table that starts later than requested", () => {
    const p = parsed();
    expect(mismatch(() => assertTimeGridMatchesRequest(p, { ...REQ, startUt: "2026-11-13 00:00" }))).toBe(
      "HORIZONS_MISMATCH",
    );
  });

  it("refuses a table sampled at a different step", () => {
    expect(mismatch(() => assertTimeGridMatchesRequest(parsed(), { ...REQ, stepMinutes: 120 }))).toBe(
      "HORIZONS_MISMATCH",
    );
  });

  it("refuses a table with a row missing in the middle", () => {
    const p = parsed();
    p.points = [...p.points.slice(0, 100), ...p.points.slice(101), p.points[p.points.length - 1]];
    expect(mismatch(() => assertTimeGridMatchesRequest(p, REQ))).toBe("HORIZONS_MISMATCH");
  });

  it("expects the last row at the last whole step when the range is not a multiple of the step", () => {
    const p = parsed();
    // 00:00, 07:00, 14:00, 21:00 for a 24-hour range sampled every 7 hours.
    p.points = [0, 7, 14, 21].map((h) => ({
      t: new Date(Date.UTC(2026, 10, 14, h)).toISOString(),
      azDeg: 0,
      elDeg: 0,
    }));
    const req = { ...REQ, startUt: "2026-11-14 00:00", stopUt: "2026-11-15 00:00", stepMinutes: 420 };
    expect(mismatch(() => assertTimeGridMatchesRequest(p, req))).toBe("no error");
  });
});

describe("longitudeDifferenceDeg", () => {
  it("treats longitudes on either side of the 0°/360° meridian as close", () => {
    expect(longitudeDifferenceDeg(359.99999, 0)).toBeCloseTo(0.00001, 8);
    expect(longitudeDifferenceDeg(0, 360)).toBe(0);
  });

  it("still reports a real difference", () => {
    expect(longitudeDifferenceDeg(23.47314, 30.7723)).toBeCloseTo(7.29916, 5);
    expect(longitudeDifferenceDeg(10, 350)).toBe(20);
  });
});
