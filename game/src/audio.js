// Glimmerdeep 3D's sound: every effect is synthesised live with WebAudio, so the game
// ships no sound files and makes no network requests. The AudioContext is created lazily
// on the first player gesture (browsers forbid sound before one), and every effect is a
// no-op while muted or before that first gesture, so the title screen stays silent.

const MASTER_VOLUME = 0.5;

export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
  }

  /** Call from a user gesture (start, key press, click) so the browser allows sound. */
  unlock() {
    if (this.context !== null) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = MASTER_VOLUME;
      this.master.connect(this.context.destination);
    } catch {
      this.context = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    return this.muted;
  }

  /** A single oscillator voice: quick attack, exponential tail, optional glide. */
  note({ freq, glideTo = null, wave = 'sine', delay = 0, dur = 0.18, vol = 0.5 }) {
    if (this.context === null || this.master === null || this.muted) return;
    const at = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, at);
    if (glideTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), at + dur);
    }
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(vol, at + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** A short burst of filtered noise: bumps, splashes, the dash whoosh. */
  burst({ delay = 0, dur = 0.15, vol = 0.3, cutoff = 900 }) {
    if (this.context === null || this.master === null || this.muted) return;
    const at = this.context.currentTime + delay;
    const frames = Math.max(1, Math.floor(this.context.sampleRate * dur));
    const buffer = this.context.createBuffer(1, frames, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      samples[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = this.context.createBufferSource();
    src.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const amp = this.context.createGain();
    amp.gain.setValueAtTime(vol, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    src.start(at);
  }

  /** A little melody: [frequency, delay, duration] steps on one waveform. */
  tune(steps, wave = 'triangle', vol = 0.35) {
    steps.forEach(([freq, delay, dur]) => {
      this.note({ freq, delay, dur, wave, vol });
    });
  }

  /** A pearl collected: a bright two-note blip that climbs with the combo tier. */
  pickup(tier = 1) {
    const base = 660 + (tier - 1) * 110;
    this.note({ freq: base, dur: 0.1, vol: 0.4 });
    this.note({ freq: base * 1.5, delay: 0.07, dur: 0.16, vol: 0.4 });
  }

  /** A golden pearl: a richer four-note sparkle, worth more than a plain pearl. */
  golden() {
    this.tune([[880, 0, 0.1], [1109, 0.06, 0.1], [1319, 0.12, 0.14], [1760, 0.18, 0.22]], 'sine', 0.4);
  }

  /** A glow orb: a warm three-note chord that refills the lamp. */
  orb() {
    this.tune([[392, 0, 0.22], [494, 0.05, 0.22], [587, 0.1, 0.3]], 'triangle', 0.35);
  }

  /** A heart pickup: a soft two-note lift for the extra life. */
  heartPickup() {
    this.tune([[659, 0, 0.18], [988, 0.1, 0.3]], 'sine', 0.4);
  }

  /** A dash: a quick rising whoosh. */
  dash() {
    this.note({ freq: 300, glideTo: 900, dur: 0.16, vol: 0.3 });
    this.burst({ dur: 0.12, vol: 0.15, cutoff: 2400 });
  }

  /** An anglerfish bite or a jellyfish sting: a low thud with a splash of noise. */
  hit() {
    this.note({ freq: 160, glideTo: 55, wave: 'sawtooth', dur: 0.28, vol: 0.5 });
    this.burst({ dur: 0.18, vol: 0.3, cutoff: 700 });
  }

  /** The boss surfaces: a deep two-note drone from below. */
  boss() {
    this.note({ freq: 98, glideTo: 65, wave: 'sawtooth', dur: 0.7, vol: 0.45 });
    this.note({ freq: 147, delay: 0.15, glideTo: 98, wave: 'sawtooth', dur: 0.6, vol: 0.3 });
    this.burst({ dur: 0.4, vol: 0.2, cutoff: 400 });
  }

  /** A level up: a quick rising chime. */
  levelUp() {
    this.tune([[523, 0, 0.12], [659, 0.09, 0.12], [784, 0.18, 0.2]], 'triangle', 0.35);
  }

  /** A new zone: a slow deep chime, darker than a level-up. */
  zone() {
    this.tune([[330, 0, 0.3], [415, 0.14, 0.3], [494, 0.28, 0.45]], 'sine', 0.4);
  }

  /** The win: a slow rising arpeggio over the tonic. */
  win() {
    this.tune([[523, 0, 0.35], [659, 0.13, 0.35], [784, 0.26, 0.35], [1047, 0.39, 0.35], [1319, 0.52, 0.5]], 'triangle', 0.4);
    this.note({ freq: 262, dur: 0.9, vol: 0.3 });
  }

  /** The loss: a short descending line that settles low. */
  lose() {
    this.tune([[392, 0, 0.3], [330, 0.16, 0.3], [262, 0.32, 0.3], [196, 0.48, 0.4]], 'sine', 0.4);
  }
}
