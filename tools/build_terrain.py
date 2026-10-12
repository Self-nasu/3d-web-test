#!/usr/bin/env python3
"""Bake a real Udaipur terrain tile set into assets/terrain/ :
  dem.bin   Int16 little-endian elevations (decimetres above sea level), web-mercator-uniform grid
  color.jpg satellite mosaic covering exactly the same bounds
  meta.json bounds + sizes + attribution
Elevation: AWS Open Data 'Terrain Tiles' (Terrarium encoding) - https://registry.opendata.aws/terrain-tiles/
Imagery  : default EOX Sentinel-2 cloudless 2021 (CC BY-NC 4.0, contains modified Copernicus Sentinel data 2021).
           --imagery esri uses Esri World Imagery (sharper, but check Esri's terms before publishing the output).
Usage: python3 tools/build_terrain.py [--imagery eox|esri] [--zdem 14] [--zimg 15]"""
import argparse, io, json, math, os, sys, time, urllib.request
import numpy as np
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument("--imagery", default="eox"); ap.add_argument("--zdem", type=int, default=14); ap.add_argument("--zimg", type=int, default=15)
ap.add_argument("--bbox", default="24.545,24.625,73.635,73.735", help="latMin,latMax,lonMin,lonMax")
a = ap.parse_args(); latMin, latMax, lonMin, lonMax = map(float, a.bbox.split(","))
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "terrain"); os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "UdaipurVirtuallyYours/0.2 (hackathon demo)"}
def get(url):
    for i in range(5):
        try: return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except Exception as e: time.sleep(2 + i * 3)
    sys.exit("failed " + url)
def tilef(lat, lon, z):  # fractional tile coords
    n = 2 ** z; return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
def mosaic(z, urlf, mode):
    x0, y1 = tilef(latMin, lonMin, z); x1, y0 = tilef(latMax, lonMax, z)
    tx0, tx1, ty0, ty1 = int(x0), int(x1), int(y0), int(y1)
    W, H = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256; im = Image.new(mode, (W, H))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            im.paste(Image.open(io.BytesIO(get(urlf(z, tx, ty)))).convert(mode), ((tx - tx0) * 256, (ty - ty0) * 256))
        print("  row", ty, file=sys.stderr)
    box = (round((x0 - tx0) * 256), round((y0 - ty0) * 256), round((x1 - tx0) * 256), round((y1 - ty0) * 256)); return im.crop(box)
print("DEM (AWS Terrain Tiles, z%d)" % a.zdem)
dem = mosaic(a.zdem, lambda z, x, y: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/%d/%d/%d.png" % (z, x, y), "RGB")
rgb = np.asarray(dem, dtype=np.float32); elev = rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768
print("  elevation min/max m:", float(elev.min()), float(elev.max()), "grid", elev.shape)
np.clip(np.round(elev * 10), -32768, 32767).astype("<i2").tofile(os.path.join(OUT, "dem.bin"))
print("Imagery (%s, z%d)" % (a.imagery, a.zimg))
url = (lambda z, x, y: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/%d/%d/%d.jpg" % (z, y, x)) if a.imagery == "eox" else (lambda z, x, y: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/%d/%d/%d" % (z, y, x))
img = mosaic(a.zimg, url, "RGB"); s = 4096 / max(img.size)
if s < 1: img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
img.save(os.path.join(OUT, "color.jpg"), quality=86, optimize=True); print("  color", img.size)
R = 6378137.0; mx = lambda lon: R * math.radians(lon); my = lambda lat: R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
meta = dict(latMin=latMin, latMax=latMax, lonMin=lonMin, lonMax=lonMax, mxMin=mx(lonMin), mxMax=mx(lonMax), myMin=my(latMin), myMax=my(latMax),
            demW=elev.shape[1], demH=elev.shape[0], demScale=0.1, elevMin=float(elev.min()), elevMax=float(elev.max()), imagery=a.imagery,
            attribution=["Elevation: Mapzen/AWS Terrain Tiles (AWS Open Data; sources incl. SRTM, ASTER GDEM, GMTED)"] + (["Imagery: Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (CC BY-NC 4.0; contains modified Copernicus Sentinel data 2021)"] if a.imagery == "eox" else ["Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community"]))
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1); print("done")
