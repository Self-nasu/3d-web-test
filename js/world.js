// Procedural, stylised Udaipur: terrain, lakes, palaces, old-city blocks, plus a walkable heritage lane.
// Layout is schematic (not survey-accurate): x = east, z = south, y = up. 1 unit ~ 3 m.
import * as THREE from '../vendor/three.module.js';

export const STREET_ORIGIN = new THREE.Vector3(2000, 0, 0);
export const LAKES = [
  { name: 'pichola', cx: 0, cz: 30, rx: 95, rz: 70 },
  { name: 'fateh', cx: -120, cz: -150, rx: 85, rz: 55 },
];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function noise2(x, z) { // cheap value-noise-ish
  return Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.7) * 0.5 + Math.sin(x * 0.11 + z * 0.09) * 0.25 + Math.sin(z * 0.2 - x * 0.13) * 0.12;
}
export function lakeE(x, z, l) { const dx = (x - l.cx) / l.rx, dz = (z - l.cz) / l.rz; return Math.sqrt(dx * dx + dz * dz); }
export function inLake(x, z, pad = 0) { return LAKES.some(l => lakeE(x, z, l) < 1.0 + pad); }

export function heightAt(x, z) {
  const r = Math.hypot(x - 20, z + 30);
  let h = 2.2 + noise2(x, z) * 1.6;
  h += Math.pow(Math.max(0, (r - 215) / 130), 1.5) * 120 * (0.75 + 0.5 * Math.abs(noise2(x * 0.4, z * 0.4)));
  h += 7 * smooth(120, 0, Math.hypot(x - 125, z - 10)); // palace hill
  for (const l of LAKES) h = h + (-6 - h) * (1 - smooth(0.82, 1.04, lakeE(x, z, l)));
  return h;
}

function box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = false; return m; }

