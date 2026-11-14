# Progress

Last updated: 14 Nov 2026, 16:58 SGT

## Current state

Phase 2 is complete locally and on GitHub. The app compares two lunar sites over the same UTC
range: Sun and Earth elevation charts (Site A vs Site B), sampled geometric visibility with
estimated edges, a comparison summary, per-series source labels, and limitations. A production
site exists at <https://orbitxi-lunar-landing-site-navigato.vercel.app>. There are **no lunar south-pole candidate sites** yet.

## Implemented and verified

| Feature | How it was verified |
|---|---|
| Sun and Earth elevation for two sites, live data | Local production build in a browser: Apollo 11 vs Apollo 17, 30 days hourly, 4 of 4 series LIVE, no console errors |
| App values equal Horizons values | Apollo 17 site, 20–22 Nov, 2-hour step: 25 Sun rows and 25 Earth rows compared with a direct Horizons request, 0 mismatches |
| Partial failure is shown, not hidden | Browser: invalid Site B longitude → "2 of 4 series", Site B marked FAILED with the reason, Site A still charted, differences "not available" |
| Source labels LIVE / CACHED / ARCHIVED with retrieval time | Browser: repeat query showed CACHED with the original time; archive button showed ARCHIVED |
| Custom test location labelled UNVERIFIED / EXPERIMENTAL | Browser: 0° E, −89.5° entered as Site B; label shown in the picker and the summary |
| Geometric visibility (Sun, Earth, joint), sampled windows with estimated edges | 26 unit tests: always/never visible, multiple crossings, range limits, exactly 0°, gaps, misaligned timestamps, missing series, thresholds, two-site comparison, real data |
| Each series checked against requested body and site, on server and in browser | Unit tests (wrong body, wrong site, tampered request) |
| Cache, request coalescing, concurrency limit | Unit tests with a fake clock and a stubbed network |
| API error handling (timeout, unreachable, 503, non-JSON, no table, wrong site, bad input) | Unit tests on the client and on both route handlers |
| Site presets with cited coordinates, grouped as Historical Landing Sites — Validation Examples (six Apollo sites, NSSDCA) and Technical Verification (Tycho); each labelled NOT a lunar south-pole landing candidate | Coordinates copied from the NASA page read on 14 Nov; 9 unit tests on grouping, labels, citations, and the switch-over to South Pole Candidates |
| Tests, lint, typecheck, production build | 108 tests pass; ESLint clean; `tsc --noEmit` clean; `next build` succeeds |

## Production status

- Production: <https://orbitxi-lunar-landing-site-navigato.vercel.app>. Canonical repository: <https://github.com/dingchengzhu25-cmd/OrbitXI-Lunar-Landing-Site-Navigator-1>
  (the old address redirects). Neither will be renamed or moved before the hackathon ends.
- 16:35 SGT, verified on production: Phase 2 build with grouped presets; live Horizons data equal
  to a direct Horizons request (25 Sun and 25 Earth rows, 0 mismatches); repeat query labelled
  CACHED; bad input returns 400; archive labelled ARCHIVED; browser run loaded 4 of 4 series
  with no console errors.
- Pushes to `main` deploy to production automatically. The repository was moved to the GitHub
  account that owns the Vercel project, because Vercel had been connected to a different
  account's repository and blocked deployments from the other author.
- Each automatic deployment is checked after the push and noted in the log below.

## Not verified

- Behaviour on phones (layout is responsive by design, not tested on a device).
- Whole-month queries at polar latitudes (only 6-hour and 3-day polar tests so far).
- Scientific correctness of thresholds, frames, and site heights — awaiting Yi (see `SCIENTIFIC_HANDOFF.md`). Unit tests passing is not scientific validation.
- Horizons behaviour under sustained load; its rate limits are undocumented.

## Not implemented

- South-pole candidate presets (T-05).
- Science-approved thresholds (T-06).
- Shaded windows on charts, sky-position view, animation.
- Tan's UI specification.
- Terrain-aware visibility — out of scope for the MVP.

## Material available for the demo video

| Item | Status |
|---|---|
| Public app URL | <https://orbitxi-lunar-landing-site-navigato.vercel.app> |
| Repository | <https://github.com/dingchengzhu25-cmd/OrbitXI-Lunar-Landing-Site-Navigator-1> |
| Screenshots | `docs/screenshots/` — development screenshots from the local build, for reference only |
| Approved wording | "Geometric centre-of-disc visibility only. Terrain obstruction, solar panel output and communication link quality are NOT modeled." |

Not ready to record: there is no south-pole site yet.

## Blockers

- Two south-pole sites with cited coordinates (Baoyi, T-05).
- Thresholds and frame confirmation (Yi, T-06).

## Dependency audit (14 Nov)

`npm audit` reports 7 moderate findings. All come from one advisory (minimatch,
GHSA-g3hv-75wg-m249, denial of service through crafted glob patterns) reached only through the
ESLint tooling (`typescript-eslint` packages). `npm audit --omit=dev` reports 0. Nothing in the
deployed app is affected, so no update was made.

## Log

### 14 Nov, 16:35–16:58 SGT

- Verified production independently after the manual deployment.
- Repository moved to its canonical address; links updated in the app and documents.
- Wrote `SCIENTIFIC_HANDOFF.md` (for Yi) and `DATA_PROVENANCE_HANDOFF.md` (for Baoyi), with a
  small real data set in `docs/handoff-data/` and a test pinning the quoted numbers to it.
- Recorded two leads for south-pole candidate sources; nothing added to the app.
- Automatic deployment verified: commit 95a46cc pushed 16:54:22; GitHub showed the Vercel status
  as success by 16:54:35; production served the new build by 16:54:47. Live Horizons data on
  production again matched a direct Horizons request (0 mismatches).

### 14 Nov, 15:15–15:25 SGT

- Corrected an earlier wrong statement that no deployment existed; it had been inferred from
  GitHub deployment counts instead of testing the URL.
- Grouped the site presets and strengthened their labels. South Pole Candidates will become the
  first group and the default selection automatically once cited coordinates are added.

### 14 Nov, 15:00–15:15 SGT — Phase 2

- Rewrote the visibility module: sample-based flags, windows split at gaps, estimated edges
  bracketed by their two samples, configurable provisional thresholds, joint visibility only on
  identical timestamps.
- Added coalescing and a concurrency limit to the Horizons client; cached responses are now
  labelled CACHED. Removed the CDN cache header because a CDN copy would still say "live".
- Each of the four series now loads and fails independently.
- Reorganised the page into numbered sections; charts now overlay Site A and Site B per body.

### 14 Nov, 14:35–15:00 SGT

- Added Earth series, second site, comparison table, Apollo presets, caching, polar tests.

### 14 Nov, 14:09–14:30 SGT

- Scaffolded the app; verified Horizons queries; built the Sun elevation vertical slice.
- Development started about five hours after the official 09:00 start.
