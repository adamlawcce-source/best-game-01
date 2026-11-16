// Every tuning number and colour for Glimmerdeep 3D in one place. The simulation still
// runs on a fixed 1280x720 logical field; the 3D renderer maps it onto a seabed plane
// (FIELD.width / WORLD_SCALE units wide), so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** Logical pixels per 3D world unit on the seabed plane. */
export const WORLD_SCALE = 40;

export const PLAYER = {
  radius: 22,
  accel: 2600,
  maxSpeed: 430,
  drag: 2.6,
  invulnerable: 1.6,
};

export const LIVES = 3;
export const MAX_LIVES = 5;
export const PEARLS_TO_WIN = 30;
export const LIGHT_START = 100;
export const LIGHT_DRAIN = 1.35;
export const LIGHT_DRAIN_PER_LEVEL = 0.15;
export const LIGHT_ORB_REFILL = 30;
export const LIGHT_HIT_PENALTY = 12;

/** A dash: a short burst of speed on Shift, with a cooldown shown on the HUD. */
export const DASH = { speed: 980, time: 0.22, cooldown: 3 };

export const PEARL = {
  radius: 13,
  points: 10,
  interval: 1.7,
  intervalScale: 0.96,
  minInterval: 0.9,
  drift: 46,
};

/** Every GOLDEN_EVERY-th pearl spawned is golden: more points and light back. */
export const GOLDEN = { every: 7, points: 25, lightRefill: 20, radius: 15 };

/** The 30th pearl is the Heart of the Deep: big, pink-gold, worth 50, ends the run. */
export const HEART_PEARL = { points: 50, radius: 24 };

/** A heart pickup: one extra life, up to MAX_LIVES. Rare. */
export const HEART = { radius: 16, interval: 18 };

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

/** Jellyfish drift in from zone 2: slow, pulsing, and they sting on touch. */
export const JELLY = {
  radius: 20,
  speed: 55,
  interval: 6,
  minInterval: 3.5,
  maxCount: 3,
};

/** The boss: a huge anglerfish that appears at 25 pearls and guards the Heart. */
export const BOSS = { radius: 58, speed: 95, appearAt: 25 };

/** Six pearls per level; speeds and spawn rates stop growing at the last level. */
export const LEVEL = { pearlsPerLevel: 6, max: 8 };

/** Three zones, crossed as pearls are collected: new colours, fog and enemies. */
export const ZONES = [
  {
    name: 'Shallow Reef',
    fromPearls: 0,
    fog: 0x0d5570,
    background: 0x083049,
    floor: 0x14424e,
    ambient: 0x8fd0dd,
    ambientIntensity: 0.8,
    fogDensity: 0.012,
  },
  {
    name: 'Deep Trench',
    fromPearls: 10,
    fog: 0x0a3560,
    background: 0x06223c,
    floor: 0x0f3a4c,
    ambient: 0x6ba8cc,
    ambientIntensity: 0.65,
    fogDensity: 0.017,
  },
  {
    name: 'The Abyss',
    fromPearls: 20,
    fog: 0x111740,
    background: 0x050d28,
    floor: 0x101e38,
    ambient: 0x7a7fd8,
    ambientIntensity: 0.5,
    fogDensity: 0.024,
  },
];

/** A pearl chain raises the multiplier: every five quick pearls add one, up to three. */
export const COMBO = { window: 4, perTier: 5, max: 3 };

export const PALETTE = {
  deepTop: '#04182e',
  deepMid: '#062a44',
  deepBottom: '#0a3a4d',
  player: '#ffd76a',
  playerBelly: '#fff3c4',
  lure: '#ffe9a8',
  pearl: '#7fe7ff',
  pearlCore: '#eafcff',
  gold: '#ffd76a',
  heart: '#ff7fa5',
  angler: '#7a2e4d',
  anglerGlow: '#ff5d8f',
  jelly: '#c99aff',
  text: '#eaf6ff',
  muted: '#9fc3d8',
  panel: 'rgba(3, 22, 38, 0.82)',
  panelEdge: 'rgba(127, 231, 255, 0.35)',
  danger: '#ff6b81',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'glimmerdeep.best';
