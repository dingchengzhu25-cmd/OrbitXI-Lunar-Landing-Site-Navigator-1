import { describe, expect, it } from "vitest";
import { defaultSiteIds, hasSouthPoleCandidates, KIND_LABEL, presetsByGroup, SITE_PRESETS, type SitePreset } from "./sites";

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
    for (const p of SITE_PRESETS.filter((x) => x.kind !== "south-pole-candidate")) {
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
  const withoutCandidates = SITE_PRESETS.filter((p) => p.kind !== "south-pole-candidate");

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
