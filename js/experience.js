// The 3D experience: Cinematic Flyover, Free Explore, Walk the City. Owns renderer, camera paths, captions and hotspots.
import * as THREE from '../vendor/three.module.js';
import { buildCity, STREET_ORIGIN, makeSignSprite } from './world.js';
import { setSound, soundOn } from './audio.js';
import { loadTerrain } from './terrain.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Hand-authored hero route. `cap` = caption shown when the camera reaches that waypoint; `t` = time of day (0 day … 1 dusk).
export const HERO_ROUTE = [
  { p: V(-250, 150, -300), l: V(-120, 10, -150), t: 0.0, cap: ['Aravalli Hills', 'The ancient range that cradles the city of lakes', 'aravalli'], d: 0 },
  { p: V(-215, 70, -250), l: V(-120, 0, -150), t: 0.08, cap: ['Fateh Sagar Lake', 'A 17th-century lake ringed by hills', 'fatehsagar'], d: 9 },
  { p: V(-75, 50, -75), l: V(-80, 0, -140), t: 0.2, cap: ['Saheliyon Ki Bari', 'Royal gardens of fountains and lotus pools'], d: 8 },
  { p: V(-45, 42, 0), l: V(0, 0, 40), t: 0.3, cap: ['Lake Pichola', 'Heart of Udaipur, 1362'], d: 7 },
  { p: V(40, 34, -50), l: V(118, 10, 22), t: 0.42, cap: ['City Palace', 'Mewar\'s palace complex above the water', 'citypalace'], d: 6 },
  { p: V(60, 30, -20), l: V(118, 10, 22), t: 0.5, d: 5 },
  { p: V(55, 30, 60), l: V(118, 10, 22), t: 0.58, d: 5 },
  { p: V(-30, 28, 110), l: V(12, 5, 66), t: 0.68, cap: ['Jag Mandir', 'The Lake Garden Palace', 'jagmandir'], d: 7 },
  { p: V(10, 14, 92), l: V(12, 5, 66), t: 0.78, d: 5 },
  { p: V(85, 28, 40), l: V(150, 3, -6), t: 0.88, cap: ['Jagdish Temple lanes', 'Descending into the old city'], d: 7 },
  { p: V(142, 9, 6), l: V(150, 2, -14), t: 0.95, d: 5 },
];

// Real-geography route (used when the baked DEM terrain is available): lon/lat + metres above ground.
const G = (lon, lat, agl = 0) => ({ lon, lat, agl });
export const GEO_HERO = [
  { p: G(73.640, 24.614, 650), l: G(73.671, 24.601), t: 0.0, cap: ['Aravalli Hills', 'The ancient range that cradles the city of lakes', 'aravalli'], d: 0 },
  { p: G(73.652, 24.612, 420), l: G(73.673, 24.601), t: 0.08, cap: ['Fateh Sagar Lake', 'A 17th-century lake ringed by hills', 'fatehsagar'], d: 9 },
  { p: G(73.668, 24.594, 330), l: G(73.680, 24.580), t: 0.2, cap: ['Along the lake chain', 'From Fateh Sagar south to the old city'], d: 8 },
  { p: G(73.670, 24.581, 260), l: G(73.678, 24.572), t: 0.3, cap: ['Lake Pichola', 'Heart of Udaipur, 1362'], d: 7 },
  { p: G(73.6755, 24.5825, 360), l: G(73.6835, 24.5764, 30), t: 0.42, cap: ['City Palace', 'Mewar\'s palace complex above the water', 'citypalace'], d: 6 },
  { p: G(73.6785, 24.5762, 330), l: G(73.6835, 24.5764, 30), t: 0.5, d: 5 },
  { p: G(73.6800, 24.5710, 340), l: G(73.6835, 24.5764, 30), t: 0.58, d: 5 },
  { p: G(73.6735, 24.5648, 400), l: G(73.6783, 24.5695, 10), t: 0.68, cap: ['Jag Mandir', 'The Lake Garden Palace', 'jagmandir'], d: 7 },
  { p: G(73.6760, 24.5670, 280), l: G(73.6783, 24.5695, 10), t: 0.78, d: 5 },
  { p: G(73.6800, 24.5745, 330), l: G(73.6837, 24.5802, 10), t: 0.88, cap: ['Jagdish Temple lanes', 'Descending into the old city'], d: 7 },
  { p: G(73.6830, 24.5785, 190), l: G(73.6837, 24.5802, 12), t: 0.95, d: 5 },
];
export const geoPlace = (pl, agl = 0) => G(pl.lon, pl.lat, agl);

