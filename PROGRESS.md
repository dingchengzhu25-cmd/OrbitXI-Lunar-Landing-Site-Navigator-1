# Progress

Last updated: 15 Nov 2026, 04:10 SGT

## Current state

Phase 2 is complete locally and on GitHub. The app compares two lunar sites over the same UTC
range: Sun and Earth elevation charts (Site A vs Site B), sampled geometric visibility with
estimated edges, a comparison summary, per-series source labels, and limitations. A production
site exists at <https://orbitxi-lunar-landing-site-navigato.vercel.app>. Production runs commit `d4d8e68` (15 Nov, 04:01 SGT).

There are **no lunar south-pole sites in the app** yet. Two NASA 2023 regional reference points
(Nobile Rim 1, Malapert Massif) are prepared on a local branch and wait for review; see
`docs/south-pole-reference-plan.md`. They are region-polygon centres, not landing sites.

On 15 Nov three interface changes went live: the chart axis is fitted to the data (with a ±5° view
around the horizon), Site A is solid and Site B dashed with text labels, and the form explains the
request limits before anything is sent. The page footer now shows the deployed commit.

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
| Chart axis fitted to the data; ±5° near-horizon view | 8 unit tests; on production the two near-polar test locations give a Sun axis of −4° to 8° instead of a flattened line |
| Site A solid, Site B dashed, named in legend, pickers and table | Checked in the page on production (line dash pattern and text) |
| Request size shown; requests over 2,000 samples per series or 62 days refused in the form | 5 unit tests, one comparing the form's decision with the server's for 350 day/interval combinations; on production 62 days at 30 minutes shows the reason, disables the button and makes no call |
| Whole-month queries near the pole | Sun and Earth at −85.44° and −85.99°, 30 days hourly: 721 rows each; production output equal to a direct Horizons request |
| Tests, lint, typecheck, production build | 121 tests pass; ESLint clean; `tsc --noEmit` clean; `next build` succeeds (15 Nov, `main`) |

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
- 15 Nov, 04:02–04:04 SGT, build `d4d8e68`: 13 developer checks passed on production (page and
  build id, live comparison, line styles, request-limit warning with no call made, server limits,
  archive, custom near-polar locations, partial failure, equality with Horizons, console, 375 px
  width). This is a developer smoke run, not the team's QA: Sean's 28 cases are NOT RUN.

## Team inputs (reviewed 14 Nov, 18:20 SGT)

Teammates' files are kept outside this repository. Summary of what they mean for the app:

| Area | Received | Result of review | Effect on the app |
|---|---|---|---|
| NASA data (Baoyi) | Source shortlist, retrieval inventory, integration notes | Accepted. Her untested Horizons request has the same form as the app's verified request | None. South-pole coordinates were not part of these rounds and are still missing |
| Science (Yi) | Definitions, 11-test matrix, methods | Definitions accepted; they equal the app's provisional rule (disc centre, no refraction, strictly above 0°, gaps break windows). All 11 tests are NOT RUN | None yet. Thresholds stay PROVISIONAL |
| UX (Tan) | Preliminary flow and wireframe | Pending his revision; not a sign-off | None. The design assumes a terrain skyline and a 90-day span; the app has no terrain and a 62-day limit |
| Video (Zhang) | Concept, storyboard, narration and caption drafts, credits, placeholder animatic, editable timeline | Accepted with one wording check | None. The animatic is a placeholder, not the submission video |
| QA (Sean) | — | In progress | — |

Open points raised by the review:

- Horizons labels its time scale UT; the app labels it UTC. To be ruled on in the science review.
- Some of Yi's tests need 1-minute sampling, an offset-time input, or injected series; the app has
  a 10-minute minimum step, UTC-only input and no injection. They need adapting or a direct
  Horizons reference.
- The video's opening line gives a maximum Sun elevation that holds at the pole itself; it must be
  checked against the sites actually shown (T-24).
- Two different addresses for QuickMap appear in teammates' files and in our documents; to be
  checked against the challenge Resources tab before final credits.

## Team inputs on 15 Nov

