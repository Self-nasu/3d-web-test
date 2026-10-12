import { createExperience, routeFromPlaces } from './experience.js';
import { openViewer } from './viewer.js';
import { setSound, soundOn } from './audio.js';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const j = u => fetch(u).then(r => (r.ok ? r.json() : Promise.reject(u)));
const [places, artisans, products] = await Promise.all([j('data/places.json'), j('data/artisans.json'), j('data/products.json')]);
let credits = {}; try { credits = await j('assets/credits.json'); } catch {}
const inr = n => '₹' + n.toLocaleString('en-IN');
const byId = (arr, id) => arr.find(x => x.id === id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const photo = slot => credits[slot] && { url: credits[slot].file, cap: `Photo: ${credits[slot].author} · ${credits[slot].license} · Wikimedia Commons` };
const phStyle = slot => (photo(slot) ? `style="background-image:linear-gradient(#0003,#0006),url(${photo(slot).url})"` : '');
const credit = slot => (photo(slot) ? `<small>${esc(photo(slot).cap)}</small>` : '');
let toastT; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 4200); };

// ---------- passport (localStorage, counts only)
const PK = 'uvy-passport';
const pp = (() => { try { return JSON.parse(localStorage.getItem(PK)) || {}; } catch { return {}; } })();
Object.assign(pp, { places: pp.places || [], makers: pp.makers || [], visits: pp.visits || [], enq: pp.enq || [] });
const savePP = () => { try { localStorage.setItem(PK, JSON.stringify(pp)); } catch {} renderPassport(); };
const mark = (k, v) => { if (!pp[k].includes(v)) { pp[k].push(v); savePP(); } };
function renderPassport() {
  const val = pp.enq.reduce((a, e) => a + e.price, 0);
  $('#passportStats').innerHTML = [[pp.places.length, 'heritage stops explored'], [pp.makers.length, 'makers met'], [pp.visits.length, 'workshop visits requested'], [pp.enq.length, 'order enquiries sent'], [inr(val), 'total enquiry value (not a payment)']].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
}

// ---------- geo helpers
const hav = (a, b) => { const R = 6371, r = x => (x * Math.PI) / 180, dl = r(b.lat - a.lat), dn = r(b.lon - a.lon), h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const walkMin = km => Math.max(1, Math.round((km * 1000) / 80));

// ---------- parallax hero
$('#towers').innerHTML = [420, 520, 620, 720, 820, 920, 1000].map((x, i) => `<rect x="${x - 14}" y="${70 - (i % 3) * 14}" width="28" height="90"/><path d="M${x - 20} ${70 - (i % 3) * 14}q20-48 40 0z"/><rect x="${x - 2}" y="${32 - (i % 3) * 14}" width="4" height="16"/>`).join('');
const layers = $$('#hero [data-speed]'); let mx = 0;
const par = () => { const y = scrollY; layers.forEach(l => { const s = +l.dataset.speed; l.style.transform = `translate3d(${mx * s * -60}px,${y * s * 2.4}px,0)`; }); };
addEventListener('scroll', par, { passive: true }); addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; par(); });
// optional media layers: dropped into assets/ by the fetch tools, credited in credits.json
(async () => {
  const hv = credits['hero-video'];
  if (hv) { const v = $('.herovideo'); v.src = hv.file; v.hidden = false; v.play().catch(() => {}); $('#heroCredit').textContent = `Video: ${hv.author} · ${hv.license} · ${hv.source}`; $('#heroCredit').hidden = false; }
  else { const p = photo('hero-pichola'); if (p) { const i = $('.herophoto'); i.src = p.url; i.hidden = false; $('.palace').style.opacity = .35; $('#heroCredit').textContent = p.cap; $('#heroCredit').hidden = false; } }
})();
addEventListener('scroll', () => $('#nav').style.background = scrollY > 80 ? '#0b1a42ee' : '', { passive: true });

