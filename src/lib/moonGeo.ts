/**
 * Geometry helpers for the Moon views (globe and terrain close-ups).
 *
 * VISUAL CONTEXT ONLY. Nothing here feeds the visibility calculations, which use NASA/JPL
 * Horizons positions over a smooth 1737.4 km sphere (see lib/visibility). These helpers only
 * place site pins on NASA LRO imagery and LOLA elevation so people can see where a site is.
 */
import terrainIndex from "../../public/vision/terrain/index.json";

/** IAU mean lunar radius used by LOLA products and by this app's smooth-sphere model (metres). */
export const MOON_RADIUS_M = 1_737_400;

/** Globe relief exaggeration (vertex displacement and the baked normal map). Stated on the figure. */
export const GLOBE_RELIEF_EXAGGERATION = 6;

/**
 * Unit vector for a selenographic latitude / east longitude, in the frame of three.js
 * `SphereGeometry` with an equirectangular map centred on 0° longitude (u = 0 at 180° W):
 * +y = north pole, 0° E faces +x, 90° E faces −z.
 */
export function latLonToUnit(latDeg: number, lonEastDeg: number): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180;
  const phi = ((lonEastDeg + 180) * Math.PI) / 180;
  return [-Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat)];
}

/** Normalise any east longitude into −180..180 (the maps are centred on 0°). */
export function wrapLon(lonEastDeg: number): number {
  return ((((lonEastDeg + 180) % 360) + 360) % 360) - 180;
}

/**
 * Bilinear sample of an equirectangular grid (row 0 = north edge, pixel-is-area, centred on 0° E).
 * Longitude wraps; latitude clamps at the poles.
 */
export function sampleEquirect(grid: ArrayLike<number>, w: number, h: number, latDeg: number, lonEastDeg: number): number {
  const c = ((wrapLon(lonEastDeg) + 180) / 360) * w - 0.5;
  const r = Math.min(Math.max(((90 - latDeg) / 180) * h - 0.5, 0), h - 1);
  const c0 = Math.floor(c);
  const r0 = Math.floor(r);
  const fc = c - c0;
  const fr = r - r0;
  const r1 = Math.min(r0 + 1, h - 1);
  const cc0 = ((c0 % w) + w) % w;
  const cc1 = (cc0 + 1) % w;
  const at = (rr: number, cc: number) => grid[rr * w + cc];
  return (
    at(r0, cc0) * (1 - fr) * (1 - fc) + at(r0, cc1) * (1 - fr) * fc + at(r1, cc0) * fr * (1 - fc) + at(r1, cc1) * fr * fc
  );
}

/** Great-circle distance between two sites on the reference sphere, in kilometres. */
export function surfaceDistanceKm(a: { latDeg: number; lonEastDeg: number }, b: { latDeg: number; lonEastDeg: number }): number {
  const [ax, ay, az] = latLonToUnit(a.latDeg, a.lonEastDeg);
  const [bx, by, bz] = latLonToUnit(b.latDeg, b.lonEastDeg);
  const dot = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz));
  return (Math.acos(dot) * MOON_RADIUS_M) / 1000;
}

export interface TerrainTileMeta {
  id: string;
  name: string;
  latDeg: number;
  lonEastDeg: number;
  /** Edge length of the square, north-up tile centred on the site (metres). */
  sizeM: number;
  /** Grid is n × n int16 heights in metres above the 1737.4 km sphere, row 0 = north edge. */
  n: number;
  minM: number;
  maxM: number;
  source: string;
  sourceUrl: string;
}

export const TERRAIN_TILES: TerrainTileMeta[] = terrainIndex as TerrainTileMeta[];

/** Close-up tile for a preset site, if one was prepared (custom coordinates have none). */
export function terrainTileFor(presetId: string): TerrainTileMeta | undefined {
  return TERRAIN_TILES.find((t) => t.id === presetId);
}
