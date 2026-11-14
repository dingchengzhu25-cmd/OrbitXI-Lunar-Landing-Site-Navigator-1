import { assertMatchesRequest } from "./horizons/client";
import { parseHorizonsObserverJson } from "./horizons/parse";
import type { EphemerisResponse, HorizonsRequest } from "./horizons/types";
import tychoEarth from "@/data/samples/tycho-earth-2026-11-14_30d_60m.json";
import tychoSun from "@/data/samples/tycho-sun-2026-11-14_30d_60m.json";

interface StoredSample {
  meta: {
    siteLabel: string;
    request: HorizonsRequest;
    horizonsUrl: string;
    httpStatus: number;
    retrievedAtUtc: string;
  };
  response: unknown;
}

/**
 * Real Horizons responses saved by scripts/fetch-sample.mjs. They are stored
 * unmodified and go through the same parser and checks as live data.
 */
const SAMPLES: Record<string, StoredSample> = {
  "tycho-sun": tychoSun as StoredSample,
  "tycho-earth": tychoEarth as StoredSample,
};

export const SAMPLE_IDS = Object.keys(SAMPLES);

export function loadSample(id: string): EphemerisResponse | null {
  const sample = SAMPLES[id];
  if (!sample) return null;
  const parsed = parseHorizonsObserverJson(sample.response);
  assertMatchesRequest(parsed, sample.meta.request);
  return {
    source: "archive",
    retrievedAtUtc: sample.meta.retrievedAtUtc,
    request: sample.meta.request,
    horizonsUrl: sample.meta.horizonsUrl,
    archiveNote: `Archived NASA/JPL Horizons response for: ${sample.meta.siteLabel}`,
    ...parsed,
  };
}
