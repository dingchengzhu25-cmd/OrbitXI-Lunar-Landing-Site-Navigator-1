# Data Sources

## Resources listed by the challenge

Read from the challenge Resources tab on 2026-11-14.

| Resource | Provider | Used in this app |
|---|---|---|
| [Horizons System](https://ssd.jpl.nasa.gov/horizons/) | NASA/JPL | Yes — the only data source so far |
| [Quickmap](https://quickmap.lroc.im-ldi.com/) (the address `quickmap.lroc.asu.edu` redirects here; checked 2026-11-15) | Arizona State University, LRO data | No |
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

### VERIFIED by live requests on 2026-11-15 (near-polar, whole month)

Coordinates of the two regional reference points described under "Site coordinates"; height 0 km
assumed; 2026-11-14 00:00 to 2026-12-14 00:00 UT, 60-minute step; retrieved 2026-11-14 19:58 UTC.

| Point | Body | Rows | Elevation range | Samples above 0° | Samples within ±1° of 0° |
|---|---|---|---|---|---|
| −85.4381°, 37.36667° E | Sun | 721 | −3.111372° to 6.101327° | 439 | 107 |
| −85.4381°, 37.36667° E | Earth | 721 | −3.018130° to 9.708616° | 468 | 125 |
| −85.9948°, 359.76422° E | Sun | 721 | −2.570259° to 5.526833° | 443 | 129 |
| −85.9948°, 359.76422° E | Earth | 721 | −2.851145° to 10.255083° | 490 | 118 |

Horizons reported the same frame, sphere and refraction settings as below. The same four series
requested through the production app (build `d4d8e68`) were identical: 721 rows each, same first
and last rows, same sum of elevations.

What this does and does not show: the pipeline works for a whole month at these latitudes. It does
not show that the coordinates are right, that their frame matches Horizons, or when the Sun or
Earth is actually visible there.

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

- Ranges longer than 30 days and steps shorter than 30 minutes.
- Whole-month ranges closer to the pole than latitude −86°.
- Behaviour under many requests in quick succession.

### UNKNOWN

- Horizons rate and concurrency limits (not stated in the API documentation we read).
- Whether judges require data from the listed Resources only.

## Site coordinates

| Sites | Source | Notes |
|---|---|---|
| Apollo 11, 12, 14, 15, 16, 17 Lunar Modules | NASA NSSDCA, [Apollo Landing Site Coordinates](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html), read 2026-11-14 | Page states: planetocentric Mean Earth/Polar Axis system, DE421, from LRO images (Wagner et al., Icarus 283, 2017). No heights given; the app uses 0 km. Historical sites, not south-pole candidates. |
| Tycho crater example | JPL Horizons manual surface-site example | Pipeline verification only. |
| South-pole regional reference points: Nobile Rim 1 (−85.4381°, +37.36667°), Malapert Massif (−85.9948°, −0.23578°) | NASA Artemis Campaign Development, *Lunar Surface Data Book*, ACD-50044 Rev A (2023), Appendix A2, Table A2-2, rows R06 / Site06 and R23 / Site23, [NASA NTRS](https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf) | **IN THE APP ON THIS BRANCH as "NASA 2023 regional reference points"; not on production.** Supplied by Asher on 15 Nov. Both rows confirmed by Asher on 15 Nov from the searchable text of the NASA PDF (document page 59 of 70); a visual check of the table page is still desirable, and the development computer still cannot open the PDF (HTTP 403). Independently corroborated from NASA GSFC PGDA map headers (below). Centre points of original region polygons; not exact landing points, not NASA-approved landing sites, not necessarily the centres of the 2024 regions. The table gives no height; 0 km is assumed. Longitude direction and frame conversion: see below, not closed. |
| South-pole candidates | **None** | Both names appear in NASA's October 2024 list of nine Artemis III candidate regions (per Asher's research; that release gives no coordinates). The 2023 points are not claimed to be the centres of the 2024 regions. |

### Independent check of the two reference points against NASA GSFC data (2026-11-15)

The NASA table itself could still not be opened (NASA NTRS returns HTTP 403 to the development
computer). The numbers were instead checked against a second NASA source:
[NASA GSFC PGDA, "High-Resolution LOLA Topography for Lunar South Pole Sites"](https://pgda.gsfc.nasa.gov/products/78)
(Barker et al. 2021, doi:10.1016/j.pss.2020.105119), which names Site06 "Nobile rim 1" and Site23
"Malapert massif" and states that its maps are "south polar stereographic X/Y coords in meters,
MOON_ME reference frame of ephemeris DE421".

Read from the GeoTIFF headers of the two 5 m/pixel surface maps (header bytes only; no elevation
data was used):

| Site | Map size | Corner X, Y (m) | Centre X, Y (m) | Centre converted to latitude, east longitude | Table value supplied |
|---|---|---|---|---|---|
| Site06 | 4000 × 4000 pixels (20 km) | 74000, 120000 to 94000, 100000 | 84000, 110000 | −85.43810°, +37.36667° | −85.4381°, +37.36667° |
| Site23 | 4200 × 4200 pixels (21 km) | −11000, 132000 to 10000, 111000 | −500, 121500 | −85.99478°, −0.23578° | −85.9948°, −0.23578° |

Conversion used: sphere of radius 1737.4 km, polar stereographic with true scale at the pole,
longitude = atan2(X, Y), east positive.

What this establishes:

- The two supplied coordinates are, to the printed precision, the **centres of the NASA PGDA
  elevation-map tiles** for those two sites. The transcription is therefore corroborated by a
  primary NASA data product, although the table has not been read directly.
- The coordinates are in the **Moon ME frame (DE421)**, east-positive, ±180° longitude, provided
  the maps follow the usual lunar south-polar convention (X towards 90° E). That convention is
  what reproduces the table's positive sign for Nobile Rim 1; it is not stated in the product's
  own README and remains to be confirmed.
- A map-tile centre is an arbitrary point inside a 20 km square. It is **not a landing point**
  and not necessarily on the feature's summit or rim.

What it does not establish: the size of the difference between Moon ME (DE421) and the
`MEAN_ME` frame Horizons reports with DE441; the real surface height at these points; anything
about terrain. Height matters here: an observer on high ground sees a lower horizon, and the app
assumes 0 km and does not calculate that effect.

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

## Request limits

Enforced by the server (`src/lib/horizons/request.ts`): step 10 to 1440 minutes, at most 62 days,
at most 2,000 rows per series. Since 15 Nov the form applies the same limits before sending and
states the reason (`src/lib/requestPlan.ts`); a unit test checks that the two agree.

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
