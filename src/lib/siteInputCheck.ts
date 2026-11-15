import { LIMITS } from "./horizons/request";

/**
 * Form-side checks for one site's coordinates, so out-of-range values are explained
 * next to the field and never sent. The ranges are the same ones the server enforces in
 * `validateQuery` (request.ts): east longitude -180..360, latitude -90..90, height
 * LIMITS.minAltKm..LIMITS.maxAltKm. This adds no new rule; it only reports it earlier.
 */
export interface SiteFieldErrors {
  lon?: string;
  lat?: string;
  alt?: string;
}

const num = (text: string): number | null => {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

export function checkSiteInput(lon: string, lat: string, alt: string): SiteFieldErrors {
  const errors: SiteFieldErrors = {};
  const lo = num(lon);
  if (lo === null) errors.lon = "Enter an east longitude in degrees.";
  else if (lo < -180 || lo > 360) errors.lon = "East longitude must be between −180° and 360°.";

  const la = num(lat);
  if (la === null) errors.lat = "Enter a latitude in degrees.";
  else if (la < -90 || la > 90) errors.lat = "Latitude must be between −90° and 90°.";

  const al = num(alt);
  if (al === null) errors.alt = "Enter a height in kilometres (0 if unknown).";
  else if (al < LIMITS.minAltKm || al > LIMITS.maxAltKm) {
    errors.alt = `Height must be between ${LIMITS.minAltKm} and ${LIMITS.maxAltKm} km.`;
  }
  return errors;
}

export const errorCount = (e: SiteFieldErrors): number => Object.values(e).filter(Boolean).length;
