# Data Sources

## Resources listed by the challenge

Read from the challenge Resources tab on 2026-11-14.

| Resource | Provider | Used in this app |
|---|---|---|
| [Horizons System](https://ssd.jpl.nasa.gov/horizons/) | NASA/JPL | Yes — the only data source so far |
| [Quickmap](https://quickmap.lroc.asu.edu/) | Arizona State University, LRO data | No |
| [Moon Trek](https://trek.nasa.gov/moon/) | NASA | No |
| [Moon Exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | Canadian Space Agency | No |

## NASA/JPL Horizons API

- Endpoint: `https://ssd.jpl.nasa.gov/api/horizons.api`
- Documentation: <https://ssd-api.jpl.nasa.gov/doc/horizons.html>
- No API key.

### Parameter set in use

```
format=json
COMMAND='10' (Sun) or '399' (Earth)
OBJ_DATA='NO'  MAKE_EPHEM='YES'  EPHEM_TYPE='OBSERVER'
CENTER='coord@301'  COORD_TYPE='GEODETIC'
SITE_COORD='<east longitude deg>,<latitude deg>,<height km>'
START_TIME='YYYY-MM-DD HH:MM'  STOP_TIME='YYYY-MM-DD HH:MM'  STEP_SIZE='<n>m'
QUANTITIES='4'  TIME_TYPE='UT'  CSV_FORMAT='YES'
```

### VERIFIED by live requests on 2026-11-14

Unless a row says otherwise, tests used the Horizons manual's own example site (Tycho crater,
`348.8, -43.3, 0`), which is
**not** a landing candidate.

| Test | Result |
|---|---|
| Sun, 3 h, `STEP_SIZE='60m'` | Table returned; 4 rows; first row 2026-Nov-14 00:00 az 128.177285°, el −31.362965° |
| Earth, 3 h, `'60m'` | Table returned; first row az 13.319165°, el 41.268242° |
| Sun, `STEP_SIZE='1 h'` | Identical to `'60m'` |
| Invalid target | HTTP 200 with "No matches found" and no table — must be treated as an error |
| Sun, 30 days hourly | 721 rows, ordered, hourly; elevation −45.27° to 48.21° |
| Earth, 30 days hourly | 721 rows, ordered, hourly; elevation 37.88° to 52.50° |
| Sun and Earth at latitude −89.5°, and Sun at −90°, 6 h (generic coordinates, not candidate sites) | Tables returned; values change smoothly |
| Sun and Earth, Apollo 11 and Apollo 17 sites, 30 days hourly | 721 rows each |
| Sun and Earth, Apollo 17 site, 20–22 Nov, 2 h step, through the app and directly | 25 rows each; app output identical to Horizons, 0 mismatches |

Facts read from the response headers:

- API signature: `NASA/JPL Horizons API`, version 1.2.
- Target and observer ephemeris: DE441.
- Site frame: `MEAN_ME (high precision)`, east-longitude positive.
- Reference surface: sphere of radius 1737.4 km.
- `Atmos refraction: NO (AIRLESS)`.
- Time column is `Date__(UT)`, format `YYYY-Mon-DD HH:MM`.
- Quantity 4 columns are `Azi_(a-app)` and `Elev_(a-app)`: airless apparent azimuth (clockwise
  from north) and elevation of the target's centre.
- Each response names the Earth-orientation file used (for example `eop.261112.p270208`).
- Response time was about 0.6–1.1 s per request.
- No `Access-Control-Allow-Origin` header on the response tested.

Plausibility check: at latitude −43.3° the Sun can rise to about 90° − 43.3° ± 1.5° ≈ 48°, which
matches the 48.21° maximum. This is a sanity check, not a scientific validation.

### Archived samples

`src/data/samples/` holds six unmodified responses (Sun and Earth for the Tycho example, Apollo 11,
and Apollo 17 sites; 30 days hourly; retrieved 2026-11-14 between 06:14 and 06:52 UTC) with the
exact request and retrieval time. Recreate with
`scripts/fetch-sample.mjs`. Values may differ very slightly on later retrieval if JPL updates
Earth-orientation predictions.

### RESEARCHED BUT UNTESTED

- Whole-month ranges at polar latitudes (only 6-hour and 3-day polar tests so far).
- Ranges longer than 30 days and steps shorter than 30 minutes.
- Behaviour under many requests in quick succession.

### UNKNOWN

- Horizons rate and concurrency limits (not stated in the API documentation we read).
- Whether judges require data from the listed Resources only.

## Site coordinates

| Sites | Source | Notes |
|---|---|---|
| Apollo 11, 12, 14, 15, 16, 17 Lunar Modules | NASA NSSDCA, [Apollo Landing Site Coordinates](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html), read 2026-11-14 | Page states: planetocentric Mean Earth/Polar Axis system, DE421, from LRO images (Wagner et al., Icarus 283, 2017). No heights given; the app uses 0 km. Historical sites, not south-pole candidates. |
| Tycho crater example | JPL Horizons manual surface-site example | Pipeline verification only. |
| South-pole candidates | **None yet** | Waiting on Baoyi. |

The NSSDCA coordinates are in a DE421-based mean-Earth frame; Horizons reports `MEAN_ME` with
DE441. Whether the difference matters at our precision is a question for Yi.

## Geometric visibility (PROVISIONAL)

Implemented in `src/lib/visibility.ts`. Thresholds are configurable and marked PROVISIONAL until
Yi reviews them.

| Term | Current definition |
|---|---|
| Sun geometrically visible | Sun disc-centre elevation > 0° at a sample |
| Earth geometrically visible | Earth disc-centre elevation > 0° at a sample |
| Joint visibility | Both true at the same sampled UTC time |
| Boundary case | A sample within ±1° of the threshold; counted and shown, because its classification is sensitive |

How results are derived and what they can claim:

- **Sampled, not continuous.** Visibility is decided per sample. "N of M samples" is a count, not
  a measured duration.
- **Estimated edges.** A rise or set is placed by straight-line interpolation between the two
  adjacent samples where the state changed. It is shown with "≈" together with the two sample
  times that bracket it. The true geometric transition lies within that one sampling interval,
  assuming elevation changes smoothly between samples.
- **Durations are estimates** built from those edges. A window that begins or ends at the edge of
  the queried range is a lower bound.
- **Exactly 0°** counts as not visible.
- **Missing samples are never filled in.** A gap ends a window; no edge is estimated across it.
- **Joint visibility requires identical timestamps** in both series; otherwise it is not computed.
- **A failed series stays empty.** Its metrics read "not available" and no difference between
  sites is reported for it.

The Sun's disc is about 0.5° across and Earth's about 1.9° as seen from the Moon (general
astronomy values, not taken from our data), so "centre above 0°" differs from "any part of the
disc above 0°" for some minutes to hours near the poles. Which rule to use is Yi's decision.

## Caching and request handling

- In-memory cache in the server process: 200 entries at most, 6-hour lifetime, keyed by the exact
  Horizons URL built from the validated, normalised request.
- Identical requests in flight share one Horizons call. At most 2 Horizons calls run at once per
  server instance, and the browser sends at most 2 requests at a time.
- A reused response is labelled CACHED and keeps its original retrieval time. Failures are not cached.
- No HTTP/CDN caching: a CDN copy would still be labelled "live".
- **Limitation:** on Vercel each serverless instance has its own memory and loses it on a cold
  start. The cache reduces repeat queries; it does not guarantee them away. No database or
  external cache is used.

## What the elevation value means

Elevation is measured from the plane perpendicular to the local vertical of the reference sphere
at the site. It is **geometric**:

- **No terrain.** Real horizons near the lunar poles are shaped by mountains and crater rims. A
  positive elevation does not mean the Sun or Earth is actually visible.
- **Centre of the disc.** The Sun and Earth are extended discs; near 0° part of the disc can be
  above the horizon while the centre is below, and the reverse.
- **Site height.** A site above or below the 1737.4 km sphere sees a slightly different horizon.
  The app passes the height to Horizons but does not compute horizon dip.
- It says nothing about electrical power, temperature, or communication link quality.

## Open items for the team

**Baoyi — needed before any south-pole site appears in the app**

For each of the two candidate sites:

1. Site name.
2. Latitude and longitude, with the longitude convention (0–360° E or ±180°).
3. The coordinate frame, if stated (mean-Earth/polar-axis "ME" or principal-axis "PA").
4. Elevation relative to the 1737.4 km reference radius, if available.
5. A citable source: document title, publisher, URL, and the page or table.

**Yi — to confirm**

1. Whether Horizons `MEAN_ME` matches the frame of the cited coordinates.
2. The threshold for "geometrically sunlit" (centre above 0°, upper limb above 0°, or another value).
3. The threshold for "Earth geometrically visible".
4. Wording for the terrain limitation.
5. A manual spot check of two times per site against the Horizons web interface.
