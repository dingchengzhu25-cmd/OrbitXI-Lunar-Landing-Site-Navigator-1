# Lunar Landing Site Navigator

Team **OrbitXI** — NASA Space Apps Challenge 2026, challenge
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).

A web app for comparing candidate lunar landing sites and dates by showing where the Sun and
Earth sit relative to the local horizon, using ephemeris data from the
[NASA/JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/).

**Live app:** <https://orbitxi-lunar-landing-site-navigato.vercel.app>

## Current status

See [PROGRESS.md](PROGRESS.md) for the verified feature list. In short: two sites can be compared
over the same dates, with Sun and Earth elevation charts and geometric visibility metrics from live
Horizons data. Lunar south-pole candidate sites have not been added yet.

## What the numbers mean

The app reports **geometric** angles above the horizontal plane of a smooth reference sphere.
It does not model terrain, so it cannot say whether a mountain or crater rim blocks the Sun or
Earth. It does not estimate electrical power, thermal conditions, or guarantee communications.
Details and sources are in [DATA_SOURCES.md](DATA_SOURCES.md).

## Run locally

Requires Node.js 20.19 or newer. No API keys or environment variables are needed.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 102 tests; the network is replaced by real archived Horizons responses
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

## Credits

Ephemeris data: NASA/JPL Horizons System. This project is not affiliated with or endorsed by NASA.
