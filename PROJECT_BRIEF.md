# Project Brief

## Context

- **Event:** NASA Space Apps Challenge 2026, 14–15 November 2026 (SGT).
- **Challenge:** Lunar Landing Site Navigator.
- **Team:** OrbitXI (six members).
- **Deadlines:** official submission 15 Nov 23:59 SGT; internal target 15 Nov 21:00 SGT.
- **Budget:** SGD 0. No paid services.

## Goal

An intuitive web app that lets a user compare two candidate lunar south-pole landing sites and
mission dates by showing Sun and Earth positions relative to the local horizon, backed by NASA
data, with clear statements of what the numbers do and do not mean.

## MVP scope

1. Choose two documented lunar locations.
2. Choose a mission date or date range.
3. Retrieve Sun and Earth elevation from NASA/JPL Horizons.
4. Time-series charts with units and UTC time.
5. Geometric sunlight and direct-to-Earth visibility windows.
6. Side-by-side comparison of the two locations.
7. Data provenance, assumptions, and reproducibility information.

## Out of scope

- Terrain-aware visibility (horizon masking from topography).
- Electrical power, thermal, or link-budget estimates.
- Descent or surface navigation.
- Accounts, databases, AI agents.

## Rules we hold ourselves to

- Only real NASA data. No invented coordinates, ephemeris values, or results.
- A site is shown as a landing candidate only when its coordinates have a citable source.
- Geometric visibility is never presented as actual illumination, power, or guaranteed communication.
- If live data fails, the app says so. Archived real data is used only when clearly labelled.

## Team

All communication goes through Asher.

| Member | Role |
|---|---|
| Asher | Team lead, sole developer |
| Baoyi | NASA data sources and acquisition guidance |
| Yi | Scientific definitions and validation |
| Tan | UI and visualization specifications |
| Zhang | 30-second English demo video (read-only access to this public repo) |
| Sean | QA and submission requirements |

## Deliverables

- Public app URL.
- This public repository.
- A genuine 30-second English demo video recorded from the deployed app.
