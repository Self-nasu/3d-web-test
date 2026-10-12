// Google Photorealistic 3D Tiles engine (CesiumJS). Same API as experience.js so main.js can swap engines.
// Needs the user's own Google Maps Platform key with the "Map Tiles API" enabled (billing applies).
// Terms: keep Google/Cesium attribution visible (we do not hide the credit container), no caching/extraction of tiles.
import { GEO_HERO } from './experience.js';
import { loadElevation } from './terrain.js';
import { setSound } from './audio.js';

const CESIUM = 'https://cdn.jsdelivr.net/npm/cesium@1.120.0/Build/Cesium/';
let cesiumP;
function loadCesium() {
  return (cesiumP ||= new Promise((res, rej) => {
    window.CESIUM_BASE_URL = CESIUM;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CESIUM + 'Widgets/widgets.css'; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = CESIUM + 'Cesium.js'; s.onload = () => res(window.Cesium); s.onerror = () => rej(new Error('CesiumJS failed to load')); document.head.appendChild(s);
  }));
}

export async function createCesiumExperience(host, deps, key) {
  const { places, artisans, onPlace, onArtisan, toast, photo } = deps;
  const Cesium = await loadCesium();
  const stage = host.querySelector('.stage'), root = document.createElement('div'); root.style.cssText = 'position:absolute;inset:0'; stage.appendChild(root);
  const elev = await loadElevation().catch(() => () => 580);           // AWS Open Data DEM, metres above sea level
  let viewer, tileset;
  try {
    viewer = new Cesium.Viewer(root, { baseLayer: false, geocoder: false, homeButton: false, sceneModePicker: false, baseLayerPicker: false, navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, vrButton: false, scene3DOnly: true, msaaSamples: 4 });
    viewer.scene.globe.show = false; viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#9cc3e8');
    const ssc = viewer.scene.screenSpaceCameraController; ssc.enableInputs = false;
    tileset = await Cesium.Cesium3DTileset.fromUrl('https://tile.googleapis.com/v1/3dtiles/root.json?key=' + encodeURIComponent(key), { showCreditsOnScreen: true, maximumScreenSpaceError: 8 });
    viewer.scene.primitives.add(tileset);
  } catch (err) { try { viewer?.destroy(); } catch {} root.remove(); throw new Error(/CesiumJS failed/.test(err?.message || '') ? err.message : 'Google rejected the request — check the key, enable the Map Tiles API and billing'); }
  const scene = viewer.scene, cam = viewer.camera, ell = Cesium.Ellipsoid.WGS84;
  let geoid = -55; // ellipsoid-minus-sea-level offset for Udaipur (EGM96 ≈ -55 m); refined from the tileset below
  const calibrate = async () => { try { const [c] = await Promise.race([scene.sampleHeightMostDetailed([Cesium.Cartographic.fromDegrees(73.6835, 24.5764)]), new Promise((_, r) => setTimeout(() => r(), 12000))]); if (c && isFinite(c.height) && Math.abs(c.height - elev(73.6835, 24.5764)) < 200) geoid = c.height - elev(73.6835, 24.5764) - 8; } catch {} };
  const cart = (lon, lat, agl = 0, abs = false) => Cesium.Cartesian3.fromDegrees(lon, lat, abs ? agl : elev(lon, lat) + geoid + agl);
  const tmpC = new Cesium.Cartographic();

  const capEl = host.querySelector('.caption'), hot = host.querySelector('.hotspots'), prog = host.querySelector('.progress i'), fade = host.querySelector('.fade'), dusk = host.querySelector('.dusk'), todSlider = host.querySelector('.tod');
  const st = { mode: 'cinematic', t: 0, dur: 90, playing: false, yaw: 0, pitch: 0, keys: new Set(), tod: 0, lockTod: false, running: false, onEnd: null, route: GEO_HERO };
  let spP, spL, lastCap = -1, hotEls = [], pos = new Cesium.Cartesian3(), bob = 0, lastT = performance.now();
  const showCaption = c => { const ph = c && c[2] && photo && photo(c[2]); capEl.innerHTML = c ? `<h2>${c[0]}</h2><p>${c[1] || ''}</p>${ph ? `<figure><img src="${ph.url}" alt="${c[0]}"><figcaption>${ph.cap}</figcaption></figure>` : ''}` : ''; capEl.classList.toggle('on', !!c); };

  function setRoute(route, dur) {
    st.route = route; st.dur = dur; let acc = 0; const kn = route.map(r => (acc += r.d || 0)); st.knots = kn.map(k => k / (acc || 1));
    const times = st.knots.map(k => k * dur);
    spP = new Cesium.CatmullRomSpline({ times, points: route.map(w => cart(w.p.lon, w.p.lat, w.p.agl)) });
    spL = new Cesium.CatmullRomSpline({ times, points: route.map(w => cart(w.l.lon, w.l.lat, w.l.agl)) });
  }
  function orient(p, target) {
    const dir = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(target, p, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    const up0 = ell.geodeticSurfaceNormal(p, new Cesium.Cartesian3()), right = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(dir, up0, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    const up = Cesium.Cartesian3.cross(right, dir, new Cesium.Cartesian3()); cam.setView({ destination: p, orientation: { direction: dir, up } });
  }
  const enuDir = (p, yaw, pitch) => { const m = Cesium.Transforms.eastNorthUpToFixedFrame(p); return { m, d: Cesium.Matrix4.multiplyByPointAsVector(m, new Cesium.Cartesian3(Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)), new Cesium.Cartesian3()) }; };
  function lookYP(p, yaw, pitch) { const { d } = enuDir(p, yaw, pitch); orient(p, Cesium.Cartesian3.add(p, d, new Cesium.Cartesian3())); }
  const groundAt = p => { ell.cartesianToCartographic(p, tmpC); let h; try { h = scene.sampleHeight(tmpC); } catch {} return isFinite(h) ? h : elev(Cesium.Math.toDegrees(tmpC.longitude), Cesium.Math.toDegrees(tmpC.latitude)) + geoid; };

  function mkHot(label, sub, c3, cls, onClick) { const b = document.createElement('button'); b.className = 'hot ' + cls; b.innerHTML = `<span class="dot"></span><span class="lab"><b>${label}</b><small>${sub || ''}</small></span>`; b.addEventListener('click', onClick); hot.appendChild(b); hotEls.push({ b, p: c3 }); }
  const project = SceneProj(Cesium);
  function projectHotspots() {
    for (const h of hotEls) {
      const d = Cesium.Cartesian3.distance(cam.positionWC, h.p), v = Cesium.Cartesian3.subtract(h.p, cam.positionWC, new Cesium.Cartesian3()), front = Cesium.Cartesian3.dot(v, cam.directionWC) > 0;
      const w = front && project(scene, h.p), lim = st.mode === 'walk' ? 120 : 9000;
      const vis = w && d < lim && w.x > -50 && w.y > -50 && w.x < host.clientWidth + 50 && w.y < host.clientHeight + 50; h.b.style.display = vis ? '' : 'none'; if (!vis) continue;
      h.b.style.transform = `translate(${w.x}px,${w.y}px)`; h.b.classList.toggle('near', d < 30); h.b.style.opacity = Math.max(0.4, 1 - d / lim);
    }
  }

  function setMode(mode, opts = {}) {
    st.mode = mode; host.dataset.mode = mode; showCaption(null); hot.innerHTML = ''; hotEls = []; st.keys.clear();
    host.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    if (mode === 'cinematic') { setRoute(opts.route || GEO_HERO, opts.dur || 90); st.t = 0; st.playing = true; st.lockTod = !!opts.tod; st.customTod = opts.todFn || null; st.onEnd = opts.onEnd === undefined ? (() => setMode('walk', { arrive: true })) : opts.onEnd; lastCap = -1; }
    if (mode === 'free') { st.lockTod = false; st.playing = false; const tgt = cart(73.6835, 24.5764, 30); if (Cesium.Cartesian3.distance(cam.positionWC, tgt) > 15000 || st.mode0 === 'walk') pos = cart(73.668, 24.560, 700); else pos = Cesium.Cartesian3.clone(cam.positionWC); const v = Cesium.Cartesian3.subtract(tgt, pos, new Cesium.Cartesian3()), { m } = enuDir(pos, 0, 0), inv = Cesium.Matrix4.inverse(m, new Cesium.Matrix4()), l = Cesium.Matrix4.multiplyByPointAsVector(inv, v, new Cesium.Cartesian3()); st.yaw = Math.atan2(l.x, l.y); st.pitch = -0.3; places.forEach(pl => mkHot(pl.name, 'Open story', cart(pl.lon, pl.lat, 60), 'place', () => onPlace(pl))); }
    if (mode === 'walk') { st.lockTod = false; st.playing = false; st.yaw = 0; st.pitch = -0.02; pos = cart(73.6836, 24.5793, 2); ell.cartesianToCartographic(pos, tmpC); pos = Cesium.Cartesian3.fromRadians(tmpC.longitude, tmpC.latitude, groundAt(pos) + 1.7); artisans.forEach(a => mkHot(a.name.replace(' (sample)', ''), a.craft, cart(a.lon, a.lat, 4), 'shop', () => onArtisan(a))); toast(opts.arrive ? 'You have landed on real photogrammetry. Walk with W A S D, drag to look.' : 'Walk with W A S D, drag to look — tap a marker.'); }
    st.mode0 = mode;
  }

  // input
  let drag = false, lx = 0, ly = 0;
  stage.addEventListener('pointerdown', e => { if (st.mode === 'cinematic') return; drag = true; lx = e.clientX; ly = e.clientY; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (!drag) return; st.yaw += (e.clientX - lx) * 0.004; st.pitch = Math.max(-1.45, Math.min(1.45, st.pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; });
  stage.addEventListener('pointerup', () => (drag = false));
  addEventListener('keydown', e => { if (!st.running || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; st.keys.add(e.key.toLowerCase()); });
  addEventListener('keyup', e => st.keys.delete(e.key.toLowerCase()));
  const fwdBtn = host.querySelector('.fwd'); if (fwdBtn) { const on = () => st.keys.add('w'), off = () => st.keys.delete('w'); fwdBtn.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => fwdBtn.addEventListener(ev, off)); }
  if (todSlider) todSlider.addEventListener('input', () => { st.tod = +todSlider.value; st.lockTod = true; });

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function applyTod(t) { // Google tiles carry baked daylight, so dusk is a colour grade over the canvas
    const k = smooth(0.25, 1, t), r = Math.round(255 - k * 60 + (t < 0.5 ? 0 : 0)), g = Math.round(255 - k * 120), b = Math.round(255 - k * 40 - smooth(0.6, 1, t) * 90);
    dusk.style.background = `rgb(${r},${g},${Math.max(110, b)})`; dusk.style.opacity = String(Math.min(0.9, k * 1.2)); dusk.style.display = 'block'; if (todSlider) todSlider.value = t;
  }

  scene.preRender.addEventListener(() => {
    if (!st.running) return; const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (st.mode === 'cinematic' && st.playing) {
      st.t += dt / st.dur; const t = Math.min(1, st.t), sec = t * st.dur;
      const p = spP.evaluate(sec), l = spL.evaluate(sec); orient(p, l);
      const seg = st.route; let ci = -1; for (let i = 0; i < seg.length; i++) if (seg[i].cap && t >= st.knots[i] - 0.06) ci = i; if (ci !== lastCap) { lastCap = ci; showCaption(ci >= 0 ? seg[ci].cap : null); }
      if (!st.lockTod) { if (st.customTod) st.tod = st.customTod(t); else { let i = 0; while (i < seg.length - 2 && t > st.knots[i + 1]) i++; const s = (t - st.knots[i]) / ((st.knots[i + 1] - st.knots[i]) || 1); st.tod = (seg[i].t ?? 0) + ((seg[i + 1].t ?? seg[i].t ?? 0) - (seg[i].t ?? 0)) * Math.min(1, Math.max(0, s)); } }
      prog.style.width = (t * 100).toFixed(1) + '%';
      if (st.t >= 1) { st.playing = false; const end = st.onEnd; if (end) { fade.classList.add('on'); setTimeout(() => { end(); setTimeout(() => fade.classList.remove('on'), 400); }, 900); } }
    } else if (st.mode === 'free' || st.mode === 'walk') {
      const k = st.keys, f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0), s = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      const { m, d } = enuDir(pos, st.yaw, st.mode === 'free' ? st.pitch : 0); const up = ell.geodeticSurfaceNormal(pos, new Cesium.Cartesian3()), right = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(d, up, new Cesium.Cartesian3()), new Cesium.Cartesian3());
      const sp = st.mode === 'free' ? (k.has('shift') ? 900 : 260) : 3.2, mv = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(d, f * sp * dt, mv); Cesium.Cartesian3.add(pos, mv, pos); Cesium.Cartesian3.multiplyByScalar(right, s * sp * dt, mv); Cesium.Cartesian3.add(pos, mv, pos);
      if (st.mode === 'free') { if (k.has('e')) Cesium.Cartesian3.add(pos, Cesium.Cartesian3.multiplyByScalar(up, sp * dt, mv), pos); if (k.has('q')) Cesium.Cartesian3.add(pos, Cesium.Cartesian3.multiplyByScalar(up, -sp * dt, mv), pos); }
      ell.cartesianToCartographic(pos, tmpC); const g = groundAt(pos), want = st.mode === 'free' ? Math.max(tmpC.height, g + 25) : g + 1.7 + Math.sin((bob += (Math.abs(f) + Math.abs(s)) * dt * 7)) * 0.04;
      pos = Cesium.Cartesian3.fromRadians(tmpC.longitude, tmpC.latitude, want); lookYP(pos, st.yaw, st.pitch);
    }
    if (!st.lockTod || st.mode !== 'cinematic') applyTod(st.tod); else applyTod(st.tod);
    projectHotspots();
  });

  const api = {
    st, setMode, google: true, real: true, attribution: ['3D map data © Google (Photorealistic 3D Tiles) via CesiumJS', 'Elevation for altitudes: AWS Open Data Terrain Tiles'],
    resize() { viewer.resize(); },
    start(mode = 'cinematic', opts) { st.running = true; viewer.resize(); setMode(mode, opts); lastT = performance.now(); calibrate().then(() => { if (st.mode === 'cinematic' && st.t < 0.02) setRoute(st.route, st.dur); }); },
    stop() { st.running = false; showCaption(null); dusk.style.display = 'none'; },
    togglePause() { st.playing = !st.playing; return st.playing; },
    seek(t) { st.t = t; },
    goTo(pl) { if (st.mode !== 'free') setMode('free'); pos = cart(pl.lon - 0.004, pl.lat - 0.004, 350); const v = Cesium.Cartesian3.subtract(cart(pl.lon, pl.lat, 20), pos, new Cesium.Cartesian3()), inv = Cesium.Matrix4.inverse(enuDir(pos, 0, 0).m, new Cesium.Matrix4()), l = Cesium.Matrix4.multiplyByPointAsVector(inv, v, new Cesium.Cartesian3()); st.yaw = Math.atan2(l.x, l.y); st.pitch = Math.atan2(l.z, Math.hypot(l.x, l.y)); },
    flyThrough(route, dur, style) { setMode('cinematic', { route, dur, onEnd: null, todFn: style === 'sunset' ? t => 0.45 + t * 0.5 : () => 0.02 }); },
    dispose() { st.running = false; try { viewer.destroy(); } catch {} root.remove(); dusk.style.display = 'none'; },
  };
  return api;
}
function SceneProj(C) { const f = C.SceneTransforms.worldToWindowCoordinates || C.SceneTransforms.wgs84ToWindowCoordinates; return (scene, p) => f.call(C.SceneTransforms, scene, p); }
