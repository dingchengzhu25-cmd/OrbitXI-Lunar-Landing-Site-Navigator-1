import { parseHorizonsObserverJson } from "./parse";
import { buildHorizonsUrl, TARGET_COMMAND } from "./request";
import { HorizonsError, type EphemerisResponse, type HorizonsRequest, type ParsedEphemeris } from "./types";

const TIMEOUT_MS = 20_000;

/**
 * Confirms that the table Horizons produced is for the body and site we asked for.
 * Guards against silently charting a different target or location.
 */
export function assertMatchesRequest(parsed: ParsedEphemeris, req: HorizonsRequest): void {
  const { meta } = parsed;
  if (!meta.targetBody?.includes(`(${TARGET_COMMAND[req.target]})`)) {
    throw new HorizonsError("HORIZONS_MISMATCH", `Horizons returned target "${meta.targetBody}", not the requested body.`);
  }
  if (!meta.centerBody?.includes("(301)")) {
    throw new HorizonsError("HORIZONS_MISMATCH", `Horizons observer centre is "${meta.centerBody}", not the Moon.`);
  }
  const geo = meta.centerGeodetic;
  if (
    !geo ||
    Math.abs(geo.lonEastDeg - req.lonEastDeg) > 1e-4 ||
    Math.abs(geo.latDeg - req.latDeg) > 1e-4 ||
    Math.abs(geo.altKm - req.altKm) > 1e-4
  ) {
    throw new HorizonsError("HORIZONS_MISMATCH", "Horizons site coordinates do not match the request.");
  }
  if (!meta.centerFrameNote?.toLowerCase().includes("east-longitude positive")) {
    throw new HorizonsError("HORIZONS_MISMATCH", "Horizons did not confirm an east-positive longitude convention.");
  }
}

/** Fetches and validates a live observer table from NASA/JPL Horizons. Server-side only. */
export async function fetchHorizonsEphemeris(req: HorizonsRequest): Promise<EphemerisResponse> {
  const horizonsUrl = buildHorizonsUrl(req);

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
