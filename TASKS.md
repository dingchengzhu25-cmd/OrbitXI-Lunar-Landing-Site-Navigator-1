# Tasks

Priority: P0 = required to submit, P1 = important, P2 = if time allows.
Status: todo / doing / blocked / done. Times are SGT.

| ID | Task | Owner | Pri | Depends on | Due | Status |
|---|---|---|---|---|---|---|
| T-01 | Scaffold app, tests, public repo | Asher | P0 | — | 14 Nov 15:00 | done |
| T-02 | Verify Horizons Sun and Earth queries with real responses | Asher | P0 | — | 14 Nov 15:00 | done |
| T-03 | Vertical slice: one site, Sun elevation chart from live data | Asher | P0 | T-02 | 14 Nov 15:00 | done |
| T-04 | Deploy to Vercel and confirm public URL | Asher | P0 | T-01 | 14 Nov 17:00 | done — production verified 16:35; auto-deploy from `main` |
| T-05 | Supply two south-pole sites with cited coordinates | Baoyi | P0 | — | 14 Nov 18:00 | todo — no coordinates supplied yet; two unverified leads in `DATA_PROVENANCE_HANDOFF.md` |
| T-06 | Define sunlit and Earth-visible thresholds; confirm frame | Yi | P0 | — | 14 Nov 18:00 | doing — written definitions received 14 Nov and agree with the provisional rule; confirmation against the app pending (T-20) |
| T-07 | Add Earth elevation to the chart | Asher | P0 | T-03 | 14 Nov 18:00 | done |
| T-08 | Second site and side-by-side comparison | Asher | P0 | T-07 | 14 Nov 21:00 | done |
| T-09 | Geometric visibility windows and summary | Asher | P0 | T-06, T-07 | 14 Nov 22:00 | done with PROVISIONAL thresholds; final values need T-06 |
| T-10 | Add the cited south-pole sites as presets | Asher | P0 | T-05 | 15 Nov 10:00 | blocked (T-05) |
| T-11 | UI and visualization specification | Tan | P1 | — | 15 Nov 09:00 | doing — preliminary flow and wireframe received 14 Nov; revision expected; not a sign-off |
| T-12 | Apply UI specification | Asher | P1 | T-11, T-08 | 15 Nov 13:00 | todo — waits for the revised specification; no terrain skyline, no 90-day span |
| T-13 | Server-side caching of Horizons responses | Asher | P1 | T-08 | 15 Nov 11:00 | done |
| T-14 | Science spot check against Horizons web interface | Yi | P0 | T-10 | 15 Nov 15:00 | todo |
| T-15 | QA pass on the deployed app; submission checklist | Sean | P0 | T-10 | 15 Nov 16:00 | doing — in progress with Sean; nothing received yet |
| T-16 | Feature freeze | Asher | P0 | T-12 | 15 Nov 13:00 | todo |
| T-17 | Record 30-second demo video from the deployed app | Zhang | P0 | T-16 | 15 Nov 19:00 | doing — concept, storyboard, caption draft and placeholder animatic received 14 Nov; real footage waits for T-10 and T-16 |
| T-19 | Decide whether Apollo presets stay in the submitted app | Asher | P1 | — | 15 Nov 10:00 | done — keep, grouped as validation examples |
| T-20 | R3 scientific validation using `SCIENTIFIC_HANDOFF.md` worksheet | Yi | P0 | — | 15 Nov 12:00 | todo — Yi's 11-test matrix received, all NOT RUN; handoff evidence not yet sent to Yi (T-23) |
| T-21 | Confirm data provenance and wording using `DATA_PROVENANCE_HANDOFF.md` | Baoyi | P0 | — | 15 Nov 12:00 | todo — Baoyi's source inventory received; handoff evidence not yet sent to Baoyi (T-23) |
| T-22 | Collect and review teammates' Round 1–2 deliverables | Asher | P0 | — | 14 Nov 19:00 | done — 14 Nov 18:20; no app change required |
| T-23 | Send handoff evidence and answers to teammates (Yi, Baoyi, Tan; video decisions for Zhang) | Asher | P0 | T-22 | 14 Nov 22:00 | todo |
| T-24 | Science check of the video's opening line against the chosen demo sites | Yi | P0 | T-10 | 15 Nov 15:00 | todo |
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
- **T-23:** Yi and Baoyi have the handoff links; Tan has answers on sites, horizon model, time step and chart library; Zhang has decisions on demo sites, recording, voice and editor.
- **T-24:** the on-screen statement about maximum Sun elevation is consistent with the Sun elevations the app shows for the demo sites.
- **T-17:** video shows only the real deployed app and makes no claim beyond `DATA_SOURCES.md`.
