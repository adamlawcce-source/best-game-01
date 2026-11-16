// The screenshot scenes behind ?shot=menu|play|deep|abyss|win|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot that chases the nearest pearl and keeps clear of anglerfish, so the frame is
// what a short game really looks like. The end scene's pilot is careless: it chases
// pearls and ignores the hunters, so it is caught out, as a hurried player is. The deep,
// abyss and win scenes fast-forward the careful pilot until the run reaches that zone,
// the boss, or the win.

import { PEARLS_TO_WIN, STEP } from './config.js';
import { EVENT_LOSE, EVENT_WIN } from './world.js';
import { SCREEN_LOSE, SCREEN_MENU, SCREEN_PLAY, SCREEN_WIN } from './render3d.js';

const MENU_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
const FAST_LIMIT_SECONDS = 900;
const FLEE_DISTANCE = 180;
const SAMPLE = STEP;

/** The nearest active pearl, or the nearest orb when the lamp is running low. */
function pickTarget(state) {
  let target = null;
  let bestDistance = Infinity;
  // Late in the run, chase the Heart of the Deep first.
  const heartPearls = state.pearls.filter((pearl) => pearl.kind === 'heart-pearl');
  const pool = heartPearls.length > 0
    ? heartPearls
    : state.light < 45 ? [...state.orbs, ...state.pearls] : state.pearls;
  for (const item of pool) {
    if (!item.active) continue;
    const distance = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      target = item;
    }
  }
  return target;
}

/** The nearest anglerfish or jellyfish and how far away it is. */
function nearestThreat(state) {
  let nearest = null;
  let bestDistance = Infinity;
  const threats = [...state.anglers, ...state.jellies];
  if (state.boss !== null) threats.push(state.boss);
  for (const threat of threats) {
    if (!threat.active) continue;
    const distance = Math.hypot(threat.x - state.player.x, threat.y - state.player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = threat;
    }
  }
  return { threat: nearest, distance: bestDistance };
}

function clampUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

/**
 * Steering for one step. A careful pilot blends a chase vector toward its target with a
 * flee vector away from any threat too close, and dashes when one gets very close; a
 * careless one chases and nothing else.
 */
export function autopilot(state, careful) {
  const player = state.player;
  const target = pickTarget(state);
  let vx = 0;
  let vy = 0;
  if (target !== null) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy) || 1;
    vx = dx / distance;
    vy = dy / distance;
  }
  let dash = false;
  if (careful) {
    const { threat, distance } = nearestThreat(state);
    if (threat !== null && distance < FLEE_DISTANCE) {
      const dx = player.x - threat.x;
      const dy = player.y - threat.y;
      const length = Math.hypot(dx, dy) || 1;
      const strength = (FLEE_DISTANCE - distance) / FLEE_DISTANCE;
      // Close danger takes over: flee hard, barely chase.
      vx = vx * 0.35 + (dx / length) * strength * 2.2;
      vy = vy * 0.35 + (dy / length) * strength * 2.2;
      if (distance < 95) dash = true;
    }
  }
  return { x: clampUnit(vx), y: clampUnit(vy), pointer: null, dash };
}

/** Run the careful pilot until `done(state)` is true, the run ends, or time runs out. */
function fastForward(world, done) {
  let events = { over: 0 };
  for (let index = 0; index < FAST_LIMIT_SECONDS / SAMPLE; index += 1) {
    events = world.step(SAMPLE, autopilot(world.state, true));
    if (events.over !== 0) break;
    if (done(world.state)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (menu, play, deep, abyss, win or end; any other name
 * is menu) and return the screen to draw over it and the best score to show. `seconds`
 * overrides how long the play scene runs, for a later-game frame.
 */
export function stageShot(name, world, seconds = null) {
  world.reset();
  if (name !== 'play' && name !== 'deep' && name !== 'abyss' && name !== 'win' && name !== 'end') {
    for (let index = 0; index < MENU_SECONDS / SAMPLE; index += 1) {
      world.step(SAMPLE, { x: 0, y: 0, pointer: null, dash: false });
    }
    return { screen: SCREEN_MENU, best: 0 };
  }
  if (name === 'deep') {
    const events = fastForward(world, (state) => state.zone >= 1 && state.pearlsCollected >= 12);
    if (events.over === EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (events.over === EVENT_LOSE) return { screen: SCREEN_LOSE, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'abyss') {
    const events = fastForward(world, (state) => state.boss !== null && state.pearlsCollected >= 26);
    if (events.over === EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (events.over === EVENT_LOSE) return { screen: SCREEN_LOSE, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    const events = fastForward(world, (state) => state.over === 'win');
    if (events.over === EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (events.over === EVENT_LOSE) return { screen: SCREEN_LOSE, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : (seconds ?? PLAY_SECONDS);
  const careful = name !== 'end';
  let events = { over: 0 };
  for (let index = 0; index < limit / SAMPLE; index += 1) {
    events = world.step(SAMPLE, autopilot(world.state, careful));
    if (events.over !== 0) break;
  }
  if (events.over === EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
  if (events.over === EVENT_LOSE) return { screen: SCREEN_LOSE, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
