# Architecture

## Overview

```
Browser (React client components, Recharts)
   │  GET /api/ephemeris?target&lon&lat&alt&start&stop&stepMin
   ▼
Next.js route handler (server)
   │  validate input → build Horizons URL → fetch with 20 s timeout
   ▼
NASA/JPL Horizons API  (https://ssd.jpl.nasa.gov/api/horizons.api)
   │  JSON wrapper around a text observer table
   ▼
Parser → checks (target, site, frame, time order) → JSON time series → chart
```

No database, no authentication, no environment variables, no paid services.

## Why a server-side proxy

A test response from Horizons on 2026-11-14 carried no `Access-Control-Allow-Origin` header, so a
browser cannot call it directly. The route handler also gives one place for validation, limits,
error messages, and provenance.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 3 |
| Tests | Vitest |
| Hosting | Vercel, <https://orbitxi-lunar-landing-site-navigato.vercel.app>; pushes to `main` of <https://github.com/dingchengzhu25-cmd/OrbitXI-Lunar-Landing-Site-Navigator-1> publish to production |

## Source layout

```
src/app/page.tsx                  Page shell
src/app/api/ephemeris/route.ts    Live Horizons proxy
src/app/api/sample/route.ts       Archived real response, labelled as archive
src/components/                   Site pickers, charts, comparison table, provenance, limitations
src/lib/horizons/request.ts       Input validation, limits, Horizons parameter builder
src/lib/horizons/parse.ts         Observer-table parser and header metadata
src/lib/horizons/client.ts        Fetch, timeout, error mapping, cache and source labels
src/lib/sites.ts                  Site presets, each with a cited coordinate source
src/lib/visibility.ts             Sampled geometric visibility, estimated edges, site comparison
src/lib/comparison.ts             Loads the four series independently; browser-side checks
src/lib/horizons/cache.ts         Bounded TTL cache, request coalescing, concurrency limit
src/lib/horizons/verify.ts        Response-vs-request check shared by server and browser
src/lib/samples.ts                Loader for archived responses
src/data/samples/                 Unmodified Horizons responses with retrieval metadata
scripts/fetch-sample.mjs          Reproducible capture of a real response
```

## Request limits

Enforced in `request.ts` to keep each call small: step 10–1440 minutes, range up to 62 days, at
most 2000 rows, dates 1950–2100, height −10 to 20 km. These are app choices, not Horizons limits.

## Failure behaviour

- Invalid input → HTTP 400 with a readable message.
- Horizons timeout → 504; unreachable, HTTP error, no table, unexpected format, or a table that
  does not match the requested body or site → 502. Horizons answers HTTP 200 even for failed
  queries, so success is decided by the presence and validity of the data table.
- The UI names each failed series, leaves it blank, and still shows the series that loaded. It
  never substitutes data. The user may explicitly load archived real responses, which are
  labelled ARCHIVED with their retrieval time and only ever shown for the sites they belong to.

## Decisions

| Decision | Reason |
|---|---|
| Horizons as the only MVP data source | Named in the challenge Resources; gives Sun and Earth angles for a Moon-surface site directly |
| Server-side proxy instead of browser calls | No CORS header observed |
| No terrain model in MVP | Out of reach in two days for one developer; stated clearly in the UI |
| In-memory cache (6 h, 200 entries), no CDN caching | Repeats should not hit JPL again, and every response must carry an honest LIVE/CACHED label. Per-instance only on serverless; lost on cold start |
| At most 2 concurrent Horizons calls per server instance and per browser | Horizons rate limits are undocumented; stay polite |
| Each of the four series loads and fails on its own | A partial failure is shown by name instead of blanking or faking the comparison |
| Windows computed in the browser from the returned series | Keeps the server a thin, verifiable proxy |