// ---------- heritage cards
const crowdDots = n => `<span class="crowd" title="Manually maintained indicator, not live data">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
const nowH = () => Math.min(19, Math.max(9, new Date().getHours()));
$('#placeCards').innerHTML = places.map(p => `<button class="card" data-place="${p.id}"><div class="ph" ${phStyle(p.image)}>${credit(p.image)}</div><div class="bd"><h3>${p.name}</h3><p>${esc(p.story.slice(0, 120))}…</p><p>⏱ ~${p.typicalVisitMin} min · crowd ${crowdDots(p.crowd[nowH()])}</p></div></button>`).join('');
$('#artisanCards').innerHTML = artisans.map(a => `<button class="card" data-artisan="${a.id}"><div class="ph" ${phStyle(a.image)}>${credit(a.image)}</div><div class="bd"><h3>${a.name.replace(' (sample)', '')}</h3><p>${a.craft}</p><span class="badge">Sample profile</span></div></button>`).join('');
const prodCard = p => `<button class="prod" data-product="${p.id}"><div class="sw" style="background:linear-gradient(135deg,${p.color},#0b1a42)">3D</div><b>${p.title}</b><span>${inr(p.price)} · ${byId(artisans, p.artisanId).craft}</span></button>`;
$('#productGrid').innerHTML = products.map(prodCard).join('');

// ---------- drawer & modal
const drawer = $('#drawer');
const closeDrawer = () => (drawer.hidden = true);
function openPlace(p) {
  mark('places', p.id);
  const near = artisans.map(a => ({ a, d: hav(p, a) })).filter(x => x.d < 1.2).sort((x, y) => x.d - y.d);
  drawer.innerHTML = `<div class="hd" ${phStyle(p.image)}><button class="x" aria-label="Close">✕</button>${credit(p.image)}</div><div class="bd"><h2>${p.name}</h2><p>${esc(p.story)}</p>
  <h4>Plan your visit</h4><ul><li>Typical visit: ~${p.typicalVisitMin} min</li><li>Hours: ${esc(p.hours)}</li><li>Crowd now ${crowdDots(p.crowd[nowH()])} <small>(manual indicator)</small></li></ul>
  <h4>Makers nearby</h4>${near.length ? `<ul>${near.map(x => `<li><a href="#" data-artisan="${x.a.id}">${x.a.name.replace(' (sample)', '')}</a> — ${x.a.craft} · ${walkMin(x.d)} min walk</li>`).join('')}</ul>` : '<p>None listed yet.</p>'}
  <div><button class="btn gold" data-fly="${p.id}">Fly here</button><button class="btn ghost dark" data-disc="${p.id}">Find quieter alternative</button></div></div>`;
  drawer.hidden = false;
}
function openArtisan(a) {
  mark('makers', a.id); const ps = products.filter(p => p.artisanId === a.id), vs = a.verified.status === 'verified';
  drawer.innerHTML = `<div class="hd" ${phStyle(a.image)}><button class="x" aria-label="Close">✕</button>${credit(a.image)}</div><div class="bd"><h2>${a.name.replace(' (sample)', '')}</h2><p><b>${a.craft}</b> · ${a.years} years</p>
  <p>${vs ? '<span class="badge ok">Verified</span>' : '<span class="badge">Sample profile — not a real listing</span>'}</p>
  <h4>Meet the maker</h4><p>${esc(a.story)}</p>${a.video ? `<video controls src="${a.video}" style="width:100%;border-radius:12px"></video>` : '<p class="fine">Maker video slot — add a short consented film at <code>assets/video/' + a.id + '.mp4</code>.</p>'}
  <h4>Provenance</h4><p><b>Verified:</b> ${esc(a.verified.evidence)}</p><p><b>Seller-provided claims</b> (not independently verified):</p><ul>${a.claims.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
  <h4>Products</h4><div class="mini">${ps.map(prodCard).join('')}</div>
  <h4>Visit</h4><p><button class="btn gold" data-visit="${a.id}" ${a.workshopVisit ? '' : 'disabled'}>${a.workshopVisit ? 'Request a workshop visit' : 'Workshop visits unavailable'}</button></p></div>`;
  drawer.hidden = false;
}
let viewer;
function openProduct(p) {
  const a = byId(artisans, p.artisanId), m = $('#modal');
  $('#modalBox').innerHTML = `<canvas></canvas><div class="bd"><h2>${p.title}</h2><p>by <a href="#" data-artisan="${a.id}">${a.name.replace(' (sample)', '')}</a> · ${a.craft}</p><div class="pr">${inr(p.price)}</div>
  <dl><dt>Materials</dt><dd>${esc(p.materials)}</dd><dt>Size</dt><dd>${esc(p.size)}</dd><dt>Made in</dt><dd>~${p.days} days</dd><dt>Preview</dt><dd>Illustrative 3D model — drag to rotate, scroll to zoom. Real listings use the maker's own 360° photos or scan.</dd></dl>
  <p><button class="btn gold" data-enq="${p.id}">Request to buy (WhatsApp)</button><button class="btn ghost dark" data-close>Close</button></p><p class="fine">Prototype: no payment is taken. The request opens WhatsApp so you can choose a contact; sample artisans have no real number.</p></div>`;
  m.hidden = false; viewer?.dispose(); viewer = openViewer($('canvas', m), p);
}
const closeModal = () => { $('#modal').hidden = true; viewer?.dispose(); viewer = null; };
document.addEventListener('click', e => {
  const t = e.target.closest('[data-place],[data-artisan],[data-product],[data-fly],[data-disc],[data-visit],[data-enq],[data-close],.x,[data-start]'); if (!t) { if (e.target === $('#modal')) closeModal(); return; }
  const d = t.dataset; if (t.tagName === 'A' && t.getAttribute('href') === '#') e.preventDefault();
  if (d.place) openPlace(byId(places, d.place)); else if (d.artisan) { closeModal(); openArtisan(byId(artisans, d.artisan)); }
  else if (d.product) openProduct(byId(products, d.product));
  else if (d.fly) { closeDrawer(); startExp('free').then(() => exp.goTo(byId(places, d.fly))); }
  else if (d.disc) { closeDrawer(); stopExp(); selectPlace(d.disc); $('#discover').scrollIntoView(); }
  else if (d.visit) { mark('visits', d.visit); toast('Visit request saved to your passport. (Demo — a live version would message the maker.)'); }
  else if (d.enq) { const p = byId(products, d.enq); pp.enq.push({ productId: p.id, price: p.price }); savePP(); open(`https://wa.me/?text=${encodeURIComponent(`Hello! I found "${p.title}" (${inr(p.price)}) on Udaipur Virtually Yours and would like to enquire.`)}`, '_blank', 'noopener'); }
  else if ('close' in d || t.classList.contains('x')) { t.closest('#modal') ? closeModal() : closeDrawer(); }
  else if (d.start) startExp(d.start);
});

