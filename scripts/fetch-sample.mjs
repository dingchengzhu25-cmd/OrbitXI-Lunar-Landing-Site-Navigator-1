// Saves one real NASA/JPL Horizons response, unmodified, with retrieval metadata.
//
// Usage:
//   node scripts/fetch-sample.mjs <out.json> <sun|earth> <lonEast> <lat> <altKm> "<start UT>" "<stop UT>" <stepMin> ["site label"]
// Example:
//   node scripts/fetch-sample.mjs src/data/samples/x.json sun 348.8 -43.3 0 "2026-11-14 00:00" "2026-12-14 00:00" 60 "label"
//
// The parameter set mirrors buildHorizonsParams() in src/lib/horizons/request.ts;
// a unit test checks that the two stay identical.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const [out, target, lon, lat, alt, start, stop, stepMin, label = ""] = process.argv.slice(2);
if (!out || !stepMin || !["sun", "earth"].includes(target)) {
  console.error("Missing or invalid arguments; see the header of this file.");
  process.exit(1);
}

const params = {
  format: "json",
  COMMAND: `'${target === "sun" ? "10" : "399"}'`,
  OBJ_DATA: "'NO'",
  MAKE_EPHEM: "'YES'",
  EPHEM_TYPE: "'OBSERVER'",
  CENTER: "'coord@301'",
  COORD_TYPE: "'GEODETIC'",
  SITE_COORD: `'${Number(lon)},${Number(lat)},${Number(alt)}'`,
  START_TIME: `'${start}'`,
  STOP_TIME: `'${stop}'`,
  STEP_SIZE: `'${Number(stepMin)}m'`,
  QUANTITIES: "'4'",
  TIME_TYPE: "'UT'",
  CSV_FORMAT: "'YES'",
};
const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${new URLSearchParams(params)}`;

const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
const retrievedAtUtc = new Date().toISOString();
const response = await res.json();

const sample = {
  meta: {
    siteLabel: label,
    request: {
      target,
      lonEastDeg: Number(lon),
      latDeg: Number(lat),
      altKm: Number(alt),
      startUt: start,
      stopUt: stop,
      stepMinutes: Number(stepMin),
    },
    params,
    horizonsUrl: url,
    httpStatus: res.status,
    retrievedAtUtc,
  },
  response,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(sample, null, 1)}\n`);
const hasTable = typeof response.result === "string" && response.result.includes("$$SOE");
console.log(`${out}: HTTP ${res.status}, table ${hasTable ? "present" : "ABSENT"}, retrieved ${retrievedAtUtc}`);
