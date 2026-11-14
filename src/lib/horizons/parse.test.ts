import { describe, expect, it } from "vitest";
import noMatch from "./__fixtures__/no-match-response.json";
import { assertMatchesRequest } from "./client";
import { horizonsDateToIso, parseHorizonsObserverJson } from "./parse";
import { buildHorizonsParams } from "./request";
import { HorizonsError, type HorizonsRequest } from "./types";
import earthSample from "@/data/samples/tycho-earth-2026-11-14_30d_60m.json";
import sunSample from "@/data/samples/tycho-sun-2026-11-14_30d_60m.json";

// These tests run against real, unmodified Horizons responses saved on 2026-11-14.

describe("parseHorizonsObserverJson — real Sun response", () => {
  const parsed = parseHorizonsObserverJson(sunSample.response);

  it("returns one row per hourly step over 30 days", () => {
    expect(parsed.points).toHaveLength(30 * 24 + 1);
  });

  it("reads the first and last rows exactly as Horizons printed them", () => {
    expect(parsed.points[0]).toEqual({ t: "2026-11-14T00:00:00.000Z", azDeg: 128.177285, elDeg: -31.362965 });
    expect(parsed.points.at(-1)).toEqual({ t: "2026-12-14T00:00:00.000Z", azDeg: 123.467345, elDeg: -28.59232 });
  });

  it("has strictly increasing, evenly spaced UTC timestamps", () => {
    const ms = parsed.points.map((p) => Date.parse(p.t));
    for (let i = 1; i < ms.length; i++) expect(ms[i] - ms[i - 1]).toBe(3_600_000);
  });

  it("keeps azimuth and elevation inside their physical ranges", () => {
    for (const p of parsed.points) {
      expect(p.azDeg).toBeGreaterThanOrEqual(0);
      expect(p.azDeg).toBeLessThan(360);
      expect(Math.abs(p.elDeg)).toBeLessThanOrEqual(90);
    }
  });

  it("captures provenance from the response header", () => {
    expect(parsed.signature).toEqual({ source: "NASA/JPL Horizons API", version: "1.2" });
    expect(parsed.meta.targetBody).toBe("Sun (10)");
    expect(parsed.meta.targetEphemeris).toBe("DE441");
    expect(parsed.meta.centerBody).toBe("Moon (301)");
    expect(parsed.meta.centerFrame).toBe("MEAN_ME (high precision)");
    expect(parsed.meta.centerFrameNote).toBe("East-longitude positive");
    expect(parsed.meta.centerGeodetic?.lonEastDeg).toBe(348.8);
    expect(parsed.meta.centerGeodetic?.latDeg).toBe(-43.3);
    expect(parsed.meta.refraction).toBe("NO (AIRLESS)");
    expect(parsed.meta.eopFile).toMatch(/^eop\./);
    expect(parsed.meta.stepSize).toBe("60 minutes");
  });

  it("matches the request that produced it", () => {
    expect(() => assertMatchesRequest(parsed, sunSample.meta.request as HorizonsRequest)).not.toThrow();
  });

  it("is rejected when checked against a different site or body", () => {
    const req = sunSample.meta.request as HorizonsRequest;
    expect(() => assertMatchesRequest(parsed, { ...req, latDeg: -89 })).toThrow(HorizonsError);
    expect(() => assertMatchesRequest(parsed, { ...req, target: "earth" })).toThrow(HorizonsError);
  });
});

describe("parseHorizonsObserverJson — real Earth response", () => {
  const parsed = parseHorizonsObserverJson(earthSample.response);

  it("identifies Earth as the target and parses every row", () => {
    expect(parsed.meta.targetBody).toBe("Earth (399)");
    expect(parsed.points).toHaveLength(721);
    expect(parsed.points[0]).toEqual({ t: "2026-11-14T00:00:00.000Z", azDeg: 13.319165, elDeg: 41.268242 });
  });
});

describe("parseHorizonsObserverJson — failures", () => {
  it("treats a real HTTP-200 'no matches' reply as an error, not data", () => {
    expect(() => parseHorizonsObserverJson(noMatch.response)).toThrow(/no ephemeris table/i);
  });

  it("rejects non-object and result-less bodies", () => {
    expect(() => parseHorizonsObserverJson("oops")).toThrow(HorizonsError);
    expect(() => parseHorizonsObserverJson({})).toThrow(HorizonsError);
    expect(() => parseHorizonsObserverJson({ error: "bad" })).toThrow(/reported an error/);
  });

  it("rejects a table whose rows are out of time order", () => {
    const text = (sunSample.response as { result: string }).result;
    const lines = text.split("\n");
    const soe = lines.findIndex((l) => l.startsWith("$$SOE"));
    [lines[soe + 1], lines[soe + 2]] = [lines[soe + 2], lines[soe + 1]];
    expect(() => parseHorizonsObserverJson({ result: lines.join("\n") })).toThrow(/time order/);
  });

  it("rejects a table that is not in UT", () => {
    const text = (sunSample.response as { result: string }).result.replaceAll("Date__(UT)", "Date__(TT)");
    expect(() => parseHorizonsObserverJson({ result: text })).toThrow(/UT date column/);
  });
});

describe("horizonsDateToIso", () => {
  it("converts Horizons calendar stamps to ISO UTC", () => {
    expect(horizonsDateToIso("2026-Nov-14 03:00")).toBe("2026-11-14T03:00:00.000Z");
    expect(horizonsDateToIso("2028-Feb-29 23:59:30")).toBe("2028-02-29T23:59:30.000Z");
  });
  it("throws on anything else", () => {
    expect(() => horizonsDateToIso("14/11/2026")).toThrow(HorizonsError);
  });
});

describe("sample capture script and app request builder", () => {
  it("send identical Horizons parameters", () => {
    expect(buildHorizonsParams(sunSample.meta.request as HorizonsRequest)).toEqual(sunSample.meta.params);
    expect(buildHorizonsParams(earthSample.meta.request as HorizonsRequest)).toEqual(earthSample.meta.params);
  });
});
