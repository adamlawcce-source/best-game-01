// Every tuning number and colour for Glimmerdeep in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the size of the screen it happens to be drawn on.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 22,
  accel: 2600,
  maxSpeed: 430,
  drag: 2.6,
  invulnerable: 1.6,
};

export const LIVES = 3;
export const PEARLS_TO_WIN = 30;
export const LIGHT_START = 100;
export const LIGHT_DRAIN = 1.35;
export const LIGHT_DRAIN_PER_LEVEL = 0.15;
export const LIGHT_ORB_REFILL = 30;
export const LIGHT_HIT_PENALTY = 12;

export const PEARL = {
  radius: 13,
  points: 10,
  interval: 1.7,
  intervalScale: 0.96,
  minInterval: 0.9,
  drift: 46,
};

export const ORB = {
  radius: 16,
  points: 25,
  interval: 8,
};

export const ANGLER = {
  radius: 26,
  speed: 118,
  speedPerLevel: 16,
  interval: 1.9,
  intervalScale: 0.9,
  minInterval: 0.8,
  maxCount: 4,
  maxCountPerLevel: 1,
};

/** Six pearls per level; speeds and spawn rates stop growing at the last level. */
export const LEVEL = { pearlsPerLevel: 6, max: 8 };

/** A pearl chain raises the multiplier: every five quick pearls add one, up to three. */
export const COMBO = { window: 4, perTier: 5, max: 3 };

export const PALETTE = {
  deepTop: '#04182e',
  deepMid: '#062a44',
  deepBottom: '#0a3a4d',
  ray: 'rgba(120, 220, 255, 0.05)',
  sand: '#123240',
  weed: '#0e5f4a',
  weedTip: '#1d9e78',
  player: '#ffd76a',
  playerBelly: '#fff3c4',
  lure: '#ffe9a8',
  pearl: '#7fe7ff',
  pearlCore: '#eafcff',
  orb: '#ffc94d',
  orbCore: '#fff0b3',
  angler: '#7a2e4d',
  anglerBelly: '#4a1c33',
  anglerGlow: '#ff5d8f',
  anglerTeeth: '#f4f0e6',
  bubble: 'rgba(180, 235, 255, 0.35)',
  text: '#eaf6ff',
  muted: '#9fc3d8',
  panel: 'rgba(3, 22, 38, 0.82)',
  panelEdge: 'rgba(127, 231, 255, 0.35)',
  danger: '#ff6b81',
  gold: '#ffd76a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'glimmerdeep.best';
