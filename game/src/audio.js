// Every sound in the game is synthesised with WebAudio: no sound files, no network.
// The context is built lazily on the first player gesture, so a page that only shows the
// title screen stays silent, and every call is a no-op while muted or before that gesture.

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
      this.master.gain.value = 0.5;
      this.master.connect(this.context.destination);
    } catch {
      this.context = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  /** One oscillator note with a quick attack and an exponential tail. */
  tone({ frequency, endFrequency = null, type = 'sine', at = 0, length = 0.18, volume = 0.5 }) {
    if (this.context === null || this.master === null || this.muted) return;
    const start = this.context.currentTime + at;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + length);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + length + 0.05);
  }

  /** A short filtered noise burst, for bumps and splashes. */
  noise({ at = 0, length = 0.15, volume = 0.3, cutoff = 900 }) {
    if (this.context === null || this.master === null || this.muted) return;
    const start = this.context.currentTime + at;
    const frames = Math.max(1, Math.floor(this.context.sampleRate * length));
    const buffer = this.context.createBuffer(1, frames, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
  }

  /** A pearl collected: a bright two-note blip that climbs with the combo tier. */
  pickup(tier = 1) {
    const base = 660 + (tier - 1) * 110;
    this.tone({ frequency: base, type: 'sine', length: 0.1, volume: 0.4 });
    this.tone({ frequency: base * 1.5, at: 0.07, type: 'sine', length: 0.16, volume: 0.4 });
  }

  /** A glow orb: a warm three-note chord that refills the light. */
  orb() {
    this.tone({ frequency: 392, type: 'triangle', length: 0.22, volume: 0.35 });
    this.tone({ frequency: 494, at: 0.05, type: 'triangle', length: 0.22, volume: 0.35 });
    this.tone({ frequency: 587, at: 0.1, type: 'triangle', length: 0.3, volume: 0.35 });
  }

  /** An anglerfish bite: a low thud with a splash of noise. */
  hit() {
    this.tone({ frequency: 160, endFrequency: 55, type: 'sawtooth', length: 0.28, volume: 0.5 });
    this.noise({ length: 0.18, volume: 0.3, cutoff: 700 });
  }

  /** A level up: a quick rising chime. */
  levelUp() {
    this.tone({ frequency: 523, type: 'triangle', length: 0.12, volume: 0.35 });
    this.tone({ frequency: 659, at: 0.09, type: 'triangle', length: 0.12, volume: 0.35 });
    this.tone({ frequency: 784, at: 0.18, type: 'triangle', length: 0.2, volume: 0.35 });
  }

  /** The win: a slow rising arpeggio over the tonic. */
  win() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((frequency, i) => {
      this.tone({ frequency, at: i * 0.13, type: 'triangle', length: 0.35, volume: 0.4 });
    });
    this.tone({ frequency: 262, type: 'sine', length: 0.9, volume: 0.3 });
  }

  /** The loss: a short descending line that settles low. */
  lose() {
    const notes = [392, 330, 262, 196];
    notes.forEach((frequency, i) => {
      this.tone({ frequency, at: i * 0.16, type: 'sine', length: 0.3, volume: 0.4 });
    });
  }
}