// ---------- experience overlay
const expEl = $('#exp'); let exp;
let booting;
const getKey = () => { try { return localStorage.getItem('uvy-gkey') || ''; } catch { return ''; } };
const gKey = () => getKey() || window.UVY_CONFIG?.googleKey || '';
async function bootEngine() {
  const deps = { places, artisans, toast, photo, onPlace: openPlace, onArtisan: openArtisan };
  if (gKey()) {
    try { return await (await import('./cesium-engine.js')).createCesiumExperience(expEl, deps, gKey()); }
    catch (err) { console.warn(err); toast('Google 3D Tiles unavailable (' + err.message + ') — using open-data terrain instead.'); }
  }
  return createExperience(expEl, deps);
}
async function startExp(mode) {
  expEl.hidden = false; document.body.style.overflow = 'hidden';
  if (!exp) { toast(gKey() ? 'Loading Google Photorealistic 3D Tiles…' : 'Loading real Udaipur terrain…'); exp = await (booting ||= bootEngine()); }
  exp.start(mode); if (mode === 'free') exp.st.tod = 0.3; $('#expAttr').innerHTML = exp.attribution.join(' · ');
  $('#engine').textContent = exp.google ? '🌍 Google 3D' : '🗺 Open-data terrain'; $('#pause').style.display = mode === 'cinematic' ? '' : 'none'; setSound(true); $('#snd').textContent = '🔊';
}
$('#engine').onclick = () => {
  const cur = getKey(), k = prompt('Google Photorealistic 3D Tiles need your own Google Maps Platform API key (Map Tiles API enabled, billing on). The key stays in this browser only.\n\nPaste key — or leave empty to switch back to open-data terrain:', cur);
  if (k === null) return; try { k.trim() ? localStorage.setItem('uvy-gkey', k.trim()) : localStorage.removeItem('uvy-gkey'); } catch {}
  stopExp(); exp?.dispose?.(); exp = null; booting = null; startExp('cinematic');
};
function stopExp() { if (!exp) return; exp.stop(); expEl.hidden = true; document.body.style.overflow = ''; closeDrawer(); setSound(false); $('#snd').textContent = '🔇'; }
$('#expClose').onclick = stopExp;
addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (!drawer.hidden) closeDrawer(); else stopExp(); } });
$('#snd').onclick = () => { setSound(!soundOn()); $('#snd').textContent = soundOn() ? '🔊' : '🔇'; };
$('#pause').onclick = () => ($('#pause').textContent = exp.togglePause() ? '⏸' : '▶');
$$('.modes button').forEach(b => b.addEventListener('click', () => { exp.setMode(b.dataset.mode); $('#pause').style.display = b.dataset.mode === 'cinematic' ? '' : 'none'; }));

