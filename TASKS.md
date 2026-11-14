# Tasks

Priority: P0 = required to submit, P1 = important, P2 = if time allows.
Status: todo / doing / blocked / done. Times are SGT.

| ID | Task | Owner | Pri | Depends on | Due | Status |
|---|---|---|---|---|---|---|
| T-01 | Scaffold app, tests, public repo | Asher | P0 | — | 14 Nov 15:00 | done |
| T-02 | Verify Horizons Sun and Earth queries with real responses | Asher | P0 | — | 14 Nov 15:00 | done |
| T-03 | Vertical slice: one site, Sun elevation chart from live data | Asher | P0 | T-02 | 14 Nov 15:00 | done |
| T-04 | Deploy to Vercel and confirm public URL | Asher | P0 | T-01 | 14 Nov 17:00 | done — production verified 16:35; auto-deploy from `main` |
| T-05 | Supply two south-pole sites with cited coordinates | Baoyi | P0 | — | 14 Nov 18:00 | doing — Baoyi's rounds did not include coordinates. On 15 Nov Asher supplied two rows of NASA ACD-50044 Table A2-2 (regional reference points, not landing sites); source rows not yet re-read independently (T-27) |
| T-06 | Define sunlit and Earth-visible thresholds; confirm frame | Yi | P0 | — | 14 Nov 18:00 | done for the tested scope — Yi's R3 (14 Nov 21:03) accepts disc centre, strictly above 0°, 0° not visible, ±1° caution band; frame conversion and polar step stay open (T-27) |
| T-07 | Add Earth elevation to the chart | Asher | P0 | T-03 | 14 Nov 18:00 | done |
| T-08 | Second site and side-by-side comparison | Asher | P0 | T-07 | 14 Nov 21:00 | done |
| T-09 | Geometric visibility windows and summary | Asher | P0 | T-06, T-07 | 14 Nov 22:00 | done with PROVISIONAL thresholds; final values need T-06 |
| T-10 | Add the cited south-pole sites as presets | Asher | P0 | T-05 | 15 Nov 10:00 | doing — prepared on local branch `south-pole-reference-points`, not merged; gates in `docs/south-pole-reference-plan.md` |
| T-11 | UI and visualization specification | Tan | P1 | — | 15 Nov 09:00 | done — R1 v10 and R2 v2 received 14 Nov 20:30, accepted as design documentation |
| T-12 | Apply UI specification | Asher | P1 | T-11, T-08 | 15 Nov 13:00 | doing — compared with R2 v2 on 15 Nov: 3 P0 items built, 3 partly, 2 not (T-31) |
| T-13 | Server-side caching of Horizons responses | Asher | P1 | T-08 | 15 Nov 11:00 | done |
| T-14 | Science spot check against Horizons web interface | Yi | P0 | T-10 | 15 Nov 15:00 | done for Apollo 11 and 17 — Yi's 74-row comparison and two sunrise brackets reproduced independently on build 86e8f04 (15 Nov 04:25); not done for south-pole points |
| T-15 | QA pass on the deployed app; submission checklist | Sean | P0 | T-10 | 15 Nov 16:00 | doing — Sean's checklist and 28-case matrix received 15 Nov 02:40; see T-29 |
| T-16 | Feature freeze | Asher | P0 | T-12 | 15 Nov 13:00 | todo |
| T-17 | Record 30-second demo video from the deployed app | Zhang | P0 | T-16 | 15 Nov 19:00 | doing — concept, storyboard, caption draft and placeholder animatic received 14 Nov; real footage waits for T-10 and T-16 |
| T-19 | Decide whether Apollo presets stay in the submitted app | Asher | P1 | — | 15 Nov 10:00 | done — keep, grouped as validation examples |
| T-20 | R3 scientific validation using `SCIENTIFIC_HANDOFF.md` worksheet | Yi | P0 | — | 15 Nov 12:00 | done — Yi's R3 review received and reproduced; her open items carried to T-27 |
| T-21 | Confirm data provenance and wording using `DATA_PROVENANCE_HANDOFF.md` | Baoyi | P0 | — | 15 Nov 12:00 | todo — Baoyi's source inventory received; handoff evidence not yet sent to Baoyi (T-23) |
| T-22 | Collect and review teammates' Round 1–2 deliverables | Asher | P0 | — | 14 Nov 19:00 | done — 14 Nov 18:20; no app change required |
| T-23 | Send handoff evidence and answers to teammates (Yi, Baoyi, Tan; video decisions for Zhang) | Asher | P0 | T-22 | 14 Nov 22:00 | todo |
| T-24 | Science check of the video's opening line against the chosen demo sites | Yi | P0 | T-10 | 15 Nov 15:00 | todo |
| T-25 | Chart axis fitted near the horizon; Site A solid, Site B dashed with text labels; request limits explained before sending | Asher | P0 | T-11 | 15 Nov 10:00 | done — 15 Nov 04:04, commit d4d8e68, verified on production |
| T-26 | Whole-month Horizons test at the two near-polar reference coordinates | Asher | P0 | — | 15 Nov 10:00 | done — 15 Nov 03:58; 721 rows per series; production equals direct Horizons |
| T-27 | Review the two reference points: read the NASA table, confirm longitude convention, frame and the 0 km assumption, approve wording | Yi | P0 | T-05 | 15 Nov 12:00 | todo |
| T-28 | Developer smoke run on production with build id, inputs and results recorded | Asher | P0 | T-25 | 15 Nov 10:00 | done — 15 Nov 04:04, 13 checks pass on build d4d8e68; this is not Sean's QA |
| T-29 | Run Sean's 28-case matrix on production once his files are available locally | Sean, Asher | P0 | T-16 | 15 Nov 16:00 | doing — run by the developer on build 86e8f04, 15 Nov 04:26–04:30; QA20 re-run on b81bca8 at 04:41: 24 PASS, 0 FAIL, 3 BLOCKED (no video), 1 NOT RUN (official form). Not yet confirmed by Sean |
| T-30 | README: list third-party software and licences, disclose AI use, state azimuth convention (QA20 fail) | Asher | P0 | — | 15 Nov 14:00 | done — 15 Nov 04:41, commit b81bca8; QA20 re-run passes. Asher to confirm the AI-use paragraph matches the team's actual use |
| T-31 | Remaining P0 items of Tan's R2 v2: tooltip format, inline validation, per-series loading and "settings changed" notice | Asher | P1 | T-12 | 15 Nov 13:00 | todo |
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
- **T-25:** near-polar series fill the chart; the two sites are distinguishable without colour; a request over 2,000 samples per series or 62 days is refused in the form with the reason and no call is made; the server check is unchanged.
- **T-27:** each gate in `docs/south-pole-reference-plan.md` is marked with who checked it and when.
- **T-29:** every case has PASS, FAIL or NOT RUN with the build id, input and evidence.
- **T-30:** README credits name every third-party library with its licence and say where AI tools were used; QA20 re-run passes.
- **T-23:** Yi and Baoyi have the handoff links; Tan has answers on sites, horizon model, time step and chart library; Zhang has decisions on demo sites, recording, voice and editor.
- **T-24:** the on-screen statement about maximum Sun elevation is consistent with the Sun elevations the app shows for the demo sites.
- **T-17:** video shows only the real deployed app and makes no claim beyond `DATA_SOURCES.md`.
