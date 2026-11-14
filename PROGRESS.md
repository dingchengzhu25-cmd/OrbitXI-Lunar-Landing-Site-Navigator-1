# Progress

Last updated: 14 Nov 2026, 15:00 SGT

## Current state

The app compares two lunar sites over the same date range: Sun and Earth elevation charts per
site, a table of geometric visibility metrics, and provenance for every request. It runs locally
from a production build against live NASA/JPL Horizons data. Not yet deployed. No south-pole
sites yet — waiting on cited coordinates.

## Implemented and verified

| Feature | How it was verified |
|---|---|
| Two-site comparison, Sun and Earth, live data | Local production build; Apollo 11 vs Apollo 17, 30 days hourly; four live queries; no console errors |
| Site presets with cited coordinates (six Apollo sites, NSSDCA) | Coordinates copied from the NASA page read on 14 Nov; each preset links its source |
| Custom coordinates, labelled as unverified | Seen in the local app |
| Geometric windows: time above 0°, longest window, next rise/set, Sun-and-Earth overlap | 14 unit tests, including checks on real Horizons data |
| Server route `/api/ephemeris` (Sun and Earth) | Values equal to direct Horizons requests |
| Near-pole queries (latitude −89.5° and −90°) | Direct and through the app; tables returned |
| Response caching (in-memory, plus CDN header) | Repeat query returned in 5 ms with the original retrieval time |
| Input validation and readable errors | Unit tests; HTTP 400 with a message |
| Horizons "HTTP 200 but no data" detected as an error | Unit test on a real failed response |
| Response checked against requested body, site, and frame | Unit tests |
| Archived real samples, clearly labelled | Five sample ids return `source: "archive"` with retrieval time |
| Tests, lint, typecheck, production build | 46 tests pass; ESLint clean; `tsc` clean; `next build` succeeds |

## In progress

- Deployment to Vercel (T-04) — needs Asher to sign in and import the repository.

## Not implemented

- South-pole candidate presets (waiting on T-05).
- Science-approved visibility thresholds; the current "centre above 0°" rule is provisional (T-06).
- Shaded windows on the charts, sky-position view, animation.
- Tan's UI specification.
- Terrain-aware visibility — out of scope for the MVP.

## Material available for the demo video

| Item | Status |
|---|---|
| Public app URL | Not yet available |
| Repository | <https://github.com/Zdcgaryland69/OrbitXI-Lunar-Landing-Site-Navigator> |
| Screenshots | None saved to the repository yet |
| Approved wording | "Geometric Sun and Earth elevation from NASA/JPL Horizons; terrain not included." |

Not ready to record: there is no public URL and no south-pole site yet.

## Blockers

- Vercel sign-in and import (Asher, T-04).
- Two south-pole sites with cited coordinates (Baoyi, T-05).
- Sunlit and Earth-visible threshold definitions and frame confirmation (Yi, T-06).

## Log

### 14 Nov, 14:35–15:00 SGT — Asher with Claude

- Added Earth series, second site, comparison table, and geometric window calculations.
- Added six Apollo landing sites as presets, coordinates from the NASA NSSDCA page.
- Tested Horizons at latitude −89.5° and −90° (generic coordinates, not candidate sites): works.
- Added response caching. Saved real samples for Apollo 11 and Apollo 17.
- Plausibility check: Apollo 17 lies about 7.3° east of Apollo 11, so sunrise should come roughly
  14 hours earlier; the app shows 13.3 hours. Not a scientific validation.

### 14 Nov, 14:09–14:30 SGT — Asher with Claude

- Scaffolded Next.js 16 + TypeScript + Tailwind; added Recharts and Vitest.
- Tested Horizons for Sun and Earth at the manual's Tycho example site; saved two real 30-day
  samples and one real error response.
- Built validation, parser, Horizons client, two API routes, chart page.
- A unit test caught a floating-point error in longitude normalisation (348.8 became
  348.79999999999995); fixed before any request used it.
- Development started about five hours after the official 09:00 start.
