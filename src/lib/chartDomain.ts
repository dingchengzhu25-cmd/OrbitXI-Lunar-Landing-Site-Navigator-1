/** Half-height, in degrees, of the optional "near horizon" chart view. */
export const NEAR_HORIZON_HALF_RANGE_DEG = 5;

/** Tick spacing that keeps a readable number of ticks for a given span in degrees. */
export function niceStepDeg(spanDeg: number): number {
  if (spanDeg <= 4) return 1;
  if (spanDeg <= 12) return 2;
  if (spanDeg <= 30) return 5;
  return 10;
}

/**
 * Y-axis range fitted to the plotted elevations. The threshold line is always inside
 * the range, so a series that stays close to the horizon (as near the lunar poles)
 * fills the chart instead of being flattened into a ±90° axis.
 */
export function fitElevationDomain(elevationsDeg: number[], thresholdDeg: number): [number, number] {
  const values = elevationsDeg.filter(Number.isFinite);
  const lo = Math.min(thresholdDeg, ...values);
  const hi = Math.max(thresholdDeg, ...values);
  const step = niceStepDeg(hi - lo);
  const pad = step / 4;
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return [
    Math.max(-90, round(Math.floor((lo - pad) / step) * step)),
    Math.min(90, round(Math.ceil((hi + pad) / step) * step)),
  ];
}

/** Fixed range around the threshold. Values outside it are clipped by the chart, not altered. */
export function nearHorizonDomain(thresholdDeg: number): [number, number] {
  return [thresholdDeg - NEAR_HORIZON_HALF_RANGE_DEG, thresholdDeg + NEAR_HORIZON_HALF_RANGE_DEG];
}

/** Evenly spaced ticks from the bottom to the top of a range. */
export function domainTicks([lo, hi]: [number, number]): number[] {
  const step = niceStepDeg(hi - lo);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