// ---------- discover map + dispersal
const svg = $('#map'), LAT = [24.565, 24.603], LON = [73.671, 73.698], proj = o => [((o.lon - LON[0]) / (LON[1] - LON[0])) * 560 + 20, (1 - (o.lat - LAT[0]) / (LAT[1] - LAT[0])) * 480 + 20];
let selPlace = places[0].id, hour = nowH();
function drawMap() {
  const l1 = proj({ lat: 24.5715, lon: 73.6785 }), l2 = proj({ lat: 24.5965, lon: 73.6785 });
  svg.innerHTML = `<rect width="600" height="520" fill="#e9f1e1"/><ellipse cx="${l1[0]}" cy="${l1[1]}" rx="105" ry="85" fill="#9cc7de"/><ellipse cx="${l2[0]}" cy="${l2[1]}" rx="85" ry="55" fill="#9cc7de"/>
  ${artisans.map(a => { const [x, y] = proj(a); return `<g class="art" data-artisan="${a.id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="6"/><title>${a.name} · ${a.craft}</title></g>`; }).join('')}
  ${places.map(p => { const [x, y] = proj(p); return `<g class="pin ${p.id === selPlace ? 'sel' : ''}" data-sel="${p.id}"><circle cx="${x}" cy="${y}" r="10"/><text x="${x + 14}" y="${y + 4}">${p.name}</text></g>`; }).join('')}
  <g font="12px system-ui" fill="#274"><text x="30" y="500">● landmark  ● sample maker</text></g>`;
}
function dispersal(p) {
  const c = p.crowd[hour]; const out = { crowd: c };
  if (c >= 2) {
    out.alt = places.filter(q => q.id !== p.id && q.crowd[hour] < c).map(q => { const km = hav(p, q), tags = q.tags.filter(t => p.tags.includes(t)), mk = artisans.filter(a => hav(q, a) < 1.2).length; return { q, km, tags, mk, score: tags.length * 2 + (km < 1.5 ? 1.5 : 0) + mk * 0.5 - q.crowd[hour] }; }).sort((a, b) => b.score - a.score)[0];
  }
  return out;
}
function selectPlace(id) {
  selPlace = id; drawMap(); const p = byId(places, id), d = dispersal(p), near = artisans.map(a => ({ a, d: hav(p, a) })).filter(x => x.d < 1.2).sort((x, y) => x.d - y.d);
  $('#discPanel').innerHTML = `<h3 style="margin:0;font-family:Georgia">${p.name}</h3><p class="fine">~${p.typicalVisitMin} min · ${esc(p.hours)}</p>
  <label>Visit hour: <b>${hour}:00</b><input type="range" id="hr" min="9" max="19" value="${hour}"></label>
  <div class="bars">${p.crowd.slice(9, 20).map((c, i) => `<i class="${i + 9 === hour ? 'now' : ''}" style="height:${12 + c * 14}px;background:${c >= 3 ? '#d5587a' : c === 2 ? '#e9a68a' : '#cfd9c0'}"></i>`).join('')}</div>
  <p class="fine">Crowd indicators are manually maintained from typical patterns — not live data.</p>
  ${d.alt ? `<div class="alt-box"><b>Busy at ${hour}:00.</b> Try <b>${d.alt.q.name}</b> instead — ${walkMin(d.alt.km)} min walk.<ul><li>Shares themes: ${d.alt.tags.join(', ') || 'none'}</li><li>Crowd level ${d.alt.q.crowd[hour]} vs ${d.crowd} here (manual indicator)</li><li>Distance ${d.alt.km.toFixed(1)} km</li><li>${d.alt.mk} local maker${d.alt.mk === 1 ? '' : 's'} within a 15-min walk</li></ul><p><button class="btn gold" data-place="${d.alt.q.id}" style="padding:8px 16px;font-size:13px">See ${d.alt.q.name}</button></p></div>` : `<div class="alt-box"><b>Comfortable at ${hour}:00.</b> No busier-than-usual signal for this stop.</div>`}
  <h4 style="margin:14px 0 4px">Makers within a 15-min walk</h4>${near.length ? `<ul style="margin:0;padding-left:18px;font-size:14px">${near.map(x => `<li><a href="#" data-artisan="${x.a.id}">${x.a.name.replace(' (sample)', '')}</a> — ${x.a.craft} (${walkMin(x.d)} min)</li>`).join('')}</ul>` : '<p class="fine">None yet.</p>'}
  <p><button class="btn ghost dark" data-place="${p.id}" style="padding:8px 16px;font-size:13px">Read the story</button></p>`;
  $('#hr').oninput = e => { hour = +e.target.value; selectPlace(selPlace); };
}
svg.addEventListener('click', e => { const g = e.target.closest('[data-sel]'); if (g) selectPlace(g.dataset.sel); });
selectPlace(selPlace);

// ---------- My Udaipur: share link, postcard, quiz
const chosen = new Set(), P = $('#myPlaces');
P.innerHTML = places.map(p => `<label class="chip" data-p="${p.id}"><input type="checkbox" value="${p.id}">${p.name}</label>`).join('');
const styleVal = () => $('input[name=style]:checked').value;
function myStats() {
  const ps = [...chosen].map(id => byId(places, id)); let km = 0; for (let i = 1; i < ps.length; i++) km += hav(ps[i - 1], ps[i]);
  $('#myStats').textContent = ps.length ? `${ps.length} stop${ps.length > 1 ? 's' : ''} · ${km.toFixed(1)} km on foot (~${walkMin(km)} min) · ~${ps.reduce((a, p) => a + p.typicalVisitMin, 0)} min visiting` : 'Pick up to three places.';
}
function drawPostcard() {
  const c = $('#postcard'), x = c.getContext('2d'), W = c.width, H = c.height, sunset = styleVal() === 'sunset', ps = [...chosen].map(id => byId(places, id));
  const g = x.createLinearGradient(0, 0, 0, H); (sunset ? ['#0b1a42', '#8a3f7a', '#ffb870'] : ['#3f86d6', '#9ccbee', '#fdf2d8']).forEach((s, i) => g.addColorStop(i / 2, s)); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = sunset ? '#ffd98a' : '#fff6cf'; x.beginPath(); x.arc(W * 0.74, H * 0.42, 42, 0, 7); x.fill();
  x.fillStyle = sunset ? '#2a2f6b' : '#6e8fb0'; x.beginPath(); x.moveTo(0, H * 0.62); for (let i = 0; i <= 12; i++) x.lineTo((i * W) / 12, H * 0.54 + Math.sin(i * 1.7) * 26); x.lineTo(W, H); x.lineTo(0, H); x.fill();
  x.fillStyle = sunset ? '#0b1233' : '#3b4c6b'; x.fillRect(90, H * 0.58, 360, 64); for (let i = 0; i < 6; i++) { const px = 110 + i * 62; x.fillRect(px, H * 0.52, 22, 40); x.beginPath(); x.arc(px + 11, H * 0.52, 14, Math.PI, 0); x.fill(); }
  const lk = x.createLinearGradient(0, H * 0.7, 0, H); lk.addColorStop(0, sunset ? '#d98a8a' : '#7fb7d6'); lk.addColorStop(1, sunset ? '#0b1a42' : '#2f6f8f'); x.fillStyle = lk; x.fillRect(0, H * 0.7, W, H * 0.3);
  x.strokeStyle = '#c9a227'; x.lineWidth = 6; x.strokeRect(14, 14, W - 28, H - 28);
  x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = '600 44px Georgia'; x.fillText('UDAIPUR', W / 2, 90); x.font = 'italic 18px Georgia'; x.fillStyle = '#ffe3a0'; x.fillText('the city of lakes', W / 2, 118);
  x.fillStyle = '#fff'; x.font = '24px Georgia'; x.fillText(`Greetings from ${$('#myName').value || 'a traveller'}`, W / 2, 180);
  x.font = '600 20px Georgia'; ps.forEach((p, i) => x.fillText(`${i + 1}. ${p.name}`, W / 2, H * 0.78 + i * 30));
  x.font = '12px system-ui'; x.fillStyle = '#fffc'; x.fillText('Illustration drawn procedurally · explore it yourself → Udaipur Virtually Yours', W / 2, H - 28);
}
const link = () => `${location.origin}${location.pathname}#/my?n=${encodeURIComponent($('#myName').value)}&s=${[...chosen].join(',')}&st=${styleVal()}`;
function refreshMy() { $$('#myPlaces .chip').forEach(c => c.classList.toggle('sel', chosen.has(c.dataset.p))); myStats(); drawPostcard(); }
P.addEventListener('change', e => { const id = e.target.value; if (e.target.checked) { if (chosen.size >= 3) { e.target.checked = false; toast('Choose up to three places.'); return; } chosen.add(id); } else chosen.delete(id); refreshMy(); });
$('#myName').addEventListener('input', drawPostcard); $$('input[name=style]').forEach(r => r.addEventListener('change', drawPostcard));
$('#myFly').onclick = async () => { const ps = [...chosen].map(id => byId(places, id)); if (!ps.length) return toast('Pick at least one place first.'); await startExp('cinematic'); exp.flyThrough(routeFromPlaces(ps, exp.real), (exp.real ? 30 : 18) + ps.length * 14, styleVal()); $('#pause').style.display = ''; };
$('#myLink').onclick = async () => { const u = link(); try { if (navigator.share) await navigator.share({ title: 'My Udaipur', url: u }); else { await navigator.clipboard.writeText(u); toast('Link copied — your friend opens the same flyover.'); } } catch { prompt('Copy your link', u); } };
$('#myCard').onclick = () => { drawPostcard(); $('#postcard').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'my-udaipur-postcard.png'; a.click(); }); };
const Q = [['Your perfect morning?', ['Palace balcony tour', 'Sunrise by the water', 'Wandering lanes', 'Watching a painter work']], ['Pick a souvenir', ['A royal portrait', 'A lake-view photo', 'A hidden-door selfie', 'Something hand-made']], ['Your travel pace?', ['Grand & guided', 'Slow & scenic', 'Curious & lost', 'Chatty & hands-on']]];
const TYPES = [['Royal architecture', ['citypalace', 'jagmandir', 'bagore']], ['Lakeside explorer', ['saheliyon', 'jagmandir', 'bagore']], ['Hidden courtyards', ['jagdish', 'bagore', 'citypalace']], ['Artisan discovery', ['jagdish', 'bagore', 'citypalace']]];
(function quiz() { const ans = []; const el = $('#quiz'); const step = () => { const i = ans.length; if (i < Q.length) { el.innerHTML = `<div class="q"><b>${Q[i][0]}</b><br>${Q[i][1].map((o, k) => `<button data-k="${k}">${o}</button>`).join('')}</div>`; } else { const tally = [0, 0, 0, 0]; ans.forEach(k => tally[k]++); const k = tally.indexOf(Math.max(...tally)), [name, ids] = TYPES[k]; chosen.clear(); ids.forEach(id => chosen.add(id)); $$('#myPlaces input').forEach(c => (c.checked = chosen.has(c.value))); refreshMy(); el.innerHTML = `<p><b>You are: ${name}.</b> We picked a three-stop route for you above — play the flyover or share it.</p><button id="qr">Retake</button>`; $('#qr').onclick = () => { ans.length = 0; step(); }; } }; el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { ans.push(+b.dataset.k); step(); } }); step(); })();

