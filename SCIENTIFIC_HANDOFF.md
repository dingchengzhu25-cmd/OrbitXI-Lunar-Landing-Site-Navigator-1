# Scientific Handoff — for Yi (R3 validation)

Prepared 14 Nov 2026. Everything below is reproducible from files in this repository.

**Status in one line:** the software reproduces NASA/JPL Horizons values exactly and its
calculations pass unit tests, but **no independent scientific validation has been done yet.**
That is what this document asks for.

## 1. Locations used

Both are historical sites used as validation examples. **Neither is a lunar south-pole
candidate.** No south-pole coordinates are in the app.

| | Site A | Site B |
|---|---|---|
| Name | Apollo 11 Lunar Module | Apollo 17 Lunar Module |
| Latitude | 0.67416° N | 20.1911° N |
| Longitude | 23.47314° E | 30.7723° E |
| Height used | 0 km (**assumed**) | 0 km (**assumed**) |

Source for both: NASA NSSDCA, *Apollo Landing Site Coordinates*,
<https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html> (read 14 Nov 2026). The page
states the coordinates are in the planetocentric Mean Earth/Polar Axis system (DE421), from LRO
images, citing Wagner et al., Icarus 283 (2017). It gives no heights.

## 2. Horizons request

Endpoint `https://ssd.jpl.nasa.gov/api/horizons.api`. Parameters for Site A, Sun:

```
format=json            COMMAND='10'           OBJ_DATA='NO'         MAKE_EPHEM='YES'
EPHEM_TYPE='OBSERVER'  CENTER='coord@301'     COORD_TYPE='GEODETIC'
SITE_COORD='23.47314,0.67416,0'               (east longitude deg, latitude deg, height km)
START_TIME='2026-11-14 00:00'  STOP_TIME='2026-11-16 00:00'  STEP_SIZE='180m'
QUANTITIES='4'         TIME_TYPE='UT'         CSV_FORMAT='YES'
```

Earth uses `COMMAND='399'`. Site B uses `SITE_COORD='30.7723,20.1911,0'`. The four exact URLs and
the unmodified responses are in `docs/handoff-data/`.

What Horizons reported back in the response headers:

| Item | Value |
|---|---|
| API | NASA/JPL Horizons API, version 1.2 |
| Retrieved | 2026-11-14 08:50 UTC |
| Ephemeris | DE441 for Sun, Earth, and Moon |
| Site frame | `MEAN_ME (high precision)`, east-longitude positive |
| Reference surface | sphere, radii 1737.4, 1737.4, 1737.4 km |
| Refraction | `NO (AIRLESS)` |
| Earth-orientation file | `eop.261113.p270209` |
| Time scale | UT |
| Columns | `Azi_(a-app)`, `Elev_(a-app)`: airless apparent azimuth (clockwise from north) and elevation of the target centre |

## 3. Data: 14–16 Nov 2026 UTC, every 3 hours

Values are exactly as Horizons printed them. Degrees.

**Site A — Apollo 11**

| UTC | Sun az | Sun el | Earth az | Earth el |
|---|---|---|---|---|
| 2026-11-14 00:00 | 91.441727 | -13.157931 | 279.017376 | 64.944298 |
| 2026-11-14 03:00 | 91.451229 | -11.634954 | 278.663523 | 64.789661 |
| 2026-11-14 06:00 | 91.461727 | -10.112066 | 278.307017 | 64.633975 |
| 2026-11-14 09:00 | 91.473221 | -8.589271 | 277.948145 | 64.477333 |
| 2026-11-14 12:00 | 91.485714 | -7.066569 | 277.587180 | 64.319834 |
| 2026-11-14 15:00 | 91.499214 | -5.543963 | 277.224388 | 64.161586 |
| 2026-11-14 18:00 | 91.513730 | -4.021455 | 276.860022 | 64.002700 |
| 2026-11-14 21:00 | 91.529276 | -2.499047 | 276.494328 | 63.843294 |
| 2026-11-15 00:00 | 91.545870 | -0.976740 | 276.127538 | 63.683491 |
| 2026-11-15 03:00 | 91.563533 | 0.545462 | 275.759877 | 63.523421 |
| 2026-11-15 06:00 | 91.582290 | 2.067558 | 275.391557 | 63.363220 |
| 2026-11-15 09:00 | 91.602170 | 3.589546 | 275.022783 | 63.203027 |
| 2026-11-15 12:00 | 91.623204 | 5.111423 | 274.653747 | 63.042987 |
| 2026-11-15 15:00 | 91.645431 | 6.633189 | 274.284633 | 62.883253 |
| 2026-11-15 18:00 | 91.668890 | 8.154840 | 273.915612 | 62.723978 |
| 2026-11-15 21:00 | 91.693629 | 9.676374 | 273.546850 | 62.565324 |
| 2026-11-16 00:00 | 91.719699 | 11.197789 | 273.178501 | 62.407455 |

