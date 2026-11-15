import { normaliseEastLongitude } from "./horizons/request";

const MINUS = "\u2212";

/**
 * Longitude written so its direction cannot be misread. Input is the signed
 * east-positive value exactly as entered or as printed by the source.
 *   37.36667  -> "37.36667° E"
 *   -0.23578  -> "0.23578° W (−0.23578° in signed east longitude; 359.76422° E)"
 *   348.8     -> "348.8° E (11.2° W)"
 * The digits of the source value are kept; nothing is rounded.
 */
export function describeLongitude(text: string): string {
  const raw = text.trim();
  const value = Number(raw);
  if (raw === "" || !Number.isFinite(value) || value < -180 || value > 360) return `${raw}° (not a valid longitude)`;
  if (value < 0) {
    const magnitude = raw.replace(/^-/, "");
    return `${magnitude}° W (${MINUS}${magnitude}° in signed east longitude; ${normaliseEastLongitude(value)}° E)`;
  }
  if (value > 180 && value < 360) {
    return `${raw}° E (${Math.round((360 - value) * 1e9) / 1e9}° W)`;
  }
  return `${raw}° E`;
}
