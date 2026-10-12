// Product 3D viewer: drag to rotate, wheel/pinch to zoom, auto-turntable. Models are procedural stand-ins
// ("illustrative preview") until artisans supply photographed 360° sets or scanned GLB files.
import * as THREE from '../vendor/three.module.js';

function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function paintingTex(col) {
  return tex(512, 640, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f6d58e'); g.addColorStop(0.55, col); g.addColorStop(1, '#1b2a49'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff3d0'; x.beginPath(); x.arc(w * 0.72, h * 0.2, 46, 0, 7); x.fill();
    x.fillStyle = '#f1e2c0'; x.fillRect(80, 300, 352, 220); x.beginPath(); x.moveTo(80, 300); x.quadraticCurveTo(256, 150, 432, 300); x.fill();
    x.fillStyle = '#7a3b1e'; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(120 + i * 80, 520); x.lineTo(120 + i * 80, 400); x.quadraticCurveTo(150 + i * 80, 350, 180 + i * 80, 400); x.lineTo(180 + i * 80, 520); x.fill(); }
    x.fillStyle = '#2a7f62'; x.beginPath(); x.ellipse(256, 570, 200, 38, 0, 0, 7); x.fill();
    for (let i = 0; i < 7; i++) { x.fillStyle = '#f48fb1'; x.beginPath(); x.arc(110 + i * 48, 570 + Math.sin(i) * 8, 13, 0, 7); x.fill(); }
    x.strokeStyle = '#c9a227'; x.lineWidth = 14; x.strokeRect(7, 7, w - 14, h - 14); x.strokeStyle = '#8c1c13'; x.lineWidth = 8; x.strokeRect(26, 26, w - 52, h - 52);
  });
}
function inlayTex() {
  return tex(512, 512, (x, w, h) => {
    x.fillStyle = '#f5f1e7'; x.fillRect(0, 0, w, h); x.translate(w / 2, h / 2);
    for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.fillStyle = i % 2 ? '#c0392b' : '#1f4e9c'; x.beginPath(); x.ellipse(0, -140, 28, 70, 0, 0, 7); x.fill(); x.fillStyle = '#2e8b57'; x.beginPath(); x.ellipse(0, -215, 12, 22, 0, 0, 7); x.fill(); }
    x.fillStyle = '#c9a227'; x.beginPath(); x.arc(0, 0, 40, 0, 7); x.fill(); x.strokeStyle = '#1f4e9c'; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 238, 0, 7); x.stroke();
  });
}
function blockTex(col) {
  return tex(512, 512, (x, w, h) => {
    x.fillStyle = '#f3ead6'; x.fillRect(0, 0, w, h); x.fillStyle = col;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { x.save(); x.translate(32 + c * 64 + (r % 2) * 32, 32 + r * 64); for (let k = 0; k < 6; k++) { x.rotate(Math.PI / 3); x.beginPath(); x.ellipse(0, -14, 5, 12, 0, 0, 7); x.fill(); } x.restore(); }
    x.fillRect(0, 0, w, 22); x.fillRect(0, h - 22, w, 22);
  });
}

