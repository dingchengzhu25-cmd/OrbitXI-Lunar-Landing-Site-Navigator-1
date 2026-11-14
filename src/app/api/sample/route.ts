import type { NextRequest } from "next/server";
import { loadSample, SAMPLE_IDS } from "@/lib/samples";
import type { ApiErrorBody } from "@/lib/horizons/types";

/**
 * GET /api/sample?id=apollo11-sun
 * Serves a stored real Horizons response, marked source="archive".
 * The UI only calls this when the user explicitly asks for the archived sample.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "apollo11-sun";
  const sample = loadSample(id);
  if (!sample) {
    return Response.json(
      {
        error: { code: "UNKNOWN_SAMPLE", message: `Unknown sample id. Available: ${SAMPLE_IDS.join(", ")}.` },
      } satisfies ApiErrorBody,
      { status: 404 },
    );
  }
  return Response.json(sample);
}
