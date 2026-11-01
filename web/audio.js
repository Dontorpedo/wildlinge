'use strict';
/* Sound: WebAudio synthesis without assets. Voices are derived from the spoken words, ambient music per scenario. */
const SND = { ctx: null, master: null, on: true, vol: 0.5, voices: 0, last: 0, nextAmb: 0, mode: '', night: 0, cool: {} };
try { const s = JSON.parse(localStorage.getItem('plimploms-sound') || 'null'); if (s) { SND.on = !!s.on; SND.vol = Math.min(1, Math.max(0, +s.vol || 0)); } } catch (e) { /* storage blocked */ }

const SND_VOW = [[800, 1150], [400, 2000], [300, 2300], [500, 800], [330, 900], [650, 1080], [450, 1400]];
const SND_PENT = [0, 2, 4, 7, 9];

function sndHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function sndSave() { try { localStorage.setItem('plimploms-sound', JSON.stringify({ on: SND.on, vol: SND.vol })); } catch (e) { /* storage blocked */ } }

function sndInit() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume().catch(() => {}); return SND.ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    const c = new AC();
    const m = c.createGain(); m.gain.value = SND.on ? SND.vol : 0;
    const comp = c.createDynamicsCompressor();
    m.connect(comp); comp.connect(c.destination);
    SND.ctx = c; SND.master = m;
    SND.rev = c.createGain(); SND.rev.gain.value = 0.25;
    const dl = c.createDelay(1); dl.delayTime.value = 0.23;
    const fb = c.createGain(); fb.gain.value = 0.35;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    SND.rev.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(m);
  } catch (e) { SND.ctx = null; }
  return SND.ctx;
}

function sndApply() {
  if (SND.master) SND.master.gain.setTargetAtTime(SND.on ? SND.vol : 0, SND.ctx.currentTime, 0.05);
  if (SND.on) sndInit();
}

function sndOut(pan) {
  const c = SND.ctx;
  const g = c.createGain();
  let end = g;
  if (c.createStereoPanner && pan) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); end = p; }
  end.connect(SND.master);
  end.connect(SND.rev);
  return g;
}

/* one voiced syllable: sawtooth source through two formant filters */
function sndSyl(t, o) {
  const c = SND.ctx;
  const osc = c.createOscillator(); osc.type = o.type || 'sawtooth';
  osc.frequency.setValueAtTime(o.f0, t);
  osc.frequency.linearRampToValueAtTime(o.f1, t + o.dur);
  const out = sndOut(o.pan);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  const amp = o.amp * (SND.gm == null ? 1 : SND.gm);
  env.gain.linearRampToValueAtTime(amp, t + Math.min(0.05, o.dur * 0.35));
  env.gain.setTargetAtTime(0.0001, t + o.dur * 0.6, o.dur * 0.2);
  if (o.dur > 0.12) {
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.2; lg.gain.value = o.f0 * 0.012;
    lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + o.dur + 0.15);
  }
  const a = c.createBiquadFilter(); a.type = 'bandpass'; a.frequency.value = o.f[0]; a.Q.value = 3.5;
  const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = o.f[1]; b.Q.value = 4.5;
  osc.connect(a); osc.connect(b);
  const ga = c.createGain(); ga.gain.value = 1; const gb = c.createGain(); gb.gain.value = 0.6;
  a.connect(ga); b.connect(gb); ga.connect(env); gb.connect(env); env.connect(out);
  osc.start(t); osc.stop(t + o.dur + 0.15);
  osc.onended = () => { try { out.disconnect(); } catch (e) { /* gone */ } };
}

/* pitch and timbre of a creature voice: from a stable key (word, name) */
function sndVoice(key) {
  const h = sndHash(key);
  const k = SND_PENT[h % 5] + 12 * ((h >> 8) % 3);
  return { base: 196 * Math.pow(2, k / 12), type: (h >> 10) & 1 ? 'triangle' : 'sine', rate: 0.11 + ((h >> 12) % 6) * 0.014 };
}

function sndSay(text, pan, mood) {
  if (!SND.on || !SND.ctx || SND.ctx.state !== 'running' || SND.voices > 5) return;
  const now = SND.ctx.currentTime;
  if (now - SND.last < 0.05) return;
  SND.last = now;
  const toks = String(text).split(/\s+/).filter(Boolean).slice(0, 3);
  let t = now + 0.01, n = 0;
  for (const w of toks) {
    const h = sndHash(w), v = sndVoice(w);
    const syl = 1 + (h % 3);
    for (let i = 0; i < syl; i++) {
      const hh = (h >> (i * 4 + 3)) & 15;
      const f = SND_VOW[hh % SND_VOW.length];
      const dur = v.rate + (hh % 3) * 0.02;
      const up = mood < 0 ? 0.78 : mood > 0 ? 1.18 : 1 + ((hh & 1) ? 0.1 : -0.08);
      const f0 = v.base * Math.pow(2, SND_PENT[hh % 5] / 12 / 2);
      sndSyl(t, { f0, f1: f0 * (1 + (up - 1) * 0.5), dur, amp: 0.17, f, pan, type: v.type === 'sine' ? 'triangle' : v.type });
      t += dur + 0.025; n++;
    }
    t += 0.07;
  }
  SND.voices++;
  setTimeout(() => { SND.voices = Math.max(0, SND.voices - 1); }, Math.max(150, (t - now) * 1000));
}

