import { describe, expect, it } from "vitest";
import { checkSeries, expectedSiteFrom, loadComparison, pointsOf, summariseLoad, type SeriesFetcher } from "./comparison";
import type { EphemerisResponse, TargetBody } from "./horizons/types";
import { loadSample } from "./samples";

// Real archived Horizons responses stand in for the network.
const sample = (id: string): EphemerisResponse => {
  const s = loadSample(id);
  if (!s) throw new Error(`missing sample ${id}`);
  return s;
};
const SITE_IDS = ["apollo11", "apollo17"] as const;
const goodFetcher: SeriesFetcher = async (i, body) => sample(`${SITE_IDS[i]}-${body}`);
const A11 = { lonEastDeg: 23.47314, latDeg: 0.67416, altKm: 0 };
const A17 = { lonEastDeg: 30.7723, latDeg: 20.1911, altKm: 0 };

describe("loadComparison", () => {
  it("loads all four series when everything succeeds", async () => {
    const sites = await loadComparison(goodFetcher, [A11, A17]);
    expect(summariseLoad(sites)).toEqual({ total: 4, loaded: 4, failures: [] });
    expect(pointsOf(sites[0].sun)).toHaveLength(721);
    expect(sites[1].earth.status === "ok" && sites[1].earth.data.meta.targetBody).toBe("Earth (399)");
  });

  it("keeps the other three series when one query fails, and names the failure", async () => {
    const fetcher: SeriesFetcher = async (i, body) => {
      if (i === 1 && body === "earth") throw new Error("NASA/JPL Horizons is busy (HTTP 503).");
      return goodFetcher(i, body);
    };
    const sites = await loadComparison(fetcher, [A11, A17]);
    const summary = summariseLoad(sites);
    expect(summary.loaded).toBe(3);
    expect(summary.failures).toEqual([{ site: "B", body: "Earth", message: "NASA/JPL Horizons is busy (HTTP 503)." }]);
    expect(sites[1].sun.status).toBe("ok");
    expect(pointsOf(sites[1].earth)).toBeNull();
  });

  it("reports every failure when all queries fail", async () => {
    const sites = await loadComparison(async () => Promise.reject(new Error("offline")), [A11, A17]);
    expect(summariseLoad(sites).failures).toHaveLength(4);
  });

  it("rejects a series that is for the wrong body", async () => {
    const swapped: SeriesFetcher = async (i, body) => goodFetcher(i, body === "sun" ? "earth" : "sun");
    const sites = await loadComparison(swapped, [A11, A17]);
    expect(summariseLoad(sites).loaded).toBe(0);
    expect(sites[0].sun).toMatchObject({ status: "error", message: expect.stringMatching(/Expected sun data/) });
  });

  it("rejects a series that is for a different location than selected", async () => {
    // Site B asks for Apollo 17 but receives Apollo 11 data.
    const wrongSite: SeriesFetcher = async (_i, body) => goodFetcher(0, body);
    const sites = await loadComparison(wrongSite, [A11, A17]);
    expect(sites[0].sun.status).toBe("ok");
    expect(sites[1].sun).toMatchObject({ status: "error", message: expect.stringMatching(/different location/) });
  });

  it("sends at most two requests at a time, Sun before Earth for each site", async () => {
    let active = 0;
    let peak = 0;
    const order: string[] = [];
    const fetcher: SeriesFetcher = async (i, body: TargetBody) => {
      active++;
      peak = Math.max(peak, active);
      order.push(`${i}-${body}`);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return goodFetcher(i, body);
    };
    await loadComparison(fetcher, [A11, A17]);
    expect(peak).toBe(2);
    expect(order.indexOf("0-sun")).toBeLessThan(order.indexOf("0-earth"));
    expect(order.indexOf("1-sun")).toBeLessThan(order.indexOf("1-earth"));
  });
});

describe("checkSeries", () => {
  it("accepts a matching series", () => {
    expect(checkSeries(sample("apollo11-sun"), "sun", A11)).toBeNull();
  });

  it("rejects data whose header disagrees with its own request", () => {
    const tampered = { ...sample("apollo11-sun"), request: { ...sample("apollo11-sun").request, latDeg: -89 } };
    expect(checkSeries(tampered, "sun", null)).toMatch(/do not match/);
  });

  it("rejects an empty series", () => {
    expect(checkSeries({ ...sample("apollo11-sun"), points: [] }, "sun", A11)).toMatch(/no elevation samples/);
  });
});

describe("expectedSiteFrom", () => {
  it("normalises west-negative longitude like the server does", () => {
    expect(expectedSiteFrom("-23.4219", "-3.0128", "0")).toEqual({ lonEastDeg: 336.5781, latDeg: -3.0128, altKm: 0 });
  });
  it("returns null for non-numeric input", () => {
    expect(expectedSiteFrom("abc", "1", "0")).toBeNull();
    expect(expectedSiteFrom("", "1", "0")).toBeNull();
  });
});
