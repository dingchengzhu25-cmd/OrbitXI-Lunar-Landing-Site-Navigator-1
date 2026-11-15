import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import noMatch from "./__fixtures__/no-match-response.json";
import { fetchHorizonsEphemeris, MAX_CONCURRENT_HORIZONS_REQUESTS, resetHorizonsClientState } from "./client";
import { HorizonsError, type HorizonsRequest } from "./types";
import { GET as ephemerisGET } from "@/app/api/ephemeris/route";
import { GET as sampleGET } from "@/app/api/sample/route";
import a11Sun from "@/data/samples/apollo11-sun-2026-11-14_30d_60m.json";
import a17Sun from "@/data/samples/apollo17-sun-2026-11-14_30d_60m.json";
import { NextRequest } from "next/server";

// The network is replaced by real, archived Horizons bodies; no request leaves the machine.
const REQ = a11Sun.meta.request as HorizonsRequest;
const okBody = () => new Response(JSON.stringify(a11Sun.response), { status: 200 });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  resetHorizonsClientState();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "no error";
  } catch (e) {
    return e instanceof HorizonsError ? e.code : `other: ${String(e)}`;
  }
};

describe("fetchHorizonsEphemeris — success and caching", () => {
  it("labels a fresh retrieval LIVE and requests the exact Horizons URL", async () => {
    fetchMock.mockResolvedValueOnce(okBody());
    const r = await fetchHorizonsEphemeris(REQ);
    expect(r.source).toBe("live");
    expect(r.points).toHaveLength(721);
    expect(String(fetchMock.mock.calls[0][0])).toBe(a11Sun.meta.horizonsUrl);
  });

  it("labels a repeat CACHED, keeps the original retrieval time, and does not call Horizons again", async () => {
    fetchMock.mockResolvedValue(okBody());
    const first = await fetchHorizonsEphemeris(REQ);
    const second = await fetchHorizonsEphemeris({ ...REQ });
    expect(second.source).toBe("cached");
    expect(second.retrievedAtUtc).toBe(first.retrievedAtUtc);
    expect(second.points).toEqual(first.points);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not share a cache entry between requests that differ in any parameter", async () => {
    fetchMock.mockImplementation(async () => okBody());
    await fetchHorizonsEphemeris(REQ);
    await code(fetchHorizonsEphemeris({ ...REQ, stepMinutes: 120 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("coalesces identical requests made at the same moment into one Horizons call", async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(() => new Promise((res) => (release = () => res(okBody()))));
    const both = Promise.all([fetchHorizonsEphemeris(REQ), fetchHorizonsEphemeris(REQ)]);
    await new Promise((r) => setTimeout(r, 0));
    release();
    const [a, b] = await both;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.retrievedAtUtc).toBe(b.retrievedAtUtc);
  });

  it(`sends at most ${MAX_CONCURRENT_HORIZONS_REQUESTS} requests to Horizons at once`, async () => {
    let active = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return new Response(JSON.stringify(noMatch.response), { status: 200 });
    });
    const distinct = [10, 20, 30, 40, 50, 60].map((stepMinutes) => ({ ...REQ, stepMinutes }));
    await Promise.all(distinct.map((r) => code(fetchHorizonsEphemeris(r))));
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(peak).toBe(MAX_CONCURRENT_HORIZONS_REQUESTS);
  });
});

describe("fetchHorizonsEphemeris — failures", () => {
  it("maps a timeout", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    expect(await code(fetchHorizonsEphemeris(REQ))).toBe("HORIZONS_TIMEOUT");
  });

  it("maps a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await code(fetchHorizonsEphemeris(REQ))).toBe("HORIZONS_UNREACHABLE");
  });

  it("maps HTTP 503", async () => {
    fetchMock.mockResolvedValueOnce(new Response("busy", { status: 503 }));
    expect(await code(fetchHorizonsEphemeris(REQ))).toBe("HORIZONS_HTTP");
  });

  it.each([500, 502, 503, 504])("maps upstream HTTP %i to an error and never returns data", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response("upstream error", { status }));
    expect(await code(fetchHorizonsEphemeris(REQ))).toBe("HORIZONS_HTTP");
  });

  it("refuses a valid table that covers a different time grid than requested", async () => {
    fetchMock.mockResolvedValueOnce(okBody());
    expect(await code(fetchHorizonsEphemeris({ ...REQ, stepMinutes: 120 }))).toBe("HORIZONS_MISMATCH");
  });

  it("maps a non-JSON body", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    expect(await code(fetchHorizonsEphemeris(REQ))).toBe("HORIZONS_UNEXPECTED_FORMAT");
  });

  it("maps a real HTTP-200 reply that has no data table", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(noMatch.response), { status: 200 }));
    expect(await code(fetchHorizonsEphemeris(REQ))).toBe("HORIZONS_NO_DATA");
  });

  it("refuses a valid table that is for a different site", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(a17Sun.response), { status: 200 }));
    expect(await code(fetchHorizonsEphemeris(REQ))).toBe("HORIZONS_MISMATCH");
  });

  it("does not cache failures: the next call tries Horizons again", async () => {
    fetchMock.mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(okBody());
    expect(await code(fetchHorizonsEphemeris(REQ))).toBe("HORIZONS_HTTP");
    expect((await fetchHorizonsEphemeris(REQ)).source).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("API routes", () => {
  const url = (qs: string) => new NextRequest(`http://localhost/api/ephemeris?${qs}`);
  const good = "target=sun&lon=23.47314&lat=0.67416&alt=0&start=2026-11-14&stop=2026-12-14&stepMin=60";

  it("GET /api/ephemeris returns data with no HTTP caching", async () => {
    fetchMock.mockResolvedValueOnce(okBody());
    const res = await ephemerisGET(url(good));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json()).source).toBe("live");
  });

  it("GET /api/ephemeris rejects bad input with 400 and never calls Horizons", async () => {
    const res = await ephemerisGET(url("target=sun&lon=abc&lat=0&start=2026-11-14&stop=2026-11-15"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET /api/ephemeris returns 504 on timeout and 502 when Horizons has no data, with a message and no points", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    const timeout = await ephemerisGET(url(good));
    expect(timeout.status).toBe(504);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(noMatch.response), { status: 200 }));
    const noData = await ephemerisGET(url(good));
    expect(noData.status).toBe(502);
    const body = await noData.json();
    expect(body.error.message).toMatch(/no ephemeris table/i);
    expect(body.points).toBeUndefined();
  });

  it.each([502, 503, 504])("GET /api/ephemeris answers 502 with a message and no points when Horizons returns HTTP %i", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response("upstream error", { status }));
    const res = await ephemerisGET(url(good));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("HORIZONS_HTTP");
    expect(body.error.message).toContain(String(status));
    expect(body.points).toBeUndefined();
  });

  it("GET /api/sample serves labelled archives and 404s on unknown ids", async () => {
    const hit = await sampleGET(new NextRequest("http://localhost/api/sample?id=tycho-example-sun"));
    expect((await hit.json()).source).toBe("archive");
    const miss = await sampleGET(new NextRequest("http://localhost/api/sample?id=nope"));
    expect(miss.status).toBe(404);
  });
});
