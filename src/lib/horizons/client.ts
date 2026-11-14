import { BoundedTtlCache, Coalescer, Semaphore } from "./cache";
import { parseHorizonsObserverJson } from "./parse";
import { buildHorizonsUrl } from "./request";
import { HorizonsError, type EphemerisResponse, type HorizonsRequest } from "./types";
import { assertMatchesRequest } from "./verify";

export { assertMatchesRequest };

export const TIMEOUT_MS = 20_000;

/**
 * Cache lifetime: 6 hours. Ephemerides for a fixed site and time range are effectively
 * stable (JPL may revise Earth-orientation predictions slightly), and a hackathon demo
 * repeats the same few queries. Every cached entry keeps its original retrieval time.
 */
export const CACHE_TTL_MS = 6 * 3_600_000;
export const CACHE_MAX_ENTRIES = 200;
/** Horizons publishes no rate limit, so keep outbound traffic from one instance small. */
export const MAX_CONCURRENT_HORIZONS_REQUESTS = 2;

// Keyed by the exact Horizons URL, which is built from the validated, normalised request.
const cache = new BoundedTtlCache<EphemerisResponse>(CACHE_TTL_MS, CACHE_MAX_ENTRIES);
const coalescer = new Coalescer<EphemerisResponse>();
const outbound = new Semaphore(MAX_CONCURRENT_HORIZONS_REQUESTS);

/** For tests only. */
export function resetHorizonsClientState(): void {
  cache.clear();
}

async function fetchLive(req: HorizonsRequest, horizonsUrl: string): Promise<EphemerisResponse> {
  let res: Response;
  try {
    res = await fetch(horizonsUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new HorizonsError(
        "HORIZONS_TIMEOUT",
        `NASA/JPL Horizons did not answer within ${TIMEOUT_MS / 1000} seconds. Please try again shortly.`,
      );
    }
    throw new HorizonsError("HORIZONS_UNREACHABLE", "Could not reach NASA/JPL Horizons. Check the network and try again.");
  }

  if (!res.ok) {
    throw new HorizonsError(
      "HORIZONS_HTTP",
      res.status === 503
        ? "NASA/JPL Horizons is busy (HTTP 503). Please wait a moment and try again."
        : `NASA/JPL Horizons answered with HTTP ${res.status}.`,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new HorizonsError("HORIZONS_UNEXPECTED_FORMAT", "NASA/JPL Horizons returned a reply that is not valid JSON.");
  }

  const parsed = parseHorizonsObserverJson(body);
  assertMatchesRequest(parsed, req);

  return {
    source: "live",
    retrievedAtUtc: new Date().toISOString(),
    request: req,
    horizonsUrl,
    ...parsed,
  };
}

/**
 * Returns a validated observer table from NASA/JPL Horizons. Server-side only.
 *
 * - A fresh retrieval is labelled source "live".
 * - A response reused from this instance's memory is labelled "cached" and keeps the
 *   retrieval time of the original live query.
 * - Identical requests arriving while one is in flight share that single request.
 * - Failures are never cached and never replaced with other data.
 */
export async function fetchHorizonsEphemeris(req: HorizonsRequest): Promise<EphemerisResponse> {
  const horizonsUrl = buildHorizonsUrl(req);

  const cached = cache.get(horizonsUrl);
  if (cached) return { ...cached, source: "cached" };

  return coalescer.run(horizonsUrl, () =>
    outbound.run(async () => {
      const value = await fetchLive(req, horizonsUrl);
      cache.set(horizonsUrl, value);
      return value;
    }),
  );
}
