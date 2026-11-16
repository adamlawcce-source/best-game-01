// The whole simulation: the lantern fish, the pearls and orbs it collects, the anglerfish
// that hunt it, and the light that keeps it alive. One fixed step at a time, driven only by
// its seeded random source and the steering it is handed, so a scene staged from one seed
// always plays out the same way. Step returns the events of that step for sounds and the HUD.

import {
  ANGLER,
  COMBO,
  FIELD,
  LEVEL,
  LIGHT_DRAIN,
  LIGHT_DRAIN_PER_LEVEL,
  LIGHT_HIT_PENALTY,
  LIGHT_ORB_REFILL,
  LIGHT_START,
  LIVES,
  ORB,
  PEARL,
  PEARLS_TO_WIN,
  PLAYER,
  STEP,
} from './config.js';
import { mulberry32, pick, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_WIN = 1;
export const EVENT_LOSE = 2;

function makePlayer(random) {
  return {
    x: FIELD.width * 0.3,
    y: FIELD.height * 0.5,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    invulnerable: 0,
    face: 1,
    wiggle: random() * Math.PI * 2,
  };
}

function makePearl(random) {
  return {
    x: FIELD.width + 30,
    y: range(random, 70, FIELD.height - 110),
    radius: PEARL.radius,
    phase: random() * Math.PI * 2,
    bob: range(random, 8, 18),
    speed: range(random, 0.7, 1.3) * PEARL.drift,
    kind: 'pearl',
    active: true,
  };
}

function makeOrb(random) {
  return {
    x: FIELD.width + 30,
    y: range(random, 80, FIELD.height - 120),
    radius: ORB.radius,
    phase: random() * Math.PI * 2,
    bob: 14,
    speed: PEARL.drift * 0.8,
    kind: 'orb',
    active: true,
  };
}

function makeAngler(random, level) {
  const fromLeft = random() < 0.5;
  return {
    x: fromLeft ? -50 : FIELD.width + 50,
    y: range(random, 60, FIELD.height - 120),
    baseY: 0,
    radius: ANGLER.radius,
    direction: fromLeft ? 1 : -1,
    speed: ANGLER.speed + (level - 1) * ANGLER.speedPerLevel + range(random, -14, 14),
    phase: random() * Math.PI * 2,
    wobble: range(random, 18, 42),
    kind: 'angler',
    active: true,
  };
}

function sparkle(world, x, y, colour, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = world.random() * Math.PI * 2;
    const speed = range(world.random, 40, 150);
    world.state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: range(world.random, 0.3, 0.7),
      maxLife: 0.7,
      radius: range(world.random, 2, 4.5),
      colour,
    });
  }
}

function floatText(world, x, y, text, colour) {
  world.state.floats.push({ x, y, text, colour, life: 1.1 });
}

export class World {
  constructor(seed = 20261116) {
    this.seed = seed;
    this.random = mulberry32(seed);
    this.state = null;
    this.reset();
  }

  reset() {
    this.random = mulberry32(this.seed);
    const random = this.random;
    const weeds = [];
    for (let i = 0; i < 9; i += 1) {
      weeds.push({
        x: 40 + i * 145 + range(random, -30, 30),
        height: range(random, 70, 150),
        phase: random() * Math.PI * 2,
        lean: range(random, 0.1, 0.3),
      });
    }
    const plankton = [];
    for (let i = 0; i < 46; i += 1) {
      plankton.push({
        x: random() * FIELD.width,
        y: random() * FIELD.height,
        radius: range(random, 1, 2.6),
        phase: random() * Math.PI * 2,
      });
    }
    this.state = {
      player: makePlayer(random),
      pearls: [],
      orbs: [],
      anglers: [],
      bubbles: [],
      particles: [],
      floats: [],
      weeds,
      plankton,
      light: LIGHT_START,
      lives: LIVES,
      score: 0,
      pearlsCollected: 0,
      chain: 0,
      chainTimer: 0,
      level: 1,
      time: 0,
      pearlTimer: 0.4,
      orbTimer: 5,
      anglerTimer: 2.2,
      bubbleTimer: 0,
      shake: 0,
      over: null,
    };
    // A few pearls are already drifting when a run starts, so the first seconds are busy.
    for (let i = 0; i < 4; i += 1) {
      const pearl = makePearl(random);
      pearl.x = range(random, FIELD.width * 0.45, FIELD.width * 0.95);
      this.state.pearls.push(pearl);
    }
  }

