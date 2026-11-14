export type TargetBody = "sun" | "earth";

/** A validated request for a Moon-surface observer table. All times are UT. */
export interface HorizonsRequest {
  target: TargetBody;
  /** East longitude in degrees, 0..360 (Horizons lunar sites are east-positive). */
  lonEastDeg: number;
  latDeg: number;
  /** Height above the Horizons lunar reference sphere, km. */
  altKm: number;
  /** "YYYY-MM-DD HH:MM" in UT. */
  startUt: string;
  /** "YYYY-MM-DD HH:MM" in UT. */
  stopUt: string;
  stepMinutes: number;
}

export interface EphemerisPoint {
  /** ISO 8601 instant, UTC (Horizons "UT" column). */
  t: string;
  /** Airless apparent azimuth, degrees clockwise from north. */
  azDeg: number;
  /** Airless apparent elevation of the target centre, degrees. */
  elDeg: number;
}

/** Provenance fields read from the Horizons response header. */
export interface HorizonsMeta {
  targetBody: string | null;
  targetEphemeris: string | null;
  centerBody: string | null;
  centerEphemeris: string | null;
  centerGeodetic: { lonEastDeg: number; latDeg: number; altKm: number } | null;
  centerFrame: string | null;
  centerFrameNote: string | null;
  centerRadiiKm: string | null;
  refraction: string | null;
  eopFile: string | null;
  stepSize: string | null;
  /** Timestamp line Horizons printed when it generated the table (JPL local time). */
  generatedAt: string | null;
}

export interface ParsedEphemeris {
  signature: { source: string | null; version: string | null };
  meta: HorizonsMeta;
  points: EphemerisPoint[];
}

export type DataSourceKind = "live" | "cached" | "archive";

export interface EphemerisResponse extends ParsedEphemeris {
  /**
   * "live"    = fetched from Horizons for this request.
   * "cached"  = an earlier live response reused from server memory (retrievedAtUtc is the original time).
   * "archive" = a real response stored in the repository.
   */
  source: DataSourceKind;
  /** When the Horizons response was retrieved (ISO 8601, UTC). */
  retrievedAtUtc: string;
  request: HorizonsRequest;
  /** Exact Horizons URL that produced the data. */
  horizonsUrl: string;
  archiveNote?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export class HorizonsError extends Error {
  constructor(
    public readonly code:
      | "HORIZONS_TIMEOUT"
      | "HORIZONS_UNREACHABLE"
      | "HORIZONS_HTTP"
      | "HORIZONS_NO_DATA"
      | "HORIZONS_UNEXPECTED_FORMAT"
      | "HORIZONS_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "HorizonsError";
  }
}