**Site B — Apollo 17**

| UTC | Sun az | Sun el | Earth az | Earth el |
|---|---|---|---|---|
| 2026-11-14 00:00 | 89.445094 | -6.023618 | 247.414022 | 54.952621 |
| 2026-11-14 03:00 | 89.971688 | -4.593709 | 247.369827 | 54.738566 |
| 2026-11-14 06:00 | 90.497163 | -3.163866 | 247.322370 | 54.522596 |
| 2026-11-14 09:00 | 91.022179 | -1.734209 | 247.271703 | 54.304862 |
| 2026-11-14 12:00 | 91.547389 | -0.304861 | 247.217877 | 54.085520 |
| 2026-11-14 15:00 | 92.073448 | 1.124057 | 247.160938 | 53.864730 |
| 2026-11-14 18:00 | 92.601010 | 2.552421 | 247.100926 | 53.642654 |
| 2026-11-14 21:00 | 93.130734 | 3.980109 | 247.037879 | 53.419457 |
| 2026-11-15 00:00 | 93.663288 | 5.406993 | 246.971832 | 53.195309 |
| 2026-11-15 03:00 | 94.199350 | 6.832944 | 246.902813 | 52.970383 |
| 2026-11-15 06:00 | 94.739613 | 8.257829 | 246.830849 | 52.744853 |
| 2026-11-15 09:00 | 95.284785 | 9.681513 | 246.755961 | 52.518897 |
| 2026-11-15 12:00 | 95.835597 | 11.103853 | 246.678170 | 52.292697 |
| 2026-11-15 15:00 | 96.392806 | 12.524704 | 246.597490 | 52.066436 |
| 2026-11-15 18:00 | 96.957193 | 13.943910 | 246.513934 | 51.840301 |
| 2026-11-15 21:00 | 97.529575 | 15.361313 | 246.427510 | 51.614481 |
| 2026-11-16 00:00 | 98.110805 | 16.776743 | 246.338226 | 51.389167 |

## 4. Geometric visibility computed by the app

### Provisional definitions (awaiting your approval)

| Term | Definition in the code today |
|---|---|
| Sun geometrically visible | Sun disc-centre elevation **> 0°** at a sample |
| Earth geometrically visible | Earth disc-centre elevation **> 0°** at a sample |
| Joint visibility | both true at the same sampled UTC time |
| Exactly 0° | counts as **not** visible |
| Boundary case | sample within **±1°** of the threshold; flagged, not treated differently |

Thresholds are constants in `src/lib/visibility.ts` (`PROVISIONAL_CONFIG`) and can be changed
separately for Sun and Earth.

### Results for the data above

| | Site A — Apollo 11 | Site B — Apollo 17 |
|---|---|---|
| Sun: samples above 0° | 8 of 17 | 12 of 17 |
| Sun: state changed between | 15 Nov 00:00 (−0.976740°) and 03:00 (+0.545462°) | 14 Nov 12:00 (−0.304861°) and 15:00 (+1.124057°) |
| Sun: estimated rise (linear interpolation) | ≈ 15 Nov 01:55 UTC | ≈ 14 Nov 12:38 UTC |
| Sun: window end | still above 0° at the last sample; true set is outside the range | same |
| Sun: estimated time above 0° in range | ≈ 22.1 h (lower bound) | ≈ 35.4 h (lower bound) |
| Sun: boundary-case samples | 2 | 1 |
| Earth: samples above 0° | 17 of 17 | 17 of 17 |
| Joint: samples | 8 of 17 | 12 of 17 |
| Difference in estimated Sun time | B longer by ≈ 13.3 h | |

How to read these:

- Sample counts are exact. Rise times and durations marked "≈" are **estimates**: a straight line
  between the two samples that bracket the change. The app only knows the true geometric rise
  lies inside that 3-hour interval.
