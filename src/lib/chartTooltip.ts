/** Chart width taken by the y axis (48 px) and the left and right margins (4 px, 12 px). */
export const CHART_SIDE_SPACE_PX = 64;

/**
 * Widest the chart tooltip may be: the width of the plotting area. The percentage is of the
 * chart itself, so the tooltip always fits inside the plot (where Recharts keeps it), whatever
 * the screen width or site-name length. Long names wrap.
 */
export const TOOLTIP_MAX_WIDTH = `min(calc(100% - ${CHART_SIDE_SPACE_PX}px), 22rem)`;

export interface TooltipLine {
  /** Site identification exactly as in the legend, e.g. "A (solid): Apollo 11 Lunar Module". */
  name: string;
  /** Elevation with unit and body, e.g. "-0.316° Sun elevation". */
  value: string;
  color?: string;
}

/**
 * Text of the tooltip rows. Every series present in the hovered sample is kept (Site A and
 * Site B), with the same three-decimal value and wording as before.
 */
export function tooltipLines(
  body: string,
  entries: { name: string; value: number | null | undefined; color?: string }[],
): TooltipLine[] {
  return entries.map((e) => ({
    name: e.name,
    value: typeof e.value === "number" && Number.isFinite(e.value) ? `${e.value.toFixed(3)}° ${body} elevation` : "no data",
    color: e.color,
  }));
}