/* non-verbal sounds: joy, fear, hurt, pop, sigh */
function sndFx(kind, pan) {
  if (!SND.on || !SND.ctx || SND.ctx.state !== 'running') return;
  const c = SND.ctx, now = c.currentTime;
  const cd = kind === 'ach' || kind === 'hm' || kind === 'oh' || kind === 'seufz' ? 0.5 : kind === 'hit' ? 0.12 : kind === 'death' || kind === 'love' || kind === 'born' ? 0.35 : 0.25;
  if (SND.cool[kind] && now - SND.cool[kind] < cd) return;
  SND.cool[kind] = now;
  const p = pan || 0;
  switch (kind) {
    case 'joy': for (let i = 0; i < 3; i++) sndSyl(now + i * 0.09, { f0: 600 + i * 140, f1: 900 + i * 160, dur: 0.1, amp: 0.1, f: [900, 2400], pan: p, type: 'triangle' }); break;
    case 'fear': sndSyl(now, { f0: 1500, f1: 700, dur: 0.22, amp: 0.1, f: [1100, 2600], pan: p, type: 'triangle' }); sndSyl(now + 0.12, { f0: 1700, f1: 800, dur: 0.18, amp: 0.08, f: [1100, 2600], pan: p, type: 'triangle' }); break;
    case 'ouch': sndSyl(now, { f0: 520, f1: 240, dur: 0.18, amp: 0.14, f: [700, 1200], pan: p, type: 'triangle' }); break;
    case 'sigh': sndSyl(now, { f0: 360, f1: 220, dur: 0.55, amp: 0.07, f: [500, 900], pan: p, type: 'triangle' }); break;
    case 'gut': sndSyl(now, { f0: 130, f1: 90, dur: 0.3, amp: 0.12, f: [300, 500], pan: p, type: 'triangle' }); break;
    case 'need': sndSyl(now, { f0: 440, f1: 330, dur: 0.14, amp: 0.09, f: [800, 1500], pan: p, type: 'triangle' }); sndSyl(now + 0.17, { f0: 440, f1: 300, dur: 0.16, amp: 0.09, f: [800, 1500], pan: p, type: 'triangle' }); break;
    case 'chime': { const f = 523.25 * Math.pow(2, SND_PENT[(Math.random() * 5) | 0] / 12 + (Math.random() < 0.4 ? 1 : 0)); sndNote(now, f, 1.8, 0.08, 'sine'); break; }
    case 'love': [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => sndNote(now + i * 0.13, f, 1.1, 0.07, 'triangle')); sndSyl(now, { f0: 520, f1: 760, dur: 0.18, amp: 0.07, f: [900, 2200], pan: p, type: 'triangle' }); break;
    case 'nuzzle': sndSyl(now, { f0: 340, f1: 420, dur: 0.22, amp: 0.07, f: [500, 1100], pan: p, type: 'triangle' }); sndSyl(now + 0.2, { f0: 400, f1: 470, dur: 0.2, amp: 0.06, f: [500, 1100], pan: p, type: 'triangle' }); break;
    case 'born': [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => sndNote(now + i * 0.07, f, 0.9, 0.06, 'sine')); break;
    case 'hit': sndSyl(now, { f0: 220, f1: 90, dur: 0.12, amp: 0.15, f: [300, 900], pan: p, type: 'triangle' }); break;
    case 'death': [440, 392, 329.63, 261.63].forEach((f, i) => sndNote(now + i * 0.28, f, 1.6, 0.06, 'sine')); sndSyl(now, { f0: 330, f1: 200, dur: 0.5, amp: 0.05, f: [450, 800], pan: p, type: 'triangle' }); break;
    case 'ach': sndSyl(now, { f0: 420, f1: 300, dur: 0.22, amp: 0.1, f: [750, 1150], pan: p, type: 'triangle' }); sndSyl(now + 0.2, { f0: 300, f1: 240, dur: 0.18, amp: 0.05, f: [1500, 2400], pan: p, type: 'triangle' }); break;
    case 'hm': sndSyl(now, { f0: 250, f1: 290, dur: 0.28, amp: 0.1, f: [280, 1000], pan: p, type: 'triangle' }); sndSyl(now + 0.3, { f0: 290, f1: 235, dur: 0.3, amp: 0.1, f: [280, 1000], pan: p, type: 'triangle' }); break;
    case 'oh': sndSyl(now, { f0: 380, f1: 520, dur: 0.12, amp: 0.1, f: [450, 800], pan: p, type: 'triangle' }); sndSyl(now + 0.1, { f0: 520, f1: 400, dur: 0.22, amp: 0.1, f: [450, 800], pan: p, type: 'triangle' }); break;
    case 'seufz': sndSyl(now, { f0: 330, f1: 330, dur: 0.18, amp: 0.05, f: [600, 1000], pan: p, type: 'triangle' }); sndSyl(now + 0.15, { f0: 340, f1: 190, dur: 0.75, amp: 0.07, f: [500, 900], pan: p, type: 'triangle' }); break;
    case 'pop': sndSyl(now, { f0: 900, f1: 1800, dur: 0.05, amp: 0.12, f: [1200, 3000], pan: p, type: 'sine' }); break;
    case 'tick': sndSyl(now, { f0: 1000, f1: 1000, dur: 0.03, amp: 0.05, f: [1500, 2500], pan: p, type: 'sine' }); break;
  }
}

