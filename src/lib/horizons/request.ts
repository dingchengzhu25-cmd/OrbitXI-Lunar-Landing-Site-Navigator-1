import type { HorizonsRequest, TargetBody } from "./types";

export const HORIZONS_API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";

/** Horizons major-body IDs. */
export const TARGET_COMMAND: Record<TargetBody, string> = {
  sun: "10",
  earth: "399",
};

/** App-level limits that keep single requests small and polite. */
export const LIMITS = {
  minStepMinutes: 10,
  maxStepMinutes: 1440,
  maxSpanDays: 62,
  maxPoints: 2000,
  minYear: 1950,
  maxYear: 2100,
  minAltKm: -10,
  maxAltKm: 20,
} as const;

export type ValidationResult =
  | { ok: true; value: HorizonsRequest }
  | { ok: false; message: string };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/;

/** Parses "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" as UT. Returns epoch ms or null. */
export function parseUtInput(text: string): number | null {
  const m = DATE_RE.exec(text.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? "00", m[5] ?? "00"].map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  const back = new Date(ms);
  // Reject impossible dates such as 2026-02-31, which Date.UTC silently rolls over.
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d ||
    back.getUTCHours() !== h ||
    back.getUTCMinutes() !== mi
  ) {
    return null;
  }
  return ms;
}

export function formatUt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
}

/**
 * Maps -180..360 onto 0..360 east. Values already in range pass through untouched,
 * and the shifted case is rounded to 1e-9 deg so no binary noise reaches Horizons.
 */
export function normaliseEastLongitude(lon: number): number {
  if (lon >= 0 && lon < 360) return lon;
  if (lon === 360) return 0;
  return Math.round((lon + 360) * 1e9) / 1e9;
}

function num(text: string | null): number | null {
  if (text === null || text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Validates raw query parameters. Never throws; returns a readable message. */
export function validateQuery(params: URLSearchParams): ValidationResult {
  const target = params.get("target") ?? "sun";
  if (target !== "sun" && target !== "earth") {
    return { ok: false, message: 'target must be "sun" or "earth".' };
  }

  const lon = num(params.get("lon"));
  if (lon === null || lon < -180 || lon > 360) {
    return { ok: false, message: "lon (east longitude, degrees) must be between -180 and 360." };
  }
  const lat = num(params.get("lat"));
  if (lat === null || lat < -90 || lat > 90) {
    return { ok: false, message: "lat (degrees) must be between -90 and 90." };
  }
  const alt = num(params.get("alt") ?? "0");
  if (alt === null || alt < LIMITS.minAltKm || alt > LIMITS.maxAltKm) {
    return {
      ok: false,
      message: `alt (km above the reference sphere) must be between ${LIMITS.minAltKm} and ${LIMITS.maxAltKm}.`,
    };
  }

  const startMs = parseUtInput(params.get("start") ?? "");
  const stopMs = parseUtInput(params.get("stop") ?? "");
  if (startMs === null || stopMs === null) {
    return { ok: false, message: "start and stop must be UT dates like 2026-11-14 or 2026-11-14T06:00." };
  }
  for (const ms of [startMs, stopMs]) {
    const year = new Date(ms).getUTCFullYear();
    if (year < LIMITS.minYear || year > LIMITS.maxYear) {
      return { ok: false, message: `Dates must fall between ${LIMITS.minYear} and ${LIMITS.maxYear}.` };
    }
  }
  if (stopMs <= startMs) {
    return { ok: false, message: "stop must be later than start." };
  }

  const step = num(params.get("stepMin") ?? "60");
  if (
    step === null ||
    !Number.isInteger(step) ||
    step < LIMITS.minStepMinutes ||
    step > LIMITS.maxStepMinutes
  ) {
    return {
      ok: false,
      message: `stepMin must be a whole number of minutes between ${LIMITS.minStepMinutes} and ${LIMITS.maxStepMinutes}.`,
    };
  }

  const spanMinutes = (stopMs - startMs) / 60000;
  if (spanMinutes > LIMITS.maxSpanDays * 1440) {
    return { ok: false, message: `The date range may not exceed ${LIMITS.maxSpanDays} days.` };
  }
  const points = Math.floor(spanMinutes / step) + 1;
  if (points < 2) {
    return { ok: false, message: "The range must contain at least two time steps." };
  }
  if (points > LIMITS.maxPoints) {
    return {
      ok: false,
      message: `This range and step would return ${points} rows; the limit is ${LIMITS.maxPoints}. Use a larger step or a shorter range.`,
    };
  }

  return {
    ok: true,
    value: {
      target,
      lonEastDeg: normaliseEastLongitude(lon),
      latDeg: lat,
      altKm: alt,
      startUt: formatUt(startMs),
      stopUt: formatUt(stopMs),
      stepMinutes: step,
    },
  };
}

/**
 * Horizons parameters for an observer table at a Moon-surface site.
 * This exact combination was tested against the live API on 2026-11-14
 * (see DATA_SOURCES.md).
 */
export function buildHorizonsParams(req: HorizonsRequest): Record<string, string> {
  return {
    format: "json",
    COMMAND: `'${TARGET_COMMAND[req.target]}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${req.lonEastDeg},${req.latDeg},${req.altKm}'`,
    START_TIME: `'${req.startUt}'`,
    STOP_TIME: `'${req.stopUt}'`,
    STEP_SIZE: `'${req.stepMinutes}m'`,
    QUANTITIES: "'4'",
    TIME_TYPE: "'UT'",
    CSV_FORMAT: "'YES'",
  };
}

export function buildHorizonsUrl(req: HorizonsRequest): string {
  const qs = new URLSearchParams(buildHorizonsParams(req));
  return `${HORIZONS_API_URL}?${qs.toString()}`;
}