const M = {
  painting(p) { const g = new THREE.Group(); const f = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 0.09), new THREE.MeshStandardMaterial({ color: 0x6b3b1a, roughness: 0.5 })); g.add(f);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.76), new THREE.MeshStandardMaterial({ map: paintingTex(p.color), roughness: 0.7 })); face.position.z = 0.048; g.add(face);
    const back = face.clone(); back.material = new THREE.MeshStandardMaterial({ color: 0xcdb98f }); back.rotation.y = Math.PI; back.position.z = -0.048; g.add(back); return g; },
  plate(p) { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ map: inlayTex(), roughness: 0.25, metalness: 0.05 }); const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.9, 0.12, 64), [new THREE.MeshStandardMaterial({ color: 0xf1ece1, roughness: 0.3 }), m, new THREE.MeshStandardMaterial({ color: 0xf1ece1 })]); g.add(top); g.rotation.x = 0.5; return g; },
  coaster(p) { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.07, 48), [new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: inlayTex(), roughness: 0.25 }), new THREE.MeshStandardMaterial({ color: 0xece6d6 })]); c.position.y = i * 0.09 - 0.14; c.rotation.y = i * 0.7; g.add(c); } g.rotation.x = 0.35; return g; },
  cloth(p) { const geo = new THREE.PlaneGeometry(1.2, 2.2, 40, 60), t = blockTex(p.color); const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 })); const base = geo.attributes.position.array.slice();
    mesh.userData.tick = (time) => { const a = geo.attributes.position; for (let i = 0; i < a.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; a.setZ(i, Math.sin(y * 2.2 + time * 1.4) * 0.12 + Math.sin(x * 4 + time) * 0.04); } a.needsUpdate = true; geo.computeVertexNormals(); }; return mesh; },
  bookmark(p) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.9, 0.03), new THREE.MeshStandardMaterial({ map: paintingTex(p.color), roughness: 0.6 })); g.add(b); const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 })); tas.position.y = -1.1; g.add(tas); return g; },
  elephant(p) { const mat = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: 0.22 }), g = new THREE.Group(); const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
    add(new THREE.SphereGeometry(0.7, 32, 24), 0, 0.2, 0, 1.35, 0.95, 0.9); add(new THREE.SphereGeometry(0.46, 32, 24), 0.95, 0.5, 0); const trunk = new THREE.TorusGeometry(0.34, 0.12, 12, 24, Math.PI * 1.1); add(trunk, 1.35, 0.15, 0).rotation.z = -1.2;
    for (const [x, z] of [[-0.6, -0.4], [-0.6, 0.4], [0.5, -0.4], [0.5, 0.4]]) add(new THREE.CylinderGeometry(0.17, 0.2, 0.7, 14), x, -0.55, z);
    for (const z of [-0.45, 0.45]) add(new THREE.SphereGeometry(0.33, 20, 16), 0.88, 0.5, z, 0.25, 1, 1); const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.95), new THREE.MeshStandardMaterial({ color: 0x8c1c13, roughness: 0.6 })); blanket.position.set(0, 0.88, 0); g.add(blanket);
    add(new THREE.SphereGeometry(0.1, 12, 10), 1.15, 0.75, 0.0, 1, 1, 1); g.position.y = 0.2; return g; },
  earrings(p) { const mat = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: 0.25 }), lac = new THREE.MeshStandardMaterial({ color: 0xb7410e, roughness: 0.35 }), g = new THREE.Group();
    for (const x of [-0.6, 0.6]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 12, 40), mat); r.position.set(x, 0.6, 0); g.add(r); const d = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), lac); d.scale.y = 1.4; d.position.set(x, -0.1, 0); g.add(d); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), mat); cap.position.set(x, 0.2, 0); g.add(cap); } return g; },
};

export function openViewer(canvas, product) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, 0.1, 50); let dist = 5.2;
  const envScene = new THREE.Scene(); envScene.background = new THREE.Color(0x335577);
  for (const [x, y, z, c] of [[5, 5, 5, 0xfff1d0], [-5, 2, -4, 0x88aaff], [0, -5, 3, 0x886644], [-4, 4, 4, 0xffffff]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshBasicMaterial({ color: c })); l.position.set(x * 2, y * 2, z * 2); envScene.add(l); }
  scene.environment = new THREE.PMREMGenerator(r).fromScene(envScene, 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 5); scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));
  const model = (M[product.model] || M.painting)(product), pivot = new THREE.Group(); pivot.add(model); scene.add(pivot);
  let rotY = 0.4, rotX = 0, vel = 0.4, drag = false, lx = 0, ly = 0, raf, t0 = performance.now(), auto = true;
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const down = e => { drag = true; auto = false; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
  const move = e => { if (!drag) return; rotY += (e.clientX - lx) * 0.01; rotX = Math.max(-1, Math.min(1, rotX + (e.clientY - ly) * 0.008)); lx = e.clientX; ly = e.clientY; };
  const up = () => { drag = false; };
  const wheel = e => { e.preventDefault(); dist = Math.max(2.4, Math.min(8, dist + e.deltaY * 0.004)); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('wheel', wheel, { passive: false });
  addEventListener('resize', resize); resize();
  (function loop() {
    raf = requestAnimationFrame(loop); const t = (performance.now() - t0) / 1000; if (auto) rotY += 0.008;
    pivot.rotation.set(rotX, rotY, 0); cam.position.set(0, 0.2, dist); cam.lookAt(0, 0, 0); model.userData.tick?.(t); r.render(scene, cam);
  })();
  return { setAuto(v) { auto = v; }, dispose() { cancelAnimationFrame(raf); removeEventListener('resize', resize); r.dispose(); } };
}
