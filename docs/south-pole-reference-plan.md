# South-pole regional reference points — integration plan

Status on 15 Nov 2026, 16:50 SGT: **on a review branch with a draft pull request; not merged, not on production.**
Science review: conditional go for an approximate regional geometric comparison only (see `DATA_SOURCES.md`). The merge needs Asher's explicit approval.
Asher decided on 15 Nov to show these points as the primary demonstration, with Apollo 11 / 17 as the verified fallback, once the gates below are met.

## What would be added

Two presets in their own group, "NASA 2023 Regional Reference Points — Lunar South Pole":

| Preset | Latitude | Longitude as printed | Height | Cited as |
|---|---|---|---|---|
| Nobile Rim 1 — NASA 2023 regional reference point | −85.4381° | +37.36667° | 0 km, assumed | NASA ACD-50044 Rev A (2023), Appendix A2, Table A2-2, R06 / Site06 |
| Malapert Massif — NASA 2023 regional reference point | −85.9948° | −0.23578° | 0 km, assumed | same table, R23 / Site23 |

The coordinates come from research supplied by Asher on 15 Nov. They are centres of named region
polygons in a 2023 reference table. They are not exact landing points and not NASA-approved landing sites.

## Where the work is

Branch `south-pole-reference-points`, rebased on `main` at `da01b5a` and pushed for review on 15 Nov. It changes `src/lib/sites.ts`, `src/lib/sites.test.ts` and
`src/components/SiteComparison.tsx` only.

- New site kind `south-pole-regional-reference`; the existing "South Pole Candidates" kind stays empty.
- Badge on each point: "NASA 2023 regional reference point — NOT a NASA-approved landing site;
  geometric model only, no terrain".
- A notice under the site pickers with the same limits, and the NASA document in the data-source list.
- The default selection stays Apollo 11 and Apollo 17. A reference point is shown only if the user picks it.
- 6 new unit tests: coordinates unchanged from the transcription, citation, wording (never
  "candidate", never "landing" without "NOT"), assumed height and unconfirmed frame stated, own
  group and not default, request accepted by the server with −0.23578° mapped to 359.76422° E.
- On that branch: 127 tests pass, ESLint clean, `tsc --noEmit` clean, `next build` succeeds.

## Gates before merging to `main`

| # | Gate | Owner | State |
|---|---|---|---|
| 1 | The two rows are read from the NASA PDF itself by someone on the team | Asher | **done 15 Nov** — Asher confirmed both rows from the PDF's searchable text (document page 59 of 70). Corroborated from NASA GSFC PGDA map headers. A visual look at the table page is still desirable (the page image could not be retrieved) |
| 2 | Longitude convention of the table (east-positive, ±180°) | Yi | **conditional (15 Nov)** — Horizons normalisation verified; the table's own convention not formally confirmed. Wording must not state the sign as settled |
| 3 | Frame of the table compared with Horizons `MEAN_ME` | Yi | **conditional (15 Nov)** — convention documented; no error bound. Suitable for an approximate regional comparison only |
| 4 | Height: accept the 0 km assumption with its wording, or supply a value with a source | Yi | **conditional (15 Nov)** — accepted as a stated, unmeasured assumption |
| 5 | Wording of the badge and notice approved | Yi, Asher | Yi: acceptable once the "few degrees" sentence was replaced (done on the branch, 15 Nov). **Asher's explicit merge approval: open** |
| 9 | Polar sampling | Yi | **conditional (15 Nov)** — hourly vs 10-minute crossings within 3.14 s on the smooth sphere, reproduced by the developer; physical accuracy not verified |
| 8 | Production QA after merge: Sean's case QA26 and a smoke run on the new build | developer, Sean | open |
| 6 | Horizons returns a full month for both points | developer | done 15 Nov — 721 hourly rows per series; production output equal to direct Horizons |
| 7 | Tests, lint, type check, build | developer | done on the branch |

Wording note: the NASA document describes the points as centre points of the original region
polygons, derived from PGDA DEM files; they coincide with the centres of the PGDA map tiles. The
branch uses the document's description.

## How to merge

```
git checkout main
git merge --no-ff south-pole-reference-points   # or merge the pull request
npm test && npm run lint && npx tsc --noEmit && npm run build
git push origin main
```

Then check the Vercel status of the pushed commit, open production, confirm the footer build id and
run the comparison for the two points.

## How to undo

- Before merging: `git branch -D south-pole-reference-points`. Nothing else is affected.
- After merging: `git revert <merge or commit id>` and push. The change is one commit and touches no
  data files, no API code and no stored responses. Alternatively empty `REGIONAL_REFERENCE_PRESETS`
  in `src/lib/sites.ts`: the group, the notice and the data-source line all disappear with it.

## What the numbers look like (smooth sphere, height 0 km, 14 Nov–14 Dec 2026, hourly)

| Point | Sun elevation | Earth elevation | Samples within ±1° of the horizon |
|---|---|---|---|
| Nobile Rim 1 | −3.11° to +6.10° | −3.02° to +9.71° | Sun 107, Earth 125 of 721 |
| Malapert Massif | −2.57° to +5.53° | −2.85° to +10.26° | Sun 129, Earth 118 of 721 |

Both bodies stay within about 10° of the horizon all month. Real ridges and crater rims at these
latitudes are several degrees high, so the geometric windows are not a prediction of actual
sunlight or of line of sight to Earth. The app must keep saying so wherever these points appear.