- The hourly archived data for the same sites gives the same estimates to the minute (01:55 and
  12:38). This shows the interpolation is stable here, where elevation changes almost linearly
  at about 0.51° per hour. It may not hold near the poles, where the Sun skims the horizon.

## 5. What has and has not been validated

| Check | Status | Evidence |
|---|---|---|
| App output equals Horizons output | **Verified** | Row-by-row comparison through the production site, 25 Sun and 25 Earth rows, 0 mismatches |
| Parser, validation, visibility logic, caching, error handling | **Unit-tested** | 108 automated tests pass, including edge cases at 0°, gaps, and misaligned timestamps |
| Numbers in this document match the stored responses | **Unit-tested** | `src/lib/handoff.test.ts` |
| Plausibility | **Informal only** | Sunrise azimuth near 90° at near-equatorial sites; Sun elevation rate ≈ 0.51°/h ≈ 360° per 29.5 days; Apollo 17, 7.3° further east, sees sunrise ≈ 13.3 h earlier (expected ≈ 14 h from longitude alone) |
| Scientific correctness of definitions, frames, and interpretation | **NOT validated** | Needs R3 |

Passing unit tests means the code does what we intended. It does not mean what we intended is
scientifically right.

## 6. Limitations and unverified assumptions

1. **No terrain.** Elevation is relative to the horizontal plane of a 1737.4 km sphere. Real
   horizons, especially at the south pole, are shaped by topography.
2. **Disc centre only.** Seen from the Moon the Sun is about 0.5° across and Earth about 1.9°
   (general astronomy values, not derived from our data). "Centre above 0°" and "any part of the
   disc above 0°" differ.
3. **Site height assumed 0 km.** Height changes the geometric horizon (dip) and the app does not
   model dip.
4. **Frame match assumed.** NSSDCA coordinates are Mean Earth/Polar Axis with DE421; Horizons
   reports `MEAN_ME (high precision)` with DE441. We assume these agree at our precision.
5. **Linear interpolation** between samples for rise and set estimates.
6. **Not modelled at all:** solar-array power, thermal conditions, communication link quality,
   Earth ground-station availability.
7. **Only non-polar sites tested end to end.** Polar queries return data, but no polar site has
   been checked for plausibility.

## 7. R3 validation worksheet

Please answer each item; a short note is enough.

| # | Question | Your answer |
|---|---|---|
| 1 | Is "disc centre above 0°" acceptable for Sun visibility, or should it be the upper limb, or a positive margin (for example several degrees for usable power)? | |
| 2 | Same question for Earth and direct-to-Earth communication. | |
| 3 | Should exactly 0° count as visible or not? | |
| 4 | Is the ±1° boundary band a sensible width? | |
| 5 | Is Horizons `MEAN_ME` the right frame for coordinates published as Mean Earth/Polar Axis (DE421)? Is any conversion needed? | |
| 6 | Is assuming 0 km height acceptable for a geometric comparison, and how should it be worded? | |
| 7 | Is the wording of the limitations in section 6 and in the app accurate and sufficient? | |
| 8 | Is linear interpolation between samples acceptable, and at what maximum sampling interval? | |
| 9 | Independent spot check (below): do the values agree? | |

**Independent spot check.** In the Horizons web interface (<https://ssd.jpl.nasa.gov/horizons/app.html>):
Ephemeris Type *Observer Table*; Target Body *Sun* (then *Earth*); Observer Location: specify
coordinates on body *Moon (301)*, east longitude 23.47314°, latitude 0.67416°, altitude 0 km;
Time 2026-11-15 00:00 to 03:00 UT, step 3 h; Table Settings: quantity 4 only. Expected:

| UTC | Sun el | Earth el |
|---|---|---|
| 2026-11-15 00:00 | -0.976740 | 63.683491 |
| 2026-11-15 03:00 | 0.545462 | 63.523421 |

The menu wording above is from memory of the web interface and may differ slightly; the
parameters are what matter. An independent check with a different tool (for example SPICE) would
be stronger than repeating a Horizons query, since it would also test the frame assumption.

## 8. South-pole candidates

None are in the app, and none will be added without a citable source. Leads that can be checked
independently are listed in `DATA_PROVENANCE_HANDOFF.md`.
