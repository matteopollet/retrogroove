import { makeRng } from './prng.js';
import { sideSplit } from './albums.js';

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

function scaleDeg(scale, d) {
  const len = scale.length;
  const mod = ((d % len) + len) % len;
  return scale[mod] + 12 * Math.floor(d / len);
}

/* ------------------------------------------------------------------ */
/*  COMPOSITION — pure, déterministe, testable hors navigateur         */
/* ------------------------------------------------------------------ */

// Retourne { events, trackMarks, flipT, endT }
// events : { t, kind, f?, dur?, g?, freqs? }
export function composeAlbum(album) {
  const rng = makeRng(album.seed);
  const split = sideSplit(album);
  const events = [];
  const trackMarks = [];
  const GAP = 1.7;          // sillon entre deux morceaux
  const LEAD_IN = 1.6;      // craquements avant la première note

  let t = LEAD_IN;
  let flipT = null;

  album.tracks.forEach((title, i) => {
    const tr = composeTrack(album, makeRng(album.seed * 31 + i * 7919), i);
    for (const e of tr.events) events.push({ ...e, t: e.t + t });
    trackMarks.push({ index: i, title, t, dur: tr.dur, side: i < split ? 'A' : 'B' });
    t += tr.dur;
    if (i === split - 1 && album.tracks.length > 1) {
      flipT = t; // fin de la face A : l'aiguille se lève ici
    }
    t += GAP;
  });

  events.sort((a, b) => a.t - b.t);
  return { events, trackMarks, flipT: flipT ?? Infinity, endT: t + 0.6, split };
}

function sectionIntensities(rng, bars, style) {
  // intro -> montée -> A -> B (pic) -> A -> outro
  const intro = style === 'ambient' ? 2 : 4;
  const outro = style === 'ambient' ? 2 : 3;
  const mid = Math.max(6, bars - intro - outro);
  const a = Math.ceil(mid / 3), b = Math.ceil(mid / 3), c = mid - a - b;
  const parts = [
    { len: intro, i: style === 'ambient' ? 0.5 : 0.35 },
    { len: a, i: 0.7 },
    { len: b, i: 1.0 },
    { len: c, i: 0.78 },
    { len: outro, i: 0.4 },
  ];
  const map = [];
  for (const p of parts) for (let k = 0; k < p.len; k++) map.push(p.i);
  while (map.length < bars) map.push(0.6);
  return map.slice(0, bars);
}

function chordProgression(rng, scaleLen, style) {
  // 4 accords diatoniques ; le dernier ramène vers la tonique
  const pool = style === 'ambient' ? [0, 3, 4, 1] : [0, 5, 3, 4, 1, 2];
  const prog = [0, rng.pick(pool), rng.pick(pool), rng.pick([0, 4, 5])];
  return prog;
}

const chordTones = (deg) => [deg, deg + 2, deg + 4, deg + 6];

