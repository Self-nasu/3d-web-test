#!/usr/bin/env python3
"""Regenerate CREDITS.md from assets/credits.json (run after fetching/adding media)."""
import json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(R, "assets", "credits.json")))
L = ["# Credits & licences", "", "Every third-party asset used by the site, with where it appears.", "",
     "| Where used | File | Title | Author | Licence | Source |", "|---|---|---|---|---|---|"]
for k, c in d.items():
    L.append("| %s | `%s` | %s | %s | [%s](%s) | [link](%s) |" % (c.get("caption", k), c["file"], c["title"].replace("File:", "").replace("|", "/"), c["author"].replace("|", "/"), c["license"], c.get("license_url") or c["source"], c["source"]))
L += ["", "## Real terrain (assets/terrain, built by tools/build_terrain.py)", "- Elevation: Mapzen / AWS Open Data Terrain Tiles (sources include SRTM, ASTER GDEM, GMTED) — https://registry.opendata.aws/terrain-tiles/", "- Imagery: Sentinel-2 cloudless — https://s2maps.eu by EOX IT Services GmbH, CC BY-NC 4.0 (contains modified Copernicus Sentinel data 2021). **Non-commercial licence** — swap the imagery source before any commercial launch.", "- Optional: Google Photorealistic 3D Tiles via CesiumJS (Apache-2.0) with your own key; © Google, attribution must stay visible; no caching/extraction.", "", "## Original / bundled", "- 3D scenes, ambient audio (WebAudio synth) and product models: procedurally generated for this project.",
      "- [Three.js](https://threejs.org) r160 — MIT, © three.js authors (`vendor/three.module.js`).", "",
      "## Media policy", "- YouTube videos are **never embedded**. Only videos marked Creative Commons (CC BY) are downloaded locally (`tools/fetch_youtube.sh`), edited, and credited above.",
      "- Pexels/Pixabay/Mixkit files: free licences; credit is given anyway (`tools/add_credit.py`).",
      "- CC BY-SA images (shown with attribution) keep their licence; derivative redistributions must stay CC BY-SA.", ""]
open(os.path.join(R, "CREDITS.md"), "w").write("\n".join(L)); print("CREDITS.md written")
