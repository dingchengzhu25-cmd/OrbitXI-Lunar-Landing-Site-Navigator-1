export type SiteKind = "historical" | "verification" | "south-pole-candidate" | "south-pole-regional-reference";

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
  note: "NOT a lunar south-pole landing candidate. Assumed height: 0 km (the source lists no height).",
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

const ACD_50044 = {
  sourceUrl: "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf",
  note:
    "Centre of a named region polygon in a 2023 NASA reference table. NOT an exact landing point and NOT a NASA-approved landing site. " +
    "Assumed height: 0 km (the table gives no height). The table's frame and longitude convention have not yet been confirmed against the frame Horizons uses.",
} as const;

/** A row of Table A2-2. Coordinates are entered exactly as printed. */
const regionalReference = (id: string, region: string, tableId: string, latDeg: number, lonEastDeg: number): SitePreset => ({
  id,
  name: `${region} — NASA 2023 regional reference point`,
  lonEastDeg,
  latDeg,
  altKm: 0,
  kind: "south-pole-regional-reference",
  source: `NASA Artemis Campaign Development, Lunar Surface Data Book, ACD-50044 Rev A (2023), Appendix A2, Table A2-2, ${tableId}`,
  ...ACD_50044,
});

/**
 * South-pole regional reference points. Kept in their own array so the feature is removed by
 * emptying it (see docs/south-pole-reference-plan.md).
 */
export const REGIONAL_REFERENCE_PRESETS: SitePreset[] = [
  regionalReference("nobile-rim-1-reference", "Nobile Rim 1", "R06 / Site06", -85.4381, 37.36667),
  regionalReference("malapert-massif-reference", "Malapert Massif", "R23 / Site23", -85.9948, -0.23578),
];

/**
 * Preset sites. Coordinates are copied from the cited page (read 2026-11-14), never
 * estimated. Lunar south-pole candidates are added only once the team supplies
 * coordinates with a citable source (see DATA_SOURCES.md).
 */
export const SITE_PRESETS: SitePreset[] = [
  ...REGIONAL_REFERENCE_PRESETS,
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
    note: "NOT a lunar south-pole landing candidate, and not a landing site. Height 0 km is part of the Horizons example.",
  },
];

export const KIND_LABEL: Record<SiteKind, string> = {
  historical: "historical landing site — NOT a lunar south-pole landing candidate",
  verification: "technical verification example — NOT a lunar south-pole landing candidate",
  "south-pole-candidate": "lunar south-pole candidate",
  "south-pole-regional-reference":
    "NASA 2023 regional reference point — NOT a NASA-approved landing site; geometric model only, no terrain",
};

/** Selector groups, in display order. South-pole candidates lead once any exist. */
export const SITE_GROUPS: { kind: SiteKind; title: string }[] = [
  { kind: "south-pole-candidate", title: "South Pole Candidates" },
  { kind: "south-pole-regional-reference", title: "South Pole Region Reference Points — NASA 2023 Reference Polygons" },
  { kind: "historical", title: "Historical Landing Sites — Validation Examples" },
  { kind: "verification", title: "Technical Verification" },
];

export function presetsByGroup(presets: SitePreset[] = SITE_PRESETS): { title: string; kind: SiteKind; presets: SitePreset[] }[] {
  return SITE_GROUPS.map((g) => ({ ...g, presets: presets.filter((p) => p.kind === g.kind) })).filter(
    (g) => g.presets.length > 0,
  );
}

export function hasRegionalReferences(presets: SitePreset[] = SITE_PRESETS): boolean {
  return presets.some((p) => p.kind === "south-pole-regional-reference");
}

export function hasSouthPoleCandidates(presets: SitePreset[] = SITE_PRESETS): boolean {
  return presets.some((p) => p.kind === "south-pole-candidate");
}

/**
 * Default Site A / Site B. South-pole candidates take over as soon as two are present;
 * until then the demo uses two documented historical sites. Regional reference points
 * are never chosen by default: the user has to pick them and read their label.
 */
export function defaultSiteIds(presets: SitePreset[] = SITE_PRESETS): [string, string] {
  const candidates = presets.filter((p) => p.kind === "south-pole-candidate");
  if (candidates.length >= 2) return [candidates[0].id, candidates[1].id];
  const historical = presets.filter((p) => p.kind === "historical");
  if (candidates.length === 1 && historical.length >= 1) return [candidates[0].id, historical[0].id];
  if (historical.length >= 2) return [historical[0].id, historical[historical.length - 1].id];
  const rest = presets.filter((p) => p.kind !== "south-pole-regional-reference");
  return [rest[0].id, rest[rest.length - 1].id];
}

export function findPreset(id: string): SitePreset | undefined {
  return SITE_PRESETS.find((s) => s.id === id);
}