// ---------- credits list
const items = Object.values(credits).map(c => `<li>${c.file.match(/\.(jpg|png|webp)$/) ? `<img src="${c.file}" alt="" loading="lazy">` : '🎞'}<span><b>${esc(c.caption || c.title)}</b> — “${esc((c.title || '').replace(/^File:/, ''))}” by ${esc(c.author)} · <a href="${c.license_url || c.source}" target="_blank" rel="noopener">${esc(c.license)}</a> · <a href="${c.source}" target="_blank" rel="noopener">source</a></span></li>`);
items.push('<li>🏔<span><b>Real terrain</b> — elevation: Mapzen / AWS Open Data Terrain Tiles (SRTM, ASTER GDEM, GMTED). Imagery: Sentinel-2 cloudless by <a href="https://s2maps.eu" target="_blank" rel="noopener">EOX IT Services GmbH</a> (CC BY-NC 4.0; contains modified Copernicus Sentinel data 2021).</span></li>', '<li>🌍<span><b>Google Photorealistic 3D Tiles</b> (optional, user-supplied API key) — © Google; attribution shown in the viewer, tiles are streamed and never cached or extracted.</span></li>', '<li>🧊<span><b>3D scenes, audio &amp; product models</b> — procedurally generated for this project (original work).</span></li>', '<li>⚙<span><b>Three.js</b> — © three.js authors, MIT licence.</span></li>');
$('#creditList').innerHTML = items.join('');

// ---------- boot + share-link router
renderPassport(); drawPostcard(); myStats();
function route() {
  const m = location.hash.match(/^#\/my\?(.*)$/); if (!m) return; const q = new URLSearchParams(m[1]);
  $('#myName').value = q.get('n') || ''; chosen.clear(); (q.get('s') || '').split(',').filter(id => byId(places, id)).slice(0, 3).forEach(id => chosen.add(id));
  $$('#myPlaces input').forEach(c => (c.checked = chosen.has(c.value))); const r = $(`input[name=style][value=${q.get('st') === 'sunset' ? 'sunset' : 'day'}]`); r.checked = true; refreshMy();
  setTimeout(() => { $('#my').scrollIntoView(); toast(`${q.get('n') || 'A friend'} shared their Udaipur — press ▶ Play my flyover.`); }, 300);
}
route(); addEventListener('hashchange', route);
window.__uvy = { get exp() { return exp; }, startExp };
