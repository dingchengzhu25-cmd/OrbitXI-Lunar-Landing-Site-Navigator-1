import { describe, expect, it } from "vitest";
import { buildHorizonsUrl, parseUtInput, validateQuery } from "./request";

const base = { target: "sun", lon: "348.8", lat: "-43.3", alt: "0", start: "2026-11-14", stop: "2026-11-15", stepMin: "60" };
const q = (over: Record<string, string> = {}) => validateQuery(new URLSearchParams({ ...base, ...over }));

describe("validateQuery", () => {
  it("accepts a well-formed request and normalises it", () => {
    const r = q();
    expect(r).toEqual({
      ok: true,
      value: {
        target: "sun",
        lonEastDeg: 348.8,
        latDeg: -43.3,
        altKm: 0,
        startUt: "2026-11-14 00:00",
        stopUt: "2026-11-15 00:00",
        stepMinutes: 60,
      },
    });
  });

  it("converts west-negative longitude to 0–360 east", () => {
    const r = q({ lon: "-11.2" });
    expect(r.ok && r.value.lonEastDeg).toBeCloseTo(348.8, 9);
  });

  it.each([
    [{ target: "mars" }, /target/],
    [{ lon: "abc" }, /lon/],
    [{ lon: "400" }, /lon/],
    [{ lat: "-91" }, /lat/],
    [{ alt: "500" }, /alt/],
    [{ start: "14 Nov 2026" }, /start and stop/],
    [{ start: "2026-02-31" }, /start and stop/],
    [{ stop: "2026-11-13" }, /later than start/],
    [{ stepMin: "1" }, /stepMin/],
    [{ stepMin: "12.5" }, /stepMin/],
    [{ stop: "2027-03-01" }, /62 days/],
    [{ stop: "2026-12-30", stepMin: "10" }, /limit is 2000/],
    [{ start: "1800-01-01", stop: "1800-01-02" }, /between 1950 and 2100/],
  ])("rejects %o", (over, pattern) => {
    const r = q(over as Record<string, string>);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(pattern);
  });
});

describe("parseUtInput", () => {
  it("reads date-only and date-time forms as UT", () => {
    expect(parseUtInput("2026-11-14")).toBe(Date.UTC(2026, 10, 14));
    expect(parseUtInput("2026-11-14T06:30")).toBe(Date.UTC(2026, 10, 14, 6, 30));
  });
});

describe("buildHorizonsUrl", () => {
  it("targets the official endpoint with the tested parameter set", () => {
    const r = q({ target: "earth" });
    if (!r.ok) throw new Error("expected valid request");
    const url = new URL(buildHorizonsUrl(r.value));
    expect(url.origin + url.pathname).toBe("https://ssd.jpl.nasa.gov/api/horizons.api");
    expect(url.searchParams.get("COMMAND")).toBe("'399'");
    expect(url.searchParams.get("CENTER")).toBe("'coord@301'");
    expect(url.searchParams.get("SITE_COORD")).toBe("'348.8,-43.3,0'");
    expect(url.searchParams.get("QUANTITIES")).toBe("'4'");
    expect(url.searchParams.get("TIME_TYPE")).toBe("'UT'");
    expect(url.searchParams.get("STEP_SIZE")).toBe("'60m'");
  });
});