export function buildCity(scene) {
  const root = new THREE.Group(); scene.add(root);
  const R = rng(7);

  // ---- terrain
  const size = 1300, seg = 360;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z); pos.setY(i, h);
    const dry = smooth(8, 70, h), shore = 1 - smooth(-1, 3, h);
    c.setRGB(0.36, 0.45, 0.22).lerp(new THREE.Color(0.62, 0.52, 0.34), dry * 0.9 + 0.1 * Math.abs(noise2(x, z)))
      .lerp(new THREE.Color(0.55, 0.50, 0.38), smooth(60, 110, h) * 0.8).lerp(new THREE.Color(0.7, 0.62, 0.45), shore * 0.7);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  root.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // ---- water
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x2f6f8f, specular: 0xffffff, shininess: 140, transparent: true, opacity: 0.92 });
  for (const l of LAKES) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(1, 64), waterMat);
    w.rotation.x = -Math.PI / 2; w.scale.set(l.rx * 1.08, l.rz * 1.08, 1); w.position.set(l.cx, 0.3, l.cz); root.add(w);
  }

  // ---- old-city blocks (instanced)
  const blocks = [];
  const tryAdd = (x0, x1, z0, z1, n, hmin, hmax) => {
    for (let i = 0; i < n * 6 && blocks.length < 1400; i++) {
      const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0), h0 = heightAt(x, z);
      if (h0 < 1.4 || inLake(x, z, 0.12) || Math.hypot(x - 118, z - 22) < 34) continue;
      blocks.push({ x, z, y: h0, w: 3 + R() * 5, d: 3 + R() * 5, h: hmin + R() * (hmax - hmin) });
      if (blocks.filter(b => b.__t === n).length > n) break;
    }
  };
  tryAdd(60, 250, -90, 120, 600, 3, 9);       // east bank old city
  tryAdd(-175, -100, -40, 110, 160, 2.5, 6);  // west ghats
  tryAdd(-190, -40, -190, -110, 60, 2.5, 5);  // around Fateh Sagar
  const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), blocks.length);
  const palette = [0xf1e6cf, 0xe8d6b0, 0xd9b98a, 0xf5efe3, 0xcfa76f, 0xe9c9a0], d = new THREE.Object3D();
  blocks.forEach((b, i) => {
    d.position.set(b.x, b.y + b.h / 2, b.z); d.scale.set(b.w, b.h, b.d); d.rotation.y = (R() - 0.5) * 0.5; d.updateMatrix();
    bm.setMatrixAt(i, d.matrix); bm.setColorAt(i, new THREE.Color(palette[(R() * palette.length) | 0]));
  });
  root.add(bm);

  // ---- helpers for domes & chhatris
  const sand = new THREE.MeshLambertMaterial({ color: 0xe8d3a6 }), white = new THREE.MeshLambertMaterial({ color: 0xf6f0e4 });
  const gold = new THREE.MeshLambertMaterial({ color: 0xc9a227, emissive: 0x2a2000 }), dark = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
  const glass = new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0 }); // windows glow at dusk
  function dome(x, y, z, r, mat = white) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); m.position.set(x, y, z); const f = new THREE.Mesh(new THREE.ConeGeometry(r * 0.08, r * 0.5, 6), gold); f.position.set(x, y + r * 1.1, z); return [m, f]; }
  function chhatri(parent, x, y, z, s) {
    const grp = new THREE.Group(); grp.position.set(x, y, z);
    const slab = box(2.6 * s, 0.25 * s, 2.6 * s, sand); grp.add(slab);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.09 * s, 1.6 * s, 6), sand); p.position.set(px * s, 0.9 * s, pz * s); grp.add(p); }
    for (const m of dome(0, 1.7 * s, 0, 1.5 * s)) grp.add(m); parent.add(grp);
  }
  function palace(x, y, z, w, depth, floors, rotY) {
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rotY;
    for (let f = 0; f < floors; f++) {
      const fw = w * (1 - f * 0.12), fh = 5; const b = box(fw, fh, depth, f % 2 ? white : sand); b.position.y = f * fh + fh / 2 + 1; grp.add(b);
      const band = box(fw + 0.4, 0.5, depth + 0.4, gold); band.position.y = f * fh + fh + 1; grp.add(band);
      const win = box(fw * 0.96, fh * 0.35, 0.3, glass); win.position.set(0, f * fh + fh * 0.6 + 1, depth / 2 + 0.2); grp.add(win);
    }
    const top = floors * 5 + 1.5;
    const towers = 5; for (let i = 0; i < towers; i++) {
      const tx = -w / 2 + (w * i) / (towers - 1) * 0.92 + w * 0.04; const t = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, top + 4, 10), white); t.position.set(tx, (top + 4) / 2, -depth / 2 + 1);
      grp.add(t); for (const m of dome(tx, top + 4, -depth / 2 + 1, 2.6)) grp.add(m); chhatri(grp, tx, top - 1, depth / 2 - 2, 1);
    }
    root.add(grp); return grp;
  }
  const windowMats = [glass];

  // ---- landmarks
  palace(118, 8.5, 22, 62, 22, 3, -Math.PI / 2 + 0.15);   // City Palace, facing the lake (west)
  palace(78, 3.6, -18, 26, 14, 2, -Math.PI / 2 + 0.3);   // Bagore ki Haveli
  // Jag Mandir island
  const isl = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 3, 24), new THREE.MeshLambertMaterial({ color: 0x5f7f3a })); isl.position.set(12, 0.9, 66); root.add(isl);
  const jag = palace(12, 1.2, 66, 14, 9, 2, 0); for (let i = 0; i < 9; i++) { const a = R() * 6.28, rr = 8 + R() * 6, t = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 6), new THREE.MeshLambertMaterial({ color: 0x3e7a3a })); t.position.set(12 + Math.cos(a) * rr, 3.5, 66 + Math.sin(a) * rr); root.add(t); }
  // Lake Palace (white, on water)
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 2.5, 20), white); lp.position.set(-25, 0.9, 12); root.add(lp);
  const lpg = palace(-25, 1.8, 12, 20, 9, 2, 0.4); lpg.scale.set(0.9, 0.9, 0.9);
  // Saheliyon ki Bari garden
  const gar = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.6, 20), new THREE.MeshLambertMaterial({ color: 0x4a8a3a })); gar.position.set(-80, heightAt(-80, -140) + 0.4, -140); root.add(gar);

  // ---- trees
  const tg = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0x3f6f35 }), 450); let ti = 0;
  for (let i = 0; i < 4000 && ti < 450; i++) { const x = (R() - 0.5) * 520, z = (R() - 0.5) * 520, h = heightAt(x, z); if (h < 1.5 || h > 50 || inLake(x, z, 0.1) || Math.hypot(x - 125, z - 10) < 100) continue; d.position.set(x, h + 1.6, z); d.scale.setScalar(0.8 + R() * 0.9); d.rotation.set(0, 0, 0); d.updateMatrix(); tg.setMatrixAt(ti++, d.matrix); }
  tg.count = ti; root.add(tg);

  // ---- dusk window lights + stars
  const lp2 = []; for (const b of blocks) if (R() < 0.45) lp2.push(b.x, b.y + b.h * (0.4 + R() * 0.4), b.z);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp2, 3));
  const lights = new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xffc46b, size: 2.2, transparent: true, opacity: 0, depthWrite: false })); root.add(lights);
  const sp = []; for (let i = 0; i < 700; i++) { const a = R() * 6.28, e = 0.15 + R() * 1.3; sp.push(Math.cos(a) * Math.cos(e) * 900, Math.sin(e) * 900, Math.sin(a) * Math.cos(e) * 900); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, transparent: true, opacity: 0, fog: false })); root.add(stars);

  // ---- sky dome
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 top,hor,sunCol,sunDir; varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(hor, top, pow(h,0.55)); float s = max(dot(normalize(vP), normalize(sunDir)),0.0); c += sunCol*(pow(s,48.0)*0.9 + pow(s,6.0)*0.25); gl_FragColor = vec4(c,1.0);}',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat); root.add(sky);

  const sun = new THREE.DirectionalLight(0xffffff, 1.4), hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b5a3a, 0.7);
  scene.add(sun, hemi, sun.target); scene.fog = new THREE.Fog(0xcfe6f5, 150, 1100);

  // ---- time of day: 0 = bright day, 0.5 = golden hour, 1 = dusk/evening
  const K = [
    { t: 0.0, top: 0x3f86d6, hor: 0xcfe6f5, sun: 0xfff4dd, si: 1.5, hi: 1.2, el: 0.9, az: 0.2, water: 0x2f7fa5, sc: 0x000000 },
    { t: 0.5, top: 0x3a5f9e, hor: 0xffb870, sun: 0xffa24a, si: 1.3, hi: 0.9, el: 0.28, az: 0.9, water: 0x3b6a86, sc: 0x663300 },
    { t: 1.0, top: 0x0b1440, hor: 0xd5587a, sun: 0xff6f6f, si: 0.25, hi: 0.55, el: 0.04, az: 1.2, water: 0x1a2f55, sc: 0x331122 },
  ];
  const A = new THREE.Color(), B = new THREE.Color();
  function setTime(t) {
    t = Math.min(1, Math.max(0, t)); const i = t < 0.5 ? 0 : 1, a = K[i], b = K[i + 1], k = (t - a.t) / 0.5;
    const mix = (ca, cb, out) => out.set(ca).lerp(B.set(cb), k);
    mix(a.top, b.top, skyMat.uniforms.top.value); mix(a.hor, b.hor, skyMat.uniforms.hor.value); mix(a.sun, b.sun, sun.color);
    skyMat.uniforms.sunCol.value.copy(sun.color).multiplyScalar(0.8); scene.fog.color.copy(skyMat.uniforms.hor.value);
    waterMat.color.set(a.water).lerp(B.set(b.water), k);
    const el = a.el + (b.el - a.el) * k, az = a.az + (b.az - a.az) * k;
    sun.position.set(Math.cos(az) * 600, Math.max(0.02, el) * 600, Math.sin(az) * 600); sun.target.position.set(0, 0, 0);
    skyMat.uniforms.sunDir.value.copy(sun.position);
    sun.intensity = a.si + (b.si - a.si) * k; hemi.intensity = a.hi + (b.hi - a.hi) * k;
    lights.material.opacity = smooth(0.5, 0.95, t); stars.material.opacity = smooth(0.7, 1, t) * 0.9;
    glass.opacity = smooth(0.55, 0.95, t) * 0.85; streetLight(t);
  }

  // ---- street (separate far-away group so the camera can "land" in it)
  const street = new THREE.Group(); street.position.copy(STREET_ORIGIN); scene.add(street);
  const lamps = [];
  function streetLight(t) { const k = smooth(0.4, 0.95, t); lamps.forEach(l => (l.intensity = 0.2 + k * 2.2)); }
  const shops = buildStreet(street, lamps);

  const clouds = [];
  for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false })); s.scale.set(60 + R() * 60, 8, 25 + R() * 20); s.position.set((R() - 0.5) * 900, 230 + R() * 60, (R() - 0.5) * 900); root.add(s); clouds.push(s); }

  return { root, street, shops, setTime, update(dt) { clouds.forEach((c, i) => { c.position.x += dt * (1.5 + i * 0.1); if (c.position.x > 500) c.position.x = -500; }); } };
}

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

