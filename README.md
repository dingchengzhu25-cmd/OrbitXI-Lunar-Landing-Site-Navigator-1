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
Horizons data. Lunar south-pole candidate sites have not been added yet.

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

## Credits

This project is not affiliated with or endorsed by NASA.

### NASA data and resources

| Resource | Use in this project |
|---|---|
| [NASA/JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) and its [API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Source of every Sun and Earth position shown. Each result links to the exact request. Listed in the challenge Resources. |
| [NASA NSSDCA, Apollo Landing Site Coordinates](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html) | Coordinates of the six Apollo validation sites |
| [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html) | Surface-site example (Tycho crater) used to test the data pipeline |

### Software

| Package | Version | Licence | Use |
|---|---|---|---|
| [Next.js](https://nextjs.org) | 16.4.6 | MIT | Web framework and server routes |
| [React](https://react.dev/) and React DOM | 19.3.0 | MIT | User interface |
| [Recharts](https://github.com/recharts/recharts) | 3.10.1 | MIT | Charts |
| [Tailwind CSS](https://tailwindcss.com) | 4.3.3 | MIT | Styling |
| [Geist and Geist Mono](https://vercel.com/font) typefaces, loaded through `next/font` | — | SIL Open Font License 1.1 | Text |
| [TypeScript](https://www.typescriptlang.org/) | 5.9.3 | Apache-2.0 | Development |
| [Vitest](https://vitest.dev) | 5.1.0 | MIT | Tests |
| [ESLint](https://eslint.org) with eslint-config-next | 9.39.5 / 16.4.6 | MIT | Code checks |

Exact versions of every package, including indirect ones, are in `package-lock.json`.
The app is hosted on [Vercel](https://vercel.com). It contains no third-party images, video or audio.

### Use of AI tools

- **Code, tests and documentation in this repository** were written with Claude Code (Anthropic)
  under the direction of the team lead, who reviewed the results. Automated tests and comparisons
  against direct NASA/JPL Horizons requests are described in [PROGRESS.md](PROGRESS.md).
- **Team planning, research notes and design documents** were prepared by team members with the
  help of AI assistants (ChatGPT and Claude). Those documents are not part of the application.
- **No data shown by the app is AI-generated.** Every number comes from a NASA/JPL Horizons
  response or is calculated from one by the code in `src/lib`.
- The app contains no AI-generated images, video or audio, and no NASA logos or branding.
