import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOLTIP_MAX_WIDTH, tooltipLines } from "./chartTooltip";

const source = (file: string) => readFileSync(fileURLToPath(new URL(`../components/${file}`, import.meta.url)), "utf8");

describe("tooltipLines", () => {
  it("keeps Site A and Site B, their names, three decimals, the unit and the body", () => {
    const lines = tooltipLines("Sun", [
      { name: "A (solid): Nobile Rim 1 — NASA 2023 regional reference point", value: -0.316, color: "#38bdf8" },
      { name: "B (dashed): Malapert Massif — NASA 2023 regional reference point", value: -2.05, color: "#fb923c" },
    ]);
    expect(lines).toEqual([
      { name: "A (solid): Nobile Rim 1 — NASA 2023 regional reference point", value: "-0.316° Sun elevation", color: "#38bdf8" },
      { name: "B (dashed): Malapert Massif — NASA 2023 regional reference point", value: "-2.050° Sun elevation", color: "#fb923c" },
    ]);
  });

  it("does not shorten or drop the site identification", () => {
    const name = "B (dashed): Malapert Massif — NASA 2023 regional reference point";
    expect(tooltipLines("Earth", [{ name, value: 10.255083 }])[0]).toMatchObject({ name, value: "10.255° Earth elevation" });
  });

  it("says so when a series has no value at the hovered time", () => {
    expect(tooltipLines("Sun", [{ name: "A (solid): x", value: null }, { name: "B (dashed): y", value: undefined }]).map((l) => l.value)).toEqual([
      "no data",
      "no data",
    ]);
  });
});

describe("mobile layout guards (QA21)", () => {
  it("limits the tooltip to the width of its plot and lets long names wrap", () => {
    const chart = source("ElevationChart.tsx");
    expect(TOOLTIP_MAX_WIDTH).toBe("min(calc(100% - 64px), 22rem)");
    // The side space must match the chart: y-axis width 48 plus margins left 4 and right 12.
    expect(chart).toContain("margin={{ top: 8, right: 12, bottom: 22, left: 4 }}");
    expect(chart).toContain("width={48}");
    expect(chart).toContain("wrapperStyle={{ maxWidth: TOOLTIP_MAX_WIDTH");
    expect(chart).toContain('whiteSpace: "normal"');
    expect(chart).toContain('overflowWrap: "anywhere"');
    expect(chart).toMatch(/fullFmt\.format\(Number\(label\)\)\} UTC/);
  });

  it("stacks the date-range fields on phones and keeps three columns on wider screens", () => {
    const page = source("SiteComparison.tsx");
    expect(page).toContain('className="grid grid-cols-1 gap-3 sm:max-w-xl sm:grid-cols-3" data-testid="date-range-fields"');
    expect(page).toContain('type="date"');
    expect(page).toContain("min={1} max={62}");
  });
});
