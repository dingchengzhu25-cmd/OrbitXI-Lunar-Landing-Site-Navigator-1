export type SiteKind = "historical" | "verification" | "south-pole-candidate";

export interface SitePreset {
  id: string;
  name: string;
  /** Longitude exactly as printed by the source (east-positive; may be negative). */
  lonEastDeg: number;
  latDeg: number;
  /** Height above the 1737.4 km sphere. 0 where the source gives none (an assumption). */
  altKm: number;
  kind: SiteKind;
  /** Where the coordinates come from. Every preset must have one. */
  source: string;
  sourceUrl: string;
  note: string;
}

const NSSDCA = {
  source:
    "NASA NSSDCA, “Apollo Landing Site Coordinates” (Mean Earth/Polar Axis frame, DE421; from LRO images, Wagner et al. 2017)",
  sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
  note: "Historical landing site, not a south-pole candidate. Height set to 0 km: the source lists no height.",
} as const;

const apollo = (n: number, latDeg: number, lonEastDeg: number): SitePreset => ({
  id: `apollo${n}`,
  name: `Apollo ${n} Lunar Module`,
  lonEastDeg,
  latDeg,
  altKm: 0,
  kind: "historical",
  ...NSSDCA,
});

/**
 * Preset sites. Coordinates are copied from the cited page (read 2026-11-14), never
 * estimated. Lunar south-pole candidates are added only once the team supplies
 * coordinates with a citable source (see DATA_SOURCES.md).
 */
export const SITE_PRESETS: SitePreset[] = [
  apollo(11, 0.67416, 23.47314),
  apollo(12, -3.0128, -23.4219),
  apollo(14, -3.64589, -17.47194),
  apollo(15, 26.13239, 3.6333),
  apollo(16, -8.9734, 15.5011),
  apollo(17, 20.1911, 30.7723),
  {
    id: "tycho-example",
    name: "Tycho crater (Horizons manual example)",
    lonEastDeg: 348.8,
    latDeg: -43.3,
    altKm: 0,
    kind: "verification",
    source: "JPL Horizons manual, surface-site example “g: 348.8, -43.3, 0 @ 301”",
    sourceUrl: "https://ssd.jpl.nasa.gov/horizons/manual.html",
    note: "Technical verification site only. Not a landing site or candidate.",
  },
];

export const KIND_LABEL: Record<SiteKind, string> = {
  historical: "historical landing site — not a south-pole candidate",
  verification: "technical verification site — not a landing candidate",
  "south-pole-candidate": "south-pole candidate",
};

export function findPreset(id: string): SitePreset | undefined {
  return SITE_PRESETS.find((s) => s.id === id);
}
