"use client";

import type { SampledWindow, Visibility, WindowEdge } from "@/lib/visibility";
import { BodyIcon } from "./BodyIcon";
import { SITE_A_COLOR, SITE_B_COLOR } from "./ElevationChart";

export interface TimelineRow {
  site: "A" | "B";
  body: "Sun" | "Earth";
  siteLabel: string;
  v: Visibility;
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" });
const fullFmt = (ms: number) => `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
const fmtHours = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)} days` : `${h.toFixed(1)} h`);

/** Bar ends use the same estimated edges as the visibility table; open edges fall back to the visible sample. */
const edgeMs = (edge: WindowEdge, fallback: number) => (edge.type === "transition" ? edge.estimateMs : fallback);

function describeWindow(row: TimelineRow, w: SampledWindow): string {
  const start =
    w.start.type === "transition" ? `≈ ${fullFmt(w.start.estimateMs)}` : w.start.type === "gap" ? "after missing samples" : "already above at range start";
  const end =
    w.end.type === "transition" ? `≈ ${fullFmt(w.end.estimateMs)}` : w.end.type === "gap" ? "before missing samples" : "still above at range end";
  const bound = w.start.type !== "transition" || w.end.type !== "transition" ? " (lower bound)" : "";
  return `Site ${row.site}, ${row.siteLabel}: ${row.body} above the horizon from ${start} to ${end}; ≈ ${fmtHours(w.estimatedHours)}${bound}, estimated from samples.`;
}

/**
 * When each body is above the 0° geometric horizon, per site, on one UTC axis.
 * Bars come straight from the sampled windows computed in lib/visibility (no new science).
 * Pattern = site (A solid, B hatched), matching the charts. Clicking the track moves the shared cursor.
 */
export function VisibilityTimeline({
  rows,
  startMs,
  endMs,
  cursorMs,
  onPick,
}: {
  rows: TimelineRow[];
  startMs: number;
  endMs: number;
  cursorMs: number | null;
  onPick: (ms: number) => void;
}) {
  const span = Math.max(1, endMs - startMs);
  const pct = (ms: number) => `${(Math.min(Math.max(ms, startMs), endMs) - startMs) / span * 100}%`;
  const days = span / 86_400_000;
  const stepDays = days <= 7 ? 1 : days <= 31 ? 5 : 10;
  const ticks: number[] = [];
  const firstMidnight = Math.ceil(startMs / 86_400_000) * 86_400_000;
  for (let t = firstMidnight; t <= endMs; t += stepDays * 86_400_000) ticks.push(t);

  return (
    <div data-testid="visibility-timeline">
      <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
        {rows.map((row) => {
          const color = row.body === "Sun" ? "#ffcf73" : "#8fd0ff";
          return [
            <div key={`${row.site}${row.body}-label`} className="flex items-center gap-2 text-sm">
              <span className="font-semibold" style={{ color: row.site === "A" ? SITE_A_COLOR : SITE_B_COLOR }}>
                {row.site}
              </span>
              <BodyIcon body={row.body} size={15} />
              <span className="text-ink-2">{row.body}</span>
            </div>,
            <div
              key={`${row.site}${row.body}-track`}
              className="relative h-6 cursor-ew-resize bg-raised"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onPick(startMs + ((e.clientX - r.left) / r.width) * span);
              }}
            >
              {row.v.ok ? (
                row.v.windows.map((w, i) => {
                  const a = edgeMs(w.start, w.firstVisibleMs);
                  const b = edgeMs(w.end, w.lastVisibleMs);
                  const left = (Math.max(a, startMs) - startMs) / span * 100;
                  const width = Math.max(0.4, (Math.min(b, endMs) - Math.max(a, startMs)) / span * 100);
                  return (
                    <div
                      key={i}
                      role="img"
                      aria-label={describeWindow(row, w)}
                      title={describeWindow(row, w)}
                      className={`absolute top-1 bottom-1 ${row.site === "B" ? "hatch border" : ""}`}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        color,
                        background: row.site === "A" ? color : undefined,
                        borderColor: row.site === "B" ? color : undefined,
                      }}
                    />
                  );
                })
              ) : (
                <span className="absolute inset-0 flex items-center px-2 text-xs text-fail">No data: {row.v.message}</span>
              )}
              {cursorMs != null && <div aria-hidden="true" className="pointer-events-none absolute -top-1 -bottom-1 w-px bg-white" style={{ left: pct(cursorMs) }} />}
            </div>,
          ];
        })}
        <div />
        <div className="relative h-5 text-[11px] text-ink-3">
          {ticks.map((t) => {
            const frac = (t - startMs) / span;
            // Keep the first and last labels inside the track instead of spilling past its edges.
            const shift = frac < 0.04 ? "translate-x-0" : frac > 0.96 ? "-translate-x-full" : "-translate-x-1/2";
            return (
              <span key={t} className={`absolute whitespace-nowrap font-mono ${shift}`} style={{ left: pct(t) }}>
                {dayFmt.format(t)}
              </span>
            );
          })}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-3">
        Time in UTC. Bars are sampled windows above the 0° geometric horizon; ends are estimates between two samples.
        Site A bars are solid, Site B bars are hatched. Select a bar or the track to move the time cursor.
      </p>
    </div>
  );
}
