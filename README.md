# Lunar Landing Site Navigator

Team **OrbitXI** — NASA Space Apps Challenge 2026, challenge
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).

A web app for comparing candidate lunar landing sites and dates by showing where the Sun and
Earth sit relative to the local horizon, using ephemeris data from the
[NASA/JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/).

**Live app:** <https://orbitxi-lunar-landing-site-navigato.vercel.app>

**Repository:** <https://github.com/dingchengzhu25-cmd/OrbitXI-Lunar-Landing-Site-Navigator-1>

## Current status

See [PROGRESS.md](PROGRESS.md) for the verified feature list. In short: two sites can be compared
over the same dates, with Sun and Earth elevation charts and geometric visibility metrics from live
Horizons data. Two NASA 2023 regional reference points near the lunar south pole can be selected;
they are not landing sites, and no south-pole candidate site is claimed.

## What the numbers mean

The app reports **geometric** angles above the horizontal plane of a smooth reference sphere.
It does not model terrain, so it cannot say whether a mountain or crater rim blocks the Sun or
Earth. It does not estimate electrical power, thermal conditions, or guarantee communications.
Elevation is measured in degrees from that horizontal plane; negative values are below it. Horizons
also returns azimuth, measured clockwise from north; the app does not display azimuth. All times
are UTC. Details and sources are in [DATA_SOURCES.md](DATA_SOURCES.md).

## Run locally

