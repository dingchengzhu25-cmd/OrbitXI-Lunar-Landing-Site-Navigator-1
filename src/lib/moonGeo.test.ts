import { describe, expect, it } from "vitest";
import { SphereGeometry } from "three";
import { latLonToUnit, sampleEquirect, surfaceDistanceKm, TERRAIN_TILES, terrainTileFor, wrapLon } from "./moonGeo";
import { SITE_PRESETS } from "./sites";

describe("latLonToUnit", () => {
  it("puts the poles and the 0° meridian where the map puts them", () => {
    expect(latLonToUnit(90, 0)[1]).toBeCloseTo(1);
    expect(latLonToUnit(-90, 123)[1]).toBeCloseTo(-1);
    const [x, y, z] = latLonToUnit(0, 0);
    expect([x, y, z].map((v) => +v.toFixed(9))).toEqual([1, 0, 0]);
  });

  it("matches three.js SphereGeometry vertices at the same texture coordinate", () => {
    // If pins and texture disagreed, a pin would sit on the wrong crater. Check every vertex.
    const g = new SphereGeometry(1, 36, 18);
    const pos = g.getAttribute("position");
    const uv = g.getAttribute("uv");
    for (let i = 0; i < pos.count; i++) {
      const lon = uv.getX(i) * 360 - 180;
      const lat = uv.getY(i) * 180 - 90;
      if (Math.abs(lat) > 89.999) continue; // longitude is undefined at the poles
      const [x, y, z] = latLonToUnit(lat, lon);
      expect(x).toBeCloseTo(pos.getX(i), 6);
      expect(y).toBeCloseTo(pos.getY(i), 6);
      expect(z).toBeCloseTo(pos.getZ(i), 6);
    }
  });
});

describe("sampleEquirect", () => {
  it("wraps longitude and interpolates between pixel centres", () => {
    // 4 x 2 grid: columns centred on -135, -45, 45, 135 E; rows on +45 and -45.
    const g = [0, 10, 20, 30, 100, 110, 120, 130];
    expect(sampleEquirect(g, 4, 2, 45, -135)).toBeCloseTo(0);
    expect(sampleEquirect(g, 4, 2, 45, 0)).toBeCloseTo(15);
    expect(sampleEquirect(g, 4, 2, 0, -45)).toBeCloseTo(60);
    expect(sampleEquirect(g, 4, 2, 45, 180)).toBeCloseTo(15); // between 135 E and wrapped -135 E
    expect(sampleEquirect(g, 4, 2, 45, 360 - 135)).toBeCloseTo(0);
  });

  it("normalises east longitudes the way the site form allows them (−180..360)", () => {
    expect(wrapLon(348.8)).toBeCloseTo(-11.2);
    expect(wrapLon(-180)).toBe(-180);
    expect(wrapLon(360)).toBe(0);
  });
});

describe("terrain tiles", () => {
  it("exist for every preset site, centred on exactly the preset's coordinates", () => {
    for (const p of SITE_PRESETS) {
      const t = terrainTileFor(p.id);
      expect(t, p.id).toBeDefined();
      expect(t!.latDeg).toBe(p.latDeg);
      expect(t!.lonEastDeg).toBe(p.lonEastDeg);
    }
    expect(TERRAIN_TILES).toHaveLength(SITE_PRESETS.length);
  });

  it("states a NASA source for every tile", () => {
    for (const t of TERRAIN_TILES) {
      expect(t.source).toMatch(/LOLA/);
      expect(t.sourceUrl).toMatch(/^https:\/\/(pgda|svs)\.gsfc\.nasa\.gov\//);
    }
  });
});

describe("surfaceDistanceKm", () => {
  it("measures great-circle distance on the 1737.4 km sphere", () => {
    expect(surfaceDistanceKm({ latDeg: 0, lonEastDeg: 0 }, { latDeg: 0, lonEastDeg: 90 })).toBeCloseTo((Math.PI / 2) * 1737.4, 3);
    expect(surfaceDistanceKm({ latDeg: -90, lonEastDeg: 0 }, { latDeg: -90, lonEastDeg: 170 })).toBeCloseTo(0, 6);
  });
});
