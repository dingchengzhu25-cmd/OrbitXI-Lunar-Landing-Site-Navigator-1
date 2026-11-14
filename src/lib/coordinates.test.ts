import { describe, expect, it } from "vitest";
import { describeLongitude } from "./coordinates";
import { SITE_PRESETS } from "./sites";

describe("describeLongitude", () => {
  it("writes a positive value as east", () => {
    expect(describeLongitude("37.36667")).toBe("37.36667° E");
    expect(describeLongitude("0")).toBe("0° E");
    expect(describeLongitude("180")).toBe("180° E");
  });

  it("writes a negative value as west, with the signed and the 0–360° east forms", () => {
    expect(describeLongitude("-0.23578")).toBe("0.23578° W (−0.23578° in signed east longitude; 359.76422° E)");
    expect(describeLongitude("-23.4219")).toBe("23.4219° W (−23.4219° in signed east longitude; 336.5781° E)");
  });

  it("never prints a negative number followed by E", () => {
    for (const p of SITE_PRESETS) {
      const text = describeLongitude(String(p.lonEastDeg));
      expect(text, p.id).not.toMatch(/-\d[\d.]*° E/);
      expect(text, p.id).toContain(String(Math.abs(p.lonEastDeg)));
    }
  });

  it("adds the west equivalent for values above 180° east", () => {
    expect(describeLongitude("348.8")).toBe("348.8° E (11.2° W)");
  });

  it("keeps the digits of the source value", () => {
    expect(describeLongitude("-17.47194")).toContain("17.47194° W");
    expect(describeLongitude(" 30.7723 ")).toBe("30.7723° E");
  });

  it("flags input that is not a longitude", () => {
    expect(describeLongitude("abc")).toBe("abc° (not a valid longitude)");
    expect(describeLongitude("999")).toBe("999° (not a valid longitude)");
    expect(describeLongitude("")).toBe("° (not a valid longitude)");
  });
});