Asher's acceptance report of 15 Nov records new files from Yi (R3 review, scoped sign-off, data
archive), Tan (R1 v10, R2 v2) and Sean (submission checklist, 28-case test matrix). Those files
are not on the development computer. So far:

- Yi's 74-row comparison and window checks have **not been reproduced** by the developer.
- Tan's three quick wins were implemented from their description, not from his specification.
- Sean's 28 cases are **NOT RUN**.
- Yi's sign-off, as reported, covers the tested geometric and API cases only. It does not cover the
  south-pole reference points, the frame of their source, near-polar window reliability, or the video.

## Not verified

- Behaviour on a real phone (375 px emulation only; the horizon label overlaps the lines slightly at that width).
- The two NASA table rows for the reference points: the NASA document could not be opened from the
  development computer (HTTP 403), so the numbers are as supplied by Asher.
- Longitude convention, frame and height of those points (T-27).
- Rise and set times near the pole: 107–129 of 721 hourly samples per series lie within ±1° of the
  horizon, so the windows are sensitive to threshold, height and terrain.
- Scientific correctness of thresholds, frames, and site heights — awaiting Yi (see `SCIENTIFIC_HANDOFF.md`). Unit tests passing is not scientific validation.
- Horizons behaviour under sustained load; its rate limits are undocumented.

## Not implemented

- South-pole presets on production (T-10; prepared on a local branch).
- Science-approved thresholds (T-06).
- Shaded windows on charts, sky-position view, animation.
- The rest of Tan's UI specification (three items done, T-25).
- Terrain-aware visibility — out of scope for the MVP.

## Material available for the demo video

| Item | Status |
|---|---|
| Public app URL | <https://orbitxi-lunar-landing-site-navigato.vercel.app> |
| Repository | <https://github.com/dingchengzhu25-cmd/OrbitXI-Lunar-Landing-Site-Navigator-1> |
| Screenshots | `docs/screenshots/` — development screenshots from the local build, for reference only |
| Approved wording | "Geometric centre-of-disc visibility only. Terrain obstruction, solar panel output and communication link quality are NOT modeled." |

Not ready to record: no south-pole point is on production yet (T-27, T-10).

## Blockers

- Review of the two reference points before they can go to production (Yi, T-27).
- Teammates' new files (Yi, Tan, Sean) are not on the development computer.
- Decisions for the video: demo sites and dates, recording plan, voice, editor (T-23).

## Dependency audit (14 Nov)

`npm audit` reports 7 moderate findings. All come from one advisory (minimatch,
GHSA-g3hv-75wg-m249, denial of service through crafted glob patterns) reached only through the
ESLint tooling (`typescript-eslint` packages). `npm audit --omit=dev` reports 0. Nothing in the
deployed app is affected, so no update was made.

## Log

### 15 Nov, 03:55–04:10 SGT

- Archived Asher's supplement on south-pole reference coordinates outside this repository.
  Could not open the NASA document to re-read the rows (HTTP 403 from NASA NTRS, three attempts).
- Horizons, 03:58 SGT: Sun and Earth for both points, 14 Nov–14 Dec hourly, 721 rows each. Sun stays
  between −3.1° and +6.1°, Earth between −3.0° and +10.3°.
- Interface changes (T-25) committed as `d4d8e68`, pushed 04:01:18; GitHub showed the Vercel status
  as success at 04:01:35; production footer showed `d4d8e68` at 04:02:50.
- Developer smoke run on production, 13 checks pass (T-28).
- Reference points prepared on local branch `south-pole-reference-points` (`dd7bed7`), not pushed.
- No email was read or sent.

### 14 Nov, 17:58–18:35 SGT

- Collected teammates' Round 1–2 files (10 downloads, SHA-256 recorded) and reviewed them against
  the mission briefs. Statuses are in "Team inputs" above; none is a final sign-off.
- No application change was needed. Tasks T-22 to T-24 added; T-05, T-06, T-11, T-15, T-17, T-20
  and T-21 statuses updated.
- 18:28 SGT: production home page returned 200 and a live Horizons query through the app returned
  data labelled `live`. Local and remote `main` both at `d490f6a` before this documentation commit.
- No teammate message newer than 17:29 SGT at the 18:28 check.

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
