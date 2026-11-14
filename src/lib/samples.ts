import { assertMatchesRequest } from "./horizons/verify";
import { parseHorizonsObserverJson } from "./horizons/parse";
import type { EphemerisResponse, HorizonsRequest } from "./horizons/types";
import apollo11Earth from "@/data/samples/apollo11-earth-2026-11-14_30d_60m.json";
import apollo11Sun from "@/data/samples/apollo11-sun-2026-11-14_30d_60m.json";
import apollo17Earth from "@/data/samples/apollo17-earth-2026-11-14_30d_60m.json";
import apollo17Sun from "@/data/samples/apollo17-sun-2026-11-14_30d_60m.json";
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
 * Keys are "<site preset id>-<sun|earth>".
 */
const SAMPLES: Record<string, StoredSample> = {
  "apollo11-sun": apollo11Sun as StoredSample,
  "apollo11-earth": apollo11Earth as StoredSample,
  "apollo17-sun": apollo17Sun as StoredSample,
  "apollo17-earth": apollo17Earth as StoredSample,
  "tycho-example-sun": tychoSun as StoredSample,
  "tycho-example-earth": tychoEarth as StoredSample,
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