/* ambient: sparse soft notes from a pentatonic scale */
function sndNote(t, freq, dur, amp, wave) {
  const c = SND.ctx;
  const o = c.createOscillator(); o.type = wave;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const out = sndOut(0);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.1);
  o.onended = () => { try { out.disconnect(); } catch (e) { /* gone */ } };
}

function sndAmbient(mode, night) {
  if (!SND.on || !SND.ctx || SND.ctx.state !== 'running') return;
  const c = SND.ctx, now = c.currentTime;
  if (SND.mode !== mode) { SND.mode = mode; SND.nextAmb = now + 0.5; }
  if (now < SND.nextAmb) return;
  const nt = night || 0;
  if (mode === 'terra') {
    const root = 261.63 * (nt > 0.5 ? 0.5 : 1);
    const k = SND_PENT[(Math.random() * 5) | 0] + (Math.random() < 0.3 ? 12 : 0);
    sndNote(now + 0.02, root * Math.pow(2, k / 12), 1.6, 0.05, 'triangle');
    if (Math.random() < 0.35) sndNote(now + 0.35, root * Math.pow(2, SND_PENT[(Math.random() * 5) | 0] / 12), 1.4, 0.035, 'triangle');
    SND.nextAmb = now + 1.4 + Math.random() * 2.8;
  } else {
    const root = nt > 0.5 ? 110 : 164.81;
    const k = SND_PENT[(Math.random() * 5) | 0] + (nt > 0.5 ? 0 : 12 * ((Math.random() * 2) | 0));
    sndNote(now + 0.02, root * Math.pow(2, k / 12), nt > 0.5 ? 3.2 : 2.2, nt > 0.5 ? 0.04 : 0.03, 'sine');
    if (nt > 0.5 && Math.random() < 0.3) sndNote(now + 0.6, root * 1.5, 3.4, 0.025, 'sine');
    SND.nextAmb = now + 2.2 + Math.random() * 4.5;
  }
}

function sndInterj(pan, mood) {
  const L = mood < 0 ? ['ach', 'seufz', 'hm'] : mood > 0 ? ['oh', 'hm'] : ['hm', 'ach', 'oh', 'seufz'];
  sndFx(L[(Math.random() * L.length) | 0], pan);
}

/* wilderness: bubbles from the world frame; pan/volume by distance to the camera */
function sndBubble(q, camX, camY, halfW) {
  if (!SND.on || !SND.ctx) return;
  if (halfW > 2000) return; /* far out: music only */
  const far = halfW > 1300;
  if (far && Math.random() < 0.7) return;
  SND.gm = far ? 0.5 : 1;
  sndBubbleIn(q, camX, camY, halfW);
  SND.gm = 1;
}

function sndBubbleIn(q, camX, camY, halfW) {
  const dx = (q.x - camX) / halfW, dy = (q.y - camY) / (halfW * 0.5);
  if (Math.abs(dx) > 1.1 || Math.abs(dy) > 1.1) return;
  const pan = Math.max(-1, Math.min(1, dx));
  if (q.kind === 2) {
    const k = String(q.text);
    if (k === 'b.like') sndFx('joy', pan);
    else if (k === 'b.ouch') sndFx(Math.random() < 0.5 ? 'ach' : 'ouch', pan);
    else if (k === 'b.gut') sndFx(Math.random() < 0.5 ? 'hm' : 'gut', pan);
    else if (k === 'b.sleep') sndFx(Math.random() < 0.5 ? 'seufz' : 'sigh', pan);
    return;
  }
  if (q.kind === 3) return;
  if (Math.random() < 0.15) { sndInterj(pan, 0); return; }
  sndSay(q.text, pan, 0);
}

function sndUiInit() {
  const on = document.getElementById('sndOn'), vol = document.getElementById('sndVol');
  if (on) { on.checked = SND.on; on.onchange = () => { SND.on = on.checked; sndSave(); sndApply(); }; }
  if (vol) { vol.value = Math.round(SND.vol * 100); vol.oninput = () => { SND.vol = vol.value / 100; sndSave(); sndApply(); }; }
  const wake = () => { if (SND.on) sndInit(); };
  document.addEventListener('pointerdown', wake, { passive: true });
  document.addEventListener('keydown', wake, { passive: true });
  document.addEventListener('visibilitychange', () => { if (SND.ctx) { if (document.hidden) SND.ctx.suspend().catch(() => {}); else if (SND.on) SND.ctx.resume().catch(() => {}); } });
}
