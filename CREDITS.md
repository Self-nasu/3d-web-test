# Credits & licences

Every third-party asset used by the site, with where it appears.

| Where used | File | Title | Author | Licence | Source |
|---|---|---|---|---|---|
| Landing hero / parallax background | `assets/img/hero-pichola.jpg` | Udaipur City Palace November 2013.jpg | rusticus80 | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | [link](https://commons.wikimedia.org/wiki/File:Udaipur_City_Palace_November_2013.jpg) |
| City Palace heritage card | `assets/img/citypalace.jpg` | Udaipur-City Palace-03-Palace facade-20131013.jpg | Daniel VILLAFRUELA | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [link](https://commons.wikimedia.org/wiki/File:Udaipur-City_Palace-03-Palace_facade-20131013.jpg) |
| Jag Mandir heritage card | `assets/img/jagmandir.jpg` | Udaïpur-VPL 15-Jag Mandir Palace-20131013.jpg | Daniel VILLAFRUELA | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [link](https://commons.wikimedia.org/wiki/File:Uda%C3%AFpur-VPL_15-Jag_Mandir_Palace-20131013.jpg) |
| Fateh Sagar flyover caption | `assets/img/fatehsagar.jpg` | Fateh Sagar Lake, Udaipur, India (54345526249).jpg | Mustang Joe | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [link](https://commons.wikimedia.org/wiki/File:Fateh_Sagar_Lake,_Udaipur,_India_(54345526249).jpg) |
| Flyover start - Aravalli hills | `assets/img/aravalli.jpg` | Sunset View of Udaipur.jpg | Siddharthseth20 | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [link](https://commons.wikimedia.org/wiki/File:Sunset_View_of_Udaipur.jpg) |

## Real terrain (assets/terrain, built by tools/build_terrain.py)
- Elevation: Mapzen / AWS Open Data Terrain Tiles (sources include SRTM, ASTER GDEM, GMTED) — https://registry.opendata.aws/terrain-tiles/
- Imagery: Sentinel-2 cloudless — https://s2maps.eu by EOX IT Services GmbH, CC BY-NC 4.0 (contains modified Copernicus Sentinel data 2021). **Non-commercial licence** — swap the imagery source before any commercial launch.
- Optional: Google Photorealistic 3D Tiles via CesiumJS (Apache-2.0) with your own key; © Google, attribution must stay visible; no caching/extraction.

## Original / bundled
- 3D scenes, ambient audio (WebAudio synth) and product models: procedurally generated for this project.
- [Three.js](https://threejs.org) r160 — MIT, © three.js authors (`vendor/three.module.js`).

## Media policy
- YouTube videos are **never embedded**. Only videos marked Creative Commons (CC BY) are downloaded locally (`tools/fetch_youtube.sh`), edited, and credited above.
- Pexels/Pixabay/Mixkit files: free licences; credit is given anyway (`tools/add_credit.py`).
- CC BY-SA images (shown with attribution) keep their licence; derivative redistributions must stay CC BY-SA.