  get level() {
    return this.state.level;
  }

  comboTier() {
    return Math.min(COMBO.max, 1 + Math.floor(this.state.chain / COMBO.perTier));
  }

  /** Advance the world one fixed step. Steering is {x, y, pointer} from input. */
  step(dt, steering) {
    const s = this.state;
    const events = { pearlTier: 0, orb: false, hit: false, levelUp: false, over: EVENT_NONE };
    if (s.over !== null) return events;
    s.time += dt;

    // The light drains faster as the levels climb; an empty lamp ends the run.
    s.light -= (LIGHT_DRAIN + (s.level - 1) * LIGHT_DRAIN_PER_LEVEL) * dt;
    if (s.light <= 0) {
      s.light = 0;
      s.over = 'lose';
      events.over = EVENT_LOSE;
      return events;
    }
    if (s.chainTimer > 0) {
      s.chainTimer -= dt;
      if (s.chainTimer <= 0) s.chain = 0;
    }
    if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 3);

    // --- The player ---
    const p = s.player;
    let ax = 0;
    let ay = 0;
    if (steering.pointer !== null && steering.pointer !== undefined) {
      const dx = steering.pointer.x - p.x;
      const dy = steering.pointer.y - p.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 6) {
        ax = (dx / distance) * PLAYER.accel;
        ay = (dy / distance) * PLAYER.accel;
      }
    } else {
      ax = steering.x * PLAYER.accel;
      ay = steering.y * PLAYER.accel;
    }
    p.vx += ax * dt;
    p.vy += ay * dt;
    const drag = Math.max(0, 1 - PLAYER.drag * dt);
    p.vx *= drag;
    p.vy *= drag;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > PLAYER.maxSpeed) {
      p.vx = (p.vx / speed) * PLAYER.maxSpeed;
      p.vy = (p.vy / speed) * PLAYER.maxSpeed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x));
    // The HUD sits across the top of the field: keep the fish below it, fully visible.
    p.y = Math.min(FIELD.height - 46 - p.radius, Math.max(92, p.y));
    if (Math.abs(p.vx) > 20) p.face = p.vx > 0 ? 1 : -1;
    if (p.invulnerable > 0) p.invulnerable -= dt;
    p.wiggle += dt * 9;

    // --- Spawning ---
    const level = s.level;
    s.pearlTimer -= dt;
    if (s.pearlTimer <= 0) {
      s.pearls.push(makePearl(this.random));
      const interval = Math.max(PEARL.minInterval, PEARL.interval * Math.pow(PEARL.intervalScale, level - 1));
      s.pearlTimer = interval * range(this.random, 0.75, 1.25);
    }
    s.orbTimer -= dt;
    if (s.orbTimer <= 0) {
      s.orbs.push(makeOrb(this.random));
      s.orbTimer = ORB.interval * range(this.random, 0.85, 1.2);
    }
    s.anglerTimer -= dt;
    const anglerCap = Math.min(ANGLER.maxCount + (level - 1) * ANGLER.maxCountPerLevel, 9);
    if (s.anglerTimer <= 0 && s.anglers.length < anglerCap) {
      const angler = makeAngler(this.random, level);
      angler.baseY = angler.y;
      s.anglers.push(angler);
      const interval = Math.max(ANGLER.minInterval, ANGLER.interval * Math.pow(ANGLER.intervalScale, level - 1));
      s.anglerTimer = interval * range(this.random, 0.8, 1.3);
    }
    s.bubbleTimer -= dt;
    if (s.bubbleTimer <= 0) {
      s.bubbles.push({
        x: range(this.random, 30, FIELD.width - 30),
        y: FIELD.height - 30,
        radius: range(this.random, 2, 6),
        speed: range(this.random, 26, 60),
        wobble: this.random() * Math.PI * 2,
      });
      s.bubbleTimer = range(this.random, 0.25, 0.8);
    }

    // --- Drift and swim ---
    const drift = (item, dtStep) => {
      item.x -= item.speed * dtStep;
      item.phase += dtStep * 2;
    };
    for (const pearl of s.pearls) drift(pearl, dt);
    for (const orb of s.orbs) drift(orb, dt);
    for (const angler of s.anglers) {
      angler.x += angler.direction * angler.speed * dt;
      angler.phase += dt * 2.4;
      angler.y = angler.baseY + Math.sin(angler.phase) * angler.wobble;
    }
    for (const bubble of s.bubbles) {
      bubble.y -= bubble.speed * dt;
      bubble.wobble += dt * 3;
      bubble.x += Math.sin(bubble.wobble) * 12 * dt;
    }
    s.bubbles = s.bubbles.filter((bubble) => bubble.y > -10);
    s.pearls = s.pearls.filter((pearl) => pearl.x > -50);
    s.orbs = s.orbs.filter((orb) => orb.x > -50);
    s.anglers = s.anglers.filter((angler) => angler.x > -90 && angler.x < FIELD.width + 90);

    const distanceTo = (item) => Math.hypot(item.x - p.x, item.y - p.y);

    // --- Pearls: quick chains raise the multiplier ---
    for (const pearl of s.pearls) {
      if (!pearl.active || distanceTo(pearl) > pearl.radius + p.radius) continue;
      pearl.active = false;
      s.pearlsCollected += 1;
      s.chain += 1;
      s.chainTimer = COMBO.window;
      const tier = this.comboTier();
      const gained = PEARL.points * tier;
      s.score += gained;
      events.pearlTier = tier;
      sparkle(this, pearl.x, pearl.y, '#7fe7ff', 10);
      floatText(this, pearl.x, pearl.y - 14, `+${gained}`, '#aef3ff');
      const nextLevel = Math.min(LEVEL.max, 1 + Math.floor(s.pearlsCollected / LEVEL.pearlsPerLevel));
      if (nextLevel > s.level) {
        s.level = nextLevel;
        events.levelUp = true;
        floatText(this, p.x, p.y - 44, `Level ${s.level}`, '#ffd76a');
      }
      if (s.pearlsCollected >= PEARLS_TO_WIN) {
        s.over = 'win';
        events.over = EVENT_WIN;
        return events;
      }
    }
    s.pearls = s.pearls.filter((pearl) => pearl.active);

    // --- Glow orbs refill the lamp ---
    for (const orb of s.orbs) {
      if (!orb.active || distanceTo(orb) > orb.radius + p.radius) continue;
      orb.active = false;
      s.light = Math.min(LIGHT_START, s.light + LIGHT_ORB_REFILL);
      s.score += ORB.points;
      events.orb = true;
      sparkle(this, orb.x, orb.y, '#ffc94d', 14);
      floatText(this, orb.x, orb.y - 14, `+${ORB.points} light!`, '#ffe9a8');
    }
    s.orbs = s.orbs.filter((orb) => orb.active);

    // --- Anglerfish bites cost a life, some light, and the chain ---
    for (const angler of s.anglers) {
      if (!angler.active || p.invulnerable > 0) continue;
      if (distanceTo(angler) > angler.radius + p.radius - 6) continue;
      angler.active = false;
      s.lives -= 1;
      s.light = Math.max(0, s.light - LIGHT_HIT_PENALTY);
      s.chain = 0;
      s.chainTimer = 0;
      p.invulnerable = PLAYER.invulnerable;
      p.vx = -angler.direction * 320;
      p.vy = -140;
      s.shake = 1;
      events.hit = true;
      sparkle(this, p.x, p.y, '#ff6b81', 16);
      floatText(this, p.x, p.y - 40, 'Ouch!', '#ff8fa3');
      if (s.lives <= 0) {
        s.over = 'lose';
        events.over = EVENT_LOSE;
        return events;
      }
      break;
    }
    s.anglers = s.anglers.filter((angler) => angler.active);

    // --- Particles and floating text fade out ---
    for (const particle of s.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - 2.4 * dt;
      particle.vy *= 1 - 2.4 * dt;
      particle.life -= dt;
    }
    s.particles = s.particles.filter((particle) => particle.life > 0);
    for (const text of s.floats) {
      text.y -= 34 * dt;
      text.life -= dt;
    }
    s.floats = s.floats.filter((text) => text.life > 0);

    return events;
  }
}

export { STEP };
