// Procedural ambient soundtrack (WebAudio): slow drone pad + sparse Bhairav-scale plucks. No audio files, no licences.
let ctx, master, timer, on = false;
const SCALE = [0, 1, 4, 5, 7, 8, 11, 12, 13, 16]; // Bhairav-like, semitones from the root
export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(master);
  const rev = ctx.createDelay(1.0); rev.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.45; rev.connect(fb); fb.connect(rev); rev.connect(master);
  for (const [f, d] of [[65.41, 0], [98.0, 4], [130.81, -3], [196.0, 5]]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; const g = ctx.createGain(); g.gain.value = 0.045; o.connect(g); g.connect(lp); o.start();
  }
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 350; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  const pluck = () => {
    if (!on) return; const t = ctx.currentTime, n = SCALE[(Math.random() * SCALE.length) | 0], f = 261.63 * Math.pow(2, n / 12);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(g); g.connect(lp); g.connect(rev); o.start(t); o.stop(t + 2.6);
    timer = setTimeout(pluck, 1400 + Math.random() * 3200);
  };
  ctx._pluck = pluck;
}
export function setSound(v) {
  initAudio(); on = v; if (ctx.state === 'suspended') ctx.resume();
  master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(v ? 0.7 : 0, ctx.currentTime + 1.5);
  clearTimeout(timer); if (v) ctx._pluck();
}
export const soundOn = () => on;