function nearestChordTone(deg, tones, scaleLen) {
  let best = deg, bestDist = Infinity;
  for (let delta = -4; delta <= 4; delta++) {
    const d = deg + delta;
    const mod = ((d % scaleLen) + scaleLen) % scaleLen;
    if (tones.some((tt) => ((tt % scaleLen) + scaleLen) % scaleLen === mod)) {
      const dist = Math.abs(delta);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
  }
  return best;
}

function composeTrack(album, rng, trackIndex) {
  const style = album.style;
  const scale = album.scale, L = scale.length;
  const bpm = album.bpm * rng.range(0.93, 1.07);
  const beat = 60 / bpm, step = beat / 4, bar = beat * 4;
  const swing = album.swing || 0;

  const bars = style === 'ambient' ? rng.int(18, 24)
    : style === 'chiptune' ? rng.int(28, 40)
    : rng.int(26, 38);
  const dur = bars * bar;

  const intensity = sectionIntensities(rng, bars, style);
  const prog = chordProgression(rng, L, style);

  // motif mélodique d'une mesure, répété avec mutations
  const motifLen = 16;
  const density = { synthwave: 0.42, lofi: 0.3, chiptune: 0.55, ambient: 0.18 }[style];
  const motif = [];
  let deg = rng.int(0, L + 3);
  for (let s = 0; s < motifLen; s++) {
    if (rng.chance(density)) {
      deg = Math.max(0, Math.min(L * 2, deg + rng.int(-3, 3)));
      motif.push({ s, deg, len: rng.pick([1, 1, 2, 2, 4]) });
    }
  }

  const events = [];
  const ev = (kind, tt, o = {}) => events.push({ t: tt, kind, ...o });
  const midi = (degree, oct = 0) => album.rootMidi + scaleDeg(scale, degree) + oct * 12;
  const chordAt = (b) => style === 'ambient' ? prog[Math.floor(b / 2) % 4] : prog[b % 4];

  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const I = intensity[b];
    const cDeg = chordAt(b);
    const tones = chordTones(cDeg);

    /* ---- batterie ---- */
    if (style === 'synthwave') {
      if (I >= 0.3) for (const s of [0, 4, 8, 12]) ev('kick', t0 + s * step);
      if (I >= 0.4) for (const s of [4, 12]) ev('snare', t0 + s * step);
      if (I >= 0.35) for (let s = 0; s < 16; s += 2) ev(s === 14 && I > 0.8 ? 'openhat' : 'hat', t0 + s * step, { g: rng.range(0.5, 1) });
      if (I >= 0.4) for (let s = 0; s < 16; s += 2) ev('bass', t0 + s * step, { f: midi(tones[0], -1), dur: step * 1.8, wave: 'sawtooth' });
      if (I >= 0.5) ev('pad', t0, { freqs: tones.slice(0, 3).map((d) => midiToFreq(album.rootMidi + scaleDeg(scale, d) + 12)), dur: bar * 0.98 });
      if (I >= 0.62) for (let s = 0; s < 16; s++) ev('arp', t0 + s * step, { f: midi(tones[s % 4] + L, 1), dur: step * 0.9 });
    } else if (style === 'lofi') {
      const sw = (s) => (s % 2 === 1 ? swing * step : 0);
      if (I >= 0.3) { ev('kick', t0); ev('kick', t0 + 10 * step); if (rng.chance(0.4)) ev('kick', t0 + 7 * step, { g: 0.7 }); }
      if (I >= 0.4) for (const s of [4, 12]) ev('snare', t0 + s * step + sw(s));
      if (I >= 0.35) for (let s = 0; s < 16; s += 2) ev('hat', t0 + s * step + sw(s), { g: rng.range(0.4, 0.9) });
      if (I >= 0.5) for (const s of [0, 8]) ev('keys', t0 + s * step + sw(s), { freqs: tones.slice(0, 3).map((d) => midiToFreq(midi(d, 1))), dur: beat * 1.6 });
      if (I >= 0.4) for (const s of [0, 7, 10]) ev('bass', t0 + s * step, { f: midi(tones[0], -1) / 2, dur: step * 3, wave: 'triangle' });
    } else if (style === 'chiptune') {
      if (I >= 0.3) for (const s of [0, 8]) ev('kick', t0 + s * step);
      if (I >= 0.4) for (const s of [4, 12]) ev('snare', t0 + s * step);
      if (I >= 0.35) for (let s = 0; s < 16; s++) ev('hat', t0 + s * step, { g: rng.range(0.35, 0.8) });
      if (I >= 0.4) for (let s = 0; s < 16; s += 2) ev('bass', t0 + s * step, { f: midi(tones[0], 0) / 2, dur: step * 1.6, wave: 'square' });
      if (I >= 0.4) for (let s = 0; s < 16; s++) ev('arp', t0 + s * step, { f: midi(tones[s % 4], 2), dur: step * 0.8, wave: 'square' });
    } else { // ambient
      if (b % 2 === 0) {
        ev('pad', t0, { freqs: tones.slice(0, 3).map((d) => midiToFreq(album.rootMidi + scaleDeg(scale, d) + 12)), dur: bar * 2.05 });
        if (I >= 0.45) ev('drone', t0, { f: midiToFreq(midi(tones[0], 0)), dur: bar * 2 });
      }
      if (I >= 0.5) for (let s = 0; s < 16; s += 2) {
        if (rng.chance(0.55)) ev('shimmer', t0 + s * step, { f: midi(tones[(s / 2) % 4], 3), dur: step * 2.4 });
      }
    }

    /* ---- mélodie (motif muté) ---- */
    const leadKind = { synthwave: 'lead', lofi: 'pluck', chiptune: 'lead', ambient: 'pluck' }[style];
    const leadOct = { synthwave: 2, lofi: 2, chiptune: 2, ambient: 2 }[style];
    const gate = { synthwave: 0.7, lofi: 0.55, chiptune: 0.6, ambient: 0.5 }[style];
    if (I >= gate && b % (style === 'ambient' ? 2 : 1) === 0) {
      for (const note of motif) {
        if (rng.chance(0.12)) continue;                    // mutation : trou
        let d = note.deg + (rng.chance(0.1) ? rng.pick([-L, L]) : 0); // saut d'octave
        if (note.s % 8 === 0) d = nearestChordTone(d, tones, L);
        const f = midi(d, leadOct);
        ev(leadKind, t0 + note.s * step, { f, dur: note.len * step * (style === 'ambient' ? 3 : 0.9) });
      }
    }
  }

  return { dur, events };
}

