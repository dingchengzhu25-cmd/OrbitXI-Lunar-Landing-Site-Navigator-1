# Tasks

Priority: P0 = required to submit, P1 = important, P2 = if time allows.
Status: todo / doing / blocked / done. Times are SGT.

| ID | Task | Owner | Pri | Depends on | Due | Status |
|---|---|---|---|---|---|---|
| T-01 | Scaffold app, tests, public repo | Asher | P0 | — | 14 Nov 15:00 | done |
| T-02 | Verify Horizons Sun and Earth queries with real responses | Asher | P0 | — | 14 Nov 15:00 | done |
| T-03 | Vertical slice: one site, Sun elevation chart from live data | Asher | P0 | T-02 | 14 Nov 15:00 | done |
| T-04 | Deploy to Vercel and confirm public URL | Asher | P0 | T-01 | 14 Nov 17:00 | doing — URL live; confirming it serves the current commit |
| T-05 | Supply two south-pole sites with cited coordinates | Baoyi | P0 | — | 14 Nov 18:00 | todo |
| T-06 | Define sunlit and Earth-visible thresholds; confirm frame | Yi | P0 | — | 14 Nov 18:00 | todo |
| T-07 | Add Earth elevation to the chart | Asher | P0 | T-03 | 14 Nov 18:00 | done |
| T-08 | Second site and side-by-side comparison | Asher | P0 | T-07 | 14 Nov 21:00 | done |
| T-09 | Geometric visibility windows and summary | Asher | P0 | T-06, T-07 | 14 Nov 22:00 | done with PROVISIONAL thresholds; final values need T-06 |
| T-10 | Add the cited south-pole sites as presets | Asher | P0 | T-05 | 15 Nov 10:00 | blocked (T-05) |
| T-11 | UI and visualization specification | Tan | P1 | — | 15 Nov 09:00 | todo |
| T-12 | Apply UI specification | Asher | P1 | T-11, T-08 | 15 Nov 13:00 | todo |
| T-13 | Server-side caching of Horizons responses | Asher | P1 | T-08 | 15 Nov 11:00 | done |
| T-14 | Science spot check against Horizons web interface | Yi | P0 | T-10 | 15 Nov 15:00 | todo |
| T-15 | QA pass on the deployed app; submission checklist | Sean | P0 | T-10 | 15 Nov 16:00 | todo |
| T-16 | Feature freeze | Asher | P0 | T-12 | 15 Nov 13:00 | todo |
| T-17 | Record 30-second demo video from the deployed app | Zhang | P0 | T-16 | 15 Nov 19:00 | todo |
| T-19 | Decide whether Apollo presets stay in the submitted app | Asher | P1 | — | 15 Nov 10:00 | done — keep, grouped as validation examples |
| T-18 | Internal submission | Asher, Sean | P0 | T-15, T-17 | 15 Nov 21:00 | todo |

## Acceptance criteria for open P0 tasks

- **T-04:** production build succeeds on Vercel; the public URL loads; a live query draws a chart.
- **T-05:** each site has every field listed under "Baoyi" in `DATA_SOURCES.md`.
- **T-06:** written thresholds and frame confirmation, recorded in `DATA_SOURCES.md`.
- **T-07:** Sun and Earth series for one site on one chart, each labelled, values equal to Horizons.
- **T-08:** two sites shown together for the same date range; each query's provenance visible.
- **T-09:** windows computed with Yi's thresholds, labelled "geometric, no terrain"; unit tests pass.
- **T-10:** presets show name, coordinates, and source link; the Tycho example stays labelled as a test site.
- **T-14:** two times per site agree with the Horizons web interface to the printed precision.
- **T-15:** checklist of submission requirements completed against the official rules.
- **T-17:** video shows only the real deployed app and makes no claim beyond `DATA_SOURCES.md`.
