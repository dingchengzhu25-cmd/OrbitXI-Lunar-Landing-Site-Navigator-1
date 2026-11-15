import { describe, expect, it } from "vitest";
import { validateQuery } from "./horizons/request";
import { checkSiteInput, errorCount } from "./siteInputCheck";

const serverAccepts = (lon: string, lat: string, alt: string) =>
  validateQuery(new URLSearchParams({ lon, lat, alt, start: "2026-11-14", stop: "2026-11-15", stepMin: "60" })).ok;

describe("checkSiteInput", () => {
  it("accepts preset-style coordinates", () => {
    expect(checkSiteInput("23.47314", "0.67416", "0")).toEqual({});
    expect(checkSiteInput("-0.23578", "-85.9948", "0")).toEqual({});
  });

  it("reports each out-of-range field separately (R3 case: lon 400, lat 95)", () => {
    const e = checkSiteInput("400", "95", "0");
    expect(e.lon).toBe("East longitude must be between −180° and 360°.");
    expect(e.lat).toBe("Latitude must be between −90° and 90°.");
    expect(e.alt).toBeUndefined();
    expect(errorCount(e)).toBe(2);
  });

  it("asks for missing or non-numeric values", () => {
    expect(checkSiteInput("", "x", " ").lon).toMatch(/Enter an east longitude/);
    expect(checkSiteInput("", "x", " ").lat).toMatch(/Enter a latitude/);
    expect(checkSiteInput("", "x", " ").alt).toMatch(/Enter a height/);
  });

  it("uses exactly the server's ranges, including the boundaries", () => {
    const cases: [string, string, string][] = [
      ["-180", "-90", "-10"],
      ["360", "90", "20"],
      ["-180.001", "0", "0"],
      ["360.001", "0", "0"],
      ["0", "-90.001", "0"],
      ["0", "90.001", "0"],
      ["0", "0", "-10.001"],
      ["0", "0", "20.001"],
    ];
    for (const [lon, lat, alt] of cases) {
      expect(errorCount(checkSiteInput(lon, lat, alt)) === 0).toBe(serverAccepts(lon, lat, alt));
    }
  });
});
