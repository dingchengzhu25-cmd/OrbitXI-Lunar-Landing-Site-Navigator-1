import { TARGET_COMMAND } from "./request";
import { HorizonsError, type HorizonsRequest, type ParsedEphemeris } from "./types";

/**
 * Confirms that the table Horizons produced is for the body and site that were asked for.
 * Guards against charting a different target or location. Used on the server for live
 * and archived data, and again in the browser before a series is displayed.
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
    Math.abs(geo.lonEastDeg - req.lonEastDeg) > 1e-4 ||
    Math.abs(geo.latDeg - req.latDeg) > 1e-4 ||
    Math.abs(geo.altKm - req.altKm) > 1e-4
  ) {
    throw new HorizonsError("HORIZONS_MISMATCH", "Horizons site coordinates do not match the request.");
  }
  if (!meta.centerFrameNote?.toLowerCase().includes("east-longitude positive")) {
    throw new HorizonsError("HORIZONS_MISMATCH", "Horizons did not confirm an east-positive longitude convention.");
  }
}
