# Udaipur — Virtually Yours

A browser-only heritage-tourism prototype: **cinematic flyover → walkable old-city lane → artisan storefront with 3D product viewer**, plus a crowd-dispersal recommender, shareable "My Udaipur" itinerary/postcard and a Local Impact Passport.

## Run
```bash
python3 -m http.server 8000   # any static server; ES modules need http://, not file://
# open http://localhost:8000
```
No build step. Three.js is vendored in `vendor/`.

## What's here
| Path | Purpose |
|---|---|
| `index.html`, `css/`, `js/` | Landing page (parallax), 3D experience, drawers, map, share/postcard |
| `js/terrain.js`, `tools/build_terrain.py` | Real DEM + satellite terrain mesh |
| `js/cesium-engine.js` | Google Photorealistic 3D Tiles engine (CesiumJS) |
| `js/world.js` | Sky/lighting, procedural fallback city, stylised walkable lane |
| `js/experience.js` | Flyover path, 3 modes, captions, hotspots |
| `js/viewer.js` | Product 3D viewer (drag/zoom) |
| `data/*.json` | Places, artisans (**sample data**), products — shaped like future DB collections |
| `docs/PLAN.md`, `TASKS.md` | Ideation, architecture, task sheet |
| `tools/` | Media fetchers + credit tooling |
| `CREDITS.md`, `assets/credits.json` | Licences for every third-party asset |

## Media workflow (credits are mandatory)
- `python3 tools/fetch_commons.py` — openly licensed Wikimedia Commons photos (auto-credited).
- `tools/fetch_youtube.sh <url> <slot> [start] [end]` — downloads **only CC BY** YouTube videos, never embeds (run on your own machine; YouTube blocks cloud IPs). Use slot `hero-video` to power the parallax hero video.
- Pexels/Pixabay/Mixkit: download manually, put under `assets/`, then `python3 tools/add_credit.py …`.
- `python3 tools/build_credits.py` refreshes `CREDITS.md`.

## Real 3D of Udaipur — two engines
1. **Open-data terrain (default, no key):** real elevation from AWS Open Data Terrain Tiles + Sentinel-2 satellite imagery, baked into `assets/terrain/` by `python3 tools/build_terrain.py` (add `--imagery esri` locally for sharper Esri imagery — check Esri's terms before publishing). Genuine terrain (lakes, Aravalli ridges, Jag Mandir island) but **no building meshes**, and the imagery is only ~10 m/px.
2. **Google Photorealistic 3D Tiles (the real building-level mesh):** click **🗺 Open-data terrain** in the HUD and paste a Google Maps Platform key (Map Tiles API enabled, billing on), or copy `config.example.js` to `config.js`. Runs through CesiumJS; flyover, captions, free-explore and street-level walking all work on the real mesh. Attribution stays visible and tiles are never cached. Not yet verified against live Google tiles (no key in the build sandbox) — check Udaipur coverage with your key.

## Honest limits
Artisan profiles are sample data. Crowd levels are manual indicators, not live. In open-data mode there are no buildings, and the stylised lane in *Walk the City* is illustrative (real street-level walking needs the Google engine). No payments are processed.
