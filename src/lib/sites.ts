export interface SitePreset {
  id: string;
  name: string;
  lonEastDeg: number;
  latDeg: number;
  altKm: number;
  /** Where the coordinates come from. Every preset must have one. */
  source: string;
  sourceUrl: string;
  /** True only for sites vetted as south-pole landing candidates with cited coordinates. */
  isLandingCandidate: boolean;
  note: string;
}

/**
 * Preset sites. Lunar south-pole candidates are added only after the team supplies
 * coordinates with a citable source (see DATA_SOURCES.md). Until then the single
 * preset is the JPL Horizons manual's own example, used to verify the pipeline.
 */
export const SITE_PRESETS: SitePreset[] = [
  {
    id: "tycho-example",
    name: "Tycho crater — Horizons manual example",
    lonEastDeg: 348.8,
    latDeg: -43.3,
    altKm: 0,
    source: "JPL Horizons manual, surface-site example “g: 348.8, -43.3, 0 @ 301”",
    sourceUrl: "https://ssd.jpl.nasa.gov/horizons/manual.html",
    isLandingCandidate: false,
    note: "Technical verification site only. It is not a lunar south-pole landing candidate.",
  },
];