Requires Node.js 20.19 or newer. No API keys or environment variables are needed.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests; the network is replaced by real archived Horizons responses
npm run build      # production build
```

## Documentation

| File | Contents |
|---|---|
| [PROJECT_BRIEF.md](PROJECT_BRIEF.md) | Goal, scope, team roles |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the app is put together |
| [DATA_SOURCES.md](DATA_SOURCES.md) | NASA data used, tested requests, caveats, open questions |
| [TASKS.md](TASKS.md) | Work items and owners |
| [PROGRESS.md](PROGRESS.md) | What is verified, in progress, and not done |
| [SCIENTIFIC_HANDOFF.md](SCIENTIFIC_HANDOFF.md) | Sample data, visibility results, and the science validation worksheet |
| [DATA_PROVENANCE_HANDOFF.md](DATA_PROVENANCE_HANDOFF.md) | Which NASA data is integrated and verified; what is still needed |

## Credits and compliance

This project is not affiliated with or endorsed by NASA. Last checked: 15 November 2026.

### NASA Data & Scientific Attribution

**Integrated — the app's output depends on these:**

| Source | Use |
|---|---|
| [NASA/JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/), through the [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Every Sun and Earth position shown (observer tables for a site on the Moon; ephemeris DE441, as reported in each response). Each result in the app links to the exact request. Horizons is listed in the challenge Resources. |
| [NASA NSSDCA, Apollo Landing Site Coordinates](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html) | Coordinates of the six Apollo sites offered as validation examples |
| NASA Artemis Campaign Development, *Lunar Surface Data Book*, ACD-50044 Rev A (2023), Appendix A2, Table A2-2 ([NASA NTRS](https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf)) | Coordinates of the two regional reference points (Nobile Rim 1, Malapert Massif): centre points of region polygons, not landing sites; height not given, 0 km assumed |
| [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html) | The surface-site example (Tycho crater) used to test the data pipeline |

Six unmodified Horizons responses are stored in `src/data/samples/` and four in
`docs/handoff-data/`, each with its request and retrieval time.

**Researched only — not used by the app:**

| Source | Status |
|---|---|
| [NASA GSFC PGDA, High-Resolution LOLA Topography for Lunar South Pole Sites](https://pgda.gsfc.nasa.gov/products/78) | Map headers read once to cross-check the two reference coordinates. No elevation data is used. |
| [LROC QuickMap](https://quickmap.lroc.im-ldi.com/), [NASA Moon Trek](https://trek.nasa.gov/moon/), [CSA Moon Exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | Listed by the challenge; read for background; not used |

**Not integrated:** LOLA or any other terrain data, SPICE kernels, imagery. The app has no terrain
model and performs no SPICE calculation.

Review status: a team member compared 74 rows of app output with direct Horizons requests and
checked two sunrise times; the developer reproduced that comparison. The coordinate frame of cited
sites against the frame Horizons uses, and the behaviour of visibility windows near the pole, have
not been validated. Details are in [PROGRESS.md](PROGRESS.md).

### Third-Party Software & Licenses

Licences were read from each package's own licence file and `package.json` in the installed
version, on 15 November 2026.

| Package | Version | Licence | Use |
|---|---|---|---|
| [Next.js](https://nextjs.org) | 16.4.6 | [MIT](https://github.com/vercel/next.js/blob/canary/license.md) | Web framework and server routes |
| [React](https://react.dev/) and React DOM | 19.3.0 | MIT | User interface |
| [Recharts](https://github.com/recharts/recharts) | 3.10.1 | [MIT](https://github.com/recharts/recharts/blob/main/LICENSE) | Charts |
| [Tailwind CSS](https://tailwindcss.com) | 4.3.3 | MIT | Styling (build time) |
| [TypeScript](https://www.typescriptlang.org/) | 5.9.3 | Apache-2.0 | Development |
| [Vitest](https://vitest.dev) | 5.1.0 | MIT | Tests |
| [ESLint](https://eslint.org) with eslint-config-next | 9.39.5 / 16.4.6 | MIT | Code checks |

Packages installed indirectly by the ones above (95 production entries in `package-lock.json`,
which records every exact version): MIT, ISC, BSD-3-Clause, 0BSD and Apache-2.0 for the code the
app runs, including the D3 modules that Recharts uses; `caniuse-lite` is CC-BY-4.0; the optional
image library `sharp` that Next.js installs is Apache-2.0 with LGPL-3.0-or-later components
(libvips). The app serves no images, so that library processes nothing here.

No code was copied from other projects into `src/`. The project was started from the
`create-next-app` template of Next.js (MIT).

Hosting: [Vercel](https://vercel.com). Source hosting: GitHub.

### External Media & Credits

| Item | Where | Source and licence |
|---|---|---|
| Geist and Geist Mono typefaces | All text; loaded through `next/font/google` | Vercel; [SIL Open Font License 1.1](https://fonts.google.com/specimen/Geist/license) |
| `src/app/favicon.ico` | Browser tab icon | The default icon that came with the `create-next-app` template; not designed by the team |
| `docs/screenshots/*.jpg` | Repository only | Screenshots of this app, taken by the team |

The app contains no photographs, NASA imagery, logos, video, music or other audio.

**Demo video: PENDING.** No final video exists yet. Its footage, images, music, narration, captions
and the tools used to make it, with the licence or permission for each, will be listed here before
submission. Nothing about it is claimed now.

### AI Assistance Disclosure

AI tools were used throughout this project. What they produced was checked as described below; it
was not accepted on trust.

| Tool | Used for |
|---|---|
| Claude Code (Anthropic) | Writing the application code, tests and repository documentation; running tests, builds and deployments; browser checks of the deployed app; reviewing teammates' documents |
| ChatGPT (OpenAI) | Project planning and task briefs, team correspondence, research on data sources |
| AI assistants chosen by individual team members | Team members were invited in their task briefs to use an AI assistant when preparing their own documents (research notes, science review, design specification, QA plan, video storyboard). Which tool each person used has not been individually confirmed; one design prototype is known to have been built as a Claude artifact. |

How the output was verified, and what was not:

- **Where each displayed value comes from.** No AI model generates any value or prediction shown
  by the app.
  - Sun and Earth azimuth and elevation are NASA/JPL Horizons output, passed through unchanged.
    This was checked by comparing app output row by row with direct Horizons requests (see
    [PROGRESS.md](PROGRESS.md)).
  - Visibility counts, windows, estimated rise and set times and durations are **calculated by
    this project's code** (`src/lib/visibility.ts`) from those elevations, by fixed rules: disc
    centre strictly above 0°, straight-line interpolation between neighbouring samples. They are
    not Horizons output and they are estimates.
  - Site coordinates are **not** from Horizons. Preset coordinates come from the sources cited
    beside each preset; custom coordinates are whatever the user types and are labelled unverified.
  - Site height is an **assumption** (0 km above the 1737.4 km reference sphere) for every preset,
    because the cited sources give no height; a user may enter another value.
  - The 0° threshold and the ±1° caution band are parameters chosen by the team, reviewed for the
    tested cases only.
- Code: automated unit tests, lint, type check and production build run before each release.
- **Testing was automated or AI-assisted and directed by the developer.** The team's QA test
  matrix was executed with Claude Code on the deployed app. It has not yet been repeated by a
  person independently, and this README does not claim that it has.
- Science: definitions and a sample of results were reviewed by a team member; the open points
  are listed under "NASA Data & Scientific Attribution" above.
- The app contains no AI-generated images, video or audio, and no NASA logos or branding. If the
  demo video uses AI-generated material, it will be marked and listed under "External Media &
  Credits".
