// Glimmerdeep 3D's simulation: Luma the lantern fish, the pearls and orbs it gathers,
// the anglerfish that hunt it, the jellyfish, the boss guarding the Heart of the Deep,
// and the lamp that keeps it alive. The world advances one fixed step at a time, driven
// only by its seeded random source and the steering it is handed, so a scene staged from
// one seed always plays out the same way. Each step returns the events of that step, and
// the main loop turns them into sounds, banners and the end of the run.

import {
  ANGLER,
  BOSS,
  COMBO,
  DASH,
  FIELD,
  GOLDEN,
  HEART,
  HEART_PEARL,
  JELLY,
  LEVEL,
  LIGHT_DRAIN,
  LIGHT_DRAIN_PER_LEVEL,
  LIGHT_HIT_PENALTY,
  LIGHT_ORB_REFILL,
  LIGHT_START,
  LIVES,
  MAX_LIVES,
  ORB,
  PEARL,
  PEARLS_TO_WIN,
  PLAYER,
  STEP,
  ZONES,
} from './config.js';
import { mulberry32, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_WIN = 1;
export const EVENT_LOSE = 2;

/** The zone the pearl count puts the run in: 0 Shallow Reef, 1 Deep Trench, 2 Abyss. */
export function zoneOf(pearlsCollected) {
  let zone = 0;
  for (let i = 0; i < ZONES.length; i += 1) {
    if (pearlsCollected >= ZONES[i].fromPearls) zone = i;
  }
  return zone;
}

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

function makePearl(random, kind = 'pearl') {
  const isGolden = kind === 'golden';
  const isHeartPearl = kind === 'heart-pearl';
  return {
    x: FIELD.width + 30,
    y: range(random, 70, FIELD.height - 110),
    radius: isHeartPearl ? HEART_PEARL.radius : isGolden ? GOLDEN.radius : PEARL.radius,
    phase: random() * Math.PI * 2,
    bob: range(random, 8, 18),
    speed: (isHeartPearl ? 0.45 : range(random, 0.7, 1.3)) * PEARL.drift,
    kind,
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

function makeHeart(random) {
  return {
    x: FIELD.width + 30,
    y: range(random, 90, FIELD.height - 130),
    radius: HEART.radius,
    phase: random() * Math.PI * 2,
    bob: 12,
    speed: PEARL.drift * 0.7,
    kind: 'heart',
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

function makeJelly(random) {
  const fromLeft = random() < 0.5;
  return {
    x: fromLeft ? -40 : FIELD.width + 40,
    y: range(random, 90, FIELD.height - 140),
    baseY: 0,
    radius: JELLY.radius,
    direction: fromLeft ? 1 : -1,
    speed: JELLY.speed + range(random, -12, 12),
    phase: random() * Math.PI * 2,
    wobble: range(random, 12, 30),
    kind: 'jelly',
    active: true,
  };
}

function makeBoss(random) {
  return {
    x: FIELD.width + 90,
    y: FIELD.height * 0.45,
    baseY: FIELD.height * 0.45,
    radius: BOSS.radius,
    direction: -1,
    speed: BOSS.speed,
    phase: 0,
    wobble: 26,
    kind: 'boss',
    active: true,
  };
}

/** A spray of fading sparkles at (x, y): the feedback for every pickup and hit. */
function burst(world, x, y, colour, count) {
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

/** A short floating label at (x, y): "+30", "Ouch!", a zone name. */
function popup(world, x, y, text, colour) {
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
      hearts: [],
      anglers: [],
      jellies: [],
      boss: null,
      bubbles: [],
      particles: [],
      floats: [],
      weeds,
      plankton,
      light: LIGHT_START,
      lives: LIVES,
      score: 0,
      pearlsCollected: 0,
      pearlsSpawned: 0,
      chain: 0,
      chainTimer: 0,
      level: 1,
      zone: 0,
      time: 0,
      pearlTimer: 0.4,
      orbTimer: 5,
      heartTimer: 14,
      anglerTimer: 2.2,
      jellyTimer: 4,
      bubbleTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      shake: 0,
      over: null,
    };
    // A few pearls are already drifting when a run starts, so the first seconds are busy.
    for (let i = 0; i < 4; i += 1) {
      const pearl = makePearl(random);
      pearl.x = range(random, FIELD.width * 0.45, FIELD.width * 0.95);
      this.state.pearls.push(pearl);
      this.state.pearlsSpawned += 1;
    }
  }

  get level() {
    return this.state.level;
  }

  comboTier() {
    return Math.min(COMBO.max, 1 + Math.floor(this.state.chain / COMBO.perTier));
  }

  /** One hit on the player: a life, some light, the chain, a knockback and a shake. */
  hurt(s, fromX, fromY, events) {
    const p = s.player;
    s.lives -= 1;
    s.light = Math.max(0, s.light - LIGHT_HIT_PENALTY);
    s.chain = 0;
    s.chainTimer = 0;
    p.invulnerable = PLAYER.invulnerable;
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const length = Math.hypot(dx, dy) || 1;
    p.vx = (dx / length) * 320;
    p.vy = (dy / length) * 320 - 60;
    s.shake = 1;
    events.hit = true;
    burst(this, p.x, p.y, '#ff6b81', 16);
    popup(this, p.x, p.y - 40, 'Ouch!', '#ff8fa3');
    if (s.lives <= 0) {
      s.over = 'lose';
      events.over = EVENT_LOSE;
      return true;
    }
    return false;
  }

  /** Advance the world one fixed step. Steering is {x, y, pointer, dash} from input. */
  step(dt, steering) {
    const s = this.state;
    const events = {
      pearlTier: 0, orb: false, hit: false, levelUp: false, zoneUp: false,
      golden: false, heart: false, dash: false, boss: false, over: EVENT_NONE,
    };
    if (s.over !== null) return events;
    s.time += dt;

    // The lamp drains faster as the levels climb; an empty lamp ends the run.
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
    if (s.dashCooldown > 0) s.dashCooldown -= dt;
    if (s.dashTimer > 0) s.dashTimer -= dt;

    // --- The player ---
    const p = s.player;
    // A dash is a short burst in the direction already being steered (or facing).
    if (steering.dash && s.dashCooldown <= 0 && s.dashTimer <= 0) {
      let dx = steering.x;
      let dy = steering.y;
      if (steering.pointer !== null && steering.pointer !== undefined) {
        dx = steering.pointer.x - p.x;
        dy = steering.pointer.y - p.y;
      }
      const length = Math.hypot(dx, dy);
      if (length > 0.01) {
        p.vx = (dx / length) * DASH.speed;
        p.vy = (dy / length) * DASH.speed;
      } else {
        p.vx = p.face * DASH.speed;
        p.vy = 0;
      }
      s.dashTimer = DASH.time;
      s.dashCooldown = DASH.cooldown;
      events.dash = true;
      burst(this, p.x, p.y, '#7fe7ff', 8);
    }
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
    const topSpeed = s.dashTimer > 0 ? DASH.speed : PLAYER.maxSpeed;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > topSpeed) {
      p.vx = (p.vx / speed) * topSpeed;
      p.vy = (p.vy / speed) * topSpeed;
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
      // The pearl that takes the count to 30 is the Heart of the Deep.
      const kind = s.pearlsCollected >= PEARLS_TO_WIN - 1
        ? 'heart-pearl'
        : (s.pearlsSpawned + 1) % GOLDEN.every === 0 ? 'golden' : 'pearl';
      s.pearls.push(makePearl(this.random, kind));
      s.pearlsSpawned += 1;
      const interval = Math.max(PEARL.minInterval, PEARL.interval * Math.pow(PEARL.intervalScale, level - 1));
      s.pearlTimer = interval * range(this.random, 0.75, 1.25);
    }
    s.orbTimer -= dt;
    if (s.orbTimer <= 0) {
      s.orbs.push(makeOrb(this.random));
      s.orbTimer = ORB.interval * range(this.random, 0.85, 1.2);
    }
    s.heartTimer -= dt;
    if (s.heartTimer <= 0) {
      s.hearts.push(makeHeart(this.random));
      s.heartTimer = HEART.interval * range(this.random, 0.85, 1.2);
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
    // Jellyfish only once the run reaches the Deep Trench.
    if (s.zone >= 1) {
      s.jellyTimer -= dt;
      const jellyCap = Math.min(JELLY.maxCount, 1 + s.zone);
      if (s.jellyTimer <= 0 && s.jellies.length < jellyCap) {
        const jelly = makeJelly(this.random);
        jelly.baseY = jelly.y;
        s.jellies.push(jelly);
        const interval = Math.max(JELLY.minInterval, JELLY.interval * Math.pow(0.9, level - 1));
        s.jellyTimer = interval * range(this.random, 0.8, 1.3);
      }
    }
    // The boss surfaces at 25 pearls and guards the Heart.
    if (s.boss === null && s.pearlsCollected >= BOSS.appearAt) {
      s.boss = makeBoss(this.random);
      events.boss = true;
      popup(this, p.x, p.y - 44, 'Something huge stirs...', '#ff8fa3');
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
    const driftLeft = (item, dtStep) => {
      item.x -= item.speed * dtStep;
      item.phase += dtStep * 2;
    };
    for (const pearl of s.pearls) driftLeft(pearl, dt);
    for (const orb of s.orbs) driftLeft(orb, dt);
    for (const heart of s.hearts) driftLeft(heart, dt);
    for (const angler of s.anglers) {
      angler.x += angler.direction * angler.speed * dt;
      angler.phase += dt * 2.4;
      angler.y = angler.baseY + Math.sin(angler.phase) * angler.wobble;
    }
    for (const jelly of s.jellies) {
      jelly.x += jelly.direction * jelly.speed * dt;
      jelly.phase += dt * 2;
      jelly.y = jelly.baseY + Math.sin(jelly.phase) * jelly.wobble;
    }
    // The boss hunts: it steers toward the fish, slowly, and never leaves the field.
    if (s.boss !== null && s.boss.active) {
      const boss = s.boss;
      const dx = p.x - boss.x;
      const dy = p.y - boss.y;
      const length = Math.hypot(dx, dy) || 1;
      boss.x += (dx / length) * boss.speed * dt;
      boss.y += (dy / length) * boss.speed * dt * 0.7;
      boss.phase += dt * 2;
      boss.direction = dx > 0 ? 1 : -1;
    }
    for (const bubble of s.bubbles) {
      bubble.y -= bubble.speed * dt;
      bubble.wobble += dt * 3;
      bubble.x += Math.sin(bubble.wobble) * 12 * dt;
    }
    s.bubbles = s.bubbles.filter((bubble) => bubble.y > -10);
    s.pearls = s.pearls.filter((pearl) => pearl.x > -50);
    s.orbs = s.orbs.filter((orb) => orb.x > -50);
    s.hearts = s.hearts.filter((heart) => heart.x > -50);
    s.anglers = s.anglers.filter((angler) => angler.x > -90 && angler.x < FIELD.width + 90);
    s.jellies = s.jellies.filter((jelly) => jelly.x > -90 && jelly.x < FIELD.width + 90);

    const distTo = (item) => Math.hypot(item.x - p.x, item.y - p.y);

    // --- Pearls: quick chains raise the multiplier; the Heart ends the run ---
    for (const pearl of s.pearls) {
      if (!pearl.active || distTo(pearl) > pearl.radius + p.radius) continue;
      pearl.active = false;
      s.pearlsCollected += 1;
      s.chain += 1;
      s.chainTimer = COMBO.window;
      const tier = this.comboTier();
      let gained;
      let colour = '#aef3ff';
      if (pearl.kind === 'heart-pearl') {
        gained = HEART_PEARL.points * tier;
        s.score += gained;
        events.pearlTier = tier;
        burst(this, pearl.x, pearl.y, '#ff7fa5', 26);
        popup(this, pearl.x, pearl.y - 14, `Heart of the Deep! +${gained}`, '#ffd76a');
        s.over = 'win';
        events.over = EVENT_WIN;
        return events;
      }
      if (pearl.kind === 'golden') {
        gained = GOLDEN.points * tier;
        s.light = Math.min(LIGHT_START, s.light + GOLDEN.lightRefill);
        events.golden = true;
        colour = '#ffe9a8';
        burst(this, pearl.x, pearl.y, '#ffc94d', 14);
      } else {
        gained = PEARL.points * tier;
        burst(this, pearl.x, pearl.y, '#7fe7ff', 10);
      }
      s.score += gained;
      events.pearlTier = tier;
      popup(this, pearl.x, pearl.y - 14, `+${gained}`, colour);
      const nextLevel = Math.min(LEVEL.max, 1 + Math.floor(s.pearlsCollected / LEVEL.pearlsPerLevel));
      if (nextLevel > s.level) {
        s.level = nextLevel;
        events.levelUp = true;
        popup(this, p.x, p.y - 44, `Level ${s.level}`, '#ffd76a');
      }
      const nextZone = zoneOf(s.pearlsCollected);
      if (nextZone > s.zone) {
        s.zone = nextZone;
        events.zoneUp = true;
        popup(this, p.x, p.y - 64, ZONES[nextZone].name, '#aef3ff');
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
      if (!orb.active || distTo(orb) > orb.radius + p.radius) continue;
      orb.active = false;
      s.light = Math.min(LIGHT_START, s.light + LIGHT_ORB_REFILL);
      s.score += ORB.points;
      events.orb = true;
      burst(this, orb.x, orb.y, '#ffc94d', 14);
      popup(this, orb.x, orb.y - 14, `+${ORB.points} light!`, '#ffe9a8');
    }
    s.orbs = s.orbs.filter((orb) => orb.active);

    // --- Heart pickups grant an extra life ---
    for (const heart of s.hearts) {
      if (!heart.active || distTo(heart) > heart.radius + p.radius) continue;
      heart.active = false;
      if (s.lives < MAX_LIVES) s.lives += 1;
      s.score += 15;
      events.heart = true;
      burst(this, heart.x, heart.y, '#ff7fa5', 14);
      popup(this, heart.x, heart.y - 14, '+1 life!', '#ff8fa3');
    }
    s.hearts = s.hearts.filter((heart) => heart.active);

    // --- Anglerfish bites cost a life, some light, and the chain ---
    if (p.invulnerable <= 0) {
      for (const angler of s.anglers) {
        if (!angler.active || distTo(angler) > angler.radius + p.radius - 6) continue;
        angler.active = false;
        if (this.hurt(s, angler.x, angler.y, events)) return events;
        break;
      }
    }
    s.anglers = s.anglers.filter((angler) => angler.active);

    // --- Jellyfish stings ---
    if (p.invulnerable <= 0 && s.over === null) {
      for (const jelly of s.jellies) {
        if (!jelly.active || distTo(jelly) > jelly.radius + p.radius - 4) continue;
        jelly.active = false;
        if (this.hurt(s, jelly.x, jelly.y, events)) return events;
        break;
      }
    }
    s.jellies = s.jellies.filter((jelly) => jelly.active);

    // --- The boss's bite ---
    if (p.invulnerable <= 0 && s.over === null && s.boss !== null && s.boss.active) {
      if (distTo(s.boss) <= s.boss.radius + p.radius - 10) {
        if (this.hurt(s, s.boss.x, s.boss.y, events)) return events;
      }
    }

    // --- Particles and floating labels fade out ---
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
