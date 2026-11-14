import { LIMITS } from "./horizons/request";

export type RequestPlan =
  | { ok: true; days: number; stepMinutes: number; samplesPerSeries: number }
  | { ok: false; message: string };

/** Rows Horizons returns for a whole-day range, counting both the first and the last instant. */
export function samplesFor(days: number, stepMinutes: number): number {
  return Math.floor((days * 1440) / stepMinutes) + 1;
}

/** Longest whole-day range the server accepts at a given sampling interval. */
export function maxDaysForStep(stepMinutes: number): number {
  return Math.min(LIMITS.maxSpanDays, Math.floor(((LIMITS.maxPoints - 1) * stepMinutes) / 1440));
}

/**
 * Checks the date-range form against the same limits the server enforces, so the user
 * is told before any request is sent. The server check stays in place; this only mirrors it.
 */
export function planRequest(daysText: string, stepText: string): RequestPlan {
  const days = Number(daysText);
  const stepMinutes = Number(stepText);
  if (daysText.trim() === "" || !Number.isInteger(days) || days < 1) {
    return { ok: false, message: "Enter a whole number of days (1 or more)." };
  }
  if (!Number.isInteger(stepMinutes) || stepMinutes < LIMITS.minStepMinutes || stepMinutes > LIMITS.maxStepMinutes) {
    return { ok: false, message: `The sampling interval must be between ${LIMITS.minStepMinutes} and ${LIMITS.maxStepMinutes} minutes.` };
  }
  if (days > LIMITS.maxSpanDays) {
    return { ok: false, message: `The date range may not exceed ${LIMITS.maxSpanDays} days. Enter ${LIMITS.maxSpanDays} or fewer.` };
  }
  const samplesPerSeries = samplesFor(days, stepMinutes);
  if (samplesPerSeries > LIMITS.maxPoints) {
    const maxDays = maxDaysForStep(stepMinutes);
    return {
      ok: false,
      message:
        `${days} days sampled every ${stepMinutes} minutes needs ${samplesPerSeries.toLocaleString("en-US")} samples per series; ` +
        `the limit is ${LIMITS.maxPoints.toLocaleString("en-US")}. Choose a longer sampling interval, or ${maxDays} day${maxDays === 1 ? "" : "s"} or fewer at this interval.`,
    };
  }
  return { ok: true, days, stepMinutes, samplesPerSeries };
}
