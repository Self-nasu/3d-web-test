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
| `js/world.js` | Procedural Udaipur terrain/lakes/palaces + walkable lane |
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

## Google Photorealistic 3D Tiles (optional, not bundled)
Needs your own billed Maps Platform key, coverage check for Udaipur and compliance with Google's terms (attribution, no caching/extraction). The default procedural scene needs no key.

## Honest limits
Artisan profiles are sample data. Crowd levels are manual indicators, not live. The 3D city is schematic, not survey-accurate. No payments are processed.
