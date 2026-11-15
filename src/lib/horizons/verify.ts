import { TARGET_COMMAND } from "./request";
import { HorizonsError, type HorizonsRequest, type ParsedEphemeris } from "./types";

/**
 * Confirms that the table Horizons produced is for the body, site and time grid that were
 * asked for. Guards against charting a different target, location or range. Used on the
 * server for live and archived data, and again in the browser before a series is displayed.
 */
export function assertMatchesRequest(parsed: ParsedEphemeris, req: HorizonsRequest): void {
  const { meta } = parsed;
  if (!meta.targetBody?.includes(`(${TARGET_COMMAND[req.target]})`)) {
    throw new HorizonsError("HORIZONS_MISMATCH", `Horizons returned target "${meta.targetBody}", not the requested body.`);
  }
  if (!meta.centerBody?.includes("(301)")) {
    throw new HorizonsError("HORIZONS_MISMATCH", `Horizons observer centre is "${meta.centerBody}", not the Moon.`);
  }
  const geo = meta.centerGeodetic;
  if (
    !geo ||
    longitudeDifferenceDeg(geo.lonEastDeg, req.lonEastDeg) > 1e-4 ||
    Math.abs(geo.latDeg - req.latDeg) > 1e-4 ||
    Math.abs(geo.altKm - req.altKm) > 1e-4
  ) {
    throw new HorizonsError("HORIZONS_MISMATCH", "Horizons site coordinates do not match the request.");
  }
  if (!meta.centerFrameNote?.toLowerCase().includes("east-longitude positive")) {
    throw new HorizonsError("HORIZONS_MISMATCH", "Horizons did not confirm an east-positive longitude convention.");
  }
  assertTimeGridMatchesRequest(parsed, req);
}

/** Smallest angle between two longitudes, so 359.99999° and 0° count as the same meridian. */
export function longitudeDifferenceDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const utToMs = (ut: string) => Date.parse(`${ut.replace(" ", "T")}:00Z`);

/**
 * Confirms that the table covers the requested UT range at the requested step: it starts
 * at the requested start, has one row per step with none missing, and ends at the last
 * step that fits before the requested stop. Guards against charting a truncated or
 * differently sampled table under the requested dates.
 */
export function assertTimeGridMatchesRequest(parsed: ParsedEphemeris, req: HorizonsRequest): void {
  const startMs = utToMs(req.startUt);
  const stopMs = utToMs(req.stopUt);
  const stepMs = req.stepMinutes * 60_000;
  if (!Number.isFinite(startMs) || !Number.isFinite(stopMs) || !(stepMs > 0)) {
    throw new HorizonsError("HORIZONS_MISMATCH", "The request has no readable time range to check the data against.");
  }
  const expectedRows = Math.floor((stopMs - startMs) / stepMs) + 1;
  const { points } = parsed;
  if (points.length !== expectedRows) {
    throw new HorizonsError(
      "HORIZONS_MISMATCH",
      `Horizons returned ${points.length} rows; the requested range and step need ${expectedRows}.`,
    );
  }
  for (let i = 0; i < points.length; i++) {
    if (Date.parse(points[i].t) !== startMs + i * stepMs) {
      throw new HorizonsError(
        "HORIZONS_MISMATCH",
        `Horizons row ${i + 1} is at ${points[i].t}, not on the requested time grid.`,
      );
    }
  }
}
