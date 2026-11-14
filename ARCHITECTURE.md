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
| Hosting | Vercel (planned), deployed from GitHub |

## Source layout

```
src/app/page.tsx                  Page shell
src/app/api/ephemeris/route.ts    Live Horizons proxy
src/app/api/sample/route.ts       Archived real response, labelled as archive
src/components/                   Site pickers, charts, comparison table, provenance, limitations
src/lib/horizons/request.ts       Input validation, limits, Horizons parameter builder
src/lib/horizons/parse.ts         Observer-table parser and header metadata
src/lib/horizons/client.ts        Fetch, timeout, error mapping, response-vs-request checks
src/lib/sites.ts                  Site presets, each with a cited coordinate source
src/lib/windows.ts                Geometric above-threshold intervals and summaries
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
- The UI shows the message and no chart. It never substitutes data. The user may explicitly load
  an archived real response, which is banner-labelled with its retrieval time.

## Decisions

| Decision | Reason |
|---|---|
| Horizons as the only MVP data source | Named in the challenge Resources; gives Sun and Earth angles for a Moon-surface site directly |
| Server-side proxy instead of browser calls | No CORS header observed |
| No terrain model in MVP | Out of reach in two days for one developer; stated clearly in the UI |
| In-memory cache (6 h) plus `s-maxage=3600` | A comparison makes four Horizons queries; repeats should not hit JPL again. Cached entries keep their original retrieval time |
| Client sends the four queries one at a time | Horizons rate limits are undocumented; stay polite |
| Windows computed in the browser from the returned series | Keeps the server a thin, verifiable proxy |
