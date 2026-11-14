import { normaliseEastLongitude } from "./horizons/request";
import type { EphemerisResponse, TargetBody } from "./horizons/types";
import { assertMatchesRequest } from "./horizons/verify";

/** The location a series is expected to describe, in Horizons conventions. */
export interface ExpectedSite {
  lonEastDeg: number;
  latDeg: number;
  altKm: number;
}

export type SeriesState =
  | { status: "ok"; data: EphemerisResponse }
  | { status: "error"; message: string };

export interface SiteLoad {
  sun: SeriesState;
  earth: SeriesState;
}

export type SeriesFetcher = (siteIndex: 0 | 1, body: TargetBody) => Promise<EphemerisResponse>;

/** Parses user-entered coordinates; null when they are not numbers (the server will reject them). */
export function expectedSiteFrom(lon: string, lat: string, alt: string): ExpectedSite | null {
  const values = [lon, lat, alt].map((s) => (s.trim() === "" ? NaN : Number(s)));
  if (values.some((v) => !Number.isFinite(v))) return null;
  return { lonEastDeg: normaliseEastLongitude(values[0]), latDeg: values[1], altKm: values[2] };
}

/**
 * Checks, in the browser, that a returned series really is the body and place the user
 * asked for. Returns a problem description, or null when the series can be shown.
 */
export function checkSeries(data: EphemerisResponse, body: TargetBody, site: ExpectedSite | null): string | null {
  if (!data || !Array.isArray(data.points) || data.points.length === 0) {
    return "The response contained no elevation samples.";
  }
  if (data.request?.target !== body) {
    return `Expected ${body} data but received "${data.request?.target ?? "unknown"}".`;
  }
  try {
    assertMatchesRequest(data, data.request);
  } catch (err) {
    return err instanceof Error ? err.message : "The data does not match its own request.";
  }
  if (
    site &&
    (Math.abs(data.request.lonEastDeg - site.lonEastDeg) > 1e-6 ||
      Math.abs(data.request.latDeg - site.latDeg) > 1e-6 ||
      Math.abs(data.request.altKm - site.altKm) > 1e-6)
  ) {
    return "The data returned is for a different location than the one selected.";
  }
  return null;
}

async function loadSeries(
  fetcher: SeriesFetcher,
  siteIndex: 0 | 1,
  body: TargetBody,
  site: ExpectedSite | null,
): Promise<SeriesState> {
  try {
    const data = await fetcher(siteIndex, body);
    const problem = checkSeries(data, body, site);
    return problem ? { status: "error", message: problem } : { status: "ok", data };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Unknown error." };
  }
}

/**
 * Loads the four series of a two-site comparison. Each series succeeds or fails on its
 * own, so one failure never hides, or is hidden by, the others. The two sites load in
 * parallel while each site's Sun and Earth queries run one after the other, so a browser
 * sends at most two requests at a time.
 */
export async function loadComparison(
  fetcher: SeriesFetcher,
  expected: [ExpectedSite | null, ExpectedSite | null],
): Promise<[SiteLoad, SiteLoad]> {
  const loadSite = async (i: 0 | 1): Promise<SiteLoad> => {
    const sun = await loadSeries(fetcher, i, "sun", expected[i]);
    const earth = await loadSeries(fetcher, i, "earth", expected[i]);
    return { sun, earth };
  };
  return Promise.all([loadSite(0), loadSite(1)]);
}

export interface LoadSummary {
  total: number;
  loaded: number;
  failures: { site: "A" | "B"; body: "Sun" | "Earth"; message: string }[];
}

export function summariseLoad(sites: [SiteLoad, SiteLoad]): LoadSummary {
  const failures: LoadSummary["failures"] = [];
  sites.forEach((s, i) => {
    for (const [body, state] of [["Sun", s.sun], ["Earth", s.earth]] as const) {
      if (state.status === "error") failures.push({ site: i === 0 ? "A" : "B", body, message: state.message });
    }
  });
  return { total: 4, loaded: 4 - failures.length, failures };
}

/** Elevation points of a loaded series, or null when it failed. */
export const pointsOf = (s: SeriesState) => (s.status === "ok" ? s.data.points : null);