/* ------------------------------------------------------------------ */
/*  LECTEUR VINYLE — synthèse Web Audio + ordonnanceur                  */
/* ------------------------------------------------------------------ */

const LOOKAHEAD = 0.18;
const TICK_MS = 40;

export class VinylPlayer {
  constructor(ctx, album, hooks = {}) {
    this.ctx = ctx;
    this.album = album;
    this.hooks = hooks;
    this.state = 'idle'; // idle | playing | paused | waiting | finished
    this.side = 'A';
    this.comp = composeAlbum(album);
    this.eventIdx = 0;

    // chaîne audio : voix -> bus -> passe-bas "chaleur" -> compresseur -> analyseur -> sortie
    this.bus = ctx.createGain(); this.bus.gain.value = 0.9;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass'; this.lp.frequency.value = album.warmth; this.lp.Q.value = 0.4;
    this.compNode = ctx.createDynamicsCompressor();
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512;
    this.bus.connect(this.lp); this.lp.connect(this.compNode);
    this.compNode.connect(this.analyser); this.analyser.connect(ctx.destination);

    // écho (send) pour le space des leads
    this.echo = ctx.createDelay(1); this.echo.delayTime.value = 0.34;
    this.echoFb = ctx.createGain(); this.echoFb.gain.value = 0.32;
    this.echoWet = ctx.createGain(); this.echoWet.gain.value = 0.22;
    this.echo.connect(this.echoFb); this.echoFb.connect(this.echo);
    this.echo.connect(this.echoWet); this.echoWet.connect(this.bus);

    this.noiseBuf = this._makeNoise();
    this.crackleBuf = this._makeCrackle();
    this.crackleSrc = null;
    this.timer = null;
  }

