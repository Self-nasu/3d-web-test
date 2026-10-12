// Real Udaipur terrain: AWS Open Data DEM (Terrarium tiles) + satellite mosaic, baked by tools/build_terrain.py.
// World units are metres: x = east, z = south, y = up; origin = City Palace at its ground elevation.
import * as THREE from '../vendor/three.module.js';

export const ORIGIN = { lon: 73.6835, lat: 24.5764 };
const R = 6378137, rad = Math.PI / 180;
export const mercX = lon => R * lon * rad;
export const mercY = lat => R * Math.log(Math.tan(Math.PI / 4 + lat * rad / 2));
const loadImage = u => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(u)); i.src = u; });

export async function loadDem(base = 'assets/terrain/') {
  const meta = await (await fetch(base + 'meta.json')).json();
  const raw = new Int16Array(await (await fetch(base + 'dem.bin')).arrayBuffer());
  return { meta, raw };
}
// Sea-level elevation (m) at lon/lat from the baked DEM only (no mesh) — used by the Google 3D Tiles engine for altitudes.
export async function loadElevation(base) {
  const { meta, raw } = await loadDem(base), { demW: W, demH: H } = meta, at = (i, j) => Math.max(5500, raw[Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))]) / 10;
  return (lon, lat) => { const u = Math.min(1, Math.max(0, (mercX(lon) - meta.mxMin) / (meta.mxMax - meta.mxMin))) * (W - 1), v = Math.min(1, Math.max(0, (meta.myMax - mercY(lat)) / (meta.myMax - meta.myMin))) * (H - 1), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j; return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv; };
}

export async function loadTerrain(renderer, { base = 'assets/terrain/', step = 3, exaggeration = 1.2 } = {}) {
  const { meta, raw } = await loadDem(base);
  const img = await loadImage(base + 'color.jpg');
  const { demW: W, demH: H } = meta, floor = 5500; // decimetres; removes the few nodata spikes in the source DEM
  const k = Math.cos(ORIGIN.lat * rad), mx0 = mercX(ORIGIN.lon), my0 = mercY(ORIGIN.lat);
  const mxSpan = meta.mxMax - meta.mxMin, mySpan = meta.myMax - meta.myMin;
  const at = (i, j) => Math.max(floor, raw[Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))]) / 10;
  function elevUV(u, v) { const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j; return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv; }
  const elevMerc = (mx, my) => elevUV(Math.min(1, Math.max(0, (mx - meta.mxMin) / mxSpan)) * (W - 1), Math.min(1, Math.max(0, (meta.myMax - my) / mySpan)) * (H - 1));
  const elevLonLat = (lon, lat) => elevMerc(mercX(lon), mercY(lat));
  const baseElev = elevLonLat(ORIGIN.lon, ORIGIN.lat);
  const heightAt = (x, z) => (elevMerc(x / k + mx0, -z / k + my0) - baseElev) * exaggeration;
  const project = (lon, lat) => [(mercX(lon) - mx0) * k, -(mercY(lat) - my0) * k];
  const place = (lon, lat, agl = 0) => { const [x, z] = project(lon, lat); return new THREE.Vector3(x, heightAt(x, z) + agl, z); };

  const xMin = (meta.mxMin - mx0) * k, xMax = (meta.mxMax - mx0) * k, zMin = -(meta.myMax - my0) * k, zMax = -(meta.myMin - my0) * k;
  const sx = Math.floor((W - 1) / step), sz = Math.floor((H - 1) / step);
  const g = new THREE.PlaneGeometry(xMax - xMin, zMax - zMin, sx, sz); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cx = (xMin + xMax) / 2, cz = (zMin + zMax) / 2;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + cx, z = pos.getZ(i) + cz; pos.setXYZ(i, x, heightAt(x, z), z); }
  g.computeVertexNormals();
  const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
  // Cheap realism boost on 10 m satellite data: water gets a glossy teal surface (so the sun glints on the lakes),
  // land gets a fine procedural grain at close range, and the colours get a slight contrast/saturation lift.
  mat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      float gWater = 0.0;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      gWater = 1.0 - smoothstep(0.005, 0.018, lum);
      float grain = vn(vMapUv * 5200.0) * 0.5 + vn(vMapUv * 1300.0) * 0.5;
      diffuseColor.rgb *= mix(0.82 + 0.36 * grain, 1.0, gWater);
      diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 1.18);
      diffuseColor.rgb = (diffuseColor.rgb - 0.5) * 1.12 + 0.5;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.2, 0.27), gWater * 0.85);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.1, gWater);`);
  };
  const mesh = new THREE.Mesh(g, mat);
  return { mesh, meta, heightAt, project, place, elevLonLat, bounds: { xMin, xMax, zMin, zMax }, attribution: meta.attribution };
}
