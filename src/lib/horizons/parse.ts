import { HorizonsError, type EphemerisPoint, type HorizonsMeta, type ParsedEphemeris } from "./types";

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const ROW_DATE_RE = /^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

/** Converts a Horizons calendar stamp such as "2026-Nov-14 03:00" (UT) to ISO 8601 UTC. */
export function horizonsDateToIso(stamp: string): string {
  const m = ROW_DATE_RE.exec(stamp.trim());
  if (!m || !(m[2] in MONTHS)) {
    throw new HorizonsError("HORIZONS_UNEXPECTED_FORMAT", `Unrecognised Horizons date: "${stamp}".`);
  }
  const ms = Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
  return new Date(ms).toISOString();
}

function first(text: string, re: RegExp, group = 1): string | null {
  const m = re.exec(text);
  return m ? m[group].trim() : null;
}

function parseMeta(text: string): HorizonsMeta {
  const geo = /^Center geodetic\s*:\s*([-+\d.Ee]+),\s*([-+\d.Ee]+),\s*([-+\d.Ee]+)/m.exec(text);
  return {
    targetBody: first(text, /^Target body name:\s*(.+?)\s*\{source:/m),
    targetEphemeris: first(text, /^Target body name:.*\{source:\s*(.+?)\}/m),
    centerBody: first(text, /^Center body name:\s*(.+?)\s*\{source:/m),
    centerEphemeris: first(text, /^Center body name:.*\{source:\s*(.+?)\}/m),
    centerGeodetic: geo
      ? { lonEastDeg: Number(geo[1]), latDeg: Number(geo[2]), altKm: Number(geo[3]) }
      : null,
    centerFrame: first(text, /^Center pole\/equ\s*:\s*(.+?)\s*\{/m),
    centerFrameNote: first(text, /^Center pole\/equ\s*:.*\{(.+?)\}/m),
    centerRadiiKm: first(text, /^Center radii\s*:\s*(.+?)\s*km/m),
    refraction: first(text, /^Atmos refraction:\s*(.+?)\s*$/m),
    eopFile: first(text, /^EOP file\s*:\s*(\S+)/m),
    stepSize: first(text, /^Step-size\s*:\s*(.+?)\s*$/m),
    generatedAt: first(text, /^Ephemeris \/ \S+\s+(.+?)\s+Pasadena/m),
  };
}

/** Pulls a short human-readable reason out of a Horizons reply that has no data table. */
function describeNoData(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !/^\*+$/.test(l));
  const excerpt = lines.slice(0, 6).join(" | ");
  return excerpt.length > 400 ? `${excerpt.slice(0, 400)}…` : excerpt;
}

/**
 * Parses the JSON body of a Horizons API observer-table response requested with
 * QUANTITIES='4', CSV_FORMAT='YES' and UT time.
 *
 * Horizons answers HTTP 200 even for failed queries, so a response only counts as
 * data when the $$SOE/$$EOE table is present and every row parses.
 */
export function parseHorizonsObserverJson(body: unknown): ParsedEphemeris {
  if (typeof body !== "object" || body === null) {
    throw new HorizonsError("HORIZONS_UNEXPECTED_FORMAT", "Horizons did not return a JSON object.");
  }
  const obj = body as Record<string, unknown>;
  if (typeof obj.error === "string") {
    throw new HorizonsError("HORIZONS_NO_DATA", `Horizons reported an error: ${obj.error}`);
  }
  if (typeof obj.result !== "string") {
    throw new HorizonsError("HORIZONS_UNEXPECTED_FORMAT", 'Horizons JSON has no "result" text.');
  }
  const text = obj.result;
  const lines = text.split(/\r?\n/);
  const soe = lines.findIndex((l) => l.startsWith("$$SOE"));
  const eoe = lines.findIndex((l) => l.startsWith("$$EOE"));
  if (soe < 0 || eoe < 0 || eoe <= soe) {
    throw new HorizonsError(
      "HORIZONS_NO_DATA",
      `Horizons returned no ephemeris table. It said: ${describeNoData(text)}`,
    );
  }

  // The CSV header is the last line before $$SOE that names the date column.
  let header: string | null = null;
  for (let i = soe - 1; i >= 0; i--) {
    if (lines[i].includes("Date__(")) {
      header = lines[i];
      break;
    }
  }
  if (header === null) {
    throw new HorizonsError("HORIZONS_UNEXPECTED_FORMAT", "Horizons table has no column header.");
  }
  const cols = header.split(",").map((c) => c.trim());
  const dateCol = cols.findIndex((c) => c.startsWith("Date__(UT)"));
  const azCol = cols.indexOf("Azi_(a-app)");
  const elCol = cols.indexOf("Elev_(a-app)");
  if (dateCol < 0) {
    throw new HorizonsError("HORIZONS_UNEXPECTED_FORMAT", `Expected a UT date column, got "${cols[0]}".`);
  }
  if (azCol < 0 || elCol < 0) {
    throw new HorizonsError(
      "HORIZONS_UNEXPECTED_FORMAT",
      "Horizons table lacks airless apparent azimuth/elevation columns (QUANTITIES=4).",
    );
  }

  const points: EphemerisPoint[] = [];
  for (const line of lines.slice(soe + 1, eoe)) {
    if (line.trim() === "") continue;
    const cells = line.split(",").map((c) => c.trim());
    const azDeg = Number(cells[azCol]);
    const elDeg = Number(cells[elCol]);
    if (cells[azCol] === "" || cells[elCol] === "" || !Number.isFinite(azDeg) || !Number.isFinite(elDeg)) {
      throw new HorizonsError(
        "HORIZONS_UNEXPECTED_FORMAT",
        `Non-numeric azimuth/elevation in Horizons row: "${line.trim()}".`,
      );
    }
    points.push({ t: horizonsDateToIso(cells[dateCol]), azDeg, elDeg });
  }
  if (points.length === 0) {
    throw new HorizonsError("HORIZONS_NO_DATA", "Horizons returned an empty ephemeris table.");
  }
  for (let i = 1; i < points.length; i++) {
    if (points[i].t <= points[i - 1].t) {
      throw new HorizonsError(
        "HORIZONS_UNEXPECTED_FORMAT",
        `Horizons rows are not in increasing time order at ${points[i].t}.`,
      );
    }
  }

  const sig = (obj.signature ?? {}) as Record<string, unknown>;
  return {
    signature: {
      source: typeof sig.source === "string" ? sig.source : null,
      version: typeof sig.version === "string" ? sig.version : null,
    },
    meta: parseMeta(text),
    points,
  };
}
