// Fully synthesized audio (no asset files). Context is created lazily on the first user gesture.
const STEPS = [0, 2, 4, 7, 9]; // major pentatonic
const noteFreq = (i) => 261.63 * Math.pow(2, (STEPS[i % 5] + 12 * Math.floor(i / 5)) / 12);

export class Sfx {
  constructor() { this.ctx = null; this.drawNodes = null; this.master = null; }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  tone(freq, dur = 0.2, { type = 'sine', vol = 0.3, slide = 0, delay = 0, attack = 0.005 } = {}) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur = 0.2, { freq = 2000, q = 1, vol = 0.3, type = 'bandpass', delay = 0, sweep = 0 } = {}) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  // --- bow draw: creak + rising pitch that climbs the scale with the streak
  drawStart(streak) {
    if (!this.ensure()) return;
    this.drawStop();
    const base = noteFreq(Math.min(14, streak));
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = base * 0.5;
    g.gain.value = 0.0001;
    o.connect(g).connect(this.master);
    o.start();
    this.drawNodes = { o, g, base };
    this.noise(0.18, { freq: 700, q: 3, vol: 0.12, sweep: 500 });
  }
  drawUpdate(progress) {
    const n = this.drawNodes;
    if (!n) return;
    const t = this.ctx.currentTime;
    n.o.frequency.setTargetAtTime(n.base * (0.5 + progress * 0.5), t, 0.03);
    n.g.gain.setTargetAtTime(0.05 + progress * 0.12, t, 0.03);
  }
  drawStop() {
    const n = this.drawNodes;
    if (!n) return;
    const t = this.ctx.currentTime;
    n.g.gain.setTargetAtTime(0.0001, t, 0.02);
    n.o.stop(t + 0.15);
    this.drawNodes = null;
  }

  fire(kind = 'elven') {
    this.drawStop();
    this.noise(0.09, { freq: 3500, q: 0.7, vol: 0.28, type: 'highpass' });
    if (kind === 'steampunk') {
      this.tone(110, 0.25, { type: 'square', vol: 0.15, slide: -50 });
      this.noise(0.6, { freq: 5000, q: 0.5, vol: 0.2, type: 'highpass' }); // steam hiss
    } else if (kind === 'laser') {
      this.tone(1400, 0.28, { type: 'sawtooth', vol: 0.16, slide: -1100 });
    } else if (kind === 'arcane') {
      this.tone(520, 0.5, { type: 'sine', vol: 0.2, slide: 400 });
      this.tone(780, 0.5, { type: 'sine', vol: 0.12, slide: 600, delay: 0.03 });
    } else {
      this.tone(160, 0.14, { type: 'triangle', vol: 0.3, slide: -80 }); // string twang
      this.tone(320, 0.2, { type: 'sine', vol: 0.12, slide: -120 });
    }
  }

  thock() { // arrow through the hole, wooden THOCK
    this.tone(140, 0.18, { type: 'sine', vol: 0.6, slide: -80 });
    this.noise(0.1, { freq: 500, q: 1.2, vol: 0.45, type: 'lowpass' });
  }
  clip() { // metallic scrape
    this.noise(0.28, { freq: 5200, q: 8, vol: 0.28, sweep: -2500 });
    this.tone(1800, 0.12, { type: 'square', vol: 0.05, slide: -600 });
  }
  miss() { // dull hollow thud + snapped arrow
    this.tone(90, 0.22, { type: 'sine', vol: 0.5, slide: -40 });
    this.noise(0.08, { freq: 300, q: 0.8, vol: 0.4, type: 'lowpass' });
    this.noise(0.1, { freq: 3000, q: 4, vol: 0.2, delay: 0.05 }); // crack
  }
  chime(streak) { // high-note satisfaction, climbs with streak
    const n = Math.min(14, streak + 5);
    this.tone(noteFreq(n), 0.55, { type: 'sine', vol: 0.3 });
    this.tone(noteFreq(n) * 2, 0.45, { type: 'sine', vol: 0.1, delay: 0.02 });
    this.tone(noteFreq(Math.min(14, n + 2)), 0.5, { type: 'sine', vol: 0.18, delay: 0.09 });
  }
  boom() { // overdrive obliteration
    this.tone(70, 0.7, { type: 'sawtooth', vol: 0.5, slide: -40 });
    this.noise(0.6, { freq: 1200, q: 0.6, vol: 0.5, type: 'lowpass', sweep: -900 });
  }
  overdriveReady() { [0, 4, 7, 12].forEach((s, i) => this.tone(330 * Math.pow(2, s / 12), 0.22, { type: 'square', vol: 0.08, delay: i * 0.07 })); }
  tick() { this.tone(1100, 0.03, { type: 'square', vol: 0.025 }); }
  coin() { this.tone(1320, 0.08, { type: 'square', vol: 0.06 }); this.tone(1760, 0.18, { type: 'square', vol: 0.06, delay: 0.07 }); }
  click() { this.tone(660, 0.07, { type: 'triangle', vol: 0.15 }); }
  deny() { this.tone(180, 0.15, { type: 'sawtooth', vol: 0.12, slide: -60 }); }
  gameOver() { [0, -3, -7, -12].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.35, { type: 'triangle', vol: 0.2, delay: i * 0.18 })); }
  perk() { [0, 4, 7, 11, 14, 19].forEach((st, i) => this.tone(440 * Math.pow(2, st / 12), 0.28, { type: 'triangle', vol: 0.14, delay: i * 0.05 })); this.noise(0.4, { freq: 6000, q: 2, vol: 0.12, type: 'highpass', delay: 0.05 }); }
  perkSpawn() { this.tone(988, 0.1, { type: 'sine', vol: 0.08 }); this.tone(1319, 0.18, { type: 'sine', vol: 0.08, delay: 0.09 }); }
  thunder() { this.noise(1.6, { freq: 400, q: 0.6, vol: 0.55, type: 'lowpass', sweep: -300 }); this.tone(55, 1.2, { type: 'sine', vol: 0.4, slide: -20 }); }
  stageUp() { [0, 4, 7, 12, 16].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.06 })); }
}
