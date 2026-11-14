import { describe, expect, it } from "vitest";
import {
  defaultSiteIds,
  findPreset,
  hasRegionalReferences,
  hasSouthPoleCandidates,
  KIND_LABEL,
  presetsByGroup,
  REGIONAL_REFERENCE_PRESETS,
  SITE_PRESETS,
  type SitePreset,
} from "./sites";
import { validateQuery } from "./horizons/request";

describe("site presets", () => {
  it("every preset cites a NASA source", () => {
    for (const p of SITE_PRESETS) {
      expect(p.source.length, p.id).toBeGreaterThan(10);
      expect(p.sourceUrl, p.id).toMatch(/^https:\/\/([a-z0-9-]+\.)*nasa\.gov\//);
    }
  });

  it("keeps the six Apollo sites and the Tycho example", () => {
    const ids = SITE_PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["apollo11", "apollo12", "apollo14", "apollo15", "apollo16", "apollo17", "tycho-example"]),
    );
  });

  it("groups Apollo sites as validation examples and Tycho as technical verification", () => {
    const titled = Object.fromEntries(presetsByGroup().map((g) => [g.title, g.presets.map((p) => p.id)]));
    expect(titled["Historical Landing Sites — Validation Examples"]).toHaveLength(6);
    expect(titled["Technical Verification"]).toEqual(["tycho-example"]);
  });

  it("labels every non-candidate as NOT a south-pole landing candidate, in badge and note", () => {
    for (const p of SITE_PRESETS.filter((x) => x.kind === "historical" || x.kind === "verification")) {
      expect(KIND_LABEL[p.kind]).toMatch(/NOT a lunar south-pole landing candidate/);
      expect(p.note).toMatch(/NOT a lunar south-pole landing candidate/);
    }
  });

  it("states the assumed 0 km height for Apollo sites", () => {
    for (const p of SITE_PRESETS.filter((x) => x.kind === "historical")) {
      expect(p.altKm).toBe(0);
      expect(p.note).toMatch(/Assumed height: 0 km/);
    }
  });

  it("never labels a site far from the pole as a south-pole candidate", () => {
    for (const p of SITE_PRESETS.filter((x) => x.kind === "south-pole-candidate")) {
      expect(p.latDeg, p.id).toBeLessThanOrEqual(-80);
    }
  });
});

describe("south-pole regional reference points", () => {
  it("keeps the coordinates exactly as transcribed from NASA ACD-50044 Table A2-2", () => {
    expect(findPreset("nobile-rim-1-reference")).toMatchObject({ latDeg: -85.4381, lonEastDeg: 37.36667, altKm: 0 });
    expect(findPreset("malapert-massif-reference")).toMatchObject({ latDeg: -85.9948, lonEastDeg: -0.23578, altKm: 0 });
    expect(REGIONAL_REFERENCE_PRESETS).toHaveLength(2);
  });

  it("cites the NASA document, table and row for each point", () => {
    for (const p of REGIONAL_REFERENCE_PRESETS) {
      expect(p.sourceUrl).toMatch(/^https:\/\/ntrs\.nasa\.gov\/api\/citations\/20230007818\//);
      expect(p.source).toMatch(/ACD-50044 Rev A \(2023\), Appendix A2, Table A2-2, R\d\d \/ Site\d\d/);
    }
  });

  it("is never called a candidate, an approved site or a landing site without the word NOT", () => {
    expect(hasSouthPoleCandidates()).toBe(false);
    for (const p of REGIONAL_REFERENCE_PRESETS) {
      expect(p.kind).toBe("south-pole-regional-reference");
      expect(p.name).toMatch(/NASA 2023 regional reference point$/);
      expect(p.name).not.toMatch(/candidate|landing|Artemis/i);
      expect(p.note).toMatch(/NOT an exact landing point, NOT a NASA-approved landing site/);
      expect(p.note).toMatch(/not necessarily the centre of a 2024 Artemis III candidate region/);
      expect(KIND_LABEL[p.kind]).toMatch(/NOT a NASA-approved landing site/);
    }
  });

  it("states the assumed height, the unconfirmed frame and the absence of terrain", () => {
    for (const p of REGIONAL_REFERENCE_PRESETS) {
      expect(p.note).toMatch(/Assumed height: 0 km \(the table gives no height\)/);
      expect(p.note).toMatch(/has not been quantified/);
      expect(p.note).toMatch(/Geometric horizon only: no terrain/);
      expect(KIND_LABEL[p.kind]).toMatch(/height assumed 0 km/);
      expect(KIND_LABEL[p.kind]).toMatch(/no terrain/);
    }
  });

  it("has its own selector group, placed first, and is never a default selection", () => {
    expect(hasRegionalReferences()).toBe(true);
    const groups = presetsByGroup();
    expect(groups[0].title).toBe("NASA 2023 Regional Reference Points — Lunar South Pole");
    expect(groups[0].presets.map((p) => p.id)).toEqual(["nobile-rim-1-reference", "malapert-massif-reference"]);
    expect(defaultSiteIds()).toEqual(["apollo11", "apollo17"]);
    expect(defaultSiteIds(REGIONAL_REFERENCE_PRESETS.concat(SITE_PRESETS.filter((p) => p.kind === "verification")))).toEqual([
      "tycho-example",
      "tycho-example",
    ]);
  });

  it("produces a request the server accepts, with the negative longitude mapped to 0–360° east", () => {
    for (const p of REGIONAL_REFERENCE_PRESETS) {
      const r = validateQuery(
        new URLSearchParams({ target: "earth", lon: String(p.lonEastDeg), lat: String(p.latDeg), alt: String(p.altKm), start: "2026-11-14", stop: "2026-12-14", stepMin: "60" }),
      );
      expect(r.ok, p.id).toBe(true);
      if (r.ok) {
        expect(r.value.latDeg).toBe(p.latDeg);
        expect(r.value.lonEastDeg).toBe(p.lonEastDeg < 0 ? 359.76422 : p.lonEastDeg);
      }
    }
  });
});

describe("defaults and group order", () => {
  /** Stand-in used only inside this test to exercise the switch-over logic. */
  const candidate = (id: string): SitePreset => ({
    id,
    name: id,
    lonEastDeg: 0,
    latDeg: -89,
    altKm: 0,
    kind: "south-pole-candidate",
    source: "placeholder used only inside this unit test",
    sourceUrl: "https://example.nasa.gov/",
    note: "",
  });
  const withoutCandidates = SITE_PRESETS.filter((p) => p.kind !== "south-pole-candidate" && p.kind !== "south-pole-regional-reference");

  it("uses two historical sites while no candidates exist", () => {
    expect(hasSouthPoleCandidates(withoutCandidates)).toBe(false);
    expect(defaultSiteIds(withoutCandidates)).toEqual(["apollo11", "apollo17"]);
  });

  it("switches the defaults and the first group to south-pole candidates once they are added", () => {
    const withCandidates = [...withoutCandidates, candidate("test-a"), candidate("test-b")];
    expect(defaultSiteIds(withCandidates)).toEqual(["test-a", "test-b"]);
    expect(presetsByGroup(withCandidates)[0].title).toBe("South Pole Candidates");
  });

  it("pairs a single candidate with a historical site", () => {
    expect(defaultSiteIds([...withoutCandidates, candidate("only")])).toEqual(["only", "apollo11"]);
  });
});
