import type { NextRequest } from "next/server";
import { fetchHorizonsEphemeris } from "@/lib/horizons/client";
import { validateQuery } from "@/lib/horizons/request";
import { HorizonsError, type ApiErrorBody } from "@/lib/horizons/types";

const STATUS: Record<HorizonsError["code"], number> = {
  HORIZONS_TIMEOUT: 504,
  HORIZONS_UNREACHABLE: 502,
  HORIZONS_HTTP: 502,
  HORIZONS_NO_DATA: 502,
  HORIZONS_UNEXPECTED_FORMAT: 502,
  HORIZONS_MISMATCH: 502,
};

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } } satisfies ApiErrorBody, { status });
}

/**
 * GET /api/ephemeris?target=sun|earth&lon=&lat=&alt=&start=&stop=&stepMin=
 * Live proxy to NASA/JPL Horizons. On failure it returns an error; it never
 * substitutes other data.
 */
export async function GET(request: NextRequest) {
  const check = validateQuery(request.nextUrl.searchParams);
  if (!check.ok) return fail(400, "INVALID_REQUEST", check.message);

  try {
    const data = await fetchHorizonsEphemeris(check.value);
    // Let the CDN reuse identical queries for an hour; the body carries its own retrieval time.
    return Response.json(data, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch (err) {
    if (err instanceof HorizonsError) return fail(STATUS[err.code], err.code, err.message);
    console.error("Unexpected /api/ephemeris failure", err);
    return fail(500, "INTERNAL_ERROR", "Unexpected server error while processing Horizons data.");
  }
}