  /* ---------- buffers ---------- */
  _makeNoise() {
    const sr = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, sr * 1.5, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _makeCrackle() {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * 3.2);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const rng = makeRng(this.album.seed ^ 0x5EED);
    // souffle doux
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = last * 0.94 + (rng.next() * 2 - 1) * 0.06;
      d[i] = last * 0.35 + (rng.next() * 2 - 1) * 0.012;
    }
    // pops & tics
    const pops = Math.floor(len * 0.00006);
    for (let p = 0; p < pops; p++) {
      const at = Math.floor(rng.next() * (len - 400));
      const amp = rng.range(0.15, 0.75) * (rng.chance(0.08) ? 1.6 : 1);
      const decay = rng.range(20, 90);
      const sign = rng.chance(0.5) ? 1 : -1;
      for (let j = 0; j < 380 && at + j < len; j++) {
        d[at + j] += sign * amp * Math.exp(-j / decay) * (rng.next() * 0.6 + 0.4);
      }
    }
    return buf;
  }

  _startCrackle() {
    this._stopCrackle();
    const src = this.ctx.createBufferSource();
    src.buffer = this.crackleBuf; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = this.album.crackle;
    src.connect(g); g.connect(this.bus);
    src.start();
    this.crackleSrc = src; this.crackleGain = g;
  }

  _stopCrackle() {
    if (this.crackleSrc) { try { this.crackleSrc.stop(); } catch (_) {} this.crackleSrc = null; }
  }

  /* ---------- voix ---------- */
  _env(t, a, peak, rel) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + rel);
    return g;
  }

  _osc(type, f, t) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    return o;
  }

  _play(e) {
    const t = Math.max(0.001, this.t0 + e.t);
    const m = this.album.mix, gg = e.g ?? 1;
    const ctx = this.ctx;
    switch (e.kind) {
      case 'kick': {
        const o = this._osc('sine', 150, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
        const g = this._env(t, 0.004, m.kick * gg, 0.28);
        o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.3);
        break;
      }
      case 'snare': {
        const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.9;
        const g = this._env(t, 0.002, m.snare * gg, 0.16);
        n.connect(bp); bp.connect(g); g.connect(this.bus); n.start(t); n.stop(t + 0.2);
        const o = this._osc('triangle', 185, t);
        const g2 = this._env(t, 0.002, m.snare * 0.5 * gg, 0.09);
        o.connect(g2); g2.connect(this.bus); o.start(t); o.stop(t + 0.12);
        break;
      }
      case 'hat': case 'openhat': {
        const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
        n.playbackRate.value = 1.4;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7600;
        const rel = e.kind === 'openhat' ? 0.28 : 0.045;
        const g = this._env(t, 0.001, m.hat * gg, rel);
        n.connect(hp); hp.connect(g); g.connect(this.bus);
        n.start(t); n.stop(t + rel + 0.05);
        break;
      }
      case 'bass': {
        const o = this._osc(e.wave || 'sawtooth', e.f, t);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(280, t + e.dur);
        const g = this._env(t, 0.008, m.bass * gg, e.dur);
        o.connect(lp); lp.connect(g); g.connect(this.bus); o.start(t); o.stop(t + e.dur + 0.05);
        break;
      }
      case 'pad': {
        for (const f of e.freqs) {
          for (const det of [-7, 7]) {
            const o = this._osc('sawtooth', f, t); o.detune.value = det;
            const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
            const g = ctx.createGain();
            const a = Math.min(0.9, e.dur * 0.3), r = e.dur * 0.4;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(m.pad * 0.09 * gg, t + a);
            g.gain.setValueAtTime(m.pad * 0.09 * gg, t + e.dur - r);
            g.gain.linearRampToValueAtTime(0.0001, t + e.dur);
            o.connect(lp); lp.connect(g); g.connect(this.bus);
            o.start(t); o.stop(t + e.dur + 0.05);
          }
        }
        break;
      }
      case 'arp': {
        const o = this._osc(e.wave || 'square', e.f, t);
        const g = this._env(t, 0.003, m.arp * gg, e.dur * 0.9);
        o.connect(g); g.connect(this.bus); g.connect(this.echo);
        o.start(t); o.stop(t + e.dur + 0.05);
        break;
      }
      case 'lead': {
        for (const det of [-6, 6]) {
          const o = this._osc(this.album.style === 'chiptune' ? 'square' : 'sawtooth', e.f, t);
          o.detune.value = det;
          const g = this._env(t, 0.01, m.lead * 0.5 * gg, e.dur);
          o.connect(g); g.connect(this.bus); g.connect(this.echo);
          o.start(t); o.stop(t + e.dur + 0.1);
        }
        break;
      }
      case 'keys': {
        for (const f of e.freqs) {
          const o = this._osc('sine', f, t);
          const o2 = this._osc('sine', f * 2.01, t);
          const g = this._env(t, 0.006, m.keys * 0.3 * gg, e.dur);
          const g2 = this._env(t, 0.006, m.keys * 0.12 * gg, e.dur * 0.7);
          o.connect(g); o2.connect(g2); g.connect(this.bus); g2.connect(this.bus);
          g.connect(this.echo);
          o.start(t); o.stop(t + e.dur + 0.1); o2.start(t); o2.stop(t + e.dur + 0.1);
        }
        break;
      }
      case 'pluck': {
        const o = this._osc('triangle', e.f, t);
        const g = this._env(t, 0.004, m.pluck * gg, Math.max(e.dur, 0.5));
        o.connect(g); g.connect(this.bus); g.connect(this.echo);
        o.start(t); o.stop(t + e.dur + 0.6);
        break;
      }
      case 'shimmer': {
        const o = this._osc('sine', e.f, t);
        const g = this._env(t, 0.05, m.shimmer * gg, e.dur);
        o.connect(g); g.connect(this.echo);
        o.start(t); o.stop(t + e.dur + 0.1);
        break;
      }
      case 'drone': {
        const o = this._osc('triangle', e.f, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(m.drone * gg, t + e.dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + e.dur);
        o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + e.dur + 0.05);
        break;
      }
      case 'thump': { // l'aiguille touche le sillon
        const o = this._osc('sine', 65, t);
        const g = this._env(t, 0.002, 0.5, 0.12);
        o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.15);
        break;
      }
    }
  }

  /* ---------- transport ---------- */
  get position() {
    if (this.state === 'idle') return 0;
    return Math.max(0, this.ctx.currentTime - this.t0);
  }

  currentTrackIndex(pos) {
    let idx = -1;
    for (const mk of this.comp.trackMarks) if (pos >= mk.t - 0.01) idx = mk.index;
    return idx;
  }

  async start() {
    await this.ctx.resume();
    this.t0 = this.ctx.currentTime;
    this.state = 'playing';
    this._startCrackle();
    this._play({ t: 0.05, kind: 'thump' });
    this.timer = setInterval(() => this._tick(), TICK_MS);
    this._tick();
  }

  _tick() {
    const pos = this.position;
    const { events, flipT, endT } = this.comp;

    if (this.state === 'playing') {
      // sauter d'abord les événements déjà dépassés (sécurité)
      while (this.eventIdx < events.length && events[this.eventIdx].t < pos - 0.3) this.eventIdx++;
      // gate face A : rien au-delà de flipT
      const limit = this.side === 'A' ? flipT : Infinity;
      while (this.eventIdx < events.length
        && events[this.eventIdx].t <= pos + LOOKAHEAD
        && events[this.eventIdx].t < limit) {
        this._play(events[this.eventIdx]);
        this.eventIdx++;
      }

      if (this.side === 'A' && pos >= flipT - 0.05) {
        this.state = 'waiting';
        this._stopCrackle();
        this.hooks.onFlipNeeded?.();
      } else if (pos >= endT) {
        this.state = 'finished';
        clearInterval(this.timer); this.timer = null;
        setTimeout(() => this._stopCrackle(), 2200);
        this.hooks.onFinished?.();
      }
    }

    const ti = this.currentTrackIndex(pos);
    if (ti !== this._lastTrack && ti >= 0) {
      this._lastTrack = ti;
      this.hooks.onTrack?.(ti);
    }
    this.hooks.onTick?.(this.getState());
  }

  getState() {
    const pos = Math.min(this.position, this.comp.endT);
    const ti = this.currentTrackIndex(pos);
    const mk = ti >= 0 ? this.comp.trackMarks[ti] : null;
    return {
      state: this.state, side: this.side, pos, endT: this.comp.endT,
      trackIndex: ti, trackElapsed: mk ? pos - mk.t : 0, trackDur: mk?.dur ?? 0,
    };
  }

  async pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    await this.ctx.suspend();
    this.hooks.onPauseChange?.(true);
  }

  async resume() {
    if (this.state !== 'paused') return;
    await this.ctx.resume();
    this.state = 'playing';
    this._play({ t: this.position + 0.02, kind: 'thump' });
    this.hooks.onPauseChange?.(false);
  }

  flipSide() {
    if (this.state !== 'waiting') return;
    this.side = 'B';
    // recale l'horloge juste après le point de flip : 1s de craquement puis la face B
    this.t0 = this.ctx.currentTime - (this.comp.flipT + 0.7);
    this._startCrackle();
    this._play({ t: this.position + 0.15, kind: 'thump' });
    this.state = 'playing';
    this.hooks.onFlipped?.();
  }

  async stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this._stopCrackle();
    this.state = 'idle';
    try { this.bus.disconnect(); this.echoWet.disconnect(); } catch (_) {}
  }
}
