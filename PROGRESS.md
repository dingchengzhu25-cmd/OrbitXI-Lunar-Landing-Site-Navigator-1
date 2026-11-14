# Progress

Last updated: 14 Nov 2026, 14:30 SGT

## Current state

The first vertical slice works locally: a lunar site and date range go to NASA/JPL Horizons
through a server route, the response is parsed and checked, and Sun elevation is charted with
provenance. Not yet deployed. No south-pole sites yet — waiting on cited coordinates.

## Implemented and verified

| Feature | How it was verified |
|---|---|
| Live Sun elevation query for a Moon-surface site | Local production build; chart of 721 real hourly values; values equal to a direct Horizons request |
| Server route `/api/ephemeris` (Sun and Earth) | Called locally for both bodies; correct rows returned |
| Input validation and readable errors | Unit tests; bad longitude and oversize range return HTTP 400 with a message |
| Horizons "HTTP 200 but no data" detected as an error | Unit test on a real failed response |
| Response checked against the requested body, site, and frame | Unit tests |
| Provenance panel (source, API version, ephemeris, frame, exact request URL) | Seen in the local app |
| Archived real sample, clearly labelled | `/api/sample` returns `source: "archive"` with retrieval time |
| Tests, lint, typecheck, production build | 32 tests pass; ESLint clean; `tsc` clean; `next build` succeeds |

## In progress

- Deployment to Vercel (T-04).

## Not implemented

- Earth elevation in the interface (the server route already supports it).
- Second site and comparison view.
- Visibility windows and summaries.
- South-pole site presets.
- Response caching.
- Terrain-aware visibility — out of scope for the MVP.

## Material available for the demo video

| Item | Status |
|---|---|
| Public app URL | Not yet available |
| Repository | <https://github.com/Zdcgaryland69/OrbitXI-Lunar-Landing-Site-Navigator> |
| Screenshots | None saved yet |
| Approved wording | "Geometric Sun elevation from NASA/JPL Horizons; terrain not included." |

Not ready to record: the app does not yet show south-pole sites, Earth, or comparison.

## Blockers

- Two south-pole sites with cited coordinates (Baoyi, T-05).
- Sunlit and Earth-visible threshold definitions (Yi, T-06).

## Log

### 14 Nov, 14:09–14:30 SGT — Asher with Claude

- Scaffolded Next.js 16 + TypeScript + Tailwind; added Recharts and Vitest.
- Tested Horizons for Sun and Earth at the manual's Tycho example site; saved two real 30-day
  samples and one real error response.
- Built validation, parser, Horizons client, two API routes, chart page.
- A unit test caught a floating-point error in longitude normalisation (348.8 became
  348.79999999999995); fixed before any request used it.
- Development started about five hours after the official 09:00 start.