export async function createExperience(host, deps) {
  const { places, artisans, onPlace, onArtisan, toast, photo } = deps;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); host.querySelector('.stage').appendChild(renderer.domElement);
  let T = null; try { T = await loadTerrain(renderer); } catch (err) { console.warn('Real terrain assets missing — using the procedural stand-in. Run tools/build_terrain.py.', err); }
  const S = T ? 10 : 1;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(62, 1, T ? 2 : 0.3, T ? 45000 : 2500);
  const world = buildCity(scene, { terrain: T });
  const placePos = (pl, up = 0) => (T ? T.place(pl.lon, pl.lat, up) : V(...pl.world).add(V(0, up, 0)));
  const toWorld = g => (T ? T.place(g.lon, g.lat, g.agl) : g);
  const realRoute = r => r.map(w => ({ ...w, p: toWorld(w.p), l: toWorld(w.l) }));
  const capEl = host.querySelector('.caption'), hot = host.querySelector('.hotspots'), prog = host.querySelector('.progress i'), fade = host.querySelector('.fade');
  const st = { mode: 'cinematic', route: T ? realRoute(GEO_HERO) : HERO_ROUTE, t: 0, dur: T ? 90 : 70, playing: false, yaw: 0, pitch: 0, keys: new Set(), tod: 0, lockTod: false, landed: false, running: false, onEnd: null, loop: true };
  let curveP, curveL, lastCap = -1, bob = 0;

  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize);

  function setRoute(route, dur) {
    st.route = route; st.dur = dur;
    curveP = new THREE.CatmullRomCurve3(route.map(r => r.p), false, 'centripetal'); curveL = new THREE.CatmullRomCurve3(route.map(r => r.l), false, 'centripetal');
    let acc = 0; st.knots = route.map((r, i) => (acc += r.d || 0)); const total = acc || 1; st.knots = st.knots.map(k => k / total);
  }
  const uAt = t => { const k = st.knots, n = k.length; let i = 0; while (i < n - 2 && t > k[i + 1]) i++; const s = (t - k[i]) / ((k[i + 1] - k[i]) || 1); return (i + Math.min(1, Math.max(0, s))) / (n - 1); };
  function showCaption(c) { const ph = c && c[2] && photo && photo(c[2]); capEl.innerHTML = c ? `<h2>${c[0]}</h2><p>${c[1] || ''}</p>${ph ? `<figure><img src="${ph.url}" alt="${c[0]}"><figcaption>${ph.cap}</figcaption></figure>` : ''}` : ''; capEl.classList.toggle('on', !!c); }
  const smoothstep = x => x * x * (3 - 2 * x);

  function setMode(mode, opts = {}) {
    st.mode = mode; host.dataset.mode = mode; showCaption(null); hot.innerHTML = ''; hotEls = [];
    host.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    st.keys.clear();
    if (mode === 'cinematic') { setRoute(opts.route || (T ? realRoute(GEO_HERO) : HERO_ROUTE), opts.dur || (T ? 90 : 70)); st.t = 0; st.playing = true; st.loop = opts.loop ?? false; st.lockTod = !!opts.tod; if (opts.tod != null) { st.tod = opts.tod; } st.onEnd = opts.onEnd === undefined ? (() => setMode('walk', { arrive: true })) : opts.onEnd; lastCap = -1; st.customTod = opts.todFn || null; }
    if (mode === 'free') { st.lockTod = false; st.playing = false; const f = new THREE.Vector3(); f.copy(cam.position); if (cam.position.distanceTo(STREET_ORIGIN) < 500 || cam.position.y < 5) cam.position.copy(T ? T.place(73.668, 24.560, 700) : V(30, 70, 140)); const tgt = T ? T.place(73.6835, 24.5764) : V(0, 0, 30); st.yaw = Math.atan2(-(tgt.x - cam.position.x), -(tgt.z - cam.position.z)); st.pitch = T ? -0.3 : -0.25; addPlaceHotspots(); }
    cam.near = mode === 'walk' ? 0.15 : (T ? 2 : 0.3); cam.updateProjectionMatrix();
    if (mode === 'walk') { st.lockTod = false; st.playing = false; cam.position.copy(STREET_ORIGIN).add(V(0, 1.65, opts.arrive ? 4 : 2)); st.yaw = 0; st.pitch = -0.02; if (opts.arrive) st.tod = Math.max(st.tod, 0.7); addShopHotspots(); toast(opts.arrive ? 'You have landed. Walk with W A S D or drag to look — tap a shop sign.' : 'Walk with W A S D or drag to look — tap a shop sign.'); }
  }

  let hotEls = [];
  function mkHot(label, sub, worldPos, cls, onClick) {
    const b = document.createElement('button'); b.className = 'hot ' + cls; b.innerHTML = `<span class="dot"></span><span class="lab"><b>${label}</b><small>${sub || ''}</small></span>`; b.addEventListener('click', onClick); hot.appendChild(b); hotEls.push({ b, p: worldPos }); }
  function addPlaceHotspots() { places.forEach(pl => mkHot(pl.name, 'Open story', placePos(pl, 14 * S), 'place', () => onPlace(pl))); }
  function addShopHotspots() { artisans.forEach(a => { const pos = STREET_ORIGIN.clone().add(V(a.world[0] * 0.9, 2.9, a.world[2])); mkHot(a.name.replace(' (sample)', ''), a.craft, pos, 'shop', () => onArtisan(a)); }); }

  const tmp = V(0, 0, 0);
  function projectHotspots() {
    for (const h of hotEls) {
      tmp.copy(h.p).project(cam); const d = cam.position.distanceTo(h.p);
      const vis = tmp.z < 1 && tmp.z > -1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && d < (st.mode === 'walk' ? 60 : 420 * S);
      h.b.style.display = vis ? '' : 'none'; if (!vis) continue;
      h.b.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * host.clientWidth}px, ${(-tmp.y * 0.5 + 0.5) * host.clientHeight}px)`;
      h.b.classList.toggle('near', d < 16); h.b.style.opacity = Math.max(0.35, 1 - d / (st.mode === 'walk' ? 70 : 520 * S));
    }
  }

  // pointer look
  const stage = host.querySelector('.stage'); let drag = false, lx = 0, ly = 0;
  stage.addEventListener('pointerdown', e => { if (st.mode === 'cinematic') return; drag = true; lx = e.clientX; ly = e.clientY; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (!drag) return; st.yaw -= (e.clientX - lx) * 0.004; st.pitch = Math.max(-1.45, Math.min(1.45, st.pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; });
  stage.addEventListener('pointerup', () => (drag = false));
  stage.addEventListener('wheel', e => { if (st.mode === 'free') { cam.position.addScaledVector(lookDir(), -e.deltaY * 0.15 * S); e.preventDefault(); } }, { passive: false });
  addEventListener('keydown', e => { if (!st.running || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; st.keys.add(e.key.toLowerCase()); });
  addEventListener('keyup', e => st.keys.delete(e.key.toLowerCase()));
  const fwdBtn = host.querySelector('.fwd'); if (fwdBtn) { const on = () => st.keys.add('w'), off = () => st.keys.delete('w'); fwdBtn.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => fwdBtn.addEventListener(ev, off)); }
  const lookDir = () => V(Math.sin(st.yaw) * Math.cos(st.pitch) * -1, Math.sin(st.pitch), -Math.cos(st.yaw) * Math.cos(st.pitch));

  const todSlider = host.querySelector('.tod'); if (todSlider) todSlider.addEventListener('input', () => { st.tod = +todSlider.value; st.lockTod = true; });

  let last = performance.now();
  function frame(now) {
    if (!st.running) return; requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (st.mode === 'cinematic' && st.playing) {
      st.t += dt / st.dur; const t = Math.min(1, st.t), u = uAt(t);
      curveP.getPoint(Math.min(0.9999, u), cam.position); curveL.getPoint(Math.min(0.9999, u), tmp); cam.lookAt(tmp);
      cam.position.y = Math.max(cam.position.y, world.heightAt(cam.position.x, cam.position.z) + 10 * S);
      const seg = st.route; let ci = -1; for (let i = 0; i < seg.length; i++) if (seg[i].cap && t >= st.knots[i] - 0.06) ci = i;
      if (ci !== lastCap) { lastCap = ci; showCaption(ci >= 0 ? seg[ci].cap : null); }
      if (!st.lockTod) st.tod = st.customTod ? st.customTod(t) : (() => { const f = u * (seg.length - 1); const i = Math.min(seg.length - 2, Math.floor(f)); return seg[i].t + (seg[i + 1].t - seg[i].t) * (f - i); })();
      prog.style.width = (t * 100).toFixed(1) + '%';
      if (st.t >= 1) { st.playing = false; const end = st.onEnd; if (end) { fade.classList.add('on'); setTimeout(() => { end(); setTimeout(() => fade.classList.remove('on'), 400); }, 900); } }
    } else if (st.mode === 'free' || st.mode === 'walk') {
      const k = st.keys, sp = st.mode === 'free' ? (k.has('shift') ? 90 : 38) * S : 3.2, f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0), s = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      if (st.mode === 'free') { const ld = lookDir(); cam.position.addScaledVector(ld, f * sp * dt); cam.position.x += Math.cos(st.yaw) * s * sp * dt; cam.position.z += Math.sin(st.yaw) * s * sp * dt; cam.position.y += ((k.has('e') ? 1 : 0) - (k.has('q') ? 1 : 0)) * sp * dt; cam.position.y = Math.max(world.heightAt(cam.position.x, cam.position.z) + 8 * S, cam.position.y); }
      else { const dx = -Math.sin(st.yaw) * f + Math.cos(st.yaw) * s, dz = -Math.cos(st.yaw) * f + Math.sin(st.yaw) * s; cam.position.x += dx * sp * dt; cam.position.z += dz * sp * dt; const o = STREET_ORIGIN; cam.position.x = Math.max(o.x - 3.2, Math.min(o.x + 3.2, cam.position.x)); cam.position.z = Math.max(o.z - 120, Math.min(o.z + 6, cam.position.z)); bob += (Math.abs(f) + Math.abs(s)) * dt * 7; cam.position.y = 1.65 + Math.sin(bob) * 0.04; }
      const ld = lookDir(); cam.lookAt(cam.position.x + ld.x, cam.position.y + ld.y, cam.position.z + ld.z);
    }
    if (todSlider) todSlider.value = st.tod; world.setTime(st.tod); scene.fog.near = st.mode === 'walk' ? 20 : 150 * S; scene.fog.far = st.mode === 'walk' ? 160 : 1100 * S * (T ? 2 : 1);
    world.update(dt, cam); projectHotspots(); renderer.render(scene, cam);
  }

  // street sign sprites
  artisans.forEach(a => { const s = makeSignSprite(a.name.replace(' (sample)', ''), a.craft); s.position.copy(V(a.world[0] * 0.9, 4.2, a.world[2])); world.street.add(s); });

  return {
    st, setMode, resize, real: !!T, attribution: T ? T.attribution : [],
    start(mode = 'cinematic', opts) { st.running = true; resize(); setMode(mode, opts); last = performance.now(); requestAnimationFrame(frame); },
    stop() { st.running = false; showCaption(null); },
    togglePause() { st.playing = !st.playing; return st.playing; },
    seek(t) { st.t = t; },
    goTo(pl) { if (st.mode !== 'free') setMode('free'); const c = placePos(pl), p = c.clone().add(V(-45 * S, 30 * S, 55 * S)), d = c.clone().sub(p).normalize(); cam.position.copy(p); st.yaw = Math.atan2(-d.x, -d.z); st.pitch = Math.asin(d.y); },
    flyThrough(route, dur, style) { setMode('cinematic', { route: T ? realRoute(route) : route, dur, onEnd: null, todFn: style === 'sunset' ? t => 0.45 + t * 0.5 : () => 0.02 }); },
    renderer, cam, dispose() { st.running = false; renderer.dispose(); renderer.domElement.remove(); },
  };
}

// Build a personalised "My Udaipur" route. Real mode returns lon/lat waypoints (offsets in degrees ~ metres); procedural mode returns world vectors.
export function routeFromPlaces(placeList, real) {
  if (real) {
    const m = 1 / 101000; // ~degrees per 10 m (lat ≈ 111 km/deg, lon ≈ 101 km/deg at 24.6°N)
    const pts = [{ p: G(placeList[0].lon - 2500 * m * 0.1 * 10, placeList[0].lat + 2200 * m * 0.1 * 10, 900), l: G(placeList[0].lon, placeList[0].lat), d: 0 }];
    let prev = pts[0].p;
    placeList.forEach((pl, i) => {
      let dx = prev.lon - pl.lon, dy = prev.lat - pl.lat; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      const far = G(pl.lon + dx * 0.0085, pl.lat + dy * 0.0085, 420), near = G(pl.lon + dx * 0.0042 - dy * 0.0025, pl.lat + dy * 0.0042 + dx * 0.0025, 200);
      pts.push({ p: far, l: G(pl.lon, pl.lat, 20), d: 7 }, { p: near, l: G(pl.lon, pl.lat, 20), d: 6, cap: [pl.name, `Stop ${i + 1} of ${placeList.length}`] }); prev = near;
    });
    return pts;
  }
  const pts = [{ p: V(-300, 170, -300), l: V(...placeList[0].world), cap: null, d: 0 }];
  let prev = pts[0].p.clone();
  placeList.forEach((pl, i) => {
    const c = V(...pl.world), dir = prev.clone().sub(c).setY(0).normalize();
    const far = c.clone().addScaledVector(dir, 90).add(V(0, 42, 0)), near = c.clone().addScaledVector(dir, 48).add(V(0, 20, 0)).add(V(dir.z, 0, -dir.x).multiplyScalar(18));
    pts.push({ p: far, l: c, d: 7 }, { p: near, l: c, d: 6, cap: [pl.name, `Stop ${i + 1} of ${placeList.length}`] }); prev = near;
  });
  return pts;
}