function buildStreet(g, lamps) {
  const R = rng(21);
  const stone = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#9b8a72'; x.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { x.fillStyle = `hsl(35,${12 + R() * 10}%,${42 + R() * 22}%)`; x.fillRect(R() * w, R() * h, 22 + R() * 30, 14 + R() * 18); } });
  stone.wrapS = stone.wrapT = THREE.RepeatWrapping; stone.repeat.set(3, 40);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 130), new THREE.MeshLambertMaterial({ map: stone })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -62); g.add(floor);
  const plasters = [0xe9c9a0, 0xd9b98a, 0xf1e6cf, 0xc98f6b, 0xe3b6a0, 0xcfd9c4, 0x9fc3cf];
  const shops = [];
  for (const side of [-1, 1]) {
    let z = 8;
    while (z > -130) {
      const w = 6 + R() * 5, h = 7 + R() * 4; z -= w / 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, h, w), new THREE.MeshLambertMaterial({ color: plasters[(R() * plasters.length) | 0] })); m.position.set(side * 7.4, h / 2, z); g.add(m);
      // arched dark door/shutter + upper balcony
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, Math.min(3, w * 0.5)), new THREE.MeshLambertMaterial({ color: 0x3a2a1c })); door.position.set(side * 4.35, 1.5, z); g.add(door);
      const bal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, w * 0.7), new THREE.MeshLambertMaterial({ color: 0xb8864f })); bal.position.set(side * 4.0, 4.6, z); g.add(bal);
      const jh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.8, w * 0.5), new THREE.MeshBasicMaterial({ color: 0xffc46b })); jh.position.set(side * 4.3, 6.2, z); g.add(jh);
      z -= w / 2;
    }
  }
  // bunting
  const flagCols = [0xe63946, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x457b9d];
  for (let z = -6; z > -120; z -= 9) for (let i = 0; i < 14; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 3), new THREE.MeshBasicMaterial({ color: flagCols[i % 5] })); t.rotation.z = Math.PI; t.position.set(-3.8 + i * 0.58, 5.6 - Math.sin((i / 13) * Math.PI) * 0.5, z); g.add(t); }
  // temple at the lane end
  const tm = new THREE.MeshLambertMaterial({ color: 0xf3ead6 }); let y = 0;
  for (let i = 0; i < 6; i++) { const w = 20 - i * 3; const b = new THREE.Mesh(new THREE.BoxGeometry(w, 4, w * 0.8), tm); b.position.set(0, y + 2, -138); y += 4; g.add(b); }
  const sh = new THREE.Mesh(new THREE.ConeGeometry(3.4, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8d3a6 })); sh.position.set(0, y + 5, -138); g.add(sh);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), new THREE.MeshBasicMaterial({ color: 0xe76f51, side: THREE.DoubleSide })); flag.position.set(1, y + 11, -138); g.add(flag);
  // lamps
  for (let z = -10; z > -125; z -= 22) for (const s of [-1, 1]) { const l = new THREE.PointLight(0xffb454, 0.2, 26, 1.6); l.position.set(s * 3.8, 4.5, z); g.add(l); lamps.push(l); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); bulb.position.copy(l.position); g.add(bulb); }
  return shops;
}

export function makeSignSprite(text, sub) {
  const t = canvasTex(512, 160, (x, w, h) => { x.fillStyle = 'rgba(11,22,52,.88)'; x.roundRect(0, 0, w, h, 24); x.fill(); x.strokeStyle = '#c9a227'; x.lineWidth = 6; x.roundRect(6, 6, w - 12, h - 12, 20); x.stroke(); x.fillStyle = '#f6e9c8'; x.font = '600 46px Georgia, serif'; x.textAlign = 'center'; x.fillText(text, w / 2, 76); x.fillStyle = '#c9a227'; x.font = '28px Georgia, serif'; x.fillText(sub, w / 2, 122); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false })); s.scale.set(3.4, 1.06, 1); s.renderOrder = 10; return s;
}
