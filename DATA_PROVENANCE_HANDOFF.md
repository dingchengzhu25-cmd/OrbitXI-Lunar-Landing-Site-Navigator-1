# Data Provenance Handoff — for Baoyi

Prepared 14 Nov 2026. Purpose: record exactly which NASA data the app uses, what was verified,
and what we still need from you.

## 1. Integrated and verified

| Source | Provider | Used for | Access | Verified how |
|---|---|---|---|---|
| Horizons System API (`ssd.jpl.nasa.gov/api/horizons.api`) | NASA/JPL | Sun and Earth azimuth and elevation at a Moon-surface site | Public API, no key; called from our server | Live requests on 14 Nov; production output compared row by row with direct Horizons output, 0 mismatches |
| Apollo Landing Site Coordinates (<https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html>) | NASA NSSDCA | Coordinates of six Apollo Lunar Modules, used as validation examples | Web page, copied by hand | Page read on 14 Nov; values in `src/lib/sites.ts` match the page |

Horizons is listed in the challenge Resources tab. The NSSDCA page is a NASA page but is **not**
in the challenge Resources list.

One site, the Tycho crater example (348.8° E, −43.3°), comes from the JPL Horizons manual and is
used only to verify the pipeline.

## 2. Listed in the challenge Resources but not integrated

| Resource | Status |
|---|---|
| Quickmap (<https://quickmap.lroc.asu.edu/>) | Not used. Could support terrain context or finding site coordinates |
| Moon Trek (<https://trek.nasa.gov/moon/>) | Not used |
| CSA Moon Exploration portal | Not used (background reading) |

LOLA topography is mentioned in the challenge text as something teams may consider. It is not
integrated; the app has no terrain model.

## 3. What Horizons returns to us

Each response carries its own provenance, which the app displays: API version 1.2, ephemeris
DE441, site frame `MEAN_ME (high precision)` with east-positive longitude, reference sphere
1737.4 km, no refraction, UT time, and the Earth-orientation file name. Each chart links to the
exact request. Unmodified responses with retrieval times are stored in `src/data/samples/` and
`docs/handoff-data/`.

## 4. Not known

- Horizons rate and concurrency limits (not stated in the API documentation we read). The app
  caches and limits itself to two requests at a time.
- Whether judges require every dataset to come from the Resources list.

## 5. What we need from you: south-pole candidate sites

The app has **no south-pole sites**. For each of two sites, please provide:

1. Site or region name.
2. Latitude and longitude, and the longitude convention (0–360° E, or ±180°).
3. Coordinate frame if stated (Mean Earth/Polar Axis, or Principal Axis).
4. Elevation relative to the 1737.4 km reference radius, if available.
5. A citable source: title, publisher, URL, and the page, table, or figure.

Once these arrive they become the first group in the site selector and the default demo.

## 6. Leads found, for you to verify — not used in the app

These were read on 14 Nov. They are starting points, not approved inputs.

**NASA release 24-136, 28 Oct 2024**, *NASA Provides Update on Artemis III Moon Landing Regions*,
<https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/>.
It names nine candidate landing regions: Peak near Cabeus B, Haworth, Malapert Massif, Mons
Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain. The
text we read gives names only, **no coordinates**.

**USGS Gazetteer of Planetary Nomenclature** (IAU-approved names),
<https://planetarynames.wr.usgs.gov/>. It lists centre coordinates for named features. The row
we read for *Mons Mouton* (feature ID 16070): diameter 130.00 km, centre latitude −84.60°, centre
longitude 31.00°, planetographic, east-positive, −180 to 180, approved 13 May 2022. Cautions:

- The column meanings were read from the table header order; please confirm on the site.
- This is the centre of a 130 km mountain, **not a landing site**. A landing region is a much
  smaller area chosen within or near such a feature.
- The gazetteer is a USGS/IAU source, not a NASA dataset, and is not in the challenge Resources.
- Not every region in the NASA list is a named feature (for example "Nobile Rim 1").

If precise region coordinates are needed, a NASA or LRO publication that tabulates the Artemis III
candidate regions would be a better source than feature centres. We have not found or checked one.

## 7. Wording the team can use

- Accurate: "Sun and Earth positions come from the NASA/JPL Horizons System."
- Accurate: "Apollo site coordinates are from NASA's NSSDCA."
- **Not accurate, do not use:** "uses LRO/LOLA terrain data", "terrain-aware", "predicts power or
  communication availability".
