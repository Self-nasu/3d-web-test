# Udaipur — Virtually Yours: Ideation & Technical Plan

**One-line pitch:** a browser-only heritage-tourism experience where you fly over Udaipur's lakes, land in an old-city street and buy directly from the artisan whose workshop you just "walked past".

## 1. Pillars
1. **Cinematic 3D** — scripted helicopter-style flyover: Aravalli hills → Fateh Sagar → Lake Pichola → City Palace circle → Jag Mandir → heritage street. Day→dusk lighting, ambient soundtrack, location captions.
2. **Heritage-to-commerce** — markers in the scene open an artisan storefront: meet the maker, 360° product view, provenance (verified vs seller-claimed), enquiry/WhatsApp/workshop visit.
3. **Sustainable tourism** — crowd dispersal ("quieter alternative"), local-impact passport, walking-first itineraries. No unsubstantiated environmental claims.
4. **Shareability** — "My Udaipur" itinerary link + postcard generated client-side.

## 2. Architecture decisions
| Concern | Decision | Why |
|---|---|---|
| Frontend | Static ES modules, no build step; Three.js vendored locally | Opens with any static server, trivially hostable, fast to iterate for a hackathon. Next.js is a clean later migration. |
| 3D city | Procedural stylised Udaipur (terrain, lakes, palaces, Jag Mandir) in Three.js; **optional** CesiumJS + Google Photorealistic 3D Tiles mode, enabled only if the user supplies an API key | Google tiles need a billed key and terms/coverage checks; we must not hardcode or cache them. |
| Street level | Parallax panorama scene built from licensed photos; Street View link-out via official embed where coverage exists | Verify coverage before relying on it. |
| Product viewer | 360° turntable (frame sequence / drag-rotate) for all products; real GLB-style 3D (procedural, lit) for 2 showcase items | Reliable viewer > many heavy models. |
| Data | `data/*.json` (places, artisans, products, routes) — shaped like future Mongo collections | Swap for Express+Mongo later without changing UI. |
| Media | Only CC0 / CC BY / CC BY-SA / free-licence files; every use captioned and credited in-app and in `CREDITS.md` | Legal reuse; transparent. |
| Audio | Procedural WebAudio ambient pad (no file, no licence issue) | Works offline. |

## 3. Data model (mirrors future MongoDB)
- `places`: id, name, lat, lon, story, hours, typicalVisitMin, crowd (manual indicator by hour), tags
- `artisans`: id, name, craft, placeId, workshop location, story, verified{status, evidence}, claims[] (seller-provided)
- `products`: id, artisanId, title, materials, size, price, view ("360"|"3d"), image
- `routes`: id, title, stops[], walkingMinutes

## 4. Media policy
- Pexels/Pixabay/Mixkit: free-licence, credit optional but given anyway. Their website search is blocked from the build sandbox; place files in `assets/` and add a row to `assets/credits.json` using `tools/add_credit.py`.
- YouTube: **never embedded**. Only videos marked Creative Commons (CC BY) are downloaded locally with `tools/fetch_youtube.sh` (yt-dlp), clipped/compressed, credited with channel + URL + licence. YouTube blocks datacentre IPs, so this step runs on the developer's machine.
- Wikimedia Commons: `tools/fetch_commons.py`.

## 5. Risks
Google 3D Tiles billing/terms; Udaipur tile coverage unverified; 3D perf on phones (mitigation: low-power mode, DPR cap); artisan data must be consented & verified — shipped profiles are **clearly marked sample data**.
